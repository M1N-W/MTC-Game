'use strict';
/**
 * 💥 MTC: ENHANCED EDITION - Effects System
 * Particles, floating text, hit markers, and special effects
 *
 * WEATHER SYSTEM (v9 — unchanged):
 *   ✅ WeatherSystem class — atmospheric rain & snow effects
 *   ✅ Rain: spawns at screen top, falls with speed + wind drift, drawn as thin blue lines
 *   ✅ Snow: spawns at screen top, falls slowly with sin() horizontal sway, drawn as white circles
 *   ✅ Optimized: MAX_PARTICLES cap (200), off-screen culling, efficient array reuse
 *   ✅ API: weatherSystem.setWeather('rain'|'snow'|'none'), update(dt, camera), draw()
 *
 * HIT MARKER SYSTEM (v10 — Combat Feedback pass):
 *   ✅ HitMarker class — short-lived X-crosshair at projectile impact point
 *   ✅ HitMarkerSystem — manages pool, update loop, draw loop
 *   ✅ Normal hits: white crosshair, 0.30 s lifetime, slight expand-on-fade
 *   ✅ Crit hits:   golden crosshair, 0.40 s lifetime, larger arms, glow
 *   ✅ spawnHitMarker(x, y, isCrit) — global convenience wrapper
 *   ✅ var hitMarkerSystem — global singleton
 *   ✅ INTEGRATED: hitMarkerSystem.update(dt) + .draw() wired into game.js loop
 *
 * GLITCH WAVE (v8 — unchanged):
 *   ✅ drawGlitchEffect(intensity, controlsInverted) — top-level export
 *
 * PERFORMANCE (v12 — Swap-and-pop + OrbitalParticle Pool pass):
 *   ✅ ParticleSystem.MAX_PARTICLES = 150  — hard cap; oldest particle evicted
 *   ✅ Particle.draw(): shadowBlur skipped for particles with rendered radius < 3 px
 *
 *   ✅ OBJECT POOL — Particle (up to 300 instances recycled, zero `new` after warm-up):
 *        Particle._pool[]         static array of waiting instances
 *        Particle.acquire(...)    pulls from pool or allocates; always calls reset()
 *        Particle.reset(...)      re-initialises a live instance in-place
 *        Particle.release()       returns the instance to the pool for reuse
 *        ParticleSystem.spawn()   → Particle.acquire() instead of `new Particle()`
 *        ParticleSystem.update()  → swap-and-pop O(1) + dead particles returned via p.release()
 *        ParticleSystem.clear()   → all particles released before array is emptied
 *
 *   ✅ OBJECT POOL — FloatingText (up to 80 instances recycled):
 *        Same pattern: FloatingText._pool[], acquire(), reset(), release()
 *        FloatingTextSystem.update() → swap-and-pop O(1)
 *
 *   ✅ OBJECT POOL — OrbitalParticle (up to 40 instances recycled) [NEW v12]:
 *        OrbitalParticle._pool[], acquire(), reset(), release()
 *        OrbitalParticleSystem.update()     → swap-and-pop O(1) + pool release
 *        OrbitalParticleSystem.spawnParticle() → OrbitalParticle.acquire()
 *        OrbitalParticleSystem.clear()      → releases all live particles to pool
 *        OrbitalParticle.draw()             → viewport cull + shadowBlur guard
 *
 *   ✅ SWAP-AND-POP O(1) everywhere [NEW v12]:
 *        ParticleSystem.update(), FloatingTextSystem.update(),
 *        HitMarkerSystem.update(), WeatherSystem.update(),
 *        OrbitalParticleSystem.update() — all replaced splice(i,1) with swap-and-pop.
 *        Z-order impact: none (particles/texts/markers are additive visuals, no depth ordering).
 *
 *   ✅ VIEWPORT CULL — Particle.draw() + OrbitalParticle.draw() [OrbitalParticle new v12]:
 *        Canvas-bounds check before any ctx calls.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Particle System
// ──────────────────────────────────────────────────────────────────────────────
class Particle {
    // ── Static Object Pool ─────────────────────────────────────────────────────
    // At 150 cap + 60 FPS, without pooling the engine allocates and immediately
    // discards ~9 000 Particle objects per second, causing GC pauses every few
    // seconds. The pool keeps up to MAX_POOL dead instances warm so spawn() never
    // calls `new` after the first warm-up period.
    static _pool = [];
    static MAX_POOL = 300;

    constructor(x, y, vx, vy, color, size, lifetime, type = 'circle', data = {}) {
        // Delegate to reset() so the pool path and the constructor path share
        // exactly one code path for initialisation.
        this.reset(x, y, vx, vy, color, size, lifetime, type, data);
    }

    /**
     * Re-initialise a pooled (or brand-new) instance with fresh state.
     * Called by acquire() on recycled objects and implicitly by the constructor.
     * @returns {Particle} this, for fluent chaining from acquire()
     */
    reset(x, y, vx, vy, color, size, lifetime, type = 'circle', data = {}) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = lifetime;
        this.maxLife = lifetime;
        this.type = type; // 'circle', 'steam', 'binary', 'afterimage'
        this.data = data; // Custom data (rotation for afterimage, char for binary)
        return this;
    }

    /**
     * Pull a ready-to-use instance from the pool (or allocate a fresh one),
     * then reset it with the supplied parameters.
     *
     * ─── Usage ───────────────────────────────────────────────────────────────
     *   // Instead of: this.particles.push(new Particle(x, y, …));
     *   this.particles.push(Particle.acquire(x, y, …));
     */
    static acquire(x, y, vx, vy, color, size, lifetime, type = 'circle', data = {}) {
        if (Particle._pool.length > 0) {
            return Particle._pool.pop().reset(x, y, vx, vy, color, size, lifetime, type, data);
        }
        return new Particle(x, y, vx, vy, color, size, lifetime, type, data);
    }

    /**
     * Return this dead instance to the pool so it can be reused.
     * Called by ParticleSystem.update() when life ≤ 0 and by clear().
     *
     * The data reference is nulled to prevent the pool from accidentally
     * retaining large object graphs through stale data references.
     */
    release() {
        this.data = {}; // release any object-graph ref held in data
        if (Particle._pool.length < Particle.MAX_POOL) {
            Particle._pool.push(this);
        }
        // If pool is full the instance is simply abandoned to GC — which is
        // fine: the pool is already saturated and no steady-state churn occurs.
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Apply friction based on type
        if (this.type === 'steam') {
            this.vx *= 0.90; // Higher drag for steam
            this.vy *= 0.90;
        } else if (this.type === 'afterimage') {
            // Afterimages are stationary or barely drift
            this.vx *= 0.8;
            this.vy *= 0.8;
        } else {
            // Standard friction
            this.vx *= 0.95;
            this.vy *= 0.95;
        }

        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);

        // ── PERF: Viewport cull ──────────────────────────────────────────────
        // Skip every canvas API call for particles that lie outside the visible
        // area. This matters most during boss-death or glitch-wave explosions
        // where 80+ debris particles fly off-screen simultaneously.
        // Padding = size + 4 px prevents visible pop-in at the canvas edges.
        if (typeof CANVAS !== 'undefined') {
            const pad = this.size + 4;
            if (screen.x < -pad || screen.x > CANVAS.width + pad ||
                screen.y < -pad || screen.y > CANVAS.height + pad) return;
        }

        const alpha = this.life / this.maxLife;

        // Rendered radius — if the particle is essentially invisible, skip
        const renderedRadius = this.size * alpha;

        // Skip check for very tiny particles, unless it's binary/text which works differently
        if (this.type !== 'binary' && renderedRadius < 0.4) return;

        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;

        // ── TYPE: BINARY (0/1 Strings) ────────────────────────
        if (this.type === 'binary') {
            CTX.font = `bold ${Math.max(10, this.size)}px monospace`;
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            // Pulsing effect for binary
            CTX.shadowBlur = 4;
            CTX.shadowColor = this.color;
            CTX.fillText(this.data.char || (Math.random() > 0.5 ? '1' : '0'), screen.x, screen.y);
            CTX.shadowBlur = 0;
            CTX.globalAlpha = 1;
            return;
        }

        // ── TYPE: AFTERIMAGE (Player Clone) ───────────────────
        if (this.type === 'afterimage') {
            CTX.save();
            CTX.translate(screen.x, screen.y);
            if (this.data.rotation) CTX.rotate(this.data.rotation);

            // Draw a ghost silhouette (rectangle approximation if sprite not available)
            CTX.strokeStyle = this.color;
            CTX.lineWidth = 2;
            CTX.shadowBlur = 10;
            CTX.shadowColor = this.color;

            // Draw hollow box representing the afterimage
            const w = this.size;
            const h = this.size;
            CTX.strokeRect(-w / 2, -h / 2, w, h);

            // Fill slightly
            CTX.globalAlpha = alpha * 0.3;
            CTX.fillRect(-w / 2, -h / 2, w, h);

            CTX.restore();
            CTX.globalAlpha = 1;
            return;
        }

        // ── TYPE: STEAM (Rising Smoke) ────────────────────────
        if (this.type === 'steam') {
            // Steam grows slightly as it fades
            const growth = 1 + (1 - alpha);
            const r = renderedRadius * growth;

            CTX.beginPath();
            CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2);
            CTX.fill();
            CTX.globalAlpha = 1;
            return;
        }

        // ── TYPE: STANDARD CIRCLE ─────────────────────────────
        // PERF: skip shadowBlur for small particles
        const useShadow = renderedRadius >= 3;
        if (useShadow) {
            CTX.shadowBlur = 4;
            CTX.shadowColor = this.color;
        }

        CTX.beginPath();
        CTX.arc(screen.x, screen.y, renderedRadius, 0, Math.PI * 2);
        CTX.fill();

        if (useShadow) {
            CTX.shadowBlur = 0;
        }

        CTX.globalAlpha = 1;
    }
}

