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
 */

// ════════════════════════════════════════════════════════════
// 🏆 ACHIEVEMENT SYSTEM
// ════════════════════════════════════════════════════════════
class AchievementSystem {
    constructor() {
        this.list     = ACHIEVEMENT_DEFS;
        this.unlocked = new Set();
        this.stats = {
            kills: 0, damageTaken: 0, crits: 0,
            dashes: 0, stealths: 0, powerups: 0,
            shopPurchases: 0,
            weaponsUsed: new Set()
        };
    }

    check(id) {
        if (this.unlocked.has(id)) return;
        const ach = this.list.find(a => a.id === id);
        if (!ach) return;

        let unlock = false;
        switch(id) {
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
        if (!container) return;
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
        const player       = window.player;

        const scoreDisplay = document.getElementById('shop-score-display');
        if (scoreDisplay) scoreDisplay.textContent = currentScore.toLocaleString();

        Object.values(SHOP_ITEMS).forEach(item => {
            const btn  = document.getElementById(`shop-btn-${item.id}`);
            const card = document.getElementById(`shop-card-${item.id}`);
            if (!btn || !card) return;

            const canAfford = currentScore >= item.cost;
            btn.disabled = !canAfford;
            card.classList.toggle('shop-card-disabled', !canAfford);

            if (player && item.duration) {
                const isActive =
                    (item.id === 'damageUp' && player.shopDamageBoostActive) ||
                    (item.id === 'speedUp'  && player.shopSpeedBoostActive);
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
            }
        });
    }

    static tick() { ShopManager.updateButtons(); }
}

// ════════════════════════════════════════════════════════════
// 🖥️ UI MANAGER
// ════════════════════════════════════════════════════════════
class UIManager {

    static showVoiceBubble(text, x, y) {
        const bubble = document.getElementById('voice-bubble');
        if (!bubble) return;
        const screen = worldToScreen(x, y - 40);
        bubble.textContent = text;
        bubble.style.left  = screen.x + 'px';
        bubble.style.top   = screen.y + 'px';
        bubble.classList.add('visible');
        setTimeout(() => bubble.classList.remove('visible'), 1500);
    }

    static updateBossHUD(boss) {
        const hud   = document.getElementById('boss-hud');
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
            'display:flex','align-items:center','gap:12px',
            'background:rgba(250,204,21,0.07)',
            'border:1.5px solid rgba(250,204,21,0.35)',
            'border-radius:14px','padding:10px 24px','margin-bottom:14px',
            'font-family:"Orbitron",sans-serif','font-size:15px','color:#fef08a',
            'letter-spacing:2px','box-shadow:0 0 18px rgba(250,204,21,0.18)',
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

    static setupCharacterHUD(player) {
        const isPoom  = player instanceof PoomPlayer;
        // Derive charId safely from both Player and PoomPlayer instances
        const charId  = player.charId || (isPoom ? 'poom' : 'kao');
        const isKao   = charId === 'kao';

        const weaponIndicator = document.querySelector('.weapon-indicator');
        if (weaponIndicator) weaponIndicator.style.display = isPoom ? 'none' : '';

        const playerAvatar = document.getElementById('player-avatar');
        if (playerAvatar) playerAvatar.textContent = isPoom ? '🌾' : '👨‍🎓';

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
                passiveSkillEl.style.display  = '';          // restore default layout display
                passiveSkillEl.style.opacity  = '0.35';      // dim until earned
                passiveSkillEl.classList.remove('unlocked'); // clear any stale unlock from prev run
                const skillName = passiveSkillEl.querySelector('.skill-name');
                if (skillName) skillName.textContent = '0/5'; // reset stealth counter text
            } else {
                // Any non-Kao character: suppress entirely
                passiveSkillEl.style.display = 'none';
                passiveSkillEl.classList.remove('unlocked');
            }
        }

