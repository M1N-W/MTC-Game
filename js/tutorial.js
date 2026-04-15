'use strict';
/**
 * js/tutorial.js
 * ════════════════════════════════════════════════════════════════
 * TutorialSystem — IIFE singleton, 17-step guided walkthrough.
 * Freezes enemy spawns during tutorial (caches + restores window.enemies).
 * Step text pulled from GAME_TEXTS.tutorial (config.js) — no hardcoded strings.
 *
 * Highlight types per step:
 *  { type:'ui',     target:'#element-id' }          → spotlight HTML element
 *  { type:'world',  key:'shop'|'server'|... }        → pulse circle on canvas (world-space)
 *  { type:'region', region:'bottom-hud'|'top-left' } → dim everything except region
 *
 * Persistence: completion stored in localStorage (SAVE_KEY).
 * isDone() → true if already completed; reset() clears the flag.
 *
 * Load order: config.js → game.js → [THIS FILE]
 * (tutorial.js reads GAME_TEXTS + CANVAS + window.player + weaponSystem)
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────
 *  L.17  State vars         _active, _stepIndex, _charType, _actionCount, _stepDone
 *  L.29  T(key)             lazy GAME_TEXTS.tutorial accessor (config-driven text)
 *
 *  L.34  STEPS array        17 step definitions (steps 5–10 are char-specific)
 *          steps 0–4   shared (movement / shoot / dash / R-click)
 *          steps 5–7   Kao only (passive / weapon switch / Q+E)
 *          steps 8–9   Poom only (R+Q skills)
 *          step  10    Auto only (vacuum + detonate + stand rush)
 *          steps 10–16 shared (bullet time / level up / shop / database / enemies / boss / ready)
 *
 *  L.191 DOM helpers        _activeIndices() — visible step indices
 *
 *  L.205 draw(ctx)          canvas layer: spotlight dim + pulse circle + region mask
 *          L.217 world highlight  — pulse arc at worldToScreen(target)
 *          L.267 region highlight — darken canvas except rect
 *  L.299 _worldPos(key)     key → {x,y} world coords (shop / server / player)
 *  L.306 _regionRect(region, canvas)  region name → {x,y,w,h} screen rect
 *
 *  L.313 _updateArrow()     positions #tut-arrow DOM element every frame
 *  L.390 _applyUIHighlight() adds .tut-highlight CSS class to target element
 *  L.403 _render()          updates step panel HTML + progress dots + next button
 *  L.470 _updateActionBar() increments action progress, triggers _advance() on completion
 *  L.488 _advance()         moves to next applicable step (skips char-mismatched steps)
 *  L.505 _finish()          restores window.enemies, clears DOM, saves to localStorage
 *
 *  ── Public API (returned object) ───────────────────────────────
 *  L.542 isDone()           → bool (localStorage check)
 *  L.543 reset()            clears localStorage flag
 *  L.545 start(charType)    freezes enemies, renders step 0
 *  L.569 isActive()         → bool
 *  L.571 isActionStep()     → bool (step requires player action, not just 'next')
 *  L.578 update()           call every frame — weapon polling + arrow tracking
 *  L.601 draw(ctx)          call from drawGame() after CTX.restore(), before HUD
 *  L.603 handleAction(type) type: 'move'|'shoot'|'dash'|'skill'|'weapon'|'next'|'skip'
 *  L.625 next() / skip()    convenience wrappers
 *  ⚠️  window.enemies is stashed into window._tutorialEnemyCache during tutorial.
 *      If game resets mid-tutorial, _tutorialEnemyCache must be cleared manually
 *      or enemies will be double-restored. _finish() handles normal flow.
 *
 *  L.629 window.TutorialSystem export
 *
 * ════════════════════════════════════════════════════════════════
 */

