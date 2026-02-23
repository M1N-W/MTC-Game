'use strict';
/**
 * js/entities/boss_attacks.js
 *
 * All projectiles, effects, and minions spawned BY bosses.
 * Boss entity classes (Boss, BossDog, BossFirst) live in boss.js.
 *
 * Load order: must be loaded BEFORE boss.js
 *
 * ── Contents ────────────────────────────────────────────────
 *   BarkWave           — Sonic cone from Boss bark (Phase 2)
 *   GoldfishMinion     — Kamikaze sine-wave chaser (Phase 3)
 *   BubbleProjectile   — Slow AoE projectile (Phase 3)
 *   FreeFallWarningRing — Visual AoE warning indicator (BossFirst)
 */

// ════════════════════════════════════════════════════════════
// 🌊 BARK WAVE — Sonic cone emitted by Boss's bark attack
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
        const now = Date.now();
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        if (isFacingLeft) CTX.scale(-1, 1);

        const breathe = Math.sin(now / 140);
        CTX.scale(1 + breathe * 0.040, 1 - breathe * 0.025);

        const cfg = BALANCE.boss.goldfishMinion;
        const r = cfg.radius;

        // Outer glow
        CTX.shadowBlur = 12; CTX.shadowColor = '#fb923c';
        CTX.strokeStyle = 'rgba(251,146,60,0.60)'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(0, 0, r + 2, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // Tail fins
        const tailWag = Math.sin(now / 100) * 0.35;
        CTX.fillStyle = '#ea580c'; CTX.shadowBlur = 8; CTX.shadowColor = '#f97316';
        CTX.beginPath();
        CTX.moveTo(-r * 0.85, 0);
        CTX.quadraticCurveTo(-r * 1.70 + Math.cos(tailWag) * 6, -r * 1.00, -r * 2.20 + Math.sin(tailWag) * 4, -r * 0.80);
        CTX.quadraticCurveTo(-r * 1.60, -r * 0.25, -r * 0.85, 0);
        CTX.closePath(); CTX.fill();
        CTX.beginPath();
        CTX.moveTo(-r * 0.85, 0);
        CTX.quadraticCurveTo(-r * 1.70 - Math.cos(tailWag) * 6, r * 1.00, -r * 2.20 - Math.sin(tailWag) * 4, r * 0.80);
        CTX.quadraticCurveTo(-r * 1.60, r * 0.25, -r * 0.85, 0);
        CTX.closePath(); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(-r * 0.85, 0);
        CTX.quadraticCurveTo(-r * 1.70 + Math.cos(tailWag) * 6, -r * 1.00, -r * 2.20 + Math.sin(tailWag) * 4, -r * 0.80);
        CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(-r * 0.85, 0);
        CTX.quadraticCurveTo(-r * 1.70 - Math.cos(tailWag) * 6, r * 1.00, -r * 2.20 - Math.sin(tailWag) * 4, r * 0.80);
        CTX.stroke();
        CTX.shadowBlur = 0;

        // Dorsal fin
        const dorsalWave = Math.sin(now / 130) * 0.3;
        CTX.fillStyle = '#f97316'; CTX.shadowBlur = 6; CTX.shadowColor = '#fb923c';
        CTX.beginPath();
        CTX.moveTo(-r * 0.25, -r * 0.85);
        CTX.quadraticCurveTo(r * 0.1 + dorsalWave * 5, -r * 1.80, r * 0.55, -r * 0.85);
        CTX.lineTo(-r * 0.25, -r * 0.85);
        CTX.closePath(); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.8;
        CTX.beginPath();
        CTX.moveTo(-r * 0.25, -r * 0.85);
        CTX.quadraticCurveTo(r * 0.1 + dorsalWave * 5, -r * 1.80, r * 0.55, -r * 0.85);
        CTX.stroke();
        CTX.shadowBlur = 0;

        // Pectoral fins
        CTX.fillStyle = '#ea580c'; CTX.shadowBlur = 4; CTX.shadowColor = '#fb923c';
        CTX.beginPath();
        CTX.moveTo(r * 0.05, -r * 0.45);
        CTX.quadraticCurveTo(r * 0.55, -r * 0.90, r * 0.60, -r * 0.45);
        CTX.quadraticCurveTo(r * 0.30, -r * 0.25, r * 0.05, -r * 0.45);
        CTX.closePath(); CTX.fill();
        CTX.beginPath();
        CTX.moveTo(r * 0.05, r * 0.45);
        CTX.quadraticCurveTo(r * 0.55, r * 0.90, r * 0.60, r * 0.45);
        CTX.quadraticCurveTo(r * 0.30, r * 0.25, r * 0.05, r * 0.45);
        CTX.closePath(); CTX.fill();
        CTX.shadowBlur = 0;

        // Main body gradient
        const bodyG = CTX.createRadialGradient(-r * 0.1, -r * 0.2, 1, 0, 0, r);
        bodyG.addColorStop(0, '#fb923c');
        bodyG.addColorStop(0.55, '#f97316');
        bodyG.addColorStop(1, '#c2410c');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.stroke();

        // Belly + specular
        CTX.fillStyle = 'rgba(254,215,170,0.55)';
        CTX.beginPath(); CTX.ellipse(r * 0.15, r * 0.20, r * 0.42, r * 0.28, 0, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.20)';
        CTX.beginPath(); CTX.arc(-r * 0.28, -r * 0.28, r * 0.22, 0, Math.PI * 2); CTX.fill();

        // Scales
        CTX.strokeStyle = 'rgba(234,88,12,0.45)'; CTX.lineWidth = 1.2;
        for (let si = 0; si < 3; si++) {
            const sx = -r * 0.2 + si * r * 0.28;
            CTX.beginPath(); CTX.arc(sx, r * 0.15, r * 0.30, Math.PI, Math.PI * 2); CTX.stroke();
            CTX.beginPath(); CTX.arc(sx + r * 0.14, -r * 0.15, r * 0.30, Math.PI, Math.PI * 2); CTX.stroke();
        }

        // Teeth
        const snoutX = r * 0.78;
        CTX.fillStyle = '#1e293b';
        CTX.beginPath();
        CTX.moveTo(snoutX, -r * 0.18);
        CTX.lineTo(r * 1.15, 0);
        CTX.lineTo(snoutX, r * 0.18);
        CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#f8fafc'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.2;
        const teethCount = 3;
        const toothSpan = r * 0.30;
        for (let ti = 0; ti < teethCount; ti++) {
            const ty = -r * 0.14 + ti * (toothSpan / (teethCount - 1));
            CTX.beginPath();
            CTX.moveTo(snoutX, ty - r * 0.04);
            CTX.lineTo(r * 1.08, ty + r * 0.01);
            CTX.lineTo(snoutX, ty + r * 0.04);
            CTX.closePath(); CTX.fill(); CTX.stroke();
        }
        for (let ti = 0; ti < 2; ti++) {
            const ty = r * 0.06 + ti * (toothSpan * 0.5);
            CTX.beginPath();
            CTX.moveTo(snoutX, ty - r * 0.03);
            CTX.lineTo(r * 1.06, ty + r * 0.01);
            CTX.lineTo(snoutX, ty + r * 0.03);
            CTX.closePath(); CTX.fill(); CTX.stroke();
        }

        // Angry brow
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5; CTX.lineCap = 'round';
        CTX.beginPath();
        CTX.moveTo(r * 0.48, -r * 0.55);
        CTX.lineTo(r * 0.85, -r * 0.35);
        CTX.stroke();

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
        this.damage = BALANCE.boss.contactDamage * 5;
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

// ─── Node/bundler export ──────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BarkWave, GoldfishMinion, BubbleProjectile, FreeFallWarningRing, PorkSandwich, ExpandingRing };
}
// ── Global exports ────────────────────────────────────────────
window.BarkWave = BarkWave;
window.GoldfishMinion = GoldfishMinion;
window.BubbleProjectile = BubbleProjectile;
window.FreeFallWarningRing = FreeFallWarningRing;
window.PorkSandwich = PorkSandwich;
window.ExpandingRing = ExpandingRing;