// ============================================
// MUBAS - STUDENT PROGRAMME CHANGE
// ============================================

let myChanges = [];
let allPrograms = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Student';
    await Promise.all([loadChanges(), loadPrograms()]);
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadChanges() {
    try {
        const r = await apiRequest('/students/my-program-changes');
        if (r.ok) myChanges = await r.json();
    } catch (e) { console.error(e); }
    renderChanges();
}

async function loadPrograms() {
    try {
        // Reuse programs list via existing endpoint
        const r = await apiRequest('/admin/programs');
        if (r.ok) allPrograms = await r.json();
    } catch (e) { console.error(e); }
}

function renderChanges() {
    const tbody = document.getElementById('changesBody');
    if (!myChanges || myChanges.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:40px;">No change requests on file.</td></tr>';
        return;
    }
    const colors = {
        'Requested': { bg: '#ffc107', color: '#333', label: '⏳ Requested' },
        'Approved':  { bg: '#28a745', color: 'white', label: '✅ Approved' },
        'Rejected':  { bg: '#dc3545', color: 'white', label: '❌ Rejected' },
        'Withdrawn': { bg: '#6c757d', color: 'white', label: '🚫 Withdrawn' }
    };
    let html = '';
    myChanges.forEach(c => {
        const s = colors[c.status] || colors['Requested'];
        const req = new Date(c.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td style="font-size:12px;"><strong>${c.from_code}</strong> — ${c.from_name}</td>
                <td style="font-size:12px;"><strong>${c.to_code}</strong> — ${c.to_name}</td>
                <td style="font-size:12px;color:#666;">${c.reason || '—'}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="font-size:12px;color:#666;">${c.decision_remarks ? `"${c.decision_remarks}"` : '<em style="color:#aaa;">—</em>'}</td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function openChangeModal() {
    const pending = myChanges.find(c => c.status === 'Requested');
    if (pending) {
        alert('You already have a pending change request.');
        return;
    }
    const sel = document.getElementById('toProgram');
    sel.innerHTML = '<option value="">— Select Programme —</option>' +
        allPrograms.map(p => `<option value="${p.program_id}">${p.code} — ${p.name}</option>`).join('');
    document.getElementById('changeReason').value = '';
    document.getElementById('chError').style.display = 'none';
    document.getElementById('chSuccess').style.display = 'none';
    document.getElementById('chSubmitBtn').textContent = '📤 Submit';
    document.getElementById('chSubmitBtn').disabled = false;
    document.getElementById('changeModal').style.display = 'block';
}

function closeChangeModal() {
    document.getElementById('changeModal').style.display = 'none';
}

async function submitChange() {
    const errEl = document.getElementById('chError');
    const succEl = document.getElementById('chSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const toProgramId = parseInt(document.getElementById('toProgram').value);
    const reason = document.getElementById('changeReason').value.trim();

    if (!toProgramId) { errEl.textContent = 'Please select a programme.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('chSubmitBtn');
    btn.textContent = '⏳ Submitting...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/students/request-program-change', {
            method: 'POST',
            body: JSON.stringify({ toProgramId, reason: reason || null })
        });
        const data = await r.json();
        if (!r.ok) {
            errEl.textContent = data.message || 'Failed';
            errEl.style.display = 'block';
            btn.textContent = '📤 Submit';
            btn.disabled = false;
            return;
        }
        succEl.innerHTML = `<strong>✅ ${data.message}</strong><br><em>${data.note}</em>`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Submitted';
        await loadChanges();
        setTimeout(closeChangeModal, 2000);
    } catch (e) {
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '📤 Submit';
        btn.disabled = false;
    }
}