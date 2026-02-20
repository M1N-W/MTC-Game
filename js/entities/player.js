'use strict';
/**
 * js/entities/player.js
 *
 * ► Player      — Kao (main character, stealth/crit build)
 * ► PoomPlayer  — Poom (rice-eating / naga-summoning build)
 * ► NagaEntity  — Poom's snake summon
 * ► Drone       — Player's AI companion drone
 * ► BarkWave    — Boss bark projectile (lives here per refactor plan)
 *
 * Depends on: base.js  (Entity, _standAura_update, _standAura_draw)
 *
 * ────────────────────────────────────────────────────────────────
 * FIXES (QA Integrity Report — Zone 1)
 * ────────────────────────────────────────────────────────────────
 * ✅ BUG 2  — Mobile Patch: Removed redundant velocity calculation that
 *             double-applied joystick acceleration (2× speed on touch).
 *
 * ✅ WARN 5 — DRY Principle: Obstacle-awareness block extracted to
 *             Player.prototype.checkObstacleProximity(ax, ay, dt, color).
 *             PoomPlayer.prototype gets the same reference.
 *
 * ────────────────────────────────────────────────────────────────
 * FIXES (Logic & Inheritance Audit — Zone 2)
 * ────────────────────────────────────────────────────────────────
 * ✅ CRIT 1 — PoomPlayer Redundancy (Option B): Five identical methods
 *             shared via prototype assignment.
 *
 * ✅ CRIT 2 — NagaEntity now extends Entity properly via super().
 *
 * ✅ WARN 1 — Dash Safety: setTimeout callbacks guarded with `if (!this.dead)`.
 *
 * ✅ WARN 2 — Naming Consistency: afterImages/afterimages → dashGhosts/standGhosts.
 *
 * ────────────────────────────────────────────────────────────────
 * FIXES (Build Debugger — Zone 3)
 * ────────────────────────────────────────────────────────────────
 * ✅ BUG A — PoomPlayer.prototype.checkPassiveUnlock added to Option B block.
 *
 * ✅ BUG B — NagaEntity.update() target reverted to mouse.wx / mouse.wy.
 *
 * ────────────────────────────────────────────────────────────────
 * AUDIO ADDITIONS (Lead Gameplay Developer pass)
 * ────────────────────────────────────────────────────────────────
 * ✅ AUDIO 1 — PoomPlayer.shoot() now calls Audio.playPoomShoot() on every
 *              projectile fire (bamboo-tube thump; defined in audio.js).
 *
 * ✅ AUDIO 2 — NagaEntity now tracks this.lastSoundTime (Date.now() ms).
 *              Audio.playNagaAttack() fires on enemy/boss hit, but no more
 *              than once per NAGA_SOUND_INTERVAL ms (220 ms) to prevent
 *              rapid-tick audio stacking from the continuous collision loop.
 *
 * ────────────────────────────────────────────────────────────────
 * ANIMATION CLARITY + SILHOUETTE (Game Engine Architect — v11)
 * ────────────────────────────────────────────────────────────────
 * ✅ RECOIL (Kao / Player):
 *     • Player.weaponRecoil — float 0→1; set to 1.0 by triggerRecoil()
 *       (called from game.js after weaponSystem.shoot() returns projectiles).
 *     • Decays at weaponRecoilDecay (8.5 /sec) in Player.update() → ~0.12 s fade.
 *     • Player.draw(): body lean — CTX.translate(-recoilShift, 0) pushes the
 *       sprite 4 px backward along its own axis at peak recoil.
 *     • Muzzle-flash ring: when weaponRecoil > 0.45, an expanding white/gold
 *       ring + bright core is drawn at the muzzle tip in screen space.
 *
 * ✅ CHANNELING EFFECT (Poom / PoomPlayer):
 *     • PoomPlayer.draw() checks window.specialEffects for any live NagaEntity.
 *     • When channeling: animated double emerald ring with pulsing shadowBlur,
 *       offset-phase inner ring, and random spark dots on the ring edge.
 *     • Zero performance cost when no Naga is active (check is O(n) on
 *       specialEffects which is always tiny).
 *
 * ✅ SILHOUETTE OUTER GLOW (both characters):
 *     • Drawn BEFORE the body fill so the neon stroke sits behind sprite layers.
 *     • Kao : rgba(0,255,65,0.70) — neon green, shadowBlur 16, lineWidth 2.8
 *     • Poom: rgba(168,85,247,0.72) — deep purple, shadowBlur 16, lineWidth 2.8
 *     • Colours match each character's stand-aura identity from base.js.
 */

// Minimum gap (ms) between successive Naga hit sounds.
// 220 ms ≈ ~13 frames @ 60 fps — responsive but audibly separated.
const NAGA_SOUND_INTERVAL = 220;

// ════════════════════════════════════════════════════════════
// PLAYER (generic — supports any charId from BALANCE.characters)
// ════════════════════════════════════════════════════════════
class Player extends Entity {
    constructor(charId = 'kao') {
        const stats = BALANCE.characters[charId];
        super(0, 0, stats.radius);

        this.charId = charId;
        this.stats  = stats;

        this.hp        = stats.hp;
        this.maxHp     = stats.maxHp;
        this.energy    = stats.energy;
        this.maxEnergy = stats.maxEnergy;

        this.cooldowns = { dash: 0, stealth: 0, shoot: 0 };

        this.isDashing     = false;
        this.isInvisible   = false;
        this.ambushReady   = false;
        this.walkCycle     = 0;

        this.damageBoost     = 1;
        this.speedBoost      = 1;
        this.speedBoostTimer = 0;
        this.dashGhosts      = [];
        
        // ── Timeout Management ───────────────────────────────────
        // Store setTimeout IDs to prevent memory leaks when player dies
        this.dashTimeouts     = [];

        // ── Weapon Recoil (v11) ───────────────────────────────────
        // Set to 1.0 by triggerRecoil() on each shot; decays to 0 over ~0.12 s.
        // Drives a backward body-lean and muzzle-flash ring in draw().
        this.weaponRecoil      = 0;
        this.weaponRecoilDecay = 8.5; // units/sec; 1/8.5 ≈ 0.12 s full decay

        // ── Stand-Aura & Afterimage system ────────────────────
        this.standGhosts   = [];
        this.auraRotation  = 0;
        this._auraFrame    = 0;

        this.onGraph       = false;
        this.isConfused    = false; this.confusedTimer = 0;
        this.isBurning     = false; this.burnTimer = 0; this.burnDamage = 0;

        this.level          = 1;
        this.exp            = 0;
        this.expToNextLevel = stats.expToNextLevel;

        // ── RPG Scaling Multipliers ─────────────────────────────
        // Permanent progression: damage increases, cooldowns decrease per level
        this.damageMultiplier = 1.0;
        this.cooldownMultiplier = 1.0;

        this.baseCritChance  = stats.baseCritChance;
        this.passiveUnlocked = false;
        this.stealthUseCount = 0;
        this.goldenAuraTimer = 0;

        // ── Collision Awareness state ──────────────────────────
        this.obstacleBuffTimer     = 0;
        this.lastObstacleWarning   = 0;

        // ── Restore persistent passive ─────────────────────────
        try {
            const saved = getSaveData();
            const myId  = this.charId;
            if (Array.isArray(saved.unlockedPassives) && saved.unlockedPassives.includes(myId)) {
                this.passiveUnlocked = true;
                const hpBonus = Math.floor(this.maxHp * stats.passiveHpBonusPct);
                this.maxHp += hpBonus;
                this.hp    += hpBonus;
                console.log(`[MTC Save] Passive restored for '${myId}'.`);
            }
        } catch (e) {
            console.warn('[MTC Save] Could not restore passive:', e);
        }
    }

    get S() { return this.stats; }

