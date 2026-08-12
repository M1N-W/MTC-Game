'use strict';

/**
 * A single, screen-space combat director card.  It is presentation-only:
 * abilities remain manual, so it cannot spend Time Energy or toggle time.
 */
(function () {
    const PROMPT_COOLDOWN = 12;
    const _state = { key: '', title: '', detail: '', ttl: 0, cooldown: 0, hue: '#38bdf8' };

    function _show(key, title, detail, hue, ttl) {
        if (_state.key === key && _state.ttl > 0) return false;
        _state.key = key; _state.title = title; _state.detail = detail;
        _state.hue = hue; _state.ttl = ttl;
        return true;
    }

    function notifyHijackReady(ttl, cost, trait) {
        if (_state.cooldown > 0 || typeof GameState === 'undefined' || GameState.phase !== 'PLAYING') return false;
        const label = String(trait || 'ENEMY DATA').replace(/_/g, ' ').toUpperCase();
        const shown = _show('hijack', 'DATA HIJACK READY', `F  //  ${label}  //  ${cost} ENERGY`, '#4ade80', Math.min(4.2, ttl));
        if (shown && typeof TerminalLog !== 'undefined') TerminalLog.push({ sender: 'DATA HIJACK', text: 'READY — F TO BORROW ENEMY TRAIT', type: 'info' });
        return shown;
    }

    function update(dt) {
        if (typeof GameState === 'undefined' || GameState.phase !== 'PLAYING' || !window.player || window.player.dead) {
            _state.ttl = 0; return;
        }
        _state.cooldown = Math.max(0, _state.cooldown - dt);
        if (_state.ttl > 0) {
            _state.ttl -= dt;
            if (_state.ttl <= 0) { _state.ttl = 0; _state.cooldown = PROMPT_COOLDOWN; }
            return;
        }
        if (window.isSlowMotion || _state.cooldown > 0 || (window.slowMoCurrentEnergy || 0) < 20 || !Array.isArray(window.enemies)) return;
        let threats = 0;
        const px = window.player.x, py = window.player.y;
        for (let i = 0; i < window.enemies.length; i++) {
            const enemy = window.enemies[i];
            if (!enemy || enemy.dead) continue;
            const dx = enemy.x - px, dy = enemy.y - py;
            if (dx * dx + dy * dy <= 260 * 260 && ++threats >= 4) {
                if (_show('slow', 'TIME FRACTURE READY', 'T  //  SLOW THE NEXT RUSH  //  70% SLOW', '#38bdf8', 3.8) && typeof TerminalLog !== 'undefined') {
                    TerminalLog.push({ sender: 'TIME CORE', text: 'TIME FRACTURE READY — T TO SLOW THE RUSH', type: 'info' });
                }
                break;
            }
        }
    }

    function draw(ctx) {
        if (!ctx || _state.ttl <= 0 || typeof CANVAS === 'undefined') return;
        const width = 318, height = 54, x = (CANVAS.width - width) * 0.5, y = 18;
        ctx.save();
        ctx.fillStyle = 'rgba(8,12,18,0.92)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = _state.hue; ctx.globalAlpha = 0.65; ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
        ctx.globalAlpha = 1; ctx.fillStyle = _state.hue; ctx.fillRect(x, y, 3, height);
        ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(_state.title, x + 14, y + 10);
        ctx.font = '11px monospace'; ctx.fillStyle = '#e0f2fe';
        ctx.fillText(_state.detail, x + 14, y + 31);
        ctx.restore();
    }

    window.AbilityCoach = { notifyHijackReady, update, draw };
})();
