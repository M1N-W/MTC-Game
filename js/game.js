'use strict';

const DEBUG_MODE = false;

/**
 * js/game.js
 * ════════════════════════════════════════════════════════════════════════════
 * Master game loop, state machine, and orchestration hub for MTC The Game.
 * Owns the rAF loop, update/draw dispatch, entity tick order, and game
 * lifecycle (startGame → gameLoop → endGame).
 *
 * Exports (window.*):
 *   window.startGame(charType)   — called by menu.js on character select
 *   window.endGame(result)       — called internally + AdminSystem
 *   window.triggerHitStop(dur)   — called by AutoPlayer, PatPlayer crits
 *   window.setGameState(s)       — thin wrapper → GameState.setPhase()
 *
 * Key globals consumed (must be loaded before game.js):
 *   GameState, WaveManager, ShopManager, UIManager, Audio
 *   weaponSystem, projectileManager, playerAnalyzer, squadAI
 *   WorkerBridge (loaded after game.js — safe via typeof guard)
 *   MAP_CONFIG, BALANCE, GAME_TEXTS, MTC_SHOP_LOCATION, MTC_DATABASE_SERVER
 *
 * Load order (this file loads AFTER all entities and systems):
 *   base.js → PlayerBase → [KaoPlayer|AutoPlayer|PoomPlayer|PatPlayer]
 *   enemy.js → ManopBoss.js → FirstBoss.js
 *   GameState.js → WaveManager.js → ShopSystem.js → game.js
 *   WorkerBridge.js   ← loads AFTER game.js (index.html script order)
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────────────
 *  L.69   Module-level vars     rafId, _bgGrad, dayNightTimer, window.player
 *  L.73   setGameState(s)       Thin alias → GameState.setPhase(); window export
 *  L.105  _tut                  Tutorial input bridge state object
 *  L.110  _tutorialForwardInput() Forward WASD/mouse/dash to TutorialSystem
 *  L.129  gameLoop(now)         rAF callback — hitStop gate, dt clamp, update+draw
 *  L.190  triggerHitStop(dur)   Freeze-frame effect; no-downgrade; 0.5s cap
 *  L.205  updateGame(dt)        Top-level update: death check, camera, tick fns
 *  L.240  _tickWaveEvents(dt)   DomainExpansion, Singularity, wave countdown FX
 *  L.278  _tickShopBuffs(dt)    Decay damageBoost + speedBoost from shop purchases
 *  L.304  _checkProximityInteractions()  Shop/server proximity, E/F/B key actions
 *  L.321  _tickEntities(dt)     Player → weapon → boss → enemies → AI → squad tick
 *  L.418  _tickBarrelExplosions()  Projectile-barrel hit detection + AoE chain
 *  L.503  _tickEnvironment(dt)  Projectiles, powerups, meteors, decals, particles
 *  L.558  drawGame()            Full render pipeline: bg → map → entities → HUD
 *  L.749  drawDayNightHUD()     Day/night overlay gradient + cycle indicator
 *  L.794  drawGrid()            Debug grid overlay (DEBUG_MODE only)
 *  L.817  initAI()             Instantiate playerAnalyzer + squadAI singletons
 *  L.826  _fadeOutOverlay()     CSS opacity fade for loading/transition overlays
 *  L.843  startGame(charType)   Full game init: player factory, reset, UI wire-up
 *  L.867  _createPlayer(t)      Character factory → KaoPlayer|AutoPlayer|Poom|Pat
 *  L.886  _resetRunState(p)     Zero all mutable run state (enemies, boss, pickups…)
 *  L.923  _initGameUI(t)        HUD setup, overlays, tutorial, mobile, WaveManager
 *  L.968  endGame(result)       Teardown: cancel rAF, BGM swap, GameState reset
 *  L.1068 window.onload         Boot sequence: canvas, audio, input, menu init
 *
 * ⚠️  triggerHitStop does NOT modify main dt — it sets GameState.hitStopTimer
 *     only. The gameLoop skips update/draw while timer > 0.
 * ⚠️  WorkerBridge is loaded AFTER game.js. All references must use
 *     typeof WorkerBridge !== 'undefined' guards.
 * ⚠️  window.player is assigned in startGame() and stays null between runs.
 *     Every function that runs outside PLAYING phase must null-check it.
 * ⚠️  KaoPlayer calls player.shoot(dt) directly (bypasses weaponSystem).
 *     The instanceof KaoPlayer branch in _tickEntities gates this correctly.
 * ════════════════════════════════════════════════════════════════════════════
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

/**
 * triggerHitStop — freeze game loop briefly for impact.
 * Backward-compatible: accepts either seconds (< 1) or milliseconds (>= 1).
 * No-op if hitStop is already longer than requested (prevents downgrade).
 * Hard-capped to 0.5s to prevent accidental long freezes.
 * @param {number} [duration=0.05] seconds (recommended) OR ms if >= 1
 */
