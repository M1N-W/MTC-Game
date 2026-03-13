'use strict';
/**
 * js/effects.js
 * ════════════════════════════════════════════════
 * All visual effect systems: particles, floating text, hit markers, weather,
 * meteor strike, orbital particles, decals, shell casings, wave announcement FX,
 * and Pat-specific trail/burst/slash helpers.
 * 2589 lines.
 *
 * Design notes:
 *   - All major systems use object pools (static _pool[]) + swap-and-pop O(1)
 *     removal. Zero `new` allocations after warm-up for Particle, FloatingText,
 *     OrbitalParticle.
 *   - ParticleSystem hard cap: MAX_PARTICLES = 150 (oldest evicted).
 *   - shadowBlur skipped for particles with rendered radius < 3 px (perf guard).
 *   - Viewport cull in Particle.draw() and OrbitalParticle.draw() before any ctx calls.
 *   - FloatingText categories (CRIT/DAMAGE/HEAL/IMPACT/STATUS/DEFAULT) are
 *     auto-detected from text content and cached after first call.
 *   - WaveAnnouncementFX owns the full wave-start cinematic (typewriter + flash).
 *
 * Integration:
 *   game.js → particleSystem.update(dt) + .draw()
 *   game.js → floatingTextSystem.update(dt) + .draw()
 *   game.js → hitMarkerSystem.update(dt) + .draw()
 *   game.js → weatherSystem.update(dt, camera) + .draw()
 *   game.js → updateOrbitalEffects(dt, players) + drawOrbitalEffects()
 *   game.js → decalSystem.update(dt) + .draw()
 *   game.js → shellCasingSystem.update(dt) + .draw()
 *   game.js → waveAnnouncementFX.update(dt) + .draw()
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.62   Particle                 pooled particle entity (circle/binary/afterimage/zanzo/slash_arc/steam)
 *  L.321  ParticleSystem           update + draw, MAX_PARTICLES cap
 *  L.477  FloatingText             pooled damage/heal/status number popup
 *  L.818  FloatingTextSystem       stack-offset, pool reuse, swap-and-pop
 *  L.898  HitMarker                X-crosshair at impact point (normal/crit)
 *  L.1032 HitMarkerSystem          update + draw
 *  L.1100 spawnHitMarker()         convenience wrapper
 *  L.1112 Raindrop / Snowflake     weather particle entities
 *  L.1195 WeatherSystem            rain/snow atmospheric system
 *  L.1300 MeteorStrike             falling meteor warning + impact zone
 *  L.1383 spawnParticles()         global convenience spawn wrapper
 *  L.1387 spawnFloatingText()      global convenience spawn wrapper
 *  L.1410 drawGlitchEffect()       glitch-wave screen distortion overlay
 *  L.1624 spawnWanchaiPunchText()  Auto stand-rush impact text spawner
 *  L.1644 OrbitalParticle          pooled orbital ring particle
 *  L.1750 OrbitalParticleSystem    per-player orbital ring manager
 *  L.1830 initOrbitalSystems()     create one system per player slot
 *  L.1836 updateOrbitalEffects()   tick all orbital systems
 *  L.1861 drawOrbitalEffects()     draw all orbital systems
 *  L.1879 Decal                    persistent floor decal (blood/scorch)
 *  L.1954 DecalSystem              update + draw, fade-out over lifetime
 *  L.2012 ShellCasing              physics-simulated ejected brass
 *  L.2093 ShellCasingSystem        update + draw shell casings
 *  L.2155 WaveAnnouncementFX       full-screen wave-start cinematic
 *  L.2453 spawnZanzoTrail()        Pat Zanzo Flash afterimage trail
 *  L.2479 spawnBloodBurst()        enemy death blood burst
 *  L.2520 spawnKatanaSlashArc()    Pat katana slash arc spawn helper
 *
 * ⚠️  spawnParticles() and spawnFloatingText() are called everywhere in the codebase —
 *     never rename or change their signatures without a full grep pass.
 * ⚠️  OrbitalParticle pool cap is 40 — spawning beyond this silently drops oldest.
 *     initOrbitalSystems() must be called after player creation, not at file load.
 * ⚠️  WaveAnnouncementFX.draw() writes directly to CTX global — must be called
 *     last in the render pass to overlay everything else.
 * ════════════════════════════════════════════════
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
        } else if (this.type === 'zanzo') {
            // Zanzo ghost — stationary, pure alpha fade (no drift)
            this.vx = 0;
            this.vy = 0;
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
            // BUG-6 FIX: No Math.random() in draw(). data.char is always set by
            // ParticleSystem.spawn() for 'binary' type. Fallback to '0' (not random).
            CTX.fillText(this.data.char || '0', screen.x, screen.y);
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

        // ── TYPE: ZANZO (Pat Afterimage — integrated ronin silhouette) ─
        if (this.type === 'zanzo') {
            CTX.save();
            CTX.translate(screen.x, screen.y);

            const R = this.size;
            const a = alpha * (this.data.alphaScale ?? 1.0);
            CTX.globalAlpha = a;
            CTX.fillStyle = this.color;    // '#4a90d9'
            CTX.shadowBlur = 12 * alpha;
            CTX.shadowColor = this.color;

            // Body circle
            CTX.beginPath(); CTX.arc(0, 0, R * 0.85, 0, Math.PI * 2); CTX.fill();

            // Topknot cap — same quadratic shape as _drawPat
            CTX.beginPath();
            CTX.moveTo(-(R - 1), -2);
            CTX.quadraticCurveTo(-R - 1, -R * 0.75, -R * 0.30, -R - 3);
            CTX.quadraticCurveTo(0, -R - 5, R * 0.30, -R - 3);
            CTX.quadraticCurveTo(R + 1, -R * 0.75, R - 1, -2);
            CTX.quadraticCurveTo(0, 0, -(R - 1), -2);
            CTX.closePath(); CTX.fill();

            // Bun knot at crown
            CTX.globalAlpha = a * 0.80;
            CTX.beginPath(); CTX.ellipse(1, -R - 7, 4, 4, 0, 0, Math.PI * 2); CTX.fill();

            CTX.shadowBlur = 0;
            CTX.restore();
            CTX.globalAlpha = 1;
            return;
        }

        // ── TYPE: SLASH_ARC (Katana blade energy — elongated streak) ─
        if (this.type === 'slash_arc') {
            CTX.save();
            CTX.translate(screen.x, screen.y);
            const bladeAngle = this.data.angle ?? 0;
            CTX.rotate(bladeAngle);
            const streakLen = this.size * (2.5 + alpha * 3.5);
            const streakW = this.size * 0.55 * alpha;
            CTX.globalAlpha = alpha * 0.88;
            CTX.shadowBlur = 10 * alpha;
            CTX.shadowColor = this.color;
            // Elongated teardrop streak
            CTX.fillStyle = this.color;
            CTX.beginPath();
            CTX.moveTo(streakLen, 0);
            CTX.quadraticCurveTo(streakLen * 0.4, -streakW, 0, 0);
            CTX.quadraticCurveTo(streakLen * 0.4, streakW, streakLen, 0);
            CTX.closePath();
            CTX.fill();
            // Bright core spine
            CTX.globalAlpha = alpha * 0.60;
            CTX.strokeStyle = '#f0f8ff';
            CTX.lineWidth = 0.8;
            CTX.shadowBlur = 4;
            CTX.beginPath();
            CTX.moveTo(0, 0);
            CTX.lineTo(streakLen * 0.85, 0);
            CTX.stroke();
            CTX.shadowBlur = 0;
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
            else if (type === 'zanzo') {
                // Zanzo ghost — stationary at exact position, pure fade
                vx = 0;
                vy = 0;
                size = options.size || 17;          // Pat's radius
                lifetime = options.lifetime || 0.35; // zanzoGhostFadeDur
                data = {
                    angle: options.angle || 0,       // Pat's facing angle
                    alphaScale: options.alphaScale ?? 1.0  // per-ghost brightness
                };
            }
            else if (type === 'slash_arc') {
                // Katana slash energy — fast directional fan, tapers to a point
                vx = options.vx ?? 0;
                vy = options.vy ?? 0;
                size = options.size || rand(2, 4);
                lifetime = options.lifetime || rand(0.12, 0.22);
                data = { angle: options.angle ?? 0 }; // blade angle for elongated draw
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
                i--;
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
// ──────────────────────────────────────────────────────────────────────────────
// Floating Text System  —  Military HUD Edition
// ──────────────────────────────────────────────────────────────────────────────
//
// TEXT CATEGORIES (auto-detected from content + color):
//
//   CRIT     — pure numeric + gold color (#facc15/#fbbf24) OR size >= 32
//              → Large gradient fill, sparkle ring, no chip
//
//   DAMAGE   — pure numeric string (any color)
//              → Bebas Neue large, punch-scale pop, thick black stroke
//
//   HEAL     — starts with '+', green tones
//              → Parallelogram chip, dark bg, green border
//
//   IMPACT   — size >= 28 with text (often has emoji)
//              → Full-width chip bg, corner brackets, strong glow
//
//   STATUS   — ≤3 words, ALL-CAPS, short
//              → Small parallelogram chip, colored border
//
//   DEFAULT  — everything else
//              → Stroke outline + color shadow, no chip
//
// ──────────────────────────────────────────────────────────────────────────────

class FloatingText {
    // ── Static Object Pool ─────────────────────────────────────────────────────
    static _pool = [];
    static MAX_POOL = 80;

    constructor(text, x, y, color, size = 20) {
        this.reset(text, x, y, color, size);
    }

    reset(text, x, y, color, size = 20) {
        this.text = String(text);
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.life = 1.5;
        this.vy = -80;
        this._font = null;
        this._cat = null;   // category cache — cleared on reset

        // punch-scale: starts > 1, eases to 1 over first 0.18 s
        this._scale = 1.35;
        this._scaleTimer = 0.18;
        return this;
    }

    static acquire(text, x, y, color, size = 20) {
        if (FloatingText._pool.length > 0) {
            return FloatingText._pool.pop().reset(text, x, y, color, size);
        }
        return new FloatingText(text, x, y, color, size);
    }

    release() {
        this.text = '';
        this._cat = null;
        if (FloatingText._pool.length < FloatingText.MAX_POOL) {
            FloatingText._pool.push(this);
        }
    }

    // ── Category detection (cached after first call) ───────────────────────────
    _category() {
        if (this._cat) return this._cat;

        const t = this.text.trim();
        const col = (this.color || '').toLowerCase();
        const isNumeric = /^[\d,.\s]+$/.test(t);

        // CRIT — gold color + numeric, OR very large numeric
        if (isNumeric && (col === '#facc15' || col === '#fbbf24' || this.size >= 32)) {
            return (this._cat = 'CRIT');
        }
        // DAMAGE — any pure numeric
        if (isNumeric) {
            return (this._cat = 'DAMAGE');
        }
        // HEAL — starts with '+'
        if (t.startsWith('+')) {
            return (this._cat = 'HEAL');
        }
        // IMPACT — large size with text content
        if (this.size >= 28) {
            return (this._cat = 'IMPACT');
        }
        // STATUS — short ALL-CAPS label (≤ 3 words)
        const wordCount = t.replace(/[^\w\s]/g, '').trim().split(/\s+/).length;
        if (wordCount <= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
            return (this._cat = 'STATUS');
        }
        return (this._cat = 'DEFAULT');
    }

    update(dt) {
        // Punch-scale: ease out over _scaleTimer seconds
        if (this._scaleTimer > 0) {
            this._scaleTimer -= dt;
            const p = Math.max(0, this._scaleTimer / 0.18);  // 1 → 0
            this._scale = 1.0 + 0.35 * p * p;                    // ease-out quad
        } else {
            this._scale = 1.0;
        }
        this.y += this.vy * dt;
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);

        // Viewport cull
        if (typeof CANVAS !== 'undefined') {
            const pad = this.size * 3;
            if (screen.x < -pad || screen.x > CANVAS.width + pad ||
                screen.y < -pad || screen.y > CANVAS.height + pad) return;
        }

        const cat = this._category();
        // Full opacity for first second, fade over last 0.5 s
        const alpha = this.life > 0.5 ? 1.0 : this.life / 0.5;

        CTX.save();
        CTX.globalAlpha = alpha;
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';

        switch (cat) {
            case 'CRIT': this._drawCrit(screen); break;
            case 'DAMAGE': this._drawDamage(screen); break;
            case 'HEAL': this._drawHeal(screen); break;
            case 'IMPACT': this._drawImpact(screen); break;
            case 'STATUS': this._drawStatus(screen); break;
            default: this._drawDefault(screen); break;
        }

        CTX.restore();
    }

    // ── CRIT ── gold shimmer gradient, sparkle ring ────────────────────────────
    _drawCrit(sc) {
        const sz = this.size * 1.15 * this._scale;
        CTX.save();
        CTX.translate(sc.x, sc.y);

        CTX.shadowBlur = 28;
        CTX.shadowColor = '#f59e0b';
        CTX.font = `900 ${sz}px 'Bebas Neue', 'Orbitron', monospace`;

        // Thick black stroke for readability
        CTX.lineWidth = sz * 0.12;
        CTX.strokeStyle = 'rgba(0,0,0,0.95)';
        CTX.strokeText(this.text, 0, 0);

        // Gold gradient fill
        const grd = CTX.createLinearGradient(0, -sz * 0.5, 0, sz * 0.5);
        grd.addColorStop(0, '#fff7cc');
        grd.addColorStop(0.4, '#facc15');
        grd.addColorStop(1, '#f59e0b');
        CTX.fillStyle = grd;
        CTX.fillText(this.text, 0, 0);

        // Sparkle ring
        CTX.shadowBlur = 0;
        CTX.globalAlpha *= 0.5;
        CTX.strokeStyle = '#facc15';
        CTX.lineWidth = 1.2;
        CTX.beginPath();
        CTX.arc(0, 0, sz * 0.72, 0, Math.PI * 2);
        CTX.stroke();

        CTX.restore();
    }

    // ── DAMAGE ── large punch pop, thick stroke ────────────────────────────────
    _drawDamage(sc) {
        const sz = this.size * 1.1 * this._scale;
        CTX.save();
        CTX.translate(sc.x, sc.y);

        CTX.shadowBlur = 14;
        CTX.shadowColor = this.color;
        CTX.font = `900 ${sz}px 'Bebas Neue', 'Orbitron', monospace`;

        // Thick black outline — readable on any background
        CTX.lineWidth = sz * 0.14;
        CTX.strokeStyle = 'rgba(0,0,0,0.95)';
        CTX.strokeText(this.text, 0, 0);

        CTX.fillStyle = this.color;
        CTX.fillText(this.text, 0, 0);

        // Thin white highlight offset
        CTX.shadowBlur = 0;
        CTX.lineWidth = 1;
        CTX.strokeStyle = 'rgba(255,255,255,0.30)';
        CTX.strokeText(this.text, 0.5, -0.5);

        CTX.restore();
    }

    // ── HEAL ── green parallelogram chip ──────────────────────────────────────
    _drawHeal(sc) {
        const sz = this.size * this._scale;
        const font = `bold ${sz}px 'Rajdhani', 'Orbitron', monospace`;
        CTX.font = font;
        const tw = CTX.measureText(this.text).width;
        const ph = sz * 0.42;
        const pw = sz * 0.50;
        const bw = tw + pw * 2;
        const bh = sz + ph * 2;
        const sl = 6;

        CTX.save();
        CTX.translate(sc.x, sc.y);

        // Parallelogram background
        CTX.beginPath();
        CTX.moveTo(-bw / 2 + sl, -bh / 2);
        CTX.lineTo(bw / 2, -bh / 2);
        CTX.lineTo(bw / 2 - sl, bh / 2);
        CTX.lineTo(-bw / 2, bh / 2);
        CTX.closePath();
        CTX.fillStyle = 'rgba(6,30,20,0.82)';
        CTX.fill();
        CTX.strokeStyle = 'rgba(16,185,129,0.75)';
        CTX.lineWidth = 1.5;
        CTX.stroke();

        CTX.shadowBlur = 10;
        CTX.shadowColor = '#10b981';
        CTX.font = font;
        CTX.fillStyle = '#6ee7b7';
        CTX.fillText(this.text, 0, 0);

        CTX.restore();
    }

    // ── IMPACT ── full chip, bracket corners, strong glow ─────────────────────
    _drawImpact(sc) {
        const sz = this.size * this._scale;
        const font = `900 ${sz}px 'Bebas Neue', 'Orbitron', monospace`;
        CTX.font = font;
        const tw = CTX.measureText(this.text).width;
        const ph = sz * 0.38;
        const pw = sz * 0.50;
        const bw = tw + pw * 2;
        const bh = sz + ph * 2;
        const sl = 10;
        const col = this.color;

        CTX.save();
        CTX.translate(sc.x, sc.y);

        // Halo behind chip
        CTX.shadowBlur = 32;
        CTX.shadowColor = col;

        // Parallelogram chip
        CTX.beginPath();
        CTX.moveTo(-bw / 2 + sl, -bh / 2);
        CTX.lineTo(bw / 2, -bh / 2);
        CTX.lineTo(bw / 2 - sl, bh / 2);
        CTX.lineTo(-bw / 2, bh / 2);
        CTX.closePath();
        CTX.fillStyle = 'rgba(8,4,18,0.88)';
        CTX.fill();
        CTX.strokeStyle = col;
        CTX.lineWidth = 2;
        CTX.stroke();
        CTX.shadowBlur = 0;

        // Military bracket accents TL + BR
        const bkSz = 8;
        CTX.strokeStyle = col;
        CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(-bw / 2 + sl + bkSz, -bh / 2 + 2);
        CTX.lineTo(-bw / 2 + sl + 2, -bh / 2 + 2);
        CTX.lineTo(-bw / 2 + sl + 2, -bh / 2 + 2 + bkSz);
        CTX.moveTo(bw / 2 - sl - bkSz, bh / 2 - 2);
        CTX.lineTo(bw / 2 - sl - 2, bh / 2 - 2);
        CTX.lineTo(bw / 2 - sl - 2, bh / 2 - 2 - bkSz);
        CTX.stroke();

        // Text — stroke + fill + color tint
        CTX.shadowBlur = 16;
        CTX.shadowColor = col;
        CTX.lineWidth = sz * 0.10;
        CTX.strokeStyle = 'rgba(0,0,0,0.9)';
        CTX.strokeText(this.text, 0, 0);
        CTX.fillStyle = '#ffffff';
        CTX.fillText(this.text, 0, 0);
        CTX.globalAlpha *= 0.55;
        CTX.fillStyle = col;
        CTX.fillText(this.text, 0, 0);

        CTX.restore();
    }

    // ── STATUS ── small parallelogram chip, ALL-CAPS label ────────────────────
    _drawStatus(sc) {
        const sz = this.size * this._scale;
        const font = `700 ${sz}px 'Rajdhani', 'Orbitron', monospace`;
        CTX.font = font;
        const tw = CTX.measureText(this.text).width;
        const ph = sz * 0.32;
        const pw = sz * 0.45;
        const bw = tw + pw * 2;
        const bh = sz + ph * 2;
        const sl = 7;
        const col = this.color;

        CTX.save();
        CTX.translate(sc.x, sc.y);

        CTX.shadowBlur = 16;
        CTX.shadowColor = col;

        CTX.beginPath();
        CTX.moveTo(-bw / 2 + sl, -bh / 2);
        CTX.lineTo(bw / 2, -bh / 2);
        CTX.lineTo(bw / 2 - sl, bh / 2);
        CTX.lineTo(-bw / 2, bh / 2);
        CTX.closePath();
        CTX.fillStyle = 'rgba(8,4,18,0.80)';
        CTX.fill();
        CTX.strokeStyle = col;
        CTX.lineWidth = 1.5;
        CTX.stroke();

        CTX.shadowBlur = 10;
        CTX.fillStyle = '#ffffff';
        CTX.fillText(this.text, 0, 0);
        CTX.globalAlpha *= 0.50;
        CTX.fillStyle = col;
        CTX.fillText(this.text, 0, 0);

        CTX.restore();
    }

    // ── DEFAULT ── stroke + color shadow, no chip ──────────────────────────────
    _drawDefault(sc) {
        const sz = this.size * this._scale;
        CTX.save();
        CTX.translate(sc.x, sc.y);

        CTX.font = this._font || (this._font =
            `bold ${this.size}px 'Rajdhani', 'Orbitron', monospace`);
        CTX.shadowBlur = 12;
        CTX.shadowColor = this.color;
        CTX.lineWidth = sz * 0.12;
        CTX.strokeStyle = 'rgba(0,0,0,0.9)';
        CTX.strokeText(this.text, 0, 0);
        CTX.fillStyle = this.color;
        CTX.fillText(this.text, 0, 0);

        CTX.restore();
    }
}


class FloatingTextSystem {
    constructor() {
        this.texts = [];
    }

    spawn(text, x, y, color, size = 20) {
        // ── STACK OFFSET: prevent overlap when multiple texts spawn at same pos ──
        // Count live texts within CLUSTER_R world-units horizontally.
        // Each one pushes the new text up by STEP_Y world-units.
        // Cap at MAX_STACK to avoid texts flying off screen.
        const CLUSTER_R = 80;   // world px horizontal proximity threshold (40→80: จับ text ที่ spawn ใกล้กันได้กว้างขึ้น)
        const STEP_Y = 32;   // world px per stacked text (22→32: ระยะห่างมากพอให้ text ไม่ทับกัน)
        const MAX_STACK = 6;   // 5→6: รองรับ multi-spawn wave start

        let stack = 0;
        for (let i = 0, len = this.texts.length; i < len; i++) {
            const t = this.texts[i];
            if (Math.abs(t.x - x) < CLUSTER_R && Math.abs(t.y - y) < CLUSTER_R * 2) {
                stack++;
                if (stack >= MAX_STACK) break;
            }
        }
        const spawnY = y - stack * STEP_Y;

        // ── POOL: reuse a dead instance instead of allocating ──
        this.texts.push(FloatingText.acquire(text, x, spawnY, color, size));
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
                i--;
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
                i--;
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
    constructor(maxParticles = 12, theme = 'kao') {
        this.particles = [];
        this.maxParticles = maxParticles;
        this.spawnTimer = 0;
        this.intensity = 0;
        this.theme = theme; // 'kao' | 'auto' | 'poom'
    }

    update(dt, playerX, playerY, speed, extraIntensity = 0) {
        this.intensity = Math.min(1, speed / 200 + extraIntensity);

        // ── PERF: swap-and-pop O(1) + pool release ───────────────────────────
        const arr = this.particles;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt, playerX, playerY, this.intensity)) {
                arr[i].release();
                arr[i] = arr[arr.length - 1];
                arr.pop();
                i--;
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

        // ── สีตาม theme ตัวละคร ─────────────────────────────────────────────
        let color;
        if (this.theme === 'auto') {
            if (this.intensity > 0.6) color = '#f97316';       // orange  — high
            else if (this.intensity > 0.3) color = '#fbbf24';  // yellow  — medium
            else color = '#ef4444';                             // red     — low
        } else if (this.theme === 'poom') {
            if (this.intensity > 0.6) color = '#059669';        // dark emerald — high
            else if (this.intensity > 0.3) color = '#10b981';   // emerald      — medium
            else color = '#34d399';                              // mint         — low
        } else { // 'kao'
            if (this.intensity > 0.6) color = '#3b82f6';        // bright blue  — high
            else if (this.intensity > 0.3) color = '#60a5fa';   // light blue   — medium
            else color = '#93c5fd';                              // pale blue    — low
        }

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

// Global orbital particle systems — Auto, Kao, Poom
let autoOrbitalSystem = null;
let kaoOrbitalSystem = null;
let poomOrbitalSystem = null;

function initOrbitalSystems() {
    autoOrbitalSystem = new OrbitalParticleSystem(10, 'auto');
    kaoOrbitalSystem = new OrbitalParticleSystem(8, 'kao');
    poomOrbitalSystem = new OrbitalParticleSystem(8, 'poom');
}

function updateOrbitalEffects(dt, players) {
    if (!autoOrbitalSystem) initOrbitalSystems();

    players.forEach(player => {
        let system = null;
        let extraIntensity = 0;

        if (player.constructor.name === 'AutoPlayer') {
            system = autoOrbitalSystem;
            extraIntensity = (player.wanchaiActive ? 0.4 : 0);
        } else if (player.constructor.name === 'KaoPlayer') {
            system = kaoOrbitalSystem;
            extraIntensity = (player.isWeaponMaster ? 0.3 : 0);
        } else if (player.constructor.name === 'PoomPlayer') {
            system = poomOrbitalSystem;
            extraIntensity = ((player.isEatingRice || player.naga) ? 0.3 : 0);
        }

        if (system) {
            const speed = Math.hypot(player.vx, player.vy);
            system.update(dt, player.x, player.y, speed, extraIntensity);
        }
    });
}

function drawOrbitalEffects() {
    if (autoOrbitalSystem) autoOrbitalSystem.draw();
    if (kaoOrbitalSystem) kaoOrbitalSystem.draw();
    if (poomOrbitalSystem) poomOrbitalSystem.draw();
}

// ──────────────────────────────────────────────────────────────────────────────
// 🩸 DECAL SYSTEM — รอยเลือด / ซากบนพื้น (static floor marks)
// ──────────────────────────────────────────────────────────────────────────────
/**
 * Decal
 *
 * รอยเลือดหรือซากที่ฝังอยู่กับพื้น  ไม่มีการเคลื่อนที่  ค่อยๆ เฟดจางหายใน
 * ช่วงท้ายของ lifetime  วาดเป็นวงรีหลายวงซ้อนกันเพื่อให้ดูเป็นธรรมชาติ
 *
 * Spawned by: DecalSystem.spawn(x, y, color, radius)
 * Managed by: DecalSystem (singleton: decalSystem)
 */
