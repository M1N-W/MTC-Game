"use strict";
/**
 * js/entities/enemy.js
 * ════════════════════════════════════════════════════════════════════════════
 * Enemy runtime classes, effects, and registry definitions for MTC The Game.
 * Contains: EnemyBase (foundation), Enemy/TankEnemy/MageEnemy (base types),
 * 10+ expanded enemy types (Sniper, Charger, Healer, etc.), status effects,
 * and the PowerUp loot system.
 *
 * EnemyRenderer lives in js/rendering/EnemyRenderer.js and loads after this file.
 *
 * @module js/entities/enemy
 * @fileoverview Enemy entity classes, effects, and registry
 *
 * Load order: Must load after base.js, config.js (BALANCE), effects.js
 *             Must load before EnemyRenderer.js (renderer needs classes defined)
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────────────
 *  L.25   HIT_FLASH_DURATION         Tunable: seconds hit-flash stays full
 *  L.37   GLITCH_DAMAGE_MULT         Glitch Wave contact damage reduction
 *  L.133  _enemyIdCounter            Unique ID generator for sticky tracking
 *  L.139  class EnemyBase            Foundation class (extends Entity)
 *  L.1237 class Enemy                Basic ranged enemy (extends EnemyBase)
 *  L.1705 class TankEnemy            Heavy melee bruiser (extends EnemyBase)
 *  L.2011 class MageEnemy            Ranged caster with confusion (extends EnemyBase)
 *  L.2431 function _enemyCfg()       BALANCE.enemies accessor helper
 *  L.2449 function _scaledEnemyValue Wave-scaled stat calculator
 *  L.2473 function _setupExpandedEnemy  Enemy initialization helper
 *  L.2524 function _expandedEnemyDeath  Common death FX/scoring handler
 *  L.2644 class PoisonPoolEffect     Ground DOT effect from spitter
 *  L.2818 class FatalityExplosionEffect  Delayed bomb explosion FX
 *  L.2974 class SniperEnemy         Precision ranged (extends Enemy)
 *  L.3181 class ShieldBraverEnemy    Frontal damage reduction (extends TankEnemy)
 *  L.3307 class PoisonSpitterEnemy  Pool spawner (extends Enemy)
 *  L.3445 class ChargerEnemy        Rush attack enemy (extends Enemy)
 *  L.3664 class HunterEnemy         Stealth striker (extends Enemy)
 *  L.3784 class FatalityBomberEnemy Walking bomb (extends Enemy)
 *  L.3859 class HealerEnemy         Ally healer (extends Enemy)
 *  L.3976 class SummonedMinionEnemy Temporary minion (extends Enemy)
 *  L.4081 class SummonerEnemy       Spawns minions (extends Enemy)
 *  L.4198 class BufferEnemy          Ally buffer (extends Enemy)
 *  L.4354 class PowerUp             Loot pickup (heal/dmg/speed)
 *  L.4600 window.Enemy              Global export
 *  L.4645 window.ENEMY_REGISTRY     Constructor mapping for spawners
 *
 * ── EXPORTS (window.*) ──────────────────────────────────────────────────
 *   window.Enemy, window.EnemyBase, window.TankEnemy, window.MageEnemy
 *   window.SniperEnemy, window.ShieldBraverEnemy, window.PoisonSpitterEnemy
 *   window.ChargerEnemy, window.HunterEnemy, window.FatalityBomberEnemy
 *   window.HealerEnemy, window.SummonerEnemy, window.BufferEnemy
 *   window.SummonedMinionEnemy, window.PowerUp, window.ENEMY_REGISTRY
 *
 * ⚠️  EnemyBase uses HealthComponent — subclasses must call super() before
 *     accessing this.health or proxy getters (hp/maxHp/dead) will fail.
 * ⚠️  EnemyBase constructor creates this.cooldowns — do NOT shadow in subclass.
 * ⚠️  _enemyIdCounter is file-local — never reset mid-session or sticky stacks break.
 * ⚠️  Glitch damage mult (GLITCH_DAMAGE_MULT) only applies to contact damage,
 *     NOT projectile damage — check window.isGlitchWave before applying.
 * ⚠️  PowerUp.collect() must run on player collision — item auto-removes after.
 * ════════════════════════════════════════════════════════════════════════════
 */

// ─── Tunable: seconds a hit-flash stays at full opacity before fading out ───


// At 0.10 s (≈ 6 frames @ 60 fps) the flash is snappy but legible.


const HIT_FLASH_DURATION = 0.1;





// ─── Tunable: enemy contact damage multiplier during a Glitch Wave ──────────


// 0.6 = 40 % reduction. Applies only to melee contact (not projectiles).


const GLITCH_DAMAGE_MULT = 0.6;





// ════════════════════════════════════════════════════════════


// ENEMY BASE — shared foundation for all enemy types


// ════════════════════════════════════════════════════════════


// Inherit from this (not Entity) when creating new enemy classes.


// Provides automatically:


//   • Unique ID               (this.id)


//   • StatusEffect framework  (addStatus / removeStatus / getStatus / tickStatuses)


//   • UtilityAI               (this._ai, this._aiMoveX, this._aiMoveY)


//   • Hit-flash state         (this.hitFlashTimer)


//   • Sticky-slow state       (this.stickyStacks, this.stickySlowMultiplier)


//


// Minimal new-enemy template:


//   class MyEnemy extends EnemyBase {


//       constructor(x, y) {


//           super(x, y, radius, 'basic'); // last arg = personality type


//           // set this.hp, this.speed, this.damage, this.type, this.expValue ...


//       }


//       update(dt, player) {


//           if (this.dead) return;


//           this._tickShared(dt, player); // handles StatusEffect + AI + hitFlash + ignite


//           // your movement + attack logic here


//       }


//       takeDamage(amt, player) {


//           super.takeDamage(amt, player); // handles flash + death particles (override _onDeath if needed)


//       }


//   }


// ════════════════════════════════════════════════════════════





// ── Phase 2: Unique enemy ID counter for sticky stack tracking ──


// Incremented on every enemy construction. Never reused within a session.


let _enemyIdCounter = 0;





class EnemyBase extends Entity {


  /**


   * @param {number} x


   * @param {number} y


   * @param {number} radius


   * @param {string} personalityType — 'basic' | 'tank' | 'mage' (for UtilityAI)


   */


  constructor(x, y, radius, personalityType) {


    super(x, y, radius);





    // Unique ID — never reused within a session


    this.id = ++_enemyIdCounter;





    // ── Hit flash ─────────────────────────────────────────


    this.health = new HealthComponent(100, HIT_FLASH_DURATION);


    // Proxy getters — call sites เริ่มต้น (this.hp, this.dead) ทำงานปกติ





    // ── Sticky slow ───────────────────────────────────────


    this.stickyStacks = 0;


    this.stickySlowMultiplier = 1;





    // ── StatusEffect Framework ────────────────────────────


    this.statusEffects = new Map();


    this._statusToRemove = [];





    // ── UtilityAI ─────────────────────────────────────────


    // Safe to construct even if UtilityAI.js not yet loaded (guard below).


    // personalityType drives aggression/caution/teamwork weights.


    this._ai =


      typeof UtilityAI !== "undefined"


        ? new UtilityAI(this, personalityType || "basic")


        : null;


    // AI movement override — written by UtilityAI, read in subclass update()


    // Never conflicts with vacuum/sticky: those write vx/vy directly


    this._aiMoveX = 0;


    this._aiMoveY = 0;


    this._enemySpeedBuff = 1;


    this._enemySpeedBuffTimer = 0;


    this._enemyDamageBuff = 1;


    this._enemyDamageBuffTimer = 0;


  }





  // ── Proxy getters — keep call sites backward-compatible ──


  get hp() { return this.health.hp; }


  set hp(v) { this.health.hp = v; }


  get maxHp() { return this.health.maxHp; }


  set maxHp(v) { this.health.maxHp = v; }


  get dead() { return this.health.dead; }


