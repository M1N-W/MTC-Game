/**
 * ⚙️ MTC: ENHANCED EDITION - Configuration
 * All game balance settings and constants
 */

// API Configuration
const API_KEY = CONFIG_SECRETS.GEMINI_API_KEY;

// Enhanced Balance Configuration
const BALANCE = {

    // ──────────────────────────────────────────────────────────────
    // 🌐 SHARED PHYSICS (ค่าฟิสิกส์ที่ทุกตัวละครใช้ร่วมกัน)
    // ──────────────────────────────────────────────────────────────
    physics: {
        friction:     0.88,
        acceleration: 1800
    },

    // ──────────────────────────────────────────────────────────────
    // 🧑‍🤝‍🧑 CHARACTER SPECIFIC STATS (แยกรายตัวละคร — เพิ่มได้ไม่จำกัด)
    // ──────────────────────────────────────────────────────────────
    characters: {

        // ────────────────────────────────
        // 👨‍🎓 KAO — นักเรียน MTC (ตัวละครดั้งเดิม)
        // ────────────────────────────────
        kao: {
            name: 'Kao',

            // Entity
            radius: 20,

            // Health & Energy
            hp: 110,
            maxHp: 110,
            energy: 100,
            maxEnergy: 100,
            energyRegen: 15,       // Energy restored per second (passive)

            // Movement
            moveSpeed: 350,
            dashSpeed: 550,
            dashDistance: 180,

            // Weapon System
            weapons: {
                auto: {
                    name: 'AUTO RIFLE',
                    damage: 21.5,
                    cooldown: 0.195,
                    range: 900,
                    speed: 900,
                    spread: 0,
                    pellets: 1,
                    color: '#3b82f6',
                    icon: '🔵'
                },
                sniper: {
                    name: 'SNIPER',
                    damage: 100.5,
                    cooldown: 0.85,
                    range: 1200,
                    speed: 1200,
                    spread: 0,
                    pellets: 1,
                    color: '#ef4444',
                    icon: '🔴'
                },
                shotgun: {
                    name: 'SHOTGUN',
                    damage: 80.5,
                    cooldown: 0.6,
                    range: 400,
                    speed: 700,
                    spread: 0.4,
                    pellets: 5,
                    color: '#f59e0b',
                    icon: '🟠'
                }
            },

            // Skills
            baseCritChance: 0.05,
            critMultiplier: 3,
            dashCooldown: 1.65,
            stealthCooldown: 5.5,
            stealthCost: 25,
            stealthDrain: 35,
            stealthSpeedBonus: 1.5,

            // Level & EXP
            expToNextLevel: 100,
            expLevelMult: 1.5,

            // Passive Unlock ("ซุ่มเสรี")
            passiveUnlockLevel: 3,
            passiveUnlockStealthCount: 5,
            passiveHpBonusPct: 0.5,
            passiveCritBonus: 0.035,
            passiveLifesteal: 0.02,

            // Speed on Hit
            speedOnHit: 20,
            speedOnHitDuration: 0.4
        },

        // ────────────────────────────────
        // 🌾 POOM — คนอีสาน ปาข้าวเหนียว
        // ────────────────────────────────
        poom: {
            name: 'Poom',

            // Entity
            radius: 20,

            // Health & Energy
            hp: 135,
            maxHp: 135,
            energy: 100,
            maxEnergy: 100,
            energyRegen: 12,

            // Movement (ช้ากว่าเก้าเล็กน้อย — เน้น Skill มากกว่า Speed)
            moveSpeed: 300,
            dashSpeed: 520,
            dashDistance: 170,
            dashCooldown: 1.65,

            // Level & EXP
            expToNextLevel: 100,
            expLevelMult: 1.5,

            // 🍚 Weapon: Sticky Rice Throw (Basic Attack)
            riceDamage: 42.5,
            riceCooldown: 0.46,
            riceSpeed: 600,
            riceRange: 750,
            riceColor: '#ffffff',
            critChance: 0.07,
            critMultiplier: 3,

            // 🥢 Skill 1: กินข้าวเหนียว — Buff ตัวเอง
            eatRiceCooldown: 12,
            eatRiceDuration: 5,
            eatRiceSpeedMult: 1.3,
            eatRiceCritBonus: 0.25,

            // 🐍 Skill 2: อัญเชิญพญานาค
            nagaCooldown: 25,
            nagaDuration: 8,
            nagaDamage: 50,
            nagaSpeed: 500,
            nagaSegments: 12,
            nagaSegmentDistance: 28,
            nagaRadius: 20,

            // Speed on Hit
            speedOnHit: 18,
            speedOnHitDuration: 0.35
        }

        // ── เพิ่มตัวละครใหม่ตรงนี้ได้เลย เช่น: ──
        // mint: { name: 'Mint', hp: 90, moveSpeed: 400, ... }
    },

    // ──────────────────────────────────────────────────────────────
    // 👾 BASIC ENEMY (REBALANCED)
    // ──────────────────────────────────────────────────────────────
    enemy: {
        radius: 18,
        colors: ['#ef4444', '#f59e0b', '#8b5cf6'],
        expValue: 10,
        chaseRange: 150,
        projectileSpeed: 500,

        baseHp: 45,
        hpPerWave: 8,
        baseSpeed: 95,
        speedPerWave: 8,
        baseDamage: 9,
        damagePerWave: 2,
        shootCooldown: [2.5, 4.5],
        shootRange: 550
    },

    // ──────────────────────────────────────────────────────────────
    // 🛡️ TANK ENEMY
    // ──────────────────────────────────────────────────────────────
    tank: {
        radius: 25,
        color: '#78716c',
        expValue: 25,
        powerupDropMult: 1.5,

        baseHp: 115,
        hpPerWave: 18,
        baseSpeed: 65,
        speedPerWave: 4,
        baseDamage: 20,
        damagePerWave: 4,
        meleeRange: 55
    },

    // ──────────────────────────────────────────────────────────────
    // 🧙 MAGE ENEMY
    // ──────────────────────────────────────────────────────────────
    mage: {
        radius: 16,
        color: '#a855f7',
        expValue: 30,
        powerupDropMult: 1.3,
        orbitDistance: 300,
        orbitDistanceBuffer: 100,

        baseHp: 30,
        hpPerWave: 7,
        baseSpeed: 75,
        speedPerWave: 7,
        baseDamage: 13,
        damagePerWave: 2,

        soundWaveCooldown: 10,
        soundWaveRange: 300,
        soundWaveConfuseDuration: 0.8,

        meteorCooldown: 13,
        meteorDamage: 28,
        meteorBurnDuration: 3,
        meteorBurnDPS: 4.5
    },

    // ──────────────────────────────────────────────────────────────
    // 👑 BOSS
    // ──────────────────────────────────────────────────────────────
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
        slamRadius: 280,
        slamCooldown: 16,

        graphDamage: 45,
        graphLength: 1500,
        graphDuration: 18,
        graphCooldown: 18,

        log457ChargeDuration: 2,
        log457ActiveDuration: 5,
        log457StunDuration: 1.2,
        log457Cooldown: 26,
        log457AttackBonus: 0.09,
        log457AttackGrowth: 0.04
    },

    // ──────────────────────────────────────────────────────────────
    // 💎 POWER-UPS
    // ──────────────────────────────────────────────────────────────
    powerups: {
        radius: 20,

        dropRate: 0.35,
        lifetime: 13,
        healAmount: 45,
        damageBoost: 1.75,
        damageBoostDuration: 12,
        speedBoost: 1.35,
        speedBoostDuration: 12
    },

    // ──────────────────────────────────────────────────────────────
    // 🌊 WAVE SYSTEM
    // ──────────────────────────────────────────────────────────────
    waves: {
        spawnDistance: 800,
        bossSpawnDelay: 3000,
        maxWaves: 5,
        minKillsForNoDamage: 5,

        enemiesBase: 4,
        enemiesPerWave: 3,
        tankSpawnChance: 0.18,
        mageSpawnChance: 0.15,
        bossEveryNWaves: 3
    },

    // ──────────────────────────────────────────────────────────────
    // 🏆 SCORING
    // ──────────────────────────────────────────────────────────────
    score: {
        basicEnemy: 50,
        tank: 100,
        mage: 150,
        boss: 5000,
        powerup: 100,
        achievement: 500
    },

    // ──────────────────────────────────────────────────────────────
    // 🏫 MTC ROOM SETTINGS
    // ──────────────────────────────────────────────────────────────
    mtcRoom: {
        healRate: 40,
        maxStayTime: 4,
        cooldownTime: 10,
        size: 300
    },

    // ──────────────────────────────────────────────────────────────
    // 🗺️ MAP SETTINGS
    // ──────────────────────────────────────────────────────────────
    map: {
        size: 3000,
        objectDensity: 0.12,
        objectTypes: ['desk', 'tree', 'server', 'datapillar', 'bookshelf', 'blackboard'],
        wallPositions: [
            { x: -1500, y: -50, w: 50, h: 100 },
            { x: 1450,  y: -50, w: 50, h: 100 },
            { x: -50, y: -1500, w: 100, h: 50 },
            { x: -50, y:  1450, w: 100, h: 50 }
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

// ──────────────────────────────────────────────────────────────
// Game Constants
// ──────────────────────────────────────────────────────────────
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
        levelUp:       0.5,
        victory:       0.6,
        achievement:   0.5,
        weaponSwitch:  0.3,
        bossSpecial:   0.5,
        meteorWarning: 0.3
    }
};

