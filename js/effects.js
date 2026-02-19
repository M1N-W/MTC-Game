'use strict';
/**
 * 💥 MTC: ENHANCED EDITION - Effects System
 * Particles, floating text, and special effects
 * WEATHER SYSTEM (v9 — NEW):
 *   ✅ WeatherSystem class — atmospheric rain & snow effects
 *   ✅ Rain: spawns at screen top, falls with speed + wind drift, drawn as thin blue lines
 *   ✅ Snow: spawns at screen top, falls slowly with sin() horizontal sway, drawn as white circles
 *   ✅ Optimized: MAX_PARTICLES cap (200), off-screen culling, efficient array reuse
 *   ✅ API: weatherSystem.setWeather('rain'|'snow'|'none'), update(dt, camera), draw()
 * GLITCH WAVE (v8 — unchanged):
 *   ✅ drawGlitchEffect(intensity, controlsInverted) — top-level export
 * PERFORMANCE (v8):
 *   ✅ ParticleSystem.MAX_PARTICLES = 150  — hard cap; oldest particle evicted
 *      when spawn() would exceed the limit.  Prevents runaway memory growth
 *      during Glitch Wave (2× enemies × heavy particle deaths).
 *   ✅ Particle.draw(): shadowBlur is SKIPPED for particles whose rendered
 *      radius is < 3 screen pixels.  shadowBlur triggers a full offscreen
 *      compositing pass in every browser engine — it is the #1 per-particle
 *      cost even though most tiny particles are invisible at that size.
 *      Particles with size ≥ 3 still get the blur for visual quality.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Particle System
// ──────────────────────────────────────────────────────────────────────────────
class Particle {
    constructor(x, y, vx, vy, color, size, lifetime, type = 'circle', data = {}) {
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
            CTX.strokeRect(-w/2, -h/2, w, h);

            // Fill slightly
            CTX.globalAlpha = alpha * 0.3;
            CTX.fillRect(-w/2, -h/2, w, h);

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
            CTX.shadowBlur  = 4;
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

            this.particles.push(new Particle(x, y, vx, vy, color, size, lifetime, type, data));

            // Evict oldest particle if we exceed the cap
            while (this.particles.length > ParticleSystem.MAX_PARTICLES) {
                this.particles.shift();   // remove oldest (front of array)
            }
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            if (this.particles[i].update(dt)) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        for (let particle of this.particles) {
            particle.draw();
        }
    }

    clear() {
        this.particles = [];
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Floating Text System
// ──────────────────────────────────────────────────────────────────────────────
class FloatingText {
    constructor(text, x, y, color, size = 20) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.life = 1.5;
        this.vy = -80;
    }

    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const alpha = Math.min(1, this.life);

        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;
        CTX.font = `bold ${this.size}px Orbitron, monospace`;
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
        this.texts.push(new FloatingText(text, x, y, color, size));
    }

    update(dt) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            if (this.texts[i].update(dt)) {
                this.texts.splice(i, 1);
            }
        }
    }

    draw() {
        for (let text of this.texts) {
            text.draw();
        }
    }

    clear() {
        this.texts = [];
    }
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
        CTX.globalAlpha = 0.4 + Math.random() * 0.2;
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
        CTX.globalAlpha = 0.6 + Math.random() * 0.3;
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
            this.particles = [];
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

        // Update existing particles (remove if off-screen)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const shouldRemove = this.particles[i].update(dt, camera);
            if (shouldRemove) {
                this.particles.splice(i, 1);
            }
        }

        // Hard cap enforcement (evict oldest if needed)
        while (this.particles.length > WeatherSystem.MAX_PARTICLES) {
            this.particles.shift();
        }
    }

    draw() {
        if (this.mode === 'none') return;

        for (let particle of this.particles) {
            particle.draw();
        }
    }

    _spawnParticle(camera) {
        // Spawn at top of visible screen with some padding
        const screenTop   = camera.y - 10;
        const screenLeft  = camera.x - 50;
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
        this.activeDuration   = duration !== null ? duration / 2 : 5;
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
var particleSystem     = new ParticleSystem();
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
    const W   = CANVAS.width;
    const H   = CANVAS.height;
    const now = performance.now();

    // ── 1. RGB SPLIT ─────────────────────────────────────────────
    const maxOff = Math.floor(intensity * 18);
    if (maxOff >= 1) {
        const seed    = Math.floor(now / 50);
        const jitterX = ((seed * 1372) % (maxOff * 2 + 1)) - maxOff;
        const jitterY = ((seed * 853)  % (maxOff + 1)) - Math.floor(maxOff / 2);

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
    const scanAlpha  = intensity * 0.22;
    const scanScroll = Math.floor(now / 80) % 3;
    CTX.save();
    CTX.globalAlpha = scanAlpha;
    CTX.fillStyle   = '#000';
    for (let y = scanScroll; y < H; y += 3) {
        CTX.fillRect(0, y, W, 1);
    }
    CTX.restore();

    // ── 3. CHROMATIC NOISE ───────────────────────────────────────
    const sparkCount  = Math.floor(intensity * 80);
    const sparkColors = ['#ff00ff', '#00ffff', '#ff3399', '#39ff14', '#ffffff', '#ff6600'];
    CTX.save();
    for (let i = 0; i < sparkCount; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H;
        const sw = 1 + Math.floor(Math.random() * 3);
        const sh = sw;
        CTX.globalAlpha = 0.35 + Math.random() * 0.65;
        CTX.fillStyle   = sparkColors[Math.floor(Math.random() * sparkColors.length)];
        CTX.fillRect(sx, sy, sw, sh);
    }
    CTX.restore();

    // ── 4. HORIZONTAL GLITCH SLICES ──────────────────────────────
    if (intensity > 0.55) {
        const sliceSeed = Math.floor(now / 120);
        const numSlices = Math.floor(intensity * 4);
        for (let s = 0; s < numSlices; s++) {
            const sliceY   = ((sliceSeed * (s + 1) * 397) % H);
            const sliceH   = 2 + ((sliceSeed * (s + 1) * 113) % 8);
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
    const vigGrad  = CTX.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
    vigGrad.addColorStop(0, 'rgba(100,0,120,0)');
    vigGrad.addColorStop(1, `rgba(60,0,80,${vigAlpha.toFixed(3)})`);
    CTX.save();
    CTX.fillStyle = vigGrad;
    CTX.fillRect(0, 0, W, H);
    CTX.restore();

    // ── 6. GLITCH BANNER ─────────────────────────────────────────
    {
        const bannerY     = H * 0.12;
        const baseText    = '⚡ GLITCH WAVE ⚡';
        const glitchChars = '!@#$%^&*<>?/\\|';
        let displayText   = '';
        for (let i = 0; i < baseText.length; i++) {
            const ch = baseText[i];
            if (ch !== ' ' && ch !== '⚡' && Math.random() < 0.18 * intensity) {
                displayText += glitchChars[Math.floor(Math.random() * glitchChars.length)];
            } else {
                displayText += ch;
            }
        }

        const fontSize = Math.floor(28 + intensity * 8);
        const pulse    = 0.7 + Math.sin(now / 90) * 0.3;

        CTX.save();
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.font         = `bold ${fontSize}px Orbitron, monospace`;

        // Cyan shadow offset
        CTX.fillStyle = `rgba(0,255,255,${(intensity * pulse * 0.7).toFixed(3)})`;
        CTX.fillText(displayText, W / 2 + 3, bannerY + 2);

        // Red shadow offset
        CTX.fillStyle = `rgba(255,0,100,${(intensity * pulse * 0.7).toFixed(3)})`;
        CTX.fillText(displayText, W / 2 - 3, bannerY - 2);

        // Main text — white with slight magenta tint
        CTX.shadowBlur  = 14 * intensity;
        CTX.shadowColor = '#d946ef';
        CTX.fillStyle   = `rgba(255,220,255,${(pulse * 0.92).toFixed(3)})`;
        CTX.fillText(displayText, W / 2, bannerY);
        CTX.shadowBlur  = 0;

        // Sub-label — small corrupted status line
        const statusChars = ['REALITY.EXE', 'PHYSICS.DLL', 'CONTROLS.SYS', 'MEMORY.ERR', 'WAVE_DATA.BIN'];
        const statusIdx   = Math.floor(now / 400) % statusChars.length;
        CTX.font          = `bold 11px monospace`;
        CTX.fillStyle     = `rgba(236,72,153,${intensity * 0.85})`;
        CTX.fillText(`[ ${statusChars[statusIdx]} HAS STOPPED WORKING ]`, W / 2, bannerY + fontSize * 0.9);

        CTX.restore();
    }

    // ── 7. INVERTED CONTROLS STRIP ───────────────────────────────
    if (controlsInverted) {
        const stripH     = 38;
        const stripY     = H - stripH;
        const flashAlpha = 0.7 + Math.sin(now / 80) * 0.3;

        CTX.save();

        // Background bar
        CTX.globalAlpha = 0.82;
        CTX.fillStyle   = '#7e0040';
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
        CTX.globalAlpha  = flashAlpha;
        CTX.fillStyle    = '#ffffff';
        CTX.font         = 'bold 15px Orbitron, monospace';
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.shadowBlur   = 10;
        CTX.shadowColor  = '#ff00aa';
        CTX.fillText('⚡  CONTROLS INVERTED — W↔S   A↔D  ⚡', W / 2, stripY + stripH / 2);
        CTX.shadowBlur   = 0;

        CTX.restore();
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Export
// ──────────────────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Particle, ParticleSystem, particleSystem,
        FloatingText, FloatingTextSystem, floatingTextSystem,
        Raindrop, Snowflake, WeatherSystem, weatherSystem,
        EquationSlam, DeadlyGraph, MeteorStrike,
        spawnParticles, spawnFloatingText,
        drawGlitchEffect
    };
}