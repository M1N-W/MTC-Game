'use strict';
/**
 * ⚙️ MTC: ENHANCED EDITION - Configuration
 * Single source of truth for ALL game constants and balance values.
 *
 * REFACTOR NOTES (Stability Overhaul):
 * - All character, boss, shop, lighting, and map stats live here.
 * - utils.js, entities.js, map.js, ui.js, and game.js all read from this.
 * - Never define numeric/string constants in other files — put them here.
 *
 * ──────────────────────────────────────────────────────────────────────
 * ⚖️ AUTO-TUNE CHANGELOG  (Senior Balance Pass)
 * ──────────────────────────────────────────────────────────────────────
 * Kao  | sniper.damage          100.5  → 120    | 1-shot guarantee; psychological punch
 * Kao  | shotgun.damage          80.5  → 92     | 2-pellet burst on W5 tanks (skill-gated)
 * Poom | riceDamage              42.5  → 50     | DPS 92→108; finally "Consistent DPS" lead
 * Poom | critChance              0.07  → 0.09   | Brawler crits feel frequent & rewarding
 * Poom | nagaDamage                50  → 72     | Naga ultimate = 216–432 realistic HP burst
 * Econ | score.basicEnemy          50  → 65     | Shop viable before boss wave
 * Econ | score.tank               100  → 130    | Scales with tank difficulty increase
 * Econ | score.mage               150  → 180    | Rewards hunting high-value targets
 * Tank | hpPerWave                 18  → 14     | W5 Tank 187→171 HP; shotgun 2-pellet kill reachable
 * Boss | phase2.barkCooldown      2.5  → 3.5    | Less bark spam; each bark stays terrifying
 * Boss | phase2.enrageSpeedMult   1.8  → 1.65   | Enraged Phase2 speed 315→289; dodgeable with dash
 * PwrUp| dropRate                 0.10 → 0.13   | Slightly more sustain in late waves
 * Wave | tankSpawnChance          0.18 → 0.15   | Tanks feel special, not routine
 *
 * ──────────────────────────────────────────────────────────────────────
 * 🧭 COLLISION AWARENESS SYSTEM  (Gameplay Logic Pass)
 * ──────────────────────────────────────────────────────────────────────
 * Player| obstacleWarningRange    —  →  35 px   | Proximity bubble trigger radius
 * Player| obstacleBuffPower       —  → ×1.25    | Consolation speed boost when scraping
 * Player| obstacleBuffDuration    —  →  1.0 s   | How long the buff lingers after contact
 * Player| obstacleWarningCooldown —  → 3000 ms  | Min gap between successive warning bubbles
 */

// ─── API Configuration ────────────────────────────────────────
// CONFIG_SECRETS must be injected by the build/server environment.
// If unavailable (local dev), fall back to empty string gracefully.
const API_KEY = (typeof CONFIG_SECRETS !== 'undefined' && CONFIG_SECRETS.GEMINI_API_KEY)
    ? CONFIG_SECRETS.GEMINI_API_KEY
    : '';

