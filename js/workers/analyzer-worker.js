"use strict";
// js/workers/analyzer-worker.js
// Runs the PlayerPatternAnalyzer math off the main thread.
// Communicates via postMessage with WorkerBridge.js.
/**
 * ════════════════════════════════════════════════
 * Off-main-thread PlayerPattern math. Runs inside a Web Worker (no window.*).
 * Owned by: WorkerBridge.js (main thread). Never loaded via <script> tag.
 *
 * Design notes:
 *   - Mirrors WorkerAnalyzer ring-buffer logic from PlayerPatternAnalyzer.js but
 *     self-contained — Float32Array/Int8Array only, zero DOM access.
 *   - Samples at 10Hz internally; WorkerBridge throttles postMessage to match.
 *   - Posts back only on cache tick (~4Hz) to minimize serialize overhead.
 *   - Prediction: linear extrapolation only — no physics, intentionally cheap.
 *
 * Message protocol (in):
 *   { type:'sample', dt, px, py, bx, by }  → sample() + conditionally update()
 *   { type:'reset' }                        → reset()
 *
 * Message protocol (out, ~4Hz):
 *   { pattern, dir, kiteScore, circleScore, standScore, predictX, predictY }
 *   WorkerBridge writes these directly onto window.playerAnalyzer proxy fields.
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.3   ANALYZER_SAMPLES          ring-buffer capacity (~3s @ 10Hz)
 *  L.5   WorkerAnalyzer            main class
 *  L.28  .sample()                 push position into ring buffer
 *  L.50  .update()                 cache-tick gate (4Hz)
 *  L.57  ._recompute()             kite/circle/stand scoring logic
 *  L.86  .velocityEstimate()       Δpos / sampleInterval
 *  L.94  .predictedPosition()      linear extrapolation, capped 0.5s
 *  L.103 .reset()                  zero all buffers + cached state
 *  L.111 self.onmessage            message dispatcher
 *
 * ⚠️  Worker scope only — never add window.*, document, or canvas refs here.
 * ⚠️  _recompute() exits early if count < 4 — scores stay at last cached values.
 * ⚠️  predictedPosition returns null when count < 2; callers must null-check.
 * ════════════════════════════════════════════════
 */

const ANALYZER_SAMPLES = 30; // ~3 seconds at 10Hz sample rate

class WorkerAnalyzer {
  constructor() {
    this._posX = new Float32Array(ANALYZER_SAMPLES);
    this._posY = new Float32Array(ANALYZER_SAMPLES);
    this._dist = new Float32Array(ANALYZER_SAMPLES);
    this._side = new Int8Array(ANALYZER_SAMPLES);

    this._head = 0;
    this._count = 0;
    this._sampleTimer = 0;
    this._sampleInterval = 0.1;

    this._cacheTimer = 0;
    this._cacheInterval = 0.25;
    this._cachedPattern = "mixed";
    this._cachedDir = "none";
    this._kiteScore = 0;
    this._circleScore = 0;
    this._standScore = 0;
  }

  sample(dt, px, py, bx, by) {
    this._sampleTimer -= dt;
    if (this._sampleTimer > 0) return false;
    this._sampleTimer = this._sampleInterval;

    const i = this._head;
    this._posX[i] = px;
    this._posY[i] = py;
    this._dist[i] = Math.hypot(px - bx, py - by);

    const prev = (i + ANALYZER_SAMPLES - 1) % ANALYZER_SAMPLES;
    if (this._count > 0) {
      const bpx = px - bx;
      const bpy = py - by;
      const mvx = px - this._posX[prev];
      const mvy = py - this._posY[prev];
      this._side[i] = bpx * mvy - bpy * mvx >= 0 ? 1 : -1;
    } else {
      this._side[i] = 0;
    }

    this._head = (i + 1) % ANALYZER_SAMPLES;
    if (this._count < ANALYZER_SAMPLES) this._count++;
    return true;
  }

  update(dt) {
    this._cacheTimer -= dt;
    if (this._cacheTimer > 0) return false;
    this._cacheTimer = this._cacheInterval;
    this._recompute();
    return true;
  }

  _recompute() {
    const n = this._count;
    if (n < 4) return;

    let distInc = 0,
      distDec = 0;
    let sidePlus = 0,
      sideMinus = 0;
    let standCount = 0;

    const start = (this._head - n + ANALYZER_SAMPLES) % ANALYZER_SAMPLES;
    let prevDist = this._dist[start];

    for (let j = 1; j < n; j++) {
      const idx = (start + j) % ANALYZER_SAMPLES;
      const d = this._dist[idx];
      const dd = d - prevDist;

      if (dd > 5) distInc++;
      else if (dd < -5) distDec++;
      else standCount++;

      if (this._side[idx] > 0) sidePlus++;
      else if (this._side[idx] < 0) sideMinus++;

      prevDist = d;
    }

    const total = n - 1;
    this._kiteScore = distInc / total;
    this._circleScore = (Math.min(sidePlus, sideMinus) * 2) / total;
    this._standScore = standCount / total;

    if (this._kiteScore > 0.55) this._cachedPattern = "kiting";
    else if (this._circleScore > 0.45) this._cachedPattern = "circling";
    else if (this._standScore > 0.6) this._cachedPattern = "standing";
    else this._cachedPattern = "mixed";

    const bias = sidePlus - sideMinus;
    if (bias > total * 0.25) this._cachedDir = "left";
    else if (bias < -total * 0.25) this._cachedDir = "right";
    else this._cachedDir = "none";
  }

  velocityEstimate() {
    if (this._count < 2) return { vx: 0, vy: 0 };
    const inv = 1 / this._sampleInterval;
    const cur = (this._head - 1 + ANALYZER_SAMPLES) % ANALYZER_SAMPLES;
    const prev = (this._head - 2 + ANALYZER_SAMPLES) % ANALYZER_SAMPLES;
    return {
      vx: (this._posX[cur] - this._posX[prev]) * inv,
      vy: (this._posY[cur] - this._posY[prev]) * inv,
    };
  }

  predictedPosition(aheadSeconds = 0.25) {
    if (this._count < 2) return null;
    const t = Math.min(aheadSeconds, 0.5);
    const vel = this.velocityEstimate();
    const cur = (this._head - 1 + ANALYZER_SAMPLES) % ANALYZER_SAMPLES;
    return {
      x: this._posX[cur] + vel.vx * t,
      y: this._posY[cur] + vel.vy * t,
    };
  }

  reset() {
    this._posX.fill(0);
    this._posY.fill(0);
    this._dist.fill(0);
    this._side.fill(0);
    this._head = 0;
    this._count = 0;
    this._cachedPattern = "mixed";
    this._cachedDir = "none";
    this._kiteScore = 0;
    this._circleScore = 0;
    this._standScore = 0;
  }
}

const analyzer = new WorkerAnalyzer();

self.onmessage = function (e) {
  const data = e.data;
  if (data.type === "sample") {
    analyzer.sample(data.dt, data.px, data.py, data.bx, data.by);
    const updated = analyzer.update(data.dt);

    // Only post back when the cached data is updated (4Hz) to save serialize overhead
    if (updated) {
      const pred = analyzer.predictedPosition(0.25);
      self.postMessage({
        pattern: analyzer._cachedPattern,
        dir: analyzer._cachedDir,
        kiteScore: analyzer._kiteScore,
        circleScore: analyzer._circleScore,
        standScore: analyzer._standScore,
        predictX: pred ? pred.x : null,
        predictY: pred ? pred.y : null,
      });
    }
  } else if (data.type === "reset") {
    analyzer.reset();
  }
};
