'use strict';
/**
 * js/entities/boss_attacks.js
 *
 * All projectiles, effects, and minions spawned BY bosses.
 * Boss entity classes (KruManop, KruFirst, BossDog) live in boss.js.
 *
 * Load order: must be loaded BEFORE boss.js
 *
 * ── Contents ────────────────────────────────────────────────
 *   BarkWave           — Sonic cone from KruManop bark (Phase 2)
 *   GoldfishMinion     — Kamikaze sine-wave chaser (Phase 3)
 *   BubbleProjectile   — Slow AoE projectile (Phase 3)
 *   FreeFallWarningRing — Visual AoE warning indicator (KruFirst)
 */
// ════════════════════════════════════════════════════════════
// 🌊 BARK WAVE — Sonic cone emitted by KruManop's bark attack
// ════════════════════════════════════════════════════════════
class BarkWave {
    constructor(x, y, angle, coneHalf, range) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.coneHalf = coneHalf;
        this.range = range;
        this.timer = 0;
        this.duration = 0.55;
        this.rings = 5;
    }

    update(dt) {
        this.timer += dt;
        return this.timer >= this.duration;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const progress = this.timer / this.duration;
        const alpha = 1 - progress;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        for (let i = 0; i < this.rings; i++) {
            const frac = (progress + i / this.rings) % 1;
            const r = frac * this.range;
            if (r < 4) continue;
            const ringAlpha = alpha * (1 - i / this.rings) * 0.75;
            if (ringAlpha <= 0) continue;
            CTX.save();
            CTX.globalAlpha = ringAlpha;
            CTX.strokeStyle = i % 2 === 0 ? '#f59e0b' : '#fbbf24';
            CTX.lineWidth = Math.max(1, 3.5 - i * 0.5);
            CTX.shadowBlur = 12;
            CTX.shadowColor = '#d97706';
            CTX.lineCap = 'round';
            CTX.beginPath(); CTX.arc(0, 0, r, -this.coneHalf, this.coneHalf); CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(Math.cos(-this.coneHalf) * Math.max(0, r - 25), Math.sin(-this.coneHalf) * Math.max(0, r - 25));
            CTX.lineTo(Math.cos(-this.coneHalf) * r, Math.sin(-this.coneHalf) * r);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(Math.cos(this.coneHalf) * Math.max(0, r - 25), Math.sin(this.coneHalf) * Math.max(0, r - 25));
            CTX.lineTo(Math.cos(this.coneHalf) * r, Math.sin(this.coneHalf) * r);
            CTX.stroke();
            CTX.restore();
        }

        if (progress < 0.25) {
            const flashAlpha = (1 - progress / 0.25) * 0.8;
            CTX.globalAlpha = flashAlpha;
            CTX.fillStyle = '#fbbf24';
            CTX.shadowBlur = 20;
            CTX.shadowColor = '#f59e0b';
            CTX.beginPath(); CTX.arc(0, 0, 14 * (1 - progress / 0.25), 0, Math.PI * 2); CTX.fill();
        }
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🐟 GOLDFISH MINION — Kamikaze sine-wave chaser (Phase 3)
// ════════════════════════════════════════════════════════════
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
        this.hp -= amt;
        spawnParticles(this.x, this.y, 3, BALANCE.boss.goldfishMinion.color);
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

// ════════════════════════════════════════════════════════════
// 🫧 BUBBLE PROJECTILE — Slow + damage AoE (Phase 3)
// ════════════════════════════════════════════════════════════
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
            player._bubbleSlowTimer = P3.slowDuration;
            if (!player._bubbleSlowApplied) {
                player._bubbleSlowApplied = true;
                player._baseMoveSpeedBubble = player.moveSpeed;
                player.moveSpeed = player.moveSpeed * P3.slowFactor;
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
        const pulse = Math.sin(this.lifeTimer * 4) * 0.08 + 1;

        CTX.save();
        CTX.translate(screen.x, screen.y);

        CTX.shadowBlur = 18;
        CTX.shadowColor = '#38bdf8';
        CTX.fillStyle = 'rgba(186, 230, 253, 0.35)';
        CTX.beginPath(); CTX.arc(0, 0, r * pulse, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = 'rgba(125, 211, 252, 0.8)'; CTX.lineWidth = 2; CTX.stroke();

        CTX.shadowBlur = 0;
        CTX.fillStyle = 'rgba(255, 255, 255, 0.7)';
        CTX.beginPath(); CTX.ellipse(-r * 0.3, -r * 0.3, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.5)';
        CTX.beginPath(); CTX.arc(-r * 0.1, r * 0.35, r * 0.07, 0, Math.PI * 2); CTX.fill();

        CTX.restore();
    }
}


// ════════════════════════════════════════════════════════════
// ⚠️  FREE FALL WARNING RING — AoE visual indicator (BossFirst)
// ════════════════════════════════════════════════════════════
class FreeFallWarningRing {
    constructor(x, y, duration) {
        this.x = x;
        this.y = y;
        this.duration = duration;
        this.timer = 0;
        this.dead = false;
        this.radius = 140;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration) { this.dead = true; return true; }
        return false;
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const prog = this.timer / this.duration;
        const pulse = 0.5 + Math.sin(this.timer * 12) * 0.45;
        const alpha = (1 - prog * 0.4) * pulse;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.shadowBlur = 20 * pulse;
        CTX.shadowColor = '#ef4444';
        CTX.strokeStyle = `rgba(239,68,68,${alpha})`;
        CTX.lineWidth = 3;
        CTX.setLineDash([12, 8]);
        CTX.beginPath(); CTX.arc(0, 0, this.radius * (0.85 + prog * 0.15), 0, Math.PI * 2); CTX.stroke();
        CTX.setLineDash([]);
        CTX.shadowBlur = 0;
        CTX.font = 'bold 22px Arial';
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.globalAlpha = alpha;
        CTX.fillText('⚠️', 0, 0);
        CTX.globalAlpha = 1;
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🥪  PORK SANDWICH — BossFirst SANDWICH_TOSS projectile
// ════════════════════════════════════════════════════════════
class PorkSandwich {
    constructor(x, y, angle, boss) {
        this.x = x;
        this.y = y;
        this.boss = boss;
        this.dead = false;
        this.radius = 22;

        const speed = 500;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Visual spin
        this.rotation = 0;
        this.spinSpeed = 9; // rad/s

        // Weak homing — steers toward player for first 0.5 s
        this.homingTimer = 0;
        this.homingDuration = 0.5;
        this.homingStrength = 4.0; // rad/s max angular correction

        // Lifetime & damage
        this.lifeTimer = 0;
        this.maxLife = 3.5;
        this.damage = 160;
        this.hitCd = 0; // i-frame cooldown after hit

        // Motion trail: [{x, y, age}]
        this._trail = [];
    }

    update(dt, player) {
        if (this.dead) return true;

        this.lifeTimer += dt;
        this.rotation += this.spinSpeed * dt;
        if (this.hitCd > 0) this.hitCd -= dt;

        // ── Weak homing ───────────────────────────────────────
        if (this.homingTimer < this.homingDuration) {
            this.homingTimer += dt;
            const desired = Math.atan2(player.y - this.y, player.x - this.x);
            const current = Math.atan2(this.vy, this.vx);
            let diff = desired - current;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const correction = Math.sign(diff) * Math.min(Math.abs(diff), this.homingStrength * dt);
            const newAngle = current + correction;
            const spd = Math.hypot(this.vx, this.vy);
            this.vx = Math.cos(newAngle) * spd;
            this.vy = Math.sin(newAngle) * spd;
        }

        // ── Move ──────────────────────────────────────────────
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // ── Trail ─────────────────────────────────────────────
        this._trail.push({ x: this.x, y: this.y, age: 0 });
        for (const p of this._trail) p.age += dt;
        while (this._trail.length && this._trail[0].age > 0.2) this._trail.shift();

        // ── Parry — player projectile intercepts sandwich ──────
        // Scans all live player-team projectiles each frame.
        // First overlap deflects the sandwich back toward the boss
        // at +25 % speed, consumes the projectile, and unlocks the achievement.
        if (!this._parried && typeof projectileManager !== 'undefined' && projectileManager) {
            const allProjs = projectileManager.getAll
                ? projectileManager.getAll()
                : (projectileManager.list || []);

            for (const proj of allProjs) {
                if (!proj || proj.dead || proj.team !== 'player') continue;
                const pdx = proj.x - this.x;
                const pdy = proj.y - this.y;
                if (Math.hypot(pdx, pdy) < this.radius + (proj.radius ?? 8)) {
                    // ── Confirmed parry ───────────────────────
                    this._parried = true;

                    // Consume the intercepting projectile
                    proj.dead = true;

                    // Redirect toward boss (+25 % speed), or straight-back fallback
                    if (this.boss && !this.boss.dead) {
                        const toBossAngle = Math.atan2(
                            this.boss.y - this.y,
                            this.boss.x - this.x
                        );
                        const spd = Math.hypot(this.vx, this.vy) * 1.25;
                        this.vx = Math.cos(toBossAngle) * spd;
                        this.vy = Math.sin(toBossAngle) * spd;
                    } else {
                        this.vx *= -1;
                        this.vy *= -1;
                    }

                    // Cancel homing so it flies straight at the boss
                    this.homingTimer = this.homingDuration;

                    // Visual + audio feedback
                    spawnParticles(this.x, this.y, 14, '#facc15');
                    spawnFloatingText('🥪 PARRIED!', this.x, this.y - 55, '#facc15', 26);
                    addScreenShake(8);

                    // ── Achievement ───────────────────────────
                    // FIX: Was calling check() directly without incrementing the stat,
                    //      so parry_master could never satisfy `parries >= 1`.
                    if (typeof Achievements !== 'undefined') {
                        Achievements.stats.parries++;
                        Achievements.check('parry_master');
                    }
                    break;
                }
            }
        }

        // ── Parried sandwich hits boss (return damage ×2) ─────
        if (this._parried && this.boss && !this.boss.dead) {
            const bd = Math.hypot(this.boss.x - this.x, this.boss.y - this.y);
            if (bd < this.radius + this.boss.radius) {
                this.boss.takeDamage(this.damage * 2);
                spawnParticles(this.boss.x, this.boss.y, 20, '#facc15');
                spawnFloatingText('🥪 RETURN TO SENDER!', this.boss.x, this.boss.y - 70, '#facc15', 28);
                addScreenShake(12);
                this.dead = true;
                return true;
            }
        }

        // ── Player collision (un-parried only) ────────────────
        if (!this._parried && this.hitCd <= 0) {
            const d = Math.hypot(player.x - this.x, player.y - this.y);
            if (d < this.radius + player.radius) {
                player.takeDamage(this.damage);
                this.hitCd = 0.8;
                addScreenShake(7);
                spawnParticles(this.x, this.y, 12, '#f59e0b');
                spawnFloatingText('🥪 BONK!', this.x, this.y - 45, '#f97316', 22);
                this.dead = true;
                return true;
            }
        }

        // ── Out-of-bounds / expired ────────────────────────────
        const wb = GAME_CONFIG.physics.worldBounds;
        if (this.lifeTimer >= this.maxLife ||
            Math.abs(this.x) > wb * 1.5 || Math.abs(this.y) > wb * 1.5) {
            this.dead = true;
            return true;
        }

        return false;
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);

        // ── Motion trail ──────────────────────────────────────
        for (const p of this._trail) {
            const s = worldToScreen(p.x, p.y);
            const fac = 1 - p.age / 0.2;
            CTX.beginPath();
            CTX.arc(s.x, s.y, this.radius * 0.4 * fac, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(249,115,22,${0.3 * fac})`;
            CTX.fill();
        }

        // ── Sandwich body ─────────────────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.rotation);

        const r = this.radius;

        // Bottom bun
        CTX.fillStyle = '#d97706';
        CTX.beginPath(); CTX.ellipse(0, r * 0.32, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); CTX.fill();

        // Lettuce
        CTX.fillStyle = '#4ade80';
        CTX.beginPath(); CTX.ellipse(0, r * 0.06, r * 0.82, r * 0.20, 0, 0, Math.PI * 2); CTX.fill();

        // Pork
        CTX.fillStyle = '#fb923c';
        CTX.beginPath(); CTX.ellipse(0, -r * 0.06, r * 0.78, r * 0.17, 0, 0, Math.PI * 2); CTX.fill();

        // Top bun (dome)
        CTX.fillStyle = '#f59e0b';
        CTX.beginPath(); CTX.ellipse(0, -r * 0.28, r * 0.85, r * 0.40, 0, 0, Math.PI); CTX.fill();

        // Sesame seeds
        CTX.fillStyle = '#fef3c7';
        for (let i = -1; i <= 1; i++) {
            CTX.beginPath(); CTX.ellipse(i * r * 0.28, -r * 0.50, 3, 2, i * 0.4, 0, Math.PI * 2); CTX.fill();
        }

        // Glow
        CTX.shadowBlur = 14;
        CTX.shadowColor = '#f59e0b';
        CTX.strokeStyle = 'rgba(251,191,36,0.7)';
        CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.ellipse(0, -r * 0.28, r * 0.85, r * 0.40, 0, 0, Math.PI); CTX.stroke();
        CTX.shadowBlur = 0;

        CTX.restore();
    }
}

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
        const r = this.maxRadius * Math.sqrt(prog); // ease out
        const alpha = 1 - prog;
        CTX.save();
        CTX.globalAlpha = alpha;
        CTX.strokeStyle = this.color;
        CTX.lineWidth = 6 * (1 - prog);
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.stroke();
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🟥 MATRIX GRID — Area-denial zone attack (Boss Phase 2+)
// ════════════════════════════════════════════════════════════
class MatrixGridAttack {
    /**
     * @param {number} cx       World-space centre X (snapped to player position)
     * @param {number} cy       World-space centre Y
     * @param {number} cols
     * @param {number} rows
     * @param {number} cellSize px per cell (world units)
     * @param {number} warnDur  seconds before detonation
     * @param {number} damage
     * @param {number} safeIndex index of the safe cell (0-based, row-major)
     */
    constructor(cx, cy, cols, rows, cellSize, warnDur, damage, safeIndex) {
        this.cx = cx; this.cy = cy;
        this.cols = cols; this.rows = rows;
        this.cellSize = cellSize;
        this.warnDur = warnDur;
        this.damage = damage;
        this.safeIndex = safeIndex;

        this.timer = 0;
        this.dead = false;
        this._detonated = false;

        // Pre-compute cell world-centres once — no GC churn in update()
        this._cells = [];
        const totalW = cols * cellSize;
        const totalH = rows * cellSize;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                this._cells.push({
                    wx: cx - totalW / 2 + c * cellSize + cellSize / 2,
                    wy: cy - totalH / 2 + r * cellSize + cellSize / 2
                });
            }
        }
    }

    update(dt, player) {
        if (this.dead) return true;
        this.timer += dt;

        // Detonate once at end of warn window
        if (!this._detonated && this.timer >= this.warnDur) {
            this._detonated = true;
            const half = this.cellSize / 2;
            for (let i = 0; i < this._cells.length; i++) {
                if (i === this.safeIndex) continue;
                const cell = this._cells[i];
                if (Math.abs(player.x - cell.wx) < half && Math.abs(player.y - cell.wy) < half) {
                    player.takeDamage(this.damage);
                    addScreenShake(16);
                    spawnParticles(player.x, player.y, 20, '#ef4444');
                    spawnFloatingText('WRONG CELL!', player.x, player.y - 60, '#ef4444', 28);
                }
                spawnParticles(cell.wx, cell.wy, 10, '#ef4444');
                if (typeof ExpandingRing !== 'undefined') {
                    window.specialEffects.push(new ExpandingRing(cell.wx, cell.wy, '#ef4444', this.cellSize * 0.6, 0.4));
                }
            }
        }

        // Linger briefly so detonation flash is visible
        if (this._detonated && this.timer >= this.warnDur + 0.5) {
            this.dead = true;
        }
        return this.dead;
    }

    draw() {
        if (this.dead) return;
        if (typeof CTX === 'undefined' || typeof worldToScreen === 'undefined') return;

        const prog = Math.min(this.timer / this.warnDur, 1);
        const flashRate = 0.5 + prog * 2.5; // blink faster as detonation nears
        const blinkOn = !this._detonated && Math.sin(this.timer * Math.PI * 2 * flashRate) > 0;
        const baseAlpha = this._detonated ? 0 : (0.55 + prog * 0.30);

        for (let i = 0; i < this._cells.length; i++) {
            const cell = this._cells[i];
            const screen = worldToScreen(cell.wx, cell.wy);
            const half = this.cellSize / 2;
            const isSafe = (i === this.safeIndex);

            CTX.save();
            CTX.globalAlpha = baseAlpha;

            if (isSafe) {
                CTX.fillStyle = 'rgba(34,197,94,0.30)';
                CTX.strokeStyle = '#22c55e';
                CTX.shadowBlur = 12; CTX.shadowColor = '#22c55e';
            } else if (blinkOn) {
                CTX.fillStyle = 'rgba(239,68,68,0.35)';
                CTX.strokeStyle = '#ef4444';
                CTX.shadowBlur = 10; CTX.shadowColor = '#ef4444';
            } else {
                CTX.fillStyle = 'rgba(239,68,68,0.15)';
                CTX.strokeStyle = 'rgba(239,68,68,0.5)';
                CTX.shadowBlur = 0;
            }

            CTX.lineWidth = 2.5;
            CTX.fillRect(screen.x - half, screen.y - half, this.cellSize, this.cellSize);
            CTX.strokeRect(screen.x - half, screen.y - half, this.cellSize, this.cellSize);

            if (isSafe) {
                CTX.font = 'bold 14px "Orbitron", Arial, sans-serif';
                CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
                CTX.fillStyle = '#22c55e';
                CTX.shadowBlur = 8; CTX.shadowColor = '#22c55e';
                CTX.fillText('SAFE', screen.x, screen.y);
            }

            CTX.shadowBlur = 0;
            CTX.restore();
        }
    }
}

// ════════════════════════════════════════════════════════════
// ⚡ EMP PULSE — Expanding ring; applies Grounded status on hit
// ════════════════════════════════════════════════════════════
class EmpPulse {
    /**
     * @param {number} x           World-space origin X
     * @param {number} y           World-space origin Y
     * @param {number} maxR        Max radius (world units)
     * @param {number} duration    Seconds to expand fully
     * @param {number} damage      Damage on hit
     * @param {number} groundedDur Seconds player Dash is locked
     */
    constructor(x, y, maxR, duration, damage, groundedDur) {
        this.x = x; this.y = y;
        this.maxR = maxR;
        this.duration = duration;
        this.damage = damage;
        this.groundedDur = groundedDur;
        this.timer = 0;
        this.dead = false;
        this._hit = false; // hit player only once per pulse
    }

    update(dt, player) {
        if (this.dead) return true;
        this.timer += dt;

        if (!this._hit) {
            const r = this.maxR * (this.timer / this.duration);
            const d = Math.hypot(player.x - this.x, player.y - this.y);
            // Ring hits player when the expanding radius crosses their position
            if (d <= r + player.radius && d >= r - 35) {
                this._hit = true;
                player.takeDamage(this.damage);
                if (typeof player.applyGrounded === 'function') {
                    player.applyGrounded(this.groundedDur);
                }
                spawnFloatingText('⚡ GROUNDED!', player.x, player.y - 60, '#38bdf8', 28);
                addScreenShake(10);
                spawnParticles(player.x, player.y, 18, '#38bdf8');
            }
        }

        if (this.timer >= this.duration) this.dead = true;
        return this.dead;
    }

    draw() {
        if (this.dead) return;
        if (typeof CTX === 'undefined' || typeof worldToScreen === 'undefined') return;

        const prog = this.timer / this.duration;
        const r = this.maxR * prog;
        const screen = worldToScreen(this.x, this.y);
        const alpha = (1 - prog) * 0.9;

        CTX.save();

        // Outer glow ring
        CTX.globalAlpha = alpha;
        CTX.strokeStyle = '#38bdf8';
        CTX.shadowBlur = 18; CTX.shadowColor = '#38bdf8';
        CTX.lineWidth = 7 * (1 - prog * 0.6);
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.stroke();

        // Inner fill dome (fades fast)
        CTX.globalAlpha = alpha * 0.15;
        CTX.fillStyle = '#38bdf8';
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.fill();

        CTX.shadowBlur = 0;
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 💠 DOMAIN EXPANSION: METRICS-MANIPULATION
//    Boss Manop Ultimate — integrated from DomainExpansion.js
//    Singleton; driven by game.js update/draw hooks.
// ════════════════════════════════════════════════════════════

const _DC = Object.freeze({
    COLS: 20, ROWS: 20,           // 20×150 = 3000 = full arena diameter
    CELL_SIZE: 150,
    ARENA_RADIUS: 1500,           // must match MAP_CONFIG.arena.radius
    CAST_DUR: 2.8,
    END_DUR: 1.2,
    WARN_DUR: 2.2,
    WARN_DUR_MIN: 1.1,
    WARN_DUR_DECAY: 0.18,
    EXPLODE_DUR: 0.45,
    TOTAL_CYCLES: 6,
    DANGER_PCT: 0.62,
    DANGER_PCT_MAX: 0.84,
    DANGER_PCT_STEP: 0.04,
    CELL_DAMAGE: 28,
    CELL_SLOW_DUR: 1.8,
    CELL_SLOW_FACTOR: 0.45,
    COOLDOWN: 45.0,
    HIT_RADIUS: 0.58,
    RAIN_COLS: 32,
    BOSS_VOLLEY_CYCLE: 3,
    BOSS_VOLLEY_COUNT: 8,
    LOCK_PUSH: 80,                // pixels/s push force when entity tries to leave domain

    // ── Enhanced Domain visuals / new abilities ──────────────
    VOID_PULSE_CYCLE: 2,          // spawn void-pulse ring every N completed cycles
    VOID_PULSE_SPEED: 400,        // world-space px/s ring expansion
    VOID_PULSE_DAMAGE: 12,        // damage if player caught inside pulse front
    FORMULA_BEAM_CYCLE: 4,        // start sweeping formula beam from this cycle onward
    FORMULA_BEAM_DUR: 1.4,        // seconds beam is active per spawn
    FORMULA_BEAM_DAMAGE: 14,      // damage per hit (0.25s cooldown)
    FORMULA_BEAM_ARC: 0.07,       // half-arc width in radians (~4°)
    DRIFT_COUNT: 52,              // ambient arena particles
});

const _RAIN_POOL = '0123456789ABCDEFΑΒΓΔΩΣΨXYZμσπ∑∫∂∇+-×÷=≠≤≥ΦΘΛ';
function _rainChar() { return _RAIN_POOL[Math.floor(Math.random() * _RAIN_POOL.length)]; }
function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}

const DomainExpansion = {
    phase: 'idle',   // 'idle' | 'casting' | 'active' | 'ending'
    timer: 0, cycleTimer: 0, cyclePhase: 'warn', cycleCount: 0,
    originX: 0, originY: 0,
    cells: [], cooldownTimer: 0,
    _rain: [], _indices: [],
    _flashTimer: 0,     // full-screen purple flash on explosion hit
    _crackLines: [],    // screen crack visual during casting
    // ── New enhanced-domain state ──
    _driftParticles: [],  // ambient arena particles
    _voidPulses: [],      // [ { r, maxR, alpha, wx, wy } ]
    _formulaBeam: null,   // { bossX, bossY, angle, timer, _hitCd }
    _cellShockwaves: [],  // [ { sx, sy, r, maxR, alpha } ]  — screen-space ripples
    _bgAngle: 0,          // slowly-rotating background hex geometry angle
    _portalProgress: 0,   // 0→1 during casting

    canTrigger() { return this.phase === 'idle' && this.cooldownTimer <= 0; },
    isInvincible() { return this.phase !== 'idle'; },

    trigger(boss) {
        if (!this.canTrigger()) return;
        this.phase = 'casting';
        this.timer = _DC.CAST_DUR;
        // Domain covers entire map — anchor to world centre
        this.originX = 0;
        this.originY = 0;
        this._initRain();
        this._initDrift();
        this._voidPulses = [];
        this._formulaBeam = null;
        this._cellShockwaves = [];
        this._bgAngle = 0;
        this._portalProgress = 0;

        boss._domainCasting = true;
        boss._domainActive = true;

        if (typeof addScreenShake === 'function') addScreenShake(14);
        if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
        if (typeof spawnFloatingText === 'function') {
            spawnFloatingText('領域展開', boss.x, boss.y - 130, '#d946ef', 50);
            setTimeout(() => spawnFloatingText('METRICS-MANIPULATION', boss.x, boss.y - 185, '#facc15', 34), 700);
        }
        if (window.UIManager && typeof window.UIManager.showVoiceBubble === 'function') {
            window.UIManager.showVoiceBubble('領域展開...', boss.x, boss.y - 50);
            setTimeout(() => { if (window.UIManager) window.UIManager.showVoiceBubble('Metrics!', boss.x, boss.y - 50); }, 950);
        }
        if (typeof spawnParticles === 'function') {
            spawnParticles(boss.x, boss.y, 35, '#d946ef');
            spawnParticles(boss.x, boss.y, 20, '#facc15');
            spawnParticles(boss.x, boss.y, 15, '#ffffff');
        }
        console.log('[DomainExpansion] 💠 METRICS-MANIPULATION TRIGGERED');
    },

    update(dt, boss, player) {
        if (this.phase === 'idle') { if (this.cooldownTimer > 0) this.cooldownTimer -= dt; return; }
        // Tick flash timer
        if (this._flashTimer > 0) this._flashTimer -= dt;
        // Tick player slow debuff
        if (typeof window !== 'undefined' && window.player && window.player._domainSlowActive) {
            window.player._domainSlowTimer -= dt;
            if (window.player._domainSlowTimer <= 0) {
                window.player._domainSlowActive = false;
                window.player.moveSpeed = window.player._domainSlowBase || window.player.moveSpeed;
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('SPEED RESTORED', window.player.x, window.player.y - 60, '#22c55e', 16);
            }
        }
        // Boundary wall message for player (visual only — physics handled by applyPhysics)
        if (this.phase === 'active' && typeof window !== 'undefined' && window.player && !window.player.dead) {
            const p = window.player;
            const R = _DC.ARENA_RADIUS;
            if (Math.hypot(p.x, p.y) > R - p.radius - 10 && !p._domainWallMsg) {
                p._domainWallMsg = true;
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('⛔ ออกไม่ได้!', p.x, p.y - 50, '#d946ef', 18);
                setTimeout(() => { if (p) p._domainWallMsg = false; }, 1200);
            }
        }
        if (!boss || boss.dead) { this._abort(boss); return; }
        this.timer -= dt;

        switch (this.phase) {
            case 'casting':
                this._portalProgress = Math.max(0, Math.min(1, 1.0 - this.timer / _DC.CAST_DUR));
                if (this.timer <= 0) {
                    this.phase = 'active'; this.cycleCount = 0;
                    this.cyclePhase = 'warn'; this.cycleTimer = _DC.WARN_DUR;
                    this._initCells(); this._rollCells();
                    if (typeof addScreenShake === 'function') addScreenShake(28);
                    if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
                    if (typeof spawnFloatingText === 'function' && player)
                        spawnFloatingText('⚠ DOMAIN ACTIVE', player.x, player.y - 100, '#ef4444', 28);
                }
                break;

            case 'active':
                // ── Ambient drift particles ─────────────────────────
                this._bgAngle += dt * 0.07;
                for (const dp of this._driftParticles) {
                    dp.x += dp.vx * dt; dp.y += dp.vy * dt;
                    const dpD = Math.hypot(dp.x, dp.y);
                    if (dpD > _DC.ARENA_RADIUS * 0.87) {
                        const nx = dp.x / dpD, ny = dp.y / dpD;
                        const dot = dp.vx * nx + dp.vy * ny;
                        if (dot > 0) { dp.vx -= 2 * dot * nx; dp.vy -= 2 * dot * ny; }
                    }
                    dp.phase += dt * 1.8;
                }
                // ── Void pulse rings ───────────────────────────────
                for (let _vi = this._voidPulses.length - 1; _vi >= 0; _vi--) {
                    const _vp = this._voidPulses[_vi];
                    _vp.r += _DC.VOID_PULSE_SPEED * dt;
                    _vp.alpha = Math.max(0, 1.0 - _vp.r / _vp.maxR);
                    if (_vp.alpha <= 0) this._voidPulses.splice(_vi, 1);
                    // Damage player if pulse front crosses them
                    if (player && !player.dead && !_vp._hit) {
                        const pd2 = Math.hypot(player.x - _vp.wx, player.y - _vp.wy);
                        if (pd2 < _vp.r && pd2 > _vp.r - _DC.VOID_PULSE_SPEED * dt * 2) {
                            _vp._hit = true;
                            player.takeDamage(_DC.VOID_PULSE_DAMAGE);
                            if (typeof spawnFloatingText === 'function')
                                spawnFloatingText('🌀 VOID PULSE', player.x, player.y - 65, '#a855f7', 18);
                            if (typeof addScreenShake === 'function') addScreenShake(7);
                        }
                    }
                }
                // ── Formula beam tick ──────────────────────────────
                if (this._formulaBeam) {
                    this._formulaBeam.timer -= dt;
                    if (this._formulaBeam.timer <= 0) {
                        this._formulaBeam = null;
                    } else if (player && !player.dead && boss && !boss.dead) {
                        const _bx = this._formulaBeam.bossX, _by = this._formulaBeam.bossY;
                        const _tgt = Math.atan2(player.y - _by, player.x - _bx);
                        let _da = _tgt - this._formulaBeam.angle;
                        while (_da > Math.PI) _da -= Math.PI * 2;
                        while (_da < -Math.PI) _da += Math.PI * 2;
                        this._formulaBeam.angle += Math.sign(_da) * Math.min(Math.abs(_da), 2.2 * Math.PI * dt);
                        // Hit detection
                        const _toPx = player.x - _bx, _toPy = player.y - _by;
                        const _pDist = Math.hypot(_toPx, _toPy);
                        if (_pDist > 0) {
                            const _bdx = Math.cos(this._formulaBeam.angle), _bdy = Math.sin(this._formulaBeam.angle);
                            const _dot = (_toPx * _bdx + _toPy * _bdy) / _pDist;
                            const _ang = Math.acos(Math.max(-1, Math.min(1, _dot)));
                            if (_ang < _DC.FORMULA_BEAM_ARC * 2.5 && _pDist < _DC.ARENA_RADIUS) {
                                if (!this._formulaBeam._hitCd || this._formulaBeam._hitCd <= 0) {
                                    player.takeDamage(_DC.FORMULA_BEAM_DAMAGE);
                                    this._formulaBeam._hitCd = 0.22;
                                    if (typeof spawnFloatingText === 'function')
                                        spawnFloatingText(`⚡ ${_DC.FORMULA_BEAM_DAMAGE}`, player.x, player.y - 55, '#38bdf8', 18);
                                    if (typeof addScreenShake === 'function') addScreenShake(6);
                                }
                            }
                        }
                        if (this._formulaBeam._hitCd > 0) this._formulaBeam._hitCd -= dt;
                    }
                }
                // ── Cell shockwaves ────────────────────────────────
                for (let _si = this._cellShockwaves.length - 1; _si >= 0; _si--) {
                    const _sw = this._cellShockwaves[_si];
                    _sw.r += 220 * dt;
                    _sw.alpha = Math.max(0, 1.0 - _sw.r / _sw.maxR);
                    if (_sw.alpha <= 0) this._cellShockwaves.splice(_si, 1);
                }
                this.cycleTimer -= dt;
                if (this.cyclePhase === 'warn' && this.cycleTimer <= 0) {
                    this.cyclePhase = 'explode'; this.cycleTimer = _DC.EXPLODE_DUR;
                    this._doExplosions(player);
                } else if (this.cyclePhase === 'explode' && this.cycleTimer <= 0) {
                    this.cycleCount++;
                    if (this.cycleCount >= _DC.TOTAL_CYCLES) {
                        this.phase = 'ending'; this.timer = _DC.END_DUR;
                        boss._domainCasting = false;
                        if (typeof addScreenShake === 'function') addScreenShake(20);
                        if (typeof spawnFloatingText === 'function' && player)
                            spawnFloatingText('Domain Lifted', player.x, player.y - 90, '#d946ef', 26);
                        if (window.UIManager)
                            window.UIManager.showVoiceBubble('...แค่นั้นแหละ.', boss.x, boss.y - 50);
                    } else {
                        this.cyclePhase = 'warn';
                        this.cycleTimer = Math.max(_DC.WARN_DUR_MIN, _DC.WARN_DUR - this.cycleCount * _DC.WARN_DUR_DECAY);
                        this._rollCells();

                        // ── Void pulse ring every N cycles ──────────
                        if (this.cycleCount % _DC.VOID_PULSE_CYCLE === 0) {
                            this._voidPulses.push({
                                wx: this.originX, wy: this.originY,
                                r: 60, maxR: _DC.ARENA_RADIUS * 1.05, alpha: 1, _hit: false
                            });
                            if (typeof spawnFloatingText === 'function' && player)
                                spawnFloatingText('🌀 VOID PULSE', player.x, player.y - 90, '#a855f7', 22);
                            if (typeof addScreenShake === 'function') addScreenShake(8);
                        }

                        // ── Formula beam from cycle 4+ ───────────────
                        if (this.cycleCount >= _DC.FORMULA_BEAM_CYCLE && boss && !boss.dead) {
                            const _initAngle = boss ? Math.atan2(player ? player.y - boss.y : 0, player ? player.x - boss.x : 1) : 0;
                            this._formulaBeam = {
                                bossX: boss.x, bossY: boss.y,
                                angle: _initAngle + Math.PI, timer: _DC.FORMULA_BEAM_DUR, _hitCd: 0
                            };
                            if (typeof spawnFloatingText === 'function' && boss)
                                spawnFloatingText('⚡ FORMULA BEAM', boss.x, boss.y - 80, '#38bdf8', 22);
                            if (typeof addScreenShake === 'function') addScreenShake(10);
                        }

                        // ── Boss volley on cycle 3+ ──────────────────
                        if (this.cycleCount >= _DC.BOSS_VOLLEY_CYCLE && boss && !boss.dead && typeof projectileManager !== 'undefined') {
                            const n = _DC.BOSS_VOLLEY_COUNT;
                            for (let _vi = 0; _vi < n; _vi++) {
                                const _va = (Math.PI * 2 / n) * _vi;
                                projectileManager.add(new Projectile(boss.x, boss.y, _va, 520, 20, '#d946ef', true, 'enemy'));
                            }
                            if (typeof addScreenShake === 'function') addScreenShake(12);
                        }
                    }
                }
                break;

            case 'ending':
                if (this.timer <= 0) {
                    this.phase = 'idle'; this.cooldownTimer = _DC.COOLDOWN;
                    boss._domainCasting = false; boss._domainActive = false;
                    if (boss.state === 'DOMAIN') { boss.state = 'CHASE'; boss.timer = 0; }
                    this.cells = []; this._crackLines = []; this._flashTimer = 0;
                    this._driftParticles = []; this._voidPulses = [];
                    this._formulaBeam = null; this._cellShockwaves = [];
                    this._bgAngle = 0;
                    console.log('[DomainExpansion] Domain ended — cooldown 45 s');
                }
                break;
        }
    },

    draw(ctx) {
        if (this.phase === 'idle' || !ctx) return;
        if (typeof worldToScreen !== 'function') return;
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const now = performance.now() / 1000;

        let globalA = 1.0;
        if (this.phase === 'casting') globalA = 1.0 - this.timer / _DC.CAST_DUR;
        else if (this.phase === 'ending') globalA = this.timer / _DC.END_DUR;
        globalA = Math.max(0, Math.min(1, globalA));

        ctx.save();

        // ── 1. Dark overlay ──────────────────────────────────
        ctx.globalAlpha = globalA * 0.80;
        ctx.fillStyle = 'rgba(2,0,14,1)';
        ctx.fillRect(0, 0, W, H);

        // ── 1b. Background rotating hex geometry ─────────────
        if (this.phase !== 'casting') {
            const originSS0 = worldToScreen(this.originX, this.originY);
            const edgeSS0 = worldToScreen(this.originX + _DC.ARENA_RADIUS, this.originY);
            const rSS0 = Math.abs(edgeSS0.x - originSS0.x);
            ctx.save();
            ctx.translate(originSS0.x, originSS0.y);
            ctx.rotate(this._bgAngle);
            ctx.globalAlpha = globalA * 0.07;
            ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 0.6;
            for (let hring = 1; hring <= 5; hring++) {
                const hR = rSS0 * (hring / 5) * 0.98;
                ctx.beginPath();
                for (let hv = 0; hv < 6; hv++) {
                    const ha = (hv / 6) * Math.PI * 2;
                    hv === 0 ? ctx.moveTo(Math.cos(ha) * hR, Math.sin(ha) * hR)
                        : ctx.lineTo(Math.cos(ha) * hR, Math.sin(ha) * hR);
                }
                ctx.closePath(); ctx.stroke();
                // Spokes
                for (let hsp = 0; hsp < 6; hsp++) {
                    const hsa = (hsp / 6) * Math.PI * 2;
                    const prevR = rSS0 * ((hring - 1) / 5) * 0.98;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(hsa) * prevR, Math.sin(hsa) * prevR);
                    ctx.lineTo(Math.cos(hsa) * hR, Math.sin(hsa) * hR);
                    ctx.stroke();
                }
            }
            ctx.restore();

            // Counter-rotating inner diamond grid
            ctx.save();
            ctx.translate(originSS0.x, originSS0.y);
            ctx.rotate(-this._bgAngle * 1.7 + Math.PI / 4);
            ctx.globalAlpha = globalA * 0.045;
            ctx.strokeStyle = '#facc15'; ctx.lineWidth = 0.5;
            const gridStep = rSS0 * 0.18;
            const gridN = 12;
            for (let gi = -gridN; gi <= gridN; gi++) {
                ctx.beginPath(); ctx.moveTo(gi * gridStep, -rSS0); ctx.lineTo(gi * gridStep, rSS0); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-rSS0, gi * gridStep); ctx.lineTo(rSS0, gi * gridStep); ctx.stroke();
            }
            ctx.restore();
        }

        // ── 1c. Ambient drift particles ───────────────────────
        if (this.phase === 'active' || this.phase === 'ending') {
            for (const dp of this._driftParticles) {
                const dps = worldToScreen(dp.x + this.originX, dp.y + this.originY);
                const dpPulse = 0.5 + Math.sin(now * 2.4 + dp.phase) * 0.5;
                ctx.globalAlpha = globalA * dp.alpha * dpPulse;
                ctx.fillStyle = dp.gold ? `rgba(251,191,36,1)` : `rgba(217,70,239,1)`;
                ctx.shadowBlur = dp.r * 3; ctx.shadowColor = dp.gold ? '#facc15' : '#d946ef';
                ctx.beginPath(); ctx.arc(dps.x, dps.y, dp.r * (0.7 + dpPulse * 0.3), 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        // ── 2. Matrix rain — denser, dual-colour ────────────
        ctx.font = '11px "Courier New",monospace';
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        for (const col of this._rain) {
            const cx = col.xNorm * W, charH = 14;
            for (let i = 0; i < col.chars.length; i++) {
                const rawY = ((now * col.speed * H * 0.20 + col.offsetY + i * charH)) % (H + charH * col.chars.length) - charH * 4;
                const fade = 1.0 - i / col.chars.length;
                ctx.globalAlpha = globalA * col.alpha * fade;
                if (i === 0) { ctx.fillStyle = '#fff'; ctx.shadowBlur = 8; ctx.shadowColor = '#d946ef'; }
                else if (i < 3) { ctx.fillStyle = '#d946ef'; ctx.shadowBlur = 4; ctx.shadowColor = '#d946ef'; }
                else { ctx.fillStyle = '#d97706'; ctx.shadowBlur = 0; }
                ctx.fillText(col.chars[i], cx, rawY);
            }
        }
        ctx.shadowBlur = 0;

        // ── 3. Domain border — circular arena ring ────────────
        if (this.phase === 'active' || this.phase === 'ending') {
            const originSS = worldToScreen(this.originX, this.originY);
            const edgeSS = worldToScreen(this.originX + _DC.ARENA_RADIUS, this.originY);
            const radiusSS = Math.abs(edgeSS.x - originSS.x);
            const bCX = originSS.x, bCY = originSS.y;
            const pulse = 0.55 + Math.sin(now * 5) * 0.45;
            const dangerPct = Math.min(_DC.DANGER_PCT_MAX, _DC.DANGER_PCT + this.cycleCount * _DC.DANGER_PCT_STEP);
            const tintR = Math.floor(180 + (dangerPct - _DC.DANGER_PCT) / (_DC.DANGER_PCT_MAX - _DC.DANGER_PCT) * 75);
            const borderCol = `rgb(${tintR},0,255)`;

            // Outer glow ring
            ctx.globalAlpha = globalA * (0.55 + pulse * 0.45);
            ctx.shadowBlur = 32 * pulse; ctx.shadowColor = borderCol;
            ctx.strokeStyle = borderCol; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(bCX, bCY, radiusSS, 0, Math.PI * 2); ctx.stroke();

            // Inner dashed ring
            ctx.globalAlpha = globalA * 0.35;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(217,70,239,0.4)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([12, 8]);
            ctx.beginPath(); ctx.arc(bCX, bCY, radiusSS - 8, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);

            // Rotating rune symbols around the circle
            const runeSymbols = ['Σ', 'Ψ', 'Ω', '∇', 'Φ', '∫', 'Δ', 'Λ', 'θ', 'π', 'μ', '∂'];
            ctx.font = 'bold 14px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (let ri = 0; ri < runeSymbols.length; ri++) {
                const rAngle = (ri / runeSymbols.length) * Math.PI * 2 + now * 0.5;
                const rAlpha = 0.55 + Math.sin(now * 2.5 + ri) * 0.35;
                const rx = bCX + Math.cos(rAngle) * (radiusSS + 18);
                const ry = bCY + Math.sin(rAngle) * (radiusSS + 18);
                ctx.globalAlpha = globalA * rAlpha;
                ctx.fillStyle = '#d946ef';
                ctx.shadowBlur = 8; ctx.shadowColor = '#d946ef';
                ctx.fillText(runeSymbols[ri], rx, ry);
            }
            ctx.shadowBlur = 0;

            // ── Inner contra-rotating orbit rings ─────────
            for (let ir = 0; ir < 2; ir++) {
                const irR = radiusSS * (0.92 - ir * 0.07);
                const irAngle = (ir === 0 ? now * 0.65 : -now * 0.9);
                ctx.save();
                ctx.translate(bCX, bCY);
                ctx.rotate(irAngle);
                ctx.globalAlpha = globalA * (0.22 + pulse * 0.18);
                ctx.strokeStyle = ir === 0 ? 'rgba(217,70,239,0.55)' : 'rgba(251,191,36,0.45)';
                ctx.lineWidth = 1.2;
                ctx.setLineDash(ir === 0 ? [6, 14] : [3, 20]);
                ctx.beginPath(); ctx.arc(0, 0, irR, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                // Spinning node dots on ring
                for (let nd = 0; nd < (ir === 0 ? 8 : 5); nd++) {
                    const na = (nd / (ir === 0 ? 8 : 5)) * Math.PI * 2;
                    const nodeAlpha = 0.4 + Math.sin(now * 3 + nd * 0.9) * 0.4;
                    ctx.fillStyle = ir === 0 ? `rgba(217,70,239,${nodeAlpha})` : `rgba(251,191,36,${nodeAlpha})`;
                    ctx.shadowBlur = 6; ctx.shadowColor = ir === 0 ? '#d946ef' : '#facc15';
                    ctx.beginPath(); ctx.arc(Math.cos(na) * irR, Math.sin(na) * irR, 2.5, 0, Math.PI * 2); ctx.fill();
                }
                ctx.shadowBlur = 0; ctx.restore();
            }

            // ── Data stream lines ─────────────────────────────
            {
                const streamCount = 6;
                for (let si = 0; si < streamCount; si++) {
                    const sAngle = (si / streamCount) * Math.PI * 2 + now * 0.28;
                    const sLen = radiusSS * (0.55 + Math.sin(now * 1.2 + si) * 0.25);
                    const sx1 = bCX + Math.cos(sAngle) * (radiusSS * 0.05);
                    const sy1 = bCY + Math.sin(sAngle) * (radiusSS * 0.05);
                    const sx2 = bCX + Math.cos(sAngle) * sLen;
                    const sy2 = bCY + Math.sin(sAngle) * sLen;
                    const sAlpha = 0.08 + Math.sin(now * 2.8 + si * 1.1) * 0.06;
                    const sG = ctx.createLinearGradient(sx1, sy1, sx2, sy2);
                    sG.addColorStop(0, `rgba(56,189,248,0)`);
                    sG.addColorStop(0.5, `rgba(56,189,248,${sAlpha})`);
                    sG.addColorStop(1, `rgba(56,189,248,0)`);
                    ctx.globalAlpha = globalA;
                    ctx.strokeStyle = sG; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2); ctx.stroke();
                }
            }

            // Cycle counter chip — top of screen
            if (this.phase === 'active') {
                const warnDurCurrent = Math.max(_DC.WARN_DUR_MIN, _DC.WARN_DUR - this.cycleCount * _DC.WARN_DUR_DECAY);
                const warnProg = this.cyclePhase === 'warn' ? (1.0 - this.cycleTimer / warnDurCurrent) : 1.0;
                const chipX = bCX, chipY = bCY - radiusSS - 28;
                ctx.globalAlpha = globalA * 0.92;
                ctx.font = 'bold 11px "Orbitron",Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(2,0,14,0.9)';
                ctx.fillRect(chipX - 58, chipY - 12, 116, 24);
                ctx.strokeStyle = borderCol; ctx.lineWidth = 1.5;
                ctx.strokeRect(chipX - 58, chipY - 12, 116, 24);
                ctx.fillStyle = borderCol;
                ctx.globalAlpha = globalA * 0.5;
                ctx.fillRect(chipX - 56, chipY - 10, 112 * warnProg, 20);
                ctx.globalAlpha = globalA * 0.92;
                ctx.fillStyle = '#f0abfc';
                ctx.shadowBlur = 6; ctx.shadowColor = '#d946ef';
                ctx.fillText(`CYCLE ${this.cycleCount + 1} / ${_DC.TOTAL_CYCLES}`, chipX, chipY);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = globalA * 0.70;
                ctx.font = 'bold 9px "Orbitron",Arial';
                ctx.fillStyle = tintR > 210 ? '#ef4444' : '#facc15';
                ctx.fillText(`DANGER ${Math.round(dangerPct * 100)}%`, chipX, chipY + 18);

                // Cycle dot progress row
                ctx.globalAlpha = globalA * 0.85;
                for (let di = 0; di < _DC.TOTAL_CYCLES; di++) {
                    const dx2 = chipX - (_DC.TOTAL_CYCLES - 1) * 10 + di * 20;
                    const dy2 = chipY + 36;
                    const done = di < this.cycleCount;
                    const cur = di === this.cycleCount;
                    ctx.fillStyle = done ? borderCol : cur ? '#facc15' : '#334155';
                    ctx.shadowBlur = cur ? 10 : done ? 4 : 0; ctx.shadowColor = '#facc15';
                    ctx.beginPath(); ctx.arc(dx2, dy2, cur ? 5.5 : 4, 0, Math.PI * 2); ctx.fill();
                }
                ctx.shadowBlur = 0;
            }
        }

        // ── 4. Grid cells ────────────────────────────────────
        if ((this.phase === 'active' || this.phase === 'ending') && this.cells.length) {
            const warnDurCurrent = Math.max(_DC.WARN_DUR_MIN, _DC.WARN_DUR - this.cycleCount * _DC.WARN_DUR_DECAY);
            const warnProgress = this.cyclePhase === 'warn' ? (1.0 - this.cycleTimer / warnDurCurrent) : 1.0;
            const explodeProgress = this.cyclePhase === 'explode' ? (1.0 - this.cycleTimer / _DC.EXPLODE_DUR) : 0;
            const fastPulse = 0.5 + Math.sin(now * (4 + warnProgress * 10)) * 0.5;
            const isLate = warnProgress > 0.60;

            for (const cell of this.cells) {
                const tl = worldToScreen(cell.wx, cell.wy);
                const br = worldToScreen(cell.wx + _DC.CELL_SIZE, cell.wy + _DC.CELL_SIZE);
                const sw = br.x - tl.x, sh = br.y - tl.y;
                if (br.x < 0 || tl.x > W || br.y < 0 || tl.y > H || sw < 2 || sh < 2) continue;
                const mx = tl.x + sw / 2, my = tl.y + sh / 2;

                if (cell.dangerous) {
                    if (this.cyclePhase === 'explode') {
                        // ── Explosion flash ───────────────────
                        const ef = 1.0 - explodeProgress;
                        // Outer purple halo
                        ctx.globalAlpha = globalA * ef * 0.55;
                        const eg2 = ctx.createRadialGradient(mx, my, 0, mx, my, sw * 1.1);
                        eg2.addColorStop(0, `rgba(217,70,239,${ef * 0.6})`);
                        eg2.addColorStop(1, `rgba(0,0,0,0)`);
                        ctx.fillStyle = eg2;
                        ctx.beginPath(); ctx.arc(mx, my, sw * 1.1, 0, Math.PI * 2); ctx.fill();
                        // White-hot core
                        ctx.globalAlpha = globalA * ef * 0.98;
                        const eg = ctx.createRadialGradient(mx, my, 0, mx, my, sw * 0.72);
                        eg.addColorStop(0, `rgba(255,255,255,${ef})`);
                        eg.addColorStop(0.25, `rgba(255,240,150,${ef})`);
                        eg.addColorStop(0.55, `rgba(239,68,68,${ef * 0.85})`);
                        eg.addColorStop(1, `rgba(217,70,239,0)`);
                        ctx.fillStyle = eg;
                        ctx.fillRect(tl.x, tl.y, sw, sh);
                        // Digital shatter lines
                        ctx.save();
                        ctx.globalAlpha = globalA * ef * 0.60;
                        ctx.strokeStyle = `rgba(255,255,255,${ef})`; ctx.lineWidth = 1;
                        for (let shl = 0; shl < 5; shl++) {
                            const sha = (shl / 5) * Math.PI;
                            ctx.beginPath();
                            ctx.moveTo(mx, my);
                            ctx.lineTo(mx + Math.cos(sha) * sw * 0.65 * ef, my + Math.sin(sha) * sh * 0.65 * ef);
                            ctx.stroke();
                        }
                        ctx.restore();
                        // Bright border ring
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
                        ctx.shadowBlur = 22; ctx.shadowColor = '#ef4444';
                        ctx.globalAlpha = globalA * ef * 0.90;
                        ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                        ctx.shadowBlur = 0;
                    } else {
                        // ── Warning ───────────────────────────
                        const baseCol = isLate ? '#ef4444' : '#d97706';
                        const glowCol = isLate ? '#ef4444' : '#facc15';
                        // Fill gradient
                        const wg = ctx.createRadialGradient(mx, my, 0, mx, my, sw * 0.72);
                        const fillA = 0.18 + warnProgress * 0.45 * fastPulse;
                        wg.addColorStop(0, isLate ? `rgba(239,68,68,${fillA * 1.4})` : `rgba(251,146,60,${fillA})`);
                        wg.addColorStop(1, `rgba(0,0,0,0)`);
                        ctx.globalAlpha = globalA;
                        ctx.fillStyle = wg;
                        ctx.fillRect(tl.x, tl.y, sw, sh);
                        // Animated border
                        ctx.strokeStyle = baseCol; ctx.lineWidth = isLate ? 2.5 : 1.8;
                        ctx.shadowBlur = isLate ? (8 + fastPulse * 10) : 4; ctx.shadowColor = glowCol;
                        ctx.globalAlpha = globalA * (0.4 + fastPulse * 0.6);
                        ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                        ctx.shadowBlur = 0;
                        // Corner tick marks
                        ctx.strokeStyle = glowCol; ctx.lineWidth = 1.5;
                        ctx.globalAlpha = globalA * 0.85;
                        const tl2 = 7;
                        [[tl.x, tl.y, 1, 1], [tl.x + sw, tl.y, -1, 1], [tl.x, tl.y + sh, 1, -1], [tl.x + sw, tl.y + sh, -1, -1]].forEach(([bx, by, sx2, sy2]) => {
                            ctx.beginPath(); ctx.moveTo(bx + sx2 * tl2, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + sy2 * tl2); ctx.stroke();
                        });
                        // Countdown bar (bottom of cell)
                        const barW = Math.max(0, (sw - 4) * (1.0 - warnProgress));
                        ctx.globalAlpha = globalA * 0.9;
                        const barG = ctx.createLinearGradient(tl.x + 2, 0, tl.x + 2 + barW, 0);
                        barG.addColorStop(0, isLate ? '#ef4444' : '#facc15');
                        barG.addColorStop(1, isLate ? '#fbbf24' : '#d97706');
                        ctx.fillStyle = barG;
                        ctx.fillRect(tl.x + 2, tl.y + sh - 6, barW, 5);
                        // Math formula inside cell
                        const formulas = ['∑x²', 'dy/dx', 'log(x)', 'f\'(x)', 'det(A)', 'eigenλ', 'μ+σ', '∫f dx'];
                        const fi = Math.abs(Math.round(cell.wx + cell.wy) % formulas.length);
                        const formulaAlpha = isLate ? (0.30 + fastPulse * 0.35) : 0.18;
                        ctx.globalAlpha = globalA * formulaAlpha;
                        ctx.font = `bold ${Math.max(8, Math.floor(sw * 0.15))}px "Courier New",monospace`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillStyle = isLate ? '#fca5a5' : '#fde68a';
                        ctx.fillText(formulas[fi], mx, my + sh * 0.15);
                        // ⚠ icon
                        const iconSize = Math.max(10, Math.floor(sh * 0.38));
                        ctx.globalAlpha = globalA * (0.6 + fastPulse * 0.4);
                        ctx.font = `${iconSize}px Arial`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#fff';
                        ctx.shadowBlur = isLate ? 10 : 4; ctx.shadowColor = glowCol;
                        ctx.fillText('⚠', mx, my - sh * 0.12);
                        ctx.shadowBlur = 0;
                    }
                } else {
                    // ── Safe cell ──────────────────────────────
                    ctx.globalAlpha = globalA * 0.12;
                    ctx.fillStyle = '#22c55e'; ctx.fillRect(tl.x, tl.y, sw, sh);
                    ctx.globalAlpha = globalA * 0.35;
                    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5;
                    ctx.shadowBlur = 6; ctx.shadowColor = '#22c55e';
                    ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                    ctx.shadowBlur = 0;
                    const iconSize2 = Math.max(8, Math.floor(sh * 0.30));
                    ctx.globalAlpha = globalA * 0.55;
                    ctx.font = `bold ${iconSize2}px Arial`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#4ade80';
                    ctx.fillText('✓', mx, my);
                }
            }
        }

        // ── 4b. Cell shockwave rings ─────────────────────────
        if (this._cellShockwaves.length > 0) {
            for (const csw of this._cellShockwaves) {
                const cswS = worldToScreen(csw.wx, csw.wy);
                const cswEdge = worldToScreen(csw.wx + csw.r, csw.wy);
                const cswR = Math.abs(cswEdge.x - cswS.x);
                ctx.globalAlpha = globalA * csw.alpha * 0.75;
                ctx.strokeStyle = `rgba(239,68,68,${csw.alpha})`;
                ctx.lineWidth = 2.5 * csw.alpha;
                ctx.shadowBlur = 14 * csw.alpha; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.arc(cswS.x, cswS.y, cswR, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }

        // ── 4c. Void pulse rings ──────────────────────────────
        if (this._voidPulses.length > 0) {
            for (const vp of this._voidPulses) {
                const vpC = worldToScreen(vp.wx, vp.wy);
                const vpE = worldToScreen(vp.wx + vp.r, vp.wy);
                const vpR = Math.abs(vpE.x - vpC.x);
                // Outer glow
                ctx.globalAlpha = globalA * vp.alpha * 0.35;
                const vpG = ctx.createRadialGradient(vpC.x, vpC.y, vpR * 0.88, vpC.x, vpC.y, vpR * 1.08);
                vpG.addColorStop(0, 'rgba(168,85,247,0)');
                vpG.addColorStop(0.5, `rgba(168,85,247,${vp.alpha * 0.55})`);
                vpG.addColorStop(1, 'rgba(168,85,247,0)');
                ctx.fillStyle = vpG;
                ctx.beginPath(); ctx.arc(vpC.x, vpC.y, vpR * 1.08, 0, Math.PI * 2);
                ctx.arc(vpC.x, vpC.y, vpR * 0.88, 0, Math.PI * 2, true);
                ctx.fill();
                // Sharp ring
                ctx.globalAlpha = globalA * vp.alpha;
                ctx.strokeStyle = `rgba(168,85,247,${vp.alpha * 0.9})`; ctx.lineWidth = 3.5;
                ctx.shadowBlur = 18 * vp.alpha; ctx.shadowColor = '#a855f7';
                ctx.beginPath(); ctx.arc(vpC.x, vpC.y, vpR, 0, Math.PI * 2); ctx.stroke();
                // Trailing inner ring
                ctx.globalAlpha = globalA * vp.alpha * 0.45;
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(vpC.x, vpC.y, vpR * 0.92, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }

        // ── 4d. Formula beam ─────────────────────────────────
        if (this._formulaBeam) {
            const fbS = worldToScreen(this._formulaBeam.bossX, this._formulaBeam.bossY);
            const fbAngle = this._formulaBeam.angle;
            const fbProg = this._formulaBeam.timer / _DC.FORMULA_BEAM_DUR;
            const fbLen = W * 1.4; // long enough to cross screen
            const originSS_fb = worldToScreen(this.originX, this.originY);
            const edgeSS_fb = worldToScreen(this.originX + _DC.ARENA_RADIUS, this.originY);
            const arenaRSS_fb = Math.abs(edgeSS_fb.x - originSS_fb.x);
            const actualBeamLen = arenaRSS_fb * 1.1;
            const fbAlpha = Math.min(1, fbProg * 3) * (0.65 + Math.sin(now * 18) * 0.15);

            ctx.save();
            ctx.translate(fbS.x, fbS.y);
            ctx.rotate(fbAngle);
            // Outer wide glow
            const fbG1 = ctx.createLinearGradient(0, 0, actualBeamLen, 0);
            fbG1.addColorStop(0, `rgba(56,189,248,${fbAlpha * 0.45})`);
            fbG1.addColorStop(0.5, `rgba(56,189,248,${fbAlpha * 0.20})`);
            fbG1.addColorStop(1, 'rgba(56,189,248,0)');
            ctx.fillStyle = fbG1;
            ctx.globalAlpha = globalA;
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.arc(0, 0, actualBeamLen, -_DC.FORMULA_BEAM_ARC * 6, _DC.FORMULA_BEAM_ARC * 6);
            ctx.closePath(); ctx.fill();
            // Core bright beam
            const fbG2 = ctx.createLinearGradient(0, 0, actualBeamLen, 0);
            fbG2.addColorStop(0, `rgba(255,255,255,${fbAlpha * 0.95})`);
            fbG2.addColorStop(0.2, `rgba(56,189,248,${fbAlpha * 0.80})`);
            fbG2.addColorStop(1, 'rgba(56,189,248,0)');
            ctx.fillStyle = fbG2;
            ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.arc(0, 0, actualBeamLen, -_DC.FORMULA_BEAM_ARC, _DC.FORMULA_BEAM_ARC);
            ctx.closePath(); ctx.fill();
            // Central line
            ctx.strokeStyle = `rgba(255,255,255,${fbAlpha})`; ctx.lineWidth = 2.5;
            ctx.shadowBlur = 20; ctx.shadowColor = '#38bdf8';
            ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(actualBeamLen * 0.85, 0); ctx.stroke();
            // Scanline text overlay on beam
            ctx.globalAlpha = globalA * fbAlpha * 0.55;
            ctx.font = '9px "Courier New",monospace'; ctx.fillStyle = '#bfdbfe';
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            const beamFormulas = ['∑x²=0', 'λ=∞', 'det≠0', '∂φ/∂t'];
            for (let bfi = 0; bfi < 4; bfi++) {
                ctx.fillText(beamFormulas[bfi], 20 + bfi * 55, (bfi % 2 === 0 ? -5 : 5));
            }
            ctx.shadowBlur = 0; ctx.restore();

            // Origin burst
            ctx.save();
            ctx.globalAlpha = globalA * fbAlpha * 0.70;
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 30; ctx.shadowColor = '#38bdf8';
            ctx.beginPath(); ctx.arc(fbS.x, fbS.y, 9 * fbAlpha, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.restore();
        }

        // ── 5. Casting animation ─────────────────────────────────────────────
        if (this.phase === 'casting') {
            const elapsed = _DC.CAST_DUR - this.timer;
            const ringScreen = worldToScreen(this.originX, this.originY);

            // ── Portal iris opening ───────────────────────
            const pp = this._portalProgress;
            if (pp > 0) {
                const arenaEdgeSS0 = worldToScreen(_DC.ARENA_RADIUS, 0);
                const arenaOriSS0 = worldToScreen(0, 0);
                const aSSR0 = Math.abs(arenaEdgeSS0.x - arenaOriSS0.x);
                // Dark void filling behind everything
                ctx.globalAlpha = globalA * Math.pow(pp, 0.6) * 0.65;
                ctx.fillStyle = 'rgba(0,0,8,1)';
                ctx.beginPath(); ctx.arc(ringScreen.x, ringScreen.y, aSSR0 * pp * 1.1, 0, Math.PI * 2); ctx.fill();
                // Portal rim glow
                ctx.globalAlpha = globalA * pp * 0.80;
                ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 5;
                ctx.shadowBlur = 40 * pp; ctx.shadowColor = '#d946ef';
                ctx.beginPath(); ctx.arc(ringScreen.x, ringScreen.y, aSSR0 * pp * 1.1, 0, Math.PI * 2); ctx.stroke();
                // Inner swirl arms
                for (let sw2 = 0; sw2 < 6; sw2++) {
                    const swA = (sw2 / 6) * Math.PI * 2 + elapsed * 4;
                    const swLen = aSSR0 * pp * (0.35 + Math.sin(elapsed * 3 + sw2) * 0.15);
                    ctx.globalAlpha = globalA * pp * (0.25 + Math.sin(elapsed * 5 + sw2) * 0.15);
                    ctx.strokeStyle = sw2 % 2 === 0 ? '#d946ef' : '#facc15';
                    ctx.lineWidth = 1.5; ctx.shadowBlur = 8; ctx.shadowColor = '#d946ef';
                    ctx.beginPath();
                    ctx.moveTo(ringScreen.x, ringScreen.y);
                    ctx.quadraticCurveTo(
                        ringScreen.x + Math.cos(swA + 0.5) * swLen * 0.7,
                        ringScreen.y + Math.sin(swA + 0.5) * swLen * 0.7,
                        ringScreen.x + Math.cos(swA) * swLen,
                        ringScreen.y + Math.sin(swA) * swLen
                    );
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;
            }

            // Expanding shockwave rings — grow to cover full arena
            const arenaEdgeSS = worldToScreen(_DC.ARENA_RADIUS, 0);
            const arenaOriginSS = worldToScreen(0, 0);
            const arenaSSRadius = Math.abs(arenaEdgeSS.x - arenaOriginSS.x);
            for (let ri = 0; ri < 3; ri++) {
                const delay = ri * 0.5;
                if (elapsed < delay) continue;
                const rProg = Math.min(1.0, (elapsed - delay) / (_DC.CAST_DUR - delay));
                const ringR = rProg * arenaSSRadius * 1.05;
                ctx.globalAlpha = globalA * (1.0 - rProg) * (0.5 - ri * 0.12);
                ctx.strokeStyle = ri === 0 ? '#d946ef' : ri === 1 ? '#facc15' : '#ffffff';
                ctx.lineWidth = 3 - ri * 0.8;
                ctx.shadowBlur = 24 - ri * 6; ctx.shadowColor = '#d946ef';
                ctx.beginPath(); ctx.arc(ringScreen.x, ringScreen.y, ringR, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Chromatic aberration lines — horizontal scan lines
            if (elapsed > 0.8) {
                const caProg = Math.min(1.0, (elapsed - 0.8) / 1.2);
                const lineCount = Math.floor(caProg * 12);
                for (let li = 0; li < lineCount; li++) {
                    const ly = (li / lineCount) * H + Math.sin(now * 8 + li) * 15;
                    ctx.globalAlpha = globalA * 0.08 * caProg;
                    ctx.fillStyle = li % 3 === 0 ? '#d946ef' : li % 3 === 1 ? '#facc15' : '#38bdf8';
                    ctx.fillRect(0, ly, W, 2);
                }
            }

            // Screen crack lines (static from _crackLines — generated once)
            if (elapsed > 0.5 && this._crackLines.length === 0) {
                for (let ci = 0; ci < 8; ci++) {
                    const cx2 = W * (0.3 + Math.random() * 0.4);
                    const cy2 = H * (0.3 + Math.random() * 0.4);
                    const len = 40 + Math.random() * 100;
                    const angle = Math.random() * Math.PI * 2;
                    this._crackLines.push({ x: cx2, y: cy2, dx: Math.cos(angle) * len, dy: Math.sin(angle) * len });
                }
            }
            if (elapsed > 0.5 && this._crackLines.length > 0) {
                const crackA = Math.min(1.0, (elapsed - 0.5) / 0.8) * 0.55;
                ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 1.5;
                ctx.shadowBlur = 10; ctx.shadowColor = '#d946ef';
                for (const cl of this._crackLines) {
                    ctx.globalAlpha = globalA * crackA;
                    ctx.beginPath(); ctx.moveTo(cl.x, cl.y); ctx.lineTo(cl.x + cl.dx, cl.y + cl.dy); ctx.stroke();
                    // Secondary branch
                    ctx.globalAlpha = globalA * crackA * 0.5;
                    ctx.beginPath(); ctx.moveTo(cl.x + cl.dx * 0.5, cl.y + cl.dy * 0.5);
                    ctx.lineTo(cl.x + cl.dx * 0.5 + cl.dy * 0.4, cl.y + cl.dy * 0.5 - cl.dx * 0.4); ctx.stroke();
                }
                ctx.shadowBlur = 0;
            }

            // 領域展開 kanji — scale + chromatic split
            if (elapsed > 0.35) {
                const ta = Math.min(1.0, (elapsed - 0.35) / 0.45);
                const sc = 0.78 + ta * 0.22;
                const fontSize = Math.round(52 * sc);
                // Red/blue chromatic shadows
                ctx.globalAlpha = globalA * ta * 0.45;
                ctx.font = `bold ${fontSize}px serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#38bdf8';
                ctx.fillText('領域展開', W / 2 - 3, H / 2 - 42 + 2);
                ctx.fillStyle = '#ef4444';
                ctx.fillText('領域展開', W / 2 + 3, H / 2 - 42 - 2);
                // Main white text
                ctx.globalAlpha = globalA * ta;
                ctx.fillStyle = '#f0abfc';
                ctx.shadowBlur = 40; ctx.shadowColor = '#d946ef';
                ctx.fillText('領域展開', W / 2, H / 2 - 42);
                ctx.shadowBlur = 0;
            }
            // METRICS-MANIPULATION subtitle with glitch
            if (elapsed > 1.05) {
                const tb = Math.min(1.0, (elapsed - 1.05) / 0.55);
                const titleText = 'METRICS-MANIPULATION';
                const fontSize2 = Math.round(36 * (0.88 + tb * 0.12));
                ctx.font = `900 ${fontSize2}px "Orbitron","Bebas Neue",Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                // Glitch offset layers
                const glitch = tb > 0.5 ? Math.sin(elapsed * 28) * 4 * (1 - tb) : 0;
                ctx.globalAlpha = globalA * tb * 0.50;
                ctx.fillStyle = '#38bdf8';
                ctx.fillText(titleText, W / 2 - glitch - 2, H / 2 + 28 + 1);
                ctx.fillStyle = '#ef4444';
                ctx.fillText(titleText, W / 2 + glitch + 2, H / 2 + 28 - 1);
                // Main gold text
                ctx.globalAlpha = globalA * tb;
                ctx.shadowBlur = 34 + Math.sin(elapsed * 10) * 8; ctx.shadowColor = '#facc15';
                ctx.fillStyle = '#fef08a';
                ctx.fillText(titleText, W / 2, H / 2 + 28);
                ctx.shadowBlur = 0;
                // Bracket decorations
                ctx.globalAlpha = globalA * tb * 0.75;
                ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
                const titleHalfW = ctx.measureText(titleText).width * 0.5 + 10;
                const brkY = H / 2 + 28, brkH = fontSize2 * 0.65;
                [[W / 2 - titleHalfW, -1], [W / 2 + titleHalfW, 1]].forEach(([bx, bDir]) => {
                    ctx.beginPath();
                    ctx.moveTo(bx + bDir * 10, brkY - brkH / 2);
                    ctx.lineTo(bx, brkY - brkH / 2);
                    ctx.lineTo(bx, brkY + brkH / 2);
                    ctx.lineTo(bx + bDir * 10, brkY + brkH / 2);
                    ctx.stroke();
                });
                // Underline sweep
                ctx.globalAlpha = globalA * tb * 0.85;
                ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
                const ulW2 = tb * 300;
                ctx.beginPath(); ctx.moveTo(W / 2 - ulW2 / 2, H / 2 + 54); ctx.lineTo(W / 2 + ulW2 / 2, H / 2 + 54); ctx.stroke();
                // Subtitle sub-label
                if (tb > 0.7) {
                    const tbb = (tb - 0.7) / 0.3;
                    ctx.globalAlpha = globalA * tbb * 0.65;
                    ctx.font = `bold 12px "Orbitron",monospace`;
                    ctx.fillStyle = '#e879f9'; ctx.shadowBlur = 0;
                    ctx.fillText('DOMAIN EXPANSION  •  ครูมานพ', W / 2, H / 2 + 72);
                }
            }
            // Final white flash
            if (elapsed > _DC.CAST_DUR - 0.35) {
                const tf = (elapsed - (_DC.CAST_DUR - 0.35)) / 0.35;
                ctx.globalAlpha = globalA * tf * 0.70;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, W, H);
                ctx.globalAlpha = globalA * tf * 0.45;
                ctx.fillStyle = '#d946ef';
                ctx.fillRect(0, 0, W, H);
            }
        }

        // ── 6. Full-screen hit flash (purple) ────────────────
        if (this._flashTimer > 0) {
            ctx.globalAlpha = Math.min(this._flashTimer / 0.12, 1.0) * 0.55;
            ctx.fillStyle = '#d946ef';
            ctx.fillRect(0, 0, W, H);
        }

        // ── 6b. Boss energy aura during domain ─────────────
        if ((this.phase === 'active') && typeof worldToScreen === 'function') {
            const bossRef = (typeof window !== 'undefined' && window.boss) ? window.boss : null;
            if (bossRef && !bossRef.dead) {
                const bSS = worldToScreen(bossRef.x, bossRef.y);
                const bAuraPulse = 0.5 + Math.sin(now * 3.5) * 0.5;
                const bAuraSize = 42 + bAuraPulse * 14;
                // Outer void halo
                ctx.globalAlpha = globalA * 0.22 * bAuraPulse;
                const bAG1 = ctx.createRadialGradient(bSS.x, bSS.y, 0, bSS.x, bSS.y, bAuraSize * 1.8);
                bAG1.addColorStop(0, 'rgba(217,70,239,0.7)'); bAG1.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = bAG1;
                ctx.beginPath(); ctx.arc(bSS.x, bSS.y, bAuraSize * 1.8, 0, Math.PI * 2); ctx.fill();
                // Spinning rune ring around boss
                ctx.globalAlpha = globalA * (0.45 + bAuraPulse * 0.35);
                ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 1.8;
                ctx.shadowBlur = 12; ctx.shadowColor = '#d946ef';
                ctx.setLineDash([5, 12]);
                ctx.beginPath(); ctx.arc(bSS.x, bSS.y, bAuraSize, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                // Mini rune nodes
                for (let brn = 0; brn < 4; brn++) {
                    const brA = (brn / 4) * Math.PI * 2 + now * 1.8;
                    const bnx = bSS.x + Math.cos(brA) * bAuraSize;
                    const bny = bSS.y + Math.sin(brA) * bAuraSize;
                    ctx.globalAlpha = globalA * (0.6 + Math.sin(now * 4 + brn) * 0.35);
                    ctx.fillStyle = brn % 2 === 0 ? '#d946ef' : '#facc15';
                    ctx.shadowBlur = 8; ctx.shadowColor = ctx.fillStyle;
                    ctx.beginPath(); ctx.arc(bnx, bny, 3.5, 0, Math.PI * 2); ctx.fill();
                }
                ctx.shadowBlur = 0;
            }
        }

        // ── 7. Slow debuff HUD indicator ─────────────────────
        if (typeof window !== 'undefined' && window.player && window.player._domainSlowActive) {
            const slowPulse = 0.5 + Math.sin(now * 6) * 0.5;
            // Edge vignette
            const sVig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.72);
            sVig.addColorStop(0, 'rgba(0,0,0,0)');
            sVig.addColorStop(1, `rgba(147,51,234,${0.32 * slowPulse})`);
            ctx.globalAlpha = globalA;
            ctx.fillStyle = sVig; ctx.fillRect(0, 0, W, H);
            // Status chip
            ctx.globalAlpha = globalA * (0.8 + slowPulse * 0.2);
            ctx.fillStyle = 'rgba(15,3,30,0.88)';
            ctx.strokeStyle = `rgba(217,70,239,${0.7 + slowPulse * 0.3})`;
            ctx.lineWidth = 1.5; ctx.shadowBlur = 12; ctx.shadowColor = '#d946ef';
            ctx.beginPath(); ctx.roundRect(W / 2 - 62, 8, 124, 26, 5); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.font = 'bold 13px "Orbitron",Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#f0abfc';
            ctx.shadowBlur = 10; ctx.shadowColor = '#d946ef';
            ctx.fillText('🔮 SLOWED', W / 2, 21);
            ctx.shadowBlur = 0;
        }

        // ── 7b. Formula beam HUD warning ─────────────────────
        if (this._formulaBeam) {
            const fbHudP = this._formulaBeam.timer / _DC.FORMULA_BEAM_DUR;
            const fbHudPulse = 0.5 + Math.sin(now * 14) * 0.5;
            ctx.globalAlpha = globalA * fbHudPulse * 0.18;
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = globalA * (0.7 + fbHudPulse * 0.3);
            ctx.font = 'bold 13px "Orbitron",Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = '#7dd3fc'; ctx.shadowBlur = 10; ctx.shadowColor = '#38bdf8';
            ctx.fillText('⚡ FORMULA BEAM', W / 2, H - 30);
            // Countdown bar
            ctx.globalAlpha = globalA * 0.75;
            ctx.fillStyle = '#1e3a5f';
            ctx.fillRect(W / 2 - 70, H - 18, 140, 6);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(W / 2 - 70, H - 18, 140 * fbHudP, 6);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    },


    // ── Private ────────────────────────────────────────────────
    _initCells() {
        this.cells = []; this._indices = [];
        const half = (_DC.COLS * _DC.CELL_SIZE) / 2;
        const R = _DC.ARENA_RADIUS;
        const halfCell = _DC.CELL_SIZE / 2;
        for (let r = 0; r < _DC.ROWS; r++)
            for (let col = 0; col < _DC.COLS; col++) {
                const wx = this.originX - half + col * _DC.CELL_SIZE;
                const wy = this.originY - half + r * _DC.CELL_SIZE;
                // Cull cells outside arena circle
                const ccx = wx + halfCell, ccy = wy + halfCell;
                if (Math.hypot(ccx - this.originX, ccy - this.originY) > R) continue;
                this.cells.push({ wx, wy, dangerous: false, exploded: false });
            }
        this._indices = new Array(this.cells.length);
    },
    _rollCells() {
        const dangerPct = Math.min(_DC.DANGER_PCT_MAX, _DC.DANGER_PCT + this.cycleCount * _DC.DANGER_PCT_STEP);
        const n = this.cells.length, dangCount = Math.floor(n * dangerPct);
        for (let i = 0; i < n; i++) this._indices[i] = i;
        _shuffle(this._indices);
        for (let i = 0; i < n; i++) {
            this.cells[this._indices[i]].dangerous = i < dangCount;
            this.cells[this._indices[i]].exploded = false;
        }
    },
    _initRain() {
        this._rain = [];
        for (let i = 0; i < _DC.RAIN_COLS; i++) {
            const len = 8 + Math.floor(Math.random() * 10);
            this._rain.push({
                xNorm: Math.random(),
                offsetY: Math.random() * 600,
                speed: 0.6 + Math.random() * 0.9,
                alpha: 0.25 + Math.random() * 0.35,
                chars: Array.from({ length: len }, _rainChar),
            });
        }
    },
    _doExplosions(player) {
        for (const cell of this.cells) {
            if (!cell.dangerous) continue;
            cell.exploded = true;
            const cx = cell.wx + _DC.CELL_SIZE / 2, cy = cell.wy + _DC.CELL_SIZE / 2;
            if (typeof spawnParticles === 'function') {
                spawnParticles(cx, cy, 14, '#ef4444');
                spawnParticles(cx, cy, 8, '#facc15');
                spawnParticles(cx, cy, 5, '#d946ef');
            }
            // Spawn screen-space shockwave rings (converted to screen coords in draw)
            this._cellShockwaves.push({ wx: cx, wy: cy, r: 5, maxR: _DC.CELL_SIZE * 0.9, alpha: 1 });
            this._cellShockwaves.push({ wx: cx, wy: cy, r: 5, maxR: _DC.CELL_SIZE * 1.4, alpha: 0.6 });
            if (player && !player.dead) {
                const pd = Math.hypot(player.x - cx, player.y - cy);
                if (pd < _DC.CELL_SIZE * _DC.HIT_RADIUS) {
                    player.takeDamage(_DC.CELL_DAMAGE);
                    // Apply slow debuff
                    if (!player._domainSlowActive) {
                        player._domainSlowActive = true;
                        player._domainSlowTimer = _DC.CELL_SLOW_DUR;
                        player._domainSlowBase = player.moveSpeed;
                        player.moveSpeed *= _DC.CELL_SLOW_FACTOR;
                    } else {
                        player._domainSlowTimer = _DC.CELL_SLOW_DUR; // refresh
                    }
                    if (typeof spawnFloatingText === 'function') {
                        spawnFloatingText(`💥 ${_DC.CELL_DAMAGE}`, player.x, player.y - 55, '#ef4444', 20);
                        spawnFloatingText('🔮 SLOWED!', player.x, player.y - 80, '#d946ef', 18);
                    }
                    if (typeof addScreenShake === 'function') addScreenShake(10);
                    if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
                    // Screen flash
                    DomainExpansion._flashTimer = 0.12;
                }
            }
        }
    },
    _initDrift() {
        this._driftParticles = [];
        const R = _DC.ARENA_RADIUS;
        for (let i = 0; i < _DC.DRIFT_COUNT; i++) {
            const a = Math.random() * Math.PI * 2;
            const dist = Math.sqrt(Math.random()) * R * 0.82;
            const speed = 30 + Math.random() * 55;
            const vAngle = Math.random() * Math.PI * 2;
            this._driftParticles.push({
                x: Math.cos(a) * dist, y: Math.sin(a) * dist,
                vx: Math.cos(vAngle) * speed, vy: Math.sin(vAngle) * speed,
                r: 1.2 + Math.random() * 3.2,
                alpha: 0.12 + Math.random() * 0.38,
                gold: Math.random() < 0.35,
                phase: Math.random() * Math.PI * 2,
            });
        }
    },

    _abort(boss) {
        this.phase = 'idle'; this.cooldownTimer = 0;
        this.cells = []; this._crackLines = []; this._flashTimer = 0;
        this._driftParticles = []; this._voidPulses = [];
        this._formulaBeam = null; this._cellShockwaves = [];
        this._bgAngle = 0; this._portalProgress = 0;
        if (boss) { boss._domainCasting = false; boss._domainActive = false; }
        console.log('[DomainExpansion] Aborted — boss dead');
    },
};

window.DomainExpansion = DomainExpansion;
DomainExpansion._DC_RADIUS = _DC.ARENA_RADIUS; // exposed for base.js applyPhysics

// ─── Node/bundler export ──────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BarkWave, GoldfishMinion, BubbleProjectile, FreeFallWarningRing, PorkSandwich, ExpandingRing, MatrixGridAttack, EmpPulse };
}
// ── Global exports ────────────────────────────────────────────
window.BarkWave = BarkWave;
window.GoldfishMinion = GoldfishMinion;
window.BubbleProjectile = BubbleProjectile;
window.FreeFallWarningRing = FreeFallWarningRing;
window.PorkSandwich = PorkSandwich;
window.ExpandingRing = ExpandingRing;
window.MatrixGridAttack = MatrixGridAttack;
window.EmpPulse = EmpPulse;