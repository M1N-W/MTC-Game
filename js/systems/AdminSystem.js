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

window.AdminConsole = AdminConsole;

function openAdminConsole() {
    if (window.gameState !== 'PLAYING') return;
    window.gameState = 'PAUSED';
    AdminConsole.open();
    Audio.pauseBGM();
    console.log('Admin Console opened');
    window.focus();
}

function closeAdminConsole() {
    AdminConsole.close();
    if (window.gameState === 'PAUSED') window.gameState = 'PLAYING';
    showResumePrompt(false);
    Audio.resumeBGM();

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
    if (window.gameState !== 'PLAYING') return;
    window.gameState = 'PAUSED';

    window.open(MTC_DB_URL, '_blank');
    showResumePrompt(true);

    const promptEl = document.getElementById('db-prompt');
    if (promptEl) promptEl.style.display = 'none';

    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    if (player) spawnFloatingText('📚 MTC DATABASE', player.x, player.y - 60, '#06b6d4', 22);
}


function resumeGame() {
    if (window.gameState !== 'PAUSED') return;
    if (AdminConsole.isOpen) { closeAdminConsole(); return; }
    window.gameState = 'PLAYING';

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
window.showResumePrompt     = showResumePrompt;
window.showMathModal        = showMathModal;
window.closeMathModal       = closeMathModal;

window.addEventListener('blur', () => {
    if (window.gameState === 'PLAYING') {
        window.gameState = 'PAUSED';
        const shopModal   = document.getElementById('shop-modal');
        const shopOpen    = shopModal && shopModal.style.display === 'flex';
        const consoleOpen = AdminConsole.isOpen;
        if (!shopOpen && !consoleOpen) showResumePrompt(true);
    }
});

window.addEventListener('focus', () => {
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

window.drawDatabaseServer    = drawDatabaseServer;
window.updateDatabaseServerUI = updateDatabaseServerUI;
window.MTC_DB_URL            = MTC_DB_URL;
