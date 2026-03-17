"use strict";
/**
 * js/rendering/RenderTokens.js
 * ════════════════════════════════════════════════════════════════
 * Single source of truth for all visual style values used by
 * renderers. Renderers read from RT.* — never hardcode duplicates.
 *
 * RULES:
 *  - ห้าม hardcode สีซ้ำใน renderer ถ้ามี token อยู่แล้ว
 *  - ห้าม new object ใน draw loop — token values เป็น primitives
 *  - Skin/theme override ทำผ่าน RT.override(patch) เท่านั้น
 *
 * CHANGELOG:
 *  Session 2: palette.danger/shield/hp*, glow.danger/shield/hitFlash/bossEnraged,
 *             stroke.medium/thick, alpha.shield* / hitFlash*
 *  Session 3: palette.crit/critGlow/critTop/heal/healText/healBorder,
 *             glow.crit/critRing/heal — covers CombatEffects + BossRenderer enraged label
 *
 * ── TABLE OF CONTENTS ───────────────────────────────────────────
 *  L.35   Palette — สีหลัก (danger/gold/hp/accent/shield/boss/crit/heal/neutral)
 *  L.80   Glow profiles — shadowBlur + shadowColor pairs
 *  L.105  Stroke widths
 *  L.115  Alpha presets
 *  L.125  HP bar thresholds
 *  L.135  RT singleton + override()
 * ════════════════════════════════════════════════════════════════
 */

// ── Palette ──────────────────────────────────────────────────────────────────
const _palette = {
  // Danger / damage
  danger: "#ef4444", // hit flash, low HP, enraged, boss crit
  dangerDark: "#dc2626", // tie/secondary danger
  dangerSoft: "#fca5a5", // hit flash fill (normal)
  dangerSofter: "#fecaca", // hit flash fill (light)

  // Warning / gold
  gold: "#fbbf24", // level badge, boss aura phase 2, HP mid
  goldBright: "#facc15", // boss particle accent

  // HP bar
  hpHigh: "#39ff14", // HP > 55%
  hpMid: "#fbbf24", // HP 28–55%  (reuse gold)
  hpLow: "#ef4444", // HP < 28%   (reuse danger)

  // Accent / cyan
  accent: "#06b6d4", // primary cyan (Kao streaks, UI)
  accentMid: "#38bdf8", // mid cyan
  accentLight: "#7dd3fc", // light cyan
  accentPale: "#e0f2fe", // very light cyan / white-ish
  accentBlue: "#3b82f6", // blue accent

  // Shield / purple
  shield: "#8b5cf6", // energy shield outer ring
  shieldInner: "#c4b5fd", // energy shield inner dash ring
  shieldFill: "rgba(139,92,246,0.15)", // shield fill

  // Boss / orange
  bossOrange: "#f97316", // KruManop fire phase
  bossOrangeMid: "#fb923c", // KruManop secondary
  bossGreen: "#39ff14", // KruFirst ring / HP high (same as hpHigh)

  // Crit — gold number burst
  crit: "#facc15", // crit number fill mid-stop + HitMarker crit stroke/shadow
  critGlow: "#f59e0b", // crit shadow + gradient bottom stop
  critTop: "#fff7cc", // crit gradient top stop (near-white gold)

  // Heal — emerald panel
  heal: "#10b981", // heal panel shadow + glow
  healText: "#6ee7b7", // heal number fill (light emerald)
  healBorder: "rgba(16,185,129,0.75)", // heal panel stroke

  // Status effect overlays — EnemyOverlays.js
  sticky: "#00ff88", // sticky-stacks green tint + pips
  stickyPip: "#00ff88", // pip dots (same, named for intent clarity)
  slowRing: "#38bdf8", // slow ring outer stroke  (= accentMid reused)
  slowFill: "#bfdbfe", // slow ring inner frost fill

  // Neutral
  white: "#ffffff",
  overlayDark: "rgba(0,0,0,0.55)",
  overlayDeep: "rgba(0,0,0,0.70)",
  overlayBlack: "rgba(0,0,0,0.90)",
};

// ── Glow profiles — {blur, color} pairs ──────────────────────────────────────
// Usage: ctx.shadowBlur = RT.glow.danger.blur; ctx.shadowColor = RT.glow.danger.color;
const _glow = {
  danger: { blur: 18, color: "#ef4444" },
  dangerSoft: { blur: 8, color: "#ef4444" },
  dangerHard: { blur: 28, color: "#ef4444" },
  gold: { blur: 18, color: "#fbbf24" },
  goldSoft: { blur: 8, color: "#fbbf24" },
  shield: { blur: 15, color: "#8b5cf6" },
  shieldInner: { blur: 8, color: "#c4b5fd" },
  accent: { blur: 12, color: "#06b6d4" },
  accentBlue: { blur: 10, color: "#3b82f6" },
  badge: { blur: 10, color: null }, // color = badgeColor arg
  hitFlashBig: { blur: 18, color: "#ef4444" },
  hitFlashSml: { blur: 8, color: "#ef4444" },
  bossEnraged: { blur: 20, color: "#ef4444" }, // enraged ring pulse base
  crit: { blur: 28, color: "#f59e0b" }, // crit number shadow burst
  critRing: { blur: 12, color: "#facc15" }, // crit outer arc
  heal: { blur: 10, color: "#10b981" }, // heal panel glow
};

// ── Stroke widths ─────────────────────────────────────────────────────────────
const _stroke = {
  thin: 1.4,
  normal: 1.8,
  medium: 2.5,
  thick: 3.0,
  heavy: 6.0,
};

