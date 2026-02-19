'use strict';

// ════════════════════════════════════════════════════════════════
// 🤖 AI SAFETY FALLBACK
// ════════════════════════════════════════════════════════════════
if (typeof window.Gemini === 'undefined') {
    window.Gemini = {
        init:                 ()          => console.log('🤖 AI System: Offline (Safe Fallback)'),
        generateText:         async ()    => '...',
        generateMission:      async ()    => 'Defeat the enemies!',
        generateReportCard:   async ()    => 'Great job!',
        speak:                ()          => {},

        getMissionName:  async ()         => 'พิชิตครูมานพ',
        getReportCard:   async ()         => 'ตั้งใจเรียนให้มากกว่านี้นะ...',
        getBossTaunt:    async ()         => '',
    };
}

// ─── Debug Flag (WARN 2 FIX) ──────────────────────────────────
const DEBUG_MODE = false;

/**
 * 🎮 MTC: ENHANCED EDITION - Main Game Loop (REFACTORED)
 *
 * ────────────────────────────────────────────────────────────────
 * 🐛 BGM FIX (Audio Timing Pass)
 * ────────────────────────────────────────────────────────────────
 * ROOT CAUSE — Menu and Battle BGM were silently discarded:
 *
 *   Menu BGM:
 *     window.onload called Audio.playBGM('menu') before Audio.init()
 *     was ever called, so userInteracted was false and the request
 *     was returned and thrown away.
 *
 *   Battle BGM:
 *     startGame() called Audio.init() then Audio.playBGM('battle')
 *     in the same synchronous stack as the "Start" button click.
 *     Audio.init() registers the interaction listener — but the click
 *     that triggered startGame() had ALREADY fired before the listener
 *     was attached, so userInteracted never became true.
 *     Battle BGM was therefore also silently discarded.
 *
 *   Boss BGM worked because by Wave 3 the user had pressed keys/clicked
 *   many times AFTER Audio.init(), so userInteracted had become true.
 *
 * FIX (two changes in this file):
 *   1. window.onload  — Audio.init() moved HERE, before playBGM('menu').
 *                       The interaction listener is now registered at page
 *                       load, not inside startGame().
 *   2. startGame()    — Audio.init() call REMOVED. Calling it again would
 *                       re-create the AudioContext and re-register the
 *                       listener, resetting userInteracted to false and
 *                       causing battle BGM to miss the triggering click.
 */

// ─── Game State ───────────────────────────────────────────────
let gameState   = 'MENU';
let loopRunning = false;

window.gameState = gameState;

// ─── 🕐 Bullet Time ───────────────────────────────────────────
let timeScale    = 1.0;
let isSlowMotion = false;
let slowMoEnergy = 1.0;

const SLOW_MO_TIMESCALE     = 0.30;
const SLOW_MO_DRAIN_RATE    = 0.14;
const SLOW_MO_RECHARGE_RATE = 0.07;

const SM_BAR_W = 180, SM_BAR_H = 8;

// ─── HUD Draw Bridge ──────────────────────────────────────────
let _lastDrawDt = 0;

// ─── Day / Night cycle ────────────────────────────────────────
let dayNightTimer = 0;

// ─── ⚡ Glitch Wave ───────────────────────────────────────────
let isGlitchWave     = false;
let glitchIntensity  = 0;
let controlsInverted = false;
const GLITCH_EVERY_N_WAVES = 5;

window.isGlitchWave = false;

// ─── ⚡ Glitch Wave — Player HP Bonus ────────────────────────
let _glitchWaveHpBonus = 0;

