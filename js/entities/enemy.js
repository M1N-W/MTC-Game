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

// ── Phase 2: Unique enemy ID counter for sticky stack tracking ──
// Incremented on every enemy construction. Never reused within a session.
let _enemyIdCounter = 0;

class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, BALANCE.enemy.radius);
        this.id = ++_enemyIdCounter; // ── Phase 2: unique ID for sticky stack Map key ──
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

        // ── Phase 2 Session 3: Sticky slow state ─────────────
        this.stickyStacks = 0;
        this.stickySlowMultiplier = 1;

        //  StatusEffect Framework Core 
        this.statusEffects = new Map();
    }

    update(dt, player) {
        if (this.dead) return;

        //  StatusEffect Framework Tick 
        this.tickStatuses(dt);        // ── Tick hit-flash timer ─────────────────────────────

        // ── Session B: Read sticky status and update slow multiplier ──
        const stickyStatus = this.getStatus("sticky");
        if (stickyStatus && stickyStatus.meta) {
            const slowPerStack = stickyStatus.meta.slowPerStack || 0.04;
            this.stickySlowMultiplier = Math.max(0.2, 1 - (slowPerStack * stickyStatus.stacks));
            this.stickyStacks = stickyStatus.stacks;
        }
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
        // ── Ignite debuff (applied by AutoPlayer Vacuum Heat) ────────
        if ((this.igniteTimer ?? 0) > 0) {
            this.igniteTimer -= dt;
            this.takeDamage((this.igniteDPS ?? 12) * dt);
            if (this.igniteTimer <= 0) { this.igniteTimer = 0; this.igniteDPS = 0; }
        }

        const dx = player.x - this.x, dy = player.y - this.y;
        const d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        // ── VacuumHeat AI-lock: skip vx/vy override while being pulled ──
        if ((this.vacuumStunTimer ?? 0) > 0) {
            this.vacuumStunTimer -= dt;
            if ((this._vacuumPullTimer ?? 0) > 0) {
                this._vacuumPullTimer -= dt;
                const pvx = (this._vacuumTargetX ?? this.x) - this.x;
                const pvy = (this._vacuumTargetY ?? this.y) - this.y;
                const pd = Math.hypot(pvx, pvy);
                if (pd > 8) { this.vx = (pvx / pd) * 860; this.vy = (pvy / pd) * 860; }
                else { this.vx *= 0.5; this.vy *= 0.5; }
            } else { this.vx *= 0.85; this.vy *= 0.85; }
        } else {
            if (d > BALANCE.enemy.chaseRange && !player.isInvisible) {
                this.vx = Math.cos(this.angle) * this.speed * this.stickySlowMultiplier;
                this.vy = Math.sin(this.angle) * this.speed * this.stickySlowMultiplier;
            } else { this.vx *= 0.9; this.vy *= 0.9; }
        }
        this._steerAroundObstacles(dt);
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
            // 🩸 Battle Scars: รอยเลือดสีม่วงคล้ำบนพื้น
            if (typeof decalSystem !== 'undefined') {
                decalSystem.spawn(this.x, this.y, '#3b0764', 12 + Math.random() * 6);
            }
            addScore(BALANCE.score.basicEnemy * getWave()); addEnemyKill(); Audio.playEnemyDeath();
            // ✨ [bullet_time_kill] นับคิลขณะ Slow-mo
            if (window.isSlowMotion && typeof Achievements !== 'undefined') {
                Achievements.stats.slowMoKills++;
                Achievements.check('bullet_time_kill');
            }
            if (player) player.gainExp(this.expValue);

            // FIX (BUG-4): Correctly identify Kao and fetch weapon string key to allow Awakening
            if (player && player.charId === 'kao' && typeof player.addKill === 'function') {
                const wepKey = typeof weaponSystem !== 'undefined' ? (weaponSystem.currentWeapon || 'auto') : 'auto';
                const currentWep = BALANCE.characters.kao.weapons[wepKey];
                if (currentWep) {
                    player.addKill(currentWep.name);

                    // ✨ [Weapon Master Progress] แสดง floating text บอกความคืบหน้า
                    if (player.passiveUnlocked && !player.isWeaponMaster) {
                        const kills = player.weaponKills[wepKey] || 0;
                        const req = BALANCE.characters.kao.weaponMasterReq || 10;
                        spawnFloatingText(`${currentWep.name} ${kills}/${req}`, this.x, this.y - 40, '#facc15', 14);
                    }
                }
            }

            Achievements.stats.kills++; Achievements.check('first_blood');
            if (Math.random() < BALANCE.powerups.dropRate) window.powerups.push(new PowerUp(this.x, this.y));
        }
    }

    // 
    // STATUSEFFECT FRAMEWORK - Session A
    // 

    /**
     * Add or merge a status effect on this enemy
     * @param {string} type - Effect type identifier
     * @param {object} data - Effect data to merge (stacks, expireAt, meta, callbacks)
     */
    addStatus(type, data) {
        const existing = this.statusEffects.get(type);
        const now = performance.now() / 1000;

        if (existing) {
            // Merge with existing effect
            if (data.stacks !== undefined) {
                existing.stacks += data.stacks;
            }
            if (data.expireAt !== undefined) {
                existing.expireAt = Math.max(existing.expireAt, data.expireAt);
            }
            if (data.meta) {
                existing.meta = { ...existing.meta, ...data.meta };
            }
            // Override callbacks if provided
            if (data.onApply) existing.onApply = data.onApply;
            if (data.onExpire) existing.onExpire = data.onExpire;
            if (data.onTick) existing.onTick = data.onTick;
        } else {
            // Create new effect
            const effect = {
                type,
                stacks: data.stacks || 1,
                expireAt: data.expireAt || (now + (data.duration || 5)),
                meta: data.meta || {},
                onApply: data.onApply,
                onExpire: data.onExpire,
                onTick: data.onTick
            };
            this.statusEffects.set(type, effect);

            // Call onApply callback if provided
            if (effect.onApply) {
                effect.onApply(this, effect);
            }
        }
    }

    /**
     * Remove a status effect from this enemy
     * @param {string} type - Effect type to remove
     */
    removeStatus(type) {
        const effect = this.statusEffects.get(type);
        if (effect) {
            // Call onExpire callback if provided
            if (effect.onExpire) {
                effect.onExpire(this, effect);
            }
            this.statusEffects.delete(type);
        }
    }

    /**
     * Get status effect data
     * @param {string} type - Effect type to retrieve
     * @returns {object|null} Effect data or null if not found
     */
    getStatus(type) {
        return this.statusEffects.get(type) || null;
    }

    /**
     * Update all status effects, call onTick callbacks, remove expired ones
     * @param {number} dt - Delta time in seconds
     */
    tickStatuses(dt) {
        const now = performance.now() / 1000;
        const toRemove = [];

        for (const [type, effect] of this.statusEffects) {
            // Check expiration
            if (effect.expireAt <= now) {
                toRemove.push(type);
                continue;
            }

            // Call onTick callback if provided
            if (effect.onTick) {
                effect.onTick(this, effect, dt);
            }
        }

        // Remove expired effects
        for (const type of toRemove) {
            this.removeStatus(type);
        }
    }
    // draw() moved to EnemyRenderer.drawXxx() — see bottom of this file.
}