    update(dt, keys, mouse) {
        const S   = this.stats;
        const PHY = BALANCE.physics;

        if (this.isBurning) {
            this.burnTimer -= dt;
            this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15,15), this.y + rand(-15,15), 1, '#f59e0b');
        }
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
        if (this.goldenAuraTimer > 0) {
            this.goldenAuraTimer -= dt;
            if (Math.random() < 0.5) spawnParticles(this.x + rand(-25,25), this.y + rand(-25,25), 1, '#fbbf24');
        }

        let ax = 0, ay = 0, isTouchMove = false;
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            ax = window.touchJoystickLeft.nx; ay = window.touchJoystickLeft.ny; isTouchMove = true;
        } else {
            if (keys.w) ay -= 1; if (keys.s) ay += 1;
            if (keys.a) ax -= 1; if (keys.d) ax += 1;
        }
        if (this.isConfused) { ax *= -1; ay *= -1; }
        if (ax || ay) {
            if (!isTouchMove) { const len = Math.hypot(ax, ay); ax /= len; ay /= len; }
            this.walkCycle += dt * 15;
        } else { this.walkCycle = 0; }

        let speedMult = (this.isInvisible ? S.stealthSpeedBonus : 1) * this.speedBoost;
        if (this.speedBoostTimer > 0) speedMult += S.speedOnHit / S.moveSpeed;
        if (this.obstacleBuffTimer > 0) speedMult *= BALANCE.player.obstacleBuffPower;

        if (!this.isDashing) {
            this.vx += ax * PHY.acceleration * dt;
            this.vy += ay * PHY.acceleration * dt;
            this.vx *= PHY.friction;
            this.vy *= PHY.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > S.moveSpeed * speedMult) {
                const scale = S.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);

        if (!this.isDashing) {
            this.checkObstacleProximity(ax, ay, dt, '#93c5fd');
        }

        if (this.cooldowns.dash    > 0) this.cooldowns.dash    -= dt;
        if (this.cooldowns.stealth > 0) this.cooldowns.stealth -= dt;

        if (keys.space && this.cooldowns.dash <= 0) { this.dash(ax || 1, ay || 0); keys.space = 0; }

        if (mouse.right && this.cooldowns.stealth <= 0 && !this.isInvisible && this.energy >= S.stealthCost) {
            this.activateStealth(); mouse.right = 0;
        }
        if (this.isInvisible) {
            this.energy -= S.stealthDrain * dt;
            if (this.energy <= 0) { this.energy = 0; this.breakStealth(); }
        } else {
            this.energy = Math.min(this.maxEnergy, this.energy + S.energyRegen * dt);
        }

        if (window.touchJoystickRight && window.touchJoystickRight.active) {
            this.angle = Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        } else {
            this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);
        }

        for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
            this.dashGhosts[i].life -= dt * 5;
            if (this.dashGhosts[i].life <= 0) this.dashGhosts.splice(i, 1);
        }

        // ── Recoil decay (v11) ───────────────────────────────────
        // weaponRecoil is set to 1.0 by triggerRecoil() in game.js after
        // each successful shot. It decays to 0 over ~0.12 s, driving the
        // backward body-lean + muzzle-flash ring rendered in draw().
        if (this.weaponRecoil > 0) {
            this.weaponRecoil = Math.max(0, this.weaponRecoil - this.weaponRecoilDecay * dt);
        }

        _standAura_update(this, dt);
        
        // ── Cleanup dash timeouts (foolproof) ───────────────────
        // If the player dies mid-dash, ensure ALL scheduled dash callbacks are
        // cancelled immediately so they cannot retain references or mutate state.
        if (this.dead && this.dashTimeouts && this.dashTimeouts.length) {
            const ids = this.dashTimeouts.slice();
            this.dashTimeouts.length = 0;
            for (const timeoutId of ids) {
                try { clearTimeout(timeoutId); } catch (e) {}
            }
        }
        
        this.updateUI();
    }

    /**
     * triggerRecoil()
     * Called by game.js after weaponSystem.shoot() fires projectiles.
     * Kicks the recoil animation — draw() will show a body lean + muzzle flash
     * that self-clears in ~0.12 s via the per-frame weaponRecoil decay.
     */
    triggerRecoil() {
        this.weaponRecoil = 1.0;
    }

    activateStealth() {
        const S = this.stats;
        this.isInvisible = true; this.ambushReady = true;
        this.energy -= S.stealthCost;
        this.stealthUseCount++;
        spawnParticles(this.x, this.y, 25, '#facc15');
        showVoiceBubble('เข้าโหมดซุ่ม!', this.x, this.y - 40);
        this.checkPassiveUnlock();
        Achievements.stats.stealths++; Achievements.check('ghost');
    }

    breakStealth() {
        this.isInvisible = false;
        this.cooldowns.stealth = this.stats.stealthCooldown * this.cooldownMultiplier;
    }

    /**
     * dash(ax, ay)
     * Launches a short directional burst, spawns blue ghost trail images,
     * and grants i-frames for the 200 ms dash window.
     *
     * BUG FIX: This method was previously missing from Player entirely —
     * it only existed on PoomPlayer. Player.update() called this.dash()
     * unconditionally on [Space], causing "this.dash is not a function"
     * the moment Kao was selected.
     */
    dash(ax, ay) {
        const S = this.stats;
        if (this.isDashing) return;                      // guard re-entry
        this.isDashing      = true;
        this.cooldowns.dash = S.dashCooldown;

        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        let dashSpeed = S.dashDistance / 0.2;
        // Matrix Dash: during Bullet Time, dash covers massive distance almost instantly.
        // Clamp timeScale to prevent division by 0 / Infinity / NaN.
        let currentScale = 1.0;
        if (typeof window.timeScale === 'number' && Number.isFinite(window.timeScale)) {
            currentScale = window.timeScale;
        }
        currentScale = Math.min(10.0, Math.max(0.1, currentScale));
        if (currentScale < 1.0) {
            const matrixMult = (1 / currentScale) * 1.5;
            dashSpeed *= matrixMult;
        }
        this.vx = Math.cos(angle) * dashSpeed;
        this.vy = Math.sin(angle) * dashSpeed;

        // Ghost trail — staggered snapshots captured during the dash window
        for (let i = 0; i < 5; i++) {
            const timeoutId = setTimeout(() => {
                if (!this.dead) {
                    this.dashGhosts.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
                }
                // Remove timeout ID from array after execution
                const idx = this.dashTimeouts.indexOf(timeoutId);
                if (idx > -1) this.dashTimeouts.splice(idx, 1);
            }, i * 30);
            this.dashTimeouts.push(timeoutId);
        }

        spawnParticles(this.x, this.y, 15, '#60a5fa');   // Kao blue
        Audio.playDash();
        Achievements.stats.dashes++;
        Achievements.check('speedster');

        const dashEndTimeoutId = setTimeout(() => { if (!this.dead) this.isDashing = false; }, 200);
        this.dashTimeouts.push(dashEndTimeoutId);
    }

    checkPassiveUnlock() {
        const S = this.stats;
        if (!this.passiveUnlocked && this.level >= S.passiveUnlockLevel && this.stealthUseCount >= S.passiveUnlockStealthCount) {
            this.passiveUnlocked = true;
            const hpBonus = Math.floor(this.maxHp * S.passiveHpBonusPct);
            this.maxHp += hpBonus; this.hp += hpBonus;
            spawnFloatingText('ปลดล็อค: ซุ่มเสรี!', this.x, this.y - 60, '#fbbf24', 30);
            spawnParticles(this.x, this.y, 50, '#fbbf24');
            addScreenShake(15); this.goldenAuraTimer = 3;
            Audio.playAchievement();
            showVoiceBubble("ทักษะ 'ซุ่มเสรี' ปลดล็อคแล้ว!", this.x, this.y - 40);
            try {
                const saved = getSaveData();
                const set   = new Set(saved.unlockedPassives || []);
                set.add(this.charId);
                updateSaveData({ unlockedPassives: [...set] });
            } catch (e) {
                console.warn('[MTC Save] Could not persist passive unlock:', e);
            }
        }
    }

    gainExp(amount) {
        this.exp += amount;
        spawnFloatingText(`+${amount} EXP`, this.x, this.y - 50, '#8b5cf6', 14);
        while (this.exp >= this.expToNextLevel) this.levelUp();
        this.updateUI();
    }

    levelUp() {
        const S = this.stats;
        this.exp -= this.expToNextLevel;
        this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * S.expLevelMult);
        
        // ── RPG Scaling Progression ─────────────────────────────
        // +5% damage per level (permanent)
        this.damageMultiplier += 0.05;
        
        // -3% cooldown per level (capped at 50% reduction)
        this.cooldownMultiplier = Math.max(0.5, this.cooldownMultiplier - 0.03);
        
        // Visual feedback for progression
        const damageBonus = Math.round((this.damageMultiplier - 1) * 100);
        const cooldownBonus = Math.round((1 - this.cooldownMultiplier) * 100);
        spawnFloatingText(`LEVEL ${this.level}! +${damageBonus}% DMG, -${cooldownBonus}% CD`, this.x, this.y - 90, '#fbbf24', 32);
        
        this.hp = this.maxHp; this.energy = this.maxEnergy;
        spawnFloatingText(`LEVEL ${this.level}!`, this.x, this.y - 70, '#facc15', 35);
        spawnParticles(this.x, this.y, 40, '#facc15');
        addScreenShake(12); Audio.playLevelUp();
        this.checkPassiveUnlock();
    }

    takeDamage(amt) {
        const S = this.stats;
        if (this.isDashing) return;
        if (this.onGraph) { amt *= 2; spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16); }
        this.hp -= amt; this.hp = Math.max(0, this.hp);
        spawnFloatingText(Math.round(amt), this.x, this.y - 30, '#ef4444');
        spawnParticles(this.x, this.y, 8, '#ef4444');
        addScreenShake(8); Audio.playHit();
        Achievements.stats.damageTaken += amt;
        if (this.hp <= 0) window.endGame('defeat');
    }

    dealDamage(baseDamage) {
        const S = this.stats;
        let damage = baseDamage, isCrit = false;
        let critChance = this.baseCritChance;
        if (this.passiveUnlocked) critChance += S.passiveCritBonus;
        if (Math.random() < critChance) {
            damage *= S.critMultiplier; isCrit = true;
            if (this.passiveUnlocked) this.goldenAuraTimer = 1;
            Achievements.stats.crits++; Achievements.check('crit_master');
        }
        if (this.passiveUnlocked) {
            const healAmount = damage * S.passiveLifesteal;
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            if (Math.random() < 0.3) spawnFloatingText(`+${Math.round(healAmount)}`, this.x, this.y - 35, '#10b981', 12);
        }
        return { damage, isCrit };
    }

    heal(amt) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
        spawnFloatingText(`+${amt} HP`, this.x, this.y - 30, '#10b981');
        spawnParticles(this.x, this.y, 10, '#10b981'); Audio.playHeal();
    }

    addSpeedBoost() { this.speedBoostTimer = this.stats.speedOnHitDuration; }

    draw() {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  KAO — Minimalist Chibi · Blue Rounded Square           ║
        // ║  Top-down sprite · No face · Hair covers top of body    ║
        // ╚══════════════════════════════════════════════════════════╝
        const now = performance.now();
        _standAura_draw(this, this.charId || 'kao');

        // ── Dash ghost trail ─────────────────────────────────────────
        for (const img of this.dashGhosts) {
            const gs = worldToScreen(img.x, img.y);
            CTX.save();
            CTX.translate(gs.x, gs.y); CTX.rotate(img.angle);
            CTX.globalAlpha = img.life * 0.35;
            CTX.fillStyle = '#60a5fa';
            CTX.shadowBlur = 8 * img.life; CTX.shadowColor = '#3b82f6';
            CTX.beginPath(); CTX.roundRect(-11, -11, 22, 22, 6); CTX.fill();
            CTX.restore();
        }

        const screen = worldToScreen(this.x, this.y);

        // ── Ground shadow ────────────────────────────────────────────
        CTX.save();
        CTX.globalAlpha = 0.22;
        CTX.fillStyle   = 'rgba(0,0,0,0.8)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 14, 14, 5, 0, 0, Math.PI * 2); CTX.fill();
        CTX.restore();

        // ── Passive aura ─────────────────────────────────────────────
        if (this.passiveUnlocked) {
            const aS = 30 + Math.sin(now / 200) * 4, aA = 0.3 + Math.sin(now / 300) * 0.1;
            CTX.save(); CTX.globalAlpha = aA;
            CTX.strokeStyle = '#fbbf24'; CTX.lineWidth = 3;
            CTX.shadowBlur = 18; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, aS, 0, Math.PI * 2); CTX.stroke();
            CTX.restore();
        }

        if (this.isConfused) { CTX.font='bold 22px Arial'; CTX.textAlign='center'; CTX.fillText('😵', screen.x, screen.y - 32); }
        if (this.isBurning)  { CTX.font='bold 18px Arial'; CTX.fillText('🔥', screen.x + 18, screen.y - 26); }

        // ── Body transform: rotates to face mouse ────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        // Recoil nudge
        if (this.weaponRecoil > 0.05) CTX.translate(-this.weaponRecoil * 3.5, 0);

        // ── Squash & stretch based on movement speed ─────────────────
        const speed     = Math.hypot(this.vx, this.vy);
        const moveT     = Math.min(1, speed / 200);
        const bobT      = Math.sin(this.walkCycle);
        // Stretch forward when moving fast, squash slightly when idle
        const stretchX  = 1 + moveT * bobT * 0.12;
        const stretchY  = 1 - moveT * Math.abs(bobT) * 0.08;
        CTX.scale(stretchX, stretchY);

        if (this.isInvisible) {
            // ── STEALTH: glitch scanlines over ghost shape ────────────
            const gT = now / 60;
            CTX.save();
            CTX.beginPath(); CTX.roundRect(-11, -11, 22, 22, 6); CTX.clip();
            for (let sy2 = -11; sy2 < 11; sy2 += 3) {
                const la = (Math.sin(gT * 4 + sy2 * 0.7) * 0.5 + 0.5) * 0.3;
                CTX.globalAlpha = la;
                CTX.fillStyle   = '#60a5fa';
                CTX.fillRect(-11 + Math.sin(gT * 7.3 + sy2) * 2.5, sy2, 22, 1.5);
            }
            CTX.restore();
            // Ghost body outline
            CTX.globalAlpha = 0.18 + Math.sin(gT * 2.1) * 0.07;
            CTX.strokeStyle = '#93c5fd'; CTX.lineWidth = 1.5;
            CTX.shadowBlur  = 8; CTX.shadowColor = '#60a5fa';
            CTX.beginPath(); CTX.roundRect(-11, -11, 22, 22, 6); CTX.stroke();
            // Visor slit still glows
            CTX.globalAlpha = 0.5 + Math.sin(gT * 5) * 0.3;
            CTX.fillStyle   = '#00e5ff';
            CTX.shadowBlur  = 12; CTX.shadowColor = '#00e5ff';
            CTX.fillRect(-5, -11, 10, 2.5);
            CTX.shadowBlur  = 0;
            CTX.restore();

        } else {
            // ════════════════════════════════════════════════════════
            // VISIBLE — Chibi blue square sprite
            // ════════════════════════════════════════════════════════

            // ── Outer neon glow ring ─────────────────────────────────
            CTX.shadowBlur  = 14; CTX.shadowColor = '#3b82f6';
            CTX.strokeStyle = 'rgba(59,130,246,0.65)';
            CTX.lineWidth   = 3;
            CTX.beginPath(); CTX.roundRect(-12, -12, 24, 24, 7); CTX.stroke();
            CTX.shadowBlur  = 0;

            // ── Main body: blue rounded square ───────────────────────
            const bodyG = CTX.createLinearGradient(-12, -12, 12, 12);
            bodyG.addColorStop(0, '#3b82f6');
            bodyG.addColorStop(0.5, '#2563eb');
            bodyG.addColorStop(1, '#1d4ed8');
            CTX.fillStyle = bodyG;
            CTX.beginPath(); CTX.roundRect(-12, -12, 24, 24, 7); CTX.fill();

            // Body sheen (top-left specular)
            CTX.fillStyle = 'rgba(255,255,255,0.15)';
            CTX.beginPath(); CTX.roundRect(-11, -11, 12, 8, 5); CTX.fill();

            // Small chest badge: cyan MTC tag
            CTX.fillStyle = '#0ea5e9';
            CTX.shadowBlur = 6; CTX.shadowColor = '#00e5ff';
            CTX.beginPath(); CTX.roundRect(-5, -1, 10, 5, 2); CTX.fill();
            CTX.shadowBlur  = 0;
            CTX.fillStyle   = '#e0f2fe'; CTX.font = 'bold 5px Arial';
            CTX.textAlign   = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText('MTC', 0, 1.5);

            // ── Hair layer: sleek dark blue/black cap covering top ────
            // Main hair mass — wedge covering top ~40% of body
            CTX.fillStyle = '#0f172a';
            CTX.beginPath();
            CTX.moveTo(-12, -12);          // top-left corner (body edge)
            CTX.lineTo( 12, -12);          // top-right corner
            CTX.lineTo( 12,  -4);          // right side hair edge
            CTX.quadraticCurveTo(6, -3, 0, -2);   // slight wave across front
            CTX.quadraticCurveTo(-6, -3, -12, -4); // mirror wave
            CTX.closePath(); CTX.fill();

            // Hair highlight — sleek shine stripe
            CTX.fillStyle = '#1e3a8a';
            CTX.beginPath();
            CTX.moveTo(-10, -12);
            CTX.lineTo( -2, -12);
            CTX.quadraticCurveTo(-1, -8, -4, -5);
            CTX.quadraticCurveTo(-8, -7, -10, -12);
            CTX.closePath(); CTX.fill();

            // ── Visor slit: thin cyan line peeking under hair ─────────
            const vp = 0.65 + Math.sin(now / 350) * 0.35;
            CTX.fillStyle   = `rgba(0,229,255,${vp})`;
            CTX.shadowBlur  = 10 * vp; CTX.shadowColor = '#00e5ff';
            CTX.fillRect(-7, -4, 14, 2);
            CTX.shadowBlur  = 0;

            // ── Weapon ────────────────────────────────────────────────
            if (typeof weaponSystem !== 'undefined') weaponSystem.drawWeaponOnPlayer(this);

            // ── Floating hand blobs (holding weapon) ─────────────────
            // Front hand near weapon grip
            CTX.fillStyle = '#93c5fd';
            CTX.shadowBlur = 5; CTX.shadowColor = '#3b82f6';
            CTX.beginPath(); CTX.arc(13, 4, 4.5, 0, Math.PI * 2); CTX.fill();
            // Back/off hand further behind
            CTX.fillStyle = '#60a5fa';
            CTX.beginPath(); CTX.arc(-13, 2, 4, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;

            CTX.restore(); // end body transform

            // ── Muzzle flash: blue sparks ─────────────────────────────
            if (this.weaponRecoil > 0.45) {
                const fT  = (this.weaponRecoil - 0.45) / 0.55;
                const mDist = 36 + (1 - fT) * 10;
                const mx  = screen.x + Math.cos(this.angle) * mDist;
                const my  = screen.y + Math.sin(this.angle) * mDist;
                CTX.save();
                CTX.globalAlpha = fT * 0.9;
                CTX.strokeStyle = '#e0f2fe'; CTX.lineWidth = 2;
                CTX.shadowBlur  = 16; CTX.shadowColor = '#00e5ff';
                CTX.beginPath(); CTX.arc(mx, my, 3 + (1 - fT) * 6, 0, Math.PI * 2); CTX.stroke();
                CTX.strokeStyle = '#7dd3fc'; CTX.lineWidth = 1.2;
                for (let ri = 0; ri < 6; ri++) {
                    const ra = this.angle + (ri / 6) * Math.PI * 2;
                    CTX.beginPath();
                    CTX.moveTo(mx + Math.cos(ra) * 2, my + Math.sin(ra) * 2);
                    CTX.lineTo(mx + Math.cos(ra) * (5 + fT * 5), my + Math.sin(ra) * (5 + fT * 5));
                    CTX.stroke();
                }
                CTX.globalAlpha = fT;
                CTX.fillStyle   = '#ffffff';
                CTX.shadowBlur  = 8; CTX.shadowColor = '#00e5ff';
                CTX.beginPath(); CTX.arc(mx, my, 2, 0, Math.PI * 2); CTX.fill();
                CTX.restore();
            }
        }

        // ── Level badge ───────────────────────────────────────────────
        if (this.level > 1) {
            CTX.fillStyle = 'rgba(37,99,235,0.92)';
            CTX.beginPath(); CTX.arc(screen.x + 20, screen.y - 20, 9, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#fff'; CTX.font = 'bold 9px Arial';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x + 20, screen.y - 20);
        }
    }

    updateUI() {
        const S = this.stats;
        const hpEl = document.getElementById('hp-bar');
        const enEl = document.getElementById('en-bar');
        if (hpEl) hpEl.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enEl) enEl.style.width = `${this.energy / this.maxEnergy * 100}%`;

        // ── Dash cooldown (bar fill + circular arc + countdown) ──
        const dp = Math.min(100, (1 - this.cooldowns.dash / S.dashCooldown) * 100);
        const dashEl = document.getElementById('dash-cd');
        if (dashEl) dashEl.style.height = `${100 - dp}%`;
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('dash-icon',
                Math.max(0, this.cooldowns.dash), S.dashCooldown);
        }

        // ── Stealth cooldown (bar fill + circular arc + countdown) ──
        const sEl = document.getElementById('stealth-icon');
        const sCd = document.getElementById('stealth-cd');
        if (this.isInvisible) {
            sEl?.classList.add('active');
            if (sCd) sCd.style.height = '0%';
            if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
                UIManager._setCooldownVisual('stealth-icon', 0, S.stealthCooldown);
            }
        } else {
            sEl?.classList.remove('active');
            if (sCd) {
                const sp = Math.min(100, (1 - this.cooldowns.stealth / S.stealthCooldown) * 100);
                sCd.style.height = `${100 - sp}%`;
            }
            if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
                UIManager._setCooldownVisual('stealth-icon',
                    Math.max(0, this.cooldowns.stealth), S.stealthCooldown);
            }
        }

        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;

        const passiveEl = document.getElementById('passive-skill');
        if (passiveEl) {
            if (this.passiveUnlocked) {
                passiveEl.classList.add('unlocked');
                passiveEl.style.opacity = '1';
            } else if (this.level >= 3) {
                passiveEl.style.display = 'flex';
                passiveEl.style.opacity = '0.5';
                const skillName = passiveEl.querySelector('.skill-name');
                if (skillName) skillName.textContent = `${this.stealthUseCount}/5`;
            }
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🔥 AUTO PLAYER — Thermodynamic Brawler + Stand "Wanchai"
// ════════════════════════════════════════════════════════════
class AutoPlayer extends Player {
    constructor(x = 0, y = 0) {
        super('auto');
        this.x = x;
        this.y = y;

        this.wanchaiActive = false;
        this.wanchaiTimer  = 0;

        // Local timers
        this._punchTimer = 0;
        this._heatTimer  = 0;

        // Ensure expected cooldown slots exist for base update()
        this.cooldowns = { ...(this.cooldowns || {}), dash: this.cooldowns?.dash ?? 0, stealth: this.cooldowns?.stealth ?? 0, shoot: 0, wanchai: 0 };
    }

    takeDamage(amt) {
        const scaled = this.wanchaiActive ? (amt * 0.5) : amt;
        super.takeDamage(scaled);
    }

    _activateWanchai() {
        const dur = this.stats?.wanchaiDuration ?? BALANCE.player?.auto?.wanchaiDuration ?? 3.0;
        const cd  = this.stats?.wanchaiCooldown ?? BALANCE.player?.auto?.wanchaiCooldown ?? 12;

        this.wanchaiActive = true;
        this.wanchaiTimer  = dur;
        this.cooldowns.wanchai = cd;
        this._punchTimer = 0;

        if (typeof spawnFloatingText === 'function') {
            spawnFloatingText('STAND: WANCHAI!', this.x, this.y - 90, '#dc2626', 34);
        }
        if (typeof spawnParticles === 'function') {
            spawnParticles(this.x, this.y, 18, '#dc2626', 'steam');
        }
    }

    update(dt, keys, mouse) {
        // Cooldowns
        if (this.cooldowns?.wanchai > 0) this.cooldowns.wanchai -= dt;
        if (this.cooldowns?.shoot  > 0) this.cooldowns.shoot  -= dt;

        // Wanchai timer
        if (this.wanchaiActive) {
            this.wanchaiTimer -= dt;
            if (this.wanchaiTimer <= 0) {
                this.wanchaiActive = false;
                this.wanchaiTimer  = 0;
            }
        }

        // Skill (Right Click) — consume input so Player.update can't interpret it
        if (mouse?.right === 1) {
            const energyCost = this.stats?.wanchaiEnergyCost ?? 35;
            if (!this.wanchaiActive && (this.cooldowns?.wanchai ?? 0) <= 0 && (this.energy ?? 0) >= energyCost) {
                this.energy = Math.max(0, (this.energy ?? 0) - energyCost);
                this._activateWanchai();
            }
            mouse.right = 0;
        }

        // Slight speed penalty while Wanchai is active
        const oldSpeedBoost = this.speedBoost;
        if (this.wanchaiActive) this.speedBoost = (this.speedBoost || 1) * 0.85;

        super.update(dt, keys, mouse);

        // Restore speed boost so other systems remain consistent
        this.speedBoost = oldSpeedBoost;

        // Attacks
        // Note: game.js already gates updateGame() behind gameState === 'PLAYING',
        // so no need to re-check here. window.gameState was unreliable (set once on load).
        if (!mouse || mouse.left !== 1) return;
        if (typeof projectileManager === 'undefined' || !projectileManager) return;

        // Wanchai rapid punches while holding L-click
        if (this.wanchaiActive) {
            const punchRate = this.stats?.wanchaiPunchRate ?? 0.06; // seconds between punches
            this._punchTimer -= dt;
            if (this._punchTimer <= 0) {
                this._punchTimer = punchRate;
                if (typeof projectileManager.spawnWanchaiPunch === 'function') {
                    projectileManager.spawnWanchaiPunch(this.x, this.y, this.angle);
                }
            }
            return;
        }

        // Heat Wave (short-range, wide, limited pierce)
        const heatCd = this.stats?.heatWaveCooldown ?? 0.28;
        if ((this.cooldowns?.shoot ?? 0) > 0) return;
        this.cooldowns.shoot = heatCd;

        if (typeof projectileManager.spawnHeatWave === 'function') {
            projectileManager.spawnHeatWave(this, this.angle);
        } else {
            // Fallback: fire a standard projectile so the character is never "silent"
            try {
                projectileManager.add(new Projectile(this.x, this.y, this.angle, 900, 22, '#dc2626', false, 'player'));
            } catch (e) {}
        }
    }

    draw() {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  AUTO — Minimalist Chibi · Heavy Crimson Square         ║
        // ║  Top-down sprite · No face · Spiky red hair on top      ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(this.x, this.y);
        const now    = performance.now();
        if (typeof CTX === 'undefined' || !CTX) return;

        // ── Ground shadow ────────────────────────────────────────────
        CTX.save();
        CTX.globalAlpha = 0.25;
        CTX.fillStyle   = 'rgba(0,0,0,0.8)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 16, 17, 6, 0, 0, Math.PI * 2); CTX.fill();
        CTX.restore();

        // ══ WANCHAI STAND — preserved from previous version ══════════
        if (this.wanchaiActive) {
            const bob  = Math.sin(now / 130) * 7;
            const sx   = screen.x - Math.cos(this.angle) * 30;
            const sy   = screen.y - Math.sin(this.angle) * 30 - 30 + bob;
            CTX.save(); CTX.translate(sx, sy);
            const wA = 0.55 + Math.sin(now / 160) * 0.15;
            CTX.globalAlpha = 0.35 + Math.sin(now / 200) * 0.15;
            CTX.strokeStyle = '#ef4444'; CTX.lineWidth = 3.5;
            CTX.shadowBlur  = 30; CTX.shadowColor = '#dc2626';
            CTX.beginPath(); CTX.arc(0, 0, 38 + Math.sin(now / 140) * 4, 0, Math.PI * 2); CTX.stroke();
            CTX.globalAlpha = wA * 0.65;
            const tL = -14, tT = -19, tW = 28, tH = 38;
            CTX.save();
            CTX.beginPath(); CTX.roundRect(tL, tT, tW, tH, 6); CTX.clip();
            for (let ly = tT; ly <= tT + tH; ly += 4) {
                const la = 0.4 + 0.5 * Math.abs(Math.sin(now / 80 + ly * 0.15));
                CTX.strokeStyle = `rgba(248,113,113,${la})`; CTX.lineWidth = 1.2;
                CTX.shadowBlur = 4; CTX.shadowColor = '#ef4444';
                CTX.beginPath(); CTX.moveTo(tL, ly); CTX.lineTo(tL + tW, ly); CTX.stroke();
            }
            CTX.restore();
            CTX.globalAlpha = wA;
            CTX.strokeStyle = 'rgba(220,38,38,0.80)'; CTX.lineWidth = 2;
            CTX.shadowBlur  = 16; CTX.shadowColor = '#dc2626';
            CTX.beginPath(); CTX.roundRect(tL, tT, tW, tH, 6); CTX.stroke();
            for (let side = -1; side <= 1; side += 2) {
                CTX.globalAlpha = wA * 0.7; CTX.strokeStyle = 'rgba(220,38,38,0.70)'; CTX.lineWidth = 1.5; CTX.shadowBlur = 10;
                CTX.beginPath(); CTX.roundRect(side * 22 - 5, -8, 10, 22, 5); CTX.stroke();
            }
            CTX.globalAlpha = wA * 0.75; CTX.shadowBlur = 18; CTX.shadowColor = '#dc2626';
            CTX.strokeStyle = 'rgba(254,202,202,0.60)'; CTX.lineWidth = 2;
            CTX.beginPath(); CTX.arc(0, -28, 12, 0, Math.PI * 2); CTX.stroke();
            CTX.fillStyle = 'rgba(220,38,38,0.70)';
            for (let si = -2; si <= 2; si++) {
                CTX.beginPath(); CTX.moveTo(si * 5 - 3, -37); CTX.lineTo(si * 5 + 3, -37); CTX.lineTo(si * 5, -42 + Math.abs(si) * 2); CTX.closePath(); CTX.fill();
            }
            const eg = 0.7 + Math.sin(now / 110) * 0.3;
            CTX.globalAlpha = eg; CTX.fillStyle = '#f87171'; CTX.shadowBlur = 12; CTX.shadowColor = '#ef4444';
            CTX.beginPath(); CTX.arc(-4, -28, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc( 4, -28, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.restore();
        }

        // ── Body transform ────────────────────────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        // ── Squash & stretch — heavy body bobs more aggressively ─────
        const speed    = Math.hypot(this.vx, this.vy);
        const moveT    = Math.min(1, speed / 180);
        const bobT     = Math.sin(this.walkCycle * 0.9);
        const stretchX = 1 + moveT * bobT * 0.10;
        const stretchY = 1 - moveT * Math.abs(bobT) * 0.07;
        CTX.scale(stretchX, stretchY);

        // ── Outer crimson glow ring ───────────────────────────────────
        CTX.shadowBlur  = 16; CTX.shadowColor = '#dc2626';
        CTX.strokeStyle = 'rgba(220,38,38,0.70)'; CTX.lineWidth = 3.5;
        // Larger body (sturdier) — 28×28 rounded square
        CTX.beginPath(); CTX.roundRect(-14, -14, 28, 28, 6); CTX.stroke();
        CTX.shadowBlur  = 0;

        // ── Main body: crimson heavy square ──────────────────────────
        const bG = CTX.createLinearGradient(-14, -14, 14, 14);
        bG.addColorStop(0, '#f87171');
        bG.addColorStop(0.4, '#dc2626');
        bG.addColorStop(1, '#7f1d1d');
        CTX.fillStyle = bG;
        CTX.beginPath(); CTX.roundRect(-14, -14, 28, 28, 6); CTX.fill();

        // Body specular sheen
        CTX.fillStyle = 'rgba(255,255,255,0.12)';
        CTX.beginPath(); CTX.roundRect(-13, -13, 13, 9, 5); CTX.fill();

        // ── Heat vents on body sides — glow with attack intensity ────
        const attackIntensity = this.wanchaiActive ? 1.0
            : Math.min(1, (Math.abs(this.vx) + Math.abs(this.vy)) / 150 + 0.2);
        const ventGlow = Math.max(0, attackIntensity * (0.5 + Math.sin(now / 180) * 0.5));
        CTX.shadowBlur  = 10 * ventGlow; CTX.shadowColor = '#fb923c';
        for (let vi = 0; vi < 3; vi++) {
            const va = ventGlow * (0.45 + vi * 0.18);
            CTX.fillStyle = `rgba(251,146,60,${va})`;
            // Left vents
            CTX.fillRect(-14, -6 + vi * 5, 4, 3);
            // Right vents
            CTX.fillRect(10,  -6 + vi * 5, 4, 3);
        }
        CTX.shadowBlur = 0;

        // Core power dot
        const cP = Math.max(0, 0.5 + Math.sin(now / 220) * 0.5);
        CTX.fillStyle = `rgba(251,113,133,${cP})`;
        CTX.shadowBlur = 8 * cP; CTX.shadowColor = '#dc2626';
        CTX.beginPath(); CTX.arc(0, 3, 4, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // ── Hair layer: sharp red-tinted spiky wedge covering top ────
        // Base hair mass (dark near-black)
        CTX.fillStyle = '#1a0a0a';
        CTX.beginPath();
        CTX.moveTo(-14, -14);        // top-left body corner
        CTX.lineTo( 14, -14);        // top-right body corner
        CTX.lineTo( 14,  -5);        // right side of hair
        CTX.quadraticCurveTo(6, -4, 0, -3);
        CTX.quadraticCurveTo(-6, -4, -14, -5);
        CTX.closePath(); CTX.fill();

        // Red-tinted hair highlight streak
        CTX.fillStyle = '#7f1d1d';
        CTX.beginPath();
        CTX.moveTo(-10, -14);
        CTX.lineTo( -3, -14);
        CTX.quadraticCurveTo(-1, -9, -3, -6);
        CTX.quadraticCurveTo(-7, -8, -10, -14);
        CTX.closePath(); CTX.fill();

        // Spiky hair tips — 4 triangular spikes on top edge
        CTX.fillStyle = '#450a0a';
        const spikePositions = [-9, -3, 3, 9];
        for (const spx of spikePositions) {
            const spikeH = 5 + Math.abs(spx) * 0.3 + Math.sin(now / 400 + spx) * 1.5;
            CTX.beginPath();
            CTX.moveTo(spx - 3.5, -14);
            CTX.lineTo(spx + 3.5, -14);
            CTX.lineTo(spx, -14 - spikeH);
            CTX.closePath(); CTX.fill();
        }
        // Glow on spike tips when Wanchai is active
        if (this.wanchaiActive) {
            CTX.shadowBlur  = 12; CTX.shadowColor = '#dc2626';
            CTX.fillStyle   = 'rgba(220,38,38,0.6)';
            for (const spx of spikePositions) {
                const spikeH = 5 + Math.abs(spx) * 0.3 + Math.sin(now / 400 + spx) * 1.5;
                CTX.beginPath(); CTX.arc(spx, -14 - spikeH, 2.5, 0, Math.PI * 2); CTX.fill();
            }
            CTX.shadowBlur = 0;
        }

        // ── Gauntlet weapon ───────────────────────────────────────────
        if (typeof drawAutoWeapon === 'function') {
            drawAutoWeapon(CTX, this.wanchaiActive, ventGlow);
        }

        // ── Floating hand blobs (fists holding gauntlets) ────────────
        CTX.fillStyle   = '#fca5a5';
        CTX.shadowBlur  = 5 * ventGlow; CTX.shadowColor = '#dc2626';
        // Front fist — forward and slightly offset
        CTX.beginPath(); CTX.arc(16, 2, 5.5, 0, Math.PI * 2); CTX.fill();
        // Back fist — weapon-side off-hand
        CTX.fillStyle = '#f87171';
        CTX.beginPath(); CTX.arc(-15, -2, 5, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur  = 0;

        CTX.restore(); // end body transform

        // ── Heat shimmer particles ────────────────────────────────────
        if (typeof spawnParticles === 'function' && (Math.abs(this.vx) + Math.abs(this.vy)) > 60 && Math.random() < 0.1) {
            spawnParticles(this.x + rand(-10, 10), this.y + rand(-10, 10), 1, '#fb7185', 'steam');
        }

        // ── Level badge ───────────────────────────────────────────────
        if (this.level > 1) {
            CTX.fillStyle = 'rgba(185,28,28,0.92)';
            CTX.beginPath(); CTX.arc(screen.x + 22, screen.y - 22, 9, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#fff'; CTX.font = 'bold 9px Arial';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x + 22, screen.y - 22);
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🔥 AUTO PLAYER — Prototype Overrides
// ════════════════════════════════════════════════════════════

/**
 * AutoPlayer.prototype.updateUI
 * Overrides Player.updateUI to repurpose the "stealth" HUD slot
 * as the Wanchai Stand cooldown display, matching Auto's identity.
 *
 * • HP bar, EN bar, dash cooldown, level, EXP are inherited from Player.
 * • The stand slot shows:
 *     – Flashing crimson when Wanchai is active.
 *     – Filling bar as the cooldown counts down.
 *     – Circular arc + countdown via UIManager._setCooldownVisual.
 */
AutoPlayer.prototype.updateUI = function() {
    const S = this.stats;

    // ── HP & Energy bars (identical to base Player) ──────────────
    const hpEl = document.getElementById('hp-bar');
    const enEl = document.getElementById('en-bar');
    if (hpEl) hpEl.style.width = `${this.hp / this.maxHp * 100}%`;
    if (enEl) enEl.style.width = `${this.energy / this.maxEnergy * 100}%`;

    // ── Dash cooldown ─────────────────────────────────────────────
    const dp      = Math.min(100, (1 - this.cooldowns.dash / (S.dashCooldown || 2.0)) * 100);
    const dashEl  = document.getElementById('dash-cd');
    if (dashEl) dashEl.style.height = `${100 - dp}%`;
    if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
        UIManager._setCooldownVisual('dash-icon',
            Math.max(0, this.cooldowns.dash), S.dashCooldown || 2.0);
    }

    // ── Wanchai / Stand cooldown (repurposed stealth slot) ───────
    const wanchaiCd   = S.wanchaiCooldown || BALANCE.player.auto.wanchaiCooldown || 12;
    const standEl     = document.getElementById('stealth-icon');
    const standCdEl   = document.getElementById('stealth-cd');

    // ── Always keep the HUD slot labelled for the Stand, not stealth ──
    // The base Player constructor sets the emoji to 📖 and hint to 'R-Click'.
    // Override here every frame so it's consistent regardless of init order.
    const skill1Emoji = document.getElementById('skill1-emoji');
    const skill1Hint  = document.getElementById('skill1-hint');
    if (skill1Emoji) skill1Emoji.textContent = this.wanchaiActive ? '🥊' : '🔥';
    if (skill1Hint)  skill1Hint.textContent  = 'STAND';
    if (standEl)     standEl.style.borderColor = '#dc2626';
    if (standEl)     standEl.style.boxShadow   = this.wanchaiActive
        ? '0 0 20px rgba(220,38,38,0.80)'
        : '0 0 10px rgba(220,38,38,0.35)';

    if (this.wanchaiActive) {
        // Stand is active — flash the icon in crimson
        standEl?.classList.add('active');
        if (standCdEl) standCdEl.style.height = '0%';
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('stealth-icon', 0, wanchaiCd);
        }
        // Update icon label to show remaining stand time
        const iconLabelEl = standEl?.querySelector('.skill-name');
        if (iconLabelEl) {
            iconLabelEl.textContent = `${Math.ceil(this.wanchaiTimer)}s`;
        }
    } else {
        standEl?.classList.remove('active');
        if (standCdEl) {
            const sp = Math.min(100, (1 - (this.cooldowns.wanchai ?? 0) / wanchaiCd) * 100);
            standCdEl.style.height = `${100 - sp}%`;
        }
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('stealth-icon',
                Math.max(0, this.cooldowns.wanchai ?? 0), wanchaiCd);
        }
    }

    // ── Level & EXP ───────────────────────────────────────────────
    const levelEl = document.getElementById('player-level');
    if (levelEl) levelEl.textContent = `Lv.${this.level}`;
    const expBar = document.getElementById('exp-bar');
    if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;

    // ── Passive skill indicator ───────────────────────────────────
    const passiveEl = document.getElementById('passive-skill');
    if (passiveEl) {
        if (this.passiveUnlocked) {
            passiveEl.classList.add('unlocked');
            passiveEl.style.opacity = '1';
        } else if (this.level >= (S.passiveUnlockLevel ?? 5)) {
            passiveEl.style.display = 'flex';
            passiveEl.style.opacity = '0.5';
        }
    }
};

// ════════════════════════════════════════════════════════════
// ✅ WARN 5 FIX — Shared obstacle-awareness prototype method
// ════════════════════════════════════════════════════════════
Player.prototype.checkObstacleProximity = function(ax, ay, dt, particleColor) {
    const OB = BALANCE.player;

    let mapObjs = [];
    if (window.mapSystem) {
        if      (typeof mapSystem.getObjects === 'function') mapObjs = mapSystem.getObjects();
        else if (Array.isArray(mapSystem.objects))           mapObjs = mapSystem.objects;
        else if (Array.isArray(mapSystem.solidObjects))      mapObjs = mapSystem.solidObjects;
    }
    if (Array.isArray(BALANCE.map.wallPositions)) {
        mapObjs = mapObjs.concat(BALANCE.map.wallPositions);
    }

    const isMoving = (ax !== 0 || ay !== 0);
    let scraping = false;

    for (const obj of mapObjs) {
        if (!obj || obj.x === undefined || obj.y === undefined) continue;
        const oL = obj.x, oT = obj.y, oR = oL + (obj.w || 0), oB = oT + (obj.h || 0);
        const closestX = Math.max(oL, Math.min(this.x, oR));
        const closestY = Math.max(oT, Math.min(this.y, oB));
        const d        = Math.hypot(this.x - closestX, this.y - closestY);

        const scrapeThreshold  = this.radius + 4;
        const warningThreshold = this.radius + OB.obstacleWarningRange;

        if (d < scrapeThreshold && isMoving) scraping = true;

        if (d < warningThreshold && isMoving) {
            const now = Date.now();
            if (now - this.lastObstacleWarning > OB.obstacleWarningCooldown) {
                this.lastObstacleWarning = now;
                showVoiceBubble('Careful!', this.x, this.y - 50);
            }
            break;
        }
    }

    if (scraping) this.obstacleBuffTimer = OB.obstacleBuffDuration;

    if (this.obstacleBuffTimer > 0) {
        this.obstacleBuffTimer -= dt;
        if (Math.random() < 0.3) {
            spawnParticles(
                this.x + rand(-this.radius, this.radius),
                this.y + rand(-this.radius, this.radius),
                1, particleColor
            );
        }
    }
};

// ════════════════════════════════════════════════════════════
// 🌾 POOM PLAYER
// ════════════════════════════════════════════════════════════
class PoomPlayer extends Entity {
    constructor() {
        const stats = BALANCE.characters.poom;
        super(0, 0, stats.radius);

        this.charId = 'poom';
        this.stats  = stats;

        this.hp = stats.hp; this.maxHp = stats.maxHp;
        this.energy = stats.energy; this.maxEnergy = stats.maxEnergy;

        this.cooldowns = { dash: 0, eat: 0, naga: 0, shoot: 0 };

        this.isDashing = false; this.isInvisible = false; this.ambushReady = false;
        this.passiveUnlocked = false; this.stealthUseCount = 0; this.goldenAuraTimer = 0;

        this.walkCycle = 0;
        this.damageBoost = 1; this.speedBoost = 1; this.speedBoostTimer = 0;
        this.dashGhosts = [];
        
        // ── Timeout Management ───────────────────────────────────
        // Store setTimeout IDs to prevent memory leaks when player dies
        this.dashTimeouts     = [];

        // ── Stand-Aura & Afterimage system ────────────────────
        this.standGhosts   = [];
        this.auraRotation  = 0;
        this._auraFrame    = 0;

        this.onGraph = false;
        this.isConfused = false; this.confusedTimer = 0;
        this.isBurning  = false; this.burnTimer = 0; this.burnDamage = 0;

        this.isEatingRice   = false; this.eatRiceTimer = 0;
        this.currentSpeedMult = 1;
        this.nagaCount = 0;
        this.naga      = null;  // reference to current NagaEntity while summoned (for invincibility)

        // ── Collision Awareness state (mirrors Player) ─────────
        this.obstacleBuffTimer     = 0;
        this.lastObstacleWarning   = 0;

        this.level = 1; this.exp = 0;
        this.expToNextLevel = stats.expToNextLevel;
        this.baseCritChance = stats.critChance;

        // ── RPG Scaling Multipliers ─────────────────────────────
        // Permanent progression: damage increases, cooldowns decrease per level
        this.damageMultiplier = 1.0;
        this.cooldownMultiplier = 1.0;
    }

    update(dt, keys, mouse) {
        const S   = this.stats;
        const PHY = BALANCE.physics;

        if (this.isBurning) {
            this.burnTimer -= dt; this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15,15), this.y + rand(-15,15), 1, '#f59e0b');
        }
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;

        if (this.isEatingRice) {
            this.eatRiceTimer -= dt;
            this.currentSpeedMult = S.eatRiceSpeedMult;
            if (Math.random() < 0.2) spawnParticles(this.x + rand(-20,20), this.y + rand(-20,20), 1, '#fbbf24');
            if (this.eatRiceTimer <= 0) {
                this.isEatingRice = false;
                this.currentSpeedMult = 1;
                spawnFloatingText('หมดฤทธิ์!', this.x, this.y - 40, '#94a3b8', 14);
            }
        }

        let ax = 0, ay = 0, isTouchMove = false;
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            ax = window.touchJoystickLeft.nx; ay = window.touchJoystickLeft.ny; isTouchMove = true;
        } else {
            if (keys.w) ay -= 1; if (keys.s) ay += 1;
            if (keys.a) ax -= 1; if (keys.d) ax += 1;
        }
        if (this.isConfused) { ax *= -1; ay *= -1; }
        if (ax || ay) {
            if (!isTouchMove) { const len = Math.hypot(ax, ay); ax /= len; ay /= len; }
            this.walkCycle += dt * 15;
        } else { this.walkCycle = 0; }

        let speedMult = this.currentSpeedMult * this.speedBoost;
        if (this.speedBoostTimer > 0) speedMult += S.speedOnHit / S.moveSpeed;
        if (this.obstacleBuffTimer > 0) speedMult *= BALANCE.player.obstacleBuffPower;

        if (!this.isDashing) {
            this.vx += ax * PHY.acceleration * dt;
            this.vy += ay * PHY.acceleration * dt;
            this.vx *= PHY.friction;
            this.vy *= PHY.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > S.moveSpeed * speedMult) {
                const scale = S.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);

        if (!this.isDashing) {
            this.checkObstacleProximity(ax, ay, dt, '#fcd34d');
        }

        if (this.cooldowns.dash  > 0) this.cooldowns.dash  -= dt;
        if (this.cooldowns.eat   > 0) this.cooldowns.eat   -= dt;
        if (this.cooldowns.naga  > 0) this.cooldowns.naga  -= dt;
        if (this.cooldowns.shoot > 0) this.cooldowns.shoot -= dt;

        if (keys.space && this.cooldowns.dash <= 0) { this.dash(ax || 1, ay || 0); keys.space = 0; }
        if (keys.e && this.cooldowns.eat <= 0 && !this.isEatingRice) { this.eatRice(); keys.e = 0; }
        if (keys.r && this.cooldowns.naga <= 0) { this.summonNaga(); keys.r = 0; }

        this.energy = Math.min(this.maxEnergy, this.energy + S.energyRegen * dt);

        // ── Naga cleanup: clear reference if naga dies ─────────────
        if (this.naga && this.naga.dead) {
            this.naga = null;
        }

        if (window.touchJoystickRight && window.touchJoystickRight.active) {
            this.angle = Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        } else {
            this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);
        }

        for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
            this.dashGhosts[i].life -= dt * 5;
            if (this.dashGhosts[i].life <= 0) this.dashGhosts.splice(i, 1);
        }

        _standAura_update(this, dt);

        // ── Cleanup dash timeouts (foolproof) ───────────────────
        // Mirrors Player's cleanup: if Poom dies mid-dash, cancel ALL pending
        // dash callbacks so they can't keep references alive or mutate state.
        if (this.dead && this.dashTimeouts && this.dashTimeouts.length) {
            const ids = this.dashTimeouts.slice();
            this.dashTimeouts.length = 0;
            for (const timeoutId of ids) {
                try { clearTimeout(timeoutId); } catch (e) {}
            }
        }
        this.updateUI();
    }

    shoot() {
        const S = this.stats;
        if (this.cooldowns.shoot > 0) return;
        this.cooldowns.shoot = S.riceCooldown * this.cooldownMultiplier;
        const { damage, isCrit } = this.dealDamage(S.riceDamage * this.damageBoost * (this.damageMultiplier || 1.0));
        projectileManager.add(new Projectile(this.x, this.y, this.angle, S.riceSpeed, damage, S.riceColor, false, 'player'));
        if (isCrit) spawnFloatingText('สาดข้าว!', this.x, this.y - 40, '#fbbf24', 18);
        this.speedBoostTimer = S.speedOnHitDuration;
        // ✅ AUDIO 1 — Bamboo-tube "Tuk" thump for Poom's rice launcher.
        // Defined in audio.js as a two-layer sine+triangle design.
        Audio.playPoomShoot();
    }

    eatRice() {
        const S = this.stats;
        this.isEatingRice = true;
        this.eatRiceTimer = S.eatRiceDuration;
        this.cooldowns.eat = S.eatRiceCooldown * this.cooldownMultiplier;
        spawnParticles(this.x, this.y, 30, '#fbbf24');
        spawnFloatingText('กินข้าวเหนียว!', this.x, this.y - 50, '#fbbf24', 22);
        showVoiceBubble('อร่อยแท้ๆ!', this.x, this.y - 40);
        addScreenShake(5); Audio.playPowerUp();
    }

    summonNaga() {
        const S = this.stats;
        this.cooldowns.naga = S.nagaCooldown * this.cooldownMultiplier;
        this.naga = new NagaEntity(this.x, this.y, this);
        window.specialEffects.push(this.naga);
        spawnParticles(this.x, this.y, 40, '#10b981');
        spawnFloatingText('อัญเชิญพญานาค!', this.x, this.y - 60, '#10b981', 24);
        showVoiceBubble('ขอพรพญานาค!', this.x, this.y - 40);
        addScreenShake(10); Audio.playAchievement();
        this.nagaCount++;
        if (this.nagaCount >= 3) Achievements.check('naga_summoner');
    }

    dash(ax, ay) {
        const S = this.stats;
        if (this.isDashing) return;
        this.isDashing = true;
        this.cooldowns.dash = S.dashCooldown * this.cooldownMultiplier;
        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        let dashSpeed = S.dashDistance / 0.2;
        // Matrix Dash: during Bullet Time, dash covers massive distance almost instantly
        // Validate timeScale and clamp to prevent infinite/NaN speeds
        let currentScale = 1.0;
        if (typeof window.timeScale === 'number' && Number.isFinite(window.timeScale)) {
            currentScale = window.timeScale;
        }
        currentScale = Math.min(10.0, Math.max(0.1, currentScale));
        if (currentScale < 1.0) {
            const matrixMult = (1 / currentScale) * 1.5;
            dashSpeed *= matrixMult;
        }
        this.vx = Math.cos(angle) * dashSpeed;
        this.vy = Math.sin(angle) * dashSpeed;
        for (let i = 0; i < 5; i++) {
            const timeoutId = setTimeout(() => {
                if (!this.dead) this.dashGhosts.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
                // Remove timeout ID from array after execution
                const idx = this.dashTimeouts.indexOf(timeoutId);
                if (idx > -1) this.dashTimeouts.splice(idx, 1);
            }, i * 30);
            this.dashTimeouts.push(timeoutId);
        }
        spawnParticles(this.x, this.y, 15, '#fbbf24');
        Audio.playDash(); Achievements.stats.dashes++; Achievements.check('speedster');
        const dashEndTimeoutId = setTimeout(() => { if (!this.dead) this.isDashing = false; }, 200);
        this.dashTimeouts.push(dashEndTimeoutId);
    }

    takeDamage(amt) {
        if (this.naga && !this.naga.dead && this.naga.active) return;  // invincible while Naga is out and alive
        if (this.isDashing) return;
        if (this.onGraph) { amt *= 2; spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16); }
        this.hp -= amt; this.hp = Math.max(0, this.hp);
        spawnFloatingText(Math.round(amt), this.x, this.y - 30, '#ef4444');
        spawnParticles(this.x, this.y, 8, '#ef4444');
        addScreenShake(8); Audio.playHit();
        Achievements.stats.damageTaken += amt;
        if (this.hp <= 0) window.endGame('defeat');
    }

    dealDamage(baseDamage) {
        const S = this.stats;
        let damage = baseDamage, isCrit = false;
        let critChance = this.baseCritChance;
        if (this.isEatingRice) critChance += S.eatRiceCritBonus;
        if (Math.random() < critChance) {
            damage *= S.critMultiplier; isCrit = true;
            Achievements.stats.crits++; Achievements.check('crit_master');
        }
        return { damage, isCrit };
    }

    heal(amt) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
        spawnFloatingText(`+${amt} HP`, this.x, this.y - 30, '#10b981');
        spawnParticles(this.x, this.y, 10, '#10b981'); Audio.playHeal();
    }

    addSpeedBoost() { this.speedBoostTimer = this.stats.speedOnHitDuration; }

    gainExp(amount) {
        this.exp += amount;
        spawnFloatingText(`+${amount} EXP`, this.x, this.y - 50, '#8b5cf6', 14);
        while (this.exp >= this.expToNextLevel) this.levelUp();
        this.updateUI();
    }

    levelUp() {
        const S = this.stats;
        this.exp -= this.expToNextLevel; this.level++;
        this.expToNextLevel = Math.floor(this.expToNextLevel * S.expLevelMult);
        
        // ── RPG Scaling Progression ─────────────────────────────
        // +5% damage per level (permanent)
        this.damageMultiplier += 0.05;
        
        // -3% cooldown per level (capped at 50% reduction)
        this.cooldownMultiplier = Math.max(0.5, this.cooldownMultiplier - 0.03);
        
        // Visual feedback for progression
        const damageBonus = Math.round((this.damageMultiplier - 1) * 100);
        const cooldownBonus = Math.round((1 - this.cooldownMultiplier) * 100);
        spawnFloatingText(`LEVEL ${this.level}! +${damageBonus}% DMG, -${cooldownBonus}% CD`, this.x, this.y - 90, '#fbbf24', 32);
        
        this.hp = this.maxHp; this.energy = this.maxEnergy;
        spawnFloatingText(`LEVEL ${this.level}!`, this.x, this.y - 70, '#facc15', 35);
        spawnParticles(this.x, this.y, 40, '#facc15');
        addScreenShake(12); Audio.playLevelUp();
    }

    draw() {
        const S = this.stats;

        _standAura_draw(this, 'poom');

        for (const img of this.dashGhosts) {
            const s = worldToScreen(img.x, img.y);
            CTX.save(); CTX.translate(s.x, s.y); CTX.rotate(img.angle);
            CTX.globalAlpha = img.life * 0.3; CTX.fillStyle = '#fbbf24';
            CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 8); CTX.fill(); CTX.restore();
        }
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 25, 18, 8, 0, 0, Math.PI * 2); CTX.fill();

        if (this.isEatingRice) {
            const t = performance.now() / 200;
            const auraSize  = 38 + Math.sin(t) * 6;
            const auraAlpha = 0.4 + Math.sin(t * 1.5) * 0.15;
            CTX.save();
            CTX.globalAlpha = auraAlpha;
            CTX.strokeStyle = '#fbbf24'; CTX.lineWidth = 4;
            CTX.shadowBlur = 25; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2); CTX.stroke();
            CTX.globalAlpha = auraAlpha * 0.35;
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize + 12, 0, Math.PI * 2); CTX.stroke();
            CTX.restore();
        }

        // Naga invincibility: subtle glowing golden shield while Naga is active
        if (this.naga && this.naga.active) {
            const gt = performance.now() / 350;
            const shieldR = 36 + Math.sin(gt) * 4;
            const shieldA = 0.25 + Math.sin(gt * 1.3) * 0.12;
            CTX.save();
            CTX.globalAlpha = shieldA;
            CTX.strokeStyle = '#fbbf24';
            CTX.lineWidth   = 2.5;
            CTX.shadowBlur   = 18;
            CTX.shadowColor  = '#f59e0b';
            CTX.setLineDash([4, 4]);
            CTX.beginPath(); CTX.arc(screen.x, screen.y, shieldR, 0, Math.PI * 2); CTX.stroke();
            CTX.setLineDash([]);
            CTX.globalAlpha = shieldA * 0.4;
            CTX.beginPath(); CTX.arc(screen.x, screen.y, shieldR + 8, 0, Math.PI * 2); CTX.stroke();
            CTX.restore();
        }

        if (this.isConfused)   { CTX.font = 'bold 24px Arial'; CTX.textAlign='center'; CTX.fillText('😵', screen.x, screen.y - 44); }
        if (this.isBurning)    { CTX.font = 'bold 20px Arial'; CTX.fillText('🔥', screen.x + 20, screen.y - 35); }
        if (this.isEatingRice) { CTX.font = 'bold 18px Arial'; CTX.textAlign='center'; CTX.fillText('🍚', screen.x, screen.y - 44); }

        // ── v11 Poom Channeling Effect ──────────────────────────────────────
        // When a NagaEntity is alive in specialEffects, Poom is "channeling" the
        // snake. Show a pulsing emerald aura ring to communicate the mental link.
        const nagaEntity = window.specialEffects &&
            window.specialEffects.find(e => e instanceof NagaEntity);
        const isChanneling = !!nagaEntity;
        if (isChanneling) {
            const ct  = performance.now() / 220;
            const cr  = 42 + Math.sin(ct) * 7;
            const ca  = 0.55 + Math.sin(ct * 1.6) * 0.25;
            CTX.save();
            // Outer ring — pulsing width emerald glow
            CTX.globalAlpha  = ca;
            CTX.strokeStyle  = '#10b981';
            CTX.lineWidth    = 3.5 + Math.sin(ct * 2.1) * 1.5;
            CTX.shadowBlur   = 24 + Math.sin(ct) * 10;
            CTX.shadowColor  = '#10b981';
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, cr, 0, Math.PI * 2);
            CTX.stroke();
            // Inner secondary ring (faster pulse, offset phase)
            CTX.globalAlpha  = ca * 0.55;
            CTX.lineWidth    = 1.5;
            CTX.shadowBlur   = 10;
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, cr - 12, 0, Math.PI * 2);
            CTX.stroke();
            // Energy particle sparks along ring edge
            if (Math.random() < 0.35) {
                const sa = Math.random() * Math.PI * 2;
                const sx = screen.x + Math.cos(sa) * cr;
                const sy = screen.y + Math.sin(sa) * cr;
                CTX.globalAlpha  = 0.9;
                CTX.fillStyle    = '#34d399';
                CTX.shadowBlur   = 8;
                CTX.shadowColor  = '#10b981';
                CTX.beginPath();
                CTX.arc(sx, sy, 2, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.restore();

            // ── Task 4: Naga Summoning Connection Line ─────────────────────
            // A jittered, segmented energy thread drawn from Poom's chest to
            // the Naga head in screen space. Flickers every frame for a live
            // "lightning" feel without a separate particle system.
            // • Segments: 10 points interpolated along the straight path, each
            //   nudged by a small random perpendicular offset per frame.
            // • Two passes: wide soft glow pass + narrow bright core pass.
            // • Alpha tied to nagaEntity.life / nagaEntity.maxLife so the link
            //   fades gracefully as the Naga's timer winds down.
            if (nagaEntity.segments && nagaEntity.segments.length > 0) {
                const nagaHead   = nagaEntity.segments[0];
                const nagaScreen = worldToScreen(nagaHead.x, nagaHead.y);
                const lifeAlpha  = Math.min(1, nagaEntity.life / nagaEntity.maxLife);
                const SEGS       = 10; // number of interpolated line vertices

                // Build jittered polyline points
                const pts = [];
                for (let i = 0; i <= SEGS; i++) {
                    const t   = i / SEGS;
                    const bx  = screen.x   + (nagaScreen.x - screen.x)   * t;
                    const by  = screen.y   + (nagaScreen.y - screen.y)   * t;
                    // Perpendicular jitter — strongest at midpoint (t≈0.5)
                    const jitterAmp = Math.sin(t * Math.PI) * (8 + Math.sin(performance.now() / 80 + i) * 4);
                    const perp      = Math.atan2(nagaScreen.y - screen.y, nagaScreen.x - screen.x) + Math.PI / 2;
                    const jitter    = (Math.random() - 0.5) * 2 * jitterAmp;
                    pts.push({ x: bx + Math.cos(perp) * jitter, y: by + Math.sin(perp) * jitter });
                }
                // Anchor start/end exactly on Poom and the Naga head (no jitter)
                pts[0]    = { x: screen.x,     y: screen.y     };
                pts[SEGS] = { x: nagaScreen.x, y: nagaScreen.y };

                const drawThread = (lineW, alpha, color, blur) => {
                    CTX.save();
                    CTX.globalAlpha = lifeAlpha * alpha;
                    CTX.strokeStyle = color;
                    CTX.lineWidth   = lineW;
                    CTX.lineCap     = 'round';
                    CTX.lineJoin    = 'round';
                    CTX.shadowBlur  = blur;
                    CTX.shadowColor = '#10b981';
                    CTX.beginPath();
                    CTX.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i <= SEGS; i++) CTX.lineTo(pts[i].x, pts[i].y);
                    CTX.stroke();
                    CTX.restore();
                };

                // Pass 1 — soft outer glow
                drawThread(5, 0.25, '#10b981', 18);
                // Pass 2 — bright core thread
                drawThread(1.5, 0.85, '#6ee7b7', 8);

                // Small orb at the connection anchor on Poom's body
                CTX.save();
                CTX.globalAlpha  = lifeAlpha * (0.7 + Math.sin(performance.now() / 120) * 0.3);
                CTX.fillStyle    = '#34d399';
                CTX.shadowBlur   = 14;
                CTX.shadowColor  = '#10b981';
                CTX.beginPath();
                CTX.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
                CTX.fill();
                CTX.restore();
            }
        }

        // ════════════════════════════════════════════════════════
        // POOM CHIBI — Circle body · Spiky hair · Kranok pattern
        // ════════════════════════════════════════════════════════
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        // ── Squash & stretch — circles feel very springy ─────────────
        const now2    = performance.now();
        const speed2  = Math.hypot(this.vx, this.vy);
        const moveT2  = Math.min(1, speed2 / 190);
        const bobT2   = Math.sin(this.walkCycle);
        // Circles stretch horizontally when moving forward, squish on stop
        const stretchX2 = 1 + moveT2 * bobT2 * 0.14;
        const stretchY2 = 1 - moveT2 * Math.abs(bobT2) * 0.10;
        CTX.scale(stretchX2, stretchY2);

        // ── Outer golden glow ring ────────────────────────────────────
        CTX.shadowBlur  = 16; CTX.shadowColor = '#f59e0b';
        CTX.strokeStyle = 'rgba(245,158,11,0.65)'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, 13, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur  = 0;

        // ── Main body: orange/gold circle ────────────────────────────
        const bodyG2 = CTX.createRadialGradient(-3, -3, 1, 0, 0, 14);
        bodyG2.addColorStop(0,   '#fbbf24');
        bodyG2.addColorStop(0.5, '#f59e0b');
        bodyG2.addColorStop(1,   '#d97706');
        CTX.fillStyle = bodyG2;
        CTX.beginPath(); CTX.arc(0, 0, 13, 0, Math.PI * 2); CTX.fill();

        // Specular top-left shine
        CTX.fillStyle = 'rgba(255,255,255,0.20)';
        CTX.beginPath(); CTX.arc(-4, -5, 6, 0, Math.PI * 2); CTX.fill();

        // ── Glowing Thai Kranok patterns painted on body ──────────────
        // Preserved from detailed version — scrolls + lotus diamond
        const kranokT     = now2 / 500;
        const kranokAlpha = 0.50 + Math.sin(kranokT * 1.3) * 0.25;
        CTX.save();
        CTX.beginPath(); CTX.arc(0, 0, 12, 0, Math.PI * 2); CTX.clip();

        CTX.globalAlpha = kranokAlpha;
        CTX.strokeStyle = '#fff7ed'; CTX.lineWidth = 1.1;
        CTX.shadowBlur  = 5 + Math.sin(kranokT * 2) * 3;
        CTX.shadowColor = '#fef3c7';

        // Left tendril
        CTX.beginPath();
        CTX.moveTo(-8, 8); CTX.quadraticCurveTo(-9, 2, -4, 0);
        CTX.quadraticCurveTo(-1, -1, -3, 4);
        CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(-4, 0); CTX.quadraticCurveTo(-6, -3, -3, -4);
        CTX.quadraticCurveTo(-1, -5, -2, -2);
        CTX.stroke();

        // Right tendril (mirrored)
        CTX.beginPath();
        CTX.moveTo(8, 8); CTX.quadraticCurveTo(9, 2, 4, 0);
        CTX.quadraticCurveTo(1, -1, 3, 4);
        CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(4, 0); CTX.quadraticCurveTo(6, -3, 3, -4);
        CTX.quadraticCurveTo(1, -5, 2, -2);
        CTX.stroke();

        // Centre lotus diamond
        CTX.globalAlpha = kranokAlpha * 0.95;
        CTX.fillStyle   = 'rgba(255,251,235,0.9)';
        CTX.shadowBlur  = 8; CTX.shadowColor = '#fbbf24';
        CTX.beginPath();
        CTX.moveTo(0, -5); CTX.lineTo(2.5, -1); CTX.lineTo(0, 3); CTX.lineTo(-2.5, -1);
        CTX.closePath(); CTX.fill();

        // Dot accents at bottom arc
        CTX.fillStyle   = 'rgba(254,243,199,0.85)'; CTX.shadowBlur = 3;
        for (const [dx2, dy2] of [[-6, 8], [0, 9], [6, 8]]) {
            CTX.beginPath(); CTX.arc(dx2, dy2, 1.2, 0, Math.PI * 2); CTX.fill();
        }
        CTX.restore(); // end kranok clip

        // ── Hair layer: messy spiky brown/black blob ──────────────────
        // Covers roughly top-forward 50% of circle ("looking down")
        // Base dark mass
        CTX.fillStyle = '#1c0f05';
        CTX.beginPath();
        CTX.moveTo(-13, -3);        // left body edge
        CTX.quadraticCurveTo(-13, -15, 0, -16);  // arc up and over
        CTX.quadraticCurveTo(12, -15, 13, -3);   // right body edge
        CTX.quadraticCurveTo(8, -2, 0, -1);      // hair bottom edge curves down
        CTX.quadraticCurveTo(-8, -2, -13, -3);
        CTX.closePath(); CTX.fill();

        // Brown highlight streak
        CTX.fillStyle = '#3b1a07';
        CTX.beginPath();
        CTX.moveTo(-7, -14);
        CTX.quadraticCurveTo(-2, -17, 3, -14);
        CTX.quadraticCurveTo(1, -10, -3, -11);
        CTX.quadraticCurveTo(-6, -11, -7, -14);
        CTX.closePath(); CTX.fill();

        // Messy spiky tips — 5 irregular spikes radiating from top of circle
        CTX.fillStyle = '#15080a';
        const hairSpikes = [
            { x: -9, angle: -2.4, len: 7 },
            { x: -4, angle: -2.0, len: 9 },
            { x:  1, angle: -1.57, len: 10 },
            { x:  6, angle: -1.1, len: 8 },
            { x: 10, angle: -0.8, len: 6 },
        ];
        for (const sp of hairSpikes) {
            const tipX = sp.x + Math.cos(sp.angle) * sp.len;
            const tipY = -14 + Math.sin(sp.angle) * sp.len;
            const wobble = Math.sin(now2 / 500 + sp.x) * 1.2;
            CTX.beginPath();
            CTX.moveTo(sp.x - 3, -14);
            CTX.lineTo(sp.x + 3, -14);
            CTX.lineTo(tipX + wobble, tipY - wobble * 0.5);
            CTX.closePath(); CTX.fill();
        }

        // ── Kratib weapon ─────────────────────────────────────────────
        if (typeof drawPoomWeapon === 'function') drawPoomWeapon(CTX);

        // ── Floating hand blobs (holding weapon) ─────────────────────
        CTX.fillStyle  = '#fbbf24';
        CTX.shadowBlur = 5; CTX.shadowColor = '#f59e0b';
        // Front hand near launcher body
        CTX.beginPath(); CTX.arc(13, 0, 4.5, 0, Math.PI * 2); CTX.fill();
        // Back/off hand
        CTX.fillStyle = '#f59e0b';
        CTX.beginPath(); CTX.arc(-12, 2, 4, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        CTX.restore(); // end body transform

        // ── Level badge ───────────────────────────────────────────────
        if (this.level > 1) {
            CTX.fillStyle = 'rgba(217,119,6,0.92)';
            CTX.beginPath(); CTX.arc(screen.x + 20, screen.y - 20, 9, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#fff'; CTX.font = 'bold 9px Arial';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x + 20, screen.y - 20);
        }
    }

    updateUI() {
        const S = this.stats;
        const hpBar = document.getElementById('hp-bar');
        const enBar = document.getElementById('en-bar');
        if (hpBar) hpBar.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enBar) enBar.style.width = `${this.energy / this.maxEnergy * 100}%`;

        // ── Dash cooldown ──────────────────────────────────────────
        const dpEl = document.getElementById('dash-cd');
        if (dpEl) {
            const dp = Math.min(100, (1 - this.cooldowns.dash / S.dashCooldown) * 100);
            dpEl.style.height = `${100 - dp}%`;
        }
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('dash-icon',
                Math.max(0, this.cooldowns.dash), S.dashCooldown);
        }

        // ── Eat Rice cooldown ──────────────────────────────────────
        const eatCd   = document.getElementById('eat-cd');
        const eatIcon = document.getElementById('eat-icon');
        if (eatCd) {
            if (this.isEatingRice) { eatCd.style.height = '0%'; eatIcon?.classList.add('active'); }
            else {
                eatIcon?.classList.remove('active');
                const ep = Math.min(100, (1 - this.cooldowns.eat / S.eatRiceCooldown) * 100);
                eatCd.style.height = `${100 - ep}%`;
            }
        }
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('eat-icon',
                this.isEatingRice ? 0 : Math.max(0, this.cooldowns.eat),
                S.eatRiceCooldown);
        }

        // ── Naga cooldown ──────────────────────────────────────────
        const nagaCd = document.getElementById('naga-cd');
        if (nagaCd) {
            const np = Math.min(100, (1 - this.cooldowns.naga / S.nagaCooldown) * 100);
            nagaCd.style.height = `${100 - np}%`;
        }
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('naga-icon',
                Math.max(0, this.cooldowns.naga), S.nagaCooldown);
        }

        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;
    }
}

