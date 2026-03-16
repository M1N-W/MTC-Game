'use strict';

/**
 * js/effects/OrbitalEffects.js
 * ════════════════════════════════════════════════
 * Character-specific orbital particle rings.
 * ════════════════════════════════════════════════
 */

class OrbitalParticle {
    static _pool = [];
    static MAX_POOL = 40;
    constructor(x, y, orbitRadius, angle, speed, size, color, lifetime) { this.reset(x, y, orbitRadius, angle, speed, size, color, lifetime); }
    reset(x, y, orbitRadius, angle, speed, size, color, lifetime) {
        this.centerX = x; this.centerY = y; this.orbitRadius = orbitRadius; this.angle = angle;
        this.speed = speed; this.size = size; this.color = color; this.life = lifetime;
        this.maxLife = lifetime; this.wobble = Math.random() * Math.PI * 2; return this;
    }
    static acquire(x, y, orbitRadius, angle, speed, size, color, lifetime) {
        if (OrbitalParticle._pool.length > 0) return OrbitalParticle._pool.pop().reset(x, y, orbitRadius, angle, speed, size, color, lifetime);
        return new OrbitalParticle(x, y, orbitRadius, angle, speed, size, color, lifetime);
    }
    release() { if (OrbitalParticle._pool.length < OrbitalParticle.MAX_POOL) OrbitalParticle._pool.push(this); }
    update(dt, targetX, targetY, intensity) {
        this.centerX = targetX; this.centerY = targetY;
        this.angle += this.speed * dt * (1 + intensity * 0.5); this.wobble += dt * 3;
        this.life -= dt; return this.life <= 0;
    }
    draw() {
        const wobbleOffset = Math.sin(this.wobble) * 3;
        const x = this.centerX + Math.cos(this.angle) * (this.orbitRadius + wobbleOffset);
        const y = this.centerY + Math.sin(this.angle) * (this.orbitRadius + wobbleOffset);
        const screen = worldToScreen(x, y);
        if (typeof CANVAS !== 'undefined') {
            const pad = this.size + 4;
            if (screen.x < -pad || screen.x > CANVAS.width + pad || screen.y < -pad || screen.y > CANVAS.height + pad) return;
        }
        const alpha = this.life / this.maxLife;
        if (this.size * alpha < 0.4) return;
        CTX.globalAlpha = alpha; CTX.fillStyle = this.color;
        const useShadow = this.size >= 2;
        if (useShadow) { CTX.shadowBlur = 8; CTX.shadowColor = this.color; }
        CTX.beginPath(); CTX.arc(screen.x, screen.y, this.size, 0, Math.PI * 2); CTX.fill();
        if (useShadow) CTX.shadowBlur = 0;
        CTX.globalAlpha = 1;
    }
}

class OrbitalParticleSystem {
    constructor(maxParticles = 12, theme = 'kao') {
        this.particles = []; this.maxParticles = maxParticles; this.spawnTimer = 0; this.intensity = 0; this.theme = theme;
    }
    update(dt, playerX, playerY, speed, extraIntensity = 0) {
        this.intensity = Math.min(1, speed / 200 + extraIntensity);
        const arr = this.particles; let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt, playerX, playerY, this.intensity)) { arr[i].release(); arr[i] = arr[arr.length - 1]; arr.pop(); }
            i--;
        }
        this.spawnTimer -= dt;
        const spawnRate = 0.15 - this.intensity * 0.12;
        if (this.spawnTimer <= 0 && arr.length < this.maxParticles) { this.spawnTimer = spawnRate; this.spawnParticle(playerX, playerY); }
    }
    spawnParticle(x, y) {
        const angle = Math.random() * Math.PI * 2; const orbitRadius = 25 + Math.random() * 15;
        const speed = 1.5 + Math.random() * 1.5; const size = 1.5 + Math.random() * 2; const lifetime = 2 + Math.random() * 2;
        let color;
        if (this.theme === 'auto') {
            if (this.intensity > 0.6) color = '#f97316'; else if (this.intensity > 0.3) color = '#fbbf24'; else color = '#ef4444';
        } else if (this.theme === 'poom') {
            if (this.intensity > 0.6) color = '#059669'; else if (this.intensity > 0.3) color = '#10b981'; else color = '#34d399';
        } else {
            if (this.intensity > 0.6) color = '#3b82f6'; else if (this.intensity > 0.3) color = '#60a5fa'; else color = '#93c5fd';
        }
        this.particles.push(OrbitalParticle.acquire(x, y, orbitRadius, angle, speed, size, color, lifetime));
    }
    draw() { for (const particle of this.particles) particle.draw(); }
    clear() { for (const p of this.particles) p.release(); this.particles = []; }
}

let autoOrbitalSystem = null; let kaoOrbitalSystem = null; let poomOrbitalSystem = null;
function initOrbitalSystems() {
    autoOrbitalSystem = new OrbitalParticleSystem(10, 'auto');
    kaoOrbitalSystem = new OrbitalParticleSystem(8, 'kao');
    poomOrbitalSystem = new OrbitalParticleSystem(8, 'poom');
}
function updateOrbitalEffects(dt, players) {
    if (!autoOrbitalSystem) initOrbitalSystems();
    players.forEach(player => {
        let system = null; let extraIntensity = 0;
        if (player.constructor.name === 'AutoPlayer') { system = autoOrbitalSystem; extraIntensity = (player.wanchaiActive ? 0.4 : 0); }
        else if (player.constructor.name === 'KaoPlayer') { system = kaoOrbitalSystem; extraIntensity = (player.isWeaponMaster ? 0.3 : 0); }
        else if (player.constructor.name === 'PoomPlayer') { system = poomOrbitalSystem; extraIntensity = ((player.isEatingRice || player.naga) ? 0.3 : 0); }
        if (system) { const speed = Math.hypot(player.vx, player.vy); system.update(dt, player.x, player.y, speed, extraIntensity); }
    });
}
function drawOrbitalEffects() {
    if (autoOrbitalSystem) autoOrbitalSystem.draw();
    if (kaoOrbitalSystem) kaoOrbitalSystem.draw();
    if (poomOrbitalSystem) poomOrbitalSystem.draw();
}

window.OrbitalParticle = OrbitalParticle;
window.OrbitalParticleSystem = OrbitalParticleSystem;
window.initOrbitalSystems = initOrbitalSystems;
window.updateOrbitalEffects = updateOrbitalEffects;
window.drawOrbitalEffects = drawOrbitalEffects;