class Decal {
    static _pool = [];
    static MAX_POOL = 120;

    constructor(x, y, color, radius, lifetime) {
        this.reset(x, y, color, radius, lifetime);
    }

    reset(x, y, color, radius, lifetime) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = radius;
        this.life = lifetime;
        this.maxLife = lifetime;
        // สร้าง blobs ครั้งเดียวตอน spawn เพื่อไม่ให้ draw ใช้ Math.random ทุกเฟรม
        this.blobs = [];
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * radius * 0.6;
            this.blobs.push({
                ox: Math.cos(a) * d,
                oy: Math.sin(a) * d,
                rx: radius * (0.4 + Math.random() * 0.6),
                ry: radius * (0.2 + Math.random() * 0.4),
                rot: Math.random() * Math.PI,
            });
        }
        return this;
    }

    static acquire(x, y, color, radius, lifetime) {
        if (Decal._pool.length > 0) {
            return Decal._pool.pop().reset(x, y, color, radius, lifetime);
        }
        return new Decal(x, y, color, radius, lifetime);
    }

    release() {
        this.blobs = [];
        if (Decal._pool.length < Decal.MAX_POOL) {
            Decal._pool.push(this);
        }
    }

    update(dt) {
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        // ── PERF: viewport cull — decals are static, cull on anchor point ───
        if (typeof CANVAS !== 'undefined') {
            const screen = worldToScreen(this.x, this.y);
            const pad = this.radius + 4;
            if (screen.x < -pad || screen.x > CANVAS.width  + pad ||
                screen.y < -pad || screen.y > CANVAS.height + pad) return;
        }

        // เฟดจางใน 20% สุดท้ายของ lifetime
        const t = this.life / this.maxLife;
        const alpha = t < 0.2 ? t / 0.2 * 0.55 : 0.55;
        if (alpha < 0.01) return;

        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;

        for (const b of this.blobs) {
            const screen = worldToScreen(this.x + b.ox, this.y + b.oy);
            CTX.save();
            CTX.translate(screen.x, screen.y);
            CTX.rotate(b.rot);
            CTX.beginPath();
            CTX.ellipse(0, 0, b.rx, b.ry, 0, 0, Math.PI * 2);
            CTX.fill();
            CTX.restore();
        }

        CTX.globalAlpha = 1;
    }
}

