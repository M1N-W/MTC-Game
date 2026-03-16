"use strict";
/**
 * js/rendering/PlayerRenderer.js
 * ════════════════════════════════════════════════════════════════
 * Step 4: Rendering Decoupling — PlayerRenderer
 *
 * รวมโค้ดวาดทั้งหมดของ Player classes ไว้ที่นี่
 * Dispatcher และ Shared Utilities (Aura, Shield, Badge)
 *
 * CHANGELOG:
 *  - แยกตัวละครออกไปที่ KaoRenderer, AutoRenderer, PoomRenderer, PatRenderer
 *  - PlayerRenderer.draw() ทำหน้าที่เป็น Dispatcher
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────
 *  L.25   class PlayerRenderer
 *  L.42   static _getCamScale()          camera zoom scale helper
 *  L.54   static draw()                  entry point (Dispatcher)
 *  L.115  static _standAuraDraw()        shared aura router
 *  L.135  static _drawEnergyShield()     shared shield ring
 *  L.162  static _drawLevelBadge()       shared level badge
 *  L.194  static _drawLowHpGlow()        shared HP warning ring
 *  L.218  static _drawHitFlash()         shared damage flash
 *  L.248  static _drawGroundShadow()     shared shadow helper
 *  L.267  static _drawGroundFeet()       shared feet helper
 *  L.292  static _getLimbParams()        shared animation params
 *  L.370  static _drawBase()             generic fallback / Kao body
 * ════════════════════════════════════════════════════════════════
 */

class PlayerRenderer {
  // ══════════════════════════════════════════════════════════
  // INTERNAL HELPER — camera scale
  // ══════════════════════════════════════════════════════════

  /**
   * Returns px-per-world-unit scale for the current camera.
   */
  static _getCamScale(worldX) {
    if (window.camera?.zoom != null) return window.camera.zoom;
    return worldToScreen(worldX + 1, 0).x - worldToScreen(worldX, 0).x;
  }

  // ══════════════════════════════════════════════════════════
  // PUBLIC ENTRY POINT — dispatcher
  // ══════════════════════════════════════════════════════════

