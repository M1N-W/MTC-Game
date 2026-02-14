/**
 * 🛠️ MTC: ENHANCED EDITION - Utilities
 * Helper functions and common utilities
 */

// Math utilities
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const lerp = (a, b, t) => a + (b - a) * t;

// Angle utilities
const normalizeAngle = (angle) => {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
};

const angleDiff = (a1, a2) => {
    let diff = a2 - a1;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
};

// Collision detection
const circleCollision = (x1, y1, r1, x2, y2, r2) => {
    return dist(x1, y1, x2, y2) < r1 + r2;
};

const pointInRect = (px, py, rx, ry, rw, rh) => {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
};

const rectCollision = (x1, y1, w1, h1, x2, y2, w2, h2) => {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
};

// Circle-Rectangle collision
const circleRectCollision = (cx, cy, radius, rx, ry, rw, rh) => {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (radius * radius);
};

// Point to line distance (for graph collision)
const pointToLineDistance = (px, py, x1, y1, x2, y2) => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
};

// Screen shake
let screenShake = 0;

const addScreenShake = (amount) => {
    screenShake = Math.max(screenShake, amount);
};

const updateScreenShake = () => {
    if (screenShake > 0) {
        screenShake *= GAME_CONFIG.visual.screenShakeDecay;
        if (screenShake < 0.1) screenShake = 0;
    }
};

const getScreenShakeOffset = () => {
    if (screenShake <= 1) return { x: 0, y: 0 };
    return {
        x: (Math.random() - 0.5) * screenShake,
        y: (Math.random() - 0.5) * screenShake
    };
};

// Score management
let score = 0;

const addScore = (points) => {
    score += points;
    updateScoreUI();
};

const getScore = () => score;

const resetScore = () => {
    score = 0;
    updateScoreUI();
};

const updateScoreUI = () => {
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = score;
};

// Canvas utilities
let CANVAS, CTX;

const initCanvas = () => {
    CANVAS = document.getElementById('gameCanvas');
    CTX = CANVAS.getContext('2d', { alpha: false });
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
};

const resizeCanvas = () => {
    CANVAS.width = window.innerWidth;
    CANVAS.height = window.innerHeight;
};

const getCanvas = () => CANVAS;
const getContext = () => CTX;

// Camera system
const camera = { x: 0, y: 0 };

const updateCamera = (targetX, targetY) => {
    const smoothing = GAME_CONFIG.canvas.cameraSmooth;
    camera.x += (targetX - CANVAS.width / 2 - camera.x) * smoothing;
    camera.y += (targetY - CANVAS.height / 2 - camera.y) * smoothing;
};

const getCamera = () => camera;

const screenToWorld = (screenX, screenY) => {
    return {
        x: screenX + camera.x,
        y: screenY + camera.y
    };
};

const worldToScreen = (worldX, worldY) => {
    return {
        x: worldX - camera.x,
        y: worldY - camera.y
    };
};

// Mouse/Touch utilities
const mouse = { x: 0, y: 0, left: 0, right: 0, wx: 0, wy: 0 };

const updateMouseWorld = () => {
    const world = screenToWorld(mouse.x, mouse.y);
    mouse.wx = world.x;
    mouse.wy = world.y;
};

const getMouse = () => mouse;

// Time utilities
let lastTime = 0;

const getDeltaTime = (now) => {
    const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap at 100ms
    lastTime = now;
    return dt;
};

const resetTime = () => {
    lastTime = performance.now();
};

// Random utilities
const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];

const randomInt = (min, max) => Math.floor(rand(min, max + 1));

const randomBool = (probability = 0.5) => Math.random() < probability;

// Color utilities
const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

const rgbaString = (hex, alpha) => {
    const rgb = hexToRgb(hex);
    return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : hex;
};

// Wave management
let wave = 1;

const getWave = () => wave;
const setWave = (w) => {
    wave = w;
    updateWaveUI();
};
const nextWave = () => {
    wave++;
    updateWaveUI();
};

const updateWaveUI = () => {
    const waveEl = document.getElementById('wave-badge');
    if (waveEl) waveEl.textContent = `WAVE ${wave}`;
};

// Enemy kill tracking
let enemiesKilled = 0;

const addEnemyKill = () => {
    enemiesKilled++;
};

const getEnemiesKilled = () => enemiesKilled;
const resetEnemiesKilled = () => {
    enemiesKilled = 0;
};

// Text formatting
const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return Math.round(num).toString();
};

// DOM utilities
const showElement = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
};

const hideElement = (id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
};

const setElementText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
};

// Debounce utility
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Export utilities
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        dist, rand, clamp, lerp,
        normalizeAngle, angleDiff,
        circleCollision, pointInRect, rectCollision, circleRectCollision,
        pointToLineDistance,
        addScreenShake, updateScreenShake, getScreenShakeOffset,
        addScore, getScore, resetScore,
        initCanvas, resizeCanvas, getCanvas, getContext,
        updateCamera, getCamera, screenToWorld, worldToScreen,
        updateMouseWorld, getMouse,
        getDeltaTime, resetTime,
        randomChoice, randomInt, randomBool,
        hexToRgb, rgbaString,
        getWave, setWave, nextWave,
        addEnemyKill, getEnemiesKilled, resetEnemiesKilled,
        formatNumber,
        showElement, hideElement, setElementText,
        debounce
    };
}