class DecalSystem {
    static MAX_DECALS = 80; // hard cap — เก่าสุดโดน evict

    constructor() {
        this.decals = [];
    }

    /**
     * @param {number} x         World X
     * @param {number} y         World Y
     * @param {string} color     CSS color — โทนคล้ำตามประเภทศัตรู
     * @param {number} [radius]  ขนาด (default 14)
     * @param {number} [life]    อายุขัย (default 18 วินาที)
     */
    spawn(x, y, color, radius = 14, life = 18) {
        this.decals.push(Decal.acquire(x, y, color, radius, life));
        // evict oldest เมื่อเกิน cap
        while (this.decals.length > DecalSystem.MAX_DECALS) {
            this.decals.shift().release();
        }
    }

    update(dt) {
        const arr = this.decals;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt)) {
                arr[i].release();
                arr[i] = arr[arr.length - 1];
                arr.pop();
            }
            i--;
        }
    }

    draw() {
        if (typeof CTX === 'undefined' || !CTX) return;
        for (const d of this.decals) d.draw();
    }

    clear() {
        for (const d of this.decals) d.release();
        this.decals = [];
    }
}

/** Global singleton */
var decalSystem = new DecalSystem();

// ──────────────────────────────────────────────────────────────────────────────
// 🔫 SHELL CASING SYSTEM — ปลอกกระสุนกระเด็นออกด้านข้างของปืน
// ──────────────────────────────────────────────────────────────────────────────
/**
 * ShellCasing
 *
 * สี่เหลี่ยมเล็กๆ สีทองเหลือง  กระเด็นออกไปด้านข้าง (perpendicular to aim),
 * หมุน, มี friction สูง → หยุดนิ่งบนพื้นได้เร็ว  แล้วค่อยๆ เฟดจาง
 */
