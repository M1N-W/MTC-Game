'use strict';

/**
 * js/ui/AchievementSystem.js
 * ════════════════════════════════════════════════
 * Achievement tracking and gallery display system.
 * Handles unlocking, persistence, and the "Hall of Fame" UI.
 * ════════════════════════════════════════════════
 */

// ════════════════════════════════════════════════════════════
// 🏆 ACHIEVEMENT SYSTEM
// ════════════════════════════════════════════════════════════
class AchievementSystem {
    constructor() {
        this.list = ACHIEVEMENT_DEFS;
        const saved = (typeof getSaveData === 'function')
            ? (getSaveData().unlockedAchievements || [])
            : [];
        this.unlocked = new Set(saved);
        this.stats = {
            kills: 0, damageTaken: 0, crits: 0,
            dashes: 0, stealths: 0, powerups: 0,
            shopPurchases: 0,
            parries: 0,              // FIX: tracks successful PorkSandwich parries
            droneOverdrives: 0,      // FIX: tracks first drone overdrive activation
            weaponsUsed: new Set(),
            slowMoKills: 0,
            barrelKills: 0,
            standRushKills: 0,       // FIX: was 'wanchaiKills' — synced with AutoPlayer.js naming
            ritualKills: 0,
            manopKills: 0,           // FIX: นับครั้งที่ฆ่า KruManop ได้ — ไม่เคยถูก track มาก่อน
            firstKills: 0,           // FIX: นับครั้งที่ฆ่า KruFirst ได้ — ไม่เคยถูก track มาก่อน

            // ── NEW: Kill Streak Stats (2.3) ─────────────────────────────────
            maxKillStreak: 0,        // Highest kill streak achieved
            currentKillStreak: 0,    // Current kill streak (resets on timeout)
            killStreakTimer: 0,      // Timer for kill streak window (3 seconds)

            // ── NEW: Boss-Specific Stats (2.3) ───────────────────────────────
            manopPerfectKills: 0,    // Kru Manop killed without taking Singularity damage
            firstPerfectKills: 0,    // Kru First killed without taking Sandwich damage  
            speedDemonWins: 0,       // Boss defeated in <30s during Speed Wave
            fogHunterWins: 0,        // Boss defeated in Fog Wave without taking damage
            glitchSurvivorWins: 0,   // Survived Glitch Wave with >50% HP remaining
        };
    }

