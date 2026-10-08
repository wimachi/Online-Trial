// ============================================
// MUBAS - ADMIN APPEALS
// ============================================

let allAppeals = [];
let currentAppeal = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';

    await loadAppeals();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadAppeals() {
    try {
        const r = await apiRequest('/admin/appeals');
        if (!r.ok) {
            document.getElementById('appealsBody').innerHTML =
                '<tr><td colspan="7" style="text-align:center;color:#dc3545;padding:30px;">Failed to load appeals.</td></tr>';
            return;
        }
        allAppeals = await r.json();
        renderAll();
    } catch (e) {
        console.error('Appeals load error:', e);
    }
}

function renderAll() {
    // Counts
    const counts = {
        Submitted: 0,
        'Under Review': 0,
        Upheld: 0,
        Dismissed: 0,
        Withdrawn: 0
    };
    allAppeals.forEach(a => {
        if (counts[a.status] !== undefined) counts[a.status]++;
    });

    document.getElementById('countSubmitted').textContent = counts['Submitted'];
    document.getElementById('countReviewing').textContent = counts['Under Review'];
    document.getElementById('countUpheld').textContent = counts['Upheld'];
    document.getElementById('countTotal').textContent = allAppeals.length;

    renderAppeals();
}

function renderAppeals() {
    const tbody = document.getElementById('appealsBody');
    const statusFilter = document.getElementById('filterStatus').value;
    const searchText = (document.getElementById('searchAppeals').value || '').toLowerCase().trim();

    let list = allAppeals;
    if (statusFilter) list = list.filter(a => a.status === statusFilter);
    if (searchText) {
        list = list.filter(a => {
            const haystack = (a.student_name + ' ' + a.student_number + ' ' + a.module_code + ' ' + a.module_name).toLowerCase();
            return haystack.includes(searchText);
        });
    }

    document.getElementById('appealCount').textContent = `${list.length} of ${allAppeals.length}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:40px;">No appeals match the filter.</td></tr>';
        return;
    }

    const colors = {
        'Submitted':    { bg: '#ffc107', color: '#333', label: '⏳ Submitted' },
        'Under Review': { bg: '#17a2b8', color: 'white', label: '🔎 Under Review' },
        'Upheld':       { bg: '#28a745', color: 'white', label: '✅ Upheld' },
        'Dismissed':    { bg: '#dc3545', color: 'white', label: '❌ Dismissed' },
        'Withdrawn':    { bg: '#6c757d', color: 'white', label: '🚫 Withdrawn' }
    };

    let html = '';
    list.forEach(a => {
        const s = colors[a.status] || colors['Submitted'];
        const submitted = new Date(a.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const canDecide = (a.status === 'Submitted' || a.status === 'Under Review');

        const actionCell = canDecide
            ? `<button onclick="openDecideModal(${a.appeal_id})" style="padding:6px 14px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">⚖️ Decide</button>`
            : `<span style="color:#888;font-size:11px;">Finalized</span>`;

        // Truncate long reason for the table
        const shortReason = a.reason.length > 80 ? a.reason.substring(0, 80) + '…' : a.reason;

        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${submitted}</td>
                <td>
                    <strong>${a.student_name}</strong><br>
                    <span style="font-size:11px;color:#888;">${a.student_number}</span>
                </td>
                <td>
                    <strong>${a.module_code}</strong><br>
                    <span style="font-size:11px;color:#888;">${a.module_name}</span>
                    <div style="font-size:11px;color:#999;margin-top:2px;">${a.semester_name || ''} ${a.year_name || ''}</div>
                </td>
                <td style="font-size:12px;">${a.appeal_type}</td>
                <td style="font-size:12px;color:#555;max-width:280px;">${shortReason}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="text-align:center;">${actionCell}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// DECIDE MODAL
// ============================================
function openDecideModal(appealId) {
    const appeal = allAppeals.find(a => a.appeal_id === appealId);
    if (!appeal) { alert('Appeal not found. Refresh the page.'); return; }

    currentAppeal = appeal;

    document.getElementById('decideSubtitle').textContent =
        `Appeal #${appeal.appeal_id} · ${appeal.student_name}`;

    document.getElementById('decideDetails').innerHTML = `
        <div><strong>Student:</strong> ${appeal.student_name} <span style="color:#888;">(${appeal.student_number})</span></div>
        <div><strong>Module:</strong> ${appeal.module_code} — ${appeal.module_name}</div>
        <div><strong>Semester:</strong> ${appeal.semester_name || '—'} ${appeal.year_name ? '· ' + appeal.year_name : ''}</div>
        <div><strong>Type:</strong> ${appeal.appeal_type}</div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #d0dae5;">
            <strong>Reason:</strong><br>
            <em style="color:#555;">${appeal.reason}</em>
        </div>
    `;

    // Reset
    const submittedRadio = document.querySelector('input[name="decision"][value="Under Review"]');
    if (submittedRadio) submittedRadio.checked = true;
    document.getElementById('decisionRemarks').value = '';
    document.getElementById('decideError').style.display = 'none';
    document.getElementById('decideSuccess').style.display = 'none';
    document.getElementById('decideSubmitBtn').textContent = '💾 Save Decision';
    document.getElementById('decideSubmitBtn').disabled = false;

    document.getElementById('decideModal').style.display = 'block';
}

function closeDecideModal() {
    document.getElementById('decideModal').style.display = 'none';
    currentAppeal = null;
}

async function submitDecision() {
    if (!currentAppeal) return;

    const errEl = document.getElementById('decideError');
    const succEl = document.getElementById('decideSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const selected = document.querySelector('input[name="decision"]:checked');
    if (!selected) {
        errEl.textContent = 'Please select a decision.';
        errEl.style.display = 'block';
        return;
    }
    const decision = selected.value;
    const remarks = document.getElementById('decisionRemarks').value.trim() || null;

    // Confirm destructive
    if (decision === 'Dismissed' && !confirm('Mark this appeal as Dismissed? The student will see this as a final rejection.')) return;
    if (decision === 'Upheld' && !confirm('Mark this appeal as Upheld? This grants the appeal to the student.')) return;

    const btn = document.getElementById('decideSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/decide-appeal', {
            method: 'PUT',
            body: JSON.stringify({
                appealId: currentAppeal.appeal_id,
                decision,
                remarks
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed to save decision';
            errEl.style.display = 'block';
            btn.textContent = '💾 Save Decision';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `<strong>✅ Decision saved:</strong> ${data.new_status}`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';

        await loadAppeals();

        setTimeout(() => {
            closeDecideModal();
        }, 1600);
    } catch (e) {
        console.error('Decide appeal error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save Decision';
        btn.disabled = false;
    }
}