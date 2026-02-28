'use strict';
/**
 * 🕹️ INPUT SYSTEM — js/input.js
 * ─────────────────────────────────────────────────────────────────
 * Owns ALL raw input state and event wiring for MTC: Enhanced Edition.
 *
 * GLOBALS DEFINED HERE (accessible to every subsequent script tag):
 *   var keys               — keyboard digital state  { w, a, s, d, space, q, e, b, t, f }
 *   var mouse              — pointer state  { x, y, wx, wy, left, right }
 *   var joysticks          — unified twin-stick state { left, right }
 *   window.touchJoystickLeft  — left  twin-stick raw state object (alias of joysticks.left)
 *   window.touchJoystickRight — right twin-stick raw state object (alias of joysticks.right)
 *
 * LOAD ORDER:
 *   config.js → utils.js → audio.js → effects.js → weapons.js →
 *   map.js → ui.js → ai.js → entities.js → input.js → game.js
 *
 * USAGE:
 *   InputSystem.init() is called once from window.onload (in game.js).
 *   keyboard/mouse listeners are registered then, and initMobileControls()
 *   is called to wire up touch joysticks and action buttons.
 *
    *   After that, the global `keys`, `mouse`, and `joysticks` objects are *   continuously updated by event listeners and can be read from any script     tag to query input state.
 *
 * TODO:
 *   - Add gamepad support (navigator.getGamepads)
 *   - Add customizable / remappable keybindings
 *   - Add input buffering for more responsive dash/skill cancels
 *   - Vibration feedback (navigator.vibrate) for mobile hits
 * ─────────────────────────────────────────────────────────────────
 */

// ══════════════════════════════════════════════════════════════
// GLOBAL INPUT STATE  (var → window-scoped, cross-file safe)
// ══════════════════════════════════════════════════════════════
// Top-level 'var' declarations are window-globals in browser script tags.
/**
 * Digital keyboard state.
 * keys.t  → Bullet Time toggle  (fires on keydown; no keyup needed)
 * keys.f  → Admin Terminal open (proximity-gated in game.js)
 */
var keys = {
    w: 0, a: 0, s: 0, d: 0,
    space: 0,
    q: 0, e: 0, b: 0, t: 0, f: 0,
    r: 0, shift: 0  // ── Phase 3 Session 1: Naga (R) + Ritual Burst (Shift+R) ──
};

/**
 * Mouse / pointer state — SINGLE SOURCE OF TRUTH.
 * (Removed from utils.js to fix "Identifier 'mouse' has already been declared".)
 *
 * wx / wy are updated by updateMouseWorld() (utils.js) each frame.
 */
var mouse = {
    x: 0, y: 0,        // canvas-space pixel position
    wx: 0, wy: 0,      // world-space position (updated by updateMouseWorld)
    left: 0, right: 0  // button state  1 = held, 0 = released
};

/**
 * Unified twin-stick joystick state.
 * Each side: { active, id, originX, originY, nx, ny }
 *
 * window.touchJoystickLeft / Right are set as aliases below so any
 * existing code referencing those names continues to work.
 */
var joysticks = {
    left: { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 },
    right: { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 }
};

// Legacy aliases — keep backward-compat with existing code that reads these.
window.touchJoystickLeft = joysticks.left;
window.touchJoystickRight = joysticks.right;

// ── Admin Authentication State ─────────────────────────────────────────────
// window.isAdmin  : true เมื่อผู้สร้างพิมพ์รหัสถูกต้องที่หน้า Menu
// secretBuffer    : เก็บตัวอักษรที่พิมพ์ล่าสุด (ไม่เกิน 10 ตัว)
window.isAdmin = false;
let secretBuffer = "";


// ══════════════════════════════════════════════════════════════
// 📱 MOBILE TWIN-STICK CONTROLS
// ══════════════════════════════════════════════════════════════

// FIX (BUG-3): Store handler references to enable cleanup and prevent memory leaks
var _mobileHandlers = {
    leftStart: null, leftMove: null, leftEnd: null, leftCancel: null,
    rightStart: null, rightMove: null, rightEnd: null, rightCancel: null,
    btnDash: null, btnSkill: null, btnSwitch: null, btnNaga: null,
    btnDatabase: null, btnTerminal: null, btnShop: null, touchMove: null
};

