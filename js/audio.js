'use strict';
/**
 * js/audio.js
 * ════════════════════════════════════════════════
 * Procedural Web Audio API sound engine. All SFX synthesised at runtime —
 * no audio files loaded. Single AudioSystem class, exported as window.Audio.
 * 1736 lines.
 *
 * Design notes:
 *   - All sounds use AudioContext oscillators/buffers routed through GainNodes.
 *     No <audio> elements except BGM (HTMLAudioElement for streaming).
 *   - init() must be called from a user-gesture handler (click/keydown) to
 *     satisfy browser autoplay policy. _ensureAudioContextRunning() re-resumes
 *     a suspended context on subsequent gestures.
 *   - BGM uses a crossfade + HTMLAudioElement → GainNode → destination routing.
 *     Pre-interaction BGM calls are queued and flushed on first interaction.
 *   - playBGM() guards against same-track re-start (SAME-TRACK GUARD at L.1114).
 *   - setSFXVolume() / setMasterVolume() adjust gain nodes live.
 *   - playSound(name) is a generic alias required by Debug.html — maps to playHit().
 *
 * Integration:
 *   game.js, players, bosses → Audio.playXxx() directly
 *   game.js                  → Audio.init() on first user gesture
 *   game.js                  → Audio.playBGM('menu'|'game'|'boss')
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.76   AudioSystem              class definition
 *  L.124  .init()                  create AudioContext, master gain, BGM gain
 *  L.174  ._ensureAudioContextRunning()  resume suspended context
 *  L.180  .playShootAuto/Sniper/Shotgun  weapon fire SFX (3 variants)
 *  L.243  .playShoot()             dispatcher → weapon-type SFX
 *  L.266  .playPoomShoot()         bamboo-tube two-layer thump
 *  L.324  .playNagaAttack()        energy burst + sine shimmer
 *  L.387  .playStandRush()         Auto stand-rush punch thud+snap
 *  L.442  .playStealth()           Kao free-stealth digital swoosh
 *  L.463  .playClone()             Kao clone activation ping
 *  L.483  .playRiceShoot()         Poom normal shoot splat
 *  L.507  .playRitualBurst()       Poom ritual magic explosion
 *  L.540  .playPunch()             Auto heat-wave punch whoosh
 *  L.582  .playVacuum()            Auto Q whoosh-pull
 *  L.629  .playDetonation()        Auto E overheat explosion
 *  L.683  .playPhantomShatter()    Kao clone-expiry 8-way crystal break
 *  L.721  .playDash()              dash whoosh
 *  L.778  .playSound()             generic alias → playHit() (Debug.html compat)
 *  L.791  .playHit()               enemy hit SFX
 *  L.815  .playPlayerDamage()      player damage harsh chord
 *  L.843  .playPowerUp()           power-up chime
 *  L.864  .playAchievement()       achievement unlock fanfare
 *  L.893  .playWeaponSwitch()      weapon swap click
 *  L.914  .playEnemyDeath()        enemy death pop
 *  L.935  .playBossSpecial()       boss special attack cue
 *  L.956  .playMeteorWarning()     meteor incoming warning
 *  L.979  .playLevelUp()           level-up ascend tone
 *  L.1009 .playMtcEntry()          MTC Room entry chime
 *  L.1030 .playMtcBuff()           MTC Room buff activation ping
 *  L.1045 .playHeal()              heal pickup tone
 *  L.1066 .playBGM()               BGM manager — crossfade + autoplay queue
 *  L.1287 ._crossfadeOutAndStop()  BGM fade-out helper
 *  L.1406 .setSFXVolume()          live SFX gain adjust
 *  L.1410 .setMasterVolume()       live master gain adjust
 *  L.1424 .getMasterVolume()       read master gain
 *  L.1439 .playPatSlash()          Pat slash wave SFX
 *  L.1472 .playPatMeleeHit()       Pat melee combo contact
 *  L.1510 .playPatReflect()        Pat Blade Guard reflect
 *  L.1543 .playPatZanzo()          Pat Zanzo Flash teleport
 *  L.1582 .playPatIaidoCharge()    Pat Iaido Phase 1 charge
 *  L.1618 .playPatIaidoStrike()    Pat Iaido Phase 2 impact
 *  L.1653 .playPatSheathe()        Pat Iaido Phase 3 sheathe
 *  L.1684 .playShellDrop()         shell casing metallic tink
 *  L.1727 Audio (instance)         window.Audio singleton
 *
 * ⚠️  AudioContext must be created inside a user-gesture — init() is gated.
 *     Calling any playXxx() before init() is safe (context guard exits silently).
 * ⚠️  BGM uses HTMLAudioElement, not oscillators — subject to browser autoplay block.
 *     Queued calls in _bgmQueue are flushed on first successful interaction.
 * ⚠️  Do NOT rename window.Audio — many call sites use Audio.playXxx() directly.
 *     Shadowing the browser's built-in Audio constructor is intentional here.
 * ════════════════════════════════════════════════
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
        // ── Crossfade ──────────────────────────────────────────────────────────────
        this._bgmGainNode = null;      // GainNode ควบคุม volume ของ BGM ปัจจุบัน
        this._bgmSourceNode = null;    // MediaElementSourceNode wrapper
        this._fadeOutTimer = null;     // setTimeout handle ของ track ที่กำลัง fade out

        // ── Task 3: autoplay-block tracking flag ─────────────────────────────
        // Set true inside .catch() of bgmAudio.play() when the browser's
        // autoplay policy blocks playback.  Cleared on successful play or stop.
        this._bgmWaitingForInteraction = false;

        // ── In-flight play() guard ────────────────────────────────────────────
        // Set true the instant bgmAudio.play() is called; cleared in .then()
        // and .catch().  retryPlay checks this before retrying so it does NOT
        // interrupt a battle BGM whose .then() hasn't resolved yet — the
        // Promise microtask is still pending when the document 'click' event
        // bubbles up and would otherwise fire retryPlay on the same gesture.
        this._bgmPlayInProgress = false;

        // ── BGM queue for pre-interaction calls ───────────────────────────────
        // When playBGM() is called before the user has interacted with the page
        // (e.g. menu BGM requested from window.onload before any click/key),
        // the requested type is stored here.  setupUserInteractionListener()'s
        // enableAudio callback reads this field and plays it the moment the
        // browser allows audio output.
        // Rule: always holds the MOST RECENT requested type so a later call
        // (e.g. 'battle' requested while 'menu' is still pending) wins.
        this._pendingBGM = null;

        // Retry handler guard flag — prevents duplicate retry listeners
        this._retryHandlerActive = false;

        // Event listener references for safe cleanup
        this._bgmEndedListener = null;
        this._bgmRetryListener = null;
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            // console.log('✅ Audio System initialized');

            // Set up user interaction listener for BGM autoplay compliance
            this.setupUserInteractionListener();
        } catch (e) {
            console.warn('⚠️ Audio not supported:', e);
            this.enabled = false;
        }
    }

    setupUserInteractionListener() {
        // Enable BGM after first user interaction (click, keypress, touchstart).
        //
        // WHY THIS MATTERS FOR MENU / BATTLE BGM:
        //   Browsers block audio autoplay until the user makes a gesture.
        //   window.onload fires before any gesture, so Audio.playBGM('menu')
        //   is called while userInteracted is still false — it stores the type
        //   in _pendingBGM and returns.  The moment enableAudio fires below,
        //   we play that pending track.  By the time startGame() calls
        //   Audio.playBGM('battle'), userInteracted is already true (the user
        //   clicked the Start button), so 'battle' plays immediately and also
        //   overwrites any _pendingBGM that hasn't fired yet.
        const enableAudio = () => {
            this.userInteracted = true;
            // NOTE: _ensureAudioContextRunning() is intentionally NOT called here.
            // Calling ctx.resume() before audio.play() can interfere with Chrome's
            // gesture activation token for HTML5 audio in some versions.
            // AudioContext resumption for SFX is handled lazily inside each
            // playX() method — BGM uses an <audio> element which is independent.

            // Play any BGM that was requested before the first interaction
            if (this._pendingBGM) {
                const type = this._pendingBGM;
                this._pendingBGM = null;
                // console.log(`🎵 User interacted — playing queued BGM: ${type}`);
                this.playBGM(type);
            }
        };

        // {once: true} means each listener auto-removes after firing once,
        // so we don't need manual removeEventListener calls inside the callback.
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

        const t = this.ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        gain.gain.setValueAtTime(GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume * (this._weaponGainMult ?? 1.0), t);

        osc.start(t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.stop(t + 0.05);
    }

    // IMPROVED: Sniper - Deep but smooth
    playShootSniper() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const t = this.ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(250, t);
        gain.gain.setValueAtTime(GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume * (this._weaponGainMult ?? 1.0), t);

        osc.start(t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.stop(t + 0.2);
    }

    // IMPROVED: Shotgun - Punchy but not harsh
    playShootShotgun() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const t = this.ctx.currentTime;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        gain.gain.setValueAtTime(GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume * (this._weaponGainMult ?? 1.0), t);

        osc.start(t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        osc.stop(t + 0.12);
    }

    playShoot(weaponType = 'auto') {
        // Apply per-weapon gain multiplier from config (fallback 1.0)
        this._weaponGainMult = (GAME_CONFIG.audio.weaponGain?.[weaponType] ?? 1.0);
        switch (weaponType) {
            case 'auto': this.playShootAuto(); break;
            case 'sniper': this.playShootSniper(); break;
            case 'shotgun': this.playShootShotgun(); break;
            default: this.playShootAuto();
        }
        this._weaponGainMult = 1.0; // reset after use
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
        const body = this.ctx.createOscillator();
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
        const click = this.ctx.createOscillator();
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
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.12); // 120 ms of noise
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = noiseBuffer;

        const bpFilter = this.ctx.createBiquadFilter();
        bpFilter.type = 'bandpass';
        bpFilter.frequency.value = 1200; // centre frequency — the "sizzle" mid-high
        bpFilter.Q.value = 1.8;  // moderate Q — wide enough to sound natural

        const noiseGain = this.ctx.createGain();
        const nagaGainMult = GAME_CONFIG.audio.sfx?.nagaAttack ?? 0.55;
        noiseGain.gain.setValueAtTime(
            GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * nagaGainMult,
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
        const shimmer = this.ctx.createOscillator();
        const shimmerGain = this.ctx.createGain();

        shimmer.connect(shimmerGain);
        shimmerGain.connect(this.ctx.destination);

        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(900, this.ctx.currentTime);
        shimmer.frequency.linearRampToValueAtTime(1300, this.ctx.currentTime + 0.07);

        shimmerGain.gain.setValueAtTime(
            GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * nagaGainMult * 0.55,
            this.ctx.currentTime
        );
        shimmerGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.09);

        shimmer.start(this.ctx.currentTime);
        shimmer.stop(this.ctx.currentTime + 0.09);
    }

    // ── NEW: Stand Rush Punch SFX ───────────────────────────────────────────
    // Design rationale:
    //   Rapid-fire heavy punches (JoJo style "Ora Ora / Muda Muda").
    //   Must be very short so it doesn't clip or overwhelm when fired every 60ms.
    //   - Layer 1: Pitch-sweeping sine (200Hz -> 50Hz) for the physical 'thud'.
    //   - Layer 2: Short noise burst for the impact snap.
    playStandRush() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const t = this.ctx.currentTime;
        const dur = 0.08; // Very short duration
        // StandRush fires every 60ms — keep gain low to avoid distortion stacking
        const gainMult = GAME_CONFIG.audio.sfx?.standRush ?? 0.45;

        // ── Layer 1: Thud (Low Sine Sweep) ──
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + dur);

        gain.gain.setValueAtTime(GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

        osc.start(t);
        osc.stop(t + dur);

        // ── Layer 2: Impact Snap (Filtered Noise) ──
        const noiseSize = Math.floor(this.ctx.sampleRate * dur);
        const noiseBuf = this.ctx.createBuffer(1, noiseSize, this.ctx.sampleRate);
        const noiseData = noiseBuf.getChannelData(0);
        for (let i = 0; i < noiseSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }

        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuf;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 1000;
        noiseFilter.Q.value = 1.0;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult * 0.6, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + dur);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseSrc.start(t);
        noiseSrc.stop(t + dur);
    }

    // ── NEW: Stealth/Warp digital swoosh (Kao isFreeStealthy) ─────────────────
    // Sine wave sweeps 600 → 100 Hz in 0.3s — "cloak activating" warping feel.
    playStealth() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const t = this.ctx.currentTime;
        const gainMult = GAME_CONFIG.audio.sfx?.stealth ?? 0.5;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
        // Skill sounds use sfxVolume directly (not combat 'hit') — subtler, ambient
        gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * gainMult, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    // ── NEW: Clone split "ping" (Kao clone activation) ────────────────────────
    // High Sine at 1200 Hz, very short 0.15s — crisp chime on clone spawn.
    playClone() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const t = this.ctx.currentTime;
        const gainMult = GAME_CONFIG.audio.sfx?.clone ?? 0.4;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.15);
        gain.gain.setValueAtTime(GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
    }

    // ── NEW: Sticky rice "splat/thud" (Poom normal shoot) ─────────────────────
    // Square wave 120 → 70 Hz + lowpass filter, 0.1s — thick sticky thump.
    playRiceShoot() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const t = this.ctx.currentTime;
        const gainMult = GAME_CONFIG.audio.sfx?.riceShoot ?? 0.6;
        const osc = this.ctx.createOscillator();
        const lpf = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.connect(lpf);
        lpf.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
        lpf.type = 'lowpass';
        lpf.frequency.value = 400;
        gain.gain.setValueAtTime(GAME_CONFIG.audio.shoot * this.masterVolume * this.sfxVolume * gainMult, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
    }

    // ── NEW: Ritual Burst magic explosion (Poom ritual) ───────────────────────
    // Square wave 200 → 40 Hz sub-bass drop in 0.5s — heavy ceremonial boom.
    playRitualBurst() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const t = this.ctx.currentTime;
        const gainMult = GAME_CONFIG.audio.sfx?.ritualBurst ?? 0.8;
        // Layer 1: Sub-bass drop
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
        gain.gain.setValueAtTime(GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult * 1.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
        // Layer 2: Mystical shimmer accent
        const shimmer = this.ctx.createOscillator();
        const shimGain = this.ctx.createGain();
        shimmer.connect(shimGain);
        shimGain.connect(this.ctx.destination);
        shimmer.type = 'sine';
        shimmer.frequency.setValueAtTime(800, t);
        shimmer.frequency.exponentialRampToValueAtTime(200, t + 0.3);
        shimGain.gain.setValueAtTime(GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult * 0.5, t);
        shimGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        shimmer.start(t);
        shimmer.stop(t + 0.3);
    }

    // ── NEW: Punch whoosh/thwack (Auto normal heat wave) ──────────────────────
    // Short noise burst + Triangle sweep 180 → 60 Hz, 0.1s — fast air strike.
    playPunch() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const t = this.ctx.currentTime;
        const dur = 0.1;
        const gainMult = GAME_CONFIG.audio.sfx?.punch ?? 0.6;
        // Triangle sweep
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + dur);
        gain.gain.setValueAtTime(GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        osc.start(t);
        osc.stop(t + dur);
        // Short noise snap
        const noiseSz = Math.floor(this.ctx.sampleRate * dur * 0.5);
        const noiseBuf = this.ctx.createBuffer(1, noiseSz, this.ctx.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < noiseSz; i++) nd[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = noiseBuf;
        const hpf = this.ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 600;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult * 0.5, t);
        nGain.gain.exponentialRampToValueAtTime(0.01, t + dur * 0.5);
        src.connect(hpf);
        hpf.connect(nGain);
        nGain.connect(this.ctx.destination);
        src.start(t);
        src.stop(t + dur * 0.5);
    }

    // ── NEW: Vacuum Heat "whoosh-pull" (Auto Q skill) ─────────────────────────
    // Design: เสียงดูดอากาศเข้าหาตัว — White noise filtered downward (high→low)
    // Layer 1: Noise sweep ดึงความถี่ลง (HPF จาก 1500→200 Hz ใน 0.4s)
    // Layer 2: Sine ต่ำๆ 80→40 Hz เพิ่ม "ความหนัก" ของแรงดูด
    playVacuum() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const t = this.ctx.currentTime;
        const dur = 0.45;
        const gainMult = GAME_CONFIG.audio.sfx?.vacuum ?? 0.65;

        // Layer 1: Noise with sweeping HPF — เสียงอากาศถูกดูด
        const bufSz = Math.floor(this.ctx.sampleRate * dur);
        const noiseBuf = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < bufSz; i++) nd[i] = Math.random() * 2 - 1;
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseBuf;
        const hpf = this.ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.setValueAtTime(1500, t);
        hpf.frequency.exponentialRampToValueAtTime(120, t + dur); // sweep ลง
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.01, t);
        nGain.gain.linearRampToValueAtTime(
            this.masterVolume * this.sfxVolume * gainMult, t + dur * 0.3
        );
        nGain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        noiseSrc.connect(hpf); hpf.connect(nGain); nGain.connect(this.ctx.destination);
        noiseSrc.start(t); noiseSrc.stop(t + dur);

        // Layer 2: Sub-bass "gravity pull" tone
        const osc = this.ctx.createOscillator();
        const oGain = this.ctx.createGain();
        osc.connect(oGain); oGain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(35, t + dur);
        oGain.gain.setValueAtTime(0.01, t);
        oGain.gain.linearRampToValueAtTime(
            this.masterVolume * this.sfxVolume * gainMult * 0.7, t + dur * 0.2
        );
        oGain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        osc.start(t); osc.stop(t + dur);
    }

    // ── NEW: Overheat Detonation explosion (Auto E skill) ─────────────────────
    // Design: ระเบิดสแตนด์กัมปนาท — sub-bass หนักๆ + noise burst กว้างๆ
    // Layer 1: Square wave 200→30 Hz — "thud" ของแรงระเบิด
    // Layer 2: Noise broadband — shockwave ที่แผ่ออกไป
    // Layer 3: Sine shimmer 1000→400 Hz — afterburn tone สแตนด์วันชัย
    playDetonation() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const t = this.ctx.currentTime;
        const gainMult = GAME_CONFIG.audio.sfx?.detonation ?? 0.85;

        // Layer 1: Square sub-bass boom
        const osc = this.ctx.createOscillator();
        const oGain = this.ctx.createGain();
        osc.connect(oGain); oGain.connect(this.ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(28, t + 0.4);
        oGain.gain.setValueAtTime(
            GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult, t
        );
        oGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.start(t); osc.stop(t + 0.4);

        // Layer 2: Broadband noise burst
        const bufSz = Math.floor(this.ctx.sampleRate * 0.3);
        const nb = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < bufSz; i++) nd[i] = Math.random() * 2 - 1;
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = nb;
        const lpf = this.ctx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = 900;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(
            GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult * 0.9, t
        );
        nGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        nSrc.connect(lpf); lpf.connect(nGain); nGain.connect(this.ctx.destination);
        nSrc.start(t); nSrc.stop(t + 0.3);

        // Layer 3: High shimmer (สแตนด์วันชัยสลาย)
        const sh = this.ctx.createOscillator();
        const shG = this.ctx.createGain();
        sh.connect(shG); shG.connect(this.ctx.destination);
        sh.type = 'sine';
        sh.frequency.setValueAtTime(1000, t + 0.05);
        sh.frequency.exponentialRampToValueAtTime(400, t + 0.5);
        shG.gain.setValueAtTime(
            GAME_CONFIG.audio.hit * this.masterVolume * this.sfxVolume * gainMult * 0.4,
            t + 0.05
        );
        shG.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        sh.start(t + 0.05); sh.stop(t + 0.5);
    }

    // ── NEW: Phantom Shatter crystal-break (Kao clone expires → 8-way burst) ───
    // Design: กระจกดิจิทัลแตก — high-pitched noise ผ่าน bandpass + sine glitch
    // สั้นมาก (0.2s) เพราะอาจเกิด 2 ครั้งพร้อมกัน (2 clones)
    playPhantomShatter() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const t = this.ctx.currentTime;
        const dur = 0.22;
        const gainMult = GAME_CONFIG.audio.sfx?.phantomShatter ?? 0.5;

        // Layer 1: High noise through tight bandpass
        const bufSz = Math.floor(this.ctx.sampleRate * dur);
        const nb = this.ctx.createBuffer(1, bufSz, this.ctx.sampleRate);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < bufSz; i++) nd[i] = Math.random() * 2 - 1;
        const nSrc = this.ctx.createBufferSource();
        nSrc.buffer = nb;
        const bpf = this.ctx.createBiquadFilter();
        bpf.type = 'bandpass'; bpf.frequency.value = 3200; bpf.Q.value = 2.5;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(
            this.masterVolume * this.sfxVolume * gainMult, t
        );
        nGain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        nSrc.connect(bpf); bpf.connect(nGain); nGain.connect(this.ctx.destination);
        nSrc.start(t); nSrc.stop(t + dur);

        // Layer 2: Sine glitch 2400→800 Hz — digital "ping" ตอนแตก
        const osc = this.ctx.createOscillator();
        const oGain = this.ctx.createGain();
        osc.connect(oGain); oGain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2400, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + dur);
        oGain.gain.setValueAtTime(
            this.masterVolume * this.sfxVolume * gainMult * 0.7, t
        );
        oGain.gain.exponentialRampToValueAtTime(0.01, t + dur);
        osc.start(t); osc.stop(t + dur);
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

    // ── COMPAT: Generic playSound(name) alias — required by Debug.html check ──────
    // Maps common sound names to specific methods so external callers can use
    // Audio.playSound('hit'), Audio.playSound('shoot'), etc.
    playSound(name = 'hit') {
        switch (name) {
            case 'shoot': this.playShoot(); break;
            case 'hit': this.playHit(); break;
            case 'powerup': this.playPowerUp(); break;
            case 'death': this.playEnemyDeath(); break;
            case 'level': this.playLevelUp(); break;
            case 'heal': this.playHeal(); break;
            default: this.playHit(); break;
        }
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
        osc.frequency.setValueAtTime(700, this.ctx.currentTime);
        osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.13);
        osc.frequency.setValueAtTime(700, this.ctx.currentTime + 0.26);
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
    // ── MTC Room: Entry chime ───────────────────────────────────
    playMtcEntry() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        // Rising 3-note arpeggio: 440 → 550 → 660 Hz
        [0, 0.07, 0.14].forEach((delay, i) => {
            setTimeout(() => {
                if (!this.enabled || !this.ctx) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain); gain.connect(this.ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = 440 + i * 110;
                gain.gain.value = 0.08 * this.masterVolume * this.sfxVolume;
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
                osc.stop(this.ctx.currentTime + 0.18);
            }, delay * 1000);
        });
    }

    // ── MTC Room: Buff activation — bright ping ──────────────
    playMtcBuff() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(900, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.08);
        gain.gain.value = 0.10 * this.masterVolume * this.sfxVolume;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.20);
        osc.stop(this.ctx.currentTime + 0.20);
    }

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
        if (!this.enabled) return;

        const bgmPath = GAME_CONFIG.audio.bgmPaths[type];
        if (!bgmPath || bgmPath.trim() === '') {
            // console.log('🎵 BGM path is empty, skipping.');
            return;
        }

        // ── PRE-INTERACTION QUEUE ─────────────────────────────────────────────
        // Browsers block audio autoplay until a user gesture has occurred.
        //
        // Root problem (menu + battle BGM never playing):
        //   • window.onload calls Audio.playBGM('menu') before ANY interaction
        //     → userInteracted is false → old code returned immediately,
        //     silently discarding the request.
        //   • startGame() calls Audio.init() then Audio.playBGM('battle')
        //     in the same synchronous stack as the "Start" button click.
        //     Audio.init() calls setupUserInteractionListener() — but the click
        //     that triggered startGame() already fired BEFORE the listener was
        //     attached, so userInteracted never became true.
        //     Battle BGM was therefore also silently discarded.
        //   • Boss BGM worked only because by Wave 3 the user had pressed keys
        //     and clicked many times AFTER Audio.init(), so userInteracted had
        //     eventually been set to true by those later events.
        //
        // Fix: instead of returning and discarding, store the type in
        //   _pendingBGM (most-recent requested type wins), then return.
        //   setupUserInteractionListener()'s enableAudio callback detects this
        //   field and calls playBGM(type) the instant the user first interacts.
        //
        // Timeline after fix:
        //   window.onload  → Audio.init() → playBGM('menu')
        //                    userInteracted=false → _pendingBGM='menu', return
        //   user clicks "Start Game"
        //     → enableAudio fires → userInteracted=true
        //     → _pendingBGM='menu' → playBGM('menu') → menu BGM starts
        //     → startGame() → playBGM('battle') → stopBGM() + battle BGM starts
        //   Wave 3 boss → playBGM('boss') → stopBGM() + boss BGM starts
        if (!this.userInteracted) {
            // console.log(`🎵 BGM queued until user interaction: ${type}`);
            this._pendingBGM = type;   // most-recent requested type always wins
            return;
        }

        // Clear any pending BGM since we're now playing a real track
        this._pendingBGM = null;

        // ── SAME-TRACK GUARD ──────────────────────────────────────────────────
        // ถ้าเพลงที่ขอเหมือนกับที่เล่นอยู่ และกำลังเล่นจริงๆ → ไม่ทำอะไร
        // แก้ปัญหา: wave ใหม่ที่ใช้ track เดิม (battle→battle) จะไม่ตัดเพลง
        if (this.currentBGM === type && this.bgmAudio && !this.bgmAudio.paused) {
            return;
        }

        // ── CROSSFADE OUT old track (ถ้ามี) ──────────────────────────────────
        this._crossfadeOutAndStop();

        try {
            // ── TASK 1 FIX: Use document.createElement('audio') ──────────────
            //
            // ❌ OLD (broken):
            //      this.bgmAudio = new window.Audio(bgmPath);
            //
            //    The `var Audio = new AudioSystem()` declaration at the bottom
            //    of this file assigns an AudioSystem instance to `window.Audio`
            //    (because `var` in global scope hoists to `window`). Calling
            //    `new window.Audio(...)` therefore attempts to invoke an instance
            //    as a constructor, which throws:
            //
            //      TypeError: window.Audio is not a constructor
            //
            // ✅ NEW (immune to all constructor shadowing):
            //      this.bgmAudio     = document.createElement('audio');
            //      this.bgmAudio.src = bgmPath;
            //
            //    `document.createElement` is a method on the `document` host
            //    object and resolves completely independently of the `window.Audio`
            //    property.  It returns an identical HTMLAudioElement in every
            //    browser and cannot be shadowed by `var Audio = …`.
            //
            //    All subsequent operations — .loop, .volume, .play(), .pause(),
            //    .currentTime, addEventListener — are identical on both objects.
            this.bgmAudio = document.createElement('audio');
            this.bgmAudio.src = bgmPath;
            this.bgmAudio.loop = true;

            // ── Web Audio routing: HTMLAudioElement → GainNode → destination ──
            // ทำให้ volume fade เป็น sample-accurate แทน setTimeout
            // Guard: ctx อาจ null ถ้า init() ล้มเหลว
            if (this.ctx) {
                try {
                    this._ensureAudioContextRunning();
                    this._bgmSourceNode = this.ctx.createMediaElementSource(this.bgmAudio);
                    this._bgmGainNode = this.ctx.createGain();
                    this._bgmGainNode.gain.setValueAtTime(this.bgmVolume * this.masterVolume, this.ctx.currentTime);
                    this._bgmSourceNode.connect(this._bgmGainNode);
                    this._bgmGainNode.connect(this.ctx.destination);
                    // ไม่ set .volume ตรงๆ เพราะ routing ผ่าน GainNode แล้ว
                } catch (webAudioErr) {
                    // fallback: ถ้า createMediaElementSource ล้มเหลว (เช่น element ถูก reuse)
                    console.warn('🎵 Web Audio routing failed, fallback to .volume:', webAudioErr);
                    this._bgmSourceNode = null;
                    this._bgmGainNode = null;
                    this.bgmAudio.volume = this.bgmVolume * this.masterVolume;
                }
            } else {
                this.bgmAudio.volume = this.bgmVolume * this.masterVolume;
            }
            // ── TASK 3 FIX: Robust autoplay promise handling ──────────────────
            //
            // .play() returns a Promise. We must handle rejection or the browser
            // will log an unhandled rejection — and BGM silently never starts.
            //
            // Two-step failure path:
            //   1. this._bgmWaitingForInteraction = true  — set BEFORE calling
            //      setupRetryBGM() so any code that polls this flag sees the
            //      correct state immediately, not after a microtask tick.
            //   2. setupRetryBGM(type)  — installs a one-time click/keydown
            //      listener on document that calls playBGM(type) on next gesture.
            // Mark in-flight BEFORE calling play() so that retryPlay
            // (which may fire synchronously in the same click-event bubble)
            // sees the flag and does not interrupt this pending play().
            this._bgmPlayInProgress = true;
            const playPromise = this.bgmAudio.play();

            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        // ── Success path ──────────────────────────────────────
                        this._bgmPlayInProgress = false;
                        this.currentBGM = type;
                        this._bgmWaitingForInteraction = false;
                        // console.log(`🎵 Now playing BGM: ${type}`);
                    })
                    .catch(error => {
                        // ปลดล็อคสถานะการเล่นก่อนเสมอ
                        this._bgmPlayInProgress = false;

                        // 👇 เพิ่มเงื่อนไขนี้: ถ้าเป็นการสั่งหยุดเล่นกะทันหัน (ข้ามฉาก) ให้จบการทำงานเงียบๆ
                        if (error.name === 'AbortError') {
                            return;
                        }

                        // ── Failure path (เบราว์เซอร์บล็อก Autoplay จริงๆ) ─
                        console.warn('🎵 BGM autoplay blocked or error:', error);
                        this._bgmWaitingForInteraction = true;
                        this.setupRetryBGM(type);
                    });
            }

            // ── Loop-end fallback listener ────────────────────────────────────
            // loop:true handles looping natively, but some older WebView builds
            // (especially on Android) fire 'ended' before the loop restarts.
            // This listener manually seeks to 0 and replays as a safety net.
            // Defensive cleanup: remove any stale listener from a previous track
            // first to prevent double-firing on the same element.
            if (this._bgmEndedListener) {
                try { this.bgmAudio.removeEventListener('ended', this._bgmEndedListener); } catch (e) { }
            }
            this._bgmEndedListener = () => {
                if (this.currentBGM === type) {
                    this.bgmAudio.currentTime = 0;
                    this.bgmAudio.play().catch(err => {
                        console.warn('🎵 BGM loop-restart failed:', err);
                    });
                }
            };
            this.bgmAudio.addEventListener('ended', this._bgmEndedListener);

        } catch (error) {
            console.error('🎵 Error creating or loading BGM element:', error);
        }
    }

    setupRetryBGM(type) {
        // Guard: one retry handler per track at a time
        if (this._retryHandlerActive) {
            return;
        }
        this._retryHandlerActive = true;

        const retryPlay = () => {
            // Abort conditions — do NOT retry if any of these are true:
            //   a) We are no longer waiting (another BGM started successfully).
            //   b) A play() Promise is already in-flight (_bgmPlayInProgress).
            //      This is the KEY guard: when the user clicks "Start Game",
            //      the button onclick fires startGame() → playBGM('battle') →
            //      _bgmPlayInProgress = true, BEFORE the click event bubbles
            //      up to document and triggers retryPlay.  Without this check,
            //      retryPlay would call stopBGM() + playBGM('menu'), killing
            //      the battle BGM before its .then() has a chance to confirm it.
            //   c) Another BGM track is already confirmed playing (currentBGM set).
            if (!this._bgmWaitingForInteraction || this._bgmPlayInProgress || this.currentBGM !== null) {
                // Nothing to do — abort silently
                this._retryHandlerActive = false;
                return;
            }

            this._retryHandlerActive = false;
            this._bgmWaitingForInteraction = false;
            this.playBGM(type);

            // Explicit cleanup of the stored reference (listener is {once:true}
            // so it self-removes from the DOM, but we null the ref for GC)
            if (this._bgmRetryListener) {
                document.removeEventListener('click', this._bgmRetryListener);
                document.removeEventListener('keydown', this._bgmRetryListener);
                this._bgmRetryListener = null;
            }
        };

        // Store reference for the explicit cleanup path in stopBGM()
        this._bgmRetryListener = retryPlay;
        document.addEventListener('click', retryPlay, { once: true });
        document.addEventListener('keydown', retryPlay, { once: true });
    }
    /**
         * Fade out BGM ที่กำลังเล่นอยู่แล้ว stop — ไม่บล็อก caller
         * ใช้ GainNode ramp ถ้ามี, fallback เป็น pause() ทันทีถ้าไม่มี
         */
    _crossfadeOutAndStop() {
        if (!this.bgmAudio) return;

        const FADE_MS = 400; // ms

        // เคลียร์ fade timer เก่า (ถ้า crossfade ซ้อนกัน)
        if (this._fadeOutTimer !== null) {
            clearTimeout(this._fadeOutTimer);
            this._fadeOutTimer = null;
        }

        // ถ้ามี GainNode → fade ผ่าน Web Audio (smooth)
        if (this._bgmGainNode && this.ctx && this.ctx.state === 'running') {
            const gain = this._bgmGainNode;
            const t = this.ctx.currentTime;
            gain.gain.cancelScheduledValues(t);
            gain.gain.setValueAtTime(gain.gain.value, t);
            gain.gain.linearRampToValueAtTime(0, t + FADE_MS / 1000);
        } else {
            // fallback: ไม่มี Web Audio context — ค่อยๆ ลด .volume ด้วย setTimeout chain
            const audio = this.bgmAudio;
            const steps = 8;
            const stepMs = FADE_MS / steps;
            const startVol = audio.volume;
            let step = 0;
            const fadeStep = () => {
                step++;
                audio.volume = Math.max(0, startVol * (1 - step / steps));
                if (step < steps) setTimeout(fadeStep, stepMs);
            };
            setTimeout(fadeStep, stepMs);
        }

        // Capture refs ของ track ที่กำลัง fade out
        const oldAudio = this.bgmAudio;
        const oldEnded = this._bgmEndedListener;
        const oldGain = this._bgmGainNode;
        const oldSource = this._bgmSourceNode;

        // Reset state ทันทีเพื่อให้ playBGM() track ใหม่สร้าง element ได้เลย
        this.bgmAudio = null;
        this.currentBGM = null;
        this._bgmGainNode = null;
        this._bgmSourceNode = null;
        this._bgmEndedListener = null;
        this._bgmPlayInProgress = false;

        // หยุด old track หลัง fade เสร็จ
        this._fadeOutTimer = setTimeout(() => {
            this._fadeOutTimer = null;
            if (oldEnded) {
                try { oldAudio.removeEventListener('ended', oldEnded); } catch (_) { }
            }
            oldAudio.pause();
            oldAudio.src = '';
            if (oldSource) { try { oldSource.disconnect(); } catch (_) { } }
            if (oldGain) { try { oldGain.disconnect(); } catch (_) { } }
        }, FADE_MS + 50);
    }

    stopBGM() {
        // Clear any queued-but-not-yet-played BGM so it doesn't
        // accidentally fire after the game state has changed.
        this._pendingBGM = null;
        // Clear in-flight flag — if stopBGM is called while a play() Promise
        // is pending, the .then()/.catch() will still fire but currentBGM/flags
        // will already be clean, so they become no-ops.
        this._bgmPlayInProgress = false;

        // ยกเลิก fade-out timer ที่ค้างอยู่
        if (this._fadeOutTimer !== null) {
            clearTimeout(this._fadeOutTimer);
            this._fadeOutTimer = null;
        }

        if (this.bgmAudio) {
            // Remove the loop-end safety listener to prevent memory leaks
            if (this._bgmEndedListener) {
                this.bgmAudio.removeEventListener('ended', this._bgmEndedListener);
                this._bgmEndedListener = null;
            }

            // Remove any pending retry listener and clear all related state
            if (this._bgmRetryListener) {
                document.removeEventListener('click', this._bgmRetryListener);
                document.removeEventListener('keydown', this._bgmRetryListener);
                this._bgmRetryListener = null;
                this._retryHandlerActive = false;
                this._bgmWaitingForInteraction = false;
            }

            // Disconnect Web Audio nodes
            if (this._bgmSourceNode) { try { this._bgmSourceNode.disconnect(); } catch (_) { } this._bgmSourceNode = null; }
            if (this._bgmGainNode) { try { this._bgmGainNode.disconnect(); } catch (_) { } this._bgmGainNode = null; }

            this.bgmAudio.pause();
            this.bgmAudio.src = '';
            this.bgmAudio = null;
            this.currentBGM = null;
            // console.log('🎵 BGM stopped');
        }
    }

    pauseBGM() {
        if (this.bgmAudio && !this.bgmAudio.paused) {
            this.bgmAudio.pause();
            // console.log('🎵 BGM paused');
        }
    }

    resumeBGM() {
        if (this.bgmAudio && this.bgmAudio.paused) {
            this.bgmAudio.play().catch(error => {
                console.warn('🎵 BGM resume failed:', error);
            });
            // console.log('🎵 BGM resumed');
        }
    }

    setSFXVolume(volume) {
        this.sfxVolume = clamp(volume, 0, 1);
    }

    setMasterVolume(volume) {
        this.masterVolume = clamp(volume, 0, 1);
        // Update BGM volume if a track is currently playing
        // Update BGM volume — prefer GainNode (Web Audio), fallback to .volume
        if (this._bgmGainNode) {
            this._bgmGainNode.gain.setTargetAtTime(
                this.bgmVolume * this.masterVolume,
                this.ctx.currentTime, 0.05
            );
        } else if (this.bgmAudio) {
            this.bgmAudio.volume = this.bgmVolume * this.masterVolume;
        }
    }

    getMasterVolume() {
        return this.masterVolume;
    }

    // ══════════════════════════════════════════════════════════
    // ⚔️  PAT (Samurai Ronin) SFX
    // Gain values read from GAME_CONFIG.audio.sfx — add pat_* keys there
    // if you need fine-tuned mixing without touching code here.
    // Guard pattern: if (!this.enabled || !this.ctx) return — all methods.
    // ══════════════════════════════════════════════════════════

    // ── pat_slash — Slash Wave projectile fired ───────────────
    // Sharp metal "sing" → steel ringing on release.
    // Layer 1: Triangle 1800→400 Hz sweep (blade edge hiss)
    // Layer 2: Sine  900→300 Hz (body resonance)
    playPatSlash() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const gainMult = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.audio?.sfx?.pat_slash != null)
            ? GAME_CONFIG.audio.sfx.pat_slash : 0.45;
        const t = this.ctx.currentTime;

        // Layer 1 — Triangle blade hiss
        const o1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        o1.connect(g1); g1.connect(this.ctx.destination);
        o1.type = 'triangle';
        o1.frequency.setValueAtTime(1800, t);
        o1.frequency.exponentialRampToValueAtTime(400, t + 0.12);
        g1.gain.setValueAtTime(gainMult * this.masterVolume * this.sfxVolume, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o1.start(t); o1.stop(t + 0.12);

        // Layer 2 — Sine resonance body
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.connect(g2); g2.connect(this.ctx.destination);
        o2.type = 'sine';
        o2.frequency.setValueAtTime(900, t);
        o2.frequency.exponentialRampToValueAtTime(300, t + 0.20);
        g2.gain.setValueAtTime(gainMult * 0.5 * this.masterVolume * this.sfxVolume, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
        o2.start(t); o2.stop(t + 0.20);
    }

    // ── pat_melee_hit — Melee combo hit contact ───────────────
    // Heavy blunt thud — fist/blade impact on body.
    // Square wave 300→80 Hz (impact) + noise burst (flesh/crunch).
    playPatMeleeHit() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const gainMult = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.audio?.sfx?.pat_melee_hit != null)
            ? GAME_CONFIG.audio.sfx.pat_melee_hit : 0.50;
        const t = this.ctx.currentTime;

        // Impact thud
        const o1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        o1.connect(g1); g1.connect(this.ctx.destination);
        o1.type = 'square';
        o1.frequency.setValueAtTime(300, t);
        o1.frequency.exponentialRampToValueAtTime(80, t + 0.08);
        g1.gain.setValueAtTime(gainMult * this.masterVolume * this.sfxVolume, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        o1.start(t); o1.stop(t + 0.09);

        // Noise burst — crunch layer
        const bufSize = Math.floor(this.ctx.sampleRate * 0.06);
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const ns = this.ctx.createBufferSource();
        ns.buffer = buf;
        const lpf = this.ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.value = 1200;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(gainMult * 0.4 * this.masterVolume * this.sfxVolume, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        ns.connect(lpf); lpf.connect(ng); ng.connect(this.ctx.destination);
        ns.start(t); ns.stop(t + 0.06);
    }

    // ── pat_reflect — Blade Guard reflects a projectile ───────
    // Metallic "CLANG" — steel deflection.
    // Sine 2400→1200 Hz sharp ping + fast triangle 1600→800 Hz.
    playPatReflect() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const gainMult = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.audio?.sfx?.pat_reflect != null)
            ? GAME_CONFIG.audio.sfx.pat_reflect : 0.60;
        const t = this.ctx.currentTime;

        // Main clang
        const o1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        o1.connect(g1); g1.connect(this.ctx.destination);
        o1.type = 'sine';
        o1.frequency.setValueAtTime(2400, t);
        o1.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
        g1.gain.setValueAtTime(gainMult * this.masterVolume * this.sfxVolume, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o1.start(t); o1.stop(t + 0.22);

        // Shimmer accent
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.connect(g2); g2.connect(this.ctx.destination);
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(1600, t + 0.01);
        o2.frequency.exponentialRampToValueAtTime(800, t + 0.12);
        g2.gain.setValueAtTime(gainMult * 0.55 * this.masterVolume * this.sfxVolume, t + 0.01);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        o2.start(t + 0.01); o2.stop(t + 0.12);
    }

    // ── pat_zanzo — Zanzo Flash teleport whoosh ───────────────
    // Fast air-displacement "zip" — speed > sound.
    // Noise burst through highpass + sine ascend 300→1800 Hz.
    playPatZanzo() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const gainMult = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.audio?.sfx?.pat_zanzo != null)
            ? GAME_CONFIG.audio.sfx.pat_zanzo : 0.50;
        const t = this.ctx.currentTime;

        // Whoosh noise
        const bufSize = Math.floor(this.ctx.sampleRate * 0.10);
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const ns = this.ctx.createBufferSource();
        ns.buffer = buf;
        const hpf = this.ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 900;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0, t);
        ng.gain.linearRampToValueAtTime(gainMult * 0.6 * this.masterVolume * this.sfxVolume, t + 0.02);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
        ns.connect(hpf); hpf.connect(ng); ng.connect(this.ctx.destination);
        ns.start(t); ns.stop(t + 0.10);

        // Pitch ascend — speed sensation
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(1800, t + 0.08);
        gain.gain.setValueAtTime(gainMult * 0.4 * this.masterVolume * this.sfxVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
        osc.start(t); osc.stop(t + 0.09);
    }

    // ── pat_iaido_charge — Iaido Phase 1 charge (0.6s) ────────
    // Low resonant hum building — tension before the strike.
    // Sine 120→220 Hz slow rise + triangle shimmer on top.
    playPatIaidoCharge() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const gainMult = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.audio?.sfx?.pat_iaido_charge != null)
            ? GAME_CONFIG.audio.sfx.pat_iaido_charge : 0.35;
        const dur = 0.60; // matches iaidoChargeDuration
        const t = this.ctx.currentTime;

        // Hum body
        const o1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        o1.connect(g1); g1.connect(this.ctx.destination);
        o1.type = 'sine';
        o1.frequency.setValueAtTime(120, t);
        o1.frequency.linearRampToValueAtTime(220, t + dur);
        g1.gain.setValueAtTime(0, t);
        g1.gain.linearRampToValueAtTime(gainMult * this.masterVolume * this.sfxVolume, t + dur * 0.6);
        g1.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
        o1.start(t); o1.stop(t + dur + 0.05);

        // Shimmer accent — ice blue flavor
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.connect(g2); g2.connect(this.ctx.destination);
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(800, t + dur * 0.3);
        o2.frequency.linearRampToValueAtTime(1400, t + dur);
        g2.gain.setValueAtTime(0, t + dur * 0.3);
        g2.gain.linearRampToValueAtTime(gainMult * 0.4 * this.masterVolume * this.sfxVolume, t + dur);
        g2.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
        o2.start(t + dur * 0.3); o2.stop(t + dur + 0.05);
    }

    // ── pat_iaido_strike — Iaido Phase 2 flash impact ─────────
    // Instant violent transient — supersonic blade cut.
    // White noise burst (20ms) + square click + high sine "crack".
    playPatIaidoStrike() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const gainMult = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.audio?.sfx?.pat_iaido_strike != null)
            ? GAME_CONFIG.audio.sfx.pat_iaido_strike : 0.75;
        const t = this.ctx.currentTime;

        // Noise transient — pure impact
        const bufSize = Math.floor(this.ctx.sampleRate * 0.022);
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        const ns = this.ctx.createBufferSource();
        ns.buffer = buf;
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(gainMult * this.masterVolume * this.sfxVolume, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.022);
        ns.connect(ng); ng.connect(this.ctx.destination);
        ns.start(t); ns.stop(t + 0.022);

        // High crack
        const o1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        o1.connect(g1); g1.connect(this.ctx.destination);
        o1.type = 'square';
        o1.frequency.setValueAtTime(3200, t);
        o1.frequency.exponentialRampToValueAtTime(400, t + 0.06);
        g1.gain.setValueAtTime(gainMult * 0.6 * this.masterVolume * this.sfxVolume, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
        o1.start(t); o1.stop(t + 0.06);
    }

    // ── pat_sheathe — Iaido Phase 3 sheathing (cinematic end) ─
    // Soft metallic slide into scabbard — "shing" descend.
    // Triangle 1400→600 Hz slow fade — restrained, deliberate.
    playPatSheathe() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();
        const gainMult = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.audio?.sfx?.pat_sheathe != null)
            ? GAME_CONFIG.audio.sfx.pat_sheathe : 0.30;
        const t = this.ctx.currentTime;

        // Shing descend
        const o1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        o1.connect(g1); g1.connect(this.ctx.destination);
        o1.type = 'triangle';
        o1.frequency.setValueAtTime(1400, t);
        o1.frequency.exponentialRampToValueAtTime(600, t + 0.35);
        g1.gain.setValueAtTime(gainMult * this.masterVolume * this.sfxVolume, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.40);
        o1.start(t); o1.stop(t + 0.40);

        // Sub-harmonic click — scabbard lock
        const o2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        o2.connect(g2); g2.connect(this.ctx.destination);
        o2.type = 'sine';
        o2.frequency.setValueAtTime(600, t + 0.33);
        o2.frequency.exponentialRampToValueAtTime(200, t + 0.42);
        g2.gain.setValueAtTime(gainMult * 0.5 * this.masterVolume * this.sfxVolume, t + 0.33);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
        o2.start(t + 0.33); o2.stop(t + 0.42);
    }

    // ── Shell Casing Drop SFX — short metallic tink ──────────────────────────
    playShellDrop() {
        if (!this.enabled || !this.ctx) return;
        this._ensureAudioContextRunning();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime;

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(2200, t);
        osc.frequency.exponentialRampToValueAtTime(1400, t + 0.06);

        const baseGain = (typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.audio?.shellDrop != null)
            ? GAME_CONFIG.audio.shellDrop
            : 0.025;
        gain.gain.setValueAtTime(baseGain * this.masterVolume * this.sfxVolume, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

        osc.start(t);
        osc.stop(t + 0.07);
    }

    mute() { this.enabled = false; if (this.bgmAudio) this.bgmAudio.pause(); }
    unmute() { this.enabled = true; if (this.bgmAudio?.paused) this.bgmAudio.play().catch(() => { }); }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
}

// ── NOTE ON NAMING ─────────────────────────────────────────────────────────────
// `var Audio` in global script scope → hoists to window.Audio → shadows the
// native HTML5 Audio constructor.  This is why playBGM() uses
// document.createElement('audio') instead of `new window.Audio(path)`.
//
// The variable name is intentionally preserved here because every other file
// in the project calls `Audio.playX()`.  Renaming it would require touching
// every single call site.  Since playBGM() no longer calls `new window.Audio`,
// the shadow is harmless.
var Audio = new AudioSystem();

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.Audio = Audio;
window.AudioSystem = AudioSystem;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Audio, AudioSystem };
}
