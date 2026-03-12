'use strict';
/**
 * js/systems/WorkerBridge.js
 * 
 * Bridges communication between the main thread and background workers.
 * Offloads heavy mathematical calculations (like PlayerPatternAnalyzer's 
 * ring buffer logic) to a background thread to prevent GC pauses and frame drops.
 */

window.WorkerBridge = {
    _worker: null,
    _isReady: false,

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
            this._worker.postMessage({
                type: 'sample',
                dt: dt,
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
        }
    }
};