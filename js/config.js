'use strict';
/**
 * ⚙️ MTC: ENHANCED EDITION - Configuration
 * Single source of truth for ALL game constants and balance values.
 */

const API_KEY = (typeof CONFIG_SECRETS !== 'undefined' && CONFIG_SECRETS.GEMINI_API_KEY)
    ? CONFIG_SECRETS.GEMINI_API_KEY
    : '';

const BALANCE = {
    physics: {
        friction: 0.88,
        acceleration: 1800
    },
    player: {
        obstacleWarningRange: 35,
        obstacleBuffPower: 1.25,
        obstacleBuffDuration: 1.0,
        obstacleWarningCooldown: 3000,
        secondWindHpPct: 0.20,
        secondWindSpeedMult: 1.3,
        secondWindDamageMult: 1.5,
        auto: {
            hp: 150,
            speed: 160,
            energyRegen: 20,
            heatWaveRange: 180,
            wanchaiDuration: 4.0,
            wanchaiCooldown: 12
        }
    },
    characters: {
        kao: {
            name: 'Kao',
            radius: 20,
            hp: 119, maxHp: 119,
            energy: 100, maxEnergy: 100,
            energyRegen: 15,
            moveSpeed: 298,
            dashSpeed: 550,
            dashDistance: 180,
            weapons: {
                auto: {
                    name: 'AUTO RIFLE',
                    damage: 22, cooldown: 0.2,
                    range: 900, speed: 900,
                    spread: 0, pellets: 1,
                    color: '#3b82f6', icon: '🔵'
                },
                sniper: {
                    name: 'SNIPER',
                    damage: 95, cooldown: 0.85,
                    range: 1200, speed: 1200,
                    spread: 0, pellets: 1,
                    color: '#ef4444', icon: '🔴'
                },
                shotgun: {
                    name: 'SHOTGUN',
                    damage: 30, cooldown: 0.50,   // NERF: 36→30 dmg, 0.55→0.50 cd (DPS 173→162, closes gap vs Auto/Sniper)
                    range: 400, speed: 700,
                    spread: 0.45, pellets: 3,     // NERF: spread 0.5→0.45 (slight accuracy buff to compensate feel)
                    color: '#f59e0b', icon: '🟠'
                }
            },
            baseCritChance: 0.05,
            critMultiplier: 2.5,
            dashCooldown: 1.65,
            stealthCooldown: 5.5,
            stealthCost: 25,
            stealthDrain: 35,
            stealthSpeedBonus: 1.5,
            expToNextLevel: 100,
            expLevelMult: 1.5,
            passiveUnlockLevel: 1,          // fallback เท่านั้น — KaoPlayer.checkPassiveUnlock() override
            passiveUnlockStealthCount: 1,   // fallback: ปลดตั้งแต่ stealth ครั้งแรก
            passiveHpBonusPct: 0.5,
            passiveUnlockText: '👻 ซุ่มเสรี AWAKENED!',
            passiveCritBonus: 0.05,
            passiveLifesteal: 0.03,
            speedOnHit: 20,
            speedOnHitDuration: 0.4,
            damageMultiplierPerLevel: 0.12,  // BUFF: 0.08 → 0.12 (level-up felt unrewarding)
            cooldownReductionPerLevel: 0.04,  // BUFF: 0.03 → 0.04
            maxHpPerLevel: 6,                 // BUFF: 4 → 6
            // ── Advanced Kao Skills ──
            teleportCooldown: 18,
            cloneCooldown: 25,              // 60 → 25 (REWORK: usable mid-game)
            cloneDuration: 8,               // 10 → 8 (shorter but sharper)
            cloneProximityRange: 90,        // NEW: clone proximity burst trigger range
            cloneProximityDmgMult: 0.60,    // NEW: proximity burst dmg mult
            dashStealthDuration: 1.5,       // NEW: free stealth after every dash
            phantomBlinkEnabled: true,      // NEW: Q during stealth = Phantom Blink
            phantomBlinkAmbushWindow: 1.5,  // NEW: crit-window after blink
            phantomBlinkDmgMult: 2.5,       // NEW: ambush damage mult
            stealthChainBonus: 0.25,        // NEW: +crit when Q chains from stealth
            weaponMasterReq: 5              // ลดจาก 7 → 5 (passive เร็วขึ้น → Weapon Master ก็ควรทำได้เร็วขึ้น)
        },
        auto: {
            // ══════════════════════════════════════════════════
            // 🔥 AUTO — THERMODYNAMIC BRAWLER REWORK v2
            // Identity: อุ่นเครื่องยิ่งชกนาน ยิ่งเก่ง
            // Loop: สะสม Heat → Wanchai → Combo → Detonate → รีเซ็ตได้ง่าย
            // ══════════════════════════════════════════════════
            name: 'Auto',
            radius: 20,

            // ── Base Stats (Tank Brawler) ──────────────────────
            hp: 230, maxHp: 230,           // +10 เพิ่ม tank identity
            energy: 100, maxEnergy: 100,
            energyRegen: 20,
            moveSpeed: 260,                 // 250 → 260 (ยังช้ากว่าคนอื่น)
            dashSpeed: 490,
            dashDistance: 170,              // 160 → 170
            dashCooldown: 1.7,              // 1.8 → 1.7

            // ── Heat Wave (L-Click ปกติ / โหมดยิง) ─────────────
            heatWaveRange: 180,
            heatWaveCooldown: 0.22,

            // ── Wanchai Stand (R-Click) ───────────────────────
            wanchaiDuration: 8.0,           // 6.0 → 8.0 (longer payoff window)
            wanchaiCooldown: 12,            // 9 → 12 (trade longer for less spammy)
            wanchaiEnergyCost: 25,          // 32 → 25 (easier loop)
            wanchaiPunchRate: 0.09,          // 0.11 → 0.09 (11.1 punches/s — BUFF)
            wanchaiDamage: 38,              // 32 → 38 (BUFF)
            standSpeedMod: 1.5,
            standDamageReduction: 0.40,     // 0.35 → 0.40 (BUFF: tank identity stronger)
            standCritBonus: 0.25,
            standMoveSpeed: 340,
            standPunchRange: 110,
            standLeashRadius: 420,
            standKnockback: 240,            // 180 → 240 (BUFF)

            // ── Attack Mode Toggle ────────────────────────────
            // ระหว่าง Wanchai active: กด F (หรือ Middle-Click) สลับโหมด
            // MODE 0 = RANGE: ยิง Heat Wave ปกติ (ไม่จำกัดระยะ)
            // MODE 1 = MELEE: รัวหมัด Stand Rush (ระยะใกล้)
            // ทั้งสองโหมดใช้ cooldowns.shoot เดียวกัน
            playerMeleeCooldown: 0.12,      // 0.15 → 0.12 (MELEE mode punch rate)
            playerMeleeRange: 200,          // 85 → 200 (REWORK: เพิ่มระยะ melee ให้ใช้งานได้จริง)
            playerMeleeRangeFar: 320,       // range เมื่อ Heat >= 67% (HOT tier)

            // ── Vacuum Heat (Q) — REWORK: Pull + Ignite ──────
            vacuumRange: 340,               // 320 → 340
            vacuumForce: 1900,              // 1600 → 1900 (BUFF)
            vacuumCooldown: 6,              // 8 → 6 (bread-and-butter skill)
            vacuumStunDur: 0.50,            // 0.55 → 0.50
            vacuumPullDur: 0.45,
            vacuumDamage: 18,               // NEW: damage ณ จุดดูด
            vacuumIgniteDuration: 1.5,      // NEW: Ignite debuff duration
            vacuumIgniteDPS: 12,            // NEW: burn DPS ขณะ Ignite
            vacuumHeatGain: 25,             // NEW: +Heat ทุกครั้งที่ใช้สำเร็จ

            // ── Overheat Detonation (E) — REWORK: Heat-scaled, ไม่ kill Wanchai ──
            detonationRange: 240,           // 220 → 240
            detonationCooldown: 8,          // 5 → 8 (ไม่ kill Wanchai แล้ว — trade off)
            detonationBaseDamage: 80,       // NEW: base damage (แทน wanchaiDamage×6)
            detonationHeatScaling: 2.5,     // NEW: bonus damage per Heat point
            // ตัวอย่าง: Heat 80 → 80 + (80 × 2.5) = 280 damage
            // Overheated (Heat 100) → radius ×1.5 = 360px
            // หลัง Detonate: Heat -50 (ไม่เป็น 0, ยังคง momentum)

            // ── Heat Gauge (NEW SYSTEM) ───────────────────────
            // สะสมจากการชก → ให้ bonus tier ตาม heat level
            heatMax: 100,
            heatPerHit: 12,                 // +Heat ต่อ Stand punch
            heatPerPlayerHit: 8,            // +Heat ต่อ Stand Rush / Heat Wave
            heatPerDamageTaken: 0.5,        // +Heat ต่อ 1 damage ที่รับ
            heatDecayRate: 8,               // -Heat/s ตอน out of Wanchai
            heatDecayRateActive: 0,         // ไม่ decay ระหว่าง Wanchai
            // ── Heat Tier Thresholds ──
            // WARM (34%+): dmg ×1.15, punch rate ×0.85
            // HOT  (67%+): dmg ×1.30, punch rate ×0.70, melee range เพิ่ม
            // OVERHEATED (100%): dmg ×1.50, crit +20%, hp drain 3/s, det radius ×1.5
            heatTierWarm: 34,
            heatTierHot: 67,
            heatTierOverheat: 100,
            heatDmgWarm: 1.15,
            heatDmgHot: 1.30,
            heatDmgOverheat: 1.50,
            heatPunchRateWarm: 0.85,        // multiplier ต่อ wanchaiPunchRate
            heatPunchRateHot: 0.70,
            heatCritBonusOverheat: 0.20,
            heatHpDrainOverheat: 3,         // HP/s drain เมื่อ Overheated
            heatOnKillWanchai: 15,          // +Heat ต่อการฆ่าขณะ Wanchai active
            heatHealOnKillWanchai: 0.08,    // heal 8% maxHp ต่อการฆ่าขณะ Wanchai active

            // ── Crit & Scaling ────────────────────────────────
            baseCritChance: 0.06,
            critMultiplier: 2.2,            // 2.0 → 2.2

            // ── Stealth (disabled for Auto) ───────────────────
            stealthCooldown: 12,
            stealthCost: 9999,
            stealthDrain: 0,
            stealthSpeedBonus: 1.0,

            // ── Level Scaling ─────────────────────────────────
            expToNextLevel: 100,
            expLevelMult: 1.5,
            damageMultiplierPerLevel: 0.12, // 0.10 → 0.12 (เท่า Kao)
            cooldownReductionPerLevel: 0.04,
            maxHpPerLevel: 16,              // 14 → 16

            // ── Passive: SCORCHED SOUL ────────────────────────
            // Unlock: ถึง OVERHEAT ครั้งแรก (เปลี่ยนจาก Lv5 เพื่อ thematic)
            passiveUnlockLevel: 5,          // fallback เท่านั้น — ไม่ได้ใช้จริงแล้ว
            passiveUnlockStealthCount: 0,   // ไม่ใช้ stealth — unlock via OVERHEAT
            passiveHpBonusPct: 0.35,
            passiveUnlockText: '💥 วันชัยโอเวอร์ไดรฟ์!',
            passiveCritBonus: 0.06,         // 0.04 → 0.06
            passiveLifesteal: 0.025,        // 0.01 → 0.025 (brawler identity)
            passiveHeatGainBonus: 1.25,     // Heat สะสมเร็ว +25% หลัง unlock

            // ── RAGE MODE: OVERHEAT + HP < 30% → damage buff + damage reduction ──
            // High-risk-high-reward — ยิ่งใกล้ตายยิ่งอันตราย
            rageModeHpThreshold: 0.30,      // HP % ที่ trigger Rage Mode
            rageDamageMult: 1.30,           // ดาเมจ ×1.3 ขณะ Rage
            rageDamageReduction: 0.20,      // รับดาเมจน้อยลง 20% ขณะ Rage

            // ── Speed on Hit ──────────────────────────────────
            speedOnHit: 15,
            speedOnHitDuration: 0.35,
        },
        poom: {
            name: 'Poom',
            radius: 20,
            hp: 165, maxHp: 165,
            energy: 100, maxEnergy: 100,
            energyRegen: 12,
            moveSpeed: 298,
            dashSpeed: 520,
            dashDistance: 170,
            dashCooldown: 1.65,
            expToNextLevel: 100,
            expLevelMult: 1.5,
            riceDamage: 62,
            riceCooldown: 0.42,
            riceSpeed: 600,
            riceRange: 750,
            riceColor: '#ffffff',
            critChance: 0.12,
            critMultiplier: 3,
            eatRiceCooldown: 10,
            eatRiceDuration: 6,
            eatRiceSpeedMult: 1.3,
            eatRiceCritBonus: 0.2,
            nagaCooldown: 20,        // BALANCE: uptime 50% (10s active / 20s CD)
            nagaDuration: 10,        // RESTORE: 7→10s (ผู้เล่นต้องการ spawn นานขึ้น)
            nagaDamage: 100,         // BUFF: 95 → 100
            nagaSpeed: 525,
            nagaSegments: 18,        // BUFF: 12 → 18 (งูยาวขึ้นชัดเจน)
            nagaSegmentDistance: 32, // BUFF: 28 → 32 (ระยะห่าง segment มากขึ้น → ตัวยาวขึ้น)
            nagaRadius: 22,          // BUFF: 20 → 22 (ตัวหนาขึ้นเล็กน้อย)
            speedOnHit: 18,
            speedOnHitDuration: 0.35,
            damageMultiplierPerLevel: 0.11,  // BUFF: 0.07 → 0.11
            cooldownReductionPerLevel: 0.05,  // BUFF: 0.04 → 0.05
            maxHpPerLevel: 10,                // BUFF: 7 → 10
            // ── Passive Skill (Ritual Mastery) ────────────────
            // Unlock: ทำ Ritual Burst ครั้งแรก (เปลี่ยนจาก Lv4 เพื่อ thematic)
            passiveUnlockLevel: 4,          // fallback เท่านั้น — ไม่ได้ใช้จริงแล้ว
            passiveUnlockStealthCount: 0,   // ไม่ใช้ stealth — unlock via Ritual
            passiveHpBonusPct: 0.30,
            passiveUnlockText: '🌾 ราชาอีสาน!',
            passiveCritBonus: 0.04,           // bonus crit หลัง passive unlock
            passiveLifesteal: 0.015,          // lifesteal ต่อ damage ที่ทำได้
            // ── Cosmic Balance bonus ─────────────────────────────
            cosmicDamageMult: 1.35,           // เพิ่มจาก 1.20 → 1.35 (reward ชัดขึ้น)
            cosmicHpRegen: 4,                 // NEW: HP regen 4/s ขณะ Cosmic Balance active
            // ── Sticky Rice Stack System ──
            sticky: {
                maxStacks: 5,
                stackDuration: 1.5,     // Phase 4: 1.0 → 1.5 (allows ~3 stacks, gives decision window)
                slowPerStack: 0.04,
                maxSlowDuration: 1.5
            },
            // ── Fragment System (Eat Rice Enhancement) ──
            fragment: {
                count: 2,
                damagePct: 0.5,
                bounces: 1,
                bossReflectionMultiplier: 1.35
            },
            // ── Garuda Summon (E) ────────────────────────────
            garudaCooldown: 25,
            garudaDuration: 6,
            garudaDamage: 150,
            garudaOrbitRadius: 120,
            garudaOrbitSpeed: 2.2,
            garudaDiveCooldown: 1.8,
            garudaDiveSpeed: 820,
            garudaReturnSpeed: 620,
            garudaEatRiceBonus: 1.5,
            // ── Cosmic Balance (Naga + Garuda active simultaneously) ──
            // cosmicDamageMult ย้ายขึ้นไปอยู่ใน Passive Skill section แล้ว
            cosmicNagaBurnDPS: 22,
            cosmicGarudaRadiusMult: 1.5,
        },
    },
    drone: {
        radius: 12,
        damage: 15,
        range: 300,
        fireRate: 1.0,
        projectileSpeed: 700,
        projectileColor: '#00e5ff',
        speed: 250,
        orbitRadius: 75,
        orbitSpeed: 1.1,
        lerpBase: 0.02,
        bobAmplitude: 8,
        bobSpeed: 3.5,
        // ── Overdrive Stats ──
        overdriveCombo: 15,
        overdriveFireRate: 1.5,
        overdriveColor: '#facc15',
        overdriveGlow: '#f59e0b',
        overdriveLinger: 4.0 // Keeps overdrive active for 4s after combo drops
    },
    enemy: {
        radius: 18,
        colors: ['#ef4444', '#f59e0b', '#8b5cf6'],
        expValue: 18,
        chaseRange: 150,
        projectileSpeed: 500,
        baseHp: 40, hpPerWave: 0.16,  // NERF: 0.18 → 0.16 (exponential growth was too fast)
        baseSpeed: 85, speedPerWave: 6,
        baseDamage: 8, damagePerWave: 1.2,  // NERF: 1.5 → 1.2 (damage spike was too harsh)
        shootCooldown: [2.5, 4.5],
        shootRange: 550
    },
    tank: {
        radius: 25,
        color: '#78716c',
        expValue: 45,
        powerupDropMult: 1.5,
        baseHp: 100, hpPerWave: 0.20,  // NERF: 0.24 → 0.20 (Wave15 Tank 2519→1800 HP)
        baseSpeed: 60, speedPerWave: 3,
        baseDamage: 18, damagePerWave: 2.5,  // NERF: 3 → 2.5 (melee damage was too punishing)
        meleeRange: 55
    },
    mage: {
        radius: 16,
        color: '#a855f7',
        expValue: 55,
        powerupDropMult: 1.3,
        orbitDistance: 300,
        orbitDistanceBuffer: 100,
        baseHp: 28, hpPerWave: 0.22,  // NERF: 0.28 → 0.22 (glass cannon should stay fragile)
        baseSpeed: 70, speedPerWave: 5,
        baseDamage: 12, damagePerWave: 1.8,
        soundWaveCooldown: 10,
        soundWaveRange: 300,
        soundWaveConfuseDuration: 0.6,  // NERF: 0.8 → 0.6 (confusion was too long)
        meteorCooldown: 13,
        meteorDamage: 24,  // NERF: 28 → 24 (meteor spam was too strong)
        meteorBurnDuration: 3,
        meteorBurnDPS: 4.0  // NERF: 4.5 → 4.0
    },
    boss: {
        radius: 50,
        // MTC Room occupies y: -700 to -460 (h=240). Keep boss spawn clear below it.
        spawnY: -330,
        contactDamage: 25,
        speechInterval: 10,
        nextWaveDelay: 2000,
        log457HealRate: 0.06,
        chalkProjectileSpeed: 600,
        attackFireRate: 0.1,
        phase2AttackFireRate: 0.05,
        ultimateProjectileSpeed: 400,
        baseHp: 5200,
        hpMultiplier: 1.28,      // NERF: 1.333 → 1.28 (Enc5: ~14,000 HP แทน 16,400)
        moveSpeed: 140,
        phase2Speed: 190,
        phase2Threshold: 0.5,
        chalkDamage: 13,
        ultimateDamage: 35,
        ultimateBullets: 20,
        phase2UltimateBullets: 28,
        slamDamage: 60,
        slamRadius: 360,
        slamCooldown: 14,
        graphDamage: 70,
        graphLength: 1600,
        graphDuration: 20,
        graphCooldown: 16,
        log457ChargeDuration: 2,
        log457ActiveDuration: 6,
        log457StunDuration: 1.2,
        log457Cooldown: 30,
        log457AttackBonus: 0.09,
        log457AttackGrowth: 0.04,
        // burst armor: เมื่อ HP ต่ำกว่าค่านี้ ลดดาเมจเข้า
        burstArmorThresholdPct: 0.30,
        burstArmorReduction: 0.40,
        burstArmorDuration: 4.0,
        burstArmorCooldown: 25,
        phase2: {
            barkDamage: 32,
            barkRange: 600,
            barkCooldown: 3.2,
            enrageSpeedMult: 2.0,
            dogColor: '#d97706'
        },
        bossDog: {
            hp: 2000,
            speed: 280,
            damage: 30,
            radius: 24,
            color: '#d97706'
        },
        phase3Threshold: 0.25,
        phase3: {
            auraColor: '#38bdf8',
            goldfishCooldown: 5.5,
            goldfishCount: 4,
            bubbleCooldown: 6.0,
            bubbleCount: 5,
            slowFactor: 0.5,
            slowDuration: 2.0
        },
        goldfishMinion: {
            hp: 100,
            speed: 165,
            damage: 18,
            radius: 12,
            wobbleAmp: 40,
            wobbleFreq: 3.5,
            color: '#fb923c'
        },
        bubbleProjectile: {
            speed: 100,
            damage: 30,
            radius: 18,
            color: 'rgba(186, 230, 253, 0.6)'
        },
        first: {
            hpBaseMult: 0.62,
            advancedHpMult: 1.35,
            speedBaseMult: 1.55,
            advancedSpeedMult: 1.35,
            contactDamageMult: 1.2,
            cooldowns: { suvat: 8.0, orbit: 12.0, freeFall: 15.0, rocket: 9.0, sandwich: 18.0 },
            suvat: { windUp: 0.9, accel: 1900, maxDur: 1.2, damage: 80 },
            orbit: { radius: 115, speed: 2.8, duration: 3.5, projDamage: 24, projSpeed: 520 },
            freeFall: { warnDur: 1.8, aoeRadius: 140, damage: 95, advMult: 1.25 },
            rocket: { baseDmg: 28, advMult: 1.3, baseSpeed: 480 },
            berserk: { projDamage: 22, advMult: 1.3, projSpeed: 540, fireCd: 2.2 },
            dodge: { radius: 130, impulse: 420, cd: 1.2 }
        },
        domainExpansion: {
            dangerPct: 0.62,
            dangerPctMax: 0.84
        }
    },
    powerups: {
        radius: 20,
        dropRate: 0.18,  // BUFF: 0.15 → 0.18 (more healing opportunities)
        lifetime: 14,
        healAmount: 20,
        damageBoost: 1.4,  // NERF: 1.5 → 1.4 (stacking with shop was too strong)
        damageBoostDuration: 8,  // BUFF: 5 → 8 (lasts longer)
        speedBoost: 1.3,  // NERF: 1.35 → 1.3
        speedBoostDuration: 8  // BUFF: 5 → 8
    },
    waves: {
        spawnDistance: 800,
        bossSpawnDelay: 3000,
        maxWaves: 15,       // ← extended from 9 (5 boss encounters at waves 3,6,9,12,15)
        minKillsForNoDamage: 5,
        enemiesBase: 5,  // BUFF: 4 → 5 (more action early game)
        enemiesPerWave: 1.8,  // NERF: 2 → 1.8 (less enemy spam late game)
        tankSpawnChance: 0.10,  // NERF: 0.12 → 0.10 (fewer tanks)
        mageSpawnChance: 0.12,  // NERF: 0.15 → 0.12 (fewer mages)
        bossEveryNWaves: 3,
        glitchGracePeriod: 4000,
        // ── Wave Event Configurations ──────────────────────
        // Boss  : 3, 6, 9, 12, 15
        // Glitch: 5, 10
        // Fog   : 2, 8, 11, 14
        // Speed : 4, 7, 13
        // Dark  : 1
        fogWaves: [2, 8, 11, 14],
        speedWaves: [4, 7, 13],
        glitchWaves: [5, 10],
        darkWave: 1
    },
    score: {
        basicEnemy: 100,  // BUFF: 80 → 100 (more income)
        tank: 200,  // BUFF: 160 → 200
        mage: 280,  // BUFF: 220 → 280
        boss: 6000,  // BUFF: 5000 → 6000 (boss fights are hard)
        powerup: 120,  // BUFF: 100 → 120
        achievement: 500
    },
    mtcRoom: {
        healRate: 30,           // ลด 40→30 (offset by new abilities)
        maxStayTime: 4,
        cooldownTime: 10,
        size: 300,
        // ── Dash Reset ──────────────────────────────────────────
        dashResetOnEntry: true,
        // ── Crisis Protocol ─────────────────────────────────────
        crisisHpPct: 0.25,      // trigger ที่ HP ≤ 25%
        crisisHealBonus: 35,    // instant bonus HP
        // ── Rotating Buff Terminal (cycles per visit) ───────────
        // Index 0 = DMG, 1 = SPD, 2 = CDR Burst
        buffCycleDuration: [8, 6, 0],  // วินาที (0 = instant)
        buffCycleMagnitude: [0.15, 0.10, 0.35],  // +15% DMG, +10% SPD, -35% CD
        buffCycleNames: ['DMG +15%', 'SPD +10%', 'CDR BURST'],
        buffCycleColors: ['#f97316', '#22d3ee', '#a78bfa'],
        buffCycleIcons: ['⚔', '💨', '⚡'],
    },
    LIGHTING: {
        ambientLight: 0.9,
        cycleDuration: 60,
        nightMinLight: 0.12,
        dayMaxLight: 0.95,
        playerLightRadius: 160,
        projectileLightRadius: 50,
        mtcServerLightRadius: 120,
        shopLightRadius: 85,
        dataPillarLightRadius: 70,
        serverRackLightRadius: 55,
        nightR: 5, nightG: 8, nightB: 22
    },
    map: {
        size: 3000,
        objectDensity: 0.12,
        objectTypes: ['desk', 'tree', 'server', 'datapillar', 'bookshelf', 'blackboard'],
        wallPositions: [
            { x: -1500, y: -50, w: 50, h: 100 },
            { x: 1450, y: -50, w: 50, h: 100 },
            { x: -50, y: -1500, w: 100, h: 50 },
            { x: -50, y: 1450, w: 100, h: 50 }
        ],
        mapColors: {
            floor: '#0e1320',
            floorAlt: '#0a0f1a',
            treeLight: '#365314',
            treeMid: '#1a2e0a',
            treeDark: '#0f1a05',
            treeTrunk: '#451a03',
            deskTop: '#1c1408',
            deskLegs: '#0f0b04',
            serverBody: '#0d1117',
            serverLightOn: '#f59e0b',
            serverLightOff: '#451a03',
            pillarBase: '#1e293b',
            pillarCircuit: '#d97706',
            bookColors: ['#b45309', '#92400e', '#d97706', '#78350f', '#a16207', '#854d0e', '#f59e0b'],
            wallColor: '#1a1208',
            wallBrick: '#2d1f0a',
            whiteboardGreen: '#0d1f0a',
            chalkWhite: '#fef3c7'
        }
    }
};

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP ITEMS
// ══════════════════════════════════════════════════════════════
const SHOP_ITEMS = [
    {
        id: 'potion', name: 'Energy Drink', icon: '🧃',
        cost: 300, type: 'instant', heal: 60,
        desc: 'ฟื้นฟูเลือด 60 หน่วย', color: '#22c55e'
    },
    {
        id: 'shield', name: 'Energy Shield', icon: '🛡️',
        cost: 600, type: 'instant',
        desc: 'บล็อกการโจมตีครั้งต่อไปหนึ่งครั้ง', color: '#8b5cf6'
    },
    {
        id: 'maxHp', name: 'Vital Supplement', icon: '❤️',
        cost: 500, type: 'permanent', hpBonus: 15,
        desc: 'เพิ่มเลือดสูงสุด 15 หน่วย', color: '#f87171'
    },
    {
        id: 'dmgUp', name: 'Weapon Tuner', icon: '🔧',
        cost: 800, type: 'permanent', dmgPct: 0.05,
        desc: 'เพิ่มดาเมจ 5%', color: '#f59e0b'
    },
    {
        id: 'speedUp', name: 'Lightweight Boots', icon: '👟',
        cost: 500, type: 'permanent', speedPct: 0.05,
        desc: 'เพิ่มความเร็ว 5%', color: '#06b6d4'
    },
    {
        id: 'cdr', name: 'Focus Crystal', icon: '🔮',
        cost: 700, type: 'permanent', cdrPct: 0.05,
        desc: 'ลดคูลดาวน์สกิล 5%', color: '#a78bfa'
    }
];

