'use strict';

/**
 * js/systems/AlertSystem.js
 *
 * MTC system-status overlays for temporary entity feedback.
 * Logic lives in update(); draw() is read-only.
 */
(function () {
    const MAX_ALERTS = 12;
    const DEFAULT_DURATION = 1.4;
    const TWO_PI = Math.PI * 2;

    const DEFS = Object.freeze({
        overclock: Object.freeze({
            label: '[OVERCLOCK]',
            color: '#ef4444',
            duration: 1.8,
            speedMult: 1.18,
        }),
        warning: Object.freeze({
            label: '[WARNING]',
            color: '#facc15',
            duration: 1.2,
            speedMult: 1,
        }),
    });

    const _slots = [];
    const _active = [];
    for (let i = 0; i < MAX_ALERTS; i++) {
        _slots.push({
            active: false,
            entity: null,
            key: '',
            label: '',
            color: '#22d3ee',
            ttl: 0,
            duration: DEFAULT_DURATION,
            speedApplied: false,
            baseSpeed: 0,
            pulse: 0,
        });
    }

    function _release(slot) {
        if (!slot || !slot.active) return;
        if (slot.speedApplied && slot.entity && Number.isFinite(slot.baseSpeed)) {
            slot.entity.speed = slot.baseSpeed;
        }
        slot.active = false;
        slot.entity = null;
        slot.key = '';
        slot.label = '';
        slot.ttl = 0;
        slot.speedApplied = false;
        slot.baseSpeed = 0;
        slot.pulse = 0;
    }

    function _findActive(entity, key) {
        for (let i = 0; i < _active.length; i++) {
            const slot = _active[i];
            if (slot.entity === entity && slot.key === key) return slot;
        }
        return null;
    }

    function _claimSlot() {
        for (let i = 0; i < _slots.length; i++) {
            if (!_slots[i].active) return _slots[i];
        }
        const recycled = _active[0];
        _release(recycled);
        _active[0] = _active[_active.length - 1];
        _active.pop();
        return recycled;
    }

    function emit(entity, key, options) {
        if (!entity || !key) return false;
        const def = DEFS[key];
        if (!def) return false;

        let slot = _findActive(entity, key);
        if (!slot) {
            slot = _claimSlot();
            slot.active = true;
            slot.entity = entity;
            slot.key = key;
            slot.label = def.label;
            slot.color = def.color;
            slot.speedApplied = false;
            slot.baseSpeed = 0;
            _active.push(slot);
        }

        slot.duration = Number.isFinite(options?.duration) ? options.duration : def.duration;
        slot.ttl = slot.duration;
        slot.pulse = 0;
        if (options?.text) slot.label = String(options.text).slice(0, 24);

        if (key === 'overclock' && !slot.speedApplied && Number.isFinite(entity.speed)) {
            slot.baseSpeed = entity.speed;
            entity.speed = slot.baseSpeed * def.speedMult;
            slot.speedApplied = true;
        }
        return true;
    }

    function update(dt) {
        for (let i = _active.length - 1; i >= 0; i--) {
            const slot = _active[i];
            const entity = slot.entity;
            slot.ttl -= dt;
            slot.pulse += dt;
            if (slot.ttl <= 0 || !entity || entity.dead) {
                _release(slot);
                _active[i] = _active[_active.length - 1];
                _active.pop();
            }
        }
    }

    function draw(ctx) {
        if (!ctx || typeof CANVAS === 'undefined') return;
        const cam = (typeof camera !== 'undefined') ? camera : window.camera;

        for (let i = 0; i < _active.length; i++) {
            const slot = _active[i];
            const entity = slot.entity;
            if (!entity || entity.dead) continue;

            const radius = entity.radius || 18;
            const sx = cam ? entity.x - cam.x : entity.x;
            const sy = cam ? entity.y - cam.y : entity.y;
            if (sx < -80 || sx > CANVAS.width + 80 || sy < -100 || sy > CANVAS.height + 60) continue;

            const life = slot.duration > 0 ? slot.ttl / slot.duration : 0;
            const bob = Math.sin(slot.pulse * 10) * 3;

            ctx.save();
            ctx.translate(sx, sy - radius - 28 + bob);
            ctx.globalAlpha = Math.max(0.25, Math.min(1, life + 0.2));
            ctx.font = '700 11px Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = slot.color;
            ctx.fillStyle = slot.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = slot.color;
            ctx.beginPath();
            ctx.arc(-42, -3, 5, 0, TWO_PI);
            ctx.stroke();
            ctx.fillText(slot.label, 8, 0);
            ctx.restore();
        }
    }

    function clear() {
        for (let i = _active.length - 1; i >= 0; i--) _release(_active[i]);
        _active.length = 0;
    }

    window.AlertSystem = {
        emit,
        update,
        draw,
        clear,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
