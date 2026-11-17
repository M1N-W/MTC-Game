'use strict';

/**
 * js/systems/BodySwapSystem.js
 *
 * Data Hijack controller for defeated enemy snapshots.
 * Stores primitive snapshot data only; never stores enemy object references.
 */
(function () {
    const SNAPSHOT_TTL = 5.0;
    const ACTIVE_DURATION = 8.0;
    const ENERGY_COST = 30;
    const RING_MARGIN = 14;
    const RING_DASH = Object.freeze([6, 5]);
    const EMPTY_DASH = Object.freeze([]);

    const ELIGIBLE = Object.freeze({
        basic: true,
        tank: true,
        mage: true,
        sniper: true,
        shield_bravo: true,
        charger: true,
        hunter: true,
        poison_spitter: true,
        summoner: true,
        buffer: true,
        fatality_bomber: false,
        healer: false,
        summon_minion: false,
    });

    const _snapshot = {
        active: false,
        ttl: 0,
        type: '',
        radius: 20,
        color: '#22d3ee',
        speedMult: 1,
        damageMult: 1,
    };

    const _baseline = {
        active: false,
        radius: 20,
        statsMoveSpeed: 0,
        moveSpeed: 0,
        damageMultiplier: 1,
        baseDamageMultiplier: 1,
    };

    let _active = false;
    let _timer = 0;
    let _pulse = 0;
    let _energyCost = ENERGY_COST;
    let _activeType = '';
    let _activeColor = '#22d3ee';
    let _activeSpeedMult = 1;
    let _activeDamageMult = 1;

    function _syncSnapshotFromEnemy(enemy) {
        const type = typeof enemy.type === 'string' ? enemy.type : '';
        if (!ELIGIBLE[type]) return false;

        const radius = Number.isFinite(enemy.radius) ? enemy.radius : 20;
        const speed = Number.isFinite(enemy.speed) ? enemy.speed : 0;
        const damage = Number.isFinite(enemy.damage) ? enemy.damage : 0;
        const color = typeof enemy.color === 'string' ? enemy.color : '#22d3ee';

        _snapshot.active = true;
        _snapshot.ttl = SNAPSHOT_TTL;
        _snapshot.type = type;
        _snapshot.radius = Math.max(16, Math.min(34, radius));
        _snapshot.color = color;
        _snapshot.speedMult = Math.max(1.15, Math.min(1.45, speed > 0 ? speed / 120 : 1.15));
        _snapshot.damageMult = Math.max(1.15, Math.min(1.45, damage > 0 ? damage / 14 : 1.15));
        return true;
    }

    function capture(enemy, killer) {
        if (!enemy || !killer || killer !== window.player) return false;
        const captured = _syncSnapshotFromEnemy(enemy);
        if (captured && typeof AbilityCoach !== 'undefined') AbilityCoach.notifyHijackReady(_snapshot.ttl, _energyCost, _snapshot.type);
        return captured;
    }

    function canSwap(player) {
        if (!player || player.dead || _active || !_snapshot.active) return false;
        if (typeof canUseTimeEnergy === 'function') return canUseTimeEnergy(_energyCost);
        return (window.slowMoCurrentEnergy || 0) >= _energyCost;
    }

    function _storeBaseline(player) {
        _baseline.active = true;
        _baseline.radius = player.radius || 20;
        _baseline.statsMoveSpeed = player.stats ? player.stats.moveSpeed : 0;
        _baseline.moveSpeed = player.moveSpeed || 0;
        _baseline.damageMultiplier = player.damageMultiplier || 1;
        _baseline.baseDamageMultiplier = Number.isFinite(player._damageMultiplier)
            ? player._damageMultiplier
            : _baseline.damageMultiplier;
    }

    function _applySnapshot(player) {
        player.radius = _snapshot.radius;
        if (player.stats && Number.isFinite(_baseline.statsMoveSpeed)) {
            player.stats.moveSpeed = _baseline.statsMoveSpeed * _snapshot.speedMult;
        } else if (Number.isFinite(_baseline.moveSpeed)) {
            player.moveSpeed = _baseline.moveSpeed * _snapshot.speedMult;
        }
        if (Number.isFinite(player._damageMultiplier)) player._damageMultiplier = _baseline.baseDamageMultiplier * _snapshot.damageMult;
        else player.damageMultiplier = _baseline.damageMultiplier * _snapshot.damageMult;
        player._dataHijackActive = true;
        player._dataHijackColor = _snapshot.color;
        player._dataHijackType = _snapshot.type;
    }

    function activate(player) {
        if (!canSwap(player)) {
            const energyBlocked = player && _snapshot.active &&
                typeof canUseTimeEnergy === 'function' && !canUseTimeEnergy(_energyCost);
            if (energyBlocked && typeof AlertSystem !== 'undefined') {
                AlertSystem.emit(player, 'warning', { text: '[LOW ENERGY]' });
            }
            if (energyBlocked && typeof TerminalLog !== 'undefined') {
                TerminalLog.push({ sender: 'DATA HIJACK', text: 'ENERGY BELOW REQUIRED THRESHOLD', type: 'warn' });
            }
            if (player && typeof spawnFloatingText === 'function') {
                spawnFloatingText('DATA HIJACK BLOCKED', player.x, player.y - 62, '#ef4444', 18);
            }
            return false;
        }
        if (typeof consumeTimeEnergy === 'function' && !consumeTimeEnergy(_energyCost)) return false;

        _storeBaseline(player);
        _applySnapshot(player);
        _active = true;
        _timer = ACTIVE_DURATION;
        _pulse = 0;
        _activeType = _snapshot.type;
        _activeColor = _snapshot.color;
        _activeSpeedMult = _snapshot.speedMult;
        _activeDamageMult = _snapshot.damageMult;
        _snapshot.active = false;
        _snapshot.ttl = 0;

        if (typeof spawnFloatingText === 'function') {
            spawnFloatingText('DATA HIJACK', player.x, player.y - 70, _snapshot.color, 22);
        }
        if (typeof TerminalLog !== 'undefined') {
            TerminalLog.push({ sender: 'DATA HIJACK', text: 'TEMPORARY ENEMY DATA APPLIED', type: 'info' });
        }
        return true;
    }

    function cancel(player) {
        if (!_active) return;
        if (player && _baseline.active) {
            player.radius = _baseline.radius;
            if (player.stats && Number.isFinite(_baseline.statsMoveSpeed)) player.stats.moveSpeed = _baseline.statsMoveSpeed;
            else if (Number.isFinite(_baseline.moveSpeed)) player.moveSpeed = _baseline.moveSpeed;
            if (Number.isFinite(player._damageMultiplier)) player._damageMultiplier = _baseline.baseDamageMultiplier;
            else player.damageMultiplier = _baseline.damageMultiplier;
            player._dataHijackActive = false;
            player._dataHijackColor = null;
            player._dataHijackType = null;
        }
        _active = false;
        _timer = 0;
        _activeType = '';
        _activeColor = '#22d3ee';
        _activeSpeedMult = 1;
        _activeDamageMult = 1;
        _baseline.active = false;
    }

    function update(dt, player) {
        if (_snapshot.active) {
            _snapshot.ttl -= dt;
            if (_snapshot.ttl <= 0) {
                _snapshot.active = false;
                _snapshot.ttl = 0;
            }
        }
        if (!_active) return;
        _pulse += dt;
        _timer -= dt;
        if (!player || player.dead || _timer <= 0) cancel(player);
    }

    function draw(ctx, player) {
        if (!_active || !ctx || !player || player.dead) return;
        if (typeof CANVAS === 'undefined') return;
        const screen = typeof worldToScreen === 'function' ? worldToScreen(player.x, player.y) : { x: player.x, y: player.y };
        const sx = screen.x;
        const sy = screen.y;
        const zoom = (typeof camera !== 'undefined' && camera.zoom) ? camera.zoom : 1;
        const r = ((player.radius || 20) + RING_MARGIN) * zoom;
        const cullR = r + 40;
        if (sx < -cullR || sx > CANVAS.width + cullR || sy < -cullR || sy > CANVAS.height + cullR) return;

        const color = _activeColor || player._dataHijackColor || '#22d3ee';
        const isExpiring = _timer > 0 && _timer <= 2.0;
        const warnBlink = isExpiring ? (0.5 + Math.sin(_pulse * 22) * 0.5) : 0;
        const ringColor = isExpiring ? (warnBlink > 0.5 ? '#fb7185' : '#f59e0b') : color;
        const progress = Math.max(0, Math.min(1, _timer / ACTIVE_DURATION));
        const pulse = 0.5 + Math.sin(_pulse * 8) * 0.5;
        const typeLabel = String(_activeType || player._dataHijackType || 'DATA').replace(/_/g, ' ').toUpperCase();

        ctx.save();
        ctx.translate(sx, sy);

        // 1. Soft radial hologram glow beneath player
        const floorGrad = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.38);
        floorGrad.addColorStop(0, isExpiring ? 'rgba(251, 113, 133, 0.12)' : 'rgba(34, 211, 238, 0.08)');
        floorGrad.addColorStop(0.65, isExpiring ? 'rgba(245, 158, 11, 0.16)' : 'rgba(34, 211, 238, 0.14)');
        floorGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = floorGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.38, 0, Math.PI * 2);
        ctx.fill();

        // 2. Inner translucent tint + subtle ring
        ctx.globalAlpha = 0.14 + pulse * 0.08;
        ctx.fillStyle = ringColor;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
        ctx.fill();

        // 3. Outer segmented containment ring (animated dash offset)
        ctx.globalAlpha = isExpiring ? (0.7 + warnBlink * 0.3) : (0.75 + pulse * 0.2);
        ctx.lineWidth = Math.max(1.5, 1.8 * zoom);
        ctx.strokeStyle = ringColor;
        ctx.shadowBlur = isExpiring ? (12 + warnBlink * 10) : (10 + pulse * 8);
        ctx.shadowColor = ringColor;
        ctx.setLineDash(RING_DASH);
        ctx.lineDashOffset = -_pulse * (isExpiring ? 34 : 22);
        ctx.beginPath();
        ctx.arc(0, 0, r + pulse * 2.5 * zoom, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash(EMPTY_DASH);
        ctx.lineDashOffset = 0;

        // 4. Duration progress arc
        const arcR = r * 0.86;
        ctx.globalAlpha = 0.22;
        ctx.lineWidth = Math.max(2, 2.5 * zoom);
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 0, arcR, 0, Math.PI * 2);
        ctx.stroke();

        if (progress > 0) {
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = ringColor;
            ctx.shadowBlur = 8;
            ctx.shadowColor = ringColor;
            ctx.beginPath();
            ctx.arc(0, 0, arcR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * progress);
            ctx.stroke();
        }

        // 5. Six orbiting data nodes on outer ring
        const orbitR = r + 3.5 * zoom;
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#e0f2fe';
        for (let i = 0; i < 6; i++) {
            const ang = _pulse * 1.6 + (Math.PI * 2 * i) / 6;
            const nx = Math.cos(ang) * orbitR;
            const ny = Math.sin(ang) * orbitR;
            ctx.globalAlpha = i % 2 === 0 ? 0.9 : 0.5;
            ctx.beginPath();
            ctx.arc(nx, ny, i % 2 === 0 ? 2.4 * zoom : 1.6 * zoom, 0, Math.PI * 2);
            ctx.fill();
        }

        // 6. Compact tactical tag below the ring
        const tagText = `${isExpiring ? '⚠ ' : ''}HIJACK // ${typeLabel} ${_timer.toFixed(1)}s`;
        const fontSize = Math.max(9, Math.round(9.5 * zoom));
        ctx.font = `700 ${fontSize}px "Share Tech Mono", Consolas, monospace`;
        const textW = ctx.measureText(tagText).width;
        const pillW = textW + 14;
        const pillH = fontSize + 8;
        const pillY = r + 10 * zoom;

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = isExpiring ? 'rgba(30, 8, 16, 0.94)' : 'rgba(6, 11, 22, 0.9)';
        ctx.beginPath();
        ctx.moveTo(-pillW * 0.5, pillY);
        ctx.lineTo(pillW * 0.5 - 5, pillY);
        ctx.lineTo(pillW * 0.5, pillY + 5);
        ctx.lineTo(pillW * 0.5, pillY + pillH);
        ctx.lineTo(-pillW * 0.5 + 5, pillY + pillH);
        ctx.lineTo(-pillW * 0.5, pillY + pillH - 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = isExpiring ? 1.4 : 1;
        ctx.stroke();

        ctx.fillStyle = isExpiring ? (warnBlink > 0.5 ? '#fecdd3' : '#fde68a') : '#e0f2fe';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, 0, pillY + pillH * 0.5 + 0.5);

        ctx.restore();
    }

    function clear() {
        if (_active && typeof window !== 'undefined' && window.player) cancel(window.player);
        _snapshot.active = false;
        _snapshot.ttl = 0;
        _snapshot.type = '';
        _active = false;
        _timer = 0;
        _pulse = 0;
        _activeType = '';
        _activeColor = '#22d3ee';
        _activeSpeedMult = 1;
        _activeDamageMult = 1;
        _baseline.active = false;
    }

    function tuneEnergyCost(delta) {
        if (!Number.isFinite(delta)) return false;
        _energyCost = Math.max(20, Math.min(ENERGY_COST, _energyCost + delta));
        return true;
    }

    function resetTuning() {
        _energyCost = ENERGY_COST;
    }

    function isReady() { return _snapshot.active && !_active; }
    function getRemaining() { return _snapshot.active ? _snapshot.ttl : (_active ? _timer : 0); }
    function getEnergyCost() { return _energyCost; }

    function getHudState() {
        if (_active) {
            return {
                mode: 'active',
                ready: false,
                active: true,
                expiring: _timer > 0 && _timer <= 2.0,
                remaining: _timer,
                duration: ACTIVE_DURATION,
                type: _activeType || (typeof window !== 'undefined' && window.player && window.player._dataHijackType) || 'ENEMY',
                color: _activeColor || (typeof window !== 'undefined' && window.player && window.player._dataHijackColor) || '#22d3ee',
                energyCost: _energyCost,
                speedMult: _activeSpeedMult || 1.15,
                damageMult: _activeDamageMult || 1.15,
            };
        }
        if (_snapshot.active) {
            return {
                mode: 'ready',
                ready: true,
                active: false,
                remaining: _snapshot.ttl,
                duration: SNAPSHOT_TTL,
                type: _snapshot.type || 'ENEMY',
                color: _snapshot.color || '#4ade80',
                energyCost: _energyCost,
                speedMult: _snapshot.speedMult || 1.15,
                damageMult: _snapshot.damageMult || 1.15,
            };
        }
        return { mode: 'idle', ready: false, active: false, remaining: 0, duration: 0 };
    }

    window.BodySwapSystem = {
        capture,
        canSwap,
        activate,
        update,
        draw,
        cancel,
        clear,
        tuneEnergyCost,
        resetTuning,
        isReady,
        getRemaining,
        getEnergyCost,
        getHudState,
    };
    window.tuneBodySwapEnergyCost = tuneEnergyCost;
    window.resetBodySwapTuning = resetTuning;
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
