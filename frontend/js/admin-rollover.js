// ============================================
// MUBAS ASSESSMENT SYSTEM - YEAR ROLLOVER WIZARD
// ============================================

let currentStep = 1;
let newAcademicYearId = null;

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Admin';
    document.getElementById('userRole').textContent = (user.role || 'Admin').toUpperCase();

    // Auto-load preview for step 1
    await loadRolloverPreview();
});

// ============================================
// NAVIGATION
// ============================================
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/index.html';
}

function showStep(step) {
    document.querySelectorAll('[id^="step-"]').forEach(el => el.style.display = 'none');
    const target = document.getElementById('step-' + step);
    if (target) target.style.display = 'block';

    // Update step dots
    document.querySelectorAll('.step-dot').forEach(el => {
        const dot = el.querySelector('div:first-child');
        const num = parseInt(el.dataset.step);
        if (num < step) {
            dot.style.background = '#28a745';
            dot.innerHTML = '✓';
        } else if (num === step) {
            dot.style.background = '#003366';
            dot.innerHTML = num;
        } else {
            dot.style.background = '#6c757d';
            dot.innerHTML = num;
        }
    });

    document.getElementById('btnPrev').style.display = step > 1 ? 'block' : 'none';
    document.getElementById('btnNext').style.display = step < 6 ? 'block' : 'none';

    currentStep = step;
}

function nextStep() {
    if (currentStep < 6) showStep(currentStep + 1);
}

function prevStep() {
    if (currentStep > 1) showStep(currentStep - 1);
}

// ============================================
// PREVIEW
// ============================================
async function loadRolloverPreview() {
    try {
        const r = await apiRequest('/admin/rollover-preview');
        if (r.ok) {
            const data = await r.json();
            document.getElementById('step1Preview').innerHTML = `
                <strong>Current Year:</strong> ${data.current.year_name} · ${data.current.semester_name}<br>
                <strong>Proposed Next Year:</strong> ${data.proposed.year_name}<br>
                <strong>Suggested Dates:</strong> ${data.proposed.start_date} → ${data.proposed.end_date}<br>
                <strong>Current Active Enrollments:</strong> ${data.currentEnrollments}
            `;

            // Auto-fill form
            document.getElementById('newYearName').value = data.proposed.year_name;
            document.getElementById('newYearStart').value = data.proposed.start_date;
            document.getElementById('newYearEnd').value = data.proposed.end_date;
        }
    } catch (e) {
        document.getElementById('step1Preview').textContent = 'Preview failed: ' + e.message;
    }
}

