/**
 * MTC: ENHANCED EDITION - UI System
 * Achievements, HUD, Shop, and UI management
 *
 * REFACTORED (Save/Load System — v5):
 * - All BALANCE.poom.* -> BALANCE.characters.poom.*
 * - Added ShopManager for the in-game shop system
 * - UIManager.updateHighScoreDisplay() — shows all-time best on the main menu
 *   and injects a live "HIGH SCORE" row above the Play button
 */

class AchievementSystem {
    constructor() {
        this.list = ACHIEVEMENT_DEFS;
        this.unlocked = new Set();
        this.stats = {
            kills: 0,
            damageTaken: 0,
            crits: 0,
            dashes: 0,
            stealths: 0,
            powerups: 0,
            shopPurchases: 0,
            weaponsUsed: new Set()
        };
    }

    check(id) {
        if (this.unlocked.has(id)) return;

        const ach = this.list.find(a => a.id === id);
        if (!ach) return;

        let unlock = false;

        switch (id) {
            case 'first_blood':   unlock = this.stats.kills >= 1; break;
            case 'wave_1':        unlock = getWave() >= 2; break;
            case 'boss_down':     unlock = window.boss && window.boss.dead; break;
            case 'no_damage':     unlock = this.stats.damageTaken === 0 && getEnemiesKilled() >= 5; break;
            case 'crit_master':   unlock = this.stats.crits >= 5; break;
            case 'speedster':     unlock = this.stats.dashes >= 20; break;
            case 'ghost':         unlock = this.stats.stealths >= 10; break;
            case 'collector':     unlock = this.stats.powerups >= 10; break;
            case 'weapon_master': unlock = this.stats.weaponsUsed.size >= 3; break;
            case 'naga_summoner': unlock = window.player instanceof PoomPlayer && window.player.nagaCount >= 3; break;
            case 'shopaholic':    unlock = this.stats.shopPurchases >= 5; break;
        }

        if (unlock) this.unlock(ach);
    }

    unlock(ach) {
        this.unlocked.add(ach.id);
        Audio.playAchievement();

        const container = document.getElementById('achievements');
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

    checkAll() {
        this.list.forEach(ach => this.check(ach.id));
    }
}

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP MANAGER
// Handles rendering, button state, and the shop overlay.
// All purchase logic lives in buyItem() in game.js — ShopManager
// is purely a UI concern.
// ══════════════════════════════════════════════════════════════
class ShopManager {

    // ------------------------------------------------------------------
    // open()
    // Renders item cards with live score data, then shows the modal.
    // Called by openShop() in game.js after gameState is set to 'PAUSED'.
    // ------------------------------------------------------------------
    static open() {
        ShopManager.renderItems();
        const modal = document.getElementById('shop-modal');
        if (modal) {
            modal.style.display = 'flex';
            // Trigger entrance animation
            requestAnimationFrame(() => {
                const inner = modal.querySelector('.shop-inner');
                if (inner) inner.classList.add('shop-visible');
            });
        }
    }

    // ------------------------------------------------------------------
    // close()
    // Hides the shop modal. Resuming the game is handled by closeShop()
    // in game.js which calls this then sets gameState = 'PLAYING'.
    // ------------------------------------------------------------------
    static close() {
        const modal = document.getElementById('shop-modal');
        if (!modal) return;
        const inner = modal.querySelector('.shop-inner');
        if (inner) inner.classList.remove('shop-visible');
        // Give the CSS transition time to finish before hiding
        setTimeout(() => { modal.style.display = 'none'; }, 260);
    }