const GAME_CONFIG = {
    canvas: {
        targetFPS: 60,
        cameraSmooth: 0.1
    },
    physics: {
        worldBounds: 1500,
        gridSize: 100
    },
    audio: {
        bgmVolume: 0.3,
        sfxVolume: 0.6,
        bgmPaths: {
            menu: 'assets/audio/menu.mp3',
            battle: 'assets/audio/battle.mp3',
            boss: 'assets/audio/boss.mp3',
            glitch: 'assets/audio/glitch.mp3'
        },
        master: 1.0,
        shoot: 0.28,        // auto reference level — อ้างอิงทุกปืน
        dash: 0.35,         // ลดลง 0.4→0.35 — dash ไม่ควรกลบเสียงปืน
        hit: 0.35,          // ลดลง 0.4→0.35 — hit feedback ชัดแต่ไม่ดังเกิน
        enemyDeath: 0.28,   // เท่า shoot — death ไม่ควรดังกว่าปืน
        powerUp: 0.2,
        heal: 0.35,
        levelUp: 0.4,
        victory: 0.6,
        achievement: 0.4,
        weaponSwitch: 0.25, // ลดลง 0.3→0.25 — UI sound ควรเบาที่สุด
        bossSpecial: 0.5,
        meteorWarning: 0.3,

        // ── Shell Casing Drop SFX ─────────────────────────────────────────────
        // ต้องเบากว่าเสียงปืนเสมอ auto ยิง 5 นัด/วินาที = 5 ปลอก/วินาที
        // shotgun = 3 ปลอกพร้อมกัน → peak ≈ shellDrop * 3 ต้องไม่กลบ shoot
        // สูตร: shellDrop * master * sfx * N_casings < shoot * master * sfx * weaponGain
        // 0.025 * 3 = 0.075 < shoot(0.28) * shotgun(1.3) = 0.364 ✅
        shellDrop: 0.025,

        // ── Procedural SFX gain multipliers ───────────────────────────────────
        // Tweak these to balance character SFX loudness without touching audio.js.
        // Values multiply the base `hit` or `shoot` level used in each playX().
        sfx: {
            stealth: 0.5,   // Kao warp cloaking sweep  (base: masterVol * sfxVol, not 'hit')
            clone: 0.4,     // Kao clone split ping
            riceShoot: 0.55,    // ลดลง 0.6→0.55 — Poom sticky rice splat
            ritualBurst: 1.1,   // Poom ritual explosion — ultimate needs presence
            punch: 0.55,        // ลดลง 0.6→0.55 — Auto heat wave punch
            standRush: 0.35,    // ลดลง 0.45→0.35 — fires every 60ms, stacks very fast
            nagaAttack: 0.45,   // ลดลง 0.55→0.45 — rate-limited 220ms แต่ยังถี่อยู่
            // ── New skill SFX ──────────────────────────────────────
            vacuum: 0.6,        // ลดลง 0.65→0.6 — Auto Q vacuum pull whoosh
            detonation: 0.85,   // Auto E — overheat explosion (ultimate, คงไว้)
            phantomShatter: 0.45, // ลดลง 0.50→0.45 — Kao clone expire burst
        },

        // ── Per-weapon SFX gain multipliers ───────────────────────────────────
        // Priority hierarchy: sniper > shotgun > auto
        // sniper = 1.6 — ยิงช้า 0.85s cooldown ควรรู้สึกหนักที่สุด
        // shotgun = 1.3 — ลดลง 2.0→1.3 (2.0 ดังเกินเดิม, 1.3 ยังคง punch ไว้)
        // auto = 1.0 — reference, ยิงถี่สุดต้องเบาสุด
        // Fallback: if key is missing, audio.js defaults to 1.0.
        weaponGain: {
            auto: 1.0,
            sniper: 1.6,    // raised 1.5→1.6 — ยิงช้าต้องรู้สึกหนัก
            shotgun: 1.3,   // ลดลง 2.0→1.3 — แก้ปัญหา shotgun ดังเกิน
        }
    },
    visual: {
        bgColorTop: '#1a1a2e',
        bgColorBottom: '#16213e',
        screenShakeDecay: 0.92,
        gridColor: 'rgba(255, 255, 255, 0.03)'
    },
    // ── Phase 4 Migration: Ability definitions ─────────────────
    // Rule: value makes sense on another character's ability → lives here.
    // Rule: value only tied to Poom's stats → stays in BALANCE.characters.poom
    abilities: {
        ritual: {
            // ── Damage model ──────────────────────────────────
            damagePerStack: 15,              // flat dmg per stack; 5 stacks = 75 dmg
            stackBurstPct: 0.25,             // % of enemy maxHp per stack (burst formula)
            baseDamage: 75,                  // base AoE damage when no sticky
            baseDamagePct: 0.15,             // 15% of enemy maxHp as base damage
            // ── Lifecycle ─────────────────────────────────────
            cooldown: 15,                    // seconds — reduced for better uptime
            castTime: 0.6,                   // seconds before window opens
            windowDuration: 3.0,             // seconds window stays active
            // ── Area of Effect ───────────────────────────────
            range: 280,                      // increased from 200 to 280 pixels
            // ── Effect modifiers ──────────────────────────────
            fullCeremonySpeedPct: 0.25,      // speed bonus during full ceremony
            fullCeremonyExtraSlowPct: 0.05,  // extra slow during full ceremony
            maxPoints: 3                     // ritual points needed for full ceremony
        }
    }
};