  /**
   * วาด player ทุก type
   */
  static draw(entity, ctx) {
    if (!entity || !ctx) return;
    const now = performance.now();

    // Dispatch to character-specific renderers
    switch (entity.characterType) {
      case "kao":
        if (window.KaoRenderer) {
          KaoRenderer._drawKao(entity, ctx);
        } else {
          PlayerRenderer._drawKao(entity, ctx);
        }
        break;
      case "auto":
        if (window.AutoRenderer) {
          AutoRenderer._drawAuto(entity, ctx);
        } else {
          PlayerRenderer._drawAuto(entity, ctx);
        }
        break;
      case "poom":
        if (window.PoomRenderer) {
          PoomRenderer._drawPoom(entity, ctx);
        } else {
          PlayerRenderer._drawPoom(entity, ctx);
        }
        break;
      case "pat":
        if (window.PatRenderer) {
          PatRenderer._drawPat(entity, ctx);
        } else {
          PlayerRenderer._drawPat(entity, ctx);
        }
        break;
      default:
        // Fallback for character types or if not defined
        if (typeof AutoPlayer !== "undefined" && entity instanceof AutoPlayer) {
          if (window.AutoRenderer) AutoRenderer._drawAuto(entity, ctx);
          else PlayerRenderer._drawAuto(entity, ctx);
        } else if (
          typeof PoomPlayer !== "undefined" &&
          entity instanceof PoomPlayer
        ) {
          if (window.PoomRenderer) PoomRenderer._drawPoom(entity, ctx);
          else PlayerRenderer._drawPoom(entity, ctx);
        } else if (
          typeof KaoPlayer !== "undefined" &&
          entity instanceof KaoPlayer
        ) {
          if (window.KaoRenderer) KaoRenderer._drawKao(entity, ctx);
          else PlayerRenderer._drawKao(entity, ctx);
        } else if (
          typeof PatPlayer !== "undefined" &&
          entity instanceof PatPlayer
        ) {
          if (window.PatRenderer) PatRenderer._drawPat(entity, ctx);
          else PlayerRenderer._drawPat(entity, ctx);
        } else {
          PlayerRenderer._drawBase(entity, ctx);
        }
        break;
    }

    // ── Contact Warning Ring — แสดงเมื่อโดน melee ─────────
    if ((entity._contactWarningTimer ?? 0) > 0) {
      const t = entity._contactWarningTimer;
      const ratio = t / 1.2;
      const pulse = Math.sin(now / 80) * 0.3 + 0.7;
      const screen = worldToScreen(entity.x, entity.y);
      const R = (entity.radius || 20) + 8 + (1 - ratio) * 14;

      ctx.save();
      ctx.globalAlpha = ratio * pulse * 0.85;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#fbbf24";
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // ══════════════════════════════════════════════════════════
  // HELPER — Stand Aura (ใช้ร่วมกันทุก character)
  // ══════════════════════════════════════════════════════════

  static _standAuraDraw(entity, charId, ctx) {
    if (charId === "auto") {
      if (window.AutoRenderer) {
        AutoRenderer._drawAutoAura(entity, ctx);
      } else {
        // Fallback if AutoRenderer not loaded
      }
      return;
    }
    if (typeof _standAura_draw === "function") {
      _standAura_draw(entity, charId);
    }
  }

  // ══════════════════════════════════════════════════════════
  // SHARED HELPERS
  // ══════════════════════════════════════════════════════════

  /**
   * Energy shield ring
   */
  static _drawEnergyShield(ctx, now) {
    const shieldT = now / 200;
    const pulse = 0.6 + Math.sin(shieldT) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 15 + Math.sin(shieldT * 1.4) * 5;
    ctx.shadowColor = "#8b5cf6";
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(139,92,246,0.15)";
    ctx.fill();
    ctx.globalAlpha = pulse * 0.55;
    ctx.strokeStyle = "#c4b5fd";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#c4b5fd";
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 25, shieldT * 2.5, shieldT * 2.5 + Math.PI * 1.2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Level badge
   */
  static _drawLevelBadge(ctx, screen, entity, badgeColor, ox = 20, oy = -20) {
    if ((entity.level ?? 1) <= 1) return;
    const bx = screen.x + ox,
      by = screen.y + oy;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.arc(bx, by, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = badgeColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = badgeColor;
    ctx.beginPath();
    ctx.arc(bx, by, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.40)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(bx, by - 1.5, 7.5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 9px "Orbitron",Arial,sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(entity.level, bx, by + 0.5);
    ctx.restore();
  }

  /**
   * Low-HP danger pulse ring
   */
  static _drawLowHpGlow(ctx, entity, now, screen) {
    if (!entity.maxHp) return;
    const ratio = entity.hp / entity.maxHp;
    if (ratio >= 0.3) return;
    const severity = 1 - ratio / 0.3;
    const pulse = 0.22 + Math.sin(now / 100) * 0.18;
    const R = (entity.radius || 18) + 10 + Math.sin(now / 90) * 3;
    ctx.save();
    ctx.globalAlpha = pulse * severity;
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 18 + Math.sin(now / 80) * 8;
    ctx.shadowColor = "#ef4444";
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  /**
   * Hit flash overlay
   */
  static _drawHitFlash(ctx, entity, bodyR) {
    const t = entity._hitFlashTimer ?? 0;
    if (t <= 0) return;
    const alpha = t * (entity._hitFlashBig ? 0.82 : 0.52);
    const r = bodyR + (entity._hitFlashBig ? t * 5 : t * 2);
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.fillStyle = entity._hitFlashBig ? "#fca5a5" : "#fecaca";
    ctx.shadowBlur = entity._hitFlashBig ? 18 : 8;
    ctx.shadowColor = "#ef4444";
    ctx.beginPath();
    ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.55 * (1 - t * 0.5);
    ctx.strokeStyle = entity._hitFlashBig ? "#ef4444" : "#fca5a5";
    ctx.lineWidth = entity._hitFlashBig ? 2.5 : 1.5;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** Ground shadow */
  static _drawGroundShadow(ctx, sx, sy, baseRx, baseRy, baseOffY, limb) {
    ctx.save();
    ctx.globalAlpha = 0.26 * limb.shadowAlphaMod;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.beginPath();
    ctx.ellipse(
      sx,
      sy + baseOffY + limb.bobOffsetY,
      baseRx * limb.shadowScaleX,
      baseRy * limb.shadowScaleY,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  /** Foot placement dots */
  static _drawGroundFeet(ctx, sx, sy, limb, color, entity) {
    if (entity.isInvisible || entity.isFreeStealthActive) return;
    if (limb.moveT < 0.05) return;
    const { footL, footR } = limb;
    ctx.save();
    ctx.globalAlpha = limb.moveT * 0.55;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(sx + footL.x, sy + footL.y, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + footR.x, sy + footR.y, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Compute shared limb/motion parameters
   */
  static _getLimbParams(entity, now, speedCap = 180) {
    const A = entity._anim ?? {};
    const spd = Math.hypot(entity.vx ?? 0, entity.vy ?? 0);
    const rawMoveT = Math.min(1, spd / speedCap);
    const moveT =
      A.smoothMoveT !== undefined
        ? Math.min(1, A.smoothMoveT * (speedCap / 180))
        : rawMoveT;
    const bob = Math.sin(entity.walkCycle ?? 0);
    const breathe = Math.sin(now / 220);
    const stretchX = 1 + breathe * 0.025 + moveT * bob * 0.09;
    const stretchY = 1 - breathe * 0.025 - moveT * Math.abs(bob) * 0.065;
    const sT = A.shootT ?? 0;
    const shootLift = sT * -8;
    const shootReach = sT * 5;
    const hT = A.hurtT ?? 0;
    const aimAngle =
      A.smoothAngle !== null && A.smoothAngle !== undefined
        ? A.smoothAngle
        : entity.angle ?? 0;
    const hurtPushX = -Math.cos(aimAngle) * hT * 6;
    const hurtPushY = -Math.sin(aimAngle) * hT * 6;
    const runLean = moveT * 0.12;
    const dT = A.dashT ?? 0;
    const dashStretchX = 1 + dT * 0.18;
    const shadowScaleX = (1 + dT * 0.35) * (1 - (A.hurtT ?? 0) * 0.15);
    const shadowScaleY = (1 - dT * 0.25) * (1 - (A.hurtT ?? 0) * 0.1);
    const shadowAlphaMod = 1 - moveT * 0.28;
    const footSwing = moveT * 5;
    const footLift = moveT * Math.abs(bob) * 4;
    const footPhase = entity.walkCycle ?? 0;
    const footL = {
      x: -4 + Math.sin(footPhase) * footSwing,
      y: 8 - Math.max(0, Math.sin(footPhase)) * footLift,
    };
    const footR = {
      x: 4 - Math.sin(footPhase) * footSwing,
      y: 8 - Math.max(0, -Math.sin(footPhase)) * footLift,
    };

    return {
      moveT,
      bob,
      breathe,
      stretchX: stretchX * (dT > 0.01 ? dashStretchX : 1),
      stretchY,
      bobOffsetY: moveT * Math.abs(bob) * 2.5,
      shootLift,
      shootReach,
      hurtPushX,
      hurtPushY,
      runLean,
      dashStretchX,
      animState: A.state ?? "idle",
      shadowScaleX,
      shadowScaleY,
      shadowAlphaMod,
      footL,
      footR,
    };
  }

  // ══════════════════════════════════════════════════════════
  // BASE PLAYER (Kao body / generic)
  // ══════════════════════════════════════════════════════════

  static _drawBase(entity, ctx) {
    const now = performance.now();
    PlayerRenderer._standAuraDraw(entity, entity.charId || "kao", ctx);

    const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;
    const facingSign = isFacingLeft ? -1 : 1;

    const {
      moveT,
      bob: bobT,
      stretchX,
      stretchY,
      bobOffsetY: kaoBobY,
      hurtPushX,
      hurtPushY,
      shootLift,
      shootReach,
      runLean,
      shadowScaleX,
      shadowScaleY,
      shadowAlphaMod,
      footL,
      footR,
    } = PlayerRenderer._getLimbParams(entity, now, 200);
    const limbBase = {
      shadowScaleX,
      shadowScaleY,
      shadowAlphaMod,
      footL,
      footR,
      moveT,
      bobOffsetY: kaoBobY,
    };
    const recoilAmt =
      entity.weaponRecoil > 0.05 ? entity.weaponRecoil * 3.5 : 0;
    const recoilX = -Math.cos(entity.angle) * recoilAmt + hurtPushX;
    const recoilY = -Math.sin(entity.angle) * recoilAmt + hurtPushY;
    const R = 13;

    for (const img of entity.dashGhosts) {
      const gs = worldToScreen(img.x, img.y);
      ctx.save();
      ctx.globalAlpha = img.life * 0.35;
      ctx.fillStyle = "#60a5fa";
      ctx.shadowBlur = 10 * img.life;
      ctx.shadowColor = "#3b82f6";
      ctx.beginPath();
      ctx.arc(gs.x, gs.y, R + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const screen = worldToScreen(entity.x, entity.y);
    PlayerRenderer._drawGroundShadow(ctx, screen.x, screen.y, 14, 5, 15, {
      ...limbBase,
      bobOffsetY: kaoBobY,
    });
    PlayerRenderer._drawGroundFeet(
      ctx,
      screen.x,
      screen.y,
      limbBase,
      "#0f2140",
      entity
    );

    if (entity.passiveUnlocked) {
      const aS = 30 + Math.sin(now / 200) * 4;
      const aA = 0.3 + Math.sin(now / 300) * 0.1;
      ctx.save();
      ctx.globalAlpha = aA;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#fbbf24";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, aS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (entity.isConfused) {
      ctx.font = "bold 22px Arial";
      ctx.textAlign = "center";
      ctx.fillText("😵", screen.x, screen.y - 32);
    }
    if (entity.isBurning) {
      ctx.font = "bold 18px Arial";
      ctx.fillText("🔥", screen.x + 18, screen.y - 26);
    }

    if (entity.isInvisible || entity.isFreeStealthActive) {
      const gT = now / 60;
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.scale(stretchX * facingSign, stretchY);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.clip();
      const holoShift = (now / 800) % 1;
      const holoG = ctx.createLinearGradient(-R, -R, R, R);
      holoG.addColorStop(
        0,
        `rgba(6,182,212,${0.08 + Math.sin(gT * 0.7) * 0.04})`
      );
      holoG.addColorStop(Math.max(0, holoShift - 0.1), `rgba(6,182,212,0.04)`);
      holoG.addColorStop(
        holoShift,
        `rgba(180,230,255,${0.22 + Math.sin(gT * 1.3) * 0.1})`
      );
      holoG.addColorStop(Math.min(1, holoShift + 0.1), `rgba(99,179,237,0.06)`);
      holoG.addColorStop(
        1,
        `rgba(56,189,248,${0.06 + Math.sin(gT * 0.9 + 1) * 0.03})`
      );
      ctx.globalAlpha = 1;
      ctx.fillStyle = holoG;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      const dissolvePixels = [
        [-8, -9, 4, 2],
        [3, -7, 5, 2],
        [-5, -4, 3, 2],
        [6, -2, 4, 2],
        [-9, 2, 5, 2],
        [2, 5, 6, 2],
        [-3, 8, 4, 2],
        [7, 7, 3, 2],
        [-6, -12, 3, 2],
        [4, -11, 5, 2],
        [-10, 6, 3, 2],
        [8, 3, 4, 2],
      ];
      for (let di = 0; di < dissolvePixels.length; di++) {
        const [px, py, pw, ph] = dissolvePixels[di];
        const pixA = (Math.sin(gT * 3.7 + di * 1.57) * 0.5 + 0.5) * 0.55;
        if (pixA < 0.05) continue;
        ctx.globalAlpha = pixA;
        ctx.fillStyle =
          di % 3 === 0 ? "#06b6d4" : di % 3 === 1 ? "#38bdf8" : "#7dd3fc";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "#06b6d4";
        ctx.fillRect(px, py, pw, ph);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
      const ringHue1 = `rgba(6,182,212,${0.2 + Math.sin(gT * 2.1) * 0.1})`;
      const ringHue2 = `rgba(56,189,248,${
        0.12 + Math.sin(gT * 1.5 + 1) * 0.08
      })`;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ringHue1;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#06b6d4";
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = ringHue2;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#38bdf8";
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, R + 3, gT * 0.8, gT * 0.8 + Math.PI * 1.4);
      ctx.stroke();
      ctx.setLineDash([]);
      const vGhost = 0.3 + Math.sin(gT * 5) * 0.18;
      ctx.globalAlpha = vGhost;
      ctx.fillStyle = "#06b6d4";
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#06b6d4";
      ctx.beginPath();
      ctx.roundRect(-5, -3.5, 10, 2, 1);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(screen.x + recoilX, screen.y + recoilY + kaoBobY);
      ctx.scale(stretchX * facingSign, stretchY);
      ctx.rotate(runLean * facingSign);
      ctx.shadowBlur = 16;
      ctx.shadowColor = "rgba(0,255,65,0.70)";
      ctx.strokeStyle = "rgba(0,255,65,0.45)";
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(0, 0, R + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      const bodyG = ctx.createRadialGradient(-3, -3, 1, 0, 0, R);
      bodyG.addColorStop(0, "#1d3461");
      bodyG.addColorStop(0.55, "#0f2140");
      bodyG.addColorStop(1, "#07111e");
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.beginPath();
      ctx.arc(-4, -5, 5.5, 0, Math.PI * 2);
      ctx.fill();
      const hoodG = ctx.createLinearGradient(0, -R - 8, 0, 2);
      hoodG.addColorStop(0, "#0d1f38");
      hoodG.addColorStop(0.6, "#0b1623");
      hoodG.addColorStop(1, "#071020");
      ctx.fillStyle = hoodG;
      ctx.beginPath();
      ctx.moveTo(-(R - 1), -1);
      ctx.quadraticCurveTo(-(R + 2), -R * 0.45, -R * 0.35, -R - 5);
      ctx.quadraticCurveTo(0, -R - 8, R * 0.35, -R - 5);
      ctx.quadraticCurveTo(R + 2, -R * 0.45, R - 1, -1);
      ctx.quadraticCurveTo(R * 0.55, 1, 0, 2);
      ctx.quadraticCurveTo(-R * 0.55, 1, -(R - 1), -1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1e3a5f";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#1d4ed8";
      ctx.beginPath();
      ctx.moveTo(-(R - 1), -1);
      ctx.quadraticCurveTo(-(R + 2), -R * 0.45, -R * 0.35, -R - 5);
      ctx.quadraticCurveTo(0, -R - 8, R * 0.35, -R - 5);
      ctx.quadraticCurveTo(R + 2, -R * 0.45, R - 1, -1);
      ctx.quadraticCurveTo(R * 0.55, 1, 0, 2);
      ctx.quadraticCurveTo(-R * 0.55, 1, -(R - 1), -1);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-(R - 1), -1);
      ctx.quadraticCurveTo(-(R + 2), -R * 0.45, -R * 0.35, -R - 5);
      ctx.quadraticCurveTo(0, -R - 8, R * 0.35, -R - 5);
      ctx.quadraticCurveTo(R + 2, -R * 0.45, R - 1, -1);
      ctx.quadraticCurveTo(R * 0.55, 1, 0, 2);
      ctx.quadraticCurveTo(-R * 0.55, 1, -(R - 1), -1);
      ctx.clip();
      ctx.strokeStyle = "rgba(59,130,246,0.18)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-R, -R);
      ctx.lineTo(-R * 0.3, -R * 0.6);
      ctx.lineTo(-R * 0.3, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(R * 0.1, -R);
      ctx.lineTo(R * 0.1, -R * 0.5);
      ctx.lineTo(R * 0.5, -R * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(R, -R * 0.5);
      ctx.lineTo(R * 0.6, -R * 0.5);
      ctx.lineTo(R * 0.6, -2);
      ctx.stroke();
      ctx.fillStyle = "rgba(6,182,212,0.45)";
      for (const [nx, ny] of [
        [-R * 0.3, -R * 0.6],
        [-R * 0.3, -2],
        [R * 0.1, -R * 0.5],
        [R * 0.6, -R * 0.5],
        [R * 0.6, -2],
      ]) {
        ctx.beginPath();
        ctx.arc(nx, ny, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "#16304f";
      ctx.beginPath();
      ctx.moveTo(-7, -R - 3);
      ctx.quadraticCurveTo(-2, -R - 6, 3, -R - 5);
      ctx.quadraticCurveTo(1, -R - 1, -3, -R);
      ctx.quadraticCurveTo(-6, -R, -7, -R - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1e40af";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(R * 0.35, -3);
      ctx.lineTo(R + 1, -2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-R * 0.35, -3);
      ctx.lineTo(-R - 1, -2);
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(R * 0.55, -3.5);
      ctx.lineTo(R * 0.55, -0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-R * 0.55, -3.5);
      ctx.lineTo(-R * 0.55, -0.5);
      ctx.stroke();
      ctx.shadowBlur = 0;
      const vp = 0.65 + Math.sin(now / 350) * 0.35;
      const vp2 = 0.55 + Math.sin(now / 280 + 1.2) * 0.35;
      ctx.fillStyle = `rgba(6,182,212,${vp})`;
      ctx.shadowBlur = 14 * vp;
      ctx.shadowColor = "#06b6d4";
      ctx.beginPath();
      ctx.roundRect(-6.5, -4, 5.5, 2.2, 1.5);
      ctx.fill();
      ctx.fillStyle = `rgba(56,189,248,${vp2})`;
      ctx.shadowBlur = 10 * vp2;
      ctx.shadowColor = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(1.5, -4, 5, 2.2, 1.5);
      ctx.fill();
      ctx.fillStyle = `rgba(6,182,212,${vp * 0.15})`;
      ctx.beginPath();
      ctx.roundRect(-7, -6, 14, 6, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = "rgba(30,64,175,0.35)";
      ctx.lineWidth = 0.9;
      const hx = 0,
        hy = 5,
        hr = 4.5;
      ctx.beginPath();
      for (let hi = 0; hi < 6; hi++) {
        const ha = (hi / 6) * Math.PI * 2 - Math.PI / 6;
        if (hi === 0)
          ctx.moveTo(hx + Math.cos(ha) * hr, hy + Math.sin(ha) * hr);
        else ctx.lineTo(hx + Math.cos(ha) * hr, hy + Math.sin(ha) * hr);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = `rgba(6,182,212,${0.08 + Math.sin(now / 400) * 0.04})`;
      ctx.fill();
      ctx.restore();
      PlayerRenderer._drawHitFlash(ctx, entity, R);
      if (entity.hasShield) PlayerRenderer._drawEnergyShield(ctx, now);
      ctx.restore();
      ctx.save();
      ctx.translate(screen.x + recoilX, screen.y + recoilY + kaoBobY);
      ctx.rotate(entity.angle);
      if (isFacingLeft) ctx.scale(1, -1);
      ctx.translate(shootReach, shootLift);
      if ((entity._anim?.skillT ?? 0) > 0)
        ctx.translate(0, entity._anim.skillT * 8);
      if (typeof weaponSystem !== "undefined")
        weaponSystem.drawWeaponOnPlayer(entity);
      const gR = 5;
      const gloveG = ctx.createRadialGradient(R + 4, 0, 0, R + 6, 2, gR);
      gloveG.addColorStop(0, "#1e4a7f");
      gloveG.addColorStop(1, "#0e2340");
      ctx.fillStyle = gloveG;
      ctx.strokeStyle = "#1e3a5f";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#06b6d4";
      ctx.beginPath();
      ctx.arc(R + 6, 2, gR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(6,182,212,0.70)";
      ctx.lineWidth = 1.0;
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#06b6d4";
      ctx.beginPath();
      ctx.moveTo(R + 3, 0.5);
      ctx.lineTo(R + 9, 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(R + 3, 2.8);
      ctx.lineTo(R + 9, 2.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(R + 3, 4.8);
      ctx.lineTo(R + 9, 4.8);
      ctx.stroke();
      const kp = 0.5 + Math.sin(now / 250) * 0.4;
      ctx.fillStyle = `rgba(6,182,212,${kp})`;
      ctx.shadowBlur = 6 * kp;
      ctx.shadowColor = "#38bdf8";
      ctx.beginPath();
      ctx.arc(R + 10.5, 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#0e2340";
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#06b6d4";
      ctx.beginPath();
      ctx.arc(-(R + 5), 1, gR - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(6,182,212,0.40)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-(R + 2), 0);
      ctx.lineTo(-(R + 8), 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      if (entity.weaponRecoil > 0.45) {
        const fT = (entity.weaponRecoil - 0.45) / 0.55;
        const mDist = 36 + (1 - fT) * 10;
        const mx = screen.x + Math.cos(entity.angle) * mDist;
        const my = screen.y + Math.sin(entity.angle) * mDist;
        ctx.save();
        const swR = 4 + (1 - fT) * 18;
        ctx.globalAlpha = fT * 0.65;
        ctx.strokeStyle = "#e0f2fe";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#06b6d4";
        ctx.beginPath();
        ctx.arc(mx, my, swR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = fT * 0.35;
        ctx.strokeStyle = "#7dd3fc";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(mx, my, swR * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = "#e0f2fe";
        ctx.lineWidth = 1.6;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#38bdf8";
        const fwdRays = 5;
        for (let ri = 0; ri < fwdRays; ri++) {
          const spread = (ri / (fwdRays - 1) - 0.5) * (Math.PI * 0.45);
          const ra = entity.angle + spread;
          const rayLen =
            (8 + fT * 14) * (1 - Math.abs(spread) / (Math.PI * 0.5));
          ctx.globalAlpha = fT * (0.8 - Math.abs(spread) * 0.6);
          ctx.beginPath();
          ctx.moveTo(mx + Math.cos(ra) * 2, my + Math.sin(ra) * 2);
          ctx.lineTo(mx + Math.cos(ra) * rayLen, my + Math.sin(ra) * rayLen);
          ctx.stroke();
        }
        ctx.strokeStyle = "#7dd3fc";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 6;
        for (let ri = 0; ri < 4; ri++) {
          const ra = entity.angle + Math.PI * 0.55 + (ri / 3) * Math.PI * 0.9;
          ctx.globalAlpha = fT * 0.3;
          ctx.beginPath();
          ctx.moveTo(mx + Math.cos(ra) * 2, my + Math.sin(ra) * 2);
          ctx.lineTo(
            mx + Math.cos(ra) * (3 + fT * 5),
            my + Math.sin(ra) * (3 + fT * 5)
          );
          ctx.stroke();
        }
        ctx.globalAlpha = fT;
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#06b6d4";
        ctx.beginPath();
        ctx.arc(mx, my, 2.5 + fT * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    PlayerRenderer._drawLowHpGlow(ctx, entity, now, screen);
    if ((entity._weaponSwitchFlash ?? 0) > 0) {
      const wsT = entity._weaponSwitchFlash;
      const wsRatio = wsT / 0.5;
      const wsAlpha = wsRatio * (0.7 + Math.sin(wsRatio * Math.PI) * 0.3);
      const wsScreen = worldToScreen(entity.x, entity.y);
      const wIcon =
        entity.currentWeapon === "sniper"
          ? "🎯"
          : entity.currentWeapon === "shotgun"
          ? "💥"
          : "⚡";
      ctx.save();
      ctx.globalAlpha = wsAlpha;
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14 * wsRatio;
      ctx.shadowColor = "#06b6d4";
      ctx.beginPath();
      ctx.arc(wsScreen.x, wsScreen.y, 20 + (1 - wsRatio) * 10, 0, Math.PI * 2);
      ctx.stroke();
      const riseY = wsScreen.y - 28 - (1 - wsRatio) * 14;
      ctx.globalAlpha = wsAlpha * 0.95;
      ctx.font = `${12 + wsRatio * 4}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#06b6d4";
      ctx.fillText(wIcon, wsScreen.x, riseY);
      ctx.restore();
    }
    PlayerRenderer._drawLevelBadge(
      ctx,
      screen,
      entity,
      "rgba(180,100,10,0.92)",
      20,
      -20
    );
  }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.PlayerRenderer = PlayerRenderer;