class ParticleSystem {
    // ── Hard cap ──────────────────────────────────────────────
    // Keeping ≤ 150 particles at all times bounds the per-frame
    // draw cost regardless of how many spawnParticles() calls happen
    // in a single frame (boss death, glitch wave explosion, etc.).
    // The oldest particle (index 0 after FIFO shift) is removed first
    // so the most recently spawned, visually prominent particles survive.
    static MAX_PARTICLES = 150;

    constructor() {
        this.particles = [];
    }

    /**
     * Spawns particles.
     * @param {number} x World X
     * @param {number} y World Y
     * @param {number} count Number of particles
     * @param {string} color CSS color string
     * @param {string} type 'circle' | 'steam' | 'binary' | 'afterimage'
     * @param {object} options { rotation, speedScale, spread }
     */
    spawn(x, y, count, color, type = 'circle', options = {}) {
        for (let i = 0; i < count; i++) {
            let vx, vy, size, lifetime, data = {};

            if (type === 'steam') {
                // Rise upward with random drift
                const angle = -Math.PI / 2 + (Math.random() - 0.5); // Upward cone
                const speed = rand(20, 80);
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
                size = rand(4, 8);
                lifetime = rand(0.5, 1.2);
            }
            else if (type === 'binary') {
                // Explode outward
                const angle = Math.random() * Math.PI * 2;
                const speed = rand(50, 250);
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
                size = rand(12, 16); // Font size
                lifetime = rand(0.4, 0.9);
                data = { char: Math.random() > 0.5 ? '1' : '0' };
            }
            else if (type === 'afterimage') {
                // Stationary or very slow drift
                vx = 0;
                vy = 0;
                size = options.size || 30; // Player size
                lifetime = 0.25; // Very short life
                data = { rotation: options.rotation || 0 };
            }
            else {
                // Standard 'circle' explosion
                const angle = Math.random() * Math.PI * 2;
                const speed = rand(100, 400);
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
                size = rand(2, 5);
                lifetime = rand(0.3, 0.8);
            }

            this.particles.push(Particle.acquire(x, y, vx, vy, color, size, lifetime, type, data));

            // Evict oldest particle if we exceed the cap
            while (this.particles.length > ParticleSystem.MAX_PARTICLES) {
                // Release evicted instance back to pool before discarding the reference.
                this.particles.shift().release();
            }
        }
    }

