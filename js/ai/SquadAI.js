'use strict';
/**
 * js/ai/SquadAI.js
 * ════════════════════════════════════════════════════════════════
 * Squad-level coordination layer — assigns roles to enemies at 1Hz.
 * Writes _squadRole onto each enemy; UtilityAI reads role to override decisions.
 *
 * Roles:
 *  'assault'  — basic enemies, rush player directly (default)
 *  'flanker'  — outer-ring basic enemies, strafe wide
 *  'shield'   — tank enemies only, cluster in front of squad
 *  'support'  — mage enemies only, hold back and cast
 *
 * Design:
 *  • Singleton — one SquadAI per session, updated from game.js
 *  • 1Hz tick via _timer accumulator (never performance.now())
 *  • Spatial bucket grid (_BucketGrid) — O(N) build, O(1) cell lookup
 *    avoids O(N²) distance checks per frame
 *  • Writes onto existing enemy objects — zero new allocations in hot path
 *  • tagOnSpawn() sets default role immediately on spawn before first tick
 *
 * Load order:
 *   config.js → base.js → UtilityAI.js → EnemyActions.js → [THIS FILE] → enemy.js
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────
 *  L.35  SQUAD_ROLE constants       'assault'|'flanker'|'shield'|'support'
 *
 *  L.42  class _BucketGrid          internal spatial hash (not exported)
 *          build(enemies)           rebuild from current array — call once/tick
 *          nearby(x, y)             return enemies in 3×3 cell neighbourhood
 *
 *  L.80  class SquadAI
 *          L.97  update(dt, enemies, player)   1Hz main tick
 *          L.118 _assignRole(enemy, ...)       role logic per enemy
 *  ⚠️  SHIELD role assigned exclusively to type==='tank'.
 *      Basic enemies can only be FLANKER or ASSAULT — shieldCount budget
 *      in the nearby loop has no effect on basic enemy assignment.
 *
 *          L.164 static tagOnSpawn(enemy)      call after enemies.push(e)
 *
 *  L.178 Singleton: window.squadAI
 *  L.179 window.SQUAD_ROLE          (consumed by UtilityAI + EnemyActions)
 *
 * ════════════════════════════════════════════════════════════════
 */

// ── Role constants ────────────────────────────────────────────────────────────
const SQUAD_ROLE = {
    ASSAULT: 'assault',
    FLANKER: 'flanker',
    SHIELD: 'shield',
    SUPPORT: 'support',
};

// ── Lightweight spatial bucket grid ──────────────────────────────────────────
// Used to find nearby allies in O(N) without a full NxN scan.
// Rebuilt once per SquadAI tick (1Hz) — not every frame.
class _BucketGrid {
    constructor(cellSize) {
        this._cell = cellSize;
        this._map = new Map(); // key: "cx,cy" → Enemy[]
    }

    /** Rebuild from current enemy array */
    build(enemies) {
        this._map.clear();
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.dead) continue;
            const key = this._key(e.x, e.y);
            let bucket = this._map.get(key);
            if (!bucket) { bucket = []; this._map.set(key, bucket); }
            bucket.push(e);
        }
    }

    /** Return enemies in same + adjacent cells (max 9 cells) */
    nearby(x, y) {
        const result = [];
        const cx = Math.floor(x / this._cell);
        const cy = Math.floor(y / this._cell);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const bucket = this._map.get(`${cx + dx},${cy + dy}`);
                if (bucket) {
                    for (let i = 0; i < bucket.length; i++) result.push(bucket[i]);
                }
            }
        }
        return result;
    }

    _key(x, y) {
        return `${Math.floor(x / this._cell)},${Math.floor(y / this._cell)}`;
    }
}

