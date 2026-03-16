---
name: mtc-game-conventions
description: "Project-specific conventions, architecture rules, and critical pitfalls for MTC The Game (github.com/M1N-W/MTC-Game). Use this skill at the start of EVERY task involving this codebase. Trigger on: MTC Game, MTC the game, enemy.js, AutoPlayer, KaoPlayer, PoomPlayer, PatPlayer, WanchaiStand, EnemyBase, UtilityAI, SquadAI, BossBase, ManopBoss, FirstBoss, PlayerRenderer, BossRenderer, WaveManager, game.js, config.js BALANCE, MTC Room, GravitationalSingularity, DomainExpansion, weapon system, heat tier, stand meter, ORA combo, vacuum pull, sticky slow, ignite DoT, Zanzo Flash, Iaido Strike, Blade Guard, tryReflectProjectile, WorkerBridge, analyzer-worker, WAVE_SCHEDULE, SHATTER reaction, HealthComponent, predictedPosition, velocityEstimate, file header documentation, JSDoc header, module header, hudEmoji, GAME_TEXTS, UIManager._E, patchTooltipEmojis, injectCooldownStyles, eat-buff-active, buff-bar, skill icon HUD."
---

# MTC The Game — Project Conventions & Critical Pitfalls
Stack: Vanilla JS (ES6+) + HTML5 Canvas 2D + Web Audio API. No frameworks.
Target: 60 FPS | Status: Beta [NEXT VERSION]

---

1. File Versioning Rule (ALWAYS follow this)

New chat + file attached by user       → use uploads directly
New chat + no file attached            → ask for the file (only files needed for the task)
Continuing chat + no new upload        → check /mnt/user-data/outputs/<file> first
                                         if exists → cp from outputs (not uploads)
                                         if not    → use uploads
Continuing chat + user uploads new     → always use new upload (outputs may be stale)

Before editing any file in a continuing chat:
  ls /mnt/user-data/outputs/<filename>        # check first
  cp /mnt/user-data/outputs/X /home/claude/X  # ✅ if exists
  cp /mnt/user-data/uploads/X /home/claude/X  # ✅ only if no output

Never ask for a file already present in uploads or outputs.

---

2. Class Name Map — CRITICAL (wrong name = TypeError at runtime)

  File              | Class inside    | Alias / used as
  ------------------|-----------------|------------------
  ManopBoss.js      | ManopBoss       | KruManop (instanceof check)
  FirstBoss.js      | KruFirst        | KruFirst
  ManopBoss.js      | BossDog         | BossDog (sub-boss)

❌ NEVER use: Boss, BossFirst, KruManop as constructor names
✅ ALWAYS use: ManopBoss, KruFirst, BossDog

Applies everywhere: WaveManager._startBossWave(), AdminSystem spawn commands,
BossRenderer dispatcher, typeof guards.

BossRenderer dispatcher — KruFirst MUST be checked before KruManop:
  if (e instanceof KruFirst) BossRenderer.drawBossFirst(e, ctx);
  else if (e instanceof ManopBoss) BossRenderer.drawBoss(e, ctx);   // KruManop
  else if (e instanceof BossDog) BossRenderer.drawBossDog(e, ctx);
Reason: ManopBoss extends BossBase — if KruManop checked first it would also
match any future BossBase subclass. KruFirst also extends BossBase.

---

3. Inheritance Chain

Entity (base.js)
├── EnemyBase (enemy.js, line 87)    ← UtilityAI + StatusEffect + hitFlash here
│   ├── Enemy
│   ├── TankEnemy
│   └── MageEnemy
├── PlayerBase (PlayerBase.js)
│   ├── KaoPlayer
│   ├── AutoPlayer
│   ├── PoomPlayer
│   └── PatPlayer
└── BossBase
    ├── ManopBoss   (file: ManopBoss.js — contains KruManop + BossDog)
    └── FirstBoss   (file: FirstBoss.js — contains KruFirst)

New enemy template:
  class SniperEnemy extends EnemyBase {
      constructor(x, y) { super(x, y, 18, 'mage'); this.type = 'sniper'; }
      update(dt, player) {
          if (this.dead) return;
          this._tickShared(dt, player); // AI + StatusEffect + hitFlash — FIRST always
          // movement + attack logic only
      }
      _onDeath(player) { /* FX + score */ }
  }

---

4. AI System Architecture

Load order: UtilityAI.js → EnemyActions.js → PlayerPatternAnalyzer.js → SquadAI.js → enemy.js
Worker files (loaded separately in index.html):
  js/workers/analyzer-worker.js  — standalone worker, no window.* imports
  js/systems/WorkerBridge.js     — main thread bridge, loaded after game.js

  Layer               | File                      | Rate
  --------------------|---------------------------|----------------------
  Individual AI       | UtilityAI.js              | 2Hz (0.5s timer)
  Tactical actions    | EnemyActions.js           | called by UtilityAI
  Player analysis     | PlayerPatternAnalyzer.js  | sample 10Hz / compute 4Hz (main-thread fallback)
  Player analysis     | analyzer-worker.js        | off main thread via WorkerBridge (Phase 1.3)
  Squad coordination  | SquadAI.js                | 1Hz

WorkerBridge integration (Phase 1.3):
  WorkerBridge.onmessage writes _workerPredReady/_workerPredX/_workerPredY
  onto window.playerAnalyzer so predictedPosition() returns worker result.
  ❌ Never import window.* in analyzer-worker.js — it runs in a Worker scope
  ✅ analyzer-worker.js must be self-contained with its own Float32Array ring buffer