    update(dt) {
        // ── PERF: swap-and-pop O(1) instead of splice O(n) ──────────────────
        // Particle draw order is irrelevant (additive blending, no depth),
        // so swapping the dead entry with the tail before popping is safe.
        const arr = this.particles;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt)) {
                arr[i].release();          // return to pool
                arr[i] = arr[arr.length - 1];
                arr.pop();
                // don't decrement i — newly swapped item at i must be checked
            } else {
                i--;
            }
        }
    }

    draw() {
        // ── STABILITY FIX (Zone 3): Guard against uninitialised canvas context.
        if (typeof CTX === 'undefined' || !CTX) return;
        for (let particle of this.particles) {
            particle.draw();
        }
    }

    clear() {
        // Return every live particle to the pool before discarding the array.
        // This ensures clear() (called on startGame / endGame) doesn't throw
        // away a full warm pool of 150 pre-constructed instances.
        for (const p of this.particles) p.release();
        this.particles = [];
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Floating Text System
// ──────────────────────────────────────────────────────────────────────────────
class FloatingText {
    // ── Static Object Pool ─────────────────────────────────────────────────────
    // Floating texts are smaller in count (< 40 alive at once) but they each
    // hold a string reference — recycling them avoids repeated string-object
    // allocation during heavy combat (boss fight + drone + weapons = many texts/sec).
    static _pool = [];
    static MAX_POOL = 80;

    constructor(text, x, y, color, size = 20) {
        this.reset(text, x, y, color, size);
    }

    /**
     * Re-initialise a pooled instance.  Resets vy and life to their defaults.
     * @returns {FloatingText} this, for chaining from acquire()
     */
    reset(text, x, y, color, size = 20) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.life = 1.5;
        this.vy = -80;
        this._font = null;
        return this;
    }

    /**
     * Pull from pool (or allocate) and reset with the given parameters.
     * Use this instead of `new FloatingText(...)`.
     */
    static acquire(text, x, y, color, size = 20) {
        if (FloatingText._pool.length > 0) {
            return FloatingText._pool.pop().reset(text, x, y, color, size);
        }
        return new FloatingText(text, x, y, color, size);
    }

    /**
     * Return this dead instance to the pool.
     * The text string ref is cleared to allow GC of any large strings.
     */
    release() {
        this.text = '';
        if (FloatingText._pool.length < FloatingText.MAX_POOL) {
            FloatingText._pool.push(this);
        }
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);

        // Viewport cull — skip off-screen texts entirely
        if (typeof CANVAS !== 'undefined') {
            const pad = this.size * 2;
            if (screen.x < -pad || screen.x > CANVAS.width + pad ||
                screen.y < -pad || screen.y > CANVAS.height + pad) return;
        }

        const alpha = Math.min(1, this.life);

        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;
        CTX.font = this._font || (this._font = `bold ${this.size}px Orbitron, monospace`);
        CTX.strokeStyle = 'black';
        CTX.lineWidth = 3;
        CTX.textAlign = 'center';
        CTX.strokeText(this.text, screen.x, screen.y);
        CTX.fillText(this.text, screen.x, screen.y);
        CTX.globalAlpha = 1;
    }
}

class FloatingTextSystem {
    constructor() {
        this.texts = [];
    }

    spawn(text, x, y, color, size = 20) {
        // ── POOL: reuse a dead instance instead of allocating ──
        this.texts.push(FloatingText.acquire(text, x, y, color, size));
    }

    update(dt) {
        // ── PERF: swap-and-pop O(1) — order irrelevant for floating texts ──
        const arr = this.texts;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt)) {
                arr[i].release();
                arr[i] = arr[arr.length - 1];
                arr.pop();
                i--;
            } else {
                i--;
            }
        }
    }

    draw() {
        // ── STABILITY FIX (Zone 3): Same CTX guard as ParticleSystem.
        if (typeof CTX === 'undefined' || !CTX) return;
        for (let text of this.texts) {
            text.draw();
        }
    }

    clear() {
        // Return every live text to pool before clearing.
        for (const t of this.texts) t.release();
        this.texts = [];
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// 🎯 HIT MARKER SYSTEM — Combat feedback crosshairs
// ──────────────────────────────────────────────────────────────────────────────

/**
 * HitMarker
 *
 * A brief X-shaped crosshair that appears at the world position of a
 * successful projectile hit.  Two visual tiers:
 *
 *   Normal hit: white arms, 0.30 s lifetime, 9 px arm length
 *   Crit hit:   gold arms, 0.40 s lifetime, 14 px arm length + glow
 *
 * Visual behaviour:
 *   • Arms expand by ~30 % as the marker fades (gives a "pop" feel).
 *   • Alpha falls linearly from 1 → 0 over the lifetime.
 *   • CTX state is fully sandboxed inside save/restore.
 *
 * Spawned by: ProjectileManager.update() via spawnHitMarker(x, y, isCrit)
 * Managed by: HitMarkerSystem (singleton: hitMarkerSystem)
 */
class HitMarker {
    // IMP-6: Object pool — reuse dead instances instead of allocating new ones.
    // During heavy fights (~40 markers/sec) this eliminates short-lived GC pressure.
    static _pool = [];
    static MAX_POOL = 80;   // matches FloatingText pool size; plenty for max 40 active

    /**
     * @param {number}  x      World X coordinate of the impact
     * @param {number}  y      World Y coordinate of the impact
     * @param {boolean} isCrit Whether the hit was a critical strike
     */
    constructor(x, y, isCrit = false) {
        this.reset(x, y, isCrit);
    }

    /**
     * Re-initialise a pooled (or brand-new) instance with fresh state.
     * @returns {HitMarker} this, for fluent chaining from acquire()
     */
    reset(x, y, isCrit = false) {
        this.x = x;
        this.y = y;
        this.isCrit = isCrit;

        // Lifetime: crits linger slightly longer so they register better
        this.maxLife = isCrit ? 0.40 : 0.30;
        this.life = this.maxLife;

        // Base arm half-length (screen pixels, before expand animation)
        this.baseSize = isCrit ? 14 : 9;
        return this;
    }

    /**
     * Pull a ready-to-use instance from the pool (or allocate a fresh one).
     */
    static acquire(x, y, isCrit = false) {
        if (HitMarker._pool.length > 0) {
            return HitMarker._pool.pop().reset(x, y, isCrit);
        }
        return new HitMarker(x, y, isCrit);
    }

    /**
     * Return this dead instance to the pool for reuse.
     */
    release() {
        if (HitMarker._pool.length < HitMarker.MAX_POOL) {
            HitMarker._pool.push(this);
        }
    }

    /**
     * @param {number} dt Scaled frame delta (seconds)
     * @returns {boolean} true when the marker should be removed
     */
    update(dt) {
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const t = this.life / this.maxLife;   // 1 → 0 as marker ages

        // Expand arms as the marker fades: starts at baseSize, grows by 35 %
        const armLen = this.baseSize * (1 + (1 - t) * 0.35);

        // Alpha decays with a slight ease-out (square root) so early frames
        // are very opaque and the marker doesn't vanish abruptly at the end
        const alpha = Math.sqrt(t);

        CTX.save();

        CTX.globalAlpha = alpha;
        CTX.strokeStyle = this.isCrit ? '#facc15' : '#ffffff';
        CTX.lineWidth = this.isCrit ? 2.5 : 2;
        CTX.lineCap = 'round';

        if (this.isCrit) {
            // Golden glow for crits
            CTX.shadowBlur = 10;
            CTX.shadowColor = '#facc15';
        } else {
            CTX.shadowBlur = 5;
            CTX.shadowColor = 'rgba(255,255,255,0.7)';
        }

        // ── Draw X arms ──────────────────────────────────────
        const cx = screen.x;
        const cy = screen.y;
        const s = armLen;

        CTX.beginPath();
        // Diagonal NW → SE
        CTX.moveTo(cx - s, cy - s);
        CTX.lineTo(cx + s, cy + s);
        // Diagonal NE → SW
        CTX.moveTo(cx + s, cy - s);
        CTX.lineTo(cx - s, cy + s);
        CTX.stroke();

        // ── Inner dot for crits (extra punch) ────────────────
        if (this.isCrit) {
            CTX.shadowBlur = 14;
            CTX.shadowColor = '#facc15';
            CTX.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            CTX.beginPath();
            CTX.arc(cx, cy, 2.5 * t, 0, Math.PI * 2);
            CTX.fill();
        }

        CTX.restore();
    }
}

/**
 * HitMarkerSystem
 *
 * Singleton that manages a pool of active HitMarker objects.
 *
 * ─── Integration (add to game.js) ───────────────────────────────────────────
 *
 *   In your UPDATE section (same place as particleSystem.update):
 *     hitMarkerSystem.update(dt);
 *
 *   In your DRAW section (after enemies + projectiles, before HUD):
 *     hitMarkerSystem.draw();
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Hard-capped at MAX_MARKERS to prevent accumulation during heavy fights.
 * The oldest marker is evicted first (FIFO, same as ParticleSystem).
 */
class HitMarkerSystem {
    static MAX_MARKERS = 40;   // generous cap; each marker is tiny

    constructor() {
        this.markers = [];
    }

    /**
     * Spawn a new hit marker at world position (x, y).
     * @param {number}  x      World X
     * @param {number}  y      World Y
     * @param {boolean} isCrit Whether the registering hit was a crit
     */
    spawn(x, y, isCrit = false) {
        // IMP-6: use pool instead of `new HitMarker()`
        this.markers.push(HitMarker.acquire(x, y, isCrit));

        // Evict oldest if over cap — release it back to pool
        while (this.markers.length > HitMarkerSystem.MAX_MARKERS) {
            this.markers.shift().release();
        }
    }

    /**
     * @param {number} dt Scaled frame delta (seconds)
     */
    update(dt) {
        // ── PERF: swap-and-pop O(1) ──────────────────────────────────────────
        const arr = this.markers;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt)) {
                arr[i].release();
                arr[i] = arr[arr.length - 1];
                arr.pop();
            } else {
                i--;
            }
        }
    }

    draw() {
        if (typeof CTX === 'undefined' || !CTX) return;
        for (let marker of this.markers) {
            marker.draw();
        }
    }

    clear() {
        // IMP-6: release all live markers back to pool
        for (const m of this.markers) m.release();
        this.markers = [];
    }
}

