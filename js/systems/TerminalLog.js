'use strict';

/**
 * js/systems/TerminalLog.js
 *
 * Bounded DOM terminal output for MTC system feedback.
 */
(function () {
    const MAX_LINES = 2;
    const DEDUPE_MS = 2500;
    let _root = null;
    const _entries = [];

    function _styleRoot(el) {
        el.id = 'terminal-log';
        el.setAttribute('aria-live', 'polite');
        el.style.position = 'fixed';
        el.style.left = '18px';
        el.style.bottom = 'max(118px, env(safe-area-inset-bottom) + 18px)';
        el.style.zIndex = '35';
        el.style.width = 'min(352px, calc(100vw - 36px))';
        el.style.pointerEvents = 'none';
        el.style.fontFamily = 'Consolas, "Courier New", monospace';
        el.style.fontSize = '12px';
        el.style.lineHeight = '1.35';
        el.style.color = '#dffafe';
        el.style.textShadow = '0 0 8px rgba(34, 211, 238, 0.28)';
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
        el.style.marginTop = '5px';
        el.style.padding = '7px 9px 7px 11px';
        el.style.border = `1px solid ${type === 'warn' ? 'rgba(245,158,11,0.52)' : 'rgba(34,211,238,0.38)'}`;
        el.style.borderLeft = `3px solid ${type === 'warn' ? '#f59e0b' : (type === 'danger' ? '#f97316' : '#22d3ee')}`;
        el.style.background = 'rgba(8, 12, 18, 0.90)';
        el.style.color = color;
        el.style.whiteSpace = 'nowrap';
        el.style.overflow = 'hidden';
        el.style.textOverflow = 'ellipsis';
    }

    function _renderEntry(record) {
        record.element.textContent = `SYSTEM // ${record.text}${record.count > 1 ? ` ×${record.count}` : ''}`.slice(0, 118);
    }

    function push(entry) {
        const root = _ensureRoot();
        if (!root || !entry) return false;
        const type = entry.type || 'info';
        const sender = entry.sender || 'SYSTEM';
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
        _styleLine(line, type);
        const record = { key, text, count: 1, lastAt: now, element: line };
        _renderEntry(record);
        root.insertBefore(line, root.firstChild);
        _entries.unshift(record);

        while (_entries.length > MAX_LINES) {
            const removed = _entries.pop();
            if (removed.element.parentNode) removed.element.parentNode.removeChild(removed.element);
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
