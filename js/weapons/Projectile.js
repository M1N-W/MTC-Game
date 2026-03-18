"use strict";

/**
 * js/weapons/Projectile.js
 * ════════════════════════════════════════════════
 * Projectile base class. Rendering logic has been
 * moved to js/rendering/ProjectileRenderer.js.
 * ════════════════════════════════════════════════
 */

// ============================================================================
// 🚀 PROJECTILE CLASS
// ============================================================================
class Projectile {
  constructor(x, y, angle, speed, damage, color, isCrit, team, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.color = color;
    this.team = team;

    this.life = options && options.life !== undefined ? options.life : 3;
    this.angle = angle;
    this.isCrit = isCrit;

    this.kind = options?.kind || "bullet";
    this.size =
      options && options.size !== undefined ? options.size : isCrit ? 24 : 14;
    this.radius = options && options.radius !== undefined ? options.radius : 10;
    this.pierce = options && options.pierce !== undefined ? options.pierce : 0;

    // --- RICOCHET PROPERTY ---
    this.bounces =
      options && options.bounces !== undefined ? options.bounces : 0;

    this.hitSet = null;
    this.symbol = options?.symbol || this.getSymbol(isCrit, team);

    // For Poom character
    this.isPoom = options?.isPoom || false;
    this.weaponKind = options?.weaponKind || null;
  }

  getSymbol(isCrit, team) {
    if (team === "player") return isCrit ? "∑" : "x";
    const symbols = ["sin", "cos", "tan", "√", "π", "-b±√", "dx", "dy", "Δ"];
    return randomChoice(symbols);
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    // (ผู้เล่น = ล็อกตามทิศ), (ศัตรู = หมุนตามเดิม);
    if (this.team === "player") {
      this.angle = Math.atan2(this.vy, this.vx);
    } else {
      this.angle += dt * 2;
    }

    // --- BULLET-PROOF RICOCHET & BOUNDARY PHYSICS ---
    const _wb =
      typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.physics?.worldBounds
        ? GAME_CONFIG.physics.worldBounds
        : 1500;
    const minX = -_wb,
      maxX = _wb;
    const minY = -_wb,
      maxY = _wb;

    let hitWall = false;

    if (this.x - this.radius < minX) {
      this.x = minX + this.radius;
      hitWall = true;
      if (this.bounces > 0) {
        this.vx *= -1;
        this.bounces--;
        this.angle = Math.atan2(this.vy, this.vx);
      }
    } else if (this.x + this.radius > maxX) {
      this.x = maxX - this.radius;
      hitWall = true;
      if (this.bounces > 0) {
        this.vx *= -1;
        this.bounces--;
        this.angle = Math.atan2(this.vy, this.vx);
      }
    }

    if (this.y - this.radius < minY) {
      this.y = minY + this.radius;
      hitWall = true;
      if (this.bounces > 0) {
        this.vy *= -1;
        this.bounces--;
        this.angle = Math.atan2(this.vy, this.vx);
      }
    } else if (this.y + this.radius > maxY) {
      this.y = maxY - this.radius;
      hitWall = true;
      if (this.bounces > 0) {
        this.vy *= -1;
        this.bounces--;
        this.angle = Math.atan2(this.vy, this.vx);
      }
    }

    if (hitWall && this.bounces <= 0) {
      this.life = 0;
    }

    if (this.kind !== "punch" && Math.random() < 0.15) {
      spawnParticles(this.x, this.y, 1, this.color);
    }

    return this.life <= 0;
  }

  checkCollision(entity) {
    const r = this.radius !== undefined ? this.radius : 10;
    return circleCollision(
      this.x,
      this.y,
      r,
      entity.x,
      entity.y,
      entity.radius
    );
  }
}

window.Projectile = Projectile;