// ════════════════════════════════════════════════════════════
// ✅ WARN 5 FIX — Share checkObstacleProximity with PoomPlayer
// ════════════════════════════════════════════════════════════
PoomPlayer.prototype.checkObstacleProximity = Player.prototype.checkObstacleProximity;

// ════════════════════════════════════════════════════════════
// 🐍 NAGA ENTITY
// ════════════════════════════════════════════════════════════
class NagaEntity extends Entity {
    constructor(startX, startY, owner) {
        const S = BALANCE.characters.poom;
        super(startX, startY, S.nagaRadius);
        this.owner    = owner;
        const n       = S.nagaSegments;
        this.segments = Array.from({ length: n }, () => ({ x: startX, y: startY }));
        this.life     = S.nagaDuration;
        this.maxLife  = S.nagaDuration;
        this.speed    = S.nagaSpeed;
        this.damage   = S.nagaDamage * (owner.damageMultiplier || 1.0);
        this.active  = true;  // false when life <= 0 (Poom invincibility check)
        // this.radius set by Entity via super()

        // ✅ AUDIO 2 — Rate-limit Naga hit sound.
        // Stores Date.now() of the last Audio.playNagaAttack() call.
        // Sound fires at most once per NAGA_SOUND_INTERVAL ms (220 ms).
        this.lastSoundTime = 0;
    }

