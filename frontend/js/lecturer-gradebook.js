// ============================================
// MUBAS ASSESSMENT SYSTEM - LECTURER GRADEBOOK
// ============================================

let offeringData = null;
let offeringInfo = null;
let assessmentsList = [];
let studentsList = [];
let gradesMap = {};       // { enrollmentId_assessmentId: grade }
let unsavedChanges = {};  // { enrollmentId_assessmentId: score }

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Lecturer';

    const params = new URLSearchParams(window.location.search);
    const offeringId = params.get('offering');

    if (!offeringId) {
        document.getElementById('loading').textContent = 'No offering specified.';
        return;
    }

    await loadGradebook(offeringId);

    if (!offeringData) return;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    renderBanner();
    renderStatusBadge();
    renderSummary();
    renderGradebook();
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
async function loadGradebook(offeringId) {
    try {
        const r = await apiRequest('/lecturer/offering-detail?offeringId=' + offeringId);
        if (!r.ok) {
            document.getElementById('loading').textContent = 'Failed to load (' + r.status + ')';
            return;
        }
        offeringData = await r.json();
        offeringInfo = offeringData.offering;
        assessmentsList = offeringData.assessments || [];
        studentsList = offeringData.students || [];

        // Build grades lookup
        (offeringData.grades || []).forEach(g => {
            gradesMap[g.enrollment_id + '_' + g.assessment_id] = g;
        });
    } catch (e) {
        console.error('Gradebook load error:', e);
        document.getElementById('loading').textContent = 'Error: ' + e.message;
    }
}

// ============================================
// BANNER
// ============================================
function renderBanner() {
    if (!offeringInfo) return;
    document.getElementById('moduleTitle').textContent = 
        `${offeringInfo.module_code} — ${offeringInfo.module_name}`;
    document.getElementById('moduleSubtitle').textContent = 
        `${offeringInfo.credits} credits · ${offeringInfo.semester_name} · ${offeringInfo.year_name}`;
    document.getElementById('bannerProgram').textContent = offeringInfo.program_code;
    document.getElementById('bannerYear').textContent = 
        `Year ${offeringInfo.year_of_study} · Semester ${offeringInfo.curriculum_semester}`;
}

