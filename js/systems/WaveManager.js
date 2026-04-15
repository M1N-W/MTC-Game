'use strict';
/**
 * js/systems/WaveManager.js
 * ════════════════════════════════════════════════
 * Wave lifecycle, enemy spawning, wave-modifier events (Glitch/Fog/Speed/Dark),
 * trickle spawning, and boss encounter queue. Sole owner of wave progression state.
 *
 * Design notes:
 *   - Exports via window.* only (no ES modules). Loaded after enemy.js + boss files.
 *   - Wave schedule is dynamic: _getWaveSchedule() builds from WAVE_SCHEDULE config.
 *   - Glitch wave fires every GLITCH_EVERY_N_WAVES (=5) waves — invert controls,
 *     HP bonus, countdown lock until all enemies dead.
 *   - Trickle spawning: enemies drip in over time rather than all at once.
 *     _trickle object owns the queue; updateWaveEvent() ticks it.
 *   - Boss encounter queue: _startBossWave() uses BOSS_ENCOUNTERS config (flexible scheduling).
 *   - SpeedWave patches enemy .speed directly via _patchedEnemies WeakSet;
 *     _restoreEnemySpeeds() reverses on deactivate.
 *
 * Integration:
 *   game.js  → startNextWave()       (wave clear / game start)
 *   game.js  → updateWaveEvent(dt)   (every frame)
 *   game.js  → drawWaveEvent(ctx)    (render pass)
 *   game.js  → spawnEnemies(count)   (called by startNextWave internally)
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.93   _getBossEncounterForWave()  get boss config for wave (flexible scheduling)
 *  L.99   _isBossWave()              check if wave is boss wave (config-based)
 *  L.51   _getWaveSchedule()         builds wave config from WAVE_SCHEDULE
 *  L.61   SPEED_MULT                 speed-wave enemy multiplier
 *  L.69   window.isGlitchWave        mutable wave-event state (globals)
 *  L.83   _evt                       active event descriptor object
 *  L.97   _trickle                   trickle-spawn state object
 *  L.106  _activateWaveEvent()       sets _evt, applies modifiers
 *  L.144  _deactivateWaveEvent()     teardown + restores enemy speeds
 *  L.160  _patchEnemySpeeds()        multiplies speed on live enemies
 *  L.171  _restoreEnemySpeeds()      reverses _patchEnemySpeeds via WeakSet
 *  L.184  updateWaveEvent()          per-frame tick: trickle + event timer
 *  L.221  drawWaveEvent()            dispatches to _drawDark/_drawFog/_drawSpeed
 *  L.232  _drawDark()                ominous vignette (wave 1 intro)
 *  L.247  _drawFog()                 fog-of-war overlay
 *  L.317  _drawSpeed()               speed-wave VFX
 *  L.361  _startTrickle()            initialises trickle queue for a wave
 *  L.388  startNextWave()            main wave-start entry point
 *  L.421  _resetWaveState()          clears per-wave mutable state
 *  L.442  _startGlitchWave()         glitch modifier: invert + HP bonus
 *  L.492  _startBossWave()           boss encounter queue dispatch
 *  L.567  spawnEnemies()             instantiates enemies + tags squad role
 *
 * ⚠️  Boss class names: ManopBoss (KruManop) and KruFirst — NEVER Boss/BossFirst.
 *     KruFirst instanceof check MUST come before ManopBoss in _startBossWave().
 * ⚠️  _patchEnemySpeeds() uses a WeakSet guard — do NOT call twice without
 *     _restoreEnemySpeeds() in between or speed doubles permanently.
 * ⚠️  window.bossEncounterCount persists across waves — reset only on full game reset,
 *     not on wave clear. Drives deterministic boss order.
 * ════════════════════════════════════════════════
 */

// ══════════════════════════════════════════════════════════════
// 🌊 WAVE MANAGER  (WaveManager.js)
//
// Manages all wave logic including:
//   • Normal waves & enemy spawning (trickle system)
//   • Glitch Wave (every 5th wave)
//   • Fog Wave    — radar blackout, amber fog vignette
//   • Speed Wave  — enemies ×1.5 speed, red speed-lines vignette
//   • Dark Wave   — eerie dim vignette (wave 1 intro + extras)
//
// Boss encounter queue (deterministic, 5 encounters across 15 waves):
//   Enc 1  Wave  3 → Kru Manop  (Basic)
//   Enc 2  Wave  6 → Kru First  (Basic)
//   Enc 3  Wave  9 → Kru Manop  (Dog Rider)
//   Enc 4  Wave 12 → Kru First  (Advanced — extra difficulty)
//   Enc 5  Wave 15 → Kru Manop  (Goldfish Lover)
//
// ─── BUG FIXES ───────────────────────────────────────────────
//   B1 [CRITICAL] — Glitch wave used window.waveSpawnLocked/Timer/etc
//                   but game.js reads GameState.*  → replaced all with
//                   GameState.* so the lock actually engages.
//   B2 [CRITICAL] — Trickle: enemies.length===0 between batches triggered
//                   startNextWave() prematurely.  window.isTrickleActive
//                   now exposed; game.js wave-advance guard must include
//                   `&& !window.isTrickleActive`.
//   B3 [MEDIUM]   — rollShopItems() was called twice (first with guard,
//                   second without).  Deduplicated to one guarded call.
//   B4 [MINOR]    — fogDriftX/Y never reset; now zeroed in _deactivateWaveEvent.
// ══════════════════════════════════════════════════════════════

