'use strict';
/**
 * js/rendering/EnemyRenderer.js
 * Extracted enemy rendering dispatcher and shared renderer helpers.
 */

// Load-order contract: enemy.js must define Enemy/MageEnemy/TankEnemy/PowerUp before this renderer loads.

class EnemyRenderer {
  // PERF Phase 4: per-type body gradient sprite cache (offscreen canvas, lazily created)
  // Key format: `${type}_${R}` โ€” one sprite per (type ร— radius) pair (only 3 combos in practice)
  static _bodyCache = new Map();

  /**
   * PERF Phase 4: lazy offscreen sprite for the enemy body gradient.
   * @param {string} key  e.g. 'enemy_18'
   * @param {number} R    collision radius
   * @param {Function} fn (oc, R, cx, cy) => void  draws into the offscreen canvas
   */
  static _getBodySprite(key, R, fn) {
    if (EnemyRenderer._bodyCache.has(key)) return EnemyRenderer._bodyCache.get(key);
    const PAD = 3;
    const size = Math.ceil(R * 2) + PAD * 2 + 4;
    const oc = document.createElement('canvas');
    oc.width = oc.height = size;
    const ox = oc.getContext('2d');
    fn(ox, R, size / 2, size / 2);
    EnemyRenderer._bodyCache.set(key, oc);
    return oc;
  }

  // โ”€โ”€ Dispatcher โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  // Call this from the game loop instead of entity.draw().
  static draw(e, ctx) {
    // โ”€โ”€ Viewport cull โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const screen = worldToScreen(e.x, e.y);
    const R = (e.radius ?? 20) + 40; // 40px margin for auras/overlays
    if (screen.x < -R || screen.x > CANVAS.width + R ||
      screen.y < -R || screen.y > CANVAS.height + R) return;
    // PERF Phase 5: capture timestamp once for all three draw methods
    const _now = performance.now();
    // โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const _prevCTX = typeof window !== 'undefined' ? window.CTX : undefined;
    if (typeof window !== "undefined") window.CTX = ctx;
    try {
      if (e instanceof MageEnemy) EnemyRenderer.drawMage(e, _now);
      else if (e instanceof TankEnemy) EnemyRenderer.drawTank(e, _now);
      else if (e instanceof Enemy) EnemyRenderer.drawEnemy(e, _now);
      else if (e instanceof PowerUp) EnemyRenderer.drawPowerUp(e);
      // Fallback: entities with own draw() (e.g. GoldfishMinion, future minions)
      else if (typeof e.draw === "function") e.draw();
    } finally {
      if (typeof window !== "undefined" && _prevCTX !== undefined)
        window.CTX = _prevCTX;
    }
  }

  // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
  // SHARED HELPERS โ€” called by all 3 draw methods
  // Extracted to eliminate 3ร— duplicate blocks and reduce
  // per-frame GC pressure (no inline object literals in hot path)
  // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•

  /**
   * Draw HP bar above entity โ€” rounded, multi-tone, low-HP danger pulse.
   * @param {number} sx screen x  @param {number} sy screen y
   * @param {number} R  collision radius
   * @param {number} hp current HP  @param {number} maxHp max HP
   * @param {number} bw bar width (px)  @param {number} yOff y offset above head
   * @param {number} now Date.now() โ€” passed in, not re-called
   */
  static _drawHpBar(sx, sy, R, hp, maxHp, bw, yOff, now) {
    const ratio = Math.max(0, hp / maxHp);
    const bh = 5;
    const bx = sx - bw / 2;
    const by = sy - R - yOff;

    // โ”€โ”€ Low-HP danger pulse (ratio < 0.30) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
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

    // โ”€โ”€ Bar background โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    CTX.save();
    CTX.fillStyle = "rgba(0,0,0,0.65)";
    // Rounded background via clip โ€” cheap alternative to roundRect path
    CTX.beginPath();
    CTX.roundRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
    CTX.fill();

    // โ”€โ”€ Fill โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // Colour: green โ’ amber โ’ red as HP drops
    const fillColor =
      ratio > 0.6 ? "#22c55e" : ratio > 0.3 ? "#f59e0b" : "#ef4444";
    CTX.fillStyle = fillColor;
    if (ratio > 0.01) {
      CTX.beginPath();
      CTX.roundRect(bx, by, bw * ratio, bh, 2);
      CTX.fill();
    }

    // โ”€โ”€ Specular sheen on fill (top half lighter strip) โ”€โ”€
    CTX.globalAlpha = 0.28;
    CTX.fillStyle = "#ffffff";
    CTX.beginPath();
    CTX.roundRect(bx, by, bw * ratio, Math.floor(bh / 2), [2, 2, 0, 0]);
    CTX.fill();

    CTX.restore();
  }