function initMobileControls() {
    var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    var maxRadius = 60;
    var zoneL = document.getElementById('joystick-left-zone');
    var baseL = document.getElementById('joystick-left-base');
    var stickL = document.getElementById('joystick-left-stick');
    var zoneR = document.getElementById('joystick-right-zone');
    var baseR = document.getElementById('joystick-right-base');
    var stickR = document.getElementById('joystick-right-stick');

    function startJoystick(e, joystick, baseElem, stickElem, zoneElem, isRight) {
        // WARN-8 FIX: use window.gameState — bare gameState is not yet
        // defined if an OS-level touch fires before game.js loads
        if (window.gameState !== 'PLAYING') return;
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var touch = e.changedTouches[i];
            if (joystick.id === null) {
                joystick.id = touch.identifier;
                joystick.active = true;
                joystick.originX = touch.clientX;
                joystick.originY = touch.clientY;
                var zr = zoneElem.getBoundingClientRect();
                baseElem.style.display = 'block';
                baseElem.style.left = (touch.clientX - zr.left) + 'px';
                baseElem.style.top = (touch.clientY - zr.top) + 'px';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 1;
                break;
            }
        }
    }

    function moveJoystick(e, joystick, stickElem) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                var dx = touch.clientX - joystick.originX;
                var dy = touch.clientY - joystick.originY;
                var d = Math.hypot(dx, dy);
                if (d > maxRadius) { dx = (dx / d) * maxRadius; dy = (dy / d) * maxRadius; }
                joystick.nx = dx / maxRadius;
                joystick.ny = dy / maxRadius;
                stickElem.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
            }
        }
    }

    function endJoystick(e, joystick, baseElem, stickElem, isRight) {
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                joystick.active = false;
                joystick.id = null;
                joystick.nx = 0;
                joystick.ny = 0;
                baseElem.style.display = 'none';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 0;
            }
        }
    }

    // Store handler references for cleanup
    _mobileHandlers.leftStart = function (e) { startJoystick(e, joysticks.left, baseL, stickL, zoneL, false); };
    _mobileHandlers.leftMove = function (e) { moveJoystick(e, joysticks.left, stickL); };
    _mobileHandlers.leftEnd = function (e) { endJoystick(e, joysticks.left, baseL, stickL, false); };
    _mobileHandlers.leftCancel = function (e) { endJoystick(e, joysticks.left, baseL, stickL, false); };

    zoneL.addEventListener('touchstart', _mobileHandlers.leftStart, { passive: false });
    zoneL.addEventListener('touchmove', _mobileHandlers.leftMove, { passive: false });
    zoneL.addEventListener('touchend', _mobileHandlers.leftEnd, { passive: false });
    zoneL.addEventListener('touchcancel', _mobileHandlers.leftCancel, { passive: false });

    _mobileHandlers.rightStart = function (e) { startJoystick(e, joysticks.right, baseR, stickR, zoneR, true); };
    _mobileHandlers.rightMove = function (e) { moveJoystick(e, joysticks.right, stickR); };
    _mobileHandlers.rightEnd = function (e) { endJoystick(e, joysticks.right, baseR, stickR, true); };
    _mobileHandlers.rightCancel = function (e) { endJoystick(e, joysticks.right, baseR, stickR, true); };

    zoneR.addEventListener('touchstart', _mobileHandlers.rightStart, { passive: false });
    zoneR.addEventListener('touchmove', _mobileHandlers.rightMove, { passive: false });
    zoneR.addEventListener('touchend', _mobileHandlers.rightEnd, { passive: false });
    zoneR.addEventListener('touchcancel', _mobileHandlers.rightCancel, { passive: false });

    // ── Action buttons ─────────────────────────────────────────
    var btnDash = document.getElementById('btn-dash');
    var btnSkill = document.getElementById('btn-skill');
    var btnSwitch = document.getElementById('btn-switch');
    var btnNaga = document.getElementById('btn-naga');
    var btnDatabase = document.getElementById('btn-database');
    var btnTerminal = document.getElementById('btn-terminal');
    var btnShop = document.getElementById('btn-shop');

    // FIX (BUG-7): Store button handler references for cleanup
    if (btnDash) {
        _mobileHandlers.btnDashStart = function (e) { e.preventDefault(); e.stopPropagation(); keys.space = 1; };
        _mobileHandlers.btnDashEnd = function (e) { e.preventDefault(); e.stopPropagation(); keys.space = 0; };
        btnDash.addEventListener('touchstart', _mobileHandlers.btnDashStart, { passive: false });
        btnDash.addEventListener('touchend', _mobileHandlers.btnDashEnd, { passive: false });
    }
    if (btnSkill) {
        _mobileHandlers.btnSkillStart = function (e) { e.preventDefault(); e.stopPropagation(); mouse.right = 1; };
        _mobileHandlers.btnSkillEnd = function (e) { e.preventDefault(); e.stopPropagation(); mouse.right = 0; };
        btnSkill.addEventListener('touchstart', _mobileHandlers.btnSkillStart, { passive: false });
        btnSkill.addEventListener('touchend', _mobileHandlers.btnSkillEnd, { passive: false });
    }
    if (btnSwitch) {
        _mobileHandlers.btnSwitchStart = function (e) {
            e.preventDefault(); e.stopPropagation();
            if (window.gameState === 'PLAYING' && typeof weaponSystem !== 'undefined') weaponSystem.switchWeapon();
        };
        btnSwitch.addEventListener('touchstart', _mobileHandlers.btnSwitchStart, { passive: false });
    }
    if (btnNaga) {
        _mobileHandlers.btnNagaStart = function (e) {
            e.preventDefault(); e.stopPropagation();
            if (window.gameState !== 'PLAYING') return;
            if (typeof PoomPlayer !== 'undefined' && typeof player !== 'undefined' && player instanceof PoomPlayer) {
                if (player.cooldowns.naga <= 0) player.summonNaga();
            }
        };
        btnNaga.addEventListener('touchstart', _mobileHandlers.btnNagaStart, { passive: false });
    }
    if (btnDatabase) {
        _mobileHandlers.btnDatabaseStart = function (e) {
            e.preventDefault(); e.stopPropagation();
            if (window.gameState === 'PLAYING') { if (typeof openExternalDatabase !== 'undefined') openExternalDatabase(); }
            else if (window.gameState === 'PAUSED') { if (typeof resumeGame !== 'undefined') resumeGame(); }
        };
        btnDatabase.addEventListener('touchstart', _mobileHandlers.btnDatabaseStart, { passive: false });
    }
    if (btnTerminal) {
        _mobileHandlers.btnTerminalStart = function (e) {
            e.preventDefault(); e.stopPropagation();
            if (window.gameState === 'PLAYING') { if (typeof openAdminConsole !== 'undefined') openAdminConsole(); }
            else if (window.gameState === 'PAUSED' && typeof AdminConsole !== 'undefined' && AdminConsole.isOpen) {
                if (typeof closeAdminConsole !== 'undefined') closeAdminConsole();
            }
        };
        btnTerminal.addEventListener('touchstart', _mobileHandlers.btnTerminalStart, { passive: false });
    }
    if (btnShop) {
        _mobileHandlers.btnShopStart = function (e) {
            e.preventDefault(); e.stopPropagation();
            if (window.gameState === 'PLAYING') {
                if (typeof openShop !== 'undefined') openShop();
            } else if (window.gameState === 'PAUSED') {
                var shopModal = document.getElementById('shop-modal');
                if (shopModal && shopModal.style.display === 'flex' && typeof closeShop !== 'undefined') closeShop();
            }
        };
        btnShop.addEventListener('touchstart', _mobileHandlers.btnShopStart, { passive: false });
    }

    _mobileHandlers.touchMove = function (e) {
        if (!e.target.closest('.joystick-zone') && !e.target.closest('.action-btn')) {
            e.preventDefault();
        }
    };
    document.addEventListener('touchmove', _mobileHandlers.touchMove, { passive: false });
}

