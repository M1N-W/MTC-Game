"use strict";
/**
 * js/rendering/boss/BossPresets.js
 * ════════════════════════════════════════════════════════════════
 * Phase-keyed and variant-keyed visual presets for all bosses.
 * Replaces inline hardcoded hex values in BossRenderer draw methods.
 *
 * RULES:
 *  - All hex values here are the SINGLE source of truth for boss visual theme
 *  - RT.palette.* used where values overlap with shared tokens (danger, gold, etc.)
 *  - Function fields (goggleGlow, symbolColFn, pointerCol) evaluated at draw time
 *    so RT overrides from RenderSkins.applySkin() are always reflected
 *  - NEVER read these inside a draw loop directly — destructure once at top of method
 *
 * LOAD ORDER:
 *  RenderTokens.js → BossPresets.js → BossRenderer.js
 *
 * HOW TO CHANGE A BOSS THEME:
 *  - Phase aura color: edit aura[1|2|3].main + rgba + strokeRgb + orbitFillRgb
 *  - KruFirst enraged look: edit first.enraged.main / glow / bodyDark / bodyMid
 *  - KruFirst goggle state color: edit first.goggleGlow function
 *
 * ── TABLE OF CONTENTS ────────────────────────────────────────────
 *  L.42   BOSS_PRESETS.manop.aura[1|2|3]   KruManop phase aura configs
 *  L.95   BOSS_PRESETS.manop.ring           silhouette ring per state
 *  L.103  BOSS_PRESETS.manop.enrageRing     phase 2 enrage extra ring
 *  L.107  BOSS_PRESETS.manop.symbolColFn    orbit symbol glyph color
 *  L.112  BOSS_PRESETS.first.normal/enraged KruFirst body variant colors
 *  L.124  BOSS_PRESETS.first.berserk        berserk aura fire colors
 *  L.130  BOSS_PRESETS.first.goggleGlow     state-driven goggle function
 *  L.138  BOSS_PRESETS.first.pointerCol     weapon pointer color function
 * ════════════════════════════════════════════════════════════════
 */

