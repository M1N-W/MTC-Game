'use strict';
// ══════════════════════════════════════════════════════════════
// 🗂️  GameState — Single source of truth for mutable runtime state
//
// ─── BUG FIXES ───────────────────────────────────────────────
//   B5 [CRITICAL] — _syncAliases() never wrote window.bossEncounterCount.
//                   resetRun() zeroed this.bossEncounterCount but the window
//                   global stayed stale → on restart encounter queue started
//                   from N+1, spawning wrong boss.  Line added in _syncAliases.
// ══════════════════════════════════════════════════════════════

const GameState = {

    // ── Loop / Phase ──────────────────────────────────────────
    loopRunning: false,
    phase: 'MENU',          // 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'

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
        window.bossEncounterCount = this.bossEncounterCount;   // B5 FIX: was missing
    },
};

window.GameState = GameState;