// ============================================
// MUBAS ASSESSMENT SYSTEM - STUDENT DETAIL VIEW
// ============================================

let detailData = null;

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'User';
    document.getElementById('userRole').textContent = (user.role || 'Admin').toUpperCase();

    // Get student number from URL
    const params = new URLSearchParams(window.location.search);
    const studentNumber = params.get('student');

    if (!studentNumber) {
        document.getElementById('loading').textContent = 'No student specified.';
        return;
    }

    await loadDetail(studentNumber);
    renderEverything();
});

// ============================================
// NAVIGATION
// ============================================
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

// ============================================
// LOADER
// ============================================
async function loadDetail(studentNumber) {
    try {
        const r = await apiRequest('/admin/student-detail?studentNumber=' + encodeURIComponent(studentNumber));
        if (!r.ok) {
            document.getElementById('loading').textContent = 'Failed to load student (' + r.status + ')';
            return;
        }
        detailData = await r.json();
    } catch (e) {
        console.error('Detail load error:', e);
        document.getElementById('loading').textContent = 'Error: ' + e.message;
    }
}

// ============================================
// RENDER
// ============================================
function renderEverything() {
    if (!detailData || !detailData.profile) {
        document.getElementById('loading').textContent = 'Student data missing.';
        return;
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    renderBanner();
    renderPositionCards();
    renderSemesters();
    renderModules();
    renderGPATrendChart();
}

// ============================================
// BANNER
// ============================================
function renderBanner() {
    const p = detailData.profile;
    document.getElementById('studentName').textContent = p.full_name || 'Unknown';
    document.getElementById('studentRegNo').textContent = p.student_number || '';
    document.getElementById('studentProgram').textContent = p.program_name || 'No Program';
    document.getElementById('studentDept').textContent = p.department_name || '';
    document.getElementById('studentSchool').textContent = p.school_name || '';
}

// ============================================
// POSITION CARDS
// ============================================
function renderPositionCards() {
    const p = detailData.profile;
    const c = detailData.cumulative;

    // Year
    document.getElementById('posYear').textContent = p.current_year_of_study || '-';
    document.getElementById('posYearLabel').textContent = p.year_position || '-';

    // Semester
    document.getElementById('posSem').textContent = p.current_semester || '-';
    document.getElementById('posSemLabel').textContent = p.semester_position || '-';

    // cGPA
    const cgpa = c ? parseFloat(c.cgpa) : 0;
    const cgpaEl = document.getElementById('posCgpa');
    cgpaEl.textContent = isNaN(cgpa) ? '-' : cgpa.toFixed(2);
    cgpaEl.className = 'value ' + getGpaClass(cgpa);

    const creditEl = document.getElementById('posCredits');
    if (c) {
        creditEl.textContent = `${c.completed_semesters || 0} sems · ${c.total_credits || 0} credits`;
    } else {
        creditEl.textContent = 'No completed semesters';
    }

    // Classification
    const clsEl = document.getElementById('posClass');
    if (c && c.classification) {
        clsEl.textContent = c.classification;
        clsEl.style.color = getClassColor(c.classification);
        clsEl.style.fontSize = '18px';
    } else {
        clsEl.textContent = 'In Progress';
        clsEl.style.color = '#888';
        clsEl.style.fontSize = '18px';
    }
}

// ============================================
// SEMESTERS
// ============================================
function renderSemesters() {
    const tbody = document.getElementById('semestersBody');
    const sems = detailData.semesters || [];

    if (sems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">No semester data</td></tr>';
        return;
    }

    let html = '';
    sems.forEach(s => {
        const gpa = s.semester_gpa !== null ? parseFloat(s.semester_gpa).toFixed(2) : '-';
        const cls = s.semester_classification || '-';
        const clsColor = getClassColor(cls);
        const gpaColor = getGpaColor(parseFloat(s.semester_gpa));
        html += `
            <tr>
                <td>${s.semester_number}</td>
                <td>${s.year_name}</td>
                <td>${s.semester_name}</td>
                <td>${s.module_count}</td>
                <td>${s.total_credits}</td>
                <td style="font-weight:700;color:${gpaColor};">${gpa}</td>
                <td><span style="color:${clsColor};font-weight:600;">${cls}</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// MODULES (pivot table)
// ============================================
function renderModules() {
    const tbody = document.getElementById('modulesBody');
    const mods = detailData.modules || [];

    if (mods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#888;">No modules</td></tr>';
        return;
    }

    let html = '';
    mods.forEach(m => {
        const quizCell = (m.quiz_pct !== null && m.quiz_pct !== undefined)
            ? `<strong>${parseFloat(m.quiz_pct).toFixed(1)}%</strong><br><span style="font-size:10px;color:#888;">${m.quiz_score}/${m.quiz_max}</span>`
            : '<span style="color:#ccc;">—</span>';

        const asgCell = (m.assignment_pct !== null && m.assignment_pct !== undefined)
            ? `<strong>${parseFloat(m.assignment_pct).toFixed(1)}%</strong><br><span style="font-size:10px;color:#888;">${m.assignment_score}/${m.assignment_max}</span>`
            : '<span style="color:#ccc;">—</span>';

        const examCell = (m.exam_pct !== null && m.exam_pct !== undefined)
            ? `<strong>${parseFloat(m.exam_pct).toFixed(1)}%</strong><br><span style="font-size:10px;color:#888;">${m.exam_score}/${m.exam_max}</span>`
            : '<span style="color:#ccc;">—</span>';

        const finalPct = (m.final_pct !== null && m.final_pct !== undefined)
            ? parseFloat(m.final_pct).toFixed(1) + '%'
            : '—';
        const finalGrade = m.final_grade || '—';
        const finalClass = getGradeClass(finalGrade);

        html += `
            <tr>
                <td><strong>${m.module_code}</strong></td>
                <td>${m.module_name}</td>
                <td style="font-size:12px;">${m.year_name}<br><span style="color:#888;">${m.semester_name}</span></td>
                <td style="text-align:center;">${quizCell}</td>
                <td style="text-align:center;">${asgCell}</td>
                <td style="text-align:center;">${examCell}</td>
                <td style="text-align:center;"><strong>${finalPct}</strong></td>
                <td style="text-align:center;"><span class="grade-badge ${finalClass}">${finalGrade}</span></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ============================================
// HELPERS
// ============================================
function getGpaClass(gpa) {
    if (isNaN(gpa)) return '';
    if (gpa >= 3.70) return 'distinction';
    if (gpa >= 2.50) return 'credit';
    if (gpa >= 2.00) return 'pass';
    return 'fail';
}

function getGpaColor(gpa) {
    if (isNaN(gpa)) return '#888';
    if (gpa >= 3.70) return '#fd7e14';
    if (gpa >= 2.50) return '#17a2b8';
    if (gpa >= 2.00) return '#28a745';
    return '#dc3545';
}

function getClassColor(cls) {
    if (!cls) return '#888';
    const c = cls.toLowerCase();
    if (c.includes('distinction') || c.includes('first')) return '#fd7e14';
    if (c.includes('credit') || c.includes('upper')) return '#17a2b8';
    if (c.includes('lower') || c.includes('pass')) return '#28a745';
    if (c.includes('in progress')) return '#003366';
    if (c.includes('fail') || c.includes('third')) return '#dc3545';
    return '#333';
}

function getGradeClass(grade) {
    if (!grade) return '';
    const g = grade.toUpperCase();
    if (g.startsWith('A')) return 'A';
    if (g.startsWith('B')) return 'B';
    if (g.startsWith('C')) return 'C';
    if (g.startsWith('D')) return 'D';
    return 'F';
}

// ============================================
// GPA TREND CHART (Admin Student View)
// ============================================
function renderGPATrendChart() {
    const canvas = document.getElementById('gpaTrendChart');
    if (!canvas) return;
    if (typeof Chart === 'undefined') return;

    const sems = (detailData.semesters || []).filter(s => s.semester_gpa !== null);

    if (sems.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'center';
        ctx.fillText('No completed semesters yet', canvas.width / 2, 60);
        return;
    }

    const labels = sems.map(s => {
        const yr = (s.year_name || '').split('/')[0];
        return `${yr} ${s.semester_name.replace('Semester ', 'S')}`;
    });

    const data = sems.map(s => parseFloat(s.semester_gpa));

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Semester GPA',
                data: data,
                borderColor: '#003366',
                backgroundColor: 'rgba(0, 51, 102, 0.08)',
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointBackgroundColor: '#17a2b8',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    min: 0,
                    max: 4,
                    ticks: { stepSize: 0.5, callback: v => v.toFixed(1) },
                    grid: {
                        color: ctx => ctx.tick.value === 2.0
                            ? 'rgba(220, 53, 69, 0.5)'
                            : 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

// ============================================
// EVALUATE SEMESTER MODAL
// ============================================
function openEvaluateModal() {
    if (!detailData || !detailData.semesters || detailData.semesters.length === 0) {
        alert('No semester history available to evaluate.');
        return;
    }

    // Populate semester dropdown from the already-loaded history
    const sel = document.getElementById('evalSemester');
    sel.innerHTML = '<option value="">— Select Semester —</option>';

    // Only semesters that have a GPA (i.e. graded & released) can be evaluated
    detailData.semesters.forEach(s => {
        if (s.semester_gpa !== null && s.semester_gpa !== undefined) {
            const opt = document.createElement('option');
            opt.value = s.semester_id;
            opt.textContent = `${s.semester_name} · ${s.year_name}  (GPA ${parseFloat(s.semester_gpa).toFixed(2)})`;
            sel.appendChild(opt);
        }
    });

    if (sel.options.length === 1) {
        alert('No completed semesters to evaluate for this student.');
        return;
    }

    document.getElementById('evalError').style.display = 'none';
    document.getElementById('evalSuccess').style.display = 'none';
    document.getElementById('evalSubmitBtn').textContent = '⚖️ Evaluate';
    document.getElementById('evalSubmitBtn').disabled = false;

    document.getElementById('evaluateModal').style.display = 'block';
}

function closeEvaluateModal() {
    document.getElementById('evaluateModal').style.display = 'none';
}

async function submitEvaluate() {
    const errEl = document.getElementById('evalError');
    const succEl = document.getElementById('evalSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const semesterId = document.getElementById('evalSemester').value;
    if (!semesterId) {
        errEl.textContent = 'Please select a semester.';
        errEl.style.display = 'block';
        return;
    }

    if (!confirm('Run end-of-semester policy evaluation? This may create Referral, Carryover, or Repeat records, or withdraw the student.')) {
        return;
    }

    const btn = document.getElementById('evalSubmitBtn');
    btn.textContent = '⏳ Evaluating...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/evaluate-semester', {
            method: 'POST',
            body: JSON.stringify({
                studentNumber: detailData.profile.student_number,
                semesterId: parseInt(semesterId)
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Evaluation failed';
            errEl.style.display = 'block';
            btn.textContent = '⚖️ Evaluate';
            btn.disabled = false;
            return;
        }

        // Build the actions list
        let actionsHtml = '';
        if (Array.isArray(data.actions) && data.actions.length > 0) {
            actionsHtml = '<br><strong>Actions taken:</strong><ul style="margin:8px 0 0 20px;">';
            data.actions.forEach(a => {
                if (a.type === 'Withdrawn') {
                    actionsHtml += `<li style="color:#dc3545;"><strong>${a.type}:</strong> ${a.reason}${a.modules ? ' — ' + a.modules.join(', ') : ''}</li>`;
                } else {
                    actionsHtml += `<li><strong>${a.type}</strong> · ${a.module} (${a.credits} cr) — ${a.reason}</li>`;
                }
            });
            actionsHtml += '</ul>';
        } else {
            actionsHtml = '<br><em>No policy actions required — student passed all modules.</em>';
        }

        succEl.innerHTML = `
            <strong>✅ ${data.message}</strong><br>
            <strong>Outcome:</strong> ${data.outcome}<br>
            <strong>sGPA:</strong> ${data.sGPA} · <strong>cGPA:</strong> ${data.newCGPA}<br>
            <strong>Modules evaluated:</strong> ${data.totalModules} (${data.failedModules.length} failed)<br>
            <em>${data.message}</em>
            ${actionsHtml}
        `;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';

        // Refresh the page after a short delay so the new state is visible
        setTimeout(() => {
            closeEvaluateModal();
            location.reload();
        }, 3500);

    } catch (e) {
        console.error('Evaluate error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '⚖️ Evaluate';
        btn.disabled = false;
    }
}

// ============================================
// RECOMPUTE STANDING MODAL
// ============================================
function openStandingModal() {
    if (!detailData || !detailData.profile) {
        alert('Student data not loaded.');
        return;
    }

    document.getElementById('standingError').style.display = 'none';
    document.getElementById('standingSuccess').style.display = 'none';
    document.getElementById('standingSubmitBtn').textContent = '📊 Recompute';
    document.getElementById('standingSubmitBtn').disabled = false;

    document.getElementById('standingModal').style.display = 'block';
}

function closeStandingModal() {
    document.getElementById('standingModal').style.display = 'none';
}

async function submitStanding() {
    const errEl = document.getElementById('standingError');
    const succEl = document.getElementById('standingSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const btn = document.getElementById('standingSubmitBtn');
    btn.textContent = '⏳ Computing...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/admin/compute-standing', {
            method: 'POST',
            body: JSON.stringify({
                studentNumber: detailData.profile.student_number
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed to compute standing';
            errEl.style.display = 'block';
            btn.textContent = '📊 Recompute';
            btn.disabled = false;
            return;
        }

        const result = Array.isArray(data.results) && data.results.length > 0
            ? data.results[0]
            : null;

        if (!result) {
            succEl.textContent = '✅ Done — no data returned.';
            succEl.style.display = 'block';
            btn.textContent = '✓ Done';
            setTimeout(() => {
                closeStandingModal();
                location.reload();
            }, 2000);
            return;
        }

        succEl.innerHTML = `
            <strong>✅ Standing updated</strong><br>
            <strong>New standing:</strong> ${result.standing}<br>
            <strong>Reason:</strong> ${result.reason}
        `;
        succEl.style.display = 'block';
        btn.textContent = '✓ Done';

        setTimeout(() => {
            closeStandingModal();
            location.reload();
        }, 2500);

    } catch (e) {
        console.error('Standing error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '📊 Recompute';
        btn.disabled = false;
    }
}