'use strict';

// ════════════════════════════════════════════════════════════
// 📦 VERSION MANAGER
// รับ version จาก sw.js ผ่าน postMessage อัตโนมัติ
// ต่อไปแก้เวอร์ชันแค่ใน sw.js ที่เดียวพอครับ
//
// Also detects when a newer service worker has activated while this
// tab is open (see _handleVersion) and shows a non-blocking toast
// with a refresh CTA so players know a new build is ready.
// ════════════════════════════════════════════════════════════

class VersionManager {
    static _initialVersion = null;   // first version observed after load
    static _toastShown = false;      // single-fire guard

    static updateMenuVersion(version) {
        const badge = document.querySelector('.version-badge');
        if (badge) badge.textContent = `v${version}`;

        const title = document.querySelector('title');
        if (title) title.textContent = `MTC the Game (Beta Edition v${version})`;

        window.GAME_VERSION = version;
    }

    static _handleVersion(version) {
        if (!version) return;
        // Always refresh visible version info.
        VersionManager.updateMenuVersion(version);

        // Capture the first version we see; anything newer means a
        // background SW activate happened during this session.
        if (VersionManager._initialVersion === null) {
            VersionManager._initialVersion = version;
            return;
        }
        if (version !== VersionManager._initialVersion && !VersionManager._toastShown) {
            VersionManager._toastShown = true;
            VersionManager._showUpdateToast(version);
        }
    }

    static _ensureToast() {
        let toast = document.getElementById('mtc-update-toast');
        if (toast) return toast;

        toast = document.createElement('div');
        toast.id = 'mtc-update-toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.innerHTML = [
            '<span class="mtc-upd-icon" aria-hidden="true">🔄</span>',
            '<div class="mtc-upd-body">',
            '  <span class="mtc-upd-title">Update installed</span>',
            '  <span class="mtc-upd-sub"></span>',
            '</div>',
            '<div class="mtc-upd-actions">',
            '  <button type="button" class="mtc-upd-reload" aria-label="Reload page to apply update">Reload</button>',
            '  <button type="button" class="mtc-upd-dismiss" aria-label="Dismiss update notice">✕</button>',
            '</div>',
        ].join('');
        document.body.appendChild(toast);

        toast.querySelector('.mtc-upd-reload').addEventListener('click', () => {
            try { window.location.reload(); } catch (_) { /* noop */ }
        });
        toast.querySelector('.mtc-upd-dismiss').addEventListener('click', () => {
            toast.classList.remove('is-visible');
        });

        return toast;
    }

    static _showUpdateToast(version) {
        try {
            const toast = VersionManager._ensureToast();
            const sub = toast.querySelector('.mtc-upd-sub');
            if (sub) sub.textContent = `v${version} is ready — reload to apply`;
            // Force reflow so the initial transition plays cleanly.
            toast.offsetWidth; // eslint-disable-line no-unused-expressions
            toast.classList.add('is-visible');
        } catch (e) {
            // Don't let UI errors break version tracking.
            console.warn('[VersionManager] Failed to show update toast:', e);
        }
    }

    static init() {
        if (!('serviceWorker' in navigator)) return;

        // รับ version จาก Service Worker ผ่าน postMessage
        navigator.serviceWorker.addEventListener('message', e => {
            if (e.data?.type === 'VERSION') {
                VersionManager._handleVersion(e.data.version);
            }
        });

        // กรณี SW active อยู่แล้วตั้งแต่ต้น → ขอ version ทันที
        navigator.serviceWorker.ready.then(reg => {
            if (reg.active) {
                reg.active.postMessage({ type: 'GET_VERSION' });
            }
            // Also surface update detection via the standard updatefound
            // hook as a belt-and-braces fallback — some browsers delay the
            // activate→VERSION postMessage broadcast.
            if (reg.addEventListener) {
                reg.addEventListener('updatefound', () => {
                    const installing = reg.installing;
                    if (!installing) return;
                    installing.addEventListener('statechange', () => {
                        if (installing.state === 'activated' && !VersionManager._toastShown) {
                            // Ask the new worker for its version; the message
                            // listener above will handle showing the toast.
                            try { installing.postMessage({ type: 'GET_VERSION' }); } catch (_) { /* noop */ }
                        }
                    });
                });
            }
        }).catch(() => { /* registration not ready */ });
    }
}

VersionManager.init();
window.VersionManager = VersionManager;