function triggerHitStop(duration = 0.05) {
    if (typeof GameState === 'undefined') return;
    if (!Number.isFinite(duration) || duration <= 0) return;

    // Heuristic: legacy call-sites pass milliseconds (20/40/60),
    // newer ones pass seconds (0.04/0.07/0.09).
    const seconds = duration >= 1 ? (duration / 1000) : duration;
    const capped = Math.min(0.5, seconds);

    if ((GameState.hitStopTimer ?? 0) < capped) {
        GameState.hitStopTimer = capped;
    }
}
window.triggerHitStop = triggerHitStop;

// ── PERF: reusable entity buffer for mapSystem.update ────────────────────
// Avoids [...spread] + .filter() allocating 2 new arrays every frame.
const _mapUpdateEntities = [];

function updateGame(dt) {
    if (!window.player) return;

    // Player death — spawn decal once then hand off to endGame
    if (window.player.dead) {
        if (typeof decalSystem !== 'undefined' && !window.player._deathDecalSpawned) {
            window.player._deathDecalSpawned = true;
            decalSystem.spawn(window.player.x, window.player.y, '#7f1d1d', 35 + Math.floor(Math.random() * 11), 30);
        }
        window.endGame('defeat');
        return;
    }

    updateCamera(window.player.x, window.player.y);
    updateMouseWorld();

    // Glitch intensity ramp
    const GLITCH_RAMP = 0.8;
    if (GameState.isGlitchWave) {
        GameState.glitchIntensity = Math.min(1.0, GameState.glitchIntensity + GLITCH_RAMP * dt);
    } else {
        GameState.glitchIntensity = Math.max(0.0, GameState.glitchIntensity - GLITCH_RAMP * 2 * dt);
    }

    const _inTutorial = typeof TutorialSystem !== 'undefined' && TutorialSystem.isActive();

    _tickWaveEvents(dt);
    _tickShopBuffs(dt);
    _checkProximityInteractions(_inTutorial);
    _tickEntities(dt, _inTutorial);
    _tickBarrelExplosions();
    _tickEnvironment(dt, _inTutorial);
}

// ── Wave & domain events each frame ──────────────────────────────────────────
function _tickWaveEvents(dt) {
    if (typeof updateWaveEvent === 'function') updateWaveEvent(dt);
    if (typeof DomainExpansion !== 'undefined')
        DomainExpansion.update(dt, window.boss, window.player);
    // Must run even when boss is dead — allows _abort() to reset phase
    if (typeof GravitationalSingularity !== 'undefined')
        GravitationalSingularity.update(dt, window.boss, window.player);

    // Glitch-wave countdown lock
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

    // Day / Night cycle
    dayNightTimer += dt;
    {
        const L = BALANCE.LIGHTING;
        const phi = (dayNightTimer / L.cycleDuration) * Math.PI * 2;
        const dayPhase = Math.sin(phi) * 0.5 + 0.5;
        L.ambientLight = L.nightMinLight + dayPhase * (L.dayMaxLight - L.nightMinLight);
    }
}

// ── Shop temporary buff timers (damage boost + speed boost) ──────────────────
function _tickShopBuffs(dt) {
    const p = window.player;
    if (!p) return;
    if (p.shopDamageBoostActive) {
        p.shopDamageBoostTimer -= dt;
        if (p.shopDamageBoostTimer <= 0) {
            p.shopDamageBoostActive = false;
            p.damageBoost = p._baseDamageBoost !== undefined ? p._baseDamageBoost : 1.0;
            spawnFloatingText(GAME_TEXTS.shop.dmgBoostExpired, p.x, p.y - 50, '#94a3b8', 14);
        }
    }
    if (p.shopSpeedBoostActive) {
        p.shopSpeedBoostTimer -= dt;
        if (p.shopSpeedBoostTimer <= 0) {
            p.shopSpeedBoostActive = false;
            // BUG 2 FIX: restore stats.moveSpeed (same path ShopSystem.js wrote to)
            if (p._baseMoveSpeed !== undefined) {
                if (p.stats) p.stats.moveSpeed = p._baseMoveSpeed;
                else p.moveSpeed = p._baseMoveSpeed;
            }
            spawnFloatingText(GAME_TEXTS.shop.spdBoostExpired, p.x, p.y - 50, '#94a3b8', 14);
        }
    }
}

