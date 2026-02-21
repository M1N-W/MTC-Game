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
 * FUTURE IMPROVEMENTS:
 *   - Add gamepad support (navigator.getGamepads)
 *   - Add customizable keybindings
 *   - Add input recording/replay for testing and demos
 *   - Refactor into a more modular class-based system if needed
 *   - Optimize mobile touch handling (e.g. support multi-touch combos)
 *   - Add visual feedback for touch inputs (e.g. joystick zones, button highlights)
 *   - Implement input buffering for more responsive controls
 *   - Add vibration feedback for supported devices
 *   - Add support for remapping controls in an options menu
 *   - Implement a more robust state machine for input handling (e.g. separate input contexts for gameplay, UI, cutscenes)
 *   - Add support for international keyboards and input methods
 *   Optimize performance by throttling input events if necessary
 *   Add unit tests for input handling logic
 *   Document the API and usage examples more thoroughly
 *   Consider using a library like Hammer.js for touch gesture recognition if needed
 *   Consider using a library like Mousetrap for keyboard shortcuts if needed
 *   Consider using a library like Gamepad.js for gamepad support if needed
 *   Ensure accessibility features are considered (e.g. support for screen readers, alternative input methods)
 *   Continuously test on a variety of devices and browsers to ensure compatibility and responsiveness
 *   Gather player feedback on controls and make adjustments as needed
 *   Keep the codebase clean and maintainable as new features are added
 *   Regularly refactor and optimize the code as the project evolves
 *   Stay up to date with best practices for input handling in web games
 *   Continuously monitor performance and make improvements as needed
 *   Ensure that input handling is robust and does not cause bugs or crashes
 *   Consider security implications of input handling (e.g. prevent malicious input)
 *   Keep an eye on emerging technologies and trends in game input (e.g. VR/AR controllers, haptic feedback) and consider how they might be integrated in the future
 *   Overall, aim to create a responsive, intuitive, and enjoyable control scheme for players across all platforms!
 *   Remember to have fun and be creative with the input system design! The controls are a crucial part of the player experience, so it's worth investing time and effort into making them great.
 *   Good luck, and happy coding! 🎮✨
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
    q: 0, e: 0, b: 0, t: 0, f: 0
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
    left:  { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 },
    right: { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 }
};

// Legacy aliases — keep backward-compat with existing code that reads these.
window.touchJoystickLeft  = joysticks.left;
window.touchJoystickRight = joysticks.right;


// ══════════════════════════════════════════════════════════════
// 📱 MOBILE TWIN-STICK CONTROLS
// ══════════════════════════════════════════════════════════════

