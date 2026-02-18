/**
 * 🎮 MTC: ENHANCED EDITION - Main Game Loop
 * Game state, Boss, waves, input, loop
 *
 * REFACTORED (Bullet Time — v10 — NEW):
 * - ✅ let timeScale = 1.0 / let isSlowMotion = false — global time scalars
 * - ✅ let slowMoEnergy = 1.0 — drain while active; recharge when off
 * - ✅ SLOW_MO_TIMESCALE   = 0.30 — world runs at 30% speed while active
 * - ✅ SLOW_MO_DRAIN_RATE  = 0.14 — energy empties in ~7 real-world seconds of use
 * - ✅ SLOW_MO_RECHARGE_RATE = 0.07 — recharges to full in ~14 real-world seconds
 * - ✅ 'T' key toggles slow motion (global — no proximity requirement)
 *       Auto-deactivates when energy reaches 0; cannot activate on empty tank
 * - ✅ gameLoop: _tickSlowMoEnergy(dt) on real dt BEFORE applying scale
 *       const scaledDt = dt * timeScale; → passed to updateGame()
 *       Keeps shop buff timers & day/night on real time; entities feel the slow
 * - ✅ drawSlowMoOverlay() — layered post-process drawn AFTER world restore:
 *       • Full-screen radial cyan vignette (darkened + tinted edges)
 *       • Chromatic aberration: R/B channel ghost rectangles at ±2px offset
 *       • Top-bar letterbox scanline bands (cinematic crop effect)
 *       • Animated "BULLET TIME" badge with energy drain bar (bottom-centre)
 *       • Pulsing timestamp particles (slow clock ticks) around the player
 * - ✅ Admin Console key reassigned T → F to free 'T' for Bullet Time
 *       (Update index.html: console-prompt kbd, console-hud-icon key-hint, instructions)
 *
 * REFACTORED (Admin Console — v9):
 * - ✅ #admin-console overlay — CRT/hacker terminal aesthetic
 * - ✅ 'T' key opens terminal when player is near MTC_DATABASE_SERVER
 * - ✅ AdminConsole.open() / .close() — manages gameState = 'PAUSED'
 * - ✅ AdminConsole.parseCommand(cmd) — command parser:
 *       sudo heal  → restore 100 HP
 *       sudo score → +5000 score
 *       sudo next  → kill all enemies / end wave
 *       help       → print command list
 *       clear      → clear output log
 *       exit       → close terminal
 *       (anything else) → "ACCESS DENIED"
 * - ✅ Input field steals keyboard focus while open — game hotkeys suppressed
 * - ✅ updateDatabaseServerUI() now also drives console-prompt + console-hud-icon
 * - ✅ keys.f added to key map; 'F' keydown triggers openAdminConsole() (near server)
 * - ✅ Mobile btn-terminal shown when near server, fires openAdminConsole()
 * - ✅ closeAdminConsole() is globally exposed via window.*
 * - ✅ AdminConsole.addLine() typed-print effect for immersive feel
 *
 * REFACTORED (Shop Feature — v4):
 * - ✅ MTC_SHOP_LOCATION — fixed world position for the interactive shop kiosk
 * - ✅ Proximity detection → shows shop-prompt + HUD icon
 * - ✅ 'B' key / mobile btn-shop → openShop()
 * - ✅ openShop()  → gameState = 'PAUSED', ShopManager.open()
 * - ✅ closeShop() → gameState = 'PLAYING', ShopManager.close(), reset keys
 * - ✅ buyItem(itemId) — deducts score, applies timed/instant effect
 * - ✅ Shop buff timers tick in updateGame()
 * - ✅ drawShopObject() — golden kiosk drawn on map each frame
 * - ✅ Shopaholic achievement tracking via Achievements.stats.shopPurchases
 *
 * (Database Feature — v3 — unchanged):
 * - ✅ MTC_DATABASE_SERVER — fixed world position for the interactive server object
 * - ✅ 'E' key / mobile btn-database → openExternalDatabase()
 * - ✅ gameState = 'PAUSED' when DB is opened or window loses focus (blur)
 * - ✅ resumeGame()  → restores gameState = 'PLAYING', resets keys, hides prompt
 *
 * (Drone Feature — v5 — unchanged):
 * - ✅ window.drone global — holds the active Drone instance
 * - ✅ startGame() creates a fresh Drone at player spawn
 * - ✅ updateGame() calls drone.update(dt, player)
 * - ✅ drawGame() calls drone.draw() between map objects and player
 * - ✅ endGame() nullifies window.drone to prevent stale references
 *
 * (Boss Dog Rider — v6 — UPDATED v7 PROGRESSION):
 * - ✅ bossEncounterCount tracks how many bosses have been spawned this run
 * - ✅ Encounter 1 → normal Boss (no dog, bark disabled)
 * - ✅ Encounter 2+ → Boss with isRider=true (Dog Rider form + bark enabled)
 * - ✅ Boss draws a fully animated dog underneath (4 legs, tail, head)
 * - ✅ Dog legs use ctx.save/translate/rotate/restore for pendulum motion
 * - ✅ Dog color driven by BALANCE.boss.phase2.dogColor (amber/brown)
 * - ✅ Enrage at HP < 50%: dog turns red, speed *= enrageSpeedMult, particles
 * - ✅ New bark() attack: emits BarkWave cone, damages + pushes player
 * - ✅ BarkWave class: expanding arc rings with glow; auto-removed after 0.6s
 * - ✅ Bark mixed into CHASE decision tree alongside Slam / Graph / Summon
 *
 * (View Culling & Particle Cap — v8 — NEW):
 * - ✅ Entity.isOnScreen(buffer) added to base class in entities.js
 * - ✅ drawGame(): enemy.draw(), powerup.draw(), boss.draw() guarded by isOnScreen()
 * - ✅ map.js MapSystem.draw(): explicit CULL constant, consistent x+y checks
 * - ✅ map.js drawLighting(): off-screen datapillar/server objects skip radial-gradient API
 * - ✅ effects.js ParticleSystem: hard cap of 150 — oldest particle evicted on overflow
 * - ✅ effects.js Particle.draw(): shadowBlur skipped for radius < 3 px particles
 */

// ─── Game State ───────────────────────────────────────────
let gameState  = 'MENU';
let loopRunning = false;
// keys.t  → Bullet Time toggle  (global, any location)
// keys.f  → Admin Terminal open (proximity to server only)
const keys = { w: 0, a: 0, s: 0, d: 0, space: 0, q: 0, e: 0, b: 0, t: 0, f: 0 };

// ─── 🕐 BULLET TIME — global time-scale system ────────────
let   timeScale    = 1.0;   // multiplier applied to dt each frame
let   isSlowMotion = false; // current toggle state
let   slowMoEnergy = 1.0;   // 0.0 → empty, 1.0 → full

const SLOW_MO_TIMESCALE    = 0.30;  // world runs at 30 % speed when active
const SLOW_MO_DRAIN_RATE   = 0.14;  // drains full bar in ~7 real seconds
const SLOW_MO_RECHARGE_RATE = 0.07; // recharges full bar in ~14 real seconds
// Energy-bar position / size (drawn as part of the slowmo HUD badge)
const SM_BAR_W = 180, SM_BAR_H = 8;

// ─── Day / Night cycle ────────────────────────────────────
let dayNightTimer = 0;

// ─── Game Objects (global) ────────────────────────────────
window.player         = null;
window.enemies        = [];
window.boss           = null;
window.powerups       = [];
window.specialEffects = [];
window.meteorZones    = [];
window.drone          = null;
let waveStartDamage   = 0;

// ─── Boss Progression Counter ─────────────────────────────
let bossEncounterCount = 0;

// ─── MTC Database Server ──────────────────────────────────
const MTC_DATABASE_SERVER = {
    x: 350,
    y: -350,
    INTERACTION_RADIUS: 90
};

// ─── MTC Shop Location ────────────────────────────────────
const MTC_SHOP_LOCATION = {
    x: -350,
    y:  350,
    INTERACTION_RADIUS: 90
};

// ─── External Database URL ────────────────────────────────
const MTC_DB_URL = 'https://claude.ai/public/artifacts/9779928b-11d1-442b-b17d-2ef5045b9660';

