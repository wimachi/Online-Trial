// ============================================
// MUBAS - ADMIN MISSING EXAMS
// ============================================

let allMissingExams = [];
let currentMissing = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';

    // Set up the decision radio behavior
    document.querySelectorAll('input[name="mDecision"]').forEach(radio => {
        radio.addEventListener('change', toggleResitDate);
    });

    await loadMissingExams();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

function toggleResitDate() {
    const selected = document.querySelector('input[name="mDecision"]:checked');
    const wrap = document.getElementById('resitDateWrap');
    if (selected && selected.value === 'Approved') {
        wrap.style.display = 'block';
    } else {
        wrap.style.display = 'none';
    }
}

async function loadMissingExams() {
    try {
        const r = await apiRequest('/admin/missing-exams');
        if (!r.ok) {
            document.getElementById('missingBody').innerHTML =
                '<tr><td colspan="7" style="text-align:center;color:#dc3545;padding:30px;">Failed to load.</td></tr>';
            return;
        }
        allMissingExams = await r.json();
        renderAll();
    } catch (e) {
        console.error('Missing exams load error:', e);
    }
}

function renderAll() {
    const counts = { Requested: 0, Approved: 0, Rejected: 0, Completed: 0 };
    allMissingExams.forEach(m => { if (counts[m.status] !== undefined) counts[m.status]++; });

    document.getElementById('countRequested').textContent = counts.Requested;
    document.getElementById('countApproved').textContent = counts.Approved;
    document.getElementById('countCompleted').textContent = counts.Completed;
    document.getElementById('countTotal').textContent = allMissingExams.length;

    renderMissingExams();
}

function renderMissingExams() {
    const tbody = document.getElementById('missingBody');
    const statusFilter = document.getElementById('filterStatus').value;
    const searchText = (document.getElementById('searchMissing').value || '').toLowerCase().trim();

    let list = allMissingExams;
    if (statusFilter) list = list.filter(m => m.status === statusFilter);
    if (searchText) {
        list = list.filter(m => {
            const hay = (m.student_name + ' ' + m.student_number + ' ' + m.module_code + ' ' + m.assessment_name).toLowerCase();
            return hay.includes(searchText);
        });
    }

    document.getElementById('missingCount').textContent = `${list.length} of ${allMissingExams.length}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:40px;">No missing exam requests match.</td></tr>';
        return;
    }

    const colors = {
        'Requested': { bg: '#ffc107', color: '#333', label: '⏳ Requested' },
        'Approved':  { bg: '#28a745', color: 'white', label: '✅ Approved' },
        'Rejected':  { bg: '#dc3545', color: 'white', label: '❌ Rejected' },
        'Completed': { bg: '#17a2b8', color: 'white', label: '🔵 Completed' }
    };

    let html = '';
    list.forEach(m => {
        const s = colors[m.status] || colors['Requested'];
        const req = new Date(m.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        let actionCell = '<span style="color:#888;font-size:11px;">—</span>';
        if (m.status === 'Requested') {
            actionCell = `<button onclick="openDecideModal(${m.missing_exam_id})" style="padding:6px 14px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">📝 Decide</button>`;
        } else if (m.status === 'Approved') {
            actionCell = `<button onclick="completeMissing(${m.missing_exam_id})" style="padding:6px 14px;background:#17a2b8;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">🔵 Mark Completed</button>`;
        }

        const reasonBadgeColor = m.reason_category === 'No Valid Reason' ? '#dc3545' : 
                                 m.reason_category === 'Illness' ? '#17a2b8' :
                                 m.reason_category === 'Bereavement' ? '#6c757d' : '#003366';

        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td>
                    <strong>${m.student_name}</strong><br>
                    <span style="font-size:11px;color:#888;">${m.student_number} · Y${m.current_year_of_study}</span>
                </td>
                <td>
                    <strong>${m.module_code}</strong> — ${m.module_name}<br>
                    <span style="font-size:11px;color:#888;">${m.assessment_name} (${m.assessment_type})</span>
                </td>
                <td>
                    <span style="background:${reasonBadgeColor};color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">${m.reason_category}</span>
                    ${m.reason_details ? `<div style="font-size:11px;color:#666;margin-top:4px;max-width:220px;">${m.reason_details.substring(0, 80)}${m.reason_details.length > 80 ? '…' : ''}</div>` : ''}
                    ${m.supporting_documents ? `<div style="font-size:10px;color:#888;margin-top:2px;">📎 ${m.supporting_documents}</div>` : ''}
                </td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="font-size:12px;">${m.resit_date || '—'}</td>
                <td style="text-align:center;white-space:nowrap;">${actionCell}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// DECIDE MODAL
// ============================================
function openDecideModal(missingExamId) {
    const m = allMissingExams.find(x => x.missing_exam_id === missingExamId);
    if (!m) { alert('Request not found. Refresh the page.'); return; }

    currentMissing = m;
    document.getElementById('decideSubtitle').textContent =
        `#${m.missing_exam_id} · ${m.student_name}`;

    const warning = m.reason_category === 'No Valid Reason'
        ? '<div style="margin-top:8px;padding:8px;background:#fdeeee;color:#721c24;border-radius:4px;"><strong>⚠️ No Valid Reason declared</strong> — will automatically award zero.</div>'
        : '';

    document.getElementById('decideDetails').innerHTML = `
        <div><strong>Student:</strong> ${m.student_name} <span style="color:#888;">(${m.student_number})</span></div>
        <div><strong>Module:</strong> ${m.module_code} — ${m.module_name}</div>
        <div><strong>Assessment:</strong> ${m.assessment_name} (${m.assessment_type}) · ${m.weight_percentage}% weight · max ${m.max_score}</div>
        <div><strong>Reason Category:</strong> ${m.reason_category}</div>
        <div><strong>Details:</strong> <em style="color:#555;">${m.reason_details || '—'}</em></div>
        ${m.supporting_documents ? `<div><strong>Documents:</strong> ${m.supporting_documents}</div>` : ''}
        ${warning}
    `;

    document.querySelector('input[name="mDecision"][value="Approved"]').checked = true;
    document.getElementById('resitDate').value = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    document.getElementById('decisionRemarks').value = '';
    document.getElementById('decideError').style.display = 'none';
    document.getElementById('decideSuccess').style.display = 'none';
    document.getElementById('decideSubmitBtn').textContent = '💾 Save';
    document.getElementById('decideSubmitBtn').disabled = false;

    toggleResitDate();
    document.getElementById('decideModal').style.display = 'block';
}

