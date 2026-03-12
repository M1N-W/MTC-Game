'use strict';
/**
 * js/ai/PlayerPatternAnalyzer.js
 * ════════════════════════════════════════════════════════════════
 * Ring-buffer player movement tracker — feeds Boss AI counter-play.
 * Zero allocation per tick after construction (Float32Array / Int8Array only).
 *
 * Detected patterns:
 *  kiting     — player consistently increases distance from boss
 *  circling   — player moves perpendicular (tangential velocity dominant)
 *  standing   — player barely moves between samples
 *  mixed      — no dominant pattern
 *  dominantDir — 'left' | 'right' | 'none' relative to boss-player axis
 *
 * Sampling: 10Hz internal throttle (ANALYZER_SAMPLES = 30 → ~3s history)
 * Cache:    results recomputed 4Hz (_recompute), safe to read every frame
 *
 * Load order:
 *   config.js → base.js → UtilityAI.js → EnemyActions.js → [THIS FILE] → SquadAI.js → enemy.js
 *
 * WorkerBridge integration (Phase 1.3):
 *   When WorkerBridge is active, WorkerAnalyzer runs off main thread.
 *   WorkerBridge.onmessage writes _workerPredReady / _workerPredX / _workerPredY
 *   onto the main-thread singleton so predictedPosition() returns worker result.
 *   Main-thread ring buffer is NOT updated in worker mode — sample() is skipped.
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────
 *  L.40  constructor()          ring buffer init, cache fields
 *  L.59  sample(dt, player, boss)   10Hz throttled position record
 *  L.80  update(dt)             4Hz cache refresh trigger
 *
 *  ── Accessors (read cache — safe every frame) ──────────────────
 *  L.89  dominantPattern()      → 'kiting'|'circling'|'standing'|'mixed'
 *  L.94  dominantDirection()    → 'left'|'right'|'none'
 *  L.100 kitingScore()          → 0–1
 *  L.101 circlingScore()        → 0–1
 *  L.102 standingScore()        → 0–1
 *  L.104 reset()                call on boss death / wave end
 *
 *  ── Internal ───────────────────────────────────────────────────
 *  L.112 _recompute()           walks ring buffer once, updates cache
 *  L.153 velocityEstimate()     → {vx, vy} world-units/sec, zero GC
 *  L.165 predictedPosition(t)   → {x, y} | null  (worker path or local)
 *  ⚠️  predictedPosition() returns worker result when _workerPredReady=true.
 *      Worker result is 1 frame stale — acceptable for aim prediction.
 *      Do NOT call this inside draw() — it reads state, not a pure function.
 *
 *  L.184 Singleton: window.playerAnalyzer
 *
 * ════════════════════════════════════════════════════════════════
 */

const ANALYZER_SAMPLES = 30; // ~3 seconds at 10Hz sample rate

