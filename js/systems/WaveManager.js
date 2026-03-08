'use strict';

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
const FOG_WAVES = new Set(BALANCE.waves.fogWaves);
const SPEED_WAVES = new Set(BALANCE.waves.speedWaves);
const DARK_WAVES = new Set([BALANCE.waves.darkWave]);
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

    if (typeof spawnFloatingText === 'function' && window.player)
        spawnFloatingText(_evt.bannerTitle, window.player.x, window.player.y - 90, _evt.bannerColor, 30);

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
    if (_evt.announceTimer > 0) _drawBanner(ctx);
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

function _drawBanner(ctx) {
    const W = ctx.canvas.width;
    const now = performance.now() / 1000;
    const elapsed = ANNOUNCE_DUR - _evt.announceTimer;

    let alpha = elapsed < 0.35
        ? elapsed / 0.35
        : _evt.announceTimer > 1.2 ? 1 : _evt.announceTimer / 1.2;
    if (alpha <= 0.01) return;

    const cx = W / 2, cy = 155;   // ขยับจาก 82→155: หลีก weapon-indicator (top:20+~60px) และ boss-hud (top:70+~50px)
    const col = _evt.bannerColor;
    const pulse = 1 + Math.sin(now * 4) * 0.025;
    const bw = 460, bh = 68, sl = 14;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;

    ctx.shadowBlur = 36;
    ctx.shadowColor = col;

    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 + sl, cy - bh / 2);
    ctx.lineTo(cx + bw / 2, cy - bh / 2);
    ctx.lineTo(cx + bw / 2 - sl, cy + bh / 2);
    ctx.lineTo(cx - bw / 2, cy + bh / 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8,4,18,0.92)';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    ctx.stroke();

    ctx.save();
    ctx.globalAlpha *= 0.15;
    ctx.fillStyle = col;
    for (let ly = cy - bh / 2 + 1; ly < cy + bh / 2; ly += 4) {
        ctx.fillRect(cx - bw / 2 + sl + 2, ly, bw - sl * 2 - 4, 1);
    }
    ctx.restore();

    const bk = 12;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 + sl + bk, cy - bh / 2 + 3);
    ctx.lineTo(cx - bw / 2 + sl + 3, cy - bh / 2 + 3);
    ctx.lineTo(cx - bw / 2 + sl + 3, cy - bh / 2 + 3 + bk);
    ctx.moveTo(cx + bw / 2 - sl - bk, cy + bh / 2 - 3);
    ctx.lineTo(cx + bw / 2 - sl - 3, cy + bh / 2 - 3);
    ctx.lineTo(cx + bw / 2 - sl - 3, cy + bh / 2 - 3 - bk);
    ctx.stroke();

    ctx.shadowBlur = 14;
    ctx.shadowColor = col;
    ctx.font = `900 ${Math.round(21 * pulse)}px "Orbitron","Bebas Neue",Arial,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(_evt.bannerTitle, cx, cy - 11);

    ctx.save();
    ctx.globalAlpha *= 0.45;
    ctx.fillStyle = col;
    ctx.fillText(_evt.bannerTitle, cx, cy - 11);
    ctx.restore();

    ctx.shadowBlur = 6;
    ctx.shadowColor = col;
    ctx.fillStyle = 'rgba(254,243,199,0.88)';
    ctx.font = 'bold 11px "Rajdhani","Orbitron",Arial,sans-serif';
    ctx.fillText(_evt.bannerSubtitle, cx, cy + 14);

    const tickBase = bw / 2 - sl - 18;
    const rgbStr = col === '#ef4444' ? '239,68,68' : '217,119,6';
    ctx.strokeStyle = `rgba(${rgbStr},0.55)`;
    ctx.lineWidth = 1.2;
    for (let t = 0; t < 3; t++) {
        const d = t * 6;
        ctx.beginPath();
        ctx.moveTo(cx + tickBase + d, cy - 7); ctx.lineTo(cx + tickBase + d, cy + 7);
        ctx.moveTo(cx - tickBase - d, cy - 7); ctx.lineTo(cx - tickBase - d, cy + 7);
        ctx.stroke();
    }

    ctx.restore();
}

// ══════════════════════════════════════════════════════════════
// 🌊 _startTrickle — queue batched spawns over time
// ══════════════════════════════════════════════════════════════
function _startTrickle(count, wave) {
    const isDark = DARK_WAVES.has(wave);
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

    if (window._glitchWaveHpBonus > 0 && window.player) {
        window.player.maxHp -= window._glitchWaveHpBonus;
        window.player.hp = Math.min(window.player.hp, window.player.maxHp);
        window._glitchWaveHpBonus = 0;
    }

    window.isGlitchWave = false;
    if (typeof GameState !== 'undefined') GameState.isGlitchWave = false;
    window.controlsInverted = false;
    if (typeof GameState !== 'undefined') GameState.controlsInverted = false;

    // B1 FIX: was setting window.* but game.js reads GameState.*
    if (typeof GameState !== 'undefined') {
        GameState.waveSpawnLocked = false;
        GameState.waveSpawnTimer = 0;
        GameState.pendingSpawnCount = 0;
        GameState.lastGlitchCountdown = -1;
    }

    resetEnemiesKilled();
    if (typeof GameState !== 'undefined') {
        GameState.waveStartDamage = Achievements.stats.damageTaken;
    }

    setElementText('wave-badge', GAME_TEXTS.wave.badge(getWave()));
    spawnFloatingText(GAME_TEXTS.wave.floatingTitle(getWave()), window.player.x, window.player.y - 100, '#facc15', 40);

    const wave = getWave();
    Achievements.check('wave_5');
    Achievements.check('wave_10');
    const count = BALANCE.waves.enemiesBase + (wave - 1) * BALANCE.waves.enemiesPerWave;
    const isBossWave = wave % BALANCE.waves.bossEveryNWaves === 0;
    const isGlitch = (!isBossWave) && (wave % GLITCH_EVERY_N_WAVES === 0);

    // ── BGM ──────────────────────────────────────────────────
    if (!isBossWave) Audio.playBGM(isGlitch ? 'glitch' : 'battle');

    // ── Special event (skip on boss/glitch waves) ────────────
    if (!isBossWave && !isGlitch) {
        if (FOG_WAVES.has(wave)) _activateWaveEvent('fog', wave);
        else if (SPEED_WAVES.has(wave)) _activateWaveEvent('speed', wave);
    }

    // ── Glitch Wave ──────────────────────────────────────────
    if (isGlitch) {
        window.isGlitchWave = true;
        if (typeof GameState !== 'undefined') GameState.isGlitchWave = true;
        window.controlsInverted = true;
        if (typeof GameState !== 'undefined') GameState.controlsInverted = true;
        window.glitchIntensity = 0;
        if (typeof GameState !== 'undefined') GameState.glitchIntensity = 0;

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

    } else {
        // B2 FIX: trickle instead of instant spawn; isTrickleActive blocks
        // premature wave-advance (game.js must guard: && !window.isTrickleActive)
        _startTrickle(count, wave);
    }

    // ════════════════════════════════════════════════════════════
    // ── Boss Wave — Deterministic encounter queue ─────────────
    //
    //  encounter │ wave │ boss
    //  ──────────┼──────┼──────────────────────────────────────
    //      1     │   3  │ Kru Manop  — Basic
    //      2     │   6  │ Kru First  — Basic
    //      3     │   9  │ Kru Manop  — Dog Rider (enablePhase2)
    //      4     │  12  │ Kru First  — Advanced  (isAdvanced flag)
    //      5     │  15  │ Kru Manop  — Goldfish Lover (phase2+3)
    // ════════════════════════════════════════════════════════════
    if (isBossWave) {
        setTimeout(() => {
            // B6 FIX: keep both copies in sync so resetRun() zeroing GameState
            // actually takes effect on the next run's encounter queue
            window.bossEncounterCount = (window.bossEncounterCount || 0) + 1;
            if (typeof GameState !== 'undefined') GameState.bossEncounterCount = window.bossEncounterCount;
            const encounter = window.bossEncounterCount;
            const bossLevel = Math.floor(wave / BALANCE.waves.bossEveryNWaves);
            const bossNameEl = document.getElementById('boss-name');
            const isFirst = (encounter === 2 || encounter === 4);
            const displayLevel = isFirst ? Math.floor(encounter / 2) : Math.ceil(encounter / 2);

            if (encounter === 2 || encounter === 4) {
                // ── KRU FIRST ──────────────────────────────────
                const isAdvanced = (encounter === 4);
                window.boss = new BossFirst(bossLevel, isAdvanced);
                UIManager.updateBossHUD(window.boss);

                if (bossNameEl) {
                    bossNameEl.innerHTML =
                        `<span style="color:#39ff14;text-shadow:0 0 10px #16a34a">` +
                        `⚛️ KRU FIRST — PHYSICS MASTER` +
                        `${isAdvanced ? ' ⚛️ ADVANCED' : ''}` +
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
                        window.player.x, window.player.y - 148, '#86efac', 22
                    );
                }, 650);
                setTimeout(() => {
                    if (!window.player || !window.UIManager) return;
                    window.UIManager.showVoiceBubble(
                        isAdvanced ? "He's gone berserk..." : 'Physics lecture incoming!',
                        window.player.x, window.player.y - 40
                    );
                }, 900);

            } else {
                // ── KRU MANOP ──────────────────────────────────
                const enablePhase2 = (encounter >= 3);
                const enablePhase3 = (encounter >= 5);

                window.boss = new Boss(bossLevel, enablePhase2, enablePhase3);
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

        Audio.playBGM('boss');
    }
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