'use strict';

// ══════════════════════════════════════════════════════════════
// 🌊 WAVE MANAGER (extracted from game.js)
// All mutable state lives on window.* so any script can read/write it.
// ══════════════════════════════════════════════════════════════

// ─── Constant (immutable) ─────────────────────────────────────
const GLITCH_EVERY_N_WAVES = 5;
window.GLITCH_EVERY_N_WAVES = GLITCH_EVERY_N_WAVES;

// ─── Mutable state — initialised on window directly ───────────
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

// ══════════════════════════════════════════════════════════════
// 🌊 WAVE SYSTEM
// ══════════════════════════════════════════════════════════════

function startNextWave() {
    if (window._glitchWaveHpBonus > 0 && window.player) {
        window.player.maxHp -= window._glitchWaveHpBonus;
        window.player.hp     = Math.min(window.player.hp, window.player.maxHp);
        window._glitchWaveHpBonus = 0;
        console.log('[GlitchWave] HP bonus removed — player.maxHp:', window.player.maxHp);
    }

    window.isGlitchWave     = false;
    window.controlsInverted = false;

    window.waveSpawnLocked     = false;
    window.waveSpawnTimer      = 0;
    window.pendingSpawnCount   = 0;
    window.lastGlitchCountdown = -1;

    resetEnemiesKilled();
    window.waveStartDamage = Achievements.stats.damageTaken;
    setElementText('wave-badge', `WAVE ${getWave()}`);
    spawnFloatingText(`WAVE ${getWave()}`, window.player.x, window.player.y - 100, '#8b5cf6', 40);

    const count = BALANCE.waves.enemiesBase + (getWave() - 1) * BALANCE.waves.enemiesPerWave;

    // ── BGM: switch to battle music for normal + glitch waves ──────────────
    if (getWave() % BALANCE.waves.bossEveryNWaves !== 0) {
        if (getWave() % GLITCH_EVERY_N_WAVES === 0) {
            Audio.playBGM('glitch');
        } else {
            Audio.playBGM('battle');
        }
    }

    if (getWave() % GLITCH_EVERY_N_WAVES === 0) {
        window.isGlitchWave     = true;
        window.controlsInverted = true;
        window.glitchIntensity  = 0;

        if (window.player) {
            const bonus              = 100;
            window.player.maxHp     += bonus;
            window.player.hp        += bonus;
            window._glitchWaveHpBonus = bonus;
            spawnFloatingText(
                `🛡️ +${bonus} CRISIS HP`,
                window.player.x, window.player.y - 60,
                '#22c55e', 22
            );
            spawnParticles(window.player.x, window.player.y, 10, '#22c55e');
            console.log(`[GlitchWave] HP bonus applied — player.maxHp: ${window.player.maxHp}, player.hp: ${window.player.hp}`);
        }

        window.pendingSpawnCount   = Math.floor((count * 2) / 1.5);
        window.waveSpawnLocked     = true;
        window.waveSpawnTimer      = BALANCE.waves.glitchGracePeriod / 1000;
        window.lastGlitchCountdown = -1;

        spawnFloatingText('⚡ GLITCH WAVE ⚡', window.player.x, window.player.y - 200, '#d946ef', 44);
        addScreenShake(20);
        Audio.playBossSpecial();

        setTimeout(() => {
            if (window.player)
                spawnFloatingText('⚠️ SYSTEM ANOMALY DETECTED... ⚠️', window.player.x, window.player.y - 180, '#f472b6', 26);
        }, 400);
        setTimeout(() => {
            if (window.player && window.waveSpawnLocked)
                spawnFloatingText('CONTROLS INVERTED!', window.player.x, window.player.y - 160, '#f472b6', 22);
        }, 1200);
        setTimeout(() => {
            if (window.player && window.waveSpawnLocked)
                spawnFloatingText('BRACE FOR IMPACT...', window.player.x, window.player.y - 155, '#ef4444', 24);
        }, 2400);

    } else {
        spawnEnemies(count);
    }

    if (getWave() % BALANCE.waves.bossEveryNWaves === 0) {
        setTimeout(() => {
            window.bossEncounterCount++;
            const isRider         = window.bossEncounterCount >= 2;
            const isGoldfishLover = window.bossEncounterCount >= 3;
            const bossLevel       = Math.floor(getWave() / BALANCE.waves.bossEveryNWaves);

            window.boss = new Boss(bossLevel, isRider, isGoldfishLover);
            UIManager.updateBossHUD(window.boss);

            const riderTag    = isRider ? ' 🐕 DOG RIDER' : '';
            const goldfishTag = isGoldfishLover ? ' 🐟 GOLDFISH LOVER' : '';
            const bossNameEl  = document.getElementById('boss-name');
            if (bossNameEl) {
                bossNameEl.innerHTML =
                    `KRU MANOP - LEVEL ${bossLevel}${riderTag}${goldfishTag} <span class="ai-badge">AI</span>`;
            }

            spawnFloatingText(
                isGoldfishLover ? 'BOSS INCOMING!🐟' : (isRider ? 'BOSS INCOMING!🐕' : 'BOSS INCOMING!'),
                window.player.x, window.player.y - 100,
                isGoldfishLover ? '#38bdf8' : (isRider ? '#d97706' : '#ef4444'),
                35
            );
            addScreenShake(15);
            Audio.playBossSpecial();
        }, BALANCE.waves.bossSpawnDelay);

        // Switch to boss BGM when boss spawns
        Audio.playBGM('boss');
    }
}

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const angle    = Math.random() * Math.PI * 2;
        const distance = BALANCE.waves.spawnDistance;
        let x = window.player.x + Math.cos(angle) * distance;
        let y = window.player.y + Math.sin(angle) * distance;
        const safe = mapSystem.findSafeSpawn(x, y, BALANCE.enemy.radius);
        x = safe.x; y = safe.y;

        const r = Math.random();
        if      (r < BALANCE.waves.mageSpawnChance)
            window.enemies.push(new MageEnemy(x, y));
        else if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance)
            window.enemies.push(new TankEnemy(x, y));
        else
            window.enemies.push(new Enemy(x, y));
    }
}

window.startNextWave = startNextWave;
window.spawnEnemies  = spawnEnemies;
