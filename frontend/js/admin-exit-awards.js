// ============================================
// MUBAS - ADMIN EXIT AWARDS
// ============================================

let allExits = [];
let currentExit = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';
    await loadExits();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadExits() {
    try {
        const r = await apiRequest('/admin/exit-awards');
        if (r.ok) allExits = await r.json();
    } catch (e) { console.error(e); }
    renderExits();
}

function renderExits() {
    const tbody = document.getElementById('exitBody');
    if (!allExits || allExits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:40px;">No exit awards on file.</td></tr>';
        return;
    }
    const colors = {
        'Proposed': { bg: '#ffc107', color: '#333', label: '⏳ Proposed' },
        'Approved': { bg: '#28a745', color: 'white', label: '✅ Approved' },
        'Rejected': { bg: '#dc3545', color: 'white', label: '❌ Rejected' }
    };
    let html = '';
    allExits.forEach(e => {
        const s = colors[e.status] || colors['Proposed'];
        const req = new Date(e.proposed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const actionCell = e.status === 'Proposed'
            ? `<button onclick="openDecideModal(${e.exit_id})" style="padding:6px 14px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">🎓 Decide</button>`
            : '<span style="color:#888;font-size:11px;">Finalized</span>';
        const typeBadge = e.exit_type === 'Diploma'
            ? '<span style="background:#17a2b8;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">DIPLOMA</span>'
            : '<span style="background:#6c757d;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;">CERTIFICATE</span>';
        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td><strong>${e.student_name}</strong><br><span style="font-size:11px;color:#888;">${e.student_number} · Y${e.current_year_of_study}</span></td>
                <td>${typeBadge}</td>
                <td style="text-align:center;font-weight:700;color:#003366;">${e.credits_achieved}</td>
                <td style="font-size:12px;">${e.award_date || '—'}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="text-align:center;white-space:nowrap;">${actionCell}</td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

async function openProposeModal() {
    document.getElementById('exReason').value = '';
    document.getElementById('exError').style.display = 'none';
    document.getElementById('exSuccess').style.display = 'none';
    document.getElementById('exSubmitBtn').textContent = '💾 Propose';
    document.getElementById('exSubmitBtn').disabled = false;

    const sel = document.getElementById('exStudent');
    try {
        const r = await apiRequest('/admin/scoped-students');
        if (r.ok) {
            const students = await r.json();
            sel.innerHTML = '<option value="">— Select Student —</option>' +
                students.map(s => `<option value="${s.student_number}">${s.student_number} — ${s.full_name}</option>`).join('');
        }
    } catch (e) { console.error(e); }

    document.getElementById('proposeModal').style.display = 'block';
}

function closeProposeModal() {
    document.getElementById('proposeModal').style.display = 'none';
}

async function submitPropose() {
    const errEl = document.getElementById('exError');
    const succEl = document.getElementById('exSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const studentNumber = document.getElementById('exStudent').value;
    const exitType = document.getElementById('exType').value;
    const reason = document.getElementById('exReason').value.trim();

    if (!studentNumber) { errEl.textContent = 'Please select a student.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('exSubmitBtn');
    btn.textContent = '⏳ Proposing...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/propose-exit-award', {
            method: 'POST',
            body: JSON.stringify({ studentNumber, exitType, reason: reason || null })
        });
        const data = await r.json();
        if (!r.ok) {
            errEl.textContent = data.message || 'Failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Propose';
            btn.disabled = false;
            return;
        }
        succEl.innerHTML = `<strong>✅ ${data.message}</strong><br><strong>Credits:</strong> ${data.credits_achieved} / ${data.required_credits}`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';
        await loadExits();
        setTimeout(closeProposeModal, 2500);
    } catch (e) {
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Propose';
        btn.disabled = false;
    }
}

function openDecideModal(exitId) {
    const e = allExits.find(x => x.exit_id === exitId);
    if (!e) { alert('Record not found.'); return; }
    currentExit = e;
    document.getElementById('decideSubtitle').textContent = `#${e.exit_id} · ${e.student_name}`;
    document.getElementById('decideDetails').innerHTML = `
        <div><strong>Student:</strong> ${e.student_name} (${e.student_number})</div>
        <div><strong>Current Year:</strong> ${e.current_year_of_study}</div>
        <div><strong>Exit Type:</strong> ${e.exit_type}</div>
        <div><strong>Credits Achieved:</strong> ${e.credits_achieved}</div>
        ${e.reason ? `<div><strong>Reason:</strong> <em style="color:#555;">${e.reason}</em></div>` : ''}
    `;
    document.querySelector('input[name="exDecision"][value="Approved"]').checked = true;
    document.getElementById('decideRemarks').value = '';
    document.getElementById('decideError').style.display = 'none';
    document.getElementById('decideSuccess').style.display = 'none';
    document.getElementById('decideSubmitBtn').textContent = '💾 Save';
    document.getElementById('decideSubmitBtn').disabled = false;
    document.getElementById('decideModal').style.display = 'block';
}

function closeDecideModal() {
    document.getElementById('decideModal').style.display = 'none';
    currentExit = null;
}

async function submitDecision() {
    if (!currentExit) return;
    const errEl = document.getElementById('decideError');
    const succEl = document.getElementById('decideSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';
    const selected = document.querySelector('input[name="exDecision"]:checked');
    if (!selected) { errEl.textContent = 'Please select a decision.'; errEl.style.display = 'block'; return; }
    const decision = selected.value;
    const remarks = document.getElementById('decideRemarks').value.trim() || null;

    const btn = document.getElementById('decideSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/decide-exit-award', {
            method: 'PUT',
            body: JSON.stringify({ exitId: currentExit.exit_id, decision, remarks })
        });
        const data = await r.json();
        if (!r.ok) {
            errEl.textContent = data.message || 'Failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Save';
            btn.disabled = false;
            return;
        }
        succEl.innerHTML = `<strong>✅ ${data.message}</strong>`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';
        await loadExits();
        setTimeout(closeDecideModal, 1500);
    } catch (e) {
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save';
        btn.disabled = false;
    }
}