// Global singleton — hook update() + draw() into game.js (see class comment)
var hitMarkerSystem = new HitMarkerSystem();

/**
 * spawnHitMarker(x, y, isCrit)
 * Convenience wrapper so call sites don't need to reference the
 * singleton directly — mirrors the pattern of spawnParticles().
 *
 * @param {number}  x      World X of the impact
 * @param {number}  y      World Y of the impact
 * @param {boolean} [isCrit=false] Was it a critical hit?
 */
function spawnHitMarker(x, y, isCrit = false) {
    hitMarkerSystem.spawn(x, y, isCrit);
}

// ──────────────────────────────────────────────────────────────────────────────
// 🌧️ Weather System — Rain & Snow
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Raindrop class
 * Spawns at top of screen, falls down with wind drift, drawn as thin blue line
 */
class Raindrop {
    constructor(x, y, speed, wind) {
        this.x = x;
        this.y = y;
        this.speed = speed;      // vertical fall speed (pixels/sec)
        this.wind = wind;        // horizontal drift (pixels/sec)
        this.length = 8 + Math.random() * 8;  // visual streak length
        this.alpha = 0.4 + Math.random() * 0.2; // fixed per-drop alpha
    }

    update(dt, camera) {
        this.y += this.speed * dt;
        this.x += this.wind * dt;

        // Remove if below visible screen (camera-relative)
        const screenBottom = camera.y + CANVAS.height + 100;
        return this.y > screenBottom;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const endY = screen.y + this.length;

        CTX.save();
        CTX.globalAlpha = this.alpha;
        CTX.strokeStyle = '#60a5fa';  // light blue
        CTX.lineWidth = 1;
        CTX.beginPath();
        CTX.moveTo(screen.x, screen.y);
        CTX.lineTo(screen.x, endY);
        CTX.stroke();
        CTX.restore();
    }
}

/**
 * Snowflake class
 * Spawns at top, falls slowly with horizontal sin() sway, drawn as white circle
 */
class Snowflake {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.speed = speed;           // slower than rain
        this.size = 2 + Math.random() * 3;
        this.swaySpeed = 0.5 + Math.random() * 1.5;  // sway frequency
        this.swayAmount = 10 + Math.random() * 20;   // sway amplitude
        this.time = Math.random() * Math.PI * 2;     // offset for varied sway
        this.alpha = 0.6 + Math.random() * 0.3;      // fixed per-flake alpha
    }

    update(dt, camera) {
        this.time += dt * this.swaySpeed;
        this.y += this.speed * dt;
        this.x += Math.sin(this.time) * this.swayAmount * dt;

        // Remove if below visible screen
        const screenBottom = camera.y + CANVAS.height + 100;
        return this.y > screenBottom;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);

        CTX.save();
        CTX.globalAlpha = this.alpha;
        CTX.fillStyle = '#ffffff';
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, this.size, 0, Math.PI * 2);
        CTX.fill();
        CTX.restore();
    }
}

/**
 * WeatherSystem
 * Manages atmospheric rain/snow effects
 *
 * Usage:
 *   weatherSystem.setWeather('rain');  // or 'snow', or 'none'
 *   weatherSystem.update(dt, camera);
 *   weatherSystem.draw();
 */
class WeatherSystem {
    static MAX_PARTICLES = 200;  // Cap to prevent performance issues

    constructor() {
        this.mode = 'none';       // 'none', 'rain', 'snow'
        this.particles = [];
        this.spawnTimer = 0;

        // Rain config
        this.rainSpawnRate = 30;   // particles per second
        this.rainSpeed = 600;      // fall speed
        this.rainWind = 80;        // horizontal drift

        // Snow config
        this.snowSpawnRate = 20;   // particles per second
        this.snowSpeed = 100;      // fall speed (slower than rain)
    }

    setWeather(mode) {
        if (mode !== this.mode) {
            this.mode = mode;
            this.particles = [];  // clear old particles when switching
            this.spawnTimer = 0;
        }
    }

