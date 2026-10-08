// ============================================
// MUBAS ASSESSMENT SYSTEM
// UTILITY FUNCTIONS
// ============================================

// Since frontend is served from same server, use relative URL
const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function isLoggedIn() {
    return !!getToken();
}

function requireAuth() {
    if (!isLoggedIn()) {
        window.location.href = '/index.html';
        return false;
    }
    return true;
}

async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
        throw new Error('Session expired');
    }

    return response;
}

function getStudentNumber() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.studentNumber || '';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-MW', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
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