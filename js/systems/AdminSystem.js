'use strict';

// ══════════════════════════════════════════════════════════════
// 💻 ADMIN SYSTEM (extracted from game.js)
// ══════════════════════════════════════════════════════════════

// ─── MTC Database Server ──────────────────────────────────────
// ย้ายออกไป NE ตามแผนที่ใหม่ — สอดคล้องกับ MAP_CONFIG.auras.database
// และ MAP_CONFIG.paths.database.to ที่อัปเดตใน config.js
const MTC_DATABASE_SERVER = {
    x: 480,
    y: -480,
    INTERACTION_RADIUS: 90
};

window.MTC_DATABASE_SERVER = MTC_DATABASE_SERVER;

// ─── External Database URL ────────────────────────────────────
const MTC_DB_URL = 'https://claude.ai/public/artifacts/649de47e-b97f-41ad-ae66-c944d35eb24f';

// ══════════════════════════════════════════════════════════════
// 💻 ADMIN CONSOLE MANAGER
// ══════════════════════════════════════════════════════════════
const AdminConsole = (() => {
    const history = [];
    let histIdx = -1;
    let isOpen = false;

    const CHAR_DELAY = 18;

    // ── Permission Levels ──────────────────────────────────────
    // 0 = GUEST    (no window.isAdmin)
    // 1 = OPERATOR (window.isAdmin === true)
    // 2 = ROOT     (window.isAdmin === 'root')
    const PERM = {
        GUEST: 0,
        OPERATOR: 1,
        ROOT: 2,
    };
    const PERM_LABEL = {
        [PERM.GUEST]: { text: 'GUEST', color: '#6b7280', badge: '○' },
        [PERM.OPERATOR]: { text: 'OPERATOR', color: '#22c55e', badge: '◉' },
        [PERM.ROOT]: { text: 'ROOT', color: '#f97316', badge: '★' },
    };

    function _getPermLevel() {
        if (window.isAdmin === 'root') return PERM.ROOT;
        if (window.isAdmin === true) return PERM.OPERATOR;
        return PERM.GUEST;
    }

    // ── God-mode state ─────────────────────────────────────────
    let _godMode = false;
    let _godInterval = null;

    // ── Available commands for Tab auto-complete ───────────────
    const COMMANDS = [
        'heal', 'score', 'next wave', 'set wave', 'give weapon',
        'spawn manop', 'spawn manop 2', 'spawn manop 3',
        'spawn first', 'spawn first advanced',
        'god', 'god off', 'devbuff',
        'energy', 'kill all', 'speed', 'fps', 'info', 'reset buffs',
        'clear', 'help', 'exit',
        // Easter egg commands kept for discoverability
        'whoami', 'ls', 'ls -la', 'cat kru_manop_passwords.txt',
        'sudo make me a sandwich', 'sudo rm -rf /'
    ];

    // ─────────────────────────────────────────────────────────
    // TYPING ANIMATION OUTPUT
    // ─────────────────────────────────────────────────────────
    let _cmdCount = 0;

    function _appendLine(text, cssClass = 'cline-info', instant = false) {
        const output = document.getElementById('console-output');
        if (!output) return;

        const div = document.createElement('div');
        div.className = 'console-line ' + cssClass;

        if (instant || text.length === 0) {
            div.textContent = text;
            output.appendChild(div);
            output.scrollTop = output.scrollHeight;
            return;
        }

        div.textContent = '';
        output.appendChild(div);
        let i = 0;
        const tick = () => {
            if (i < text.length) {
                div.textContent += text[i++];
                output.scrollTop = output.scrollHeight;
                setTimeout(tick, CHAR_DELAY);
            }
        };
        tick();
    }

    // ─────────────────────────────────────────────────────────
    // UPDATE PERMISSION BADGE IN TITLEBAR
    // ─────────────────────────────────────────────────────────
    function _updatePermBadge() {
        const badge = document.getElementById('console-perm-badge');
        if (!badge) return;
        const lvl = _getPermLevel();
        const info = PERM_LABEL[lvl];
        badge.textContent = `${info.badge} ${info.text}`;
        badge.style.color = info.color;
        badge.style.borderColor = info.color;
    }

    // ─────────────────────────────────────────────────────────
    // KILL ALL ENEMIES + BOSS  (shared by 'next wave' & 'set wave')
    // ─────────────────────────────────────────────────────────
    function _killAllEntities() {
        let killed = 0;
        if (window.enemies && window.enemies.length > 0) {
            for (const e of window.enemies) {
                if (e && !e.dead && typeof e.takeDamage === 'function') {
                    e.takeDamage(99999);
                    killed++;
                }
            }
        }
        if (window.boss && !window.boss.dead && typeof window.boss.takeDamage === 'function') {
            window.boss.takeDamage(99999);
            // _onDeath() fires via takeDamage — but abort defensively in case it doesn't reset
            if (typeof DomainExpansion !== 'undefined') DomainExpansion._abort(null);
            if (typeof GravitationalSingularity !== 'undefined') GravitationalSingularity._abort(null);
            killed++;
        }
        return killed;
    }

    // ─────────────────────────────────────────────────────────
    // COMMAND PARSER  (arg-based, no "sudo" prefix required)
    // ─────────────────────────────────────────────────────────
    function _parse(raw) {
        const trimmed = raw.trim();
        if (!trimmed) return;

        _cmdCount++;
        const perm = _getPermLevel();
        const permInfo = PERM_LABEL[perm];
        // Show prompt with permission-colored label and command counter
        _appendLine(`[${String(_cmdCount).padStart(3, '0')}] ${permInfo.badge}${permInfo.text}@mtcserver:~# ${raw}`, 'cline-cmd', true);

        history.unshift(raw);
        histIdx = -1;

        // Split into tokens for arg parsing
        const args = trimmed.toLowerCase().split(/\s+/);
        const base = args[0];          // first token
        const sub = args[1] || '';    // second token
        const rest = args.slice(2);    // remainder

        // ── Permission guard ───────────────────────────────────
        const ROOT_ONLY = ['god', 'kill', 'speed', 'reset'];
        if (ROOT_ONLY.includes(base) && perm < PERM.ROOT) {
            _appendLine('⛔ ERR: Permission denied. Required: ROOT', 'cline-error');
            _appendLine(`   Your level: ${PERM_LABEL[perm].text}  — contact system admin.`, 'cline-warn', true);
            return;
        }

        // ── Player guard (most commands need an active player) ─
        const needsPlayer = !['help', 'clear', 'exit', 'quit', 'q',
            'whoami', 'ls', 'cat', 'sudo'].includes(base);
        if (needsPlayer && !window.player) {
            _appendLine(GAME_TEXTS.admin.noPlayer, 'cline-error');
            return;
        }

        // ══════════════════════════════════════════════════════
        // heal [amount]
        // ══════════════════════════════════════════════════════
        if (base === 'heal') {
            const amount = parseInt(args[1]) || 100;
            const maxHp = window.player.maxHp || 110;
            const before = window.player.hp;
            window.player.hp = Math.min(maxHp, window.player.hp + amount);
            const gained = Math.round(window.player.hp - before);
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine(GAME_TEXTS.admin.healInject(gained), 'cline-info');
            _appendLine(GAME_TEXTS.admin.healResult(Math.round(window.player.hp), maxHp), 'cline-ok');
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(GAME_TEXTS.admin.healFloat(gained), window.player.x, window.player.y - 70, '#00ff41', 22);
            if (typeof spawnParticles === 'function')
                spawnParticles(window.player.x, window.player.y, 14, '#00ff41');
            if (typeof Audio !== 'undefined' && Audio.playHeal) Audio.playHeal();
        }

        // ══════════════════════════════════════════════════════
        // score [amount]
        // ══════════════════════════════════════════════════════
        else if (base === 'score') {
            const amount = parseInt(args[1]) || 5000;
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine(GAME_TEXTS.admin.scorePatching, 'cline-info');
            if (typeof addScore === 'function') addScore(amount);
            _appendLine(GAME_TEXTS.admin.scoreResult(typeof getScore === 'function' ? getScore().toLocaleString() : '?'), 'cline-ok');
            const scoreEl = document.getElementById('score');
            if (scoreEl && typeof getScore === 'function') scoreEl.textContent = getScore().toLocaleString();
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(`+${amount.toLocaleString()} pts`, window.player.x, window.player.y - 70, '#fbbf24', 22);
            if (typeof spawnParticles === 'function')
                spawnParticles(window.player.x, window.player.y, 14, '#fbbf24');
            if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
        }

        // ══════════════════════════════════════════════════════
        // next wave
        // ══════════════════════════════════════════════════════
        else if (base === 'next' && sub === 'wave') {
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine(GAME_TEXTS.admin.nextSigkill, 'cline-info');
            const killed = _killAllEntities();
            _appendLine(GAME_TEXTS.admin.nextResult(killed), 'cline-ok');
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(GAME_TEXTS.admin.nextFloat, window.player.x, window.player.y - 80, '#ef4444', 26);
            if (typeof addScreenShake === 'function') addScreenShake(18);
            if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
            setTimeout(() => closeAdminConsole(), 1800);
        }

        // ══════════════════════════════════════════════════════
        // set wave [num]
        // ══════════════════════════════════════════════════════
        else if (base === 'set' && sub === 'wave') {
            const num = parseInt(args[2]);
            if (isNaN(num) || num < 1) {
                _appendLine('ERR: usage: set wave <number>', 'cline-error');
                return;
            }
            const maxWave = (typeof BALANCE !== 'undefined' && BALANCE.waves?.maxWaves) || 15;
            if (num > maxWave) {
                _appendLine(`ERR: wave ${num} exceeds maxWaves (${maxWave})`, 'cline-error');
                return;
            }
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine(`> Patching wave counter → ${num}...`, 'cline-info');

            // ── Step 1: Kill all live entities + stop trickle ──────────
            _killAllEntities();
            // Force-stop trickle so game loop doesn't block wave transition
            window.isTrickleActive = false;
            if (typeof window._trickle !== 'undefined') {
                window._trickle.active = false;
                window._trickle.remaining = 0;
            }
            // Clear enemies array so wave-advance guard sees 0 enemies
            if (window.enemies) window.enemies.length = 0;
            if (window.boss) { window.boss.dead = true; window.boss = null; }
            // Reset domain singletons — ป้องกัน isInvincible() ค้าง true ข้ามเวฟ
            if (typeof DomainExpansion !== 'undefined') DomainExpansion._abort(null);
            if (typeof GravitationalSingularity !== 'undefined') GravitationalSingularity._abort(null);

            // ── Step 2: Set wave counter to num-1 THEN call startNextWave ─
            // startNextWave() calls getWave() at the TOP (before incrementing),
            // so we must pre-set to num-1 and let startNextWave do the +1.
            if (typeof setWave === 'function') {
                setWave(num - 1);
            } else if (typeof window.wave !== 'undefined') {
                window.wave = num - 1;
            }

            // ── Step 3: Fire startNextWave directly ────────────────────
            _appendLine(`> Calling startNextWave() → wave ${num}...`, 'cline-info');
            if (typeof startNextWave === 'function') {
                startNextWave();
                _appendLine(`✔ Jumped to Wave ${num}. Enemies spawning now.`, 'cline-ok');
            } else {
                _appendLine('WARN: startNextWave() not found. Wave counter set but not triggered.', 'cline-warn', true);
                _appendLine(`✔ Wave counter = ${num - 1}. Will advance on next game-loop cycle.`, 'cline-ok');
            }

            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(`⏭ WAVE ${num}`, window.player.x, window.player.y - 80, '#06b6d4', 26);
            if (typeof addScreenShake === 'function') addScreenShake(10);
            if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
            setTimeout(() => closeAdminConsole(), 1800);
        }

        // ══════════════════════════════════════════════════════
        // give weapon [name]
        // ══════════════════════════════════════════════════════
        else if (base === 'give' && sub === 'weapon') {
            const weaponName = rest[0];
            if (!weaponName) {
                _appendLine('ERR: usage: give weapon <name>', 'cline-error');
                _appendLine('> Available: pistol, rifle, shotgun, sniper, smg, launcher', 'cline-info', true);
                return;
            }
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine(`> Injecting weapon module: ${weaponName}...`, 'cline-info');
            let success = false;
            // Try player.switchWeapon first (most common API)
            if (typeof window.player.switchWeapon === 'function') {
                try {
                    window.player.switchWeapon(weaponName);
                    success = true;
                } catch (err) {
                    _appendLine(`ERR: switchWeapon threw — ${err.message}`, 'cline-error');
                }
            }
            // Fallback: weaponSystem.give / setWeapon
            else if (typeof window.weaponSystem !== 'undefined') {
                const fn = window.weaponSystem.give || window.weaponSystem.setWeapon || window.weaponSystem.switchWeapon;
                if (typeof fn === 'function') {
                    try { fn.call(window.weaponSystem, weaponName); success = true; }
                    catch (err) { _appendLine(`ERR: weaponSystem — ${err.message}`, 'cline-error'); }
                }
            }
            if (success) {
                _appendLine(`✔ Weapon "${weaponName}" equipped.`, 'cline-ok');
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText(`🔫 ${weaponName.toUpperCase()}`, window.player.x, window.player.y - 70, '#a78bfa', 22);
                if (typeof spawnParticles === 'function')
                    spawnParticles(window.player.x, window.player.y, 10, '#a78bfa');
                if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
            } else if (!success) {
                _appendLine(`ERR: weapon "${weaponName}" not found or equip API unavailable.`, 'cline-error');
                _appendLine('> Try: pistol, rifle, shotgun, sniper, smg, launcher', 'cline-info', true);
            }
        }

        // ══════════════════════════════════════════════════════
        // spawn manop [phase]   — summons Kru Manop  (phase 1/2/3)
        // spawn first [advanced] — summons Kru First (normal/advanced)
        // ══════════════════════════════════════════════════════
        else if (base === 'spawn' && (sub === 'manop' || sub === 'first')) {
            // ── Parse optional 3rd arg ─────────────────────────
            // manop: phase = 1 | 2 | 3   (default 1)
            // first: "advanced" or blank  (default normal)
            const arg3 = (args[2] || '').toLowerCase();
            const isManop = sub === 'manop';

            if (isManop && typeof Boss === 'undefined') {
                _appendLine('ERR: Boss class not found. Is boss.js loaded?', 'cline-error');
                return;
            }
            if (!isManop && typeof BossFirst === 'undefined') {
                _appendLine('ERR: BossFirst class not found. Is boss.js loaded?', 'cline-error');
                return;
            }

            if (window.boss && !window.boss.dead)
                _appendLine('WARN: existing boss detected — overwriting reference.', 'cline-warn', true);

            const difficulty = Math.max(1, Math.floor(
                (typeof getWave === 'function' ? getWave() : (window.wave || 1)) / 3
            ));

            if (isManop) {
                // ── Kru Manop — phase 1 / 2 / 3 ──────────────
                const phase = parseInt(arg3) || 1;
                if (phase < 1 || phase > 3) {
                    _appendLine('ERR: usage: spawn manop [1|2|3]', 'cline-error');
                    _appendLine('>  phase 1 = basic', 'cline-info', true);
                    _appendLine('>  phase 2 = Dog Rider  (enablePhase2)', 'cline-info', true);
                    _appendLine('>  phase 3 = Goldfish Lover  (enablePhase2 + enablePhase3)', 'cline-info', true);
                    return;
                }
                const enablePhase2 = phase >= 2;
                const enablePhase3 = phase >= 3;
                _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
                _appendLine(`> Allocating Boss: KRU MANOP  Phase ${phase}...`, 'cline-info');
                window.boss = new Boss(difficulty, enablePhase2, enablePhase3);
                // Force boss into the requested phase immediately
                if (phase >= 2) window.boss.phase = phase;

                const phaseLabel = phase === 3 ? '🐟 GOLDFISH LOVER' : phase === 2 ? '🐕 DOG RIDER' : '💢 BASIC';
                _appendLine(`✔ KRU MANOP  ${phaseLabel}  spawned (difficulty ×${difficulty}).`, 'cline-ok');
                spawnFloatingText(
                    phase === 3 ? '🐟 KRU MANOP — GOLDFISH LOVER!'
                        : phase === 2 ? '🐕 KRU MANOP — DOG RIDER!'
                            : '💢 KRU MANOP APPEARS!',
                    window.player.x, window.player.y - 80,
                    phase === 3 ? '#38bdf8' : phase === 2 ? '#d97706' : '#ef4444', 26
                );

            } else {
                // ── Kru First — normal / advanced ──────────────
                const isAdvanced = (arg3 === 'advanced' || arg3 === 'adv');
                if (arg3 && !isAdvanced) {
                    _appendLine('ERR: usage: spawn first [advanced]', 'cline-error');
                    _appendLine('>  (no arg) = normal', 'cline-info', true);
                    _appendLine('>  advanced = encounter 4 variant (+35% stats)', 'cline-info', true);
                    return;
                }
                _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
                _appendLine(`> Allocating BossFirst: KRU FIRST  ${isAdvanced ? 'ADVANCED' : 'Normal'}...`, 'cline-info');
                window.boss = new BossFirst(difficulty, isAdvanced);

                _appendLine(`✔ KRU FIRST  ${isAdvanced ? '⚛️ ADVANCED' : 'Normal'}  spawned (difficulty ×${difficulty}).`, 'cline-ok');
                spawnFloatingText(
                    isAdvanced ? '⚛️ KRU FIRST — ADVANCED!' : '⚛️ KRU FIRST APPEARS!',
                    window.player.x, window.player.y - 80, '#38bdf8', 26
                );
            }

            // ── Common post-spawn effects ───────────────────────
            if (typeof window.UIManager !== 'undefined') window.UIManager.updateBossHUD(window.boss);
            if (typeof addScreenShake === 'function') addScreenShake(20);
            if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
            if (typeof Audio !== 'undefined' && Audio.playBGM) Audio.playBGM('boss');
            setTimeout(() => closeAdminConsole(), 1200);
        }

        // ══════════════════════════════════════════════════════
        // devbuff   — apply Dev Mode stat package to player
        // ══════════════════════════════════════════════════════
        else if (base === 'devbuff') {
            if (typeof window.player.applyDevBuff !== 'function') {
                _appendLine('ERR: applyDevBuff() not found. Is PlayerBase.js updated?', 'cline-error');
                return;
            }
            if (window.player._devBuffApplied) {
                _appendLine('WARN: Dev buff already active on this player.', 'cline-warn', true);
                _appendLine(`  HP ${Math.round(window.player.hp)}/${window.player.maxHp}  EN ${Math.round(window.player.energy)}/${window.player.maxEnergy}`, 'cline-info', true);
                return;
            }
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine('> Injecting DEV BUFF package...', 'cline-info');
            window.player.applyDevBuff();
            _appendLine('✔ Dev buffs applied:', 'cline-ok');
            _appendLine(`  HP  +50%  → ${window.player.maxHp}`, 'cline-ok', true);
            _appendLine(`  EN  +50%  → ${window.player.maxEnergy}`, 'cline-ok', true);
            _appendLine(`  DMG ×1.25 | SPD ×1.20 | CDR ×0.60 | Crit +8%`, 'cline-ok', true);
            _appendLine('  Passive skills: unchanged (unlock normally in-game)', 'cline-info', true);
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText('🚀 DEV BUFF ACTIVE', window.player.x, window.player.y - 80, '#f97316', 24);
            if (typeof spawnParticles === 'function')
                spawnParticles(window.player.x, window.player.y, 20, '#f97316');
            if (typeof addScreenShake === 'function') addScreenShake(8);
            if (typeof Audio !== 'undefined' && Audio.playAchievement) Audio.playAchievement();
        }

        // ══════════════════════════════════════════════════════
        // energy [amount]   — restore player energy
        // ══════════════════════════════════════════════════════
        else if (base === 'energy') {
            const amount = parseInt(args[1]) || 100;
            const maxE = window.player.maxEnergy || 100;
            const before = window.player.energy || 0;
            window.player.energy = Math.min(maxE, before + amount);
            const gained = Math.round(window.player.energy - before);
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine(`> Injecting ${gained} energy units...`, 'cline-info');
            _appendLine(`✔ Energy: ${Math.round(window.player.energy)}/${maxE}`, 'cline-ok');
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(`⚡+${gained} EN`, window.player.x, window.player.y - 70, '#a78bfa', 20);
            if (typeof spawnParticles === 'function')
                spawnParticles(window.player.x, window.player.y, 10, '#a78bfa');
        }

        // ══════════════════════════════════════════════════════
        // god / god off   — toggle invincibility  [ROOT only]
        // ══════════════════════════════════════════════════════
        else if (base === 'god') {
            if (sub === 'off' || _godMode) {
                _godMode = false;
                if (_godInterval) { clearInterval(_godInterval); _godInterval = null; }
                window.player._godMode = false;
                _appendLine('> Disabling GOD MODE...', 'cline-info');
                _appendLine('✔ Normal mortality restored.', 'cline-ok');
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('💀 GOD MODE OFF', window.player.x, window.player.y - 70, '#6b7280', 20);
            } else {
                _godMode = true;
                window.player._godMode = true;
                if (_godInterval) clearInterval(_godInterval);
                _godInterval = setInterval(() => {
                    if (!window.player || !window.player._godMode) {
                        clearInterval(_godInterval); _godInterval = null; return;
                    }
                    window.player.hp = window.player.maxHp || 110;
                    if (typeof window.player.maxEnergy !== 'undefined')
                        window.player.energy = window.player.maxEnergy;
                }, 200);
                _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
                _appendLine('> Patching damage handler → /dev/null...', 'cline-info');
                _appendLine('✔ GOD MODE ACTIVE  (type "god off" to disable)', 'cline-ok');
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('★ GOD MODE', window.player.x, window.player.y - 80, '#f97316', 26);
                if (typeof spawnParticles === 'function')
                    spawnParticles(window.player.x, window.player.y, 20, '#f97316');
                if (typeof addScreenShake === 'function') addScreenShake(8);
            }
        }

        // ══════════════════════════════════════════════════════
        // kill all   — instantly kill every enemy  [ROOT only]
        // ══════════════════════════════════════════════════════
        else if (base === 'kill' && sub === 'all') {
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine('> Broadcasting SIGKILL to all entities...', 'cline-info');
            const killed = _killAllEntities();
            _appendLine(`✔ ${killed} entit${killed === 1 ? 'y' : 'ies'} terminated.`, 'cline-ok');
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(`💀 ×${killed} KILLED`, window.player.x, window.player.y - 80, '#ef4444', 22);
            if (typeof addScreenShake === 'function') addScreenShake(10);
        }

        // ══════════════════════════════════════════════════════
        // speed [mult]   — set player move speed  [ROOT only]
        // ══════════════════════════════════════════════════════
        else if (base === 'speed') {
            const mult = parseFloat(args[1]);
            if (isNaN(mult) || mult <= 0 || mult > 10) {
                _appendLine('ERR: usage: speed <multiplier>  (0.1 – 10)', 'cline-error');
                return;
            }
            if (typeof window.player._origSpeed === 'undefined')
                window.player._origSpeed = window.player.moveSpeed;
            window.player.moveSpeed = window.player._origSpeed * mult;
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine(`> Patching moveSpeed → ×${mult}...`, 'cline-info');
            _appendLine(`✔ Speed set to ×${mult}  (base: ${window.player._origSpeed.toFixed(1)})`, 'cline-ok');
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(`💨 ×${mult} SPEED`, window.player.x, window.player.y - 70, '#22d3ee', 20);
            if (typeof spawnParticles === 'function')
                spawnParticles(window.player.x, window.player.y, 12, '#22d3ee');
        }

        // ══════════════════════════════════════════════════════
        // reset buffs   — clear all player buffs  [ROOT only]
        // ══════════════════════════════════════════════════════
        else if (base === 'reset' && sub === 'buffs') {
            const p = window.player;
            if (typeof p._origSpeed !== 'undefined') {
                p.moveSpeed = p._origSpeed;
                delete p._origSpeed;
            }
            if (_godMode) {
                _godMode = false; p._godMode = false;
                if (_godInterval) { clearInterval(_godInterval); _godInterval = null; }
            }
            if (typeof p.mtcDmgBuff !== 'undefined') p.mtcDmgBuff = 0;
            if (typeof p.mtcSpeedBuff !== 'undefined') p.mtcSpeedBuff = 0;
            if (typeof p.mtcBuffTimer !== 'undefined') p.mtcBuffTimer = 0;
            if (typeof p.damageBoost !== 'undefined') p.damageBoost = 0;
            if (typeof p.speedBoost !== 'undefined') p.speedBoost = 0;
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine('> Flushing all player buff registers...', 'cline-info');
            _appendLine('✔ All buffs cleared. Player state normalized.', 'cline-ok');
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText('🔄 BUFFS RESET', p.x, p.y - 70, '#34d399', 20);
        }

        // ══════════════════════════════════════════════════════
        // fps   — toggle FPS debug overlay
        // ══════════════════════════════════════════════════════
        else if (base === 'fps') {
            const overlay = document.getElementById('fps-overlay');
            if (overlay) {
                const visible = overlay.style.display !== 'none';
                overlay.style.display = visible ? 'none' : 'block';
                _appendLine(`✔ FPS overlay ${visible ? 'hidden' : 'shown'}.`, 'cline-ok');
            } else {
                const el = document.createElement('div');
                el.id = 'fps-overlay';
                el.style.cssText = [
                    'position:fixed', 'top:8px', 'right:8px', 'z-index:99999',
                    'background:rgba(0,0,0,0.65)', 'color:#00ff41',
                    'font:bold 11px/1 "Courier New",monospace',
                    'padding:4px 8px', 'border-radius:4px',
                    'border:1px solid #003d10', 'pointer-events:none',
                    'letter-spacing:1px'
                ].join(';');
                document.body.appendChild(el);
                let lastTime = performance.now(), frames = 0;
                const loop = () => {
                    frames++;
                    const now = performance.now();
                    if (now - lastTime >= 500) {
                        el.textContent = `FPS: ${Math.round(frames * 1000 / (now - lastTime))}`;
                        frames = 0; lastTime = now;
                    }
                    if (el.isConnected) requestAnimationFrame(loop);
                };
                requestAnimationFrame(loop);
                _appendLine('✔ FPS overlay created and active.', 'cline-ok');
            }
        }

        // ══════════════════════════════════════════════════════
        // info   — show current game state snapshot
        // ══════════════════════════════════════════════════════
        else if (base === 'info') {
            const p = window.player;
            const wave = typeof getWave === 'function' ? getWave() : (window.wave || '?');
            const score = typeof getScore === 'function' ? getScore() : (window.score || 0);
            const enemyCnt = (window.enemies || []).filter(e => e && !e.dead).length;
            const bossAlive = window.boss && !window.boss.dead;
            const permLvl = _getPermLevel();
            _appendLine('> Querying game state...', 'cline-info');
            const infoLines = [
                `  Wave      : ${wave}`,
                `  Score     : ${score.toLocaleString()}`,
                `  HP        : ${Math.round(p.hp)}/${p.maxHp || 110}`,
                `  Energy    : ${Math.round(p.energy || 0)}/${p.maxEnergy || 100}`,
                `  Speed     : ${p.moveSpeed?.toFixed(2) ?? '?'}`,
                `  Enemies   : ${enemyCnt} alive`,
                `  Boss      : ${bossAlive ? (window.boss.constructor?.name || 'ACTIVE') : 'none'}`,
                `  God Mode  : ${_godMode ? 'ON ★' : 'off'}`,
                `  Perm Level: ${PERM_LABEL[permLvl].badge} ${PERM_LABEL[permLvl].text}`,
                `  GameState : ${window.gameState || '?'}`,
            ];
            infoLines.forEach((l, i) => setTimeout(() => _appendLine(l, 'cline-ok', true), i * 25));
        }

        // ══════════════════════════════════════════════════════
        // help
        // ══════════════════════════════════════════════════════
        else if (base === 'help') {
            const pLvl = _getPermLevel();
            const helpLines = [
                '┌─────────────────────────────────────────────────────┐',
                '│  MTC SERVER — AVAILABLE COMMANDS                    │',
                '├──────────────────────────┬──────────────────────────┤',
                '│  heal [amount]           │  Restore HP  (def:100)  │',
                '│  score [amount]          │  Add score (def:5000)   │',
                '│  energy [amount]         │  Restore energy (100)   │',
                '│  next wave               │  Force next wave        │',
                '│  set wave <num>          │  Jump to wave number    │',
                '│  give weapon <n>         │  Equip a weapon         │',
                '│  spawn manop [1|2|3]     │  Kru Manop + phase      │',
                '│  spawn first [advanced]  │  Kru First + variant    │',
                '│  info                    │  Show game state info   │',
                '│  fps                     │  Toggle FPS overlay     │',
                '│  devbuff                 │  Apply dev stat package │',
                '│  clear / exit            │  Clear / close console  │',
                '├──────────────────────────┴──────────────────────────┤',
                pLvl >= PERM.ROOT ? '│  ★ god / god off    │  Toggle invincibility      │'
                    : '│  ★ god              │  [LOCKED — ROOT only]      │',
                pLvl >= PERM.ROOT ? '│  ★ speed <mult>     │  Set move speed mult       │'
                    : '│  ★ speed            │  [LOCKED — ROOT only]      │',
                pLvl >= PERM.ROOT ? '│  ★ kill all         │  Kill all enemies          │'
                    : '│  ★ kill all         │  [LOCKED — ROOT only]      │',
                pLvl >= PERM.ROOT ? '│  ★ reset buffs      │  Clear all player buffs    │'
                    : '│  ★ reset buffs      │  [LOCKED — ROOT only]      │',
                '├─────────────────────────────────────────────────────┤',
                '│  [Tab] = auto-complete    [↑↓] = history            │',
                '└─────────────────────────────────────────────────────┘',
            ];
            helpLines.forEach((l, i) => {
                const cls = (l.includes('★') && pLvl < PERM.ROOT) ? 'cline-sys' : 'cline-info';
                setTimeout(() => _appendLine(l, cls, true), i * 30);
            });
        }

        // ══════════════════════════════════════════════════════
        // clear
        // ══════════════════════════════════════════════════════
        else if (base === 'clear') {
            const out = document.getElementById('console-output');
            if (out) out.innerHTML = '';
        }

        // ══════════════════════════════════════════════════════
        // exit / quit / q
        // ══════════════════════════════════════════════════════
        else if (base === 'exit' || base === 'quit' || base === 'q') {
            _appendLine(GAME_TEXTS.admin.closingSession, 'cline-info');
            setTimeout(() => closeAdminConsole(), 500);
        }

        // ══════════════════════════════════════════════════════
        // Easter eggs — kept from original
        // ══════════════════════════════════════════════════════
        else if (trimmed.toLowerCase() === 'sudo rm -rf /' || trimmed.toLowerCase() === 'sudo rm -rf *') {
            _appendLine(GAME_TEXTS.admin.niceTry, 'cline-warn');
            _appendLine(GAME_TEXTS.admin.accessDenied, 'cline-error');
        }
        else if (base === 'whoami') {
            const pLvl = _getPermLevel();
            const pInfo = PERM_LABEL[pLvl];
            _appendLine(GAME_TEXTS.admin.whoami, 'cline-ok');
            _appendLine(`  Permission: ${pInfo.badge} ${pInfo.text}`, 'cline-ok', true);
        }
        else if (base === 'ls') {
            GAME_TEXTS.admin.lsEntries.forEach(e => _appendLine(e.text, e.cls, true));
        }
        else if (base === 'cat' && sub === 'kru_manop_passwords.txt') {
            _appendLine(GAME_TEXTS.admin.catPassword, 'cline-ok');
            _appendLine(GAME_TEXTS.admin.catPasswordWarn, 'cline-warn');
        }
        else if (trimmed.toLowerCase() === 'sudo make me a sandwich') {
            _appendLine(GAME_TEXTS.admin.sandwich, 'cline-warn');
        }

        // ══════════════════════════════════════════════════════
        // Legacy "sudo" prefix — route to new parser without it
        // ══════════════════════════════════════════════════════
        else if (base === 'sudo') {
            const withoutSudo = args.slice(1).join(' ');
            if (withoutSudo) {
                _appendLine('> Stripping deprecated "sudo" prefix...', 'cline-warn', true);
                _parse(withoutSudo);
            } else {
                _appendLine(GAME_TEXTS.admin.sudoAccessDenied, 'cline-error');
            }
        }

        // ══════════════════════════════════════════════════════
        // Unknown command
        // ══════════════════════════════════════════════════════
        else {
            _appendLine(GAME_TEXTS.admin.cmdNotFound(raw), 'cline-error');
            _appendLine(GAME_TEXTS.admin.typeHelp, 'cline-info');
        }
    }

    // ─────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────
    return {
        open() {
            if (isOpen) return;
            isOpen = true;
            _cmdCount = 0;

            const modal = document.getElementById('admin-console');
            const inner = document.getElementById('console-inner');
            const input = document.getElementById('console-input');
            const prompt = document.getElementById('console-prompt');

            if (modal) modal.style.display = 'flex';
            if (prompt) prompt.style.display = 'none';

            requestAnimationFrame(() => {
                if (inner) inner.classList.add('console-visible');
            });

            _updatePermBadge();

            // Inject perm badge into titlebar if not already in HTML
            const titlebar = document.querySelector('.console-titlebar-left');
            if (titlebar && !document.getElementById('console-perm-badge')) {
                const badge = document.createElement('span');
                badge.id = 'console-perm-badge';
                titlebar.appendChild(badge);
            }
            _updatePermBadge();

            _appendLine(GAME_TEXTS.admin.sessionWelcome, 'cline-ok');
            _appendLine(GAME_TEXTS.admin.sessionHelp, 'cline-info');

            if (input) {
                input.value = '';
                setTimeout(() => input.focus(), 120);

                input._onKeydown = (e) => {
                    e.stopPropagation();

                    // ── Tab auto-complete ──────────────────────
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const val = input.value.toLowerCase();
                        const matches = COMMANDS.filter(c => c.startsWith(val));

                        if (matches.length === 0) {
                            _appendLine(`> No completions for "${input.value}"`, 'cline-warn', true);
                        } else if (matches.length === 1) {
                            input.value = matches[0];
                        } else {
                            // Show all matches on one line, instant
                            _appendLine(matches.join('   '), 'cline-info', true);
                            // Complete the longest common prefix
                            let prefix = matches[0];
                            for (const m of matches) {
                                let i = 0;
                                while (i < prefix.length && i < m.length && prefix[i] === m[i]) i++;
                                prefix = prefix.slice(0, i);
                            }
                            if (prefix.length > val.length) input.value = prefix;
                        }
                        return;
                    }

                    // ── Enter — submit ─────────────────────────
                    if (e.key === 'Enter') {
                        const val = input.value;
                        input.value = '';
                        _parse(val);
                        histIdx = -1;

                        // ── Escape — close ─────────────────────────
                    } else if (e.key === 'Escape') {
                        closeAdminConsole();

                        // ── Arrow Up — history back ────────────────
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (histIdx < history.length - 1) {
                            histIdx++;
                            input.value = history[histIdx] || '';
                        }

                        // ── Arrow Down — history forward ───────────
                    } else if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (histIdx > 0) {
                            histIdx--;
                            input.value = history[histIdx] || '';
                        } else {
                            histIdx = -1;
                            input.value = '';
                        }
                    }
                };
                input.addEventListener('keydown', input._onKeydown);
            }

            if (typeof spawnFloatingText === 'function' && window.player)
                spawnFloatingText(GAME_TEXTS.admin.terminal, window.player.x, window.player.y - 70, '#00ff41', 20);
            if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
        },

        close() {
            if (!isOpen) return;
            isOpen = false;

            const modal = document.getElementById('admin-console');
            const inner = document.getElementById('console-inner');
            const input = document.getElementById('console-input');

            if (input && input._onKeydown) {
                input.removeEventListener('keydown', input._onKeydown);
                input._onKeydown = null;
            }

            if (inner) inner.classList.remove('console-visible');
            setTimeout(() => {
                if (modal) modal.style.display = 'none';
            }, 220);
        },

        get isOpen() { return isOpen; },

        addLine(text, cls = 'cline-info') { _appendLine(text, cls); }
    };
})();