  set dead(v) { this.health.dead = v; }


  get hitFlashTimer() { return this.health.hitFlashTimer; }


  set hitFlashTimer(v) { this.health.hitFlashTimer = v; }





  // ─────────────────────────────────────────────────────────


  // _tickShared — call at top of every subclass update()


  // Handles: StatusEffects, hitFlash decay, ignite DoT, AI tick


  // ─────────────────────────────────────────────────────────


  _tickShared(dt, player) {


    this.tickStatuses(dt);





    // Sticky slow multiplier


    const stickyStatus = this.getStatus("sticky");


    if (stickyStatus && stickyStatus.meta) {


      const slowPerStack = stickyStatus.meta.slowPerStack || 0.04;


      this.stickySlowMultiplier = Math.max(


        0.2,


        1 - slowPerStack * stickyStatus.stacks,


      );


      this.stickyStacks = stickyStatus.stacks;


    }





    // Hit flash decay


    this.health.tick(dt);





    // Ignite DoT (applied by AutoPlayer Vacuum Heat)


    if ((this.igniteTimer ?? 0) > 0) {


      this.igniteTimer -= dt;


      this.takeDamage((this.igniteDPS ?? 12) * dt);


      if (this.igniteTimer <= 0) {


        this.igniteTimer = 0;


        this.igniteDPS = 0;


      }


    }





    // ── Elemental Reaction: IGNITE + SLOW → SHATTER ───────────────


    // Triggers when ignited enemy is also significantly slowed (sticky ≈3 stacks


    // OR PhysicsFormulaZone slow detected via stickySlowMultiplier < 0.65).


    // One reaction per ignite application — flag _shatterUsed prevents repeat.


    if ((this.igniteTimer ?? 0) > 0 && !this._shatterUsed) {


      const isSlowed = this.stickySlowMultiplier < 0.65 || (this.stickyStacks ?? 0) >= 3;


      if (isSlowed) {


        this._shatterUsed = true;


        const shatterDmg = (this.igniteDPS ?? 12) * 2.5; // 2.5× ignite DPS as burst


        this.takeDamage(shatterDmg);


        this.igniteTimer = 0; // consume ignite


        this.igniteDPS = 0;


        // Brief stun — write AI stun directly (safe per architecture rules)


        this._shatterStunTimer = 0.4;


        if (typeof spawnFloatingText === 'function')


          spawnFloatingText('💥 SHATTER!', this.x, this.y - 50, '#f0abfc', 22);


        if (typeof spawnParticles === 'function')


          spawnParticles(this.x, this.y, 14, '#f0abfc');


      }


    }


    // Reset shatter flag when ignite expires naturally


    if ((this.igniteTimer ?? 0) <= 0) this._shatterUsed = false;





    // ── Shatter stun tick ─────────────────────────────────────────


    if ((this._shatterStunTimer ?? 0) > 0) {


      this._shatterStunTimer -= dt;


      this._aiMoveX = 0;


      this._aiMoveY = 0;


    }





    if ((this._enemySpeedBuffTimer ?? 0) > 0) {


      this._enemySpeedBuffTimer -= dt;


      if (this._enemySpeedBuffTimer <= 0) {


        this._enemySpeedBuffTimer = 0;


        this._enemySpeedBuff = 1;


      }


    }


    if ((this._enemyDamageBuffTimer ?? 0) > 0) {


      this._enemyDamageBuffTimer -= dt;


      if (this._enemyDamageBuffTimer <= 0) {


        this._enemyDamageBuffTimer = 0;


        this._enemyDamageBuff = 1;


      }


    }





    // UtilityAI decision tick (throttled to 2Hz internally)


    if (this._ai) this._ai.tick(dt, player, window.enemies);


  }





  // ─────────────────────────────────────────────────────────


  // StatusEffect Framework (single authoritative copy)


  // ─────────────────────────────────────────────────────────





  addStatus(type, data) {


    const existing = this.statusEffects.get(type);


    // Convert legacy expireAt (absolute timestamp) → remaining (seconds)


    const incoming =


      data.expireAt !== undefined


        ? data.expireAt - performance.now() / 1000


        : (data.duration ?? 5);


    if (existing) {


      if (data.stacks !== undefined) existing.stacks += data.stacks;


      // Refresh duration: take the longer of current remaining vs incoming


      existing.remaining = Math.max(existing.remaining, incoming);


      if (data.meta) existing.meta = { ...existing.meta, ...data.meta };


      if (data.onApply) existing.onApply = data.onApply;


      if (data.onExpire) existing.onExpire = data.onExpire;


      if (data.onTick) existing.onTick = data.onTick;


    } else {


      const effect = {


        type,


        stacks: data.stacks || 1,


        remaining: incoming,


        meta: data.meta || {},


        onApply: data.onApply,


        onExpire: data.onExpire,


        onTick: data.onTick,


      };


      this.statusEffects.set(type, effect);


      if (effect.onApply) effect.onApply(this, effect);


    }


  }





  removeStatus(type) {


    const effect = this.statusEffects.get(type);


    if (effect) {


      if (effect.onExpire) effect.onExpire(this, effect);


      this.statusEffects.delete(type);


    }


  }





  getStatus(type) {


    return this.statusEffects.get(type) || null;


  }





  tickStatuses(dt) {


    this._statusToRemove.length = 0;


    for (const [type, effect] of this.statusEffects) {


      effect.remaining -= dt;


      if (effect.remaining <= 0) {


        this._statusToRemove.push(type);


        continue;


      }


      if (effect.onTick) effect.onTick(this, effect, dt);


    }


    for (let i = 0; i < this._statusToRemove.length; i++) {


      this.removeStatus(this._statusToRemove[i]);


    }


  }





  // ─────────────────────────────────────────────────────────


  // Base takeDamage — triggers hit flash, disposes AI on death


  // Subclasses call super.takeDamage(amt, player) or override fully


  // ─────────────────────────────────────────────────────────


  takeDamage(amt, player) {


    // Wire _onDeathCb once (cheap — same reference check)


    if (!this.health._onDeathCb) {


      this.health._onDeathCb = (killer) => {


        if (this._ai) { this._ai.dispose(); this._ai = null; }


        this._onDeath(killer);


      };


    }


    this.health.takeDamage(amt, player);


  }





  heal(amt) {


    if (!this.health) return;


    this.health.heal(amt);


  }





  getMoveSpeed(mult = 1) {


    return (this.speed || 0) * (this._enemySpeedBuff || 1) * mult;


  }





  getAttackDamage(mult = 1) {


    return (this.damage || 0) * (this._enemyDamageBuff || 1) * mult;


  }





  tickCooldown(prop, dt) {


    this[prop] = Math.max(0, (this[prop] || 0) - dt);


    return this[prop];


  }





  hasLineOfSightTo(target, maxDist) {


    if (!target) return false;


    const dx = target.x - this.x;


    const dy = target.y - this.y;


    const total = Math.hypot(dx, dy) || 1;


    if (maxDist && total > maxDist) return false;


    if (typeof mapSystem === 'undefined' || typeof mapSystem.queryNearby !== 'function') return true;





    const step = 48;


    const steps = Math.max(1, Math.floor(total / step));


    for (let i = 1; i < steps; i++) {


      const t = i / steps;


      const px = this.x + dx * t;


      const py = this.y + dy * t;


      const objs = mapSystem.queryNearby(px, py, 24);


      for (let j = 0; j < objs.length; j++) {


        const obj = objs[j];


        if (!obj || !obj.solid) continue;


        if (px >= obj.x && px <= obj.x + obj.w && py >= obj.y && py <= obj.y + obj.h) {


          return false;


        }


      }


    }


    return true;


  }





  isFrontHit(attacker, cosThreshold = 0.15) {


    if (!attacker) return false;


    const ax = attacker.x - this.x;


    const ay = attacker.y - this.y;


    const ad = Math.hypot(ax, ay) || 1;


    const fx = Math.cos(this.angle || 0);


    const fy = Math.sin(this.angle || 0);


    return ((ax / ad) * fx + (ay / ad) * fy) >= cosThreshold;


  }





