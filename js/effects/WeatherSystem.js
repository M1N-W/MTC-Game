'use strict';

/**
 * js/effects/WeatherSystem.js
 * ════════════════════════════════════════════════
 * Atmospheric rain and snow systems.
 * ════════════════════════════════════════════════
 */

class Raindrop {
    constructor(x, y, speed, wind) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.wind = wind;
        this.length = 5 + Math.random() * 6;
        this.alpha = 0.18 + Math.random() * 0.14;
    }

    update(dt, camera) {
        this.y += this.speed * dt;
        this.x += this.wind * dt;
        const screenBottom = camera.y + CANVAS.height + 100;
        return this.y > screenBottom;
    }
}

class Snowflake {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.size = 1 + Math.random() * 2;
        this.swaySpeed = 0.5 + Math.random() * 1.5;
        this.swayAmount = 10 + Math.random() * 20;
        this.time = Math.random() * Math.PI * 2;
        this.alpha = 0.25 + Math.random() * 0.20;
    }

    update(dt, camera) {
        this.time += dt * this.swaySpeed;
        this.y += this.speed * dt;
        this.x += Math.sin(this.time) * this.swayAmount * dt;
        const screenBottom = camera.y + CANVAS.height + 100;
        return this.y > screenBottom;
    }
}

class WeatherSystem {
    static MAX_PARTICLES = 120;

    constructor() {
        this.mode = 'none';
        this.particles = [];
        this.spawnTimer = 0;
        this.rainSpawnRate = 16;
        this.rainSpeed = 520;
        this.rainWind = 70;
        this.snowSpawnRate = 12;
        this.snowSpeed = 80;
    }

    setWeather(mode) {
        if (mode !== this.mode) {
            this.mode = mode;
            this.particles = [];
            this.spawnTimer = 0;
        }
    }

    update(dt, camera) {
        if (this.mode === 'none') {
            if (this.particles.length > 0) this.particles = [];
            return;
        }
        this.spawnTimer += dt;
        const spawnRate = this.mode === 'rain' ? this.rainSpawnRate : this.snowSpawnRate;
        const spawnInterval = 1.0 / spawnRate;
        while (this.spawnTimer >= spawnInterval) {
            this.spawnTimer -= spawnInterval;
            this._spawnParticle(camera);
        }
        const arr = this.particles;
        let i = arr.length - 1;
        while (i >= 0) {
            if (arr[i].update(dt, camera)) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
            }
            i--;
        }
        while (this.particles.length > WeatherSystem.MAX_PARTICLES) {
            this.particles.shift();
        }
    }

    draw() {
        if (this.mode === 'none' || this.particles.length === 0) return;
        if (typeof CTX === 'undefined' || !CTX) return;
        if (this.mode === 'rain') this._drawRainBatch();
        else if (this.mode === 'snow') this._drawSnowBatch();
    }

    _drawRainBatch() {
        const tiltRatio = Math.min(0.6, this.rainWind / this.rainSpeed);
        CTX.save();
        CTX.strokeStyle = '#d4e8f5';
        CTX.lineWidth = 0.8;
        CTX.lineCap = 'round';
        for (const drop of this.particles) {
            const s = worldToScreen(drop.x, drop.y);
            const dx = drop.length * tiltRatio;
            const dy = drop.length;
            CTX.globalAlpha = drop.alpha;
            CTX.beginPath();
            CTX.moveTo(s.x, s.y);
            CTX.lineTo(s.x + dx, s.y + dy);
            CTX.stroke();
        }
        CTX.restore();
    }

    _drawSnowBatch() {
        CTX.save();
        CTX.fillStyle = '#c8dff0';
        for (const flake of this.particles) {
            const s = worldToScreen(flake.x, flake.y);
            CTX.globalAlpha = flake.alpha;
            CTX.beginPath();
            CTX.arc(s.x, s.y, flake.size, 0, Math.PI * 2);
            CTX.fill();
        }
        CTX.restore();
    }

    _spawnParticle(camera) {
        const screenTop = camera.y - 10;
        const screenLeft = camera.x - 50;
        const screenRight = camera.x + CANVAS.width + 50;
        const x = screenLeft + Math.random() * (screenRight - screenLeft);
        if (this.mode === 'rain') {
            const speed = this.rainSpeed + (Math.random() - 0.5) * 80;
            const wind = this.rainWind + (Math.random() - 0.5) * 30;
            this.particles.push(new Raindrop(x, screenTop, speed, wind));
        } else if (this.mode === 'snow') {
            const speed = this.snowSpeed + (Math.random() - 0.5) * 25;
            this.particles.push(new Snowflake(x, screenTop, speed));
        }
    }

    clear() {
        this.particles = [];
        this.spawnTimer = 0;
    }
}

window.WeatherSystem = WeatherSystem;
window.weatherSystem = new WeatherSystem();
