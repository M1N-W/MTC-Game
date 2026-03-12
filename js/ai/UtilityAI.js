'use strict';
/**
 * js/ai/UtilityAI.js
 * ════════════════════════════════════════════════════════════════
 * Per-enemy utility-based AI — scores actions and picks the best one at 2Hz.
 * Instantiated once per EnemyBase in constructor; ticked from enemy.update().
 *
 * Decision flow per tick:
 *   gather context (dx/dy/dist/hpRatio/allies)
 *   → score: _utilAttack / _utilRetreat / _utilFlank  (0–1, personality-weighted)
 *   → SquadAI role override (flanker → FLANK, shield → SHIELD_WALL, retreat always wins)
 *   → _applyDecision() → writes _aiMoveX/_aiMoveY on enemy
 *
 * Design:
 *  • 2Hz tick via _aiTimer accumulator — never performance.now()
 *  • Zero allocation in tick() hot path (_decision object reused, _nearbyAlliesList
 *    cleared with .length = 0 — no new array)
 *  • Writes _aiMoveX/_aiMoveY only — never vx/vy (vacuum/sticky own those)
 *  • Personality pulled from BALANCE.ai.personalities; fallback table if missing
 *  • Degrades gracefully if EnemyActions.js not loaded (inline fallbacks)
 *
 * Load order:
 *   config.js → base.js → [THIS FILE] → EnemyActions.js → SquadAI.js → enemy.js
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────
 *  L.42  _DEFAULT_PERSONALITIES    fallback if BALANCE.ai.personalities missing
 *  L.48  AI_ACTION constants       'attack'|'retreat'|'flank'|'shield_wall'|'idle'
 *
 *  L.52  class UtilityAI
 *          L.62  constructor(enemy, personalityType)
 *          L.88  tick(dt, player, enemies)     2Hz main loop
 *
 *  ── Utility scorers (0–1) ──────────────────────────────────────
 *          L.131 _utilAttack(dist, hpRatio)
 *          L.141 _utilRetreat(dist, hpRatio)   only non-zero when HP < threshold
 *          L.151 _utilFlank(dist, hpRatio)     only non-zero when allies nearby
 *
 *  ── Execution ──────────────────────────────────────────────────
 *          L.161 _applyDecision(action, dx, dy, dist, player)
 *                  delegates to EnemyActions.* with inline fallback
 *  ⚠️  _nearbyAlliesList must be cleared with .length = 0 (never reassign [])
 *      to avoid GC allocation — see dispose() for correct teardown pattern.
 *
 *          L.196 dispose()         call on enemy death — clears refs for GC
 *          L.200 currentAction     getter → last decided AI_ACTION string
 *          L.201 nearbyAllies      getter → int count from last tick
 *
 *  L.206 _actionCfg(name)         safe BALANCE.ai.actions lookup with defaults
 *  L.218 window.UtilityAI / window.AI_ACTION exports
 *
 * ════════════════════════════════════════════════════════════════
 */

// ── Personality table (mirrors BALANCE.ai.personalities, used as fallback) ──
const _DEFAULT_PERSONALITIES = {
    basic: { aggression: 0.6, caution: 0.2, teamwork: 0.3 },
    tank: { aggression: 0.8, caution: 0.1, teamwork: 0.5 },
    mage: { aggression: 0.3, caution: 0.8, teamwork: 0.2 },
};

// ── Action names (string constants — avoid typos) ─────────────────────────
const AI_ACTION = {
    ATTACK: 'attack',
    RETREAT: 'retreat',
    FLANK: 'flank',
    SHIELD_WALL: 'shield_wall',
    IDLE: 'idle',
};

