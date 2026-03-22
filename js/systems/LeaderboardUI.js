'use strict';
/**
 * js/systems/LeaderboardUI.js
 * Google sign-in row + Leaderboard modal. Depends on firebase-bundle, CloudSaveSystem.
 */
(function () {
    function userHasGoogle(user) {
        if (!user || !user.providerData) return false;
        return user.providerData.some((p) => p.providerId === 'google.com');
    }

    function updateGoogleAuthUI() {
        const btn = document.getElementById('btn-google-signin');
        const status = document.getElementById('google-auth-status');
        const auth = window.firebaseAuth;
        if (!btn || !status || !auth) return;
        const u = auth.currentUser;
        if (!u) return;
        if (userHasGoogle(u)) {
            btn.style.display = 'none';
            status.style.display = 'inline';
            status.textContent = 'ลงชื่อแล้ว: ' + (u.displayName || u.email || 'Google');
        } else {
            btn.style.display = 'inline-block';
            status.style.display = 'none';
            status.textContent = '';
        }
    }

    window.updateGoogleAuthUI = updateGoogleAuthUI;

    async function openModal() {
        const modal = document.getElementById('leaderboard-modal');
        const list = document.getElementById('leaderboard-list');
        if (!modal || !list) return;
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        list.innerHTML = '<li>กำลังโหลด...</li>';
        let rows = [];
        try {
            if (typeof CloudSaveSystem !== 'undefined' && typeof CloudSaveSystem.fetchLeaderboardTop === 'function') {
                rows = await CloudSaveSystem.fetchLeaderboardTop(15);
            }
        } catch (e) {
            list.innerHTML = '<li>โหลดไม่สำเร็จ</li>';
            return;
        }
        list.innerHTML = '';
        if (!rows.length) {
            const li = document.createElement('li');
            li.textContent = 'ยังไม่มีข้อมูล';
            list.appendChild(li);
            return;
        }
        rows.forEach((r, i) => {
            const li = document.createElement('li');
            const name = r.displayName || (r.uid && r.uid.slice(0, 8)) || '?';
            const wave = r.wave != null ? r.wave : '—';
            li.textContent = (i + 1) + '. ' + name + ' — ' + r.score + ' (wave ' + wave + ')';
            list.appendChild(li);
        });
    }

    function closeModal() {
        const modal = document.getElementById('leaderboard-modal');
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }

    window.MTCLeaderboardUI = {
        open: openModal,
        close: closeModal,
    };

    function wire() {
        const signBtn = document.getElementById('btn-google-signin');
        if (signBtn) {
            signBtn.addEventListener('click', () => {
                if (!window.MTCFirebase || typeof window.MTCFirebase.signInWithGoogle !== 'function') return;
                window.MTCFirebase.signInWithGoogle().catch((err) => {
                    console.warn('[Google sign-in]', err && err.message ? err.message : err);
                    alert('ลงชื่อ Google ไม่สำเร็จ: ' + (err && err.message ? err.message : err));
                });
            });
        }
        const bd = document.getElementById('leaderboard-backdrop');
        const closeBtn = document.getElementById('leaderboard-close');
        if (bd) bd.addEventListener('click', closeModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        window.addEventListener('mtc-auth-changed', updateGoogleAuthUI);
        updateGoogleAuthUI();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wire);
    } else {
        wire();
    }
})();
