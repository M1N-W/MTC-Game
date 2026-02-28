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
        this.unlocked = new Set();
        this.stats = {
            kills: 0, damageTaken: 0, crits: 0,
            dashes: 0, stealths: 0, powerups: 0,
            shopPurchases: 0,
            parries: 0,              // FIX: tracks successful PorkSandwich parries
            droneOverdrives: 0,      // FIX: tracks first drone overdrive activation
            weaponsUsed: new Set(),
            slowMoKills: 0,
            barrelKills: 0,
            wanchaiKills: 0,
            ritualKills: 0
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
            case 'stand_rush_kill': unlock = this.stats.wanchaiKills >= 10; break;
            case 'ritual_wipe': unlock = !!this._ritualWipeUnlocked; break;
        }
        if (unlock) this.unlock(ach);
    }

    unlock(ach, retryCount = 0) {
        const MAX_RETRIES = 3;

        // ── Mark as unlocked only on first attempt ───────────────
        if (retryCount === 0) {
            this.unlocked.add(ach.id);
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

        Object.values(SHOP_ITEMS).forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.id = `shop-card-${item.id}`;
            const durationHtml = item.duration
                ? `<span class="shop-duration">⏱ ${item.duration}s</span>`
                : `<span class="shop-duration" style="color:#22c55e;">⚡ ทันที</span>`;

            card.innerHTML = `
                <div class="shop-card-icon" style="color:${item.color};">${item.icon}</div>
                <div class="shop-card-name">${item.name}</div>
                <div class="shop-card-desc">${item.desc}</div>
                ${durationHtml}
                <div class="shop-card-cost">
                    <span class="shop-cost-icon">🏆</span>
                    <span class="shop-cost-value" id="shop-cost-${item.id}">${item.cost.toLocaleString()}</span>
                </div>
                <button
                    class="shop-buy-btn"
                    id="shop-btn-${item.id}"
                    onclick="buyItem('${item.id}')"
                    ontouchstart="event.preventDefault(); buyItem('${item.id}');"
                    style="border-color:${item.color}; --shop-btn-color:${item.color};"
                >
                    BUY
                </button>
            `;
            container.appendChild(card);
        });
        ShopManager.updateButtons();
    }

    static updateButtons() {
        const currentScore = typeof getScore === 'function' ? getScore() : 0;
        const player = window.player;

        // FIX (WARN-4): Add null check for player
        if (!player) return;

        const scoreDisplay = document.getElementById('shop-score-display');
        if (scoreDisplay) scoreDisplay.textContent = currentScore.toLocaleString();

        Object.values(SHOP_ITEMS).forEach(item => {
            const btn = document.getElementById(`shop-btn-${item.id}`);
            const card = document.getElementById(`shop-card-${item.id}`);
            if (!btn || !card) return;

            const canAfford = currentScore >= item.cost;
            btn.disabled = !canAfford;
            card.classList.toggle('shop-card-disabled', !canAfford);

            // ── Dynamic description element (created once, reused) ──
            let descEl = card.querySelector('.shop-card-desc');

            if (player && item.duration) {
                const isActive =
                    (item.id === 'damageUp' && player.shopDamageBoostActive) ||
                    (item.id === 'speedUp' && player.shopSpeedBoostActive);
                card.classList.toggle('shop-card-active', isActive);

                let timerEl = card.querySelector('.shop-buff-timer');
                if (isActive) {
                    const remaining = item.id === 'damageUp'
                        ? Math.ceil(player.shopDamageBoostTimer)
                        : Math.ceil(player.shopSpeedBoostTimer);
                    if (!timerEl) {
                        timerEl = document.createElement('div');
                        timerEl.className = 'shop-buff-timer';
                        card.appendChild(timerEl);
                    }
                    timerEl.textContent = `✅ ACTIVE — ${remaining}s`;
                } else if (timerEl) {
                    timerEl.remove();
                }

                // ── Max-stack warning on description ─────────────────
                // Check if the relevant buff is active and at the 1.5× cap.
                let atCap = false;
                if (isActive) {
                    if (item.id === 'damageUp' && player._baseDamageBoost) {
                        const cap = Math.round(player._baseDamageBoost * 1.5 * 100) / 100;
                        const current = Math.round((player.damageBoost || 1) * 100) / 100;
                        atCap = current >= cap;
                    } else if (item.id === 'speedUp' && player._baseMoveSpeed) {
                        const cap = Math.round(player._baseMoveSpeed * 1.5 * 100) / 100;
                        const current = Math.round((player.moveSpeed || 0) * 100) / 100;
                        atCap = current >= cap;
                    }
                }

                // Inject or remove the warning span inside the desc element.
                if (descEl) {
                    let warnSpan = descEl.querySelector('.shop-max-warn');
                    if (atCap) {
                        if (!warnSpan) {
                            warnSpan = document.createElement('span');
                            warnSpan.className = 'shop-max-warn';
                            warnSpan.style.cssText = 'display:block; color:#ef4444; font-size:0.8em; margin-top:3px;';
                            descEl.appendChild(warnSpan);
                        }
                        warnSpan.textContent = '⚠️ MAX STACKS! Buying reduces duration!';
                    } else if (warnSpan) {
                        warnSpan.remove();
                    }
                }
            }

            // ── Shield: show "ACTIVE" state when player has one ──────
            if (item.id === 'shield' && player) {
                card.classList.toggle('shop-card-active', !!player.hasShield);
                let shieldTimerEl = card.querySelector('.shop-buff-timer');
                if (player.hasShield) {
                    if (!shieldTimerEl) {
                        shieldTimerEl = document.createElement('div');
                        shieldTimerEl.className = 'shop-buff-timer';
                        card.appendChild(shieldTimerEl);
                    }
                    shieldTimerEl.textContent = '🛡️ SHIELD READY';
                } else if (shieldTimerEl) {
                    shieldTimerEl.remove();
                }
                // Warn if they already have a shield (buying again wastes score)
                if (descEl) {
                    let warnSpan = descEl.querySelector('.shop-max-warn');
                    if (player.hasShield) {
                        if (!warnSpan) {
                            warnSpan = document.createElement('span');
                            warnSpan.className = 'shop-max-warn';
                            warnSpan.style.cssText = 'display:block; color:#ef4444; font-size:0.8em; margin-top:3px;';
                            descEl.appendChild(warnSpan);
                        }
                        warnSpan.textContent = '⚠️ โล่ยังใช้งานอยู่! ซื้อซ้ำจะคืนเงิน';
                    } else if (warnSpan) {
                        warnSpan.remove();
                    }
                }
            }
        });
    }

    static tick() { ShopManager.updateButtons(); }
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
                border-radius: 50%;
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

    static showVoiceBubble(text, x, y) {
        const bubble = document.getElementById('voice-bubble');
        if (!bubble) return;
        const screen = worldToScreen(x, y - 40);
        bubble.textContent = text;
        bubble.style.left = screen.x + 'px';
        bubble.style.top = screen.y + 'px';
        bubble.classList.add('visible');
        setTimeout(() => bubble.classList.remove('visible'), 1500);
    }

    static updateBossHUD(boss) {
        const hud = document.getElementById('boss-hud');
        const hpBar = document.getElementById('boss-hp-bar');
        if (!hud) return;
        if (boss && !boss.dead) {
            hud.classList.add('active');
            if (hpBar) hpBar.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
        } else {
            hud.classList.remove('active');
        }
    }

    static updateBossSpeech(boss) {
        const speech = document.getElementById('boss-speech');
        if (!speech || !boss) return;
        if (speech.classList.contains('visible')) {
            const screen = worldToScreen(boss.x, boss.y - 80);
            speech.style.left = screen.x + 'px';
            speech.style.top = screen.y + 'px';
        }
    }

    static showBossSpeech(text) {
        const speech = document.getElementById('boss-speech');
        if (!speech) return;
        speech.textContent = text;
        speech.classList.add('visible');
        setTimeout(() => speech.classList.remove('visible'), 3000);
    }

    static updateHighScoreDisplay(highScore) {
        const formatted = highScore > 0 ? Number(highScore).toLocaleString() : '— —';
        let el = document.getElementById('high-score-display');
        if (el) {
            const valEl = el.querySelector('#hs-value');
            if (valEl) valEl.textContent = formatted;
            return;
        }
        el = document.createElement('div');
        el.id = 'high-score-display';
        el.style.cssText = [
            'display:flex', 'align-items:center', 'gap:12px',
            'background:rgba(250,204,21,0.07)',
            'border:1.5px solid rgba(250,204,21,0.35)',
            'border-radius:14px', 'padding:10px 24px', 'margin-bottom:14px',
            'font-family:"Orbitron",sans-serif', 'font-size:15px', 'color:#fef08a',
            'letter-spacing:2px', 'box-shadow:0 0 18px rgba(250,204,21,0.18)',
            'pointer-events:none'
        ].join(';');
        el.innerHTML = `
            <span style="font-size:22px;line-height:1;">🏆</span>
            <span style="color:#94a3b8;font-size:12px;letter-spacing:1px;">ALL-TIME HIGH SCORE</span>
            <span id="hs-value"
                  style="font-size:22px;color:#facc15;text-shadow:0 0 12px rgba(250,204,21,0.6);">
                ${formatted}
            </span>
        `;
        const startBtn = document.getElementById('start-btn');
        if (startBtn && startBtn.parentNode) startBtn.parentNode.insertBefore(el, startBtn);
        else {
            const mc = document.querySelector('.menu-container');
            if (mc) mc.appendChild(el);
        }
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

        const playerAvatar = document.getElementById('player-avatar');
        if (playerAvatar) playerAvatar.textContent = isPoom ? '🌾' : (isAuto ? '🔥' : '👨🏻‍🎓');

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
                passiveSkillEl.style.display = '';          // restore default layout display
                passiveSkillEl.style.opacity = '0.35';      // dim until earned
                passiveSkillEl.classList.remove('unlocked'); // clear any stale unlock from prev run
                const skillName = passiveSkillEl.querySelector('.skill-name');
                if (skillName) skillName.textContent = '0/5'; // reset stealth counter text
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
                if (emojiEl) emojiEl.textContent = '🍚';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'eat-cd';
                nameEl.textContent = SN.poom?.skill1 ?? 'กินข้าว';
                nameEl.style.color = '#fcd34d';
            } else if (isAuto) {
                skill1El.id = 'stealth-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '🔥';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'stealth-cd';
                nameEl.textContent = SN.auto?.skill1 ?? 'WANCHAI';
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
        if (player instanceof PoomPlayer) {
            const S = BALANCE.characters.poom;

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

            // WARN-10 FIX: AutoPlayer's Wanchai Stand cooldown had no arc overlay
            // or countdown. Add a parallel branch so the player sees feedback.
        } else if (typeof AutoPlayer !== 'undefined' && player instanceof AutoPlayer) {
            const S = BALANCE.characters.auto;
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
                        nameEl.textContent = SN.auto?.skill1 ?? 'WANCHAI';
                        nameEl.style.color = '#fca5a5';
                    }
                }
            }

            // ── Vacuum Heat (Q) cooldown arc ────────────────────────────────────
            UIManager._setCooldownVisual(
                'vacuum-icon',
                Math.max(0, player.cooldowns.vacuum ?? 0),
                S.vacuumCooldown ?? 8
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
                S.detonationCooldown ?? 5
            );

            // ── Kao — Teleport (Q) + Clone of Stealth (E) ─────────────────────────
        } else if (player.charId === 'kao') {
            const S = BALANCE.characters.kao;
            const passive = player.passiveUnlocked;

            // ── Helper: แสดง/ซ่อน lock overlay บน skill icon ─────────────────
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