    check(id) {
        // ── Clean up stale `undefined` entry left by old unlock(string) bug ──
        this.unlocked.delete(undefined);

        if (this.unlocked.has(id)) return;
        const ach = this.list.find(a => a.id === id);
        if (!ach) return;

        let unlock = false;
        switch (id) {
            case 'first_blood': unlock = this.stats.kills >= 1; break;
            case 'wave_1': unlock = getWave() >= 2; break;
            // WARN-9 FIX: window.boss is null at death, old check always falsy.
            // boss.js now sets window.lastBossKilled = true before nulling window.boss.
            case 'boss_down': unlock = !!window.lastBossKilled; break;
            // ── Boss kill achievements — FIX: cases were MISSING from switch ──
            // boss.js calls Achievements.check('manop_down') but switch never matched
            // → manopKills stat is now incremented in boss.js before check() is called
            case 'manop_down': unlock = this.stats.manopKills >= 1; break;
            case 'first_down': unlock = this.stats.firstKills >= 1; break;
            // ── Shop max buff ─────────────────────────────────────────────────
            // shop_max: ซื้อบัฟจนถึง 1.5x — ตรวจสอบจาก player.damageBoost หรือ shopStack
            case 'shop_max': unlock = !!(window.player?.damageBoost >= 1.5 || window.player?._shopBuffStacks >= 5); break;
            case 'no_damage': unlock = this.stats.damageTaken === 0 && getEnemiesKilled() >= 5; break;
            case 'crit_master': unlock = this.stats.crits >= 5; break;
            case 'speedster': unlock = this.stats.dashes >= 20; break;
            case 'ghost': unlock = this.stats.stealths >= 10; break;
            case 'collector': unlock = this.stats.powerups >= 10; break;
            case 'weapon_master': unlock = this.stats.weaponsUsed.size >= 3; break;
            // WARN-15 FIX: PoomPlayer.js loads after ui.js — guard with typeof
            case 'naga_summoner': unlock = typeof PoomPlayer !== 'undefined'
                && window.player instanceof PoomPlayer
                && window.player.nagaCount >= 3; break;
            case 'shopaholic': unlock = this.stats.shopPurchases >= 5; break;
            // FIX: was `unlock = true` — caused instant unlock on every checkAll() call
            case 'parry_master': unlock = this.stats.parries >= 1; break;
            // FIX: was missing entirely — unlock(string) bug caused undefined popup + multi-fire
            case 'drone_master': unlock = this.stats.droneOverdrives >= 1; break;
            case 'wave_5': unlock = getWave() >= 6; break;
            case 'wave_10': unlock = getWave() >= 11; break;
            case 'bullet_time_kill': unlock = this.stats.slowMoKills >= 3; break;
            case 'barrel_bomber': unlock = this.stats.barrelKills >= 3; break;
            case 'kao_awakened': unlock = window.player?.charId === 'kao' && !!window.player?.isWeaponMaster; break;
            // FIX: stat renamed wanchaiKills → standRushKills to match AutoPlayer.js
            case 'stand_rush_kill': unlock = this.stats.standRushKills >= 10; break;
            // FIX: use ritualKills stat directly — was using opaque _ritualWipeUnlocked flag
            case 'ritual_wipe': unlock = this.stats.ritualKills >= 3; break;

            // ── NEW: Passive Awakening achievements ───────────────────────────
            case 'scorched_soul': unlock = window.player?.charId === 'auto' && !!window.player?.passiveUnlocked; break;
            case 'ritual_king': unlock = window.player?.charId === 'poom' && !!window.player?.passiveUnlocked; break;
            case 'free_stealth': unlock = window.player?.charId === 'kao' && !!window.player?.passiveUnlocked; break;

            // ── NEW: Cosmic Balance ───────────────────────────────────────────
            case 'cosmic_balance': unlock = !!(window.player?.charId === 'poom' && window.player?._cosmicBalance); break;

            // ── NEW: Rage Mode ────────────────────────────────────────────────
            case 'rage_mode': unlock = !!(window.player?.charId === 'auto' && window.player?._rageMode); break;

            // ── NEW: Kill Streak Achievements (2.3) ─────────────────────────────
            case 'kill_streak_5': unlock = this.stats.maxKillStreak >= 5; break;
            case 'kill_streak_10': unlock = this.stats.maxKillStreak >= 10; break;
            case 'kill_streak_20': unlock = this.stats.maxKillStreak >= 20; break;

            // ── NEW: Boss-Specific Achievements (2.3) ────────────────────────────
            case 'manop_perfect': unlock = this.stats.manopPerfectKills >= 1; break;
            case 'first_perfect': unlock = this.stats.firstPerfectKills >= 1; break;
            case 'speed_demon': unlock = this.stats.speedDemonWins >= 1; break;
            case 'fog_hunter': unlock = this.stats.fogHunterWins >= 1; break;
            case 'glitch_survivor': unlock = this.stats.glitchSurvivorWins >= 1; break;
        }
        if (unlock) this.unlock(ach);
    }

    unlock(ach, retryCount = 0) {
        const MAX_RETRIES = 3;

        // ── Mark as unlocked only on first attempt ───────────────
        if (retryCount === 0) {
            this.unlocked.add(ach.id);
            if (typeof updateSaveData === 'function') {
                updateSaveData({ unlockedAchievements: Array.from(this.unlocked) });
            }
        }

        // ── Audio (guarded — Audio may not be ready yet) ─────────
        try {
            if (typeof Audio !== 'undefined' && Audio.playAchievement) Audio.playAchievement();
        } catch (e) { /* audio failure must not block the popup */ }

        // ── DOM popup ────────────────────────────────────────────
        const container = document.getElementById('achievements');
        if (!container) {
            if (retryCount < MAX_RETRIES) {
                console.warn(`[Achievement] Container not found, retry ${retryCount + 1}/${MAX_RETRIES}`);
                setTimeout(() => this.unlock(ach, retryCount + 1), 100);
            } else {
                console.error('[Achievement] Failed to display after max retries - DOM element missing');
            }
            return;
        }

        const el = document.createElement('div');
        el.className = 'achievement';
        el.innerHTML = `
            <div class="achievement-title">${ach.icon} ${ach.name}</div>
            <div class="achievement-desc">${ach.desc}</div>
        `;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 500);
        }, 3000);

        if (typeof addScore === 'function') {
            addScore(BALANCE.score.achievement);
        }
    }

    checkAll() { this.list.forEach(ach => this.check(ach.id)); }
}