window.AdminConsole = AdminConsole;

function openAdminConsole() {
    if (window.gameState !== 'PLAYING') return;

    // ── Admin Authentication Gate ──────────────────────────────────────────
    // เฉพาะผู้สร้างที่ผ่าน Secret Keylogger มาแล้วเท่านั้นถึงจะเข้าได้
    if (!window.isAdmin) {
        if (typeof spawnFloatingText === 'function' && window.player) {
            spawnFloatingText('⛔ ACCESS DENIED', window.player.x, window.player.y - 70, '#ef4444', 22);
            spawnFloatingText('AUTHORIZATION REQUIRED', window.player.x, window.player.y - 100, '#fca5a5', 14);
        }
        if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
        console.log('%c[MTC Admin] ⛔ Access denied — Developer Mode not active.', 'color:#ef4444;');
        return;
    }

    setGameState('PAUSED');
    AdminConsole.open();
    Audio.pauseBGM();
    console.log('%c[MTC Admin] ✅ Admin Console opened.', 'color:#22c55e; font-weight:bold;');
    window.focus();
}

function closeAdminConsole() {
    AdminConsole.close();
    if (window.gameState === 'PAUSED') setGameState('PLAYING');
    showResumePrompt(false);
    Audio.resumeBGM();

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0; keys.f = 0;

    window.focus();

    if (typeof spawnFloatingText === 'function' && window.player)
        spawnFloatingText(GAME_TEXTS.admin.resumed, window.player.x, window.player.y - 50, '#34d399', 18);
}