Immutable rules:
- AI writes _aiMoveX/_aiMoveY only — never vx/vy directly
- _tickShared() must be first line of every subclass update()
- BossBase has no update() — Boss AI goes in ManopBoss/FirstBoss directly
- Retreat always beats squad role override
- SHATTER reaction lives in EnemyBase._tickShared() after ignite DoT block — never move it
  Trigger: igniteTimer > 0 && (stickySlowMultiplier < 0.65 || stickyStacks >= 3)
  Effect: igniteDPS × 2.5 burst + 0.4s stun (_shatterStunTimer) + _shatterUsed flag guard

game.js integration:
  if (typeof window.playerAnalyzer !== 'undefined' && window.boss && !window.boss.dead) {
      window.playerAnalyzer.sample(dt, window.player, window.boss);
      window.playerAnalyzer.update(dt);
  }
  if (typeof window.squadAI !== 'undefined') window.squadAI.update(dt, window.enemies, window.player);

PlayerPatternAnalyzer API — correct method names:
  playerAnalyzer.dominantPattern()    // 'kiting'|'circling'|'standing'|'mixed'
  playerAnalyzer.dominantDirection()  // 'left'|'right'|'none'
  playerAnalyzer.kitingScore()        // 0–1
  playerAnalyzer.reset()              // call on boss death / wave end
  ❌ getDominantStyle() — does NOT exist

---

5. Critical Property Rules

vx/vy vs _aiMoveX/_aiMoveY:
  ❌  this.vx = dx / dist * this.speed;       // AI must never do this
  ✅  this._aiMoveX = dx / dist;              // AI writes override only

stats.moveSpeed vs moveSpeed:
  ✅  player.stats.moveSpeed *= slowFactor;   // domain slow, speed buffs
  ❌  player.moveSpeed *= slowFactor;         // no effect on actual speed cap

StatusEffect timing — use dt, not performance.now() per tick:
  ✅  effect._remaining -= dt;
  ⚠️  if (performance.now()/1000 > effect.expireAt)  // existing pattern, don't spread

EnemyActions.retreat() — wall avoidance uses WORLD bounds, NOT screen:
  ✅  MAP_CONFIG.mapWidth / MAP_CONFIG.mapHeight   // world coords (~3200×3200)
  ❌  CANVAS.width / CANVAS.height                // screen pixels (~800×600) — wrong

UtilityAI.dispose() — clear list in-place, do NOT allocate:
  ✅  this._nearbyAlliesList.length = 0;
  ❌  this._nearbyAlliesList = [];               // creates new array = GC allocation

SquadAI._assignRole() — basic enemies can only be FLANKER or ASSAULT:
  SHIELD role is assigned exclusively to type==='tank' (hard-coded above the budget check)
  shieldCount budget has no effect on basic enemy assignment — do not add shield logic there

KaoPlayer stealth properties — two distinct states, both can be true simultaneously:
  isInvisible        — R-Click Skill Stealth (PlayerBase), enemies cannot see player
  isFreeStealthActive — Free-Stealth passive state (auto-triggered by dash or bullet-pass-through)
                        damage ×1.5, guaranteed crit, kills count toward Lv2 passive
  ❌  Do NOT conflate these — PlayerRenderer and fireWeapon() check them independently
  ❌  Old name isFreeStealthy is REMOVED — will cause silent undefined = falsy bugs if used

---

6. Global Variable Patterns

Bare variable vs window.* in 'use strict':
  ✅  window.player, window.enemies, window.boss, window.gameState
  ❌  player, enemies, boss, gameState  (ReferenceError in strict mode)

Exception: typeof guard is safe even in strict mode:
  ✅  if (typeof player !== 'undefined' && player instanceof PoomPlayer)
  ✅  if (window.player && window.player.charId === 'kao')   // preferred — consistent

Singleton exports — always add explicit window.* after var declaration:
  var waveAnnouncementFX = new WaveAnnouncementFX();
  window.waveAnnouncementFX = waveAnnouncementFX;   // ✅ explicit — var hoisting
                                                     //    alone fails in bundlers

showVoiceBubble — global wrapper exists in utils.js:
  ✅  showVoiceBubble('text', x, y)              // safe — utils.js wrapper
  ✅  if (window.UIManager) window.UIManager.showVoiceBubble('text', x, y)  // also fine
  ❌  window.UIManager.showVoiceBubble(...)      // crashes if UIManager not yet loaded

---

7. Domain Singleton Reset — Critical Pitfall

DomainExpansion and GravitationalSingularity are module-level singletons.
They do NOT reset automatically between games.

Must abort() at all 3 exit points:
  // 1. BossBase._onDeath()
  DomainExpansion.abort();
  GravitationalSingularity.abort();
  window.boss = null;
  // 2. AdminSystem kill command
  // 3. AdminSystem skipwave command

GravitationalSingularity.update() must run even when boss is dead:
  ✅  if (typeof GravitationalSingularity !== 'undefined')
          GravitationalSingularity.update(dt, window.boss, window.player);
  ❌  if (window.boss && !window.boss.dead)   // phase gets stuck if boss dies mid-cast
          GravitationalSingularity.update(...)

---

8. Rendering Architecture

PlayerRenderer — Full Layer Order (verified March 2026):
  Pre-draw: _drawGroundShadow() → _drawGroundFeet()   ← BEFORE any LAYER save block
  LAYER 0:   Background effects (Weapon Master aura, sniper laser, state indicators)
  LAYER 1:   Body  ctx.save() → translate(screen+recoil+bob) → scale(stretch×facing) → rotate(runLean) → body → hitFlash → ctx.restore()
  LAYER 1.5: Speed streaks (world space, velocity-driven — isDashing changes color/count)
  LAYER 2:   Weapon  ctx.save() → translate(screen+recoil+bob) → rotate(angle) → translate(shootReach,shootLift) → weapon → hands → ctx.restore()
  Post:      Low HP glow, level badge, muzzle flash (screen space)

  ⚠️ Kao and Pat route through _drawBase() for body+weapon — do NOT add separate LAYER
     logic outside _drawBase. Character-specific effects inside _drawBase use:
     if (entity.charId === 'kao') { ... }  /  if (entity.charId === 'pat') { ... }
  ⚠️ Auto and Poom have their own _drawAuto() / _drawPoom() with the same LAYER structure
     but character-specific weapon geometry and shoot animations.

