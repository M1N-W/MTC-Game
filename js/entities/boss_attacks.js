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
 *   PorkSandwich       — Interactive parry projectile (BossFirst)
 *   FreeFallWarningRing — Visual AoE warning indicator (BossFirst)
 */

// ════════════════════════════════════════════════════════════
// 🌊 BARK WAVE — Sonic cone emitted by Boss's bark attack
// ════════════════════════════════════════════════════════════
class BarkWave {
    constructor(x, y, angle, coneHalf, range) {
        this.x        = x;
        this.y        = y;
        this.angle    = angle;
        this.coneHalf = coneHalf;
        this.range    = range;
        this.timer    = 0;
        this.duration = 0.55;
        this.rings    = 5;
    }

    update(dt) {
        this.timer += dt;
        return this.timer >= this.duration;
    }

    draw() {
        const screen   = worldToScreen(this.x, this.y);
        const progress = this.timer / this.duration;
        const alpha    = 1 - progress;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        for (let i = 0; i < this.rings; i++) {
            const frac = (progress + i / this.rings) % 1;
            const r    = frac * this.range;
            if (r < 4) continue;
            const ringAlpha = alpha * (1 - i / this.rings) * 0.75;
            if (ringAlpha <= 0) continue;
            CTX.save();
            CTX.globalAlpha = ringAlpha;
            CTX.strokeStyle = i % 2 === 0 ? '#f59e0b' : '#fbbf24';
            CTX.lineWidth   = Math.max(1, 3.5 - i * 0.5);
            CTX.shadowBlur  = 12;
            CTX.shadowColor = '#d97706';
            CTX.lineCap     = 'round';
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
            CTX.fillStyle   = '#fbbf24';
            CTX.shadowBlur  = 20;
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
        this.maxHp      = cfg.hp;
        this.hp         = cfg.hp;
        this.moveSpeed  = cfg.speed;
        this.damage     = cfg.damage;
        this.wobbleAmp  = cfg.wobbleAmp;
        this.wobbleFreq = cfg.wobbleFreq;
        this.lifeTimer  = 0;
        this._perpX     = 0;
        this._perpY     = 0;
        this.name       = '🐟';
    }

    update(dt, player) {
        if (this.dead) return;

        this.lifeTimer += dt;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d  = Math.hypot(dx, dy);

        if (d > 0) {
            this.angle  = Math.atan2(dy, dx);
            this._perpX = -dy / d;
            this._perpY =  dx / d;

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
        const screen       = worldToScreen(this.x, this.y);
        const now          = Date.now();
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        if (isFacingLeft) CTX.scale(-1, 1);

        const breathe = Math.sin(now / 140);
        CTX.scale(1 + breathe * 0.040, 1 - breathe * 0.025);

        const cfg = BALANCE.boss.goldfishMinion;
        const r   = cfg.radius;

        // Outer glow
        CTX.shadowBlur  = 12; CTX.shadowColor = '#fb923c';
        CTX.strokeStyle = 'rgba(251,146,60,0.60)'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(0, 0, r + 2, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur  = 0;

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
        bodyG.addColorStop(0,    '#fb923c');
        bodyG.addColorStop(0.55, '#f97316');
        bodyG.addColorStop(1,    '#c2410c');
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
        const snoutX    = r * 0.78;
        CTX.fillStyle   = '#1e293b';
        CTX.beginPath();
        CTX.moveTo(snoutX, -r * 0.18);
        CTX.lineTo(r * 1.15, 0);
        CTX.lineTo(snoutX,  r * 0.18);
        CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#f8fafc'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.2;
        const teethCount = 3;
        const toothSpan  = r * 0.30;
        for (let ti = 0; ti < teethCount; ti++) {
            const ty = -r * 0.14 + ti * (toothSpan / (teethCount - 1));
            CTX.beginPath();
            CTX.moveTo(snoutX, ty - r * 0.04);
            CTX.lineTo(r * 1.08, ty + r * 0.01);
            CTX.lineTo(snoutX,  ty + r * 0.04);
            CTX.closePath(); CTX.fill(); CTX.stroke();
        }
        for (let ti = 0; ti < 2; ti++) {
            const ty = r * 0.06 + ti * (toothSpan * 0.5);
            CTX.beginPath();
            CTX.moveTo(snoutX,   ty - r * 0.03);
            CTX.lineTo(r * 1.06, ty + r * 0.01);
            CTX.lineTo(snoutX,   ty + r * 0.03);
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
        const cfg      = BALANCE.boss.bubbleProjectile;
        this.x         = x;
        this.y         = y;
        this.vx        = Math.cos(angle) * cfg.speed;
        this.vy        = Math.sin(angle) * cfg.speed;
        this.radius    = cfg.radius;
        this.damage    = cfg.damage;
        this.angle     = angle;
        this.dead      = false;
        this.lifeTimer = 0;
        this.maxLife   = 6;
    }

    update(dt, player) {
        if (this.dead) return true;

        this.x         += this.vx * dt;
        this.y         += this.vy * dt;
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
                player._bubbleSlowApplied   = true;
                player._baseMoveSpeedBubble = player.moveSpeed;
                player.moveSpeed            = player.moveSpeed * P3.slowFactor;
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
        const r      = this.radius;
        const pulse  = Math.sin(this.lifeTimer * 4) * 0.08 + 1;

        CTX.save();
        CTX.translate(screen.x, screen.y);

        CTX.shadowBlur  = 18;
        CTX.shadowColor = '#38bdf8';
        CTX.fillStyle   = 'rgba(186, 230, 253, 0.35)';
        CTX.beginPath(); CTX.arc(0, 0, r * pulse, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = 'rgba(125, 211, 252, 0.8)'; CTX.lineWidth = 2; CTX.stroke();

        CTX.shadowBlur  = 0;
        CTX.fillStyle   = 'rgba(255, 255, 255, 0.7)';
        CTX.beginPath(); CTX.ellipse(-r * 0.3, -r * 0.3, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.5)';
        CTX.beginPath(); CTX.arc(-r * 0.1, r * 0.35, r * 0.07, 0, Math.PI * 2); CTX.fill();

        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🥪 PORK SANDWICH — Interactive parry projectile (BossFirst)
// Normal:  player catches → +35 HP + speed boost → boss BERSERK
// Parried: dash-parry reverses it → hits boss → boss STUNNED
// ════════════════════════════════════════════════════════════
class PorkSandwich {
    constructor(x, y, angle, boss) {
        this.x         = x;
        this.y         = y;
        this.vx        = Math.cos(angle) * 340;
        this.vy        = Math.sin(angle) * 340;
        this.radius    = 16;
        this.angle     = angle;
        this.dead      = false;
        this.parried   = false;
        this.lifeTimer = 0;
        this._boss     = boss;
        this._spinT    = 0;
    }

    update(dt, player) {
        if (this.dead) return true;
        this.lifeTimer += dt;
        this._spinT    += dt * 5;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.lifeTimer > 4.0) { this.dead = true; return true; }

        // Dash-parry check
        if (!this.parried && player._parryActive) {
            const d = Math.hypot(player.x - this.x, player.y - this.y);
            if (d < this.radius + player.radius + 20) {
                this.tryParry();
                return false;
            }
        }

        // Hit player (unparried)
        if (!this.parried) {
            const dp = Math.hypot(player.x - this.x, player.y - this.y);
            if (dp < this.radius + player.radius) {
                const healAmt = 35;
                player.hp = Math.min(player.maxHp, player.hp + healAmt);
                spawnFloatingText(`+${healAmt} HP 🥪 yummy!`, player.x, player.y - 55, '#fbbf24', 24);
                if (!player._sandwichBoostActive) {
                    player._sandwichOrigSpeed   = player.moveSpeed;
                    player._sandwichBoostActive = true;
                    player.moveSpeed           *= 1.45;
                    setTimeout(() => {
                        if (player._sandwichBoostActive) {
                            player.moveSpeed        = player._sandwichOrigSpeed;
                            player._sandwichBoostActive = false;
                        }
                    }, 4000);
                }
                spawnFloatingText('⚡ SPEED BOOST!', player.x, player.y - 80, '#fbbf24', 20);
                spawnParticles(player.x, player.y, 14, '#fbbf24');
                if (this._boss && !this._boss.dead) {
                    this._boss.isEnraged = true;
                    this._boss._enterState('BERSERK');
                    spawnFloatingText('😡 BERSERK!', this._boss.x, this._boss.y - 80, '#ef4444', 30);
                    addScreenShake(12);
                }
                this.dead = true;
                return true;
            }
        }

        // Parried — hits boss
        if (this.parried && this._boss && !this._boss.dead) {
            const db = Math.hypot(this._boss.x - this.x, this._boss.y - this.y);
            if (db < this.radius + this._boss.radius) {
                this._boss._enterState('STUNNED');
                spawnFloatingText('🥪 PARRY! STUNNED!', this._boss.x, this._boss.y - 80, '#39ff14', 30);
                spawnParticles(this._boss.x, this._boss.y, 20, '#39ff14');
                addScreenShake(10);
                this.dead = true;
                return true;
            }
        }

        return false;
    }

    tryParry() {
        this.parried = true;
        if (this._boss && !this._boss.dead) {
            const ba = Math.atan2(this._boss.y - this.y, this._boss.x - this.x);
            this.vx  = Math.cos(ba) * 480;
            this.vy  = Math.sin(ba) * 480;
        } else {
            this.vx = -this.vx * 1.4;
            this.vy = -this.vy * 1.4;
        }
        spawnFloatingText('🥪 PARRIED!', this.x, this.y - 40, '#39ff14', 26);
        spawnParticles(this.x, this.y, 10, '#39ff14');
        addScreenShake(6);
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this._spinT);

        const r = this.radius;

        if (this.parried) {
            CTX.shadowBlur  = 18;
            CTX.shadowColor = '#39ff14';
            CTX.strokeStyle = 'rgba(57,255,20,0.6)';
            CTX.lineWidth   = 2.5;
            CTX.beginPath(); CTX.arc(0, 0, r + 5, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur  = 0;
        }

        // Bun top
        CTX.fillStyle = '#d97706';
        CTX.beginPath(); CTX.ellipse(0, -r * 0.25, r, r * 0.55, 0, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#92400e'; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.ellipse(0, -r * 0.25, r, r * 0.55, 0, 0, Math.PI * 2); CTX.stroke();

        // Sesame seeds
        CTX.fillStyle = '#fef3c7';
        for (let si = 0; si < 5; si++) {
            const sa = (si / 5) * Math.PI * 2;
            CTX.beginPath();
            CTX.ellipse(Math.cos(sa) * r * 0.52, -r * 0.25 + Math.sin(sa) * r * 0.28, 2.2, 1.2, sa, 0, Math.PI * 2);
            CTX.fill();
        }

        // Pork + sauce
        CTX.fillStyle = '#c2410c';
        CTX.beginPath(); CTX.ellipse(0, r * 0.05, r * 0.88, r * 0.28, 0, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#dc2626';
        CTX.beginPath(); CTX.ellipse(r * 0.2, r * 0.15, r * 0.12, r * 0.20, 0.3, 0, Math.PI * 2); CTX.fill();

        // Bun bottom
        CTX.fillStyle = '#b45309';
        CTX.beginPath(); CTX.ellipse(0, r * 0.38, r * 0.92, r * 0.38, 0, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#92400e'; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.ellipse(0, r * 0.38, r * 0.92, r * 0.38, 0, 0, Math.PI * 2); CTX.stroke();

        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// ⚠️  FREE FALL WARNING RING — AoE visual indicator (BossFirst)
// ════════════════════════════════════════════════════════════
class FreeFallWarningRing {
    constructor(x, y, duration) {
        this.x        = x;
        this.y        = y;
        this.duration = duration;
        this.timer    = 0;
        this.dead     = false;
        this.radius   = 140;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration) { this.dead = true; return true; }
        return false;
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const prog   = this.timer / this.duration;
        const pulse  = 0.5 + Math.sin(this.timer * 12) * 0.45;
        const alpha  = (1 - prog * 0.4) * pulse;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.shadowBlur   = 20 * pulse;
        CTX.shadowColor  = '#ef4444';
        CTX.strokeStyle  = `rgba(239,68,68,${alpha})`;
        CTX.lineWidth    = 3;
        CTX.setLineDash([12, 8]);
        CTX.beginPath(); CTX.arc(0, 0, this.radius * (0.85 + prog * 0.15), 0, Math.PI * 2); CTX.stroke();
        CTX.setLineDash([]);
        CTX.shadowBlur   = 0;
        CTX.font         = 'bold 22px Arial';
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.globalAlpha  = alpha;
        CTX.fillText('⚠️', 0, 0);
        CTX.globalAlpha  = 1;
        CTX.restore();
    }
}

// ─── Node/bundler export ──────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BarkWave, GoldfishMinion, BubbleProjectile, PorkSandwich, FreeFallWarningRing };
}
// ── Global exports ────────────────────────────────────────────
window.BarkWave            = BarkWave;
window.GoldfishMinion      = GoldfishMinion;
window.BubbleProjectile    = BubbleProjectile;
window.PorkSandwich        = PorkSandwich;
window.FreeFallWarningRing = FreeFallWarningRing;