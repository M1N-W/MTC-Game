'use strict';

// ══════════════════════════════════════════════════════════════
// 🕐 TIME MANAGER (extracted from game.js)
// All mutable state lives on window.* so any script can read/write it.
// ══════════════════════════════════════════════════════════════

// ─── Constants (immutable — safe as local consts) ─────────────
const SLOW_MO_TIMESCALE     = 0.30;
const SLOW_MO_DRAIN_RATE    = 0.14;
const SLOW_MO_RECHARGE_RATE = 0.07;
const SM_BAR_W = 180;
const SM_BAR_H = 8;

window.SLOW_MO_TIMESCALE     = SLOW_MO_TIMESCALE;
window.SLOW_MO_DRAIN_RATE    = SLOW_MO_DRAIN_RATE;
window.SLOW_MO_RECHARGE_RATE = SLOW_MO_RECHARGE_RATE;
window.SM_BAR_W              = SM_BAR_W;
window.SM_BAR_H              = SM_BAR_H;

// ─── Mutable state — initialised on window directly ───────────
window.timeScale    = 1.0;
window.isSlowMotion = false;
window.slowMoEnergy = 1.0;
window.hitStopTimer = 0;

window.triggerHitStop = (ms) => {
    window.hitStopTimer = Math.max(window.hitStopTimer, ms / 1000);
};

// ══════════════════════════════════════════════════════════════
// 🕐 BULLET TIME
// ══════════════════════════════════════════════════════════════

function toggleSlowMotion() {
    if (!window.isSlowMotion) {
        if (window.slowMoEnergy < 0.05) {
            if (window.player) spawnFloatingText(GAME_TEXTS.time.noEnergy, window.player.x, window.player.y - 60, '#ef4444', 20);
            return;
        }
        window.isSlowMotion = true;
        window.timeScale    = SLOW_MO_TIMESCALE;
        addScreenShake(6);
        if (window.player) spawnFloatingText(GAME_TEXTS.time.bulletTime, window.player.x, window.player.y - 70, '#00e5ff', 26);
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    } else {
        window.isSlowMotion = false;
        window.timeScale    = 1.0;
        if (window.player) spawnFloatingText(GAME_TEXTS.time.normalSpeed, window.player.x, window.player.y - 55, '#34d399', 20);
    }
}

function _tickSlowMoEnergy(realDt) {
    if (window.isSlowMotion) {
        window.slowMoEnergy = Math.max(0, window.slowMoEnergy - SLOW_MO_DRAIN_RATE * realDt);
        if (window.slowMoEnergy <= 0) {
            window.isSlowMotion = false;
            window.timeScale    = 1.0;
            if (window.player) spawnFloatingText(GAME_TEXTS.time.energyDepleted, window.player.x, window.player.y - 60, '#ef4444', 20);
        }
    } else {
        window.slowMoEnergy = Math.min(1.0, window.slowMoEnergy + SLOW_MO_RECHARGE_RATE * realDt);
    }
}

