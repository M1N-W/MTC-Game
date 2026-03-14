---
name: mtc-audio
description: >
  Audio architecture, SFX synthesis patterns, and BGM system conventions for MTC The Game (audio.js).
  Use this skill at the start of EVERY task that touches audio.js, adds new SFX, changes volume
  balance, or integrates a new character/skill sound. Trigger on: audio.js, AudioSystem,
  Audio.playXxx, playBGM, addSFX, new skill sound, SFX too loud, SFX balance, volume tuning,
  GAME_CONFIG.audio, sfx gain, weaponGain, bgmPaths, crossfade, BGM not playing, autoplay blocked,
  Web Audio API, oscillator, createBuffer, noise burst, gainNode, new character audio,
  new boss audio, playPatXxx, playPoomXxx, playShoot, playDash.
---

# MTC Audio — Architecture & SFX Patterns

Stack: Web Audio API (oscillators + noise buffers). No audio files for SFX — all synthesised at runtime.
BGM only uses HTMLAudioElement (streaming). Single singleton: `window.Audio` (AudioSystem instance).

---

## 1. Critical Architecture Rules

```
window.Audio = AudioSystem instance   ← DO NOT rename — call sites use Audio.playXxx() everywhere
Audio.init()                          ← MUST be called from a user-gesture handler (not window.onload)
Any playXxx() before init()           ← safe — ctx guard exits silently
```

**AudioContext lifecycle:**
- `init()` creates `this.ctx` (AudioContext) — gated behind user gesture to satisfy browser autoplay policy
- `_ensureAudioContextRunning()` — call at top of every `playXxx()` to resume suspended context
- BGM uses `HTMLAudioElement` → `GainNode` → `destination` (not oscillators)
- SFX uses oscillators/noise buffers → `GainNode` → `destination` directly

**DO NOT:**
```js
❌  new AudioSystem()          // singleton already created — use window.Audio
❌  Audio.ctx.createOscillator()  // call playXxx() helpers instead
❌  Audio.init() in window.onload  // must be inside click/keydown/touchstart handler
```

---

## 2. Adding a New SFX Method — Template

Every new `playXxx()` must follow this exact structure:

```js
playXxxSkill() {
    if (!this.enabled || !this.ctx) return;          // 1. Guard — always first
    this._ensureAudioContextRunning();               // 2. Resume if suspended

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);             // 3. Route to output

    const t = this.ctx.currentTime;
    const gainMult = GAME_CONFIG.audio.sfx?.xxxSkill ?? 0.5;  // 4. Read from config

    osc.type = 'sine';                              // 5. Synthesise
    osc.frequency.setValueAtTime(440, t);
    gain.gain.setValueAtTime(
        this.masterVolume * this.sfxVolume * gainMult, t   // 6. Volume formula
    );
    osc.start(t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.stop(t + 0.15);                            // 7. Always schedule stop
}
```

**Volume formula by sound category:**

| Category | Formula |
|----------|---------|
| Weapon fire | `GAME_CONFIG.audio.shoot * masterVolume * sfxVolume * weaponGainMult` |
| Combat / hit | `GAME_CONFIG.audio.hit * masterVolume * sfxVolume * gainMult` |
| Skill (ambient) | `masterVolume * sfxVolume * gainMult` (no base multiplier) |
| UI / passive | `masterVolume * sfxVolume * gainMult` (lowest values ~0.25–0.4) |

---

## 3. Volume Tuning — Config Is Source of Truth

**Never hardcode gain values in audio.js.** All multipliers live in `config.js → GAME_CONFIG.audio`:

```js
// config.js — tweak here, audio.js reads dynamically
GAME_CONFIG.audio.sfx = {
    stealth:        0.5,    // Kao stealth sweep
    clone:          0.4,    // Kao clone ping
    riceShoot:      0.55,   // Poom sticky rice splat
    ritualBurst:    1.1,    // Poom ritual — ultimate needs presence
    standRush:      0.35,   // Auto punch — fires every 60ms, stacks fast
    nagaAttack:     0.45,   // Poom naga — rate-limited but frequent
    vacuum:         0.6,    // Auto Q
    detonation:     0.85,   // Auto E — ultimate
    phantomShatter: 0.45,   // Kao clone expire
}

GAME_CONFIG.audio.weaponGain = {
    auto:    1.0,   // reference — fires most often, must be quietest
    sniper:  1.6,   // slow fire rate — should feel heavy
    shotgun: 1.3,   // 3 casings at once — was 2.0, caused clipping
}
```