    update(dt, camera) {
        if (this.mode === 'none') {
            // WARN-14 FIX: only reallocate when there are actually particles to
            // discard.  The old code did `this.particles = []` unconditionally
            // every frame, creating a new Array object at ~60 Hz for no reason.
            if (this.particles.length > 0) this.particles = [];
            return;
        }

        // Spawn new particles
        this.spawnTimer += dt;
        const spawnRate = this.mode === 'rain' ? this.rainSpawnRate : this.snowSpawnRate;
        const spawnInterval = 1.0 / spawnRate;

        while (this.spawnTimer >= spawnInterval) {
            this.spawnTimer -= spawnInterval;
            this._spawnParticle(camera);
        }

        // Update existing particles — swap-and-pop O(1), order irrelevant
        const arr = this.particles;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt, camera)) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
            } else {
                i--;
            }
        }

        // Hard cap enforcement (evict oldest if needed)
        while (this.particles.length > WeatherSystem.MAX_PARTICLES) {
            this.particles.shift();
        }
    }

    draw() {
        if (this.mode === 'none') return;

        // ── STABILITY FIX (Zone 3): Guard against uninitialised CTX.
        if (typeof CTX === 'undefined' || !CTX) return;

        for (let particle of this.particles) {
            particle.draw();
        }
    }

    _spawnParticle(camera) {
        // Spawn at top of visible screen with some padding
        const screenTop = camera.y - 10;
        const screenLeft = camera.x - 50;
        const screenRight = camera.x + CANVAS.width + 50;

        const x = screenLeft + Math.random() * (screenRight - screenLeft);
        const y = screenTop;

        if (this.mode === 'rain') {
            const speed = this.rainSpeed + (Math.random() - 0.5) * 100;
            const wind = this.rainWind + (Math.random() - 0.5) * 40;
            this.particles.push(new Raindrop(x, y, speed, wind));
        } else if (this.mode === 'snow') {
            const speed = this.snowSpeed + (Math.random() - 0.5) * 30;
            this.particles.push(new Snowflake(x, y, speed));
        }
    }

    clear() {
        this.particles = [];
        this.spawnTimer = 0;
    }
}

// Global instance
var weatherSystem = new WeatherSystem();

// ──────────────────────────────────────────────────────────────────────────────
// Special Effects for Boss
// ──────────────────────────────────────────────────────────────────────────────

// Equation Slam Effect
class EquationSlam {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 50;
        this.maxRadius = BALANCE.boss.slamRadius;
        this.speed = 400;
        this.damage = BALANCE.boss.slamDamage;
        this.hit = false;
        this.equation = "ax² + bx + c = 0";
    }

    update(dt, player) {
        this.radius += this.speed * dt;

        // Check player collision
        if (!this.hit) {
            const d = dist(this.x, this.y, player.x, player.y);
            if (d <= this.radius && d >= this.radius - 30) {
                player.takeDamage(this.damage);
                this.hit = true;
            }
        }

        return this.radius >= this.maxRadius;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);

        CTX.save();
        CTX.translate(screen.x, screen.y);

        const alpha = 1 - (this.radius / this.maxRadius);
        CTX.globalAlpha = alpha;

        // Ring
        CTX.strokeStyle = '#facc15';
        CTX.lineWidth = 8;
        CTX.beginPath();
        CTX.arc(0, 0, this.radius, 0, Math.PI * 2);
        CTX.stroke();

        // Equation text around the ring
        CTX.fillStyle = '#fff';
        CTX.font = 'bold 20px monospace';
        CTX.textAlign = 'center';

        for (let i = 0; i < 4; i++) {
            const angle = (Math.PI * 2 / 4) * i;
            const tx = Math.cos(angle) * this.radius;
            const ty = Math.sin(angle) * this.radius;
            CTX.fillText(this.equation, tx, ty);
        }

        CTX.restore();
    }
}

// Deadly Graph Effect
class DeadlyGraph {
    constructor(startX, startY, targetX, targetY, duration = null) {
        this.startX = startX;
        this.startY = startY;
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.length = 0;
        this.maxLength = BALANCE.boss.graphLength;
        this.speed = 600;
        this.damage = BALANCE.boss.graphDamage;
        this.phase = 'expanding'; // expanding, blocking, active
        this.timer = 0;
        this.hasHit = false;

        this.blockingDuration = duration !== null ? duration / 2 : 5;
        this.activeDuration = duration !== null ? duration / 2 : 5;
    }

    update(dt, player) {
        this.timer += dt;

        if (this.phase === 'expanding') {
            this.length += this.speed * dt;

            // Check collision
            const pd = this.pointToLineDistance(
                player.x, player.y,
                this.startX, this.startY,
                this.startX + Math.cos(this.angle) * this.length,
                this.startY + Math.sin(this.angle) * this.length
            );

            if (!this.hasHit && pd < 20) {
                player.takeDamage(this.damage);
                this.hasHit = true;
            }

            if (this.length >= this.maxLength) {
                this.phase = 'blocking';
                this.timer = 0;
            }
        } else if (this.phase === 'blocking') {
            if (this.timer >= this.blockingDuration) {
                this.phase = 'active';
                this.timer = 0;

                // ── Destructible environment: line-AABB sweep ────────
                // Fired at the exact moment the laser becomes fully active,
                // using the true full-length endpoint derived from trigonometry.
                // Destroys any MapObject the damage line passes through
                // and shrinks the MTCRoom by 10% if it is intersected.
                if (window.mapSystem && typeof window.mapSystem.damageArea === 'function') {
                    const actualEndX = this.startX + Math.cos(this.angle) * this.maxLength;
                    const actualEndY = this.startY + Math.sin(this.angle) * this.maxLength;
                    window.mapSystem.damageArea(this.startX, this.startY, actualEndX, actualEndY);
                }
            }
        } else if (this.phase === 'active') {
            // High ground mechanic
            const pd = this.pointToLineDistance(
                player.x, player.y,
                this.startX, this.startY,
                this.startX + Math.cos(this.angle) * this.length,
                this.startY + Math.sin(this.angle) * this.length
            );

            player.onGraph = (pd < 25);

            if (this.timer >= this.activeDuration) {
                player.onGraph = false;
                return true; // Remove
            }
        }

        return false;
    }

    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
        if (param < 0) {
            xx = x1; yy = y1;
        } else if (param > 1) {
            xx = x2; yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        return Math.hypot(px - xx, py - yy);
    }

    draw() {
        const startScreen = worldToScreen(this.startX, this.startY);
        const endX = this.startX + Math.cos(this.angle) * this.length;
        const endY = this.startY + Math.sin(this.angle) * this.length;
        const endScreen = worldToScreen(endX, endY);

        CTX.save();

        if (this.phase === 'expanding') {
            CTX.strokeStyle = '#3b82f6';
            CTX.lineWidth = 8;
            CTX.shadowBlur = 20;
            CTX.shadowColor = '#3b82f6';
        } else if (this.phase === 'blocking') {
            CTX.strokeStyle = 'rgba(59, 130, 246, 0.2)';
            CTX.lineWidth = 4;
            CTX.setLineDash([10, 10]);
        } else {
            CTX.strokeStyle = '#1d4ed8';
            CTX.lineWidth = 12;
        }

        CTX.beginPath();
        CTX.moveTo(startScreen.x, startScreen.y);
        CTX.lineTo(endScreen.x, endScreen.y);
        CTX.stroke();

        if (this.phase === 'expanding' || this.phase === 'active') {
            CTX.fillStyle = '#fff';
            CTX.font = 'bold 24px monospace';
            CTX.textAlign = 'center';
            CTX.fillText('y = x', endScreen.x, endScreen.y - 20);
        }

        CTX.restore();
    }
}