  /**
   * Ground shadow ellipse โ€” shared across all 3 enemy types.
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
   * Status effect overlays โ€” hit flash, sticky, ignite.
   * Called AFTER the main body so overlays render on top.
   * @param {Enemy|TankEnemy|MageEnemy} e
   * @param {number} sx @param {number} sy screen coords
   * @param {number} R collision radius
   * @param {number} now Date.now() value from caller
   */
  static _drawStatusOverlays(e, sx, sy, R, now) {
    // โ”€โ”€ Hit flash โ€” white silhouette โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    if (e.hitFlashTimer > 0) {
      CTX.save();
      CTX.globalAlpha = (e.hitFlashTimer / HIT_FLASH_DURATION) * 0.8;
      CTX.fillStyle = "#ffffff";
      CTX.shadowBlur = 8;  // PERF: 10โ’8
      CTX.shadowColor = "#ffffff";
      CTX.beginPath();
      CTX.arc(sx, sy, R, 0, Math.PI * 2);
      CTX.fill();
      CTX.restore();
    }

    // โ”€โ”€ Sticky stacks โ€” green tint โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
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
        CTX.shadowBlur = 3;  // PERF: 5โ’3
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

    // โ”€โ”€ Ignite โ€” pulsing fire ring + inner ember tint โ”€โ”€โ”€โ”€โ”€
    if ((e.igniteTimer ?? 0) > 0) {
      const igPulse = 0.5 + Math.sin(now / 75) * 0.3;
      CTX.save();
      // Outer ring
      CTX.globalAlpha = igPulse;
      CTX.strokeStyle = "#f97316";
      CTX.lineWidth = 2.5;
      CTX.shadowBlur = 10;  // PERF: 14โ’10
      CTX.shadowColor = "#f97316";
      CTX.beginPath();
      CTX.arc(sx, sy, R + 4, 0, Math.PI * 2);
      CTX.stroke();
      // Second thinner outer ring (shimmer)
      CTX.globalAlpha = igPulse * 0.55;
      CTX.strokeStyle = "#fbbf24";
      CTX.lineWidth = 1;
      CTX.shadowBlur = 4;  // PERF: 6โ’4
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

  static _drawExpandedEnemyOverlay(e, sx, sy, R, now) {
    const familyColor =
      e._enemyConfig?.category === "support" ? "#67e8f9" :
        e._enemyConfig?.category === "pressure" ? "#fb7185" :
          "#93c5fd";
    if (e.type === "sniper" && (e._telegraphTimer ?? 0) > 0) {
      const chargeTime = e._enemyConfig?.chargeTime || 0.65;
      const telegraphLength = e._enemyConfig?.telegraphLength || 220;
      const alpha = Math.min(1, e._telegraphTimer / chargeTime);
      CTX.save();
      CTX.globalAlpha = 0.18 + alpha * 0.35;
      CTX.strokeStyle = familyColor;
      CTX.lineWidth = 3;
      CTX.beginPath();
      CTX.moveTo(sx, sy);
      CTX.lineTo(
        sx + Math.cos(e._lockedAim || e.angle) * telegraphLength,
        sy + Math.sin(e._lockedAim || e.angle) * telegraphLength
      );
      CTX.stroke();
      CTX.globalAlpha = 0.12 + alpha * 0.18;
      CTX.beginPath();
      CTX.arc(sx, sy, R + 10 + alpha * 8, 0, Math.PI * 2);
      CTX.stroke();
      CTX.restore();
    }

    if (e.type === "poison_spitter") {
      CTX.save();
      CTX.globalAlpha = 0.32;
      CTX.fillStyle = familyColor;
      CTX.beginPath();
      CTX.arc(sx, sy + R * 0.35, R * 0.28, 0, Math.PI * 2);
      CTX.fill();
      CTX.restore();
    }

    if (e.type === "charger" && e._state === "windup") {
      CTX.save();
      CTX.globalAlpha = 0.7;
      CTX.strokeStyle = familyColor;
      CTX.lineWidth = 2;
      CTX.beginPath();
      CTX.arc(sx, sy, R + 8 + Math.sin(now / 80) * 3, 0, Math.PI * 2);
      CTX.stroke();
      CTX.restore();
    }

    if (e.type === "hunter" && e._lockedOn) {
      CTX.save();
      CTX.globalAlpha = (e._strikeTelegraphTimer ?? 0) > 0 ? 0.78 : 0.5;
      CTX.strokeStyle = familyColor;
      CTX.lineWidth = (e._strikeTelegraphTimer ?? 0) > 0 ? 2.2 : 1.5;
      CTX.beginPath();
      CTX.arc(sx, sy, R + 6, 0, Math.PI * 2);
      CTX.stroke();
      if ((e._strikeTelegraphTimer ?? 0) > 0) {
        CTX.beginPath();
        CTX.arc(sx, sy, R + 13 + Math.sin(now / 65) * 2, 0, Math.PI * 2);
        CTX.stroke();
      }
      CTX.restore();
    }

    if (e.type === "healer" || e.type === "summoner" || e.type === "buffer") {
      CTX.save();
      CTX.globalAlpha = 0.62;
      CTX.strokeStyle = familyColor;
      CTX.lineWidth = 2;
      CTX.beginPath();
      CTX.arc(sx, sy - R * 0.2, R * 0.45, 0, Math.PI * 2);
      CTX.stroke();
      CTX.beginPath();
      CTX.moveTo(sx - R * 0.5, sy - R * 0.85);
      CTX.lineTo(sx + R * 0.5, sy - R * 0.85);
      CTX.stroke();
      CTX.restore();
    }

    if (e.type === "shield_bravo") {
      CTX.save();
      CTX.translate(sx, sy);
      CTX.rotate(e.angle);
      CTX.globalAlpha = 0.22;
      CTX.fillStyle = familyColor;
      CTX.beginPath();
      CTX.moveTo(0, 0);
      CTX.arc(0, 0, R + 12, -0.7, 0.7);
      CTX.closePath();
      CTX.fill();
      CTX.globalAlpha = 0.72;
      CTX.strokeStyle = "#e2e8f0";
      CTX.lineWidth = 4;
      CTX.beginPath();
      CTX.arc(0, 0, R + 10, -0.7, 0.7);
      CTX.stroke();
      CTX.restore();
    }
  }

  // โ”€โ”€ Basic Enemy (Corrupted Student Drone) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  static drawEnemy(e, now = performance.now()) {
    // โ•”โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•—
    // โ•‘  BASIC ENEMY โ€” Corrupted Student Drone                  โ•‘
    // โ•‘  Slim gray/purple bean ยท Dual visor ยท Spiked hands      โ•‘
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    const screen = worldToScreen(e.x, e.y);
    const R = e.radius;
    const sx = screen.x,
      sy = screen.y;
    const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

    // โ”€โ”€ Ground shadow โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    EnemyRenderer._drawGroundShadow(sx, sy, R, 0.22, 4);

    // โ”€โ”€ Body Block (Body Anti-Flip) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    CTX.save();
    CTX.translate(sx, sy);
    if (isFacingLeft) CTX.scale(-1, 1);

    // Breathing squash/stretch
    const breathe = Math.sin(now / 200);
    CTX.scale(1 + breathe * 0.028, 1 - breathe * 0.028);

    // โ”€โ”€ Outer glow ring (corrupted purple) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const glowPulse = 0.45 + Math.sin(now / 320) * 0.2;
    CTX.shadowBlur = 6;  // PERF: 12โ’6
    CTX.shadowColor = `rgba(168,85,247,${glowPulse})`;
    CTX.strokeStyle = `rgba(168,85,247,${glowPulse * 0.8})`;
    CTX.lineWidth = 2;
    CTX.beginPath();
    CTX.arc(0, 0, R + 2, 0, Math.PI * 2);
    CTX.stroke();
    CTX.shadowBlur = 0;

    // PERF Phase 4: body gradient cached as offscreen sprite
    const _eKey = `enemy_${R}`;
    const _eSprite = EnemyRenderer._getBodySprite(_eKey, R, (ox, R, cx, cy) => {
      const g = ox.createRadialGradient(cx - R * 0.25, cy - R * 0.25, 1, cx, cy, R);
      g.addColorStop(0, '#5a5a7a'); g.addColorStop(0.5, '#2d2d44'); g.addColorStop(1, '#1a1a2e');
      ox.fillStyle = g;
      ox.beginPath(); ox.arc(cx, cy, R, 0, Math.PI * 2); ox.fill();
      ox.strokeStyle = '#1e293b'; ox.lineWidth = 3;
      ox.beginPath(); ox.arc(cx, cy, R, 0, Math.PI * 2); ox.stroke();
      ox.fillStyle = 'rgba(255,255,255,0.12)';
      ox.beginPath(); ox.arc(cx - R * 0.32, cy - R * 0.32, R * 0.32, 0, Math.PI * 2); ox.fill();
    });
    CTX.drawImage(_eSprite, -(_eSprite.width / 2), -(_eSprite.height / 2));

    // โ”€โ”€ Corrupted circuit lines on body surface โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
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

    // โ”€โ”€ Dual visor slits (side-by-side, glowing red) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const visorPulse = 0.7 + Math.sin(now / 280) * 0.28;
    const vp2 = 0.55 + Math.sin(now / 220 + 0.9) * 0.28;
    // Left shard
    CTX.fillStyle = `rgba(239,68,68,${visorPulse})`;
    CTX.shadowBlur = 6;  // PERF: 12โ’6
    CTX.shadowColor = "#ef4444";
    CTX.beginPath();
    CTX.roundRect(-R * 0.45, -R * 0.22, R * 0.38, R * 0.18, R * 0.05);
    CTX.fill();
    // Right shard (slightly offset, slightly different pulse)
    CTX.fillStyle = `rgba(239,68,68,${vp2})`;
    CTX.shadowBlur = 5;  // PERF: 10โ’5
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

    // โ”€โ”€ Weapon Block (Weapon Anti-Flip) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    CTX.save();
    CTX.translate(sx, sy);
    CTX.rotate(e.angle);
    if (isFacingLeft) CTX.scale(1, -1);

    const handR = R * 0.38;

    // Front hand โ€” weapon-pointing side
    CTX.fillStyle = "#3b3b55";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2;
    CTX.shadowBlur = 3;  // PERF: 6โ’3
    CTX.shadowColor = "rgba(168,85,247,0.55)";
    CTX.beginPath();
    CTX.arc(R + 7, 0, handR, 0, Math.PI * 2);
    CTX.fill();
    CTX.stroke();

    // Front spike โ€” larger jagged triangle + inner glow tip
    const fsx = R + 7 + handR;
    CTX.fillStyle = "#ef4444";
    CTX.shadowBlur = 4;  // PERF: 8โ’4
    CTX.shadowColor = "#ef4444";
    CTX.beginPath();
    CTX.moveTo(fsx, -1.5); // base top
    CTX.lineTo(fsx + 9, 0); // tip
    CTX.lineTo(fsx, 5); // base bottom
    CTX.lineTo(fsx - 1.5, 1.5); // notch
    CTX.closePath();
    CTX.fill();
    CTX.shadowBlur = 0;

    // Back hand โ€” off-side
    CTX.fillStyle = "#2d2d44";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2;
    CTX.shadowBlur = 2;  // PERF: 3โ’2
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

    // โ”€โ”€ Shared status overlays (hit flash, sticky, ignite) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    EnemyRenderer._drawStatusOverlays(e, sx, sy, R, now);
    EnemyRenderer._drawExpandedEnemyOverlay(e, sx, sy, R, now);

    // โ”€โ”€ HP bar โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 30, 10, now);
  }

