// ============================================
// MUBAS ASSESSMENT SYSTEM
// BACKEND SERVER
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./config/database');
const bcrypt = require('bcryptjs');
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_me';

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ============================================
// LOGGING MIDDLEWARE
// ============================================
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
}

// ============================================
// ROLE-BASED AUTHORIZATION MIDDLEWARE
// ============================================

// Helper: build a middleware that allows specific roles
function allowRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied — role '${req.user.role}' not permitted. Required: ${roles.join(' or ')}`
            });
        }
        next();
    };
}

// Any authenticated staff member (no Student)
const requireStaff    = allowRoles('Admin', 'Registrar', 'VC', 'Senate', 'Dean', 'HoD', 'Lecturer');

// Admin only (System Administrator + Registrar)
const requireAdmin    = allowRoles('Admin', 'Registrar');

// Academic leadership — used for read-only broad views
const requireLeadership = allowRoles('Admin', 'Registrar', 'VC', 'Senate', 'Dean', 'HoD');

// Specific approvers
const requireVC       = allowRoles('VC', 'Admin');
const requireSenate   = allowRoles('Senate', 'Admin', 'VC');
const requireDean     = allowRoles('Dean', 'Admin');
const requireHoD      = allowRoles('HoD', 'Admin');

// Lecturers (and above can also view)
const requireLecturer = allowRoles('Lecturer', 'HoD', 'Dean', 'Senate', 'VC', 'Admin', 'Registrar');

// Students only
const requireStudent  = allowRoles('Student');

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt:', { username, password });

        if (!username || !password) {
            return res.status(400).json({ message: 'Username and password required' });
        }

        const [users] = await db.query(
            'SELECT * FROM User WHERE username = ? OR email = ?',
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

                const user = users[0];

        // Verify password with bcrypt
        let passwordMatches = false;
        try {
            if (user.password_hash && user.password_hash.startsWith('$2')) {
                // Hashed password (new users)
                passwordMatches = await bcrypt.compare(password, user.password_hash);
            } else {
                // Legacy plain-text password (migrating)
                passwordMatches = (password === user.password_hash);
                // Auto-upgrade to hashed on successful login
                if (passwordMatches) {
                    const newHash = await bcrypt.hash(password, 10);
                    await db.query(
                        'UPDATE User SET password_hash = ? WHERE user_id = ?',
                        [newHash, user.user_id]
                    );
                    console.log(`✅ Auto-hashed password for ${user.username}`);
                }
            }
        } catch (e) {
            console.error('Password verification error:', e);
            passwordMatches = false;
        }

        if (!passwordMatches) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.user_id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        let studentNumber = null;
        if (user.role === 'Student') {
            const [students] = await db.query(
                'SELECT student_number FROM Student WHERE user_id = ?',
                [user.user_id]
            );
            if (students.length > 0) studentNumber = students[0].student_number;
        }

        console.log('Login success for:', user.username);

        res.json({
            token,
            user: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                role: user.role,
                studentNumber: studentNumber
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error: ' + err.message });
    }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
    res.json({ user: req.user });
});

// ============================================
// PUBLIC ROUTES
// ============================================

app.get('/api/test', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM University');
        res.json({ message: '✅ Database connected!', university: rows[0] });
    } catch (err) {
        res.status(500).json({ message: '❌ DB error', error: err.message });
    }
});

app.get('/api/schools', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM School');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// STUDENT ENDPOINTS
// ============================================

app.get('/api/students', authenticate, async (req, res) => {
    try {
        const studentNumber = req.query.studentNumber;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber query parameter' });

        const [rows] = await db.query(`
            SELECT s.*, p.name AS program, d.name AS department, sch.name AS school
            FROM Student s
            LEFT JOIN Program p ON s.program_id = p.program_id
            LEFT JOIN Department d ON s.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            WHERE s.student_number = ?
        `, [studentNumber]);

        if (rows.length === 0) return res.status(404).json({ message: 'Student not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/results', authenticate, async (req, res) => {
    try {
        const studentNumber = req.query.studentNumber;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber query parameter' });

        const [rows] = await db.query(
            'SELECT * FROM vw_student_results WHERE student_number = ?',
            [studentNumber]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/gpa', authenticate, async (req, res) => {
    try {
        const studentNumber = req.query.studentNumber;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber query parameter' });

        const [semester] = await db.query(
            'SELECT * FROM vw_student_semester_gpa WHERE student_number = ?',
            [studentNumber]
        );
        const [cgpa] = await db.query(`
            SELECT ROUND(SUM(semester_gpa * total_credits) / SUM(total_credits), 2) AS cumulative_gpa,
                   SUM(total_credits) AS total_credits
            FROM vw_student_semester_gpa WHERE student_number = ?
        `, [studentNumber]);

        res.json({ semesterGPA: semester, cumulativeGPA: cgpa[0] || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/profile', authenticate, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [rows] = await db.query(
            'SELECT * FROM vw_student_profile WHERE student_number = ?',
            [studentNumber]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Student not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Profile error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/current-modules', authenticate, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [rows] = await db.query(
            'SELECT * FROM vw_student_current_modules WHERE student_number = ? ORDER BY module_code',
            [studentNumber]
        );
        res.json(rows);
    } catch (err) {
        console.error('Current modules error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/history', authenticate, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [semesters] = await db.query(
            `SELECT * FROM vw_student_semester_history 
             WHERE student_number = ? 
             ORDER BY semester_number`,
            [studentNumber]
        );

        const [years] = await db.query(
            `SELECT * FROM vw_student_year_summary 
             WHERE student_number = ? 
             ORDER BY year_name`,
            [studentNumber]
        );

        res.json({ semesters, years });
    } catch (err) {
        console.error('History error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/summary', authenticate, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [rows] = await db.query(
            'SELECT * FROM vw_student_cumulative WHERE student_number = ?',
            [studentNumber]
        );
        res.json(rows[0] || null);
    } catch (err) {
        console.error('Summary error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/assessments', authenticate, async (req, res) => {
    try {
        const { studentNumber, semesterId, moduleCode, assessmentType } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        let sql = 'SELECT * FROM vw_student_assessments WHERE student_number = ?';
        const params = [studentNumber];

        if (semesterId) {
            sql += ' AND semester_id = ?';
            params.push(semesterId);
        }
        if (moduleCode) {
            sql += ' AND module_code = ?';
            params.push(moduleCode);
        }
        if (assessmentType) {
            sql += ' AND assessment_type = ?';
            params.push(assessmentType);
        }

        sql += ' ORDER BY semester_number, module_code, due_date';

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Assessments error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/module/:moduleCode', authenticate, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        const { moduleCode } = req.params;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [summary] = await db.query(
            'SELECT * FROM vw_student_module_summary WHERE student_number = ? AND module_code = ?',
            [studentNumber, moduleCode]
        );

        const [assessments] = await db.query(
            'SELECT * FROM vw_student_assessments WHERE student_number = ? AND module_code = ? ORDER BY due_date',
            [studentNumber, moduleCode]
        );

        res.json({ summary: summary[0] || null, assessments });
    } catch (err) {
        console.error('Module detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/progress', authenticate, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [rows] = await db.query(`
            SELECT 
                p.duration_years,
                p.total_credits_required,
                (SELECT COUNT(DISTINCT module_id) FROM vw_student_module_summary 
                 WHERE student_number = ?) AS modules_registered,
                (SELECT COUNT(DISTINCT module_id) FROM vw_student_module_summary 
                 WHERE student_number = ? AND final_grade_points IS NOT NULL) AS modules_completed,
                (SELECT COALESCE(SUM(credits), 0) FROM vw_student_module_summary 
                 WHERE student_number = ? AND final_grade_points IS NOT NULL) AS credits_earned
            FROM Student s
            JOIN Program p ON s.program_id = p.program_id
            WHERE s.student_number = ?
        `, [studentNumber, studentNumber, studentNumber, studentNumber]);

        res.json(rows[0] || null);
    } catch (err) {
        console.error('Progress error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/current-module-details', authenticate, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [rows] = await db.query(
            `SELECT 
                mo.offering_id,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                mo.room,
                mo.schedule,
                CONCAT(l.title, ' ', l.first_name, ' ', l.last_name) AS lecturer_name,
                l.email AS lecturer_email,
                (SELECT COUNT(*) FROM Assessment a WHERE a.offering_id = mo.offering_id) AS assessment_count,
                (SELECT COUNT(*) FROM Assessment a 
                 JOIN Grade g ON g.assessment_id = a.assessment_id
                 WHERE a.offering_id = mo.offering_id AND g.enrollment_id = e.enrollment_id) AS graded_count
             FROM Student s
             JOIN Enrollment e ON s.student_id = e.student_id
             JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
             JOIN Module m ON mo.module_id = m.module_id
             JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
             JOIN Semester sem ON mo.semester_id = sem.semester_id
             WHERE s.student_number = ? AND sem.is_active = TRUE
             ORDER BY m.code`,
            [studentNumber]
        );
        res.json(rows);
    } catch (err) {
        console.error('Current module details error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/students/assessment-matrix', authenticate, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [rows] = await db.query(
            `SELECT * FROM vw_student_assessment_matrix 
             WHERE student_number = ? 
             ORDER BY semester_number, module_code`,
            [studentNumber]
        );
        res.json(rows);
    } catch (err) {
        console.error('Matrix error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

app.get('/api/admin/stats', authenticate, requireStaff, async (req, res) => {
    try {
        const [stats] = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM Student) AS total_students,
                (SELECT COUNT(*) FROM Student WHERE status='Active') AS active_students,
                (SELECT COUNT(*) FROM Student WHERE status='Graduated') AS graduated_students,
                (SELECT COUNT(*) FROM Lecturer WHERE status='Active') AS total_lecturers,
                (SELECT COUNT(*) FROM Program) AS total_programs,
                (SELECT COUNT(*) FROM Module) AS total_modules,
                (SELECT COUNT(*) FROM ModuleOffering) AS total_offerings,
                (SELECT COUNT(*) FROM School) AS total_schools,
                (SELECT COUNT(*) FROM Department) AS total_departments,
                (SELECT COUNT(*) FROM User WHERE role='Student' AND is_active=TRUE) AS active_users
        `);
        res.json(stats[0]);
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/students', authenticate, requireStaff, async (req, res) => {
    try {
        const { programCode, year, search } = req.query;
        let sql = `
            SELECT 
                s.student_id,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS full_name,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.enrollment_date,
                s.current_year_of_study,
                s.current_semester,
                s.academic_standing,
                s.status AS student_status,
                p.code AS program_code,
                p.name AS program_name,
                p.duration_years,
                d.name AS department_name,
                sch.name AS school_name
            FROM Student s
            LEFT JOIN Program p ON s.program_id = p.program_id
            LEFT JOIN Department d ON s.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            WHERE 1=1
        `;
        const params = [];

        if (programCode) {
            sql += ' AND p.code = ?';
            params.push(programCode);
        }
        if (year) {
            sql += ' AND s.current_year_of_study = ?';
            params.push(year);
        }
        if (search) {
            sql += ' AND (s.student_number LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ?)';
            const like = `%${search}%`;
            params.push(like, like, like, like);
        }

        sql += ' ORDER BY p.code, s.current_year_of_study, s.student_number';

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Admin students error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Student detail (admin view) — using query param to avoid slash issues
app.get('/api/admin/student-detail', authenticate, requireStaff, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [profile] = await db.query(
            'SELECT * FROM vw_student_profile WHERE student_number = ?',
            [studentNumber]
        );
        if (profile.length === 0) return res.status(404).json({ message: 'Student not found' });

        const [semesters] = await db.query(
            'SELECT * FROM vw_student_semester_history WHERE student_number = ? ORDER BY semester_number',
            [studentNumber]
        );

        const [years] = await db.query(
            'SELECT * FROM vw_student_year_summary WHERE student_number = ? ORDER BY year_name',
            [studentNumber]
        );

        const [cumulative] = await db.query(
            'SELECT * FROM vw_student_cumulative WHERE student_number = ?',
            [studentNumber]
        );

        const [matrix] = await db.query(
            'SELECT * FROM vw_student_assessment_matrix WHERE student_number = ? ORDER BY semester_number, module_code',
            [studentNumber]
        );

        res.json({
            profile: profile[0],
            semesters,
            years,
            cumulative: cumulative[0] || null,
            modules: matrix
        });
    } catch (err) {
        console.error('Admin student detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// LECTURERS (scoped by role + balanced counts)
// ============================================
app.get('/api/admin/lecturers', authenticate, requireStaff, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        let scopeFilter = '';
        const params = [];

        if (role === 'HoD') {
            scopeFilter = `
                WHERE l.dept_id = (
                    SELECT dept_id FROM Lecturer WHERE user_id = ?
                )
            `;
            params.push(userId);
        } else if (role === 'Dean') {
            scopeFilter = `
                WHERE d.school_id = (
                    SELECT d2.school_id 
                    FROM Lecturer l2 
                    JOIN Department d2 ON l2.dept_id = d2.dept_id 
                    WHERE l2.user_id = ?
                )
            `;
            params.push(userId);
        }

        const [rows] = await db.query(`
            SELECT 
                l.lecturer_id,
                l.staff_number,
                CONCAT(l.title, ' ', l.first_name, ' ', l.last_name) AS full_name,
                l.email,
                l.phone,
                l.position,
                l.highest_qualification,
                l.date_joined,
                l.status,
                l.is_hod,
                l.is_dean,
                d.name AS department_name,
                sch.name AS school_name,
                (SELECT COUNT(DISTINCT mo.module_id) 
                 FROM ModuleOffering mo 
                 WHERE mo.lecturer_id = l.lecturer_id) AS modules_taught,
                (SELECT COUNT(*) 
                 FROM ModuleOffering mo 
                 WHERE mo.lecturer_id = l.lecturer_id) AS offerings_taught
            FROM Lecturer l
            LEFT JOIN Department d ON l.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            ${scopeFilter}
            ORDER BY d.name, l.last_name
        `, params);

        res.json(rows);
    } catch (err) {
        console.error('Admin lecturers error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/programs', authenticate, requireStaff, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.program_id,
                p.code,
                p.name,
                p.type,
                p.level,
                p.duration_years,
                p.total_credits_required,
                d.name AS department_name,
                sch.name AS school_name,
                (SELECT COUNT(*) FROM Student s WHERE s.program_id = p.program_id) AS student_count,
                (SELECT COUNT(*) FROM Curriculum c WHERE c.program_id = p.program_id) AS module_count
            FROM Program p
            LEFT JOIN Department d ON p.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            ORDER BY sch.name, d.name, p.code
        `);
        res.json(rows);
    } catch (err) {
        console.error('Admin programs error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/structure', authenticate, requireStaff, async (req, res) => {
    try {
        const [schools] = await db.query(`
            SELECT 
                sch.school_id,
                sch.name,
                sch.code,
                sch.contact_email,
                (SELECT COUNT(*) FROM Department d WHERE d.school_id = sch.school_id) AS department_count,
                (SELECT COUNT(*) FROM Program p 
                 JOIN Department d ON p.dept_id = d.dept_id 
                 WHERE d.school_id = sch.school_id) AS program_count,
                (SELECT COUNT(*) FROM Student s 
                 JOIN Department d ON s.dept_id = d.dept_id 
                 WHERE d.school_id = sch.school_id) AS student_count
            FROM School sch
            ORDER BY sch.name
        `);

        const [departments] = await db.query(`
            SELECT 
                d.dept_id,
                d.school_id,
                d.name,
                d.code,
                (SELECT COUNT(*) FROM Program p WHERE p.dept_id = d.dept_id) AS program_count,
                (SELECT COUNT(*) FROM Student s WHERE s.dept_id = d.dept_id) AS student_count
            FROM Department d
            ORDER BY d.school_id, d.name
        `);

        res.json({ schools, departments });
    } catch (err) {
        console.error('Admin structure error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ROLE-BASED SCOPED ENDPOINTS
// ============================================

app.get('/api/admin/my-scope', authenticate, requireStaff, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                u.user_id,
                u.username,
                u.email,
                u.role,
                l.lecturer_id,
                l.staff_number,
                l.title,
                l.first_name,
                l.last_name,
                l.position,
                d.dept_id,
                d.name AS department_name,
                d.code AS department_code,
                sch.school_id,
                sch.name AS school_name,
                sch.code AS school_code
            FROM User u
            LEFT JOIN Lecturer l ON u.user_id = l.user_id
            LEFT JOIN Department d ON l.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            WHERE u.user_id = ?
        `, [req.user.userId]);

        if (rows.length === 0) return res.status(404).json({ message: 'Scope not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Scope error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/scoped-students', authenticate, requireStaff, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;
        const { programCode, year, search } = req.query;

        let sql = `
            SELECT DISTINCT
                s.student_id,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS full_name,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.enrollment_date,
                s.current_year_of_study,
                s.current_semester,
                s.academic_standing,
                s.status AS student_status,
                p.code AS program_code,
                p.name AS program_name,
                p.duration_years,
                d.dept_id,
                d.name AS department_name,
                sch.school_id,
                sch.name AS school_name
            FROM Student s
            LEFT JOIN Program p ON s.program_id = p.program_id
            LEFT JOIN Department d ON s.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
        `;

        const params = [];
        const conditions = [];

        if (role === 'Lecturer') {
            sql += `
                JOIN Enrollment e ON s.student_id = e.student_id
                JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
                JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            `;
            conditions.push('l.user_id = ?');
            params.push(userId);
        } else if (role === 'HoD') {
            sql += `JOIN Lecturer l ON l.user_id = ?`;
            conditions.push('d.dept_id = l.dept_id');
            params.push(userId);
        } else if (role === 'Dean') {
            sql += `
                JOIN Lecturer l ON l.user_id = ?
                JOIN Department dean_dept ON l.dept_id = dean_dept.dept_id
            `;
            conditions.push('d.school_id = dean_dept.school_id');
            params.push(userId);
        }

        if (programCode) {
            conditions.push('p.code = ?');
            params.push(programCode);
        }
        if (year) {
            conditions.push('s.current_year_of_study = ?');
            params.push(year);
        }
        if (search) {
            conditions.push('(s.student_number LIKE ? OR s.first_name LIKE ? OR s.last_name LIKE ? OR s.email LIKE ?)');
            const like = `%${search}%`;
            params.push(like, like, like, like);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY sch.name, d.name, p.code, s.current_year_of_study, s.student_number';

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Scoped students error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/scoped-stats', authenticate, requireStaff, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        let scopeFilter = '';
        const params = [];

        if (role === 'Lecturer') {
            scopeFilter = `
                JOIN Enrollment e ON s.student_id = e.student_id
                JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
                JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
                WHERE l.user_id = ?
            `;
            params.push(userId);
        } else if (role === 'HoD') {
            scopeFilter = `
                JOIN Lecturer l ON l.user_id = ?
                WHERE s.dept_id = l.dept_id
            `;
            params.push(userId);
        } else if (role === 'Dean') {
            scopeFilter = `
                JOIN Lecturer l ON l.user_id = ?
                JOIN Department dean_dept ON l.dept_id = dean_dept.dept_id
                WHERE s.dept_id IN (
                    SELECT dept_id FROM Department WHERE school_id = dean_dept.school_id
                )
            `;
            params.push(userId);
        }

        const [rows] = await db.query(`
            SELECT 
                COUNT(DISTINCT s.student_id) AS total_students,
                COUNT(DISTINCT CASE WHEN s.status='Active' THEN s.student_id END) AS active_students,
                COUNT(DISTINCT CASE WHEN s.status='Graduated' THEN s.student_id END) AS graduated_students,
                COUNT(DISTINCT s.program_id) AS total_programs,
                COUNT(DISTINCT s.dept_id) AS total_departments
            FROM Student s
            ${scopeFilter}
        `, params);

        res.json(rows[0]);
    } catch (err) {
        console.error('Scoped stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// LECTURER ENDPOINTS
// ============================================

// Get all module offerings the logged-in lecturer teaches
app.get('/api/lecturer/my-offerings', authenticate, requireLecturer, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { semesterId } = req.query;

        let sql = `
            SELECT 
                mo.offering_id,
                m.module_id,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                m.level,
                mo.room,
                mo.schedule,
                mo.capacity,
                mo.current_enrollment,
                mo.status AS offering_status,
                sem.semester_id,
                sem.name AS semester_name,
                sem.is_active AS semester_is_active,
                ay.year_name,
                p.code AS program_code,
                p.name AS program_name,
                c.year_of_study,
                c.semester AS curriculum_semester,
                (c.year_of_study * 2 - (2 - c.semester)) AS semester_number,
                COUNT(DISTINCT e.enrollment_id) AS student_count,
                COUNT(DISTINCT CASE WHEN e.status='Enrolled' THEN e.enrollment_id END) AS active_students,
                COUNT(DISTINCT CASE WHEN e.status='Completed' THEN e.enrollment_id END) AS completed_students,
                (SELECT COUNT(*) FROM Assessment a WHERE a.offering_id = mo.offering_id) AS assessment_count,
                (SELECT COUNT(*) FROM Grade g 
                 JOIN Enrollment e2 ON g.enrollment_id = e2.enrollment_id
                 WHERE e2.offering_id = mo.offering_id) AS grades_entered
            FROM Lecturer l
            JOIN ModuleOffering mo ON mo.lecturer_id = l.lecturer_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            JOIN Curriculum c ON c.module_id = m.module_id
            JOIN Program p ON c.program_id = p.program_id
            LEFT JOIN Enrollment e ON e.offering_id = mo.offering_id
            WHERE l.user_id = ?
        `;
        const params = [userId];

        if (semesterId) {
            sql += ' AND sem.semester_id = ?';
            params.push(semesterId);
        }

        sql += `
            GROUP BY mo.offering_id, c.year_of_study, c.semester, p.program_id
            ORDER BY sem.is_active DESC, ay.year_name DESC, c.year_of_study, m.code
        `;

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Lecturer offerings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// LECTURER GRADEBOOK ENDPOINTS
// ============================================

// Get offering detail with enrolled students + current grades
app.get('/api/lecturer/offering-detail', authenticate, requireLecturer, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { offeringId } = req.query;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });

        // Verify this lecturer teaches this offering
        const [offeringCheck] = await db.query(`
            SELECT mo.offering_id
            FROM ModuleOffering mo
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            WHERE mo.offering_id = ? AND l.user_id = ?
        `, [offeringId, userId]);

        if (offeringCheck.length === 0) {
            return res.status(403).json({ message: 'You do not teach this offering' });
        }

                // Offering summary
        const [offering] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                m.level,
                mo.room,
                mo.schedule,
                mo.status AS offering_status,
                sem.semester_id,
                sem.name AS semester_name,
                sem.is_active AS semester_is_active,
                ay.year_name,
                p.code AS program_code,
                p.name AS program_name,
                c.year_of_study,
                c.semester AS curriculum_semester,
                (c.year_of_study * 2 - (2 - c.semester)) AS semester_number
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            JOIN Curriculum c ON c.module_id = m.module_id
            JOIN Program p ON c.program_id = p.program_id
            WHERE mo.offering_id = ? AND l.user_id = ?
            LIMIT 1
        `, [offeringId, userId]);

        // Assessments for this offering
        const [assessments] = await db.query(`
            SELECT 
                assessment_id,
                name,
                type,
                weight_percentage,
                max_score,
                due_date
            FROM Assessment
            WHERE offering_id = ?
            ORDER BY due_date
        `, [offeringId]);

        // Enrolled students with their grades
        const [students] = await db.query(`
            SELECT 
                s.student_id,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS full_name,
                e.enrollment_id,
                e.status AS enrollment_status,
                e.enrollment_date
            FROM Enrollment e
            JOIN Student s ON e.student_id = s.student_id
            WHERE e.offering_id = ?
            ORDER BY s.student_number
        `, [offeringId]);

        // Get all grades for these enrollments
        const [grades] = await db.query(`
            SELECT 
                g.grade_id,
                g.enrollment_id,
                g.assessment_id,
                g.score_obtained,
                g.percentage,
                g.grade_letter,
                g.grade_points,
                g.graded_date
            FROM Grade g
            JOIN Enrollment e ON g.enrollment_id = e.enrollment_id
            WHERE e.offering_id = ?
        `, [offeringId]);

        res.json({
            offering: offering[0] || null,
            assessments,
            students,
            grades
        });
    } catch (err) {
        console.error('Offering detail error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Save a grade (insert or update)
app.post('/api/lecturer/save-grade', authenticate, requireLecturer, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { enrollmentId, assessmentId, scoreObtained } = req.body;

        if (!enrollmentId || !assessmentId) {
            return res.status(400).json({ message: 'Missing enrollmentId or assessmentId' });
        }
        if (scoreObtained === null || scoreObtained === undefined || scoreObtained === '') {
            return res.status(400).json({ message: 'Missing scoreObtained' });
        }

        const score = parseFloat(scoreObtained);
        if (isNaN(score) || score < 0) {
            return res.status(400).json({ message: 'Invalid score' });
        }

        // Verify this lecturer teaches the offering of the enrollment
        const [check] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.lecturer_id,
                l.lecturer_id AS teaching_lecturer_id,
                a.max_score
            FROM Enrollment e
            JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            JOIN Assessment a ON a.assessment_id = ?
            WHERE e.enrollment_id = ? AND l.user_id = ?
        `, [assessmentId, enrollmentId, userId]);

        if (check.length === 0) {
            return res.status(403).json({ message: 'Not authorized for this grade' });
        }

        const maxScore = parseFloat(check[0].max_score);
        if (score > maxScore) {
            return res.status(400).json({ message: `Score cannot exceed max (${maxScore})` });
        }

        // Calculate percentage, letter, points
        const percentage = (score / maxScore) * 100;
        let gradeLetter;
        if (percentage >= 96) gradeLetter = 'A+';
        else if (percentage >= 90) gradeLetter = 'A';
        else if (percentage >= 80) gradeLetter = 'A-';
        else if (percentage >= 77) gradeLetter = 'B+';
        else if (percentage >= 73) gradeLetter = 'B';
        else if (percentage >= 70) gradeLetter = 'B-';
        else if (percentage >= 67) gradeLetter = 'C+';
        else if (percentage >= 63) gradeLetter = 'C';
        else if (percentage >= 60) gradeLetter = 'C-';
        else if (percentage >= 57) gradeLetter = 'D+';
        else if (percentage >= 53) gradeLetter = 'D';
        else if (percentage >= 50) gradeLetter = 'D-';
        else if (percentage >= 45) gradeLetter = 'E+';
        else if (percentage >= 40) gradeLetter = 'E';
        else gradeLetter = 'F-';

        let gradePoints = 0.00;
        const pointMap = {
            'A+': 4.00, 'A': 3.90, 'A-': 3.70, 'B+': 3.69, 'B': 3.50,
            'B-': 3.00, 'C+': 2.99, 'C': 2.70, 'C-': 2.50, 'D+': 2.49,
            'D': 2.20, 'D-': 2.00, 'E+': 1.99, 'E': 1.00, 'F-': 0.00
        };
        gradePoints = pointMap[gradeLetter] || 0.00;

        // Insert or update
        await db.query(`
            INSERT INTO Grade 
                (enrollment_id, assessment_id, score_obtained, percentage, grade_letter, grade_points, graded_by, graded_date, submission_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                score_obtained = VALUES(score_obtained),
                percentage = VALUES(percentage),
                grade_letter = VALUES(grade_letter),
                grade_points = VALUES(grade_points),
                graded_by = VALUES(graded_by),
                graded_date = NOW()
        `, [enrollmentId, assessmentId, score, percentage, gradeLetter, gradePoints, check[0].teaching_lecturer_id]);

        res.json({
            message: 'Grade saved',
            score,
            percentage: percentage.toFixed(2),
            grade_letter: gradeLetter,
            grade_points: gradePoints
        });
    } catch (err) {
        console.error('Save grade error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// APPROVAL WORKFLOW ENDPOINTS
// ============================================

// Submit offering for HoD approval
app.post('/api/lecturer/submit-for-approval', authenticate, requireLecturer, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { offeringId, remarks } = req.body;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });

        // 1. Verify lecturer teaches this offering
        const [check] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                l.lecturer_id,
                l.user_id
            FROM ModuleOffering mo
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            WHERE mo.offering_id = ? AND l.user_id = ?
        `, [offeringId, userId]);

        if (check.length === 0) {
            return res.status(403).json({ message: 'Not authorized to submit this offering' });
        }

        const currentStatus = check[0].approval_status;
        if (currentStatus !== 'Draft' && currentStatus !== 'Rejected') {
            return res.status(400).json({
                message: `Cannot submit. Status is '${currentStatus}'. Only Draft or Rejected offerings can be submitted.`
            });
        }

        // 2. Check every student has a grade for every assessment
        const [incomplete] = await db.query(`
            SELECT 
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                a.name AS assessment_name
            FROM Enrollment e
            JOIN Student s ON e.student_id = s.student_id
            CROSS JOIN Assessment a
            LEFT JOIN Grade g ON g.enrollment_id = e.enrollment_id AND g.assessment_id = a.assessment_id
            WHERE e.offering_id = ? 
              AND a.offering_id = ?
              AND (g.grade_id IS NULL OR g.score_obtained IS NULL)
            LIMIT 10
        `, [offeringId, offeringId]);

        if (incomplete.length > 0) {
            return res.status(400).json({
                message: 'Cannot submit. Some grades are missing.',
                incomplete: incomplete
            });
        }

        // 3. Update status
        await db.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Submitted',
                submitted_at = NOW()
            WHERE offering_id = ?
        `, [offeringId]);

        // 4. Log to history
        await db.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, previous_status, new_status, remarks)
            VALUES (?, 'Submitted', ?, 'Lecturer', ?, 'Submitted', ?)
        `, [offeringId, userId, currentStatus, remarks || null]);

        // 5. Notify the HoD of the department
        try {
            const [deptInfo] = await db.query(`
                SELECT m.dept_id
                FROM ModuleOffering mo
                JOIN Module m ON mo.module_id = m.module_id
                WHERE mo.offering_id = ?
            `, [offeringId]);

            if (deptInfo.length > 0) {
                const deptId = deptInfo[0].dept_id;
                const [hods] = await db.query(
                    `SELECT user_id FROM Lecturer WHERE dept_id = ? AND is_hod = TRUE AND user_id IS NOT NULL`,
                    [deptId]
                );
                for (const hod of hods) {
                    await notifyUser(
                        hod.user_id,
                        'Approval',
                        'New gradebook submitted',
                        'A lecturer submitted a gradebook for your review.',
                        '/admin-dashboard.html'
                    );
                }
            }
        } catch (e) { console.error('HoD notify error:', e); }

        res.json({
            message: 'Submitted for HoD approval',
            offering_id: offeringId,
            new_status: 'Submitted'
        });
    } catch (err) {
        console.error('Submit approval error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// HOD APPROVAL ENDPOINTS
// ============================================

// List offerings pending this HoD's approval
app.get('/api/hod/pending-approvals', authenticate, requireHoD, async (req, res) => {
    try {
        const userId = req.user.userId;
        const role = req.user.role;

        if (role !== 'HoD') {
            return res.status(403).json({ message: 'Only HoDs can access this endpoint' });
        }

        // Get HoD's department
        const [hodInfo] = await db.query(`
            SELECT l.dept_id, l.lecturer_id, d.name AS dept_name
            FROM Lecturer l
            JOIN Department d ON l.dept_id = d.dept_id
            WHERE l.user_id = ?
        `, [userId]);

        if (hodInfo.length === 0) {
            return res.status(404).json({ message: 'HoD department not found' });
        }

        const deptId = hodInfo[0].dept_id;

        // Get all offerings in this department waiting for HoD approval
        const [rows] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                mo.submitted_at,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                m.level,
                sem.name AS semester_name,
                ay.year_name,
                p.code AS program_code,
                p.name AS program_name,
                c.year_of_study,
                c.semester AS curriculum_semester,
                CONCAT(l.title, ' ', l.first_name, ' ', l.last_name) AS lecturer_name,
                l.email AS lecturer_email,
                (SELECT COUNT(DISTINCT e.enrollment_id) FROM Enrollment e WHERE e.offering_id = mo.offering_id) AS student_count,
                (SELECT COUNT(DISTINCT a.assessment_id) FROM Assessment a WHERE a.offering_id = mo.offering_id) AS assessment_count,
                (SELECT COUNT(*) FROM Grade g
                 JOIN Enrollment e2 ON g.enrollment_id = e2.enrollment_id
                 WHERE e2.offering_id = mo.offering_id) AS grades_entered
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            JOIN Curriculum c ON c.module_id = m.module_id
            JOIN Program p ON c.program_id = p.program_id
            WHERE m.dept_id = ?
              AND mo.approval_status = 'Submitted'
            ORDER BY mo.submitted_at ASC
        `, [deptId]);

        res.json({
            department: hodInfo[0].dept_name,
            offerings: rows
        });
    } catch (err) {
        console.error('HoD pending approvals error:', err);
        res.status(500).json({ error: err.message });
    }
});

// HoD approves an offering
app.post('/api/hod/approve', authenticate, requireHoD, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { offeringId, remarks } = req.body;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });

        const [check] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                m.dept_id,
                l.dept_id AS hod_dept_id
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Lecturer l ON l.user_id = ?
            WHERE mo.offering_id = ?
        `, [userId, offeringId]);

        if (check.length === 0) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (check[0].dept_id !== check[0].hod_dept_id) {
            return res.status(403).json({ message: 'This offering is not in your department' });
        }

        if (check[0].approval_status !== 'Submitted') {
            return res.status(400).json({
                message: `Cannot approve. Status is '${check[0].approval_status}'. Only Submitted offerings can be approved.`
            });
        }

        await db.query(`
            UPDATE ModuleOffering
            SET approval_status = 'HoD_Approved',
                hod_approved_at = NOW()
            WHERE offering_id = ?
        `, [offeringId]);

        const [userInfo] = await db.query(
            'SELECT CONCAT(COALESCE(title,""), " ", first_name, " ", last_name) AS name FROM Lecturer WHERE user_id = ?',
            [userId]
        );
        await db.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, actor_name, previous_status, new_status, remarks)
            VALUES (?, 'HoD_Approved', ?, 'HoD', ?, 'Submitted', 'HoD_Approved', ?)
        `, [offeringId, userId, userInfo[0]?.name || null, remarks || null]);

        // Notify Deans of the school
        try {
            const [schoolInfo] = await db.query(`
                SELECT d.school_id
                FROM ModuleOffering mo
                JOIN Module m ON mo.module_id = m.module_id
                JOIN Department d ON m.dept_id = d.dept_id
                WHERE mo.offering_id = ?
            `, [offeringId]);

            if (schoolInfo.length > 0) {
                const schoolId = schoolInfo[0].school_id;
                const [deans] = await db.query(`
                    SELECT l.user_id
                    FROM Lecturer l
                    JOIN Department d ON l.dept_id = d.dept_id
                    WHERE d.school_id = ? AND l.is_dean = TRUE AND l.user_id IS NOT NULL
                `, [schoolId]);
                for (const dean of deans) {
                    await notifyUser(
                        dean.user_id,
                        'Approval',
                        'Gradebook awaiting Dean approval',
                        'A HoD approved a gradebook. It needs your review.',
                        '/admin-dashboard.html'
                    );
                }
            }
        } catch (e) { console.error('Dean notify error:', e); }

        res.json({
            message: 'Approved successfully',
            offering_id: offeringId,
            new_status: 'HoD_Approved'
        });
    } catch (err) {
        console.error('HoD approve error:', err);
        res.status(500).json({ error: err.message });
    }
});

