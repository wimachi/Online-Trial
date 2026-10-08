// ============================================
// MUBAS ASSESSMENT SYSTEM - ADMIN DASHBOARD
// ============================================

let adminStats = null;
let myScope = null;
let studentsList = [];
let lecturersList = [];
let programsList = [];
let structureData = null;
let pendingApprovals = null;
let currentApprovalRole = null;
let reportsSummary = null;
let offeringPerformance = [];
let modulesList = [];

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = `Welcome, ${user.username || 'User'}`;
    document.getElementById('userRole').textContent = (user.role || 'Admin').toUpperCase();

    await loadScope();
    applyRoleBasedUI();

    await Promise.all([
        loadStats(),
        loadStudents(),
        loadLecturers(),
        loadPrograms(),
        loadStructure(),
        loadModules()
    ]);

    if (myScope && ['HoD', 'Dean', 'Senate', 'VC'].includes(myScope.role)) {
        currentApprovalRole = myScope.role;
        await loadPendingApprovals();
    }

    if (myScope && ['HoD', 'Dean', 'Senate', 'VC', 'Admin'].includes(myScope.role)) {
        await loadReports();
    }

    renderStats();
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
}

// ============================================
// ROLE-BASED UI
// ============================================
async function loadScope() {
    try {
        const r = await apiRequest('/admin/my-scope');
        if (r.ok) {
            myScope = await r.json();
            renderScope();
        }
    } catch (e) { console.error('Scope error:', e); }
}

function renderScope() {
    if (!myScope) return;

    const role = myScope.role || 'User';
    const initials = role.substring(0, 2).toUpperCase();
    
    const avatar = document.getElementById('sideAvatar');
    if (avatar) avatar.textContent = initials;

    const nameEl = document.getElementById('sideName');
    if (nameEl) {
        if (myScope.first_name && myScope.last_name) {
            nameEl.textContent = `${myScope.title || ''} ${myScope.first_name} ${myScope.last_name}`.trim();
        } else {
            nameEl.textContent = myScope.username || 'User';
        }
    }

    const roleEl = document.getElementById('sideRole');
    if (roleEl) roleEl.textContent = role;

    const scopeEl = document.getElementById('sideScope');
    if (scopeEl) {
        if (role === 'Dean' && myScope.school_name) {
            scopeEl.textContent = myScope.school_name;
        } else if (role === 'HoD' && myScope.department_name) {
            scopeEl.textContent = myScope.department_name;
        } else if (role === 'Lecturer' && myScope.department_name) {
            scopeEl.textContent = myScope.department_name;
        } else if (role === 'VC') {
            scopeEl.textContent = 'University-wide';
        } else if (role === 'Senate') {
            scopeEl.textContent = 'University Senate';
        } else if (role === 'Admin') {
            scopeEl.textContent = 'System Administrator';
        }
    }
}

function applyRoleBasedUI() {
    if (!myScope) return;
    const role = myScope.role;

    if (role === 'Lecturer') {
        hideNav('programs');
        hideNav('structure');
        hideNav('lecturers');
        hideNav('reports');
    }

    if (role === 'HoD') {
        hideNav('structure');
        showNav('approvals');
        showNav('reports');
    }

    if (role === 'Dean') {
        hideNav('programs');
        showNav('approvals');
        showNav('reports');
    }

    if (role === 'Senate') {
        hideNav('programs');
        hideNav('structure');
        showNav('approvals');
        showNav('reports');
    }

    if (role === 'VC') {
        showNav('approvals');
        showNav('reports');
    }

    if (role === 'Admin') {
        showNav('reports');
    }

    // Only Admin and VC can register lecturers
    if (!['Admin', 'VC'].includes(role)) {
        const btn = document.getElementById('registerLecturerBtn');
        if (btn) btn.style.display = 'none';
    }

        // Only Admin and VC can create modules
    if (!['Admin', 'VC'].includes(role)) {
        const cBtn = document.getElementById('createModuleBtn');
        if (cBtn) cBtn.style.display = 'none';
    }

        // Only Admin and VC can access Year Rollover
    const rolloverNav = document.getElementById('navRollover');
    if (rolloverNav) {
        rolloverNav.style.display = ['Admin', 'VC'].includes(role) ? 'block' : 'none';
    }

    // Policy Cases & Appeals — leadership roles
    const policyNav = document.getElementById('navPolicy');
    if (policyNav) {
        policyNav.style.display = ['Admin', 'VC', 'Senate', 'Dean', 'HoD'].includes(role) ? 'block' : 'none';
    }
    const appealsNav = document.getElementById('navAppeals');
    if (appealsNav) {
        appealsNav.style.display = ['Admin', 'VC', 'Senate', 'Dean', 'HoD'].includes(role) ? 'block' : 'none';
    }
    const withdrawalsNav = document.getElementById('navWithdrawals');
    if (withdrawalsNav) {
        withdrawalsNav.style.display = ['Admin', 'VC', 'Senate', 'Dean', 'HoD'].includes(role) ? 'block' : 'none';
    }
    const missingExamsNav = document.getElementById('navMissingExams');
    if (missingExamsNav) {
        missingExamsNav.style.display = ['Admin', 'VC', 'Senate', 'Dean', 'HoD'].includes(role) ? 'block' : 'none';
    }
    const incompleteNav = document.getElementById('navIncompleteGrades');
    if (incompleteNav) {
        incompleteNav.style.display = ['Admin', 'VC', 'Senate', 'Dean', 'HoD'].includes(role) ? 'block' : 'none';
    }
    const aegrotatsNav = document.getElementById('navAegrotats');
    if (aegrotatsNav) {
        aegrotatsNav.style.display = ['Admin', 'VC', 'Senate', 'Dean', 'HoD'].includes(role) ? 'block' : 'none';
    }
    const programChangesNav = document.getElementById('navProgramChanges');
    if (programChangesNav) {
        programChangesNav.style.display = ['Admin', 'VC', 'Senate', 'Dean', 'HoD'].includes(role) ? 'block' : 'none';
    }
    const posthumousNav = document.getElementById('navPosthumous');
    if (posthumousNav) {
        posthumousNav.style.display = ['Admin', 'VC', 'Senate'].includes(role) ? 'block' : 'none';
    }
    const exitAwardsNav = document.getElementById('navExitAwards');
    if (exitAwardsNav) {
        exitAwardsNav.style.display = ['Admin', 'VC', 'Senate', 'Dean', 'HoD'].includes(role) ? 'block' : 'none';
    }
}

function hideNav(page) {
    const el = document.querySelector(`[data-page="${page}"]`);
    if (el) el.style.display = 'none';
}

function showNav(page) {
    const el = document.querySelector(`[data-page="${page}"]`);
    if (el) el.style.display = 'block';
}

// ============================================
// LOADERS
// ============================================
async function loadStats() {
    try {
        const r = await apiRequest('/admin/scoped-stats');
        if (r.ok) adminStats = await r.json();
    } catch (e) { console.error('Stats error:', e); }
}

async function loadStudents() {
    try {
        const prog = document.getElementById('filterProgram')?.value || '';
        const yr = document.getElementById('filterYear')?.value || '';
        const search = document.getElementById('searchStudents')?.value || '';
        const params = new URLSearchParams();
        if (prog) params.append('programCode', prog);
        if (yr) params.append('year', yr);
        if (search) params.append('search', search);

        const r = await apiRequest('/admin/scoped-students?' + params.toString());
        if (r.ok) {
            studentsList = await r.json();
            renderStudents();
        }
    } catch (e) { console.error('Students error:', e); }
}

