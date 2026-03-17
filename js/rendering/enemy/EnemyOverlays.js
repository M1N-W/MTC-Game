"use strict";
/**
 * js/rendering/enemy/EnemyOverlays.js
 * ════════════════════════════════════════════════════════════════
 * Modular status-effect overlay system for all enemy types.
 * Replaces the monolithic EnemyRenderer._drawStatusOverlays() body.
 *
 * RULES:
 *  - Pure draw — zero state mutation, zero Math.random()
 *  - Every overlay method owns one ctx.save()/restore() pair
 *  - All style values from RT.* — never hardcode hex here
 *  - shadowBlur MUST be reset to 0 before ctx.restore()
 *  - Called AFTER the entity body draw, BEFORE the HP bar
 *
 * LOAD ORDER:
 *  RenderTokens.js → RenderSkins.js → EnemyOverlays.js → [other renderers]
 *  (enemy.js loads before, but only calls EnemyOverlays at runtime — safe)
 *
 * HOW TO ADD A NEW OVERLAY:
 *  1. Add a static _drawXxx(e, sx, sy, R, now) method
 *  2. Guard with the relevant entity property (e.g. e.freezeTimer > 0)
 *  3. Call it from EnemyOverlays.draw() in the right Z order
 *  4. Add any new RT tokens needed to RenderTokens.js + reset()
 *
 * OVERLAY Z-ORDER (bottom → top):
 *  1. slowRing    — before sticky so it underlays the green
 *  2. sticky      — green tint + pips
 *  3. ignite      — fire ring (on top of green)
 *  4. hitFlash    — always topmost, white silhouette
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────
 *  L.46  EnemyOverlays.draw()          dispatcher — call this from EnemyRenderer
 *  L.59  EnemyOverlays._drawSlowRing() NEW: ice/slow ring overlay
 *  L.92  EnemyOverlays._drawSticky()   sticky-stacks green tint + pip ring
 *  L.132 EnemyOverlays._drawIgnite()   pulsing fire ring + ember fill
 *  L.163 EnemyOverlays._drawHitFlash() white silhouette burst
 * ════════════════════════════════════════════════════════════════
 */

class EnemyOverlays {

  /**
   * Master dispatcher — call once per entity per frame.
   * Order defines Z-order: later calls paint on top.
   *
   * @param {EnemyBase} e        entity instance
   * @param {number}    sx       screen x
   * @param {number}    sy       screen y
   * @param {number}    R        collision radius (px)
   * @param {number}    now      performance.now() from caller — do NOT re-call
   */
  static draw(e, sx, sy, R, now) {
    if (typeof RT === 'undefined') return;
    EnemyOverlays._drawSlowRing(e, sx, sy, R, now);
    EnemyOverlays._drawSticky(e, sx, sy, R, now);
    EnemyOverlays._drawIgnite(e, sx, sy, R, now);
    EnemyOverlays._drawHitFlash(e, sx, sy, R);
  }

  // ── NEW: Slow / Freeze ring ─────────────────────────────────────────────
  /**
   * Icy blue rotating ring — shown when enemy is significantly slowed.
   * Trigger: stickySlowMultiplier < 0.70 (heavy slow, regardless of stacks).
   * Layered UNDER the sticky green overlay so both are visible when combined.
   *
   * @param {EnemyBase} e
   * @param {number} sx @param {number} sy  screen coords
   * @param {number} R  collision radius
   * @param {number} now performance.now()
   */
  static _drawSlowRing(e, sx, sy, R, now) {
    if ((e.stickySlowMultiplier ?? 1) >= 0.70) return;

    const t = now / 1000;
    // Rotate dash offset for "icy crawl" effect — deterministic, no RNG
    const dashOffset = (t * 40) % 60;
    const pulse = 0.55 + Math.sin(t * 3.5) * 0.2;

    CTX.save();

    // Outer rotating dashed ring
    CTX.globalAlpha = pulse * 0.85;
    CTX.strokeStyle = RT.palette.slowRing;
    CTX.lineWidth = 2;
    CTX.shadowBlur = 10;
    CTX.shadowColor = RT.palette.slowRing;
    CTX.setLineDash([8, 6]);
    CTX.lineDashOffset = -dashOffset;
    CTX.beginPath();
    CTX.arc(sx, sy, R + 6, 0, Math.PI * 2);
    CTX.stroke();
    CTX.setLineDash([]);

    // Inner frost fill
    CTX.globalAlpha = pulse * 0.12;
    CTX.fillStyle = RT.palette.slowFill;
    CTX.shadowBlur = 0;
    CTX.beginPath();
    CTX.arc(sx, sy, R, 0, Math.PI * 2);
    CTX.fill();

    CTX.shadowBlur = 0;
    CTX.restore();
  }

