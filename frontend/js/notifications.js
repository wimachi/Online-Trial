// ============================================
// MUBAS - NOTIFICATION BELL
// ============================================

(function () {
    'use strict';

    // Add CSS once
    if (!document.getElementById('notifStyles')) {
        const style = document.createElement('style');
        style.id = 'notifStyles';
        style.textContent = `
            .notif-bell-wrap { position: relative; display: inline-flex; align-items: center; margin-right: 12px; }
            .notif-bell {
                background: rgba(255,255,255,0.15);
                border: 1px solid rgba(255,255,255,0.3);
                color: white;
                font-size: 18px;
                padding: 6px 12px;
                border-radius: 8px;
                cursor: pointer;
                position: relative;
                transition: background 0.2s;
            }
            .notif-bell:hover { background: rgba(255,255,255,0.3); }
            .notif-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                background: #dc3545;
                color: white;
                font-size: 10px;
                font-weight: 700;
                min-width: 18px;
                height: 18px;
                border-radius: 9px;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 4px;
                border: 2px solid #003366;
            }
            .notif-panel {
                position: absolute;
                top: 48px;
                right: 0;
                width: 380px;
                max-height: 500px;
                background: white;
                color: #333;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.25);
                overflow: hidden;
                display: none;
                z-index: 9999;
            }
            .notif-panel.open { display: block; }
            .notif-head {
                padding: 15px 20px;
                background: #f0f4f8;
                border-bottom: 1px solid #e0e7f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .notif-head h4 { margin: 0; color: #003366; font-size: 15px; }
            .notif-mark-all {
                font-size: 12px;
                color: #0066cc;
                cursor: pointer;
                background: none;
                border: none;
                font-weight: 600;
            }
            .notif-mark-all:hover { text-decoration: underline; }
            .notif-list {
                max-height: 400px;
                overflow-y: auto;
            }
            .notif-item {
                padding: 14px 20px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                transition: background 0.2s;
            }
            .notif-item:hover { background: #f8f9fa; }
            .notif-item.unread { background: #eaf4ff; }
            .notif-item.unread:hover { background: #d6e9ff; }
            .notif-item-title {
                font-weight: 600;
                color: #003366;
                font-size: 13px;
                margin-bottom: 4px;
            }
            .notif-item-msg {
                font-size: 12px;
                color: #666;
                margin-bottom: 4px;
                line-height: 1.4;
            }
            .notif-item-time {
                font-size: 11px;
                color: #999;
            }
            .notif-empty {
                padding: 40px 20px;
                text-align: center;
                color: #888;
                font-size: 13px;
            }
            .notif-empty-icon { font-size: 32px; margin-bottom: 8px; }
        `;
        document.head.appendChild(style);
    }

    function timeAgo(dateStr) {
        const now = Date.now();
        const d = new Date(dateStr).getTime();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }

    function buildBell() {
        const userInfo = document.querySelector('.user-info');
        if (!userInfo) return null;

        // Don't add twice
        if (userInfo.querySelector('.notif-bell-wrap')) return userInfo.querySelector('.notif-bell-wrap');

        const wrap = document.createElement('div');
        wrap.className = 'notif-bell-wrap';
        wrap.innerHTML = `
            <button class="notif-bell" type="button" title="Notifications">
                🔔
                <span class="notif-badge" style="display:none;">0</span>
            </button>
            <div class="notif-panel">
                <div class="notif-head">
                    <h4>Notifications</h4>
                    <button class="notif-mark-all" type="button">Mark all as read</button>
                </div>
                <div class="notif-list">
                    <div class="notif-empty">Loading...</div>
                </div>
            </div>
        `;

        // Insert as first child of user-info
        userInfo.insertBefore(wrap, userInfo.firstChild);
        return wrap;
    }

    async function fetchNotifications() {
        try {
            const r = await fetch('/api/notifications', {
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
            });
            if (!r.ok) return null;
            return await r.json();
        } catch (e) {
            console.error('Notifications fetch error:', e);
            return null;
        }
    }

    async function markOneRead(id) {
        try {
            await fetch('/api/notifications/read', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
                },
                body: JSON.stringify({ notificationId: id })
            });
        } catch (e) { console.error(e); }
    }

    async function markAllRead() {
        try {
            await fetch('/api/notifications/read-all', {
                method: 'PUT',
                headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('token') || '') }
            });
        } catch (e) { console.error(e); }
    }

    function renderList(list) {
        if (!list || list.length === 0) {
            return `
                <div class="notif-empty">
                    <div class="notif-empty-icon">📭</div>
                    No notifications yet
                </div>
            `;
        }
        return list.map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.notification_id}" data-link="${n.link || ''}">
                <div class="notif-item-title">${n.title}</div>
                ${n.message ? `<div class="notif-item-msg">${n.message}</div>` : ''}
                <div class="notif-item-time">${timeAgo(n.created_at)}</div>
            </div>
        `).join('');
    }

    async function refresh() {
        const wrap = document.querySelector('.notif-bell-wrap');
        if (!wrap) return;

        const data = await fetchNotifications();
        if (!data) return;

        const badge = wrap.querySelector('.notif-badge');
        if (data.unread_count > 0) {
            badge.textContent = data.unread_count > 99 ? '99+' : data.unread_count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }

        const list = wrap.querySelector('.notif-list');
        list.innerHTML = renderList(data.notifications);

        // Wire item clicks
        list.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const id = parseInt(item.dataset.id);
                const link = item.dataset.link;
                const wasUnread = item.classList.contains('unread');
                if (wasUnread) {
                    await markOneRead(id);
                    item.classList.remove('unread');
                    // Update badge
                    const badge2 = wrap.querySelector('.notif-badge');
                    const cur = parseInt(badge2.textContent) || 1;
                    if (cur <= 1) badge2.style.display = 'none';
                    else badge2.textContent = cur - 1;
                }
                if (link) window.location.href = link;
            });
        });
    }

    function init() {
        const wrap = buildBell();
        if (!wrap) return;

        const bell = wrap.querySelector('.notif-bell');
        const panel = wrap.querySelector('.notif-panel');
        const markAll = wrap.querySelector('.notif-mark-all');

        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) refresh();
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) panel.classList.remove('open');
        });

        markAll.addEventListener('click', async (e) => {
            e.stopPropagation();
            await markAllRead();
            refresh();
        });

        // Initial load (no dropdown open)
        refresh();

        // Poll every 60 seconds
        setInterval(refresh, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();