// ══════════════════════════════════════════════════════════════
// 🎨 VISUALS
// ══════════════════════════════════════════════════════════════
const VISUALS = {
    PALETTE: {
        POOM: {
            primary: '#a855f7',
            secondary: '#facc15',
            accent: '#d97706'
        },
        KAO: {
            primary: '#22c55e',
            secondary: '#94a3b8',
            accent: '#4ade80'
        },
        AUTO: {
            primary: '#dc2626',
            secondary: '#fb7185',
            accent: '#f97316'
        }
    },
    WEAPON_OFFSETS: {
        x: 15,
        y: 5,
        recoil: 8
    },
    AURA: {
        rotationSpeed: 0.05,
        opacity: 0.6
    }
};

// ══════════════════════════════════════════════════════════════
// 🏆 ACHIEVEMENT DEFINITIONS
// ══════════════════════════════════════════════════════════════
const ACHIEVEMENT_DEFS = [
    // ── Early Game ──────────────────────────────────────────────────────────
    { id: 'first_blood', name: 'First Blood', desc: 'เคลียร์ศัตรูตัวแรก', icon: '⚔️', reward: { type: 'hp', value: 5, text: '+5 Max HP' } },
    { id: 'wave_1', name: 'Wave Survivor', desc: 'ผ่าน Wave แรก', icon: '🌊', reward: { type: 'hp', value: 5, text: '+5 Max HP' } },
    { id: 'wave_5', name: 'MTC Veteran', desc: 'รอดชีวิตถึง Wave 5', icon: '🎖️', reward: { type: 'hp', value: 10, text: '+10 Max HP' } },
    { id: 'wave_10', name: 'MTC Legend', desc: 'รอดชีวิตถึง Wave 10', icon: '🏆', reward: { type: 'hp', value: 15, text: '+15 Max HP' } },

    // ── Boss Kills ──────────────────────────────────────────────────────────
    { id: 'manop_down', name: '1st Manop Slayer', desc: 'เอาชนะครูมานพครั้งแรก', icon: '👑', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'first_down', name: 'Physics Breaker', desc: 'เอาชนะครูเฟิร์สแซนด์วิชหมู', icon: '⚛️', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'parry_master', name: 'Return to Sender', desc: 'Parry แซนด์วิชหมูกลับไปหาครูเฟิร์ส', icon: '🥪', reward: { type: 'damage', value: 0.03, text: '+3% Damage' } },

    // ── Combat ──────────────────────────────────────────────────────────────
    { id: 'no_damage', name: 'Untouchable', desc: 'ผ่าน Wave โดยไม่โดนดาเมจ', icon: '🛡️', reward: { type: 'hp', value: 10, text: '+10 Max HP' } },
    { id: 'crit_master', name: 'Critical Master', desc: 'ตีติดคริติคอล 5 ครั้ง', icon: '💥', reward: { type: 'crit', value: 0.01, text: '+1% Crit Chance' } },
    { id: 'bullet_time_kill', name: 'Time Bender', desc: 'ฆ่าศัตรูขณะ Bullet Time 3 ตัว', icon: '🕐', reward: { type: 'cdr', value: 0.01, text: '-1% Cooldown' } },
    { id: 'barrel_bomber', name: 'Expert Bomber', desc: 'ฆ่าศัตรูด้วยถังระเบิด 3 ตัว', icon: '🛢️', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },

    // ── Movement ────────────────────────────────────────────────────────────
    { id: 'speedster', name: 'Speedster', desc: 'ใช้ Dash 20 ครั้ง', icon: '⚡', reward: { type: 'speed', value: 0.02, text: '+2% Speed' } },

    // ── Collection ──────────────────────────────────────────────────────────
    { id: 'collector', name: 'MTC Collector', desc: 'เก็บ Power-up 10 ชิ้น', icon: '💎', reward: { type: 'speed', value: 0.02, text: '+2% Speed' } },
    { id: 'shopaholic', name: 'MTC Shopaholic', desc: 'ซื้อไอเทมจากร้านค้า 5 ครั้ง', icon: '🛒', reward: { type: 'speed', value: 0.02, text: '+2% Speed' } },
    { id: 'shop_max', name: 'Capitalism', desc: 'ซื้อบัฟร้านค้าจนเต็มสแต็ก 1.5x', icon: '📈', reward: { type: 'speed', value: 0.02, text: '+2% Speed' } },

    // ── Stealth & Weapons ────────────────────────────────────────────────────
    { id: 'ghost', name: 'The Ghost of MTC', desc: 'ซุ่มสำเร็จ 10 ครั้ง', icon: '👻', reward: { type: 'cdr', value: 0.01, text: '-1% Cooldown' } },
    { id: 'weapon_master', name: 'Arsenal', desc: 'ใช้อาวุธครบทั้ง 3 แบบในเกมเดียว', icon: '🔫', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },

    // ── Character-specific ───────────────────────────────────────────────────
    { id: 'kao_awakened', name: 'Weapon Master Awakened', desc: 'ปลดล็อคสกิล Weapon Master ของเก้าสำเร็จ', icon: '⚡', reward: { type: 'crit', value: 0.01, text: '+1% Crit Chance' } },
    { id: 'drone_master', name: 'Drone Master', desc: 'ปลดล็อค Drone Overdrive ครั้งแรก', icon: '🤖', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'naga_summoner', name: 'Naga Summoner', desc: 'อัญเชิญพญานาค 3 ครั้ง', icon: '🐍', reward: { type: 'cdr', value: 0.01, text: '-1% Cooldown' } },
    { id: 'stand_rush_kill', name: 'WANCHAI-REQUIEM', desc: 'ฆ่าศัตรูด้วย Stand Rush 10 ตัว', icon: '🥊', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'ritual_wipe', name: 'Sticky Situation', desc: 'ฆ่าศัตรู 3 ตัวขึ้นไปด้วย Ritual Burst ครั้งเดียว', icon: '🌾', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },

    // ── NEW: Passive Awakenings ───────────────────────────────────────────────
    { id: 'scorched_soul', name: 'SCORCHED SOUL', desc: 'ปลดล็อค Passive ออโต้ด้วยการ Overheat ครั้งแรก', icon: '🔥', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'ritual_king', name: 'King of Isan', desc: 'ปลดล็อค Passive ภูมิด้วย Ritual Burst ครั้งแรก', icon: '🌾', reward: { type: 'hp', value: 10, text: '+10 Max HP' } },
    { id: 'free_stealth', name: 'Free Stealth', desc: 'ปลดล็อค Passive เก้าด้วยการซุ่มครั้งแรก', icon: '👻', reward: { type: 'cdr', value: 0.02, text: '-2% Cooldown' } },

    // ── NEW: Cosmic Balance ───────────────────────────────────────────────────
    { id: 'cosmic_balance', name: 'Cosmic Balance', desc: 'ใช้ Naga + Garuda พร้อมกันครั้งแรก', icon: '✨', reward: { type: 'damage', value: 0.03, text: '+3% Damage' } },

    // ── NEW: Rage Mode ────────────────────────────────────────────────────────
    { id: 'rage_mode', name: 'RAGE MODE', desc: 'ออโต้เข้าสู่ Rage Mode (Overheat + HP < 30%)', icon: '💢', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
];

// ══════════════════════════════════════════════════════════════
// 📝 GAME TEXTS
// ══════════════════════════════════════════════════════════════
const GAME_TEXTS = {
    wave: {
        badge: (wave) => `WAVE ${wave}`,
        floatingTitle: (wave) => `WAVE ${wave}`,
        bossIncoming: 'BOSS INCOMING!',
        bossIncomingRider: 'BOSS INCOMING!🐕',
        bossIncomingFish: 'BOSS INCOMING!🐟',
        // ── BossFirst (Kru First) announce texts ──────────────
        firstIncoming: '⚛️ KRU FIRST — BOSS INCOMING!',
        firstAdvanced: '⚛️ KRU FIRST — ADVANCED MODE ⚡',
        firstTagline: 'F=ma · v=u+at · DODGE THIS!',
        firstTaglineAdvanced: 'F=ma · E=mc² · MAXIMUM POWER!',
        glitchWave: '⚡ GLITCH WAVE ⚡',
        glitchAnomaly: 'SYSTEM ANOMALY DETECTED...⚠️',
        glitchControls: 'CONTROLS INVERTED!',
        glitchBrace: 'BRACE FOR IMPACT...',
        glitchCrisisHp: (bonus) => `🛡️ +${bonus} BONUS HP`,
        spawnCountdown: (secs) => `⚡ SPAWNING IN ${secs}...`,
        chaosBegins: '💀 CHAOS BEGINS!',
        // ── Special wave event banners ────────────────────────
        fogBannerTitle: '🌫️ FOG WAVE',
        fogBannerSubtitle: '— RADAR OFFLINE —',
        speedBannerTitle: '⚡ SPEED WAVE',
        speedBannerSubtitle: '— ENEMIES ACCELERATED —',
    },
    shop: {
        open: '🛒 MTC CO-OP STORE',
        resumed: '▶ RESUMED',
        notEnoughScore: 'คะแนนไม่พอ! 💸',
        hpFull: 'HP เต็มแล้ว!',
        healPickup: (amt) => `+${amt} HP 🧃`,
        dmgBoostActive: '🔧 DMG. ×1.1!',
        dmgBoostExtended: '🔧 DMG +30s.',
        dmgBoostExpired: 'DMG+ Expired',
        spdBoostActive: '👟 SPD. ×1.1!',
        spdBoostExtended: '👟 SPD +30s.',
        spdBoostExpired: 'SPD+ Expired',
    },
    // ══════════════════════════════════════════════════════
    // 🎮 SKILL NAMES — ชื่อที่แสดงใต้ปุ่มสกิลใน HUD
    // แก้ที่นี่เพื่อเปลี่ยนชื่อสกิลทั้งหมดในเกม
    // ══════════════════════════════════════════════════════
    skillNames: {
        // ── ทุกตัวละคร ──────────────────────────────────
        attack: 'ยิง',
        dash: 'พุ่งหลบ',

        // ── เก้า (KaoPlayer) ────────────────────────────
        kao: {
            skill1: 'ซุ่มล่องหน',    // R-Click — ซ่อนตัว
            teleport: 'เทเลพอร์ต',   // Q — เทเลพอร์ต
            clones: 'โคลนร่าง',     // E — โคลนร่าง
            passive: 'ซุ่มเสรี',  // passive — ซุ่มเสรี
        },

        // ── ภูมิ (PoomPlayer) ───────────────────────────
        poom: {
            skill1: 'กินเข่านึ่ง',    // R-Click — กินข้าวเหนียว
            naga: 'พญานาคา',        // Q — เรียกพญานาค
            garuda: 'ครุฑ',        // E — เรียกครุฑ
            ritual: 'ระเบิดสังเวย',      // R — พิธีสังเวย
        },

        // ── ออโต้ (AutoPlayer) ──────────────────────────
        auto: {
            skill1: 'แสตนด์วันชัย',   // R-Click — เรียก Stand
            vacuum: 'เกลียวความร้อน',   // Q — ดูดศัตรู + Ignite
            detonate: 'ระเบิดความร้อน', // E — Heat-scaled blast (ไม่ยกเลิก Stand)
            modeToggle: 'สลับโหมด',    // F — toggle Range ↔ Melee
        },

        // ── Utility (proximity shortcuts) ───────────────
        database: 'DATABASE',
        terminal: 'TERMINAL',
        shop: 'SHOP',
    },
    combat: {
        poomCrit: 'ข้าวเหนียวคริติคอล! 💥',
        highGround: 'HIGH GROUND!',
        droneOnline: '🤖 DRONE ONLINE',
        droneOverdrive: '🔥 DRONE OVERDRIVE!',
        // ── Kao skill texts ──
        kaoWeaponAwaken: '⚡ WEAPON MASTER AWAKENED!',
        kaoTeleport: '⚡ TELEPORT READY',
        kaoClones: '👥 CLONE OF STEALTH!',
        kaoFreeStealth: '👻 FREE STEALTH',
        // ── Poom — Garuda & Cosmic Balance texts ──
        garudaSummon: 'อัญเชิญครุฑ!',
        garudaVoice: 'ครุฑจงปกป้อง!',
        garudaExpire: 'ครุฑลาจาก...',
        cosmicActivate: '✨ COSMIC BALANCE!',
        cosmicVoice: 'พลังจักรวาลรวมกัน!',
    },
    time: {
        bulletTime: '🕐 BULLET TIME',
        normalSpeed: '▶▶ NORMAL',
        noEnergy: 'NO ENERGY! ⚡',
        energyDepleted: 'ENERGY DEPLETED ⚡',
        recharging: 'RECHARGING ⚡',
    },
    admin: {
        terminal: '💻 ADMIN TERMINAL',
        resumed: '▶ RESUMED',
        database: '📚 MTC DATABASE',
        sessionWelcome: 'Session started. Welcome, root.',
        sessionHelp: 'Run "help" to list available commands.',
        noPlayer: 'ERROR : No active player session.',
        authOk: 'Authenticating root privilege... OK',
        healInject: (gained) => `Injecting ${gained} HP units into player entity...`,
        healResult: (hp, max) => `COMMAND EXECUTED — HP : ${hp} / ${max}`,
        healFloat: (gained) => `+${gained} HP 💉 [ADMIN]`,
        scorePatching: 'Patching score register... +5000',
        scoreResult: (score) => `COMMAND EXECUTED — Score : ${score}`,
        scoreFloat: '+5000 🪙 [ADMIN]',
        nextSigkill: 'Sending SIGKILL to all enemy processes...',
        nextResult: (killed) => `COMMAND EXECUTED — ${killed} process(es) terminated. Wave advancing...`,
        nextFloat: '💀 WAVE SKIP [ADMIN]',
        closingSession: 'Closing session...',
        niceTry: 'nice try LOL',
        accessDenied: 'ACCESS DENIED — MTC Policy §4.2 violation logged.',
        whoami: 'root (player infiltrated server)',
        cmdNotFound: (raw) => `bash: ${raw}: command not found`,
        sudoNotFound: (cmd) => `sudo: ${cmd}: command not found`,
        sudoAccessDenied: 'ACCESS DENIED — Unknown sudo command.',
        typeHelp: 'Type "help" for available commands.',
        catPassword: 'hunter2',
        catPasswordWarn: "...wait, you weren't supposed to see that.",
        sandwich: 'What? Make it yourself.',
        helpTable: [
            '┌─────────────────────────────────────────────┐',
            '│  MTC ADMIN TERMINAL — AVAILABLE COMMANDS     │',
            '├─────────────────────────────────────────────┤',
            '│  sudo heal   Restore 100 HP to player        │',
            '│  sudo score  Add 5000 to current score       │',
            '│  sudo next   Kill all enemies, skip wave      │',
            '│  help        Show this command list           │',
            '│  clear       Clear terminal output            │',
            '│  exit        Close admin terminal             │',
            '└─────────────────────────────────────────────┘',
        ],
        lsEntries: [
            { text: 'drwxr-xr-x  secrets/', cls: 'cline-info' },
            { text: 'drwxr-xr-x  grades/', cls: 'cline-info' },
            { text: '-rw-------  kru_manop_passwords.txt', cls: 'cline-warn' },
            { text: '-rw-r--r--  exam_answers_2024.pdf', cls: 'cline-ok' },
        ],
    },
    ai: {
        loading: 'กำลังโหลดภารกิจ...',
        missionPrefix: (name) => `Mission "${name}"`,
        missionFallback: 'MTC Adventure',
        reportFallback: 'ตั้งใจเรียนให้มากกว่านี้นะ...',
        // ── Boss taunt fallbacks (used when Gemini is offline) ─
        bossTaunts: [
            'ทำการบ้านมารึป่าว!',
            'เกรดแย่แบบนี้จะสอบติดมั้ยเนี่ย?',
            'สมการนี้ง่ายนิดเดียว!',
            'อ่อนเลขขนาดนี้ มาเรียนพิเศษไหม?',
            'log 4.57 คือเท่าไหร่เอ่ย?',
            'คิดเลขไม่ออก สอบตกแน่ๆ',
            'นักเรียนยุคนี้มันอ่อนแอจริงๆ',
            'แค่นี้ก็ทำไม่ได้แล้วหรอ?',
        ],
        // ── Mission name fallbacks ─────────────────────────────
        missionNames: [
            'Equation War',
            'Math Operation',
            'MTC Adventure',
        ],
        // ── Report card fallbacks (keyed by performance tier) ─
        reportCards: {
            excellent: [
                'เก่งมาก! แบบนี้ต้องได้เกรด A แน่นอน',
                'ยอดเยี่ยม! ครูภูมิใจมาก',
                'คะแนนเต็ม! นักเรียนดีเด่น',
            ],
            good: [
                'ดีมาก ค่อนข้างพอใช้',
                'ผ่านได้ แต่ยังต้องฝึกต่อ',
                'ไม่เลว แต่ต้องพยายามให้มากกว่านี้',
            ],
            poor: [
                'คะแนนต่ำไป ต้องตั้งใจเรียนให้มากกว่านี้',
                'ยังไม่ดีพอ กลับไปทบทวนอีกครั้ง',
                'ได้คะแนนน้อยเกินไป จะสอบผ่านมั้ย?',
            ],
        },
    },
    boss: {
        // ── BossFirst (Kru First) phase-transition physics taunts
        firstTaunts: [
            'E = mc²',
            'Action = Reaction',
            'Calculate this!',
            'Physics is everything!',
        ],
    },
    ui: {
        hits: "HITS!",
        godlike: "GODLIKE!",
        unstoppable: "UNSTOPPABLE!",
        confusedWarning: "⚠️ CONFUSED : INVERT YOUR MOVEMENT! ⚠️",
        minimapTitle: "TACTICAL RADAR",
        legendEnm: "ENM",
        legendMge: "MGE",
        legendTnk: "TNK",
        legendBss: "BSS",
        legendShp: "SHP",
        dayPhase: (pct) => `DAY ${pct}%`,
        nightPhase: (pct) => `NIGHT ${pct}%`
    },
    environment: {
        barrelBoom: "💥BOOM!"
    },
    // ══════════════════════════════════════════════════════
    // 🎓 TUTORIAL TEXTS — ข้อความสอนการเล่นทั้งหมด
    // ══════════════════════════════════════════════════════
    tutorial: {
        welcome: {
            title: 'ยินดีต้อนรับสู่ MTC the Game!',
            body: 'คุณกำลังจะเข้าสู่ห้องเรียนของ KruManop (ครูมานพ) ครูคณิตศาสตร์สุดโหด\n\nภารกิจ: รอดชีวิตให้ครบ 15 เวฟ และเอาชนะบอสทุกตัว\n\nกด NEXT หรือ SPACE เพื่อเริ่มบทเรียน',
            icon: '🎓'
        },
        movement: {
            title: 'การเคลื่อนที่',
            body: 'กด W A S D เพื่อเดิน\n\nเดินไปรอบๆ สักครู่เพื่อทดสอบ!',
            icon: '🕹️'
        },
        shooting: {
            title: 'การยิง',
            body: 'เล็งด้วย Mouse แล้วกด Left Click เพื่อยิง\n\nลองยิงดู 3 ครั้ง!',
            icon: '🔫'
        },
        dash: {
            title: 'Dash — หลบหลีก',
            body: 'กด SPACE เพื่อ Dash พุ่งหลบศัตรู\nมี Cooldown — ใช้ให้ถูกจังหวะ!\n\nลอง Dash 1 ครั้ง',
            icon: '💨'
        },
        rclick: {
            title: 'ทักษะพิเศษ (Right Click)',
            body: 'กด Right Click เพื่อใช้ทักษะประจำตัว:\n• เก้า — Stealth ซ่อนตัว 3 วินาที\n• ภูมิ — Eat Rice ฟื้น HP และเพิ่มพลัง\n• Auto — Wanchai Stand เรียก autonomous companion (8s, CD 12s)\n\nลองกด Right Click ดู!',
            icon: '✨'
        },
        kaoPassive: {
            title: 'เก้า — ซุ่มเสรี (Passive) 👻',
            body: 'กด Right Click ใช้ Stealth ครั้งแรก → ปลดล็อค Passive ทันที!\n\n✦ Dash → Free Stealth อัตโนมัติทุกครั้ง\n✦ Crit ขณะซ่อนตัวเพิ่ม 50%\n✦ ความเร็วถาวร +40%\n✦ Q · E สกิลปลดล็อค\n\n⚔️ WEAPON MASTER: ฆ่าด้วยแต่ละอาวุธ 5 ครั้ง\n   → Golden Awakened Form',
            icon: '👻'
        },
        kaoWeapon: {
            title: 'เก้า — สลับอาวุธ 🔫',
            body: 'เก้ามีอาวุธ 3 ชนิด:\n• Auto Rifle — ยิงเร็ว (ค่าเริ่มต้น)\n• Sniper — Railgun ดาเมจสูง ยิงช้า\n• Shotgun — Molten Shrapnel ระยะใกล้\n\nเลื่อน Mouse Wheel เพื่อสลับ\nสลับให้ครบ 3 ครั้ง!',
            icon: '🔄'
        },
        autoStandRush: {
            title: 'Auto — Stand Rush Manual Targeting 👊',
            body: 'ระหว่าง Wanchai active:\n\n🎯 ชี้เมาส์แล้ว L-Click = Stand Rush ไปตำแหน่งนั้น\n   Stand teleport หาเป้าแล้วรัวหมัดทันที\n\n✨ 6-layer rendering พร้อม visual effect\n🥊 Dual-fist — _punchSide สลับข้างทุกหมัด\n\n⚡ Wanchai ยังโจมตีอัตโนมัติด้วย\n   L-Click เพิ่ม Stand Rush ทับไปได้เลย\n\n💥 PASSIVE UNLOCK: ทำ Heat ให้เต็ม 100% → SCORCHED SOUL\n🔥 RAGE MODE: OVERHEAT + HP < 30% → DMG ×1.3 + DEF +20%',
            icon: '👊'
        },
        bulletTime: {
            title: 'Bullet Time ⏱',
            body: 'กด T เพื่อเปิด Bullet Time\nเวลาจะช้าลง 70% — หลบกระสุนหนาแน่น\n\nแถบพลังงาน FOCUS (ล่างกลาง) ค่อยๆ หมด\nปล่อยให้ชาร์จก่อนใช้อีกครั้ง\n\nกด T เพื่อทดลอง!',
            icon: '🕐'
        },
        levelUp: {
            title: 'Level Up & EXP 📈',
            body: 'กำจัดศัตรูเพื่อรับ EXP\nเมื่อเลเวลอัพ Stats ทั้งหมดเพิ่มขึ้น\n\nLv.2 → ปลดล็อค Skill Q\nLv.3 → ปลดล็อค Skill E (หรือ R สำหรับภูมิ)\n\n💡 แถบ EXP อยู่ใต้แถบ HP มุมซ้ายบน',
            icon: '📈'
        },
        shop: {
            title: 'MTC Co-op Store 🛒',
            body: 'ร้านค้าอยู่มุมซ้ายล่างของแผนที่\nเดินเข้าใกล้แล้วกด B เพื่อเปิดร้าน\n\n🧪 ซื้อด้วย Score:\n• Energy Drink — ฟื้น HP 60 หน่วย (300 คะแนน)\n• Weapon Tuner — เพิ่มดาเมจ 5% (800 คะแนน)\n• Lightweight Boots — เพิ่มความเร็ว 5% (500 คะแนน)\n• Focus Crystal — ลดคูลดาวน์ 5% (700 คะแนน)\n• Energy Shield — บล็อกการโจมตี 1 ครั้ง (600 คะแนน)\n• Vital Supplement — เพิ่ม HP สูงสุด 15 (500 คะแนน)',
            icon: '🛒'
        },
        database: {
            title: 'MTC Database Server 🗄️',
            body: 'เซิร์ฟเวอร์อยู่มุมขวาบนของแผนที่\n\n💻 กด E — เปิด MTC Database\n   ดูเนื้อหาและ Lore\n\n🔒 กด F — Admin Terminal\n   พิมพ์ "help" เพื่อดูคำสั่งทั้งหมด\n   เช่น: "sudo heal", "sudo score", "sudo next"',
            icon: '🗄️'
        },
        enemyTypes: {
            title: 'ประเภทศัตรู & Wave Events 👾',
            body: 'ศัตรู 3 ประเภท:\n🔴 Basic — เดินเร็ว ยิงได้\n🟠 Tank 🛡️ — HP สูงมาก เดินช้า\n🟣 Mage 🧙 — สายฟ้า + อุกกาบาต\n\nWave Events พิเศษ:\n🌑 Wave 1 — Dark Wave: เปิดตัวด้วยความมืดมิด\n🌫️ Wave 2,8,11,14 — Fog Wave: Radar OFFLINE — minimap ใช้ไม่ได้!\n⚡ Wave 4,7,13 — Speed Wave: ศัตรูเร็ว ×1.5\n⚠️ Wave 5,10 — Glitch Wave: Controls Invert + ได้ HP +100 ชั่วคราว',
            icon: '👾'
        },
        boss: {
            title: 'Boss Encounters 👑',
            body: 'ทุก 3 เวฟจะมี Boss — 5 encounters ทั้งหมด:\n\n👑 Wave  3 — KruManop (Basic)\n🐕 Wave  9 — KruManop (Dog Rider) — Phase 2 เรียกหมา\n🐟 Wave 15 — KruManop (Goldfish Lover) — Phase 2+3\n\n⚛️ Wave  6 — KruFirst (Basic)\n⚛️ Wave 12 — KruFirst (Advanced ⚠️ ยากขึ้น)\n\n🌌 Domain Expansion — ทักษะ Ultimate\n   Boss ใช้เมื่อ HP ต่ำ ควบคุมพื้นที่ทั้ง Arena!\n\n💡 ดู Boss HP Bar ด้านบนของจอ',
            icon: '👑'
        },
        ready: {
            title: 'พร้อมแล้ว! 🚀',
            body: 'คุณรู้ทุกอย่างที่จำเป็นแล้ว!\n\n🏆 ทำคะแนนสูงสุดเพื่อขึ้น Leaderboard\n⭐ ปลดล็อค Achievement มากมาย\n🎯 ผ่านทั้ง 15 Wave เพื่อชนะเกม\n\nกด START เพื่อเข้าสู่สนามรบ!',
            icon: '🎮'
        }
    }
};

window.GAME_TEXTS = GAME_TEXTS;

// ══════════════════════════════════════════════════════════════
// 🗺️  MAP_CONFIG — Terrain rendering constants for drawTerrain()
// All visual values consumed by MapSystem.drawTerrain() live here.
// To tweak arena colours, path destinations, or aura sizes, edit
// this block only — never touch map.js draw code directly.
// ══════════════════════════════════════════════════════════════
const MAP_CONFIG = {

    // ── Arena boundary ─────────────────────────────────────────
    arena: {
        radius: 1500,
        haloColor: 'rgba(180, 100, 20, {a})',
        midColor: 'rgba(120, 60, 10, {a})',
        rimColor: 'rgba(250, 180, 30, {a})',
        dashColor: 'rgba(245, 158, 11, {a})',
        haloAlphaBase: 0.08,
        midAlphaBase: 0.15,
        rimAlphaBase: 0.55,
        dashAlphaBase: 0.30,
        rimGlowBlur: 20,
        rimGlowColor: 'rgba(250, 180, 30, 0.9)',
    },

    // ── Tech-hex grid ──────────────────────────────────────────
    hex: {
        size: 64,
        fillColor: 'rgba(120, 60, 10, {a})',
        strokeColor: 'rgba(200, 120, 20, {a})',
        fillAlpha: 0.05,
        strokeAlpha: 0.15,
        falloffRadius: 1400,
    },

    // ── Circuit paths ──────────────────────────────────────────
    // Update `to` coords here when landmark positions change in game.js
    paths: {
        database: {
            from: { x: 0, y: 0 },
            to: { x: 350, y: -350 },
            coreColor: '#fbbf24',
            glowColor: 'rgba(251, 191, 36, 0.85)',
            phase: 0.0,
        },
        shop: {
            from: { x: 0, y: 0 },
            to: { x: -350, y: 350 },
            coreColor: '#f97316',
            glowColor: 'rgba(249, 115, 22, 0.85)',
            phase: 2.094,
        },
        // Shared path style
        glowWidth: 16,
        coreWidth: 3.5,
        glowAlphaBase: 0.20,
        coreAlphaBase: 0.85,
        coreGlowBlur: 18,
        packetCount: 3,
        packetSpeed: 0.45,
        packetRadius: 4.5,
        packetAuraRadius: 8,
        elbowRadius: 5,
    },

    // ── Object palettes (draw helpers) ────────────────────────
    // All hardcoded colors from drawDesk/drawTree/drawServer/drawDataPillar/drawBookshelf live here.
    // In Godot: becomes a Resource (.tres) for each object type.
    objects: {
        desk: {
            screenGlow: 'rgba(250,200,100,0.15)',   // monitor top-edge highlight
            monitorBody: '#1c1408',
            monitorText: '#fcd34d',
            notePaper: '#fbbf24',
            notePen: '#f97316',
        },
        tree: {
            shadowFill: 'rgba(0,0,0,0.25)',
            leafSparkle: 'rgba(255,255,255,0.55)',
            leafHex: 'rgba(134,239,172,0.6)',
        },
        server: {
            inner: '#1a1005',
            unitSlot: '#120c04',
            dataLedOn: '#f59e0b',
            dataLedOff: '#451a03',
            ventStroke: '#0f0b04',
            headerFill: '#1c1408',
            headerVent: '#2d1f0a',
            portFill: '#d97706',
        },
        datapillar: {
            shadowFill: 'rgba(0,0,0,0.3)',
            baseDark: '#1c1408',
            baseLight: '#2d1f0a',
            bodyGrad: ['#1c1408', '#3d2a0e', '#2d1f0a'],
            circuit: 'rgba(217,119,6,',           // alpha appended at runtime
        },
        bookshelf: {
            frameBody: '#78350f',
            frameSide: '#92400e',
            shelfBoard: '#a16207',
            bookGloss: 'rgba(255,255,255,0.2)',
            bookShadow: 'rgba(0,0,0,0.3)',
        },
    },

    // ── Zone Floor Themes ──────────────────────────────────────
    zones: {
        serverFarm: {
            x: 300, y: -450, w: 800, h: 750,
            floorColor: 'rgba(6, 182, 212, 0.04)',
            gridColor: 'rgba(6, 182, 212, 0.12)',
            gridSize: 36,
            accentColor: 'rgba(34, 211, 238, 0.18)',
            label: 'SERVER FARM',
        },
        library: {
            x: -1300, y: -450, w: 750, h: 750,
            floorColor: 'rgba(180, 120, 20, 0.06)',
            gridColor: 'rgba(251, 191, 36, 0.10)',
            gridSize: 48,
            accentColor: 'rgba(253, 224, 71, 0.15)',
            label: 'ARCHIVES',
        },
        courtyard: {
            x: -500, y: 400, w: 1000, h: 600,
            floorColor: 'rgba(34, 197, 94, 0.05)',
            gridColor: 'rgba(74, 222, 128, 0.08)',
            gridSize: 60,
            accentColor: 'rgba(134, 239, 172, 0.12)',
            label: 'COURTYARD',
        },
        lectureHallL: {
            x: -1100, y: 480, w: 400, h: 400,
            floorColor: 'rgba(168, 85, 247, 0.04)',
            gridColor: 'rgba(192, 132, 252, 0.10)',
            gridSize: 40,
            accentColor: 'rgba(216, 180, 254, 0.12)',
            label: 'LECTURE A',
        },
        lectureHallR: {
            x: 700, y: 480, w: 400, h: 400,
            floorColor: 'rgba(168, 85, 247, 0.04)',
            gridColor: 'rgba(192, 132, 252, 0.10)',
            gridSize: 40,
            accentColor: 'rgba(216, 180, 254, 0.12)',
            label: 'LECTURE B',
        },
    },

    // ── Zone auras ─────────────────────────────────────────────
    auras: {
        database: {
            worldX: 350,
            worldY: -350,
            innerRgb: '250, 180, 30',
            outerRgb: '120, 60, 10',
            radius: 130,
            phase: 0.0,
        },
        shop: {
            worldX: -350,
            worldY: 350,
            innerRgb: '249, 115, 22',
            outerRgb: '154, 52, 18',
            radius: 130,
            phase: 1.6,
        },
        origin: {
            worldX: 0,
            worldY: 0,
            innerRgb: '217, 119, 6',
            outerRgb: '92, 40, 10',
            radius: 80,
            phase: 3.2,
        },
        // Shared aura style
        innerAlphaBase: 0.22,
        midAlphaBase: 0.10,
        outerAlphaBase: 0.04,
        rimAlphaBase: 0.28,
        rimWidth: 2,
        rimGlowBlur: 16,
        dashAlphaBase: 0.12,
        dashOuterMult: 1.3,
    },
};

window.MAP_CONFIG = MAP_CONFIG;
window.BALANCE = BALANCE;
window.SHOP_ITEMS = SHOP_ITEMS;
window.GAME_CONFIG = GAME_CONFIG;
window.VISUALS = VISUALS;
window.ACHIEVEMENT_DEFS = ACHIEVEMENT_DEFS;
window.API_KEY = API_KEY;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BALANCE, SHOP_ITEMS, GAME_CONFIG, VISUALS, ACHIEVEMENT_DEFS, API_KEY, GAME_TEXTS, MAP_CONFIG };
}