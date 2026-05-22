'use strict';

// ══════════════════════════════════════════════════════════════
// 🕐 TIME MANAGER (extracted from game.js)
// All mutable state lives on window.* so any script can read/write it.
// ══════════════════════════════════════════════════════════════

// ─── Constants (immutable — safe as local consts) ─────────────
const TIME_ENERGY_CONFIG = (typeof MTC_TIME_ENERGY !== 'undefined') ? MTC_TIME_ENERGY : {};
const SLOW_MO_MAX_ENERGY = TIME_ENERGY_CONFIG.maxEnergy || 100;
const SLOW_MO_MIN_ACTIVATE_ENERGY = TIME_ENERGY_CONFIG.minActivateEnergy || 20;
const SLOW_MO_TIMESCALE = TIME_ENERGY_CONFIG.slowScale || 0.30;
const SLOW_MO_DRAIN_RATE = TIME_ENERGY_CONFIG.drainPerSecond || 24;
const SLOW_MO_RECHARGE_RATE = TIME_ENERGY_CONFIG.rechargePerSecond || 16;
const SM_BAR_W = 180;
const SM_BAR_H = 8;

window.SLOW_MO_MAX_ENERGY = SLOW_MO_MAX_ENERGY;
window.SLOW_MO_MIN_ACTIVATE_ENERGY = SLOW_MO_MIN_ACTIVATE_ENERGY;
window.SLOW_MO_TIMESCALE = SLOW_MO_TIMESCALE;
window.SLOW_MO_DRAIN_RATE = SLOW_MO_DRAIN_RATE;
window.SLOW_MO_RECHARGE_RATE = SLOW_MO_RECHARGE_RATE;
window.SM_BAR_W = SM_BAR_W;
window.SM_BAR_H = SM_BAR_H;

// ─── Mutable state — initialised on window directly ───────────
window.timeScale = 1.0;
window.isSlowMotion = false;
window.slowMoMaxEnergy = SLOW_MO_MAX_ENERGY;
window.slowMoMinActivateEnergy = SLOW_MO_MIN_ACTIVATE_ENERGY;
window.slowMoCurrentEnergy = SLOW_MO_MAX_ENERGY;
window.slowMoEnergy = 1.0;
window.hitStopTimer = 0;

// IMP-3: hard cap at 0.5 s — prevents absurd freeze durations if a caller
// accidentally passes a very large value.
const HIT_STOP_MAX_S = 0.5;

window.triggerHitStop = (ms) => {
    const requested = ms / 1000;
    window.hitStopTimer = Math.min(HIT_STOP_MAX_S, Math.max(window.hitStopTimer, requested));
};

// ══════════════════════════════════════════════════════════════
// 🎨 BULLET TIME VISUAL STATE
// Module-scope lets — zero per-frame allocation.
// ══════════════════════════════════════════════════════════════

let _smFlashAlpha = 0;   // activation flash  0→1→0
let _smLetterboxH = 0;   // cinematic bar height in px (animated)
let _smRipples = [];  // bounded active pool refs, expanded in updateSlowMoVisuals()
let _smRippleTimer = 0;   // seconds until next ripple spawn
let _smStreaks = [];  // bounded active pool refs

const SM_LETTERBOX_TARGET = 36;   // px  — full letterbox height
const SM_LETTERBOX_SPEED = 220;  // px/s — slide animation speed
const SM_ARC_R = 38;   // px  — circular arc radius
const SM_ARC_STROKE = 6;    // px  — arc stroke width
const SM_RIPPLE_INTERVAL = 0.22; // s   — seconds between ripple rings
const SM_RIPPLE_MAX_R = 260;  // px  — ripple fade-out radius
const SM_RIPPLE_MAX = 8;
const SM_STREAK_MAX = 14;   // max simultaneous streak particles
const SM_CORNER_X = [0, 1, 1, 0];
const SM_CORNER_Y = [0, 0, 1, 1];
const _smScreenFallback = { x: 0, y: 0 };
const _smRipplePool = [];
const _smStreakPool = [];
for (let i = 0; i < SM_RIPPLE_MAX; i++) _smRipplePool.push({ active: false, r: 0, alpha: 0 });
for (let i = 0; i < SM_STREAK_MAX; i++) _smStreakPool.push({ active: false, angle: 0, r: 0, len: 0, alpha: 0, drift: 0, speed: 0 });
let _slowMoMaxEnergy = SLOW_MO_MAX_ENERGY;

