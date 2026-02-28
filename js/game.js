'use strict';

// ════════════════════════════════════════════════════════════════
// 🤖 AI SAFETY FALLBACK
// ════════════════════════════════════════════════════════════════
if (typeof window.Gemini === 'undefined') {
    window.Gemini = {
        init: () => console.log('🤖 AI System: Offline (Safe Fallback)'),
        generateText: async () => '...',
        generateMission: async () => 'Defeat the enemies!',
        generateReportCard: async () => 'Great job!',
        speak: () => { },
        getMissionName: async () => 'MTC Adventure',
        getReportCard: async () => 'ตั้งใจเรียนให้มากกว่านี้นะ...',
        getBossTaunt: async () => '',
    };
}

const DEBUG_MODE = false;

/**
 * 🎮 MTC the Game Beta Edition - Main Game Loop (REFACTORED)
 * BGM FIX: Audio.init() moved to window.onload so menu BGM fires correctly.
 * startGame() no longer calls Audio.init() to avoid resetting userInteracted.
 */

// ─── Game State ───────────────────────────────────────────────
// State now lives in GameState singleton (js/systems/GameState.js).
// window.gameState / GameState.loopRunning kept as compat aliases during transition.
let rafId = null;

// Thin wrapper — delegates to GameState.setPhase() which syncs window.gameState too.
function setGameState(s) {
    GameState.setPhase(s);
}
window.setGameState = setGameState;

// ─── HUD Draw Bridge ──────────────────────────────────────────
let _lastDrawDt = 0;

// ─── Cached background gradient ──────────────────────────────
let _bgGrad = null;
let _bgGradW = 0, _bgGradH = 0;
let _bgGradTop = '', _bgGradBot = '';

// ─── Achievement throttle ─────────────────────────────────────
let _achFrame = 0;

// ─── Day / Night cycle ────────────────────────────────────────
let dayNightTimer = 0;

// ─── Game Objects (global) ────────────────────────────────────
// Entity refs — now owned by GameState; window.* aliases set via GameState._syncAliases()
// so files not yet migrated continue to read window.enemies etc. without change.
// Direct access in this file uses GameState.xxx going forward.
window.player = null;   // assigned individually in startGame() — stays on window for compat

// ── Extracted systems loaded from js/systems/:
//    AdminSystem.js, ShopSystem.js, TimeManager.js, WaveManager.js

// ══════════════════════════════════════════════════════════════
// 🎓 TUTORIAL INPUT BRIDGE
// ══════════════════════════════════════════════════════════════

const _tut = {
    _prevMove: false, _prevShoot: false, _prevDash: false,
    _prevSkill: false, _prevBulletTime: false,
};

function _tutorialForwardInput() {
    if (typeof TutorialSystem === 'undefined' || !TutorialSystem.isActive()) return;
    const moving = keys.w || keys.a || keys.s || keys.d;
    if (moving && !_tut._prevMove) TutorialSystem.handleAction('move');
    _tut._prevMove = !!moving;
    if (mouse.left && !_tut._prevShoot) TutorialSystem.handleAction('shoot');
    _tut._prevShoot = !!mouse.left;
    if (keys.space && !_tut._prevDash) TutorialSystem.handleAction('dash');
    _tut._prevDash = !!keys.space;
    if (mouse.right && !_tut._prevSkill) TutorialSystem.handleAction('skill');
    _tut._prevSkill = !!mouse.right;
    if (GameState.isSlowMotion && !_tut._prevBulletTime) TutorialSystem.handleAction('bullettime');
    _tut._prevBulletTime = !!GameState.isSlowMotion;
}

// ══════════════════════════════════════════════════════════════
// 🔁 GAME LOOP
// ══════════════════════════════════════════════════════════════