function closeDecideModal() {
    document.getElementById('decideModal').style.display = 'none';
    currentMissing = null;
}

async function submitDecision() {
    if (!currentMissing) return;

    const errEl = document.getElementById('decideError');
    const succEl = document.getElementById('decideSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const selected = document.querySelector('input[name="mDecision"]:checked');
    if (!selected) {
        errEl.textContent = 'Please select a decision.';
        errEl.style.display = 'block';
        return;
    }
    const decision = selected.value;
    const remarks = document.getElementById('decisionRemarks').value.trim() || null;
    const resitDate = document.getElementById('resitDate').value;

    if (decision === 'Approved' && !resitDate) {
        errEl.textContent = 'Please choose a resit date.';
        errEl.style.display = 'block';
        return;
    }

    if (decision === 'Rejected') {
        if (!confirm('Reject this request? A grade of ZERO will be applied if none exists (PDF §5.3).')) return;
    }

    const btn = document.getElementById('decideSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/decide-missing-exam', {
            method: 'PUT',
            body: JSON.stringify({
                missingExamId: currentMissing.missing_exam_id,
                decision,
                resitDate: decision === 'Approved' ? resitDate : null,
                remarks
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed to save';
            errEl.style.display = 'block';
            btn.textContent = '💾 Save';
            btn.disabled = false;
            return;
        }

        let summary = `<strong>✅ ${data.message}</strong>`;
        if (data.resit_date) summary += `<br><strong>Resit Date:</strong> ${data.resit_date}`;
        if (data.zero_grade_applied) summary += '<br><strong style="color:#dc3545;">⚠️ Zero grade applied for this assessment.</strong>';

        succEl.innerHTML = summary;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';

        await loadMissingExams();
        setTimeout(closeDecideModal, 1800);
    } catch (e) {
        console.error('Decide missing exam error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save';
        btn.disabled = false;
    }
}

// ============================================
// MARK COMPLETED
// ============================================
async function completeMissing(missingExamId) {
    const m = allMissingExams.find(x => x.missing_exam_id === missingExamId);
    if (!m) return;

    const remarks = prompt(`Mark ${m.student_name}'s resit as COMPLETED?\n\nOptional remarks (leave blank if none):`, '');
    if (remarks === null) return;  // user clicked Cancel

    try {
        const r = await apiRequest('/admin/complete-missing-exam', {
            method: 'PUT',
            body: JSON.stringify({ missingExamId, remarks: remarks || null })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            return;
        }

        alert('✅ ' + data.message);
        await loadMissingExams();
    } catch (e) {
        console.error('Complete missing exam error:', e);
        alert('Network error: ' + e.message);
    }
}