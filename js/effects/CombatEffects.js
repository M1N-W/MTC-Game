'use strict';

/**
 * js/effects/CombatEffects.js
 * ════════════════════════════════════════════════
 * Floating text labels and hit marker crosshairs.
 * ════════════════════════════════════════════════
 */

class FloatingText {
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
        this._cat = null;
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

    _category() {
        if (this._cat) return this._cat;
        const t = this.text.trim();
        const col = (this.color || '').toLowerCase();
        const isNumeric = /^[\d,.\s]+$/.test(t);
        if (isNumeric && (col === '#facc15' || col === '#fbbf24' || this.size >= 32)) return (this._cat = 'CRIT');
        if (isNumeric) return (this._cat = 'DAMAGE');
        if (t.startsWith('+')) return (this._cat = 'HEAL');
        if (this.size >= 28) return (this._cat = 'IMPACT');
        const wordCount = t.replace(/[^\w\s]/g, '').trim().split(/\s+/).length;
        if (wordCount <= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) return (this._cat = 'STATUS');
        return (this._cat = 'DEFAULT');
    }

    update(dt) {
        if (this._scaleTimer > 0) {
            this._scaleTimer -= dt;
            const p = Math.max(0, this._scaleTimer / 0.18);
            this._scale = 1.0 + 0.35 * p * p;
        } else {
            this._scale = 1.0;
        }
        this.y += this.vy * dt;
        this.life -= dt;
        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        if (typeof CANVAS !== 'undefined') {
            const pad = this.size * 3;
            if (screen.x < -pad || screen.x > CANVAS.width + pad ||
                screen.y < -pad || screen.y > CANVAS.height + pad) return;
        }
        const cat = this._category();
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

    _drawCrit(sc) {
        const sz = this.size * 1.15 * this._scale;
        CTX.save();
        CTX.translate(sc.x, sc.y);
        CTX.shadowBlur = 28;
        CTX.shadowColor = '#f59e0b';
        CTX.font = `900 ${sz}px 'Bebas Neue', 'Orbitron', monospace`;
        CTX.lineWidth = sz * 0.12;
        CTX.strokeStyle = 'rgba(0,0,0,0.95)';
        CTX.strokeText(this.text, 0, 0);
        const grd = CTX.createLinearGradient(0, -sz * 0.5, 0, sz * 0.5);
        grd.addColorStop(0, '#fff7cc');
        grd.addColorStop(0.4, '#facc15');
        grd.addColorStop(1, '#f59e0b');
        CTX.fillStyle = grd;
        CTX.fillText(this.text, 0, 0);
        CTX.shadowBlur = 0;
        CTX.globalAlpha *= 0.5;
        CTX.strokeStyle = '#facc15';
        CTX.lineWidth = 1.2;
        CTX.beginPath(); CTX.arc(0, 0, sz * 0.72, 0, Math.PI * 2); CTX.stroke();
        CTX.restore();
    }

    _drawDamage(sc) {
        const sz = this.size * 1.1 * this._scale;
        CTX.save();
        CTX.translate(sc.x, sc.y);
        CTX.shadowBlur = 14;
        CTX.shadowColor = this.color;
        CTX.font = `900 ${sz}px 'Bebas Neue', 'Orbitron', monospace`;
        CTX.lineWidth = sz * 0.14;
        CTX.strokeStyle = 'rgba(0,0,0,0.95)';
        CTX.strokeText(this.text, 0, 0);
        CTX.fillStyle = this.color;
        CTX.fillText(this.text, 0, 0);
        CTX.shadowBlur = 0;
        CTX.lineWidth = 1;
        CTX.strokeStyle = 'rgba(255,255,255,0.30)';
        CTX.strokeText(this.text, 0.5, -0.5);
        CTX.restore();
    }

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
        CTX.beginPath();
        CTX.moveTo(-bw / 2 + sl, -bh / 2); CTX.lineTo(bw / 2, -bh / 2);
        CTX.lineTo(bw / 2 - sl, bh / 2); CTX.lineTo(-bw / 2, bh / 2);
        CTX.closePath();
        CTX.fillStyle = 'rgba(6,30,20,0.82)'; CTX.fill();
        CTX.strokeStyle = 'rgba(16,185,129,0.75)'; CTX.lineWidth = 1.5; CTX.stroke();
        CTX.shadowBlur = 10; CTX.shadowColor = '#10b981';
        CTX.fillStyle = '#6ee7b7'; CTX.fillText(this.text, 0, 0);
        CTX.restore();
    }

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
        CTX.shadowBlur = 32; CTX.shadowColor = col;
        CTX.beginPath();
        CTX.moveTo(-bw / 2 + sl, -bh / 2); CTX.lineTo(bw / 2, -bh / 2);
        CTX.lineTo(bw / 2 - sl, bh / 2); CTX.lineTo(-bw / 2, bh / 2);
        CTX.closePath();
        CTX.fillStyle = 'rgba(8,4,18,0.88)'; CTX.fill();
        CTX.strokeStyle = col; CTX.lineWidth = 2; CTX.stroke();
        CTX.shadowBlur = 0;
        const bkSz = 8;
        CTX.strokeStyle = col; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(-bw / 2 + sl + bkSz, -bh / 2 + 2); CTX.lineTo(-bw / 2 + sl + 2, -bh / 2 + 2);
        CTX.lineTo(-bw / 2 + sl + 2, -bh / 2 + 2 + bkSz);
        CTX.moveTo(bw / 2 - sl - bkSz, bh / 2 - 2); CTX.lineTo(bw / 2 - sl - 2, bh / 2 - 2);
        CTX.lineTo(bw / 2 - sl - 2, bh / 2 - 2 - bkSz);
        CTX.stroke();
        CTX.shadowBlur = 16; CTX.shadowColor = col;
        CTX.lineWidth = sz * 0.10; CTX.strokeStyle = 'rgba(0,0,0,0.9)'; CTX.strokeText(this.text, 0, 0);
        CTX.fillStyle = '#ffffff'; CTX.fillText(this.text, 0, 0);
        CTX.globalAlpha *= 0.55; CTX.fillStyle = col; CTX.fillText(this.text, 0, 0);
        CTX.restore();
    }

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
        CTX.shadowBlur = 16; CTX.shadowColor = col;
        CTX.beginPath();
        CTX.moveTo(-bw / 2 + sl, -bh / 2); CTX.lineTo(bw / 2, -bh / 2);
        CTX.lineTo(bw / 2 - sl, bh / 2); CTX.lineTo(-bw / 2, bh / 2);
        CTX.closePath();
        CTX.fillStyle = 'rgba(8,4,18,0.80)'; CTX.fill();
        CTX.strokeStyle = col; CTX.lineWidth = 1.5; CTX.stroke();
        CTX.shadowBlur = 10; CTX.fillStyle = '#ffffff'; CTX.fillText(this.text, 0, 0);
        CTX.globalAlpha *= 0.50; CTX.fillStyle = col; CTX.fillText(this.text, 0, 0);
        CTX.restore();
    }

    _drawDefault(sc) {
        const sz = this.size * this._scale;
        CTX.save();
        CTX.translate(sc.x, sc.y);
        CTX.font = this._font || (this._font = `bold ${this.size}px 'Rajdhani', 'Orbitron', monospace`);
        CTX.shadowBlur = 12; CTX.shadowColor = this.color;
        CTX.lineWidth = sz * 0.12; CTX.strokeStyle = 'rgba(0,0,0,0.9)'; CTX.strokeText(this.text, 0, 0);
        CTX.fillStyle = this.color; CTX.fillText(this.text, 0, 0);
        CTX.restore();
    }
}

