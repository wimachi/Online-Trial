// ============================================
// MUBAS - STUDENT WITHDRAWAL
// ============================================

let myWithdrawals = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Student';

    await loadWithdrawals();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadWithdrawals() {
    try {
        const r = await apiRequest('/students/my-withdrawals');
        if (r.ok) myWithdrawals = await r.json();
    } catch (e) { console.error('Withdrawals load error:', e); }
    renderWithdrawals();
}

function renderWithdrawals() {
    const tbody = document.getElementById('withdrawalsBody');
    if (!myWithdrawals || myWithdrawals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:40px;">No withdrawal requests on file.</td></tr>';
        return;
    }

    const colors = {
        'Requested': { bg: '#ffc107', color: '#333', label: '⏳ Requested' },
        'Approved':  { bg: '#28a745', color: 'white', label: '✅ Approved' },
        'Rejected':  { bg: '#dc3545', color: 'white', label: '❌ Rejected' },
        'Returned':  { bg: '#17a2b8', color: 'white', label: '🔄 Returned' }
    };

    let html = '';
    myWithdrawals.forEach(w => {
        const s = colors[w.status] || colors['Requested'];
        const req = new Date(w.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td><strong>${w.withdrawal_type}</strong></td>
                <td style="font-size:12px;">${w.reason}${w.reason_details ? `<br><span style="color:#888;">${w.reason_details}</span>` : ''}</td>
                <td style="font-size:12px;">${w.start_date || '—'}</td>
                <td style="font-size:12px;">${w.expected_return_date || '—'}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="font-size:12px;color:#666;max-width:280px;">${w.decision_remarks ? `"${w.decision_remarks}"` : '<em style="color:#aaa;">—</em>'}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function openWithdrawalModal() {
    // Block if there's already a pending or approved one
    const active = myWithdrawals.find(w => w.status === 'Requested' || w.status === 'Approved');
    if (active) {
        alert(`You already have a ${active.status.toLowerCase()} withdrawal on file.`);
        return;
    }

    document.getElementById('wdType').value = '';
    document.getElementById('wdReason').value = '';
    document.getElementById('wdDetails').value = '';
    document.getElementById('wdStart').value = new Date().toISOString().slice(0, 10);
    document.getElementById('wdReturn').value = '';
    document.getElementById('returnDateWrap').style.display = 'none';
    document.getElementById('wdError').style.display = 'none';
    document.getElementById('wdSuccess').style.display = 'none';
    document.getElementById('wdSubmitBtn').textContent = '📤 Submit Request';
    document.getElementById('wdSubmitBtn').disabled = false;

    document.getElementById('withdrawalModal').style.display = 'block';
}

function closeWithdrawalModal() {
    document.getElementById('withdrawalModal').style.display = 'none';
}

function toggleReturnDate() {
    const type = document.getElementById('wdType').value;
    document.getElementById('returnDateWrap').style.display = (type === 'Temporary') ? 'block' : 'none';
}

async function submitWithdrawal() {
    const errEl = document.getElementById('wdError');
    const succEl = document.getElementById('wdSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const withdrawalType = document.getElementById('wdType').value;
    const reason = document.getElementById('wdReason').value;
    const reasonDetails = document.getElementById('wdDetails').value.trim();
    const startDate = document.getElementById('wdStart').value;
    const expectedReturnDate = document.getElementById('wdReturn').value;

    if (!withdrawalType) {
        errEl.textContent = 'Please select a withdrawal type.';
        errEl.style.display = 'block';
        return;
    }
    if (!reason) {
        errEl.textContent = 'Please select a reason.';
        errEl.style.display = 'block';
        return;
    }
    if (!startDate) {
        errEl.textContent = 'Please select a start date.';
        errEl.style.display = 'block';
        return;
    }
    if (withdrawalType === 'Temporary' && !expectedReturnDate) {
        errEl.textContent = 'Temporary withdrawals require an expected return date.';
        errEl.style.display = 'block';
        return;
    }

    // Confirmation for the destructive type
    if (withdrawalType === 'Voluntary') {
        if (!confirm('⚠️ Voluntary withdrawal is PERMANENT. You cannot be re-admitted into the University. Proceed?')) return;
    }

    const btn = document.getElementById('wdSubmitBtn');
    btn.textContent = '⏳ Submitting...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/students/request-withdrawal', {
            method: 'POST',
            body: JSON.stringify({
                withdrawalType,
                reason,
                reasonDetails: reasonDetails || null,
                startDate,
                expectedReturnDate: expectedReturnDate || null
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Submission failed';
            errEl.style.display = 'block';
            btn.textContent = '📤 Submit Request';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = '<strong>✅ Withdrawal request submitted.</strong><br>You will be notified once it is reviewed.';
        succEl.style.display = 'block';
        btn.textContent = '✓ Submitted';

        await loadWithdrawals();
        setTimeout(closeWithdrawalModal, 1800);
    } catch (e) {
        console.error('Withdrawal submit error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '📤 Submit Request';
        btn.disabled = false;
    }
}