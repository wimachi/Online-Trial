// ============================================
// MUBAS ASSESSMENT SYSTEM - ACADEMIC POLICY CASES
// ============================================

let policyData = null;
let activeTab = 'referrals';

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';

    await loadPolicyCases();
    renderAll();
});

// ============================================
// NAVIGATION
// ============================================
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

function showTab(tab) {
    activeTab = tab;

    // Hide all content
    document.getElementById('content-referrals').style.display = 'none';
    document.getElementById('content-carryovers').style.display = 'none';
    document.getElementById('content-repeats').style.display = 'none';

    // Show selected
    document.getElementById('content-' + tab).style.display = 'block';

    // Update tab styles
    const tabs = {
        referrals: document.getElementById('tabReferrals'),
        carryovers: document.getElementById('tabCarryovers'),
        repeats: document.getElementById('tabRepeats')
    };

    const colors = {
        referrals: '#003366',
        carryovers: '#17a2b8',
        repeats: '#dc3545'
    };

    Object.keys(tabs).forEach(key => {
        if (key === tab) {
            tabs[key].style.background = colors[key];
            tabs[key].style.color = 'white';
        } else {
            tabs[key].style.background = '#f0f4f8';
            tabs[key].style.color = '#333';
        }
    });
}

// ============================================
// LOADER
// ============================================
async function loadPolicyCases() {
    try {
        const r = await apiRequest('/admin/policy-cases');
        if (r.ok) {
            policyData = await r.json();
        } else {
            console.error('Failed to load policy cases');
        }
    } catch (e) {
        console.error('Policy cases error:', e);
    }
}

// ============================================
// RENDER
// ============================================
function renderAll() {
    if (!policyData) return;

    // Summary cards
    document.getElementById('countReferrals').textContent = policyData.counts.referrals;
    document.getElementById('countCarryovers').textContent = policyData.counts.carryovers;
    document.getElementById('countRepeats').textContent = policyData.counts.repeats;
    document.getElementById('countTotal').textContent = policyData.counts.total;

    // Tab counts
    document.getElementById('tabCountReferrals').textContent = policyData.counts.referrals;
    document.getElementById('tabCountCarryovers').textContent = policyData.counts.carryovers;
    document.getElementById('tabCountRepeats').textContent = policyData.counts.repeats;

    renderReferrals();
    renderCarryovers();
    renderRepeats();
}

