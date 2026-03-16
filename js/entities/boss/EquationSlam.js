'use strict';

/**
 * js/entities/boss/EquationSlam.js
 * 💥 EQUATION SLAM — Boss shockwave ring with formula shards
 */
class EquationSlam {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 50;
        this.maxRadius = BALANCE.boss.slamRadius;
        this.speed = 400;
        this.damage = BALANCE.boss.slamDamage;
        this.hit = false;
        // Shard formula symbols flung outward
        this._shards = Array.from({ length: 14 }, (_, i) => ({
            angle: (i / 14) * Math.PI * 2,
            speed: 180 + Math.random() * 120,
            dist: 30,
            formula: ['∑', 'Δ', 'π', '∞', '∂', 'Ω', '√', 'λ', 'θ', '∫', 'φ', 'σ', 'μ', 'γ'][i],
            spin: (Math.random() - 0.5) * 8,
            rot: Math.random() * Math.PI * 2,
        }));
    }

    update(dt, player) {
        this.radius += this.speed * dt;

        // Update shard positions
        for (const sh of this._shards) {
            sh.dist += sh.speed * dt;
            sh.rot += sh.spin * dt;
        }

        // Ring-front hit detection
        if (!this.hit) {
            const d = Math.hypot(player.x - this.x, player.y - this.y);
            if (d <= this.radius && d >= this.radius - 30) {
                player.takeDamage(this.damage);
                this.hit = true;
            }
        }

        return this.radius >= this.maxRadius;
    }

    draw() {
        if (typeof CTX === 'undefined') return;
        const screen = worldToScreen(this.x, this.y);
        const prog = this.radius / this.maxRadius;
        const alpha = 1 - prog;
        const now = performance.now();

        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ── Crater fill glow ──────────────────────────────────
        CTX.globalAlpha = alpha * 0.22;
        const craterG = CTX.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        craterG.addColorStop(0, 'rgba(255,255,255,0.8)');
        craterG.addColorStop(0.35, 'rgba(251,191,36,0.5)');
        craterG.addColorStop(1, 'rgba(120,53,15,0)');
        CTX.fillStyle = craterG;
        CTX.beginPath(); CTX.arc(0, 0, this.radius, 0, Math.PI * 2); CTX.fill();

        // ── Primary blast ring ────────────────────────────────
        CTX.globalAlpha = alpha * 0.95;
        CTX.shadowBlur = 30 * (1 - prog); CTX.shadowColor = '#fbbf24';
        CTX.strokeStyle = '#ffffff'; CTX.lineWidth = 8 * (1 - prog * 0.7);
        CTX.beginPath(); CTX.arc(0, 0, this.radius, 0, Math.PI * 2); CTX.stroke();

        // ── Secondary gold ring ───────────────────────────────
        CTX.globalAlpha = alpha * 0.65;
        CTX.strokeStyle = '#f59e0b'; CTX.lineWidth = 4 * (1 - prog * 0.6);
        CTX.shadowBlur = 14; CTX.shadowColor = '#fbbf24';
        CTX.beginPath(); CTX.arc(0, 0, this.radius * 0.88, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Radial chalk spikes ────────────────────────────────
        CTX.globalAlpha = alpha * 0.70;
        CTX.strokeStyle = '#fef3c7'; CTX.lineWidth = 2.5;
        for (let si = 0; si < 18; si++) {
            const sa = (si / 18) * Math.PI * 2 + now * 0.0015;
            const sLen = this.radius * (0.07 + Math.abs(Math.sin(now / 60 + si * 1.7)) * 0.12);
            CTX.beginPath();
            CTX.moveTo(Math.cos(sa) * this.radius, Math.sin(sa) * this.radius);
            CTX.lineTo(Math.cos(sa) * (this.radius + sLen), Math.sin(sa) * (this.radius + sLen));
            CTX.stroke();
        }

        // ── Origin burst (early) ──────────────────────────────
        if (prog < 0.18) {
            const bp = 1 - prog / 0.18;
            CTX.globalAlpha = bp * 0.90;
            CTX.fillStyle = '#ffffff'; CTX.shadowBlur = 50; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(0, 0, 28 * bp, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#fbbf24';
            CTX.beginPath(); CTX.arc(0, 0, 52 * bp, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;
        }

        // ── Flying math formula shards ────────────────────────
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        for (const sh of this._shards) {
            const sx = Math.cos(sh.angle) * sh.dist;
            const sy = Math.sin(sh.angle) * sh.dist;
            const shAlpha = Math.max(0, alpha * (1 - sh.dist / (this.maxRadius * 1.1)));
            if (shAlpha <= 0.02) continue;
            CTX.save();
            CTX.globalAlpha = shAlpha * 0.90;
            CTX.translate(sx, sy);
            CTX.rotate(sh.rot);
            CTX.font = `bold ${12 + (1 - prog) * 8}px "Courier New",monospace`;
            CTX.fillStyle = '#fef9c3'; CTX.shadowBlur = 8; CTX.shadowColor = '#fbbf24';
            CTX.fillText(sh.formula, 0, 0);
            CTX.shadowBlur = 0;
            CTX.restore();
        }

        CTX.restore();
    }
}

window.EquationSlam = EquationSlam;