class FloatingTextSystem {
    constructor() { this.texts = []; }
    spawn(text, x, y, color, size = 20) {
        const CLUSTER_R = 80;
        const STEP_Y = 32;
        const MAX_STACK = 6;
        let stack = 0;
        for (let i = 0, len = this.texts.length; i < len; i++) {
            const t = this.texts[i];
            if (Math.abs(t.x - x) < CLUSTER_R && Math.abs(t.y - y) < CLUSTER_R * 2) {
                stack++;
                if (stack >= MAX_STACK) break;
            }
        }
        this.texts.push(FloatingText.acquire(text, x, y - stack * STEP_Y, color, size));
    }
    update(dt) {
        const arr = this.texts;
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
        for (let text of this.texts) text.draw();
    }
    clear() {
        for (const t of this.texts) t.release();
        this.texts = [];
    }
}

class HitMarker {
    static _pool = [];
    static MAX_POOL = 80;
    constructor(x, y, isCrit = false) { this.reset(x, y, isCrit); }
    reset(x, y, isCrit = false) {
        this.x = x; this.y = y; this.isCrit = isCrit;
        this.maxLife = isCrit ? 0.40 : 0.30;
        this.life = this.maxLife;
        this.baseSize = isCrit ? 14 : 9;
        return this;
    }
    static acquire(x, y, isCrit = false) {
        if (HitMarker._pool.length > 0) return HitMarker._pool.pop().reset(x, y, isCrit);
        return new HitMarker(x, y, isCrit);
    }
    release() {
        if (HitMarker._pool.length < HitMarker.MAX_POOL) HitMarker._pool.push(this);
    }
    update(dt) {
        this.life -= dt;
        return this.life <= 0;
    }
    draw() {
        const screen = worldToScreen(this.x, this.y);
        const t = this.life / this.maxLife;
        const armLen = this.baseSize * (1 + (1 - t) * 0.35);
        const alpha = Math.sqrt(t);
        CTX.save();
        CTX.globalAlpha = alpha;
        CTX.strokeStyle = this.isCrit ? '#facc15' : '#ffffff';
        CTX.lineWidth = this.isCrit ? 2.5 : 2;
        CTX.lineCap = 'round';
        if (this.isCrit) { CTX.shadowBlur = 10; CTX.shadowColor = '#facc15'; }
        else { CTX.shadowBlur = 5; CTX.shadowColor = 'rgba(255,255,255,0.7)'; }
        const cx = screen.x; const cy = screen.y; const s = armLen;
        CTX.beginPath();
        CTX.moveTo(cx - s, cy - s); CTX.lineTo(cx + s, cy + s);
        CTX.moveTo(cx + s, cy - s); CTX.lineTo(cx - s, cy + s);
        CTX.stroke();
        if (this.isCrit) {
            CTX.shadowBlur = 14; CTX.shadowColor = '#facc15';
            CTX.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            CTX.beginPath(); CTX.arc(cx, cy, 2.5 * t, 0, Math.PI * 2); CTX.fill();
        }
        CTX.restore();
    }
}

