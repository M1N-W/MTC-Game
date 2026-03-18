"use strict";

/**
 * js/effects/VisualPolish.js
 * ════════════════════════════════════════════════
 * Decals, shell casings, glitch effects, and wave announcements.
 * ════════════════════════════════════════════════
 */

class MeteorStrike {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.phase = "warning";
    this.timer = 0;
    this.warningDuration = 1.5;
    this.radius = 60;
  }
  update(dt, player, meteorZones) {
    this.timer += dt;
    if (this.phase === "warning") {
      if (this.timer >= this.warningDuration) {
        this.phase = "impact";
        this.timer = 0;
        if (typeof addScreenShake === "function") addScreenShake(10);
        if (window.particleSystem)
          window.particleSystem.spawn(this.x, this.y, 30, "#f59e0b");
        const d = dist(this.x, this.y, player.x, player.y);
        if (d < this.radius) player.takeDamage(BALANCE.mage.meteorDamage);
        meteorZones.push({
          x: this.x,
          y: this.y,
          radius: this.radius,
          damage: BALANCE.mage.meteorBurnDPS,
          life: BALANCE.mage.meteorBurnDuration,
        });
      }
    } else if (this.phase === "impact") return true;
    return false;
  }
  draw() {
    if (this.phase !== "warning") return;
    const screen = worldToScreen(this.x, this.y);
    const progress = this.timer / this.warningDuration; // 0→1 as meteor approaches
    const now = performance.now();
    const t = now / 1000;
    const r = this.radius;

    // ── Warning zone: scorch glow fill + pulsing danger ring ──────────
    const pulse = Math.sin(t * 10) * 0.3 + 0.7;
    const warnG = CTX.createRadialGradient(
      screen.x,
      screen.y,
      0,
      screen.x,
      screen.y,
      r
    );
    warnG.addColorStop(0, "rgba(220,38,38,0.22)");
    warnG.addColorStop(0.6, "rgba(180,20,0,0.10)");
    warnG.addColorStop(1, "rgba(0,0,0,0)");
    CTX.globalAlpha = pulse;
    CTX.fillStyle = warnG;
    CTX.beginPath();
    CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    CTX.fill();

    CTX.globalAlpha = pulse * 0.9;
    CTX.strokeStyle = `rgba(239,68,68,${pulse})`;
    CTX.lineWidth = 2.5;
    CTX.setLineDash([8, 6]);
    CTX.shadowBlur = 12;
    CTX.shadowColor = "#ef4444";
    CTX.beginPath();
    CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    CTX.stroke();
    CTX.setLineDash([]);
    CTX.shadowBlur = 0;
    CTX.globalAlpha = 1;

    // ── Meteor world-position: angled descent (top-right → impact) ───
    // TRAVEL_ANGLE: direction the meteor moves along (pointing toward target)
    const TRAVEL_ANGLE = Math.PI * 0.75; // ~135° — NE-to-SW visual arc
    const DROP = 340;
    const curOx = -Math.cos(TRAVEL_ANGLE) * DROP * (1 - progress);
    const curOy = -Math.sin(TRAVEL_ANGLE) * DROP * (1 - progress);
    const mx = screen.x + curOx;
    const my = screen.y + curOy;

    // ── Fire trail: 3 layered gradient strokes behind travel direction ─
    const trailLen = 70 + progress * 60;
    const trailDefs = [
      {
        w: 16,
        cols: [
          "rgba(251,113,133,0.90)",
          "rgba(239,68,68,0.35)",
          "rgba(0,0,0,0)",
        ],
        ox: 0,
        oy: 0,
      },
      {
        w: 10,
        cols: [
          "rgba(251,146,60,0.80)",
          "rgba(245,158,11,0.25)",
          "rgba(0,0,0,0)",
        ],
        ox: 4,
        oy: -3,
      },
      {
        w: 7,
        cols: [
          "rgba(253,186,116,0.65)",
          "rgba(234,88,12,0.20)",
          "rgba(0,0,0,0)",
        ],
        ox: -4,
        oy: 3,
      },
    ];
    for (let ti = 0; ti < trailDefs.length; ti++) {
      const td = trailDefs[ti];
      const ox = td.ox;
      const oy = td.oy;
      // tail end is behind the travel direction
      const tailX = mx - Math.cos(TRAVEL_ANGLE) * trailLen + ox;
      const tailY = my - Math.sin(TRAVEL_ANGLE) * trailLen + oy;
      const tG = CTX.createLinearGradient(mx + ox, my + oy, tailX, tailY);
      tG.addColorStop(0, td.cols[0]);
      tG.addColorStop(0.35, td.cols[1]);
      tG.addColorStop(1, td.cols[2]);
      CTX.globalAlpha = 0.95 - ti * 0.2;
      CTX.strokeStyle = tG;
      CTX.lineWidth = td.w;
      CTX.lineCap = "round";
      CTX.shadowBlur = 22 - ti * 6;
      CTX.shadowColor = "#f97316";
      CTX.beginPath();
      CTX.moveTo(mx + ox, my + oy);
      CTX.lineTo(tailX, tailY);
      CTX.stroke();
      CTX.shadowBlur = 0;
    }
    CTX.globalAlpha = 1;

    // ── Smoke/ash wisps drifting off the trail ────────────────────────
    // Deterministic: no Math.random — seeded by particle index
    for (let wi = 0; wi < 6; wi++) {
      const seed = wi * 137.5;
      const baseA = ((seed % 360) * Math.PI) / 180;
      const rise = (t * 0.5 + seed * 0.017) % 1.0; // 0→1 loop
      const wispX =
        mx - Math.cos(TRAVEL_ANGLE) * (20 + wi * 14) + Math.cos(baseA) * 5;
      const wispY =
        my -
        Math.sin(TRAVEL_ANGLE) * (20 + wi * 14) +
        Math.sin(baseA) * 5 -
        rise * 18;
      const wAlpha = Math.sin(rise * Math.PI) * 0.55;
      if (wAlpha < 0.01) continue;
      CTX.globalAlpha = wAlpha;
      CTX.fillStyle = `rgba(100,40,5,1)`;
      CTX.beginPath();
      CTX.arc(wispX, wispY, 3.5 + wi * 0.6, 0, Math.PI * 2);
      CTX.fill();
    }
    CTX.globalAlpha = 1;

    // ── Outer coma halo ───────────────────────────────────────────────
    const comaR = 24 + progress * 8;
    const comaG = CTX.createRadialGradient(mx, my, 0, mx, my, comaR);
    comaG.addColorStop(0, "rgba(255,220,120,0.05)");
    comaG.addColorStop(0.45, "rgba(251,146,60,0.30)");
    comaG.addColorStop(0.8, "rgba(220,38,38,0.45)");
    comaG.addColorStop(1, "rgba(0,0,0,0)");
    CTX.globalAlpha = 0.75;
    CTX.fillStyle = comaG;
    CTX.shadowBlur = 28;
    CTX.shadowColor = "#ea580c";
    CTX.beginPath();
    CTX.arc(mx, my, comaR, 0, Math.PI * 2);
    CTX.fill();
    CTX.shadowBlur = 0;
    CTX.globalAlpha = 1;

    // ── Rocky body — irregular 8-point polygon (spin deterministic) ───
    const R = 13 + progress * 5; // grows as it nears impact
    const spin = progress * Math.PI * 3.0; // 1.5 full rotations

    // Fixed vertex offsets — no Math.random needed
    const PTS = [
      [R * 1.0, R * 0.0],
      [R * 0.55, -R * 0.9],
      [-R * 0.2, -R * 1.1],
      [-R * 0.9, -R * 0.65],
      [-R * 1.1, R * 0.1],
      [-R * 0.65, R * 0.85],
      [R * 0.1, R * 1.05],
      [R * 0.8, R * 0.55],
    ];

    CTX.save();
    CTX.translate(mx, my);
    CTX.rotate(spin);

    // Body gradient: bright molten core → dark scorched crust
    const bodyG = CTX.createRadialGradient(
      -R * 0.28,
      -R * 0.28,
      0,
      0,
      0,
      R * 1.15
    );
    bodyG.addColorStop(0, "#fef08a"); // incandescent yellow
    bodyG.addColorStop(0.22, "#f97316"); // orange magma
    bodyG.addColorStop(0.5, "#b45309"); // brown rock
    bodyG.addColorStop(0.75, "#78350f"); // dark stone
    bodyG.addColorStop(1, "#1c0a00"); // charred rim
    CTX.fillStyle = bodyG;
    CTX.shadowBlur = 30;
    CTX.shadowColor = "#dc2626";
    CTX.beginPath();
    CTX.moveTo(PTS[0][0], PTS[0][1]);
    for (let pi = 1; pi < PTS.length; pi++) CTX.lineTo(PTS[pi][0], PTS[pi][1]);
    CTX.closePath();
    CTX.fill();
    CTX.shadowBlur = 0;

    // Surface crevices — fixed layout, zero RNG
    CTX.strokeStyle = "rgba(0,0,0,0.65)";
    CTX.lineWidth = 1.8;
    CTX.lineCap = "round";
    CTX.beginPath();
    CTX.moveTo(-R * 0.28, -R * 0.08);
    CTX.lineTo(R * 0.02, R * 0.32);
    CTX.moveTo(R * 0.22, -R * 0.42);
    CTX.lineTo(-R * 0.12, -R * 0.62);
    CTX.moveTo(R * 0.38, R * 0.22);
    CTX.lineTo(R * 0.08, R * 0.56);
    CTX.stroke();

    // Lava vein in central crack — glowing orange
    CTX.strokeStyle = "#fbbf24";
    CTX.lineWidth = 0.9;
    CTX.shadowBlur = 9;
    CTX.shadowColor = "#f97316";
    CTX.globalAlpha = 0.85;
    CTX.beginPath();
    CTX.moveTo(-R * 0.28, -R * 0.08);
    CTX.lineTo(R * 0.02, R * 0.32);
    CTX.stroke();
    CTX.shadowBlur = 0;
    CTX.globalAlpha = 1;

    CTX.restore();
  }
}

