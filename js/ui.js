/**
 * MTC: ENHANCED EDITION - UI System
 * Achievements, HUD, and UI management
 *
 * REFACTORED:
 * - All BALANCE.poom.* -> BALANCE.characters.poom.*
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AchievementSystem, UIManager, Achievements, showVoiceBubble };
}