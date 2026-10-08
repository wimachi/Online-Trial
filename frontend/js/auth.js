// ============================================
// MUBAS ASSESSMENT SYSTEM
// AUTHENTICATION
// ============================================

const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

// Check if already logged in
if (isLoggedIn()) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'Student') {
        window.location.href = '/dashboard.html';
    } else {
        window.location.href = '/admin-dashboard.html';
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.message || 'Login failed');
            return;
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        if (data.user.role === 'Student') {
    window.location.href = '/dashboard.html';
} else if (data.user.role === 'Lecturer') {
    window.location.href = '/lecturer-dashboard.html';
} else {
    window.location.href = '/admin-dashboard.html';
}

    } catch (err) {
        console.error('Login error:', err);
        showError('Network error. Make sure the backend is running.');
    }
});

function showError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = 'block';
    setTimeout(() => {
        errorMsg.style.display = 'none';
    }, 5000);
}