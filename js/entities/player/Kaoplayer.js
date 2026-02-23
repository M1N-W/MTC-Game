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
        this.radius = owner.radius;
        this.x = owner.x;
        this.y = owner.y;
        this.color = '#3b82f6';
        this.alpha = 0.5;
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
        // Clones are faint when stealth is active
        CTX.globalAlpha = this.owner.isStealth ? 0.15 : this.alpha;
        CTX.fillStyle = this.owner.isWeaponMaster ? '#facc15' : this.color;
        CTX.beginPath();
        CTX.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        CTX.fill();

        // Barrel indicator
        CTX.strokeStyle = '#94a3b8';
        CTX.lineWidth = 6;
        CTX.beginPath();
        CTX.moveTo(this.x, this.y);
        const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);
        CTX.lineTo(
            this.x + Math.cos(aimAngle) * 25,
            this.y + Math.sin(aimAngle) * 25
        );
        CTX.stroke();
        CTX.globalAlpha = 1.0;
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
    constructor(x, y) {
        super('kao'); // FIX 1: Correct super signature
        this.x = x;
        this.y = y;
        const S = BALANCE.characters.kao;

        // ── Teleport ───────────────────────────────────────────────────────────
        this.teleportTimer = 0;
        this.teleportCooldown = S.teleportCooldown || 20;
        this.teleportCharges = 0;          // max 1 charge at a time

        // ── Auto-stealth (Passive: ซุ่มเสรี) ──────────────────────────────────
        this.autoStealthCooldown = 0;       // internal cooldown for free stealth

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
    }

    // ──────────────────────────────────────────────────────────────────────────
    // KILL TRACKING — called from enemy.js after each enemy death
    // ──────────────────────────────────────────────────────────────────────────
    addKill(weaponName) {
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
    // FIX 2: Added keys and mouse to parameters
    update(dt, keys, mouse) {
        const S = BALANCE.characters.kao;

        // ── Passive Skill: ซุ่มเสรี ──────────────────────────────────────────
        if (this.passiveActive) {
            // Large speed bonus while passive is active
            this.speedMultiplier *= 1.4;

            // Randomly trigger free Stealth while moving
            const isMoving = keys.w || keys.a || keys.s || keys.d;
            if (
                isMoving &&
                this.autoStealthCooldown <= 0 &&
                Math.random() < 0.2 * dt
            ) {
                this.isStealth = true;
                this.stealthEnergy = 100;
                this.autoStealthCooldown = S.autoStealthCooldown || 8;
                spawnFloatingText(
                    GAME_TEXTS.combat.kaoFreeStealth,
                    this.x, this.y - 40,
                    '#a855f7', 20
                );
            }
            if (this.autoStealthCooldown > 0) this.autoStealthCooldown -= dt;
        }

        // ── Teleport — charge regeneration ────────────────────────────────────
        if (this.teleportTimer < this.teleportCooldown && this.teleportCharges < 1) {
            this.teleportTimer += dt;
            if (this.teleportTimer >= this.teleportCooldown) {
                this.teleportCharges = 1;
                this.teleportTimer = 0;
                spawnFloatingText(
                    GAME_TEXTS.combat.kaoTeleport,
                    this.x, this.y - 60,
                    '#00e5ff', 20
                );
            }
        }

        // ── Teleport — activation (Q key) ─────────────────────────────────────
        if (keys.q && this.teleportCharges > 0) {
            this.teleportCharges--;
            spawnParticles(this.x, this.y, 25, '#3b82f6');
            this.x = window.mouse.wx;
            this.y = window.mouse.wy;
            spawnParticles(this.x, this.y, 25, '#00e5ff');
            keys.q = 0;   // consume key press
        }

        // ── Clone of Stealth — cooldown tick ──────────────────────────────────
        if (this.cloneSkillCooldown > 0) this.cloneSkillCooldown -= dt;

        // ── Clone of Stealth — activation (E key) ─────────────────────────────
        if (keys.e && this.cloneSkillCooldown <= 0) {
            // Spawn two clones in a triangle formation around Kao
            this.clones = [
                new KaoClone(this, 0),
                new KaoClone(this, 0)
            ];
            this.clonesActiveTimer = S.cloneDuration || 15;
            this.cloneSkillCooldown = this.maxCloneCooldown;
            spawnFloatingText(
                GAME_TEXTS.combat.kaoClones,
                this.x, this.y - 40,
                '#3b82f6', 25
            );
            keys.e = 0;
        }

        // ── Clone update — orbit facing aim direction ──────────────────────────
        if (this.clonesActiveTimer > 0) {
            this.clonesActiveTimer -= dt;
            const aimAngle = Math.atan2(
                window.mouse.wy - this.y,
                window.mouse.wx - this.x
            );
            // Position clones ±120° from aim direction (triangle formation)
            if (this.clones[0]) this.clones[0].angleOffset = aimAngle + Math.PI / 1.5;
            if (this.clones[1]) this.clones[1].angleOffset = aimAngle - Math.PI / 1.5;
            this.clones.forEach(c => c.update(dt));
            if (this.clonesActiveTimer <= 0) this.clones = [];
        }

        // FIX 2: Pass keys and mouse back to parent
        super.update(dt, keys, mouse);
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
            CTX.save();
            CTX.globalAlpha = 0.3 + Math.sin(now / 150) * 0.2;
            CTX.fillStyle = '#facc15';
            CTX.beginPath();
            CTX.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
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
        const wepIndex = weaponSystem.currentWeaponIndex || 0;
        const weps = Object.values(BALANCE.characters.kao.weapons);
        const wep = weps[wepIndex];
        const isClick = window.mouse.left === 1;

        // Check weapon cooldown to sync with UI
        if (weaponSystem.cooldowns[wepIndex] > 0 && this.sniperChargeTime <= 0) return;

        // ── Weapon Master Sniper: hold-to-charge mode ──────────────────────────
        if (this.isWeaponMaster && wep.name === 'SNIPER') {
            if (isClick) {
                // Accumulate charge time; emit charge particles
                this.sniperChargeTime += dt;
                if (Math.random() < 0.3) spawnParticles(this.x, this.y, 1, '#ef4444');
                return;   // don't fire yet
            } else if (this.sniperChargeTime > 0) {
                // Mouse released — fire the charged shot
                this.fireWeapon(wep, true);
                weaponSystem.cooldowns[wepIndex] = wep.cooldown * this.cooldownMultiplier;
                this.sniperChargeTime = 0;
                return;
            }
        } else {
            // Reset charge if weapon switched away
            this.sniperChargeTime = 0;
        }

        // ── Normal fire ────────────────────────────────────────────────────────
        if (isClick && weaponSystem.cooldowns[wepIndex] <= 0) {
            this.fireWeapon(wep, false);
            weaponSystem.cooldowns[wepIndex] = wep.cooldown * this.cooldownMultiplier;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FIRE WEAPON — handles all Weapon Master buffs, crits, and clone mirrors
    // ──────────────────────────────────────────────────────────────────────────
    fireWeapon(wep, isChargedSniper) {
        let pellets = wep.pellets;
        let spread = wep.spread;
        let baseDmg = wep.damage;
        let color = wep.color;

        // Global damage multipliers
        let dmgMult = this.damageMultiplier || 1.0;
        if (this.isSecondWind) dmgMult *= BALANCE.player.secondWindDamageMult;

        // Base crit chance + passive bonus + stacking auto bonus
        let critChance = this.baseCritChance +
            (this.bonusCritChanceFromPassive || 0) +
            this.bonusCritFromAuto;

        // ── Weapon Master buffs ────────────────────────────────────────────────
        if (this.isWeaponMaster) {
            color = '#facc15';   // golden projectiles

            if (wep.name === 'AUTO RIFLE') {
                // 50% chance to fire 2 pellets at once
                if (Math.random() < 0.5) pellets = 2;
                // Incrementally stack crit chance (cap 50%)
                this.bonusCritFromAuto = Math.min(0.5, this.bonusCritFromAuto + 0.005);

            } else if (wep.name === 'SNIPER') {
                critChance += 0.25;  // flat +25% crit
                if (isChargedSniper) {
                    // Damage scales with hold duration (capped at 4×)
                    const chargeMult = 1 + Math.min(3, this.sniperChargeTime * 2);
                    baseDmg *= chargeMult;
                    color = '#ef4444';
                    pellets = 1;
                }

            } else if (wep.name === 'SHOTGUN') {
                pellets = wep.pellets * 2;  // double pellet count
            }
        }

        // Crit roll
        let finalDamage = baseDmg * dmgMult;
        let isCrit = Math.random() < critChance;
        if (isCrit) finalDamage *= this.critMultiplier;

        const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);

        // ── Fire from player ───────────────────────────────────────────────────
        for (let i = 0; i < pellets; i++) {
            const offset = (pellets > 1) ? (Math.random() - 0.5) * spread : 0;
            const p = new Projectile(
                this.x, this.y,
                aimAngle + offset,
                wep.speed, finalDamage, color,
                false, 'player'
            );
            p.isCrit = isCrit;
            projectileManager.add(p);
        }

        // ── Mirror shot from each active clone ────────────────────────────────
        this.clones.forEach(c => c.shoot(wep, finalDamage, color, pellets, spread));

        // ── SFX + visual recoil ────────────────────────────────────────────────
        if (typeof Audio !== 'undefined' && Audio.playShoot) Audio.playShoot();
        const recoil = (BALANCE.VISUALS && BALANCE.VISUALS.WEAPON_OFFSETS)
            ? (BALANCE.VISUALS.WEAPON_OFFSETS.recoil || 8)
            : 8;
        this.x -= Math.cos(aimAngle) * recoil;
        this.y -= Math.sin(aimAngle) * recoil;
        spawnParticles(this.x, this.y, 3, color);
    }
}