class Decal {
  static _pool = [];
  static MAX_POOL = 120;
  constructor(x, y, color, radius, lifetime) {
    this.reset(x, y, color, radius, lifetime);
  }
  reset(x, y, color, radius, lifetime) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = radius;
    this.life = lifetime;
    this.maxLife = lifetime;
    this.blobs = [];
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * radius * 0.6;
      this.blobs.push({
        ox: Math.cos(a) * d,
        oy: Math.sin(a) * d,
        rx: radius * (0.4 + Math.random() * 0.6),
        ry: radius * (0.2 + Math.random() * 0.4),
        rot: Math.random() * Math.PI,
      });
    }
    return this;
  }
  static acquire(x, y, color, radius, lifetime) {
    if (Decal._pool.length > 0)
      return Decal._pool.pop().reset(x, y, color, radius, lifetime);
    return new Decal(x, y, color, radius, lifetime);
  }
  release() {
    this.blobs = [];
    if (Decal._pool.length < Decal.MAX_POOL) Decal._pool.push(this);
  }
  update(dt) {
    this.life -= dt;
    return this.life <= 0;
  }
  draw() {
    if (typeof CANVAS !== "undefined") {
      const screen = worldToScreen(this.x, this.y);
      const pad = this.radius + 4;
      if (
        screen.x < -pad ||
        screen.x > CANVAS.width + pad ||
        screen.y < -pad ||
        screen.y > CANVAS.height + pad
      )
        return;
    }
    const t = this.life / this.maxLife;
    const alpha = t < 0.2 ? (t / 0.2) * 0.55 : 0.55;
    if (alpha < 0.01) return;
    CTX.globalAlpha = alpha;
    CTX.fillStyle = this.color;
    for (const b of this.blobs) {
      const screen = worldToScreen(this.x + b.ox, this.y + b.oy);
      CTX.save();
      CTX.translate(screen.x, screen.y);
      CTX.rotate(b.rot);
      CTX.beginPath();
      CTX.ellipse(0, 0, b.rx, b.ry, 0, 0, Math.PI * 2);
      CTX.fill();
      CTX.restore();
    }
    CTX.globalAlpha = 1;
  }
}

