// ============================================
// MUBAS - ADMIN POSTHUMOUS AWARDS
// ============================================

let allAwards = [];
let currentAward = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';
    await loadAwards();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadAwards() {
    try {
        const r = await apiRequest('/admin/posthumous-awards');
        if (r.ok) allAwards = await r.json();
    } catch (e) { console.error(e); }
    renderAwards();
}

function renderAwards() {
    const tbody = document.getElementById('awardsBody');
    if (!allAwards || allAwards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:40px;">No posthumous awards on file.</td></tr>';
        return;
    }
    const colors = {
        'Proposed':        { bg: '#ffc107', color: '#333', label: '⏳ Proposed' },
        'Senate_Approved': { bg: '#17a2b8', color: 'white', label: '📋 Senate Approved' },
        'Granted':         { bg: '#28a745', color: 'white', label: '✅ Granted' },
        'Rejected':        { bg: '#dc3545', color: 'white', label: '❌ Rejected' }
    };
    let html = '';
    allAwards.forEach(a => {
        const s = colors[a.status] || colors['Proposed'];
        const req = new Date(a.proposed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const actionCell = (a.status === 'Proposed' || a.status === 'Senate_Approved')
            ? `<button onclick="openDecideModal(${a.award_id})" style="padding:6px 14px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">🕊️ Decide</button>`
            : '<span style="color:#888;font-size:11px;">Finalized</span>';
        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td><strong>${a.student_name}</strong><br><span style="font-size:11px;color:#888;">${a.student_number}</span></td>
                <td style="font-size:12px;"><strong>${a.program_code}</strong><br><span style="color:#888;">${a.program_name}</span></td>
                <td style="text-align:center;font-size:12px;">${a.modules_passed} / ${a.total_modules}</td>
                <td style="text-align:center;font-weight:700;color:#17a2b8;">${parseFloat(a.pass_percentage).toFixed(1)}%</td>
                <td style="font-size:12px;color:#333;">${a.award_classification}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="text-align:center;white-space:nowrap;">${actionCell}</td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

async function openProposeModal() {
    document.getElementById('prReason').value = '';
    document.getElementById('prError').style.display = 'none';
    document.getElementById('prSuccess').style.display = 'none';
    document.getElementById('prSubmitBtn').textContent = '💾 Propose';
    document.getElementById('prSubmitBtn').disabled = false;

    const sel = document.getElementById('prStudent');
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
    const errEl = document.getElementById('prError');
    const succEl = document.getElementById('prSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';
    const studentNumber = document.getElementById('prStudent').value;
    const reason = document.getElementById('prReason').value.trim();
    if (!studentNumber) { errEl.textContent = 'Please select a student.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('prSubmitBtn');
    btn.textContent = '⏳ Proposing...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/propose-posthumous', {
            method: 'POST',
            body: JSON.stringify({ studentNumber, reason: reason || null })
        });
        const data = await r.json();
        if (!r.ok) {
            errEl.textContent = data.message || 'Failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Propose';
            btn.disabled = false;
            return;
        }
        succEl.innerHTML = `<strong>✅ ${data.message}</strong><br><strong>Classification:</strong> ${data.classification}<br><strong>Pass %:</strong> ${data.pass_percentage}%<br><em>${data.note}</em>`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';
        await loadAwards();
        setTimeout(closeProposeModal, 2500);
    } catch (e) {
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Propose';
        btn.disabled = false;
    }
}

function openDecideModal(awardId) {
    const a = allAwards.find(x => x.award_id === awardId);
    if (!a) { alert('Award not found.'); return; }
    currentAward = a;
    document.getElementById('decideSubtitle').textContent = `#${a.award_id} · ${a.student_name}`;
    document.getElementById('decideDetails').innerHTML = `
        <div><strong>Student:</strong> ${a.student_name} (${a.student_number})</div>
        <div><strong>Programme:</strong> ${a.program_code} — ${a.program_name}</div>
        <div><strong>Modules:</strong> ${a.modules_passed}/${a.total_modules} (${parseFloat(a.pass_percentage).toFixed(1)}%)</div>
        <div><strong>Classification:</strong> ${a.award_classification}</div>
        ${a.reason ? `<div><strong>Reason:</strong> <em style="color:#555;">${a.reason}</em></div>` : ''}
    `;
    document.querySelector('input[name="phDecision"][value="Granted"]').checked = true;
    document.getElementById('decideRemarks').value = '';
    document.getElementById('decideError').style.display = 'none';
    document.getElementById('decideSuccess').style.display = 'none';
    document.getElementById('decideSubmitBtn').textContent = '💾 Save';
    document.getElementById('decideSubmitBtn').disabled = false;
    document.getElementById('decideModal').style.display = 'block';
}

function closeDecideModal() {
    document.getElementById('decideModal').style.display = 'none';
    currentAward = null;
}

async function submitDecision() {
    if (!currentAward) return;
    const errEl = document.getElementById('decideError');
    const succEl = document.getElementById('decideSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';
    const selected = document.querySelector('input[name="phDecision"]:checked');
    if (!selected) { errEl.textContent = 'Please select a decision.'; errEl.style.display = 'block'; return; }
    const decision = selected.value;
    const remarks = document.getElementById('decideRemarks').value.trim() || null;

    const btn = document.getElementById('decideSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/decide-posthumous', {
            method: 'PUT',
            body: JSON.stringify({ awardId: currentAward.award_id, decision, remarks })
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
        await loadAwards();
        setTimeout(closeDecideModal, 1500);
    } catch (e) {
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save';
        btn.disabled = false;
    }
}