// HoD rejects an offering
app.post('/api/hod/reject', authenticate, requireHoD, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { offeringId, reason } = req.body;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });
        if (!reason || reason.trim() === '') {
            return res.status(400).json({ message: 'Rejection reason is required' });
        }

        // Verify this HoD manages the offering's department
        const [check] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                m.dept_id,
                l.dept_id AS hod_dept_id
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Lecturer l ON l.user_id = ?
            WHERE mo.offering_id = ?
        `, [userId, offeringId]);

        if (check.length === 0) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (check[0].dept_id !== check[0].hod_dept_id) {
            return res.status(403).json({ message: 'This offering is not in your department' });
        }

        if (check[0].approval_status !== 'Submitted') {
            return res.status(400).json({ 
                message: `Cannot reject. Status is '${check[0].approval_status}'. Only Submitted offerings can be rejected.`
            });
        }

        // Update
        await db.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Rejected',
                rejected_at = NOW(),
                rejection_reason = ?
            WHERE offering_id = ?
        `, [reason.trim(), offeringId]);

        // Log
        const [userInfo] = await db.query(
            'SELECT CONCAT(COALESCE(title,""), " ", first_name, " ", last_name) AS name FROM Lecturer WHERE user_id = ?',
            [userId]
        );
        await db.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, actor_name, previous_status, new_status, remarks)
            VALUES (?, 'Rejected', ?, 'HoD', ?, 'Submitted', 'Rejected', ?)
        `, [offeringId, userId, userInfo[0]?.name || null, reason.trim()]);

        res.json({
            message: 'Rejected successfully',
            offering_id: offeringId,
            new_status: 'Rejected'
        });
    } catch (err) {
        console.error('HoD reject error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Dean: list offerings pending school-wide approval
app.get('/api/dean/pending-approvals', authenticate, requireDean, async (req, res) => {
    try {
        const userId = req.user.userId;
        const role = req.user.role;

        if (role !== 'Dean') {
            return res.status(403).json({ message: 'Only Deans can access this endpoint' });
        }

        // Get Dean's school
        const [deanInfo] = await db.query(`
            SELECT 
                d.school_id,
                sch.name AS school_name
            FROM Lecturer l
            JOIN Department d ON l.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            WHERE l.user_id = ?
            LIMIT 1
        `, [userId]);

        if (deanInfo.length === 0) {
            return res.status(404).json({ message: 'Dean school not found' });
        }

        const schoolId = deanInfo[0].school_id;

        const [rows] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                mo.submitted_at,
                mo.hod_approved_at,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                m.level,
                sem.name AS semester_name,
                ay.year_name,
                p.code AS program_code,
                p.name AS program_name,
                c.year_of_study,
                c.semester AS curriculum_semester,
                d.name AS department_name,
                CONCAT(l.title, ' ', l.first_name, ' ', l.last_name) AS lecturer_name,
                l.email AS lecturer_email,
                (SELECT COUNT(DISTINCT e.enrollment_id) FROM Enrollment e WHERE e.offering_id = mo.offering_id) AS student_count,
                (SELECT COUNT(DISTINCT a.assessment_id) FROM Assessment a WHERE a.offering_id = mo.offering_id) AS assessment_count,
                (SELECT COUNT(*) FROM Grade g
                 JOIN Enrollment e2 ON g.enrollment_id = e2.enrollment_id
                 WHERE e2.offering_id = mo.offering_id) AS grades_entered
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            JOIN Curriculum c ON c.module_id = m.module_id
            JOIN Program p ON c.program_id = p.program_id
            WHERE sch.school_id = ?
              AND mo.approval_status = 'HoD_Approved'
            ORDER BY mo.hod_approved_at ASC
        `, [schoolId]);

        res.json({
            school: deanInfo[0].school_name,
            offerings: rows
        });
    } catch (err) {
        console.error('Dean pending approvals error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Dean approves an offering
app.post('/api/dean/approve', authenticate, requireDean, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { offeringId, remarks } = req.body;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });

        const [check] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                d.school_id AS offering_school_id,
                dept.school_id AS dean_school_id
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN Lecturer l ON l.user_id = ?
            JOIN Department dept ON l.dept_id = dept.dept_id
            WHERE mo.offering_id = ?
        `, [userId, offeringId]);

        if (check.length === 0) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (check[0].offering_school_id !== check[0].dean_school_id) {
            return res.status(403).json({ message: 'This offering is not in your school' });
        }

        if (check[0].approval_status !== 'HoD_Approved') {
            return res.status(400).json({
                message: `Cannot approve. Status is '${check[0].approval_status}'. Only HoD_Approved offerings can be approved by Dean.`
            });
        }

        await db.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Dean_Approved',
                dean_approved_at = NOW()
            WHERE offering_id = ?
        `, [offeringId]);

        const [userInfo] = await db.query(
            'SELECT CONCAT(COALESCE(title,""), " ", first_name, " ", last_name) AS name FROM Lecturer WHERE user_id = ?',
            [userId]
        );
        await db.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, actor_name, previous_status, new_status, remarks)
            VALUES (?, 'Dean_Approved', ?, 'Dean', ?, 'HoD_Approved', 'Dean_Approved', ?)
        `, [offeringId, userId, userInfo[0]?.name || null, remarks || null]);

        // Notify all Senate users
        try {
            const [senators] = await db.query(
                `SELECT user_id FROM User WHERE role = 'Senate' AND is_active = TRUE`
            );
            for (const sen of senators) {
                await notifyUser(
                    sen.user_id,
                    'Approval',
                    'Gradebook awaiting Senate approval',
                    'A Dean approved a gradebook. It needs Senate review.',
                    '/admin-dashboard.html'
                );
            }
        } catch (e) { console.error('Senate notify error:', e); }

        res.json({
            message: 'Approved by Dean successfully',
            offering_id: offeringId,
            new_status: 'Dean_Approved'
        });
    } catch (err) {
        console.error('Dean approve error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Dean rejects an offering
app.post('/api/dean/reject', authenticate, requireDean, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { offeringId, reason } = req.body;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });
        if (!reason || reason.trim() === '') {
            return res.status(400).json({ message: 'Rejection reason is required' });
        }

        const [check] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                d.school_id AS offering_school_id,
                dept.school_id AS dean_school_id
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN Lecturer l ON l.user_id = ?
            JOIN Department dept ON l.dept_id = dept.dept_id
            WHERE mo.offering_id = ?
        `, [userId, offeringId]);

        if (check.length === 0) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (check[0].offering_school_id !== check[0].dean_school_id) {
            return res.status(403).json({ message: 'This offering is not in your school' });
        }

        if (check[0].approval_status !== 'HoD_Approved') {
            return res.status(400).json({ 
                message: `Cannot reject. Status is '${check[0].approval_status}'. Only HoD_Approved offerings can be rejected by Dean.`
            });
        }

        await db.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Rejected',
                rejected_at = NOW(),
                rejection_reason = ?
            WHERE offering_id = ?
        `, [reason.trim(), offeringId]);

        const [userInfo] = await db.query(
            'SELECT CONCAT(COALESCE(title,""), " ", first_name, " ", last_name) AS name FROM Lecturer WHERE user_id = ?',
            [userId]
        );
        await db.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, actor_name, previous_status, new_status, remarks)
            VALUES (?, 'Rejected', ?, 'Dean', ?, 'HoD_Approved', 'Rejected', ?)
        `, [offeringId, userId, userInfo[0]?.name || null, reason.trim()]);

        res.json({
            message: 'Rejected by Dean successfully',
            offering_id: offeringId,
            new_status: 'Rejected'
        });
    } catch (err) {
        console.error('Dean reject error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Senate: list all offerings pending university-wide approval
app.get('/api/senate/pending-approvals', authenticate, requireSenate, async (req, res) => {
    try {
        const role = req.user.role;

        if (role !== 'Senate' && role !== 'Admin' && role !== 'VC') {
            return res.status(403).json({ message: 'Only Senate, Admin, or VC can access this' });
        }

        const [rows] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                mo.submitted_at,
                mo.hod_approved_at,
                mo.dean_approved_at,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                m.level,
                sem.name AS semester_name,
                ay.year_name,
                p.code AS program_code,
                p.name AS program_name,
                c.year_of_study,
                c.semester AS curriculum_semester,
                d.name AS department_name,
                sch.name AS school_name,
                CONCAT(l.title, ' ', l.first_name, ' ', l.last_name) AS lecturer_name,
                (SELECT COUNT(DISTINCT e.enrollment_id) FROM Enrollment e WHERE e.offering_id = mo.offering_id) AS student_count,
                (SELECT COUNT(DISTINCT a.assessment_id) FROM Assessment a WHERE a.offering_id = mo.offering_id) AS assessment_count,
                (SELECT COUNT(*) FROM Grade g
                 JOIN Enrollment e2 ON g.enrollment_id = e2.enrollment_id
                 WHERE e2.offering_id = mo.offering_id) AS grades_entered
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            JOIN Curriculum c ON c.module_id = m.module_id
            JOIN Program p ON c.program_id = p.program_id
            WHERE mo.approval_status = 'Dean_Approved'
            ORDER BY mo.dean_approved_at ASC
        `);

        res.json({ offerings: rows });
    } catch (err) {
        console.error('Senate pending approvals error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Senate approves an offering
app.post('/api/senate/approve', authenticate, requireSenate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const role = req.user.role;
        const { offeringId, remarks } = req.body;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });

        if (role !== 'Senate' && role !== 'Admin' && role !== 'VC') {
            return res.status(403).json({ message: 'Only Senate, Admin, or VC can approve at this stage' });
        }

        const [check] = await db.query(
            `SELECT offering_id, approval_status FROM ModuleOffering WHERE offering_id = ?`,
            [offeringId]
        );

        if (check.length === 0) return res.status(404).json({ message: 'Offering not found' });

        if (check[0].approval_status !== 'Dean_Approved') {
            return res.status(400).json({
                message: `Cannot approve. Status is '${check[0].approval_status}'. Only Dean_Approved offerings can be approved by Senate.`
            });
        }

        await db.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Senate_Approved',
                senate_approved_at = NOW()
            WHERE offering_id = ?
        `, [offeringId]);

        await db.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, previous_status, new_status, remarks)
            VALUES (?, 'Senate_Approved', ?, ?, 'Dean_Approved', 'Senate_Approved', ?)
        `, [offeringId, userId, role, remarks || null]);

        // Notify all VC users
        try {
            const [vcs] = await db.query(
                `SELECT user_id FROM User WHERE role = 'VC' AND is_active = TRUE`
            );
            for (const vc of vcs) {
                await notifyUser(
                    vc.user_id,
                    'Approval',
                    'Gradebook awaiting final release',
                    'Senate approved a gradebook. It is ready for your final release.',
                    '/admin-dashboard.html'
                );
            }
        } catch (e) { console.error('VC notify error:', e); }

        res.json({
            message: 'Approved by Senate successfully',
            offering_id: offeringId,
            new_status: 'Senate_Approved'
        });
    } catch (err) {
        console.error('Senate approve error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Senate rejects an offering
app.post('/api/senate/reject', authenticate, requireSenate, async (req, res) => {
    try {
        const userId = req.user.userId;
        const role = req.user.role;
        const { offeringId, reason } = req.body;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });
        if (!reason || reason.trim() === '') return res.status(400).json({ message: 'Rejection reason required' });

        if (role !== 'Senate' && role !== 'Admin' && role !== 'VC') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const [check] = await db.query(
            'SELECT offering_id, approval_status FROM ModuleOffering WHERE offering_id = ?',
            [offeringId]
        );

        if (check.length === 0) return res.status(404).json({ message: 'Offering not found' });

        if (check[0].approval_status !== 'Dean_Approved') {
            return res.status(400).json({ 
                message: `Cannot reject. Status is '${check[0].approval_status}'. Only Dean_Approved offerings can be rejected by Senate.`
            });
        }

        await db.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Rejected',
                rejected_at = NOW(),
                rejection_reason = ?
            WHERE offering_id = ?
        `, [reason.trim(), offeringId]);

        await db.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, previous_status, new_status, remarks)
            VALUES (?, 'Rejected', ?, ?, 'Dean_Approved', 'Rejected', ?)
        `, [offeringId, userId, role, reason.trim()]);

        res.json({
            message: 'Rejected by Senate',
            offering_id: offeringId,
            new_status: 'Rejected'
        });
    } catch (err) {
        console.error('Senate reject error:', err);
        res.status(500).json({ error: err.message });
    }
});

// VC: list all offerings pending final release
app.get('/api/vc/pending-release', authenticate, requireVC, async (req, res) => {
    try {
        const role = req.user.role;
        if (role !== 'VC' && role !== 'Admin') {
            return res.status(403).json({ message: 'Only VC or Admin can access this' });
        }

        const [rows] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                mo.submitted_at,
                mo.hod_approved_at,
                mo.dean_approved_at,
                mo.senate_approved_at,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                sem.name AS semester_name,
                ay.year_name,
                p.code AS program_code,
                d.name AS department_name,
                sch.name AS school_name,
                CONCAT(l.title, ' ', l.first_name, ' ', l.last_name) AS lecturer_name,
                (SELECT COUNT(DISTINCT e.enrollment_id) FROM Enrollment e WHERE e.offering_id = mo.offering_id) AS student_count,
                (SELECT COUNT(DISTINCT a.assessment_id) FROM Assessment a WHERE a.offering_id = mo.offering_id) AS assessment_count
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            JOIN Curriculum c ON c.module_id = m.module_id
            JOIN Program p ON c.program_id = p.program_id
            WHERE mo.approval_status = 'Senate_Approved'
            ORDER BY mo.senate_approved_at ASC
        `);

        res.json({ offerings: rows });
    } catch (err) {
        console.error('VC pending release error:', err);
        res.status(500).json({ error: err.message });
    }
});

// VC releases an offering (results visible to students)
app.post('/api/vc/release', authenticate, requireVC, async (req, res) => {
    try {
        const userId = req.user.userId;
        const role = req.user.role;
        const { offeringId, remarks } = req.body;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });

        if (role !== 'VC' && role !== 'Admin') {
            return res.status(403).json({ message: 'Only VC or Admin can release results' });
        }

        const [check] = await db.query(
            'SELECT offering_id, approval_status FROM ModuleOffering WHERE offering_id = ?',
            [offeringId]
        );

        if (check.length === 0) return res.status(404).json({ message: 'Offering not found' });

        if (check[0].approval_status !== 'Senate_Approved') {
            return res.status(400).json({
                message: `Cannot release. Status is '${check[0].approval_status}'. Only Senate_Approved offerings can be released.`
            });
        }

        await db.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Released',
                released_at = NOW()
            WHERE offering_id = ?
        `, [offeringId]);

        await db.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, previous_status, new_status, remarks)
            VALUES (?, 'Released', ?, ?, 'Senate_Approved', 'Released', ?)
        `, [offeringId, userId, role, remarks || null]);

        // Notify the lecturer who owns the offering
        try {
            const [lecInfo] = await db.query(`
                SELECT l.user_id
                FROM ModuleOffering mo
                JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
                WHERE mo.offering_id = ?
            `, [offeringId]);

            if (lecInfo.length > 0 && lecInfo[0].user_id) {
                await notifyUser(
                    lecInfo[0].user_id,
                    'Release',
                    'Results released to students',
                    'Your gradebook has been released. Students can now see their grades.',
                    `/lecturer-gradebook.html?offering=${offeringId}`
                );
            }
        } catch (e) { console.error('Lecturer notify error:', e); }

        res.json({
            message: 'Results released to students',
            offering_id: offeringId,
            new_status: 'Released'
        });
    } catch (err) {
        console.error('VC release error:', err);
        res.status(500).json({ error: err.message });
    }
});

