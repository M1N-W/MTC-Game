'use strict';
// ══════════════════════════════════════════════════════════════
// 🗂️  GameState — Single source of truth for mutable runtime state
//
// Replaces the scattered window.* globals that previously lived in
// game.js.  All other systems should read/write through this object
// instead of touching window directly.
//
// Godot equivalent: res://autoloads/GameState.gd  (AutoLoad singleton)
//
// Rollback: git restore js/systems/GameState.js js/game.js index.html
// ══════════════════════════════════════════════════════════════

const GameState = {

    // ── Loop / Phase ──────────────────────────────────────────
    // "phase" ใช้แทน window.gameState เดิม เพื่อหลีกเลี่ยงชื่อชนกับ object นี้
    loopRunning: false,
    phase: 'MENU',          // 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'

    // ── World Entities ────────────────────────────────────────
    player:         null,
    enemies:        [],
    boss:           null,
    powerups:       [],
    specialEffects: [],
    meteorZones:    [],
    drone:          null,

    // ── Timing / Hit-FX ──────────────────────────────────────
    hitStopTimer:   0,
    timeScale:      1.0,
    isSlowMotion:   false,
    slowMoEnergy:   1.0,

    // ── Glitch Wave ───────────────────────────────────────────
    isGlitchWave:       false,
    glitchIntensity:    0,
    controlsInverted:   false,
    _glitchWaveHpBonus: 0,
    waveSpawnLocked:    false,
    waveSpawnTimer:     0,
    pendingSpawnCount:  0,
    lastGlitchCountdown: -1,

    // ── Run Stats ─────────────────────────────────────────────
    waveStartDamage:    0,
    bossEncounterCount: 0,

    // ─────────────────────────────────────────────────────────
    // setPhase(s)
    //   Thin wrapper — mirrors the old setGameState() + window.gameState.
    //   Also keeps window.gameState alias in sync for files not yet migrated.
    // ─────────────────────────────────────────────────────────
    setPhase(s) {
        this.phase = s;
        // ⚠️ COMPAT ALIAS — remove once all files read GameState.phase directly
        window.gameState = s;
    },

    // ─────────────────────────────────────────────────────────
    // resetRun()
    //   Call once at the start of every new game run (replaces the
    //   scattered window.xxx = ... blocks inside startGame() and endGame()).
    //   Does NOT touch window.player — caller sets that before/after.
    // ─────────────────────────────────────────────────────────
    resetRun() {
        // Entities
        this.enemies        = [];
        this.powerups       = [];
        this.specialEffects = [];
        this.meteorZones    = [];
        this.boss           = null;
        this.drone          = null;

        // Timing / FX
        this.hitStopTimer = 0;
        this.timeScale    = 1.0;
        this.isSlowMotion = false;
        this.slowMoEnergy = 1.0;

        // Glitch Wave
        this.isGlitchWave        = false;
        this.glitchIntensity     = 0;
        this.controlsInverted    = false;
        this._glitchWaveHpBonus  = 0;
        this.waveSpawnLocked     = false;
        this.waveSpawnTimer      = 0;
        this.pendingSpawnCount   = 0;
        this.lastGlitchCountdown = -1;

        // Run stats
        this.waveStartDamage    = 0;
        this.bossEncounterCount = 0;

        // ⚠️ COMPAT ALIASES — keep window.* pointing at the new arrays/objects
        // so files not yet migrated continue to work without modification.
        // Array/object aliases work because JS passes by reference.
        // Primitive aliases (timeScale, isSlowMotion, etc.) are re-synced here
        // AND in the setters below; remove each alias once its file is migrated.
        this._syncAliases();
    },

    // ─────────────────────────────────────────────────────────
    // _syncAliases()
    //   Re-point all window.* compat aliases at the current values.
    //   Called by resetRun() and must be called again whenever a
    //   primitive field is reassigned externally (see note in game.js).
    //
    //   Arrays/objects: window.enemies === GameState.enemies  ✓ (same ref)
    //   Primitives:     window.timeScale is a *copy* — must be kept in sync
    //                   manually until each file is migrated.
    // ─────────────────────────────────────────────────────────
    _syncAliases() {
        // ── Reference types (alias works naturally) ───────────
        window.enemies        = this.enemies;
        window.powerups       = this.powerups;
        window.specialEffects = this.specialEffects;
        window.meteorZones    = this.meteorZones;
        // window.boss / window.player / window.drone are assigned
        // individually by startGame() because they carry extra setup logic.

        // ── Primitive types (copy — must re-sync after each write) ─
        window.hitStopTimer        = this.hitStopTimer;
        window.timeScale           = this.timeScale;
        window.isSlowMotion        = this.isSlowMotion;
        window.slowMoEnergy        = this.slowMoEnergy;
        window.isGlitchWave        = this.isGlitchWave;
        window.glitchIntensity     = this.glitchIntensity;
        window.controlsInverted    = this.controlsInverted;
        window._glitchWaveHpBonus  = this._glitchWaveHpBonus;
        window.waveSpawnLocked     = this.waveSpawnLocked;
        window.waveSpawnTimer      = this.waveSpawnTimer;
        window.pendingSpawnCount   = this.pendingSpawnCount;
        window.lastGlitchCountdown = this.lastGlitchCountdown;
        window.waveStartDamage     = this.waveStartDamage;
        window.bossEncounterCount  = this.bossEncounterCount;
    },
};

// ── Expose globally ───────────────────────────────────────────
window.GameState = GameState;
