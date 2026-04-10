'use strict';
/**
 * js/balance.js
 * Shared gameplay balance, runtime config, visuals, achievements, and map constants.
 * Load before shop-items.js and game-texts.js so downstream systems see globals in order.
 */

/**
 * ๐“… WAVE_SCHEDULE โ€” JSON-ready Wave Timing Config
 * Decoupled from BALANCE to allow future async loading without crashing game loop.
 */
const WAVE_SCHEDULE = Object.freeze({
    fogWaves: [2, 8, 11, 14],
    speedWaves: [4, 7, 13],
    glitchWaves: [5, 10],
    darkWave: 1,
    bossWaves: [3, 6, 9, 12, 15],
    weatherChance: 0.35,  // เนเธญเธเธฒเธชเธกเธตเธชเธ เธฒเธเธญเธฒเธเธฒเธจเธ•เนเธญ wave (rain เธซเธฃเธทเธญ snow เธฃเธงเธกเธเธฑเธ)
    snowChance: 0.12,  // subset เธเธญเธ weatherChance โ€” 12% snow, 23% rain, 65% none
    maxWaves: 15
});
window.WAVE_SCHEDULE = WAVE_SCHEDULE;

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
    },
    characters: {
        kao: {
            name: 'Kao',
            radius: 20,
            hp: 92, maxHp: 92,
            energy: 100, maxEnergy: 100,
            energyRegen: 15,
            moveSpeed: 298,
            dashSpeed: 550,
            dashDistance: 180,
            weapons: {
                auto: {
                    name: 'AUTO RIFLE',
                    damage: 26, cooldown: 0.22,  // BUFF: 22โ’26 dmg, 0.20โ’0.22 cd (DPS 110โ’118, gap vs Shotgun เนเธเธเธฅเธ)
                    range: 900, speed: 900,
                    spread: 0, pellets: 1,
                    color: '#3b82f6', icon: '๐”ต'
                },
                sniper: {
                    name: 'SNIPER',
                    damage: 95, cooldown: 0.85,
                    range: 1200, speed: 1200,
                    spread: 0, pellets: 1,
                    color: '#ef4444', icon: '๐”ด'
                },
                shotgun: {
                    name: 'SHOTGUN',
                    damage: 28, cooldown: 0.55,   // NERF: 30โ’28 dmg, 0.50โ’0.55 cd (DPS 180โ’153, เธขเธฑเธเน€เธเนเธ top เนเธ•เน gap เธฅเธ”เธฅเธ)
                    range: 400, speed: 700,
                    spread: 0.45, pellets: 3,
                    color: '#f59e0b', icon: '๐ '
                }
            },
            baseCritChance: 0.05,
            critMultiplier: 2.5,
            dashCooldown: 1.65,
            stealthCooldown: 5.5,
            stealthCost: 25,
            stealthDrain: 45,
            stealthSpeedBonus: 1.5,
            expToNextLevel: 100,
            expLevelMult: 1.30,     // BIG-BALANCE: 1.5 โ’ 1.30 โ€” player reaches Lv12 at W15 (was Lv9)
            passiveUnlockLevel: 1,          // fallback เน€เธ—เนเธฒเธเธฑเนเธ โ€” KaoPlayer.checkPassiveUnlock() override
            passiveUnlockStealthCount: 1,   // fallback: เธเธฅเธ”เธ•เธฑเนเธเนเธ•เน stealth เธเธฃเธฑเนเธเนเธฃเธ
            // โ”€โ”€ Passive Lv1 (Stealth เธเธฃเธฑเนเธเนเธฃเธ) โ”€โ”€
            passiveHpBonusPct: 0.22,        // BALANCE: 0.50 โ’ 0.30 โ’ 0.22
            passiveUnlockText: '๐‘ป เธเธธเนเธกเน€เธชเธฃเธต',
            passiveCritBonus: 0.0,          // REWORK: crit เธขเนเธฒเธขเนเธ Lv2
            passiveLifesteal: 0.01,         // NERF: 0.03 โ’ 0.02 โ’ 0.01 (เธเธนเนเน€เธฅเนเธเนเธเนเธเธงเนเธฒเธฃเธญเธ”เธเนเธฒเธขเน€เธเธดเธเนเธ)
            passiveSpeedAdditive: 0.4,      // NEW: additive +0.4 (เนเธ—เธ Math.max ร—1.4 เธ—เธตเนเธ—เธฑเธ shop bonus)
            // โ”€โ”€ Passive Lv2 "Awakened" (เธเนเธฒเธเธ“เธฐ FreeStealthy 5 เธเธฃเธฑเนเธ) โ”€โ”€
            passiveLv2KillReq: 5,           // NEW: เธเธณเธเธงเธ FreeStealthy-kills เธ—เธตเนเธ•เนเธญเธเธเธฒเธฃ
            passiveLv2HpBonusPct: 0.20,     // NEW: HP +20% เน€เธเธดเนเธกเน€เธ•เธดเธกเน€เธกเธทเนเธญเธ–เธถเธ Lv2
            passiveLv2UnlockText: '๐‘ป เน€เธ—เธเนเธซเนเธเธเธธเนเธก!',
            passiveLv2CritBonus: 0.04,      // NERF: 0.05 โ’ 0.04 (minor crit trim)
            speedOnHit: 20,
            speedOnHitDuration: 0.4,
            damageMultiplierPerLevel: 0.065,  // BALANCE: 0.12 โ’ 0.09 โ’ 0.065
            cooldownReductionPerLevel: 0.04,  // BUFF: 0.03 โ’ 0.04
            maxHpPerLevel: 4,                 // BALANCE: 8 โ’ 6 โ’ 4
            // โ”€โ”€ Advanced Kao Skills โ”€โ”€
            teleportCooldown: 18,
            teleportEnergyCost: 20,         // NEW: Q Teleport/PhantomBlink โ€” instant blink เธเธงเธฃเธกเธตเธ•เนเธเธ—เธธเธ
            cloneCooldown: 25,              // 60 โ’ 25 (REWORK: usable mid-game)
            cloneEnergyCost: 30,            // NEW: E Clone โ€” summon clone เนเธเนเธเธฅเธฑเธเธเธฒเธเธชเธฃเนเธฒเธ
            cloneDuration: 8,               // 10 โ’ 8 (shorter but sharper)
            cloneProximityRange: 90,        // NEW: clone proximity burst trigger range
            cloneProximityDmgMult: 0.60,    // NEW: proximity burst dmg mult
            dashStealthDuration: 1.5,       // NEW: free stealth after every dash
            phantomBlinkEnabled: true,      // NEW: Q during stealth = Phantom Blink (เธเธฅเธ”เธ—เธตเน Lv2)
            phantomBlinkAmbushWindow: 2.0,  // BUFF: 1.5 โ’ 2.0 (window เธขเธฒเธงเธเธถเนเธ)
            phantomBlinkDmgMult: 1.2,       // NERF: 2.5 โ’ 1.8 โ’ 1.4 โ’ 1.2 (เธฅเธ” burst เน€เธเธทเนเธญเน€เธเธดเนเธกเธเธงเธฒเธกเธ—เนเธฒเธ—เธฒเธข)
            stealthChainBonus: 0.18,        // NERF: 0.25 โ’ 0.18 (crit stack -7%)
            weaponMasterReq: 5,             // เธฅเธ”เธเธฒเธ 7 โ’ 5 (passive เน€เธฃเนเธงเธเธถเนเธ โ’ Weapon Master เธเนเธเธงเธฃเธ—เธณเนเธ”เนเน€เธฃเนเธงเธเธถเนเธ)
            // โ”€โ”€ AbilityUnlock thresholds โ”€โ”€
            su1AmbushDmgReq: 200,           // SU1: total guaranteed-crit ambush damage to unlock Q (Teleport)
            su2ChainReq: 3                  // SU2: stealthโ’attack chain completions to unlock E (Clone)
        },
        auto: {
            // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
            // ๐”ฅ AUTO โ€” THERMODYNAMIC BRAWLER REWORK v2
            // Identity: เธญเธธเนเธเน€เธเธฃเธทเนเธญเธเธขเธดเนเธเธเธเธเธฒเธ เธขเธดเนเธเน€เธเนเธ
            // Loop: เธชเธฐเธชเธก Heat โ’ Wanchai โ’ Combo โ’ Detonate โ’ เธฃเธตเน€เธเนเธ•เนเธ”เนเธเนเธฒเธข
            // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
            name: 'Auto',
            radius: 20,

            // โ”€โ”€ Base Stats (Tank Brawler) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            hp: 150, maxHp: 150,           // BALANCE: 230 โ’ 190 โ’ 150
            energy: 100, maxEnergy: 100,
            energyRegen: 20,
            moveSpeed: 260,                 // 250 โ’ 260 (เธขเธฑเธเธเนเธฒเธเธงเนเธฒเธเธเธญเธทเนเธ)
            dashSpeed: 490,
            dashDistance: 170,              // 160 โ’ 170
            dashCooldown: 1.7,              // 1.8 โ’ 1.7

            // โ”€โ”€ Heat Wave (L-Click เธเธเธ•เธด / เนเธซเธกเธ”เธขเธดเธ) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            heatWaveRange: 180,
            heatWaveCooldown: 0.22,

            // โ”€โ”€ Wanchai Stand (R-Click) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            wanchaiDuration: 8.0,           // 6.0 โ’ 8.0 (longer payoff window)
            wanchaiCooldown: 12,            // 9 โ’ 12 (trade longer for less spammy)
            wanchaiEnergyCost: 25,          // 32 โ’ 25 (easier loop)
            wanchaiPunchRate: 0.22,          // PERF+NERF: 0.10 โ’ 0.22 (~4.5 punches/s, HOT tier: 0.187s โ€” prevent particle spam at high punch rate)
            wanchaiDamage: 18,              // BIG-BALANCE: 24 โ’ 18 (โ’25%) โ€” HOT DPS 461โ’315, ratio vs Poom 2.5ร—โ’1.7ร—
            standSpeedMod: 1.5,
            standDamageReduction: 0.30,     // NERF: 0.40 โ’ 0.30 (เธฅเธ” damage reduction เน€เธเธทเนเธญเน€เธเธดเนเธกเธเธงเธฒเธกเน€เธชเธตเนเธขเธ)
            standCritBonus: 0.10,           // BIG-BALANCE: 0.18 โ’ 0.10 (โ’8% crit stack, เธเธ” ceiling)
            standMoveSpeed: 340,
            standPunchRange: 110,
            standLeashRadius: 420,
            standKnockback: 240,            // 180 โ’ 240 (BUFF)

            // โ”€โ”€ Attack Mode Toggle โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // เธฃเธฐเธซเธงเนเธฒเธ Wanchai active: เธเธ” F (เธซเธฃเธทเธญ Middle-Click) เธชเธฅเธฑเธเนเธซเธกเธ”
            // MODE 0 = RANGE: เธขเธดเธ Heat Wave เธเธเธ•เธด (เนเธกเนเธเธณเธเธฑเธ”เธฃเธฐเธขเธฐ)
            // MODE 1 = MELEE: เธฃเธฑเธงเธซเธกเธฑเธ” Stand Rush (เธฃเธฐเธขเธฐเนเธเธฅเน)
            // เธ—เธฑเนเธเธชเธญเธเนเธซเธกเธ”เนเธเน cooldowns.shoot เน€เธ”เธตเธขเธงเธเธฑเธ
            playerMeleeCooldown: 0.12,      // 0.15 โ’ 0.12 (MELEE mode punch rate)
            playerMeleeRange: 200,          // 85 โ’ 200 (REWORK: เน€เธเธดเนเธกเธฃเธฐเธขเธฐ melee เนเธซเนเนเธเนเธเธฒเธเนเธ”เนเธเธฃเธดเธ)
            playerMeleeRangeFar: 320,       // range เน€เธกเธทเนเธญ Heat >= 67% (HOT tier)
            playerRushRange: 200,           // radius เธฃเธญเธ cursor เธชเธณเธซเธฃเธฑเธ Stand Rush L-click (sync เธเธฑเธ playerMeleeRange)
            playerRushCooldown: 0.10,       // cooldown เธ•เนเธญ Stand Rush (combo speed bonus เธซเธฑเธเธเธฒเธเธเธตเน)

            // โ”€โ”€ Vacuum Heat (Q) โ€” REWORK: Pull + Ignite โ”€โ”€โ”€โ”€โ”€โ”€
            vacuumRange: 340,               // 320 โ’ 340
            vacuumForce: 1900,              // 1600 โ’ 1900 (BUFF)
            vacuumCooldown: 6,              // 8 โ’ 6 (bread-and-butter skill, basic pull)
            vacuumEnergyCost: 20,           // NEW: Q Vacuum โ€” pull + ignite เนเธเน focus
            vacuumStunDur: 0.50,            // 0.55 โ’ 0.50
            vacuumPullDur: 0.45,
            vacuumDamage: 18,               // NEW: damage เธ“ เธเธธเธ”เธ”เธนเธ”
            vacuumIgniteDuration: 1.5,      // NEW: Ignite debuff duration
            vacuumIgniteDPS: 12,            // NEW: burn DPS เธเธ“เธฐ Ignite
            vacuumHeatGain: 25,             // NEW: +Heat เธ—เธธเธเธเธฃเธฑเนเธเธ—เธตเนเนเธเนเธชเธณเน€เธฃเนเธ
            standPullCooldown: 10,          // NEW: Stand Pull CD เนเธขเธเธ•เนเธฒเธเธซเธฒเธ โ€” เนเธฃเธเธเธงเนเธฒ Vacuum = CD เธขเธฒเธงเธเธงเนเธฒ

            // โ”€โ”€ Overheat Detonation (E) โ€” REWORK: Heat-scaled, เนเธกเน kill Wanchai โ”€โ”€
            detonationRange: 240,           // 220 โ’ 240
            detonationCooldown: 8,          // 5 โ’ 8 (เนเธกเน kill Wanchai เนเธฅเนเธง โ€” trade off)
            detonationEnergyCost: 30,       // NEW: E Detonation โ€” ultimate burst เนเธเน focus เธชเธนเธเธชเธธเธ”
            detonationBaseDamage: 55,       // NERF: 80 โ’ 55 (เธฅเธ” base เน€เธเธทเนเธญเนเธซเน heat scaling เนเธกเนเธ—เธฐเธฅเธธ)
            detonationHeatScaling: 1.2,     // NERF: 2.5 โ’ 1.2 (Heat 100 โ’ +120 เนเธ—เธ +250)
            detonationDamageHardCap: 600,   // NEW: hard cap เธเธฑเธ RAGE+crit+charge stack เธชเธธเธ”เธเธตเธ”
            chargeDamageMultMax: 2.5,       // NERF: 3.5 โ’ 2.5 (full charge = ร—2.5 เนเธกเนเนเธเน ร—3.5)
            // เธ•เธฑเธงเธญเธขเนเธฒเธ: Heat 100, full charge โ’ 55 + (100ร—1.2) = 175 ร— 2.5 = 437 (capped 600)
            // Overheated (Heat 100) โ’ radius ร—1.5 = 360px
            // เธซเธฅเธฑเธ Detonate: Heat -80 (เน€เธเธทเธญเธ reset โ€” เธฃเธนเนเธชเธถเธ "เธฃเธฐเธเธฒเธข" เธเธฃเธดเธ)

            // โ”€โ”€ Heat Gauge (NEW SYSTEM) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // เธชเธฐเธชเธกเธเธฒเธเธเธฒเธฃเธเธ โ’ เนเธซเน bonus tier เธ•เธฒเธก heat level
            heatMax: 100,
            heatPerHit: 12,                 // +Heat เธ•เนเธญ Stand punch
            heatPerPlayerHit: 8,            // +Heat เธ•เนเธญ Stand Rush / Heat Wave
            heatPerDamageTaken: 0.5,        // +Heat เธ•เนเธญ 1 damage เธ—เธตเนเธฃเธฑเธ
            heatDecayRate: 8,               // -Heat/s เธ•เธญเธ out of Wanchai
            heatDecayRateActive: 0,         // เนเธกเน decay เธฃเธฐเธซเธงเนเธฒเธ Wanchai
            // โ”€โ”€ Heat Tier Thresholds โ”€โ”€
            // WARM (34%+): dmg ร—1.10, punch rate ร—0.92
            // HOT  (67%+): dmg ร—1.20, punch rate ร—0.85, melee range เน€เธเธดเนเธก
            // OVERHEATED (100%): dmg ร—1.30, crit +12%, hp drain 5/s, det radius ร—1.5
            heatTierWarm: 34,
            heatTierHot: 67,
            heatTierOverheat: 100,
            heatDmgWarm: 1.10,
            heatDmgHot: 1.20,
            heatDmgOverheat: 1.30,
            heatPunchRateWarm: 0.92,        // NERF: 0.85 โ’ 0.92 (compress tier gap)
            heatPunchRateHot: 0.85,         // NERF: 0.70 โ’ 0.85 (slower punch, OVERHEAT uses this too)
            heatCritBonusOverheat: 0.12,
            heatHpDrainOverheat: 8,         // NERF: 3 โ’ 5 โ’ 8 HP/s (overheat เน€เธเนเธ risk เธเธฃเธดเธ โ€” เธ•เนเธญเธเธฃเธฐเธงเธฑเธ)
            heatOnKillWanchai: 15,          // +Heat เธ•เนเธญเธเธฒเธฃเธเนเธฒเธเธ“เธฐ Wanchai active
            heatHealOnKillWanchai: 0.03,    // NERF: 0.08 โ’ 0.05 โ’ 0.03 (heal เธ•เนเธญ kill เธฅเธ”เธฅเธ เธเธนเนเน€เธฅเนเธเนเธกเนเธเธงเธฃ full heal เธเธฒเธเธเธฒเธฃเธเนเธฒ)

            // โ”€โ”€ Crit & Scaling โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            baseCritChance: 0.06,
            critMultiplier: 2.2,            // 2.0 โ’ 2.2

            // โ”€โ”€ Stealth (disabled for Auto) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            stealthCooldown: 12,
            stealthCost: 9999,
            stealthDrain: 0,
            stealthSpeedBonus: 1.0,

            // โ”€โ”€ Level Scaling โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            expToNextLevel: 100,
            expLevelMult: 1.30,     // BIG-BALANCE: 1.5 โ’ 1.30 โ€” player reaches Lv12 at W15 (was Lv9)
            damageMultiplierPerLevel: 0.06, // BALANCE: 0.10 โ’ 0.12 โ’ 0.08 โ’ 0.06
            cooldownReductionPerLevel: 0.04,
            maxHpPerLevel: 10,              // BALANCE: 14 โ’ 16 โ’ 10

            // โ”€โ”€ Passive: SCORCHED SOUL โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // Unlock: เธ–เธถเธ OVERHEAT เธเธฃเธฑเนเธเนเธฃเธ (เน€เธเธฅเธตเนเธขเธเธเธฒเธ Lv5 เน€เธเธทเนเธญ thematic)
            passiveUnlockLevel: 5,          // fallback เน€เธ—เนเธฒเธเธฑเนเธ โ€” เนเธกเนเนเธ”เนเนเธเนเธเธฃเธดเธเนเธฅเนเธง
            passiveUnlockStealthCount: 0,   // เนเธกเนเนเธเน stealth โ€” unlock via OVERHEAT
            passiveHpBonusPct: 0.20,
            passiveUnlockText: '๐’ฅ เธงเธฑเธเธเธฑเธขเนเธญเน€เธงเธญเธฃเนเนเธ”เธฃเธเน!',
            passiveCritBonus: 0.06,         // 0.04 โ’ 0.06
            passiveLifesteal: 0.025,        // 0.01 โ’ 0.025 (brawler identity)
            passiveHeatGainBonus: 1.20,     // NERF: 1.50 โ’ 1.20 (เธเธฑเธ permanent OVERHEAT loop)
            passiveHeatNoDecayOnMove: false, // NERF: เธเธดเธ” โ€” passive เนเธกเนเธขเธเน€เธฅเธดเธ decay เธเธ“เธฐเน€เธ”เธดเธ (OVERHEAT เนเธกเนเธเธงเธฃเธเธฃเธต)
            vacuumEarlyUnlock: true,        // NEW: Vacuum เธเธฅเธ”เธเธฃเนเธญเธก Wanchai (เธ•เนเธเน€เธเธก) เนเธกเนเธฃเธญ passive

            // โ”€โ”€ RAGE MODE: OVERHEAT + HP < 30% โ’ damage buff + damage reduction โ”€โ”€
            // High-risk-high-reward โ€” เธขเธดเนเธเนเธเธฅเนเธ•เธฒเธขเธขเธดเนเธเธญเธฑเธเธ•เธฃเธฒเธข
            rageModeHpThreshold: 0.30,      // HP % เธ—เธตเน trigger Rage Mode
            rageDamageMult: 1.30,           // เธ”เธฒเน€เธกเธ ร—1.3 เธเธ“เธฐ Rage
            rageDamageReduction: 0.20,      // เธฃเธฑเธเธ”เธฒเน€เธกเธเธเนเธญเธขเธฅเธ 20% เธเธ“เธฐ Rage

            // โ”€โ”€ Speed on Hit โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            speedOnHit: 15,
            speedOnHitDuration: 0.35,

            // โ”€โ”€ Feature 1: Heat System Overhaul โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // COLD tier penalty (heat < heatTierWarm)
            coldDamageMult: 0.75,       // NERF: 0.70 โ’ 0.75 (cold not overly punishing)
            coldSpeedMult: 0.90,        // move speed ร—0.90 เธเธ“เธฐ COLD
            // Heat idle decay (2s เนเธกเน hit โ’ heat เธซเธฒเธข)
            heatIdleDecayRate: 8,       // heat/s เน€เธกเธทเนเธญเนเธกเน hit เธเธฒเธ 2s
            heatIdleDecayDelay: 2.0,    // เธงเธดเธเธฒเธ—เธตเธเนเธญเธ idle decay เน€เธฃเธดเนเธก
            // Vent Explosion เน€เธกเธทเนเธญ OVERHEAT tier drop โ’ tier 2
            ventExplosionRange: 160,    // AOE radius
            ventExplosionDamage: 45,    // base damage

            // โ”€โ”€ Feature 2: Rage Engine / Killing Blow Supercharge โ”€
            heatOnKillSupercharge: 30,  // heat bonus เน€เธกเธทเนเธญ kill เธเธ“เธฐ combo >= 5
            oraComboSuperchargeMin: 5,  // minimum combo เธชเธณเธซเธฃเธฑเธ supercharge

            // โ”€โ”€ Feature 3A: Stand Pull (Q เธเธ“เธฐ Wanchai) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            standPullRange: 380,        // pull range เธฃเธญเธ Stand
            standPullDamage: 18,        // damage เธ•เนเธญ enemy เธ—เธตเนเธ–เธนเธ pull

            // โ”€โ”€ Feature 3B: Charge Punch (E hold เธเธ“เธฐ Wanchai) โ”€
            chargeMaxTime: 1.5,         // เธงเธดเธเธฒเธ—เธตเธเธฒเธฃเนเธเน€เธ•เนเธก
            chargeDamageMultMax: 2.5,   // NERF: 3.5 โ’ 2.5 (sync เธเธฑเธ detonation section)
            chargeRangeMultMax: 1.3,    // max range multiplier เธ—เธตเนเธเธฒเธฃเนเธเน€เธ•เนเธก

            // โ”€โ”€ Feature 3C: Stand Guard (Shift เธเธ“เธฐ Wanchai) โ”€โ”€โ”€
            standGuardReduction: 0.60,  // damage reduction เธ”เนเธฒเธเธซเธเนเธฒ 60%
            vacuumEarlyHeatGain: 10,     // heat เธ—เธตเนเนเธ”เนเธเธฒเธ vacuum เธเนเธญเธ passive เธเธฅเธ” (earlyMode)

            // โ”€โ”€ Feature 4: Stand Meter (เนเธ—เธ Timer) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            standMeterMax: 100,
            standMeterDrainRate: 8,     // meter/s เธเธ“เธฐ Wanchai active
            standMeterPerHit: 1,        // NERF: 4 โ’ 1 (fix infinite stand loop at OVERHEAT)
            standMeterOnKill: 8,        // DEBT-FIX: 12 โ’ 8 โ€” break-even normal=1.0 kills/s, HOT=2.0 kills/s (เนเธกเน infinite เนเธฅเนเธง)
            standMeterDrainCold: 3.0,   // NERF: 1.30 โ’ 3.0 (COLD = real penalty, max ~6s)
            standMeterDrainOverheat: 2.0, // NERF: 0.50 โ’ 2.0 (drain faster, net 7.5/s โ’ max 13s alone)
            // โ”€โ”€ AbilityUnlock thresholds โ”€โ”€
            su1MeleeDmgReq: 400,        // SU1: total L-Click rush damage to unlock Q full vacuum
            su2OraComboCount: 3,        // SU2: times ORA combo must reach x8 to unlock E detonation
        },
        poom: {
            name: 'Poom',
            radius: 20,
            hp: 130, maxHp: 130,
            energy: 100, maxEnergy: 100,
            energyRegen: 12,
            moveSpeed: 298,
            dashSpeed: 520,
            dashDistance: 170,
            dashCooldown: 1.65,
            expToNextLevel: 100,
            expLevelMult: 1.30,     // BIG-BALANCE: 1.5 โ’ 1.30 โ€” player reaches Lv12 at W15 (was Lv9)
            riceDamage: 62,
            riceCooldown: 0.42,
            riceSpeed: 600,
            riceRange: 750,
            riceColor: '#ffffff',
            critChance: 0.12,
            critMultiplier: 3,
            eatRiceCooldown: 10,
            eatRiceEnergyCost: 15,          // NEW: R-Click EatRice โ€” heal + speed buff เนเธเน focus เน€เธฅเนเธเธเนเธญเธข
            eatRiceDuration: 6,
            eatRiceSpeedMult: 1.3,
            eatRiceCritBonus: 0.12,
            nagaCooldown: 22,        // NERF: 20 โ’ 22 (uptime 45% โ’ 41% โ€” เธขเธฑเธเธ”เธตเธญเธขเธนเนเนเธ•เนเธ•เนเธญเธเธเธฑเธ”เธเธฒเธฃ)
            nagaDuration: 9,         // NERF: 10 โ’ 9 (Cosmic window เนเธเธเธฅเธ โ€” เธ•เนเธญเธเธงเธฒเธ Garuda เนเธซเน sync)
            nagaEnergyCost: 25,      // NEW: Q Naga โ€” summon เธเธเธฒเธเธฒเธ เธ•เนเธญเธเนเธเน focus
            nagaDamage: 100,         // BUFF: 95 โ’ 100
            nagaSpeed: 525,
            nagaSegments: 18,        // BUFF: 12 โ’ 18 (เธเธนเธขเธฒเธงเธเธถเนเธเธเธฑเธ”เน€เธเธ)
            nagaSegmentDistance: 32, // BUFF: 28 โ’ 32 (เธฃเธฐเธขเธฐเธซเนเธฒเธ segment เธกเธฒเธเธเธถเนเธ โ’ เธ•เธฑเธงเธขเธฒเธงเธเธถเนเธ)
            nagaRadius: 22,          // BUFF: 20 โ’ 22 (เธ•เธฑเธงเธซเธเธฒเธเธถเนเธเน€เธฅเนเธเธเนเธญเธข)
            speedOnHit: 18,
            speedOnHitDuration: 0.35,
            damageMultiplierPerLevel: 0.065,  // BALANCE: 0.07 โ’ 0.11 โ’ 0.09 โ’ 0.065
            cooldownReductionPerLevel: 0.05,  // BUFF: 0.04 โ’ 0.05
            maxHpPerLevel: 7,                // BALANCE: 7 โ’ 10 โ’ 7
            // โ”€โ”€ Passive Skill (Ritual Mastery) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // Unlock: เธ—เธณ Ritual Burst เธเธฃเธฑเนเธเนเธฃเธ (เน€เธเธฅเธตเนเธขเธเธเธฒเธ Lv4 เน€เธเธทเนเธญ thematic)
            passiveUnlockLevel: 4,          // fallback เน€เธ—เนเธฒเธเธฑเนเธ โ€” เนเธกเนเนเธ”เนเนเธเนเธเธฃเธดเธเนเธฅเนเธง
            passiveUnlockStealthCount: 0,   // เนเธกเนเนเธเน stealth โ€” unlock via Ritual
            passiveHpBonusPct: 0.28,        // BALANCE: 0.30 โ’ 0.45 โ’ 0.28
            passiveUnlockText: '๐พ เธฃเธฒเธเธฒเธญเธตเธชเธฒเธ!',
            passiveCritBonus: 0.06,         // BUFF: 0.04 โ’ 0.06 (เน€เธ—เนเธฒ Auto)
            passiveLifesteal: 0.025,        // BUFF: 0.015 โ’ 0.025 (เธฃเธนเนเธชเธถเธเนเธ”เนเธเธฃเธดเธ)
            // โ”€โ”€ Cosmic Balance bonus โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            cosmicDamageMult: 1.25,           // NERF: 1.35 โ’ 1.25 (cosmic bonus -7%)
            cosmicHpRegen: 6,                 // BUFF: 4 โ’ 6 HP/s
            cosmicStickyDurationBonus: 1.0,   // NEW: +1.0s เธ•เนเธญ sticky stack duration เธเธ“เธฐ Cosmic active
            // โ”€โ”€ Sticky Rice Stack System โ”€โ”€
            sticky: {
                maxStacks: 5,
                stackDuration: 1.5,     // Phase 4: 1.0 โ’ 1.5 (allows ~3 stacks, gives decision window)
                slowPerStack: 0.04,
                maxSlowDuration: 1.5
            },
            // โ”€โ”€ Fragment System (Eat Rice Enhancement) โ”€โ”€
            fragment: {
                count: 2,
                damagePct: 0.5,
                bounces: 1,
                bossReflectionMultiplier: 1.35
            },
            // โ”€โ”€ Garuda Summon (E) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            garudaCooldown: 24,             // NERF: 22 โ’ 24 (Cosmic Balance เธ•เนเธญเธเนเธเนเธ—เธฑเธเธฉเธฐเนเธเธเธฒเธฃ sync)
            garudaEnergyCost: 30,           // NEW: E Garuda โ€” summon เธเธฃเธธเธ‘ เนเธเน focus เธชเธนเธเธชเธธเธ”เธเธญเธ Poom
            garudaDuration: 9,              // BUFF: 6 โ’ 9 (uptime 24% โ’ 41%)
            garudaDamage: 120,
            garudaOrbitRadius: 120,
            garudaOrbitSpeed: 2.2,
            garudaDiveCooldown: 1.8,
            garudaDiveSpeed: 820,
            garudaReturnSpeed: 620,
            garudaEatRiceBonus: 1.5,
            // โ”€โ”€ Cosmic Balance (Naga + Garuda active simultaneously) โ”€โ”€
            // cosmicDamageMult เธขเนเธฒเธขเธเธถเนเธเนเธเธญเธขเธนเนเนเธ Passive Skill section เนเธฅเนเธง
            nagaIgniteDuration: 0.8,        // ignite duration เน€เธกเธทเนเธญ Naga hit เธเธ“เธฐ Cosmic Balance
            cosmicNagaBurnDPS: 30,          // BUFF: 22 โ’ 30
            cosmicGarudaRadiusMult: 1.5,
            // โ”€โ”€ Ritual Boss Damage Cap โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            ritualBossDmgCapPct: 0.35,       // single ritual burst cap = 35% boss maxHP
            ritualBossDmgCapCosmicPct: 0.45, // cap เธเธ“เธฐ Cosmic Balance active
            // โ”€โ”€ AbilityUnlock thresholds โ”€โ”€
            su1StickyTargetReq: 10,     // SU1: unique enemies hit with sticky to unlock Q+R
            su2RitualMultiHitReq: 1,    // SU2: times Ritual hits 4+ enemies to unlock E
            specialRitualDmgReq: 5000,  // Special: total Ritual damage to unlock bonus
        },
        pat: {
            name: 'Pat',
            radius: 17,                     // เน€เธ•เธตเนเธขเธเธงเนเธฒ โ€” hitbox เน€เธฅเนเธเธเธงเนเธฒ auto/poom

            // โ”€โ”€ Base Stats โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            hp: 112, maxHp: 112,            // BALANCE: 140 โ’ 112 (glass cannon)
            energy: 100, maxEnergy: 100,
            energyRegen: 18,
            moveSpeed: 285,                 // เธเธฒเธเธเธฅเธฒเธ (Kao 298, Auto 260)
            dashSpeed: 530,
            dashDistance: 175,
            dashCooldown: 1.6,

            // โ”€โ”€ Katana โ€” Primary Weapon โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            weapons: {
                katana: {
                    name: 'KATANA',
                    damage: 42,             // BIG-BALANCE: 34 โ’ 42 (+23%) โ€” Ranged DPS 99โ’146
                    cooldown: 0.32,         // BIG-BALANCE: 0.38 โ’ 0.32 (tighter rhythm)
                    range: 750,             // slash wave range
                    speed: 820,             // projectile speed
                    color: '#7ec8e3',       // ice blue
                    icon: '๐”ต'
                }
            },

            // โ”€โ”€ Dual Mode โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            meleeRange: 150,                // เธฃเธฐเธขเธฐ switch โ’ melee combo
            meleeDamageMulti: 2.0,          // BIG-BALANCE: 1.8 โ’ 2.0 (melee DPS 168โ’198, post-passive ~215)
            meleeComboHits: 3,              // 3-hit combo
            meleeComboWindow: 0.18,         // เธงเธดเธเธฒเธ—เธตเธ•เนเธญ hit เนเธ combo
            meleeCooldown: 0.55,            // cooldown เธซเธฅเธฑเธ combo เธเธ

            // โ”€โ”€ Crit & Scaling โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            baseCritChance: 0.08,
            critMultiplier: 2.4,

            // โ”€โ”€ Blade Guard (R-Click) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            bladeGuardSpeedMult: 0.6,       // speed ร— 0.6 เธเธ“เธฐเธเธ”เธเนเธฒเธ
            bladeGuardMaxDuration: 3.0,     // max 3s เธ•เนเธญเธเธฃเธฑเนเธ
            bladeGuardCooldown: 5.0,        // เธซเธฅเธฑเธ duration เธซเธกเธ”
            bladeGuardReflectRadius: 55,    // hitbox reflect เธฃเธญเธเธ•เธฑเธง

            // โ”€โ”€ Zanzo Flash (Q) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            qEnergyCost: 22,
            zanzoRange: 280,                // max teleport distance
            zanzoCooldown: 7.0,
            zanzoLandingRange: 120,         // radius เน€เธเนเธ enemy เธซเธฅเธฑเธเธฅเธเธเธญเธ”
            zanzoCritBonus: 0.40,           // +40% crit chance เธเธ“เธฐ ambush window
            zanzoAmbushWindow: 1.5,         // เธงเธดเธเธฒเธ—เธต window เธซเธฅเธฑเธ blink
            zanzoGhostCount: 4,             // afterimage เธเธณเธเธงเธ ghost sprites
            zanzoGhostFadeDur: 0.35,        // เธงเธดเธเธฒเธ—เธต ghost fade out

            // โ”€โ”€ Iaido Strike (R) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            rEnergyCost: 40,
            iaidoRange: 400,                // max dash distance
            iaidoCooldown: 14.0,
            iaidoChargeDuration: 0.6,       // Phase 1 charge time
            iaidoDamage: 180,               // BIG-BALANCE: 160 โ’ 180 (single target burst reward)
            iaidoCritMulti: 3.5,            // crit multiplier เน€เธเธเธฒเธฐ Iaido
            iaidoFreezeDuration: 0.5,       // Phase 3 cinematic freeze (TimeManager)
            iaidoBloodParticles: 18,        // blood burst particle count

            // โ”€โ”€ Level Scaling โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            expToNextLevel: 100,
            expLevelMult: 1.30,     // BIG-BALANCE: 1.5 โ’ 1.30 โ€” player reaches Lv12 at W15 (was Lv9)
            damageMultiplierPerLevel: 0.065,
            cooldownReductionPerLevel: 0.04,
            maxHpPerLevel: 5,

            // โ”€โ”€ Passive: RONIN'S EDGE โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // Unlock: เนเธเน Iaido เธชเธณเน€เธฃเนเธ (เนเธ”เธ enemy) เธเธฃเธฑเนเธเนเธฃเธ
            passiveUnlockLevel: 3,          // fallback
            passiveUnlockStealthCount: 0,
            passiveHpBonusPct: 0.25,
            passiveUnlockText: 'โ”๏ธ Ronin-Edge!',
            passiveCritBonus: 0.05,
            passiveLifesteal: 0.02,
            passiveMeleeDmgBonus: 0.15,     // melee damage +15% เธซเธฅเธฑเธ passive เธเธฅเธ”

            // โ”€โ”€ Speed on Hit โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            speedOnHit: 18,
            speedOnHitDuration: 0.38,

            // โ”€โ”€ Blade Guard Reflect (R-Click hold) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // reflectDamageMult เนเธซเธกเน: 2.0 (เน€เธ”เธดเธกเน€เธเธตเธขเธ 1.2 hardcode เนเธ tryReflectProjectile)
            reflectDamageMult: 2.0,

            // โ”€โ”€ Perfect Parry (R-Click tap < perfectParryWindow เธงเธดเธเธฒเธ—เธต) โ”€โ”€
            // tap เนเธ—เธเธ—เธตเนเธเธฐ hold โ’ reflect ร—4 + energy restore + i-frame เธชเธฑเนเธ
            // เธเธฐเน€เธงเธฅเธฒเธเธฅเธฒเธ” = Blade Guard เนเธกเนเธ—เธณเธเธฒเธ + cooldown เน€เธ•เนเธก
            perfectParryWindow: 0.15,           // เธงเธดเธเธฒเธ—เธต: tap เธ•เนเธญเธเธชเธฑเนเธเธเธงเนเธฒเธเธตเนเธเธถเธเน€เธเนเธ Perfect Parry
            perfectParryReflectMult: 4.0,       // reflect damage ร—4 (vs hold ร—2)
            perfectParryEnergyRestore: 20,      // energy เธเธทเธเน€เธกเธทเนเธญ parry เธชเธณเน€เธฃเนเธ
            perfectParryIFrameDur: 0.4,         // i-frame เธงเธดเธเธฒเธ—เธตเธซเธฅเธฑเธ Perfect Parry
            perfectParryScreenFreeze: 0.05,     // TimeManager.setBulletTime() duration

            // โ”€โ”€ Iaido Strike โ€” Boss Hit & Point-Blank Execute โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // point-blank = Pat เธซเธขเธธเธ”เธ—เธตเนเธฃเธฐเธขเธฐ โค iaidoPointBlankRange px เธเธฒเธ target
            iaidoPointBlankRange: 45,           // px โ€” threshold execute range
            iaidoPointBlankDmgMult: 2.0,        // dmg ร—2 เธ–เนเธฒ point-blank
            iaidoPointBlankIFrameDur: 1.5,      // เธงเธดเธเธฒเธ—เธต เธญเธกเธ•เธฐเธซเธฅเธฑเธ point-blank hit

            // โ”€โ”€ Iaido Cinematic โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // (เนเธเนเธญเธขเธนเนเนเธฅเนเธงเนเธ _tickIaido เนเธ•เนเธญเนเธฒเธเธเธฒเธ this.stats โ€” เน€เธเธดเนเธกเนเธซเนเธเธฃเธ)
            iaidoCinematicDur: 0.55,

            // โ”€โ”€ AbilityUnlock thresholds โ”€โ”€
            su1IaidoHitReq: 3,         // SU1: Iaido hits to unlock Q Zanzo Flash
            su2ReflectReq: 2,          // SU2: reflects to unlock Perfect Parry timing window
            specialParryReq: 5,        // Special: total Perfect Parries for energy bonus
            passiveSequenceWindow: 10.0, // seconds for Parry->Zanzo->Iaido passive sequence
            // โ”€โ”€ DeadlyGraph Reflect โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // เธฃเธฐเธขเธฐเธ—เธตเน Pat เธ•เนเธญเธเธญเธขเธนเนเนเธเธฅเนเนเธเธงเธเธฃเธฒเธเน€เธเธทเนเธญ reflect เนเธ”เน
            graphReflectRange: 80,              // px เธเธฒเธ midpoint เธเธญเธ beam
            graphReflectDamageMult: 2.0,        // damage ร—2 เธซเธฅเธฑเธ reflect เธเธฅเธฑเธ
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
        // โ”€โ”€ Overdrive Stats โ”€โ”€
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
        baseHp: 40, hpPerWave: 0.19,  // REBALANCE: 0.16 โ’ 0.19 (Wave15 ~490HP เนเธ—เธ ~410HP โ€” เธขเธฑเธเนเธกเน infinite เนเธ•เนเธฃเธนเนเธชเธถเธเนเธ”เน)
        baseSpeed: 85, speedPerWave: 6,
        baseDamage: 8, damagePerWave: 1.4,  // REBALANCE: 1.2 โ’ 1.4 (Wave15 damage ~28 เนเธ—เธ ~24 โ€” เธ•เนเธญเธเธซเธฅเธ)
        shootCooldown: [2.5, 4.5],
        shootRange: 550
    },
    tank: {
        radius: 25,
        color: '#78716c',
        expValue: 45,
        powerupDropMult: 1.5,
        baseHp: 100, hpPerWave: 0.20,  // BIG-BALANCE: 0.23 โ’ 0.20 (W15 Tank HP ~1350 เธเธฒเธ 1814 โ€” Kao TTK 5.5s เนเธ—เธ 8.3s)
        baseSpeed: 60, speedPerWave: 3,
        baseDamage: 18, damagePerWave: 2.5,  // NERF: 3 โ’ 2.5 (melee damage was too punishing)
        meleeRange: 55
    },
    mage: {
        radius: 16,
        color: '#a855f7',
        expValue: 55,
        powerupDropMult: 1.3,
        orbitDistance: 300,
        orbitDistanceBuffer: 100,
        baseHp: 28, hpPerWave: 0.22,  // BIG-BALANCE: 0.25 โ’ 0.22 (W15 Mage HP ~470 เธเธฒเธ 637 โ€” glass cannon identity เธเธเนเธงเน)
        baseSpeed: 70, speedPerWave: 5,
        baseDamage: 12, damagePerWave: 1.8,
        soundWaveCooldown: 10,
        soundWaveRange: 300,
        soundWaveConfuseDuration: 0.6,  // NERF: 0.8 โ’ 0.6 (confusion was too long)
        meteorCooldown: 13,
        meteorDamage: 24,  // NERF: 28 โ’ 24 (meteor spam was too strong)
        meteorBurnDuration: 3,
        meteorBurnDPS: 4.0  // NERF: 4.5 โ’ 4.0
    },
    enemies: {
        sniper: {
            radius: 17,
            color: '#60a5fa',
            expValue: 70,
            personality: 'sniper',
            squadRole: 'anchor',
            category: 'anchor',
            baseHp: 34, hpPerWave: 0.19,
            baseSpeed: 72, speedPerWave: 4,
            baseDamage: 26, damagePerWave: 2.0,
            minRange: 260,
            preferredRange: 680,
            shootRange: 980,
            projectileSpeed: 980,
            chargeTime: 0.65,
            cooldown: [3.4, 4.6],
            aimLeadMax: 0.30,
            alignCos: 0.972,
            telegraphLength: 260
        },
        shield_bravo: {
            radius: 24,
            color: '#94a3b8',
            expValue: 78,
            personality: 'anchor',
            squadRole: 'anchor',
            category: 'anchor',
            baseHp: 135, hpPerWave: 0.21,
            baseSpeed: 58, speedPerWave: 3,
            baseDamage: 18, damagePerWave: 2.2,
            meleeRange: 62,
            frontReduction: 0.45,
            frontArcCos: 0.26
        },
        poison_spitter: {
            radius: 18,
            color: '#22c55e',
            expValue: 66,
            personality: 'anchor',
            squadRole: 'anchor',
            category: 'anchor',
            hazard: true,
            baseHp: 42, hpPerWave: 0.18,
            baseSpeed: 74, speedPerWave: 4,
            baseDamage: 5, damagePerWave: 0.5,
            preferredRange: 460,
            spitRange: 760,
            cooldown: 4.8,
            poolRadius: 86,
            poolDuration: 3.6,
            poolDamagePerSec: 12,
            maxPools: 3,
            minPoolSpacing: 150
        },
        charger: {
            radius: 19,
            color: '#f97316',
            expValue: 64,
            personality: 'pressure',
            squadRole: 'pressure',
            category: 'pressure',
            baseHp: 58, hpPerWave: 0.18,
            baseSpeed: 92, speedPerWave: 5,
            baseDamage: 20, damagePerWave: 1.8,
            chargeMinRange: 120,
            chargeMaxRange: 420,
            windup: 0.34,
            chargeDuration: 0.20,
            recovery: 0.62,
            chargeSpeed: 500,
            idleDelay: [0.95, 1.35]
        },
        hunter: {
            radius: 20,
            color: '#f43f5e',
            expValue: 72,
            personality: 'pressure',
            squadRole: 'pressure',
            category: 'pressure',
            baseHp: 72, hpPerWave: 0.18,
            baseSpeed: 98, speedPerWave: 5,
            baseDamage: 24, damagePerWave: 2.2,
            lockRange: 820,
            attackRange: 46,
            attackCooldown: 1.15,
            telegraphTime: 0.18
        },
        fatality_bomber: {
            radius: 21,
            color: '#f59e0b',
            expValue: 68,
            personality: 'pressure',
            squadRole: 'pressure',
            category: 'pressure',
            hazard: true,
            baseHp: 64, hpPerWave: 0.19,
            baseSpeed: 54, speedPerWave: 3,
            baseDamage: 8, damagePerWave: 0.6,
            explosionRadius: 160,
            explosionDelay: 0.72,
            explosionDamage: 38
        },
        healer: {
            radius: 17,
            color: '#34d399',
            expValue: 74,
            personality: 'support',
            squadRole: 'support',
            category: 'support',
            support: true,
            baseHp: 34, hpPerWave: 0.18,
            baseSpeed: 70, speedPerWave: 4,
            baseDamage: 4, damagePerWave: 0.3,
            healRange: 320,
            healAmount: 16,
            healCooldown: 3.2,
            healThreshold: 0.78
        },
        summoner: {
            radius: 18,
            color: '#a78bfa',
            expValue: 82,
            personality: 'support',
            squadRole: 'support',
            category: 'support',
            support: true,
            baseHp: 40, hpPerWave: 0.18,
            baseSpeed: 68, speedPerWave: 4,
            baseDamage: 5, damagePerWave: 0.4,
            summonCooldown: 6.0,
            summonRange: 260,
            summonEngageRange: 620,
            maxMinions: 2
        },
        buffer: {
            radius: 17,
            color: '#38bdf8',
            expValue: 76,
            personality: 'support',
            squadRole: 'support',
            category: 'support',
            support: true,
            baseHp: 38, hpPerWave: 0.18,
            baseSpeed: 70, speedPerWave: 4,
            baseDamage: 4, damagePerWave: 0.3,
            buffRadius: 235,
            buffCooldown: 4.8,
            buffDuration: 2.1,
            maxBuffTargets: 3,
            speedMult: 1.14,
            damageMult: 1.18
        },
        summon_minion: {
            radius: 13,
            color: '#c084fc',
            expValue: 10,
            personality: 'pressure',
            squadRole: 'pressure',
            category: 'pressure',
            baseHp: 18, hpPerWave: 0.12,
            baseSpeed: 118, speedPerWave: 4,
            baseDamage: 9, damagePerWave: 0.8,
            meleeRange: 30,
            lifetime: 10
        }
    },
    boss: {
        radius: 50,
        // MTC Room occupies y: -700 to -460 (h=240). Keep boss spawn clear below it.
        spawnY: -330,
        contactDamage: 38,           // BUFF: 30โ’38 (+27% เน€เธเธดเนเธกเธเธงเธฒเธกเธญเธฑเธเธ•เธฃเธฒเธข)
        speechInterval: 10,
        nextWaveDelay: 2000,
        log457HealRate: 0.06,
        chalkProjectileSpeed: 600,
        attackFireRate: 0.1,
        phase2AttackFireRate: 0.05,
        ultimateProjectileSpeed: 400,
        baseHp: 5200,
        hpMultiplier: 1.32,      // REBALANCE: 1.28 โ’ 1.32 (Enc5 ~15,000 HP โ€” boss เธเธงเธฃเธฃเธนเนเธชเธถเธ epic)
        moveSpeed: 140,
        phase2Speed: 190,
        phase2Threshold: 0.5,   // fallback (overridden per-encounter in KruManop constructor)
        // Per-encounter phase thresholds โ€” enc 1 triggers phase2 early so wave-3 players see dog
        phase2ThresholdByEnc: [null, 0.50, null, 0.60, null, 0.65], // index = encounter (1-based)
        phase3ThresholdByEnc: [null, null, null, 0.30, null, 0.35],
        chalkDamage: 16,            // BUFF: 13โ’16 (+23%)
        ultimateDamage: 44,          // BUFF: 35โ’44 (+26%)
        ultimateBullets: 20,
        phase2UltimateBullets: 28,
        slamDamage: 75,             // BUFF: 60โ’75 (+25%)
        slamRadius: 360,
        slamCooldown: 14,
        graphDamage: 88,            // BUFF: 70โ’88 (+26%)
        graphLength: 1600,
        graphDuration: 20,
        graphCooldown: 16,
        matrixGridCooldown: 22.0,
        log457ChargeDuration: 2,
        log457ActiveDuration: 6,
        log457StunDuration: 1.2,
        log457Cooldown: 30,
        log457AttackBonus: 0.09,
        log457AttackGrowth: 0.04,
        // burst armor: เน€เธกเธทเนเธญ HP เธ•เนเธณเธเธงเนเธฒเธเนเธฒเธเธตเน เธฅเธ”เธ”เธฒเน€เธกเธเน€เธเนเธฒ
        burstArmorThresholdPct: 0.30,
        burstArmorReduction: 0.40,
        burstArmorDuration: 4.0,
        burstArmorCooldown: 25,
        phase2: {
            barkDamage: 40,           // BUFF: 32โ’40 (+25%)
            barkRange: 600,
            barkCooldown: 3.2,
            enrageSpeedMult: 2.0,
            dogColor: '#d97706',
            // โ”€โ”€ ChalkWall โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            chalkWallCooldown: 12.0,
            chalkWallDamage: 15,        // damage on contact per crossing
            chalkWallLength: 340,       // world-unit line length
            chalkWallDuration: 6.0,     // seconds the wall persists
            // โ”€โ”€ DogPackCombo โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            dogPackCooldown: 18.0,      // minimum gap between combos
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
            hpBaseMult: 0.72,       // BUFF: 0.62 โ’ 0.72 (Wave6 HP: 6448โ’7488, mid-game boss เธเธงเธฃเธซเธเธฑเธเธเธถเนเธ)
            advancedHpMult: 0.85,   // NERF: 1.35 โ’ 0.85 (Wave12 HP: 17410โ’12730, TTK 46sโ’40s)
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
            dangerPctMax: 0.84,
            // โ”€โ”€ Phase 3 Rework: Sub-phase A / B / C โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // subPhase A (cycles 1-2): EQUATION RAIN โ€” longer warn, overlay
            subPhaseA_warnDur: 2.0,
            // subPhase B (cycles 3-4): LOG457 OVERDRIVE โ€” faster danger%, chalk volley, safe cell shifts
            subPhaseB_dangerPctStep: 0.06,  // default 0.04 โ’ faster
            subPhaseB_chalkInterval: 0.8,   // s between 3-way chalk volleys
            subPhaseB_chalkCount: 3,
            subPhaseB_chalkSpeed: 460,
            subPhaseB_chalkDamage: 18,
            subPhaseB_safeCellShift: true,
            // subPhase C (cycles 5-6): DOMAIN COLLAPSE โ€” TeacherFury chance
            subPhaseC_teacherFuryChance: 0.30,
        },
        // โ”€โ”€ KruFirst Domain Expansion: GRAVITATIONAL SINGULARITY โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        gravitationalSingularity: {
            castDur: 2.5,   // casting phase duration (s)
            endDur: 2.0,   // ending fade-out (s)
            cooldown: 999,   // effectively once per fight
            pullDur: 4.0,   // Pulse 1: gravity pull toward boss
            escapeDur: 4.5,   // Pulse 2: push outward (near boss = safe)
            tidalDur: 4.5,   // Pulse 3: oscillating pull/push
            collapseDur: 2.5,   // Pulse 4: massive pull + shockwave
            pullForce: 95,    // px/s player pull force (Pulse 1)
            pushForce: 130,   // px/s push force (Pulse 2)
            tidalForce: 110,   // px/s tidal magnitude (Pulse 3)
            tidalPeriod: 3.0,   // s per pullโ’push cycle (Pulse 3)
            collapseForce: 220,   // px/s ramp pull (Pulse 4)
            projPullForce: 60,    // px/s projectile bend (Pulse 1)
            orbitalCount: 6,     // OrbitalDebris projectiles
            orbitalRadius: 90,    // px orbit radius
            orbitalSpeed: 2.2,   // rad/s
            orbitalDamage: 25,    // contact damage per hit
            pulse2FireCd: 1.2,   // s between boss teleport+fire bursts
            pulse2Teleports: 4,     // teleport count in Pulse 2
            pulse3ZoneCount: 3,     // PhysicsFormulaZone drops in Pulse 3
            collapseRadius: 380,   // AoE shockwave radius
            collapseDamage: 40,    // shockwave damage
            safeRadius: 75,    // px near boss = safe from push (Pulse 2)
            // โ”€โ”€ Proximity Punishment (anti-hug mechanics) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            // Prevents player from standing next to boss to avoid gravity damage.
            // Active on PULL, TIDAL, COLLAPSE โ€” NOT on ESCAPE (safeRadius intentional).
            contactRadius: 70,    // px โ€” within this = contact damage tick + repulsion
            contactDPS: 18,       // damage per second (applied in ticks every contactTickCd s)
            contactTickCd: 0.7,   // s cooldown between contact damage ticks
            repulseForce: 260,    // px/s outward push when inside contactRadius
            // โ”€โ”€ Collapse Inner Ring โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            collapseInnerRadius: 110,   // inner ring AoE (higher damage, smaller)
            collapseInnerDamage: 65,    // damage for players inside inner ring at collapse
        },
    },
    powerups: {
        radius: 20,
        dropRate: 0.18,  // BUFF: 0.15 โ’ 0.18 (more healing opportunities)
        lifetime: 14,
        healAmount: 20,
        damageBoost: 1.4,  // NERF: 1.5 โ’ 1.4 (stacking with shop was too strong)
        damageBoostDuration: 8,  // BUFF: 5 โ’ 8 (lasts longer)
        speedBoost: 1.3,  // NERF: 1.35 โ’ 1.3
        speedBoostDuration: 8  // BUFF: 5 โ’ 8
    },
    waves: {
        spawnDistance: 800,
        bossSpawnDelay: 3000,
        maxWaves: 15,       // โ extended from 9 (5 boss encounters at waves 3,6,9,12,15)
        minKillsForNoDamage: 5,
        enemiesBase: 5,  // BUFF: 4 โ’ 5 (more action early game)
        enemiesPerWave: 2.0,  // REBALANCE: 1.8 โ’ 2.0 (เธเธฅเธฑเธเธชเธนเนเธเนเธฒเน€เธ”เธดเธก โ€” late game เธเธงเธฃเธฃเธนเนเธชเธถเธเธ–เธนเธเธ—เนเธงเธก)
        enableExpandedRoster: true,
        tankSpawnChance: 0.10,  // NERF: 0.12 โ’ 0.10 (fewer tanks)
        mageSpawnChance: 0.12,  // NERF: 0.15 โ’ 0.12 (fewer mages)
        enemyPools: [
            { minWave: 1, weights: { basic: 78, tank: 10, mage: 12 } },
            { minWave: 2, weights: { basic: 58, tank: 10, mage: 12, charger: 10, poison_spitter: 5, shield_bravo: 5 } },
            { minWave: 4, weights: { basic: 42, tank: 9, mage: 11, charger: 11, hunter: 7, poison_spitter: 6, shield_bravo: 7, sniper: 4, fatality_bomber: 3 } },
            { minWave: 6, weights: { basic: 28, tank: 9, mage: 10, charger: 11, hunter: 9, poison_spitter: 6, shield_bravo: 8, sniper: 6, healer: 5, fatality_bomber: 3, summoner: 2, buffer: 3 } },
            { minWave: 9, weights: { basic: 19, tank: 8, mage: 10, charger: 11, hunter: 10, poison_spitter: 7, shield_bravo: 8, sniper: 7, healer: 5, summoner: 4, buffer: 4, fatality_bomber: 4 } },
            { minWave: 12, weights: { basic: 12, tank: 8, mage: 10, charger: 11, hunter: 11, poison_spitter: 8, shield_bravo: 8, sniper: 8, healer: 5, summoner: 5, buffer: 5, fatality_bomber: 6 } }
        ],
        expandedRosterRules: {
            maxSupportAlive: [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
            maxHazardAlive: [0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
            maxSnipersAlive: [0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2],
            maxSummonersAlive: 1,
            maxBuffersAlive: 1,
            supportMixUnlockWave: 10,
            hazardMixUnlockWave: 9
        },
        bossEveryNWaves: 3,
        glitchGracePeriod: 4000,
        // โ”€โ”€ Wave Event Configurations โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
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
        basicEnemy: 100,  // BUFF: 80 โ’ 100 (more income)
        tank: 200,  // BUFF: 160 โ’ 200
        mage: 280,  // BUFF: 220 โ’ 280
        boss: 6000,  // BUFF: 5000 โ’ 6000 (boss fights are hard)
        powerup: 120,  // BUFF: 100 โ’ 120
        achievement: 500
    },

    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    // ๐—๏ธ  MTC DATABASE SERVER โ€” location + interaction + visual
    // AdminSystem.js reads ALL values from here. Edit here only.
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    database: {
        // World position โ€” must match MAP_CONFIG.auras.database + paths.database.to
        x: 500,
        y: -490,
        interactionRadius: 90,
        // External URL opened when player presses E at database
        url: 'https://claude.ai/public/artifacts/649de47e-b97f-41ad-ae66-c944d35eb24f',
        // Proximity aura visual
        auraColor: '#06b6d4',
        auraLineWidth: 2,
        auraDash: [6, 4],
        auraAlphaMult: 0.25,
        // Glow animation
        glowColor: '#06b6d4',
        glowSpeedMs: 600,       // period of Math.sin pulse
        glowBlurMax: 14,        // shadowBlur = glowBlurMax * glow
        // Label
        labelColor: '#67e8f9',
        labelFont: 'bold 7px Arial',
        labelText: 'MTC DATABASE',
    },

    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    // ๐’  MTC CO-OP STORE โ€” location + interaction + shop mechanics
    // ShopSystem.js reads ALL values from here. Edit here only.
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    shop: {
        // World position โ€” must match MAP_CONFIG.auras.shop + paths.shop.to
        x: -500,
        y: 490,
        interactionRadius: 90,
        // Roguelite shop mechanics
        slotCount: 3,
        rerollCost: 200,
        // Proximity aura visual
        auraColor: '#facc15',
        auraLineWidth: 2,
        auraDash: [6, 4],
        auraAlphaMult: 0.30,
        // Glow + bounce animation
        glowColor: '#facc15',
        glowSpeedMs: 700,       // period of glow pulse
        glowBlurMax: 18,        // shadowBlur = glowBlurMax * glow
        bounceSpeedMs: 500,     // period of vertical bounce
        bounceAmplitude: 3,     // px
        coinBounceSpeedMs: 350, // coin bob period
        coinBounceAmplitude: 4, // px
        // Label
        labelColor: '#fbbf24',
        labelFont: 'bold 7px Arial',
        labelText: 'MTC CO-OP STORE',
    },

    mtcRoom: {
        healRate: 30,           // เธฅเธ” 40โ’30 (offset by new abilities)
        maxStayTime: 4,
        cooldownTime: 10,
        size: 300,
        // โ”€โ”€ Dash Reset โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        dashResetOnEntry: true,
        // โ”€โ”€ Crisis Protocol โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        crisisHpPct: 0.25,      // trigger เธ—เธตเน HP โค 25%
        crisisHealBonus: 35,    // instant bonus HP
        // โ”€โ”€ Rotating Buff Terminal (cycles per visit) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        // Index 0 = DMG, 1 = SPD, 2 = CDR Burst
        buffCycleDuration: [8, 6, 0],  // เธงเธดเธเธฒเธ—เธต (0 = instant)
        buffCycleMagnitude: [0.15, 0.10, 0.35],  // +15% DMG, +10% SPD, -35% CD
        buffCycleNames: ['DMG +15%', 'SPD +10%', 'CDR BURST'],
        buffCycleColors: ['#f97316', '#22d3ee', '#a78bfa'],
        buffCycleIcons: ['โ”', '๐’จ', 'โก'],
    },
    LIGHTING: {
        ambientLight: 0.72,        // เธฅเธ” 0.9โ’0.72 เน€เธเธดเนเธก drama + เธเธฃเธฃเธขเธฒเธเธฒเธจเธกเธทเธ”
        cycleDuration: 60,
        nightMinLight: 0.12,
        dayMaxLight: 0.95,
        playerLightRadius: 185,    // เน€เธเธดเนเธก 160โ’185 เธเธนเนเน€เธฅเนเธเธกเธญเธเน€เธซเนเธเธฃเธญเธเธ•เธฑเธงเนเธ”เนเนเธเธฅเธเธถเนเธ
        projectileLightRadius: 55, // เน€เธเธดเนเธก 50โ’55 เธเธฃเธฐเธชเธธเธเธชเธงเนเธฒเธเธเธถเนเธเน€เธฅเนเธเธเนเธญเธข
        mtcServerLightRadius: 140, // เน€เธเธดเนเธก 120โ’140
        shopLightRadius: 100,      // เน€เธเธดเนเธก 85โ’100
        dataPillarLightRadius: 85, // เน€เธเธดเนเธก 70โ’85 pillar เน€เธ”เนเธเธเธถเนเธ
        serverRackLightRadius: 65, // เน€เธเธดเนเธก 55โ’65
        nightR: 3, nightG: 6, nightB: 20  // เน€เธเนเธกเธเธถเนเธ เน€เธเธดเนเธก blue tint
    },
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    // ๐ค–  UTILITY AI SYSTEM โ€” enemy decision making
    // UtilityAI.js reads all values from here. Edit here only.
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    ai: {
        // How often each enemy makes a new decision (seconds)
        // 0.5 = 2Hz โ€” decoupled from 60Hz game loop
        decisionInterval: 0.5,

        // Personality weights per enemy type
        // aggression: desire to attack  (0โ€“1)
        // caution:    desire to retreat when low HP  (0โ€“1)
        // teamwork:   desire to flank when allies nearby  (0โ€“1)
        personalities: {
            basic: { aggression: 0.6, caution: 0.2, teamwork: 0.3 },
            tank: { aggression: 0.8, caution: 0.1, teamwork: 0.5 },
            mage: { aggression: 0.3, caution: 0.8, teamwork: 0.2 },
            sniper: { aggression: 0.72, caution: 0.35, teamwork: 0.20 },
            anchor: { aggression: 0.55, caution: 0.35, teamwork: 0.55 },
            pressure: { aggression: 0.92, caution: 0.08, teamwork: 0.25 },
            support: { aggression: 0.22, caution: 0.78, teamwork: 0.72 },
        },

        // Base utility weights + per-action tuning
        actions: {
            attack: { base: 1.0 },
            retreat: { base: 0.8, hpThreshold: 0.3 },  // trigger below 30% HP
            flank: { base: 0.6, optimalDist: 220 },  // best at ~220px from player
            hold_line: { base: 0.72, optimalDist: 420 },
            charge: { base: 0.92, optimalDist: 240 },
            heal_ally: { base: 0.95, allyHpThreshold: 0.78 },
            buff_ally: { base: 0.82, allyCountThreshold: 2 },
            summon: { base: 0.76, maxMinions: 3 },
            hazard_drop: { base: 0.78, optimalDist: 420 },
        },

        // Squad / ally awareness
        squad: {
            coordinationRadius: 300,  // px โ€” allies within this range count for teamwork
            squadInterval: 1.0,       // seconds between SquadAI role reassignment ticks
            roleDefaults: {
                basic: 'assault',
                tank: 'shield',
                mage: 'support',
                sniper: 'anchor',
                shield_bravo: 'anchor',
                poison_spitter: 'anchor',
                charger: 'pressure',
                hunter: 'pressure',
                fatality_bomber: 'pressure',
                healer: 'support',
                summoner: 'support',
                buffer: 'support',
                summon_minion: 'pressure'
            }
        },
    },

    map: {
        size: 3000,
        objectDensity: 0.12,
        objectTypes: ['desk', 'tree', 'server', 'datapillar', 'bookshelf', 'blackboard', 'database', 'coopstore'],
        // โ”€โ”€ Object sizes โ€” consumed by generateCampusMap() createCluster() helper โ”€โ”€
        objectSizes: {
            desk: { w: 60, h: 40 },
            tree: { w: 50, h: 50 },
            server: { w: 45, h: 80 },
            datapillar: { w: 35, h: 70 },
            bookshelf: { w: 80, h: 40 },
            vendingmachine: { w: 40, h: 70 },
        },
        wallPositions: [
            // โ”€โ”€ Arena boundary walls (cardinal) โ”€โ”€
            { x: -1500, y: -50, w: 50, h: 100 },
            { x: 1450, y: -50, w: 50, h: 100 },
            { x: -50, y: -1500, w: 100, h: 50 },
            { x: -50, y: 1450, w: 100, h: 50 },

            // โ”€โ”€ Corridor walls: Server Farm entrance (East) โ”€โ”€
            // เธ–เธญเธขเธญเธญเธเนเธ x=400 (เน€เธ”เธดเธก x=220) เน€เธเธทเนเธญเน€เธเธดเธ”เธเธทเนเธเธ—เธตเน spawn
            { x: 400, y: -420, w: 18, h: 200 },   // North wing
            { x: 400, y: -100, w: 18, h: 200 },   // Mid wing
            { x: 400, y: 160, w: 18, h: 120 },   // South guard

            // โ”€โ”€ Corridor walls: Library entrance (West) โ”€โ”€
            // เธ–เธญเธขเธญเธญเธเนเธ x=-418 (เน€เธ”เธดเธก x=-238)
            { x: -418, y: -420, w: 18, h: 200 },
            { x: -418, y: -100, w: 18, h: 200 },
            { x: -418, y: 160, w: 18, h: 120 },

            // โ”€โ”€ Corridor walls: Courtyard entrance (South) โ”€โ”€
            // เธ–เธญเธขเธญเธญเธเนเธ y=340 (เน€เธ”เธดเธก y=200)
            { x: -180, y: 340, w: 130, h: 18 },
            { x: 50, y: 340, w: 130, h: 18 },
            // Courtyard side rails
            { x: -560, y: 420, w: 18, h: 100 },
            { x: 542, y: 420, w: 18, h: 100 },

            // โ”€โ”€ Corridor walls: Citadel approach (North) โ”€โ”€
            { x: -180, y: -370, w: 130, h: 18 },
            { x: 50, y: -370, w: 130, h: 18 },
            // Citadel approach side rails โ€” เธซเธขเธธเธ”เธเนเธญเธเธ–เธถเธ entrance (y=-370 โ’ y=-480)
            // เธ—เธณเนเธซเน entrance เธเธงเนเธฒเธ 300px เนเธฅเนเธเธชเธกเธเธนเธฃเธ“เน
            { x: -180, y: -480, w: 18, h: 110 },
            { x: 162, y: -480, w: 18, h: 110 },

            // โ”€โ”€ Library safe margin corners โ”€โ”€
            { x: -1100, y: -620, w: 30, h: 30 },
            { x: -380, y: -620, w: 30, h: 30 },
        ],
        mapColors: {
            floor: '#080d18',          // เน€เธเนเธกเธเธถเนเธ เน€เธเธดเนเธกเธเธฃเธฃเธขเธฒเธเธฒเธจ night
            floorAlt: '#060a14',
            treeLight: '#4a7a1a',      // เธชเธงเนเธฒเธเธเธถเนเธ เธ•เนเธเนเธกเน pop เธกเธฒเธเธเธถเนเธ
            treeMid: '#243d0e',
            treeDark: '#142208',
            treeTrunk: '#5c2204',
            deskTop: '#251c0a',
            deskLegs: '#140e04',
            serverBody: '#0d1117',
            serverLightOn: '#fbbf24',  // เธชเธงเนเธฒเธเธเธงเนเธฒเน€เธ”เธดเธก
            serverLightOff: '#3d1502',
            pillarBase: '#1e293b',
            pillarCircuit: '#f59e0b',  // เธชเธงเนเธฒเธเธเธถเนเธ
            bookColors: ['#c26010', '#a85020', '#e8901a', '#8c4010', '#b87010', '#9a5a10', '#fbbf24'],
            wallColor: '#1f1610',
            wallBrick: '#352510',
            whiteboardGreen: '#0f2b0c',
            chalkWhite: '#fef9ee',
            // MTC Database Server Cluster
            dbBody: '#080f1a',
            dbAccent: '#fbbf24',
            dbRackOn: '#f59e0b',
            dbRackOff: '#3d2a00',
            // MTC Co-op Store
            shopBody: '#0f0a04',
            shopAccent: '#f97316',
            shopSign: '#fcd34d',
            shopCounter: '#1c1008',
            shopShelf: '#78350f'
        }
    }
};

// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
// ๐’ SHOP ITEMS
// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•

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
        shoot: 0.28,        // auto reference level โ€” เธญเนเธฒเธเธญเธดเธเธ—เธธเธเธเธทเธ
        dash: 0.35,         // เธฅเธ”เธฅเธ 0.4โ’0.35 โ€” dash เนเธกเนเธเธงเธฃเธเธฅเธเน€เธชเธตเธขเธเธเธทเธ
        hit: 0.35,          // เธฅเธ”เธฅเธ 0.4โ’0.35 โ€” hit feedback เธเธฑเธ”เนเธ•เนเนเธกเนเธ”เธฑเธเน€เธเธดเธ
        enemyDeath: 0.28,   // เน€เธ—เนเธฒ shoot โ€” death เนเธกเนเธเธงเธฃเธ”เธฑเธเธเธงเนเธฒเธเธทเธ
        powerUp: 0.2,
        heal: 0.35,
        levelUp: 0.4,
        victory: 0.6,
        achievement: 0.4,
        weaponSwitch: 0.25, // เธฅเธ”เธฅเธ 0.3โ’0.25 โ€” UI sound เธเธงเธฃเน€เธเธฒเธ—เธตเนเธชเธธเธ”
        bossSpecial: 0.5,
        meteorWarning: 0.3,

        // โ”€โ”€ Shell Casing Drop SFX โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        // เธ•เนเธญเธเน€เธเธฒเธเธงเนเธฒเน€เธชเธตเธขเธเธเธทเธเน€เธชเธกเธญ auto เธขเธดเธ 5 เธเธฑเธ”/เธงเธดเธเธฒเธ—เธต = 5 เธเธฅเธญเธ/เธงเธดเธเธฒเธ—เธต
        // shotgun = 3 เธเธฅเธญเธเธเธฃเนเธญเธกเธเธฑเธ โ’ peak โ shellDrop * 3 เธ•เนเธญเธเนเธกเนเธเธฅเธ shoot
        // เธชเธนเธ•เธฃ: shellDrop * master * sfx * N_casings < shoot * master * sfx * weaponGain
        // 0.025 * 3 = 0.075 < shoot(0.28) * shotgun(1.3) = 0.364 โ…
        shellDrop: 0.025,

        // โ”€โ”€ Procedural SFX gain multipliers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        // Tweak these to balance character SFX loudness without touching audio.js.
        // Values multiply the base `hit` or `shoot` level used in each playX().
        sfx: {
            stealth: 0.5,   // Kao warp cloaking sweep  (base: masterVol * sfxVol, not 'hit')
            clone: 0.4,     // Kao clone split ping
            riceShoot: 0.55,    // เธฅเธ”เธฅเธ 0.6โ’0.55 โ€” Poom sticky rice splat
            ritualBurst: 1.1,   // Poom ritual explosion โ€” ultimate needs presence
            punch: 0.55,        // เธฅเธ”เธฅเธ 0.6โ’0.55 โ€” Auto heat wave punch
            standRush: 0.35,    // เธฅเธ”เธฅเธ 0.45โ’0.35 โ€” fires every 60ms, stacks very fast
            nagaAttack: 0.45,   // เธฅเธ”เธฅเธ 0.55โ’0.45 โ€” rate-limited 220ms เนเธ•เนเธขเธฑเธเธ–เธตเนเธญเธขเธนเน
            // โ”€โ”€ New skill SFX โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            vacuum: 0.6,        // เธฅเธ”เธฅเธ 0.65โ’0.6 โ€” Auto Q vacuum pull whoosh
            detonation: 0.85,   // Auto E โ€” overheat explosion (ultimate, เธเธเนเธงเน)
            phantomShatter: 0.45, // เธฅเธ”เธฅเธ 0.50โ’0.45 โ€” Kao clone expire burst
        },

        // โ”€โ”€ Per-weapon SFX gain multipliers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        // Priority hierarchy: sniper > shotgun > auto
        // sniper = 1.6 โ€” เธขเธดเธเธเนเธฒ 0.85s cooldown เธเธงเธฃเธฃเธนเนเธชเธถเธเธซเธเธฑเธเธ—เธตเนเธชเธธเธ”
        // shotgun = 1.3 โ€” เธฅเธ”เธฅเธ 2.0โ’1.3 (2.0 เธ”เธฑเธเน€เธเธดเธเน€เธ”เธดเธก, 1.3 เธขเธฑเธเธเธ punch เนเธงเน)
        // auto = 1.0 โ€” reference, เธขเธดเธเธ–เธตเนเธชเธธเธ”เธ•เนเธญเธเน€เธเธฒเธชเธธเธ”
        // Fallback: if key is missing, audio.js defaults to 1.0.
        weaponGain: {
            auto: 1.0,
            sniper: 1.6,    // raised 1.5โ’1.6 โ€” เธขเธดเธเธเนเธฒเธ•เนเธญเธเธฃเธนเนเธชเธถเธเธซเธเธฑเธ
            shotgun: 1.3,   // เธฅเธ”เธฅเธ 2.0โ’1.3 โ€” เนเธเนเธเธฑเธเธซเธฒ shotgun เธ”เธฑเธเน€เธเธดเธ
        }
    },
    visual: {
        bgColorTop: '#1a1a2e',
        bgColorBottom: '#16213e',
        screenShakeDecay: 0.92,
        gridColor: 'rgba(255, 255, 255, 0.03)'
    },
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    // ๐ฏ  SHARED ABILITY DEFINITIONS
    // Values that belong to a mechanic, not a specific character.
    // Rule: if a value could meaningfully apply to another character's
    //       version of the same ability โ’ it lives HERE, not in characters.{}
    // Rule: if a value is tightly coupled to one character's stats โ’ it
    //       stays in BALANCE.characters.<id>
    //
    // โ ๏ธ  AI NOTE: This block is intentionally inside GAME_CONFIG (not
    //     BALANCE) because it describes ability *behavior*, not *balance*.
    //     Do NOT move these values to characters.poom โ€” they are consumed
    //     by PoomPlayer.js via GAME_CONFIG.abilities.ritual.*
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    abilities: {
        ritual: {
            // โ”€โ”€ Damage model โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            damagePerStack: 15,              // flat dmg per stack; 5 stacks = 75 dmg
            stackBurstPct: 0.15,             // NERF: 0.25 โ’ 0.15 (5 stacks = 75%hp เนเธ—เธ 125%hp โ€” เนเธกเน instakill)
            baseDamage: 75,                  // base AoE damage when no sticky
            baseDamagePct: 0.15,             // 15% of enemy maxHp as base damage
            // โ”€โ”€ Lifecycle โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            cooldown: 15,                    // seconds โ€” reduced for better uptime
            castTime: 0.6,                   // seconds before window opens
            windowDuration: 3.0,             // seconds window stays active
            // โ”€โ”€ Area of Effect โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            range: 280,                      // increased from 200 to 280 pixels
            // โ”€โ”€ Effect modifiers โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
            fullCeremonySpeedPct: 0.25,      // speed bonus during full ceremony
            fullCeremonyExtraSlowPct: 0.05,  // extra slow during full ceremony
            maxPoints: 3                     // ritual points needed for full ceremony
        }
    }
};

// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
// ๐จ VISUALS
// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
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
        },
        PAT: {
            primary: '#1a1a2e',     // navy body
            secondary: '#e8e8e8',   // white shirt
            accent: '#7ec8e3'       // ice blue katana glow
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

// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
// ๐ ACHIEVEMENT DEFINITIONS
// โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
const ACHIEVEMENT_DEFS = [
    // โ”€โ”€ Early Game โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    { id: 'first_blood', name: 'First Blood', desc: 'เน€เธเธฅเธตเธขเธฃเนเธจเธฑเธ•เธฃเธนเธ•เธฑเธงเนเธฃเธ', icon: 'โ”๏ธ', reward: { type: 'hp', value: 5, text: '+5 Max HP' } },
    { id: 'wave_1', name: 'Wave Survivor', desc: 'เธเนเธฒเธ Wave เนเธฃเธ', icon: '๐', reward: { type: 'hp', value: 5, text: '+5 Max HP' } },
    { id: 'wave_5', name: 'MTC Veteran', desc: 'เธฃเธญเธ”เธเธตเธงเธดเธ•เธ–เธถเธ Wave 5', icon: '๐–๏ธ', reward: { type: 'hp', value: 10, text: '+10 Max HP' } },
    { id: 'wave_10', name: 'MTC Legend', desc: 'เธฃเธญเธ”เธเธตเธงเธดเธ•เธ–เธถเธ Wave 10', icon: '๐', reward: { type: 'hp', value: 15, text: '+15 Max HP' } },

    // โ”€โ”€ Boss Kills โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    { id: 'manop_down', name: '1st Manop Slayer', desc: 'เน€เธญเธฒเธเธเธฐเธเธฃเธนเธกเธฒเธเธเธเธฃเธฑเนเธเนเธฃเธ', icon: '๐‘‘', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'first_down', name: 'Physics Breaker', desc: 'เน€เธญเธฒเธเธเธฐเธเธฃเธนเน€เธเธดเธฃเนเธชเนเธเธเธ”เนเธงเธดเธเธซเธกเธน', icon: 'โ๏ธ', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'parry_master', name: 'Return to Sender', desc: 'Parry เนเธเธเธ”เนเธงเธดเธเธซเธกเธนเธเธฅเธฑเธเนเธเธซเธฒเธเธฃเธนเน€เธเธดเธฃเนเธช', icon: '๐ฅช', reward: { type: 'damage', value: 0.03, text: '+3% Damage' } },

    // โ”€โ”€ Combat โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    { id: 'no_damage', name: 'Untouchable', desc: 'เธเนเธฒเธ Wave เนเธ”เธขเนเธกเนเนเธ”เธเธ”เธฒเน€เธกเธ', icon: '๐ก๏ธ', reward: { type: 'hp', value: 10, text: '+10 Max HP' } },
    { id: 'crit_master', name: 'Critical Master', desc: 'เธ•เธตเธ•เธดเธ”เธเธฃเธดเธ•เธดเธเธญเธฅ 5 เธเธฃเธฑเนเธ', icon: '๐’ฅ', reward: { type: 'crit', value: 0.01, text: '+1% Crit Chance' } },
    { id: 'bullet_time_kill', name: 'Time Bender', desc: 'เธเนเธฒเธจเธฑเธ•เธฃเธนเธเธ“เธฐ Bullet Time 3 เธ•เธฑเธง', icon: '๐•', reward: { type: 'cdr', value: 0.01, text: '-1% Cooldown' } },
    { id: 'barrel_bomber', name: 'Expert Bomber', desc: 'เธเนเธฒเธจเธฑเธ•เธฃเธนเธ”เนเธงเธขเธ–เธฑเธเธฃเธฐเน€เธเธดเธ” 3 เธ•เธฑเธง', icon: '๐ข๏ธ', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },

    // โ”€โ”€ Movement โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    { id: 'speedster', name: 'Speedster', desc: 'เนเธเน Dash 20 เธเธฃเธฑเนเธ', icon: 'โก', reward: { type: 'speed', value: 0.02, text: '+2% Speed' } },

    // โ”€โ”€ Collection โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    { id: 'collector', name: 'MTC Collector', desc: 'เน€เธเนเธ Power-up 10 เธเธดเนเธ', icon: '๐’', reward: { type: 'speed', value: 0.02, text: '+2% Speed' } },
    { id: 'shopaholic', name: 'MTC Shopaholic', desc: 'เธเธทเนเธญเนเธญเน€เธ—เธกเธเธฒเธเธฃเนเธฒเธเธเนเธฒ 5 เธเธฃเธฑเนเธ', icon: '๐’', reward: { type: 'speed', value: 0.02, text: '+2% Speed' } },
    { id: 'shop_max', name: 'Capitalism', desc: 'เธเธทเนเธญเธเธฑเธเธฃเนเธฒเธเธเนเธฒเธเธเน€เธ•เนเธกเธชเนเธ•เนเธ 1.5x', icon: '๐“', reward: { type: 'speed', value: 0.02, text: '+2% Speed' } },

    // โ”€โ”€ Stealth & Weapons โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    { id: 'ghost', name: 'The Ghost of MTC', desc: 'เธเธธเนเธกเธชเธณเน€เธฃเนเธ 10 เธเธฃเธฑเนเธ', icon: '๐‘ป', reward: { type: 'cdr', value: 0.01, text: '-1% Cooldown' } },
    { id: 'weapon_master', name: 'Arsenal', desc: 'เนเธเนเธญเธฒเธงเธธเธเธเธฃเธเธ—เธฑเนเธ 3 เนเธเธเนเธเน€เธเธกเน€เธ”เธตเธขเธง', icon: '๐”ซ', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },

    // โ”€โ”€ Character-specific โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    { id: 'kao_awakened', name: 'Weapon Master Awakened', desc: 'เธเธฅเธ”เธฅเนเธญเธเธชเธเธดเธฅ Weapon Master เธเธญเธเน€เธเนเธฒเธชเธณเน€เธฃเนเธ', icon: 'โก', reward: { type: 'crit', value: 0.01, text: '+1% Crit Chance' } },
    { id: 'drone_master', name: 'Drone Master', desc: 'เธเธฅเธ”เธฅเนเธญเธ Drone Overdrive เธเธฃเธฑเนเธเนเธฃเธ', icon: '๐ค–', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'naga_summoner', name: 'Naga Summoner', desc: 'เธญเธฑเธเน€เธเธดเธเธเธเธฒเธเธฒเธ 3 เธเธฃเธฑเนเธ', icon: '๐', reward: { type: 'cdr', value: 0.01, text: '-1% Cooldown' } },
    { id: 'stand_rush_kill', name: 'WANCHAI-REQUIEM', desc: 'เธเนเธฒเธจเธฑเธ•เธฃเธนเธ”เนเธงเธข Stand Rush 10 เธ•เธฑเธง', icon: '๐ฅ', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'ritual_wipe', name: 'Sticky Situation', desc: 'เธเนเธฒเธจเธฑเธ•เธฃเธน 3 เธ•เธฑเธงเธเธถเนเธเนเธเธ”เนเธงเธข Ritual Burst เธเธฃเธฑเนเธเน€เธ”เธตเธขเธง', icon: '๐พ', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },

    // โ”€โ”€ NEW: Passive Awakenings โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    { id: 'scorched_soul', name: 'SCORCHED SOUL', desc: 'เธเธฅเธ”เธฅเนเธญเธ Passive เธญเธญเนเธ•เนเธ”เนเธงเธขเธเธฒเธฃ Overheat เธเธฃเธฑเนเธเนเธฃเธ', icon: '๐”ฅ', reward: { type: 'damage', value: 0.02, text: '+2% Damage' } },
    { id: 'ritual_king', name: 'King of Isan', desc: 'เธเธฅเธ”เธฅเนเธญเธ Passive เธ เธนเธกเธดเธ”เนเธงเธข Ritual Burst เธเธฃเธฑเนเธเนเธฃเธ', icon: '๐พ', reward: { type: 'hp', value: 10, text: '+10 Max HP' } },
];

// ... (rest of the code remains the same)

const MAP_CONFIG = {

    // โ”€โ”€ Arena boundary โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    arena: {
        radius: 1500,
        haloColor: 'rgba(180, 100, 20, {a})',
        midColor: 'rgba(120, 60, 10, {a})',
        rimColor: 'rgba(250, 180, 30, {a})',
        dashColor: 'rgba(245, 158, 11, {a})',
        // Perf: solid RGB strings for globalAlpha path โ€” avoids .replace()+toFixed() per frame
        haloColorBase: 'rgb(180,100,20)',
        midColorBase: 'rgb(120,60,10)',
        rimColorBase: 'rgb(250,180,30)',
        dashColorBase: 'rgb(245,158,11)',
        haloAlphaBase: 0.12,    // เน€เธเธดเนเธก 0.08โ’0.12
        midAlphaBase: 0.20,     // เน€เธเธดเนเธก 0.15โ’0.20
        rimAlphaBase: 0.65,     // เน€เธเธดเนเธก 0.55โ’0.65 rim เธเธฑเธ”เธเธถเนเธ
        dashAlphaBase: 0.38,    // เน€เธเธดเนเธก 0.30โ’0.38
        rimGlowBlur: 28,                               // glow เนเธซเธเนเธเธถเนเธ 20โ’28
        rimGlowColor: 'rgba(250, 180, 30, 0.95)',
    },

    // โ”€โ”€ Center Landmark โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // Rotating tech-ring at (0,0) โ€” gives players a persistent
    // directional reference and marks the spawn point visually.
    landmark: {
        outerRadius: 90,   // outer ring radius (world px)
        innerRadius: 62,   // inner ring radius
        ringWidth: 2.5,
        outerColor: 'rgba(250, 180, 30, {a})',   // gold
        innerColor: 'rgba(34,  211, 238, {a})',   // cyan
        // Perf: solid RGB strings for globalAlpha path
        outerColorBase: 'rgb(250,180,30)',
        innerColorBase: 'rgb(34,211,238)',
        spokeColorBase: 'rgb(250,180,30)',
        spokeCount: 8,
        spokeAlpha: 0.18,
        glowBlur: 18,
        glowColor: 'rgba(250, 180, 30, 0.7)',
        rotSpeedOuter: 0.18,   // rad/s, outer ring
        rotSpeedInner: -0.28,  // rad/s, inner ring (counter)
        pulseSpeed: 1.4,
        outerAlphaBase: 0.55,
        innerAlphaBase: 0.45,
    },

    // โ”€โ”€ Tech-hex grid โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    hex: {
        size: 64,
        fillColor: 'rgba(130, 70, 15, {a})',    // เธชเธงเนเธฒเธเธเธถเนเธ
        strokeColor: 'rgba(210, 130, 25, {a})',  // เน€เธชเนเธ hex เธเธฑเธ”เธเธถเนเธ
        fillAlpha: 0.07,                          // เน€เธเธดเนเธก 0.05โ’0.07
        strokeAlpha: 0.22,                        // เน€เธเธดเนเธก 0.15โ’0.22
        falloffRadius: 1650,                      // เธเธงเนเธฒเธเธเธถเนเธ เธเธฃเธญเธ zone เนเธเธฅ
    },

    // โ”€โ”€ Circuit paths โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // Update `to` coords here when landmark positions change in game.js
    paths: {
        database: {
            from: { x: 0, y: 0 },
            to: { x: 500, y: -490 },
            coreColor: '#fbbf24',
            glowColor: 'rgba(251, 191, 36, 0.85)',
            phase: 0.0,
        },
        shop: {
            from: { x: 0, y: 0 },
            to: { x: -500, y: 490 },
            coreColor: '#f97316',
            glowColor: 'rgba(249, 115, 22, 0.85)',
            phase: 2.094,
        },
        // Shared path style
        glowWidth: 16,
        coreWidth: 3.5,
        glowAlphaBase: 0.10,   // 0.20โ’0.10 less dominant
        coreAlphaBase: 0.65,   // 0.85โ’0.65 less dominant
        coreGlowBlur: 18,
        packetCount: 3,
        packetSpeed: 0.45,
        packetRadius: 4.5,
        packetAuraRadius: 8,
        elbowRadius: 5,
    },

    // โ”€โ”€ Object palettes (draw helpers) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // All hardcoded colors from drawDesk/drawTree/drawServer/drawDataPillar/drawBookshelf live here.
    // Read by map.js render functions โ€” add new object types here before adding draw logic.
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
            frameBody: '#92400e',   // #78350fโ’#92400e (+1 stop brighter)
            frameSide: '#a16207',   // #92400eโ’#a16207
            shelfBoard: '#b45309',  // #a16207โ’#b45309 warm amber
            bookGloss: 'rgba(255,255,255,0.25)',   // 0.20โ’0.25
            bookShadow: 'rgba(0,0,0,0.3)',
        },
        wall: {
            topCap: 'rgba(255,255,255,0.10)',
            topCapSub: 'rgba(255,255,255,0.04)',
            sideFace: 'rgba(0,0,0,0.35)',
            brickAlt: 'rgba(0,0,0,0.28)',
            brickHighlight: 'rgba(255,255,255,0.025)',
            cornerPost: 'rgba(255,255,255,0.06)',
            damageSpot: 'rgba(0,0,0,0.20)',
        },
        mtcwall: {
            base: '#080c12',
            borderRgb: '217,119,6',
            panelLine: 'rgba(30,20,5,0.6)',
            rivetAlphaBase: 0.5,
            pulseSpeed: 300,
        },
    },

    // โ”€โ”€ Zone Floor Themes โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // Zone positions เธเธฃเธฐเธเธฒเธขเธญเธญเธเนเธเนเธเนเธเธทเนเธเธ—เธตเนเนเธ”เธก (radius 1500) เธ—เธธเธเธ—เธดเธจ
    zones: {
        serverFarm: {
            x: 430, y: -680, w: 800, h: 700,
            floorColor: 'rgba(6, 182, 212, 0.16)',   // 0.07โ’0.16
            gridColor: 'rgba(6, 182, 212, 0.25)',    // 0.18โ’0.25
            gridSize: 36,
            accentColor: 'rgba(34, 211, 238, 0.35)', // 0.28โ’0.35
            label: 'SERVER FARM',
            ambientColor: 'rgba(34, 211, 238, 0.90)',
        },
        library: {
            x: -1230, y: -680, w: 800, h: 700,
            floorColor: 'rgba(180, 120, 20, 0.18)',  // 0.09โ’0.18
            gridColor: 'rgba(251, 191, 36, 0.22)',   // 0.16โ’0.22
            gridSize: 48,
            accentColor: 'rgba(253, 224, 71, 0.30)', // 0.22โ’0.30
            label: 'ARCHIVES',
            ambientColor: 'rgba(251, 191, 36, 0.90)',
        },
        courtyard: {
            x: -600, y: 400, w: 1200, h: 650,
            floorColor: 'rgba(34, 197, 94, 0.15)',   // 0.08โ’0.15
            gridColor: 'rgba(74, 222, 128, 0.20)',   // 0.14โ’0.20
            gridSize: 55,
            accentColor: 'rgba(134, 239, 172, 0.28)', // 0.20โ’0.28
            label: 'COURTYARD',
            ambientColor: 'rgba(134, 239, 172, 0.90)',
        },
        lectureHallL: {
            x: -1100, y: 500, w: 420, h: 400,
            floorColor: 'rgba(168, 85, 247, 0.12)',  // 0.04โ’0.12
            gridColor: 'rgba(192, 132, 252, 0.18)',  // 0.10โ’0.18
            gridSize: 40,
            accentColor: 'rgba(216, 180, 254, 0.22)', // 0.12โ’0.22
            label: 'LECTURE A',
            ambientColor: 'rgba(216, 180, 254, 0.85)', // 0.60โ’0.85
        },
        lectureHallR: {
            x: 680, y: 500, w: 420, h: 400,
            floorColor: 'rgba(168, 85, 247, 0.12)',  // 0.04โ’0.12
            gridColor: 'rgba(192, 132, 252, 0.18)',  // 0.10โ’0.18
            gridSize: 40,
            accentColor: 'rgba(216, 180, 254, 0.22)', // 0.12โ’0.22
            label: 'LECTURE B',
            ambientColor: 'rgba(216, 180, 254, 0.85)', // 0.60โ’0.85
        },
        // MTC Database โ€” NE zone floor
        database: {
            x: 330, y: -660, w: 340, h: 340,
            floorColor: 'rgba(251, 191, 36, 0.06)',
            gridColor: 'rgba(251, 191, 36, 0.18)',
            gridSize: 30,
            accentColor: 'rgba(251, 191, 36, 0.30)',
            label: 'MTC DATABASE',
            ambientColor: 'rgba(251, 191, 36, 0.90)',
        },
        // MTC Co-op Store โ€” SW zone floor
        shop: {
            x: -670, y: 320, w: 340, h: 340,
            floorColor: 'rgba(249, 115, 22, 0.06)',
            gridColor: 'rgba(249, 115, 22, 0.16)',
            gridSize: 32,
            accentColor: 'rgba(249, 115, 22, 0.28)',
            label: 'CO-OP STORE',
            ambientColor: 'rgba(249, 115, 22, 0.90)',
        },
    },

    // โ”€โ”€ Zone auras โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    auras: {
        database: {
            worldX: 500,   // center of database zone (330+170)
            worldY: -490,  // center of database zone (-660+170)
            innerRgb: '250, 180, 30',
            outerRgb: '120, 60, 10',
            radius: 160,
            phase: 0.0,
        },
        shop: {
            worldX: -500,  // center of shop zone (-670+170)
            worldY: 490,   // center of shop zone (320+170)
            innerRgb: '249, 115, 22',
            outerRgb: '154, 52, 18',
            radius: 160,
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
        innerAlphaBase: 0.40,   // 0.32โ’0.40 zone beacons more visible
        midAlphaBase: 0.20,     // 0.15โ’0.20
        outerAlphaBase: 0.08,   // 0.06โ’0.08
        rimAlphaBase: 0.45,     // 0.38โ’0.45 rim more defined
        rimWidth: 2.5,           // เธซเธเธฒเธเธถเนเธ
        rimGlowBlur: 22,         // glow เธกเธฒเธเธเธถเนเธ 16โ’22
        dashAlphaBase: 0.18,    // เน€เธเธดเนเธก 0.12โ’0.18
        dashOuterMult: 1.35,
    },
};

window.MAP_CONFIG = MAP_CONFIG;

window.BALANCE = BALANCE;
window.GAME_CONFIG = GAME_CONFIG;
window.VISUALS = VISUALS;
window.ACHIEVEMENT_DEFS = ACHIEVEMENT_DEFS;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WAVE_SCHEDULE, BALANCE, GAME_CONFIG, VISUALS, ACHIEVEMENT_DEFS, MAP_CONFIG };
}
