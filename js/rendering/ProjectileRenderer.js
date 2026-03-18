"use strict";
/**
 * js/rendering/ProjectileRenderer.js
 * ════════════════════════════════════════════════════════════════════
 * ProjectileRenderer — Decoupled rendering logic for all projectiles.
 * Static class that owns every ctx.* call for bullets, punches, and
 * character-specific effects.
 *
 * Load after: Projectile.js, map.js (worldToScreen)
 * Exports: window.ProjectileRenderer
 * ════════════════════════════════════════════════════════════════════
 */

class ProjectileRenderer {
  /**
   * Helper to draw all projectiles in a collection.
   */
  static drawAll(projectiles, ctx) {
    if (!projectiles || !ctx) return;
    for (const p of projectiles) {
      ProjectileRenderer.draw(p, ctx);
    }
  }

  /**
   * Dispatcher/Entry point for a single projectile.
   */
  static draw(p, ctx) {
    const screen = worldToScreen(p.x, p.y);
    ctx.save();
    ctx.translate(screen.x, screen.y);

    // ════════════════════════════════════════════════
    // REFLECTED (Pat Blade Guard — กระสุนศัตรูสะท้อนกลับ)
    // Checked first — team flag is already 'player' after reflect
    // ════════════════════════════════════════════════
    if (p.isReflected) {
      ProjectileRenderer._drawReflectedProjectile(p, ctx);
    }
    // ════════════════════════════════════════════════
    // HEAT WAVE (Auto — หมัดพุ่งออกมาจากสแตนด์)
    // ════════════════════════════════════════════════
    else if (p.kind === "heatwave") {
      ProjectileRenderer._drawHeatWave(p, ctx);
    }
    // ════════════════════════════════════════════════
    // WANCHAI PUNCH (Actual Fist Model)
    // ════════════════════════════════════════════════
    else if (p.kind === "punch") {
      ProjectileRenderer._drawWanchaiPunch(p, ctx);
    }
    // ════════════════════════════════════════════════
    // PAT — Katana Slash Wave (Slash Wave / Ambush Crescent)
    // ════════════════════════════════════════════════
    else if (p.kind === "katana") {
      ProjectileRenderer._drawKatanaWave(p, ctx);
    }
    // ════════════════════════════════════════════════
    // POOM — Enchanted Rice Cluster
    // ════════════════════════════════════════════════
    else if (p.isPoom) {
      ProjectileRenderer._drawPoomProjectile(p, ctx);
    }
    // ════════════════════════════════════════════════
    // PLAYER PROJECTILES — weapon-specific art
    // ════════════════════════════════════════════════
    else if (p.team === "player") {
      ProjectileRenderer._drawPlayerProjectile(p, ctx);
    }
    // ════════════════════════════════════════════════
    // ENEMY PROJECTILES — hex-grid math symbols
    // ════════════════════════════════════════════════
    else {
      ProjectileRenderer._drawEnemyProjectile(p, ctx);
    }

    ctx.restore();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAT — กระสุนสะท้อนกลับ (Blade Guard reflect / Perfect Parry)
  // Shows original enemy glyph with gold samurai-energy overlay.
  // team=player + isReflected=true → routed here before _drawPlayerProjectile.
  // ─────────────────────────────────────────────────────────────────────────
  static _drawReflectedProjectile(p, ctx) {
    ctx.rotate(p.angle + Math.PI); // face origin direction (bullet reversed)
    const now = performance.now();
    const t = now / 1000;
    const symSize = p.size || 14;
    const hexR = symSize * 0.9;

    // ── Reverse gold trail behind the reflected bullet ────────────────
    const trailLen = 34;
    const trailG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
    trailG.addColorStop(0, "rgba(0,0,0,0)");
    trailG.addColorStop(0.4, "rgba(251,191,36,0.18)");
    trailG.addColorStop(1, "rgba(251,191,36,0.60)");
    ctx.globalAlpha = 0.88;
    ctx.strokeStyle = trailG;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-trailLen, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Original enemy glyph (dimmed to not clash with overlay) ───────
    ctx.globalAlpha = 0.72;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.font = `bold ${symSize}px 'Share Tech Mono',monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeText(p.symbol, 0, 0);
    ctx.fillText(p.symbol, 0, 0);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // ── Gold corona ring ───────────────────────────────────────────────
    const coroAlpha = 0.45 + Math.sin(t * 6.0) * 0.2;
    ctx.globalAlpha = coroAlpha;
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#fbbf24";
    ctx.beginPath();
    ctx.arc(0, 0, hexR + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── 3 orbiting samurai slash arcs ─────────────────────────────────
    const spinA = t * 2.8;
    for (let si = 0; si < 3; si++) {
      const sa = spinA + (si / 3) * Math.PI * 2;
      const ax1 = Math.cos(sa) * (hexR + 3);
      const ay1 = Math.sin(sa) * (hexR + 3);
      const ax2 = Math.cos(sa + 0.85) * (hexR + 12);
      const ay2 = Math.sin(sa + 0.85) * (hexR + 12);
      ctx.globalAlpha = 0.68 + Math.sin(t * 3.5 + si * 2.1) * 0.25;
      ctx.strokeStyle = si === 0 ? "#fbbf24" : "#fef3c7";
      ctx.lineWidth = si === 0 ? 2.4 : 1.3;
      ctx.lineCap = "round";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(ax1, ay1);
      ctx.lineTo(ax2, ay2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PAT — Katana Slash Wave (kind='katana')
  //
  // Visual concept: a blade of energy flying FORWARD.
  // In top-down view, the wave body is PERPENDICULAR to the travel direction
  // (tall + vertical), with horizontal wind streaks trailing behind.
  // Like a glowing sword-slash mark cutting through the air.
  //
  // Layout (after ctx.rotate(angle)):
  //   ←  wind streaks  ←  |  blade body  |  →  travel direction
  //                       ↑ perpendicular to travel
  // ─────────────────────────────────────────────────────────────────────────
  static _drawKatanaWave(p, ctx) {
    ctx.rotate(p.angle);
    const now = performance.now();
    const t = now / 1000;
    const isGold = p.isCrit;

    // Visual sizing
    const H = isGold ? 28 : 22; // blade height (vertical span)
    const W = isGold ? 7 : 5; // blade thickness (horizontal)
    const glowCol = isGold ? "#fbbf24" : "#e2e8f0";
    const coreCol = isGold ? "#fef3c7" : "#ffffff";
    const midCol = isGold ? "#fbbf24" : "#cbd5e1";
    const edgeCol = isGold ? "#d97706" : "#475569";
    const trailCol = isGold ? "rgba(251,191,36," : "rgba(226,232,240,";

    // ── 3 horizontal wind-streak trails ──────────────────────────────
    // Spaced vertically, fade with distance; convey forward motion
    const streakOffsets = [-H * 0.45, 0, H * 0.45];
    for (let si = 0; si < 3; si++) {
      const oy = streakOffsets[si];
      const len = si === 1 ? 38 : 28; // centre streak is longest
      const w = si === 1 ? 1.4 : 0.9;
      const tG = ctx.createLinearGradient(-len, oy, 0, oy);
      tG.addColorStop(0, trailCol + "0)");
      tG.addColorStop(0.5, trailCol + "0.12)");
      tG.addColorStop(1, trailCol + "0.55)");
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = tG;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.shadowBlur = 6;
      ctx.shadowColor = glowCol;
      ctx.beginPath();
      ctx.moveTo(-len, oy);
      ctx.lineTo(-W * 0.5, oy);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // ── Blade body — crescent/leaf shape standing vertically ─────────
    // Built from two opposing bezier curves; narrow at tips, wide in centre
    const bladeG = ctx.createLinearGradient(0, -H, 0, H);
    bladeG.addColorStop(0, "rgba(0,0,0,0)");
    bladeG.addColorStop(0.15, edgeCol);
    bladeG.addColorStop(0.42, coreCol);
    bladeG.addColorStop(0.58, coreCol);
    bladeG.addColorStop(0.85, edgeCol);
    bladeG.addColorStop(1, "rgba(0,0,0,0)");

    ctx.globalAlpha = 0.94;
    ctx.fillStyle = bladeG;
    ctx.shadowBlur = isGold ? 24 : 16;
    ctx.shadowColor = glowCol;
    ctx.beginPath();
    // Right (leading) edge — slightly convex curve
    ctx.moveTo(0, -H);
    ctx.bezierCurveTo(W * 0.8, -H * 0.4, W, H * 0.4, 0, H);
    // Left (trailing) edge — shallower concave curve
    ctx.bezierCurveTo(-W * 0.4, H * 0.3, -W * 0.4, -H * 0.3, 0, -H);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // ── Sharp glint line down the leading edge ────────────────────────
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = coreCol;
    ctx.lineWidth = 0.8;
    ctx.lineCap = "round";
    ctx.shadowBlur = 8;
    ctx.shadowColor = isGold ? "#fef9c3" : "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(W * 0.55, -H * 0.7);
    ctx.bezierCurveTo(
      W * 0.85,
      -H * 0.15,
      W * 0.88,
      H * 0.15,
      W * 0.55,
      H * 0.7
    );
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ── Tip sparkles — upper and lower point ─────────────────────────
    for (const ty of [-H, H]) {
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = coreCol;
      ctx.shadowBlur = isGold ? 16 : 10;
      ctx.shadowColor = glowCol;
      ctx.beginPath();
      ctx.arc(0, ty, isGold ? 2.8 : 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // ── Centre energy pulse ───────────────────────────────────────────
    const pulse = 0.55 + Math.sin(t * 8.0) * 0.35;
    ctx.globalAlpha = pulse * 0.7;
    ctx.fillStyle = isGold ? "#fef3c7" : "#f0f9ff";
    ctx.shadowBlur = isGold ? 20 : 12;
    ctx.shadowColor = glowCol;
    ctx.beginPath();
    ctx.arc(W * 0.3, 0, isGold ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  static _drawHeatWave(p, ctx) {
    ctx.rotate(p.angle);
    const now = performance.now();
    // ── ลำแสงพลังงานลากหลังหมัด ─────────────────
    const trailLen = 36;
    const trailG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
    trailG.addColorStop(0, "rgba(220,38,38,0)");
    trailG.addColorStop(0.5, "rgba(239,68,68,0.25)");
    trailG.addColorStop(1, "rgba(251,113,133,0.55)");
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = trailG;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#dc2626";
    ctx.beginPath();
    ctx.moveTo(-trailLen, -4);
    ctx.lineTo(-4, -4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-trailLen + 6, 4);
    ctx.lineTo(-4, 4);
    ctx.stroke();

    // ── กำปั้น: ฝ่ามือ (Palm) ────────────────────
    ctx.globalAlpha = 0.97;
    const palmG = ctx.createLinearGradient(-10, -13, 14, 13);
    palmG.addColorStop(0, "#fff1f2");
    palmG.addColorStop(0.35, "#fb7185");
    palmG.addColorStop(1, "#be123c");
    ctx.fillStyle = palmG;
    ctx.shadowBlur = 22;
    ctx.shadowColor = "#f97316";
    ctx.beginPath();
    ctx.roundRect(-9, -12, 17, 24, [3, 5, 5, 3]);
    ctx.fill();

    // ── กำปั้น: แนวนิ้ว 4 นิ้ว (Knuckles) ────────
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff1f2";
    ctx.strokeStyle = "#9f1239";
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.roundRect(6, -11 + k * 6, 9, 5, [2, 3, 2, 1]);
      ctx.fill();
      ctx.stroke();
    }

    // ── แสง crit/heat ที่ข้อนิ้ว ─────────────────
    const kGlow = 0.6 + Math.sin(now / 60) * 0.4;
    ctx.globalAlpha = kGlow;
    ctx.fillStyle = "#fbbf24";
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#f97316";
    ctx.beginPath();
    ctx.arc(10, -8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // ── หัวแม่มือ (Thumb) ─────────────────────────
    ctx.globalAlpha = 0.92;
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fb7185";
    ctx.strokeStyle = "#9f1239";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-4, 11, 13, 6, 3);
    ctx.fill();
    ctx.stroke();

    // ── Impact rings — dual expanding arcs ───────
    const ringPhase = (now / 80) % (Math.PI * 2);
    const rInner = 14 + Math.sin(ringPhase) * 3;
    const rOuter = 20 + Math.sin(ringPhase * 0.7 + 1) * 4;
    ctx.globalAlpha = 0.55 + Math.sin(ringPhase) * 0.25;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#dc2626";
    ctx.beginPath();
    ctx.arc(8, 0, rInner, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 0.28 + Math.sin(ringPhase * 0.7) * 0.15;
    ctx.strokeStyle = "#fca5a5";
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(8, 0, rOuter, -Math.PI * 0.55, Math.PI * 0.55);
    ctx.stroke();
    // Heat shimmer dots at ring edge
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#fbbf24";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#f97316";
    for (let ri = -1; ri <= 1; ri++) {
      const ra = ri * 0.35;
      ctx.beginPath();
      ctx.arc(
        8 + Math.cos(ra) * rInner,
        Math.sin(ra) * rInner,
        1.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  static _drawWanchaiPunch(p, ctx) {
    ctx.rotate(p.angle);
    const now = performance.now();

    // Outer shockwave ring
    const swPhase = (now / 90) % (Math.PI * 2);
    const swR = 18 + Math.sin(swPhase) * 4;
    ctx.globalAlpha = 0.35 + Math.sin(swPhase) * 0.2;
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#dc2626";
    ctx.beginPath();
    ctx.arc(4, 0, swR, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = "#fca5a5";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(4, 0, swR + 6, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Speed lines — 3 tapered trails
    const trailCols = [
      "rgba(239,68,68,",
      "rgba(251,113,133,",
      "rgba(253,164,175,",
    ];
    [
      [-28, -9, 3],
      [-33, 0, 2.5],
      [-28, 9, 2],
    ].forEach(([x, y, w], ti) => {
      const tg = ctx.createLinearGradient(x, y, 4, y);
      tg.addColorStop(0, trailCols[ti] + "0)");
      tg.addColorStop(0.5, trailCols[ti] + "0.3)");
      tg.addColorStop(1, trailCols[ti] + "0.7)");
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = tg;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(4, y);
      ctx.stroke();
    });

    // Fist body — palm with gradient
    ctx.globalAlpha = 0.97;
    const fg = ctx.createLinearGradient(-10, -13, 14, 13);
    fg.addColorStop(0, "#fff1f2");
    fg.addColorStop(0.35, "#fb7185");
    fg.addColorStop(1, "#be123c");
    ctx.fillStyle = fg;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#f97316";
    ctx.beginPath();
    ctx.roundRect(-9, -12, 17, 24, [3, 5, 5, 3]);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Knuckle guards — 4 raised ridges
    ctx.fillStyle = "#ffe4e6";
    ctx.strokeStyle = "#9f1239";
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.roundRect(6, -11 + k * 6, 9, 5, [2, 3, 2, 1]);
      ctx.fill();
      ctx.stroke();
      // Knuckle impact glow
      const kg = 0.55 + Math.sin(now / 55 + k * 0.9) * 0.45;
      ctx.globalAlpha = kg;
      ctx.fillStyle = k % 2 === 0 ? "#fbbf24" : "#f97316";
      ctx.shadowBlur = 10 * kg;
      ctx.shadowColor = "#f97316";
      ctx.beginPath();
      ctx.arc(11, -8.5 + k * 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Thumb
    ctx.fillStyle = "#fb7185";
    ctx.strokeStyle = "#9f1239";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-4, 11, 13, 6, 3);
    ctx.fill();
    ctx.stroke();

    // Wrist band — golden stripe (Wanchai signature)
    ctx.fillStyle = "#fbbf24";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#f59e0b";
    ctx.beginPath();
    ctx.roundRect(-9, 5, 17, 3, 1);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  static _drawPoomProjectile(p, ctx) {
    ctx.rotate(p.angle);
    const r = p.isCrit ? 11 : 7.5;
    const now = performance.now();
    // emerald magic trail
    for (let ti = 0; ti < 5; ti++) {
      const td = (ti + 1) * (r * 0.65);
      const tR = r * (0.38 - ti * 0.055);
      if (tR <= 0) continue;
      ctx.globalAlpha = (1 - ti / 5) * 0.5;
      const wispG = ctx.createRadialGradient(-td, 0, 0, -td, 0, tR);
      wispG.addColorStop(0, "#34d399");
      wispG.addColorStop(1, "rgba(16,185,129,0)");
      ctx.fillStyle = wispG;
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#10b981";
      ctx.beginPath();
      ctx.arc(-td, 0, tR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#6ee7b7";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#10b981";
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    const poomGrains = [
      [0, 0, r],
      [-r * 0.65, -r * 0.42, r * 0.72],
      [r * 0.55, -r * 0.48, r * 0.68],
      [-r * 0.48, r * 0.55, r * 0.63],
      [r * 0.38, r * 0.52, r * 0.58],
    ];
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#fbbf24";
    for (const [gx, gy, gr] of poomGrains) {
      const gGrad = ctx.createRadialGradient(
        gx - gr * 0.25,
        gy - gr * 0.25,
        0,
        gx,
        gy,
        gr
      );
      gGrad.addColorStop(0, "#fffbeb");
      gGrad.addColorStop(0.55, "#fde68a");
      gGrad.addColorStop(1, "#d97706");
      ctx.fillStyle = gGrad;
      ctx.beginPath();
      ctx.arc(gx, gy, gr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    const veinPulse = 0.5 + Math.sin(now / 180) * 0.5;
    ctx.globalAlpha = 0.3 + veinPulse * 0.3;
    ctx.fillStyle = "#6ee7b7";
    ctx.shadowBlur = 5;
    ctx.shadowColor = "#10b981";
    ctx.beginPath();
    ctx.arc(-r * 0.18, -r * 0.2, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.25, r * 0.15, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (p.isCrit) {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.8;
      ctx.shadowBlur = 22;
      ctx.shadowColor = "#facc15";
      ctx.beginPath();
      ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 10;
      for (let si = 0; si < 8; si++) {
        const sa = (si / 8) * Math.PI * 2;
        ctx.globalAlpha = 0.6 + Math.sin(now / 120 + si) * 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * (r + 3), Math.sin(sa) * (r + 3));
        ctx.lineTo(Math.cos(sa) * (r + 11), Math.sin(sa) * (r + 11));
        ctx.stroke();
      }
    }
  }

  static _drawPlayerProjectile(p, ctx) {
    ctx.rotate(p.angle);
    const now = performance.now();
    const t = now / 1000;

    // ── Determine weapon kind and visual overrides ────────────────────
    const wk = p.weaponKind || (p.color === "#3b82f6" ? "auto" : "rifle");
    const isGolden = p.color === "#facc15"; // Ambush / Master buff
    const isCharged = p.symbol === "∑"; // Master charged release

    if (isGolden || isCharged) {
      // ── ✦ GOLDEN BUFF BULLET — shared across all Kao weapons ─────
      const trailLen = 40;
      const tG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
      tG.addColorStop(0, "rgba(250,204,21,0)");
      tG.addColorStop(0.5, "rgba(250,204,21,0.20)");
      tG.addColorStop(1, "rgba(250,204,21,0.48)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tG;
      ctx.lineWidth = 11;
      ctx.lineCap = "butt";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#facc15";
      ctx.beginPath();
      ctx.moveTo(-trailLen, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const bG = ctx.createLinearGradient(-4, 0, 22, 0);
      bG.addColorStop(0, "#eab308");
      bG.addColorStop(0.35, "#fef08a");
      bG.addColorStop(0.75, "#c89a00");
      bG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = bG;
      ctx.shadowBlur = 24;
      ctx.shadowColor = "#facc15";
      ctx.beginPath();
      ctx.moveTo(-4, -4.5);
      ctx.bezierCurveTo(5, -8, 16, -6, 22, 0);
      ctx.bezierCurveTo(16, 3.8, 5, 5.5, -4, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Gold halo ring
      ctx.globalAlpha = 0.68;
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.6;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#facc15";
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      // Rotating spikes
      ctx.strokeStyle = "#fef9c3";
      ctx.lineWidth = 0.9;
      ctx.shadowBlur = 8;
      for (let si = 0; si < 8; si++) {
        const sa = (si / 8) * Math.PI * 2 + t * 1.2;
        ctx.globalAlpha = 0.5 + Math.sin(t * 4 + si) * 0.32;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * 9, Math.sin(sa) * 9);
        ctx.lineTo(Math.cos(sa) * 18, Math.sin(sa) * 18);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.lineCap = "butt";
      return;
    }

    if (wk === "auto") {
      // ────────────────────────────────────────────────────────────────
      // เก้า AUTO — compact electric bolt, rapid-fire kinetic feel
      // Short trail, wide body, twin arc rings
      // ────────────────────────────────────────────────────────────────
      const trailLen = 22;
      const tG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
      tG.addColorStop(0, "rgba(96,165,250,0)");
      tG.addColorStop(0.5, "rgba(59,130,246,0.20)");
      tG.addColorStop(1, "rgba(147,197,253,0.50)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tG;
      ctx.lineWidth = 8;
      ctx.lineCap = "butt";
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(-trailLen, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Body — wider rounded bolt
      const bG = ctx.createLinearGradient(-4, 0, 17, 0);
      bG.addColorStop(0, "#1d4ed8");
      bG.addColorStop(0.3, "#93c5fd");
      bG.addColorStop(0.72, "#2280a8");
      bG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.96;
      ctx.fillStyle = bG;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#3b82f6";
      ctx.beginPath();
      ctx.moveTo(-4, -4);
      ctx.bezierCurveTo(3, -7, 12, -5.5, 17, 0);
      ctx.bezierCurveTo(12, 4, 3, 5.5, -4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Specular highlight streak
      ctx.globalAlpha = 0.82;
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 0.9;
      ctx.lineCap = "round";
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#1d4ed8";
      ctx.beginPath();
      ctx.moveTo(-2, 2.5);
      ctx.bezierCurveTo(4, 4.5, 10, 3.2, 16, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Twin kinetic arcs
      const phase = (t * 5.5) % (Math.PI * 2);
      const aR = 9 + Math.sin(phase) * 2;
      ctx.globalAlpha = 0.45 + Math.sin(phase) * 0.2;
      ctx.strokeStyle = "#93c5fd";
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#3b82f6";
      ctx.beginPath();
      ctx.arc(18, 0, aR, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(18, 0, aR + 5, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.lineCap = "butt";
    } else if (wk === "sniper") {
      // ────────────────────────────────────────────────────────────────
      // เก้า SNIPER — hyper-velocity tracer, near-white-hot core,
      // extreme trail length, twin shockwave halos
      // ────────────────────────────────────────────────────────────────
      const trailLen = 58;
      const tG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
      tG.addColorStop(0, "rgba(244,63,94,0)");
      tG.addColorStop(0.35, "rgba(244,63,94,0.12)");
      tG.addColorStop(0.75, "rgba(244,63,94,0.38)");
      tG.addColorStop(1, "rgba(253,164,175,0.65)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tG;
      ctx.lineWidth = 6;
      ctx.lineCap = "butt";
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#f43f5e";
      ctx.beginPath();
      ctx.moveTo(-trailLen, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Velocity ripples along trail
      for (let ri = 0; ri < 3; ri++) {
        const rp = 0.35 + ri * 0.2;
        const rx = -trailLen * rp;
        ctx.globalAlpha = 0.22 - ri * 0.06;
        ctx.strokeStyle = "#f43f5e";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, -7);
        ctx.lineTo(rx, 7);
        ctx.stroke();
      }

      // Needle body — ultra-thin, white-hot tip
      const nG = ctx.createLinearGradient(-4, 0, 25, 0);
      nG.addColorStop(0, "#be123c");
      nG.addColorStop(0.25, "#fda4af");
      nG.addColorStop(0.58, "#ffffff");
      nG.addColorStop(0.82, "#f43f5e");
      nG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.97;
      ctx.fillStyle = nG;
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#f43f5e";
      ctx.beginPath();
      ctx.moveTo(-4, -2.8);
      ctx.bezierCurveTo(4, -5.5, 18, -4, 25, 0);
      ctx.bezierCurveTo(18, 3, 4, 4, -4, 2.8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // White-hot tip flare
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#fda4af";
      ctx.beginPath();
      ctx.arc(24, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Shockwave halos
      const hp = (t * 4.8) % (Math.PI * 2);
      const hR = 11 + Math.sin(hp) * 3;
      ctx.globalAlpha = 0.4 + Math.sin(hp) * 0.22;
      ctx.strokeStyle = "#fda4af";
      ctx.lineWidth = 1.3;
      ctx.shadowBlur = 14;
      ctx.shadowColor = "#f43f5e";
      ctx.beginPath();
      ctx.arc(26, 0, hR, -Math.PI * 0.52, Math.PI * 0.52);
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#be123c";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(26, 0, hR + 6, -Math.PI * 0.44, Math.PI * 0.44);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.lineCap = "butt";
    } else if (wk === "shotgun") {
      // ────────────────────────────────────────────────────────────────
      // เก้า SHOTGUN — fat scatter pellet, warm orange-amber
      // Squat round slug body + thick smoky trail + heat shimmer ring
      // ────────────────────────────────────────────────────────────────
      const trailLen = 18;
      const tG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
      tG.addColorStop(0, "rgba(120,40,0,0)");
      tG.addColorStop(0.4, "rgba(194,65,12,0.25)");
      tG.addColorStop(1, "rgba(251,146,60,0.60)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tG;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#f97316";
      ctx.beginPath();
      ctx.moveTo(-trailLen, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Smoke wisps in trail — 3 deterministic offsets
      const smokeSeeds = [
        [-10, -4],
        [-16, 3],
        [-8, 5],
      ];
      for (let wi = 0; wi < 3; wi++) {
        const [sx, sy] = smokeSeeds[wi];
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = "#78350f";
        ctx.shadowBlur = 4;
        ctx.shadowColor = "#92400e";
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Slug body — fat, squat round pellet (wider than tall)
      const sG = ctx.createRadialGradient(-1, -2, 0, 0, 0, 8);
      sG.addColorStop(0, "#fef3c7"); // hot centre
      sG.addColorStop(0.35, "#fb923c"); // orange shell
      sG.addColorStop(0.72, "#c2410c"); // dark copper rim
      sG.addColorStop(1, "#7c2d12"); // scorched edge
      ctx.globalAlpha = 0.97;
      ctx.fillStyle = sG;
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#f97316";
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2); // wider than tall = squat slug
      ctx.fill();
      ctx.shadowBlur = 0;

      // Copper specular band across slug top
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 1.0;
      ctx.lineCap = "round";
      ctx.shadowBlur = 4;
      ctx.shadowColor = "#fbbf24";
      ctx.beginPath();
      ctx.moveTo(-5, -2.5);
      ctx.lineTo(5, -2.5);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Heat shimmer ring ahead of slug
      const hph = (t * 6.0) % (Math.PI * 2);
      const hR = 10 + Math.sin(hph) * 2.5;
      ctx.globalAlpha = 0.35 + Math.sin(hph) * 0.18;
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 1.3;
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#f97316";
      ctx.beginPath();
      ctx.arc(11, 0, hR, -Math.PI * 0.48, Math.PI * 0.48);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.lineCap = "butt";
    } else {
      // ────────────────────────────────────────────────────────────────
      // เก้า RIFLE — armor-piercing needle, dark navy/indigo,
      // longer trail with purple energy seam, sharp tip
      // ────────────────────────────────────────────────────────────────
      const trailLen = 35;
      const tG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
      tG.addColorStop(0, "rgba(99,102,241,0)");
      tG.addColorStop(0.45, "rgba(67,56,202,0.18)");
      tG.addColorStop(1, "rgba(129,140,248,0.50)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = tG;
      ctx.lineWidth = 9;
      ctx.lineCap = "butt";
      ctx.shadowBlur = 13;
      ctx.shadowColor = "#6366f1";
      ctx.beginPath();
      ctx.moveTo(-trailLen, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Thin energy seam inside trail
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#a5b4fc";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 6;
      ctx.shadowColor = "#818cf8";
      ctx.beginPath();
      ctx.moveTo(-trailLen + 6, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Needle body — longer, thinner, sharper tip
      const bG = ctx.createLinearGradient(-4, 0, 22, 0);
      bG.addColorStop(0, "#1e1b4b");
      bG.addColorStop(0.28, "#818cf8");
      bG.addColorStop(0.55, "#c7d2fe");
      bG.addColorStop(0.8, "#3730a3");
      bG.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = 0.97;
      ctx.fillStyle = bG;
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#6366f1";
      ctx.beginPath();
      ctx.moveTo(-4, -3.5);
      ctx.bezierCurveTo(3, -6.5, 14, -5.2, 22, 0);
      ctx.bezierCurveTo(14, 4.0, 3, 5.2, -4, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Specular
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#e0e7ff";
      ctx.lineWidth = 0.9;
      ctx.lineCap = "round";
      ctx.shadowBlur = 5;
      ctx.shadowColor = "#4338ca";
      ctx.beginPath();
      ctx.moveTo(-2, 2.8);
      ctx.bezierCurveTo(4, 4.5, 12, 3.2, 20, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Impact wavefront arc
      const wph = (t * 4.2) % (Math.PI * 2);
      const wR = 9 + Math.sin(wph) * 2.5;
      ctx.globalAlpha = 0.38 + Math.sin(wph) * 0.2;
      ctx.strokeStyle = "#a5b4fc";
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#6366f1";
      ctx.beginPath();
      ctx.arc(23, 0, wR, -Math.PI * 0.52, Math.PI * 0.52);
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#312e81";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(23, 0, wR + 5, -Math.PI * 0.44, Math.PI * 0.44);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.lineCap = "butt";
    }
  }

  static _drawEnemyProjectile(p, ctx) {
    ctx.rotate(p.angle);
    const now = performance.now();
    const t = now / 1000;
    const symSize = p.size || 14;
    const hexR = symSize * 0.85;
    const col = p.color || "rgba(220,38,38,1)";

    // ── Outer corona — large, color-keyed ────────────────────────────
    const coroA = 0.55 + Math.sin(t * 3.5) * 0.25;
    const coroG = ctx.createRadialGradient(0, 0, hexR * 0.25, 0, 0, hexR * 2.4);
    const r255 = col.replace(/rgba?\([^)]+\)/, col);
    coroG.addColorStop(0, col.replace(")", ",0.38)").replace("rgb(", "rgba("));
    coroG.addColorStop(
      0.5,
      col.replace(")", ",0.16)").replace("rgb(", "rgba(")
    );
    coroG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = coroG;
    ctx.globalAlpha = coroA;
    ctx.beginPath();
    ctx.arc(0, 0, hexR * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Inner spinning rune cross (4-arm sigil) ───────────────────────
    const runeRot = t * 1.8;
    const runeAlpha = 0.4 + Math.sin(t * 4.2) * 0.18;
    ctx.save();
    ctx.rotate(runeRot);
    ctx.globalAlpha = runeAlpha;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.0;
    ctx.lineCap = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = col;
    for (let ri = 0; ri < 4; ri++) {
      const ra = (ri / 4) * Math.PI * 2;
      const r1 = hexR * 0.28;
      const r2 = hexR * 0.75;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ra) * r1, Math.sin(ra) * r1);
      ctx.lineTo(Math.cos(ra) * r2, Math.sin(ra) * r2);
      ctx.stroke();
      // Cross-bar
      const mid = (r1 + r2) * 0.5;
      const bar = hexR * 0.15;
      const perp = ra + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(
        Math.cos(ra) * mid + Math.cos(perp) * bar,
        Math.sin(ra) * mid + Math.sin(perp) * bar
      );
      ctx.lineTo(
        Math.cos(ra) * mid - Math.cos(perp) * bar,
        Math.sin(ra) * mid - Math.sin(perp) * bar
      );
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // ── Spinning hex outline ──────────────────────────────────────────
    const hexRot = t * 0.9;
    ctx.save();
    ctx.rotate(hexRot);
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.5 + Math.sin(t * 3.8) * 0.22;
    ctx.shadowBlur = 10;
    ctx.shadowColor = col;
    ctx.beginPath();
    for (let hi = 0; hi < 6; hi++) {
      const ha = (hi / 6) * Math.PI * 2;
      if (hi === 0) ctx.moveTo(Math.cos(ha) * hexR, Math.sin(ha) * hexR);
      else ctx.lineTo(Math.cos(ha) * hexR, Math.sin(ha) * hexR);
    }
    ctx.closePath();
    ctx.stroke();
    // Vertex dots (alternating)
    ctx.fillStyle = col;
    ctx.shadowBlur = 6;
    for (let hi = 0; hi < 6; hi += 2) {
      const ha = (hi / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ha) * hexR, Math.sin(ha) * hexR, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // ── Math glyph — thicker stroke for contrast ──────────────────────
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 16;
    ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.font = `bold ${symSize}px 'Share Tech Mono',monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 4;
    ctx.strokeText(p.symbol, 0, 0);
    ctx.shadowBlur = 0;
    ctx.shadowBlur = 12;
    ctx.shadowColor = col;
    ctx.fillText(p.symbol, 0, 0);
    ctx.shadowBlur = 0;
  }
}

window.ProjectileRenderer = ProjectileRenderer;