// ============================================
// STEP 1: Create Year
// ============================================
async function executeStep1() {
    const yearName = document.getElementById('newYearName').value.trim();
    const startDate = document.getElementById('newYearStart').value;
    const endDate = document.getElementById('newYearEnd').value;

    if (!yearName || !startDate || !endDate) {
        alert('Please fill all fields');
        return;
    }

    if (!confirm(`Create academic year ${yearName} as INACTIVE?`)) return;

    const btn = document.getElementById('btnStep1');
    btn.disabled = true;
    btn.textContent = '⏳ Creating...';

    try {
        const r = await apiRequest('/admin/rollover-year', {
            method: 'POST',
            body: JSON.stringify({ yearName, startDate, endDate })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            btn.disabled = false;
            btn.textContent = '▶️ Create Year (Inactive)';
            return;
        }

        newAcademicYearId = data.academicYearId;
        document.getElementById('step1Result').style.display = 'block';
        document.getElementById('step1Result').innerHTML = `
            ✅ <strong>${data.message}</strong><br>
            Academic Year ID: <strong>${newAcademicYearId}</strong><br>
            Semester 1 ID: ${data.semester1Id} · Semester 2 ID: ${data.semester2Id}<br>
            <em>Current year remains 2026/2027 until Step 6.</em>
        `;
        btn.textContent = '✓ Created';
        showStep(2);
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = '▶️ Create Year (Inactive)';
    }
}

// ============================================
// STEP 2: Create Offerings
// ============================================
async function executeStep2() {
    if (!newAcademicYearId) return alert('Complete Step 1 first');

    if (!confirm('Auto-create offerings for all curriculum modules in the new year?')) return;

    const btn = document.getElementById('btnStep2');
    btn.disabled = true;
    btn.textContent = '⏳ Creating...';

    try {
        const r = await apiRequest('/admin/create-offerings-for-year', {
            method: 'POST',
            body: JSON.stringify({ academicYearId: newAcademicYearId })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            btn.disabled = false;
            btn.textContent = '▶️ Create Offerings';
            return;
        }

        document.getElementById('step2Result').style.display = 'block';
        document.getElementById('step2Result').innerHTML = `
            ✅ <strong>${data.message}</strong><br>
            Semester 1: ${data.semester1Offerings} offerings<br>
            Semester 2: ${data.semester2Offerings} offerings<br>
            <strong>Total: ${data.totalCreated}</strong>
        `;
        btn.textContent = '✓ Created';
        showStep(3);
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = '▶️ Create Offerings';
    }
}

// ============================================
// STEP 3: Promote Students
// ============================================
async function executeStep3() {
    if (!newAcademicYearId) return alert('Complete Step 1 first');

    if (!confirm('Promote all non-final-year students to the next year? They will be enrolled in the new semester-1 modules.')) return;

    const btn = document.getElementById('btnStep3');
    btn.disabled = true;
    btn.textContent = '⏳ Promoting...';

    try {
        const r = await apiRequest('/admin/promote-students', {
            method: 'POST',
            body: JSON.stringify({ academicYearId: newAcademicYearId })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            btn.disabled = false;
            btn.textContent = '▶️ Promote Students';
            return;
        }

        let finalYearList = '';
        if (data.finalYearStudents && data.finalYearStudents.length > 0) {
            finalYearList = '<br><strong>Skipped (final year):</strong><ul style="margin:5px 0 0 20px;">' +
                data.finalYearStudents.map(s => `<li>${s.name} (${s.student_number}) — Year ${s.year} ${s.program}</li>`).join('') +
                '</ul>';
        }

        document.getElementById('step3Result').style.display = 'block';
        document.getElementById('step3Result').innerHTML = `
            ✅ <strong>${data.message}</strong><br>
            Promoted: <strong>${data.promoted}</strong> students<br>
            Enrollments created: <strong>${data.enrollmentsCreated}</strong><br>
            Skipped (final year): <strong>${data.skippedFinalYear}</strong>
            ${finalYearList}
        `;
        btn.textContent = '✓ Promoted';
        showStep(4);
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = '▶️ Promote Students';
    }
}

// ============================================
// STEP 4: Graduate Final Year
// ============================================
async function executeStep4() {
    if (!newAcademicYearId) return alert('Complete Step 1 first');

    if (!confirm('Graduate all eligible final-year students? They will be marked as Graduated and awarded classifications.')) return;

    const btn = document.getElementById('btnStep4');
    btn.disabled = true;
    btn.textContent = '⏳ Graduating...';

    try {
        const r = await apiRequest('/admin/graduate-final-year', {
            method: 'POST',
            body: JSON.stringify({ academicYearId: newAcademicYearId })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            btn.disabled = false;
            btn.textContent = '▶️ Graduate Final-Year Students';
            return;
        }

        let graduateList = '';
        if (data.graduates && data.graduates.length > 0) {
            graduateList = '<div style="margin-top:10px;"><strong>Graduates:</strong></div>' +
                '<table style="width:100%;margin-top:8px;font-size:12px;border-collapse:collapse;">' +
                '<thead><tr style="background:#003366;color:white;">' +
                '<th style="padding:6px;text-align:left;">Student</th>' +
                '<th style="padding:6px;">Program</th>' +
                '<th style="padding:6px;">cGPA</th>' +
                '<th style="padding:6px;">Classification</th></tr></thead><tbody>' +
                data.graduates.map(g => `
                    <tr style="border-bottom:1px solid #eee;">
                        <td style="padding:6px;"><strong>${g.name}</strong><br><span style="font-size:11px;color:#888;">${g.student_number}</span></td>
                        <td style="padding:6px;text-align:center;">${g.program} (${g.duration}yr)</td>
                        <td style="padding:6px;text-align:center;">${g.cgpa}</td>
                        <td style="padding:6px;text-align:center;"><strong>${g.classification}</strong></td>
                    </tr>
                `).join('') + '</tbody></table>';
        }

        document.getElementById('step4Result').style.display = 'block';
        document.getElementById('step4Result').innerHTML = `
            ✅ <strong>${data.message}</strong><br>
            Graduated: <strong>${data.graduated}</strong> students
            ${graduateList}
        `;
        btn.textContent = '✓ Graduated';
        showStep(5);
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = '▶️ Graduate Final-Year Students';
    }
}

// ============================================
// STEP 5: Seed Assessments
// ============================================
async function executeStep5() {
    if (!newAcademicYearId) return alert('Complete Step 1 first');

    if (!confirm('Seed assessments (Quiz 20%, Assignment 30%, Final Exam 50%) for all new offerings?')) return;

    const btn = document.getElementById('btnStep5');
    btn.disabled = true;
    btn.textContent = '⏳ Seeding...';

    try {
        const r = await apiRequest('/admin/seed-assessments-for-year', {
            method: 'POST',
            body: JSON.stringify({ academicYearId: newAcademicYearId })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            btn.disabled = false;
            btn.textContent = '▶️ Seed Assessments';
            return;
        }

        document.getElementById('step5Result').style.display = 'block';
        document.getElementById('step5Result').innerHTML = `
            ✅ <strong>${data.message}</strong><br>
            Offerings processed: <strong>${data.offeringsProcessed}</strong><br>
            Assessments created: <strong>${data.assessmentsCreated}</strong>
        `;
        btn.textContent = '✓ Seeded';
        showStep(6);
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = '▶️ Seed Assessments';
    }
}

// ============================================
// STEP 6: Activate Year
// ============================================
async function executeStep6() {
    if (!newAcademicYearId) return alert('Complete Step 1 first');

    if (!confirm('ACTIVATE the new year? This is the final step. Students will see their new modules immediately.')) return;

    const btn = document.getElementById('btnStep6');
    btn.disabled = true;
    btn.textContent = '⏳ Activating...';

    try {
        const r = await apiRequest('/admin/activate-year', {
            method: 'POST',
            body: JSON.stringify({ academicYearId: newAcademicYearId })
        });
        const data = await r.json();

        if (!r.ok) {
            alert('Error: ' + (data.message || 'Failed'));
            btn.disabled = false;
            btn.textContent = '⚡ Activate New Year';
            return;
        }

        document.getElementById('step6Result').style.display = 'block';
        document.getElementById('step6Result').innerHTML = `
            🎉 <strong>${data.message}</strong><br>
            Old year: ${data.oldYear}<br>
            New year: <strong>${data.newYear}</strong><br>
            Active semester: <strong>${data.activeSemester}</strong><br>
            Enrollments marked completed: ${data.enrollmentsCompleted}<br><br>
            <em>The system is now on the new academic year.</em>
        `;
        btn.textContent = '✓ Activated';
        btn.style.opacity = '0.6';
    } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.textContent = '⚡ Activate New Year';
    }
}

// ============================================
// EMERGENCY ROLLBACK
// ============================================
async function executeRollback() {
    const year = document.getElementById('rollbackYearName').value.trim();
    if (!year) {
        alert('Please enter the year name to delete (e.g. 2027/2028).');
        return;
    }

    if (!confirm(`Delete year "${year}"? This will remove all its semesters, offerings, and enrollments, and re-activate the previous year. This cannot be undone.`)) return;

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ Rolling back...';

    const resultEl = document.getElementById('rollbackResult');
    resultEl.style.display = 'none';

    try {
        const r = await apiRequest('/admin/rollback-rollover', {
            method: 'POST',
            body: JSON.stringify({ yearToDelete: year })
        });
        const data = await r.json();

        if (!r.ok) {
            resultEl.style.background = '#f8d7da';
            resultEl.style.color = '#721c24';
            resultEl.textContent = '❌ ' + (data.message || 'Rollback failed');
            resultEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = '🗑️ Roll Back This Year';
            return;
        }

        resultEl.style.background = '#d4edda';
        resultEl.style.color = '#155724';
        resultEl.innerHTML = `
            <strong>✅ ${data.message}</strong><br>
            Reactivated year: <strong>${data.reactivatedYear || '—'}</strong><br>
            Deleted offerings: ${data.deletedOfferings}<br>
            Deleted enrollments: ${data.deletedEnrollments}
        `;
        resultEl.style.display = 'block';
        btn.textContent = '✓ Rolled back';
    } catch (e) {
        console.error('Rollback error:', e);
        resultEl.style.background = '#f8d7da';
        resultEl.style.color = '#721c24';
        resultEl.textContent = 'Network error: ' + e.message;
        resultEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '🗑️ Roll Back This Year';
    }
}


// ============================================
// SEMESTER 2 ACTIVATION
// ============================================
async function executeSemester2() {
    if (!confirm('Activate Semester 2?\n\nThis will:\n• Mark all Semester 1 enrollments as Completed\n• Activate Semester 2\n• Enrol eligible students in their Semester 2 modules\n\nStudents with pending referrals/carryovers/repeats will be skipped.')) return;

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ Activating...';

    const resultEl = document.getElementById('sem2Result');
    resultEl.style.display = 'none';

    try {
        const r = await apiRequest('/admin/activate-semester-2', {
            method: 'POST',
            body: JSON.stringify({})
        });
        const data = await r.json();

        if (!r.ok) {
            resultEl.style.background = '#f8d7da';
            resultEl.style.color = '#721c24';
            resultEl.textContent = '❌ ' + (data.message || 'Failed');
            resultEl.style.display = 'block';
            btn.disabled = false;
            btn.textContent = '▶️ Activate Semester 2';
            return;
        }

        let blockedList = '';
        if (data.blockedStudents && data.blockedStudents.length > 0) {
            blockedList = '<br><strong>Skipped students (unresolved obligations):</strong><ul style="margin:5px 0 0 20px;">' +
                data.blockedStudents.map(s => `<li>${s.student_number} — ${s.reason}</li>`).join('') +
                '</ul>';
        }

        resultEl.style.background = '#d4edda';
        resultEl.style.color = '#155724';
        resultEl.innerHTML = `
            <strong>✅ ${data.message}</strong><br>
            <strong>Active semester:</strong> ${data.activeSemester}<br>
            <strong>Semester 1 enrollments completed:</strong> ${data.enrollmentsCompleted}<br>
            <strong>Students enrolled in Semester 2:</strong> ${data.studentsEnrolled}<br>
            <strong>Skipped:</strong> ${data.skippedStudents}
            ${blockedList}
        `;
        resultEl.style.display = 'block';
        btn.textContent = '✓ Activated';
    } catch (e) {
        console.error('Semester 2 error:', e);
        resultEl.style.background = '#f8d7da';
        resultEl.style.color = '#721c24';
        resultEl.textContent = 'Network error: ' + e.message;
        resultEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = '▶️ Activate Semester 2';
    }
}