// ─── Constants ────────────────────────────────────────────────
// NOTE: GLITCH_EVERY_N_WAVES moved to WAVE_SCHEDULE.glitchEveryNWaves (configurable)
// NOTE: Trickle constants moved to BALANCE.waves (configurable)

const SPEED_MULT = 1.5;

// Helper: Get boss encounter config for a specific wave (supports arbitrary boss wave patterns)
function _getBossEncounterForWave(wave) {
    const encounters = window.BOSS_ENCOUNTERS || [];
    return encounters.find(e => e.wave === wave) || null;
}

// Helper: Check if a wave is a boss wave (works with any boss wave pattern)
function _isBossWave(wave) {
    const encounters = window.BOSS_ENCOUNTERS || [];
    return encounters.some(e => e.wave === wave);
}

// Helper: Get trickle config from BALANCE with fallbacks
function _getTrickleConfig() {
    const w = (typeof BALANCE !== 'undefined' && BALANCE.waves) ? BALANCE.waves : {};
    return {
        intervalBase: w.trickleIntervalBase ?? 1.4,
        intervalMin: w.trickleIntervalMin ?? 0.9,
        intervalDark: w.trickleIntervalDark ?? 1.8
    };
}

// Which waves trigger special events.
// Wave event configurations now centralized in BALANCE.waves
// Effective wave schedule (configurable via WAVE_SCHEDULE):
//   Boss  : from BOSS_ENCOUNTERS array
//   Glitch: from WAVE_SCHEDULE.glitchWaves
//   Fog   : from WAVE_SCHEDULE.fogWaves
//   Speed : from WAVE_SCHEDULE.speedWaves
//   Dark  : from WAVE_SCHEDULE.darkWave
// NEW — lazy: อ่านตอน startNextWave() เพื่อให้ config แก้ได้ runtime
// NEW — JSON-ready: อ่านจาก window.WAVE_SCHEDULE แทนชุดค่าคงที่แบบกระจาย
function _getWaveSchedule() {
    const ws = window.WAVE_SCHEDULE || {};
    // Build boss set from BOSS_ENCOUNTERS (supports arbitrary boss wave patterns)
    const bossWaves = (window.BOSS_ENCOUNTERS || []).map(e => e.wave);
    return {
        fog: new Set(ws.fogWaves ?? [2, 8, 11, 14]),
        speed: new Set(ws.speedWaves ?? [4, 7, 13]),
        glitch: new Set(ws.glitchWaves ?? [5, 10]),
        dark: new Set(Array.isArray(ws.darkWave) ? ws.darkWave : [ws.darkWave ?? 1]),
        boss: new Set(bossWaves.length > 0 ? bossWaves : [3, 6, 9, 12, 15]),
    };
}

// Trickle spawn — enemies arrive in small batches over time (normal/fog/speed waves)
const TRICKLE_INTERVAL_BASE = _getTrickleConfig().intervalBase;
const TRICKLE_INTERVAL_MIN = _getTrickleConfig().intervalMin;
const TRICKLE_INTERVAL_DARK = _getTrickleConfig().intervalDark;

// ─── Mutable state ─────────────────────────────────────────────
window.isGlitchWave = false;
window.glitchIntensity = 0;
window.controlsInverted = false;
window._glitchWaveHpBonus = 0;
// B2 FIX: exposed so game.js wave-advance guard can read it
window.isTrickleActive = false;
window.bossEncounterCount = 0;
window.waveStartDamage = 0;
window.isFogWave = false;
window.isSpeedWave = false;

// ══════════════════════════════════════════════════════════════
// 🌊⚡ WAVE EVENT — internal state object
// ══════════════════════════════════════════════════════════════
const _evt = {
    active: null,   // null | 'fog' | 'speed'
    fogAlpha: 0,
    fogDriftX: 0,
    fogDriftY: 0,
    announceTimer: 0,
    bannerTitle: '',
    bannerSubtitle: '',
    bannerColor: '#fff',
};
const ANNOUNCE_DUR = 3.5;
const _patchedEnemies = new WeakSet();

