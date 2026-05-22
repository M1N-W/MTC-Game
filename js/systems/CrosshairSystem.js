'use strict';

/**
 * js/systems/CrosshairSystem.js
 *
 * MTC character crosshair renderer.
 * Owns browser cursor visibility and placeholder crosshair drawing only.
 * Aiming stays in input.js/utils.js/PlayerBase.js via mouse.wx/mouse.wy.
 */
(function () {
    const STYLES = Object.freeze({
        'kao-sight': Object.freeze({
            color: '#a855f7',
            accent: '#f0abfc',
            radius: 15,
            kind: 'ring',
        }),
        'wanchai-sight': Object.freeze({
            color: '#ef4444',
            accent: '#facc15',
            radius: 14,
            kind: 'sight',
        }),
        'sticky-rice-seal': Object.freeze({
            color: '#22c55e',
            accent: '#bbf7d0',
            radius: 17,
            kind: 'seal',
        }),
        'katana-focus': Object.freeze({
            color: '#7ec8e3',
            accent: '#e0f2fe',
            radius: 16,
            kind: 'focus',
        }),
    });

    let _key = 'kao-sight';
    let _x = 0;
    let _y = 0;
    let _t = 0;
    let _cursorHidden = false;

    function _isPlaying() {
        if (typeof GameState !== 'undefined') return GameState.phase === 'PLAYING';
        return typeof window !== 'undefined' && window.gameState === 'PLAYING';
    }

    function _setCursorHidden(hidden) {
        if (_cursorHidden === hidden) return;
        _cursorHidden = hidden;
        if (typeof document === 'undefined' || !document.body) return;
        document.body.style.cursor = hidden ? 'none' : '';
    }

    function init() {
        _x = 0;
        _y = 0;
        _t = 0;
        _cursorHidden = false;
        _setCursorHidden(false);
    }

    function setCrosshair(key) {
        _key = STYLES[key] ? key : 'kao-sight';
    }

    function update(dt) {
        _t += dt;
        _setCursorHidden(_isPlaying());

        if (typeof mouse === 'undefined') return;
        _x = mouse.x || 0;
        _y = mouse.y || 0;
    }

    function _drawRing(ctx, r) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    function _drawSight(ctx, r) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r - 7, 0);
        ctx.lineTo(-5, 0);
        ctx.moveTo(r + 7, 0);
        ctx.lineTo(5, 0);
        ctx.moveTo(0, -r - 7);
        ctx.lineTo(0, -5);
        ctx.moveTo(0, r + 7);
        ctx.lineTo(0, 5);
        ctx.stroke();
    }

    function _drawSeal(ctx, r) {
        ctx.rotate(_t * 1.8);
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    function _drawFocus(ctx, r) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.rect(-r * 0.55, -r * 0.55, r * 1.1, r * 1.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.stroke();
    }

    function draw(ctx) {
        if (!_isPlaying() || !ctx) return;

        const style = STYLES[_key] || STYLES['kao-sight'];
        const pulse = 0.5 + Math.sin(_t * 8) * 0.5;
        const r = style.radius + pulse * 2;

        ctx.save();
        ctx.translate(_x, _y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = style.color;
        ctx.fillStyle = style.accent;
        ctx.shadowBlur = 8;
        ctx.shadowColor = style.color;

        if (style.kind === 'ring') _drawRing(ctx, r);
        else if (style.kind === 'sight') _drawSight(ctx, r);
        else if (style.kind === 'seal') _drawSeal(ctx, r);
        else _drawFocus(ctx, r);

        ctx.restore();
    }

    function clear() {
        _setCursorHidden(false);
        _key = 'kao-sight';
        _t = 0;
    }

    window.CrosshairSystem = {
        init,
        update,
        draw,
        setCrosshair,
        clear,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
