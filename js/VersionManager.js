'use strict';

// ════════════════════════════════════════════════════════════
// 📦 VERSION MANAGER
// รับ version จาก sw.js ผ่าน postMessage อัตโนมัติ
// ต่อไปแก้เวอร์ชันแค่ใน sw.js ที่เดียวพอครับ
// ════════════════════════════════════════════════════════════

class VersionManager {
    static updateMenuVersion(version) {
        const badge = document.querySelector('.version-badge');
        if (badge) badge.textContent = `v${version}`;

        const title = document.querySelector('title');
        if (title) title.textContent = `MTC the Game (Beta Edition v${version})`;

        window.GAME_VERSION = version;
    }

    static init() {
        if (!('serviceWorker' in navigator)) return;

        // รับ version จาก Service Worker ผ่าน postMessage
        navigator.serviceWorker.addEventListener('message', e => {
            if (e.data?.type === 'VERSION') {
                VersionManager.updateMenuVersion(e.data.version);
            }
        });

        // กรณี SW active อยู่แล้วตั้งแต่ต้น → ขอ version ทันที
        navigator.serviceWorker.ready.then(reg => {
            if (reg.active) {
                reg.active.postMessage({ type: 'GET_VERSION' });
            }
        });
    }
}

VersionManager.init();
window.VersionManager = VersionManager;