// ─── Trickle state ─────────────────────────────────────────────
const _trickle = {
    active: false,
    remaining: 0,
    timer: 0,
    interval: TRICKLE_INTERVAL_BASE,
    batchSize: 3,
    isDark: false,
};

function _activateWaveEvent(type, wave) {
    _deactivateWaveEvent();
    _evt.active = type;
    _evt.fogAlpha = 0;
    _evt.announceTimer = ANNOUNCE_DUR;

    if (type === 'fog') {
        window.isFogWave = true;
        _evt.bannerTitle = GAME_TEXTS.wave.fogBannerTitle;
        _evt.bannerSubtitle = GAME_TEXTS.wave.fogBannerSubtitle;
        _evt.bannerColor = '#d97706';   // amber — military HUD theme
    } else {
        window.isSpeedWave = true;
        _evt.bannerTitle = GAME_TEXTS.wave.speedBannerTitle;
        _evt.bannerSubtitle = GAME_TEXTS.wave.speedBannerSubtitle;
        _evt.bannerColor = '#ef4444';
        _patchEnemySpeeds();
    }

    // แนบ event badge เข้า waveAnnouncementFX (รวมป้ายเป็นอันเดียว)
    if (typeof waveAnnouncementFX !== 'undefined' && waveAnnouncementFX.active) {
        waveAnnouncementFX.attachEvent(
            type,
            _evt.bannerTitle,
            _evt.bannerSubtitle,
            _evt.bannerColor
        );
    }

    // voice bubble เท่านั้น — canvas banner แสดง title อยู่แล้ว ไม่ spawn floatingText ซ้ำ
    if (window.player && window.UIManager) {
        const voiceLine = type === 'fog' ? '⚠ Radar offline...' : "⚡ They're moving fast!";
        window.UIManager.showVoiceBubble(voiceLine, window.player.x, window.player.y - 40);
    }

    console.log(`[WaveManager] ${type.toUpperCase()} WAVE — wave ${wave}`);
}

function _deactivateWaveEvent() {
    if (_evt.active === 'speed') _restoreEnemySpeeds();
    _evt.active = null;
    _evt.fogAlpha = 0;
    _evt.fogDriftX = 0;   // B4 FIX: reset drift so it doesn't accumulate across fog waves
    _evt.fogDriftY = 0;
    _evt.announceTimer = 0;
    window.isFogWave = false;
    window.isSpeedWave = false;
    // Reset trickle
    _trickle.active = false;
    _trickle.remaining = 0;
    _trickle.isDark = false;
    window.isTrickleActive = false;
    // Clear weather from previous wave
    if (typeof weatherSystem !== 'undefined') weatherSystem.setWeather('none');
}

function _patchEnemySpeeds() {
    const all = [...(window.enemies || [])];
    if (window.boss && !window.boss.dead) all.push(window.boss);
    for (const e of all) {
        _applyWaveModifiersToEnemy(e);
    }
}

function _restoreEnemySpeeds() {
    const all = [...(window.enemies || []), window.boss].filter(Boolean);
    for (const e of all) {
        if (_patchedEnemies.has(e) && typeof e._preSpeedWave === 'number') {
            e.speed = e._preSpeedWave;
            delete e._preSpeedWave;
        }
    }
}

function _applyWaveModifiersToEnemy(e) {
    if (!e || e.dead || _patchedEnemies.has(e) || typeof e.speed !== 'number') return;
    if (!window.isSpeedWave) return;
    e._preSpeedWave = e.speed;
    e.speed *= SPEED_MULT;
    _patchedEnemies.add(e);
}

function _getEnemyPoolForWave(wave) {
    const wavesCfg = (typeof BALANCE !== 'undefined') ? BALANCE.waves : null;
    const pools = wavesCfg?.enemyPools;
    if (!wavesCfg?.enableExpandedRoster || !Array.isArray(pools) || pools.length === 0) return null;
    let selected = pools[0];
    for (let i = 0; i < pools.length; i++) {
        const pool = pools[i];
        if (wave >= (pool.minWave || 1)) selected = pool;
    }
    return selected?.weights || null;
}

function _waveRuleValue(rule, wave) {
    if (Array.isArray(rule)) {
        const idx = Math.max(0, Math.min(rule.length - 1, (wave || 1) - 1));
        return rule[idx];
    }
    return rule;
}