  findLowestHpAlly(range, ratioThreshold = 0.85, options = null) {


    if (typeof window === 'undefined' || !window.enemies) return null;


    const maxRange = range || 280;


    const preferFn = typeof options?.prefer === 'function' ? options.prefer : null;


    const acceptFn = typeof options?.accept === 'function' ? options.accept : null;


    const scan = (strictPreference) => {


      let best = null;


      let bestRatio = ratioThreshold;


      for (let i = 0; i < window.enemies.length; i++) {


        const ally = window.enemies[i];


        if (!ally || ally.dead || ally === this) continue;


        if (Math.hypot(ally.x - this.x, ally.y - this.y) > maxRange) continue;


        if (acceptFn && !acceptFn(ally)) continue;


        if (strictPreference && preferFn && !preferFn(ally)) continue;


        const ratio = ally.hp / Math.max(ally.maxHp || 1, 1);


        if (ratio >= bestRatio) continue;


        best = ally;


        bestRatio = ratio;


      }


      return best;


    };


    return scan(true) || scan(false);


  }





  countSpecialEffectsByType(ctor) {


    if (typeof window === 'undefined' || !window.specialEffects || typeof ctor === 'undefined') return 0;


    let count = 0;


    for (let i = 0; i < window.specialEffects.length; i++) {


      if (window.specialEffects[i] instanceof ctor) count++;


    }


    return count;


  }





  countNearbyAllies(range) {


    if (typeof window === 'undefined' || !window.enemies) return 0;


    let count = 0;


    const maxRange = range || 240;


    for (let i = 0; i < window.enemies.length; i++) {


      const ally = window.enemies[i];


      if (!ally || ally.dead || ally === this) continue;


      if (Math.hypot(ally.x - this.x, ally.y - this.y) <= maxRange) count++;


    }


    return count;


  }





  moveByIntent(dt, player, directWeight, aiWeight, closeSlowFactor, pullSpeed, idleDrag) {


    if (!player) return;


    if ((this.vacuumStunTimer ?? 0) > 0) {


      this.vacuumStunTimer -= dt;


      if ((this._vacuumPullTimer ?? 0) > 0) {


        this._vacuumPullTimer -= dt;


        const pvx = (this._vacuumTargetX ?? this.x) - this.x;


        const pvy = (this._vacuumTargetY ?? this.y) - this.y;


        const pd = Math.hypot(pvx, pvy);


        if (pd > 8) {


          this.vx = (pvx / pd) * (pullSpeed || 860);


          this.vy = (pvy / pd) * (pullSpeed || 860);


        } else {


          this.vx *= 0.5;


          this.vy *= 0.5;


        }


      } else {


        this.vx *= idleDrag || 0.85;


        this.vy *= idleDrag || 0.85;


      }


      return;


    }





    if (player.isInvisible) {


      this.vx *= idleDrag || 0.9;


      this.vy *= idleDrag || 0.9;


      return;


    }





    const dx = player.x - this.x;


    const dy = player.y - this.y;


    const distToPlayer = Math.hypot(dx, dy) || 1;


    this.angle = Math.atan2(dy, dx);


    const baseX = Math.cos(this.angle) * (directWeight || 0);


    const baseY = Math.sin(this.angle) * (directWeight || 0);


    const blendX = baseX + this._aiMoveX * (aiWeight || 0);


    const blendY = baseY + this._aiMoveY * (aiWeight || 0);


    const blendLen = Math.hypot(blendX, blendY) || 1;


    const slowFactor = distToPlayer > this.radius + (player.radius || 20)


      ? 1


      : (closeSlowFactor ?? 0.3);


    const speed = this.getMoveSpeed(slowFactor) * this.stickySlowMultiplier;


    this.vx = (blendX / blendLen) * speed;


    this.vy = (blendY / blendLen) * speed;


  }





  // Override in subclass for custom death FX/scoring


  _onDeath(player) { }


}





// ══════════════════════════════════════════════════════════════


// 🌐 EXPORT EnemyBase


// ══════════════════════════════════════════════════════════════


window.EnemyBase = EnemyBase;





// ════════════════════════════════════════════════════════════


// ENEMIES


// ════════════════════════════════════════════════════════════





class Enemy extends EnemyBase {


  constructor(x, y) {


    // EnemyBase handles: id, hitFlashTimer, stickyStacks/Multiplier,


    //                    statusEffects, _ai, _aiMoveX/Y


    super(x, y, BALANCE.enemy.radius, "basic");


    // Exponential HP scaling: baseHp * ((1 + hpPerWave)^wave)


    const hpGrowth = 1 + BALANCE.enemy.hpPerWave;


    this.maxHp = Math.floor(


      BALANCE.enemy.baseHp * Math.pow(hpGrowth, getWave()),


    );


    this.hp = this.maxHp;


    this.speed =


      BALANCE.enemy.baseSpeed + getWave() * BALANCE.enemy.speedPerWave;


    this.damage =


      BALANCE.enemy.baseDamage + getWave() * BALANCE.enemy.damagePerWave;


    this.shootTimer = rand(...BALANCE.enemy.shootCooldown);


    this.color = randomChoice(BALANCE.enemy.colors);


    this.type = "basic";


    this.expValue = BALANCE.enemy.expValue;


  }





  update(dt, player) {


    if (this.dead) return;





    // ── Shared: StatusEffects + hitFlash + ignite + AI tick ──


    this._tickShared(dt, player);





    const dx = player.x - this.x,


      dy = player.y - this.y;


    const d = dist(this.x, this.y, player.x, player.y);


    this.angle = Math.atan2(dy, dx);


    // ── VacuumHeat AI-lock: skip vx/vy override while being pulled ──


    if ((this.vacuumStunTimer ?? 0) > 0) {


      this.vacuumStunTimer -= dt;


      if ((this._vacuumPullTimer ?? 0) > 0) {


        this._vacuumPullTimer -= dt;


        const pvx = (this._vacuumTargetX ?? this.x) - this.x;


        const pvy = (this._vacuumTargetY ?? this.y) - this.y;


        const pd = Math.hypot(pvx, pvy);


        if (pd > 8) {


          this.vx = (pvx / pd) * 860;


          this.vy = (pvy / pd) * 860;


        } else {


          this.vx *= 0.5;


          this.vy *= 0.5;


        }


      } else {


        this.vx *= 0.85;


        this.vy *= 0.85;


      }


    } else {


      if (!player.isInvisible) {


        const baseX = Math.cos(this.angle);


        const baseY = Math.sin(this.angle);


        const blendX = baseX * 0.7 + this._aiMoveX * 0.3;


        const blendY = baseY * 0.7 + this._aiMoveY * 0.3;


        const blendLen = Math.hypot(blendX, blendY) || 1;


        const moveSpeed =


          d > this.radius + (window.player?.radius || 20)


            ? this.getMoveSpeed()


            : this.getMoveSpeed(0.3);


        this.vx = (blendX / blendLen) * moveSpeed * this.stickySlowMultiplier;


        this.vy = (blendY / blendLen) * moveSpeed * this.stickySlowMultiplier;


      } else {


        this.vx *= 0.9;


        this.vy *= 0.9;


      }


    }


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    this.shootTimer -= dt;


    if (


      this.shootTimer <= 0 &&


      d < BALANCE.enemy.shootRange &&


      !player.isInvisible


    ) {


      const _wave = typeof getWave === 'function' ? getWave() : 1;


      const _leadT = Math.min(0.08 + (_wave - 1) * 0.015, 0.25); // 0.08s→0.25s by wave12


      const _pred = (typeof playerAnalyzer !== 'undefined' && _wave >= 4)


        ? playerAnalyzer.predictedPosition(_leadT)


        : null;


      const _aimX = _pred ? _pred.x : player.x;


      const _aimY = _pred ? _pred.y : player.y;


      projectileManager.add(


        new Projectile(


          this.x,


          this.y,


          Math.atan2(_aimY - this.y, _aimX - this.x),  // ← predictive angle


          BALANCE.enemy.projectileSpeed,


          this.getAttackDamage(),


          "#fff",


          false,


          "enemy",


        ),


      );


      this.shootTimer = rand(...BALANCE.enemy.shootCooldown);


    }


    // ── Melee contact damage ─────────────────────────────


    if (d < this.radius + player.radius) {


      const contactDamage = this.getAttackDamage() * dt * 3;


      const glitchMult = window.isGlitchWave ? GLITCH_DAMAGE_MULT : 1.0;


      player.takeDamage(contactDamage * glitchMult);


    }


  }