class DecalSystem {
  static MAX_DECALS = 80;
  constructor() {
    this.decals = [];
  }
  spawn(x, y, color, radius = 14, life = 18) {
    this.decals.push(Decal.acquire(x, y, color, radius, life));
    while (this.decals.length > DecalSystem.MAX_DECALS)
      this.decals.shift().release();
  }
  update(dt) {
    const arr = this.decals;
    let i = arr.length - 1;
    while (i >= 0) {
      if (arr[i].update(dt)) {
        arr[i].release();
        arr[i] = arr[arr.length - 1];
        arr.pop();
      }
      i--;
    }
  }
  draw() {
    if (typeof CTX !== "undefined" && CTX)
      for (const d of this.decals) d.draw();
  }
  clear() {
    for (const d of this.decals) d.release();
    this.decals = [];
  }
}

class ShellCasing {
  static _pool = [];
  static MAX_POOL = 100;
  constructor(x, y, vx, vy, rotation, rotSpeed, lifetime) {
    this.reset(x, y, vx, vy, rotation, rotSpeed, lifetime);
  }
  reset(x, y, vx, vy, rotation, rotSpeed, lifetime) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.rotation = rotation;
    this.rotSpeed = rotSpeed;
    this.life = lifetime;
    this.maxLife = lifetime;
    this.hasHitFloor = false;
    return this;
  }
  static acquire(x, y, vx, vy, rotation, rotSpeed, lifetime) {
    if (ShellCasing._pool.length > 0)
      return ShellCasing._pool
        .pop()
        .reset(x, y, vx, vy, rotation, rotSpeed, lifetime);
    return new ShellCasing(x, y, vx, vy, rotation, rotSpeed, lifetime);
  }
  release() {
    if (ShellCasing._pool.length < ShellCasing.MAX_POOL)
      ShellCasing._pool.push(this);
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.82;
    this.vy *= 0.82;
    if (!this.hasHitFloor && Math.hypot(this.vx, this.vy) < 15) {
      this.hasHitFloor = true;
      if (typeof Audio !== "undefined" && Audio.playShellDrop)
        Audio.playShellDrop();
    }
    this.rotation += this.rotSpeed * dt;
    this.life -= dt;
    return this.life <= 0;
  }
  draw() {
    const screen = worldToScreen(this.x, this.y);
    if (typeof CANVAS !== "undefined") {
      if (
        screen.x < -8 ||
        screen.x > CANVAS.width + 8 ||
        screen.y < -8 ||
        screen.y > CANVAS.height + 8
      )
        return;
    }
    const t = this.life / this.maxLife;
    const alpha = t < 0.5 ? (t / 0.5) * 0.9 : 0.9;
    if (alpha < 0.01) return;
    CTX.save();
    CTX.globalAlpha = alpha;
    CTX.translate(screen.x, screen.y);
    CTX.rotate(this.rotation);
    CTX.fillStyle = "#fbbf24";
    CTX.fillRect(-3, -1.5, 6, 3);
    CTX.fillStyle = "#fde68a";
    CTX.fillRect(-3, -1.5, 6, 1);
    CTX.restore();
    CTX.globalAlpha = 1;
  }
}