  // โ”€โ”€ Tank Enemy (Heavy Armored Brute) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  static drawTank(e, now = performance.now()) {
    // โ•”โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•—
    // โ•‘  TANK ENEMY โ€” Heavy Armored Brute                       โ•‘
    // โ•‘  Wide dark-red bean ยท Layered armor ยท Kite-shield fists  โ•‘
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    const screen = worldToScreen(e.x, e.y);
    const R = e.radius;
    const sx = screen.x,
      sy = screen.y;
    const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

    // โ”€โ”€ Ground shadow (wider for big body) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    EnemyRenderer._drawGroundShadow(sx, sy, R, 0.3, 5);

    // โ”€โ”€ Body Block (Body Anti-Flip) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    CTX.save();
    CTX.translate(sx, sy);
    if (isFacingLeft) CTX.scale(-1, 1);

    // Tank breathes slower, heavier
    const breathe = Math.sin(now / 320);
    CTX.scale(1 + breathe * 0.022, 1 - breathe * 0.022);

    // โ”€โ”€ Threat glow ring โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const threatPulse = 0.55 + Math.sin(now / 250) * 0.22;
    CTX.shadowBlur = 8;  // PERF: 16โ’8
    CTX.shadowColor = `rgba(185,28,28,${threatPulse})`;
    CTX.strokeStyle = `rgba(185,28,28,${threatPulse * 0.75})`;
    CTX.lineWidth = 3;
    CTX.beginPath();
    CTX.arc(0, 0, R + 3, 0, Math.PI * 2);
    CTX.stroke();
    CTX.shadowBlur = 0;

