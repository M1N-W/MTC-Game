'use strict';
/**
 * 🎓 TUTORIAL SYSTEM — js/tutorial.js  (v2)
 *
 * Changes vs v1:
 *  • charOnly     — steps filtered per character; Kao never sees Poom steps etc.
 *  • weapon step  — detected via update() polling weaponSystem.currentWeapon
 *                   (works for both mouse-wheel AND keyboard cycling)
 *  • positions    — action steps use 'right' to avoid blocking skill-bar HUD
 *  • progress     — dots reflect only the steps visible for the current char
 *  • content      — all steps updated to match current game state
 */

const TutorialSystem = (() => {

    // ── State ─────────────────────────────────────────────────
    let _active = false;
    let _stepIndex = 0;
    let _stepDone = false;
    let _actionCount = 0;
    let _charType = 'kao';
    let _lastWeapon = null;   // weapon-switch polling

    const SAVE_KEY = 'mtc_tutorial_done';

    // ══════════════════════════════════════════════════════════
    // STEP DEFINITIONS
    // ──────────────────────────────────────────────────────────
    // Fields:
    //   title    — bold heading
    //   body     — instruction text (\n → <br>)
    //   icon     — large emoji
    //   action   — 'none'|'move'|'shoot'|'dash'|'skill'|'weapon'|'bullettime'
    //   count    — times action must be done (default 1)
    //   charOnly — 'kao'|'poom'|'auto'  (omit = all characters)
    //   position — 'center'|'bottom'|'top'|'right'
    // ══════════════════════════════════════════════════════════
    const STEPS = [

        // ── 0. Welcome ──────────────────────────────────────
        {
            title: 'ยินดีต้อนรับสู่ MTC the Game!',
            body: 'คุณกำลังจะเข้าสู่ห้องเรียนของ KruManop (ครูมานพ) ครูคณิตศาสตร์สุดโหด\n\nภารกิจ: รอดชีวิตให้ครบ 15 เวฟ และเอาชนะบอสทุกตัว\n\nกด NEXT หรือ SPACE เพื่อเริ่มบทเรียน',
            icon: '🎓',
            action: 'none',
            position: 'center',
        },

        // ── 1. Movement ─────────────────────────────────────
        {
            title: 'การเคลื่อนที่',
            body: 'กด W A S D เพื่อเดิน\n\nเดินไปรอบๆ สักครู่เพื่อทดสอบ!',
            icon: '🕹️',
            action: 'move',
            count: 1,
            position: 'right',
        },

        // ── 2. Shooting ─────────────────────────────────────
        {
            title: 'การยิง',
            body: 'เล็งด้วย Mouse แล้วกด Left Click เพื่อยิง\n\nลองยิงดู 3 ครั้ง!',
            icon: '🔫',
            action: 'shoot',
            count: 3,
            position: 'right',
        },

        // ── 3. Dash ─────────────────────────────────────────
        {
            title: 'Dash — หลบหลีก',
            body: 'กด SPACE เพื่อ Dash พุ่งหลบศัตรู\nมี Cooldown — ใช้ให้ถูกจังหวะ!\n\nลอง Dash 1 ครั้ง',
            icon: '💨',
            action: 'dash',
            count: 1,
            position: 'right',
        },

        // ── 4. R-Click Skill (all chars) ────────────────────
        {
            title: 'ทักษะพิเศษ (Right Click)',
            body: 'กด Right Click เพื่อใช้ทักษะประจำตัว:\n• เก้า — Stealth ซ่อนตัว 3 วินาที\n• ภูมิ — Eat Rice ฟื้น HP และเพิ่มพลัง\n• Auto — Wanchai Stand เรียก autonomous companion (8s, CD 12s)\n\nลองกด Right Click ดู!',
            icon: '✨',
            action: 'skill',
            count: 1,
            position: 'right',
        },

        // ── 5. Kao: Passive "ซุ่มเสรี" ──────────────────────
        {
            title: 'เก้า — ซุ่มเสรี (Passive) 👻',
            body: 'ใช้ Stealth ครบ 5 ครั้ง เพื่อปลดล็อค Passive สุดท้าย!\nดูที่ปุ่ม 0/5 ใน skill bar ด้านล่าง\n\n✦ Crit ขณะซ่อนตัวเพิ่ม 50%\n✦ ความเร็วถาวร +40%\n✦ อาวุธกลายเป็น Golden Awakened Form',
            icon: '👻',
            action: 'none',
            charOnly: 'kao',
            position: 'center',
        },

        // ── 6. Kao: Weapon Switch ───────────────────────────
        {
            title: 'เก้า — สลับอาวุธ 🔫',
            body: 'เก้ามีอาวุธ 3 ชนิด:\n• Auto Rifle — ยิงเร็ว (ค่าเริ่มต้น)\n• Sniper — Railgun ดาเมจสูง ยิงช้า\n• Shotgun — Molten Shrapnel ระยะใกล้\n\nเลื่อน Mouse Wheel เพื่อสลับ\nสลับให้ครบ 3 ครั้ง!',
            icon: '🔄',
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
        },

        // ── 8. Poom: R + Q skills ────────────────────────────
        {
            title: 'ภูมิ — ทักษะพิเศษเฉพาะ 🌾',
            body: 'ภูมิมีทักษะเพิ่มเติม 2 อย่าง:\n\n🔥 กด R — Ritual Burst\n   ระเบิดพลังและฟื้น HP ในวงกว้าง\n\n🐉 กด Q — Naga Summon\n   เรียกพญานาคคุ้มกัน 10 วินาที\n\n(ปลดล็อคอัตโนมัติเมื่อเลเวลอัพ)',
            icon: '🌾',
            action: 'none',
            charOnly: 'poom',
            position: 'center',
        },

        // ── 9. Auto: Vacuum Heat + Detonate ─────────────────
        {
            title: 'Auto — ทักษะพิเศษเฉพาะ 🌀',
            body: 'Auto มีทักษะควบคุมพื้นที่:\n\n🌀 กด Q — Vacuum Heat (CD 6s)\n   ดูดศัตรูทุกตัวเข้าหาตัว + stun\n\n💥 กด E — Detonate (CD 8s, ต้องเปิด Wanchai ก่อน)\n   ระเบิด AOE สูง แต่ปิด Wanchai ทันที\n\n👊 L-Click ระหว่าง Wanchai Active\n   Stand Rush — ส่งสแตนด์พุ่งไปตามเคอร์เซอร์\n\n(ปลดล็อคอัตโนมัติเมื่อเลเวลอัพ)',
            icon: '🌀',
            action: 'none',
            charOnly: 'auto',
            position: 'center',
        },

        // ── 9.5. Auto: Stand Rush targeting ─────────────────
        {
            title: 'Auto — Stand Rush Manual Targeting 👊',
            body: 'ระหว่าง Wanchai active:\n\n🎯 ชี้เมาส์แล้ว L-Click = Stand Rush ไปตำแหน่งนั้น\n   Stand teleport หาเป้าแล้วรัวหมัดทันที\n\n✨ 6-layer rendering พร้อม visual effect\n🥊 Dual-fist — _punchSide สลับข้างทุกหมัด\n\n⚡ Wanchai ยังโจมตีอัตโนมัติด้วย\n   L-Click เพิ่ม Stand Rush ทับไปได้เลย',
            icon: '👊',
            action: 'none',
            charOnly: 'auto',
            position: 'center',
        },

        // ── 10. Bullet Time ──────────────────────────────────
        {
            title: 'Bullet Time ⏱',
            body: 'กด T เพื่อเปิด Bullet Time\nเวลาจะช้าลง 70% — หลบกระสุนหนาแน่น\n\nแถบพลังงาน FOCUS (ล่างกลาง) ค่อยๆ หมด\nปล่อยให้ชาร์จก่อนใช้อีกครั้ง\n\nกด T เพื่อทดลอง!',
            icon: '🕐',
            action: 'bullettime',
            count: 1,
            position: 'right',
        },

        // ── 11. Level Up ─────────────────────────────────────
        {
            title: 'Level Up & EXP 📈',
            body: 'กำจัดศัตรูเพื่อรับ EXP\nเมื่อเลเวลอัพ Stats ทั้งหมดเพิ่มขึ้น\n\nLv.2 → ปลดล็อค Skill Q\nLv.3 → ปลดล็อค Skill E (หรือ R สำหรับภูมิ)\n\n💡 แถบ EXP อยู่ใต้แถบ HP มุมซ้ายบน',
            icon: '📈',
            action: 'none',
            position: 'center',
        },

        // ── 12. Shop ─────────────────────────────────────────
        {
            title: 'MTC Co-op Store 🛒',
            body: 'ร้านค้าอยู่มุมซ้ายล่างของแผนที่\nเดินเข้าใกล้แล้วกด B เพื่อเปิดร้าน\n\n🧪 ซื้อด้วย Score:\n• Potion — ฟื้น HP ทันที\n• Damage Up — เพิ่มดาเมจ 10%\n• Speed Up — เพิ่มความเร็ว 10%\n• Shield — โล่กัน 1 ครั้ง',
            icon: '🛒',
            action: 'none',
            position: 'center',
        },

        // ── 13. Database & Terminal ──────────────────────────
        {
            title: 'MTC Database Server 🗄️',
            body: 'เซิร์ฟเวอร์อยู่มุมขวาบนของแผนที่\n\n💻 กด E — เปิด MTC Database\n   ดูเนื้อหาและ Lore\n\n🔒 กด F — Admin Terminal\n   พิมพ์ "help" เพื่อดูคำสั่งทั้งหมด\n   เช่น: "sudo heal", "sudo score", "sudo next"',
            icon: '🗄️',
            action: 'none',
            position: 'center',
        },

        // ── 14. Enemy Types & Wave Events ────────────────────
        {
            title: 'ประเภทศัตรู & Wave Events 👾',
            body: 'ศัตรู 3 ประเภท:\n🔴 Basic — เดินเร็ว ยิงได้\n🟠 Tank 🛡️ — HP สูงมาก เดินช้า\n🟣 Mage 🧙 — สายฟ้า + อุกกาบาต\n\nWave Events พิเศษ:\n🌑 Wave 1 — Dark Wave: เปิดตัวด้วยความมืดมิด\n🌫️ Wave 2,8,11,14 — Fog Wave: Radar OFFLINE — minimap ใช้ไม่ได้!\n⚡ Wave 4,7,13 — Speed Wave: ศัตรูเร็ว ×1.5\n⚠️ Wave 5,10 — Glitch Wave: Controls Invert + ได้ HP +100 ชั่วคราว',
            icon: '👾',
            action: 'none',
            position: 'center',
        },

        // ── 15. Boss ─────────────────────────────────────────
        {
            title: 'Boss Encounters 👑',
            body: 'ทุก 3 เวฟจะมี Boss — 5 encounters ทั้งหมด:\n\n👑 Wave  3 — KruManop (Basic)\n🐕 Wave  9 — KruManop (Dog Rider) — Phase 2 เรียกหมา\n🐟 Wave 15 — KruManop (Goldfish Lover) — Phase 2+3\n\n⚛️ Wave  6 — KruFirst (Basic)\n⚛️ Wave 12 — KruFirst (Advanced ⚠️ ยากขึ้น)\n\n🌌 Domain Expansion — ทักษะ Ultimate\n   Boss ใช้เมื่อ HP ต่ำ ควบคุมพื้นที่ทั้ง Arena!\n\n💡 ดู Boss HP Bar ด้านบนของจอ',
            icon: '👑',
            action: 'none',
            position: 'center',
        },

        // ── 16. Ready ────────────────────────────────────────
        {
            title: 'พร้อมแล้ว! 🚀',
            body: 'คุณรู้ทุกอย่างที่จำเป็นแล้ว!\n\n🏆 ทำคะแนนสูงสุดเพื่อขึ้น Leaderboard\n⭐ ปลดล็อค Achievement มากมาย\n🎯 ผ่านทั้ง 15 Wave เพื่อชนะเกม\n\nกด START เพื่อเข้าสู่สนามรบ!',
            icon: '🎮',
            action: 'none',
            position: 'center',
        },
    ];

    // ── DOM helpers ───────────────────────────────────────────
    function _getCard() { return document.getElementById('tutorial-card'); }
    function _getProgress() { return document.getElementById('tutorial-progress'); }
    function _getOverlay() { return document.getElementById('tutorial-overlay'); }

    // Returns original STEPS indices visible for the current character
    function _activeIndices() {
        return STEPS.reduce((acc, s, i) => {
            if (!s.charOnly || s.charOnly === _charType) acc.push(i);
            return acc;
        }, []);
    }

    // ── Render ────────────────────────────────────────────────
    function _render() {
        const step = STEPS[_stepIndex];
        const card = _getCard();
        const overlay = _getOverlay();
        if (!card || !overlay || !step) return;

        overlay.style.display = 'flex';

        const pos = step.position || 'center';
        card.className = 'tutorial-card tutorial-card--' + pos;

        document.getElementById('tut-icon').textContent = step.icon || '🎓';
        document.getElementById('tut-title').textContent = step.title;
        document.getElementById('tut-body').innerHTML = step.body.replace(/\n/g, '<br>');

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
                const pos = vis.indexOf(_stepIndex);
                nextBtn.textContent = (pos === vis.length - 1) ? '🚀 START!' : 'NEXT ▶';
            }
        }

        // Progress dots — only for visible steps
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

        // Entrance animation — adjust base transform per position
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

    // ── Advance — skips steps not matching charType ───────────
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

        if (window._tutorialEnemyCache) {
            window.enemies = window._tutorialEnemyCache;
            window._tutorialEnemyCache = null;
        }

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

            if (typeof window.enemies !== 'undefined' && window.enemies.length > 0) {
                window._tutorialEnemyCache = window.enemies;
                window.enemies = [];
            }

            // Skip leading steps that don't match character
            while (_stepIndex < STEPS.length) {
                const s = STEPS[_stepIndex];
                if (!s.charOnly || s.charOnly === _charType) break;
                _stepIndex++;
            }

            _render();
        },

        isActive() { return _active; },

        isActionStep() {
            if (!_active) return false;
            const step = STEPS[_stepIndex];
            return !!(step && step.action && step.action !== 'none');
        },

        /**
         * Called every frame from gameLoop().
         * Handles weapon-step by polling weaponSystem.currentWeapon —
         * works for both mouse-wheel and keyboard weapon cycling.
         */
        update() {
            if (!_active || _stepDone) return;
            const step = STEPS[_stepIndex];
            if (!step || step.action !== 'weapon') return;
            if (typeof weaponSystem === 'undefined') return;

            const w = weaponSystem.currentWeapon;
            if (_lastWeapon === null) {
                _lastWeapon = w;
            } else if (w !== _lastWeapon) {
                _lastWeapon = w;
                _actionCount++;
                _updateActionBar();
            }
        },

        handleAction(type) {
            if (!_active || _stepDone) return;
            const step = STEPS[_stepIndex];

            if (type === 'next') {
                if (!step.action || step.action === 'none') _advance();
                return;
            }
            if (type === 'skip') { _finish(); return; }

            // 'weapon' handled via update() polling — ignore here to avoid double-count
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