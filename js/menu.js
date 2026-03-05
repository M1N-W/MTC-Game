'use strict';
// ════════════════════════════════════════════════════════════════
// menu.js — Menu scripts extracted from index.html
// Sections: selectCharacter | Victory Screen | Service Worker
// ════════════════════════════════════════════════════════════════

// ── Character Selection ───────────────────────────────────────────────────────
let _selectedChar = 'kao';
function selectCharacter(charType) {
    _selectedChar = charType;
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('card-' + charType) || document.getElementById('btn-' + charType) || document.getElementById(charType);
    if (card) card.classList.add('selected');

    // ── Buttons label ──────────────────────────────
    const startBtn = document.getElementById('start-btn');
    const tutBtn = document.getElementById('tutorial-btn');
    const iconPrefix = charType === 'poom' ? '🌾' : (charType === 'auto' ? '🔥' : '🎓');
    if (startBtn) startBtn.textContent = iconPrefix + ' START MISSION';
    if (tutBtn) tutBtn.textContent = iconPrefix + ' REPLAY TUTORIAL';

    // ── HUD avatar preview ──────────────────────────────
    // Updates the tiny avatar icon at top-left to preview
    // the selected character before the game starts.
    const avatarEl = document.getElementById('player-avatar');
    if (avatarEl) {
        avatarEl.textContent = charType === 'poom' ? '🌾'
            : charType === 'auto' ? '🔥'
                : '👨🏻‍🎓';
    }

    // ── Skill slot hint preview ─────────────────────────
    // Swaps the R-Click label so the user knows what the
    // secondary skill does before they start.
    const hintEl = document.getElementById('skill1-hint');
    if (hintEl) {
        hintEl.textContent = charType === 'auto' ? 'STAND'
            : charType === 'poom' ? 'EAT'
                : 'R-Click';
    }
    const emojiEl = document.getElementById('skill1-emoji');
    if (emojiEl) {
        emojiEl.textContent = charType === 'auto' ? '🔥'
            : charType === 'poom' ? '🍚'
                : '📖';
    }
}


// ── Victory Screen — Starfield + Count-up + Achievement chips ────────────────
// ── Victory Screen — Starfield + Count-up + Achievement chips ──
(function () {
    const vs = document.getElementById('victory-screen');
    if (!vs) return;

    // Observe display change to trigger animations
    const obs = new MutationObserver(() => {
        if (vs.style.display !== 'none' && vs.style.display !== '') {
            _launchVictory();
            obs.disconnect();
        }
    });
    obs.observe(vs, { attributes: true, attributeFilter: ['style'] });

    function _launchVictory() {
        _startStarfield();
        _countUp('final-score', 1800);
        _countUp('final-wave', 2000);
        _countUp('final-kills', 2200);
        _buildAchievements();
        _particleBurst();
    }

    // ── Starfield ──────────────────────────────────────────
    function _startStarfield() {
        const c = document.getElementById('victory-stars');
        if (!c) return;
        const ctx = c.getContext('2d');
        let W, H, stars;

        function resize() {
            W = c.width = vs.offsetWidth;
            H = c.height = vs.offsetHeight;
            stars = Array.from({ length: 180 }, () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                r: Math.random() * 1.4 + 0.3,
                a: Math.random(),
                speed: Math.random() * 0.4 + 0.1,
                drift: (Math.random() - 0.5) * 0.15
            }));
        }
        resize();
        window.addEventListener('resize', resize);

        let gold = 0;
        function tick() {
            ctx.clearRect(0, 0, W, H);
            gold = (gold + 0.005) % 1;
            stars.forEach(s => {
                s.y += s.speed;
                s.x += s.drift;
                s.a += (Math.random() - 0.5) * 0.04;
                s.a = Math.max(0.1, Math.min(1, s.a));
                if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
                if (s.x < 0 || s.x > W) s.x = Math.random() * W;
                // Alternate white / gold stars
                const isGold = s.r > 1.2;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = isGold
                    ? `rgba(250,204,21,${s.a * 0.7})`
                    : `rgba(255,255,255,${s.a * 0.55})`;
                ctx.fill();
            });
            if (vs.style.display !== 'none') requestAnimationFrame(tick);
        }
        tick();
    }

    // ── Count-up animation ─────────────────────────────────
    function _countUp(id, delay) {
        const el = document.getElementById(id);
        if (!el) return;
        const target = parseInt(el.textContent.replace(/\D/g, '')) || 0;
        if (target === 0) return;
        let start = null;
        const dur = 1400;
        setTimeout(() => {
            function frame(ts) {
                if (!start) start = ts;
                const p = Math.min((ts - start) / dur, 1);
                const ease = 1 - Math.pow(1 - p, 3);
                el.textContent = Math.round(target * ease).toLocaleString();
                if (p < 1) requestAnimationFrame(frame);
                else el.textContent = target.toLocaleString();
            }
            requestAnimationFrame(frame);
        }, delay);
    }

    // ── Achievement chips ──────────────────────────────────
    function _buildAchievements() {
        const container = document.getElementById('victory-achs');
        if (!container) return;
        // Read from global Achievements if available
        const ach = window.Achievements;
        if (!ach || !ach.unlocked || ach.unlocked.size === 0) return;
        const defs = window.ACHIEVEMENT_DEFS || [];
        ach.unlocked.forEach(id => {
            const def = defs.find(a => a.id === id);
            if (!def) return;
            const chip = document.createElement('span');
            chip.className = 'victory-ach-chip';
            chip.textContent = (def.icon || '★') + ' ' + (def.name || id);
            container.appendChild(chip);
        });
    }

    // ── Gold particle burst on entry ───────────────────────
    function _particleBurst() {
        // Uses the game's own spawnParticles if available
        if (typeof spawnParticles !== 'function') return;
        // Use canvas center (screen space) — player.x/y are world coords
        // and may be far from origin, putting particles off-screen
        setTimeout(() => {
            const cx = (typeof CANVAS !== 'undefined' && CANVAS) ? CANVAS.width / 2 : window.innerWidth / 2;
            const cy = (typeof CANVAS !== 'undefined' && CANVAS) ? CANVAS.height / 2 : window.innerHeight / 2;
            spawnParticles(cx, cy, 80, '#facc15');
            spawnParticles(cx, cy, 40, '#f97316');
        }, 600);
    }
})();


// ── Service Worker Registration ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('✅ ServiceWorker registered with scope:', registration.scope);
            })
            .catch(error => {
                console.error('❌ ServiceWorker registration failed:', error);
            });
    });
}