Variable declaration order — declare BEFORE dash ghost loop:
  ✅  const moveT = ..., bobY = ..., stretchX = ..., stretchY = ..., R = ...;
      for (const ghost of this._dashGhosts) { ... }   // uses those vars
  ❌  declare after ghost loop → ReferenceError

No Math.random() in draw() — deterministic rendering only.

All PlayerRenderer and BossRenderer methods are static — call as:
  PlayerRenderer._drawKao(entity, ctx)
  BossRenderer.drawBoss(e, ctx)
Never instantiate these classes.

_getLimbParams(entity, now, speedCap) — shared limb/motion params:
  Returns: { moveT, bob, breathe, stretchX, stretchY, bobOffsetY,
             shootLift, shootReach, hurtPushX, hurtPushY, runLean,
             dashStretchX, animState,
             shadowScaleX, shadowScaleY, shadowAlphaMod, footL, footR }
  speedCap: Auto=180, Poom=190, Pat/Base=200
  Uses entity._anim.smoothMoveT (lerp) and smoothAngle (shortest-arc lerp)
  ❌ Do NOT read entity.angle directly for hurtPush — use smoothAngle from _getLimbParams

Phase 4 static helpers (call before LAYER 1 save block):
  PlayerRenderer._drawGroundShadow(ctx, sx, sy, baseRx, baseRy, baseOffY, limb)
    — shadow ellipse scales: dashT=wide, hurtT=flat, shadowAlphaMod fades at run speed
    — baseRx/Ry: Auto(16,6), Poom(14,5), Pat(16,5.5), Base/Kao(14,5)
  PlayerRenderer._drawGroundFeet(ctx, sx, sy, limb, color, entity)
    — two 3.5×2px foot dots, alternating L/R via walkCycle
    — auto-skip if isInvisible/isFreeStealthActive or moveT < 0.05
  limbXxx alias required — pass like: { ...limbAuto, bobOffsetY }

Muzzle Offsets (shootSingle in weapons.js):
  Each character+weapon combo has a distinct barrel offset (px).
  Source of truth: shootSingle() in weapons.js — grep 'barrelOffset' or 'muzzleOffset'.
  ⚠️ KaoPlayer bypasses shootSingle() entirely → muzzle offset lives in KaoPlayer.fireWeapon().
     Adding a new Kao weapon requires adding its offset there, not in weapons.js.
  ⚠️ PoomPlayer bypasses shootSingle() entirely → muzzle offset lives in PoomPlayer.shoot().
     Offset is computed from drawPoomWeapon() geometry — see §10 for the formula.
     Do NOT add Poom muzzle logic to weapons.js or shootSingle().

---

9. effects.js — module.exports Pitfall

Only export classes that are actually defined in the file.
EquationSlam and DeadlyGraph were removed — never add them back to exports.

  ❌  module.exports = { ..., EquationSlam, DeadlyGraph, ... }
      // ReferenceError in Node/bundler (browser is safe due to typeof module guard)

Singleton pattern in effects.js:
  var decalSystem = new DecalSystem();
  window.decalSystem = decalSystem;       // ✅ always add explicit window export
  var shellCasingSystem = new ShellCasingSystem();
  window.shellCasingSystem = shellCasingSystem;

Character-specific spawn helpers — explicit window.* export required (end of effects.js):
  window.spawnZanzoTrail = spawnZanzoTrail;      // Pat — Zanzo Flash afterimage trail
  window.spawnBloodBurst = spawnBloodBurst;      // enemy death burst
  window.spawnKatanaSlashArc = spawnKatanaSlashArc;  // Pat — katana slash arc
  window.spawnWanchaiPunchText = spawnWanchaiPunchText;  // Auto — stand-rush impact text
  (spawnParticles / spawnFloatingText are declared globally in utils.js scope — no window.* needed)

  When adding a new character-specific spawner to effects.js:
  ✅ Declare as a bare function at file scope
  ✅ Add window.spawnXxx = spawnXxx at the explicit exports block at end of file
  ✅ Add to module.exports {...} block for Node/bundler compat
  ❌ Do NOT attach helpers to the object pool classes (ParticleSystem, etc.) — they are standalone functions

---

10. Poom Special Cases

- Poom bypasses WeaponSystem entirely — shoots via PoomPlayer.shoot() directly
- Ritual (R) has no energy cost — combo finisher with CD + stack requirement
- E/R/Q routing: all in PoomPlayer.update(); eatRice (R-Click) routed from game.js
- Never add Q-consume block in game.js for Poom — skips cooldown

Poom muzzle offset — spawn projectile from barrel tip, NOT body center:
  shoot() computes world-space muzzle position from drawPoomWeapon() geometry:
    MUZZLE_FORWARD = 56   // px along aim axis: R2(13) + weapon_translate(12) + muzzle_x(31)
    MUZZLE_PERP    = 11   // px perpendicular:  gatlingLowerY(5) + weapon_translate_y(6)
    facingSign = Math.abs(angle) > Math.PI/2 ? -1 : 1
    muzzleX = x + cos(angle)*FORWARD - sin(angle)*PERP*facingSign
    muzzleY = y + sin(angle)*FORWARD + cos(angle)*PERP*facingSign
  ❌ new Projectile(this.x, this.y, ...) — spawns from body center, visually wrong
  ✅ new Projectile(muzzleX, muzzleY, ...)
  ⚠️ If drawPoomWeapon() geometry changes, recalculate MUZZLE_FORWARD/PERP to match

---

