'use strict';
/**
 * 🔊 MTC: ENHANCED EDITION - Audio System (IMPROVED)
 * Smoother, more pleasant sound effects
 * 
 * IMPROVEMENTS:
 * - Reduced volume across all sounds
 * - Softer attack/decay envelopes
 * - More pleasant frequencies
 * - Smoother transitions
 */

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterVolume = GAME_CONFIG.audio.master; // ค่า Default อ่านจาก GAME_CONFIG (แก้ที่ config.js)
        this.enabled = true;
    }
    
    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ Audio System initialized');
        } catch (e) {
            console.warn('⚠️ Audio not supported:', e);
            this.enabled = false;
        }
    }
    
    // IMPROVED: Auto Rifle - Smooth and pleasant
    playShootAuto() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Sine wave for smooth sound
        osc.type = 'sine';
        osc.frequency.value = 400; // Pleasant frequency
        gain.gain.value = GAME_CONFIG.audio.shoot * this.masterVolume; // → config.js: audio.shoot
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.stop(this.ctx.currentTime + 0.05);
    }
    
    // IMPROVED: Sniper - Deep but smooth
    playShootSniper() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Sine wave for smoothness
        osc.type = 'sine';
        osc.frequency.value = 250;
        gain.gain.value = GAME_CONFIG.audio.shoot * this.masterVolume; // → config.js: audio.shoot
        
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.stop(this.ctx.currentTime + 0.2);
    }
    
    // IMPROVED: Shotgun - Punchy but not harsh
    playShootShotgun() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Triangle for softer punch
        osc.type = 'triangle';
        osc.frequency.value = 150;
        gain.gain.value = GAME_CONFIG.audio.shoot * this.masterVolume; // → config.js: audio.shoot
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.stop(this.ctx.currentTime + 0.12);
    }
    
    playShoot(weaponType = 'auto') {
        switch (weaponType) {
            case 'auto': this.playShootAuto(); break;
            case 'sniper': this.playShootSniper(); break;
            case 'shotgun': this.playShootShotgun(); break;
            default: this.playShootAuto();
        }
    }
    
    // IMPROVED: Dash - Smooth whoosh
    playDash() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 250;
        gain.gain.value = GAME_CONFIG.audio.dash * this.masterVolume; // → config.js: audio.dash
        
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.stop(this.ctx.currentTime + 0.15);
    }
    
    // IMPROVED: Hit - Softer impact
    playHit() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 180;
        gain.gain.value = GAME_CONFIG.audio.hit * this.masterVolume; // → config.js: audio.hit
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.stop(this.ctx.currentTime + 0.1);
    }
    
    // IMPROVED: Power-up - Pleasant chime
    playPowerUp() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 500;
        gain.gain.value = GAME_CONFIG.audio.powerUp * this.masterVolume; // → config.js: audio.powerUp
        
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc.stop(this.ctx.currentTime + 0.25);
    }
    
    // IMPROVED: Achievement - Gentle triple chime
    playAchievement() {
        if (!this.enabled || !this.ctx) return;
        
        [0, 0.08, 0.16].forEach((delay, i) => {
            setTimeout(() => {
                // ── STABILITY FIX (Zone 3 / Bug A): Re-check enabled and ctx
                // inside the callback. If mute() is called during the 0–160ms
                // scheduling window the outer guard has already passed, so
                // without this re-check the oscillators would still fire.
                if (!this.enabled || !this.ctx) return;

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.type = 'sine';
                osc.frequency.value = 600 + i * 150; // Closer intervals
                gain.gain.value = GAME_CONFIG.audio.achievement * this.masterVolume; // → config.js: audio.achievement
                
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
                osc.stop(this.ctx.currentTime + 0.15);
            }, delay * 1000);
        });
    }
    
    // IMPROVED: Weapon switch - Soft click
    playWeaponSwitch() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 600;
        gain.gain.value = GAME_CONFIG.audio.weaponSwitch * this.masterVolume; // → config.js: audio.weaponSwitch
        
        osc.start();
        osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.stop(this.ctx.currentTime + 0.08);
    }
    
    // IMPROVED: Enemy death - Smooth fade
    playEnemyDeath() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 300;
        gain.gain.value = GAME_CONFIG.audio.enemyDeath * this.masterVolume; // → config.js: audio.enemyDeath
        
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc.stop(this.ctx.currentTime + 0.25);
    }
    
    // IMPROVED: Boss special - Smooth powerful sound
    playBossSpecial() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 150;
        gain.gain.value = GAME_CONFIG.audio.bossSpecial * this.masterVolume; // → config.js: audio.bossSpecial
        
        osc.start();
        osc.frequency.linearRampToValueAtTime(400, this.ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
        osc.stop(this.ctx.currentTime + 0.35);
    }
    
    // IMPROVED: Meteor warning - Gentle pulsing
    playMeteorWarning() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 700;
        gain.gain.value = GAME_CONFIG.audio.meteorWarning * this.masterVolume; // → config.js: audio.meteorWarning
        
        osc.start();
        
        // Gentle oscillation
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                osc.frequency.value = 700 + Math.sin(i) * 100;
            }, i * 100);
        }
        
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.stop(this.ctx.currentTime + 0.4);
    }
    
    // NEW: Level up sound - Triumphant but pleasant
    playLevelUp() {
        if (!this.enabled || !this.ctx) return;
        
        const frequencies = [523, 659, 784]; // C, E, G chord
        
        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                // ── STABILITY FIX (Zone 3 / Bug A): Re-check enabled and ctx
                // inside the callback. The three notes are staggered 0–160ms;
                // a mute() call in that window must silence all pending notes,
                // not just those not yet scheduled.
                if (!this.enabled || !this.ctx) return;

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.value = GAME_CONFIG.audio.levelUp * this.masterVolume; // → config.js: audio.levelUp
                
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
                osc.stop(this.ctx.currentTime + 0.3);
            }, i * 80);
        });
    }
    
    // NEW: Heal sound - Gentle restore
    playHeal() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.value = GAME_CONFIG.audio.heal * this.masterVolume; // → config.js: audio.heal
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.stop(this.ctx.currentTime + 0.2);
    }
    
    setMasterVolume(volume) {
        this.masterVolume = clamp(volume, 0, 1);
    }
    
    getMasterVolume() {
        return this.masterVolume;
    }
    
    mute() {
        this.enabled = false;
    }
    
    unmute() {
        this.enabled = true;
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

var Audio = new AudioSystem();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Audio, AudioSystem };
}