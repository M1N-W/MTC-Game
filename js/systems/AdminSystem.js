'use strict';

// ══════════════════════════════════════════════════════════════
// 💻 ADMIN SYSTEM (extracted from game.js)
// ══════════════════════════════════════════════════════════════

// ─── MTC Database Server ──────────────────────────────────────
const MTC_DATABASE_SERVER = {
    x: 350,
    y: -350,
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
    let histIdx   = -1;
    let isOpen    = false;

    const CHAR_DELAY = 18;

    // ── Available commands for Tab auto-complete ───────────────
    const COMMANDS = [
        'heal', 'score', 'next wave', 'set wave', 'give weapon',
        'spawn manop', 'spawn first', 'clear', 'help', 'exit',
        // Easter egg commands kept for discoverability
        'whoami', 'ls', 'ls -la', 'cat kru_manop_passwords.txt',
        'sudo make me a sandwich', 'sudo rm -rf /'
    ];

    // ─────────────────────────────────────────────────────────
    // TYPING ANIMATION OUTPUT
    // ─────────────────────────────────────────────────────────
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

        _appendLine('root@mtcserver:~# ' + raw, 'cline-cmd', true);

        history.unshift(raw);
        histIdx = -1;

        // Split into tokens for arg parsing
        const args    = trimmed.toLowerCase().split(/\s+/);
        const base    = args[0];          // first token
        const sub     = args[1] || '';    // second token
        const rest    = args.slice(2);    // remainder

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
            const amount  = parseInt(args[1]) || 100;
            const maxHp   = window.player.maxHp || 110;
            const before  = window.player.hp;
            window.player.hp = Math.min(maxHp, window.player.hp + amount);
            const gained  = Math.round(window.player.hp - before);
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
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine(`> Patching wave counter → ${num}...`, 'cline-info');
            // Set wave to num-1 so WaveManager increments to num on next transition
            if (typeof setWave === 'function') {
                setWave(num - 1);
            } else if (typeof window.wave !== 'undefined') {
                window.wave = num - 1;
            }
            const killed = _killAllEntities();
            _appendLine(`> SIGKILL sent to ${killed} entit${killed === 1 ? 'y' : 'ies'}.`, 'cline-info');
            _appendLine(`✔ Wave will advance to ${num} on next cycle.`, 'cline-ok');
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
        // spawn manop  — summons Kru Manop (Boss)
        // ══════════════════════════════════════════════════════
        else if (base === 'spawn' && sub === 'manop') {
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine('> Allocating Boss entity: KRU MANOP...', 'cline-info');
            if (typeof Boss === 'undefined') {
                _appendLine('ERR: Boss class not found. Is boss.js loaded?', 'cline-error');
                return;
            }
            const difficulty = Math.max(1, Math.floor((typeof getWave === 'function' ? getWave() : (window.wave || 1)) / 3));
            if (window.boss && !window.boss.dead) {
                _appendLine('WARN: existing boss detected — overwriting reference.', 'cline-warn', true);
            }
            window.boss = new Boss(difficulty, false, false);
            _appendLine(`✔ Boss "KRU MANOP" spawned (difficulty ×${difficulty}).`, 'cline-ok');
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText('🐕 KRU MANOP APPEARS!', window.player.x, window.player.y - 80, '#ef4444', 26);
            if (typeof addScreenShake === 'function') addScreenShake(20);
            if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
            setTimeout(() => closeAdminConsole(), 1200);
        }

        // ══════════════════════════════════════════════════════
        // spawn first  — summons Kru First (BossFirst)
        // ══════════════════════════════════════════════════════
        else if (base === 'spawn' && sub === 'first') {
            _appendLine(GAME_TEXTS.admin.authOk, 'cline-info');
            _appendLine('> Allocating BossFirst entity: KRU FIRST...', 'cline-info');
            if (typeof BossFirst === 'undefined') {
                _appendLine('ERR: BossFirst class not found. Is boss.js loaded?', 'cline-error');
                return;
            }
            const difficulty = Math.max(1, Math.floor((typeof getWave === 'function' ? getWave() : (window.wave || 1)) / 3));
            if (window.boss && !window.boss.dead) {
                _appendLine('WARN: existing boss detected — overwriting reference.', 'cline-warn', true);
            }
            window.boss = new BossFirst(difficulty, false);
            _appendLine(`✔ Boss "KRU FIRST" spawned (difficulty ×${difficulty}).`, 'cline-ok');
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText('⚛️ KRU FIRST APPEARS!', window.player.x, window.player.y - 80, '#38bdf8', 26);
            if (typeof addScreenShake === 'function') addScreenShake(20);
            if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
            setTimeout(() => closeAdminConsole(), 1200);
        }

        // ══════════════════════════════════════════════════════
        // help
        // ══════════════════════════════════════════════════════
        else if (base === 'help') {
            const helpLines = [
                '┌─────────────────────────────────────────────────┐',
                '│  MTC SERVER — AVAILABLE COMMANDS                │',
                '├──────────────────────┬──────────────────────────┤',
                '│  heal [amount]       │  Restore HP (def: 100)  │',
                '│  score [amount]      │  Add score (def: 5000)  │',
                '│  next wave           │  Force next wave        │',
                '│  set wave <num>      │  Jump to wave number    │',
                '│  give weapon <name>  │  Equip a weapon         │',
                '│  spawn manop         │  Summon Kru Manop       │',
                '│  spawn first         │  Summon Kru First       │',
                '│  clear               │  Clear console output   │',
                '│  help                │  Show this table        │',
                '│  exit                │  Close console          │',
                '├──────────────────────┴──────────────────────────┤',
                '│  [Tab] = auto-complete   [↑↓] = history        │',
                '└─────────────────────────────────────────────────┘',
            ];
            helpLines.forEach((l, i) => {
                setTimeout(() => _appendLine(l, 'cline-info', true), i * 35);
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
            _appendLine(GAME_TEXTS.admin.whoami, 'cline-ok');
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

            const modal  = document.getElementById('admin-console');
            const inner  = document.getElementById('console-inner');
            const input  = document.getElementById('console-input');
            const prompt = document.getElementById('console-prompt');

            if (modal)  modal.style.display  = 'flex';
            if (prompt) prompt.style.display = 'none';

            requestAnimationFrame(() => {
                if (inner) inner.classList.add('console-visible');
            });

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
                        const val     = input.value.toLowerCase();
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
    setGameState('PAUSED');
    AdminConsole.open();
    Audio.pauseBGM();
    console.log('Admin Console opened');
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

window.openAdminConsole  = openAdminConsole;
window.closeAdminConsole = closeAdminConsole;

// ══════════════════════════════════════════════════════════════
// DATABASE / PAUSE HELPERS
// ══════════════════════════════════════════════════════════════

function showResumePrompt(visible) {
    const el    = document.getElementById('resume-prompt');
    const strip = document.getElementById('pause-indicator');
    if (el)    el.style.display    = visible ? 'flex'  : 'none';
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

function openDatabase()   { openExternalDatabase(); }
function showMathModal()  { openExternalDatabase(); }
function closeMathModal() { resumeGame(); }

window.openExternalDatabase = openExternalDatabase;
window.openDatabase         = openDatabase;
window.resumeGame           = resumeGame;
window.showResumePrompt     = showResumePrompt;
window.showMathModal        = showMathModal;
window.closeMathModal       = closeMathModal;

window.addEventListener('blur', () => {
    if (window.gameState === 'PLAYING') {
        setGameState('PAUSED');
        const shopModal   = document.getElementById('shop-modal');
        const shopOpen    = shopModal && shopModal.style.display === 'flex';
        const consoleOpen = AdminConsole.isOpen;
        if (!shopOpen && !consoleOpen) showResumePrompt(true);
    }
});

window.addEventListener('focus', () => {
    // ❌ ไม่ auto-resume เมื่อ window focus กลับมา
    // ผู้เล่นต้องกด Resume เองเสมอ เพื่อป้องกันเกมรันขณะที่ shop/database ยังเปิดอยู่
    if (window.gameState === 'PAUSED') {
        const shopModal   = document.getElementById('shop-modal');
        const shopOpen    = shopModal && shopModal.style.display === 'flex';
        const consoleOpen = AdminConsole.isOpen;
        if (!shopOpen && !consoleOpen) showResumePrompt(true);
    }
});

// ══════════════════════════════════════════════════════════════
// DATABASE SERVER — DRAW + PROXIMITY UI
// ══════════════════════════════════════════════════════════════

function drawDatabaseServer() {
    const screen = worldToScreen(MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const t    = performance.now() / 600;
    const glow = Math.abs(Math.sin(t)) * 0.5 + 0.5;

    if (player) {
        const d = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
        if (d < MTC_DATABASE_SERVER.INTERACTION_RADIUS * 2) {
            const alpha = Math.max(0, 1 - d / (MTC_DATABASE_SERVER.INTERACTION_RADIUS * 2));
            CTX.save();
            CTX.globalAlpha = alpha * 0.25 * glow;
            CTX.strokeStyle = '#06b6d4';
            CTX.lineWidth   = 2;
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
    CTX.shadowBlur  = 14 * glow;
    CTX.shadowColor = '#06b6d4';

    CTX.fillStyle   = '#0c1a2e';
    CTX.strokeStyle = '#06b6d4';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.roundRect(-18, -26, 36, 50, 5);
    CTX.fill();
    CTX.stroke();

    for (let i = 0; i < 3; i++) {
        CTX.fillStyle = '#0f2744';
        CTX.fillRect(-14, -20 + i * 14, 28, 10);

        CTX.fillStyle = i === 0 ? '#22c55e' : '#0e7490';
        CTX.fillRect(-12, -18 + i * 14, 10, 6);

        CTX.fillStyle   = i === 1 ? `rgba(6,182,212,${glow})` : '#22c55e';
        CTX.shadowBlur  = 6;
        CTX.shadowColor = i === 1 ? '#06b6d4' : '#22c55e';
        CTX.beginPath();
        CTX.arc(10, -15 + i * 14, 3.5, 0, Math.PI * 2);
        CTX.fill();
    }

    const tGlow = Math.abs(Math.sin(performance.now() / 400)) * 0.6 + 0.4;
    CTX.fillStyle   = `rgba(0,255,65,${tGlow})`;
    CTX.shadowBlur  = 8;
    CTX.shadowColor = '#00ff41';
    CTX.beginPath();
    CTX.arc(-10, 15, 3, 0, Math.PI * 2);
    CTX.fill();

    CTX.shadowBlur   = 0;
    CTX.fillStyle    = '#67e8f9';
    CTX.font         = 'bold 7px Arial';
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText('MTC DATABASE', 0, 33);

    CTX.restore();
}

function updateDatabaseServerUI() {
    if (!player) return;
    const d    = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const near = d < MTC_DATABASE_SERVER.INTERACTION_RADIUS;

    const promptEl      = document.getElementById('db-prompt');
    const hudIcon       = document.getElementById('db-hud-icon');
    const btnDb         = document.getElementById('btn-database');
    const consolePrompt = document.getElementById('console-prompt');
    const consoleHud    = document.getElementById('console-hud-icon');
    const btnTerminal   = document.getElementById('btn-terminal');

    if (promptEl)      promptEl.style.display     = near ? 'block' : 'none';
    if (hudIcon)       hudIcon.style.display       = near ? 'flex'  : 'none';
    if (btnDb)         btnDb.style.display         = near ? 'flex'  : 'none';
    if (consolePrompt) consolePrompt.style.display = near ? 'block' : 'none';
    if (consoleHud)    consoleHud.style.display    = near ? 'flex'  : 'none';
    if (btnTerminal)   btnTerminal.style.display   = near ? 'flex'  : 'none';
}

window.drawDatabaseServer     = drawDatabaseServer;
window.updateDatabaseServerUI = updateDatabaseServerUI;
window.MTC_DB_URL             = MTC_DB_URL;