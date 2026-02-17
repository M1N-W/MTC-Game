/**
 * ⚙️ MTC: ENHANCED EDITION - Configuration
 * All game balance settings and constants
 */

// API Configuration
const API_KEY = CONFIG_SECRETS.GEMINI_API_KEY; 

// Enhanced Balance Configuration
const BALANCE = {
    // 👨‍🎓 PLAYER STATS
    player: {
        // Health & Energy
        hp: 110,
        maxHp: 110,
        energy: 100,
        maxEnergy: 100,
        
        // Movement (REBALANCED)
        moveSpeed: 350,        // Reduced from 380
        dashSpeed: 550,        // Reduced from 1000
        dashDistance: 180,     // Reduced from 200
        friction: 0.88,        
        acceleration: 1800,
        
        // Weapon System (NEW)
        weapons: {
            auto: {
                name: 'AUTO RIFLE',
                damage: 23,
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
                damage: 115,        
                cooldown: 0.9,     // Slow fire rate
                range: 1200,       // Longest range
                speed: 1200,
                spread: 0,
                pellets: 1,
                color: '#ef4444',
                icon: '🔴'
            },
            shotgun: {
                name: 'SHOTGUN',
                damage: 66,        // 3x damage total
                cooldown: 0.6,
                range: 400,        // Shortest range
                speed: 700,
                spread: 0.4,       // High spread
                pellets: 5,        // Multiple pellets
                color: '#f59e0b',
                icon: '🟠'
            }
        },
        
        // Skills
        critMultiplier: 3,
        dashCooldown: 1.65,     // Increased from 1.2
        stealthCooldown: 5.5,  // Increased from 5.0
        stealthCost: 25,
        stealthDrain: 35,
        stealthSpeedBonus: 1.5,
        
        // Speed on Hit (REBALANCED)
        speedOnHit: 20,        // Reduced from 25
        speedOnHitDuration: 0.4
    },

    // 🌾 POOM CHARACTER STATS
    poom: {
        // Health & Energy
        hp: 135,
        maxHp: 135,
        energy: 100,
        maxEnergy: 100,

        // Movement (ช้ากว่าเก้าเล็กน้อย — เน้น Skill มากกว่า Speed)
        moveSpeed: 300,
        dashSpeed: 520,
        dashDistance: 170,
        friction: 0.88,
        acceleration: 1800,
        dashCooldown: 1.65,

        // 🍚 Weapon: Sticky Rice Throw (Basic Attack)
        riceDamage: 38,
        riceCooldown: 0.6,
        riceSpeed: 600,
        riceRange: 750,
        riceColor: '#ffffff',        // สีข้าวเหนียวขาวสะอาด
        critChance: 0.07,            // Base 7% crit chance
        critMultiplier: 3,           // Crit multiplier

        // 🥢 Skill 1: กินข้าวเหนียว — Buff ตัวเอง
        eatRiceCooldown: 12,         // cooldown 12s
        eatRiceDuration: 5,          // buff ยาว 5s
        eatRiceSpeedMult: 1.3,       // +30% move speed (ตาม Spec)
        eatRiceCritBonus: 0.25,      // +25% crit chance ขณะ Buff (ตาม Spec)

        // 🐍 Skill 2: อัญเชิญพญานาค
        nagaCooldown: 25,            // cooldown 25s (ตาม Spec)
        nagaDuration: 8,             // นาคคงอยู่ 8s (ตาม Spec)
        nagaDamage: 50,              // damage ต่อการสัมผัส (ตาม Spec)
        nagaSpeed: 500,              // ความเร็วนาค
        nagaSegments: 12,            // 12 ปล้อง (ตาม Spec)
        nagaSegmentDistance: 28,     // ระยะห่างระหว่างปล้อง
        nagaRadius: 20,              // ขนาด hitbox ต่อปล้อง

        // Speed on Hit
        speedOnHit: 18,
        speedOnHitDuration: 0.35
    },
    
    // 👾 BASIC ENEMY (REBALANCED)
    enemy: {
        baseHp: 45,            // Reduced from 50
        hpPerWave: 8,          // Reduced from 10
        baseSpeed: 95,         // Reduced from 100
        speedPerWave: 8,       // Reduced from 10
        baseDamage: 9,         // Reduced from 10
        damagePerWave: 2,
        shootCooldown: [2.5, 4.5],
        shootRange: 550
    },
    
    // 🛡️ TANK ENEMY (REBALANCED)
    tank: {
        baseHp: 115,           // Reduced from 120
        hpPerWave: 18,         // Reduced from 20
        baseSpeed: 65,         // Reduced from 70
        speedPerWave: 4,       // Reduced from 5
        baseDamage: 20,        // Reduced from 25
        damagePerWave: 4,      // Reduced from 5
        meleeRange: 55
    },
    
    // 🧙 MAGE ENEMY (REBALANCED)
    mage: {
        baseHp: 30,            // Reduced from 35
        hpPerWave: 7,          // Reduced from 8
        baseSpeed: 75,         // Reduced from 80
        speedPerWave: 7,       // Reduced from 8
        baseDamage: 13,        // Reduced from 15
        damagePerWave: 2,      // Reduced from 3
        
        // Sound Wave
        soundWaveCooldown: 10,
        soundWaveRange: 300,
        soundWaveConfuseDuration: 0.8,
        
        // Meteor
        meteorCooldown: 13,
        meteorDamage: 28,      // Reduced from 30
        meteorBurnDuration: 3,
        meteorBurnDPS: 4.5       // Reduced from 5
    },
    
    // 👑 BOSS (REBALANCED)
    boss: {
        baseHp: 2350,          // Reduced from 2500
        hpMultiplier: 1,
        moveSpeed: 130,        // Reduced from 150
        phase2Speed: 175,      // Reduced from 200
        phase2Threshold: 0.5,
        
        // Basic Attacks
        chalkDamage: 13,       
        ultimateDamage: 26,    // Reduced from 30
        ultimateBullets: 18,   // Reduced from 24
        phase2UltimateBullets: 26, // Reduced from 32
        
        // Special Skills
        slamDamage: 35,        // Reduced from 40
        slamRadius: 280,       // Reduced from 300
        slamCooldown: 16,
        
        graphDamage: 45,       
        graphLength: 1500,
        graphDuration: 18,     // ⭐ ระยะเวลาแสดงผลของสกิล Deadly Graph (วินาที)
        graphCooldown: 18,
        
        log457ChargeDuration: 2,
        log457ActiveDuration: 5,
        log457StunDuration: 1.2,
        log457Cooldown: 26,
        log457AttackBonus: 0.09,
        log457AttackGrowth: 0.04
    },
    
    // 💎 POWER-UPS (REBALANCED)
    powerups: {
        dropRate: 0.35,
        lifetime: 13,
        healAmount: 45,        // Reduced from 50
        damageBoost: 1.75,      // Reduced from 2.0
        damageBoostDuration: 12,
        speedBoost: 1.35,       // Reduced from 1.5
        speedBoostDuration: 12
    },
    
    // 🌊 WAVE SYSTEM (REBALANCED)
    waves: {
        enemiesBase: 4,        // Reduced from 5
        enemiesPerWave: 3,
        tankSpawnChance: 0.18, // Reduced from 0.20
        mageSpawnChance: 0.15, // Reduced from 0.15
        bossEveryNWaves: 3
    },
    
    // 🏆 SCORING
    score: {
        basicEnemy: 50,
        tank: 100,
        mage: 150,
        boss: 5000,
        powerup: 100,
        achievement: 500
    },
    
    // 🏫 MTC ROOM SETTINGS
    mtcRoom: {
        healRate: 40,      // เลือดที่ฟื้นฟูต่อวินาที
        maxStayTime: 4,    // ระยะเวลาที่อยู่ได้นานที่สุด (วินาที)
        cooldownTime: 10,  // ระยะเวลารอคอยก่อนเข้าได้ใหม่ (วินาที)
        size: 300          // ขนาดของห้อง
    },

    // 🏫 MAP SETTINGS
    // 🏫 MAP SETTINGS
    map: {
        size: 3000,            // Map size (3000x3000)
        objectDensity: 0.12,   // ความหนาแน่นของวัตถุ (12% ของพื้นที่)
        objectTypes: ['desk', 'tree', 'server', 'datapillar', 'bookshelf', 'blackboard'],
        wallPositions: [
            { x: -1500, y: -50, w: 50, h: 100 },
            { x: 1450, y: -50, w: 50, h: 100 },
            { x: -50, y: -1500, w: 100, h: 50 },
            { x: -50, y: 1450, w: 100, h: 50 }
        ],

        // 🎨 MAP COLOR PALETTE — used by all procedural draw helpers in map.js
        mapColors: {
            // Floor (MTC Room parquet tiles)
            floor:            '#d4c5a0',
            floorAlt:         '#c9b892',

            // Tech Trees
            treeLight:        '#86efac',
            treeMid:          '#4ade80',
            treeDark:         '#16a34a',
            treeTrunk:        '#92400e',

            // Desks
            deskTop:          '#854d0e',
            deskLegs:         '#713f12',

            // Server rack
            serverBody:       '#1e293b',
            serverLightOn:    '#22c55e',
            serverLightOff:   '#166534',

            // Data Pillar (circuit-pattern)
            pillarBase:       '#475569',
            pillarCircuit:    '#06b6d4',

            // Books (cycled per book spine)
            bookColors: ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316'],

            // Walls
            wallColor:        '#e2d5c0',
            wallBrick:        '#c9b18a',

            // Blackboard / Whiteboard
            whiteboardGreen:  '#1a4731',
            chalkWhite:       '#f0ebe0'
        }
    }
};

