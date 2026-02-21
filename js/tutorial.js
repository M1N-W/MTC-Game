'use strict';
/**
 * 🎓 TUTORIAL SYSTEM — js/tutorial.js
 *
 * Interactive step-by-step tutorial that runs at the start of the first game.
 * Each step pauses the game, shows an overlay tooltip, and waits for the
 * player to perform the required action before advancing.
 *
 * Integration points:
 *   • startGame() in game.js calls TutorialSystem.start(charType) after
 *     the first wave spawns.
 *   • gameLoop() checks TutorialSystem.isActive() — when true, updateGame()
 *     is replaced by TutorialSystem.update() so the world stays frozen.
 *   • Input events (keys / mouse) are forwarded to TutorialSystem.handleInput()
 *     so steps can detect player actions.
 *
 * Load order: ... → ui.js → tutorial.js → ... → game.js
 */

// ══════════════════════════════════════════════════════════════
// 🎓 TUTORIAL SYSTEM
// ══════════════════════════════════════════════════════════════
const TutorialSystem = (() => {

    // ── State ─────────────────────────────────────────────────
    let _active       = false;
    let _stepIndex    = 0;
    let _stepDone     = false;
    let _actionCount  = 0;
    let _charType     = 'kao';
    let _skipRequested = false;

    // ── localStorage key ──────────────────────────────────────
    const SAVE_KEY = 'mtc_tutorial_done';

    // ── Step definitions ──────────────────────────────────────
    // Each step:
    //   title    — bold heading
    //   body     — instruction text (supports \n for line breaks)
    //   icon     — emoji shown large
    //   action   — 'any' | 'move' | 'shoot' | 'dash' | 'skill' | 'none'
    //   count    — how many times action must be done (default 1)
    //   highlight — optional CSS selector to spotlight
    //   position  — 'center' | 'bottom' | 'top'  (where the card appears)
    //   freeze   — if true, enemies/player don't move (default true)
    const STEPS = [
        {
            title:    'ยินดีต้อนรับสู่ MTC: Enhanced Edition!',
            body:     'เกมนี้คือ Wave Survival Shooter\nภารกิจของคุณคือเอาชนะ "ครูมานพ" นักคณิตศาสตร์สุดโหด\n\nกด NEXT หรือ SPACE เพื่อเริ่มบทเรียน',
            icon:     '🎓',
            action:   'none',
            position: 'center',
        },
        {
            title:    'การเคลื่อนที่',
            body:     'กด W A S D เพื่อเดิน\n\nลองเดินไปรอบๆ สักครู่!',
            icon:     '🕹️',
            action:   'move',
            count:    1,
            position: 'bottom',
        },
        {
            title:    'การยิง',
            body:     'เล็งด้วย Mouse แล้วกด Left Click เพื่อยิง\n\nลองยิงดู 3 ครั้ง!',
            icon:     '🔫',
            action:   'shoot',
            count:    3,
            position: 'bottom',
        },
        {
            title:    'Dash — หลบหลีก',
            body:     'กด SPACE เพื่อ Dash พุ่งหนีศัตรู\nมี Cooldown — ใช้ให้ถูกจังหวะ!\n\nลอง Dash 1 ครั้ง',
            icon:     '💨',
            action:   'dash',
            count:    1,
            position: 'bottom',
        },
        {
            title:    'ทักษะพิเศษ',
            body:     'กด Right Click เพื่อใช้ทักษะพิเศษ\n• Kao — Stealth ซ่อนตัว\n• Poom — Eat Rice เพิ่มพลัง\n• Auto — Wanchai Stand\n\nลองกด Right Click ดู!',
            icon:     '✨',
            action:   'skill',
            count:    1,
            position: 'bottom',
        },
        {
            title:    'Bullet Time ⏱',
            body:     'กด T เพื่อเปิด Bullet Time\nเวลาจะช้าลง 70% — ใช้หลบกระสุนหนาแน่น\nแถบพลังงาน (ล่างกลาง) จะค่อยๆ หมด\n\nกด T เพื่อทดลอง!',
            icon:     '🕐',
            action:   'bullettime',
            count:    1,
            position: 'bottom',
        },
        {
            title:    'MTC Co-op Store 🛒',
            body:     'มีร้านค้าอยู่มุมซ้ายล่างของแผนที่\nเดินเข้าใกล้แล้วกด B เพื่อซื้อไอเทม\n\n💡 ใช้คะแนนซื้อ HP, DMG Boost, Speed Boost',
            icon:     '🛒',
            action:   'none',
            position: 'center',
        },
        {
            title:    'MTC Database Server 🗄️',
            body:     'เซิร์ฟเวอร์อยู่มุมขวาบนของแผนที่\n• กด E — เปิด MTC Database\n• กด F — เปิด Admin Terminal\n\n💻 Admin Terminal มีคำสั่งพิเศษ เช่น "sudo heal"',
            icon:     '🗄️',
            action:   'none',
            position: 'center',
        },
        {
            title:    'ศัตรูและ Boss 👾',
            body:     'ศัตรู 3 ประเภท:\n• Basic — ธรรมดา ยิงได้\n• Tank 🛡️ — HP สูง เดินช้า\n• Mage 🧙 — ยิงสายฟ้า, อุกกาบาต\n\nทุก 3 Wave จะมี Boss "ครูมานพ" ปรากฏตัว!',
            icon:     '👑',
            action:   'none',
            position: 'center',
        },
        {
            title:    'พร้อมแล้ว! 🚀',
            body:     'คุณรู้ทุกอย่างที่จำเป็นแล้ว\nจงเอาชนะครูมานพและผ่านทั้ง 9 Wave!\n\n🏆 ทำคะแนนสูงสุดเพื่อขึ้น Leaderboard\n\nกด START เพื่อเริ่มเกม!',
            icon:     '🎮',
            action:   'none',
            position: 'center',
        },
    ];

    // ── DOM helpers ───────────────────────────────────────────
    function _getCard()     { return document.getElementById('tutorial-card'); }
    function _getProgress() { return document.getElementById('tutorial-progress'); }
    function _getOverlay()  { return document.getElementById('tutorial-overlay'); }

    // ── Render current step ───────────────────────────────────
    function _render() {
        const step    = STEPS[_stepIndex];
        const card    = _getCard();
        const overlay = _getOverlay();
        const prog    = _getProgress();
        if (!card || !overlay) return;

        overlay.style.display = 'flex';

        // Position
        card.className = 'tutorial-card tutorial-card--' + (step.position || 'center');

        // Content
        document.getElementById('tut-icon').textContent  = step.icon || '🎓';
        document.getElementById('tut-title').textContent = step.title;
        document.getElementById('tut-body').innerHTML    =
            step.body.replace(/\n/g, '<br>');

        // Action hint
        const actionHint = document.getElementById('tut-action-hint');
        const nextBtn    = document.getElementById('tut-next-btn');
        const actionBar  = document.getElementById('tut-action-bar');

        if (step.action && step.action !== 'none') {
            actionHint.style.display = 'flex';
            actionBar.style.display  = 'block';
            nextBtn.style.display    = 'none';
            _updateActionBar();
        } else {
            actionHint.style.display = 'none';
            actionBar.style.display  = 'none';
            nextBtn.style.display    = 'block';
            nextBtn.textContent      = _stepIndex === STEPS.length - 1 ? '🚀 START!' : 'NEXT ▶';
        }

        // Progress dots
        if (prog) {
            prog.innerHTML = '';
            STEPS.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.className = 'tut-dot' + (i === _stepIndex ? ' tut-dot--active' : (i < _stepIndex ? ' tut-dot--done' : ''));
                prog.appendChild(dot);
            });
        }

        // Entrance animation
        card.style.opacity   = '0';
        card.style.transform = 'translateY(20px) scale(0.97)';
        requestAnimationFrame(() => {
            card.style.transition = 'opacity 0.25s ease-out, transform 0.25s ease-out';
            card.style.opacity    = '1';
            card.style.transform  = 'translateY(0) scale(1)';
        });
    }

    function _updateActionBar() {
        const step    = STEPS[_stepIndex];
        const bar     = document.getElementById('tut-action-bar');
        const fill    = document.getElementById('tut-action-fill');
        const label   = document.getElementById('tut-action-label');
        if (!bar || !fill || !label) return;

        const need  = step.count || 1;
        const done  = Math.min(_actionCount, need);
        const pct   = (done / need) * 100;

        fill.style.width = pct + '%';
        label.textContent = `${done} / ${need}`;

        if (done >= need && !_stepDone) {
            _stepDone = true;
            setTimeout(_advance, 500);
        }
    }

    // ── Advance to next step ──────────────────────────────────
    function _advance() {
        _stepIndex++;
        _actionCount = 0;
        _stepDone    = false;

        if (_stepIndex >= STEPS.length) {
            _finish();
            return;
        }
        _render();
    }

    // ── Finish tutorial ───────────────────────────────────────
    function _finish() {
        _active = false;
        localStorage.setItem(SAVE_KEY, '1');

        // WARN-11 FIX: restore enemies that were hidden during the tutorial
        if (window._tutorialEnemyCache) {
            window.enemies = window._tutorialEnemyCache;
            window._tutorialEnemyCache = null;
        }

        const overlay = _getOverlay();
        if (overlay) {
            overlay.style.transition = 'opacity 0.4s ease-out';
            overlay.style.opacity    = '0';
            setTimeout(() => {
                overlay.style.display    = 'none';
                overlay.style.opacity    = '1';
                overlay.style.transition = '';
            }, 420);
        }

        // gameLoop in game.js checks TutorialSystem.isActive() each frame.
        // Now that _active is false, updateGame() will resume automatically
        // on the next frame — no need to touch gameState from here.

        if (typeof spawnFloatingText === 'function' && window.player) {
            spawnFloatingText('🎓 TUTORIAL COMPLETE!', window.player.x, window.player.y - 100, '#facc15', 30);
        }
        if (typeof Audio !== 'undefined' && Audio.playAchievement) Audio.playAchievement();
    }

    // ── Public API ────────────────────────────────────────────
    return {

        /**
         * Returns true if tutorial has already been completed.
         */
        isDone() {
            return localStorage.getItem(SAVE_KEY) === '1';
        },

        /**
         * Reset tutorial completion flag (for testing / replay).
         */
        reset() {
            localStorage.removeItem(SAVE_KEY);
        },

        /**
         * Start the tutorial. Called from startGame() in game.js.
         * @param {string} charType — 'kao' | 'poom' | 'auto'
         */
        start(charType) {
            _charType    = charType || 'kao';
            _active      = true;
            _stepIndex   = 0;
            _actionCount = 0;
            _stepDone    = false;
            _skipRequested = false;

            // WARN-11 FIX: hide any enemies that spawned before the tutorial
            // starts so they can't damage the player while they're reading
            // instructions. Restore them in _finish().
            if (typeof window.enemies !== 'undefined' && window.enemies.length > 0) {
                window._tutorialEnemyCache = window.enemies;
                window.enemies = [];
            }

            _render();
        },

        /** True while tutorial is running. */
        isActive() { return _active; },

        /**
         * True when the current step requires the player to perform a real
         * in-game action (move / shoot / dash / skill / bullettime).
         * gameLoop() uses this to decide whether to run updateGame() so the
         * player actually sees their character respond to input.
         */
        isActionStep() {
            if (!_active) return false;
            const step = STEPS[_stepIndex];
            return !!(step && step.action && step.action !== 'none');
        },

        /**
         * Called every frame from gameLoop() while tutorial is active.
         * No-op — tutorial is fully event-driven.
         */
        update() {
            // Nothing to tick — tutorial is event-driven.
        },

        /**
         * Forward keyboard/mouse events here from the input handlers.
         * @param {string} type — 'move'|'shoot'|'dash'|'skill'|'bullettime'|'next'
         */
        handleAction(type) {
            if (!_active || _stepDone) return;

            const step = STEPS[_stepIndex];

            // NEXT / SPACE advances non-action steps
            if (type === 'next') {
                if (!step.action || step.action === 'none') _advance();
                return;
            }

            // Skip button
            if (type === 'skip') {
                _finish();
                return;
            }

            if (step.action && step.action !== 'none' && type === step.action) {
                _actionCount++;
                _updateActionBar();
            }
        },

        /** Called by the Next button in HTML. */
        next() {
            this.handleAction('next');
        },

        /** Called by the Skip button in HTML. */
        skip() {
            this.handleAction('skip');
        },
    };
})();

window.TutorialSystem = TutorialSystem;