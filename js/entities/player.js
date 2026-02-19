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
        this.cooldowns.stealth = this.stats.stealthCooldown;
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
        this.vx = Math.cos(angle) * (S.dashDistance / 0.2);
        this.vy = Math.sin(angle) * (S.dashDistance / 0.2);

        // Ghost trail — staggered snapshots captured during the dash window
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                if (!this.dead) {
                    this.dashGhosts.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
                }
            }, i * 30);
        }

        spawnParticles(this.x, this.y, 15, '#60a5fa');   // Kao blue
        Audio.playDash();
        Achievements.stats.dashes++;
        Achievements.check('speedster');

        setTimeout(() => { if (!this.dead) this.isDashing = false; }, 200);
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
        const S = this.stats;

        _standAura_draw(this, this.charId || 'kao');

        for (const img of this.dashGhosts) {
            const screen = worldToScreen(img.x, img.y);
            CTX.save(); CTX.translate(screen.x, screen.y); CTX.rotate(img.angle);
            CTX.globalAlpha = img.life * 0.3; CTX.fillStyle = '#60a5fa';
            CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 8); CTX.fill(); CTX.restore();
        }
        const screen = worldToScreen(this.x, this.y);
        CTX.fillStyle = 'rgba(0,0,0,0.3)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 25, 18, 8, 0, 0, Math.PI * 2); CTX.fill();

        if (this.passiveUnlocked) {
            const auraSize  = 35 + Math.sin(performance.now() / 200) * 5;
            const auraAlpha = 0.3 + Math.sin(performance.now() / 300) * 0.1;
            CTX.save(); CTX.globalAlpha = auraAlpha; CTX.strokeStyle = '#fbbf24';
            CTX.lineWidth = 3; CTX.shadowBlur = 20; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2); CTX.stroke(); CTX.restore();
        }

        if (this.isConfused) { CTX.font = 'bold 24px Arial'; CTX.fillText('😵', screen.x, screen.y - 40); }
        if (this.isBurning)  { CTX.font = 'bold 20px Arial'; CTX.fillText('🔥', screen.x + 20, screen.y - 35); }

        CTX.save(); CTX.translate(screen.x, screen.y); CTX.rotate(this.angle);
        CTX.globalAlpha = this.isInvisible ? 0.3 : 1;

        // ── v11 Recoil body-lean ──────────────────────────────────
        // Push the body slightly backward (–x in local/rotated space) when
        // weaponRecoil > 0. Max shift is 4 px at recoil=1; fades to 0.
        const recoilShift = this.weaponRecoil * 4;
        if (recoilShift > 0.05) CTX.translate(-recoilShift, 0);

        const w = Math.sin(this.walkCycle) * 8;
        CTX.fillStyle = '#1e293b';
        CTX.beginPath(); CTX.ellipse(5 + w, 10, 6, 4, 0, 0, Math.PI * 2); CTX.fill();
        CTX.beginPath(); CTX.ellipse(5 - w, -10, 6, 4, 0, 0, Math.PI * 2); CTX.fill();

        // ── v11 Outer glow silhouette (Task 4) ──────────────────────
        // Draws a neon green stroke around the body rect before filling it so
        // Kao stands out clearly against dark backgrounds and busy particle fields.
        CTX.shadowBlur  = 16;
        CTX.shadowColor = '#00ff41';
        CTX.strokeStyle = 'rgba(0,255,65,0.70)';
        CTX.lineWidth   = 2.8;
        CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 6); CTX.stroke();
        CTX.shadowBlur  = 0;

        CTX.fillStyle = '#f8fafc'; CTX.beginPath(); CTX.roundRect(-15, -12, 30, 24, 6); CTX.fill();
        CTX.fillStyle = '#1e40af';
        CTX.beginPath(); CTX.moveTo(0,-12); CTX.lineTo(-3,0); CTX.lineTo(-5,12);
        CTX.lineTo(0,15); CTX.lineTo(5,12); CTX.lineTo(3,0); CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#2563eb'; CTX.font = 'bold 8px Arial'; CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillText('MTC', 0, -5);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(0, 0, 13, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#0f172a';
        CTX.beginPath(); CTX.arc(0,0,14,Math.PI*1.1,Math.PI*2.9); CTX.fill();
        CTX.beginPath(); CTX.arc(-8,-5,6,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc( 8,-5,6,0,Math.PI*2); CTX.fill();
        CTX.strokeStyle = '#333'; CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(-6,0,5,0,Math.PI*2);
        CTX.moveTo(7,0); CTX.arc(6,0,5,0,Math.PI*2);
        CTX.moveTo(-1,0); CTX.lineTo(1,0); CTX.stroke();
        const t = performance.now() / 500;
        const gl = Math.abs(Math.sin(t)) * 0.8 + 0.2;
        CTX.fillStyle = `rgba(255,255,255,${gl})`;
        CTX.fillRect(-8,-2,3,2); CTX.fillRect(4,-2,3,2);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(10,15,5,0,Math.PI*2); CTX.fill();
        if (typeof weaponSystem !== 'undefined') weaponSystem.drawWeaponOnPlayer(this);
        CTX.fillStyle = '#ffdfc4'; CTX.beginPath(); CTX.arc(8,-15,5,0,Math.PI*2); CTX.fill();
        CTX.restore();

        // ── v11 Muzzle-flash ring (recoil peak only) ─────────────────
        // Drawn OUTSIDE the body transform (screen-space) so the ring always
        // appears at the muzzle direction, unaffected by the body lean offset.
        if (this.weaponRecoil > 0.45) {
            const flashT    = (this.weaponRecoil - 0.45) / 0.55; // 0→1 as recoil rises from 0.45→1
            const muzzleDist = 22 + (1 - flashT) * 8;
            const mx = screen.x + Math.cos(this.angle) * muzzleDist;
            const my = screen.y + Math.sin(this.angle) * muzzleDist;
            CTX.save();
            CTX.globalAlpha = flashT * 0.85;
            CTX.strokeStyle = '#fffde7';
            CTX.lineWidth   = 2;
            CTX.shadowBlur  = 14;
            CTX.shadowColor = '#facc15';
            CTX.beginPath();
            CTX.arc(mx, my, 5 + (1 - flashT) * 6, 0, Math.PI * 2);
            CTX.stroke();
            // Inner bright core
            CTX.fillStyle   = `rgba(255,255,200,${flashT * 0.7})`;
            CTX.shadowBlur  = 8;
            CTX.beginPath();
            CTX.arc(mx, my, 2 + (1 - flashT) * 3, 0, Math.PI * 2);
            CTX.fill();
            CTX.restore();
        }

        if (this.level > 1) {
            CTX.fillStyle = 'rgba(139,92,246,0.9)';
            CTX.beginPath(); CTX.arc(screen.x+22, screen.y-22, 10, 0, Math.PI*2); CTX.fill();
            CTX.fillStyle = '#fff'; CTX.font = 'bold 10px Arial';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText(this.level, screen.x+22, screen.y-22);
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

        // ── Collision Awareness state (mirrors Player) ─────────
        this.obstacleBuffTimer     = 0;
        this.lastObstacleWarning   = 0;

        this.level = 1; this.exp = 0;
        this.expToNextLevel = stats.expToNextLevel;
        this.baseCritChance = stats.critChance;
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
        this.updateUI();
    }

    shoot() {
        const S = this.stats;
        if (this.cooldowns.shoot > 0) return;
        this.cooldowns.shoot = S.riceCooldown;
        const { damage, isCrit } = this.dealDamage(S.riceDamage * this.damageBoost);
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
        this.cooldowns.eat = S.eatRiceCooldown;
        spawnParticles(this.x, this.y, 30, '#fbbf24');
        spawnFloatingText('กินข้าวเหนียว!', this.x, this.y - 50, '#fbbf24', 22);
        showVoiceBubble('อร่อยแท้ๆ!', this.x, this.y - 40);
        addScreenShake(5); Audio.playPowerUp();
    }

    summonNaga() {
        const S = this.stats;
        this.cooldowns.naga = S.nagaCooldown;
        window.specialEffects.push(new NagaEntity(this.x, this.y, this));
        spawnParticles(this.x, this.y, 40, '#10b981');
        spawnFloatingText('อัญเชิญพญานาค!', this.x, this.y - 60, '#10b981', 24);
        showVoiceBubble('ขอพรพญานาค!', this.x, this.y - 40);
        addScreenShake(10); Audio.playAchievement();
        this.nagaCount++;
        if (this.nagaCount >= 3) Achievements.check('naga_summoner');
    }

    dash(ax, ay) {
        const S = this.stats;
        this.isDashing = true;
        this.cooldowns.dash = S.dashCooldown;
        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        this.vx = Math.cos(angle) * (S.dashDistance / 0.2);
        this.vy = Math.sin(angle) * (S.dashDistance / 0.2);
        for (let i = 0; i < 5; i++) setTimeout(() => {
            if (!this.dead) this.dashGhosts.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
        }, i * 30);
        spawnParticles(this.x, this.y, 15, '#fbbf24');
        Audio.playDash(); Achievements.stats.dashes++; Achievements.check('speedster');
        setTimeout(() => { this.isDashing = false; }, 200);
    }

    takeDamage(amt) {
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

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);
        const w = Math.sin(this.walkCycle) * 8;

        CTX.fillStyle = '#1e3a8a';
        CTX.beginPath(); CTX.ellipse(5+w,12,7,5,0,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.ellipse(5-w,-12,7,5,0,0,Math.PI*2); CTX.fill();

        // ── v11 Outer glow silhouette (Task 4) ─────────────────────────────
        // Poom uses a deep-purple neon stroke matching his stand-aura colour.
        CTX.shadowBlur  = 16;
        CTX.shadowColor = '#a855f7';
        CTX.strokeStyle = 'rgba(168,85,247,0.72)';
        CTX.lineWidth   = 2.8;
        CTX.beginPath(); CTX.roundRect(-16,-13,32,26,5); CTX.stroke();
        CTX.shadowBlur  = 0;

        CTX.fillStyle = '#dc2626';
        CTX.beginPath(); CTX.roundRect(-16,-13,32,26,5); CTX.fill();

        CTX.save();
        CTX.beginPath(); CTX.roundRect(-16,-13,32,26,5); CTX.clip();
        CTX.strokeStyle='rgba(255,255,255,0.5)'; CTX.lineWidth=3;
        for(let xi=-16;xi<=16;xi+=8){CTX.beginPath();CTX.moveTo(xi,-13);CTX.lineTo(xi,13);CTX.stroke();}
        for(let yi=-13;yi<=13;yi+=7){CTX.beginPath();CTX.moveTo(-16,yi);CTX.lineTo(16,yi);CTX.stroke();}
        CTX.restore();

        CTX.fillStyle = '#d4a574';
        CTX.beginPath(); CTX.arc(10,14,5,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc(8,-14,5,0,Math.PI*2); CTX.fill();

        CTX.fillStyle = '#d4a574';
        CTX.beginPath(); CTX.arc(0,0,13,0,Math.PI*2); CTX.fill();
        CTX.fillStyle = '#0f172a';
        CTX.beginPath(); CTX.arc(0,0,14,Math.PI*1.15,Math.PI*2.85); CTX.fill();
        CTX.beginPath(); CTX.arc(-7,-4,5,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc(7,-4,5,0,Math.PI*2); CTX.fill();

        CTX.strokeStyle='#1e293b'; CTX.lineWidth=2.5;
        CTX.beginPath(); CTX.arc(-5,1,4.5,0,Math.PI*2); CTX.moveTo(6,1); CTX.arc(5,1,4.5,0,Math.PI*2); CTX.stroke();
        const tg = performance.now()/500;
        CTX.fillStyle=`rgba(255,255,255,${Math.abs(Math.sin(tg))*0.7+0.3})`;
        CTX.fillRect(-7,-1,3,2); CTX.fillRect(3,-1,3,2);

        CTX.strokeStyle='#7c3c2a'; CTX.lineWidth=2;
        CTX.beginPath(); CTX.arc(0,2,5,0.1,Math.PI-0.1); CTX.stroke();

        CTX.restore();

        if (this.level > 1) {
            CTX.fillStyle = 'rgba(234,88,12,0.9)';
            CTX.beginPath(); CTX.arc(screen.x+22, screen.y-22, 10, 0, Math.PI*2); CTX.fill();
            CTX.fillStyle='#fff'; CTX.font='bold 10px Arial';
            CTX.textAlign='center'; CTX.textBaseline='middle';
            CTX.fillText(this.level, screen.x+22, screen.y-22);
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
        this.damage   = S.nagaDamage;
        // this.radius set by Entity via super()

        // ✅ AUDIO 2 — Rate-limit Naga hit sound.
        // Stores Date.now() of the last Audio.playNagaAttack() call.
        // Sound fires at most once per NAGA_SOUND_INTERVAL ms (220 ms).
        this.lastSoundTime = 0;
    }

    update(dt, player, _meteorZones) {
        const S = BALANCE.characters.poom;
        this.life -= dt;
        if (this.life <= 0) return true;

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
        for (let i = this.segments.length-1; i >= 0; i--) {
            const seg = this.segments[i];
            const screen = worldToScreen(seg.x, seg.y);
            const t = i / (this.segments.length-1);
            const r = this.radius * (1-t*0.55);
            const alpha = lifeRatio * (1-t*0.3);
            CTX.save(); CTX.globalAlpha = Math.max(0.1, alpha);
            if (i === 0) {
                CTX.fillStyle='#fbbf24'; CTX.shadowBlur=20; CTX.shadowColor='#fbbf24';
                CTX.beginPath(); CTX.arc(screen.x,screen.y,r,0,Math.PI*2); CTX.fill();
                CTX.shadowBlur=0;
                CTX.fillStyle='#ef4444';
                CTX.beginPath(); CTX.arc(screen.x-r*.35,screen.y-r*.2,r*.25,0,Math.PI*2); CTX.fill();
                CTX.beginPath(); CTX.arc(screen.x+r*.35,screen.y-r*.2,r*.25,0,Math.PI*2); CTX.fill();
            } else if (i === this.segments.length-1) {
                CTX.fillStyle='#065f46'; CTX.shadowBlur=6; CTX.shadowColor='#10b981';
                CTX.beginPath(); CTX.arc(screen.x,screen.y,r,0,Math.PI*2); CTX.fill();
            } else {
                CTX.fillStyle = i%2===0 ? '#10b981' : '#059669';
                CTX.shadowBlur=10; CTX.shadowColor='#10b981';
                CTX.beginPath(); CTX.arc(screen.x,screen.y,r,0,Math.PI*2); CTX.fill();
                if (i%2===0 && r>8) {
                    CTX.strokeStyle='rgba(6,95,70,0.6)'; CTX.lineWidth=1.5;
                    CTX.beginPath(); CTX.arc(screen.x,screen.y,r*.7,0,Math.PI*2); CTX.stroke();
                }
            }
            CTX.restore();
        }
        if (this.segments.length > 0) {
            const hs = worldToScreen(this.segments[0].x, this.segments[0].y);
            CTX.fillStyle=`rgba(251,191,36,${lifeRatio})`;
            CTX.font='bold 10px Arial'; CTX.textAlign='center'; CTX.textBaseline='middle';
            CTX.fillText(`${this.life.toFixed(1)}s`, hs.x, hs.y-32);

            // ── Task 4: Connection Line anchor on Naga head ─────────────────
            // A pulsing emerald ring around the head signals where the tether
            // terminates, reinforcing the visual link drawn from Poom's side.
            const pulse = 0.6 + Math.sin(performance.now() / 130) * 0.4;
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
// ════════════════════════════════════════════════════════════
PoomPlayer.prototype.takeDamage         = Player.prototype.takeDamage;
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