11. AutoPlayer Heat Tier System

Four tiers: COLD → WARM → HOT → OVERHEAT (0–100% heat meter).
Each tier applies damage multipliers, punch rate factors, and at OVERHEAT: crit bonus + HP drain.

config.js is ALWAYS source of truth — verify ?? fallback values in AutoPlayer.js match config exactly.
Key config fields: coldDamageMult, heatDmgWarm, heatDmgHot, heatDmgOverheat,
                   heatCritBonusOverheat, heatHpDrainOverheat,
                   standMeterDrainRate, standMeterDrainCold, standMeterDrainOverheat,
                   standMeterPerHit, standMeterOnKill, standCritBonus

Stand Meter drain multipliers have direction-specific hazards (COLD = penalty, OVERHEAT = faster burn).
Wrong ?? fallbacks caused pre-v3.30.10 bugs — always verify against config.js before editing.

Wanchai (R-Click) active: Q becomes Stand Pull instead of Vacuum Pull.
HUD arc max for Q must be dynamic (read from config key, not hard-coded) because
standPullCooldown ≠ vacuumCooldown.

---

12. config.js Structure

  BALANCE.characters[charId] = {
      hp, maxHp, energy, maxEnergy, moveSpeed, dashSpeed,
      xyzEnergyCost: N,   // every active skill needs this
      weapons: { weaponName: { damage, cooldown, range, speed } }
  }

Energy cost pattern — use in every skill activation:
  const cost = S.xyzEnergyCost ?? DEFAULT;
  if ((this.energy ?? 0) < cost) {
      spawnFloatingText('⚡ FOCUS LOW!', this.x, this.y - 50, '#facc15', 16);
  } else {
      this.energy = Math.max(0, (this.energy ?? 0) - cost);
      this.doSkill();
  }

### 13. Adding New Content — Checklist

New playable character:
  js/entities/player/[Name]Player.js (extends PlayerBase)
  config.js — BALANCE.characters.[name] block + VISUALS.PALETTE.[NAME] + GAME_TEXTS.skillNames.[name]
  PlayerRenderer.js — static _draw[Name]() + dispatcher update
  audio.js — play[Name][Skill]() SFX methods (typically 5-7 skills)
  effects.js — new particle types + spawn[Name][Effect]() helper functions
  ui.js — PORTRAITS.[name] + UIManager._updateIcons[Name]() + HUD icons
  menu.js — character select entry + icon prefix
  index.html — script tag after existing player files
              — stat bar widths (HP/DMG/SPD/RANGE) are hard-coded % in index.html — update to match BALANCE
  weapons.js — if character has unique weapon mechanics (e.g., projectile reflection)
  PlayerBase.js — if character needs unique speed/property modifiers
              — applyDevBuff() stat-package: add charId branch if devbuff needs char-specific values
  .agents/skills/MTC-Game's skills for Claude/mtc-rendering.skill — ถ้ามีการแก้ renderer logic
  Markdown Source/Successed-Plan/PERF_PLAN.md — ถ้ามีการแก้ performance logic/audit
  **Header Documentation — add module-level JSDoc header (see §18)**

New enemy:
  enemy.js (extends EnemyBase), config.js, WaveManager.js, audio.js, effects.js

New boss:
  js/entities/boss/[Name]Boss.js (extends BossBase)
  BossRenderer.js — static draw + dispatcher (KruFirst first, then ManopBoss, then BossDog)
  js/entities/boss/boss_attacks_[name].js — new attack file for this boss
    (or boss_attacks_shared.js if attacks are reusable across bosses)
  config.js, WaveManager.js, audio.js, index.html (3 script tags: shared → manop/first → new)
  window.BossXxx = XxxClass alias required for WaveManager + AdminSystem
  Boss queue: waves 3, 6, 9, 12, 15

  speak() — inherited from BossBase (architectural coupling):
    Reads a random entry from GAME_TEXTS.ai.bossTaunts[], passes to UIManager.showBossSpeech()
    Pure synchronous — no Gemini, no fetch, no try-catch needed
    Guard only: if (!window.UIManager) return; (already in base)
    Call sites: phase transitions, attack telegraphs — never inside draw() or hot update loops
    ✅ Call once per event: this.speak('context') — context param is accepted but unused in base

boss_attacks split (DONE as of v3.29.x):
  boss_attacks_shared.js  — ExpandingRing (used by both bosses)
  boss_attacks_manop.js   — BarkWave, GoldfishMinion, BubbleProjectile, MatrixGridAttack,
                             DomainExpansion (_DC/_DE constants live here), EquationSlam,
                             DeadlyGraph, ChalkWall
  boss_attacks_first.js   — FreeFallWarningRing, PorkSandwich, EmpPulse, PhysicsFormulaZone,
                             ParabolicVolley, OrbitalDebris, GravitationalSingularity,
                             GravityWell, SuperpositionClone
  Load order in index.html:
    <script src="js/entities/boss/boss_attacks_shared.js"></script>
    <script src="js/entities/boss/boss_attacks_manop.js"></script>
    <script src="js/entities/boss/boss_attacks_first.js"></script>
    <script src="js/entities/boss/BossBase.js"></script>
    <script src="js/entities/boss/ManopBoss.js"></script>
    <script src="js/entities/boss/FirstBoss.js"></script>

