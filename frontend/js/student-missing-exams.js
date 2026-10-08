// ============================================
// MUBAS - STUDENT MISSING EXAMS
// ============================================

let myMissingExams = [];
let myAssessments = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Student';

    await Promise.all([loadMissingExams(), loadAssessments()]);
    renderMissingExams();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadMissingExams() {
    try {
        const r = await apiRequest('/students/my-missing-exams');
        if (r.ok) myMissingExams = await r.json();
    } catch (e) { console.error('Missing exams load error:', e); }
}

async function loadAssessments() {
    try {
        const r = await apiRequest('/students/my-upcoming-assessments');
        if (r.ok) myAssessments = await r.json();
    } catch (e) { console.error('Assessments load error:', e); }
}

function renderMissingExams() {
    const tbody = document.getElementById('missingBody');
    if (!myMissingExams || myMissingExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:40px;">No missing exam requests on file.</td></tr>';
        return;
    }

    const colors = {
        'Requested': { bg: '#ffc107', color: '#333', label: '⏳ Requested' },
        'Approved':  { bg: '#28a745', color: 'white', label: '✅ Approved' },
        'Rejected':  { bg: '#dc3545', color: 'white', label: '❌ Rejected' },
        'Completed': { bg: '#17a2b8', color: 'white', label: '🔵 Completed' }
    };

    let html = '';
    myMissingExams.forEach(m => {
        const s = colors[m.status] || colors['Requested'];
        const req = new Date(m.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td>
                    <strong>${m.module_code}</strong> — ${m.module_name}<br>
                    <span style="font-size:11px;color:#888;">${m.assessment_name} (${m.assessment_type})</span>
                </td>
                <td style="font-size:12px;">${m.reason_category}${m.reason_details ? `<br><span style="color:#888;">${m.reason_details.substring(0, 60)}${m.reason_details.length > 60 ? '…' : ''}</span>` : ''}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="font-size:12px;">${m.resit_date || '—'}</td>
                <td style="font-size:12px;color:#666;max-width:280px;">${m.decision_remarks ? `"${m.decision_remarks}"` : '<em style="color:#aaa;">—</em>'}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function openMissingModal() {
    const sel = document.getElementById('meAssessment');
    if (!myAssessments || myAssessments.length === 0) {
        alert('No assessments found for your current modules.');
        return;
    }

    // Sort by due date (most recent first)
    const sorted = [...myAssessments].sort((a, b) => new Date(b.due_date) - new Date(a.due_date));

    sel.innerHTML = '<option value="">— Select Assessment —</option>' +
        sorted.map(a => {
            const dueStr = a.due_date ? new Date(a.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
            return `<option value="${a.assessment_id}">${a.module_code} — ${a.assessment_name} (${a.assessment_type}) · Due ${dueStr}</option>`;
        }).join('');

    document.getElementById('meReason').value = 'Illness';
    document.getElementById('meDetails').value = '';
    document.getElementById('meDocs').value = '';
    document.getElementById('meError').style.display = 'none';
    document.getElementById('meSuccess').style.display = 'none';
    document.getElementById('meSubmitBtn').textContent = '📤 Submit';
    document.getElementById('meSubmitBtn').disabled = false;

    document.getElementById('missingModal').style.display = 'block';
}

function closeMissingModal() {
    document.getElementById('missingModal').style.display = 'none';
}

async function submitMissing() {
    const errEl = document.getElementById('meError');
    const succEl = document.getElementById('meSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const assessmentId = parseInt(document.getElementById('meAssessment').value);
    const reasonCategory = document.getElementById('meReason').value;
    const reasonDetails = document.getElementById('meDetails').value.trim();
    const supportingDocuments = document.getElementById('meDocs').value.trim();

    if (!assessmentId) {
        errEl.textContent = 'Please select an assessment.';
        errEl.style.display = 'block';
        return;
    }
    if (!reasonDetails || reasonDetails.length < 10) {
        errEl.textContent = 'Please explain what happened (at least 10 characters).';
        errEl.style.display = 'block';
        return;
    }

    // Warn on "No Valid Reason"
    if (reasonCategory === 'No Valid Reason') {
        if (!confirm('⚠️ You are declaring NO valid reason. This will result in a grade of ZERO for this assessment. Proceed?')) return;
    }

    const btn = document.getElementById('meSubmitBtn');
    btn.textContent = '⏳ Submitting...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/students/request-missing-exam', {
            method: 'POST',
            body: JSON.stringify({
                assessmentId,
                reasonCategory,
                reasonDetails,
                supportingDocuments: supportingDocuments || null
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Submission failed';
            errEl.style.display = 'block';
            btn.textContent = '📤 Submit';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = '<strong>✅ Request submitted.</strong><br>You will be notified once it is reviewed.';
        succEl.style.display = 'block';
        btn.textContent = '✓ Submitted';

        await loadMissingExams();
        renderMissingExams();
        setTimeout(closeMissingModal, 1800);
    } catch (e) {
        console.error('Submit missing exam error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '📤 Submit';
        btn.disabled = false;
    }
}