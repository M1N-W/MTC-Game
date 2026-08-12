'use strict';

/**
 * js/systems/CrosshairSystem.js
 *
 * MTC character crosshair renderer.
 * Owns gameplay-canvas cursor visibility and character crosshair drawing only.
 * Aiming stays in input.js/utils.js/PlayerBase.js via mouse.wx/mouse.wy.
 */
(function () {
    const STYLES = Object.freeze({
        'kao-sight': Object.freeze({
            profile: 'kao',
            radius: 17,
            kind: 'kao',
        }),
        'wanchai-sight': Object.freeze({
            profile: 'auto',
            radius: 14,
            kind: 'sight',
        }),
        'sticky-rice-seal': Object.freeze({
            profile: 'poom',
            radius: 17,
            kind: 'seal',
        }),
        'katana-focus': Object.freeze({
            profile: 'pat',
            radius: 16,
            kind: 'focus',
        }),
    });

    let _key = 'kao-sight';
    let _x = 0;
    let _y = 0;
    let _t = 0;
    let _cursorHidden = false;
    let _pointerInCanvas = false;
    let _listenersBound = false;
    let _shotKick = 0;
    let _wasFiring = false;

    function _isPlaying() {
        if (typeof GameState !== 'undefined') return GameState.phase === 'PLAYING';
        return typeof window !== 'undefined' && window.gameState === 'PLAYING';
    }

    function _setCursorHidden(hidden) {
        if (typeof CANVAS === 'undefined' || !CANVAS || !CANVAS.classList) return;
        if (_cursorHidden === hidden && CANVAS.classList.contains('gameplay-cursor-hidden') === hidden) return;
        _cursorHidden = hidden;
        CANVAS.classList.toggle('gameplay-cursor-hidden', hidden);
        // Inline fallback is scoped to the canvas, never to application controls.
        CANVAS.style.cursor = hidden ? 'none' : '';
    }

    function _bindCanvasPointer() {
        if (_listenersBound || typeof CANVAS === 'undefined' || !CANVAS) return;
        _listenersBound = true;
        CANVAS.addEventListener('pointerenter', function () { _pointerInCanvas = true; });
        CANVAS.addEventListener('pointerleave', function () {
            _pointerInCanvas = false;
            _setCursorHidden(false);
        });
        CANVAS.addEventListener('blur', function () {
            _pointerInCanvas = false;
            _setCursorHidden(false);
        });
    }

    function init() {
        _x = 0;
        _y = 0;
        _t = 0;
        _cursorHidden = false;
        _pointerInCanvas = false;
        _shotKick = 0;
        _wasFiring = false;
        _bindCanvasPointer();
        _setCursorHidden(false);
    }

    function setCrosshair(key) {
        _key = STYLES[key] ? key : 'kao-sight';
    }

    function update(dt) {
        _t += dt;
        _bindCanvasPointer();
        _setCursorHidden(_isPlaying() && _pointerInCanvas);

        if (typeof mouse === 'undefined') return;
        _x = mouse.x || 0;
        _y = mouse.y || 0;
        if (mouse.left && !_wasFiring) _shotKick = 1;
        _wasFiring = !!mouse.left;
        _shotKick = Math.max(0, _shotKick - dt / 0.14);
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

    function _drawKao(ctx, r) {
        const gap = 8;
        const arm = r * 0.46;
        ctx.beginPath();
        ctx.moveTo(-r, -gap); ctx.lineTo(-r, -r); ctx.lineTo(-gap, -r);
        ctx.moveTo(gap, -r); ctx.lineTo(r, -r); ctx.lineTo(r, -gap);
        ctx.moveTo(r, gap); ctx.lineTo(r, r); ctx.lineTo(gap, r);
        ctx.moveTo(-gap, r); ctx.lineTo(-r, r); ctx.lineTo(-r, gap);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        let angle = 0;
        if (typeof window !== 'undefined' && window.player && typeof worldToScreen === 'function') {
            const playerScreen = worldToScreen(window.player.x, window.player.y);
            angle = Math.atan2(_y - playerScreen.y, _x - playerScreen.x);
        }
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(r + 3, 0);
        ctx.lineTo(r + 3 + arm * 0.42, 0);
        ctx.stroke();
        ctx.restore();
    }

    function _getPalette(style) {
        const profiles = typeof window !== 'undefined' ? window.MTC_CROSSHAIRS : null;
        const profile = profiles && style.profile ? profiles[style.profile] : null;
        return {
            color: profile?.color || '#22d3ee',
            accent: profile?.accent || '#e0f2fe'
        };
    }

    function draw(ctx) {
        if (!_isPlaying() || !ctx) return;

        const style = STYLES[_key] || STYLES['kao-sight'];
        const reducedMotion = typeof prefersReducedMotion === 'function' && prefersReducedMotion();
        const pulse = reducedMotion ? 0 : Math.sin(_t * Math.PI * 2 / 1.8);
        const r = style.radius + pulse + _shotKick * 4;
        const palette = _getPalette(style);

        ctx.save();
        ctx.translate(_x, _y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = palette.color;
        ctx.fillStyle = palette.accent;
        ctx.shadowBlur = 8;
        ctx.shadowColor = palette.color;
        ctx.globalAlpha = 0.7 + (reducedMotion ? 0 : (Math.sin(_t * Math.PI * 2 / 1.8) + 1) * 0.15);

        if (style.kind === 'kao') _drawKao(ctx, r);
        else if (style.kind === 'ring') _drawRing(ctx, r);
        else if (style.kind === 'sight') _drawSight(ctx, r);
        else if (style.kind === 'seal') _drawSeal(ctx, r);
        else _drawFocus(ctx, r);

        ctx.restore();
    }

    function clear() {
        _setCursorHidden(false);
        _key = 'kao-sight';
        _t = 0;
        _pointerInCanvas = false;
        _shotKick = 0;
        _wasFiring = false;
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