class ShellCasingSystem {
  static MAX_CASINGS = 120;
  constructor() {
    this.casings = [];
  }
  spawn(x, y, aimAngle, speed = 120) {
    const side = aimAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const s = speed * (0.7 + Math.random() * 0.6);
    const vx = Math.cos(side) * s;
    const vy = Math.sin(side) * s;
    const rot = Math.random() * Math.PI * 2;
    const rotSpeed = (Math.random() - 0.5) * 20;
    const life = 5 + Math.random() * 3;
    this.casings.push(ShellCasing.acquire(x, y, vx, vy, rot, rotSpeed, life));
    while (this.casings.length > ShellCasingSystem.MAX_CASINGS)
      this.casings.shift().release();
  }
  update(dt) {
    const arr = this.casings;
    let i = arr.length - 1;
    while (i >= 0) {
      if (arr[i].update(dt)) {
        arr[i].release();
        arr[i] = arr[arr.length - 1];
        arr.pop();
      }
      i--;
    }
  }
  draw() {
    if (typeof CTX !== "undefined" && CTX)
      for (const c of this.casings) c.draw();
  }
  clear() {
    for (const c of this.casings) c.release();
    this.casings = [];
  }
}

class WaveAnnouncementFX {
  constructor() {
    this._timer = 0;
    this._duration = 3.5;
    this._wave = 0;
    this._isBoss = false;
    this._isGlitch = false;
    this._eventType = null;
    this._eventTitle = "";
    this._eventSubtitle = "";
    this._eventColor = "#fff";
    this._barH = 0;
    this._active = false;
  }
  trigger(waveNum, isBoss = false, isGlitch = false) {
    this._wave = waveNum;
    this._isBoss = isBoss;
    this._isGlitch = isGlitch;
    this._eventType = null;
    this._eventTitle = "";
    this._eventSubtitle = "";
    this._eventColor = "#fff";
    this._timer = this._duration;
    this._barH = 0;
    this._active = true;
  }
  attachEvent(type, title, subtitle, color) {
    this._eventType = type;
    this._eventTitle = title;
    this._eventSubtitle = subtitle;
    this._eventColor = color;
  }
  get active() {
    return this._active;
  }
  update(dt) {
    if (!this._active) return;
    this._timer -= dt;
    const t = this._timer;
    const d = this._duration;
    const targetBarH = t > d - 0.3 || t < 0.4 ? 0 : 0.09;
    this._barH += (targetBarH - this._barH) * Math.min(1, dt * 14);
    if (this._timer <= 0) {
      this._timer = 0;
      this._active = false;
      this._barH = 0;
    }
  }
  draw(ctx) {
    if (!this._active || !ctx) return;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const elapsed = this._duration - this._timer;
    let alpha =
      elapsed < 0.3 ? elapsed / 0.3 : this._timer < 0.5 ? this._timer / 0.5 : 1;
    alpha = Math.max(0, Math.min(1, alpha));
    if (alpha < 0.01) return;
    const isBoss = this._isBoss;
    const isGlitch = this._isGlitch;
    const wave = this._wave;
    const hasEvent = !!this._eventType;
    const accentCol = isBoss ? "#ef4444" : isGlitch ? "#d946ef" : "#facc15";
    const accentRGB = isBoss
      ? "239,68,68"
      : isGlitch
      ? "217,70,239"
      : "250,204,21";
    ctx.save();
    ctx.globalAlpha = alpha;
    const barH = Math.round(this._barH * H);
    if (barH > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(0, 0, W, barH);
      ctx.fillStyle = `rgba(${accentRGB},0.45)`;
      ctx.fillRect(0, barH - 1, W, 1);
    }
    const cx = W / 2;
    const eventExtraH = hasEvent ? 36 : 0;
    const ph = 88 + eventExtraH;
    const cy = 72 + ph / 2;
    const pw = Math.min(W * 0.72, 520);
    const sl = 16;
    const holdProgress = Math.max(0, elapsed - 0.3);
    const pulse = 1 + Math.sin(holdProgress * 3.5) * 0.012;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);
    ctx.shadowBlur = 60;
    ctx.shadowColor = `rgba(${accentRGB},0.4)`;
    ctx.beginPath();
    ctx.moveTo(cx - pw / 2 + sl, cy - ph / 2);
    ctx.lineTo(cx + pw / 2, cy - ph / 2);
    ctx.lineTo(cx + pw / 2 - sl, cy + ph / 2);
    ctx.lineTo(cx - pw / 2, cy + ph / 2);
    ctx.closePath();
    ctx.fillStyle = "rgba(4,2,12,0.93)";
    ctx.fill();
    ctx.shadowBlur = 18;
    ctx.strokeStyle = accentCol;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = accentCol;
    for (let ly = cy - ph / 2 + 1; ly < cy + ph / 2; ly += 4)
      ctx.fillRect(cx - pw / 2 + sl + 1, ly, pw - sl * 2 - 2, 1);
    ctx.restore();
    if (hasEvent) {
      const divY = cy - ph / 2 + eventExtraH;
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = this._eventColor;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(cx - pw / 2 + sl + 8, divY);
      ctx.lineTo(cx + pw / 2 - sl - 8, divY);
      ctx.stroke();
      ctx.restore();
    }
    const bk = 13;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = accentCol;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - pw / 2 + sl + bk, cy - ph / 2 + 3);
    ctx.lineTo(cx - pw / 2 + sl + 3, cy - ph / 2 + 3);
    ctx.lineTo(cx - pw / 2 + sl + 3, cy - ph / 2 + 3 + bk);
    ctx.moveTo(cx + pw / 2 - sl - bk, cy + ph / 2 - 3);
    ctx.lineTo(cx + pw / 2 - sl - 3, cy + ph / 2 - 3);
    ctx.lineTo(cx + pw / 2 - sl - 3, cy + ph / 2 - 3 - bk);
    ctx.stroke();
    if (hasEvent) {
      const evCy = cy - ph / 2 + eventExtraH / 2;
      const evCol = this._eventColor;
      const icon = this._eventType === "speed" ? "⚡" : "🌫";
      const pillX = cx - pw / 2 + sl + 22;
      ctx.shadowBlur = 10;
      ctx.shadowColor = evCol;
      ctx.fillStyle = evCol;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.roundRect(pillX - 10, evCy - 9, 20, 18, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = evCol;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.roundRect(pillX - 10, evCy - 9, 20, 18, 3);
      ctx.stroke();
      ctx.font = "11px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = evCol;
      ctx.fillText(icon, pillX, evCy);
      ctx.shadowBlur = 14;
      ctx.shadowColor = evCol;
      ctx.fillStyle = "#ffffff";
      ctx.font = '800 13px "Orbitron","Rajdhani",Arial,sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(this._eventTitle, pillX + 16, evCy - 1);
      ctx.shadowBlur = 4;
      ctx.fillStyle = `rgba(${
        evCol === "#ef4444"
          ? "239,68,68"
          : evCol === "#d97706"
          ? "217,119,6"
          : "255,255,255"
      },0.72)`;
      ctx.font = '600 9px "Rajdhani",Arial,sans-serif';
      ctx.textAlign = "right";
      ctx.fillText(this._eventSubtitle, cx + pw / 2 - sl - 14, evCy);
      ctx.shadowBlur = 0;
    }
    const waveBodyTop = cy - ph / 2 + eventExtraH;
    const waveH = ph - eventExtraH;
    const waveCy = waveBodyTop + waveH / 2;
    const labelText = isBoss
      ? "⚔ BOSS ENCOUNTER"
      : isGlitch
      ? "⚠ ANOMALY DETECTED"
      : `— WAVE ${wave} —`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = accentCol;
    ctx.fillStyle = accentCol;
    ctx.font = '700 11px "Rajdhani","Orbitron",Arial,sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "3px";
    ctx.fillText(labelText, cx, waveCy - 24);
    const mainText = isBoss
      ? typeof GAME_TEXTS !== "undefined" && GAME_TEXTS?.wave?.boss
        ? GAME_TEXTS.wave.boss(wave)
        : `WAVE ${wave}`
      : isGlitch
      ? typeof GAME_TEXTS !== "undefined" && GAME_TEXTS?.wave?.glitchWave
        ? "GLITCH WAVE"
        : `WAVE ${wave} [GLITCH]`
      : typeof GAME_TEXTS !== "undefined" && GAME_TEXTS?.wave?.floatingTitle
      ? GAME_TEXTS.wave.floatingTitle(wave)
      : `WAVE ${wave}`;
    ctx.shadowBlur = 22;
    ctx.shadowColor = accentCol;
    ctx.fillStyle = "#ffffff";
    ctx.font = '900 32px "Bebas Neue","Orbitron",Arial,sans-serif';
    ctx.fillText(mainText, cx, waveCy + 6);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = accentCol;
    ctx.fillText(mainText, cx, waveCy + 6);
    ctx.restore();
    const subText = isBoss
      ? "PREPARE FOR COMBAT"
      : isGlitch
      ? "CONTROLS INVERTED"
      : wave <= 3
      ? "ELIMINATE ALL ENEMIES"
      : wave <= 8
      ? "HOLD YOUR GROUND"
      : wave <= 12
      ? "DANGER LEVEL: HIGH"
      : "FINAL STAND";
    ctx.shadowBlur = 6;
    ctx.shadowColor = accentCol;
    ctx.fillStyle = "rgba(254,243,199,0.75)";
    ctx.font = '600 10px "Rajdhani",Arial,sans-serif';
    ctx.fillText(subText, cx, waveCy + 30);
    const tkX = pw / 2 - sl - 22;
    ctx.strokeStyle = `rgba(${accentRGB},0.45)`;
    ctx.lineWidth = 1.2;
    for (let t2 = 0; t2 < 3; t2++) {
      const d2 = t2 * 5;
      ctx.beginPath();
      ctx.moveTo(cx + tkX + d2, waveCy + 22);
      ctx.lineTo(cx + tkX + d2, waveCy + 38);
      ctx.moveTo(cx - tkX - d2, waveCy + 22);
      ctx.lineTo(cx - tkX - d2, waveCy + 38);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }
}

