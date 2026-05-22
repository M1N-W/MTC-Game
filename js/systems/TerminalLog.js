'use strict';

/**
 * js/systems/TerminalLog.js
 *
 * Bounded DOM terminal output for MTC system feedback.
 */
(function () {
    const MAX_LINES = 6;
    let _root = null;

    function _styleRoot(el) {
        el.id = 'terminal-log';
        el.setAttribute('aria-live', 'polite');
        el.style.position = 'fixed';
        el.style.left = '18px';
        el.style.bottom = '18px';
        el.style.zIndex = '35';
        el.style.width = 'min(360px, calc(100vw - 36px))';
        el.style.pointerEvents = 'none';
        el.style.fontFamily = 'Consolas, "Courier New", monospace';
        el.style.fontSize = '11px';
        el.style.lineHeight = '1.35';
        el.style.color = '#dffafe';
        el.style.textShadow = '0 0 8px rgba(34, 211, 238, 0.45)';
    }

    function _ensureRoot() {
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

    function _styleLine(el, type) {
        const color = type === 'warn' ? '#facc15' : (type === 'danger' ? '#fb7185' : '#67e8f9');
        el.style.boxSizing = 'border-box';
        el.style.marginTop = '4px';
        el.style.padding = '4px 7px';
        el.style.border = `1px solid ${type === 'warn' ? 'rgba(250,204,21,0.35)' : 'rgba(34,211,238,0.28)'}`;
        el.style.background = 'rgba(2, 6, 23, 0.62)';
        el.style.color = color;
        el.style.whiteSpace = 'nowrap';
        el.style.overflow = 'hidden';
        el.style.textOverflow = 'ellipsis';
    }

    function push(entry) {
        const root = _ensureRoot();
        if (!root || !entry) return false;

        const line = document.createElement('div');
        const type = entry.type || 'info';
        const sender = entry.sender || 'SYSTEM';
        const text = entry.text || '';
        line.className = `terminal-log-line terminal-log-${type}`;
        _styleLine(line, type);
        line.textContent = `> ${sender}: ${text}`.slice(0, 118);
        root.appendChild(line);

        while (root.childNodes.length > MAX_LINES) {
            root.removeChild(root.firstChild);
        }
        return true;
    }

    function clear() {
        const root = _ensureRoot();
        if (!root) return;
        while (root.firstChild) root.removeChild(root.firstChild);
    }

    window.TerminalLog = {
        push,
        clear,
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {};
}
