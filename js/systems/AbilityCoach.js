'use strict';

/**
 * A single, screen-space combat director card.  It is presentation-only:
 * abilities remain manual, so it cannot spend Time Energy or toggle time.
 */
(function () {
    const PROMPT_COOLDOWN = 12;
    const _state = {
        key: '',
        title: '',
        detail: '',
        ttl: 0,
        maxTtl: 1,
        cooldown: 0,
        hue: '#38bdf8',
    };

    function _show(key, title, detail, hue, ttl) {
        if (_state.key === key && _state.ttl > 0) return false;
        _state.key = key;
        _state.title = title;
        _state.detail = detail;
        _state.hue = hue;
        _state.ttl = ttl;
        _state.maxTtl = Math.max(0.1, ttl);
        return true;
    }

    function notifyHijackReady(ttl, cost, trait) {
        if (typeof GameState === 'undefined' || GameState.phase !== 'PLAYING') return false;
        const label = String(trait || 'ENEMY DATA').replace(/_/g, ' ').toUpperCase();
        const duration = Math.min(5.0, Math.max(0.5, Number.isFinite(ttl) ? ttl : 4.2));
        const wasAlreadyShown = _state.key === 'hijack' && _state.ttl > 0;
        _state.key = 'hijack';
        _state.title = 'DATA HIJACK READY';
        _state.detail = `F  //  ${label}  //  ${cost} ENERGY`;
        _state.hue = '#4ade80';
        _state.ttl = duration;
        _state.maxTtl = duration;
        if (!wasAlreadyShown && typeof TerminalLog !== 'undefined') {
            TerminalLog.push({
                sender: 'DATA HIJACK',
                text: `READY [${label}] — PRESS F (${cost} EN)`,
                type: 'info',
            });
        }
        return !wasAlreadyShown;
    }

    function notifySystemAlert(sender, text, type) {
        if (typeof GameState === 'undefined' || GameState.phase !== 'PLAYING') return false;
        if (_state.ttl > 0 && (_state.key === 'hijack' || _state.key === 'slow')) return false;
        const label = String(sender || 'SYSTEM').toUpperCase();
        const hue = type === 'danger' ? '#fb7185' : '#f59e0b';
        _state.key = 'alert';
        _state.title = `${label} // ALERT`;
        _state.detail = String(text || '').slice(0, 46);
        _state.hue = hue;
        _state.ttl = 3.2;
        _state.maxTtl = 3.2;
        return true;
    }

    function update(dt) {
        if (typeof GameState === 'undefined' || GameState.phase !== 'PLAYING' || !window.player || window.player.dead) {
            _state.ttl = 0;
            return;
        }
        _state.cooldown = Math.max(0, _state.cooldown - dt);
        if (_state.ttl > 0) {
            _state.ttl -= dt;
            if (_state.ttl <= 0) {
                _state.ttl = 0;
                _state.cooldown = PROMPT_COOLDOWN;
            }
            return;
        }
        if (window.isSlowMotion || _state.cooldown > 0 || (window.slowMoCurrentEnergy || 0) < 20 || !Array.isArray(window.enemies)) return;
        let threats = 0;
        const px = window.player.x;
        const py = window.player.y;
        for (let i = 0; i < window.enemies.length; i++) {
            const enemy = window.enemies[i];
            if (!enemy || enemy.dead) continue;
            const dx = enemy.x - px;
            const dy = enemy.y - py;
            if (dx * dx + dy * dy <= 260 * 260 && ++threats >= 4) {
                if (_show('slow', 'TIME FRACTURE READY', 'T  //  SLOW THE NEXT RUSH  //  70% SLOW', '#38bdf8', 3.8) && typeof TerminalLog !== 'undefined') {
                    TerminalLog.push({ sender: 'TIME CORE', text: 'TIME FRACTURE READY — T TO SLOW THE RUSH', type: 'info' });
                }
                break;
            }
        }
    }

    function _traceClippedCard(ctx, x, y, w, h, cut) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w - cut, y);
        ctx.lineTo(x + w, y + cut);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + cut, y + h);
        ctx.lineTo(x, y + h - cut);
        ctx.closePath();
    }

    function _drawKeycapBadge(ctx, x, y, size, label, hue, isActive) {
        ctx.save();
        // Keycap base / bevel shadow
        ctx.fillStyle = 'rgba(2, 6, 16, 0.95)';
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 6);
        ctx.fill();

        // Bottom 3D lip
        ctx.fillStyle = hue;
        ctx.globalAlpha = isActive ? 0.35 : 0.25;
        ctx.beginPath();
        ctx.roundRect(x, y + size - 5, size, 5, [0, 0, 6, 6]);
        ctx.fill();

        // Keycap border
        ctx.globalAlpha = isActive ? 0.95 : 0.8;
        ctx.strokeStyle = hue;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, size, size - 2, 6);
        ctx.stroke();

        // Key label
        ctx.globalAlpha = 1;
        ctx.fillStyle = isActive ? '#fef08a' : '#e0f2fe';
        ctx.font = `900 ${label.length > 2 ? 10 : 16}px "Orbitron", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + size * 0.5, y + (size - 2) * 0.5 + 1);
        ctx.restore();
    }

    function _drawDetailPills(ctx, startX, y, pills) {
        let cursorX = startX;
        ctx.font = '700 10px "Share Tech Mono", Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < pills.length; i++) {
            const p = pills[i];
            const tw = ctx.measureText(p.text).width;
            const pw = tw + 10;
            const ph = 16;

            ctx.fillStyle = p.bg || 'rgba(15, 23, 42, 0.85)';
            ctx.beginPath();
            ctx.roundRect(cursorX, y, pw, ph, 3);
            ctx.fill();

            ctx.strokeStyle = p.border || 'rgba(148, 163, 184, 0.32)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = p.color || '#e0f2fe';
            ctx.fillText(p.text, cursorX + 5, y + ph * 0.5 + 0.5);
            cursorX += pw + 6;
        }
    }

    function _drawTacticalCard(ctx, opts) {
        const width = 376;
        const height = 58;
        const cut = 10;
        const x = Math.round((CANVAS.width - width) * 0.5);
        // Sit cleanly above the bottom skill bar with generous separation to avoid overlap.
        const y = Math.max(84, CANVAS.height - 184);
        const hue = opts.hue || '#38bdf8';
        const progress = Math.max(0, Math.min(1, Number.isFinite(opts.progress) ? opts.progress : 1));

        ctx.save();

        // Outer ambient drop glow
        ctx.shadowBlur = 16;
        ctx.shadowColor = hue;
        _traceClippedCard(ctx, x, y, width, height, cut);
        const bgGrad = ctx.createLinearGradient(x, y, x + width, y + height);
        bgGrad.addColorStop(0, 'rgba(6, 11, 22, 0.95)');
        bgGrad.addColorStop(1, 'rgba(13, 21, 38, 0.92)');
        ctx.fillStyle = bgGrad;
        ctx.fill();

        // Subtle horizontal scanlines clipped inside card
        ctx.shadowBlur = 0;
        ctx.save();
        _traceClippedCard(ctx, x, y, width, height, cut);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
        for (let sy = y + 2; sy < y + height; sy += 4) {
            ctx.fillRect(x, sy, width, 1);
        }
        // Left accent stripe
        ctx.fillStyle = hue;
        ctx.fillRect(x, y, 4, height);
        // Progress bar along bottom edge
        ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
        ctx.fillRect(x + 4, y + height - 3, width - 4, 3);
        ctx.fillStyle = hue;
        ctx.fillRect(x + 4, y + height - 3, Math.max(0, (width - 4) * progress), 3);
        ctx.restore();

        // Border stroke
        ctx.strokeStyle = hue;
        ctx.globalAlpha = 0.72;
        ctx.lineWidth = 1.25;
        _traceClippedCard(ctx, x, y, width, height, cut);
        ctx.stroke();

        // Corner brackets (top-left & bottom-right)
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 14);
        ctx.lineTo(x + 6, y + 4);
        ctx.lineTo(x + 16, y + 4);
        ctx.moveTo(x + width - 16, y + height - 4);
        ctx.lineTo(x + width - 6, y + height - 4);
        ctx.lineTo(x + width - 6, y + height - 14);
        ctx.stroke();

        // Left keycap / status badge
        _drawKeycapBadge(ctx, x + 14, y + 10, 36, opts.badge || 'F', hue, !!opts.isActive);

        // Header title & right timer
        const textX = x + 60;
        ctx.font = '700 12px "Orbitron", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = hue;
        ctx.fillText(opts.title, textX, y + 10);

        if (opts.rightTag) {
            ctx.font = '700 11px "Share Tech Mono", Consolas, monospace';
            ctx.textAlign = 'right';
            ctx.fillStyle = '#e0f2fe';
            ctx.fillText(opts.rightTag, x + width - 12, y + 11);
        }

        // Detail pills or fallback text
        if (Array.isArray(opts.pills) && opts.pills.length > 0) {
            _drawDetailPills(ctx, textX, y + 31, opts.pills);
        } else if (opts.detail) {
            ctx.font = '700 11px "Share Tech Mono", Consolas, monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillStyle = '#e0f2fe';
            ctx.fillText(opts.detail, textX, y + 32);
        }

        ctx.restore();
    }

    function draw(ctx) {
        if (!ctx || typeof CANVAS === 'undefined') return;
        if (typeof GameState !== 'undefined' && GameState.phase !== 'PLAYING') return;

        const hud = (typeof BodySwapSystem !== 'undefined' && typeof BodySwapSystem.getHudState === 'function')
            ? BodySwapSystem.getHudState()
            : null;

        if (hud && hud.mode === 'active') {
            const label = String(hud.type || 'ENEMY').replace(/_/g, ' ').toUpperCase();
            const spdPct = Math.round(((hud.speedMult || 1) - 1) * 100);
            const dmgPct = Math.round(((hud.damageMult || 1) - 1) * 100);
            const isExpiring = !!hud.expiring || (hud.remaining > 0 && hud.remaining <= 2.0);
            const blink = isExpiring && Math.floor((typeof performance !== 'undefined' ? performance.now() : Date.now()) / 140) % 2 === 0;
            const hue = isExpiring ? (blink ? '#fb7185' : '#f59e0b') : (hud.color || '#22d3ee');
            _drawTacticalCard(ctx, {
                title: isExpiring ? `⚠ HIJACK EXPIRING // ${label}` : `HIJACK ACTIVE // ${label}`,
                rightTag: `${Math.max(0, hud.remaining).toFixed(1)}s`,
                badge: isExpiring ? '!' : 'ON',
                isActive: true,
                hue,
                progress: hud.duration > 0 ? hud.remaining / hud.duration : 1,
                pills: [
                    { text: `SPD +${spdPct}%`, color: '#67e8f9', border: 'rgba(34,211,238,0.45)', bg: 'rgba(34,211,238,0.12)' },
                    { text: `DMG +${dmgPct}%`, color: '#fde047', border: 'rgba(250,204,21,0.45)', bg: 'rgba(250,204,21,0.12)' },
                    isExpiring
                        ? { text: 'EXPIRING SOON', color: '#fecdd3', border: 'rgba(251,113,133,0.65)', bg: 'rgba(244,63,94,0.24)' }
                        : { text: 'TRAIT SYNCED', color: '#86efac', border: 'rgba(74,222,128,0.45)', bg: 'rgba(74,222,128,0.12)' },
                ],
            });
            return;
        }

        if (hud && hud.mode === 'ready') {
            const label = String(hud.type || 'ENEMY').replace(/_/g, ' ').toUpperCase();
            const spdPct = Math.round(((hud.speedMult || 1) - 1) * 100);
            const dmgPct = Math.round(((hud.damageMult || 1) - 1) * 100);
            const canAfford = typeof BodySwapSystem.canSwap === 'function' && window.player
                ? BodySwapSystem.canSwap(window.player)
                : true;
            const hue = canAfford ? '#4ade80' : '#f59e0b';
            _drawTacticalCard(ctx, {
                title: canAfford ? 'DATA HIJACK READY' : 'HIJACK // LOW ENERGY',
                rightTag: `${Math.max(0, hud.remaining).toFixed(1)}s`,
                badge: 'F',
                isActive: false,
                hue,
                progress: hud.duration > 0 ? hud.remaining / hud.duration : 1,
                pills: [
                    { text: label, color: '#e0f2fe', border: 'rgba(148,163,184,0.4)' },
                    { text: `+${spdPct}% SPD / +${dmgPct}% DMG`, color: '#67e8f9', border: 'rgba(34,211,238,0.35)' },
                    {
                        text: `${hud.energyCost} EN`,
                        color: canAfford ? '#86efac' : '#fca5a5',
                        border: canAfford ? 'rgba(74,222,128,0.45)' : 'rgba(248,113,113,0.5)',
                        bg: canAfford ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.16)',
                    },
                ],
            });
            return;
        }

        if (_state.ttl <= 0) return;
        const badge = _state.key === 'slow' ? 'T' : (_state.key === 'alert' ? '!' : 'F');
        _drawTacticalCard(ctx, {
            title: _state.title,
            detail: _state.detail,
            rightTag: `${Math.max(0, _state.ttl).toFixed(1)}s`,
            badge,
            isActive: false,
            hue: _state.hue,
            progress: _state.maxTtl > 0 ? _state.ttl / _state.maxTtl : 1,
        });
    }

    window.AbilityCoach = { notifyHijackReady, notifySystemAlert, update, draw };
})();