function _getExpandedEnemyLiveCounts() {
    const counts = { byType: {}, support: 0, hazard: 0, supportTypes: {}, hazardTypes: {} };
    const roster = (typeof BALANCE !== 'undefined' && BALANCE.enemies) ? BALANCE.enemies : {};
    const live = window.enemies || [];
    for (let i = 0; i < live.length; i++) {
        const enemy = live[i];
        if (!enemy || enemy.dead || !enemy.type) continue;
        counts.byType[enemy.type] = (counts.byType[enemy.type] || 0) + 1;
        const cfg = roster[enemy.type];
        if (!cfg) continue;
        if (cfg.support) {
            counts.support++;
            counts.supportTypes[enemy.type] = (counts.supportTypes[enemy.type] || 0) + 1;
        }
        if (cfg.hazard) {
            counts.hazard++;
            counts.hazardTypes[enemy.type] = (counts.hazardTypes[enemy.type] || 0) + 1;
        }
    }
    return counts;
}

function _isEnemyEligibleForWave(key, wave, liveCounts) {
    const roster = (typeof BALANCE !== 'undefined' && BALANCE.enemies) ? BALANCE.enemies : null;
    const rules = (typeof BALANCE !== 'undefined' && BALANCE.waves) ? BALANCE.waves.expandedRosterRules : null;
    const cfg = roster?.[key];
    if (!cfg || !rules) return true;

    const typeCount = liveCounts.byType[key] || 0;
    if (cfg.support) {
        const maxSupport = _waveRuleValue(rules.maxSupportAlive, wave);
        if (typeof maxSupport === 'number' && liveCounts.support >= maxSupport) return false;
        const mixUnlockWave = rules.supportMixUnlockWave || 10;
        if (wave < mixUnlockWave) {
            const supportTypesAlive = Object.keys(liveCounts.supportTypes).filter((type) => (liveCounts.supportTypes[type] || 0) > 0);
            if (supportTypesAlive.length > 0 && !liveCounts.supportTypes[key]) return false;
        }
    }
    if (cfg.hazard) {
        const maxHazard = _waveRuleValue(rules.maxHazardAlive, wave);
        if (typeof maxHazard === 'number' && liveCounts.hazard >= maxHazard) return false;
        const hazardMixUnlockWave = rules.hazardMixUnlockWave || 9;
        if (wave < hazardMixUnlockWave) {
            const hazardTypesAlive = Object.keys(liveCounts.hazardTypes).filter((type) => (liveCounts.hazardTypes[type] || 0) > 0);
            if (hazardTypesAlive.length > 0 && !liveCounts.hazardTypes[key]) return false;
        }
    }
    if (key === 'sniper') {
        const maxSnipers = _waveRuleValue(rules.maxSnipersAlive, wave);
        if (typeof maxSnipers === 'number' && typeCount >= maxSnipers) return false;
    }
    if (key === 'summoner' && typeCount >= (rules.maxSummonersAlive || 1)) return false;
    if (key === 'buffer' && typeCount >= (rules.maxBuffersAlive || 1)) return false;
    return true;
}

function _spawnEnemyFromRegistry(x, y, wave) {
    const registry = window.ENEMY_REGISTRY;
    if (!registry) return null;

    const pool = _getEnemyPoolForWave(wave);
    if (!pool) {
        const r = Math.random();
        if (r < BALANCE.waves.mageSpawnChance) return new MageEnemy(x, y);
        if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance) return new TankEnemy(x, y);
        return new Enemy(x, y);
    }

    const liveCounts = _getExpandedEnemyLiveCounts();
    let total = 0;
    for (const key in pool) {
        if (!Object.prototype.hasOwnProperty.call(pool, key)) continue;
        if (!registry[key] || typeof registry[key].ctor !== 'function') continue;
        if (!_isEnemyEligibleForWave(key, wave, liveCounts)) continue;
        total += pool[key];
    }
    if (total <= 0) return new Enemy(x, y);

    let roll = Math.random() * total;
    for (const key in pool) {
        if (!Object.prototype.hasOwnProperty.call(pool, key)) continue;
        const entry = registry[key];
        if (!entry || typeof entry.ctor !== 'function') continue;
        if (!_isEnemyEligibleForWave(key, wave, liveCounts)) continue;
        roll -= pool[key];
        if (roll <= 0) return new entry.ctor(x, y);
    }
    return new Enemy(x, y);
}

