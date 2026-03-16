'use strict';

/**
 * js/entities/boss/GoldfishMinion.js
 * 🐟 GOLDFISH MINION — Kamikaze sine-wave chaser (Phase 3)
 */
class GoldfishMinion extends Entity {
    constructor(x, y) {
        const cfg = BALANCE.boss.goldfishMinion;
        super(x, y, cfg.radius);
        this.maxHp = cfg.hp;
        this.hp = cfg.hp;
        this.moveSpeed = cfg.speed;
        this.damage = cfg.damage;
        this.wobbleAmp = cfg.wobbleAmp;
        this.wobbleFreq = cfg.wobbleFreq;
        this.lifeTimer = 0;
        this._perpX = 0;
        this._perpY = 0;
        this.name = '🐟';
    }

    update(dt, player) {
        if (this.dead) return;

        this.lifeTimer += dt;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d > 0) {
            this.angle = Math.atan2(dy, dx);
            this._perpX = -dy / d;
            this._perpY = dx / d;

            const wobble = Math.sin(this.lifeTimer * this.wobbleFreq) * this.wobbleAmp;
            this.vx = (dx / d) * this.moveSpeed + this._perpX * wobble;
            this.vy = (dy / d) * this.moveSpeed + this._perpY * wobble;
        }
        this.applyPhysics(dt);

        // Kamikaze explosion on player contact
        if (d < this.radius + player.radius) {
            player.takeDamage(this.damage);
            spawnParticles(this.x, this.y, 18, BALANCE.boss.goldfishMinion.color);
            spawnFloatingText('🐟 SPLASH!', this.x, this.y - 35, '#fb923c', 22);
            addScreenShake(6);
            this.dead = true;
        }