// ══════════════════════════════════════════════════════════════
// 🕐 BULLET TIME — TOGGLE & TICK
// ══════════════════════════════════════════════════════════════

function _syncEnergyState(currentEnergy) {
    const clamped = Math.max(0, Math.min(_slowMoMaxEnergy, currentEnergy));
    window.slowMoCurrentEnergy = clamped;
    window.slowMoMaxEnergy = _slowMoMaxEnergy;
    window.slowMoMinActivateEnergy = SLOW_MO_MIN_ACTIVATE_ENERGY;
    window.slowMoEnergy = clamped / _slowMoMaxEnergy;
    if (typeof GameState !== 'undefined') {
        GameState.slowMoCurrentEnergy = clamped;
        GameState.slowMoMaxEnergy = _slowMoMaxEnergy;
        GameState.slowMoMinActivateEnergy = SLOW_MO_MIN_ACTIVATE_ENERGY;
        GameState.slowMoEnergy = window.slowMoEnergy;
    }
    return clamped;
}

function _setSlowMotionActive(active) {
    window.isSlowMotion = active;
    window.timeScale = active ? SLOW_MO_TIMESCALE : 1.0;
    if (typeof GameState !== 'undefined') {
        GameState.isSlowMotion = active;
        GameState.timeScale = window.timeScale;
    }
}

function toggleSlowMotion() {
    if (!window.isSlowMotion) {
        if (window.slowMoCurrentEnergy < SLOW_MO_MIN_ACTIVATE_ENERGY) {
            if (window.player && typeof AlertSystem !== 'undefined') {
                AlertSystem.emit(window.player, 'warning', { text: '[LOW ENERGY]' });
            }
            if (typeof TerminalLog !== 'undefined') {
                TerminalLog.push({ sender: 'TIME CORE', text: 'ENERGY BELOW ACTIVATION THRESHOLD', type: 'warn' });
            }
            if (window.player) spawnFloatingText(GAME_TEXTS.time.noEnergy, window.player.x, window.player.y - 60, '#ef4444', 20);
            return;
        }
        _setSlowMotionActive(true);
        addScreenShake(6);

        // 🎨 Activation flash + immediate ripple
        _smFlashAlpha = 1.0;
        _smRippleTimer = 0;

        if (window.player) spawnFloatingText(GAME_TEXTS.time.bulletTime, window.player.x, window.player.y - 70, '#00e5ff', 26);
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    } else {
        _setSlowMotionActive(false);
        if (window.player) spawnFloatingText(GAME_TEXTS.time.normalSpeed, window.player.x, window.player.y - 55, '#34d399', 20);
    }
}

function _tickSlowMoEnergy(realDt) {
    if (window.isSlowMotion) {
        const current = _syncEnergyState(window.slowMoCurrentEnergy - SLOW_MO_DRAIN_RATE * realDt);
        if (current <= 0) {
            _setSlowMotionActive(false);
            if (window.player && typeof AlertSystem !== 'undefined') {
                AlertSystem.emit(window.player, 'warning', { text: '[ENERGY EMPTY]' });
            }
            if (typeof TerminalLog !== 'undefined') {
                TerminalLog.push({ sender: 'TIME CORE', text: 'ENERGY DEPLETED', type: 'warn' });
            }
            if (window.player) spawnFloatingText(GAME_TEXTS.time.energyDepleted, window.player.x, window.player.y - 60, '#ef4444', 20);
        }
    } else {
        _syncEnergyState(window.slowMoCurrentEnergy + SLOW_MO_RECHARGE_RATE * realDt);
    }
}

function resetSlowMoEnergy() {
    _setSlowMotionActive(false);
    _syncEnergyState(_slowMoMaxEnergy);
    _smFlashAlpha = 0;
    _smLetterboxH = 0;
    _smRippleTimer = 0;
    for (let i = 0; i < _smRipplePool.length; i++) _smRipplePool[i].active = false;
    for (let i = 0; i < _smStreakPool.length; i++) _smStreakPool[i].active = false;
    _smRipples.length = 0;
    _smStreaks.length = 0;
}

