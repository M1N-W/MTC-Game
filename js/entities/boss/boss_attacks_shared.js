"use strict";
/**
 * js/entities/boss/boss_attacks_shared.js
 *
 * Attack effects shared by ALL bosses.
 *
 * Load order: must be loaded BEFORE boss_attacks_manop.js and boss_attacks_first.js
 *
 * Contents:
 *   DomainBase     — Shared boilerplate for all Domain Expansion singletons
 *   ExpandingRing  — Shockwave ring visual (used by both KruManop and KruFirst)
 */

// ════════════════════════════════════════════════════════════
// 💠 DOMAIN BASE — Shared boilerplate for Domain Expansion singletons
//
//  Both DomainExpansion (Manop) and GravitationalSingularity (First)
//  extend this via Object.create(DomainBase).
//
//  Shared surface:
//    State machine  — phase, timer, cooldownTimer, originX/Y, _flashTimer, _rain[]
//    Public API     — canTrigger(), isInvincible()
//    Helpers        — _beginCast(), _endDomain(), abort()
//    Rain system    — _initRain(cfg), _drawRain(ctx, now, W, H, globalA)
//    Announce       — _announceKaijo(boss, subtitleJP, subtitleEN, colorA, colorB, voiceLine)
//
//  Each subclass owns:
//    trigger(boss)         — calls _beginCast() + own state reset + _announceKaijo()
//    update(dt,boss,player)— full active phase logic (completely domain-specific)
//    draw(boss,ctx,W,H,now)— full visual rendering (completely domain-specific)
//    _abort(boss)          — calls abort() + clears own extra state
// ════════════════════════════════════════════════════════════
const DomainBase = {
  // ── Shared state ────────────────────────────────────────
  phase: "idle", // 'idle' | 'casting' | 'active' | 'ending'
  timer: 0,
  cooldownTimer: 0,
  originX: 0,
  originY: 0,
  _flashTimer: 0,
  _rain: [],

  // ── Public API ───────────────────────────────────────────
  canTrigger() {
    return this.phase === "idle" && this.cooldownTimer <= 0;
  },
  isInvincible() {
    return this.phase !== "idle";
  },

  // ── Shared trigger bootstrap ─────────────────────────────
  // Call at the top of each subclass trigger() before own state resets.
  _beginCast(boss, castDur) {
    this.phase = "casting";
    this.timer = castDur;
    this.originX = boss.x;
    this.originY = boss.y;
    boss._domainCasting = true;
    boss._domainActive = true;
    if (typeof addScreenShake === "function") addScreenShake(14);
    if (typeof Audio !== "undefined" && Audio.playBossSpecial)
      Audio.playBossSpecial();
  },

  // ── Shared ending teardown ───────────────────────────────
  // Call when phase === 'ending' timer hits 0.
  _endDomain(boss, cooldown) {
    this.phase = "idle";
    this.cooldownTimer = cooldown;
    boss._domainCasting = false;
    boss._domainActive = false;
    if (boss.state === "DOMAIN") {
      boss.state = "CHASE";
      boss.stateTimer = 0;
    }
  },

  // ── Abort (boss death / admin kill) ─────────────────────
  abort(boss) {
    this.phase = "idle";
    this.cooldownTimer = 0;
    this._rain = [];
    this._flashTimer = 0;
    if (boss) {
      boss._domainCasting = false;
      boss._domainActive = false;
    }
  },

  // ── Rain system ──────────────────────────────────────────
  // cfg = { pool: string, cols: number }
  // Each subclass passes its own character pool and column count.
  _initRain(cfg) {
    const pool = cfg.pool;
    const rainChar = () => pool[Math.floor(Math.random() * pool.length)];
    this._rain = [];
    for (let i = 0; i < cfg.cols; i++) {
      const len = 7 + Math.floor(Math.random() * 10);
      this._rain.push({
        xNorm: Math.random(),
        offsetY: Math.random() * 600,
        speed: 0.5 + Math.random() * 0.9,
        alpha: 0.2 + Math.random() * 0.35,
        chars: Array.from({ length: len }, rainChar),
      });
    }
  },

  // Draw the matrix rain. Colors passed as [headColor, midColor, tailColor].
  // ctx is the screen canvas context (already in screen space).
  _drawRain(ctx, now, W, H, globalA, colors) {
    const [headCol, midCol, tailCol] = colors;
    ctx.font = '11px "Courier New",monospace';
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    for (const col of this._rain) {
      const cx = col.xNorm * W,
        charH = 14;
      for (let i = 0; i < col.chars.length; i++) {
        const rawY =
          ((now * col.speed * H * 0.2 + col.offsetY + i * charH) %
            (H + charH * col.chars.length)) -
          charH * 4;
        const fade = 1.0 - i / col.chars.length;
        ctx.globalAlpha = globalA * col.alpha * fade;
        if (i === 0) {
          ctx.fillStyle = "#ffffff";
          ctx.shadowBlur = 8;
          ctx.shadowColor = headCol;
        } else if (i < 3) {
          ctx.fillStyle = headCol;
          ctx.shadowBlur = 4;
          ctx.shadowColor = headCol;
        } else {
          ctx.fillStyle = tailCol;
          ctx.shadowBlur = 0;
        }
        ctx.fillText(col.chars[i], cx, rawY);
      }
    }
    ctx.shadowBlur = 0;
  },

  // ── 領域展開 announce sequence ───────────────────────────
  // subtitleJP  — kanji subtitle (e.g. '重力特異点')
  // subtitleEN  — english name  (e.g. 'GRAVITATIONAL SINGULARITY')
  // colorA      — primary color (used for 領域展開 text + particles)
  // colorB      — secondary color (used for subtitle)
  // voiceLine   — second UIManager voice bubble (shown ~950ms after trigger)
  _announceKaijo(boss, subtitleJP, subtitleEN, colorA, colorB, voiceLine) {
    if (typeof spawnFloatingText === "function") {
      spawnFloatingText("領域展開", boss.x, boss.y - 130, colorA, 50);
      setTimeout(() => {
        if (typeof spawnFloatingText === "function")
          spawnFloatingText(subtitleJP, boss.x, boss.y - 185, colorB, 36);
      }, 700);
      setTimeout(() => {
        if (typeof spawnFloatingText === "function")
          spawnFloatingText(subtitleEN, boss.x, boss.y - 235, "#ffffff", 24);
      }, 1200);
    }
    if (
      window.UIManager &&
      typeof window.UIManager.showVoiceBubble === "function"
    ) {
      window.UIManager.showVoiceBubble("領域展開...", boss.x, boss.y - 50);
      if (voiceLine) {
        setTimeout(() => {
          if (window.UIManager)
            window.UIManager.showVoiceBubble(voiceLine, boss.x, boss.y - 50);
        }, 950);
      }
    }
  },
};