        const skill1El = document.getElementById('eat-icon') || document.getElementById('stealth-icon');
        if (skill1El) {
            if (isPoom) {
                skill1El.id = 'eat-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '🍚';
                const hintEl = document.getElementById('skill1-hint');
                if (hintEl) hintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'eat-cd';
            } else {
                skill1El.id = 'stealth-icon';
                const emojiEl = document.getElementById('skill1-emoji');
                if (emojiEl) emojiEl.textContent = '📖';
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
        if (btnSkill) btnSkill.textContent = isPoom ? '🍚' : '📖';
    }

    static updateSkillIcons(player) {
        if (!(player instanceof PoomPlayer)) return;
        const S = BALANCE.characters.poom;

        const eatIcon = document.getElementById('eat-icon');
        const eatCd   = document.getElementById('eat-cd');
        if (eatCd) {
            if (player.isEatingRice) {
                eatCd.style.height = '0%';
                eatIcon?.classList.add('active');
            } else {
                eatIcon?.classList.remove('active');
                const ep = player.cooldowns.eat <= 0
                    ? 100
                    : Math.min(100,(1-player.cooldowns.eat/S.eatRiceCooldown)*100);
                eatCd.style.height = `${100-ep}%`;
            }
        }

        const nagaIcon  = document.getElementById('naga-icon');
        const nagaCd    = document.getElementById('naga-cd');
        const nagaTimer = document.getElementById('naga-timer');
        if (nagaCd) {
            const np = player.cooldowns.naga <= 0
                ? 100
                : Math.min(100,(1-player.cooldowns.naga/S.nagaCooldown)*100);
            nagaCd.style.height = `${100-np}%`;
            nagaIcon?.classList.toggle('active', player.cooldowns.naga <= 0);
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
        const els = {
            'report-score': '0',
            'report-wave':  '0',
            'report-text':  'Loading...'
        };
        for (const [id, val] of Object.entries(els)) setElementText(id, val);
    }

    // ── Combo UI ──────────────────────────────────────────────
    static updateCombo(dt) {
        if (typeof comboTimer !== 'undefined') {
            if (comboTimer > 0) {
                comboTimer -= dt;
                if (comboTimer <= 0) {
                    comboTimer = 0; comboCount = 0;
                    comboScale = 1; comboShake = 0;
                }
            }
        }
        comboScale += (1 - comboScale) * Math.min(1, dt * comboScaleDecay);
        comboShake  = Math.max(0, comboShake - dt * comboShakeDecay);
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
        const grad = ctx.createLinearGradient(x-gWidth/2,y-30,x+gWidth/2,y+30);
        const t = Math.min(comboCount/30, 1);
        // lerpColorHex is now in utils.js — no redefinition needed here
        grad.addColorStop(0, lerpColorHex('#FFD54A','#FF3B3B',t));
        grad.addColorStop(1, lerpColorHex('#FFE08A','#FF6B6B',Math.min(1,t+0.18)));
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(0,0,0,0.44)'; ctx.shadowBlur = 18;

        const maxShake = Math.min(12, comboCount * 0.6);
        const shakeAmp = maxShake * comboShake;
        const shakeX   = (Math.random() - 0.5) * shakeAmp;
        const shakeY   = (Math.random() - 0.5) * shakeAmp;
        ctx.translate(x + shakeX, y + shakeY);

        const mainText = `${comboCount} HITS!`;
        ctx.fillText(mainText, 0, -size * 0.14);
        ctx.lineWidth = Math.max(3, size * 0.06);
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.strokeText(mainText, 0, -size * 0.14);

        let special = '';
        if (comboCount > 20) special = 'GODLIKE!';
        else if (comboCount > 10) special = 'UNSTOPPABLE!';
        if (special) {
            const smallSize = Math.max(18, Math.round(size * 0.44));
            ctx.font = `bold ${smallSize}px "Orbitron", sans-serif`;
            ctx.fillText(special, 0, Math.round(size * 0.62));
            ctx.lineWidth = Math.max(2, smallSize * 0.06);
            ctx.strokeText(special, 0, Math.round(size * 0.62));
        }
        ctx.restore();
    }

    // ── Radar + Combo draw entry ──────────────────────────────
    static draw(ctx, dt) {
        UIManager.updateCombo(dt);
        UIManager.drawCombo(ctx);
        if (!ctx || !ctx.canvas) return;
        // ✅ Minimap is drawn LAST so no other HUD element overlaps it.
        UIManager.drawMinimap(ctx);
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
        const scale       = 0.1;
        // Safe-Zone: keeps radar clear of device notches / browser chrome.
        const cx  = canvas.width  - 300;   // 300 px from right edge
        const cy  = 90;                    // 90 px from top edge
        const now = Date.now();

        const player = (typeof window !== 'undefined' && window.player)
            ? window.player : { x: 0, y: 0 };

        // ── 🔴 DIAGNOSTIC — logs once every ~10 s to confirm this runs ──────
        if (!UIManager._minimapFrame) UIManager._minimapFrame = 0;
        UIManager._minimapFrame++;
        if (UIManager._minimapFrame % 600 === 1) {
            console.log(
                '[MTC Minimap] frame', UIManager._minimapFrame,
                '| canvas:', canvas.width, 'x', canvas.height,
                '| cx:', cx, 'cy:', cy, 'r:', radarRadius,
                '| compositeOp:', ctx.globalCompositeOperation,
                '| globalAlpha:', ctx.globalAlpha,
                '| MTC_DB:', !!window.MTC_DATABASE_SERVER,
                '| MTC_SHOP:', !!window.MTC_SHOP_LOCATION,
                '| enemies:', (window.enemies || []).length
            );
        }

        // Helper: world→radar-screen, clamped to maxR from radar center
        const toRadar = (wx, wy, maxR = radarRadius - 6) => {
            const rx = cx + (wx - player.x) * scale;
            const ry = cy + (wy - player.y) * scale;
            const dx = rx - cx, dy = ry - cy;
            const d  = Math.sqrt(dx * dx + dy * dy);
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
        ctx.globalAlpha              = 1;               // ← FIX: undo any alpha leakage
        ctx.shadowBlur               = 0;               // ← FIX: clear any glow leakage

        // ── 1. Outer shell (drawn BEFORE clip so they sit outside it) ──

        // Subtle outer glow halo
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(57,255,20,0.07)'; ctx.fill();

        // Main deep-navy fill — high-contrast background
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'; ctx.fill();

        // Pulsating neon-green border — width oscillates 1 px → 3 px
        const borderSin   = Math.sin(now / 500);   // −1 … +1
        const borderWidth = 2 + borderSin;          // 1 … 3 px
        ctx.lineWidth   = borderWidth;
        ctx.strokeStyle = `rgba(57,255,20,${0.80 + borderSin * 0.15})`;
        ctx.shadowBlur  = 12 + borderSin * 6;
        ctx.shadowColor = '#39ff14';
        ctx.beginPath(); ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur  = 0;

        // Inner accent ring
        ctx.lineWidth   = 0.8;
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

        // ── 2. Interior grid ──────────────────────────────────
        ctx.lineWidth = 0.7;

        // Concentric range rings
        [radarRadius * 0.33, radarRadius * 0.66].forEach(r => {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(57,255,20,0.14)'; ctx.stroke();
        });

        // Tactical crosshair axes
        ctx.strokeStyle = 'rgba(57,255,20,0.20)';
        ctx.lineWidth   = 0.8;
        ctx.beginPath();
        ctx.moveTo(cx - radarRadius + 2, cy); ctx.lineTo(cx + radarRadius - 2, cy);
        ctx.moveTo(cx, cy - radarRadius + 2); ctx.lineTo(cx, cy + radarRadius - 2);
        ctx.stroke();

        // ── 3. Sweep line animation ───────────────────────────
        const SWEEP_RPM  = 1 / 3;   // one full revolution every 3 seconds
        const sweepAngle = ((now / 1000) * SWEEP_RPM * Math.PI * 2) % (Math.PI * 2);

        // Trail: 120° fading arc behind the sweep head
        const trailArc   = Math.PI * 2 / 3;
        const TRAIL_STEPS = 24;
        for (let i = 0; i < TRAIL_STEPS; i++) {
            const frac   = i / TRAIL_STEPS;
            const aStart = sweepAngle - trailArc * (1 - frac);
            const aEnd   = sweepAngle - trailArc * (1 - frac - 1 / TRAIL_STEPS);
            const alpha  = frac * frac * 0.22;   // quadratic fade toward head
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
        ctx.lineWidth   = 1.5;
        ctx.shadowBlur  = 6; ctx.shadowColor = '#48bb78';
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
            ctx.shadowBlur  = 10 * dbPulse;
            ctx.shadowColor = '#60a5fa';

            if (sc) {
                const ax = cx - sx, ay = cy - sy;
                ctx.rotate(Math.atan2(ay, ax));
                ctx.fillStyle = `rgba(59,130,246,${0.8 + dbPulse * 0.2})`;
                ctx.beginPath();
                ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle   = `rgba(59,130,246,${0.85 + dbPulse * 0.15})`;
                ctx.strokeStyle = `rgba(147,197,253,${dbPulse * 0.95})`;
                ctx.lineWidth   = 1.2;
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
            ctx.shadowBlur  = 7 * shPulse;
            ctx.shadowColor = '#f59e0b';

            if (shc) {
                const ax = cx - shx, ay = cy - shy;
                ctx.rotate(Math.atan2(ay, ax));
                ctx.fillStyle = `rgba(245,158,11,${0.7 + shPulse * 0.3})`;
                ctx.beginPath();
                ctx.moveTo(6, 0); ctx.lineTo(0, -4); ctx.lineTo(0, 4); ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle   = `rgba(251,191,36,${0.7 + shPulse * 0.25})`;
                ctx.strokeStyle = `rgba(253,230,138,${shPulse * 0.85})`;
                ctx.lineWidth   = 1.2;
                ctx.fillRect(-SZ, -SZ, SZ * 2, SZ * 2);
                ctx.strokeRect(-SZ, -SZ, SZ * 2, SZ * 2);
            }
            ctx.restore();
        }

        // ── 6. Enemies — bright red dots (3 px radius) ────────
        if (Array.isArray(window.enemies)) {
            for (const e of window.enemies) {
                if (!e || e.dead) continue;
                const { x: ex, y: ey, clamped: ec } = toRadar(e.x, e.y);

                ctx.save();
                ctx.shadowBlur  = ec ? 0 : 5;
                ctx.shadowColor = '#ff2222';

                if (ec) {
                    ctx.translate(ex, ey);
                    ctx.rotate(Math.atan2(cy - ey, cx - ex));
                    ctx.fillStyle = 'rgba(255,50,50,0.85)';
                    ctx.beginPath();
                    ctx.moveTo(5, 0); ctx.lineTo(0, -3); ctx.lineTo(0, 3); ctx.closePath();
                    ctx.fill();
                } else {
                    const r   = e.type === 'mage' ? 4 : (e.type === 'tank' ? 4.5 : 3);
                    const col = e.type === 'mage'
                        ? 'rgba(200,85,255,1.0)'
                        : (e.type === 'tank' ? 'rgba(255,110,40,1.0)' : 'rgba(255,40,40,1.0)');
                    ctx.fillStyle = col;
                    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
                }
                ctx.restore();
            }
        }

        // ── 7. Boss — 6 px pulsating purple dot ───────────────
        if (window.boss && !window.boss.dead) {
            const t     = (now % 1000) / 1000;
            const pulse = 0.5 + Math.abs(Math.sin(t * Math.PI * 2)) * 0.8;
            const { x: bx, y: by, clamped: bc } = toRadar(
                window.boss.x, window.boss.y, radarRadius - 10
            );

            ctx.save();
            ctx.shadowBlur  = 14 * pulse;
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
                ctx.lineWidth   = 1.5;
                ctx.beginPath(); ctx.arc(bx, by, 10 + 3 * pulse, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle    = `rgba(255,220,255,${0.75 + 0.25 * pulse})`;
                ctx.font         = 'bold 6px monospace';
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText('BOSS', bx, by - 12 - 2 * pulse);
            }
            ctx.restore();
        }

        // ── 8. Player — green triangle at radar center (6 px) ──
        ctx.save();
        ctx.translate(cx, cy);
        if (player.angle !== undefined) ctx.rotate(player.angle + Math.PI / 2);
        ctx.shadowBlur  = 8; ctx.shadowColor = '#34d399';
        ctx.fillStyle   = 'rgba(52,214,88,0.98)';
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(0, -5, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

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
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.font         = 'bold 8px Orbitron, monospace';
        ctx.fillStyle    = 'rgba(72,187,120,0.70)';
        ctx.fillText('TACTICAL RADAR', cx, cy + radarRadius + 5);

        // Tiny legend row: red=enemy  purple=boss  blue=db  gold=shop
        const legend = [
            { col: '#ef4444', label: 'ENM' },
            { col: '#a855f7', label: 'BSS' },
            { col: '#3b82f6', label: 'DB'  },
            { col: '#f59e0b', label: 'SHP' },
        ];
        const lx0 = cx - (legend.length - 1) * 14;
        legend.forEach(({ col, label }, i) => {
            const lx = lx0 + i * 28;
            const ly = cy + radarRadius + 17;
            ctx.fillStyle = col;
            ctx.fillRect(lx - 3, ly, 6, 6);
            ctx.font      = '6px monospace';
            ctx.fillStyle = 'rgba(203,213,225,0.6)';
            ctx.fillText(label, lx, ly + 8);
        });

        // ══════════════════════════════════════════════════════
        // OUTER RESTORE — final cleanup.
        // Restores composite operation, globalAlpha, shadowBlur
        // to whatever state they were in before drawMinimap().
        // ══════════════════════════════════════════════════════
        ctx.restore();  // ← ends OUTER save
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
    try { if(typeof Audio!=='undefined'&&Audio.playCombo) Audio.playCombo(); } catch(e){}
}

// ════════════════════════════════════════════════════════════
// Global singletons — must be on window for cross-script access
// ════════════════════════════════════════════════════════════
// 'var' declarations auto-register on window; class declarations do NOT.
var Achievements = new AchievementSystem();

// Expose ShopManager and UIManager on window so game.js and map.js
// can access them regardless of which script tag loads first.
window.ShopManager = ShopManager;
window.UIManager   = UIManager;
window.Achievements = Achievements;

// ── High-score display on initial page load ───────────────────
// Wrapped in DOMContentLoaded so the DOM is ready before we query it.
window.addEventListener('DOMContentLoaded', () => {
    try {
        const saved = getSaveData();
        UIManager.updateHighScoreDisplay(saved.highScore || 0);
    } catch(e) {
        console.warn('[MTC Save] Could not init high score display:', e);
    }
});

// ── Node/bundler export ───────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AchievementSystem, ShopManager, UIManager, Achievements, addCombo, comboCount, comboTimer };
}