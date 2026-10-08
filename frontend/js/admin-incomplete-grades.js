// ============================================
// MUBAS - ADMIN INCOMPLETE GRADES
// ============================================

let allIncompletes = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';

    await loadIncompletes();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadIncompletes() {
    try {
        const r = await apiRequest('/admin/incomplete-grades');
        if (!r.ok) {
            document.getElementById('incompletesBody').innerHTML =
                '<tr><td colspan="7" style="text-align:center;color:#dc3545;padding:30px;">Failed to load.</td></tr>';
            return;
        }
        allIncompletes = await r.json();
        renderAll();
    } catch (e) {
        console.error('Incompletes load error:', e);
    }
}

function renderAll() {
    const counts = { Active: 0, Cleared: 0, Expired: 0 };
    allIncompletes.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });

    document.getElementById('countActive').textContent = counts.Active;
    document.getElementById('countCleared').textContent = counts.Cleared;
    document.getElementById('countExpired').textContent = counts.Expired;
    document.getElementById('countTotal').textContent = allIncompletes.length;

    renderIncompletes();
}

function renderIncompletes() {
    const tbody = document.getElementById('incompletesBody');
    const statusFilter = document.getElementById('filterStatus').value;
    const searchText = (document.getElementById('searchIncompletes').value || '').toLowerCase().trim();

    let list = allIncompletes;
    if (statusFilter) list = list.filter(i => i.status === statusFilter);
    if (searchText) {
        list = list.filter(i => {
            const hay = (i.student_name + ' ' + i.student_number + ' ' + i.module_code + ' ' + i.module_name).toLowerCase();
            return hay.includes(searchText);
        });
    }

    document.getElementById('incompleteCount').textContent = `${list.length} of ${allIncompletes.length}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:40px;">No INC records match.</td></tr>';
        return;
    }

    const colors = {
        'Active':  { bg: '#ffc107', color: '#333', label: '🟡 Active' },
        'Cleared': { bg: '#28a745', color: 'white', label: '✅ Cleared' },
        'Expired': { bg: '#dc3545', color: 'white', label: '⛔ Expired' }
    };

    let html = '';
    list.forEach(i => {
        const s = colors[i.status] || colors['Active'];
        const markedDate = new Date(i.marked_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        let daysCell = '—';
        if (i.status === 'Active' && i.days_remaining !== null && i.days_remaining !== undefined) {
            const dr = parseInt(i.days_remaining);
            const color = dr < 0 ? '#dc3545' : dr <= 7 ? '#ff9800' : '#28a745';
            const label = dr < 0 ? `${Math.abs(dr)}d overdue` : `${dr}d left`;
            daysCell = `<span style="color:${color};font-weight:700;font-size:12px;">${label}</span>`;
        }

        let actionCell = '<span style="color:#888;font-size:11px;">—</span>';
        if (i.status === 'Active') {
            actionCell = `
                <button onclick="clearInc(${i.incomplete_id})" style="padding:6px 12px;background:#28a745;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;margin-right:4px;">✅ Clear</button>
                <button onclick="expireInc(${i.incomplete_id})" style="padding:6px 12px;background:#dc3545;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">⛔ Expire</button>
            `;
        }

        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${markedDate}</td>
                <td>
                    <strong>${i.student_name}</strong><br>
                    <span style="font-size:11px;color:#888;">${i.student_number} · Y${i.current_year_of_study}</span>
                </td>
                <td>
                    <strong>${i.module_code}</strong> — ${i.module_name}<br>
                    <span style="font-size:11px;color:#888;">${i.semester_name || ''} ${i.year_name || ''}</span>
                </td>
                <td style="font-size:12px;">${i.deadline || '—'}</td>
                <td style="text-align:center;">${daysCell}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="text-align:center;white-space:nowrap;">${actionCell}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// MARK INC MODAL
// ============================================
async function openMarkModal() {
    document.getElementById('mkError').style.display = 'none';
    document.getElementById('mkSuccess').style.display = 'none';
    document.getElementById('mkReason').value = '';
    document.getElementById('mkDeadline').value = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    document.getElementById('mkSubmitBtn').textContent = '💾 Mark INC';
    document.getElementById('mkSubmitBtn').disabled = false;

    const stuSel = document.getElementById('mkStudent');
    const offSel = document.getElementById('mkOffering');

    // Load students
    try {
        const r = await apiRequest('/admin/scoped-students');
        if (r.ok) {
            const students = await r.json();
            stuSel.innerHTML = '<option value="">— Select Student —</option>' +
                students.map(s => `<option value="${s.student_number}">${s.student_number} — ${s.full_name}</option>`).join('');
        }
    } catch (e) { console.error('Students load error:', e); }

    // Load active offerings
    try {
        const r = await apiRequest('/admin/active-offerings');
        if (r.ok) {
            const offerings = await r.json();
            offSel.innerHTML = '<option value="">— Select Offering —</option>' +
                offerings.map(o => `<option value="${o.offering_id}">${o.program_code} · Y${o.year_of_study} · ${o.module_code} — ${o.module_name}</option>`).join('');
        }
    } catch (e) { console.error('Offerings load error:', e); }

    document.getElementById('markModal').style.display = 'block';
}

function closeMarkModal() {
    document.getElementById('markModal').style.display = 'none';
}

async function submitMark() {
    const errEl = document.getElementById('mkError');
    const succEl = document.getElementById('mkSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const studentNumber = document.getElementById('mkStudent').value;
    const offeringId = parseInt(document.getElementById('mkOffering').value);
    const deadline = document.getElementById('mkDeadline').value;
    const reason = document.getElementById('mkReason').value.trim();

    if (!studentNumber) {
        errEl.textContent = 'Please select a student.';
        errEl.style.display = 'block';
        return;
    }
    if (!offeringId) {
        errEl.textContent = 'Please select an offering.';
        errEl.style.display = 'block';
        return;
    }
    if (!deadline) {
        errEl.textContent = 'Please pick a deadline.';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('mkSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/mark-incomplete', {
            method: 'POST',
            body: JSON.stringify({ studentNumber, offeringId, deadline, reason: reason || null })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Mark INC';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `<strong>✅ ${data.message}</strong><br>Deadline: <strong>${data.deadline}</strong><br><em>${data.note}</em>`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';

        await loadIncompletes();
        setTimeout(closeMarkModal, 2000);
    } catch (e) {
        console.error('Mark INC error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Mark INC';
        btn.disabled = false;
    }
}

// ============================================
// CLEAR / EXPIRE
// ============================================
async function clearInc(incompleteId) {
    const i = allIncompletes.find(x => x.incomplete_id === incompleteId);
    if (!i) return;

    const remarks = prompt(`Clear INC for ${i.student_name} (${i.module_code})?\n\nOptional remarks (leave blank for none):`, '');
    if (remarks === null) return;

    try {
        const r = await apiRequest('/admin/clear-incomplete', {
            method: 'PUT',
            body: JSON.stringify({ incompleteId, remarks: remarks || null })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            return;
        }

        alert('✅ ' + data.message);
        await loadIncompletes();
    } catch (e) {
        console.error('Clear INC error:', e);
        alert('Network error: ' + e.message);
    }
}

async function expireInc(incompleteId) {
    const i = allIncompletes.find(x => x.incomplete_id === incompleteId);
    if (!i) return;

    if (!confirm(`⚠️ Expire INC for ${i.student_name} (${i.module_code})?\n\nThis will apply a grade of ZERO to any assessments without a grade. Rule §6.2. This cannot be undone.`)) return;

    const remarks = prompt('Optional remarks:', 'Deadline passed without completion');

    try {
        const r = await apiRequest('/admin/expire-incomplete', {
            method: 'PUT',
            body: JSON.stringify({ incompleteId, remarks: remarks || null })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            return;
        }

        alert(`✅ ${data.message}\nZeros applied: ${data.zeros_applied}`);
        await loadIncompletes();
    } catch (e) {
        console.error('Expire INC error:', e);
        alert('Network error: ' + e.message);
    }
}