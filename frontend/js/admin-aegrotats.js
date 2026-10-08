// ============================================
// MUBAS - ADMIN AEGROTATS
// ============================================

let allAegrotats = [];
let currentAegrotat = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';

    // Hook up decision radio to show/hide credit checkbox
    document.querySelectorAll('input[name="aegDecision"]').forEach(r => {
        r.addEventListener('change', toggleCreditBox);
    });

    await loadAegrotats();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

function toggleCreditBox() {
    const selected = document.querySelector('input[name="aegDecision"]:checked');
    const wrap = document.getElementById('creditWrap');
    if (selected && selected.value === 'Approved' && currentAegrotat && currentAegrotat.is_final_year) {
        wrap.style.display = 'block';
    } else {
        wrap.style.display = 'none';
    }
}

async function loadAegrotats() {
    try {
        const r = await apiRequest('/admin/aegrotats');
        if (!r.ok) {
            document.getElementById('aegrotatsBody').innerHTML =
                '<tr><td colspan="7" style="text-align:center;color:#dc3545;padding:30px;">Failed to load.</td></tr>';
            return;
        }
        allAegrotats = await r.json();
        renderAll();
    } catch (e) {
        console.error('Aegrotats load error:', e);
    }
}

function renderAll() {
    const counts = { Requested: 0, Approved: 0, Rejected: 0 };
    allAegrotats.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++; });

    document.getElementById('countRequested').textContent = counts.Requested;
    document.getElementById('countApproved').textContent = counts.Approved;
    document.getElementById('countRejected').textContent = counts.Rejected;
    document.getElementById('countTotal').textContent = allAegrotats.length;

    renderAegrotats();
}

