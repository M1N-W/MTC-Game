"use strict";
/**
 * js/effects/EffectPresets.js
 * ════════════════════════════════════════════════════════════════
 * Preset configs + factory functions for reusable one-shot effects.
 * Adding a new effect = add a preset entry + call spawnShockwave().
 *
 * RULES:
 *  - Zero game-state mutation — pure visual, no physics/damage
 *  - No new object in the update loop — ShockwaveRing uses _pool
 *  - All colors from RT.* where possible; preset can override with hex
 *  - spawnShockwave() is the ONLY public entry point for ring effects
 *  - EffectPresets instances live in window.specialEffects[] — must
 *    implement update(dt, player, meteorZones, boss) → bool (true=remove)
 *
 * HOW TO ADD A NEW SHOCKWAVE PRESET:
 *  1. Add an entry to SHOCKWAVE_PRESETS
 *  2. Call spawnShockwave('myPreset', x, y)
 *  3. Done — no renderer changes needed
 *
 * LOAD ORDER: RenderTokens.js → EffectPresets.js → game.js
 *
 * ── TABLE OF CONTENTS ────────────────────────────────────────────
 *  L.41   SHOCKWAVE_PRESETS    named ring configs
 *  L.90   ShockwaveRing        pooled expanding ring class
 *  L.140  spawnShockwave()     factory — acquires from pool, pushes to specialEffects
 * ════════════════════════════════════════════════════════════════
 */

// ── Preset definitions ────────────────────────────────────────────────────────
// Each preset fully describes one ring burst. Add entries freely — no code changes needed.
const SHOCKWAVE_PRESETS = {

  /** Generic impact ring — neutral white. Default for unknown IDs. */
  default: {
    color:       '#ffffff',
    glowColor:   '#ffffff',
    glowBlur:    12,
    startRadius: 10,
    endRadius:   80,
    duration:    0.35,
    lineWidth:   2.5,
    alphaStart:  0.85,
  },

  /** Ignite / fire burst ring — orange-red. Use on ignite proc or fire skill. */
  fire: {
    color:       () => RT.palette.bossOrange,
    glowColor:   () => RT.palette.dangerDark,
    glowBlur:    18,
    startRadius: 12,
    endRadius:   90,
    duration:    0.4,
    lineWidth:   3.0,
    alphaStart:  0.9,
  },

  /** Sticky-slow impact ring — green. Use on sticky-slow application. */
  sticky: {
    color:       () => RT.palette.sticky,
    glowColor:   () => RT.palette.sticky,
    glowBlur:    10,
    startRadius: 8,
    endRadius:   70,
    duration:    0.30,
    lineWidth:   2.0,
    alphaStart:  0.75,
  },

  /** Critical hit burst — gold. Use on crit kill or crit proc. */
  crit: {
    color:       () => RT.palette.crit,
    glowColor:   () => RT.palette.critGlow,
    glowBlur:    22,
    startRadius: 14,
    endRadius:   100,
    duration:    0.45,
    lineWidth:   3.5,
    alphaStart:  1.0,
  },

  /** Slow/freeze ring — icy blue. Use when freeze/heavy-slow lands. */
  slow: {
    color:       () => RT.palette.slowRing,
    glowColor:   () => RT.palette.slowRing,
    glowBlur:    12,
    startRadius: 10,
    endRadius:   75,
    duration:    0.38,
    lineWidth:   2.0,
    alphaStart:  0.8,
  },

  /** Heal burst ring — emerald. Use on heal pickup or Poom heal. */
  heal: {
    color:       () => RT.palette.healText,
    glowColor:   () => RT.palette.heal,
    glowBlur:    14,
    startRadius: 10,
    endRadius:   65,
    duration:    0.35,
    lineWidth:   2.5,
    alphaStart:  0.85,
  },

  /** Boss phase transition — large dramatic ring. */
  bossPhase: {
    color:       () => RT.palette.danger,
    glowColor:   () => RT.palette.dangerDark,
    glowBlur:    28,
    startRadius: 20,
    endRadius:   160,
    duration:    0.65,
    lineWidth:   4.0,
    alphaStart:  1.0,
  },
};

