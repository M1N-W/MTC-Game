'use strict';
/**
 * js/entities/base.js
 * ════════════════════════════════════════════════
 * Root entity class, HealthComponent, and shared Stand-Aura/Afterimage system.
 * Everything in the game that moves or takes damage extends from here.
 *
 * Design notes:
 *   - Entity does NOT set hp/maxHp/dead — subclasses using HealthComponent expose
 *     these as proxy getters. Subclasses without it must set them manually.
 *   - applyPhysics() enforces DomainExpansion boundary lock when phase === 'active'.
 *   - _steerAroundObstacles() uses a 5-ray probe arc for smooth wall avoidance.
 *     O(obj_count × 5) per entity per frame — skip guard exits early if no objects.
 *   - _standAura_draw() and _standAura_update() are standalone functions, not methods,
 *     so they can be called from both PlayerRenderer and BossRenderer without coupling.
 *
 * Load order: FIRST script in index.html — all other entity files depend on this.
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.28   Entity                   base class (x, y, vx, vy, radius, angle)
 *  L.39   .applyPhysics()          integrate velocity + domain boundary clamp
 *  L.63   ._steerAroundObstacles() 5-ray AABB repulsion steering
 *  L.128  .isOnScreen()            viewport cull check via worldToScreen()
 *  L.141  STAND_SYMBOLS            math-symbol pool for aura ring
 *  L.155  HealthComponent          hp/maxHp/dead + hitFlashTimer component
 *  L.173  .tick()                  decay hitFlashTimer
 *  L.181  .takeDamage()            damage + flash + death callback
 *  L.198  .heal()                  clamp to maxHp (or custom cap)
 *  L.206  _standAura_update()      rotate aura, spawn afterimage ghosts
 *  L.249  _standAura_draw()        5-layer aura: afterimages, glow ring,
 *                                  symbol ring, core pulse, chromatic aberration
 *
 * ⚠️  hp/maxHp/dead are NOT on Entity.prototype — never read them from a bare
 *     Entity reference. Always access via the subclass or HealthComponent.
 * ⚠️  _steerAroundObstacles() must be called BEFORE applyPhysics() in enemy update().
 * ⚠️  _standAura_draw() calls ctx.save()/restore() internally — safe to call mid-pass,
 *     but must be called in the render pass only (no state side effects).
 * ════════════════════════════════════════════════
 */

/** 
 * ► Base Entity class
 * ► Stand-Aura & Afterimage shared helpers (_standAura_update, _standAura_draw)
 *
 * Load order: config.js → utils.js → audio.js → effects.js → weapons.js
 *             → map.js → ui.js → ai.js
 *             → entities/base.js          ← THIS FILE
 *             → entities/player.js
 *             → entities/enemy.js
 *             → entities/boss.js
 *             → game.js
 *
 * ────────────────────────────────────────────────────────────────
 * FIXES (Logic & Inheritance Audit — Zone 2)
 * ────────────────────────────────────────────────────────────────
 * ✅ WARN 2 — Naming Consistency: Renamed `entity.afterimages` to
 *             `entity.standGhosts` throughout _standAura_update and
 *             _standAura_draw, matching the rename in player.js where
 *             the property is declared on Player and PoomPlayer.
 */