// ════════════════════════════════════════════════════════════
// 🏆 ACHIEVEMENT GALLERY (หอเกียรติยศ)
// ════════════════════════════════════════════════════════════
class AchievementGallery {
    static open() {
        AchievementGallery.render();
        const modal = document.getElementById('achievements-modal');
        if (!modal) return;
        modal.style.display = 'flex';
        requestAnimationFrame(() => {
            const inner = modal.querySelector('.ach-inner');
            if (inner) inner.classList.add('ach-visible');
        });
    }

    static close() {
        const modal = document.getElementById('achievements-modal');
        if (!modal) return;
        const inner = modal.querySelector('.ach-inner');
        if (inner) inner.classList.remove('ach-visible');
        setTimeout(() => { modal.style.display = 'none'; }, 260);
    }

    static render() {
        const container = document.getElementById('ach-items');
        const summary = document.getElementById('ach-summary');
        const buffSummEl = document.getElementById('ach-buff-summary');
        if (!container) return;
        container.innerHTML = '';

        // Guard: Achievements global may not be ready in some edge cases
        const unlockedSet = (window.Achievements instanceof AchievementSystem)
            ? window.Achievements.unlocked
            : new Set((typeof getSaveData === 'function'
                ? (getSaveData().unlockedAchievements || [])
                : []));

        const total = ACHIEVEMENT_DEFS.length;
        const count = ACHIEVEMENT_DEFS.filter(a => unlockedSet.has(a.id)).length;

        if (summary) summary.textContent = `🏆 ปลดล็อคแล้ว: ${count} / ${total}`;

        // ── Part 1: Tally unlocked rewards ───────────────────────
        const tally = { hp: 0, damage: 0, speed: 0, crit: 0, cdr: 0 };
        ACHIEVEMENT_DEFS.forEach(ach => {
            if (!unlockedSet.has(ach.id) || !ach.reward) return;
            tally[ach.reward.type] = (tally[ach.reward.type] || 0) + ach.reward.value;
        });

        if (buffSummEl) {
            const chips = [];
            if (tally.hp > 0) chips.push(`❤️ +${tally.hp} Max HP`);
            if (tally.damage > 0) chips.push(`⚔️ +${Math.round(tally.damage * 100)}% DMG`);
            if (tally.speed > 0) chips.push(`💨 +${Math.round(tally.speed * 100)}% SPD`);
            if (tally.crit > 0) chips.push(`💥 +${Math.round(tally.crit * 100)}% CRIT`);
            if (tally.cdr > 0) chips.push(`🔮 -${Math.round(tally.cdr * 100)}% CDR`);

            if (chips.length > 0) {
                buffSummEl.innerHTML = chips
                    .map(c => `<span class="buff-chip">${c}</span>`)
                    .join('');
            } else {
                buffSummEl.innerHTML = `<span style="color:#475569; font-size:11px;">${(typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.ui?.noActiveBuffs) ?? 'ไม่มีบัฟ'}</span>`;
            }
        }

        // ── Part 2: Render cards with reward pill ─────────────────
        ACHIEVEMENT_DEFS.forEach(ach => {
            const isUnlocked = unlockedSet.has(ach.id);
            const rewardHtml = ach.reward
                ? `<div class="ach-reward ${isUnlocked ? 'active' : 'locked-reward'}">🎁 ${ach.reward.text}</div>`
                : '';

            const card = document.createElement('div');
            card.className = `ach-card ${isUnlocked ? 'unlocked' : 'locked'}`;
            card.innerHTML = `
                <div class="ach-icon">${ach.icon}</div>
                <div class="ach-info">
                    <div class="ach-name">${ach.name}</div>
                    <div class="ach-desc">${isUnlocked ? ach.desc : '???'}</div>
                    ${rewardHtml}
                </div>
            `;
            container.appendChild(card);
        });
    }
}

// Global singletons
window.AchievementSystem = AchievementSystem;
window.AchievementGallery = AchievementGallery;
window.Achievements = new AchievementSystem();
