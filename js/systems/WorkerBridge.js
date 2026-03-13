'use strict';
/**
 * js/systems/WorkerBridge.js
 * ════════════════════════════════════════════════
 * Main-thread bridge: routes PlayerPattern analysis to analyzer-worker.js.
 * Falls back to window.playerAnalyzer (main thread) if Worker fails.
 *
 * Design notes:
 *   - Singleton: window.WorkerBridge. Loaded after game.js (see index.html).
 *   - Throttles postMessage to ~10Hz via _sampleAccum to match worker's
 *     internal sample rate and prevent message queue buildup at 60fps.
 *   - On worker message, writes _cachedPattern/_cachedDir/scores +
 *     _workerPredReady/_workerPredX/_workerPredY directly onto window.playerAnalyzer.
 *   - Worker errors trigger graceful fallback (_isReady = false).
 *
 * Integration:
 *   game.js  → WorkerBridge.sendSample(dt, player, boss)   (every frame, boss-only)
 *   game.js  → WorkerBridge.reset()                        (boss death / wave end)
 *   WorkerBridge.init() called once at game start.
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.13  window.WorkerBridge       singleton object
 *  L.14  _worker / _isReady        worker handle + health flag
 *  L.16  _sampleAccum              10Hz throttle accumulator
 *  L.22  .init()                   spawn Worker, wire onmessage/onerror
 *  L.56  .sendSample()             throttled postMessage or main-thread fallback
 *  L.80  .reset()                  reset worker state + proxy cache fields
 *
 * ⚠️  Worker requires HTTP/HTTPS — new Worker() fails on file:// protocol.
 * ⚠️  reset() in worker mode skips playerAnalyzer.reset() — main-thread ring
 *     buffer is unused when worker is active; calling reset() on it is a no-op
 *     but misleading. Do not add it.
 * ⚠️  sendSample sends real elapsed time (sampleAccum), not dt — worker timers
 *     must receive wall-time delta, not per-frame delta.
 * ════════════════════════════════════════════════
 */

window.WorkerBridge = {
    _worker: null,
    _isReady: false,
    // Throttle main→worker samples to avoid unbounded postMessage queue growth.
    // WorkerAnalyzer samples at 10Hz internally; sending at 60Hz only builds backlog and can freeze the game.
    _sampleAccum: 0,
    _sampleInterval: 0.1,

    init() {
        if (this._worker) return;

        try {
            // Using a new Worker directly from a separate file:
            // This requires the game to be served over HTTP/HTTPS, not file://
            this._worker = new Worker('js/workers/analyzer-worker.js');
            this._isReady = true;

            this._worker.onmessage = (e) => {
                // Apply computed values directly to the main thread's proxy singleton
                if (window.playerAnalyzer) {
                    const data = e.data;
                    window.playerAnalyzer._cachedPattern = data.pattern;
                    window.playerAnalyzer._cachedDir = data.dir;
                    window.playerAnalyzer._kiteScore = data.kiteScore;
                    window.playerAnalyzer._circleScore = data.circleScore;
                    window.playerAnalyzer._standScore = data.standScore;

                    if (data.predictX !== null && data.predictY !== null) {
                        window.playerAnalyzer._workerPredReady = true;
                        window.playerAnalyzer._workerPredX = data.predictX;
                        window.playerAnalyzer._workerPredY = data.predictY;
                    } else {
                        window.playerAnalyzer._workerPredReady = false;
                    }
                }
            };

            this._worker.onerror = (err) => {
                console.warn('[WorkerBridge] Analyzer Worker error, falling back to main thread.', err);
                this._isReady = false; // Graceful fallback
            };

            console.log('[WorkerBridge] Analyzer Worker initialized successfully.');
        } catch (err) {
            console.warn('[WorkerBridge] Failed to initialize Worker (CORS?). Falling back to main thread.', err);
            this._isReady = false;
        }
    },

    /**
     * Sends primitive position data to the worker (low serialization cost).
     */
    sendSample(dt, player, boss) {
        if (!player || !boss || boss.dead) return;

        if (this._isReady && this._worker) {
            // Throttle to ~10Hz to match worker sampling and prevent message queue buildup.
            // Coalesce: only the latest position matters for pattern detection.
            this._sampleAccum += dt;
            if (this._sampleAccum < this._sampleInterval) return;
            // Send the real elapsed time since last sample so the worker's internal timers stay correct.
            const sendDt = this._sampleAccum;
            // Keep remainder to maintain stable cadence even with variable dt.
            this._sampleAccum = this._sampleAccum % this._sampleInterval;
            this._worker.postMessage({
                type: 'sample',
                dt: sendDt,
                px: player.x,
                py: player.y,
                bx: boss.x,
                by: boss.y
            });
        } else if (window.playerAnalyzer) {
            // Fallback: Use the main thread calculation methods if worker failed
            window.playerAnalyzer.sample(dt, player, boss);
            window.playerAnalyzer.update(dt);
        }
    },

    reset() {
        if (this._isReady && this._worker) {
            // Worker mode: reset worker state + clear proxy cache only.
            // Main-thread ring buffer is unused in this mode — skip playerAnalyzer.reset().
            this._worker.postMessage({ type: 'reset' });
            this._sampleAccum = 0;
            if (window.playerAnalyzer) {
                window.playerAnalyzer._workerPredReady = false;
                window.playerAnalyzer._cachedPattern = 'mixed';
                window.playerAnalyzer._cachedDir = 'none';
                window.playerAnalyzer._kiteScore = 0;
                window.playerAnalyzer._circleScore = 0;
                window.playerAnalyzer._standScore = 0;
            }
        } else if (window.playerAnalyzer) {
            // Fallback mode: reset the main-thread analyzer fully.
            window.playerAnalyzer.reset();
            window.playerAnalyzer._workerPredReady = false;
            this._sampleAccum = 0;
        }
    }
};