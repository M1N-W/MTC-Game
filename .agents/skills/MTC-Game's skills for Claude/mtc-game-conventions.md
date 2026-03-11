---
name: mtc-game-conventions
description: "Project-specific conventions, architecture rules, and critical pitfalls for MTC The Game (github.com/M1N-W/MTC-Game). Use this skill at the start of EVERY task involving this codebase. Trigger on: MTC Game, MTC the game, enemy.js, AutoPlayer, KaoPlayer, PoomPlayer, WanchaiStand, EnemyBase, UtilityAI, SquadAI, BossBase, ManopBoss, FirstBoss, PlayerRenderer, BossRenderer, WaveManager, game.js, config.js BALANCE, MTC Room, GravitationalSingularity, DomainExpansion, weapon system, heat tier, stand meter, ORA combo, vacuum pull, sticky slow, ignite DoT."
---

# MTC The Game — Project Conventions & Critical Pitfalls
Stack: Vanilla JS (ES6+) + HTML5 Canvas 2D + Web Audio API. No frameworks.
Target: 60 FPS | Status: Beta v3.30.8

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
│   └── PoomPlayer
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

  Layer               | File                      | Rate
  --------------------|---------------------------|----------------------
  Individual AI       | UtilityAI.js              | 2Hz (0.5s timer)
  Tactical actions    | EnemyActions.js           | called by UtilityAI
  Player analysis     | PlayerPatternAnalyzer.js  | sample 10Hz / compute 4Hz
  Squad coordination  | SquadAI.js                | 1Hz

Immutable rules:
- AI writes _aiMoveX/_aiMoveY only — never vx/vy directly
- _tickShared() must be first line of every subclass update()
- BossBase has no update() — Boss AI goes in ManopBoss/FirstBoss directly
- Retreat always beats squad role override

game.js integration:
  if (typeof playerAnalyzer !== 'undefined' && window.boss && !window.boss.dead) {
      playerAnalyzer.sample(dt, window.player, window.boss);
      playerAnalyzer.update(dt);
  }
  if (typeof squadAI !== 'undefined') squadAI.update(dt, window.enemies, window.player);

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

PlayerRenderer — Layer Order:
  Layer 1: Body    ctx.save() → translate(screen+recoil+bob) → scale(stretch×facing) → body → ctx.restore()
  Layer 2: Weapon  ctx.save() → translate(screen+recoil+bob) → rotate(angle) → weapon → ctx.restore()

Variable declaration order — declare BEFORE dash ghost loop:
  ✅  const moveT = ..., bobY = ..., stretchX = ..., stretchY = ..., R = ...;
      for (const ghost of this._dashGhosts) { ... }   // uses those vars
  ❌  declare after ghost loop → ReferenceError

No Math.random() in draw() — deterministic rendering only.

All PlayerRenderer and BossRenderer methods are static — call as:
  PlayerRenderer._drawKao(entity, ctx)
  BossRenderer.drawBoss(e, ctx)
Never instantiate these classes.

Muzzle Offsets (shootSingle in weapons.js):
  Character | Weapon            | Offset
  ----------|-------------------|-------
  Kao       | Auto rifle        | 49px
  Kao       | Sniper            | 69px
  Kao       | Shotgun           | 45px
  Poom      | Spirit gun        | 43px
  Auto      | Thermodynamic     | 51px

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

---

10. Poom Special Cases

- Poom bypasses WeaponSystem entirely — shoots via PoomPlayer.shoot() directly
- Ritual (R) has no energy cost — combo finisher with CD + stack requirement
- E/R/Q routing: all in PoomPlayer.update(); eatRice (R-Click) routed from game.js
- Never add Q-consume block in game.js for Poom — skips cooldown

---

11. AutoPlayer Heat Tier System

  Tier      | Range   | Effect
  ----------|---------|----------------------------------------
  COLD      | 0–33%   | dmg ×0.75, speed ×0.90
  WARM      | 34–66%  | dmg ×1.10, punch rate ×0.92
  HOT       | 67–99%  | dmg ×1.20, punch rate ×0.85
  OVERHEAT  | 100%    | dmg ×1.30, crit +12%, HP drain 5/s

Config keys: heatDmgWarm/Hot/Overheat, coldDamageMult, heatPunchRateWarm/Hot
⚠️ AutoPlayer.js fallback values (??) must match config.js — source of truth is config.js.
   Pre-nerf fallbacks (1.50/1.30/1.15/0.70) were fixed in AutoPlayer.js to match current config.

Wanchai (R-Click) active changes Q: Stand Pull (range 380px, 18 dmg/enemy) instead of Vacuum Pull.
Both use this.cooldowns.vacuum slot — Stand Pull sets it to standPullCooldown (10s),
Vacuum sets it to vacuumCooldown (6s). HUD arc max must be dynamic (already implemented).

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

---

13. Adding New Content — Checklist

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
Also update: sw.js → CHANGELOG.md → README-info.md → PROJECT_OVERVIEW.md (status line)

Version bump ownership: Windsurf (commit time) bumps ALL files in one pass.
Claude must NOT write version numbers into files — use [NEXT VERSION] as placeholder.