// ════════════════════════════════════════════════════════════
// Base Entity
// ════════════════════════════════════════════════════════════
class Entity {
    constructor(x, y, radius) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.radius = radius;
        this.angle = 0;
        // hp / maxHp / dead are NOT set here — subclasses that use
        // HealthComponent define proxy getters that shadow these names.
        // Subclasses that don't use HealthComponent must set them manually.
    }

    applyPhysics(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Domain boundary lock — active only during Metrics-Major domain
        if (typeof DomainExpansion !== 'undefined' && DomainExpansion.phase === 'active') {
            const R = DomainExpansion._DC_RADIUS - (this.radius || 20);
            const d = Math.hypot(this.x, this.y);
            if (d > R) {
                const pa = Math.atan2(this.y, this.x);
                // Snap back to boundary
                this.x = Math.cos(pa) * R;
                this.y = Math.sin(pa) * R;
                // Cancel outward velocity component
                const dot = this.vx * Math.cos(pa) + this.vy * Math.sin(pa);
                if (dot > 0) {
                    this.vx -= dot * Math.cos(pa);
                    this.vy -= dot * Math.sin(pa);
                }
            }
        }
    }

    /**
     * Obstacle avoidance steering — call BEFORE applyPhysics() in each enemy update().
     *
     * Strategy: sample up to PROBE_COUNT rays in a forward arc. For each ray that
     * intersects a solid MapObject within PROBE_DIST, add a perpendicular repulsion
     * impulse proportional to (1 - distance/PROBE_DIST).  The result steers the
     * entity smoothly around walls and map objects without path-finding.
     *
     * Performance: skips entirely if mapSystem.objects is absent or empty.
     * Per-call cost is O(obj_count × PROBE_COUNT) ≈ O(200×5) = 1 000 ops/entity/frame
     * — acceptable for ≤ 40 enemies on screen.
     *
     * @param {number} dt delta-time (seconds)
     */
    _steerAroundObstacles(dt) {
        if (typeof mapSystem === 'undefined' || !mapSystem.objects || mapSystem.objects.length === 0) return;

        const PROBE_DIST = 80;   // px ahead to probe
        const FORCE = 520;  // steering impulse magnitude (px/s added to vx/vy)
        const PROBE_COUNT = 5;    // rays: centre ± 30° ± 60°
        const PROBE_ANGLES = [-1.047, -0.524, 0, 0.524, 1.047]; // radians offsets

        const speed = Math.hypot(this.vx, this.vy);
        if (speed < 10) return; // not moving — nothing to steer

        const moveAngle = Math.atan2(this.vy, this.vx);
        let steerX = 0, steerY = 0;

        for (let pi = 0; pi < PROBE_COUNT; pi++) {
            const probeAngle = moveAngle + PROBE_ANGLES[pi];
            const px = this.x + Math.cos(probeAngle) * PROBE_DIST;
            const py = this.y + Math.sin(probeAngle) * PROBE_DIST;

            for (let oi = 0; oi < window.mapSystem.objects.length; oi++) {
                const obj = window.mapSystem.objects[oi];
                if (!obj.solid) continue;
                // Quick AABB broad phase
                if (px < obj.x - 4 || px > obj.x + obj.w + 4 ||
                    py < obj.y - 4 || py > obj.y + obj.h + 4) continue;

                // Probe hit — compute repulsion from nearest AABB surface point
                const nearX = Math.max(obj.x, Math.min(px, obj.x + obj.w));
                const nearY = Math.max(obj.y, Math.min(py, obj.y + obj.h));
                const repDx = this.x - nearX;
                const repDy = this.y - nearY;
                const repDist = Math.hypot(repDx, repDy) || 1;
                const strength = Math.max(0, 1 - repDist / PROBE_DIST);

                steerX += (repDx / repDist) * strength;
                steerY += (repDy / repDist) * strength;
                break; // one object per ray is enough
            }
        }

        if (steerX !== 0 || steerY !== 0) {
            const mag = Math.hypot(steerX, steerY) || 1;
            this.vx += (steerX / mag) * FORCE * dt;
            this.vy += (steerY / mag) * FORCE * dt;
        }
    }

    isOnScreen(buffer = 120) {
        if (typeof worldToScreen !== 'function' || typeof CANVAS === 'undefined') return true;
        const s = worldToScreen(this.x, this.y);
        const r = (this.radius || 20) + buffer;
        return s.x + r > 0 &&
            s.x - r < CANVAS.width &&
            s.y + r > 0 &&
            s.y - r < CANVAS.height;
    }
}

// ════════════════════════════════════════════════════════════
// ✨ STAND-AURA & AFTERIMAGE SYSTEM
//    Shared helpers used by both Player and PoomPlayer.
//    Everything lives in this file — no external dependencies.
// ════════════════════════════════════════════════════════════

/** Floating math symbols that orbit the player aura. */
const STAND_SYMBOLS = ['∑', 'π', '∫', 'Δ', '0', '1', '∞', 'λ'];
const STAND_SYMBOL_COUNT = STAND_SYMBOLS.length;

/**
 * Call inside Player/PoomPlayer update() — manages aura rotation,
 * afterimage ghost-frame spawning, and alpha decay.
 * @param {Object} entity  — the player instance
 * @param {number} dt      — delta time in seconds
 */
// ════════════════════════════════════════════════════════════
// HealthComponent — ECS-style composition
// Used by: Entity subclasses via this.health = new HealthComponent(...)
// Proxy getters on the owner keep call sites backward-compatible.
// ════════════════════════════════════════════════════════════
class HealthComponent {
    /**
     * @param {number} maxHp
     * @param {number} [flashDuration=0.10] seconds — hit-flash duration
     */
    constructor(maxHp, flashDuration = 0.10) {
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.dead = false;
        this.flashDuration = flashDuration;
        this.hitFlashTimer = 0;   // counts DOWN from flashDuration → 0
        this._onDeathCb = null; // set by owner: fn(owner, killer)
    }