function drawSlowMoOverlay() {
    if (!window.isSlowMotion && window.slowMoEnergy >= 1.0) return;

    const W   = CANVAS.width, H = CANVAS.height;
    const now = performance.now();

    if (window.isSlowMotion) {
        const vig = CTX.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.78);
        vig.addColorStop(0,    'rgba(0, 229, 255, 0.00)');
        vig.addColorStop(0.65, 'rgba(0, 200, 255, 0.06)');
        vig.addColorStop(1,    'rgba(0, 100, 200, 0.38)');
        CTX.fillStyle = vig;
        CTX.fillRect(0, 0, W, H);

        const offset = 2 + Math.sin(now / 80) * 0.8;
        CTX.save();
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = 0.04;
        CTX.fillStyle   = '#ff0000';
        CTX.fillRect(-offset, 0, W, H);
        CTX.fillStyle   = '#0000ff';
        CTX.fillRect( offset, 0, W, H);
        CTX.globalAlpha = 1;
        CTX.globalCompositeOperation = 'source-over';
        CTX.restore();

        const barH      = 28;
        const scanAlpha = 0.55 + Math.sin(now / 200) * 0.1;
        CTX.save();
        CTX.fillStyle = `rgba(0, 0, 0, ${scanAlpha})`;
        CTX.fillRect(0, 0,          W, barH);
        CTX.fillRect(0, H - barH,   W, barH);
        CTX.strokeStyle = 'rgba(0, 229, 255, 0.35)';
        CTX.lineWidth   = 1;
        CTX.beginPath(); CTX.moveTo(0, barH);     CTX.lineTo(W, barH);     CTX.stroke();
        CTX.beginPath(); CTX.moveTo(0, H - barH); CTX.lineTo(W, H - barH); CTX.stroke();
        CTX.restore();
    }

    {
        const bx    = W / 2;
        const by    = H - 140;
        const pulse = Math.abs(Math.sin(now / 320));

        CTX.save();

        const badgeW = SM_BAR_W / 2 + 20;
        const badgeH = 30;
        CTX.fillStyle = window.isSlowMotion
            ? `rgba(0, 20, 30, ${0.78 + pulse * 0.12})`
            : 'rgba(0, 10, 20, 0.55)';
        _roundRectPath(CTX, bx - badgeW, by - badgeH - 4, badgeW * 2, badgeH + 18, 8);
        CTX.fill();

        CTX.strokeStyle = window.isSlowMotion
            ? `rgba(0, 229, 255, ${0.55 + pulse * 0.35})`
            : 'rgba(0, 229, 255, 0.22)';
        CTX.lineWidth = 1.5;
        CTX.stroke();

        if (window.isSlowMotion) {
            CTX.shadowBlur  = 12 + pulse * 8;
            CTX.shadowColor = '#00e5ff';
        }
        CTX.font         = 'bold 12px Arial';
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillStyle    = window.isSlowMotion
            ? `rgba(0, 229, 255, ${0.8 + pulse * 0.2})`
            : 'rgba(0, 180, 220, 0.55)';
        CTX.fillText(window.isSlowMotion ? GAME_TEXTS.time.bulletTime : GAME_TEXTS.time.recharging, bx, by - badgeH + 8);
        CTX.shadowBlur = 0;

        const barX = bx - SM_BAR_W / 2;
        const barY = by - 6;
        CTX.fillStyle = 'rgba(0, 30, 40, 0.8)';
        _roundRectPath(CTX, barX, barY, SM_BAR_W, SM_BAR_H, 4);
        CTX.fill();

        const fillW = SM_BAR_W * window.slowMoEnergy;
        const r     = Math.round(lerp(0,   220, 1 - window.slowMoEnergy));
        const g     = Math.round(lerp(229, 60,  1 - window.slowMoEnergy));
        const b     = Math.round(lerp(255, 30,  1 - window.slowMoEnergy));
        CTX.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
        if (fillW > 0) {
            _roundRectPath(CTX, barX, barY, fillW, SM_BAR_H, 4);
            CTX.fill();
            if (window.isSlowMotion) {
                CTX.shadowBlur  = 8;
                CTX.shadowColor = `rgb(${r}, ${g}, ${b})`;
                CTX.fill();
                CTX.shadowBlur  = 0;
            }
        }

        CTX.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        CTX.lineWidth   = 1;
        for (let i = 1; i < 5; i++) {
            const tx = barX + (SM_BAR_W / 5) * i;
            CTX.beginPath(); CTX.moveTo(tx, barY); CTX.lineTo(tx, barY + SM_BAR_H); CTX.stroke();
        }

        CTX.fillStyle = 'rgba(200, 240, 255, 0.7)';
        CTX.font      = 'bold 9px Arial';
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillText(`${Math.round(window.slowMoEnergy * 100)}%`, bx + SM_BAR_W / 2 + 16, barY + SM_BAR_H / 2);

        CTX.restore();
    }

    if (window.isSlowMotion && window.player && Math.random() < 0.18) {
        const screen = typeof worldToScreen === 'function'
            ? worldToScreen(window.player.x, window.player.y)
            : { x: CANVAS.width / 2, y: CANVAS.height / 2 };

        const angle   = Math.random() * Math.PI * 2;
        const radius  = 32 + Math.random() * 28;
        const px      = screen.x + Math.cos(angle) * radius;
        const py      = screen.y + Math.sin(angle) * radius;
        const symbols = ['⏱', '⌛', '◈', '⧖'];

        CTX.save();
        CTX.globalAlpha  = 0.45 + Math.random() * 0.35;
        CTX.font         = `${10 + Math.random() * 6}px Arial`;
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.fillStyle    = '#00e5ff';
        CTX.shadowBlur   = 6;
        CTX.shadowColor  = '#00e5ff';
        CTX.fillText(symbols[Math.floor(Math.random() * symbols.length)], px, py);
        CTX.restore();
    }
}

function _roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

window.toggleSlowMotion  = toggleSlowMotion;
window._tickSlowMoEnergy = _tickSlowMoEnergy;
window.drawSlowMoOverlay = drawSlowMoOverlay;
window._roundRectPath    = _roundRectPath;
