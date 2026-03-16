'use strict';

/**
 * js/weapons/PoomWeapon.js
 * ════════════════════════════════════════════════
 * Special weapon art for Poom (Bamboo Launcher).
 * ════════════════════════════════════════════════
 */

function drawPoomWeapon(ctx) {
    const now = performance.now();
    ctx.save();
    ctx.translate(12, 6);

    ctx.strokeStyle = "#92400e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.bezierCurveTo(-22, 2, -14, 12, -8, 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const bodyGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 14);
    bodyGrad.addColorStop(0, "#4ade80");
    bodyGrad.addColorStop(0.35, "#16a34a");
    bodyGrad.addColorStop(0.65, "#15803d");
    bodyGrad.addColorStop(1, "#14532d");
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(-14, -7, 28, 14, 3);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-14, -7, 28, 14, 3);
    ctx.clip();

    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    for (let wx = -28; wx <= 28; wx += 6) {
        ctx.beginPath();
        ctx.moveTo(wx, -7);
        ctx.lineTo(wx + 14, 7);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    for (let wx = -28; wx <= 28; wx += 6) {
        ctx.beginPath();
        ctx.moveTo(wx + 14, -7);
        ctx.lineTo(wx, 7);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 0.8;
    for (let gy = -5; gy <= 5; gy += 5) {
        ctx.beginPath();
        ctx.moveTo(-14, gy);
        ctx.lineTo(14, gy);
        ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(-14, -7, 28, 5);

    ctx.fillStyle = "rgba(20,83,45,0.40)";
    for (let dxi = -12; dxi <= 12; dxi += 6) {
        for (let dyi = -5; dyi <= 5; dyi += 5) {
            ctx.beginPath();
            ctx.arc(dxi, dyi, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();

    const ringPulse = 0.6 + Math.sin(now / 300) * 0.4;
    const ringPositions = [-8, 0, 8];
    for (const rx of ringPositions) {
        ctx.fillStyle = "#334155";
        ctx.fillRect(rx - 1.5, -8, 3, 16);
        ctx.fillStyle = `rgba(0,229,255,${ringPulse * 0.9})`;
        ctx.shadowBlur = 7;
        ctx.shadowColor = "#00e5ff";
        ctx.fillRect(rx - 1, -8.5, 2, 2.5);
        ctx.fillRect(rx - 1, 6, 2, 2.5);
        ctx.shadowBlur = 0;
    }

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(14, -4.5, 10, 9, 2);
    ctx.fill();
    ctx.fillStyle = "#475569";
    ctx.fillRect(14, -2.5, 10, 5);

    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(24, -6);
    ctx.lineTo(24, 6);
    ctx.lineTo(31, 3);
    ctx.lineTo(31, -3);
    ctx.closePath();
    ctx.fill();

    const emitGlow = 0.5 + Math.sin(now / 200) * 0.5;
    ctx.strokeStyle = `rgba(74,222,128,${emitGlow})`;
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#4ade80";
    ctx.beginPath();
    ctx.arc(31, 0, 4, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    const steamPhase = now / 350;
    for (let si = 0; si < 3; si++) {
        const st = (steamPhase + si * 0.55) % 1;
        const sy = (si - 1) * 4;
        const sx = 31 + st * 18;
        const sAlph = Math.max(0, (1 - st) * emitGlow * 0.7);
        ctx.globalAlpha = sAlph;
        ctx.fillStyle = "#bbf7d0";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#4ade80";
        ctx.beginPath();
        ctx.arc(sx, sy, 2 + st * 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    for (let bi = 0; bi < 2; bi++) {
        const bt = (steamPhase * 1.3 + bi * 0.7) % 1;
        const bAlph = Math.max(0, (1 - bt) * emitGlow * 0.5);
        ctx.globalAlpha = bAlph;
        ctx.fillStyle = `rgba(74,222,128,${bAlph})`;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(33 + bt * 12, (bi - 0.5) * 7 * bt, 1.5 + bt * 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.fillStyle = `rgba(187,247,208,${emitGlow})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#4ade80";
    ctx.beginPath();
    ctx.arc(31, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.roundRect(-22, -5, 9, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#92400e";
    ctx.fillRect(-22, -3, 9, 3);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    for (let gly = -4; gly <= 4; gly += 2) {
        ctx.beginPath();
        ctx.moveTo(-22, gly);
        ctx.lineTo(-13, gly);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(251,191,36,0.55)";
    ctx.lineWidth = 1.8;
    for (let tw = -20; tw <= -15; tw += 4) {
        ctx.beginPath();
        ctx.moveTo(tw, -5);
        ctx.lineTo(tw, 5);
        ctx.stroke();
    }
    const runeA = 0.45 + Math.sin(now / 400) * 0.3;
    ctx.globalAlpha = runeA;
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 0.7;
    ctx.shadowBlur = 5;
    ctx.shadowColor = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-21, -2);
    ctx.lineTo(-19, -4);
    ctx.lineTo(-17, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-21, 2);
    ctx.lineTo(-19, 4);
    ctx.lineTo(-17, 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    ctx.restore();
}

window.drawPoomWeapon = drawPoomWeapon;