    /** @param {number} dt seconds */
    tick(dt) {
        if (this.hitFlashTimer > 0)
            this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    }

    /**
     * Apply damage. Triggers flash + death callback.
     * @param {number} amt        raw damage (already finalised)
     * @param {*}      [killer]   player reference — forwarded to _onDeathCb
     * @returns {boolean} true if this hit killed the entity
     */
    takeDamage(amt, killer) {
        if (this.dead) return false;
        this.hp -= amt;
        this.hitFlashTimer = this.flashDuration;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            if (this._onDeathCb) this._onDeathCb(killer);
            return true;
        }
        return false;
    }

    /**
     * @param {number} amt
     * @param {number} [cap] defaults to maxHp
     */
    heal(amt, cap) {
        if (this.dead) return;
        this.hp = Math.min(cap ?? this.maxHp, this.hp + amt);
    }

    /** @returns {boolean} */
    get isAlive() { return !this.dead; }
}
function _standAura_update(entity, dt) {
    const ts = (typeof window !== 'undefined' && window.timeScale !== undefined)
        ? window.timeScale : 1;

    // Aura rotates faster in slow-mo for extra drama
    entity.auraRotation += 0.05 * ts;
    entity._auraFrame = ((entity._auraFrame || 0) + 1);

    const speed = Math.hypot(entity.vx, entity.vy);
    const inSlowmo = ts < 1.0;
    const active = speed > 5 || inSlowmo;

    // Spawn a ghost frame every 3-5 ticks when active
    const interval = 3 + Math.floor(Math.random() * 3);
    if (active && entity._auraFrame % interval === 0) {
        // Hard cap at 20 to prevent unbounded growth (PERF guardrail)
        if (entity.standGhosts.length < 20) {
            entity.standGhosts.push({
                x: entity.x,
                y: entity.y,
                angle: entity.angle,
                alpha: 0.75
            });
        }
    }

    // Decay — swap-and-pop O(1) instead of splice O(n)  [BUG-9 FIX]
    const ghosts = entity.standGhosts;
    for (let i = ghosts.length - 1; i >= 0; i--) {
        ghosts[i].alpha -= dt * 2.5;
        if (ghosts[i].alpha <= 0) {
            ghosts[i] = ghosts[ghosts.length - 1];
            ghosts.pop();
        }
    }
}

/**
 * Call at the START of Player/PoomPlayer draw(), before the body is drawn.
 * Renders: ghost silhouettes → rotating symbol ring → optional slow-mo FX.
 * @param {Object} entity  — the player instance
 * @param {string} charId  — 'kao' | 'poom'
 */