class ShellCasing {
    static _pool = [];
    static MAX_POOL = 100;

    constructor(x, y, vx, vy, rotation, rotSpeed, lifetime) {
        this.reset(x, y, vx, vy, rotation, rotSpeed, lifetime);
    }

    reset(x, y, vx, vy, rotation, rotSpeed, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.rotation = rotation;
        this.rotSpeed = rotSpeed;
        this.life = lifetime;
        this.maxLife = lifetime;
        this.hasHitFloor = false;
        return this;
    }

    static acquire(x, y, vx, vy, rotation, rotSpeed, lifetime) {
        if (ShellCasing._pool.length > 0) {
            return ShellCasing._pool.pop().reset(x, y, vx, vy, rotation, rotSpeed, lifetime);
        }
        return new ShellCasing(x, y, vx, vy, rotation, rotSpeed, lifetime);
    }

    release() {
        if (ShellCasing._pool.length < ShellCasing.MAX_POOL) {
            ShellCasing._pool.push(this);
        }
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        // friction สูง → หยุดเร็ว
        this.vx *= 0.82;
        this.vy *= 0.82;
        if (!this.hasHitFloor && Math.hypot(this.vx, this.vy) < 15) {
            this.hasHitFloor = true;
            if (typeof Audio !== 'undefined' && Audio.playShellDrop) Audio.playShellDrop();
        }
        this.rotation += this.rotSpeed * dt;
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);

