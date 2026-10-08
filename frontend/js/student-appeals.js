// ============================================
// MUBAS - STUDENT APPEALS
// ============================================

let myAppeals = [];
let myModules = [];

document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Student';

    await Promise.all([loadAppeals(), loadModules()]);
    renderAppeals();
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

async function loadAppeals() {
    try {
        const r = await apiRequest('/students/my-appeals');
        if (r.ok) myAppeals = await r.json();
    } catch (e) { console.error('Appeals load error:', e); }
}

async function loadModules() {
    try {
        const sn = getStudentNumber();
        const r = await apiRequest('/students/assessment-matrix?studentNumber=' + encodeURIComponent(sn));
        if (r.ok) {
            const list = await r.json();
            const seen = new Set();
            myModules = [];
            list.forEach(m => {
                if (!seen.has(m.module_id)) {
                    seen.add(m.module_id);
                    myModules.push({
                        module_id: m.module_id,
                        code: m.module_code,
                        name: m.module_name,
                        semester_id: m.semester_id,
                        semester_name: m.semester_name,
                        year_name: m.year_name
                    });
                }
            });
        }
    } catch (e) { console.error('Modules load error:', e); }
}

function renderAppeals() {
    const tbody = document.getElementById('appealsBody');
    if (!myAppeals || myAppeals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#888;padding:40px;">You have not submitted any appeals.</td></tr>';
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
    myAppeals.forEach(a => {
        const s = colors[a.status] || colors['Submitted'];
        const submitted = new Date(a.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        html += `
            <tr>
                <td style="font-size:12px;color:#666;">${submitted}</td>
                <td><strong>${a.module_code}</strong><br><span style="font-size:11px;color:#888;">${a.module_name}</span></td>
                <td style="font-size:12px;">${a.semester_name || '—'}<br><span style="color:#888;">${a.year_name || ''}</span></td>
                <td style="font-size:12px;">${a.appeal_type}</td>
                <td style="text-align:center;"><span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:12px;font-size:11px;font-weight:600;">${s.label}</span></td>
                <td style="font-size:12px;color:#666;max-width:280px;">${a.decision_remarks ? `"${a.decision_remarks}"` : '<em style="color:#aaa;">—</em>'}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function openNewAppeal() {
    const sel = document.getElementById('appealModule');
    if (myModules.length === 0) {
        alert('No modules found for your record.');
        return;
    }
    sel.innerHTML = '<option value="">— Select Module —</option>' +
        myModules.map(m => `<option value="${m.module_id}">${m.code} — ${m.name} (${m.semester_name || ''})</option>`).join('');

    document.getElementById('appealType').value = 'Grade Review';
    document.getElementById('appealReason').value = '';
    document.getElementById('appealError').style.display = 'none';
    document.getElementById('appealSuccess').style.display = 'none';
    document.getElementById('appealSubmitBtn').textContent = '📤 Submit Appeal';
    document.getElementById('appealSubmitBtn').disabled = false;

    document.getElementById('newAppealModal').style.display = 'block';
}

function closeNewAppeal() {
    document.getElementById('newAppealModal').style.display = 'none';
}

async function submitAppeal() {
    const errEl = document.getElementById('appealError');
    const succEl = document.getElementById('appealSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const moduleId = parseInt(document.getElementById('appealModule').value);
    const appealType = document.getElementById('appealType').value;
    const reason = document.getElementById('appealReason').value.trim();

    if (!moduleId) {
        errEl.textContent = 'Please select a module.';
        errEl.style.display = 'block';
        return;
    }
    if (!reason || reason.length < 10) {
        errEl.textContent = 'Please explain your reason (at least 10 characters).';
        errEl.style.display = 'block';
        return;
    }

    // Find semester_id for this module from myModules
    const mod = myModules.find(m => m.module_id === moduleId);

    const btn = document.getElementById('appealSubmitBtn');
    btn.textContent = '⏳ Submitting...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/students/submit-appeal', {
            method: 'POST',
            body: JSON.stringify({
                moduleId,
                semesterId: mod ? mod.semester_id : null,
                appealType,
                reason
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Submission failed';
            errEl.style.display = 'block';
            btn.textContent = '📤 Submit Appeal';
            btn.disabled = false;
            return;
        }

        succEl.innerHTML = '<strong>✅ Appeal submitted!</strong><br>You can track its status in the table above.';
        succEl.style.display = 'block';
        btn.textContent = '✓ Submitted';

        await loadAppeals();
        renderAppeals();

        setTimeout(() => {
            closeNewAppeal();
        }, 1800);
    } catch (e) {
        console.error('Submit appeal error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '📤 Submit Appeal';
        btn.disabled = false;
    }
}