/**
 * 🛠️ MTC: ENHANCED EDITION - Utilities (REFACTORED)
 * SINGLE SOURCE OF TRUTH for every shared helper function.
 *
 * LOAD ORDER: config.js → utils.js → audio.js → effects.js → weapons.js → map.js → ui.js → ai.js → entities.js → game.js
 * This file MUST be the second script loaded (immediately after config.js).
 * All other files depend on globals defined here.
 *
 * CHANGES (Stability Overhaul):
 * - ✅ lerpColorHex / lerpColor moved HERE from ui.js (removes duplicate)
 * - ✅ showVoiceBubble() global wrapper added — safe even before UIManager loads
 * - ✅ All save/load helpers kept here (getSaveData, updateSaveData, …)
 * - ✅ All functions declared with `var` so they are available on window globally
 *       in every other script regardless of load order.
 */

// ─── Math utilities ───────────────────────────────────────────
var dist  = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
var rand  = (min, max) => Math.random() * (max - min) + min;
var clamp = (val, min, max) => Math.max(min, Math.min(max, val));
var lerp  = (a, b, t) => a + (b - a) * t;

// ─── Angle utilities ──────────────────────────────────────────
var normalizeAngle = (angle) => {
    while (angle >  Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
};

var angleDiff = (a1, a2) => {
    let diff = a2 - a1;
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
};

// ─── Collision detection ──────────────────────────────────────
var circleCollision = (x1, y1, r1, x2, y2, r2) =>
    dist(x1, y1, x2, y2) < r1 + r2;

var pointInRect = (px, py, rx, ry, rw, rh) =>
    px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;

var rectCollision = (x1, y1, w1, h1, x2, y2, w2, h2) =>
    x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;

var circleRectCollision = (cx, cy, radius, rx, ry, rw, rh) => {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (radius * radius);
};

var pointToLineDistance = (px, py, x1, y1, x2, y2) => {
    const A = px - x1, B = py - y1;
    const C = x2 - x1, D = y2 - y1;
    const dot   = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;
    let xx, yy;
    if      (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else                { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.sqrt((px - xx) ** 2 + (py - yy) ** 2);
};

// ─── Color utilities ──────────────────────────────────────────
// NOTE: These are defined here to avoid the duplicate that previously
// lived in ui.js. ui.js references these globals — no redefinition needed.

var hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

var rgbaString = (hex, alpha) => {
    const rgb = hexToRgb(hex);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : hex;
};

/**
 * lerpColorHex(a, b, t)
 * Interpolates between two hex colour strings.
 * Returns an `rgb(r,g,b)` string.
 *
 * MOVED HERE from ui.js to eliminate the duplicate-identifier crash.
 * ui.js now calls this global directly.
 */
var lerpColorHex = (a, b, t) => {
    t = Math.max(0, Math.min(1, t));
    const ac = hexToRgb(a);
    const bc = hexToRgb(b);
    if (!ac || !bc) return a; // graceful fallback
    return `rgb(${
        Math.round(ac.r + (bc.r - ac.r) * t)},${
        Math.round(ac.g + (bc.g - ac.g) * t)},${
        Math.round(ac.b + (bc.b - ac.b) * t)})`;
};

/** Alias kept for any existing call-sites that use lerpColor(). */
var lerpColor = lerpColorHex;

// ─── UI helper — voice bubble ─────────────────────────────────
/**
 * showVoiceBubble(text, worldX, worldY)
 * Global wrapper so map.js and entities.js can call this without
 * knowing whether UIManager has already been constructed.
 *
 * If UIManager exists → delegates to UIManager.showVoiceBubble().
 * Otherwise → silently skips (never throws).
 *
 * FIXES: map.js MTCRoom crash when calling UIManager before ui.js loads.
 */
var showVoiceBubble = (text, worldX, worldY) => {
    try {
        if (window.UIManager && typeof window.UIManager.showVoiceBubble === 'function') {
            window.UIManager.showVoiceBubble(text, worldX, worldY);
        }
    } catch (e) {
        // Swallow — never let a missing UI crash the game loop
    }
};

// ─── Screen shake ─────────────────────────────────────────────
let screenShake = 0;

var addScreenShake = (amount) => {
    screenShake = Math.max(screenShake, amount);
};

var updateScreenShake = () => {
    if (screenShake > 0) {
        screenShake *= GAME_CONFIG.visual.screenShakeDecay;
        if (screenShake < 0.1) screenShake = 0;
    }
};

var getScreenShakeOffset = () => {
    if (screenShake <= 1) return { x: 0, y: 0 };
    return {
        x: (Math.random() - 0.5) * screenShake,
        y: (Math.random() - 0.5) * screenShake
    };
};

// ─── Score management ─────────────────────────────────────────
let score = 0;

var addScore = (points) => {
    score += points;
    updateScoreUI();
};

var getScore = () => score;

var resetScore = () => {
    score = 0;
    updateScoreUI();
};

var updateScoreUI = () => {
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = score.toLocaleString();
};

// ─── Canvas utilities ─────────────────────────────────────────
var CANVAS, CTX;

var initCanvas = () => {
    CANVAS = document.getElementById('gameCanvas');
    if (!CANVAS) { console.error('[MTC] #gameCanvas not found!'); return; }
    CTX = CANVAS.getContext('2d', { alpha: false });
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
};

var resizeCanvas = () => {
    if (!CANVAS) return;
    CANVAS.width  = window.innerWidth;
    CANVAS.height = window.innerHeight;
};

var getCanvas  = () => CANVAS;
var getContext = () => CTX;

// ─── Camera system ────────────────────────────────────────────
var camera = { x: 0, y: 0 };

var updateCamera = (targetX, targetY) => {
    const smoothing = GAME_CONFIG.canvas.cameraSmooth;
    camera.x += (targetX - CANVAS.width  / 2 - camera.x) * smoothing;
    camera.y += (targetY - CANVAS.height / 2 - camera.y) * smoothing;
};

var getCamera = () => camera;

var screenToWorld = (screenX, screenY) => ({
    x: screenX + camera.x,
    y: screenY + camera.y
});

var worldToScreen = (worldX, worldY) => ({
    x: worldX - camera.x,
    y: worldY - camera.y
});

// ─── Mouse / Touch utilities ──────────────────────────────────
var mouse = { x: 0, y: 0, left: 0, right: 0, wx: 0, wy: 0 };

var updateMouseWorld = () => {
    const world = screenToWorld(mouse.x, mouse.y);
    mouse.wx = world.x;
    mouse.wy = world.y;
};

var getMouse = () => mouse;

// ─── Time utilities ───────────────────────────────────────────
let lastTime = 0;

var getDeltaTime = (now) => {
    const dt = Math.min((now - lastTime) / 1000, 0.1); // cap at 100 ms
    lastTime = now;
    return dt;
};

var resetTime = () => {
    lastTime = performance.now();
};

// ─── Random utilities ─────────────────────────────────────────
var randomChoice = (array) => array[Math.floor(Math.random() * array.length)];
var randomInt    = (min, max) => Math.floor(rand(min, max + 1));
var randomBool   = (probability = 0.5) => Math.random() < probability;

// ─── Wave management ──────────────────────────────────────────
let wave = 1;

var getWave  = () => wave;
var setWave  = (w) => { wave = w; updateWaveUI(); };
var nextWave = () => { wave++; updateWaveUI(); };

var updateWaveUI = () => {
    const waveEl = document.getElementById('wave-badge');
    if (waveEl) waveEl.textContent = `WAVE ${wave}`;
};

// ─── Enemy kill tracking ──────────────────────────────────────
let enemiesKilled = 0;

var addEnemyKill       = () => { enemiesKilled++; };
var getEnemiesKilled   = () => enemiesKilled;
var resetEnemiesKilled = () => { enemiesKilled = 0; };

// ─── Text formatting ──────────────────────────────────────────
var formatNumber = (num) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000)     return (num / 1_000).toFixed(1)     + 'K';
    return Math.round(num).toString();
};

// ─── DOM utilities ────────────────────────────────────────────
var showElement = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
};