        // viewport cull
        if (typeof CANVAS !== 'undefined') {
            if (screen.x < -8 || screen.x > CANVAS.width + 8 ||
                screen.y < -8 || screen.y > CANVAS.height + 8) return;
        }

        const t = this.life / this.maxLife;
        // เฟดจางในช่วงครึ่งหลัง
        const alpha = t < 0.5 ? t / 0.5 * 0.9 : 0.9;
        if (alpha < 0.01) return;

        CTX.save();
        CTX.globalAlpha = alpha;
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.rotation);

        // ตัวปลอกกระสุน: สี่เหลี่ยมสีทองเหลือง 6×3 px
        CTX.fillStyle = '#fbbf24';
        CTX.fillRect(-3, -1.5, 6, 3);

        // ไฮไลต์บนขอบบน
        CTX.fillStyle = '#fde68a';
        CTX.fillRect(-3, -1.5, 6, 1);

        CTX.restore();
        CTX.globalAlpha = 1;
    }
}

class ShellCasingSystem {
    static MAX_CASINGS = 120;

    constructor() {
        this.casings = [];
    }

    /**
     * ดีดปลอกกระสุน
     * @param {number} x         World X (ตำแหน่งผู้เล่น)
     * @param {number} y         World Y
     * @param {number} aimAngle  มุมที่ผู้เล่นกำลังเล็ง (radians)
     * @param {number} [speed]   ความเร็วเริ่มต้น (default 120)
     */
    spawn(x, y, aimAngle, speed = 120) {
        // ปลอกกระเด็นออกทางขวาของทิศยิง + สุ่มเบี่ยงเล็กน้อย
        const side = aimAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        const s = speed * (0.7 + Math.random() * 0.6);
        const vx = Math.cos(side) * s;
        const vy = Math.sin(side) * s;
        const rot = Math.random() * Math.PI * 2;
        const rotSpeed = (Math.random() - 0.5) * 20;
        const life = 5 + Math.random() * 3;

        this.casings.push(ShellCasing.acquire(x, y, vx, vy, rot, rotSpeed, life));

        while (this.casings.length > ShellCasingSystem.MAX_CASINGS) {
            this.casings.shift().release();
        }
    }