  // _onDeath: called by EnemyBase.takeDamage() after dead=true + AI disposed


  _onDeath(player) {


    spawnParticles(this.x, this.y, 20, this.color);


    if (typeof decalSystem !== "undefined") {


      decalSystem.spawn(this.x, this.y, "#3b0764", 12 + Math.random() * 6);


    }


    addScore(BALANCE.score.basicEnemy * getWave());


    addEnemyKill();


    Audio.playEnemyDeath();


    // ✨ [bullet_time_kill] นับคิลขณะ Slow-mo


    if (window.isSlowMotion && typeof Achievements !== "undefined") {


      Achievements.stats.slowMoKills++;


      Achievements.check("bullet_time_kill");


    }


    if (player) player.gainExp(this.expValue);


    if (


      player &&


      player.charId === "kao" &&


      typeof player.addKill === "function"


    ) {


      const wepKey =


        typeof weaponSystem !== "undefined"


          ? weaponSystem.currentWeapon || "auto"


          : "auto";


      const currentWep = BALANCE.characters.kao.weapons[wepKey];


      if (currentWep) {


        player.addKill(currentWep.name);


        if (player.passiveUnlocked && !player.isWeaponMaster) {


          const kills = player.weaponKills[wepKey] || 0;


          const req = BALANCE.characters.kao.weaponMasterReq || 10;


          spawnFloatingText(


            `${currentWep.name} ${kills}/${req}`,


            this.x,


            this.y - 40,


            "#facc15",


            14,


          );


        }


      }


    }


    Achievements.stats.kills++;


    Achievements.check("first_blood");


    if (Math.random() < BALANCE.powerups.dropRate)


      window.powerups.push(new PowerUp(this.x, this.y));


  }


  // draw() → EnemyRenderer.drawBasic()


}





// ════════════════════════════════════════════════════════════


// TANK ENEMY — heavy melee bruiser, SquadAI role: SHIELD


// ════════════════════════════════════════════════════════════


class TankEnemy extends EnemyBase {


  constructor(x, y) {


    super(x, y, BALANCE.tank.radius, "tank");


    const hpGrowth = 1 + BALANCE.tank.hpPerWave;


    this.maxHp = Math.floor(


      BALANCE.tank.baseHp * Math.pow(hpGrowth, getWave()),


    );


    this.hp = this.maxHp;


    this.speed = BALANCE.tank.baseSpeed + getWave() * BALANCE.tank.speedPerWave;


    this.damage =


      BALANCE.tank.baseDamage + getWave() * BALANCE.tank.damagePerWave;


    this.color = BALANCE.tank.color;


    this.type = "tank";


    this.expValue = BALANCE.tank.expValue;


  }





  update(dt, player) {


    if (this.dead) return;





    this._tickShared(dt, player);





    const dx = player.x - this.x,


      dy = player.y - this.y;


    const d = dist(this.x, this.y, player.x, player.y);


    this.angle = Math.atan2(dy, dx);


    // ── VacuumHeat AI-lock ──


    if ((this.vacuumStunTimer ?? 0) > 0) {


      this.vacuumStunTimer -= dt;


      if ((this._vacuumPullTimer ?? 0) > 0) {


        this._vacuumPullTimer -= dt;


        const pvx = (this._vacuumTargetX ?? this.x) - this.x;


        const pvy = (this._vacuumTargetY ?? this.y) - this.y;


        const pd = Math.hypot(pvx, pvy);


        if (pd > 8) {


          this.vx = (pvx / pd) * 560;


          this.vy = (pvy / pd) * 560;


        } else {


          this.vx *= 0.5;


          this.vy *= 0.5;


        }


      } else {


        this.vx *= 0.85;


        this.vy *= 0.85;


      }


    } else {


      if (!player.isInvisible) {


        // Tank: 80% base (aggressive), 20% AI steering


        const blendX = Math.cos(this.angle) * 0.8 + this._aiMoveX * 0.2;


        const blendY = Math.sin(this.angle) * 0.8 + this._aiMoveY * 0.2;


        const blendLen = Math.hypot(blendX, blendY) || 1;


        this.vx = (blendX / blendLen) * this.getMoveSpeed() * this.stickySlowMultiplier;


        this.vy = (blendY / blendLen) * this.getMoveSpeed() * this.stickySlowMultiplier;


      } else {


        this.vx *= 0.95;


        this.vy *= 0.95;


      }


    }


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    // ── Melee contact damage ─────────────────────────────


    if (d < BALANCE.tank.meleeRange + player.radius) {


      const contactDamage = this.getAttackDamage() * dt * 2;


      const glitchMult = window.isGlitchWave ? GLITCH_DAMAGE_MULT : 1.0;


      player.takeDamage(contactDamage * glitchMult);


    }


  }





  _onDeath(player) {


    spawnParticles(this.x, this.y, 30, this.color);


    if (typeof decalSystem !== "undefined") {


      decalSystem.spawn(this.x, this.y, "#7f1d1d", 20 + Math.random() * 8, 20);


    }


    addScore(BALANCE.score.tank * getWave());


    addEnemyKill();


    Audio.playEnemyDeath();


    if (player) player.gainExp(this.expValue);


    if (


      player &&


      player.charId === "kao" &&


      typeof player.addKill === "function"


    ) {


      const wepKey =


        typeof weaponSystem !== "undefined"


          ? weaponSystem.currentWeapon || "auto"


          : "auto";


      const currentWep = BALANCE.characters.kao.weapons[wepKey];


      if (currentWep) player.addKill(currentWep.name);


    }


    Achievements.stats.kills++;


    if (


      Math.random() <


      BALANCE.powerups.dropRate * BALANCE.tank.powerupDropMult


    )


      window.powerups.push(new PowerUp(this.x, this.y));


  }


  // draw() → EnemyRenderer.drawTank()


}





// ════════════════════════════════════════════════════════════


// MAGE ENEMY — ranged caster, SquadAI role: SUPPORT


// Attacks: confusion projectile + meteor strike


// ════════════════════════════════════════════════════════════


class MageEnemy extends EnemyBase {


  constructor(x, y) {


    super(x, y, BALANCE.mage.radius, "mage");


    const hpGrowth = 1 + BALANCE.mage.hpPerWave;


    this.maxHp = Math.floor(


      BALANCE.mage.baseHp * Math.pow(hpGrowth, getWave()),


    );


    this.hp = this.maxHp;


    this.speed = BALANCE.mage.baseSpeed + getWave() * BALANCE.mage.speedPerWave;


    this.damage =


      BALANCE.mage.baseDamage + getWave() * BALANCE.mage.damagePerWave;


    this.color = BALANCE.mage.color;


    this.type = "mage";


    this.soundWaveCD = 0;


    this.meteorCD = 0;


    this.expValue = BALANCE.mage.expValue;


  }





