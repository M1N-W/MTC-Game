'use strict';
/**
 * MTC: ENHANCED EDITION - UI System (REFACTORED)
 *
 * CHANGES (Stability Overhaul):
 * - ✅ lerpColorHex() and lerpColor() REMOVED from this file.
 *       They now live in utils.js and are globally available.
 *       Removing them here eliminates the "duplicate identifier" crash
 *       that occurred when both files were loaded.
 * - ✅ hexToRgb() REMOVED from this file (defined in utils.js).
 * - ✅ ShopManager and UIManager explicitly assigned to window.* so
 *       other scripts can reference them before class parsing is complete.
 * - ✅ initHighScoreOnLoad() wrapped in DOMContentLoaded for safer timing.
 *
 * Load order: config.js → utils.js → audio.js → effects.js → weapons.js → map.js → ui.js → ai.js → entities.js → game.js
 *
 * ────────────────────────────────────────────────────────────────
 * UX — CONFUSED-STATE WARNING BANNER (UX Designer pass)
 * ────────────────────────────────────────────────────────────────
 * ✅ drawConfusedWarning(ctx) — Static method on UIManager.
 *    Called every frame from UIManager.draw() when
 *    window.player.isConfused is true.
 *
 *    Appearance:
 *      • Bold pill-shaped banner, purple background with neon glow.
 *      • Text: "⚠️ CONFUSED : INVERT YOUR MOVEMENT! ⚠️"
 *      • Flashes at ~4 Hz (Math.sin period 125 ms) so it grabs
 *        attention without becoming permanently distracting.
 *      • Positioned at H - 270 px so it sits clearly above the
 *        Bullet Time energy badge (H - 140) and the skill-slot row.
 *
 *    The Glitch Wave floating-text announcements in game.js have been
 *    raised to Y offsets ≥ −200 px (world space) so they do not
 *    overlap this banner in screen space.
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

        addScore(BALANCE.score.achievement);
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
                buffSummEl.innerHTML = '<span style="color:#475569; font-size:11px;">No active buffs</span>';
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
window.AchievementGallery = AchievementGallery;

// ════════════════════════════════════════════════════════════
// 🛒 SHOP MANAGER
// ════════════════════════════════════════════════════════════
class ShopManager {

    static open() {
        ShopManager.renderItems();
        const modal = document.getElementById('shop-modal');
        if (modal) {
            modal.style.display = 'flex';
            requestAnimationFrame(() => {
                const inner = modal.querySelector('.shop-inner');
                if (inner) inner.classList.add('shop-visible');
            });
        }
    }

    static close() {
        const modal = document.getElementById('shop-modal');
        if (!modal) return;
        const inner = modal.querySelector('.shop-inner');
        if (inner) inner.classList.remove('shop-visible');
        setTimeout(() => { modal.style.display = 'none'; }, 260);
    }

    static renderItems() {
        const container = document.getElementById('shop-items');
        if (!container) return;
        container.innerHTML = '';

        const offers = window.currentShopOffers || [];
        const currentScore = typeof getScore === 'function' ? getScore() : 0;

        const scoreDisplay = document.getElementById('shop-score-display');
        if (scoreDisplay) scoreDisplay.textContent = currentScore.toLocaleString();

        offers.forEach((offer, idx) => {
            const { item, soldOut } = offer;
            const canAfford = !soldOut && currentScore >= item.cost;
            const typeLabel = item.type === 'permanent'
                ? `<span class="shop-duration" style="color:#a78bfa;">♾ ถาวร</span>`
                : `<span class="shop-duration" style="color:#22c55e;">⚡ ทันที</span>`;

            // Char-specific badge
            const charLabels = { kao: { label: 'KAO', color: '#facc15' }, poom: { label: 'POOM', color: '#4ade80' }, auto: { label: 'AUTO', color: '#fb923c' } };
            const charBadge = item.charReq
                ? `<span class="shop-card-char-badge" style="background:${charLabels[item.charReq]?.color ?? '#94a3b8'}22; border-color:${charLabels[item.charReq]?.color ?? '#94a3b8'}; color:${charLabels[item.charReq]?.color ?? '#94a3b8'};">${charLabels[item.charReq]?.label ?? item.charReq.toUpperCase()} ONLY</span>`
                : '';

            const card = document.createElement('div');
            card.className = `shop-card${soldOut ? ' shop-card-disabled' : ''}`;
            card.id = `shop-card-slot-${idx}`;
            card.setAttribute('data-item-id', item.id);
            if (item.charReq) card.style.setProperty('--shop-char-color', charLabels[item.charReq]?.color ?? '#94a3b8');

            // Active buff badge for items with timers
            // BUG 2/3 FIX: read shopSpeedBoostTimer — the property game.js actually ticks
            const activeBadge = (item.id === 'speedWave' && window.player?.shopSpeedBoostActive && window.player?.shopSpeedBoostTimer > 0)
                ? `<span class="shop-card-active-badge">⚡ ${Math.ceil(window.player.shopSpeedBoostTimer)}s</span>`
                : '';

            card.innerHTML = `
                ${charBadge}
                ${activeBadge}
                <div class="shop-card-icon" style="color:${item.color};${soldOut ? 'filter:grayscale(1) opacity(.35);' : ''}">${item.icon}</div>
                <div class="shop-card-name">${item.name}</div>
                <div class="shop-card-desc">${soldOut ? '<span style="color:#64748b;">— SOLD OUT —</span>' : item.desc}</div>
                ${typeLabel}
                <div class="shop-card-cost">
                    <span class="shop-cost-icon">🏆</span>
                    <span class="shop-cost-value">${item.cost.toLocaleString()}</span>
                </div>
                <button
                    class="shop-buy-btn"
                    onclick="buyItem(${idx})"
                    ontouchstart="event.preventDefault(); buyItem(${idx});"
                    style="border-color:${item.color}; --shop-btn-color:${item.color};"
                    ${soldOut || !canAfford ? 'disabled' : ''}
                >${soldOut ? 'SOLD OUT' : 'BUY'}</button>
            `;
            container.appendChild(card);
        });
    }

    // Kept for backward-compat call-sites (tick, etc.)
    static updateButtons() { ShopManager.renderItems(); }

    // BUG 3 FIX: tick() updates countdown badge in-place — no full DOM re-render,
    // and works correctly while game is PAUSED (shop open state).
    static tick() {
        const p = window.player;
        if (!p) return;
        const badge = document.querySelector('[data-item-id="speedWave"] .shop-card-active-badge');
        if (badge) {
            if (p.shopSpeedBoostActive && p.shopSpeedBoostTimer > 0) {
                badge.textContent = `⚡ ${Math.ceil(p.shopSpeedBoostTimer)}s`;
            } else {
                badge.textContent = '';
            }
        }
    }
}


// ── Portrait SVG definitions (inner-content, no outer <svg> tag) ────────────
// All gradient/clipPath IDs are prefixed k/p/a — safe when all 3 are in the DOM.
// Exposed as window.PORTRAITS so menu.js can populate char-select cards on load.
window.PORTRAITS = {
    kao: '\n<defs>\n  <clipPath id="cpk"><rect width="96" height="112" rx="3"/></clipPath>\n  <linearGradient id="kBg" x1="0" y1="0" x2="0" y2="1">\n    <stop offset="0%" stop-color="#060d20"/>\n    <stop offset="100%" stop-color="#020810"/>\n  </linearGradient>\n  <radialGradient id="kFace" cx="48%" cy="42%" r="50%">\n    <stop offset="0%" stop-color="#e8c49a"/>\n    <stop offset="80%" stop-color="#c8944a"/>\n    <stop offset="100%" stop-color="#b07830"/>\n  </radialGradient>\n  <radialGradient id="kEyeL" cx="35%" cy="30%" r="65%">\n    <stop offset="0%" stop-color="#4a8fff"/>\n    <stop offset="60%" stop-color="#1a4fcc"/>\n    <stop offset="100%" stop-color="#0a1f6e"/>\n  </radialGradient>\n  <radialGradient id="kScope" cx="38%" cy="28%" r="65%">\n    <stop offset="0%" stop-color="#22ddff"/>\n    <stop offset="100%" stop-color="#0090c0"/>\n  </radialGradient>\n  <filter id="kGlw" x="-30%" y="-30%" width="160%" height="160%">\n    <feGaussianBlur stdDeviation="2.5" result="b"/>\n    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>\n  </filter>\n  <filter id="kSoft" x="-20%" y="-20%" width="140%" height="140%">\n    <feGaussianBlur stdDeviation="1.2" result="b"/>\n    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>\n  </filter>\n</defs>\n<g clip-path="url(#cpk)">\n  <!-- BG -->\n  <rect width="96" height="112" fill="url(#kBg)"/>\n  <!-- subtle scan-line bg texture -->\n  <rect width="96" height="112" fill="none" stroke="rgba(59,130,246,0.04)" stroke-width="1" style="stroke-dasharray:1 3"/>\n  <!-- bg accent lines -->\n  <line x1="0" y1="90" x2="96" y2="80" stroke="rgba(250,204,21,0.06)" stroke-width="8"/>\n  <!-- UNIFORM BODY -->\n  <path d="M-6 112 L14 68 Q48 80 82 68 L102 112Z" fill="#0c1a3a"/>\n  <path d="M14 68 Q48 80 82 68 L80 76 Q48 88 16 76Z" fill="#132244"/>\n  <!-- collar V-notch + gold trim -->\n  <path d="M36 68 L48 84 L60 68" fill="none" stroke="#facc15" stroke-width="1.8" stroke-linejoin="round"/>\n  <!-- epaulette stripes left -->\n  <path d="M14 70 L28 70 M14 73 L26 73" stroke="#facc15" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>\n  <!-- MTC badge -->\n  <rect x="40" y="86" width="16" height="9" rx="1" fill="rgba(250,204,21,0.12)" stroke="rgba(250,204,21,0.5)" stroke-width="0.7"/>\n  <text x="48" y="92.5" text-anchor="middle" fill="#facc15" font-size="5" font-family="monospace" font-weight="bold" letter-spacing="0.5">MTC</text>\n  <!-- NECK -->\n  <path d="M39 64 Q48 70 57 64 L56 71 Q48 77 40 71Z" fill="#c48040"/>\n  <!-- ear L -->\n  <ellipse cx="27" cy="50" rx="4" ry="5.5" fill="#c8944a"/>\n  <path d="M28 47 Q25 50 28 53" fill="none" stroke="#b07030" stroke-width="1"/>\n  <!-- ear R -->\n  <ellipse cx="69" cy="50" rx="4" ry="5.5" fill="#c8944a"/>\n  <!-- HEAD shape — anime oval, slightly narrow jaw -->\n  <path d="M28 52 Q26 36 48 28 Q70 36 68 52 Q68 64 58 68 Q48 72 38 68 Q28 64 28 52Z" fill="url(#kFace)"/>\n  <!-- ── HAIR (spiky, swept right-to-left, dark navy) ── -->\n  <!-- base cap -->\n  <path d="M26 46 Q24 28 48 22 Q72 28 70 46" fill="#0a0f28"/>\n  <!-- main side sweep — left spike cluster -->\n  <path d="M26 44 Q20 36 18 24 Q24 28 28 34 Q22 30 24 22 Q30 26 32 33 Q28 25 32 18 Q38 24 36 33Z" fill="#0e1535"/>\n  <!-- right tuft behind ear -->\n  <path d="M70 44 Q74 38 76 28 Q70 32 68 38Z" fill="#0e1535"/>\n  <!-- top peak spikes -->\n  <path d="M38 24 Q36 16 40 12 Q42 18 44 22Z" fill="#0e1535"/>\n  <path d="M44 22 Q44 13 48 10 Q50 16 50 22Z" fill="#0a0f28"/>\n  <path d="M50 22 Q52 14 56 12 Q56 18 54 24Z" fill="#0e1535"/>\n  <!-- hair shine -->\n  <path d="M34 28 Q36 24 42 26" fill="none" stroke="rgba(120,150,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>\n  <!-- GRAD CAP — flat on spiky hair -->\n  <rect x="30" y="30" width="36" height="4" rx="0.8" fill="#05091a"/>\n  <rect x="36" y="25" width="24" height="6" rx="1" fill="#05091a"/>\n  <!-- tassel -->\n  <path d="M60 28 Q67 33 65 41" fill="none" stroke="#facc15" stroke-width="1.4" stroke-linecap="round"/>\n  <circle cx="65" cy="42" r="2.8" fill="#facc15" filter="url(#kGlw)"/>\n  <!-- cap shine -->\n  <line x1="36" y1="27" x2="52" y2="27" stroke="rgba(255,255,255,0.12)" stroke-width="0.8"/>\n  <!-- ── LEFT EYE (normal) ── -->\n  <!-- white -->\n  <ellipse cx="37" cy="50" rx="6" ry="5" fill="white"/>\n  <!-- iris gradient -->\n  <circle cx="37" cy="50" r="4.2" fill="url(#kEyeL)"/>\n  <!-- pupil -->\n  <circle cx="37" cy="50" r="2.2" fill="#04080f"/>\n  <!-- eye shine — anime double dot -->\n  <circle cx="35.5" cy="48.5" r="1.5" fill="white" opacity="0.9"/>\n  <circle cx="39" cy="51.5" r="0.7" fill="white" opacity="0.5"/>\n  <!-- upper eyelid line -->\n  <path d="M31 47 Q37 44.5 43 47" fill="none" stroke="#1a0a00" stroke-width="1.5" stroke-linecap="round"/>\n  <!-- ── RIGHT EYE (scope monocle overlay) ── -->\n  <ellipse cx="59" cy="50" rx="6" ry="5" fill="white"/>\n  <circle cx="59" cy="50" r="4.2" fill="url(#kEyeL)"/>\n  <circle cx="59" cy="50" r="2.2" fill="#04080f"/>\n  <circle cx="57.5" cy="48.5" r="1.5" fill="white" opacity="0.9"/>\n  <circle cx="61" cy="51.5" r="0.7" fill="white" opacity="0.5"/>\n  <path d="M53 47 Q59 44.5 65 47" fill="none" stroke="#1a0a00" stroke-width="1.5" stroke-linecap="round"/>\n  <!-- scope ring -->\n  <circle cx="59" cy="50" r="8.5" fill="none" stroke="url(#kScope)" stroke-width="1.2" filter="url(#kSoft)" opacity="0.85"/>\n  <!-- scope crosshair ticks -->\n  <line x1="59" y1="40.5" x2="59" y2="43" stroke="#22ddff" stroke-width="0.9" opacity="0.7"/>\n  <line x1="59" y1="57" x2="59" y2="59.5" stroke="#22ddff" stroke-width="0.9" opacity="0.7"/>\n  <line x1="49.5" y1="50" x2="52" y2="50" stroke="#22ddff" stroke-width="0.9" opacity="0.7"/>\n  <line x1="66" y1="50" x2="68.5" y2="50" stroke="#22ddff" stroke-width="0.9" opacity="0.7"/>\n  <!-- arm to temple -->\n  <line x1="67.5" y1="44" x2="73" y2="40" stroke="#22ddff" stroke-width="1" opacity="0.5"/>\n  <!-- ── NOSE + MOUTH ── -->\n  <path d="M46 56 L48 59 L50 56" fill="none" stroke="rgba(160,80,20,0.5)" stroke-width="1" stroke-linejoin="round"/>\n  <path d="M42 63 Q48 67 54 63" fill="none" stroke="#b06030" stroke-width="1.5" stroke-linecap="round"/>\n  <!-- lip highlight -->\n  <path d="M44 63 Q48 65 52 63" fill="rgba(255,180,120,0.2)"/>\n  <!-- EYEBROWS — sharp angled -->\n  <path d="M31 45 Q37 42 43 44" fill="none" stroke="#0a0f28" stroke-width="2.2" stroke-linecap="round"/>\n  <path d="M53 44 Q59 42 65 45" fill="none" stroke="#0a0f28" stroke-width="2.2" stroke-linecap="round"/>\n  <!-- ── CROSSHAIR CORNER ── -->\n  <g opacity="0.28" filter="url(#kSoft)">\n    <circle cx="14" cy="14" r="9" fill="none" stroke="#facc15" stroke-width="0.9"/>\n    <circle cx="14" cy="14" r="2.5" fill="none" stroke="#facc15" stroke-width="0.7"/>\n    <line x1="14" y1="3" x2="14" y2="7" stroke="#facc15" stroke-width="0.8"/>\n    <line x1="14" y1="21" x2="14" y2="25" stroke="#facc15" stroke-width="0.8"/>\n    <line x1="3" y1="14" x2="7" y2="14" stroke="#facc15" stroke-width="0.8"/>\n    <line x1="21" y1="14" x2="25" y2="14" stroke="#facc15" stroke-width="0.8"/>\n  </g>\n  <!-- bottom trim -->\n  <rect x="0" y="109" width="96" height="3" fill="rgba(250,204,21,0.25)"/>\n  <line x1="0" y1="109" x2="96" y2="109" stroke="rgba(250,204,21,0.5)" stroke-width="0.6"/>\n</g>\n',
    poom: '\n<defs>\n  <clipPath id="cpp"><rect width="96" height="112" rx="3"/></clipPath>\n  <linearGradient id="pBg" x1="0" y1="0" x2="0.3" y2="1">\n    <stop offset="0%" stop-color="#040e08"/>\n    <stop offset="100%" stop-color="#020508"/>\n  </linearGradient>\n  <radialGradient id="pFace" cx="45%" cy="40%" r="52%">\n    <stop offset="0%" stop-color="#d4a870"/>\n    <stop offset="75%" stop-color="#b07840"/>\n    <stop offset="100%" stop-color="#8a5020"/>\n  </radialGradient>\n  <radialGradient id="pEye" cx="30%" cy="28%" r="65%">\n    <stop offset="0%" stop-color="#88ffcc"/>\n    <stop offset="45%" stop-color="#10b981"/>\n    <stop offset="100%" stop-color="#065a3a"/>\n  </radialGradient>\n  <linearGradient id="pRobe" x1="0" y1="0" x2="0.2" y2="1">\n    <stop offset="0%" stop-color="#1a3a22"/>\n    <stop offset="100%" stop-color="#080f0a"/>\n  </linearGradient>\n  <filter id="pNaga" x="-40%" y="-40%" width="180%" height="180%">\n    <feGaussianBlur stdDeviation="3" result="b"/>\n    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>\n  </filter>\n  <filter id="pSft" x="-20%" y="-20%" width="140%" height="140%">\n    <feGaussianBlur stdDeviation="1.2" result="b"/>\n    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>\n  </filter>\n</defs>\n<g clip-path="url(#cpp)">\n  <rect width="96" height="112" fill="url(#pBg)"/>\n  <!-- ambient bg glow -->\n  <circle cx="20" cy="60" r="40" fill="rgba(16,185,129,0.04)"/>\n  <circle cx="48" cy="80" r="30" fill="rgba(245,158,11,0.05)"/>\n  <!-- ROBE -->\n  <path d="M-6 112 L16 66 Q48 78 80 66 L102 112Z" fill="url(#pRobe)"/>\n  <path d="M16 66 Q48 78 80 66 L78 75 Q48 87 18 75Z" fill="#1e4428"/>\n  <!-- robe hem lines -->\n  <path d="M20 76 Q48 86 76 76" fill="none" stroke="rgba(245,158,11,0.3)" stroke-width="1"/>\n  <path d="M24 86 Q48 93 72 86" fill="none" stroke="rgba(245,158,11,0.15)" stroke-width="0.7"/>\n  <!-- center line -->\n  <line x1="48" y1="72" x2="48" y2="112" stroke="rgba(245,158,11,0.2)" stroke-width="1.2"/>\n  <!-- collar ornament -->\n  <path d="M36 66 L48 82 L60 66" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round"/>\n  <!-- gold beads on collar -->\n  <circle cx="40" cy="72" r="1.5" fill="#f59e0b" opacity="0.8"/>\n  <circle cx="48" cy="82" r="1.5" fill="#f59e0b" opacity="0.8"/>\n  <circle cx="56" cy="72" r="1.5" fill="#f59e0b" opacity="0.8"/>\n  <!-- NECK -->\n  <path d="M39 63 Q48 69 57 63 L56 70 Q48 76 40 70Z" fill="#a06030"/>\n  <!-- ear studs gold -->\n  <ellipse cx="27" cy="51" rx="4" ry="5.5" fill="#b07840"/>\n  <circle cx="27" cy="48" r="2" fill="#f59e0b" opacity="0.8"/>\n  <ellipse cx="69" cy="51" rx="4" ry="5.5" fill="#b07840"/>\n  <circle cx="69" cy="48" r="2" fill="#f59e0b" opacity="0.8"/>\n  <!-- HEAD -->\n  <path d="M28 53 Q27 36 48 28 Q69 36 68 53 Q68 65 58 70 Q48 74 38 70 Q28 65 28 53Z" fill="url(#pFace)"/>\n  <!-- ── HAIR — wavy, medium length, dark brown/auburn, swept back ── -->\n  <!-- main back volume -->\n  <path d="M27 50 Q22 35 28 22 Q38 14 48 14 Q58 14 68 22 Q74 35 69 50" fill="#1a0800"/>\n  <!-- left side flow — waves down past jaw -->\n  <path d="M27 50 Q22 55 20 64 Q18 72 22 78 Q19 72 22 62 Q24 54 28 48Z" fill="#240c00"/>\n  <!-- right side flow -->\n  <path d="M69 50 Q74 55 76 64 Q78 72 74 78 Q77 72 74 62 Q72 54 68 48Z" fill="#240c00"/>\n  <!-- wave texture strands left -->\n  <path d="M24 38 Q20 46 22 56" fill="none" stroke="rgba(80,30,0,0.6)" stroke-width="1.5" stroke-linecap="round"/>\n  <path d="M26 34 Q22 42 24 52" fill="none" stroke="rgba(60,20,0,0.4)" stroke-width="1" stroke-linecap="round"/>\n  <!-- wave texture strands right -->\n  <path d="M72 38 Q76 46 74 56" fill="none" stroke="rgba(80,30,0,0.6)" stroke-width="1.5" stroke-linecap="round"/>\n  <!-- top parting + highlight -->\n  <path d="M40 16 Q48 13 56 16" fill="none" stroke="rgba(160,80,20,0.5)" stroke-width="1"/>\n  <path d="M38 18 Q44 15 50 17" fill="none" stroke="rgba(255,180,80,0.3)" stroke-width="1.5" stroke-linecap="round"/>\n  <!-- hair accessory — gold knotted band -->\n  <rect x="60" y="32" width="12" height="4" rx="2" fill="#f59e0b" opacity="0.7" transform="rotate(-20,66,34)"/>\n  <!-- ── EYES (slit pupils — naga influence) ── -->\n  <!-- L eye white -->\n  <ellipse cx="37" cy="50" rx="6.5" ry="5.2" fill="white"/>\n  <!-- L iris -->\n  <circle cx="37" cy="50" r="4.5" fill="url(#pEye)"/>\n  <!-- L slit pupil -->\n  <ellipse cx="37" cy="50" rx="1.2" ry="3.5" fill="#030f08"/>\n  <!-- L shines -->\n  <circle cx="35" cy="48" r="1.8" fill="white" opacity="0.9"/>\n  <circle cx="39.5" cy="52" r="0.8" fill="white" opacity="0.45"/>\n  <!-- L upper lid -->\n  <path d="M30.5 47 Q37 44 43.5 47" fill="none" stroke="#150800" stroke-width="2" stroke-linecap="round"/>\n  <!-- L lash tips -->\n  <line x1="31" y1="47.5" x2="29.5" y2="45.5" stroke="#150800" stroke-width="1.2" stroke-linecap="round"/>\n  <line x1="43" y1="47.5" x2="44.5" y2="45.5" stroke="#150800" stroke-width="1.2" stroke-linecap="round"/>\n  <!-- R eye white -->\n  <ellipse cx="59" cy="50" rx="6.5" ry="5.2" fill="white"/>\n  <circle cx="59" cy="50" r="4.5" fill="url(#pEye)"/>\n  <ellipse cx="59" cy="50" rx="1.2" ry="3.5" fill="#030f08"/>\n  <circle cx="57" cy="48" r="1.8" fill="white" opacity="0.9"/>\n  <circle cx="61.5" cy="52" r="0.8" fill="white" opacity="0.45"/>\n  <path d="M52.5 47 Q59 44 65.5 47" fill="none" stroke="#150800" stroke-width="2" stroke-linecap="round"/>\n  <line x1="53" y1="47.5" x2="51.5" y2="45.5" stroke="#150800" stroke-width="1.2" stroke-linecap="round"/>\n  <line x1="65" y1="47.5" x2="66.5" y2="45.5" stroke="#150800" stroke-width="1.2" stroke-linecap="round"/>\n  <!-- EYEBROWS — smooth, slightly arched -->\n  <path d="M31 44 Q37 41 43 43" fill="none" stroke="#2a0e00" stroke-width="2.5" stroke-linecap="round"/>\n  <path d="M53 43 Q59 41 65 44" fill="none" stroke="#2a0e00" stroke-width="2.5" stroke-linecap="round"/>\n  <!-- NOSE -->\n  <path d="M46 56 L48 59.5 L50 56" fill="none" stroke="rgba(140,70,10,0.45)" stroke-width="1.1" stroke-linejoin="round"/>\n  <!-- MOUTH — slight enigmatic smile -->\n  <path d="M42 64 Q48 68.5 54 64" fill="none" stroke="#905020" stroke-width="1.6" stroke-linecap="round"/>\n  <path d="M43 64 Q48 66 53 64" fill="rgba(255,160,80,0.15)"/>\n  <!-- ── NAGA — coiled at left shoulder rising ── -->\n  <!-- glow halo -->\n  <path d="M6 92 Q-2 72 8 52 Q14 38 26 38" fill="none" stroke="#10b981" stroke-width="8" stroke-linecap="round" opacity="0.25" filter="url(#pNaga)"/>\n  <!-- body -->\n  <path d="M6 92 Q-2 72 8 52 Q14 38 26 38" fill="none" stroke="#10b981" stroke-width="4.5" stroke-linecap="round"/>\n  <!-- scale pattern -->\n  <path d="M6 92 Q-2 72 8 52 Q14 38 26 38" fill="none" stroke="#34d399" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="4 3"/>\n  <!-- naga HEAD -->\n  <ellipse cx="26.5" cy="37" rx="8.5" ry="5.5" fill="#10b981" transform="rotate(-40,26.5,37)" filter="url(#pSft)"/>\n  <ellipse cx="26.5" cy="37" rx="8.5" ry="5.5" fill="#34d399" transform="rotate(-40,26.5,37)" opacity="0.5"/>\n  <!-- naga eye — amber vertical slit -->\n  <circle cx="23.5" cy="34" r="2" fill="#f59e0b"/>\n  <ellipse cx="23.5" cy="34" rx="0.7" ry="1.8" fill="#0a0000"/>\n  <circle cx="23" cy="33.3" r="0.7" fill="rgba(255,255,200,0.8)"/>\n  <!-- tongue -->\n  <path d="M31 35 L36 31 M36 31 L35 28.5 M36 31 L37.5 28.5" fill="none" stroke="#34d399" stroke-width="1" stroke-linecap="round"/>\n  <!-- bottom trim -->\n  <rect x="0" y="109" width="96" height="3" fill="rgba(245,158,11,0.2)"/>\n  <line x1="0" y1="109" x2="96" y2="109" stroke="rgba(245,158,11,0.45)" stroke-width="0.7"/>\n</g>\n',
    auto: '\n<defs>\n  <clipPath id="cpa"><rect width="96" height="112" rx="3"/></clipPath>\n  <radialGradient id="aBg" cx="48%" cy="55%" r="65%">\n    <stop offset="0%" stop-color="#1a0404"/>\n    <stop offset="100%" stop-color="#060101"/>\n  </radialGradient>\n  <radialGradient id="aFace" cx="44%" cy="38%" r="52%">\n    <stop offset="0%" stop-color="#cc8855"/>\n    <stop offset="75%" stop-color="#a05828"/>\n    <stop offset="100%" stop-color="#7a3810"/>\n  </radialGradient>\n  <radialGradient id="aEye" cx="30%" cy="25%" r="65%">\n    <stop offset="0%" stop-color="#ffe080"/>\n    <stop offset="50%" stop-color="#f97316"/>\n    <stop offset="100%" stop-color="#7c2d12"/>\n  </radialGradient>\n  <radialGradient id="aBody" cx="50%" cy="30%" r="70%">\n    <stop offset="0%" stop-color="#3a0808"/>\n    <stop offset="100%" stop-color="#120202"/>\n  </radialGradient>\n  <filter id="aFire" x="-40%" y="-60%" width="180%" height="220%">\n    <feGaussianBlur stdDeviation="3.5" result="b"/>\n    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>\n  </filter>\n  <filter id="aHeat" x="-30%" y="-30%" width="160%" height="160%">\n    <feGaussianBlur stdDeviation="2" result="b"/>\n    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>\n  </filter>\n  <filter id="aSft">\n    <feGaussianBlur stdDeviation="1" result="b"/>\n    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>\n  </filter>\n</defs>\n<g clip-path="url(#cpa)">\n  <rect width="96" height="112" fill="url(#aBg)"/>\n  <!-- heat rings bg -->\n  <circle cx="48" cy="56" r="44" fill="none" stroke="rgba(220,38,38,0.06)" stroke-width="2.5"/>\n  <circle cx="48" cy="56" r="30" fill="none" stroke="rgba(249,115,22,0.09)" stroke-width="1.5"/>\n  <circle cx="48" cy="56" r="16" fill="none" stroke="rgba(251,191,36,0.12)" stroke-width="1"/>\n  <!-- bg diagonal slash -->\n  <line x1="0" y1="100" x2="96" y2="70" stroke="rgba(220,38,38,0.07)" stroke-width="12"/>\n  <!-- BODY -->\n  <path d="M-4 112 L18 64 Q48 76 78 64 L100 112Z" fill="url(#aBody)"/>\n  <!-- muscle shoulder armour L -->\n  <path d="M18 64 Q10 60 8 68 Q10 76 18 76 Q10 74 12 66 Q14 60 18 64Z" fill="#550a0a" stroke="rgba(220,38,38,0.5)" stroke-width="0.8"/>\n  <!-- muscle shoulder armour R -->\n  <path d="M78 64 Q86 60 88 68 Q86 76 78 76 Q86 74 84 66 Q82 60 78 64Z" fill="#550a0a" stroke="rgba(220,38,38,0.5)" stroke-width="0.8"/>\n  <!-- collar -->\n  <path d="M36 64 L48 78 L60 64" fill="none" stroke="rgba(220,38,38,0.6)" stroke-width="2" stroke-linejoin="round"/>\n  <!-- Wanchai emblem -->\n  <circle cx="48" cy="86" r="10" fill="rgba(220,38,38,0.15)" stroke="rgba(220,38,38,0.5)" stroke-width="1" filter="url(#aHeat)"/>\n  <text x="48" y="90" text-anchor="middle" fill="#fca5a5" font-size="9" font-family="Arial Black, Impact, sans-serif" font-weight="900">W</text>\n  <!-- RAISED FIST L (punching toward viewer) -->\n  <g filter="url(#aHeat)">\n    <rect x="4" y="38" width="20" height="17" rx="7" fill="#a05828"/>\n    <!-- knuckle detail -->\n    <line x1="6" y1="44" x2="23" y2="44" stroke="rgba(0,0,0,0.4)" stroke-width="1.2"/>\n    <line x1="6" y1="48" x2="23" y2="48" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>\n    <!-- heat crack -->\n    <path d="M8 40 L13 47 L11 54" fill="none" stroke="rgba(251,191,36,0.6)" stroke-width="1" stroke-linecap="round"/>\n    <!-- fist glow -->\n    <rect x="4" y="38" width="20" height="17" rx="7" fill="none" stroke="rgba(249,115,22,0.5)" stroke-width="0.8"/>\n  </g>\n  <!-- arm -->\n  <path d="M22 55 Q18 60 20 64" fill="none" stroke="#8a4020" stroke-width="9" stroke-linecap="round"/>\n  <!-- NECK -->\n  <path d="M39 61 Q48 68 57 61 L56 69 Q48 75 40 69Z" fill="#a05828"/>\n  <!-- ears -->\n  <ellipse cx="26" cy="50" rx="4" ry="5.5" fill="#a05828"/>\n  <path d="M27 47 Q24 50 27 53" fill="none" stroke="#7a3010" stroke-width="1"/>\n  <ellipse cx="70" cy="50" rx="4" ry="5.5" fill="#a05828"/>\n  <!-- HEAD -->\n  <path d="M27 52 Q26 35 48 27 Q70 35 69 52 Q69 64 59 69 Q48 73 37 69 Q27 64 27 52Z" fill="url(#aFace)"/>\n  <!-- ── HAIR — short buzzcut + spiky swept tuft on top ── -->\n  <!-- tight fade sides -->\n  <path d="M27 50 Q25 38 30 28 Q26 36 28 46Z" fill="#180404"/>\n  <path d="M69 50 Q71 38 66 28 Q70 36 68 46Z" fill="#180404"/>\n  <!-- buzzcut cap — short but present -->\n  <path d="M27 45 Q26 30 48 24 Q70 30 69 45 L67 40 Q65 27 48 26 Q31 27 29 40Z" fill="#1a0404"/>\n  <!-- spiky tuft swept forward-right -->\n  <path d="M46 26 Q44 18 40 14 Q46 16 48 22Z" fill="#220606"/>\n  <path d="M50 25 Q50 15 54 11 Q56 17 52 24Z" fill="#1a0404"/>\n  <path d="M54 26 Q56 17 60 14 Q60 20 56 26Z" fill="#220606"/>\n  <!-- tuft highlight -->\n  <path d="M48 20 Q52 17 56 19" fill="none" stroke="rgba(200,80,40,0.4)" stroke-width="1.2" stroke-linecap="round"/>\n  <!-- ── EYES — narrow & intense, fire iris ── -->\n  <!-- L eye — slight squint -->\n  <path d="M30 49 Q37 46 44 49 Q37 53 30 49Z" fill="white"/>\n  <circle cx="37" cy="49.5" r="3.8" fill="url(#aEye)"/>\n  <circle cx="37" cy="49.5" r="2" fill="#0a0000"/>\n  <circle cx="35.5" cy="48" r="1.4" fill="white" opacity="0.9"/>\n  <circle cx="39" cy="51" r="0.6" fill="white" opacity="0.4"/>\n  <!-- L upper lid heavy (squint) -->\n  <path d="M30 48 Q37 44.5 44 48" fill="none" stroke="#0a0000" stroke-width="2.5" stroke-linecap="round"/>\n  <!-- L lower lid line -->\n  <path d="M31 51 Q37 53.5 43 51" fill="none" stroke="#1a0a00" stroke-width="1" stroke-linecap="round" opacity="0.6"/>\n  <!-- R eye -->\n  <path d="M52 49 Q59 46 66 49 Q59 53 52 49Z" fill="white"/>\n  <circle cx="59" cy="49.5" r="3.8" fill="url(#aEye)"/>\n  <circle cx="59" cy="49.5" r="2" fill="#0a0000"/>\n  <circle cx="57.5" cy="48" r="1.4" fill="white" opacity="0.9"/>\n  <circle cx="61" cy="51" r="0.6" fill="white" opacity="0.4"/>\n  <path d="M52 48 Q59 44.5 66 48" fill="none" stroke="#0a0000" stroke-width="2.5" stroke-linecap="round"/>\n  <path d="M53 51 Q59 53.5 65 51" fill="none" stroke="#1a0a00" stroke-width="1" stroke-linecap="round" opacity="0.6"/>\n  <!-- EYEBROWS — thick, angry furrowed -->\n  <path d="M29 44.5 Q37 41 44 43.5" fill="none" stroke="#0f0202" stroke-width="3.5" stroke-linecap="round"/>\n  <path d="M52 43.5 Q59 41 67 44.5" fill="none" stroke="#0f0202" stroke-width="3.5" stroke-linecap="round"/>\n  <!-- inner brow tension crease -->\n  <path d="M43 43 Q48 41.5 53 43" fill="none" stroke="#0f0202" stroke-width="1.5" stroke-linecap="round"/>\n  <!-- NOSE -->\n  <path d="M46 56 L48 59 L50 56" fill="none" stroke="rgba(120,50,10,0.5)" stroke-width="1.2" stroke-linejoin="round"/>\n  <!-- MOUTH — set tight, determined -->\n  <path d="M41 64 L55 64" stroke="#7a3010" stroke-width="1.8" stroke-linecap="round" fill="none"/>\n  <!-- jaw tension lines -->\n  <path d="M38 60 Q37 63 38 66" fill="none" stroke="rgba(100,40,10,0.3)" stroke-width="0.8"/>\n  <path d="M58 60 Q59 63 58 66" fill="none" stroke="rgba(100,40,10,0.3)" stroke-width="0.8"/>\n  <!-- ── FIRE corner accent ── -->\n  <path d="M78 20 Q82 12 80 5 Q85 9 84 16 Q88 11 87 5 Q93 12 90 20 Q95 16 93 9 Q100 18 96 27 Q92 34 84 32 Q76 30 76 22 Q77 21 78 20Z" fill="rgba(220,38,38,0.55)" filter="url(#aFire)"/>\n  <path d="M80 22 Q83 15 81 9 Q85 13 84 19 Q87 15 87 10 Q91 16 88 23 Q86 28 82 27 Q78 26 79 23Z" fill="rgba(251,191,36,0.45)"/>\n  <!-- scar under L eye (battle damage) -->\n  <line x1="31" y1="53" x2="28" y2="57" stroke="rgba(200,80,30,0.5)" stroke-width="0.9" stroke-linecap="round"/>\n  <!-- bottom trim -->\n  <rect x="0" y="109" width="96" height="3" fill="rgba(220,38,38,0.25)"/>\n  <line x1="0" y1="109" x2="96" y2="109" stroke="rgba(220,38,38,0.55)" stroke-width="0.7"/>\n</g>\n'
};

// ════════════════════════════════════════════════════════════
// 🖥️ UI MANAGER
// ════════════════════════════════════════════════════════════
class UIManager {

    // ════════════════════════════════════════════════════════════
    // 💉 COOLDOWN VISUAL SYSTEM
    // Injects CSS once, then draws circular arc + countdown text
    // on any skill icon element via _setCooldownVisual().
    // ════════════════════════════════════════════════════════════

    /**
     * Inject the shared CSS rules for circular cooldown overlays.
     * Safe to call every frame — exits immediately after first run.
     */
    static injectCooldownStyles() {
        if (document.getElementById('mtc-cd-styles')) return;
        const s = document.createElement('style');
        s.id = 'mtc-cd-styles';
        s.textContent = `
            .skill-icon { position: relative !important; }
            .cooldown-mask { display: none !important; }
            .cd-arc-overlay {
                position: absolute; inset: 0;
                border-radius: 10px;
                pointer-events: none;
                z-index: 5;
                transition: background 0.05s linear;
            }
            .cd-timer-text {
                position: absolute; inset: 0;
                display: flex; align-items: center; justify-content: center;
                font: bold 11px 'Orbitron', monospace;
                color: #fff;
                text-shadow:
                    0 0 6px #000,
                    0  1px 4px rgba(0,0,0,0.95),
                    0 -1px 4px rgba(0,0,0,0.95),
                    1px 0   4px rgba(0,0,0,0.95),
                   -1px 0   4px rgba(0,0,0,0.95);
                pointer-events: none;
                z-index: 6;
                letter-spacing: -0.5px;
            }
            /* Text contrast: strong drop-shadow on all HUD bar labels */
            #player-level, .hud-label, .skill-name {
                text-shadow:
                    0 1px 3px rgba(0,0,0,0.95),
                    0 0 6px rgba(0,0,0,0.7) !important;
            }
        `;
        document.head.appendChild(s);
    }

    /**
     * _setCooldownVisual(iconId, cooldownCurrent, cooldownMax)
     *
     * Renders a circular clock-wipe overlay + numeric countdown on top
     * of any .skill-icon element. Call this every frame from updateUI().
     *
     * @param {string} iconId           — id of the skill icon element
     * @param {number} cooldownCurrent  — seconds remaining on cooldown
     * @param {number} cooldownMax      — full cooldown duration in seconds
     */
    static _setCooldownVisual(iconId, cooldownCurrent, cooldownMax) {
        const icon = document.getElementById(iconId);
        if (!icon) return;

        // ── Circular arc overlay (conic-gradient clock-wipe) ──────
        let arc = icon.querySelector('.cd-arc-overlay');
        if (!arc) {
            arc = document.createElement('div');
            arc.className = 'cd-arc-overlay';
            icon.appendChild(arc);
        }

        const elapsed = cooldownMax > 0
            ? Math.min(1, 1 - cooldownCurrent / cooldownMax)
            : 1;
        const pct = (elapsed * 100).toFixed(1);

        if (cooldownCurrent > 0.05) {
            // Transparent slice = elapsed (done); dark slice = remaining
            arc.style.background =
                `conic-gradient(transparent 0% ${pct}%, rgba(0,0,0,0.62) ${pct}% 100%)`;
        } else {
            arc.style.background = 'transparent';
        }

        // ── Countdown text ─────────────────────────────────────────
        let timer = icon.querySelector('.cd-timer-text');
        if (!timer) {
            timer = document.createElement('div');
            timer.className = 'cd-timer-text';
            icon.appendChild(timer);
        }

        // Hybrid: แสดง timer เฉพาะ cooldown ยาว (> 5s) เพื่อลด Visual Noise
        if (cooldownCurrent > 0.09 && cooldownMax > 5) {
            timer.textContent = cooldownCurrent.toFixed(1) + 's';
            timer.style.display = 'flex';
        } else {
            timer.style.display = 'none';
        }
    }

    // ── VoiceBubble — queue-based, military HUD chip ─────────────────────────
    // Queue prevents bubbles stomping each other when rapid-fired (e.g. stealth
    // + obstacle warning in the same frame).  Each entry holds: text, world x/y.
    static _vbQueue = [];
    static _vbTimer = null;
    static _vbHideTimer = null;

    static showVoiceBubble(text, x, y) {
        // Push to queue — drop oldest if queue is getting long (max 3 pending)
        if (UIManager._vbQueue.length >= 3) UIManager._vbQueue.shift();
        UIManager._vbQueue.push({ text, x, y });

        // If nothing is currently showing, fire immediately
        if (!UIManager._vbTimer) UIManager._flushVoiceBubble();
    }

    static _flushVoiceBubble() {
        if (UIManager._vbQueue.length === 0) { UIManager._vbTimer = null; return; }

        const { text, x, y } = UIManager._vbQueue.shift();
        const bubble = document.getElementById('voice-bubble');
        if (!bubble) { UIManager._vbTimer = null; return; }

        // Clear any pending hide
        if (UIManager._vbHideTimer) {
            clearTimeout(UIManager._vbHideTimer);
            UIManager._vbHideTimer = null;
        }

        // Position — offset above the entity
        const screen = worldToScreen(x, y - 40);
        bubble.style.left = (screen.x - bubble.offsetWidth / 2) + 'px';
        bubble.style.top = (screen.y - bubble.offsetHeight) + 'px';

        // Content
        bubble.textContent = text;

        // Reset animation: force reflow so transition fires fresh
        bubble.classList.remove('visible', 'hiding');
        void bubble.offsetWidth;
        bubble.classList.add('visible');

        // Hide after display time, then chain next in queue
        const displayMs = Math.max(1200, text.length * 55);
        UIManager._vbHideTimer = setTimeout(() => {
            bubble.classList.remove('visible');
            bubble.classList.add('hiding');
            UIManager._vbHideTimer = setTimeout(() => {
                bubble.classList.remove('hiding');
                UIManager._vbTimer = null;
                UIManager._flushVoiceBubble(); // chain next
            }, 200);
        }, displayMs);

        UIManager._vbTimer = true; // mark as active
    }


    static updateBossHUD(boss) {
        const hud = document.getElementById('boss-hud');
        const hpBar = document.getElementById('boss-hp-bar');
        if (!hud) return;
        if (boss && !boss.dead) {
            hud.classList.add('active');
            if (hpBar) {
                const pct = boss.hp / boss.maxHp;
                const widthPct = `${Math.max(0, pct * 100)}%`;

                // ── HP fill width ──────────────────────────────────────
                hpBar.style.width = widthPct;

                // ── Phase color class ──────────────────────────────────
                hpBar.classList.remove('phase-safe', 'phase-caution', 'phase-danger', 'phase-critical');
                if (pct > 0.60) hpBar.classList.add('phase-safe');
                else if (pct > 0.30) hpBar.classList.add('phase-caution');
                else if (pct > 0.15) hpBar.classList.add('phase-danger');
                else hpBar.classList.add('phase-critical');

                // ── Drain ghost bar ─────────────────────────────────────
                // Lazily create drain element inside .boss-hp-bg if missing
                const bg = hpBar.parentElement;
                if (bg) {
                    let drain = bg.querySelector('.boss-hp-drain');
                    if (!drain) {
                        drain = document.createElement('div');
                        drain.className = 'boss-hp-drain';
                        bg.insertBefore(drain, hpBar);   // drain behind fill
                        drain._lastPct = pct;
                        drain.style.width = widthPct;
                    }
                    // Only update drain when HP actually drops
                    if (pct < (drain._lastPct ?? pct)) {
                        // Hold at current _lastPct for 0.4s then slide down via CSS transition
                        const snapWidth = drain.style.width;   // keep current ghost width
                        drain.style.transition = 'none';
                        drain.style.width = snapWidth;
                        // Force reflow then let CSS transition carry it
                        drain.offsetWidth; // eslint-disable-line no-unused-expressions
                        drain.style.transition = '';
                        drain.style.width = widthPct;
                    }
                    drain._lastPct = pct;
                }
            }
        } else {
            hud.classList.remove('active');
        }
    }

    // ── BossSpeech — typewriter reveal, per-frame reposition ─────────────────
    static _bsTypeTimer = null;
    static _bsHideTimer = null;
    static _bsBossRef = null;  // set by updateBossSpeech so we know who's speaking

    static updateBossSpeech(boss) {
        // Called every frame — reposition if visible
        const speech = document.getElementById('boss-speech');
        if (!speech || !boss) return;
        UIManager._bsBossRef = boss;
        if (speech.classList.contains('visible')) {
            const screen = worldToScreen(boss.x, boss.y - 100);
            speech.style.left = (screen.x - speech.offsetWidth / 2) + 'px';
            speech.style.top = (screen.y - speech.offsetHeight) + 'px';
        }
    }

    static showBossSpeech(text) {
        const speech = document.getElementById('boss-speech');
        if (!speech) return;

        // Cancel any existing timers
        if (UIManager._bsTypeTimer) { clearTimeout(UIManager._bsTypeTimer); UIManager._bsTypeTimer = null; }
        if (UIManager._bsHideTimer) { clearTimeout(UIManager._bsHideTimer); UIManager._bsHideTimer = null; }

        // Build DOM: label + text content span
        speech.innerHTML =
            '<span class="speech-label">⚠ KRU MANOP</span>' +
            '<span class="speech-text"></span>';

        const textEl = speech.querySelector('.speech-text');

        // Position near boss if available
        if (UIManager._bsBossRef && !UIManager._bsBossRef.dead) {
            const screen = worldToScreen(UIManager._bsBossRef.x, UIManager._bsBossRef.y - 100);
            speech.style.left = (screen.x - 140) + 'px';
            speech.style.top = (screen.y - 60) + 'px';
        }

        // Show chip
        speech.classList.remove('visible', 'hiding');
        void speech.offsetWidth;
        speech.classList.add('visible');

        // Typewriter reveal — ~28 chars/sec
        let i = 0;
        const interval = Math.max(22, Math.min(55, 1100 / text.length));
        const type = () => {
            if (i <= text.length) {
                textEl.textContent = text.slice(0, i);
                i++;
                UIManager._bsTypeTimer = setTimeout(type, interval);
            } else {
                UIManager._bsTypeTimer = null;
                // Hold fully visible, then fade out
                const holdMs = Math.max(2000, text.length * 45);
                UIManager._bsHideTimer = setTimeout(() => {
                    speech.classList.remove('visible');
                    speech.classList.add('hiding');
                    UIManager._bsHideTimer = setTimeout(() => {
                        speech.classList.remove('hiding');
                        speech.textContent = '';
                    }, 280);
                }, holdMs);
            }
        };
        type();
    }


    static updateHighScoreDisplay(highScore) {
        const formatted = highScore > 0 ? Number(highScore).toLocaleString() : '— —';
        const valEl = document.getElementById('hs-value');
        if (valEl) valEl.textContent = formatted;
    }

    // ── initSkillNames — อ่านชื่อ static slots จาก GAME_TEXTS.skillNames ──
    // เรียกครั้งเดียวตอนหน้า load ก่อน startGame()
    // slot ที่เปลี่ยนตามตัวละคร (skill1-name ฯลฯ) จัดการใน setupCharacterHUD แทน
    static initSkillNames() {
        const SN = (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.skillNames) ? GAME_TEXTS.skillNames : {};
        const set = (id, text) => { const el = document.getElementById(id); if (el && text) el.textContent = text; };

        set('sn-attack', SN.attack);
        set('sn-dash', SN.dash);
        set('sn-naga', SN.poom?.naga);
        set('sn-ritual', SN.poom?.ritual);
        set('sn-passive', SN.kao?.passive);
        set('sn-database', SN.database);
        set('sn-terminal', SN.terminal);
        set('sn-shop', SN.shop);
    }

    static setupCharacterHUD(player) {
        const isPoom = player instanceof PoomPlayer;
        // Derive charId safely from both Player and PoomPlayer instances
        const charId = player.charId || (isPoom ? 'poom' : 'kao');
        const isKao = charId === 'kao';
        const isAuto = charId === 'auto' || (typeof AutoPlayer === 'function' && player instanceof AutoPlayer);

        const weaponIndicator = document.querySelector('.weapon-indicator');
        if (weaponIndicator) weaponIndicator.style.display = (isPoom || isAuto) ? 'none' : '';

        // ── Apply per-character color theme to shared HUD slots ───────────────
        // dash-icon + stealth-icon share between chars — recolor on every setupCharacterHUD call
        const _THEME_CLASSES = ['t-neutral', 't-blue', 't-emerald', 't-red', 't-gold'];
        const _applyTheme = (id, theme) => {
            const el = document.getElementById(id);
            if (!el) return;
            _THEME_CLASSES.forEach(c => el.classList.remove(c));
            el.classList.add(theme);
        };
        const charTheme = isAuto ? 't-red' : isPoom ? 't-emerald' : 't-blue';
        _applyTheme('dash-icon', charTheme);
        _applyTheme('stealth-icon', charTheme);  // also covers eat-icon / wanchai (same element, id swapped later)
        // Show divider-util when any shortcut icon becomes visible — handled per-use below

        const playerAvatar = document.getElementById('player-avatar');
        // Swap HUD portrait SVG
        const hudSvg = document.getElementById('hud-portrait-svg');
        if (hudSvg) {
            hudSvg.innerHTML = (window.PORTRAITS || {})[isPoom ? 'poom' : isAuto ? 'auto' : 'kao'] || '';
        }

        // ── [UI-FIX] Passive Icon — Kao-only ───────────────────
        // The #passive-skill slot (Ghost/Stealth crit passive) is
        // mechanically tied to Kao's stealth ability and should NEVER
        // be visible when Poom is selected. We gate it here at setup
        // time so that even if PoomPlayer.updateUI() runs every frame
        // it cannot accidentally reveal the element.
        //
        // Kao   → show (dimmed at 0.35 opacity until unlocked; entities.js
        //         updateUI() will promote it to opacity:1 + class 'unlocked'
        //         once the unlock condition is met)
        // Poom  → hide completely (display:none wins over any opacity)
        const passiveSkillEl = document.getElementById('passive-skill');
        if (passiveSkillEl) {
            if (isKao) {
                passiveSkillEl.style.display = '';
                if (player.passiveUnlocked) {
                    passiveSkillEl.style.opacity = '1';
                    passiveSkillEl.classList.add('unlocked');
                    const skillName = passiveSkillEl.querySelector('.skill-name');
                    if (skillName) { skillName.textContent = 'MAX'; skillName.style.color = '#facc15'; }
                } else {
                    passiveSkillEl.style.opacity = '0.35';
                    passiveSkillEl.classList.remove('unlocked');
                    const skillName = passiveSkillEl.querySelector('.skill-name');
                    // Condition ใหม่: ใช้ stealth ครั้งแรก = unlock ทันที
                    if (skillName) { skillName.textContent = 'R-Click!'; skillName.style.color = '#a855f7'; }
                }      // restore default layout display
            } else {
                // Any non-Kao character: suppress entirely
                passiveSkillEl.style.display = 'none';
                passiveSkillEl.classList.remove('unlocked');
            }
        }

        // ── Shorthand to config ────────────────────────────────────────────────
        const SN = (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.skillNames) ? GAME_TEXTS.skillNames : {};

        const skill1El = document.getElementById('eat-icon') || document.getElementById('stealth-icon');
        if (skill1El) {
            const nameEl = skill1El.querySelector('.skill-name') || (() => {
                const d = document.createElement('div'); d.className = 'skill-name'; skill1El.appendChild(d); return d;
            })();
            if (isPoom) {
                skill1El.id = 'eat-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '🍱';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'eat-cd';
                nameEl.textContent = 'EAT RICE';
                nameEl.style.color = '#6ee7b7';
            } else if (isAuto) {
                skill1El.id = 'stealth-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '💢';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'stealth-cd';
                nameEl.textContent = 'WANCHAI';
                nameEl.style.color = '#fca5a5';
            } else if (isKao) {
                skill1El.id = 'stealth-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '👻';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'stealth-cd';
                nameEl.textContent = SN.kao?.skill1 ?? 'STEALTH';
                nameEl.style.color = '#c4b5fd';
            } else {
                skill1El.id = 'stealth-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '📖';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'stealth-cd';
                nameEl.textContent = 'SKILL';
                nameEl.style.color = '#fbbf24';
            }
        }

        // ── Naga/Teleport slot — repurposed per character ─────────────────────
        // Poom: Naga 🐉 (Q).  Kao: Teleport ⚡ (Q).  Others: hidden.
        const nagaSlot = document.getElementById('naga-icon');
        if (nagaSlot) {
            if (isPoom) {
                nagaSlot.style.display = 'flex';
                nagaSlot.style.borderColor = '#10b981';
                nagaSlot.style.boxShadow = '0 0 15px rgba(16,185,129,0.4)';
                const nagaHint = nagaSlot.querySelector('.key-hint');
                if (nagaHint) { nagaHint.textContent = 'Q'; nagaHint.style.background = '#10b981'; }
                let nagaName = nagaSlot.querySelector('.skill-name');
                if (!nagaName) { nagaName = document.createElement('div'); nagaName.className = 'skill-name'; nagaSlot.appendChild(nagaName); }
                nagaName.textContent = SN.poom?.naga ?? 'NAGA';
                nagaName.style.color = '#6ee7b7';
            } else if (isKao) {
                nagaSlot.style.display = 'flex';
                nagaSlot.style.borderColor = '#00e5ff';
                nagaSlot.style.boxShadow = '0 0 15px rgba(0,229,255,0.45)';
                nagaSlot.innerHTML = `
                    <div class="key-hint" id="teleport-hint" style="background:#00e5ff;color:#0c1a2e;">Q</div>
                    <span id="teleport-emoji">⚡</span>
                    <div class="skill-name" style="color:#67e8f9;">${SN.kao?.teleport ?? 'TELEPORT'}</div>
                    <div class="cooldown-mask" id="teleport-cd"></div>`;
                nagaSlot.id = 'teleport-icon';
            } else if (isAuto) {
                nagaSlot.style.display = 'flex';
                nagaSlot.style.borderColor = '#f97316';
                nagaSlot.style.boxShadow = '0 0 15px rgba(249,115,22,0.45)';
                nagaSlot.innerHTML = `
                    <div class="key-hint" id="vacuum-hint" style="background:#f97316;color:#1a0505;">Q</div>
                    <span id="vacuum-emoji">🌀</span>
                    <div class="skill-name" style="color:#fdba74;">${SN.auto?.vacuum ?? 'VACUUM'}</div>
                    <div class="cooldown-mask" id="vacuum-cd"></div>`;
                nagaSlot.id = 'vacuum-icon';
            } else {
                nagaSlot.style.display = 'none';
            }
        }

        // ── Clone of Stealth slot (E) — Kao-exclusive, dynamically injected ──
        const hudBottom = document.querySelector('.hud-bottom');
        let cloneSlot = document.getElementById('kao-clone-icon');

        if (isKao) {
            if (!cloneSlot && hudBottom) {
                cloneSlot = document.createElement('div');
                cloneSlot.className = 'skill-icon';
                cloneSlot.id = 'kao-clone-icon';
                cloneSlot.style.cssText = 'border-color:#3b82f6; box-shadow:0 0 15px rgba(59,130,246,0.45);';
                cloneSlot.innerHTML = `
                    <div class="key-hint" style="background:#3b82f6;">E</div>
                    <span>👥</span>
                    <div class="skill-name" style="color:#93c5fd;">${SN.kao?.clones ?? 'CLONES'}</div>
                    <div class="cooldown-mask" id="clone-cd"></div>`;
                const passiveRef = document.getElementById('passive-skill');
                if (passiveRef && passiveRef.parentNode === hudBottom) {
                    hudBottom.insertBefore(cloneSlot, passiveRef.nextSibling);
                } else {
                    hudBottom.appendChild(cloneSlot);
                }
            }
            if (cloneSlot) cloneSlot.style.display = 'flex';
        } else {
            if (cloneSlot) cloneSlot.style.display = 'none';
            // Restore naga-icon id if it was repurposed for Kao
            const maybeTeleport = document.getElementById('teleport-icon');
            if (maybeTeleport) {
                maybeTeleport.id = 'naga-icon';
                maybeTeleport.style.borderColor = '#10b981';
                maybeTeleport.style.boxShadow = '0 0 15px rgba(16,185,129,0.4)';
                maybeTeleport.innerHTML = `
                    <div class="key-hint" style="background:#10b981;">Q</div>🐉
                    <div class="cooldown-mask" id="naga-cd"></div>
                    <span id="naga-timer"></span>
                    <div class="skill-name" style="color:#6ee7b7;">${SN.poom?.naga ?? 'NAGA'}</div>`;
            }
            // ⚠️ DO NOT restore vacuum-icon when isAuto — it was intentionally repurposed
            if (!isAuto) {
                const maybeVacuum = document.getElementById('vacuum-icon');
                if (maybeVacuum) {
                    maybeVacuum.id = 'naga-icon';
                    maybeVacuum.style.borderColor = '#10b981';
                    maybeVacuum.style.boxShadow = '0 0 15px rgba(16,185,129,0.4)';
                    maybeVacuum.innerHTML = `
                    <div class="key-hint" style="background:#10b981;">Q</div>🐉
                    <div class="cooldown-mask" id="naga-cd"></div>
                    <span id="naga-timer"></span>
                    <div class="skill-name" style="color:#6ee7b7;">${SN.poom?.naga ?? 'NAGA'}</div>`;
                }
            }
        }

        // ── Detonation slot (E) — Auto-exclusive, dynamically injected ──
        let detSlot = document.getElementById('auto-det-icon');
        if (isAuto) {
            if (!detSlot && hudBottom) {
                detSlot = document.createElement('div');
                detSlot.className = 'skill-icon';
                detSlot.id = 'auto-det-icon';
                detSlot.style.cssText = 'border-color:#dc2626; box-shadow:0 0 15px rgba(220,38,38,0.45); opacity:0.4; transition:opacity 0.2s;';
                detSlot.innerHTML = `
                    <div class="key-hint" style="background:#dc2626;">E</div>
                    <span>💥</span>
                    <div class="skill-name" style="color:#fca5a5;">${SN.auto?.detonate ?? 'DETONATE'}</div>
                    <div class="cooldown-mask" id="det-cd"></div>`;
                hudBottom.appendChild(detSlot);
            }
            if (detSlot) detSlot.style.display = 'flex';
        } else {
            if (detSlot) detSlot.style.display = 'none';
        }

        // ── Garuda slot (E) — Poom-exclusive, dynamically injected ──
        let garudaSlot = document.getElementById('garuda-icon');
        if (isPoom) {
            if (!garudaSlot && hudBottom) {
                garudaSlot = document.createElement('div');
                garudaSlot.className = 'skill-icon';
                garudaSlot.id = 'garuda-icon';
                garudaSlot.style.cssText = 'border-color:#f97316; box-shadow:0 0 15px rgba(249,115,22,0.45);';
                garudaSlot.innerHTML = `
                    <div class="key-hint" style="background:#f97316;color:#1a0505;">E</div>
                    <span>🦅</span>
                    <div class="skill-name" style="color:#fdba74;font-size:9px;letter-spacing:0.02em;">${(GAME_TEXTS.skillNames?.poom?.garuda) || 'GARUDA'}</div>
                    <div class="cooldown-mask" id="garuda-cd"></div>`;
                const passiveRef = document.getElementById('passive-skill');
                if (passiveRef && passiveRef.parentNode === hudBottom) {
                    hudBottom.insertBefore(garudaSlot, passiveRef.nextSibling);
                } else {
                    hudBottom.appendChild(garudaSlot);
                }
            }
            if (garudaSlot) garudaSlot.style.display = 'flex';
        } else {
            if (garudaSlot) garudaSlot.style.display = 'none';
        }

        const btnNaga = document.getElementById('btn-naga');
        if (btnNaga) btnNaga.style.display = (isPoom || isKao) ? 'flex' : 'none';
        const btnSkill = document.getElementById('btn-skill');
        if (btnSkill) btnSkill.textContent = isPoom ? '🍚' : (isAuto ? '🔥' : isKao ? '👻' : '📖');

        // ── Phase 3 Session 3: Ritual Burst slot — Poom-exclusive ────────
        const ritualSlot = document.getElementById('ritual-icon');
        if (ritualSlot) {
            ritualSlot.style.display = isPoom ? 'flex' : 'none';
            if (isPoom) {
                let ritualName = ritualSlot.querySelector('.skill-name');
                if (!ritualName) { ritualName = document.createElement('div'); ritualName.className = 'skill-name'; ritualSlot.appendChild(ritualName); }
                ritualName.textContent = SN.poom?.ritual ?? 'RITUAL';
                ritualName.style.color = '#86efac';
            }
        }
    }

    static updateSkillIcons(player) {
        // ── Helper: แสดง/ซ่อน lock overlay บน skill icon (shared across all characters) ──
        const setLockOverlay = (icon, locked) => {
            if (!icon) return;
            let lock = icon.querySelector('.skill-lock');
            if (locked) {
                if (!lock) {
                    lock = document.createElement('div');
                    lock.className = 'skill-lock';
                    lock.style.cssText =
                        'position:absolute;inset:0;display:flex;align-items:center;' +
                        'justify-content:center;font-size:20px;background:rgba(0,0,0,0.65);' +
                        'border-radius:8px;z-index:10;pointer-events:none;';
                    lock.textContent = '\uD83D\uDD12';
                    icon.appendChild(lock);
                }
            } else if (lock) {
                lock.remove();
            }
        };

        if (player instanceof PoomPlayer) {
            const S = BALANCE.characters.poom;
            const passive = player.passiveUnlocked;

            // ── Lock overlays ──────────────────────────────────────────────────
            // eat-icon (R-Click) ใช้ได้ตั้งแต่ต้นเกม — ไม่ล็อค
            // ── Lock overlays ──────────────────────────────────────────────────
            // eat-icon  (R-Click) : ใช้ได้ตั้งแต่ต้น — ไม่ล็อค
            // naga-icon (Q)       : ปลดที่ Lv2 → _nagaUnlocked
            // ritual-icon (R)     : ปลดพร้อม Naga → _nagaUnlocked
            // garuda-icon (E)     : ปลดหลัง passive (Ritual ครั้งแรก)
            const nagaReady = !!(player._nagaUnlocked);
            setLockOverlay(document.getElementById('eat-icon'), false);
            setLockOverlay(document.getElementById('naga-icon'), !nagaReady);
            setLockOverlay(document.getElementById('ritual-icon'), !nagaReady);
            setLockOverlay(document.getElementById('garuda-icon'), !passive);

            // ── Eat Rice ─────────────────────────────────────────────
            const eatIcon = document.getElementById('eat-icon');
            const eatCd = document.getElementById('eat-cd');
            if (eatCd) {
                if (player.isEatingRice) eatIcon?.classList.add('active');
                else eatIcon?.classList.remove('active');
            }
            UIManager._setCooldownVisual('eat-icon',
                player.isEatingRice ? 0 : Math.max(0, player.cooldowns.eat),
                S.eatRiceCooldown);

            // ── Naga ──────────────────────────────────────────────────
            const nagaIcon = document.getElementById('naga-icon');
            const nagaCd = document.getElementById('naga-cd');
            const nagaTimer = document.getElementById('naga-timer');
            if (nagaCd) {
                nagaIcon?.classList.toggle('active', player.cooldowns.naga <= 0);
            }
            // nagaTimer ซ่อนถาวร — Arc จาก _setCooldownVisual จัดการตัวเลขแทน
            if (nagaTimer) nagaTimer.style.display = 'none';
            UIManager._setCooldownVisual('naga-icon',
                Math.max(0, player.cooldowns.naga),
                S.nagaCooldown);

            // ── Phase 3 Session 3: Ritual Burst cooldown UI ───────────
            const ritualIcon = document.getElementById('ritual-icon');
            const ritualCd = document.getElementById('ritual-cd');
            const ritualTimer = document.getElementById('ritual-timer');
            const maxRitualCd = GAME_CONFIG?.abilities?.ritual?.cooldown || 20;
            if (ritualCd) {
                ritualIcon?.classList.toggle('active', player.cooldowns.ritual <= 0);
            }
            // ritualTimer ซ่อนถาวร — Arc จาก _setCooldownVisual จัดการตัวเลขแทน
            if (ritualTimer) ritualTimer.style.display = 'none';
            UIManager._setCooldownVisual('ritual-icon',
                Math.max(0, player.cooldowns.ritual),
                maxRitualCd);

            // ── Garuda cooldown ────────────────────────────────────
            const garudaIcon = document.getElementById('garuda-icon');
            if (garudaIcon) {
                garudaIcon.classList.toggle('active', player.cooldowns.garuda <= 0);
            }
            UIManager._setCooldownVisual('garuda-icon',
                Math.max(0, player.cooldowns.garuda),
                BALANCE.characters.poom.garudaCooldown ?? 24);

            // WARN-10 FIX: AutoPlayer's Wanchai Stand cooldown had no arc overlay
            // or countdown. Add a parallel branch so the player sees feedback.
        } else if (typeof AutoPlayer !== 'undefined' && player instanceof AutoPlayer) {
            const S = BALANCE.characters.auto;
            const passive = player.passiveUnlocked;

            // ── Lock overlays ──────────────────────────────────────────────────
            // stealth-icon (R-Click Wanchai) ใช้ได้ตั้งแต่ต้นเกม — ไม่ล็อค
            setLockOverlay(document.getElementById('stealth-icon'), false);
            setLockOverlay(document.getElementById('vacuum-icon'), !passive);
            setLockOverlay(document.getElementById('auto-det-icon'), !passive);
            const wanchaiCd = S.wanchaiCooldown ?? 12;
            UIManager._setCooldownVisual(
                'stealth-icon',
                player.wanchaiActive ? 0 : Math.max(0, player.cooldowns.wanchai ?? 0),
                wanchaiCd
            );

            // ── Wanchai Stand timer — แทนที่ชื่อสกิลด้วยตัวนับเวลาขณะ active ──
            const stealthIcon = document.getElementById('stealth-icon');
            if (stealthIcon) {
                const nameEl = stealthIcon.querySelector('.skill-name');
                if (nameEl) {
                    if (player.wanchaiActive && player.wanchaiTimer > 0) {
                        // แสดงเวลาที่เหลือของ Stand แทนชื่อสกิล
                        nameEl.textContent = player.wanchaiTimer.toFixed(1) + 's';
                        nameEl.style.color = '#fca5a5';
                    } else {
                        // คืนชื่อสกิลตาม config
                        const SN = (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.skillNames) ? GAME_TEXTS.skillNames : {};
                        nameEl.textContent = 'WANCHAI';
                        nameEl.style.color = '#fca5a5';
                    }
                }
            }

            // ── Vacuum Heat (Q) cooldown arc ────────────────────────────────────
            // BUG-FIX: max CD is dynamic — standPull (10s, Wanchai active) vs vacuum (6s)
            const _vacMaxCd = player.wanchaiActive
                ? (S.standPullCooldown ?? 10)
                : (S.vacuumCooldown ?? 6);
            UIManager._setCooldownVisual(
                'vacuum-icon',
                Math.max(0, player.cooldowns.vacuum ?? 0),
                _vacMaxCd
            );

            // ── Overheat Detonation (E) — lock visual + cooldown arc ────────────
            // ไอเดีย Gemini: ปุ่ม E "โดนล็อค" เมื่อ Wanchai ไม่ active
            // Implementation: opacity + pointer-events ผ่าน dataset flag (ไม่ต้อง add DOM element)
            const detIcon = document.getElementById('auto-det-icon');
            if (detIcon) {
                if (player.wanchaiActive) {
                    detIcon.style.opacity = '1';
                    detIcon.style.boxShadow = '0 0 20px rgba(220,38,38,0.80)';
                    detIcon.classList.add('active');
                } else {
                    detIcon.style.opacity = '0.35';
                    detIcon.style.boxShadow = '0 0 8px rgba(220,38,38,0.25)';
                    detIcon.classList.remove('active');
                }
            }
            UIManager._setCooldownVisual(
                'auto-det-icon',
                Math.max(0, player.cooldowns.detonation ?? 0),
                S.detonationCooldown ?? 8
            );

            // ── Kao — Teleport (Q) + Clone of Stealth (E) ─────────────────────────
        } else if (player.charId === 'kao') {
            const S = BALANCE.characters.kao;
            const passive = player.passiveUnlocked;

            // ── Skill 1 (R-Click) — Stealth: handled by PlayerBase.updateUI() ──

            // ── Skill 2 (Q) — Teleport ────────────────────────────────────────
            const teleportIcon = document.getElementById('teleport-icon');
            const teleportCd = document.getElementById('teleport-cd');
            setLockOverlay(teleportIcon, !passive);

            if (teleportIcon && passive) {
                const charges = player.teleportCharges || 0;
                const maxCharges = player.maxTeleportCharges || 3;
                const isReady = charges > 0;
                const isFull = charges >= maxCharges;
                teleportIcon.classList.toggle('active', isReady);

                // Mask ถูก hide แล้ว — ไม่ต้องอัปเดต height

                // Arc: แสดง timer ที่ใกล้ครบสุดเสมอ (ถ้ามี timer กำลังวิ่ง)
                if (!isFull && player.teleportTimers && player.teleportTimers.length > 0) {
                    const best = player.teleportTimers.reduce(
                        (b, t) => t.elapsed > b.elapsed ? t : b,
                        player.teleportTimers[0]
                    );
                    const remaining = Math.max(0, best.max - best.elapsed);
                    if (charges > 0) {
                        // มี charge เหลือ: โชว์แค่ Arc เบาๆ ไม่แสดงตัวเลข
                        const icon = document.getElementById('teleport-icon');
                        if (icon) {
                            let arc = icon.querySelector('.cd-arc-overlay');
                            if (!arc) { arc = document.createElement('div'); arc.className = 'cd-arc-overlay'; icon.appendChild(arc); }
                            const elapsed = best.max > 0 ? Math.min(1, 1 - remaining / best.max) : 1;
                            const p = (elapsed * 100).toFixed(1);
                            arc.style.background = remaining > 0.05
                                ? `conic-gradient(transparent 0% ${p}%, rgba(0,0,0,0.62) ${p}% 100%)`
                                : 'transparent';
                            let tmr = icon.querySelector('.cd-timer-text');
                            if (!tmr) { tmr = document.createElement('div'); tmr.className = 'cd-timer-text'; icon.appendChild(tmr); }
                            tmr.style.display = 'none'; // บังคับซ่อน
                        }
                    } else {
                        // หมด charge: แสดง Arc + ตัวเลข (Hybrid จัดการ เพราะ max=15 > 5)
                        UIManager._setCooldownVisual('teleport-icon', remaining, best.max);
                    }
                } else {
                    UIManager._setCooldownVisual('teleport-icon', 0, 1);
                }

                // Badge จำนวน charge
                let chargeLabel = teleportIcon.querySelector('.charge-label');
                if (!chargeLabel) {
                    chargeLabel = document.createElement('span');
                    chargeLabel.className = 'charge-label';
                    chargeLabel.style.cssText =
                        'position:absolute;bottom:2px;right:4px;font-size:10px;' +
                        'font-weight:bold;color:#00e5ff;text-shadow:0 0 4px #000;pointer-events:none;';
                    teleportIcon.appendChild(chargeLabel);
                }
                chargeLabel.textContent = charges > 0 ? `${charges}` : '';
            } else if (teleportIcon && !passive) {
                UIManager._setCooldownVisual('teleport-icon', 0, 1);
                const cl = teleportIcon.querySelector('.charge-label');
                if (cl) cl.textContent = '';
            }

            // ── Skill 3 (E) — Clone of Stealth ────────────────────────────────
            const cloneIcon = document.getElementById('kao-clone-icon');
            const cloneCd = document.getElementById('clone-cd');
            setLockOverlay(cloneIcon, !passive);

            if (cloneIcon) {
                const cloneReady = player.cloneSkillCooldown <= 0;
                cloneIcon.classList.toggle('active', passive && cloneReady);

                if (player.clonesActiveTimer > 0) {
                    cloneIcon.style.borderColor = '#00e5ff';
                    cloneIcon.style.boxShadow = '0 0 20px rgba(0,229,255,0.7)';
                } else {
                    cloneIcon.style.borderColor = (passive && cloneReady) ? '#60a5fa' : '#3b82f6';
                    cloneIcon.style.boxShadow = (passive && cloneReady)
                        ? '0 0 18px rgba(96,165,250,0.65)'
                        : '0 0 15px rgba(59,130,246,0.45)';
                }

                if (cloneCd) {
                    // vertical mask ถูก hide แล้ว — ไม่ต้องอัปเดต height
                }
                UIManager._setCooldownVisual(
                    'kao-clone-icon',
                    passive ? Math.max(0, player.cloneSkillCooldown) : 0,
                    player.maxCloneCooldown
                );
            }
        }
    }

    static showGameOver(score, wave, kills) {
        const titleEl = document.querySelector('.title');
        if (titleEl) {
            titleEl.textContent = 'MTC the Game';
        }
        const reportScoreEl = document.getElementById('report-score');
        if (reportScoreEl) reportScoreEl.textContent = score.toLocaleString();
        const reportWaveEl = document.getElementById('report-wave');
        if (reportWaveEl) reportWaveEl.textContent = wave;
        const reportKillsEl = document.getElementById('report-kills');
        if (reportKillsEl) reportKillsEl.textContent = (kills || 0).toLocaleString();
        const rc = document.getElementById('report-card');
        if (rc) rc.style.display = 'block';

        // Show character selection so player can switch characters
        const charSection = document.querySelector('.char-select-section');
        if (charSection) charSection.style.display = 'block';

        // Update mission brief
        const missionBrief = document.getElementById('mission-brief');
        if (missionBrief) missionBrief.textContent = 'เลือกตัวละครใหม่หรือลองอีกครั้ง';
    }

    static resetGameOverUI() {
        const els = {
            'report-score': '0',
            'report-wave': '0',
            'report-text': 'Loading...'
        };
        for (const [id, val] of Object.entries(els)) setElementText(id, val);
    }

    // -- Canvas HUD (Combo / Confused / Minimap) ----------
    // Moved to CanvasHUD class (defined below).
    // UIManager.draw() is a compat shim -- see deprecation notice.
}
// ============================================================
// CanvasHUD -- Canvas 2D rendering layer
//
// Owns every ctx.* draw call previously in UIManager.
// Godot equivalent: CanvasLayer (Layer 10) > Control children.
//
// Entry:  CanvasHUD.draw(ctx, dt) -- called each frame from game.js
// Compat: UIManager.draw(ctx, dt) -- deprecated shim, delegates here
// ============================================================
class CanvasHUD {