// ── SquadAI singleton class ───────────────────────────────────────────────────
class SquadAI {
    constructor() {
        // 1Hz update timer
        this._timer = 0;
        this._interval = (typeof BALANCE !== 'undefined' && BALANCE.ai && BALANCE.ai.squadInterval)
            ? BALANCE.ai.squadInterval : 1.0;

        // Bucket grid — cell size = squad coordination radius
        const coordR = (typeof BALANCE !== 'undefined' && BALANCE.ai && BALANCE.ai.squad)
            ? BALANCE.ai.squad.coordinationRadius : 300;
        this._grid = new _BucketGrid(coordR);

        // Role budget per squad (configurable via BALANCE.ai.squad)
        // e.g. of 10 nearby enemies: 2 shield, 2 flanker, rest assault
        this._roleBudget = {
            shield: 2,
            flanker: 3,
            support: 2,   // mages always stay as support regardless
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // update — call from game loop at any framerate, internally throttled to 1Hz
    // ─────────────────────────────────────────────────────────────────────────

    update(dt, enemies, player) {
        if (!enemies || !player) return;

        this._timer -= dt;
        if (this._timer > 0) return;
        this._timer = this._interval;

        // Rebuild spatial grid once per tick
        this._grid.build(enemies);

        // Assign roles to every living enemy
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.dead) continue;
            this._assignRole(e, enemies, player);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // _assignRole — core logic
    // ─────────────────────────────────────────────────────────────────────────

    _assignRole(enemy, enemies, player) {
        // Mages always support — no override needed
        if (enemy.type === 'mage') {
            enemy._squadRole = SQUAD_ROLE.SUPPORT;
            return;
        }

        // Tanks always shield
        if (enemy.type === 'tank') {
            enemy._squadRole = SQUAD_ROLE.SHIELD;
            return;
        }

        // Basic enemy — assign based on position relative to squad centroid
        const nearby = this._grid.nearby(enemy.x, enemy.y);

        // Count current roles in neighbourhood to respect budget
        // Note: SHIELD role is assigned only to tank-type enemies (above).
        //       Basic enemies can only be FLANKER or ASSAULT.
        let flankerCount = 0;
        for (let i = 0; i < nearby.length; i++) {
            const a = nearby[i];
            if (a === enemy || a.dead) continue;
            if (a._squadRole === SQUAD_ROLE.FLANKER) flankerCount++;
        }

        // Compute squad centroid from nearby allies
        let cx = 0, cy = 0, count = 0;
        for (let i = 0; i < nearby.length; i++) {
            const a = nearby[i];
            if (a.dead) continue;
            cx += a.x; cy += a.y; count++;
        }
        if (count > 0) { cx /= count; cy /= count; }
        else { cx = enemy.x; cy = enemy.y; }

        // Distance from centroid — outer enemies become flankers, inner become assault/shield
        const distFromCentroid = Math.hypot(enemy.x - cx, enemy.y - cy);
        const coordR = (typeof BALANCE !== 'undefined' && BALANCE.ai && BALANCE.ai.squad)
            ? BALANCE.ai.squad.coordinationRadius : 300;
        const isOuter = distFromCentroid > coordR * 0.5;

        // Assign role respecting budget
        if (isOuter && flankerCount < this._roleBudget.flanker) {
            enemy._squadRole = SQUAD_ROLE.FLANKER;
        } else {
            enemy._squadRole = SQUAD_ROLE.ASSAULT;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Static helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Call immediately after enemies.push(e) in spawnEnemies().
     * Sets default role so enemy has a role before first SquadAI tick.
     *
     * @param {EnemyBase} enemy
     */
    static tagOnSpawn(enemy) {
        if (!enemy) return;
        if (enemy.type === 'mage') { enemy._squadRole = SQUAD_ROLE.SUPPORT; return; }
        if (enemy.type === 'tank') { enemy._squadRole = SQUAD_ROLE.SHIELD; return; }
        enemy._squadRole = SQUAD_ROLE.ASSAULT; // basic default
    }
}

// ── Singleton instance ────────────────────────────────────────────────────────
const squadAI = new SquadAI();

// ══════════════════════════════════════════════════════════════
// 🌐 EXPORTS
// ══════════════════════════════════════════════════════════════
window.SquadAI = SquadAI;
window.squadAI = squadAI;
window.SQUAD_ROLE = SQUAD_ROLE;