  update(dt, player) {


    if (this.dead) return;





    this._tickShared(dt, player);





    const d = dist(this.x, this.y, player.x, player.y),


      od = BALANCE.mage.orbitDistance;


    this.angle = Math.atan2(player.y - this.y, player.x - this.x);


    // ── VacuumHeat AI-lock ──


    if ((this.vacuumStunTimer ?? 0) > 0) {


      this.vacuumStunTimer -= dt;


      if ((this._vacuumPullTimer ?? 0) > 0) {


        this._vacuumPullTimer -= dt;


        const pvx = (this._vacuumTargetX ?? this.x) - this.x;


        const pvy = (this._vacuumTargetY ?? this.y) - this.y;


        const pd = Math.hypot(pvx, pvy);


        if (pd > 8) {


          this.vx = (pvx / pd) * 860;


          this.vy = (pvy / pd) * 860;


        } else {


          this.vx *= 0.5;


          this.vy *= 0.5;


        }


      } else {


        this.vx *= 0.85;


        this.vy *= 0.85;


      }


    } else {


      // Mage: AI steering 25% — orbit logic takes priority


      if (d < od && !player.isInvisible) {


        const baseX = -Math.cos(this.angle);


        const baseY = -Math.sin(this.angle);


        const blendX = baseX * 0.75 + this._aiMoveX * 0.25;


        const blendY = baseY * 0.75 + this._aiMoveY * 0.25;


        const blendLen = Math.hypot(blendX, blendY) || 1;


        this.vx = (blendX / blendLen) * this.getMoveSpeed() * this.stickySlowMultiplier;


        this.vy = (blendY / blendLen) * this.getMoveSpeed() * this.stickySlowMultiplier;


      } else if (d > od + BALANCE.mage.orbitDistanceBuffer) {


        this.vx = Math.cos(this.angle) * this.getMoveSpeed() * this.stickySlowMultiplier;


        this.vy = Math.sin(this.angle) * this.getMoveSpeed() * this.stickySlowMultiplier;


      } else {


        this.vx *= 0.95;


        this.vy *= 0.95;


      }


    }


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    if (this.soundWaveCD > 0) this.soundWaveCD -= dt;


    if (this.meteorCD > 0) this.meteorCD -= dt;


    if (


      this.soundWaveCD <= 0 &&


      d < BALANCE.mage.soundWaveRange &&


      !player.isInvisible


    ) {


      player.isConfused = true;


      player.confusedTimer = BALANCE.mage.soundWaveConfuseDuration;


      spawnFloatingText("CONFUSED!", player.x, player.y - 40, "#a855f7", 20);


      for (let i = 0; i < 360; i += 30) {


        const a = (i * Math.PI) / 180;


        spawnParticles(


          this.x + Math.cos(a) * 50,


          this.y + Math.sin(a) * 50,


          3,


          "#a855f7",


        );


      }


      this.soundWaveCD = BALANCE.mage.soundWaveCooldown;


    }


    if (this.meteorCD <= 0 && Math.random() < 0.005 * dt * 60) {


      // Lead time scales with wave: 0.15s (wave1) → 0.40s (wave10+)


      // Spread shrinks inversely so total difficulty curve stays smooth.


      const _wave = typeof getWave === 'function' ? getWave() : 1;


      const _leadT = Math.min(0.15 + (_wave - 1) * 0.028, 0.40); // caps at wave 10


      const _spread = Math.max(120, 300 - (_wave - 1) * 18);       // 300→120 by wave 11


      const _pred = (typeof playerAnalyzer !== 'undefined' && _wave >= 3)


        ? playerAnalyzer.predictedPosition(_leadT)


        : null;


      const _aimX = _pred ? _pred.x : player.x;


      const _aimY = _pred ? _pred.y : player.y;


      window.specialEffects.push(


        new MeteorStrike(


          _aimX + rand(-_spread, _spread),


          _aimY + rand(-_spread, _spread),


        ),


      );


      this.meteorCD = BALANCE.mage.meteorCooldown;


      Audio.playMeteorWarning();


    }


  }





  _onDeath(player) {


    spawnParticles(this.x, this.y, 25, this.color);


    if (typeof decalSystem !== "undefined") {


      decalSystem.spawn(this.x, this.y, "#4c1d95", 10 + Math.random() * 6, 16);


    }


    addScore(BALANCE.score.mage * getWave());


    addEnemyKill();


    Audio.playEnemyDeath();


    if (player) player.gainExp(this.expValue);


    if (


      player &&


      player.charId === "kao" &&


      typeof player.addKill === "function"


    ) {


      const wepKey =


        typeof weaponSystem !== "undefined"


          ? weaponSystem.currentWeapon || "auto"


          : "auto";


      const currentWep = BALANCE.characters.kao.weapons[wepKey];


      if (currentWep) player.addKill(currentWep.name);


    }


    Achievements.stats.kills++;


    Achievements.check("first_blood");


    if (


      Math.random() <


      BALANCE.powerups.dropRate * BALANCE.mage.powerupDropMult


    )


      window.powerups.push(new PowerUp(this.x, this.y));


  }


  // draw() → EnemyRenderer.drawMage()


}





function _enemyCfg(key) {


  return (typeof BALANCE !== "undefined" && BALANCE.enemies)


    ? BALANCE.enemies[key]


    : null;


}





function _scaledEnemyValue(cfg, baseKey, growthKey) {


  const wave = typeof getWave === "function" ? getWave() : 1;


  if (!cfg) return 0;


  return cfg[growthKey] !== undefined


    ? cfg[baseKey] + wave * cfg[growthKey]


    : cfg[baseKey];


}





function _setupExpandedEnemy(enemy, key) {


  const cfg = _enemyCfg(key);


  if (!cfg) return;


  const wave = typeof getWave === "function" ? getWave() : 1;


  const hpGrowth = 1 + (cfg.hpPerWave || 0);


  enemy.maxHp = Math.floor(cfg.baseHp * Math.pow(hpGrowth, wave));


  enemy.hp = enemy.maxHp;


  enemy.speed = _scaledEnemyValue(cfg, "baseSpeed", "speedPerWave");


  enemy.damage = _scaledEnemyValue(cfg, "baseDamage", "damagePerWave");


  enemy.color = cfg.color;


  enemy.type = key;


  enemy.expValue = cfg.expValue || 0;


  enemy.preferredRange =


    cfg.preferredRange || cfg.healRange || cfg.buffRadius || cfg.spitRange || 320;


  enemy._enemyConfig = cfg;


}





function _expandedEnemyDeath(enemy, player, scoreValue, dropMult = 1) {


  if (typeof spawnParticles === "function")


    spawnParticles(enemy.x, enemy.y, 18, enemy.color || "#fff");


  if (typeof decalSystem !== "undefined") {


    decalSystem.spawn(


      enemy.x,


      enemy.y,


      enemy.color || "#334155",


      10 + Math.random() * 6,


      14


    );


  }


  if (typeof addScore === "function" && typeof getWave === "function")


    addScore(scoreValue * getWave());


  if (typeof addEnemyKill === "function") addEnemyKill();


  if (typeof Audio !== "undefined" && Audio.playEnemyDeath) Audio.playEnemyDeath();


  if (player && typeof player.gainExp === "function") player.gainExp(enemy.expValue || 0);


  if (


    player &&


    player.charId === "kao" &&


    typeof player.addKill === "function" &&


    typeof BALANCE !== "undefined" &&


    BALANCE.characters?.kao?.weapons


  ) {


    const wepKey =


      typeof weaponSystem !== "undefined"


        ? weaponSystem.currentWeapon || "auto"


        : "auto";


    const currentWep = BALANCE.characters.kao.weapons[wepKey];


    if (currentWep) player.addKill(currentWep.name);


  }


  if (typeof Achievements !== "undefined") {


    Achievements.stats.kills++;


    Achievements.check("first_blood");


  }


  if (Math.random() < ((BALANCE.powerups?.dropRate || 0) * dropMult) && window.powerups) {


    window.powerups.push(new PowerUp(enemy.x, enemy.y));


  }


}





class PoisonPoolEffect {


  constructor(x, y, cfg) {


    this.x = x;


    this.y = y;


    this.radius = cfg.poolRadius;


    this.duration = cfg.poolDuration;


    this.life = cfg.poolDuration;


    this.damagePerSec = cfg.poolDamagePerSec;


    this.color = cfg.color;


  }





