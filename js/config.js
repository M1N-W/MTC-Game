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
        friction:     0.88,
        acceleration: 1800
    },
    player: {
        obstacleWarningRange:    35,
        obstacleBuffPower:       1.25,
        obstacleBuffDuration:    1.0,
        obstacleWarningCooldown: 3000,
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
            hp: 120, maxHp: 120,
            energy: 100, maxEnergy: 100,
            energyRegen: 15,
            moveSpeed: 325,
            dashSpeed: 550,
            dashDistance: 180,
            weapons: {
                auto: {
                    name: 'AUTO RIFLE',
                    damage: 21.5, cooldown: 0.195,
                    range: 900, speed: 900,
                    spread: 0, pellets: 1,
                    color: '#3b82f6', icon: '🔵'
                },
                sniper: {
                    name: 'SNIPER',
                    damage: 120, cooldown: 0.85,
                    range: 1200, speed: 1200,
                    spread: 0, pellets: 1,
                    color: '#ef4444', icon: '🔴'
                },
                shotgun: {
                    name: 'SHOTGUN',
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
            speedOnHitDuration: 0.4,
            damageMultiplierPerLevel:  0.06,
            cooldownReductionPerLevel: 0.03,
            maxHpPerLevel:             0
        },
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
            heatWaveRange: 150,
            heatWaveCooldown: 0.28,
            wanchaiDuration: 4.0,
            wanchaiCooldown: 12,
            wanchaiEnergyCost: 35,
            wanchaiPunchRate: 0.06,
            wanchaiDamage: 30,
            standSpeedMod: 1.5,
            standDamageReduction: 0.50,
            standCritBonus: 0.50,
            baseCritChance: 0.06,
            critMultiplier: 2.0,
            stealthCooldown: 12,
            stealthCost: 9999,
            stealthDrain: 0,
            stealthSpeedBonus: 1.0,
            expToNextLevel: 100,
            expLevelMult: 1.5,
            passiveUnlockLevel: 5,
            passiveUnlockStealthCount: 99,
            passiveHpBonusPct: 0.25,
            passiveCritBonus: 0.04,
            passiveLifesteal: 0.01,
            speedOnHit: 15,
            speedOnHitDuration: 0.35,
            weapons: {
                auto:    { name: 'HEAT WAVE', damage: 34, cooldown: 0.28, range: 150, speed: 900, spread: 0.08, pellets: 1, color: '#dc2626', icon: '🔥' },
                sniper:  { name: 'HEAT WAVE', damage: 34, cooldown: 0.28, range: 150, speed: 900, spread: 0.08, pellets: 1, color: '#dc2626', icon: '🔥' },
                shotgun: { name: 'HEAT WAVE', damage: 34, cooldown: 0.28, range: 150, speed: 900, spread: 0.08, pellets: 1, color: '#dc2626', icon: '🔥' }
            },
            damageMultiplierPerLevel:  0.05,
            cooldownReductionPerLevel: 0.03,
            maxHpPerLevel:             8
        },
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
            riceDamage: 50,
            riceCooldown: 0.46,
            riceSpeed: 600,
            riceRange: 750,
            riceColor: '#ffffff',
            critChance: 0.09,
            critMultiplier: 3,
            eatRiceCooldown: 12,
            eatRiceDuration: 5,
            eatRiceSpeedMult: 1.3,
            eatRiceCritBonus: 0.25,
            nagaCooldown: 25,
            nagaDuration: 8,
            nagaDamage: 72,
            nagaSpeed: 525,
            nagaSegments: 12,
            nagaSegmentDistance: 28,
            nagaRadius: 20,
            speedOnHit: 18,
            speedOnHitDuration: 0.35,
            damageMultiplierPerLevel:  0.05,
            cooldownReductionPerLevel: 0.04,
            maxHpPerLevel:             5
        }
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
        bobSpeed: 3.5
    },
    enemy: {
        radius: 18,
        colors: ['#ef4444', '#f59e0b', '#8b5cf6'],
        expValue: 10,
        chaseRange: 150,
        projectileSpeed: 500,
        baseHp: 40, hpPerWave: 0.25,
        baseSpeed: 85, speedPerWave: 6,
        baseDamage: 8, damagePerWave: 1.5,
        shootCooldown: [2.5, 4.5],
        shootRange: 550
    },
    tank: {
        radius: 25,
        color: '#78716c',
        expValue: 25,
        powerupDropMult: 1.5,
        baseHp: 100, hpPerWave: 0.55,
        baseSpeed: 60, speedPerWave: 3,
        baseDamage: 18, damagePerWave: 3,
        meleeRange: 55
    },
    mage: {
        radius: 16,
        color: '#a855f7',
        expValue: 30,
        powerupDropMult: 1.3,
        orbitDistance: 300,
        orbitDistanceBuffer: 100,
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
        phase2: {
            barkDamage: 25,
            barkRange: 600,
            barkCooldown: 3.5,
            enrageSpeedMult: 1.65,
            dogColor: '#d97706'
        },
        bossDog: {
            hp: 1500,
            speed: 250,
            damage: 22,
            radius: 20,
            color: '#d97706'
        },
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
        goldfishMinion: {
            hp:        100,
            speed:     165,
            damage:    18,
            radius:    12,
            wobbleAmp: 40,
            wobbleFreq: 3.5,
            color:     '#fb923c'
        },
        bubbleProjectile: {
            speed:  100,
            damage: 30,
            radius: 18,
            color:  'rgba(186, 230, 253, 0.6)'
        }
    },
    powerups: {
        radius: 20,
        dropRate: 0.15,
        lifetime: 14,
        healAmount: 20,
        damageBoost: 1.5,
        damageBoostDuration: 5,
        speedBoost: 1.35,
        speedBoostDuration: 5
    },
    waves: {
        spawnDistance: 800,
        bossSpawnDelay: 3000,
        maxWaves:            15,       // ← extended from 9 (5 boss encounters at waves 3,6,9,12,15)
        minKillsForNoDamage: 5,
        enemiesBase: 4,
        enemiesPerWave: 2,
        tankSpawnChance: 0.12,
        mageSpawnChance: 0.15,
        bossEveryNWaves: 3,
        glitchGracePeriod: 4000
    },
    score: {
        basicEnemy: 80,
        tank: 160,
        mage: 220,
        boss: 5000,
        powerup: 100,
        achievement: 500
    },
    mtcRoom: {
        healRate: 40,
        maxStayTime: 4,
        cooldownTime: 10,
        size: 300
    },
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
// 🎮 GAME CONFIG
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
            menu: 'assets/audio/menu.mp3',
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
            primary:   '#dc2626',
            secondary: '#fb7185',
            accent:    '#f97316'
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

