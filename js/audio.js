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
 *
 * ADDITIONS (Poom character sounds — Lead Gameplay Developer pass):
 * ─────────────────────────────────────────────────────────────────
 * ✅ playPoomShoot()  — Low-mid bamboo-tube "Tuk" thump.
 *    Two-layer design:
 *      Layer 1 (Sine body): 130 Hz sweeps down to 55 Hz over 180 ms.
 *                           Models air pressure releasing from a bamboo tube.
 *      Layer 2 (Triangle click): 280→100 Hz fast transient decaying in 60 ms.
 *                                The wooden "pop" of the launch mechanism.
 *    Trigger: PoomPlayer.shoot() in player.js after projectile is created.
 *
 * ✅ playNagaAttack() — Sharp energy burst / hiss on Naga contact.
 *    Two-layer design:
 *      Layer 1 (White noise + bandpass): 120 ms burst centred at 1200 Hz.
 *                                       The mystical "sizzle" of magical energy.
 *      Layer 2 (Sine shimmer): 900→1300 Hz rising sine decaying in 90 ms.
 *                              A sparkle accent on impact.
 *    Trigger: NagaEntity.update() in player.js, rate-limited to every 220 ms
 *             via this.lastSoundTime to prevent rapid-tick audio stacking.
 */

class AudioSystem {
    constructor() {
        this.ctx = null;
        this.masterVolume = GAME_CONFIG.audio.master; // ค่า Default อ่านจาก GAME_CONFIG (แก้ที่ config.js)
        this.enabled = true;
        
        // BGM System
        this.bgmAudio = null;
        this.currentBGM = null;
        this.bgmVolume = GAME_CONFIG.audio.bgmVolume;
        this.sfxVolume = GAME_CONFIG.audio.sfxVolume;
        this.userInteracted = false;
        
        // Retry handler guard flag
        this._retryHandlerActive = false;
        
        // Event listener reference for cleanup
        this._bgmEndedListener = null;
        this._bgmRetryListener = null;
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ Audio System initialized');
            
            // Set up user interaction listener for BGM autoplay compliance
            this.setupUserInteractionListener();
        } catch (e) {
            console.warn('⚠️ Audio not supported:', e);
            this.enabled = false;
        }
    }
    
    setupUserInteractionListener() {
        // Enable BGM after first user interaction (click, keypress, etc.)
        const enableAudio = () => {
            this.userInteracted = true;
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('keydown', enableAudio);
            document.removeEventListener('touchstart', enableAudio);
        };
        
        document.addEventListener('click', enableAudio, { once: true });
        document.addEventListener('keydown', enableAudio, { once: true });
        document.addEventListener('touchstart', enableAudio, { once: true });
    }

    // Helper: Check and resume AudioContext if suspended
    _ensureAudioContextRunning() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    
    playShootAuto() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 400;
        gain.gain.value = GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume;

        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.stop(this.ctx.currentTime + 0.05);
    }

    // IMPROVED: Sniper - Deep but smooth
    playShootSniper() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 250;
        gain.gain.value = GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume;

        osc.start();
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // IMPROVED: Shotgun - Punchy but not harsh
    playShootShotgun() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.value = 150;
        gain.gain.value = GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume;

        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.stop(this.ctx.currentTime + 0.12);
    }

    playShoot(weaponType = 'auto') {
        switch (weaponType) {
            case 'auto':    this.playShootAuto();    break;
            case 'sniper':  this.playShootSniper();  break;
            case 'shotgun': this.playShootShotgun(); break;
            default:        this.playShootAuto();
        }
    }

    // ── NEW: Poom's rice launcher — bamboo-tube "Tuk" thump ──────────────────
    // Design rationale:
    //   Poom fires sticky rice clumps from what is essentially a high-tech
    //   bamboo launcher (the "Tactical Kratib").  The sound is a low-mid
    //   pressure burst:
    //     • Deep sine body (130 → 55 Hz) models the air column inside the tube
    //       releasing its pressure as the clump exits.
    //     • Triangle transient click (280 → 100 Hz, 60 ms) is the wooden "pop"
    //       of the bamboo mechanism — snappy attack, very fast decay.
    //   Combined they produce a distinctive thump clearly different from Kao's
    //   metallic rifle sounds.
    playPoomShoot() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        // ── Layer 1: Sine body — the bamboo-tube "thump" ──
        const body     = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();

        body.connect(bodyGain);
        bodyGain.connect(this.ctx.destination);

        body.type = 'sine';
        body.frequency.setValueAtTime(130, this.ctx.currentTime);
        // Pitch sweeps downward — simulates pressure releasing from the tube bore
        body.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.18);

        bodyGain.gain.setValueAtTime(
            GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume * 1.1,
            this.ctx.currentTime
        );
        bodyGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

        body.start(this.ctx.currentTime);
        body.stop(this.ctx.currentTime + 0.18);

        // ── Layer 2: Triangle click — bamboo "pop" transient ──
        const click     = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();

        click.connect(clickGain);
        clickGain.connect(this.ctx.destination);

        click.type = 'triangle';
        click.frequency.setValueAtTime(280, this.ctx.currentTime);
        click.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.06);

        // Very fast decay — just the initial transient click, no sustain
        clickGain.gain.setValueAtTime(
            GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume * 0.55,
            this.ctx.currentTime
        );
        clickGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);

        click.start(this.ctx.currentTime);
        click.stop(this.ctx.currentTime + 0.06);
    }

    // ── NEW: Naga strike — sharp energy burst / hiss ─────────────────────────
    // Design rationale:
    //   The Naga is a magical serpent that deals continuous energy damage.
    //   Each registered hit sounds like a brief burst of mystical static:
    //     • White noise through a bandpass filter (1200 Hz centre, Q=1.8)
    //       gives the "sizzle" — mid-high, magical, slightly aggressive.
    //     • Sine shimmer (900 → 1300 Hz) is the sparkle accent on contact —
    //       lifts above the noise to add a characteristic energy quality.
    //   Duration is intentionally short (≤ 120 ms) so rapid collision ticks
    //   don't stack.  Rate-limiting in NagaEntity.update() provides an
    //   additional guarantee (one sound per 220 ms maximum).
    playNagaAttack() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        // ── Layer 1: White noise burst through bandpass filter ──
        const bufferSize  = Math.floor(this.ctx.sampleRate * 0.12); // 120 ms of noise
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const noiseData   = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const bpFilter = this.ctx.createBiquadFilter();
        bpFilter.type            = 'bandpass';
        bpFilter.frequency.value = 1200; // centre frequency — the "sizzle" mid-high
        bpFilter.Q.value         = 1.8;  // moderate Q — wide enough to sound natural

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(
            GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * 0.65,
            this.ctx.currentTime
        );
        // Fast exponential fade so sequential hits stay clean
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.10);

        noiseSource.connect(bpFilter);
        bpFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseSource.start(this.ctx.currentTime);
        noiseSource.stop(this.ctx.currentTime + 0.12);

        // ── Layer 2: Sine shimmer — magical sparkle on impact ──
        const shimmer     = this.ctx.createOscillator();
        const shimmerGain = this.ctx.createGain();

        shimmer.connect(shimmerGain);
        shimmerGain.connect(this.ctx.destination);

        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(900, this.ctx.currentTime);
        shimmer.frequency.linearRampToValueAtTime(1300, this.ctx.currentTime + 0.07);

        shimmerGain.gain.setValueAtTime(
            GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * 0.35,
            this.ctx.currentTime
        );
        shimmerGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.09);

        shimmer.start(this.ctx.currentTime);
        shimmer.stop(this.ctx.currentTime + 0.09);
    }

    playDash() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        // Layer 1: White noise burst with high-pass filter
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.15); // 150 ms of noise
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const highPassFilter = this.ctx.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = 800; // Remove low frequencies for "whoosh" effect
        highPassFilter.Q.value = 1.2;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(
            GAME_CONFIG.audio.dash * this.masterVolume * this.sfxVolume * 0.4,
            this.ctx.currentTime
        );
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

        noiseSource.connect(highPassFilter);
        highPassFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseSource.start(this.ctx.currentTime);
        noiseSource.stop(this.ctx.currentTime + 0.15);

        // Layer 2: Sine sweep for body
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 200;
        gain.gain.setValueAtTime(
            GAME_CONFIG.audio.dash * this.masterVolume * this.sfxVolume * 0.6,
            this.ctx.currentTime
        );

        osc.start();
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // ── ENHANCED: Enemy Hit SFX ────────────────────────────────────────────────
    playHit() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'square'; // Harsher sound for enemy hits
        osc.frequency.value = 250;
        gain.gain.setValueAtTime(
            GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * 0.7,
            this.ctx.currentTime
        );

        osc.start();
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.stop(this.ctx.currentTime + 0.08);
    }

    // ── NEW: Player Damage SFX - Jarring harsh synth chord ───────────────────────────
    playPlayerDamage() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        // Create a dissonant chord for player damage
        const frequencies = [150, 180, 220]; // Dissonant minor second interval
        
        frequencies.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.type = 'sawtooth'; // Harsher waveform for player damage
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(
                GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * 0.8,
                this.ctx.currentTime
            );
            
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
            osc.stop(this.ctx.currentTime + 0.2);
        });
    }

    // IMPROVED: Power-up - Pleasant chime
    playPowerUp() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 500;
        gain.gain.value = GAME_CONFIG.audio.powerUp * this.masterVolume * this.sfxVolume;

        osc.start();
        osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc.stop(this.ctx.currentTime + 0.25);
    }

    // IMPROVED: Achievement - Gentle triple chime
    playAchievement() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        [0, 0.08, 0.16].forEach((delay, i) => {
            setTimeout(() => {
                // ── STABILITY FIX (Zone 3 / Bug A): Re-check enabled and ctx
                // inside the callback. If mute() is called during the 0–160 ms
                // scheduling window the outer guard has already passed.
                if (!this.enabled || !this.ctx) return;

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.type = 'sine';
                osc.frequency.value = 600 + i * 150;
                gain.gain.value = GAME_CONFIG.audio.achievement * this.masterVolume * this.sfxVolume;

                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
                osc.stop(this.ctx.currentTime + 0.15);
            }, delay * 1000);
        });
    }

    // IMPROVED: Weapon switch - Soft click
    playWeaponSwitch() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 600;
        gain.gain.value = GAME_CONFIG.audio.weaponSwitch * this.masterVolume * this.sfxVolume;

        osc.start();
        osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.stop(this.ctx.currentTime + 0.08);
    }

    // IMPROVED: Enemy death - Smooth fade
    playEnemyDeath() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 300;
        gain.gain.value = GAME_CONFIG.audio.enemyDeath * this.masterVolume * this.sfxVolume;

        osc.start();
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc.stop(this.ctx.currentTime + 0.25);
    }

    // IMPROVED: Boss special - Smooth powerful sound
    playBossSpecial() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 150;
        gain.gain.value = GAME_CONFIG.audio.bossSpecial * this.masterVolume * this.sfxVolume;

        osc.start();
        osc.frequency.linearRampToValueAtTime(400, this.ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
        osc.stop(this.ctx.currentTime + 0.35);
    }

    // IMPROVED: Meteor warning - Gentle pulsing
    playMeteorWarning() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 700;
        gain.gain.value = GAME_CONFIG.audio.meteorWarning * this.masterVolume * this.sfxVolume;

        osc.start();

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
        this._ensureAudioContextRunning();

        const frequencies = [523, 659, 784]; // C, E, G chord

        frequencies.forEach((freq, i) => {
            setTimeout(() => {
                // ── STABILITY FIX (Zone 3 / Bug A): Re-check inside callback.
                if (!this.enabled || !this.ctx) return;

                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.value = GAME_CONFIG.audio.levelUp * this.masterVolume * this.sfxVolume;

                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
                osc.stop(this.ctx.currentTime + 0.3);
            }, i * 80);
        });
    }

    // NEW: Heal sound - Gentle restore
    playHeal() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.value = GAME_CONFIG.audio.heal * this.masterVolume * this.sfxVolume;

        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // ── BGM MANAGER SYSTEM ───────────────────────────────────────────────────────
    
    playBGM(type) {
        if (!this.enabled || !this.userInteracted) {
            console.log('🎵 BGM waiting for user interaction...');
            return;
        }
        
        const bgmPath = GAME_CONFIG.audio.bgmPaths[type];
        if (!bgmPath || bgmPath.trim() === '') {
            console.log('🎵 BGM path is empty, skipping.');
            return;
        }
        
        // Stop current BGM if playing
        this.stopBGM();
        
        try {
            this.bgmAudio = new Audio(bgmPath);
            this.bgmAudio.loop = true;
            this.bgmAudio.volume = this.bgmVolume * this.masterVolume;
            
            // Handle autoplay policies
            const playPromise = this.bgmAudio.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        this.currentBGM = type;
                        console.log(`🎵 Now playing BGM: ${type}`);
                    })
                    .catch(error => {
                        console.warn('🎵 BGM autoplay failed:', error);
                        // Try again on next user interaction
                        this.setupRetryBGM(type);
                    });
            }
            
            // Handle ended event with proper cleanup
            // Defensive: ensure no stale listener is attached
            if (this._bgmEndedListener) {
                try { this.bgmAudio.removeEventListener('ended', this._bgmEndedListener); } catch (e) {}
            }
            this._bgmEndedListener = () => {
                if (this.currentBGM === type) {
                    this.bgmAudio.currentTime = 0;
                    this.bgmAudio.play();
                }
            };
            this.bgmAudio.addEventListener('ended', this._bgmEndedListener);
            
        } catch (error) {
            console.error('🎵 Error loading BGM:', error);
        }
    }
    
    setupRetryBGM(type) {
        // Prevent race conditions
        if (this._retryHandlerActive) {
            return;
        }
        this._retryHandlerActive = true;
        
        const retryPlay = () => {
            if (this.userInteracted && this.currentBGM !== type) {
                this._retryHandlerActive = false;
                this.playBGM(type);
                if (this._bgmRetryListener) {
                    document.removeEventListener('click', this._bgmRetryListener);
                    document.removeEventListener('keydown', this._bgmRetryListener);
                    this._bgmRetryListener = null;
                }
            }
        };

        // Store for cleanup; listeners are {once:true} but we still clear refs
        this._bgmRetryListener = retryPlay;
        document.addEventListener('click', retryPlay, { once: true });
        document.addEventListener('keydown', retryPlay, { once: true });
    }
    
    stopBGM() {
        if (this.bgmAudio) {
            // Clean up event listener to prevent memory leaks
            if (this._bgmEndedListener) {
                this.bgmAudio.removeEventListener('ended', this._bgmEndedListener);
                this._bgmEndedListener = null;
            }

            // Clean up any pending retry listener
            if (this._bgmRetryListener) {
                document.removeEventListener('click', this._bgmRetryListener);
                document.removeEventListener('keydown', this._bgmRetryListener);
                this._bgmRetryListener = null;
                this._retryHandlerActive = false;
            }
            
            this.bgmAudio.pause();
            this.bgmAudio.currentTime = 0;
            this.bgmAudio = null;
            this.currentBGM = null;
            console.log('🎵 BGM stopped');
        }
    }
    
    setBGMVolume(volume) {
        this.bgmVolume = clamp(volume, 0, 1);
        if (this.bgmAudio) {
            this.bgmAudio.volume = this.bgmVolume * this.masterVolume;
        }
    }
    
    setSFXVolume(volume) {
        this.sfxVolume = clamp(volume, 0, 1);
    }
    
    setMasterVolume(volume) {
        this.masterVolume = clamp(volume, 0, 1);
        // Update BGM volume if playing
        if (this.bgmAudio) {
            this.bgmAudio.volume = this.bgmVolume * this.masterVolume;
        }
    }

    getMasterVolume() {
        return this.masterVolume;
    }

    mute()   { this.enabled = false; }
    unmute() { this.enabled = true;  }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

var Audio = new AudioSystem();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Audio, AudioSystem };
}