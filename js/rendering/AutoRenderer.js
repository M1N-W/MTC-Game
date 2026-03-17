"use strict";

/**
 * js/rendering/AutoRenderer.js
 * ════════════════════════════════════════════════════════════════
 * Rendering logic for Auto (Thermodynamic Brawler)
 *
 * CHANGELOG:
 *  Session 4: _drawAuto() แตกเป็น 9 part functions:
 *    _drawAutoDashTrail | _drawAutoGroundFX | _drawAutoVacuumRing
 *    _drawAutoDetonationRing | _drawAutoStandGuard | _drawAutoStandRush
 *    _drawAutoChargePunch | _drawAutoBody | _drawAutoWeaponFists
 *    Token adoption: danger/dangerDark/bossOrange/bossOrangeMid/gold/crit (×79)
 *  Session 5: OffscreenCanvas cache for static body geometry:
 *    _getBodyBitmap(tier) — outer ring + fill + outline + specular + inner detail
 *    _getHairBaseBitmap() — hair silhouette + centre spike
 *    Saves ~22 path/gradient ops per frame → replaced with 2 drawImage calls
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────
 *  L.14   _drawAutoAura()           heat shimmer aura + symbol ring
 *  L.103  _drawAuto()               dispatcher — calls all part functions
 *  L.160  _drawAutoDashTrail()      dash ghost afterimages
 *  L.175  _drawAutoGroundFX()       ground shadow + foot dots
 *  L.185  _drawAutoVacuumRing()     vacuum / stand pull range ring
 *  L.235  _drawAutoDetonationRing() detonation AOE ring
 *  L.260  _drawAutoStandGuard()     stand guard arc + fill
 *  L.300  _drawAutoStandRush()      stand rush gloves + ORA ORA text
 *  L.460  _drawAutoChargePunch()    charge punch arc + ventGlow computation
 *  L.530  _drawAutoBody()           LAYER 1 — body, heat rings, hair, hex-core
 *  L.930  _drawAutoWeaponFists()    LAYER 2 — weapon + leading/trailing fists
 *  L.1000 _drawWanchaiStand()       wanchai stand rendering
 * ════════════════════════════════════════════════════════════════
 */

