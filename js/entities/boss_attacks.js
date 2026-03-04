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

        // Main body gradient — Cyber-Mutant silver/white
        const bodyG = CTX.createRadialGradient(-r * 0.1, -r * 0.2, 1, 0, 0, r);
        bodyG.addColorStop(0, '#ffffff');
        bodyG.addColorStop(0.55, '#e2e8f0');
        bodyG.addColorStop(1, '#94a3b8');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#475569'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.stroke();

        // Belly + specular
        CTX.fillStyle = 'rgba(186,230,253,0.45)';
        CTX.beginPath(); CTX.ellipse(r * 0.15, r * 0.20, r * 0.42, r * 0.28, 0, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.40)';
        CTX.beginPath(); CTX.arc(-r * 0.28, -r * 0.28, r * 0.22, 0, Math.PI * 2); CTX.fill();

        // Scales
        CTX.strokeStyle = 'rgba(100,116,139,0.45)'; CTX.lineWidth = 1.2;
        for (let si = 0; si < 3; si++) {
            const sx = -r * 0.2 + si * r * 0.28;
            CTX.beginPath(); CTX.arc(sx, r * 0.15, r * 0.30, Math.PI, Math.PI * 2); CTX.stroke();
            CTX.beginPath(); CTX.arc(sx + r * 0.14, -r * 0.15, r * 0.30, Math.PI, Math.PI * 2); CTX.stroke();
        }

        // Cyber vein line — glowing cyan circuit
        CTX.strokeStyle = '#38bdf8'; CTX.lineWidth = 1.8;
        CTX.shadowBlur = 6; CTX.shadowColor = '#38bdf8';
        CTX.beginPath(); CTX.moveTo(-r * 0.55, 0); CTX.lineTo(r * 0.30, 0); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-r * 0.10, 0); CTX.lineTo(-r * 0.10, -r * 0.30); CTX.stroke();
        CTX.shadowBlur = 0;

        // Robotic red eye (replaces the plain eye)
        CTX.fillStyle = '#ef4444';
        CTX.shadowBlur = 10; CTX.shadowColor = '#dc2626';
        CTX.beginPath(); CTX.arc(r * 0.52, -r * 0.28, 3.5, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#ffffff'; CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.arc(r * 0.56, -r * 0.32, 1.2, 0, Math.PI * 2); CTX.fill();

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
// 💠 DOMAIN EXPANSION: METRICS-MAJOR
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

        boss._domainCasting = true;
        boss._domainActive = true;

        if (typeof addScreenShake === 'function') addScreenShake(14);
        if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
        if (typeof spawnFloatingText === 'function') {
            spawnFloatingText('領域展開', boss.x, boss.y - 130, '#d946ef', 50);
            setTimeout(() => spawnFloatingText('Metrics-Major', boss.x, boss.y - 185, '#facc15', 34), 700);
        }
        if (window.UIManager && typeof window.UIManager.showVoiceBubble === 'function') {
            window.UIManager.showVoiceBubble('領域展開...', boss.x, boss.y - 50);
            setTimeout(() => { if (window.UIManager) window.UIManager.showVoiceBubble('Metrics-Major!!', boss.x, boss.y - 50); }, 950);
        }
        if (typeof spawnParticles === 'function') {
            spawnParticles(boss.x, boss.y, 35, '#d946ef');
            spawnParticles(boss.x, boss.y, 20, '#facc15');
            spawnParticles(boss.x, boss.y, 15, '#ffffff');
        }
        console.log('[DomainExpansion] 💠 Metrics-Major TRIGGERED');
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
                        // Boss volley on cycle 3+
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
                        ctx.globalAlpha = globalA * ef * 0.98;
                        // White-hot centre → orange → transparent
                        const eg = ctx.createRadialGradient(mx, my, 0, mx, my, sw * 0.72);
                        eg.addColorStop(0, `rgba(255,255,220,${ef})`);
                        eg.addColorStop(0.4, `rgba(239,68,68,${ef * 0.9})`);
                        eg.addColorStop(1, `rgba(217,70,239,0)`);
                        ctx.fillStyle = eg;
                        ctx.fillRect(tl.x, tl.y, sw, sh);
                        // Bright border
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
                        ctx.shadowBlur = 18; ctx.shadowColor = '#ef4444';
                        ctx.globalAlpha = globalA * ef * 0.85;
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

        // ── 5. Casting animation ─────────────────────────────
        if (this.phase === 'casting') {
            const elapsed = _DC.CAST_DUR - this.timer;
            const ringScreen = worldToScreen(this.originX, this.originY);

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
            // Metrics-Major subtitle
            if (elapsed > 1.05) {
                const tb = Math.min(1.0, (elapsed - 1.05) / 0.55);
                ctx.globalAlpha = globalA * tb;
                ctx.font = `900 ${Math.round(36 * (0.88 + tb * 0.12))}px "Orbitron","Bebas Neue",Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowBlur = 28; ctx.shadowColor = '#facc15';
                ctx.fillStyle = '#fef08a';
                ctx.fillText('Metrics-Major', W / 2, H / 2 + 28);
                ctx.shadowBlur = 0;
                // Underline sweep
                ctx.globalAlpha = globalA * tb * 0.8;
                ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
                const ulW = tb * 280;
                ctx.beginPath(); ctx.moveTo(W / 2 - ulW / 2, H / 2 + 50); ctx.lineTo(W / 2 + ulW / 2, H / 2 + 50); ctx.stroke();
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

        // ── 7. Slow debuff HUD indicator ─────────────────────
        if (typeof window !== 'undefined' && window.player && window.player._domainSlowActive) {
            const slowPulse = 0.5 + Math.sin(now * 6) * 0.5;
            ctx.globalAlpha = globalA * 0.28 * slowPulse;
            ctx.fillStyle = '#d946ef';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = globalA * (0.6 + slowPulse * 0.35);
            ctx.font = 'bold 14px "Orbitron",Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#f0abfc';
            ctx.shadowBlur = 12; ctx.shadowColor = '#d946ef';
            ctx.fillText('🔮 SLOWED', W / 2, 12);
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
                spawnParticles(cx, cy, 10, '#ef4444');
                spawnParticles(cx, cy, 5, '#facc15');
            }
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
    _abort(boss) {
        this.phase = 'idle'; this.cooldownTimer = 0;
        this.cells = []; this._crackLines = []; this._flashTimer = 0;
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