function initMobileControls() {
    var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice) return;

    var maxRadius = 60;
    var zoneL  = document.getElementById('joystick-left-zone');
    var baseL  = document.getElementById('joystick-left-base');
    var stickL = document.getElementById('joystick-left-stick');
    var zoneR  = document.getElementById('joystick-right-zone');
    var baseR  = document.getElementById('joystick-right-base');
    var stickR = document.getElementById('joystick-right-stick');

    function startJoystick(e, joystick, baseElem, stickElem, zoneElem, isRight) {
        if (gameState !== 'PLAYING') return;
        e.preventDefault();
        for (var i = 0; i < e.changedTouches.length; i++) {
            var touch = e.changedTouches[i];
            if (joystick.id === null) {
                joystick.id      = touch.identifier;
                joystick.active  = true;
                joystick.originX = touch.clientX;
                joystick.originY = touch.clientY;
                var zr = zoneElem.getBoundingClientRect();
                baseElem.style.display = 'block';
                baseElem.style.left    = (touch.clientX - zr.left) + 'px';
                baseElem.style.top     = (touch.clientY - zr.top)  + 'px';
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
                var d  = Math.hypot(dx, dy);
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
                joystick.id     = null;
                joystick.nx     = 0;
                joystick.ny     = 0;
                baseElem.style.display    = 'none';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 0;
            }
        }
    }

    zoneL.addEventListener('touchstart',  function(e) { startJoystick(e, joysticks.left,  baseL,  stickL, zoneL, false); }, { passive: false });
    zoneL.addEventListener('touchmove',   function(e) { moveJoystick(e,  joysticks.left,  stickL);                        }, { passive: false });
    zoneL.addEventListener('touchend',    function(e) { endJoystick(e,   joysticks.left,  baseL,  stickL, false);         }, { passive: false });
    zoneL.addEventListener('touchcancel', function(e) { endJoystick(e,   joysticks.left,  baseL,  stickL, false);         }, { passive: false });

    zoneR.addEventListener('touchstart',  function(e) { startJoystick(e, joysticks.right, baseR,  stickR, zoneR, true);  }, { passive: false });
    zoneR.addEventListener('touchmove',   function(e) { moveJoystick(e,  joysticks.right, stickR);                        }, { passive: false });
    zoneR.addEventListener('touchend',    function(e) { endJoystick(e,   joysticks.right, baseR,  stickR, true);          }, { passive: false });
    zoneR.addEventListener('touchcancel', function(e) { endJoystick(e,   joysticks.right, baseR,  stickR, true);          }, { passive: false });

    // ── Action buttons ─────────────────────────────────────────
    var btnDash     = document.getElementById('btn-dash');
    var btnSkill    = document.getElementById('btn-skill');
    var btnSwitch   = document.getElementById('btn-switch');
    var btnNaga     = document.getElementById('btn-naga');
    var btnDatabase = document.getElementById('btn-database');
    var btnTerminal = document.getElementById('btn-terminal');
    var btnShop     = document.getElementById('btn-shop');

    if (btnDash) {
        btnDash.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); keys.space = 1; }, { passive: false });
        btnDash.addEventListener('touchend',   function(e) { e.preventDefault(); e.stopPropagation(); keys.space = 0; }, { passive: false });
    }
    if (btnSkill) {
        btnSkill.addEventListener('touchstart', function(e) { e.preventDefault(); e.stopPropagation(); mouse.right = 1; }, { passive: false });
        btnSkill.addEventListener('touchend',   function(e) { e.preventDefault(); e.stopPropagation(); mouse.right = 0; }, { passive: false });
    }
    if (btnSwitch) {
        btnSwitch.addEventListener('touchstart', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING' && weaponSystem) weaponSystem.switchWeapon();
        }, { passive: false });
    }
    if (btnNaga) {
        btnNaga.addEventListener('touchstart', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING' && player instanceof PoomPlayer) {
                if (player.cooldowns.naga <= 0) player.summonNaga();
            }
        }, { passive: false });
    }
    if (btnDatabase) {
        btnDatabase.addEventListener('touchstart', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING')      openExternalDatabase();
            else if (gameState === 'PAUSED')  resumeGame();
        }, { passive: false });
    }
    if (btnTerminal) {
        btnTerminal.addEventListener('touchstart', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING')                        openAdminConsole();
            else if (gameState === 'PAUSED' && AdminConsole.isOpen) closeAdminConsole();
        }, { passive: false });
    }
    if (btnShop) {
        btnShop.addEventListener('touchstart', function(e) {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING') {
                openShop();
            } else if (gameState === 'PAUSED') {
                var shopModal = document.getElementById('shop-modal');
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


// ══════════════════════════════════════════════════════════════
// ⌨️  KEYBOARD & MOUSE EVENT LISTENERS
// (registered once by InputSystem.init() → window.onload)
// ══════════════════════════════════════════════════════════════

function _setupKeyboardListeners() {
    window.addEventListener('keydown', function(e) {
        // While admin console input has focus, ignore all game hotkeys
        var consoleInput = document.getElementById('console-input');
        if (consoleInput && document.activeElement === consoleInput) return;

        if (gameState === 'PAUSED') {
            var shopModal   = document.getElementById('shop-modal');
            var shopOpen    = shopModal && shopModal.style.display === 'flex';
            var consoleOpen = AdminConsole.isOpen;

            if (consoleOpen && e.code === 'Escape') { closeAdminConsole(); return; }
            if (shopOpen   && e.code === 'Escape') { closeShop();         return; }
            if (!shopOpen && !consoleOpen)          { resumeGame();        return; }
            return;
        }

        if (gameState !== 'PLAYING') return;

        if (e.code === 'KeyW')  keys.w     = 1;
        if (e.code === 'KeyS')  keys.s     = 1;
        if (e.code === 'KeyA')  keys.a     = 1;
        if (e.code === 'KeyD')  keys.d     = 1;
        if (e.code === 'Space') {
            e.preventDefault();
            if (typeof TutorialSystem !== 'undefined' && TutorialSystem.isActive()) {
                TutorialSystem.next();
            }
            keys.space = 1;
        }
        if (e.code === 'KeyQ')  keys.q     = 1;
        if (e.code === 'KeyE')  keys.e     = 1;
        if (e.code === 'KeyB')  keys.b     = 1;
        if (e.code === 'KeyF')  keys.f     = 1;

        // 'T' — Bullet Time toggle (global, no proximity gate)
        if (e.code === 'KeyT') toggleSlowMotion();
    });

    window.addEventListener('keyup', function(e) {
        if (e.code === 'KeyW')  keys.w     = 0;
        if (e.code === 'KeyS')  keys.s     = 0;
        if (e.code === 'KeyA')  keys.a     = 0;
        if (e.code === 'KeyD')  keys.d     = 0;
        if (e.code === 'Space') keys.space = 0;
        if (e.code === 'KeyE')  keys.e     = 0;
        if (e.code === 'KeyB')  keys.b     = 0;
        if (e.code === 'KeyF')  keys.f     = 0;
        // 'T' fires only on keydown; no keyup state needed.

        if (e.code === 'KeyQ') {
            if (gameState === 'PLAYING') {
                if (player instanceof PoomPlayer) keys.q = 0;
                else { weaponSystem.switchWeapon(); keys.q = 0; }
            } else { keys.q = 0; }
        }
    });
}

function _setupMouseListeners() {
    window.addEventListener('mousemove', function(e) {
        if (!CANVAS) return;
        var r = CANVAS.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
        // updateMouseWorld is defined in utils.js (loaded before input.js)
        updateMouseWorld();
    });

    window.addEventListener('mousedown', function(e) {
        if (!CANVAS) return;
        if (e.button === 0) mouse.left  = 1;
        if (e.button === 2) mouse.right = 1;
        e.preventDefault();
    });

    window.addEventListener('mouseup', function(e) {
        if (e.button === 0) mouse.left  = 0;
        if (e.button === 2) mouse.right = 0;
    });

    window.addEventListener('contextmenu', function(e) { e.preventDefault(); });
}


// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

var InputSystem = {
    /**
     * Call once from window.onload (before startGame).
     * Wires up all keyboard, mouse, and touch input handlers.
     */
    init: function() {
        _setupKeyboardListeners();
        _setupMouseListeners();
        initMobileControls();
        console.log('🕹️ InputSystem initialised.');
    }
};

window.InputSystem = InputSystem;