window.openAdminConsole = openAdminConsole;
window.closeAdminConsole = closeAdminConsole;

// ══════════════════════════════════════════════════════════════
// DATABASE / PAUSE HELPERS
// ══════════════════════════════════════════════════════════════

function showResumePrompt(visible) {
    const el = document.getElementById('resume-prompt');
    const strip = document.getElementById('pause-indicator');
    if (el) el.style.display = visible ? 'flex' : 'none';
    if (strip) strip.style.display = visible ? 'block' : 'none';
}

function openExternalDatabase() {
    if (window.gameState !== 'PLAYING') return;
    setGameState('PAUSED');

    window.open(MTC_DB_URL, '_blank');
    showResumePrompt(true);

    const promptEl = document.getElementById('db-prompt');
    if (promptEl) promptEl.style.display = 'none';

    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    if (player) spawnFloatingText(GAME_TEXTS.admin.database, player.x, player.y - 60, '#06b6d4', 22);
}

function resumeGame() {
    if (window.gameState !== 'PAUSED') return;
    if (AdminConsole.isOpen) { closeAdminConsole(); return; }
    setGameState('PLAYING');

    showResumePrompt(false);

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0; keys.f = 0;

    window.focus();

    if (player) spawnFloatingText(GAME_TEXTS.admin.resumed, player.x, player.y - 50, '#34d399', 18);
}

