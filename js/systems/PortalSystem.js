'use strict';

/**
 * js/systems/PortalSystem.js
 *
 * MTC wave portal controller.
 * Owns portal simulation state and placeholder geometric drawing only.
 */
(function () {
    const RADIUS = 54;
    const TRIGGER_RADIUS = 46;
    const CULL_MARGIN = 100;
    const TWO_PI = Math.PI * 2;
    const LABEL = 'ANOMALY GATE';

    let _active = false;
    let _pendingTransition = false;
    let _x = 0;
    let _y = 0;
    let _targetWave = 1;
    let _t = 0;

    function _isPlaying() {
        if (typeof GameState !== 'undefined') return GameState.phase === 'PLAYING';
        return typeof window !== 'undefined' && window.gameState === 'PLAYING';
    }

    function spawn(options) {
        if (!options || !Number.isFinite(options.x) || !Number.isFinite(options.y)) return;
        if (!Number.isFinite(options.targetWave)) return;

        _x = options.x;
        _y = options.y;
        _targetWave = options.targetWave;
        _t = 0;
        _active = true;
        _pendingTransition = false;
    }

    function update(dt, player) {
        if (!_active || !_isPlaying()) return;
        _t += dt;

        if (!player || player.dead) return;
        const dx = player.x - _x;
        const dy = player.y - _y;
        const r = (player.radius || 18) + TRIGGER_RADIUS;
        if (dx * dx + dy * dy <= r * r) {
            _active = false;
            _pendingTransition = true;
        }
    }

    function draw(ctx) {
        if (!_active || !_isPlaying() || !ctx) return;
        if (typeof CANVAS === 'undefined') return;

        const cam = (typeof camera !== 'undefined') ? camera : window.camera;
        const sx = cam ? _x - cam.x : _x;
        const sy = cam ? _y - cam.y : _y;
        if (sx < -CULL_MARGIN || sx > CANVAS.width + CULL_MARGIN ||
            sy < -CULL_MARGIN || sy > CANVAS.height + CULL_MARGIN) return;

        const pulse = 0.5 + Math.sin(_t * 7) * 0.5;
        const spin = _t * 1.6;
        const r = RADIUS + pulse * 5;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.lineWidth = 3;
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#22d3ee';

        ctx.strokeStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(0, 0, r, spin, spin + TWO_PI * 0.72);
        ctx.stroke();

        ctx.strokeStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, -spin * 1.25, -spin * 1.25 + TWO_PI * 0.58);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const a = spin + i * Math.PI / 2;
            const x1 = Math.cos(a) * (r + 8);
            const y1 = Math.sin(a) * (r + 8);
            const x2 = Math.cos(a) * (r + 22);
            const y2 = Math.sin(a) * (r + 22);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(34, 211, 238, 0.18)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.48, 0, TWO_PI);
        ctx.fill();

        ctx.font = '700 11px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e0f2fe';
        ctx.fillText(LABEL, 0, r + 26);
        ctx.restore();
    }

    function clear() {
        _active = false;
        _pendingTransition = false;
        _t = 0;
    }

    function isActive() {
        return _active;
    }

    function consumeTransition() {
        if (!_pendingTransition) return 0;
        _pendingTransition = false;
        return _targetWave;
    }

    window.PortalSystem = {
        spawn,
        update,
        draw,
        clear,
        isActive,
        consumeTransition,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