class TankEnemy extends Entity {
    constructor(x, y) {
        super(x, y, BALANCE.tank.radius);
        this.id = ++_enemyIdCounter; // ── Phase 2: unique ID for sticky stack Map key ──
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

        // ── Phase 2 Session 3: Sticky slow state ─────────────
        this.stickyStacks = 0;
        this.stickySlowMultiplier = 1;

        //  StatusEffect Framework Core 
        this.statusEffects = new Map();
    }

    update(dt, player) {
        if (this.dead) return;

        //  StatusEffect Framework Tick 
        this.tickStatuses(dt);        // ── Tick hit-flash timer ─────────────────────────────

        // ── Session B: Read sticky status and update slow multiplier ──
        const stickyStatus = this.getStatus("sticky");
        if (stickyStatus && stickyStatus.meta) {
            const slowPerStack = stickyStatus.meta.slowPerStack || 0.04;
            this.stickySlowMultiplier = Math.max(0.2, 1 - (slowPerStack * stickyStatus.stacks));
            this.stickyStacks = stickyStatus.stacks;
        }
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
        // ── Ignite debuff (applied by AutoPlayer Vacuum Heat) ────────
        if ((this.igniteTimer ?? 0) > 0) {
            this.igniteTimer -= dt;
            this.takeDamage((this.igniteDPS ?? 12) * dt);
            if (this.igniteTimer <= 0) { this.igniteTimer = 0; this.igniteDPS = 0; }
        }

        const dx = player.x - this.x, dy = player.y - this.y;
        const d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        // ── VacuumHeat AI-lock ──
        if ((this.vacuumStunTimer ?? 0) > 0) {
            this.vacuumStunTimer -= dt;
            if ((this._vacuumPullTimer ?? 0) > 0) {
                this._vacuumPullTimer -= dt;
                const pvx = (this._vacuumTargetX ?? this.x) - this.x;
                const pvy = (this._vacuumTargetY ?? this.y) - this.y;
                const pd = Math.hypot(pvx, pvy);
                if (pd > 8) { this.vx = (pvx / pd) * 560; this.vy = (pvy / pd) * 560; } // tank = slower pull
                else { this.vx *= 0.5; this.vy *= 0.5; }
            } else { this.vx *= 0.85; this.vy *= 0.85; }
        } else {
            if (!player.isInvisible) {
                this.vx = Math.cos(this.angle) * this.speed * this.stickySlowMultiplier;
                this.vy = Math.sin(this.angle) * this.speed * this.stickySlowMultiplier;
            } else { this.vx *= 0.95; this.vy *= 0.95; }
        }
        this._steerAroundObstacles(dt);
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
            // 🩸 Battle Scars: รอยเลือดสีแดงคล้ำขนาดใหญ่ (Tank ตัวใหญ่กว่า)
            if (typeof decalSystem !== 'undefined') {
                decalSystem.spawn(this.x, this.y, '#7f1d1d', 20 + Math.random() * 8, 20);
            }
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

    // 
    // STATUSEFFECT FRAMEWORK - Session A
    // 

    /**
     * Add or merge a status effect on this enemy
     * @param {string} type - Effect type identifier
     * @param {object} data - Effect data to merge (stacks, expireAt, meta, callbacks)
     */
    addStatus(type, data) {
        const existing = this.statusEffects.get(type);
        const now = performance.now() / 1000;

        if (existing) {
            // Merge with existing effect
            if (data.stacks !== undefined) {
                existing.stacks += data.stacks;
            }
            if (data.expireAt !== undefined) {
                existing.expireAt = Math.max(existing.expireAt, data.expireAt);
            }
            if (data.meta) {
                existing.meta = { ...existing.meta, ...data.meta };
            }
            // Override callbacks if provided
            if (data.onApply) existing.onApply = data.onApply;
            if (data.onExpire) existing.onExpire = data.onExpire;
            if (data.onTick) existing.onTick = data.onTick;
        } else {
            // Create new effect
            const effect = {
                type,
                stacks: data.stacks || 1,
                expireAt: data.expireAt || (now + (data.duration || 5)),
                meta: data.meta || {},
                onApply: data.onApply,
                onExpire: data.onExpire,
                onTick: data.onTick
            };
            this.statusEffects.set(type, effect);

            // Call onApply callback if provided
            if (effect.onApply) {
                effect.onApply(this, effect);
            }
        }
    }

    /**
     * Remove a status effect from this enemy
     * @param {string} type - Effect type to remove
     */
    removeStatus(type) {
        const effect = this.statusEffects.get(type);
        if (effect) {
            // Call onExpire callback if provided
            if (effect.onExpire) {
                effect.onExpire(this, effect);
            }
            this.statusEffects.delete(type);
        }
    }

    /**
     * Get status effect data
     * @param {string} type - Effect type to retrieve
     * @returns {object|null} Effect data or null if not found
     */
    getStatus(type) {
        return this.statusEffects.get(type) || null;
    }

    /**
     * Update all status effects, call onTick callbacks, remove expired ones
     * @param {number} dt - Delta time in seconds
     */
    tickStatuses(dt) {
        const now = performance.now() / 1000;
        const toRemove = [];

        for (const [type, effect] of this.statusEffects) {
            // Check expiration
            if (effect.expireAt <= now) {
                toRemove.push(type);
                continue;
            }

            // Call onTick callback if provided
            if (effect.onTick) {
                effect.onTick(this, effect, dt);
            }
        }

        // Remove expired effects
        for (const type of toRemove) {
            this.removeStatus(type);
        }
    }
    // draw() moved to EnemyRenderer.drawXxx() — see bottom of this file.
}

class MageEnemy extends Entity {
    constructor(x, y) {
        super(x, y, BALANCE.mage.radius);
        this.id = ++_enemyIdCounter; // ── Phase 2: unique ID for sticky stack Map key ──
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

        // ── Phase 2 Session 3: Sticky slow state ─────────────
        this.stickyStacks = 0;
        this.stickySlowMultiplier = 1;

        //  StatusEffect Framework Core 
        this.statusEffects = new Map();
    }

