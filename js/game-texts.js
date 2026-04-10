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
        bossIncomingRider: 'BOSS INCOMING!🐕',
        bossIncomingFish: 'BOSS INCOMING!🐟',
        // ── BossFirst (Kru First) announce texts ──────────────
        firstIncoming: '⚛️ KRU FIRST — BOSS INCOMING!',
        firstAdvanced: '⚛️ KRU FIRST — ADVANCED MODE ⚡',
        firstTagline: 'F=ma · v=u+at · หลบให้ทัน!',
        firstTaglineAdvanced: 'F=ma · E=mc² · ไม่มีทางรอด!',
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
        dmgBoostExpired: 'หมดบัฟดาเมจ',
        spdBoostActive: '👟 SPD. ×1.1!',
        spdBoostExtended: '👟 SPD +30s.',
        spdBoostExpired: 'หมดบัฟความเร็ว',
    },
    // ══════════════════════════════════════════════════════
    // 🎮 SKILL NAMES — ชื่อที่แสดงใต้ปุ่มสกิลใน HUD
    // แก้ที่นี่เพื่อเปลี่ยนชื่อสกิลทั้งหมดในเกม
    // ══════════════════════════════════════════════════════
    skillNames: {
        // ── ทุกตัวละคร ──────────────────────────────────
        attack: 'SHOOT',
        dash: 'DASH',

        // ── เก้า (KaoPlayer) ────────────────────────────
        kao: {
            skill1: 'STEALTH',      // R-Click — ซ่อนตัว
            teleport: 'TELEPORT',   // Q — เทเลพอร์ต
            clones: 'CLONE',        // E — โคลนร่าง
            passive: 'FREE STEALTH', // passive
        },

        // ── ภูมิ (PoomPlayer) ───────────────────────────
        poom: {
            skill1: 'EAT RICE',     // R-Click — กินข้าวเหนียว
            naga: 'NAGA',           // Q — เรียกพญานาค
            garuda: 'GARUDA',       // E — เรียกครุฑ
            ritual: 'RITUAL',       // R — พิธีสังเวย
        },

        // ── ออโต้ (AutoPlayer) ──────────────────────────
        auto: {
            skill1: 'WANCHAI',      // R-Click — เรียก Stand
            vacuum: 'VACUUM',       // Q — ดูดศัตรู + Ignite
            detonate: 'DETONATE',   // E — Heat-scaled blast
            modeToggle: 'MODE',     // F — toggle Range ↔ Melee
        },

        // ── แพท (PatPlayer) ─────────────────────────────
        pat: {
            attack: 'SLASH',        // L-Click — katana swing
            skill1: 'BLADE GUARD',  // R-Click — สะท้อนกระสุน
            zanzo: 'ZANZO',         // Q — Blink + afterimage
            iaido: 'IAIDO',         // R — 3-phase cinematic kill
        },

        // ── Utility (proximity shortcuts) ───────────────
        database: 'DATABASE',
        terminal: 'TERMINAL',
        shop: 'SHOP',
    },

    // ══════════════════════════════════════════════════════
    // 🎨 HUD EMOJI — อิโมจิทุกตัวในหน้าต่าง Skill HUD
    // แก้ที่นี่เพื่อเปลี่ยนอิโมจิทั้งหมดในเกม
    // ── ไฟล์ที่อ่านค่านี้: ui.js (UIManager) ──────────────
    // ══════════════════════════════════════════════════════
    hudEmoji: {
        // ── L-Click (Attack slot) ─────────────────────────
        attack: {
            poom: '🍚',   // Poom — ยิงปืน
            auto: '👊🏽',   // Auto — ยิงปืน
            pat: '⚔️',  // Pat  — ฟัน/ดาบ
            default: '🔫',  // Kao + others
        },
        // ── R-Click (Skill 1 slot) ────────────────────────
        skill1: {
            poom: '🍱',   // EAT RICE
            auto: '🥊',   // WANCHAI Stand
            kao: '👻',   // STEALTH
            pat: '🛡️',  // BLADE GUARD
            default: '📖',  // fallback
        },
        // ── Q slot ───────────────────────────────────────
        q: {
            kao: '⚡',   // TELEPORT
            auto: '🌀',   // VACUUM
            pat: '🌪️',  // ZANZO FLASH
            poom: '🐉',   // NAGA
        },
        // ── E slot ───────────────────────────────────────
        e: {
            kao: '👥',   // CLONE ORBIT
            auto: '💥',   // DETONATE
            poom: '🦅',   // GARUDA
            pat: '🗡️',  // IAIDO STRIKE
        },
        // ── R slot (Poom only) ────────────────────────────
        r: {
            poom: '🌾',   // RITUAL BURST
        },
        // ── Mobile btn-skill (R-Click shortcut) ──────────
        mobile: {
            poom: '🍚',
            auto: '🥊',
            kao: '👻',
            pat: '⚔️',
            default: '📖',
        },
    },

    combat: {
        poomCrit: 'ข้าวเหนียวคริติคอล! 💥',
        highGround: 'VANTAGE POINT!',
        droneOnline: '🤖 DRONE DEPLOYED',
        droneOverdrive: '🔥 DRONE OVERDRIVE!',
        // ── Kao skill texts ──
        kaoWeaponAwaken: '⚡ WEAPON MASTER!',
        kaoTeleport: '⚡ BLINK READY',
        kaoClones: '👥 PHANTOM CLONE!',
        kaoFreeStealth: '👻 FREE STEALTH',
        // ── Poom — Garuda & Cosmic Balance texts ──
        garudaSummon: 'อัญเชิญครุฑ!',
        garudaVoice: 'ครุฑจงปกป้อง!',
        garudaExpire: 'ครุฑลาจาก...',
        cosmicActivate: '✨ สมดุลจักรวาล!',
        cosmicVoice: 'พลังจักรวาลหลั่งไหล!',
        // ── Combat feedback (centralised from game.js) ──
        graphParried: '⚔ GRAPH PARRIED!',
        perfectParry: '⚔ PERFECT!',
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
                'ดีทีเดียว แต่ยังมีช่องว่างให้พัฒนา',
                'ผ่านฉลุย — แต่อย่าหยุดแค่นี้',
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
            'E = mc²... คำนวณออกมั้ย?',
            'แรงปฏิกิริยา!',
            'หนีจากแรงโน้มถ่วงได้เหรอ?',
            'ฟิสิกส์ไม่มีทางโกหก',
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
        nightPhase: (pct) => `NIGHT ${pct}%`,
        // ── HUD state labels (centralised from ui.js) ──────
        noActiveBuffs: 'ไม่มีบัฟ',
        endGameSubtitle: 'เลือกตัวละครใหม่หรือลองอีกครั้ง',
        patCharging: 'CHARGING',
        patIaido: 'IAIDO!',
        patEdge: '⚔ EDGE',
        patRonin: 'RONIN',
        skillActive: 'ACTIVE',
    },
    environment: {
        barrelBoom: '💥 BOOM!',
        barrelHit: 'BARREL HIT!',
        safeZone: 'SAFE ZONE',
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_TEXTS };
}
