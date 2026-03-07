'use strict';

// ══════════════════════════════════════════════════════════════
// 🕐 TIME MANAGER (extracted from game.js)
// All mutable state lives on window.* so any script can read/write it.
// ══════════════════════════════════════════════════════════════

// ─── Constants (immutable — safe as local consts) ─────────────
const SLOW_MO_TIMESCALE = 0.30;
const SLOW_MO_DRAIN_RATE = 0.14;
const SLOW_MO_RECHARGE_RATE = 0.07;
const SM_BAR_W = 180;
const SM_BAR_H = 8;

window.SLOW_MO_TIMESCALE = SLOW_MO_TIMESCALE;
window.SLOW_MO_DRAIN_RATE = SLOW_MO_DRAIN_RATE;
window.SLOW_MO_RECHARGE_RATE = SLOW_MO_RECHARGE_RATE;
window.SM_BAR_W = SM_BAR_W;
window.SM_BAR_H = SM_BAR_H;

// ─── Mutable state — initialised on window directly ───────────
window.timeScale = 1.0;
window.isSlowMotion = false;
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
let _smRipples = [];  // [{r, alpha}] — expanded in _smUpdateVisuals
let _smRippleTimer = 0;   // seconds until next ripple spawn
let _smStreaks = [];  // [{angle, r, len, alpha, drift, speed}]

const SM_LETTERBOX_TARGET = 36;   // px  — full letterbox height
const SM_LETTERBOX_SPEED = 220;  // px/s — slide animation speed
const SM_ARC_R = 38;   // px  — circular arc radius
const SM_ARC_STROKE = 6;    // px  — arc stroke width
const SM_RIPPLE_INTERVAL = 0.22; // s   — seconds between ripple rings
const SM_RIPPLE_MAX_R = 260;  // px  — ripple fade-out radius
const SM_STREAK_MAX = 14;   // max simultaneous streak particles

// Wall-clock timestamp — for real-dt so visuals aren't slowed by timeScale
let _smLastNow = 0;

// ══════════════════════════════════════════════════════════════
// 🕐 BULLET TIME — TOGGLE & TICK
// ══════════════════════════════════════════════════════════════

function toggleSlowMotion() {
    if (!window.isSlowMotion) {
        if (window.slowMoEnergy < 0.05) {
            if (window.player) spawnFloatingText(GAME_TEXTS.time.noEnergy, window.player.x, window.player.y - 60, '#ef4444', 20);
            return;
        }
        window.isSlowMotion = true;
        window.timeScale = SLOW_MO_TIMESCALE;
        if (typeof GameState !== 'undefined') { GameState.isSlowMotion = true; GameState.timeScale = SLOW_MO_TIMESCALE; }
        addScreenShake(6);

        // 🎨 Activation flash + immediate ripple
        _smFlashAlpha = 1.0;
        _smRippleTimer = 0;

        if (window.player) spawnFloatingText(GAME_TEXTS.time.bulletTime, window.player.x, window.player.y - 70, '#00e5ff', 26);
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    } else {
        window.isSlowMotion = false;
        window.timeScale = 1.0;
        if (typeof GameState !== 'undefined') { GameState.isSlowMotion = false; GameState.timeScale = 1.0; }
        if (window.player) spawnFloatingText(GAME_TEXTS.time.normalSpeed, window.player.x, window.player.y - 55, '#34d399', 20);
    }
}

function _tickSlowMoEnergy(realDt) {
    if (window.isSlowMotion) {
        window.slowMoEnergy = Math.max(0, window.slowMoEnergy - SLOW_MO_DRAIN_RATE * realDt);
        if (typeof GameState !== 'undefined') GameState.slowMoEnergy = window.slowMoEnergy;
        if (window.slowMoEnergy <= 0) {
            window.isSlowMotion = false;
            window.timeScale = 1.0;
            if (typeof GameState !== 'undefined') { GameState.isSlowMotion = false; GameState.timeScale = 1.0; GameState.slowMoEnergy = 0; }
            if (window.player) spawnFloatingText(GAME_TEXTS.time.energyDepleted, window.player.x, window.player.y - 60, '#ef4444', 20);
        }
    } else {
        window.slowMoEnergy = Math.min(1.0, window.slowMoEnergy + SLOW_MO_RECHARGE_RATE * realDt);
        if (typeof GameState !== 'undefined') GameState.slowMoEnergy = window.slowMoEnergy;
    }
}

// ══════════════════════════════════════════════════════════════
// 🎨 VISUAL UPDATE — called once per frame inside drawSlowMoOverlay
// Uses real wall-clock dt so animations are never slowed by timeScale.
// ══════════════════════════════════════════════════════════════

