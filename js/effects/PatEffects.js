'use strict';

/**
 * js/effects/PatEffects.js
 * ════════════════════════════════════════════════
 * Specialized visual effects for Pat (Samurai Ronin).
 * ════════════════════════════════════════════════
 */

function spawnZanzoTrail(fromX, fromY, toX, toY, angle, count = 4) {
    if (typeof window.particleSystem === 'undefined') return;
    const dx = toX - fromX; const dy = toY - fromY;
    for (let i = 0; i < count; i++) {
        const frac = i / count; const gx = fromX + dx * frac; const gy = fromY + dy * frac;
        const alphaScale = 0.90 - frac * 0.45;
        window.particleSystem.spawn(gx, gy, 1, '#4a90d9', 'zanzo', { angle, alphaScale, size: 17, lifetime: 0.35 });
    }
}

function spawnBloodBurst(x, y, count = 18) {
    if (typeof window.particleSystem === 'undefined') return;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2; const speed = 80 + (i % 3) * 60;
        const vx = Math.cos(angle) * speed; const vy = Math.sin(angle) * speed;
        const size = 3 + (i % 4); const life = 0.4 + (i % 3) * 0.15;
        window.particleSystem.particles.push(Particle.acquire(x, y, vx, vy, '#cc2222', size, life, 'circle', {}));
        while (window.particleSystem.particles.length > ParticleSystem.MAX_PARTICLES) window.particleSystem.particles.shift().release();
    }
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2; const vx = Math.cos(angle) * 200; const vy = Math.sin(angle) * 200;
        window.particleSystem.particles.push(Particle.acquire(x, y, vx, vy, '#ff4444', 2, 0.18, 'circle', {}));
        while (window.particleSystem.particles.length > ParticleSystem.MAX_PARTICLES) window.particleSystem.particles.shift().release();
    }
}

function spawnKatanaSlashArc(x, y, angle, isCrit = false) {
    if (typeof window.particleSystem === 'undefined') return;
    const color = isCrit ? '#facc15' : '#7ec8e3'; const coreColor = isCrit ? '#fff4c0' : '#d0f0ff';
    const spread = isCrit ? Math.PI * 0.60 : Math.PI * 0.50; const count = isCrit ? 16 : 12;
    for (let i = 0; i < count; i++) {
        const t = count > 1 ? i / (count - 1) : 0.5; const a = angle - spread * 0.5 + spread * t;
        const speed = 220 + (i % 3) * 70; const vx = Math.cos(a) * speed; const vy = Math.sin(a) * speed;
        const size = 3.5 + (i % 3) * 0.8; const life = 0.14 + (i % 4) * 0.022;
        window.particleSystem.particles.push(Particle.acquire(x, y, vx, vy, color, size, life, 'slash_arc', { angle: a }));
        while (window.particleSystem.particles.length > ParticleSystem.MAX_PARTICLES) window.particleSystem.particles.shift().release();
    }
    for (let i = 0; i < 5; i++) {
        const a = angle + (i - 2) * 0.12; const vx = Math.cos(a) * 380; const vy = Math.sin(a) * 380;
        window.particleSystem.particles.push(Particle.acquire(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10, vx, vy, coreColor, 2.5, 0.10, 'slash_arc', { angle: a }));
        while (window.particleSystem.particles.length > ParticleSystem.MAX_PARTICLES) window.particleSystem.particles.shift().release();
    }
}

window.spawnZanzoTrail = spawnZanzoTrail;
window.spawnBloodBurst = spawnBloodBurst;
window.spawnKatanaSlashArc = spawnKatanaSlashArc;
