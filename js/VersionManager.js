'use strict';

// ════════════════════════════════════════════════════════════
// 📦 VERSION MANAGER - Auto-sync version across files
// ════════════════════════════════════════════════════════════

class VersionManager {
    static getCurrentVersion() {
        // Extract version from service worker cache name
        if (typeof CACHE_NAME !== 'undefined') {
            const match = CACHE_NAME.match(/mtc-cache-v(.+)/);
            return match ? match[1] : 'unknown';
        }
        return 'unknown';
    }

    static updateMenuVersion() {
        const version = this.getCurrentVersion();
        const versionBadge = document.querySelector('.version-badge');
        if (versionBadge) {
            versionBadge.textContent = `v${version}`;
        }
        
        // Also update page title if needed
        const title = document.querySelector('title');
        if (title && !title.textContent.includes(version)) {
            title.textContent = `MTC the Game (Beta Edition v${version})`;
        }
    }

    static init() {
        // Update version when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.updateMenuVersion());
        } else {
            this.updateMenuVersion();
        }
    }
}

// Auto-initialize
VersionManager.init();

// Expose globally for manual updates if needed
window.VersionManager = VersionManager;