function renderAegrotats() {
    const tbody = document.getElementById('aegrotatsBody');
    const statusFilter = document.getElementById('filterStatus').value;
    const searchText = (document.getElementById('searchAegrotats').value || '').toLowerCase().trim();

    let list = allAegrotats;
    if (statusFilter) list = list.filter(a => a.status === statusFilter);
    if (searchText) {
        list = list.filter(a => {
            const hay = (a.student_name + ' ' + a.student_number + ' ' + a.module_code).toLowerCase();
            return hay.includes(searchText);
        });
    }

    document.getElementById('aegrotatCount').textContent = `${list.length} of ${allAegrotats.length}`;

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;padding:40px;">No aegrotat records match.</td></tr>';
        return;
    }

    const colors = {
        'Requested': { bg: '#ffc107', color: '#333', label: '⏳ Requested' },
        'Approved':  { bg: '#28a745', color: 'white', label: '✅ Approved' },
        'Rejected':  { bg: '#dc3545', color: 'white', label: '❌ Rejected' }
    };

    let html = '';
    list.forEach(a => {
        const s = colors[a.status] || colors['Requested'];
        const req = new Date(a.requested_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const ca = parseFloat(a.overall_ca_average).toFixed(2);

        let actionCell = '<span style="color:#888;font-size:11px;">Finalized</span>';
        if (a.status === 'Requested') {
            actionCell = `<button onclick="openDecideModal(${a.aegrotat_id})" style="padding:6px 14px;background:#003366;color:white;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">🏥 Decide</button>`;
        }

        const finalBadge = a.is_final_year
            ? '<span style="background:#dc3545;color:white;padding:2px 6px;border-radius:8px;font-size:9px;margin-left:6px;vertical-align:middle;">FINAL YR</span>'
            : '';

        const creditBadge = a.eligible_for_credit
            ? '<div style="font-size:10px;color:#28a745;margin-top:3px;">✓ Eligible for credit</div>'
            : '';

        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${req}</td>
                <td>
                    <strong>${a.student_name}</strong>${finalBadge}<br>
                    <span style="font-size:11px;color:#888;">${a.student_number} · Y${a.current_year_of_study}/${a.duration_years}</span>
                </td>
                <td>
                    <strong>${a.module_code}</strong> — ${a.module_name}<br>
                    <span style="font-size:11px;color:#888;">${a.semester_name || ''} ${a.year_name || ''}</span>
                </td>
                <td style="text-align:center;font-weight:700;color:#17a2b8;">${ca}</td>
                <td style="font-size:12px;color:#666;">
                    ${a.medical_evidence ? `📎 ${a.medical_evidence}` : '<em style="color:#aaa;">—</em>'}
                </td>
                <td style="text-align:center;">
                    <span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span>
                    ${creditBadge}
                </td>
                <td style="text-align:center;white-space:nowrap;">${actionCell}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// CREATE MODAL
// ============================================
async function openCreateModal() {
    document.getElementById('crError').style.display = 'none';
    document.getElementById('crSuccess').style.display = 'none';
    document.getElementById('crCA').value = '3.20';
    document.getElementById('crEvidence').value = '';
    document.getElementById('crReason').value = '';
    document.getElementById('crSubmitBtn').textContent = '💾 Create';
    document.getElementById('crSubmitBtn').disabled = false;

    const stuSel = document.getElementById('crStudent');
    const offSel = document.getElementById('crOffering');

    try {
        const r = await apiRequest('/admin/scoped-students');
        if (r.ok) {
            const students = await r.json();
            stuSel.innerHTML = '<option value="">— Select Student —</option>' +
                students.map(s => `<option value="${s.student_number}">${s.student_number} — ${s.full_name}</option>`).join('');
        }
    } catch (e) { console.error('Students load error:', e); }

    try {
        const r = await apiRequest('/admin/active-offerings');
        if (r.ok) {
            const offerings = await r.json();
            offSel.innerHTML = '<option value="">— Select Offering —</option>' +
                offerings.map(o => `<option value="${o.offering_id}">${o.program_code} · Y${o.year_of_study} · ${o.module_code} — ${o.module_name}</option>`).join('');
        }
    } catch (e) { console.error('Offerings load error:', e); }

    document.getElementById('createModal').style.display = 'block';
}

function closeCreateModal() {
    document.getElementById('createModal').style.display = 'none';
}

async function submitCreate() {
    const errEl = document.getElementById('crError');
    const succEl = document.getElementById('crSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const studentNumber = document.getElementById('crStudent').value;
    const offeringId = parseInt(document.getElementById('crOffering').value);
    const overallCaAverage = parseFloat(document.getElementById('crCA').value);
    const medicalEvidence = document.getElementById('crEvidence').value.trim();
    const reason = document.getElementById('crReason').value.trim();

    if (!studentNumber) { errEl.textContent = 'Please select a student.'; errEl.style.display = 'block'; return; }
    if (!offeringId) { errEl.textContent = 'Please select an offering.'; errEl.style.display = 'block'; return; }
    if (isNaN(overallCaAverage) || overallCaAverage < 0 || overallCaAverage > 4) {
        errEl.textContent = 'CA average must be between 0.00 and 4.00.'; errEl.style.display = 'block'; return;
    }
    if (overallCaAverage <= 2.99) {
        errEl.textContent = `Rule §7.1 — CA average must be above 2.99. You entered ${overallCaAverage.toFixed(2)}.`;
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('crSubmitBtn');
    btn.textContent = '⏳ Creating...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/create-aegrotat', {
            method: 'POST',
            body: JSON.stringify({
                studentNumber, offeringId, overallCaAverage,
                medicalEvidence: medicalEvidence || null,
                reason: reason || null
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Create';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `<strong>✅ ${data.message}</strong><br><em>${data.note}</em>`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';

        await loadAegrotats();
        setTimeout(closeCreateModal, 2000);
    } catch (e) {
        console.error('Create aegrotat error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Create';
        btn.disabled = false;
    }
}

// ============================================
// DECIDE MODAL
// ============================================
function openDecideModal(aegrotatId) {
    const a = allAegrotats.find(x => x.aegrotat_id === aegrotatId);
    if (!a) { alert('Record not found. Refresh.'); return; }

    currentAegrotat = a;
    document.getElementById('decideSubtitle').textContent = `#${a.aegrotat_id} · ${a.student_name}`;

    const finalYearNote = a.is_final_year
        ? '<div style="margin-top:8px;padding:8px;background:#fdeeee;color:#721c24;border-radius:4px;"><strong>🎓 Final-year student</strong> — §7.2: NOT eligible for Credit/Distinction unless deferred exam taken.</div>'
        : '<div style="margin-top:8px;padding:8px;background:#e8f4f8;color:#0c5460;border-radius:4px;"><strong>ℹ️ Not final year</strong> — Aegrotat can be recorded as a normal pass.</div>';

    document.getElementById('decideDetails').innerHTML = `
        <div><strong>Student:</strong> ${a.student_name} <span style="color:#888;">(${a.student_number})</span></div>
        <div><strong>Programme:</strong> ${a.program_code || '—'} · Year ${a.current_year_of_study}/${a.duration_years}</div>
        <div><strong>Module:</strong> ${a.module_code} — ${a.module_name}</div>
        <div><strong>CA Average:</strong> <span style="color:#17a2b8;font-weight:700;">${parseFloat(a.overall_ca_average).toFixed(2)}</span></div>
        ${a.medical_evidence ? `<div><strong>Evidence:</strong> ${a.medical_evidence}</div>` : ''}
        ${a.reason ? `<div><strong>Notes:</strong> <em style="color:#555;">${a.reason}</em></div>` : ''}
        ${finalYearNote}
    `;

    document.querySelector('input[name="aegDecision"][value="Approved"]').checked = true;
    document.getElementById('aegCredit').checked = false;
    document.getElementById('aegRemarks').value = '';
    document.getElementById('decideError').style.display = 'none';
    document.getElementById('decideSuccess').style.display = 'none';
    document.getElementById('decideSubmitBtn').textContent = '💾 Save';
    document.getElementById('decideSubmitBtn').disabled = false;

    toggleCreditBox();
    document.getElementById('decideModal').style.display = 'block';
}

function closeDecideModal() {
    document.getElementById('decideModal').style.display = 'none';
    currentAegrotat = null;
}

async function submitDecision() {
    if (!currentAegrotat) return;

    const errEl = document.getElementById('decideError');
    const succEl = document.getElementById('decideSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const selected = document.querySelector('input[name="aegDecision"]:checked');
    if (!selected) { errEl.textContent = 'Please select a decision.'; errEl.style.display = 'block'; return; }
    const decision = selected.value;
    const remarks = document.getElementById('aegRemarks').value.trim() || null;
    const eligibleForCredit = document.getElementById('aegCredit').checked;

    if (decision === 'Approved' && currentAegrotat.is_final_year && eligibleForCredit) {
        if (!confirm('⚠️ §7.2 — Final-year students are NOT normally eligible for Credit or Distinction with an Aegrotat.\n\nOnly proceed if the student has taken or will take a deferred exam. Continue?')) return;
    }

    const btn = document.getElementById('decideSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/decide-aegrotat', {
            method: 'PUT',
            body: JSON.stringify({
                aegrotatId: currentAegrotat.aegrotat_id,
                decision,
                remarks,
                eligibleForCredit
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Save';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = `<strong>✅ ${data.message}</strong>${data.eligible_for_credit ? '<br>Student will be eligible for Credit/Distinction.' : ''}`;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';

        await loadAegrotats();
        setTimeout(closeDecideModal, 1500);
    } catch (e) {
        console.error('Decide aegrotat error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save';
        btn.disabled = false;
    }
}