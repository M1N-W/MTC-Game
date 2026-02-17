/**
 * 💥 MTC: ENHANCED EDITION - Effects System
 * Particles, floating text, and special effects
 *
 * GLITCH WAVE (v8 — NEW):
 * - ✅ drawGlitchEffect(intensity, controlsInverted) — top-level export
 *       called from game.js drawGame() when isGlitchWave is true
 * - ✅ RGB Split:  canvas snapshot drawn 3× with R/G/B composite modes
 *       and jittered offsets proportional to intensity
 * - ✅ Scanlines:  horizontal dark bars at 3-px intervals
 * - ✅ Chromatic noise: random pixel-sized colour sparks
 * - ✅ Vignette:  radial darkening at screen edges
 * - ✅ "GLITCH" banner: animated text with random character substitution
 * - ✅ Inverted-controls overlay: pink strip warning at screen bottom
 * - ✅ PERFORMANCE: uses a single ImageData snapshot per call;
 *       no extra <canvas> elements created at runtime
 */

// ──────────────────────────────────────────────────────────────────────────────
// Particle System
// ──────────────────────────────────────────────────────────────────────────────
class Particle {
    constructor(x, y, vx, vy, color, size, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = lifetime;
        this.maxLife = lifetime;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Apply friction
        this.vx *= 0.95;
        this.vy *= 0.95;

        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const alpha = this.life / this.maxLife;

        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, this.size * alpha, 0, Math.PI * 2);
        CTX.fill();
        CTX.globalAlpha = 1;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    spawn(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = rand(100, 400);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = rand(2, 5);
            const lifetime = rand(0.3, 0.8);

            this.particles.push(new Particle(x, y, vx, vy, color, size, lifetime));
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
const particleSystem    = new ParticleSystem();
const floatingTextSystem = new FloatingTextSystem();

// Helper functions for global use
function spawnParticles(x, y, count, color) {
    particleSystem.spawn(x, y, count, color);
}

function spawnFloatingText(text, x, y, color, size = 20) {
    floatingTextSystem.spawn(text, x, y, color, size);
}

// ──────────────────────────────────────────────────────────────────────────────
// ⚡ GLITCH EFFECT ENGINE
// ──────────────────────────────────────────────────────────────────────────────
/**
 * drawGlitchEffect(intensity, controlsInverted)
 *
 * Called from game.js drawGame() every frame while isGlitchWave is true.
 * Draws purely on top of the finished frame — no game state is touched.
 *
 * Layers (painted in order):
 *   1. RGB SPLIT  — snapshot the canvas, re-draw 3× with R/G/B channel
 *                   composite modes at random offsets.
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
    // Snapshot the current frame into an ImageData buffer once, then
    // draw it three times with isolated R/G/B channels and jitter.
    // We DON'T create a new canvas — we use the existing CTX snapshot
    // by taking a drawImage of CANVAS itself (safe within the same frame
    // because we draw on top of what was already composited).
    //
    // Maximum offset in pixels — scales with intensity
    const maxOff = Math.floor(intensity * 18);
    if (maxOff >= 1) {
        // Per-frame deterministic jitter (changes every ~3 frames for stutter feel)
        const seed    = Math.floor(now / 50);
        const jitterX = ((seed * 1372) % (maxOff * 2 + 1)) - maxOff;
        const jitterY = ((seed * 853)  % (maxOff + 1)) - Math.floor(maxOff / 2);

        // ── Red channel ──
        CTX.save();
        CTX.globalCompositeOperation = 'screen';
        CTX.globalAlpha = intensity * 0.55;
        // Clip to only the red channel using a CSS filter trick:
        // draw with red tint by using 'multiply' + a red fill below.
        // Simpler & more performant: just draw with a red tinted copy
        // at offset, which is the standard RGB-split technique.
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
    // Thin horizontal bars every 3 pixels, opacity scales with intensity.
    // A subtle vertical scroll offset creates a moving interference pattern.
    const scanAlpha  = intensity * 0.22;
    const scanScroll = Math.floor(now / 80) % 3; // 0,1,2 rolling offset
    CTX.save();
    CTX.globalAlpha = scanAlpha;
    CTX.fillStyle   = '#000';
    for (let y = scanScroll; y < H; y += 3) {
        CTX.fillRect(0, y, W, 1);
    }
    CTX.restore();

    // ── 3. CHROMATIC NOISE ───────────────────────────────────────
    // Randomly scattered vivid sparks — count proportional to intensity.
    // Intentionally NOT seeded per frame so they flicker independently.
    const sparkCount = Math.floor(intensity * 80);
    const sparkColors = ['#ff00ff', '#00ffff', '#ff3399', '#39ff14', '#ffffff', '#ff6600'];
    CTX.save();
    for (let i = 0; i < sparkCount; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H;
        const sw = 1 + Math.floor(Math.random() * 3);
        const sh = sw;
        CTX.globalAlpha  = 0.35 + Math.random() * 0.65;
        CTX.fillStyle    = sparkColors[Math.floor(Math.random() * sparkColors.length)];
        CTX.fillRect(sx, sy, sw, sh);
    }
    CTX.restore();

    // ── 4. HORIZONTAL GLITCH SLICES ──────────────────────────────
    // Occasional full-width strips shifted horizontally — the iconic
    // "VHS tracking" look.  Only fire on peak intensity frames.
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
            // Grab the strip and redraw it shifted
            CTX.drawImage(CANVAS, 0, sliceY, W, sliceH, sliceOff, sliceY, W, sliceH);
            CTX.restore();
        }
    }

    // ── 5. VIGNETTE ──────────────────────────────────────────────
    // Radial gradient darkening at screen edges.
    // Pulsates slightly to reinforce the "unstable" feel.
    const vigAlpha   = intensity * (0.35 + Math.sin(now / 180) * 0.1);
    const vigGrad    = CTX.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.85);
    vigGrad.addColorStop(0, 'rgba(100,0,120,0)');
    vigGrad.addColorStop(1, `rgba(60,0,80,${vigAlpha.toFixed(3)})`);
    CTX.save();
    CTX.fillStyle = vigGrad;
    CTX.fillRect(0, 0, W, H);
    CTX.restore();

    // ── 6. GLITCH BANNER ─────────────────────────────────────────
    // "⚡ GLITCH WAVE" rendered with randomised character corruption
    // and a chromatic double-shadow so it reads as a system error.
    {
        const bannerY   = H * 0.12;
        const baseText  = '⚡ GLITCH WAVE ⚡';
        const glitchChars = '!@#$%^&*<>?/\\|';
        // Corrupt ~20% of non-space, non-emoji characters
        let displayText = '';
        for (let i = 0; i < baseText.length; i++) {
            const ch = baseText[i];
            if (ch !== ' ' && ch !== '⚡' && Math.random() < 0.18 * intensity) {
                displayText += glitchChars[Math.floor(Math.random() * glitchChars.length)];
            } else {
                displayText += ch;
            }
        }

        const fontSize  = Math.floor(28 + intensity * 8);
        const pulse     = 0.7 + Math.sin(now / 90) * 0.3;

        CTX.save();
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.font         = `bold ${fontSize}px Orbitron, monospace`;

        // Cyan shadow offset
        CTX.fillStyle    = `rgba(0,255,255,${(intensity * pulse * 0.7).toFixed(3)})`;
        CTX.fillText(displayText, W / 2 + 3, bannerY + 2);

        // Red shadow offset
        CTX.fillStyle    = `rgba(255,0,100,${(intensity * pulse * 0.7).toFixed(3)})`;
        CTX.fillText(displayText, W / 2 - 3, bannerY - 2);

        // Main text — white with slight magenta tint
        CTX.shadowBlur   = 14 * intensity;
        CTX.shadowColor  = '#d946ef';
        CTX.fillStyle    = `rgba(255,220,255,${(pulse * 0.92).toFixed(3)})`;
        CTX.fillText(displayText, W / 2, bannerY);
        CTX.shadowBlur   = 0;

        // Sub-label — small corrupted status line
        const statusChars = ['REALITY.EXE', 'PHYSICS.DLL', 'CONTROLS.SYS', 'MEMORY.ERR', 'WAVE_DATA.BIN'];
        const statusIdx   = Math.floor(now / 400) % statusChars.length;
        CTX.font          = `bold 11px monospace`;
        CTX.fillStyle     = `rgba(236,72,153,${intensity * 0.85})`;
        CTX.fillText(`[ ${statusChars[statusIdx]} HAS STOPPED WORKING ]`, W / 2, bannerY + fontSize * 0.9);

        CTX.restore();
    }

    // ── 7. INVERTED CONTROLS STRIP ───────────────────────────────
    // Pink translucent bar at the bottom of the screen with a
    // flashing ↕ ↔ icon. Only shown when controlsInverted is true.
    if (controlsInverted) {
        const stripH    = 38;
        const stripY    = H - stripH;
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
        EquationSlam, DeadlyGraph, MeteorStrike,
        spawnParticles, spawnFloatingText,
        drawGlitchEffect
    };
}