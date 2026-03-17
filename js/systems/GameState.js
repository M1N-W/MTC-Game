"use strict";
/**
 * js/systems/GameState.js
 * ════════════════════════════════════════════════
 * Single source of truth for all mutable runtime state.
 * Consolidates globals that were previously scattered across game.js.
 *
 * Design notes:
 *   - setPhase() writes both this.phase and window.gameState simultaneously —
 *     never write window.gameState directly elsewhere.
 *   - _syncAliases() must be called after every resetRun() to keep window.*
 *     primitives in sync. Reference types (arrays) are shared by reference
 *     automatically after first sync.
 *   - Primitive aliases (hitStopTimer, timeScale, etc.) must be re-synced
 *     after every write because JS primitives are copy-on-assign.
 *
 * Integration:
 *   game.js   → GameState.setPhase() / GameState.resetRun()
 *   game.js   → reads GameState.hitStopTimer, .timeScale per frame
 *   All files → window.enemies, window.boss, window.player (via sync)
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.12  GameState                 singleton object
 *  L.15  .loopRunning / .phase     loop + phase state
 *  L.19  .player/.enemies/.boss    world entity references
 *  L.28  .hitStopTimer/.timeScale  timing + hit-FX
 *  L.34  .isGlitchWave / glitch    glitch-wave modifier state
 *  L.44  .bossEncounterCount       persistent boss queue counter
 *  L.47  .setPhase()               write phase + window.gameState
 *  L.52  .resetRun()               zero all mutable state + _syncAliases
 *  L.88  ._syncAliases()           push all primitives to window.*
 *
 * ⚠️  B5 FIX: _syncAliases() was missing window.bossEncounterCount —
 *     on restart the encounter queue started from N+1, spawning wrong boss.
 *     Line added at L.103. Do NOT remove it.
 * ⚠️  Primitive aliases go stale if written directly to GameState without
 *     calling _syncAliases(). Always go through setPhase()/resetRun() or
 *     sync manually after mutation.
 * ════════════════════════════════════════════════
 */

const GameState = {
  // ── Loop / Phase ──────────────────────────────────────────
  loopRunning: false,
  phase: "MENU", // 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'

  // ── World Entities ────────────────────────────────────────
  player: null,
  enemies: [],
  boss: null,
  powerups: [],
  specialEffects: [],
  meteorZones: [],
  drone: null,

  // ── Timing / Hit-FX ──────────────────────────────────────
  hitStopTimer: 0,
  timeScale: 1.0,
  isSlowMotion: false,
  slowMoEnergy: 1.0,

  // ── Glitch Wave ───────────────────────────────────────────
  isGlitchWave: false,
  glitchIntensity: 0,
  controlsInverted: false,
  _glitchWaveHpBonus: 0,
  waveSpawnLocked: false,
  waveSpawnTimer: 0,
  pendingSpawnCount: 0,
  lastGlitchCountdown: -1,

  // ── Run Stats ─────────────────────────────────────────────
  waveStartDamage: 0,
  bossEncounterCount: 0,

  // ── Active Skins — set at character select, persisted via utils.js ───────
  // Not reset on resetRun() — skin is a persistent user preference.
  // Populated from save data by getSaveData() on load.
  activeSkin: {
    auto: "default",
    kao: "default",
    poom: "default",
    pat: "default",
  },

  setPhase(s) {
    this.phase = s;
    window.gameState = s;
  },

  resetRun() {
    this.enemies = [];
    this.powerups = [];
    this.specialEffects = [];
    this.meteorZones = [];
    this.boss = null;
    this.drone = null;

    this.hitStopTimer = 0;
    this.timeScale = 1.0;
    this.isSlowMotion = false;
    this.slowMoEnergy = 1.0;

    this.isGlitchWave = false;
    this.glitchIntensity = 0;
    this.controlsInverted = false;
    this._glitchWaveHpBonus = 0;
    this.waveSpawnLocked = false;
    this.waveSpawnTimer = 0;
    this.pendingSpawnCount = 0;
    this.lastGlitchCountdown = -1;

    this.waveStartDamage = 0;
    this.bossEncounterCount = 0;

    this._syncAliases();
  },

  _syncAliases() {
    // Reference types
    window.enemies = this.enemies;
    window.powerups = this.powerups;
    window.specialEffects = this.specialEffects;
    window.meteorZones = this.meteorZones;

    // Primitive types
    window.hitStopTimer = this.hitStopTimer;
    window.timeScale = this.timeScale;
    window.isSlowMotion = this.isSlowMotion;
    window.slowMoEnergy = this.slowMoEnergy;
    window.isGlitchWave = this.isGlitchWave;
    window.glitchIntensity = this.glitchIntensity;
    window.controlsInverted = this.controlsInverted;
    window._glitchWaveHpBonus = this._glitchWaveHpBonus;
    window.waveSpawnLocked = this.waveSpawnLocked;
    window.waveSpawnTimer = this.waveSpawnTimer;
    window.pendingSpawnCount = this.pendingSpawnCount;
    window.lastGlitchCountdown = this.lastGlitchCountdown;
    window.waveStartDamage = this.waveStartDamage;
    window.bossEncounterCount = this.bossEncounterCount; // B5 FIX: was missing
  },
};

window.GameState = GameState;
