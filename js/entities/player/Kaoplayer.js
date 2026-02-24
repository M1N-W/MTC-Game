'use strict';

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  KaoPlayer.js — "เก้า" Advanced Assassin Character                      ║
// ║  Skills: Teleport · Weapon Master Awakening · Clone of Stealth          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// ── KaoClone ─────────────────────────────────────────────────────────────────
// Phantom duplicate that mirrors Kao's attacks but is invisible to enemies.
class KaoClone {
    constructor(owner, angleOffset) {
        this.owner = owner;
        this.angleOffset = angleOffset;
        // FIX (TASK 1): Fallback radius and position to prevent Canvas .arc() crash
        this.radius = owner.radius || 20;
        this.x = owner.x || 0;
        this.y = owner.y || 0;
        this.color = '#3b82f6';
        this.alpha = 0.6;   // FIX (TASK 1): Slightly more visible (was 0.5)
    }

    update(dt) {
        const dist = 60;
        const targetX = this.owner.x + Math.cos(this.angleOffset) * dist;
        const targetY = this.owner.y + Math.sin(this.angleOffset) * dist;
        // Smooth-follow the orbit position
        this.x += (targetX - this.x) * 10 * dt;
        this.y += (targetY - this.y) * 10 * dt;
    }

    draw() {
        const sc = worldToScreen(this.x, this.y);
        const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);

        CTX.save();
        // Clones are faint when stealth is active
        CTX.globalAlpha = this.owner.isInvisible ? 0.15 : this.alpha;

        // Body circle
        CTX.fillStyle = this.owner.isWeaponMaster ? '#facc15' : this.color;
        CTX.shadowBlur = 14;
        CTX.shadowColor = this.owner.isWeaponMaster ? '#facc15' : '#3b82f6';
        CTX.beginPath();
        CTX.arc(sc.x, sc.y, this.radius, 0, Math.PI * 2);
        CTX.fill();
        CTX.shadowBlur = 0;

        // Barrel indicator
        CTX.strokeStyle = '#94a3b8';
        CTX.lineWidth = 3;
        CTX.beginPath();
        CTX.moveTo(sc.x, sc.y);
        CTX.lineTo(
            sc.x + Math.cos(aimAngle) * 28,
            sc.y + Math.sin(aimAngle) * 28
        );
        CTX.stroke();

        CTX.restore();
    }

    /** Fire projectiles from the clone's position, mirroring the owner's shot. */
    shoot(wep, damage, color, pellets, spread) {
        const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);
        for (let i = 0; i < pellets; i++) {
            const offset = (pellets > 1) ? (Math.random() - 0.5) * spread : 0;
            projectileManager.add(new Projectile(
                this.x, this.y,
                aimAngle + offset,
                wep.speed, damage, color,
                false, 'player'
            ));
        }
        spawnParticles(
            this.x + Math.cos(aimAngle) * 25,
            this.y + Math.sin(aimAngle) * 25,
            3, color
        );
    }
}