Boss constructor — config-driven scaling (invariant, established March 2026):
  Every boss constructor MUST read HP/speed multipliers from BALANCE.boss.[name], not hardcode them.
  Use ?? fallbacks so the constructor is safe if a config key is temporarily missing.

  ✅ Standard pattern (from FirstBoss):
    const _F     = BALANCE.boss.first;
    const hpBase = _F.hpBaseMult         ?? 0.72;
    const hpAdv  = isAdvanced ? (_F.advancedHpMult ?? 0.85) : 1.0;
    const spdMul = _F.speedBaseMult       ?? 1.55;
    this.maxHp   = BALANCE.boss.baseHp * difficulty * hpBase * hpAdv;
    this.moveSpeed = Math.min(BALANCE.boss.moveSpeed * 2.2, BALANCE.boss.moveSpeed * spdMul * spdAdv);

  ❌ Anti-pattern (was the bug in FirstBoss pre-March 2026):
    const advMult = isAdvanced ? 1.35 : 1.0;          // hardcoded — BALANCE.boss.first.advancedHpMult ignored
    this.maxHp = BALANCE.boss.baseHp * difficulty * 0.85 * advMult;   // config value silently unused

  Config block to add for each new boss: BALANCE.boss.[name] = { hpBaseMult, advancedHpMult?, speedBaseMult, ... }

New active skill:
  [Character].js — energy cost guard (see pattern above)
  config.js — xyzEnergyCost
  ui.js — HUD icon
  audio.js, effects.js
  PlayerRenderer.js — if animation needed

index.html script order (AI section):
  <script src="js/entities/base.js"></script>
  <script src="js/ai/UtilityAI.js"></script>
  <script src="js/ai/EnemyActions.js"></script>
  <script src="js/ai/PlayerPatternAnalyzer.js"></script>
  <script src="js/ai/SquadAI.js"></script>
  <!-- then player files, enemy.js, boss files -->
  <script src="js/systems/WorkerBridge.js"></script>  <!-- after game.js -->
  <!-- analyzer-worker.js is loaded via new Worker('js/workers/analyzer-worker.js') in WorkerBridge.js — NOT a script tag -->

---

14. Defensive Coding Patterns

  if (typeof CTX === 'undefined') return;
  if (typeof BALANCE === 'undefined') return;

  this._ai = (typeof UtilityAI !== 'undefined') ? new UtilityAI(this, type) : null;
  if (typeof squadAI !== 'undefined') squadAI.update(dt, enemies, player);

  const cost = S.xyzEnergyCost ?? 20;
  const cd = this.skills.slam?.cd ?? 0;

---

15. sw.js — Bump Version on Every Commit

  const CACHE_NAME = 'mtc-game-v3.X.X';  // bump every time any code changes

Forgetting this = players get stale cached JS.
Also update: sw.js → CHANGELOG.md → PROJECT_OVERVIEW.md (status line)

Version bump ownership: Windsurf (commit time) bumps ALL files in one pass.
Claude must NOT write version numbers into files — use [NEXT VERSION] as placeholder.

---

16. Animation State Machine — _anim System (PlayerBase + PlayerRenderer)

PlayerBase._anim object (init in constructor):
  { state, t, shootT, hurtT, dashT, skillT, smoothMoveT, smoothAngle }

  state:       'idle'|'walk'|'run'|'shoot'|'dash'|'hurt' — priority: dash>shoot>hurt>run>walk>idle
  shootT:      0→1 decay ×5/s (~0.2s) — arm raise after firing
  hurtT:       0→1 decay ×3/s (~0.33s) — flinch after hit
  dashT:       0→1 decay ×4/s (~0.25s) — lean/stretch after dash
  skillT:      free-running per-character timer, decay ×1/s — see trigger table below
  smoothMoveT: lerp of moveT, 8Hz convergence — prevents snap on start/stop
  smoothAngle: shortest-arc lerp of entity.angle, same rate — null until first tick

_tickAnim(dt) is called in PlayerBase.update() — called last after movement.
PoomPlayer overrides update() entirely → must call _tickAnim(dt) manually.

Trigger points — where each character sets timers:

  Character | Timer    | Value              | Where
  ----------|----------|--------------------|------------------------------------------
  All       | hurtT=1  | takeDamage()       | PlayerBase.takeDamage() (base handles it)
  All       | dashT=1  | dash()             | PlayerBase.dash()
  Kao       | shootT=1 | after Audio.playShoot() | _doShoot()
  Kao       | dashT=1  | Q teleport blink success | after blink resolve
  Kao       | skillT=0.5 | E clone spawn   | _activateClone()
  Auto      | shootT=1 | Stand Rush melee + Heat Wave | _doPlayerMelee()
  Auto      | skillT=wanchaiDuration | R-Click Wanchai activate | _activateWanchai()
  Auto      | hurtT=1  | override before super | AutoPlayer.takeDamage()
  Poom      | shootT=1 | L-Click shoot     | PoomPlayer.update() — set inline after shoot() call (no _doShoot method)
  Poom      | skillT=0.6 | E Garuda summon | _activateGaruda()
  Poom      | skillT=1.0 | R Ritual burst  | _activateRitual()
  Poom      | hurtT=1  | override          | PoomPlayer.takeDamage()
  Pat       | shootT=1 | katana L-Click    | PatPlayer._doAttack()
  Pat       | dashT=1  | Q Zanzo Flash     | _activateZanzo()
  Pat       | skillT=(iaidoChargeDur??0.45)+0.3 | R Iaido charge | _activateIaido()

Per-character skillT rendering effects (in PlayerRenderer):
  Kao   → skillT × 8px lateral Y spread in LAYER 2 (clone spawn arms-out)
  Auto  → wanchaiEntryT × −0.2 rad lean-back burst at activation window
           wanchaiEntryT = max(0, (skillT − (wanchaiDuration−0.4)) / 0.4)
  Poom  → skillT × −10px extra Y lift in LAYER 2 (ritual/garuda arms raise)
           ritual(1.0) raises higher than garuda(0.6) automatically
  Pat   → iaidoLean = min(0.28, skillT/iaidoMaxT * 0.28) rad forward lean in LAYER 1
           replaces runLean during isCharge phase only

Guard pattern — always check before accessing:
  ✅  if (entity._anim) entity._anim.shootT = 1;
  ✅  const sT = entity._anim?.shootT ?? 0;
