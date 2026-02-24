'use strict';
/**
 * js/entities/enemy.js
 *
 * ► Enemy      — Basic grunt
 * ► TankEnemy  — Heavy melee bruiser
 * ► MageEnemy  — Ranged caster (confusion + meteor)
 * ► PowerUp    — Loot drop (collected by player)
 *
 * Depends on: base.js (Entity)
 *
 * ────────────────────────────────────────────────────────────────
 * COMBAT FEEDBACK ADDITIONS (Lead Gameplay Developer pass)
 * ────────────────────────────────────────────────────────────────
 * ✅ HIT FLASH — All three enemy classes (Enemy, TankEnemy, MageEnemy)
 * now implement a white-silhouette flash whenever takeDamage() is called:
 *
 * Construction:  this.hitFlashTimer = 0;
 * On damage:     this.hitFlashTimer = HIT_FLASH_DURATION;   // 0.10 s
 * In update():   if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
 * In draw():     a full-coverage white shape (matching the enemy's silhouette)
 * is painted on top of the normal sprite at up to 75 % alpha,
 * linearly fading to 0 over the flash duration.
 *
 * The flash duration constant HIT_FLASH_DURATION = 0.10 s (≈ 6 frames at
 * 60 fps) sits at the top of this file so it can be tuned centrally.
 *
 * Draw implementation uses `CTX.save()/restore()` so no canvas state
 * leaks into the health-bar drawing that immediately follows.
 *
 * ────────────────────────────────────────────────────────────────
 * BALANCE — GLITCH WAVE DAMAGE REDUCTION (Balance Designer pass)
 * ────────────────────────────────────────────────────────────────
 * ✅ GLITCH WAVE MITIGATION — When window.isGlitchWave is true (set by
 * game.js whenever a Glitch Wave is in progress), all melee contact
 * damage dealt to the player by Enemy and TankEnemy is multiplied by
 * GLITCH_DAMAGE_MULT (0.6), giving a 40 % reduction.
 *
 * Rationale: Glitch Waves already invert player controls and spawn a
 * double horde; reducing contact damage prevents unavoidable death
 * from disorientation without removing the tension of the mechanic.
 *
 * window.isGlitchWave is a boolean synced by game.js on every state
 * change; reading it here via window avoids any import/scope coupling.
 */

// ─── Tunable: seconds a hit-flash stays at full opacity before fading out ───
// At 0.10 s (≈ 6 frames @ 60 fps) the flash is snappy but legible.
const HIT_FLASH_DURATION = 0.10;

// ─── Tunable: enemy contact damage multiplier during a Glitch Wave ──────────
// 0.6 = 40 % reduction. Applies only to melee contact (not projectiles).
const GLITCH_DAMAGE_MULT = 0.6;