class AutoRenderer {
  /**
   * Heat shimmer aura (Auto only)
   */
  static _drawAutoAura(entity, ctx) {
    if (!entity.standGhosts) return;
    const ts = window.timeScale ?? 1;
    const inSlowmo = ts < 1.0;

    // สีหลัก: อ่านจาก RT — override ได้ผ่าน RenderSkins.applySkin()
    const auraCol = inSlowmo ? RT.palette.bossOrange : RT.palette.dangerDark;
    const ghostCol = inSlowmo ? RT.palette.bossOrange : RT.palette.dangerDark;
    const BASE_R = 44;
    const auraR = inSlowmo ? BASE_R * 1.5 : BASE_R;
    const screen = worldToScreen(entity.x, entity.y);

    // ── Ghost silhouettes ─────────────────────────────────
    for (const img of entity.standGhosts) {
      const gs = worldToScreen(img.x, img.y);
      ctx.save();
      ctx.translate(gs.x, gs.y);
      ctx.rotate(img.angle);
      ctx.globalAlpha = Math.max(0, img.alpha) * 0.55;
      ctx.fillStyle = inSlowmo ? RT.palette.bossOrange : ghostCol;
      ctx.shadowBlur = inSlowmo ? 14 : 8;
      ctx.shadowColor = auraCol;
      ctx.beginPath();
      ctx.arc(0, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha *= 0.4;
      ctx.fillStyle = inSlowmo ? "#ffffff" : auraCol;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ── Inner glow ring ───────────────────────────────────
    const ringPulse = 0.1 + Math.sin(entity.auraRotation * 2) * 0.05;
    ctx.save();
    ctx.globalAlpha = ringPulse * (inSlowmo ? 1.8 : 1.0);
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, auraR * 0.52, 0, Math.PI * 2);
    ctx.strokeStyle = auraCol;
    ctx.lineWidth = inSlowmo ? 3.5 : 1.8;
    ctx.shadowBlur = inSlowmo ? 30 : 14;
    ctx.shadowColor = auraCol;
    ctx.stroke();
    ctx.restore();

    // ── Rotating symbol ring ──────────────────────────────
    const SYMBOLS = ["∑", "π", "∫", "Δ", "0", "1", "∞", "λ"];
    const COUNT = SYMBOLS.length;
    const drawRing = (ox, oy, colOverride) => {
      const col = colOverride || auraCol;
      for (let i = 0; i < COUNT; i++) {
        const baseAngle = (i / COUNT) * Math.PI * 2;
        const orbit = baseAngle + entity.auraRotation;
        const bob = Math.sin(entity.auraRotation * 2.5 + i * 0.85) * 6;
        const r = auraR + bob;
        const sx = screen.x + ox + Math.cos(orbit) * r;
        const sy = screen.y + oy + Math.sin(orbit) * r;
        const pulse =
          0.5 + Math.sin(entity.auraRotation * 3.2 + i * 1.1) * 0.38;
        ctx.save();
        ctx.globalAlpha = pulse * (inSlowmo ? 0.95 : 0.72);
        ctx.translate(sx, sy);
        ctx.rotate(orbit + Math.PI / 2);
        ctx.fillStyle = col;
        ctx.shadowBlur = inSlowmo ? 22 : 11;
        ctx.shadowColor = col;
        ctx.font = `bold ${10 + Math.round(pulse * 5)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(SYMBOLS[i % COUNT], 0, 0);
        ctx.restore();
      }
    };
    if (inSlowmo) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      drawRing(-2.5, 0, "#ff0055"); // red-pink (left) — intentional non-token accent
      drawRing(2.5, 0, RT.palette.bossOrange); // orange   (right)
      drawRing(0, -2.5, RT.palette.gold); // amber    (up)
      ctx.restore();
    }
    drawRing(0, 0, null);
  }

  // ── Static body bitmap cache (keyed by heatTier: 0-3) ──────────────────────
  // Caches: outer glow ring + body radialGradient fill + outline + specular +
  //         clipped inner detail panels. 4 fixed tier keys, never invalidated.
  static _bodyCache = new Map();

  static _getBodyBitmap(heatTier) {
    // skinId included in key so skin changes get a fresh bitmap without evicting other tiers
    const skinId =
      (typeof GameState !== "undefined" && GameState.activeSkin?.auto) ||
      "default";
    const key = `body_${skinId}_t${heatTier}`;
    if (AutoRenderer._bodyCache.has(key))
      return AutoRenderer._bodyCache.get(key);
    const R = 15;
    const pad = 24; // covers R(15)+ring(3)+shadowBlur(18)+margin(3)
    const size = (R + pad) * 2;
    const osc = new OffscreenCanvas(size, size);
    const oc = osc.getContext("2d");
    oc.translate(size / 2, size / 2);

    // Outer glow ring — static shadowBlur baked into bitmap
    oc.shadowBlur = 18;
    oc.shadowColor = "rgba(220,38,38,0.75)";
    oc.strokeStyle = "rgba(220,38,38,0.55)";
    oc.lineWidth = 2.8;
    oc.beginPath();
    oc.arc(0, 0, R + 3, 0, Math.PI * 2);
    oc.stroke();
    oc.shadowBlur = 0;

    // Body fill — tier-keyed radialGradient
    const bG = oc.createRadialGradient(-4, -4, 1, 0, 0, R);
    if (heatTier === 0) {
      bG.addColorStop(0, "#7f1d1d");
      bG.addColorStop(0.5, "#5a0e0e");
      bG.addColorStop(1, "#2d0606");
    } else if (heatTier === 1) {
      bG.addColorStop(0, "#9a2a14");
      bG.addColorStop(0.5, "#6b1a0a");
      bG.addColorStop(1, "#3a1204");
    } else if (heatTier === 2) {
      bG.addColorStop(0, "#c84a10");
      bG.addColorStop(0.5, "#952208");
      bG.addColorStop(1, "#5c1404");
    } else {
      bG.addColorStop(0, "#fff3e0");
      bG.addColorStop(0.25, RT.palette.bossOrangeMid);
      bG.addColorStop(0.6, RT.palette.dangerDark);
      bG.addColorStop(1, "#7f1d1d");
    }
    oc.fillStyle = bG;
    oc.beginPath();
    oc.arc(0, 0, R, 0, Math.PI * 2);
    oc.fill();
    oc.strokeStyle = "#1e293b";
    oc.lineWidth = 3;
    oc.beginPath();
    oc.arc(0, 0, R, 0, Math.PI * 2);
    oc.stroke();

    // Specular highlight
    oc.fillStyle = "rgba(255,255,255,0.09)";
    oc.beginPath();
    oc.arc(-5, -6, 6, 0, Math.PI * 2);
    oc.fill();

    // Inner detail — clipped circuit pattern
    oc.save();
    oc.beginPath();
    oc.arc(0, 0, R, 0, Math.PI * 2);
    oc.clip();
    oc.fillStyle = "rgba(120,20,20,0.65)";
    oc.beginPath();
    oc.roundRect(-R, -R, R * 0.7, R * 0.9, 2);
    oc.fill();
    oc.beginPath();
    oc.roundRect(R * 0.25, -R, R * 0.8, R * 0.9, 2);
    oc.fill();
    oc.strokeStyle = "rgba(153,27,27,0.55)";
    oc.lineWidth = 0.9;
    oc.beginPath();
    oc.moveTo(-R * 0.25, -R);
    oc.lineTo(-R * 0.25, 0);
    oc.stroke();
    oc.beginPath();
    oc.moveTo(R * 0.25, -R);
    oc.lineTo(R * 0.25, 0);
    oc.stroke();
    oc.fillStyle = "rgba(220,38,38,0.45)";
    for (const [rx, ry] of [
      [-R * 0.45, -R * 0.6],
      [R * 0.45, -R * 0.6],
      [-R * 0.45, -R * 0.2],
      [R * 0.45, -R * 0.2],
    ]) {
      oc.beginPath();
      oc.arc(rx, ry, 1.2, 0, Math.PI * 2);
      oc.fill();
    }
    oc.restore();

    AutoRenderer._bodyCache.set(key, osc);
    return osc;
  }

  static _getHairBaseBitmap() {
    // skinId included in key — hair color may differ per skin
    const skinId =
      (typeof GameState !== "undefined" && GameState.activeSkin?.auto) ||
      "default";
    const key = `hair_${skinId}`;
    if (AutoRenderer._bodyCache.has(key))
      return AutoRenderer._bodyCache.get(key);
    const R = 15;
    // Hair occupies y from -(R+5)=-20 to +3 (below centre), x ≈ ±(R+2)=±17
    // Canvas 40×32: entity origin maps to (20, 28) i.e. bottom-margin=4
    const W = 40,
      H = 32,
      originY = H - 4;
    const osc = new OffscreenCanvas(W, H);
    const oc = osc.getContext("2d");
    oc.translate(W / 2, originY);

    oc.fillStyle = "#1a0505";
    oc.beginPath();
    oc.moveTo(-(R - 1), -1);
    oc.quadraticCurveTo(-R - 1, -R * 0.6, -R * 0.4, -R - 2);
    oc.quadraticCurveTo(0, -R - 4, R * 0.4, -R - 2);
    oc.quadraticCurveTo(R + 1, -R * 0.6, R - 1, -1);
    oc.quadraticCurveTo(R * 0.5, 2, 0, 2.5);
    oc.quadraticCurveTo(-R * 0.5, 2, -(R - 1), -1);
    oc.closePath();
    oc.fill();
    oc.strokeStyle = "#1e293b";
    oc.lineWidth = 2;
    oc.beginPath();
    oc.moveTo(-(R - 1), -1);
    oc.quadraticCurveTo(-R - 1, -R * 0.6, -R * 0.4, -R - 2);
    oc.quadraticCurveTo(0, -R - 4, R * 0.4, -R - 2);
    oc.quadraticCurveTo(R + 1, -R * 0.6, R - 1, -1);
    oc.quadraticCurveTo(R * 0.5, 2, 0, 2.5);
    oc.quadraticCurveTo(-R * 0.5, 2, -(R - 1), -1);
    oc.closePath();
    oc.stroke();
    // Centre dark spike highlight
    oc.fillStyle = "#5c1010";
    oc.beginPath();
    oc.moveTo(-5, -R - 2);
    oc.quadraticCurveTo(-1, -R - 5, 4, -R - 2);
    oc.quadraticCurveTo(2, -R + 2, -2, -R + 1);
    oc.quadraticCurveTo(-4, -R, -5, -R - 2);
    oc.closePath();
    oc.fill();

    AutoRenderer._bodyCache.set(key, osc);
    return osc;
  }

  /**
   * MAIN AUTO BODY + WEAPON — dispatcher
   * เดิมคือ AutoPlayer.draw(). แตกแล้วเป็น part functions:
   *   _drawAutoDashTrail | _drawAutoGroundFX | _drawAutoVacuumRing
   *   _drawAutoDetonationRing | _drawAutoStandGuard | _drawAutoStandRush
   *   _drawAutoChargePunch | _drawAutoBody | _drawAutoWeaponFists
   */
  static _drawAuto(entity, ctx) {
    const screen = worldToScreen(entity.x, entity.y);
    const now = performance.now();
    if (typeof ctx === "undefined" || !ctx) return;

    const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;
    const facingSign = isFacingLeft ? -1 : 1;
    const R = 15;

    // ── Shared limb params ─────────────────────────────────────
    const {
      moveT,
      bob: bobT,
      stretchX,
      stretchY,
      bobOffsetY,
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
    } = PlayerRenderer._getLimbParams(entity, now, 180);
    const limbAuto = {
      shadowScaleX,
      shadowScaleY,
      shadowAlphaMod,
      footL,
      footR,
      moveT,
      bobOffsetY,
    };
    const recoilAmt =
      entity.weaponRecoil > 0.05 ? entity.weaponRecoil * 3.0 : 0;
    const recoilX = -Math.cos(entity.angle) * recoilAmt + hurtPushX;
    const recoilY = -Math.sin(entity.angle) * recoilAmt + hurtPushY;

    // ── Stand Aura (Signature Auto — แดง/ส้ม) ─────────────────
    PlayerRenderer._standAuraDraw(entity, "auto", ctx);

    AutoRenderer._drawAutoDashTrail(entity, ctx, screen, R);
    AutoRenderer._drawAutoGroundFX(entity, ctx, screen, limbAuto, bobOffsetY);
    AutoRenderer._drawAutoVacuumRing(entity, ctx, screen, now);
    AutoRenderer._drawAutoDetonationRing(entity, ctx, screen, now);
    AutoRenderer._drawAutoStandGuard(entity, ctx, screen, now);
    AutoRenderer._drawAutoStandRush(entity, ctx, screen, now);
    const { ventGlow } = AutoRenderer._drawAutoChargePunch(
      entity,
      ctx,
      screen,
      now
    );

    // ── Shared render params passed to body + weapon ────────────
    const p = {
      screen,
      now,
      isFacingLeft,
      facingSign,
      recoilX,
      recoilY,
      bobOffsetY,
      stretchX,
      stretchY,
      runLean,
      shootReach,
      ventGlow,
      R,
      limbAuto,
    };

    AutoRenderer._drawAutoBody(entity, ctx, p);
    AutoRenderer._drawAutoWeaponFists(entity, ctx, p);

    PlayerRenderer._drawLowHpGlow(ctx, entity, now, screen);
    if (entity.wanchaiStand?.active) {
      AutoRenderer._drawWanchaiStand(entity.wanchaiStand, ctx);
    }
    PlayerRenderer._drawLevelBadge(
      ctx,
      screen,
      entity,
      "rgba(185,28,28,0.92)",
      22,
      -22
    );
  }

  /**
   * Dash ghost afterimages (LAYER 0.5)
   */
  static _drawAutoDashTrail(entity, ctx, screen, R) {
    for (const img of entity.dashGhosts || []) {
      const gs = worldToScreen(img.x, img.y);
      ctx.save();
      ctx.globalAlpha = img.life * 0.35;
      ctx.fillStyle = RT.palette.danger;
      ctx.shadowBlur = 10 * img.life;
      ctx.shadowColor = RT.palette.dangerDark;
      ctx.beginPath();
      ctx.arc(gs.x, gs.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Ground shadow + foot dots
   */
  static _drawAutoGroundFX(entity, ctx, screen, limbAuto, bobOffsetY) {
    // Ground shadow
    PlayerRenderer._drawGroundShadow(
      ctx,
      screen.x,
      screen.y,
      16,
      6,
      17,
      limbAuto
    );
    PlayerRenderer._drawGroundFeet(
      ctx,
      screen.x,
      screen.y,
      limbAuto,
      "#2d0606",
      entity
    );
  }

  /**
   * Vacuum / Stand Pull range ring — shown when Q cooldown ready
   */
  static _drawAutoVacuumRing(entity, ctx, screen, now) {
    if ((entity.cooldowns?.vacuum ?? 1) <= 0) {
      const VACUUM_RANGE_PX = BALANCE?.characters?.auto?.vacuumRange ?? 320;
      const camScale = PlayerRenderer._getCamScale(entity.x);
      const vacRingR = VACUUM_RANGE_PX * camScale;
      const pulse = 0.14 + Math.sin(now / 420) * 0.09;
      const isStandPull = entity.wanchaiActive && entity.passiveUnlocked;
      let ringOriginX = screen.x;
      let ringOriginY = screen.y;
      if (isStandPull) {
        const standSc = worldToScreen(
          entity.wanchaiStand?.x ?? entity.x,
          entity.wanchaiStand?.y ?? entity.y
        );
        ringOriginX = standSc.x;
        ringOriginY = standSc.y;
      }
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = isStandPull
        ? RT.palette.dangerDark
        : RT.palette.bossOrange;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.shadowBlur = 12;
      ctx.shadowColor = isStandPull
        ? RT.palette.dangerDark
        : RT.palette.bossOrange;
      ctx.beginPath();
      ctx.arc(ringOriginX, ringOriginY, vacRingR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = pulse * 0.6;
      ctx.strokeStyle = isStandPull
        ? RT.palette.danger
        : RT.palette.bossOrangeMid;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(ringOriginX, ringOriginY, vacRingR * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      const qLabel = isStandPull ? "[Q] STAND PULL" : "[Q] VACUUM";
      ctx.globalAlpha = 0.55 + Math.sin(now / 300) * 0.2;
      ctx.fillStyle = isStandPull ? RT.palette.danger : RT.palette.bossOrange;
      ctx.shadowBlur = 8;
      ctx.shadowColor = isStandPull
        ? RT.palette.dangerDark
        : RT.palette.bossOrangeMid;
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(qLabel, ringOriginX, ringOriginY - vacRingR - 10);
      ctx.restore();
    }
  }

  /**
   * Detonation AOE ring — shown when wanchaiActive
   */
  static _drawAutoDetonationRing(entity, ctx, screen, now) {
    if (entity.wanchaiActive) {
      const DET_RANGE_PX = BALANCE?.characters?.auto?.detonationRange ?? 220;
      const standX = entity.wanchaiStand?.x ?? entity.x;
      const standY = entity.wanchaiStand?.y ?? entity.y;
      const _ds0 = worldToScreen(standX, standY);
      const camScale = PlayerRenderer._getCamScale(standX);
      const detRingR = DET_RANGE_PX * camScale;
      const detPulse = 0.18 + Math.sin(now / 200) * 0.12;
      ctx.save();
      ctx.globalAlpha = detPulse;
      ctx.strokeStyle = RT.palette.dangerDark;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.shadowBlur = 12;
      ctx.shadowColor = RT.palette.dangerDark;
      ctx.beginPath();
      ctx.arc(_ds0.x, _ds0.y, detRingR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /**
   * Stand Guard arc + fill + label
   */
  static _drawAutoStandGuard(entity, ctx, screen, now) {
    if (entity._standGuard) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(now / 80) * 0.15;
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.shadowBlur = 18;
      ctx.shadowColor = RT.palette.gold;
      const guardStartA = entity.angle - Math.PI * 0.6;
      const guardEndA = entity.angle + Math.PI * 0.6;
      ctx.beginPath();
      ctx.arc(
        screen.x,
        screen.y,
        28 + Math.sin(now / 100) * 3,
        guardStartA,
        guardEndA
      );
      ctx.stroke();
      ctx.globalAlpha = 0.2 + Math.sin(now / 120) * 0.08;
      ctx.fillStyle = RT.palette.gold;
      ctx.beginPath();
      ctx.moveTo(screen.x, screen.y);
      ctx.arc(screen.x, screen.y, 28, guardStartA, guardEndA);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = RT.palette.gold;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#f59e0b";
      ctx.fillText("GUARD", screen.x, screen.y - 35);
      ctx.restore();
    }
  }

  /**
   * Stand Rush gloves, ORA ORA trail + combo text
   */
  static _drawAutoStandRush(entity, ctx, screen, now) {
    if (entity.wanchaiActive && entity.isStandAttacking) {
      const fists = entity._rushFists;
      if (fists && fists.length > 0) {
        const ht = entity._heatTier ?? 0;
        const oraCombo = entity._oraComboCount ?? 0;
        const fistCol =
          ht >= 3 ? "#fef08a" : ht >= 2 ? "#f59e0b" : RT.palette.dangerDark;
        const fistColDim =
          ht >= 3 ? "#92400e" : ht >= 2 ? "#78350f" : "#7f1d1d";
        const trailHex =
          ht >= 3 ? "254,240,138" : ht >= 2 ? "245,158,11" : "220,38,38";
        const punchAngle = entity.angle;

        const drawGlove = (cx, cy, sc, faceA, alpha) => {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(faceA);
          ctx.globalAlpha = alpha;
          const W = 13 * sc;
          const H = 10 * sc;
          const wristG = ctx.createLinearGradient(-W * 1.1, 0, -W * 0.3, 0);
          wristG.addColorStop(0, `rgba(${trailHex},0)`);
          wristG.addColorStop(1, fistColDim);
          ctx.fillStyle = wristG;
          ctx.beginPath();
          ctx.roundRect(-W * 1.1, -H * 0.45, W * 0.85, H * 0.9, 3 * sc);
          ctx.fill();
          const bodyG = ctx.createRadialGradient(
            -W * 0.15,
            -H * 0.25,
            0.5,
            0,
            0,
            W
          );
          bodyG.addColorStop(0, "#ffffff");
          bodyG.addColorStop(0.18, fistCol);
          bodyG.addColorStop(0.65, fistCol);
          bodyG.addColorStop(1, fistColDim);
          ctx.fillStyle = bodyG;
          ctx.shadowBlur = 18 * sc;
          ctx.shadowColor = fistCol;
          ctx.beginPath();
          ctx.roundRect(-W * 0.35, -H * 0.5, W * 1.35, H, 4 * sc);
          ctx.fill();
          ctx.fillStyle = fistCol;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.ellipse(
            W * 0.25,
            -H * 0.48,
            W * 0.3,
            H * 0.28,
            -0.3,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.shadowBlur = 8 * sc;
          ctx.shadowColor = "#ffffff";
          for (let k = 0; k < 4; k++) {
            const ky = -H * 0.32 + k * (H * 0.22);
            const kw = W * 0.16;
            const kh = H * 0.15;
            const kG = ctx.createRadialGradient(
              W * 0.88,
              ky,
              0,
              W * 0.88,
              ky,
              kw
            );
            kG.addColorStop(0, "rgba(255,255,255,0.90)");
            kG.addColorStop(0.5, `rgba(${trailHex},0.55)`);
            kG.addColorStop(1, `rgba(${trailHex},0)`);
            ctx.fillStyle = kG;
            ctx.beginPath();
            ctx.ellipse(W * 0.88, ky, kw, kh, 0.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.25).toFixed(2)})`;
          ctx.lineWidth = 1.2 * sc;
          ctx.beginPath();
          ctx.roundRect(-W * 0.35, -H * 0.5, W * 1.35, H, 4 * sc);
          ctx.stroke();
          ctx.restore();
        };

        ctx.save();
        ctx.translate(screen.x, screen.y);
        const COUNT = fists.length;
        const SPACING = 16;
        const SIDE_AMP = 5;
        const perpA = punchAngle + Math.PI / 2;

        for (let i = 0; i < COUNT; i++) {
          const f = fists[i];
          if (f.alpha <= 0) continue;
          const forwardDist = 38 + i * SPACING;
          const sideDrift = Math.sin(i * Math.PI) * SIDE_AMP * f.sc;
          const fx =
            Math.cos(punchAngle) * forwardDist + Math.cos(perpA) * sideDrift;
          const fy =
            Math.sin(punchAngle) * forwardDist + Math.sin(perpA) * sideDrift;
          const trailLen = 28 * f.sc;
          const t0x = fx - Math.cos(punchAngle) * trailLen;
          const t0y = fy - Math.sin(punchAngle) * trailLen;
          const trailG = ctx.createLinearGradient(t0x, t0y, fx, fy);
          trailG.addColorStop(0, `rgba(${trailHex},0)`);
          trailG.addColorStop(
            1,
            `rgba(${trailHex},${(f.alpha * 0.55).toFixed(2)})`
          );
          ctx.save();
          ctx.strokeStyle = trailG;
          ctx.lineWidth = 8 * f.sc;
          ctx.lineCap = "round";
          ctx.globalAlpha = f.alpha;
          ctx.beginPath();
          ctx.moveTo(t0x, t0y);
          ctx.lineTo(fx, fy);
          ctx.stroke();
          ctx.restore();
          const gloveScale = 0.6 + (i / (COUNT - 1)) * 0.4;
          drawGlove(fx, fy, f.sc * gloveScale, punchAngle, f.alpha);
        }
        ctx.restore();

        const oraTimer = entity._oraTextTimer ?? 0;
        if (oraTimer > 0) {
          ctx.save();
          const fadeAlpha = Math.min(1, oraTimer / 0.15);
          const comboScale = 1 + oraCombo * 0.022;
          const jx = screen.x;
          const jy = screen.y - 82;
          ctx.globalAlpha = fadeAlpha;
          ctx.scale(comboScale, comboScale);
          ctx.font = '900 28px "Arial Black", Arial, sans-serif';
          ctx.textAlign = "center";
          ctx.lineWidth = 7;
          ctx.strokeStyle = "#3d0000";
          ctx.strokeText("ORA ORA ORA!", jx, jy);
          ctx.lineWidth = 3;
          ctx.strokeStyle = oraCombo >= 5 ? "#fef08a" : "#f59e0b";
          ctx.shadowBlur = 22;
          ctx.shadowColor = oraCombo >= 5 ? "#fef08a" : "#f59e0b";
          ctx.strokeText("ORA ORA ORA!", jx, jy);
          ctx.fillStyle = oraCombo >= 5 ? "#fef08a" : "#ffffff";
          ctx.shadowBlur = 16;
          ctx.fillText("ORA ORA ORA!", jx, jy);
          ctx.restore();
        }
      }
    }
  }

