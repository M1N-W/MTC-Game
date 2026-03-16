'use strict';

/**
 * js/entities/boss/BubbleProjectile.js
 * 🫧 BUBBLE PROJECTILE — Slow + damage AoE (Phase 3)
 */
class BubbleProjectile {
    constructor(x, y, angle) {
        const cfg = BALANCE.boss.bubbleProjectile;
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * cfg.speed;
        this.vy = Math.sin(angle) * cfg.speed;
        this.radius = cfg.radius;
        this.damage = cfg.damage;
        this.angle = angle;
        this.dead = false;
        this.lifeTimer = 0;
        this.maxLife = 6;
    }

    update(dt, player) {
        if (this.dead) return true;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.lifeTimer += dt;

        const worldBounds = GAME_CONFIG.physics.worldBounds;
        if (Math.abs(this.x) > worldBounds * 1.5 || Math.abs(this.y) > worldBounds * 1.5) {
            this.dead = true;
            return true;
        }

        if (this.lifeTimer >= this.maxLife) {
            this._pop();
            return true;
        }

        const d = Math.hypot(player.x - this.x, player.y - this.y);
        if (d < this.radius + player.radius) {
            player.takeDamage(this.damage);
            const P3 = BALANCE.boss.phase3;
            if (!player._bubbleSlowApplied) {
                player._bubbleSlowApplied = true;
                player._baseMoveSpeedBubble = player.stats.moveSpeed;
                player.stats.moveSpeed *= P3.slowFactor;
                setTimeout(() => {
                    if (player._bubbleSlowApplied) {
                        player._bubbleSlowApplied = false;
                        player.stats.moveSpeed = player._baseMoveSpeedBubble ?? player.stats.moveSpeed;
                    }
                }, (P3.slowDuration ?? 2.0) * 1000);
            }
            spawnFloatingText('🫧 SLOWED!', player.x, player.y - 50, '#38bdf8', 22);
            addScreenShake(8);
            this._pop();
            return true;
        }

        return false;
    }

    _pop() {
        this.dead = true;
        spawnParticles(this.x, this.y, 10, '#bae6fd');
        spawnFloatingText('POP!', this.x, this.y - 20, '#7dd3fc', 18);
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const r = this.radius;
        const now = performance.now();
        const pulse = 1 + Math.sin(this.lifeTimer * 5.2) * 0.09;
        const spinAngle = this.lifeTimer * 1.8;
        const urgency = Math.min(1, this.lifeTimer / this.maxLife);  // 0→1 as it ages

        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ── Outer toxic glow halo ─────────────────────────────
        const haloG = CTX.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.5);
        haloG.addColorStop(0, `rgba(56,189,248,${0.12 + urgency * 0.10})`);
        haloG.addColorStop(0.6, `rgba(34,211,238,${0.06 + urgency * 0.06})`);
        haloG.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.fillStyle = haloG;
        CTX.beginPath(); CTX.arc(0, 0, r * 1.5, 0, Math.PI * 2); CTX.fill();

        // ── Main bubble body ──────────────────────────────────
        CTX.shadowBlur = 20 + urgency * 12; CTX.shadowColor = urgency > 0.6 ? '#22d3ee' : '#38bdf8';
        const bubG = CTX.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r);
        bubG.addColorStop(0, `rgba(186,230,253,${0.55 + urgency * 0.20})`);
        bubG.addColorStop(0.45, `rgba(56,189,248,${0.25 + urgency * 0.15})`);
        bubG.addColorStop(1, `rgba(8,145,178,${0.40 + urgency * 0.20})`);
        CTX.fillStyle = bubG;
        CTX.beginPath(); CTX.arc(0, 0, r * pulse, 0, Math.PI * 2); CTX.fill();

        // Outer shell ring
        CTX.strokeStyle = `rgba(125,211,252,${0.75 + urgency * 0.20})`; CTX.lineWidth = 2.2 + urgency;
        CTX.beginPath(); CTX.arc(0, 0, r * pulse, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Spinning orbit segments (prison bars feel) ────────
        CTX.save();
        CTX.rotate(spinAngle);
        for (let seg = 0; seg < 6; seg++) {
            const sa = (seg / 6) * Math.PI * 2;
            const sAlpha = (0.18 + urgency * 0.20) * (0.6 + Math.sin(now / 300 + seg) * 0.4);
            CTX.strokeStyle = `rgba(34,211,238,${sAlpha})`;
            CTX.lineWidth = 1.2;
            CTX.beginPath();
            CTX.arc(0, 0, r * 0.80, sa, sa + Math.PI / 4);
            CTX.stroke();
        }
        CTX.restore();

        // ── Tox swirl inside ─────────────────────────────────
        CTX.save();
        CTX.rotate(-spinAngle * 0.55);
        CTX.globalAlpha = 0.20 + urgency * 0.18;
        CTX.strokeStyle = '#7dd3fc'; CTX.lineWidth = 1.0;
        CTX.beginPath();
        for (let sx = 0; sx < Math.PI * 2; sx += 0.25) {
            const sr = r * 0.45 * (1 + Math.sin(sx * 3) * 0.28);
            if (sx === 0) CTX.moveTo(Math.cos(sx) * sr, Math.sin(sx) * sr);
            else CTX.lineTo(Math.cos(sx) * sr, Math.sin(sx) * sr);
        }
        CTX.closePath(); CTX.stroke();
        CTX.restore();

        // ── Highlights ────────────────────────────────────────
        CTX.fillStyle = `rgba(255,255,255,${0.62 + Math.sin(now / 280) * 0.20})`;
        CTX.beginPath(); CTX.ellipse(-r * 0.28, -r * 0.30, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.45)';
        CTX.beginPath(); CTX.arc(-r * 0.10, r * 0.35, r * 0.07, 0, Math.PI * 2); CTX.fill();

        // ── Urgency warning flash when old ────────────────────
        if (urgency > 0.72) {
            const warnPulse = 0.5 + Math.sin(now / 90) * 0.5;
            CTX.strokeStyle = `rgba(34,211,238,${warnPulse * 0.65})`;
            CTX.lineWidth = 3; CTX.shadowBlur = 12; CTX.shadowColor = '#22d3ee';
            CTX.beginPath(); CTX.arc(0, 0, r * 1.18, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;
        }

        CTX.restore();
    }
}

window.BubbleProjectile = BubbleProjectile;