// Meteor Strike Effect
class MeteorStrike {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.phase = 'warning'; // warning, impact, done
        this.timer = 0;
        this.warningDuration = 1.5;
        this.radius = 60;
    }

    update(dt, player, meteorZones) {
        this.timer += dt;

        if (this.phase === 'warning') {
            if (this.timer >= this.warningDuration) {
                this.phase = 'impact';
                this.timer = 0;

                // Screen shake
                addScreenShake(10);

                // Particles
                particleSystem.spawn(this.x, this.y, 30, '#f59e0b');

                // Damage on impact
                const d = dist(this.x, this.y, player.x, player.y);
                if (d < this.radius) {
                    player.takeDamage(BALANCE.mage.meteorDamage);
                }

                // Create lava zone
                meteorZones.push({
                    x: this.x,
                    y: this.y,
                    radius: this.radius,
                    damage: BALANCE.mage.meteorBurnDPS,
                    life: BALANCE.mage.meteorBurnDuration
                });
            }
        } else if (this.phase === 'impact') {
            return true; // Remove
        }

        return false;
    }

    draw() {
        if (this.phase === 'warning') {
            const screen = worldToScreen(this.x, this.y);
            const pulse = Math.sin(this.timer * 10) * 0.3 + 0.7;

            // Warning circle
            CTX.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
            CTX.lineWidth = 4;
            CTX.setLineDash([10, 5]);
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, this.radius, 0, Math.PI * 2);
            CTX.stroke();
            CTX.setLineDash([]);

            // Falling meteor
            const progress = this.timer / this.warningDuration;
            const meteorY = this.y - 300 + progress * 300;
            const meteorScreen = worldToScreen(this.x, meteorY);

            CTX.fillStyle = '#f97316';
            CTX.shadowBlur = 15;
            CTX.shadowColor = '#f97316';
            CTX.beginPath();
            CTX.arc(meteorScreen.x, meteorScreen.y, 15, 0, Math.PI * 2);
            CTX.fill();
            CTX.shadowBlur = 0;
        }
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Create singleton instances
// ──────────────────────────────────────────────────────────────────────────────
var particleSystem = new ParticleSystem();
var floatingTextSystem = new FloatingTextSystem();

// Helper functions for global use
function spawnParticles(x, y, count, color, type = 'circle', options = {}) {
    particleSystem.spawn(x, y, count, color, type, options);
}

function spawnFloatingText(text, x, y, color, size = 20) {
    floatingTextSystem.spawn(text, x, y, color, size);
}

// ──────────────────────────────────────────────────────────────────────────────
// ⚡ GLITCH EFFECT ENGINE
// ──────────────────────────────────────────────────────────────────────────────
/**
 * drawGlitchEffect(intensity, controlsInverted)
 * Called from game.js drawGame() every frame while isGlitchWave is true.
 * Draws purely on top of the finished frame — no game state is touched.
 * Layers (painted in order):
 *   1. RGB SPLIT  — snapshot the canvas, re-draw 3× with R/G/B channel
 *      composite modes at random offsets.
 *   2. SCANLINES  — thin horizontal dark bands across the whole screen.
 *   3. CHROMA NOISE — random pixel sparks in vivid magenta/cyan.
 *   4. VIGNETTE   — radial darkening at edges.
 *   5. GLITCH BANNER — pulsing "GLITCH WAVE" text with character corruption.
 *   6. INVERT STRIP — pink warning bar at bottom when controls are flipped.
 *
 * @param {number}  intensity        — 0.0 (off) → 1.0 (full chaos)
 * @param {boolean} controlsInverted — shows the inversion warning strip
 */
