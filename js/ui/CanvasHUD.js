'use strict';

/**
 * js/ui/CanvasHUD.js
 * ════════════════════════════════════════════════
 * Canvas 2D rendering layer for UI elements that are drawn
 * directly on the game canvas (minimap, combo counter, etc.).
 * ════════════════════════════════════════════════
 */

// ════════════════════════════════════════════════════════════
// Combo state variables
// ════════════════════════════════════════════════════════════
let comboCount = 0;
let comboTimer = 0;
let comboScale = 1.0;
let comboShake = 0.0;
const comboShakeDecay = 4.5;
const comboScaleDecay = 6.0;

/**
 * addCombo()
 * Increments combo counter and triggers visual impulse.
 */
function addCombo() {
    comboCount++;
    comboTimer = 2.0;
    comboScale = 1.6;
    comboShake = Math.min(1.0, 0.15 + comboCount / 30);
    try { if (typeof Audio !== 'undefined' && Audio.playCombo) Audio.playCombo(); } catch (e) { }
}

// ════════════════════════════════════════════════════════════
// CanvasHUD -- Canvas 2D rendering layer
// ════════════════════════════════════════════════════════════
class CanvasHUD {

    // -- Frame entry point -----------------------------------
    static draw(ctx, dt) {
        if (window.UIManager) UIManager.injectCooldownStyles(); 
        CanvasHUD.updateCombo(dt);
        CanvasHUD.drawCombo(ctx);
        if (!ctx || !ctx.canvas) return;
        CanvasHUD.drawConfusedWarning(ctx);
        CanvasHUD.drawMinimap(ctx);
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
        const y = Math.max(60, canvas.height * 0.14);
        const baseFont = 72;
        const size = Math.round(baseFont * comboScale + Math.min(40, comboCount * 1.2));

        ctx.save();
        ctx.font = `bold ${size}px "Orbitron", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        const gWidth = Math.max(240, size * 4);
        const grad = ctx.createLinearGradient(x - gWidth / 2, y - 30, x + gWidth / 2, y + 30);
        const t = Math.min(comboCount / 30, 1);
        
        const c1 = typeof lerpColorHex === 'function' ? lerpColorHex('#FFD54A', '#FF3B3B', t) : '#FFD54A';
        const c2 = typeof lerpColorHex === 'function' ? lerpColorHex('#FFE08A', '#FF6B6B', Math.min(1, t + 0.18)) : '#FFE08A';
        
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 22;

        const maxShake = Math.min(12, comboCount * 0.6);
        const shakeAmp = maxShake * comboShake;
        const shakeX = (Math.random() - 0.5) * shakeAmp;
        const shakeY = (Math.random() - 0.5) * shakeAmp;
        ctx.translate(x + shakeX, y + shakeY);

        const mainText = `${comboCount} ${(typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.ui?.hits) || 'HITS'}`;
        ctx.fillText(mainText, 0, -size * 0.14);
        ctx.lineWidth = Math.max(4, size * 0.07);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.strokeText(mainText, 0, -size * 0.14);

        let special = '';
        if (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.ui) {
            if (comboCount > 20) special = GAME_TEXTS.ui.godlike;
            else if (comboCount > 10) special = GAME_TEXTS.ui.unstoppable;
        }
        
        if (special) {
            const smallSize = Math.max(18, Math.round(size * 0.44));
            ctx.font = `bold ${smallSize}px "Orbitron", sans-serif`;
            ctx.fillText(special, 0, Math.round(size * 0.62));
            ctx.lineWidth = Math.max(3, smallSize * 0.08);
            ctx.strokeText(special, 0, Math.round(size * 0.62));
        }
        ctx.restore();
    }

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
        const text = (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.ui?.confusedWarning) || '⚠️ CONFUSED : INVERT YOUR MOVEMENT! ⚠️';
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
        ctx.shadowColor = '#d946ef';
        ctx.fillStyle = 'rgba(88, 28, 135, 0.88)';
        CanvasHUD._roundRect(ctx, pillX, pillY, pillW, pillH, radius);
        ctx.fill();

        ctx.shadowBlur = 10;
        ctx.shadowColor = '#e879f9';
        ctx.strokeStyle = 'rgba(233, 121, 249, 0.90)';
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

    static drawMinimap(ctx) {
        if (!ctx || !ctx.canvas) return;

        if (!UIManager._minimapFrame) UIManager._minimapFrame = 0;
        UIManager._minimapFrame++;

        const canvas = ctx.canvas;
        const radarRadius = 60;
        const scale = 0.1;
        const cx = canvas.width - 200;
        const cy = 90;
        const now = Date.now();
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
        const title = (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.ui?.minimapTitle) || 'TACTICAL RADAR';
        ctx.fillText(title, cx, cy + radarRadius + 5);

        const legend = (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.ui) ? [
            { col: '#ef4444', label: GAME_TEXTS.ui.legendEnm, shape: 'circle' },
            { col: '#b44dff', label: GAME_TEXTS.ui.legendMge, shape: 'diamond' },
            { col: '#ff7320', label: GAME_TEXTS.ui.legendTnk, shape: 'square' },
            { col: '#a855f7', label: GAME_TEXTS.ui.legendBss, shape: 'circle' },
            { col: '#f59e0b', label: GAME_TEXTS.ui.legendShp, shape: 'square' },
        ] : [];
        
        if (legend.length === 0) return;

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
            ctx.font = '6px monospace'; ctx.fillStyle = 'rgba(203,213,225,0.65)';
            ctx.fillText(label, lx, ly + 9);
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

window.CanvasHUD = CanvasHUD;
window.addCombo = addCombo;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CanvasHUD, addCombo };
}