// ══════════════════════════════════════════════════════════════
// 📝 GAME TEXTS
// ══════════════════════════════════════════════════════════════
const GAME_TEXTS = {
    wave: {
        badge:              (wave) => `WAVE ${wave}`,
        floatingTitle:      (wave) => `WAVE ${wave}`,
        bossIncoming:       'BOSS INCOMING!',
        bossIncomingRider:  'BOSS INCOMING!🐕',
        bossIncomingFish:   'BOSS INCOMING!🐟',
        glitchWave:         '⚡ GLITCH WAVE ⚡',
        glitchAnomaly:      'SYSTEM ANOMALY DETECTED...⚠️',
        glitchControls:     'CONTROLS INVERTED!',
        glitchBrace:        'BRACE FOR IMPACT...',
        glitchCrisisHp:     (bonus) => `🛡️ +${bonus} BONUS HP`,
        spawnCountdown:     (secs) => `⚡ SPAWNING IN ${secs}...`,
        chaosBegins:        '💀 CHAOS BEGINS!',
    },
    shop: {
        open:               '🛒 MTC CO-OP STORE',
        resumed:            '▶ RESUMED',
        notEnoughScore:     'คะแนนไม่พอ! 💸',
        hpFull:             'HP เต็มแล้ว!',
        healPickup:         (amt) => `+${amt} HP 🧃`,
        dmgBoostActive:     '🔧 DMG. ×1.1!',
        dmgBoostExtended:   '🔧 DMG +30s.',
        dmgBoostExpired:    'DMG+ Expired',
        spdBoostActive:     '👟 SPD. ×1.1!',
        spdBoostExtended:   '👟 SPD +30s.',
        spdBoostExpired:    'SPD+ Expired',
    },
    combat: {
        poomCrit:           'ข้าวเหนียวคริติคอล! 💥',
        highGround:         'HIGH GROUND!',
        droneOnline:        '🤖 DRONE ONLINE',
    },
    time: {
        bulletTime:         '🕐 BULLET TIME',
        normalSpeed:        '▶▶ NORMAL',
        noEnergy:           'NO ENERGY! ⚡',
        energyDepleted:     'ENERGY DEPLETED ⚡',
        recharging:         'RECHARGING ⚡',
    },
    admin: {
        terminal:           '💻 ADMIN TERMINAL',
        resumed:            '▶ RESUMED',
        database:           '📚 MTC DATABASE',
        sessionWelcome:     'Session started. Welcome, root.',
        sessionHelp:        'Run "help" to list available commands.',
        noPlayer:           'ERROR : No active player session.',
        authOk:             'Authenticating root privilege... OK',
        healInject:         (gained) => `Injecting ${gained} HP units into player entity...`,
        healResult:         (hp, max) => `COMMAND EXECUTED — HP : ${hp} / ${max}`,
        healFloat:          (gained) => `+${gained} HP 💉 [ADMIN]`,
        scorePatching:      'Patching score register... +5000',
        scoreResult:        (score) => `COMMAND EXECUTED — Score : ${score}`,
        scoreFloat:         '+5000 🪙 [ADMIN]',
        nextSigkill:        'Sending SIGKILL to all enemy processes...',
        nextResult:         (killed) => `COMMAND EXECUTED — ${killed} process(es) terminated. Wave advancing...`,
        nextFloat:          '💀 WAVE SKIP [ADMIN]',
        closingSession:     'Closing session...',
        niceTry:            'nice try LOL',
        accessDenied:       'ACCESS DENIED — MTC Policy §4.2 violation logged.',
        whoami:             'root (player infiltrated server)',
        cmdNotFound:        (raw) => `bash: ${raw}: command not found`,
        sudoNotFound:       (cmd) => `sudo: ${cmd}: command not found`,
        sudoAccessDenied:   'ACCESS DENIED — Unknown sudo command.',
        typeHelp:           'Type "help" for available commands.',
        catPassword:        'hunter2',
        catPasswordWarn:    "...wait, you weren't supposed to see that.",
        sandwich:           'What? Make it yourself.',
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
            { text: 'drwxr-xr-x  secrets/',               cls: 'cline-info' },
            { text: 'drwxr-xr-x  grades/',                cls: 'cline-info' },
            { text: '-rw-------  kru_manop_passwords.txt', cls: 'cline-warn' },
            { text: '-rw-r--r--  exam_answers_2024.pdf',   cls: 'cline-ok'   },
        ],
    },
    ai: {
        loading:            'กำลังโหลดภารกิจ...',
        missionPrefix:      (name) => `ภารกิจ "${name}"`,
        missionFallback:    'ภารกิจ "พิชิตครูมานพ"',
        reportFallback:     'ตั้งใจเรียนให้มากกว่านี้นะ...',
    },
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
        radius:         1500,
        haloColor:      'rgba(120, 60, 255, {a})',
        midColor:       'rgba(80, 30, 200, {a})',
        rimColor:       'rgba(180, 100, 255, {a})',
        dashColor:      'rgba(200, 120, 255, {a})',
        haloAlphaBase:  0.08,
        midAlphaBase:   0.15,
        rimAlphaBase:   0.55,
        dashAlphaBase:  0.30,
        rimGlowBlur:    20,
        rimGlowColor:   'rgba(150, 80, 255, 0.9)',
    },

    // ── Tech-hex grid ──────────────────────────────────────────
    hex: {
        size:           64,
        fillColor:      'rgba(20, 50, 110, {a})',
        strokeColor:    'rgba(40, 110, 220, {a})',
        fillAlpha:      0.06,
        strokeAlpha:    0.20,
        falloffRadius:  1400,
    },

    // ── Circuit paths ──────────────────────────────────────────
    // Update `to` coords here when landmark positions change in game.js
    paths: {
        database: {
            from:       { x: 0,    y: 0    },
            to:         { x: 350,  y: -350 },
            coreColor:  '#00e5ff',
            glowColor:  'rgba(0, 210, 255, 0.85)',
            phase:      0.0,
        },
        shop: {
            from:       { x: 0,    y: 0    },
            to:         { x: -350, y:  350 },
            coreColor:  '#ffb300',
            glowColor:  'rgba(255, 165, 0, 0.85)',
            phase:      2.094,
        },
        // Shared path style
        glowWidth:          12,
        coreWidth:          2.2,
        glowAlphaBase:      0.10,
        coreAlphaBase:      0.65,
        coreGlowBlur:       14,
        packetCount:        2,
        packetSpeed:        0.38,
        packetRadius:       3.5,
        packetAuraRadius:   8,
        elbowRadius:        5,
    },

    // ── Zone auras ─────────────────────────────────────────────
    auras: {
        database: {
            worldX:     350,
            worldY:     -350,
            innerRgb:   '0, 220, 255',
            outerRgb:   '0, 90, 200',
            radius:     130,
            phase:      0.0,
        },
        shop: {
            worldX:     -350,
            worldY:      350,
            innerRgb:   '255, 190, 30',
            outerRgb:   '200, 80, 0',
            radius:     130,
            phase:      1.6,
        },
        origin: {
            worldX:     0,
            worldY:     0,
            innerRgb:   '130, 60, 255',
            outerRgb:   '60, 20, 160',
            radius:     80,
            phase:      3.2,
        },
        // Shared aura style
        innerAlphaBase:     0.22,
        midAlphaBase:       0.10,
        outerAlphaBase:     0.04,
        rimAlphaBase:       0.28,
        rimWidth:           2,
        rimGlowBlur:        16,
        dashAlphaBase:      0.12,
        dashOuterMult:      1.3,
    },
};

window.MAP_CONFIG       = MAP_CONFIG;
window.BALANCE          = BALANCE;
window.SHOP_ITEMS       = SHOP_ITEMS;
window.GAME_CONFIG      = GAME_CONFIG;
window.VISUALS          = VISUALS;
window.ACHIEVEMENT_DEFS = ACHIEVEMENT_DEFS;
window.API_KEY          = API_KEY;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BALANCE, SHOP_ITEMS, GAME_CONFIG, VISUALS, ACHIEVEMENT_DEFS, API_KEY, GAME_TEXTS, MAP_CONFIG };
}