async function loadLecturers() {
    try {
        const r = await apiRequest('/admin/lecturers');
        if (r.ok) {
            lecturersList = await r.json();
            renderLecturers();
        }
    } catch (e) { console.error('Lecturers error:', e); }
}

async function loadPrograms() {
    try {
        const r = await apiRequest('/admin/programs');
        if (r.ok) {
            programsList = await r.json();
            renderPrograms();
            populateProgramFilter();
        }
    } catch (e) { console.error('Programs error:', e); }
}

// Fill the "Program" filter on the Students page with real programs
function populateProgramFilter() {
    const sel = document.getElementById('filterProgram');
    if (!sel || !programsList || programsList.length === 0) return;

    const currentValue = sel.value; // preserve selection on refresh
    sel.innerHTML = '<option value="">All Programs</option>' +
        programsList.map(p => `<option value="${p.code}">${p.code} — ${p.name}</option>`).join('');

    // Restore previous selection if it still exists
    if (currentValue) {
        const stillExists = Array.from(sel.options).some(o => o.value === currentValue);
        if (stillExists) sel.value = currentValue;
    }
}

async function loadStructure() {
    try {
        const r = await apiRequest('/admin/structure');
        if (r.ok) {
            structureData = await r.json();
            renderStructure();
        }
    } catch (e) { console.error('Structure error:', e); }
}

// ============================================
// PENDING APPROVALS
// ============================================
async function loadPendingApprovals() {
    try {
        let endpoint = '';
        const role = myScope.role;

        if (role === 'HoD') endpoint = '/hod/pending-approvals';
        else if (role === 'Dean') endpoint = '/dean/pending-approvals';
        else if (role === 'Senate') endpoint = '/senate/pending-approvals';
        else if (role === 'VC') endpoint = '/vc/pending-release';
        else return;

        const r = await apiRequest(endpoint);
        if (r.ok) {
            const data = await r.json();
            pendingApprovals = data;
            renderPendingApprovals();
        }
    } catch (e) { console.error('Pending approvals error:', e); }
}