var hideElement = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

var setElementText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
};

// ─── Debounce ─────────────────────────────────────────────────
var debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => { clearTimeout(timeout); func(...args); }, wait);
    };
};

// ══════════════════════════════════════════════════════════════
// 💾 PERSISTENCE — localStorage Save / Load System
// ══════════════════════════════════════════════════════════════

const MTC_SAVE_KEY = 'mtc_save_v1';

const DEFAULT_SAVE_DATA = {
    highScore:        0,
    unlockedPassives: []
};

var saveData = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.warn('[MTC Save] Could not write to localStorage:', e.message || e);
        return false;
    }
};

var loadData = (key, defaultValue = null) => {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('[MTC Save] Could not read from localStorage:', e.message || e);
        return defaultValue;
    }
};

var getSaveData = () => {
    const stored = loadData(MTC_SAVE_KEY, {});
    return { ...DEFAULT_SAVE_DATA, ...stored };
};

var updateSaveData = (partial) => {
    const current = getSaveData();
    const merged  = { ...current, ...partial };
    const ok      = saveData(MTC_SAVE_KEY, merged);
    if (ok) console.log('[MTC Save] Saved:', merged);
    return ok;
};

// ─── Exports (Node / bundler) ──────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        dist, rand, clamp, lerp,
        normalizeAngle, angleDiff,
        circleCollision, pointInRect, rectCollision, circleRectCollision,
        pointToLineDistance,
        hexToRgb, rgbaString, lerpColorHex, lerpColor,
        showVoiceBubble,
        addScreenShake, updateScreenShake, getScreenShakeOffset,
        addScore, getScore, resetScore,
        initCanvas, resizeCanvas, getCanvas, getContext,
        updateCamera, getCamera, screenToWorld, worldToScreen,
        updateMouseWorld, getMouse,
        getDeltaTime, resetTime,
        randomChoice, randomInt, randomBool,
        getWave, setWave, nextWave,
        addEnemyKill, getEnemiesKilled, resetEnemiesKilled,
        formatNumber,
        showElement, hideElement, setElementText,
        debounce,
        MTC_SAVE_KEY, DEFAULT_SAVE_DATA,
        saveData, loadData, getSaveData, updateSaveData
    };
}