  /**
   * Charge Punch arc ring + MAX! label.
   * Also computes attackIntensity + ventGlow.
   * @returns {{ ventGlow: number }}
   */
  static _drawAutoChargePunch(entity, ctx, screen, now) {
    if (entity.wanchaiActive && entity._eHeld && entity._chargeTimer > 0) {
      const chargeRatio = Math.min(
        1,
        (entity._chargeTimer ?? 0) / (entity.stats?.chargeMaxTime ?? 1.5)
      );
      const standScreen = worldToScreen(
        entity.wanchaiStand?.x ?? entity.x,
        entity.wanchaiStand?.y ?? entity.y
      );
      const isReady = entity._chargeReady ?? false;
      ctx.save();
      ctx.globalAlpha = 0.6 + chargeRatio * 0.4;
      ctx.strokeStyle = isReady
        ? RT.palette.crit
        : chargeRatio >= 0.5
        ? "#f59e0b"
        : RT.palette.dangerDark;
      ctx.lineWidth = 2 + chargeRatio * 3;
      ctx.shadowBlur = 12 + chargeRatio * 8;
      ctx.shadowColor = isReady ? RT.palette.crit : "#f59e0b";
      const pulseRadius = 35 + chargeRatio * 15 + Math.sin(now / 100) * 3;
      ctx.beginPath();
      ctx.arc(
        standScreen.x,
        standScreen.y,
        pulseRadius,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * chargeRatio
      );
      ctx.stroke();
      if (chargeRatio >= 0.8) {
        ctx.globalAlpha = (chargeRatio - 0.8) * 3;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(standScreen.x, standScreen.y, pulseRadius - 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (isReady) {
        ctx.globalAlpha = 0.95;
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillStyle = "#fef08a";
        ctx.shadowBlur = 10;
        ctx.shadowColor = RT.palette.crit;
        ctx.fillText("MAX!", standScreen.x, standScreen.y - pulseRadius - 10);
      }
      ctx.restore();
    }

    const attackIntensity = entity.wanchaiActive
      ? 1.0
      : Math.min(1, (Math.abs(entity.vx) + Math.abs(entity.vy)) / 150 + 0.2);
    const ventGlow = Math.max(
      0,
      attackIntensity * (0.5 + Math.sin(now / 180) * 0.5)
    );
    return { ventGlow };
  }

  /**
   * LAYER 1 — Body fill, heat tier rings, hair, vents, hex-core, wanchai/passive rings,
   * hit flash, energy shield. Runs inside its own ctx.save/restore.
   * @param {{screen,now,isFacingLeft,facingSign,recoilX,recoilY,bobOffsetY,stretchX,stretchY,runLean,ventGlow,R}} p
   */
  static _drawAutoBody(entity, ctx, p) {
    const {
      screen,
      now,
      isFacingLeft,
      facingSign,
      recoilX,
      recoilY,
      bobOffsetY,
      stretchX,
      stretchY,
      runLean,
      ventGlow,
      R,
    } = p;
    // ════ LAYER 1 — BODY ════
    ctx.save();
    ctx.translate(screen.x + recoilX, screen.y + recoilY + bobOffsetY);
    ctx.scale(stretchX * facingSign, stretchY);
    const _wEntryT = Math.max(
      0,
      ((entity._anim?.skillT ?? 0) -
        ((entity.stats?.wanchaiDuration ?? 3.0) - 0.4)) /
        0.4
    );
    ctx.rotate((runLean + _wEntryT * -0.2) * facingSign);
    const heatTier = entity._heatTier ?? 0;

    // Body base bitmap: outer glow ring + tier fill + outline + specular + inner detail
    const _bodyBm = AutoRenderer._getBodyBitmap(heatTier);
    ctx.drawImage(_bodyBm, -_bodyBm.width / 2, -_bodyBm.height / 2);

    if (heatTier === 1) {
      const warmPulse = 0.15 + Math.sin(now / 320) * 0.08;
      ctx.save();
      ctx.globalAlpha = warmPulse;
      ctx.strokeStyle = RT.palette.bossOrangeMid;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = RT.palette.bossOrange;
      ctx.beginPath();
      ctx.arc(0, 0, R + 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (heatTier === 3) {
      const ohPulse = 0.55 + Math.sin(now / 90) * 0.35;
      ctx.save();
      ctx.globalAlpha = ohPulse;
      ctx.strokeStyle = RT.palette.bossOrange;
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 22;
      ctx.shadowColor = RT.palette.bossOrangeMid;
      ctx.beginPath();
      ctx.arc(0, 0, R + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = ohPulse * 0.45;
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 14;
      ctx.shadowColor = RT.palette.crit;
      ctx.beginPath();
      ctx.arc(0, 0, R + 7 + Math.sin(now / 80) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.75 + Math.sin(now / 70) * 0.22;
      ctx.shadowBlur = 20;
      ctx.shadowColor = RT.palette.bossOrangeMid;
      for (let vi = 0; vi < 3; vi++) {
        const steamA = 0.55 + Math.sin(now / 90 + vi * 1.2) * 0.35;
        ctx.globalAlpha = steamA;
        ctx.fillStyle = vi % 2 === 0 ? RT.palette.bossOrangeMid : "#fef08a";
        ctx.beginPath();
        ctx.roundRect(-R, -5 + vi * 5, 5, 3, 1.5);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(R - 5, -5 + vi * 5, 5, 3, 1.5);
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.shadowBlur = 10 * ventGlow;
    ctx.shadowColor = RT.palette.bossOrangeMid;
    for (let vi = 0; vi < 3; vi++) {
      const va = ventGlow * (0.45 + vi * 0.18);
      const ventG = ctx.createLinearGradient(-R, 0, -R + 4, 0);
      ventG.addColorStop(0, `rgba(251,146,60,${va * 1.2})`);
      ventG.addColorStop(1, `rgba(239,68,68,${va * 0.6})`);
      ctx.fillStyle = ventG;
      ctx.beginPath();
      ctx.roundRect(-R, -4 + vi * 5, 4, 2.5, 1);
      ctx.fill();
      const ventGR = ctx.createLinearGradient(R - 4, 0, R, 0);
      ventGR.addColorStop(0, `rgba(239,68,68,${va * 0.6})`);
      ventGR.addColorStop(1, `rgba(251,146,60,${va * 1.2})`);
      ctx.fillStyle = ventGR;
      ctx.beginPath();
      ctx.roundRect(R - 4, -4 + vi * 5, 4, 2.5, 1);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    const cP =
      Math.max(0, 0.4 + Math.sin(now / 200) * 0.5) *
      (entity.wanchaiActive ? 1.5 : 1);
    const hexCR = 5.5;
    ctx.save();
    ctx.translate(0, 3);
    ctx.beginPath();
    for (let hi = 0; hi < 6; hi++) {
      const ha = (hi / 6) * Math.PI * 2 - Math.PI / 6;
      if (hi === 0) ctx.moveTo(Math.cos(ha) * hexCR, Math.sin(ha) * hexCR);
      else ctx.lineTo(Math.cos(ha) * hexCR, Math.sin(ha) * hexCR);
    }
    ctx.closePath();
    const hexG = ctx.createRadialGradient(0, 0, 0, 0, 0, hexCR);
    hexG.addColorStop(0, `rgba(255,200,200,${Math.min(1, cP * 0.9)})`);
    hexG.addColorStop(0.5, `rgba(239,68,68,${Math.min(1, cP)})`);
    hexG.addColorStop(1, `rgba(153,27,27,${cP * 0.7})`);
    ctx.fillStyle = hexG;
    ctx.shadowBlur = 14 * cP;
    ctx.shadowColor = RT.palette.dangerDark;
    ctx.fill();
    ctx.strokeStyle = `rgba(252,165,165,${cP * 0.7})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = `rgba(255,220,220,${cP * 0.9})`;
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;

    if (entity.wanchaiActive) {
      const hA = 0.35 + Math.sin(now / 90) * 0.2;
      ctx.save();
      ctx.globalAlpha = hA;
      ctx.strokeStyle = RT.palette.bossOrange;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = RT.palette.bossOrange;
      ctx.beginPath();
      ctx.arc(0, 0, R + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = hA * 0.65;
      ctx.strokeStyle = RT.palette.gold;
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 28;
      ctx.shadowColor = RT.palette.gold;
      ctx.beginPath();
      ctx.arc(0, 0, R + 14 + Math.sin(now / 110) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = hA * 0.28;
      ctx.strokeStyle = RT.palette.bossOrange;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 18;
      ctx.shadowColor = RT.palette.bossOrange;
      ctx.beginPath();
      ctx.arc(0, 0, R + 22 + Math.sin(now / 80) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const vibShim = Math.sin(now / 40) * 1.8;
      ctx.save();
      ctx.globalAlpha = 0.2 + Math.sin(now / 60) * 0.1;
      ctx.translate(vibShim, 0);
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 8;
      ctx.shadowColor = RT.palette.crit;
      ctx.beginPath();
      ctx.arc(0, 0, R, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.restore();
    }

    if (entity.passiveUnlocked) {
      const gA = 0.12 + Math.sin(now / 300) * 0.07;
      ctx.save();
      ctx.globalAlpha = gA;
      ctx.strokeStyle = RT.palette.crit;
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 18;
      ctx.shadowColor = RT.palette.crit;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, R + 20 + Math.sin(now / 220) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Hair silhouette — baked to OffscreenCanvas (static shape, no now-dependency)
    const _hairBm = AutoRenderer._getHairBaseBitmap();
    // originY = H-4=28 → entity (0,0) at bitmap (W/2, 28) → offset (-W/2, -(H-4))
    ctx.drawImage(_hairBm, -_hairBm.width / 2, -(_hairBm.height - 4));

    const spikeData = [
      [-11, -2, 12, "#3d0909"],
      [-5, -1, 9, "#450a0a"],
      [1, 0, 11, "#450a0a"],
      [7, 1, 8, "#3d0909"],
      [12, 2, 6, "#2d0606"],
    ];
    const hairPeriod = entity.wanchaiActive ? 150 : 380;
    for (const [bx, tipOff, h, col] of spikeData) {
      const wobble = Math.sin(now / hairPeriod + bx * 0.4) * 1.2;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(bx - 3.5, -R - 1);
      ctx.lineTo(bx + 3.5, -R - 1);
      ctx.lineTo(bx + tipOff + wobble, -R - 1 - h - wobble * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx - 3.5, -R - 1);
      ctx.lineTo(bx + 3.5, -R - 1);
      ctx.lineTo(bx + tipOff + wobble, -R - 1 - h - wobble * 0.4);
      ctx.closePath();
      ctx.stroke();
    }
    spikeData.forEach(([bx, tipOff, h], idx) => {
      const wobble = Math.sin(now / hairPeriod + bx * 0.4) * 1.2;
      const tx = bx + tipOff + wobble;
      const ty = -R - 1 - h - wobble * 0.4;
      const sg = ctx.createLinearGradient(bx, -R - 1, tx, ty);
      sg.addColorStop(0, "#5c1010");
      if (heatTier >= 2) {
        sg.addColorStop(0.5, RT.palette.danger);
        sg.addColorStop(
          1,
          heatTier === 3 ? "#fef08a" : RT.palette.bossOrangeMid
        );
      } else {
        sg.addColorStop(0.6, "#b91c1c");
        sg.addColorStop(1, RT.palette.bossOrange);
      }
      ctx.fillStyle = sg;
      ctx.globalAlpha = heatTier >= 2 ? 0.9 : 0.75;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(bx - 3.5, -R - 1);
      ctx.lineTo(bx + 3.5, -R - 1);
      ctx.lineTo(tx, ty);
      ctx.closePath();
      ctx.fill();
      const eBaseA = heatTier >= 2 ? 0.8 : 0.65;
      const eA =
        (entity.wanchaiActive ? 0.95 : eBaseA) +
        Math.sin(now / 200 + idx) * 0.25;
      ctx.globalAlpha = Math.max(0, Math.min(1, eA));
      const tipColor =
        heatTier === 3
          ? "#fef08a"
          : heatTier === 2
          ? RT.palette.bossOrangeMid
          : idx % 2 === 0
          ? RT.palette.bossOrange
          : RT.palette.danger;
      ctx.fillStyle = tipColor;
      ctx.shadowBlur = entity.wanchaiActive ? 14 : heatTier >= 2 ? 12 : 7;
      ctx.shadowColor = RT.palette.bossOrange;
      ctx.beginPath();
      ctx.arc(tx, ty, heatTier >= 2 ? 3.0 : 2.2, 0, Math.PI * 2);
      ctx.fill();
      if (
        (entity.wanchaiActive || heatTier === 3) &&
        Math.sin(now / 120 + idx * 1.5) > 0.5
      ) {
        ctx.globalAlpha = heatTier === 3 ? 0.95 : 0.8;
        ctx.fillStyle = heatTier === 3 ? "#ffffff" : "#fef08a";
        ctx.shadowBlur = 10;
        ctx.shadowColor = RT.palette.crit;
        ctx.beginPath();
        ctx.arc(
          tx + Math.sin(now / 80 + idx) * 1.5,
          ty - 4,
          heatTier === 3 ? 1.5 : 1,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (entity.isSecondWind) {
      const swA = 0.3 + Math.sin(now / 110) * 0.2;
      ctx.save();
      ctx.globalAlpha = swA;
      ctx.strokeStyle = RT.palette.danger;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = RT.palette.dangerDark;
      ctx.beginPath();
      ctx.arc(0, 0, R + 9 + Math.sin(now / 100) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    PlayerRenderer._drawHitFlash(ctx, entity, R);
    if (entity.hasShield) PlayerRenderer._drawEnergyShield(ctx, now);
    ctx.restore();
  }

  /**
   * LAYER 2 — Weapon socket + leading/trailing fists.
   * Runs inside its own ctx.save/restore (aim-rotated space).
   */
  static _drawAutoWeaponFists(entity, ctx, p) {
    const {
      screen,
      now,
      isFacingLeft,
      recoilX,
      recoilY,
      bobOffsetY,
      shootReach,
      ventGlow,
      R,
    } = p;
    const sT = entity._anim?.shootT ?? 0;
    const punchExtend = sT * 10;
    ctx.save();
    ctx.translate(screen.x + recoilX, screen.y + recoilY + bobOffsetY);
    ctx.rotate(entity.angle);
    if (isFacingLeft) ctx.scale(1, -1);
    ctx.translate(shootReach + punchExtend, 2);
    if (typeof drawAutoWeapon === "function") {
      drawAutoWeapon(ctx, entity.wanchaiActive, ventGlow);
    }
    const fistGlow = ventGlow * 0.8 + (entity.wanchaiActive ? 0.6 : 0);
    ctx.shadowBlur = 10 * fistGlow;
    ctx.shadowColor = RT.palette.dangerDark;
    ctx.fillStyle = "#4a0e0e";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(R + 4, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#7f1d1d";
    ctx.beginPath();
    ctx.arc(R + 2, -2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2d0606";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(R - 1, -2);
    ctx.lineTo(R + 9, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(R - 1, 1);
    ctx.lineTo(R + 9, 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(R - 1, 3.5);
    ctx.lineTo(R + 9, 3.5);
    ctx.stroke();
    const fistEmber =
      Math.max(0, 0.5 + Math.sin(now / 160) * 0.4) *
      (entity.wanchaiActive ? 1 : 0.6);
    ctx.fillStyle = `rgba(251,146,60,${fistEmber})`;
    ctx.shadowBlur = 8 * fistEmber;
    ctx.shadowColor = RT.palette.bossOrangeMid;
    ctx.beginPath();
    ctx.roundRect(R, -0.5, 8, 1.5, 1);
    ctx.fill();
    ctx.shadowBlur = 0;
    const rearPullBack = sT * 5;
    ctx.fillStyle = "#3d0808";
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 6 * fistGlow;
    ctx.shadowColor = RT.palette.dangerDark;
    ctx.beginPath();
    ctx.arc(-(R + 2 + rearPullBack), 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5c1010";
    ctx.beginPath();
    ctx.arc(-(R + 4 + rearPullBack), -1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  /**
   * WANCHAI STAND
   * ย้ายมาจาก WanchaiStand.draw()
   */
  static _drawWanchaiStand(stand, ctx) {
    if (!stand.active || typeof ctx === "undefined") return;
    const now = performance.now();
    const sc = worldToScreen(stand.x, stand.y);
    const t = now / 1000;
    const owner = stand.owner;
    const ht = owner?._heatTier ?? 0;
    const coreCol =
      ht >= 3
        ? "#fef08a"
        : ht >= 2
        ? "#f59e0b"
        : ht >= 1
        ? "#ef4444"
        : "#dc2626";
    const auraCol =
      ht >= 3
        ? "rgba(254,240,138,"
        : ht >= 2
        ? "rgba(245,158,11,"
        : ht >= 1
        ? "rgba(239,68,68,"
        : "rgba(220,38,38,";
    const punchCol = ht >= 3 ? "#fef08a" : ht >= 2 ? "#fbbf24" : "#ff6b6b";
    const armorCol1 = ht >= 2 ? "#92400e" : "#7f1d1d";
    const armorCol2 = ht >= 2 ? "#b45309" : "#991b1b";
    const armorCol3 = ht >= 2 ? "#f59e0b" : "#dc2626";
    const goldCol = ht >= 3 ? "#fef08a" : "#f59e0b";
    const isPunch = stand._phaseTimer > 0;
    const flashT = isPunch ? Math.min(1, stand._phaseTimer / 0.12) : 0;
    const side = stand._punchSide ?? 1;
    const facingL = Math.abs(stand.angle) > Math.PI / 2;
    const fs = facingL ? -1 : 1;
    const bob = Math.sin(t * 2.8);
    const sway = bob * 1.2;
    const breathe = Math.sin(t * 1.9) * 0.6;
    const eyeFlick = Math.sin(t * 7.0);
    const oraCombo = owner?._oraComboCount ?? 0;
    const comboIntensity = Math.min(1, oraCombo / 6);

    for (let i = stand.ghostTrail.length - 1; i >= 0; i--) {
      const g = stand.ghostTrail[i];
      const ga = g.alpha * 0.35;
      if (ga < 0.02) continue;
      const gs = worldToScreen(g.x, g.y);
      ctx.save();
      ctx.globalAlpha = ga;
      ctx.shadowBlur = 12;
      ctx.shadowColor = coreCol;
      ctx.fillStyle = coreCol;
      ctx.beginPath();
      ctx.arc(gs.x, gs.y - 22, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(gs.x, gs.y + 2, 13, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    {
      const hw = 30 + breathe * 3 + comboIntensity * 8;
      const ha = isPunch
        ? 0.35 + flashT * 0.3
        : 0.1 + breathe * 0.03 + comboIntensity * 0.08;
      ctx.save();
      ctx.translate(sc.x, sc.y + sway * 0.15);
      if (owner?.passiveUnlocked && (owner?._oraComboCount ?? 0) >= 5) {
        const absorbScale = 1.0 + comboIntensity * 0.25;
        ctx.scale(absorbScale, absorbScale);
        ctx.globalAlpha = comboIntensity * 0.45;
        ctx.strokeStyle = goldCol;
        ctx.lineWidth = 2 + comboIntensity * 2;
        ctx.shadowBlur = 18;
        ctx.shadowColor = goldCol;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 28 + comboIntensity * 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      if (ht === 0) {
        ctx.globalAlpha = 0.3 + Math.sin(t * 3) * 0.1;
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      const hG = ctx.createRadialGradient(0, 0, 2, 0, 0, hw + 14);
      hG.addColorStop(0, `${auraCol}${Math.min(1, ha * 2.5)})`);
      hG.addColorStop(0.35, `${auraCol}${ha})`);
      hG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = hG;
      ctx.shadowBlur = isPunch ? 40 : 20;
      ctx.shadowColor = coreCol;
      ctx.beginPath();
      ctx.ellipse(0, 0, hw, hw * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      if (isPunch && flashT > 0.06) {
        ctx.globalAlpha = flashT * 0.8;
        ctx.strokeStyle = punchCol;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 28;
        ctx.shadowColor = punchCol;
        ctx.beginPath();
        ctx.arc(0, 0, 32 + (1 - flashT) * 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = flashT * 0.45;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(0, 0, 50 + (1 - flashT) * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = flashT * 0.25;
        ctx.fillStyle = punchCol;
        ctx.shadowBlur = 50;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    {
      ctx.save();
      ctx.translate(sc.x, sc.y + sway * 0.25);
      ctx.scale(fs, 1);
      const legBob = isPunch ? 0 : bob * 1.8;
      const lgG = ctx.createLinearGradient(-10, 18, -10, 52);
      lgG.addColorStop(0, armorCol2);
      lgG.addColorStop(1, armorCol1);
      ctx.fillStyle = lgG;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.moveTo(-13, 18);
      ctx.lineTo(-16, 48 + legBob * 0.5);
      ctx.lineTo(-6, 50 + legBob * 0.5);
      ctx.lineTo(-5, 18);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(5, 18);
      ctx.lineTo(4, 50 - legBob * 0.5);
      ctx.lineTo(14, 48 - legBob * 0.5);
      ctx.lineTo(13, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = goldCol;
      ctx.globalAlpha = 0.85;
      ctx.shadowBlur = 6;
      ctx.shadowColor = goldCol;
      ctx.beginPath();
      ctx.ellipse(-10, 34, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(9, 34, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      const tG = ctx.createRadialGradient(-5, -8, 2, 0, 0, 22);
      tG.addColorStop(0, armorCol2);
      tG.addColorStop(0.5, armorCol1);
      tG.addColorStop(1, "#3d0000");
      ctx.fillStyle = tG;
      ctx.globalAlpha = 0.92 + breathe * 0.05;
      ctx.shadowBlur = isPunch ? 24 : 12;
      ctx.shadowColor = coreCol;
      ctx.beginPath();
      ctx.moveTo(-22, -4);
      ctx.quadraticCurveTo(-26, 6, -18, 20);
      ctx.lineTo(18, 20);
      ctx.quadraticCurveTo(26, 6, 22, -4);
      ctx.quadraticCurveTo(0, -10, -22, -4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `${auraCol}0.22)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(0, 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-20, -2);
      ctx.quadraticCurveTo(-10, 2, 0, 1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(20, -2);
      ctx.quadraticCurveTo(10, 2, 0, 1);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,0.18)`;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(-22, -4);
      ctx.quadraticCurveTo(0, -11, 22, -4);
      ctx.stroke();
      ctx.fillStyle = goldCol;
      ctx.globalAlpha = 0.55;
      ctx.shadowBlur = 4;
      ctx.shadowColor = goldCol;
      for (const [rx, ry] of [
        [-17, -6],
        [17, -6],
        [-14, 10],
        [14, 10],
      ]) {
        ctx.beginPath();
        ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = goldCol;
      ctx.globalAlpha = 0.9;
      ctx.shadowBlur = 8;
      ctx.shadowColor = goldCol;
      ctx.beginPath();
      ctx.ellipse(-22, -4, 8, 5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-22, -4, 5, 3, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = armorCol1;
      ctx.fill();
      ctx.fillStyle = goldCol;
      ctx.beginPath();
      ctx.ellipse(22, -4, 8, 5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(22, -4, 5, 3, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = armorCol1;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = armorCol1;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.roundRect(-18, 14, 36, 6, 2);
      ctx.fill();
      ctx.fillStyle = goldCol;
      ctx.globalAlpha = 0.95;
      ctx.shadowBlur = 6;
      ctx.shadowColor = goldCol;
      ctx.beginPath();
      ctx.roundRect(-4, 14, 8, 6, 1);
      ctx.fill();
      ctx.shadowBlur = 0;
      const cp =
        Math.max(0.4, 0.5 + Math.sin(now / 180) * 0.45) *
        (isPunch ? 1.8 : 1.0 + comboIntensity * 0.5);
      const cr = 6;
      ctx.save();
      ctx.translate(0, 8);
      ctx.beginPath();
      for (let hi = 0; hi < 6; hi++) {
        const ha2 = (hi / 6) * Math.PI * 2 - Math.PI / 6;
        hi === 0
          ? ctx.moveTo(Math.cos(ha2) * cr, Math.sin(ha2) * cr)
          : ctx.lineTo(Math.cos(ha2) * cr, Math.sin(ha2) * cr);
      }
      ctx.closePath();
      const cG = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
      cG.addColorStop(0, `rgba(255,255,255,${Math.min(1, cp * 0.9)})`);
      cG.addColorStop(0.4, `${auraCol}${Math.min(1, cp)})`);
      cG.addColorStop(1, `${auraCol}${cp * 0.3})`);
      ctx.fillStyle = cG;
      ctx.shadowBlur = 16 * cp;
      ctx.shadowColor = coreCol;
      ctx.fill();
      ctx.strokeStyle = goldCol;
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = cp * 0.7;
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    {
      ctx.save();
      ctx.translate(sc.x, sc.y + sway * 0.25);
      ctx.scale(fs, 1);
      const drawArm = (xDir, isActive) => {
        const isLead = xDir > 0;
        const elbX = isLead ? xDir * 16 : xDir * 12;
        const elbY = isLead ? -10 : 0;
        const idleX = isLead ? xDir * 20 : xDir * 24;
        const idleY = isLead ? -14 + bob * 1.0 : 4 + bob * 0.4;
        const hitX = isActive ? (isLead ? xDir * 42 : xDir * 36) : idleX;
        const hitY = isActive ? (isLead ? -8 : -5) : idleY;
        const fX = hitX,
          fY = hitY;
        ctx.strokeStyle = armorCol1;
        ctx.lineWidth = 8;
        ctx.lineCap = "round";
        ctx.shadowBlur = isActive ? 16 : 4;
        ctx.shadowColor = coreCol;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.moveTo(xDir * 20, -4);
        ctx.quadraticCurveTo(elbX + (isActive ? xDir * 5 : 0), elbY, fX, fY);
        ctx.stroke();
        ctx.lineWidth = 6;
        ctx.strokeStyle = armorCol2;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(elbX, elbY);
        ctx.quadraticCurveTo(
          elbX + xDir * 2,
          (elbY + fY) * 0.5,
          fX * 0.8,
          fY * 0.8
        );
        ctx.stroke();
        ctx.strokeStyle = goldCol;
        ctx.lineWidth = 2.0;
        ctx.globalAlpha = 0.65;
        ctx.shadowBlur = 5;
        ctx.shadowColor = goldCol;
        ctx.beginPath();
        ctx.moveTo(xDir * 19, -3);
        ctx.quadraticCurveTo(
          elbX,
          elbY + 1,
          fX * 0.7,
          fY * 0.7 + (idleY > 0 ? 1 : -1)
        );
        ctx.stroke();
        ctx.globalAlpha = 0.32;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(xDir * 18, -1);
        ctx.quadraticCurveTo(
          elbX - xDir,
          elbY + 3,
          fX * 0.65,
          fY * 0.65 + (idleY > 0 ? 2 : -2)
        );
        ctx.stroke();
        ctx.shadowBlur = 0;
        const fR = isActive ? 11 : 9;
        const gloveG = ctx.createRadialGradient(
          fX - 2,
          fY - 2,
          0.5,
          fX,
          fY,
          fR
        );
        gloveG.addColorStop(0, isActive ? "#ffffff" : armorCol3);
        gloveG.addColorStop(0.3, isActive ? punchCol : armorCol2);
        gloveG.addColorStop(0.7, armorCol1);
        gloveG.addColorStop(1, "#1a0000");
        ctx.fillStyle = gloveG;
        ctx.shadowBlur = isActive ? 22 + flashT * 20 : 8;
        ctx.shadowColor = isActive ? punchCol : coreCol;
        ctx.globalAlpha = isActive ? 0.97 : 0.82;
        ctx.beginPath();
        ctx.arc(fX, fY, fR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isActive ? goldCol : armorCol3;
        ctx.lineWidth = isActive ? 2.0 : 1.2;
        ctx.shadowBlur = isActive ? 12 : 4;
        ctx.shadowColor = goldCol;
        ctx.globalAlpha = isActive ? 0.9 : 0.45;
        ctx.beginPath();
        ctx.arc(fX, fY, fR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = isActive ? 10 : 4;
        ctx.shadowColor = "#ffffff";
        for (let k = 0; k < 4; k++) {
          const ky = fY - fR * 0.35 + k * (fR * 0.24);
          const kG = ctx.createRadialGradient(
            fX + fR * 0.7,
            ky,
            0,
            fX + fR * 0.7,
            ky,
            fR * 0.22
          );
          kG.addColorStop(0, "rgba(255,255,255,0.85)");
          kG.addColorStop(1, "rgba(220,38,38,0)");
          ctx.fillStyle = kG;
          ctx.globalAlpha = isActive ? 0.9 : 0.5;
          ctx.beginPath();
          ctx.ellipse(
            fX + fR * 0.7,
            ky,
            fR * 0.22,
            fR * 0.16,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.strokeStyle = isActive
          ? "rgba(255,255,255,0.55)"
          : `${auraCol}0.25)`;
        ctx.lineWidth = 1.0;
        ctx.globalAlpha = isActive ? 0.6 : 0.28;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(fX - fR * 0.65, fY - fR * 0.22 + k * 2.5);
          ctx.lineTo(fX + fR * 0.65, fY - fR * 0.22 + k * 2.5);
          ctx.stroke();
        }
        if (isActive && flashT > 0.08) {
          const bX = fX + xDir * 7;
          ctx.globalAlpha = flashT * 0.95;
          ctx.fillStyle = "#ffffff";
          ctx.shadowBlur = 28;
          ctx.shadowColor = punchCol;
          ctx.beginPath();
          ctx.arc(bX, fY, 7 + flashT * 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = punchCol;
          ctx.globalAlpha = flashT * 0.65;
          ctx.beginPath();
          ctx.arc(bX, fY, 4 + flashT * 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = goldCol;
          ctx.lineWidth = 1.5;
          for (let r = 0; r < 8; r++) {
            const ra = (r / 8) * Math.PI * 2;
            ctx.globalAlpha = flashT * 0.65;
            ctx.beginPath();
            ctx.moveTo(bX + Math.cos(ra) * 6, fY + Math.sin(ra) * 6);
            ctx.lineTo(bX + Math.cos(ra) * 20, fY + Math.sin(ra) * 20);
            ctx.stroke();
          }
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.2;
          for (let r = 0; r < 4; r++) {
            const ra = (r / 4) * Math.PI * 2 + Math.PI / 4;
            ctx.globalAlpha = flashT * 0.45;
            ctx.beginPath();
            ctx.moveTo(bX + Math.cos(ra) * 4, fY + Math.sin(ra) * 4);
            ctx.lineTo(bX + Math.cos(ra) * 28, fY + Math.sin(ra) * 28);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      };
      drawArm(1, isPunch && side > 0);
      drawArm(-1, isPunch && side < 0);
      if (owner?._standGuard) {
        ctx.save();
        ctx.globalAlpha = 0.75 + Math.sin(t * 6) * 0.1;
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#fbbf24";
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(22, -14);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(10, -4);
        ctx.lineTo(-22, -14);
        ctx.stroke();
        ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.1;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI * 0.65, Math.PI * 0.65);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    {
      ctx.save();
      ctx.translate(sc.x, sc.y + bob * 1.2);
      ctx.scale(fs, 1);
      const hy = -32 + breathe * 0.5;
      ctx.fillStyle = armorCol1;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(-6, hy + 12, 12, 9, 2);
      ctx.fill();
      const colG = ctx.createLinearGradient(-10, hy + 12, 10, hy + 12);
      colG.addColorStop(0, armorCol1);
      colG.addColorStop(0.5, armorCol2);
      colG.addColorStop(1, armorCol1);
      ctx.fillStyle = colG;
      ctx.globalAlpha = 0.88;
      ctx.beginPath();
      ctx.roundRect(-10, hy + 18, 20, 5, 2);
      ctx.fill();
      ctx.strokeStyle = goldCol;
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = 0.65;
      ctx.shadowBlur = 5;
      ctx.shadowColor = goldCol;
      ctx.beginPath();
      ctx.roundRect(-10, hy + 18, 20, 5, 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      const mkCol = goldCol;
      const mkColMid = ht >= 2 ? "#92400e" : "#b45309";
      const mkColDim = ht >= 2 ? "#78350f" : "#7c1d1d";
      const mkGlow = goldCol;
      const mkBandY = hy - 7;
      const mkBandH = 7;
      const mkPulse = 0.75 + Math.sin(t * 2.8) * 0.25;
      ctx.shadowBlur = 18 * mkPulse;
      ctx.shadowColor = mkGlow;
      ctx.fillStyle = mkColDim;
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      ctx.roundRect(-16, mkBandY, 32, mkBandH, 3);
      ctx.fill();
      const bandG = ctx.createLinearGradient(-16, 0, 16, 0);
      bandG.addColorStop(0, mkColDim);
      bandG.addColorStop(0.25, mkColMid);
      bandG.addColorStop(0.5, mkGlow);
      bandG.addColorStop(0.75, mkColMid);
      bandG.addColorStop(1, mkColDim);
      ctx.fillStyle = bandG;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.roundRect(-15, mkBandY + 1, 30, mkBandH - 2, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.40)";
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.roundRect(-15, mkBandY + 1, 30, 2.0, 1);
      ctx.fill();
      ctx.globalAlpha = 1.0;
      const mkSpikes = [
        { x: 0, h: 20, w: 4.2 },
        { x: -7, h: 15, w: 3.5 },
        { x: 7, h: 15, w: 3.5 },
        { x: -13, h: 10, w: 2.8 },
        { x: 13, h: 10, w: 2.8 },
      ];
      for (const sp of mkSpikes) {
        const bY = mkBandY + 1;
        const tipY = bY - sp.h;
        const spG = ctx.createLinearGradient(sp.x, bY, sp.x, tipY);
        spG.addColorStop(0, mkColDim);
        spG.addColorStop(0.3, mkColMid);
        spG.addColorStop(0.7, mkCol);
        spG.addColorStop(1, mkGlow);
        ctx.fillStyle = spG;
        ctx.shadowBlur = 14 * mkPulse;
        ctx.shadowColor = mkGlow;
        ctx.globalAlpha = 0.96;
        ctx.beginPath();
        ctx.moveTo(sp.x - sp.w, bY);
        ctx.quadraticCurveTo(sp.x - sp.w * 0.5, bY - sp.h * 0.5, sp.x, tipY);
        ctx.quadraticCurveTo(
          sp.x + sp.w * 0.5,
          bY - sp.h * 0.5,
          sp.x + sp.w,
          bY
        );
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.50)";
        ctx.lineWidth = 0.9;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(sp.x, bY - 2);
        ctx.lineTo(sp.x, tipY + 4);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 10;
        ctx.shadowColor = mkGlow;
        ctx.globalAlpha = mkPulse * 0.85;
        ctx.beginPath();
        ctx.arc(sp.x, tipY, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      const jY = mkBandY + mkBandH * 0.5;
      const jewelG = ctx.createRadialGradient(0, jY - 0.5, 0, 0, jY, 4.5);
      jewelG.addColorStop(0, "#ffffff");
      jewelG.addColorStop(0.3, coreCol);
      jewelG.addColorStop(1, mkColDim);
      ctx.fillStyle = jewelG;
      ctx.shadowBlur = 16 * mkPulse;
      ctx.shadowColor = coreCol;
      ctx.globalAlpha = mkPulse * 0.95;
      ctx.beginPath();
      ctx.moveTo(0, jY - 4.5);
      ctx.lineTo(3.5, jY);
      ctx.lineTo(0, jY + 4.5);
      ctx.lineTo(-3.5, jY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, jY - 4.5);
      ctx.lineTo(3.5, jY);
      ctx.lineTo(0, jY + 4.5);
      ctx.lineTo(-3.5, jY);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = mkCol;
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.shadowBlur = 6;
      ctx.shadowColor = mkGlow;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(-16, mkBandY + 2);
      ctx.quadraticCurveTo(-20, mkBandY + 4, -19, mkBandY + 10);
      ctx.stroke();
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(-16, mkBandY + 4);
      ctx.quadraticCurveTo(-21, mkBandY + 5, -20, mkBandY + 11);
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(16, mkBandY + 2);
      ctx.quadraticCurveTo(20, mkBandY + 4, 19, mkBandY + 10);
      ctx.stroke();
      ctx.globalAlpha = 0.42;
      ctx.beginPath();
      ctx.moveTo(16, mkBandY + 4);
      ctx.quadraticCurveTo(21, mkBandY + 5, 20, mkBandY + 11);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      const haloA = 0.18 + Math.sin(t * 2.2) * 0.07 + comboIntensity * 0.12;
      ctx.save();
      ctx.globalAlpha = haloA;
      ctx.fillStyle = coreCol;
      ctx.shadowBlur = 30;
      ctx.shadowColor = coreCol;
      ctx.beginPath();
      ctx.arc(0, hy, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
      const hG = ctx.createRadialGradient(-3, hy - 4, 1, 0, hy, 13);
      hG.addColorStop(0, ht >= 2 ? "#c47c40" : "#8a3535");
      hG.addColorStop(0.5, ht >= 2 ? "#8a4a10" : "#521818");
      hG.addColorStop(1, ht >= 2 ? "#3d1500" : "#1a0000");
      ctx.fillStyle = hG;
      ctx.globalAlpha = 0.92;
      ctx.shadowBlur = isPunch ? 22 : 10;
      ctx.shadowColor = coreCol;
      ctx.beginPath();
      ctx.arc(0, hy, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#100000";
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(0, hy, 13, Math.PI * 1.05, Math.PI * 2.0);
      ctx.closePath();
      ctx.fill();

      if (ht >= 3) {
        const _ocBase = "#7f1d1d";
        const _ocMid = "#b91c1c";
        const _ocBright = "#ef4444";
        const _ocTip = "#fbbf24";
        const _pulse = 0.8 + Math.sin(t * 3.5) * 0.2;
        const _mkBY = mkBandY;
        ctx.fillStyle = _ocBase;
        ctx.globalAlpha = 0.97;
        ctx.shadowBlur = 22 * _pulse;
        ctx.shadowColor = _ocBright;
        ctx.beginPath();
        ctx.roundRect(-16, _mkBY, 32, mkBandH, 3);
        ctx.fill();
        const _bandG = ctx.createLinearGradient(-16, 0, 16, 0);
        _bandG.addColorStop(0, _ocBase);
        _bandG.addColorStop(0.25, _ocMid);
        _bandG.addColorStop(0.5, _ocBright);
        _bandG.addColorStop(0.75, _ocMid);
        _bandG.addColorStop(1, _ocBase);
        ctx.fillStyle = _bandG;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.roundRect(-15, _mkBY + 1, 30, mkBandH - 2, 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.roundRect(-15, _mkBY + 1, 30, 2.0, 1);
        ctx.fill();
        const _ocSpikes = [
          { x: 0, h: 22, w: 4.5 },
          { x: -7, h: 17, w: 3.8 },
          { x: 7, h: 17, w: 3.8 },
          { x: -13, h: 11, w: 3.0 },
          { x: 13, h: 11, w: 3.0 },
        ];
        ctx.globalAlpha = 1.0;
        for (let _si = 0; _si < _ocSpikes.length; _si++) {
          const _sp = _ocSpikes[_si];
          const _bY = _mkBY + 1;
          const _wobble = Math.sin(t * 6.0 + _sp.x * 0.5) * 1.8;
          const _tipY = _bY - _sp.h + _wobble * 0.4;
          const _tipX = _sp.x + _wobble * 0.3;
          const _spG = ctx.createLinearGradient(_sp.x, _bY, _tipX, _tipY);
          _spG.addColorStop(0, _ocBase);
          _spG.addColorStop(0.3, _ocMid);
          _spG.addColorStop(0.7, _ocBright);
          _spG.addColorStop(1, _ocTip);
          ctx.fillStyle = _spG;
          ctx.shadowBlur = 18 * _pulse;
          ctx.shadowColor = _ocBright;
          ctx.globalAlpha = 0.97;
          ctx.beginPath();
          ctx.moveTo(_sp.x - _sp.w, _bY);
          ctx.quadraticCurveTo(
            _sp.x - _sp.w * 0.5,
            _bY - _sp.h * 0.5,
            _tipX,
            _tipY
          );
          ctx.quadraticCurveTo(
            _sp.x + _sp.w * 0.5,
            _bY - _sp.h * 0.5,
            _sp.x + _sp.w,
            _bY
          );
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "rgba(255,180,80,0.55)";
          ctx.lineWidth = 0.9;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.moveTo(_sp.x, _bY - 2);
          ctx.lineTo(_tipX, _tipY + 4);
          ctx.stroke();
          ctx.globalAlpha = _pulse * 0.95;
          ctx.fillStyle = _ocTip;
          ctx.shadowBlur = 16 + _si * 2;
          ctx.shadowColor = _ocBright;
          ctx.beginPath();
          ctx.arc(_tipX, _tipY, 2.0, 0, Math.PI * 2);
          ctx.fill();
          if (Math.sin(t * 5.0 + _si * 1.3) > 0.3) {
            ctx.globalAlpha = _pulse * 0.8;
            ctx.fillStyle = "#ffffff";
            ctx.shadowBlur = 10;
            ctx.shadowColor = _ocTip;
            ctx.beginPath();
            ctx.arc(
              _tipX + Math.sin(t * 3.5 + _si) * 2.5,
              _tipY - 5,
              1.2,
              0,
              Math.PI * 2
            );
            ctx.fill();
          }
        }
        const _jY2 = _mkBY + mkBandH * 0.5;
        const _jG2 = ctx.createRadialGradient(0, _jY2 - 0.5, 0, 0, _jY2, 5);
        _jG2.addColorStop(0, "#ffffff");
        _jG2.addColorStop(0.25, _ocTip);
        _jG2.addColorStop(0.6, _ocBright);
        _jG2.addColorStop(1, _ocBase);
        ctx.fillStyle = _jG2;
        ctx.shadowBlur = 20 * _pulse;
        ctx.shadowColor = _ocBright;
        ctx.globalAlpha = _pulse;
        ctx.beginPath();
        ctx.moveTo(0, _jY2 - 5);
        ctx.lineTo(4, _jY2);
        ctx.lineTo(0, _jY2 + 5);
        ctx.lineTo(-4, _jY2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = _ocBright;
        ctx.lineWidth = 1.8;
        ctx.lineCap = "round";
        ctx.shadowBlur = 8;
        ctx.shadowColor = _ocBright;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(-16, _mkBY + 2);
        ctx.quadraticCurveTo(-20, _mkBY + 4, -19, _mkBY + 10);
        ctx.stroke();
        ctx.globalAlpha = 0.42;
        ctx.beginPath();
        ctx.moveTo(-16, _mkBY + 4);
        ctx.quadraticCurveTo(-21, _mkBY + 5, -20, _mkBY + 11);
        ctx.stroke();
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.moveTo(16, _mkBY + 2);
        ctx.quadraticCurveTo(20, _mkBY + 4, 19, _mkBY + 10);
        ctx.stroke();
        ctx.globalAlpha = 0.42;
        ctx.beginPath();
        ctx.moveTo(16, _mkBY + 4);
        ctx.quadraticCurveTo(21, _mkBY + 5, 20, _mkBY + 11);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      const eyeY = hy + 1;
      ctx.shadowBlur = isPunch ? 20 : 11;
      ctx.shadowColor = coreCol;
      ctx.fillStyle = "#000000";
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      ctx.ellipse(-5, eyeY, 4.5, 2.4, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(5, eyeY, 4.5, 2.4, 0.08, 0, Math.PI * 2);
      ctx.fill();
      const eyeInt =
        Math.max(0.65, 0.75 + eyeFlick * 0.25) *
        (isPunch ? 1.5 : 1.0 + comboIntensity * 0.5);
      const mkEye = (x, y) => {
        const eG = ctx.createRadialGradient(x, y, 0, x, y, 3.8);
        eG.addColorStop(0, `rgba(255,255,255,${Math.min(1, eyeInt)})`);
        eG.addColorStop(0.35, `${auraCol}${Math.min(1, eyeInt * 0.95)})`);
        eG.addColorStop(1, `${auraCol}0.0)`);
        return eG;
      };
      ctx.fillStyle = mkEye(-5, eyeY);
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      ctx.ellipse(-5, eyeY, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mkEye(5, eyeY);
      ctx.beginPath();
      ctx.ellipse(5, eyeY, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(-8, eyeY);
      ctx.lineTo(-2, eyeY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, eyeY);
      ctx.lineTo(8, eyeY);
      ctx.stroke();
      ctx.strokeStyle = "#050000";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      ctx.moveTo(-12, hy - 5);
      ctx.lineTo(-2, hy - 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, hy - 8);
      ctx.lineTo(12, hy - 5);
      ctx.stroke();
      ctx.lineWidth = 2.0;
      ctx.strokeStyle = "#1a0000";
      ctx.beginPath();
      ctx.moveTo(-3, hy - 7);
      ctx.quadraticCurveTo(0, hy - 4.5, 3, hy - 7);
      ctx.stroke();
      ctx.strokeStyle = "rgba(200,80,30,0.65)";
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.moveTo(6, eyeY + 2.5);
      ctx.lineTo(10, eyeY + 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(7, eyeY + 3);
      ctx.lineTo(9, eyeY + 6);
      ctx.stroke();
      ctx.strokeStyle = armorCol2;
      ctx.lineWidth = 2.0;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(-5, hy + 9);
      ctx.lineTo(5, hy + 9);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-8, hy + 6);
      ctx.lineTo(-8, hy + 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, hy + 6);
      ctx.lineTo(8, hy + 9);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    {
      ctx.save();
      ctx.translate(sc.x, sc.y + bob * 0.4);
      const chipY = -60;
      const cA = 0.65 + Math.sin(t * 2.1) * 0.15;
      if (isPunch && flashT > 0.06) {
        ctx.globalAlpha = flashT * 0.8;
        ctx.strokeStyle = punchCol;
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 28;
        ctx.shadowColor = punchCol;
        ctx.beginPath();
        ctx.arc(0, chipY, 30 + (1 - flashT) * 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (oraCombo > 0) {
        const oraR = 20 + oraCombo * 2.5;
        const oraA = Math.min(0.7, oraCombo * 0.1);
        ctx.globalAlpha = oraA;
        ctx.strokeStyle = goldCol;
        ctx.lineWidth = 1.5 + oraCombo * 0.2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = goldCol;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(0, chipY, oraR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = cA * 0.8;
      ctx.fillStyle = "rgba(10,0,0,0.85)";
      ctx.strokeStyle = isPunch
        ? `rgba(255,200,50,${0.55 + flashT * 0.45})`
        : `${auraCol}0.55)`;
      ctx.lineWidth = isPunch ? 2.0 : 1.1;
      ctx.shadowBlur = isPunch ? 16 : 9;
      ctx.shadowColor = isPunch ? goldCol : coreCol;
      ctx.beginPath();
      ctx.roundRect(-24, chipY - 7, 48, 14, 4);
      ctx.fill();
      ctx.stroke();
      if (ht > 0) {
        const tierMark = ht >= 3 ? "💥" : ht >= 2 ? "🔥🔥" : "🔥";
        ctx.globalAlpha = cA * 0.96;
        ctx.font = "bold 7px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = ht >= 3 ? "#fef08a" : ht >= 2 ? "#f97316" : "#fb923c";
        ctx.fillText(tierMark, -23, chipY);
      }
      ctx.globalAlpha = cA;
      ctx.fillStyle = isPunch ? goldCol : coreCol;
      ctx.font = "bold 7.5px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = isPunch ? 14 : 6;
      ctx.shadowColor = isPunch ? goldCol : coreCol;
      const chipLabel = oraCombo >= 3 ? `ORA ×${oraCombo}` : "WANCHAI";
      ctx.fillText(chipLabel, 0, chipY);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.AutoRenderer = AutoRenderer;
