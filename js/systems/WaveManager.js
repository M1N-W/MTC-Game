'use strict';

// ══════════════════════════════════════════════════════════════
// 🌊 WAVE MANAGER  (WaveManager.js)
//
// Manages all wave logic including:
//   • Normal waves & enemy spawning
//   • Glitch Wave (every 5th wave)
//   • Fog Wave    — radar blackout, cyan fog vignette
//   • Speed Wave  — enemies ×2 speed, red speed-lines vignette
//
// All mutable state lives on window.* so any script can read/write it.
// ══════════════════════════════════════════════════════════════

// ─── Constants ────────────────────────────────────────────────
const GLITCH_EVERY_N_WAVES = 5;
window.GLITCH_EVERY_N_WAVES = GLITCH_EVERY_N_WAVES;

// Which waves trigger special events (skip boss/glitch waves automatically)
const FOG_WAVES   = new Set([2, 6, 8, 11, 14]);
const SPEED_WAVES = new Set([4, 7, 10, 13, 16]);
const SPEED_MULT  = 2.0;

// ─── Mutable state ─────────────────────────────────────────────
window.isGlitchWave        = false;
window.glitchIntensity     = 0;
window.controlsInverted    = false;
window._glitchWaveHpBonus  = 0;
window.waveSpawnLocked     = false;
window.waveSpawnTimer      = 0;
window.pendingSpawnCount   = 0;
window.lastGlitchCountdown = -1;
window.bossEncounterCount  = 0;
window.waveStartDamage     = 0;
window.isFogWave           = false;
window.isSpeedWave         = false;

// ══════════════════════════════════════════════════════════════
// 🌫️⚡ WAVE EVENT — internal state object
// ══════════════════════════════════════════════════════════════
const _evt = {
    active:         null,   // null | 'fog' | 'speed'
    fogAlpha:       0,
    fogDriftX:      0,
    fogDriftY:      0,
    announceTimer:  0,
    bannerTitle:    '',
    bannerSubtitle: '',
    bannerColor:    '#fff',
};
const ANNOUNCE_DUR    = 3.5;
const _patchedEnemies = new WeakSet();

function _activateWaveEvent(type, wave) {
    _deactivateWaveEvent();
    _evt.active       = type;
    _evt.fogAlpha     = 0;
    _evt.announceTimer = ANNOUNCE_DUR;

    if (type === 'fog') {
        window.isFogWave        = true;
        _evt.bannerTitle        = '🌫️ FOG WAVE';
        _evt.bannerSubtitle     = '— RADAR OFFLINE —';
        _evt.bannerColor        = '#06b6d4';
    } else {
        window.isSpeedWave      = true;
        _evt.bannerTitle        = '⚡ SPEED WAVE';
        _evt.bannerSubtitle     = '— ENEMIES ACCELERATED —';
        _evt.bannerColor        = '#ef4444';
        _patchEnemySpeeds();
    }
    if (typeof spawnFloatingText === 'function' && window.player)
        spawnFloatingText(_evt.bannerTitle, window.player.x, window.player.y - 90, _evt.bannerColor, 28);
    console.log(`[WaveManager] ${type.toUpperCase()} WAVE — wave ${wave}`);
}

