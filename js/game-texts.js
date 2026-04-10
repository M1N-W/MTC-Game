'use strict';
/**
 * js/game-texts.js
 * Extracted UI copy and localized gameplay text constants.
 */

const GAME_TEXTS = {
    wave: {
        badge: (wave) => `WAVE ${wave}`,
        floatingTitle: (wave) => `WAVE ${wave}`,
        bossIncoming: 'BOSS INCOMING!',
        bossIncomingRider: 'BOSS INCOMING!๐•',
        bossIncomingFish: 'BOSS INCOMING!๐',
        // โ”€โ”€ BossFirst (Kru First) announce texts โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        firstIncoming: 'โ๏ธ KRU FIRST โ€” BOSS INCOMING!',
        firstAdvanced: 'โ๏ธ KRU FIRST โ€” ADVANCED MODE โก',
        firstTagline: 'F=ma ยท v=u+at ยท เธซเธฅเธเนเธซเนเธ—เธฑเธ!',
        firstTaglineAdvanced: 'F=ma ยท E=mcยฒ ยท เนเธกเนเธกเธตเธ—เธฒเธเธฃเธญเธ”!',
        glitchWave: 'โก GLITCH WAVE โก',
        glitchAnomaly: 'SYSTEM ANOMALY DETECTED...โ ๏ธ',
        glitchControls: 'CONTROLS INVERTED!',
        glitchBrace: 'BRACE FOR IMPACT...',
        glitchCrisisHp: (bonus) => `๐ก๏ธ +${bonus} BONUS HP`,
        spawnCountdown: (secs) => `โก SPAWNING IN ${secs}...`,
        chaosBegins: '๐’€ CHAOS BEGINS!',
        // โ”€โ”€ Special wave event banners โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        fogBannerTitle: '๐ซ๏ธ FOG WAVE',
        fogBannerSubtitle: 'โ€” RADAR OFFLINE โ€”',
        speedBannerTitle: 'โก SPEED WAVE',
        speedBannerSubtitle: 'โ€” ENEMIES ACCELERATED โ€”',
    },
    shop: {
        open: '๐’ MTC CO-OP STORE',
        resumed: 'โ–ถ RESUMED',
        notEnoughScore: 'เธเธฐเนเธเธเนเธกเนเธเธญ! ๐’ธ',
        hpFull: 'HP เน€เธ•เนเธกเนเธฅเนเธง!',
        healPickup: (amt) => `+${amt} HP ๐ง`,
        dmgBoostActive: '๐”ง DMG. ร—1.1!',
        dmgBoostExtended: '๐”ง DMG +30s.',
        dmgBoostExpired: 'เธซเธกเธ”เธเธฑเธเธ”เธฒเน€เธกเธ',
        spdBoostActive: '๐‘ SPD. ร—1.1!',
        spdBoostExtended: '๐‘ SPD +30s.',
        spdBoostExpired: 'เธซเธกเธ”เธเธฑเธเธเธงเธฒเธกเน€เธฃเนเธง',
    },
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    // ๐ฎ SKILL NAMES โ€” เธเธทเนเธญเธ—เธตเนเนเธชเธ”เธเนเธ•เนเธเธธเนเธกเธชเธเธดเธฅเนเธ HUD
    // เนเธเนเธ—เธตเนเธเธตเนเน€เธเธทเนเธญเน€เธเธฅเธตเนเธขเธเธเธทเนเธญเธชเธเธดเธฅเธ—เธฑเนเธเธซเธกเธ”เนเธเน€เธเธก
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    skillNames: {
        // โ”€โ”€ เธ—เธธเธเธ•เธฑเธงเธฅเธฐเธเธฃ โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        attack: 'SHOOT',
        dash: 'DASH',

        // โ”€โ”€ เน€เธเนเธฒ (KaoPlayer) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        kao: {
            skill1: 'STEALTH',      // R-Click โ€” เธเนเธญเธเธ•เธฑเธง
            teleport: 'TELEPORT',   // Q โ€” เน€เธ—เน€เธฅเธเธญเธฃเนเธ•
            clones: 'CLONE',        // E โ€” เนเธเธฅเธเธฃเนเธฒเธ
            passive: 'FREE STEALTH', // passive
        },

        // โ”€โ”€ เธ เธนเธกเธด (PoomPlayer) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        poom: {
            skill1: 'EAT RICE',     // R-Click โ€” เธเธดเธเธเนเธฒเธงเน€เธซเธเธตเธขเธง
            naga: 'NAGA',           // Q โ€” เน€เธฃเธตเธขเธเธเธเธฒเธเธฒเธ
            garuda: 'GARUDA',       // E โ€” เน€เธฃเธตเธขเธเธเธฃเธธเธ‘
            ritual: 'RITUAL',       // R โ€” เธเธดเธเธตเธชเธฑเธเน€เธงเธข
        },

        // โ”€โ”€ เธญเธญเนเธ•เน (AutoPlayer) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        auto: {
            skill1: 'WANCHAI',      // R-Click โ€” เน€เธฃเธตเธขเธ Stand
            vacuum: 'VACUUM',       // Q โ€” เธ”เธนเธ”เธจเธฑเธ•เธฃเธน + Ignite
            detonate: 'DETONATE',   // E โ€” Heat-scaled blast
            modeToggle: 'MODE',     // F โ€” toggle Range โ” Melee
        },

        // โ”€โ”€ เนเธเธ— (PatPlayer) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        pat: {
            attack: 'SLASH',        // L-Click โ€” katana swing
            skill1: 'BLADE GUARD',  // R-Click โ€” เธชเธฐเธ—เนเธญเธเธเธฃเธฐเธชเธธเธ
            zanzo: 'ZANZO',         // Q โ€” Blink + afterimage
            iaido: 'IAIDO',         // R โ€” 3-phase cinematic kill
        },

        // โ”€โ”€ Utility (proximity shortcuts) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        database: 'DATABASE',
        terminal: 'TERMINAL',
        shop: 'SHOP',
    },

    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    // ๐จ HUD EMOJI โ€” เธญเธดเนเธกเธเธดเธ—เธธเธเธ•เธฑเธงเนเธเธซเธเนเธฒเธ•เนเธฒเธ Skill HUD
    // เนเธเนเธ—เธตเนเธเธตเนเน€เธเธทเนเธญเน€เธเธฅเธตเนเธขเธเธญเธดเนเธกเธเธดเธ—เธฑเนเธเธซเธกเธ”เนเธเน€เธเธก
    // โ”€โ”€ เนเธเธฅเนเธ—เธตเนเธญเนเธฒเธเธเนเธฒเธเธตเน: ui.js (UIManager) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    hudEmoji: {
        // โ”€โ”€ L-Click (Attack slot) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        attack: {
            poom: '๐',   // Poom โ€” เธขเธดเธเธเธทเธ
            auto: '๐‘๐ฝ',   // Auto โ€” เธขเธดเธเธเธทเธ
            pat: 'โ”๏ธ',  // Pat  โ€” เธเธฑเธ/เธ”เธฒเธ
            default: '๐”ซ',  // Kao + others
        },
        // โ”€โ”€ R-Click (Skill 1 slot) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        skill1: {
            poom: '๐ฑ',   // EAT RICE
            auto: '๐ฅ',   // WANCHAI Stand
            kao: '๐‘ป',   // STEALTH
            pat: '๐ก๏ธ',  // BLADE GUARD
            default: '๐“–',  // fallback
        },
        // โ”€โ”€ Q slot โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        q: {
            kao: 'โก',   // TELEPORT
            auto: '๐€',   // VACUUM
            pat: '๐ช๏ธ',  // ZANZO FLASH
            poom: '๐',   // NAGA
        },
        // โ”€โ”€ E slot โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        e: {
            kao: '๐‘ฅ',   // CLONE ORBIT
            auto: '๐’ฅ',   // DETONATE
            poom: '๐ฆ…',   // GARUDA
            pat: '๐—ก๏ธ',  // IAIDO STRIKE
        },
        // โ”€โ”€ R slot (Poom only) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        r: {
            poom: '๐พ',   // RITUAL BURST
        },
        // โ”€โ”€ Mobile btn-skill (R-Click shortcut) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        mobile: {
            poom: '๐',
            auto: '๐ฅ',
            kao: '๐‘ป',
            pat: 'โ”๏ธ',
            default: '๐“–',
        },
    },

    combat: {
        poomCrit: 'เธเนเธฒเธงเน€เธซเธเธตเธขเธงเธเธฃเธดเธ•เธดเธเธญเธฅ! ๐’ฅ',
        highGround: 'VANTAGE POINT!',
        droneOnline: '๐ค– DRONE DEPLOYED',
        droneOverdrive: '๐”ฅ DRONE OVERDRIVE!',
        // โ”€โ”€ Kao skill texts โ”€โ”€
        kaoWeaponAwaken: 'โก WEAPON MASTER!',
        kaoTeleport: 'โก BLINK READY',
        kaoClones: '๐‘ฅ PHANTOM CLONE!',
        kaoFreeStealth: '๐‘ป FREE STEALTH',
        // โ”€โ”€ Poom โ€” Garuda & Cosmic Balance texts โ”€โ”€
        garudaSummon: 'เธญเธฑเธเน€เธเธดเธเธเธฃเธธเธ‘!',
        garudaVoice: 'เธเธฃเธธเธ‘เธเธเธเธเธเนเธญเธ!',
        garudaExpire: 'เธเธฃเธธเธ‘เธฅเธฒเธเธฒเธ...',
        cosmicActivate: 'โจ เธชเธกเธ”เธธเธฅเธเธฑเธเธฃเธงเธฒเธฅ!',
        cosmicVoice: 'เธเธฅเธฑเธเธเธฑเธเธฃเธงเธฒเธฅเธซเธฅเธฑเนเธเนเธซเธฅ!',
        // โ”€โ”€ Combat feedback (centralised from game.js) โ”€โ”€
        graphParried: 'โ” GRAPH PARRIED!',
        perfectParry: 'โ” PERFECT!',
    },
    time: {
        bulletTime: '๐• BULLET TIME',
        normalSpeed: 'โ–ถโ–ถ NORMAL',
        noEnergy: 'NO ENERGY! โก',
        energyDepleted: 'ENERGY DEPLETED โก',
        recharging: 'RECHARGING โก',
    },
    admin: {
        terminal: '๐’ป ADMIN TERMINAL',
        resumed: 'โ–ถ RESUMED',
        database: '๐“ MTC DATABASE',
        sessionWelcome: 'Session started. Welcome, root.',
        sessionHelp: 'Run "help" to list available commands.',
        noPlayer: 'ERROR : No active player session.',
        authOk: 'Authenticating root privilege... OK',
        healInject: (gained) => `Injecting ${gained} HP units into player entity...`,
        healResult: (hp, max) => `COMMAND EXECUTED โ€” HP : ${hp} / ${max}`,
        healFloat: (gained) => `+${gained} HP ๐’ [ADMIN]`,
        scorePatching: 'Patching score register... +5000',
        scoreResult: (score) => `COMMAND EXECUTED โ€” Score : ${score}`,
        scoreFloat: '+5000 ๐ช [ADMIN]',
        nextSigkill: 'Sending SIGKILL to all enemy processes...',
        nextResult: (killed) => `COMMAND EXECUTED โ€” ${killed} process(es) terminated. Wave advancing...`,
        nextFloat: '๐’€ WAVE SKIP [ADMIN]',
        closingSession: 'Closing session...',
        niceTry: 'nice try LOL',
        accessDenied: 'ACCESS DENIED โ€” MTC Policy ยง4.2 violation logged.',
        whoami: 'root (player infiltrated server)',
        cmdNotFound: (raw) => `bash: ${raw}: command not found`,
        sudoNotFound: (cmd) => `sudo: ${cmd}: command not found`,
        sudoAccessDenied: 'ACCESS DENIED โ€” Unknown sudo command.',
        typeHelp: 'Type "help" for available commands.',
        catPassword: 'hunter2',
        catPasswordWarn: "...wait, you weren't supposed to see that.",
        sandwich: 'What? Make it yourself.',
        helpTable: [
            'โ”โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”',
            'โ”  MTC ADMIN TERMINAL โ€” AVAILABLE COMMANDS     โ”',
            'โ”โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”ค',
            'โ”  sudo heal   Restore 100 HP to player        โ”',
            'โ”  sudo score  Add 5000 to current score       โ”',
            'โ”  sudo next   Kill all enemies, skip wave      โ”',
            'โ”  help        Show this command list           โ”',
            'โ”  clear       Clear terminal output            โ”',
            'โ”  exit        Close admin terminal             โ”',
            'โ””โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”',
        ],
        lsEntries: [
            { text: 'drwxr-xr-x  secrets/', cls: 'cline-info' },
            { text: 'drwxr-xr-x  grades/', cls: 'cline-info' },
            { text: '-rw-------  kru_manop_passwords.txt', cls: 'cline-warn' },
            { text: '-rw-r--r--  exam_answers_2024.pdf', cls: 'cline-ok' },
        ],
    },
    ai: {
        loading: 'เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธ เธฒเธฃเธเธดเธ...',
        missionPrefix: (name) => `Mission "${name}"`,
        missionFallback: 'MTC Adventure',
        reportFallback: 'เธ•เธฑเนเธเนเธเน€เธฃเธตเธขเธเนเธซเนเธกเธฒเธเธเธงเนเธฒเธเธตเนเธเธฐ...',
        // โ”€โ”€ Boss taunt fallbacks (used when Gemini is offline) โ”€
        bossTaunts: [
            'เธ—เธณเธเธฒเธฃเธเนเธฒเธเธกเธฒเธฃเธถเธเนเธฒเธง!',
            'เน€เธเธฃเธ”เนเธขเนเนเธเธเธเธตเนเธเธฐเธชเธญเธเธ•เธดเธ”เธกเธฑเนเธขเน€เธเธตเนเธข?',
            'เธชเธกเธเธฒเธฃเธเธตเนเธเนเธฒเธขเธเธดเธ”เน€เธ”เธตเธขเธง!',
            'เธญเนเธญเธเน€เธฅเธเธเธเธฒเธ”เธเธตเน เธกเธฒเน€เธฃเธตเธขเธเธเธดเน€เธจเธฉเนเธซเธก?',
            'log 4.57 เธเธทเธญเน€เธ—เนเธฒเนเธซเธฃเนเน€เธญเนเธข?',
            'เธเธดเธ”เน€เธฅเธเนเธกเนเธญเธญเธ เธชเธญเธเธ•เธเนเธเนเน',
            'เธเธฑเธเน€เธฃเธตเธขเธเธขเธธเธเธเธตเนเธกเธฑเธเธญเนเธญเธเนเธญเธเธฃเธดเธเน',
            'เนเธเนเธเธตเนเธเนเธ—เธณเนเธกเนเนเธ”เนเนเธฅเนเธงเธซเธฃเธญ?',
        ],
        // โ”€โ”€ Mission name fallbacks โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
        missionNames: [
            'Equation War',
            'Math Operation',
            'MTC Adventure',
        ],
        // โ”€โ”€ Report card fallbacks (keyed by performance tier) โ”€
        reportCards: {
            excellent: [
                'เน€เธเนเธเธกเธฒเธ! เนเธเธเธเธตเนเธ•เนเธญเธเนเธ”เนเน€เธเธฃเธ” A เนเธเนเธเธญเธ',
                'เธขเธญเธ”เน€เธขเธตเนเธขเธก! เธเธฃเธนเธ เธนเธกเธดเนเธเธกเธฒเธ',
                'เธเธฐเนเธเธเน€เธ•เนเธก! เธเธฑเธเน€เธฃเธตเธขเธเธ”เธตเน€เธ”เนเธ',
            ],
            good: [
                'เธ”เธตเธ—เธตเน€เธ”เธตเธขเธง เนเธ•เนเธขเธฑเธเธกเธตเธเนเธญเธเธงเนเธฒเธเนเธซเนเธเธฑเธ’เธเธฒ',
                'เธเนเธฒเธเธเธฅเธธเธข โ€” เนเธ•เนเธญเธขเนเธฒเธซเธขเธธเธ”เนเธเนเธเธตเน',
                'เนเธกเนเน€เธฅเธง เนเธ•เนเธ•เนเธญเธเธเธขเธฒเธขเธฒเธกเนเธซเนเธกเธฒเธเธเธงเนเธฒเธเธตเน',
            ],
            poor: [
                'เธเธฐเนเธเธเธ•เนเธณเนเธ เธ•เนเธญเธเธ•เธฑเนเธเนเธเน€เธฃเธตเธขเธเนเธซเนเธกเธฒเธเธเธงเนเธฒเธเธตเน',
                'เธขเธฑเธเนเธกเนเธ”เธตเธเธญ เธเธฅเธฑเธเนเธเธ—เธเธ—เธงเธเธญเธตเธเธเธฃเธฑเนเธ',
                'เนเธ”เนเธเธฐเนเธเธเธเนเธญเธขเน€เธเธดเธเนเธ เธเธฐเธชเธญเธเธเนเธฒเธเธกเธฑเนเธข?',
            ],
        },
    },
    boss: {
        // โ”€โ”€ BossFirst (Kru First) phase-transition physics taunts
        firstTaunts: [
            'E = mcยฒ... เธเธณเธเธงเธ“เธญเธญเธเธกเธฑเนเธข?',
            'เนเธฃเธเธเธเธดเธเธดเธฃเธดเธขเธฒ!',
            'เธซเธเธตเธเธฒเธเนเธฃเธเนเธเนเธกเธ–เนเธงเธเนเธ”เนเน€เธซเธฃเธญ?',
            'เธเธดเธชเธดเธเธชเนเนเธกเนเธกเธตเธ—เธฒเธเนเธเธซเธ',
        ],
    },
    ui: {
        hits: "HITS!",
        godlike: "GODLIKE!",
        unstoppable: "UNSTOPPABLE!",
        confusedWarning: "โ ๏ธ CONFUSED : INVERT YOUR MOVEMENT! โ ๏ธ",
        minimapTitle: "TACTICAL RADAR",
        legendEnm: "ENM",
        legendMge: "MGE",
        legendTnk: "TNK",
        legendBss: "BSS",
        legendShp: "SHP",
        dayPhase: (pct) => `DAY ${pct}%`,
        nightPhase: (pct) => `NIGHT ${pct}%`,
        // โ”€โ”€ HUD state labels (centralised from ui.js) โ”€โ”€โ”€โ”€โ”€โ”€
        noActiveBuffs: 'เนเธกเนเธกเธตเธเธฑเธ',
        endGameSubtitle: 'เน€เธฅเธทเธญเธเธ•เธฑเธงเธฅเธฐเธเธฃเนเธซเธกเนเธซเธฃเธทเธญเธฅเธญเธเธญเธตเธเธเธฃเธฑเนเธ',
        patCharging: 'CHARGING',
        patIaido: 'IAIDO!',
        patEdge: 'โ” EDGE',
        patRonin: 'RONIN',
        skillActive: 'ACTIVE',
    },
    environment: {
        barrelBoom: '๐’ฅ BOOM!',
        barrelHit: 'BARREL HIT!',
        safeZone: 'SAFE ZONE',
    },
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    // ๐“ TUTORIAL TEXTS โ€” เธเนเธญเธเธงเธฒเธกเธชเธญเธเธเธฒเธฃเน€เธฅเนเธเธ—เธฑเนเธเธซเธกเธ”
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    tutorial: {
        welcome: {
            title: 'เธขเธดเธเธ”เธตเธ•เนเธญเธเธฃเธฑเธเธชเธนเน MTC the Game!',
            body: 'เธเธธเธ“เธเธณเธฅเธฑเธเธเธฐเน€เธเนเธฒเธชเธนเนเธซเนเธญเธเน€เธฃเธตเธขเธเธเธญเธ KruManop (เธเธฃเธนเธกเธฒเธเธ) เธเธฃเธนเธเธ“เธดเธ•เธจเธฒเธชเธ•เธฃเนเธชเธธเธ”เนเธซเธ”\n\nเธ เธฒเธฃเธเธดเธ: เธฃเธญเธ”เธเธตเธงเธดเธ•เนเธซเนเธเธฃเธ 15 เน€เธงเธ เนเธฅเธฐเน€เธญเธฒเธเธเธฐเธเธญเธชเธ—เธธเธเธ•เธฑเธง\n\nเธเธ” NEXT เธซเธฃเธทเธญ SPACE เน€เธเธทเนเธญเน€เธฃเธดเนเธกเธเธ—เน€เธฃเธตเธขเธ',
            icon: '๐“'
        },
        movement: {
            title: 'เธเธฒเธฃเน€เธเธฅเธทเนเธญเธเธ—เธตเน',
            body: 'เธเธ” W A S D เน€เธเธทเนเธญเน€เธ”เธดเธ\n\nเน€เธ”เธดเธเนเธเธฃเธญเธเน เธชเธฑเธเธเธฃเธนเนเน€เธเธทเนเธญเธ—เธ”เธชเธญเธ!',
            icon: '๐•น๏ธ'
        },
        shooting: {
            title: 'เธเธฒเธฃเธขเธดเธ',
            body: 'เน€เธฅเนเธเธ”เนเธงเธข Mouse เนเธฅเนเธงเธเธ” Left Click เน€เธเธทเนเธญเธขเธดเธ\n\nเธฅเธญเธเธขเธดเธเธ”เธน 3 เธเธฃเธฑเนเธ!',
            icon: '๐”ซ'
        },
        dash: {
            title: 'Dash โ€” เธซเธฅเธเธซเธฅเธตเธ',
            body: 'เธเธ” SPACE เน€เธเธทเนเธญ Dash เธเธธเนเธเธซเธฅเธเธจเธฑเธ•เธฃเธน\nเธกเธต Cooldown โ€” เนเธเนเนเธซเนเธ–เธนเธเธเธฑเธเธซเธงเธฐ!\n\nเธฅเธญเธ Dash 1 เธเธฃเธฑเนเธ',
            icon: '๐’จ'
        },
        rclick: {
            title: 'เธ—เธฑเธเธฉเธฐเธเธดเน€เธจเธฉ (Right Click)',
            body: 'เธเธ” Right Click เน€เธเธทเนเธญเนเธเนเธ—เธฑเธเธฉเธฐเธเธฃเธฐเธเธณเธ•เธฑเธง:\nโ€ข เน€เธเนเธฒ โ€” Stealth เธเนเธญเธเธ•เธฑเธง 3 เธงเธดเธเธฒเธ—เธต\nโ€ข เธ เธนเธกเธด โ€” Eat Rice เธเธทเนเธ HP เนเธฅเธฐเน€เธเธดเนเธกเธเธฅเธฑเธ\nโ€ข Auto โ€” Wanchai Stand เน€เธฃเธตเธขเธ autonomous companion (8s, CD 12s)\n\nเธฅเธญเธเธเธ” Right Click เธ”เธน!',
            icon: 'โจ'
        },
        kaoPassive: {
            title: 'เน€เธเนเธฒ โ€” เธเธธเนเธกเน€เธชเธฃเธต (Passive) ๐‘ป',
            body: 'เธเธ” Right Click เนเธเน Stealth เธเธฃเธฑเนเธเนเธฃเธ โ’ เธเธฅเธ”เธฅเนเธญเธ Passive เธ—เธฑเธเธ—เธต!\n\nโฆ Dash โ’ Free Stealth เธญเธฑเธ•เนเธเธกเธฑเธ•เธดเธ—เธธเธเธเธฃเธฑเนเธ\nโฆ Crit เธเธ“เธฐเธเนเธญเธเธ•เธฑเธงเน€เธเธดเนเธก 50%\nโฆ เธเธงเธฒเธกเน€เธฃเนเธงเธ–เธฒเธงเธฃ +40%\nโฆ Q ยท E เธชเธเธดเธฅเธเธฅเธ”เธฅเนเธญเธ\n\nโ”๏ธ WEAPON MASTER: เธเนเธฒเธ”เนเธงเธขเนเธ•เนเธฅเธฐเธญเธฒเธงเธธเธ 5 เธเธฃเธฑเนเธ\n   โ’ Golden Awakened Form',
            icon: '๐‘ป'
        },
        kaoWeapon: {
            title: 'เน€เธเนเธฒ โ€” เธชเธฅเธฑเธเธญเธฒเธงเธธเธ ๐”ซ',
            body: 'เน€เธเนเธฒเธกเธตเธญเธฒเธงเธธเธ 3 เธเธเธดเธ”:\nโ€ข Auto Rifle โ€” เธขเธดเธเน€เธฃเนเธง (เธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธ)\nโ€ข Sniper โ€” Railgun เธ”เธฒเน€เธกเธเธชเธนเธ เธขเธดเธเธเนเธฒ\nโ€ข Shotgun โ€” Molten Shrapnel เธฃเธฐเธขเธฐเนเธเธฅเน\n\nเน€เธฅเธทเนเธญเธ Mouse Wheel เน€เธเธทเนเธญเธชเธฅเธฑเธ\nเธชเธฅเธฑเธเนเธซเนเธเธฃเธ 3 เธเธฃเธฑเนเธ!',
            icon: '๐”'
        },
        autoStandRush: {
            title: 'Auto โ€” Stand Rush Manual Targeting ๐‘',
            body: 'เธฃเธฐเธซเธงเนเธฒเธ Wanchai active:\n\n๐ฏ เธเธตเนเน€เธกเธฒเธชเนเนเธฅเนเธง L-Click = Stand Rush เนเธเธ•เธณเนเธซเธเนเธเธเธฑเนเธ\n   Stand teleport เธซเธฒเน€เธเนเธฒเนเธฅเนเธงเธฃเธฑเธงเธซเธกเธฑเธ”เธ—เธฑเธเธ—เธต\n\nโจ 6-layer rendering เธเธฃเนเธญเธก visual effect\n๐ฅ Dual-fist โ€” _punchSide เธชเธฅเธฑเธเธเนเธฒเธเธ—เธธเธเธซเธกเธฑเธ”\n\nโก Wanchai เธขเธฑเธเนเธเธกเธ•เธตเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเธ”เนเธงเธข\n   L-Click เน€เธเธดเนเธก Stand Rush เธ—เธฑเธเนเธเนเธ”เนเน€เธฅเธข\n\n๐’ฅ PASSIVE UNLOCK: เธ—เธณ Heat เนเธซเนเน€เธ•เนเธก 100% โ’ SCORCHED SOUL\n๐”ฅ RAGE MODE: OVERHEAT + HP < 30% โ’ DMG ร—1.3 + DEF +20%',
            icon: '๐‘'
        },
        bulletTime: {
            title: 'Bullet Time โฑ',
            body: 'เธเธ” T เน€เธเธทเนเธญเน€เธเธดเธ” Bullet Time\nเน€เธงเธฅเธฒเธเธฐเธเนเธฒเธฅเธ 70% โ€” เธซเธฅเธเธเธฃเธฐเธชเธธเธเธซเธเธฒเนเธเนเธ\n\nเนเธ–เธเธเธฅเธฑเธเธเธฒเธ FOCUS (เธฅเนเธฒเธเธเธฅเธฒเธ) เธเนเธญเธขเน เธซเธกเธ”\nเธเธฅเนเธญเธขเนเธซเนเธเธฒเธฃเนเธเธเนเธญเธเนเธเนเธญเธตเธเธเธฃเธฑเนเธ\n\nเธเธ” T เน€เธเธทเนเธญเธ—เธ”เธฅเธญเธ!',
            icon: '๐•'
        },
        levelUp: {
            title: 'Level Up & EXP ๐“',
            body: 'เธเธณเธเธฑเธ”เธจเธฑเธ•เธฃเธนเน€เธเธทเนเธญเธฃเธฑเธ EXP\nเน€เธกเธทเนเธญเน€เธฅเน€เธงเธฅเธญเธฑเธ Stats เธ—เธฑเนเธเธซเธกเธ”เน€เธเธดเนเธกเธเธถเนเธ\n\nLv.2 โ’ เธเธฅเธ”เธฅเนเธญเธ Skill Q\nLv.3 โ’ เธเธฅเธ”เธฅเนเธญเธ Skill E (เธซเธฃเธทเธญ R เธชเธณเธซเธฃเธฑเธเธ เธนเธกเธด)\n\n๐’ก เนเธ–เธ EXP เธญเธขเธนเนเนเธ•เนเนเธ–เธ HP เธกเธธเธกเธเนเธฒเธขเธเธ',
            icon: '๐“'
        },
        shop: {
            title: 'MTC Co-op Store ๐’',
            body: 'เธฃเนเธฒเธเธเนเธฒเธญเธขเธนเนเธกเธธเธกเธเนเธฒเธขเธฅเนเธฒเธเธเธญเธเนเธเธเธ—เธตเน\nเน€เธ”เธดเธเน€เธเนเธฒเนเธเธฅเนเนเธฅเนเธงเธเธ” B เน€เธเธทเนเธญเน€เธเธดเธ”เธฃเนเธฒเธ\n\n๐งช เธเธทเนเธญเธ”เนเธงเธข Score:\nโ€ข Energy Drink โ€” เธเธทเนเธ HP 60 เธซเธเนเธงเธข (300 เธเธฐเนเธเธ)\nโ€ข Weapon Tuner โ€” เน€เธเธดเนเธกเธ”เธฒเน€เธกเธ 5% (800 เธเธฐเนเธเธ)\nโ€ข Lightweight Boots โ€” เน€เธเธดเนเธกเธเธงเธฒเธกเน€เธฃเนเธง 5% (500 เธเธฐเนเธเธ)\nโ€ข Focus Crystal โ€” เธฅเธ”เธเธนเธฅเธ”เธฒเธงเธเน 5% (700 เธเธฐเนเธเธ)\nโ€ข Energy Shield โ€” เธเธฅเนเธญเธเธเธฒเธฃเนเธเธกเธ•เธต 1 เธเธฃเธฑเนเธ (600 เธเธฐเนเธเธ)\nโ€ข Vital Supplement โ€” เน€เธเธดเนเธก HP เธชเธนเธเธชเธธเธ” 15 (500 เธเธฐเนเธเธ)',
            icon: '๐’'
        },
        database: {
            title: 'MTC Database Server ๐—๏ธ',
            body: 'เน€เธเธดเธฃเนเธเน€เธงเธญเธฃเนเธญเธขเธนเนเธกเธธเธกเธเธงเธฒเธเธเธเธญเธเนเธเธเธ—เธตเน\n\n๐’ป เธเธ” E โ€” เน€เธเธดเธ” MTC Database\n   เธ”เธนเน€เธเธทเนเธญเธซเธฒเนเธฅเธฐ Lore\n\n๐”’ เธเธ” F โ€” Admin Terminal\n   เธเธดเธกเธเน "help" เน€เธเธทเนเธญเธ”เธนเธเธณเธชเธฑเนเธเธ—เธฑเนเธเธซเธกเธ”\n   เน€เธเนเธ: "sudo heal", "sudo score", "sudo next"',
            icon: '๐—๏ธ'
        },
        enemyTypes: {
            title: 'เธเธฃเธฐเน€เธ เธ—เธจเธฑเธ•เธฃเธน & Wave Events ๐‘พ',
            body: 'เธจเธฑเธ•เธฃเธน 3 เธเธฃเธฐเน€เธ เธ—:\n๐”ด Basic โ€” เน€เธ”เธดเธเน€เธฃเนเธง เธขเธดเธเนเธ”เน\n๐  Tank ๐ก๏ธ โ€” HP เธชเธนเธเธกเธฒเธ เน€เธ”เธดเธเธเนเธฒ\n๐ฃ Mage ๐ง โ€” เธชเธฒเธขเธเนเธฒ + เธญเธธเธเธเธฒเธเธฒเธ•\n\nWave Events เธเธดเน€เธจเธฉ:\n๐‘ Wave 1 โ€” Dark Wave: เน€เธเธดเธ”เธ•เธฑเธงเธ”เนเธงเธขเธเธงเธฒเธกเธกเธทเธ”เธกเธดเธ”\n๐ซ๏ธ Wave 2,8,11,14 โ€” Fog Wave: Radar OFFLINE โ€” minimap เนเธเนเนเธกเนเนเธ”เน!\nโก Wave 4,7,13 โ€” Speed Wave: เธจเธฑเธ•เธฃเธนเน€เธฃเนเธง ร—1.5\nโ ๏ธ Wave 5,10 โ€” Glitch Wave: Controls Invert + เนเธ”เน HP +100 เธเธฑเนเธงเธเธฃเธฒเธง',
            icon: '๐‘พ'
        },
        boss: {
            title: 'Boss Encounters ๐‘‘',
            body: 'เธ—เธธเธ 3 เน€เธงเธเธเธฐเธกเธต Boss โ€” 5 encounters เธ—เธฑเนเธเธซเธกเธ”:\n\n๐‘‘ Wave  3 โ€” KruManop (Basic)\n๐• Wave  9 โ€” KruManop (Dog Rider) โ€” Phase 2 เน€เธฃเธตเธขเธเธซเธกเธฒ\n๐ Wave 15 โ€” KruManop (Goldfish Lover) โ€” Phase 2+3\n\nโ๏ธ Wave  6 โ€” KruFirst (Basic)\nโ๏ธ Wave 12 โ€” KruFirst (Advanced โ ๏ธ เธขเธฒเธเธเธถเนเธ)\n\n๐ Domain Expansion โ€” เธ—เธฑเธเธฉเธฐ Ultimate\n   Boss เนเธเนเน€เธกเธทเนเธญ HP เธ•เนเธณ เธเธงเธเธเธธเธกเธเธทเนเธเธ—เธตเนเธ—เธฑเนเธ Arena!\n\n๐’ก เธ”เธน Boss HP Bar เธ”เนเธฒเธเธเธเธเธญเธเธเธญ',
            icon: '๐‘‘'
        },
        ready: {
            title: 'เธเธฃเนเธญเธกเนเธฅเนเธง! ๐€',
            body: 'เธเธธเธ“เธฃเธนเนเธ—เธธเธเธญเธขเนเธฒเธเธ—เธตเนเธเธณเน€เธเนเธเนเธฅเนเธง!\n\n๐ เธ—เธณเธเธฐเนเธเธเธชเธนเธเธชเธธเธ”เน€เธเธทเนเธญเธเธถเนเธ Leaderboard\nโญ เธเธฅเธ”เธฅเนเธญเธ Achievement เธกเธฒเธเธกเธฒเธข\n๐ฏ เธเนเธฒเธเธ—เธฑเนเธ 15 Wave เน€เธเธทเนเธญเธเธเธฐเน€เธเธก\n\nเธเธ” START เน€เธเธทเนเธญเน€เธเนเธฒเธชเธนเนเธชเธเธฒเธกเธฃเธ!',
            icon: '๐ฎ'
        }
    }
};

window.GAME_TEXTS = GAME_TEXTS;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_TEXTS };
}