// FIX (BUG-3 & BUG-7): Cleanup function to remove all mobile event listeners
function cleanupMobileControls() {
    var zoneL = document.getElementById('joystick-left-zone');
    var zoneR = document.getElementById('joystick-right-zone');

    if (zoneL && _mobileHandlers.leftStart) {
        zoneL.removeEventListener('touchstart', _mobileHandlers.leftStart);
        zoneL.removeEventListener('touchmove', _mobileHandlers.leftMove);
        zoneL.removeEventListener('touchend', _mobileHandlers.leftEnd);
        zoneL.removeEventListener('touchcancel', _mobileHandlers.leftCancel);
    }

    if (zoneR && _mobileHandlers.rightStart) {
        zoneR.removeEventListener('touchstart', _mobileHandlers.rightStart);
        zoneR.removeEventListener('touchmove', _mobileHandlers.rightMove);
        zoneR.removeEventListener('touchend', _mobileHandlers.rightEnd);
        zoneR.removeEventListener('touchcancel', _mobileHandlers.rightCancel);
    }

    // FIX (BUG-7): Remove button event listeners
    var btnDash = document.getElementById('btn-dash');
    var btnSkill = document.getElementById('btn-skill');
    var btnSwitch = document.getElementById('btn-switch');
    var btnNaga = document.getElementById('btn-naga');
    var btnDatabase = document.getElementById('btn-database');
    var btnTerminal = document.getElementById('btn-terminal');
    var btnShop = document.getElementById('btn-shop');

    if (btnDash && _mobileHandlers.btnDashStart) {
        btnDash.removeEventListener('touchstart', _mobileHandlers.btnDashStart);
        btnDash.removeEventListener('touchend', _mobileHandlers.btnDashEnd);
    }
    if (btnSkill && _mobileHandlers.btnSkillStart) {
        btnSkill.removeEventListener('touchstart', _mobileHandlers.btnSkillStart);
        btnSkill.removeEventListener('touchend', _mobileHandlers.btnSkillEnd);
    }
    if (btnSwitch && _mobileHandlers.btnSwitchStart) {
        btnSwitch.removeEventListener('touchstart', _mobileHandlers.btnSwitchStart);
    }
    if (btnNaga && _mobileHandlers.btnNagaStart) {
        btnNaga.removeEventListener('touchstart', _mobileHandlers.btnNagaStart);
    }
    if (btnDatabase && _mobileHandlers.btnDatabaseStart) {
        btnDatabase.removeEventListener('touchstart', _mobileHandlers.btnDatabaseStart);
    }
    if (btnTerminal && _mobileHandlers.btnTerminalStart) {
        btnTerminal.removeEventListener('touchstart', _mobileHandlers.btnTerminalStart);
    }
    if (btnShop && _mobileHandlers.btnShopStart) {
        btnShop.removeEventListener('touchstart', _mobileHandlers.btnShopStart);
    }

    if (_mobileHandlers.touchMove) {
        document.removeEventListener('touchmove', _mobileHandlers.touchMove);
    }

    // Clear handler references
    _mobileHandlers = {
        leftStart: null, leftMove: null, leftEnd: null, leftCancel: null,
        rightStart: null, rightMove: null, rightEnd: null, rightCancel: null,
        btnDashStart: null, btnDashEnd: null, btnSkillStart: null, btnSkillEnd: null,
        btnSwitchStart: null, btnNagaStart: null, btnDatabaseStart: null,
        btnTerminalStart: null, btnShopStart: null, touchMove: null
    };
}