    update(dt, player, _meteorZones) {
        const S = BALANCE.characters.poom;
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
            if (this.owner) this.owner.naga = null;
            return true;
        }

        const head = this.segments[0];
        // Follows the mouse cursor — intentional design so the player can
        // actively aim and steer the Naga during its lifetime.
        const dx = mouse.wx - head.x, dy = mouse.wy - head.y;
        const d = Math.hypot(dx, dy);
        if (d > 8) {
            const step = Math.min(this.speed * dt, d);
            head.x += (dx/d)*step; head.y += (dy/d)*step;
        }
        const segDist = S.nagaSegmentDistance;
        for (let i = 1; i < this.segments.length; i++) {
            const prev = this.segments[i-1], curr = this.segments[i];
            const sdx = curr.x - prev.x, sdy = curr.y - prev.y;
            const sd = Math.hypot(sdx, sdy);
            if (sd > segDist) { curr.x = prev.x+(sdx/sd)*segDist; curr.y = prev.y+(sdy/sd)*segDist; }
        }

        // ── Enemy collision ───────────────────────────────────
        for (const enemy of (window.enemies || [])) {
            if (enemy.dead) continue;
            for (const seg of this.segments) {
                if (dist(seg.x, seg.y, enemy.x, enemy.y) < this.radius + enemy.radius) {
                    enemy.takeDamage(this.damage * dt, player);
                    if (Math.random() < 0.1) spawnParticles(seg.x, seg.y, 2, '#10b981');

                    // ✅ AUDIO 2 — Rate-limited energy-hiss on enemy hit
                    const now = Date.now();
                    if (now - this.lastSoundTime >= NAGA_SOUND_INTERVAL) {
                        this.lastSoundTime = now;
                        Audio.playNagaAttack();
                    }
                    break;
                }
            }
        }