class PlayerPatternAnalyzer {
    constructor() {
        // Ring buffers — pre-allocated, never reallocated
        // [x0,y0, x1,y1, ...] interleaved
        this._posX = new Float32Array(ANALYZER_SAMPLES);
        this._posY = new Float32Array(ANALYZER_SAMPLES);
        // Distance to boss at each sample
        this._dist = new Float32Array(ANALYZER_SAMPLES);
        // Cross product sign (perpendicular direction) at each sample
        // +1 = player moved left relative to boss-player axis, -1 = right
        this._side = new Int8Array(ANALYZER_SAMPLES);

        this._head = 0;        // ring buffer write index
        this._count = 0;        // samples filled (capped at ANALYZER_SAMPLES)
        this._sampleTimer = 0;
        this._sampleInterval = 0.1; // 10Hz — plenty for behavior detection

        // Cached results — recomputed on demand (lazy, 4Hz internal)
        this._cacheTimer = 0;
        this._cacheInterval = 0.25;
        this._cachedPattern = 'mixed';
        this._cachedDir = 'none';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // sample — call every frame from game loop (internally throttled to 10Hz)
    // ─────────────────────────────────────────────────────────────────────────

    sample(dt, player, boss) {
        if (!player || !boss || boss.dead) return;

        this._sampleTimer -= dt;
        if (this._sampleTimer > 0) return;
        this._sampleTimer = this._sampleInterval;

        const i = this._head;
        this._posX[i] = player.x;
        this._posY[i] = player.y;
        this._dist[i] = Math.hypot(player.x - boss.x, player.y - boss.y);

        // Perpendicular side: cross product of (boss→player) and (prev→curr player)
        const prev = (i + ANALYZER_SAMPLES - 1) % ANALYZER_SAMPLES;
        if (this._count > 0) {
            const bpx = player.x - boss.x;
            const bpy = player.y - boss.y;
            const mvx = player.x - this._posX[prev];
            const mvy = player.y - this._posY[prev];
            // cross product z-component: bpx*mvy - bpy*mvx
            this._side[i] = (bpx * mvy - bpy * mvx) >= 0 ? 1 : -1;
        } else {
            this._side[i] = 0;
        }

        this._head = (i + 1) % ANALYZER_SAMPLES;
        if (this._count < ANALYZER_SAMPLES) this._count++;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // update — call every frame (handles cache refresh timer)
    // ─────────────────────────────────────────────────────────────────────────

    update(dt) {
        this._cacheTimer -= dt;
        if (this._cacheTimer > 0) return;
        this._cacheTimer = this._cacheInterval;
        this._recompute();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACCESSORS — read from cache (safe to call every frame)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @returns {'kiting'|'circling'|'standing'|'mixed'}
     */
    dominantPattern() { return this._cachedPattern; }

    /**
     * Direction player tends to dodge relative to boss-player axis.
     * @returns {'left'|'right'|'none'}
     */
    dominantDirection() { return this._cachedDir; }

    /**
     * 0–1 score for how strongly the pattern applies.
     * Useful for blending: e.g. if kiteScore > 0.6 → boss gets aggressive
     */
    kitingScore() { return this._kiteScore ?? 0; }
    circlingScore() { return this._circleScore ?? 0; }
    standingScore() { return this._standScore ?? 0; }

    /** Reset all history (call on boss death / wave end) */
    reset() {
        this._posX.fill(0); this._posY.fill(0);
        this._dist.fill(0); this._side.fill(0);
        this._head = 0; this._count = 0;
        this._cachedPattern = 'mixed';
        this._cachedDir = 'none';
        this._kiteScore = 0; this._circleScore = 0; this._standScore = 0;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // _recompute — called 4Hz, walks ring buffer once
    // ─────────────────────────────────────────────────────────────────────────

    _recompute() {
        const n = this._count;
        if (n < 4) return; // not enough data

        let distInc = 0, distDec = 0;  // kiting vs approaching
        let sidePlus = 0, sideMinus = 0; // circling direction
        let standCount = 0;             // barely moving

        // Walk from oldest to newest sample
        const start = (this._head - n + ANALYZER_SAMPLES) % ANALYZER_SAMPLES;
        let prevDist = this._dist[start];

        for (let j = 1; j < n; j++) {
            const idx = (start + j) % ANALYZER_SAMPLES;
            const d = this._dist[idx];
            const dd = d - prevDist;

            if (dd > 5) distInc++;   // moving away
            else if (dd < -5) distDec++;   // moving toward
            else standCount++; // roughly stationary distance

            if (this._side[idx] > 0) sidePlus++;
            else if (this._side[idx] < 0) sideMinus++;

            prevDist = d;
        }

        const total = n - 1;
        this._kiteScore = distInc / total;
        this._circleScore = Math.min(sidePlus, sideMinus) * 2 / total; // both sides = real orbit
        this._standScore = standCount / total;

        // Dominant pattern
        if (this._kiteScore > 0.55) this._cachedPattern = 'kiting';
        else if (this._circleScore > 0.45) this._cachedPattern = 'circling';
        else if (this._standScore > 0.60) this._cachedPattern = 'standing';
        else this._cachedPattern = 'mixed';

        // Dominant direction
        const bias = sidePlus - sideMinus;
        if (bias > total * 0.25) this._cachedDir = 'left';
        else if (bias < -total * 0.25) this._cachedDir = 'right';
        else this._cachedDir = 'none';
    }

    /**
     * Estimated player velocity (world-units/sec) from the 2 newest samples.
     * Zero GC — reads pre-allocated Float32Arrays only.
     * @returns {{ vx: number, vy: number }}
     */
    velocityEstimate() {
        if (this._count < 2) return { vx: 0, vy: 0 };
        const inv = 1 / this._sampleInterval;
        const cur = (this._head - 1 + ANALYZER_SAMPLES) % ANALYZER_SAMPLES;
        const prev = (this._head - 2 + ANALYZER_SAMPLES) % ANALYZER_SAMPLES;
        return {
            vx: (this._posX[cur] - this._posX[prev]) * inv,
            vy: (this._posY[cur] - this._posY[prev]) * inv
        };
    }

    /**
     * Predicted player world position `aheadSeconds` into the future.
     * When WorkerBridge is active, returns the worker's pre-computed result
     * (zero allocation, 1-frame stale at most — acceptable for aim prediction).
     * Falls back to local ring-buffer calculation when worker is unavailable.
     * @param {number} [aheadSeconds=0.25]
     * @returns {{ x: number, y: number } | null}
     */
    predictedPosition(aheadSeconds = 0.25) {
        // Worker path — use pre-computed prediction (avoids ring-buffer walk)
        if (this._workerPredReady) {
            return { x: this._workerPredX, y: this._workerPredY };
        }
        // Fallback: local calculation
        if (this._count < 2) return null;
        const t = Math.min(aheadSeconds, 0.5);
        const vel = this.velocityEstimate();
        const cur = (this._head - 1 + ANALYZER_SAMPLES) % ANALYZER_SAMPLES;
        return {
            x: this._posX[cur] + vel.vx * t,
            y: this._posY[cur] + vel.vy * t
        };
    }
}

// ── Singleton instance ────────────────────────────────────────────────────────
const playerAnalyzer = new PlayerPatternAnalyzer();

// ══════════════════════════════════════════════════════════════
// 🌐 EXPORTS
// ══════════════════════════════════════════════════════════════
window.PlayerPatternAnalyzer = PlayerPatternAnalyzer;
window.playerAnalyzer = playerAnalyzer;