// ============================================
// MUBAS - ADMIN PROGRAMME CHANGES
// ============================================

let allChanges = [];
let currentChange = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';
    await loadChanges();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadChanges() {
    try {
        const r = await apiRequest('/admin/program-changes');
        if (!r.ok) {
            document.getElementById('changesBody').innerHTML =
                '<tr><td colspan="7" style="text-align:center;color:#dc3545;padding:30px;">Failed to load.</td></tr>';
            return;
        }
        allChanges = await r.json();
        renderAll();
    } catch (e) { console.error(e); }
}

function renderAll() {
    const counts = { Requested: 0, Approved: 0, Rejected: 0, Withdrawn: 0 };
    allChanges.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });
    document.getElementById('countRequested').textContent = counts.Requested;
    document.getElementById('countApproved').textContent = counts.Approved;
    document.getElementById('countRejected').textContent = counts.Rejected;
    document.getElementById('countTotal').textContent = allChanges.length;
    renderChanges();
}

function renderChanges() {
    const tbody = document.getElementById('changesBody');
    const statusFilter = document.getElementById('filterStatus').value;
    const searchText = (document.getElementById('searchChanges').value || '').toLowerCase().trim();
    let list = allChanges;
    if (statusFilter) list = list.filter(c => c.status === statusFilter);
    if (searchText) list = list.filter(c => (c.student_name + ' ' + c.student_number).toLowerCase().includes(searchText));
    document.getElementById('changeCount').textContent = `${list.length} of ${allChanges.length}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:40px;">No requests match.</td></tr>';
        return;
    }
    const colors = {
        'Requested': { bg: '#ffc107', color: '#333', label: '⏳ Requested' },
        'Approved':  { bg: '#28a745', color: 'white', label: '✅ Approved' },
        'Rejected':  { bg: '#dc3545', color: 'white', label: '❌ Rejected' },
        'Withdrawn': { bg: '#6c757d', color: 'white', label: '🚫 Withdrawn' }
    };
    let html = '';
    list.forEach(c => {
        const s = colors[c.status] || colors['Requested'];
        const req = new Date(c.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const actionCell = c.status === 'Requested'
            ? `<button onclick="openDecideModal(${c.change_id})" style="padding:6px 14px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">🔄 Decide</button>`
            : '<span style="color:#888;font-size:11px;">Finalized</span>';
        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td><strong>${c.student_name}</strong><br><span style="font-size:11px;color:#888;">${c.student_number} · Y${c.current_year_of_study}</span></td>
                <td style="font-size:12px;"><strong>${c.from_code}</strong><br><span style="color:#888;">${c.from_name}</span></td>
                <td style="font-size:12px;"><strong>${c.to_code}</strong><br><span style="color:#888;">${c.to_name}</span></td>
                <td style="font-size:12px;color:#666;max-width:220px;">${c.reason || '—'}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="text-align:center;white-space:nowrap;">${actionCell}</td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function openDecideModal(changeId) {
    const c = allChanges.find(x => x.change_id === changeId);
    if (!c) { alert('Request not found.'); return; }
    currentChange = c;
    document.getElementById('decideSubtitle').textContent = `#${c.change_id} · ${c.student_name}`;
    document.getElementById('decideDetails').innerHTML = `
        <div><strong>Student:</strong> ${c.student_name} <span style="color:#888;">(${c.student_number})</span></div>
        <div><strong>From:</strong> ${c.from_code} — ${c.from_name}</div>
        <div><strong>To:</strong> ${c.to_code} — ${c.to_name}</div>
        ${c.reason ? `<div><strong>Reason:</strong> <em style="color:#555;">${c.reason}</em></div>` : ''}
    `;
    document.querySelector('input[name="cpDecision"][value="Approved"]').checked = true;
    document.getElementById('decideRemarks').value = '';
    document.getElementById('decideError').style.display = 'none';
    document.getElementById('decideSuccess').style.display = 'none';
    document.getElementById('decideSubmitBtn').textContent = '💾 Save';
    document.getElementById('decideSubmitBtn').disabled = false;
    document.getElementById('decideModal').style.display = 'block';
}

function closeDecideModal() {
    document.getElementById('decideModal').style.display = 'none';
    currentChange = null;
}

async function submitDecision() {
    if (!currentChange) return;
    const errEl = document.getElementById('decideError');
    const succEl = document.getElementById('decideSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const selected = document.querySelector('input[name="cpDecision"]:checked');
    if (!selected) { errEl.textContent = 'Please select a decision.'; errEl.style.display = 'block'; return; }
    const decision = selected.value;
    const remarks = document.getElementById('decideRemarks').value.trim() || null;

    if (decision === 'Approved' && !confirm(`Approve transfer to ${currentChange.to_code}?\n\nThe student's programme will be updated immediately.`)) return;

    const btn = document.getElementById('decideSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/decide-program-change', {
            method: 'PUT',
            body: JSON.stringify({ changeId: currentChange.change_id, decision, remarks })
        });
        const data = await r.json();
        if (!r.ok) {
            errEl.textContent = data.message || 'Failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Save';
            btn.disabled = false;
            return;
        }
        succEl.innerHTML = `<strong>✅ ${data.message}</strong>${data.student_moved ? '<br>Student programme updated.' : ''}`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';
        await loadChanges();
        setTimeout(closeDecideModal, 1500);
    } catch (e) {
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save';
        btn.disabled = false;
    }
}