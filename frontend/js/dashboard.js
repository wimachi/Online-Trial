// ============================================
// MUBAS ASSESSMENT SYSTEM - STUDENT DASHBOARD
// ============================================

let profileData = null;
let currentModulesData = [];
let currentModuleDetails = [];
let historyData = { semesters: [], years: [] };
let summaryData = null;
let progressData = null;
let allAssessments = [];
let assessmentMatrix = [];

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    await Promise.all([
        loadProfile(),
        loadCurrentModules(),
        loadHistory(),
        loadSummary(),
        loadProgress(),
        loadAllAssessments(),
        loadAssessmentMatrix()
    ]);
    renderEverything();
});

// ============================================
// NAVIGATION
// ============================================
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

function showPage(page) {
    document.querySelectorAll('[id^="page-"]').forEach(el => el.style.display = 'none');
    const target = document.getElementById(`page-${page}`);
    if (target) target.style.display = 'block';
    document.querySelectorAll('.nav-links li').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.page === page) el.classList.add('active');
    });

    if (page === 'transcript') renderTranscript();
    if (page === 'assessments') renderAllAssessments();
    if (page === 'modules') renderCurrentModuleDetails();
}

// ============================================
// LOADERS
// ============================================
async function loadProfile() {
    try {
        const r = await apiRequest('/students/profile?studentNumber=' + encodeURIComponent(getStudentNumber()));
        if (r.ok) profileData = await r.json();
    } catch (e) { console.error('Profile error:', e); }
}

async function loadCurrentModules() {
    try {
        const r = await apiRequest('/students/current-module-details?studentNumber=' + encodeURIComponent(getStudentNumber()));
        if (r.ok) currentModuleDetails = await r.json();
    } catch (e) { console.error('Modules error:', e); }
}

async function loadHistory() {
    try {
        const r = await apiRequest('/students/history?studentNumber=' + encodeURIComponent(getStudentNumber()));
        if (r.ok) historyData = await r.json();
    } catch (e) { console.error('History error:', e); }
}

async function loadSummary() {
    try {
        const r = await apiRequest('/students/summary?studentNumber=' + encodeURIComponent(getStudentNumber()));
        if (r.ok) summaryData = await r.json();
    } catch (e) { console.error('Summary error:', e); }
}

async function loadProgress() {
    try {
        const r = await apiRequest('/students/progress?studentNumber=' + encodeURIComponent(getStudentNumber()));
        if (r.ok) progressData = await r.json();
    } catch (e) { console.error('Progress error:', e); }
}

async function loadAllAssessments() {
    try {
        const r = await apiRequest('/students/assessments?studentNumber=' + encodeURIComponent(getStudentNumber()));
        if (r.ok) allAssessments = await r.json();
    } catch (e) { console.error('Assessments error:', e); }
}

async function loadAssessmentMatrix() {
    try {
        const r = await apiRequest('/students/assessment-matrix?studentNumber=' + encodeURIComponent(getStudentNumber()));
        if (r.ok) assessmentMatrix = await r.json();
    } catch (e) { console.error('Matrix error:', e); }
}

// ============================================
// RENDER MAIN
// ============================================
function renderEverything() {
    renderHeader();
    renderProfileBanner();
    renderPositionCards();
    renderAcademicStanding();
    renderProgressTracker();
    renderCurrentModules();
    renderSemesterHistory();
    renderFullHistory();
    renderCumulativeSummary();
    renderGPATrendChart();
}

function renderHeader() {
    if (!profileData) return;
    document.getElementById('userName').textContent = `Welcome, ${profileData.full_name}`;
    document.getElementById('studentId').textContent = `| ${profileData.student_number}`;
    const initials = (profileData.first_name?.[0] || '') + (profileData.last_name?.[0] || '');
    document.getElementById('avatar').textContent = initials || 'ST';
    document.getElementById('displayName').textContent = profileData.full_name;
    document.getElementById('displayProgram').textContent = profileData.program_code;
}