    // -- Frame entry point -----------------------------------
    static draw(ctx, dt) {
        UIManager.injectCooldownStyles(); // no-op after first call
        CanvasHUD.updateCombo(dt);
        CanvasHUD.drawCombo(ctx);
        if (!ctx || !ctx.canvas) return;
        CanvasHUD.drawConfusedWarning(ctx); // before minimap
        CanvasHUD.drawMinimap(ctx);         // always on top
    }

    // ── Combo UI ──────────────────────────────────────────────
    static updateCombo(dt) {
        // WARN-12 FIX: removed partial typeof guard on comboTimer only.
        // comboTimer/comboCount/comboScale/comboShake are all module-scope
        // lets declared below — they're initialised long before this runs.
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                comboTimer = 0; comboCount = 0;
                comboScale = 1; comboShake = 0;
            }
        }
        comboScale += (1 - comboScale) * Math.min(1, dt * comboScaleDecay);
        comboShake = Math.max(0, comboShake - dt * comboShakeDecay);
    }

    static drawCombo(ctx) {
        if (!ctx || comboCount <= 0) return;
        const canvas = ctx.canvas;
        const x = canvas.width / 2;
        const y = Math.max(60, canvas.height * 0.14);
        const baseFont = 72;
        const size = Math.round(baseFont * comboScale + Math.min(40, comboCount * 1.2));

        ctx.save();
        ctx.font = `bold ${size}px "Orbitron", sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        const gWidth = Math.max(240, size * 4);
        const grad = ctx.createLinearGradient(x - gWidth / 2, y - 30, x + gWidth / 2, y + 30);
        const t = Math.min(comboCount / 30, 1);
        // lerpColorHex is now in utils.js — no redefinition needed here
        grad.addColorStop(0, lerpColorHex('#FFD54A', '#FF3B3B', t));
        grad.addColorStop(1, lerpColorHex('#FFE08A', '#FF6B6B', Math.min(1, t + 0.18)));
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 22;

        const maxShake = Math.min(12, comboCount * 0.6);
        const shakeAmp = maxShake * comboShake;
        const shakeX = (Math.random() - 0.5) * shakeAmp;
        const shakeY = (Math.random() - 0.5) * shakeAmp;
        ctx.translate(x + shakeX, y + shakeY);

        const mainText = `${comboCount} ${GAME_TEXTS.ui.hits}`;
        ctx.fillText(mainText, 0, -size * 0.14);
        ctx.lineWidth = Math.max(4, size * 0.07);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.strokeText(mainText, 0, -size * 0.14);

        let special = '';
        if (comboCount > 20) special = GAME_TEXTS.ui.godlike;
        else if (comboCount > 10) special = GAME_TEXTS.ui.unstoppable;
        if (special) {
            const smallSize = Math.max(18, Math.round(size * 0.44));
            ctx.font = `bold ${smallSize}px "Orbitron", sans-serif`;
            ctx.fillText(special, 0, Math.round(size * 0.62));
            ctx.lineWidth = Math.max(3, smallSize * 0.08);
            ctx.strokeText(special, 0, Math.round(size * 0.62));
        }
        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════
    // 😵 CONFUSED STATE WARNING BANNER
    //
    // Drawn every frame when window.player.isConfused is true.
    // Flashes at ~4 Hz to grab attention; fades cleanly when the
    // confusion debuff expires (isConfused becomes false).
    //
    // Vertical position: H - 270 px (above the Bullet Time energy
    // badge at H - 140 and the skill-icon row beneath it).
    // ════════════════════════════════════════════════════════════

    /**
     * drawConfusedWarning(ctx)
     *
     * Renders a flashing purple pill banner:
     *   "⚠️ CONFUSED : INVERT YOUR MOVEMENT! ⚠️"
     *
     * Only visible while window.player.isConfused === true.
     * Uses ctx.save/restore so no canvas state leaks outward.
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    static drawConfusedWarning(ctx) {
        if (!ctx || !ctx.canvas) return;
        if (!window.player || !window.player.isConfused) return;

        const canvas = ctx.canvas;
        const now = performance.now();

        // ── Flash gate: visible for ~125 ms, hidden for ~125 ms (~4 Hz) ──
        // Math.sin returns values in [−1, 1]; we gate on > 0 for a 50 % duty cycle.
        const flashVisible = Math.sin(now / 125) > 0;
        if (!flashVisible) return;

        // ── Layout ────────────────────────────────────────────────
        // Centred horizontally; sits at H − 270 px so it clears the
        // Bullet Time badge (H − 140) and the skill-slot row below it.
        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H - 270;
        const text = GAME_TEXTS.ui.confusedWarning;
        const fontSize = 17;
        const padX = 22;
        const padY = 11;
        const radius = 10;

        ctx.save();

        // ── Measure text to size the pill precisely ───────────────
        ctx.font = `bold ${fontSize}px "Orbitron", Arial, sans-serif`;
        const textW = ctx.measureText(text).width;
        const pillW = textW + padX * 2;
        const pillH = fontSize + padY * 2;
        const pillX = cx - pillW / 2;
        const pillY = cy - pillH / 2;

        // ── Outer glow halo (drawn before clip/fill for correct layering) ──
        ctx.shadowBlur = 28;
        ctx.shadowColor = '#d946ef';

        // ── Pill background ───────────────────────────────────────
        // Deep purple, semi-transparent so world content shows through
        // at the edges and the banner doesn't feel too opaque.
        ctx.fillStyle = 'rgba(88, 28, 135, 0.88)';
        CanvasHUD._roundRect(ctx, pillX, pillY, pillW, pillH, radius);
        ctx.fill();

        // ── Pill border ───────────────────────────────────────────
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#e879f9';
        ctx.strokeStyle = 'rgba(233, 121, 249, 0.90)';
        ctx.lineWidth = 2;
        CanvasHUD._roundRect(ctx, pillX, pillY, pillW, pillH, radius);
        ctx.stroke();

        // ── Warning text ──────────────────────────────────────────
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, cx, cy);

        ctx.restore();
    }


    // ════════════════════════════════════════════════════════════
    // 🎯 TACTICAL MINIMAP / RADAR  (drawn last — always on top)
    //
    // CLIP ARCHITECTURE (two nested save/restore pairs):
    //
    //   ctx.save()  ← OUTER: resets composite/alpha; draws the shell ring
    //     ctx.save()  ← INNER: establishes the circular clip region
    //       ctx.clip()
    //       // ... interior content (grid, sweep, blips, player) ...
    //     ctx.restore()  ← INNER restore: releases clip — CRITICAL
    //     // ... label & legend drawn outside the clip ...
    //   ctx.restore()  ← OUTER restore: final cleanup
    //
    // The outer save() MUST explicitly override globalCompositeOperation and
    // globalAlpha because ctx.save() captures whatever state the canvas is
    // currently in — if mapSystem.drawLighting() leaked a blend mode, that
    // leak would be captured and every minimap draw call would be invisible.
    // ════════════════════════════════════════════════════════════
    static drawMinimap(ctx) {
        if (!ctx || !ctx.canvas) return;

        const canvas = ctx.canvas;

        // Config: radius 60 px · safe-zone top-right · world scale 0.1
        const radarRadius = 60;
        const scale = 0.1;
        // Safe-Zone: keeps radar clear of device notches / browser chrome.
        const cx = canvas.width - 200;   // 200 px from right edge
        const cy = 90;                    // 90 px from top edge
        const now = Date.now();

        const player = (typeof window !== 'undefined' && window.player)
            ? window.player : { x: 0, y: 0 };

        // ── 🔴 DIAGNOSTIC — silenced in production; uncomment to debug ──────
        if (!UIManager._minimapFrame) UIManager._minimapFrame = 0;
        UIManager._minimapFrame++;
        // Uncomment below for periodic canvas-state diagnostics:
        // if (UIManager._minimapFrame % 600 === 1) {
        //     console.log('[MTC Minimap] frame', UIManager._minimapFrame, ...);
        // }

        // Helper: world→radar-screen, clamped to maxR from radar center
        const toRadar = (wx, wy, maxR = radarRadius - 6) => {
            const rx = cx + (wx - player.x) * scale;
            const ry = cy + (wy - player.y) * scale;
            const dx = rx - cx, dy = ry - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= maxR) return { x: rx, y: ry, clamped: false };
            return { x: cx + dx * (maxR / d), y: cy + dy * (maxR / d), clamped: true };
        };

        // ══════════════════════════════════════════════════════
        // OUTER SAVE — resets to a known-good canvas state.
        // This is the key fix: explicitly override any blend-mode
        // leakage left by mapSystem.drawLighting() so that every
        // minimap draw call is guaranteed to be visible.
        // ══════════════════════════════════════════════════════
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';  // ← FIX: undo any lighting blend
        ctx.globalAlpha = 1;               // ← FIX: undo any alpha leakage
        ctx.shadowBlur = 0;               // ← FIX: clear any glow leakage

        // ── 1. Outer shell (drawn BEFORE clip so they sit outside it) ──

        // Subtle outer glow halo
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(57,255,20,0.07)'; ctx.fill();

        // Main deep-navy fill — high-contrast background
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'; ctx.fill();

        // Pulsating neon-green border — width oscillates 1 px → 3 px
        const borderSin = Math.sin(now / 500);   // −1 … +1
        const borderWidth = 2 + borderSin;          // 1 … 3 px
        ctx.lineWidth = borderWidth;
        ctx.strokeStyle = `rgba(57,255,20,${0.80 + borderSin * 0.15})`;
        ctx.shadowBlur = 12 + borderSin * 6;
        ctx.shadowColor = '#39ff14';
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner accent ring
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(134,239,172,0.28)';
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius - 3, 0, Math.PI * 2); ctx.stroke();

        // ══════════════════════════════════════════════════════
        // INNER SAVE — establishes the circular clip region.
        // ctx.restore() on this save RELEASES the clip, allowing
        // the label and legend to render outside the circle.
        // ══════════════════════════════════════════════════════
        ctx.save();

        // ── CLIP — nothing escapes the radar circle from here ──
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius - 1, 0, Math.PI * 2); ctx.clip();

        if (window.isFogWave) {
            // ── RADAR BLACKOUT — active during Fog Waves ─────────
            // Fill the radar face with an opaque dark background
            ctx.fillStyle = 'rgba(6, 30, 50, 0.95)';
            ctx.fillRect(cx - radarRadius, cy - radarRadius, radarRadius * 2, radarRadius * 2);

            // Random horizontal noise lines across the circle
            const noiseCount = 6;
            const noiseNow = Date.now();
            for (let n = 0; n < noiseCount; n++) {
                // Pseudo-random but stable per-frame band using time bucketed to 80 ms
                const seed = Math.floor(noiseNow / 80) + n * 7919;
                const nyOff = ((seed * 1664525 + 1013904223) & 0x7fffffff) % (radarRadius * 2);
                const ny = cy - radarRadius + nyOff;
                const nalpha = 0.12 + (((seed * 6364136) & 0xff) / 255) * 0.25;
                const nw = 0.6 + (((seed * 22695477) & 0xff) / 255) * 1.4;
                ctx.save();
                ctx.globalAlpha = nalpha;
                ctx.strokeStyle = '#06b6d4';
                ctx.lineWidth = nw;
                ctx.beginPath();
                ctx.moveTo(cx - radarRadius, ny);
                ctx.lineTo(cx + radarRadius, ny);
                ctx.stroke();
                ctx.restore();
            }

            // "SIGNAL LOST" text — centered in the radar circle
            const slPulse = 0.65 + Math.sin(noiseNow / 350) * 0.35;
            ctx.save();
            ctx.globalAlpha = slPulse;
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#06b6d4';
            ctx.fillStyle = '#06b6d4';
            ctx.font = 'bold 10px "Orbitron", Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SIGNAL', cx, cy - 7);
            ctx.fillText('LOST', cx, cy + 7);
            ctx.restore();
        } else {
            // ── 2. Interior grid ──────────────────────────────────
            ctx.lineWidth = 0.7;

            // Concentric range rings
            [radarRadius * 0.33, radarRadius * 0.66].forEach(r => {
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(57,255,20,0.14)'; ctx.stroke();
            });

            // Tactical crosshair axes
            ctx.strokeStyle = 'rgba(57,255,20,0.20)';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(cx - radarRadius + 2, cy); ctx.lineTo(cx + radarRadius - 2, cy);
            ctx.moveTo(cx, cy - radarRadius + 2); ctx.lineTo(cx, cy + radarRadius - 2);
            ctx.stroke();

            // ── 3. Sweep line animation ───────────────────────────
            const SWEEP_RPM = 1 / 3;   // one full revolution every 3 seconds
            const sweepAngle = ((now / 1000) * SWEEP_RPM * Math.PI * 2) % (Math.PI * 2);

            // Trail: 120° fading arc behind the sweep head
            const trailArc = Math.PI * 2 / 3;
            const TRAIL_STEPS = 24;
            for (let i = 0; i < TRAIL_STEPS; i++) {
                const frac = i / TRAIL_STEPS;
                const aStart = sweepAngle - trailArc * (1 - frac);
                const aEnd = sweepAngle - trailArc * (1 - frac - 1 / TRAIL_STEPS);
                const alpha = frac * frac * 0.22;   // quadratic fade toward head
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.arc(cx, cy, radarRadius - 1, aStart, aEnd);
                ctx.closePath();
                ctx.fillStyle = `rgba(72,187,120,${alpha.toFixed(3)})`;
                ctx.fill();
            }

            // Sweep head line
            ctx.save();
            ctx.strokeStyle = 'rgba(134,239,172,0.85)';
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 6; ctx.shadowColor = '#48bb78';
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(
                cx + Math.cos(sweepAngle) * (radarRadius - 1),
                cy + Math.sin(sweepAngle) * (radarRadius - 1)
            );
            ctx.stroke();
            ctx.restore();

            // ── 4. MTC Database Server — bright blue square (5 px) ──
            if (window.MTC_DATABASE_SERVER) {
                const S = window.MTC_DATABASE_SERVER;
                const { x: sx, y: sy, clamped: sc } = toRadar(S.x, S.y, radarRadius - 8);
                const dbPulse = 0.65 + Math.sin(now / 550) * 0.35;
                const SZ = sc ? 3.5 : 5;

                ctx.save();
                ctx.translate(sx, sy);
                ctx.shadowBlur = 10 * dbPulse;
                ctx.shadowColor = '#60a5fa';

                if (sc) {
                    const ax = cx - sx, ay = cy - sy;
                    ctx.rotate(Math.atan2(ay, ax));
                    ctx.fillStyle = `rgba(59,130,246,${0.8 + dbPulse * 0.2})`;
                    ctx.beginPath();
                    ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillStyle = `rgba(59,130,246,${0.85 + dbPulse * 0.15})`;
                    ctx.strokeStyle = `rgba(147,197,253,${dbPulse * 0.95})`;
                    ctx.lineWidth = 1.2;
                    ctx.fillRect(-SZ, -SZ, SZ * 2, SZ * 2);
                    ctx.strokeRect(-SZ, -SZ, SZ * 2, SZ * 2);
                }
                ctx.restore();
            }

            // ── 5. MTC Shop — gold square ─────────────────────────
            if (window.MTC_SHOP_LOCATION) {
                const SH = window.MTC_SHOP_LOCATION;
                const { x: shx, y: shy, clamped: shc } = toRadar(SH.x, SH.y, radarRadius - 8);
                const shPulse = 0.65 + Math.sin(now / 700 + 1.2) * 0.35;
                const SZ = shc ? 3.5 : 4.5;

                ctx.save();
                ctx.translate(shx, shy);
                ctx.shadowBlur = 7 * shPulse;
                ctx.shadowColor = '#f59e0b';

                if (shc) {
                    const ax = cx - shx, ay = cy - shy;
                    ctx.rotate(Math.atan2(ay, ax));
                    ctx.fillStyle = `rgba(245,158,11,${0.7 + shPulse * 0.3})`;
                    ctx.beginPath();
                    ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillStyle = `rgba(251,191,36,${0.7 + shPulse * 0.25})`;
                    ctx.strokeStyle = `rgba(253,230,138,${shPulse * 0.85})`;
                    ctx.lineWidth = 1.2;
                    ctx.fillRect(-SZ, -SZ, SZ * 2, SZ * 2);
                    ctx.strokeRect(-SZ, -SZ, SZ * 2, SZ * 2);
                }
                ctx.restore();
            }

            // ── 6. Enemies — distinct shapes & colors per type ────
            if (Array.isArray(window.enemies)) {
                for (const e of window.enemies) {
                    if (!e || e.dead) continue;
                    const { x: ex, y: ey, clamped: ec } = toRadar(e.x, e.y);

                    ctx.save();

                    if (ec) {
                        // Clamped: arrow pointing toward enemy (all types same)
                        ctx.translate(ex, ey);
                        ctx.rotate(Math.atan2(cy - ey, cx - ex));
                        const arrowColor = e.type === 'mage'
                            ? 'rgba(180,80,255,0.9)'
                            : (e.type === 'tank' ? 'rgba(255,120,40,0.9)' : 'rgba(255,50,50,0.9)');
                        ctx.fillStyle = arrowColor;
                        ctx.shadowBlur = 5;
                        ctx.shadowColor = arrowColor;
                        ctx.beginPath();
                        ctx.moveTo(6, 0); ctx.lineTo(0, -3.5); ctx.lineTo(0, 3.5);
                        ctx.closePath(); ctx.fill();
                    } else if (e.type === 'mage') {
                        // ── Mage: purple rotating diamond ─────────────
                        ctx.translate(ex, ey);
                        ctx.rotate(now / 800);     // slow spin
                        const r = 6;
                        ctx.fillStyle = 'rgba(190,75,255,1.0)';
                        ctx.strokeStyle = 'rgba(220,160,255,0.9)';
                        ctx.lineWidth = 1.2;
                        ctx.shadowBlur = 8;
                        ctx.shadowColor = '#b44dff';
                        ctx.beginPath();
                        ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0);
                        ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0);
                        ctx.closePath(); ctx.fill(); ctx.stroke();
                        // Inner sparkle dot
                        ctx.fillStyle = 'rgba(240,200,255,0.85)';
                        ctx.shadowBlur = 4;
                        ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();

                    } else if (e.type === 'tank') {
                        // ── Tank: orange bold square ───────────────────
                        const r = 5.5;
                        ctx.fillStyle = 'rgba(255,115,35,1.0)';
                        ctx.strokeStyle = 'rgba(255,185,90,0.9)';
                        ctx.lineWidth = 1.4;
                        ctx.shadowBlur = 7;
                        ctx.shadowColor = '#ff7320';
                        ctx.beginPath();
                        ctx.rect(ex - r, ey - r, r * 2, r * 2);
                        ctx.fill(); ctx.stroke();
                        // Corner ticks for "armour" feel
                        ctx.strokeStyle = 'rgba(255,220,120,0.75)';
                        ctx.lineWidth = 1;
                        ctx.shadowBlur = 0;
                        const tk = 2.5;
                        [[ex - r, ey - r], [ex + r, ey - r],
                        [ex - r, ey + r], [ex + r, ey + r]].forEach(([px, py]) => {
                            ctx.beginPath();
                            ctx.arc(px, py, tk, 0, Math.PI * 2); ctx.stroke();
                        });

                    } else {
                        // ── Basic: bright red circle ───────────────────
                        const r = 5;
                        const glow = 0.6 + Math.sin(now / 400 + e.x) * 0.4;
                        ctx.fillStyle = 'rgba(255,38,38,1.0)';
                        ctx.shadowBlur = 8 * glow;
                        ctx.shadowColor = '#ff2222';
                        ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
                        // Bright highlight dot
                        ctx.fillStyle = 'rgba(255,180,180,0.75)';
                        ctx.shadowBlur = 0;
                        ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.restore();
                }
            }

            // ── 7. Boss — 6 px pulsating purple dot ───────────────
            if (window.boss && !window.boss.dead) {
                const t = (now % 1000) / 1000;
                const pulse = 0.5 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.8;
                const { x: bx, y: by, clamped: bc } = toRadar(
                    window.boss.x, window.boss.y, radarRadius - 10
                );

                ctx.save();
                ctx.shadowBlur = 14 * pulse;
                ctx.shadowColor = '#a855f7';

                if (bc) {
                    ctx.translate(bx, by);
                    ctx.rotate(Math.atan2(cy - by, cx - bx));
                    ctx.fillStyle = `rgba(168,85,247,${0.7 + pulse * 0.3})`;
                    ctx.beginPath();
                    ctx.moveTo(8, 0); ctx.lineTo(0, -5); ctx.lineTo(0, 5); ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillStyle = `rgba(170,110,255,${0.75 + 0.25 * pulse})`;
                    ctx.beginPath(); ctx.arc(bx, by, 6 * pulse, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = `rgba(216,180,254,${0.30 + 0.15 * pulse})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.arc(bx, by, 10 + 3 * pulse, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = `rgba(255,220,255,${0.75 + 0.25 * pulse})`;
                    ctx.font = 'bold 6px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText('BOSS', bx, by - 12 - 2 * pulse);
                }
                ctx.restore();
            }

            // ── 8. Player — green triangle at radar center (6 px) ──
            ctx.save();
            ctx.translate(cx, cy);
            if (player.angle !== undefined) ctx.rotate(player.angle + Math.PI / 2);
            ctx.shadowBlur = 8; ctx.shadowColor = '#34d399';
            ctx.fillStyle = 'rgba(52,214,88,0.98)';
            ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.beginPath(); ctx.arc(0, -5, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        } // end if (window.isFogWave) / else

        // ══════════════════════════════════════════════════════
        // INNER RESTORE — releases the circular clip region.
        // Everything drawn after this point renders outside the
        // circle without being cut off. THIS IS THE CRITICAL FIX
        // for the clip architecture — the separate save/restore
        // pair means the clip is self-contained and cannot bleed
        // into any other canvas operations.
        // ══════════════════════════════════════════════════════
        ctx.restore();  // ← ends INNER save — clip released

        // ── 9. Label & legend strip (outside clip) ────────────
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 8px Orbitron, monospace';
        ctx.fillStyle = 'rgba(72,187,120,0.70)';
        ctx.fillText(GAME_TEXTS.ui.minimapTitle, cx, cy + radarRadius + 5);

        // Tiny legend row: colored symbols matching blip types
        // ● red=basic  ◆ purple=mage  ■ orange=tank  ★ boss  □ shop
        const legend = [
            { col: '#ef4444', label: GAME_TEXTS.ui.legendEnm, shape: 'circle' },
            { col: '#b44dff', label: GAME_TEXTS.ui.legendMge, shape: 'diamond' },
            { col: '#ff7320', label: GAME_TEXTS.ui.legendTnk, shape: 'square' },
            { col: '#a855f7', label: GAME_TEXTS.ui.legendBss, shape: 'circle' },
            { col: '#f59e0b', label: GAME_TEXTS.ui.legendShp, shape: 'square' },
        ];
        const lx0 = cx - (legend.length - 1) * 12;
        legend.forEach(({ col, label, shape }, i) => {
            const lx = lx0 + i * 24;
            const ly = cy + radarRadius + 17;
            ctx.fillStyle = col;
            ctx.shadowBlur = 3;
            ctx.shadowColor = col;
            if (shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(lx, ly - 3.5); ctx.lineTo(lx + 3, ly);
                ctx.lineTo(lx, ly + 3.5); ctx.lineTo(lx - 3, ly);
                ctx.closePath(); ctx.fill();
            } else if (shape === 'square') {
                ctx.fillRect(lx - 3, ly - 3, 6, 6);
            } else {
                ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.font = '6px monospace';
            ctx.fillStyle = 'rgba(203,213,225,0.65)';
            ctx.fillText(label, lx, ly + 9);
        });

        // ══════════════════════════════════════════════════════
        // OUTER RESTORE — final cleanup.
        // Restores composite operation, globalAlpha, shadowBlur
        // to whatever state they were in before drawMinimap().
        // ══════════════════════════════════════════════════════
        ctx.restore();  // ← ends OUTER save
    }
    // -- _roundRect -- moved from module scope --
    // Only used by drawConfusedWarning().
    static _roundRect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }
    }
}

