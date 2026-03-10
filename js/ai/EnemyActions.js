'use strict';
/**
 * js/ai/EnemyActions.js  —  Week 2
 *
 * Static action library consumed by UtilityAI._applyDecision().
 * Each method accepts (enemy, context) and writes enemy._aiMoveX/_aiMoveY.
 *
 * DESIGN:
 * • Pure functions — no state, no allocation in hot path
 * • Never writes vx/vy directly (vacuum/sticky still own those)
 * • context object is reused by caller — never stored
 * • All methods guard for dead/missing refs
 *
 * LOAD ORDER:
 *   config.js → base.js → UtilityAI.js → [THIS FILE] → enemy.js
 *
 * ADDING A NEW ACTION:
 *   1. Add static method here
 *   2. Add AI_ACTION.MY_ACTION constant in UtilityAI.js (or locally below)
 *   3. Add utility function _utilMyAction() in UtilityAI
 *   4. Wire in UtilityAI._applyDecision() switch-case
 */

class EnemyActions {

    // ─────────────────────────────────────────────────────────────────────────
    // RETREAT  — move directly away from player, with wall-avoidance bias
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param {EnemyBase} enemy
     * @param {{ dx, dy, dist, player }} ctx
     */
    static retreat(enemy, ctx) {
        if (!enemy || enemy.dead) return;
        const { dx, dy, dist } = ctx;
        const norm = dist || 1;

        // Flee direction = away from player
        let mx = -(dx / norm);
        let my = -(dy / norm);

        // Wall-avoidance: nudge away from world map edges
        // Use MAP_CONFIG world dimensions — NOT CANVAS screen pixels
        const margin = 80;
        const W = (typeof MAP_CONFIG !== 'undefined' ? MAP_CONFIG.mapWidth : 3200);
        const H = (typeof MAP_CONFIG !== 'undefined' ? MAP_CONFIG.mapHeight : 3200);
        if (enemy.x < margin) mx += (margin - enemy.x) / margin;
        if (enemy.x > W - margin) mx -= (enemy.x - (W - margin)) / margin;
        if (enemy.y < margin) my += (margin - enemy.y) / margin;
        if (enemy.y > H - margin) my -= (enemy.y - (H - margin)) / margin;

        // Renormalize
        const len = Math.hypot(mx, my) || 1;
        enemy._aiMoveX = mx / len;
        enemy._aiMoveY = my / len;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FLANK  — perpendicular strafe, direction flips based on ally density
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param {EnemyBase} enemy
     * @param {{ dx, dy, dist, allies }} ctx
     *   allies: nearby EnemyBase[] from UtilityAI._nearbyAlliesCount context
     */
    static flank(enemy, ctx) {
        if (!enemy || enemy.dead) return;
        const { dx, dy, dist } = ctx;
        const norm = dist || 1;

        // Perpendicular vectors to player direction
        const perpX = dy / norm;
        const perpY = -(dx / norm);

        // Choose side: count allies to left vs right to spread the squad out
        // Left = positive perp, Right = negative perp
        let leftCount = 0, rightCount = 0;
        const allies = ctx.allies;
        if (allies && allies.length) {
            for (let i = 0; i < allies.length; i++) {
                const a = allies[i];
                if (a === enemy || a.dead) continue;
                // Dot product with perp vector tells which side ally is on
                const dot = (a.x - enemy.x) * perpX + (a.y - enemy.y) * perpY;
                if (dot > 0) leftCount++; else rightCount++;
            }
        } else {
            // Fallback: deterministic by ID (no Math.random in logic)
            leftCount = (enemy.id % 2 === 0) ? 0 : 1;
        }

        // Go to the less-crowded side so allies spread around the player
        const sign = (leftCount <= rightCount) ? 1 : -1;
        enemy._aiMoveX = perpX * sign;
        enemy._aiMoveY = perpY * sign;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SHIELD_WALL  — tanks cluster together, face the player as a unit
    // Week 3+ hook — call this from SquadAI when role === 'shield'
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Moves enemy toward the centroid of nearby allies, then faces player.
     * Useful for TankEnemy "shield wall" formation.
     *
     * @param {EnemyBase} enemy
     * @param {{ dx, dy, dist, allies }} ctx
     */
    static shieldWall(enemy, ctx) {
        if (!enemy || enemy.dead) return;
        const { dx, dy, dist, allies } = ctx;

        // Compute centroid of nearby allies
        let cx = enemy.x, cy = enemy.y, count = 1;
        if (allies && allies.length) {
            for (let i = 0; i < allies.length; i++) {
                const a = allies[i];
                if (a === enemy || a.dead) continue;
                cx += a.x; cy += a.y; count++;
            }
        }
        cx /= count; cy /= count;

        // Direction: blend toward centroid (cohesion) + toward player (aggression)
        const toCentX = cx - enemy.x;
        const toCentY = cy - enemy.y;
        const centDist = Math.hypot(toCentX, toCentY) || 1;
        const norm = dist || 1;

        // 60% cohesion (group up), 40% aggression (still advance on player)
        const mx = (toCentX / centDist) * 0.6 + (dx / norm) * 0.4;
        const my = (toCentY / centDist) * 0.6 + (dy / norm) * 0.4;
        const len = Math.hypot(mx, my) || 1;

        enemy._aiMoveX = mx / len;
        enemy._aiMoveY = my / len;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STRAFE_ORBIT  — mage-style circular orbit at fixed distance
    // Cleaner than the inline logic currently in MageEnemy.update()
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param {EnemyBase} enemy
     * @param {{ dx, dy, dist }} ctx
     * @param {number} orbitDist  — desired distance from player
     */
    static strafeOrbit(enemy, ctx, orbitDist) {
        if (!enemy || enemy.dead) return;
        const { dx, dy, dist } = ctx;
        const norm = dist || 1;
        const od = orbitDist || 260;

        // Tangent (CCW) = (-dy, dx) / dist
        const tanX = -dy / norm;
        const tanY = dx / norm;

        // Radial component: push in or out depending on distance from orbit ring
        const radialBias = (dist - od) / od; // positive = too far, negative = too close
        const radX = (dx / norm) * radialBias;
        const radY = (dy / norm) * radialBias;

        // Blend: orbit tangent + radial correction
        const mx = tanX * 0.7 + radX * 0.3;
        const my = tanY * 0.7 + radY * 0.3;
        const len = Math.hypot(mx, my) || 1;

        enemy._aiMoveX = mx / len;
        enemy._aiMoveY = my / len;
    }
}

// ══════════════════════════════════════════════════════════════
// 🌐 EXPORT
// ══════════════════════════════════════════════════════════════
window.EnemyActions = EnemyActions;