function renderProfileBanner() {
    if (!profileData) return;
    document.getElementById('banner-program').textContent = profileData.program_name;
    document.getElementById('banner-dept').textContent = profileData.department_name;
    document.getElementById('banner-school').textContent = profileData.school_name;
}

function renderPositionCards() {
    if (!profileData) return;
    document.getElementById('yearPosition').textContent = profileData.current_year_of_study;
    document.getElementById('yearLabel').textContent = profileData.year_position;
    document.getElementById('semesterPosition').textContent = profileData.current_semester;
    document.getElementById('semesterLabel').textContent = profileData.semester_position;
}

// ============================================
// RENDER ACADEMIC STANDING
// ============================================
function renderAcademicStanding() {
    if (!profileData) return;

    const standing = profileData.academic_standing || 'Good Standing';
    const valEl = document.getElementById('standingValue');
    const labelEl = document.getElementById('standingLabel');
    if (!valEl || !labelEl) return;

    // Set colors + descriptive labels based on standing
    let color = '#28a745'; // green
    let description = 'Meeting all academic requirements';

    if (standing === 'Academic Probation') {
        color = '#ffc107'; // yellow
        description = 'sGPA below 2.00 this semester';
    } else if (standing === 'Suspended') {
        color = '#fd7e14'; // orange
        description = 'sGPA below 2.00 for 2 semesters';
    } else if (standing === 'Dismissed') {
        color = '#dc3545'; // red
        description = 'Withdrawn for academic reasons';
    }

    valEl.textContent = standing;
    valEl.style.color = color;
    labelEl.textContent = description;
}

function renderProgressTracker() {
    if (!progressData) return;
    const total = progressData.total_credits_required;
    const earned = progressData.credits_earned;
    const pct = total > 0 ? Math.round((earned / total) * 100) : 0;

    const container = document.getElementById('progressTracker');
    if (!container) return;

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="font-size:14px;color:#666;">Program Progress</span>
            <span style="font-size:14px;font-weight:700;color:#003366;">${earned} / ${total} credits (${pct}%)</span>
        </div>
        <div style="background:#e0e7f0;height:14px;border-radius:7px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#003366,#0066cc);transition:width 0.5s;"></div>
        </div>
        <div style="display:flex;gap:25px;margin-top:15px;font-size:13px;color:#666;">
            <span>📚 <strong>${progressData.modules_completed}</strong> modules completed</span>
            <span>📖 <strong>${progressData.modules_registered}</strong> modules registered</span>
        </div>
    `;
}

function renderCurrentModules() {
    const tbody = document.getElementById('currentModulesBody');
    if (!tbody) return;
    if (!currentModuleDetails || currentModuleDetails.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888;">No current modules</td></tr>`;
        return;
    }

    let html = '';
    currentModuleDetails.forEach(m => {
        html += `
            <tr>
                <td><strong>${m.module_code}</strong></td>
                <td>${m.module_name}</td>
                <td>${m.credits}</td>
                <td>${m.lecturer_name || '-'}</td>
                <td style="font-size:12px;color:#666;">${m.schedule || '-'}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function renderSemesterHistory() {
    const tbody = document.getElementById('semesterHistoryBody');
    if (!tbody) return;
    if (!historyData.semesters || historyData.semesters.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#888;">No history</td></tr>`;
        return;
    }

    let html = '';
    historyData.semesters.forEach(s => {
        const gpa = s.semester_gpa !== null ? parseFloat(s.semester_gpa).toFixed(2) : '-';
        const cls = s.semester_classification || '-';
        const clsColor = getClassColor(cls);
        const gpaColor = getGpaColor(parseFloat(s.semester_gpa));
        html += `
            <tr>
                <td>${s.semester_number}</td>
                <td>${s.year_name}</td>
                <td>${s.semester_name}</td>
                <td>${s.module_count}</td>
                <td>${s.total_credits}</td>
                <td style="font-weight:700;color:${gpaColor};">${gpa}</td>
                <td><span style="color:${clsColor};font-weight:600;">${cls}</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function renderFullHistory() {
    const tbody = document.getElementById('historySemesterBody');
    if (tbody) {
        if (!historyData.semesters || historyData.semesters.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#888;">No history</td></tr>`;
        } else {
            let html = '';
            historyData.semesters.forEach(s => {
                const gpa = s.semester_gpa !== null ? parseFloat(s.semester_gpa).toFixed(2) : '-';
                const cls = s.semester_classification || '-';
                const clsColor = getClassColor(cls);
                const gpaColor = getGpaColor(parseFloat(s.semester_gpa));
                html += `
                    <tr>
                        <td>${s.semester_number}</td>
                        <td>${s.year_name}</td>
                        <td>${s.semester_name}</td>
                        <td>${s.module_count}</td>
                        <td>${s.total_credits}</td>
                        <td style="font-weight:700;color:${gpaColor};">${gpa}</td>
                        <td><span style="color:${clsColor};font-weight:600;">${cls}</span></td>
                    </tr>
                `;
            });
            tbody.innerHTML = html;
        }
    }

    const yearTbody = document.getElementById('historyYearBody');
    if (yearTbody) {
        if (!historyData.years || historyData.years.length === 0) {
            yearTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#888;">No year data</td></tr>`;
        } else {
            let html = '';
            historyData.years.forEach(y => {
                const gpa = y.year_gpa !== null ? parseFloat(y.year_gpa).toFixed(2) : '-';
                const gpaColor = getGpaColor(parseFloat(y.year_gpa));
                html += `
                    <tr>
                        <td><strong>${y.year_name}</strong></td>
                        <td>${y.semester_count}</td>
                        <td>${y.total_modules}</td>
                        <td>${y.total_credits}</td>
                        <td style="font-weight:700;color:${gpaColor};">${gpa}</td>
                    </tr>
                `;
            });
            yearTbody.innerHTML = html;
        }
    }
}