---

17. HitStop System — triggerHitStop()

window.triggerHitStop(duration) — defined in game.js, exported to window.*

  ✅  triggerHitStop(0.04)   // seconds — use for punch crits
  ✅  triggerHitStop(0.09)   // seconds — use for Iaido kill
  ❌  triggerHitStop(40)     // ms — old pattern, backward-compat shim exists but avoid

Rules:
- Does NOT modify main deltaTime — sets GameState.hitStopTimer only
- Does NOT downgrade: if existing hitStopTimer > new duration, keeps old (no regression)
- Hard-capped to 0.5s in implementation — values above are silently clamped
- No-op if typeof triggerHitStop === 'undefined' (safe to call before game.js loads with guard)

Call sites (Phase 3.1 complete):
  AutoPlayer — Wanchai Punch (R) crit:    triggerHitStop(0.04)
  AutoPlayer — Stand Rush (L-click) crit: triggerHitStop(0.04)
  PatPlayer  — Iaido Strike (R):          triggerHitStop(isCrit ? 0.09 : 0.07)

---

18. File Header Documentation Plan — Module-level JSDoc

Goal: Every JS file in the project gets a module-level JSDoc header so AI assistants
can navigate the codebase without loading file bodies.

Header format (established pattern from this project):
  /**
   * js/path/to/file.js
   * ════════════════════════════════════════════════
   * One-line purpose + owner summary
   *
   * Design notes / load order / integration points
   *
   * ── TABLE OF CONTENTS ────────────────────────
   *  L.N  ClassName / functionName     brief role
   *  ⚠️  Critical pitfall note
   *
   * ════════════════════════════════════════════════
   */

Status: ✅ ALL files complete as of March 13, 2026 — every JS file in the project has a header.

Batch capacity guide (to avoid context overflow per prompt):
  Large files (1500+ lines): 1 file per prompt
  Medium files (300–800 lines): 3–4 files per prompt
  Small files (<300 lines): 5–6 files per prompt

When writing a header, always:
  1. Read the actual file first — never guess line numbers
  2. List ⚠️ pitfalls discovered during prior sessions (check §Common Debugging Solutions in PROJECT_OVERVIEW.md)
  3. Note load order dependencies
  4. Mark exports: window.Xxx = Xxx pattern

Header maintenance protocol:
  A header becomes stale when:
    - A new class or top-level function is added to the file
    - An existing function is moved, renamed, or removed
    - A new ⚠️ pitfall or bug fix is discovered in a session
    - A BALANCE key, config block, or integration point changes
    - A file's line count shifts by more than ~20 lines (L.N references drift)

  When any of the above happens in a session:
    1. Identify which header section(s) are now wrong (TOC line numbers, notes, integration list)
    2. Read the affected file section with grep/view to get current line numbers
    3. Output a targeted str_replace for the stale block only — never rewrite the whole header
    4. Update §18 status date if a full re-pass was done

  Trigger phrases that should prompt a header check:
    "added X to file Y", "moved function", "refactored", "new skill/boss/character",
    "file changed", "line numbers shifted", "update the header"

  What NOT to update proactively:
    - Do not re-scan headers on every session — only when the file itself changed
    - Do not bump L.N numbers for trivial whitespace/comment-only edits

---

19. Performance Invariants — อย่าละเมิด

These rules apply to every file in the project. Violating any one of them causes
GC stutter or frame budget overrun at 40+ enemies.

── Draw path: zero allocation ──────────────────────────────────────────────────

  ❌  ctx.strokeStyle = `rgba(255,100,20,${alpha})`;   // string alloc every frame
  ✅  ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#ff6414';                    // solid hex — engine-interned

  Rule: ห้าม template literal หรือ string concatenation ที่มี dynamic value ใน draw()
  ทดแทนด้วย ctx.globalAlpha + solid RGB/hex string เสมอ
  ⚠️ ctx.globalAlpha เป็น sticky state — reset เป็น 1 ก่อน draw call ถัดไปที่ไม่ใช้ alpha

── Viewport culling — cull ก่อน run draw logic ใดๆ ──────────────────────────

  ทุก entity draw() ต้องมี cull guard ก่อน sub-method ใดๆ ทำงาน:
  const screen = worldToScreen(e.x, e.y);
  const R = (e.radius ?? 20) + 40;
  if (screen.x < -R || screen.x > CANVAS.width + R ||
      screen.y < -R || screen.y > CANVAS.height + R) return;

  ไฟล์ที่มี cull guard แล้ว (อย่า remove): EnemyRenderer, BossRenderer, Decal,
  Particle, FloatingText, OrbitalParticle, ShellCasing, MapSystem objects, hex grid
  ไฟล์ที่ player always on-screen (ไม่ต้อง cull): PlayerRenderer

── SpatialGrid — integer key เท่านั้น ─────────────────────────────────────────

  ❌  key = `${cx},${cy}`          // string alloc ×(N enemies + 9×P projectiles)/frame
  ✅  _cellKey(cx, cy) { return ((cx & 0xFFFF) << 16) | (cy & 0xFFFF); }

  query() reuse _results buffer — ห้าม new [] ต่อ call:
  ✅  this._results.length = 0; ... return this._results;
  ⚠️  caller ต้อง consume results ก่อน call query() อีกครั้ง (buffer ถูก overwrite)

  build() pool cell arrays — ห้าม new [] ต่อ unique cell:
  ✅  cell = this._pool.length > 0 ? this._pool.pop() : [];
      (on clear: push back to _pool, not discarded)

── Entity removal: swap-and-pop เท่านั้น ───────────────────────────────────────

  ❌  arr.splice(i, 1)             // O(N) shift ทุก remove
  ✅  arr[i] = arr[arr.length - 1]; arr.length--;   // O(1), ใช้ทั่ว codebase

