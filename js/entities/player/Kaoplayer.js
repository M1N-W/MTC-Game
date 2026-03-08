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
            p.weaponKind = wepKey;
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
        this.teleportCharges = 0;           // 0 ก่อน passive unlock, จะเซ็ตเป็น 3 ตอน unlock
        this.maxTeleportCharges = 3;
        this.teleportCooldown = S.teleportCooldown ?? 20;  // BUG-1 fix: was hardcoded 15
        this.teleportPenalty = 5;           // วินาทีบทลงโทษเมื่อหมดทุก stack
        this.teleportTimers = [];           // [{elapsed, max}] แต่ละ slot = 1 stack ที่ถูกใช้ไป
        this._teleportInited = false;       // flag: เซ็ต 3 charge ครั้งแรกที่ passive unlock
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
        this.maxCloneCooldown = S.cloneCooldown ?? 60;  // BUG-2 fix: was || 45 (config = 60)
        this.clonesActiveTimer = 0;

        // FIX (TASK 2): Own shoot cooldown — decoupled from weaponSystem to
        //               prevent the machine-gun NaN glitch.
        this.shootCooldown = 0;

        // ── Audio edge-trigger flag: play stealth sound only on first frame ──
        this._wasFreeStealthy = false;

        // ── Phantom Blink state ──────────────────────────────────────────────
        this._phantomBlinkActive = false;   // Q pressed during stealth
        this._blinkAmbushTimer = 0;        // crit window after blink

        // ── Clone proximity burst tracking ──────────────────────────────────
        this._cloneProxTimers = [];  // [{clone, timer}] detonation countdown

        // ── Dash-stealth (replaces random auto-stealth) ─────────────────────
        this._dashWasActive = false; // edge-detect dash start
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
            // 1. REWORK: Dash-Stealth (replaces random auto-stealth)
            // Every dash → predictable free stealth (ambushReady)
            const dashNow = this.isDashing;  // PlayerBase sets isDashing during dash
            if (dashNow && !this._dashWasActive) {
                // Rising edge of dash
                this.isFreeStealthy = true;
                this.freeStealthTimer = S.dashStealthDuration ?? 1.5;
                this.maxFreeStealthDuration = S.dashStealthDuration ?? 1.5;
                this.ambushReady = true;
                spawnFloatingText(GAME_TEXTS.combat.kaoFreeStealth, this.x, this.y - 40, '#a855f7', 18);
            }
            this._dashWasActive = dashNow;
            // Free Stealth countdown
            if (this.freeStealthTimer > 0) {
                this.freeStealthTimer -= dt;
                if (this.freeStealthTimer <= 0) {
                    this.freeStealthTimer = 0;
                    this.isFreeStealthy = false;
                }
            }

            // ── Audio hook: playStealth on RISING EDGE only ──────────────────
            // Checked AFTER isFreeStealthy is fully updated this frame.
            // Fires once when isFreeStealthy flips false→true; stays silent
            // every subsequent frame while stealth is active.
            if (this.isFreeStealthy && !this._wasFreeStealthy) {
                if (typeof Audio !== 'undefined' && Audio.playStealth) Audio.playStealth();
            }
            this._wasFreeStealthy = this.isFreeStealthy;

            // 2. Teleport (Q Key) — Independent per-charge cooldown timers
            // ── Init: ให้ 3 charge เต็มทันทีที่ passive ถูก unlock ────────
            if (!this._teleportInited) {
                this.teleportCharges = this.maxTeleportCharges;
                this._teleportInited = true;
            }
            // ── Tick each timer independently ────────────────────────────
            for (let i = this.teleportTimers.length - 1; i >= 0; i--) {
                this.teleportTimers[i].elapsed += dt;
                if (this.teleportTimers[i].elapsed >= this.teleportTimers[i].max) {
                    this.teleportTimers.splice(i, 1);
                    this.teleportCharges = Math.min(this.maxTeleportCharges, this.teleportCharges + 1);
                    spawnFloatingText(GAME_TEXTS.combat.kaoTeleport, this.x, this.y - 60, '#00e5ff', 20);
                }
            }
            // ── Use charge ───────────────────────────────────────────────
            if (checkInput('q') && this.teleportCharges > 0) {
                this.teleportCharges--;
                const newTimer = { elapsed: 0, max: this.teleportCooldown };
                this.teleportTimers.push(newTimer);

                // Penalty: หมดทุก stack → เพิ่ม +5s ให้ timer ที่ใกล้ครบสุด
                if (this.teleportCharges === 0 && this.teleportTimers.length > 1) {
                    let maxElapsed = -1, penaltyIdx = 0;
                    this.teleportTimers.forEach((t, i) => {
                        if (t.elapsed > maxElapsed) { maxElapsed = t.elapsed; penaltyIdx = i; }
                    });
                    this.teleportTimers[penaltyIdx].max += this.teleportPenalty;
                    spawnFloatingText('\u23F3 Penalty!', this.x, this.y - 80, '#ef4444', 20);
                }

                // ── PHANTOM BLINK: Q during stealth/freeStealthy ─────────
                // Leave a shadow clone at origin, blink to cursor
                // Grant ambush crit window at destination
                const isPhantomBlink = (S.phantomBlinkEnabled ?? true)
                    && (this.isInvisible || this.isFreeStealthy);

                const prevX = this.x, prevY = this.y;
                spawnParticles(this.x, this.y, 25, '#3b82f6');
                // VFX: shadow ripple at departure
                if (typeof addScreenShake === 'function') addScreenShake(2);

                this.x = window.mouse.wx;
                this.y = window.mouse.wy;
                consumeInput('q');
                spawnParticles(this.x, this.y, 25, '#3b82f6');

                if (isPhantomBlink) {
                    // ── Leave shadow clone at departure point ──────────
                    const shadowClone = new KaoClone(this, 0);
                    shadowClone.x = prevX;
                    shadowClone.y = prevY;
                    shadowClone.alpha = 0.85;       // more visible than orbit clones
                    this.clones.push(shadowClone);
                    this.clonesActiveTimer = Math.max(
                        this.clonesActiveTimer,
                        S.cloneDuration ?? 8
                    );
                    // ── Ambush window at destination ───────────────────
                    this._blinkAmbushTimer = S.phantomBlinkAmbushWindow ?? 1.5;
                    this.ambushReady = true;
                    // Break stealth after blink (ambush strike)
                    this.isFreeStealthy = false;
                    this.freeStealthTimer = 0;
                    if (this.isInvisible) this.breakStealth();
                    spawnFloatingText('\uD83D\uDC7B PHANTOM BLINK!', this.x, this.y - 65, '#93c5fd', 24);
                    if (typeof addScreenShake === 'function') addScreenShake(4);
                }
            }

            // ── Tick blink ambush window ──────────────────────────────
            if (this._blinkAmbushTimer > 0) this._blinkAmbushTimer -= dt;

            // 3. Clone of Stealth (Cooldown & E Key)
            if (this.cloneSkillCooldown > 0) this.cloneSkillCooldown -= dt;
            if (checkInput('e')) {
                // ── REWORK: E during active clones = manual Phantom Shatter ──
                if (this.clones.length > 0 && this.clonesActiveTimer > 0) {
                    // Manual early detonate
                    this.clonesActiveTimer = 0; // force expiry block below
                    consumeInput('e');
                } else if (this.cloneSkillCooldown <= 0) {
                    // ── Spawn 2 orbit clones ──
                    this.clones = [
                        new KaoClone(this, (2 * Math.PI) / 3),
                        new KaoClone(this, (4 * Math.PI) / 3)
                    ];
                    this.clonesActiveTimer = S.cloneDuration ?? 8;
                    this.cloneSkillCooldown = this.maxCloneCooldown;
                    spawnFloatingText(GAME_TEXTS.combat.kaoClones, this.x, this.y - 40, '#3b82f6', 25);
                    if (typeof Audio !== 'undefined' && Audio.playClone) Audio.playClone();
                    consumeInput('e');
                }
            }
        } else {
            // Force reset keys and buffer if user tries to press before unlocking
            consumeInput('q');
            consumeInput('e');
        }

        // ── Unrestricted Update Logic — existing clones keep moving ───────────
        if (this.clonesActiveTimer > 0) {
            this.clonesActiveTimer -= dt;
            const aimAngle = Math.atan2(window.mouse.wy - this.y, window.mouse.wx - this.x);
            if (this.clones[0]) this.clones[0].angleOffset = aimAngle + Math.PI / 1.5;
            if (this.clones[1]) this.clones[1].angleOffset = aimAngle - Math.PI / 1.5;
            this.clones.forEach(c => c.update(dt));

            // ── Clone Proximity Burst (auto-detonate when enemy too close) ──
            const proxRange = S.cloneProximityRange ?? 90;
            const proxDmgMult = S.cloneProximityDmgMult ?? 0.60;
            const shatterDmgProx = (BALANCE.characters.kao.weapons.shotgun.damage * proxDmgMult)
                * (this.damageMultiplier || 1.0);
            for (let ci = this.clones.length - 1; ci >= 0; ci--) {
                const clone = this.clones[ci];
                let triggered = false;
                for (const e of (window.enemies || [])) {
                    if (e.dead) continue;
                    if (Math.hypot(e.x - clone.x, e.y - clone.y) < proxRange) {
                        triggered = true; break;
                    }
                }
                if (!triggered && window.boss && !window.boss.dead
                    && Math.hypot(window.boss.x - clone.x, window.boss.y - clone.y) < proxRange + 20) {
                    triggered = true;
                }
                if (triggered) {
                    // ── Mini-Phantom Shatter (single clone) ───────────────
                    const NUM_RAYS = 8;
                    spawnParticles(clone.x, clone.y, 14, '#60a5fa');
                    for (let ri = 0; ri < NUM_RAYS; ri++) {
                        const angle = (Math.PI * 2 / NUM_RAYS) * ri;
                        const p = new Projectile(
                            clone.x, clone.y, angle, 760, shatterDmgProx,
                            '#93c5fd', false, 'player', { life: 0.7, bounces: 0 }
                        );
                        projectileManager.add(p);
                    }
                    // Swap-and-pop O(1)
                    this.clones[ci] = this.clones[this.clones.length - 1];
                    this.clones.pop();
                    spawnFloatingText('\uD83D\uDCA5 PROXIMITY!', clone.x, clone.y - 35, '#93c5fd', 15);
                    if (typeof Audio !== 'undefined' && Audio.playPhantomShatter) Audio.playPhantomShatter();
                }
            }
            if (this.clonesActiveTimer <= 0) {
                // ── PHANTOM SHATTER: โคลนหมดเวลา → ระเบิด 8 ทิศ ──────────
                // กระสุน 8 ทิศ ดาเมจเบา (20% ของ shotgun pellet) แต่ AoE ดี
                // ออกแบบให้ reward การวางตำแหน่งโคลนใกล้ศัตรู
                if (this.clones.length > 0) {
                    const shatterDmg = (BALANCE.characters.kao.weapons.shotgun.damage * 0.35)
                        * (this.damageMultiplier || 1.0);
                    const NUM_RAYS = 8;
                    for (const clone of this.clones) {
                        spawnParticles(clone.x, clone.y, 20, '#3b82f6');
                        for (let i = 0; i < NUM_RAYS; i++) {
                            const angle = (Math.PI * 2 / NUM_RAYS) * i;
                            const p = new Projectile(
                                clone.x, clone.y,
                                angle,
                                780,        // ความเร็วกระสุน
                                shatterDmg,
                                '#93c5fd',  // สีฟ้าอ่อน — สีของโคลน
                                false, 'player',
                                { life: 0.8, bounces: 0 }
                            );
                            projectileManager.add(p);
                        }
                    }
                    addScreenShake(3);
                    spawnFloatingText('💠 PHANTOM SHATTER!', this.x, this.y - 50, '#93c5fd', 18);
                    if (typeof Audio !== 'undefined' && Audio.playPhantomShatter) Audio.playPhantomShatter();
                }
                this.clones = [];
            }
        }

        super.update(dt, keys, mouse);

        // ── Tick graphBuffTimer ────────────────────────────────
        if ((this.graphBuffTimer ?? 0) > 0) this.graphBuffTimer = Math.max(0, this.graphBuffTimer - dt);

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
        // ── Graph Buff: ยืนบนเลเซอร์ระยะ 3 → ดาเมจ x1.5 ─────
        if ((this.graphBuffTimer ?? 0) > 0) dmgMult *= 1.5;

        const S_fw = BALANCE.characters.kao;
        const passiveCrit = this.passiveUnlocked ? (this.stats.passiveCritBonus ?? 0) : 0;  // INC-1 fix: was BALANCE.characters.kao.passiveCritBonus
        // stealthChainBonus: +crit when blink ambush window is active (phantom sequence)
        const chainBonus = (this._blinkAmbushTimer > 0) ? (S_fw.stealthChainBonus ?? 0.25) : 0;
        let critChance = (this.baseCritChance || 0) + passiveCrit + (this.bonusCritFromAuto || 0) + chainBonus;

        // Ambush: guaranteed crit
        if (isAmbush) {
            critChance = 2.0;  // >1 guarantees crit without double-dip
            color = '#facc15';
            // ── Phantom Blink ambush multiplier ────────────────────────────
            if (this._blinkAmbushTimer > 0) {
                dmgMult *= (S.phantomBlinkDmgMult ?? 2.5);
                this._blinkAmbushTimer = 0;  // consume window
                if (typeof spawnFloatingText !== 'undefined')
                    spawnFloatingText('\uD83D\uDC7B BLINK STRIKE!', this.x, this.y - 60, '#c4b5fd', 22);
            }
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
            const lifestealRate = this.stats.passiveLifesteal ?? 0.03;  // INC-1 fix: was BALANCE.characters.kao.passiveLifesteal
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
            p.weaponKind = wepKey;
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

        // 🔫 Battle Scars: ดีดปลอกกระสุน (Kao bypass shootSingle → ต้องเรียกที่นี่โดยตรง)
        if (typeof shellCasingSystem !== 'undefined') {
            const shellCount = wepKey === 'shotgun' ? 3 : 1;
            const shellSpeed = wepKey === 'sniper' ? 160 : 120;
            for (let _s = 0; _s < shellCount; _s++) {
                shellCasingSystem.spawn(this.x, this.y, aimAngle, shellSpeed);
            }
        }

        spawnParticles(this.x + Math.cos(aimAngle) * barrelOffset, this.y + Math.sin(aimAngle) * barrelOffset, 3, color);
    }

    takeDamage(amt) {
        // ── Graph Risk: ยืนบนเลเซอร์ → รับดาเมจ x1.5 ─────────
        if (this.onGraph) {
            amt *= 1.5;
            spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16);
        }
        super.takeDamage(amt);
    }
}
window.KaoPlayer = KaoPlayer;