// ── Proximity interactions: shop tick + E/F/B key interactions ────────────────
function _checkProximityInteractions(_inTutorial) {
    if (typeof ShopManager !== 'undefined' && typeof ShopManager.tick === 'function') ShopManager.tick();

    const dToServer = dist(window.player.x, window.player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
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
}

// ── Player, weapon, boss, enemies, AI tick ────────────────────────────────────
function _tickEntities(dt, _inTutorial) {
    const effectiveKeys = GameState.controlsInverted
        ? { ...keys, w: keys.s, s: keys.w, a: keys.d, d: keys.a }
        : keys;
    window.player.update(dt, effectiveKeys, mouse);

    if (!(window.player instanceof PoomPlayer) && !(typeof AutoPlayer === 'function' && window.player instanceof AutoPlayer)) {
        weaponSystem.update(dt);
        // 🛡️ KAO FIX: Do NOT run WeaponSystem's burst loop for KaoPlayer.
        //    WeaponSystem.updateBurst() calls shootSingle() which bypasses KaoPlayer's
        //    own fire-rate gating, causing OP machine-gun effect.
        const isKao = typeof KaoPlayer !== 'undefined' && window.player instanceof KaoPlayer;
        const _isPat = typeof PatPlayer !== 'undefined' && window.player instanceof PatPlayer;
        if (!isKao && !_isPat) {
            const burstProjectiles = weaponSystem.updateBurst(window.player, window.player.damageBoost);
            if (burstProjectiles && burstProjectiles.length > 0) projectileManager.add(burstProjectiles);
        }
        // Route shooting: Kao uses its own shoot(); Auto, Poom, Pat handle internally
        const isPoom = typeof PoomPlayer !== 'undefined' && window.player instanceof PoomPlayer;
        const isPat = typeof PatPlayer !== 'undefined' && window.player instanceof PatPlayer;
        if (isKao) {
            if (mouse.left === 1 && GameState.phase === 'PLAYING') window.player.shoot(dt);
        } else if (!isPoom && !isPat && mouse.left === 1 && GameState.phase === 'PLAYING') {
            if (weaponSystem.canShoot()) {
                const projectiles = weaponSystem.shoot(window.player, window.player.damageBoost);
                if (projectiles && projectiles.length > 0) {
                    projectileManager.add(projectiles);
                    if (typeof window.player.triggerRecoil === 'function') window.player.triggerRecoil();
                }
            }
        }
    }
    // 🌾 NOTE: PoomPlayer input routing is handled inside PoomPlayer.update()

    if (window.player) UIManager.updateSkillIcons(window.player);
    if (window.drone && window.player && !window.player.dead) window.drone.update(dt, window.player);
    if (!_inTutorial && window.boss) window.boss.update(dt, window.player);

    // PlayerPatternAnalyzer: routed through WorkerBridge (off-thread when available)
    // Falls back to main-thread playerAnalyzer if Worker unavailable.
    if (typeof WorkerBridge !== 'undefined') {
        WorkerBridge.sendSample(dt, window.player, window.boss);
    } else if (typeof window.playerAnalyzer !== 'undefined' && window.boss && !window.boss.dead) {
        window.playerAnalyzer.sample(dt, window.player, window.boss);
        window.playerAnalyzer.update(dt);
    }

    // Boss safe-zone exclusion — prevent boss being lured into MTC Room for free kills
    if (window.boss && !window.boss.dead) {
        const _safeRoom = window.mapSystem && window.mapSystem.mtcRoom;
        if (_safeRoom) {
            const _bx = window.boss.x, _by = window.boss.y;
            const _pad = 28;
            const _inRoom = _bx > _safeRoom.x - _pad && _bx < _safeRoom.x + _safeRoom.w + _pad &&
                _by > _safeRoom.y - _pad && _by < _safeRoom.y + _safeRoom.h + _pad;
            if (_inRoom) {
                const _rcx = _safeRoom.x + _safeRoom.w * 0.5;
                const _rcy = _safeRoom.y + _safeRoom.h * 0.5;
                const _ang = Math.atan2(_by - _rcy, _bx - _rcx);
                window.boss.x += Math.cos(_ang) * 380 * dt;
                window.boss.y += Math.sin(_ang) * 380 * dt;
                if (!window.boss._inSafeZone) {
                    window.boss._inSafeZone = true;
                    spawnFloatingText('SAFE ZONE', window.boss.x, window.boss.y - 60, '#22d3ee', 22);
                }
            } else {
                window.boss._inSafeZone = false;
            }
        }
    }

    if (!_inTutorial) {
        for (let i = window.enemies.length - 1; i >= 0; i--) {
            window.enemies[i].update(dt, window.player);
            if (window.enemies[i].dead) {
                window.enemies[i] = window.enemies[window.enemies.length - 1];
                window.enemies.pop();
            }
        }
        if (typeof window.squadAI !== 'undefined') window.squadAI.update(dt, window.enemies, window.player);
    }

    // Wave clear check — trigger next wave when all enemies dead and no boss/trickle pending
    if (!_inTutorial &&
        (window.WAVE_SCHEDULE?.bossWaves ? !window.WAVE_SCHEDULE.bossWaves.includes(getWave()) : true) &&
        window.enemies.length === 0 && !window.boss && !GameState.waveSpawnLocked && !window.isTrickleActive) {
        if (Achievements.stats.damageTaken === GameState.waveStartDamage && getEnemiesKilled() >= BALANCE.waves.minKillsForNoDamage) {
            Achievements.check('no_damage');
        }
        GameState.waveStartDamage = Achievements.stats.damageTaken;
        setWave(getWave() + 1);
        Achievements.check('wave_1');
        if (typeof startNextWave === 'function') startNextWave();
    }
}

// ── Explosive barrel: projectile hit detection + AoE explosion ────────────────
function _tickBarrelExplosions() {
    if (typeof projectileManager === 'undefined' || !projectileManager ||
        !projectileManager.projectiles || !Array.isArray(projectileManager.projectiles) ||
        !window.mapSystem || !Array.isArray(window.mapSystem.objects)) return;

    const allProj = projectileManager.projectiles;

    // Pass A: projectile → barrel hit detection
    for (let pi = allProj.length - 1; pi >= 0; pi--) {
        const proj = allProj[pi];
        if (!proj || proj.dead) continue;
        for (let bi = window.mapSystem.objects.length - 1; bi >= 0; bi--) {
            const obj = window.mapSystem.objects[bi];
            if (!(obj instanceof ExplosiveBarrel) || obj.isExploded) continue;
            const closestX = Math.max(obj.x, Math.min(proj.x, obj.x + obj.w));
            const closestY = Math.max(obj.y, Math.min(proj.y, obj.y + obj.h));
            if (Math.hypot(proj.x - closestX, proj.y - closestY) < (proj.radius || 6)) {
                obj.hp -= proj.damage || 10;
                spawnParticles(proj.x, proj.y, 5, '#f59e0b');
                proj.dead = true;
                window.mapSystem._sortedObjects = null;
                break;
            }
        }
    }

    // Pass B: barrel death → AoE explosion
    const survivingObjects = [];
    for (const obj of window.mapSystem.objects) {
        if (!(obj instanceof ExplosiveBarrel)) { survivingObjects.push(obj); continue; }
        if (obj.hp <= 0 && !obj.isExploded) {
            obj.isExploded = true;
            const bCX = obj.x + obj.w / 2;
            const bCY = obj.y + obj.h / 2;
            addScreenShake(20);
            spawnParticles(bCX, bCY, 35, '#f97316');
            spawnParticles(bCX, bCY, 20, '#71717a');
            spawnParticles(bCX, bCY, 10, '#fef3c7');
            spawnFloatingText('💥 BOOM!', bCX, bCY - 55, '#f97316', 38);
            const EXPL_R = 180, EXPL_DMG = 150;
            // Player
            if (window.player && !window.player.dead) {
                const pd = Math.hypot(window.player.x - bCX, window.player.y - bCY);
                if (pd < EXPL_R) {
                    const f = 1 - (pd / EXPL_R) * 0.5;
                    window.player.takeDamage(EXPL_DMG * f);
                    spawnFloatingText(`🔥 ${Math.round(EXPL_DMG * f)}`, window.player.x, window.player.y - 60, '#ef4444', 22);
                }
            }
            // Enemies
            for (let ei = window.enemies.length - 1; ei >= 0; ei--) {
                const enemy = window.enemies[ei];
                if (!enemy || enemy.dead) continue;
                const ed = Math.hypot(enemy.x - bCX, enemy.y - bCY);
                if (ed < EXPL_R) {
                    const f = 1 - (ed / EXPL_R) * 0.5;
                    const wasAlive = !enemy.dead;
                    enemy.takeDamage(EXPL_DMG * f);
                    if (wasAlive && enemy.dead && typeof Achievements !== 'undefined') {
                        Achievements.stats.barrelKills++;
                        Achievements.check('barrel_bomber');
                    }
                }
            }
            // Boss
            if (window.boss && !window.boss.dead) {
                const bd = Math.hypot(window.boss.x - bCX, window.boss.y - bCY);
                if (bd < EXPL_R) {
                    const f = 1 - (bd / EXPL_R) * 0.5;
                    window.boss.takeDamage(EXPL_DMG * f);
                    spawnFloatingText('BARREL HIT!', window.boss.x, window.boss.y - 80, '#f97316', 26);
                }
            }
            window.mapSystem._sortedObjects = null;
        } else if (!obj.isExploded) {
            survivingObjects.push(obj);
        }
    }
    if (survivingObjects.length !== window.mapSystem.objects.length) {
        window.mapSystem.objects = survivingObjects;
        window.mapSystem._sortedObjects = null;
    }
}

// ── Projectiles, powerups, meteors, particles, VFX systems ───────────────────
function _tickEnvironment(dt, _inTutorial) {
    for (let i = window.specialEffects.length - 1; i >= 0; i--) {
        const remove = window.specialEffects[i].update(dt, window.player, window.meteorZones, window.boss);
        if (remove) {
            window.specialEffects[i] = window.specialEffects[window.specialEffects.length - 1];
            window.specialEffects.pop();
        }
    }

    // ── PAT: Blade Guard reflect hook ─────────────────────────────────────────
    // tryReflectProjectile() is implemented in PatPlayer.js.
    // Actual per-projectile reflect call lives in ProjectileManager.update()
    // (weapons.js) where enemy projectile → player collision is checked.
    // Hook point in weapons.js (search "takeDamage" inside ProjectileManager):
    //   if (typeof PatPlayer !== 'undefined' && window.player instanceof PatPlayer) {
    //       if (window.player.tryReflectProjectile(proj)) { continue; }
    //   }
    projectileManager.update(dt, window.player, window.enemies, window.boss);

    // ── PAT: DeadlyGraph reflect — check during 'blocking' phase ──────────────
    // Pat (Blade Guard active OR Perfect Parry armed) near graph midpoint →
    // flip angle, swap origin to current endpoint, reset to 'expanding'.
    // Only runs when window.boss is alive (graph only spawns during boss fight).
    if (window.boss && !window.boss.dead &&
        window.player instanceof PatPlayer &&
        (window.player.bladeGuardActive || window.player._perfectParryArmed)) {

        const patS = window.player.stats;
        const reflectRange = patS.graphReflectRange ?? 80;
        const reflectDmgMult = patS.graphReflectDamageMult ?? 2.0;

        for (let i = 0; i < window.specialEffects.length; i++) {
            const fx = window.specialEffects[i];
            if (!(fx instanceof DeadlyGraph)) continue;
            if (fx.phase !== 'blocking') continue;
            if (fx._reflected) continue; // already reflected once — no double-bounce

            // Midpoint of current beam
            const midX = fx.startX + Math.cos(fx.angle) * fx.length * 0.5;
            const midY = fx.startY + Math.sin(fx.angle) * fx.length * 0.5;
            const dToMid = Math.hypot(window.player.x - midX, window.player.y - midY);
            if (dToMid > reflectRange) continue;

            // ── Reflect: flip beam back toward boss ───────────────────────────
            const newStartX = fx.startX + Math.cos(fx.angle) * fx.length;
            const newStartY = fx.startY + Math.sin(fx.angle) * fx.length;
            fx.startX = newStartX;
            fx.startY = newStartY;
            fx.angle = Math.atan2(window.boss.y - newStartY, window.boss.x - newStartX);
            fx.length = 0;
            fx.phase = 'expanding';
            fx.timer = 0;
            fx.hasHit = false;
            fx._reflected = true;
            fx.damage *= reflectDmgMult;

            spawnFloatingText('⚔ GRAPH PARRIED!', window.player.x, window.player.y - 70, '#facc15', 28);
            spawnParticles(window.player.x, window.player.y, 18, '#7ec8e3');
            if (typeof Audio !== 'undefined' && Audio.playReflect) Audio.playReflect();
            addScreenShake(8);
            window.player._reflectFlashTimer = 0.5;

            // Consume Perfect Parry if it was armed
            if (window.player._perfectParryArmed) {
                window.player._perfectParryArmed = false;
                window.player._invincibleTimer = window.player.stats.perfectParryIFrameDur ?? 0.4;
                window.player.energy = Math.min(
                    window.player.maxEnergy ?? 100,
                    (window.player.energy ?? 0) + (patS.perfectParryEnergyRestore ?? 20)
                );
                spawnFloatingText('⚔ PERFECT!', window.player.x, window.player.y - 100, '#ff4500', 22);
            }
        }
    }

    for (let i = window.powerups.length - 1; i >= 0; i--) {
        if (window.powerups[i].update(dt, window.player)) {
            window.powerups[i] = window.powerups[window.powerups.length - 1];
            window.powerups.pop();
        }
    }

    for (let i = window.meteorZones.length - 1; i >= 0; i--) {
        window.meteorZones[i].life -= dt;
        if (!_inTutorial && dist(window.meteorZones[i].x, window.meteorZones[i].y, window.player.x, window.player.y) < window.meteorZones[i].radius) {
            window.player.takeDamage(window.meteorZones[i].damage * dt);
        }
        if (window.meteorZones[i].life <= 0) {
            window.meteorZones[i] = window.meteorZones[window.meteorZones.length - 1];
            window.meteorZones.pop();
        }
    }

    // ── PERF: zero-alloc entity list — reuse module-scope buffer ─────────
    _mapUpdateEntities.length = 0;
    if (window.player && !window.player.dead) _mapUpdateEntities.push(window.player);
    for (let _i = 0; _i < window.enemies.length; _i++) {
        if (!window.enemies[_i].dead) _mapUpdateEntities.push(window.enemies[_i]);
    }
    if (window.boss && !window.boss.dead) _mapUpdateEntities.push(window.boss);
    mapSystem.update(_mapUpdateEntities, dt);
    particleSystem.update(dt);
    floatingTextSystem.update(dt);

    if (typeof updateOrbitalEffects !== 'undefined') updateOrbitalEffects(dt, [window.player]);
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
        console.log('[MTC drawGame] frame', drawGame._diagFrame, '| window.gameState:', window.gameState,
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
    // ── PERF: globalAlpha + solid color — no template literal alloc per zone ──
    CTX.fillStyle = '#ef4444';
    for (const z of window.meteorZones) {
        const screen = worldToScreen(z.x, z.y);
        const a = Math.sin(_drawNow / 200) * 0.3 + 0.7;
        CTX.globalAlpha = a * 0.4;
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2);
        CTX.fill();
    }
    CTX.globalAlpha = 1;

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

    for (let _i = 0; _i < window.specialEffects.length; _i++) window.specialEffects[_i].draw();

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
    if (typeof DomainExpansion !== 'undefined') DomainExpansion.draw(CTX);
    if (typeof GravitationalSingularity !== 'undefined') GravitationalSingularity.draw(CTX);

    if (typeof CanvasHUD !== 'undefined' && CanvasHUD.draw) {
        CanvasHUD.draw(CTX, _lastDrawDt);
    } else if (typeof UIManager !== 'undefined' && UIManager.draw) {
        UIManager.draw(CTX, _lastDrawDt); // compat fallback
    }

    // ── Tutorial canvas overlay (spotlight + world pulse) ──
    if (typeof TutorialSystem !== 'undefined' && TutorialSystem.isActive()) {
        TutorialSystem.draw(CTX);
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
// 🚀 INIT & START
// ══════════════════════════════════════════════════════════════

function initAI() {
    const brief = document.getElementById('mission-brief');
    if (!brief) return;
    const names = GAME_TEXTS.ai.missionNames;
    const name = names[Math.floor(Math.random() * names.length)];
    brief.textContent = GAME_TEXTS.ai.missionPrefix(name);
}

// ── Overlay fade-out helper (🔴 Fix #1) ──────────────────────────────────
function _fadeOutOverlay() {
    const el = document.getElementById('overlay');
    if (!el) return;
    el.classList.add('fade-out');
    // Safety timeout fallback in case transitionend doesn't fire
    const fallback = setTimeout(() => {
        el.style.display = 'none';
        el.classList.remove('fade-out');
    }, 500);
    el.addEventListener('transitionend', function handler() {
        clearTimeout(fallback);
        el.style.display = 'none';
        el.classList.remove('fade-out');
        el.removeEventListener('transitionend', handler);
    });
}

function startGame(charType = 'kao') {
    console.log('🎮 Starting game... charType:', charType);
    window._selectedChar = charType;
    Audio.playBGM('battle');

    // ── WorkerBridge: start analyzer worker (no-op if already running) ────
    if (typeof WorkerBridge !== 'undefined') WorkerBridge.init();

    const savedData = getSaveData();
    console.log('[MTC Save] Loaded save data:', savedData);
    UIManager.updateHighScoreDisplay(savedData.highScore);

    window.player = _createPlayer(charType);
    _resetRunState(window.player);
    _initGameUI(charType);

    console.log('✅ Game started!');
    if (!GameState.loopRunning && rafId === null) {
        GameState.loopRunning = true;
        rafId = requestAnimationFrame(gameLoop);
    }
}

// ── Player factory — returns the correct subclass for charType ────────────────
function _createPlayer(charType) {
    let player;
    if (charType === 'auto' && typeof AutoPlayer === 'function') {
        player = new AutoPlayer();
    } else if (charType === 'kao' && typeof KaoPlayer === 'function') {
        player = new KaoPlayer();
    } else if (charType === 'pat' && typeof PatPlayer === 'function') {
        player = new PatPlayer();
    } else {
        player = charType === 'poom' ? new PoomPlayer() : new Player(charType);
    }
    if (window.isAdmin && typeof player.applyDevBuff === 'function') {
        player.applyDevBuff();
        console.log('%c[MTC Admin] 🚀 DEV BUFF applied to player.', 'color:#f97316; font-weight:bold;');
    }
    return player;
}

// ── Mutable run state reset for a fresh game ─────────────────────────────────
function _resetRunState(player) {
    dayNightTimer = 0;
    BALANCE.LIGHTING.ambientLight = BALANCE.LIGHTING.dayMaxLight;

    GameState.resetRun();
    console.log('🐕 Boss encounter counter reset');
    console.log('🕐 Bullet Time reset — timeScale 1.0, energy full');
    console.log('⚡ Glitch Wave grace period reset');

    // Clear shop buff state on player (set before first ShopSystem call this run)
    player.shopDamageBoostActive = false; player.shopDamageBoostTimer = 0; player._baseDamageBoost = undefined;
    player.shopSpeedBoostActive = false; player.shopSpeedBoostTimer = 0; player._baseMoveSpeed = undefined;

    window.drone = new Drone();
    window.drone.x = player.x; window.drone.y = player.y;
    spawnFloatingText(GAME_TEXTS.combat.droneOnline, player.x, player.y - 90, '#00e5ff', 20);
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

    Achievements.stats.barrelKills = 0;
    Achievements.stats.damageTaken = 0;
    Achievements.stats.kills = 0;
    Achievements.stats.shopPurchases = 0;
    GameState.waveStartDamage = 0;
}

// ── UI wiring: HUD setup, overlays, tutorial, mobile, wave ───────────────────
function _initGameUI(charType) {
    const player = window.player;
    weaponSystem.setActiveChar(charType);
    try { weaponSystem.updateWeaponUI(); } catch (err) {
        console.error('[startGame] updateWeaponUI threw — continuing anyway:', err);
    }
    UIManager.initSkillNames();
    UIManager.setupCharacterHUD(player);

    // 🔴 Fix #1: Fade out instead of instant hide
    _fadeOutOverlay();
    hideElement('report-card');
    UIManager.resetGameOverUI();

    // 🟡 Fix #6: Reset RETRY label back to original START MISSION
    const _startBtn = document.getElementById('start-btn');
    if (_startBtn && _startBtn.dataset._originalLabel) {
        _startBtn.textContent = _startBtn.dataset._originalLabel;
        delete _startBtn.dataset._originalLabel;
    }

    showResumePrompt(false);
    ShopManager.close();

    if (AdminConsole.isOpen) AdminConsole.close();
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) consoleOutput.innerHTML = '';

    rollShopItems();
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
}

function endGame(result) {
    if (GameState.phase === 'GAMEOVER') return;
    setGameState('GAMEOVER');

    // ── WorkerBridge: reset analyzer history on game end ─────────────────
    if (typeof WorkerBridge !== 'undefined') WorkerBridge.reset();

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

    let _isNewHighScore = false;
    {
        const runScore = getScore();
        const existing = getSaveData();
        if (runScore > existing.highScore) {
            _isNewHighScore = true;
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
        // 🟢 Fix #8: NEW RECORD badge
        if (_isNewHighScore) {
            const recBadge = document.getElementById('victory-new-record');
            if (recBadge) recBadge.classList.add('visible');
        }
    } else {
        const finalScore = getScore();
        const finalWave = getWave();
        const finalKills = Achievements.stats.kills || 0;

        showElement('overlay');
        UIManager.showGameOver(finalScore, finalWave, finalKills);

        // 🟡 Fix #6: Change start button label to RETRY MISSION
        const _retryBtn = document.getElementById('start-btn');
        if (_retryBtn) {
            _retryBtn.dataset._originalLabel = _retryBtn.textContent;
            const _charId = window.player?.charId || 'kao';
            const _icon = _charId === 'poom' ? '🌾' : _charId === 'auto' ? '🔥' : _charId === 'pat' ? '⚔️' : '🎓';
            _retryBtn.textContent = _icon + ' RETRY MISSION';
        }

        const ld = document.getElementById('ai-loading');
        if (ld) ld.style.display = 'none';
        const reportText = document.getElementById('report-text');
        if (reportText) {
            let category;
            if (finalScore > 5000) category = 'excellent';
            else if (finalScore > 2000) category = 'good';
            else category = 'poor';
            const cards = GAME_TEXTS.ai.reportCards[category];
            reportText.textContent = cards[Math.floor(Math.random() * cards.length)];
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

    // ── Loading State System (3.3) ─────────────────────────────────────
    const LoadingState = {
        overlay: null,
        progressFill: null,
        progressText: null,
        details: {},
        totalSteps: 5,
        currentStep: 0,

        init() {
            this.overlay = document.getElementById('loading-overlay');
            this.progressFill = document.getElementById('loading-progress-fill');
            this.progressText = document.getElementById('loading-progress-text');
            this.details = {
                canvas: document.getElementById('loading-canvas'),
                input: document.getElementById('loading-input'),
                audio: document.getElementById('loading-audio'),
                assets: document.getElementById('loading-assets'),
                ready: document.getElementById('loading-ready')
            };
        },

        update(step, status, text) {
            if (!this.overlay) return;

            // Update detail item
            const detailEl = this.details[step];
            if (detailEl) {
                detailEl.className = 'loading-detail-item loading';
                detailEl.textContent = `⏳ ${status}`;
            }

            // Update progress
            this.currentStep++;
            const progress = (this.currentStep / this.totalSteps) * 100;
            this.progressFill.style.width = `${progress}%`;
            this.progressText.textContent = text;

            // Mark as loaded after delay
            setTimeout(() => {
                if (detailEl) {
                    detailEl.className = 'loading-detail-item loaded';
                    detailEl.textContent = `✓ ${status}`;
                }
            }, 300);
        },

        finish() {
            if (!this.overlay) return;

            // Complete progress
            this.progressFill.style.width = '100%';
            this.progressText.textContent = 'READY TO PLAY';

            // Mark final step
            if (this.details.ready) {
                this.details.ready.className = 'loading-detail-item loaded';
                this.details.ready.textContent = '✓ Ready to Play';
            }

            // Hide overlay after delay
            setTimeout(() => {
                this.overlay.classList.add('hidden');
                // Remove from DOM after transition
                setTimeout(() => {
                    if (this.overlay.parentNode) {
                        this.overlay.parentNode.removeChild(this.overlay);
                    }
                }, 400);
            }, 800);
        }
    };

    // BUG FIX: Ensure DOM is fully ready before initialization
    const initializeGame = () => {
        if (!document.getElementById('gameCanvas')) {
            console.warn('Canvas element not found, retrying...');
            setTimeout(initializeGame, 100);
            return;
        }

        // Initialize loading state
        LoadingState.init();

        try {
            // Step 1: Canvas System
            LoadingState.update('canvas', 'Canvas System', 'INITIALIZING CANVAS...');
            initCanvas();

            // Step 2: Input System  
            LoadingState.update('input', 'Input System', 'SETTING UP INPUTS...');
            setGameState('MENU');
            if (typeof InputSystem !== 'undefined') InputSystem.init();

            // Step 3: Audio System
            LoadingState.update('audio', 'Audio System', 'LOADING AUDIO...');
            initAI();

            // Step 4: Game Assets (Audio.init happens here)
            LoadingState.update('assets', 'Game Assets', 'PREPARING ASSETS...');
            if (typeof Audio !== 'undefined') {
                Audio.init();
                Audio.playBGM('menu');
            }

            // Step 5: Ready to Play
            LoadingState.update('ready', 'Ready to Play', 'FINALIZING...');

            // Finish loading
            setTimeout(() => LoadingState.finish(), 500);

        } catch (err) {
            console.error('[window.onload] Initialization error:', err);
            // Still hide loading on error to prevent stuck screen
            if (LoadingState.overlay) {
                LoadingState.overlay.classList.add('hidden');
            }
        }
    };

    if (document.readyState === 'complete') {
        initializeGame();
    } else {
        document.addEventListener('DOMContentLoaded', initializeGame);
    }
};