── Particle spawn: pool wrapper เท่านั้น ────────────────────────────────────────

  ❌  new Particle(...)            // bypasses pool → GC pressure
  ❌  new FloatingText(...)
  ✅  spawnParticles(x, y, count, color)    // utils.js wrapper → pool
  ✅  floatingTextSystem.spawn(...)         // pool path

── ไม่มี Math.random() ใน draw() ───────────────────────────────────────────────

  random ใส่ได้แค่ใน spawn/init เท่านั้น — draw() ต้องเป็น deterministic

── Performance Audit Checklist — ใช้ก่อน add feature ใหม่ที่มี draw path ─────

  1. draw() path มี template literal หรือ string concat dynamic value ไหม?
     → เปลี่ยนเป็น globalAlpha + solid string
  2. entity loop มี splice() ไหม?
     → เปลี่ยนเป็น swap-and-pop
  3. new Particle / new FloatingText โดยตรงไหม?
     → เปลี่ยนเป็น pool wrapper
  4. SpatialGrid key เป็น integer ไหม?
     → ห้ามใช้ template literal key
  5. entity draw มี cull guard ไหม?
     → เพิ่มก่อน draw logic ใดๆ

── การวางแผน performance session ใหม่ ──────────────────────────────────────────

  ลำดับความสำคัญตามผลกระทบจริง (จากประสบการณ์ codebase นี้):
  TIER 1  draw path string allocs (ทุก frame × ทุก entity on-screen) — สูงสุด
  TIER 2  entity remove O(N) splice ใน hot loop — สูง
  TIER 3  new [] / new object ต่อ call ใน query path — กลาง
  TIER 4  instanceof ใน dispatch loop — ต่ำ (prototype chain walk 1x/entity)
          ยกเว้น N > 50 entities ต่อ frame ถึงจะพิจารณา type flag

  ไฟล์ที่ audit ก่อนเสมอ (impact สูงสุด):
    enemy.js, effects.js, map.js, weapons.js (SpatialGrid), ui.js (minimap)
  ไฟล์ที่ audit ทีหลัง:
    game.js (splice audit), boss_attacks_*.js (particle spawn path)
  ไฟล์ที่ไม่ต้อง audit บ่อย:
    BossRenderer.js (single boss, low entity count), PlayerRenderer.js (always on-screen)

---

20. HUD Emoji Architecture — Single Source of Truth

All skill-slot emoji live in GAME_TEXTS.hudEmoji (config.js).
Read through UIManager._E(group, key) — never hardcode emoji strings in ui.js directly.

Groups:
  attack  — L-Click slot  { poom, auto, pat, default }
  skill1  — R-Click slot  { poom, auto, kao, pat, default }
  q       — Q slot        { kao, auto, pat, poom }
  e       — E slot        { kao, auto, poom, pat }
  r       — R slot        { poom }
  mobile  — btn-skill     { poom, auto, kao, pat, default }

_E() fallback chain: hudEmoji[group][key] → hudEmoji[group]['default'] → ''
  ✅  UIManager._E('q', 'pat')          // reads config, falls back gracefully
  ❌  emojiEl.textContent = '🌪️';      // hardcoded — breaks when config changes

Tooltip sync — static HTML tooltip spans carry data attributes:
  <span class="tt-icon" data-emoji-group="q" data-emoji-key="pat">🌪️</span>
  UIManager.patchTooltipEmojis() — called once in initSkillNames(), patches all [data-emoji-group] spans
  Fallback emoji stays in HTML so tooltip renders correctly before JS runs.
  ⚠️ Passive/mechanic rows (DASH Kao 🌫️, HEAT Auto 🌡️, AUTO Pat 🗡️) have NO data-emoji-group
     — they are intentionally static and not driven by config.

---

21. UIManager CSS Injection Architecture

All skill-icon CSS (cooldown overlay, buff states, animations) is injected once via:
  UIManager.injectCooldownStyles()  // no-op after first call — safe to call every frame

This is the ONLY place to add new .skill-icon CSS rules or @keyframes.
Pattern for a new buff-active visual state:
  1. Add @keyframes + .xxx-buff-active class inside injectCooldownStyles() s.textContent
  2. In the relevant _updateIconsXxx() method: classList.toggle('xxx-buff-active', isActive)
  3. Drain bar: querySelector('.xxx-buff-bar') → create once, update width every frame, remove when inactive

Poom eat-buff reference implementation (established pattern):
  CSS:  @keyframes mtc-eat-pulse (emerald glow pulse 1.1s ease-in-out)
        .eat-buff-active  — animation + border color override
        .eat-buff-bar     — absolute 3px bottom strip, width driven by timer/duration ratio
  Logic (in _updateIconsPoom, runs every frame):
    eating = player.isEatingRice
    classList.toggle('eat-buff-active', eating)
    bar.style.width = (eatRiceTimer / eatRiceDuration * 100) + '%'
    nameEl.textContent = eating ? timer.toFixed(1)+'s' : 'EAT RICE'
  ⚠️ bar element is created lazily on first active tick and removed on deactivation — never pre-create
---

22. Dev Mode — applyDevBuff() Architecture

applyDevBuff() lives in PlayerBase.js. It replaces the old per-character passive unlock
with a stat-package buff that applies immediately when triggered.

  Trigger:  AdminSystem `devbuff` console command → window.player.applyDevBuff()
  Pattern:  reads BALANCE.characters[this.charId] + hard-coded boost ratios
  Effect:   HP/EN/Speed/Damage multipliers — NOT permanent, does not persist on restart

Structure invariant:
  applyDevBuff() must guard on charId for any char-specific branch:
  ✅  if (this.charId === 'pat') { /* katana-specific buff */ }
  ❌  instanceof PatPlayer  — violates no-instanceof-in-PlayerBase rule (§Architecture)