// Game Constants
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
        screenShakeDecay: 0.9
    },
    
    input: {
        joystickDeadzone: 0.1,
        joystickMaxDistance: 40
    }
};

// Achievement Definitions
const ACHIEVEMENT_DEFS = [
    { id: 'first_blood', name: 'First Blood', desc: 'ฆ่าศัตรูตัวแรก', icon: '⚔️' },
    { id: 'wave_1', name: 'Wave Survivor', desc: 'ผ่าน Wave 1', icon: '🌊' },
    { id: 'boss_down', name: 'Manop Slayer', desc: 'เอาชนะครูมานพครั้งแรก', icon: '👑' },
    { id: 'no_damage', name: 'Untouchable', desc: 'ผ่าน Wave โดยไม่โดนดาเมจ', icon: '🛡️' },
    { id: 'crit_master', name: 'Critical Master', desc: 'ตีติดคริติคอล 5 ครั้ง', icon: '💥' },
    { id: 'speedster', name: 'Speedster', desc: 'ใช้ Dash 20 ครั้ง', icon: '⚡' },
    { id: 'ghost', name: 'The Ghost of MTC', desc: 'ซุ่มอ่าน 10 ครั้ง', icon: '👻' },
    { id: 'collector', name: 'MTC Collector', desc: 'เก็บ Power-up 10 ชิ้น', icon: '💎' },
    { id: 'weapon_master', name: 'Weapon Master', desc: 'ใช้ปืนครบทั้ง 3 แบบ', icon: '🔫' },
    { id: 'naga_summoner', name: 'Naga Summoner', desc: 'อัญเชิญพญานาค 3 ครั้ง', icon: '🐍' }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BALANCE, GAME_CONFIG, ACHIEVEMENT_DEFS, API_KEY };
}