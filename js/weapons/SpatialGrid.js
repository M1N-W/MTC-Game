'use strict';

/**
 * js/weapons/SpatialGrid.js
 * ════════════════════════════════════════════════
 * O(P×k) collision broadphase.
 * ════════════════════════════════════════════════
 */

class SpatialGrid {
    static CELL = 128;

    constructor() {
        this._cells = new Map();
        this._results = [];
        this._pool = [];
    }

    _cellCoord(v) {
        return Math.floor(v / SpatialGrid.CELL);
    }

    _cellKey(cx, cy) {
        return ((cx & 0xFFFF) << 16) | (cy & 0xFFFF);
    }

    build(enemies) {
        for (const cell of this._cells.values()) {
            cell.length = 0;
            this._pool.push(cell);
        }
        this._cells.clear();
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.dead) continue;
            const key = this._cellKey(this._cellCoord(e.x), this._cellCoord(e.y));
            let cell = this._cells.get(key);
            if (!cell) {
                cell = this._pool.length > 0 ? this._pool.pop() : [];
                this._cells.set(key, cell);
            }
            cell.push(e);
        }
    }

    query(wx, wy) {
        const cx = this._cellCoord(wx);
        const cy = this._cellCoord(wy);
        this._results.length = 0;

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const cell = this._cells.get(this._cellKey(cx + dx, cy + dy));
                if (cell) {
                    for (let i = 0; i < cell.length; i++) this._results.push(cell[i]);
                }
            }
        }
        return this._results;
    }
}

window.SpatialGrid = SpatialGrid;
