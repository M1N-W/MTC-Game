/**
 * 🔊 MTC: ENHANCED EDITION - Audio System
 * Improved Web Audio API sound effects
 */

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterVolume = 0.7;
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
    
    // IMPROVED: Auto Rifle - Less harsh, smoother
    playShootAuto() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Square wave for crisp but not harsh sound
        osc.type = 'square';
        osc.frequency.value = 350;
        gain.gain.value = 0.06 * this.masterVolume; // Reduced from 0.1
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.stop(this.ctx.currentTime + 0.08);
    }
    
    // NEW: Sniper - Deep, powerful sound
    playShootSniper() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Triangle wave for smoother sound
        osc.type = 'triangle';
        osc.frequency.value = 200;
        gain.gain.value = 0.12 * this.masterVolume;
        
        osc.start();
        // Frequency drops for impact
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc.stop(this.ctx.currentTime + 0.25);
    }
    
    // NEW: Shotgun - Punchy, explosive sound
    playShootShotgun() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        // Sawtooth for aggressive sound
        osc.type = 'sawtooth';
        osc.frequency.value = 120;
        gain.gain.value = 0.15 * this.masterVolume;
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.stop(this.ctx.currentTime + 0.15);
    }
    
    // Main shoot function (routes to correct weapon)
    playShoot(weaponType = 'auto') {
        switch (weaponType) {
            case 'auto': this.playShootAuto(); break;
            case 'sniper': this.playShootSniper(); break;
            case 'shotgun': this.playShootShotgun(); break;
            default: this.playShootAuto();
        }
    }
    
    // Dash sound (unchanged - already good)
    playDash() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.value = 200;
        gain.gain.value = 0.15 * this.masterVolume;
        
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.stop(this.ctx.currentTime + 0.2);
    }
    
    // Hit sound
    playHit() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'square';
        osc.frequency.value = 150;
        gain.gain.value = 0.08 * this.masterVolume;
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.stop(this.ctx.currentTime + 0.15);
    }
    
    // Power-up sound
    playPowerUp() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.value = 400;
        gain.gain.value = 0.12 * this.masterVolume;
        
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.stop(this.ctx.currentTime + 0.3);
    }
    
    // Achievement sound (triple note)
    playAchievement() {
        if (!this.enabled || !this.ctx) return;
        
        [0, 0.1, 0.2].forEach((delay, i) => {
            setTimeout(() => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                
                osc.frequency.value = 600 + i * 200;
                gain.gain.value = 0.1 * this.masterVolume;
                
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
                osc.stop(this.ctx.currentTime + 0.2);
            }, delay * 1000);
        });
    }
    
    // NEW: Weapon switch sound
    playWeaponSwitch() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.frequency.value = 500;
        gain.gain.value = 0.08 * this.masterVolume;
        
        osc.start();
        osc.frequency.linearRampToValueAtTime(700, this.ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.stop(this.ctx.currentTime + 0.1);
    }
    
    // Enemy death sound
    playEnemyDeath() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.value = 300;
        gain.gain.value = 0.1 * this.masterVolume;
        
        osc.start();
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.stop(this.ctx.currentTime + 0.3);
    }
    
    // Boss special attack sound
    playBossSpecial() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.value = 100;
        gain.gain.value = 0.15 * this.masterVolume;
        
        osc.start();
        osc.frequency.linearRampToValueAtTime(500, this.ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.stop(this.ctx.currentTime + 0.4);
    }
    
    // Meteor warning sound
    playMeteorWarning() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.value = 0.08 * this.masterVolume;
        
        osc.start();
        
        // Oscillating warning sound
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                osc.frequency.value = 800 + Math.sin(i) * 200;
            }, i * 100);
        }
        
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.stop(this.ctx.currentTime + 0.5);
    }
    
    // Volume control
    setMasterVolume(volume) {
        this.masterVolume = clamp(volume, 0, 1);
    }
    
    getMasterVolume() {
        return this.masterVolume;
    }
    
    // Mute/Unmute
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

// Create singleton instance
const Audio = new AudioSystem();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Audio, AudioSystem };
}