// ============================================
// STATUS BADGE
// ============================================
function renderStatusBadge() {
    if (!offeringInfo) return;
    const badge = document.getElementById('statusBadge');
    const submitBtn = document.getElementById('submitBtn');
    const manageBtn = document.getElementById('manageAssessmentsBtn');
    if (!badge) return;

    const status = offeringInfo.approval_status || 'Draft';

    const styles = {
        'Draft':           { bg: '#e2e8f0', color: '#475569', label: 'Draft' },
        'Submitted':       { bg: '#fef3c7', color: '#854d0e', label: 'Submitted to HoD' },
        'HoD_Approved':    { bg: '#cffafe', color: '#155e75', label: 'Approved by HoD' },
        'Dean_Approved':   { bg: '#dbeafe', color: '#1e40af', label: 'Approved by Dean' },
        'Senate_Approved': { bg: '#dcfce7', color: '#166534', label: 'Approved by Senate' },
        'Released':        { bg: '#003366', color: '#ffffff', label: 'Released to Students' },
        'Rejected':        { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' }
    };

    const s = styles[status] || styles['Draft'];
    badge.textContent = s.label;
    badge.style.background = s.bg;
    badge.style.color = s.color;

    const isEditable = (status === 'Draft' || status === 'Rejected');

    if (submitBtn) {
        submitBtn.disabled = !isEditable;
        submitBtn.style.opacity = isEditable ? '1' : '0.5';
        submitBtn.style.cursor = isEditable ? 'pointer' : 'not-allowed';
        submitBtn.title = isEditable ? '' : `Cannot submit while status is ${status.replace(/_/g, ' ')}`;
    }

    if (manageBtn) {
        manageBtn.disabled = !isEditable;
        manageBtn.style.opacity = isEditable ? '1' : '0.5';
        manageBtn.style.cursor = isEditable ? 'pointer' : 'not-allowed';
        manageBtn.title = isEditable ? '' : `Cannot manage assessments while status is ${status.replace(/_/g, ' ')}`;
    }

    const banner = document.getElementById('lockedBanner');
    const bannerText = document.getElementById('lockedBannerText');
    if (banner && bannerText) {
        if (isEditable) {
            banner.style.display = 'none';
        } else {
            const explanations = {
                'Submitted':       'Waiting for HoD approval. It will re-open if rejected.',
                'HoD_Approved':    'Approved by HoD. Waiting for Dean approval.',
                'Dean_Approved':   'Approved by Dean. Waiting for Senate approval.',
                'Senate_Approved': 'Approved by Senate. Waiting for VC release.',
                'Released':        'Results are published to students. Edits are no longer possible.'
            };
            bannerText.textContent = explanations[status] || `Status: ${status}.`;
            banner.style.display = 'block';
        }
    }
        // Add a plain-English hint next to the badge
    const hint = document.getElementById('statusHint');
    if (hint) {
        const hints = {
            'Draft':           'Editable — save changes and submit when ready',
            'Submitted':       'Locked — waiting for HoD approval',
            'HoD_Approved':    'Locked — waiting for Dean approval',
            'Dean_Approved':   'Locked — waiting for Senate approval',
            'Senate_Approved': 'Locked — waiting for VC release',
            'Released':        'Frozen — results visible to students (no edits)',
            'Rejected':        'Editable — fix the issue and resubmit'
        };
        hint.textContent = hints[status] || '';
    }
}

// ============================================
// SUBMIT FOR APPROVAL
// ============================================
async function submitForApproval() {
    // Warn about unsaved changes
    const unsavedCount = Object.keys(unsavedChanges).length;
    if (unsavedCount > 0) {
        if (!confirm(`You have ${unsavedCount} unsaved change(s). Save them first?`)) return;
        await saveAll();
    }

    if (!confirm('Submit this gradebook to your HoD for approval?\n\nYou will not be able to edit grades after submission until it is approved or rejected.')) return;

    const btn = document.getElementById('submitBtn');
    btn.textContent = '⏳ Submitting...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/lecturer/submit-for-approval', {
            method: 'POST',
            body: JSON.stringify({
                offeringId: offeringInfo.offering_id,
                remarks: null
            })
        });

        const data = await r.json();

        if (!r.ok) {
            btn.textContent = '📤 Submit for Approval';
            btn.disabled = false;

            if (data.incomplete && data.incomplete.length > 0) {
                let msg = '⚠️ Cannot submit — some grades are missing:\n\n';
                data.incomplete.slice(0, 5).forEach(i => {
                    msg += `• ${i.student_name} (${i.student_number}) — ${i.assessment_name}\n`;
                });
                if (data.incomplete.length > 5) msg += `\n... and ${data.incomplete.length - 5} more`;
                alert(msg);
            } else {
                alert('Error: ' + (data.message || 'Failed to submit'));
            }
            return;
        }

        // Success — update local status + re-render badge
        offeringInfo.approval_status = 'Submitted';
        renderStatusBadge();

        alert('✅ Submitted successfully!\n\nYour HoD will now review and approve the grades.');

        // Disable all inputs
        document.querySelectorAll('input[data-enrollment]').forEach(inp => {
            inp.disabled = true;
            inp.style.background = '#f5f5f5';
            inp.style.cursor = 'not-allowed';
        });

        btn.textContent = '📤 Submit for Approval';
    } catch (err) {
        console.error('Submit error:', err);
        btn.textContent = '📤 Submit for Approval';
        btn.disabled = false;
        alert('Error submitting: ' + err.message);
    }
}

// ============================================
// SUMMARY
// ============================================
function renderSummary() {
    const totalAssessments = assessmentsList.length;
    const totalStudents = studentsList.length;
    const totalPossible = totalAssessments * totalStudents;
    const totalEntered = Object.keys(gradesMap).length;
    const progress = totalPossible > 0 ? Math.round((totalEntered / totalPossible) * 100) : 0;

    document.getElementById('statStudents').textContent = totalStudents;
    document.getElementById('statAssessments').textContent = totalAssessments;
    document.getElementById('statGrades').textContent = totalEntered;
    document.getElementById('statGradesSub').textContent = `of ${totalPossible}`;
    document.getElementById('statProgress').textContent = progress;
}

