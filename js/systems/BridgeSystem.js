'use strict';

/**
 * js/systems/BridgeSystem.js
 *
 * Hardlight Bridge collision overlay. Does not mutate map objects or grids.
 */
(function () {
    const MAX_BRIDGES = 6;
    const TTL = 5.0;
    const BRIDGE_W = 140;
    const BRIDGE_H = 52;
    const CULL = 90;
    const TWO_PI = Math.PI * 2;
    const TARGET_TYPES = Object.freeze({
        wall: true,
        desk: true,
        bookshelf: true,
        server: true,
        datapillar: true,
        tree: true,
        vendingmachine: true,
        chair: true,
        cabinet: true,
        blackboard: true,
    });

    const _bridges = [];
    for (let i = 0; i < MAX_BRIDGES; i++) {
        _bridges.push({
            active: false,
            ttl: 0,
            x: 0,
            y: 0,
            w: BRIDGE_W,
            h: BRIDGE_H,
            angle: 0,
            obj: null,
            pulse: 0,
        });
    }

    function _rectContainsCircle(bridge, x, y, radius) {
        const dx = x - bridge.x;
        const dy = y - bridge.y;
        const c = Math.cos(-bridge.angle);
        const s = Math.sin(-bridge.angle);
        const lx = dx * c - dy * s;
        const ly = dx * s + dy * c;
        return Math.abs(lx) <= bridge.w * 0.5 + radius &&
            Math.abs(ly) <= bridge.h * 0.5 + radius;
    }

    function _claimBridge() {
        for (let i = 0; i < _bridges.length; i++) {
            if (!_bridges[i].active) return _bridges[i];
        }
        return _bridges[0];
    }

    function _releaseBridge(bridge) {
        if (!bridge || !bridge.active) return;
        const player = typeof window !== 'undefined' ? window.player : null;
        if (player && !player.dead && bridge.obj &&
            _rectContainsCircle(bridge, player.x, player.y, player.radius || 18) &&
            typeof mapSystem !== 'undefined' && typeof mapSystem.findSafeSpawn === 'function') {
            const safe = mapSystem.findSafeSpawn(player.x, player.y, player.radius || 18);
            player.x = safe.x;
            player.y = safe.y;
            player.vx = 0;
            player.vy = 0;
        }
        bridge.active = false;
        bridge.ttl = 0;
        bridge.obj = null;
        bridge.pulse = 0;
    }

    function tryCreateBridge(projectile, hitInfo) {
        if (!projectile || !projectile.canCreateBridge || !hitInfo || !hitInfo.obj) return false;
        const obj = hitInfo.obj;
        if (!isBridgeTargetObject(obj)) return false;

        const bridge = _claimBridge();
        _releaseBridge(bridge);
        bridge.active = true;
        bridge.ttl = TTL;
        bridge.x = Number.isFinite(hitInfo.x) ? hitInfo.x : projectile.x;
        bridge.y = Number.isFinite(hitInfo.y) ? hitInfo.y : projectile.y;
        bridge.angle = Number.isFinite(projectile.angle) ? projectile.angle : Math.atan2(projectile.vy || 0, projectile.vx || 1);
        bridge.obj = obj;
        bridge.pulse = 0;

        if (typeof TerminalLog !== 'undefined') {
            TerminalLog.push({ sender: 'SYSTEM', text: 'HARDLIGHT BRIDGE DEPLOYED', type: 'info' });
        }
        return true;
    }

    function shouldSuppressCollision(entity, obj) {
        if (!entity || entity !== window.player || !isBridgeTargetObject(obj)) return false;
        const radius = entity.radius || 18;
        for (let i = 0; i < _bridges.length; i++) {
            const bridge = _bridges[i];
            if (!bridge.active || bridge.obj !== obj) continue;
            if (_rectContainsCircle(bridge, entity.x, entity.y, radius)) return true;
        }
        return false;
    }

    function isBridgeTargetObject(obj) {
        return !!(obj && obj.solid && TARGET_TYPES[obj.type] === true);
    }

    function update(dt) {
        for (let i = 0; i < _bridges.length; i++) {
            const bridge = _bridges[i];
            if (!bridge.active) continue;
            bridge.ttl -= dt;
            bridge.pulse += dt;
            if (bridge.ttl <= 0) _releaseBridge(bridge);
        }
    }

    function draw(ctx) {
        if (!ctx || typeof CANVAS === 'undefined') return;
        const zoom = (typeof camera !== 'undefined' && camera.zoom) ? camera.zoom : 1;
        for (let i = 0; i < _bridges.length; i++) {
            const bridge = _bridges[i];
            if (!bridge.active) continue;

            const screen = typeof worldToScreen === 'function'
                ? worldToScreen(bridge.x, bridge.y) : { x: bridge.x, y: bridge.y };
            const sx = screen.x;
            const sy = screen.y;
            if (sx < -CULL || sx > CANVAS.width + CULL || sy < -CULL || sy > CANVAS.height + CULL) continue;

            const lifeAlpha = Math.max(0.18, bridge.ttl / TTL);
            const pulse = 0.5 + Math.sin(bridge.pulse * 10) * 0.5;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.scale(zoom, zoom);
            ctx.rotate(bridge.angle);
            ctx.globalAlpha = lifeAlpha;
            ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
            ctx.fillRect(-bridge.w * 0.5, -bridge.h * 0.5, bridge.w, bridge.h);
            ctx.strokeStyle = '#67e8f9';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10 + pulse * 8;
            ctx.shadowColor = '#22d3ee';
            ctx.strokeRect(-bridge.w * 0.5, -bridge.h * 0.5, bridge.w, bridge.h);
            ctx.strokeStyle = '#facc15';
            ctx.globalAlpha = lifeAlpha * 0.8;
            ctx.beginPath();
            ctx.arc(-bridge.w * 0.32, 0, 4 + pulse * 2, 0, TWO_PI);
            ctx.arc(bridge.w * 0.32, 0, 4 + pulse * 2, 0, TWO_PI);
            ctx.stroke();
            ctx.restore();
        }
    }

    function clearAll() {
        for (let i = 0; i < _bridges.length; i++) {
            _releaseBridge(_bridges[i]);
        }
    }

    function getActiveCount() {
        let count = 0;
        for (let i = 0; i < _bridges.length; i++) if (_bridges[i].active) count++;
        return count;
    }

    window.BridgeSystem = {
        tryCreateBridge,
        update,
        draw,
        clearAll,
        shouldSuppressCollision,
        isBridgeTargetObject,
        getActiveCount,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