// VC: release every Senate-approved offering in one action
app.post('/api/vc/release-all', authenticate, requireVC, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const role = req.user.role;
        const { remarks } = req.body;

        // 1. Find every Senate_Approved offering
        const [approved] = await conn.query(
            `SELECT offering_id, module_id FROM ModuleOffering 
             WHERE approval_status = 'Senate_Approved'`
        );

        if (approved.length === 0) {
            await conn.rollback();
            return res.json({
                message: 'Nothing to release — no Senate-approved offerings are waiting.',
                released: 0
            });
        }

        // 2. Bulk update status
        await conn.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Released',
                released_at = NOW()
            WHERE approval_status = 'Senate_Approved'
        `);

        // 3. Log each release in ApprovalHistory (so the audit trail is complete)
        const note = remarks || 'Bulk release by VC';
        const values = approved.map(o => [
            o.offering_id, 'Released', userId, role, 'Senate_Approved', 'Released', note
        ]);

        if (values.length > 0) {
            await conn.query(`
                INSERT INTO ApprovalHistory
                    (offering_id, action, actor_user_id, actor_role, previous_status, new_status, remarks)
                VALUES ?
            `, [values]);
        }

        await conn.commit();

        res.json({
            message: `Released ${approved.length} offering(s) to students.`,
            released: approved.length
        });

    } catch (err) {
        await conn.rollback();
        console.error('Bulk release error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// VC rejects an offering (sends back to lecturer for correction)
app.post('/api/vc/reject', authenticate, requireVC, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const role = req.user.role;
        const { offeringId, reason } = req.body;

        if (!offeringId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing offeringId' });
        }
        if (!reason || reason.trim() === '') {
            await conn.rollback();
            return res.status(400).json({ message: 'Rejection reason is required' });
        }

        const [check] = await conn.query(
            'SELECT offering_id, approval_status FROM ModuleOffering WHERE offering_id = ?',
            [offeringId]
        );
        if (check.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Offering not found' });
        }

        if (check[0].approval_status !== 'Senate_Approved') {
            await conn.rollback();
            return res.status(400).json({
                message: `Cannot reject. Status is '${check[0].approval_status}'. Only Senate_Approved offerings can be rejected by VC.`
            });
        }

        // Reset to Draft so the lecturer can fix and resubmit
        await conn.query(`
            UPDATE ModuleOffering
            SET approval_status = 'Draft',
                submitted_at = NULL,
                hod_approved_at = NULL,
                dean_approved_at = NULL,
                senate_approved_at = NULL,
                rejected_at = NOW(),
                rejection_reason = ?
            WHERE offering_id = ?
        `, [reason.trim(), offeringId]);

        await conn.query(`
            INSERT INTO ApprovalHistory 
                (offering_id, action, actor_user_id, actor_role, previous_status, new_status, remarks)
            VALUES (?, 'Rejected', ?, ?, 'Senate_Approved', 'Draft', ?)
        `, [offeringId, userId, role, reason.trim()]);

        await conn.commit();

        res.json({
            message: 'Rejected by VC — returned to lecturer as Draft',
            offering_id: offeringId,
            new_status: 'Draft',
            note: 'Lecturer can now correct and resubmit through the approval chain.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('VC reject error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Approver review — full gradebook + history for any approver role
app.get('/api/approval/review', authenticate, requireLeadership, async (req, res) => {
    try {
        const { offeringId } = req.query;
        if (!offeringId) return res.status(400).json({ message: 'Missing offeringId' });

        // 1. Offering info
        const [offering] = await db.query(`
            SELECT 
                mo.offering_id,
                mo.approval_status,
                mo.submitted_at,
                mo.hod_approved_at,
                mo.dean_approved_at,
                mo.senate_approved_at,
                mo.released_at,
                mo.rejection_reason,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                m.level,
                sem.name AS semester_name,
                ay.year_name,
                p.code AS program_code,
                p.name AS program_name,
                d.name AS department_name,
                sch.name AS school_name,
                c.year_of_study,
                c.semester AS curriculum_semester,
                CONCAT(l.title, ' ', l.first_name, ' ', l.last_name) AS lecturer_name,
                l.email AS lecturer_email
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            JOIN Curriculum c ON c.module_id = m.module_id
            JOIN Program p ON c.program_id = p.program_id
            WHERE mo.offering_id = ?
            LIMIT 1
        `, [offeringId]);

        if (offering.length === 0) return res.status(404).json({ message: 'Offering not found' });

        // 2. Students
        const [students] = await db.query(`
            SELECT 
                s.student_id,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS full_name,
                e.enrollment_id
            FROM Enrollment e
            JOIN Student s ON e.student_id = s.student_id
            WHERE e.offering_id = ?
            ORDER BY s.student_number
        `, [offeringId]);

        // 3. Assessments
        const [assessments] = await db.query(`
            SELECT assessment_id, name, type, weight_percentage, max_score
            FROM Assessment
            WHERE offering_id = ?
            ORDER BY due_date
        `, [offeringId]);

        // 4. Grades
        const [grades] = await db.query(`
            SELECT 
                g.enrollment_id,
                g.assessment_id,
                g.score_obtained,
                g.percentage,
                g.grade_letter,
                g.grade_points
            FROM Grade g
            JOIN Enrollment e ON g.enrollment_id = e.enrollment_id
            WHERE e.offering_id = ?
        `, [offeringId]);

        // 5. Approval history
        const [history] = await db.query(`
            SELECT 
                history_id,
                action,
                actor_role,
                actor_name,
                previous_status,
                new_status,
                remarks,
                created_at
            FROM ApprovalHistory
            WHERE offering_id = ?
            ORDER BY created_at DESC
        `, [offeringId]);

        res.json({
            offering: offering[0],
            students,
            assessments,
            grades,
            history
        });
    } catch (err) {
        console.error('Approval review error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// REPORTS ENDPOINTS
// ============================================

// Offering performance — scoped by role
app.get('/api/reports/offering-performance', authenticate, requireLeadership, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;
        const { semesterId, programCode, departmentId, schoolId } = req.query;

        // Base query
        let sql = `
            SELECT 
                vmr.module_id,
                vmr.module_code,
                vmr.module_name,
                vmr.credits,
                vmr.year_name,
                vmr.semester_id,
                vmr.semester_name,
                vmr.curriculum_semester,
                vmr.year_of_study,
                d.dept_id,
                d.name AS department_name,
                sch.school_id,
                sch.name AS school_name,
                COUNT(*) AS total_students,
                ROUND(AVG(vmr.final_percentage), 2) AS avg_score,
                ROUND(MIN(vmr.final_percentage), 2) AS min_score,
                ROUND(MAX(vmr.final_percentage), 2) AS max_score,
                SUM(CASE WHEN vmr.final_grade_points >= 2.0 THEN 1 ELSE 0 END) AS pass_count,
                SUM(CASE WHEN vmr.final_grade_points < 2.0 THEN 1 ELSE 0 END) AS fail_count,
                ROUND(SUM(CASE WHEN vmr.final_grade_points >= 2.0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS pass_rate
            FROM vw_student_module_results vmr
            JOIN Module m ON vmr.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            WHERE vmr.approval_status = 'Released'
              AND vmr.final_percentage IS NOT NULL
        `;

        const params = [];
        const conditions = [];

                // Role-based filtering
        if (role === 'Lecturer') {
            sql += `
                JOIN Enrollment e2 ON e2.enrollment_id = vmr.enrollment_id
                JOIN ModuleOffering mo2 ON mo2.offering_id = e2.offering_id
                JOIN Lecturer lec ON mo2.lecturer_id = lec.lecturer_id
            `;
            conditions.push('lec.user_id = ?');
            params.push(userId);
        } else if (role === 'HoD') {
            conditions.push('d.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)');
            params.push(userId);
        } else if (role === 'Dean') {
            conditions.push(`sch.school_id = (
                SELECT dept.school_id FROM Lecturer l
                JOIN Department dept ON l.dept_id = dept.dept_id
                WHERE l.user_id = ?
            )`);
            params.push(userId);
        }
        // VC, Admin, Senate → see all

        // Optional filters
        if (semesterId) {
            conditions.push('vmr.semester_id = ?');
            params.push(semesterId);
        }
        if (departmentId) {
            conditions.push('d.dept_id = ?');
            params.push(departmentId);
        }
        if (schoolId) {
            conditions.push('sch.school_id = ?');
            params.push(schoolId);
        }

        if (conditions.length > 0) {
            sql += ' AND ' + conditions.join(' AND ');
        }

        sql += `
            GROUP BY vmr.module_id, vmr.semester_id
            ORDER BY vmr.year_name DESC, vmr.semester_name, vmr.module_code
        `;

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('Reports performance error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Reports summary — headline stats scoped by role
app.get('/api/reports/summary', authenticate, requireLeadership, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        let sql = `
            SELECT 
                COUNT(DISTINCT vmr.module_id) AS total_modules,
                COUNT(DISTINCT vmr.student_id) AS total_students,
                COUNT(*) AS total_results,
                ROUND(AVG(vmr.final_percentage), 2) AS overall_avg,
                SUM(CASE WHEN vmr.final_grade_points >= 2.0 THEN 1 ELSE 0 END) AS total_passes,
                SUM(CASE WHEN vmr.final_grade_points < 2.0 THEN 1 ELSE 0 END) AS total_fails,
                ROUND(SUM(CASE WHEN vmr.final_grade_points >= 2.0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS overall_pass_rate
            FROM vw_student_module_results vmr
            JOIN Module m ON vmr.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            WHERE vmr.approval_status = 'Released'
              AND vmr.final_percentage IS NOT NULL
        `;

        const params = [];
        const conditions = [];

        if (role === 'Lecturer') {
            sql += `
                JOIN Enrollment e2 ON e2.enrollment_id = vmr.enrollment_id
                JOIN ModuleOffering mo2 ON mo2.offering_id = e2.offering_id
                JOIN Lecturer lec ON mo2.lecturer_id = lec.lecturer_id
            `;
            conditions.push('lec.user_id = ?');
            params.push(userId);
        } else if (role === 'HoD') {
            conditions.push('d.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)');
            params.push(userId);
        } else if (role === 'Dean') {
            conditions.push(`sch.school_id = (
                SELECT dept.school_id FROM Lecturer l
                JOIN Department dept ON l.dept_id = dept.dept_id
                WHERE l.user_id = ?
            )`);
            params.push(userId);
        }

        if (conditions.length > 0) {
            sql += ' AND ' + conditions.join(' AND ');
        }

        const [rows] = await db.query(sql, params);
        res.json(rows[0]);
    } catch (err) {
        console.error('Reports summary error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// CRUD: REGISTER NEW STUDENT
// ============================================
app.post('/api/admin/register-student', authenticate, requireAdmin, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const {
            studentNumber, firstName, lastName, email, phone,
            gender, dateOfBirth, programId,
            enrollmentDate, currentYearOfStudy, currentSemester
        } = req.body;

        // Validate
        if (!studentNumber || !firstName || !lastName || !email || !programId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing required fields: studentNumber, firstName, lastName, email, programId' });
        }

        // Duplicate check
        const [dup] = await conn.query(
            'SELECT student_id FROM Student WHERE student_number = ? OR email = ?',
            [studentNumber, email]
        );
        if (dup.length > 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Student number or email already exists' });
        }

        // Auto-generate username: BIT/25/SS/010 → student.bit25.010
        const parts = studentNumber.split('/');
        let username = 'student.' + parts[0].toLowerCase() + (parts[1] || '') + '.' + (parts[parts.length - 1] || '');
        const [uDup] = await conn.query('SELECT user_id FROM User WHERE username = ?', [username]);
        if (uDup.length > 0) username = username + '.' + Date.now();

        // Get program's department + duration
        const [prog] = await conn.query(
            'SELECT dept_id, duration_years FROM Program WHERE program_id = ?',
            [programId]
        );
        if (prog.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Program not found' });
        }
        const deptId = prog[0].dept_id;

                // Hash the default password
        const defaultHash = await bcrypt.hash('password', 10);

        // Create user
        const [userRes] = await conn.query(
            'INSERT INTO User (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
            [username, email, defaultHash, 'Student', true]
        );

        const userId = userRes.insertId;

        // Create student
        const [stuRes] = await conn.query(
            `INSERT INTO Student 
             (user_id, student_number, first_name, last_name, email, phone, gender, date_of_birth, 
              program_id, dept_id, enrollment_date, current_year_of_study, current_semester, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
            [userId, studentNumber, firstName, lastName, email,
             phone || null, gender || null, dateOfBirth || null,
             programId, deptId,
             enrollmentDate || new Date().toISOString().slice(0,10),
             currentYearOfStudy || 1, currentSemester || 1]
        );
        const studentId = stuRes.insertId;

        // Auto-enroll in current active semester's modules
        const [activeSem] = await conn.query(
            'SELECT semester_id FROM Semester WHERE is_active = TRUE LIMIT 1'
        );
        let enrolledCount = 0;
        if (activeSem.length > 0) {
            const activeSemId = activeSem[0].semester_id;
            const [currMods] = await conn.query(
                `SELECT mo.offering_id
                 FROM Curriculum c
                 JOIN ModuleOffering mo ON mo.module_id = c.module_id
                 WHERE c.program_id = ? 
                   AND c.year_of_study = ? 
                   AND c.semester = ?
                   AND mo.semester_id = ?`,
                [programId, currentYearOfStudy || 1, currentSemester || 1, activeSemId]
            );
            for (const m of currMods) {
                await conn.query(
                    'INSERT INTO Enrollment (student_id, offering_id, enrollment_date, status) VALUES (?, ?, NOW(), ?)',
                    [studentId, m.offering_id, 'Enrolled']
                );
                // Keep the offering's enrollment counter in sync
                await conn.query(
                    'UPDATE ModuleOffering SET current_enrollment = current_enrollment + 1 WHERE offering_id = ?',
                    [m.offering_id]
                );
                enrolledCount++;
            }
        }

        await conn.commit();

        res.json({
            message: 'Student registered successfully',
            studentId,
            userId,
            username,
            password: 'password',
            studentNumber,
            enrolledModules: enrolledCount
        });
    } catch (err) {
        await conn.rollback();
        console.error('Register student error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: REGISTER NEW LECTURER
// ============================================
app.post('/api/admin/register-lecturer', authenticate, requireAdmin, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const {
            staffNumber, title, firstName, lastName, email, phone,
            departmentId, position, highestQualification,
            dateJoined, isHod, isDean
        } = req.body;

        // Validate
        if (!staffNumber || !firstName || !lastName || !email || !departmentId || !position) {
            await conn.rollback();
            return res.status(400).json({ 
                message: 'Missing required fields: staffNumber, firstName, lastName, email, departmentId, position' 
            });
        }

        // Duplicate check
        const [dup] = await conn.query(
            'SELECT lecturer_id FROM Lecturer WHERE staff_number = ? OR email = ?',
            [staffNumber, email]
        );
        if (dup.length > 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Staff number or email already exists' });
        }

        // Auto-generate username
        let username = 'lecturer.' + firstName.toLowerCase() + '.' + lastName.toLowerCase();
        const [uDup] = await conn.query('SELECT user_id FROM User WHERE username = ?', [username]);
        if (uDup.length > 0) username = username + '.' + Date.now();

                // Hash the default password
        const defaultHash = await bcrypt.hash('password', 10);

        // Create User
        const [userRes] = await conn.query(
            'INSERT INTO User (username, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
            [username, email, defaultHash, 'Lecturer', true]
        );

        const userId = userRes.insertId;

        // Create Lecturer
        const [lecRes] = await conn.query(
            `INSERT INTO Lecturer 
             (user_id, staff_number, title, first_name, last_name, email, phone, dept_id, 
              position, highest_qualification, date_joined, is_hod, is_dean, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
            [userId, staffNumber, title || null, firstName, lastName, email,
             phone || null, departmentId, position,
             highestQualification || null,
             dateJoined || new Date().toISOString().slice(0, 10),
             isHod ? 1 : 0, isDean ? 1 : 0]
        );
        const lecturerId = lecRes.insertId;

        await conn.commit();

        res.json({
            message: 'Lecturer registered successfully',
            lecturerId,
            userId,
            username,
            password: 'password',
            staffNumber
        });
    } catch (err) {
        await conn.rollback();
        console.error('Register lecturer error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: CREATE MODULE + OFFERING + CURRICULUM
// ============================================
app.post('/api/admin/create-module', authenticate, requireAdmin, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const {
            moduleCode, moduleName, credits, level, description,
            departmentId,
            programIds,          // array of program_ids
            yearOfStudy,         // which year this module belongs to
            curriculumSemester,  // 1 or 2 (within the year)
            // offering details (scheduled in current active semester)
            lecturerId,
            room, schedule, capacity,
            createOffering      // boolean
        } = req.body;

        // Validate
        if (!moduleCode || !moduleName || !credits || !departmentId) {
            await conn.rollback();
            return res.status(400).json({ 
                message: 'Missing required: moduleCode, moduleName, credits, departmentId' 
            });
        }

        // Duplicate check
        const [dup] = await conn.query(
            'SELECT module_id FROM Module WHERE code = ?', [moduleCode]
        );
        if (dup.length > 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Module code already exists' });
        }

        // Create Module
        const [modRes] = await conn.query(
            `INSERT INTO Module (dept_id, code, name, credits, level, description)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [departmentId, moduleCode, moduleName, credits, level || null, description || null]
        );
        const moduleId = modRes.insertId;

        // Create Curriculum entries for each program
        let curriculumCount = 0;
        if (Array.isArray(programIds) && programIds.length > 0 && yearOfStudy && curriculumSemester) {
            for (const pid of programIds) {
                try {
                    await conn.query(
                        `INSERT INTO Curriculum 
                         (program_id, module_id, academic_year, semester, year_of_study, is_core)
                         VALUES (?, ?, 1, ?, ?, TRUE)`,
                        [pid, moduleId, curriculumSemester, yearOfStudy]
                    );
                    curriculumCount++;
                } catch (e) {
                    // Skip duplicate (unique key)
                    if (e.code !== 'ER_DUP_ENTRY') throw e;
                }
            }
        }

        // Create ModuleOffering (if requested)
        let offeringId = null;
        if (createOffering && lecturerId) {
            const [activeSem] = await conn.query(
                'SELECT semester_id FROM Semester WHERE is_active = TRUE LIMIT 1'
            );
            if (activeSem.length > 0) {
                const [offRes] = await conn.query(
                    `INSERT INTO ModuleOffering 
                     (module_id, semester_id, lecturer_id, room, schedule, capacity, status)
                     VALUES (?, ?, ?, ?, ?, ?, 'Scheduled')`,
                    [moduleId, activeSem[0].semester_id, lecturerId,
                     room || null, schedule || null, capacity || 60]
                );
                offeringId = offRes.insertId;
            }
        }

        await conn.commit();

        res.json({
            message: 'Module created successfully',
            moduleId,
            moduleCode,
            moduleName,
            curriculumEntries: curriculumCount,
            offeringId
        });
    } catch (err) {
        await conn.rollback();
        console.error('Create module error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: MANUAL STUDENT ENROLLMENT
// ============================================

// List all offerings for the current active semester
app.get('/api/admin/active-offerings', authenticate, requireStaff, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                mo.offering_id,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                p.code AS program_code,
                p.name AS program_name,
                c.year_of_study,
                c.semester AS curriculum_semester,
                sem.name AS semester_name,
                ay.year_name,
                mo.room,
                mo.schedule,
                mo.capacity,
                mo.current_enrollment,
                mo.approval_status,
                CONCAT(l.title, ' ', l.first_name, ' ', l.last_name) AS lecturer_name
            FROM ModuleOffering mo
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            JOIN Curriculum c ON c.module_id = m.module_id
            JOIN Program p ON c.program_id = p.program_id
            JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
            WHERE sem.is_active = TRUE
            ORDER BY p.code, c.year_of_study, m.code
        `);
        res.json(rows);
    } catch (err) {
        console.error('Active offerings error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Manually enroll a student in an offering
app.post('/api/admin/enroll-student', authenticate, requireAdmin, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { studentNumber, offeringId } = req.body;

        if (!studentNumber || !offeringId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing studentNumber or offeringId' });
        }

        // Find student
        const [stu] = await conn.query(
            'SELECT student_id, first_name, last_name FROM Student WHERE student_number = ?',
            [studentNumber]
        );
        if (stu.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Student not found' });
        }
        const studentId = stu[0].student_id;

        // Find offering + capacity
        const [off] = await conn.query(
            `SELECT mo.offering_id, mo.capacity, mo.current_enrollment, 
                    mo.approval_status, m.code AS module_code
             FROM ModuleOffering mo
             JOIN Module m ON mo.module_id = m.module_id
             WHERE mo.offering_id = ?`,
            [offeringId]
        );
        if (off.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Offering not found' });
        }

        // Check capacity
        if (off[0].current_enrollment >= off[0].capacity) {
            await conn.rollback();
            return res.status(400).json({ message: 'Offering is at full capacity' });
        }

        // Check if already enrolled
        const [existing] = await conn.query(
            'SELECT enrollment_id FROM Enrollment WHERE student_id = ? AND offering_id = ?',
            [studentId, offeringId]
        );
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'Student is already enrolled in this offering' });
        }

        // Create enrollment
        const [enrollRes] = await conn.query(
            `INSERT INTO Enrollment (student_id, offering_id, enrollment_date, status)
             VALUES (?, ?, CURDATE(), 'Enrolled')`,
            [studentId, offeringId]
        );

        // Increment current_enrollment
        await conn.query(
            'UPDATE ModuleOffering SET current_enrollment = current_enrollment + 1 WHERE offering_id = ?',
            [offeringId]
        );

        await conn.commit();

        res.json({
            message: 'Student enrolled successfully',
            enrollmentId: enrollRes.insertId,
            studentName: `${stu[0].first_name} ${stu[0].last_name}`,
            moduleCode: off[0].module_code
        });
    } catch (err) {
        await conn.rollback();
        console.error('Enroll student error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: ACADEMIC YEAR + SEMESTER ROLLOVER
// ============================================

// Preview: what would be created
app.get('/api/admin/rollover-preview', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    try {
        const [current] = await db.query(`
            SELECT 
                ay.academic_year_id,
                ay.year_name,
                ay.start_date,
                ay.end_date,
                sem.semester_id,
                sem.name AS semester_name,
                sem.is_active
            FROM AcademicYear ay
            LEFT JOIN Semester sem ON sem.academic_year_id = ay.academic_year_id AND sem.is_active = TRUE
            WHERE ay.is_current = TRUE
            LIMIT 1
        `);

        if (current.length === 0) {
            return res.status(404).json({ message: 'No current academic year set' });
        }

        const cur = current[0];
        const startYear = parseInt(cur.year_name.split('/')[0]);
        const nextYearName = `${startYear + 1}/${startYear + 2}`;
        const nextStart = new Date(cur.start_date);
        nextStart.setFullYear(nextStart.getFullYear() + 1);
        const nextEnd = new Date(cur.end_date);
        nextEnd.setFullYear(nextEnd.getFullYear() + 1);

        // Count existing enrollments in current active semester
        const [enrollCount] = await db.query(
            'SELECT COUNT(*) AS total FROM Enrollment WHERE offering_id IN (SELECT offering_id FROM ModuleOffering WHERE semester_id = ?)',
            [cur.semester_id]
        );

        res.json({
            current: {
                year_name: cur.year_name,
                semester_name: cur.semester_name,
                start_date: cur.start_date,
                end_date: cur.end_date
            },
            proposed: {
                year_name: nextYearName,
                start_date: nextStart.toISOString().slice(0, 10),
                end_date: nextEnd.toISOString().slice(0, 10),
                semester_1: {
                    start: new Date(nextStart.getTime() + 15 * 86400000).toISOString().slice(0, 10),
                    end: new Date(nextStart.getTime() + 135 * 86400000).toISOString().slice(0, 10)
                },
                semester_2: {
                    start: new Date(nextStart.getTime() + 165 * 86400000).toISOString().slice(0, 10),
                    end: new Date(nextStart.getTime() + 300 * 86400000).toISOString().slice(0, 10)
                }
            },
            currentEnrollments: enrollCount[0].total
        });
    } catch (err) {
        console.error('Rollover preview error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Execute rollover
app.post('/api/admin/rollover-year', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { yearName, startDate, endDate } = req.body;

        if (!yearName || !startDate || !endDate) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing yearName, startDate, or endDate' });
        }

        // Check no duplicate
        const [dup] = await conn.query(
            'SELECT academic_year_id FROM AcademicYear WHERE year_name = ?',
            [yearName]
        );
        if (dup.length > 0) {
            await conn.rollback();
            return res.status(400).json({ message: `Academic year ${yearName} already exists` });
        }

                // Create new AcademicYear — INACTIVE (do NOT disturb current year yet)
        const [ayRes] = await conn.query(
            `INSERT INTO AcademicYear (year_name, start_date, end_date, is_current)
             VALUES (?, ?, ?, FALSE)`,
            [yearName, startDate, endDate]
        );
        const newYearId = ayRes.insertId;

        // Helper to add days to a date
        const addDays = (d, n) => {
            const dt = new Date(d);
            dt.setDate(dt.getDate() + n);
            return dt.toISOString().slice(0, 10);
        };

                // Create Semester 1 (INACTIVE)
        const [sem1Res] = await conn.query(
            `INSERT INTO Semester 
             (academic_year_id, name, type, start_date, end_date, is_active)
             VALUES (?, 'Semester 1', 'First', ?, ?, FALSE)`,
            [newYearId, addDays(startDate, 15), addDays(startDate, 135)]
        );
        const sem1Id = sem1Res.insertId;
        
        // Create Semester 2 (inactive)
        const [sem2Res] = await conn.query(
            `INSERT INTO Semester 
             (academic_year_id, name, type, start_date, end_date, is_active)
             VALUES (?, 'Semester 2', 'Second', ?, ?, FALSE)`,
            [newYearId, addDays(startDate, 165), addDays(startDate, 300)]
        );
        const sem2Id = sem2Res.insertId;

        await conn.commit();

                res.json({
            message: `Academic year ${yearName} created (INACTIVE). Current year unchanged.`,
            academicYearId: newYearId,
            yearName,
            semester1Id: sem1Id,
            semester2Id: sem2Id,
            status: 'INACTIVE — run these steps before activating:',
            nextSteps: [
                '1. POST /api/admin/create-offerings-for-year with { academicYearId }',
                '2. POST /api/admin/promote-students with { academicYearId }',
                '3. POST /api/admin/graduate-final-year with { academicYearId }',
                '4. POST /api/admin/activate-year with { academicYearId }'
            ]
        });
        
    } catch (err) {
        await conn.rollback();
        console.error('Rollover error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: ROLLBACK ROLLOVER
// ============================================
app.post('/api/admin/rollback-rollover', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { yearToDelete } = req.body;
        if (!yearToDelete) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing yearToDelete' });
        }

        // Find the year
        const [year] = await conn.query(
            'SELECT academic_year_id FROM AcademicYear WHERE year_name = ?',
            [yearToDelete]
        );
        if (year.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: `Year ${yearToDelete} not found` });
        }
        const yearId = year[0].academic_year_id;

        // Get semesters of that year
        const [sems] = await conn.query(
            'SELECT semester_id FROM Semester WHERE academic_year_id = ?',
            [yearId]
        );

        let deletedOfferings = 0;
        let deletedEnrollments = 0;

        for (const sem of sems) {
            const [delEnr] = await conn.query(`
                DELETE FROM Enrollment 
                WHERE offering_id IN (
                    SELECT offering_id FROM ModuleOffering WHERE semester_id = ?
                )
            `, [sem.semester_id]);
            deletedEnrollments += delEnr.affectedRows;

            const [delOff] = await conn.query(
                'DELETE FROM ModuleOffering WHERE semester_id = ?',
                [sem.semester_id]
            );
            deletedOfferings += delOff.affectedRows;
        }

        // Delete semesters
        await conn.query('DELETE FROM Semester WHERE academic_year_id = ?', [yearId]);

        // Delete the year
        await conn.query('DELETE FROM AcademicYear WHERE academic_year_id = ?', [yearId]);

        // Reactivate the newest remaining year
        const [prevYear] = await conn.query(
            'SELECT academic_year_id, year_name FROM AcademicYear ORDER BY start_date DESC LIMIT 1'
        );

        let reactivated = null;
        if (prevYear.length > 0) {
            reactivated = prevYear[0].year_name;
            await conn.query(
                'UPDATE AcademicYear SET is_current = TRUE WHERE academic_year_id = ?',
                [prevYear[0].academic_year_id]
            );
            await conn.query(`
                UPDATE Semester SET is_active = TRUE 
                WHERE academic_year_id = ? AND name = 'Semester 1'
            `, [prevYear[0].academic_year_id]);
        }

        await conn.commit();

        res.json({
            message: `Rollback complete. Deleted year ${yearToDelete}.`,
            reactivatedYear: reactivated,
            deletedOfferings,
            deletedEnrollments
        });
    } catch (err) {
        await conn.rollback();
        console.error('Rollback error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: AUTO-CREATE OFFERINGS FOR A YEAR
// ============================================
app.post('/api/admin/create-offerings-for-year', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { academicYearId } = req.body;
        if (!academicYearId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing academicYearId' });
        }

        // Verify the year exists
        const [yearCheck] = await conn.query(
            'SELECT year_name FROM AcademicYear WHERE academic_year_id = ?',
            [academicYearId]
        );
        if (yearCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Academic year not found' });
        }
        const yearName = yearCheck[0].year_name;

        // Get semesters of that year
        const [sems] = await conn.query(
            'SELECT semester_id, name FROM Semester WHERE academic_year_id = ? ORDER BY start_date',
            [academicYearId]
        );

        if (sems.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'No semesters found for this year' });
        }

        let totalCreated = 0;
        const perSemester = {};

        // For each semester, create offerings based on curriculum
        for (const sem of sems) {
            const semNum = sem.name === 'Semester 1' ? 1 : 2;

            const [result] = await conn.query(`
                INSERT IGNORE INTO ModuleOffering
                    (module_id, semester_id, lecturer_id, room, schedule, capacity, status, approval_status)
                SELECT DISTINCT
                    c.module_id,
                    ?,
                    COALESCE(
                        (SELECT lecturer_id FROM Lecturer WHERE dept_id = m.dept_id LIMIT 1),
                        (SELECT lecturer_id FROM Lecturer LIMIT 1)
                    ),
                    CONCAT('Room-', LPAD(c.year_of_study, 2, '0'), '-', LPAD(c.semester, 1, '0')),
                    'TBA',
                    60,
                    'Scheduled',
                    'Draft'
                FROM Curriculum c
                JOIN Module m ON c.module_id = m.module_id
                WHERE c.semester = ?
                  AND NOT EXISTS (
                      SELECT 1 FROM ModuleOffering mo
                      WHERE mo.module_id = c.module_id AND mo.semester_id = ?
                  )
            `, [sem.semester_id, semNum, sem.semester_id]);

            perSemester[sem.name] = result.affectedRows;
            totalCreated += result.affectedRows;
        }

        await conn.commit();

        res.json({
            message: `Offerings auto-created for ${yearName}`,
            yearName,
            semester1Offerings: perSemester['Semester 1'] || 0,
            semester2Offerings: perSemester['Semester 2'] || 0,
            totalCreated
        });
    } catch (err) {
        await conn.rollback();
        console.error('Create offerings error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: PROMOTE STUDENTS TO NEXT YEAR
// ============================================
app.post('/api/admin/promote-students', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { academicYearId } = req.body;
        if (!academicYearId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing academicYearId' });
        }

        const [yearCheck] = await conn.query(
            'SELECT year_name, is_current FROM AcademicYear WHERE academic_year_id = ?',
            [academicYearId]
        );
        if (yearCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Academic year not found' });
        }
        if (yearCheck[0].is_current) {
            await conn.rollback();
            return res.status(400).json({
                message: 'Cannot promote into an ACTIVE year. Activate only after promotion.'
            });
        }
        const yearName = yearCheck[0].year_name;

        const [sem1] = await conn.query(
            `SELECT semester_id FROM Semester 
             WHERE academic_year_id = ? AND name = 'Semester 1'`,
            [academicYearId]
        );
        if (sem1.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'New year Semester 1 not found' });
        }
        const newSem1Id = sem1[0].semester_id;

        // Get every active student
        const [students] = await conn.query(`
            SELECT 
                s.student_id,
                s.student_number,
                s.first_name,
                s.last_name,
                s.current_year_of_study,
                s.program_id,
                p.duration_years,
                p.code AS program_code
            FROM Student s
            JOIN Program p ON s.program_id = p.program_id
            WHERE s.status = 'Active'
        `);

        if (students.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'No active students to promote' });
        }

        let promotedCount = 0;
        let enrolledCount = 0;
        const skippedFinalYear = [];
        const skippedWithObligations = [];

        for (const stu of students) {
            const currentYear = stu.current_year_of_study;
            const duration = stu.duration_years;

            // (a) Final year → skip (graduation handles them)
            if (currentYear >= duration) {
                skippedFinalYear.push({
                    student_number: stu.student_number,
                    name: `${stu.first_name} ${stu.last_name}`,
                    year: currentYear,
                    program: stu.program_code
                });
                continue;
            }

            // (b) Unresolved obligations check
            const [pendingReferrals] = await conn.query(
                `SELECT referral_id FROM Referral WHERE student_id = ? AND status = 'Pending' LIMIT 1`,
                [stu.student_id]
            );
            const [pendingCarryovers] = await conn.query(
                `SELECT carryover_id FROM Carryover WHERE student_id = ? AND status = 'Pending' LIMIT 1`,
                [stu.student_id]
            );
            const [enrolledRepeats] = await conn.query(
                `SELECT repeat_id FROM RepeatModule WHERE student_id = ? AND status = 'Enrolled' LIMIT 1`,
                [stu.student_id]
            );
            const [activeIncs] = await conn.query(
                `SELECT incomplete_id FROM IncompleteGrade WHERE student_id = ? AND status = 'Active' LIMIT 1`,
                [stu.student_id]
            );

            const obligations = [];
            if (pendingReferrals.length > 0)   obligations.push('pending Referral');
            if (pendingCarryovers.length > 0)  obligations.push('pending Carryover');
            if (enrolledRepeats.length > 0)    obligations.push('active Repeat');
            if (activeIncs.length > 0)         obligations.push('active INC');

            if (obligations.length > 0) {
                skippedWithObligations.push({
                    student_number: stu.student_number,
                    name: `${stu.first_name} ${stu.last_name}`,
                    year: currentYear,
                    program: stu.program_code,
                    reason: obligations.join(', ')
                });
                continue;
            }

            // (c) Student is eligible → promote
            const newYear = currentYear + 1;

            await conn.query(
                `UPDATE Student 
                 SET current_year_of_study = ?, current_semester = 1
                 WHERE student_id = ?`,
                [newYear, stu.student_id]
            );
            promotedCount++;

            // Enroll in Semester 1 offerings of the new year
            const [currOfferings] = await conn.query(`
                SELECT mo.offering_id
                FROM Curriculum c
                JOIN ModuleOffering mo ON mo.module_id = c.module_id
                WHERE c.program_id = ?
                  AND c.year_of_study = ?
                  AND c.semester = 1
                  AND mo.semester_id = ?
            `, [stu.program_id, newYear, newSem1Id]);

            for (const off of currOfferings) {
                try {
                    const [r] = await conn.query(
                        `INSERT IGNORE INTO Enrollment 
                         (student_id, offering_id, enrollment_date, status)
                         VALUES (?, ?, CURDATE(), 'Enrolled')`,
                        [stu.student_id, off.offering_id]
                    );
                    if (r.affectedRows > 0) {
                        await conn.query(
                            'UPDATE ModuleOffering SET current_enrollment = current_enrollment + 1 WHERE offering_id = ?',
                            [off.offering_id]
                        );
                        enrolledCount++;
                    }
                } catch (e) { /* ignore dup */ }
            }
        }

        await conn.commit();

        res.json({
            message: `Promotion completed for ${yearName}`,
            yearName,
            totalStudents: students.length,
            promoted: promotedCount,
            enrollmentsCreated: enrolledCount,
            skippedFinalYear: skippedFinalYear.length,
            skippedWithObligations: skippedWithObligations.length,
            finalYearStudents: skippedFinalYear,
            blockedStudents: skippedWithObligations,
            note: 'Students with pending referrals, carryovers, repeats, or active INCs were NOT promoted.'
        });

    } catch (err) {
        await conn.rollback();
        console.error('Promote students error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: GRADUATE FINAL-YEAR STUDENTS
// §12.5 — Student with a repeat or withdrawal is NOT eligible for Distinction
// ============================================
app.post('/api/admin/graduate-final-year', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { academicYearId } = req.body;
        if (!academicYearId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing academicYearId' });
        }

        const [yearCheck] = await conn.query(
            'SELECT year_name, is_current FROM AcademicYear WHERE academic_year_id = ?',
            [academicYearId]
        );
        if (yearCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Academic year not found' });
        }
        if (yearCheck[0].is_current) {
            await conn.rollback();
            return res.status(400).json({
                message: 'Cannot graduate into an ACTIVE year. Activate only after graduation.'
            });
        }
        const yearName = yearCheck[0].year_name;

        const [finalYearStudents] = await conn.query(`
            SELECT 
                s.student_id,
                s.student_number,
                s.first_name,
                s.last_name,
                s.current_year_of_study,
                p.duration_years,
                p.is_honours,
                p.code AS program_code,
                p.type AS program_type,
                p.level AS program_level
            FROM Student s
            JOIN Program p ON s.program_id = p.program_id
            WHERE s.status = 'Active'
              AND s.current_year_of_study >= p.duration_years
        `);

        if (finalYearStudents.length === 0) {
            await conn.commit();
            return res.json({
                message: 'No final-year students to graduate',
                graduated: 0
            });
        }

        const graduated = [];
        const notEligible = [];

        for (const stu of finalYearStudents) {
            const [cgpaResult] = await conn.query(
                'SELECT cgpa FROM vw_student_cumulative WHERE student_number = ?',
                [stu.student_number]
            );

            const cgpa = cgpaResult.length > 0 && cgpaResult[0].cgpa !== null
                ? parseFloat(cgpaResult[0].cgpa)
                : 0;

            if (cgpa < 2.00) {
                notEligible.push({
                    student_number: stu.student_number,
                    name: `${stu.first_name} ${stu.last_name}`,
                    cgpa: cgpa,
                    reason: 'cGPA below 2.00'
                });
                continue;
            }

            // §12.5 — check disqualifiers for Distinction / First Class
            const [repeatCount] = await conn.query(
                `SELECT COUNT(*) AS cnt FROM RepeatModule 
                 WHERE student_id = ? AND status IN ('Passed','Failed','Enrolled','Withdrawn')`,
                [stu.student_id]
            );
            const [aegrotatNoCredit] = await conn.query(
                `SELECT COUNT(*) AS cnt FROM Aegrotat 
                 WHERE student_id = ? AND status = 'Approved' AND eligible_for_credit = FALSE`,
                [stu.student_id]
            );
            const [academicWithdrawal] = await conn.query(
                `SELECT COUNT(*) AS cnt FROM AcademicStanding 
                 WHERE student_id = ? AND standing_type = 'Dismissed'`,
                [stu.student_id]
            );

            const hasRepeated = repeatCount[0].cnt > 0;
            const hasNonCreditAegrotat = aegrotatNoCredit[0].cnt > 0;
            const wasDismissed = academicWithdrawal[0].cnt > 0;

            const disqualifiedFromTopAward = hasRepeated || hasNonCreditAegrotat || wasDismissed;

            let classification;
            const isHonours = stu.is_honours === 1;
            let downgradedFrom = null;

            if (isHonours) {
                if (cgpa >= 3.70) {
                    if (disqualifiedFromTopAward) {
                        classification = 'Upper Second Class';
                        downgradedFrom = 'First Class';
                    } else {
                        classification = 'First Class';
                    }
                }
                else if (cgpa >= 3.00) classification = 'Upper Second Class';
                else if (cgpa >= 2.50) classification = 'Lower Second Class';
                else classification = 'Third Class';
            } else {
                if (cgpa >= 3.70) {
                    if (disqualifiedFromTopAward) {
                        classification = 'Credit';
                        downgradedFrom = 'Distinction';
                    } else {
                        classification = 'Distinction';
                    }
                }
                else if (cgpa >= 2.50) classification = 'Credit';
                else classification = 'Pass';
            }

            await conn.query(
                `UPDATE Student 
                 SET status = 'Graduated', 
                     academic_standing = 'Good Standing',
                     current_cgpa = ?
                 WHERE student_id = ?`,
                [cgpa, stu.student_id]
            );

            const graduatedEntry = {
                student_number: stu.student_number,
                name: `${stu.first_name} ${stu.last_name}`,
                program: stu.program_code,
                duration: stu.duration_years,
                cgpa: cgpa.toFixed(2),
                classification
            };
            if (downgradedFrom) {
                graduatedEntry.downgraded_from = downgradedFrom;
                graduatedEntry.downgrade_reason = hasRepeated ? 'Repeated a module (§12.5)'
                    : hasNonCreditAegrotat ? 'Aegrotat without credit (§7.2)'
                    : 'Previously withdrawn on academic grounds (§12.5)';
            }
            graduated.push(graduatedEntry);
        }

        await conn.commit();

        res.json({
            message: `Graduation processed for ${yearName}`,
            yearName,
            totalFinalYearStudents: finalYearStudents.length,
            graduated: graduated.length,
            notEligible: notEligible.length,
            graduates: graduated,
            skipped: notEligible,
            note: '§12.5 — Students who repeated a module or were withdrawn on academic grounds cannot receive Distinction / First Class.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Graduate students error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: ACTIVATE NEW ACADEMIC YEAR
// ============================================
app.post('/api/admin/activate-year', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { academicYearId } = req.body;
        if (!academicYearId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing academicYearId' });
        }

        // Verify year exists and is INACTIVE
        const [yearCheck] = await conn.query(
            'SELECT year_name, is_current FROM AcademicYear WHERE academic_year_id = ?',
            [academicYearId]
        );
        if (yearCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Academic year not found' });
        }
        if (yearCheck[0].is_current) {
            await conn.rollback();
            return res.status(400).json({ message: 'This year is already current' });
        }
        const newYearName = yearCheck[0].year_name;

        // Verify the new year has offerings
        const [offeringCheck] = await conn.query(`
            SELECT COUNT(*) AS total
            FROM ModuleOffering mo
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            WHERE sem.academic_year_id = ?
        `, [academicYearId]);
        if (offeringCheck[0].total === 0) {
            await conn.rollback();
            return res.status(400).json({ 
                message: 'Cannot activate: this year has no offerings. Run create-offerings-for-year first.' 
            });
        }

        // Get Semester 1 of the new year
        const [newSem1] = await conn.query(
            `SELECT semester_id FROM Semester 
             WHERE academic_year_id = ? AND name = 'Semester 1'`,
            [academicYearId]
        );
        if (newSem1.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'New year Semester 1 not found' });
        }
        const newSem1Id = newSem1[0].semester_id;

        // Find the current year and its active semester (to deactivate)
        const [currentYear] = await conn.query(
            'SELECT academic_year_id, year_name FROM AcademicYear WHERE is_current = TRUE LIMIT 1'
        );
        const oldYearName = currentYear.length > 0 ? currentYear[0].year_name : null;

        // Deactivate current year + all active semesters
        await conn.query('UPDATE AcademicYear SET is_current = FALSE WHERE is_current = TRUE');
        await conn.query('UPDATE Semester SET is_active = FALSE WHERE is_active = TRUE');

        // Mark old active enrollments as Completed
        let enrollmentsCompleted = 0;
        if (currentYear.length > 0) {
            const [oldSem] = await conn.query(`
                SELECT semester_id FROM Semester 
                WHERE academic_year_id = ? AND name = 'Semester 1'
            `, [currentYear[0].academic_year_id]);

            if (oldSem.length > 0) {
                const [result] = await conn.query(`
                    UPDATE Enrollment 
                    SET status = 'Completed'
                    WHERE status = 'Enrolled'
                      AND offering_id IN (
                          SELECT offering_id FROM ModuleOffering WHERE semester_id = ?
                      )
                `, [oldSem[0].semester_id]);
                enrollmentsCompleted = result.affectedRows;
            }
        }

        // Activate the new year
        await conn.query(
            'UPDATE AcademicYear SET is_current = TRUE WHERE academic_year_id = ?',
            [academicYearId]
        );

        // Activate the new Semester 1
        await conn.query(
            'UPDATE Semester SET is_active = TRUE WHERE semester_id = ?',
            [newSem1Id]
        );

        await conn.commit();

        res.json({
            message: `Academic year activated: ${newYearName}`,
            newYear: newYearName,
            oldYear: oldYearName,
            activeSemester: 'Semester 1',
            enrollmentsCompleted,
            note: 'Students now see their new year modules.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Activate year error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: SEED ASSESSMENTS FOR A YEAR
// ============================================
app.post('/api/admin/seed-assessments-for-year', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { academicYearId } = req.body;
        if (!academicYearId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing academicYearId' });
        }

        // Verify year exists
        const [yearCheck] = await conn.query(
            'SELECT year_name FROM AcademicYear WHERE academic_year_id = ?',
            [academicYearId]
        );
        if (yearCheck.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Academic year not found' });
        }
        const yearName = yearCheck[0].year_name;

        // Get all offerings in that year that have NO assessments yet
        const [offerings] = await conn.query(`
            SELECT mo.offering_id
            FROM ModuleOffering mo
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            WHERE sem.academic_year_id = ?
              AND NOT EXISTS (
                  SELECT 1 FROM Assessment a WHERE a.offering_id = mo.offering_id
              )
        `, [academicYearId]);

        if (offerings.length === 0) {
            await conn.commit();
            return res.json({
                message: `All offerings for ${yearName} already have assessments`,
                offeringsProcessed: 0,
                assessmentsCreated: 0
            });
        }

        // Create 3 assessments per offering
        // Quiz 20% (max 20), Assignment 30% (max 100), Final Exam 50% (max 100)
        let assessmentsCreated = 0;

        for (const off of offerings) {
            // Quiz 1
            await conn.query(`
                INSERT INTO Assessment 
                    (offering_id, name, type, weight_percentage, max_score, due_date)
                VALUES (?, 'Quiz 1', 'Quiz', 20, 20, DATE_ADD(NOW(), INTERVAL 30 DAY))
            `, [off.offering_id]);
            assessmentsCreated++;

            // Assignment 1
            await conn.query(`
                INSERT INTO Assessment 
                    (offering_id, name, type, weight_percentage, max_score, due_date)
                VALUES (?, 'Assignment 1', 'Assignment', 30, 100, DATE_ADD(NOW(), INTERVAL 60 DAY))
            `, [off.offering_id]);
            assessmentsCreated++;

            // Final Exam
            await conn.query(`
                INSERT INTO Assessment 
                    (offering_id, name, type, weight_percentage, max_score, due_date)
                VALUES (?, 'Final Exam', 'Final Exam', 50, 100, DATE_ADD(NOW(), INTERVAL 90 DAY))
            `, [off.offering_id]);
            assessmentsCreated++;
        }

        await conn.commit();

        res.json({
            message: `Assessments seeded for ${yearName}`,
            yearName,
            offeringsProcessed: offerings.length,
            assessmentsCreated,
            note: 'Each offering now has Quiz 1 (20%), Assignment 1 (30%), Final Exam (50%)'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Seed assessments error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// ACADEMIC STANDING — COMPUTE + STORE
// ============================================
app.post('/api/admin/compute-standing', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { studentNumber } = req.body;
        // If studentNumber provided → compute for one student
        // Otherwise → compute for ALL students

        let students;
        if (studentNumber) {
            const [rows] = await conn.query(
                'SELECT student_id, student_number FROM Student WHERE student_number = ?',
                [studentNumber]
            );
            students = rows;
        } else {
            const [rows] = await conn.query(
                'SELECT student_id, student_number FROM Student'
            );
            students = rows;
        }

        if (students.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'No students found' });
        }

        const results = [];

        for (const stu of students) {
            // Get all completed semesters ordered
            const [semesters] = await conn.query(`
                SELECT 
                    semester_id,
                    semester_name,
                    semester_number,
                    year_name,
                    semester_gpa
                FROM vw_student_semester_history
                WHERE student_number = ?
                  AND semester_gpa IS NOT NULL
                ORDER BY semester_number ASC
            `, [stu.student_number]);

            if (semesters.length === 0) {
                // No completed semesters → set Good Standing
                await conn.query(
                    `UPDATE Student SET academic_standing = 'Good Standing' WHERE student_id = ?`,
                    [stu.student_id]
                );
                results.push({
                    student_number: stu.student_number,
                    standing: 'Good Standing',
                    reason: 'No completed semesters yet'
                });
                continue;
            }

            // Analyze the last 3 semesters' sGPA
            const recent = semesters.slice(-3).map(s => ({
                semester_id: s.semester_id,
                name: s.semester_name + ' ' + s.year_name,
                sgpa: parseFloat(s.semester_gpa)
            }));

            let standing = 'Good Standing';
            let reason = 'All recent sGPAs ≥ 2.00';

            // Check the MOST RECENT semester for immediate conditions
            const mostRecent = recent[recent.length - 1];

            if (mostRecent.sgpa < 1.00) {
                // Immediate withdrawal — sGPA < 1.00
                standing = 'Dismissed';
                reason = `Most recent sGPA (${mostRecent.sgpa}) < 1.00 — Academic Withdrawal`;
            } else {
                // Count consecutive semesters with sGPA < 2.00 (from most recent backwards)
                let consecutiveBelow2 = 0;
                for (let i = recent.length - 1; i >= 0; i--) {
                    if (recent[i].sgpa < 2.00) {
                        consecutiveBelow2++;
                    } else {
                        break;
                    }
                }

                if (consecutiveBelow2 >= 3) {
                    standing = 'Dismissed';
                    reason = `3+ consecutive semesters with sGPA < 2.00`;
                } else if (consecutiveBelow2 === 2) {
                    standing = 'Suspended';
                    reason = `2 consecutive semesters with sGPA < 2.00`;
                } else if (consecutiveBelow2 === 1) {
                    standing = 'Academic Probation';
                    reason = `1 semester with sGPA < 2.00`;
                } else {
                    standing = 'Good Standing';
                    reason = `Most recent sGPA (${mostRecent.sgpa}) ≥ 2.00`;
                }
            }

            // Update student's academic_standing
            await conn.query(
                `UPDATE Student SET academic_standing = ? WHERE student_id = ?`,
                [standing, stu.student_id]
            );

            // Log to AcademicStanding history if the standing changed
            const [currentRec] = await conn.query(
                `SELECT standing_type FROM AcademicStanding 
                 WHERE student_id = ? ORDER BY created_at DESC LIMIT 1`,
                [stu.student_id]
            );

            const prevStanding = currentRec.length > 0 ? currentRec[0].standing_type : null;

            if (prevStanding !== standing) {
                await conn.query(
                    `INSERT INTO AcademicStanding 
                     (student_id, semester_id, standing_type, effective_date, remarks)
                     VALUES (?, ?, ?, CURDATE(), ?)`,
                    [stu.student_id, mostRecent.semester_id, standing, reason]
                );
            }

            results.push({
                student_number: stu.student_number,
                standing,
                reason,
                recentSemesters: recent.map(r => ({ name: r.name, sgpa: r.sgpa }))
            });
        }

        await conn.commit();

        res.json({
            message: 'Academic standing computed',
            studentsProcessed: students.length,
            results
        });
    } catch (err) {
        await conn.rollback();
        console.error('Compute standing error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// STUDENT SELF-SERVICE — PROFILE
// ============================================
app.get('/api/students/my-profile', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'Student') {
            return res.status(403).json({ message: 'Only students can access this' });
        }

        const [rows] = await db.query(`
            SELECT 
                s.student_id,
                s.student_number,
                s.first_name,
                s.last_name,
                s.email,
                s.phone,
                s.gender,
                s.date_of_birth,
                s.status,
                s.academic_standing,
                s.current_cgpa,
                s.current_year_of_study,
                s.current_semester,
                s.enrollment_date,
                p.code AS program_code,
                p.name AS program_name,
                p.duration_years,
                d.name AS department_name,
                sch.name AS school_name,
                u.username,
                u.email AS login_email
            FROM Student s
            LEFT JOIN Program p ON s.program_id = p.program_id
            LEFT JOIN Department d ON s.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            LEFT JOIN User u ON s.user_id = u.user_id
            WHERE s.user_id = ?
        `, [req.user.userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Student profile not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('My profile error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// STUDENT SELF-SERVICE — UPDATE PROFILE
// ============================================
app.put('/api/students/update-profile', authenticate, async (req, res) => {
    try {
        if (req.user.role !== 'Student') {
            return res.status(403).json({ message: 'Only students can access this' });
        }

        const { phone, email } = req.body;

        // Validation
        if (email && !email.includes('@')) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // Check if email already exists on another user
        if (email) {
            const [dup] = await db.query(
                'SELECT user_id FROM User WHERE email = ? AND user_id != ?',
                [email, req.user.userId]
            );
            if (dup.length > 0) {
                return res.status(400).json({ message: 'Email already in use by another account' });
            }
        }

        // Update User table (email)
        if (email) {
            await db.query(
                'UPDATE User SET email = ? WHERE user_id = ?',
                [email, req.user.userId]
            );
        }

        // Update Student table (email + phone)
        await db.query(`
            UPDATE Student s
            JOIN User u ON s.user_id = u.user_id
            SET 
                s.phone = COALESCE(?, s.phone),
                s.email = COALESCE(?, s.email)
            WHERE u.user_id = ?
        `, [phone || null, email || null, req.user.userId]);

        res.json({
            message: 'Profile updated successfully',
            updated: { phone, email }
        });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// AUTH — CHANGE PASSWORD (self)
// ============================================
app.put('/api/auth/change-password', authenticate, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: 'All password fields are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({ message: 'New password must be different from current' });
        }

        // Get current user
        const [users] = await db.query(
            'SELECT user_id, username, password_hash FROM User WHERE user_id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = users[0];

        // Verify current password
        let currentMatches = false;
        if (user.password_hash && user.password_hash.startsWith('$2')) {
            currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
        } else {
            currentMatches = (currentPassword === user.password_hash);
        }

        if (!currentMatches) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const newHash = await bcrypt.hash(newPassword, 10);

        // Update
        await db.query(
            'UPDATE User SET password_hash = ? WHERE user_id = ?',
            [newHash, req.user.userId]
        );

        console.log(`🔐 Password changed for ${user.username}`);

        res.json({
            message: 'Password changed successfully',
            note: 'Use your new password next time you log in.'
        });
    } catch (err) {
        console.error('Change password error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ACADEMIC POLICY: EVALUATE END-OF-SEMESTER
// Determines: Referred / Carryover / Repeat / Withdrawn
// ============================================
app.post('/api/admin/evaluate-semester', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { studentNumber, semesterId } = req.body;

        if (!studentNumber || !semesterId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing studentNumber or semesterId' });
        }

        // 1. Get student
        const [stu] = await conn.query(
            `SELECT student_id, student_number, first_name, last_name, program_id, status, academic_standing
             FROM Student WHERE student_number = ?`,
            [studentNumber]
        );
        if (stu.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Student not found' });
        }
        const student = stu[0];

        // 2. Compute sGPA for the semester
        const [semGPA] = await conn.query(`
            SELECT semester_gpa, semester_classification
            FROM vw_student_semester_history
            WHERE student_number = ? AND semester_id = ?
        `, [studentNumber, semesterId]);

        if (semGPA.length === 0 || semGPA[0].semester_gpa === null) {
            await conn.rollback();
            return res.status(400).json({ message: 'No graded results for that semester' });
        }
        const sGPA = parseFloat(semGPA[0].semester_gpa);

        // 3. Compute new cGPA
        const [cumGPA] = await conn.query(
            'SELECT cgpa FROM vw_student_cumulative WHERE student_number = ?',
            [studentNumber]
        );
        const newCGPA = cumGPA.length > 0 && cumGPA[0].cgpa !== null ? parseFloat(cumGPA[0].cgpa) : sGPA;

        // 4. Get all modules for that semester
        const [modules] = await conn.query(`
            SELECT 
                vmr.module_id,
                vmr.module_code,
                vmr.module_name,
                vmr.credits,
                vmr.final_grade_points,
                vmr.final_percentage,
                c.is_core
            FROM vw_student_module_results vmr
            JOIN Curriculum c ON c.module_id = vmr.module_id AND c.program_id = ?
            WHERE vmr.student_number = ?
              AND vmr.semester_id = ?
              AND vmr.final_grade_points IS NOT NULL
        `, [student.program_id, studentNumber, semesterId]);

        if (modules.length === 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'No graded modules found' });
        }

        // 5. Identify failed modules (grade point < 2.00)
        const failedModules = modules.filter(m => parseFloat(m.final_grade_points) < 2.00);

        // 6. Determine outcome
        let outcome = 'Passed';
        let message = 'All modules passed';
        const actions = [];

        if (failedModules.length > 0) {
            // Rule 9.1: sGPA < 1.00 → Withdrawn
            if (sGPA < 1.00) {
                outcome = 'Withdrawn';
                message = `sGPA = ${sGPA.toFixed(2)} < 1.00 → Academic Withdrawal`;

                await conn.query(
                    `UPDATE Student SET status = 'Withdrawn', academic_standing = 'Dismissed' WHERE student_id = ?`,
                    [student.student_id]
                );
                await conn.query(
                    `INSERT INTO AcademicStanding (student_id, semester_id, standing_type, effective_date, remarks)
                     VALUES (?, ?, 'Dismissed', CURDATE(), ?)`,
                    [student.student_id, semesterId, message]
                );

                actions.push({
                    type: 'Withdrawn',
                    reason: message,
                    modules: failedModules.map(m => m.module_code)
                });
            }
            // Rule 4.8 & 4.9: sGPA >= 1.50 → Referral or Carryover (per module)
            else if (sGPA >= 1.50) {
                outcome = 'Referred/Carryover';
                message = `sGPA = ${sGPA.toFixed(2)} ≥ 1.50 with failed module(s)`;

                // §4.9.1 — Calculate existing active semester load for the 70-credit cap
                const [loadInfo] = await conn.query(`
                    SELECT COALESCE(SUM(m.credits), 0) AS current_load
                    FROM Enrollment e
                    JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
                    JOIN Module m ON mo.module_id = m.module_id
                    JOIN Semester sem ON mo.semester_id = sem.semester_id
                    WHERE e.student_id = ?
                      AND sem.is_active = TRUE
                      AND e.status = 'Enrolled'
                `, [student.student_id]);
                let currentLoad = parseInt(loadInfo[0].current_load) || 0;

                for (const m of failedModules) {
                    // §4.9.3 — Check if already carrying this module
                    const [existingCO] = await conn.query(
                        `SELECT carryover_id FROM Carryover 
                         WHERE student_id = ? AND module_id = ?
                         LIMIT 1`,
                        [student.student_id, m.module_id]
                    );

                    if (!m.is_core && newCGPA >= 2.00) {
                        // §4.9.1 — Load cap check
                        if (currentLoad + m.credits > 70) {
                            // Fall through to referral instead of carryover
                            await conn.query(
                                `INSERT INTO Referral 
                                 (student_id, module_id, semester_id, referral_date, original_grade_points, status)
                                 VALUES (?, ?, ?, CURDATE(), ?, 'Pending')`,
                                [student.student_id, m.module_id, semesterId, m.final_grade_points]
                            );
                            actions.push({
                                type: 'Referral',
                                module: m.module_code,
                                credits: m.credits,
                                reason: `§4.9.1 — Carryover would exceed 70-credit limit (${currentLoad + m.credits})`,
                                max_pass_grade: 'D (2.00)'
                            });
                            continue;
                        }

                        // §4.9.3 — Block duplicate carryover
                        if (existingCO.length > 0) {
                            actions.push({
                                type: 'Skipped',
                                module: m.module_code,
                                credits: m.credits,
                                reason: '§4.9.3 — Already carried once; escalated to Referral'
                            });
                            await conn.query(
                                `INSERT INTO Referral 
                                 (student_id, module_id, semester_id, referral_date, original_grade_points, status)
                                 VALUES (?, ?, ?, CURDATE(), ?, 'Pending')`,
                                [student.student_id, m.module_id, semesterId, m.final_grade_points]
                            );
                            continue;
                        }

                        // Create the carryover
                        await conn.query(
                            `INSERT INTO Carryover 
                             (student_id, module_id, from_semester_id, carryover_date, original_grade_points, status)
                             VALUES (?, ?, ?, CURDATE(), ?, 'Pending')`,
                            [student.student_id, m.module_id, semesterId, m.final_grade_points]
                        );
                        currentLoad += m.credits;
                        actions.push({
                            type: 'Carryover',
                            module: m.module_code,
                            credits: m.credits,
                            reason: `Non-core + cGPA ${newCGPA.toFixed(2)} >= 2.00 (load now ${currentLoad})`,
                            max_pass_grade: 'D (2.00)'
                        });
                    } else {
                        await conn.query(
                            `INSERT INTO Referral 
                             (student_id, module_id, semester_id, referral_date, original_grade_points, status)
                             VALUES (?, ?, ?, CURDATE(), ?, 'Pending')`,
                            [student.student_id, m.module_id, semesterId, m.final_grade_points]
                        );
                        actions.push({
                            type: 'Referral',
                            module: m.module_code,
                            credits: m.credits,
                            reason: m.is_core ? 'Core module' : 'cGPA < 2.00',
                            max_pass_grade: 'D (2.00)'
                        });
                    }
                }
            }
            // Rule 4.10: sGPA 1.00–1.50 → Repeat
            else {
                const alreadyRepeated = [];
                for (const m of failedModules) {
                    const [rep] = await conn.query(
                        'SELECT repeat_id FROM RepeatModule WHERE student_id = ? AND module_id = ?',
                        [student.student_id, m.module_id]
                    );
                    if (rep.length > 0) alreadyRepeated.push(m.module_code);
                }

                if (alreadyRepeated.length > 0) {
                    outcome = 'Withdrawn';
                    message = `sGPA = ${sGPA.toFixed(2)} + already repeated → Withdrawn`;

                    await conn.query(
                        `UPDATE Student SET status = 'Withdrawn', academic_standing = 'Dismissed' WHERE student_id = ?`,
                        [student.student_id]
                    );
                    await conn.query(
                        `INSERT INTO AcademicStanding (student_id, semester_id, standing_type, effective_date, remarks)
                         VALUES (?, ?, 'Dismissed', CURDATE(), ?)`,
                        [student.student_id, semesterId, message]
                    );

                    actions.push({
                        type: 'Withdrawn',
                        reason: 'Failed repeat module',
                        modules: alreadyRepeated
                    });
                } else {
                    outcome = 'Repeat';
                    message = `sGPA = ${sGPA.toFixed(2)} (1.00 – 1.49) → Repeat failed modules`;

                    // Find the current active semester once for all repeats
                    const [activeSem] = await conn.query(
                        'SELECT semester_id FROM Semester WHERE is_active = TRUE LIMIT 1'
                    );
                    const activeSemId = activeSem.length > 0 ? activeSem[0].semester_id : null;

                    for (const m of failedModules) {
                        let newEnrollmentId = null;
                        let newSemesterId = activeSemId;

                        if (activeSemId) {
                            const [offering] = await conn.query(
                                'SELECT offering_id FROM ModuleOffering WHERE module_id = ? AND semester_id = ? LIMIT 1',
                                [m.module_id, activeSemId]
                            );

                            if (offering.length > 0) {
                                const newOfferingId = offering[0].offering_id;

                                const [existingEnroll] = await conn.query(
                                    'SELECT enrollment_id FROM Enrollment WHERE student_id = ? AND offering_id = ?',
                                    [student.student_id, newOfferingId]
                                );

                                if (existingEnroll.length > 0) {
                                    newEnrollmentId = existingEnroll[0].enrollment_id;
                                } else {
                                    const [enrollRes] = await conn.query(
                                        `INSERT INTO Enrollment 
                                         (student_id, offering_id, enrollment_date, status)
                                         VALUES (?, ?, CURDATE(), 'Enrolled')`,
                                        [student.student_id, newOfferingId]
                                    );
                                    newEnrollmentId = enrollRes.insertId;

                                    await conn.query(
                                        'UPDATE ModuleOffering SET current_enrollment = current_enrollment + 1 WHERE offering_id = ?',
                                        [newOfferingId]
                                    );
                                }
                            }
                        }

                        await conn.query(
                            `INSERT INTO RepeatModule 
                             (student_id, module_id, semester_id, new_enrollment_id, new_semester_id,
                              repeat_attempt, repeat_date, original_grade_points, status)
                             VALUES (?, ?, ?, ?, ?, 1, CURDATE(), ?, 'Enrolled')`,
                            [student.student_id, m.module_id, semesterId, newEnrollmentId, newSemesterId,
                             m.final_grade_points]
                        );

                        // §4.10.5 — Set one-year extension on the student
                        await conn.query(
                            `UPDATE Student
                             SET extension_until = DATE_ADD(CURDATE(), INTERVAL 1 YEAR)
                             WHERE student_id = ?`,
                            [student.student_id]
                        );

                        actions.push({
                            type: 'Repeat',
                            module: m.module_code,
                            credits: m.credits,
                            reason: 'sGPA between 1.00 and 1.50',
                            actual_grade_will_be_awarded: true,
                            enrolled_in_active_semester: newEnrollmentId !== null
                        });
                    }

                    await conn.query(
                        `UPDATE Student SET academic_standing = 'Academic Probation' WHERE student_id = ?`,
                        [student.student_id]
                    );
                    await conn.query(
                        `INSERT INTO AcademicStanding (student_id, semester_id, standing_type, effective_date, remarks)
                         VALUES (?, ?, 'Academic Probation', CURDATE(), ?)`,
                        [student.student_id, semesterId, message]
                    );
                }
            }
        }

        await conn.commit();

        res.json({
            message: 'Evaluation complete',
            student: {
                student_number: student.student_number,
                name: `${student.first_name} ${student.last_name}`
            },
            semesterId,
            sGPA: sGPA.toFixed(2),
            newCGPA: newCGPA.toFixed(2),
            totalModules: modules.length,
            failedModules: failedModules.map(m => ({
                code: m.module_code,
                name: m.module_name,
                credits: m.credits,
                grade_points: m.final_grade_points,
                is_core: m.is_core
            })),
            outcome,
            message,
            actions
        });

    } catch (err) {
        await conn.rollback();
        console.error('Evaluate semester error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// ACADEMIC POLICY: LIST ACTIVE CASES
// ============================================
app.get('/api/admin/policy-cases', authenticate, requireLeadership, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        // Build scope filter
        let scopeCondition = '';
        const params = [];

        if (role === 'HoD') {
            scopeCondition = `AND d.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)`;
            params.push(userId);
        } else if (role === 'Dean') {
            scopeCondition = `AND sch.school_id = (
                SELECT dept.school_id FROM Lecturer l
                JOIN Department dept ON l.dept_id = dept.dept_id
                WHERE l.user_id = ?
            )`;
            params.push(userId);
        } else if (role === 'Lecturer') {
            scopeCondition = `AND m.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)`;
            params.push(userId);
        }
        // Admin/VC/Senate → no filter

        // 1. Referrals
        const [referrals] = await db.query(`
            SELECT 
                r.referral_id,
                r.referral_date,
                r.original_grade_points,
                r.status,
                r.result_grade_points,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                c.is_core,
                d.name AS department_name,
                sch.name AS school_name,
                sem.name AS semester_name,
                ay.year_name,
                p.code AS program_code
            FROM Referral r
            JOIN Student s ON r.student_id = s.student_id
            JOIN Module m ON r.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Semester sem ON r.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            LEFT JOIN Program p ON s.program_id = p.program_id
            LEFT JOIN Curriculum c ON c.module_id = m.module_id AND c.program_id = s.program_id
            WHERE 1=1 ${scopeCondition}
            ORDER BY r.status = 'Pending' DESC, r.referral_date DESC
            LIMIT 200
        `, params);

        // 2. Carryovers
        const [carryovers] = await db.query(`
            SELECT 
                c.carryover_id,
                c.carryover_date,
                c.original_grade_points,
                c.status,
                c.result_grade_points,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                d.name AS department_name,
                sch.name AS school_name,
                sem.name AS semester_name,
                ay.year_name,
                p.code AS program_code
            FROM Carryover c
            JOIN Student s ON c.student_id = s.student_id
            JOIN Module m ON c.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Semester sem ON c.from_semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            LEFT JOIN Program p ON s.program_id = p.program_id
            WHERE 1=1 ${scopeCondition}
            ORDER BY c.status = 'Pending' DESC, c.carryover_date DESC
            LIMIT 200
        `, params);

        // 3. Repeats
        const [repeats] = await db.query(`
            SELECT 
                rm.repeat_id,
                rm.repeat_date,
                rm.repeat_attempt,
                rm.original_grade_points,
                rm.status,
                rm.result_grade_points,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                d.name AS department_name,
                sch.name AS school_name,
                sem.name AS semester_name,
                ay.year_name,
                p.code AS program_code
            FROM RepeatModule rm
            JOIN Student s ON rm.student_id = s.student_id
            JOIN Module m ON rm.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Semester sem ON rm.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            LEFT JOIN Program p ON s.program_id = p.program_id
            WHERE 1=1 ${scopeCondition}
            ORDER BY rm.status = 'Enrolled' DESC, rm.repeat_date DESC
            LIMIT 200
        `, params);

        res.json({
            referrals,
            carryovers,
            repeats,
            counts: {
                referrals: referrals.length,
                carryovers: carryovers.length,
                repeats: repeats.length,
                total: referrals.length + carryovers.length + repeats.length
            }
        });
    } catch (err) {
        console.error('Policy cases error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ACADEMIC POLICY: PROCESS REFERRAL
// Rule 4.8.2: Pass in a referral caps at grade point 2.00
// ============================================
app.post('/api/admin/process-referral', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { referralId, passed, remarks } = req.body;

        if (!referralId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing referralId' });
        }
        if (typeof passed !== 'boolean') {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing "passed" (true or false)' });
        }

        // 1. Look up the referral (now with semester_id + program_id for override)
        const [refs] = await conn.query(
            `SELECT r.referral_id, r.student_id, r.module_id, r.semester_id, r.status, r.original_grade_points,
                    s.student_number, s.program_id, CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                    m.code AS module_code, m.name AS module_name, m.credits
             FROM Referral r
             JOIN Student s ON r.student_id = s.student_id
             JOIN Module m ON r.module_id = m.module_id
             WHERE r.referral_id = ?`,
            [referralId]
        );

        if (refs.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Referral not found' });
        }

        const ref = refs[0];

        if (ref.status !== 'Pending') {
            await conn.rollback();
            return res.status(400).json({
                message: `This referral has already been processed (current status: ${ref.status})`
            });
        }

        // 2. Apply rule 4.8.2
        let newStatus, resultGradePoints, note;
        if (passed) {
            newStatus = 'Passed';
            resultGradePoints = 2.00;
            note = 'Referral passed — grade point capped at 2.00 (rule 4.8.2).';
        } else {
            newStatus = 'Failed';
            resultGradePoints = ref.original_grade_points;
            note = 'Referral failed — student must repeat the module (rule 4.10).';
        }

        // 3. Update the referral record
        await conn.query(
            `UPDATE Referral
             SET status = ?, result_grade_points = ?
             WHERE referral_id = ?`,
            [newStatus, resultGradePoints, referralId]
        );

        // 4. If PASSED → upsert an override so GPA recalculates correctly
        let overrideApplied = false;
        if (passed) {
            await conn.query(`
                INSERT INTO ModuleGradeOverride
                    (student_id, module_id, semester_id, override_grade_points,
                     override_percentage, override_type, source_id, created_by_user_id)
                VALUES (?, ?, ?, 2.00, 50.00, 'Referral Pass', ?, ?)
                ON DUPLICATE KEY UPDATE
                    override_grade_points = VALUES(override_grade_points),
                    override_percentage = VALUES(override_percentage),
                    override_type = VALUES(override_type),
                    source_id = VALUES(source_id),
                    created_by_user_id = VALUES(created_by_user_id),
                    created_at = NOW()
            `, [ref.student_id, ref.module_id, ref.semester_id, referralId, userId]);
            overrideApplied = true;
        }

        await conn.commit();

        res.json({
            message: 'Referral processed',
            referral_id: referralId,
            student: {
                student_number: ref.student_number,
                name: ref.student_name
            },
            module: {
                code: ref.module_code,
                name: ref.module_name
            },
            new_status: newStatus,
            result_grade_points: resultGradePoints,
            gpa_override_applied: overrideApplied,
            note
        });

    } catch (err) {
        await conn.rollback();
        console.error('Process referral error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// ACADEMIC POLICY: PROCESS CARRYOVER
// Rule 4.9.5: Pass in CO caps at grade point 2.00
// Rule 4.9.10/4.9.11: Fail in CO → repeat (never referred)
// ============================================
app.post('/api/admin/process-carryover', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { carryoverId, passed, remarks } = req.body;

        if (!carryoverId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing carryoverId' });
        }
        if (typeof passed !== 'boolean') {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing "passed" (true or false)' });
        }

        const [cos] = await conn.query(
            `SELECT c.carryover_id, c.student_id, c.module_id, c.from_semester_id AS semester_id,
                    c.status, c.original_grade_points,
                    s.student_number, s.program_id,
                    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                    m.code AS module_code, m.name AS module_name
             FROM Carryover c
             JOIN Student s ON c.student_id = s.student_id
             JOIN Module m ON c.module_id = m.module_id
             WHERE c.carryover_id = ?`,
            [carryoverId]
        );

        if (cos.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Carryover not found' });
        }
        const co = cos[0];

        if (co.status !== 'Pending') {
            await conn.rollback();
            return res.status(400).json({
                message: `This carryover has already been processed (current status: ${co.status})`
            });
        }

        let newStatus, resultGradePoints, note, repeatId = null;
        let overrideApplied = false;

        if (passed) {
            newStatus = 'Passed';
            resultGradePoints = 2.00;
            note = 'Carryover passed — grade point capped at D (2.00) per rule 4.9.5.';

            await conn.query(
                `UPDATE Carryover
                 SET status = ?, result_grade_points = ?
                 WHERE carryover_id = ?`,
                [newStatus, resultGradePoints, carryoverId]
            );

            // GPA override
            await conn.query(`
                INSERT INTO ModuleGradeOverride
                    (student_id, module_id, semester_id, override_grade_points,
                     override_percentage, override_type, source_id, created_by_user_id)
                VALUES (?, ?, ?, 2.00, 50.00, 'Carryover Pass', ?, ?)
                ON DUPLICATE KEY UPDATE
                    override_grade_points = VALUES(override_grade_points),
                    override_percentage = VALUES(override_percentage),
                    override_type = VALUES(override_type),
                    source_id = VALUES(source_id),
                    created_by_user_id = VALUES(created_by_user_id),
                    created_at = NOW()
            `, [co.student_id, co.module_id, co.semester_id, carryoverId, userId]);
            overrideApplied = true;
        } else {
            newStatus = 'Failed';
            resultGradePoints = co.original_grade_points;
            note = 'Carryover failed — student must repeat the module (rules 4.9.10/4.9.11).';

            await conn.query(
                `UPDATE Carryover
                 SET status = ?, result_grade_points = ?
                 WHERE carryover_id = ?`,
                [newStatus, resultGradePoints, carryoverId]
            );

            const [existingRepeat] = await conn.query(
                'SELECT repeat_id FROM RepeatModule WHERE student_id = ? AND module_id = ?',
                [co.student_id, co.module_id]
            );

            if (existingRepeat.length > 0) {
                repeatId = existingRepeat[0].repeat_id;
            } else {
                // Find the current active semester so we can create a fresh enrollment
                const [activeSem] = await conn.query(
                    'SELECT semester_id FROM Semester WHERE is_active = TRUE LIMIT 1'
                );

                let newEnrollmentId = null;
                let newSemesterId = null;

                if (activeSem.length > 0) {
                    newSemesterId = activeSem[0].semester_id;

                    const [offering] = await conn.query(`
                        SELECT offering_id FROM ModuleOffering 
                        WHERE module_id = ? AND semester_id = ?
                        LIMIT 1
                    `, [co.module_id, newSemesterId]);

                    if (offering.length > 0) {
                        const newOfferingId = offering[0].offering_id;

                        const [existingEnroll] = await conn.query(
                            'SELECT enrollment_id FROM Enrollment WHERE student_id = ? AND offering_id = ?',
                            [co.student_id, newOfferingId]
                        );

                        if (existingEnroll.length > 0) {
                            newEnrollmentId = existingEnroll[0].enrollment_id;
                        } else {
                            const [enrollRes] = await conn.query(
                                `INSERT INTO Enrollment 
                                 (student_id, offering_id, enrollment_date, status)
                                 VALUES (?, ?, CURDATE(), 'Enrolled')`,
                                [co.student_id, newOfferingId]
                            );
                            newEnrollmentId = enrollRes.insertId;

                            await conn.query(
                                'UPDATE ModuleOffering SET current_enrollment = current_enrollment + 1 WHERE offering_id = ?',
                                [newOfferingId]
                            );
                        }
                    }
                }

                const [repRes] = await conn.query(
                    `INSERT INTO RepeatModule
                        (student_id, module_id, semester_id, new_enrollment_id, new_semester_id,
                         repeat_attempt, repeat_date, original_grade_points, status)
                     VALUES (?, ?, ?, ?, ?, 1, CURDATE(), ?, 'Enrolled')`,
                    [co.student_id, co.module_id, co.semester_id, newEnrollmentId, newSemesterId,
                     co.original_grade_points]
                );
                repeatId = repRes.insertId;
            }
        }

        await conn.commit();

        res.json({
            message: 'Carryover processed',
            carryover_id: carryoverId,
            student: { student_number: co.student_number, name: co.student_name },
            module: { code: co.module_code, name: co.module_name },
            new_status: newStatus,
            result_grade_points: resultGradePoints,
            repeat_id: repeatId,
            gpa_override_applied: overrideApplied,
            note
        });

    } catch (err) {
        await conn.rollback();
        console.error('Process carryover error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});
// ============================================
// ACADEMIC POLICY: PROCESS REPEAT
// Rule 4.10.3: Actual grade awarded (no cap)
// Rule 4.10.4: Repeat only once
// Rule 4.10.6: Fail → academic withdrawal
// ============================================
app.post('/api/admin/process-repeat', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { repeatId, passed, actualGradePoints, remarks } = req.body;

        if (!repeatId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing repeatId' });
        }
        if (typeof passed !== 'boolean') {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing "passed" (true or false)' });
        }

        const [reps] = await conn.query(
            `SELECT rm.repeat_id, rm.student_id, rm.module_id, rm.semester_id,
                    rm.repeat_attempt, rm.status, rm.original_grade_points,
                    s.student_number, s.current_year_of_study,
                    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                    m.code AS module_code, m.name AS module_name
             FROM RepeatModule rm
             JOIN Student s ON rm.student_id = s.student_id
             JOIN Module m ON rm.module_id = m.module_id
             WHERE rm.repeat_id = ?`,
            [repeatId]
        );

        if (reps.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Repeat record not found' });
        }
        const rep = reps[0];

        if (rep.status !== 'Enrolled') {
            await conn.rollback();
            return res.status(400).json({
                message: `This repeat has already been processed (current status: ${rep.status})`
            });
        }

        if (rep.repeat_attempt >= 2) {
            await conn.rollback();
            return res.status(400).json({
                message: 'Rule 4.10.4: A student may only repeat a module once. This is attempt ' + rep.repeat_attempt
            });
        }

        let newStatus, resultGradePoints, note;
        let studentWithdrawn = false;
        let overrideApplied = false;

        if (passed) {
            if (typeof actualGradePoints !== 'number' || actualGradePoints < 0 || actualGradePoints > 4) {
                await conn.rollback();
                return res.status(400).json({
                    message: 'When passed = true, provide actualGradePoints between 0.00 and 4.00'
                });
            }
            newStatus = 'Passed';
            resultGradePoints = parseFloat(actualGradePoints);
            note = `Repeat passed — actual grade point ${resultGradePoints.toFixed(2)} awarded (rule 4.10.3).`;

            await conn.query(
                `UPDATE RepeatModule
                 SET status = ?, result_grade_points = ?
                 WHERE repeat_id = ?`,
                [newStatus, resultGradePoints, repeatId]
            );

            // §4.10.5 — Clear the extension now that the repeat is passed
            await conn.query(
                `UPDATE Student SET extension_until = NULL WHERE student_id = ?`,
                [rep.student_id]
            );

            // Override the ORIGINAL semester's grade with the new actual grade
            // Convert grade point to representative percentage for display
            const pctMap = {
                4.00: 96, 3.90: 92, 3.70: 85, 3.69: 78, 3.50: 74, 3.00: 71,
                2.99: 68, 2.70: 64, 2.50: 61, 2.49: 58, 2.20: 54, 2.00: 51,
                1.99: 47, 1.00: 42, 0.00: 20
            };
            // Closest lower bucket
            let pct = 50;
            const keys = Object.keys(pctMap).map(Number).sort((a, b) => b - a);
            for (const k of keys) {
                if (resultGradePoints >= k) { pct = pctMap[k]; break; }
            }

            await conn.query(`
                INSERT INTO ModuleGradeOverride
                    (student_id, module_id, semester_id, override_grade_points,
                     override_percentage, override_type, source_id, created_by_user_id)
                VALUES (?, ?, ?, ?, ?, 'Repeat Pass', ?, ?)
                ON DUPLICATE KEY UPDATE
                    override_grade_points = VALUES(override_grade_points),
                    override_percentage = VALUES(override_percentage),
                    override_type = VALUES(override_type),
                    source_id = VALUES(source_id),
                    created_by_user_id = VALUES(created_by_user_id),
                    created_at = NOW()
            `, [rep.student_id, rep.module_id, rep.semester_id, resultGradePoints, pct, repeatId, userId]);
            overrideApplied = true;
        } else {
            newStatus = 'Failed';
            resultGradePoints = rep.original_grade_points;
            note = 'Repeat failed — student withdrawn on academic grounds (rule 4.10.6).';
            studentWithdrawn = true;

            await conn.query(
                `UPDATE RepeatModule
                 SET status = ?, result_grade_points = ?
                 WHERE repeat_id = ?`,
                [newStatus, resultGradePoints, repeatId]
            );

            await conn.query(
                `UPDATE Student
                 SET status = 'Withdrawn', academic_standing = 'Dismissed'
                 WHERE student_id = ?`,
                [rep.student_id]
            );

            await conn.query(
                `INSERT INTO AcademicStanding
                    (student_id, semester_id, standing_type, effective_date, remarks)
                 VALUES (?, ?, 'Dismissed', CURDATE(), ?)`,
                [rep.student_id, rep.semester_id, note]
            );
        }

        await conn.commit();

        res.json({
            message: 'Repeat processed',
            repeat_id: repeatId,
            student: { student_number: rep.student_number, name: rep.student_name },
            module: { code: rep.module_code, name: rep.module_name },
            attempt: rep.repeat_attempt,
            new_status: newStatus,
            result_grade_points: resultGradePoints,
            student_withdrawn: studentWithdrawn,
            gpa_override_applied: overrideApplied,
            note
        });

    } catch (err) {
        await conn.rollback();
        console.error('Process repeat error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// LECTURER: MANAGE ASSESSMENTS
// ============================================

// Guard: only allowed for the offering's own lecturer, and only while Draft/Rejected
async function canEditOffering(userId, offeringId) {
    const [rows] = await db.query(`
        SELECT mo.offering_id, mo.approval_status, l.user_id
        FROM ModuleOffering mo
        JOIN Lecturer l ON mo.lecturer_id = l.lecturer_id
        WHERE mo.offering_id = ? AND l.user_id = ?
    `, [offeringId, userId]);
    if (rows.length === 0) return { ok: false, code: 403, message: 'You do not teach this offering' };
    const status = rows[0].approval_status;
    if (!['Draft', 'Rejected'].includes(status)) {
        return { ok: false, code: 400, message: `Cannot edit assessments while status is '${status}'. Only Draft or Rejected offerings can be edited.` };
    }
    return { ok: true };
}

// Add a new assessment to an offering
app.post('/api/lecturer/add-assessment', authenticate, requireLecturer, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { offeringId, name, type, weightPercentage, maxScore, dueDate } = req.body;

        if (!offeringId || !name || !type || weightPercentage === undefined || maxScore === undefined) {
            return res.status(400).json({ message: 'Missing required fields: offeringId, name, type, weightPercentage, maxScore' });
        }

        const weight = parseFloat(weightPercentage);
        const max = parseFloat(maxScore);
        if (isNaN(weight) || weight <= 0 || weight > 100) return res.status(400).json({ message: 'weightPercentage must be between 0 and 100' });
        if (isNaN(max) || max <= 0) return res.status(400).json({ message: 'maxScore must be greater than 0' });

        const allowedTypes = ['Quiz','Test','Assignment','Practical','Project','Presentation','Midterm Exam','Final Exam','Continuous Assessment'];
        if (!allowedTypes.includes(type)) return res.status(400).json({ message: 'Invalid assessment type' });

        const guard = await canEditOffering(userId, offeringId);
        if (!guard.ok) return res.status(guard.code).json({ message: guard.message });

        // Check total weight would not exceed 100
        const [existing] = await db.query(
            'SELECT COALESCE(SUM(weight_percentage), 0) AS total FROM Assessment WHERE offering_id = ?',
            [offeringId]
        );
        const totalBefore = parseFloat(existing[0].total);
        if (totalBefore + weight > 100) {
            return res.status(400).json({
                message: `Adding this assessment would push the total weight to ${(totalBefore + weight).toFixed(1)}%. Current total: ${totalBefore.toFixed(1)}%. Each offering's assessments must total 100%.`
            });
        }

        const [result] = await db.query(`
            INSERT INTO Assessment (offering_id, name, type, weight_percentage, max_score, due_date)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [offeringId, name.trim(), type, weight, max, dueDate || new Date(Date.now() + 30*86400000)]);

        res.json({
            message: 'Assessment added',
            assessmentId: result.insertId,
            name: name.trim(),
            type,
            weight_percentage: weight,
            max_score: max
        });
    } catch (err) {
        console.error('Add assessment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update an existing assessment
app.put('/api/lecturer/update-assessment', authenticate, requireLecturer, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { assessmentId, name, type, weightPercentage, maxScore, dueDate } = req.body;

        if (!assessmentId) return res.status(400).json({ message: 'Missing assessmentId' });

        // Look up the assessment + offering
        const [assessments] = await db.query(`
            SELECT a.assessment_id, a.offering_id, a.name, a.type, a.weight_percentage, a.max_score, a.due_date
            FROM Assessment a
            WHERE a.assessment_id = ?
        `, [assessmentId]);

        if (assessments.length === 0) return res.status(404).json({ message: 'Assessment not found' });
        const a = assessments[0];

        const guard = await canEditOffering(userId, a.offering_id);
        if (!guard.ok) return res.status(guard.code).json({ message: guard.message });

        const newWeight = weightPercentage !== undefined ? parseFloat(weightPercentage) : parseFloat(a.weight_percentage);
        const newMax = maxScore !== undefined ? parseFloat(maxScore) : parseFloat(a.max_score);
        const newName = name !== undefined ? name.trim() : a.name;
        const newType = type !== undefined ? type : a.type;

        if (newWeight <= 0 || newWeight > 100) return res.status(400).json({ message: 'weightPercentage must be between 0 and 100' });
        if (newMax <= 0) return res.status(400).json({ message: 'maxScore must be greater than 0' });

        // Check weight sum after update
        const [others] = await db.query(
            'SELECT COALESCE(SUM(weight_percentage), 0) AS total FROM Assessment WHERE offering_id = ? AND assessment_id != ?',
            [a.offering_id, assessmentId]
        );
        const otherWeight = parseFloat(others[0].total);
        if (otherWeight + newWeight > 100) {
            return res.status(400).json({
                message: `Update would push total weight to ${(otherWeight + newWeight).toFixed(1)}%. Other assessments already total ${otherWeight.toFixed(1)}%.`
            });
        }

        // If maxScore is being reduced, ensure no existing grade exceeds it
        if (newMax < parseFloat(a.max_score)) {
            const [over] = await db.query(
                'SELECT COUNT(*) AS cnt FROM Grade WHERE assessment_id = ? AND score_obtained > ?',
                [assessmentId, newMax]
            );
            if (over[0].cnt > 0) {
                return res.status(400).json({
                    message: `Cannot reduce max score — ${over[0].cnt} existing grade(s) exceed ${newMax}.`
                });
            }
        }

        await db.query(`
            UPDATE Assessment
            SET name = ?, type = ?, weight_percentage = ?, max_score = ?, due_date = ?
            WHERE assessment_id = ?
        `, [newName, newType, newWeight, newMax, dueDate || a.due_date, assessmentId]);

        res.json({
            message: 'Assessment updated',
            assessmentId,
            name: newName,
            type: newType,
            weight_percentage: newWeight,
            max_score: newMax
        });
    } catch (err) {
        console.error('Update assessment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete an assessment (only if no grades recorded yet)
app.delete('/api/lecturer/delete-assessment', authenticate, requireLecturer, async (req, res) => {
    try {
        const userId = req.user.userId;
        const assessmentId = parseInt(req.query.assessmentId);
        if (!assessmentId) return res.status(400).json({ message: 'Missing assessmentId' });

        const [assessments] = await db.query(
            'SELECT assessment_id, offering_id, name FROM Assessment WHERE assessment_id = ?',
            [assessmentId]
        );
        if (assessments.length === 0) return res.status(404).json({ message: 'Assessment not found' });
        const a = assessments[0];

        const guard = await canEditOffering(userId, a.offering_id);
        if (!guard.ok) return res.status(guard.code).json({ message: guard.message });

        // Block delete if grades exist
        const [grades] = await db.query(
            'SELECT COUNT(*) AS cnt FROM Grade WHERE assessment_id = ?',
            [assessmentId]
        );
        if (grades[0].cnt > 0) {
            return res.status(400).json({
                message: `Cannot delete — ${grades[0].cnt} grade(s) already recorded. Clear the grades first.`
            });
        }

        await db.query('DELETE FROM Assessment WHERE assessment_id = ?', [assessmentId]);

        res.json({ message: 'Assessment deleted', assessmentId, name: a.name });
    } catch (err) {
        console.error('Delete assessment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// ADMIN: MODULE MANAGEMENT (list / get / update / delete)
// ============================================

// List modules with department, school, and counts
app.get('/api/admin/modules', authenticate, requireStaff, async (req, res) => {
    try {
        const { search, departmentId, schoolId } = req.query;

        let sql = `
            SELECT 
                m.module_id,
                m.code,
                m.name,
                m.credits,
                m.level,
                m.description,
                d.dept_id,
                d.name AS department_name,
                sch.school_id,
                sch.name AS school_name,
                (SELECT COUNT(*) FROM Curriculum c WHERE c.module_id = m.module_id) AS curriculum_count,
                (SELECT COUNT(*) FROM ModuleOffering mo WHERE mo.module_id = m.module_id) AS offering_count,
                (SELECT COUNT(DISTINCT e.enrollment_id)
                 FROM ModuleOffering mo
                 JOIN Enrollment e ON e.offering_id = mo.offering_id
                 WHERE mo.module_id = m.module_id) AS student_count
            FROM Module m
            LEFT JOIN Department d ON m.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ' AND (m.code LIKE ? OR m.name LIKE ?)';
            params.push('%' + search + '%', '%' + search + '%');
        }
        if (departmentId) {
            sql += ' AND m.dept_id = ?';
            params.push(departmentId);
        }
        if (schoolId) {
            sql += ' AND sch.school_id = ?';
            params.push(schoolId);
        }

        sql += ' ORDER BY sch.name, d.name, m.code';

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('List modules error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get one module + its curriculum entries
app.get('/api/admin/module', authenticate, requireStaff, async (req, res) => {
    try {
        const moduleId = parseInt(req.query.moduleId);
        if (!moduleId) return res.status(400).json({ message: 'Missing moduleId' });

        const [rows] = await db.query(`
            SELECT m.*, d.name AS department_name, sch.name AS school_name
            FROM Module m
            LEFT JOIN Department d ON m.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            WHERE m.module_id = ?
        `, [moduleId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Module not found' });

        const [curriculum] = await db.query(`
            SELECT c.curriculum_id, c.program_id, c.year_of_study, c.semester, c.is_core,
                   p.code AS program_code, p.name AS program_name
            FROM Curriculum c
            JOIN Program p ON c.program_id = p.program_id
            WHERE c.module_id = ?
            ORDER BY p.code, c.year_of_study, c.semester
        `, [moduleId]);

        res.json({ module: rows[0], curriculum });
    } catch (err) {
        console.error('Get module error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update module
app.put('/api/admin/update-module', authenticate, requireAdmin, async (req, res) => {
    try {
        const { moduleId, name, credits, level, description, departmentId } = req.body;

        if (!moduleId) return res.status(400).json({ message: 'Missing moduleId' });
        if (!name || !name.trim()) return res.status(400).json({ message: 'Module name is required' });
        if (!credits || credits <= 0) return res.status(400).json({ message: 'Credits must be greater than 0' });
        if (!departmentId) return res.status(400).json({ message: 'Department is required' });

        const [exists] = await db.query('SELECT module_id FROM Module WHERE module_id = ?', [moduleId]);
        if (exists.length === 0) return res.status(404).json({ message: 'Module not found' });

        await db.query(`
            UPDATE Module
            SET name = ?, credits = ?, level = ?, description = ?, dept_id = ?
            WHERE module_id = ?
        `, [name.trim(), parseInt(credits), level || null, description || null, departmentId, moduleId]);

        res.json({ message: 'Module updated successfully', moduleId });
    } catch (err) {
        console.error('Update module error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete module (only if no enrollments exist)
app.delete('/api/admin/delete-module', authenticate, requireAdmin, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const moduleId = parseInt(req.query.moduleId);
        if (!moduleId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing moduleId' });
        }

        const [rows] = await conn.query('SELECT module_id, code, name FROM Module WHERE module_id = ?', [moduleId]);
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Module not found' });
        }
        const module = rows[0];

        // Check for enrollments
        const [enrollments] = await conn.query(`
            SELECT COUNT(DISTINCT e.enrollment_id) AS cnt
            FROM ModuleOffering mo
            JOIN Enrollment e ON e.offering_id = mo.offering_id
            WHERE mo.module_id = ?
        `, [moduleId]);

        if (enrollments[0].cnt > 0) {
            await conn.rollback();
            return res.status(400).json({
                message: `Cannot delete — ${enrollments[0].cnt} enrollment(s) exist for this module. Remove the offerings or archive the module instead.`
            });
        }

        // Safe to delete: cascade handles Curriculum + ModuleOffering + Assessment
        // We'll manually delete offerings first (they cascade to assessments)
        await conn.query('DELETE FROM ModuleOffering WHERE module_id = ?', [moduleId]);
        await conn.query('DELETE FROM Curriculum WHERE module_id = ?', [moduleId]);
        await conn.query('DELETE FROM Module WHERE module_id = ?', [moduleId]);

        await conn.commit();

        res.json({
            message: `Module ${module.code} deleted`,
            moduleId,
            code: module.code,
            name: module.name
        });
    } catch (err) {
        await conn.rollback();
        console.error('Delete module error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// STUDENT APPEALS
// ============================================

// Student submits a new appeal
app.post('/api/students/submit-appeal', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { moduleId, semesterId, appealType, reason } = req.body;

        if (!moduleId || !reason || !reason.trim()) {
            return res.status(400).json({ message: 'Missing moduleId or reason' });
        }

        const allowedTypes = ['Grade Review', 'Remark', 'Missing Exam', 'Other'];
        const type = allowedTypes.includes(appealType) ? appealType : 'Grade Review';

        // Look up student
        const [students] = await db.query(
            'SELECT student_id FROM Student WHERE user_id = ?',
            [userId]
        );
        if (students.length === 0) return res.status(404).json({ message: 'Student record not found' });
        const studentId = students[0].student_id;

        // Enforce the 7-day rule if the semester is known:
        // Look up the latest released_at for any offering of this module the student is enrolled in
        if (semesterId) {
            const [rel] = await db.query(`
                SELECT MAX(mo.released_at) AS last_release
                FROM Enrollment e
                JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
                WHERE e.student_id = ? 
                  AND mo.module_id = ?
                  AND mo.semester_id = ?
                  AND mo.approval_status = 'Released'
            `, [studentId, moduleId, semesterId]);

            if (rel.length > 0 && rel[0].last_release) {
                const releaseDate = new Date(rel[0].last_release);
                const daysSince = (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince > 7) {
                    return res.status(400).json({
                        message: `Appeals must be submitted within 7 calendar days of release. That window closed ${Math.floor(daysSince - 7)} day(s) ago.`
                    });
                }
            }
        }

        const [result] = await db.query(`
            INSERT INTO Appeal (student_id, module_id, semester_id, appeal_type, reason, status)
            VALUES (?, ?, ?, ?, ?, 'Submitted')
        `, [studentId, moduleId, semesterId || null, type, reason.trim()]);

        res.json({
            message: 'Appeal submitted',
            appealId: result.insertId
        });
    } catch (err) {
        console.error('Submit appeal error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Student lists their own appeals
app.get('/api/students/my-appeals', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query(`
            SELECT 
                a.appeal_id,
                a.appeal_type,
                a.reason,
                a.status,
                a.submitted_at,
                a.decided_at,
                a.decision_remarks,
                m.code AS module_code,
                m.name AS module_name,
                sem.name AS semester_name,
                ay.year_name
            FROM Appeal a
            JOIN Student s ON a.student_id = s.student_id
            JOIN Module m ON a.module_id = m.module_id
            LEFT JOIN Semester sem ON a.semester_id = sem.semester_id
            LEFT JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            WHERE s.user_id = ?
            ORDER BY a.submitted_at DESC
        `, [userId]);
        res.json(rows);
    } catch (err) {
        console.error('My appeals error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin lists all appeals (scoped by role)
app.get('/api/admin/appeals', authenticate, requireLeadership, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        let scopeCondition = '';
        const params = [];

        if (role === 'HoD') {
            scopeCondition = 'AND d.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)';
            params.push(userId);
        } else if (role === 'Dean') {
            scopeCondition = `AND sch.school_id = (
                SELECT dept.school_id FROM Lecturer l
                JOIN Department dept ON l.dept_id = dept.dept_id
                WHERE l.user_id = ?
            )`;
            params.push(userId);
        }

        const [rows] = await db.query(`
            SELECT 
                a.appeal_id,
                a.appeal_type,
                a.reason,
                a.status,
                a.submitted_at,
                a.decided_at,
                a.decision_remarks,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                m.code AS module_code,
                m.name AS module_name,
                sem.name AS semester_name,
                ay.year_name,
                d.name AS department_name,
                sch.name AS school_name,
                CONCAT(u.username) AS decided_by_name
            FROM Appeal a
            JOIN Student s ON a.student_id = s.student_id
            JOIN Module m ON a.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            LEFT JOIN Semester sem ON a.semester_id = sem.semester_id
            LEFT JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            LEFT JOIN User u ON a.decided_by_user_id = u.user_id
            WHERE 1=1 ${scopeCondition}
            ORDER BY a.status = 'Submitted' DESC, a.submitted_at DESC
            LIMIT 300
        `, params);

        res.json(rows);
    } catch (err) {
        console.error('List appeals error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin decides an appeal
app.put('/api/admin/decide-appeal', authenticate, requireLeadership, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { appealId, decision, remarks } = req.body;

        if (!appealId) return res.status(400).json({ message: 'Missing appealId' });
        const allowed = ['Under Review', 'Upheld', 'Dismissed', 'Withdrawn'];
        if (!allowed.includes(decision)) {
            return res.status(400).json({ message: 'decision must be one of: Under Review, Upheld, Dismissed, Withdrawn' });
        }

        const [rows] = await db.query('SELECT appeal_id, status FROM Appeal WHERE appeal_id = ?', [appealId]);
        if (rows.length === 0) return res.status(404).json({ message: 'Appeal not found' });

        const finalStates = ['Upheld', 'Dismissed', 'Withdrawn'];
        const decidedAt = finalStates.includes(decision) ? new Date() : null;

        await db.query(`
            UPDATE Appeal
            SET status = ?, decided_at = ?, decided_by_user_id = ?, decision_remarks = ?
            WHERE appeal_id = ?
        `, [decision, decidedAt, userId, remarks || null, appealId]);

        res.json({ message: 'Appeal updated', appealId, new_status: decision });
    } catch (err) {
        console.error('Decide appeal error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// WITHDRAWALS — PDF §8
// ============================================

// Student requests a withdrawal
app.post('/api/students/request-withdrawal', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { withdrawalType, reason, reasonDetails, startDate, expectedReturnDate } = req.body;

        if (!withdrawalType || !reason || !startDate) {
            return res.status(400).json({ message: 'Missing withdrawalType, reason, or startDate' });
        }
        if (!['Voluntary', 'Temporary'].includes(withdrawalType)) {
            return res.status(400).json({ message: 'withdrawalType must be Voluntary or Temporary' });
        }
        const allowedReasons = ['Financial', 'Health', 'Pregnancy', 'Compassionate', 'Academic', 'Other'];
        if (!allowedReasons.includes(reason)) {
            return res.status(400).json({ message: 'Invalid reason' });
        }
        // §8.2: Temporary withdrawals require an expected return date
        if (withdrawalType === 'Temporary' && !expectedReturnDate) {
            return res.status(400).json({ message: 'Temporary withdrawals require an expectedReturnDate' });
        }

        const [students] = await db.query(
            'SELECT student_id FROM Student WHERE user_id = ?',
            [userId]
        );
        if (students.length === 0) return res.status(404).json({ message: 'Student record not found' });
        const studentId = students[0].student_id;

        // Block duplicate active requests
        const [existing] = await db.query(
            `SELECT withdrawal_id FROM Withdrawal 
             WHERE student_id = ? AND status IN ('Requested', 'Approved')`,
            [studentId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'You already have a pending or approved withdrawal.' });
        }

        const [result] = await db.query(`
            INSERT INTO Withdrawal
                (student_id, withdrawal_type, reason, reason_details,
                 start_date, expected_return_date, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Requested')
        `, [studentId, withdrawalType, reason, reasonDetails || null,
            startDate, expectedReturnDate || null]);

        res.json({
            message: 'Withdrawal request submitted',
            withdrawalId: result.insertId
        });
    } catch (err) {
        console.error('Request withdrawal error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Student lists own withdrawals
app.get('/api/students/my-withdrawals', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query(`
            SELECT w.withdrawal_id, w.withdrawal_type, w.reason, w.reason_details,
                   w.start_date, w.expected_return_date, w.actual_return_date,
                   w.status, w.requested_at, w.decided_at, w.decision_remarks,
                   CONCAT(u.username) AS decided_by_name
            FROM Withdrawal w
            JOIN Student s ON w.student_id = s.student_id
            LEFT JOIN User u ON w.decided_by_user_id = u.user_id
            WHERE s.user_id = ?
            ORDER BY w.requested_at DESC
        `, [userId]);
        res.json(rows);
    } catch (err) {
        console.error('My withdrawals error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin lists withdrawals (scoped by role)
app.get('/api/admin/withdrawals', authenticate, requireLeadership, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        let scopeCondition = '';
        const params = [];

        if (role === 'HoD') {
            scopeCondition = 'AND d.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)';
            params.push(userId);
        } else if (role === 'Dean') {
            scopeCondition = `AND sch.school_id = (
                SELECT dept.school_id FROM Lecturer l
                JOIN Department dept ON l.dept_id = dept.dept_id
                WHERE l.user_id = ?
            )`;
            params.push(userId);
        }

        const [rows] = await db.query(`
            SELECT 
                w.withdrawal_id, w.withdrawal_type, w.reason, w.reason_details,
                w.start_date, w.expected_return_date, w.actual_return_date,
                w.status, w.requested_at, w.decided_at, w.decision_remarks,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                p.code AS program_code, p.name AS program_name,
                d.name AS department_name, sch.name AS school_name,
                CONCAT(u.username) AS decided_by_name
            FROM Withdrawal w
            JOIN Student s ON w.student_id = s.student_id
            LEFT JOIN Program p ON s.program_id = p.program_id
            LEFT JOIN Department d ON s.dept_id = d.dept_id
            LEFT JOIN School sch ON d.school_id = sch.school_id
            LEFT JOIN User u ON w.decided_by_user_id = u.user_id
            WHERE 1=1 ${scopeCondition}
            ORDER BY w.status = 'Requested' DESC, w.requested_at DESC
            LIMIT 300
        `, params);

        res.json(rows);
    } catch (err) {
        console.error('List withdrawals error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin decides a withdrawal
// §9.6 — Auto-suggest exit qualification on withdrawal
app.put('/api/admin/decide-withdrawal', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { withdrawalId, decision, remarks } = req.body;

        if (!withdrawalId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing withdrawalId' });
        }
        if (!['Approved', 'Rejected'].includes(decision)) {
            await conn.rollback();
            return res.status(400).json({ message: 'decision must be Approved or Rejected' });
        }

        const [rows] = await conn.query(
            `SELECT w.*, s.student_id, s.student_number, s.program_id
             FROM Withdrawal w
             JOIN Student s ON w.student_id = s.student_id
             WHERE w.withdrawal_id = ?`,
            [withdrawalId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Withdrawal not found' });
        }
        const w = rows[0];

        if (w.status !== 'Requested') {
            await conn.rollback();
            return res.status(400).json({ message: `Already processed (status: ${w.status})` });
        }

        await conn.query(`
            UPDATE Withdrawal
            SET status = ?, decided_by_user_id = ?, decided_at = NOW(), decision_remarks = ?
            WHERE withdrawal_id = ?
        `, [decision, userId, remarks || null, withdrawalId]);

        let exitSuggestion = null;

        if (decision === 'Approved') {
            if (w.withdrawal_type === 'Voluntary') {
                await conn.query(
                    `UPDATE Student SET status = 'Withdrawn' WHERE student_id = ?`,
                    [w.student_id]
                );
            } else {
                await conn.query(
                    `UPDATE Student SET status = 'Deferred' WHERE student_id = ?`,
                    [w.student_id]
                );
            }

            // §9.6 — What's the highest qualification they could exit with?
            if (w.withdrawal_type === 'Voluntary') {
                const [creditResult] = await db.query(`
                    SELECT COALESCE(SUM(vmr.credits), 0) AS credits_earned
                    FROM vw_student_module_results vmr
                    WHERE vmr.student_id = ? AND vmr.final_grade_points >= 2.00
                `, [w.student_id]);

                const credits = parseInt(creditResult[0].credits_earned) || 0;

                if (credits >= 360) {
                    exitSuggestion = { type: 'Diploma', credits_required: 360, credits_have: credits };
                } else if (credits >= 120) {
                    exitSuggestion = { type: 'Certificate', credits_required: 120, credits_have: credits };
                } else {
                    exitSuggestion = {
                        type: null,
                        credits_required: 120,
                        credits_have: credits,
                        note: 'Below 120 credits — no exit award available.'
                    };
                }
            }
        }

        await conn.commit();

        res.json({
            message: `Withdrawal ${decision.toLowerCase()}`,
            withdrawalId,
            new_status: decision,
            student_status_updated: decision === 'Approved',
            exit_qualification_suggestion: exitSuggestion,
            note: exitSuggestion && exitSuggestion.type
                ? `§9.6 — Student is eligible for an exit award: ${exitSuggestion.type}. Propose it from Exit Awards.`
                : null
        });
    } catch (err) {
        await conn.rollback();
        console.error('Decide withdrawal error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Admin marks a temporary-withdrawal student as returned
// Admin marks a temporary-withdrawal student as returned
app.put('/api/admin/mark-returned', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { withdrawalId, actualReturnDate } = req.body;

        if (!withdrawalId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing withdrawalId' });
        }

        const [rows] = await conn.query(
            `SELECT w.*, s.student_id, s.student_number, s.program_id, s.current_year_of_study,
                    CONCAT(s.first_name, ' ', s.last_name) AS student_name
             FROM Withdrawal w
             JOIN Student s ON w.student_id = s.student_id
             WHERE w.withdrawal_id = ?`,
            [withdrawalId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Withdrawal not found' });
        }
        const w = rows[0];

        if (w.status !== 'Approved' || w.withdrawal_type !== 'Temporary') {
            await conn.rollback();
            return res.status(400).json({
                message: 'Only approved temporary withdrawals can be marked as returned'
            });
        }

        const returnDate = actualReturnDate || new Date().toISOString().slice(0, 10);

        await conn.query(`
            UPDATE Withdrawal
            SET status = 'Returned', actual_return_date = ?
            WHERE withdrawal_id = ?
        `, [returnDate, withdrawalId]);

        // Reactivate the student
        await conn.query(
            `UPDATE Student SET status = 'Active' WHERE student_id = ?`,
            [w.student_id]
        );

        // §8.2.4 — Re-enrol in the current active semester's modules for their year of study
        let enrolledCount = 0;
        let skippedReason = null;

        const [activeSem] = await conn.query(`
            SELECT sem.semester_id, sem.name AS semester_name, ay.year_name
            FROM Semester sem
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            WHERE sem.is_active = TRUE
            LIMIT 1
        `);

        if (activeSem.length === 0) {
            skippedReason = 'No active semester — student reactivated but not enrolled in any modules.';
        } else {
            const sem = activeSem[0];

            // Find offerings for the student's programme + current year of study
            const [offerings] = await conn.query(`
                SELECT mo.offering_id
                FROM Curriculum c
                JOIN ModuleOffering mo ON mo.module_id = c.module_id
                WHERE c.program_id = ?
                  AND c.year_of_study = ?
                  AND mo.semester_id = ?
            `, [w.program_id, w.current_year_of_study, sem.semester_id]);

            if (offerings.length === 0) {
                skippedReason = `No offerings found in ${sem.semester_name} (${sem.year_name}) for Year ${w.current_year_of_study} of the student's programme.`;
            } else {
                for (const off of offerings) {
                    try {
                        const [r] = await conn.query(
                            `INSERT IGNORE INTO Enrollment 
                             (student_id, offering_id, enrollment_date, status)
                             VALUES (?, ?, ?, 'Enrolled')`,
                            [w.student_id, off.offering_id, returnDate]
                        );
                        if (r.affectedRows > 0) {
                            await conn.query(
                                'UPDATE ModuleOffering SET current_enrollment = current_enrollment + 1 WHERE offering_id = ?',
                                [off.offering_id]
                            );
                            enrolledCount++;
                        }
                    } catch (e) { /* ignore dup */ }
                }
            }
        }

        await conn.commit();

        res.json({
            message: 'Student returned and reactivated',
            withdrawalId,
            student: {
                student_number: w.student_number,
                name: w.student_name
            },
            actual_return_date: returnDate,
            enrollmentsCreated: enrolledCount,
            note: enrolledCount > 0
                ? `Auto-enrolled in ${enrolledCount} module(s) for the current semester.`
                : (skippedReason || 'Student was reactivated but not enrolled in any modules.')
        });
    } catch (err) {
        await conn.rollback();
        console.error('Mark returned error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// MISSING EXAMS — PDF §5
// ============================================

// Student submits a missing-exam request
app.post('/api/students/request-missing-exam', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { assessmentId, reasonCategory, reasonDetails, supportingDocuments } = req.body;

        if (!assessmentId || !reasonCategory) {
            return res.status(400).json({ message: 'Missing assessmentId or reasonCategory' });
        }
        const allowedReasons = ['Illness', 'Bereavement', 'Other Valid', 'No Valid Reason'];
        if (!allowedReasons.includes(reasonCategory)) {
            return res.status(400).json({ message: 'Invalid reasonCategory' });
        }

        const [students] = await db.query(
            'SELECT student_id FROM Student WHERE user_id = ?',
            [userId]
        );
        if (students.length === 0) return res.status(404).json({ message: 'Student record not found' });
        const studentId = students[0].student_id;

        // Confirm the student is enrolled in the offering of this assessment
        const [enrollment] = await db.query(`
            SELECT e.enrollment_id
            FROM Enrollment e
            JOIN Assessment a ON a.offering_id = e.offering_id
            WHERE e.student_id = ? AND a.assessment_id = ?
        `, [studentId, assessmentId]);
        if (enrollment.length === 0) {
            return res.status(403).json({ message: 'You are not enrolled in the offering for this assessment.' });
        }

        // Block duplicate
        const [existing] = await db.query(
            `SELECT missing_exam_id FROM MissingExam 
             WHERE student_id = ? AND assessment_id = ? 
               AND status IN ('Requested', 'Approved')`,
            [studentId, assessmentId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'You already have a pending or approved request for this assessment.' });
        }

        const [result] = await db.query(`
            INSERT INTO MissingExam
                (student_id, assessment_id, reason_category, reason_details,
                 supporting_documents, status)
            VALUES (?, ?, ?, ?, ?, 'Requested')
        `, [studentId, assessmentId, reasonCategory, reasonDetails || null,
            supportingDocuments || null]);

        res.json({
            message: 'Missing exam request submitted',
            missingExamId: result.insertId
        });
    } catch (err) {
        console.error('Request missing exam error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Student lists own missing exam requests
app.get('/api/students/my-missing-exams', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query(`
            SELECT 
                me.missing_exam_id,
                me.reason_category, me.reason_details, me.supporting_documents,
                me.status, me.requested_at, me.resit_date,
                me.decided_at, me.decision_remarks,
                a.name AS assessment_name, a.type AS assessment_type,
                a.max_score, a.weight_percentage,
                m.code AS module_code, m.name AS module_name,
                sem.name AS semester_name, ay.year_name
            FROM MissingExam me
            JOIN Student s ON me.student_id = s.student_id
            JOIN Assessment a ON me.assessment_id = a.assessment_id
            JOIN ModuleOffering mo ON a.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            WHERE s.user_id = ?
            ORDER BY me.requested_at DESC
        `, [userId]);
        res.json(rows);
    } catch (err) {
        console.error('My missing exams error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Student lists their upcoming assessments (to choose from when requesting)
app.get('/api/students/my-upcoming-assessments', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query(`
            SELECT 
                a.assessment_id,
                a.name AS assessment_name,
                a.type AS assessment_type,
                a.due_date,
                a.max_score, a.weight_percentage,
                m.code AS module_code, m.name AS module_name,
                sem.name AS semester_name, ay.year_name
            FROM Student s
            JOIN Enrollment e ON s.student_id = e.student_id
            JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
            JOIN Assessment a ON a.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            WHERE s.user_id = ?
            ORDER BY a.due_date DESC
            LIMIT 100
        `, [userId]);
        res.json(rows);
    } catch (err) {
        console.error('My upcoming assessments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin lists missing exam requests (scoped by role)
app.get('/api/admin/missing-exams', authenticate, requireLeadership, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        let scopeCondition = '';
        const params = [];

        if (role === 'HoD') {
            scopeCondition = 'AND d.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)';
            params.push(userId);
        } else if (role === 'Dean') {
            scopeCondition = `AND sch.school_id = (
                SELECT dept.school_id FROM Lecturer l
                JOIN Department dept ON l.dept_id = dept.dept_id
                WHERE l.user_id = ?
            )`;
            params.push(userId);
        }

        const [rows] = await db.query(`
            SELECT 
                me.missing_exam_id,
                me.reason_category, me.reason_details, me.supporting_documents,
                me.status, me.requested_at, me.resit_date,
                me.decided_at, me.decision_remarks,
                a.assessment_id, a.name AS assessment_name, a.type AS assessment_type,
                a.max_score, a.weight_percentage,
                m.code AS module_code, m.name AS module_name,
                d.name AS department_name, sch.name AS school_name,
                sem.name AS semester_name, ay.year_name,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                CONCAT(u.username) AS decided_by_name
            FROM MissingExam me
            JOIN Student s ON me.student_id = s.student_id
            JOIN Assessment a ON me.assessment_id = a.assessment_id
            JOIN ModuleOffering mo ON a.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            LEFT JOIN User u ON me.decided_by_user_id = u.user_id
            WHERE 1=1 ${scopeCondition}
            ORDER BY me.status = 'Requested' DESC, me.requested_at DESC
            LIMIT 300
        `, params);

        res.json(rows);
    } catch (err) {
        console.error('List missing exams error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin decides a missing exam request
app.put('/api/admin/decide-missing-exam', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { missingExamId, decision, resitDate, remarks } = req.body;

        if (!missingExamId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing missingExamId' });
        }
        if (!['Approved', 'Rejected'].includes(decision)) {
            await conn.rollback();
            return res.status(400).json({ message: 'decision must be Approved or Rejected' });
        }
        if (decision === 'Approved' && !resitDate) {
            await conn.rollback();
            return res.status(400).json({ message: 'Approved requests require a resitDate' });
        }

        const [rows] = await conn.query(
            `SELECT me.*, a.max_score, a.name AS assessment_name
             FROM MissingExam me
             JOIN Assessment a ON me.assessment_id = a.assessment_id
             WHERE me.missing_exam_id = ?`,
            [missingExamId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Missing exam request not found' });
        }
        const me = rows[0];

        if (me.status !== 'Requested') {
            await conn.rollback();
            return res.status(400).json({ message: `Already processed (status: ${me.status})` });
        }

        await conn.query(`
            UPDATE MissingExam
            SET status = ?, resit_date = ?, decided_by_user_id = ?, decided_at = NOW(),
                decision_remarks = ?
            WHERE missing_exam_id = ?
        `, [decision, decision === 'Approved' ? resitDate : null,
            userId, remarks || null, missingExamId]);

        // §5.3 / §5.6 — Rejected (or "No Valid Reason") → award ZERO on that assessment
        let zeroGradeApplied = false;
        if (decision === 'Rejected' || me.reason_category === 'No Valid Reason') {
            // Only award zero if no existing grade for this assessment
            const [existingGrade] = await conn.query(
                `SELECT grade_id FROM Grade
                 WHERE enrollment_id = (
                     SELECT enrollment_id FROM Enrollment
                     WHERE student_id = ? AND offering_id = (
                         SELECT offering_id FROM Assessment WHERE assessment_id = ?
                     )
                     LIMIT 1
                 ) AND assessment_id = ?`,
                [me.student_id, me.assessment_id, me.assessment_id]
            );

            if (existingGrade.length === 0) {
                // Insert zero
                await conn.query(`
                    INSERT INTO Grade
                        (enrollment_id, assessment_id, score_obtained, percentage,
                         grade_letter, grade_points, submission_date, graded_date)
                    SELECT e.enrollment_id, ?, 0, 0, 'F-', 0, NOW(), NOW()
                    FROM Enrollment e
                    JOIN Assessment a ON a.offering_id = e.offering_id
                    WHERE e.student_id = ? AND a.assessment_id = ?
                    LIMIT 1
                `, [me.assessment_id, me.student_id, me.assessment_id]);
                zeroGradeApplied = true;
            }
        }

        await conn.commit();

        res.json({
            message: `Missing exam request ${decision.toLowerCase()}`,
            missingExamId,
            new_status: decision,
            resit_date: decision === 'Approved' ? resitDate : null,
            zero_grade_applied: zeroGradeApplied
        });
    } catch (err) {
        await conn.rollback();
        console.error('Decide missing exam error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Admin marks a missing exam as completed (resit done)
app.put('/api/admin/complete-missing-exam', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { missingExamId, remarks } = req.body;
        if (!missingExamId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing missingExamId' });
        }

        const [rows] = await conn.query(
            'SELECT missing_exam_id, status FROM MissingExam WHERE missing_exam_id = ?',
            [missingExamId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Missing exam not found' });
        }
        if (rows[0].status !== 'Approved') {
            await conn.rollback();
            return res.status(400).json({ message: 'Only approved requests can be marked completed' });
        }

        await conn.query(`
            UPDATE MissingExam
            SET status = 'Completed', decision_remarks = COALESCE(?, decision_remarks)
            WHERE missing_exam_id = ?
        `, [remarks || null, missingExamId]);

        await conn.commit();

        res.json({
            message: 'Marked as completed',
            missingExamId,
            new_status: 'Completed'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Complete missing exam error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// INCOMPLETE GRADE — PDF §6
// ============================================

// Admin marks a student's offering as INC
app.post('/api/admin/mark-incomplete', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { studentNumber, offeringId, reason, deadline } = req.body;

        if (!studentNumber || !offeringId || !deadline) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing studentNumber, offeringId, or deadline' });
        }

        // Look up student + enrollment
        const [rows] = await conn.query(`
            SELECT e.enrollment_id, e.student_id, s.student_number, s.status AS student_status,
                   mo.approval_status
            FROM Enrollment e
            JOIN Student s ON e.student_id = s.student_id
            JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
            WHERE s.student_number = ? AND e.offering_id = ?
        `, [studentNumber, offeringId]);

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Student is not enrolled in this offering.' });
        }
        const e = rows[0];

        // Block if already an active INC for this enrollment
        const [existing] = await conn.query(
            `SELECT incomplete_id FROM IncompleteGrade 
             WHERE enrollment_id = ? AND status = 'Active'`,
            [e.enrollment_id]
        );
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'This student already has an active INC for this offering.' });
        }

        // §6.3 — max 2 active INCs per student
        const [activeCount] = await conn.query(
            `SELECT COUNT(*) AS cnt FROM IncompleteGrade 
             WHERE student_id = ? AND status = 'Active'`,
            [e.student_id]
        );
        if (activeCount[0].cnt >= 2) {
            await conn.rollback();
            return res.status(400).json({
                message: `Rule §6.3 — student already has ${activeCount[0].cnt} active INC(s). Maximum allowed is 2.`
            });
        }

        const [result] = await conn.query(`
            INSERT INTO IncompleteGrade
                (student_id, offering_id, enrollment_id, marked_by_user_id, deadline, reason, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Active')
        `, [e.student_id, offeringId, e.enrollment_id, userId, deadline, reason || null]);

        await conn.commit();

        res.json({
            message: 'Incomplete Grade (INC) recorded',
            incompleteId: result.insertId,
            deadline,
            note: 'Rule §6.2 — If not cleared by the deadline, this becomes a grade of zero.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Mark incomplete error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Admin lists INC grades (scoped by role)
app.get('/api/admin/incomplete-grades', authenticate, requireLeadership, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        let scopeCondition = '';
        const params = [];

        if (role === 'HoD') {
            scopeCondition = 'AND d.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)';
            params.push(userId);
        } else if (role === 'Dean') {
            scopeCondition = `AND sch.school_id = (
                SELECT dept.school_id FROM Lecturer l
                JOIN Department dept ON l.dept_id = dept.dept_id
                WHERE l.user_id = ?
            )`;
            params.push(userId);
        }

        const [rows] = await db.query(`
            SELECT 
                ig.incomplete_id, ig.marked_at, ig.deadline, ig.reason,
                ig.status, ig.cleared_at, ig.clear_remarks,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                m.code AS module_code, m.name AS module_name,
                d.name AS department_name, sch.name AS school_name,
                sem.name AS semester_name, ay.year_name,
                p.code AS program_code,
                CONCAT(marker.username) AS marked_by_name,
                CONCAT(clearer.username) AS cleared_by_name,
                DATEDIFF(ig.deadline, CURDATE()) AS days_remaining
            FROM IncompleteGrade ig
            JOIN Student s ON ig.student_id = s.student_id
            JOIN ModuleOffering mo ON ig.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            LEFT JOIN Program p ON s.program_id = p.program_id
            LEFT JOIN User marker ON ig.marked_by_user_id = marker.user_id
            LEFT JOIN User clearer ON ig.cleared_by_user_id = clearer.user_id
            WHERE 1=1 ${scopeCondition}
            ORDER BY ig.status = 'Active' DESC, ig.deadline ASC
            LIMIT 300
        `, params);

        res.json(rows);
    } catch (err) {
        console.error('List incomplete grades error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin clears an INC (student completed the work)
app.put('/api/admin/clear-incomplete', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { incompleteId, remarks } = req.body;

        if (!incompleteId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing incompleteId' });
        }

        const [rows] = await conn.query(
            'SELECT incomplete_id, status FROM IncompleteGrade WHERE incomplete_id = ?',
            [incompleteId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'INC record not found' });
        }
        if (rows[0].status !== 'Active') {
            await conn.rollback();
            return res.status(400).json({ message: `This INC is already ${rows[0].status.toLowerCase()}.` });
        }

        await conn.query(`
            UPDATE IncompleteGrade
            SET status = 'Cleared', cleared_at = NOW(),
                cleared_by_user_id = ?, clear_remarks = ?
            WHERE incomplete_id = ?
        `, [userId, remarks || null, incompleteId]);

        await conn.commit();

        res.json({
            message: 'INC cleared — student completed the work',
            incompleteId,
            new_status: 'Cleared'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Clear incomplete error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Admin expires an INC (deadline passed → becomes zero)
app.put('/api/admin/expire-incomplete', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { incompleteId, remarks } = req.body;
        if (!incompleteId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing incompleteId' });
        }

        const [rows] = await conn.query(`
            SELECT ig.incomplete_id, ig.status, ig.enrollment_id, ig.offering_id, ig.student_id,
                   mo.approval_status
            FROM IncompleteGrade ig
            JOIN ModuleOffering mo ON ig.offering_id = mo.offering_id
            WHERE ig.incomplete_id = ?
        `, [incompleteId]);

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'INC record not found' });
        }
        const ig = rows[0];

        if (ig.status !== 'Active') {
            await conn.rollback();
            return res.status(400).json({ message: `This INC is already ${ig.status.toLowerCase()}.` });
        }

        // §6.2 — becomes a grade of zero
        // Determine current assessments on the offering
        const [assessments] = await conn.query(
            'SELECT assessment_id FROM Assessment WHERE offering_id = ?',
            [ig.offering_id]
        );

        // Mark INC as expired
        await conn.query(`
            UPDATE IncompleteGrade
            SET status = 'Expired', cleared_at = NOW(), clear_remarks = COALESCE(?, 'Auto-expired — deadline passed (§6.2)')
            WHERE incomplete_id = ?
        `, [remarks || null, incompleteId]);

        // For each assessment without a grade, insert a zero
        let zerosApplied = 0;
        for (const a of assessments) {
            const [existing] = await conn.query(
                'SELECT grade_id FROM Grade WHERE enrollment_id = ? AND assessment_id = ?',
                [ig.enrollment_id, a.assessment_id]
            );
            if (existing.length === 0) {
                await conn.query(`
                    INSERT INTO Grade
                        (enrollment_id, assessment_id, score_obtained, percentage,
                         grade_letter, grade_points, submission_date, graded_date)
                    VALUES (?, ?, 0, 0, 'F-', 0, NOW(), NOW())
                `, [ig.enrollment_id, a.assessment_id]);
                zerosApplied++;
            }
        }

        await conn.commit();

        res.json({
            message: 'INC expired — grade of zero applied per rule §6.2',
            incompleteId,
            new_status: 'Expired',
            zeros_applied: zerosApplied
        });
    } catch (err) {
        await conn.rollback();
        console.error('Expire incomplete error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Student views own INC grades
app.get('/api/students/my-incomplete-grades', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query(`
            SELECT 
                ig.incomplete_id, ig.marked_at, ig.deadline, ig.reason,
                ig.status, ig.cleared_at, ig.clear_remarks,
                m.code AS module_code, m.name AS module_name,
                sem.name AS semester_name, ay.year_name,
                DATEDIFF(ig.deadline, CURDATE()) AS days_remaining
            FROM IncompleteGrade ig
            JOIN Student s ON ig.student_id = s.student_id
            JOIN ModuleOffering mo ON ig.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            WHERE s.user_id = ?
            ORDER BY ig.status = 'Active' DESC, ig.deadline ASC
        `, [userId]);
        res.json(rows);
    } catch (err) {
        console.error('My incomplete grades error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// AEGROTAT PASS — PDF §7
// ============================================

// Admin creates an Aegrotat request
app.post('/api/admin/create-aegrotat', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { studentNumber, offeringId, overallCaAverage, medicalEvidence, reason } = req.body;

        if (!studentNumber || !offeringId || overallCaAverage === undefined) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing studentNumber, offeringId, or overallCaAverage' });
        }

        const ca = parseFloat(overallCaAverage);
        if (isNaN(ca) || ca < 0 || ca > 4.00) {
            await conn.rollback();
            return res.status(400).json({ message: 'overallCaAverage must be between 0.00 and 4.00' });
        }

        // §7.1 — must be ABOVE 2.99
        if (ca <= 2.99) {
            await conn.rollback();
            return res.status(400).json({
                message: `Rule §7.1 — CA average must be above 2.99. You provided ${ca.toFixed(2)}. Aegrotat not applicable.`
            });
        }

        // Look up enrollment
        const [rows] = await conn.query(`
            SELECT e.enrollment_id, e.student_id
            FROM Enrollment e
            JOIN Student s ON e.student_id = s.student_id
            WHERE s.student_number = ? AND e.offering_id = ?
        `, [studentNumber, offeringId]);

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Student is not enrolled in this offering.' });
        }
        const e = rows[0];

        // Block if a pending/approved aegrotat already exists
        const [existing] = await conn.query(
            `SELECT aegrotat_id FROM Aegrotat 
             WHERE enrollment_id = ? AND status IN ('Requested','Approved')`,
            [e.enrollment_id]
        );
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(400).json({ message: 'An Aegrotat request already exists for this offering.' });
        }

        const [result] = await conn.query(`
            INSERT INTO Aegrotat
                (student_id, offering_id, enrollment_id, overall_ca_average,
                 medical_evidence, reason, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Requested')
        `, [e.student_id, offeringId, e.enrollment_id, ca,
            medicalEvidence || null, reason || null]);

        await conn.commit();

        res.json({
            message: 'Aegrotat request created',
            aegrotatId: result.insertId,
            note: 'Rule §7.3 — Must be approved by Senate.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Create aegrotat error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// List aegrotat requests (scoped by role)
app.get('/api/admin/aegrotats', authenticate, requireLeadership, async (req, res) => {
    try {
        const role = req.user.role;
        const userId = req.user.userId;

        let scopeCondition = '';
        const params = [];

        if (role === 'HoD') {
            scopeCondition = 'AND d.dept_id = (SELECT dept_id FROM Lecturer WHERE user_id = ?)';
            params.push(userId);
        } else if (role === 'Dean') {
            scopeCondition = `AND sch.school_id = (
                SELECT dept.school_id FROM Lecturer l
                JOIN Department dept ON l.dept_id = dept.dept_id
                WHERE l.user_id = ?
            )`;
            params.push(userId);
        }

        const [rows] = await db.query(`
            SELECT 
                a.aegrotat_id, a.overall_ca_average, a.medical_evidence, a.reason,
                a.status, a.requested_at, a.decided_at, a.decision_remarks,
                a.eligible_for_credit,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                m.code AS module_code, m.name AS module_name,
                d.name AS department_name, sch.name AS school_name,
                sem.name AS semester_name, ay.year_name,
                p.code AS program_code, p.duration_years,
                CONCAT(u.username) AS decided_by_name
            FROM Aegrotat a
            JOIN Student s ON a.student_id = s.student_id
            JOIN ModuleOffering mo ON a.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Department d ON m.dept_id = d.dept_id
            JOIN School sch ON d.school_id = sch.school_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            LEFT JOIN Program p ON s.program_id = p.program_id
            LEFT JOIN User u ON a.decided_by_user_id = u.user_id
            WHERE 1=1 ${scopeCondition}
            ORDER BY a.status = 'Requested' DESC, a.requested_at DESC
            LIMIT 300
        `, params);

        // Compute if final-year
        const withFinalYear = rows.map(r => ({
            ...r,
            is_final_year: r.current_year_of_study >= r.duration_years
        }));

        res.json(withFinalYear);
    } catch (err) {
        console.error('List aegrotats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Decide an Aegrotat (approve/reject)
// §7.2 — On approval, the module is capped at grade point 2.00 (Pass)
app.put('/api/admin/decide-aegrotat', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { aegrotatId, decision, remarks, eligibleForCredit } = req.body;

        if (!aegrotatId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing aegrotatId' });
        }
        if (!['Approved', 'Rejected'].includes(decision)) {
            await conn.rollback();
            return res.status(400).json({ message: 'decision must be Approved or Rejected' });
        }

        const [rows] = await conn.query(
            `SELECT aegrotat_id, student_id, offering_id, status
             FROM Aegrotat WHERE aegrotat_id = ?`,
            [aegrotatId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Aegrotat not found' });
        }
        const aeg = rows[0];

        if (aeg.status !== 'Requested') {
            await conn.rollback();
            return res.status(400).json({ message: `Already processed (status: ${aeg.status})` });
        }

        // §7.2 — final-year aegrotat defaults to NO credit
        const creditFlag = decision === 'Approved'
            ? (eligibleForCredit === true ? 1 : 0)
            : 0;

        await conn.query(`
            UPDATE Aegrotat
            SET status = ?, decided_by_user_id = ?, decided_at = NOW(),
                decision_remarks = ?, eligible_for_credit = ?
            WHERE aegrotat_id = ?
        `, [decision, userId, remarks || null, creditFlag, aegrotatId]);

        // §7.2 — If approved, write a GPA override so the module shows as PASSED
        let overrideApplied = false;
        if (decision === 'Approved') {
            // Look up the module + semester of the offering
            const [offInfo] = await conn.query(`
                SELECT mo.module_id, mo.semester_id
                FROM ModuleOffering mo
                WHERE mo.offering_id = ?
            `, [aeg.offering_id]);

            if (offInfo.length > 0) {
                await conn.query(`
                    INSERT INTO ModuleGradeOverride
                        (student_id, module_id, semester_id, override_grade_points,
                         override_percentage, override_type, source_id, created_by_user_id)
                    VALUES (?, ?, ?, 2.00, 50.00, 'Aegrotat Pass', ?, ?)
                    ON DUPLICATE KEY UPDATE
                        override_grade_points = VALUES(override_grade_points),
                        override_percentage = VALUES(override_percentage),
                        override_type = VALUES(override_type),
                        source_id = VALUES(source_id),
                        created_by_user_id = VALUES(created_by_user_id),
                        created_at = NOW()
                `, [aeg.student_id, offInfo[0].module_id, offInfo[0].semester_id, aegrotatId, userId]);
                overrideApplied = true;
            }
        }

        await conn.commit();

        res.json({
            message: `Aegrotat ${decision.toLowerCase()}`,
            aegrotatId,
            new_status: decision,
            eligible_for_credit: creditFlag === 1,
            gpa_override_applied: overrideApplied,
            note: overrideApplied
                ? 'Module recorded as Passed (D-, 2.00) per §7.2.'
                : (decision === 'Rejected' ? 'Request rejected.' : 'No override written (offering lookup failed).')
        });
    } catch (err) {
        await conn.rollback();
        console.error('Decide aegrotat error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Student views own aegrotats
app.get('/api/students/my-aegrotats', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query(`
            SELECT 
                a.aegrotat_id, a.overall_ca_average, a.status, a.requested_at,
                a.decided_at, a.decision_remarks, a.eligible_for_credit,
                m.code AS module_code, m.name AS module_name,
                sem.name AS semester_name, ay.year_name
            FROM Aegrotat a
            JOIN Student s ON a.student_id = s.student_id
            JOIN ModuleOffering mo ON a.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            WHERE s.user_id = ?
            ORDER BY a.requested_at DESC
        `, [userId]);
        res.json(rows);
    } catch (err) {
        console.error('My aegrotats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// CHANGE OF PROGRAMME — PDF §14
// ============================================

// Student requests a programme change
// §14.1 — Only within the first 2 weeks of the academic year
app.post('/api/students/request-program-change', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { toProgramId, reason } = req.body;

        if (!toProgramId) {
            return res.status(400).json({ message: 'Missing toProgramId' });
        }

        const [students] = await db.query(
            'SELECT student_id, program_id, current_year_of_study FROM Student WHERE user_id = ?',
            [userId]
        );
        if (students.length === 0) return res.status(404).json({ message: 'Student not found' });
        const student = students[0];

        if (student.program_id === parseInt(toProgramId)) {
            return res.status(400).json({ message: 'You are already in that programme.' });
        }

        // §14.1 — check window: within 14 days of the academic year start
        const [activeYear] = await db.query(`
            SELECT academic_year_id, year_name, start_date
            FROM AcademicYear
            WHERE is_current = TRUE
            LIMIT 1
        `);

        if (activeYear.length > 0) {
            const startDate = new Date(activeYear[0].start_date);
            const daysSinceStart = (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceStart > 14) {
                // Outside the window — check if student passed their current class (§14.2)
                const [currYearModules] = await db.query(`
                    SELECT 
                        COUNT(DISTINCT vmr.module_id) AS total,
                        COUNT(DISTINCT CASE WHEN vmr.final_grade_points >= 2.00 THEN vmr.module_id END) AS passed
                    FROM vw_student_module_results vmr
                    JOIN Module m ON vmr.module_id = m.module_id
                    JOIN Curriculum c ON c.module_id = m.module_id AND c.program_id = ?
                    JOIN Student s ON s.student_id = vmr.student_id
                    WHERE vmr.student_number = ?
                      AND c.year_of_study = s.current_year_of_study
                `, [student.program_id, (await db.query('SELECT student_number FROM Student WHERE student_id = ?', [student.student_id]))[0][0].student_number]);

                const total = parseInt(currYearModules[0].total) || 0;
                const passed = parseInt(currYearModules[0].passed) || 0;

                if (total > 0 && passed < total) {
                    return res.status(400).json({
                        message: `Rule §14.1/§14.2 — Programme change only allowed in the first 2 weeks of the academic year. That window closed ${Math.floor(daysSinceStart - 14)} day(s) ago. You must first pass your current class.`
                    });
                }
            }
        }

        // Verify target programme exists
        const [target] = await db.query('SELECT program_id, code, name FROM Program WHERE program_id = ?', [toProgramId]);
        if (target.length === 0) return res.status(404).json({ message: 'Target programme not found' });

        // Block duplicate pending requests
        const [existing] = await db.query(
            `SELECT change_id FROM ChangeProgram 
             WHERE student_id = ? AND status = 'Requested'`,
            [student.student_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'You already have a pending change request.' });
        }

        const [result] = await db.query(`
            INSERT INTO ChangeProgram
                (student_id, from_program_id, to_program_id, reason, status)
            VALUES (?, ?, ?, ?, 'Requested')
        `, [student.student_id, student.program_id, toProgramId, reason || null]);

        res.json({
            message: 'Programme change request submitted',
            changeId: result.insertId,
            note: 'Rule §14.1 — Approval depends on space and eligibility.'
        });
    } catch (err) {
        console.error('Request program change error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Student lists own change requests
app.get('/api/students/my-program-changes', authenticate, requireStudent, async (req, res) => {
    try {
        const userId = req.user.userId;
        const [rows] = await db.query(`
            SELECT 
                cp.change_id, cp.reason, cp.status,
                cp.requested_at, cp.decided_at, cp.decision_remarks,
                fp.code AS from_code, fp.name AS from_name,
                tp.code AS to_code, tp.name AS to_name
            FROM ChangeProgram cp
            JOIN Student s ON cp.student_id = s.student_id
            JOIN Program fp ON cp.from_program_id = fp.program_id
            JOIN Program tp ON cp.to_program_id = tp.program_id
            WHERE s.user_id = ?
            ORDER BY cp.requested_at DESC
        `, [userId]);
        res.json(rows);
    } catch (err) {
        console.error('My program changes error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin lists all change requests
app.get('/api/admin/program-changes', authenticate, requireLeadership, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                cp.change_id, cp.reason, cp.status,
                cp.requested_at, cp.decided_at, cp.decision_remarks,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                fp.code AS from_code, fp.name AS from_name,
                tp.code AS to_code, tp.name AS to_name,
                CONCAT(u.username) AS decided_by_name
            FROM ChangeProgram cp
            JOIN Student s ON cp.student_id = s.student_id
            JOIN Program fp ON cp.from_program_id = fp.program_id
            JOIN Program tp ON cp.to_program_id = tp.program_id
            LEFT JOIN User u ON cp.decided_by_user_id = u.user_id
            ORDER BY cp.status = 'Requested' DESC, cp.requested_at DESC
            LIMIT 300
        `);
        res.json(rows);
    } catch (err) {
        console.error('List program changes error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Admin decides a change request
app.put('/api/admin/decide-program-change', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { changeId, decision, remarks } = req.body;

        if (!changeId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing changeId' });
        }
        if (!['Approved', 'Rejected', 'Withdrawn'].includes(decision)) {
            await conn.rollback();
            return res.status(400).json({ message: 'decision must be Approved, Rejected, or Withdrawn' });
        }

        const [rows] = await conn.query(
            'SELECT change_id, student_id, to_program_id, status FROM ChangeProgram WHERE change_id = ?',
            [changeId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Change request not found' });
        }
        const cp = rows[0];

        if (cp.status !== 'Requested') {
            await conn.rollback();
            return res.status(400).json({ message: `Already processed (status: ${cp.status})` });
        }

        // Update the request
        await conn.query(`
            UPDATE ChangeProgram
            SET status = ?, decided_by_user_id = ?, decided_at = NOW(), decision_remarks = ?
            WHERE change_id = ?
        `, [decision, userId, remarks || null, changeId]);

        // If approved → move the student
        let studentMoved = false;
        if (decision === 'Approved') {
            // Get the target programme's dept_id
            const [target] = await conn.query(
                'SELECT dept_id FROM Program WHERE program_id = ?',
                [cp.to_program_id]
            );

            if (target.length > 0) {
                await conn.query(`
                    UPDATE Student
                    SET program_id = ?, dept_id = ?
                    WHERE student_id = ?
                `, [cp.to_program_id, target[0].dept_id, cp.student_id]);
                studentMoved = true;
            }
        }

        await conn.commit();

        res.json({
            message: `Programme change ${decision.toLowerCase()}`,
            changeId,
            new_status: decision,
            student_moved: studentMoved
        });
    } catch (err) {
        await conn.rollback();
        console.error('Decide program change error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// POSTHUMOUS AWARD — PDF §13
// ============================================

// Admin proposes a posthumous award
app.post('/api/admin/propose-posthumous', authenticate, requireLeadership, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { studentNumber, reason } = req.body;

        if (!studentNumber) {
            return res.status(400).json({ message: 'Missing studentNumber' });
        }

        // Get student + program
        const [students] = await db.query(
            `SELECT s.student_id, s.program_id, s.current_year_of_study,
                    CONCAT(s.first_name, ' ', s.last_name) AS full_name,
                    p.code AS program_code, p.name AS program_name,
                    p.duration_years
             FROM Student s
             JOIN Program p ON s.program_id = p.program_id
             WHERE s.student_number = ?`,
            [studentNumber]
        );
        if (students.length === 0) return res.status(404).json({ message: 'Student not found' });
        const student = students[0];

        // §13.1 — student must have passed at least 50% of modules
        const [stats] = await db.query(`
            SELECT 
                COUNT(DISTINCT vmr.module_id) AS total_modules,
                COUNT(DISTINCT CASE WHEN vmr.final_grade_points >= 2.00 THEN vmr.module_id END) AS passed_modules
            FROM vw_student_module_results vmr
            WHERE vmr.student_number = ?
        `, [studentNumber]);

        const totalModules = parseInt(stats[0].total_modules) || 0;
        const passedModules = parseInt(stats[0].passed_modules) || 0;
        const passPct = totalModules > 0 ? (passedModules * 100.0 / totalModules) : 0;

        if (passPct < 50) {
            return res.status(400).json({
                message: `Rule §13.1 — Student must have passed at least 50% of modules. Currently: ${passedModules}/${totalModules} (${passPct.toFixed(1)}%).`
            });
        }

        // Calculate what classification they would have received
        const [cgpaResult] = await db.query(
            'SELECT cgpa FROM vw_student_cumulative WHERE student_number = ?',
            [studentNumber]
        );
        const cgpa = cgpaResult.length > 0 && cgpaResult[0].cgpa !== null
            ? parseFloat(cgpaResult[0].cgpa)
            : 0;

        let classification;
        const isHonours = student.duration_years === 5;
        if (isHonours) {
            if (cgpa >= 3.70) classification = 'First Class (Posthumous)';
            else if (cgpa >= 3.00) classification = 'Upper Second Class (Posthumous)';
            else if (cgpa >= 2.50) classification = 'Lower Second Class (Posthumous)';
            else classification = 'Third Class (Posthumous)';
        } else {
            if (cgpa >= 3.70) classification = 'Distinction (Posthumous)';
            else if (cgpa >= 2.50) classification = 'Credit (Posthumous)';
            else classification = 'Pass (Posthumous)';
        }

        // Block duplicate
        const [existing] = await db.query(
            `SELECT award_id FROM PosthumousAward 
             WHERE student_id = ? AND status IN ('Proposed','Senate_Approved','Granted')`,
            [student.student_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'A posthumous award is already proposed or granted for this student.' });
        }

        const [result] = await db.query(`
            INSERT INTO PosthumousAward
                (student_id, program_id, modules_passed, total_modules,
                 pass_percentage, award_classification, reason, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Proposed')
        `, [student.student_id, student.program_id, passedModules, totalModules,
            passPct, classification, reason || null]);

        // Mark the student as deceased/withdrawn
        await db.query(
            `UPDATE Student SET status = 'Withdrawn', academic_standing = 'Dismissed' WHERE student_id = ?`,
            [student.student_id]
        );

        res.json({
            message: 'Posthumous award proposed',
            awardId: result.insertId,
            student: { student_number: studentNumber, name: student.full_name },
            classification,
            pass_percentage: parseFloat(passPct.toFixed(2)),
            note: 'Rule §13.2 — Must be approved by Senate.'
        });
    } catch (err) {
        console.error('Propose posthumous error:', err);
        res.status(500).json({ error: err.message });
    }
});

// List posthumous awards
app.get('/api/admin/posthumous-awards', authenticate, requireLeadership, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                pa.award_id, pa.modules_passed, pa.total_modules, pa.pass_percentage,
                pa.award_classification, pa.reason, pa.status,
                pa.proposed_at, pa.decided_at, pa.decision_remarks,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                p.code AS program_code, p.name AS program_name,
                CONCAT(u.username) AS decided_by_name
            FROM PosthumousAward pa
            JOIN Student s ON pa.student_id = s.student_id
            JOIN Program p ON pa.program_id = p.program_id
            LEFT JOIN User u ON pa.decided_by_user_id = u.user_id
            ORDER BY pa.status = 'Proposed' DESC, pa.proposed_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('List posthumous error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Decide posthumous award
app.put('/api/admin/decide-posthumous', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { awardId, decision, remarks } = req.body;

        if (!awardId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing awardId' });
        }
        if (!['Senate_Approved', 'Granted', 'Rejected'].includes(decision)) {
            await conn.rollback();
            return res.status(400).json({ message: 'decision must be Senate_Approved, Granted, or Rejected' });
        }

        const [rows] = await conn.query(
            `SELECT pa.award_id, pa.student_id, pa.award_classification, pa.status,
                    (SELECT cgpa FROM vw_student_cumulative WHERE student_id = pa.student_id) AS cgpa
             FROM PosthumousAward pa
             WHERE pa.award_id = ?`,
            [awardId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Award not found' });
        }
        const award = rows[0];

        await conn.query(`
            UPDATE PosthumousAward
            SET status = ?, decided_by_user_id = ?, decided_at = NOW(), decision_remarks = ?
            WHERE award_id = ?
        `, [decision, userId, remarks || null, awardId]);

        // If granted → write classification + CGPA to Student record
        if (decision === 'Granted') {
            const cgpa = award.cgpa !== null ? parseFloat(award.cgpa) : 0;
            await conn.query(`
                UPDATE Student
                SET status = 'Graduated',
                    academic_standing = 'Good Standing',
                    current_cgpa = ?
                WHERE student_id = ?
            `, [cgpa, award.student_id]);
        }

        await conn.commit();

        res.json({
            message: `Posthumous award ${decision.toLowerCase().replace('_', ' ')}`,
            awardId,
            new_status: decision,
            award_classification: award.award_classification,
            student_record_updated: decision === 'Granted',
            note: decision === 'Granted'
                ? `Student record marked as Graduated with classification: ${award.award_classification}`
                : null
        });
    } catch (err) {
        await conn.rollback();
        console.error('Decide posthumous error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// EXIT AWARDS — PDF §9.6 / §12.3 / §12.4
// ============================================

// Admin proposes an exit award
// §12.3 — Certificate requires 120 credits FROM Semesters 1 & 2 only
// §12.4 — Diploma requires 360 credits FROM Semesters 1–4
app.post('/api/admin/propose-exit-award', authenticate, requireLeadership, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { studentNumber, exitType, reason } = req.body;

        if (!studentNumber || !exitType) {
            return res.status(400).json({ message: 'Missing studentNumber or exitType' });
        }
        if (!['Certificate', 'Diploma'].includes(exitType)) {
            return res.status(400).json({ message: 'exitType must be Certificate or Diploma' });
        }

        const [students] = await db.query(
            `SELECT s.student_id, s.current_year_of_study,
                    CONCAT(s.first_name, ' ', s.last_name) AS full_name
             FROM Student s
             WHERE s.student_number = ?`,
            [studentNumber]
        );
        if (students.length === 0) return res.status(404).json({ message: 'Student not found' });
        const student = students[0];

        // Count credits from relevant semesters only
        // §12.3 — Certificate: only Sem 1 & 2 (Year 1)
        // §12.4 — Diploma: Sem 1–4 (Years 1 & 2)
        const maxYearOfStudy = exitType === 'Certificate' ? 1 : 2;

        const [creditResult] = await db.query(`
            SELECT COALESCE(SUM(vmr.credits), 0) AS credits_earned
            FROM vw_student_module_results vmr
            JOIN Curriculum c ON c.module_id = vmr.module_id
            JOIN Student s ON s.student_id = vmr.student_id
            WHERE vmr.student_number = ?
              AND c.program_id = s.program_id
              AND c.year_of_study <= ?
              AND vmr.final_grade_points >= 2.00
        `, [studentNumber, maxYearOfStudy]);

        const credits = parseInt(creditResult[0].credits_earned) || 0;

        const requiredCredits = exitType === 'Certificate' ? 120 : 360;

        if (credits < requiredCredits) {
            return res.status(400).json({
                message: `Rule §12.${exitType === 'Certificate' ? '3' : '4'} — ${exitType} requires ${requiredCredits} credits from Year${maxYearOfStudy > 1 ? 's 1–' + maxYearOfStudy : ' 1'}. Student has ${credits}.`
            });
        }

        const [existing] = await db.query(
            `SELECT exit_id FROM ExitAward 
             WHERE student_id = ? AND status IN ('Proposed','Approved')`,
            [student.student_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'An exit award is already proposed or approved for this student.' });
        }

        const [result] = await db.query(`
            INSERT INTO ExitAward
                (student_id, exit_type, credits_achieved, award_date, reason, status)
            VALUES (?, ?, ?, CURDATE(), ?, 'Proposed')
        `, [student.student_id, exitType, credits, reason || null]);

        res.json({
            message: 'Exit award proposed',
            exitId: result.insertId,
            student: { student_number: studentNumber, name: student.full_name },
            exit_type: exitType,
            credits_achieved: credits,
            required_credits: requiredCredits,
            note: `§12.${exitType === 'Certificate' ? '3' : '4'} — Only credits from Semester${maxYearOfStudy > 1 ? 's 1–' + (maxYearOfStudy * 2) : 's 1 & 2'} counted.`
        });
    } catch (err) {
        console.error('Propose exit award error:', err);
        res.status(500).json({ error: err.message });
    }
});

// List exit awards
app.get('/api/admin/exit-awards', authenticate, requireLeadership, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                ea.exit_id, ea.exit_type, ea.credits_achieved, ea.award_date,
                ea.reason, ea.status, ea.proposed_at, ea.decided_at, ea.decision_remarks,
                s.student_number,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.current_year_of_study,
                CONCAT(u.username) AS decided_by_name
            FROM ExitAward ea
            JOIN Student s ON ea.student_id = s.student_id
            LEFT JOIN User u ON ea.decided_by_user_id = u.user_id
            ORDER BY ea.status = 'Proposed' DESC, ea.proposed_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('List exit awards error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Decide exit award
app.put('/api/admin/decide-exit-award', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const userId = req.user.userId;
        const { exitId, decision, remarks } = req.body;

        if (!exitId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing exitId' });
        }
        if (!['Approved', 'Rejected'].includes(decision)) {
            await conn.rollback();
            return res.status(400).json({ message: 'decision must be Approved or Rejected' });
        }

        const [rows] = await conn.query(
            'SELECT exit_id, student_id, status FROM ExitAward WHERE exit_id = ?',
            [exitId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Exit award not found' });
        }
        const award = rows[0];

        if (award.status !== 'Proposed') {
            await conn.rollback();
            return res.status(400).json({ message: `Already processed (status: ${award.status})` });
        }

        await conn.query(`
            UPDATE ExitAward
            SET status = ?, decided_by_user_id = ?, decided_at = NOW(), decision_remarks = ?
            WHERE exit_id = ?
        `, [decision, userId, remarks || null, exitId]);

        // If approved → mark student as Graduated
        if (decision === 'Approved') {
            await conn.query(
                `UPDATE Student SET status = 'Graduated' WHERE student_id = ?`,
                [award.student_id]
            );
        }

        await conn.commit();

        res.json({
            message: `Exit award ${decision.toLowerCase()}`,
            exitId,
            new_status: decision
        });
    } catch (err) {
        await conn.rollback();
        console.error('Decide exit award error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// CRUD: ACTIVATE SEMESTER 2 (mid-year)
// ============================================
app.post('/api/admin/activate-semester-2', authenticate, allowRoles('Admin', 'VC'), async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Find current active year + semester
        const [current] = await conn.query(`
            SELECT ay.academic_year_id, ay.year_name,
                   sem.semester_id AS active_sem_id, sem.name AS active_sem_name
            FROM AcademicYear ay
            JOIN Semester sem ON sem.academic_year_id = ay.academic_year_id
            WHERE ay.is_current = TRUE AND sem.is_active = TRUE
            LIMIT 1
        `);

        if (current.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'No active academic year/semester found.' });
        }

        const cur = current[0];

        // 2. Must currently be on Semester 1
        if (cur.active_sem_name !== 'Semester 1') {
            await conn.rollback();
            return res.status(400).json({
                message: `Cannot activate Semester 2 — currently on '${cur.active_sem_name}'.`
            });
        }

        // 3. Find Semester 2 of the same year
        const [sem2] = await conn.query(
            `SELECT semester_id FROM Semester 
             WHERE academic_year_id = ? AND name = 'Semester 2'`,
            [cur.academic_year_id]
        );
        if (sem2.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Semester 2 not found for current year.' });
        }
        const sem2Id = sem2[0].semester_id;

        // 4. Mark all Semester 1 enrollments as Completed
        const [completed] = await conn.query(`
            UPDATE Enrollment 
            SET status = 'Completed'
            WHERE status = 'Enrolled'
              AND offering_id IN (
                  SELECT offering_id FROM ModuleOffering WHERE semester_id = ?
              )
        `, [cur.active_sem_id]);

        // 5. Swap active flags
        await conn.query(
            'UPDATE Semester SET is_active = FALSE WHERE semester_id = ?',
            [cur.active_sem_id]
        );
        await conn.query(
            'UPDATE Semester SET is_active = TRUE WHERE semester_id = ?',
            [sem2Id]
        );

        // 6. Auto-enroll active students in their Semester 2 offerings
        const [students] = await conn.query(`
            SELECT student_id, student_number, program_id, current_year_of_study
            FROM Student
            WHERE status = 'Active'
        `);

        let enrolledCount = 0;
        const skippedStudents = [];

        for (const stu of students) {
            // Skip students with unresolved obligations
            const [refs] = await conn.query(
                `SELECT referral_id FROM Referral WHERE student_id = ? AND status = 'Pending' LIMIT 1`,
                [stu.student_id]
            );
            const [cos] = await conn.query(
                `SELECT carryover_id FROM Carryover WHERE student_id = ? AND status = 'Pending' LIMIT 1`,
                [stu.student_id]
            );
            const [reps] = await conn.query(
                `SELECT repeat_id FROM RepeatModule WHERE student_id = ? AND status = 'Enrolled' LIMIT 1`,
                [stu.student_id]
            );

            const obligations = [];
            if (refs.length > 0) obligations.push('pending Referral');
            if (cos.length > 0)  obligations.push('pending Carryover');
            if (reps.length > 0) obligations.push('active Repeat');

            if (obligations.length > 0) {
                skippedStudents.push({
                    student_number: stu.student_number,
                    reason: obligations.join(', ')
                });
                continue;
            }

            // Enroll in Semester 2 offerings for current year of study
            const [offerings] = await conn.query(`
                SELECT mo.offering_id
                FROM Curriculum c
                JOIN ModuleOffering mo ON mo.module_id = c.module_id
                WHERE c.program_id = ?
                  AND c.year_of_study = ?
                  AND c.semester = 2
                  AND mo.semester_id = ?
            `, [stu.program_id, stu.current_year_of_study, sem2Id]);

            for (const off of offerings) {
                try {
                    const [r] = await conn.query(
                        `INSERT IGNORE INTO Enrollment 
                         (student_id, offering_id, enrollment_date, status)
                         VALUES (?, ?, CURDATE(), 'Enrolled')`,
                        [stu.student_id, off.offering_id]
                    );
                    if (r.affectedRows > 0) {
                        await conn.query(
                            'UPDATE ModuleOffering SET current_enrollment = current_enrollment + 1 WHERE offering_id = ?',
                            [off.offering_id]
                        );
                        enrolledCount++;
                    }
                } catch (e) { /* ignore dup */ }
            }
        }

        await conn.commit();

        res.json({
            message: `Semester 2 activated for ${cur.year_name}`,
            yearName: cur.year_name,
            previousSemester: 'Semester 1',
            activeSemester: 'Semester 2',
            enrollmentsCompleted: completed.affectedRows,
            studentsEnrolled: enrolledCount,
            skippedStudents: skippedStudents.length,
            blockedStudents: skippedStudents,
            note: 'Students with pending referrals, carryovers, or active repeats were NOT enrolled.'
        });

    } catch (err) {
        await conn.rollback();
        console.error('Activate semester 2 error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// ============================================
// AUDITED MODULES — PDF §4.7
// ============================================

// Admin marks an enrollment as Audited
app.put('/api/admin/mark-audited', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { enrollmentId } = req.body;
        if (!enrollmentId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing enrollmentId' });
        }

        const [rows] = await conn.query(
            `SELECT e.enrollment_id, e.student_id, e.status, e.offering_id,
                    s.student_number, m.code AS module_code
             FROM Enrollment e
             JOIN Student s ON e.student_id = s.student_id
             JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
             JOIN Module m ON mo.module_id = m.module_id
             WHERE e.enrollment_id = ?`,
            [enrollmentId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Enrollment not found' });
        }
        const e = rows[0];

        if (e.status === 'Audit') {
            await conn.rollback();
            return res.status(400).json({ message: 'Already marked as Audited.' });
        }

        await conn.query(
            `UPDATE Enrollment SET status = 'Audit' WHERE enrollment_id = ?`,
            [enrollmentId]
        );

        await conn.commit();

        res.json({
            message: `Marked as Audited: ${e.module_code}`,
            enrollmentId,
            student_number: e.student_number,
            note: '§4.7.3 — Audit grades appear on transcript but earn no credits toward award.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Mark audited error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Admin converts an Audited enrollment back to regular Enrolled
app.put('/api/admin/unmark-audited', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { enrollmentId } = req.body;
        if (!enrollmentId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing enrollmentId' });
        }

        const [rows] = await conn.query(
            'SELECT enrollment_id, status FROM Enrollment WHERE enrollment_id = ?',
            [enrollmentId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Enrollment not found' });
        }
        if (rows[0].status !== 'Audit') {
            await conn.rollback();
            return res.status(400).json({ message: 'Enrollment is not marked as Audit.' });
        }

        await conn.query(
            `UPDATE Enrollment SET status = 'Enrolled' WHERE enrollment_id = ?`,
            [enrollmentId]
        );

        await conn.commit();
        res.json({ message: 'Audited status removed', enrollmentId });
    } catch (err) {
        await conn.rollback();
        console.error('Unmark audited error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Admin lists a student's enrollments with audit status
app.get('/api/admin/student-enrollments', authenticate, requireLeadership, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [rows] = await db.query(`
            SELECT 
                e.enrollment_id,
                e.status AS enrollment_status,
                e.enrollment_date,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                sem.name AS semester_name,
                ay.year_name,
                mo.offering_id
            FROM Enrollment e
            JOIN Student s ON e.student_id = s.student_id
            JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            WHERE s.student_number = ?
            ORDER BY ay.year_name DESC, sem.name DESC, m.code
        `, [studentNumber]);
        res.json(rows);
    } catch (err) {
        console.error('Student enrollments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// AUDITED MODULES — PDF §4.7
// ============================================

// Admin marks an enrollment as Audited
app.put('/api/admin/mark-audited', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { enrollmentId } = req.body;
        if (!enrollmentId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing enrollmentId' });
        }

        const [rows] = await conn.query(
            `SELECT e.enrollment_id, e.student_id, e.status, e.offering_id,
                    s.student_number, m.code AS module_code
             FROM Enrollment e
             JOIN Student s ON e.student_id = s.student_id
             JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
             JOIN Module m ON mo.module_id = m.module_id
             WHERE e.enrollment_id = ?`,
            [enrollmentId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Enrollment not found' });
        }
        const e = rows[0];

        if (e.status === 'Audit') {
            await conn.rollback();
            return res.status(400).json({ message: 'Already marked as Audited.' });
        }

        await conn.query(
            `UPDATE Enrollment SET status = 'Audit' WHERE enrollment_id = ?`,
            [enrollmentId]
        );

        await conn.commit();

        res.json({
            message: `Marked as Audited: ${e.module_code}`,
            enrollmentId,
            student_number: e.student_number,
            note: '§4.7.3 — Audit grades appear on transcript but earn no credits toward award.'
        });
    } catch (err) {
        await conn.rollback();
        console.error('Mark audited error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Admin removes Audit status
app.put('/api/admin/unmark-audited', authenticate, requireLeadership, async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { enrollmentId } = req.body;
        if (!enrollmentId) {
            await conn.rollback();
            return res.status(400).json({ message: 'Missing enrollmentId' });
        }

        const [rows] = await conn.query(
            'SELECT enrollment_id, status FROM Enrollment WHERE enrollment_id = ?',
            [enrollmentId]
        );
        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Enrollment not found' });
        }
        if (rows[0].status !== 'Audit') {
            await conn.rollback();
            return res.status(400).json({ message: 'Enrollment is not marked as Audit.' });
        }

        await conn.query(
            `UPDATE Enrollment SET status = 'Enrolled' WHERE enrollment_id = ?`,
            [enrollmentId]
        );

        await conn.commit();
        res.json({ message: 'Audited status removed', enrollmentId });
    } catch (err) {
        await conn.rollback();
        console.error('Unmark audited error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Admin lists a student's enrollments with audit status
app.get('/api/admin/student-enrollments', authenticate, requireLeadership, async (req, res) => {
    try {
        const { studentNumber } = req.query;
        if (!studentNumber) return res.status(400).json({ message: 'Missing studentNumber' });

        const [rows] = await db.query(`
            SELECT 
                e.enrollment_id,
                e.status AS enrollment_status,
                e.enrollment_date,
                m.code AS module_code,
                m.name AS module_name,
                m.credits,
                sem.name AS semester_name,
                ay.year_name,
                mo.offering_id
            FROM Enrollment e
            JOIN Student s ON e.student_id = s.student_id
            JOIN ModuleOffering mo ON e.offering_id = mo.offering_id
            JOIN Module m ON mo.module_id = m.module_id
            JOIN Semester sem ON mo.semester_id = sem.semester_id
            JOIN AcademicYear ay ON sem.academic_year_id = ay.academic_year_id
            WHERE s.student_number = ?
            ORDER BY ay.year_name DESC, sem.name DESC, m.code
        `, [studentNumber]);
        res.json(rows);
    } catch (err) {
        console.error('Student enrollments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// NOTIFICATIONS
// ============================================

// Get current user's notifications
app.get('/api/notifications', authenticate, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT notification_id, category, title, message, link, is_read, created_at
            FROM Notification
            WHERE user_id = ?
            ORDER BY is_read ASC, created_at DESC
            LIMIT 100
        `, [req.user.userId]);

        const [countResult] = await db.query(
            'SELECT COUNT(*) AS unread FROM Notification WHERE user_id = ? AND is_read = FALSE',
            [req.user.userId]
        );

        res.json({
            notifications: rows,
            unread_count: countResult[0].unread
        });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Mark one as read
app.put('/api/notifications/read', authenticate, async (req, res) => {
    try {
        const { notificationId } = req.body;
        if (!notificationId) return res.status(400).json({ message: 'Missing notificationId' });

        await db.query(
            `UPDATE Notification SET is_read = TRUE, read_at = NOW()
             WHERE notification_id = ? AND user_id = ?`,
            [notificationId, req.user.userId]
        );

        res.json({ message: 'Marked as read' });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Mark all as read
app.put('/api/notifications/read-all', authenticate, async (req, res) => {
    try {
        await db.query(
            `UPDATE Notification SET is_read = TRUE, read_at = NOW()
             WHERE user_id = ? AND is_read = FALSE`,
            [req.user.userId]
        );
        res.json({ message: 'All marked as read' });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Internal helper — creates a notification for a single user
async function notifyUser(userId, category, title, message, link) {
    try {
        await db.query(
            `INSERT INTO Notification (user_id, category, title, message, link)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, category, title, message || null, link || null]
        );
    } catch (e) {
        console.error('notifyUser error:', e);
    }
}

// ============================================
// 404 FALLBACK — MUST BE THE LAST ROUTE BEFORE app.listen
// ============================================
app.use((req, res) => {
    // API routes get JSON; page routes get the styled 404 page
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API route not found' });
    }
    res.status(404).sendFile(path.join(__dirname, '..', 'frontend', '404.html'));
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('    MUBAS ASSESSMENT SYSTEM - BACKEND');
    console.log('═══════════════════════════════════════════════');
    console.log(`   Server:  http://localhost:${PORT}`);
    console.log(`   Login:   http://localhost:${PORT}/index.html`);
    console.log(`   Test:    http://localhost:${PORT}/api/test`);
    console.log('═══════════════════════════════════════════════');
    console.log('');
});