  update(dt, player) {


    this.life -= dt;


    if (


      player &&


      !player.dead &&


      Math.hypot(player.x - this.x, player.y - this.y) <= this.radius


    ) {


      player.takeDamage(this.damagePerSec * dt);


    }


    return this.life <= 0;


  }





  draw() {


    if (typeof worldToScreen !== "function") return;


    const s = worldToScreen(this.x, this.y);


    const alpha = Math.max(0.18, this.life / Math.max(this.duration, 0.01));


    const pulse = 0.92 + Math.sin(performance.now() / 140) * 0.06;


    CTX.save();


    CTX.globalAlpha = alpha * 0.52;


    CTX.fillStyle = this.color;


    CTX.shadowBlur = 18;


    CTX.shadowColor = this.color;


    CTX.beginPath();


    CTX.arc(s.x, s.y, this.radius, 0, Math.PI * 2);


    CTX.fill();


    CTX.globalAlpha = alpha * 0.75;


    CTX.strokeStyle = "#93c5fd";


    CTX.lineWidth = 2.5;


    CTX.beginPath();


    CTX.arc(


      s.x,


      s.y,


      this.radius * pulse,


      0,


      Math.PI * 2


    );


    CTX.stroke();


    CTX.globalAlpha = alpha * 0.35;


    CTX.setLineDash([8, 6]);


    CTX.beginPath();


    CTX.arc(s.x, s.y, this.radius * 0.62, 0, Math.PI * 2);


    CTX.stroke();


    CTX.setLineDash([]);


    CTX.restore();


  }


}





class FatalityExplosionEffect {


  constructor(x, y, cfg) {


    this.x = x;


    this.y = y;


    this.radius = cfg.explosionRadius;


    this.damage = cfg.explosionDamage;


    this.delay = cfg.explosionDelay;


    this.timer = cfg.explosionDelay;


    this.color = cfg.color;


    this._detonated = false;


  }





  update(dt, player) {


    this.timer -= dt;


    if (!this._detonated && this.timer <= 0) {


      this._detonated = true;


      if (


        player &&


        !player.dead &&


        Math.hypot(player.x - this.x, player.y - this.y) <= this.radius


      ) {


        player.takeDamage(this.damage);


      }


      if (typeof spawnParticles === "function") spawnParticles(this.x, this.y, 26, this.color);


      if (typeof addScreenShake === "function") addScreenShake(12);


      return true;


    }


    return false;


  }





  draw() {


    if (typeof worldToScreen !== "function") return;


    const s = worldToScreen(this.x, this.y);


    const progress = 1 - Math.max(0, this.timer / Math.max(this.delay, 0.01));


    CTX.save();


    CTX.globalAlpha = 0.12 + progress * 0.28;


    CTX.fillStyle = this.color;


    CTX.beginPath();


    CTX.arc(s.x, s.y, this.radius * progress, 0, Math.PI * 2);


    CTX.fill();


    CTX.globalAlpha = 0.95;


    CTX.strokeStyle = progress < 0.8 ? "#fde68a" : "#fb7185";


    CTX.lineWidth = 3;


    CTX.setLineDash([10, 8]);


    CTX.beginPath();


    CTX.arc(s.x, s.y, this.radius * (0.3 + progress * 0.7), 0, Math.PI * 2);


    CTX.stroke();


    CTX.setLineDash([]);


    CTX.restore();


  }


}





class SniperEnemy extends Enemy {


  constructor(x, y) {


    const cfg = _enemyCfg("sniper");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "sniper");


    this.shootTimer = rand(...cfg.cooldown);


    this.chargeTimer = 0;


    this._telegraphTimer = 0;


    this._lockedAim = 0;


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    const cfg = this._enemyConfig;


    const d = dist(this.x, this.y, player.x, player.y);


    this.angle = Math.atan2(player.y - this.y, player.x - this.x);


    this.moveByIntent(dt, player, 0.10, 0.90, 0.25, 860, 0.88);


    if (this.chargeTimer > 0) {


      this.chargeTimer -= dt;


      this._telegraphTimer = this.chargeTimer;


      this.vx *= 0.75;


      this.vy *= 0.75;


    }


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    this.shootTimer -= dt;





    if (player.isInvisible) return;


    if (this.chargeTimer <= 0 && this._lockedAim) {


      if (typeof projectileManager === "undefined") return;


      projectileManager.add(


        new Projectile(


          this.x,


          this.y,


          this._lockedAim,


          cfg.projectileSpeed,


          this.getAttackDamage(),


          cfg.color,


          true,


          "enemy",


          { size: 18, radius: 12, life: 1.6 }


        )


      );


      this._lockedAim = 0;


      this.shootTimer = rand(...cfg.cooldown);


      return;


    }





    if (this.shootTimer > 0 || this.chargeTimer > 0 || d > cfg.shootRange || d < (cfg.minRange || 0)) return;


    if (!this.hasLineOfSightTo(player, cfg.shootRange)) return;


    const align = Math.max(Math.abs(player.x - this.x), Math.abs(player.y - this.y)) / Math.max(d, 1);


    if (align < cfg.alignCos) return;


    const leadT = Math.min(cfg.aimLeadMax, 0.12 + ((typeof getWave === "function" ? getWave() : 1) - 1) * 0.02);


    const pred = typeof playerAnalyzer !== "undefined" ? playerAnalyzer.predictedPosition(leadT) : null;


    const tx = pred ? pred.x : player.x;


    const ty = pred ? pred.y : player.y;


    this._lockedAim = Math.atan2(ty - this.y, tx - this.x);


    this.chargeTimer = cfg.chargeTime;


    this._telegraphTimer = cfg.chargeTime;


  }





  _onDeath(player) {


    _expandedEnemyDeath(this, player, BALANCE.score.mage, 1.15);


  }


}





class ShieldBraverEnemy extends TankEnemy {


  constructor(x, y) {


    const cfg = _enemyCfg("shield_bravo");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "shield_bravo");


  }





  takeDamage(amt, player) {


    const cfg = this._enemyConfig;


    if (player && this.isFrontHit(player, cfg.frontArcCos)) {


      amt *= cfg.frontReduction;


    }


    super.takeDamage(amt, player);


  }





  update(dt, player) {


    if (this.dead) return;





    this._tickShared(dt, player);





    const cfg = this._enemyConfig;


    const dx = player.x - this.x;


    const dy = player.y - this.y;


    const d = dist(this.x, this.y, player.x, player.y);


    this.angle = Math.atan2(dy, dx);


    this.moveByIntent(dt, player, 0.78, 0.22, 0.25, 560, 0.95);


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    if (d < cfg.meleeRange + player.radius) {


      const contactDamage = this.getAttackDamage() * dt * 2.1;


      const glitchMult = window.isGlitchWave ? GLITCH_DAMAGE_MULT : 1.0;


      player.takeDamage(contactDamage * glitchMult);


    }


  }





  _onDeath(player) {


    _expandedEnemyDeath(this, player, BALANCE.score.tank, 1.25);


  }


}





class PoisonSpitterEnemy extends Enemy {


  constructor(x, y) {


    const cfg = _enemyCfg("poison_spitter");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "poison_spitter");


    this.spitCooldown = cfg.cooldown;


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    const cfg = this._enemyConfig;


    const d = dist(this.x, this.y, player.x, player.y);


    this.angle = Math.atan2(player.y - this.y, player.x - this.x);


    this.moveByIntent(dt, player, 0.20, 0.80, 0.35, 860, 0.9);


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    this.tickCooldown("spitCooldown", dt);


    if (player.isInvisible || this.spitCooldown > 0 || d > cfg.spitRange) return;





    let activePools = 0;


