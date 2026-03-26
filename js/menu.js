'use strict';
/**
 * js/menu.js
 * ════════════════════════════════════════════════════════════════
 * Main menu scripts — character select, portrait injection,
 * victory screen animations, skill tooltips, and Service Worker.
 * Extracted from inline <script> in index.html.
 *
 * Depends on (must load before menu.js):
 *  ui.js          — window.PORTRAITS (SVG strings per char)
 *  effects.js     — spawnParticles() (victory burst)
 *  game.js        — CANVAS, window.Achievements, ACHIEVEMENT_DEFS
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────
 *  L.8   selectCharacter(charType)
 *          updates .char-card.selected, start/tutorial button labels,
 *          HUD portrait SVG swap, skill slot hint text
 *  ⚠️  Reads window.PORTRAITS — safe only after ui.js executes.
 *      Called by onclick on char cards; also callable from game.js on restart.
 *
 *  L.57  window 'load' → _injectPortraits()
 *          populates #char-avatar-[id] SVG elements (96×112)
 *          sets default HUD portrait to _selectedChar (default: 'kao')
 *
 *  L.79  Victory Screen IIFE
 *          MutationObserver on #victory-screen style → triggers _launchVictory()
 *          L.96   _startStarfield()     canvas particle rain on #victory-stars
 *          L.128  _countUp(id, delay)   ease-out number count-up animation
 *          L.144  _buildAchievements()  chip list from window.Achievements.unlocked
 *          L.159  _particleBurst()      gold spawnParticles on victory entry (600ms delay)
 *
 *  L.168 Skill Preview Tooltips IIFE (_initSkillTooltips)
 *          desktop: mouseenter/mouseleave with 120ms hide debounce
 *          mobile:  touchstart 350ms hold → toggle tooltip
 *          positions tooltip above card (flips below if near top edge)
 *
 *  L.251 Service Worker registration (sw.js)
 *  ⚠️  sw.js cache version must be bumped on every deploy — see sw.js header.
 *
 * ════════════════════════════════════════════════════════════════
 */

// ── Character Selection ───────────────────────────────────────────────────────
let _selectedChar = 'kao';
function selectCharacter(charType) {
    _selectedChar = charType;
    document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('card-' + charType)
        || document.getElementById('btn-' + charType)
        || document.getElementById(charType);
    if (card) card.classList.add('selected');

    // ── Mark container so unselected cards can recede ──────────────────────
    const cardsContainer = card?.closest('.char-cards');
    if (cardsContainer) cardsContainer.classList.add('has-selection');

    // ── Buttons label ──────────────────────────────
    const startBtn = document.getElementById('start-btn');
    const tutBtn = document.getElementById('tutorial-btn');
    const iconPrefix = charType === 'poom' ? '🌾'
        : charType === 'auto' ? '🔥'
            : charType === 'pat' ? '⚔️'
                : '🎓';
    if (startBtn) startBtn.textContent = iconPrefix + ' START MISSION';
    if (tutBtn) tutBtn.textContent = iconPrefix + ' REPLAY TUTORIAL';

    // ── HUD portrait SVG swap ────────────────────────────────────────────────
    // window.PORTRAITS defined in ui.js at module scope (loaded before user
    // can click a card).  Guard covers edge-case of early call.
    const hudSvg = document.getElementById('hud-portrait-svg');
    if (hudSvg && window.PORTRAITS?.[charType]) {
        hudSvg.innerHTML = window.PORTRAITS[charType];
    }

    // ── Skill slot hint preview ──────────────────────────────────────────────
    const hintEl = document.getElementById('skill1-hint');
    if (hintEl) {
        hintEl.textContent = charType === 'auto' ? 'STAND'
            : charType === 'poom' ? 'EAT'
                : charType === 'pat' ? 'GUARD'
                    : 'R-Click';
    }
    const emojiEl = document.getElementById('skill1-emoji');
    if (emojiEl) {
        emojiEl.textContent = charType === 'auto' ? '🔥'
            : charType === 'poom' ? '🍚'
                : charType === 'pat' ? '⚔️'
                    : '📖';
    }
}


// ── Character Carousel Navigation ─────────────────────────────────────────────
// Characters in display order (must match IDs used by selectCharacter)
const _CHAR_ORDER = ['kao', 'poom', 'auto', 'pat'];
let _currentCharIndex = 0;

/**
 * Navigate the carousel by `dir` steps (+1 = next, -1 = prev).
 * Wraps around. Exposed on window so HTML onclick can reach it.
 */