const TutorialSystem = (() => {

    // ── State ─────────────────────────────────────────────────
    let _active = false;
    let _stepIndex = 0;
    let _stepDone = false;
    let _actionCount = 0;
    let _charType = 'kao';
    let _lastWeapon = null;
    let _pulseT = 0;   // time accumulator for pulse animation (seconds)

    // Arrow throttle — update at ~20Hz instead of 60Hz to reduce DOM read cost
    let _arrowLastUpdate = 0;
    const ARROW_UPDATE_INTERVAL = 50; // ms

    // Highlight cache — avoid clearing/re-adding class when target hasn't changed
    let _lastHighlightTarget = null;

    const SAVE_KEY = 'mtc_tutorial_done';

    // ── Lazy-read GAME_TEXTS (config.js loads before tutorial.js) ──
    function T(key) {
        return (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.tutorial && GAME_TEXTS.tutorial[key])
            || {};
    }

    // ══════════════════════════════════════════════════════════
    // STEP DEFINITIONS
    // ──────────────────────────────────────────────────────────
    // Fields:
    //   title, body, icon  — pulled from GAME_TEXTS.tutorial via T(key)
    //   action   — 'none'|'move'|'shoot'|'dash'|'skill'|'weapon'|'bullettime'
    //   count    — times action must be done (default 1)
    //   charOnly — 'kao'|'poom'|'auto'  (omit = all characters)
    //   position — 'center'|'bottom'|'top'|'right'
    //   highlight— { type, target|key|region } — see header
    // ══════════════════════════════════════════════════════════
    const STEPS = [

        // ── 0. Welcome ──────────────────────────────────────
        {
            ...T('welcome'),
            action: 'none',
            position: 'center',
        },

        // ── 1. Movement ─────────────────────────────────────
        {
            ...T('movement'),
            action: 'move',
            count: 1,
            position: 'right',
        },

        // ── 2. Shooting ─────────────────────────────────────
        {
            ...T('shooting'),
            action: 'shoot',
            count: 3,
            position: 'right',
        },

        // ── 3. Dash ─────────────────────────────────────────
        {
            ...T('dash'),
            action: 'dash',
            count: 1,
            position: 'right',
            highlight: { type: 'ui', target: '#dash-icon' },
        },

        // ── 4. R-Click Skill (all chars) ────────────────────
        {
            ...T('rclick'),
            action: 'skill',
            count: 1,
            position: 'right',
            highlight: { type: 'ui', target: '#stealth-icon' },
        },

        // ── 5. Kao: Passive ──────────────────────────────────
        {
            ...T('kaoPassive'),
            action: 'none',
            charOnly: 'kao',
            position: 'center',
            highlight: { type: 'ui', target: '#passive-skill' },
        },

        // ── 6. Kao: Weapon Switch ───────────────────────────
        {
            ...T('kaoWeapon'),
            action: 'weapon',
            count: 3,
            charOnly: 'kao',
            position: 'right',
        },

        // ── 7. Kao: Q & E Skills ────────────────────────────
        {
            title: 'เก้า — ทักษะการเคลื่อนที่และร่างโคลน ⚡',
            body: 'เมื่อเลเวลอัพ เก้าจะปลดล็อค:\n\n⚡ กด Q — Teleport\n   วาร์ปไปตามทิศทางเมาส์\n\n👥 กด E — Clone of Stealth\n   สร้างร่างโคลนช่วยยิง\n\n(ปลดล็อคอัตโนมัติเมื่อเลเวลอัพ)',
            icon: '⚡',
            action: 'none',
            charOnly: 'kao',
            position: 'center',
            highlight: { type: 'region', region: 'top-left' },
        },

        // ── 8. Poom: R + Q skills ────────────────────────────
        {
            title: 'ภูมิ — ทักษะพิเศษเฉพาะ 🌾',
            body: 'ภูมิมีทักษะเพิ่มเติม 2 อย่าง:\n\n🔥 กด R — Ritual Burst\n   ระเบิดพลังและฟื้น HP ในวงกว้าง\n\n🐉 กด Q — Naga Summon\n   เรียกพญานาคคุ้มกัน 10 วินาที\n\n(ปลดล็อคอัตโนมัติเมื่อเลเวลอัพ)',
            icon: '🌾',
            action: 'none',
            charOnly: 'poom',
            position: 'center',
            highlight: { type: 'ui', target: '#naga-icon' },
        },

        // ── 9. Auto: Vacuum + Detonate + Stand Rush ──────────
        {
            ...T('autoStandRush'),
            action: 'none',
            charOnly: 'auto',
            position: 'center',
        },

        // ── 10. Bullet Time ──────────────────────────────────
        {
            ...T('bulletTime'),
            action: 'bullettime',
            count: 1,
            position: 'right',
            highlight: { type: 'region', region: 'top-left' },
        },

        // ── 11. Level Up ─────────────────────────────────────
        {
            ...T('levelUp'),
            action: 'none',
            position: 'center',
            highlight: { type: 'region', region: 'top-left' },
        },

        // ── 12. Shop ─────────────────────────────────────────
        {
            ...T('shop'),
            action: 'none',
            position: 'center',
            highlight: { type: 'world', key: 'shop' },
        },

        // ── 13. Database & Terminal ──────────────────────────
        {
            ...T('database'),
            action: 'none',
            position: 'center',
            highlight: { type: 'world', key: 'server' },
        },

        // ── 14. Enemy Types & Wave Events ────────────────────
        {
            ...T('enemyTypes'),
            action: 'none',
            position: 'center',
        },

        // ── 15. Boss ─────────────────────────────────────────
        {
            ...T('boss'),
            action: 'none',
            position: 'center',
        },

        // ── 16. Ready ────────────────────────────────────────
        {
            ...T('ready'),
            action: 'none',
            position: 'center',
        },
    ];

    // ── DOM helpers ───────────────────────────────────────────
    function _getCard() { return document.getElementById('tutorial-card'); }
    function _getProgress() { return document.getElementById('tutorial-progress'); }
    function _getOverlay() { return document.getElementById('tutorial-overlay'); }
    function _getArrow() { return document.getElementById('tut-arrow'); }

    // Returns STEPS indices visible for current character
    function _activeIndices() {
        return STEPS.reduce((acc, s, i) => {
            if (!s.charOnly || s.charOnly === _charType) acc.push(i);
            return acc;
        }, []);
    }

    // ══════════════════════════════════════════════════════════
    // PART B — Canvas draw: spotlight dim + world pulse
    // Called every frame from game.js after CTX.restore()
    // ══════════════════════════════════════════════════════════
    function draw(ctx) {
        if (!_active) return;
        const step = STEPS[_stepIndex];
        if (!step || !step.highlight) return;

        const h = step.highlight;
        const now = performance.now() / 1000;

        if (h.type === 'world') {
            // ── Pulse circle on a world-space target ──────────
            const pos = _worldPos(h.key);
            if (!pos || typeof worldToScreen === 'undefined') return;
            const screen = worldToScreen(pos.x, pos.y);

            const pulse = 0.5 + 0.5 * Math.sin(now * 3.5);
            const r1 = 55 + pulse * 20;
            const r2 = r1 + 18;

            ctx.save();

            // dim everything outside the pulse ring
            ctx.fillStyle = 'rgba(0,0,0,0.38)';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            // cut-out hole
            ctx.globalCompositeOperation = 'destination-out';
            const grad = ctx.createRadialGradient(screen.x, screen.y, r1 * 0.6, screen.x, screen.y, r2);
            grad.addColorStop(0, 'rgba(0,0,0,1)');
            grad.addColorStop(0.7, 'rgba(0,0,0,0.85)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, r2, 0, Math.PI * 2);
            ctx.fill();

            ctx.globalCompositeOperation = 'source-over';

            // animated pulse ring
            const alpha = 0.55 + 0.45 * Math.sin(now * 4);
            ctx.strokeStyle = `rgba(250,204,21,${alpha})`;
            ctx.lineWidth = 3;
            ctx.shadowColor = '#facc15';
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, r1, 0, Math.PI * 2);
            ctx.stroke();

            // second softer ring
            ctx.strokeStyle = `rgba(250,204,21,${alpha * 0.4})`;
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, r1 + 22, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();

        } else if (h.type === 'region') {
            // ── Dim everything except a screen region ─────────
            const rect = _regionRect(h.region, ctx.canvas);
            if (!rect) return;

            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            // punch out the region
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.beginPath();
            ctx.roundRect(rect.x - 8, rect.y - 8, rect.w + 16, rect.h + 16, 10);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';

            // glow border around the region
            const pulse = 0.5 + 0.5 * Math.sin(now * 3);
            ctx.strokeStyle = `rgba(99,102,241,${0.5 + pulse * 0.4})`;
            ctx.lineWidth = 2;
            ctx.shadowColor = '#818cf8';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.roundRect(rect.x - 8, rect.y - 8, rect.w + 16, rect.h + 16, 10);
            ctx.stroke();

            ctx.restore();
        }
        // type:'ui' is handled entirely via CSS class on the element (no canvas draw needed)
    }

    // Resolve world coordinates for named keys
    function _worldPos(key) {
        if (key === 'shop' && typeof MTC_SHOP_LOCATION !== 'undefined') return MTC_SHOP_LOCATION;
        if (key === 'server' && typeof MTC_DATABASE_SERVER !== 'undefined') return MTC_DATABASE_SERVER;
        return null;
    }

    // Returns {x,y,w,h} in screen-space for named regions
    function _regionRect(region, canvas) {
        const W = canvas.width, H = canvas.height;
        if (region === 'top-left') return { x: 0, y: 0, w: 320, h: 140 };
        if (region === 'bottom-hud') return { x: W / 2 - 320, y: H - 120, w: 640, h: 110 };
        return null;
    }

    // ══════════════════════════════════════════════════════════
    // PART C — Arrow: points to UI element or world target
    // Uses a single absolutely-positioned #tut-arrow div
    // ══════════════════════════════════════════════════════════
    function _updateArrow() {
        const arrow = _getArrow();
        if (!arrow) return;

        if (!_active) { arrow.style.display = 'none'; return; }

        const step = STEPS[_stepIndex];
        if (!step || !step.highlight) { arrow.style.display = 'none'; return; }

        const h = step.highlight;

        if (h.type === 'ui') {
            const el = document.querySelector(h.target);
            if (!el) { arrow.style.display = 'none'; return; }

            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top;

            // Position arrow above the element, pointing down
            arrow.style.display = 'block';
            arrow.style.left = `${cx - 18}px`;
            arrow.style.top = `${cy - 52}px`;
            arrow.dataset.dir = 'down';

        } else if (h.type === 'world') {
            const pos = _worldPos(h.key);
            if (!pos || typeof worldToScreen === 'undefined') { arrow.style.display = 'none'; return; }

            const canvas = document.getElementById('gameCanvas') || document.querySelector('canvas');
            if (!canvas) { arrow.style.display = 'none'; return; }

            const screen = worldToScreen(pos.x, pos.y);
            const cr = canvas.getBoundingClientRect();

            // clamp to edges if off-screen
            const sx = cr.left + screen.x;
            const sy = cr.top + screen.y;
            const W = window.innerWidth;
            const H = window.innerHeight;
            const MARGIN = 60;

            const clampedX = Math.max(MARGIN, Math.min(W - MARGIN, sx));
            const clampedY = Math.max(MARGIN, Math.min(H - MARGIN, sy));

            const onScreen = sx > cr.left + MARGIN && sx < cr.right - MARGIN &&
                sy > cr.top + MARGIN && sy < cr.bottom - MARGIN;

            if (onScreen) {
                // target visible — small arrow above it
                arrow.style.left = `${clampedX - 18}px`;
                arrow.style.top = `${clampedY - 60}px`;
                arrow.dataset.dir = 'down';
            } else {
                // target off-screen — edge arrow pointing toward it
                const angle = Math.atan2(sy - H / 2, sx - W / 2);
                const edgeX = W / 2 + Math.cos(angle) * (W / 2 - MARGIN);
                const edgeY = H / 2 + Math.sin(angle) * (H / 2 - MARGIN);
                arrow.style.left = `${Math.max(MARGIN, Math.min(W - MARGIN, edgeX)) - 18}px`;
                arrow.style.top = `${Math.max(MARGIN, Math.min(H - MARGIN, edgeY)) - 18}px`;
                arrow.dataset.dir = 'edge';
                // rotate CSS arrow to point toward target
                const deg = (angle * 180 / Math.PI) + 90;
                arrow.style.setProperty('--arrow-rotate', `${deg}deg`);
            }
            arrow.style.display = 'block';

        } else {
            arrow.style.display = 'none';
        }
    }

    // Highlight UI element with CSS class — cached to avoid DOM churn every frame
    function _applyUIHighlight() {
        if (!_active) {
            if (_lastHighlightTarget) {
                _lastHighlightTarget.classList.remove('tut-highlighted');
                _lastHighlightTarget = null;
            }
            return;
        }
        const step = STEPS[_stepIndex];
        const newTarget = (step && step.highlight && step.highlight.type === 'ui')
            ? document.querySelector(step.highlight.target)
            : null;

        if (newTarget === _lastHighlightTarget) return; // no change — skip DOM write

        // Clear old
        if (_lastHighlightTarget) _lastHighlightTarget.classList.remove('tut-highlighted');
        // Set new
        _lastHighlightTarget = newTarget;
        if (newTarget) newTarget.classList.add('tut-highlighted');
    }

    // ── Render ────────────────────────────────────────────────
    function _render() {
        const step = STEPS[_stepIndex];
        const card = _getCard();
        const overlay = _getOverlay();
        if (!card || !overlay || !step) {
            console.error('[TutorialSystem] Cannot render: missing DOM elements or step', { card, overlay, step });
            return;
        }

        overlay.style.display = 'flex';
        overlay.style.opacity = '1';

        const pos = step.position || 'center';
        card.className = 'tutorial-card tutorial-card--' + pos;

        const tutIcon = document.getElementById('tut-icon');
        const tutTitle = document.getElementById('tut-title');
        const tutBody = document.getElementById('tut-body');

        if (tutIcon) tutIcon.textContent = step.icon || '🎓';
        if (tutTitle) tutTitle.textContent = step.title || '';
        if (tutBody) tutBody.innerHTML = (step.body || '').replace(/\n/g, '<br>');

        const actionHint = document.getElementById('tut-action-hint');
        const nextBtn = document.getElementById('tut-next-btn');
        const actionBar = document.getElementById('tut-action-bar');
        const actionLbl = document.getElementById('tut-action-label');

        if (step.action && step.action !== 'none') {
            if (actionHint) actionHint.style.display = 'flex';
            if (actionBar) actionBar.style.display = 'block';
            if (nextBtn) nextBtn.style.display = 'none';
            _updateActionBar();
        } else {
            if (actionHint) actionHint.style.display = 'none';
            if (actionBar) actionBar.style.display = 'none';
            if (actionLbl) actionLbl.textContent = '';
            if (nextBtn) {
                nextBtn.style.display = 'block';
                const vis = _activeIndices();
                const cur = vis.indexOf(_stepIndex);
                nextBtn.textContent = (cur === vis.length - 1) ? '🚀 START!' : 'NEXT ▶';
            }
        }

        // Progress dots — only visible steps
        const prog = _getProgress();
        if (prog) {
            prog.innerHTML = '';
            const vis = _activeIndices();
            const cur = vis.indexOf(_stepIndex);
            vis.forEach((_, vi) => {
                const dot = document.createElement('div');
                dot.className = 'tut-dot' +
                    (vi === cur ? ' tut-dot--active' : (vi < cur ? ' tut-dot--done' : ''));
                prog.appendChild(dot);
            });
        }

        // Entrance animation
        const isCenter = pos === 'center';
        const isRight = pos === 'right';
        const baseT = isCenter ? 'translate(-50%,-50%)' : isRight ? 'translateY(-50%)' : 'translateX(-50%)';
        card.style.opacity = '0';
        card.style.transform = baseT + ' scale(0.97)';
        requestAnimationFrame(() => {
            card.style.transition = 'opacity 0.25s ease-out, transform 0.25s ease-out';
            card.style.opacity = '1';
            card.style.transform = baseT + ' scale(1)';
        });

        _applyUIHighlight();
        _updateArrow();
    }

    function _updateActionBar() {
        const step = STEPS[_stepIndex];
        const fill = document.getElementById('tut-action-fill');
        const label = document.getElementById('tut-action-label');
        if (!fill || !label || !step) return;

        const need = step.count || 1;
        const done = Math.min(_actionCount, need);
        fill.style.width = `${(done / need) * 100}%`;
        label.textContent = `${done} / ${need}`;

        if (done >= need && !_stepDone) {
            _stepDone = true;
            setTimeout(_advance, 500);
        }
    }

    // ── Advance ───────────────────────────────────────────────
    function _advance() {
        _stepDone = false;
        _actionCount = 0;
        _lastWeapon = typeof weaponSystem !== 'undefined' ? weaponSystem.currentWeapon : null;
        _stepIndex++;

        while (_stepIndex < STEPS.length) {
            const s = STEPS[_stepIndex];
            if (!s.charOnly || s.charOnly === _charType) break;
            _stepIndex++;
        }

        if (_stepIndex >= STEPS.length) { _finish(); return; }
        _render();
    }

    // ── Finish ────────────────────────────────────────────────
    function _finish() {
        _active = false;
        localStorage.setItem(SAVE_KEY, '1');
        try {
            if (typeof CloudSaveSystem !== 'undefined' && typeof CloudSaveSystem.schedulePush === 'function') {
                CloudSaveSystem.schedulePush();
            }
        } catch (e) {
            /* optional cloud sync */
        }

        // restore enemies paused at start
        if (window._tutorialEnemyCache) {
            window.enemies = window._tutorialEnemyCache;
            window._tutorialEnemyCache = null;
        }

        // clear highlights & arrow (also reset the cache to avoid stale ref)
        if (_lastHighlightTarget) {
            _lastHighlightTarget.classList.remove('tut-highlighted');
            _lastHighlightTarget = null;
        }
        document.querySelectorAll('.tut-highlighted').forEach(el => el.classList.remove('tut-highlighted'));
        const arrow = _getArrow();
        if (arrow) arrow.style.display = 'none';

        const overlay = _getOverlay();
        if (overlay) {
            overlay.style.transition = 'opacity 0.4s ease-out';
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                overlay.style.opacity = '1';
                overlay.style.transition = '';
            }, 420);
        }

        if (typeof spawnFloatingText === 'function' && window.player) {
            spawnFloatingText('🎓 TUTORIAL COMPLETE!', window.player.x, window.player.y - 100, '#facc15', 30);
        }
        if (typeof Audio !== 'undefined' && Audio.playAchievement) Audio.playAchievement();
    }

    // ══════════════════════════════════════════════════════════
    // PUBLIC API
    // ══════════════════════════════════════════════════════════
    return {

        isDone() { return localStorage.getItem(SAVE_KEY) === '1'; },
        reset() { localStorage.removeItem(SAVE_KEY); },

        start(charType) {
            _charType = charType || 'kao';
            _active = true;
            _stepIndex = 0;
            _actionCount = 0;
            _stepDone = false;
            _lastWeapon = typeof weaponSystem !== 'undefined' ? weaponSystem.currentWeapon : null;

            // Safety check: ensure required DOM elements exist
            const card = _getCard();
            const overlay = _getOverlay();
            if (!card || !overlay) {
                console.error('[TutorialSystem] Cannot start: missing tutorial DOM elements. card=', card, 'overlay=', overlay);
                _active = false;
                return;
            }

            if (typeof window.enemies !== 'undefined' && window.enemies.length > 0) {
                window._tutorialEnemyCache = window.enemies;
                window.enemies = [];
            }

            // skip leading steps that don't match character
            while (_stepIndex < STEPS.length) {
                const s = STEPS[_stepIndex];
                if (!s.charOnly || s.charOnly === _charType) break;
                _stepIndex++;
            }

            // Ensure overlay is visible before rendering
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';

            _render();
            console.log('[TutorialSystem] Started for character:', _charType, 'step:', _stepIndex);
        },

        isActive() { return _active; },

        isActionStep() {
            if (!_active) return false;
            const step = STEPS[_stepIndex];
            return !!(step && step.action && step.action !== 'none');
        },

        /**
         * Called every frame from gameLoop() — weapon-switch polling.
         * Also updates arrow position every frame (cheap DOM read).
         */
        update() {
            if (!_active) return;

            // weapon polling
            if (!_stepDone) {
                const step = STEPS[_stepIndex];
                if (step && step.action === 'weapon' && typeof weaponSystem !== 'undefined') {
                    const w = weaponSystem.currentWeapon;
                    if (_lastWeapon === null) {
                        _lastWeapon = w;
                    } else if (w !== _lastWeapon) {
                        _lastWeapon = w;
                        _actionCount++;
                        _updateActionBar();
                    }
                }
            }

            // Arrow: throttle to ~20Hz to reduce getBoundingClientRect calls
            const _now = performance.now();
            if (_now - _arrowLastUpdate >= ARROW_UPDATE_INTERVAL) {
                _arrowLastUpdate = _now;
                _updateArrow();
            }
        },

        /** Called from drawGame() — after CTX.restore(), before HUD */
        draw(ctx) { draw(ctx); },

        handleAction(type) {
            if (!_active || _stepDone) return;
            const step = STEPS[_stepIndex];

            if (type === 'next') {
                if (!step.action || step.action === 'none') _advance();
                return;
            }
            if (type === 'skip') { _finish(); return; }

            // 'weapon' handled via update() polling
            if (type === 'weapon') return;

            if (step.action && step.action !== 'none' && type === step.action) {
                _actionCount++;
                _updateActionBar();
            }
        },

        next() { this.handleAction('next'); },
        skip() { this.handleAction('skip'); },
    };
})();

window.TutorialSystem = TutorialSystem;