    if (window.specialEffects) {


      for (let i = 0; i < window.specialEffects.length; i++) {


        if (window.specialEffects[i] instanceof PoisonPoolEffect) activePools++;


      }


      if (activePools >= cfg.maxPools) return;


      const pred = typeof playerAnalyzer !== "undefined" ? playerAnalyzer.predictedPosition(0.18) : null;


      const tx = pred ? pred.x : player.x;


      const ty = pred ? pred.y : player.y;


      for (let i = 0; i < window.specialEffects.length; i++) {


        const fx = window.specialEffects[i];


        if (!(fx instanceof PoisonPoolEffect)) continue;


        if (Math.hypot(fx.x - tx, fx.y - ty) < (cfg.minPoolSpacing || 140)) return;


      }


      window.specialEffects.push(new PoisonPoolEffect(tx, ty, cfg));


    }


    this.spitCooldown = cfg.cooldown;


  }





  _onDeath(player) {


    _expandedEnemyDeath(this, player, BALANCE.score.basicEnemy, 1.05);


  }


}





class ChargerEnemy extends Enemy {


  constructor(x, y) {


    const cfg = _enemyCfg("charger");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "charger");


    this._state = "idle";


    this._stateTimer = rand(...(cfg.idleDelay || [0.8, 1.2]));


    this._chargeDirX = 0;


    this._chargeDirY = 0;


    this._chargeHit = false;


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    const cfg = this._enemyConfig;


    const dx = player.x - this.x;


    const dy = player.y - this.y;


    const d = Math.hypot(dx, dy) || 1;


    this.angle = Math.atan2(dy, dx);





    if (this._state === "windup") {


      this._stateTimer -= dt;


      this.vx *= 0.6;


      this.vy *= 0.6;


      if (this._stateTimer <= 0) {


        this._state = "charge";


        this._stateTimer = cfg.chargeDuration;


        this._chargeDirX = dx / d;


        this._chargeDirY = dy / d;


        this._chargeHit = false;


      }


    } else if (this._state === "charge") {


      this._stateTimer -= dt;


      this.vx = this._chargeDirX * cfg.chargeSpeed;


      this.vy = this._chargeDirY * cfg.chargeSpeed;


      if (!this._chargeHit && d <= this.radius + player.radius + 12) {


        player.takeDamage(this.getAttackDamage(1.4));


        this._chargeHit = true;


        this._state = "recover";


        this._stateTimer = cfg.recovery;


      } else if (this._stateTimer <= 0) {


        this._state = "recover";


        this._stateTimer = cfg.recovery;


      }


    } else if (this._state === "recover") {


      this._stateTimer -= dt;


      this.vx *= 0.84;


      this.vy *= 0.84;


      if (this._stateTimer <= 0) {


        this._state = "idle";


        this._stateTimer = rand(...(cfg.idleDelay || [0.8, 1.2]));


      }


    } else {


      this._stateTimer -= dt;


      this.moveByIntent(dt, player, 0.50, 0.50, 0.28, 900, 0.9);


      if (!player.isInvisible && this._stateTimer <= 0 && d >= cfg.chargeMinRange && d <= cfg.chargeMaxRange) {


        this._state = "windup";


        this._stateTimer = cfg.windup;


      }


    }





    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


  }





  _onDeath(player) {


    _expandedEnemyDeath(this, player, BALANCE.score.basicEnemy, 1.1);


  }


}





class HunterEnemy extends Enemy {


  constructor(x, y) {


    const cfg = _enemyCfg("hunter");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "hunter");


    this.attackCooldown = rand(0.3, 0.7);


    this._lockedOn = true;


    this._strikeTelegraphTimer = 0;


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    const cfg = this._enemyConfig;


    const d = dist(this.x, this.y, player.x, player.y);


    this.angle = Math.atan2(player.y - this.y, player.x - this.x);


    this.moveByIntent(dt, player, 0.60, 0.40, 0.22, 900, 0.92);


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    this.tickCooldown("attackCooldown", dt);


    this._lockedOn = !player.isInvisible && d <= cfg.lockRange;


    if (this._lockedOn && d <= cfg.attackRange + player.radius * 1.35 && this.attackCooldown <= Math.max(0.18, cfg.telegraphTime || 0.18)) {


      this._strikeTelegraphTimer = Math.max(this._strikeTelegraphTimer, cfg.telegraphTime || 0.18);


    } else {


      this._strikeTelegraphTimer = Math.max(0, (this._strikeTelegraphTimer || 0) - dt);


    }


    if (this._lockedOn && d <= cfg.attackRange + player.radius && this.attackCooldown <= 0 && (this._strikeTelegraphTimer || 0) <= 0) {


      player.takeDamage(this.getAttackDamage(1.25));


      this.attackCooldown = cfg.attackCooldown;


      this._strikeTelegraphTimer = 0;


    }


  }





  _onDeath(player) {


    _expandedEnemyDeath(this, player, BALANCE.score.basicEnemy, 1.1);


  }


}





class FatalityBomberEnemy extends Enemy {


  constructor(x, y) {


    const cfg = _enemyCfg("fatality_bomber");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "fatality_bomber");


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    this.moveByIntent(dt, player, 0.65, 0.35, 0.35, 820, 0.9);


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


  }





  _onDeath(player) {


    if (window.specialEffects) {


      window.specialEffects.push(new FatalityExplosionEffect(this.x, this.y, this._enemyConfig));


    }


    _expandedEnemyDeath(this, player, BALANCE.score.basicEnemy, 1.15);


  }


}





class HealerEnemy extends Enemy {


  constructor(x, y) {


    const cfg = _enemyCfg("healer");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "healer");


    this.healCooldown = rand(1.2, cfg.healCooldown);


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    const cfg = this._enemyConfig;


    this.angle = Math.atan2(player.y - this.y, player.x - this.x);


    this.moveByIntent(dt, player, 0.0, 1.0, 0.30, 860, 0.92);


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    this.tickCooldown("healCooldown", dt);


    if (this.healCooldown > 0) return;


    const ally = this.findLowestHpAlly(cfg.healRange, cfg.healThreshold, {


      prefer: (candidate) => {


        const cat = candidate._enemyConfig?.category;


        return cat !== "support" && candidate.type !== "summon_minion";


      }


    });


    if (!ally) return;


    ally.heal(cfg.healAmount);


    if (typeof spawnFloatingText === "function") {


      spawnFloatingText(`+${cfg.healAmount}`, ally.x, ally.y - 42, "#34d399", 16);


    }


    this.healCooldown = cfg.healCooldown;


  }





  _onDeath(player) {


    _expandedEnemyDeath(this, player, BALANCE.score.mage, 1.0);


  }


}





class SummonedMinionEnemy extends Enemy {


  constructor(x, y, owner) {


    const cfg = _enemyCfg("summon_minion");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "summon_minion");


    this.owner = owner || null;


    this.lifeTimer = cfg.lifetime || 10;


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    const cfg = this._enemyConfig;


    this.lifeTimer -= dt;


    if (this.lifeTimer <= 0 || (this.owner && this.owner.dead)) {


      this.takeDamage((this.hp || 1) + 999, this.owner || player);


      return;


    }


    const d = dist(this.x, this.y, player.x, player.y);


    this.moveByIntent(dt, player, 0.65, 0.35, 0.20, 920, 0.9);


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    if (d <= cfg.meleeRange + player.radius) {


      player.takeDamage(this.getAttackDamage() * dt * 2.2);


    }


  }





  _onDeath(player) {


    if (this.owner) this.owner._activeMinions = Math.max(0, (this.owner._activeMinions || 1) - 1);


    _expandedEnemyDeath(this, player, 30, 0);


  }


}





class SummonerEnemy extends Enemy {


  constructor(x, y) {


    const cfg = _enemyCfg("summoner");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "summoner");


    this.summonCooldown = rand(1.5, cfg.summonCooldown);


    this._activeMinions = 0;


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    const cfg = this._enemyConfig;


    this.angle = Math.atan2(player.y - this.y, player.x - this.x);


    this.moveByIntent(dt, player, 0.0, 1.0, 0.28, 860, 0.92);


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    this.tickCooldown("summonCooldown", dt);


    const d = dist(this.x, this.y, player.x, player.y);


    if (this.summonCooldown > 0 || this._activeMinions >= cfg.maxMinions || d > (cfg.summonEngageRange || 620)) return;