    // PERF Phase 4: tank body gradient cached as offscreen sprite
    CTX.save();
    CTX.scale(1.15, 1.0);
    const _tKey = `tank_${R}`;
    const _tSprite = EnemyRenderer._getBodySprite(_tKey, R, (ox, R, cx, cy) => {
      const g = ox.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 1, cx, cy, R);
      g.addColorStop(0, '#8f2020'); g.addColorStop(0.5, '#4a0d0d'); g.addColorStop(1, '#2d0606');
      ox.fillStyle = g;
      ox.beginPath(); ox.arc(cx, cy, R, 0, Math.PI * 2); ox.fill();
      ox.strokeStyle = '#1e293b'; ox.lineWidth = 3;
      ox.beginPath(); ox.arc(cx, cy, R, 0, Math.PI * 2); ox.stroke();
    });
    CTX.drawImage(_tSprite, -(_tSprite.width / 2), -(_tSprite.height / 2));
    CTX.restore();

    // โ”€โ”€ Layered armor plates โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
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

    // โ”€โ”€ Overheating slit โ€” orange engine glow โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const heatPulse = 0.5 + Math.sin(now / 220) * 0.45;
    CTX.fillStyle = `rgba(251,146,60,${heatPulse * 0.9})`;
    CTX.shadowBlur = 5 * heatPulse;  // PERF: 10xโ’5x
    CTX.shadowColor = "#fb923c";
    CTX.beginPath();
    CTX.roundRect(R * 0.18, -R * 0.08, R * 0.42, R * 0.18, R * 0.05);
    CTX.fill();
    // Second glint line above slit
    CTX.fillStyle = `rgba(255,200,100,${heatPulse * 0.45})`;
    CTX.shadowBlur = 2;  // PERF: 4โ’2
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

    // โ”€โ”€ Weapon Block (Weapon Anti-Flip) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    CTX.save();
    CTX.translate(sx, sy);
    CTX.rotate(e.angle);
    if (isFacingLeft) CTX.scale(1, -1);

    // Front kite-shield hand
    const shieldGlow = 0.4 + Math.sin(now / 180) * 0.25;
    CTX.fillStyle = "#57121a";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2.5;
    CTX.shadowBlur = 5 * shieldGlow;  // PERF: 10xโ’5x
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
    CTX.shadowBlur = 4;  // PERF: 8โ’4
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
    CTX.shadowBlur = 3;  // PERF: 5โ’3
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

    // โ”€โ”€ Shared status overlays (hit flash, sticky, ignite) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    EnemyRenderer._drawStatusOverlays(e, sx, sy, R, now);
    EnemyRenderer._drawExpandedEnemyOverlay(e, sx, sy, R, now);

    // โ”€โ”€ HP bar (wider โ€” tank has more HP to show) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 44, 12, now);
  }

  // โ”€โ”€ Mage Enemy (Arcane Shooter Drone) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  static drawMage(e, now = performance.now()) {
    // โ•”โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•—
    // โ•‘  MAGE ENEMY โ€” Arcane Shooter Drone                      โ•‘
    // โ•‘  Sleek green diamond-bean ยท Blaster ยท Floating orb hands โ•‘
    // โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•โ•
    const screen = worldToScreen(e.x, e.y);
    const R = e.radius;
    const sx = screen.x,
      sy = screen.y;
    const bobOffset = Math.sin(now / 300) * 3; // hover float
    const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

    // โ”€โ”€ Ground shadow (offset โ€” mage floats above) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    CTX.save();
    CTX.globalAlpha = 0.14;
    CTX.fillStyle = "rgba(0,0,0,0.85)";
    CTX.beginPath();
    CTX.ellipse(sx, sy + R + 10, R * 0.75, 3.5, 0, 0, Math.PI * 2);
    CTX.fill();
    CTX.restore();

    // โ”€โ”€ Body Block (Body Anti-Flip + float bob) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    CTX.save();
    CTX.translate(sx, sy + bobOffset);
    if (isFacingLeft) CTX.scale(-1, 1);

    // Breathing
    const breathe = Math.sin(now / 170);
    CTX.scale(1 + breathe * 0.025, 1 - breathe * 0.03);

    // โ”€โ”€ Arcane outer aura ring โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const auraA = 0.45 + Math.sin(now / 240) * 0.22;
    CTX.shadowBlur = 8;  // PERF: 16โ’8
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

    // PERF Phase 4: mage body gradient cached as offscreen sprite
    CTX.save();
    CTX.scale(0.88, 1.12); // taller/narrower = diamond
    const _mKey = `mage_${R}`;
    const _mSprite = EnemyRenderer._getBodySprite(_mKey, R, (ox, R, cx, cy) => {
      const g = ox.createRadialGradient(cx - R * 0.25, cy - R * 0.3, 1, cx, cy, R);
      g.addColorStop(0, '#1a7a40'); g.addColorStop(0.5, '#14532d'); g.addColorStop(1, '#052e16');
      ox.fillStyle = g;
      ox.beginPath(); ox.arc(cx, cy, R, 0, Math.PI * 2); ox.fill();
      ox.strokeStyle = '#1e293b'; ox.lineWidth = 3;
      ox.beginPath(); ox.arc(cx, cy, R, 0, Math.PI * 2); ox.stroke();
      ox.fillStyle = 'rgba(255,255,255,0.13)';
      ox.beginPath(); ox.arc(cx - R * 0.28, cy - R * 0.32, R * 0.26, 0, Math.PI * 2); ox.fill();
    });
    CTX.drawImage(_mSprite, -(_mSprite.width / 2), -(_mSprite.height / 2));
    CTX.restore(); // specular baked into sprite

    // โ”€โ”€ Rune markings on body โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
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

    // โ”€โ”€ Arcane energy core โ€” glowing belly rune โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const coreP = Math.max(0, 0.4 + Math.sin(now / 190) * 0.55);
    CTX.fillStyle = `rgba(74,222,128,${coreP})`;
    CTX.shadowBlur = 8 * coreP;  // PERF: 16xโ’8x
    CTX.shadowColor = "#22c55e";
    CTX.beginPath();
    CTX.arc(0, R * 0.15, R * 0.28, 0, Math.PI * 2);
    CTX.fill();
    // Inner hot core
    CTX.fillStyle = `rgba(255,255,255,${coreP * 0.65})`;
    CTX.shadowBlur = 3 * coreP;  // PERF: 6xโ’3x
    CTX.beginPath();
    CTX.arc(0, R * 0.15, R * 0.11, 0, Math.PI * 2);
    CTX.fill();
    CTX.shadowBlur = 0;

    CTX.restore(); // end body transform

    // โ”€โ”€ Weapon Block (Weapon Anti-Flip + float bob) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    CTX.save();
    CTX.translate(sx, sy + bobOffset);
    CTX.rotate(e.angle);
    if (isFacingLeft) CTX.scale(1, -1);

    // โ”€โ”€ Blaster barrel โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
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
    CTX.shadowBlur = 5 * blasterA;  // PERF: 10xโ’5x
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
      CTX.shadowBlur = 4;  // PERF: 8โ’4
      CTX.shadowColor = "#22c55e";
      CTX.beginPath();
      CTX.arc(R * 1.34, 0, R * 0.07, 0, Math.PI * 2);
      CTX.fill();
    }
    CTX.shadowBlur = 0;

    // โ”€โ”€ Floating Arcane Orb Hands โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    const orbPulse = 0.6 + Math.sin(now / 210 + 1.0) * 0.35;
    // Front orb โ€” green
    CTX.fillStyle = "#14532d";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2;
    CTX.shadowBlur = 5 * orbPulse;  // PERF: 10xโ’5x
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
    CTX.shadowBlur = 3;  // PERF: 6โ’3
    CTX.beginPath();
    CTX.arc(R + 3, R * 0.5, R * 0.06, 0, Math.PI * 2);
    CTX.fill();
    CTX.shadowBlur = 0;

    // Back orb โ€” dimmer violet
    CTX.fillStyle = "#1a0a2e";
    CTX.strokeStyle = "#1e293b";
    CTX.lineWidth = 2;
    CTX.shadowBlur = 3;  // PERF: 6โ’3
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

    // โ”€โ”€ Shared status overlays (hit flash, sticky, ignite) โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // Note: use sy + bobOffset so overlays align with floating body
    EnemyRenderer._drawStatusOverlays(e, sx, sy + bobOffset, R, now);
    EnemyRenderer._drawExpandedEnemyOverlay(e, sx, sy + bobOffset, R, now);

    // โ”€โ”€ HP bar โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    EnemyRenderer._drawHpBar(sx, sy, R, e.hp, e.maxHp, 30, 14, now);
  }

  // โ”€โ”€ Power-Up โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
  static drawPowerUp(e) {
    const screen = worldToScreen(e.x, e.y + Math.sin(e.bobTimer) * 5);
    CTX.save();
    CTX.translate(screen.x, screen.y);
    CTX.shadowBlur = 10;  // PERF: 20โ’10
    CTX.shadowColor = e.colors[e.type];
    CTX.font = "32px Arial";
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";
    CTX.fillText(e.icons[e.type], 0, 0);
    CTX.restore();
  }
}

window.EnemyRenderer = EnemyRenderer;