// ══════════════════════════════════════════════════════════════
// ⌨️  KEYBOARD & MOUSE EVENT LISTENERS
// (registered once by InputSystem.init() → window.onload)
// ══════════════════════════════════════════════════════════════

function _setupKeyboardListeners() {
    window.addEventListener('keydown', function (e) {
        // While admin console input has focus, ignore all game hotkeys
        var consoleInput = document.getElementById('console-input');
        if (consoleInput && document.activeElement === consoleInput) return;

        if (window.gameState === 'PAUSED') {
            var shopModal = document.getElementById('shop-modal');
            var shopOpen = shopModal && shopModal.style.display === 'flex';
            var consoleOpen = AdminConsole.isOpen;

            if (consoleOpen && e.code === 'Escape') { closeAdminConsole(); return; }
            if (shopOpen && e.code === 'Escape') { closeShop(); return; }
            if (!shopOpen && !consoleOpen) { resumeGame(); return; }
            return;
        }

        // ── Secret Keylogger (Menu Only) ──────────────────────────────────
        // พิมพ์ "mawin" หรือ "admin" ที่หน้า Menu เพื่อเปิด Dev Mode
        if (window.gameState === 'MENU' && !window.isAdmin) {
            if (e.key && e.key.length === 1) {
                secretBuffer += e.key.toLowerCase();
                if (secretBuffer.length > 10) secretBuffer = secretBuffer.slice(-10);

                if (secretBuffer.includes('mawin') || secretBuffer.includes('admin')) {
                    window.isAdmin = true;
                    secretBuffer = '';

                    // แสดง Dev Mode Panel
                    var panel = document.getElementById('dev-mode-panel');
                    if (panel) panel.style.display = 'block';

                    // เปลี่ยนปุ่ม Start เป็นสีแดง Dev Mode
                    var startBtn = document.getElementById('start-btn');
                    if (startBtn) {
                        startBtn.style.background = 'linear-gradient(135deg, #ef4444, #991b1b)';
                        startBtn.style.boxShadow = '0 0 30px rgba(239,68,68,0.5)';
                        startBtn.textContent = '🚀 START DEV MODE';
                    }

                    // เสียงแจ้งเตือน Auth สำเร็จ
                    try {
                        if (typeof Audio !== 'undefined' && Audio.playLevelUp) Audio.playLevelUp();
                    } catch (err) { }

                    console.log('%c[MTC Admin] 🔐 Authentication successful. Developer Mode UNLOCKED.', 'color:#ef4444; font-weight:bold;');
                }
            }
        }

        if (window.gameState !== 'PLAYING') return;

        if (e.code === 'KeyW') keys.w = 1;
        if (e.code === 'KeyS') keys.s = 1;
        if (e.code === 'KeyA') keys.a = 1;
        if (e.code === 'KeyD') keys.d = 1;
        if (e.code === 'Space') {
            e.preventDefault();
            if (typeof TutorialSystem !== 'undefined' && TutorialSystem.isActive()) {
                TutorialSystem.next();
            }
            keys.space = 1;
        }
        if (e.code === 'KeyQ') keys.q = 1;
        if (e.code === 'KeyE') keys.e = 1;
        if (e.code === 'KeyB') keys.b = 1;
        if (e.code === 'KeyF') keys.f = 1;
        // ── Phase 3 Session 1: R = Naga, Shift+R = Ritual Burst ──
        if (e.code === 'KeyR') keys.r = 1;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = 1;

        // 'T' — Bullet Time toggle (global, no proximity gate)
        if (e.code === 'KeyT') {
            toggleSlowMotion();
            // BUG-5 FIX: forward 'bullettime' to TutorialSystem so step 6
            // can detect the action and advance. toggleSlowMotion() is the
            // only path that fires KeyT — game.js never calls handleAction
            // for this key, so it must be done here.
            if (typeof TutorialSystem !== 'undefined' && TutorialSystem.isActive()) {
                TutorialSystem.handleAction('bullettime');
            }
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'KeyW') keys.w = 0;
        if (e.code === 'KeyS') keys.s = 0;
        if (e.code === 'KeyA') keys.a = 0;
        if (e.code === 'KeyD') keys.d = 0;
        if (e.code === 'Space') keys.space = 0;
        if (e.code === 'KeyE') keys.e = 0;
        if (e.code === 'KeyB') keys.b = 0;
        if (e.code === 'KeyF') keys.f = 0;
        // ── Phase 3 Session 1: R = Naga, Shift+R = Ritual Burst ──
        if (e.code === 'KeyR') keys.r = 0;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = 0;
        // 'T' fires only on keydown; no keyup state needed.

        if (e.code === 'KeyQ') {
            if (window.gameState === 'PLAYING') {
                // FIX (BUG-3): Kao uses Q for Teleport. Do NOT switch weapons on Q release for Kao!
                if (typeof PoomPlayer !== 'undefined' && window.player instanceof PoomPlayer) {
                    keys.q = 0;
                } else if (typeof KaoPlayer !== 'undefined' && window.player instanceof KaoPlayer) {
                    keys.q = 0;  // Kao: Q is Teleport, not weapon switch
                } else if (typeof AutoPlayer !== 'undefined' && window.player instanceof AutoPlayer) {
                    keys.q = 0;  // Auto: Q is Vacuum Heat, not weapon switch
                } else {
                    if (typeof weaponSystem !== 'undefined') weaponSystem.switchWeapon();
                    keys.q = 0;
                }
                // Tutorial: weapon-switch step is handled via polling in TutorialSystem.update()
                // No explicit handleAction needed here.
            } else { keys.q = 0; }
        }
    });
}