    if (!window.enemies) return;


    const angle = Math.random() * Math.PI * 2;


    const spawnX = this.x + Math.cos(angle) * cfg.summonRange * 0.4;


    const spawnY = this.y + Math.sin(angle) * cfg.summonRange * 0.4;


    const minion = new SummonedMinionEnemy(spawnX, spawnY, this);


    this._activeMinions++;


    window.enemies.push(minion);


    if (typeof SquadAI !== "undefined") SquadAI.tagOnSpawn(minion);


    if (typeof window.applyWaveModifiersToEnemy === "function") window.applyWaveModifiersToEnemy(minion);


    this.summonCooldown = cfg.summonCooldown;


  }





  _onDeath(player) {


    _expandedEnemyDeath(this, player, BALANCE.score.mage, 1.0);


  }


}





class BufferEnemy extends Enemy {


  constructor(x, y) {


    const cfg = _enemyCfg("buffer");


    super(x, y);


    this.radius = cfg.radius;


    this._ai = typeof UtilityAI !== "undefined" ? new UtilityAI(this, cfg.personality) : null;


    _setupExpandedEnemy(this, "buffer");


    this.buffCooldown = rand(1.4, cfg.buffCooldown);


    this._buffMode = "speed";


  }





  update(dt, player) {


    if (this.dead) return;


    this._tickShared(dt, player);


    const cfg = this._enemyConfig;


    this.angle = Math.atan2(player.y - this.y, player.x - this.x);


    this.moveByIntent(dt, player, 0.0, 1.0, 0.28, 860, 0.92);


    this._steerAroundObstacles(dt);


    this.applyPhysics(dt);


    this.tickCooldown("buffCooldown", dt);


    if (this.buffCooldown > 0 || !window.enemies) return;





    let buffed = 0;


    for (let i = 0; i < window.enemies.length; i++) {


      const ally = window.enemies[i];


      if (!ally || ally.dead || ally === this) continue;


      if (Math.hypot(ally.x - this.x, ally.y - this.y) > cfg.buffRadius) continue;


      if (ally._enemyConfig?.support || ally.type === "summon_minion") continue;


      if (buffed >= (cfg.maxBuffTargets || 3)) break;


      if (this._buffMode === "speed") {


        ally._enemySpeedBuff = Math.max(ally._enemySpeedBuff || 1, cfg.speedMult);


        ally._enemySpeedBuffTimer = Math.max(ally._enemySpeedBuffTimer || 0, cfg.buffDuration);


      } else {


        ally._enemyDamageBuff = Math.max(ally._enemyDamageBuff || 1, cfg.damageMult);


        ally._enemyDamageBuffTimer = Math.max(ally._enemyDamageBuffTimer || 0, cfg.buffDuration);


      }


      buffed++;


    }


    if (buffed > 0) {


      this._buffMode = this._buffMode === "speed" ? "damage" : "speed";


      this.buffCooldown = cfg.buffCooldown;


    }


  }





  _onDeath(player) {


    _expandedEnemyDeath(this, player, BALANCE.score.mage, 1.0);


  }


}





// ════════════════════════════════════════════════════════════


// POWER-UPS


// ════════════════════════════════════════════════════════════


class PowerUp {


  constructor(x, y) {


    this.x = x;


    this.y = y;


    this.radius = BALANCE.powerups.radius;


    this.life = BALANCE.powerups.lifetime;


    this.bobTimer = Math.random() * Math.PI * 2;


    this.type = randomChoice(["heal", "damage", "speed"]);


    this.icons = { heal: "❤️", damage: "⚡️", speed: "🚀" };


    this.colors = { heal: "#10b981", damage: "#f59e0b", speed: "#3b82f6" };


  }


  update(dt, player) {


    this.life -= dt;


    this.bobTimer += dt * 3;


    const d = dist(this.x, this.y, player.x, player.y);


    if (d < this.radius + player.radius) {


      this.collect(player);


      return true;


    }


    return this.life <= 0;


  }


  collect(player) {


    switch (this.type) {


      case "heal":


        player.heal(BALANCE.powerups.healAmount);


        break;


      case "damage":


        // FIX (BUG-6): Stack with shop boost instead of overwriting


        if (!player._powerupDamageActive) {


          const shopMult = player.shopDamageBoostActive


            ? player.damageBoost / (player._baseDamageBoost || 1.0)


            : 1.0;


          player._powerupDamageActive = true;


          player.damageBoost =


            (player._baseDamageBoost || 1.0) *


            shopMult *


            BALANCE.powerups.damageBoost;





          setTimeout(() => {


            player._powerupDamageActive = false;


            // Restore shop boost if still active


            const currentShopMult = player.shopDamageBoostActive


              ? player.damageBoost /


              ((player._baseDamageBoost || 1.0) *


                BALANCE.powerups.damageBoost)


              : 1.0;


            player.damageBoost =


              (player._baseDamageBoost || 1.0) * currentShopMult;


          }, BALANCE.powerups.damageBoostDuration * 1000);


        }


        spawnFloatingText("DAMAGE UP!", player.x, player.y - 40, "#f59e0b", 20);


        break;


      case "speed":


        // FIX (BUG-6): Stack with shop boost instead of overwriting


        if (!player._powerupSpeedActive) {


          const shopMult = player.shopSpeedBoostActive


            ? player.speedBoost / 1.0


            : 1.0;


          player._powerupSpeedActive = true;


          player._preSpeedBoostBase = shopMult; // save shop-only multiplier


          player.speedBoost = shopMult * BALANCE.powerups.speedBoost;





          setTimeout(() => {


            player._powerupSpeedActive = false;


            // Restore to pre-powerup value (shop boost or 1.0)


            player.speedBoost = player._preSpeedBoostBase ?? 1.0;


            player._preSpeedBoostBase = undefined;


          }, BALANCE.powerups.speedBoostDuration * 1000);


        }


        spawnFloatingText("SPEED UP!", player.x, player.y - 40, "#3b82f6", 20);


    }


    spawnParticles(this.x, this.y, 20, this.colors[this.type]);


    addScore(BALANCE.score.powerup);


    Audio.playPowerUp();


    Achievements.stats.powerups++;


    Achievements.check("collector");


  }


  // draw() moved to EnemyRenderer.drawXxx() — see bottom of this file.


}


// ══════════════════════════════════════════════════════════════


// 🌐 WINDOW EXPORTS


// ══════════════════════════════════════════════════════════════


window.Enemy = Enemy;


window.EnemyBase = EnemyBase; // alias for Debug.html check


window.TankEnemy = TankEnemy;


window.MageEnemy = MageEnemy;


window.SniperEnemy = SniperEnemy;


window.ShieldBraverEnemy = ShieldBraverEnemy;


window.PoisonSpitterEnemy = PoisonSpitterEnemy;


window.ChargerEnemy = ChargerEnemy;


window.HunterEnemy = HunterEnemy;


window.FatalityBomberEnemy = FatalityBomberEnemy;


window.HealerEnemy = HealerEnemy;


window.SummonerEnemy = SummonerEnemy;


window.BufferEnemy = BufferEnemy;


window.SummonedMinionEnemy = SummonedMinionEnemy;


window.PowerUp = PowerUp;


window.ENEMY_REGISTRY = {


  basic: { ctor: Enemy },


  tank: { ctor: TankEnemy },


  mage: { ctor: MageEnemy },


  sniper: { ctor: SniperEnemy },


  shield_bravo: { ctor: ShieldBraverEnemy },


  poison_spitter: { ctor: PoisonSpitterEnemy },


  charger: { ctor: ChargerEnemy },


  hunter: { ctor: HunterEnemy },


  fatality_bomber: { ctor: FatalityBomberEnemy },


  healer: { ctor: HealerEnemy },


  summoner: { ctor: SummonerEnemy },


  buffer: { ctor: BufferEnemy },


  summon_minion: { ctor: SummonedMinionEnemy }


};





