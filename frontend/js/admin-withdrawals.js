// ============================================
// MUBAS - ADMIN WITHDRAWALS
// ============================================

let allWithdrawals = [];
let currentWithdrawal = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';

    await loadWithdrawals();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadWithdrawals() {
    try {
        const r = await apiRequest('/admin/withdrawals');
        if (!r.ok) {
            document.getElementById('withdrawalsBody').innerHTML =
                '<tr><td colspan="8" style="text-align:center;color:#dc3545;padding:30px;">Failed to load.</td></tr>';
            return;
        }
        allWithdrawals = await r.json();
        renderAll();
    } catch (e) {
        console.error('Withdrawals load error:', e);
    }
}

function renderAll() {
    const counts = { Requested: 0, Approved: 0, Rejected: 0, Returned: 0 };
    allWithdrawals.forEach(w => { if (counts[w.status] !== undefined) counts[w.status]++; });

    document.getElementById('countRequested').textContent = counts.Requested;
    document.getElementById('countApproved').textContent = counts.Approved;
    document.getElementById('countReturned').textContent = counts.Returned;
    document.getElementById('countTotal').textContent = allWithdrawals.length;

    renderWithdrawals();
}

function renderWithdrawals() {
    const tbody = document.getElementById('withdrawalsBody');
    const statusFilter = document.getElementById('filterStatus').value;
    const searchText = (document.getElementById('searchWithdrawals').value || '').toLowerCase().trim();

    let list = allWithdrawals;
    if (statusFilter) list = list.filter(w => w.status === statusFilter);
    if (searchText) {
        list = list.filter(w => {
            const hay = (w.student_name + ' ' + w.student_number + ' ' + (w.program_code || '')).toLowerCase();
            return hay.includes(searchText);
        });
    }

    document.getElementById('withdrawalCount').textContent = `${list.length} of ${allWithdrawals.length}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;padding:40px;">No withdrawals match.</td></tr>';
        return;
    }

    const colors = {
        'Requested': { bg: '#ffc107', color: '#333', label: '⏳ Requested' },
        'Approved':  { bg: '#28a745', color: 'white', label: '✅ Approved' },
        'Rejected':  { bg: '#dc3545', color: 'white', label: '❌ Rejected' },
        'Returned':  { bg: '#17a2b8', color: 'white', label: '🔄 Returned' }
    };

    let html = '';
    list.forEach(w => {
        const s = colors[w.status] || colors['Requested'];
        const req = new Date(w.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        let actionCell = '<span style="color:#888;font-size:11px;">—</span>';
        if (w.status === 'Requested') {
            actionCell = `<button onclick="openDecideModal(${w.withdrawal_id})" style="padding:6px 14px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">📤 Decide</button>`;
        } else if (w.status === 'Approved' && w.withdrawal_type === 'Temporary') {
            actionCell = `<button onclick="markReturned(${w.withdrawal_id})" style="padding:6px 14px;background:#17a2b8;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">🔄 Mark Returned</button>`;
        }

        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td>
                    <strong>${w.student_name}</strong><br>
                    <span style="font-size:11px;color:#888;">${w.student_number} · Y${w.current_year_of_study}</span>
                    <div style="font-size:11px;color:#999;">${w.program_code || ''}</div>
                </td>
                <td><strong>${w.withdrawal_type}</strong></td>
                <td style="font-size:12px;">${w.reason}${w.reason_details ? `<br><span style="color:#888;">${w.reason_details}</span>` : ''}</td>
                <td style="font-size:12px;">${w.start_date || '—'}</td>
                <td style="font-size:12px;">${w.expected_return_date || '—'}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="text-align:center;white-space:nowrap;">${actionCell}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// DECIDE MODAL
// ============================================
function openDecideModal(withdrawalId) {
    const w = allWithdrawals.find(x => x.withdrawal_id === withdrawalId);
    if (!w) { alert('Withdrawal not found. Refresh the page.'); return; }

    currentWithdrawal = w;
    document.getElementById('decideSubtitle').textContent =
        `#${w.withdrawal_id} · ${w.student_name}`;

    const typeWarning = w.withdrawal_type === 'Voluntary'
        ? '<div style="margin-top:8px;padding:8px;background:#fdeeee;color:#721c24;border-radius:4px;"><strong>⚠️ Voluntary</strong> — approval permanently withdraws the student.</div>'
        : '<div style="margin-top:8px;padding:8px;background:#e8f4f8;color:#0c5460;border-radius:4px;"><strong>ℹ️ Temporary</strong> — student can return within 1 academic year.</div>';

    document.getElementById('decideDetails').innerHTML = `
        <div><strong>Student:</strong> ${w.student_name} <span style="color:#888;">(${w.student_number})</span></div>
        <div><strong>Programme:</strong> ${w.program_code || '—'}</div>
        <div><strong>Type:</strong> ${w.withdrawal_type}</div>
        <div><strong>Reason:</strong> ${w.reason}${w.reason_details ? ` — ${w.reason_details}` : ''}</div>
        <div><strong>Start Date:</strong> ${w.start_date || '—'}</div>
        <div><strong>Expected Return:</strong> ${w.expected_return_date || '—'}</div>
        ${typeWarning}
    `;

    document.querySelector('input[name="wDecision"][value="Approved"]').checked = true;
    document.getElementById('decisionRemarks').value = '';
    document.getElementById('decideError').style.display = 'none';
    document.getElementById('decideSuccess').style.display = 'none';
    document.getElementById('decideSubmitBtn').textContent = '💾 Save';
    document.getElementById('decideSubmitBtn').disabled = false;

    document.getElementById('decideModal').style.display = 'block';
}