// ============================================
// GRADEBOOK TABLE
// ============================================
function renderGradebook() {
    const head = document.getElementById('gradebookHead');
    const body = document.getElementById('gradebookBody');

    if (studentsList.length === 0 || assessmentsList.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;padding:20px;">No students or assessments</td></tr>';
        return;
    }

    // ============================================================
    // HEADER
    // ============================================================
    let headerHtml = '<tr>';
    headerHtml += '<th style="min-width:140px;">Student</th>';
    headerHtml += '<th style="min-width:100px;">Reg No</th>';

    assessmentsList.forEach(a => {
        headerHtml += `
            <th style="text-align:center;min-width:120px;">
                ${a.name}<br>
                <span style="font-size:11px;font-weight:400;color:#888;">
                    ${a.type} · ${a.weight_percentage}% · max ${a.max_score}
                </span>
            </th>
        `;
    });

    headerHtml += '<th style="text-align:center;min-width:100px;">Final %</th>';
    headerHtml += '<th style="text-align:center;min-width:80px;">Grade</th>';
    headerHtml += '</tr>';
    head.innerHTML = headerHtml;

    // ============================================================
    // BODY
    // ============================================================
    let bodyHtml = '';
    studentsList.forEach(s => {
        bodyHtml += '<tr>';
        bodyHtml += `<td><strong>${s.full_name}</strong></td>`;
        bodyHtml += `<td style="font-size:12px;color:#666;">${s.student_number}</td>`;

        assessmentsList.forEach(a => {
            const key = s.enrollment_id + '_' + a.assessment_id;
            const g = gradesMap[key];
            const existingScore = g ? g.score_obtained : '';
            const maxScore = a.max_score;

            bodyHtml += `
                <td style="text-align:center;">
                    <input type="number" 
                        step="0.5" 
                        min="0" 
                        max="${maxScore}"
                        value="${existingScore}"
                        data-enrollment="${s.enrollment_id}"
                        data-assessment="${a.assessment_id}"
                        data-key="${key}"
                        placeholder="--"
                        style="width:80px;padding:6px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:14px;"
                        onchange="onScoreChange(this)"
                        oninput="onScoreInput(this)">
                </td>
            `;
        });

        // Final columns (computed dynamically)
        bodyHtml += `<td style="text-align:center;font-weight:700;color:#003366;" id="final_${s.enrollment_id}">--</td>`;
        bodyHtml += `<td style="text-align:center;" id="grade_${s.enrollment_id}">--</td>`;
        bodyHtml += '</tr>';
    });
    body.innerHTML = bodyHtml;

    // Compute finals on load
    studentsList.forEach(s => computeFinal(s.enrollment_id));
}

// ============================================
// HANDLE SCORE INPUT
// ============================================
function onScoreInput(input) {
    // Visual feedback when user types
    const val = input.value.trim();
    if (val !== '' && val !== input.dataset.savedValue) {
        input.style.borderColor = '#ffc107';
        input.style.background = '#fff8e1';
    }
}

function onScoreChange(input) {
    const key = input.dataset.key;
    const val = input.value.trim();

    if (val === '') {
        // Removed → revert to saved value if exists
        const g = gradesMap[key];
        if (g) {
            unsavedChanges[key] = null; // mark for clearing
        }
        input.style.borderColor = '#ccc';
        input.style.background = 'white';
        computeFinal(parseInt(input.dataset.enrollment));
        return;
    }

    const num = parseFloat(val);
    const max = parseFloat(input.max);
    if (isNaN(num) || num < 0 || num > max) {
        input.style.borderColor = '#dc3545';
        input.style.background = '#f8d7da';
        return;
    }

    unsavedChanges[key] = num;
    input.style.borderColor = '#28a745';
    input.style.background = '#d4edda';
    input.dataset.savedValue = val;

    computeFinal(parseInt(input.dataset.enrollment));
}

