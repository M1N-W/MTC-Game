'use strict';

/**
 * js/systems/TerminalLog.js
 *
 * Bounded DOM tactical event rail for MTC system feedback.
 */
(function () {
    const MAX_LINES = 2;
    const DEDUPE_MS = 2500;
    const STYLE_ID = 'terminal-log-styles';
    let _root = null;
    const _entries = [];

    function _ensureStyles() {
        if (typeof document === 'undefined') return;
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            @keyframes tlSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(-14px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            #terminal-log .terminal-log-line {
                position: relative;
                display: flex;
                align-items: center;
                gap: 7px;
                box-sizing: border-box;
                margin-top: 6px;
                padding: 7px 12px 7px 10px;
                background: linear-gradient(90deg, rgba(6, 11, 22, 0.95) 0%, rgba(13, 21, 38, 0.88) 100%);
                border: 1px solid var(--tl-border, rgba(34, 211, 238, 0.36));
                border-left: 3px solid var(--tl-accent, #22d3ee);
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55), inset 0 0 12px var(--tl-inset, rgba(34, 211, 238, 0.08));
                clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
                -webkit-clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
                font-family: "Share Tech Mono", Consolas, "Courier New", monospace;
                font-size: 11.5px;
                line-height: 1.3;
                letter-spacing: 0.03em;
                color: var(--tl-text, #e0f2fe);
                overflow: hidden;
                animation: tlSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
            }
            #terminal-log .terminal-log-line::after {
                content: "";
                position: absolute;
                inset: 0;
                pointer-events: none;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(255, 255, 255, 0.025) 2px,
                    rgba(255, 255, 255, 0.025) 3px
                );
            }
            #terminal-log .tl-sender {
                flex-shrink: 0;
                padding: 2px 6px;
                border-radius: 3px;
                font-family: "Orbitron", monospace;
                font-size: 9px;
                font-weight: 700;
                letter-spacing: 0.08em;
                color: var(--tl-accent, #22d3ee);
                background: var(--tl-chip-bg, rgba(34, 211, 238, 0.12));
                border: 1px solid var(--tl-chip-border, rgba(34, 211, 238, 0.34));
                text-transform: uppercase;
            }
            #terminal-log .tl-msg {
                flex: 1 1 auto;
                min-width: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #terminal-log .tl-count {
                flex-shrink: 0;
                padding: 1px 6px;
                border-radius: 999px;
                font-size: 10px;
                font-weight: 700;
                color: #080c12;
                background: var(--tl-accent, #22d3ee);
            }
            @media (prefers-reduced-motion: reduce) {
                #terminal-log .terminal-log-line {
                    animation: none;
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function _styleRoot(el) {
        el.id = 'terminal-log';
        el.setAttribute('aria-live', 'polite');
        // Hidden from viewport to keep HUD uncluttered; critical alerts route to AbilityCoach.
        el.style.display = 'none';
        el.style.position = 'fixed';
        el.style.left = '18px';
        el.style.bottom = 'max(118px, env(safe-area-inset-bottom) + 18px)';
        el.style.zIndex = '35';
        el.style.width = 'min(372px, calc(100vw - 36px))';
        el.style.pointerEvents = 'none';
        el.style.fontFamily = '"Share Tech Mono", Consolas, "Courier New", monospace';
    }

    function _ensureRoot() {
        _ensureStyles();
        if (_root && _root.isConnected) return _root;
        if (typeof document === 'undefined') return null;

        _root = document.getElementById('terminal-log');
        if (!_root) {
            _root = document.createElement('div');
            _styleRoot(_root);
            const host = document.getElementById('ui-layer') || document.body;
            if (!host) return null;
            host.appendChild(_root);
        } else {
            _styleRoot(_root);
        }
        return _root;
    }

    function _resolvePalette(sender, type) {
        if (type === 'danger') {
            return {
                accent: '#fb7185',
                text: '#ffe4e6',
                border: 'rgba(251, 113, 133, 0.45)',
                inset: 'rgba(251, 113, 133, 0.12)',
                chipBg: 'rgba(251, 113, 133, 0.14)',
                chipBorder: 'rgba(251, 113, 133, 0.4)',
            };
        }
        if (type === 'warn') {
            return {
                accent: '#f59e0b',
                text: '#fef08a',
                border: 'rgba(245, 158, 11, 0.48)',
                inset: 'rgba(245, 158, 11, 0.10)',
                chipBg: 'rgba(245, 158, 11, 0.14)',
                chipBorder: 'rgba(245, 158, 11, 0.42)',
            };
        }
        if (sender === 'DATA HIJACK') {
            return {
                accent: '#4ade80',
                text: '#dcfce7',
                border: 'rgba(74, 222, 128, 0.44)',
                inset: 'rgba(74, 222, 128, 0.10)',
                chipBg: 'rgba(74, 222, 128, 0.14)',
                chipBorder: 'rgba(74, 222, 128, 0.4)',
            };
        }
        if (sender === 'TIME CORE') {
            return {
                accent: '#38bdf8',
                text: '#e0f2fe',
                border: 'rgba(56, 189, 248, 0.44)',
                inset: 'rgba(56, 189, 248, 0.10)',
                chipBg: 'rgba(56, 189, 248, 0.14)',
                chipBorder: 'rgba(56, 189, 248, 0.4)',
            };
        }
        return {
            accent: '#22d3ee',
            text: '#cffafe',
            border: 'rgba(34, 211, 238, 0.40)',
            inset: 'rgba(34, 211, 238, 0.08)',
            chipBg: 'rgba(34, 211, 238, 0.12)',
            chipBorder: 'rgba(34, 211, 238, 0.36)',
        };
    }

    function _styleLine(el, sender, type) {
        const pal = _resolvePalette(sender, type);
        el.style.setProperty('--tl-accent', pal.accent);
        el.style.setProperty('--tl-text', pal.text);
        el.style.setProperty('--tl-border', pal.border);
        el.style.setProperty('--tl-inset', pal.inset);
        el.style.setProperty('--tl-chip-bg', pal.chipBg);
        el.style.setProperty('--tl-chip-border', pal.chipBorder);
    }

    function _renderEntry(record) {
        const el = record.element;
        while (el.firstChild) el.removeChild(el.firstChild);

        const senderSpan = document.createElement('span');
        senderSpan.className = 'tl-sender';
        senderSpan.textContent = record.sender;

        const msgSpan = document.createElement('span');
        msgSpan.className = 'tl-msg';
        msgSpan.textContent = String(record.text || '').slice(0, 108);

        el.appendChild(senderSpan);
        el.appendChild(msgSpan);

        if (record.count > 1) {
            const countSpan = document.createElement('span');
            countSpan.className = 'tl-count';
            countSpan.textContent = `×${record.count}`;
            el.appendChild(countSpan);
        }
    }

    function push(entry) {
        const root = _ensureRoot();
        if (!root || !entry) return false;
        const type = entry.type || 'info';
        const sender = String(entry.sender || 'SYSTEM').toUpperCase();
        const text = entry.text || '';
        const key = `${sender}:${text}:${type}`;
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        for (let i = 0; i < _entries.length; i++) {
            const existing = _entries[i];
            if (existing.key === key && now - existing.lastAt <= DEDUPE_MS) {
                existing.count++;
                existing.lastAt = now;
                _renderEntry(existing);
                return true;
            }
        }

        const line = document.createElement('div');
        line.className = `terminal-log-line terminal-log-${type}`;
        _styleLine(line, sender, type);
        const record = { key, sender, text, count: 1, lastAt: now, element: line };
        _renderEntry(record);
        root.insertBefore(line, root.firstChild);
        _entries.unshift(record);

        while (_entries.length > MAX_LINES) {
            const removed = _entries.pop();
            if (removed.element.parentNode) removed.element.parentNode.removeChild(removed.element);
        }

        if ((type === 'warn' || type === 'danger') &&
            typeof AbilityCoach !== 'undefined' &&
            typeof AbilityCoach.notifySystemAlert === 'function') {
            AbilityCoach.notifySystemAlert(sender, text, type);
        }
        return true;
    }

    function clear() {
        const root = _ensureRoot();
        if (!root) return;
        while (root.firstChild) root.removeChild(root.firstChild);
        _entries.length = 0;
    }

    window.TerminalLog = {
        push,
        clear,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