function gameLoop(now) {
    // BUG FIX: Validate canvas context before drawing
    if (!CTX || !CANVAS) {
        console.warn('[gameLoop] Canvas context lost, stopping loop');
        GameState.loopRunning = false;
        rafId = null;
        return;
    }

    const dt = getDeltaTime(now);

    if (GameState.hitStopTimer > 0) {
        GameState.hitStopTimer -= dt;
        if (GameState.hitStopTimer < 0) GameState.hitStopTimer = 0;
        drawGame();
        requestAnimationFrame(gameLoop);
        return;
    }

    if (GameState.phase === 'PLAYING') {
        // BUG-3 FIX: guard in case TimeManager.js hasn't loaded yet
        if (typeof _tickSlowMoEnergy === 'function') _tickSlowMoEnergy(dt);
    }

    const scaledDt = dt * GameState.timeScale;
    _lastDrawDt = scaledDt;

    if (GameState.phase === 'PLAYING') {
        if (typeof TutorialSystem !== 'undefined' && TutorialSystem.isActive()) {
            _tutorialForwardInput();
            TutorialSystem.update();
            if (TutorialSystem.isActionStep()) updateGame(scaledDt);
            drawGame();
        } else {
            updateGame(scaledDt);
            drawGame();
        }
    } else if (GameState.phase === 'PAUSED') {
        drawGame();
        const shopModal = document.getElementById('shop-modal');
        if (shopModal && shopModal.style.display === 'flex') ShopManager.tick();
    }

    // IMP-1 FIX: stop the RAF loop when the game is over so we don't keep
    // churning the GPU for a static screen.  loopRunning is reset to false
    // so startGame() can safely restart the loop next round.
    if (GameState.phase === 'GAMEOVER') {
        GameState.loopRunning = false;
        rafId = null;
        return;
    }

    rafId = requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    // IMP-4 FIX: guard against null player (can happen on first frame or
    // if player object is destroyed before the loop detects GAMEOVER)
    if (!window.player) return;

    // Player death check — call endGame once then bail out of the update
    if (window.player.dead) {
        window.endGame('defeat');
        return;
    }

    updateCamera(window.player.x, window.player.y);
    updateMouseWorld();

    const GLITCH_RAMP = 0.8;
    if (GameState.isGlitchWave) {
        GameState.glitchIntensity = Math.min(1.0, GameState.glitchIntensity + GLITCH_RAMP * dt);
    } else {
        GameState.glitchIntensity = Math.max(0.0, GameState.glitchIntensity - GLITCH_RAMP * 2 * dt);
    }

    // ── Wave Events (Fog / Speed) ──────────────────────────────
    if (typeof updateWaveEvent === 'function') updateWaveEvent(dt);

    if (GameState.waveSpawnLocked) {
        GameState.waveSpawnTimer -= dt;
        const secsLeft = Math.ceil(GameState.waveSpawnTimer);
        if (secsLeft !== GameState.lastGlitchCountdown && secsLeft > 0 && secsLeft <= 3) {
            GameState.lastGlitchCountdown = secsLeft;
            spawnFloatingText(GAME_TEXTS.wave.spawnCountdown(secsLeft), window.player.x, window.player.y - 145, '#d946ef', 34);
            addScreenShake(6);
        }
        if (GameState.waveSpawnTimer <= 0) {
            GameState.waveSpawnLocked = false;
            GameState.lastGlitchCountdown = -1;
            spawnEnemies(GameState.pendingSpawnCount);
            spawnFloatingText(GAME_TEXTS.wave.chaosBegins, window.player.x, window.player.y - 160, '#ef4444', 44);
            addScreenShake(28);
            Audio.playBossSpecial();
        }
    }

    dayNightTimer += dt;
    {
        const L = BALANCE.LIGHTING;
        const phi = (dayNightTimer / L.cycleDuration) * Math.PI * 2;
        const dayPhase = Math.sin(phi) * 0.5 + 0.5;
        L.ambientLight = L.nightMinLight + dayPhase * (L.dayMaxLight - L.nightMinLight);
    }

    if (window.player.shopDamageBoostActive) {
        window.player.shopDamageBoostTimer -= dt;
        if (window.player.shopDamageBoostTimer <= 0) {
            window.player.shopDamageBoostActive = false;
            window.player.damageBoost = window.player._baseDamageBoost !== undefined ? window.player._baseDamageBoost : 1.0;
            spawnFloatingText(GAME_TEXTS.shop.dmgBoostExpired, window.player.x, window.player.y - 50, '#94a3b8', 14);
        }
    }

    if (window.player.shopSpeedBoostActive) {
        window.player.shopSpeedBoostTimer -= dt;
        if (window.player.shopSpeedBoostTimer <= 0) {
            window.player.shopSpeedBoostActive = false;
            if (window.player._baseMoveSpeed !== undefined) window.player.moveSpeed = window.player._baseMoveSpeed;
            spawnFloatingText(GAME_TEXTS.shop.spdBoostExpired, window.player.x, window.player.y - 50, '#94a3b8', 14);
        }
    }

    const dToServer = dist(window.player.x, window.player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const _inTutorial = typeof TutorialSystem !== 'undefined' && TutorialSystem.isActive();

    if (!_inTutorial && dToServer < MTC_DATABASE_SERVER.INTERACTION_RADIUS && keys.e === 1) {
        keys.e = 0; openExternalDatabase(); return;
    }
    if (!_inTutorial && dToServer < MTC_DATABASE_SERVER.INTERACTION_RADIUS && keys.f === 1) {
        keys.f = 0; openAdminConsole(); return;
    }

    const dToShop = dist(window.player.x, window.player.y, MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);
    if (!_inTutorial && dToShop < MTC_SHOP_LOCATION.INTERACTION_RADIUS && keys.b === 1) {
        keys.b = 0; openShop(); return;
    }

    const effectiveKeys = GameState.controlsInverted
        ? { ...keys, w: keys.s, s: keys.w, a: keys.d, d: keys.a }
        : keys;
    window.player.update(dt, effectiveKeys, mouse);

    if (!(window.player instanceof PoomPlayer) && !(typeof AutoPlayer === 'function' && window.player instanceof AutoPlayer)) {
        weaponSystem.update(dt);

        // 🛡️ KAO FIX: Do NOT run WeaponSystem's burst loop for KaoPlayer.
        //    WeaponSystem.updateBurst() calls shootSingle() which fires projectiles
        //    that bypass KaoPlayer's own this.shootCooldown entirely, producing the
        //    OP machine-gun effect.  KaoPlayer.shoot() handles all fire-rate gating
        //    internally — WeaponSystem burst is for other characters only.
        const isKao = typeof KaoPlayer !== 'undefined' && window.player instanceof KaoPlayer;
        if (!isKao) {
            const burstProjectiles = weaponSystem.updateBurst(window.player, window.player.damageBoost);
            if (burstProjectiles && burstProjectiles.length > 0) projectileManager.add(burstProjectiles);
        }

        // Route shooting: Kao and Poom use their own shoot(); Auto uses WeaponSystem
        const isPoom = typeof PoomPlayer !== 'undefined' && window.player instanceof PoomPlayer;
        if (isKao || isPoom) {
            if (mouse.left === 1 && GameState.phase === 'PLAYING') {
                window.player.shoot(dt);
            }
        } else if (mouse.left === 1 && GameState.phase === 'PLAYING') {
            if (weaponSystem.canShoot()) {
                const projectiles = weaponSystem.shoot(window.player, window.player.damageBoost);
                if (projectiles && projectiles.length > 0) {
                    projectileManager.add(projectiles);
                    if (typeof window.player.triggerRecoil === 'function') window.player.triggerRecoil();
                }
            }
        }
    }

    if (window.player instanceof PoomPlayer) {
        if (mouse.left === 1 && GameState.phase === 'PLAYING') shootPoom(window.player);
        if (mouse.right === 1) {
            if (window.player.cooldowns.eat <= 0 && !window.player.isEatingRice) window.player.eatRice();
            mouse.right = 0;
        }
        if (keys.q === 1) {
            if (window.player.cooldowns.naga <= 0) window.player.summonNaga();
            keys.q = 0;
        }
    }
    if (window.player) UIManager.updateSkillIcons(window.player);

    if (window.drone && window.player && !window.player.dead) window.drone.update(dt, window.player);

    if (!_inTutorial && window.boss) window.boss.update(dt, window.player);

    if (!_inTutorial) {
        for (let i = window.enemies.length - 1; i >= 0; i--) {
            window.enemies[i].update(dt, window.player);
            if (window.enemies[i].dead) window.enemies.splice(i, 1);
        }
    }

    if (!_inTutorial && getWave() % BALANCE.waves.bossEveryNWaves !== 0 && window.enemies.length === 0 && !window.boss && !GameState.waveSpawnLocked) {
        if (Achievements.stats.damageTaken === GameState.waveStartDamage && getEnemiesKilled() >= BALANCE.waves.minKillsForNoDamage) {
            Achievements.check('no_damage');
        }
        GameState.waveStartDamage = Achievements.stats.damageTaken;
        setWave(getWave() + 1);
        Achievements.check('wave_1');
        // ── Wave Events: end old event, start new ──────────────
        // wave event handled inside startNextWave()
        // WARN-2 FIX: guard against WaveManager not yet loaded
        if (typeof startNextWave === 'function') startNextWave();
    }

    for (let i = window.specialEffects.length - 1; i >= 0; i--) {
        const remove = window.specialEffects[i].update(dt, window.player, window.meteorZones);
        if (remove) window.specialEffects.splice(i, 1);
    }

    projectileManager.update(dt, window.player, window.enemies, window.boss);

    // ── Explosive Barrel — Projectile Collision & Explosion ───────────
    // Runs every frame after projectile positions are finalised.
    // Two passes:
    //   Pass A — check every live projectile against every barrel.
    //            Damage the barrel; mark the projectile dead.
    //   Pass B — for any barrel that just died, trigger the AoE explosion
    //            and queue it for removal from mapSystem.objects.
    //
    // Both passes are guarded so that a barrel which exploded *this frame*
    // cannot be hit again before it is removed, and a single projectile
    // cannot damage two barrels in one frame (proj.dead breaks the inner loop).
    if (typeof projectileManager !== 'undefined' && projectileManager &&
        projectileManager.projectiles && Array.isArray(projectileManager.projectiles) &&
        window.mapSystem && Array.isArray(window.mapSystem.objects)) {

        const allProj = projectileManager.projectiles;

        // ── Pass A: projectile → barrel hit detection ─────────────────
        for (let pi = allProj.length - 1; pi >= 0; pi--) {
            const proj = allProj[pi];
            if (!proj || proj.dead) continue;

            for (let bi = window.mapSystem.objects.length - 1; bi >= 0; bi--) {
                const obj = window.mapSystem.objects[bi];
                // Only target live ExplosiveBarrel instances
                if (!(obj instanceof ExplosiveBarrel) || obj.isExploded) continue;

                // Circle–rectangle collision: treat barrel as its AABB
                const closestX = Math.max(obj.x, Math.min(proj.x, obj.x + obj.w));
                const closestY = Math.max(obj.y, Math.min(proj.y, obj.y + obj.h));
                const hitDist = Math.hypot(proj.x - closestX, proj.y - closestY);

                if (hitDist < (proj.radius || 6)) {
                    // ── Register hit on barrel ──────────────────────────
                    const dmg = proj.damage || 10;
                    obj.hp -= dmg;

                    // Hit spark feedback
                    spawnParticles(proj.x, proj.y, 5, '#f59e0b');

                    // Destroy projectile so it doesn't travel further
                    proj.dead = true;

                    // Invalidate sorted draw cache (visual state changed)
                    window.mapSystem._sortedObjects = null;

                    break; // one projectile hits at most one barrel per frame
                }
            }
        }

        // ── Pass B: barrel death → AoE explosion ──────────────────────
        const survivingObjects = [];
        for (const obj of window.mapSystem.objects) {

            // Non-barrel objects always survive this loop
            if (!(obj instanceof ExplosiveBarrel)) {
                survivingObjects.push(obj);
                continue;
            }

            if (obj.hp <= 0 && !obj.isExploded) {
                // ── Mark exploded first — prevents double-trigger ───────
                obj.isExploded = true;

                const barrelCX = obj.x + obj.w / 2;
                const barrelCY = obj.y + obj.h / 2;

                // ── Screen-shake & particle burst ──────────────────────
                addScreenShake(20);

                // Fire burst — large bright orange spray
                spawnParticles(barrelCX, barrelCY, 35, '#f97316');
                // Smoke cloud — grey particles that linger
                spawnParticles(barrelCX, barrelCY, 20, '#71717a');
                // Inner white-hot flash
                spawnParticles(barrelCX, barrelCY, 10, '#fef3c7');

                // ── BOOM floating text ──────────────────────────────────
                spawnFloatingText('💥 BOOM!', barrelCX, barrelCY - 55, '#f97316', 38);

                // ── AoE Damage — 180 px radius, 150 damage ─────────────
                const EXPLOSION_RADIUS = 180;
                const EXPLOSION_DAMAGE = 150;

                // Player
                if (window.player && !window.player.dead) {
                    const pd = Math.hypot(window.player.x - barrelCX, window.player.y - barrelCY);
                    if (pd < EXPLOSION_RADIUS) {
                        // Scale damage by proximity: full at 0, half at edge
                        const falloff = 1 - (pd / EXPLOSION_RADIUS) * 0.5;
                        window.player.takeDamage(EXPLOSION_DAMAGE * falloff);
                        spawnFloatingText(
                            `🔥 ${Math.round(EXPLOSION_DAMAGE * falloff)}`,
                            window.player.x, window.player.y - 60, '#ef4444', 22
                        );
                    }
                }

                // Enemies
                for (let ei = window.enemies.length - 1; ei >= 0; ei--) {
                    const enemy = window.enemies[ei];
                    if (!enemy || enemy.dead) continue;
                    const ed = Math.hypot(enemy.x - barrelCX, enemy.y - barrelCY);
                    if (ed < EXPLOSION_RADIUS) {
                        const falloff = 1 - (ed / EXPLOSION_RADIUS) * 0.5;
                        const wasAlive = !enemy.dead;
                        enemy.takeDamage(EXPLOSION_DAMAGE * falloff);
                        // ✨ [barrel_bomber] นับเฉพาะตัวที่ตายจากระเบิดนี้
                        if (wasAlive && enemy.dead && typeof Achievements !== 'undefined') {
                            Achievements.stats.barrelKills++;
                            Achievements.check('barrel_bomber');
                        }
                    }
                }

                // Boss
                if (window.boss && !window.boss.dead) {
                    const bd = Math.hypot(window.boss.x - barrelCX, window.boss.y - barrelCY);
                    if (bd < EXPLOSION_RADIUS) {
                        const falloff = 1 - (bd / EXPLOSION_RADIUS) * 0.5;
                        window.boss.takeDamage(EXPLOSION_DAMAGE * falloff);
                        spawnFloatingText('BARREL HIT!', window.boss.x, window.boss.y - 80, '#f97316', 26);
                    }
                }

                // ── Remove barrel from objects (do not push to surviving) ──
                window.mapSystem._sortedObjects = null;
                // intentional: no survivingObjects.push(obj)

            } else if (!obj.isExploded) {
                // Barrel still alive — keep it
                survivingObjects.push(obj);
            }
            // isExploded but hp > 0 can't happen; if isExploded already,
            // skip (it was cleaned up in a previous frame's pass).
        }

        // Replace the objects array with the survivors
        if (survivingObjects.length !== window.mapSystem.objects.length) {
            window.mapSystem.objects = survivingObjects;
            window.mapSystem._sortedObjects = null;
        }
    }
    // ── End Explosive Barrel Logic ─────────────────────────────────────

    for (let i = window.powerups.length - 1; i >= 0; i--) {
        if (window.powerups[i].update(dt, window.player)) window.powerups.splice(i, 1);
    }

    for (let i = window.meteorZones.length - 1; i >= 0; i--) {
        window.meteorZones[i].life -= dt;
        if (!_inTutorial && dist(window.meteorZones[i].x, window.meteorZones[i].y, window.player.x, window.player.y) < window.meteorZones[i].radius) {
            window.player.takeDamage(window.meteorZones[i].damage * dt);
        }
        if (window.meteorZones[i].life <= 0) window.meteorZones.splice(i, 1);
    }

    mapSystem.update([window.player, ...window.enemies, window.boss].filter(e => e && !e.dead), dt);
    particleSystem.update(dt);
    floatingTextSystem.update(dt);

    // Orbital effects for Auto & Kao
    if (typeof updateOrbitalEffects !== 'undefined') {
        updateOrbitalEffects(dt, [window.player]);
    }

    if (typeof hitMarkerSystem !== 'undefined') hitMarkerSystem.update(dt);

    if (typeof decalSystem !== 'undefined') decalSystem.update(dt);
    if (typeof shellCasingSystem !== 'undefined') shellCasingSystem.update(dt);

    weatherSystem.update(dt, getCamera());
    updateScreenShake();
    _achFrame++;
    if (_achFrame % 10 === 0) Achievements.checkAll();
    updateDatabaseServerUI();
    updateShopProximityUI();
}

function drawGame() {
    // BUG FIX: Validate canvas context before drawing
    if (!CTX || !CANVAS) {
        console.warn('[drawGame] Canvas context lost, skipping draw');
        return;
    }

    if (!drawGame._diagFrame) drawGame._diagFrame = 0;
    drawGame._diagFrame++;
    if (DEBUG_MODE && drawGame._diagFrame % 300 === 1) {
        console.log('[MTC drawGame] frame', drawGame._diagFrame, '| gameState:', gameState,
            '| player:', !!window.player, '| UIManager:', typeof UIManager,
            '| MTC_DB_SERVER on window:', !!window.MTC_DATABASE_SERVER,
            '| MTC_SHOP on window:', !!window.MTC_SHOP_LOCATION);
    }

    const _bgTop = GAME_CONFIG.visual.bgColorTop;
    const _bgBot = GAME_CONFIG.visual.bgColorBottom;
    if (!_bgGrad || _bgGradW !== CANVAS.width || _bgGradH !== CANVAS.height ||
        _bgGradTop !== _bgTop || _bgGradBot !== _bgBot) {
        _bgGrad = CTX.createLinearGradient(0, 0, 0, CANVAS.height);
        _bgGrad.addColorStop(0, _bgTop);
        _bgGrad.addColorStop(1, _bgBot);
        _bgGradW = CANVAS.width; _bgGradH = CANVAS.height;
        _bgGradTop = _bgTop; _bgGradBot = _bgBot;
    }
    CTX.fillStyle = _bgGrad;
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);

    CTX.save();
    const shake = getScreenShakeOffset();
    CTX.translate(shake.x, shake.y);

    // ✅ TERRAIN: draws arena boundary, hex grid, circuit paths & zone auras
    mapSystem.drawTerrain(CTX, getCamera());

    drawGrid();

    const _drawNow = performance.now();
    for (const z of window.meteorZones) {
        const screen = worldToScreen(z.x, z.y);
        const a = Math.sin(_drawNow / 200) * 0.3 + 0.7;
        CTX.fillStyle = `rgba(239, 68, 68, ${a * 0.4})`;
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2);
        CTX.fill();
    }

    mapSystem.draw();
    drawDatabaseServer();
    drawShopObject();

    // ── Battle Scars — floor decals & shell casings (below all entities) ──
    if (typeof decalSystem !== 'undefined') decalSystem.draw();
    if (typeof shellCasingSystem !== 'undefined') shellCasingSystem.draw();

    // ── Low-HP Navigation Guide ───────────────────────────────
    // Draws a subtle, animated dashed floor-line toward the nearest
    // healing source (MTC Room or Shop) when the player is below 35% HP.
    // Rendered between world objects and entities so it reads as a
    // floor-level cue without cluttering the combat layer.
    if (window.player && !window.player.dead &&
        window.player.maxHp > 0 &&
        window.player.hp / window.player.maxHp <= 0.35) {

        // ── Determine nearest healing target ─────────────────
        let targetX, targetY, guideColor;

        const shopDist = dist(window.player.x, window.player.y,
            MTC_SHOP_LOCATION.x, MTC_SHOP_LOCATION.y);

        // MTC Room center (null-safe: mapSystem.mtcRoom may be undefined
        // during early initialisation before the map has been built)
        const room = window.mapSystem && window.mapSystem.mtcRoom;
        const roomCX = room ? room.x + room.w / 2 : Infinity;
        const roomCY = room ? room.y + room.h / 2 : Infinity;
        const roomDist = room
            ? dist(window.player.x, window.player.y, roomCX, roomCY)
            : Infinity;

        if (roomDist <= shopDist) {
            // MTC Room is closer — use green
            targetX = roomCX;
            targetY = roomCY;
            guideColor = '#10b981';
        } else {
            // Shop is closer — use gold
            targetX = MTC_SHOP_LOCATION.x;
            targetY = MTC_SHOP_LOCATION.y;
            guideColor = '#f59e0b';
        }

        // ── Draw animated dashed line on the floor ────────────
        const pScreen = worldToScreen(window.player.x, window.player.y);
        const tScreen = worldToScreen(targetX, targetY);

        CTX.save();
        CTX.globalAlpha = 0.35;
        CTX.strokeStyle = guideColor;
        CTX.lineWidth = 4;
        CTX.lineCap = 'round';
        // Dash pattern: 15 px on, 20 px off — offset animated to "march"
        // toward the target so the line reads as directional.
        CTX.setLineDash([15, 20]);
        CTX.lineDashOffset = -(performance.now() / 20) % 35;
        CTX.beginPath();
        CTX.moveTo(pScreen.x, pScreen.y);
        CTX.lineTo(tScreen.x, tScreen.y);
        CTX.stroke();
        CTX.restore();   // clears setLineDash, globalAlpha, and all stroke state
    }
    // ── End Low-HP Navigation Guide ───────────────────────────

    for (const p of window.powerups) {
        if (p.isOnScreen ? p.isOnScreen(60) : true) EnemyRenderer.draw(p, CTX);
    }

    window.specialEffects.forEach(e => e.draw());

    if (window.drone) window.drone.draw();

    if (window.player) PlayerRenderer.draw(window.player, CTX);

    for (const e of window.enemies) {
        if (e.isOnScreen(80)) {
            // BossDog มี draw ใน BossRenderer ไม่ใช่ EnemyRenderer
            if (typeof BossDog !== 'undefined' && e instanceof BossDog) {
                BossRenderer.draw(e, CTX);
            } else {
                EnemyRenderer.draw(e, CTX);
            }
        }
    }

    if (window.boss && !window.boss.dead && window.boss.isOnScreen(200)) BossRenderer.draw(window.boss, CTX);

    ProjectileRenderer.drawAll(projectileManager.getAll(), CTX);
    particleSystem.draw();
    floatingTextSystem.draw();

    // Orbital effects for Auto & Kao
    if (typeof drawOrbitalEffects !== 'undefined') {
        drawOrbitalEffects();
    }

    if (typeof hitMarkerSystem !== 'undefined') hitMarkerSystem.draw();

    weatherSystem.draw();

    CTX.restore();

    {
        const allProj = (typeof projectileManager !== 'undefined' && projectileManager.projectiles)
            ? projectileManager.projectiles : [];
        CTX.save();
        mapSystem.drawLighting(window.player, allProj, [
            { x: MTC_DATABASE_SERVER.x, y: MTC_DATABASE_SERVER.y, radius: BALANCE.LIGHTING.mtcServerLightRadius, type: 'cool' },
            { x: MTC_SHOP_LOCATION.x, y: MTC_SHOP_LOCATION.y, radius: BALANCE.LIGHTING.shopLightRadius, type: 'warm' }
        ]);
        CTX.restore();
    }

    drawDayNightHUD();
    // WARN-3 FIX: guard in case TimeManager.js loads after drawGame fires
    if (typeof drawSlowMoOverlay === 'function') drawSlowMoOverlay();

    if (GameState.glitchIntensity > 0) {
        drawGlitchEffect(GameState.glitchIntensity, GameState.controlsInverted);
    }

    // ── Wave Event overlays (Fog / Speed vignettes + banner) ──
    if (typeof drawWaveEvent === 'function') drawWaveEvent(CTX);

    if (typeof CanvasHUD !== 'undefined' && CanvasHUD.draw) {
        CanvasHUD.draw(CTX, _lastDrawDt);
    } else if (typeof UIManager !== 'undefined' && UIManager.draw) {
        UIManager.draw(CTX, _lastDrawDt); // compat fallback
    }
}