function _standAura_draw(entity, charId) {
    const ts = (typeof window !== 'undefined' && window.timeScale !== undefined)
        ? window.timeScale : 1;
    const inSlowmo = ts < 1.0;
    const isKao = (charId === 'kao' || (charId !== 'poom' && charId !== 'auto'));

    // ── Character colour identity ─────────────────────────────────────
    //   Kao  → น้ำเงิน/ฟ้า  #3b82f6  (match body + clone theme)
    //   Poom → เขียวมรกต   #10b981  (match rice/naga/body theme)
    //   Auto → handled by PlayerRenderer._drawAutoAura (never reaches here)
    //   fallback → Kao blue
    const auraCol = isKao ? '#3b82f6' : '#10b981';
    const ghostCol = isKao ? 'rgba(59,130,246,0.55)' : 'rgba(16,185,129,0.55)';
    // Bullet Time tint — ฟ้าไฟฟ้า (Kao) / เขียวสว่าง (Poom)
    const slowmoCol = isKao ? '#00e5ff' : '#6ee7b7';

    // Base orbit radius — 1.5× during slow-mo
    const BASE_R = 46;
    const auraR = inSlowmo ? BASE_R * 1.5 : BASE_R;

    const screen = worldToScreen(entity.x, entity.y);

    // ══ 1. Afterimage ghost silhouettes ═══════════════════════
    for (const img of entity.standGhosts) {
        const gs = worldToScreen(img.x, img.y);
        CTX.save();
        CTX.translate(gs.x, gs.y);
        CTX.rotate(img.angle);
        CTX.globalAlpha = Math.max(0, img.alpha) * 0.6;

        if (inSlowmo) {
            // character-specific slowmo tint
            CTX.fillStyle = slowmoCol;
            CTX.shadowBlur = 14;
            CTX.shadowColor = slowmoCol;
        } else {
            CTX.fillStyle = ghostCol;
            CTX.shadowBlur = 8;
            CTX.shadowColor = auraCol;
        }

        // Ghost body — simplified rounded silhouette matching player body rect
        CTX.beginPath();
        CTX.roundRect(-15, -12, 30, 24, 8);
        CTX.fill();

        // Inner glow core
        CTX.globalAlpha *= 0.4;
        CTX.fillStyle = inSlowmo ? slowmoCol : auraCol;
        CTX.beginPath();
        CTX.roundRect(-9, -7, 18, 14, 5);
        CTX.fill();

        CTX.restore();
    }

    // ══ 2. Soft inner glow ring (always visible) ══════════════
    const ringPulse = 0.10 + Math.sin(entity.auraRotation * 2) * 0.05;
    CTX.save();
    CTX.globalAlpha = ringPulse * (inSlowmo ? 1.8 : 1.0);
    CTX.beginPath();
    CTX.arc(screen.x, screen.y, auraR * 0.52, 0, Math.PI * 2);
    CTX.strokeStyle = auraCol;
    CTX.lineWidth = inSlowmo ? 3.5 : 1.8;
    CTX.shadowBlur = inSlowmo ? 30 : 14;
    CTX.shadowColor = auraCol;
    CTX.stroke();
    CTX.restore();

    // ══ 3. Rotating math-symbol ring ══════════════════════════
    /**
     * Inner draw routine — called once normally, 3× with RGB offsets in slow-mo.
     * @param {number} ox  — screen-space X offset (for chromatic aberration)
     * @param {number} oy  — screen-space Y offset
     * @param {string|null} colOverride — colour to use instead of auraCol
     */
    const drawSymbolRing = (ox, oy, colOverride) => {
        const col = colOverride || auraCol;
        for (let i = 0; i < STAND_SYMBOL_COUNT; i++) {
            const baseAngle = (i / STAND_SYMBOL_COUNT) * Math.PI * 2;
            const orbit = baseAngle + entity.auraRotation;

            // Each symbol bobs up-down on its own sine wave → "floating" feel
            const bob = Math.sin(entity.auraRotation * 2.5 + i * 0.85) * 6;
            const r = auraR + bob;

            const sx = screen.x + ox + Math.cos(orbit) * r;
            const sy = screen.y + oy + Math.sin(orbit) * r;

            // Alpha pulsation per-symbol, offset in phase
            const pulse = 0.50 + Math.sin(entity.auraRotation * 3.2 + i * 1.1) * 0.38;

            CTX.save();
            CTX.globalAlpha = pulse * (inSlowmo ? 0.95 : 0.72);
            CTX.translate(sx, sy);
            // Symbols face outward (tangential rotation = orbit + 90°)
            CTX.rotate(orbit + Math.PI / 2);
            CTX.fillStyle = col;
            CTX.shadowBlur = inSlowmo ? 22 : 11;
            CTX.shadowColor = col;
            CTX.font = `bold ${10 + Math.round(pulse * 5)}px monospace`;
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            CTX.fillText(STAND_SYMBOLS[i % STAND_SYMBOL_COUNT], 0, 0);
            CTX.restore();
        }
    };

    if (inSlowmo) {
        // ── Chromatic Aberration: 3 offset passes — สีต่างกันตาม charId ──
        // Kao  → ฟ้า / น้ำเงิน / ขาวอมฟ้า
        // Poom → เขียว / มรกต / เหลืองสด
        CTX.save();
        CTX.globalAlpha = 0.40;
        if (isKao) {
            drawSymbolRing(-2.5, 0, '#0ea5e9');  // sky blue (left)
            drawSymbolRing(2.5, 0, '#00e5ff');  // cyan     (right)
            drawSymbolRing(0, -2.5, '#a5f3fc');  // pale blue (up)
        } else {
            drawSymbolRing(-2.5, 0, '#34d399');  // emerald  (left)
            drawSymbolRing(2.5, 0, '#6ee7b7');  // mint     (right)
            drawSymbolRing(0, -2.5, '#bbf7d0');  // pale mint (up)
        }
        CTX.restore();
    }

    // Main symbol pass (always on top)
    drawSymbolRing(0, 0, null);
}
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.Entity = Entity;
window.EntityBase = Entity;   // alias for Debug.html check
window._standAura_update = _standAura_update;
window._standAura_draw = _standAura_draw;
window.STAND_SYMBOLS = STAND_SYMBOLS;
window.HealthComponent = HealthComponent;