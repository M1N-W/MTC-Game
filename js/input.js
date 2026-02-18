/**
 * 🕹️ INPUT SYSTEM — js/input.js
 * ─────────────────────────────────────────────────────────────────
 * Owns ALL raw input state and event wiring for MTC: Enhanced Edition.
 *
 * GLOBALS DEFINED HERE (accessible to every subsequent script tag):
 *   keys               — keyboard digital state  { w, a, s, d, space, q, e, b, t, f }
 *   mouse              — pointer state  { x, y, worldX, worldY, left, right }
 *   window.touchJoystickLeft  — left  twin-stick state object
 *   window.touchJoystickRight — right twin-stick state object
 *
 * LOAD ORDER:
 *   config.js → utils.js → audio.js → effects.js → weapons.js →
 *   map.js → ui.js → ai.js → entities.js → input.js → game.js
 *
 * USAGE:
 *   InputSystem.init() is called once from window.onload (in game.js).
 *   keyboard/mouse listeners are registered then, and initMobileControls()
 *   is called to wire up touch joysticks and action buttons.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

// ══════════════════════════════════════════════════════════════
// GLOBAL INPUT STATE
// ══════════════════════════════════════════════════════════════

/**
 * Digital keyboard state.
 * keys.t  → Bullet Time toggle  (fires on keydown; no keyup needed)
 * keys.f  → Admin Terminal open (proximity-gated in game.js)
 */
const keys = {
    w: 0, a: 0, s: 0, d: 0,
    space: 0,
    q: 0, e: 0, b: 0, t: 0, f: 0
};

/**
 * Mouse / pointer state.
 * worldX / worldY are updated by updateMouseWorld() (utils.js) each frame.
 */
const mouse = {
    x: 0, y: 0,        // canvas-space pixel position
    worldX: 0, worldY: 0, // world-space position (set by updateMouseWorld)
    left: 0, right: 0  // button state  1 = held, 0 = released
};

// ── Twin-Stick Touch Joysticks ─────────────────────────────────
window.touchJoystickLeft  = { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 };
window.touchJoystickRight = { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 };


// ══════════════════════════════════════════════════════════════
// 📱 MOBILE TWIN-STICK CONTROLS
// ══════════════════════════════════════════════════════════════

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
                joystick.id      = touch.identifier;
                joystick.active  = true;
                joystick.originX = touch.clientX;
                joystick.originY = touch.clientY;
                const zr = zoneElem.getBoundingClientRect();
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
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                let dx = touch.clientX - joystick.originX;
                let dy = touch.clientY - joystick.originY;
                const d = Math.hypot(dx, dy);
                if (d > maxRadius) { dx = (dx / d) * maxRadius; dy = (dy / d) * maxRadius; }
                joystick.nx = dx / maxRadius;
                joystick.ny = dy / maxRadius;
                stickElem.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            }
        }
    }

    function endJoystick(e, joystick, baseElem, stickElem, isRight = false) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
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

    zoneL.addEventListener('touchstart',  (e) => startJoystick(e, window.touchJoystickLeft,  baseL,  stickL, zoneL),        { passive: false });
    zoneL.addEventListener('touchmove',   (e) => moveJoystick(e,  window.touchJoystickLeft,  stickL),                        { passive: false });
    zoneL.addEventListener('touchend',    (e) => endJoystick(e,   window.touchJoystickLeft,  baseL,  stickL),                { passive: false });
    zoneL.addEventListener('touchcancel', (e) => endJoystick(e,   window.touchJoystickLeft,  baseL,  stickL),                { passive: false });

    zoneR.addEventListener('touchstart',  (e) => startJoystick(e, window.touchJoystickRight, baseR,  stickR, zoneR, true),  { passive: false });
    zoneR.addEventListener('touchmove',   (e) => moveJoystick(e,  window.touchJoystickRight, stickR),                        { passive: false });
    zoneR.addEventListener('touchend',    (e) => endJoystick(e,   window.touchJoystickRight, baseR,  stickR, true),          { passive: false });
    zoneR.addEventListener('touchcancel', (e) => endJoystick(e,   window.touchJoystickRight, baseR,  stickR, true),          { passive: false });

    // ── Action buttons ─────────────────────────────────────────
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
            if (gameState === 'PLAYING')      openExternalDatabase();
            else if (gameState === 'PAUSED')  resumeGame();
        }, { passive: false });
    }
    if (btnTerminal) {
        btnTerminal.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING')                        openAdminConsole();
            else if (gameState === 'PAUSED' && AdminConsole.isOpen) closeAdminConsole();
        }, { passive: false });
    }
    if (btnShop) {
        btnShop.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING') {
                openShop();
            } else if (gameState === 'PAUSED') {
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


// ══════════════════════════════════════════════════════════════
// ⌨️  KEYBOARD & MOUSE EVENT LISTENERS
// (registered once by InputSystem.init() → window.onload)
// ══════════════════════════════════════════════════════════════

function _setupKeyboardListeners() {
    window.addEventListener('keydown', e => {
        // While admin console input has focus, ignore all game hotkeys
        const consoleInput = document.getElementById('console-input');
        if (consoleInput && document.activeElement === consoleInput) return;

        if (gameState === 'PAUSED') {
            const shopModal   = document.getElementById('shop-modal');
            const shopOpen    = shopModal && shopModal.style.display === 'flex';
            const consoleOpen = AdminConsole.isOpen;

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
        if (e.code === 'Space') { keys.space = 1; e.preventDefault(); }
        if (e.code === 'KeyQ')  keys.q     = 1;
        if (e.code === 'KeyE')  keys.e     = 1;
        if (e.code === 'KeyB')  keys.b     = 1;
        if (e.code === 'KeyF')  keys.f     = 1;

        // 'T' — Bullet Time toggle (global, no proximity gate)
        if (e.code === 'KeyT') toggleSlowMotion();
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
}


// ══════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════

const InputSystem = {
    /**
     * Call once from window.onload (before startGame).
     * Wires up all keyboard, mouse, and touch input handlers.
     */
    init() {
        _setupKeyboardListeners();
        _setupMouseListeners();
        initMobileControls();
        console.log('🕹️ InputSystem initialised.');
    }
};

window.InputSystem = InputSystem;
