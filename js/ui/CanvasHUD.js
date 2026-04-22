"use strict";
// ══════════════════════════════════════════════════════════════════
//  js/ui/CanvasHUD.js  —  extracted from ui.js in v3.44.4
//  Phase 4 of HIGH #2 (see Markdown Source/Successed-Plan/HIGH2-…).
//
//  CanvasHUD owns every ctx.* draw call that belongs to the game HUD:
//    * Combo counter (addCombo / drawCombo)
//    * Confused-state warning banner
//    * Tactical minimap / radar (offscreen-cached at ~15 Hz)
//
//  Extraction is a pure move — no behaviour change.  The class is
//  registered on window.CanvasHUD and game.js continues to invoke
//  CanvasHUD.draw(ctx, dt) once per frame.
//
//  Dependencies (read at call-time, so load order only needs to make
//  them exist before the first frame):
//    window.UIManager.injectCooldownStyles  — ui.js
//    window.UIManager._minimapFrame         — UIManager static counter
//    window.player, enemies, boss, isFogWave,
//      MTC_DATABASE_SERVER, MTC_SHOP_LOCATION — runtime globals
//    lerpColorHex                           — utils.js
//    GAME_TEXTS                             — game-texts.js
// ══════════════════════════════════════════════════════════════════

// ── Combo state (module scope) ─────────────────────────────────────
// Previously lived at module scope in ui.js.  Moved here because the
// drawCombo / updateCombo methods close over them.  addCombo() is kept
// as a backward-compat export on window — external game code can still
// call `addCombo()` if it ever starts doing so (currently unused).
let comboCount = 0;
let comboTimer = 0;
let comboScale = 1.0;
let comboShake = 0.0;
const comboShakeDecay = 4.5;
const comboScaleDecay = 6.0;

// Respect user's motion preference — canvas shake is not governed by CSS.
// Cached at module load; matchMedia listener would be overkill for this.
const _PREFERS_REDUCED_MOTION =
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function addCombo() {
    comboCount++;
    comboTimer = 2.0;
    comboScale = 1.6;
    comboShake = Math.min(1.0, 0.15 + comboCount / 30);
    try { if (typeof Audio !== 'undefined' && Audio.playCombo) Audio.playCombo(); } catch (e) { }
}

class CanvasHUD {

    // -- Frame entry point -----------------------------------
    static draw(ctx, dt) {
        // UIManager may not be loaded yet on the very first call; guard.
        if (typeof window.UIManager?.injectCooldownStyles === 'function') {
            window.UIManager.injectCooldownStyles(); // no-op after first call
        }
        CanvasHUD.updateCombo(dt);
        CanvasHUD.drawCombo(ctx);
        if (!ctx || !ctx.canvas) return;
        CanvasHUD.drawConfusedWarning(ctx); // before minimap
        CanvasHUD.drawMinimap(ctx);         // always on top
    }