// ══════════════════════════════════════════════════════════════
// 🌞 DAY / NIGHT HUD
// ══════════════════════════════════════════════════════════════

function drawDayNightHUD() {
    const L = BALANCE.LIGHTING;
    const phase = (L.ambientLight - L.nightMinLight) / (L.dayMaxLight - L.nightMinLight);
    const isDawn = phase > 0.5;
    const cx = 52, cy = 52, r = 24;

    CTX.save();
    CTX.fillStyle = isDawn ? 'rgba(255, 210, 80, 0.18)' : 'rgba(80, 110, 255, 0.18)';
    CTX.strokeStyle = isDawn ? 'rgba(255, 210, 80, 0.55)' : 'rgba(130, 160, 255, 0.55)';
    CTX.lineWidth = 2;
    CTX.beginPath();
    CTX.arc(cx, cy, r + 8, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();

    CTX.strokeStyle = isDawn ? '#fbbf24' : '#818cf8';
    CTX.lineWidth = 3.5;
    CTX.lineCap = 'round';
    CTX.shadowBlur = 8;
    CTX.shadowColor = isDawn ? '#fbbf24' : '#818cf8';
    CTX.beginPath();
    CTX.arc(cx, cy, r + 4, -Math.PI / 2, -Math.PI / 2 + phase * Math.PI * 2);
    CTX.stroke();
    CTX.shadowBlur = 0;

    CTX.font = `${r}px Arial`;
    CTX.textAlign = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText(isDawn ? '☀️' : '🌙', cx, cy);

    CTX.fillStyle = isDawn ? '#fde68a' : '#c7d2fe';
    CTX.font = 'bold 8px Arial';
    CTX.textAlign = 'center';
    CTX.textBaseline = 'middle';
    const pct = Math.round(phase * 100);
    CTX.fillText(isDawn ? GAME_TEXTS.ui.dayPhase(pct) : GAME_TEXTS.ui.nightPhase(100 - pct), cx, cy + r + 14);
    CTX.restore();
}

// ══════════════════════════════════════════════════════════════
// 🔲 GRID
// ══════════════════════════════════════════════════════════════

let _gridPath = null, _gridOx = -999, _gridOy = -999, _gridW = 0, _gridH = 0;

function drawGrid() {
    const sz = GAME_CONFIG.physics.gridSize;
    const cam = getCamera();
    const ox = Math.round((-cam.x % sz + sz) % sz);
    const oy = Math.round((-cam.y % sz + sz) % sz);

    if (!_gridPath || ox !== _gridOx || oy !== _gridOy ||
        CANVAS.width !== _gridW || CANVAS.height !== _gridH) {
        _gridPath = new Path2D();
        for (let x = ox; x < CANVAS.width; x += sz) { _gridPath.moveTo(x, 0); _gridPath.lineTo(x, CANVAS.height); }
        for (let y = oy; y < CANVAS.height; y += sz) { _gridPath.moveTo(0, y); _gridPath.lineTo(CANVAS.width, y); }
        _gridOx = ox; _gridOy = oy; _gridW = CANVAS.width; _gridH = CANVAS.height;
    }

    CTX.strokeStyle = GAME_CONFIG.visual.gridColor;
    CTX.lineWidth = 1;
    CTX.stroke(_gridPath);
}

// ══════════════════════════════════════════════════════════════
// 🍚 POOM ATTACK SYSTEM
// ══════════════════════════════════════════════════════════════

function shootPoom(player) {
    const S = BALANCE.characters.poom;
    if (player.cooldowns.shoot > 0) return;
    const attackSpeedMult = player.isEatingRice ? 0.7 : 1.0;
    player.cooldowns.shoot = S.riceCooldown * attackSpeedMult;
    const { damage, isCrit } = player.dealDamage(S.riceDamage * player.damageBoost);

    // ── Session C/D: Create projectile and set onHit callback ──
    const proj = new Projectile(player.x, player.y, player.angle, S.riceSpeed, damage, S.riceColor, false, 'player');
    proj.onHit = function (enemy) {
        player.applyStickyTo(enemy); // ── Apply sticky via StatusEffect framework ──
    };
    projectileManager.add(proj);

    if (isCrit) {
        spawnFloatingText(GAME_TEXTS.combat.poomCrit, player.x, player.y - 45, '#fbbf24', 20);
        spawnParticles(player.x, player.y, 5, '#ffffff');
    }
    player.speedBoostTimer = S.speedOnHitDuration;
    if (typeof Audio !== 'undefined' && Audio.playPoomShoot) Audio.playPoomShoot();
}

// ══════════════════════════════════════════════════════════════
// 🚀 INIT & START
// ══════════════════════════════════════════════════════════════

async function initAI() {
    const brief = document.getElementById('mission-brief');
    if (!brief) { console.warn('⚠️ mission-brief not found'); return; }
    brief.textContent = GAME_TEXTS.ai.loading;
    try {
        // BUG FIX: Add timeout to prevent hanging on AI calls
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI timeout')), 3000));
        const name = await Promise.race([Gemini.getMissionName(), timeout]);
        brief.textContent = GAME_TEXTS.ai.missionPrefix(name);
    } catch (e) {
        console.warn('Failed to get mission name:', e);
        brief.textContent = GAME_TEXTS.ai.missionFallback;
    }
}

function startGame(charType = 'kao') {
    console.log('🎮 Starting game... charType:', charType);
    Audio.playBGM('battle');

    const savedData = getSaveData();
    console.log('[MTC Save] Loaded save data:', savedData);
    UIManager.updateHighScoreDisplay(savedData.highScore);

    if (charType === 'auto' && typeof AutoPlayer === 'function') {
        window.player = new AutoPlayer();
    } else if (charType === 'kao' && typeof KaoPlayer === 'function') {
        window.player = new KaoPlayer();
    } else {
        window.player = charType === 'poom' ? new PoomPlayer() : new Player(charType);
    }

    // ── Admin Dev Mode: Force Kao Passive ─────────────────────────────────
    // ทำงานเฉพาะเมื่อ window.isAdmin === true และ Toggle เปิดอยู่เท่านั้น
    const devToggle = document.getElementById('dev-kao-passive-toggle');
    if (window.isAdmin && charType === 'kao' && devToggle && devToggle.checked) {
        const S = window.player.stats;
        window.player.passiveUnlocked = true;
        const hpBonus = Math.floor(window.player.maxHp * (S.passiveHpBonusPct || 0));
        window.player.maxHp += hpBonus;
        window.player.hp += hpBonus;
        window.player.goldenAuraTimer = 9999; // visual marker ถาวรสำหรับ Dev Mode
        console.log('%c[MTC Admin] 🔧 DEV MODE: ซุ่มเสรี unlocked from game start.', 'color:#ef4444; font-weight:bold;');
    }

    window.enemies = []; window.powerups = []; window.specialEffects = []; window.meteorZones = [];
    window.boss = null;

    dayNightTimer = 0;
    BALANCE.LIGHTING.ambientLight = BALANCE.LIGHTING.dayMaxLight;

    // ── Reset all mutable run state via GameState ─────────────
    GameState.resetRun();
    console.log('🐕 Boss encounter counter reset — encounter 1 will be plain boss');
    console.log('🕐 Bullet Time reset — timeScale 1.0, energy full');
    console.log('⚡ Glitch Wave grace period reset');

    window.player.shopDamageBoostActive = false;
    window.player.shopDamageBoostTimer = 0;
    window.player._baseDamageBoost = undefined;
    window.player.shopSpeedBoostActive = false;
    window.player.shopSpeedBoostTimer = 0;
    window.player._baseMoveSpeed = undefined;

    window.drone = new Drone();
    window.drone.x = window.player.x;
    window.drone.y = window.player.y;
    spawnFloatingText(GAME_TEXTS.combat.droneOnline, window.player.x, window.player.y - 90, '#00e5ff', 20);
    console.log('🤖 Engineering Drone initialised');

    weatherSystem.clear();
    UIManager.updateBossHUD(null);
    resetScore();
    setWave(1);
    projectileManager.clear();
    particleSystem.clear();
    floatingTextSystem.clear();
    if (typeof decalSystem !== 'undefined') decalSystem.clear();
    if (typeof shellCasingSystem !== 'undefined') shellCasingSystem.clear();
    mapSystem.init();

    weaponSystem.setActiveChar(charType);
    try {
        weaponSystem.updateWeaponUI();
    } catch (err) {
        console.error('[startGame] updateWeaponUI threw — continuing anyway:', err);
    }
    UIManager.initSkillNames();
    UIManager.setupCharacterHUD(window.player);

    Achievements.stats.damageTaken = 0;
    Achievements.stats.kills = 0;
    Achievements.stats.shopPurchases = 0;
    GameState.waveStartDamage = 0;

    hideElement('overlay');
    hideElement('report-card');
    UIManager.resetGameOverUI();

    showResumePrompt(false);
    ShopManager.close();

    if (AdminConsole.isOpen) AdminConsole.close();
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) consoleOutput.innerHTML = '';

    // WARN-2 FIX: guard against WaveManager not yet loaded
    if (typeof startNextWave === 'function') startNextWave();
    setGameState('PLAYING');
    resetTime();

    if (typeof TutorialSystem !== 'undefined' && !TutorialSystem.isDone()) {
        TutorialSystem.start(charType);
    }

    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        mobileUI.style.display = isTouchDevice ? 'block' : 'none';
    }
    window.focus();

    console.log('✅ Game started!');
    // BUG FIX: Prevent race condition with RAF ID tracking
    if (!GameState.loopRunning && rafId === null) {
        GameState.loopRunning = true;
        rafId = requestAnimationFrame(gameLoop);
    }
}