function drawGlitchEffect(intensity, controlsInverted = false) {
    if (intensity <= 0) return;
    const W = CANVAS.width;
    const H = CANVAS.height;
    const now = performance.now();

    // ── 1. RGB SPLIT ─────────────────────────────────────────────
    const maxOff = Math.floor(intensity * 18);
    if (maxOff >= 1) {
        const seed = Math.floor(now / 50);
        const jitterX = ((seed * 1372) % (maxOff * 2 + 1)) - maxOff;
        const jitterY = ((seed * 853) % (maxOff + 1)) - Math.floor(maxOff / 2);

        // ── Red channel ──
        CTX.save();
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = intensity * 0.55;
        CTX.filter = 'saturate(500%) hue-rotate(0deg)';
        CTX.drawImage(CANVAS, jitterX, jitterY * 0.5);
        CTX.filter = 'none';
        CTX.restore();

        // ── Green channel ──
        CTX.save();
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = intensity * 0.3;
        CTX.filter = 'saturate(500%) hue-rotate(120deg)';
        CTX.drawImage(CANVAS, -jitterX * 0.4, 0);
        CTX.filter = 'none';
        CTX.restore();

        // ── Blue channel ──
        CTX.save();
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = intensity * 0.3;
        CTX.filter = 'saturate(500%) hue-rotate(240deg)';
        CTX.drawImage(CANVAS, jitterX * 0.6, -jitterY * 0.3);
        CTX.filter = 'none';
        CTX.restore();
    }

    // ── 2. SCANLINES ─────────────────────────────────────────────
    const scanAlpha = intensity * 0.22;
    const scanScroll = Math.floor(now / 80) % 3;
    CTX.save();
    CTX.globalAlpha = scanAlpha;
    CTX.fillStyle = '#000';
    for (let y = scanScroll; y < H; y += 3) {
        CTX.fillRect(0, y, W, 1);
    }
    CTX.restore();

    // ── 3. CHROMATIC NOISE ───────────────────────────────────────
    const sparkCount = Math.floor(intensity * 80);
    const sparkColors = ['#ff00ff', '#00ffff', '#ff3399', '#39ff14', '#ffffff', '#ff6600'];
    CTX.save();
    for (let i = 0; i < sparkCount; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H;
        const sw = 1 + Math.floor(Math.random() * 3);
        const sh = sw;
        CTX.globalAlpha = 0.35 + Math.random() * 0.65;
        CTX.fillStyle = sparkColors[Math.floor(Math.random() * sparkColors.length)];
        CTX.fillRect(sx, sy, sw, sh);
    }
    CTX.restore();

    // ── 4. HORIZONTAL GLITCH SLICES ──────────────────────────────
    if (intensity > 0.55) {
        const sliceSeed = Math.floor(now / 120);
        const numSlices = Math.floor(intensity * 4);
        for (let s = 0; s < numSlices; s++) {
            const sliceY = ((sliceSeed * (s + 1) * 397) % H);
            const sliceH = 2 + ((sliceSeed * (s + 1) * 113) % 8);
            const sliceOff = (((sliceSeed * (s + 1) * 211) % 40) - 20) * intensity;

            CTX.save();
            CTX.globalCompositeOperation = 'source-over';
            CTX.globalAlpha = 0.6;
            CTX.drawImage(CANVAS, 0, sliceY, W, sliceH, sliceOff, sliceY, W, sliceH);
            CTX.restore();
        }
    }

    // ── 5. VIGNETTE ──────────────────────────────────────────────
    const vigAlpha = intensity * (0.35 + Math.sin(now / 180) * 0.1);
    const vigGrad = CTX.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
    vigGrad.addColorStop(0, 'rgba(100,0,120,0)');
    vigGrad.addColorStop(1, `rgba(60,0,80,${vigAlpha.toFixed(3)})`);
    CTX.save();
    CTX.fillStyle = vigGrad;
    CTX.fillRect(0, 0, W, H);
    CTX.restore();

    // ── 6. GLITCH BANNER ─────────────────────────────────────────
    {
        const bannerY = H * 0.12;
        const baseText = '⚡ GLITCH WAVE ⚡';
        const glitchChars = '!@#$%^&*<>?/\\|';
        let displayText = '';
        for (let i = 0; i < baseText.length; i++) {
            const ch = baseText[i];
            if (ch !== ' ' && ch !== '⚡' && Math.random() < 0.18 * intensity) {
                displayText += glitchChars[Math.floor(Math.random() * glitchChars.length)];
            } else {
                displayText += ch;
            }
        }

        const fontSize = Math.floor(28 + intensity * 8);
        const pulse = 0.7 + Math.sin(now / 90) * 0.3;

        CTX.save();
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.font = `bold ${fontSize}px Orbitron, monospace`;

        // Cyan shadow offset
        CTX.fillStyle = `rgba(0,255,255,${(intensity * pulse * 0.7).toFixed(3)})`;
        CTX.fillText(displayText, W / 2 + 3, bannerY + 2);

        // Red shadow offset
        CTX.fillStyle = `rgba(255,0,100,${(intensity * pulse * 0.7).toFixed(3)})`;
        CTX.fillText(displayText, W / 2 - 3, bannerY - 2);

        // Main text — white with slight magenta tint
        CTX.shadowBlur = 14 * intensity;
        CTX.shadowColor = '#d946ef';
        CTX.fillStyle = `rgba(255,220,255,${(pulse * 0.92).toFixed(3)})`;
        CTX.fillText(displayText, W / 2, bannerY);
        CTX.shadowBlur = 0;

        // Sub-label — small corrupted status line
        const statusChars = ['REALITY.EXE', 'PHYSICS.DLL', 'CONTROLS.SYS', 'MEMORY.ERR', 'WAVE_DATA.BIN'];
        const statusIdx = Math.floor(now / 400) % statusChars.length;
        CTX.font = `bold 11px monospace`;
        CTX.fillStyle = `rgba(236,72,153,${intensity * 0.85})`;
        CTX.fillText(`[ ${statusChars[statusIdx]} HAS STOPPED WORKING ]`, W / 2, bannerY + fontSize * 0.9);

        CTX.restore();
    }

    // ── 7. INVERTED CONTROLS STRIP ───────────────────────────────
    if (controlsInverted) {
        const stripH = 38;
        const stripY = H - stripH;
        const flashAlpha = 0.7 + Math.sin(now / 80) * 0.3;

        CTX.save();

        // Background bar
        CTX.globalAlpha = 0.82;
        CTX.fillStyle = '#7e0040';
        CTX.fillRect(0, stripY, W, stripH);

        // Left + right gradient fade
        const fadeL = CTX.createLinearGradient(0, 0, 60, 0);
        fadeL.addColorStop(0, 'rgba(0,0,0,0.6)');
        fadeL.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.fillStyle = fadeL;
        CTX.fillRect(0, stripY, 60, stripH);

        const fadeR = CTX.createLinearGradient(W - 60, 0, W, 0);
        fadeR.addColorStop(0, 'rgba(0,0,0,0)');
        fadeR.addColorStop(1, 'rgba(0,0,0,0.6)');
        CTX.fillStyle = fadeR;
        CTX.fillRect(W - 60, stripY, 60, stripH);

        // Warning text
        CTX.globalAlpha = flashAlpha;
        CTX.fillStyle = '#ffffff';
        CTX.font = 'bold 15px Orbitron, monospace';
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.shadowBlur = 10;
        CTX.shadowColor = '#ff00aa';
        CTX.fillText('⚡  CONTROLS INVERTED — W↔S   A↔D  ⚡', W / 2, stripY + stripH / 2);
        CTX.shadowBlur = 0;

        CTX.restore();
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// 🥊 WANCHAI PUNCH TEXT — JoJo-style barrage floating labels
// Called by ProjectileManager.update() whenever a 'punch' kind projectile hits.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * WANCHAI_PUNCH_LABELS
 * Pool of text labels that randomly appear on each Wanchai punch hit.
 * Alternates between the Stand name in Thai (วันชัย!) and impact emoji.
 * Keeping them short maximises legibility during a rapid-fire barrage.
 */
const WANCHAI_PUNCH_LABELS = [
    'วันชัย!',   // Stand name: "Wanchai!" in Thai
    'วันชัย!!',
    '💥',
    '💥💥',
    'ORA!',      // JoJo reference — Stand battle cry
    'WANCHAI!',
    '🔥',
    'STAND!',
    'ร้อน!!'     // "Hot!!" in Thai — thermodynamic flavour
];

/**
 * spawnWanchaiPunchText(x, y)
 * Spawns a single randomly-chosen punch label at world position (x, y).
 * The text is offset slightly so consecutive hits stack readably.
 *
 * @param {number} x  World X coordinate of the impact
 * @param {number} y  World Y coordinate of the impact
 */
function spawnWanchaiPunchText(x, y) {
    if (typeof floatingTextSystem === 'undefined') return;

    const label = WANCHAI_PUNCH_LABELS[Math.floor(Math.random() * WANCHAI_PUNCH_LABELS.length)];
    const offX = (Math.random() - 0.5) * 40;   // random horizontal scatter
    const offY = -10 + (Math.random() - 0.5) * 20; // random vertical scatter

    // Alternate colours: hot crimson, fiery orange, and bright white for contrast
    const colours = ['#dc2626', '#fb7185', '#f97316', '#ffffff', '#fca5a5'];
    const colour = colours[Math.floor(Math.random() * colours.length)];

    // Size varies 16-24px: bigger on emoji and double-exclamation labels
    const size = label.includes('!!') || label === '💥💥' ? 24 : 18;

    floatingTextSystem.spawn(label, x + offX, y + offY, colour, size);
}

// ──────────────────────────────────────────────────────────────────────────────
// Orbital Particle System — Auto & Kao intensity-linked effects
// ──────────────────────────────────────────────────────────────────────────────
class OrbitalParticle {
    // ── Static Object Pool ─────────────────────────────────────────────────────
    // Matches the pattern used by Particle, FloatingText, and HitMarker.
    // OrbitalParticleSystem spawns ~1 particle every 0.03–0.15 s at 60 FPS,
    // so without pooling we allocate ~7–33 short-lived objects per second per
    // player — enough to cause GC microstutters during intense Wanchai rushes.
    static _pool = [];
    static MAX_POOL = 40;   // 2 systems × 12 max active + generous headroom

    constructor(x, y, orbitRadius, angle, speed, size, color, lifetime) {
        this.centerX = x;
        this.centerY = y;
        this.orbitRadius = orbitRadius;
        this.angle = angle;
        this.speed = speed;
        this.size = size;
        this.color = color;
        this.life = lifetime;
        this.maxLife = lifetime;
        this.wobble = Math.random() * Math.PI * 2;
    }

    /**
     * Re-initialise a pooled (or brand-new) instance with fresh state.
     * @returns {OrbitalParticle} this — for fluent chaining from acquire()
     */
    reset(x, y, orbitRadius, angle, speed, size, color, lifetime) {
        this.centerX = x;
        this.centerY = y;
        this.orbitRadius = orbitRadius;
        this.angle = angle;
        this.speed = speed;
        this.size = size;
        this.color = color;
        this.life = lifetime;
        this.maxLife = lifetime;
        this.wobble = Math.random() * Math.PI * 2;
        return this;
    }

    /** Pull from pool (or allocate) then reset. */
    static acquire(x, y, orbitRadius, angle, speed, size, color, lifetime) {
        if (OrbitalParticle._pool.length > 0) {
            return OrbitalParticle._pool.pop()
                .reset(x, y, orbitRadius, angle, speed, size, color, lifetime);
        }
        return new OrbitalParticle(x, y, orbitRadius, angle, speed, size, color, lifetime);
    }

    /** Return dead instance to pool. */
    release() {
        if (OrbitalParticle._pool.length < OrbitalParticle.MAX_POOL) {
            OrbitalParticle._pool.push(this);
        }
    }

    update(dt, targetX, targetY, intensity) {
        // Follow target position
        this.centerX = targetX;
        this.centerY = targetY;

        // Orbit with wobble
        this.angle += this.speed * dt * (1 + intensity * 0.5);
        this.wobble += dt * 3;

        // Decay
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const wobbleOffset = Math.sin(this.wobble) * 3;
        const x = this.centerX + Math.cos(this.angle) * (this.orbitRadius + wobbleOffset);
        const y = this.centerY + Math.sin(this.angle) * (this.orbitRadius + wobbleOffset);
        const screen = worldToScreen(x, y);

        // ── PERF: viewport cull ──────────────────────────────────────────────
        if (typeof CANVAS !== 'undefined') {
            const pad = this.size + 4;
            if (screen.x < -pad || screen.x > CANVAS.width + pad ||
                screen.y < -pad || screen.y > CANVAS.height + pad) return;
        }

        const alpha = this.life / this.maxLife;
        // ── PERF: skip sub-pixel particles ──────────────────────────────────
        if (this.size * alpha < 0.4) return;

        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;

        // ── PERF: shadowBlur only when particle is large enough to notice ───
        const useShadow = this.size >= 2;
        if (useShadow) {
            CTX.shadowBlur = 8;
            CTX.shadowColor = this.color;
        }

        CTX.beginPath();
        CTX.arc(screen.x, screen.y, this.size, 0, Math.PI * 2);
        CTX.fill();

        if (useShadow) CTX.shadowBlur = 0;
        CTX.globalAlpha = 1;
    }
}

class OrbitalParticleSystem {
    constructor(maxParticles = 12) {
        this.particles = [];
        this.maxParticles = maxParticles;
        this.spawnTimer = 0;
        this.intensity = 0;
    }

    update(dt, playerX, playerY, speed, isWanchaiActive, isWeaponMaster) {
        // Calculate intensity based on player state
        this.intensity = Math.min(1, speed / 200 + (isWanchaiActive ? 0.4 : 0) + (isWeaponMaster ? 0.3 : 0));

        // ── PERF: swap-and-pop O(1) + pool release ───────────────────────────
        const arr = this.particles;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt, playerX, playerY, this.intensity)) {
                arr[i].release();              // return to pool
                arr[i] = arr[arr.length - 1];
                arr.pop();
            } else {
                i--;
            }
        }

        // Spawn new particles based on intensity
        this.spawnTimer -= dt;
        const spawnRate = 0.15 - this.intensity * 0.12;
        if (this.spawnTimer <= 0 && arr.length < this.maxParticles) {
            this.spawnTimer = spawnRate;
            this.spawnParticle(playerX, playerY);
        }
    }

    spawnParticle(x, y) {
        const angle = Math.random() * Math.PI * 2;
        const orbitRadius = 25 + Math.random() * 15;
        const speed = 1.5 + Math.random() * 1.5;
        const size = 1.5 + Math.random() * 2;
        const lifetime = 2 + Math.random() * 2;

        // Color based on intensity
        let color;
        if (this.intensity > 0.6) color = '#f97316';  // orange  — high
        else if (this.intensity > 0.3) color = '#fbbf24';  // yellow  — medium
        else color = '#60a5fa';  // blue    — low

        // ── POOL: acquire instead of `new OrbitalParticle(…)` ───────────────
        this.particles.push(OrbitalParticle.acquire(x, y, orbitRadius, angle, speed, size, color, lifetime));
    }

    draw() {
        for (const particle of this.particles) {
            particle.draw();
        }
    }

    clear() {
        // ── POOL: release all live particles before clearing ─────────────────
        for (const p of this.particles) p.release();
        this.particles = [];
    }
}

