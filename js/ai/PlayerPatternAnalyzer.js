'use strict';
/**
 * js/ai/PlayerPatternAnalyzer.js  —  Week 4
 *
 * Tracks player movement/position history via a Float32Array ring buffer.
 * Zero allocation per tick after init. Used by Boss AI to counter player habits.
 *
 * TRACKED PATTERNS:
 *   kiting       — player consistently moves away from boss (distance increasing)
 *   circling     — player moves perpendicular to boss (tangential velocity > radial)
 *   standing     — player barely moves between samples
 *   dominantDir  — "left" | "right" | "none" (relative to boss-player axis)
 *
 * LOAD ORDER:
 *   config.js → base.js → UtilityAI.js → EnemyActions.js → [THIS FILE] → SquadAI.js → enemy.js
 *
 * INTEGRATION:
 *   // game.js: after player update, before boss update
 *   if (typeof playerAnalyzer !== 'undefined') playerAnalyzer.sample(dt, window.player, window.boss);
 *
 *   // Boss _pickSkill():
 *   const pattern = playerAnalyzer.dominantPattern();   // 'kiting'|'circling'|'standing'|'mixed'
 *   const dir     = playerAnalyzer.dominantDirection(); // 'left'|'right'|'none'
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
}

// ── Singleton instance ────────────────────────────────────────────────────────
const playerAnalyzer = new PlayerPatternAnalyzer();

// ══════════════════════════════════════════════════════════════
// 🌐 EXPORTS
// ══════════════════════════════════════════════════════════════
window.PlayerPatternAnalyzer = PlayerPatternAnalyzer;
window.playerAnalyzer = playerAnalyzer;