"use strict";
/**
 * js/effects/PostProcessor.js
 * ════════════════════════════════════════════════════════════════
 * Screen-space bloom + vignette post-processing pass.
 * Runs AFTER drawGame() completes each frame, compositing onto a
 * separate overlay canvas so the game canvas stays untouched.
 *
 * ARCHITECTURE:
 *   gameCanvas (full-res, CTX)  ← drawGame() writes here every frame
 *       ↓  drawImage() with CSS blur filter
 *   _blurCanvas (half-res)      ← cheaper blur at 50% resolution
 *       ↓  drawImage() scaled up + screen blend
 *   postCanvas (full-res)       ← bloom layer rendered on top of gameCanvas
 *       ↓  vignette radial gradient drawn last
 *
 * RULES:
 *  - Zero game state reads — purely visual, no logic
 *  - Skips when GameState.phase !== 'PLAYING' (menu/gameover = no bloom)
 *  - Adaptive quality: disables bloom on mobile if avg FPS < FPS_FLOOR
 *  - All tuning via PostProcessor.config — no magic numbers in draw code
 *
 * LOAD ORDER: after game.js (needs CANVAS global) — see index.html
 *
 * CALL SITE (game.js, end of gameLoop):
 *   if (typeof PostProcessor !== 'undefined') PostProcessor.draw();
 *
 * ── TABLE OF CONTENTS ────────────────────────────────────────────
 *  L.46   config          tuning knobs — adjust here
 *  L.65   init()          called once after CANVAS is ready
 *  L.92   draw()          main entry — called every frame from gameLoop
 *  L.115  _drawBloom()    blur + screen-blend bloom pass
 *  L.143  _drawVignette() radial dark-frame vignette
 *  L.162  resize()        sync postCanvas/blurCanvas to CANVAS size
 *  L.178  _trackFps()     adaptive quality FPS sampler
 * ════════════════════════════════════════════════════════════════
 */