function openDatabase() { openExternalDatabase(); }
function showMathModal() { openExternalDatabase(); }
function closeMathModal() { resumeGame(); }

window.openExternalDatabase = openExternalDatabase;
window.openDatabase = openDatabase;
window.resumeGame = resumeGame;
window.showResumePrompt = showResumePrompt;
window.showMathModal = showMathModal;
window.closeMathModal = closeMathModal;

window.addEventListener('blur', () => {
    if (window.gameState === 'PLAYING') {
        setGameState('PAUSED');
        const shopModal = document.getElementById('shop-modal');
        const shopOpen = shopModal && shopModal.style.display === 'flex';
        const consoleOpen = AdminConsole.isOpen;
        if (!shopOpen && !consoleOpen) showResumePrompt(true);
    }
});

window.addEventListener('focus', () => {
    // ❌ ไม่ auto-resume เมื่อ window focus กลับมา
    // ผู้เล่นต้องกด Resume เองเสมอ เพื่อป้องกันเกมรันขณะที่ shop/database ยังเปิดอยู่
    if (window.gameState === 'PAUSED') {
        const shopModal = document.getElementById('shop-modal');
        const shopOpen = shopModal && shopModal.style.display === 'flex';
        const consoleOpen = AdminConsole.isOpen;
        if (!shopOpen && !consoleOpen) showResumePrompt(true);
    }
});