    update(dt) {
        const arr = this.casings;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt)) {
                arr[i].release();
                arr[i] = arr[arr.length - 1];
                arr.pop();
            }
            i--;
        }
    }

    draw() {
        if (typeof CTX === 'undefined' || !CTX) return;
        for (const c of this.casings) c.draw();
    }

    clear() {
        for (const c of this.casings) c.release();
        this.casings = [];
    }
}

/** Global singleton */
var shellCasingSystem = new ShellCasingSystem();

// ══════════════════════════════════════════════════════════════
// WaveAnnouncementFX — Cinematic wave number announcement
// update(dt) / draw(ctx) pattern — ไม่มี state ใน draw()
// ══════════════════════════════════════════════════════════════
class WaveAnnouncementFX {
    constructor() {
        this._timer = 0;
        this._duration = 3.5;   // ยืดเล็กน้อยเพื่อให้ event badge อ่านได้
        this._wave = 0;
        this._isBoss = false;
        this._isGlitch = false;
        // event badge (fog/speed) — แสดงร่วมในป้ายเดียวกัน
        this._eventType = null;  // null | 'fog' | 'speed'
        this._eventTitle = '';
        this._eventSubtitle = '';
        this._eventColor = '#fff';
        this._barH = 0;
        this._active = false;
    }

    /** Call once per wave start */
    trigger(waveNum, isBoss = false, isGlitch = false) {
        this._wave = waveNum;
        this._isBoss = isBoss;
        this._isGlitch = isGlitch;
        this._eventType = null;
        this._eventTitle = '';
        this._eventSubtitle = '';
        this._eventColor = '#fff';
        this._timer = this._duration;
        this._barH = 0;
        this._active = true;
    }

    /**
     * เรียกหลัง trigger() เพื่อแนบ wave-event badge เข้าป้ายเดียวกัน
     * @param {'fog'|'speed'} type
     * @param {string} title      เช่น "SPEED WAVE"
     * @param {string} subtitle   เช่น "ENEMIES ACCELERATED"
     * @param {string} color      hex color string
     */
    attachEvent(type, title, subtitle, color) {
        this._eventType = type;
        this._eventTitle = title;
        this._eventSubtitle = subtitle;
        this._eventColor = color;
    }

    get active() { return this._active; }

    update(dt) {
        if (!this._active) return;
        this._timer -= dt;
        // Animate letterbox bar height: in 0.3s → hold → out 0.4s
        const t = this._timer;
        const d = this._duration;
        const targetBarH = (t > d - 0.3 || t < 0.4) ? 0 : 0.09;
        this._barH += (targetBarH - this._barH) * Math.min(1, dt * 14);
        if (this._timer <= 0) {
            this._timer = 0;
            this._active = false;
            this._barH = 0;
        }
    }

    draw(ctx) {
        if (!this._active) return;
        if (typeof ctx === 'undefined' || !ctx) return;

        const W = ctx.canvas.width;
        const H = ctx.canvas.height;

        const elapsed = this._duration - this._timer;
        let alpha = elapsed < 0.3
            ? elapsed / 0.3
            : this._timer < 0.5 ? this._timer / 0.5 : 1;
        alpha = Math.max(0, Math.min(1, alpha));
        if (alpha < 0.01) return;

        const isBoss = this._isBoss;
        const isGlitch = this._isGlitch;
        const wave = this._wave;
        const hasEvent = !!this._eventType;

        // ── Color palette ──────────────────────────────────────
        const accentCol = isBoss ? '#ef4444'
            : isGlitch ? '#d946ef'
                : '#facc15';
        const accentRGB = isBoss ? '239,68,68'
            : isGlitch ? '217,70,239'
                : '250,204,21';

        ctx.save();
        ctx.globalAlpha = alpha;

        // ── Letterbox bar (top edge only) ──────────────────────
        const barH = Math.round(this._barH * H);
        if (barH > 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.72)';
            ctx.fillRect(0, 0, W, barH);
            ctx.fillStyle = `rgba(${accentRGB},0.45)`;
            ctx.fillRect(0, barH - 1, W, 1);
        }

        // ── Layout: top-anchored ───────────────────────────────
        const cx = W / 2;
        const eventExtraH = hasEvent ? 36 : 0;
        const ph = 88 + eventExtraH;   // total panel height
        const cy = 72 + ph / 2;         // top edge ≈ 72px from screen top
        const pw = Math.min(W * 0.72, 520);
        const sl = 16;                  // parallelogram slant

        const holdProgress = Math.max(0, elapsed - 0.3);
        const pulse = 1 + Math.sin(holdProgress * 3.5) * 0.012;