function renderPendingApprovals() {
    const container = document.getElementById('pendingApprovalsList');
    if (!container) return;

    const offerings = pendingApprovals?.offerings || [];

    // VC bulk-release bar (only shows when there's something to release)
    const isVC = myScope && myScope.role === 'VC';
    const showBulkBar = isVC && offerings.length > 0;

    if (offerings.length === 0) {
        const role = myScope.role;
        let nextStage = '';
        if (role === 'HoD') nextStage = 'submitted by lecturers';
        else if (role === 'Dean') nextStage = 'approved by HoDs';
        else if (role === 'Senate') nextStage = 'approved by Deans';
        else if (role === 'VC') nextStage = 'approved by Senate';

        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;color:#888;background:white;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="font-size:48px;margin-bottom:15px;">✅</div>
                <h3 style="color:#333;margin-bottom:8px;">Nothing to Approve</h3>
                <p style="font-size:14px;">No gradebooks have been ${nextStage} yet.</p>
            </div>
        `;
        return;
    }

    let scopeLine = '';
    if (myScope.role === 'HoD') scopeLine = `Department: <strong>${pendingApprovals.department || myScope.department_name}</strong>`;
    else if (myScope.role === 'Dean') scopeLine = `School: <strong>${pendingApprovals.school || myScope.school_name}</strong>`;
    else if (myScope.role === 'Senate') scopeLine = `University-wide review`;
    else if (myScope.role === 'VC') scopeLine = `Final release authority`;

    let actionLabel = 'Approve';
    let actionColor = '#28a745';
    if (myScope.role === 'VC') {
        actionLabel = '🎓 Release to Students';
        actionColor = '#003366';
    }

    let html = `
        <div style="margin-bottom:20px;padding:15px 20px;background:#e8f4f8;border-left:4px solid #17a2b8;border-radius:6px;font-size:14px;color:#333;">
            <strong>${offerings.length}</strong> gradebook(s) awaiting your action · ${scopeLine}
        </div>
    `;

    offerings.forEach(o => {
        const submittedDate = o.submitted_at 
            ? new Date(o.submitted_at).toLocaleString('en-MW', { 
                day: '2-digit', month: 'short', year: 'numeric', 
                hour: '2-digit', minute: '2-digit'
              })
            : 'Unknown';

        html += `
            <div style="background:white;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:15px;padding:20px 25px;">
                <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:15px;padding-bottom:15px;border-bottom:1px solid #eee;">
                    <div>
                        <div style="font-size:18px;font-weight:700;color:#003366;">
                            ${o.module_code} — ${o.module_name}
                        </div>
                        <div style="font-size:13px;color:#888;margin-top:4px;">
                            ${o.program_code} · Year ${o.year_of_study} · ${o.semester_name} · ${o.year_name}
                        </div>
                        ${o.department_name ? `<div style="font-size:12px;color:#999;margin-top:2px;">${o.department_name}${o.school_name ? ' · ' + o.school_name : ''}</div>` : ''}
                    </div>
                    <span style="background:#ffc107;color:#333;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;">
                        ${o.approval_status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                </div>

                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:15px;font-size:13px;">
                    <div>
                        <div style="font-size:11px;color:#888;text-transform:uppercase;font-weight:600;">Lecturer</div>
                        <div style="font-weight:600;color:#333;margin-top:3px;">${o.lecturer_name}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#888;text-transform:uppercase;font-weight:600;">Students</div>
                        <div style="font-weight:600;color:#333;margin-top:3px;">${o.student_count}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#888;text-transform:uppercase;font-weight:600;">Grades Entered</div>
                        <div style="font-weight:600;color:#333;margin-top:3px;">${o.grades_entered || '—'} / ${(o.student_count || 0) * (o.assessment_count || 0)}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#888;text-transform:uppercase;font-weight:600;">Submitted</div>
                        <div style="font-weight:600;color:#333;margin-top:3px;font-size:12px;">${submittedDate}</div>
                    </div>
                </div>

                <div style="display:flex;gap:10px;">
                    <button onclick="reviewOffering(${o.offering_id})" 
                        style="padding:8px 20px;background:#6c757d;color:white;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:600;">
                        👁️ Review
                    </button>
                    <button onclick="approveOffering(${o.offering_id})"
                        style="padding:8px 20px;background:${actionColor};color:white;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:600;">
                        ✅ ${actionLabel}
                    </button>
                    <button onclick="rejectOffering(${o.offering_id})"
                        style="padding:8px 20px;background:#dc3545;color:white;border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:600;">
                        ❌ Reject
                    </button>
                </div>
            </div>
        `;
    });

            // Prepend the VC bulk bar if applicable
    const bulkBar = showBulkBar
        ? `<div style="margin-bottom:15px;padding:15px 20px;background:linear-gradient(135deg,#003366,#0066cc);color:white;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <strong style="font-size:15px;">🎓 ${offerings.length} offering(s) ready to release</strong>
                    <div style="font-size:12px;opacity:0.9;margin-top:3px;">Release all at once to publish results to students.</div>
                </div>
                <button onclick="releaseAllFromVC()" style="padding:10px 22px;background:#28a745;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;">
                    🎓 Release All Displayed
                </button>
            </div>`
        : '';

    container.innerHTML = bulkBar + html;
}

// VC bulk release handler
async function releaseAllFromVC() {
    const count = pendingApprovals?.offerings?.length || 0;
    if (count === 0) return;

    if (!confirm(`Release ALL ${count} Senate-approved offering(s) to students?\n\nStudents will immediately see their results. This cannot be undone.`)) return;

    try {
        const r = await apiRequest('/vc/release-all', {
            method: 'POST',
            body: JSON.stringify({ remarks: 'Bulk release via dashboard' })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed to release'));
            return;
        }

        alert('✅ ' + data.message);
        await loadPendingApprovals();
    } catch (e) {
        console.error('Bulk release error:', e);
        alert('Network error: ' + e.message);
    }
}


// ============================================
// APPROVE / REJECT / RELEASE ACTIONS
// ============================================
async function approveOffering(offeringId) {
    const role = myScope.role;
    let endpoint = '';
    let confirmMsg = '';

    if (role === 'HoD') {
        endpoint = '/hod/approve';
        confirmMsg = 'Approve this gradebook as HoD?';
    } else if (role === 'Dean') {
        endpoint = '/dean/approve';
        confirmMsg = 'Approve this gradebook as Dean?';
    } else if (role === 'Senate') {
        endpoint = '/senate/approve';
        confirmMsg = 'Approve this gradebook as Senate?';
    } else if (role === 'VC') {
        endpoint = '/vc/release';
        confirmMsg = 'Release these results to students? This action makes grades visible immediately.';
    } else {
        return alert('No approval role detected');
    }

    if (!confirm(confirmMsg)) return;

    try {
        const r = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({ offeringId, remarks: `${role} approved via dashboard` })
        });

        const data = await r.json();

        if (!r.ok) {
            return alert('Error: ' + (data.message || 'Failed'));
        }

        alert('✅ ' + data.message);
        await loadPendingApprovals();
    } catch (e) {
        console.error('Approve error:', e);
        alert('Network error: ' + e.message);
    }
}

async function rejectOffering(offeringId) {
    const reason = prompt('Rejection reason (required):');
    if (!reason || reason.trim() === '') {
        return alert('Rejection cancelled — reason required.');
    }

    const role = myScope.role;
    let endpoint = '';

    if (role === 'HoD') endpoint = '/hod/reject';
    else if (role === 'Dean') endpoint = '/dean/reject';
    else if (role === 'Senate') endpoint = '/senate/reject';
    else if (role === 'VC') endpoint = '/vc/reject';
    else return alert('Your role cannot reject at this stage.');

    try {
        const r = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({ offeringId, reason: reason.trim() })
        });

        const data = await r.json();

        if (!r.ok) {
            return alert('Error: ' + (data.message || 'Failed'));
        }

        alert('✅ ' + data.message);
        await loadPendingApprovals();
    } catch (e) {
        console.error('Reject error:', e);
        alert('Network error: ' + e.message);
    }
}

// ============================================
// REVIEW MODAL
// ============================================
let currentReviewOffering = null;
let currentReviewData = null;

async function reviewOffering(offeringId) {
    currentReviewOffering = offeringId;
    const modal = document.getElementById('reviewModal');
    modal.style.display = 'block';
    document.getElementById('reviewTitle').textContent = 'Loading...';
    document.getElementById('reviewSubtitle').textContent = '';
    document.getElementById('reviewGradesBody').innerHTML = '<tr><td style="text-align:center;padding:30px;color:#888;">Loading...</td></tr>';
    document.getElementById('reviewHistory').innerHTML = 'Loading...';

    try {
        const r = await apiRequest('/approval/review?offeringId=' + offeringId);
        if (!r.ok) {
            alert('Failed to load review');
            closeReview();
            return;
        }
        const data = await r.json();
        currentReviewData = data;
        renderReviewModal(data);
    } catch (e) {
        console.error('Review load error:', e);
        alert('Error: ' + e.message);
        closeReview();
    }
}

function closeReview() {
    document.getElementById('reviewModal').style.display = 'none';
    currentReviewOffering = null;
    currentReviewData = null;
}

function renderReviewModal(data) {
    const o = data.offering;

    document.getElementById('reviewTitle').textContent = `${o.module_code} — ${o.module_name}`;
    document.getElementById('reviewSubtitle').textContent = 
        `${o.program_name} · ${o.year_name} · ${o.semester_name} · Year ${o.year_of_study} · Semester ${o.curriculum_semester}`;

    document.getElementById('reviewLecturer').textContent = o.lecturer_name;
    document.getElementById('reviewProgram').textContent = `${o.program_code} · Year ${o.year_of_study}`;
    document.getElementById('reviewDept').textContent = o.department_name;
    document.getElementById('reviewStudentCount').textContent = data.students.length;

    renderReviewGrades(data);
    renderReviewHistory(data.history);

    const role = myScope?.role;
    const approveBtn = document.getElementById('reviewApproveBtn');
    const rejectBtn = document.getElementById('reviewRejectBtn');

    if (role === 'VC') {
        approveBtn.innerHTML = '🎓 Release to Students';
        approveBtn.style.background = '#003366';
        rejectBtn.style.display = 'none';
    } else if (role === 'HoD' || role === 'Dean' || role === 'Senate') {
        approveBtn.innerHTML = '✅ Approve';
        approveBtn.style.background = '#28a745';
        rejectBtn.style.display = 'block';
    } else {
        approveBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
    }
}

function renderReviewGrades(data) {
    const head = document.getElementById('reviewGradesHead');
    const body = document.getElementById('reviewGradesBody');

    if (data.students.length === 0 || data.assessments.length === 0) {
        body.innerHTML = '<tr><td style="text-align:center;padding:30px;color:#888;">No data</td></tr>';
        return;
    }

    const gradeLookup = {};
    data.grades.forEach(g => {
        if (!gradeLookup[g.enrollment_id]) gradeLookup[g.enrollment_id] = {};
        gradeLookup[g.enrollment_id][g.assessment_id] = g;
    });

    let headHtml = '<tr style="background:#003366;color:white;">';
    headHtml += '<th style="padding:10px;text-align:left;">Student</th>';
    headHtml += '<th style="padding:10px;text-align:left;">Reg No</th>';
    data.assessments.forEach(a => {
        headHtml += `<th style="padding:10px;text-align:center;font-size:12px;">
            ${a.name}<br>
            <span style="font-size:10px;opacity:0.85;">${a.type} · ${a.weight_percentage}%</span>
        </th>`;
    });
    headHtml += '<th style="padding:10px;text-align:center;">Final %</th>';
    headHtml += '<th style="padding:10px;text-align:center;">Grade</th>';
    headHtml += '</tr>';
    head.innerHTML = headHtml;

    let bodyHtml = '';
    data.students.forEach(s => {
        bodyHtml += '<tr style="border-bottom:1px solid #eee;">';
        bodyHtml += `<td style="padding:10px;"><strong>${s.full_name}</strong></td>`;
        bodyHtml += `<td style="padding:10px;font-size:12px;color:#666;">${s.student_number}</td>`;

        let totalWeighted = 0;
        let totalWeight = 0;

        data.assessments.forEach(a => {
            const g = gradeLookup[s.enrollment_id]?.[a.assessment_id];
            if (g) {
                bodyHtml += `<td style="padding:10px;text-align:center;">
                    <strong>${parseFloat(g.score_obtained).toFixed(1)}</strong> / ${a.max_score}<br>
                    <span style="font-size:11px;color:#888;">${parseFloat(g.percentage).toFixed(1)}%</span>
                </td>`;
                totalWeighted += parseFloat(g.percentage) * (parseFloat(a.weight_percentage) / 100);
                totalWeight += parseFloat(a.weight_percentage) / 100;
            } else {
                bodyHtml += '<td style="padding:10px;text-align:center;color:#ccc;">—</td>';
            }
        });

        if (totalWeight > 0) {
            const finalPct = totalWeighted / totalWeight;
            const letter = getGradeLetterFromPct(finalPct);
            const cls = getGradeClassFromLetter(letter);
            bodyHtml += `<td style="padding:10px;text-align:center;font-weight:700;color:#003366;">${finalPct.toFixed(2)}%</td>`;
            bodyHtml += `<td style="padding:10px;text-align:center;"><span class="grade-badge ${cls}">${letter}</span></td>`;
        } else {
            bodyHtml += '<td style="padding:10px;text-align:center;color:#888;">—</td>';
            bodyHtml += '<td style="padding:10px;text-align:center;color:#888;">—</td>';
        }

        bodyHtml += '</tr>';
    });
    body.innerHTML = bodyHtml;
}

function renderReviewHistory(history) {
    const container = document.getElementById('reviewHistory');
    if (!history || history.length === 0) {
        container.innerHTML = '<div style="color:#888;text-align:center;">No history yet.</div>';
        return;
    }

    const statusColors = {
        'Draft': '#6c757d',
        'Submitted': '#ffc107',
        'HoD_Approved': '#17a2b8',
        'Dean_Approved': '#0066cc',
        'Senate_Approved': '#28a745',
        'Released': '#003366',
        'Rejected': '#dc3545'
    };

    let html = '<div style="display:flex;flex-direction:column;gap:10px;">';
    history.forEach(h => {
        const color = statusColors[h.new_status] || '#888';
        const date = new Date(h.created_at).toLocaleString('en-MW', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        html += `
            <div style="display:flex;gap:12px;align-items:start;padding:10px;background:white;border-left:3px solid ${color};border-radius:4px;">
                <div style="flex-shrink:0;width:140px;font-size:12px;color:#888;">${date}</div>
                <div style="flex:1;">
                    <div style="font-weight:600;color:#333;font-size:13px;">
                        ${h.actor_role} → <span style="color:${color};">${h.new_status.replace(/_/g, ' ')}</span>
                    </div>
                    ${h.actor_name ? `<div style="font-size:12px;color:#888;">by ${h.actor_name}</div>` : ''}
                    ${h.remarks ? `<div style="font-size:12px;color:#666;margin-top:4px;font-style:italic;">"${h.remarks}"</div>` : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

// ============================================
// MODAL ACTIONS
// ============================================
async function approveFromModal() {
    const offeringId = currentReviewOffering;
    if (!offeringId) return;
    closeReview();
    await approveOffering(offeringId);
}

async function rejectFromModal() {
    const offeringId = currentReviewOffering;
    if (!offeringId) return;
    closeReview();
    await rejectOffering(offeringId);
}

// ============================================
// GRADE HELPERS
// ============================================
function getGradeLetterFromPct(pct) {
    if (pct >= 96) return 'A+';
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'A-';
    if (pct >= 77) return 'B+';
    if (pct >= 73) return 'B';
    if (pct >= 70) return 'B-';
    if (pct >= 67) return 'C+';
    if (pct >= 63) return 'C';
    if (pct >= 60) return 'C-';
    if (pct >= 57) return 'D+';
    if (pct >= 53) return 'D';
    if (pct >= 50) return 'D-';
    if (pct >= 45) return 'E+';
    if (pct >= 40) return 'E';
    return 'F-';
}

function getGradeClassFromLetter(letter) {
    if (!letter) return '';
    const g = letter.toUpperCase();
    if (g.startsWith('A')) return 'A';
    if (g.startsWith('B')) return 'B';
    if (g.startsWith('C')) return 'C';
    if (g.startsWith('D')) return 'D';
    return 'F';
}

// ============================================
// RENDER: STATS
// ============================================
function renderStats() {
    if (!adminStats) return;

    // Always populate the basic stats
    document.getElementById('statStudents').textContent = adminStats.total_students || 0;
    document.getElementById('statActiveStudents').textContent = `${adminStats.active_students || 0} active`;

    const statLecturers = document.getElementById('statLecturers');
    const statPrograms = document.getElementById('statPrograms');
    const statModules = document.getElementById('statModules');
    const statSchools = document.getElementById('statSchools');
    const statDepartments = document.getElementById('statDepartments');
    const statGraduated = document.getElementById('statGraduated');
    const statUsers = document.getElementById('statUsers');

    if (statPrograms) statPrograms.textContent = adminStats.total_programs || 0;
    if (statDepartments) statDepartments.textContent = adminStats.total_departments || 0;
    if (statGraduated) statGraduated.textContent = adminStats.graduated_students || 0;

    // University-wide roles see the real university totals
    const seesEverything = myScope && ['Admin', 'VC', 'Senate'].includes(myScope.role);

    if (seesEverything) {
        if (statLecturers) statLecturers.textContent = adminStats.total_lecturers || 0;
        if (statModules) statModules.textContent = adminStats.total_modules || 0;
        if (statSchools) statSchools.textContent = adminStats.total_schools || 0;
        if (statUsers) statUsers.textContent = adminStats.active_users || 0;
    } else {
        // Scoped roles (HoD, Dean, Lecturer) don't see university-wide numbers
        if (statLecturers) statLecturers.textContent = '—';
        if (statModules) statModules.textContent = '—';
        if (statSchools) statSchools.textContent = '—';
        if (statUsers) statUsers.textContent = '—';
    }
}

// ============================================
// RENDER: STUDENTS
// ============================================
function renderStudents() {
    const tbody = document.getElementById('studentsBody');
    if (!studentsList || studentsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">No students found</td></tr>';
        return;
    }

    let html = '';
    studentsList.forEach(s => {
        const statusColor = s.student_status === 'Active' ? '#28a745' : '#dc3545';
        html += `
            <tr>
                <td><strong>${s.student_number}</strong></td>
                <td>${s.full_name}</td>
                <td>${s.program_code}<br><span style="font-size:11px;color:#888;">${s.program_name}</span></td>
                <td>${s.current_year_of_study} / ${s.duration_years}</td>
                <td>${s.current_semester}</td>
                <td><span style="color:${statusColor};font-weight:600;">${s.student_status}</span></td>
                <td><button onclick="viewStudent('${s.student_number}')" style="padding:5px 12px;background:#003366;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">View</button></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// RENDER: LECTURERS
// ============================================
function renderLecturers() {
    const tbody = document.getElementById('lecturersBody');
    if (!lecturersList || lecturersList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">No lecturers found</td></tr>';
        return;
    }

    let html = '';
    lecturersList.forEach(l => {
        const badge = l.is_hod 
            ? '<span style="background:#ffc107;color:#333;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:5px;">HoD</span>' 
            : (l.is_dean 
                ? '<span style="background:#17a2b8;color:white;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:5px;">Dean</span>' 
                : '');
        html += `
            <tr>
                <td><strong>${l.staff_number}</strong></td>
                <td>${l.full_name}${badge}</td>
                <td>${l.position}</td>
                <td>${l.department_name || '-'}</td>
                <td>${l.school_name || '-'}</td>
                <td style="text-align:center;"><strong>${l.modules_taught}</strong></td>
                <td style="text-align:center;color:#666;">${l.offerings_taught}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// RENDER: PROGRAMS
// ============================================
function renderPrograms() {
    const tbody = document.getElementById('programsBody');
    if (!programsList || programsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">No programs found</td></tr>';
        return;
    }

    let html = '';
    programsList.forEach(p => {
        html += `
            <tr>
                <td><strong>${p.code}</strong></td>
                <td>${p.name}</td>
                <td>${p.type}</td>
                <td>${p.duration_years} years</td>
                <td>${p.department_name || '-'}<br><span style="font-size:11px;color:#888;">${p.school_name || ''}</span></td>
                <td style="text-align:center;">${p.student_count}</td>
                <td style="text-align:center;">${p.module_count}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// RENDER: STRUCTURE
// ============================================
function renderStructure() {
    const container = document.getElementById('structureContainer');
    if (!structureData || !structureData.schools) {
        container.innerHTML = '<div style="text-align:center;color:#888;padding:40px;">No structure data</div>';
        return;
    }

    let html = '';
    structureData.schools.forEach(school => {
        const depts = structureData.departments.filter(d => d.school_id === school.school_id);
        html += `
            <div style="background:white;padding:25px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding-bottom:15px;border-bottom:2px solid #003366;">
                    <div>
                        <h3 style="color:#003366;font-size:20px;margin-bottom:3px;">${school.name}</h3>
                        <span style="font-size:13px;color:#888;">Code: ${school.code}</span>
                    </div>
                    <div style="display:flex;gap:25px;text-align:center;font-size:13px;">
                        <div><div style="font-size:20px;font-weight:700;color:#003366;">${school.department_count}</div>Departments</div>
                        <div><div style="font-size:20px;font-weight:700;color:#003366;">${school.program_count}</div>Programs</div>
                        <div><div style="font-size:20px;font-weight:700;color:#003366;">${school.student_count}</div>Students</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">
                    ${depts.map(d => `
                        <div style="background:#f0f4f8;padding:12px 15px;border-radius:6px;">
                            <div style="font-weight:600;color:#333;">${d.name}</div>
                            <div style="font-size:12px;color:#888;margin-top:4px;">${d.program_count} programs · ${d.student_count} students</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// ============================================
// VIEW STUDENT DETAIL
// ============================================
function viewStudent(studentNumber) {
    window.location.href = '/admin-student.html?student=' + encodeURIComponent(studentNumber);
}

// ============================================
// REPORTS
// ============================================
async function loadReports() {
    try {
        const [summaryRes, perfRes] = await Promise.all([
            apiRequest('/reports/summary'),
            apiRequest('/reports/offering-performance')
        ]);

        if (summaryRes.ok) reportsSummary = await summaryRes.json();
        if (perfRes.ok) offeringPerformance = await perfRes.json();

        renderReports();
    } catch (e) { console.error('Reports error:', e); }
}

function renderReports() {
    renderReportsSummary();
    renderReportsTable();
}

function renderReportsSummary() {
    if (!reportsSummary) return;
    document.getElementById('repModules').textContent = reportsSummary.total_modules || 0;
    document.getElementById('repStudents').textContent = reportsSummary.total_students || 0;
    document.getElementById('repAvg').textContent = 
        reportsSummary.overall_avg ? parseFloat(reportsSummary.overall_avg).toFixed(1) + '%' : '—';
    document.getElementById('repPassRate').textContent = 
        reportsSummary.overall_pass_rate ? parseFloat(reportsSummary.overall_pass_rate).toFixed(1) + '%' : '—';
    document.getElementById('repPassLabel').textContent = 
        `${reportsSummary.total_passes || 0} passes · ${reportsSummary.total_fails || 0} fails`;
}

function renderReportsTable() {
    const tbody = document.getElementById('reportsBody');
    const countEl = document.getElementById('repTableCount');

    if (!offeringPerformance || offeringPerformance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#888;padding:30px;">No data available</td></tr>';
        if (countEl) countEl.textContent = '';
        return;
    }

    if (countEl) countEl.textContent = `${offeringPerformance.length} records`;

    let html = '';
    offeringPerformance.forEach(p => {
        const avg = parseFloat(p.avg_score) || 0;
        const passRate = parseFloat(p.pass_rate) || 0;
        const avgColor = getScoreColor(avg);
        const rateColor = passRate >= 75 ? '#28a745' : passRate >= 50 ? '#ffc107' : '#dc3545';
        const status = passRate >= 75 ? '✅ Healthy' : passRate >= 50 ? '⚠️ Watch' : '🔴 At Risk';
        const statusColor = passRate >= 75 ? '#28a745' : passRate >= 50 ? '#ffc107' : '#dc3545';

        html += `
            <tr>
                <td>
                    <strong>${p.module_code}</strong><br>
                    <span style="font-size:11px;color:#888;">${p.module_name}</span>
                </td>
                <td style="font-size:13px;">${p.year_name}</td>
                <td style="font-size:13px;">${p.semester_name}<br><span style="font-size:11px;color:#888;">Year ${p.year_of_study}</span></td>
                <td style="text-align:center;">${p.total_students}</td>
                <td style="text-align:center;font-weight:700;color:${avgColor};">${avg.toFixed(1)}%</td>
                <td style="text-align:center;font-size:12px;color:#888;">${parseFloat(p.min_score).toFixed(1)}%</td>
                <td style="text-align:center;font-size:12px;color:#888;">${parseFloat(p.max_score).toFixed(1)}%</td>
                <td style="text-align:center;font-weight:700;color:${rateColor};">${passRate.toFixed(1)}%</td>
                <td style="text-align:center;"><span style="color:${statusColor};font-size:12px;font-weight:600;">${status}</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function getScoreColor(score) {
    if (score >= 75) return '#28a745';
    if (score >= 60) return '#17a2b8';
    if (score >= 50) return '#ffc107';
    return '#dc3545';
}

// ============================================
// REGISTER STUDENT MODAL
// ============================================
async function openRegisterStudent() {
    ['rsStudentNumber','rsFirstName','rsLastName','rsEmail','rsPhone','rsDob']
        .forEach(id => document.getElementById(id).value = '');
    document.getElementById('rsGender').value = '';
    document.getElementById('rsProgram').value = '';
    document.getElementById('rsYear').value = '1';
    document.getElementById('rsSemester').value = '1';
    document.getElementById('rsEnrollmentDate').value = new Date().toISOString().slice(0,10);
    document.getElementById('rsError').style.display = 'none';
    document.getElementById('rsSuccess').style.display = 'none';

    const sel = document.getElementById('rsProgram');
    if (sel.options.length <= 1) {
        try {
            const r = await apiRequest('/admin/programs');
            if (r.ok) {
                const progs = await r.json();
                sel.innerHTML = '<option value="">— Select Program —</option>' +
                    progs.map(p => `<option value="${p.program_id}">${p.code} — ${p.name}</option>`).join('');
            }
        } catch (e) {
            console.error('Failed to load programs:', e);
        }
    }

    document.getElementById('registerStudentModal').style.display = 'block';
}

function closeRegisterStudent() {
    document.getElementById('registerStudentModal').style.display = 'none';
}

async function submitRegisterStudent() {
    const errEl = document.getElementById('rsError');
    const succEl = document.getElementById('rsSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const payload = {
        studentNumber: document.getElementById('rsStudentNumber').value.trim(),
        firstName: document.getElementById('rsFirstName').value.trim(),
        lastName: document.getElementById('rsLastName').value.trim(),
        email: document.getElementById('rsEmail').value.trim(),
        phone: document.getElementById('rsPhone').value.trim() || null,
        gender: document.getElementById('rsGender').value || null,
        dateOfBirth: document.getElementById('rsDob').value || null,
        programId: parseInt(document.getElementById('rsProgram').value) || null,
        enrollmentDate: document.getElementById('rsEnrollmentDate').value || null,
        currentYearOfStudy: parseInt(document.getElementById('rsYear').value) || 1,
        currentSemester: parseInt(document.getElementById('rsSemester').value) || 1
    };

    if (!payload.studentNumber || !payload.firstName || !payload.lastName || !payload.email) {
        errEl.textContent = 'Please fill in: Student Number, First Name, Last Name, Email';
        errEl.style.display = 'block';
        return;
    }
    if (!payload.programId) {
        errEl.textContent = 'Please select a Program';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('rsSubmitBtn');
    btn.textContent = '⏳ Registering...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/register-student', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Registration failed';
            errEl.style.display = 'block';
            btn.textContent = '✅ Register Student';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `
            <strong>✅ Student registered!</strong><br>
            <strong>Username:</strong> ${data.username}<br>
            <strong>Password:</strong> ${data.password} <em>(they can change it later)</em><br>
            <strong>Auto-enrolled in ${data.enrolledModules} modules</strong>
        `;
        succEl.style.display = 'block';
        btn.textContent = '✅ Register Student';
        btn.disabled = false;

        await loadStudents();
        setTimeout(() => closeRegisterStudent(), 6000);

    } catch (e) {
        console.error('Register error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '✅ Register Student';
        btn.disabled = false;
    }
}

// ============================================
// REGISTER LECTURER MODAL
// ============================================
async function openRegisterLecturer() {
    ['rlStaffNumber','rlFirstName','rlLastName','rlEmail','rlPhone','rlQualification']
        .forEach(id => document.getElementById(id).value = '');
    document.getElementById('rlTitle').value = '';
    document.getElementById('rlDepartment').value = '';
    document.getElementById('rlPosition').value = '';
    document.getElementById('rlIsHod').checked = false;
    document.getElementById('rlDateJoined').value = new Date().toISOString().slice(0,10);
    document.getElementById('rlError').style.display = 'none';
    document.getElementById('rlSuccess').style.display = 'none';

    const sel = document.getElementById('rlDepartment');
    if (sel.options.length <= 1) {
        try {
            const r = await apiRequest('/admin/structure');
            if (r.ok) {
                const data = await r.json();
                sel.innerHTML = '<option value="">— Select Department —</option>' +
                    data.departments.map(d => `<option value="${d.dept_id}">${d.name}</option>`).join('');
            }
        } catch (e) {
            console.error('Failed to load departments:', e);
        }
    }

    document.getElementById('registerLecturerModal').style.display = 'block';
}

function closeRegisterLecturer() {
    document.getElementById('registerLecturerModal').style.display = 'none';
}

async function submitRegisterLecturer() {
    const errEl = document.getElementById('rlError');
    const succEl = document.getElementById('rlSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const payload = {
        staffNumber: document.getElementById('rlStaffNumber').value.trim(),
        title: document.getElementById('rlTitle').value || null,
        firstName: document.getElementById('rlFirstName').value.trim(),
        lastName: document.getElementById('rlLastName').value.trim(),
        email: document.getElementById('rlEmail').value.trim(),
        phone: document.getElementById('rlPhone').value.trim() || null,
        departmentId: parseInt(document.getElementById('rlDepartment').value) || null,
        position: document.getElementById('rlPosition').value || null,
        highestQualification: document.getElementById('rlQualification').value.trim() || null,
        dateJoined: document.getElementById('rlDateJoined').value || null,
        isHod: document.getElementById('rlIsHod').checked ? true : false,
        isDean: false
    };

    if (!payload.staffNumber || !payload.firstName || !payload.lastName || !payload.email) {
        errEl.textContent = 'Please fill in: Staff Number, First Name, Last Name, Email';
        errEl.style.display = 'block';
        return;
    }
    if (!payload.departmentId) {
        errEl.textContent = 'Please select a Department';
        errEl.style.display = 'block';
        return;
    }
    if (!payload.position) {
        errEl.textContent = 'Please select a Position';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('rlSubmitBtn');
    btn.textContent = '⏳ Registering...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/register-lecturer', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Registration failed';
            errEl.style.display = 'block';
            btn.textContent = '✅ Register Lecturer';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `
            <strong>✅ Lecturer registered!</strong><br>
            <strong>Username:</strong> ${data.username}<br>
            <strong>Password:</strong> ${data.password} <em>(they can change it later)</em>
        `;
        succEl.style.display = 'block';
        btn.textContent = '✅ Register Lecturer';
        btn.disabled = false;

        await loadLecturers();
        setTimeout(() => closeRegisterLecturer(), 6000);

    } catch (e) {
        console.error('Register lecturer error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '✅ Register Lecturer';
        btn.disabled = false;
    }
}

// ============================================
// CREATE MODULE MODAL
// ============================================
async function openCreateModule() {
    // Reset form
    document.getElementById('cmCode').value = '';
    document.getElementById('cmName').value = '';
    document.getElementById('cmCredits').value = '10';
    document.getElementById('cmLevel').value = '';
    document.getElementById('cmDepartment').value = '';
    document.getElementById('cmDescription').value = '';
    document.getElementById('cmYearOfStudy').value = '1';
    document.getElementById('cmCurrSem').value = '1';
    document.getElementById('cmCreateOffering').checked = true;
    document.getElementById('cmLecturer').value = '';
    document.getElementById('cmRoom').value = '';
    document.getElementById('cmSchedule').value = '';
    document.getElementById('cmCapacity').value = '60';
    document.getElementById('cmError').style.display = 'none';
    document.getElementById('cmSuccess').style.display = 'none';
    document.getElementById('cmOfferingSection').style.display = 'grid';

    // Load departments
    const deptSel = document.getElementById('cmDepartment');
    if (deptSel.options.length <= 1) {
        try {
            const r = await apiRequest('/admin/structure');
            if (r.ok) {
                const data = await r.json();
                deptSel.innerHTML = '<option value="">— Select Department —</option>' +
                    data.departments.map(d => `<option value="${d.dept_id}">${d.name}</option>`).join('');
            }
        } catch (e) { console.error('Dept load error:', e); }
    }

    // Load programs (checkboxes)
    const progBox = document.getElementById('cmPrograms');
    try {
        const r = await apiRequest('/admin/programs');
        if (r.ok) {
            const progs = await r.json();
            progBox.innerHTML = progs.map(p => `
                <label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;">
                    <input type="checkbox" class="cm-program-check" value="${p.program_id}">
                    <span><strong>${p.code}</strong> — ${p.name}</span>
                </label>
            `).join('');
        }
    } catch (e) {
        progBox.innerHTML = '<div style="color:#dc3545;">Failed to load programs</div>';
    }

    // Load lecturers
    const lecSel = document.getElementById('cmLecturer');
    if (lecSel.options.length <= 1) {
        try {
            const r = await apiRequest('/admin/lecturers');
            if (r.ok) {
                const lecs = await r.json();
                lecSel.innerHTML = '<option value="">— Select Lecturer —</option>' +
                    lecs.map(l => `<option value="${l.lecturer_id}">${l.full_name} (${l.staff_number})</option>`).join('');
            }
        } catch (e) { console.error('Lecturer load error:', e); }
    }

    document.getElementById('createModuleModal').style.display = 'block';
}

function closeCreateModule() {
    document.getElementById('createModuleModal').style.display = 'none';
}

async function submitCreateModule() {
    const errEl = document.getElementById('cmError');
    const succEl = document.getElementById('cmSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    // Collect selected programs
    const programIds = Array.from(document.querySelectorAll('.cm-program-check:checked'))
        .map(cb => parseInt(cb.value));

    const createOffering = document.getElementById('cmCreateOffering').checked;

    const payload = {
        moduleCode: document.getElementById('cmCode').value.trim(),
        moduleName: document.getElementById('cmName').value.trim(),
        credits: parseInt(document.getElementById('cmCredits').value) || 10,
        level: document.getElementById('cmLevel').value || null,
        description: document.getElementById('cmDescription').value.trim() || null,
        departmentId: parseInt(document.getElementById('cmDepartment').value) || null,
        programIds: programIds,
        yearOfStudy: parseInt(document.getElementById('cmYearOfStudy').value) || 1,
        curriculumSemester: parseInt(document.getElementById('cmCurrSem').value) || 1,
        lecturerId: createOffering ? (parseInt(document.getElementById('cmLecturer').value) || null) : null,
        room: createOffering ? (document.getElementById('cmRoom').value.trim() || null) : null,
        schedule: createOffering ? (document.getElementById('cmSchedule').value.trim() || null) : null,
        capacity: createOffering ? (parseInt(document.getElementById('cmCapacity').value) || 60) : null,
        createOffering: createOffering
    };

    // Validation
    if (!payload.moduleCode || !payload.moduleName) {
        errEl.textContent = 'Please fill in: Module Code and Module Name';
        errEl.style.display = 'block';
        return;
    }
    if (!payload.departmentId) {
        errEl.textContent = 'Please select a Department';
        errEl.style.display = 'block';
        return;
    }
    if (createOffering && !payload.lecturerId) {
        errEl.textContent = 'Please select a Lecturer for the offering (or uncheck the offering option)';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('cmSubmitBtn');
    btn.textContent = '⏳ Creating...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/create-module', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed to create module';
            errEl.style.display = 'block';
            btn.textContent = '✅ Create Module';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `
            <strong>✅ Module created!</strong><br>
            <strong>Code:</strong> ${data.moduleCode}<br>
            <strong>Name:</strong> ${data.moduleName}<br>
            <strong>Curriculum entries added:</strong> ${data.curriculumEntries}<br>
            ${data.offeringId ? `<strong>Offering scheduled (ID: ${data.offeringId})</strong>` : 'No offering scheduled'}
        `;
        succEl.style.display = 'block';
        btn.textContent = '✅ Create Module';
        btn.disabled = false;

        // Refresh programs list
        await loadPrograms();

        setTimeout(() => closeCreateModule(), 6000);

    } catch (e) {
        console.error('Create module error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '✅ Create Module';
        btn.disabled = false;
    }
}

// Toggle offering section visibility
document.addEventListener('change', function(e) {
    if (e.target && e.target.id === 'cmCreateOffering') {
        const sec = document.getElementById('cmOfferingSection');
        if (sec) sec.style.display = e.target.checked ? 'grid' : 'none';
    }
});

// ============================================
// ENROLL STUDENT MODAL
// ============================================
let activeOfferingsCache = [];

async function openEnrollStudent() {
    // Reset
    document.getElementById('esStudent').value = '';
    document.getElementById('esFilterProgram').value = '';
    document.getElementById('esOffering').value = '';
    document.getElementById('esError').style.display = 'none';
    document.getElementById('esSuccess').style.display = 'none';

    // Load students into dropdown
    const stuSel = document.getElementById('esStudent');
    try {
        const r = await apiRequest('/admin/scoped-students');
        if (r.ok) {
            const students = await r.json();
            stuSel.innerHTML = '<option value="">— Select Student —</option>' +
                students.map(s => `<option value="${s.student_number}">${s.student_number} — ${s.full_name}</option>`).join('');
        }
    } catch (e) { console.error('Students load error:', e); }

    // Load active offerings (cached)
    if (activeOfferingsCache.length === 0) {
        try {
            const r = await apiRequest('/admin/active-offerings');
            if (r.ok) activeOfferingsCache = await r.json();
        } catch (e) { console.error('Offerings load error:', e); }
    }

    // Populate program filter from offerings
    const progSel = document.getElementById('esFilterProgram');
    const uniquePrograms = [...new Set(activeOfferingsCache.map(o => o.program_code))];
    progSel.innerHTML = '<option value="">All Programs</option>' +
        uniquePrograms.map(p => `<option value="${p}">${p}</option>`).join('');

    // Populate offering list (all initially)
    renderEnrollOfferings();

    document.getElementById('enrollStudentModal').style.display = 'block';
}

function renderEnrollOfferings() {
    const offSel = document.getElementById('esOffering');
    const progFilter = document.getElementById('esFilterProgram').value;

    let list = activeOfferingsCache;
    if (progFilter) {
        list = list.filter(o => o.program_code === progFilter);
    }

    if (list.length === 0) {
        offSel.innerHTML = '<option value="">— No offerings found —</option>';
        return;
    }

    offSel.innerHTML = '<option value="">— Select Offering —</option>' +
        list.map(o => {
            const full = o.current_enrollment >= o.capacity ? ' [FULL]' : '';
            return `<option value="${o.offering_id}">
                ${o.program_code} · Y${o.year_of_study} S${o.curriculum_semester} · ${o.module_code} — ${o.module_name}${full}
            </option>`;
        }).join('');
}

function filterEnrollOfferings() {
    renderEnrollOfferings();
}

function closeEnrollStudent() {
    document.getElementById('enrollStudentModal').style.display = 'none';
}

async function submitEnrollStudent() {
    const errEl = document.getElementById('esError');
    const succEl = document.getElementById('esSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const studentNumber = document.getElementById('esStudent').value;
    const offeringId = parseInt(document.getElementById('esOffering').value);

    if (!studentNumber) {
        errEl.textContent = 'Please select a Student';
        errEl.style.display = 'block';
        return;
    }
    if (!offeringId) {
        errEl.textContent = 'Please select an Offering';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('esSubmitBtn');
    btn.textContent = '⏳ Enrolling...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/enroll-student', {
            method: 'POST',
            body: JSON.stringify({ studentNumber, offeringId })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Enrollment failed';
            errEl.style.display = 'block';
            btn.textContent = '✅ Enroll Student';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `
            <strong>✅ Enrolled!</strong><br>
            <strong>Student:</strong> ${data.studentName}<br>
            <strong>Module:</strong> ${data.moduleCode}
        `;
        succEl.style.display = 'block';
        btn.textContent = '✅ Enroll Student';
        btn.disabled = false;

        // Refresh offerings cache (enrollment counts changed)
        try {
            const r2 = await apiRequest('/admin/active-offerings');
            if (r2.ok) activeOfferingsCache = await r2.json();
        } catch (e) { /* ignore */ }

        // Refresh students list
        await loadStudents();

        setTimeout(() => closeEnrollStudent(), 4000);

    } catch (e) {
        console.error('Enroll error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '✅ Enroll Student';
        btn.disabled = false;
    }
}


// ============================================
// REPORTS EXPORT — CSV
// ============================================
function downloadReportsCSV() {
    if (!offeringPerformance || offeringPerformance.length === 0) {
        alert('No report data to export. Load the Reports page first.');
        return;
    }

    // CSV columns
    const headers = [
        'Module Code', 'Module Name', 'Academic Year', 'Semester', 'Year of Study',
        'Department', 'School', 'Students', 'Avg Score (%)', 'Min (%)', 'Max (%)',
        'Pass Rate (%)', 'Pass Count', 'Fail Count'
    ];

    // Build data rows
    const rows = offeringPerformance.map(p => [
        p.module_code,
        p.module_name,
        p.year_name,
        p.semester_name,
        p.year_of_study,
        p.department_name,
        p.school_name,
        p.total_students,
        p.avg_score !== null ? parseFloat(p.avg_score).toFixed(2) : '',
        p.min_score !== null ? parseFloat(p.min_score).toFixed(2) : '',
        p.max_score !== null ? parseFloat(p.max_score).toFixed(2) : '',
        p.pass_rate !== null ? parseFloat(p.pass_rate).toFixed(1) : '',
        p.pass_count,
        p.fail_count
    ]);

    // Escape cells that contain commas, quotes, or newlines
    const escape = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
    };

    const csv = [
        headers.map(escape).join(','),
        ...rows.map(r => r.map(escape).join(','))
    ].join('\r\n');

    // Filename with date
    const date = new Date().toISOString().slice(0, 10);
    const scope = myScope && myScope.role ? myScope.role.toLowerCase() : 'admin';
    const filename = `mubas-report-${scope}-${date}.csv`;

    // Trigger download (BOM helps Excel open UTF-8 correctly)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}


// ============================================
// MODULES PAGE
// ============================================
async function loadModules() {
    try {
        const params = new URLSearchParams();
        const dept = document.getElementById('filterModuleDept')?.value;
        const search = document.getElementById('searchModules')?.value;
        if (dept) params.append('departmentId', dept);
        if (search) params.append('search', search);

        const r = await apiRequest('/admin/modules?' + params.toString());
        if (r.ok) {
            modulesList = await r.json();
            renderModules();
            populateModuleDeptFilter();
        }
    } catch (e) { console.error('Modules error:', e); }
}

function populateModuleDeptFilter() {
    const sel = document.getElementById('filterModuleDept');
    if (!sel || sel.options.length > 1) return;

    // Build a unique list from modules
    const seen = new Set();
    const uniqueDepts = [];
    modulesList.forEach(m => {
        if (m.dept_id && !seen.has(m.dept_id)) {
            seen.add(m.dept_id);
            uniqueDepts.push({ dept_id: m.dept_id, name: m.department_name });
        }
    });
    uniqueDepts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    sel.innerHTML = '<option value="">All Departments</option>' +
        uniqueDepts.map(d => `<option value="${d.dept_id}">${d.name}</option>`).join('');
}

function renderModules() {
    const tbody = document.getElementById('modulesBody');
    if (!tbody) return;

    if (!modulesList || modulesList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:30px;">No modules found</td></tr>';
        return;
    }

    let html = '';
    modulesList.forEach(m => {
        html += `
            <tr>
                <td><strong>${m.code}</strong></td>
                <td>${m.name}</td>
                <td style="text-align:center;">${m.credits}</td>
                <td style="text-align:center;">${m.level || '—'}</td>
                <td>${m.department_name || '—'}<br><span style="font-size:11px;color:#888;">${m.school_name || ''}</span></td>
                <td style="text-align:center;">${m.offering_count}</td>
                <td style="text-align:center;">${m.student_count}</td>
                <td style="text-align:center;white-space:nowrap;">
                    <button onclick="openEditModule(${m.module_id})" style="padding:6px 12px;background:#003366;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;margin-right:4px;">✏️ Edit</button>
                    <button onclick="deleteModule(${m.module_id}, '${m.code.replace(/'/g, '&#39;')}')" style="padding:6px 12px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">🗑️</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// Track currently-edited module id
let editingModuleId = null;

async function openEditModule(moduleId) {
    editingModuleId = moduleId;

    const errEl = document.getElementById('emError');
    const succEl = document.getElementById('emSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';
    document.getElementById('emSubmitBtn').textContent = '💾 Save Changes';
    document.getElementById('emSubmitBtn').disabled = false;

    try {
        const r = await apiRequest('/admin/module?moduleId=' + moduleId);
        if (!r.ok) {
            alert('Failed to load module');
            return;
        }
        const data = await r.json();
        const m = data.module;

        document.getElementById('editModuleCode').textContent = m.code;
        document.getElementById('emName').value = m.name || '';
        document.getElementById('emCredits').value = m.credits || 10;
        document.getElementById('emLevel').value = m.level || '';
        document.getElementById('emDescription').value = m.description || '';

        // Load departments if not already loaded
        const sel = document.getElementById('emDepartment');
        if (sel.options.length <= 1) {
            try {
                const r2 = await apiRequest('/admin/structure');
                if (r2.ok) {
                    const sd = await r2.json();
                    sel.innerHTML = '<option value="">— Select Department —</option>' +
                        sd.departments.map(d => `<option value="${d.dept_id}">${d.name}</option>`).join('');
                }
            } catch (e) { console.error('Dept load error:', e); }
        }
        sel.value = m.dept_id || '';

        document.getElementById('editModuleModal').style.display = 'block';
    } catch (e) {
        console.error('Open edit module error:', e);
        alert('Error: ' + e.message);
    }
}

function closeEditModule() {
    document.getElementById('editModuleModal').style.display = 'none';
    editingModuleId = null;
}

async function saveModule() {
    if (!editingModuleId) return;

    const errEl = document.getElementById('emError');
    const succEl = document.getElementById('emSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const payload = {
        moduleId: editingModuleId,
        name: document.getElementById('emName').value.trim(),
        credits: parseInt(document.getElementById('emCredits').value),
        level: document.getElementById('emLevel').value || null,
        description: document.getElementById('emDescription').value.trim() || null,
        departmentId: parseInt(document.getElementById('emDepartment').value)
    };

    if (!payload.name) {
        errEl.textContent = 'Module name is required.';
        errEl.style.display = 'block';
        return;
    }
    if (!payload.credits || payload.credits <= 0) {
        errEl.textContent = 'Credits must be greater than 0.';
        errEl.style.display = 'block';
        return;
    }
    if (!payload.departmentId) {
        errEl.textContent = 'Please select a department.';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('emSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/update-module', {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Update failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Save Changes';
            btn.disabled = false;
            return;
        }

        succEl.textContent = '✅ Module updated.';
        succEl.style.display = 'block';

        await loadModules();

        setTimeout(closeEditModule, 1200);
    } catch (e) {
        console.error('Save module error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save Changes';
        btn.disabled = false;
    }
}

async function deleteModule(moduleId, code) {
    if (!confirm(`Delete module ${code}?\n\nThis will also remove its curriculum entries and offerings.\nThis can only be done if no students are enrolled.`)) return;

    try {
        const r = await apiRequest('/admin/delete-module?moduleId=' + moduleId, {
            method: 'DELETE'
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Cannot delete: ' + (data.message || 'Failed'));
            return;
        }

        alert('✅ ' + data.message);
        await loadModules();
    } catch (e) {
        console.error('Delete module error:', e);
        alert('Network error: ' + e.message);
    }
}
