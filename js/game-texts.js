'use strict';
/**
 * js/game-texts.js
 * Extracted UI copy and localized gameplay text constants.
 */

const GAME_TEXTS = {
    wave: {
        badge: (wave) => `WAVE ${wave}`,
        floatingTitle: (wave) => `WAVE ${wave}`,
        bossIncoming: `BOSS INCOMING!`,
        bossIncomingRider: `BOSS INCOMING!🐕`,
        bossIncomingFish: `BOSS INCOMING!🐟`,
        // ── BossFirst (Kru First) announce texts ──────────────
        firstIncoming: `⚛️ KRU FIRST — BOSS INCOMING!`,
        firstAdvanced: `⚛️ KRU FIRST — ADVANCED MODE ⚡`,
        firstTagline: `F=ma · v=u+at`,
        firstTaglineAdvanced: `F=ma · E=mc²`,
        glitchWave: `⚡ GLITCH WAVE ⚡`,
        glitchAnomaly: `SYSTEM ANOMALY DETECTED...⚠️`,
        glitchControls: `CONTROLS INVERTED!`,
        glitchBrace: `BRACE FOR IMPACT...`,
        glitchCrisisHp: (bonus) => `🛡️ +${bonus} BONUS HP`,
        spawnCountdown: (secs) => `⚡ SPAWNING IN ${secs}...`,
        chaosBegins: `💀 CHAOS BEGINS!`,
        // ── Special wave event banners ────────────────────────
        fogBannerTitle: `🌫️ FOG WAVE`,
        fogBannerSubtitle: `— RADAR OFFLINE —`,
        speedBannerTitle: `⚡ SPEED WAVE`,
        speedBannerSubtitle: `— ENEMIES ACCELERATED —`,
    },
    shop: {
        open: `🛒 MTC CO-OP STORE`,
        resumed: `▶ RESUMED`,
        notEnoughScore: `คะแนนไม่พอ! 💸`,
        hpFull: `HP เต็มแล้ว!`,
        healPickup: (amt) => `+${amt} HP 🧃`,
        dmgBoostActive: `🔧 DMG. ×1.1!`,
        dmgBoostExtended: `🔧 DMG +30s.`,
        dmgBoostExpired: `หมดบัฟดาเมจ`,
        spdBoostActive: `👟 SPD. ×1.1!`,
        spdBoostExtended: `👟 SPD +30s.`,
        spdBoostExpired: `หมดบัฟความเร็ว`,
    },
    // ══════════════════════════════════════════════════════
    // 📜 MISSION BRIEF — แสดงใต้ subtitle ในเมนูหลัก
    // initAI() ใน game.js สุ่มชื่อภารกิจจาก `missionNames`
    // แล้ว wrap ด้วย `missionPrefix()` ก่อนเขียนลง #mission-brief
    // (คงโครงเดิมจาก v3.19 ก่อน commit 2ec3094 ที่ลบทิ้งพร้อม Gemini cleanup)
    // ══════════════════════════════════════════════════════
    ai: {
        loading: `The Mission is coming up...`,
        missionPrefix: (name) => `Mission "${name}"`,
        missionFallback: `MTC Adventure`,
        missionNames: [
            `Equation War`,
            `Math Operation`,
            `MTC Adventure`,
            `Final Exam Survival`,
            `Midterm Mayhem`,
            `The Last Homework`,
        ],
    },
    // ══════════════════════════════════════════════════════
    // 🎮 SKILL NAMES — ชื่อที่แสดงใต้ปุ่มสกิลใน HUD
    // แก้ที่นี่เพื่อเปลี่ยนชื่อสกิลทั้งหมดในเกม
    // ══════════════════════════════════════════════════════
    skillNames: {
        // ── ทุกตัวละคร ──────────────────────────────────
        attack: `SHOOT`,
        dash: `DASH`,

        // ── เก้า (KaoPlayer) ────────────────────────────
        kao: {
            skill1: `STEALTH`, // R-Click — ซ่อนตัว
            teleport: `TELEPORT`, // Q — เทเลพอร์ต
            clones: `CLONE`, // E — โคลนร่าง
            passive: `FREE STEALTH`, // passive
        },

        // ── ภูมิ (PoomPlayer) ───────────────────────────
        poom: {
            skill1: `EAT RICE`, // R-Click — กินข้าวเหนียว
            naga: `NAGA`, // Q — เรียกพญานาค
            garuda: `GARUDA`, // E — เรียกครุฑ
            ritual: `RITUAL`, // R — พิธีสังเวย
        },

        // ── ออโต้ (AutoPlayer) ──────────────────────────
        auto: {
            skill1: `WANCHAI`, // R-Click — เรียก Stand
            vacuum: `VACUUM`, // Q — ดูดศัตรู + Ignite
            detonate: `DETONATE`, // E — Heat-scaled blast
            modeToggle: `MODE`, // F — toggle Range ↔ Melee
        },

        // ── แพท (PatPlayer) ─────────────────────────────
        pat: {
            attack: `SLASH`, // L-Click — katana swing
            skill1: `BLADE GUARD`, // R-Click — สะท้อนกระสุน
            zanzo: `ZANZO`, // Q — Blink + afterimage
            iaido: `IAIDO`, // R — 3-phase cinematic kill
        },

        // ── Utility (proximity shortcuts) ───────────────
        database: `DATABASE`,
        terminal: `TERMINAL`,
        shop: `SHOP`,
    },

    // ══════════════════════════════════════════════════════
    // 🎨 HUD EMOJI — อิโมจิทุกตัวในหน้าต่าง Skill HUD
    // แก้ที่นี่เพื่อเปลี่ยนอิโมจิทั้งหมดในเกม
    // ── ไฟล์ที่อ่านค่านี้: ui.js (UIManager) ──────────────
    // ══════════════════════════════════════════════════════
    hudEmoji: {
        // ── L-Click (Attack slot) ─────────────────────────
        attack: {
            poom: `🍚`, // Poom — ยิงปืน
            auto: `👊🏽`, // Auto — ยิงปืน
            pat: `⚔️`, // Pat  — ฟัน/ดาบ
            default: `🔫`, // Kao + others
        },
        // ── R-Click (Skill 1 slot) ────────────────────────
        skill1: {
            poom: `🍱`, // EAT RICE
            auto: `🥊`, // WANCHAI Stand
            kao: `👻`, // STEALTH
            pat: `🛡️`, // BLADE GUARD
            default: `📖`, // fallback
        },
        // ── Q slot ───────────────────────────────────────
        q: {
            kao: `⚡`, // TELEPORT
            auto: `🌀`, // VACUUM
            pat: `🌪️`, // ZANZO FLASH
            poom: `🐉`, // NAGA
        },
        // ── E slot ───────────────────────────────────────
        e: {
            kao: `👥`, // CLONE ORBIT
            auto: `💥`, // DETONATE
            poom: `🦅`, // GARUDA
            pat: `🗡️`, // IAIDO STRIKE
        },
        // ── R slot (Poom only) ────────────────────────────
        r: {
            poom: `🌾`, // RITUAL BURST
        },
        // ── Mobile btn-skill (R-Click shortcut) ──────────
        mobile: {
            poom: `🍚`,
            auto: `🥊`,
            kao: `👻`,
        },
    },

    combat: {
        poomCrit: `ข้าวเหนียวคริติคอล! 💥`,
        highGround: `VANTAGE POINT!`,
        droneOnline: `🤖 DRONE DEPLOYED`,
        droneOverdrive: `🔥 DRONE OVERDRIVE!`,
        // ── Kao skill texts ──
        kaoWeaponAwaken: `⚡ WEAPON MASTER!`,
        kaoTeleport: `⚡ BLINK READY`,
        kaoClones: `👥 PHANTOM CLONE!`,
        kaoFreeStealth: `👻 FREE STEALTH`,
        // ── Poom — Garuda & Cosmic Balance texts ──
        garudaSummon: `อัญเชิญครุฑ!`,
        garudaVoice: `ครุฑจงปกป้อง!`,
        garudaExpire: `ครุฑลาจาก...`,
        cosmicActivate: `✨ สมดุลจักรวาล!`,
        cosmicVoice: `พลังจักรวาลหลั่งไหล!`,
        // ── Combat feedback (centralised from game.js) ──
        graphParried: `⚔ GRAPH PARRIED!`,
        perfectParry: `⚔ PERFECT!`,
    },
    time: {
        bulletTime: `🕐 BULLET TIME`,
        normalSpeed: `▶▶ NORMAL`,
        noEnergy: `NO ENERGY! ⚡`,
        energyDepleted: `ENERGY DEPLETED ⚡`,
        recharging: `RECHARGING ⚡`,
    },
    admin: {
        terminal: `💻 ADMIN TERMINAL`,
        resumed: `▶ RESUMED`,
        database: `📚 MTC DATABASE`,
        sessionWelcome: `Session started. Welcome, root.`,
        sessionHelp: `Run "help" to list available commands.`,
        noPlayer: `ERROR : No active player session.`,
        authOk: `Authenticating root privilege... OK`,
        healInject: (gained) =>
            `Injecting ${gained} HP units into player entity...`,
        healResult: (hp, max) => `COMMAND EXECUTED — HP : ${hp} / ${max}`,
        healFloat: (gained) => `+${gained} HP 💉 [ADMIN]`,
        scorePatching: `Patching score register... +5000`,
        scoreResult: (score) => `COMMAND EXECUTED — Score : ${score}`,
        scoreFloat: `+5000 🪙 [ADMIN]`,
        nextSigkill: `Sending SIGKILL to all enemy processes...`,
        nextResult: (killed) =>
            `COMMAND EXECUTED — ${killed} process(es) terminated. Wave advancing...`,
        nextFloat: `💀 WAVE SKIP [ADMIN]`,
        closingSession: `Closing session...`,
        niceTry: `nice try LOL`,
        accessDenied: `ACCESS DENIED — MTC Policy §4.2 violation logged.`,
        whoami: `root (player infiltrated server)`,
        cmdNotFound: (raw) => `bash: ${raw}: command not found`,
        sudoNotFound: (cmd) => `sudo: ${cmd}: command not found`,
        sudoAccessDenied: `ACCESS DENIED — Unknown sudo command.`,
        typeHelp: `Type "help" for available commands.`,
        catPassword: `hunter2`,
        catPasswordWarn: `...wait, you weren't supposed to see that.`,
        sandwich: `What? Make it yourself.`,
        helpTable: [
            `┌─────────────────────────────────────────────┐`,
            `│  MTC ADMIN TERMINAL — AVAILABLE COMMANDS     │`,
            `├─────────────────────────────────────────────┤`,
            `│  sudo heal   Restore 100 HP to player        │`,
            `│  sudo score  Add 5000 to current score       │`,
            `│  sudo next   Kill all enemies, skip wave      │`,
            `│  help        Show this command list           │`,
            `│  clear       Clear terminal output            │`,
            `│  exit        Close admin terminal             │`,
            `└─────────────────────────────────────────────┘`,
        ],
        lsEntries: [
            { text: `drwxr-xr-x  secrets/`, cls: `cline-info` },
            { text: `drwxr-xr-x  grades/`, cls: `cline-info` },
            { text: `-rw-------  kru_manop_passwords.txt`, cls: `cline-warn` },
            { text: `-rw-r--r--  exam_answers_2024.pdf`, cls: `cline-ok` },
        ],
    },
    boss: {
        // ── Boss taunts (KruManop)
        taunts: [
            `ทำการบ้านมารึป่าว!`,
            `เกรดแย่แบบนี้จะสอบติดมั้ยเนี่ย!?`,
            `สมการนี้ง่ายนิดเดียว`,
            `อ่อนเลขขนาดนี้ ไปติวบ้านครูมานพเหอะ`,
            `"log 4.57 = 0.67"`,
            `คิดเลขไม่ออก สอบตกแน่ๆ`,
            `เด็กเจนซีนี่มันอ่อนแอจริงๆ`,
            `แค่นี้ก็ทำไม่ได้แล้วหรอ?`,
            `ข้อนี้ครูแจกให้ฟรีนะ...แจก F น่ะ`,
        ],
        // ── BossFirst (Kru First) phase-transition physics taunts
        firstTaunts: [
            `E = mc²`,
            `Action = Reaction`,
            `Can You Runaway?`,
            `Physic never lies`,
        ],
    },
    gameOver: {
        // ── Report card messages by performance tier
        reports: {
            excellent: [
                `เก่งมาก! เก่งแบบนี้ต้องได้เกรดสี่แน่นอน`,
                `ยอดเยี่ยม! ครูมานพภูมิใจในตัวเธอ`,
                `Outstanding Student!`,
                `ดิเลิศ ประเสริฐศรี`,
                `สมเป็น MTC`,
            ],
            good: [
                `Not bad, Boy!`,
                `Good Job!`,
                ` 'Quite Impressive' `,
                `ใช้ได้เลยลูกพี่`,
            ],
            poor: [
                `สงสัยว่านี่จะเป็นเกมแรกที่พึ่งเคยเล่นในชีวิต`,
                `ตายง่ายขนาดนี้ กลับไปเรียนอนุบาลใหม่ไป๊!`,
                `สภาพพพ`,
                `ไอสั_ กลับไปอ่านหนังสือ!`,
            ],
        },
    },
    ui: {
        hits: `HITS!`,
        godlike: `GODLIKE!`,
        unstoppable: `UNSTOPPABLE!`,
        confusedWarning: `⚠️ CONFUSED : INVERT YOUR MOVEMENT! ⚠️`,
        minimapTitle: `TACTICAL RADAR`,
        legendEnm: `ENM`,
        legendMge: `MGE`,
        legendTnk: `TNK`,
        legendBss: `BSS`,
        legendShp: `SHP`,
        dayPhase: (pct) => `DAY ${pct}%`,
        nightPhase: (pct) => `NIGHT ${pct}%`,
        // ── HUD state labels (centralised from ui.js) ──────
        noActiveBuffs: `ไม่มีบัฟ`,
        endGameSubtitle: `เลือกตัวละครใหม่หรือลองอีกครั้ง`,
        patCharging: `CHARGING`,
        patIaido: `IAIDO!`,
        patEdge: `⚔ EDGE`,
        patRonin: `RONIN`,
        skillActive: `ACTIVE`,
    },
    environment: {
        barrelBoom: `💥 BOOM!`,
        barrelHit: `BARREL HIT!`,
        safeZone: `SAFE ZONE`,
    },
    // ══════════════════════════════════════════════════════
    // 🎓 TUTORIAL TEXTS — ข้อความสอนการเล่นทั้งหมด
    // ══════════════════════════════════════════════════════
    tutorial: {
        welcome: {
            title: `ยินดีต้อนรับสู่ MTC the Game!`,
            body: `มาเรียนรู้วิธีเล่นกันก่อนครับ\n\nกด NEXT หรือ Space Bar เพื่อเริ่มบทเรียน`,
            icon: `🎓`,
        },
        movement: {
            title: `บทที่ 1 : การเคลื่อนที่`,
            body: `กด W A S D เพื่อลองเดินไปรอบๆ\n\n(หวังว่าแค่นี้คงไม่ต้องให้จับมือทำนะ)`,
            icon: `🕹️`,
        },
        shooting: {
            title: `บทที่ 2 : การยิง`,
            body: `เล็งทิศทางด้วยเมาส์ แล้วกดคลิกซ้ายเพื่อยิงกระสุน\n\nลองกดยิง 3 ครั้ง`,
            icon: `🔫`,
        },
        dash: {
            title: `บทที่ 3 : Dash`,
            body: `กด Space Bar เพื่อ Dash หลบการโจมตี\nแต่การ Dash จะมีคูลดาวน์ ควรใช้ให้ถูกจังหวะนะ\n\nลอง Dash 1 ครั้ง`,
            icon: `💨`,
        },
        rclick: {
            title: `บทที่ 4 : สกิลตัวละคร`,
            body: `กดคลิกขวาใช้สกิลประจำตัว\n\nเก้า : [Stealth] ซุ่มยิง\nภูมิ : [Eat Rice] กินข้าวเหนียวฟื้น HP\nAuto : [Wanchai] เรียกแสตนด์มาช่วยต่อยศัตรู\nแพท : [Blade Guard] ยกดาบป้องกันแล้วสะท้อนกระสุนออกไปหาศัตรู\n\nลองกดคลิกขวา 1 ครั้ง`,
            icon: `✨`,
        },
        bulletTime: {
            title: `บทที่ 5 : สโลว์โมชั่น (Bullet Time)`,
            body: `กด T เพื่อชะลอเวลา 70%\nแต่แถบพลังงาน FOCUS ด้านล่างจะค่อยๆลดลง\n\nลองกด T เพื่อชะลอเวลาของเกม`,
            icon: `⏱️`,
        },
        levelUp: {
            title: `บทที่ 6 : การอัพเลเวล (Level Up & Skill Unlocking)`,
            body: `ฆ่าศัตรูได้ EXP → เลเวลอัพ → สกิลแรงขึ้น\n\nSkill 1 : ทำภารกิจแรก → ปลดสกิล Q\nSkill 2 : ทำภารกิจสอง → ปลดสกิลที่เหลือ\nPassive : หลัง Skill Unlocked → ปลดพาสซีฟ`,
            icon: `📈`,
        },
        shop: {
            title: `บทที่ 7 : ร้านค้า (MTC Co-op Store)`,
            body: `ร้านค้าอยู่มุมซ้ายล่างของแผนที่\nเดินเข้าใกล้แล้วกด B เพื่อเปิดร้าน\n\nไอเทมพื้นฐานมีดังนี้\n• 🧃 Energy Drink — ฟื้น HP 60 หน่วย (300)\n• 🛡️ Energy Shield — บล็อก 1 ครั้ง (600)\n• ❤️ Vital Supplement — HP สูงสุด +15 (500)\n• 🔧 Weapon Tuner — ดาเมจ +5% (800)\n• 👟 Lightweight Boots — ความเร็ว +5% (500)\n• 🔮 Focus Crystal — ลด CD สกิล 5% (700)\n\n⚔️ ไอเทมพิเศษ :\n• 🪞 Reflect Armor — สะท้อน 15% ดาเมจ (900)\n• 🫧 Shield Bubble — บล็อก 3 ครั้ง (500)\n• ⚡ Adrenaline Wave — ความเร็ว +30% 8 วิ (400)\n• 🔄 Cooldown Round — รีเซ็ต CD ทันที (600)\n\n👤 ไอเทมเฉพาะตัวละคร :\n• 👻 ผีซุ่ม [เก้า] — Teleport +1 ชาร์จ (750)\n• 🍚 เทพเจ้าอีสาน [ภูมิ] — Naga/Garuda CD -15% (650)\n• 🔥 วันชัยระเบิด [Auto] — ถึง HOT เร็วขึ้น (850)`,
            icon: `🛒`,
        },
        kaoPassive: {
            title: `ฝึกสอน : เก้า`,
            body: `SU1 : ยิงขณะซ่อนให้ได้ 200 ดาเมจ → ปลด Q\nSU2 : ซ่อนแล้วยิง 3 ครั้ง → ปลด E\nPassive : ฆ่า 5 ตัวขณะซ่อน → ปลดพาสซีฟ\n\nWeapon Master : ฆ่าด้วยปืนทั้ง 3 ชนิดอย่างละ 5 ตัว → ฟอร์มทอง`,
            icon: `👻`,
        },
        kaoWeapon: {
            title: `ฝึกสอน : เก้า สลับอาวุธ`,
            body: `เลื่อน Mouse Wheel เพื่อสลับปืน\n\nAuto Rifle — ยิงเร็ว\nSniper — ดาเมจสูง ยิงช้า\nShotgun — ระยะใกล้ ดาเมจสูง\n\nTIP : Stealth ก่อนยิง = คริแน่นอน`,
            icon: `🔄`,
        },
        poomPassive: {
            title: `ฝึกสอน : ภูมิ`,
            body: `ยิงข้าวเหนียวติด Sticky สะสมได้\nกินข้าวเหนียวฟื้น HP + เร็วขึ้น\n\nSU1 : ติด Sticky 10 ตัว → ปลด Q+R\nSU2 : Ritual โดน 4+ ตัว → ปลด E\nPassive : Naga+Garuda พร้อมกัน + ฆ่า Ritual 2 ตัว`,
            icon: `🍚`,
        },
        patPassive: {
            title: `ฝึกสอน : แพท`,
            body: `L-Click : ฟันดาบ (ไกล=คลื่น ใกล้=คอมโบ)\nR-Click : Blade Guard กันกระสุน\n\nSU1 : Iaido โดน 3 ครั้ง → ปลด Q\nSU2 : สะท้อนกระสุน 2 ครั้ง\nPassive : Parry→Zanzo→Iaido ภายใน 10 วิ`,
            icon: `⚔️`,
        },
        autoStandRush: {
            title: `ฝึกสอน : Auto`,
            body: `ตีศัตรู → Heat เพิ่ม : COLD→WARM→HOT→OVERHEAT\nOVERHEAT ดาเมจ x1.3\n\nR-Click : Wanchai Stand ต่อยอัตโนมัติ\nL-Click ขณะ Stand : Stand Rush\n\nSU1 : Rush Melee 400 ดาเมจ → ปลด Q\nSU2 : ORA Combo x8 สำเร็จ 3 ครั้ง → ปลด E\nPassive : ถึง OVERHEAT ครั้งแรก → SCORCHED SOUL`,
            icon: `👊`,
        },
        database: {
            title: `บทที่ 8 : Database Server`,
            body: `อยู่มุมขวาบน\nกด E เปิด Database\nกด F เปิด Admin (พิมพ์ help ดูคำสั่ง)`,
            icon: `🗄️`,
        },
        enemyTypes: {
            title: `บทที่ 9 : ศัตรู`,
            body: `พื้นฐาน : Basic / Tank / Mage\nเสริม Wave 2+ : Charger / Hunter / Poison Spitter / Shield Braver / Sniper / Bomber / Healer / Summoner\n\nWave Event :\n1 Dark / 2,8,11,14 Fog / 4,7,13 Speed / 5,10 Glitch`,
            icon: `👾`,
        },
        boss: {
            title: `บทที่ 10 : Boss`,
            body: `ทุก 3 Wave เจอ Boss\n\nWave 3,9,15 — KruManop\nWave 6,12 — KruFirst\n\nเมื่อ Boss HP ต่ำจะเปิดใช้สกิลอัลติเมท เช่น Domain Expansion`,
            icon: `👑`,
        },
        ready: {
            title: `พร้อมเล่นแล้ว! 🚀`,
            body: `คุณรู้ทุกอย่างที่จำเป็นแล้ว!\n\n🏆 ทำคะแนนสูงสุดเพื่อขึ้น Leaderboard\n⭐ ปลดล็อค Achievements มากมาย\n🎯 ผ่าน Wave ทั้งหมดเพื่อชนะเกม\n\nกด START เพื่อเข้าสู่เกม!`,
            icon: `🎮`,
        },
    },
};

window.GAME_TEXTS = GAME_TEXTS;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GAME_TEXTS };
}