function addSlowMoMaxEnergy(amount) {
    if (!Number.isFinite(amount)) return false;
    _slowMoMaxEnergy = Math.max(SLOW_MO_MAX_ENERGY, _slowMoMaxEnergy + amount);
    _syncEnergyState(window.slowMoCurrentEnergy + amount);
    return true;
}

function resetSlowMoEnergyTuning() {
    _slowMoMaxEnergy = SLOW_MO_MAX_ENERGY;
    resetSlowMoEnergy();
}

function canUseTimeEnergy(amount) {
    return Number.isFinite(amount) && amount >= 0 && window.slowMoCurrentEnergy >= amount;
}

function consumeTimeEnergy(amount) {
    if (!canUseTimeEnergy(amount)) return false;
    _syncEnergyState(window.slowMoCurrentEnergy - amount);
    if (window.isSlowMotion && window.slowMoCurrentEnergy <= 0) _setSlowMotionActive(false);
    return true;
}

// ══════════════════════════════════════════════════════════════
// 🎨 VISUAL UPDATE — called once per frame inside drawSlowMoOverlay
// Uses real wall-clock dt so animations are never slowed by timeScale.
// ══════════════════════════════════════════════════════════════

function updateSlowMoVisuals(realDt) {
    // Activation flash decay
    if (_smFlashAlpha > 0) _smFlashAlpha = Math.max(0, _smFlashAlpha - realDt * 3.5);

    // Letterbox slide in / out
    const lbTarget = window.isSlowMotion ? SM_LETTERBOX_TARGET : 0;
    const lbDiff = lbTarget - _smLetterboxH;
    _smLetterboxH += lbDiff * Math.min(1, SM_LETTERBOX_SPEED * realDt / Math.max(1, Math.abs(lbDiff)));
    if (Math.abs(lbDiff) < 0.5) _smLetterboxH = lbTarget;

    // Ripple rings — spawn + age (swap-and-pop, no splice)
    if (window.isSlowMotion) {
        _smRippleTimer -= realDt;
        if (_smRippleTimer <= 0 && _smRipples.length < SM_RIPPLE_MAX) {
            _smRippleTimer = SM_RIPPLE_INTERVAL;
            for (let i = 0; i < _smRipplePool.length; i++) {
                const rp = _smRipplePool[i];
                if (rp.active) continue;
                rp.active = true;
                rp.r = 20;
                rp.alpha = 0.7;
                _smRipples.push(rp);
                break;
            }
        }
    }
    for (let i = _smRipples.length - 1; i >= 0; i--) {
        const rp = _smRipples[i];
        rp.r += realDt * 180;
        rp.alpha -= realDt * 1.1;
        if (rp.alpha <= 0 || rp.r > SM_RIPPLE_MAX_R) {
            rp.active = false;
            _smRipples[i] = _smRipples[_smRipples.length - 1];
            _smRipples.pop();
        }
    }

    // Streak particles — spawn + age (swap-and-pop)
    if (window.isSlowMotion && _smStreaks.length < SM_STREAK_MAX && Math.random() < 0.35) {
        for (let i = 0; i < _smStreakPool.length; i++) {
            const st = _smStreakPool[i];
            if (st.active) continue;
            st.active = true;
            st.angle = Math.random() * Math.PI * 2;
            st.r = 18 + Math.random() * 22;
            st.len = 12 + Math.random() * 18;
            st.alpha = 0.55 + Math.random() * 0.35;
            st.drift = (Math.random() - 0.5) * 1.2;
            st.speed = 30 + Math.random() * 50;
            _smStreaks.push(st);
            break;
        }
    }
    for (let i = _smStreaks.length - 1; i >= 0; i--) {
        const s = _smStreaks[i];
        s.r += s.speed * realDt;
        s.angle += s.drift * realDt;
        s.alpha -= realDt * (window.isSlowMotion ? 1.4 : 3.0);
        if (s.alpha <= 0 || s.r > 90) {
            s.active = false;
            _smStreaks[i] = _smStreaks[_smStreaks.length - 1];
            _smStreaks.pop();
        }
    }
}

// ══════════════════════════════════════════════════════════════
// 🎨 DRAW — called each frame from game.js / drawGame()
// ══════════════════════════════════════════════════════════════

