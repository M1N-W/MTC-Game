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

            hp: 110, maxHp: 110,
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

        // ── POOM — นักเรียน MTC คนอีสาน ──────────────────────
        // Identity: Consistent DPS / Brawler
        //   • RICE = higher sustained DPS than Kao's auto when in crit rhythm
        //   • EAT RICE = turns on 25% crit bonus → berserk mode
        //   • NAGA = room-clear ultimate; rewards timing over raw aggression
        poom: {
            name: 'Poom',
            radius: 20,

            hp: 135, maxHp: 135,
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
        // HP curve: W1=45, W2=51, W3=57, W4=63, W5=69
        // (was W5=77; now smoother ramp, sniper still 1-shots all waves)
        baseHp: 45, hpPerWave: 6,
        baseSpeed: 95, speedPerWave: 8,
        baseDamage: 9, damagePerWave: 2,
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
        // [TUNED] hpPerWave: 18 → 14
        // HP curve: W1=115, W2=129, W3=143, W4=157, W5=171
        // (was W5=187; now Kao's shotgun 3-pellet burst = 276 safely kills W5 tank)
        baseHp: 115, hpPerWave: 14,
        baseSpeed: 65, speedPerWave: 4,
        baseDamage: 20, damagePerWave: 4,
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
        baseHp: 30, hpPerWave: 7,
        baseSpeed: 75, speedPerWave: 7,
        baseDamage: 13, damagePerWave: 2,
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

        baseHp: 2350,
        hpMultiplier: 1,
        moveSpeed: 130,
        phase2Speed: 175,
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

        // ── Phase 2: "Manop the Dog Rider" ─────────────────
        // Phase 2 activates at 50% HP (2350 × 0.5 = 1175 HP).
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
        }
    },

    // ──────────────────────────────────────────────────────────
    // 💎 POWER-UPS
    // ──────────────────────────────────────────────────────────
    powerups: {
        radius: 20,
        // [TUNED] 0.10 → 0.13
        // Late waves (W4–W5) previously ran dry on pickups; +30% drop rate
        // adds ~1 extra pickup per large wave without trivialising healing.
        dropRate: 0.13,
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
        maxWaves: 5,
        minKillsForNoDamage: 5,
        enemiesBase: 4,
        enemiesPerWave: 3,
        // [TUNED] 0.18 → 0.15
        // Tanks feel special when rare; at 0.18 early waves had >1 tank frequently,
        // making them routine grind rather than a "watch out!" encounter.
        tankSpawnChance: 0.15,
        mageSpawnChance: 0.15,
        bossEveryNWaves: 3
    },

    // ──────────────────────────────────────────────────────────
    // 🏆 SCORING
    // ──────────────────────────────────────────────────────────
    score: {
        // [TUNED] Economy pass — all non-boss rewards +30% (+20% for mage)
        // Reasoning: After full W2 (7 enemies), expected score was ~750.
        // Cheapest shop item (Potion) = 500. Players arrived at the W3 boss wave with
        // no meaningful shop interaction. New expected W2 cumulative: ~975 pts.
        // Players can now buy 1 Potion (500) before the boss and have 475 toward Boots.
        basicEnemy: 65,   // was 50
        tank: 130,        // was 100
        mage: 180,        // was 150
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
        cost: 500, heal: 50, duration: null,
        desc: 'ฟื้นฟู HP +50 ทันที', color: '#22c55e'
    },
    damageUp: {
        id: 'damageUp', name: 'Weapon Tuner', icon: '🔧',
        cost: 1000, mult: 1.1, duration: 30,
        desc: 'ดาเมจ ×1.1 เป็นเวลา 30 วิ', color: '#f59e0b'
    },
    speedUp: {
        id: 'speedUp', name: 'Lightweight Boots', icon: '👟',
        cost: 800, mult: 1.1, duration: 30,
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
    visual: {
        particleLifetime: [0.3, 0.8],
        textFloatSpeed: -80,
        screenShakeDecay: 0.9,
        bgColorTop:    '#0f172a',
        bgColorBottom: '#1e293b',
        gridColor:     'rgba(30, 41, 59, 0.5)'
    },
    input: {
        joystickDeadzone: 0.1,
        joystickMaxDistance: 40
    },
    audio: {
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
    module.exports = { BALANCE, SHOP_ITEMS, GAME_CONFIG, ACHIEVEMENT_DEFS, API_KEY };
}