// ── ShockwaveRing — pooled expanding ring ─────────────────────────────────────
class ShockwaveRing {
  static _pool = [];
  static MAX_POOL = 30;

  constructor() { this._active = false; }

  /** Initialise from a preset config. */
  _init(preset, wx, wy) {
    this._wx      = wx;
    this._wy      = wy;
    this._dur     = preset.duration;
    this._t       = 0;
    this._r0      = preset.startRadius;
    this._r1      = preset.endRadius;
    this._lw      = preset.lineWidth;
    this._a0      = preset.alphaStart;
    this._blur    = preset.glowBlur;
    // Support both static hex strings and RT-reading functions
    this._colFn   = typeof preset.color     === 'function' ? preset.color     : () => preset.color;
    this._glowFn  = typeof preset.glowColor === 'function' ? preset.glowColor : () => preset.glowColor;
    this._active  = true;
    return this;
  }

  static acquire(preset, wx, wy) {
    const ring = ShockwaveRing._pool.length > 0
      ? ShockwaveRing._pool.pop()
      : new ShockwaveRing();
    return ring._init(preset, wx, wy);
  }

  release() {
    this._active = false;
    if (ShockwaveRing._pool.length < ShockwaveRing.MAX_POOL) {
      ShockwaveRing._pool.push(this);
    }
  }

  // Matches game.js specialEffects[] update(dt, player, meteorZones, boss) contract
  update(dt, _player, _meteorZones, _boss) {
    this._t += dt;
    if (this._t >= this._dur) { this.release(); return true; }
    return false;
  }

  draw() {
    if (!this._active) return;
    const screen = worldToScreen(this._wx, this._wy);
    if (typeof CANVAS !== 'undefined') {
      const margin = this._r1 + 20;
      if (screen.x < -margin || screen.x > CANVAS.width  + margin ||
          screen.y < -margin || screen.y > CANVAS.height + margin) return;
    }

    const p     = Math.min(1, this._t / this._dur);           // 0→1
    const ease  = 1 - Math.pow(1 - p, 2);                     // ease-out quad
    const r     = this._r0 + (this._r1 - this._r0) * ease;
    const alpha = this._a0 * (1 - p);                         // linear fade

    CTX.save();
    CTX.globalAlpha = alpha;
    CTX.strokeStyle = this._colFn();
    CTX.lineWidth   = this._lw * (1 - p * 0.5);               // thin out as it expands
    CTX.shadowBlur  = this._blur * (1 - p * 0.6);
    CTX.shadowColor = this._glowFn();
    CTX.beginPath();
    CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    CTX.stroke();
    CTX.shadowBlur  = 0;
    CTX.restore();
  }
}

// ── Public factory ────────────────────────────────────────────────────────────
/**
 * Spawn a shockwave ring at world coords (wx, wy).
 * Ring is pushed into window.specialEffects[] and auto-removed when done.
 *
 * @param {string} presetId  key in SHOCKWAVE_PRESETS (defaults to 'default')
 * @param {number} wx        world x
 * @param {number} wy        world y
 *
 * Usage examples:
 *   spawnShockwave('fire',      enemy.x, enemy.y);   // on ignite proc
 *   spawnShockwave('crit',      enemy.x, enemy.y);   // on crit kill
 *   spawnShockwave('bossPhase', boss.x,  boss.y);    // on phase transition
 *   spawnShockwave('slow',      enemy.x, enemy.y);   // on heavy slow land
 */
function spawnShockwave(presetId, wx, wy) {
  if (typeof window.specialEffects === 'undefined') return;
  const preset = SHOCKWAVE_PRESETS[presetId] ?? SHOCKWAVE_PRESETS.default;
  window.specialEffects.push(ShockwaveRing.acquire(preset, wx, wy));
}

window.SHOCKWAVE_PRESETS = SHOCKWAVE_PRESETS;
window.ShockwaveRing     = ShockwaveRing;
window.spawnShockwave    = spawnShockwave;