function _navigateChar(dir) {
    _currentCharIndex = (_currentCharIndex + dir + _CHAR_ORDER.length) % _CHAR_ORDER.length;
    selectCharacter(_CHAR_ORDER[_currentCharIndex]);
    _updateCarousel();
}
window._navigateChar = _navigateChar;

function _updateCarousel() {
    const charId = _CHAR_ORDER[_currentCharIndex];

    // ── Show only active card ────────────────────────────────────────────────
    _CHAR_ORDER.forEach((id, i) => {
        const el = document.getElementById('card-' + id)
            || document.getElementById('btn-' + id);
        if (!el) return;
        if (i === _currentCharIndex) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });

    // ── Update dot indicators ────────────────────────────────────────────────
    document.querySelectorAll('.char-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === _currentCharIndex);
    });

    // ── Apply theme to #overlay ──────────────────────────────────────────────
    const overlay = document.getElementById('overlay');
    if (overlay) {
        // Strip existing theme-* classes, add new one
        const classes = overlay.className.split(' ').filter(c => !c.startsWith('theme-'));
        classes.push('theme-' + charId);
        overlay.className = classes.join(' ').trim();
    }
}

// Initialise carousel on DOMContentLoaded
(function _initCarousel() {
    function _setup() {
        // Dots click→navigate
        document.querySelectorAll('.char-dot').forEach((dot) => {
            const idx = parseInt(dot.dataset.index, 10);
            dot.addEventListener('click', () => {
                _currentCharIndex = idx;
                selectCharacter(_CHAR_ORDER[_currentCharIndex]);
                _updateCarousel();
            });
        });

        // Keyboard left/right arrow navigation
        document.addEventListener('keydown', (e) => {
            // Only when overlay is visible
            const overlay = document.getElementById('overlay');
            if (!overlay || overlay.style.display === 'none') return;
            if (e.key === 'ArrowLeft')  _navigateChar(-1);
            if (e.key === 'ArrowRight') _navigateChar(+1);
        });

        // Set initial theme & state
        _updateCarousel();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _setup);
    } else {
        _setup();
    }
})();


// This guarantees window.PORTRAITS (defined in ui.js) is ready before we try
// to populate the char-select cards and the default HUD portrait.
window.addEventListener('load', function _injectPortraits() {
    if (!window.PORTRAITS) {
        // ui.js wasn't loaded yet — shouldn't happen, but don't crash
        console.warn('[menu] window.PORTRAITS not found — portrait injection skipped');
        return;
    }

    // ── Char-select card portraits (96 × 112 each) ──────────────────────────
    ['kao', 'poom', 'auto', 'pat'].forEach(id => {
        const el = document.getElementById('char-avatar-' + id);
        if (!el) return;
        el.innerHTML =
            '<svg viewBox="0 0 96 112" xmlns="http://www.w3.org/2000/svg"' +
            ' width="96" height="112" style="display:block;width:100%;height:100%;">' +
            (window.PORTRAITS[id] || '') +
            '</svg>';
    });

    // ── Default HUD portrait (Kao on fresh load) ─────────────────────────────
    const hudSvg = document.getElementById('hud-portrait-svg');
    if (hudSvg && window.PORTRAITS[_selectedChar]) {
        hudSvg.innerHTML = window.PORTRAITS[_selectedChar];
    }
});


