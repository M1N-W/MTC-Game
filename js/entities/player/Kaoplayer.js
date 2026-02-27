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

    // draw() ย้ายไป PlayerRenderer._drawKaoClone() แล้ว


    /** Fire projectiles from the clone's position, mirroring the owner's shot. */
    shoot(wep, damage, color, pellets, spread, wepKey, isCrit) {
        const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);
        const barrelOffset = 28;

        for (let i = 0; i < pellets; i++) {
            const spreadAngle = (pellets > 1) ? (Math.random() - 0.5) * spread : 0;
            const finalAngle = aimAngle + spreadAngle;
            const sx = this.x + Math.cos(finalAngle) * barrelOffset;
            const sy = this.y + Math.sin(finalAngle) * barrelOffset;

            let projOptions = {};
            if (wepKey === 'sniper') {
                projOptions.bounces = 2; projOptions.life = 5;
            } else if (wepKey === 'shotgun') {
                projOptions.bounces = 1; projOptions.life = 2.5;
            }

            const p = new Projectile(
                sx, sy, finalAngle,
                wep.speed, damage * 0.5, color,  // Clone deals 50% damage
                isCrit, 'player', projOptions
            );
            p.isCrit = isCrit;
            projectileManager.add(p);
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
        this.teleportCharges = 0;   // max 3 charges
        this.maxTeleportCharges = 3;

        // ── Auto-stealth (Passive: ซุ่มเสรี) ──────────────────────────────────
        this.autoStealthCooldown = 0;   // internal cooldown for free stealth
        this.isFreeStealthy = false;    // FREE STEALTH: กระสุน enemy ทะลุผ่าน แต่ศัตรูยังรู้ตำแหน่ง
        this.freeStealthTimer = 0;
        this.maxFreeStealthDuration = 2.0;

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
            // ✨ [kao_awakened] เช็ค achievement ทุกครั้งที่ weapon master เปลิดล็อค
            if (typeof Achievements !== 'undefined') Achievements.check('kao_awakened');
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

        // ── STRICT GATE: Advanced Skills ──────────────────────────────────
        if (this.passiveUnlocked) {
            // 1. Auto-stealth (Free Stealth)
            const isMoving = keys.w || keys.a || keys.s || keys.d;
            if (isMoving && this.autoStealthCooldown <= 0 && Math.random() < 0.2 * dt) {
                // FREE STEALTH: ล่องหนแบบ "ผี" — ศัตรูรู้ตำแหน่งแต่กระสุนทะลุผ่าน
                // ไม่ยุ่ง isInvisible/energy ของระบบ Stealth หลัก
                this.isFreeStealthy = true;
                this.freeStealthTimer = this.maxFreeStealthDuration;
                this.ambushReady = true;
                this.autoStealthCooldown = S.autoStealthCooldown || 8;
                spawnFloatingText(GAME_TEXTS.combat.kaoFreeStealth, this.x, this.y - 40, '#a855f7', 20);
            }
            if (this.autoStealthCooldown > 0) this.autoStealthCooldown -= dt;
            // Free Stealth countdown
            if (this.freeStealthTimer > 0) {
                this.freeStealthTimer -= dt;
                if (this.freeStealthTimer <= 0) {
                    this.freeStealthTimer = 0;
                    this.isFreeStealthy = false;
                }
            }

            // 2. Teleport (Charge & Q Key)
            if (this.teleportTimer < this.teleportCooldown && this.teleportCharges < this.maxTeleportCharges) {
                this.teleportTimer += dt;
                if (this.teleportTimer >= this.teleportCooldown) {
                    this.teleportCharges++;
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

        // FIX (SNIPER-CHARGE): shoot() is only called while mouse is held.
        // When player releases, we catch the release here (runs every frame).
        if (this.sniperChargeTime > 0 && window.mouse.left === 0) {
            const wepKey = typeof weaponSystem !== 'undefined' ? weaponSystem.currentWeapon : 'auto';
            const wep = BALANCE.characters.kao.weapons?.[wepKey];
            if (wep) {
                this.fireWeapon(wep, true);
                const baseCd = wep.cooldown || 0.25;
                this.shootCooldown = baseCd * (this.cooldownMultiplier || 1);
                if (typeof weaponSystem !== 'undefined') weaponSystem.weaponCooldown = this.shootCooldown;
            }
            this.sniperChargeTime = 0;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DRAW
    // ──────────────────────────────────────────────────────────────────────────
    // draw() ย้ายไป PlayerRenderer._drawKao() แล้ว


    // ──────────────────────────────────────────────────────────────────────────
    // SHOOT — entry point called every frame by the base class tick
    // ──────────────────────────────────────────────────────────────────────────
    shoot(dt) {
        if (typeof weaponSystem === 'undefined') return;
        // 🛡️ THE REAL FIX: currentWeapon is a STRING ('auto', 'sniper', 'shotgun')
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

        // Read wepKey here so ricochet options, audio, and clone shots all share it
        const wepKey = typeof weaponSystem !== 'undefined' ? (weaponSystem.currentWeapon || 'auto') : 'auto';

        // ── 🛡️ Stealth Break & Ambush Logic ──
        // Kao bypasses WeaponSystem.shootSingle() entirely, so this must live here.
        let isAmbush = false;
        if (this.ambushReady) {
            isAmbush = true;
            this.ambushReady = false;
            this.breakStealth();
            spawnParticles(this.x, this.y, 15, '#facc15');
        } else if (this.isInvisible) {
            // Firing while invisible (late frame) still breaks stealth
            this.breakStealth();
        }

        let dmgMult = (this.damageMultiplier || 1.0) * (this.damageBoost || 1.0);
        if (this.isSecondWind) dmgMult *= (BALANCE.player.secondWindDamageMult || 1.5);

        const passiveCrit = this.passiveUnlocked ? (BALANCE.characters.kao.passiveCritBonus || 0) : 0;
        let critChance = (this.baseCritChance || 0) + passiveCrit + (this.bonusCritFromAuto || 0);

        // Ambush: guaranteed crit (let the standard crit block handle the multiplier)
        if (isAmbush) {
            critChance = 2.0;  // FIX (BUG-1): Set >1 to guarantee crit, don't multiply baseDmg here to prevent 9x double-dip
            color = '#facc15';
        }

        // ── Weapon Master buffs ──
        if (this.passiveUnlocked && this.isWeaponMaster) {
            if (!isAmbush) color = '#facc15';
            if (wep.name === 'AUTO RIFLE') {
                // 50% chance to fire 2 bullets instead of 1
                if (Math.random() < 0.5) pellets = 2;
                // Stacking crit bonus (max 50%)
                this.bonusCritFromAuto = Math.min(0.5, this.bonusCritFromAuto + 0.005);
            } else if (wep.name === 'SNIPER') {
                critChance += 0.25;
                if (isChargedSniper) {
                    // NERF: Max charge 2.5× instead of 4× (was too strong)
                    const chargeMult = 1 + Math.min(1.5, this.sniperChargeTime * 2);
                    baseDmg *= chargeMult;
                    if (!isAmbush) color = '#ef4444';
                    pellets = 1;
                }
            } else if (wep.name === 'SHOTGUN') {
                // NERF: 1.5× pellets instead of 2× (4 → 6 instead of 8)
                pellets = Math.floor((wep.pellets || 1) * 1.5);
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
        const barrelOffset = 28;

        for (let i = 0; i < pellets; i++) {
            const spreadAngle = (pellets > 1) ? (Math.random() - 0.5) * spread : 0;
            const finalAngle = aimAngle + spreadAngle;
            // FIX: spawn bullet at barrel tip, not player centre
            const sx = this.x + Math.cos(finalAngle) * barrelOffset;
            const sy = this.y + Math.sin(finalAngle) * barrelOffset;

            // FIX: pass ricochet options matching WeaponSystem.shootSingle()
            let projOptions = {};
            if (wepKey === 'sniper') {
                projOptions.bounces = 2; projOptions.life = 5;
            } else if (wepKey === 'shotgun') {
                projOptions.bounces = 1; projOptions.life = 2.5;
            }

            const p = new Projectile(sx, sy, finalAngle, wep.speed, finalDamage, color, false, 'player', projOptions);
            p.isCrit = isCrit;
            projectileManager.add(p);
        }

        // NERF: Clones deal 60% damage to prevent excessive DPS
        const cloneDamage = finalDamage * 0.6;
        this.clones.forEach(c => c.shoot(wep, cloneDamage, color, pellets, spread, wepKey, isCrit));

        // FIX: pass wepKey so Audio plays the correct weapon sound
        if (typeof Audio !== 'undefined' && Audio.playShoot) Audio.playShoot(wepKey);

        // FIX: velocity-based knockback (was position warp → physics stutter)
        this.vx -= Math.cos(aimAngle) * 50;
        this.vy -= Math.sin(aimAngle) * 50;
        // FIX: trigger animated gun recoil sprite
        if (typeof this.triggerRecoil === 'function') this.triggerRecoil();

        spawnParticles(this.x + Math.cos(aimAngle) * barrelOffset, this.y + Math.sin(aimAngle) * barrelOffset, 3, color);
    }
}
window.KaoPlayer = KaoPlayer;