const BOSS_PRESETS = {
  // ══════════════════════════════════════════════════════════════
  // KRU MANOP (ManopBoss) — Mathematics Teacher
  // ══════════════════════════════════════════════════════════════
  manop: {
    /**
     * Phase aura presets — indexed by e.phase (1, 2, 3).
     * Fields used by BossRenderer._drawManopPhaseAura():
     *   main         — primary hex, used for shadowColor + symbolCol
     *   rgba         — "R,G,B" string for rgba() construction
     *   strokeRgb    — "R,G,B" for outer ring stroke rgba()
     *   fillA        — [stop0, stop0.7, stop1] gradient alpha stops
     *   strokeA      — { base, range, speed } → base + Math.sin(t3*speed)*range
     *   blur         — ctx.shadowBlur for outer ring
     *   lineWidth    — outer ring line width
     *   hasInnerRing — phase 2 only: extra pulsing inner ring
     *   innerRgb     — inner ring "R,G,B"
     *   innerA       — { base, range, speed }
     *   orbitCount   — number of orbiting dot nodes
     *   orbitSpeed   — radians/s multiplier
     *   orbitMargin  — px inset from auraR edge
     *   orbitFillRgb — "R,G,B" for orbit dot rgba()
     *   orbitFillA   — { base, range } alpha for orbit dot
     *   orbitBlur    — shadowBlur on orbit dots (0 = no glow)
     *   dotBase      — base radius of orbit dot
     *   dotRange     — ±range for sin oscillation of dot radius
     */
    aura: {
      1: {
        main: "#fbbf24",
        rgba: "251,191,36",
        strokeRgb: "252,211,77",
        fillA: [0.0, 0.15, 0.35],
        strokeA: { base: 0.45, range: 0.25, speed: 3 },
        blur: 18,
        lineWidth: 2.5,
        hasInnerRing: false,
        orbitCount: 4,
        orbitSpeed: 1.5,
        orbitMargin: 8,
        orbitFillRgb: "254,240,138",
        orbitFillA: { base: 0.35, range: 0.25 },
        orbitBlur: 8,
        dotBase: 4,
        dotRange: 1.5,
      },
      2: {
        main: "#ef4444",
        rgba: "239,68,68",
        strokeRgb: "248,113,113",
        fillA: [0.0, 0.2, 0.5],
        strokeA: { base: 0.55, range: 0.35, speed: 4 },
        blur: 22,
        lineWidth: 3.0,
        hasInnerRing: true,
        innerRgb: "220,38,38",
        innerA: { base: 0.4, range: 0.3, speed: 5 },
        orbitCount: 6,
        orbitSpeed: 2.2,
        orbitMargin: 6,
        orbitFillRgb: "252,165,165",
        orbitFillA: { base: 0.4, range: 0.3 },
        orbitBlur: 10,
        dotBase: 5,
        dotRange: 2.0,
      },
      3: {
        main: "#38bdf8",
        rgba: "56,189,248",
        strokeRgb: "125,211,252",
        fillA: [0.0, 0.18, 0.45],
        strokeA: { base: 0.5, range: 0.3, speed: 3 },
        blur: 20,
        lineWidth: 3.0,
        hasInnerRing: false,
        orbitCount: 5,
        orbitSpeed: 1.8,
        orbitMargin: 10,
        orbitFillRgb: "186,230,253",
        orbitFillA: { base: 0.4, range: 0.3 },
        orbitBlur: 0,
        dotBase: 5,
        dotRange: 2.0,
      },
    },

    /** Silhouette ring color per boss state. */
    ring: {
      phase3: { shadow: "#38bdf8", stroke: "rgba(56,189,248,0.50)" },
      enraged: { shadow: "#ef4444", stroke: "rgba(220,38,38,0.55)" },
      normal: { shadow: "#94a3b8", stroke: "rgba(148,163,184,0.40)" },
    },

    /** Phase 2 extra enrage ring (drawn when phase===2 and not charging). */
    enrageRing: { shadow: "#ef4444", stroke: "rgba(220,38,38,0.55)" },

    /**
     * Orbit symbol glyph color — evaluated at draw time.
     * Returns a hex string; reads RT so skin overrides propagate.
     * @param {ManopBoss} e
     */
    symbolColFn: (e) =>
      e.phase === 3 ? "#38bdf8" : e.isEnraged ? RT.palette.danger : "#facc15",
  },

  // ══════════════════════════════════════════════════════════════
  // KRU FIRST (KruFirst) — Physics Master
  // ══════════════════════════════════════════════════════════════
  first: {
    /** Body/ring theme — select by isEnraged boolean. */
    normal: {
      main: "#39ff14",
      glow: "#16a34a",
      bodyDark: "#0a1a08",
      bodyMid: "#0f2d0c",
    },
    enraged: {
      main: "#ef4444",
      glow: "#dc2626",
      bodyDark: "#2d0a0a",
      bodyMid: "#3f0e0e",
    },

    /** Berserk aura fire colors (alternating per flame index). */
    berserk: {
      colorA: "#ef4444",
      colorB: "#fb923c",
      shadow: "#ef4444",
    },

    /**
     * Goggle lens glow — state-driven, evaluated at draw time.
     * @param {KruFirst} e
     */
    goggleGlow: (e) =>
      e.isEnraged
        ? "#ff4444"
        : e.state === "EMP_ATTACK"
        ? RT.palette.accentMid // '#38bdf8' cyan
        : e.state === "SUVAT_CHARGE"
        ? RT.palette.bossOrange // '#f97316' orange
        : "#00ffff",

    /**
     * Energy pointer (weapon tip) glow color — state-driven.
     * @param {KruFirst} e
     */
    pointerCol: (e) =>
      e.isEnraged
        ? "#ff4444"
        : e.state === "EMP_ATTACK"
        ? RT.palette.accentMid
        : e.state === "SUVAT_CHARGE"
        ? RT.palette.bossOrange
        : "#00ffff",
  },
};

window.BOSS_PRESETS = BOSS_PRESETS;
