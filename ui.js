/**
 * 📊 MTC: ENHANCED EDITION - UI System
 * Achievements, HUD, and UI management
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
        
        switch(id) {
            case 'first_blood': unlock = this.stats.kills >= 1; break;
            case 'wave_1': unlock = getWave() >= 2; break;
            case 'boss_down': unlock = window.boss && window.boss.dead; break;
            case 'no_damage': unlock = this.stats.damageTaken === 0 && getEnemiesKilled() >= 5; break;
            case 'crit_master': unlock = this.stats.crits >= 5; break;
            case 'speedster': unlock = this.stats.dashes >= 20; break;
            case 'ghost': unlock = this.stats.stealths >= 10; break;
            case 'collector': unlock = this.stats.powerups >= 10; break;
            case 'weapon_master': unlock = this.stats.weaponsUsed.size >= 3; break;
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
        bubble.style.top = screen.y + 'px';
        bubble.classList.add('visible');
        
        setTimeout(() => bubble.classList.remove('visible'), 1500);
    }
    
    static updateBossHUD(boss) {
        const hud = document.getElementById('boss-hud');
        const hpBar = document.getElementById('boss-hp-bar');
        
        if (boss && !boss.dead) {
            hud.classList.add('active');
            const hpPercent = (boss.hp / boss.maxHp) * 100;
            hpBar.style.width = hpPercent + '%';
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
        
        setTimeout(() => {
            speech.classList.remove('visible');
        }, 3000);
    }
}

const Achievements = new AchievementSystem();

function showVoiceBubble(text, x, y) {
    UIManager.showVoiceBubble(text, x, y);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AchievementSystem, UIManager, Achievements, showVoiceBubble };
}