// ============================================
// REFERRALS
// ============================================
function renderReferrals() {
    const tbody = document.getElementById('referralsBody');
    const rows = policyData.referrals || [];

    if (rows.length === 0) {
        tbody.innerHTML = `
                <tr><td colspan="8" style="text-align:center;color:#888;padding:40px;">
                <div style="font-size:48px;margin-bottom:10px;">✅</div>
                <strong>No Active Referrals</strong>
                <div style="font-size:12px;margin-top:5px;">All students have passed their referred modules.</div>
            </td></tr>
        `;
        return;
    }

    let html = '';
    rows.forEach(r => {
        const statusBadge = getStatusBadge(r.status);
        const typeBadge = r.is_core
            ? '<span style="background:#003366;color:white;padding:2px 8px;border-radius:10px;font-size:10px;">CORE</span>'
            : '<span style="background:#6c757d;color:white;padding:2px 8px;border-radius:10px;font-size:10px;">NON-CORE</span>';

                const actionCell = r.status === 'Pending'
            ? `<button onclick="openProcessModal('referral', ${r.referral_id})" style="padding:6px 14px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">▶ Process</button>`
            : `<span style="color:#888;font-size:11px;">—</span>`;

        html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px;">
                    <strong>${r.student_name}</strong><br>
                    <span style="font-size:11px;color:#888;">${r.student_number} · Year ${r.current_year_of_study}</span>
                </td>
                <td style="padding:12px;">
                    <strong>${r.module_code}</strong><br>
                    <span style="font-size:11px;color:#888;">${r.module_name}</span>
                </td>
                <td style="padding:12px;text-align:center;">${r.credits}</td>
                <td style="padding:12px;text-align:center;">${typeBadge}</td>
                <td style="padding:12px;text-align:center;font-weight:700;color:#dc3545;">${parseFloat(r.original_grade_points).toFixed(2)}</td>
                <td style="padding:12px;text-align:center;font-size:12px;">
                    ${r.semester_name}<br>
                    <span style="color:#888;">${r.year_name}</span>
                </td>
                <td style="padding:12px;text-align:center;">${statusBadge}</td>
                <td style="padding:12px;text-align:center;">${actionCell}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// CARRYOVERS
// ============================================
function renderCarryovers() {
    const tbody = document.getElementById('carryoversBody');
    const rows = policyData.carryovers || [];

    if (rows.length === 0) {
        tbody.innerHTML = `
                        <tr><td colspan="7" style="text-align:center;color:#888;padding:40px;">
                <div style="font-size:48px;margin-bottom:10px;">✅</div>
                <strong>No Active Carryovers</strong>
                <div style="font-size:12px;margin-top:5px;">All non-core failed modules have been resolved.</div>
            </td></tr>
        `;
        return;
    }

        let html = '';
    rows.forEach(r => {
        const statusBadge = getStatusBadge(r.status);

        const actionCell = r.status === 'Pending'
            ? `<button onclick="openProcessModal('carryover', ${r.carryover_id})" style="padding:6px 14px;background:#17a2b8;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">▶ Process</button>`
            : `<span style="color:#888;font-size:11px;">—</span>`;

        html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px;">
                    <strong>${r.student_name}</strong><br>
                    <span style="font-size:11px;color:#888;">${r.student_number} · Year ${r.current_year_of_study}</span>
                </td>
                <td style="padding:12px;">
                    <strong>${r.module_code}</strong><br>
                    <span style="font-size:11px;color:#888;">${r.module_name}</span>
                </td>
                <td style="padding:12px;text-align:center;">${r.credits}</td>
                <td style="padding:12px;text-align:center;font-weight:700;color:#17a2b8;">${parseFloat(r.original_grade_points).toFixed(2)}</td>
                <td style="padding:12px;text-align:center;font-size:12px;">
                    ${r.semester_name}<br>
                    <span style="color:#888;">${r.year_name}</span>
                </td>
                <td style="padding:12px;text-align:center;">${statusBadge}</td>
                <td style="padding:12px;text-align:center;">${actionCell}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// REPEATS
// ============================================
function renderRepeats() {
    const tbody = document.getElementById('repeatsBody');
    const rows = policyData.repeats || [];

    if (rows.length === 0) {
        tbody.innerHTML = `
                <tr><td colspan="8" style="text-align:center;color:#888;padding:40px;">
                <div style="font-size:48px;margin-bottom:10px;">✅</div>
                <strong>No Active Repeats</strong>
                <div style="font-size:12px;margin-top:5px;">No students are currently repeating modules.</div>
            </td></tr>
        `;
        return;
    }

        let html = '';
    rows.forEach(r => {
        const statusBadge = getStatusBadge(r.status);
        const attemptBadge = `<span style="background:#f0f4f8;color:#333;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;">Attempt ${r.repeat_attempt}</span>`;

        const actionCell = r.status === 'Enrolled'
            ? `<button onclick="openProcessModal('repeat', ${r.repeat_id})" style="padding:6px 14px;background:#dc3545;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">▶ Process</button>`
            : `<span style="color:#888;font-size:11px;">—</span>`;

        html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:12px;">
                    <strong>${r.student_name}</strong><br>
                    <span style="font-size:11px;color:#888;">${r.student_number} · Year ${r.current_year_of_study}</span>
                </td>
                <td style="padding:12px;">
                    <strong>${r.module_code}</strong><br>
                    <span style="font-size:11px;color:#888;">${r.module_name}</span>
                </td>
                <td style="padding:12px;text-align:center;">${r.credits}</td>
                <td style="padding:12px;text-align:center;">${attemptBadge}</td>
                <td style="padding:12px;text-align:center;font-weight:700;color:#dc3545;">${parseFloat(r.original_grade_points).toFixed(2)}</td>
                <td style="padding:12px;text-align:center;font-size:12px;">
                    ${r.semester_name}<br>
                    <span style="color:#888;">${r.year_name}</span>
                </td>
                <td style="padding:12px;text-align:center;">${statusBadge}</td>
                <td style="padding:12px;text-align:center;">${actionCell}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// HELPERS
// ============================================
function getStatusBadge(status) {
    const styles = {
        'Pending':   { bg: '#ffc107', color: '#333', label: '⏳ Pending' },
        'Enrolled':  { bg: '#17a2b8', color: 'white', label: '📘 Enrolled' },
        'Passed':    { bg: '#28a745', color: 'white', label: '✅ Passed' },
        'Failed':    { bg: '#dc3545', color: 'white', label: '❌ Failed' },
        'Withdrawn': { bg: '#6c757d', color: 'white', label: '🚫 Withdrawn' }
    };
    const s = styles[status] || styles['Pending'];
    return `<span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span>`;
}



// ============================================
// PROCESS MODAL
// ============================================
let currentCase = null; // { type: 'referral'|'carryover'|'repeat', row: {...} }

function openProcessModal(type, id) {
    // Find the row in cached policyData
    let row = null;
    if (type === 'referral')   row = (policyData.referrals  || []).find(x => x.referral_id  === id);
    if (type === 'carryover')  row = (policyData.carryovers || []).find(x => x.carryover_id === id);
    if (type === 'repeat')     row = (policyData.repeats    || []).find(x => x.repeat_id    === id);

    if (!row) { alert('Case not found. Refresh the page.'); return; }

    currentCase = { type, row, id };

    // Configure the modal for this type
    const titles = {
        referral:  { title: '📕 Process Referral',   subtitle: 'Rule 4.8.2 — pass caps at 2.00' },
        carryover: { title: '📘 Process Carryover',  subtitle: 'Rule 4.9.5 — pass caps at 2.00 · fail → repeat' },
        repeat:    { title: '📗 Process Repeat',     subtitle: 'Rule 4.10.3 — actual grade · fail → withdraw' }
    };
    const t = titles[type] || { title: 'Process Case', subtitle: '' };
    document.getElementById('pmTitle').textContent    = t.title;
    document.getElementById('pmSubtitle').textContent = t.subtitle;

    // Summary line
    document.getElementById('pmSummary').innerHTML = `
        <div><strong>Student:</strong> ${row.student_name} <span style="color:#888;">(${row.student_number})</span></div>
        <div><strong>Module:</strong> ${row.module_code} — ${row.module_name}</div>
        <div><strong>Credits:</strong> ${row.credits}</div>
        <div><strong>Semester:</strong> ${row.semester_name} · ${row.year_name}</div>
        <div><strong>Original GP:</strong> ${parseFloat(row.original_grade_points).toFixed(2)}</div>
    `;

    // Reset fields
    document.getElementById('pmPassed').checked = true;
    document.getElementById('pmGradePoints').value = '2.00';
    document.getElementById('pmRemarks').value = '';
    document.getElementById('pmError').style.display = 'none';
    document.getElementById('pmSuccess').style.display = 'none';
    document.getElementById('pmSubmitBtn').textContent = '✓ Process';
    document.getElementById('pmSubmitBtn').disabled = false;

    // Grade points input only shows for repeats
    document.getElementById('pmGradeContainer').style.display =
        (type === 'repeat') ? 'block' : 'none';

    updateOutcomeVisuals();
    document.getElementById('processModal').style.display = 'block';
}

function closeProcessModal() {
    document.getElementById('processModal').style.display = 'none';
    currentCase = null;
}

// Visual feedback when radio changes
function updateOutcomeVisuals() {
    const passed = document.getElementById('pmPassed').checked;
    const passLabel = document.getElementById('pmPassLabel');
    const failLabel = document.getElementById('pmFailLabel');

    if (passed) {
        passLabel.style.borderColor = '#28a745';
        passLabel.style.background  = '#eaf7ee';
        failLabel.style.borderColor = '#ccc';
        failLabel.style.background  = 'white';
    } else {
        failLabel.style.borderColor = '#dc3545';
        failLabel.style.background  = '#fdeeee';
        passLabel.style.borderColor = '#ccc';
        passLabel.style.background  = 'white';
    }
}

async function submitProcess() {
    if (!currentCase) return;

    const errEl = document.getElementById('pmError');
    const succEl = document.getElementById('pmSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const passed  = document.getElementById('pmPassed').checked;
    const remarks = document.getElementById('pmRemarks').value.trim() || null;
    const gradePoints = parseFloat(document.getElementById('pmGradePoints').value);

    // Build payload + endpoint
    let endpoint, payload;
    if (currentCase.type === 'referral') {
        endpoint = '/admin/process-referral';
        payload  = { referralId: currentCase.id, passed, remarks };
    } else if (currentCase.type === 'carryover') {
        endpoint = '/admin/process-carryover';
        payload  = { carryoverId: currentCase.id, passed, remarks };
    } else {
        endpoint = '/admin/process-repeat';
        payload  = { repeatId: currentCase.id, passed, remarks };
        if (passed) {
            if (isNaN(gradePoints) || gradePoints < 0 || gradePoints > 4) {
                errEl.textContent = 'Please enter a valid grade point between 0.00 and 4.00.';
                errEl.style.display = 'block';
                return;
            }
            payload.actualGradePoints = gradePoints;
        }
    }

    // Confirmation for destructive actions
    if (!passed) {
        const warnings = {
            referral:  'Mark this referral as FAILED? The student will need to repeat the module.',
            carryover: 'Mark this carryover as FAILED? A repeat record will be created.',
            repeat:    '⚠️ Mark this repeat as FAILED? This will WITHDRAW the student on academic grounds. This cannot be undone.'
        };
        if (!confirm(warnings[currentCase.type])) return;
    }

    const btn = document.getElementById('pmSubmitBtn');
    btn.textContent = '⏳ Processing...';
    btn.disabled = true;

    try {
        const r = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Processing failed';
            errEl.style.display = 'block';
            btn.textContent = '✓ Process';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `
            <strong>✅ ${data.message || 'Done'}</strong><br>
            <strong>New status:</strong> ${data.new_status}<br>
            <strong>Result GP:</strong> ${data.result_grade_points !== null ? parseFloat(data.result_grade_points).toFixed(2) : '—'}<br>
            ${data.student_withdrawn ? '<strong style="color:#dc3545;">⚠️ Student withdrawn on academic grounds.</strong><br>' : ''}
            <em>${data.note || ''}</em>
        `;
        succEl.style.display = 'block';

        // Reload data, then close modal after a short delay
        await loadPolicyCases();
        renderAll();
        setTimeout(closeProcessModal, 2500);

    } catch (e) {
        console.error('Process error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '✓ Process';
        btn.disabled = false;
    }
}

// Hook up radio button visual feedback once the page is ready
document.addEventListener('DOMContentLoaded', () => {
    const radioPass = document.getElementById('pmPassed');
    const radioFail = document.querySelector('input[name="pmOutcome"][value="failed"]');
    if (radioPass) radioPass.addEventListener('change', updateOutcomeVisuals);
    if (radioFail) radioFail.addEventListener('change', updateOutcomeVisuals);
});