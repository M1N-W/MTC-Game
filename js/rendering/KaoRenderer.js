"use strict";

/**
 * js/rendering/KaoRenderer.js
 * ════════════════════════════════════════════════════════════════
 * Rendering logic for Kao (Assassin)
 * ════════════════════════════════════════════════════════════════
 */

class KaoRenderer {
  /**
   * KAO CLONE
   * เดิมคือ KaoClone.draw()
   */
  static _drawKaoClone(clone, ctx) {
    const sc = worldToScreen(clone.x, clone.y);
    const aimAngle = Math.atan2(
      window.mouse.wy - clone.y,
      window.mouse.wx - clone.x
    );
    const isWM = clone.owner.isWeaponMaster;
    const accentColor = isWM ? "#facc15" : "#60a5fa";
    const now = performance.now();
    const flicker = 0.85 + Math.sin(now * 0.017) * 0.08;
    const baseAlpha =
      clone.owner.isInvisible || clone.owner.isFreeStealthActive
        ? 0.15
        : clone.alpha;

    ctx.save();
    ctx.globalAlpha = baseAlpha * flicker;

    // ── Shadow body (dark translucent fill) ──
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, clone.radius, 0, Math.PI * 2);
    ctx.fillStyle = isWM ? "rgba(250,204,21,0.12)" : "rgba(30,58,138,0.25)";
    ctx.fill();

    // ── Wireframe ring ──
    ctx.shadowBlur = 10;
    ctx.shadowColor = accentColor;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, clone.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // ── Scanlines (3 horizontal bands) ──
    ctx.save();
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, clone.radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = isWM ? "rgba(250,204,21,0.18)" : "rgba(96,165,250,0.18)";
    ctx.lineWidth = 1;
    const step = clone.radius * 0.55;
    for (let i = -1; i <= 1; i++) {
      const ly = sc.y + i * step;
      ctx.beginPath();
      ctx.moveTo(sc.x - clone.radius, ly);
      ctx.lineTo(sc.x + clone.radius, ly);
      ctx.stroke();
    }
    ctx.restore();

    // ── Dashed aim laser + tip dot ──
    const laserEnd = {
      x: sc.x + Math.cos(aimAngle) * 28,
      y: sc.y + Math.sin(aimAngle) * 28,
    };
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(sc.x, sc.y);
    ctx.lineTo(laserEnd.x, laserEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Tip dot ──
    ctx.beginPath();
    ctx.arc(laserEnd.x, laserEnd.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();

    ctx.restore();
  }

  /**
   * KAO PLAYER
   * เดิมคือ KaoPlayer.draw()  +  super.draw() → _drawBase
   */
  static _drawKao(entity, ctx) {
    // Clones ก่อน (วาดหลังพื้นหลัง)
    entity.clones.forEach((c) => KaoRenderer._drawKaoClone(c, ctx));

    const now = performance.now();
    const screen = worldToScreen(entity.x, entity.y);

    // ── Weapon Master golden aura (double ring) ───────────
    if (entity.isWeaponMaster) {
      ctx.save();
      ctx.globalAlpha = 0.28 + Math.sin(now / 150) * 0.18;
      ctx.fillStyle = "#facc15";
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#facc15";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, entity.radius + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.12 + Math.sin(now / 200) * 0.08;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#fbbf24";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, entity.radius + 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ── Sniper charge laser-sight (dual-beam) ─────────────
    if (entity.sniperChargeTime > 0) {
      const aimAngle = Math.atan2(
        window.mouse.wy - entity.y,
        window.mouse.wx - entity.x
      );
      const chargeT = Math.min(1, entity.sniperChargeTime);
      ctx.save();
      ctx.strokeStyle = `rgba(239,68,68,${chargeT * 0.22})`;
      ctx.lineWidth = 6 + chargeT * 10;
      ctx.shadowBlur = 18 * chargeT;
      ctx.shadowColor = "#ef4444";
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.lineTo(
        screen.x + Math.cos(aimAngle) * 2000,
        screen.y + Math.sin(aimAngle) * 2000
      );
      ctx.stroke();
      ctx.strokeStyle = `rgba(252,165,165,${chargeT * 0.9})`;
      ctx.lineWidth = 1 + chargeT * 1.5;
      ctx.shadowBlur = 6 * chargeT;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.lineTo(
        screen.x + Math.cos(aimAngle) * 2000,
        screen.y + Math.sin(aimAngle) * 2000
      );
      ctx.stroke();
      ctx.restore();
    }

    // ── Skill-state indicators (visible only when not stealthed) ──
    if (!entity.isInvisible && !entity.isFreeStealthActive) {
      // Teleport-ready: spinning dashed ring
      if (entity.passiveUnlocked && entity.teleportCharges > 0) {
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(now / 600);
        ctx.strokeStyle = "rgba(56,189,248,0.70)";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#38bdf8";
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, entity.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Second-wind danger ring
      if (entity.isSecondWind) {
        const swA = 0.3 + Math.sin(now / 110) * 0.2;
        ctx.save();
        ctx.globalAlpha = swA;
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#ef4444";
        ctx.beginPath();
        ctx.arc(
          screen.x,
          screen.y,
          entity.radius + 10 + Math.sin(now / 100) * 3,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Body, stealth, weapon, dash ghosts (Base) ────────
    PlayerRenderer._drawBase(entity, ctx);
  }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.KaoRenderer = KaoRenderer;