window.DomainBase = DomainBase;
// ════════════════════════════════════════════════════════════
// 💥 EXPANDING RING — Shockwave visual (BossFirst FREE_FALL)
// ════════════════════════════════════════════════════════════
class ExpandingRing {
  constructor(x, y, color, maxRadius = 140, duration = 0.5) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.timer = 0;
    this.dead = false;
  }
  update(dt) {
    this.timer += dt;
    if (this.timer >= this.duration) this.dead = true;
    return this.dead;
  }
  draw() {
    if (this.dead) return;
    const screen = worldToScreen(this.x, this.y);
    const prog = this.timer / this.duration;
    const r = this.maxRadius * Math.sqrt(prog);
    const alpha = 1 - prog;
    const now = performance.now();

    CTX.save();

    // ── Outer fill dome ───────────────────────────────────
    const fillG = CTX.createRadialGradient(
      screen.x,
      screen.y,
      r * 0.55,
      screen.x,
      screen.y,
      r
    );
    fillG.addColorStop(0, `rgba(255,255,255,0)`);
    fillG.addColorStop(
      0.7,
      (() => {
        const a = (alpha * 0.08).toFixed(3);
        if (this.color.startsWith("rgba("))
          return this.color.replace(/,\s*[\d.]+\)$/, `,${a})`);
        if (this.color.startsWith("rgb("))
          return this.color.replace("rgb(", "rgba(").replace(")", `,${a})`);
        const hex = this.color.replace("#", "");
        const full =
          hex.length === 3
            ? hex
                .split("")
                .map((c) => c + c)
                .join("")
            : hex;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${a})`;
      })()
    );
    fillG.addColorStop(1, "rgba(0,0,0,0)");
    CTX.globalAlpha = alpha * 0.6;
    CTX.fillStyle = fillG;
    CTX.beginPath();
    CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    CTX.fill();

    // ── Primary thick ring ────────────────────────────────
    CTX.globalAlpha = alpha * 0.95;
    CTX.strokeStyle = this.color;
    CTX.lineWidth = 7 * (1 - prog * 0.7);
    CTX.shadowBlur = 22 * (1 - prog);
    CTX.shadowColor = this.color;
    CTX.beginPath();
    CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    CTX.stroke();

    // ── Trailing inner ring ───────────────────────────────
    const r2 = this.maxRadius * Math.sqrt(prog * 0.78);
    CTX.globalAlpha = alpha * 0.5;
    CTX.lineWidth = 3.5 * (1 - prog);
    CTX.shadowBlur = 10;
    CTX.beginPath();
    CTX.arc(screen.x, screen.y, r2, 0, Math.PI * 2);
    CTX.stroke();

    // ── Spike burst at origin ─────────────────────────────
    if (prog < 0.35) {
      const sp = 1 - prog / 0.35;
      CTX.globalAlpha = alpha * sp * 0.7;
      CTX.lineWidth = 2;
      for (let si = 0; si < 8; si++) {
        const sa = (si / 8) * Math.PI * 2 + now * 0.002;
        const sLen = r * 0.22 * sp;
        CTX.beginPath();
        CTX.moveTo(
          screen.x + Math.cos(sa) * r * 0.1,
          screen.y + Math.sin(sa) * r * 0.1
        );
        CTX.lineTo(
          screen.x + Math.cos(sa) * sLen,
          screen.y + Math.sin(sa) * sLen
        );
        CTX.stroke();
      }
    }

    CTX.shadowBlur = 0;
    CTX.restore();
  }
}

window.ExpandingRing = ExpandingRing;
