'use strict';

/**
 * js/config/SystemConfig.js
 * ⚙️ SYSTEM — Engine settings, visuals, map terrain, and API keys.
 */

const API_KEY = (typeof CONFIG_SECRETS !== 'undefined' && CONFIG_SECRETS.GEMINI_API_KEY)
    ? CONFIG_SECRETS.GEMINI_API_KEY
    : '';

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
        shoot: 0.28,
        dash: 0.35,
        hit: 0.35,
        enemyDeath: 0.28,
        powerUp: 0.2,
        heal: 0.35,
        levelUp: 0.4,
        victory: 0.6,
        achievement: 0.4,
        weaponSwitch: 0.25,
        bossSpecial: 0.5,
        meteorWarning: 0.3,
        shellDrop: 0.025,
        sfx: {
            stealth: 0.5,
            clone: 0.4,
            riceShoot: 0.55,
            ritualBurst: 1.1,
            punch: 0.55,
            standRush: 0.35,
            nagaAttack: 0.45,
            vacuum: 0.6,
            detonation: 0.85,
            phantomShatter: 0.45,
        },
        weaponGain: {
            auto: 1.0,
            sniper: 1.6,
            shotgun: 1.3,
        }
    },
    visual: {
        bgColorTop: '#1a1a2e',
        bgColorBottom: '#16213e',
        screenShakeDecay: 0.92,
        gridColor: 'rgba(255, 255, 255, 0.03)'
    },
    abilities: {
        ritual: {
            damagePerStack: 15,
            stackBurstPct: 0.15,
            baseDamage: 75,
            baseDamagePct: 0.15,
            cooldown: 15,
            castTime: 0.6,
            windowDuration: 3.0,
            range: 280,
            fullCeremonySpeedPct: 0.25,
            fullCeremonyExtraSlowPct: 0.05,
            maxPoints: 3
        }
    }
};

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
            primary: '#1a1a2e',
            secondary: '#e8e8e8',
            accent: '#7ec8e3'
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