        ctx.save();
        ctx.translate(cx, cy); ctx.scale(pulse, pulse); ctx.translate(-cx, -cy);

        // Panel shadow + background
        ctx.shadowBlur = 60;
        ctx.shadowColor = `rgba(${accentRGB},0.4)`;
        ctx.beginPath();
        ctx.moveTo(cx - pw / 2 + sl, cy - ph / 2);
        ctx.lineTo(cx + pw / 2, cy - ph / 2);
        ctx.lineTo(cx + pw / 2 - sl, cy + ph / 2);
        ctx.lineTo(cx - pw / 2, cy + ph / 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(4,2,12,0.93)';
        ctx.fill();

        // Panel border
        ctx.shadowBlur = 18;
        ctx.strokeStyle = accentCol;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Scanline fill (clipped to panel)
        ctx.save();
        ctx.clip();
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = accentCol;
        for (let ly = cy - ph / 2 + 1; ly < cy + ph / 2; ly += 4)
            ctx.fillRect(cx - pw / 2 + sl + 1, ly, pw - sl * 2 - 2, 1);
        ctx.restore();

        // Divider between event strip and wave body
        if (hasEvent) {
            const divY = cy - ph / 2 + eventExtraH;
            ctx.save();
            ctx.globalAlpha = 0.28;
            ctx.strokeStyle = this._eventColor;
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(cx - pw / 2 + sl + 8, divY);
            ctx.lineTo(cx + pw / 2 - sl - 8, divY);
            ctx.stroke();
            ctx.restore();
        }

        // Corner brackets
        const bk = 13;
        ctx.shadowBlur = 0;
        ctx.strokeStyle = accentCol;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cx - pw / 2 + sl + bk, cy - ph / 2 + 3);
        ctx.lineTo(cx - pw / 2 + sl + 3, cy - ph / 2 + 3);
        ctx.lineTo(cx - pw / 2 + sl + 3, cy - ph / 2 + 3 + bk);
        ctx.moveTo(cx + pw / 2 - sl - bk, cy + ph / 2 - 3);
        ctx.lineTo(cx + pw / 2 - sl - 3, cy + ph / 2 - 3);
        ctx.lineTo(cx + pw / 2 - sl - 3, cy + ph / 2 - 3 - bk);
        ctx.stroke();

        // ═══ EVENT BADGE STRIP ════════════════════════════════
        if (hasEvent) {
            const evCy = cy - ph / 2 + eventExtraH / 2;
            const evCol = this._eventColor;
            const evRGB = evCol === '#ef4444' ? '239,68,68'
                : evCol === '#d97706' ? '217,119,6'
                    : '255,255,255';
            const icon = this._eventType === 'speed' ? '⚡' : '🌫';

            // Icon pill
            const pillX = cx - pw / 2 + sl + 22;
            ctx.shadowBlur = 10;
            ctx.shadowColor = evCol;
            ctx.fillStyle = evCol;
            ctx.globalAlpha = 0.16;
            ctx.beginPath(); ctx.roundRect(pillX - 10, evCy - 9, 20, 18, 3); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = evCol;
            ctx.lineWidth = 1.0;
            ctx.beginPath(); ctx.roundRect(pillX - 10, evCy - 9, 20, 18, 3); ctx.stroke();
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = evCol;
            ctx.fillText(icon, pillX, evCy);

            // Event title
            ctx.shadowBlur = 14;
            ctx.shadowColor = evCol;
            ctx.fillStyle = '#ffffff';
            ctx.font = '800 13px "Orbitron","Rajdhani",Arial,sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(this._eventTitle, pillX + 16, evCy - 1);

            // Event subtitle (right-aligned, dim)
            ctx.shadowBlur = 4;
            ctx.fillStyle = `rgba(${evRGB},0.72)`;
            ctx.font = '600 9px "Rajdhani",Arial,sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(this._eventSubtitle, cx + pw / 2 - sl - 14, evCy);
            ctx.shadowBlur = 0;
        }

        // ═══ WAVE NUMBER BODY ════════════════════════════════
        const waveBodyTop = cy - ph / 2 + eventExtraH;
        const waveH = ph - eventExtraH;
        const waveCy = waveBodyTop + waveH / 2;

        // Wave label (small top line)
        const labelText = isBoss ? '⚔ BOSS ENCOUNTER'
            : isGlitch ? '⚠ ANOMALY DETECTED'
                : `— WAVE ${wave} —`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = accentCol;
        ctx.fillStyle = accentCol;
        ctx.font = '700 11px "Rajdhani","Orbitron",Arial,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.letterSpacing = '3px';
        ctx.fillText(labelText, cx, waveCy - 24);

        // Main wave number / name
        const mainText = isBoss
            ? (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS?.wave?.boss
                ? GAME_TEXTS.wave.boss(wave) : `WAVE ${wave}`)
            : isGlitch
                ? (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS?.wave?.glitchWave
                    ? 'GLITCH WAVE' : `WAVE ${wave} [GLITCH]`)
                : (typeof GAME_TEXTS !== 'undefined' && GAME_TEXTS?.wave?.floatingTitle
                    ? GAME_TEXTS.wave.floatingTitle(wave) : `WAVE ${wave}`);

        ctx.shadowBlur = 22;
        ctx.shadowColor = accentCol;
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 32px "Bebas Neue","Orbitron",Arial,sans-serif';
        ctx.fillText(mainText, cx, waveCy + 6);
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = accentCol;
        ctx.fillText(mainText, cx, waveCy + 6);
        ctx.restore();

        // Subtitle
        const subText = isBoss ? 'PREPARE FOR COMBAT'
            : isGlitch ? 'CONTROLS INVERTED'
                : wave <= 3 ? 'ELIMINATE ALL ENEMIES'
                    : wave <= 8 ? 'HOLD YOUR GROUND'
                        : wave <= 12 ? 'DANGER LEVEL: HIGH'
                            : 'FINAL STAND';
        ctx.shadowBlur = 6;
        ctx.shadowColor = accentCol;
        ctx.fillStyle = 'rgba(254,243,199,0.75)';
        ctx.font = '600 10px "Rajdhani",Arial,sans-serif';
        ctx.fillText(subText, cx, waveCy + 30);

