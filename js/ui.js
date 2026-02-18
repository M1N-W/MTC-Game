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
        const isPoom = player instanceof PoomPlayer;
        const weaponIndicator = document.querySelector('.weapon-indicator');
        if (weaponIndicator) weaponIndicator.style.display = isPoom ? 'none' : '';

        const playerAvatar = document.getElementById('player-avatar');
        if (playerAvatar) playerAvatar.textContent = isPoom ? '🌾' : '👨‍🎓';

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

        const canvas = ctx.canvas;
        const radarRadius = 60, margin = 20, scale = 0.1;
        const cx = canvas.width - margin - radarRadius;
        const cy = margin + radarRadius;

        ctx.save();
        ctx.beginPath(); ctx.arc(cx,cy,radarRadius,0,Math.PI*2);
        ctx.fillStyle='rgba(0,0,0,0.48)'; ctx.fill();
        ctx.lineWidth=2.2; ctx.strokeStyle='rgba(72,187,120,0.95)'; ctx.stroke();

        ctx.beginPath(); ctx.arc(cx,cy,radarRadius-10,0,Math.PI*2);
        ctx.lineWidth=1; ctx.strokeStyle='rgba(72,187,120,0.18)'; ctx.stroke();

        ctx.beginPath(); ctx.arc(cx,cy,radarRadius-1,0,Math.PI*2); ctx.clip();

        ctx.lineWidth=0.8; ctx.strokeStyle='rgba(255,255,255,0.03)';
        [radarRadius*.33,radarRadius*.66].forEach(r=>{
            ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
        });
        ctx.beginPath();
        ctx.moveTo(cx-radarRadius,cy); ctx.lineTo(cx+radarRadius,cy);
        ctx.moveTo(cx,cy-radarRadius); ctx.lineTo(cx,cy+radarRadius);
        ctx.stroke();

        const player=(typeof window!=='undefined'&&window.player)?window.player:{x:0,y:0};

        ctx.save(); ctx.translate(cx,cy); ctx.fillStyle='rgba(52,214,88,0.98)';
        ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(7,7); ctx.lineTo(-7,7); ctx.closePath(); ctx.fill();
        ctx.restore();

        const clampToRadius=(px,py,maxR)=>{
            const dx=px-cx, dy=py-cy, d=Math.sqrt(dx*dx+dy*dy);
            if(d<=maxR) return{x:px,y:py};
            return{x:cx+dx*(maxR/d),y:cy+dy*(maxR/d)};
        };

        if (Array.isArray(window.enemies)) {
            for(const e of window.enemies){
                if(!e||e.dead) continue;
                const{x:ex,y:ey}=clampToRadius(cx+(e.x-player.x)*scale,cy+(e.y-player.y)*scale,radarRadius-6);
                ctx.beginPath(); ctx.fillStyle='rgba(220,40,40,0.98)'; ctx.arc(ex,ey,3.2,0,Math.PI*2); ctx.fill();
            }
        }

        if(window.boss&&!window.boss.dead){
            const t=(Date.now()%1000)/1000;
            const pulse=0.5+Math.abs(Math.sin(t*Math.PI*2))*0.8;
            const{x:bx,y:by}=clampToRadius(cx+(window.boss.x-player.x)*scale,cy+(window.boss.y-player.y)*scale,radarRadius-10);
            ctx.beginPath(); ctx.fillStyle=`rgba(170,110,255,${0.6+0.25*pulse})`;
            ctx.arc(bx,by,6+3*pulse,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.lineWidth=1.2; ctx.strokeStyle=`rgba(170,110,255,${0.22+0.12*pulse})`;
            ctx.arc(bx,by,10+3*pulse,0,Math.PI*2); ctx.stroke();
        }

        ctx.restore();
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