// ── KaoPlayer ─────────────────────────────────────────────────────────────────
class KaoPlayer extends Player {
    constructor(x = 0, y = 0) {
        super('kao');
        this.x = x;
        this.y = y;
        const S = BALANCE.characters.kao;

        // ── Teleport ───────────────────────────────────────────────────────────
        this.teleportTimer = 0;
        this.teleportCooldown = S.teleportCooldown || 20;
        this.teleportCharges = 0;   // max 1 charge at a time

        // ── Auto-stealth (Passive: ซุ่มเสรี) ──────────────────────────────────
        this.autoStealthCooldown = 0;   // internal cooldown for free stealth

        // ── Weapon Master Awakening ────────────────────────────────────────────
        this.weaponKills = { auto: 0, sniper: 0, shotgun: 0 };
        this.isWeaponMaster = false;

        // Sniper charge (hold-to-charge when Weapon Master)
        this.sniperChargeTime = 0;

        // Stacking crit bonus from Auto Rifle (Weapon Master)
        this.bonusCritFromAuto = 0;

        // ── Clone of Stealth (E skill) ─────────────────────────────────────────
        this.clones = [];
        this.cloneSkillCooldown = 0;
        this.maxCloneCooldown = S.cloneCooldown || 45;
        this.clonesActiveTimer = 0;

        // FIX (TASK 2): Own shoot cooldown — decoupled from weaponSystem to
        //               prevent the machine-gun NaN glitch.
        this.shootCooldown = 0;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // KILL TRACKING — called from enemy.js after each enemy death
    // ──────────────────────────────────────────────────────────────────────────
    addKill(weaponName) {
        // 🛡️ STRICT GATE: Cannot build weapon mastery if passive is not unlocked
        if (!this.passiveUnlocked) return;
        if (this.isWeaponMaster) return;   // already awakened, no need to track

        const req = BALANCE.characters.kao.weaponMasterReq || 10;

        if (weaponName === 'AUTO RIFLE') this.weaponKills.auto++;
        if (weaponName === 'SNIPER') this.weaponKills.sniper++;
        if (weaponName === 'SHOTGUN') this.weaponKills.shotgun++;

        // Unlock only when ALL three weapons have reached the required kills
        if (
            this.weaponKills.auto >= req &&
            this.weaponKills.sniper >= req &&
            this.weaponKills.shotgun >= req
        ) {
            this.isWeaponMaster = true;
            spawnFloatingText(
                GAME_TEXTS.combat.kaoWeaponAwaken,
                this.x, this.y - 60,
                '#facc15', 30
            );
            if (typeof Audio !== 'undefined' && Audio.playLevelUp) Audio.playLevelUp();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // UPDATE
    // ──────────────────────────────────────────────────────────────────────────
    update(dt, keys, mouse) {
        const S = BALANCE.characters.kao;

        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        // FIX (AUDIT #4): Back up the real speedBoost (from shop/powerups) before
        //                 the passive overwrites it, then restore it after
        //                 super.update() has read the physics value.  This way
        //                 the passive's x1.4 buff only lives for this one frame
        //                 and never permanently clobbers external speed items.
        const _speedBoostSnapshot = this.speedBoost;

        // ── 🛡️ STRICT GATE: Advanced Skills ──────────────────────────────────
        if (this.passiveUnlocked) {
            this.speedBoost = Math.max(this.speedBoost, 1.4);

            // 1. Auto-stealth (Free Stealth)
            const isMoving = keys.w || keys.a || keys.s || keys.d;
            if (isMoving && this.autoStealthCooldown <= 0 && Math.random() < 0.2 * dt) {
                this.isInvisible = true;
                this.ambushReady = true;
                this.energy = this.maxEnergy;
                this.autoStealthCooldown = S.autoStealthCooldown || 8;
                spawnFloatingText(GAME_TEXTS.combat.kaoFreeStealth, this.x, this.y - 40, '#a855f7', 20);
            }
            if (this.autoStealthCooldown > 0) this.autoStealthCooldown -= dt;

            // 2. Teleport (Charge & Q Key)
            if (this.teleportTimer < this.teleportCooldown && this.teleportCharges < 1) {
                this.teleportTimer += dt;
                if (this.teleportTimer >= this.teleportCooldown) {
                    this.teleportCharges = 1;
                    this.teleportTimer = 0;
                    spawnFloatingText(GAME_TEXTS.combat.kaoTeleport, this.x, this.y - 60, '#00e5ff', 20);
                }
            }
            if (keys.q && this.teleportCharges > 0) {
                this.teleportCharges--;
                spawnParticles(this.x, this.y, 25, '#3b82f6');
                this.x = window.mouse.wx;
                this.y = window.mouse.wy;
                keys.q = 0;
                spawnParticles(this.x, this.y, 25, '#3b82f6');
            }

            // 3. Clone of Stealth (Cooldown & E Key)
            if (this.cloneSkillCooldown > 0) this.cloneSkillCooldown -= dt;
            if (keys.e && this.cloneSkillCooldown <= 0) {
                this.clones = [
                    new KaoClone(this, (2 * Math.PI) / 3),
                    new KaoClone(this, (4 * Math.PI) / 3)
                ];
                this.clonesActiveTimer = S.cloneDuration || 15;
                this.cloneSkillCooldown = this.maxCloneCooldown;
                spawnFloatingText(GAME_TEXTS.combat.kaoClones, this.x, this.y - 40, '#3b82f6', 25);
                keys.e = 0;
            }
        } else {
            // Force reset keys if user tries to press them before unlocking
            keys.q = 0;
            keys.e = 0;
        }

        // ── Unrestricted Update Logic — existing clones keep moving ───────────
        if (this.clonesActiveTimer > 0) {
            this.clonesActiveTimer -= dt;
            const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);
            if (this.clones[0]) this.clones[0].angleOffset = aimAngle + Math.PI / 1.5;
            if (this.clones[1]) this.clones[1].angleOffset = aimAngle - Math.PI / 1.5;
            this.clones.forEach(c => c.update(dt));
            if (this.clonesActiveTimer <= 0) this.clones = [];
        }

        super.update(dt, keys, mouse);

        // FIX (AUDIT #4): Restore original speedBoost so the passive 1.4× buff
        //                 doesn't permanently overwrite shop/powerup speed items.
        this.speedBoost = _speedBoostSnapshot;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DRAW
    // ──────────────────────────────────────────────────────────────────────────
    draw() {
        // Draw clones first (behind player)
        this.clones.forEach(c => c.draw());

        // Weapon Master golden aura pulse
        if (this.isWeaponMaster) {
            const now = performance.now();
            const wmScreen = worldToScreen(this.x, this.y);
            CTX.save();
            CTX.globalAlpha = 0.3 + Math.sin(now / 150) * 0.2;
            CTX.fillStyle = '#facc15';
            CTX.shadowBlur = 20;
            CTX.shadowColor = '#facc15';
            CTX.beginPath();
            CTX.arc(wmScreen.x, wmScreen.y, this.radius + 8, 0, Math.PI * 2);
            CTX.fill();
            CTX.restore();
        }

        // Sniper charge laser-sight line
        if (this.sniperChargeTime > 0) {
            const screen = worldToScreen(this.x, this.y);
            const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);
            CTX.save();
            CTX.strokeStyle = `rgba(239, 68, 68, ${Math.min(1, this.sniperChargeTime)})`;
            CTX.lineWidth = 1 + this.sniperChargeTime * 2;
            CTX.beginPath();
            CTX.moveTo(screen.x, screen.y);
            CTX.lineTo(
                screen.x + Math.cos(aimAngle) * 2000,
                screen.y + Math.sin(aimAngle) * 2000
            );
            CTX.stroke();
            CTX.restore();
        }

        super.draw();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // SHOOT — entry point called every frame by the base class tick
    // ──────────────────────────────────────────────────────────────────────────
    shoot(dt) {
        if (typeof weaponSystem === 'undefined') return;
        // 🛡️ THE REAL FIX: currentWeapon is a STRING ('auto', 'sniper', 'shotgun')
        // We strictly look up the stats using this string key.
        const wepKey = weaponSystem.currentWeapon || 'auto';
        const wep = BALANCE.characters.kao.weapons[wepKey];
        if (!wep) return;
        const isClick = window.mouse.left === 1;
        const baseCd = wep.cooldown || 0.25;
        // ── Weapon Master Sniper: hold-to-charge mode (Gated) ──
        if (this.passiveUnlocked && this.isWeaponMaster && wepKey === 'sniper') {
            if (isClick && this.shootCooldown <= 0) {
                // Accumulate charge time; emit charge particles
                this.sniperChargeTime += dt;
                if (Math.random() < 0.3) spawnParticles(this.x, this.y, 1, '#ef4444');
                return;   // don't fire yet
            } else if (!isClick && this.sniperChargeTime > 0) {
                // Mouse released — fire the charged shot
                this.fireWeapon(wep, true);
                this.shootCooldown = baseCd * (this.cooldownMultiplier || 1);
                weaponSystem.weaponCooldown = this.shootCooldown; // Sync UI
                this.sniperChargeTime = 0;
                return;
            }
        } else {
            // Reset charge if passive/mastery not met, or weapon switched away
            this.sniperChargeTime = 0;
        }
        // ── Normal fire — guarded by internal cooldown ──
        if (isClick && this.shootCooldown <= 0) {
            this.fireWeapon(wep, false);
            this.shootCooldown = baseCd * (this.cooldownMultiplier || 1);
            weaponSystem.weaponCooldown = this.shootCooldown; // Sync UI
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FIRE WEAPON — handles all Weapon Master buffs, crits, and clone mirrors
    // ──────────────────────────────────────────────────────────────────────────
    fireWeapon(wep, isChargedSniper) {
        let pellets = wep.pellets || 1;
        let spread = wep.spread || 0;
        let baseDmg = wep.damage || 10;
        let color = wep.color || '#ffffff';

        // ── 🛡️ FIX: Stealth Break & Ambush Logic ──
        // Kao bypasses WeaponSystem.shootSingle() entirely, so ambush/stealth
        // logic that used to live there must be replicated here.
        let isAmbush = false;
        if (this.ambushReady) {
            isAmbush = true;
            this.ambushReady = false;
            this.breakStealth();
            spawnParticles(this.x, this.y, 15, '#facc15');
        } else if (this.isInvisible) {
            // Firing while invisible (e.g. late frame) still breaks stealth
            this.breakStealth();
        }

        let dmgMult = (this.damageMultiplier || 1.0) * (this.damageBoost || 1.0);
        if (this.isSecondWind) dmgMult *= (BALANCE.player.secondWindDamageMult || 1.5);

        const passiveCrit = this.passiveUnlocked ? (BALANCE.characters.kao.passiveCritBonus || 0) : 0;
        let critChance = (this.baseCritChance || 0) + passiveCrit + (this.bonusCritFromAuto || 0);

        // Apply Ambush: massive damage multiplier + guaranteed crit
        if (isAmbush) {
            baseDmg *= (this.stats.critMultiplier || 3);
            critChance = 1.0;
            color = '#facc15';
        }

        // ── Weapon Master buffs ──
        if (this.passiveUnlocked && this.isWeaponMaster) {
            if (!isAmbush) color = '#facc15'; // Base weapon master color
            if (wep.name === 'AUTO RIFLE') {
                if (Math.random() < 0.5) pellets = 2;
                this.bonusCritFromAuto = Math.min(0.5, this.bonusCritFromAuto + 0.005);
            } else if (wep.name === 'SNIPER') {
                critChance += 0.25;
                if (isChargedSniper) {
                    const chargeMult = 1 + Math.min(3, this.sniperChargeTime * 2);
                    baseDmg *= chargeMult;
                    if (!isAmbush) color = '#ef4444';
                    pellets = 1;
                }
            } else if (wep.name === 'SHOTGUN') {
                pellets = (wep.pellets || 1) * 2;
            }
        }

        // NaN guard
        let finalDamage = baseDmg * dmgMult;
        if (!isFinite(finalDamage) || isNaN(finalDamage)) finalDamage = baseDmg;

        let isCrit = Math.random() < critChance;
        if (isCrit) {
            finalDamage *= (this.stats.critMultiplier || 3);
            if (this.passiveUnlocked) this.goldenAuraTimer = 1;
            if (typeof Achievements !== 'undefined' && Achievements.stats) {
                Achievements.stats.crits++;
                Achievements.check('crit_master');
            }
        }

        // Lifesteal
        if (this.passiveUnlocked) {
            const lifestealRate = BALANCE.characters.kao.passiveLifesteal || 0.02;
            const healAmount = finalDamage * lifestealRate;
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            if (Math.random() < 0.3 && typeof spawnFloatingText !== 'undefined') {
                spawnFloatingText(`+${Math.round(healAmount)}`, this.x, this.y - 35, '#10b981', 12);
            }
        }

        const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);

        for (let i = 0; i < pellets; i++) {
            const offset = (pellets > 1) ? (Math.random() - 0.5) * spread : 0;
            const p = new Projectile(this.x, this.y, aimAngle + offset, wep.speed, finalDamage, color, false, 'player');
            p.isCrit = isCrit;
            projectileManager.add(p);
        }

        this.clones.forEach(c => c.shoot(wep, finalDamage, color, pellets, spread));

        if (typeof Audio !== 'undefined' && Audio.playShoot) Audio.playShoot();
        const recoil = (BALANCE.VISUALS && BALANCE.VISUALS.WEAPON_OFFSETS) ? (BALANCE.VISUALS.WEAPON_OFFSETS.recoil || 8) : 8;
        this.x -= Math.cos(aimAngle) * recoil;
        this.y -= Math.sin(aimAngle) * recoil;
        spawnParticles(this.x, this.y, 3, color);
    }
}