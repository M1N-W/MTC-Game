'use strict';
/**
 * js/entities/boss/boss_attacks_shared.js
 *
 * Attack effects shared by ALL bosses.
 *
 * Load order: must be loaded BEFORE boss_attacks_manop.js and boss_attacks_first.js
 *
 * Contents:
 *   ExpandingRing  — Shockwave ring visual (used by both KruManop and KruFirst)
 */
// ════════════════════════════════════════════════════════════
// 💥 EXPANDING RING — Shockwave visual (BossFirst FREE_FALL)
// ════════════════════════════════════════════════════════════
class ExpandingRing {
    constructor(x, y, color, maxRadius = 140, duration = 0.5) {
        this.x = x; this.y = y; this.color = color;
        this.maxRadius = maxRadius; this.duration = duration;
        this.timer = 0; this.dead = false;
    }
    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration) this.dead = true;
        return this.dead;
    }
    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const prog = this.timer / this.duration;
        const r = this.maxRadius * Math.sqrt(prog);
        const alpha = 1 - prog;
        const now = performance.now();

        CTX.save();

        // ── Outer fill dome ───────────────────────────────────
        const fillG = CTX.createRadialGradient(screen.x, screen.y, r * 0.55, screen.x, screen.y, r);
        fillG.addColorStop(0, `rgba(255,255,255,0)`);
        fillG.addColorStop(0.7, (() => {
            const a = (alpha * 0.08).toFixed(3);
            if (this.color.startsWith('rgba(')) return this.color.replace(/,\s*[\d.]+\)$/, `,${a})`);
            if (this.color.startsWith('rgb(')) return this.color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
            const hex = this.color.replace('#', '');
            const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
            const r = parseInt(full.slice(0, 2), 16);
            const g = parseInt(full.slice(2, 4), 16);
            const b = parseInt(full.slice(4, 6), 16);
            return `rgba(${r},${g},${b},${a})`;
        })());
        fillG.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.globalAlpha = alpha * 0.6;
        CTX.fillStyle = fillG;
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.fill();

        // ── Primary thick ring ────────────────────────────────
        CTX.globalAlpha = alpha * 0.95;
        CTX.strokeStyle = this.color; CTX.lineWidth = 7 * (1 - prog * 0.7);
        CTX.shadowBlur = 22 * (1 - prog); CTX.shadowColor = this.color;
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.stroke();

        // ── Trailing inner ring ───────────────────────────────
        const r2 = this.maxRadius * Math.sqrt(prog * 0.78);
        CTX.globalAlpha = alpha * 0.50;
        CTX.lineWidth = 3.5 * (1 - prog);
        CTX.shadowBlur = 10;
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r2, 0, Math.PI * 2); CTX.stroke();

        // ── Spike burst at origin ─────────────────────────────
        if (prog < 0.35) {
            const sp = 1 - prog / 0.35;
            CTX.globalAlpha = alpha * sp * 0.70;
            CTX.lineWidth = 2;
            for (let si = 0; si < 8; si++) {
                const sa = (si / 8) * Math.PI * 2 + now * 0.002;
                const sLen = r * 0.22 * sp;
                CTX.beginPath();
                CTX.moveTo(screen.x + Math.cos(sa) * r * 0.10, screen.y + Math.sin(sa) * r * 0.10);
                CTX.lineTo(screen.x + Math.cos(sa) * sLen, screen.y + Math.sin(sa) * sLen);
                CTX.stroke();
            }
        }

        CTX.shadowBlur = 0;
        CTX.restore();
    }
}


window.ExpandingRing = ExpandingRing;