function _smUpdateVisuals(realDt) {
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
        if (_smRippleTimer <= 0) {
            _smRippleTimer = SM_RIPPLE_INTERVAL;
            _smRipples.push({ r: 20, alpha: 0.7 });
        }
    }
    for (let i = _smRipples.length - 1; i >= 0; i--) {
        const rp = _smRipples[i];
        rp.r += realDt * 180;
        rp.alpha -= realDt * 1.1;
        if (rp.alpha <= 0 || rp.r > SM_RIPPLE_MAX_R) {
            _smRipples[i] = _smRipples[_smRipples.length - 1];
            _smRipples.pop();
        }
    }

    // Streak particles — spawn + age (swap-and-pop)
    if (window.isSlowMotion && _smStreaks.length < SM_STREAK_MAX && Math.random() < 0.35) {
        _smStreaks.push({
            angle: Math.random() * Math.PI * 2,
            r: 18 + Math.random() * 22,
            len: 12 + Math.random() * 18,
            alpha: 0.55 + Math.random() * 0.35,
            drift: (Math.random() - 0.5) * 1.2,
            speed: 30 + Math.random() * 50,
        });
    }
    for (let i = _smStreaks.length - 1; i >= 0; i--) {
        const s = _smStreaks[i];
        s.r += s.speed * realDt;
        s.angle += s.drift * realDt;
        s.alpha -= realDt * (window.isSlowMotion ? 1.4 : 3.0);
        if (s.alpha <= 0 || s.r > 90) {
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

    // Real-time dt — unaffected by timeScale
    const realDt = Math.min(0.05, _smLastNow > 0 ? (now - _smLastNow) / 1000 : 0);
    _smLastNow = now;
    _smUpdateVisuals(realDt);

    // ── 1. MULTI-LAYER VIGNETTE ────────────────────────────────────────
    if (window.isSlowMotion || _smFlashAlpha > 0) {
        CTX.save();

        // Dark outer vignette
        const vig1 = CTX.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.82);
        vig1.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vig1.addColorStop(0.60, 'rgba(0, 10, 20, 0.10)');
        vig1.addColorStop(1, 'rgba(0, 0, 10, 0.60)');
        CTX.fillStyle = vig1;
        CTX.fillRect(0, 0, W, H);

        // Animated cyan inner bloom — breathing pulse
        if (window.isSlowMotion) {
            const pulse = 0.5 + Math.sin(now / 280) * 0.5;
            const vigAlpha = 0.08 + pulse * 0.06;
            const vig2 = CTX.createRadialGradient(W / 2, H / 2, H * 0.05, W / 2, H / 2, H * 0.72);
            vig2.addColorStop(0, `rgba(0, 229, 255, ${vigAlpha})`);
            vig2.addColorStop(0.5, `rgba(0, 180, 240, ${vigAlpha * 0.4})`);
            vig2.addColorStop(1, 'rgba(0, 0, 0, 0)');
            CTX.fillStyle = vig2;
            CTX.fillRect(0, 0, W, H);

            // 4-corner accent glows
            const cornerR = Math.min(W, H) * 0.38;
            const cAlpha = 0.12 + pulse * 0.10;
            [[0, 0], [W, 0], [W, H], [0, H]].forEach(([cx, cy]) => {
                const cg = CTX.createRadialGradient(cx, cy, 0, cx, cy, cornerR);
                cg.addColorStop(0, `rgba(0, 229, 255, ${cAlpha})`);
                cg.addColorStop(1, 'rgba(0, 0, 0, 0)');
                CTX.fillStyle = cg;
                CTX.fillRect(0, 0, W, H);
            });
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
            : { x: W / 2, y: H / 2 };

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
            : { x: W / 2, y: H / 2 };

        CTX.save();
        for (let i = 0; i < _smStreaks.length; i++) {
            const s = _smStreaks[i];
            const sx = sc.x + Math.cos(s.angle) * s.r;
            const sy = sc.y + Math.sin(s.angle) * s.r;
            const ex = sc.x + Math.cos(s.angle) * (s.r - s.len);
            const ey = sc.y + Math.sin(s.angle) * (s.r - s.len);

            const g = CTX.createLinearGradient(ex, ey, sx, sy);
            g.addColorStop(0, `rgba(0, 229, 255, 0)`);
            g.addColorStop(0.4, `rgba(0, 229, 255, ${s.alpha * 0.4})`);
            g.addColorStop(1, `rgba(180, 245, 255, ${s.alpha})`);

            CTX.beginPath();
            CTX.moveTo(ex, ey);
            CTX.lineTo(sx, sy);
            CTX.strokeStyle = g;
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
        CTX.fillText('BULLET TIME', cx, cy + R + 14);

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
window.drawSlowMoOverlay = drawSlowMoOverlay;
window._roundRectPath = _roundRectPath;