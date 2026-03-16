'use strict';

/**
 * js/effects/ParticleSystem.js
 * ════════════════════════════════════════════════
 * Pooled particle system for circles, steam, binary, afterimages, etc.
 * ════════════════════════════════════════════════
 */

class Particle {
    static _pool = [];
    static MAX_POOL = 300;

    constructor(x, y, vx, vy, color, size, lifetime, type = 'circle', data = {}) {
        this.reset(x, y, vx, vy, color, size, lifetime, type, data);
    }

    reset(x, y, vx, vy, color, size, lifetime, type = 'circle', data = {}) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = lifetime;
        this.maxLife = lifetime;
        this.type = type;
        this.data = data;
        return this;
    }

    static acquire(x, y, vx, vy, color, size, lifetime, type = 'circle', data = {}) {
        if (Particle._pool.length > 0) {
            return Particle._pool.pop().reset(x, y, vx, vy, color, size, lifetime, type, data);
        }
        return new Particle(x, y, vx, vy, color, size, lifetime, type, data);
    }

    release() {
        this.data = {};
        if (Particle._pool.length < Particle.MAX_POOL) {
            Particle._pool.push(this);
        }
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.type === 'steam') {
            this.vx *= 0.90;
            this.vy *= 0.90;
        } else if (this.type === 'afterimage') {
            this.vx *= 0.8;
            this.vy *= 0.8;
        } else if (this.type === 'zanzo') {
            this.vx = 0;
            this.vy = 0;
        } else {
            this.vx *= 0.95;
            this.vy *= 0.95;
        }
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        if (typeof CANVAS !== 'undefined') {
            const pad = this.size + 4;
            if (screen.x < -pad || screen.x > CANVAS.width + pad ||
                screen.y < -pad || screen.y > CANVAS.height + pad) return;
        }
        const alpha = this.life / this.maxLife;
        const renderedRadius = this.size * alpha;
        if (this.type !== 'binary' && renderedRadius < 0.4) return;

        CTX.globalAlpha = alpha;
        CTX.fillStyle = this.color;

        if (this.type === 'binary') {
            CTX.font = `bold ${Math.max(10, this.size)}px monospace`;
            CTX.textAlign = 'center';
            CTX.textBaseline = 'middle';
            CTX.shadowBlur = 4;
            CTX.shadowColor = this.color;
            CTX.fillText(this.data.char || '0', screen.x, screen.y);
            CTX.shadowBlur = 0;
            CTX.globalAlpha = 1;
            return;
        }
        if (this.type === 'afterimage') {
            CTX.save();
            CTX.translate(screen.x, screen.y);
            if (this.data.rotation) CTX.rotate(this.data.rotation);
            CTX.strokeStyle = this.color;
            CTX.lineWidth = 2;
            CTX.shadowBlur = 10;
            CTX.shadowColor = this.color;
            const w = this.size;
            const h = this.size;
            CTX.strokeRect(-w / 2, -h / 2, w, h);
            CTX.globalAlpha = alpha * 0.3;
            CTX.fillRect(-w / 2, -h / 2, w, h);
            CTX.restore();
            CTX.globalAlpha = 1;
            return;
        }
        if (this.type === 'zanzo') {
            CTX.save();
            CTX.translate(screen.x, screen.y);
            const R = this.size;
            const a = alpha * (this.data.alphaScale ?? 1.0);
            CTX.globalAlpha = a;
            CTX.fillStyle = this.color;
            CTX.shadowBlur = 12 * alpha;
            CTX.shadowColor = this.color;
            CTX.beginPath(); CTX.arc(0, 0, R * 0.85, 0, Math.PI * 2); CTX.fill();
            CTX.beginPath();
            CTX.moveTo(-(R - 1), -2);
            CTX.quadraticCurveTo(-R - 1, -R * 0.75, -R * 0.30, -R - 3);
            CTX.quadraticCurveTo(0, -R - 5, R * 0.30, -R - 3);
            CTX.quadraticCurveTo(R + 1, -R * 0.75, R - 1, -2);
            CTX.quadraticCurveTo(0, 0, -(R - 1), -2);
            CTX.closePath(); CTX.fill();
            CTX.globalAlpha = a * 0.80;
            CTX.beginPath(); CTX.ellipse(1, -R - 7, 4, 4, 0, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;
            CTX.restore();
            CTX.globalAlpha = 1;
            return;
        }
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
            CTX.fillStyle = this.color;
            CTX.beginPath();
            CTX.moveTo(streakLen, 0);
            CTX.quadraticCurveTo(streakLen * 0.4, -streakW, 0, 0);
            CTX.quadraticCurveTo(streakLen * 0.4, streakW, streakLen, 0);
            CTX.closePath();
            CTX.fill();
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
        if (this.type === 'steam') {
            const growth = 1 + (1 - alpha);
            const r = renderedRadius * growth;
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2);
            CTX.fill();
            CTX.globalAlpha = 1;
            return;
        }
        const useShadow = renderedRadius >= 3;
        if (useShadow) {
            CTX.shadowBlur = 4;
            CTX.shadowColor = this.color;
        }
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, renderedRadius, 0, Math.PI * 2);
        CTX.fill();
        if (useShadow) CTX.shadowBlur = 0;
        CTX.globalAlpha = 1;
    }
}

class ParticleSystem {
    static MAX_PARTICLES = 150;
    constructor() { this.particles = []; }

    spawn(x, y, count, color, type = 'circle', options = {}) {
        for (let i = 0; i < count; i++) {
            let vx, vy, size, lifetime, data = {};
            if (type === 'steam') {
                const angle = -Math.PI / 2 + (Math.random() - 0.5);
                const speed = rand(20, 80);
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
                size = rand(4, 8);
                lifetime = rand(0.5, 1.2);
            } else if (type === 'binary') {
                const angle = Math.random() * Math.PI * 2;
                const speed = rand(50, 250);
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
                size = rand(12, 16);
                lifetime = rand(0.4, 0.9);
                data = { char: Math.random() > 0.5 ? '1' : '0' };
            } else if (type === 'afterimage') {
                vx = 0; vy = 0;
                size = options.size || 30;
                lifetime = 0.25;
                data = { rotation: options.rotation || 0 };
            } else if (type === 'zanzo') {
                vx = 0; vy = 0;
                size = options.size || 17;
                lifetime = options.lifetime || 0.35;
                data = { angle: options.angle || 0, alphaScale: options.alphaScale ?? 1.0 };
            } else if (type === 'slash_arc') {
                vx = options.vx ?? 0;
                vy = options.vy ?? 0;
                size = options.size || rand(2, 4);
                lifetime = options.lifetime || rand(0.12, 0.22);
                data = { angle: options.angle ?? 0 };
            } else {
                const angle = Math.random() * Math.PI * 2;
                const speed = rand(100, 400);
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
                size = rand(2, 5);
                lifetime = rand(0.3, 0.8);
            }
            this.particles.push(Particle.acquire(x, y, vx, vy, color, size, lifetime, type, data));
            while (this.particles.length > ParticleSystem.MAX_PARTICLES) {
                this.particles.shift().release();
            }
        }
    }

    update(dt) {
        const arr = this.particles;
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
        for (let particle of this.particles) particle.draw();
    }

    clear() {
        for (const p of this.particles) p.release();
        this.particles = [];
    }
}

window.Particle = Particle;
window.ParticleSystem = ParticleSystem;
window.particleSystem = new ParticleSystem();

function spawnParticles(x, y, count, color, type = 'circle', options = {}) {
    window.particleSystem.spawn(x, y, count, color, type, options);
}
window.spawnParticles = spawnParticles;