function drawSlowMoOverlay() {
    // Early-exit guard — nothing to render
    if (!window.isSlowMotion && window.slowMoEnergy >= 1.0 &&
        _smFlashAlpha <= 0 && _smLetterboxH < 0.5 &&
        _smRipples.length === 0 && _smStreaks.length === 0) return;

    if (typeof CTX === 'undefined' || typeof CANVAS === 'undefined') return;

    const W = CANVAS.width;
    const H = CANVAS.height;
    const now = performance.now();

    // ── 1. MULTI-LAYER VIGNETTE ────────────────────────────────────────
    if (window.isSlowMotion || _smFlashAlpha > 0) {
        CTX.save();

        // Dark overlay: solid fill avoids per-frame CanvasGradient allocation.
        CTX.fillStyle = 'rgba(0, 4, 12, 0.30)';
        CTX.fillRect(0, 0, W, H);

        // Animated cyan screen wash — breathing pulse
        if (window.isSlowMotion) {
            const pulse = 0.5 + Math.sin(now / 280) * 0.5;
            const vigAlpha = 0.08 + pulse * 0.06;
            CTX.fillStyle = `rgba(0, 180, 240, ${vigAlpha * 0.22})`;
            CTX.fillRect(0, 0, W, H);

            // 4-corner accent glows
            const cornerR = Math.min(W, H) * 0.38;
            const cAlpha = 0.12 + pulse * 0.10;
            CTX.fillStyle = `rgba(0, 229, 255, ${cAlpha * 0.18})`;
            for (let i = 0; i < 4; i++) {
                const cx = SM_CORNER_X[i] * W;
                const cy = SM_CORNER_Y[i] * H;
                CTX.fillRect(cx - cornerR * 0.5, cy - cornerR * 0.5, cornerR, cornerR);
            }
        }
        CTX.restore();
    }

    // ── 2. ACTIVATION FLASH ────────────────────────────────────────────
    if (_smFlashAlpha > 0) {
        CTX.save();
        const fEase = _smFlashAlpha * _smFlashAlpha; // quadratic decay
        CTX.fillStyle = `rgba(180, 245, 255, ${fEase * 0.28})`;
        CTX.fillRect(0, 0, W, H);
        // Bright border ring
        CTX.strokeStyle = `rgba(0, 229, 255, ${fEase * 0.9})`;
        CTX.lineWidth = 6 + fEase * 10;
        CTX.strokeRect(3, 3, W - 6, H - 6);
        CTX.restore();
    }

    // ── 3. CHROMATIC ABERRATION (variable offset) ──────────────────────
    if (window.isSlowMotion) {
        const aberPulse = 0.5 + Math.sin(now / 90) * 0.5;
        const offset = 1.5 + aberPulse * 1.8;
        CTX.save();
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = 0.055;
        CTX.fillStyle = '#ff0044';
        CTX.fillRect(-offset, 0, W, H);
        CTX.fillStyle = '#0044ff';
        CTX.fillRect(offset, 0, W, H);
        CTX.globalAlpha = 0.025;
        CTX.fillStyle = '#00ff88';
        CTX.fillRect(0, -offset * 0.5, W, H);
        CTX.globalAlpha = 1;
        CTX.globalCompositeOperation = 'source-over';
        CTX.restore();
    }

    // ── 4. CINEMATIC LETTERBOX BARS (smooth slide-in) ─────────────────
    if (_smLetterboxH > 0.5) {
        CTX.save();
        const lbH = Math.round(_smLetterboxH);

        // Dark bars top + bottom
        CTX.fillStyle = 'rgba(0, 2, 8, 0.88)';
        CTX.fillRect(0, 0, W, lbH);
        CTX.fillRect(0, H - lbH, W, lbH);

        // Glowing inner edge line
        const lineAlpha = window.isSlowMotion ? (0.5 + Math.sin(now / 220) * 0.25) : 0.2;
        CTX.strokeStyle = `rgba(0, 229, 255, ${lineAlpha})`;
        CTX.lineWidth = 1.5;
        CTX.shadowBlur = window.isSlowMotion ? 8 : 0;
        CTX.shadowColor = '#00e5ff';
        CTX.beginPath(); CTX.moveTo(0, lbH); CTX.lineTo(W, lbH); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(0, H - lbH); CTX.lineTo(W, H - lbH); CTX.stroke();
        CTX.shadowBlur = 0;

        // "BULLET TIME" label inside top bar
        if (window.isSlowMotion && lbH >= 20) {
            const textAlpha = Math.min(1, _smLetterboxH / SM_LETTERBOX_TARGET);
            CTX.font = `bold ${Math.min(13, lbH * 0.46)}px "Orbitron", "Arial", monospace`;
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            CTX.fillStyle = `rgba(0, 229, 255, ${textAlpha * (0.6 + Math.sin(now / 300) * 0.3)})`;
            CTX.shadowBlur = 10;
            CTX.shadowColor = '#00e5ff';
            CTX.fillText('\u23F1  BULLET TIME  \u23F1', W / 2, lbH / 2);
            CTX.shadowBlur = 0;

            // Energy % right-aligned in bar
            const pct = Math.round(window.slowMoEnergy * 100);
            CTX.font = `bold ${Math.min(11, lbH * 0.38)}px monospace`;
            CTX.textAlign = 'right';
            CTX.fillStyle = pct > 30
                ? `rgba(0, 229, 255, ${textAlpha * 0.75})`
                : `rgba(255, 80, 60, ${textAlpha * (0.7 + Math.sin(now / 120) * 0.3)})`;
            CTX.fillText(`${pct}%`, W - 14, lbH / 2);
        }
        CTX.restore();
    }

    // ── 5. TIME RIPPLE RINGS (concentric, from player position) ───────
    if (_smRipples.length > 0 && window.player) {
        const sc = typeof worldToScreen === 'function'
            ? worldToScreen(window.player.x, window.player.y)
            : _smScreenFallback;
        if (sc === _smScreenFallback) { sc.x = W / 2; sc.y = H / 2; }

        CTX.save();
        for (let i = 0; i < _smRipples.length; i++) {
            const rp = _smRipples[i];
            // Outer ring
            CTX.beginPath();
            CTX.arc(sc.x, sc.y, rp.r, 0, Math.PI * 2);
            CTX.strokeStyle = `rgba(0, 229, 255, ${rp.alpha * 0.55})`;
            CTX.lineWidth = 1.5 * rp.alpha;
            CTX.shadowBlur = 6 * rp.alpha;
            CTX.shadowColor = '#00e5ff';
            CTX.stroke();
            // Inner faint echo ring
            CTX.beginPath();
            CTX.arc(sc.x, sc.y, rp.r * 0.82, 0, Math.PI * 2);
            CTX.strokeStyle = `rgba(0, 180, 255, ${rp.alpha * 0.22})`;
            CTX.lineWidth = 0.8;
            CTX.shadowBlur = 0;
            CTX.stroke();
        }
        CTX.restore();
    }

    // ── 6. CLOCK-HAND STREAK PARTICLES ────────────────────────────────
    if (_smStreaks.length > 0 && window.player) {
        const sc = typeof worldToScreen === 'function'
            ? worldToScreen(window.player.x, window.player.y)
            : _smScreenFallback;
        if (sc === _smScreenFallback) { sc.x = W / 2; sc.y = H / 2; }

        CTX.save();
        for (let i = 0; i < _smStreaks.length; i++) {
            const s = _smStreaks[i];
            const sx = sc.x + Math.cos(s.angle) * s.r;
            const sy = sc.y + Math.sin(s.angle) * s.r;
            const ex = sc.x + Math.cos(s.angle) * (s.r - s.len);
            const ey = sc.y + Math.sin(s.angle) * (s.r - s.len);

            CTX.beginPath();
            CTX.moveTo(ex, ey);
            CTX.lineTo(sx, sy);
            CTX.strokeStyle = `rgba(180, 245, 255, ${s.alpha})`;
            CTX.lineWidth = 1.5 + s.alpha;
            CTX.shadowBlur = 5;
            CTX.shadowColor = '#00e5ff';
            CTX.stroke();

            // Tip dot
            CTX.beginPath();
            CTX.arc(sx, sy, 1.5 * s.alpha, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(200, 245, 255, ${s.alpha * 0.9})`;
            CTX.shadowBlur = 8;
            CTX.fill();
            CTX.shadowBlur = 0;
        }
        CTX.restore();
    }

    // ── 7. CIRCULAR ENERGY ARC (bottom-right corner HUD) ──────────────
    {
        const pulse = 0.5 + Math.sin(now / 350) * 0.5;
        const energy = window.slowMoEnergy;
        const pct = Math.round(energy * 100);

        // Position: bottom-right, floats above letterbox when visible
        const cx = W - 72;
        const cy = H - (_smLetterboxH > 4 ? _smLetterboxH + 62 : 72);
        const R = SM_ARC_R;

        CTX.save();

        // Backdrop circle
        CTX.beginPath();
        CTX.arc(cx, cy, R + 4, 0, Math.PI * 2);
        CTX.fillStyle = 'rgba(0, 8, 18, 0.78)';
        CTX.fill();
        CTX.strokeStyle = 'rgba(0, 229, 255, 0.12)';
        CTX.lineWidth = 1;
        CTX.stroke();

        // Dim track arc (full circle)
        CTX.beginPath();
        CTX.arc(cx, cy, R, -Math.PI / 2, Math.PI * 1.5);
        CTX.strokeStyle = 'rgba(0, 229, 255, 0.14)';
        CTX.lineWidth = SM_ARC_STROKE;
        CTX.lineCap = 'round';
        CTX.stroke();

        // Energy fill arc — cyan at full, shifts to red when depleting
        if (energy > 0.01) {
            const startA = -Math.PI / 2;
            const endA = startA + energy * Math.PI * 2;

            const rC = energy > 0.5 ? Math.round((1 - energy) * 2 * 255) : 255;
            const gC = Math.round(energy * 229);
            const bC = energy > 0.5 ? 255 : Math.round(energy * 2 * 100);
            const fillCol = `rgb(${Math.min(255, rC)}, ${Math.min(255, gC)}, ${Math.min(255, bC)})`;

            CTX.beginPath();
            CTX.arc(cx, cy, R, startA, endA);
            CTX.strokeStyle = fillCol;
            CTX.lineWidth = SM_ARC_STROKE;
            CTX.lineCap = 'round';
            if (window.isSlowMotion) {
                CTX.shadowBlur = 12 + pulse * 8;
                CTX.shadowColor = fillCol;
            }
            CTX.stroke();
            CTX.shadowBlur = 0;

            // Animated leading dot at arc tip
            const dotX = cx + Math.cos(endA) * R;
            const dotY = cy + Math.sin(endA) * R;
            CTX.beginPath();
            CTX.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
            CTX.fillStyle = 'rgba(255, 255, 255, 0.9)';
            CTX.shadowBlur = 10;
            CTX.shadowColor = fillCol;
            CTX.fill();
            CTX.shadowBlur = 0;
        }

        // Centre icon
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.font = '14px Arial';
        CTX.fillStyle = window.isSlowMotion
            ? `rgba(0, 229, 255, ${0.8 + pulse * 0.2})`
            : 'rgba(0, 180, 220, 0.55)';
        if (window.isSlowMotion) { CTX.shadowBlur = 10; CTX.shadowColor = '#00e5ff'; }
        CTX.fillText('\u23F1', cx, cy - 7);
        CTX.shadowBlur = 0;

        // Centre percentage
        CTX.font = 'bold 11px monospace';
        const lowEnergy = energy < 0.25;
        CTX.fillStyle = lowEnergy
            ? `rgba(255, 80, 60, ${0.75 + Math.sin(now / 110) * 0.25})`
            : `rgba(180, 240, 255, ${window.isSlowMotion ? 0.9 : 0.6})`;
        CTX.fillText(`${pct}%`, cx, cy + 8);

        // Label beneath arc
        CTX.font = 'bold 8px monospace';
        CTX.fillStyle = window.isSlowMotion
            ? `rgba(0, 229, 255, ${0.55 + pulse * 0.3})`
            : 'rgba(0, 180, 220, 0.35)';
        CTX.fillText('TIME ENERGY', cx, cy + R + 14);

        CTX.restore();
    }
}

// ══════════════════════════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════════════════════════

function _roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

window.toggleSlowMotion = toggleSlowMotion;
window._tickSlowMoEnergy = _tickSlowMoEnergy;
window.resetSlowMoEnergy = resetSlowMoEnergy;
window.addSlowMoMaxEnergy = addSlowMoMaxEnergy;
window.resetSlowMoEnergyTuning = resetSlowMoEnergyTuning;
window.canUseTimeEnergy = canUseTimeEnergy;
window.consumeTimeEnergy = consumeTimeEnergy;
window.updateSlowMoVisuals = updateSlowMoVisuals;
window.drawSlowMoOverlay = drawSlowMoOverlay;
window._roundRectPath = _roundRectPath;