function renderCumulativeSummary() {
    if (!summaryData) return;

    const cgpa = parseFloat(summaryData.cgpa) || 0;
    const cgpaEl = document.getElementById('cgpaValue');
    if (cgpaEl) {
        cgpaEl.textContent = cgpa.toFixed(2);
        cgpaEl.className = 'value ' + getGpaClass(cgpa);
    }
    const cgpaLabel = document.getElementById('cgpaLabel');
    if (cgpaLabel) {
        cgpaLabel.textContent = `${summaryData.completed_semesters} semesters · ${summaryData.total_credits} credits`;
    }

    const clsEl = document.getElementById('classificationValue');
    if (clsEl) {
        clsEl.textContent = summaryData.classification;
        clsEl.style.color = getClassColor(summaryData.classification);
        clsEl.style.fontSize = '20px';
    }

    const cumSem = document.getElementById('cumSemesters');
    if (cumSem) cumSem.textContent = summaryData.completed_semesters;
    const cumCred = document.getElementById('cumCredits');
    if (cumCred) cumCred.textContent = summaryData.total_credits;
    const cumGpa = document.getElementById('cumGpa');
    if (cumGpa) cumGpa.textContent = cgpa.toFixed(2);
    const cumCls = document.getElementById('cumClassification');
    if (cumCls) {
        cumCls.textContent = summaryData.classification;
        cumCls.style.color = getClassColor(summaryData.classification);
    }
}