const MAP_CONFIG = {
    arena: {
        radius: 1500,
        haloColor: 'rgba(180, 100, 20, {a})',
        midColor: 'rgba(120, 60, 10, {a})',
        rimColor: 'rgba(250, 180, 30, {a})',
        dashColor: 'rgba(245, 158, 11, {a})',
        haloColorBase: 'rgb(180,100,20)',
        midColorBase: 'rgb(120,60,10)',
        rimColorBase: 'rgb(250,180,30)',
        dashColorBase: 'rgb(245,158,11)',
        haloAlphaBase: 0.12,
        midAlphaBase: 0.20,
        rimAlphaBase: 0.65,
        dashAlphaBase: 0.38,
        rimGlowBlur: 28,
        rimGlowColor: 'rgba(250, 180, 30, 0.95)',
    },
    landmark: {
        outerRadius: 90,
        innerRadius: 62,
        ringWidth: 2.5,
        outerColor: 'rgba(250, 180, 30, {a})',
        innerColor: 'rgba(34,  211, 238, {a})',
        outerColorBase: 'rgb(250,180,30)',
        innerColorBase: 'rgb(34,211,238)',
        spokeColorBase: 'rgb(250,180,30)',
        spokeCount: 8,
        spokeAlpha: 0.18,
        glowBlur: 18,
        glowColor: 'rgba(250, 180, 30, 0.7)',
        rotSpeedOuter: 0.18,
        rotSpeedInner: -0.28,
        pulseSpeed: 1.4,
        outerAlphaBase: 0.55,
        innerAlphaBase: 0.45,
    },
    hex: {
        size: 64,
        fillColor: 'rgba(130, 70, 15, {a})',
        strokeColor: 'rgba(210, 130, 25, {a})',
        fillAlpha: 0.07,
        strokeAlpha: 0.22,
        falloffRadius: 1650,
    },
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
        glowWidth: 16,
        coreWidth: 3.5,
        glowAlphaBase: 0.10,
        coreAlphaBase: 0.65,
        coreGlowBlur: 18,
        packetCount: 3,
        packetSpeed: 0.45,
        packetRadius: 4.5,
        packetAuraRadius: 8,
        elbowRadius: 5,
    },
    objects: {
        desk: {
            screenGlow: 'rgba(250,200,100,0.15)',
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
            circuit: 'rgba(217,119,6,',
        },
        bookshelf: {
            frameBody: '#92400e',
            frameSide: '#a16207',
            shelfBoard: '#b45309',
            bookGloss: 'rgba(255,255,255,0.25)',
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
    zones: {
        serverFarm: {
            x: 430, y: -680, w: 800, h: 700,
            floorColor: 'rgba(6, 182, 212, 0.16)',
            gridColor: 'rgba(6, 182, 212, 0.25)',
            gridSize: 36,
            accentColor: 'rgba(34, 211, 238, 0.35)',
            label: 'SERVER FARM',
            ambientColor: 'rgba(34, 211, 238, 0.90)',
        },
        library: {
            x: -1230, y: -680, w: 800, h: 700,
            floorColor: 'rgba(180, 120, 20, 0.18)',
            gridColor: 'rgba(251, 191, 36, 0.22)',
            gridSize: 48,
            accentColor: 'rgba(253, 224, 71, 0.30)',
            label: 'ARCHIVES',
            ambientColor: 'rgba(251, 191, 36, 0.90)',
        },
        courtyard: {
            x: -600, y: 400, w: 1200, h: 650,
            floorColor: 'rgba(34, 197, 94, 0.15)',
            gridColor: 'rgba(74, 222, 128, 0.20)',
            gridSize: 55,
            accentColor: 'rgba(134, 239, 172, 0.28)',
            label: 'COURTYARD',
            ambientColor: 'rgba(134, 239, 172, 0.90)',
        },
        lectureHallL: {
            x: -1100, y: 500, w: 420, h: 400,
            floorColor: 'rgba(168, 85, 247, 0.12)',
            gridColor: 'rgba(192, 132, 252, 0.18)',
            gridSize: 40,
            accentColor: 'rgba(216, 180, 254, 0.22)',
            label: 'LECTURE A',
            ambientColor: 'rgba(216, 180, 254, 0.85)',
        },
        lectureHallR: {
            x: 680, y: 500, w: 420, h: 400,
            floorColor: 'rgba(168, 85, 247, 0.12)',
            gridColor: 'rgba(192, 132, 252, 0.18)',
            gridSize: 40,
            accentColor: 'rgba(216, 180, 254, 0.22)',
            label: 'LECTURE B',
            ambientColor: 'rgba(216, 180, 254, 0.85)',
        },
        database: {
            x: 330, y: -660, w: 340, h: 340,
            floorColor: 'rgba(251, 191, 36, 0.06)',
            gridColor: 'rgba(251, 191, 36, 0.18)',
            gridSize: 30,
            accentColor: 'rgba(251, 191, 36, 0.30)',
            label: 'MTC DATABASE',
            ambientColor: 'rgba(251, 191, 36, 0.90)',
        },
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
    auras: {
        database: {
            worldX: 500,
            worldY: -490,
            innerRgb: '250, 180, 30',
            outerRgb: '120, 60, 10',
            radius: 160,
            phase: 0.0,
        },
        shop: {
            worldX: -500,
            worldY: 490,
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
        innerAlphaBase: 0.40,
        midAlphaBase: 0.20,
        outerAlphaBase: 0.08,
        rimAlphaBase: 0.45,
        rimWidth: 2.5,
        rimGlowBlur: 22,
        dashAlphaBase: 0.18,
        dashOuterMult: 1.35,
    },
};

window.API_KEY = API_KEY;
window.GAME_CONFIG = GAME_CONFIG;
window.VISUALS = VISUALS;
window.MAP_CONFIG = MAP_CONFIG;