function _deactivateWaveEvent() {
    if (_evt.active === 'speed') _restoreEnemySpeeds();
    _evt.active = null; _evt.fogAlpha = 0; _evt.announceTimer = 0;
    window.isFogWave = false; window.isSpeedWave = false;
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
// 🔁 updateWaveEvent(dt) — call from updateGame()
// ══════════════════════════════════════════════════════════════
function updateWaveEvent(dt) {
    if (!_evt.active) return;
    if (_evt.announceTimer > 0) _evt.announceTimer -= dt;
    if (_evt.active === 'fog') {
        _evt.fogAlpha  = Math.min(0.72, _evt.fogAlpha + dt / 1.5);
        _evt.fogDriftX += dt * 18;
        _evt.fogDriftY += dt * 11;
    } else {
        _evt.fogAlpha = Math.min(0.18, _evt.fogAlpha + dt / 0.6);
        _patchEnemySpeeds();   // patch newly-spawned enemies
    }
}

// ══════════════════════════════════════════════════════════════
// 🎨 drawWaveEvent(ctx) — call from drawGame() before UIManager
// ══════════════════════════════════════════════════════════════
function drawWaveEvent(ctx) {
    if (!ctx || !_evt.active) return;
    if (_evt.active === 'fog')   _drawFog(ctx);
    if (_evt.active === 'speed') _drawSpeed(ctx);
    if (_evt.announceTimer > 0)  _drawBanner(ctx);
}

function _drawFog(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const now = performance.now() / 1000, a = _evt.fogAlpha;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    const vg = ctx.createRadialGradient(W/2,H/2,H*0.25, W/2,H/2,H*0.85);
    vg.addColorStop(0, `rgba(6,30,50,0)`);
    vg.addColorStop(0.5, `rgba(6,30,50,${a*0.5})`);
    vg.addColorStop(1, `rgba(2,10,20,${a})`);
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);

    ctx.globalAlpha = a * 0.35;
    for (let i = 0; i < 6; i++) {
        const ox = ((_evt.fogDriftX*(0.4+i*0.15))%W+W)%W;
        const oy = (H*0.15*i + Math.sin(now*0.3+i)*30 + H) % H;
        const r  = 160 + i*40;
        const fg = ctx.createRadialGradient(ox,oy,0,ox,oy,r);
        fg.addColorStop(0, 'rgba(100,200,220,0.22)');
        fg.addColorStop(0.5, 'rgba(50,150,180,0.10)');
        fg.addColorStop(1, 'rgba(0,100,140,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.ellipse(ox,oy,r,r*0.45,Math.sin(now*0.1+i)*0.4,0,Math.PI*2);
        ctx.fill();
    }

    if (a > 0.3) {
        const rx = W - 200, ry = 90;
        const p  = 0.6 + Math.sin(now*3)*0.4;
        ctx.globalAlpha = a*p; ctx.shadowBlur = 14; ctx.shadowColor = '#06b6d4';
        ctx.fillStyle = 'rgba(6,20,35,0.90)';
        ctx.beginPath(); ctx.arc(rx,ry,62,0,Math.PI*2); ctx.fill();
        ctx.font = 'bold 9px "Orbitron",Arial,sans-serif';
        ctx.fillStyle = `rgba(6,182,212,${p})`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('RADAR',rx,ry-8); ctx.fillText('OFFLINE',rx,ry+8);
        ctx.strokeStyle = `rgba(239,68,68,${p*0.9})`; ctx.lineWidth = 3;
        ctx.shadowColor = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(rx-40,ry-40); ctx.lineTo(rx+40,ry+40);
        ctx.moveTo(rx+40,ry-40); ctx.lineTo(rx-40,ry+40);
        ctx.stroke();
    }
    ctx.restore();
}

function _drawSpeed(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const now = performance.now()/1000, a = _evt.fogAlpha;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const p  = 0.5 + Math.sin(now*6)*0.5;
    const vg = ctx.createRadialGradient(W/2,H/2,H*0.35,W/2,H/2,H*0.80);
    vg.addColorStop(0, 'rgba(239,68,68,0)');
    vg.addColorStop(0.7, `rgba(239,68,68,${a*0.4})`);
    vg.addColorStop(1, `rgba(180,20,20,${a*p})`);
    ctx.fillStyle = vg; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha = a*0.5; ctx.strokeStyle = 'rgba(239,68,68,0.55)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
        const t   = ((now*(1.8+i*0.2)+i*0.7) % 1.0);
        const y   = H*0.05 + H*0.9*((i/14+t*0.15)%1.0);
        const len = 60+(i%4)*30;
        const x   = (t*W*0.4*(i%2===0?1:-1)+W*1.2)%(W*1.4)-W*0.2;
        ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-len*(i%2===0?1:-1),y+2); ctx.stroke();
    }
    ctx.restore();
}