// ──────────────────────────────────────────────────────────────
// Achievement Definitions
// ──────────────────────────────────────────────────────────────
const ACHIEVEMENT_DEFS = [
    { id: 'first_blood',    name: 'First Blood',        desc: 'ฆ่าศัตรูตัวแรก',                    icon: '⚔️' },
    { id: 'wave_1',         name: 'Wave Survivor',       desc: 'ผ่าน Wave 1',                       icon: '🌊' },
    { id: 'boss_down',      name: 'Manop Slayer',        desc: 'เอาชนะครูมานพครั้งแรก',             icon: '👑' },
    { id: 'no_damage',      name: 'Untouchable',         desc: 'ผ่าน Wave โดยไม่โดนดาเมจ',          icon: '🛡️' },
    { id: 'crit_master',    name: 'Critical Master',     desc: 'ตีติดคริติคอล 5 ครั้ง',             icon: '💥' },
    { id: 'speedster',      name: 'Speedster',           desc: 'ใช้ Dash 20 ครั้ง',                 icon: '⚡' },
    { id: 'ghost',          name: 'The Ghost of MTC',    desc: 'ซุ่มอ่าน 10 ครั้ง',                 icon: '👻' },
    { id: 'collector',      name: 'MTC Collector',       desc: 'เก็บ Power-up 10 ชิ้น',             icon: '💎' },
    { id: 'weapon_master',  name: 'Weapon Master',       desc: 'ใช้ปืนครบทั้ง 3 แบบ',              icon: '🔫' },
    { id: 'naga_summoner',  name: 'Naga Summoner',       desc: 'อัญเชิญพญานาค 3 ครั้ง',             icon: '🐍' }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BALANCE, GAME_CONFIG, ACHIEVEMENT_DEFS, API_KEY };
}