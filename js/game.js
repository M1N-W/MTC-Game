'use strict';

// ─── Debug Flag (WARN 2 FIX) ──────────────────────────────────
// Set to true locally to enable verbose frame diagnostics.
// Never commit as true — the console.log in drawGame fires every 5s
// at 60fps and creates unnecessary GC pressure in production.
const DEBUG_MODE = false;

/**
 * 🎮 MTC: ENHANCED EDITION - Main Game Loop (REFACTORED)
 * Handles: Game state, wave management, input, camera, shop, admin
 *          console, bullet time, database server, and the core loop.
 *
 * ────────────────────────────────────────────────────────────────
 * ARCHITECTURE NOTES (Stability Overhaul)
 * ────────────────────────────────────────────────────────────────
 * ✅ Boss   class → MOVED to entities.js (eliminates split-brain)
 * ✅ BarkWave class → MOVED to entities.js
 * ✅ lerp / dist / rand / clamp / etc. → LIVE in utils.js (no redefinitions here)
 * ✅ SHOP_ITEMS / BALANCE / LIGHTING → LIVE in config.js (read-only here)
 * ✅ showVoiceBubble() → globalised in utils.js (map.js crash fixed)
 * ✅ lerpColorHex / hexToRgb → LIVE in utils.js (duplicate in ui.js removed)
 * ✅ _roundRectPath() kept here — small canvas helper used only by drawSlowMoOverlay
 *
 * LOAD ORDER (index.html must follow this):
 *   config.js → utils.js → audio.js → effects.js → weapons.js → map.js → ui.js → ai.js → entities.js → input.js → game.js
 *
 * ────────────────────────────────────────────────────────────────
 * FEATURE LOG
 * ────────────────────────────────────────────────────────────────
 * v10 — Bullet Time
 *   • 'T' key toggles slow-motion (timeScale = 0.30) globally
 *   • slowMoEnergy drains while active; recharges when off
 *   • Auto-deactivates on empty tank; blocked below 5 %
 *   • drawSlowMoOverlay(): radial vignette, chromatic aberration,
 *     letterbox bars, animated BULLET TIME badge + energy bar,
 *     clock-tick particle burst around player
 *   • _tickSlowMoEnergy(realDt) uses unscaled dt so drain/recharge
 *     is always wall-clock speed regardless of timeScale
 *
 * v9  — Admin Console ('F' near server)
 *   • CRT/hacker terminal aesthetic  (#admin-console overlay)
 *   • Commands: sudo heal / sudo score / sudo next / help / clear / exit
 *   • Typed-print effect; up-arrow command history
 *   • Input field steals keyboard focus — game hotkeys suppressed
 *   • Easter eggs: ls, whoami, sudo rm -rf /, cat kru_manop_passwords.txt
 *
 * v4  — Shop ('B' near kiosk)
 *   • MTC_SHOP_LOCATION fixed world position
 *   • openShop() → gameState = 'PAUSED', ShopManager.open()
 *   • buyItem(itemId) — deducts score, applies timed/instant effect
 *   • Shopaholic achievement via Achievements.stats.shopPurchases
 *
 * v3  — Database ('E' near server)
 *   • MTC_DATABASE_SERVER fixed world position
 *   • gameState = 'PAUSED' when DB or admin console is open
 *   • resumeGame() restores 'PLAYING', resets keys
 *
 * v5  — Engineering Drone
 *   • window.drone created in startGame(); nullified in endGame()
 *   • updateGame() → drone.update(dt, player)
 *   • drawGame()   → drone.draw() between map objects and player
 *
 * v6/v7 — Boss Dog Rider (Boss class now in entities.js)
 *   • bossEncounterCount drives isRider flag
 *   • Encounter 1 → plain Boss; Encounter 2+ → Dog Rider
 *
 * v8  — View Culling & Particle Cap
 *   • Enemy/boss/powerup draw guarded by entity.isOnScreen(buffer)
 *   • ParticleSystem hard cap 150 (managed in effects.js)
 *
 * FIXES (QA Integrity Report):
 * ✅ BUG 1:  mapSystem.update() now receives scaled dt so MTCRoom heals correctly.
 * ✅ WARN 1: weatherSystem.update() and weatherSystem.draw() wired into the loop.
 * ✅ WARN 2: Diagnostic console.log gated behind DEBUG_MODE flag.
 */

// ─── Game State ───────────────────────────────────────────────
let gameState   = 'MENU';
let loopRunning = false;

// ✅ เพิ่มบรรทัดนี้เพื่อให้ Debug ง่ายขึ้น
window.gameState = gameState;

// keys, mouse, touchJoystickLeft/Right — defined in input.js (loaded before game.js)
// InputSystem.init() is called from window.onload below.

// ─── 🕐 Bullet Time — global time-scale system ───────────────
let timeScale    = 1.0;   // multiplier applied to dt each frame
let isSlowMotion = false; // current toggle state
let slowMoEnergy = 1.0;   // 0.0 = empty · 1.0 = full

const SLOW_MO_TIMESCALE     = 0.30;   // world at 30 % speed when active
const SLOW_MO_DRAIN_RATE    = 0.14;   // empties in ~7 real seconds
const SLOW_MO_RECHARGE_RATE = 0.07;   // refills in ~14 real seconds

// Energy bar dimensions (used in drawSlowMoOverlay HUD badge)
const SM_BAR_W = 180, SM_BAR_H = 8;

// ─── HUD Draw Bridge ──────────────────────────────────────────
// drawGame() is a pure render function with no dt parameter.
// We cache each frame's scaledDt here so UIManager.draw() can
// receive it for combo-timer animation without changing the call
// signature of drawGame() anywhere else in the codebase.
let _lastDrawDt = 0;

// ─── Day / Night cycle ────────────────────────────────────────
let dayNightTimer = 0;

// ─── ⚡ Glitch Wave ───────────────────────────────────────────
// Activates on every 5th wave (wave 5, 10, 15 …).
// isGlitchWave  — set true by startNextWave, cleared on next wave start
// glitchIntensity — animated 0→1 ramp; drawGlitchEffect uses this
// controlsInverted — W↔S and A↔D are swapped while true
let isGlitchWave     = false;
let glitchIntensity  = 0;
let controlsInverted = false;
const GLITCH_EVERY_N_WAVES = 5;

// ─── ⚡ Glitch Wave — Spawn Grace Period ──────────────────────
// waveSpawnLocked    — true while the pre-spawn countdown is running
// waveSpawnTimer     — seconds remaining until enemy spawn is released
// pendingSpawnCount  — total enemies queued, released when timer expires
// lastGlitchCountdown— last whole-second milestone already announced
//                      (prevents duplicate floating-text on same second)
let waveSpawnLocked     = false;
let waveSpawnTimer      = 0;
let pendingSpawnCount   = 0;
let lastGlitchCountdown = -1;

// ─── Game Objects (global) ────────────────────────────────────
window.player         = null;
window.enemies        = [];
window.boss           = null;
window.powerups       = [];
window.specialEffects = [];
window.meteorZones    = [];
window.drone          = null;
let waveStartDamage   = 0;

// ─── Boss Progression Counter ─────────────────────────────────
let bossEncounterCount = 0;

// ─── MTC Database Server ──────────────────────────────────────
const MTC_DATABASE_SERVER = {
    x: 350,
    y: -350,
    INTERACTION_RADIUS: 90
};

// ─── MTC Shop Location ────────────────────────────────────────
const MTC_SHOP_LOCATION = {
    x: -350,
    y:  350,
    INTERACTION_RADIUS: 90
};

// ── 🔴 MINIMAP FIX: expose both locations to window so UIManager.drawMinimap()
//    can read them via window.MTC_DATABASE_SERVER / window.MTC_SHOP_LOCATION.
//    `const` declarations do NOT auto-attach to window in strict-mode modules.
window.MTC_DATABASE_SERVER = MTC_DATABASE_SERVER;
window.MTC_SHOP_LOCATION   = MTC_SHOP_LOCATION;