    // ── Combo UI ──────────────────────────────────────────────
    static updateCombo(dt) {
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                comboTimer = 0; comboCount = 0;
                comboScale = 1; comboShake = 0;
            }
        }
        comboScale += (1 - comboScale) * Math.min(1, dt * comboScaleDecay);
        comboShake = Math.max(0, comboShake - dt * comboShakeDecay);
    }

    static drawCombo(ctx) {
        if (!ctx || comboCount <= 0) return;
        const canvas = ctx.canvas;
        const x = canvas.width / 2;
        const y = Math.max(90, canvas.height * 0.22);
        const baseFont = 72;
        const rawSize = baseFont * comboScale + Math.min(28, comboCount * 0.8);
        const size = Math.round(Math.min(112, rawSize));

        ctx.save();
        ctx.font = `bold ${size}px "Orbitron", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        const gWidth = Math.max(240, size * 4);
        const grad = ctx.createLinearGradient(x - gWidth / 2, y - 30, x + gWidth / 2, y + 30);
        const t = Math.min(comboCount / 30, 1);
        grad.addColorStop(0, lerpColorHex('#FFD54A', '#FF3B3B', t));
        grad.addColorStop(1, lerpColorHex('#FFE08A', '#FF6B6B', Math.min(1, t + 0.18)));
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 22;

        const maxShake = Math.min(12, comboCount * 0.6);
        const shakeAmp = _PREFERS_REDUCED_MOTION ? 0 : maxShake * comboShake;
        const shakeX = (Math.random() - 0.5) * shakeAmp;
        const shakeY = (Math.random() - 0.5) * shakeAmp;
        ctx.translate(x + shakeX, y + shakeY);

        const mainText = `${comboCount} ${GAME_TEXTS.ui.hits}`;
        ctx.fillText(mainText, 0, -size * 0.14);
        ctx.lineWidth = Math.max(4, size * 0.07);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.strokeText(mainText, 0, -size * 0.14);

        let special = '';
        if (comboCount > 20) special = GAME_TEXTS.ui.godlike;
        else if (comboCount > 10) special = GAME_TEXTS.ui.unstoppable;
        if (special) {
            const smallSize = Math.max(18, Math.round(size * 0.44));
            ctx.font = `bold ${smallSize}px "Orbitron", sans-serif`;
            ctx.fillText(special, 0, Math.round(size * 0.62));
            ctx.lineWidth = Math.max(3, smallSize * 0.08);
            ctx.strokeText(special, 0, Math.round(size * 0.62));
        }
        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════
    // 😵 CONFUSED STATE WARNING BANNER
    // ════════════════════════════════════════════════════════════
    static drawConfusedWarning(ctx) {
        if (!ctx || !ctx.canvas) return;
        if (!window.player || !window.player.isConfused) return;

        const canvas = ctx.canvas;
        const now = performance.now();
        const flashVisible = Math.sin(now / 125) > 0;
        if (!flashVisible) return;

        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H - 270;
        const text = GAME_TEXTS.ui.confusedWarning;
        const fontSize = 17;
        const padX = 22;
        const padY = 11;
        const radius = 10;

        ctx.save();

        ctx.font = `bold ${fontSize}px "Orbitron", Arial, sans-serif`;
        const textW = ctx.measureText(text).width;
        const pillW = textW + padX * 2;
        const pillH = fontSize + padY * 2;
        const pillX = cx - pillW / 2;
        const pillY = cy - pillH / 2;

        ctx.shadowBlur = 28;
        ctx.shadowColor = '#ef4444';

        ctx.fillStyle = 'rgba(127, 29, 29, 0.88)';
        CanvasHUD._roundRect(ctx, pillX, pillY, pillW, pillH, radius);
        ctx.fill();

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fca5a5';
        ctx.strokeStyle = 'rgba(252, 165, 165, 0.90)';
        ctx.lineWidth = 2;
        CanvasHUD._roundRect(ctx, pillX, pillY, pillW, pillH, radius);
        ctx.stroke();

        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);

        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════
    // 🎯 TACTICAL MINIMAP / RADAR
    // ════════════════════════════════════════════════════════════
    static drawMinimap(ctx) {
        if (!ctx || !ctx.canvas) return;

        const UI = window.UIManager;
        if (UI) {
            if (!UI._minimapFrame) UI._minimapFrame = 0;
            UI._minimapFrame++;
        }

        const canvas = ctx.canvas;
        const radarRadius = 60;
        const scale = 0.1;
        const cx = Math.max(
            radarRadius + 30,
            Math.min(canvas.width - (radarRadius + 30), canvas.width - 200)
        );
        const cy = 90;
        const now = Date.now();

        const PAD_TOP = radarRadius + 6;
        const PAD_BOT = radarRadius + 28;
        const BOX_W = (radarRadius + 6) * 2;
        const BOX_H = PAD_TOP + PAD_BOT;
        const THROTTLE_MS = 66; // ~15 Hz

        let mc = CanvasHUD._minimapCache;
        if (!mc || mc.w !== BOX_W || mc.h !== BOX_H) {
            const c = document.createElement('canvas');
            c.width = BOX_W; c.height = BOX_H;
            mc = CanvasHUD._minimapCache = { canvas: c, ctx: c.getContext('2d'), w: BOX_W, h: BOX_H, lastAt: 0 };
        }

        if (now - mc.lastAt >= THROTTLE_MS) {
            mc.lastAt = now;
            const bctx = mc.ctx;
            bctx.save();
            bctx.setTransform(1, 0, 0, 1, 0, 0);
            bctx.clearRect(0, 0, BOX_W, BOX_H);
            bctx.translate(BOX_W / 2 - cx, PAD_TOP - cy);
            CanvasHUD._minimapRender(bctx, cx, cy, radarRadius, scale, now);
            bctx.restore();
        }

        ctx.drawImage(mc.canvas, cx - BOX_W / 2, cy - PAD_TOP);
    }

    static _minimapRender(ctx, cx, cy, radarRadius, scale, now) {
        const player = (typeof window !== 'undefined' && window.player)
            ? window.player : { x: 0, y: 0 };

        const toRadar = (wx, wy, maxR = radarRadius - 6) => {
            const rx = cx + (wx - player.x) * scale;
            const ry = cy + (wy - player.y) * scale;
            const dx = rx - cx, dy = ry - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= maxR) return { x: rx, y: ry, clamped: false };
            return { x: cx + dx * (maxR / d), y: cy + dy * (maxR / d), clamped: true };
        };

        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        CanvasHUD._minimapDrawShell(ctx, cx, cy, radarRadius, now);

        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius - 1, 0, Math.PI * 2); ctx.clip();

        CanvasHUD._minimapDrawContent(ctx, cx, cy, radarRadius, now, player, toRadar);

        ctx.restore();

        CanvasHUD._minimapDrawLabel(ctx, cx, cy, radarRadius);

        ctx.restore();
    }

    static _minimapDrawShell(ctx, cx, cy, radarRadius, now) {
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(57,255,20,0.07)'; ctx.fill();

        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'; ctx.fill();

        const borderSin = Math.sin(now / 500);
        const borderWidth = 2 + borderSin;
        ctx.lineWidth = borderWidth;
        ctx.globalAlpha = 0.80 + borderSin * 0.15;
        ctx.strokeStyle = '#39ff14';
        ctx.shadowBlur = 12 + borderSin * 6;
        ctx.shadowColor = '#39ff14';
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(134,239,172,0.28)';
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius - 3, 0, Math.PI * 2); ctx.stroke();
    }

    static _minimapDrawContent(ctx, cx, cy, radarRadius, now, player, toRadar) {
        if (window.isFogWave) {
            ctx.fillStyle = 'rgba(6, 30, 50, 0.95)';
            ctx.fillRect(cx - radarRadius, cy - radarRadius, radarRadius * 2, radarRadius * 2);

            const noiseNow = Date.now();
            for (let n = 0; n < 6; n++) {
                const seed = Math.floor(noiseNow / 80) + n * 7919;
                const nyOff = ((seed * 1664525 + 1013904223) & 0x7fffffff) % (radarRadius * 2);
                const ny = cy - radarRadius + nyOff;
                const nalpha = 0.12 + (((seed * 6364136) & 0xff) / 255) * 0.25;
                const nw = 0.6 + (((seed * 22695477) & 0xff) / 255) * 1.4;
                ctx.save();
                ctx.globalAlpha = nalpha;
                ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = nw;
                ctx.beginPath();
                ctx.moveTo(cx - radarRadius, ny); ctx.lineTo(cx + radarRadius, ny);
                ctx.stroke();
                ctx.restore();
            }

            const slPulse = 0.65 + Math.sin(noiseNow / 350) * 0.35;
            ctx.save();
            ctx.globalAlpha = slPulse;
            ctx.shadowBlur = 14; ctx.shadowColor = '#06b6d4';
            ctx.fillStyle = '#06b6d4';
            ctx.font = 'bold 10px "Orbitron", Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('SIGNAL', cx, cy - 7);
            ctx.fillText('LOST', cx, cy + 7);
            ctx.restore();
            return;
        }

        ctx.lineWidth = 0.7;
        [radarRadius * 0.33, radarRadius * 0.66].forEach(r => {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(57,255,20,0.14)'; ctx.stroke();
        });
        ctx.strokeStyle = 'rgba(57,255,20,0.20)'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx - radarRadius + 2, cy); ctx.lineTo(cx + radarRadius - 2, cy);
        ctx.moveTo(cx, cy - radarRadius + 2); ctx.lineTo(cx, cy + radarRadius - 2);
        ctx.stroke();

        const SWEEP_RPM = 1 / 3;
        const sweepAngle = ((now / 1000) * SWEEP_RPM * Math.PI * 2) % (Math.PI * 2);
        const trailArc = Math.PI * 2 / 3;
        const TRAIL_STEPS = 24;
        ctx.fillStyle = 'rgb(72,187,120)';
        for (let i = 0; i < TRAIL_STEPS; i++) {
            const frac = i / TRAIL_STEPS;
            const aStart = sweepAngle - trailArc * (1 - frac);
            const aEnd = sweepAngle - trailArc * (1 - frac - 1 / TRAIL_STEPS);
            ctx.globalAlpha = frac * frac * 0.22;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radarRadius - 1, aStart, aEnd);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.strokeStyle = 'rgba(134,239,172,0.85)'; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6; ctx.shadowColor = '#48bb78';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle) * (radarRadius - 1),
            cy + Math.sin(sweepAngle) * (radarRadius - 1));
        ctx.stroke();
        ctx.restore();

        if (window.MTC_DATABASE_SERVER) {
            const S = window.MTC_DATABASE_SERVER;
            const { x: sx, y: sy, clamped: sc } = toRadar(S.x, S.y, radarRadius - 8);
            const dbPulse = 0.65 + Math.sin(now / 550) * 0.35;
            const SZ = sc ? 3.5 : 5;
            ctx.save(); ctx.translate(sx, sy);
            ctx.shadowBlur = 10 * dbPulse; ctx.shadowColor = '#60a5fa';
            if (sc) {
                const ax = cx - sx, ay = cy - sy;
                ctx.rotate(Math.atan2(ay, ax));
                ctx.globalAlpha = 0.8 + dbPulse * 0.2;
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
            } else {
                ctx.globalAlpha = 0.85 + dbPulse * 0.15;
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(-SZ, -SZ, SZ * 2, SZ * 2);
                ctx.globalAlpha = dbPulse * 0.95;
                ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1.2;
                ctx.strokeRect(-SZ, -SZ, SZ * 2, SZ * 2);
            }
            ctx.restore();
        }

        if (window.MTC_SHOP_LOCATION) {
            const SH = window.MTC_SHOP_LOCATION;
            const { x: shx, y: shy, clamped: shc } = toRadar(SH.x, SH.y, radarRadius - 8);
            const shPulse = 0.65 + Math.sin(now / 700 + 1.2) * 0.35;
            const SZ = shc ? 3.5 : 4.5;
            ctx.save(); ctx.translate(shx, shy);
            ctx.shadowBlur = 7 * shPulse; ctx.shadowColor = '#f59e0b';
            if (shc) {
                const ax = cx - shx, ay = cy - shy;
                ctx.rotate(Math.atan2(ay, ax));
                ctx.globalAlpha = 0.7 + shPulse * 0.3;
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
            } else {
                ctx.globalAlpha = 0.7 + shPulse * 0.25;
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(-SZ, -SZ, SZ * 2, SZ * 2);
                ctx.globalAlpha = shPulse * 0.85;
                ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.2;
                ctx.strokeRect(-SZ, -SZ, SZ * 2, SZ * 2);
            }
            ctx.restore();
        }

        if (Array.isArray(window.enemies)) {
            for (const e of window.enemies) {
                if (!e || e.dead) continue;
                const { x: ex, y: ey, clamped: ec } = toRadar(e.x, e.y);
                ctx.save();
                if (ec) {
                    ctx.translate(ex, ey);
                    ctx.rotate(Math.atan2(cy - ey, cx - ex));
                    const arrowColor = e.type === 'mage'
                        ? 'rgba(180,80,255,0.9)'
                        : (e.type === 'tank' ? 'rgba(255,120,40,0.9)' : 'rgba(255,50,50,0.9)');
                    ctx.fillStyle = arrowColor; ctx.shadowBlur = 5; ctx.shadowColor = arrowColor;
                    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, -3.5); ctx.lineTo(0, 3.5);
                    ctx.closePath(); ctx.fill();
                } else if (e.type === 'mage') {
                    ctx.translate(ex, ey); ctx.rotate(now / 800);
                    const r = 6;
                    ctx.fillStyle = 'rgba(190,75,255,1.0)'; ctx.strokeStyle = 'rgba(220,160,255,0.9)';
                    ctx.lineWidth = 1.2; ctx.shadowBlur = 8; ctx.shadowColor = '#b44dff';
                    ctx.beginPath();
                    ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0);
                    ctx.closePath(); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = 'rgba(240,200,255,0.85)'; ctx.shadowBlur = 4;
                    ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();
                } else if (e.type === 'tank') {
                    const r = 5.5;
                    ctx.fillStyle = 'rgba(255,115,35,1.0)'; ctx.strokeStyle = 'rgba(255,185,90,0.9)';
                    ctx.lineWidth = 1.4; ctx.shadowBlur = 7; ctx.shadowColor = '#ff7320';
                    ctx.beginPath(); ctx.rect(ex - r, ey - r, r * 2, r * 2); ctx.fill(); ctx.stroke();
                    ctx.strokeStyle = 'rgba(255,220,120,0.75)'; ctx.lineWidth = 1; ctx.shadowBlur = 0;
                    const tk = 2.5;
                    [[ex - r, ey - r], [ex + r, ey - r], [ex - r, ey + r], [ex + r, ey + r]].forEach(([px, py]) => {
                        ctx.beginPath(); ctx.arc(px, py, tk, 0, Math.PI * 2); ctx.stroke();
                    });
                } else {
                    const r = 5;
                    const glow = 0.6 + Math.sin(now / 400 + e.x) * 0.4;
                    ctx.fillStyle = 'rgba(255,38,38,1.0)'; ctx.shadowBlur = 8 * glow; ctx.shadowColor = '#ff2222';
                    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = 'rgba(255,180,180,0.75)'; ctx.shadowBlur = 0;
                    ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
                }
                ctx.restore();
            }
        }

        if (window.boss && !window.boss.dead) {
            const t = (now % 1000) / 1000;
            const pulse = 0.5 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.8;
            const { x: bx, y: by, clamped: bc } = toRadar(window.boss.x, window.boss.y, radarRadius - 10);
            ctx.save();
            ctx.shadowBlur = 14 * pulse; ctx.shadowColor = '#a855f7';
            if (bc) {
                ctx.translate(bx, by);
                ctx.rotate(Math.atan2(cy - by, cx - bx));
                ctx.globalAlpha = 0.7 + pulse * 0.3;
                ctx.fillStyle = '#a855f7';
                ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -5); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
            } else {
                ctx.globalAlpha = 0.75 + 0.25 * pulse;
                ctx.fillStyle = '#aa6eff';
                ctx.beginPath(); ctx.arc(bx, by, 6 * pulse, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 0.30 + 0.15 * pulse;
                ctx.strokeStyle = '#d8b4fe'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(bx, by, 10 + 3 * pulse, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 0.75 + 0.25 * pulse;
                ctx.fillStyle = '#ffdcff';
                ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText('BOSS', bx, by - 12 - 2 * pulse);
            }
            ctx.restore();
        }

        ctx.save();
        ctx.translate(cx, cy);
        if (player.angle !== undefined) ctx.rotate(player.angle + Math.PI / 2);
        ctx.shadowBlur = 8; ctx.shadowColor = '#34d399';
        ctx.fillStyle = 'rgba(52,214,88,0.98)';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(0, -5, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    static _minimapDrawLabel(ctx, cx, cy, radarRadius) {
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = 'bold 8px Orbitron, monospace';
        ctx.fillStyle = 'rgba(72,187,120,0.70)';
        ctx.fillText(GAME_TEXTS.ui.minimapTitle, cx, cy + radarRadius + 5);

        const legend = [
            { col: '#ef4444', label: GAME_TEXTS.ui.legendEnm, shape: 'circle' },
            { col: '#b44dff', label: GAME_TEXTS.ui.legendMge, shape: 'diamond' },
            { col: '#ff7320', label: GAME_TEXTS.ui.legendTnk, shape: 'square' },
            { col: '#a855f7', label: GAME_TEXTS.ui.legendBss, shape: 'circle' },
            { col: '#f59e0b', label: GAME_TEXTS.ui.legendShp, shape: 'square' },
        ];
        const lx0 = cx - (legend.length - 1) * 12;
        legend.forEach(({ col, label, shape }, i) => {
            const lx = lx0 + i * 24;
            const ly = cy + radarRadius + 17;
            ctx.fillStyle = col; ctx.shadowBlur = 3; ctx.shadowColor = col;
            if (shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(lx, ly - 3.5); ctx.lineTo(lx + 3, ly); ctx.lineTo(lx, ly + 3.5); ctx.lineTo(lx - 3, ly);
                ctx.closePath(); ctx.fill();
            } else if (shape === 'square') {
                ctx.fillRect(lx - 3, ly - 3, 6, 6);
            } else {
                ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.font = 'bold 8px monospace'; ctx.fillStyle = 'rgba(226,232,240,0.85)';
            ctx.fillText(label, lx, ly + 10);
        });
    }

    static _roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
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
    }
}

if (typeof window !== 'undefined') {
    window.CanvasHUD = CanvasHUD;
    window.addCombo = addCombo;
}