    update(dt, player) {
        if (this.dead) return;

        //  StatusEffect Framework Tick 
        this.tickStatuses(dt);        // ── Tick hit-flash timer ─────────────────────────────

        // ── Session B: Read sticky status and update slow multiplier ──
        const stickyStatus = this.getStatus("sticky");
        if (stickyStatus && stickyStatus.meta) {
            const slowPerStack = stickyStatus.meta.slowPerStack || 0.04;
            this.stickySlowMultiplier = Math.max(0.2, 1 - (slowPerStack * stickyStatus.stacks));
            this.stickyStacks = stickyStatus.stacks;
        }
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
        // ── Ignite debuff (applied by AutoPlayer Vacuum Heat) ────────
        if ((this.igniteTimer ?? 0) > 0) {
            this.igniteTimer -= dt;
            this.takeDamage((this.igniteDPS ?? 12) * dt);
            if (this.igniteTimer <= 0) { this.igniteTimer = 0; this.igniteDPS = 0; }
        }

        const d = dist(this.x, this.y, player.x, player.y), od = BALANCE.mage.orbitDistance;
        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
        // ── VacuumHeat AI-lock ──
        if ((this.vacuumStunTimer ?? 0) > 0) {
            this.vacuumStunTimer -= dt;
            if ((this._vacuumPullTimer ?? 0) > 0) {
                this._vacuumPullTimer -= dt;
                const pvx = (this._vacuumTargetX ?? this.x) - this.x;
                const pvy = (this._vacuumTargetY ?? this.y) - this.y;
                const pd = Math.hypot(pvx, pvy);
                if (pd > 8) { this.vx = (pvx / pd) * 860; this.vy = (pvy / pd) * 860; }
                else { this.vx *= 0.5; this.vy *= 0.5; }
            } else { this.vx *= 0.85; this.vy *= 0.85; }
        } else {
            // ── Phase 2 Session 3: apply sticky slow multiplier to movement ──
            if (d < od && !player.isInvisible) {
                this.vx = -Math.cos(this.angle) * this.speed * this.stickySlowMultiplier;
                this.vy = -Math.sin(this.angle) * this.speed * this.stickySlowMultiplier;
            } else if (d > od + BALANCE.mage.orbitDistanceBuffer) {
                this.vx = Math.cos(this.angle) * this.speed * this.stickySlowMultiplier;
                this.vy = Math.sin(this.angle) * this.speed * this.stickySlowMultiplier;
            } else { this.vx *= 0.95; this.vy *= 0.95; }
        }
        this._steerAroundObstacles(dt);
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
        if (this.meteorCD <= 0 && Math.random() < (0.005 * dt * 60)) {  // BUG B1 FIX: was per-frame (×60 spikes at 60fps) → now per-second
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
            // 🩸 Battle Scars: รอยม่วงเข้มของ Mage
            if (typeof decalSystem !== 'undefined') {
                decalSystem.spawn(this.x, this.y, '#4c1d95', 10 + Math.random() * 6, 16);
            }
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

    // 
    // STATUSEFFECT FRAMEWORK - Session A
    // 

    /**
     * Add or merge a status effect on this enemy
     * @param {string} type - Effect type identifier
     * @param {object} data - Effect data to merge (stacks, expireAt, meta, callbacks)
     */
    addStatus(type, data) {
        const existing = this.statusEffects.get(type);
        const now = performance.now() / 1000;

        if (existing) {
            // Merge with existing effect
            if (data.stacks !== undefined) {
                existing.stacks += data.stacks;
            }
            if (data.expireAt !== undefined) {
                existing.expireAt = Math.max(existing.expireAt, data.expireAt);
            }
            if (data.meta) {
                existing.meta = { ...existing.meta, ...data.meta };
            }
            // Override callbacks if provided
            if (data.onApply) existing.onApply = data.onApply;
            if (data.onExpire) existing.onExpire = data.onExpire;
            if (data.onTick) existing.onTick = data.onTick;
        } else {
            // Create new effect
            const effect = {
                type,
                stacks: data.stacks || 1,
                expireAt: data.expireAt || (now + (data.duration || 5)),
                meta: data.meta || {},
                onApply: data.onApply,
                onExpire: data.onExpire,
                onTick: data.onTick
            };
            this.statusEffects.set(type, effect);

            // Call onApply callback if provided
            if (effect.onApply) {
                effect.onApply(this, effect);
            }
        }
    }

    /**
     * Remove a status effect from this enemy
     * @param {string} type - Effect type to remove
     */
    removeStatus(type) {
        const effect = this.statusEffects.get(type);
        if (effect) {
            // Call onExpire callback if provided
            if (effect.onExpire) {
                effect.onExpire(this, effect);
            }
            this.statusEffects.delete(type);
        }
    }

    /**
     * Get status effect data
     * @param {string} type - Effect type to retrieve
     * @returns {object|null} Effect data or null if not found
     */
    getStatus(type) {
        return this.statusEffects.get(type) || null;
    }

    /**
     * Update all status effects, call onTick callbacks, remove expired ones
     * @param {number} dt - Delta time in seconds
     */
    tickStatuses(dt) {
        const now = performance.now() / 1000;
        const toRemove = [];

        for (const [type, effect] of this.statusEffects) {
            // Check expiration
            if (effect.expireAt <= now) {
                toRemove.push(type);
                continue;
            }

            // Call onTick callback if provided
            if (effect.onTick) {
                effect.onTick(this, effect, dt);
            }
        }

        // Remove expired effects
        for (const type of toRemove) {
            this.removeStatus(type);
        }
    }
    // draw() moved to EnemyRenderer.drawXxx() — see bottom of this file.
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
    // draw() moved to EnemyRenderer.drawXxx() — see bottom of this file.
}
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.Enemy = Enemy;
window.EnemyBase = Enemy;    // alias for Debug.html check
window.TankEnemy = TankEnemy;
window.MageEnemy = MageEnemy;
window.PowerUp = PowerUp;
// ============================================================
// EnemyRenderer — Canvas draw calls for all enemy types
//
// Separated from entity logic so game data and visuals are
// independently testable. Godot equivalent: Sprite2D / AnimatedSprite2D
// nodes that are children of the enemy Node2D but own no game state.
//
// Entry point: EnemyRenderer.draw(entity, ctx)
//   Dispatches to the correct static method based on entity type.
// ============================================================
class EnemyRenderer {

    // ── Dispatcher ───────────────────────────────────────────
    // Call this from the game loop instead of entity.draw().
    static draw(e, ctx) {
        // Swap global CTX for the passed ctx so all sub-methods
        // work with whichever canvas is active (future-proofing).
        const _prevCTX = (typeof window !== 'undefined') ? window.CTX : undefined;
        if (typeof window !== 'undefined') window.CTX = ctx;
        try {
            if (e instanceof MageEnemy) EnemyRenderer.drawMage(e);
            else if (e instanceof TankEnemy) EnemyRenderer.drawTank(e);
            else if (e instanceof Enemy) EnemyRenderer.drawEnemy(e);
            else if (e instanceof PowerUp) EnemyRenderer.drawPowerUp(e);
            // Fallback: entities with own draw() (e.g. GoldfishMinion, future minions)
            else if (typeof e.draw === 'function') e.draw();
        } finally {
            if (typeof window !== 'undefined' && _prevCTX !== undefined) window.CTX = _prevCTX;
        }
    }

    // ══════════════════════════════════════════════════════════
    // SHARED HELPERS — called by all 3 draw methods
    // Extracted to eliminate 3× duplicate blocks and reduce
    // per-frame GC pressure (no inline object literals in hot path)
    // ══════════════════════════════════════════════════════════

    /**
     * Draw HP bar above entity — rounded, multi-tone, low-HP danger pulse.
     * @param {number} sx screen x  @param {number} sy screen y
     * @param {number} R  collision radius
     * @param {number} hp current HP  @param {number} maxHp max HP
     * @param {number} bw bar width (px)  @param {number} yOff y offset above head
     * @param {number} now Date.now() — passed in, not re-called
     */
    static _drawHpBar(sx, sy, R, hp, maxHp, bw, yOff, now) {
        const ratio = Math.max(0, hp / maxHp);
        const bh = 5;
        const bx = sx - bw / 2;
        const by = sy - R - yOff;

        // ── Low-HP danger pulse (ratio < 0.30) ──────────────
        if (ratio < 0.30) {
            const pulse = 0.55 + Math.sin(now / 100) * 0.45;
            CTX.save();
            CTX.globalAlpha = pulse * 0.35;
            CTX.fillStyle = '#ef4444';
            CTX.beginPath();
            CTX.arc(sx, sy, R + 4 + pulse * 3, 0, Math.PI * 2);
            CTX.fill();
            CTX.restore();
        }

        // ── Bar background ───────────────────────────────────
        CTX.save();
        CTX.fillStyle = 'rgba(0,0,0,0.65)';
        // Rounded background via clip — cheap alternative to roundRect path
        CTX.beginPath();
        CTX.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
        CTX.fill();

        // ── Fill ─────────────────────────────────────────────
        // Colour: green → amber → red as HP drops
        const fillColor = ratio > 0.60 ? '#22c55e' : ratio > 0.30 ? '#f59e0b' : '#ef4444';
        CTX.fillStyle = fillColor;
        if (ratio > 0.01) {
            CTX.beginPath();
            CTX.roundRect(bx, by, bw * ratio, bh, 2);
            CTX.fill();
        }

        // ── Specular sheen on fill (top half lighter strip) ──
        CTX.globalAlpha = 0.28;
        CTX.fillStyle = '#ffffff';
        CTX.beginPath();
        CTX.roundRect(bx, by, bw * ratio, Math.floor(bh / 2), [2, 2, 0, 0]);
        CTX.fill();

        CTX.restore();
    }

    /**
     * Ground shadow ellipse — shared across all 3 enemy types.
     * @param {number} sx @param {number} sy screen coords
     * @param {number} R  collision radius
     * @param {number} alpha base opacity
     * @param {number} ry  ellipse Y radius
     */
    static _drawGroundShadow(sx, sy, R, alpha, ry) {
        CTX.save();
        CTX.globalAlpha = alpha;
        CTX.fillStyle = 'rgba(0,0,0,0.85)';
        CTX.beginPath();
        CTX.ellipse(sx, sy + R + 4, R * 0.85, ry, 0, 0, Math.PI * 2);
        CTX.fill();
        CTX.restore();
    }

    /**
     * Status effect overlays — hit flash, sticky, ignite.
     * Called AFTER the main body so overlays render on top.
     * @param {Enemy|TankEnemy|MageEnemy} e
     * @param {number} sx @param {number} sy screen coords
     * @param {number} R collision radius
     * @param {number} now Date.now() value from caller
     */
    static _drawStatusOverlays(e, sx, sy, R, now) {
        // ── Hit flash — white silhouette ──────────────────────
        if (e.hitFlashTimer > 0) {
            CTX.save();
            CTX.globalAlpha = (e.hitFlashTimer / HIT_FLASH_DURATION) * 0.80;
            CTX.fillStyle = '#ffffff';
            CTX.shadowBlur = 10;
            CTX.shadowColor = '#ffffff';
            CTX.beginPath(); CTX.arc(sx, sy, R, 0, Math.PI * 2); CTX.fill();
            CTX.restore();
        }

        // ── Sticky stacks — green tint ────────────────────────
        if (e.stickyStacks > 0) {
            const intensity = Math.min(1, e.stickyStacks / 10);
            CTX.save();
            CTX.globalAlpha = 0.40 * intensity;
            CTX.fillStyle = '#00ff88';
            CTX.beginPath(); CTX.arc(sx, sy, R, 0, Math.PI * 2); CTX.fill();
            // Stack count pip dots above entity
            if (e.stickyStacks >= 3) {
                const pipCount = Math.min(e.stickyStacks, 6);
                CTX.globalAlpha = 0.85;
                CTX.fillStyle = '#00ff88';
                CTX.shadowBlur = 5;
                CTX.shadowColor = '#00ff88';
                for (let pi = 0; pi < pipCount; pi++) {
                    const pa = (pi / pipCount) * Math.PI * 2 - Math.PI / 2;
                    CTX.beginPath();
                    CTX.arc(sx + Math.cos(pa) * (R + 6), sy + Math.sin(pa) * (R + 6), 2, 0, Math.PI * 2);
                    CTX.fill();
                }
                CTX.shadowBlur = 0;
            }
            CTX.restore();
        }

        // ── Ignite — pulsing fire ring + inner ember tint ─────
        if ((e.igniteTimer ?? 0) > 0) {
            const igPulse = 0.50 + Math.sin(now / 75) * 0.30;
            CTX.save();
            // Outer ring
            CTX.globalAlpha = igPulse;
            CTX.strokeStyle = '#f97316';
            CTX.lineWidth = 2.5;
            CTX.shadowBlur = 14;
            CTX.shadowColor = '#f97316';
            CTX.beginPath(); CTX.arc(sx, sy, R + 4, 0, Math.PI * 2); CTX.stroke();
            // Second thinner outer ring (shimmer)
            CTX.globalAlpha = igPulse * 0.55;
            CTX.strokeStyle = '#fbbf24';
            CTX.lineWidth = 1;
            CTX.shadowBlur = 6;
            CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(sx, sy, R + 7 + Math.sin(now / 60) * 2, 0, Math.PI * 2); CTX.stroke();
            // Inner ember fill
            CTX.globalAlpha = igPulse * 0.22;
            CTX.fillStyle = '#fb923c';
            CTX.shadowBlur = 0;
            CTX.beginPath(); CTX.arc(sx, sy, R, 0, Math.PI * 2); CTX.fill();
            CTX.restore();
        }
    }

    // ── Basic Enemy (Corrupted Student Drone) ────────────────
    static drawEnemy(e) {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  BASIC ENEMY — Corrupted Student Drone                  ║
        // ║  Slim gray/purple bean · Dual visor · Spiked hands      ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(e.x, e.y);
        const now = Date.now(); // single call — reused throughout
        const R = e.radius;
        const sx = screen.x, sy = screen.y;
        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

        // ── Ground shadow ─────────────────────────────────────────────
        EnemyRenderer._drawGroundShadow(sx, sy, R, 0.22, 4);

        // ── Body Block (Body Anti-Flip) ───────────────────────────────
        CTX.save();
        CTX.translate(sx, sy);
        if (isFacingLeft) CTX.scale(-1, 1);

        // Breathing squash/stretch
        const breathe = Math.sin(now / 200);
        CTX.scale(1 + breathe * 0.028, 1 - breathe * 0.028);

        // ── Outer glow ring (corrupted purple) ───────────────────────
        const glowPulse = 0.45 + Math.sin(now / 320) * 0.20;
        CTX.shadowBlur = 12;
        CTX.shadowColor = `rgba(168,85,247,${glowPulse})`;
        CTX.strokeStyle = `rgba(168,85,247,${glowPulse * 0.80})`;
        CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(0, 0, R + 2, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Bean body — charcoal/gray-purple radial gradient ──────────
        const bodyG = CTX.createRadialGradient(-R * 0.25, -R * 0.25, 1, 0, 0, R);
        bodyG.addColorStop(0, '#5a5a7a');
        bodyG.addColorStop(0.5, '#2d2d44');
        bodyG.addColorStop(1, '#1a1a2e');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();

        // Thick outline
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();

        // Specular highlight — top-left dome
        CTX.fillStyle = 'rgba(255,255,255,0.12)';
        CTX.beginPath(); CTX.arc(-R * 0.32, -R * 0.32, R * 0.32, 0, Math.PI * 2); CTX.fill();

        // ── Corrupted circuit lines on body surface ───────────────────
        CTX.save();
        CTX.beginPath(); CTX.arc(0, 0, R - 0.5, 0, Math.PI * 2); CTX.clip();
        CTX.strokeStyle = 'rgba(168,85,247,0.22)'; CTX.lineWidth = 0.8;
        CTX.beginPath(); CTX.moveTo(-R, 0); CTX.lineTo(-R * 0.4, 0); CTX.lineTo(-R * 0.4, R * 0.5); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(R * 0.1, -R); CTX.lineTo(R * 0.1, -R * 0.4); CTX.lineTo(R * 0.5, -R * 0.4); CTX.stroke();
        // Node dots
        CTX.fillStyle = 'rgba(168,85,247,0.40)';
        for (const [nx, ny] of [[-R * 0.4, 0], [-R * 0.4, R * 0.5], [R * 0.1, -R * 0.4], [R * 0.5, -R * 0.4]]) {
            CTX.beginPath(); CTX.arc(nx, ny, 1.2, 0, Math.PI * 2); CTX.fill();
        }
        CTX.restore();

        // ── Dual visor slits (side-by-side, glowing red) ─────────────
        const visorPulse = 0.70 + Math.sin(now / 280) * 0.28;
        const vp2 = 0.55 + Math.sin(now / 220 + 0.9) * 0.28;
        // Left shard
        CTX.fillStyle = `rgba(239,68,68,${visorPulse})`;
        CTX.shadowBlur = 12 * visorPulse; CTX.shadowColor = '#ef4444';
        CTX.beginPath(); CTX.roundRect(-R * 0.45, -R * 0.22, R * 0.38, R * 0.18, R * 0.05); CTX.fill();
        // Right shard (slightly offset, slightly different pulse)
        CTX.fillStyle = `rgba(239,68,68,${vp2})`;
        CTX.shadowBlur = 10 * vp2;
        CTX.beginPath(); CTX.roundRect(R * 0.08, -R * 0.22, R * 0.38, R * 0.18, R * 0.05); CTX.fill();
        // Ambient glow behind both
        CTX.fillStyle = `rgba(239,68,68,${visorPulse * 0.14})`;
        CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.roundRect(-R * 0.50, -R * 0.36, R * 1.05, R * 0.52, R * 0.16); CTX.fill();

        CTX.restore(); // end body transform

        // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
        CTX.save();
        CTX.translate(sx, sy);
        CTX.rotate(e.angle);
        if (isFacingLeft) CTX.scale(1, -1);

        const handR = R * 0.38;

        // Front hand — weapon-pointing side
        CTX.fillStyle = '#3b3b55'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.shadowBlur = 6; CTX.shadowColor = 'rgba(168,85,247,0.55)';
        CTX.beginPath(); CTX.arc(R + 7, 0, handR, 0, Math.PI * 2); CTX.fill(); CTX.stroke();

        // Front spike — larger jagged triangle + inner glow tip
        const fsx = R + 7 + handR;
        CTX.fillStyle = '#ef4444';
        CTX.shadowBlur = 8; CTX.shadowColor = '#ef4444';
        CTX.beginPath();
        CTX.moveTo(fsx, -1.5);   // base top
        CTX.lineTo(fsx + 9, 0);     // tip
        CTX.lineTo(fsx, 5);     // base bottom
        CTX.lineTo(fsx - 1.5, 1.5);   // notch
        CTX.closePath(); CTX.fill();
        // Spike highlight
        CTX.fillStyle = 'rgba(255,150,150,0.50)';
        CTX.beginPath();
        CTX.moveTo(fsx, -1.5); CTX.lineTo(fsx + 9, 0); CTX.lineTo(fsx, 1); CTX.closePath(); CTX.fill();
        CTX.shadowBlur = 0;

        // Back hand — off-side
        CTX.fillStyle = '#2d2d44'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.shadowBlur = 3; CTX.shadowColor = 'rgba(168,85,247,0.35)';
        CTX.beginPath(); CTX.arc(-(R + 6), 0, handR - 1, 0, Math.PI * 2); CTX.fill(); CTX.stroke();

        // Back spike
        const bsx = -(R + 6 + handR - 1);
        CTX.fillStyle = '#c03030';
        CTX.beginPath();
        CTX.moveTo(bsx, -1);
        CTX.lineTo(bsx - 7, 0);
        CTX.lineTo(bsx, 4);
        CTX.closePath(); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // end weapon block

        // ── Shared status overlays (hit flash, sticky, ignite) ────────
        EnemyRenderer._drawStatusOverlays(e, sx, sy, R, now);

        // ── HP bar ────────────────────────────────────────────────────
        EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 30, 10, now);
    }

    // ── Tank Enemy (Heavy Armored Brute) ─────────────────────
    static drawTank(e) {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  TANK ENEMY — Heavy Armored Brute                       ║
        // ║  Wide dark-red bean · Layered armor · Kite-shield fists  ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(e.x, e.y);
        const now = Date.now();
        const R = e.radius;
        const sx = screen.x, sy = screen.y;
        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

        // ── Ground shadow (wider for big body) ───────────────────────
        EnemyRenderer._drawGroundShadow(sx, sy, R, 0.30, 5);

        // ── Body Block (Body Anti-Flip) ───────────────────────────────
        CTX.save();
        CTX.translate(sx, sy);
        if (isFacingLeft) CTX.scale(-1, 1);

        // Tank breathes slower, heavier
        const breathe = Math.sin(now / 320);
        CTX.scale(1 + breathe * 0.022, 1 - breathe * 0.022);

        // ── Threat glow ring ─────────────────────────────────────────
        const threatPulse = 0.55 + Math.sin(now / 250) * 0.22;
        CTX.shadowBlur = 16;
        CTX.shadowColor = `rgba(185,28,28,${threatPulse})`;
        CTX.strokeStyle = `rgba(185,28,28,${threatPulse * 0.75})`;
        CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R + 3, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Main bean body — wide dark-red (1.15× X scale) ───────────
        CTX.save(); CTX.scale(1.15, 1.0);
        const bodyG = CTX.createRadialGradient(-R * 0.30, -R * 0.30, 1, 0, 0, R);
        bodyG.addColorStop(0, '#8f2020');
        bodyG.addColorStop(0.50, '#4a0d0d');
        bodyG.addColorStop(1, '#2d0606');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();
        CTX.restore();

        // ── Layered armor plates ──────────────────────────────────────
        // Front chest plate
        CTX.fillStyle = '#57121a';
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.8;
        CTX.beginPath();
        CTX.moveTo(R * 0.05, -R * 0.62);
        CTX.lineTo(R * 0.68, -R * 0.32);
        CTX.lineTo(R * 0.72, R * 0.28);
        CTX.lineTo(R * 0.05, R * 0.62);
        CTX.quadraticCurveTo(R * 0.3, R * 0.45, R * 0.05, R * 0.30);
        CTX.closePath(); CTX.fill(); CTX.stroke();

        // Shoulder pauldron
        CTX.fillStyle = '#6b1515';
        CTX.beginPath();
        CTX.arc(0, -R * 0.65, R * 0.28, Math.PI, 0);
        CTX.lineTo(R * 0.28, -R * 0.45);
        CTX.lineTo(-R * 0.28, -R * 0.45);
        CTX.closePath(); CTX.fill(); CTX.stroke();

        // Rivets
        CTX.fillStyle = '#2d0606';
        CTX.shadowBlur = 4; CTX.shadowColor = '#ef4444';
        for (const [rx, ry] of [[R * 0.45, -R * 0.35], [R * 0.50, R * 0.05], [R * 0.42, R * 0.35]]) {
            CTX.beginPath(); CTX.arc(rx, ry, 2.2, 0, Math.PI * 2); CTX.fill();
        }
        CTX.shadowBlur = 0;

        // ── Overheating slit — orange engine glow ────────────────────
        const heatPulse = 0.5 + Math.sin(now / 220) * 0.45;
        CTX.fillStyle = `rgba(251,146,60,${heatPulse * 0.90})`;
        CTX.shadowBlur = 10 * heatPulse; CTX.shadowColor = '#fb923c';
        CTX.beginPath(); CTX.roundRect(R * 0.18, -R * 0.08, R * 0.42, R * 0.18, R * 0.05); CTX.fill();
        // Second glint line above slit
        CTX.fillStyle = `rgba(255,200,100,${heatPulse * 0.45})`;
        CTX.shadowBlur = 4;
        CTX.beginPath(); CTX.roundRect(R * 0.20, -R * 0.12, R * 0.38, R * 0.04, 1); CTX.fill();
        CTX.shadowBlur = 0;

        // Specular highlight
        CTX.fillStyle = 'rgba(255,255,255,0.08)';
        CTX.beginPath(); CTX.arc(-R * 0.30, -R * 0.30, R * 0.28, 0, Math.PI * 2); CTX.fill();

        CTX.restore(); // end body transform

        // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
        CTX.save();
        CTX.translate(sx, sy);
        CTX.rotate(e.angle);
        if (isFacingLeft) CTX.scale(1, -1);

        // Front kite-shield hand
        const shieldGlow = 0.40 + Math.sin(now / 180) * 0.25;
        CTX.fillStyle = '#57121a'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5;
        CTX.shadowBlur = 10 * shieldGlow; CTX.shadowColor = '#dc2626';
        CTX.beginPath();
        CTX.moveTo(R + 5, -R * 0.55);
        CTX.lineTo(R + 13, -R * 0.15);
        CTX.lineTo(R + 14, R * 0.30);
        CTX.lineTo(R + 5, R * 0.68);
        CTX.lineTo(R - 2, R * 0.30);
        CTX.lineTo(R - 1, -R * 0.15);
        CTX.closePath(); CTX.fill(); CTX.stroke();
        // Shield boss + glow
        CTX.fillStyle = '#dc2626';
        CTX.shadowBlur = 8; CTX.shadowColor = '#ef4444';
        CTX.beginPath(); CTX.arc(R + 6, 0, 4, 0, Math.PI * 2); CTX.fill();
        // Cross scratch on shield boss
        CTX.strokeStyle = 'rgba(255,100,100,0.40)'; CTX.lineWidth = 1;
        CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.moveTo(R + 3, 0); CTX.lineTo(R + 9, 0); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(R + 6, -3); CTX.lineTo(R + 6, 3); CTX.stroke();

        // Back gauntlet
        CTX.fillStyle = '#3d0808'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5;
        CTX.shadowBlur = 5; CTX.shadowColor = '#dc2626';
        CTX.beginPath(); CTX.arc(-(R + 7), 0, R * 0.42, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        // Knuckle ridge
        CTX.strokeStyle = '#5c1010'; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.moveTo(-(R + 4), -3); CTX.lineTo(-(R + 10), -3); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-(R + 4), 1); CTX.lineTo(-(R + 10), 1); CTX.stroke();
        CTX.shadowBlur = 0;

        CTX.restore(); // end weapon transform

        // ── Shared status overlays (hit flash, sticky, ignite) ────────
        EnemyRenderer._drawStatusOverlays(e, sx, sy, R, now);

        // ── HP bar (wider — tank has more HP to show) ─────────────────
        EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 44, 12, now);
    }

    // ── Mage Enemy (Arcane Shooter Drone) ────────────────────
    static drawMage(e) {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  MAGE ENEMY — Arcane Shooter Drone                      ║
        // ║  Sleek green diamond-bean · Blaster · Floating orb hands ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(e.x, e.y);
        const now = Date.now();
        const R = e.radius;
        const sx = screen.x, sy = screen.y;
        const bobOffset = Math.sin(now / 300) * 3; // hover float
        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

        // ── Ground shadow (offset — mage floats above) ───────────────
        CTX.save();
        CTX.globalAlpha = 0.14;
        CTX.fillStyle = 'rgba(0,0,0,0.85)';
        CTX.beginPath();
        CTX.ellipse(sx, sy + R + 10, R * 0.75, 3.5, 0, 0, Math.PI * 2);
        CTX.fill();
        CTX.restore();

        // ── Body Block (Body Anti-Flip + float bob) ───────────────────
        CTX.save();
        CTX.translate(sx, sy + bobOffset);
        if (isFacingLeft) CTX.scale(-1, 1);

        // Breathing
        const breathe = Math.sin(now / 170);
        CTX.scale(1 + breathe * 0.025, 1 - breathe * 0.030);

        // ── Arcane outer aura ring ────────────────────────────────────
        const auraA = 0.45 + Math.sin(now / 240) * 0.22;
        CTX.shadowBlur = 16;
        CTX.shadowColor = 'rgba(126,34,206,0.85)';
        CTX.strokeStyle = `rgba(167,139,250,${auraA})`;
        CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(0, 0, R + 3, 0, Math.PI * 2); CTX.stroke();
        // Thin spinning accent ring (rotates with now)
        CTX.save();
        CTX.rotate(now / 1800);
        CTX.strokeStyle = `rgba(74,222,128,${auraA * 0.45})`;
        CTX.lineWidth = 1;
        CTX.setLineDash([4, 6]);
        CTX.beginPath(); CTX.arc(0, 0, R + 6, 0, Math.PI * 2); CTX.stroke();
        CTX.setLineDash([]);
        CTX.restore();
        CTX.shadowBlur = 0;

        // ── Bean body — emerald gradient, diamond silhouette ──────────
        CTX.save(); CTX.scale(0.88, 1.12); // taller/narrower = diamond
        const bodyG = CTX.createRadialGradient(-R * 0.25, -R * 0.30, 1, 0, 0, R);
        bodyG.addColorStop(0, '#1a7a40');
        bodyG.addColorStop(0.50, '#14532d');
        bodyG.addColorStop(1, '#052e16');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();
        CTX.restore();

        // Specular highlight
        CTX.fillStyle = 'rgba(255,255,255,0.13)';
        CTX.beginPath(); CTX.arc(-R * 0.28, -R * 0.32, R * 0.26, 0, Math.PI * 2); CTX.fill();

        // ── Rune markings on body ─────────────────────────────────────
        CTX.save();
        CTX.beginPath(); CTX.arc(0, 0, R - 0.5, 0, Math.PI * 2); CTX.clip();
        CTX.strokeStyle = 'rgba(74,222,128,0.20)'; CTX.lineWidth = 0.8;
        // Horizontal arcane band
        CTX.beginPath(); CTX.moveTo(-R, R * 0.35); CTX.lineTo(R, R * 0.35); CTX.stroke();
        // Vertical center line
        CTX.beginPath(); CTX.moveTo(0, -R); CTX.lineTo(0, R); CTX.stroke();
        // Diamond cross
        CTX.beginPath();
        CTX.moveTo(0, -R * 0.55); CTX.lineTo(R * 0.38, 0);
        CTX.lineTo(0, R * 0.55); CTX.lineTo(-R * 0.38, 0);
        CTX.closePath(); CTX.stroke();
        CTX.restore();

        // ── Arcane energy core — glowing belly rune ───────────────────
        const coreP = Math.max(0, 0.4 + Math.sin(now / 190) * 0.55);
        CTX.fillStyle = `rgba(74,222,128,${coreP})`;
        CTX.shadowBlur = 16 * coreP; CTX.shadowColor = '#22c55e';
        CTX.beginPath(); CTX.arc(0, R * 0.15, R * 0.28, 0, Math.PI * 2); CTX.fill();
        // Inner hot core
        CTX.fillStyle = `rgba(255,255,255,${coreP * 0.65})`;
        CTX.shadowBlur = 6 * coreP;
        CTX.beginPath(); CTX.arc(0, R * 0.15, R * 0.11, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // end body transform

        // ── Weapon Block (Weapon Anti-Flip + float bob) ───────────────
        CTX.save();
        CTX.translate(sx, sy + bobOffset);
        CTX.rotate(e.angle);
        if (isFacingLeft) CTX.scale(1, -1);

        // ── Blaster barrel ────────────────────────────────────────────
        CTX.fillStyle = '#1a2a1a';
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.roundRect(R * 0.5, -R * 0.13, R * 0.82, R * 0.28, R * 0.06); CTX.fill(); CTX.stroke();
        // Energy channel slit
        const blasterA = 0.7 + Math.sin(now / 200) * 0.28;
        CTX.fillStyle = `rgba(74,222,128,${blasterA})`;
        CTX.shadowBlur = 10 * blasterA; CTX.shadowColor = '#22c55e';
        CTX.beginPath(); CTX.roundRect(R * 0.55, -R * 0.06, R * 0.74, R * 0.14, R * 0.04); CTX.fill();
        // Muzzle ring
        CTX.strokeStyle = `rgba(134,239,172,${blasterA})`; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.arc(R * 1.34, 0, R * 0.15, 0, Math.PI * 2); CTX.stroke();
        // Muzzle charge dot
        if (blasterA > 0.85) {
            CTX.fillStyle = `rgba(255,255,255,${(blasterA - 0.85) * 5})`;
            CTX.shadowBlur = 8; CTX.shadowColor = '#22c55e';
            CTX.beginPath(); CTX.arc(R * 1.34, 0, R * 0.07, 0, Math.PI * 2); CTX.fill();
        }
        CTX.shadowBlur = 0;

        // ── Floating Arcane Orb Hands ─────────────────────────────────
        const orbPulse = 0.60 + Math.sin(now / 210 + 1.0) * 0.35;
        // Front orb — green
        CTX.fillStyle = '#14532d';
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.shadowBlur = 10 * orbPulse; CTX.shadowColor = '#22c55e';
        CTX.beginPath(); CTX.arc(R + 4, R * 0.55, R * 0.36, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.fillStyle = `rgba(74,222,128,${orbPulse * 0.80})`;
        CTX.beginPath(); CTX.arc(R + 4, R * 0.55, R * 0.18, 0, Math.PI * 2); CTX.fill();
        // Orb inner sparkle
        CTX.fillStyle = `rgba(255,255,255,${orbPulse * 0.55})`;
        CTX.shadowBlur = 4;
        CTX.beginPath(); CTX.arc(R + 3, R * 0.50, R * 0.06, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // Back orb — dimmer violet
        CTX.fillStyle = '#1a0a2e';
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.shadowBlur = 6; CTX.shadowColor = 'rgba(126,34,206,0.55)';
        CTX.beginPath(); CTX.arc(-(R + 4), R * 0.30, R * 0.30, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.fillStyle = `rgba(167,139,250,${orbPulse * 0.55})`;
        CTX.beginPath(); CTX.arc(-(R + 4), R * 0.30, R * 0.13, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // end weapon transform

        // ── Shared status overlays (hit flash, sticky, ignite) ────────
        // Note: use sy + bobOffset so overlays align with floating body
        EnemyRenderer._drawStatusOverlays(e, sx, sy + bobOffset, R, now);

        // ── HP bar ────────────────────────────────────────────────────
        EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 30, 14, now);
    }

    // ── Power-Up ─────────────────────────────────────────────
    static drawPowerUp(e) {
        const screen = worldToScreen(e.x, e.y + Math.sin(e.bobTimer) * 5);
        CTX.save(); CTX.translate(screen.x, screen.y);
        CTX.shadowBlur = 20; CTX.shadowColor = e.colors[e.type];
        CTX.font = '32px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillText(e.icons[e.type], 0, 0); CTX.restore();
    }
}

window.EnemyRenderer = EnemyRenderer;