// ============================================
// MY MODULES (card-based)
// ============================================
function renderCurrentModuleDetails() {
    const container = document.getElementById('moduleDetailsContainer');
    if (!container) return;

    if (!currentModuleDetails || currentModuleDetails.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">No current modules</div>';
        return;
    }

    let html = '';
    currentModuleDetails.forEach(m => {
        html += `
            <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:15px;">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#003366;">${m.module_code} — ${m.module_name}</div>
                        <div style="font-size:13px;color:#888;margin-top:3px;">${m.credits} credits</div>
                    </div>
                    <div style="font-size:12px;color:#888;background:#f0f4f8;padding:5px 12px;border-radius:20px;">
                        ${m.graded_count || 0} / ${m.assessment_count || 0} graded
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;font-size:13px;color:#666;margin-top:15px;padding-top:15px;border-top:1px solid #eee;">
                    <div>
                        <strong style="color:#333;">👨‍🏫 Lecturer:</strong> ${m.lecturer_name || 'TBA'}<br>
                        <span style="font-size:12px;">${m.lecturer_email || ''}</span>
                    </div>
                    <div>
                        <strong style="color:#333;">📍 Room:</strong> ${m.room || 'TBA'}<br>
                        <strong style="color:#333;">🕐 Schedule:</strong> ${m.schedule || 'TBA'}
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================
// ALL ASSESSMENTS (PIVOT: modules as rows, assessments as columns)
// ============================================
function renderAllAssessments() {
    const container = document.getElementById('assessmentsGroupedContainer');
    if (!container) {
        console.warn('assessmentsGroupedContainer not found');
        return;
    }

    if (!assessmentMatrix || assessmentMatrix.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;color:#888;padding:40px;">
                <div style="font-size:48px;margin-bottom:12px;">📭</div>
                <div style="font-weight:600;color:#475569;">No assessments yet</div>
                <div style="font-size:13px;margin-top:5px;">Once your grades are entered, they'll appear here.</div>
            </div>
        `;
        return;
    }

    // Group by year + semester
    const grouped = {};
    assessmentMatrix.forEach(m => {
        const key = `${m.year_name}||${m.semester_name}`;
        if (!grouped[key]) {
            grouped[key] = {
                year_name: m.year_name,
                semester_name: m.semester_name,
                semester_number: m.semester_number || 0,
                modules: []
            };
        }
        grouped[key].modules.push(m);
    });

    const groups = Object.values(grouped)
        .sort((a, b) => (b.semester_number || 0) - (a.semester_number || 0));

    let html = '';
    groups.forEach(g => {
        const totalModules = g.modules.length;
        const anyProvisional = g.modules.some(m =>
            m.approval_status !== 'Released' &&
            (m.quiz_pct !== null || m.assignment_pct !== null || m.exam_pct !== null)
        );
        const allReleased = g.modules.every(m => m.approval_status === 'Released');

        const badge = allReleased
            ? '<span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">RELEASED</span>'
            : (anyProvisional
                ? '<span style="background:#fef3c7;color:#854d0e;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">PROVISIONAL</span>'
                : '<span style="background:#e2e8f0;color:#64748b;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">IN PROGRESS</span>');

        html += `
            <div class="table-container" style="margin-bottom:20px;">
                <div class="table-header">
                    <div>
                        <h3 style="margin:0;">${g.year_name} · ${g.semester_name}</h3>
                        <span style="font-size:12px;color:#888;">${totalModules} module(s)</span>
                    </div>
                    ${badge}
                </div>
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th>Module</th>
                                <th>Module Name</th>
                                <th style="text-align:center;">Quiz (20%)</th>
                                <th style="text-align:center;">Assignment (30%)</th>
                                <th style="text-align:center;">Final Exam (50%)</th>
                                <th style="text-align:center;">Final %</th>
                                <th style="text-align:center;">Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${g.modules.map(m => {
                                const quizCell = (m.quiz_pct !== null && m.quiz_pct !== undefined)
                                    ? `<strong>${parseFloat(m.quiz_pct).toFixed(1)}%</strong><br><span style="font-size:11px;color:#888;">${m.quiz_score}/${m.quiz_max}</span>`
                                    : '<span style="color:#cbd5e1;">—</span>';
                                const asgCell = (m.assignment_pct !== null && m.assignment_pct !== undefined)
                                    ? `<strong>${parseFloat(m.assignment_pct).toFixed(1)}%</strong><br><span style="font-size:11px;color:#888;">${m.assignment_score}/${m.assignment_max}</span>`
                                    : '<span style="color:#cbd5e1;">—</span>';
                                const examCell = (m.exam_pct !== null && m.exam_pct !== undefined)
                                    ? `<strong>${parseFloat(m.exam_pct).toFixed(1)}%</strong><br><span style="font-size:11px;color:#888;">${m.exam_score}/${m.exam_max}</span>`
                                    : '<span style="color:#cbd5e1;">—</span>';
                                const finalPct = (m.final_pct !== null && m.final_pct !== undefined)
                                    ? parseFloat(m.final_pct).toFixed(1) + '%'
                                    : '<span style="color:#cbd5e1;">—</span>';
                                const gradeCell = m.final_grade
                                    ? `<span class="grade-badge ${getGradeClass(m.final_grade)}">${m.final_grade}</span>`
                                    : '<span style="color:#cbd5e1;">—</span>';

                                return `
                                    <tr>
                                        <td><strong>${m.module_code}</strong></td>
                                        <td>${m.module_name}</td>
                                        <td style="text-align:center;">${quizCell}</td>
                                        <td style="text-align:center;">${asgCell}</td>
                                        <td style="text-align:center;">${examCell}</td>
                                        <td style="text-align:center;"><strong>${finalPct}</strong></td>
                                        <td style="text-align:center;">${gradeCell}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================
// TRANSCRIPT
// ============================================
function renderTranscript() {
    const container = document.getElementById('transcriptContent');
    if (!container) return;

    if (!profileData || !summaryData || !historyData) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#888;">Loading transcript...</div>';
        return;
    }

    const cgpa = parseFloat(summaryData.cgpa) || 0;
    const totalCredits = summaryData.total_credits || 0;

    let cls = summaryData.classification;
    let clsColor = getClassColor(cls);

    let html = `
        <div style="background:white;padding:40px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            <div style="text-align:center;border-bottom:2px solid #003366;padding-bottom:20px;margin-bottom:30px;">
                <h2 style="color:#003366;margin-bottom:5px;">MALAWI UNIVERSITY OF BUSINESS AND APPLIED SCIENCES</h2>
                <h3 style="color:#333;">OFFICIAL ACADEMIC TRANSCRIPT</h3>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:30px;font-size:14px;">
                <div><strong>Student Name:</strong> ${profileData.full_name}</div>
                <div><strong>Student Number:</strong> ${profileData.student_number}</div>
                <div><strong>Programme:</strong> ${profileData.program_name}</div>
                <div><strong>Department:</strong> ${profileData.department_name}</div>
                <div><strong>School:</strong> ${profileData.school_name}</div>
                <div><strong>Status:</strong> ${profileData.student_status}</div>
            </div>

            <h3 style="color:#003366;margin-bottom:15px;font-size:16px;">Semester Records</h3>
            <table style="width:100%;border-collapse:collapse;margin-bottom:30px;">
                <thead>
                    <tr style="background:#003366;color:white;">
                        <th style="padding:10px;text-align:left;">Semester</th>
                        <th style="padding:10px;text-align:left;">Academic Year</th>
                        <th style="padding:10px;">Modules</th>
                        <th style="padding:10px;">Credits</th>
                        <th style="padding:10px;">GPA</th>
                        <th style="padding:10px;">Classification</th>
                    </tr>
                </thead>
                <tbody>
    `;

    (historyData.semesters || []).forEach(s => {
        const gpa = s.semester_gpa !== null ? parseFloat(s.semester_gpa).toFixed(2) : 'In Progress';
        html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px;">${s.semester_name}</td>
                <td style="padding:10px;">${s.year_name}</td>
                <td style="padding:10px;text-align:center;">${s.module_count}</td>
                <td style="padding:10px;text-align:center;">${s.total_credits}</td>
                <td style="padding:10px;text-align:center;"><strong>${gpa}</strong></td>
                <td style="padding:10px;text-align:center;">${s.semester_classification}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>

            <div style="background:#f0f4f8;padding:20px;border-radius:8px;font-size:15px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <strong>Total Credits Earned:</strong>
                    <span>${totalCredits}</span>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
                    <strong>Cumulative GPA (cGPA):</strong>
                    <span style="font-size:20px;color:#003366;"><strong>${cgpa.toFixed(2)}</strong></span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <strong>Classification:</strong>
                    <span style="color:${clsColor};font-weight:700;">${cls}</span>
                </div>
            </div>

            <div style="margin-top:30px;text-align:center;font-size:12px;color:#888;">
                <p>Generated on ${new Date().toLocaleString()}</p>
                <p>This is a computer-generated transcript and is valid without signature.</p>
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================
// HELPERS
// ============================================
function getGpaClass(gpa) {
    if (isNaN(gpa)) return '';
    if (gpa >= 3.70) return 'distinction';
    if (gpa >= 2.50) return 'credit';
    if (gpa >= 2.00) return 'pass';
    return 'fail';
}

function getGpaColor(gpa) {
    if (isNaN(gpa)) return '#888';
    if (gpa >= 3.70) return '#fd7e14';
    if (gpa >= 2.50) return '#17a2b8';
    if (gpa >= 2.00) return '#28a745';
    return '#dc3545';
}

function getClassColor(cls) {
    if (!cls) return '#888';
    const c = cls.toLowerCase();
    if (c.includes('distinction') || c.includes('first')) return '#fd7e14';
    if (c.includes('credit') || c.includes('upper')) return '#17a2b8';
    if (c.includes('lower') || c.includes('pass')) return '#28a745';
    if (c.includes('in progress')) return '#003366';
    if (c.includes('fail') || c.includes('third')) return '#dc3545';
    return '#333';
}

function getGradeClass(grade) {
    if (!grade) return '';
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return 'A';
    if (g.startsWith('B')) return 'B';
    if (g.startsWith('C')) return 'C';
    if (g.startsWith('D')) return 'D';
    return 'F';
}

// ============================================
// DOWNLOAD TRANSCRIPT AS PDF
// ============================================
function downloadTranscriptPDF() {
    // Make sure the transcript is rendered first
    const container = document.getElementById('transcriptContent');
    if (!container || container.textContent.includes('Loading transcript')) {
        alert('Please wait for the transcript to load first.');
        return;
    }

    if (container.textContent.includes('No transcript data')) {
        alert('No transcript available to download.');
        return;
    }

    // Trigger the browser's print dialog
    // User can then choose "Save as PDF" from the print destination dropdown
    window.print();
}

// ============================================
// GPA TREND CHART
// ============================================
function renderGPATrendChart() {
    const canvas = document.getElementById('gpaTrendChart');
    if (!canvas) return;

    // Make sure Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error('Chart.js not loaded');
        return;
    }

    if (!historyData || !historyData.semesters || historyData.semesters.length === 0) {
        // No data — show a placeholder
        const ctx = canvas.getContext('2d');
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText('No semester data available yet', canvas.width / 2, 60);
        return;
    }

    // Filter out semesters without a GPA (in-progress semesters)
    const semesters = historyData.semesters.filter(s => s.semester_gpa !== null);

    if (semesters.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText('No completed semesters yet', canvas.width / 2, 60);
        return;
    }

    const labels = semesters.map(s => {
        const yr = (s.year_name || '').split('/')[0]; // "2024/2025" → "2024"
        return `${yr} ${s.semester_name.replace('Semester ', 'S')}`;
    });

    const data = semesters.map(s => parseFloat(s.semester_gpa));

    // Color the last point differently (current semester)
    const pointColors = data.map((_, i) =>
        i === data.length - 1 ? '#003366' : '#17a2b8'
    );
    const pointSizes = data.map((_, i) =>
        i === data.length - 1 ? 8 : 5
    );

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Semester GPA',
                data: data,
                borderColor: '#003366',
                backgroundColor: 'rgba(0, 51, 102, 0.08)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: pointColors,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: pointSizes,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `GPA: ${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                y: {
                    min: 0,
                    max: 4,
                    ticks: {
                        stepSize: 0.5,
                        callback: (v) => v.toFixed(1)
                    },
                    grid: {
                        color: (ctx) => {
                            // Highlight the 2.0 pass line
                            return ctx.tick.value === 2.0
                                ? 'rgba(220, 53, 69, 0.5)'
                                : 'rgba(0, 0, 0, 0.05)';
                        }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}