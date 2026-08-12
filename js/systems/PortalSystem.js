'use strict';

/**
 * js/systems/PortalSystem.js
 *
 * MTC wave portal controller.
 * Owns the one-gate wave transition lifecycle and its canvas-only renderer.
 */
(function () {
    const RADIUS = 46;
    const TRIGGER_RADIUS = 46;
    const CULL_MARGIN = 100;
    const TWO_PI = Math.PI * 2;
    const STATE_IDLE = 'idle';
    const STATE_ACTIVE_GATE = 'activeGate';
    const STATE_REWARD_PENDING = 'rewardPending';
    const STATE_ADVANCING = 'advancing';
    const HEX_COS = [0, 0.8660254, 0.8660254, 0, -0.8660254, -0.8660254];
    const HEX_SIN = [-1, -0.5, 0.5, 1, 0.5, -0.5];

    let _state = STATE_IDLE;
    let _x = 0;
    let _y = 0;
    let _targetWave = 1;
    let _label = 'WAVE 1 // ENTER';
    let _t = 0;
    let _nearGate = false;
    let _approachFlash = 0;

    function _isPlaying() {
        if (typeof GameState !== 'undefined') return GameState.phase === 'PLAYING';
        return typeof window !== 'undefined' && window.gameState === 'PLAYING';
    }

    function spawn(options) {
        if (!options || !Number.isFinite(options.x) || !Number.isFinite(options.y)) return;
        if (!Number.isFinite(options.targetWave)) return;
        if (_state !== STATE_IDLE) return false;

        _x = options.x;
        _y = options.y;
        _targetWave = options.targetWave;
        _label = `WAVE ${_targetWave} // ENTER`;
        _t = 0;
        _state = STATE_ACTIVE_GATE;
        _nearGate = false;
        _approachFlash = 0;
        return true;
    }

    function update(dt, player) {
        if (_state !== STATE_ACTIVE_GATE || !_isPlaying()) return;
        _t += dt;
        if (_approachFlash > 0) _approachFlash = Math.max(0, _approachFlash - dt);

        if (!player || player.dead) return;
        const dx = player.x - _x;
        const dy = player.y - _y;
        const r = (player.radius || 18) + TRIGGER_RADIUS;
        const isNear = dx * dx + dy * dy <= (r + 72) * (r + 72);
        if (isNear && !_nearGate) _approachFlash = 0.16;
        _nearGate = isNear;
        if (dx * dx + dy * dy <= r * r) {
            _state = STATE_REWARD_PENDING;
        }
    }

    function _worldRadiusToScreen(sx) {
        if (typeof worldToScreen !== 'function') return RADIUS;
        const edge = worldToScreen(_x + RADIUS, _y);
        return Math.max(1, Math.abs(edge.x - sx));
    }

    function _drawBrokenHex(ctx, radius) {
        for (let i = 0; i < 6; i++) {
            // The open top/bottom facets turn a familiar portal ring into containment machinery.
            if (i === 0 || i === 3) continue;
            const next = (i + 1) % 6;
            ctx.beginPath();
            ctx.moveTo(HEX_COS[i] * radius, HEX_SIN[i] * radius);
            ctx.lineTo(HEX_COS[next] * radius, HEX_SIN[next] * radius);
            ctx.stroke();
        }
    }

    function draw(ctx) {
        if (_state !== STATE_ACTIVE_GATE || !_isPlaying() || !ctx) return;
        if (typeof CANVAS === 'undefined') return;

        const screen = typeof worldToScreen === 'function'
            ? worldToScreen(_x, _y)
            : { x: _x, y: _y };
        const sx = screen.x;
        const sy = screen.y;
        if (sx < -CULL_MARGIN || sx > CANVAS.width + CULL_MARGIN ||
            sy < -CULL_MARGIN || sy > CANVAS.height + CULL_MARGIN) return;

        const r = _worldRadiusToScreen(sx);
        const warmUp = Math.min(1, _t / 0.42);
        const easedWarmUp = 1 - Math.pow(1 - warmUp, 3);
        const ribbonPhase = 0.5 + Math.sin(_t * TWO_PI / 2.4) * 0.5;
        const corePulse = 0.5 + Math.sin(_t * TWO_PI / 1.2) * 0.5;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.globalAlpha = easedWarmUp;
        ctx.lineWidth = Math.max(1.5, r * 0.055);
        ctx.shadowBlur = r * 0.38;
        ctx.shadowColor = 'rgba(34, 211, 238, 0.45)';
        ctx.strokeStyle = '#22d3ee';
        _drawBrokenHex(ctx, r);

        // Static amber pylons establish an approach direction without adding obstacles.
        ctx.shadowBlur = r * 0.22;
        ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
        ctx.fillStyle = '#080c12';
        ctx.strokeStyle = '#f59e0b';
        for (let side = -1; side <= 1; side += 2) {
            const px = side * r * 0.77;
            ctx.fillRect(px - r * 0.10, -r * 0.58, r * 0.20, r * 1.16);
            ctx.strokeRect(px - r * 0.10, -r * 0.58, r * 0.20, r * 1.16);
            ctx.fillStyle = '#f97316';
            ctx.fillRect(px - r * 0.05, -r * 0.34, r * 0.10, r * 0.14);
            ctx.fillStyle = '#080c12';
        }

        // Fixed-path ribbon flow gives the gate life without a rotating full-circle motif.
        ctx.shadowBlur = r * 0.26;
        ctx.shadowColor = 'rgba(34, 211, 238, 0.4)';
        ctx.globalAlpha = easedWarmUp * (0.38 + ribbonPhase * 0.27);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = Math.max(1, r * 0.038);
        for (let side = -1; side <= 1; side += 2) {
            ctx.beginPath();
            ctx.moveTo(side * r * 0.63, -r * 0.30);
            ctx.quadraticCurveTo(side * r * 0.18, -r * (0.16 + ribbonPhase * 0.16), 0, 0);
            ctx.quadraticCurveTo(side * r * 0.18, r * (0.16 + ribbonPhase * 0.16), side * r * 0.63, r * 0.30);
            ctx.stroke();
        }

        ctx.shadowBlur = r * (0.22 + corePulse * 0.18);
        ctx.shadowColor = 'rgba(168, 85, 247, 0.45)';
        ctx.globalAlpha = easedWarmUp;
        ctx.fillStyle = '#080c12';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.37, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = easedWarmUp * (0.55 + corePulse * 0.25);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = Math.max(1, r * 0.045);
        ctx.stroke();

        if (_approachFlash > 0) {
            ctx.globalAlpha = Math.min(1, _approachFlash / 0.16) * 0.45;
            ctx.fillStyle = '#e0f2fe';
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.19, 0, TWO_PI);
            ctx.fill();
            ctx.globalAlpha = easedWarmUp;
        }

        ctx.globalAlpha = easedWarmUp;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(8, 12, 18, 0.92)';
        ctx.fillRect(-r * 0.92, r * 1.10, r * 1.84, Math.max(14, r * 0.39));
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-r * 0.92, r * 1.10, r * 1.84, Math.max(14, r * 0.39));
        ctx.font = `700 ${Math.max(9, Math.round(r * 0.22))}px Orbitron, monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e0f2fe';
        ctx.fillText(_label, 0, r * 1.36);
        ctx.restore();
    }

    function clear() {
        _state = STATE_IDLE;
        _t = 0;
        _nearGate = false;
        _approachFlash = 0;
    }

    function isActive() {
        return _state === STATE_ACTIVE_GATE;
    }

    function isIdle() {
        return _state === STATE_IDLE;
    }

    function consumeTransition() {
        if (_state !== STATE_REWARD_PENDING) return 0;
        _state = STATE_ADVANCING;
        return _targetWave;
    }

    function completeTransition() {
        if (_state !== STATE_ADVANCING) return false;
        clear();
        return true;
    }

    function getSnapshot() {
        return { state: _state, targetWave: _targetWave, active: isActive() };
    }

    window.PortalSystem = {
        spawn,
        update,
        draw,
        clear,
        isActive,
        isIdle,
        consumeTransition,
        completeTransition,
        getSnapshot,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