// ─── ⚡ Glitch Wave — Spawn Grace Period ──────────────────────
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

    const CHAR_DELAY = 18;

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
                setTimeout(() => closeAdminConsole(), 1800);
                break;
            }

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

            case 'clear': {
                const out = document.getElementById('console-output');
                if (out) out.innerHTML = '';
                break;
            }

            case 'exit':
            case 'quit':
            case 'q': {
                _appendLine('Closing session...', 'cline-info');
                setTimeout(() => closeAdminConsole(), 500);
                break;
            }

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
                    e.stopPropagation();

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
    CTX.lineWidth   = 1.5;
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

    CTX.font         = '16px Arial';
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    CTX.shadowBlur   = 0;
    CTX.fillText('🛒', 0, 10);

    const coinBounce = Math.sin(performance.now() / 350) * 4;
    CTX.font = '14px Arial';
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
    if (_glitchWaveHpBonus > 0 && player) {
        player.maxHp -= _glitchWaveHpBonus;
        player.hp     = Math.min(player.hp, player.maxHp);
        _glitchWaveHpBonus = 0;
        console.log('[GlitchWave] HP bonus removed — player.maxHp:', player.maxHp);
    }

    isGlitchWave     = false;
    window.isGlitchWave = false;
    controlsInverted = false;

    waveSpawnLocked     = false;
    waveSpawnTimer      = 0;
    pendingSpawnCount   = 0;
    lastGlitchCountdown = -1;

    resetEnemiesKilled();
    waveStartDamage = Achievements.stats.damageTaken;
    setElementText('wave-badge', `WAVE ${getWave()}`);
    spawnFloatingText(`WAVE ${getWave()}`, player.x, player.y - 100, '#8b5cf6', 40);

    const count = BALANCE.waves.enemiesBase + (getWave() - 1) * BALANCE.waves.enemiesPerWave;

    // ── BGM: switch to battle music for normal + glitch waves ──────────────
    // Boss music is handled later, inside the bossEveryNWaves setTimeout block
    // when the boss actually spawns.  All other waves (including glitch waves)
    // use battle BGM.  This also restores battle music after a boss wave ends.
    if (getWave() % BALANCE.waves.bossEveryNWaves !== 0) {
        Audio.playBGM('battle');
    }

    if (getWave() % GLITCH_EVERY_N_WAVES === 0) {
        isGlitchWave     = true;
        window.isGlitchWave = true;
        controlsInverted = true;
        glitchIntensity  = 0;

        if (player) {
            const bonus       = 100;
            player.maxHp     += bonus;
            player.hp        += bonus;
            _glitchWaveHpBonus = bonus;
            spawnFloatingText(
                `🛡️ +${bonus} CRISIS HP`,
                player.x, player.y - 60,
                '#22c55e', 22
            );
            spawnParticles(player.x, player.y, 10, '#22c55e');
            console.log(`[GlitchWave] HP bonus applied — player.maxHp: ${player.maxHp}, player.hp: ${player.hp}`);
        }

        pendingSpawnCount   = Math.floor((count * 2) / 1.5);
        waveSpawnLocked     = true;
        waveSpawnTimer      = BALANCE.waves.glitchGracePeriod / 1000;
        lastGlitchCountdown = -1;

        spawnFloatingText('⚡ GLITCH WAVE ⚡', player.x, player.y - 200, '#d946ef', 44);
        addScreenShake(20);
        Audio.playBossSpecial();

        setTimeout(() => {
            if (player)
                spawnFloatingText('⚠️ SYSTEM ANOMALY DETECTED... ⚠️', player.x, player.y - 180, '#f472b6', 26);
        }, 400);
        setTimeout(() => {
            if (player && waveSpawnLocked)
                spawnFloatingText('CONTROLS INVERTED!', player.x, player.y - 160, '#f472b6', 22);
        }, 1200);
        setTimeout(() => {
            if (player && waveSpawnLocked)
                spawnFloatingText('BRACE FOR IMPACT...', player.x, player.y - 155, '#ef4444', 24);
        }, 2400);

    } else {
        spawnEnemies(count);
    }

    if (getWave() % BALANCE.waves.bossEveryNWaves === 0) {
        setTimeout(() => {
            bossEncounterCount++;
            const isRider         = bossEncounterCount >= 2;
            const isGoldfishLover = bossEncounterCount >= 3;
            const bossLevel       = Math.floor(getWave() / BALANCE.waves.bossEveryNWaves);

            window.boss = new Boss(bossLevel, isRider, isGoldfishLover);
            UIManager.updateBossHUD(window.boss);

            const riderTag     = isRider ? ' 🐕 DOG RIDER' : '';
            const goldfishTag  = isGoldfishLover ? ' 🐟 GOLDFISH LOVER' : '';
            const bossNameEl   = document.getElementById('boss-name');
            if (bossNameEl) {
                bossNameEl.innerHTML =
                    `KRU MANOP - LEVEL ${bossLevel}${riderTag}${goldfishTag} <span class="ai-badge">AI</span>`;
            }

            spawnFloatingText(
                isGoldfishLover ? '🐟 GOLDFISH LOVER INCOMING!' : (isRider ? 'BOSS INCOMING! 🐕' : 'BOSS INCOMING!'),
                player.x, player.y - 100,
                isGoldfishLover ? '#38bdf8' : (isRider ? '#d97706' : '#ef4444'),
                35
            );
            addScreenShake(15);
            Audio.playBossSpecial();
        }, BALANCE.waves.bossSpawnDelay);

        // Switch to boss BGM when boss spawns
        Audio.playBGM('boss');
    }
}

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
// 🕐 BULLET TIME
// ══════════════════════════════════════════════════════════════

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

