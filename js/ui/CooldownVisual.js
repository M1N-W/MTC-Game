// ══════════════════════════════════════════════════════════════════
//  CooldownVisual.js  —  extracted from UIManager in v3.44.3
//
//  This module owns the circular clock-wipe overlay + numeric countdown
//  drawn on any `.skill-icon` element (was `UIManager._setCooldownVisual`
//  in js/ui.js).  Extracted to start breaking up the 2 757-line god-file.
//
//  Exports:
//    window.CooldownVisual.set(iconId, current, max)
//
//  Backward compatibility:
//    UIManager._setCooldownVisual is kept as an alias (defined in ui.js)
//    so every existing call site continues to work unchanged.
//
//  Memoization (v3.44.1 E1):
//    Three per-element WeakMaps cache the last applied style strings.
//    Setter writes are skipped when the visible value has not changed.
//    Percentage is quantized to whole integers (~90 % fewer unique
//    conic-gradient strings vs the old 0.1 % quantisation).
// ══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // Smoothed progress per icon — survives ID reuse via WeakMap on element.
  const _smoothed = new WeakMap();

  // v3.44.1 E1 — memoize last applied style strings per element.
  const _lastBg = new WeakMap();
  const _lastTimer = new WeakMap();
  const _lastTimerVis = new WeakMap();

  /**
   * Inject the shared CSS rules for circular cooldown overlays.
   * Safe to call every frame — exits immediately after first run.
   */
  function injectStyles() {
    if (document.getElementById('mtc-cd-styles')) return;
    const s = document.createElement('style');
    s.id = 'mtc-cd-styles';
    s.textContent = `
      .skill-icon { position: relative; overflow: visible; }
      .cd-arc-overlay {
        position: absolute; inset: 0; border-radius: inherit;
        pointer-events: none; transition: background 0.08s linear;
        mix-blend-mode: multiply; z-index: 2;
      }
      .cd-timer-text {
        position: absolute; inset: 0;
        display: none; align-items: center; justify-content: center;
        color: #fff; font-family: 'Orbitron', monospace;
        font-size: 11px; font-weight: 700;
        text-shadow: 0 0 4px rgba(0,0,0,0.85);
        pointer-events: none; z-index: 3;
      }
    `;
    document.head.appendChild(s);
  }

  /**
   * Render the clock-wipe overlay + optional countdown on an icon.
   * @param {string} iconId             - id of the `.skill-icon` element
   * @param {number} cooldownCurrent    - seconds remaining (0 = ready)
   * @param {number} cooldownMax        - full cooldown duration
   */
  function set(iconId, cooldownCurrent, cooldownMax) {
    injectStyles();
    const icon = document.getElementById(iconId);
    if (!icon) return;

    // ── Circular arc overlay ─────────────────────────────────
    let arc = icon.querySelector('.cd-arc-overlay');
    if (!arc) {
      arc = document.createElement('div');
      arc.className = 'cd-arc-overlay';
      icon.appendChild(arc);
    }

    const targetElapsed = cooldownMax > 0
      ? Math.min(1, 1 - cooldownCurrent / cooldownMax)
      : 1;

    // Low-pass smooth (LERP 0.18 → ~60Hz, ~1.5 frame visual lag).
    const LERP = 0.18;
    const prev = _smoothed.get(icon) ?? targetElapsed;
    const smoothed = prev + (targetElapsed - prev) * LERP;
    _smoothed.set(icon, smoothed);

    // Quantise to whole-percent steps — ~90 % fewer unique strings.
    const pct = Math.round(smoothed * 100);
    const wantBg = cooldownCurrent > 0.05
      ? `conic-gradient(transparent 0% ${pct}%, rgba(0,0,0,0.62) ${pct}% 100%)`
      : 'transparent';
    if (_lastBg.get(arc) !== wantBg) {
      arc.style.background = wantBg;
      _lastBg.set(arc, wantBg);
    }
    if (cooldownCurrent <= 0.05) _smoothed.set(icon, 1); // snap to full

    // ── Countdown text ───────────────────────────────────────
    let timer = icon.querySelector('.cd-timer-text');
    if (!timer) {
      timer = document.createElement('div');
      timer.className = 'cd-timer-text';
      icon.appendChild(timer);
    }
    const showTimer = cooldownCurrent > 0.09 && cooldownMax > 5;
    if (showTimer) {
      const txt = cooldownCurrent.toFixed(1) + 's';
      if (_lastTimer.get(timer) !== txt) {
        timer.textContent = txt;
        _lastTimer.set(timer, txt);
      }
      if (_lastTimerVis.get(timer) !== 'flex') {
        timer.style.display = 'flex';
        _lastTimerVis.set(timer, 'flex');
      }
    } else if (_lastTimerVis.get(timer) !== 'none') {
      timer.style.display = 'none';
      _lastTimerVis.set(timer, 'none');
    }
  }

  // Expose globally (non-module pattern used across repo).
  if (typeof window !== 'undefined') {
    window.CooldownVisual = Object.freeze({ set, injectStyles });
  }
})();
