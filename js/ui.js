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

    /**
     * 🎮 setupCharacterHUD — เรียกครั้งเดียวตอนเริ่มเกม
     * ตั้งค่า HUD ให้ตรงกับตัวละครที่เลือก
     */
    static setupCharacterHUD(player) {
        const isPoom = player instanceof PoomPlayer;
        
        // Weapon indicator: ซ่อนสำหรับภูมิ (ไม่ใช้ระบบปืน)
        const weaponIndicator = document.querySelector('.weapon-indicator');
        if (weaponIndicator) {
            weaponIndicator.style.display = isPoom ? 'none' : '';
        }

        // ไอคอน Player (👨‍🎓 สำหรับเก้า, 🌾 สำหรับภูมิ)
        const playerAvatar = document.getElementById('player-avatar');
        if (playerAvatar) {
            playerAvatar.textContent = isPoom ? '🌾' : '👨‍🎓';
        }

        // Skill 1 icon & label — always reset to original ID first, then remap for Poom
        const skill1El = document.getElementById('eat-icon') || document.getElementById('stealth-icon');
        if (skill1El) {
            if (isPoom) {
                // ภูมิ: Skill 1 = กินข้าวเหนียว (Right Click)
                skill1El.id = 'eat-icon';
                const skill1EmojiEl = document.getElementById('skill1-emoji');
                if (skill1EmojiEl) skill1EmojiEl.textContent = '🍙';
                const skill1HintEl = document.getElementById('skill1-hint');
                if (skill1HintEl) skill1HintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'eat-cd';
            } else {
                // เก้า: Skill 1 = ซุ่มอ่าน (Right Click) — reset IDs กลับ
                skill1El.id = 'stealth-icon';
                const skill1EmojiEl = document.getElementById('skill1-emoji');
                if (skill1EmojiEl) skill1EmojiEl.textContent = '📖';
                const skill1HintEl = document.getElementById('skill1-hint');
                if (skill1HintEl) skill1HintEl.textContent = 'R-Click';
                const cdEl = skill1El.querySelector('.cooldown-mask');
                if (cdEl) cdEl.id = 'stealth-cd';
            }
        }

        // Ultimate slot (Skill 2): แสดงสำหรับภูมิ, ซ่อนสำหรับเก้า
        const nagaSlot = document.getElementById('naga-icon');
        if (nagaSlot) {
            nagaSlot.style.display = isPoom ? 'flex' : 'none';
        }

        // Mobile: btn-naga — แสดงสำหรับภูมิ, ซ่อนสำหรับเก้า
        const btnNaga = document.getElementById('btn-naga');
        if (btnNaga) {
            btnNaga.style.display = isPoom ? 'flex' : 'none';
        }
        // Mobile: btn-skill เปลี่ยนไอคอน
        const btnSkill = document.getElementById('btn-skill');
        if (btnSkill) {
            btnSkill.textContent = isPoom ? '🍙' : '📖';
        }
    }

    /**
     * 🔁 updateSkillIcons — เรียกทุก Frame ขณะเล่นเป็นภูมิ
     * อัปเดต Cooldown bar ของสกิล 1 (eat-cd) และสกิล 2 (naga-cd)
     */
    static updateSkillIcons(player) {
        if (!(player instanceof PoomPlayer)) return;

        // ── Skill 1 (กินข้าวเหนียว) cooldown ──
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
                    : Math.min(100, (1 - player.cooldowns.eat / BALANCE.poom.eatRiceCooldown) * 100);
                eatCd.style.height = `${100 - ep}%`;
            }
        }

        // ── Skill 2 (อัญเชิญพญานาค) cooldown ──
        const nagaIcon = document.getElementById('naga-icon');
        const nagaCd   = document.getElementById('naga-cd');
        if (nagaCd) {
            const np = player.cooldowns.naga <= 0
                ? 100
                : Math.min(100, (1 - player.cooldowns.naga / BALANCE.poom.nagaCooldown) * 100);
            nagaCd.style.height = `${100 - np}%`;
            // กระพริบเมื่อพร้อมใช้
            if (nagaIcon) {
                if (player.cooldowns.naga <= 0) nagaIcon.classList.add('active');
                else nagaIcon.classList.remove('active');
            }
        }

        // ── Timer text บน naga-icon ──
        const nagaTimer = document.getElementById('naga-timer');
        if (nagaTimer) {
            if (player.cooldowns.naga > 0) {
                nagaTimer.textContent = Math.ceil(player.cooldowns.naga) + 's';
                nagaTimer.style.display = 'block';
            } else {
                nagaTimer.style.display = 'none';
            }
        }
    }
}

const Achievements = new AchievementSystem();

function showVoiceBubble(text, x, y) {
    UIManager.showVoiceBubble(text, x, y);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AchievementSystem, UIManager, Achievements, showVoiceBubble };
}