// ─── External Database URL ────────────────────────────────────
const MTC_DB_URL = 'https://claude.ai/public/artifacts/9779928b-11d1-442b-b17d-2ef5045b9660';

// ══════════════════════════════════════════════════════════════
// 💻 ADMIN CONSOLE MANAGER
// ══════════════════════════════════════════════════════════════
const AdminConsole = (() => {
    const history = [];
    let histIdx   = -1;
    let isOpen    = false;

    // Typed-print timing (ms per char)
    const CHAR_DELAY = 18;

    // ── Private: add a styled line to the output ─────────────
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

        // Typed-print effect
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

    // ── Private: parse & execute a command ───────────────────
    function _parse(raw) {
        const cmd = raw.trim().toLowerCase();
        if (!cmd) return;

        _appendLine('root@mtcserver:~# ' + raw, 'cline-cmd', true);

        history.unshift(raw);
        histIdx = -1;

        if (!window.player) {
            _appendLine('ERROR: No active player session.', 'cline-error');
            return;
        }

        switch (cmd) {

            // ─ SUDO HEAL ──────────────────────────────────────
            case 'sudo heal': {
                const maxHp  = window.player.maxHp || 110;
                const before = window.player.hp;
                window.player.hp = Math.min(maxHp, window.player.hp + 100);
                const gained = Math.round(window.player.hp - before);
                _appendLine('Authenticating root privilege... OK', 'cline-info');
                _appendLine(`Injecting ${gained} HP units into player entity...`, 'cline-info');
                _appendLine(`COMMAND EXECUTED — HP: ${Math.round(window.player.hp)} / ${maxHp}`, 'cline-ok');
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText(`+${gained} HP 💉 [ADMIN]`, window.player.x, window.player.y - 70, '#00ff41', 22);
                if (typeof spawnParticles === 'function')
                    spawnParticles(window.player.x, window.player.y, 14, '#00ff41');
                if (typeof Audio !== 'undefined' && Audio.playHeal) Audio.playHeal();
                break;
            }

            // ─ SUDO SCORE ─────────────────────────────────────
            case 'sudo score': {
                _appendLine('Authenticating root privilege... OK', 'cline-info');
                _appendLine('Patching score register... +5000', 'cline-info');
                if (typeof addScore === 'function') addScore(5000);
                _appendLine(`COMMAND EXECUTED — Score: ${typeof getScore === 'function' ? getScore().toLocaleString() : '?'}`, 'cline-ok');
                const scoreEl = document.getElementById('score');
                if (scoreEl && typeof getScore === 'function') scoreEl.textContent = getScore().toLocaleString();
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('+5000 🪙 [ADMIN]', window.player.x, window.player.y - 70, '#fbbf24', 22);
                if (typeof spawnParticles === 'function')
                    spawnParticles(window.player.x, window.player.y, 14, '#fbbf24');
                if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
                break;
            }

            // ─ SUDO NEXT ──────────────────────────────────────
            case 'sudo next': {
                _appendLine('Authenticating root privilege... OK', 'cline-info');
                _appendLine('Sending SIGKILL to all enemy processes...', 'cline-info');
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
                _appendLine(`COMMAND EXECUTED — ${killed} process(es) terminated. Wave advancing...`, 'cline-ok');
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('💀 WAVE SKIP [ADMIN]', window.player.x, window.player.y - 80, '#ef4444', 26);
                if (typeof addScreenShake === 'function') addScreenShake(18);
                if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
                // Auto-close after brief delay so user sees the output
                setTimeout(() => closeAdminConsole(), 1800);
                break;
            }

            // ─ HELP ───────────────────────────────────────────
            case 'help': {
                const helpLines = [
                    '┌─────────────────────────────────────────────┐',
                    '│  MTC ADMIN TERMINAL — AVAILABLE COMMANDS     │',
                    '├─────────────────────────────────────────────┤',
                    '│  sudo heal   Restore 100 HP to player        │',
                    '│  sudo score  Add 5000 to current score       │',
                    '│  sudo next   Kill all enemies, skip wave      │',
                    '│  help        Show this command list           │',
                    '│  clear       Clear terminal output            │',
                    '│  exit        Close admin terminal             │',
                    '└─────────────────────────────────────────────┘',
                ];
                helpLines.forEach((l, i) => {
                    setTimeout(() => _appendLine(l, 'cline-info', true), i * 40);
                });
                break;
            }

            // ─ CLEAR ──────────────────────────────────────────
            case 'clear': {
                const out = document.getElementById('console-output');
                if (out) out.innerHTML = '';
                break;
            }

            // ─ EXIT ───────────────────────────────────────────
            case 'exit':
            case 'quit':
            case 'q': {
                _appendLine('Closing session...', 'cline-info');
                setTimeout(() => closeAdminConsole(), 500);
                break;
            }

            // ─ EASTER EGGS ────────────────────────────────────
            case 'sudo rm -rf /':
            case 'sudo rm -rf *': {
                _appendLine('nice try lol', 'cline-warn');
                _appendLine('ACCESS DENIED — MTC Policy §4.2 violation logged.', 'cline-error');
                break;
            }
            case 'whoami': {
                _appendLine('root (player infiltrated server)', 'cline-ok');
                break;
            }
            case 'ls':
            case 'ls -la': {
                _appendLine('drwxr-xr-x  secrets/',               'cline-info', true);
                _appendLine('drwxr-xr-x  grades/',                'cline-info', true);
                _appendLine('-rw-------  kru_manop_passwords.txt', 'cline-warn', true);
                _appendLine('-rw-r--r--  exam_answers_2024.pdf',   'cline-ok',   true);
                break;
            }
            case 'cat kru_manop_passwords.txt': {
                _appendLine('hunter2', 'cline-ok');
                _appendLine("...wait, you weren't supposed to see that.", 'cline-warn');
                break;
            }
            case 'sudo make me a sandwich': {
                _appendLine('What? Make it yourself.', 'cline-warn');
                break;
            }

            // ─ DEFAULT / ACCESS DENIED ────────────────────────
            default: {
                if (cmd.startsWith('sudo ')) {
                    _appendLine(`sudo: ${raw.slice(5)}: command not found`, 'cline-error');
                    _appendLine('ACCESS DENIED — Unknown sudo command.', 'cline-error');
                } else {
                    _appendLine(`bash: ${raw}: command not found`, 'cline-error');
                    _appendLine('Type "help" for available commands.', 'cline-info');
                }
                break;
            }
        }
    }

    // ── Public API ────────────────────────────────────────────
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

            _appendLine('Session started. Welcome, root.', 'cline-ok');
            _appendLine('Run "help" to list available commands.', 'cline-info');

            if (input) {
                input.value = '';
                setTimeout(() => input.focus(), 120);

                input._onKeydown = (e) => {
                    e.stopPropagation(); // block game key listeners

                    if (e.key === 'Enter') {
                        const val = input.value;
                        input.value = '';
                        _parse(val);
                        histIdx = -1;
                    } else if (e.key === 'Escape') {
                        closeAdminConsole();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (histIdx < history.length - 1) {
                            histIdx++;
                            input.value = history[histIdx] || '';
                        }
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
                spawnFloatingText('💻 ADMIN TERMINAL', window.player.x, window.player.y - 70, '#00ff41', 20);
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

function openAdminConsole() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';
    AdminConsole.open();
}

function closeAdminConsole() {
    AdminConsole.close();
    if (gameState === 'PAUSED') gameState = 'PLAYING';
    showResumePrompt(false);

    // Reset movement keys so nothing sticks
    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0; keys.f = 0;

    window.focus();

    if (typeof spawnFloatingText === 'function' && window.player)
        spawnFloatingText('▶ RESUMED', window.player.x, window.player.y - 50, '#34d399', 18);
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
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';

    window.open(MTC_DB_URL, '_blank');
    showResumePrompt(true);

    const promptEl = document.getElementById('db-prompt');
    if (promptEl) promptEl.style.display = 'none';

    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    if (player) spawnFloatingText('📚 MTC DATABASE', player.x, player.y - 60, '#06b6d4', 22);
}

function resumeGame() {
    if (gameState !== 'PAUSED') return;
    // If admin console is open, close it instead of blanket-resuming
    if (AdminConsole.isOpen) { closeAdminConsole(); return; }
    gameState = 'PLAYING';

    showResumePrompt(false);

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0; keys.f = 0;

    window.focus();

    if (player) spawnFloatingText('▶ RESUMED', player.x, player.y - 50, '#34d399', 18);
}

// Legacy aliases
function openDatabase()   { openExternalDatabase(); }
function showMathModal()  { openExternalDatabase(); }
function closeMathModal() { resumeGame(); }

window.openExternalDatabase = openExternalDatabase;
window.openDatabase         = openDatabase;
window.resumeGame           = resumeGame;
window.showMathModal        = showMathModal;
window.closeMathModal       = closeMathModal;

// Pause on window blur; show resume prompt when focus returns
window.addEventListener('blur', () => {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        const shopModal   = document.getElementById('shop-modal');
        const shopOpen    = shopModal && shopModal.style.display === 'flex';
        const consoleOpen = AdminConsole.isOpen;
        if (!shopOpen && !consoleOpen) showResumePrompt(true);
    }
});

window.addEventListener('focus', () => {
    if (gameState === 'PAUSED') {
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

    // Drop shadow
    CTX.fillStyle = 'rgba(0,0,0,0.35)';
    CTX.beginPath();
    CTX.ellipse(screen.x, screen.y + 28, 18, 7, 0, 0, Math.PI * 2);
    CTX.fill();

    CTX.save();
    CTX.translate(screen.x, screen.y);
    CTX.shadowBlur  = 14 * glow;
    CTX.shadowColor = '#06b6d4';

    // Server chassis
    CTX.fillStyle   = '#0c1a2e';
    CTX.strokeStyle = '#06b6d4';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.roundRect(-18, -26, 36, 50, 5);
    CTX.fill();
    CTX.stroke();

    // Drive bays
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

    // Terminal ready indicator (green blink)
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

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP — DRAW, PROXIMITY, OPEN, CLOSE, BUY
// ══════════════════════════════════════════════════════════════

function drawShopObject() {
    const screen  = worldToScreen(MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    const t       = performance.now() / 700;
    const glow    = Math.abs(Math.sin(t)) * 0.5 + 0.5;
    const bounce  = Math.sin(performance.now() / 500) * 3;

    if (player) {
        const d = dist(player.x, player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
        if (d < MTC_SHOP_LOCATION.INTERACTION_RADIUS * 2) {
            const alpha = Math.max(0, 1 - d / (MTC_SHOP_LOCATION.INTERACTION_RADIUS * 2));
            CTX.save();
            CTX.globalAlpha = alpha * 0.3 * glow;
            CTX.strokeStyle = '#facc15';
            CTX.lineWidth   = 2;
            CTX.setLineDash([6, 4]);
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, MTC_SHOP_LOCATION.INTERACTION_RADIUS, 0, Math.PI * 2);
            CTX.stroke();
            CTX.setLineDash([]);
            CTX.restore();
        }
    }

    // Drop shadow
    CTX.fillStyle = 'rgba(0,0,0,0.4)';
    CTX.beginPath();
    CTX.ellipse(screen.x, screen.y + 32, 22, 8, 0, 0, Math.PI * 2);
    CTX.fill();

    CTX.save();
    CTX.translate(screen.x, screen.y + bounce);
    CTX.shadowBlur  = 18 * glow;
    CTX.shadowColor = '#facc15';

    // Counter body
    CTX.fillStyle   = '#78350f';
    CTX.strokeStyle = '#facc15';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.roundRect(-22, 0, 44, 28, 4);
    CTX.fill();
    CTX.stroke();

    // Counter top
    CTX.fillStyle = '#92400e';
    CTX.beginPath();
    CTX.roundRect(-22, -6, 44, 10, 3);
    CTX.fill();
    CTX.strokeStyle = '#fbbf24';
    CTX.lineWidth   = 1.5;
    CTX.stroke();

    // Awning poles
    CTX.strokeStyle = '#d97706';
    CTX.lineWidth   = 3;
    CTX.beginPath(); CTX.moveTo(-18, -6); CTX.lineTo(-18, -34); CTX.stroke();
    CTX.beginPath(); CTX.moveTo( 18, -6); CTX.lineTo( 18, -34); CTX.stroke();

    // Awning canopy
    CTX.fillStyle = `rgba(250,204,21,${0.85 + glow * 0.15})`;
    CTX.beginPath();
    CTX.moveTo(-26, -34);
    CTX.lineTo( 26, -34);
    CTX.lineTo( 22, -24);
    CTX.lineTo(-22, -24);
    CTX.closePath();
    CTX.fill();
    CTX.strokeStyle = '#b45309';
    CTX.lineWidth   = 1.5;
    CTX.stroke();

    // Canopy scallops
    CTX.fillStyle = '#f59e0b';
    for (let i = 0; i < 5; i++) {
        CTX.beginPath();
        CTX.arc(-20 + i * 10, -24, 5, 0, Math.PI);
        CTX.fill();
    }

    // Emoji icons
    CTX.font         = '16px Arial';
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    CTX.shadowBlur   = 0;
    CTX.fillText('🛒', 0, 10);

    const coinBounce = Math.sin(performance.now() / 350) * 4;
    CTX.font = '14px Arial';
    CTX.fillText('🪙', 0, -46 + coinBounce);

    // Label
    CTX.shadowBlur   = 0;
    CTX.fillStyle    = '#fbbf24';
    CTX.font         = 'bold 7px Arial';
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText('MTC CO-OP STORE', 0, 38);

    CTX.restore();
}

function updateShopProximityUI() {
    if (!player) return;
    const d    = dist(player.x, player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    const near = d < MTC_SHOP_LOCATION.INTERACTION_RADIUS;

    const promptEl = document.getElementById('shop-prompt');
    const hudIcon  = document.getElementById('shop-hud-icon');
    const btnShop  = document.getElementById('btn-shop');

    if (promptEl) promptEl.style.display = near ? 'block' : 'none';
    if (hudIcon)  hudIcon.style.display  = near ? 'flex'  : 'none';
    if (btnShop)  btnShop.style.display  = near ? 'flex'  : 'none';
}

function openShop() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';

    const promptEl = document.getElementById('shop-prompt');
    if (promptEl) promptEl.style.display = 'none';

    ShopManager.open();

    if (player) spawnFloatingText('🛒 MTC CO-OP STORE', player.x, player.y - 70, '#facc15', 22);
    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
}

function closeShop() {
    if (gameState !== 'PAUSED') return;
    gameState = 'PLAYING';

    ShopManager.close();
    showResumePrompt(false);

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0; keys.f = 0;

    window.focus();

    if (player) spawnFloatingText('▶ RESUMED', player.x, player.y - 50, '#34d399', 18);
}

function buyItem(itemId) {
    const item = SHOP_ITEMS[itemId];
    if (!item) { console.warn('buyItem: unknown itemId', itemId); return; }
    if (!player) return;

    const currentScore = getScore();
    if (currentScore < item.cost) {
        spawnFloatingText('คะแนนไม่พอ! 💸', player.x, player.y - 60, '#ef4444', 18);
        if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
        ShopManager.updateButtons();
        return;
    }

    addScore(-item.cost);

    if (itemId === 'potion') {
        const maxHp   = player.maxHp || BALANCE.characters[player.charType]?.maxHp || 110;
        const lacking = maxHp - player.hp;
        const healAmt = Math.min(item.heal, lacking);
        if (healAmt > 0) {
            player.hp += healAmt;
            spawnFloatingText(`+${healAmt} HP 🧃`, player.x, player.y - 70, '#22c55e', 22);
            spawnParticles(player.x, player.y, 10, '#22c55e');
            if (typeof Audio !== 'undefined' && Audio.playHeal) Audio.playHeal();
        } else {
            spawnFloatingText('HP เต็มแล้ว!', player.x, player.y - 60, '#94a3b8', 16);
        }

    } else if (itemId === 'damageUp') {
        if (player.shopDamageBoostActive) {
            player.shopDamageBoostTimer += item.duration;
            spawnFloatingText('🔧 DMG เวลา +30s!', player.x, player.y - 70, '#f59e0b', 22);
        } else {
            player._baseDamageBoost      = player.damageBoost || 1.0;
            player.damageBoost           = (player.damageBoost || 1.0) * item.mult;
            player.shopDamageBoostActive = true;
            player.shopDamageBoostTimer  = item.duration;
            spawnFloatingText('🔧 DMG ×1.1!', player.x, player.y - 70, '#f59e0b', 22);
            spawnParticles(player.x, player.y, 8, '#f59e0b');
        }
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (itemId === 'speedUp') {
        if (player.shopSpeedBoostActive) {
            player.shopSpeedBoostTimer += item.duration;
            spawnFloatingText('👟 SPD เวลา +30s!', player.x, player.y - 70, '#06b6d4', 22);
        } else {
            player._baseMoveSpeed        = player.moveSpeed;
            player.moveSpeed             = player.moveSpeed * item.mult;
            player.shopSpeedBoostActive  = true;
            player.shopSpeedBoostTimer   = item.duration;
            spawnFloatingText('👟 SPD ×1.1!', player.x, player.y - 70, '#06b6d4', 22);
            spawnParticles(player.x, player.y, 8, '#06b6d4');
        }
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    }

    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = getScore().toLocaleString();

    Achievements.stats.shopPurchases = (Achievements.stats.shopPurchases || 0) + 1;
    Achievements.check('shopaholic');

    ShopManager.updateButtons();
}

window.openShop  = openShop;
window.closeShop = closeShop;
window.buyItem   = buyItem;

// ══════════════════════════════════════════════════════════════
// 🌊 WAVE SYSTEM
// ══════════════════════════════════════════════════════════════

function startNextWave() {
    // ── Reset glitch state from the wave that just ended ─────
    isGlitchWave     = false;
    controlsInverted = false;
    // glitchIntensity fades to 0 organically via the ramp in updateGame

    // ── Reset any leftover grace-period lock ─────────────────
    waveSpawnLocked     = false;
    waveSpawnTimer      = 0;
    pendingSpawnCount   = 0;
    lastGlitchCountdown = -1;

    resetEnemiesKilled();
    waveStartDamage = Achievements.stats.damageTaken;
    setElementText('wave-badge', `WAVE ${getWave()}`);
    spawnFloatingText(`WAVE ${getWave()}`, player.x, player.y - 100, '#8b5cf6', 40);

    const count = BALANCE.waves.enemiesBase + (getWave() - 1) * BALANCE.waves.enemiesPerWave;

    // ── ⚡ Glitch Wave — every 5th wave ──────────────────────
    if (getWave() % GLITCH_EVERY_N_WAVES === 0) {
        isGlitchWave     = true;
        controlsInverted = true;
        glitchIntensity  = 0;   // ramp starts immediately in updateGame

        // ── Grace Period: queue the double spawn, lock it ────
        // Both the normal batch AND the bonus Glitch Wave batch
        // are stored here and released only after the countdown.
        pendingSpawnCount   = count * 2;
        waveSpawnLocked     = true;
        waveSpawnTimer      = BALANCE.waves.glitchGracePeriod / 1000; // convert ms → s
        lastGlitchCountdown = -1;

        // Immediate atmosphere — visuals and sound fire NOW
        spawnFloatingText('⚡ GLITCH WAVE ⚡', player.x, player.y - 140, '#d946ef', 44);
        addScreenShake(20);
        Audio.playBossSpecial();

        // Staggered warning messages during the grace window
        setTimeout(() => {
            if (player)
                spawnFloatingText('⚠️ SYSTEM ANOMALY DETECTED... ⚠️', player.x, player.y - 100, '#f472b6', 26);
        }, 400);
        setTimeout(() => {
            if (player && waveSpawnLocked)
                spawnFloatingText('CONTROLS INVERTED!', player.x, player.y - 80, '#f472b6', 22);
        }, 1200);
        setTimeout(() => {
            if (player && waveSpawnLocked)
                spawnFloatingText('BRACE FOR IMPACT...', player.x, player.y - 90, '#ef4444', 24);
        }, 2400);

    } else {
        // ── Normal Wave: spawn enemies immediately ────────────
        spawnEnemies(count);
    }

    if (getWave() % BALANCE.waves.bossEveryNWaves === 0) {
        setTimeout(() => {
            bossEncounterCount++;
            const isRider   = bossEncounterCount >= 2;
            const bossLevel = Math.floor(getWave() / BALANCE.waves.bossEveryNWaves);

            // Boss class now lives in entities.js
            window.boss = new Boss(bossLevel, isRider);
            UIManager.updateBossHUD(window.boss);

            const riderTag = isRider ? ' 🐕 DOG RIDER' : '';
            document.getElementById('boss-name').innerHTML =
                `KRU MANOP - LEVEL ${bossLevel}${riderTag} <span class="ai-badge">AI</span>`;

            spawnFloatingText(
                isRider ? 'BOSS INCOMING! 🐕' : 'BOSS INCOMING!',
                player.x, player.y - 100,
                isRider ? '#d97706' : '#ef4444',
                35
            );
            addScreenShake(15);
            Audio.playBossSpecial();
        }, BALANCE.waves.bossSpawnDelay);
    }
}

// Expose so Boss.takeDamage() (in entities.js) can call it via window.*
window.startNextWave = startNextWave;

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const angle    = Math.random() * Math.PI * 2;
        const distance = BALANCE.waves.spawnDistance;
        let x = player.x + Math.cos(angle) * distance;
        let y = player.y + Math.sin(angle) * distance;
        const safe = mapSystem.findSafeSpawn(x, y, BALANCE.enemy.radius);
        x = safe.x; y = safe.y;

        const r = Math.random();
        if      (r < BALANCE.waves.mageSpawnChance)
            window.enemies.push(new MageEnemy(x, y));
        else if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance)
            window.enemies.push(new TankEnemy(x, y));
        else
            window.enemies.push(new Enemy(x, y));
    }
}

// ══════════════════════════════════════════════════════════════
// 🕐 BULLET TIME — toggle, energy drain, visual overlay
// ══════════════════════════════════════════════════════════════

/**
 * toggleSlowMotion()
 * Fired on 'T' keydown. Activates or deactivates Bullet Time.
 * Blocked when energy is below 5 % (nearly empty).
 */
function toggleSlowMotion() {
    if (!isSlowMotion) {
        if (slowMoEnergy < 0.05) {
            if (player) spawnFloatingText('NO ENERGY! ⚡', player.x, player.y - 60, '#ef4444', 20);
            return;
        }
        isSlowMotion = true;
        timeScale    = SLOW_MO_TIMESCALE;
        addScreenShake(6);
        if (player) spawnFloatingText('🕐 BULLET TIME', player.x, player.y - 70, '#00e5ff', 26);
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    } else {
        isSlowMotion = false;
        timeScale    = 1.0;
        if (player) spawnFloatingText('▶▶ NORMAL', player.x, player.y - 55, '#34d399', 20);
    }
}

/**
 * _tickSlowMoEnergy(realDt)
 * Called with REAL (unscaled) dt so drain/recharge tracks wall-clock time.
 */
function _tickSlowMoEnergy(realDt) {
    if (isSlowMotion) {
        slowMoEnergy = Math.max(0, slowMoEnergy - SLOW_MO_DRAIN_RATE * realDt);
        if (slowMoEnergy <= 0) {
            isSlowMotion = false;
            timeScale    = 1.0;
            if (player) spawnFloatingText('ENERGY DEPLETED ⚡', player.x, player.y - 60, '#ef4444', 20);
        }
    } else {
        slowMoEnergy = Math.min(1.0, slowMoEnergy + SLOW_MO_RECHARGE_RATE * realDt);
    }
}

/**
 * drawSlowMoOverlay()
 * Post-process pass drawn AFTER the world CTX.restore().
 *   1. Radial vignette — cyan-tinted dark edges
 *   2. Chromatic aberration — red/blue ghost at ±2 px
 *   3. Letterbox bars — top & bottom cinema crop
 *   4. BULLET TIME badge — bottom-centre with animated energy bar
 *   5. Clock-tick particles around the player
 */
function drawSlowMoOverlay() {
    // Nothing to draw when at normal speed with a full energy tank
    if (!isSlowMotion && slowMoEnergy >= 1.0) return;

    const W   = CANVAS.width, H = CANVAS.height;
    const now = performance.now();

    // ── 1. Radial vignette (cyan edge glow) ──────────────────
    if (isSlowMotion) {
        const vig = CTX.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.78);
        vig.addColorStop(0,    'rgba(0, 229, 255, 0.00)');
        vig.addColorStop(0.65, 'rgba(0, 200, 255, 0.06)');
        vig.addColorStop(1,    'rgba(0, 100, 200, 0.38)');
        CTX.fillStyle = vig;
        CTX.fillRect(0, 0, W, H);

        // ── 2. Chromatic aberration (R / B channel ghosts) ───
        const offset = 2 + Math.sin(now / 80) * 0.8;
        CTX.save();
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = 0.04;
        CTX.fillStyle   = '#ff0000';
        CTX.fillRect(-offset, 0, W, H);   // red channel shifted left
        CTX.fillStyle   = '#0000ff';
        CTX.fillRect( offset, 0, W, H);   // blue channel shifted right
        CTX.globalAlpha = 1;
        CTX.globalCompositeOperation = 'source-over';
        CTX.restore();

        // ── 3. Letterbox bars (top + bottom) ─────────────────
        const barH      = 28;
        const scanAlpha = 0.55 + Math.sin(now / 200) * 0.1;
        CTX.save();
        CTX.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
        CTX.fillRect(0, 0,          W, barH);
        CTX.fillRect(0, H - barH,   W, barH);
        // Cyan border line
        CTX.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        CTX.lineWidth   = 1;
        CTX.beginPath(); CTX.moveTo(0, barH);     CTX.lineTo(W, barH);     CTX.stroke();
        CTX.beginPath(); CTX.moveTo(0, H - barH); CTX.lineTo(W, H - barH); CTX.stroke();
        CTX.restore();
    }

    // ── 4. BULLET TIME badge + energy bar (bottom-centre) ────
    // [UI-FIX] Raised from H-44 → H-140 to prevent overlap with the
    // skill-slot row (stealth / eat-rice / naga icons) and mobile
    // joystick / action-button strip at the very bottom of the screen.
    // Badge footprint: from ~(H-174) down to ~(H-132) — a clear gap
    // of ≥88px above the first HTML skill-bar row on a 1080p display.
    {
        const bx    = W / 2;
        const by    = H - 140;
        const pulse = Math.abs(Math.sin(now / 320));

        CTX.save();

        // Badge background
        const badgeW = SM_BAR_W / 2 + 20;
        const badgeH = 30;
        CTX.fillStyle = isSlowMotion
            ? `rgba(0, 20, 30, ${0.78 + pulse * 0.12})`
            : 'rgba(0, 10, 20, 0.55)';
        _roundRectPath(CTX, bx - badgeW, by - badgeH - 4, badgeW * 2, badgeH + 18, 8);
        CTX.fill();

        // Badge border
        CTX.strokeStyle = isSlowMotion
            ? `rgba(0, 229, 255, ${0.55 + pulse * 0.35})`
            : 'rgba(0, 229, 255, 0.22)';
        CTX.lineWidth = 1.5;
        CTX.stroke();

        // Label text
        if (isSlowMotion) {
            CTX.shadowBlur  = 12 + pulse * 8;
            CTX.shadowColor = '#00e5ff';
        }
        CTX.font         = 'bold 12px Arial';
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillStyle    = isSlowMotion
            ? `rgba(0, 229, 255, ${0.8 + pulse * 0.2})`
            : 'rgba(0, 180, 220, 0.55)';
        CTX.fillText(isSlowMotion ? '🕐 BULLET TIME' : '⚡ RECHARGING', bx, by - badgeH + 8);
        CTX.shadowBlur = 0;

        // Energy bar track
        const barX = bx - SM_BAR_W / 2;
        const barY = by - 6;
        CTX.fillStyle = 'rgba(0, 30, 40, 0.8)';
        _roundRectPath(CTX, barX, barY, SM_BAR_W, SM_BAR_H, 4);
        CTX.fill();

        // Energy bar fill (shifts from cyan → red as energy drains)
        const fillW = SM_BAR_W * slowMoEnergy;
        const r     = Math.round(lerp(0,   220, 1 - slowMoEnergy));
        const g     = Math.round(lerp(229, 60,  1 - slowMoEnergy));
        const b     = Math.round(lerp(255, 30,  1 - slowMoEnergy));
        CTX.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
        if (fillW > 0) {
            _roundRectPath(CTX, barX, barY, fillW, SM_BAR_H, 4);
            CTX.fill();
            if (isSlowMotion) {
                CTX.shadowBlur  = 8;
                CTX.shadowColor = `rgb(${r}, ${g}, ${b})`;
                CTX.fill(); // second fill for glow bloom
                CTX.shadowBlur  = 0;
            }
        }

        // Tick marks dividing bar into fifths
        CTX.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        CTX.lineWidth   = 1;
        for (let i = 1; i < 5; i++) {
            const tx = barX + (SM_BAR_W / 5) * i;
            CTX.beginPath(); CTX.moveTo(tx, barY); CTX.lineTo(tx, barY + SM_BAR_H); CTX.stroke();
        }

        // Percentage label
        CTX.fillStyle = 'rgba(200, 240, 255, 0.7)';
        CTX.font      = 'bold 9px Arial';
        CTX.fillText(`${Math.round(slowMoEnergy * 100)}%`, bx + SM_BAR_W / 2 + 16, barY + SM_BAR_H / 2);

        CTX.restore();
    }

    // ── 5. Clock-tick particles around player (slow-mo only) ─
    if (isSlowMotion && player && Math.random() < 0.18) {
        const screen = typeof worldToScreen === 'function'
            ? worldToScreen(player.x, player.y)
            : { x: CANVAS.width / 2, y: CANVAS.height / 2 };

        const angle   = Math.random() * Math.PI * 2;
        const radius  = 32 + Math.random() * 28;
        const px      = screen.x + Math.cos(angle) * radius;
        const py      = screen.y + Math.sin(angle) * radius;
        const symbols = ['⏱', '⌛', '◈', '⧖'];

        CTX.save();
        CTX.globalAlpha  = 0.45 + Math.random() * 0.35;
        CTX.font         = `${10 + Math.random() * 6}px Arial`;
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillStyle    = '#00e5ff';
        CTX.shadowBlur   = 6;
        CTX.shadowColor  = '#00e5ff';
        CTX.fillText(symbols[Math.floor(Math.random() * symbols.length)], px, py);
        CTX.restore();
    }
}

/**
 * _roundRectPath(ctx, x, y, w, h, r)
 * Draws a rounded-rect path on ctx.
 * Kept here because it is only used by drawSlowMoOverlay.
 * Provides a fallback for environments that lack ctx.roundRect().
 */
function _roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

window.toggleSlowMotion = toggleSlowMotion;

// ══════════════════════════════════════════════════════════════
// 🔁 GAME LOOP
// ══════════════════════════════════════════════════════════════

function gameLoop(now) {
    const dt = getDeltaTime(now); // real-world (unscaled) frame delta

    // Bullet Time energy always ticks at real speed
    if (gameState === 'PLAYING') {
        _tickSlowMoEnergy(dt);
    }

    // All game-world simulation uses the scaled dt
    const scaledDt = dt * timeScale;
    _lastDrawDt    = scaledDt;   // cache for UIManager.draw(CTX, _lastDrawDt) in drawGame()

    if (gameState === 'PLAYING') {
        updateGame(scaledDt);
        drawGame();
    } else if (gameState === 'PAUSED') {
        drawGame(); // keep world visible behind modals
        const shopModal = document.getElementById('shop-modal');
        if (shopModal && shopModal.style.display === 'flex') {
            ShopManager.tick();
        }
    }

    requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    updateCamera(player.x, player.y);
    updateMouseWorld();

    // ── ⚡ Glitch intensity ramp ──────────────────────────────
    // Ramps up to 1.0 over ~1.25 s when active; fades out 2× faster when off
    const GLITCH_RAMP = 0.8;
    if (isGlitchWave) {
        glitchIntensity = Math.min(1.0, glitchIntensity + GLITCH_RAMP * dt);
    } else {
        glitchIntensity = Math.max(0.0, glitchIntensity - GLITCH_RAMP * 2 * dt);
    }

    // ── ⚡ Glitch Wave — Spawn Grace Period countdown ─────────
    // While waveSpawnLocked is true, enemies have not yet spawned.
    // We count down using scaled dt (Bullet Time slows it too — intentional:
    // the player can use Bullet Time to buy even more breathing room).
    // When the timer hits zero: release the full double horde.
    if (waveSpawnLocked) {
        waveSpawnTimer -= dt;

        // Whole-second countdown announcements (3 … 2 … 1)
        const secsLeft = Math.ceil(waveSpawnTimer);
        if (secsLeft !== lastGlitchCountdown && secsLeft > 0 && secsLeft <= 3) {
            lastGlitchCountdown = secsLeft;
            spawnFloatingText(
                `⚡ SPAWNING IN ${secsLeft}...`,
                player.x, player.y - 115,
                '#d946ef', 34
            );
            addScreenShake(6);
        }

        // Grace period expired — release the horde
        if (waveSpawnTimer <= 0) {
            waveSpawnLocked     = false;
            lastGlitchCountdown = -1;
            spawnEnemies(pendingSpawnCount);
            spawnFloatingText('💀 CHAOS BEGINS!', player.x, player.y - 130, '#ef4444', 44);
            addScreenShake(28);
            Audio.playBossSpecial();
        }
    }

    // ── Day / Night cycle (driven by BALANCE.LIGHTING in config.js) ──
    dayNightTimer += dt;
    {
        const L        = BALANCE.LIGHTING;
        const phi      = (dayNightTimer / L.cycleDuration) * Math.PI * 2;
        const dayPhase = Math.sin(phi) * 0.5 + 0.5;
        L.ambientLight = L.nightMinLight + dayPhase * (L.dayMaxLight - L.nightMinLight);
    }

    // ── Shop buff timers ──────────────────────────────────────
    if (player.shopDamageBoostActive) {
        player.shopDamageBoostTimer -= dt;
        if (player.shopDamageBoostTimer <= 0) {
            player.shopDamageBoostActive = false;
            player.damageBoost = player._baseDamageBoost !== undefined
                ? player._baseDamageBoost
                : 1.0;
            spawnFloatingText('DMG Boost หมดแล้ว', player.x, player.y - 50, '#94a3b8', 14);
        }
    }

    if (player.shopSpeedBoostActive) {
        player.shopSpeedBoostTimer -= dt;
        if (player.shopSpeedBoostTimer <= 0) {
            player.shopSpeedBoostActive = false;
            if (player._baseMoveSpeed !== undefined) player.moveSpeed = player._baseMoveSpeed;
            spawnFloatingText('SPD Boost หมดแล้ว', player.x, player.y - 50, '#94a3b8', 14);
        }
    }

    // ── Interaction key checks ────────────────────────────────
    const dToServer = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);

    if (dToServer < MTC_DATABASE_SERVER.INTERACTION_RADIUS && keys.e === 1) {
        keys.e = 0;
        openExternalDatabase();
        return;
    }

    if (dToServer < MTC_DATABASE_SERVER.INTERACTION_RADIUS && keys.f === 1) {
        keys.f = 0;
        openAdminConsole();
        return;
    }

    const dToShop = dist(player.x, player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    if (dToShop < MTC_SHOP_LOCATION.INTERACTION_RADIUS && keys.b === 1) {
        keys.b = 0;
        openShop();
        return;
    }

    // ── Player ────────────────────────────────────────────────
    // During Glitch Wave, W↔S and A↔D are swapped
    const effectiveKeys = controlsInverted
        ? { ...keys, w: keys.s, s: keys.w, a: keys.d, d: keys.a }
        : keys;
    player.update(dt, effectiveKeys, mouse);

    if (!(player instanceof PoomPlayer)) {
        weaponSystem.update(dt);
        const burstProjectiles = weaponSystem.updateBurst(player, player.damageBoost);
        if (burstProjectiles && burstProjectiles.length > 0) projectileManager.add(burstProjectiles);

        if (mouse.left === 1 && gameState === 'PLAYING') {
            if (weaponSystem.canShoot()) {
                const projectiles = weaponSystem.shoot(player, player.damageBoost);
                if (projectiles && projectiles.length > 0) projectileManager.add(projectiles);
            }
        }
    }

    if (player instanceof PoomPlayer) {
        if (mouse.left === 1 && gameState === 'PLAYING') shootPoom(player);
        if (mouse.right === 1) {
            if (player.cooldowns.eat <= 0 && !player.isEatingRice) player.eatRice();
            mouse.right = 0;
        }
        if (keys.q === 1) {
            if (player.cooldowns.naga <= 0) player.summonNaga();
            keys.q = 0;
        }
        UIManager.updateSkillIcons(player);
    }

    // ── Drone ─────────────────────────────────────────────────
    if (window.drone && player && !player.dead) {
        window.drone.update(dt, player);
    }

    // ── Boss & Enemies ────────────────────────────────────────
    if (boss) boss.update(dt, player);

    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update(dt, player);
        if (enemies[i].dead) enemies.splice(i, 1);
    }

    // ── Wave progression ──────────────────────────────────────
    // Guard: skip advancement if spawn is still locked (grace period active).
    // Without this guard, 0 enemies during the countdown would instantly
    // trigger the next wave before the glitch horde ever appears.
    if (getWave() % BALANCE.waves.bossEveryNWaves !== 0 && enemies.length === 0 && !boss && !waveSpawnLocked) {
        if (Achievements.stats.damageTaken === waveStartDamage &&
            getEnemiesKilled() >= BALANCE.waves.minKillsForNoDamage) {
            Achievements.check('no_damage');
        }
        setWave(getWave() + 1);
        Achievements.check('wave_1');
        startNextWave();
    }

    // ── Special effects ───────────────────────────────────────
    for (let i = specialEffects.length - 1; i >= 0; i--) {
        const remove = specialEffects[i].update(dt, player, meteorZones);
        if (remove) specialEffects.splice(i, 1);
    }

    // ── Projectiles / Power-ups / Meteor zones ────────────────
    projectileManager.update(dt, player, enemies, boss);

    for (let i = powerups.length - 1; i >= 0; i--) {
        if (powerups[i].update(dt, player)) powerups.splice(i, 1);
    }

    for (let i = meteorZones.length - 1; i >= 0; i--) {
        meteorZones[i].life -= dt;
        if (dist(meteorZones[i].x, meteorZones[i].y, player.x, player.y) < meteorZones[i].radius) {
            player.takeDamage(meteorZones[i].damage * dt);
        }
        if (meteorZones[i].life <= 0) meteorZones.splice(i, 1);
    }

    // ── Systems ───────────────────────────────────────────────
    // ✅ BUG 1 FIX: pass dt into mapSystem.update() so MTCRoom receives the
    // correct scaled delta time instead of calling getDeltaTime() internally,
    // which was corrupting lastTime and making the safe zone heal 16× too slowly.
    mapSystem.update([player, ...enemies, boss].filter(e => e && !e.dead), dt);
    particleSystem.update(dt);
    floatingTextSystem.update(dt);

    // ✅ WARN 1 FIX: wire the weather system into the update loop.
    // getCamera() returns the utils.js camera object (x/y world offset).
    // weatherSystem is a global singleton from effects.js.
    weatherSystem.update(dt, getCamera());

    updateScreenShake();
    Achievements.checkAll();

    updateDatabaseServerUI();
    updateShopProximityUI();
}

function drawGame() {
    // ── 🔴 DIAGNOSTIC — gated behind DEBUG_MODE (WARN 2 FIX) ─────────────────
    // Set DEBUG_MODE = true at the top of this file to re-enable.
    // NEVER commit as true: fires every 5s at 60fps with string concatenation GC cost.
    if (!drawGame._diagFrame) drawGame._diagFrame = 0;
    drawGame._diagFrame++;
    if (DEBUG_MODE && drawGame._diagFrame % 300 === 1) {
        console.log(
            '[MTC drawGame] frame', drawGame._diagFrame,
            '| gameState:', gameState,
            '| player:', !!window.player,
            '| UIManager:', typeof UIManager,
            '| MTC_DB_SERVER on window:', !!window.MTC_DATABASE_SERVER,
            '| MTC_SHOP on window:', !!window.MTC_SHOP_LOCATION
        );
    }

    // Background gradient
    const grad = CTX.createLinearGradient(0, 0, 0, CANVAS.height);
    grad.addColorStop(0, GAME_CONFIG.visual.bgColorTop);
    grad.addColorStop(1, GAME_CONFIG.visual.bgColorBottom);
    CTX.fillStyle = grad;
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);

    CTX.save();
    const shake = getScreenShakeOffset();
    CTX.translate(shake.x, shake.y);

    drawGrid();

    // Meteor zones
    for (const z of meteorZones) {
        const screen = worldToScreen(z.x, z.y);
        const a = Math.sin(performance.now() / 200) * 0.3 + 0.7;
        CTX.fillStyle = `rgba(239, 68, 68, ${a * 0.4})`;
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2);
        CTX.fill();
    }

    // World objects
    mapSystem.draw();
    drawDatabaseServer();
    drawShopObject();

    // Power-ups (cull off-screen)
    for (const p of powerups) {
        if (p.isOnScreen ? p.isOnScreen(60) : true) p.draw();
    }

    specialEffects.forEach(e => e.draw());

    if (window.drone) window.drone.draw();

    player.draw();

    // Enemies (cull off-screen)
    for (const e of enemies) {
        if (e.isOnScreen(80)) e.draw();
    }

    // Boss (cull off-screen with generous buffer for large sprite)
    if (boss && !boss.dead && boss.isOnScreen(200)) boss.draw();

    projectileManager.draw();
    particleSystem.draw();
    floatingTextSystem.draw();

    // ✅ WARN 1 FIX: draw weather particles in world-space (before CTX.restore)
    // so they are correctly offset by the camera and screen-shake translation.
    // weatherSystem.draw() is a no-op when mode === 'none', so this is zero-cost
    // when weather is disabled.
    weatherSystem.draw();

    CTX.restore(); // ← end of world-space transform

    // ── Lighting pass (screen-space, after world restore) ────
    // ✅ MINIMAP FIX: Wrapped in CTX.save()/restore() to FULLY CONTAIN any
    //    globalCompositeOperation / globalAlpha changes made by drawLighting().
    //    Without this wrapper, blend modes leak into UIManager.draw() and make
    //    the entire minimap invisible (draws in "destination-out" or similar).
    {
        const allProj = (typeof projectileManager !== 'undefined' && projectileManager.projectiles)
            ? projectileManager.projectiles
            : [];

        CTX.save();   // ← isolate lighting blend modes
        mapSystem.drawLighting(player, allProj, [
            {
                x:      MTC_DATABASE_SERVER.x,
                y:      MTC_DATABASE_SERVER.y,
                radius: BALANCE.LIGHTING.mtcServerLightRadius,
                type:   'cool'
            },
            {
                x:      MTC_SHOP_LOCATION.x,
                y:      MTC_SHOP_LOCATION.y,
                radius: BALANCE.LIGHTING.shopLightRadius,
                type:   'warm'
            }
        ]);
        CTX.restore(); // ← restore composite/alpha state before HUD draws
    }

    drawDayNightHUD();

    // ── Full-screen overlays ─────────────────────────────────
    // These paint over the ENTIRE canvas, so they must run BEFORE the HUD.
    drawSlowMoOverlay(); // 🕐 no-op when normal speed + full energy

    // ⚡ Glitch Wave overlay — glitchIntensity > 0 even briefly after wave ends
    if (glitchIntensity > 0) {
        drawGlitchEffect(glitchIntensity, controlsInverted);
    }

    // ── HUD overlay pass — DRAWN ABSOLUTELY LAST ─────────────
    // ✅ MINIMAP FIX: UIManager.draw() moved to after ALL full-screen overlays
    //    (lighting, slow-mo vignette, glitch effect). Previously it was called
    //    before drawSlowMoOverlay() — the letterbox + vignette painted over it
    //    every frame. Now the radar is guaranteed to be on top of everything.
    //
    //    _lastDrawDt was cached in gameLoop() this frame so UIManager.draw()
    //    can animate the combo timer without changing drawGame()'s signature.
    if (typeof UIManager !== 'undefined' && UIManager.draw) {
        UIManager.draw(CTX, _lastDrawDt);
    }
}

// ══════════════════════════════════════════════════════════════
// 🌞 DAY / NIGHT HUD
// ══════════════════════════════════════════════════════════════

function drawDayNightHUD() {
    const L      = BALANCE.LIGHTING;
    const phase  = (L.ambientLight - L.nightMinLight) / (L.dayMaxLight - L.nightMinLight);
    const isDawn = phase > 0.5;

    // [UI-FIX] Moved from top-RIGHT (cx = CANVAS.width - 52, cy = 52) to
    // top-LEFT so it no longer overlaps the tactical minimap/radar which
    // occupies top-right (cx = canvas.width - 80, cy = 80, r = 60).
    // The left-side score / wave HUD elements are HTML overlays on a
    // different layer, so pure canvas drawing here has no z-index conflict.
    const cx = 52;
    const cy = 52;
    const r  = 24;

    CTX.save();

    // Halo ring
    CTX.fillStyle   = isDawn ? 'rgba(255, 210, 80, 0.18)' : 'rgba(80, 110, 255, 0.18)';
    CTX.strokeStyle = isDawn ? 'rgba(255, 210, 80, 0.55)' : 'rgba(130, 160, 255, 0.55)';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.arc(cx, cy, r + 8, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();

    // Arc progress
    CTX.strokeStyle = isDawn ? '#fbbf24' : '#818cf8';
    CTX.lineWidth   = 3.5;
    CTX.lineCap     = 'round';
    CTX.shadowBlur  = 8;
    CTX.shadowColor = isDawn ? '#fbbf24' : '#818cf8';
    CTX.beginPath();
    CTX.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
    CTX.stroke();
    CTX.shadowBlur = 0;

    // Emoji icon
    CTX.font         = `${r}px Arial`;
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText(isDawn ? '☀️' : '🌙', cx, cy);

    // Percentage label
    CTX.fillStyle    = isDawn ? '#fde68a' : '#c7d2fe';
    CTX.font         = 'bold 8px Arial';
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    const pct        = Math.round(phase * 100);
    CTX.fillText(isDawn ? `DAY ${pct}%` : `NIGHT ${100 - pct}%`, cx, cy + r + 14);

    CTX.restore();
}

// ══════════════════════════════════════════════════════════════
// 🔲 GRID
// ══════════════════════════════════════════════════════════════

function drawGrid() {
    const sz = GAME_CONFIG.physics.gridSize;
    const ox = -getCamera().x % sz;
    const oy = -getCamera().y % sz;

    CTX.strokeStyle = GAME_CONFIG.visual.gridColor;
    CTX.lineWidth   = 1;
    CTX.beginPath();
    for (let x = ox; x < CANVAS.width;  x += sz) { CTX.moveTo(x, 0); CTX.lineTo(x, CANVAS.height); }
    for (let y = oy; y < CANVAS.height; y += sz) { CTX.moveTo(0, y); CTX.lineTo(CANVAS.width, y); }
    CTX.stroke();
}

// ══════════════════════════════════════════════════════════════
// 🍚 POOM ATTACK SYSTEM
// ══════════════════════════════════════════════════════════════

function shootPoom(player) {
    const S = BALANCE.characters.poom;
    if (player.cooldowns.shoot > 0) return;

    const attackSpeedMult  = player.isEatingRice ? 0.7 : 1.0;
    player.cooldowns.shoot = S.riceCooldown * attackSpeedMult;

    const { damage, isCrit } = player.dealDamage(S.riceDamage * player.damageBoost);
    projectileManager.add(
        new Projectile(player.x, player.y, player.angle, S.riceSpeed, damage, S.riceColor, false, 'player')
    );

    if (isCrit) {
        spawnFloatingText('สาดข้าว! CRIT!', player.x, player.y - 45, '#fbbf24', 20);
        spawnParticles(player.x, player.y, 5, '#ffffff');
    }

    player.speedBoostTimer = S.speedOnHitDuration;
}

// ══════════════════════════════════════════════════════════════
// 🚀 INIT & START
// ══════════════════════════════════════════════════════════════

async function initAI() {
    const brief = document.getElementById('mission-brief');
    if (!brief) { console.warn('⚠️ mission-brief not found'); return; }
    brief.textContent = "กำลังโหลดภารกิจ...";
    try {
        const name = await Gemini.getMissionName();
        brief.textContent = `ภารกิจ "${name}"`;
    } catch (e) {
        console.warn('Failed to get mission name:', e);
        brief.textContent = 'ภารกิจ "พิชิตครูมานพ"';
    }
}

function startGame(charType = 'kao') {
    console.log('🎮 Starting game... charType:', charType);
    Audio.init();

    const savedData = getSaveData();
    console.log('[MTC Save] Loaded save data:', savedData);

    UIManager.updateHighScoreDisplay(savedData.highScore);

    player = charType === 'poom' ? new PoomPlayer() : new Player(charType);

    enemies = []; powerups = []; specialEffects = []; meteorZones = [];
    boss    = null;

    dayNightTimer  = 0;
    BALANCE.LIGHTING.ambientLight = BALANCE.LIGHTING.dayMaxLight;

    bossEncounterCount = 0;
    console.log('🐕 Boss encounter counter reset — encounter 1 will be plain boss');

    // Reset Bullet Time
    isSlowMotion = false;
    timeScale    = 1.0;
    slowMoEnergy = 1.0;
    console.log('🕐 Bullet Time reset — timeScale 1.0, energy full');

    // Reset Glitch Wave grace period
    waveSpawnLocked     = false;
    waveSpawnTimer      = 0;
    pendingSpawnCount   = 0;
    lastGlitchCountdown = -1;
    console.log('⚡ Glitch Wave grace period reset');

    // Reset shop buff state
    player.shopDamageBoostActive = false;
    player.shopDamageBoostTimer  = 0;
    player._baseDamageBoost      = undefined;
    player.shopSpeedBoostActive  = false;
    player.shopSpeedBoostTimer   = 0;
    player._baseMoveSpeed        = undefined;

    // Engineering Drone
    window.drone   = new Drone();
    window.drone.x = player.x;
    window.drone.y = player.y;
    spawnFloatingText('🤖 DRONE ONLINE', player.x, player.y - 90, '#00e5ff', 20);
    console.log('🤖 Engineering Drone initialised');

    // Reset weather system to ensure no stale particles from a previous run
    weatherSystem.clear();

    UIManager.updateBossHUD(null);
    resetScore();
    setWave(1);
    projectileManager.clear();
    particleSystem.clear();
    floatingTextSystem.clear();
    mapSystem.init();

    weaponSystem.setActiveChar(charType);
    try {
        weaponSystem.updateWeaponUI();
    } catch (err) {
        console.error('[startGame] updateWeaponUI threw — continuing anyway:', err);
    }
    UIManager.setupCharacterHUD(player);

    Achievements.stats.damageTaken   = 0;
    Achievements.stats.shopPurchases = 0;
    waveStartDamage = 0;

    hideElement('overlay');
    hideElement('report-card');

    UIManager.resetGameOverUI();

    showResumePrompt(false);
    ShopManager.close();

    // Ensure admin console is clean
    if (AdminConsole.isOpen) AdminConsole.close();
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) consoleOutput.innerHTML = '';

    startNextWave();
    gameState = 'PLAYING';
    resetTime();

    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        mobileUI.style.display = isTouchDevice ? 'block' : 'none';
    }
    window.focus();

    console.log('✅ Game started!');
    if (!loopRunning) {
        loopRunning = true;
        requestAnimationFrame(gameLoop);
    }
}