// ════════════════════════════════════════════════════════════
// Combo state variables
// ════════════════════════════════════════════════════════════
let comboCount = 0;
let comboTimer = 0;
let comboScale = 1.0;
let comboShake = 0.0;
const comboShakeDecay = 4.5;
const comboScaleDecay = 6.0;

function addCombo() {
    comboCount++;
    comboTimer = 2.0;
    comboScale = 1.6;
    comboShake = Math.min(1.0, 0.15 + comboCount / 30);
    try { if (typeof Audio !== 'undefined' && Audio.playCombo) Audio.playCombo(); } catch (e) { }
}

// ════════════════════════════════════════════════════════════
// Global singletons — must be on window for cross-script access
// ════════════════════════════════════════════════════════════
// 'var' declarations auto-register on window; class declarations do NOT.
var Achievements = new AchievementSystem();

// Expose ShopManager and UIManager on window so game.js and map.js
// can access them regardless of which script tag loads first.
window.ShopManager = ShopManager;
window.UIManager = UIManager;
window.CanvasHUD = CanvasHUD;
window.Achievements = Achievements;

// ── High-score display on initial page load ───────────────────
// Wrapped in DOMContentLoaded so the DOM is ready before we query it.
window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = getSaveData();
        UIManager.updateHighScoreDisplay(saved.highScore || 0);
    } catch (e) {
        console.warn('[MTC Save] Could not init high score display:', e);
    }
});

// ── Node/bundler export ───────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AchievementSystem, ShopManager, UIManager, CanvasHUD, Achievements, addCombo, comboCount, comboTimer };
}