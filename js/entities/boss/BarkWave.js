'use strict';

/**
 * js/entities/boss/BarkWave.js
 * 🌊 BARK WAVE — Sonic cone emitted by KruManop's bark attack (Phase 2)
 */
class BarkWave {
    constructor(x, y, angle, coneHalf, range) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.coneHalf = coneHalf;
        this.range = range;
        this.timer = 0;
        this.duration = 0.72;   // slightly longer for drama
        this.rings = 7;
        // Shockwave distortion nodes for zigzag edge
        this._noiseSeeds = Array.from({ length: 14 }, () => Math.random() * Math.PI * 2);
    }

    update(dt) {
        this.timer += dt;
        return this.timer >= this.duration;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const progress = this.timer / this.duration;
        const alpha = 1 - progress;
        const now = performance.now();

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        // ── Filled shockwave cone interior ───────────────────
        const frontR = progress * this.range;
        if (frontR > 8) {
            CTX.save();
            CTX.globalAlpha = alpha * 0.18;
            const coneG = CTX.createRadialGradient(0, 0, 0, 0, 0, frontR);
            coneG.addColorStop(0, 'rgba(253,230,138,0.9)');
            coneG.addColorStop(0.5, 'rgba(245,158,11,0.4)');
            coneG.addColorStop(1, 'rgba(120,53,15,0)');
            CTX.fillStyle = coneG;
            CTX.beginPath();
            CTX.moveTo(0, 0);
            CTX.arc(0, 0, frontR, -this.coneHalf, this.coneHalf);
            CTX.closePath();
            CTX.fill();
            CTX.restore();
        }

        // ── Sonic rings with distortion ───────────────────────
        for (let i = 0; i < this.rings; i++) {
            const frac = (progress + i / this.rings) % 1;
            const r = frac * this.range;
            if (r < 4) continue;
            const ringAlpha = alpha * (1 - i / this.rings) * 0.88;
            if (ringAlpha <= 0) continue;

            CTX.save();
            CTX.globalAlpha = ringAlpha;

            const isHot = i < 2;
            CTX.strokeStyle = isHot ? '#ffffff' : (i % 2 === 0 ? '#fbbf24' : '#f59e0b');
            CTX.lineWidth = isHot ? (4.5 - i * 0.5) : Math.max(0.8, 2.8 - i * 0.4);
            CTX.shadowBlur = isHot ? 22 : 10;
            CTX.shadowColor = isHot ? '#fbbf24' : '#d97706';
            CTX.lineCap = 'round';

            // Main arc
            CTX.beginPath(); CTX.arc(0, 0, r, -this.coneHalf, this.coneHalf); CTX.stroke();

            // Edge boundary lines with distortion
            for (const side of [-1, 1]) {
                const ex = Math.cos(this.coneHalf * side) * r;
                const ey = Math.sin(this.coneHalf * side) * r;
                const ex0 = Math.cos(this.coneHalf * side) * Math.max(0, r - 40);
                const ey0 = Math.sin(this.coneHalf * side) * Math.max(0, r - 40);
                CTX.beginPath();
                CTX.moveTo(ex0, ey0); CTX.lineTo(ex, ey); CTX.stroke();
            }

            // Scattered "sonic debris" particles on ring
            if (i === 0 && r > 20) {
                CTX.lineWidth = 1.5;
                for (let sd = 0; sd < 8; sd++) {
                    const sA = -this.coneHalf + (sd / 7) * this.coneHalf * 2;
                    const sR = r + Math.sin(this._noiseSeeds[sd] + progress * 15) * 10;
                    const noise = Math.sin(this._noiseSeeds[sd + 6] + now / 50) * 6;
                    CTX.beginPath();
                    CTX.moveTo(Math.cos(sA) * sR, Math.sin(sA) * sR);
                    CTX.lineTo(Math.cos(sA) * (sR + 8 + noise), Math.sin(sA) * (sR + 8 + noise));
                    CTX.stroke();
                }
            }
            CTX.restore();
        }

        // ── Origin burst flash ────────────────────────────────
        if (progress < 0.30) {
            const flashP = 1 - progress / 0.30;
            // White hot burst
            CTX.globalAlpha = flashP * 0.95;
            CTX.fillStyle = '#ffffff';
            CTX.shadowBlur = 35; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(0, 0, 22 * flashP, 0, Math.PI * 2); CTX.fill();
            // Orange halo
            CTX.globalAlpha = flashP * 0.55;
            CTX.fillStyle = '#f59e0b';
            CTX.beginPath(); CTX.arc(0, 0, 36 * flashP, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;
        }

        // ── Floating debris letters ("BARK", "!") ─────────────
        if (progress > 0.08 && progress < 0.65) {
            const letters = ['W', 'O', 'O', 'F', '!'];
            CTX.font = 'bold 11px Arial';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            for (let li = 0; li < letters.length; li++) {
                const la = -this.coneHalf * 0.6 + (li / 4) * this.coneHalf * 1.2;
                const lr = (progress * 0.65 + li * 0.06) * this.range;
                const lAlpha = alpha * (1 - li * 0.12) * 0.8;
                CTX.globalAlpha = lAlpha;
                CTX.fillStyle = '#fef3c7';
                CTX.shadowBlur = 6; CTX.shadowColor = '#f59e0b';
                CTX.fillText(letters[li], Math.cos(la) * lr, Math.sin(la) * lr);
            }
            CTX.shadowBlur = 0;
        }

        CTX.restore();
    }
}

window.BarkWave = BarkWave;