// ── Victory Screen — Starfield + Count-up + Achievement chips ────────────────
(function () {
    const vs = document.getElementById('victory-screen');
    if (!vs) return;

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

    // ── Starfield ────────────────────────────────────────────────────────────
    function _startStarfield() {
        const c = document.getElementById('victory-stars');
        if (!c) return;
        const ctx = c.getContext('2d');
        let W, H, stars;

        function resize() {
            W = c.width = vs.offsetWidth;
            H = c.height = vs.offsetHeight;
            stars = Array.from({ length: 180 }, () => ({
                x: Math.random() * W, y: Math.random() * H,
                r: Math.random() * 1.4 + 0.3,
                a: Math.random(),
                speed: Math.random() * 0.4 + 0.1,
                drift: (Math.random() - 0.5) * 0.15
            }));
        }
        resize();
        window.addEventListener('resize', resize);

        function tick() {
            ctx.clearRect(0, 0, W, H);
            stars.forEach(s => {
                s.y += s.speed; s.x += s.drift;
                s.a += (Math.random() - 0.5) * 0.04;
                s.a = Math.max(0.1, Math.min(1, s.a));
                if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
                if (s.x < 0 || s.x > W) s.x = Math.random() * W;
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

    // ── Count-up animation ───────────────────────────────────────────────────
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

    // ── Achievement chips ────────────────────────────────────────────────────
    function _buildAchievements() {
        const container = document.getElementById('victory-achs');
        if (!container) return;
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

    // ── Gold particle burst on entry ─────────────────────────────────────────
    function _particleBurst() {
        if (typeof spawnParticles !== 'function') return;
        setTimeout(() => {
            const cx = (typeof CANVAS !== 'undefined' && CANVAS) ? CANVAS.width / 2 : window.innerWidth / 2;
            const cy = (typeof CANVAS !== 'undefined' && CANVAS) ? CANVAS.height / 2 : window.innerHeight / 2;
            spawnParticles(cx, cy, 80, '#facc15');
            spawnParticles(cx, cy, 40, '#f97316');
        }, 600);
    }
})();


// ── Skill Preview Tooltips (1.4) ─────────────────────────────────────────────
(function _initSkillTooltips() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _init);
    } else {
        _init();
    }

    function _init() {
        const cards = document.querySelectorAll('.char-card[data-char]');
        if (!cards.length) return;

        let _activeTooltip = null;
        let _hideTimer = null;

        cards.forEach(card => {
            const charId = card.dataset.char;
            const tooltip = document.getElementById('tooltip-' + charId);
            if (!tooltip) return;

            // ── Desktop ──────────────────────────────────────────────────────
            card.addEventListener('mouseenter', () => {
                clearTimeout(_hideTimer);
                _showTooltip(tooltip, card);
            });
            card.addEventListener('mouseleave', () => {
                _hideTimer = setTimeout(() => _hideTooltip(tooltip), 120);
            });

            // ── Mobile: tap-and-hold 350ms ───────────────────────────────────
            let _holdTimer = null;
            card.addEventListener('touchstart', () => {
                _holdTimer = setTimeout(() => {
                    if (_activeTooltip && _activeTooltip !== tooltip) {
                        _hideTooltip(_activeTooltip);
                    }
                    tooltip.classList.contains('tt-visible')
                        ? _hideTooltip(tooltip)
                        : _showTooltip(tooltip, card);
                }, 350);
            }, { passive: true });
            card.addEventListener('touchend', () => clearTimeout(_holdTimer), { passive: true });
            card.addEventListener('touchcancel', () => clearTimeout(_holdTimer), { passive: true });
        });

        // Tap outside → close
        document.addEventListener('touchstart', (e) => {
            if (_activeTooltip && !e.target.closest('.skill-tooltip') && !e.target.closest('.char-card')) {
                _hideTooltip(_activeTooltip);
            }
        }, { passive: true });

        function _showTooltip(tooltip, card) {
            _activeTooltip = tooltip;

            // Force layout so offsetHeight is accurate before tt-visible adds opacity
            tooltip.style.visibility = 'hidden';
            tooltip.classList.add('tt-visible');
            const h = tooltip.offsetHeight || 224;
            const w = tooltip.offsetWidth || 240;
            tooltip.classList.remove('tt-visible');
            tooltip.style.visibility = '';

            const cardRect = card.getBoundingClientRect();
            const VW = window.innerWidth;
            const VH = window.innerHeight;

            // Prefer above the card; fall back to below if no room
            const topAbove = cardRect.top - h - 10;
            const top = topAbove >= 8 ? topAbove : cardRect.bottom + 8;

            // Centre on card, clamped to viewport
            const left = Math.max(8, Math.min(
                cardRect.left + cardRect.width / 2 - w / 2,
                VW - w - 8
            ));

            tooltip.style.left = left + 'px';
            tooltip.style.top = Math.min(top, VH - h - 8) + 'px';
            tooltip.classList.add('tt-visible');
        }

        function _hideTooltip(tooltip) {
            if (!tooltip) return;
            tooltip.classList.remove('tt-visible');
            if (_activeTooltip === tooltip) _activeTooltip = null;
        }
    }
})();


// ── Remote Config (optional DOM: #mtc-announcement, #mtc-shop-banner) ────────
(function _remoteConfigUiHook() {
    window.addEventListener('load', () => {
        if (typeof firebaseRemoteConfigReady === 'undefined' || typeof getRemoteConfigString !== 'function') return;
        firebaseRemoteConfigReady.then(() => {
            const ann = getRemoteConfigString('announcement', '');
            const annEl = document.getElementById('mtc-announcement');
            if (annEl && ann) annEl.textContent = ann;
            const shop = getRemoteConfigString('shop_banner', '');
            const shopEl = document.getElementById('mtc-shop-banner');
            if (shopEl && shop) shopEl.textContent = shop;
        });
    });
})();


// ── Service Worker Registration ───────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(r => console.log('✅ ServiceWorker registered:', r.scope))
            .catch(e => console.error('❌ ServiceWorker failed:', e));
    });
}