// ══════════════════════════════════════════════════════════════
// 🔁 updateWaveEvent(dt) — called from updateGame()
// ══════════════════════════════════════════════════════════════
function updateWaveEvent(dt) {
    // ── Trickle tick (runs regardless of _evt.active) ──────────
    // B2 FIX: window.isTrickleActive stays true until all batches
    // have spawned, preventing the wave-advance guard from firing.
    if (_trickle.active) {
        _trickle.timer -= dt;
        if (_trickle.timer <= 0) {
            const batch = Math.min(_trickle.batchSize, _trickle.remaining);
            spawnEnemies(batch);
            _trickle.remaining -= batch;
            if (_trickle.remaining <= 0) {
                _trickle.active = false;
                window.isTrickleActive = false;
            } else {
                _trickle.timer = _trickle.interval;
            }
        }
    }

    if (!_evt.active) return;

    if (_evt.announceTimer > 0) _evt.announceTimer -= dt;
    if (typeof waveAnnouncementFX !== 'undefined') waveAnnouncementFX.update(dt);

    if (_evt.active === 'fog') {
        _evt.fogAlpha = Math.min(0.72, _evt.fogAlpha + dt / 1.5);
        _evt.fogDriftX += dt * 18;
        _evt.fogDriftY += dt * 11;
    } else {
        _evt.fogAlpha = Math.min(0.18, _evt.fogAlpha + dt / 0.6);
        _patchEnemySpeeds();   // patch newly-spawned enemies each tick
    }
}

// ══════════════════════════════════════════════════════════════
// 🎨 drawWaveEvent(ctx) — called from drawGame() before UIManager
// ══════════════════════════════════════════════════════════════
function drawWaveEvent(ctx) {
    if (!ctx) return;
    if (_trickle.isDark) _drawDark(ctx);
    if (!_evt.active) return;
    if (_evt.active === 'fog') _drawFog(ctx);
    if (_evt.active === 'speed') _drawSpeed(ctx);
    // _drawBanner ถูกรวมเข้า waveAnnouncementFX.draw() แล้ว — ไม่ต้องเรียกแยก
    if (typeof waveAnnouncementFX !== 'undefined') waveAnnouncementFX.draw(ctx);
}

// ── Dark vignette (wave 1 ominous intro) ──────────────────────
function _drawDark(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const now = performance.now() / 1000;
    const flicker = 0.82 + Math.sin(now * 1.3) * 0.04 + Math.sin(now * 3.7) * 0.02;
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.6, `rgba(0,0,0,${0.28 * flicker})`);
    vg.addColorStop(1, `rgba(0,0,0,${0.72 * flicker})`);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
}

function _drawFog(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const now = performance.now() / 1000, a = _evt.fogAlpha;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Dark amber vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, `rgba(12,8,2,0)`);
    vg.addColorStop(0.5, `rgba(20,10,2,${a * 0.5})`);
    vg.addColorStop(1, `rgba(8,4,1,${a})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Drifting fog wisps — amber/gold tones
    ctx.globalAlpha = a * 0.28;
    for (let i = 0; i < 6; i++) {
        const ox = ((_evt.fogDriftX * (0.4 + i * 0.15)) % W + W) % W;
        const oy = (H * 0.15 * i + Math.sin(now * 0.3 + i) * 30 + H) % H;
        const r = 160 + i * 40;
        const fg = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
        fg.addColorStop(0, 'rgba(180,100,20,0.22)');
        fg.addColorStop(0.5, 'rgba(120,60,10,0.10)');
        fg.addColorStop(1, 'rgba(60,20,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(ox, oy, r, r * 0.45, Math.sin(now * 0.1 + i) * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Radar OFFLINE indicator — gold parallelogram chip
    if (a > 0.3) {
        const rx = W - 200, ry = 90;
        const p = 0.6 + Math.sin(now * 3) * 0.4;
        ctx.globalAlpha = a * p;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#d97706';

        ctx.fillStyle = 'rgba(8,4,1,0.92)';
        ctx.beginPath();
        ctx.moveTo(rx - 60 + 8, ry - 28);
        ctx.lineTo(rx + 60, ry - 28);
        ctx.lineTo(rx + 60 - 8, ry + 28);
        ctx.lineTo(rx - 60, ry + 28);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `rgba(217,119,6,${p * 0.9})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.shadowColor = '#d97706';
        ctx.font = 'bold 9px "Orbitron",Arial,sans-serif';
        ctx.fillStyle = `rgba(250,180,30,${p})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RADAR', rx, ry - 7);
        ctx.fillText('OFFLINE', rx, ry + 7);

        ctx.strokeStyle = `rgba(239,68,68,${p * 0.9})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(rx - 36, ry - 36); ctx.lineTo(rx + 36, ry + 36);
        ctx.moveTo(rx + 36, ry - 36); ctx.lineTo(rx - 36, ry + 36);
        ctx.stroke();
    }
    ctx.restore();
}