function _drawBanner(ctx) {
    const W = ctx.canvas.width, now = performance.now()/1000;
    const elapsed = ANNOUNCE_DUR - _evt.announceTimer;
    let alpha = elapsed < 0.4 ? elapsed/0.4 : _evt.announceTimer > 1.5 ? 1 : _evt.announceTimer/1.5;
    if (alpha <= 0) return;
    const cx = W/2, cy = 80, pulse = 1+Math.sin(now*4)*0.03, col = _evt.bannerColor;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
    ctx.shadowBlur = 30; ctx.shadowColor = col;
    ctx.fillStyle = 'rgba(10,15,25,0.88)';
    ctx.beginPath(); ctx.roundRect(cx-220,cy-32,440,64,12); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.roundRect(cx-220,cy-32,440,64,12); ctx.stroke();
    ctx.shadowBlur = 10; ctx.shadowColor = col; ctx.fillStyle = col;
    ctx.font = `bold ${Math.round(22*pulse)}px "Orbitron",Arial,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(_evt.bannerTitle, cx, cy-10);
    ctx.shadowBlur = 6; ctx.fillStyle = 'rgba(255,255,255,0.80)';
    ctx.font = 'bold 12px "Orbitron",Arial,sans-serif';
    ctx.fillText(_evt.bannerSubtitle, cx, cy+14);
    ctx.restore();
}

// ══════════════════════════════════════════════════════════════
// 🌊 startNextWave
// ══════════════════════════════════════════════════════════════
function startNextWave() {
    _deactivateWaveEvent();

    if (window._glitchWaveHpBonus > 0 && window.player) {
        window.player.maxHp -= window._glitchWaveHpBonus;
        window.player.hp     = Math.min(window.player.hp, window.player.maxHp);
        window._glitchWaveHpBonus = 0;
    }

    window.isGlitchWave = false; window.controlsInverted = false;
    window.waveSpawnLocked = false; window.waveSpawnTimer = 0;
    window.pendingSpawnCount = 0; window.lastGlitchCountdown = -1;

    resetEnemiesKilled();
    window.waveStartDamage = Achievements.stats.damageTaken;
    setElementText('wave-badge', GAME_TEXTS.wave.badge(getWave()));
    spawnFloatingText(GAME_TEXTS.wave.floatingTitle(getWave()), window.player.x, window.player.y - 100, '#8b5cf6', 40);

    const wave       = getWave();
    const count      = BALANCE.waves.enemiesBase + (wave-1) * BALANCE.waves.enemiesPerWave;
    const isBossWave = wave % BALANCE.waves.bossEveryNWaves === 0;
    const isGlitch   = (!isBossWave) && (wave % GLITCH_EVERY_N_WAVES === 0);

    // ── BGM ──────────────────────────────────────────────────
    if (!isBossWave) Audio.playBGM(isGlitch ? 'glitch' : 'battle');

    // ── Special event (skip on boss/glitch waves) ────────────
    if (!isBossWave && !isGlitch) {
        if      (FOG_WAVES.has(wave))   _activateWaveEvent('fog',   wave);
        else if (SPEED_WAVES.has(wave)) _activateWaveEvent('speed', wave);
    }

    // ── Glitch Wave ──────────────────────────────────────────
    if (isGlitch) {
        window.isGlitchWave = true; window.controlsInverted = true; window.glitchIntensity = 0;
        if (window.player) {
            const bonus = 100;
            window.player.maxHp += bonus; window.player.hp += bonus;
            window._glitchWaveHpBonus = bonus;
            spawnFloatingText(GAME_TEXTS.wave.glitchCrisisHp(bonus), window.player.x, window.player.y-60, '#22c55e', 22);
            spawnParticles(window.player.x, window.player.y, 10, '#22c55e');
        }
        window.pendingSpawnCount = Math.floor((count*2)/1.5);
        window.waveSpawnLocked   = true;
        window.waveSpawnTimer    = BALANCE.waves.glitchGracePeriod / 1000;
        window.lastGlitchCountdown = -1;
        spawnFloatingText(GAME_TEXTS.wave.glitchWave, window.player.x, window.player.y-200, '#d946ef', 44);
        addScreenShake(20); Audio.playBossSpecial();
        setTimeout(() => { if (window.player) spawnFloatingText(GAME_TEXTS.wave.glitchAnomaly, window.player.x, window.player.y-180, '#f472b6', 26); }, 400);
        setTimeout(() => { if (window.player && window.waveSpawnLocked) spawnFloatingText(GAME_TEXTS.wave.glitchControls, window.player.x, window.player.y-160, '#f472b6', 22); }, 1200);
        setTimeout(() => { if (window.player && window.waveSpawnLocked) spawnFloatingText(GAME_TEXTS.wave.glitchBrace, window.player.x, window.player.y-155, '#ef4444', 24); }, 2400);
    } else {
        spawnEnemies(count);
    }

    // ── Boss Wave ────────────────────────────────────────────
    if (isBossWave) {
        setTimeout(() => {
            window.bossEncounterCount++;
            const isRider         = window.bossEncounterCount >= 2;
            const isGoldfishLover = window.bossEncounterCount >= 3;
            const bossLevel       = Math.floor(wave / BALANCE.waves.bossEveryNWaves);
            window.boss = new Boss(bossLevel, isRider, isGoldfishLover);
            UIManager.updateBossHUD(window.boss);
            const bossNameEl = document.getElementById('boss-name');
            if (bossNameEl) bossNameEl.innerHTML =
                `KRU MANOP - LEVEL ${bossLevel}${isRider?' 🐕 DOG RIDER':''}${isGoldfishLover?' 🐟 GOLDFISH LOVER':''} <span class="ai-badge">AI</span>`;
            spawnFloatingText(
                isGoldfishLover ? GAME_TEXTS.wave.bossIncomingFish : isRider ? GAME_TEXTS.wave.bossIncomingRider : GAME_TEXTS.wave.bossIncoming,
                window.player.x, window.player.y-100,
                isGoldfishLover ? '#38bdf8' : isRider ? '#d97706' : '#ef4444', 35
            );
            addScreenShake(15); Audio.playBossSpecial();
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
        if      (r < BALANCE.waves.mageSpawnChance)                                   window.enemies.push(new MageEnemy(x,y));
        else if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance)   window.enemies.push(new TankEnemy(x,y));
        else                                                                           window.enemies.push(new Enemy(x,y));
    }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.startNextWave   = startNextWave;
window.spawnEnemies    = spawnEnemies;
window.updateWaveEvent = updateWaveEvent;
window.drawWaveEvent   = drawWaveEvent;