function closeDecideModal() {
    document.getElementById('decideModal').style.display = 'none';
    currentWithdrawal = null;
}

async function submitDecision() {
    if (!currentWithdrawal) return;

    const errEl = document.getElementById('decideError');
    const succEl = document.getElementById('decideSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const selected = document.querySelector('input[name="wDecision"]:checked');
    if (!selected) {
        errEl.textContent = 'Please select a decision.';
        errEl.style.display = 'block';
        return;
    }
    const decision = selected.value;
    const remarks = document.getElementById('decisionRemarks').value.trim() || null;

    if (decision === 'Approved' && currentWithdrawal.withdrawal_type === 'Voluntary') {
        if (!confirm('⚠️ Approving a VOLUNTARY withdrawal is permanent. The student cannot be re-admitted. Proceed?')) return;
    }

    const btn = document.getElementById('decideSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/decide-withdrawal', {
            method: 'PUT',
            body: JSON.stringify({
                withdrawalId: currentWithdrawal.withdrawal_id,
                decision,
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

        succEl.innerHTML = `<strong>✅ ${data.message}</strong><br>Student status updated: ${data.student_status_updated ? 'Yes' : 'No'}`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';

        await loadWithdrawals();
        setTimeout(closeDecideModal, 1500);
    } catch (e) {
        console.error('Decide error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save';
        btn.disabled = false;
    }
}

// ============================================
// MARK RETURNED
// ============================================
async function markReturned(withdrawalId) {
    const w = allWithdrawals.find(x => x.withdrawal_id === withdrawalId);
    if (!w) return;

    const today = new Date().toISOString().slice(0, 10);
    const dateStr = prompt(`Enter the actual return date (YYYY-MM-DD) for ${w.student_name}:`, today);
    if (!dateStr) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        alert('Invalid date format. Use YYYY-MM-DD.');
        return;
    }

    if (!confirm(`Mark ${w.student_name} as returned and reactivate their account?`)) return;

    try {
        const r = await apiRequest('/admin/mark-returned', {
            method: 'PUT',
            body: JSON.stringify({ withdrawalId, actualReturnDate: dateStr })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            return;
        }

        alert('✅ ' + data.message);
        await loadWithdrawals();
    } catch (e) {
        console.error('Mark returned error:', e);
        alert('Network error: ' + e.message);
    }
}