// ============================================
// MUBAS ASSESSMENT SYSTEM - MY PROFILE
// ============================================

let profileData = null;

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!requireAuth()) return;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('userName').textContent = user.username || 'Student';

    await loadProfile();

    if (!profileData) return;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    renderProfile();
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
async function loadProfile() {
    try {
        const r = await apiRequest('/students/my-profile');
        if (!r.ok) {
            document.getElementById('loading').textContent = 'Failed to load profile';
            return;
        }
        profileData = await r.json();
    } catch (e) {
        console.error('Profile load error:', e);
        document.getElementById('loading').textContent = 'Error: ' + e.message;
    }
}

// ============================================
// RENDER
// ============================================
function renderProfile() {
    const p = profileData;

    // Personal
    document.getElementById('pStudentNumber').textContent = p.student_number || '—';
    document.getElementById('pFullName').textContent = `${p.first_name} ${p.last_name}`;
    document.getElementById('pEmail').textContent = p.email || '—';
    document.getElementById('pPhone').textContent = p.phone || 'Not set';
    document.getElementById('pGender').textContent = p.gender || '—';
    document.getElementById('pDob').textContent = p.date_of_birth
        ? new Date(p.date_of_birth).toLocaleDateString()
        : '—';

    // Academic
    document.getElementById('pProgram').textContent = p.program_name || '—';
    document.getElementById('pDept').textContent = p.department_name || '—';
    document.getElementById('pSchool').textContent = p.school_name || '—';
    document.getElementById('pYearSem').textContent = 
        `Year ${p.current_year_of_study} · Semester ${p.current_semester}`;

    const standingEl = document.getElementById('pStanding');
    standingEl.textContent = p.academic_standing || '—';
    standingEl.style.color = getStandingColor(p.academic_standing);

    const statusEl = document.getElementById('pStatus');
    statusEl.textContent = p.status || '—';
    statusEl.style.color = p.status === 'Active' ? '#28a745'
                          : p.status === 'Graduated' ? '#003366'
                          : '#dc3545';
}

function getStandingColor(standing) {
    if (!standing) return '#333';
    if (standing === 'Good Standing') return '#28a745';
    if (standing === 'Academic Probation') return '#ffc107';
    if (standing === 'Suspended') return '#fd7e14';
    if (standing === 'Dismissed') return '#dc3545';
    return '#333';
}

// ============================================
// EDIT PROFILE MODAL
// ============================================
function openEditModal() {
    if (!profileData) return;

    document.getElementById('editEmail').value = profileData.email || '';
    document.getElementById('editPhone').value = profileData.phone || '';
    document.getElementById('editError').style.display = 'none';
    document.getElementById('editSuccess').style.display = 'none';
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

async function submitEdit() {
    const errEl = document.getElementById('editError');
    const succEl = document.getElementById('editSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();

    if (!email) {
        errEl.textContent = 'Email is required';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('editSubmitBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/students/update-profile', {
            method: 'PUT',
            body: JSON.stringify({ email, phone: phone || null })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Update failed';
            errEl.style.display = 'block';
            btn.textContent = '💾 Save Changes';
            btn.disabled = false;
            return;
        }

        // Update local profileData
        profileData.email = email;
        profileData.phone = phone;

        // Re-render main page
        renderProfile();

        succEl.textContent = '✅ Profile updated!';
        succEl.style.display = 'block';

        setTimeout(() => closeEditModal(), 1500);

    } catch (e) {
        console.error('Update error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '💾 Save Changes';
        btn.disabled = false;
    }
}

// ============================================
// CHANGE PASSWORD MODAL
// ============================================
function openPasswordModal() {
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    document.getElementById('pwConfirm').value = '';
    document.getElementById('pwError').style.display = 'none';
    document.getElementById('pwSuccess').style.display = 'none';
    document.getElementById('passwordModal').style.display = 'block';
}

function closePasswordModal() {
    document.getElementById('passwordModal').style.display = 'none';
}

async function submitPassword() {
    const errEl = document.getElementById('pwError');
    const succEl = document.getElementById('pwSuccess');
    errEl.style.display = 'none';
    succEl.style.display = 'none';

    const currentPassword = document.getElementById('pwCurrent').value;
    const newPassword = document.getElementById('pwNew').value;
    const confirmPassword = document.getElementById('pwConfirm').value;

    // Client-side validation
    if (!currentPassword || !newPassword || !confirmPassword) {
        errEl.textContent = 'All fields are required';
        errEl.style.display = 'block';
        return;
    }
    if (newPassword.length < 6) {
        errEl.textContent = 'New password must be at least 6 characters';
        errEl.style.display = 'block';
        return;
    }
    if (newPassword !== confirmPassword) {
        errEl.textContent = 'New passwords do not match';
        errEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('pwSubmitBtn');
    btn.textContent = '⏳ Changing...';
    btn.disabled = true;

    try {
        const r = await apiRequest('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
        });
        const data = await r.json();

        if (!r.ok) {
            errEl.textContent = data.message || 'Failed to change password';
            errEl.style.display = 'block';
            btn.textContent = '🔑 Change Password';
            btn.disabled = false;
            return;
        }

        succEl.textContent = '✅ Password changed successfully!';
        succEl.style.display = 'block';

        // Clear fields
        document.getElementById('pwCurrent').value = '';
        document.getElementById('pwNew').value = '';
        document.getElementById('pwConfirm').value = '';

        setTimeout(() => closePasswordModal(), 2000);

    } catch (e) {
        console.error('Password change error:', e);
        errEl.textContent = 'Network error: ' + e.message;
        errEl.style.display = 'block';
        btn.textContent = '🔑 Change Password';
        btn.disabled = false;
    }
}