// ══════════════════════════════════════════════════════════════
// ⚖️ BALANCE — all tunable game values
// ══════════════════════════════════════════════════════════════
const BALANCE = {

    // ──────────────────────────────────────────────────────────
    // 🌐 SHARED PHYSICS
    // ──────────────────────────────────────────────────────────
    physics: {
        friction:     0.88,
        acceleration: 1800
    },

    // ──────────────────────────────────────────────────────────
    // 🧭 SHARED PLAYER SYSTEMS (applies to ALL characters)
    // ──────────────────────────────────────────────────────────
    // These constants govern the Collision Awareness & Speed Buff system.
    // When a player scrapes a map object while moving, two things happen:
    //   1. A warning voice bubble fires (rate-limited by obstacleWarningCooldown).
    //   2. A consolation speed buff (×obstacleBuffPower) is applied for
    //      obstacleBuffDuration seconds so the player can slide away faster.
    //
    // Tuning guide:
    //   obstacleWarningRange   — bigger = warns sooner (annoyance ↑ if > 50px)
    //   obstacleBuffPower      — keep < 1.5 to avoid feeling like a free speed hack
    //   obstacleBuffDuration   — < 0.5s feels unnoticeable; > 2s feels overpowered
    //   obstacleWarningCooldown— 3000ms = max one bubble per 3s per proximity cluster
    player: {
        obstacleWarningRange:    35,    // px from object surface → triggers warning bubble
        obstacleBuffPower:       1.25,  // speed multiplier applied when scraping object
        obstacleBuffDuration:    1.0,   // seconds the consolation buff lasts after contact
        obstacleWarningCooldown: 3000,  // ms minimum between successive warning bubbles

        auto: {
            hp: 150,            // [SPEC] Tanky brawler — higher base HP
            speed: 160,
            energyRegen: 20,    // [SPEC] Faster energy regen for aggressive play
            heatWaveRange: 180, // [SPEC] Short-range wide projectile reach
            wanchaiDuration: 4.0, // [SPEC] Stand active duration (seconds)
            wanchaiCooldown: 12   // [SPEC] Stand cooldown (seconds)
        }
    },

    // ──────────────────────────────────────────────────────────
    // 🧑‍🤝‍🧑 CHARACTER STATS
    // ──────────────────────────────────────────────────────────
    characters: {

        // ── KAO — นักเรียน MTC สายซุ่ม ──────────────────────
        // Identity: High Skill / High Reward
        //   • AUTO RIFLE = safe consistent poke (110 DPS)
        //   • SNIPER     = 1-shot any non-tank enemy; punishes mis-position
        //   • SHOTGUN    = risky close-range; melts tanks with 2-3 pellets
        //   • Stealth ambush + 3× crit = burst ceiling
        kao: {
            name: 'Kao',
            radius: 20,

            hp: 120, maxHp: 120,
            energy: 100, maxEnergy: 100,
            energyRegen: 15,

            moveSpeed: 325,
            dashSpeed: 550,
            dashDistance: 180,

            weapons: {
                auto: {
                    name: 'AUTO RIFLE',
                    // 21.5 dmg / 0.195s CD = 110.3 DPS — baseline consistent damage
                    damage: 21.5, cooldown: 0.195,
                    range: 900, speed: 900,
                    spread: 0, pellets: 1,
                    color: '#3b82f6', icon: '🔵'
                },
                sniper: {
                    name: 'SNIPER',
                    // [TUNED] 100.5 → 120
                    // Math: W5 Basic = 77 HP, W5 Mage = 58 HP — both guaranteed 1-shot
                    // with 20 HP headroom for any future resistance/armor modifiers.
                    // DPS = 120 / 0.85s = 141.2 — now clearly the highest single-target DPS
                    // when every shot lands; compensated by the skill demand of accuracy.
                    damage: 120, cooldown: 0.85,
                    range: 1200, speed: 1200,
                    spread: 0, pellets: 1,
                    color: '#ef4444', icon: '🔴'
                },
                shotgun: {
                    name: 'SHOTGUN',
                    // [TUNED] 80.5 → 92 per pellet (5 pellets, 0.4 rad spread)
                    // Math:
                    //   2 pellets = 184 dmg — just misses W5 Tank (171 HP after hpPerWave fix)
                    //   3 pellets = 276 dmg — comfortably kills W5 Tank in 1 burst
                    // This makes 3-pellet hits a "skill expression" reward for getting close.
                    // Max burst (5 pellets) = 460 dmg — devastating but very risky range.
                    damage: 92, cooldown: 0.6,
                    range: 400, speed: 700,
                    spread: 0.4, pellets: 5,
                    color: '#f59e0b', icon: '🟠'
                }
            },

            baseCritChance: 0.05,
            critMultiplier: 3,
            dashCooldown: 1.65,
            stealthCooldown: 5.5,
            stealthCost: 25,
            stealthDrain: 35,
            stealthSpeedBonus: 1.5,

            expToNextLevel: 100,
            expLevelMult: 1.5,

            passiveUnlockLevel: 3,
            passiveUnlockStealthCount: 5,
            passiveHpBonusPct: 0.5,
            passiveCritBonus: 0.035,
            passiveLifesteal: 0.02,

            speedOnHit: 20,
            speedOnHitDuration: 0.4
        },

        // ── AUTO — เทวดาอาวุธ ยืน "วันชัย" ────────────────────
        // Identity: Thermodynamic Brawler / Stand User
        //   • HEAT WAVE = short-range wide projectile; pierces 1-2 enemies
        //   • WANCHAI   = JoJo-style Stand barrage; 50% DR + rapid punches
        //   • Tanky but slow; rewards getting into melee range
        auto: {
            name: 'Auto',
            radius: 20,

            hp: 150, maxHp: 150,
            energy: 100, maxEnergy: 100,
            energyRegen: 20,

            moveSpeed: 160,
            dashSpeed: 480,
            dashDistance: 160,
            dashCooldown: 2.0,

            // ── Wanchai / Stand primary special ──────────────────
            // heatWaveRange / heatWaveCooldown govern normal attack.
            // wanchai* govern the Stand summoning skill.
            heatWaveRange: 180,
            heatWaveCooldown: 0.28,
            wanchaiDuration: 4.0,
            wanchaiCooldown: 12,
            wanchaiEnergyCost: 35,
            wanchaiPunchRate: 0.06,   // seconds between Stand punches

            // ── NEW: Awakening Aura/Buffs (Active during Wanchai) ──
            standSpeedMod: 1.5,          // 50% increased movement speed
            standDamageReduction: 0.50,  // 50% damage reduction
            standCritBonus: 0.50,        // +50% flat critical hit chance

            // ── Crit system ───────────────────────────────────────
            baseCritChance: 0.06,
            critMultiplier: 2.0,

            // ── Stealth slot — REPURPOSED for Wanchai activation ──
            // stealthCost is intentionally impossibly high so the base
            // Player.update() stealth branch never fires; AutoPlayer.update()
            // intercepts right-click and calls _activateWanchai() instead.
            stealthCooldown: 12,
            stealthCost: 9999,
            stealthDrain: 0,
            stealthSpeedBonus: 1.0,

            // ── Progression ───────────────────────────────────────
            expToNextLevel: 100,
            expLevelMult: 1.5,

            passiveUnlockLevel: 5,
            passiveUnlockStealthCount: 99, // unlock via level, not stealth count
            passiveHpBonusPct: 0.25,
            passiveCritBonus: 0.04,
            passiveLifesteal: 0.01,

            speedOnHit: 15,
            speedOnHitDuration: 0.35
        },
        // Identity: Consistent DPS / Brawler
        //   • RICE = higher sustained DPS than Kao's auto when in crit rhythm
        //   • EAT RICE = turns on 25% crit bonus → berserk mode
        //   • NAGA = room-clear ultimate; rewards timing over raw aggression
        poom: {
            name: 'Poom',
            radius: 20,

            hp: 125, maxHp: 125,
            energy: 100, maxEnergy: 100,
            energyRegen: 12,

            moveSpeed: 300,
            dashSpeed: 520,
            dashDistance: 170,
            dashCooldown: 1.65,

            expToNextLevel: 100,
            expLevelMult: 1.5,

            // [TUNED] 42.5 → 50
            // Math: 50 / 0.46s CD = 108.7 DPS base
            // With Eat Rice crit bonus (+0.25): effective crit rate = 0.09 + 0.25 = 0.34
            // Expected DPS multiplier = (1 - 0.34)*1 + 0.34*3 = 0.66 + 1.02 = 1.68
            // Eat Rice sustained DPS = 108.7 * 1.68 = ~182.6 DPS — explosive, time-limited
            // Normal sustained DPS (9% crit) = 108.7 * [(0.91*1)+(0.09*3)] = 108.7*1.18 = 128.3 DPS
            // Poom now clearly leads Kao in raw sustained DPS; Kao leads in burst ceiling.
            riceDamage: 50,
            riceCooldown: 0.46,
            riceSpeed: 600,
            riceRange: 750,
            riceColor: '#ffffff',

            // [TUNED] 0.07 → 0.09
            // Crits feel frequent enough to reward brawler positioning without trivialising;
            // each crit = 3× = 150 dmg — a satisfying visual and number spike.
            critChance: 0.09,
            critMultiplier: 3,

            eatRiceCooldown: 12,
            eatRiceDuration: 5,
            eatRiceSpeedMult: 1.3,
            eatRiceCritBonus: 0.25,

            nagaCooldown: 25,
            nagaDuration: 8,
            // [TUNED] 50 → 72 per segment
            // Math: 12 segments × 72 = 864 max theoretical
            // Realistic contact (3–6 segments per enemy): 216 – 432 dmg
            // vs Boss (2350 HP): one great Naga cast = 9–18% of boss HP — a genuine "oh no" moment
            // vs Tank W5 (171 HP): 3 segments = 216 > 171 → one pass clears a tank
            // This makes the 25s cooldown feel worth protecting.
            nagaDamage: 72,
            nagaSpeed: 525,
            nagaSegments: 12,
            nagaSegmentDistance: 28,
            nagaRadius: 20,

            speedOnHit: 18,
            speedOnHitDuration: 0.35
        },

        auto: {
            name: 'Auto',
            radius: 20,

            hp: 120, maxHp: 120,
            energy: 100, maxEnergy: 100,
            energyRegen: 15,

            moveSpeed: 160,
            dashSpeed: 520,
            dashDistance: 175,
            dashCooldown: 1.65,

            // Stand / skill tuning (consumed by AutoPlayer)
            heatWaveRange: 150,
            wanchaiDuration: 3.0,
            wanchaiCooldown: 12,

            // ── NEW: Awakening Aura/Buffs (Active during Wanchai) ──
            wanchaiEnergyCost: 35,
            wanchaiPunchRate: 0.06,
            standSpeedMod: 1.5,          // 50% increased movement speed
            standDamageReduction: 0.50,  // 50% damage reduction
            standCritBonus: 0.50,        // +50% flat critical hit chance

            // Provide a basic weapons object so WeaponSystem UI never throws
            // even if a code path accidentally queries weapon data.
            weapons: {
                auto:    { name: 'HEAT WAVE', damage: 34, cooldown: 0.28, range: 150, speed: 900, spread: 0.08, pellets: 1, color: '#dc2626', icon: '🔥' },
                sniper:  { name: 'HEAT WAVE', damage: 34, cooldown: 0.28, range: 150, speed: 900, spread: 0.08, pellets: 1, color: '#dc2626', icon: '🔥' },
                shotgun: { name: 'HEAT WAVE', damage: 34, cooldown: 0.28, range: 150, speed: 900, spread: 0.08, pellets: 1, color: '#dc2626', icon: '🔥' }
            },

            baseCritChance: 0.05,
            critMultiplier: 2.5,

            expToNextLevel: 100,
            expLevelMult: 1.5,

            passiveUnlockLevel: 3,
            passiveUnlockStealthCount: 5,
            passiveHpBonusPct: 0.5,
            passiveCritBonus: 0.03,
            passiveLifesteal: 0.015,

            speedOnHit: 18,
            speedOnHitDuration: 0.35
        }

        // ── Add future characters here ─────────────────────────
        // mint: { name: 'Mint', hp: 90, moveSpeed: 400, ... }
    },

    // ──────────────────────────────────────────────────────────
    // 🤖 ENGINEERING DRONE
    // ──────────────────────────────────────────────────────────
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
        bobSpeed: 3.5
    },

    // ──────────────────────────────────────────────────────────
    // 👾 BASIC ENEMY
    // ──────────────────────────────────────────────────────────
    enemy: {
        radius: 18,
        colors: ['#ef4444', '#f59e0b', '#8b5cf6'],
        expValue: 10,
        chaseRange: 150,
        projectileSpeed: 500,
        // HP curve: W1=40, W2=50, W3=62, W4=76, W5=92, W6=110, W7=130, W8=152, W9=176
        // Exponential scaling with plateau: baseHp * (1.25^(wave/2))
        // Ensures enemies remain threatening but don't become bullet sponges
        baseHp: 40, hpPerWave: 0.25,
        baseSpeed: 85, speedPerWave: 6,
        baseDamage: 8, damagePerWave: 1.5,
        shootCooldown: [2.5, 4.5],
        shootRange: 550
    },

    // ──────────────────────────────────────────────────────────
    // 🛡️ TANK ENEMY
    // ──────────────────────────────────────────────────────────
    tank: {
        radius: 25,
        color: '#78716c',
        expValue: 25,
        powerupDropMult: 1.5,
        // HP curve: W1=100, W2=125, W3=156, W4=195, W5=244, W6=305, W7=381, W8=476, W9=595
        // Heavy exponential scaling: baseHp * (1.25^(wave/1.8))
        // Tanks remain threatening but become manageable with focused fire
        baseHp: 100, hpPerWave: 0.55,
        baseSpeed: 60, speedPerWave: 3,
        baseDamage: 18, damagePerWave: 3,
        meleeRange: 55
    },

    // ──────────────────────────────────────────────────────────
    // 🧙 MAGE ENEMY
    // ──────────────────────────────────────────────────────────
    mage: {
        radius: 16,
        color: '#a855f7',
        expValue: 30,
        powerupDropMult: 1.3,
        orbitDistance: 300,
        orbitDistanceBuffer: 100,
        // HP curve: W1=28, W2=36, W3=46, W4=58, W5=73, W6=91, W7=113, W8=141, W9=176
        // Moderate exponential: baseHp * (1.28^(wave/2))
        // Mages remain glass cannons but scale reasonably
        baseHp: 28, hpPerWave: 0.28,
        baseSpeed: 70, speedPerWave: 5,
        baseDamage: 12, damagePerWave: 1.8,
        soundWaveCooldown: 10,
        soundWaveRange: 300,
        soundWaveConfuseDuration: 0.8,
        meteorCooldown: 13,
        meteorDamage: 28,
        meteorBurnDuration: 3,
        meteorBurnDPS: 4.5
    },

    // ──────────────────────────────────────────────────────────
    // 👑 BOSS — "KRU MANOP THE DOG RIDER"
    // ──────────────────────────────────────────────────────────
    boss: {
        radius: 50,
        spawnY: -600,
        contactDamage: 25,
        speechInterval: 10,
        nextWaveDelay: 2000,
        log457HealRate: 0.1,

        chalkProjectileSpeed: 600,
        attackFireRate: 0.1,
        phase2AttackFireRate: 0.05,
        ultimateProjectileSpeed: 400,

        baseHp: 2000,
        hpMultiplier: 1,
        moveSpeed: 125,
        phase2Speed: 155,
        phase2Threshold: 0.5,

        chalkDamage: 13,
        ultimateDamage: 26,
        ultimateBullets: 18,
        phase2UltimateBullets: 26,

        slamDamage: 35,
        slamRadius: 320,
        slamCooldown: 16,

        graphDamage: 45,
        graphLength: 1400,
        graphDuration: 18,
        graphCooldown: 18,

        log457ChargeDuration: 2,
        log457ActiveDuration: 5,
        log457StunDuration: 1.2,
        log457Cooldown: 26,
        log457AttackBonus: 0.09,
        log457AttackGrowth: 0.04,

        // ── Phase 2: "Dog Summoner" ─────────────────────────
        // Phase 2 activates at 50% HP. Instead of riding the dog,
        // Manop SUMMONS the dog as a separate aggressive melee unit.
        phase2: {
            barkDamage: 25,
            barkRange: 600,
            // [TUNED] 2.5 → 3.5
            // Math: At 2.5s CD vs Kao (110 HP), bark kills in ceil(110/25)=5 barks = 12.5s in range.
            // At 3.5s CD, that's 17.5s in range — dangerous but now escapable with consistent
            // movement. Each bark still punishes standing still.
            barkCooldown: 3.5,
            // [TUNED] 1.8 → 1.65
            // Math: phase2Speed (175) × 1.65 = 288.75 — faster than Poom (300 base) by only 3.7%
            // meaning Poom can barely kite if boosted; Kao (325) can outrun cleanly.
            // Original (1.8): 315 speed — literally faster than Poom's base, making Phase 2
            // un-escapable for Poom without dash. This was the "impossible to dodge" problem.
            enrageSpeedMult: 1.65,
            dogColor: '#d97706'
        },

        // ── Summoned Dog ─────────────────────────────────────
        // Spawned as a standalone BossDog entity when Manop enters Phase 2.
        // Very fast melee-range chaser; damage dealt on contact per second.
        bossDog: {
            hp: 1000,
            speed: 260,
            damage: 22,
            radius: 20,
            color: '#d97706'
        },

        // ── Phase 3: "Manop the Goldfish Lover" ──────────────
        // Activates at 25% HP on Encounter 3 (Wave 9) only.
        // Adds Goldfish Kamikaze swarm + Bubble Prison on top of all Phase 2 attacks.
        phase3Threshold: 0.25,
        phase3: {
            auraColor:        '#38bdf8',
            goldfishCooldown: 5.5,
            goldfishCount:    2,
            bubbleCooldown:   7.5,
            bubbleCount:      3,
            slowFactor:       0.5,
            slowDuration:     2.0
        },

        // ── GoldfishMinion ───────────────────────────────────
        // Sine-wave Kamikaze fish that wobbles as it chases and explodes on contact.
        goldfishMinion: {
            hp:        50,
            speed:     165,
            damage:    18,
            radius:    12,
            wobbleAmp: 40,
            wobbleFreq: 3.5,
            color:     '#fb923c'
        },

        // ── BubbleProjectile ─────────────────────────────────
        // Slow, semi-transparent; deals damage AND slows the player on hit.
        bubbleProjectile: {
            speed:  100,
            damage: 30,
            radius: 18,
            color:  'rgba(186, 230, 253, 0.6)'
        }
    },

    // ──────────────────────────────────────────────────────────
    // 💎 POWER-UPS
    // ──────────────────────────────────────────────────────────
    powerups: {
        radius: 20,
        // [TUNED] 0.13 → 0.15
        // Late waves need more sustain; +15% drop rate ensures ~1 extra pickup per wave
        // without making healing too common. Health drops remain meaningful.
        dropRate: 0.15,
        lifetime: 14,
        healAmount: 20,
        damageBoost: 1.5,
        damageBoostDuration: 5,
        speedBoost: 1.35,
        speedBoostDuration: 5
    },

    // ──────────────────────────────────────────────────────────
    // 🌊 WAVE SYSTEM
    // ──────────────────────────────────────────────────────────
    waves: {
        spawnDistance: 800,
        bossSpawnDelay: 3000,
        maxWaves: 9,
        minKillsForNoDamage: 5,
        enemiesBase: 4,
        enemiesPerWave: 2,
        // [TUNED] 0.15 → 0.12
        // Tanks should feel special; reduced spawn chance prevents tank spam
        // in early-mid waves, making each tank encounter more meaningful.
        tankSpawnChance: 0.12,
        mageSpawnChance: 0.15,
        bossEveryNWaves: 3,

        // ── ⚡ Glitch Wave Grace Period ──────────────────────────
        // How long (ms) to delay enemy spawning after a Glitch Wave begins.
        // During this window: glitch visuals play, controls invert, and countdown
        // text builds tension — but zero enemies exist yet so the player can
        // breathe, re-orient, and panic in an informed way.
        // Recommended range: 3000–6000 ms.
        glitchGracePeriod: 4000
    },

    // ──────────────────────────────────────────────────────────
    // 🏆 SCORING
    // ──────────────────────────────────────────────────────────
    score: {
        // [ECONOMY OVERHAUL] Balanced scoring system
        // Wave 1-3 cumulative: ~1200 pts (vs previous ~750)
        // Allows 1-2 shop items before Wave 3 boss, major upgrade by Wave 6
        basicEnemy: 80,   // +23% (was 65)
        tank: 160,        // +23% (was 130)
        mage: 220,        // +22% (was 180)
        boss: 5000,
        powerup: 100,
        achievement: 500
    },

    // ──────────────────────────────────────────────────────────
    // 🏫 MTC ROOM
    // ──────────────────────────────────────────────────────────
    mtcRoom: {
        healRate: 40,
        maxStayTime: 4,
        cooldownTime: 10,
        size: 300
    },

    // ──────────────────────────────────────────────────────────
    // 💡 LIGHTING ENGINE
    // ambientLight is mutated at runtime by the day/night cycle.
    // ──────────────────────────────────────────────────────────
    LIGHTING: {
        ambientLight:   0.9,
        cycleDuration:  60,
        nightMinLight:  0.12,
        dayMaxLight:    0.95,

        playerLightRadius:      160,
        projectileLightRadius:   50,
        mtcServerLightRadius:   120,
        shopLightRadius:         85,
        dataPillarLightRadius:   70,
        serverRackLightRadius:   55,

        nightR: 5, nightG: 8, nightB: 22
    },

    // ──────────────────────────────────────────────────────────
    // 🗺️ MAP SETTINGS
    // ──────────────────────────────────────────────────────────
    map: {
        size: 3000,
        objectDensity: 0.12,
        objectTypes: ['desk', 'tree', 'server', 'datapillar', 'bookshelf', 'blackboard'],
        wallPositions: [
            { x: -1500, y: -50,  w: 50,  h: 100 },
            { x:  1450, y: -50,  w: 50,  h: 100 },
            { x:  -50,  y: -1500, w: 100, h: 50  },
            { x:  -50,  y:  1450, w: 100, h: 50  }
        ],
        mapColors: {
            floor:           '#d4c5a0',
            floorAlt:        '#c9b892',
            treeLight:       '#86efac',
            treeMid:         '#4ade80',
            treeDark:        '#16a34a',
            treeTrunk:       '#92400e',
            deskTop:         '#854d0e',
            deskLegs:        '#713f12',
            serverBody:      '#1e293b',
            serverLightOn:   '#22c55e',
            serverLightOff:  '#166534',
            pillarBase:      '#475569',
            pillarCircuit:   '#06b6d4',
            bookColors: ['#ef4444','#3b82f6','#f59e0b','#10b981','#8b5cf6','#ec4899','#f97316'],
            wallColor:       '#e2d5c0',
            wallBrick:       '#c9b18a',
            whiteboardGreen: '#1a4731',
            chalkWhite:      '#f0ebe0'
        }
    }
};

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP ITEMS
// ══════════════════════════════════════════════════════════════
const SHOP_ITEMS = {
    potion: {
        id: 'potion', name: 'Energy Drink', icon: '🧃',
        cost: 400, heal: 50, duration: null,
        desc: 'ฟื้นฟู HP +50 ทันที', color: '#22c55e'
    },
    damageUp: {
        id: 'damageUp', name: 'Weapon Tuner', icon: '🔧',
        cost: 900, mult: 1.1, duration: 30,
        desc: 'ดาเมจ ×1.1 เป็นเวลา 30 วิ', color: '#f59e0b'
    },
    speedUp: {
        id: 'speedUp', name: 'Lightweight Boots', icon: '👟',
        cost: 700, mult: 1.1, duration: 30,
        desc: 'ความเร็ว ×1.1 เป็นเวลา 30 วิ', color: '#06b6d4'
    }
};

