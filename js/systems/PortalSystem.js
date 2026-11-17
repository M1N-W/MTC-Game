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
    const CULL_MARGIN = 120;
    const TWO_PI = Math.PI * 2;
    const STATE_IDLE = 'idle';
    const STATE_ACTIVE_GATE = 'activeGate';
    const STATE_REWARD_PENDING = 'rewardPending';
    const STATE_ADVANCING = 'advancing';
    const HEX_COS = [0, 0.8660254, 0.8660254, 0, -0.8660254, -0.8660254];
    const HEX_SIN = [-1, -0.5, 0.5, 1, 0.5, -0.5];
    const HEX_SCALE = 1.04;

    const NORMAL_PALETTE = Object.freeze({
        primary: '#22d3ee',
        primarySoft: 'rgba(34, 211, 238, 0.22)',
        primaryGlow: 'rgba(34, 211, 238, 0.52)',
        pylon: '#f59e0b',
        pylonGlow: 'rgba(245, 158, 11, 0.45)',
        pylonCell: '#fbbf24',
        coreRim: '#a855f7',
        coreMid: 'rgba(139, 92, 246, 0.50)',
        coreInner: 'rgba(46, 16, 101, 0.94)',
        hexBase: 'rgba(6, 12, 26, 0.62)',
        hexInner: 'rgba(168, 85, 247, 0.38)',
        hexMid: 'rgba(34, 211, 238, 0.28)',
        hexOuter: 'rgba(34, 211, 238, 0.14)',
        shard: '#67e8f9',
        text: '#e0f2fe',
    });

    const BOSS_PALETTE = Object.freeze({
        primary: '#facc15',
        primarySoft: 'rgba(250, 204, 21, 0.24)',
        primaryGlow: 'rgba(250, 204, 21, 0.56)',
        pylon: '#ef4444',
        pylonGlow: 'rgba(239, 68, 68, 0.50)',
        pylonCell: '#facc15',
        coreRim: '#ef4444',
        coreMid: 'rgba(220, 38, 38, 0.52)',
        coreInner: 'rgba(69, 10, 10, 0.94)',
        hexBase: 'rgba(24, 6, 10, 0.66)',
        hexInner: 'rgba(239, 68, 68, 0.42)',
        hexMid: 'rgba(245, 158, 11, 0.30)',
        hexOuter: 'rgba(250, 204, 21, 0.16)',
        shard: '#fde047',
        text: '#fef08a',
    });

    let _state = STATE_IDLE;
    let _x = 0;
    let _y = 0;
    let _targetWave = 1;
    let _label = 'WAVE 1 // ENTER';
    let _isBossWave = false;
    let _t = 0;
    let _nearGate = false;
    let _approachFlash = 0;

    function _isPlaying() {
        if (typeof GameState !== 'undefined') return GameState.phase === 'PLAYING';
        return typeof window !== 'undefined' && window.gameState === 'PLAYING';
    }

    function _detectBossWave(waveNum, options) {
        if (options && options.isBossWave) return true;
        if (typeof window !== 'undefined' && Array.isArray(window.BOSS_ENCOUNTERS)) {
            for (let i = 0; i < window.BOSS_ENCOUNTERS.length; i++) {
                const enc = window.BOSS_ENCOUNTERS[i];
                if (enc && enc.wave === waveNum) return true;
            }
        }
        return false;
    }

    function spawn(options) {
        if (!options || !Number.isFinite(options.x) || !Number.isFinite(options.y)) return;
        if (!Number.isFinite(options.targetWave)) return;
        if (_state !== STATE_IDLE) return false;

        _x = options.x;
        _y = options.y;
        _targetWave = options.targetWave;
        _label = `WAVE ${_targetWave} // ENTER`;
        _isBossWave = _detectBossWave(_targetWave, options);
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
        if (isNear && !_nearGate) _approachFlash = 0.20;
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

    function _traceHexPath(ctx, radius) {
        ctx.beginPath();
        ctx.moveTo(HEX_COS[0] * radius, HEX_SIN[0] * radius);
        for (let i = 1; i < 6; i++) {
            ctx.lineTo(HEX_COS[i] * radius, HEX_SIN[i] * radius);
        }
        ctx.closePath();
    }

    function _drawBrokenHex(ctx, radius, pal, pulse) {
        const readyGlow = Math.min(1, 0.72 + pulse * 0.28 + (_nearGate ? 0.16 : 0));

        ctx.save();
        const baseAlpha = ctx.globalAlpha;

        // 1. Tinted hexagonal energy field backdrop inside the 6-sided frame
        _traceHexPath(ctx, radius);
        ctx.fillStyle = pal.hexBase;
        ctx.fill();

        const hexGrad = ctx.createRadialGradient(0, 0, radius * 0.12, 0, 0, radius);
        hexGrad.addColorStop(0, pal.hexInner);
        hexGrad.addColorStop(0.58, pal.hexMid);
        hexGrad.addColorStop(1, pal.hexOuter);
        ctx.globalAlpha = baseAlpha * readyGlow;
        _traceHexPath(ctx, radius);
        ctx.fillStyle = hexGrad;
        ctx.fill();

        // 2. Pulsing ready-state hex waves clipped inside the hexagonal portal field
        ctx.save();
        _traceHexPath(ctx, radius);
        ctx.clip();

        for (let w = 0; w < 2; w++) {
            const wavePhase = (_t * 0.55 + w * 0.5) % 1;
            const waveR = radius * (0.42 + wavePhase * 0.56);
            ctx.globalAlpha = baseAlpha * Math.sin(wavePhase * Math.PI) * (_nearGate ? 0.68 : 0.48);
            ctx.strokeStyle = pal.primary;
            ctx.lineWidth = Math.max(1.2, radius * 0.032 * (1 - wavePhase * 0.35));
            _traceHexPath(ctx, waveR);
            ctx.stroke();
        }

        // Inner recessed tech hex rail
        ctx.globalAlpha = baseAlpha * 0.38;
        ctx.strokeStyle = pal.primary;
        ctx.lineWidth = Math.max(1, radius * 0.024);
        _traceHexPath(ctx, radius * 0.85);
        ctx.stroke();
        ctx.restore();

        // 3. Full connected 6-sided outer containment frame (meets pylon tips seamlessly)
        ctx.globalAlpha = baseAlpha * (0.82 + pulse * 0.18);
        ctx.lineWidth = Math.max(1.6, radius * 0.048);
        ctx.shadowBlur = radius * 0.36;
        ctx.shadowColor = pal.primaryGlow;
        ctx.strokeStyle = pal.primary;
        _traceHexPath(ctx, radius);
        ctx.stroke();

        // 4. Top & bottom apex Keystone Nodes + 4 pylon joint nodes
        const apexR = Math.max(3, radius * 0.075);
        for (let k = 0; k < 2; k++) {
            const ay = (k === 0 ? -1 : 1) * radius;
            ctx.globalAlpha = baseAlpha * (0.85 + pulse * 0.15);
            ctx.shadowBlur = radius * 0.25;
            ctx.shadowColor = pal.primaryGlow;
            ctx.fillStyle = pal.primary;
            ctx.beginPath();
            ctx.moveTo(0, ay - apexR);
            ctx.lineTo(apexR * 0.85, ay);
            ctx.lineTo(0, ay + apexR);
            ctx.lineTo(-apexR * 0.85, ay);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, ay, Math.max(1.2, apexR * 0.35), 0, TWO_PI);
            ctx.fill();
        }

        ctx.globalAlpha = baseAlpha * (0.7 + pulse * 0.3);
        ctx.fillStyle = pal.shard;
        ctx.shadowBlur = radius * 0.18;
        ctx.shadowColor = pal.primaryGlow;
        for (let i = 1; i < 6; i++) {
            if (i === 3) continue;
            ctx.beginPath();
            ctx.arc(HEX_COS[i] * radius, HEX_SIN[i] * radius, Math.max(2.2, radius * 0.048), 0, TWO_PI);
            ctx.fill();
        }
        ctx.restore();
    }

    function _drawEmitterPylons(ctx, r, pal, warmUp) {
        const hexR = r * HEX_SCALE;
        for (let side = -1; side <= 1; side += 2) {
            const cx = side * HEX_COS[1] * hexR;
            const outerX = cx + side * r * 0.14;
            const innerX = cx - side * r * 0.13;
            const halfH = HEX_SIN[2] * hexR;
            const taperH = halfH * 0.72;

            ctx.save();
            ctx.globalAlpha = warmUp;

            // Angled sci-fi emitter chassis aligned to hex side vertices
            const bodyGrad = ctx.createLinearGradient(innerX, -halfH, outerX, halfH);
            bodyGrad.addColorStop(0, '#162338');
            bodyGrad.addColorStop(0.5, '#0b1220');
            bodyGrad.addColorStop(1, '#050811');

            ctx.shadowBlur = r * 0.24;
            ctx.shadowColor = pal.pylonGlow;
            ctx.fillStyle = bodyGrad;
            ctx.strokeStyle = pal.pylon;
            ctx.lineWidth = Math.max(1.4, r * 0.036);

            ctx.beginPath();
            ctx.moveTo(innerX, -taperH);
            ctx.lineTo(cx, -halfH);
            ctx.lineTo(outerX, -halfH * 0.80);
            ctx.lineTo(outerX + side * r * 0.04, 0);
            ctx.lineTo(outerX, halfH * 0.80);
            ctx.lineTo(cx, halfH);
            ctx.lineTo(innerX, taperH);
            ctx.lineTo(innerX - side * r * 0.04, 0);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Inner metallic recess stripe
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(2, 6, 14, 0.85)';
            ctx.fillRect(cx - r * 0.045, -r * 0.34, r * 0.09, r * 0.68);

            // Three sequential pulsing energy cells
            for (let c = 0; c < 3; c++) {
                const cy = (c - 1) * r * 0.20;
                const cellPulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(_t * 5.2 - c * 1.1));
                ctx.globalAlpha = warmUp * cellPulse;
                ctx.shadowBlur = r * 0.16;
                ctx.shadowColor = pal.pylonCell;
                ctx.fillStyle = pal.pylonCell;
                ctx.fillRect(cx - r * 0.032, cy - r * 0.06, r * 0.064, r * 0.12);
            }

            // Inward focusing emitter nozzle
            const nozzleX = innerX - side * r * 0.05;
            const nozzlePulse = 0.6 + 0.4 * Math.sin(_t * 6.5);
            ctx.globalAlpha = warmUp * nozzlePulse;
            ctx.shadowBlur = r * 0.26;
            ctx.shadowColor = pal.primaryGlow;
            ctx.fillStyle = pal.primary;
            ctx.beginPath();
            ctx.arc(nozzleX, 0, Math.max(2.5, r * 0.068), 0, TWO_PI);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(nozzleX, 0, Math.max(1.2, r * 0.03), 0, TWO_PI);
            ctx.fill();

            ctx.restore();
        }
    }

    function _drawPlasmaStreams(ctx, r, pal, warmUp) {
        const ribbonPhase = Math.sin(_t * TWO_PI / 2.2);
        const startRatio = 0.72;
        const endRatio = 0.24;

        ctx.save();
        for (let side = -1; side <= 1; side += 2) {
            const sx = side * r * startRatio;
            const ex = side * r * endRatio;
            const mx = (sx + ex) * 0.5;
            const amp = r * (0.20 + ribbonPhase * 0.08);

            // Outer energy arc
            ctx.globalAlpha = warmUp * 0.48;
            ctx.shadowBlur = r * 0.24;
            ctx.shadowColor = pal.primaryGlow;
            ctx.strokeStyle = pal.primary;
            ctx.lineWidth = Math.max(1.5, r * 0.042);

            ctx.beginPath();
            ctx.moveTo(sx, -r * 0.05);
            ctx.quadraticCurveTo(mx, -amp, ex, 0);
            ctx.moveTo(sx, r * 0.05);
            ctx.quadraticCurveTo(mx, amp, ex, 0);
            ctx.stroke();

            // Crisp bright inner filament
            ctx.globalAlpha = warmUp * 0.85;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = pal.text;
            ctx.lineWidth = Math.max(0.8, r * 0.016);
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.quadraticCurveTo(mx, ribbonPhase * r * 0.14, ex, 0);
            ctx.stroke();

            // Inward-flowing quantum data packets along the conduit
            ctx.fillStyle = pal.shard;
            for (let k = 0; k < 3; k++) {
                const u = (_t * 1.45 + k / 3 + (side > 0 ? 0.16 : 0)) % 1;
                const inv = 1 - u;
                const ctrlY = (k % 2 === 0 ? -1 : 1) * amp;
                const px = inv * inv * sx + 2 * inv * u * mx + u * u * ex;
                const py = 2 * inv * u * ctrlY;
                ctx.globalAlpha = warmUp * Math.sin(u * Math.PI);
                ctx.beginPath();
                ctx.arc(px, py, Math.max(1.5, r * 0.038), 0, TWO_PI);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function _drawSingularityCore(ctx, r, pal, warmUp) {
        const corePulse = 0.5 + Math.sin(_t * TWO_PI / 1.2) * 0.5;
        const scale = _nearGate ? 1.07 : 1.0;
        const coreR = r * 0.44 * scale;

        ctx.save();
        ctx.globalAlpha = warmUp;

        // Deep quantum abyss gradient
        const abyssGrad = ctx.createRadialGradient(0, 0, coreR * 0.12, 0, 0, coreR);
        abyssGrad.addColorStop(0, '#020108');
        abyssGrad.addColorStop(0.55, pal.coreInner);
        abyssGrad.addColorStop(0.85, pal.coreMid);
        abyssGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = abyssGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coreR, 0, TWO_PI);
        ctx.fill();

        // Three inward-rippling event-horizon rings
        for (let i = 0; i < 3; i++) {
            const phase = (_t * 0.8 + i / 3) % 1;
            const ringR = coreR * (0.94 - phase * 0.76);
            const ringAlpha = Math.sin(phase * Math.PI) * 0.72;
            ctx.globalAlpha = warmUp * ringAlpha;
            ctx.strokeStyle = i % 2 === 0 ? pal.coreRim : pal.primary;
            ctx.lineWidth = Math.max(1, r * 0.028 * (1 - phase * 0.4));
            ctx.beginPath();
            ctx.arc(0, 0, ringR, 0, TWO_PI);
            ctx.stroke();
        }

        // Outer containment aperture rim
        ctx.globalAlpha = warmUp * (0.7 + corePulse * 0.3);
        ctx.shadowBlur = r * (0.28 + corePulse * 0.16);
        ctx.shadowColor = pal.coreRim;
        ctx.strokeStyle = pal.coreRim;
        ctx.lineWidth = Math.max(1.5, r * 0.044);
        ctx.beginPath();
        ctx.arc(0, 0, coreR * 0.92, 0, TWO_PI);
        ctx.stroke();

        // Six orbiting quantum diamond shards (computed via cos/sin)
        ctx.shadowBlur = r * 0.16;
        ctx.shadowColor = pal.shard;
        ctx.fillStyle = pal.shard;
        const shardOrbit = coreR * 1.06;
        const shardSize = Math.max(2.2, r * 0.052);
        for (let i = 0; i < 6; i++) {
            const ang = _t * 1.35 + (TWO_PI * i) / 6;
            const sx = Math.cos(ang) * shardOrbit;
            const sy = Math.sin(ang) * shardOrbit;
            ctx.globalAlpha = warmUp * (i % 2 === 0 ? 0.95 : 0.6);
            ctx.beginPath();
            ctx.moveTo(sx, sy - shardSize);
            ctx.lineTo(sx + shardSize * 0.75, sy);
            ctx.lineTo(sx, sy + shardSize);
            ctx.lineTo(sx - shardSize * 0.75, sy);
            ctx.closePath();
            ctx.fill();
        }

        // Central 4-point quantum star flare
        const flareR = coreR * (0.30 + corePulse * 0.10 + (_nearGate ? 0.10 : 0));
        ctx.globalAlpha = warmUp * (0.65 + corePulse * 0.3);
        ctx.shadowBlur = r * 0.25;
        ctx.shadowColor = pal.text;
        ctx.fillStyle = pal.text;
        ctx.beginPath();
        ctx.moveTo(0, -flareR);
        ctx.lineTo(flareR * 0.22, -flareR * 0.22);
        ctx.lineTo(flareR, 0);
        ctx.lineTo(flareR * 0.22, flareR * 0.22);
        ctx.lineTo(0, flareR);
        ctx.lineTo(-flareR * 0.22, flareR * 0.22);
        ctx.lineTo(-flareR, 0);
        ctx.lineTo(-flareR * 0.22, -flareR * 0.22);
        ctx.closePath();
        ctx.fill();

        if (_approachFlash > 0) {
            ctx.globalAlpha = Math.min(1, _approachFlash / 0.20) * 0.65;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, coreR * 0.62, 0, TWO_PI);
            ctx.fill();
        }

        ctx.restore();
    }

    function _drawNameplate(ctx, r, pal, warmUp) {
        if (!_isBossWave) return;
        ctx.save();
        ctx.globalAlpha = warmUp;
        ctx.shadowBlur = 0;

        const tagText = '⚠ BOSS ANOMALY';
        const tagFont = Math.max(8, Math.round(r * 0.17));
        ctx.font = `700 ${tagFont}px Orbitron, monospace`;
        const tagW = ctx.measureText(tagText).width + 16;
        const tagH = tagFont + 8;
        const tagY = -r * 1.32 - tagH * 0.5;
        ctx.fillStyle = 'rgba(69, 10, 10, 0.92)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-tagW * 0.5, tagY, tagW, tagH, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, 0, tagY + tagH * 0.5 + 0.5);

        ctx.restore();
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
        const corePulse = 0.5 + Math.sin(_t * TWO_PI / 1.4) * 0.5;
        const pal = _isBossWave ? BOSS_PALETTE : NORMAL_PALETTE;

        ctx.save();
        ctx.translate(sx, sy);

        // Layer 1: Ambient radial floor field
        const floorGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.5);
        floorGrad.addColorStop(0, pal.primarySoft);
        floorGrad.addColorStop(0.6, 'rgba(15, 23, 42, 0.22)');
        floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = easedWarmUp * (0.75 + corePulse * 0.25);
        ctx.fillStyle = floorGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.5, 0, TWO_PI);
        ctx.fill();

        // Layer 2: Containment hex matrix
        ctx.globalAlpha = easedWarmUp;
        _drawBrokenHex(ctx, r * HEX_SCALE, pal, corePulse);

        // Layer 3: Sculpted sci-fi emitter pylons
        _drawEmitterPylons(ctx, r, pal, easedWarmUp);

        // Layer 4: Inward plasma / data conduits
        _drawPlasmaStreams(ctx, r, pal, easedWarmUp);

        // Layer 5: Quantum singularity core
        _drawSingularityCore(ctx, r, pal, easedWarmUp);

        // Layer 6: Auto-sized HUD nameplate
        _drawNameplate(ctx, r, pal, easedWarmUp);

        ctx.restore();
    }

    function clear() {
        _state = STATE_IDLE;
        _t = 0;
        _isBossWave = false;
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
        return {
            state: _state,
            targetWave: _targetWave,
            active: isActive(),
            x: _x,
            y: _y,
            isBossWave: _isBossWave,
        };
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