// ════════════════════════════════════════════════════════════
// ENEMIES
// ════════════════════════════════════════════════════════════
class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, BALANCE.enemy.radius);
        // Exponential HP scaling: baseHp * ((1 + hpPerWave)^wave)
        // Uses config values for proper balance tuning
        const hpGrowth = 1 + BALANCE.enemy.hpPerWave;
        this.maxHp = Math.floor(BALANCE.enemy.baseHp * Math.pow(hpGrowth, getWave()));
        this.hp = this.maxHp;
        this.speed = BALANCE.enemy.baseSpeed + getWave() * BALANCE.enemy.speedPerWave;
        this.damage = BALANCE.enemy.baseDamage + getWave() * BALANCE.enemy.damagePerWave;
        this.shootTimer = rand(...BALANCE.enemy.shootCooldown);
        this.color = randomChoice(BALANCE.enemy.colors);
        this.type = 'basic'; this.expValue = BALANCE.enemy.expValue;

        // ── Hit flash state ──────────────────────────────────
        // Seconds remaining on the white-silhouette flash.
        // Set to HIT_FLASH_DURATION on every takeDamage() call.
        // Decays in update(); drawn in draw() if > 0.
        this.hitFlashTimer = 0;
    }

    update(dt, player) {
        if (this.dead) return;

        // ── Tick hit-flash timer ─────────────────────────────
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

        const dx = player.x - this.x, dy = player.y - this.y;
        const d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        if (d > BALANCE.enemy.chaseRange && !player.isInvisible) {
            this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
        } else { this.vx *= 0.9; this.vy *= 0.9; }
        this.applyPhysics(dt);
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && d < BALANCE.enemy.shootRange && !player.isInvisible) {
            projectileManager.add(new Projectile(this.x, this.y, this.angle, BALANCE.enemy.projectileSpeed, this.damage, '#fff', false, 'enemy'));
            this.shootTimer = rand(...BALANCE.enemy.shootCooldown);
        }

        // ── Melee contact damage ─────────────────────────────
        // During a Glitch Wave, reduce contact damage by 40 % to keep the
        // inverted-controls chaos survivable without removing the threat.
        if (d < this.radius + player.radius) {
            const contactDamage = this.damage * dt * 3;
            const glitchMult = window.isGlitchWave ? GLITCH_DAMAGE_MULT : 1.0;
            player.takeDamage(contactDamage * glitchMult);
        }
    }

    takeDamage(amt, player) {
        this.hp -= amt;

        // ── Trigger hit flash ────────────────────────────────
        // Reset to full duration on every hit so rapid hits keep the flash active.
        this.hitFlashTimer = HIT_FLASH_DURATION;

        if (this.hp <= 0) {
            this.dead = true; this.hp = 0;
            spawnParticles(this.x, this.y, 20, this.color);
            addScore(BALANCE.score.basicEnemy * getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if (player) player.gainExp(this.expValue);
            
            // FIX (BUG-4): Correctly identify Kao and fetch weapon string key to allow Awakening
            if (player && player.charId === 'kao' && typeof player.addKill === 'function') {
                const wepKey = typeof weaponSystem !== 'undefined' ? (weaponSystem.currentWeapon || 'auto') : 'auto';
                const currentWep = BALANCE.characters.kao.weapons[wepKey];
                if (currentWep) player.addKill(currentWep.name);
            }
            
            Achievements.stats.kills++; Achievements.check('first_blood');
            if (Math.random() < BALANCE.powerups.dropRate) window.powerups.push(new PowerUp(this.x, this.y));
        }
    }

    draw() {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  BASIC ENEMY — Corrupted Student Drone                  ║
        // ║  Slim gray/purple bean · Red visor slit · Spiked hands  ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(this.x, this.y);
        const now = Date.now();
        const R = this.radius; // keep collision radius untouched
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        // ── Ground shadow ────────────────────────────────────────────
        CTX.save();
        CTX.globalAlpha = 0.22;
        CTX.fillStyle = 'rgba(0,0,0,0.8)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + R + 4, R * 0.9, 4, 0, 0, Math.PI * 2); CTX.fill();
        CTX.restore();

        // ── Body Block (Body Anti-Flip) ───────────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        if (isFacingLeft) CTX.scale(-1, 1);

        // Breathing: subtle Y-axis squash/stretch
        const breathe = Math.sin(now / 200);
        const scaleX = 1 + breathe * 0.028;
        const scaleY = 1 - breathe * 0.028;
        CTX.scale(scaleX, scaleY);

        // ── Outer glow ring (corrupted purple) ───────────────────────
        CTX.shadowBlur = 10; CTX.shadowColor = 'rgba(168,85,247,0.65)';
        CTX.strokeStyle = 'rgba(168,85,247,0.45)';
        CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(0, 0, R + 2, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Bean body — charcoal/gray-purple gradient ─────────────────
        const bodyG = CTX.createRadialGradient(-2, -2, 1, 0, 0, R);
        bodyG.addColorStop(0, '#4a4a6a');
        bodyG.addColorStop(0.6, '#2d2d44');
        bodyG.addColorStop(1, '#1a1a2e');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();

        // Thick sticker outline
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();

        // Specular highlight (top-left)
        CTX.fillStyle = 'rgba(255,255,255,0.10)';
        CTX.beginPath(); CTX.arc(-R * 0.35, -R * 0.35, R * 0.35, 0, Math.PI * 2); CTX.fill();

        // ── Red visor slit ────────────────────────────────────────────
        const visorPulse = 0.7 + Math.sin(now / 280) * 0.30;
        CTX.fillStyle = `rgba(239,68,68,${visorPulse})`;
        CTX.shadowBlur = 10 * visorPulse; CTX.shadowColor = '#ef4444';
        CTX.beginPath(); CTX.roundRect(R * 0.05, -R * 0.18, R * 0.65, R * 0.22, R * 0.06); CTX.fill();
        // Secondary dim glow bleed
        CTX.fillStyle = `rgba(239,68,68,${visorPulse * 0.18})`;
        CTX.beginPath(); CTX.roundRect(-R * 0.1, -R * 0.32, R * 0.9, R * 0.60, R * 0.18); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // end body transform

        // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        if (isFacingLeft) CTX.scale(1, -1);

        // ── Floating spiked hands (orbiting body, weapon-side + off-side) ──
        // Front hand — weapon-pointing side
        const handR = R * 0.38;
        CTX.fillStyle = '#3b3b55'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.shadowBlur = 5; CTX.shadowColor = 'rgba(168,85,247,0.5)';
        CTX.beginPath(); CTX.arc(R + 6, 2, handR, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        // Spike on front hand
        CTX.fillStyle = '#ef4444';
        CTX.beginPath();
        CTX.moveTo(R + 6 + handR, 2);
        CTX.lineTo(R + 6 + handR + 5, -1);
        CTX.lineTo(R + 6 + handR, 5);
        CTX.closePath(); CTX.fill();

        // Back hand — off-side
        CTX.fillStyle = '#2d2d44'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.shadowBlur = 3;
        CTX.beginPath(); CTX.arc(-(R + 5), 0, handR - 1, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        // Spike on back hand
        CTX.fillStyle = '#ef4444';
        CTX.beginPath();
        CTX.moveTo(-(R + 5 + handR - 1), 0);
        CTX.lineTo(-(R + 5 + handR - 1) - 5, -2);
        CTX.lineTo(-(R + 5 + handR - 1), 3);
        CTX.closePath(); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // end weapon block

        // ── Hit flash — white silhouette ─────────────────────────────
        if (this.hitFlashTimer > 0) {
            const flashAlpha = (this.hitFlashTimer / HIT_FLASH_DURATION) * 0.75;
            CTX.save();
            CTX.globalAlpha = flashAlpha;
            CTX.fillStyle = '#ffffff';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, R, 0, Math.PI * 2); CTX.fill();
            CTX.restore();
        }

        // ── HP bar ───────────────────────────────────────────────────
        const hpRatio = this.hp / this.maxHp, bw = 30;
        CTX.fillStyle = '#1e293b'; CTX.fillRect(screen.x - bw / 2, screen.y - R - 10, bw, 4);
        CTX.fillStyle = '#ef4444'; CTX.fillRect(screen.x - bw / 2, screen.y - R - 10, bw * hpRatio, 4);
    }
}

class TankEnemy extends Entity {
    constructor(x, y) {
        super(x, y, BALANCE.tank.radius);
        // Heavy exponential HP scaling: baseHp * ((1 + hpPerWave)^wave)
        // Uses config values for proper balance tuning
        const hpGrowth = 1 + BALANCE.tank.hpPerWave;
        this.maxHp = Math.floor(BALANCE.tank.baseHp * Math.pow(hpGrowth, getWave()));
        this.hp = this.maxHp;
        this.speed = BALANCE.tank.baseSpeed + getWave() * BALANCE.tank.speedPerWave;
        this.damage = BALANCE.tank.baseDamage + getWave() * BALANCE.tank.damagePerWave;
        this.color = BALANCE.tank.color; this.type = 'tank'; this.expValue = BALANCE.tank.expValue;

        // ── Hit flash state ──────────────────────────────────
        this.hitFlashTimer = 0;
    }

    update(dt, player) {
        if (this.dead) return;

        // ── Tick hit-flash timer ─────────────────────────────
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

        const dx = player.x - this.x, dy = player.y - this.y;
        const d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        if (!player.isInvisible) { this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed; }
        else { this.vx *= 0.95; this.vy *= 0.95; }
        this.applyPhysics(dt);

        // ── Melee contact damage ─────────────────────────────
        // Glitch Wave reduces Tank melee damage by 40 % — tanks hit
        // very hard and the player can't dodge reliably with inverted controls.
        if (d < BALANCE.tank.meleeRange + player.radius) {
            const contactDamage = this.damage * dt * 2;
            const glitchMult = window.isGlitchWave ? GLITCH_DAMAGE_MULT : 1.0;
            player.takeDamage(contactDamage * glitchMult);
        }
    }

    takeDamage(amt, player) {
        this.hp -= amt;

        // ── Trigger hit flash ────────────────────────────────
        this.hitFlashTimer = HIT_FLASH_DURATION;

        if (this.hp <= 0) {
            this.dead = true;
            spawnParticles(this.x, this.y, 30, this.color);
            addScore(BALANCE.score.tank * getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if (player) player.gainExp(this.expValue);
            // FIX (BUG-4): Correctly identify Kao and fetch weapon string key to allow Awakening
            if (player && player.charId === 'kao' && typeof player.addKill === 'function') {
                const wepKey = typeof weaponSystem !== 'undefined' ? (weaponSystem.currentWeapon || 'auto') : 'auto';
                const currentWep = BALANCE.characters.kao.weapons[wepKey];
                if (currentWep) player.addKill(currentWep.name);
            }
            Achievements.stats.kills++;
            if (Math.random() < BALANCE.powerups.dropRate * BALANCE.tank.powerupDropMult) window.powerups.push(new PowerUp(this.x, this.y));
        }
    }

    draw() {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  TANK ENEMY — Heavy Armored Brute                       ║
        // ║  Wide dark-red bean · Layered armor plates · Shield fists║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(this.x, this.y);
        const now = Date.now();
        const R = this.radius; // collision radius untouched
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        // ── Ground shadow (wider for big body) ───────────────────────
        CTX.save();
        CTX.globalAlpha = 0.30;
        CTX.fillStyle = 'rgba(0,0,0,0.9)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + R + 6, R * 1.1, 5, 0, 0, Math.PI * 2); CTX.fill();
        CTX.restore();

        // ── Body Block (Body Anti-Flip) ───────────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        if (isFacingLeft) CTX.scale(-1, 1);

        // Tank breathes slower and more heavily
        const breathe = Math.sin(now / 320);
        CTX.scale(1 + breathe * 0.022, 1 - breathe * 0.022);

        // ── Outer threat glow ─────────────────────────────────────────
        CTX.shadowBlur = 14; CTX.shadowColor = 'rgba(185,28,28,0.80)';
        CTX.strokeStyle = 'rgba(185,28,28,0.55)'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R + 3, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Main bean body — wide dark-red ────────────────────────────
        // Draw as a slightly wider ellipse (1.15×) for the "sturdier" silhouette
        CTX.save(); CTX.scale(1.15, 1.0);
        const bodyG = CTX.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
        bodyG.addColorStop(0, '#7f1d1d');
        bodyG.addColorStop(0.55, '#4a0d0d');
        bodyG.addColorStop(1, '#2d0606');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();
        CTX.restore(); // end wide-ellipse scale

        // ── Layered metallic armor plates ─────────────────────────────
        // Front chest plate (forward-facing)
        CTX.fillStyle = '#57121a';
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.8;
        CTX.beginPath();
        CTX.moveTo(R * 0.05, -R * 0.62);
        CTX.lineTo(R * 0.68, -R * 0.32);
        CTX.lineTo(R * 0.72, R * 0.28);
        CTX.lineTo(R * 0.05, R * 0.62);
        CTX.quadraticCurveTo(R * 0.3, R * 0.45, R * 0.05, R * 0.30);
        CTX.closePath(); CTX.fill(); CTX.stroke();

        // Shoulder pauldron (top)
        CTX.fillStyle = '#6b1515';
        CTX.beginPath();
        CTX.arc(0, -R * 0.65, R * 0.28, Math.PI, 0);
        CTX.lineTo(R * 0.28, -R * 0.45);
        CTX.lineTo(-R * 0.28, -R * 0.45);
        CTX.closePath(); CTX.fill(); CTX.stroke();

        // Rivets on the chest plate
        CTX.fillStyle = '#2d0606';
        CTX.shadowBlur = 3; CTX.shadowColor = '#ef4444';
        for (const [rx, ry] of [[R * 0.45, -R * 0.35], [R * 0.50, R * 0.05], [R * 0.42, R * 0.35]]) {
            CTX.beginPath(); CTX.arc(rx, ry, 2, 0, Math.PI * 2); CTX.fill();
        }
        CTX.shadowBlur = 0;

        // Damage-glow slit on chest (like an overheating engine)
        const heatPulse = 0.5 + Math.sin(now / 220) * 0.45;
        CTX.fillStyle = `rgba(251,146,60,${heatPulse * 0.85})`;
        CTX.shadowBlur = 8 * heatPulse; CTX.shadowColor = '#fb923c';
        CTX.beginPath(); CTX.roundRect(R * 0.18, -R * 0.08, R * 0.42, R * 0.18, R * 0.05); CTX.fill();
        CTX.shadowBlur = 0;

        // Specular highlight
        CTX.fillStyle = 'rgba(255,255,255,0.07)';
        CTX.beginPath(); CTX.arc(-R * 0.3, -R * 0.3, R * 0.28, 0, Math.PI * 2); CTX.fill();

        CTX.restore(); // end body transform

        // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        if (isFacingLeft) CTX.scale(1, -1);

        // ── Oversized Shield-Hands ────────────────────────────────────
        // Front shield-hand (forward side, large kite-shield shape)
        const shieldGlow = 0.4 + Math.sin(now / 180) * 0.25;
        CTX.fillStyle = '#57121a'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5;
        CTX.shadowBlur = 8 * shieldGlow; CTX.shadowColor = '#dc2626';
        CTX.beginPath();
        CTX.moveTo(R + 5, -R * 0.55);           // top
        CTX.lineTo(R + 12, -R * 0.15);          // upper right
        CTX.lineTo(R + 13, R * 0.30);          // lower right
        CTX.lineTo(R + 5, R * 0.65);           // bottom point
        CTX.lineTo(R - 2, R * 0.30);          // lower left
        CTX.lineTo(R - 1, -R * 0.15);          // upper left
        CTX.closePath(); CTX.fill(); CTX.stroke();
        // Shield boss (central rivet)
        CTX.fillStyle = '#dc2626'; CTX.shadowBlur = 6; CTX.shadowColor = '#ef4444';
        CTX.beginPath(); CTX.arc(R + 6, 0, 3.5, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // Back fist (off-side, smaller round gauntlet)
        CTX.fillStyle = '#3d0808'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5;
        CTX.shadowBlur = 4; CTX.shadowColor = '#dc2626';
        CTX.beginPath(); CTX.arc(-(R + 7), 0, R * 0.42, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        // Knuckle ridge
        CTX.strokeStyle = '#5c1010'; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.moveTo(-(R + 4), -3); CTX.lineTo(-(R + 10), -3); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-(R + 4), 1); CTX.lineTo(-(R + 10), 1); CTX.stroke();
        CTX.shadowBlur = 0;

        CTX.restore(); // end weapon transform

        // ── Hit flash — white silhouette (wide bean shape) ───────────
        if (this.hitFlashTimer > 0) {
            const flashAlpha = (this.hitFlashTimer / HIT_FLASH_DURATION) * 0.75;
            CTX.save();
            CTX.globalAlpha = flashAlpha;
            CTX.fillStyle = '#ffffff';
            CTX.translate(screen.x, screen.y);
            if (isFacingLeft) CTX.scale(-1, 1);
            CTX.scale(1.15, 1.0);
            CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();
            CTX.restore();
        }

        // ── HP bar ───────────────────────────────────────────────────
        const hpRatio = this.hp / this.maxHp, bw = 40;
        CTX.fillStyle = '#1e293b'; CTX.fillRect(screen.x - bw / 2, screen.y - R - 12, bw, 5);
        CTX.fillStyle = '#78716c'; CTX.fillRect(screen.x - bw / 2, screen.y - R - 12, bw * hpRatio, 5);
    }
}

class MageEnemy extends Entity {
    constructor(x, y) {
        super(x, y, BALANCE.mage.radius);
        // Moderate exponential HP scaling: baseHp * ((1 + hpPerWave)^wave)
        // Uses config values for proper balance tuning
        const hpGrowth = 1 + BALANCE.mage.hpPerWave;
        this.maxHp = Math.floor(BALANCE.mage.baseHp * Math.pow(hpGrowth, getWave()));
        this.hp = this.maxHp;
        this.speed = BALANCE.mage.baseSpeed + getWave() * BALANCE.mage.speedPerWave;
        this.damage = BALANCE.mage.baseDamage + getWave() * BALANCE.mage.damagePerWave;
        this.color = BALANCE.mage.color; this.type = 'mage';
        this.soundWaveCD = 0; this.meteorCD = 0; this.expValue = BALANCE.mage.expValue;

        // ── Hit flash state ──────────────────────────────────
        this.hitFlashTimer = 0;
    }

    update(dt, player) {
        if (this.dead) return;

        // ── Tick hit-flash timer ─────────────────────────────
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

        const d = dist(this.x, this.y, player.x, player.y), od = BALANCE.mage.orbitDistance;
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        if (d < od && !player.isInvisible) { this.vx = -Math.cos(this.angle) * this.speed; this.vy = -Math.sin(this.angle) * this.speed; }
        else if (d > od + BALANCE.mage.orbitDistanceBuffer) { this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed; }
        else { this.vx *= 0.95; this.vy *= 0.95; }
        this.applyPhysics(dt);
        if (this.soundWaveCD > 0) this.soundWaveCD -= dt;
        if (this.meteorCD > 0) this.meteorCD -= dt;
        if (this.soundWaveCD <= 0 && d < BALANCE.mage.soundWaveRange && !player.isInvisible) {
            player.isConfused = true; player.confusedTimer = BALANCE.mage.soundWaveConfuseDuration;
            spawnFloatingText('CONFUSED!', player.x, player.y - 40, '#a855f7', 20);
            for (let i = 0; i < 360; i += 30) {
                const a = (i * Math.PI) / 180;
                spawnParticles(this.x + Math.cos(a) * 50, this.y + Math.sin(a) * 50, 3, '#a855f7');
            }
            this.soundWaveCD = BALANCE.mage.soundWaveCooldown;
        }
        if (this.meteorCD <= 0 && Math.random() < 0.005) {
            window.specialEffects.push(new MeteorStrike(player.x + rand(-300, 300), player.y + rand(-300, 300)));
            this.meteorCD = BALANCE.mage.meteorCooldown;
            Audio.playMeteorWarning();
        }
    }

    takeDamage(amt, player) {
        this.hp -= amt;

        // ── Trigger hit flash ────────────────────────────────
        this.hitFlashTimer = HIT_FLASH_DURATION;

        if (this.hp <= 0) {
            this.dead = true;
            spawnParticles(this.x, this.y, 25, this.color);
            addScore(BALANCE.score.mage * getWave()); addEnemyKill(); Audio.playEnemyDeath();
            if (player) player.gainExp(this.expValue);
            // FIX (BUG-4): Correctly identify Kao and fetch weapon string key to allow Awakening
            if (player && player.charId === 'kao' && typeof player.addKill === 'function') {
                const wepKey = typeof weaponSystem !== 'undefined' ? (weaponSystem.currentWeapon || 'auto') : 'auto';
                const currentWep = BALANCE.characters.kao.weapons[wepKey];
                if (currentWep) player.addKill(currentWep.name);
            }
            Achievements.stats.kills++;
            if (Math.random() < BALANCE.powerups.dropRate * BALANCE.mage.powerupDropMult) window.powerups.push(new PowerUp(this.x, this.y));
        }
    }

    draw() {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  MAGE ENEMY — Arcane Shooter Drone                      ║
        // ║  Sleek green diamond-bean · Glowing blaster · Orb hands  ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(this.x, this.y);
        const now = Date.now();
        const R = this.radius;
        const bobOffset = Math.sin(now / 300) * 3; // Mages float/hover
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        // ── Ground shadow (offset because mage floats) ───────────────
        CTX.save();
        CTX.globalAlpha = 0.15;
        CTX.fillStyle = 'rgba(0,0,0,0.8)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + R + 10, R * 0.8, 4, 0, 0, Math.PI * 2); CTX.fill();
        CTX.restore();

        // ── Body Block (Body Anti-Flip + floating bob) ────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y + bobOffset);
        if (isFacingLeft) CTX.scale(-1, 1);

        // Mage breathing — slightly faster oscillation
        const breathe = Math.sin(now / 170);
        CTX.scale(1 + breathe * 0.025, 1 - breathe * 0.030);

        // ── Outer arcane glow ring ────────────────────────────────────
        const auraA = 0.45 + Math.sin(now / 240) * 0.25;
        CTX.shadowBlur = 14; CTX.shadowColor = 'rgba(126,34,206,0.80)';
        CTX.strokeStyle = `rgba(167,139,250,${auraA})`; CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(0, 0, R + 3, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Bean body — deep emerald/violet gradient ──────────────────
        // Diamond/sleek feel: taller than wide (scale Y slightly up)
        CTX.save(); CTX.scale(0.88, 1.1);
        const bodyG = CTX.createRadialGradient(-R * 0.25, -R * 0.30, 1, 0, 0, R);
        bodyG.addColorStop(0, '#166534');
        bodyG.addColorStop(0.55, '#14532d');
        bodyG.addColorStop(1, '#052e16');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();
        CTX.restore(); // end diamond scale

        // Specular top-left highlight
        CTX.fillStyle = 'rgba(255,255,255,0.12)';
        CTX.beginPath(); CTX.arc(-R * 0.3, -R * 0.35, R * 0.28, 0, Math.PI * 2); CTX.fill();

        // ── Arcane energy core (glowing belly rune) ───────────────────
        const coreP = 0.4 + Math.sin(now / 190) * 0.5;
        CTX.fillStyle = `rgba(74,222,128,${Math.max(0, coreP)})`;
        CTX.shadowBlur = 12 * coreP; CTX.shadowColor = '#22c55e';
        CTX.beginPath(); CTX.arc(0, R * 0.15, R * 0.28, 0, Math.PI * 2); CTX.fill();
        // Inner white hot core
        CTX.fillStyle = `rgba(255,255,255,${coreP * 0.6})`;
        CTX.beginPath(); CTX.arc(0, R * 0.15, R * 0.12, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // end body transform

        // ── Weapon Block (Weapon Anti-Flip + floating bob) ────────────
        CTX.save();
        CTX.translate(screen.x, screen.y + bobOffset);
        CTX.rotate(this.angle);
        if (isFacingLeft) CTX.scale(1, -1);

        // ── Glowing blaster barrel (pointing forward / +X) ───────────
        // Barrel base — dark rectangle
        CTX.fillStyle = '#1a2a1a'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.roundRect(R * 0.5, -R * 0.13, R * 0.80, R * 0.28, R * 0.06); CTX.fill(); CTX.stroke();
        // Barrel energy channel — glowing green slit
        const blasterA = 0.7 + Math.sin(now / 200) * 0.3;
        CTX.fillStyle = `rgba(74,222,128,${blasterA})`;
        CTX.shadowBlur = 8 * blasterA; CTX.shadowColor = '#22c55e';
        CTX.beginPath(); CTX.roundRect(R * 0.55, -R * 0.06, R * 0.72, R * 0.14, R * 0.04); CTX.fill();
        // Muzzle energy ring
        CTX.strokeStyle = `rgba(134,239,172,${blasterA})`; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.arc(R * 1.32, 0, R * 0.15, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Floating Arcane Orb Hands ─────────────────────────────────
        // Front orb — near the blaster, glowing green
        const orbPulse = 0.6 + Math.sin(now / 210 + 1) * 0.35;
        CTX.fillStyle = '#14532d'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.shadowBlur = 8 * orbPulse; CTX.shadowColor = '#22c55e';
        CTX.beginPath(); CTX.arc(R + 4, R * 0.55, R * 0.35, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        // Orb inner glow
        CTX.fillStyle = `rgba(74,222,128,${orbPulse * 0.75})`;
        CTX.beginPath(); CTX.arc(R + 4, R * 0.55, R * 0.18, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // Back orb — off-side, dimmer violet tint
        CTX.fillStyle = '#1a0a2e'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.shadowBlur = 5; CTX.shadowColor = 'rgba(126,34,206,0.5)';
        CTX.beginPath(); CTX.arc(-(R + 4), R * 0.30, R * 0.30, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.fillStyle = `rgba(167,139,250,${orbPulse * 0.55})`;
        CTX.beginPath(); CTX.arc(-(R + 4), R * 0.30, R * 0.14, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // end weapon transform

        // ── Hit flash — white silhouette ─────────────────────────────
        if (this.hitFlashTimer > 0) {
            const flashAlpha = (this.hitFlashTimer / HIT_FLASH_DURATION) * 0.75;
            CTX.save();
            CTX.globalAlpha = flashAlpha;
            CTX.fillStyle = '#ffffff';
            CTX.translate(screen.x, screen.y + bobOffset);
            if (isFacingLeft) CTX.scale(-1, 1);
            CTX.save(); CTX.scale(0.88, 1.1);
            CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();
            CTX.restore();
            CTX.restore();
        }

        // ── HP bar ───────────────────────────────────────────────────
        const hpRatio = this.hp / this.maxHp, bw = 30;
        CTX.fillStyle = '#1e293b'; CTX.fillRect(screen.x - bw / 2, screen.y - R - 14, bw, 4);
        CTX.fillStyle = '#a855f7'; CTX.fillRect(screen.x - bw / 2, screen.y - R - 14, bw * hpRatio, 4);
    }
}

// ════════════════════════════════════════════════════════════
// POWER-UPS
// ════════════════════════════════════════════════════════════
class PowerUp {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = BALANCE.powerups.radius; this.life = BALANCE.powerups.lifetime;
        this.bobTimer = Math.random() * Math.PI * 2;
        this.type = randomChoice(['heal', 'damage', 'speed']);
        this.icons = { heal: '❤️', damage: '⚡', speed: '🚀' };
        this.colors = { heal: '#10b981', damage: '#f59e0b', speed: '#3b82f6' };
    }
    update(dt, player) {
        this.life -= dt; this.bobTimer += dt * 3;
        const d = dist(this.x, this.y, player.x, player.y);
        if (d < this.radius + player.radius) { this.collect(player); return true; }
        return this.life <= 0;
    }
    collect(player) {
        switch (this.type) {
            case 'heal': player.heal(BALANCE.powerups.healAmount); break;
            case 'damage':
                // FIX (BUG-6): Stack with shop boost instead of overwriting
                if (!player._powerupDamageActive) {
                    const shopMult = player.shopDamageBoostActive 
                        ? (player.damageBoost / (player._baseDamageBoost || 1.0))
                        : 1.0;
                    player._powerupDamageActive = true;
                    player.damageBoost = (player._baseDamageBoost || 1.0) * shopMult * BALANCE.powerups.damageBoost;
                    
                    setTimeout(() => { 
                        player._powerupDamageActive = false;
                        // Restore shop boost if still active
                        const currentShopMult = player.shopDamageBoostActive 
                            ? (player.damageBoost / ((player._baseDamageBoost || 1.0) * BALANCE.powerups.damageBoost))
                            : 1.0;
                        player.damageBoost = (player._baseDamageBoost || 1.0) * currentShopMult;
                    }, BALANCE.powerups.damageBoostDuration * 1000);
                }
                spawnFloatingText('DAMAGE UP!', player.x, player.y - 40, '#f59e0b', 20); break;
            case 'speed':
                // FIX (BUG-6): Stack with shop boost instead of overwriting
                if (!player._powerupSpeedActive) {
                    const shopMult = player.shopSpeedBoostActive 
                        ? (player.speedBoost / 1.0)
                        : 1.0;
                    player._powerupSpeedActive = true;
                    player.speedBoost = shopMult * BALANCE.powerups.speedBoost;
                    
                    setTimeout(() => { 
                        player._powerupSpeedActive = false;
                        // Restore shop boost if still active
                        player.speedBoost = player.shopSpeedBoostActive ? (player.speedBoost / BALANCE.powerups.speedBoost) : 1.0;
                    }, BALANCE.powerups.speedBoostDuration * 1000);
                }
                spawnFloatingText('SPEED UP!', player.x, player.y - 40, '#3b82f6', 20);
        }
        spawnParticles(this.x, this.y, 20, this.colors[this.type]);
        addScore(BALANCE.score.powerup); Audio.playPowerUp();
        Achievements.stats.powerups++; Achievements.check('collector');
    }
    draw() {
        const screen = worldToScreen(this.x, this.y + Math.sin(this.bobTimer) * 5);
        CTX.save(); CTX.translate(screen.x, screen.y);
        CTX.shadowBlur = 20; CTX.shadowColor = this.colors[this.type];
        CTX.font = '32px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillText(this.icons[this.type], 0, 0); CTX.restore();
    }
}
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.Enemy = Enemy;
window.EnemyBase = Enemy;    // alias for Debug.html check
window.TankEnemy = TankEnemy;
window.MageEnemy = MageEnemy;
window.PowerUp = PowerUp;