**Balancing rules:**
- Sounds that fire rapidly (standRush ~60ms, nagaAttack ~220ms) must be quieter than their fire rate implies — they stack in perceived loudness
- Shell casing rule: `shellDrop * N_casings < shoot * weaponGain` (prevent shell SFX from drowning gunshot)
- Ultimate/rare skills (`ritualBurst`, `detonation`) can be louder (>0.8) — they're infrequent
- UI sounds (weaponSwitch, heal) should be the quietest in any given scene

---

## 4. Noise Buffer Pattern

For percussive/textured SFX (explosions, impacts, whooshes), layer oscillators with white noise:

```js
// White noise burst through a bandpass/lowpass filter
const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);  // duration in seconds
const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
const noiseData = noiseBuffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) noiseData[i] = Math.random() * 2 - 1;

const noiseSource = this.ctx.createBufferSource();
noiseSource.buffer = noiseBuffer;

const filter = this.ctx.createBiquadFilter();
filter.type = 'bandpass';
filter.frequency.value = 1200;
filter.Q.value = 1.8;

const noiseGain = this.ctx.createGain();
noiseGain.gain.setValueAtTime(baseGain, t);
noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.10);

noiseSource.connect(filter);
filter.connect(noiseGain);
noiseGain.connect(this.ctx.destination);
noiseSource.start(t);
// noiseSource stops automatically — no .stop() needed for BufferSource
```

⚠️ `Math.random()` is allowed in noise buffer generation (happens once at call time, not per frame).

---

## 5. BGM System — Key Invariants

```
playBGM('menu' | 'battle' | 'boss' | 'glitch')
```

**Three guards that must always hold:**

1. **Pre-interaction queue** — if `userInteracted` is false, store in `_pendingBGM` (most-recent wins), return. Never discard silently.
2. **Same-track guard** — if `currentBGM === type && !bgmAudio.paused`, return immediately (prevents battle→battle restart on new wave)
3. **In-flight guard** — `_bgmPlayInProgress` flag prevents retryPlay from interrupting a `.play()` Promise still pending

**BGM paths live in config:**
```js
GAME_CONFIG.audio.bgmPaths = {
    menu:   'assets/audio/menu.mp3',
    battle: 'assets/audio/battle.mp3',
    boss:   'assets/audio/boss.mp3',
    glitch: 'assets/audio/glitch.mp3',
}
```
✅ Add new BGM by adding a key here + calling `Audio.playBGM('newKey')`.
❌ Never hardcode paths in audio.js.

---

## 6. Adding SFX for a New Character — Checklist

1. **Add gain key to config.js** → `GAME_CONFIG.audio.sfx.xxxSkill = 0.X`
2. **Write `playXxxSkill()` in audio.js** — follow template in §2, read gain from config
3. **Name convention:** `play[CharName][SkillName]()` e.g. `playPatZanzo()`, `playPoomRitualBurst()`
4. **Call site** — in `[Char]Player.js` at skill activation: `if (typeof Audio !== 'undefined') Audio.playXxxSkill();`
5. **Never call Audio before guard:** `if (typeof Audio !== 'undefined' && Audio.enabled)`

**Existing character SFX map (for naming reference):**

| Character | Method prefix | Key sounds |
|-----------|--------------|------------|
| Kao | `playStealth`, `playClone`, `playPhantomShatter`, `playDash` | |
| Poom | `playPoomShoot`, `playNagaAttack`, `playRiceShoot`, `playRitualBurst` | |
| Auto | `playStandRush`, `playPunch`, `playVacuum`, `playDetonation` | |
| Pat | `playPatSlash`, `playPatMeleeHit`, `playPatReflect`, `playPatZanzo`, `playPatIaidoCharge`, `playPatIaidoStrike`, `playPatSheathe` | |
| Shared | `playHit`, `playPlayerDamage`, `playDash`, `playEnemyDeath`, `playBossSpecial`, `playPowerUp`, `playHeal`, `playLevelUp`, `playShellDrop` | |

---

## 7. Critical Pitfalls

**`window.Audio` shadows browser's built-in `Audio` constructor — this is intentional.**
Do not "fix" it. All call sites depend on `Audio.playXxx()` shorthand.

**Never call `Audio.init()` outside a user-gesture handler.** Calling it from `window.onload` silently fails in modern browsers — the AudioContext is created in suspended state and BGM queue never flushes.

**`exponentialRampToValueAtTime` requires value > 0.** Always ramp to `0.001` or `0.01`, never `0`:
```js
❌  gain.gain.exponentialRampToValueAtTime(0, t + 0.1);   // throws RangeError
✅  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
```

**Always schedule `osc.stop(t + duration)`.** Oscillators that are never stopped leak AudioContext resources.

**Multi-layer SFX:** each layer needs its own `osc`/`gain` pair. Never share a GainNode across oscillators unless intentional mix.