        // ── Boss collision ────────────────────────────────────
        if (window.boss && !window.boss.dead) {
            for (const seg of this.segments) {
                if (dist(seg.x, seg.y, window.boss.x, window.boss.y) < this.radius + window.boss.radius) {
                    window.boss.takeDamage(this.damage * dt * 0.4);

                    // ✅ AUDIO 2 — Same rate-limit applies for boss hits
                    const now = Date.now();
                    if (now - this.lastSoundTime >= NAGA_SOUND_INTERVAL) {
                        this.lastSoundTime = now;
                        Audio.playNagaAttack();
                    }
                    break;
                }
            }
        }

        return false;
    }

    draw() {
        const lifeRatio = this.life / this.maxLife;
        const now = performance.now();

        // ── Body segments (tail → neck) ──────────────────────────────
        for (let i = this.segments.length - 1; i >= 1; i--) {
            const seg    = this.segments[i];
            const screen = worldToScreen(seg.x, seg.y);
            const t      = i / (this.segments.length - 1);
            const r      = this.radius * (1 - t * 0.55);
            const alpha  = lifeRatio * (1 - t * 0.3);

            CTX.save();
            CTX.globalAlpha = Math.max(0.1, alpha);

            if (i === this.segments.length - 1) {
                // Tail tip — tapered spike
                const prevSeg = this.segments[i - 1];
                const tailAngle = Math.atan2(seg.y - prevSeg.y, seg.x - prevSeg.x);
                CTX.translate(screen.x, screen.y);
                CTX.rotate(tailAngle);
                CTX.fillStyle = '#065f46';
                CTX.shadowBlur = 4; CTX.shadowColor = '#10b981';
                CTX.beginPath();
                CTX.moveTo(-r, -r * 0.4);
                CTX.lineTo( r, -r * 0.4);
                CTX.lineTo( r * 2.5, 0);
                CTX.lineTo( r, r * 0.4);
                CTX.lineTo(-r, r * 0.4);
                CTX.closePath(); CTX.fill();
            } else {
                // Body scale — alternating emerald tones with subtle scale marks
                const isEven = i % 2 === 0;
                const scaleGrad = CTX.createRadialGradient(
                    screen.x - r * 0.25, screen.y - r * 0.25, 0,
                    screen.x, screen.y, r
                );
                scaleGrad.addColorStop(0, isEven ? '#34d399' : '#10b981');
                scaleGrad.addColorStop(0.6, isEven ? '#10b981' : '#059669');
                scaleGrad.addColorStop(1, '#064e3b');
                CTX.fillStyle = scaleGrad;
                CTX.shadowBlur  = 8 + Math.sin(now / 300 + i) * 3;
                CTX.shadowColor = '#10b981';
                CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.fill();
                // Scale ridge line
                if (r > 7) {
                    CTX.strokeStyle = 'rgba(6,78,59,0.55)';
                    CTX.lineWidth   = 1.2;
                    CTX.beginPath();
                    CTX.arc(screen.x, screen.y, r * 0.65, 0, Math.PI * 2);
                    CTX.stroke();
                }
            }
            CTX.restore();
        }

        // ══ HEAD — Majestic Naga ══
        if (this.segments.length > 0) {
            const head    = this.segments[0];
            const hs      = worldToScreen(head.x, head.y);
            const r       = this.radius;
            const headAlpha = lifeRatio;

            // Compute head facing angle from first two segments
            let headAngle = 0;
            if (this.segments.length > 1) {
                const neck = this.segments[1];
                headAngle  = Math.atan2(head.y - neck.y, head.x - neck.x);
            }

            CTX.save();
            CTX.translate(hs.x, hs.y);
            CTX.rotate(headAngle);
            CTX.globalAlpha = Math.max(0.15, headAlpha);

            // ── Aura pulsing ring ─────────────────────────────────
            const auraR = r * 1.8 + Math.sin(now / 120) * 3;
            CTX.globalAlpha = headAlpha * (0.4 + Math.sin(now / 160) * 0.2);
            CTX.strokeStyle = '#34d399';
            CTX.lineWidth   = 2;
            CTX.shadowBlur  = 16 + Math.sin(now / 130) * 8;
            CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(0, 0, auraR, 0, Math.PI * 2); CTX.stroke();

            CTX.globalAlpha = Math.max(0.15, headAlpha);

            // ── Main head shape (pointed snout, wide jaw) ─────────
            const headGrad = CTX.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r * 1.1);
            headGrad.addColorStop(0, '#34d399');
            headGrad.addColorStop(0.5, '#059669');
            headGrad.addColorStop(1, '#064e3b');
            CTX.fillStyle = headGrad;
            CTX.shadowBlur  = 20; CTX.shadowColor = '#10b981';
            CTX.beginPath();
            CTX.moveTo(r * 1.3, 0);                                    // snout tip
            CTX.quadraticCurveTo(r * 1.0, -r * 0.8, 0, -r * 0.85);    // upper jaw
            CTX.quadraticCurveTo(-r * 0.7, -r * 0.9, -r, -r * 0.55);  // crown back
            CTX.quadraticCurveTo(-r * 1.1, 0, -r, r * 0.55);           // neck left
            CTX.quadraticCurveTo(-r * 0.7, r * 0.9, 0, r * 0.85);      // lower jaw
            CTX.quadraticCurveTo(r * 1.0, r * 0.8, r * 1.3, 0);        // snout tip again
            CTX.closePath(); CTX.fill();
            CTX.shadowBlur = 0;

            // ── HORNS — two curved swept-back horns ───────────────
            CTX.strokeStyle = '#fbbf24';
            CTX.lineWidth   = 3;
            CTX.lineCap     = 'round';
            CTX.shadowBlur  = 10; CTX.shadowColor = '#f59e0b';
            // Left horn
            CTX.beginPath();
            CTX.moveTo(-r * 0.3, -r * 0.65);
            CTX.quadraticCurveTo(-r * 0.6, -r * 1.4, -r * 0.1, -r * 1.8);
            CTX.stroke();
            // Right horn
            CTX.beginPath();
            CTX.moveTo( r * 0.3, -r * 0.65);
            CTX.quadraticCurveTo( r * 0.6, -r * 1.4, r * 0.1, -r * 1.8);
            CTX.stroke();
            // Horn tips glow dot
            CTX.fillStyle = '#fef08a';
            CTX.shadowBlur = 14; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(-r * 0.1, -r * 1.8, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc( r * 0.1, -r * 1.8, 2.5, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;

            // ── FLOWING MANE — layered quadratic curves ───────────
            const manePhase = now / 200;
            CTX.lineWidth   = 2.5;
            CTX.lineCap     = 'round';
            // Three mane strands per side for a "majestic" multi-layer look
            const maneStrands = [
                { side: -1, baseY: -r * 0.4, cp1x: -r * 1.6, cp1y: -r * 0.2, endX: -r * 1.4, endY: r * 0.5, phase: 0 },
                { side: -1, baseY: -r * 0.1, cp1x: -r * 1.8, cp1y:  r * 0.4, endX: -r * 1.2, endY: r * 1.0, phase: 0.7 },
                { side: -1, baseY:  r * 0.3, cp1x: -r * 1.4, cp1y:  r * 1.0, endX: -r * 0.8, endY: r * 1.5, phase: 1.4 },
                { side:  1, baseY: -r * 0.4, cp1x:  r * 1.6, cp1y: -r * 0.2, endX:  r * 1.4, endY: r * 0.5, phase: 0.3 },
                { side:  1, baseY: -r * 0.1, cp1x:  r * 1.8, cp1y:  r * 0.4, endX:  r * 1.2, endY: r * 1.0, phase: 1.0 },
                { side:  1, baseY:  r * 0.3, cp1x:  r * 1.4, cp1y:  r * 1.0, endX:  r * 0.8, endY: r * 1.5, phase: 1.7 },
            ];
            for (const ms of maneStrands) {
                const flutter = Math.sin(manePhase + ms.phase) * r * 0.35;
                const mAlpha  = headAlpha * (0.5 + Math.sin(manePhase + ms.phase) * 0.3);
                CTX.globalAlpha = Math.max(0, mAlpha);
                CTX.strokeStyle = '#6ee7b7';
                CTX.shadowBlur  = 8; CTX.shadowColor = '#10b981';
                CTX.beginPath();
                CTX.moveTo(0, ms.baseY);
                CTX.quadraticCurveTo(ms.cp1x + flutter * ms.side, ms.cp1y, ms.endX + flutter * ms.side * 0.5, ms.endY);
                CTX.stroke();
            }
            CTX.globalAlpha = Math.max(0.15, headAlpha);
            CTX.shadowBlur  = 0;

            // ── GLOWING EYES ──────────────────────────────────────
            const eyeGlow  = 0.6 + Math.sin(now / 180) * 0.4;
            const eyeColor = `rgba(245,158,11,${eyeGlow})`;
            // Eye whites (actually golden)
            CTX.fillStyle = eyeColor;
            CTX.shadowBlur  = 16 * eyeGlow; CTX.shadowColor = '#f59e0b';
            CTX.beginPath(); CTX.ellipse(r * 0.35, -r * 0.3, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.ellipse(r * 0.35,  r * 0.3, r * 0.28, r * 0.2, 0, 0, Math.PI * 2); CTX.fill();
            // Vertical slit pupils
            CTX.fillStyle = '#0f172a';
            CTX.shadowBlur = 0;
            CTX.beginPath(); CTX.ellipse(r * 0.38, -r * 0.3, r * 0.08, r * 0.16, 0, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.ellipse(r * 0.38,  r * 0.3, r * 0.08, r * 0.16, 0, 0, Math.PI * 2); CTX.fill();
            // Inner eye shine
            CTX.fillStyle = `rgba(255,251,235,${eyeGlow * 0.7})`;
            CTX.beginPath(); CTX.arc(r * 0.32, -r * 0.34, r * 0.07, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath(); CTX.arc(r * 0.32,  r * 0.26, r * 0.07, 0, Math.PI * 2); CTX.fill();

            // ── Life timer ───────────────────────────────────────
            CTX.restore();
            CTX.save();
            CTX.globalAlpha = headAlpha * 0.85;
            CTX.fillStyle   = '#34d399';
            CTX.font = 'bold 10px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(`${this.life.toFixed(1)}s`, hs.x, hs.y - r * 2.4);
            CTX.restore();

            // ── Connection tether anchor ring ─────────────────────
            const pulse = 0.6 + Math.sin(now / 130) * 0.4;
            CTX.save();
            CTX.globalAlpha  = lifeRatio * (0.5 + pulse * 0.4);
            CTX.strokeStyle  = '#34d399';
            CTX.lineWidth    = 1.5;
            CTX.shadowBlur   = 12 * pulse;
            CTX.shadowColor  = '#10b981';
            CTX.beginPath();
            CTX.arc(hs.x, hs.y, this.radius * 1.6, 0, Math.PI * 2);
            CTX.stroke();
            CTX.restore();
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🤖 DRONE
// ════════════════════════════════════════════════════════════
class Drone extends Entity {
    constructor() {
        const S = BALANCE.drone;
        super(0, 0, S.radius);
        this.shootCooldown = 0;
        this.targetAngle   = 0;
        this.hasTarget     = false;
        this.bobTimer      = Math.random() * Math.PI * 2;
        this.orbitAngle    = 0;
        this.lockTimer     = 0;
    }

    update(dt, player) {
        const S = BALANCE.drone;
        this.bobTimer   += dt * S.bobSpeed;
        this.orbitAngle += dt * S.orbitSpeed;
        this.lockTimer  += dt;
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        const targetX = player.x + Math.cos(this.orbitAngle) * S.orbitRadius;
        const targetY = player.y + Math.sin(this.orbitAngle) * S.orbitRadius
                        + Math.sin(this.bobTimer) * S.bobAmplitude;
        const lerpFactor = 1 - Math.pow(S.lerpBase, dt);
        this.x += (targetX - this.x) * lerpFactor;
        this.y += (targetY - this.y) * lerpFactor;

        this.hasTarget = false;
        if (this.shootCooldown <= 0) {
            const target = this._findNearestEnemy();
            if (target) {
                this.targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
                this.hasTarget   = true;
                this.lockTimer   = 0;
                projectileManager.add(new Projectile(
                    this.x, this.y, this.targetAngle,
                    S.projectileSpeed, S.damage, S.projectileColor, false, 'player'
                ));
                this.shootCooldown = 1.0 / S.fireRate;
                spawnParticles(this.x, this.y, 2, S.projectileColor);
            }
        }
    }

    _findNearestEnemy() {
        const S = BALANCE.drone;
        let nearest = null, nearestDist = S.range;
        for (const e of (window.enemies || [])) {
            if (e.dead) continue;
            const d = dist(this.x, this.y, e.x, e.y);
            if (d < nearestDist) { nearestDist = d; nearest = e; }
        }
        if (window.boss && !window.boss.dead) {
            const d = dist(this.x, this.y, window.boss.x, window.boss.y);
            if (d < nearestDist) nearest = window.boss;
        }
        return nearest;
    }

    draw() {
        const S         = BALANCE.drone;
        const bobOffset = Math.sin(this.bobTimer) * S.bobAmplitude;
        const groundScreen = worldToScreen(this.x, this.y);
        const bodyScreen   = worldToScreen(this.x, this.y + bobOffset);

        const shadowAlpha = 0.15 + (1-(bobOffset+S.bobAmplitude)/(S.bobAmplitude*2))*0.2;
        const shadowScale = 0.8  + (1-(bobOffset+S.bobAmplitude)/(S.bobAmplitude*2))*0.2;
        CTX.save();
        CTX.globalAlpha = Math.max(0.05, shadowAlpha);
        CTX.fillStyle   = 'rgba(0,0,0,0.6)';
        CTX.beginPath();
        CTX.ellipse(groundScreen.x, groundScreen.y+22, 16*shadowScale, 5*shadowScale, 0,0,Math.PI*2);
        CTX.fill(); CTX.restore();

        if (this.hasTarget) {
            const arcAlpha = 0.5+Math.sin(this.lockTimer*12)*0.3;
            CTX.save(); CTX.globalAlpha=arcAlpha; CTX.strokeStyle='#00e5ff';
            CTX.lineWidth=1.5; CTX.shadowBlur=8; CTX.shadowColor='#00e5ff';
            CTX.beginPath();
            CTX.arc(bodyScreen.x,bodyScreen.y,S.radius+8,this.targetAngle-0.6,this.targetAngle+0.6);
            CTX.stroke(); CTX.restore();
        }

        CTX.save();
        CTX.translate(bodyScreen.x, bodyScreen.y);

        const armAngle = this.orbitAngle * 2.5;
        CTX.save(); CTX.rotate(armAngle);
        for (let side=-1; side<=1; side+=2) {
            CTX.strokeStyle='#475569'; CTX.lineWidth=2.5;
            CTX.beginPath(); CTX.moveTo(0,0); CTX.lineTo(side*19,-3); CTX.stroke();
            CTX.fillStyle='#64748b';
            CTX.beginPath(); CTX.arc(side*19,-3,3.5,0,Math.PI*2); CTX.fill();
            const spin=this.bobTimer*8;
            CTX.save(); CTX.translate(side*19,-3); CTX.rotate(spin*side);
            CTX.strokeStyle='rgba(148,163,184,0.75)'; CTX.lineWidth=2;
            for(let blade=0;blade<4;blade++){
                const a=(blade/4)*Math.PI*2;
                CTX.beginPath(); CTX.moveTo(0,0); CTX.lineTo(Math.cos(a)*8,Math.sin(a)*8); CTX.stroke();
            }
            CTX.restore();
        }
        CTX.restore();

        const glowPulse=0.6+Math.sin(this.bobTimer*2)*0.4;
        CTX.shadowBlur=10*glowPulse; CTX.shadowColor='#00e5ff';
        CTX.fillStyle='#1e293b'; CTX.strokeStyle='#334155'; CTX.lineWidth=1.5;
        CTX.beginPath();
        for(let i=0;i<6;i++){
            const a=(i/6)*Math.PI*2-Math.PI/6, r=S.radius;
            if(i===0) CTX.moveTo(Math.cos(a)*r,Math.sin(a)*r);
            else      CTX.lineTo(Math.cos(a)*r,Math.sin(a)*r);
        }
        CTX.closePath(); CTX.fill(); CTX.stroke();

        CTX.strokeStyle=`rgba(0,229,255,${0.5+glowPulse*0.5})`;
        CTX.lineWidth=1.5; CTX.shadowBlur=14*glowPulse; CTX.shadowColor='#00e5ff';
        CTX.beginPath(); CTX.arc(0,0,5,0,Math.PI*2); CTX.stroke();
        CTX.fillStyle=`rgba(0,229,255,${0.7*glowPulse})`;
        CTX.beginPath(); CTX.arc(0,0,3,0,Math.PI*2); CTX.fill();
        CTX.fillStyle='rgba(255,255,255,0.8)';
        CTX.beginPath(); CTX.arc(-1,-1,1,0,Math.PI*2); CTX.fill();
        CTX.shadowBlur=0;

        CTX.save(); CTX.rotate(this.targetAngle);
        CTX.fillStyle='#475569'; CTX.strokeStyle='#64748b'; CTX.lineWidth=1;
        CTX.beginPath(); CTX.roundRect(4,-2.5,11,5,2); CTX.fill(); CTX.stroke();
        CTX.fillStyle=this.hasTarget?'#00e5ff':'#334155';
        CTX.fillRect(13,-1.5,3,3);
        CTX.restore();

        CTX.restore();

        CTX.save(); CTX.globalAlpha=0.45; CTX.fillStyle='#94a3b8';
        CTX.font='bold 6px Arial'; CTX.textAlign='center'; CTX.textBaseline='middle';
        CTX.fillText('DRONE', bodyScreen.x, bodyScreen.y+S.radius+9);
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🐕 BARK WAVE — Sonic cone emitted by Boss's bark attack
// ════════════════════════════════════════════════════════════
class BarkWave {
    constructor(x, y, angle, coneHalf, range) {
        this.x=x; this.y=y; this.angle=angle;
        this.coneHalf=coneHalf; this.range=range;
        this.timer=0; this.duration=0.55; this.rings=5;
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

        for (let i=0; i<this.rings; i++) {
            const frac = (progress + i/this.rings) % 1;
            const r    = frac * this.range;
            if (r < 4) continue;
            const ringAlpha = alpha*(1-i/this.rings)*0.75;
            if (ringAlpha <= 0) continue;
            CTX.save();
            CTX.globalAlpha = ringAlpha;
            CTX.strokeStyle = i%2===0 ? '#f59e0b' : '#fbbf24';
            CTX.lineWidth   = Math.max(1, 3.5-i*0.5);
            CTX.shadowBlur  = 12; CTX.shadowColor='#d97706'; CTX.lineCap='round';
            CTX.beginPath(); CTX.arc(0,0,r,-this.coneHalf,this.coneHalf); CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(Math.cos(-this.coneHalf)*Math.max(0,r-25),Math.sin(-this.coneHalf)*Math.max(0,r-25));
            CTX.lineTo(Math.cos(-this.coneHalf)*r,Math.sin(-this.coneHalf)*r); CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(Math.cos(this.coneHalf)*Math.max(0,r-25),Math.sin(this.coneHalf)*Math.max(0,r-25));
            CTX.lineTo(Math.cos(this.coneHalf)*r,Math.sin(this.coneHalf)*r); CTX.stroke();
            CTX.restore();
        }
        if (progress < 0.25) {
            const flashAlpha=(1-progress/0.25)*0.8;
            CTX.globalAlpha=flashAlpha; CTX.fillStyle='#fbbf24';
            CTX.shadowBlur=20; CTX.shadowColor='#f59e0b';
            CTX.beginPath(); CTX.arc(0,0,14*(1-progress/0.25),0,Math.PI*2); CTX.fill();
        }
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// ✅ Option B — Share identical Player methods with PoomPlayer
// (PoomPlayer keeps its own takeDamage for Naga invincibility guard.)
// ════════════════════════════════════════════════════════════
PoomPlayer.prototype.heal               = Player.prototype.heal;
PoomPlayer.prototype.gainExp            = Player.prototype.gainExp;
PoomPlayer.prototype.levelUp            = Player.prototype.levelUp;
PoomPlayer.prototype.addSpeedBoost      = Player.prototype.addSpeedBoost;
PoomPlayer.prototype.checkPassiveUnlock = Player.prototype.checkPassiveUnlock;

// ─── Mobile patch ─────────────────────────────────────────────
// ✅ BUG 2 FIX: zeroes WASD when joystick active, then delegates to
// __origUpdate which handles the joystick read exactly once.
if (typeof Player !== 'undefined') {
    const __origUpdate = Player.prototype.update;
    Player.prototype.update = function(dt, keys, mouse) {
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            keys.w = keys.a = keys.s = keys.d = 0;
        }
        __origUpdate.call(this, dt, keys, mouse);
    };
}