  // ── Sticky stacks — green tint + pip dots ──────────────────────────────
  /**
   * @param {EnemyBase} e
   * @param {number} sx @param {number} sy  screen coords
   * @param {number} R  collision radius
   * @param {number} now performance.now() — reserved for future pulse
   */
  static _drawSticky(e, sx, sy, R, now) {
    if ((e.stickyStacks ?? 0) <= 0) return;

    const intensity = Math.min(1, e.stickyStacks / 10);

    CTX.save();

    // Body tint
    CTX.globalAlpha = 0.4 * intensity;
    CTX.fillStyle = RT.palette.sticky;
    CTX.beginPath();
    CTX.arc(sx, sy, R, 0, Math.PI * 2);
    CTX.fill();

    // Orbital pip dots — shown at 3+ stacks
    if (e.stickyStacks >= 3) {
      const pipCount = Math.min(e.stickyStacks, 6);
      CTX.globalAlpha = 0.85;
      CTX.fillStyle = RT.palette.stickyPip;
      CTX.shadowBlur = 5;
      CTX.shadowColor = RT.palette.stickyPip;
      for (let pi = 0; pi < pipCount; pi++) {
        const pa = (pi / pipCount) * Math.PI * 2 - Math.PI / 2;
        CTX.beginPath();
        CTX.arc(
          sx + Math.cos(pa) * (R + 6),
          sy + Math.sin(pa) * (R + 6),
          2, 0, Math.PI * 2
        );
        CTX.fill();
      }
      CTX.shadowBlur = 0;
    }

    CTX.restore();
  }

  // ── Ignite — pulsing fire ring + inner ember fill ──────────────────────
  /**
   * @param {EnemyBase} e
   * @param {number} sx @param {number} sy  screen coords
   * @param {number} R  collision radius
   * @param {number} now performance.now()
   */
  static _drawIgnite(e, sx, sy, R, now) {
    if ((e.igniteTimer ?? 0) <= 0) return;

    const igPulse = 0.5 + Math.sin(now / 75) * 0.3;

    CTX.save();

    // Outer fire ring
    CTX.globalAlpha = igPulse;
    CTX.strokeStyle = RT.palette.bossOrange;
    CTX.lineWidth = 2.5;
    CTX.shadowBlur = 14;
    CTX.shadowColor = RT.palette.bossOrange;
    CTX.beginPath();
    CTX.arc(sx, sy, R + 4, 0, Math.PI * 2);
    CTX.stroke();

    // Second shimmer ring
    CTX.globalAlpha = igPulse * 0.55;
    CTX.strokeStyle = RT.palette.gold;
    CTX.lineWidth = 1;
    CTX.shadowBlur = 6;
    CTX.shadowColor = RT.palette.gold;
    CTX.beginPath();
    CTX.arc(sx, sy, R + 7 + Math.sin(now / 60) * 2, 0, Math.PI * 2);
    CTX.stroke();

    // Inner ember fill
    CTX.globalAlpha = igPulse * 0.22;
    CTX.fillStyle = RT.palette.bossOrangeMid;
    CTX.shadowBlur = 0;
    CTX.beginPath();
    CTX.arc(sx, sy, R, 0, Math.PI * 2);
    CTX.fill();

    CTX.shadowBlur = 0;
    CTX.restore();
  }

  // ── Hit flash — white silhouette burst ─────────────────────────────────
  /**
   * @param {EnemyBase} e
   * @param {number} sx @param {number} sy  screen coords
   * @param {number} R  collision radius
   */
  static _drawHitFlash(e, sx, sy, R) {
    if ((e.hitFlashTimer ?? 0) <= 0) return;

    CTX.save();
    CTX.globalAlpha = (e.hitFlashTimer / HIT_FLASH_DURATION) * 0.8;
    CTX.fillStyle = RT.palette.white;
    CTX.shadowBlur = 10;
    CTX.shadowColor = RT.palette.white;
    CTX.beginPath();
    CTX.arc(sx, sy, R, 0, Math.PI * 2);
    CTX.fill();
    CTX.shadowBlur = 0;
    CTX.restore();
  }
}

window.EnemyOverlays = EnemyOverlays;