async function endGame(result) {
    if (GameState.phase === 'GAMEOVER') return;
    setGameState('GAMEOVER');

    // BUG FIX: Cancel RAF and cleanup mobile controls
    if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    GameState.loopRunning = false;

    if (typeof cleanupMobileControls === 'function') {
        cleanupMobileControls();
    }

    Audio.stopBGM();
    Audio.playBGM('menu');

    GameState.hitStopTimer = 0;

    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) mobileUI.style.display = 'none';

    showResumePrompt(false);
    ShopManager.close();
    if (AdminConsole.isOpen) AdminConsole.close();

    window.drone = null;

    // ── Reset mutable state (mirrors startGame — prevents stale values on restart) ──
    GameState.resetRun();
    // wave event cleared by WaveManager._deactivateWaveEvent() on next startNextWave()

    weatherSystem.clear();

    {
        const runScore = getScore();
        const existing = getSaveData();
        if (runScore > existing.highScore) {
            updateSaveData({ highScore: runScore });
            console.log(`[MTC Save] 🏆 New high score: ${runScore}`);
            UIManager.updateHighScoreDisplay(runScore);
        } else {
            UIManager.updateHighScoreDisplay(existing.highScore);
        }
    }

    if (result === 'victory') {
        showElement('victory-screen');
        setElementText('final-score', `SCORE ${getScore()}`);
        setElementText('final-wave', `WAVES CLEARED ${getWave() - 1}`);
        setElementText('final-kills', `${(Achievements.stats.kills || 0).toLocaleString()}`);
    } else {
        const finalScore = getScore();
        const finalWave = getWave();
        const finalKills = Achievements.stats.kills || 0;

        showElement('overlay');
        UIManager.showGameOver(finalScore, finalWave, finalKills);

        const ld = document.getElementById('ai-loading');
        if (ld) ld.style.display = 'block';
        const reportText = document.getElementById('report-text');

        try {
            const comment = await Gemini.getReportCard(finalScore, finalWave);
            if (ld) ld.style.display = 'none';
            if (reportText) reportText.textContent = comment;
        } catch (e) {
            console.warn('Failed to get AI report card:', e);
            if (ld) ld.style.display = 'none';
            if (reportText) reportText.textContent = GAME_TEXTS.ai.reportFallback;
        }
    }
}

// ══════════════════════════════════════════════════════════════
// GLOBAL EXPORTS
// ══════════════════════════════════════════════════════════════

window.startGame = startGame;
window.endGame = endGame;

window.onload = () => {
    console.log('🚀 Initializing game...');

    // BUG FIX: Ensure DOM is fully ready before initialization
    const initializeGame = () => {
        if (!document.getElementById('gameCanvas')) {
            console.warn('Canvas element not found, retrying...');
            setTimeout(initializeGame, 100);
            return;
        }

        try {
            initCanvas();
            setGameState('MENU');
            if (typeof InputSystem !== 'undefined') InputSystem.init();
            initAI();

            // ── BGM FIX: Audio.init() moved here from startGame() ────────────────
            if (typeof Audio !== 'undefined') {
                Audio.init();
                Audio.playBGM('menu');
            }
        } catch (err) {
            console.error('[window.onload] Initialization error:', err);
        }
    };

    if (document.readyState === 'complete') {
        initializeGame();
    } else {
        document.addEventListener('DOMContentLoaded', initializeGame);
    }
};