function drawSlowMoOverlay() {
    if (!isSlowMotion && slowMoEnergy >= 1.0) return;

    const W   = CANVAS.width, H = CANVAS.height;
    const now = performance.now();

    if (isSlowMotion) {
        const vig = CTX.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.78);
        vig.addColorStop(0,    'rgba(0, 229, 255, 0.00)');
        vig.addColorStop(0.65, 'rgba(0, 200, 255, 0.06)');
        vig.addColorStop(1,    'rgba(0, 100, 200, 0.38)');
        CTX.fillStyle = vig;
        CTX.fillRect(0, 0, W, H);

        const offset = 2 + Math.sin(now / 80) * 0.8;
        CTX.save();
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = 0.04;
        CTX.fillStyle   = '#ff0000';
        CTX.fillRect(-offset, 0, W, H);
        CTX.fillStyle   = '#0000ff';
        CTX.fillRect( offset, 0, W, H);
        CTX.globalAlpha = 1;
        CTX.globalCompositeOperation = 'source-over';
        CTX.restore();

        const barH      = 28;
        const scanAlpha = 0.55 + Math.sin(now / 200) * 0.1;
        CTX.save();
        CTX.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
        CTX.fillRect(0, 0,          W, barH);
        CTX.fillRect(0, H - barH,   W, barH);
        CTX.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        CTX.lineWidth   = 1;
        CTX.beginPath(); CTX.moveTo(0, barH);     CTX.lineTo(W, barH);     CTX.stroke();
        CTX.beginPath(); CTX.moveTo(0, H - barH); CTX.lineTo(W, H - barH); CTX.stroke();
        CTX.restore();
    }

    {
        const bx    = W / 2;
        const by    = H - 140;
        const pulse = Math.abs(Math.sin(now / 320));

        CTX.save();

        const badgeW = SM_BAR_W / 2 + 20;
        const badgeH = 30;
        CTX.fillStyle = isSlowMotion
            ? `rgba(0, 20, 30, ${0.78 + pulse * 0.12})`
            : 'rgba(0, 10, 20, 0.55)';
        _roundRectPath(CTX, bx - badgeW, by - badgeH - 4, badgeW * 2, badgeH + 18, 8);
        CTX.fill();

        CTX.strokeStyle = isSlowMotion
            ? `rgba(0, 229, 255, ${0.55 + pulse * 0.35})`
            : 'rgba(0, 229, 255, 0.22)';
        CTX.lineWidth = 1.5;
        CTX.stroke();

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

        const barX = bx - SM_BAR_W / 2;
        const barY = by - 6;
        CTX.fillStyle = 'rgba(0, 30, 40, 0.8)';
        _roundRectPath(CTX, barX, barY, SM_BAR_W, SM_BAR_H, 4);
        CTX.fill();

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
                CTX.fill();
                CTX.shadowBlur  = 0;
            }
        }

        CTX.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        CTX.lineWidth   = 1;
        for (let i = 1; i < 5; i++) {
            const tx = barX + (SM_BAR_W / 5) * i;
            CTX.beginPath(); CTX.moveTo(tx, barY); CTX.lineTo(tx, barY + SM_BAR_H); CTX.stroke();
        }

        CTX.fillStyle = 'rgba(200, 240, 255, 0.7)';
        CTX.font      = 'bold 9px Arial';
        CTX.fillText(`${Math.round(slowMoEnergy * 100)}%`, bx + SM_BAR_W / 2 + 16, barY + SM_BAR_H / 2);

        CTX.restore();
    }

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
    const dt = getDeltaTime(now);

    if (gameState === 'PLAYING') {
        _tickSlowMoEnergy(dt);
    }

    const scaledDt = dt * timeScale;
    window.timeScale = timeScale;
    _lastDrawDt    = scaledDt;

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

    const GLITCH_RAMP = 0.8;
    if (isGlitchWave) {
        glitchIntensity = Math.min(1.0, glitchIntensity + GLITCH_RAMP * dt);
    } else {
        glitchIntensity = Math.max(0.0, glitchIntensity - GLITCH_RAMP * 2 * dt);
    }

    if (waveSpawnLocked) {
        waveSpawnTimer -= dt;

        const secsLeft = Math.ceil(waveSpawnTimer);
        if (secsLeft !== lastGlitchCountdown && secsLeft > 0 && secsLeft <= 3) {
            lastGlitchCountdown = secsLeft;
            spawnFloatingText(
                `⚡ SPAWNING IN ${secsLeft}...`,
                player.x, player.y - 145,
                '#d946ef', 34
            );
            addScreenShake(6);
        }

        if (waveSpawnTimer <= 0) {
            waveSpawnLocked     = false;
            lastGlitchCountdown = -1;
            spawnEnemies(pendingSpawnCount);
            spawnFloatingText('💀 CHAOS BEGINS!', player.x, player.y - 160, '#ef4444', 44);
            addScreenShake(28);
            Audio.playBossSpecial();
        }
    }

    dayNightTimer += dt;
    {
        const L        = BALANCE.LIGHTING;
        const phi      = (dayNightTimer / L.cycleDuration) * Math.PI * 2;
        const dayPhase = Math.sin(phi) * 0.5 + 0.5;
        L.ambientLight = L.nightMinLight + dayPhase * (L.dayMaxLight - L.nightMinLight);
    }

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

    const effectiveKeys = controlsInverted
        ? { ...keys, w: keys.s, s: keys.w, a: keys.d, d: keys.a }
        : keys;
    player.update(dt, effectiveKeys, mouse);

    if (!(player instanceof PoomPlayer) && !(typeof AutoPlayer === 'function' && player instanceof AutoPlayer)) {
        weaponSystem.update(dt);
        const burstProjectiles = weaponSystem.updateBurst(player, player.damageBoost);
        if (burstProjectiles && burstProjectiles.length > 0) projectileManager.add(burstProjectiles);

        if (mouse.left === 1 && gameState === 'PLAYING') {
            if (weaponSystem.canShoot()) {
                const projectiles = weaponSystem.shoot(player, player.damageBoost);
                if (projectiles && projectiles.length > 0) {
                    projectileManager.add(projectiles);
                    if (typeof player.triggerRecoil === 'function') player.triggerRecoil();
                }
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

    if (getWave() % BALANCE.waves.bossEveryNWaves !== 0 && enemies.length === 0 && !boss && !waveSpawnLocked) {
        if (Achievements.stats.damageTaken === waveStartDamage &&
            getEnemiesKilled() >= BALANCE.waves.minKillsForNoDamage) {
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

    mapSystem.update([player, ...enemies, boss].filter(e => e && !e.dead), dt);
    particleSystem.update(dt);
    floatingTextSystem.update(dt);

    if (typeof hitMarkerSystem !== 'undefined') hitMarkerSystem.update(dt);

    weatherSystem.update(dt, getCamera());

    updateScreenShake();
    Achievements.checkAll();

    updateDatabaseServerUI();
    updateShopProximityUI();
}

function drawGame() {
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

    const grad = CTX.createLinearGradient(0, 0, 0, CANVAS.height);
    grad.addColorStop(0, GAME_CONFIG.visual.bgColorTop);
    grad.addColorStop(1, GAME_CONFIG.visual.bgColorBottom);
    CTX.fillStyle = grad;
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);

    CTX.save();
    const shake = getScreenShakeOffset();
    CTX.translate(shake.x, shake.y);

    drawGrid();

    for (const z of meteorZones) {
        const screen = worldToScreen(z.x, z.y);
        const a = Math.sin(performance.now() / 200) * 0.3 + 0.7;
        CTX.fillStyle = `rgba(239, 68, 68, ${a * 0.4})`;
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2);
        CTX.fill();
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

    if (typeof hitMarkerSystem !== 'undefined') hitMarkerSystem.draw();

    weatherSystem.draw();

    CTX.restore();

    {
        const allProj = (typeof projectileManager !== 'undefined' && projectileManager.projectiles)
            ? projectileManager.projectiles
            : [];

        CTX.save();
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
        CTX.restore();
    }

    drawDayNightHUD();

    drawSlowMoOverlay();

    if (glitchIntensity > 0) {
        drawGlitchEffect(glitchIntensity, controlsInverted);
    }

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

    const cx = 52;
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
    CTX.shadowBlur = 0;

    CTX.font         = `${r}px Arial`;
    CTX.textAlign    = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText(isDawn ? '☀️' : '🌙', cx, cy);

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
    // ── BGM FIX: Audio.init() is called ONCE in window.onload (below).
    // Do NOT call it here. Calling Audio.init() inside startGame() would:
    //   1. Re-create the AudioContext (wasteful, may cause a browser warning).
    //   2. Re-register the interaction listener — but the click that triggered
    //      startGame() already fired, so userInteracted would reset to false
    //      and Audio.playBGM('battle') would be silently discarded again.
    //
    // By the time startGame() runs, the user has already clicked "Start Game",
    // so userInteracted is already true and playBGM plays immediately.
    Audio.playBGM('battle');

    const savedData = getSaveData();
    console.log('[MTC Save] Loaded save data:', savedData);

    UIManager.updateHighScoreDisplay(savedData.highScore);

    if (charType === 'auto' && typeof AutoPlayer === 'function') {
        player = new AutoPlayer();
    } else {
        player = charType === 'poom' ? new PoomPlayer() : new Player(charType);
    }

    enemies = []; powerups = []; specialEffects = []; meteorZones = [];
    boss    = null;
    window.boss = null;

    dayNightTimer  = 0;
    BALANCE.LIGHTING.ambientLight = BALANCE.LIGHTING.dayMaxLight;

    bossEncounterCount = 0;
    console.log('🐕 Boss encounter counter reset — encounter 1 will be plain boss');

    isSlowMotion = false;
    timeScale    = 1.0;
    slowMoEnergy = 1.0;
    console.log('🕐 Bullet Time reset — timeScale 1.0, energy full');

    isGlitchWave        = false;
    window.isGlitchWave = false;
    glitchIntensity     = 0;
    controlsInverted    = false;
    _glitchWaveHpBonus  = 0;
    waveSpawnLocked     = false;
    waveSpawnTimer      = 0;
    pendingSpawnCount   = 0;
    lastGlitchCountdown = -1;
    console.log('⚡ Glitch Wave grace period reset');

    player.shopDamageBoostActive = false;
    player.shopDamageBoostTimer  = 0;
    player._baseDamageBoost      = undefined;
    player.shopSpeedBoostActive  = false;
    player.shopSpeedBoostTimer   = 0;
    player._baseMoveSpeed        = undefined;

    window.drone   = new Drone();
    window.drone.x = player.x;
    window.drone.y = player.y;
    spawnFloatingText('🤖 DRONE ONLINE', player.x, player.y - 90, '#00e5ff', 20);
    console.log('🤖 Engineering Drone initialised');

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
    Achievements.stats.kills         = 0;
    Achievements.stats.shopPurchases = 0;
    waveStartDamage = 0;

    hideElement('overlay');
    hideElement('report-card');

    UIManager.resetGameOverUI();

    showResumePrompt(false);
    ShopManager.close();

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

    Audio.stopBGM();

    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) mobileUI.style.display = 'none';

    showResumePrompt(false);
    ShopManager.close();

    if (AdminConsole.isOpen) AdminConsole.close();

    window.drone = null;

    isSlowMotion = false;
    timeScale    = 1.0;

    isGlitchWave        = false;
    window.isGlitchWave = false;
    _glitchWaveHpBonus  = 0;

    weatherSystem.clear();

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
        setElementText('final-kills', `${(Achievements.stats.kills || 0).toLocaleString()}`);
    } else {
        const finalScore = getScore();
        const finalWave  = getWave();

        showElement('overlay');
        UIManager.showGameOver(finalScore, finalWave);
        setElementText('final-kills', `${(Achievements.stats.kills || 0).toLocaleString()}`);

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
    InputSystem.init();
    initAI();

    // ── BGM FIX: Audio.init() moved here from startGame() ────────────────
    // Initialise the AudioContext and register the one-time interaction
    // listeners (click / keydown / touchstart) ONCE at page load.
    //
    // This must happen BEFORE Audio.playBGM('menu') so that:
    //   a) The interaction listeners are in place when the menu BGM is queued.
    //   b) When the user eventually clicks anything on the menu, enableAudio()
    //      fires, userInteracted becomes true, and _pendingBGM ('menu') plays.
    //
    // Previously Audio.init() lived inside startGame(), which caused two bugs:
    //   • Menu BGM: Audio.init() was never called before playBGM('menu'), so
    //     userInteracted was always false and menu BGM was always discarded.
    //   • Battle BGM: Audio.init() was called inside the same click handler
    //     that triggered startGame() — the click fired BEFORE the new listener
    //     was attached, so userInteracted never flipped to true, and battle
    //     BGM was discarded too.
    Audio.init();

    // Queue menu BGM. userInteracted is false right now (page just loaded,
    // no gesture yet), so playBGM stores 'menu' in _pendingBGM and returns.
    // The instant the user clicks or presses any key on the menu screen,
    // enableAudio fires and the menu track starts playing.
    Audio.playBGM('menu');
};