// ── Alpha presets ─────────────────────────────────────────────────────────────
const _alpha = {
  shieldPulseBase: 0.6,
  shieldPulseRange: 0.2,
  shieldInner: 0.55,
  shadowBase: 0.26,
  groundFeet: 0.55,
  hitFlashFill: 0.75,
  hitFlashRing: 0.55,
};

// ── HP bar thresholds ─────────────────────────────────────────────────────────
const _hp = {
  highThreshold: 0.55, // above this → hpHigh color
  midThreshold: 0.28, // above this → hpMid, below → hpLow
};

// ── RT singleton ──────────────────────────────────────────────────────────────
const RT = {
  palette: _palette,
  glow: _glow,
  stroke: _stroke,
  alpha: _alpha,
  hp: _hp,

  /**
   * Override specific token values (for skins / themes).
   * Only modifies provided keys — non-destructive.
   * @param {{ palette?: object, glow?: object, stroke?: object, alpha?: object, hp?: object }} patch
   */
  override(patch = {}) {
    if (patch.palette) Object.assign(_palette, patch.palette);
    if (patch.glow) {
      for (const [key, value] of Object.entries(patch.glow)) {
        if (
          value !== null &&
          typeof value === "object" &&
          _glow[key] !== null &&
          typeof _glow[key] === "object"
        ) {
          Object.assign(_glow[key], value);
        } else {
          _glow[key] = value;
        }
      }
    }
    if (patch.stroke) Object.assign(_stroke, patch.stroke);
    if (patch.alpha) Object.assign(_alpha, patch.alpha);
    if (patch.hp) Object.assign(_hp, patch.hp);
  },

  /**
   * Reset all tokens to factory defaults.
   * Call when unloading a skin.
   */
  reset() {
    const paletteDefaults = {
      danger: "#ef4444",
      dangerDark: "#dc2626",
      dangerSoft: "#fca5a5",
      dangerSofter: "#fecaca",
      gold: "#fbbf24",
      goldBright: "#facc15",
      hpHigh: "#39ff14",
      hpMid: "#fbbf24",
      hpLow: "#ef4444",
      accent: "#06b6d4",
      accentMid: "#38bdf8",
      accentLight: "#7dd3fc",
      accentPale: "#e0f2fe",
      accentBlue: "#3b82f6",
      shield: "#8b5cf6",
      shieldInner: "#c4b5fd",
      shieldFill: "rgba(139,92,246,0.15)",
      bossOrange: "#f97316",
      bossOrangeMid: "#fb923c",
      bossGreen: "#39ff14",
      crit: "#facc15",
      critGlow: "#f59e0b",
      critTop: "#fff7cc",
      heal: "#10b981",
      healText: "#6ee7b7",
      healBorder: "rgba(16,185,129,0.75)",
      white: "#ffffff",
      overlayDark: "rgba(0,0,0,0.55)",
      overlayDeep: "rgba(0,0,0,0.70)",
      overlayBlack: "rgba(0,0,0,0.90)",
      sticky: "#00ff88",
      stickyPip: "#00ff88",
      slowRing: "#38bdf8",
      slowFill: "#bfdbfe",
    };
    for (const key in _palette)
      if (!(key in paletteDefaults)) delete _palette[key];
    Object.assign(_palette, paletteDefaults);

    const glowDefaults = {
      danger: { blur: 18, color: "#ef4444" },
      dangerSoft: { blur: 8, color: "#ef4444" },
      dangerHard: { blur: 28, color: "#ef4444" },
      gold: { blur: 18, color: "#fbbf24" },
      goldSoft: { blur: 8, color: "#fbbf24" },
      shield: { blur: 15, color: "#8b5cf6" },
      shieldInner: { blur: 8, color: "#c4b5fd" },
      accent: { blur: 12, color: "#06b6d4" },
      accentBlue: { blur: 10, color: "#3b82f6" },
      badge: { blur: 10, color: null },
      hitFlashBig: { blur: 18, color: "#ef4444" },
      hitFlashSml: { blur: 8, color: "#ef4444" },
      bossEnraged: { blur: 20, color: "#ef4444" },
      crit: { blur: 28, color: "#f59e0b" },
      critRing: { blur: 12, color: "#facc15" },
      heal: { blur: 10, color: "#10b981" },
    };
    for (const key in _glow) if (!(key in glowDefaults)) delete _glow[key];
    Object.assign(_glow, glowDefaults);

    const strokeDefaults = {
      thin: 1.4,
      normal: 1.8,
      medium: 2.5,
      thick: 3.0,
      heavy: 6.0,
    };
    for (const key in _stroke)
      if (!(key in strokeDefaults)) delete _stroke[key];
    Object.assign(_stroke, strokeDefaults);

    const alphaDefaults = {
      shieldPulseBase: 0.6,
      shieldPulseRange: 0.2,
      shieldInner: 0.55,
      shadowBase: 0.26,
      groundFeet: 0.55,
      hitFlashFill: 0.75,
      hitFlashRing: 0.55,
    };
    for (const key in _alpha) if (!(key in alphaDefaults)) delete _alpha[key];
    Object.assign(_alpha, alphaDefaults);

    const hpDefaults = {
      highThreshold: 0.55,
      midThreshold: 0.28,
    };
    for (const key in _hp) if (!(key in hpDefaults)) delete _hp[key];
    Object.assign(_hp, hpDefaults);
  },
};

window.RT = RT;