// Global orbital particle systems for Auto and Kao
let autoOrbitalSystem = null;
let kaoOrbitalSystem = null;

function initOrbitalSystems() {
    autoOrbitalSystem = new OrbitalParticleSystem(10);
    kaoOrbitalSystem = new OrbitalParticleSystem(8);
}

function updateOrbitalEffects(dt, players) {
    if (!autoOrbitalSystem) initOrbitalSystems();

    players.forEach(player => {
        let system = null;
        if (player.constructor.name === 'AutoPlayer') {
            system = autoOrbitalSystem;
        } else if (player.constructor.name === 'KaoPlayer') {
            system = kaoOrbitalSystem;
        }

        if (system) {
            const speed = Math.hypot(player.vx, player.vy);
            system.update(dt, player.x, player.y, speed, player.wanchaiActive, player.isWeaponMaster);
        }
    });
}

function drawOrbitalEffects() {
    if (autoOrbitalSystem) autoOrbitalSystem.draw();
    if (kaoOrbitalSystem) kaoOrbitalSystem.draw();
}

// ──────────────────────────────────────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Particle, ParticleSystem, particleSystem,
        FloatingText, FloatingTextSystem, floatingTextSystem,
        HitMarker, HitMarkerSystem, hitMarkerSystem,
        spawnHitMarker,
        Raindrop, Snowflake, WeatherSystem, weatherSystem,
        EquationSlam, DeadlyGraph, MeteorStrike,
        spawnParticles, spawnFloatingText,
        spawnWanchaiPunchText,
        drawGlitchEffect,
        OrbitalParticle, OrbitalParticleSystem,
        initOrbitalSystems, updateOrbitalEffects, drawOrbitalEffects,
    };
}