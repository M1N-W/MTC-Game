'use strict';

/**
 * js/systems/BodySwapSystem.js
 *
 * Data Hijack controller for defeated enemy snapshots.
 * Stores primitive snapshot data only; never stores enemy object references.
 */
(function () {
    const SNAPSHOT_TTL = 4.0;
    const ACTIVE_DURATION = 6.0;
    const ENERGY_COST = 40;
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
        _snapshot.speedMult = Math.max(0.9, Math.min(1.35, speed > 0 ? speed / 150 : 1));
        _snapshot.damageMult = Math.max(1.0, Math.min(1.25, damage > 0 ? damage / 18 : 1));
        return true;
    }

    function capture(enemy, killer) {
        if (!enemy || !killer || killer !== window.player) return false;
        return _syncSnapshotFromEnemy(enemy);
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
        const cam = (typeof camera !== 'undefined') ? camera : window.camera;
        const sx = cam ? player.x - cam.x : player.x;
        const sy = cam ? player.y - cam.y : player.y;
        const r = (player.radius || 20) + RING_MARGIN;
        if (sx < -r || sx > CANVAS.width + r || sy < -r || sy > CANVAS.height + r) return;

        const pulse = 0.5 + Math.sin(_pulse * 12) * 0.5;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.lineWidth = 2;
        ctx.strokeStyle = player._dataHijackColor || '#22d3ee';
        ctx.shadowBlur = 10 + pulse * 8;
        ctx.shadowColor = ctx.strokeStyle;
        ctx.setLineDash(RING_DASH);
        ctx.beginPath();
        ctx.arc(0, 0, r + pulse * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash(EMPTY_DASH);
        ctx.globalAlpha = 0.25 + pulse * 0.15;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
        ctx.fill();
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
    };
    window.tuneBodySwapEnergyCost = tuneEnergyCost;
    window.resetBodySwapTuning = resetTuning;
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
