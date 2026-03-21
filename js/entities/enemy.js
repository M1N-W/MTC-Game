"use strict";
/**
 * js/entities/enemy.js
 * ════════════════════════════════════════════════════════════════════════════
 * All enemy classes + EnemyRenderer. Single file containing EnemyBase
 * (shared foundation), three enemy subclasses, PowerUp, and the static
 * EnemyRenderer dispatcher.
 *
 * Exports: window.EnemyBase, window.Enemy, window.TankEnemy,
 *          window.MageEnemy, window.PowerUp, window.EnemyRenderer
 *
 * Load order:
 *   base.js (Entity) → UtilityAI.js → EnemyActions.js → enemy.js
 *   (SquadAI.js loads after, calls EnemyBase via window.enemies[])
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────────────
 *  L.103  EnemyBase              Shared foundation — extend this, NOT Entity
 *  L.155    ._tickShared(dt,p)   ⚠️ MUST be FIRST line of every subclass update()
 *                                 Handles: StatusEffect tick, UtilityAI, hitFlash,
 *                                 ignite DoT, SHATTER reaction, stun timer
 *  L.220    .addStatus()         StatusEffect framework entry point
 *  L.250    .removeStatus()
 *  L.262    .tickStatuses(dt)    Ticks all active effects, removes expired
 *  L.281    .takeDamage(amt,p)   hitFlash trigger + death routing
 *  L.293    ._onDeath(p)         No-op stub — override in subclass
 *  L.305  Enemy                  Basic grunt — melee contact + glitch-wave damage
 *  L.461  TankEnemy              Heavy bruiser — slow, high HP, charge attack
 *  L.563  MageEnemy              Ranged caster — confusion beam + meteor volley
 *  L.706  PowerUp                Loot drop — not an enemy, no AI
 *  L.803  EnemyRenderer          Static draw dispatcher + shared helpers
 *  L.806    .draw(e,ctx)         Dispatcher: instanceof order Mage→Tank→Enemy→PowerUp
 *  L.838    ._drawHpBar()        Shared HP bar (all enemy types)
 *  L.892    ._drawGroundShadow() Shared ellipse shadow
 *  L.910    ._drawStatusOverlays() Sticky-slow, ignite, SHATTER VFX overlays
 *  L.991    .drawEnemy()
 *  L.1178   .drawTank()
 *  L.1371   .drawMage()
 *  L.1583   .drawPowerUp()
 *
 * ── NEW ENEMY TEMPLATE ──────────────────────────────────────────────────
 *  class MyEnemy extends EnemyBase {
 *      constructor(x, y) { super(x, y, radius, 'basic'); }
 *      update(dt, player) {
 *          if (this.dead) return;
 *          this._tickShared(dt, player); // ← FIRST, always
 *          // movement + attack logic here
 *      }
 *      _onDeath(player) { /* FX + score *\/ }
 *  }
 *
 * ⚠️  SHATTER reaction lives in _tickShared() after the ignite DoT block.
 *     Trigger: igniteTimer > 0 && (stickySlowMultiplier < 0.65 || stickyStacks >= 3)
 *     Effect:  igniteDPS × 2.5 burst + 0.4s stun (_shatterStunTimer) + _shatterUsed flag guard
 *     NEVER move this block — order relative to ignite tick is load-bearing.
 * ⚠️  AI writes _aiMoveX/_aiMoveY only — never vx/vy directly.
 * ⚠️  _onDeath: wrap Achievements.check() in typeof guard or an unloaded
 *     Achievements object crashes the entire wave resolution.
 * ⚠️  EnemyRenderer.draw() instanceof order is significant — MageEnemy FIRST
 *     because MageEnemy extends EnemyBase same as Enemy; wrong order = misrender.
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
    // Proxy getters — call sites เดิม (this.hp, this.dead) ทำงานปกติ

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
    // Triggers when ignited enemy is also significantly slowed (sticky ≥3 stacks
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
        const chaseSpeed =
          d > this.radius + (window.player?.radius || 20)
            ? this.speed
            : this.speed * 0.3;
        this.vx = (blendX / blendLen) * chaseSpeed * this.stickySlowMultiplier;
        this.vy = (blendY / blendLen) * chaseSpeed * this.stickySlowMultiplier;
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
          this.damage,
          "#fff",
          false,
          "enemy",
        ),
      );
      this.shootTimer = rand(...BALANCE.enemy.shootCooldown);
    }
    // ── Melee contact damage ─────────────────────────────
    if (d < this.radius + player.radius) {
      const contactDamage = this.damage * dt * 3;
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
        this.vx = (blendX / blendLen) * this.speed * this.stickySlowMultiplier;
        this.vy = (blendY / blendLen) * this.speed * this.stickySlowMultiplier;
      } else {
        this.vx *= 0.95;
        this.vy *= 0.95;
      }
    }
    this._steerAroundObstacles(dt);
    this.applyPhysics(dt);
    // ── Melee contact damage ─────────────────────────────
    if (d < BALANCE.tank.meleeRange + player.radius) {
      const contactDamage = this.damage * dt * 2;
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
        this.vx = (blendX / blendLen) * this.speed * this.stickySlowMultiplier;
        this.vy = (blendY / blendLen) * this.speed * this.stickySlowMultiplier;
      } else if (d > od + BALANCE.mage.orbitDistanceBuffer) {
        this.vx = Math.cos(this.angle) * this.speed * this.stickySlowMultiplier;
        this.vy = Math.sin(this.angle) * this.speed * this.stickySlowMultiplier;
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
    this.icons = { heal: "❤️", damage: "⚡", speed: "🚀" };
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
window.PowerUp = PowerUp;
// ============================================================
// EnemyRenderer — Canvas draw calls for all enemy types
//
// Separated from entity logic so game data and visuals are
// independently testable. Godot equivalent: Sprite2D / AnimatedSprite2D
// nodes that are children of the enemy Node2D but own no game state.
//
// Entry point: EnemyRenderer.draw(entity, ctx)
//   Dispatches to the correct static method based on entity type.
// ============================================================
class EnemyRenderer {
  // ── Dispatcher ───────────────────────────────────────────
  // Call this from the game loop instead of entity.draw().
  static draw(e, ctx) {
    // ── Viewport cull ─────────────────────────────────────────
    const screen = worldToScreen(e.x, e.y);
    const R = (e.radius ?? 20) + 40; // 40px margin for auras/overlays
    if (screen.x < -R || screen.x > CANVAS.width + R ||
      screen.y < -R || screen.y > CANVAS.height + R) return;
    // ─────────────────────────────────────────────────────────
    const _prevCTX = typeof window !== 'undefined' ? window.CTX : undefined;
    if (typeof window !== "undefined") window.CTX = ctx;
    try {
      if (e instanceof MageEnemy) EnemyRenderer.drawMage(e);
      else if (e instanceof TankEnemy) EnemyRenderer.drawTank(e);
      else if (e instanceof Enemy) EnemyRenderer.drawEnemy(e);
      else if (e instanceof PowerUp) EnemyRenderer.drawPowerUp(e);
      // Fallback: entities with own draw() (e.g. GoldfishMinion, future minions)
      else if (typeof e.draw === "function") e.draw();
    } finally {
      if (typeof window !== "undefined" && _prevCTX !== undefined)
        window.CTX = _prevCTX;
    }
  }

  // ══════════════════════════════════════════════════════════
  // SHARED HELPERS — called by all 3 draw methods
  // Extracted to eliminate 3× duplicate blocks and reduce
  // per-frame GC pressure (no inline object literals in hot path)
  // ══════════════════════════════════════════════════════════

  /**
   * Draw HP bar above entity — rounded, multi-tone, low-HP danger pulse.
   * @param {number} sx screen x  @param {number} sy screen y
   * @param {number} R  collision radius
   * @param {number} hp current HP  @param {number} maxHp max HP
   * @param {number} bw bar width (px)  @param {number} yOff y offset above head
   * @param {number} now Date.now() — passed in, not re-called
   */
  static _drawHpBar(sx, sy, R, hp, maxHp, bw, yOff, now) {
    const ratio = Math.max(0, hp / maxHp);
    const bh = 5;
    const bx = sx - bw / 2;
    const by = sy - R - yOff;

    // ── Low-HP danger pulse (ratio < 0.30) ──────────────
    if (ratio < 0.3) {
      const pulse = 0.55 + Math.sin(now / 100) * 0.45;
      CTX.save();
      CTX.globalAlpha = pulse * 0.35;
      CTX.fillStyle = "#ef4444";
      CTX.beginPath();
      CTX.arc(sx, sy, R + 4 + pulse * 3, 0, Math.PI * 2);
      CTX.fill();
      CTX.restore();
    }

    // ── Bar background ───────────────────────────────────
    CTX.save();
    CTX.fillStyle = "rgba(0,0,0,0.65)";
    // Rounded background via clip — cheap alternative to roundRect path
    CTX.beginPath();
    CTX.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
    CTX.fill();

    // ── Fill ─────────────────────────────────────────────
    // Colour: green → amber → red as HP drops
    const fillColor =
      ratio > 0.6 ? "#22c55e" : ratio > 0.3 ? "#f59e0b" : "#ef4444";
    CTX.fillStyle = fillColor;
    if (ratio > 0.01) {
      CTX.beginPath();
      CTX.roundRect(bx, by, bw * ratio, bh, 2);
      CTX.fill();
    }

    // ── Specular sheen on fill (top half lighter strip) ──
    CTX.globalAlpha = 0.28;
    CTX.fillStyle = "#ffffff";
    CTX.beginPath();
    CTX.roundRect(bx, by, bw * ratio, Math.floor(bh / 2), [2, 2, 0, 0]);
    CTX.fill();

    CTX.restore();
  }

  /**
   * Ground shadow ellipse — shared across all 3 enemy types.
   * @param {number} sx @param {number} sy screen coords
   * @param {number} R  collision radius
   * @param {number} alpha base opacity
   * @param {number} ry  ellipse Y radius
   */
  static _drawGroundShadow(sx, sy, R, alpha, ry) {
    CTX.save();
    CTX.globalAlpha = alpha;
    CTX.fillStyle = "rgba(0,0,0,0.85)";
    CTX.beginPath();
    CTX.ellipse(sx, sy + R + 4, R * 0.85, ry, 0, 0, Math.PI * 2);
    CTX.fill();
    CTX.restore();
  }

  /**
   * Status effect overlays — hit flash, sticky, ignite.
   * Called AFTER the main body so overlays render on top.
   * @param {Enemy|TankEnemy|MageEnemy} e
   * @param {number} sx @param {number} sy screen coords
   * @param {number} R collision radius
   * @param {number} now Date.now() value from caller
   */
  static _drawStatusOverlays(e, sx, sy, R, now) {
    // ── Hit flash — white silhouette ──────────────────────
    if (e.hitFlashTimer > 0) {
      CTX.save();
      CTX.globalAlpha = (e.hitFlashTimer / HIT_FLASH_DURATION) * 0.8;
      CTX.fillStyle = "#ffffff";
      CTX.shadowBlur = 10;
      CTX.shadowColor = "#ffffff";
      CTX.beginPath();
      CTX.arc(sx, sy, R, 0, Math.PI * 2);
      CTX.fill();
      CTX.restore();
    }

    // ── Sticky stacks — green tint ────────────────────────
    if (e.stickyStacks > 0) {
      const intensity = Math.min(1, e.stickyStacks / 10);
      CTX.save();
      CTX.globalAlpha = 0.4 * intensity;
      CTX.fillStyle = "#00ff88";
      CTX.beginPath();
      CTX.arc(sx, sy, R, 0, Math.PI * 2);
      CTX.fill();
      // Stack count pip dots above entity
      if (e.stickyStacks >= 3) {
        const pipCount = Math.min(e.stickyStacks, 6);
        CTX.globalAlpha = 0.85;
        CTX.fillStyle = "#00ff88";
        CTX.shadowBlur = 5;
        CTX.shadowColor = "#00ff88";
        for (let pi = 0; pi < pipCount; pi++) {
          const pa = (pi / pipCount) * Math.PI * 2 - Math.PI / 2;
          CTX.beginPath();
          CTX.arc(
            sx + Math.cos(pa) * (R + 6),
            sy + Math.sin(pa) * (R + 6),
            2,
            0,
            Math.PI * 2,
          );
          CTX.fill();
        }
        CTX.shadowBlur = 0;
      }
      CTX.restore();
    }

    // ── Ignite — pulsing fire ring + inner ember tint ─────
    if ((e.igniteTimer ?? 0) > 0) {
      const igPulse = 0.5 + Math.sin(now / 75) * 0.3;
      CTX.save();
      // Outer ring
      CTX.globalAlpha = igPulse;
      CTX.strokeStyle = "#f97316";
      CTX.lineWidth = 2.5;
      CTX.shadowBlur = 14;
      CTX.shadowColor = "#f97316";
      CTX.beginPath();
      CTX.arc(sx, sy, R + 4, 0, Math.PI * 2);
      CTX.stroke();
      // Second thinner outer ring (shimmer)
      CTX.globalAlpha = igPulse * 0.55;
      CTX.strokeStyle = "#fbbf24";
      CTX.lineWidth = 1;
      CTX.shadowBlur = 6;
      CTX.shadowColor = "#fbbf24";
      CTX.beginPath();
      CTX.arc(sx, sy, R + 7 + Math.sin(now / 60) * 2, 0, Math.PI * 2);
      CTX.stroke();
      // Inner ember fill
      CTX.globalAlpha = igPulse * 0.22;
      CTX.fillStyle = "#fb923c";
      CTX.shadowBlur = 0;
      CTX.beginPath();
      CTX.arc(sx, sy, R, 0, Math.PI * 2);
      CTX.fill();
      CTX.restore();
    }
  }

  // ── Basic Enemy (Corrupted Student Drone) ────────────────
  static drawEnemy(e) {
    // ╔══════════════════════════════════════════════════════════╗
    // ║  BASIC ENEMY — Corrupted Student Drone                  ║
    // ║  Slim gray/purple bean · Dual visor · Spiked hands      ║
    // ╚══════════════════════════════════════════════════════════╝
    const screen = worldToScreen(e.x, e.y);
    const now = performance.now();
    const R = e.radius;
    const sx = screen.x,
      sy = screen.y;
    const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

    // ── Ground shadow ─────────────────────────────────────────────
    EnemyRenderer._drawGroundShadow(sx, sy, R, 0.22, 4);

    // ── Body Block (Body Anti-Flip) ───────────────────────────────
    CTX.save();
    CTX.translate(sx, sy);
    if (isFacingLeft) CTX.scale(-1, 1);

    // Breathing squash/stretch
    const breathe = Math.sin(now / 200);
    CTX.scale(1 + breathe * 0.028, 1 - breathe * 0.028);

    // ── Outer glow ring (corrupted purple) ───────────────────────
    const glowPulse = 0.45 + Math.sin(now / 320) * 0.2;
    CTX.shadowBlur = 12;
    CTX.shadowColor = `rgba(168,85,247,${glowPulse})`;
    CTX.strokeStyle = `rgba(168,85,247,${glowPulse * 0.8})`;
    CTX.lineWidth = 2;
    CTX.beginPath();
    CTX.arc(0, 0, R + 2, 0, Math.PI * 2);
    CTX.stroke();
    CTX.shadowBlur = 0;

    // ── Bean body — charcoal/gray-purple radial gradient ──────────
    const bodyG = CTX.createRadialGradient(-R * 0.25, -R * 0.25, 1, 0, 0, R);
    bodyG.addColorStop(0, "#5a5a7a");
    bodyG.addColorStop(0.5, "#2d2d44");
    bodyG.addColorStop(1, "#1a1a2e");
    CTX.fillStyle = bodyG;
    CTX.beginPath();
    CTX.arc(0, 0, R, 0, Math.PI * 2);
    CTX.fill();

    // Thick outline
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 3;
    CTX.beginPath();
    CTX.arc(0, 0, R, 0, Math.PI * 2);
    CTX.stroke();

    // Specular highlight — top-left dome
    CTX.fillStyle = "rgba(255,255,255,0.12)";
    CTX.beginPath();
    CTX.arc(-R * 0.32, -R * 0.32, R * 0.32, 0, Math.PI * 2);
    CTX.fill();

    // ── Corrupted circuit lines on body surface ───────────────────
    CTX.save();
    CTX.beginPath();
    CTX.arc(0, 0, R - 0.5, 0, Math.PI * 2);
    CTX.clip();
    CTX.strokeStyle = "rgba(168,85,247,0.22)";
    CTX.lineWidth = 0.8;
    CTX.beginPath();
    CTX.moveTo(-R, 0);
    CTX.lineTo(-R * 0.4, 0);
    CTX.lineTo(-R * 0.4, R * 0.5);
    CTX.stroke();
    CTX.beginPath();
    CTX.moveTo(R * 0.1, -R);
    CTX.lineTo(R * 0.1, -R * 0.4);
    CTX.lineTo(R * 0.5, -R * 0.4);
    CTX.stroke();
    // Node dots
    CTX.fillStyle = "rgba(168,85,247,0.40)";
    for (const [nx, ny] of [
      [-R * 0.4, 0],
      [-R * 0.4, R * 0.5],
      [R * 0.1, -R * 0.4],
      [R * 0.5, -R * 0.4],
    ]) {
      CTX.beginPath();
      CTX.arc(nx, ny, 1.2, 0, Math.PI * 2);
      CTX.fill();
    }
    CTX.restore();

    // ── Dual visor slits (side-by-side, glowing red) ─────────────
    const visorPulse = 0.7 + Math.sin(now / 280) * 0.28;
    const vp2 = 0.55 + Math.sin(now / 220 + 0.9) * 0.28;
    // Left shard
    CTX.fillStyle = `rgba(239,68,68,${visorPulse})`;
    CTX.shadowBlur = 12 * visorPulse;
    CTX.shadowColor = "#ef4444";
    CTX.beginPath();
    CTX.roundRect(-R * 0.45, -R * 0.22, R * 0.38, R * 0.18, R * 0.05);
    CTX.fill();
    // Right shard (slightly offset, slightly different pulse)
    CTX.fillStyle = `rgba(239,68,68,${vp2})`;
    CTX.shadowBlur = 10 * vp2;
    CTX.beginPath();
    CTX.roundRect(R * 0.08, -R * 0.22, R * 0.38, R * 0.18, R * 0.05);
    CTX.fill();
    // Ambient glow behind both
    CTX.fillStyle = `rgba(239,68,68,${visorPulse * 0.14})`;
    CTX.shadowBlur = 0;
    CTX.beginPath();
    CTX.roundRect(-R * 0.5, -R * 0.36, R * 1.05, R * 0.52, R * 0.16);
    CTX.fill();

    CTX.restore(); // end body transform

    // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
    CTX.save();
    CTX.translate(sx, sy);
    CTX.rotate(e.angle);
    if (isFacingLeft) CTX.scale(1, -1);

    const handR = R * 0.38;

    // Front hand — weapon-pointing side
    CTX.fillStyle = "#3b3b55";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2;
    CTX.shadowBlur = 6;
    CTX.shadowColor = "rgba(168,85,247,0.55)";
    CTX.beginPath();
    CTX.arc(R + 7, 0, handR, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();

    // Front spike — larger jagged triangle + inner glow tip
    const fsx = R + 7 + handR;
    CTX.fillStyle = "#ef4444";
    CTX.shadowBlur = 8;
    CTX.shadowColor = "#ef4444";
    CTX.beginPath();
    CTX.moveTo(fsx, -1.5); // base top
    CTX.lineTo(fsx + 9, 0); // tip
    CTX.lineTo(fsx, 5); // base bottom
    CTX.lineTo(fsx - 1.5, 1.5); // notch
    CTX.closePath();
    CTX.fill();
    // Spike highlight
    CTX.fillStyle = "rgba(255,150,150,0.50)";
    CTX.beginPath();
    CTX.moveTo(fsx, -1.5);
    CTX.lineTo(fsx + 9, 0);
    CTX.lineTo(fsx, 1);
    CTX.closePath();
    CTX.fill();
    CTX.shadowBlur = 0;

    // Back hand — off-side
    CTX.fillStyle = "#2d2d44";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2;
    CTX.shadowBlur = 3;
    CTX.shadowColor = "rgba(168,85,247,0.35)";
    CTX.beginPath();
    CTX.arc(-(R + 6), 0, handR - 1, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();

    // Back spike
    const bsx = -(R + 6 + handR - 1);
    CTX.fillStyle = "#c03030";
    CTX.beginPath();
    CTX.moveTo(bsx, -1);
    CTX.lineTo(bsx - 7, 0);
    CTX.lineTo(bsx, 4);
    CTX.closePath();
    CTX.fill();
    CTX.shadowBlur = 0;

    CTX.restore(); // end weapon block

    // ── Shared status overlays (hit flash, sticky, ignite) ────────
    EnemyRenderer._drawStatusOverlays(e, sx, sy, R, now);

    // ── HP bar ────────────────────────────────────────────────────
    EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 30, 10, now);
  }

  // ── Tank Enemy (Heavy Armored Brute) ─────────────────────
  static drawTank(e) {
    // ╔══════════════════════════════════════════════════════════╗
    // ║  TANK ENEMY — Heavy Armored Brute                       ║
    // ║  Wide dark-red bean · Layered armor · Kite-shield fists  ║
    // ╚══════════════════════════════════════════════════════════╝
    const screen = worldToScreen(e.x, e.y);
    const now = performance.now();
    const R = e.radius;
    const sx = screen.x,
      sy = screen.y;
    const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

    // ── Ground shadow (wider for big body) ───────────────────────
    EnemyRenderer._drawGroundShadow(sx, sy, R, 0.3, 5);

    // ── Body Block (Body Anti-Flip) ───────────────────────────────
    CTX.save();
    CTX.translate(sx, sy);
    if (isFacingLeft) CTX.scale(-1, 1);

    // Tank breathes slower, heavier
    const breathe = Math.sin(now / 320);
    CTX.scale(1 + breathe * 0.022, 1 - breathe * 0.022);

    // ── Threat glow ring ─────────────────────────────────────────
    const threatPulse = 0.55 + Math.sin(now / 250) * 0.22;
    CTX.shadowBlur = 16;
    CTX.shadowColor = `rgba(185,28,28,${threatPulse})`;
    CTX.strokeStyle = `rgba(185,28,28,${threatPulse * 0.75})`;
    CTX.lineWidth = 3;
    CTX.beginPath();
    CTX.arc(0, 0, R + 3, 0, Math.PI * 2);
    CTX.stroke();
    CTX.shadowBlur = 0;

    // ── Main bean body — wide dark-red (1.15× X scale) ───────────
    CTX.save();
    CTX.scale(1.15, 1.0);
    const bodyG = CTX.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
    bodyG.addColorStop(0, "#8f2020");
    bodyG.addColorStop(0.5, "#4a0d0d");
    bodyG.addColorStop(1, "#2d0606");
    CTX.fillStyle = bodyG;
    CTX.beginPath();
    CTX.arc(0, 0, R, 0, Math.PI * 2);
    CTX.fill();
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 3;
    CTX.beginPath();
    CTX.arc(0, 0, R, 0, Math.PI * 2);
    CTX.stroke();
    CTX.restore();

    // ── Layered armor plates ──────────────────────────────────────
    // Front chest plate
    CTX.fillStyle = "#57121a";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 1.8;
    CTX.beginPath();
    CTX.moveTo(R * 0.05, -R * 0.62);
    CTX.lineTo(R * 0.68, -R * 0.32);
    CTX.lineTo(R * 0.72, R * 0.28);
    CTX.lineTo(R * 0.05, R * 0.62);
    CTX.quadraticCurveTo(R * 0.3, R * 0.45, R * 0.05, R * 0.3);
    CTX.closePath();
    CTX.fill();
    CTX.stroke();

    // Shoulder pauldron
    CTX.fillStyle = "#6b1515";
    CTX.beginPath();
    CTX.arc(0, -R * 0.65, R * 0.28, Math.PI, 0);
    CTX.lineTo(R * 0.28, -R * 0.45);
    CTX.lineTo(-R * 0.28, -R * 0.45);
    CTX.closePath();
    CTX.fill();
    CTX.stroke();

    // Rivets
    CTX.fillStyle = "#2d0606";
    CTX.shadowBlur = 4;
    CTX.shadowColor = "#ef4444";
    for (const [rx, ry] of [
      [R * 0.45, -R * 0.35],
      [R * 0.5, R * 0.05],
      [R * 0.42, R * 0.35],
    ]) {
      CTX.beginPath();
      CTX.arc(rx, ry, 2.2, 0, Math.PI * 2);
      CTX.fill();
    }
    CTX.shadowBlur = 0;

    // ── Overheating slit — orange engine glow ────────────────────
    const heatPulse = 0.5 + Math.sin(now / 220) * 0.45;
    CTX.fillStyle = `rgba(251,146,60,${heatPulse * 0.9})`;
    CTX.shadowBlur = 10 * heatPulse;
    CTX.shadowColor = "#fb923c";
    CTX.beginPath();
    CTX.roundRect(R * 0.18, -R * 0.08, R * 0.42, R * 0.18, R * 0.05);
    CTX.fill();
    // Second glint line above slit
    CTX.fillStyle = `rgba(255,200,100,${heatPulse * 0.45})`;
    CTX.shadowBlur = 4;
    CTX.beginPath();
    CTX.roundRect(R * 0.2, -R * 0.12, R * 0.38, R * 0.04, 1);
    CTX.fill();
    CTX.shadowBlur = 0;

    // Specular highlight
    CTX.fillStyle = "rgba(255,255,255,0.08)";
    CTX.beginPath();
    CTX.arc(-R * 0.3, -R * 0.3, R * 0.28, 0, Math.PI * 2);
    CTX.fill();

    CTX.restore(); // end body transform

    // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
    CTX.save();
    CTX.translate(sx, sy);
    CTX.rotate(e.angle);
    if (isFacingLeft) CTX.scale(1, -1);

    // Front kite-shield hand
    const shieldGlow = 0.4 + Math.sin(now / 180) * 0.25;
    CTX.fillStyle = "#57121a";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2.5;
    CTX.shadowBlur = 10 * shieldGlow;
    CTX.shadowColor = "#dc2626";
    CTX.beginPath();
    CTX.moveTo(R + 5, -R * 0.55);
    CTX.lineTo(R + 13, -R * 0.15);
    CTX.lineTo(R + 14, R * 0.3);
    CTX.lineTo(R + 5, R * 0.68);
    CTX.lineTo(R - 2, R * 0.3);
    CTX.lineTo(R - 1, -R * 0.15);
    CTX.closePath();
    CTX.fill();
    CTX.stroke();
    // Shield boss + glow
    CTX.fillStyle = "#dc2626";
    CTX.shadowBlur = 8;
    CTX.shadowColor = "#ef4444";
    CTX.beginPath();
    CTX.arc(R + 6, 0, 4, 0, Math.PI * 2);
    CTX.fill();
    // Cross scratch on shield boss
    CTX.strokeStyle = "rgba(255,100,100,0.40)";
    CTX.lineWidth = 1;
    CTX.shadowBlur = 0;
    CTX.beginPath();
    CTX.moveTo(R + 3, 0);
    CTX.lineTo(R + 9, 0);
    CTX.stroke();
    CTX.beginPath();
    CTX.moveTo(R + 6, -3);
    CTX.lineTo(R + 6, 3);
    CTX.stroke();

    // Back gauntlet
    CTX.fillStyle = "#3d0808";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2.5;
    CTX.shadowBlur = 5;
    CTX.shadowColor = "#dc2626";
    CTX.beginPath();
    CTX.arc(-(R + 7), 0, R * 0.42, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();
    // Knuckle ridge
    CTX.strokeStyle = "#5c1010";
    CTX.lineWidth = 1.5;
    CTX.beginPath();
    CTX.moveTo(-(R + 4), -3);
    CTX.lineTo(-(R + 10), -3);
    CTX.stroke();
    CTX.beginPath();
    CTX.moveTo(-(R + 4), 1);
    CTX.lineTo(-(R + 10), 1);
    CTX.stroke();
    CTX.shadowBlur = 0;

    CTX.restore(); // end weapon transform

    // ── Shared status overlays (hit flash, sticky, ignite) ────────
    EnemyRenderer._drawStatusOverlays(e, sx, sy, R, now);

    // ── HP bar (wider — tank has more HP to show) ─────────────────
    EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 44, 12, now);
  }

  // ── Mage Enemy (Arcane Shooter Drone) ────────────────────
  static drawMage(e) {
    // ╔══════════════════════════════════════════════════════════╗
    // ║  MAGE ENEMY — Arcane Shooter Drone                      ║
    // ║  Sleek green diamond-bean · Blaster · Floating orb hands ║
    // ╚══════════════════════════════════════════════════════════╝
    const screen = worldToScreen(e.x, e.y);
    const now = performance.now();
    const R = e.radius;
    const sx = screen.x,
      sy = screen.y;
    const bobOffset = Math.sin(now / 300) * 3; // hover float
    const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

    // ── Ground shadow (offset — mage floats above) ───────────────
    CTX.save();
    CTX.globalAlpha = 0.14;
    CTX.fillStyle = "rgba(0,0,0,0.85)";
    CTX.beginPath();
    CTX.ellipse(sx, sy + R + 10, R * 0.75, 3.5, 0, 0, Math.PI * 2);
    CTX.fill();
    CTX.restore();

    // ── Body Block (Body Anti-Flip + float bob) ───────────────────
    CTX.save();
    CTX.translate(sx, sy + bobOffset);
    if (isFacingLeft) CTX.scale(-1, 1);

    // Breathing
    const breathe = Math.sin(now / 170);
    CTX.scale(1 + breathe * 0.025, 1 - breathe * 0.03);

    // ── Arcane outer aura ring ────────────────────────────────────
    const auraA = 0.45 + Math.sin(now / 240) * 0.22;
    CTX.shadowBlur = 16;
    CTX.shadowColor = "rgba(126,34,206,0.85)";
    CTX.strokeStyle = `rgba(167,139,250,${auraA})`;
    CTX.lineWidth = 2.5;
    CTX.beginPath();
    CTX.arc(0, 0, R + 3, 0, Math.PI * 2);
    CTX.stroke();
    // Thin spinning accent ring (rotates with now)
    CTX.save();
    CTX.rotate(now / 1800);
    CTX.strokeStyle = `rgba(74,222,128,${auraA * 0.45})`;
    CTX.lineWidth = 1;
    CTX.setLineDash([4, 6]);
    CTX.beginPath();
    CTX.arc(0, 0, R + 6, 0, Math.PI * 2);
    CTX.stroke();
    CTX.setLineDash([]);
    CTX.restore();
    CTX.shadowBlur = 0;

    // ── Bean body — emerald gradient, diamond silhouette ──────────
    CTX.save();
    CTX.scale(0.88, 1.12); // taller/narrower = diamond
    const bodyG = CTX.createRadialGradient(-R * 0.25, -R * 0.3, 1, 0, 0, R);
    bodyG.addColorStop(0, "#1a7a40");
    bodyG.addColorStop(0.5, "#14532d");
    bodyG.addColorStop(1, "#052e16");
    CTX.fillStyle = bodyG;
    CTX.beginPath();
    CTX.arc(0, 0, R, 0, Math.PI * 2);
    CTX.fill();
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 3;
    CTX.beginPath();
    CTX.arc(0, 0, R, 0, Math.PI * 2);
    CTX.stroke();
    CTX.restore();

    // Specular highlight
    CTX.fillStyle = "rgba(255,255,255,0.13)";
    CTX.beginPath();
    CTX.arc(-R * 0.28, -R * 0.32, R * 0.26, 0, Math.PI * 2);
    CTX.fill();

    // ── Rune markings on body ─────────────────────────────────────
    CTX.save();
    CTX.beginPath();
    CTX.arc(0, 0, R - 0.5, 0, Math.PI * 2);
    CTX.clip();
    CTX.strokeStyle = "rgba(74,222,128,0.20)";
    CTX.lineWidth = 0.8;
    // Horizontal arcane band
    CTX.beginPath();
    CTX.moveTo(-R, R * 0.35);
    CTX.lineTo(R, R * 0.35);
    CTX.stroke();
    // Vertical center line
    CTX.beginPath();
    CTX.moveTo(0, -R);
    CTX.lineTo(0, R);
    CTX.stroke();
    // Diamond cross
    CTX.beginPath();
    CTX.moveTo(0, -R * 0.55);
    CTX.lineTo(R * 0.38, 0);
    CTX.lineTo(0, R * 0.55);
    CTX.lineTo(-R * 0.38, 0);
    CTX.closePath();
    CTX.stroke();
    CTX.restore();

    // ── Arcane energy core — glowing belly rune ───────────────────
    const coreP = Math.max(0, 0.4 + Math.sin(now / 190) * 0.55);
    CTX.fillStyle = `rgba(74,222,128,${coreP})`;
    CTX.shadowBlur = 16 * coreP;
    CTX.shadowColor = "#22c55e";
    CTX.beginPath();
    CTX.arc(0, R * 0.15, R * 0.28, 0, Math.PI * 2);
    CTX.fill();
    // Inner hot core
    CTX.fillStyle = `rgba(255,255,255,${coreP * 0.65})`;
    CTX.shadowBlur = 6 * coreP;
    CTX.beginPath();
    CTX.arc(0, R * 0.15, R * 0.11, 0, Math.PI * 2);
    CTX.fill();
    CTX.shadowBlur = 0;

    CTX.restore(); // end body transform

    // ── Weapon Block (Weapon Anti-Flip + float bob) ───────────────
    CTX.save();
    CTX.translate(sx, sy + bobOffset);
    CTX.rotate(e.angle);
    if (isFacingLeft) CTX.scale(1, -1);

    // ── Blaster barrel ────────────────────────────────────────────
    CTX.fillStyle = "#1a2a1a";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 1.5;
    CTX.beginPath();
    CTX.roundRect(R * 0.5, -R * 0.13, R * 0.82, R * 0.28, R * 0.06);
    CTX.fill();
    CTX.stroke();
    // Energy channel slit
    const blasterA = 0.7 + Math.sin(now / 200) * 0.28;
    CTX.fillStyle = `rgba(74,222,128,${blasterA})`;
    CTX.shadowBlur = 10 * blasterA;
    CTX.shadowColor = "#22c55e";
    CTX.beginPath();
    CTX.roundRect(R * 0.55, -R * 0.06, R * 0.74, R * 0.14, R * 0.04);
    CTX.fill();
    // Muzzle ring
    CTX.strokeStyle = `rgba(134,239,172,${blasterA})`;
    CTX.lineWidth = 1.5;
    CTX.beginPath();
    CTX.arc(R * 1.34, 0, R * 0.15, 0, Math.PI * 2);
    CTX.stroke();
    // Muzzle charge dot
    if (blasterA > 0.85) {
      CTX.fillStyle = `rgba(255,255,255,${(blasterA - 0.85) * 5})`;
      CTX.shadowBlur = 8;
      CTX.shadowColor = "#22c55e";
      CTX.beginPath();
      CTX.arc(R * 1.34, 0, R * 0.07, 0, Math.PI * 2);
      CTX.fill();
    }
    CTX.shadowBlur = 0;

    // ── Floating Arcane Orb Hands ─────────────────────────────────
    const orbPulse = 0.6 + Math.sin(now / 210 + 1.0) * 0.35;
    // Front orb — green
    CTX.fillStyle = "#14532d";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2;
    CTX.shadowBlur = 10 * orbPulse;
    CTX.shadowColor = "#22c55e";
    CTX.beginPath();
    CTX.arc(R + 4, R * 0.55, R * 0.36, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();
    CTX.fillStyle = `rgba(74,222,128,${orbPulse * 0.8})`;
    CTX.beginPath();
    CTX.arc(R + 4, R * 0.55, R * 0.18, 0, Math.PI * 2);
    CTX.fill();
    // Orb inner sparkle
    CTX.fillStyle = `rgba(255,255,255,${orbPulse * 0.55})`;
    CTX.shadowBlur = 4;
    CTX.beginPath();
    CTX.arc(R + 3, R * 0.5, R * 0.06, 0, Math.PI * 2);
    CTX.fill();
    CTX.shadowBlur = 0;

    // Back orb — dimmer violet
    CTX.fillStyle = "#1a0a2e";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2;
    CTX.shadowBlur = 6;
    CTX.shadowColor = "rgba(126,34,206,0.55)";
    CTX.beginPath();
    CTX.arc(-(R + 4), R * 0.3, R * 0.3, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();
    CTX.fillStyle = `rgba(167,139,250,${orbPulse * 0.55})`;
    CTX.beginPath();
    CTX.arc(-(R + 4), R * 0.3, R * 0.13, 0, Math.PI * 2);
    CTX.fill();
    CTX.shadowBlur = 0;

    CTX.restore(); // end weapon transform

    // ── Shared status overlays (hit flash, sticky, ignite) ────────
    // Note: use sy + bobOffset so overlays align with floating body
    EnemyRenderer._drawStatusOverlays(e, sx, sy + bobOffset, R, now);

    // ── HP bar ────────────────────────────────────────────────────
    EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 30, 14, now);
  }

  // ── Power-Up ─────────────────────────────────────────────
  static drawPowerUp(e) {
    const screen = worldToScreen(e.x, e.y + Math.sin(e.bobTimer) * 5);
    CTX.save();
    CTX.translate(screen.x, screen.y);
    CTX.shadowBlur = 20;
    CTX.shadowColor = e.colors[e.type];
    CTX.font = "32px Arial";
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";
    CTX.fillText(e.icons[e.type], 0, 0);
    CTX.restore();
  }
}

window.EnemyRenderer = EnemyRenderer;