    // ------------------------------------------------------------------
    // renderItems()
    // Clears and re-populates the #shop-items grid with one card per
    // item defined in SHOP_ITEMS (config.js).
    // ------------------------------------------------------------------
    static renderItems() {
        const container = document.getElementById('shop-items');
        if (!container) return;
        container.innerHTML = '';

        Object.values(SHOP_ITEMS).forEach(item => {
            const card = document.createElement('div');
            card.className = 'shop-card';
            card.id        = `shop-card-${item.id}`;

            // Duration label
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

        // Apply initial affordability state
        ShopManager.updateButtons();
    }

    // ------------------------------------------------------------------
    // updateButtons()
    // Enables / disables each Buy button based on the current score.
    // Also updates the active-buff visual indicator on cards.
    // Call this after every purchase and when score changes.
    // ------------------------------------------------------------------
    static updateButtons() {
        const currentScore = typeof getScore === 'function' ? getScore() : 0;
        const player       = window.player;

        // Update score display inside the modal header
        const scoreDisplay = document.getElementById('shop-score-display');
        if (scoreDisplay) scoreDisplay.textContent = currentScore.toLocaleString();

        Object.values(SHOP_ITEMS).forEach(item => {
            const btn  = document.getElementById(`shop-btn-${item.id}`);
            const card = document.getElementById(`shop-card-${item.id}`);
            if (!btn || !card) return;

            const canAfford = currentScore >= item.cost;

            btn.disabled = !canAfford;
            card.classList.toggle('shop-card-disabled', !canAfford);

            // Active-buff indicator (only for timed buffs)
            if (player && item.duration) {
                const isActive =
                    (item.id === 'damageUp' && player.shopDamageBoostActive) ||
                    (item.id === 'speedUp'  && player.shopSpeedBoostActive);

                card.classList.toggle('shop-card-active', isActive);

                // Show remaining time inside the card if buff is active
                let timerEl = card.querySelector('.shop-buff-timer');
                if (isActive) {
                    const remaining =
                        item.id === 'damageUp'
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
            }
        });
    }

    // ------------------------------------------------------------------
    // tick()
    // Called every frame from updateGame() while the shop is open
    // (gameState === 'PAUSED' and shop modal is visible) to keep
    // the buff timer displays fresh without re-rendering all cards.
    // ------------------------------------------------------------------
    static tick() {
        ShopManager.updateButtons();
    }
}

// ══════════════════════════════════════════════════════════════
// UI Manager
// ══════════════════════════════════════════════════════════════
class UIManager {

    static showVoiceBubble(text, x, y) {
        const bubble = document.getElementById('voice-bubble');
        if (!bubble) return;
        const screen = worldToScreen(x, y - 40);
        bubble.textContent = text;
        bubble.style.left = screen.x + 'px';
        bubble.style.top  = screen.y + 'px';
        bubble.classList.add('visible');
        setTimeout(() => bubble.classList.remove('visible'), 1500);
    }

    static updateBossHUD(boss) {
        const hud   = document.getElementById('boss-hud');
        const hpBar = document.getElementById('boss-hp-bar');
        if (boss && !boss.dead) {
            hud.classList.add('active');
            hpBar.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
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
            speech.style.top  = screen.y + 'px';
        }
    }

    static showBossSpeech(text) {
        const speech = document.getElementById('boss-speech');
        if (!speech) return;
        speech.textContent = text;
        speech.classList.add('visible');
        setTimeout(() => speech.classList.remove('visible'), 3000);
    }

    // ------------------------------------------------------------------
    // updateHighScoreDisplay(highScore)
    // ─────────────────────────────────────────────────────────────────
    // Inserts (or updates) a persistent HIGH SCORE row in the main menu.
    // The row lives just above the #start-btn so it's visible at game
    // start AND after a run ends.
    //
    // DOM target: the element with id="high-score-display".
    // If it doesn't exist yet it is created and injected into
    // .menu-container, directly before #start-btn.
    //
    // Calling with highScore === 0 shows "— —" instead of 0 so first-
    // time players don't see a meaningless zero.
    // ------------------------------------------------------------------
    static updateHighScoreDisplay(highScore) {
        const formatted = highScore > 0
            ? Number(highScore).toLocaleString()
            : '— —';

        // Update any existing element first (fastest path after a run)
        let el = document.getElementById('high-score-display');
        if (el) {
            const valEl = el.querySelector('#hs-value');
            if (valEl) valEl.textContent = formatted;
            return;
        }

        // First call — build the element and inject it
        el = document.createElement('div');
        el.id = 'high-score-display';
        el.style.cssText = [
            'display:flex',
            'align-items:center',
            'gap:12px',
            'background:rgba(250,204,21,0.07)',
            'border:1.5px solid rgba(250,204,21,0.35)',
            'border-radius:14px',
            'padding:10px 24px',
            'margin-bottom:14px',
            'font-family:"Orbitron",sans-serif',
            'font-size:15px',
            'color:#fef08a',
            'letter-spacing:2px',
            'box-shadow:0 0 18px rgba(250,204,21,0.18)',
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

        // Inject just before the Start button
        const startBtn = document.getElementById('start-btn');
        if (startBtn && startBtn.parentNode) {
            startBtn.parentNode.insertBefore(el, startBtn);
        } else {
            // Fallback: append to menu container
            const menuContainer = document.querySelector('.menu-container');
            if (menuContainer) menuContainer.appendChild(el);
        }
    }

    static setupCharacterHUD(player) {
        const isPoom = player instanceof PoomPlayer;

        const weaponIndicator = document.querySelector('.weapon-indicator');
        if (weaponIndicator) {
            weaponIndicator.style.display = isPoom ? 'none' : '';
        }

        const playerAvatar = document.getElementById('player-avatar');
        if (playerAvatar) {
            playerAvatar.textContent = isPoom ? '\u{1F33E}' : '\u{1F468}\u200D\u{1F393}';
        }

        const skill1El = document.getElementById('eat-icon') || document.getElementById('stealth-icon');
        if (skill1El) {
            if (isPoom) {
                skill1El.id = 'eat-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '\u{1F359}';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'eat-cd';
            } else {
                skill1El.id = 'stealth-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '\u{1F4D6}';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'stealth-cd';
            }
        }

        const nagaSlot = document.getElementById('naga-icon');
        if (nagaSlot) nagaSlot.style.display = isPoom ? 'flex' : 'none';

        const btnNaga = document.getElementById('btn-naga');
        if (btnNaga) btnNaga.style.display = isPoom ? 'flex' : 'none';

        const btnSkill = document.getElementById('btn-skill');
        if (btnSkill) btnSkill.textContent = isPoom ? '\u{1F359}' : '\u{1F4D6}';
    }

    static updateSkillIcons(player) {
        if (!(player instanceof PoomPlayer)) return;

        const S = BALANCE.characters.poom;

        const eatIcon = document.getElementById('eat-icon');
        const eatCd   = document.getElementById('eat-cd');
        if (eatCd) {
            if (player.isEatingRice) {
                eatCd.style.height = '0%';
                if (eatIcon) eatIcon.classList.add('active');
            } else {
                if (eatIcon) eatIcon.classList.remove('active');
                const ep = player.cooldowns.eat <= 0
                    ? 100
                    : Math.min(100, (1 - player.cooldowns.eat / S.eatRiceCooldown) * 100);
                eatCd.style.height = `${100 - ep}%`;
            }
        }

        const nagaIcon  = document.getElementById('naga-icon');
        const nagaCd    = document.getElementById('naga-cd');
        const nagaTimer = document.getElementById('naga-timer');
        if (nagaCd) {
            const np = player.cooldowns.naga <= 0
                ? 100
                : Math.min(100, (1 - player.cooldowns.naga / S.nagaCooldown) * 100);
            nagaCd.style.height = `${100 - np}%`;
            if (nagaIcon) {
                if (player.cooldowns.naga <= 0) nagaIcon.classList.add('active');
                else nagaIcon.classList.remove('active');
            }
        }
        if (nagaTimer) {
            if (player.cooldowns.naga > 0) {
                nagaTimer.textContent = Math.ceil(player.cooldowns.naga) + 's';
                nagaTimer.style.display = 'block';
            } else {
                nagaTimer.style.display = 'none';
            }
        }
    }

    // ------------------------------------------------------------------
    // Game Over helpers
    // Called by endGame() in game.js BEFORE the async AI call,
    // so the stat boxes are never left at their HTML default of 0.
    // ------------------------------------------------------------------

    static showGameOver(score, wave) {
        const titleEl = document.querySelector('.title');
        if (titleEl) {
            titleEl.innerHTML =
                'GAME OVER<br><span class="subtitle">SCORE ' + score.toLocaleString() + ' | WAVE ' + wave + '</span>';
        }
        const reportScoreEl = document.getElementById('report-score');
        if (reportScoreEl) reportScoreEl.textContent = score.toLocaleString();

        const reportWaveEl = document.getElementById('report-wave');
        if (reportWaveEl) reportWaveEl.textContent = wave;

        const reportText = document.getElementById('report-text');
        if (reportText) reportText.textContent = 'Loading...';

        const rc = document.getElementById('report-card');
        if (rc) rc.style.display = 'block';
    }

    static resetGameOverUI() {
        const reportScoreEl = document.getElementById('report-score');
        if (reportScoreEl) reportScoreEl.textContent = '0';

        const reportWaveEl = document.getElementById('report-wave');
        if (reportWaveEl) reportWaveEl.textContent = '0';

        const reportText = document.getElementById('report-text');
        if (reportText) reportText.textContent = 'Loading...';
    }

}

const Achievements = new AchievementSystem();

function showVoiceBubble(text, x, y) {
    UIManager.showVoiceBubble(text, x, y);
}

// ── Initialize persistent High Score display on page load ─────────────
// Runs once as soon as ui.js is parsed so players see their record
// on the menu before pressing Start for the first time.
(function initHighScoreOnLoad() {
    try {
        const saved = getSaveData();
        UIManager.updateHighScoreDisplay(saved.highScore || 0);
    } catch (e) {
        // getSaveData() may not be callable if utils.js loads out of order
        // in some edge-case dev setups.  Fail silently — the display will
        // be populated by startGame() on the first run instead.
        console.warn('[MTC Save] Could not init high score display:', e);
    }
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AchievementSystem, ShopManager, UIManager, Achievements, showVoiceBubble };
}