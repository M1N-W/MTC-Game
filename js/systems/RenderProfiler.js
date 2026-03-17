/**
 * RenderProfiler.js
 * ─────────────────────────────────────────────────────
 * Lightweight render performance profiler for MTC Game.
 * Zero allocations in tick() — uses pre-allocated Float32Array ring buffer.
 *
 * Usage:
 *   window.renderProfiler.start()
 *   window.renderProfiler.setScenario('boss_fight')
 *   window.renderProfiler.snapshot()   // saves current window stats
 *   window.renderProfiler.report()     // console.table all snapshots
 *
 * Admin commands (via AdminSystem):
 *   perf start | stop | reset | snap <label> | report | stress
 *
 * TOC:
 *   L1   — Class definition + constructor
 *   L55  — tick() [hot path — zero alloc]
 *   L72  — snapshot() / report()
 *   L108 — getLiveStats() [for HUD overlay]
 *   L125 — Singleton export
 */

class RenderProfiler {
  constructor() {
    // ── Ring buffer (300 frames ≈ 5s at 60fps) ──────────────────────
    this._buf = new Float32Array(300);
    this._idx = 0;
    this._count = 0;
    this._lastTime = 0;

    // ── State ────────────────────────────────────────────────────────
    this._active = false;
    this._scenario = "idle";
    this._snapshots = []; // [{scenario, avgFPS, p1low, minFPS, frames}]

    // ── Live display ─────────────────────────────────────────────────
    this._liveFPS = 0; // updated every tick — read by HUD
    this._framesSinceStart = 0;
  }

  // ── Control ──────────────────────────────────────────────────────────

  start() {
    this._active = true;
    this._lastTime = performance.now();
    this._framesSinceStart = 0;
    console.log(`[Profiler] Started — scenario: "${this._scenario}"`);
  }

  stop() {
    this._active = false;
    console.log("[Profiler] Stopped.");
  }

  reset() {
    this._idx = 0;
    this._count = 0;
    this._snapshots = [];
    this._liveFPS = 0;
    console.log("[Profiler] Reset.");
  }

  setScenario(tag) {
    this._scenario = tag;
  }

  // ── HOT PATH — called every frame ────────────────────────────────────
  tick() {
    if (!this._active) return;

    const now = performance.now();
    const dt = now - this._lastTime;
    this._lastTime = now;

    // Skip first frame, stalls, or impossible values
    if (dt <= 0 || dt > 500) return;

    this._buf[this._idx] = dt;
    this._idx = (this._idx + 1) % 300;
    if (this._count < 300) this._count++;
    this._framesSinceStart++;

    // Update live FPS from last 10 frames (cheap rolling avg)
    if (this._count >= 10) {
      let sum = 0;
      for (let i = 0; i < 10; i++) {
        sum += this._buf[(this._idx - 1 - i + 300) % 300];
      }
      this._liveFPS = 1000 / (sum / 10);
    }
  }

  // ── Snapshot current buffer → saves to _snapshots[] ─────────────────
  snapshot(labelOverride) {
    const n = this._count;
    if (n < 30) {
      console.warn("[Profiler] Not enough frames to snapshot (need ≥30).");
      return null;
    }

    // Sort a *copy* (avoid mutating the ring buffer)
    const sorted = new Float32Array(n);
    for (let i = 0; i < n; i++) sorted[i] = this._buf[i];
    sorted.sort(); // ascending ms

    const sum = sorted.reduce((s, v) => s + v, 0);
    const avgMs = sum / n;
    const p99idx = Math.min(n - 1, Math.floor(n * 0.99)); // 1% worst frames
    const p1low = 1000 / sorted[p99idx];
    const minFPS = 1000 / sorted[n - 1];
    const avgFPS = 1000 / avgMs;

    const snap = {
      scenario: labelOverride || this._scenario,
      avgFPS: +avgFPS.toFixed(1),
      p1low: +p1low.toFixed(1),
      minFPS: +minFPS.toFixed(1),
      frames: n,
    };
    this._snapshots.push(snap);
    console.log(
      `[Profiler] Snap → [${snap.scenario}] avg=${snap.avgFPS} | 1%low=${snap.p1low} | min=${snap.minFPS} | n=${snap.frames}`
    );
    return snap;
  }

  // ── Print all snapshots as a table ───────────────────────────────────
  report() {
    if (this._snapshots.length === 0) {
      console.log("[Profiler] No snapshots yet. Run: perf snap <label>");
      return;
    }
    console.group(
      "%c[RenderProfiler] Baseline Report",
      "color:#0ff;font-weight:bold"
    );
    console.table(this._snapshots);
    console.groupEnd();
    return this._snapshots;
  }

  // ── Read by HUD overlay (no alloc) ───────────────────────────────────
  getLiveStats() {
    return {
      fps: this._liveFPS,
      scenario: this._scenario,
      active: this._active,
      frames: this._framesSinceStart,
    };
  }

  // ── Stress test helper ───────────────────────────────────────────────
  stressParticles(count = 1500) {
    if (typeof spawnParticles !== "function") {
      console.warn(
        "[Profiler] spawnParticles() not found — must be called while game is running."
      );
      return;
    }
    const cx = typeof CANVAS !== "undefined" ? CANVAS.width / 2 : 400;
    const cy = typeof CANVAS !== "undefined" ? CANVAS.height / 2 : 300;
    const colors = ["#ff6600", "#ff2200", "#ffaa00", "#ffffff", "#00ccff"];
    for (let i = 0; i < count; i++) {
      spawnParticles(
        cx + (Math.random() - 0.5) * 600,
        cy + (Math.random() - 0.5) * 400,
        1,
        colors[i % colors.length]
      );
    }
    console.log(
      `[Profiler] Stress: emitted ${count} particles via spawnParticles() — capped at ${ParticleSystem.MAX_PARTICLES}.`
    );
    this.setScenario("stress_particles");
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────
window.renderProfiler = new RenderProfiler();
