/**
 * ⚙️ MTC: ENHANCED EDITION - Configuration
 * All game balance settings and constants
 */

// API Configuration
const API_KEY = "AIzaSyAZrYjazB7HHLERjKFtVazz-Mi5dfmR0v8"; // Add your Gemini API key here

// Enhanced Balance Configuration
const BALANCE = {
    // 👨‍🎓 PLAYER STATS
    player: {
        // Health & Energy
        hp: 125,
        maxHp: 125,
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
                damage: 22,
                cooldown: 0.19,
                range: 900,
                speed: 900,
                spread: 0,
                pellets: 1,
                color: '#3b82f6',
                icon: '🔵'
            },
            sniper: {
                name: 'SNIPER',
                damage: 88,        
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
        critMultiplier: 2.8,
        dashCooldown: 1.8,     // Increased from 1.2
        stealthCooldown: 5.5,  // Increased from 5.0
        stealthCost: 25,
        stealthDrain: 35,
        stealthSpeedBonus: 1.5,
        
        // Speed on Hit (REBALANCED)
        speedOnHit: 20,        // Reduced from 25
        speedOnHitDuration: 0.4
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
        soundWaveConfuseDuration: 0.6,
        
        // Meteor
        meteorCooldown: 13,
        meteorDamage: 28,      // Reduced from 30
        meteorBurnDuration: 3,
        meteorBurnDPS: 4.5       // Reduced from 5
    },
    
    // 👑 BOSS (REBALANCED)
    boss: {
        baseHp: 2300,          // Reduced from 2500
        hpMultiplier: 1,
        moveSpeed: 130,        // Reduced from 150
        phase2Speed: 180,      // Reduced from 200
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
        
        graphDamage: 40,       
        graphLength: 950,      
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
        dropRate: 0.2,
        lifetime: 12,
        healAmount: 45,        // Reduced from 50
        damageBoost: 1.6,      // Reduced from 2.0
        damageBoostDuration: 11,
        speedBoost: 1.3,       // Reduced from 1.5
        speedBoostDuration: 11
    },
    
    // 🌊 WAVE SYSTEM (REBALANCED)
    waves: {
        enemiesBase: 4,        // Reduced from 5
        enemiesPerWave: 3,
        tankSpawnChance: 0.18, // Reduced from 0.20
        mageSpawnChance: 0.14, // Reduced from 0.15
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
    
    // 🏫 MAP SETTINGS (NEW)
    map: {
        size: 3000,            // Map size (3000x3000)
        objectDensity: 0.25,    // 30% chance of object spawning
        objectTypes: ['desk', 'chair', 'cabinet', 'blackboard'],
        wallPositions: [
            { x: -1500, y: -50, w: 50, h: 100 },
            { x: 1450, y: -50, w: 50, h: 100 },
            { x: -50, y: -1500, w: 100, h: 50 },
            { x: -50, y: 1450, w: 100, h: 50 }
        ]
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
    { id: 'boss_down', name: 'Manop Slayer', desc: 'เอาชนะครูมานพ', icon: '👑' },
    { id: 'no_damage', name: 'Untouchable', desc: 'ผ่าน Wave โดยไม่โดนดาเมจ', icon: '🛡️' },
    { id: 'crit_master', name: 'Critical Master', desc: 'ทำ Crit 5 ครั้ง', icon: '💥' },
    { id: 'speedster', name: 'Speedster', desc: 'ใช้ Dash 20 ครั้ง', icon: '⚡' },
    { id: 'ghost', name: 'The Ghost MTC', desc: 'ใช้ Stealth 10 ครั้ง', icon: '👻' },
    { id: 'collector', name: 'MTC Collector', desc: 'เก็บ Power-up 10 อัน', icon: '💎' },
    { id: 'weapon_master', name: 'Weapon Master', desc: 'ใช้ปืนทั้ง 3 แบบ', icon: '🔫' }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BALANCE, GAME_CONFIG, ACHIEVEMENT_DEFS, API_KEY };
}