class HitMarkerSystem {
    static MAX_MARKERS = 40;
    constructor() { this.markers = []; }
    spawn(x, y, isCrit = false) {
        this.markers.push(HitMarker.acquire(x, y, isCrit));
        while (this.markers.length > HitMarkerSystem.MAX_MARKERS) this.markers.shift().release();
    }
    update(dt) {
        const arr = this.markers;
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
        for (let marker of this.markers) marker.draw();
    }
    clear() {
        for (const m of this.markers) m.release();
        this.markers = [];
    }
}

window.FloatingText = FloatingText;
window.FloatingTextSystem = FloatingTextSystem;
window.floatingTextSystem = new FloatingTextSystem();
window.HitMarker = HitMarker;
window.HitMarkerSystem = HitMarkerSystem;
window.hitMarkerSystem = new HitMarkerSystem();

function spawnFloatingText(text, x, y, color, size = 20) {
    window.floatingTextSystem.spawn(text, x, y, color, size);
}
window.spawnFloatingText = spawnFloatingText;

function spawnHitMarker(x, y, isCrit = false) {
    window.hitMarkerSystem.spawn(x, y, isCrit);
}
window.spawnHitMarker = spawnHitMarker;

const WANCHAI_PUNCH_LABELS = ['วันชัย!', 'วันชัย!!', '💥', '💥💥', 'ORA!', 'WANCHAI!', '🔥', 'STAND!', 'ร้อน!!'];
function spawnWanchaiPunchText(x, y) {
    if (typeof window.floatingTextSystem === 'undefined') return;
    const label = WANCHAI_PUNCH_LABELS[Math.floor(Math.random() * WANCHAI_PUNCH_LABELS.length)];
    const offX = (Math.random() - 0.5) * 40;
    const offY = -10 + (Math.random() - 0.5) * 20;
    const colours = ['#dc2626', '#fb7185', '#f97316', '#ffffff', '#fca5a5'];
    const colour = colours[Math.floor(Math.random() * colours.length)];
    const size = label.includes('!!') || label === '💥💥' ? 24 : 18;
    window.floatingTextSystem.spawn(label, x + offX, y + offY, colour, size);
}
window.spawnWanchaiPunchText = spawnWanchaiPunchText;