const PostProcessor = {

  // ── Tuning knobs ────────────────────────────────────────────────────────
  config: {
    // Bloom
    bloomEnabled:    true,
    bloomBlurPx:     6,      // blur radius on the half-res canvas (px)
    bloomAlpha:      0.28,   // screen-blend opacity — raise for stronger glow
    bloomScale:      0.5,    // half-res intermediate canvas (0.5 = 50%)
    bloomThreshold:  0,      // future: luminance threshold (0 = all pixels)

    // Vignette
    vignetteEnabled: true,
    vignetteAlpha:   0.55,   // max darkness at corners
    vignetteStart:   0.45,   // inner radius (0=center, 1=edge)
    vignetteEnd:     1.0,    // outer radius

    // Adaptive quality
    adaptiveQuality: true,   // disable bloom on mobile if FPS < FPS_FLOOR
    FPS_FLOOR:       48,     // min FPS before bloom is skipped
    FPS_SAMPLE_SEC:  3.0,    // seconds to average over
  },

  // ── Internal state ───────────────────────────────────────────────────────
  _postCanvas:  null,
  _postCtx:     null,
  _blurCanvas:  null,
  _blurCtx:     null,
  _ready:       false,
  _vigGrad:     null,  // cached vignette gradient (rebuilt on resize)
  _vigW:        0,
  _vigH:        0,

  // FPS tracking
  _fpsFrames:   0,
  _fpsClock:    0,
  _fpsAvg:      60,

  // ── init() ───────────────────────────────────────────────────────────────
  /**
   * Create postCanvas + blurCanvas, size to match gameCanvas.
   * Safe to call multiple times (no-op if already initialised).
   */
  init() {
    if (this._ready) return;
    if (typeof CANVAS === 'undefined' || !CANVAS) return;

    // Post canvas — full-res overlay, sits above gameCanvas in DOM
    this._postCanvas = document.getElementById('postCanvas');
    if (!this._postCanvas) {
      console.warn('[PostProcessor] #postCanvas not found — did you add it to index.html?');
      return;
    }
    this._postCtx = this._postCanvas.getContext('2d');

    // Blur canvas — off-DOM, half-res, used as bloom intermediate
    this._blurCanvas = new OffscreenCanvas(1, 1);
    this._blurCtx    = this._blurCanvas.getContext('2d');

    this.resize();
    this._ready = true;
    console.log('[PostProcessor] initialised ✅');
  },

  // ── draw() ───────────────────────────────────────────────────────────────
  /**
   * Main entry point — call once per frame after drawGame().
   * Guards: only runs during PLAYING phase.
   */
  draw() {
    if (!this._ready) this.init();
    if (!this._ready) return;

    // Only apply post-fx while actively playing
    const phase = (typeof GameState !== 'undefined') ? GameState.phase : null;
    if (phase && phase !== 'PLAYING') {
      // Clear overlay so menu / gameover shows clean
      this._postCtx.clearRect(0, 0, this._postCanvas.width, this._postCanvas.height);
      return;
    }

    // Adaptive quality — skip bloom if FPS too low
    const cfg   = this.config;
    const doBloom = cfg.bloomEnabled && (!cfg.adaptiveQuality || this._fpsAvg >= cfg.FPS_FLOOR);

    this._postCtx.clearRect(0, 0, this._postCanvas.width, this._postCanvas.height);

    if (doBloom)          this._drawBloom();
    if (cfg.vignetteEnabled) this._drawVignette();
  },

  // ── _drawBloom() ─────────────────────────────────────────────────────────
  /**
   * 1. Draw gameCanvas → half-res blurCanvas with CSS blur filter.
   * 2. Draw blurCanvas → postCanvas scaled up with 'screen' blend.
   * Result: every bright pixel on the game canvas gets a soft halo.
   */
  _drawBloom() {
    const cfg  = this.config;
    const bw   = this._blurCanvas.width;
    const bh   = this._blurCanvas.height;
    const pw   = this._postCanvas.width;
    const ph   = this._postCanvas.height;
    const bCtx = this._blurCtx;
    const pCtx = this._postCtx;

    // Step 1: game → half-res with blur
    bCtx.clearRect(0, 0, bw, bh);
    bCtx.filter = `blur(${cfg.bloomBlurPx}px)`;
    bCtx.drawImage(CANVAS, 0, 0, bw, bh);
    bCtx.filter = 'none';

    // Step 2: blurred half-res → full-res postCanvas via screen blend
    pCtx.save();
    pCtx.globalCompositeOperation = 'screen';
    pCtx.globalAlpha = cfg.bloomAlpha;
    pCtx.drawImage(this._blurCanvas, 0, 0, pw, ph);
    pCtx.restore();
  },

  // ── _drawVignette() ──────────────────────────────────────────────────────
  /**
   * Radial gradient dark frame — subtly darkens corners to focus
   * the player's eye toward the centre of the screen.
   * Gradient is cached and rebuilt only on resize.
   */
  _drawVignette() {
    const cfg  = this.config;
    const pCtx = this._postCtx;
    const pw   = this._postCanvas.width;
    const ph   = this._postCanvas.height;

    // Rebuild gradient if canvas was resized
    if (!this._vigGrad || this._vigW !== pw || this._vigH !== ph) {
      const cx = pw / 2, cy = ph / 2;
      const r  = Math.max(pw, ph) * 0.75;
      this._vigGrad = pCtx.createRadialGradient(cx, cy, r * cfg.vignetteStart, cx, cy, r * cfg.vignetteEnd);
      this._vigGrad.addColorStop(0,   'rgba(0,0,0,0)');
      this._vigGrad.addColorStop(1,   `rgba(0,0,0,${cfg.vignetteAlpha})`);
      this._vigW = pw;
      this._vigH = ph;
    }

    pCtx.save();
    pCtx.globalCompositeOperation = 'source-over';
    pCtx.fillStyle = this._vigGrad;
    pCtx.fillRect(0, 0, pw, ph);
    pCtx.restore();
  },

  // ── resize() ─────────────────────────────────────────────────────────────
  /**
   * Sync postCanvas + blurCanvas dimensions to the game canvas.
   * Call when CANVAS is resized (window resize, orientation change).
   */
  resize() {
    if (!CANVAS || !this._postCanvas || !this._blurCanvas) return;
    const w = CANVAS.width;
    const h = CANVAS.height;

    this._postCanvas.width  = w;
    this._postCanvas.height = h;

    const bw = Math.ceil(w * this.config.bloomScale);
    const bh = Math.ceil(h * this.config.bloomScale);
    this._blurCanvas.width  = bw;
    this._blurCanvas.height = bh;

    // Invalidate cached vignette gradient
    this._vigGrad = null;
  },

  // ── _trackFps() ──────────────────────────────────────────────────────────
  /**
   * Call once per gameLoop tick (before draw) to track rolling FPS avg.
   * @param {number} dt  delta time in seconds
   */
  _trackFps(dt) {
    this._fpsFrames++;
    this._fpsClock += dt;
    if (this._fpsClock >= this.config.FPS_SAMPLE_SEC) {
      this._fpsAvg   = this._fpsFrames / this._fpsClock;
      this._fpsFrames = 0;
      this._fpsClock  = 0;
    }
  },
};

window.PostProcessor = PostProcessor;