// ============================================
// COMPUTE FINAL PERCENTAGE + GRADE FOR A STUDENT
// ============================================
function computeFinal(enrollmentId) {
    const student = studentsList.find(s => s.enrollment_id === enrollmentId);
    if (!student) return;

    let totalWeighted = 0;
    let totalWeight = 0;

    assessmentsList.forEach(a => {
        const key = enrollmentId + '_' + a.assessment_id;
        let score = null;

        // Prefer unsaved change, else use saved
        if (key in unsavedChanges) {
            score = unsavedChanges[key];
        } else if (gradesMap[key]) {
            score = parseFloat(gradesMap[key].score_obtained);
        }

        if (score !== null && score !== undefined && !isNaN(score)) {
            const pct = (score / parseFloat(a.max_score)) * 100;
            totalWeighted += pct * (parseFloat(a.weight_percentage) / 100);
            totalWeight += parseFloat(a.weight_percentage) / 100;
        }
    });

    const finalEl = document.getElementById('final_' + enrollmentId);
    const gradeEl = document.getElementById('grade_' + enrollmentId);

    if (totalWeight === 0) {
        finalEl.textContent = '--';
        finalEl.style.color = '#888';
        gradeEl.innerHTML = '--';
        return;
    }

    const finalPct = totalWeighted / totalWeight;
    finalEl.textContent = finalPct.toFixed(2) + '%';

    const letter = getGradeLetter(finalPct);
    const letterClass = getGradeClass(letter);
    gradeEl.innerHTML = `<span class="grade-badge ${letterClass}">${letter}</span>`;

    const color = getGpaColorForLetter(letter);
    finalEl.style.color = color;
}

// ============================================
// SAVE ALL CHANGES
// ============================================
async function saveAll() {
    const keys = Object.keys(unsavedChanges);
    if (keys.length === 0) {
        alert('No changes to save.');
        return;
    }

    if (!confirm(`Save ${keys.length} grade change(s)?`)) return;

    const btn = event.target;
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    let successCount = 0;
    let failCount = 0;

    for (const key of keys) {
        const score = unsavedChanges[key];
        const [enrollmentId, assessmentId] = key.split('_');

        if (score === null) {
            // Skip clearing for now (could add delete endpoint later)
            delete unsavedChanges[key];
            continue;
        }

        try {
            const r = await apiRequest('/lecturer/save-grade', {
                method: 'POST',
                body: JSON.stringify({
                    enrollmentId: parseInt(enrollmentId),
                    assessmentId: parseInt(assessmentId),
                    scoreObtained: score
                })
            });

            if (r.ok) {
                const result = await r.json();
                // Update local gradesMap
                gradesMap[key] = {
                    enrollment_id: parseInt(enrollmentId),
                    assessment_id: parseInt(assessmentId),
                    score_obtained: result.score,
                    percentage: result.percentage,
                    grade_letter: result.grade_letter,
                    grade_points: result.grade_points
                };
                successCount++;
                delete unsavedChanges[key];
            } else {
                failCount++;
            }
        } catch (e) {
            console.error('Save error for ' + key + ':', e);
            failCount++;
        }
    }

    btn.textContent = '💾 Save All Changes';
    btn.disabled = false;

    // Reset input styles
    document.querySelectorAll('input[data-enrollment]').forEach(inp => {
        const val = inp.value.trim();
        if (val !== '') {
            inp.style.borderColor = '#ccc';
            inp.style.background = 'white';
        }
    });

    // Refresh summary
    renderSummary();

    // Notify
    if (failCount === 0) {
        alert(`✅ Saved ${successCount} grade(s) successfully!`);
    } else {
        alert(`⚠️ Saved ${successCount}, failed ${failCount}. Check console for details.`);
    }
}