// ══════════════════════════════════════════════════════════════
// 🎮 GAME CONFIG — canvas, physics, visuals, input, audio
// ══════════════════════════════════════════════════════════════
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
            menu: 'assets/audio/menu.mp3', // Example: 'assets/audio/menu.mp3'
            battle: 'assets/audio/battle.mp3', 
            boss: 'assets/audio/boss.mp3',
            glitch: 'assets/audio/glitch.mp3'
        },
        master:        1.0,
        shoot:         0.3,
        dash:          0.4,
        hit:           0.4,
        enemyDeath:    0.3,
        powerUp:       0.2,
        heal:          0.4,
        levelUp:       0.4,
        victory:       0.6,
        achievement:   0.4,
        weaponSwitch:  0.3,
        bossSpecial:   0.5,
        meteorWarning: 0.3
    },
    visual: {
        bgColorTop: '#1a1a2e',
        bgColorBottom: '#16213e',
        screenShakeDecay: 0.92
    }
};

// ══════════════════════════════════════════════════════════════
// 🎨 VISUALS — Graphics 2.0 settings (ADDED)
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
        // ── AUTO: Thermodynamic Brawler — Crimson Red theme ──
        AUTO: {
            primary:   '#dc2626', // Crimson Red
            secondary: '#fb7185', // Rose accent
            accent:    '#f97316'  // Orange heat shimmer
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
    { id: 'first_blood',   name: 'First Blood',       desc: 'ฆ่าศัตรูตัวแรก',                    icon: '⚔️'  },
    { id: 'wave_1',        name: 'Wave Survivor',      desc: 'ผ่าน Wave 1',                       icon: '🌊'  },
    { id: 'boss_down',     name: 'Manop Slayer',       desc: 'เอาชนะครูมานพครั้งแรก',             icon: '👑'  },
    { id: 'no_damage',     name: 'Untouchable',        desc: 'ผ่าน Wave โดยไม่โดนดาเมจ',          icon: '🛡️' },
    { id: 'crit_master',   name: 'Critical Master',    desc: 'ตีติดคริติคอล 5 ครั้ง',             icon: '💥'  },
    { id: 'speedster',     name: 'Speedster',          desc: 'ใช้ Dash 20 ครั้ง',                 icon: '⚡'  },
    { id: 'ghost',         name: 'The Ghost of MTC',   desc: 'ซุ่มอ่าน 10 ครั้ง',                 icon: '👻'  },
    { id: 'collector',     name: 'MTC Collector',      desc: 'เก็บ Power-up 10 ชิ้น',             icon: '💎'  },
    { id: 'weapon_master', name: 'Weapon Master',      desc: 'ใช้ปืนครบทั้ง 3 แบบ',              icon: '🔫'  },
    { id: 'naga_summoner', name: 'Naga Summoner',      desc: 'อัญเชิญพญานาค 3 ครั้ง',             icon: '🐍'  },
    { id: 'shopaholic',    name: 'MTC Shopaholic',     desc: 'ซื้อไอเทมจากร้านค้า 5 ครั้ง',       icon: '🛒'  }
];

// ── Node/bundler export ───────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BALANCE, SHOP_ITEMS, GAME_CONFIG, VISUALS, ACHIEVEMENT_DEFS, API_KEY };
}