function _drawSpeed(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const now = performance.now() / 1000, a = _evt.fogAlpha;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Pulsing red-to-dark vignette
    const p = 0.5 + Math.sin(now * 6) * 0.5;
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.80);
    vg.addColorStop(0, 'rgba(239,68,68,0)');
    vg.addColorStop(0.7, `rgba(239,68,68,${a * 0.35})`);
    vg.addColorStop(1, `rgba(160,15,15,${a * p})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Speed lines — amber glow outer + red core
    ctx.globalAlpha = a * 0.55;
    for (let i = 0; i < 16; i++) {
        const t = ((now * (1.8 + i * 0.2) + i * 0.7) % 1.0);
        const y = H * 0.05 + H * 0.9 * ((i / 16 + t * 0.15) % 1.0);
        const len = 55 + (i % 4) * 35;
        const x = (t * W * 0.4 * (i % 2 === 0 ? 1 : -1) + W * 1.2) % (W * 1.4) - W * 0.2;
        const dir = i % 2 === 0 ? 1 : -1;

        ctx.strokeStyle = 'rgba(217,119,6,0.35)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x - len * dir, y + 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(239,68,68,0.70)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y); ctx.lineTo(x - len * dir, y + 1);
        ctx.stroke();
    }
    ctx.restore();
}

// _drawBanner() ถูกลบแล้ว — event banner รวมอยู่ใน WaveAnnouncementFX.draw() (effects.js)

// ══════════════════════════════════════════════════════════════
// 🌊 _startTrickle — queue batched spawns over time
// ══════════════════════════════════════════════════════════════
function _startTrickle(count, wave, isBossWave = false) {
    const isDark = _getWaveSchedule().dark.has(wave);
    const batchSize = Math.max(1, Math.min(3, Math.ceil(count / 6)));
    const tc = _getTrickleConfig();
    const raw = tc.intervalBase - (wave - 1) * 0.04;
    let interval = isDark
        ? tc.intervalDark
        : Math.max(tc.intervalMin, raw);

    // Boss waves: use slower interval for tension
    if (isBossWave) {
        const bossCfg = BALANCE.waves?.bossWaveEnemies;
        interval = bossCfg?.trickleIntervalBase ?? 2.0;
    }

    _trickle.batchSize = batchSize;
    _trickle.interval = interval;
    _trickle.isDark = isDark;

    // Spawn first batch immediately; queue remainder
    const first = Math.min(batchSize, count);
    spawnEnemies(first);
    const rem = count - first;
    if (rem > 0) {
        _trickle.remaining = rem;
        _trickle.timer = interval;
        _trickle.active = true;
        window.isTrickleActive = true;
    }
}

// ══════════════════════════════════════════════════════════════
// 🌊 startNextWave
// ══════════════════════════════════════════════════════════════
function startNextWave() {
    _deactivateWaveEvent();

    // B3 FIX: one guarded call only (was called twice — second had no guard)
    if (typeof rollShopItems === 'function') rollShopItems();

    _resetWaveState();

    const wave = getWave();
    const count = BALANCE.waves.enemiesBase + (wave - 1) * BALANCE.waves.enemiesPerWave;
    const _sched = _getWaveSchedule();
    const isBossWave = _isBossWave(wave);  // NEW: use helper for flexible boss wave detection
    const isGlitch = (!isBossWave) && _sched.glitch.has(wave);

    Achievements.check('wave_5');
    Achievements.check('wave_10');
    setElementText('wave-badge', GAME_TEXTS.wave.badge(wave));

    if (typeof waveAnnouncementFX !== 'undefined') waveAnnouncementFX.trigger(wave, isBossWave, isGlitch);
    if (!isBossWave) Audio.playBGM(isGlitch ? 'glitch' : 'battle');

    if (!isBossWave && !isGlitch) {
        if (_sched.fog.has(wave)) _activateWaveEvent('fog', wave);
        else if (_sched.speed.has(wave)) _activateWaveEvent('speed', wave);
    }

    // ── Random weather roll (independent of wave event type) ──────────────────
    if (typeof weatherSystem !== 'undefined') {
        const _ws = (typeof WAVE_SCHEDULE !== 'undefined') ? WAVE_SCHEDULE : {};
        const _roll = Math.random();
        const _snow = _ws.snowChance ?? 0.12;
        const _any = _ws.weatherChance ?? 0.35;
        if (_roll < _snow) weatherSystem.setWeather('snow');
        else if (_roll < _any) weatherSystem.setWeather('rain');
        else weatherSystem.setWeather('none');
    }

    if (isGlitch) { _startGlitchWave(count); }
    else if (isBossWave) { _startBossWaveWithEnemies(wave, count); }  // NEW: spawn enemies during boss fight
    else { _startTrickle(count, wave); }
}

// ── Per-wave mutable state reset ─────────────────────────────────────────────
function _resetWaveState() {
    if (window._glitchWaveHpBonus > 0 && window.player) {
        window.player.maxHp -= window._glitchWaveHpBonus;
        window.player.hp = Math.min(window.player.hp, window.player.maxHp);
        window._glitchWaveHpBonus = 0;
    }
    window.isGlitchWave = false;
    window.controlsInverted = false;
    if (typeof GameState !== 'undefined') {
        GameState.isGlitchWave = false;
        GameState.controlsInverted = false;
        GameState.waveSpawnLocked = false;
        GameState.waveSpawnTimer = 0;
        GameState.pendingSpawnCount = 0;
        GameState.lastGlitchCountdown = -1;
        GameState.waveStartDamage = Achievements.stats.damageTaken;
    }
    resetEnemiesKilled();
}

// ── Glitch wave: invert controls, HP bonus, countdown lock ───────────────────
function _startGlitchWave(count) {
    window.isGlitchWave = true;
    window.controlsInverted = true;
    window.glitchIntensity = 0;
    if (typeof GameState !== 'undefined') {
        GameState.isGlitchWave = true;
        GameState.controlsInverted = true;
        GameState.glitchIntensity = 0;
    }

    if (window.player) {
        const bonus = 100;
        window.player.maxHp += bonus; window.player.hp += bonus;
        window._glitchWaveHpBonus = bonus;
        spawnFloatingText(GAME_TEXTS.wave.glitchCrisisHp(bonus), window.player.x, window.player.y - 60, '#22c55e', 22);
        spawnParticles(window.player.x, window.player.y, 10, '#22c55e');
    }

    // B1 FIX: write to GameState.* so game.js lock check works
    if (typeof GameState !== 'undefined') {
        GameState.pendingSpawnCount = Math.floor((count * 2) / 1.5);
        GameState.waveSpawnLocked = true;
        GameState.waveSpawnTimer = BALANCE.waves.glitchGracePeriod / 1000;
        GameState.lastGlitchCountdown = -1;
    }

    spawnFloatingText(GAME_TEXTS.wave.glitchWave, window.player.x, window.player.y - 200, '#d946ef', 44);
    addScreenShake(20); Audio.playBossSpecial();
    setTimeout(() => { if (window.player && !window.player.dead) spawnFloatingText(GAME_TEXTS.wave.glitchAnomaly, window.player.x, window.player.y - 175, '#f472b6', 28); }, 400);
    setTimeout(() => {
        if (window.player && !window.player.dead && typeof GameState !== 'undefined' && GameState.waveSpawnLocked) {
            spawnFloatingText(GAME_TEXTS.wave.glitchControls, window.player.x, window.player.y - 158, '#f472b6', 28);
            if (window.UIManager) window.UIManager.showVoiceBubble('Controls inverted!', window.player.x, window.player.y - 40);
        }
    }, 1200);
    setTimeout(() => {
        if (window.player && !window.player.dead && typeof GameState !== 'undefined' && GameState.waveSpawnLocked)
            spawnFloatingText(GAME_TEXTS.wave.glitchBrace, window.player.x, window.player.y - 148, '#ef4444', 30);
    }, 2400);
}

// ── Boss wave: config-based encounter queue ──────────────────────────────────
// REFACTORED: Now uses BOSS_ENCOUNTERS config instead of hard-coded logic
// Supports arbitrary boss wave patterns (e.g., [4, 8, 12] instead of [3, 6, 9, 12, 15])
function _startBossWave(wave) {
    Audio.playBGM('boss');
    setTimeout(() => {
        // Get encounter config from BOSS_ENCOUNTERS
        const encounter = _getBossEncounterForWave(wave);
        if (!encounter) {
            console.error(`[WaveManager] No boss encounter config found for wave ${wave}`);
            return;
        }

        // B6 FIX: keep both copies in sync so resetRun() zeroing GameState actually takes effect
        window.bossEncounterCount = (window.bossEncounterCount || 0) + 1;
        if (typeof GameState !== 'undefined') GameState.bossEncounterCount = window.bossEncounterCount;

        const bossNameEl = document.getElementById('boss-name');
        const displayLevel = encounter.displayLevel ?? 1;

        // Spawn boss based on config
        if (encounter.boss === 'first') {
            const isAdvanced = encounter.phase === 'advanced';
            window.boss = new KruFirst(displayLevel, isAdvanced);
            UIManager.updateBossHUD(window.boss);
            if (bossNameEl) {
                bossNameEl.innerHTML =
                    `<span style="color:#39ff14;text-shadow:0 0 10px #16a34a">` +
                    `⚛️ KRU FIRST — PHYSICS MASTER${isAdvanced ? ' ⚛️ ADVANCED' : ''}` +
                    `</span>` +
                    ` <span style="font-size:0.78em;color:#86efac">LV. ${displayLevel}</span>` +
                    ` <span class="ai-badge">AI</span>`;
            }
            spawnFloatingText(
                isAdvanced ? GAME_TEXTS.wave.firstAdvanced : GAME_TEXTS.wave.firstIncoming,
                window.player.x, window.player.y - 100, '#39ff14', 35
            );
            setTimeout(() => {
                if (window.player) spawnFloatingText(
                    isAdvanced ? GAME_TEXTS.wave.firstTaglineAdvanced : GAME_TEXTS.wave.firstTagline,
                    window.player.x, window.player.y - 148, '#86efac', 22);
            }, 650);
            setTimeout(() => {
                if (!window.player || !window.UIManager) return;
                window.UIManager.showVoiceBubble(
                    isAdvanced ? "He's gone berserk..." : 'Physics lecture incoming!',
                    window.player.x, window.player.y - 40);
            }, 900);
        } else {
            // ManopBoss
            const enablePhase2 = encounter.phase === 'dogRider' || encounter.phase === 'goldfish';
            const enablePhase3 = encounter.phase === 'goldfish';
            window.boss = new ManopBoss(displayLevel, enablePhase2, enablePhase3);
            UIManager.updateBossHUD(window.boss);
            if (bossNameEl) {
                let phaseTitle = '';
                if (enablePhase3) phaseTitle = ' 🐟 GOLDFISH LOVER';
                else if (enablePhase2) phaseTitle = ' 🐕 DOG RIDER';
                bossNameEl.innerHTML =
                    `KRU MANOP — LV. ${displayLevel}${phaseTitle}` +
                    ` <span class="ai-badge">AI</span>`;
            }
            spawnFloatingText(
                enablePhase3 ? GAME_TEXTS.wave.bossIncomingFish
                    : enablePhase2 ? GAME_TEXTS.wave.bossIncomingRider
                        : GAME_TEXTS.wave.bossIncoming,
                window.player.x, window.player.y - 100,
                enablePhase3 ? '#38bdf8' : enablePhase2 ? '#d97706' : '#ef4444',
                35
            );
            setTimeout(() => {
                if (!window.player || !window.UIManager) return;
                const line = enablePhase3 ? 'The goldfish... RUN!'
                    : enablePhase2 ? 'He brought the dog!'
                        : "He's here. Stay sharp.";
                window.UIManager.showVoiceBubble(line, window.player.x, window.player.y - 40);
            }, 850);
        }

        addScreenShake(15);
        Audio.playBossSpecial();
    }, BALANCE.waves.bossSpawnDelay);
}

// NEW: Boss wave with enemy spawning (50% more enemies than normal)
function _startBossWaveWithEnemies(wave, baseCount) {
    // Start the boss encounter
    _startBossWave(wave);

    // Calculate enemy count with 50% multiplier
    const bossCfg = BALANCE.waves?.bossWaveEnemies;
    const multiplier = bossCfg?.spawnMultiplier ?? 1.5;
    const enemyCount = Math.ceil(baseCount * multiplier);

    // Start trickle spawn for enemies during boss fight
    _startTrickle(enemyCount, wave, true);
}

function spawnEnemies(count) {
    const wave = (typeof getWave === 'function') ? getWave() : 1;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        let x = window.player.x + Math.cos(angle) * BALANCE.waves.spawnDistance;
        let y = window.player.y + Math.sin(angle) * BALANCE.waves.spawnDistance;
        const spawned = _spawnEnemyFromRegistry(x, y, wave);
        const safe = mapSystem.findSafeSpawn(x, y, spawned?.radius || BALANCE.enemy.radius);
        spawned.x = safe.x;
        spawned.y = safe.y;
        window.enemies.push(spawned);

        // ── Tag squad role immediately on spawn (before first SquadAI tick) ──
        if (typeof SquadAI !== 'undefined') {
            SquadAI.tagOnSpawn(window.enemies[window.enemies.length - 1]);
        }

        // Speed wave: patch freshly spawned enemy immediately
        _applyWaveModifiersToEnemy(window.enemies[window.enemies.length - 1]);
    }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.startNextWave = startNextWave;
window.spawnEnemies = spawnEnemies;
window.updateWaveEvent = updateWaveEvent;
window.drawWaveEvent = drawWaveEvent;
window.applyWaveModifiersToEnemy = _applyWaveModifiersToEnemy;
// NEW: Export boss wave helpers for external use
window.getBossEncounterForWave = _getBossEncounterForWave;
window.isBossWave = _isBossWave;