async function endGame(result) {
    gameState = 'GAMEOVER';

    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) mobileUI.style.display = 'none';

    showResumePrompt(false);
    ShopManager.close();

    if (AdminConsole.isOpen) AdminConsole.close();

    window.drone = null;

    // Ensure Bullet Time is fully off on game over
    isSlowMotion = false;
    timeScale    = 1.0;

    // Clear weather on game over so particles don't linger on the game-over screen
    weatherSystem.clear();

    // Persist high score
    {
        const runScore = getScore();
        const existing = getSaveData();
        if (runScore > existing.highScore) {
            updateSaveData({ highScore: runScore });
            console.log(`[MTC Save] 🏆 New high score: ${runScore}`);
            UIManager.updateHighScoreDisplay(runScore);
        } else {
            UIManager.updateHighScoreDisplay(existing.highScore);
        }
    }

    if (result === 'victory') {
        showElement('victory-screen');
        setElementText('final-score', `SCORE ${getScore()}`);
        setElementText('final-wave',  `WAVES CLEARED ${getWave() - 1}`);
    } else {
        const finalScore = getScore();
        const finalWave  = getWave();

        showElement('overlay');
        UIManager.showGameOver(finalScore, finalWave);

        const ld = document.getElementById('ai-loading');
        if (ld) ld.style.display = 'block';
        const reportText = document.getElementById('report-text');
        try {
            const comment = await Gemini.getReportCard(finalScore, finalWave);
            if (ld) ld.style.display = 'none';
            if (reportText) reportText.textContent = comment;
        } catch (e) {
            console.warn('Failed to get AI report card:', e);
            if (ld) ld.style.display = 'none';
            if (reportText) reportText.textContent = 'ตั้งใจเรียนให้มากกว่านี้นะ...';
        }
    }
}

// ══════════════════════════════════════════════════════════════
// GLOBAL EXPORTS
// ══════════════════════════════════════════════════════════════

window.startGame = startGame;
window.endGame   = endGame;

window.onload = () => {
    console.log('🚀 Initializing game...');
    initCanvas();
    InputSystem.init(); // ← wires keyboard, mouse, and mobile touch controls
    initAI();
};