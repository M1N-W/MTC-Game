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
 *   - Boss encounter queue: _startBossWave() deterministic per bossEncounterCount.
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
 *  L.34   GLITCH_EVERY_N_WAVES       glitch cadence constant
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
const GLITCH_EVERY_N_WAVES = 5;
window.GLITCH_EVERY_N_WAVES = GLITCH_EVERY_N_WAVES;

// Which waves trigger special events.
// Rules:  must NOT overlap with multiples of 3 (boss waves: 3,6,9,12,15)
//         must NOT overlap with multiples of 5 (glitch waves: 5,10)  [handled by isGlitch guard]
//
// Wave event configurations now centralized in BALANCE.waves
// Effective wave schedule (maxWaves=15, bossEveryN=3, glitchEveryN=5):
//   Boss  : 3, 6, 9, 12, 15
//   Glitch: 5, 10
//   Fog   : 2, 8, 11, 14
//   Speed : 4, 7, 13
//   Dark  : 1
// NEW — lazy: อ่านตอน startNextWave() เพื่อให้ config แก้ได้ runtime
// (ยังเป็น in-memory, JSON-ready: เปลี่ยน BALANCE.waves → parsed JSON ได้ทันที)
// NEW — JSON-ready: อ่านจาก window.WAVE_SCHEDULE แทนชุดค่าคงที่แบบกระจาย
function _getWaveSchedule() {
    const ws = window.WAVE_SCHEDULE || {};
    return {
        fog: new Set(ws.fogWaves ?? [2, 8, 11, 14]),
        speed: new Set(ws.speedWaves ?? [4, 7, 13]),
        glitch: new Set(ws.glitchWaves ?? [5, 10]),
        dark: new Set(Array.isArray(ws.darkWave) ? ws.darkWave : [ws.darkWave ?? 1]),
        boss: new Set(ws.bossWaves ?? [3, 6, 9, 12, 15]),
    };
}
const SPEED_MULT = 1.5;

// Trickle spawn — enemies arrive in small batches over time (normal/fog/speed waves)
const TRICKLE_INTERVAL_BASE = 1.4;   // seconds between batches (wave 1)
const TRICKLE_INTERVAL_MIN = 0.9;   // floor at late waves
const TRICKLE_INTERVAL_DARK = 1.8;   // Dark wave: slower = more ominous

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
        if (!e || e.dead || _patchedEnemies.has(e) || typeof e.speed !== 'number') continue;
        e._preSpeedWave = e.speed;
        e.speed *= SPEED_MULT;
        _patchedEnemies.add(e);
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
function _startTrickle(count, wave) {
    const isDark = _getWaveSchedule().dark.has(wave);
    const batchSize = Math.max(1, Math.min(3, Math.ceil(count / 6)));
    const raw = TRICKLE_INTERVAL_BASE - (wave - 1) * 0.04;
    const interval = isDark
        ? TRICKLE_INTERVAL_DARK
        : Math.max(TRICKLE_INTERVAL_MIN, raw);

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
    const isBossWave = _sched.boss.has(wave);
    const isGlitch = (!isBossWave) && _sched.glitch.has(wave);

    Achievements.check('wave_5');
    Achievements.check('wave_10');
    setElementText('wave-badge', GAME_TEXTS.wave.badge(wave));

    if (typeof waveAnnouncementFX !== 'undefined') waveAnnouncementFX.trigger(wave, isBossWave, isGlitch);
    if (!isBossWave) Audio.playBGM(isGlitch ? 'glitch' : 'battle');

    if (!isBossWave && !isGlitch) {
        const _sched = _getWaveSchedule();
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
    else if (isBossWave) { _startBossWave(wave); }
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

// ── Boss wave: deterministic encounter queue ──────────────────────────────────
//
//  encounter │ wave │ boss
//  ──────────┼──────┼──────────────────────────────────────
//      1     │   3  │ Kru Manop  — Basic
//      2     │   6  │ Kru First  — Basic
//      3     │   9  │ Kru Manop  — Dog Rider (enablePhase2)
//      4     │  12  │ Kru First  — Advanced  (isAdvanced flag)
//      5     │  15  │ Kru Manop  — Goldfish Lover (phase2+3)
function _startBossWave(wave) {
    Audio.playBGM('boss');
    setTimeout(() => {
        // B6 FIX: keep both copies in sync so resetRun() zeroing GameState actually takes effect
        window.bossEncounterCount = (window.bossEncounterCount || 0) + 1;
        if (typeof GameState !== 'undefined') GameState.bossEncounterCount = window.bossEncounterCount;

        const encounter = window.bossEncounterCount;
        const bossLevel = Math.floor(wave / BALANCE.waves.bossEveryNWaves);
        const bossNameEl = document.getElementById('boss-name');
        const isFirst = (encounter === 2 || encounter === 4);
        const displayLevel = isFirst ? Math.floor(encounter / 2) : Math.ceil(encounter / 2);

        if (isFirst) {
            const isAdvanced = (encounter === 4);
            window.boss = new KruFirst(bossLevel, isAdvanced);
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
            const enablePhase2 = (encounter >= 3);
            const enablePhase3 = (encounter >= 5);
            window.boss = new ManopBoss(bossLevel, enablePhase2, enablePhase3);
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

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        let x = window.player.x + Math.cos(angle) * BALANCE.waves.spawnDistance;
        let y = window.player.y + Math.sin(angle) * BALANCE.waves.spawnDistance;
        const safe = mapSystem.findSafeSpawn(x, y, BALANCE.enemy.radius);
        x = safe.x; y = safe.y;
        const r = Math.random();
        if (r < BALANCE.waves.mageSpawnChance)
            window.enemies.push(new MageEnemy(x, y));
        else if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance)
            window.enemies.push(new TankEnemy(x, y));
        else
            window.enemies.push(new Enemy(x, y));

        // ── Tag squad role immediately on spawn (before first SquadAI tick) ──
        if (typeof SquadAI !== 'undefined') {
            SquadAI.tagOnSpawn(window.enemies[window.enemies.length - 1]);
        }

        // Speed wave: patch freshly spawned enemy immediately
        if (window.isSpeedWave) {
            const e = window.enemies[window.enemies.length - 1];
            if (e && !_patchedEnemies.has(e) && typeof e.speed === 'number') {
                e._preSpeedWave = e.speed;
                e.speed *= SPEED_MULT;
                _patchedEnemies.add(e);
            }
        }
    }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.startNextWave = startNextWave;
window.spawnEnemies = spawnEnemies;
window.updateWaveEvent = updateWaveEvent;
window.drawWaveEvent = drawWaveEvent;