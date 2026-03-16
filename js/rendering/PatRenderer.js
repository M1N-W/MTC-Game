"use strict";

/**
 * js/rendering/PatRenderer.js
 * ════════════════════════════════════════════════════════════════
 * Rendering logic for Pat (Samurai Ronin)
 * ════════════════════════════════════════════════════════════════
 */

class PatRenderer {
  /**
   * MAIN PAT BODY + KATANA
   * เดิมคือ PatPlayer.draw()
   */
  static _drawPat(entity, ctx) {
    const now = performance.now();
    PlayerRenderer._standAuraDraw(entity, "pat", ctx);

    const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;
    const facingSign = isFacingLeft ? -1 : 1;

    const {
      moveT,
      bob: bobT,
      stretchX,
      stretchY,
      bobOffsetY: bobY,
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
    const limbPat = {
      shadowScaleX,
      shadowScaleY,
      shadowAlphaMod,
      footL,
      footR,
      moveT,
      bobOffsetY: bobY,
    };
    const recoilAmt =
      entity.weaponRecoil > 0.05 ? entity.weaponRecoil * 3.5 : 0;
    const recoilX = -Math.cos(entity.angle) * recoilAmt + hurtPushX;
    const recoilY = -Math.sin(entity.angle) * recoilAmt + hurtPushY;
    const R = 13;

    const isCharge = entity._iaidoPhase === "charge";
    const isCinematic = entity._iaidoPhase === "cinematic";
    const bladeGuard = entity.bladeGuardActive ?? false;
    const arcDur = 0.25;
    const arcT = Math.max(0, (entity._attackArcTimer ?? 0) / arcDur);
    const arcActive = arcT > 0;
    const arcAngle = entity._attackArcAngle ?? entity.angle;
    const isCritArc = entity._isCritArc ?? false;

    const ghosts = entity._zanzoGhosts;
    if (ghosts) {
      for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        if (!g.active || g.alpha <= 0) continue;
        const gs = worldToScreen(g.x, g.y);
        if (!gs) continue;
        ctx.save();
        ctx.globalAlpha = g.alpha * 0.65;
        ctx.translate(gs.x, gs.y);
        ctx.scale(facingSign, 1);
        ctx.fillStyle = "#4a90d9";
        ctx.shadowBlur = 16 * g.alpha;
        ctx.shadowColor = "#4a90d9";
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = g.alpha * 0.4;
        ctx.beginPath();
        ctx.moveTo(-R * 0.6, R * 0.2);
        ctx.quadraticCurveTo(-R * 1.45, R * 0.7, -R * 1.1, R * 1.3);
        ctx.quadraticCurveTo(-R * 0.5, R * 1.6, -R * 0.1, R * 1.0);
        ctx.quadraticCurveTo(-R * 0.28, R * 0.5, -R * 0.6, R * 0.2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(R * 0.6, R * 0.2);
        ctx.quadraticCurveTo(R * 1.45, R * 0.7, R * 1.1, R * 1.3);
        ctx.quadraticCurveTo(R * 0.5, R * 1.6, R * 0.1, R * 1.0);
        ctx.quadraticCurveTo(R * 0.28, R * 0.5, R * 0.6, R * 0.2);
        ctx.fill();
        ctx.globalAlpha = g.alpha * 0.6;
        ctx.beginPath();
        ctx.moveTo(-(R - 1), -2);
        ctx.quadraticCurveTo(-R - 2, -R * 0.72, -R * 0.28, -R - 3.5);
        ctx.quadraticCurveTo(0, -R - 6, R * 0.28, -R - 3.5);
        ctx.quadraticCurveTo(R + 2, -R * 0.72, R - 1, -2);
        ctx.quadraticCurveTo(0, 0, -(R - 1), -2);
        ctx.fill();
        ctx.globalAlpha = g.alpha * 0.48;
        ctx.save();
        ctx.rotate(g.angle);
        ctx.translate(R * 0.88, 0);
        const BLg = R * 3.0;
        ctx.beginPath();
        ctx.moveTo(0, -1.3);
        ctx.lineTo(BLg, 0);
        ctx.lineTo(0, 1.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    for (const img of entity.dashGhosts) {
      const gs = worldToScreen(img.x, img.y);
      if (!gs) continue;
      ctx.save();
      ctx.globalAlpha = img.life * 0.28;
      ctx.fillStyle = "#6ab4d4";
      ctx.shadowBlur = 14 * img.life;
      ctx.shadowColor = "#4a90d9";
      ctx.beginPath();
      ctx.arc(gs.x, gs.y, R + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const screen = worldToScreen(entity.x, entity.y);
    if (!screen) return;

    PlayerRenderer._drawGroundShadow(ctx, screen.x + 2, screen.y, 16, 5.5, 16, {
      ...limbPat,
      bobOffsetY: bobY,
    });
    PlayerRenderer._drawGroundFeet(
      ctx,
      screen.x,
      screen.y,
      limbPat,
      "#07101e",
      entity
    );

    if (entity.passiveUnlocked) {
      const aP = 0.28 + Math.sin(now / 320) * 0.09;
      const aR = 32 + Math.sin(now / 210) * 3.5;
      ctx.save();
      ctx.globalAlpha = aP;
      ctx.strokeStyle = "#7ec8e3";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 22;
      ctx.shadowColor = "#4ab8d8";
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, aR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = aP * 0.3;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#ef4444";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, aR - 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (isCharge) {
      const chargeT = Math.min(1, (entity._iaidoTimer ?? 0) / 0.6);
      ctx.save();
      ctx.globalAlpha = 0.15 + chargeT * 0.52;
      ctx.strokeStyle = "#a8d8ea";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 14 + chargeT * 24;
      ctx.shadowColor = "#7ec8e3";
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -(now / 80);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, R + 8 + chargeT * 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = chargeT * 0.62;
      ctx.strokeStyle = "#e8f4ff";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, R + 3 + chargeT * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (bladeGuard) {
      const bgP = 0.3 + Math.sin(now / 110) * 0.12;
      const zoom = typeof cameraZoom !== "undefined" ? cameraZoom : 1;
      const bgR = (entity.stats?.bladeGuardReflectRadius ?? 55) * zoom;
      const rotA = now / 800;
      ctx.save();
      ctx.globalAlpha = bgP;
      ctx.strokeStyle = "#c8e8f8";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 22;
      ctx.shadowColor = "#7ec8e3";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, bgR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = bgP * 0.8;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, bgR, rotA, rotA + Math.PI * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, bgR, rotA + Math.PI, rotA + Math.PI * 1.7);
      ctx.stroke();
      ctx.globalAlpha = bgP * 0.06;
      ctx.fillStyle = "#7ec8e3";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, bgR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if ((entity._zanzoAmbushTimer ?? 0) > 0) {
      const ambT =
        entity._zanzoAmbushTimer / (entity.stats?.zanzoAmbushWindow ?? 1.5);
      const pulse = 0.5 + Math.sin(now / 75) * 0.32;
      ctx.save();
      ctx.globalAlpha = ambT * pulse;
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#fde68a";
      const tickR = R + 9,
        tickLen = 5.5;
      for (let a = 0; a < 4; a++) {
        const ang = (a / 4) * Math.PI * 2 + now / 580;
        ctx.beginPath();
        ctx.moveTo(
          screen.x + Math.cos(ang) * tickR,
          screen.y + Math.sin(ang) * tickR
        );
        ctx.lineTo(
          screen.x + Math.cos(ang) * (tickR + tickLen),
          screen.y + Math.sin(ang) * (tickR + tickLen)
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    if (arcActive) {
      const comboStep = entity._meleeVisualStep ?? 0;
      const isMeleeArc = entity._attackArcTimer <= 0.18;
      const arcColor = isCritArc
        ? "#facc15"
        : isMeleeArc && comboStep === 2
        ? "#e8c0f8"
        : "#7ec8e3";
      const arcGlow = isCritArc
        ? "#fde68a"
        : isMeleeArc && comboStep === 2
        ? "#c080e8"
        : "#38d0f8";
      const arcSweepMap = [Math.PI * 0.8, Math.PI * 0.25, Math.PI * 1.2];
      const arcSweep = isCritArc
        ? Math.PI * 1.0
        : isMeleeArc
        ? arcSweepMap[comboStep]
        : Math.PI * 0.8;
      const arcStart = arcAngle - arcSweep / 2;
      const arcEnd = arcAngle + arcSweep / 2;
      const arcR = R + 10 + (1 - arcT) * 24;

      ctx.save();
      ctx.lineCap = "round";
      ctx.globalAlpha = arcT * 0.72;
      ctx.strokeStyle = arcColor;
      ctx.lineWidth = 5 + (1 - arcT) * 4;
      ctx.shadowBlur = 28 * arcT;
      ctx.shadowColor = arcGlow;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, arcR, arcStart, arcEnd);
      ctx.stroke();
      ctx.globalAlpha = arcT * 0.88;
      ctx.strokeStyle = "#f5faff";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, arcR, arcStart, arcEnd);
      ctx.stroke();
      ctx.fillStyle = arcColor;
      ctx.shadowBlur = 16 * arcT;
      ctx.shadowColor = arcGlow;
      ctx.globalAlpha = arcT * 0.75;
      for (let si = 0; si < 2; si++) {
        const sa = si === 0 ? arcStart : arcEnd;
        ctx.beginPath();
        ctx.arc(
          screen.x + Math.cos(sa) * arcR,
          screen.y + Math.sin(sa) * arcR,
          2.8 * arcT,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.lineCap = "butt";
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

    const zanzoAmbushT = entity._zanzoAmbushTimer ?? 0;
    if (zanzoAmbushT > 0) {
      const zRatio = zanzoAmbushT / (entity.stats?.zanzoAmbushWindow ?? 1.5);
      const phase1 = Math.sin(now / 55) * 2.5 * zRatio;
      const phase2 = Math.sin(now / 80 + 1.2) * 2.0 * zRatio;
      ctx.save();
      ctx.globalAlpha = zRatio * 0.22;
      ctx.strokeStyle = "#7ec8e3";
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#38d0f8";
      ctx.beginPath();
      ctx.arc(screen.x + phase1, screen.y + phase2, R + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(screen.x - phase2, screen.y - phase1, R + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    const reflectT = (entity._reflectFlashTimer ?? 0) / 0.32;
    if (reflectT > 0) {
      ctx.save();
      ctx.translate(screen.x, screen.y);
      const rEase = reflectT * reflectT;
      ctx.lineCap = "round";
      for (let ri = 0; ri < 6; ri++) {
        const seed = ri * ((Math.PI * 2) / 6);
        const rayLen = rEase * (28 + ri * 3);
        ctx.globalAlpha = rEase * (0.7 - ri * 0.05);
        ctx.strokeStyle = ri % 2 === 0 ? "#ffffff" : "#7ec8e3";
        ctx.lineWidth = 1.8 - ri * 0.1;
        ctx.shadowBlur = 14 * rEase;
        ctx.shadowColor = "#c8e8f8";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(seed) * rayLen, Math.sin(seed) * rayLen);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // ════ LAYER 1 — BODY ════
    ctx.save();
    const crouchY = isCharge ? 5 : 0;
    const crouchSY = isCharge ? 0.85 : 1.0;
    const breathActive = !isCharge && !isCinematic && !bladeGuard && !arcActive;
    const breathY = breathActive ? Math.sin(now / 1100) * 1.5 : 0;
    ctx.translate(
      screen.x + recoilX,
      screen.y + recoilY + bobY + crouchY + breathY
    );
    ctx.scale(stretchX * facingSign, stretchY * crouchSY);
    if (isCharge) {
      const iaidoMaxT = (entity.stats?.iaidoChargeDur ?? 0.45) + 0.3;
      const iaidoLean = Math.min(
        0.28,
        ((entity._anim?.skillT ?? 0) / iaidoMaxT) * 0.28
      );
      ctx.rotate(iaidoLean * facingSign);
    } else {
      ctx.rotate(runLean * facingSign);
    }

    ctx.shadowBlur = isCharge ? 24 : 9;
    ctx.shadowColor = isCharge ? "#a8d8ea" : "rgba(126,200,227,0.45)";
    ctx.strokeStyle = isCharge
      ? "rgba(168,216,234,0.55)"
      : "rgba(126,200,227,0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R + 2.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const bodyG = ctx.createRadialGradient(-4, -5, 1, 0, 0, R);
    bodyG.addColorStop(0, "#121a2e");
    bodyG.addColorStop(0.52, "#07101e");
    bodyG.addColorStop(1, "#020810");
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0c1622";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(210,215,228,0.83)";
    ctx.fillRect(-R, -R, R * 2, R * 0.62);
    ctx.fillStyle = "rgba(14,18,44,0.95)";
    ctx.fillRect(-R, R * 0.55, R * 2, R);
    ctx.fillStyle = "rgba(7,4,1,0.97)";
    ctx.fillRect(-R, R * 0.48, R * 2, 5.5);
    ctx.strokeStyle = "rgba(130,85,18,0.38)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-R, R * 0.48 + 2.5);
    ctx.lineTo(R, R * 0.48 + 2.5);
    ctx.stroke();
    ctx.fillStyle = "rgba(195,155,108,0.72)";
    ctx.beginPath();
    ctx.moveTo(-4.5, -R * 0.56);
    ctx.lineTo(0, R * 0.26);
    ctx.lineTo(4.5, -R * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(200,208,222,0.88)";
    ctx.beginPath();
    ctx.moveTo(-5.5, -R);
    ctx.lineTo(0.5, R * 0.26);
    ctx.lineTo(-1.2, R * 0.26);
    ctx.lineTo(-R * 0.5, -R);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(5.5, -R);
    ctx.lineTo(-0.5, R * 0.26);
    ctx.lineTo(1.2, R * 0.26);
    ctx.lineTo(R * 0.5, -R);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(110,118,135,0.42)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-R * 0.44, -R);
    ctx.lineTo(-1.0, R * 0.26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(R * 0.44, -R);
    ctx.lineTo(1.0, R * 0.26);
    ctx.stroke();
    ctx.strokeStyle = "rgba(16,10,3,0.82)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (let wi = 0; wi < 4; wi++) {
      const wy = R * 0.1 - 1.8 + wi * 2.2;
      ctx.globalAlpha = 0.68 - wi * 0.1;
      ctx.beginPath();
      ctx.moveTo(R * 0.68 - 4, wy);
      ctx.lineTo(R * 0.68 + 3, wy + 1.0);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.arc(-4.5, -5.5, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0c0a05";
    ctx.beginPath();
    ctx.moveTo(-(R - 1), -2);
    ctx.quadraticCurveTo(-R - 2, -R * 0.72, -R * 0.28, -R - 3.5);
    ctx.quadraticCurveTo(0, -R - 6, R * 0.28, -R - 3.5);
    ctx.quadraticCurveTo(R + 2, -R * 0.72, R - 1, -2);
    ctx.quadraticCurveTo(R * 0.55, 0.5, 0, 1.2);
    ctx.quadraticCurveTo(-R * 0.55, 0.5, -(R - 1), -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#181410";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-(R - 1), -2);
    ctx.quadraticCurveTo(-R - 2, -R * 0.72, -R * 0.28, -R - 3.5);
    ctx.quadraticCurveTo(0, -R - 6, R * 0.28, -R - 3.5);
    ctx.quadraticCurveTo(R + 2, -R * 0.72, R - 1, -2);
    ctx.stroke();
    ctx.fillStyle = "#131008";
    ctx.beginPath();
    ctx.ellipse(0, -R - 6, 4.5, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1710";
    ctx.beginPath();
    ctx.ellipse(0, -R - 9.5, 4.2, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.beginPath();
    ctx.ellipse(-0.8, -R - 11, 2, 1.6, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(185,142,42,0.75)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, -R - 6.2, 4.2, 2.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#0c0a05";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(-R * 0.58, -R + 1);
    ctx.quadraticCurveTo(-R * 0.78, -R - 2, -R * 0.46, -R + 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(R * 0.48, -R + 2);
    ctx.quadraticCurveTo(R * 0.7, -R - 1.5, R * 0.4, -R + 5.5);
    ctx.stroke();
    ctx.globalAlpha = 0.48;
    ctx.beginPath();
    ctx.moveTo(-R * 0.82, -R * 0.55);
    ctx.quadraticCurveTo(-R * 0.96, -R * 0.1, -R * 0.76, R * 0.12);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.5, 0, Math.PI * 2);
    ctx.clip();
    const faceG = ctx.createLinearGradient(0, -R * 0.52, 0, -R * 0.05);
    faceG.addColorStop(0, "rgba(205,166,122,0.92)");
    faceG.addColorStop(1, "rgba(180,144,102,0.52)");
    ctx.fillStyle = faceG;
    ctx.fillRect(-R * 0.52, -R * 0.52, R * 1.04, R * 0.5);
    ctx.restore();

    const gLR = 3.8,
      gY = -R * 0.2;
    ctx.fillStyle = "rgba(126,200,227,0.18)";
    ctx.strokeStyle = "#252020";
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 5;
    ctx.shadowColor = "rgba(126,200,227,0.42)";
    ctx.beginPath();
    ctx.arc(-gLR * 1.35, gY, gLR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gLR * 1.35, gY, gLR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(-gLR * 0.35, gY);
    ctx.lineTo(gLR * 0.35, gY);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    ctx.beginPath();
    ctx.arc(-gLR * 1.35 - 1.2, gY - 1.4, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gLR * 1.35 - 1.2, gY - 1.4, 0.9, 0, Math.PI * 2);
    ctx.fill();

    if (bladeGuard) {
      ctx.globalAlpha = 0.09 + Math.sin(now / 100) * 0.04;
      ctx.fillStyle = "#c8e8f8";
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (reflectT > 0) {
      const eased = reflectT * reflectT;
      ctx.globalAlpha = eased * 0.72;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 28 * eased;
      ctx.shadowColor = "#c8e8f8";
      ctx.beginPath();
      ctx.arc(0, 0, R * (1 + eased * 0.22), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    PlayerRenderer._drawHitFlash(ctx, entity, R);
    if (entity.hasShield) PlayerRenderer._drawEnergyShield(ctx, now);
    ctx.restore();

    {
      const shootT = entity._anim?.shootT ?? 0;
      if (shootT > 0.05) {
        const sEase = shootT * shootT;
        const flashR = R + 8 + (1 - shootT) * 12;
        ctx.save();
        ctx.globalAlpha = sEase * 0.52;
        ctx.strokeStyle = "#fde68a";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 18 * sEase;
        ctx.shadowColor = "#facc15";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, flashR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    {
      const svx = entity.vx ?? 0;
      const svy = entity.vy ?? 0;
      const speed = Math.hypot(svx, svy);
      const speedThreshold = 60;
      if (speed > speedThreshold && !bladeGuard && !isCharge && !isCinematic) {
        const trailAngle = Math.atan2(svy, svx) + Math.PI;
        const speedRatio = Math.min(1, (speed - speedThreshold) / 200);
        const isDashing = (entity._anim?.dashT ?? 0) > 0.1;
        const streakColor = isDashing ? "#a8d8ea" : "#4a90b8";
        const streakGlow = isDashing ? "#c8eeff" : "#2a6888";
        const streakCount = isDashing ? 4 : 3;
        const baseLen = isDashing ? 18 + speedRatio * 14 : 10 + speedRatio * 8;
        const baseAlpha = isDashing ? 0.62 : 0.38;
        ctx.save();
        ctx.lineCap = "round";
        for (let si = 0; si < streakCount; si++) {
          const spread = (si / (streakCount - 1) - 0.5) * 0.62;
          const sAngle = trailAngle + spread;
          const lenMult = 1 - Math.abs(spread) * 0.4;
          const len = baseLen * lenMult;
          const ox = screen.x + Math.cos(sAngle) * (R + 2);
          const oy = screen.y + Math.sin(sAngle) * (R + 2);
          const tx = ox + Math.cos(sAngle) * len;
          const ty = oy + Math.sin(sAngle) * len;
          const alpha = baseAlpha * speedRatio * (1 - Math.abs(spread) * 0.5);
          ctx.globalAlpha = alpha * 0.45;
          ctx.strokeStyle = streakGlow;
          ctx.lineWidth = (isDashing ? 2.8 : 1.8) * lenMult;
          ctx.shadowBlur = isDashing ? 10 : 5;
          ctx.shadowColor = streakGlow;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = streakColor;
          ctx.lineWidth = (isDashing ? 1.4 : 0.9) * lenMult;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }
        ctx.lineCap = "butt";
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    ctx.save();
    ctx.translate(screen.x + recoilX, screen.y + recoilY + bobY + crouchY);
    ctx.rotate(entity.angle);
    if (isFacingLeft) ctx.scale(1, -1);
    ctx.translate(shootReach, shootLift);
    const BL = R * 3.1;
    const HL = R * 0.88;
    if (isCinematic) {
      const cT = entity._iaidoCinematicT ?? 0;
      const eC = 1 - Math.pow(1 - cT, 3);
      const sweptAngle = -2.15;
      const scabbardAngle = 0.62;
      const lerpAngle = sweptAngle + (scabbardAngle - sweptAngle) * eC;
      const lerpX = R * 0.72 * (1 - eC) + R * 0.42 * eC;
      const lerpY = 0 * (1 - eC) + R * 0.55 * eC;
      ctx.save();
      ctx.translate(lerpX, lerpY);
      ctx.rotate(lerpAngle);
    } else if (bladeGuard) {
      ctx.save();
      ctx.translate(-shootReach + R * 0.3, -shootLift - R * 0.55);
    } else if (isCharge) {
      ctx.save();
      ctx.translate(R * 0.6, R * 0.3);
      ctx.rotate(-0.3);
    } else if (arcActive) {
      const swingRot = -0.9 + (1 - arcT) * 2.1;
      const swingReach = R * 0.72 + (1 - arcT) * R * 0.4;
      ctx.save();
      ctx.translate(swingReach, -R * 0.25 * arcT);
      ctx.rotate(swingRot);
    } else {
      ctx.save();
      ctx.translate(R * 1.1, R * 0.05);
      ctx.rotate(-0.22);
    }
    const bladeGlowStr =
      reflectT > 0
        ? 32 + (reflectT / 0.32) * 18
        : isAmbush
        ? 24
        : isCharge
        ? 20
        : arcActive
        ? 18
        : 8;
    const bladeGlowColor =
      reflectT > 0 ? "#ffffff" : isAmbush ? "#fde68a" : "#7ec8e3";
    ctx.shadowBlur = bladeGlowStr;
    ctx.shadowColor = bladeGlowColor;
    const bladeGrad = ctx.createLinearGradient(0, 0, BL, 0);
    bladeGrad.addColorStop(0, "#daeef8");
    bladeGrad.addColorStop(0.38, "#b4cada");
    bladeGrad.addColorStop(0.82, "#608898");
    bladeGrad.addColorStop(1, "rgba(75,110,135,0.06)");
    ctx.fillStyle = bladeGrad;
    ctx.beginPath();
    ctx.moveTo(0, -1.7);
    ctx.lineTo(BL * 0.86, -0.55);
    ctx.lineTo(BL, 0);
    ctx.lineTo(BL * 0.86, 0.55);
    ctx.lineTo(0, 1.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(238,252,255,0.90)";
    ctx.lineWidth = 0.9;
    ctx.shadowBlur = 5;
    ctx.shadowColor = "#e8f8ff";
    ctx.beginPath();
    ctx.moveTo(2, -1.1);
    ctx.lineTo(BL * 0.82, -0.3);
    ctx.stroke();
    ctx.strokeStyle = "rgba(50,80,105,0.52)";
    ctx.lineWidth = 0.8;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(6, 0.32);
    ctx.lineTo(BL * 0.72, 0.32);
    ctx.stroke();
    ctx.fillStyle = "rgba(240,252,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(BL * 0.88, -0.3);
    ctx.lineTo(BL, 0);
    ctx.lineTo(BL * 0.88, 0.3);
    ctx.closePath();
    ctx.fill();
    if (entity.passiveUnlocked) {
      ctx.fillStyle = "rgba(155,28,28,0.26)";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(BL * 0.36, -0.9);
      ctx.bezierCurveTo(BL * 0.46, -2.8, BL * 0.56, -1.9, BL * 0.6, -0.4);
      ctx.bezierCurveTo(BL * 0.52, 1.0, BL * 0.4, 0.8, BL * 0.36, -0.9);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#222222";
    ctx.beginPath();
    ctx.roundRect(-2.8, -6.5, 5.6, 13, 1.8);
    ctx.fill();
    ctx.strokeStyle = "rgba(188,142,38,0.68)";
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.roundRect(-2.8, -6.5, 5.6, 13, 1.8);
    ctx.stroke();
    ctx.fillStyle = "rgba(188,142,38,0.52)";
    ctx.beginPath();
    ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0c0c0c";
    ctx.beginPath();
    ctx.roundRect(-HL, -2.8, HL, 5.6, 2.5);
    ctx.fill();
    ctx.strokeStyle = "rgba(162,122,36,0.68)";
    ctx.lineWidth = 1.2;
    for (let hi = 0; hi < 5; hi++) {
      const hx = -(HL * 0.9) + hi * (HL * 0.2);
      ctx.beginPath();
      ctx.moveTo(hx, -2.8);
      ctx.lineTo(hx + 1.8, 2.8);
      ctx.stroke();
    }
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.roundRect(-HL - 3.5, -3.0, 3.5, 6, 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(155,118,32,0.48)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(-HL - 3.5, -3.0, 3.5, 6, 2);
    ctx.stroke();
    const hR = 4.5;
    const hGrad = ctx.createRadialGradient(-2, 0, 0, -1, 1, hR);
    hGrad.addColorStop(0, "#18203a");
    hGrad.addColorStop(1, "#0c1220");
    ctx.fillStyle = hGrad;
    ctx.strokeStyle = "#141e36";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(126,200,227,0.42)";
    ctx.beginPath();
    ctx.arc(-2, 0, hR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.arc(-2, 0, hR, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = "rgba(85,105,148,0.62)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, -0.5);
    ctx.lineTo(2, -0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, 1.5);
    ctx.lineTo(2, 1.5);
    ctx.stroke();
    ctx.restore();
    const backHX = -(HL * 0.78);
    ctx.fillStyle = "#0b1020";
    ctx.strokeStyle = "#131c2e";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 3;
    ctx.shadowColor = "rgba(126,200,227,0.28)";
    ctx.beginPath();
    ctx.arc(backHX, 0, hR - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.restore();

    PlayerRenderer._drawLowHpGlow(ctx, entity, now, screen);
    if (entity._iaidoFlashLine?.alpha > 0) {
      const fl = entity._iaidoFlashLine;
      const s1 = worldToScreen(fl.x1, fl.y1);
      const s2 = worldToScreen(fl.x2, fl.y2);
      if (s1 && s2) {
        ctx.save();
        ctx.lineCap = "round";
        ctx.globalAlpha = fl.alpha * 0.6;
        ctx.strokeStyle = "#7ec8e3";
        ctx.lineWidth = 7;
        ctx.shadowBlur = 30;
        ctx.shadowColor = "#4ab8d8";
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        ctx.globalAlpha = fl.alpha * 0.94;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#e8f8ff";
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        ctx.globalAlpha = fl.alpha * 0.42;
        ctx.strokeStyle = "#38d0f8";
        ctx.lineWidth = 1;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();
      }
      entity._iaidoFlashLine.alpha -= 0.052;
      if (entity._iaidoFlashLine.alpha <= 0) entity._iaidoFlashLine = null;
    }
    const bt = entity._iaidoBloodTrail;
    if (bt && bt.alpha > 0) {
      const bs1 = worldToScreen(bt.x1, bt.y1);
      const bs2 = worldToScreen(bt.x2, bt.y2);
      if (bs1 && bs2) {
        const btEased = bt.alpha * bt.alpha;
        ctx.save();
        ctx.lineCap = "round";
        ctx.globalAlpha = btEased * 0.28;
        ctx.strokeStyle = "#7a1010";
        ctx.lineWidth = 5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#9b1c1c";
        ctx.beginPath();
        ctx.moveTo(bs1.x, bs1.y);
        ctx.lineTo(bs2.x, bs2.y);
        ctx.stroke();
        ctx.globalAlpha = btEased * 0.55;
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.4;
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#dc2626";
        ctx.beginPath();
        ctx.moveTo(bs1.x, bs1.y);
        ctx.lineTo(bs2.x, bs2.y);
        ctx.stroke();
        ctx.lineCap = "butt";
        ctx.restore();
      }
    }
    PlayerRenderer._drawLevelBadge(
      ctx,
      screen,
      entity,
      "rgba(20,65,120,0.92)",
      20,
      -20
    );
  }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.PatRenderer = PatRenderer;