Adding a new character:
  - Default buff in applyDevBuff() base path covers most cases
  - Only add charId branch when the character has a mechanic that needs special seeding
    (e.g., pre-filling Pat's Blade Guard charge, pre-unlocking Poom's Lv2 passive)

AdminSystem integration:
  ✅  case 'devbuff': if (window.player) window.player.applyDevBuff(); break;
  — The command is permission-gated at OPERATOR level — no ROOT required

---

23. PatPlayer — Architectural Invariants

takeDamage() override:
  PatPlayer overrides takeDamage() with an _invincibleTimer guard.
  Any character-level i-frame (point-blank Iaido, Perfect Parry) sets this._invincibleTimer = N.
  The override fires BEFORE super.takeDamage() — do NOT add i-frame logic inside PlayerBase.takeDamage().

  ✅  // In PatPlayer.js:
      takeDamage(amt, attacker) {
          if (this._invincibleTimer > 0) return;
          super.takeDamage(amt, attacker);
      }
  ❌  Do NOT add _invincibleTimer logic to PlayerBase — it is Pat-specific

tryReflectProjectile() — dual-path architecture:
  Two distinct paths keyed on which flag is true at call time:
    _perfectParryArmed = true  → Perfect Parry path (tap < perfectParryWindow seconds)
    bladeGuardActive = true    → Normal Guard path (hold ≥ perfectParryWindow seconds)

  Both paths MUST set all three ownership flags on the projectile:
    proj.vx *= -1;  proj.vy *= -1;
    proj.owner = 'player';
    proj.team  = 'player';
    proj.isReflected = true;   ← renderer uses this to keep original enemy visual/color

  proj.isReflected = true is CRITICAL — without it the renderer may recolor the projectile
  to the player's bullet color (e.g., Kao's blue auto rounds) on the frame after reflect.

Iaido boss hit:
  _executeIaidoFlash() checks window.boss AFTER the enemy loop.
  Hit detection uses segment-to-point distance (same algorithm as enemy hit).
  boss.radius falls back to 50px if undefined.
  ❌  Do NOT guard with if (!window.boss.isInvincible()) — bosses handle their own invincibility
      inside takeDamage(); the caller should not skip the call.

---

24. specialEffects[] — update() Signature Contract

game.js loop:
  for (let i = window.specialEffects.length - 1; i >= 0; i--) {
      const remove = window.specialEffects[i].update(dt, window.player, window.meteorZones, window.boss);
      ...
  }

Positional args (fixed — do NOT reorder):
  arg 0: dt
  arg 1: player
  arg 2: meteorZones  ← MeteorStrike and others consume this; must stay at position 2
  arg 3: boss         ← optional; effects that don't need boss ignore it

When writing a new specialEffect class that needs to interact with the boss:
  ✅  update(dt, player, _meteorZones, boss) { ... }   // accept _meteorZones even if unused
  ❌  update(dt, player, boss)                         // wrong position — boss arrives at arg 2 slot

DeadlyGraph._reflected flag (established pattern):
  When a specialEffect changes "team" mid-flight (e.g., reflected back at boss),
  use a _reflected boolean flag rather than changing ownership fields.
  Guard every player-damage and boss-damage branch independently:
    if (!this._reflected) { /* damage player */ }
    if (this._reflected && boss) { /* damage boss */ }
  _reflected must be set BEFORE the next update() tick — set it in the reflect hook in game.js,
  not inside update().

---

25. GameState Singleton — Property Migration

State that was previously scattered across bare `window.*` globals now lives on the
`GameState` singleton (js/systems/GameState.js). The migration is in progress.

Properties on GameState (use GameState.xxx in new code — NOT window.isGlitchWave etc.):
  GameState.phase              // 'PLAYING'|'PAUSED'|'GAMEOVER'|etc.
  GameState.hitStopTimer       // freeze-frame remaining time (seconds)
  GameState.timeScale          // bullet-time multiplier (1.0 = normal)
  GameState.isSlowMotion       // bool — driven by TimeManager
  GameState.loopRunning        // rAF loop guard
  GameState.waveSpawnLocked    // glitch-wave spawn lock
  GameState.waveSpawnTimer     // countdown before locked spawn releases
  GameState.lastGlitchCountdown // last displayed countdown tick
  GameState.pendingSpawnCount  // enemies queued during lock
  GameState.isGlitchWave       // glitch visual active (read here, written by WaveManager)
  GameState.glitchIntensity    // 0→1 ramp — game.js drives this each frame
  GameState.controlsInverted   // bool — written by WaveManager, read by game.js

Properties still on window.* (NOT migrated — use window.xxx):
  window.enemies               // live enemy array
  window.boss                  // current boss instance (null between waves)
  window.player                // current player instance (null between runs)
  window.specialEffects        // active special-effect instances
  window.meteorZones           // active meteor damage zones
  window.isTrickleActive       // WaveManager trickle spawn in progress
  window.bossEncounterCount    // deterministic boss queue counter

Compat aliases (window.gameState / GameState.loopRunning) exist for backward compat
during transition — do NOT add new code that depends on these aliases.

Rules:
  ✅  if (GameState.phase === 'PLAYING') { ... }
  ✅  GameState.hitStopTimer = capped;
  ❌  window.isGlitchWave      // stale pattern — read GameState.isGlitchWave
  ❌  window.hitStopTimer      // never existed on window — silently undefined

Split-ownership warning (WaveManager ↔ game.js):
  WaveManager still WRITES isGlitchWave / controlsInverted via window.isGlitchWave = true,
  but game.js READS them via GameState.isGlitchWave. GameState._syncAliases() bridges this.
  ❌ Do NOT read window.isGlitchWave in new code — use GameState.isGlitchWave
  ❌ Do NOT write GameState.isGlitchWave from WaveManager — the sync direction is one-way