function drawGlitchEffect(intensity, controlsInverted = false) {
  if (intensity <= 0) return;
  const W = CANVAS.width;
  const H = CANVAS.height;
  const now = performance.now();
  const maxOff = Math.floor(intensity * 18);
  if (maxOff >= 1) {
    const seed = Math.floor(now / 50);
    const jitterX = ((seed * 1372) % (maxOff * 2 + 1)) - maxOff;
    const jitterY = ((seed * 853) % (maxOff + 1)) - Math.floor(maxOff / 2);
    CTX.save();
    CTX.globalCompositeOperation = "screen";
    CTX.globalAlpha = intensity * 0.55;
    CTX.filter = "saturate(500%) hue-rotate(0deg)";
    CTX.drawImage(CANVAS, jitterX, jitterY * 0.5);
    CTX.filter = "none";
    CTX.restore();
    CTX.save();
    CTX.globalCompositeOperation = "screen";
    CTX.globalAlpha = intensity * 0.3;
    CTX.filter = "saturate(500%) hue-rotate(120deg)";
    CTX.drawImage(CANVAS, -jitterX * 0.4, 0);
    CTX.filter = "none";
    CTX.restore();
    CTX.save();
    CTX.globalCompositeOperation = "screen";
    CTX.globalAlpha = intensity * 0.3;
    CTX.filter = "saturate(500%) hue-rotate(240deg)";
    CTX.drawImage(CANVAS, jitterX * 0.6, -jitterY * 0.3);
    CTX.filter = "none";
    CTX.restore();
  }
  const scanAlpha = intensity * 0.22;
  const scanScroll = Math.floor(now / 80) % 3;
  CTX.save();
  CTX.globalAlpha = scanAlpha;
  CTX.fillStyle = "#000";
  for (let y = scanScroll; y < H; y += 3) CTX.fillRect(0, y, W, 1);
  CTX.restore();
  const sparkCount = Math.floor(intensity * 80);
  const sparkColors = [
    "#ff00ff",
    "#00ffff",
    "#ff3399",
    "#39ff14",
    "#ffffff",
    "#ff6600",
  ];
  CTX.save();
  for (let i = 0; i < sparkCount; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    const sw = 1 + Math.floor(Math.random() * 3);
    const sh = sw;
    CTX.globalAlpha = 0.35 + Math.random() * 0.65;
    CTX.fillStyle = sparkColors[Math.floor(Math.random() * sparkColors.length)];
    CTX.fillRect(sx, sy, sw, sh);
  }
  CTX.restore();
  if (intensity > 0.55) {
    const sliceSeed = Math.floor(now / 120);
    const numSlices = Math.floor(intensity * 4);
    for (let s = 0; s < numSlices; s++) {
      const sliceY = (sliceSeed * (s + 1) * 397) % H;
      const sliceH = 2 + ((sliceSeed * (s + 1) * 113) % 8);
      const sliceOff = (((sliceSeed * (s + 1) * 211) % 40) - 20) * intensity;
      CTX.save();
      CTX.globalCompositeOperation = "source-over";
      CTX.globalAlpha = 0.6;
      CTX.drawImage(CANVAS, 0, sliceY, W, sliceH, sliceOff, sliceY, W, sliceH);
      CTX.restore();
    }
  }
  const vigAlpha = intensity * (0.35 + Math.sin(now / 180) * 0.1);
  const vigGrad = CTX.createRadialGradient(
    W / 2,
    H / 2,
    H * 0.25,
    W / 2,
    H / 2,
    H * 0.85
  );
  vigGrad.addColorStop(0, "rgba(100,0,120,0)");
  vigGrad.addColorStop(1, `rgba(60,0,80,${vigAlpha.toFixed(3)})`);
  CTX.save();
  CTX.fillStyle = vigGrad;
  CTX.fillRect(0, 0, W, H);
  CTX.restore();
  {
    const bannerY = H * 0.12;
    const baseText = "⚡ GLITCH WAVE ⚡";
    const glitchChars = "!@#$%^&*<>?/\\|";
    let displayText = "";
    for (let i = 0; i < baseText.length; i++) {
      const ch = baseText[i];
      if (ch !== " " && ch !== "⚡" && Math.random() < 0.18 * intensity)
        displayText +=
          glitchChars[Math.floor(Math.random() * glitchChars.length)];
      else displayText += ch;
    }
    const fontSize = Math.floor(28 + intensity * 8);
    const pulse = 0.7 + Math.sin(now / 90) * 0.3;
    CTX.save();
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";
    CTX.font = `bold ${fontSize}px Orbitron, monospace`;
    CTX.fillStyle = `rgba(0,255,255,${(intensity * pulse * 0.7).toFixed(3)})`;
    CTX.fillText(displayText, W / 2 + 3, bannerY + 2);
    CTX.fillStyle = `rgba(255,0,100,${(intensity * pulse * 0.7).toFixed(3)})`;
    CTX.fillText(displayText, W / 2 - 3, bannerY - 2);
    CTX.shadowBlur = 14 * intensity;
    CTX.shadowColor = "#d946ef";
    CTX.fillStyle = `rgba(255,220,255,${(pulse * 0.92).toFixed(3)})`;
    CTX.fillText(displayText, W / 2, bannerY);
    CTX.shadowBlur = 0;
    const statusChars = [
      "REALITY.EXE",
      "PHYSICS.DLL",
      "CONTROLS.SYS",
      "MEMORY.ERR",
      "WAVE_DATA.BIN",
    ];
    const statusIdx = Math.floor(now / 400) % statusChars.length;
    CTX.font = `bold 11px monospace`;
    CTX.fillStyle = `rgba(236,72,153,${intensity * 0.85})`;
    CTX.fillText(
      `[ ${statusChars[statusIdx]} HAS STOPPED WORKING ]`,
      W / 2,
      bannerY + fontSize * 0.9
    );
    CTX.restore();
  }
  if (controlsInverted) {
    const stripH = 38;
    const stripY = H - stripH;
    const flashAlpha = 0.7 + Math.sin(now / 80) * 0.3;
    CTX.save();
    CTX.globalAlpha = 0.82;
    CTX.fillStyle = "#7e0040";
    CTX.fillRect(0, stripY, W, stripH);
    const fadeL = CTX.createLinearGradient(0, 0, 60, 0);
    fadeL.addColorStop(0, "rgba(0,0,0,0.6)");
    fadeL.addColorStop(1, "rgba(0,0,0,0)");
    CTX.fillStyle = fadeL;
    CTX.fillRect(0, stripY, 60, stripH);
    const fadeR = CTX.createLinearGradient(W - 60, 0, W, 0);
    fadeR.addColorStop(0, "rgba(0,0,0,0)");
    fadeR.addColorStop(1, "rgba(0,0,0,0.6)");
    CTX.fillStyle = fadeR;
    CTX.fillRect(W - 60, stripY, 60, stripH);
    CTX.globalAlpha = flashAlpha;
    CTX.fillStyle = "#ffffff";
    CTX.font = "bold 15px Orbitron, monospace";
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";
    CTX.shadowBlur = 10;
    CTX.shadowColor = "#ff00aa";
    CTX.fillText(
      "⚡  CONTROLS INVERTED — W↔S   A↔D  ⚡",
      W / 2,
      stripY + stripH / 2
    );
    CTX.shadowBlur = 0;
    CTX.restore();
  }
}

window.MeteorStrike = MeteorStrike;
window.Decal = Decal;
window.DecalSystem = DecalSystem;
window.decalSystem = new DecalSystem();
window.ShellCasing = ShellCasing;
window.ShellCasingSystem = ShellCasingSystem;
window.shellCasingSystem = new ShellCasingSystem();
window.WaveAnnouncementFX = WaveAnnouncementFX;
window.waveAnnouncementFX = new WaveAnnouncementFX();
window.drawGlitchEffect = drawGlitchEffect;