        if (this.hp <= 0 && !this.dead) {
            this.dead = true;
            spawnParticles(this.x, this.y, 12, BALANCE.boss.goldfishMinion.color);
            addScore(50);
        }
    }

    takeDamage(amt) {
        if (this.dead) return;  // BUG B3 FIX: guard against double-death (contact + projectile same frame)
        this.hp -= amt;
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const now = performance.now();
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        if (isFacingLeft) CTX.scale(-1, 1);

        const breathe = Math.sin(now / 140);
        CTX.scale(1 + breathe * 0.038, 1 - breathe * 0.022);

        const cfg = BALANCE.boss.goldfishMinion;
        const r = cfg.radius;

        // ── Bubble trail (behind body, drawn first) ───────────
        CTX.save();
        for (let b = 0; b < 3; b++) {
            const bPhase = (now / 750 + b * 0.33) % 1;
            const bx = -r * (0.95 + bPhase * 1.85);
            const by = r * 0.08 + Math.sin(now / 200 + b * 1.5) * r * 0.38;
            CTX.globalAlpha = (1 - bPhase) * 0.52;
            CTX.strokeStyle = 'rgba(125,211,252,0.9)';
            CTX.lineWidth = 1.2;
            CTX.beginPath(); CTX.arc(bx, by, r * 0.10 + bPhase * r * 0.07, 0, Math.PI * 2); CTX.stroke();
        }
        CTX.globalAlpha = 1;
        CTX.restore();

        // ── Flowing double veil-tail (veiltail goldfish) ──────
        const tailWag = Math.sin(now / 95) * 0.52;
        // Upper lobe
        CTX.fillStyle = 'rgba(220,60,10,0.78)';
        CTX.shadowBlur = 7; CTX.shadowColor = '#f97316';
        CTX.beginPath();
        CTX.moveTo(-r * 0.82, 0);
        CTX.bezierCurveTo(
            -r * 1.28, -r * 0.52 + tailWag * r * 0.38,
            -r * 2.00, -r * 1.05 + tailWag * r * 0.28,
            -r * 2.28, -r * 0.85 + tailWag * r * 0.32);
        CTX.bezierCurveTo(-r * 1.78, -r * 0.40, -r * 1.18, -r * 0.16, -r * 0.82, 0);
        CTX.closePath(); CTX.fill();
        // Lower lobe
        CTX.beginPath();
        CTX.moveTo(-r * 0.82, 0);
        CTX.bezierCurveTo(
            -r * 1.28, r * 0.52 - tailWag * r * 0.38,
            -r * 2.00, r * 1.05 - tailWag * r * 0.28,
            -r * 2.28, r * 0.85 - tailWag * r * 0.32);
        CTX.bezierCurveTo(-r * 1.78, r * 0.40, -r * 1.18, r * 0.16, -r * 0.82, 0);
        CTX.closePath(); CTX.fill();
        // Tail vein rays
        CTX.strokeStyle = '#9a3412'; CTX.lineWidth = 1.1;
        CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.moveTo(-r * 0.82, 0); CTX.lineTo(-r * 2.28, -r * 0.85 + tailWag * r * 0.32); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-r * 0.82, 0); CTX.lineTo(-r * 1.60, -r * 0.70 + tailWag * r * 0.20); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-r * 0.82, 0); CTX.lineTo(-r * 2.28, r * 0.85 - tailWag * r * 0.32); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-r * 0.82, 0); CTX.lineTo(-r * 1.60, r * 0.70 - tailWag * r * 0.20); CTX.stroke();

        // ── Spiky dorsal fin (multi-spike, dangerous) ─────────
        const dorsalWave = Math.sin(now / 125) * 0.22;
        CTX.fillStyle = 'rgba(220,38,38,0.82)';
        CTX.strokeStyle = '#7f1d1d'; CTX.lineWidth = 1.4;
        CTX.shadowBlur = 8; CTX.shadowColor = '#ef4444';
        CTX.beginPath();
        CTX.moveTo(-r * 0.30, -r * 0.80);
        CTX.lineTo(-r * 0.12, -r * 1.72 + dorsalWave * r * 0.16);  // spike 1
        CTX.lineTo(r * 0.08, -r * 1.42);
        CTX.lineTo(r * 0.26, -r * 1.88 + dorsalWave * r * 0.12);  // spike 2
        CTX.lineTo(r * 0.48, -r * 1.56);
        CTX.lineTo(r * 0.66, -r * 1.82 + dorsalWave * r * 0.10);  // spike 3
        CTX.lineTo(r * 0.78, -r * 0.82);
        CTX.closePath(); CTX.fill(); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Pectoral fins ─────────────────────────────────────
        CTX.fillStyle = 'rgba(234,88,12,0.70)';
        CTX.beginPath();
        CTX.moveTo(r * 0.05, -r * 0.44);
        CTX.quadraticCurveTo(r * 0.58, -r * 0.92, r * 0.64, -r * 0.44);
        CTX.quadraticCurveTo(r * 0.32, -r * 0.26, r * 0.05, -r * 0.44);
        CTX.closePath(); CTX.fill();
        CTX.beginPath();
        CTX.moveTo(r * 0.05, r * 0.44);
        CTX.quadraticCurveTo(r * 0.58, r * 0.92, r * 0.64, r * 0.44);
        CTX.quadraticCurveTo(r * 0.32, r * 0.26, r * 0.05, r * 0.44);
        CTX.closePath(); CTX.fill();

        // ── Main body — vivid orange-gold gradient ────────────
        const bodyG = CTX.createRadialGradient(-r * 0.18, -r * 0.22, 0, r * 0.05, 0, r);
        bodyG.addColorStop(0, '#ffb04a');
        bodyG.addColorStop(0.42, '#f97316');
        bodyG.addColorStop(0.78, '#ea580c');
        bodyG.addColorStop(1, '#c2410c');
        CTX.fillStyle = bodyG;
        CTX.shadowBlur = 14; CTX.shadowColor = '#f97316';
        CTX.beginPath(); CTX.ellipse(0, 0, r, r * 0.80, 0, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#9a3412'; CTX.lineWidth = 2.5; CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.ellipse(0, 0, r, r * 0.80, 0, 0, Math.PI * 2); CTX.stroke();

        // ── Golden belly shimmer ──────────────────────────────
        CTX.fillStyle = 'rgba(255,220,110,0.36)';
        CTX.beginPath(); CTX.ellipse(r * 0.12, r * 0.20, r * 0.42, r * 0.24, 0, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.32)';
        CTX.beginPath(); CTX.arc(-r * 0.24, -r * 0.26, r * 0.20, 0, Math.PI * 2); CTX.fill();

        // ── Overlapping scale arcs ────────────────────────────
        CTX.strokeStyle = 'rgba(154,52,18,0.42)'; CTX.lineWidth = 1.0;
        const scaleRows = [
            { y: -r * 0.18, xs: [-r * 0.44, -r * 0.18, r * 0.08, r * 0.34] },
            { y: r * 0.08, xs: [-r * 0.56, -r * 0.30, r * 0.00, r * 0.26] },
            { y: r * 0.32, xs: [-r * 0.44, -r * 0.18, r * 0.08] },
        ];
        for (const row of scaleRows) {
            for (const sx of row.xs) {
                CTX.beginPath(); CTX.arc(sx, row.y, r * 0.27, Math.PI, Math.PI * 2); CTX.stroke();
            }
        }

        // ── Demonic eye — red iris + slit pupil ──────────────
        const eyeGlow = 0.82 + Math.sin(now / 165) * 0.18;
        // Sclera
        CTX.fillStyle = '#fee2e2';
        CTX.beginPath(); CTX.ellipse(r * 0.52, -r * 0.24, r * 0.20, r * 0.16, -0.15, 0, Math.PI * 2); CTX.fill();
        // Red iris
        CTX.fillStyle = `rgba(220,38,38,${eyeGlow})`;
        CTX.shadowBlur = 13 * eyeGlow; CTX.shadowColor = '#ef4444';
        CTX.beginPath(); CTX.ellipse(r * 0.53, -r * 0.24, r * 0.13, r * 0.13, 0, 0, Math.PI * 2); CTX.fill();
        // Slit pupil
        CTX.fillStyle = '#0f0500'; CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.ellipse(r * 0.54, -r * 0.24, r * 0.04, r * 0.13, 0, 0, Math.PI * 2); CTX.fill();
        // Eye shine
        CTX.fillStyle = 'rgba(255,255,255,0.88)';
        CTX.beginPath(); CTX.arc(r * 0.46, -r * 0.29, r * 0.04, 0, Math.PI * 2); CTX.fill();

        // ── Angry brow ────────────────────────────────────────
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.8; CTX.lineCap = 'round';
        CTX.beginPath();
        CTX.moveTo(r * 0.38, -r * 0.44);
        CTX.lineTo(r * 0.76, -r * 0.32);
        CTX.stroke();

        // ── Mouth with small fang ─────────────────────────────
        CTX.strokeStyle = '#7f1d1d'; CTX.lineWidth = 1.6; CTX.lineCap = 'round';
        CTX.beginPath(); CTX.arc(r * 0.80, r * 0.05, r * 0.14, 0.2, Math.PI - 0.2); CTX.stroke();
        CTX.fillStyle = '#fef2f2';
        CTX.beginPath();
        CTX.moveTo(r * 0.70, r * 0.10); CTX.lineTo(r * 0.68, r * 0.22); CTX.lineTo(r * 0.76, r * 0.10);
        CTX.closePath(); CTX.fill();

        CTX.restore();
    }
}

window.GoldfishMinion = GoldfishMinion;