        // Tick marks flanking subtitle
        const tkX = pw / 2 - sl - 22;
        ctx.strokeStyle = `rgba(${accentRGB},0.45)`;
        ctx.lineWidth = 1.2;
        for (let t2 = 0; t2 < 3; t2++) {
            const d2 = t2 * 5;
            ctx.beginPath();
            ctx.moveTo(cx + tkX + d2, waveCy + 22); ctx.lineTo(cx + tkX + d2, waveCy + 38);
            ctx.moveTo(cx - tkX - d2, waveCy + 22); ctx.lineTo(cx - tkX - d2, waveCy + 38);
            ctx.stroke();
        }

        ctx.restore(); // pulse scale
        ctx.restore(); // alpha
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// PAT (Samurai Ronin) — Effect Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Spawn Pat Zanzo afterimage trail.
 * Call once when _doZanzoFlash() fires — spawns N ghost silhouettes
 * spread across the blink path (farthest ghost = lowest alpha).
 *
 * @param {number} fromX   Origin world X
 * @param {number} fromY   Origin world Y
 * @param {number} toX     Destination world X
 * @param {number} toY     Destination world Y
 * @param {number} angle   Pat's facing angle (radians)
 * @param {number} count   Number of ghost sprites (default 4)
 */
function spawnZanzoTrail(fromX, fromY, toX, toY, angle, count = 4) {
    if (typeof particleSystem === 'undefined') return;
    const dx = toX - fromX;
    const dy = toY - fromY;
    for (let i = 0; i < count; i++) {
        const frac = i / count;                // 0 = origin, near 1 = destination
        const gx = fromX + dx * frac;
        const gy = fromY + dy * frac;
        const alphaScale = 0.90 - frac * 0.45; // origin ghost brighter, destination ghost dim
        particleSystem.spawn(gx, gy, 1, '#4a90d9', 'zanzo', {
            angle,
            alphaScale,
            size: 17,
            lifetime: 0.35
        });
    }
}

/**
 * Spawn Iaido blood burst on lethal hit.
 * Directed outward from impact point, dark crimson.
 *
 * @param {number} x      World X of enemy
 * @param {number} y      World Y of enemy
 * @param {number} count  Particle count (default 18 — iaidoBloodParticles)
 */
function spawnBloodBurst(x, y, count = 18) {
    if (typeof particleSystem === 'undefined') return;
    // Heavy blood splatter — larger, slower particles in crimson
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 80 + (i % 3) * 60;   // varied speed without random alloc
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const size = 3 + (i % 4);           // 3–6px, deterministic
        const life = 0.4 + (i % 3) * 0.15; // 0.4–0.7s, deterministic
        particleSystem.particles.push(
            Particle.acquire(x, y, vx, vy, '#cc2222', size, life, 'circle', {})
        );
        while (particleSystem.particles.length > ParticleSystem.MAX_PARTICLES) {
            particleSystem.particles.shift().release();
        }
    }
    // Small bright core burst (whitish-red) for immediate impact flash
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const vx = Math.cos(angle) * 200;
        const vy = Math.sin(angle) * 200;
        particleSystem.particles.push(
            Particle.acquire(x, y, vx, vy, '#ff4444', 2, 0.18, 'circle', {})
        );
        while (particleSystem.particles.length > ParticleSystem.MAX_PARTICLES) {
            particleSystem.particles.shift().release();
        }
    }
}

/**
 * Spawn katana slash wave arc effect at attack origin.
 * Creates a fan of blade-energy streak particles spreading in the attack direction.
 * Called from PatPlayer._doSlashWave() and _doMeleeCombo().
 *
 * @param {number}  x       World X of attack origin
 * @param {number}  y       World Y of attack origin
 * @param {number}  angle   Aim angle (radians)
 * @param {boolean} isCrit  Gold (crit) vs ice-blue (normal) colour
 */
function spawnKatanaSlashArc(x, y, angle, isCrit = false) {
    if (typeof particleSystem === 'undefined') return;
    const color = isCrit ? '#facc15' : '#7ec8e3';
    const coreColor = isCrit ? '#fff4c0' : '#d0f0ff';
    const spread = isCrit ? Math.PI * 0.60 : Math.PI * 0.50; // arc spread
    const count = isCrit ? 16 : 12;

    for (let i = 0; i < count; i++) {
        // Fan particles spread evenly across the arc
        const t = count > 1 ? i / (count - 1) : 0.5;
        const a = angle - spread * 0.5 + spread * t;
        const speed = 220 + (i % 3) * 70;     // deterministic speed variation
        const vx = Math.cos(a) * speed;
        const vy = Math.sin(a) * speed;
        const size = 3.5 + (i % 3) * 0.8;     // 3.5–5.1px
        const life = 0.14 + (i % 4) * 0.022;  // 0.14–0.21s
        particleSystem.particles.push(
            Particle.acquire(x, y, vx, vy, color, size, life, 'slash_arc', { angle: a })
        );
        while (particleSystem.particles.length > ParticleSystem.MAX_PARTICLES) {
            particleSystem.particles.shift().release();
        }
    }

    // Bright core flash particles (short-lived, forward-biased)
    for (let i = 0; i < 5; i++) {
        const a = angle + (i - 2) * 0.12;
        const vx = Math.cos(a) * 380;
        const vy = Math.sin(a) * 380;
        particleSystem.particles.push(
            Particle.acquire(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10,
                vx, vy, coreColor, 2.5, 0.10, 'slash_arc', { angle: a })
        );
        while (particleSystem.particles.length > ParticleSystem.MAX_PARTICLES) {
            particleSystem.particles.shift().release();
        }
    }
}
window.spawnZanzoTrail = spawnZanzoTrail;
window.spawnBloodBurst = spawnBloodBurst;
window.spawnKatanaSlashArc = spawnKatanaSlashArc;

/** Global singleton */
var waveAnnouncementFX = new WaveAnnouncementFX();

// ── Explicit window exports ────────────────────────────────────────────────────
window.waveAnnouncementFX = waveAnnouncementFX;
window.decalSystem = decalSystem;
window.shellCasingSystem = shellCasingSystem;

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
        MeteorStrike,
        spawnParticles, spawnFloatingText,
        spawnWanchaiPunchText,
        spawnZanzoTrail, spawnBloodBurst, spawnKatanaSlashArc,
        drawGlitchEffect,
        OrbitalParticle, OrbitalParticleSystem,
        initOrbitalSystems, updateOrbitalEffects, drawOrbitalEffects,
        Decal, DecalSystem, decalSystem,
        ShellCasing, ShellCasingSystem, shellCasingSystem,
    };
}