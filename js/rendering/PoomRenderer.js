"use strict";

/**
 * js/rendering/PoomRenderer.js
 * ════════════════════════════════════════════════════════════════
 * Rendering logic for Poom (Spiritual Warrior)
 * ════════════════════════════════════════════════════════════════
 */

class PoomRenderer {
  /**
   * MAIN POOM BODY + WEAPON
   * เดิมคือ PoomPlayer.draw()
   */
  static _drawPoom(entity, ctx) {
    const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;
    const facingSign = isFacingLeft ? -1 : 1;
    const now2 = performance.now();

    // ── Movement vars — via shared helper ──────────────────
    const {
      moveT: moveT2,
      bob: bobT2,
      stretchX: stretchX2,
      stretchY: stretchY2,
      bobOffsetY: poomBobY,
      hurtPushX: poomHurtX,
      hurtPushY: poomHurtY,
      shootLift: poomShootLift,
      shootReach: poomShootReach,
      runLean: poomRunLean,
      shadowScaleX,
      shadowScaleY,
      shadowAlphaMod,
      footL,
      footR,
    } = PlayerRenderer._getLimbParams(entity, now2, 190);
    const limbPoom = {
      shadowScaleX,
      shadowScaleY,
      shadowAlphaMod,
      footL,
      footR,
      moveT: moveT2,
      bobOffsetY: poomBobY,
    };
    const poomRecoilAmt =
      entity.weaponRecoil > 0.05 ? entity.weaponRecoil * 2.5 : 0;
    const poomRecoilX = -Math.cos(entity.angle) * poomRecoilAmt + poomHurtX;
    const poomRecoilY = -Math.sin(entity.angle) * poomRecoilAmt + poomHurtY;
    const R2 = 13;

    PlayerRenderer._standAuraDraw(entity, "poom", ctx);

    // Dash ghost trail — เขียวมรกต match body Poom
    for (const img of entity.dashGhosts) {
      const s = worldToScreen(img.x, img.y);
      ctx.save();
      ctx.globalAlpha = img.life * 0.35;
      ctx.fillStyle = "#34d399";
      ctx.shadowBlur = 8 * img.life;
      ctx.shadowColor = "#10b981";
      ctx.beginPath();
      ctx.arc(s.x, s.y, R2 + 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const screen = worldToScreen(entity.x, entity.y);

    // Ground shadow
    PlayerRenderer._drawGroundShadow(ctx, screen.x, screen.y, 14, 5, 16, {
      ...limbPoom,
      bobOffsetY: poomBobY,
    });
    PlayerRenderer._drawGroundFeet(
      ctx,
      screen.x,
      screen.y,
      limbPoom,
      "#120d04",
      entity
    );

    // Eating-rice power aura
    if (entity.isEatingRice) {
      const t = now2 / 200;
      const auraSize = 38 + Math.sin(t) * 6;
      const auraAlpha = 0.4 + Math.sin(t * 1.5) * 0.15;
      ctx.save();
      ctx.globalAlpha = auraAlpha;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 4;
      ctx.shadowBlur = 25;
      ctx.shadowColor = "#fbbf24";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = auraAlpha * 0.35;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, auraSize + 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Naga invincibility shield
    if (entity.naga && entity.naga.active) {
      const gt = now2 / 350;
      const shieldR = 36 + Math.sin(gt) * 4;
      const shieldA = 0.25 + Math.sin(gt * 1.3) * 0.12;
      ctx.save();
      ctx.globalAlpha = shieldA;
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#f59e0b";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, shieldR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = shieldA * 0.4;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, shieldR + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (entity.isConfused) {
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("😵", screen.x, screen.y - 44);
    }
    if (entity.isBurning) {
      ctx.font = "bold 20px Arial";
      ctx.fillText("🔥", screen.x + 20, screen.y - 35);
    }
    if (entity.isEatingRice) {
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🍚", screen.x, screen.y - 44);
    }

    // Naga channeling aura + connection tether
    const nagaEntity =
      window.specialEffects &&
      window.specialEffects.find((e) => e instanceof NagaEntity);
    const isChanneling = !!nagaEntity;
    if (isChanneling) {
      const ct = now2 / 220;
      const cr = 42 + Math.sin(ct) * 7;
      const ca = 0.55 + Math.sin(ct * 1.6) * 0.25;
      ctx.save();
      ctx.globalAlpha = ca;
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 3.5 + Math.sin(ct * 2.1) * 1.5;
      ctx.shadowBlur = 24 + Math.sin(ct) * 10;
      ctx.shadowColor = "#10b981";
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, cr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = ca * 0.55;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, cr - 12, 0, Math.PI * 2);
      ctx.stroke();
      {
        const sa = ct * 2.3;
        ctx.globalAlpha = 0.55 + Math.sin(ct * 3.1) * 0.35;
        ctx.fillStyle = "#34d399";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#10b981";
        ctx.beginPath();
        ctx.arc(
          screen.x + Math.cos(sa) * cr,
          screen.y + Math.sin(sa) * cr,
          2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.restore();

      if (nagaEntity.segments && nagaEntity.segments.length > 0) {
        const nagaHead = nagaEntity.segments[0];
        const nagaScreen = worldToScreen(nagaHead.x, nagaHead.y);
        const lifeAlpha = Math.min(1, nagaEntity.life / nagaEntity.maxLife);
        const hpGlow = lifeAlpha;
        const SEGS = 16;
        const pts = [];
        const now_t = now2;
        const dx = nagaScreen.x - screen.x;
        const dy = nagaScreen.y - screen.y;
        const dist = Math.hypot(dx, dy);
        const perp = Math.atan2(dy, dx) + Math.PI / 2;

        for (let i = 0; i <= SEGS; i++) {
          const t = i / SEGS;
          const bx = screen.x + dx * t;
          const by = screen.y + dy * t;
          const midFactor = Math.sin(t * Math.PI);
          const wave1 =
            Math.sin(t * Math.PI * 2.5 - now_t / 180) * 10 * midFactor;
          const wave2 =
            Math.sin(t * Math.PI * 1.2 - now_t / 240 + 1.0) * 5 * midFactor;
          const totalWave = (wave1 + wave2) * hpGlow;
          pts.push({
            x: bx + Math.cos(perp) * totalWave,
            y: by + Math.sin(perp) * totalWave,
          });
        }
        pts[0] = { x: screen.x, y: screen.y };
        pts[SEGS] = { x: nagaScreen.x, y: nagaScreen.y };

        const drawThread = (lw, alpha, color, blur) => {
          ctx.save();
          ctx.globalAlpha = lifeAlpha * alpha;
          ctx.strokeStyle = color;
          ctx.lineWidth = lw;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowBlur = blur * hpGlow;
          ctx.shadowColor = "#10b981";
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length - 1; i++) {
            const cpx = (pts[i].x + pts[i + 1].x) / 2;
            const cpy = (pts[i].y + pts[i + 1].y) / 2;
            ctx.quadraticCurveTo(pts[i].x, pts[i].y, cpx, cpy);
          }
          ctx.lineTo(pts[SEGS].x, pts[SEGS].y);
          ctx.stroke();
          ctx.restore();
        };
        drawThread(4 + hpGlow * 3, 0.2 + hpGlow * 0.12, "#10b981", 20);
        const scaleColor = hpGlow > 0.6 ? "#34d399" : "#10b981";
        drawThread(2, 0.55 + hpGlow * 0.25, scaleColor, 10);
        drawThread(1, 0.9, "#6ee7b7", 6);

        ctx.save();
        const tickCount = Math.floor(SEGS * 0.6);
        for (let i = 2; i < tickCount; i += 2) {
          const p = pts[i];
          const pn = pts[Math.min(i + 1, SEGS)];
          const tickA = Math.atan2(pn.y - p.y, pn.x - p.x) + Math.PI / 2;
          const tLen = 2.5 * hpGlow;
          ctx.globalAlpha = lifeAlpha * 0.45;
          ctx.strokeStyle = "#34d399";
          ctx.lineWidth = 0.8;
          ctx.shadowBlur = 4;
          ctx.shadowColor = "#10b981";
          ctx.beginPath();
          ctx.moveTo(
            p.x + Math.cos(tickA) * tLen,
            p.y + Math.sin(tickA) * tLen
          );
          ctx.lineTo(
            p.x - Math.cos(tickA) * tLen,
            p.y - Math.sin(tickA) * tLen
          );
          ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = lifeAlpha * (0.7 + Math.sin(now2 / 120) * 0.3);
        ctx.fillStyle = "#34d399";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#10b981";
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ════ LAYER 1 — BODY ════
    ctx.save();
    ctx.translate(screen.x + poomRecoilX, screen.y + poomRecoilY + poomBobY);
    ctx.scale(stretchX2 * facingSign, stretchY2);
    const poomShootKick = (entity._anim?.shootT ?? 0) * -0.06;
    ctx.rotate((poomRunLean + poomShootKick) * facingSign);

    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(168,85,247,0.65)";
    ctx.strokeStyle = "rgba(168,85,247,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R2 + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const outerPulse = 0.18 + Math.sin(now2 / 400) * 0.12;
    ctx.strokeStyle = `rgba(251,191,36,${outerPulse})`;
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 6 * outerPulse;
    ctx.shadowColor = "#fbbf24";
    ctx.beginPath();
    ctx.arc(0, 0, R2 + 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const poomBodyG = ctx.createRadialGradient(-3, -3, 1, 0, 0, R2);
    poomBodyG.addColorStop(0, "#3d2a14");
    poomBodyG.addColorStop(0.55, "#241808");
    poomBodyG.addColorStop(1, "#120d04");
    ctx.fillStyle = poomBodyG;
    ctx.beginPath();
    ctx.arc(0, 0, R2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, R2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(241,245,249,0.90)";
    ctx.fillRect(-R2, -R2, R2 * 2, R2);
    ctx.fillStyle = "rgba(120,113,85,0.85)";
    ctx.fillRect(-R2, 0, R2 * 2, R2);
    ctx.fillStyle = "rgba(185,28,28,0.92)";
    ctx.fillRect(-R2, -2, R2 * 2, 6);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    for (let px = -R2; px < R2; px += 3) {
      ctx.beginPath();
      ctx.moveTo(px, -2);
      ctx.lineTo(px, 4);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-R2, 1);
    ctx.lineTo(R2, 1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(148,163,184,0.70)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -R2);
    ctx.lineTo(0, -2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(-R2 * 0.35, -R2 * 0.35, R2 * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(203,213,225,0.80)";
    ctx.fillRect(-6, -9, 4, 5);
    ctx.fillStyle = "rgba(59,130,246,0.75)";
    ctx.fillRect(3, -8, 4, 1.5);
    ctx.restore();

    const kranokT2 = now2 / 500;
    const kranokAlpha =
      (0.3 + Math.sin(kranokT2 * 1.3) * 0.15) * (1 - moveT2 * 0.35);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = kranokAlpha;
    ctx.strokeStyle = "#fef3c7";
    ctx.lineWidth = 1.1;
    ctx.shadowBlur = 6 + Math.sin(kranokT2 * 2) * 3;
    ctx.shadowColor = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-8, 7);
    ctx.quadraticCurveTo(-9, 1, -4, -1);
    ctx.quadraticCurveTo(-1, -2, -3, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-4, -1);
    ctx.quadraticCurveTo(-6, -4, -3, -5);
    ctx.quadraticCurveTo(-1, -6, -2, -3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 7);
    ctx.quadraticCurveTo(9, 1, 4, -1);
    ctx.quadraticCurveTo(1, -2, 3, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -1);
    ctx.quadraticCurveTo(6, -4, 3, -5);
    ctx.quadraticCurveTo(1, -6, 2, -3);
    ctx.stroke();
    ctx.globalAlpha = kranokAlpha * 0.95;
    ctx.fillStyle = "rgba(255,251,235,0.90)";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(2.5, -1);
    ctx.lineTo(0, 3);
    ctx.lineTo(-2.5, -1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(254,243,199,0.85)";
    ctx.shadowBlur = 3;
    for (const [dx2, dy2] of [
      [-5, 8],
      [0, 9],
      [5, 8],
    ]) {
      ctx.beginPath();
      ctx.arc(dx2, dy2, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R2 - 1, 0, Math.PI * 2);
    ctx.clip();
    const lotusA = 0.35 + Math.sin(now2 / 320) * 0.18;
    ctx.globalAlpha = lotusA;
    ctx.fillStyle = "#fde68a";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#fbbf24";
    for (let pi = 0; pi < 4; pi++) {
      const pa = (pi * Math.PI) / 2 + Math.PI / 4;
      ctx.save();
      ctx.translate(Math.cos(pa) * 4.5, Math.sin(pa) * 4.5);
      ctx.rotate(pa);
      ctx.beginPath();
      ctx.ellipse(0, 0, 1.2, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (entity.passiveUnlocked) {
      const bloomAngle = now2 / 1800;
      const bloomPulse = 0.7 + Math.sin(now2 / 380) * 0.3;
      const orbitR = R2 + 7 + bloomPulse * 3;
      const PETAL_COUNT = 8;
      ctx.save();
      for (let pi = 0; pi < PETAL_COUNT; pi++) {
        const pa = (pi / PETAL_COUNT) * Math.PI * 2 + bloomAngle;
        const pA = (0.55 + Math.sin(now2 / 260 + pi * 0.8) * 0.28) * bloomPulse;
        ctx.save();
        ctx.translate(Math.cos(pa) * orbitR, Math.sin(pa) * orbitR);
        ctx.rotate(pa + Math.PI / 2);
        ctx.globalAlpha = pA;
        const pG = ctx.createRadialGradient(0, 0, 0, 0, 0, 4.5);
        pG.addColorStop(0, "#fef3c7");
        pG.addColorStop(0.5, "#fde68a");
        pG.addColorStop(1, "rgba(251,191,36,0)");
        ctx.fillStyle = pG;
        ctx.shadowBlur = 6 * bloomPulse;
        ctx.shadowColor = "#fbbf24";
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.0, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = bloomPulse * 0.3;
      ctx.fillStyle = "#fde68a";
      ctx.shadowBlur = 14 * bloomPulse;
      ctx.shadowColor = "#fbbf24";
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    const scrollOrbitR = R2 + 10;
    const scrollAngle = now2 / 1200;
    const sx = Math.cos(scrollAngle) * scrollOrbitR;
    const sy = Math.sin(scrollAngle) * scrollOrbitR - 2;
    ctx.translate(sx, sy);
    ctx.rotate(scrollAngle + 0.4);
    const scrollA = 0.55 + Math.sin(now2 / 300) * 0.25;
    ctx.globalAlpha = scrollA;
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#fbbf24";
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.roundRect(-4, -2.5, 8, 5, 1);
    ctx.fill();
    ctx.fillStyle = "#fde68a";
    ctx.beginPath();
    ctx.ellipse(-4, 0, 1.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, 0, 1.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(146,64,14,0.65)";
    ctx.lineWidth = 0.6;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(-2.5, -0.8);
    ctx.lineTo(2.5, -0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2.5, 0.5);
    ctx.lineTo(2.5, 0.5);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#1c0f05";
    ctx.beginPath();
    ctx.moveTo(-R2, -2);
    ctx.quadraticCurveTo(-R2 - 1, -R2 * 1.1, 0, -R2 - 7);
    ctx.quadraticCurveTo(R2 + 1, -R2 * 1.1, R2, -2);
    ctx.quadraticCurveTo(R2 * 0.6, -1, 0, 0);
    ctx.quadraticCurveTo(-R2 * 0.6, -1, -R2, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-R2, -2);
    ctx.quadraticCurveTo(-R2 - 1, -R2 * 1.1, 0, -R2 - 7);
    ctx.quadraticCurveTo(R2 + 1, -R2 * 1.1, R2, -2);
    ctx.quadraticCurveTo(R2 * 0.6, -1, 0, 0);
    ctx.quadraticCurveTo(-R2 * 0.6, -1, -R2, -2);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#3b1a07";
    ctx.beginPath();
    ctx.moveTo(-6, -R2 - 4);
    ctx.quadraticCurveTo(-1, -R2 - 8, 4, -R2 - 5);
    ctx.quadraticCurveTo(2, -R2 - 1, -2, -R2);
    ctx.quadraticCurveTo(-5, -R2, -6, -R2 - 4);
    ctx.closePath();
    ctx.fill();

    const hairSpikes = [
      { bx: -9, angle: -2.4, len: 7 },
      { bx: -4, angle: -2.0, len: 9 },
      { bx: 1, angle: -1.57, len: 10 },
      { bx: 6, angle: -1.1, len: 8 },
      { bx: 10, angle: -0.8, len: 6 },
    ];
    const poomHairPeriod = 220 + (1 - moveT2) * 280;
    for (const sp of hairSpikes) {
      const tipX = sp.bx + Math.cos(sp.angle) * sp.len;
      const tipY = -R2 - 5 + Math.sin(sp.angle) * sp.len;
      const wob =
        Math.sin(now2 / poomHairPeriod + sp.bx) * (1.2 + moveT2 * 1.5);
      ctx.fillStyle = "#15080a";
      ctx.beginPath();
      ctx.moveTo(sp.bx - 3, -R2 - 3);
      ctx.lineTo(sp.bx + 3, -R2 - 3);
      ctx.lineTo(tipX + wob, tipY - wob * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sp.bx - 3, -R2 - 3);
      ctx.lineTo(sp.bx + 3, -R2 - 3);
      ctx.lineTo(tipX + wob, tipY - wob * 0.5);
      ctx.closePath();
      ctx.stroke();
    }

    PlayerRenderer._drawHitFlash(ctx, entity, R2);
    if (entity.hasShield) PlayerRenderer._drawEnergyShield(ctx, now2);
    ctx.restore();

    const poomShootT = entity._anim?.shootT ?? 0;
    const gatlingLowerY = 5;
    ctx.save();
    ctx.translate(screen.x + poomRecoilX, screen.y + poomRecoilY + poomBobY);
    ctx.rotate(entity.angle);
    if (isFacingLeft) ctx.scale(1, -1);
    ctx.translate(
      poomShootReach * 0.5 - poomShootT * 3,
      gatlingLowerY + poomShootT * 1.5
    );
    if ((entity._anim?.skillT ?? 0) > 0)
      ctx.translate(0, -(entity._anim.skillT / 1.0) * 10);
    if (typeof drawPoomWeapon === "function") drawPoomWeapon(ctx);
    if (poomShootT > 0.05) {
      const muzzleLocalX = 43;
      const muzzleLocalY = 6;
      ctx.save();
      ctx.translate(muzzleLocalX, muzzleLocalY);
      const flashEase = poomShootT * poomShootT;
      ctx.globalAlpha = flashEase * 0.92;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 18 * flashEase;
      ctx.shadowColor = "#4ade80";
      ctx.beginPath();
      ctx.arc(0, 0, 4 + flashEase * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = flashEase * 0.55;
      ctx.strokeStyle = "#4ade80";
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12 * flashEase;
      ctx.shadowColor = "#4ade80";
      ctx.beginPath();
      ctx.arc(0, 0, 7 + (1 - poomShootT) * 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.lineCap = "round";
      for (let ri = 0; ri < 3; ri++) {
        const spread = (ri - 1) * 0.28;
        const rayLen = flashEase * (14 - Math.abs(ri - 1) * 4);
        ctx.globalAlpha = flashEase * (0.8 - Math.abs(ri - 1) * 0.25);
        ctx.strokeStyle = ri === 1 ? "#ffffff" : "#86efac";
        ctx.lineWidth = ri === 1 ? 1.8 : 1.2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#4ade80";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spread) * rayLen, Math.sin(spread) * rayLen);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    const pR = 5;
    ctx.fillStyle = "#d97706";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#f59e0b";
    ctx.beginPath();
    ctx.arc(R2 + 2, 0, pR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(R2 + 2, 0, pR, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.80)";
    ctx.fillRect(R2 - 3, -1.5, 10, 1.5);
    ctx.fillRect(R2 - 3, 1.5, 10, 1.2);
    ctx.fillStyle = "rgba(220,38,38,0.60)";
    ctx.fillRect(R2 - 3, 0.1, 10, 0.8);
    ctx.restore();
    ctx.fillStyle = "#b45309";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 4;
    ctx.shadowColor = "#f59e0b";
    ctx.beginPath();
    ctx.arc(R2 + 14, 0, pR - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.save();
    ctx.beginPath();
    ctx.arc(R2 + 14, 0, pR - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(R2 + 9, -1, 10, 1.3);
    ctx.fillRect(R2 + 9, 1.5, 10, 1.1);
    ctx.restore();
    ctx.restore();

    PlayerRenderer._drawLowHpGlow(ctx, entity, now2, screen);
    if (entity.garudaActive) {
      const grdScreen = screen;
      const wingPhase = now2 / 220;
      const wingSpread = 0.6 + Math.sin(wingPhase) * 0.4;
      ctx.save();
      ctx.translate(grdScreen.x, grdScreen.y);
      for (let wi = 0; wi < 4; wi++) {
        const arcAngle = (wi / 4) * Math.PI * 2 + now2 / 400;
        const arcAlpha =
          (0.25 + Math.sin(now2 / 180 + wi * 1.57) * 0.18) * wingSpread;
        const arcR = 30 + wi * 5 + Math.sin(now2 / 250 + wi) * 4;
        ctx.save();
        ctx.globalAlpha = arcAlpha;
        ctx.strokeStyle = wi % 2 === 0 ? "#fde68a" : "#fbbf24";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10 * wingSpread;
        ctx.shadowColor = "#fbbf24";
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, arcR, arcAngle, arcAngle + Math.PI * 0.6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      const wingAlpha = (0.35 + Math.sin(wingPhase) * 0.2) * wingSpread;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side, 1);
        ctx.globalAlpha = wingAlpha;
        const wG = ctx.createLinearGradient(0, -20, 45 * wingSpread, -5);
        wG.addColorStop(0, "rgba(251,191,36,0.70)");
        wG.addColorStop(0.5, "rgba(253,230,138,0.35)");
        wG.addColorStop(1, "rgba(251,191,36,0)");
        ctx.fillStyle = wG;
        ctx.shadowBlur = 14 * wingSpread;
        ctx.shadowColor = "#fbbf24";
        ctx.beginPath();
        ctx.moveTo(5, -8);
        ctx.quadraticCurveTo(20 * wingSpread, -28, 44 * wingSpread, -18);
        ctx.quadraticCurveTo(46 * wingSpread, -10, 36 * wingSpread, -2);
        ctx.quadraticCurveTo(18 * wingSpread, 4, 5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(253,230,138,0.55)";
        ctx.lineWidth = 0.8;
        ctx.shadowBlur = 6;
        for (let fi = 0; fi < 4; fi++) {
          const ft = fi / 3;
          const fx0 = 5 + ft * 20 * wingSpread;
          const fy0 = -8 + ft * 6;
          const fx1 = 10 + ft * 30 * wingSpread;
          const fy1 = -24 + ft * 10;
          ctx.globalAlpha = wingAlpha * (0.7 - ft * 0.3);
          ctx.beginPath();
          ctx.moveTo(fx0, fy0);
          ctx.lineTo(fx1, fy1);
          ctx.stroke();
        }
        ctx.restore();
      }
      const garudaCore = 0.2 + Math.sin(now2 / 150) * 0.12;
      ctx.globalAlpha = garudaCore * wingSpread;
      ctx.fillStyle = "#fbbf24";
      ctx.shadowBlur = 22 * wingSpread;
      ctx.shadowColor = "#f59e0b";
      ctx.beginPath();
      ctx.arc(0, 0, 10 + wingSpread * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    PlayerRenderer._drawLevelBadge(
      ctx,
      screen,
      entity,
      "rgba(217,119,6,0.92)",
      20,
      -20
    );
  }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.PoomRenderer = PoomRenderer;
