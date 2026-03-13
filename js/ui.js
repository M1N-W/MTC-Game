'use strict';
/**
 * js/ui.js
 * ════════════════════════════════════════════════
 * All DOM + Canvas HUD systems: achievements, shop panel, skill icons,
 * boss HP bar, combo UI, minimap radar, voice bubbles, boss speech.
 * 2419 lines — largest UI file in the project.
 *
 * Design notes:
 *   - Four classes exported to window.*: AchievementSystem, AchievementGallery,
 *     ShopManager, UIManager, CanvasHUD. Instantiated at bottom of file.
 *   - PORTRAITS (L.391) is a plain object of inline SVG strings keyed by charId.
 *     Add new character portrait here when adding a 5th character.
 *   - UIManager.setupCharacterHUD() must be called after character selection —
 *     it wires skill slot IDs, portrait SVG, theme class, and mobile button labels.
 *   - CanvasHUD draws directly onto the game canvas each frame (combo, ammo pill,
 *     stand meter warning, minimap). No DOM for these elements.
 *   - ShopManager owns the shop DOM panel only — buy/roll logic lives in ShopSystem.js.
 *   - High-score static display wired via DOMContentLoaded at L.2408.
 *
 * Singleton instances (bottom of file):
 *   window.Achievements   = new AchievementSystem()
 *   window.ShopManager    = ShopManager   (class ref, not instance — used as static)
 *   window.UIManager      = UIManager
 *   window.CanvasHUD      = CanvasHUD
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.40   AchievementSystem         unlock/check/persist achievements
 *  L.198  AchievementGallery        render achievement card grid in DOM
 *  L.287  ShopManager               DOM shop panel: open/close/render items
 *  L.388  PORTRAITS                 inline SVG map keyed by charId
 *  L.845  UIManager                 skill HUD wiring, boss HP bar, voice bubbles,
 *                                   boss speech, cooldown arcs per character
 *  L.948  .voiceBubble()            queue-based military HUD chip (canvas)
 *  L.1057 .bossSpeech()             typewriter reveal, per-frame reposition
 *  L.1133 .initSkillNames()         static slot labels from GAME_TEXTS.skillNames
 *  L.1150 .setupCharacterHUD()      full HUD rewire on character select
 *  L.1530 .updateSkillIcons()       per-frame cooldown arc updates
 *  L.1564 .updateSkillIcons Pat     zanzo / blade-guard / iaido arcs
 *  L.1646 .updateSkillIcons Poom    eat / naga / ritual / garuda arcs
 *  L.1686 .updateSkillIcons Auto    wanchai / vacuum / detonation arcs
 *  L.1735 .updateSkillIcons Kao     teleport charges / clone arc
 *  L.1859 CanvasHUD                 combo counter, ammo pill, stand warning, minimap
 *  L.2039 .drawMinimap()            radar: sweep, POI, enemies, boss, player dot
 *  L.2375 addCombo()                combo counter increment + shake/scale impulse
 *  L.2397 Achievements (instance)   window.Achievements singleton
 *  L.2408 DOMContentLoaded          high-score static display init
 *
 * ⚠️  setupCharacterHUD() must be called AFTER window.player is assigned —
 *     it reads player.constructor.name and player stats for slot labelling.
 * ⚠️  CanvasHUD methods draw to the shared CTX — always ctx.save()/restore().
 *     Drawing order relative to game entities is set by drawGame() in game.js.
 * ⚠️  Minimap radar blackout during fog waves reads window.isFogWave (WaveManager).
 *     If WaveManager.js loads after ui.js, first-frame radar will briefly show
 *     (harmless — isFogWave defaults falsy).
 * ⚠️  AchievementSystem.unlock() guards against duplicate unlocks via _unlocked Set.
 *     Old code path used unlock(string) which left stale `undefined` entries —
 *     fully cleaned up but do not re-introduce string-key unlock calls.
 * ════════════════════════════════════════════════
 */

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
    kao: `<defs>
        <clipPath id="cpk"><rect width="96" height="112" rx="4" /></clipPath>
<linearGradient id="kBg" x1="0" y1="0" x2="0.2" y2="1">
<stop offset="0%" stop-color="#08112e"/>
<stop offset="60%" stop-color="#040c1e"/>
<stop offset="100%" stop-color="#020610"/>
</linearGradient>
<radialGradient id="kFace" cx="50%" cy="44%" r="50%">
<stop offset="0%" stop-color="#f0c88a"/>
<stop offset="70%" stop-color="#d4924e"/>
<stop offset="100%" stop-color="#b87030"/>
</radialGradient>
<radialGradient id="kIris" cx="30%" cy="28%" r="65%">
<stop offset="0%" stop-color="#60aaff"/>
<stop offset="50%" stop-color="#1a5fdd"/>
<stop offset="100%" stop-color="#071a70"/>
</radialGradient>
<radialGradient id="kAura" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="rgba(59,130,246,0.18)"/>
<stop offset="100%" stop-color="rgba(59,130,246,0)"/>
</radialGradient>
<filter id="kGlw" x="-40%" y="-40%" width="180%" height="180%">
<feGaussianBlur stdDeviation="3" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="kSft" x="-20%" y="-20%" width="140%" height="140%">
<feGaussianBlur stdDeviation="1.5" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="kSkin" x="-10%" y="-10%" width="120%" height="120%">
<feGaussianBlur stdDeviation="0.6" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
    <g clip-path="url(#cpk)">
        <rect width="96" height="112" fill="url(#kBg)" />
        <ellipse cx="48" cy="70" rx="44" ry="50" fill="url(#kAura)" />
        <line x1="0" y1="56" x2="96" y2="56" stroke="rgba(59,130,246,0.05)" stroke-width="24" />
        <line x1="48" y1="0" x2="48" y2="112" stroke="rgba(59,130,246,0.04)" stroke-width="16" />
        <path d="M-8 112 L16 70 Q48 84 80 70 L104 112Z" fill="#0b1a3a" />
        <path d="M16 70 Q48 84 80 70 L78 80 Q48 94 18 80Z" fill="#102244" />
        <path d="M16 72 Q10 68 8 74 Q10 80 16 80" fill="#1a3060" stroke="rgba(250,204,21,0.4)" stroke-width="0.8" />
        <path d="M80 72 Q86 68 88 74 Q86 80 80 80" fill="#1a3060" stroke="rgba(250,204,21,0.4)" stroke-width="0.8" />
        <line x1="10" y1="72" x2="15" y2="72" stroke="#facc15" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
        <line x1="9" y1="75" x2="15" y2="75" stroke="#facc15" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
        <path d="M37 70 L48 86 L59 70" fill="none" stroke="#facc15" stroke-width="2" stroke-linejoin="round" />
        <path d="M40 70 L48 82 L56 70" fill="rgba(0,0,20,0.4)" />
        <rect x="40" y="90" width="16" height="9" rx="1.5" fill="rgba(250,204,21,0.1)" stroke="rgba(250,204,21,0.55)" stroke-width="0.8" />
        <text x="48" y="96.5" text-anchor="middle" fill="#facc15" font-size="5.5" font-family="monospace" font-weight="bold" letter-spacing="0.8">MTC</text>
        <path d="M39 66 Q48 73 57 66 L56 73 Q48 79 40 73Z" fill="#d49050" filter="url(#kSkin)" />
        <path d="M41 66 Q48 70 55 66 L55 69 Q48 73 41 69Z" fill="rgba(0,0,0,0.2)" />
        <ellipse cx="27" cy="51" rx="4.5" ry="5.5" fill="#d49050" />
        <path d="M28.5 48 Q26 51 28.5 54" fill="none" stroke="#b07030" stroke-width="1.2" />
        <ellipse cx="69" cy="51" rx="4.5" ry="5.5" fill="#d49050" />
        <path d="M27 53 Q26 36 48 28 Q70 36 69 53 Q69 65 59 70 Q48 74 37 70 Q27 65 27 53Z" fill="url(#kFace)" filter="url(#kSkin)" />
        <ellipse cx="36" cy="58" rx="5" ry="3" fill="rgba(220,120,80,0.18)" />
        <ellipse cx="60" cy="58" rx="5" ry="3" fill="rgba(220,120,80,0.18)" />
        <path d="M44 70 Q48 73 52 70" fill="rgba(255,200,140,0.25)" />
        <path d="M26 50 Q24 30 48 22 Q72 30 70 50" fill="#080e28" />
        <path d="M26 48 Q18 38 16 26 Q22 30 26 38 Q20 28 22 18 Q28 24 30 34 Q26 22 30 16 Q36 22 34 34Z" fill="#0c1535" />
        <path d="M70 48 Q76 38 78 26 Q72 30 68 40Z" fill="#0c1535" />
        <path d="M38 26 Q36 16 40 11 Q42 18 43 24Z" fill="#0c1535" />
        <path d="M44 24 Q44 13 48 9 Q50 16 50 23Z" fill="#080e28" />
        <path d="M50 24 Q53 14 57 12 Q56 19 54 25Z" fill="#0c1535" />
        <path d="M34 28 Q38 24 44 26" fill="none" stroke="rgba(100,140,255,0.45)" stroke-width="2" stroke-linecap="round" />
        <path d="M52 24 Q56 22 60 25" fill="none" stroke="rgba(100,140,255,0.25)" stroke-width="1.2" stroke-linecap="round" />
        <rect x="29" y="30" width="38" height="4.5" rx="1" fill="#04071a" />
        <rect x="35" y="24" width="26" height="7" rx="1.5" fill="#04071a" />
        <line x1="35" y1="26" x2="53" y2="26" stroke="rgba(255,255,255,0.1)" stroke-width="0.8" />
        <path d="M61 27 Q70 33 68 44" fill="none" stroke="#facc15" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="68" cy="45" r="3.2" fill="#facc15" filter="url(#kGlw)" />
        <circle cx="68" cy="45" r="1.5" fill="#fff8b0" />
        <ellipse cx="37" cy="50" rx="6.5" ry="5.5" fill="white" />
        <ellipse cx="37" cy="51.5" rx="6" ry="4" fill="rgba(200,220,255,0.3)" />
        <circle cx="37" cy="50" r="4.5" fill="url(#kIris)" />
        <circle cx="37" cy="50" r="2.4" fill="#040a1e" />
        <circle cx="34.5" cy="47.5" r="2" fill="white" opacity="0.95" />
        <circle cx="39.5" cy="52" r="0.9" fill="white" opacity="0.55" />
        <path d="M30.5 47 Q37 44 43.5 47" fill="none" stroke="#0a0820" stroke-width="2" stroke-linecap="round" />
        <path d="M31 53 Q37 55 43 53" fill="none" stroke="rgba(20,10,40,0.4)" stroke-width="0.8" stroke-linecap="round" />
        <ellipse cx="59" cy="50" rx="6.5" ry="5.5" fill="white" />
        <ellipse cx="59" cy="51.5" rx="6" ry="4" fill="rgba(200,220,255,0.3)" />
        <circle cx="59" cy="50" r="4.5" fill="url(#kIris)" />
        <circle cx="59" cy="50" r="2.4" fill="#040a1e" />
        <circle cx="56.5" cy="47.5" r="2" fill="white" opacity="0.95" />
        <circle cx="61.5" cy="52" r="0.9" fill="white" opacity="0.55" />
        <path d="M52.5 47 Q59 44 65.5 47" fill="none" stroke="#0a0820" stroke-width="2" stroke-linecap="round" />
        <path d="M53 53 Q59 55 65 53" fill="none" stroke="rgba(20,10,40,0.4)" stroke-width="0.8" stroke-linecap="round" />
        <circle cx="59" cy="50" r="9.5" fill="none" stroke="rgba(34,220,255,0.75)" stroke-width="1.4" filter="url(#kSft)" />
        <circle cx="59" cy="50" r="9.5" fill="none" stroke="rgba(34,220,255,0.35)" stroke-width="3" />
        <line x1="59" y1="39.5" x2="59" y2="42.5" stroke="#22ddff" stroke-width="1.1" opacity="0.8" />
        <line x1="59" y1="57.5" x2="59" y2="60.5" stroke="#22ddff" stroke-width="1.1" opacity="0.8" />
        <line x1="48.5" y1="50" x2="51.5" y2="50" stroke="#22ddff" stroke-width="1.1" opacity="0.8" />
        <line x1="66.5" y1="50" x2="69.5" y2="50" stroke="#22ddff" stroke-width="1.1" opacity="0.8" />
        <path d="M68.5 44 Q74 40 77 37" fill="none" stroke="#22ddff" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
        <path d="M30 45.5 Q37 42 44 44.5" fill="none" stroke="#0a0e28" stroke-width="2.8" stroke-linecap="round" />
        <path d="M52 44.5 Q59 42 66 45.5" fill="none" stroke="#0a0e28" stroke-width="2.8" stroke-linecap="round" />
        <path d="M43 44 Q48 43 53 44" fill="none" stroke="#0a0e28" stroke-width="1.2" stroke-linecap="round" />
        <path d="M46 56.5 L48 60 L50 56.5" fill="none" stroke="rgba(150,80,20,0.5)" stroke-width="1.2" stroke-linejoin="round" />
        <line x1="48" y1="51" x2="48" y2="57" stroke="rgba(100,50,10,0.15)" stroke-width="2.5" />
        <path d="M42 64.5 Q48 68.5 55 65" fill="none" stroke="#b06030" stroke-width="1.8" stroke-linecap="round" />
        <path d="M44 65 Q48 67 53 65.5" fill="rgba(255,180,120,0.22)" />
        <g opacity="0.22" filter="url(#kSft)">
            <circle cx="13" cy="13" r="9" fill="none" stroke="#facc15" stroke-width="1" />
            <circle cx="13" cy="13" r="2.5" fill="rgba(250,204,21,0.4)" />
            <line x1="13" y1="2" x2="13" y2="7" stroke="#facc15" stroke-width="1" />
            <line x1="13" y1="19" x2="13" y2="24" stroke="#facc15" stroke-width="1" />
            <line x1="2" y1="13" x2="7" y2="13" stroke="#facc15" stroke-width="1" />
            <line x1="19" y1="13" x2="24" y2="13" stroke="#facc15" stroke-width="1" />
        </g>
        <rect x="0" y="108" width="96" height="4" fill="rgba(59,130,246,0.2)" />
        <line x1="0" y1="108" x2="96" y2="108" stroke="rgba(59,130,246,0.6)" stroke-width="0.8" />
        <line x1="0" y1="108" x2="24" y2="108" stroke="rgba(250,204,21,0.7)" stroke-width="0.8" />
    </g>`,
    poom: `<defs>
    <clipPath id="cpp"><rect width="96" height="112" rx="4" /></clipPath>
<linearGradient id="pBg" x1="0.1" y1="0" x2="0.3" y2="1">
<stop offset="0%" stop-color="#040e08"/>
<stop offset="50%" stop-color="#030a06"/>
<stop offset="100%" stop-color="#010402"/>
</linearGradient>
<radialGradient id="pFace" cx="50%" cy="42%" r="50%">
<stop offset="0%" stop-color="#e0b078"/>
<stop offset="70%" stop-color="#c08040"/>
<stop offset="100%" stop-color="#8a5020"/>
</radialGradient>
<radialGradient id="pIris" cx="28%" cy="26%" r="65%">
<stop offset="0%" stop-color="#a0ffd8"/>
<stop offset="40%" stop-color="#10c878"/>
<stop offset="100%" stop-color="#044a28"/>
</radialGradient>
<radialGradient id="pAura" cx="30%" cy="60%" r="60%">
<stop offset="0%" stop-color="rgba(16,185,129,0.2)"/>
<stop offset="100%" stop-color="rgba(16,185,129,0)"/>
</radialGradient>
<linearGradient id="pRobe" x1="0" y1="0" x2="0.15" y2="1">
<stop offset="0%" stop-color="#1c4228"/>
<stop offset="100%" stop-color="#060e08"/>
</linearGradient>
<filter id="pNaga" x="-50%" y="-50%" width="200%" height="200%">
<feGaussianBlur stdDeviation="4" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="pSft" x="-20%" y="-20%" width="140%" height="140%">
<feGaussianBlur stdDeviation="1.5" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="pSkin" x="-10%" y="-10%" width="120%" height="120%">
<feGaussianBlur stdDeviation="0.7" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
    <g clip-path="url(#cpp)">
        <rect width="96" height="112" fill="url(#pBg)" />
        <ellipse cx="20" cy="65" rx="50" ry="55" fill="url(#pAura)" />
        <circle cx="14" cy="30" r="1" fill="rgba(16,185,129,0.35)" />
        <circle cx="8" cy="55" r="0.7" fill="rgba(16,185,129,0.25)" />
        <circle cx="82" cy="42" r="0.8" fill="rgba(245,158,11,0.3)" />
        <circle cx="88" cy="25" r="1.2" fill="rgba(245,158,11,0.2)" />
        <path d="M-8 112 L16 68 Q48 82 80 68 L104 112Z" fill="url(#pRobe)" />
        <path d="M16 68 Q48 82 80 68 L78 78 Q48 92 18 78Z" fill="#224830" />
        <path d="M30 78 Q48 88 66 78" fill="none" stroke="rgba(245,158,11,0.2)" stroke-width="1" />
        <line x1="48" y1="74" x2="48" y2="112" stroke="rgba(245,158,11,0.18)" stroke-width="1.5" />
        <path d="M36 68 L48 84 L60 68" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linejoin="round" />
        <circle cx="40" cy="74" r="1.8" fill="#f59e0b" opacity="0.9" />
        <circle cx="44" cy="80" r="1.5" fill="#f59e0b" opacity="0.8" />
        <circle cx="48" cy="84" r="2" fill="#f59e0b" opacity="0.9" filter="url(#pSft)" />
        <circle cx="52" cy="80" r="1.5" fill="#f59e0b" opacity="0.8" />
        <circle cx="56" cy="74" r="1.8" fill="#f59e0b" opacity="0.9" />
        <path d="M22 82 Q30 86 38 82" fill="none" stroke="rgba(245,158,11,0.12)" stroke-width="0.8" />
        <path d="M58 82 Q66 86 74 82" fill="none" stroke="rgba(245,158,11,0.12)" stroke-width="0.8" />
        <path d="M39 64 Q48 71 57 64 L56 72 Q48 78 40 72Z" fill="#b07040" filter="url(#pSkin)" />
        <ellipse cx="27" cy="52" rx="4.5" ry="5.5" fill="#c08040" />
        <circle cx="27" cy="49" r="2.5" fill="#f59e0b" filter="url(#pSft)" opacity="0.9" />
        <circle cx="27" cy="49" r="1.2" fill="#fff8e0" />
        <ellipse cx="69" cy="52" rx="4.5" ry="5.5" fill="#c08040" />
        <circle cx="69" cy="49" r="2.5" fill="#f59e0b" filter="url(#pSft)" opacity="0.9" />
        <circle cx="69" cy="49" r="1.2" fill="#fff8e0" />
        <path d="M27 54 Q26 36 48 28 Q70 36 69 54 Q69 66 58 71 Q48 75 38 71 Q27 66 27 54Z" fill="url(#pFace)" filter="url(#pSkin)" />
        <ellipse cx="36" cy="59" rx="5.5" ry="3" fill="rgba(200,100,60,0.15)" />
        <ellipse cx="60" cy="59" rx="5.5" ry="3" fill="rgba(200,100,60,0.15)" />
        <path d="M27 52 Q22 35 28 20 Q38 12 48 13 Q58 12 68 20 Q74 35 69 52" fill="#1a0700" />
        <path d="M27 52 Q20 58 18 70 Q16 80 20 88" fill="none" stroke="#240c00" stroke-width="8" stroke-linecap="round" />
        <path d="M69 52 Q76 58 78 70 Q80 80 76 88" fill="none" stroke="#240c00" stroke-width="8" stroke-linecap="round" />
        <path d="M24 40 Q20 50 22 62" fill="none" stroke="rgba(100,40,0,0.5)" stroke-width="1.8" stroke-linecap="round" />
        <path d="M26 36 Q22 46 24 58" fill="none" stroke="rgba(70,25,0,0.35)" stroke-width="1.2" stroke-linecap="round" />
        <path d="M72 40 Q76 50 74 62" fill="none" stroke="rgba(100,40,0,0.5)" stroke-width="1.8" stroke-linecap="round" />
        <path d="M36 18 Q44 14 52 16" fill="none" stroke="rgba(200,100,30,0.45)" stroke-width="2" stroke-linecap="round" />
        <path d="M38 20 Q44 16 50 18" fill="none" stroke="rgba(255,180,80,0.3)" stroke-width="1.5" stroke-linecap="round" />
        <path d="M62 33 Q70 28 72 22" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" opacity="0.7" />
        <circle cx="62" cy="33" r="3" fill="#f59e0b" opacity="0.8" filter="url(#pSft)" />
        <circle cx="62" cy="33" r="1.5" fill="#fff8c0" />
        <ellipse cx="37" cy="50" rx="7" ry="5.5" fill="white" />
        <ellipse cx="37" cy="51" rx="6.5" ry="4.5" fill="rgba(200,255,220,0.2)" />
        <circle cx="37" cy="50" r="4.8" fill="url(#pIris)" />
        <ellipse cx="37" cy="50" rx="1.3" ry="4" fill="#021008" />
        <circle cx="34.5" cy="47.5" r="2.2" fill="white" opacity="0.95" />
        <circle cx="40" cy="52.5" r="1" fill="white" opacity="0.5" />
        <path d="M30 47 Q37 43.5 44 47" fill="none" stroke="#100800" stroke-width="2.2" stroke-linecap="round" />
        <line x1="30.5" y1="47.5" x2="28.5" y2="45" stroke="#100800" stroke-width="1.4" stroke-linecap="round" />
        <line x1="43.5" y1="47.5" x2="45.5" y2="45" stroke="#100800" stroke-width="1.4" stroke-linecap="round" />
        <path d="M31 54 Q37 56.5 43 54" fill="none" stroke="rgba(10,20,5,0.35)" stroke-width="0.8" />
        <ellipse cx="59" cy="50" rx="7" ry="5.5" fill="white" />
        <ellipse cx="59" cy="51" rx="6.5" ry="4.5" fill="rgba(200,255,220,0.2)" />
        <circle cx="59" cy="50" r="4.8" fill="url(#pIris)" />
        <ellipse cx="59" cy="50" rx="1.3" ry="4" fill="#021008" />
        <circle cx="56.5" cy="47.5" r="2.2" fill="white" opacity="0.95" />
        <circle cx="62" cy="52.5" r="1" fill="white" opacity="0.5" />
        <path d="M52 47 Q59 43.5 66 47" fill="none" stroke="#100800" stroke-width="2.2" stroke-linecap="round" />
        <line x1="52.5" y1="47.5" x2="50.5" y2="45" stroke="#100800" stroke-width="1.4" stroke-linecap="round" />
        <line x1="65.5" y1="47.5" x2="67.5" y2="45" stroke="#100800" stroke-width="1.4" stroke-linecap="round" />
        <path d="M53 54 Q59 56.5 65 54" fill="none" stroke="rgba(10,20,5,0.35)" stroke-width="0.8" />
        <path d="M30 44 Q37 40.5 44 43" fill="none" stroke="#200800" stroke-width="3" stroke-linecap="round" />
        <path d="M52 43 Q59 40.5 66 44" fill="none" stroke="#200800" stroke-width="3" stroke-linecap="round" />
        <path d="M46 57 L48 61 L50 57" fill="none" stroke="rgba(130,65,10,0.45)" stroke-width="1.2" stroke-linejoin="round" />
        <line x1="48" y1="51" x2="48" y2="57" stroke="rgba(100,50,5,0.12)" stroke-width="3" />
        <path d="M41 65.5 Q48 70.5 55 65.5" fill="none" stroke="#905030" stroke-width="1.8" stroke-linecap="round" />
        <path d="M42 65.5 Q45 64 48 65 Q51 64 54 65.5" fill="rgba(200,130,70,0.25)" />
        <path d="M43 65.5 Q48 67.5 53 65.5" fill="rgba(255,160,80,0.18)" />
        <path d="M4 110 Q-4 85 5 60 Q12 42 26 38" fill="none" stroke="#10b981" stroke-width="14" stroke-linecap="round" opacity="0.12" filter="url(#pNaga)" />
        <path d="M4 110 Q-4 85 5 60 Q12 42 26 38" fill="none" stroke="#10b981" stroke-width="7" stroke-linecap="round" opacity="0.3" filter="url(#pSft)" />
        <path d="M4 110 Q-4 85 5 60 Q12 42 26 38" fill="none" stroke="#059669" stroke-width="5" stroke-linecap="round" />
        <path d="M4 110 Q-4 85 5 60 Q12 42 26 38" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 4" />
        <path d="M5 105 Q-3 82 6 58 Q13 44 26 40" fill="none" stroke="rgba(160,255,210,0.3)" stroke-width="1" stroke-linecap="round" />
        <ellipse cx="27" cy="37" rx="11" ry="7" fill="#059669" transform="rotate(-35,27,37)" filter="url(#pSft)" />
        <ellipse cx="27" cy="37" rx="11" ry="7" fill="#34d399" transform="rotate(-35,27,37)" opacity="0.45" />
        <path d="M20 32 Q27 30 33 35" fill="none" stroke="rgba(0,80,40,0.5)" stroke-width="1.5" />
        <circle cx="22.5" cy="33" r="2.8" fill="#f59e0b" filter="url(#pSft)" />
        <circle cx="22.5" cy="33" r="2.8" fill="#fbbf24" opacity="0.7" />
        <ellipse cx="22.5" cy="33" rx="0.9" ry="2.4" fill="#060100" />
        <circle cx="21.8" cy="32.2" r="1" fill="rgba(255,255,200,0.85)" />
        <path d="M32 33 L38 28" fill="none" stroke="#34d399" stroke-width="1.5" stroke-linecap="round" />
        <path d="M38 28 L36.5 25.5 M38 28 L40 25.5" fill="none" stroke="#34d399" stroke-width="1.2" stroke-linecap="round" />
        <rect x="0" y="108" width="96" height="4" fill="rgba(16,185,129,0.2)" />
        <line x1="0" y1="108" x2="96" y2="108" stroke="rgba(16,185,129,0.6)" stroke-width="0.8" />
        <line x1="72" y1="108" x2="96" y2="108" stroke="rgba(245,158,11,0.6)" stroke-width="0.8" />
    </g>`,
    auto: `<defs>
    <clipPath id="cpa"><rect width="96" height="112" rx="4" /></clipPath>
<radialGradient id="aBg" cx="50%" cy="50%" r="65%">
<stop offset="0%" stop-color="#1e0404"/>
<stop offset="60%" stop-color="#0e0202"/>
<stop offset="100%" stop-color="#060101"/>
</radialGradient>
<radialGradient id="aFace" cx="48%" cy="40%" r="52%">
<stop offset="0%" stop-color="#d49060"/>
<stop offset="70%" stop-color="#a86030"/>
<stop offset="100%" stop-color="#7a3a10"/>
</radialGradient>
<radialGradient id="aIris" cx="28%" cy="24%" r="65%">
<stop offset="0%" stop-color="#ffdd60"/>
<stop offset="45%" stop-color="#f97316"/>
<stop offset="100%" stop-color="#7c1a04"/>
</radialGradient>
<radialGradient id="aBody" cx="50%" cy="25%" r="70%">
<stop offset="0%" stop-color="#400808"/>
<stop offset="100%" stop-color="#100101"/>
</radialGradient>
<radialGradient id="aAura" cx="50%" cy="50%" r="55%">
<stop offset="0%" stop-color="rgba(220,38,38,0.2)"/>
<stop offset="100%" stop-color="rgba(220,38,38,0)"/>
</radialGradient>
<filter id="aFire" x="-50%" y="-80%" width="200%" height="280%">
<feGaussianBlur stdDeviation="4" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="aHeat" x="-30%" y="-30%" width="160%" height="160%">
<feGaussianBlur stdDeviation="2.5" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="aSft" x="-15%" y="-15%" width="130%" height="130%">
<feGaussianBlur stdDeviation="1.2" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="aSkin" x="-10%" y="-10%" width="120%" height="120%">
<feGaussianBlur stdDeviation="0.7" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
    <g clip-path="url(#cpa)">
        <rect width="96" height="112" fill="url(#aBg)" />
        <ellipse cx="48" cy="60" rx="48" ry="55" fill="url(#aAura)" />
        <circle cx="48" cy="60" r="46" fill="none" stroke="rgba(220,38,38,0.07)" stroke-width="3" />
        <circle cx="48" cy="60" r="32" fill="none" stroke="rgba(249,115,22,0.09)" stroke-width="2" />
        <circle cx="48" cy="60" r="18" fill="none" stroke="rgba(251,191,36,0.1)" stroke-width="1.5" />
        <line x1="-10" y1="95" x2="106" y2="65" stroke="rgba(220,38,38,0.06)" stroke-width="16" />
        <path d="M-6 112 L18 66 Q48 80 78 66 L102 112Z" fill="url(#aBody)" />
        <path d="M18 66 Q8 58 6 68 Q8 78 18 80 Q10 76 12 67 Q14 59 18 66Z" fill="#560a0a" stroke="rgba(220,38,38,0.6)" stroke-width="1" />
        <path d="M78 66 Q88 58 90 68 Q88 78 78 80 Q86 76 84 67 Q82 59 78 66Z" fill="#560a0a" stroke="rgba(220,38,38,0.6)" stroke-width="1" />
        <circle cx="10" cy="66" r="1.2" fill="rgba(220,38,38,0.6)" />
        <circle cx="10" cy="72" r="1.2" fill="rgba(220,38,38,0.6)" />
        <circle cx="86" cy="66" r="1.2" fill="rgba(220,38,38,0.6)" />
        <circle cx="86" cy="72" r="1.2" fill="rgba(220,38,38,0.6)" />
        <path d="M36 66 L48 80 L60 66" fill="none" stroke="rgba(220,38,38,0.7)" stroke-width="2.2" stroke-linejoin="round" />
        <path d="M39 66 L48 76 L57 66" fill="rgba(0,0,0,0.3)" />
        <circle cx="48" cy="90" r="11" fill="rgba(220,38,38,0.12)" stroke="rgba(220,38,38,0.55)" stroke-width="1.2" filter="url(#aHeat)" />
        <circle cx="48" cy="90" r="8" fill="none" stroke="rgba(220,38,38,0.25)" stroke-width="0.6" />
        <text x="48" y="94.5" text-anchor="middle" fill="#fca5a5" font-size="11" font-family="Arial Black, Impact, sans-serif" font-weight="900" filter="url(#aSft)">W</text>
        <g filter="url(#aHeat)">
            <path d="M22 60 Q16 58 14 50" fill="none" stroke="#9a5828" stroke-width="11" stroke-linecap="round" />
            <rect x="3" y="36" width="22" height="18" rx="8" fill="#9a5828" />
            <line x1="5" y1="43" x2="24" y2="43" stroke="rgba(0,0,0,0.35)" stroke-width="1.5" />
            <line x1="5" y1="47" x2="24" y2="47" stroke="rgba(0,0,0,0.22)" stroke-width="1" />
            <path d="M7 39 L12 47 L10 52" fill="none" stroke="rgba(251,191,36,0.7)" stroke-width="1.2" stroke-linecap="round" />
            <path d="M16 38 L18 44" fill="none" stroke="rgba(251,191,36,0.4)" stroke-width="0.9" stroke-linecap="round" />
            <rect x="3" y="36" width="22" height="18" rx="8" fill="none" stroke="rgba(249,115,22,0.6)" stroke-width="1.2" />
        </g>
        <path d="M14 38 Q10 30 12 22 Q16 27 15 33 Q18 26 19 19 Q22 25 21 32 Q24 26 25 20 Q28 27 25 34 Q29 28 30 23 Q32 31 28 37 Q24 42 19 40 Q14 38 14 38Z" fill="rgba(220,38,38,0.7)" filter="url(#aFire)" />
        <path d="M16 40 Q13 33 15 26 Q18 30 17 35 Q20 29 21 24 Q23 29 22 35 Q25 30 26 26 Q28 32 25 38 Q22 42 19 41Z" fill="rgba(251,191,36,0.55)" />
        <path d="M18 40 Q16 35 18 30 Q20 33 20 37 Q22 32 23 29 Q24 33 23 38Z" fill="rgba(255,230,100,0.35)" />
        <path d="M39 63 Q48 70 57 63 L56 71 Q48 77 40 71Z" fill="#a06030" filter="url(#aSkin)" />
        <path d="M41 63 Q48 67 55 63 L55 66 Q48 70 41 66Z" fill="rgba(0,0,0,0.2)" />
        <ellipse cx="26" cy="51" rx="4.5" ry="5.5" fill="#a06030" />
        <path d="M27.5 48 Q25 51 27.5 54" fill="none" stroke="#7a3010" stroke-width="1.2" />
        <ellipse cx="70" cy="51" rx="4.5" ry="5.5" fill="#a06030" />
        <path d="M26 53 Q25 35 48 27 Q71 35 70 53 Q70 65 60 70 Q48 74 36 70 Q26 65 26 53Z" fill="url(#aFace)" filter="url(#aSkin)" />
        <path d="M36 68 Q48 73 60 68" fill="none" stroke="rgba(100,45,10,0.3)" stroke-width="1.5" />
        <path d="M34 60 Q33 64 35 67" fill="none" stroke="rgba(100,45,10,0.25)" stroke-width="1.5" />
        <path d="M62 60 Q63 64 61 67" fill="none" stroke="rgba(100,45,10,0.25)" stroke-width="1.5" />
        <path d="M26 46 Q25 28 48 22 Q71 28 70 46 L68 40 Q65 25 48 24 Q31 25 28 40Z" fill="#1a0303" />
        <path d="M44 26 Q40 16 38 10 Q44 14 46 22Z" fill="#220505" />
        <path d="M48 24 Q48 12 52 8 Q54 14 52 23Z" fill="#1a0303" />
        <path d="M52 25 Q56 15 60 12 Q60 18 56 26Z" fill="#220505" />
        <path d="M56 27 Q62 18 65 14 Q64 22 59 28Z" fill="#1a0303" />
        <path d="M46 19 Q50 15 55 17" fill="none" stroke="rgba(180,60,30,0.5)" stroke-width="1.5" stroke-linecap="round" />
        <path d="M54 20 Q58 17 62 19" fill="none" stroke="rgba(180,60,30,0.35)" stroke-width="1.2" stroke-linecap="round" />
        <path d="M29 49.5 Q37 46 45 49.5 Q37 54 29 49.5Z" fill="white" />
        <circle cx="37" cy="50" r="4" fill="url(#aIris)" />
        <circle cx="37" cy="50" r="2.2" fill="#080000" />
        <circle cx="35" cy="48" r="1.6" fill="white" opacity="0.92" />
        <circle cx="39.5" cy="52" r="0.8" fill="white" opacity="0.45" />
        <path d="M29 48.5 Q37 44.5 45 48.5" fill="none" stroke="#080000" stroke-width="3" stroke-linecap="round" />
        <path d="M30 51.5 Q37 54 44 51.5" fill="none" stroke="#1a0500" stroke-width="1.2" stroke-linecap="round" opacity="0.7" />
        <path d="M51 49.5 Q59 46 67 49.5 Q59 54 51 49.5Z" fill="white" />
        <circle cx="59" cy="50" r="4" fill="url(#aIris)" />
        <circle cx="59" cy="50" r="2.2" fill="#080000" />
        <circle cx="57" cy="48" r="1.6" fill="white" opacity="0.92" />
        <circle cx="61.5" cy="52" r="0.8" fill="white" opacity="0.45" />
        <path d="M51 48.5 Q59 44.5 67 48.5" fill="none" stroke="#080000" stroke-width="3" stroke-linecap="round" />
        <path d="M52 51.5 Q59 54 66 51.5" fill="none" stroke="#1a0500" stroke-width="1.2" stroke-linecap="round" opacity="0.7" />
        <path d="M28 44 Q37 40 45 43" fill="none" stroke="#0c0101" stroke-width="4" stroke-linecap="round" />
        <path d="M51 43 Q59 40 68 44" fill="none" stroke="#0c0101" stroke-width="4" stroke-linecap="round" />
        <path d="M43.5 42.5 Q48 41 52.5 42.5" fill="none" stroke="#0c0101" stroke-width="2" stroke-linecap="round" />
        <path d="M30 43 Q37 40.5 44 42.5" fill="none" stroke="rgba(60,15,5,0.4)" stroke-width="1" stroke-linecap="round" />
        <path d="M30 53.5 L27 58" stroke="rgba(180,70,30,0.6)" stroke-width="1.2" stroke-linecap="round" />
        <path d="M29 55 L27.5 54" stroke="rgba(180,70,30,0.35)" stroke-width="0.8" stroke-linecap="round" />
        <path d="M46 57 L48 61 L50 57" fill="none" stroke="rgba(110,45,10,0.5)" stroke-width="1.3" stroke-linejoin="round" />
        <path d="M40 65.5 L56 65.5" stroke="#7a2808" stroke-width="2" stroke-linecap="round" fill="none" />
        <path d="M40 65.5 Q39 66.5 40 67.5" fill="none" stroke="rgba(100,30,10,0.4)" stroke-width="0.8" />
        <path d="M56 65.5 Q57 66.5 56 67.5" fill="none" stroke="rgba(100,30,10,0.4)" stroke-width="0.8" />
        <path d="M75 28 Q80 16 78 5 Q86 12 84 22 Q90 14 89 5 Q97 15 93 26 Q98 19 96 10 Q104 22 99 33 Q94 42 84 38 Q74 34 74 26 Q74.5 27 75 28Z" fill="rgba(220,38,38,0.5)" filter="url(#aFire)" />
        <path d="M77 30 Q81 19 79 10 Q85 16 84 24 Q88 17 88 11 Q93 19 90 28 Q87 35 82 33 Q77 31 77 30Z" fill="rgba(249,115,22,0.6)" />
        <path d="M80 30 Q82 22 81 16 Q84 20 84 26 Q86 21 87 17 Q89 23 87 29 Q85 33 82 32Z" fill="rgba(251,191,36,0.5)" />
        <path d="M82 28 Q83 22 83 18 Q85 22 84 27Z" fill="rgba(255,240,180,0.4)" />
        <rect x="0" y="108" width="96" height="4" fill="rgba(220,38,38,0.22)" />
        <line x1="0" y1="108" x2="96" y2="108" stroke="rgba(220,38,38,0.65)" stroke-width="0.8" />
        <line x1="0" y1="108" x2="28" y2="108" stroke="rgba(251,191,36,0.5)" stroke-width="0.8" />
    </g>`,
    pat: `<defs>
    <clipPath id="cppt"><rect width="96" height="112" rx="4" /></clipPath>
<linearGradient id="ptBg" x1="0" y1="0" x2="0.1" y2="1">
<stop offset="0%" stop-color="#0a0b1a"/>
<stop offset="60%" stop-color="#06070f"/>
<stop offset="100%" stop-color="#020308"/>
</linearGradient>
<radialGradient id="ptFace" cx="50%" cy="44%" r="50%">
<stop offset="0%" stop-color="#f5d6b8"/>
<stop offset="70%" stop-color="#ddb07a"/>
<stop offset="100%" stop-color="#b8844a"/>
</radialGradient>
<radialGradient id="ptAura" cx="50%" cy="50%" r="55%">
<stop offset="0%" stop-color="rgba(126,200,227,0.14)"/>
<stop offset="100%" stop-color="rgba(126,200,227,0)"/>
</radialGradient>
<filter id="ptGlw" x="-40%" y="-40%" width="180%" height="180%">
<feGaussianBlur stdDeviation="2.5" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="ptSft" x="-20%" y="-20%" width="140%" height="140%">
<feGaussianBlur stdDeviation="1.2" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
    <g clip-path="url(#cppt)">
        <!-- Background -->
        <rect width="96" height="112" fill="url(#ptBg)" />
        <ellipse cx="48" cy="68" rx="44" ry="48" fill="url(#ptAura)" />
        <!-- Subtle ice-blue vertical light streak -->
        <line x1="48" y1="0" x2="48" y2="112" stroke="rgba(126,200,227,0.04)" stroke-width="14" />
        <!-- Body — navy uniform + white shirt -->
        <path d="M-6 112 L14 74 Q48 88 82 74 L102 112Z" fill="#1a1a2e" />
        <path d="M22 76 Q48 88 74 76 L72 86 Q48 98 26 86Z" fill="#23234a" />
        <!-- Katana silhouette — hip-sheathed, diagonal right -->
        <g filter="url(#ptSft)">
            <line x1="62" y1="72" x2="84" y2="95" stroke="#4a4a6a" stroke-width="3.5" stroke-linecap="round" />
            <line x1="62" y1="72" x2="84" y2="95" stroke="#7ec8e3" stroke-width="1" stroke-linecap="round" opacity="0.55" />
            <!-- Guard (tsuba) -->
            <ellipse cx="66" cy="76" rx="4" ry="2" fill="#8a8aaa" transform="rotate(40,66,76)" />
        </g>
        <!-- Neck -->
        <rect x="42" y="66" width="12" height="10" rx="2" fill="#ddb07a" filter="url(#ptSft)" />
        <!-- Head -->
        <path d="M28 56 Q26 38 48 30 Q70 38 68 56 Q68 68 60 72 Q48 76 36 72 Q28 65 28 56Z" fill="url(#ptFace)" filter="url(#ptSft)" />
        <!-- Ears -->
        <ellipse cx="27" cy="53" rx="3.5" ry="4.5" fill="#ddb07a" />
        <ellipse cx="69" cy="53" rx="3.5" ry="4.5" fill="#ddb07a" />
        <!-- Hair — dark bowl cut -->
        <path d="M28 52 Q26 32 48 24 Q70 32 68 52" fill="#1a1008" />
        <path d="M28 50 Q20 36 18 22 Q26 28 28 40Z" fill="#100a04" />
        <path d="M68 50 Q76 36 78 22 Q70 28 68 40Z" fill="#100a04" />
        <!-- Round glasses — #333333 frame, ice-blue tint lens -->
        <!-- Left lens -->
        <circle cx="37" cy="51" r="7.5" fill="rgba(126,200,227,0.12)" stroke="#333333" stroke-width="1.6" />
        <circle cx="37" cy="51" r="7.5" fill="none" stroke="rgba(126,200,227,0.3)" stroke-width="0.6" />
        <!-- Right lens -->
        <circle cx="59" cy="51" r="7.5" fill="rgba(126,200,227,0.12)" stroke="#333333" stroke-width="1.6" />
        <circle cx="59" cy="51" r="7.5" fill="none" stroke="rgba(126,200,227,0.3)" stroke-width="0.6" />
        <!-- Bridge -->
        <line x1="44.5" y1="51" x2="51.5" y2="51" stroke="#333333" stroke-width="1.4" />
        <!-- Temple arms -->
        <line x1="29.5" y1="51" x2="26" y2="50" stroke="#333333" stroke-width="1.2" stroke-linecap="round" />
        <line x1="66.5" y1="51" x2="70" y2="50" stroke="#333333" stroke-width="1.2" stroke-linecap="round" />
        <!-- Eyes (small, behind glass) -->
        <circle cx="37" cy="51" r="3.2" fill="#1a0808" />
        <circle cx="35.2" cy="49.5" r="1.1" fill="white" opacity="0.9" />
        <circle cx="59" cy="51" r="3.2" fill="#1a0808" />
        <circle cx="57.2" cy="49.5" r="1.1" fill="white" opacity="0.9" />
        <!-- Eyebrows -->
        <path d="M31 45 Q37 43 43 45" fill="none" stroke="#1a1008" stroke-width="1.8" stroke-linecap="round" />
        <path d="M53 45 Q59 43 65 45" fill="none" stroke="#1a1008" stroke-width="1.8" stroke-linecap="round" />
        <!-- Nose + mouth -->
        <path d="M47 57 L48 61 L49 57" fill="none" stroke="rgba(120,70,20,0.4)" stroke-width="1.1" stroke-linejoin="round" />
        <path d="M43 65 Q48 68 53 65" fill="none" stroke="#a07040" stroke-width="1.6" stroke-linecap="round" />
        <!-- Ice-blue katana glow accent (top-right corner detail) -->
        <g opacity="0.35" filter="url(#ptSft)">
            <line x1="76" y1="10" x2="84" y2="22" stroke="#7ec8e3" stroke-width="1.5" stroke-linecap="round" />
            <line x1="80" y1="8" x2="88" y2="20" stroke="#7ec8e3" stroke-width="0.8" stroke-linecap="round" opacity="0.5" />
        </g>
        <!-- Zanzo ghost hint (dim afterimage left side) -->
        <g opacity="0.12">
            <ellipse cx="12" cy="58" rx="6" ry="10" fill="#4a90d9" />
            <ellipse cx="12" cy="46" rx="4" ry="4" fill="#4a90d9" />
        </g>
        <!-- Bottom bar — ice blue theme -->
        <rect x="0" y="108" width="96" height="4" fill="rgba(126,200,227,0.2)" />
        <line x1="0" y1="108" x2="96" y2="108" stroke="rgba(126,200,227,0.6)" stroke-width="0.8" />
        <line x1="0" y1="108" x2="32" y2="108" stroke="rgba(126,200,227,0.85)" stroke-width="0.8" />
    </g>`
}

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

    // ── setupCharacterHUD ─────────────────────────────────────────────────────
    // Orchestrator: derives char flags once, delegates to focused sub-methods.
    // Called once on game start and on every character switch.
    static setupCharacterHUD(player) {
        const isPoom = player instanceof PoomPlayer;
        const charId = player.charId || (isPoom ? 'poom' : 'kao');
        const isKao = charId === 'kao';
        const isAuto = charId === 'auto' || (typeof AutoPlayer === 'function' && player instanceof AutoPlayer);
        const isPat = charId === 'pat' || (typeof PatPlayer === 'function' && player instanceof PatPlayer);
        const SN = (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.skillNames) ? GAME_TEXTS.skillNames : {};
        const hudBottom = document.querySelector('.hud-bottom');

        UIManager._hudApplyThemeAndLabel(isPoom, isKao, isAuto, isPat, hudBottom);
        UIManager._hudSetupAttackSlot(isPoom, isAuto, isPat);
        UIManager._hudSetupPortraitAndWeapon(isPoom, isAuto, isPat, player);
        UIManager._hudSetupPassiveSlot(isKao, isPat, player);
        UIManager._hudSetupSkill1Slot(isPoom, isKao, isAuto, isPat, SN);
        UIManager._hudSetupQSlot(isPoom, isKao, isAuto, isPat, SN, hudBottom);
        UIManager._hudSetupExclusiveESlots(isPoom, isKao, isAuto, isPat, SN, hudBottom);
        UIManager._hudSetupRitualAndMobileButtons(isPoom, isKao, isAuto, isPat, SN);
    }

    // ── Theme class + character name label on .hud-bottom ────────────────────
    static _hudApplyThemeAndLabel(isPoom, isKao, isAuto, isPat, hudBottomEl) {
        const _THEME_CLASSES = ['t-neutral', 't-blue', 't-emerald', 't-red', 't-gold'];
        const _applyTheme = (id, theme) => {
            const el = document.getElementById(id);
            if (!el) return;
            _THEME_CLASSES.forEach(c => el.classList.remove(c));
            el.classList.add(theme);
        };
        const charTheme = isAuto ? 't-red' : isPoom ? 't-emerald' : isPat ? 't-neutral' : 't-blue';
        _applyTheme('dash-icon', charTheme);
        _applyTheme('stealth-icon', charTheme);

        const weaponIndicator = document.querySelector('.weapon-indicator');
        if (weaponIndicator) weaponIndicator.style.display = (isPoom || isAuto) ? 'none' : '';

        if (!hudBottomEl) return;
        hudBottomEl.classList.remove('hud-theme-kao', 'hud-theme-poom', 'hud-theme-auto', 'hud-theme-pat');
        hudBottomEl.classList.add(
            isAuto ? 'hud-theme-auto' : isPoom ? 'hud-theme-poom' : isPat ? 'hud-theme-pat' : 'hud-theme-kao'
        );

        let charLabel = hudBottomEl.querySelector('.hud-char-label');
        if (!charLabel) {
            charLabel = document.createElement('div');
            charLabel.className = 'hud-char-label';
            hudBottomEl.prepend(charLabel);
        }
        const lc = isAuto
            ? { name: 'AUTO', tag: 'BRAWLER', color: '#fca5a5', glow: 'rgba(220,38,38,0.5)' }
            : isPoom
                ? { name: 'POOM', tag: 'SPIRITUAL', color: '#6ee7b7', glow: 'rgba(16,185,129,0.5)' }
                : isPat
                    ? { name: 'PAT', tag: 'RONIN', color: '#7ec8e3', glow: 'rgba(74,144,217,0.5)' }
                    : { name: 'KAO', tag: 'ASSASSIN', color: '#93c5fd', glow: 'rgba(59,130,246,0.5)' };
        charLabel.innerHTML =
            `<span class="hud-char-name" style="color:${lc.color};text-shadow:0 0 8px ${lc.glow};">${lc.name}</span>` +
            `<span class="hud-char-tag">${lc.tag}</span>`;
    }

    // ── Attack (SHOOT / L-Click) slot re-skin ─────────────────────────────────
    static _hudSetupAttackSlot(isPoom, isAuto, isPat) {
        const attackIcon = document.getElementById('attack-icon');
        if (!attackIcon) return;
        const _THEME_CLASSES = ['t-neutral', 't-blue', 't-emerald', 't-red', 't-gold'];
        _THEME_CLASSES.forEach(c => attackIcon.classList.remove(c));
        const emoji = document.getElementById('attack-emoji');
        const hint = document.getElementById('attack-hint');
        const name = document.getElementById('sn-attack');
        if (isPoom) {
            attackIcon.classList.add('t-emerald');
            if (emoji) emoji.textContent = '🍙';
            if (hint) { hint.style.background = '#064e3b'; hint.style.color = '#6ee7b7'; }
            if (name) { name.textContent = 'SHOOT'; name.style.color = '#6ee7b7'; }
        } else if (isAuto) {
            attackIcon.classList.add('t-red');
            if (emoji) emoji.textContent = '🔥';
            if (hint) { hint.style.background = '#7f1d1d'; hint.style.color = '#fca5a5'; }
            if (name) { name.textContent = 'SHOOT'; name.style.color = '#fca5a5'; }
        } else if (isPat) {
            attackIcon.classList.add('t-neutral');
            if (emoji) emoji.textContent = '⚔️';
            if (hint) { hint.style.background = '#0a1a2e'; hint.style.color = '#7ec8e3'; }
            if (name) { name.textContent = 'SLASH'; name.style.color = '#7ec8e3'; }
        } else {
            attackIcon.classList.add('t-blue');
            if (emoji) emoji.textContent = '🔫';
            if (hint) { hint.style.background = '#1e3a8a'; hint.style.color = '#bfdbfe'; }
            if (name) { name.textContent = 'SHOOT'; name.style.color = '#93c5fd'; }
        }
    }

    // ── Portrait SVG swap ─────────────────────────────────────────────────────
    static _hudSetupPortraitAndWeapon(isPoom, isAuto, isPat, player) {
        const hudSvg = document.getElementById('hud-portrait-svg');
        if (hudSvg) {
            const key = isPoom ? 'poom' : isAuto ? 'auto' : isPat ? 'pat' : 'kao';
            hudSvg.innerHTML = (window.PORTRAITS || {})[key] || '';
        }
    }

    // ── Passive skill slot visibility (Kao-only) ──────────────────────────────
    static _hudSetupPassiveSlot(isKao, isPat, player) {
        const el = document.getElementById('passive-skill');
        if (!el) return;
        if (isKao || isPat) {
            el.style.display = '';
            const skillName = el.querySelector('.skill-name');
            if (player.passiveUnlocked) {
                el.style.opacity = '1';
                el.classList.add('unlocked');
                if (skillName) {
                    skillName.textContent = isPat ? '⚔ EDGE' : 'MAX';
                    skillName.style.color = isPat ? '#7ec8e3' : '#facc15';
                }
            } else {
                el.style.opacity = '0.35';
                el.classList.remove('unlocked');
                if (skillName) {
                    skillName.textContent = isPat ? 'RONIN' : 'R-Click!';
                    skillName.style.color = isPat ? '#4a90d9' : '#a855f7';
                }
            }
        } else {
            el.style.display = 'none';
            el.classList.remove('unlocked');
        }
    }

    // ── Skill 1 (R-Click) slot — id swap + label per character ───────────────
    static _hudSetupSkill1Slot(isPoom, isKao, isAuto, isPat, SN) {
        const skill1El = document.getElementById('eat-icon') || document.getElementById('stealth-icon');
        if (!skill1El) return;
        const nameEl = skill1El.querySelector('.skill-name') || (() => {
            const d = document.createElement('div'); d.className = 'skill-name'; skill1El.appendChild(d); return d;
        })();
        const emojiEl = document.getElementById('skill1-emoji');
        const hintEl = document.getElementById('skill1-hint');
        const cdEl = skill1El.querySelector('.cooldown-mask');
        if (isPoom) {
            skill1El.id = 'eat-icon';
            if (emojiEl) emojiEl.textContent = '🍱';
            if (hintEl) hintEl.textContent = 'R-Click';
            if (cdEl) cdEl.id = 'eat-cd';
            nameEl.textContent = 'EAT RICE'; nameEl.style.color = '#6ee7b7';
        } else if (isAuto) {
            skill1El.id = 'stealth-icon';
            if (emojiEl) emojiEl.textContent = '💢';
            if (hintEl) hintEl.textContent = 'R-Click';
            if (cdEl) cdEl.id = 'stealth-cd';
            nameEl.textContent = 'WANCHAI'; nameEl.style.color = '#fca5a5';
        } else if (isKao) {
            skill1El.id = 'stealth-icon';
            if (emojiEl) emojiEl.textContent = '👻';
            if (hintEl) hintEl.textContent = 'R-Click';
            if (cdEl) cdEl.id = 'stealth-cd';
            nameEl.textContent = SN.kao?.skill1 ?? 'STEALTH'; nameEl.style.color = '#c4b5fd';
        } else if (isPat) {
            skill1El.id = 'pat-guard-icon';
            if (emojiEl) emojiEl.textContent = '🛡️';
            if (hintEl) { hintEl.textContent = 'R-Click'; hintEl.style.background = '#0a1a2e'; hintEl.style.color = '#7ec8e3'; }
            if (cdEl) cdEl.id = 'pat-guard-cd';
            nameEl.textContent = SN.pat?.skill1 ?? 'BLADE GUARD'; nameEl.style.color = '#7ec8e3';
        } else {
            skill1El.id = 'stealth-icon';
            if (emojiEl) emojiEl.textContent = '📖';
            if (hintEl) hintEl.textContent = 'R-Click';
            if (cdEl) cdEl.id = 'stealth-cd';
            nameEl.textContent = 'SKILL'; nameEl.style.color = '#fbbf24';
        }
    }

    // ── Q-slot: Naga (Poom) / Teleport (Kao) / Vacuum (Auto) / hidden ─────────
    // Handles id-swap and DOM restore when switching away from a char that
    // repurposed the slot.
    static _hudSetupQSlot(isPoom, isKao, isAuto, isPat, SN, hudBottom) {
        const nagaSlot = document.getElementById('naga-icon')
            || document.getElementById('teleport-icon')
            || document.getElementById('vacuum-icon')
            || document.getElementById('zanzo-icon');
        const baseSlot = nagaSlot;
        if (baseSlot) {
            if (isPoom) {
                baseSlot.style.display = 'flex';
                baseSlot.id = 'naga-icon';
                baseSlot.style.borderColor = '#10b981';
                baseSlot.style.boxShadow = '0 0 15px rgba(16,185,129,0.4)';
                const h = baseSlot.querySelector('.key-hint');
                if (h) { h.textContent = 'Q'; h.style.background = '#10b981'; }
                let n = baseSlot.querySelector('.skill-name');
                if (!n) { n = document.createElement('div'); n.className = 'skill-name'; baseSlot.appendChild(n); }
                n.textContent = SN.poom?.naga ?? 'NAGA'; n.style.color = '#6ee7b7';
            } else if (isKao) {
                baseSlot.style.display = 'flex';
                baseSlot.id = 'teleport-icon';
                baseSlot.style.borderColor = '#00e5ff';
                baseSlot.style.boxShadow = '0 0 15px rgba(0,229,255,0.45)';
                baseSlot.innerHTML = `
                    <div class="key-hint" id="teleport-hint" style="background:#00e5ff;color:#0c1a2e;">Q</div>
                    <span id="teleport-emoji">⚡</span>
                    <div class="skill-name" style="color:#67e8f9;">${SN.kao?.teleport ?? 'TELEPORT'}</div>
                    <div class="cooldown-mask" id="teleport-cd"></div>`;
            } else if (isAuto) {
                baseSlot.style.display = 'flex';
                baseSlot.id = 'vacuum-icon';
                baseSlot.style.borderColor = '#f97316';
                baseSlot.style.boxShadow = '0 0 15px rgba(249,115,22,0.45)';
                baseSlot.innerHTML = `
                    <div class="key-hint" id="vacuum-hint" style="background:#f97316;color:#1a0505;">Q</div>
                    <span id="vacuum-emoji">🌀</span>
                    <div class="skill-name" style="color:#fdba74;">${SN.auto?.vacuum ?? 'VACUUM'}</div>
                    <div class="cooldown-mask" id="vacuum-cd"></div>`;
            } else if (isPat) {
                baseSlot.style.display = 'flex';
                baseSlot.id = 'zanzo-icon';
                baseSlot.style.borderColor = '#4a90d9';
                baseSlot.style.boxShadow = '0 0 15px rgba(74,144,217,0.45)';
                baseSlot.innerHTML = `
                    <div class="key-hint" style="background:#4a90d9;color:#0a1020;">Q</div>
                    <span>💨</span>
                    <div class="skill-name" style="color:#7ec8e3;">${SN.pat?.zanzo ?? 'ZANZO'}</div>
                    <div class="cooldown-mask" id="zanzo-cd"></div>`;
            } else {
                baseSlot.style.display = 'none';
            }
        }

        // Restore base naga-icon when switching away from Kao/Auto/Pat
        if (!isKao && !isAuto && !isPat) {
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
            const maybeZanzo = document.getElementById('zanzo-icon');
            if (maybeZanzo) {
                maybeZanzo.id = 'naga-icon';
                maybeZanzo.style.borderColor = '#10b981';
                maybeZanzo.style.boxShadow = '0 0 15px rgba(16,185,129,0.4)';
                maybeZanzo.innerHTML = `
                    <div class="key-hint" style="background:#10b981;">Q</div>🐉
                    <div class="cooldown-mask" id="naga-cd"></div>
                    <span id="naga-timer"></span>
                    <div class="skill-name" style="color:#6ee7b7;">${SN.poom?.naga ?? 'NAGA'}</div>`;
            }
        }
    }

    // ── E-slot: exclusive dynamic slots injected per character ────────────────
    // Kao → kao-clone-icon,  Auto → auto-det-icon,  Poom → garuda-icon
    static _hudSetupExclusiveESlots(isPoom, isKao, isAuto, isPat, SN, hudBottom) {
        // ── Kao Clone (E) ───────────────────────────────────────────────────
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
                if (passiveRef && passiveRef.parentNode === hudBottom)
                    hudBottom.insertBefore(cloneSlot, passiveRef.nextSibling);
                else
                    hudBottom.appendChild(cloneSlot);
            }
            if (cloneSlot) cloneSlot.style.display = 'flex';
        } else {
            if (cloneSlot) cloneSlot.style.display = 'none';
        }

        // ── Auto Detonate (E) ───────────────────────────────────────────────
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

        // ── Poom Garuda (E) ─────────────────────────────────────────────────
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
                if (passiveRef && passiveRef.parentNode === hudBottom)
                    hudBottom.insertBefore(garudaSlot, passiveRef.nextSibling);
                else
                    hudBottom.appendChild(garudaSlot);
            }
            if (garudaSlot) garudaSlot.style.display = 'flex';
        } else {
            if (garudaSlot) garudaSlot.style.display = 'none';
        }

        // ── Pat Iaido Strike (R) ────────────────────────────────────────────
        let iaidoSlot = document.getElementById('pat-iaido-icon');
        if (isPat) {
            if (!iaidoSlot && hudBottom) {
                iaidoSlot = document.createElement('div');
                iaidoSlot.className = 'skill-icon';
                iaidoSlot.id = 'pat-iaido-icon';
                iaidoSlot.style.cssText = 'border-color:#7ec8e3; box-shadow:0 0 15px rgba(126,200,227,0.45);';
                iaidoSlot.innerHTML = `
                    <div class="key-hint" style="background:#4a90d9;color:#0a1020;">R</div>
                    <span>⚔️</span>
                    <div class="skill-name" style="color:#7ec8e3;font-size:9px;letter-spacing:0.02em;">${SN.pat?.iaido ?? 'IAIDO'}</div>
                    <div class="cooldown-mask" id="pat-iaido-cd"></div>`;
                const passiveRef = document.getElementById('passive-skill');
                if (passiveRef && passiveRef.parentNode === hudBottom)
                    hudBottom.insertBefore(iaidoSlot, passiveRef.nextSibling);
                else
                    hudBottom.appendChild(iaidoSlot);
            }
            if (iaidoSlot) iaidoSlot.style.display = 'flex';
        } else {
            if (iaidoSlot) iaidoSlot.style.display = 'none';
        }
    }

    // ── Ritual slot (Poom R) + mobile button labels ───────────────────────────
    static _hudSetupRitualAndMobileButtons(isPoom, isKao, isAuto, isPat, SN) {
        const ritualSlot = document.getElementById('ritual-icon');
        if (ritualSlot) {
            ritualSlot.style.display = isPoom ? 'flex' : 'none';
            if (isPoom) {
                let n = ritualSlot.querySelector('.skill-name');
                if (!n) { n = document.createElement('div'); n.className = 'skill-name'; ritualSlot.appendChild(n); }
                n.textContent = SN.poom?.ritual ?? 'RITUAL'; n.style.color = '#86efac';
            }
        }
        const btnNaga = document.getElementById('btn-naga');
        if (btnNaga) btnNaga.style.display = (isPoom || isKao) ? 'flex' : 'none';
        const btnSkill = document.getElementById('btn-skill');
        if (btnSkill) btnSkill.textContent = isPoom ? '🍚' : isAuto ? '🔥' : isKao ? '👻' : isPat ? '⚔️' : '📖';
    }

    // ── updateSkillIcons ──────────────────────────────────────────────────────
    // Orchestrator: dispatches to per-character cooldown updaters every frame.
    static updateSkillIcons(player) {
        // Shared helper — create/remove lock overlay on a skill icon
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
            UIManager._updateIconsPoom(player, setLockOverlay);
        } else if (typeof AutoPlayer !== 'undefined' && player instanceof AutoPlayer) {
            UIManager._updateIconsAuto(player, setLockOverlay);
        } else if (typeof PatPlayer !== 'undefined' && player instanceof PatPlayer) {
            UIManager._updateIconsPat(player, setLockOverlay);
        } else if (player.charId === 'kao') {
            UIManager._updateIconsKao(player, setLockOverlay);
        }
    }

    // ── Pat: zanzo / blade-guard / iaido cooldown arcs ───────────────────────
    static _updateIconsPat(player, setLockOverlay) {
        const S = (typeof BALANCE !== 'undefined' && BALANCE.characters?.pat) ? BALANCE.characters.pat : {};

        // Blade Guard (R-Click) — no cooldown, just active highlight
        const guardIcon = document.getElementById('pat-guard-icon');
        if (guardIcon) {
            const isActive = !!player.bladeGuardActive;
            guardIcon.classList.toggle('active', isActive);
            guardIcon.style.borderColor = isActive ? '#7ec8e3' : '';
            guardIcon.style.boxShadow = isActive ? '0 0 20px rgba(126,200,227,0.85)' : '';
            const nameEl = guardIcon.querySelector('.skill-name');
            if (nameEl) {
                nameEl.textContent = isActive ? 'ACTIVE' : (
                    (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.skillNames?.pat?.skill1) ?? 'BLADE GUARD'
                );
                nameEl.style.color = isActive ? '#ffffff' : '#7ec8e3';
            }
        }

        // Zanzo Flash (Q) cooldown arc
        const zanzoIcon = document.getElementById('zanzo-icon');
        if (zanzoIcon) {
            const cd = Math.max(0, player.skills?.zanzo?.cd ?? 0);
            const maxCd = S.zanzoCooldown ?? 7;
            zanzoIcon.classList.toggle('active', cd <= 0);
            UIManager._setCooldownVisual('zanzo-icon', cd, maxCd);
        }

        // Iaido Strike (R) — shows charge progress during _iaidoPhase==='charge'
        const iaidoIcon = document.getElementById('pat-iaido-icon');
        if (iaidoIcon) {
            const phase = player._iaidoPhase ?? 'none';
            const isCharging = phase === 'charge';
            const isCinematic = phase === 'cinematic' || phase === 'flash';
            const cd = Math.max(0, player.skills?.iaido?.cd ?? 0);
            const maxCd = S.iaidoCooldown ?? 14;

            if (isCharging) {
                // Show charge fill progress (replaces cooldown arc during charge)
                iaidoIcon.classList.add('active');
                iaidoIcon.style.borderColor = '#7ec8e3';
                iaidoIcon.style.boxShadow = '0 0 22px rgba(126,200,227,0.90)';
                const chargeTimer = player._iaidoTimer ?? 0;
                const chargeDur = S.iaidoChargeDuration ?? 0.6;
                const chargeProgress = Math.min(1, chargeTimer / chargeDur);
                // Abuse _setCooldownVisual: pass remaining time as (1-progress)*max
                UIManager._setCooldownVisual('pat-iaido-icon', (1 - chargeProgress) * 0.6, 0.6);
                const nameEl = iaidoIcon.querySelector('.skill-name');
                if (nameEl) { nameEl.textContent = 'CHARGING'; nameEl.style.color = '#ffffff'; }
            } else if (isCinematic) {
                iaidoIcon.classList.add('active');
                iaidoIcon.style.borderColor = '#ff4444';
                iaidoIcon.style.boxShadow = '0 0 22px rgba(204,34,34,0.85)';
                const nameEl = iaidoIcon.querySelector('.skill-name');
                if (nameEl) { nameEl.textContent = 'IAIDO!'; nameEl.style.color = '#ff6666'; }
            } else {
                iaidoIcon.classList.toggle('active', cd <= 0);
                iaidoIcon.style.borderColor = '';
                iaidoIcon.style.boxShadow = '';
                UIManager._setCooldownVisual('pat-iaido-icon', cd, maxCd);
                const nameEl = iaidoIcon.querySelector('.skill-name');
                if (nameEl) {
                    nameEl.textContent = (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS.skillNames?.pat?.iaido) ?? 'IAIDO';
                    nameEl.style.color = '#7ec8e3';
                }
            }
        }

        // Passive — Ronin's Edge unlock state
        const passiveEl = document.getElementById('passive-skill');
        if (passiveEl) {
            const unlocked = !!player.passiveUnlocked;
            passiveEl.style.opacity = unlocked ? '1' : '0.35';
            const skillName = passiveEl.querySelector('.skill-name');
            if (skillName) {
                skillName.textContent = unlocked ? '⚔ EDGE' : 'RONIN';
                skillName.style.color = unlocked ? '#7ec8e3' : '#4a90d9';
            }
        }
    }

    // ── Poom: eat / naga / ritual / garuda cooldown arcs ─────────────────────
    static _updateIconsPoom(player, setLockOverlay) {
        const S = BALANCE.characters.poom;
        const nagaReady = !!(player._nagaUnlocked);

        setLockOverlay(document.getElementById('eat-icon'), false);
        setLockOverlay(document.getElementById('naga-icon'), !nagaReady);
        setLockOverlay(document.getElementById('ritual-icon'), !nagaReady);
        setLockOverlay(document.getElementById('garuda-icon'), !player.passiveUnlocked);

        // Eat Rice
        const eatIcon = document.getElementById('eat-icon');
        if (eatIcon) eatIcon.classList.toggle('active', !!player.isEatingRice);
        UIManager._setCooldownVisual('eat-icon',
            player.isEatingRice ? 0 : Math.max(0, player.cooldowns.eat),
            S.eatRiceCooldown);

        // Naga
        const nagaIcon = document.getElementById('naga-icon');
        const nagaTimer = document.getElementById('naga-timer');
        if (nagaIcon) nagaIcon.classList.toggle('active', player.cooldowns.naga <= 0);
        if (nagaTimer) nagaTimer.style.display = 'none';
        UIManager._setCooldownVisual('naga-icon', Math.max(0, player.cooldowns.naga), S.nagaCooldown);

        // Ritual
        const ritualIcon = document.getElementById('ritual-icon');
        const ritualTimer = document.getElementById('ritual-timer');
        const maxRitualCd = GAME_CONFIG?.abilities?.ritual?.cooldown || 20;
        if (ritualIcon) ritualIcon.classList.toggle('active', player.cooldowns.ritual <= 0);
        if (ritualTimer) ritualTimer.style.display = 'none';
        UIManager._setCooldownVisual('ritual-icon', Math.max(0, player.cooldowns.ritual), maxRitualCd);

        // Garuda
        const garudaIcon = document.getElementById('garuda-icon');
        if (garudaIcon) garudaIcon.classList.toggle('active', player.cooldowns.garuda <= 0);
        UIManager._setCooldownVisual('garuda-icon',
            Math.max(0, player.cooldowns.garuda),
            BALANCE.characters.poom.garudaCooldown ?? 24);
    }

    // ── Auto: wanchai / vacuum / detonation cooldown arcs ────────────────────
    static _updateIconsAuto(player, setLockOverlay) {
        const S = BALANCE.characters.auto;

        setLockOverlay(document.getElementById('stealth-icon'), false);
        setLockOverlay(document.getElementById('vacuum-icon'), !player.passiveUnlocked);
        setLockOverlay(document.getElementById('auto-det-icon'), !player.passiveUnlocked);

        // Wanchai Stand cooldown + live timer label
        const wanchaiCd = S.wanchaiCooldown ?? 12;
        UIManager._setCooldownVisual('stealth-icon',
            player.wanchaiActive ? 0 : Math.max(0, player.cooldowns.wanchai ?? 0),
            wanchaiCd);
        const stealthIcon = document.getElementById('stealth-icon');
        if (stealthIcon) {
            const nameEl = stealthIcon.querySelector('.skill-name');
            if (nameEl) {
                if (player.wanchaiActive && player.wanchaiTimer > 0) {
                    nameEl.textContent = player.wanchaiTimer.toFixed(1) + 's';
                    nameEl.style.color = '#fca5a5';
                } else {
                    nameEl.textContent = 'WANCHAI';
                    nameEl.style.color = '#fca5a5';
                }
            }
        }

        // Vacuum — dynamic max CD depending on Wanchai state
        const vacMaxCd = player.wanchaiActive ? (S.standPullCooldown ?? 10) : (S.vacuumCooldown ?? 6);
        UIManager._setCooldownVisual('vacuum-icon', Math.max(0, player.cooldowns.vacuum ?? 0), vacMaxCd);

        // Detonation — visual lock while Wanchai is not active
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
        UIManager._setCooldownVisual('auto-det-icon',
            Math.max(0, player.cooldowns.detonation ?? 0),
            S.detonationCooldown ?? 8);
    }

    // ── Kao: teleport charges / clone cooldown arc ────────────────────────────
    static _updateIconsKao(player, setLockOverlay) {
        const S = BALANCE.characters.kao;
        const passive = player.passiveUnlocked;

        // Teleport (Q) — charge-based with per-charge arc
        const teleportIcon = document.getElementById('teleport-icon');
        setLockOverlay(teleportIcon, !passive);
        if (teleportIcon && passive) {
            const charges = player.teleportCharges || 0;
            const maxCharges = player.maxTeleportCharges || 3;
            const isFull = charges >= maxCharges;
            teleportIcon.classList.toggle('active', charges > 0);

            if (!isFull && player.teleportTimers && player.teleportTimers.length > 0) {
                const best = player.teleportTimers.reduce(
                    (b, t) => t.elapsed > b.elapsed ? t : b,
                    player.teleportTimers[0]
                );
                const remaining = Math.max(0, best.max - best.elapsed);
                if (charges > 0) {
                    // Has charges remaining: show light arc only, hide number
                    let arc = teleportIcon.querySelector('.cd-arc-overlay');
                    if (!arc) { arc = document.createElement('div'); arc.className = 'cd-arc-overlay'; teleportIcon.appendChild(arc); }
                    const elapsed = best.max > 0 ? Math.min(1, 1 - remaining / best.max) : 1;
                    const p = (elapsed * 100).toFixed(1);
                    arc.style.background = remaining > 0.05
                        ? `conic-gradient(transparent 0% ${p}%, rgba(0,0,0,0.62) ${p}% 100%)`
                        : 'transparent';
                    let tmr = teleportIcon.querySelector('.cd-timer-text');
                    if (!tmr) { tmr = document.createElement('div'); tmr.className = 'cd-timer-text'; teleportIcon.appendChild(tmr); }
                    tmr.style.display = 'none';
                } else {
                    // No charges: full arc + countdown number
                    UIManager._setCooldownVisual('teleport-icon', remaining, best.max);
                }
            } else {
                UIManager._setCooldownVisual('teleport-icon', 0, 1);
            }

            // Charge count badge
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

        // Clone of Stealth (E)
        const cloneIcon = document.getElementById('kao-clone-icon');
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
            UIManager._setCooldownVisual(
                'kao-clone-icon',
                passive ? Math.max(0, player.cloneSkillCooldown) : 0,
                player.maxCloneCooldown);
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
    // ── drawMinimap ───────────────────────────────────────────────────────────
    // Orchestrator — shared constants then 3 focused drawing phases:
    //   _minimapDrawShell    outer glow, border, fill
    //   _minimapDrawContent  grid, sweep, entities (or fog blackout)
    //   _minimapDrawLabel    label text + legend row (outside clip)
    static drawMinimap(ctx) {
        if (!ctx || !ctx.canvas) return;

        if (!UIManager._minimapFrame) UIManager._minimapFrame = 0;
        UIManager._minimapFrame++;

        const canvas = ctx.canvas;
        const radarRadius = 60;
        const scale = 0.1;
        const cx = canvas.width - 200;   // 200 px from right edge
        const cy = 90;                    // 90 px from top edge
        const now = Date.now();
        const player = (typeof window !== 'undefined' && window.player)
            ? window.player : { x: 0, y: 0 };

        // world→radar-screen, clamped to maxR from radar center
        const toRadar = (wx, wy, maxR = radarRadius - 6) => {
            const rx = cx + (wx - player.x) * scale;
            const ry = cy + (wy - player.y) * scale;
            const dx = rx - cx, dy = ry - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= maxR) return { x: rx, y: ry, clamped: false };
            return { x: cx + dx * (maxR / d), y: cy + dy * (maxR / d), clamped: true };
        };

        // OUTER SAVE — resets blendmode/alpha/shadow leakage from mapSystem
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        CanvasHUD._minimapDrawShell(ctx, cx, cy, radarRadius, now);

        // INNER SAVE — establishes circular clip region
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius - 1, 0, Math.PI * 2); ctx.clip();

        CanvasHUD._minimapDrawContent(ctx, cx, cy, radarRadius, now, player, toRadar);

        ctx.restore();  // ← INNER restore — releases clip

        CanvasHUD._minimapDrawLabel(ctx, cx, cy, radarRadius);

        ctx.restore();  // ← OUTER restore
    }

    // ── Shell: outer glow, navy fill, pulsating border, inner accent ring ────
    static _minimapDrawShell(ctx, cx, cy, radarRadius, now) {
        // Subtle outer glow halo
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(57,255,20,0.07)'; ctx.fill();

        // Main deep-navy fill — high-contrast background
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'; ctx.fill();

        // Pulsating neon-green border — width oscillates 1 px → 3 px
        const borderSin = Math.sin(now / 500);
        const borderWidth = 2 + borderSin;
        ctx.lineWidth = borderWidth;
        ctx.globalAlpha = 0.80 + borderSin * 0.15;
        ctx.strokeStyle = '#39ff14';
        ctx.shadowBlur = 12 + borderSin * 6;
        ctx.shadowColor = '#39ff14';
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Inner accent ring
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = 'rgba(134,239,172,0.28)';
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius - 3, 0, Math.PI * 2); ctx.stroke();
    }

    // ── Content: grid, sweep, poi markers, enemies, boss, player dot ─────────
    // Rendered inside the circular clip — nothing escapes the radar circle.
    static _minimapDrawContent(ctx, cx, cy, radarRadius, now, player, toRadar) {
        if (window.isFogWave) {
            // ── RADAR BLACKOUT during Fog Waves ──────────────────────────────
            ctx.fillStyle = 'rgba(6, 30, 50, 0.95)';
            ctx.fillRect(cx - radarRadius, cy - radarRadius, radarRadius * 2, radarRadius * 2);

            const noiseNow = Date.now();
            for (let n = 0; n < 6; n++) {
                const seed = Math.floor(noiseNow / 80) + n * 7919;
                const nyOff = ((seed * 1664525 + 1013904223) & 0x7fffffff) % (radarRadius * 2);
                const ny = cy - radarRadius + nyOff;
                const nalpha = 0.12 + (((seed * 6364136) & 0xff) / 255) * 0.25;
                const nw = 0.6 + (((seed * 22695477) & 0xff) / 255) * 1.4;
                ctx.save();
                ctx.globalAlpha = nalpha;
                ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = nw;
                ctx.beginPath();
                ctx.moveTo(cx - radarRadius, ny); ctx.lineTo(cx + radarRadius, ny);
                ctx.stroke();
                ctx.restore();
            }

            const slPulse = 0.65 + Math.sin(noiseNow / 350) * 0.35;
            ctx.save();
            ctx.globalAlpha = slPulse;
            ctx.shadowBlur = 14; ctx.shadowColor = '#06b6d4';
            ctx.fillStyle = '#06b6d4';
            ctx.font = 'bold 10px "Orbitron", Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('SIGNAL', cx, cy - 7);
            ctx.fillText('LOST', cx, cy + 7);
            ctx.restore();
            return;
        }

        // ── Interior grid ──────────────────────────────────────────────
        ctx.lineWidth = 0.7;
        [radarRadius * 0.33, radarRadius * 0.66].forEach(r => {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(57,255,20,0.14)'; ctx.stroke();
        });
        ctx.strokeStyle = 'rgba(57,255,20,0.20)'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx - radarRadius + 2, cy); ctx.lineTo(cx + radarRadius - 2, cy);
        ctx.moveTo(cx, cy - radarRadius + 2); ctx.lineTo(cx, cy + radarRadius - 2);
        ctx.stroke();

        // ── Sweep line animation ───────────────────────────────────────
        const SWEEP_RPM = 1 / 3;
        const sweepAngle = ((now / 1000) * SWEEP_RPM * Math.PI * 2) % (Math.PI * 2);
        const trailArc = Math.PI * 2 / 3;
        const TRAIL_STEPS = 24;
        // ── PERF: solid color set once — globalAlpha per step, no toFixed alloc ──
        ctx.fillStyle = 'rgb(72,187,120)';
        for (let i = 0; i < TRAIL_STEPS; i++) {
            const frac = i / TRAIL_STEPS;
            const aStart = sweepAngle - trailArc * (1 - frac);
            const aEnd = sweepAngle - trailArc * (1 - frac - 1 / TRAIL_STEPS);
            ctx.globalAlpha = frac * frac * 0.22;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, radarRadius - 1, aStart, aEnd);
            ctx.closePath();
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.strokeStyle = 'rgba(134,239,172,0.85)'; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6; ctx.shadowColor = '#48bb78';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(sweepAngle) * (radarRadius - 1),
            cy + Math.sin(sweepAngle) * (radarRadius - 1));
        ctx.stroke();
        ctx.restore();

        // ── POI: Database Server — bright blue ─────────────────────────
        if (window.MTC_DATABASE_SERVER) {
            const S = window.MTC_DATABASE_SERVER;
            const { x: sx, y: sy, clamped: sc } = toRadar(S.x, S.y, radarRadius - 8);
            const dbPulse = 0.65 + Math.sin(now / 550) * 0.35;
            const SZ = sc ? 3.5 : 5;
            ctx.save(); ctx.translate(sx, sy);
            ctx.shadowBlur = 10 * dbPulse; ctx.shadowColor = '#60a5fa';
            if (sc) {
                const ax = cx - sx, ay = cy - sy;
                ctx.rotate(Math.atan2(ay, ax));
                ctx.globalAlpha = 0.8 + dbPulse * 0.2;
                ctx.fillStyle = '#3b82f6';
                ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
            } else {
                ctx.globalAlpha = 0.85 + dbPulse * 0.15;
                ctx.fillStyle = '#3b82f6';
                ctx.fillRect(-SZ, -SZ, SZ * 2, SZ * 2);
                ctx.globalAlpha = dbPulse * 0.95;
                ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1.2;
                ctx.strokeRect(-SZ, -SZ, SZ * 2, SZ * 2);
            }
            ctx.restore();
        }

        // ── POI: Shop — gold ──────────────────────────────────────────
        if (window.MTC_SHOP_LOCATION) {
            const SH = window.MTC_SHOP_LOCATION;
            const { x: shx, y: shy, clamped: shc } = toRadar(SH.x, SH.y, radarRadius - 8);
            const shPulse = 0.65 + Math.sin(now / 700 + 1.2) * 0.35;
            const SZ = shc ? 3.5 : 4.5;
            ctx.save(); ctx.translate(shx, shy);
            ctx.shadowBlur = 7 * shPulse; ctx.shadowColor = '#f59e0b';
            if (shc) {
                const ax = cx - shx, ay = cy - shy;
                ctx.rotate(Math.atan2(ay, ax));
                ctx.globalAlpha = 0.7 + shPulse * 0.3;
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
            } else {
                ctx.globalAlpha = 0.7 + shPulse * 0.25;
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(-SZ, -SZ, SZ * 2, SZ * 2);
                ctx.globalAlpha = shPulse * 0.85;
                ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 1.2;
                ctx.strokeRect(-SZ, -SZ, SZ * 2, SZ * 2);
            }
            ctx.restore();
        }

        // ── Enemies — distinct shapes per type ────────────────────────
        if (Array.isArray(window.enemies)) {
            for (const e of window.enemies) {
                if (!e || e.dead) continue;
                const { x: ex, y: ey, clamped: ec } = toRadar(e.x, e.y);
                ctx.save();
                if (ec) {
                    ctx.translate(ex, ey);
                    ctx.rotate(Math.atan2(cy - ey, cx - ex));
                    const arrowColor = e.type === 'mage'
                        ? 'rgba(180,80,255,0.9)'
                        : (e.type === 'tank' ? 'rgba(255,120,40,0.9)' : 'rgba(255,50,50,0.9)');
                    ctx.fillStyle = arrowColor; ctx.shadowBlur = 5; ctx.shadowColor = arrowColor;
                    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(0, -3.5); ctx.lineTo(0, 3.5);
                    ctx.closePath(); ctx.fill();
                } else if (e.type === 'mage') {
                    ctx.translate(ex, ey); ctx.rotate(now / 800);
                    const r = 6;
                    ctx.fillStyle = 'rgba(190,75,255,1.0)'; ctx.strokeStyle = 'rgba(220,160,255,0.9)';
                    ctx.lineWidth = 1.2; ctx.shadowBlur = 8; ctx.shadowColor = '#b44dff';
                    ctx.beginPath();
                    ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.6, 0);
                    ctx.closePath(); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = 'rgba(240,200,255,0.85)'; ctx.shadowBlur = 4;
                    ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();
                } else if (e.type === 'tank') {
                    const r = 5.5;
                    ctx.fillStyle = 'rgba(255,115,35,1.0)'; ctx.strokeStyle = 'rgba(255,185,90,0.9)';
                    ctx.lineWidth = 1.4; ctx.shadowBlur = 7; ctx.shadowColor = '#ff7320';
                    ctx.beginPath(); ctx.rect(ex - r, ey - r, r * 2, r * 2); ctx.fill(); ctx.stroke();
                    ctx.strokeStyle = 'rgba(255,220,120,0.75)'; ctx.lineWidth = 1; ctx.shadowBlur = 0;
                    const tk = 2.5;
                    [[ex - r, ey - r], [ex + r, ey - r], [ex - r, ey + r], [ex + r, ey + r]].forEach(([px, py]) => {
                        ctx.beginPath(); ctx.arc(px, py, tk, 0, Math.PI * 2); ctx.stroke();
                    });
                } else {
                    const r = 5;
                    const glow = 0.6 + Math.sin(now / 400 + e.x) * 0.4;
                    ctx.fillStyle = 'rgba(255,38,38,1.0)'; ctx.shadowBlur = 8 * glow; ctx.shadowColor = '#ff2222';
                    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = 'rgba(255,180,180,0.75)'; ctx.shadowBlur = 0;
                    ctx.beginPath(); ctx.arc(ex - 1.5, ey - 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
                }
                ctx.restore();
            }
        }

        // ── Boss — 6 px pulsating purple dot ──────────────────────────
        if (window.boss && !window.boss.dead) {
            const t = (now % 1000) / 1000;
            const pulse = 0.5 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.8;
            const { x: bx, y: by, clamped: bc } = toRadar(window.boss.x, window.boss.y, radarRadius - 10);
            ctx.save();
            ctx.shadowBlur = 14 * pulse; ctx.shadowColor = '#a855f7';
            if (bc) {
                ctx.translate(bx, by);
                ctx.rotate(Math.atan2(cy - by, cx - bx));
                ctx.globalAlpha = 0.7 + pulse * 0.3;
                ctx.fillStyle = '#a855f7';
                ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, -5); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();
            } else {
                ctx.globalAlpha = 0.75 + 0.25 * pulse;
                ctx.fillStyle = '#aa6eff';
                ctx.beginPath(); ctx.arc(bx, by, 6 * pulse, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 0.30 + 0.15 * pulse;
                ctx.strokeStyle = '#d8b4fe'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(bx, by, 10 + 3 * pulse, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 0.75 + 0.25 * pulse;
                ctx.fillStyle = '#ffdcff';
                ctx.font = 'bold 6px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
                ctx.fillText('BOSS', bx, by - 12 - 2 * pulse);
            }
            ctx.restore();
        }

        // ── Player — green triangle at radar center ────────────────────
        ctx.save();
        ctx.translate(cx, cy);
        if (player.angle !== undefined) ctx.rotate(player.angle + Math.PI / 2);
        ctx.shadowBlur = 8; ctx.shadowColor = '#34d399';
        ctx.fillStyle = 'rgba(52,214,88,0.98)';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(0, -5, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    // ── Label + legend strip (rendered outside clip, below radar circle) ──────
    static _minimapDrawLabel(ctx, cx, cy, radarRadius) {
        ctx.shadowBlur = 0;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.font = 'bold 8px Orbitron, monospace';
        ctx.fillStyle = 'rgba(72,187,120,0.70)';
        ctx.fillText(GAME_TEXTS.ui.minimapTitle, cx, cy + radarRadius + 5);

        // Tiny legend row: colored symbols matching blip types
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
            ctx.fillStyle = col; ctx.shadowBlur = 3; ctx.shadowColor = col;
            if (shape === 'diamond') {
                ctx.beginPath();
                ctx.moveTo(lx, ly - 3.5); ctx.lineTo(lx + 3, ly); ctx.lineTo(lx, ly + 3.5); ctx.lineTo(lx - 3, ly);
                ctx.closePath(); ctx.fill();
            } else if (shape === 'square') {
                ctx.fillRect(lx - 3, ly - 3, 6, 6);
            } else {
                ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
            ctx.font = '6px monospace'; ctx.fillStyle = 'rgba(203,213,225,0.65)';
            ctx.fillText(label, lx, ly + 9);
        });
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