// ============================================
// HELPERS
// ============================================
function getGradeLetter(pct) {
    if (pct >= 96) return 'A+';
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'A-';
    if (pct >= 77) return 'B+';
    if (pct >= 73) return 'B';
    if (pct >= 70) return 'B-';
    if (pct >= 67) return 'C+';
    if (pct >= 63) return 'C';
    if (pct >= 60) return 'C-';
    if (pct >= 57) return 'D+';
    if (pct >= 53) return 'D';
    if (pct >= 50) return 'D-';
    if (pct >= 45) return 'E+';
    if (pct >= 40) return 'E';
    return 'F-';
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

function getGpaColorForLetter(letter) {
    if (!letter) return '#888';
    if (letter.startsWith('A')) return '#fd7e14';
    if (letter.startsWith('B')) return '#17a2b8';
    if (letter.startsWith('C')) return '#28a745';
    if (letter.startsWith('D') || letter.startsWith('E')) return '#ffc107';
    return '#dc3545';
}


// ============================================
// MANAGE ASSESSMENTS MODAL
// ============================================
function openManageAssessments() {
    if (!offeringInfo) return;
    if (!['Draft', 'Rejected'].includes(offeringInfo.approval_status)) {
        alert(`Cannot manage assessments while status is '${offeringInfo.approval_status}'.`);
        return;
    }

    document.getElementById('assessError').style.display = 'none';
    document.getElementById('assessSuccess').style.display = 'none';
    document.getElementById('newAssessName').value = '';
    document.getElementById('newAssessType').value = 'Quiz';
    document.getElementById('newAssessWeight').value = '20';
    document.getElementById('newAssessMax').value = '100';
    document.getElementById('newAssessDue').value = '';

    renderManageList();
    document.getElementById('assessmentsModal').style.display = 'block';
}

function closeManageAssessments() {
    document.getElementById('assessmentsModal').style.display = 'none';
}

function renderManageList() {
    const container = document.getElementById('assessmentsList');
    const weightBar = document.getElementById('assessWeightBar');

    if (!assessmentsList || assessmentsList.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#888;padding:20px;">No assessments yet.</div>';
        weightBar.innerHTML = '<strong>Total weight:</strong> 0% <span style="color:#dc3545;">(must reach 100% before submission)</span>';
        return;
    }

    // Weight bar
    const totalWeight = assessmentsList.reduce((s, a) => s + parseFloat(a.weight_percentage), 0);
    const weightColor = totalWeight === 100 ? '#28a745' : (totalWeight > 100 ? '#dc3545' : '#ffc107');
    weightBar.innerHTML = `<strong>Total weight:</strong> <span style="color:${weightColor};font-weight:700;font-size:16px;">${totalWeight.toFixed(1)}%</span> ${totalWeight !== 100 ? '<span style="color:#888;">(must equal 100%)</span>' : '<span style="color:#28a745;">✓</span>'}`;

    // Assessment rows
    let html = '<table style="width:100%;border-collapse:collapse;font-size:14px;">';
    html += '<thead><tr style="background:#f0f4f8;color:#333;">';
    html += '<th style="padding:10px;text-align:left;">Name</th>';
    html += '<th style="padding:10px;text-align:left;">Type</th>';
    html += '<th style="padding:10px;text-align:center;">Weight</th>';
    html += '<th style="padding:10px;text-align:center;">Max</th>';
    html += '<th style="padding:10px;text-align:center;">Action</th>';
    html += '</tr></thead><tbody>';

    assessmentsList.forEach(a => {
        html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px;">
                    <input type="text" value="${a.name}" id="a-name-${a.assessment_id}"
                        style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;font-size:13px;">
                </td>
                <td style="padding:10px;">
                    <select id="a-type-${a.assessment_id}" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:4px;font-size:13px;">
                        ${['Quiz','Test','Assignment','Practical','Project','Presentation','Midterm Exam','Final Exam','Continuous Assessment']
                          .map(t => `<option value="${t}" ${t === a.type ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </td>
                <td style="padding:10px;text-align:center;">
                    <input type="number" value="${parseFloat(a.weight_percentage)}" id="a-weight-${a.assessment_id}"
                        min="1" max="100" step="1" style="width:70px;padding:6px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:13px;">
                </td>
                <td style="padding:10px;text-align:center;">
                    <input type="number" value="${parseFloat(a.max_score)}" id="a-max-${a.assessment_id}"
                        min="1" step="1" style="width:70px;padding:6px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:13px;">
                </td>
                <td style="padding:10px;text-align:center;white-space:nowrap;">
                    <button onclick="saveAssessment(${a.assessment_id})" style="padding:6px 12px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;margin-right:4px;">💾 Save</button>
                    <button onclick="deleteAssessment(${a.assessment_id}, '${a.name.replace(/'/g, '&#39;')}')" style="padding:6px 12px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">🗑️</button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

async function addAssessment() {
    const errEl = document.getElementById('assessError');
    const succEl = document.getElementById('assessSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const name = document.getElementById('newAssessName').value.trim();
    const type = document.getElementById('newAssessType').value;
    const weight = parseFloat(document.getElementById('newAssessWeight').value);
    const max = parseFloat(document.getElementById('newAssessMax').value);
    const due = document.getElementById('newAssessDue').value || null;

    if (!name) {
        errEl.textContent = 'Please enter an assessment name.';
        errEl.style.display = 'block';
        return;
    }
    if (isNaN(weight) || weight <= 0) {
        errEl.textContent = 'Please enter a valid weight percentage.';
        errEl.style.display = 'block';
        return;
    }
    if (isNaN(max) || max <= 0) {
        errEl.textContent = 'Please enter a valid max score.';
        errEl.style.display = 'block';
        return;
    }

    try {
        const r = await apiRequest('/lecturer/add-assessment', {
            method: 'POST',
            body: JSON.stringify({
                offeringId: offeringInfo.offering_id,
                name, type,
                weightPercentage: weight,
                maxScore: max,
                dueDate: due
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed to add assessment';
            errEl.style.display = 'block';
            return;
        }

        succEl.textContent = '✅ Assessment added. Reloading...';
        succEl.style.display = 'block';

        // Reload gradebook so the new column appears
        await refreshGradebook();
    } catch (e) {
        console.error('Add assessment error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
    }
}

async function saveAssessment(assessmentId) {
    const errEl = document.getElementById('assessError');
    const succEl = document.getElementById('assessSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const name = document.getElementById('a-name-' + assessmentId).value.trim();
    const type = document.getElementById('a-type-' + assessmentId).value;
    const weight = parseFloat(document.getElementById('a-weight-' + assessmentId).value);
    const max = parseFloat(document.getElementById('a-max-' + assessmentId).value);

    try {
        const r = await apiRequest('/lecturer/update-assessment', {
            method: 'PUT',
            body: JSON.stringify({
                assessmentId,
                name, type,
                weightPercentage: weight,
                maxScore: max
            })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed to update';
            errEl.style.display = 'block';
            return;
        }

        succEl.textContent = '✅ Assessment updated.';
        succEl.style.display = 'block';
        await refreshGradebook();
    } catch (e) {
        console.error('Update assessment error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
    }
}

async function deleteAssessment(assessmentId, name) {
    if (!confirm(`Delete assessment "${name}"?\n\nThis can only be done if no grades have been recorded for it.`)) return;

    const errEl = document.getElementById('assessError');
    const succEl = document.getElementById('assessSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    try {
        const r = await apiRequest('/lecturer/delete-assessment?assessmentId=' + assessmentId, {
            method: 'DELETE'
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed to delete';
            errEl.style.display = 'block';
            return;
        }

        succEl.textContent = '✅ Assessment deleted.';
        succEl.style.display = 'block';
        await refreshGradebook();
    } catch (e) {
        console.error('Delete assessment error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
    }
}

// Reload gradebook data + re-render everything (used after add/edit/delete)
async function refreshGradebook() {
    if (!offeringInfo) return;

    // Reset state
    assessmentsList = [];
    studentsList = [];
    gradesMap = {};
    unsavedChanges = {};

    await loadGradebook(offeringInfo.offering_id);

    if (!offeringData) return;

    renderBanner();
    renderStatusBadge();
    renderSummary();
    renderGradebook();
    renderManageList();
}