// ══════════════════════════════════════════════════════════════
// 💻 ADMIN CONSOLE MANAGER
// ══════════════════════════════════════════════════════════════
const AdminConsole = (() => {
    // Command history (up-arrow navigation)
    const history  = [];
    let histIdx    = -1;
    let isOpen     = false;

    // Typed-print timing (ms per char)
    const CHAR_DELAY = 18;

    // ── Private: add a styled line to the output ────────────
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

    // ── Private: parse & execute a command ──────────────────
    function _parse(raw) {
        const cmd = raw.trim().toLowerCase();
        if (!cmd) return;

        // Echo user command
        _appendLine('root@mtcserver:~# ' + raw, 'cline-cmd', true);

        history.unshift(raw);
        histIdx = -1;

        if (!window.player) {
            _appendLine('ERROR: No active player session.', 'cline-error');
            return;
        }

        // ── Command routing ─────────────────────────────────
        switch (cmd) {

            // ─ SUDO HEAL ─────────────────────────────────
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

            // ─ SUDO SCORE ────────────────────────────────
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

            // ─ SUDO NEXT ─────────────────────────────────
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
                // Auto-close after a brief delay so the user sees the message
                setTimeout(() => closeAdminConsole(), 1800);
                break;
            }

            // ─ HELP ──────────────────────────────────────
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

            // ─ CLEAR ─────────────────────────────────────
            case 'clear': {
                const output = document.getElementById('console-output');
                if (output) output.innerHTML = '';
                break;
            }

            // ─ EXIT ──────────────────────────────────────
            case 'exit':
            case 'quit':
            case 'q': {
                _appendLine('Closing session...', 'cline-info');
                setTimeout(() => closeAdminConsole(), 500);
                break;
            }

            // ─ EASTER EGGS ───────────────────────────────
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
                _appendLine('drwxr-xr-x  secrets/', 'cline-info', true);
                _appendLine('drwxr-xr-x  grades/', 'cline-info', true);
                _appendLine('-rw-------  kru_manop_passwords.txt', 'cline-warn', true);
                _appendLine('-rw-r--r--  exam_answers_2024.pdf', 'cline-ok', true);
                break;
            }

            case 'cat kru_manop_passwords.txt': {
                _appendLine('hunter2', 'cline-ok');
                _appendLine('...wait, you weren\'t supposed to see that.', 'cline-warn');
                break;
            }

            case 'sudo make me a sandwich': {
                _appendLine('What? Make it yourself.', 'cline-warn');
                break;
            }

            // ─ DEFAULT / ACCESS DENIED ────────────────────
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

    // ── Public API ───────────────────────────────────────────
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

            // Animate in
            requestAnimationFrame(() => {
                if (inner) inner.classList.add('console-visible');
            });

            // Print welcome line
            _appendLine('Session started. Welcome, root.', 'cline-ok');
            _appendLine('Run "help" to list available commands.', 'cline-info');

            // Focus input — prevents game hotkeys from firing
            if (input) {
                input.value = '';
                setTimeout(() => input.focus(), 120);

                // Enter key → parse command
                input._onKeydown = (e) => {
                    e.stopPropagation(); // Block game key listeners

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

            // Remove listener before hiding
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

    // Reset all keys so movement doesn't 'stick'
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
    // Don't resume if admin console is still open
    if (AdminConsole.isOpen) { closeAdminConsole(); return; }
    gameState = 'PLAYING';

    showResumePrompt(false);

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0; keys.f = 0;

    window.focus();

    if (player) spawnFloatingText('▶ RESUMED', player.x, player.y - 50, '#34d399', 18);
}

function openDatabase()   { openExternalDatabase(); }
function showMathModal()  { openExternalDatabase(); }
function closeMathModal() { resumeGame(); }

window.openExternalDatabase = openExternalDatabase;
window.openDatabase         = openDatabase;
window.resumeGame           = resumeGame;
window.showMathModal        = showMathModal;
window.closeMathModal       = closeMathModal;

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

    // Terminal green indicator light (shows admin console available)
    const tGlow = Math.abs(Math.sin(performance.now() / 400)) * 0.6 + 0.4;
    CTX.fillStyle  = `rgba(0,255,65,${tGlow})`;
    CTX.shadowBlur  = 8;
    CTX.shadowColor = '#00ff41';
    CTX.beginPath();
    CTX.arc(-10, 15, 3, 0, Math.PI * 2);
    CTX.fill();

    CTX.shadowBlur = 0;
    CTX.fillStyle  = '#67e8f9';
    CTX.font       = 'bold 7px Arial';
    CTX.textAlign  = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText('MTC DATABASE', 0, 33);

    CTX.restore();
}

function updateDatabaseServerUI() {
    if (!player) return;
    const d    = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const near = d < MTC_DATABASE_SERVER.INTERACTION_RADIUS;

    const promptEl     = document.getElementById('db-prompt');
    const hudIcon      = document.getElementById('db-hud-icon');
    const btnDb        = document.getElementById('btn-database');
    const consolePrompt = document.getElementById('console-prompt');
    const consoleHud   = document.getElementById('console-hud-icon');
    const btnTerminal  = document.getElementById('btn-terminal');

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
    const screen = worldToScreen(MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    const t      = performance.now() / 700;
    const glow   = Math.abs(Math.sin(t)) * 0.5 + 0.5;
    const bounce = Math.sin(performance.now() / 500) * 3;

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

    CTX.fillStyle = 'rgba(0,0,0,0.4)';
    CTX.beginPath();
    CTX.ellipse(screen.x, screen.y + 32, 22, 8, 0, 0, Math.PI * 2);
    CTX.fill();

    CTX.save();
    CTX.translate(screen.x, screen.y + bounce);
    CTX.shadowBlur  = 18 * glow;
    CTX.shadowColor = '#facc15';

    CTX.fillStyle   = '#78350f';
    CTX.strokeStyle = '#facc15';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.roundRect(-22, 0, 44, 28, 4);
    CTX.fill();
    CTX.stroke();

    CTX.fillStyle = '#92400e';
    CTX.beginPath();
    CTX.roundRect(-22, -6, 44, 10, 3);
    CTX.fill();
    CTX.strokeStyle = '#fbbf24';
    CTX.lineWidth = 1.5;
    CTX.stroke();

    CTX.strokeStyle = '#d97706';
    CTX.lineWidth   = 3;
    CTX.beginPath(); CTX.moveTo(-18, -6); CTX.lineTo(-18, -34); CTX.stroke();
    CTX.beginPath(); CTX.moveTo( 18, -6); CTX.lineTo( 18, -34); CTX.stroke();

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

    CTX.fillStyle = '#f59e0b';
    for (let i = 0; i < 5; i++) {
        CTX.beginPath();
        CTX.arc(-20 + i * 10, -24, 5, 0, Math.PI);
        CTX.fill();
    }

    CTX.font          = '16px Arial';
    CTX.textAlign     = 'center';
    CTX.textBaseline  = 'middle';
    CTX.shadowBlur    = 0;
    CTX.fillText('🛒', 0, 10);

    const coinBounce = Math.sin(performance.now() / 350) * 4;
    CTX.font     = '14px Arial';
    CTX.fillText('🪙', 0, -46 + coinBounce);

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
            player._baseDamageBoost   = player.damageBoost || 1.0;
            player.damageBoost        = (player.damageBoost || 1.0) * item.mult;
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
            player._baseMoveSpeed     = player.moveSpeed;
            player.moveSpeed          = player.moveSpeed * item.mult;
            player.shopSpeedBoostActive = true;
            player.shopSpeedBoostTimer  = item.duration;
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

window.openShop   = openShop;
window.closeShop  = closeShop;
window.buyItem    = buyItem;

// ══════════════════════════════════════════════════════════════
// 🐕 BARK WAVE — Sonic cone visual emitted by Bark attack
// ══════════════════════════════════════════════════════════════
class BarkWave {
    constructor(x, y, angle, coneHalf, range) {
        this.x        = x;
        this.y        = y;
        this.angle    = angle;
        this.coneHalf = coneHalf;
        this.range    = range;
        this.timer    = 0;
        this.duration = 0.55;
        this.rings    = 5;
    }

    update(dt) {
        this.timer += dt;
        return this.timer >= this.duration;
    }

    draw() {
        const screen   = worldToScreen(this.x, this.y);
        const progress = this.timer / this.duration;
        const alpha    = 1 - progress;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        for (let i = 0; i < this.rings; i++) {
            const frac = (progress + i / this.rings) % 1;
            const r    = frac * this.range;
            if (r < 4) continue;

            const ringAlpha = alpha * (1 - i / this.rings) * 0.75;
            if (ringAlpha <= 0) continue;

            CTX.save();
            CTX.globalAlpha   = ringAlpha;
            CTX.strokeStyle   = i % 2 === 0 ? '#f59e0b' : '#fbbf24';
            CTX.lineWidth     = Math.max(1, 3.5 - i * 0.5);
            CTX.shadowBlur    = 12;
            CTX.shadowColor   = '#d97706';
            CTX.lineCap       = 'round';

            CTX.beginPath();
            CTX.arc(0, 0, r, -this.coneHalf, this.coneHalf);
            CTX.stroke();

            CTX.beginPath();
            CTX.moveTo(Math.cos(-this.coneHalf) * Math.max(0, r - 25),
                       Math.sin(-this.coneHalf) * Math.max(0, r - 25));
            CTX.lineTo(Math.cos(-this.coneHalf) * r,
                       Math.sin(-this.coneHalf) * r);
            CTX.stroke();

            CTX.beginPath();
            CTX.moveTo(Math.cos(this.coneHalf) * Math.max(0, r - 25),
                       Math.sin(this.coneHalf) * Math.max(0, r - 25));
            CTX.lineTo(Math.cos(this.coneHalf) * r,
                       Math.sin(this.coneHalf) * r);
            CTX.stroke();

            CTX.restore();
        }

        if (progress < 0.25) {
            const flashAlpha = (1 - progress / 0.25) * 0.8;
            CTX.globalAlpha = flashAlpha;
            CTX.fillStyle   = '#fbbf24';
            CTX.shadowBlur  = 20;
            CTX.shadowColor = '#f59e0b';
            CTX.beginPath();
            CTX.arc(0, 0, 14 * (1 - progress / 0.25), 0, Math.PI * 2);
            CTX.fill();
        }

        CTX.restore();
    }
}

// ══════════════════════════════════════════════════════════════
// 👑 BOSS — "KRU MANOP THE DOG RIDER"
// ══════════════════════════════════════════════════════════════
class Boss extends Entity {
    constructor(difficulty = 1, isRider = false) {
        super(0, BALANCE.boss.spawnY, BALANCE.boss.radius);
        this.maxHp      = BALANCE.boss.baseHp * difficulty;
        this.hp         = this.maxHp;
        this.name       = "KRU MANOP";
        this.state      = 'CHASE';
        this.timer      = 0;
        this.moveSpeed  = BALANCE.boss.moveSpeed;
        this.difficulty = difficulty;
        this.phase      = 1;
        this.sayTimer   = 0;

        this.isRider = isRider;

        this.skills = {
            slam:  { cd: 0, max: BALANCE.boss.slamCooldown },
            graph: { cd: 0, max: BALANCE.boss.graphCooldown },
            log:   { cd: 0, max: BALANCE.boss.log457Cooldown },
            bark:  { cd: 0, max: BALANCE.boss.phase2.barkCooldown }
        };

        this.log457State       = null;
        this.log457Timer       = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable    = false;

        this.isEnraged   = false;
        this.dogLegTimer = 0;
    }

    update(dt, player) {
        if (this.dead) return;

        const dx = player.x - this.x, dy = player.y - this.y;
        const d  = dist(this.x, this.y, player.x, player.y);
        this.angle    = Math.atan2(dy, dx);
        this.timer   += dt;
        this.sayTimer += dt;

        if (this.isRider) {
            this.dogLegTimer += dt * (this.isEnraged ? 2.5 : 1.0);
        }

        for (let s in this.skills) if (this.skills[s].cd > 0) this.skills[s].cd -= dt;

        if (this.sayTimer > BALANCE.boss.speechInterval && Math.random() < 0.1) {
            this.speak("Player at " + Math.round(player.hp) + " HP");
            this.sayTimer = 0;
        }

        if (this.hp < this.maxHp * BALANCE.boss.phase2Threshold && this.phase === 1) {
            this.phase     = 2;
            this.isEnraged = true;
            this.moveSpeed = BALANCE.boss.moveSpeed * BALANCE.boss.phase2.enrageSpeedMult;
            spawnFloatingText("ENRAGED!", this.x, this.y - 80, '#ef4444', 40);
            if (this.isRider) {
                spawnFloatingText("🐕 DOG RIDER!", this.x, this.y - 120, '#d97706', 32);
            }
            addScreenShake(20);
            spawnParticles(this.x, this.y, 35, '#ef4444');
            spawnParticles(this.x, this.y, 20, '#d97706');
            this.speak(this.isRider ? "Hop on, boy! Let's go!" : "You think you can stop me?!");
            Audio.playBossSpecial();
        }

        if (this.log457State === 'charging') {
            this.log457Timer += dt;
            this.isInvulnerable = true;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * BALANCE.boss.log457HealRate * dt);
            if (this.log457Timer >= BALANCE.boss.log457ChargeDuration) {
                this.log457State       = 'active';
                this.log457Timer       = 0;
                this.log457AttackBonus = BALANCE.boss.log457AttackBonus;
                this.isInvulnerable    = false;
                addScreenShake(20);
                spawnFloatingText("67! 67! 67!", this.x, this.y - 80, '#facc15', 35);
                this.speak("0.6767!");
            }
        } else if (this.log457State === 'active') {
            this.log457Timer += dt;
            this.log457AttackBonus += BALANCE.boss.log457AttackGrowth * dt;
            if (this.log457Timer >= BALANCE.boss.log457ActiveDuration) {
                this.log457State = 'stunned';
                this.log457Timer = 0;
                this.vx = 0; this.vy = 0;
                spawnFloatingText("STUNNED!", this.x, this.y - 60, '#94a3b8', 30);
            }
        } else if (this.log457State === 'stunned') {
            this.log457Timer += dt;
            this.vx = 0; this.vy = 0;
            if (this.log457Timer >= BALANCE.boss.log457StunDuration) {
                this.log457State       = null;
                this.log457AttackBonus = 0;
            }
            return;
        }

        if (this.state === 'CHASE') {
            if (!player.isInvisible) {
                this.vx = Math.cos(this.angle) * this.moveSpeed;
                this.vy = Math.sin(this.angle) * this.moveSpeed;
            } else { this.vx *= 0.95; this.vy *= 0.95; }
            this.applyPhysics(dt);

            if (this.timer > 2) {
                this.timer = 0;
                const barkChance = (this.isRider && this.phase === 2) ? 0.40
                                 : (this.isRider)                     ? 0.18
                                 : 0;
                if      (this.skills.log.cd   <= 0 && Math.random() < 0.20) this.useLog457();
                else if (this.skills.graph.cd <= 0 && Math.random() < 0.25) this.useDeadlyGraph(player);
                else if (this.isRider && this.skills.bark.cd <= 0 && Math.random() < barkChance) this.bark(player);
                else if (this.skills.slam.cd  <= 0 && Math.random() < 0.30) this.useEquationSlam();
                else this.state = Math.random() < 0.3 ? 'ULTIMATE' : 'ATTACK';
            }
        } else if (this.state === 'ATTACK') {
            this.vx *= 0.9; this.vy *= 0.9;
            const fr = this.phase === 2 ? BALANCE.boss.phase2AttackFireRate : BALANCE.boss.attackFireRate;
            const bf = fr / (1 + this.log457AttackBonus);
            if (this.timer > bf) {
                projectileManager.add(new Projectile(this.x, this.y, this.angle, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                if (this.phase === 2) {
                    projectileManager.add(new Projectile(this.x, this.y, this.angle + 0.3, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                    projectileManager.add(new Projectile(this.x, this.y, this.angle - 0.3, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                }
                this.timer = 0;
                if (Math.random() < 0.08) this.state = 'CHASE';
            }
        } else if (this.state === 'ULTIMATE') {
            this.vx = 0; this.vy = 0;
            if (this.timer > 1) {
                const bullets = this.phase === 2 ? BALANCE.boss.phase2UltimateBullets : BALANCE.boss.ultimateBullets;
                for (let i = 0; i < bullets; i++) {
                    const a = (Math.PI * 2 / bullets) * i;
                    projectileManager.add(new Projectile(this.x, this.y, a, BALANCE.boss.ultimateProjectileSpeed, BALANCE.boss.ultimateDamage, '#ef4444', true, 'enemy'));
                }
                addScreenShake(15);
                spawnFloatingText("POP QUIZ!", this.x, this.y - 80, '#facc15', 40);
                Audio.playBossSpecial();
                this.state = 'CHASE';
                this.timer = -1;
            }
        }

        if (d < this.radius + player.radius) {
            player.takeDamage(BALANCE.boss.contactDamage * dt * (1 + this.log457AttackBonus));
        }

        UIManager.updateBossHUD(this);
        UIManager.updateBossSpeech(this);
    }

    bark(player) {
        const P2       = BALANCE.boss.phase2;
        this.skills.bark.cd = this.skills.bark.max;
        this.state = 'CHASE';

        const barkAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const coneHalf  = Math.PI / 3.5;

        window.specialEffects.push(new BarkWave(this.x, this.y, barkAngle, coneHalf, P2.barkRange));

        const dx = player.x - this.x, dy = player.y - this.y;
        const d  = Math.hypot(dx, dy);
        if (d > 0 && d < P2.barkRange) {
            const playerAngle = Math.atan2(dy, dx);
            let   diff        = playerAngle - barkAngle;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            if (Math.abs(diff) < coneHalf) {
                player.takeDamage(P2.barkDamage);
                const pushMag = 480;
                player.vx += (dx / d) * pushMag;
                player.vy += (dy / d) * pushMag;
                spawnFloatingText('BARK! 🐕', player.x, player.y - 55, '#f59e0b', 26);
                addScreenShake(10);
            }
        }

        spawnFloatingText('WOOF WOOF!', this.x, this.y - 100, '#d97706', 30);
        spawnParticles(this.x, this.y, 12, '#d97706');
        Audio.playBossSpecial();
        this.speak("BARK BARK BARK!");
    }

    useEquationSlam() {
        this.skills.slam.cd = this.skills.slam.max;
        this.state = 'CHASE';
        addScreenShake(15);
        spawnFloatingText("EQUATION SLAM!", this.x, this.y - 80, '#facc15', 30);
        this.speak("Equation Slam!");
        Audio.playBossSpecial();
        window.specialEffects.push(new EquationSlam(this.x, this.y));
    }

    useDeadlyGraph(player) {
        this.skills.graph.cd = this.skills.graph.max;
        this.state = 'CHASE';
        spawnFloatingText("DEADLY GRAPH!", this.x, this.y - 80, '#3b82f6', 30);
        this.speak("Feel the power of y=x!");
        Audio.playBossSpecial();
        window.specialEffects.push(new DeadlyGraph(this.x, this.y, player.x, player.y, BALANCE.boss.graphDuration));
    }

    useLog457() {
        this.skills.log.cd = this.skills.log.max;
        this.log457State   = 'charging';
        this.log457Timer   = 0;
        this.state         = 'CHASE';
        spawnFloatingText("log 4.57 = ?", this.x, this.y - 80, '#ef4444', 30);
        Audio.playBossSpecial();
    }

    async speak(context) {
        try {
            const text = await Gemini.getBossTaunt(context);
            if (text) UIManager.showBossSpeech(text);
        } catch (e) { console.warn('Speech failed:', e); }
    }

    takeDamage(amt) {
        if (this.isInvulnerable) {
            spawnFloatingText('INVINCIBLE!', this.x, this.y - 40, '#facc15', 20);
            return;
        }
        this.hp -= amt;
        if (this.hp <= 0) {
            this.dead = true; this.hp = 0;
            spawnParticles(this.x, this.y, 60, '#dc2626');
            spawnFloatingText("CLASS DISMISSED!", this.x, this.y, '#facc15', 35);
            addScore(BALANCE.score.boss * this.difficulty);
            UIManager.updateBossHUD(null);
            Audio.playAchievement();
            for (let i = 0; i < 3; i++) {
                setTimeout(() => window.powerups.push(new PowerUp(this.x + rand(-50,50), this.y + rand(-50,50))), i * 200);
            }
            window.boss = null;
            Achievements.check('boss_down');
            setTimeout(() => {
                setWave(getWave() + 1);
                if (getWave() > BALANCE.waves.maxWaves) window.endGame('victory');
                else startNextWave();
            }, BALANCE.boss.nextWaveDelay);
        }
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const RIDER_OFFSET_Y = this.isRider ? -22 : 0;

        CTX.save();
        CTX.translate(screen.x, screen.y);

        if (this.log457State === 'charging') {
            const sc = 1 + (this.log457Timer / 2) * 0.3;
            CTX.scale(sc, sc);
            const pu = Math.sin(this.log457Timer * 10) * 0.5 + 0.5;
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(239, 68, 68, ${pu * 0.3})`; CTX.fill();
        }

        if (this.log457State === 'active')  { CTX.shadowBlur = 20; CTX.shadowColor = '#facc15'; }
        if (this.log457State === 'stunned') {
            CTX.font = 'bold 30px Arial'; CTX.textAlign = 'center'; CTX.fillText('😵', 0, -70);
        }

        if (this.state === 'ULTIMATE') {
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.strokeStyle = `rgba(239, 68, 68, ${Math.random()})`;
            CTX.lineWidth = 5; CTX.stroke();
        }

        if (this.phase === 2 && this.log457State !== 'charging') {
            CTX.shadowBlur = 20; CTX.shadowColor = '#ef4444';
        }

        CTX.rotate(this.angle);

        if (this.isRider) {
            this._drawDog();
        }

        CTX.save();
        CTX.translate(0, RIDER_OFFSET_Y);

        CTX.fillStyle = '#f8fafc'; CTX.fillRect(-30, -30, 60, 60);
        CTX.fillStyle = '#e2e8f0';
        CTX.beginPath(); CTX.moveTo(-30,-30); CTX.lineTo(-20,-20); CTX.lineTo(20,-20); CTX.lineTo(30,-30); CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#ef4444';
        CTX.beginPath(); CTX.moveTo(0,-20); CTX.lineTo(6,0); CTX.lineTo(0,25); CTX.lineTo(-6,0); CTX.closePath(); CTX.fill();
        CTX.fillStyle = this.log457State === 'charging' ? '#ff0000' : '#e2e8f0';
        CTX.beginPath(); CTX.arc(0, 0, 24, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#94a3b8'; CTX.beginPath(); CTX.arc(0, 0, 26, Math.PI, 0); CTX.fill();
        if (this.phase === 2 || this.log457State === 'active') {
            CTX.fillStyle = '#ef4444';
            CTX.fillRect(-12,-5,10,3); CTX.fillRect(2,-5,10,3);
        }
        CTX.fillStyle = '#facc15'; CTX.fillRect(25, 12, 60, 10);
        CTX.fillStyle = '#000'; CTX.font = 'bold 8px Arial'; CTX.fillText('30cm', 50, 17);

        if (this.isEnraged) {
            const t = performance.now() / 80;
            for (let i = 0; i < 4; i++) {
                const px = Math.sin(t * 0.9 + i * 1.57) * 18;
                const py = -Math.abs(Math.cos(t * 1.1 + i * 1.57)) * 22 - 30;
                const ps = 3 + Math.sin(t + i) * 1.5;
                CTX.globalAlpha = 0.55 + Math.sin(t + i) * 0.3;
                CTX.fillStyle   = i % 2 === 0 ? '#ef4444' : '#f97316';
                CTX.shadowBlur  = 8;
                CTX.shadowColor = '#ef4444';
                CTX.beginPath();
                CTX.arc(px, py, ps, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.globalAlpha = 1;
            CTX.shadowBlur  = 0;
        }

        CTX.restore();
        CTX.restore();
    }

    _drawDog() {
        const P2       = BALANCE.boss.phase2;
        const bodyCol  = this.isEnraged ? '#dc2626' : P2.dogColor;
        const darkCol  = this.isEnraged ? '#991b1b' : '#92400e';
        const lightCol = this.isEnraged ? '#ef4444' : '#b45309';
        const eyeCol   = this.isEnraged ? '#facc15' : '#1e293b';

        const legSpeed  = this.isEnraged ? 9 : 4.5;
        const swingAmt  = 0.45;
        const swingA    =  Math.sin(this.dogLegTimer * legSpeed) * swingAmt;
        const swingB    = -swingA;

        const LEG_LEN  = 20;
        const PAW_RY   = 4;

        CTX.save();
        CTX.globalAlpha = 0.22;
        CTX.fillStyle   = 'rgba(0,0,0,0.9)';
        CTX.beginPath();
        CTX.ellipse(6, 62, 44, 10, 0, 0, Math.PI * 2);
        CTX.fill();
        CTX.restore();

        const drawLeg = (pivotX, pivotY, swingAngle, pawTiltSign) => {
            CTX.save();
            CTX.translate(pivotX, pivotY);
            CTX.rotate(swingAngle);

            CTX.strokeStyle = darkCol;
            CTX.lineWidth   = 7;
            CTX.lineCap     = 'round';
            CTX.beginPath();
            CTX.moveTo(0, 0);
            CTX.lineTo(0, LEG_LEN);
            CTX.stroke();

            CTX.fillStyle = darkCol;
            CTX.beginPath();
            CTX.arc(0, LEG_LEN, 3.5, 0, Math.PI * 2);
            CTX.fill();

            CTX.strokeStyle = darkCol;
            CTX.lineWidth   = 5;
            CTX.beginPath();
            CTX.moveTo(0, LEG_LEN);
            CTX.lineTo(pawTiltSign * 3, LEG_LEN + 11);
            CTX.stroke();

            CTX.fillStyle = darkCol;
            CTX.beginPath();
            CTX.ellipse(pawTiltSign * 3, LEG_LEN + 13, 6, PAW_RY, pawTiltSign * 0.25, 0, Math.PI * 2);
            CTX.fill();

            CTX.restore();
        };

        drawLeg( 14, 36,  swingA, -1);
        drawLeg( 26, 36,  swingB,  1);
        drawLeg(-14, 36,  swingB, -1);
        drawLeg( -2, 36,  swingA,  1);

        CTX.fillStyle   = bodyCol;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 2.5;
        CTX.beginPath();
        CTX.ellipse(6, 28, 44, 18, 0, 0, Math.PI * 2);
        CTX.fill();
        CTX.stroke();

        CTX.fillStyle = lightCol;
        CTX.beginPath();
        CTX.ellipse(0, 20, 22, 10, 0, 0, Math.PI * 2);
        CTX.fill();

        const tailWag = Math.sin(this.dogLegTimer * (this.isEnraged ? 12 : 6)) * 18;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 6;
        CTX.lineCap     = 'round';
        CTX.beginPath();
        CTX.moveTo(-44, 22);
        CTX.quadraticCurveTo(-58, 8, -55 + tailWag * 0.35, -6 + tailWag);
        CTX.stroke();
        CTX.fillStyle = bodyCol;
        CTX.beginPath();
        CTX.arc(-55 + tailWag * 0.35, -7 + tailWag, 7, 0, Math.PI * 2);
        CTX.fill();

        CTX.fillStyle   = bodyCol;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 2.5;
        CTX.beginPath();
        CTX.arc(52, 20, 18, 0, Math.PI * 2);
        CTX.fill();
        CTX.stroke();

        CTX.fillStyle   = darkCol;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 1.5;
        CTX.beginPath();
        CTX.ellipse(44, 8, 9, 15, -0.5, 0, Math.PI * 2);
        CTX.fill();

        CTX.fillStyle   = lightCol;
        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 1.5;
        CTX.beginPath();
        CTX.ellipse(64, 23, 12, 8, 0.2, 0, Math.PI * 2);
        CTX.fill();
        CTX.stroke();

        CTX.fillStyle = '#1e293b';
        CTX.beginPath();
        CTX.arc(71, 20, 3.5, 0, Math.PI * 2);
        CTX.fill();

        CTX.fillStyle   = eyeCol;
        CTX.shadowBlur  = this.isEnraged ? 8 : 0;
        CTX.shadowColor = '#facc15';
        CTX.beginPath();
        CTX.arc(56, 13, 4, 0, Math.PI * 2);
        CTX.fill();
        CTX.shadowBlur = 0;
        CTX.fillStyle  = '#1e293b';
        CTX.beginPath();
        CTX.arc(57, 13, 2, 0, Math.PI * 2);
        CTX.fill();

        CTX.strokeStyle = darkCol;
        CTX.lineWidth   = 2;
        CTX.lineCap     = 'round';
        CTX.beginPath();
        CTX.arc(63, 24, 5, 0.1, Math.PI - 0.1);
        CTX.stroke();

        if (this.isEnraged || Math.sin(this.dogLegTimer * 3) > 0.2) {
            CTX.fillStyle = '#fb7185';
            CTX.beginPath();
            CTX.ellipse(63, 32, 5, 7, 0, 0, Math.PI * 2);
            CTX.fill();
        }

        if (this.isEnraged) {
            const t = performance.now() / 120;
            CTX.save();
            for (let i = 0; i < 5; i++) {
                const ex = Math.sin(t * 0.7 + i * 1.26) * 36;
                const ey = Math.cos(t * 0.9 + i * 1.26) * 16 + 28;
                const er = 3 + Math.sin(t * 1.5 + i) * 1.5;
                CTX.globalAlpha = 0.5 + Math.sin(t + i) * 0.3;
                CTX.fillStyle   = i % 2 === 0 ? '#ef4444' : '#f97316';
                CTX.shadowBlur  = 10;
                CTX.shadowColor = '#ef4444';
                CTX.beginPath();
                CTX.arc(ex, ey, er, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.restore();
        }
    }
}

// ==================== WAVE SYSTEM ====================
function startNextWave() {
    resetEnemiesKilled();
    waveStartDamage = Achievements.stats.damageTaken;
    setElementText('wave-badge', `WAVE ${getWave()}`);
    spawnFloatingText(`WAVE ${getWave()}`, player.x, player.y - 100, '#8b5cf6', 40);

    const count = BALANCE.waves.enemiesBase + (getWave() - 1) * BALANCE.waves.enemiesPerWave;
    spawnEnemies(count);

    if (getWave() % BALANCE.waves.bossEveryNWaves === 0) {
        setTimeout(() => {
            bossEncounterCount++;
            const isRider   = bossEncounterCount >= 2;
            const bossLevel = Math.floor(getWave() / BALANCE.waves.bossEveryNWaves);

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

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const angle    = Math.random() * Math.PI * 2;
        const distance = BALANCE.waves.spawnDistance;
        let x = player.x + Math.cos(angle) * distance;
        let y = player.y + Math.sin(angle) * distance;
        const safe = mapSystem.findSafeSpawn(x, y, BALANCE.enemy.radius);
        x = safe.x; y = safe.y;
        const r = Math.random();
        if      (r < BALANCE.waves.mageSpawnChance) window.enemies.push(new MageEnemy(x, y));
        else if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance) window.enemies.push(new TankEnemy(x, y));
        else    window.enemies.push(new Enemy(x, y));
    }
}

// ══════════════════════════════════════════════════════════════
// 🕐 BULLET TIME — toggle, energy, visual overlay
// ══════════════════════════════════════════════════════════════

/**
 * toggleSlowMotion()
 * Called on 'T' keydown. Activates/deactivates Bullet Time.
 * Blocked if energy is below 5 % (nearly empty).
 */
function toggleSlowMotion() {
    if (!isSlowMotion) {
        // Block activation on empty / near-empty tank
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
 * Must be called with REAL (unscaled) dt so the drain/recharge
 * always happens at wall-clock speed, not slowed-down game speed.
 */
function _tickSlowMoEnergy(realDt) {
    if (isSlowMotion) {
        slowMoEnergy = Math.max(0, slowMoEnergy - SLOW_MO_DRAIN_RATE * realDt);
        // Auto-deactivate when tank hits zero
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
 * Post-process pass drawn AFTER world-space CTX.restore().
 * Layers:
 *   1. Radial vignette — cyan-tinted dark edges
 *   2. Chromatic aberration — red/blue channel ghost at ±2 px
 *   3. Letterbox bars — top & bottom scanline cinema crop
 *   4. BULLET TIME badge — bottom-centre with animated energy bar
 *   5. Clock-tick particles around the player position
 */
function drawSlowMoOverlay() {
    if (!isSlowMotion && slowMoEnergy >= 1.0) return; // nothing to draw at full energy normal speed

    const W = CANVAS.width, H = CANVAS.height;
    const now = performance.now();

    // ── 1. Radial vignette (cyan edge glow) ──────────────────
    if (isSlowMotion) {
        const vig = CTX.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.78);
        vig.addColorStop(0, 'rgba(0, 229, 255, 0.00)');
        vig.addColorStop(0.65, 'rgba(0, 200, 255, 0.06)');
        vig.addColorStop(1,    'rgba(0, 100, 200, 0.38)');
        CTX.fillStyle = vig;
        CTX.fillRect(0, 0, W, H);

        // ── 2. Chromatic aberration (R / B ghost rects) ──────
        const offset = 2 + Math.sin(now / 80) * 0.8;
        CTX.save();
        // Red channel ghost — shifted left
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = 0.04;
        CTX.fillStyle = '#ff0000';
        CTX.fillRect(-offset, 0, W, H);
        // Blue channel ghost — shifted right
        CTX.fillStyle = '#0000ff';
        CTX.fillRect(offset, 0, W, H);
        CTX.globalAlpha = 1;
        CTX.globalCompositeOperation = 'source-over';
        CTX.restore();

        // ── 3. Letterbox bars (top + bottom) ─────────────────
        const barH = 28;
        const scanAlpha = 0.55 + Math.sin(now / 200) * 0.1;
        CTX.save();
        CTX.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
        CTX.fillRect(0, 0, W, barH);
        CTX.fillRect(0, H - barH, W, barH);
        // Thin cyan line border of bars
        CTX.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        CTX.lineWidth   = 1;
        CTX.beginPath();
        CTX.moveTo(0, barH); CTX.lineTo(W, barH); CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(0, H - barH); CTX.lineTo(W, H - barH); CTX.stroke();
        CTX.restore();
    }

    // ── 4. BULLET TIME badge + energy bar (bottom-centre) ────
    {
        const bx = W / 2;
        const by = H - 44;
        const pulse = Math.abs(Math.sin(now / 320));

        CTX.save();

        // Badge background
        const badgePad = { x: SM_BAR_W / 2 + 20, y: 30 };
        CTX.fillStyle = isSlowMotion
            ? `rgba(0, 20, 30, ${0.78 + pulse * 0.12})`
            : 'rgba(0, 10, 20, 0.55)';
        _roundRectPath(CTX, bx - badgePad.x, by - badgePad.y - 4, badgePad.x * 2, badgePad.y + 18, 8);
        CTX.fill();

        // Badge border
        CTX.strokeStyle = isSlowMotion
            ? `rgba(0, 229, 255, ${0.55 + pulse * 0.35})`
            : 'rgba(0, 229, 255, 0.22)';
        CTX.lineWidth = 1.5;
        CTX.stroke();

        // ⏱ icon + label
        if (isSlowMotion) {
            CTX.shadowBlur  = 12 + pulse * 8;
            CTX.shadowColor = '#00e5ff';
        }
        CTX.font          = 'bold 12px Arial';
        CTX.textAlign     = 'center';
        CTX.textBaseline  = 'middle';
        CTX.fillStyle     = isSlowMotion ? `rgba(0, 229, 255, ${0.8 + pulse * 0.2})` : 'rgba(0, 180, 220, 0.55)';
        CTX.fillText(isSlowMotion ? '🕐 BULLET TIME' : '⚡ RECHARGING', bx, by - badgePad.y + 8);
        CTX.shadowBlur = 0;

        // Energy bar track
        const barX = bx - SM_BAR_W / 2;
        const barY = by - 6;
        CTX.fillStyle = 'rgba(0, 30, 40, 0.8)';
        _roundRectPath(CTX, barX, barY, SM_BAR_W, SM_BAR_H, 4);
        CTX.fill();

        // Energy bar fill (colour shifts red when low)
        const fillW = SM_BAR_W * slowMoEnergy;
        const r = Math.round(lerp(0,   220, 1 - slowMoEnergy));
        const g = Math.round(lerp(229, 60,  1 - slowMoEnergy));
        const b = Math.round(lerp(255, 30,  1 - slowMoEnergy));
        CTX.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
        if (fillW > 0) {
            _roundRectPath(CTX, barX, barY, fillW, SM_BAR_H, 4);
            CTX.fill();
            if (isSlowMotion) {
                CTX.shadowBlur  = 8;
                CTX.shadowColor = `rgb(${r}, ${g}, ${b})`;
                CTX.fill(); // second fill for glow
                CTX.shadowBlur = 0;
            }
        }

        // Tick marks on energy bar
        CTX.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        CTX.lineWidth   = 1;
        for (let i = 1; i < 5; i++) {
            const tx = barX + (SM_BAR_W / 5) * i;
            CTX.beginPath(); CTX.moveTo(tx, barY); CTX.lineTo(tx, barY + SM_BAR_H); CTX.stroke();
        }

        // Percentage text
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
        const angle  = Math.random() * Math.PI * 2;
        const radius = 32 + Math.random() * 28;
        const px     = screen.x + Math.cos(angle) * radius;
        const py     = screen.y + Math.sin(angle) * radius;
        const symbols = ['⏱', '⌛', '◈', '⧖'];
        CTX.save();
        CTX.globalAlpha = 0.45 + Math.random() * 0.35;
        CTX.font        = `${10 + Math.random() * 6}px Arial`;
        CTX.textAlign   = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillStyle   = '#00e5ff';
        CTX.shadowBlur  = 6;
        CTX.shadowColor = '#00e5ff';
        CTX.fillText(symbols[Math.floor(Math.random() * symbols.length)], px, py);
        CTX.restore();
    }
}

/** Tiny helper: draw a rounded-rect path (needed since some older envs lack roundRect on ctx) */
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

// ==================== GAME LOOP ====================
function gameLoop(now) {
    const dt = getDeltaTime(now); // real-world frame delta (unscaled)

    // ── Bullet Time energy ticks at real speed regardless of timeScale ──
    if (gameState === 'PLAYING') {
        _tickSlowMoEnergy(dt);
    }

    // Scale dt for all game-world simulation
    const scaledDt = dt * timeScale;

    if (gameState === 'PLAYING') {
        updateGame(scaledDt);
        drawGame();
    } else if (gameState === 'PAUSED') {
        drawGame();
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

    dayNightTimer += dt;
    {
        const L   = BALANCE.LIGHTING;
        const phi = (dayNightTimer / L.cycleDuration) * Math.PI * 2;
        const dayPhase = Math.sin(phi) * 0.5 + 0.5;
        L.ambientLight = L.nightMinLight + dayPhase * (L.dayMaxLight - L.nightMinLight);
    }

    // ── Shop buff timers ──
    if (player.shopDamageBoostActive) {
        player.shopDamageBoostTimer -= dt;
        if (player.shopDamageBoostTimer <= 0) {
            player.shopDamageBoostActive = false;
            if (player._baseDamageBoost !== undefined) {
                player.damageBoost = player._baseDamageBoost;
            } else {
                player.damageBoost = 1.0;
            }
            spawnFloatingText('DMG Boost หมดแล้ว', player.x, player.y - 50, '#94a3b8', 14);
        }
    }

    if (player.shopSpeedBoostActive) {
        player.shopSpeedBoostTimer -= dt;
        if (player.shopSpeedBoostTimer <= 0) {
            player.shopSpeedBoostActive = false;
            if (player._baseMoveSpeed !== undefined) {
                player.moveSpeed = player._baseMoveSpeed;
            }
            spawnFloatingText('SPD Boost หมดแล้ว', player.x, player.y - 50, '#94a3b8', 14);
        }
    }

    // Database server: check E key
    const dToServer = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    if (dToServer < MTC_DATABASE_SERVER.INTERACTION_RADIUS && keys.e === 1) {
        keys.e = 0;
        openExternalDatabase();
        return;
    }

    // Admin Console: check F key (same server proximity zone)
    if (dToServer < MTC_DATABASE_SERVER.INTERACTION_RADIUS && keys.f === 1) {
        keys.f = 0;
        openAdminConsole();
        return;
    }

    // Shop: check B key
    const dToShop = dist(player.x, player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    if (dToShop < MTC_SHOP_LOCATION.INTERACTION_RADIUS && keys.b === 1) {
        keys.b = 0;
        openShop();
        return;
    }

    player.update(dt, keys, mouse);

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

    if (window.drone && player && !player.dead) {
        window.drone.update(dt, player);
    }

    if (boss) boss.update(dt, player);

    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update(dt, player);
        if (enemies[i].dead) enemies.splice(i, 1);
    }

    if (getWave() % BALANCE.waves.bossEveryNWaves !== 0 && enemies.length === 0 && !boss) {
        if (Achievements.stats.damageTaken === waveStartDamage && getEnemiesKilled() >= BALANCE.waves.minKillsForNoDamage) {
            Achievements.check('no_damage');
        }
        setWave(getWave() + 1);
        Achievements.check('wave_1');
        startNextWave();
    }

    for (let i = specialEffects.length - 1; i >= 0; i--) {
        const remove = specialEffects[i].update(dt, player, meteorZones);
        if (remove) specialEffects.splice(i, 1);
    }

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

    mapSystem.update([player, ...enemies, boss].filter(e => e && !e.dead));
    particleSystem.update(dt);
    floatingTextSystem.update(dt);
    updateScreenShake();
    Achievements.checkAll();

    updateDatabaseServerUI();
    updateShopProximityUI();
}

function drawGame() {
    const grad = CTX.createLinearGradient(0, 0, 0, CANVAS.height);
    grad.addColorStop(0, GAME_CONFIG.visual.bgColorTop);
    grad.addColorStop(1, GAME_CONFIG.visual.bgColorBottom);
    CTX.fillStyle = grad;
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);

    CTX.save();
    const shake = getScreenShakeOffset();
    CTX.translate(shake.x, shake.y);

    drawGrid();

    for (let z of meteorZones) {
        const screen = worldToScreen(z.x, z.y);
        const a = Math.sin(performance.now() / 200) * 0.3 + 0.7;
        CTX.fillStyle = `rgba(239, 68, 68, ${a * 0.4})`;
        CTX.beginPath(); CTX.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2); CTX.fill();
    }

    mapSystem.draw();
    drawDatabaseServer();
    drawShopObject();

    for (const p of powerups) {
        if (p.isOnScreen ? p.isOnScreen(60) : true) p.draw();
    }

    specialEffects.forEach(e => e.draw());

    if (window.drone) window.drone.draw();

    player.draw();

    for (const e of enemies) {
        if (e.isOnScreen(80)) e.draw();
    }

    if (boss && !boss.dead && boss.isOnScreen(200)) boss.draw();
    projectileManager.draw();
    particleSystem.draw();
    floatingTextSystem.draw();

    CTX.restore();

    {
        const allProj = (typeof projectileManager !== 'undefined' && projectileManager.projectiles)
            ? projectileManager.projectiles
            : [];

        mapSystem.drawLighting(player, allProj, [
            {
                x: MTC_DATABASE_SERVER.x,
                y: MTC_DATABASE_SERVER.y,
                radius: BALANCE.LIGHTING.mtcServerLightRadius,
                type: 'cool'
            },
            {
                x: MTC_SHOP_LOCATION.x,
                y: MTC_SHOP_LOCATION.y,
                radius: BALANCE.LIGHTING.shopLightRadius,
                type: 'warm'
            }
        ]);
    }

    drawDayNightHUD();
    drawSlowMoOverlay();   // 🕐 bullet-time post-process (no-op when inactive + full energy)
}

// ══════════════════════════════════════════════════════════════
// 🌞 DAY / NIGHT HUD
// ══════════════════════════════════════════════════════════════
function drawDayNightHUD() {
    const L       = BALANCE.LIGHTING;
    const phase   = (L.ambientLight - L.nightMinLight) / (L.dayMaxLight - L.nightMinLight);
    const isDawn  = phase > 0.5;

    const cx = CANVAS.width  - 52;
    const cy = 52;
    const r  = 24;

    CTX.save();

    CTX.fillStyle   = isDawn ? 'rgba(255, 210, 80, 0.18)' : 'rgba(80, 110, 255, 0.18)';
    CTX.strokeStyle = isDawn ? 'rgba(255, 210, 80, 0.55)' : 'rgba(130, 160, 255, 0.55)';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.arc(cx, cy, r + 8, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();

    CTX.strokeStyle = isDawn ? '#fbbf24' : '#818cf8';
    CTX.lineWidth   = 3.5;
    CTX.lineCap     = 'round';
    CTX.shadowBlur  = 8;
    CTX.shadowColor = isDawn ? '#fbbf24' : '#818cf8';
    CTX.beginPath();
    CTX.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
    CTX.stroke();
    CTX.shadowBlur  = 0;

    CTX.font          = `${r}px Arial`;
    CTX.textAlign     = 'center';
    CTX.textBaseline  = 'middle';
    CTX.fillText(isDawn ? '☀️' : '🌙', cx, cy);

    CTX.fillStyle     = isDawn ? '#fde68a' : '#c7d2fe';
    CTX.font          = 'bold 8px Arial';
    CTX.textAlign     = 'center';
    CTX.textBaseline  = 'middle';
    const pct         = Math.round(phase * 100);
    CTX.fillText(isDawn ? `DAY ${pct}%` : `NIGHT ${100 - pct}%`, cx, cy + r + 14);

    CTX.restore();
}

function drawGrid() {
    const sz = GAME_CONFIG.physics.gridSize;
    const ox = -getCamera().x % sz;
    const oy = -getCamera().y % sz;
    CTX.strokeStyle = GAME_CONFIG.visual.gridColor;
    CTX.lineWidth = 1;
    CTX.beginPath();
    for (let x = ox; x < CANVAS.width; x += sz) { CTX.moveTo(x, 0); CTX.lineTo(x, CANVAS.height); }
    for (let y = oy; y < CANVAS.height; y += sz) { CTX.moveTo(0, y); CTX.lineTo(CANVAS.width, y); }
    CTX.stroke();
}

// ==================== POOM ATTACK SYSTEM ====================
function shootPoom(player) {
    const S = BALANCE.characters.poom;
    if (player.cooldowns.shoot > 0) return;
    const attackSpeedMult  = player.isEatingRice ? 0.7 : 1.0;
    player.cooldowns.shoot = S.riceCooldown * attackSpeedMult;
    const { damage, isCrit } = player.dealDamage(S.riceDamage * player.damageBoost);
    projectileManager.add(new Projectile(player.x, player.y, player.angle, S.riceSpeed, damage, S.riceColor, false, 'player'));
    if (isCrit) {
        spawnFloatingText('สาดข้าว! CRIT!', player.x, player.y - 45, '#fbbf24', 20);
        spawnParticles(player.x, player.y, 5, '#ffffff');
    }
    player.speedBoostTimer = S.speedOnHitDuration;
}

// ==================== INIT & START ====================
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

    const saveData = getSaveData();
    console.log('[MTC Save] Loaded save data:', saveData);

    UIManager.updateHighScoreDisplay(saveData.highScore);

    player = charType === 'poom' ? new PoomPlayer() : new Player(charType);

    enemies = []; powerups = []; specialEffects = []; meteorZones = [];
    boss = null;

    dayNightTimer  = 0;
    BALANCE.LIGHTING.ambientLight = BALANCE.LIGHTING.dayMaxLight;

    bossEncounterCount = 0;
    console.log('🐕 Boss encounter counter reset — encounter 1 will be plain boss');

    // ── Reset Bullet Time ─────────────────────────────────────
    isSlowMotion = false;
    timeScale    = 1.0;
    slowMoEnergy = 1.0;
    console.log('🕐 Bullet Time reset — timeScale 1.0, energy full');

    // Reset shop buff state
    player.shopDamageBoostActive = false;
    player.shopDamageBoostTimer  = 0;
    player._baseDamageBoost      = undefined;
    player.shopSpeedBoostActive  = false;
    player.shopSpeedBoostTimer   = 0;
    player._baseMoveSpeed        = undefined;

    // 🤖 Create the Engineering Drone
    window.drone = new Drone();
    window.drone.x = player.x;
    window.drone.y = player.y;
    spawnFloatingText('🤖 DRONE ONLINE', player.x, player.y - 90, '#00e5ff', 20);
    console.log('🤖 Engineering Drone initialised');

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

    Achievements.stats.damageTaken    = 0;
    Achievements.stats.shopPurchases  = 0;
    waveStartDamage = 0;

    hideElement('overlay');
    hideElement('report-card');

    UIManager.resetGameOverUI();

    showResumePrompt(false);
    ShopManager.close();

    // Clear and close admin console if somehow open
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

    // Close admin console if open
    if (AdminConsole.isOpen) AdminConsole.close();

    window.drone = null;

    // ── Ensure Bullet Time is off on game over ────────────────
    isSlowMotion = false;
    timeScale    = 1.0;

    {
        const runScore  = getScore();
        const existing  = getSaveData();
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

// ==================== INPUT ====================
window.addEventListener('keydown', e => {
    // ── If admin console input has focus, ignore all game hotkeys ──
    const consoleInput = document.getElementById('console-input');
    if (consoleInput && document.activeElement === consoleInput) return;

    if (gameState === 'PAUSED') {
        const shopModal    = document.getElementById('shop-modal');
        const shopOpen     = shopModal && shopModal.style.display === 'flex';
        const consoleOpen  = AdminConsole.isOpen;

        if (consoleOpen && e.code === 'Escape') { closeAdminConsole(); return; }
        if (shopOpen   && e.code === 'Escape') { closeShop();         return; }
        if (!shopOpen && !consoleOpen)          { resumeGame();        return; }
        return;
    }

    if (gameState !== 'PLAYING') return;

    if (e.code === 'KeyW')   keys.w     = 1;
    if (e.code === 'KeyS')   keys.s     = 1;
    if (e.code === 'KeyA')   keys.a     = 1;
    if (e.code === 'KeyD')   keys.d     = 1;
    if (e.code === 'Space') { keys.space = 1; e.preventDefault(); }
    if (e.code === 'KeyQ')   keys.q     = 1;
    if (e.code === 'KeyE')   keys.e     = 1;
    if (e.code === 'KeyB')   keys.b     = 1;
    if (e.code === 'KeyF')   keys.f     = 1;

    // 'T' — Bullet Time toggle (global, no proximity needed)
    if (e.code === 'KeyT') { toggleSlowMotion(); }
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyW')  keys.w     = 0;
    if (e.code === 'KeyS')  keys.s     = 0;
    if (e.code === 'KeyA')  keys.a     = 0;
    if (e.code === 'KeyD')  keys.d     = 0;
    if (e.code === 'Space') keys.space = 0;
    if (e.code === 'KeyE')  keys.e     = 0;
    if (e.code === 'KeyB')  keys.b     = 0;
    if (e.code === 'KeyF')  keys.f     = 0;
    // Note: 'T' (KeyT) fires toggleSlowMotion() on keydown only — no keyup state needed
    if (e.code === 'KeyQ') {
        if (gameState === 'PLAYING') {
            if (player instanceof PoomPlayer) keys.q = 0;
            else { weaponSystem.switchWeapon(); keys.q = 0; }
        } else { keys.q = 0; }
    }
});

window.addEventListener('mousemove', e => {
    if (!CANVAS) return;
    const r = CANVAS.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    updateMouseWorld();
});

window.addEventListener('mousedown', e => {
    if (!CANVAS) return;
    if (e.button === 0) mouse.left  = 1;
    if (e.button === 2) mouse.right = 1;
    e.preventDefault();
});

window.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.left  = 0;
    if (e.button === 2) mouse.right = 0;
});

window.addEventListener('contextmenu', e => e.preventDefault());

// ==================== EXPOSE TO GLOBAL ====================
window.startGame = startGame;
window.endGame   = endGame;

window.onload = () => {
    console.log('🚀 Initializing game...');
    initCanvas();
    initAI();
};

// ==========================================================
// 📱 MOBILE TWIN-STICK CONTROLS
// ==========================================================
window.touchJoystickLeft  = { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 };
window.touchJoystickRight = { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 };

function initMobileControls() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    const maxRadius = 60;
    const zoneL  = document.getElementById('joystick-left-zone');
    const baseL  = document.getElementById('joystick-left-base');
    const stickL = document.getElementById('joystick-left-stick');
    const zoneR  = document.getElementById('joystick-right-zone');
    const baseR  = document.getElementById('joystick-right-base');
    const stickR = document.getElementById('joystick-right-stick');

    function startJoystick(e, joystick, baseElem, stickElem, zoneElem, isRight = false) {
        if (gameState !== 'PLAYING') return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (joystick.id === null) {
                joystick.id = touch.identifier; joystick.active = true;
                joystick.originX = touch.clientX; joystick.originY = touch.clientY;
                const zr = zoneElem.getBoundingClientRect();
                baseElem.style.display = 'block';
                baseElem.style.left = (touch.clientX - zr.left) + 'px';
                baseElem.style.top  = (touch.clientY - zr.top)  + 'px';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 1;
                break;
            }
        }
    }

    function moveJoystick(e, joystick, stickElem) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                let dx = touch.clientX - joystick.originX;
                let dy = touch.clientY - joystick.originY;
                const d = Math.hypot(dx, dy);
                if (d > maxRadius) { dx = (dx / d) * maxRadius; dy = (dy / d) * maxRadius; }
                joystick.nx = dx / maxRadius; joystick.ny = dy / maxRadius;
                stickElem.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            }
        }
    }

    function endJoystick(e, joystick, baseElem, stickElem, isRight = false) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                joystick.active = false; joystick.id = null;
                joystick.nx = 0; joystick.ny = 0;
                baseElem.style.display = 'none';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 0;
            }
        }
    }

    zoneL.addEventListener('touchstart',  (e) => startJoystick(e, window.touchJoystickLeft,  baseL,  stickL, zoneL),        { passive: false });
    zoneL.addEventListener('touchmove',   (e) => moveJoystick(e,  window.touchJoystickLeft,  stickL),                        { passive: false });
    zoneL.addEventListener('touchend',    (e) => endJoystick(e,   window.touchJoystickLeft,  baseL,  stickL),                { passive: false });
    zoneL.addEventListener('touchcancel', (e) => endJoystick(e,   window.touchJoystickLeft,  baseL,  stickL),                { passive: false });

    zoneR.addEventListener('touchstart',  (e) => startJoystick(e, window.touchJoystickRight, baseR,  stickR, zoneR, true),  { passive: false });
    zoneR.addEventListener('touchmove',   (e) => moveJoystick(e,  window.touchJoystickRight, stickR),                        { passive: false });
    zoneR.addEventListener('touchend',    (e) => endJoystick(e,   window.touchJoystickRight, baseR,  stickR, true),          { passive: false });
    zoneR.addEventListener('touchcancel', (e) => endJoystick(e,   window.touchJoystickRight, baseR,  stickR, true),          { passive: false });

    const btnDash     = document.getElementById('btn-dash');
    const btnSkill    = document.getElementById('btn-skill');
    const btnSwitch   = document.getElementById('btn-switch');
    const btnNaga     = document.getElementById('btn-naga');
    const btnDatabase = document.getElementById('btn-database');
    const btnTerminal = document.getElementById('btn-terminal');
    const btnShop     = document.getElementById('btn-shop');

    if (btnDash) {
        btnDash.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); keys.space = 1; }, { passive: false });
        btnDash.addEventListener('touchend',   (e) => { e.preventDefault(); e.stopPropagation(); keys.space = 0; }, { passive: false });
    }
    if (btnSkill) {
        btnSkill.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); mouse.right = 1; }, { passive: false });
        btnSkill.addEventListener('touchend',   (e) => { e.preventDefault(); e.stopPropagation(); mouse.right = 0; }, { passive: false });
    }
    if (btnSwitch) {
        btnSwitch.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING' && weaponSystem) weaponSystem.switchWeapon();
        }, { passive: false });
    }
    if (btnNaga) {
        btnNaga.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING' && player instanceof PoomPlayer) {
                if (player.cooldowns.naga <= 0) player.summonNaga();
            }
        }, { passive: false });
    }

    if (btnDatabase) {
        btnDatabase.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING') openExternalDatabase();
            else if (gameState === 'PAUSED') resumeGame();
        }, { passive: false });
    }

    if (btnTerminal) {
        btnTerminal.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING') openAdminConsole();
            else if (gameState === 'PAUSED' && AdminConsole.isOpen) closeAdminConsole();
        }, { passive: false });
    }

    if (btnShop) {
        btnShop.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING') openShop();
            else if (gameState === 'PAUSED') {
                const shopModal = document.getElementById('shop-modal');
                if (shopModal && shopModal.style.display === 'flex') closeShop();
            }
        }, { passive: false });
    }

    document.addEventListener('touchmove', function(e) {
        if (!e.target.closest('.joystick-zone') && !e.target.closest('.action-btn')) {
            e.preventDefault();
        }
    }, { passive: false });
}

window.addEventListener('DOMContentLoaded', initMobileControls);