// ══════════════════════════════════════════════════════════════
// DATABASE SERVER — DRAW + PROXIMITY UI
// ══════════════════════════════════════════════════════════════

function drawDatabaseServer() {
    const screen = worldToScreen(MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const t = performance.now() / 600;
    const glow = Math.abs(Math.sin(t)) * 0.5 + 0.5;

    if (player) {
        const d = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
        if (d < MTC_DATABASE_SERVER.INTERACTION_RADIUS * 2) {
            const alpha = Math.max(0, 1 - d / (MTC_DATABASE_SERVER.INTERACTION_RADIUS * 2));
            CTX.save();
            CTX.globalAlpha = alpha * 0.25 * glow;
            CTX.strokeStyle = '#06b6d4';
            CTX.lineWidth = 2;
            CTX.setLineDash([6, 4]);
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, MTC_DATABASE_SERVER.INTERACTION_RADIUS, 0, Math.PI * 2);
            CTX.stroke();
            CTX.setLineDash([]);
            CTX.restore();
        }
    }

    CTX.fillStyle = 'rgba(0,0,0,0.35)';
    CTX.beginPath();
    CTX.ellipse(screen.x, screen.y + 28, 18, 7, 0, 0, Math.PI * 2);
    CTX.fill();

    CTX.save();
    CTX.translate(screen.x, screen.y);
    CTX.shadowBlur = 14 * glow;
    CTX.shadowColor = '#06b6d4';

    CTX.fillStyle = '#0c1a2e';
    CTX.strokeStyle = '#06b6d4';
    CTX.lineWidth = 2;
    CTX.beginPath();
    CTX.roundRect(-18, -26, 36, 50, 5);
    CTX.fill();
    CTX.stroke();

    for (let i = 0; i < 3; i++) {
        CTX.fillStyle = '#0f2744';
        CTX.fillRect(-14, -20 + i * 14, 28, 10);

        CTX.fillStyle = i === 0 ? '#22c55e' : '#0e7490';
        CTX.fillRect(-12, -18 + i * 14, 10, 6);

        CTX.fillStyle = i === 1 ? `rgba(6,182,212,${glow})` : '#22c55e';
        CTX.shadowBlur = 6;
        CTX.shadowColor = i === 1 ? '#06b6d4' : '#22c55e';
        CTX.beginPath();
        CTX.arc(10, -15 + i * 14, 3.5, 0, Math.PI * 2);
        CTX.fill();
    }

    const tGlow = Math.abs(Math.sin(performance.now() / 400)) * 0.6 + 0.4;
    CTX.fillStyle = `rgba(0,255,65,${tGlow})`;
    CTX.shadowBlur = 8;
    CTX.shadowColor = '#00ff41';
    CTX.beginPath();
    CTX.arc(-10, 15, 3, 0, Math.PI * 2);
    CTX.fill();

    CTX.shadowBlur = 0;
    CTX.fillStyle = '#67e8f9';
    CTX.font = 'bold 7px Arial';
    CTX.textAlign = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText('MTC DATABASE', 0, 33);

    CTX.restore();
}

function updateDatabaseServerUI() {
    if (!player) return;
    const d = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const near = d < MTC_DATABASE_SERVER.INTERACTION_RADIUS;

    const promptEl = document.getElementById('db-prompt');
    const hudIcon = document.getElementById('db-hud-icon');
    const btnDb = document.getElementById('btn-database');
    const consolePrompt = document.getElementById('console-prompt');
    const consoleHud = document.getElementById('console-hud-icon');
    const btnTerminal = document.getElementById('btn-terminal');

    if (promptEl) promptEl.style.display = near ? 'block' : 'none';
    if (hudIcon) hudIcon.style.display = near ? 'flex' : 'none';
    if (btnDb) btnDb.style.display = near ? 'flex' : 'none';
    if (consolePrompt) consolePrompt.style.display = near ? 'block' : 'none';
    if (consoleHud) consoleHud.style.display = near ? 'flex' : 'none';
    if (btnTerminal) btnTerminal.style.display = near ? 'flex' : 'none';
}

window.drawDatabaseServer = drawDatabaseServer;
window.updateDatabaseServerUI = updateDatabaseServerUI;
window.MTC_DB_URL = MTC_DB_URL;