function _setupMouseListeners() {
    window.addEventListener('mousemove', function (e) {
        if (!CANVAS) return;
        var r = CANVAS.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        // updateMouseWorld is defined in utils.js (loaded before input.js)
        updateMouseWorld();
    });

    window.addEventListener('mousedown', function (e) {
        if (!CANVAS) return;
        if (e.button === 0) mouse.left = 1;
        if (e.button === 2) mouse.right = 1;
        e.preventDefault();
    });

    window.addEventListener('mouseup', function (e) {
        if (e.button === 0) mouse.left = 0;
        if (e.button === 2) mouse.right = 0;
    });

    window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // FIX (BUG-3): Add Mouse Wheel support for universal weapon switching
    window.addEventListener('wheel', function (e) {
        if (typeof weaponSystem === 'undefined') return;
        // Allow wheel weapon-switch during tutorial weapon-step so polling can detect it
        const inTutWeaponStep = typeof TutorialSystem !== 'undefined' &&
            TutorialSystem.isActive() && TutorialSystem.isActionStep();
        if (window.gameState === 'PLAYING' || inTutWeaponStep) {
            if (e.deltaY > 0 || e.deltaY < 0) {
                weaponSystem.switchWeapon();
            }
        }
    }, { passive: true });
}


// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

var InputSystem = {
    /**
     * Call once from window.onload (before startGame).
     * Wires up all keyboard, mouse, and touch input handlers.
     */
    init: function () {
        _setupKeyboardListeners();
        _setupMouseListeners();
        initMobileControls();
        console.log('🕹️ InputSystem initialised.');
    }
};

window.InputSystem = InputSystem;