class UtilityAI {
    /**
     * @param {Entity}  enemy          — the owning enemy instance
     * @param {string}  personalityType — 'basic' | 'tank' | 'mage'
     */
    constructor(enemy, personalityType) {
        this._enemy = enemy;
        this._type = personalityType || 'basic';

        // Pull personality from BALANCE if available, else use default table
        const pTable = (typeof BALANCE !== 'undefined' && BALANCE.ai && BALANCE.ai.personalities)
            ? BALANCE.ai.personalities
            : _DEFAULT_PERSONALITIES;
        this._personality = pTable[this._type] || pTable.basic;

        // Decision timer — accumulates dt (seconds)
        this._aiTimer = Math.random() * 0.5; // stagger initial decisions across enemies

        // Cached decision object — reused every tick (zero allocation)
        this._decision = { action: AI_ACTION.ATTACK, targetX: 0, targetY: 0 };

        // Nearby-allies state — pre-allocated, cleared with .length = 0 each tick
        this._nearbyAlliesCount = 0;
        this._nearbyAlliesList = [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC — called every frame from enemy.update()
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Main tick — throttled to BALANCE.ai.decisionInterval (default 0.5s).
     * Writes _aiMoveX/_aiMoveY on the enemy for movement blend.
     *
     * @param {number}   dt       — delta time in seconds
     * @param {Entity}   player   — window.player
     * @param {Entity[]} enemies  — window.enemies (for ally count)
     */
    tick(dt, player, enemies) {
        if (!player || this._enemy.dead) return;

        this._aiTimer -= dt;
        if (this._aiTimer > 0) return; // not yet time to decide

        const interval = (typeof BALANCE !== 'undefined' && BALANCE.ai)
            ? BALANCE.ai.decisionInterval
            : 0.5;
        this._aiTimer = interval;

        // ── Gather context ──────────────────────────────────────────────────
        const e = this._enemy;
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const distToPlayer = Math.hypot(dx, dy) || 1;
        const hpRatio = e.hp / (e.maxHp || 1);

        // Cheap ally scan — iterate once, collect list for EnemyActions context
        this._nearbyAlliesCount = 0;
        this._nearbyAlliesList.length = 0;
        const coordRadius = (typeof BALANCE !== 'undefined' && BALANCE.ai && BALANCE.ai.squad)
            ? BALANCE.ai.squad.coordinationRadius
            : 300;
        if (enemies) {
            for (let i = 0; i < enemies.length; i++) {
                const ally = enemies[i];
                if (ally === e || ally.dead) continue;
                if (Math.hypot(ally.x - e.x, ally.y - e.y) < coordRadius) {
                    this._nearbyAlliesCount++;
                    this._nearbyAlliesList.push(ally);
                }
            }
        }

        // ── Calculate utilities ─────────────────────────────────────────────
        const uAttack = this._utilAttack(distToPlayer, hpRatio);
        const uRetreat = this._utilRetreat(distToPlayer, hpRatio);
        const uFlank = this._utilFlank(distToPlayer, hpRatio);

        // ── Select best action ──────────────────────────────────────────────
        let best = AI_ACTION.ATTACK;
        let bestU = uAttack;
        if (uRetreat > bestU) { best = AI_ACTION.RETREAT; bestU = uRetreat; }
        if (uFlank > bestU) { best = AI_ACTION.FLANK; bestU = uFlank; }

        // ── Squad role override — SquadAI may have assigned a role this tick ──
        // Roles take priority over utility scores for formation coherence
        const role = this._enemy._squadRole;
        if (role === 'flanker' && best !== AI_ACTION.RETREAT) best = AI_ACTION.FLANK;
        if (role === 'shield' && best !== AI_ACTION.RETREAT) best = AI_ACTION.SHIELD_WALL;

        this._decision.action = best;

        // ── Write move override onto enemy ──────────────────────────────────
        this._applyDecision(best, dx, dy, distToPlayer, player);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UTILITY FUNCTIONS  (return 0–1, personality-weighted)
    // ─────────────────────────────────────────────────────────────────────────

    _utilAttack(dist, hpRatio) {
        const cfg = _actionCfg('attack');
        // High aggression + healthy + player is close → want to attack
        let u = cfg.base * this._personality.aggression;
        // Closer = more urgency to attack (mage stays back → naturally lower)
        u *= Math.max(0.2, 1 - dist / 800);
        // HP barely affects attack desire for aggressive types
        u *= (0.6 + hpRatio * 0.4);
        return Math.min(1, u);
    }

    _utilRetreat(dist, hpRatio) {
        const cfg = _actionCfg('retreat');
        const hpThresh = cfg.hpThreshold; // default 0.3
        // Only meaningful when low on HP — caution personality amplifies
        if (hpRatio > hpThresh + 0.1) return 0;
        let u = cfg.base * this._personality.caution;
        // The lower the HP, the stronger the retreat urge
        u *= Math.max(0, (hpThresh + 0.1 - hpRatio) / (hpThresh + 0.1));
        return Math.min(1, u);
    }

    _utilFlank(dist, hpRatio) {
        const cfg = _actionCfg('flank');
        // Flanking is useful at medium distance with allies nearby
        if (this._nearbyAlliesCount < 1) return 0;
        const optDist = cfg.optimalDist; // default 220
        const distScore = 1 - Math.min(1, Math.abs(dist - optDist) / optDist);
        let u = cfg.base * this._personality.teamwork * distScore;
        u *= hpRatio; // don't flank when near death
        return Math.min(1, u);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DECISION EXECUTION — writes _aiMoveX/_aiMoveY on the enemy
    // ─────────────────────────────────────────────────────────────────────────

    _applyDecision(action, dx, dy, dist, player) {
        const e = this._enemy;
        const norm = dist || 1;

        // Shared context — reused each call, never stored by EnemyActions
        const ctx = {
            dx, dy, dist,
            player,
            allies: this._nearbyAlliesList,
        };

        // Guard: EnemyActions.js may not be loaded yet (degrades gracefully)
        const EA = (typeof EnemyActions !== 'undefined') ? EnemyActions : null;

        switch (action) {
            case AI_ACTION.ATTACK:
                e._aiMoveX = dx / norm;
                e._aiMoveY = dy / norm;
                break;

            case AI_ACTION.RETREAT:
                if (EA) EnemyActions.retreat(e, ctx);
                else { e._aiMoveX = -(dx / norm); e._aiMoveY = -(dy / norm); }
                break;

            case AI_ACTION.FLANK:
                if (EA) EnemyActions.flank(e, ctx);
                else {
                    const sign = (e.id % 2 === 0) ? 1 : -1;
                    e._aiMoveX = (dy / norm) * sign;
                    e._aiMoveY = -(dx / norm) * sign;
                }
                break;

            case AI_ACTION.SHIELD_WALL:
                if (EA) EnemyActions.shieldWall(e, ctx);
                else { e._aiMoveX = dx / norm; e._aiMoveY = dy / norm; } // fallback = advance
                break;

            default:
                e._aiMoveX = 0;
                e._aiMoveY = 0;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACCESSORS
    // ─────────────────────────────────────────────────────────────────────────

    get currentAction() { return this._decision.action; }
    get nearbyAllies() { return this._nearbyAlliesCount; }

    /** Call on enemy death to release references (GC) */
    dispose() {
        this._enemy = null;
        this._nearbyAlliesList.length = 0; // clear in-place — no allocation
    }
}

// ── Helper: safe action config lookup ────────────────────────────────────────
function _actionCfg(name) {
    const defaults = {
        attack: { base: 1.0 },
        retreat: { base: 0.8, hpThreshold: 0.3 },
        flank: { base: 0.6, optimalDist: 220 },
    };
    if (typeof BALANCE !== 'undefined' && BALANCE.ai && BALANCE.ai.actions && BALANCE.ai.actions[name]) {
        return { ...defaults[name], ...BALANCE.ai.actions[name] };
    }
    return defaults[name];
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.UtilityAI = UtilityAI;
window.AI_ACTION = AI_ACTION;