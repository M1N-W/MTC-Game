'use strict';

/**
 * js/entities/boss/MatrixGridAttack.js
 * 🟥 MATRIX GRID — Area-denial zone attack (Boss Phase 2+)
 */
class MatrixGridAttack {
    /**
     * @param {number} cx       World-space centre X (snapped to player position)
     * @param {number} cy       World-space centre Y
     * @param {number} cols
     * @param {number} rows
     * @param {number} cellSize px per cell (world units)
     * @param {number} warnDur  seconds before detonation
     * @param {number} damage
     * @param {number} safeIndex index of the safe cell (0-based, row-major)
     */
    constructor(cx, cy, cols, rows, cellSize, warnDur, damage, safeIndex) {
        this.cx = cx; this.cy = cy;
        this.cols = cols; this.rows = rows;
        this.cellSize = cellSize;
        this.warnDur = warnDur;
        this.damage = damage;
        this.safeIndex = safeIndex;

        this.timer = 0;
        this.dead = false;
        this._detonated = false;

        // Pre-compute cell world-centres once — no GC churn in update()
        this._cells = [];
        const totalW = cols * cellSize;
        const totalH = rows * cellSize;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                this._cells.push({
                    wx: cx - totalW / 2 + c * cellSize + cellSize / 2,
                    wy: cy - totalH / 2 + r * cellSize + cellSize / 2
                });
            }
        }
    }

    update(dt, player) {
        if (this.dead) return true;
        this.timer += dt;

        // Detonate once at end of warn window
        if (!this._detonated && this.timer >= this.warnDur) {
            this._detonated = true;
            const half = this.cellSize / 2;
            for (let i = 0; i < this._cells.length; i++) {
                if (i === this.safeIndex) continue;
                const cell = this._cells[i];
                if (Math.abs(player.x - cell.wx) < half && Math.abs(player.y - cell.wy) < half) {
                    player.takeDamage(this.damage);
                    addScreenShake(16);
                    spawnParticles(player.x, player.y, 20, '#ef4444');
                    spawnFloatingText('WRONG CELL!', player.x, player.y - 60, '#ef4444', 28);
                }
                spawnParticles(cell.wx, cell.wy, 10, '#ef4444');
                if (typeof ExpandingRing !== 'undefined') {
                    window.specialEffects.push(new ExpandingRing(cell.wx, cell.wy, '#ef4444', this.cellSize * 0.6, 0.4));
                }
            }
        }

        // Linger briefly so detonation flash is visible
        if (this._detonated && this.timer >= this.warnDur + 0.5) {
            this.dead = true;
        }
        return this.dead;
    }

    draw() {
        if (this.dead) return;
        if (typeof CTX === 'undefined' || typeof worldToScreen === 'undefined') return;

        const prog = Math.min(this.timer / this.warnDur, 1);
        const now = performance.now();
        const fastPulse = 0.5 + Math.sin(now / (120 - prog * 80)) * 0.5;
        const isLate = prog > 0.65;
        const baseAlpha = this._detonated ? 0 : (0.6 + prog * 0.35);

        for (let i = 0; i < this._cells.length; i++) {
            const cell = this._cells[i];
            const screen = worldToScreen(cell.wx, cell.wy);
            const half = this.cellSize / 2;
            const isSafe = (i === this.safeIndex);
            const cx = screen.x, cy = screen.y;

            CTX.save();
            CTX.globalAlpha = baseAlpha;

            if (isSafe) {
                // ── Safe Cell — pulsing green sanctuary ────────
                // Glow fill
                const sG = CTX.createRadialGradient(cx, cy, 0, cx, cy, half * 1.2);
                sG.addColorStop(0, 'rgba(34,197,94,0.30)');
                sG.addColorStop(1, 'rgba(34,197,94,0)');
                CTX.fillStyle = sG;
                CTX.beginPath(); CTX.arc(cx, cy, half * 1.2, 0, Math.PI * 2); CTX.fill();

                CTX.fillStyle = 'rgba(34,197,94,0.22)';
                CTX.fillRect(cx - half, cy - half, this.cellSize, this.cellSize);

                CTX.strokeStyle = `rgba(74,222,128,${0.7 + fastPulse * 0.3})`;
                CTX.lineWidth = 2.5; CTX.shadowBlur = 18 * fastPulse; CTX.shadowColor = '#22c55e';
                CTX.strokeRect(cx - half + 1, cy - half + 1, this.cellSize - 2, this.cellSize - 2);

                // Corner brackets
                CTX.strokeStyle = '#4ade80'; CTX.lineWidth = 3; CTX.shadowBlur = 10;
                const bk = 14;
                [[cx - half, cy - half, 1, 1], [cx + half, cy - half, -1, 1],
                [cx - half, cy + half, 1, -1], [cx + half, cy + half, -1, -1]].forEach(([bx, by, sx, sy]) => {
                    CTX.beginPath(); CTX.moveTo(bx + sx * bk, by); CTX.lineTo(bx, by); CTX.lineTo(bx, by + sy * bk); CTX.stroke();
                });
                CTX.shadowBlur = 0;

                // ✓ checkmark
                CTX.font = `bold ${Math.max(16, half * 0.55)}px Arial`;
                CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
                CTX.fillStyle = `rgba(74,222,128,${0.65 + fastPulse * 0.35})`;
                CTX.shadowBlur = 12; CTX.shadowColor = '#22c55e';
                CTX.fillText('✓', cx, cy - 6);

                CTX.font = 'bold 12px "Orbitron",Arial';
                CTX.globalAlpha = baseAlpha * (0.6 + fastPulse * 0.4);
                CTX.fillStyle = '#4ade80'; CTX.shadowBlur = 8;
                CTX.fillText('SAFE', cx, cy + 12);

            } else if (this._detonated) {
                // Already detonated — skip (handled in update)
            } else {
                // ── Danger Cell — escalating threat ────────────
                const dangerGlow = isLate ? '#ef4444' : '#f97316';
                const dangerFill = isLate ? 'rgba(239,68,68,' : 'rgba(249,115,22,';

                // Radial heat fill
                const dG = CTX.createRadialGradient(cx, cy, 0, cx, cy, half * 1.1);
                dG.addColorStop(0, dangerFill + (0.30 + prog * 0.30 * fastPulse) + ')');
                dG.addColorStop(1, 'rgba(0,0,0,0)');
                CTX.fillStyle = dG;
                CTX.beginPath(); CTX.arc(0, 0, half * 1.1, 0, Math.PI * 2); CTX.fill();

                // Cell fill
                CTX.fillStyle = dangerFill + (0.14 + prog * 0.22 * fastPulse) + ')';
                CTX.fillRect(cx - half, cy - half, this.cellSize, this.cellSize);

                // Animated border
                const borderAlpha = 0.5 + fastPulse * 0.5;
                CTX.strokeStyle = isLate ? `rgba(239,68,68,${borderAlpha})` : `rgba(249,115,22,${borderAlpha})`;
                CTX.lineWidth = isLate ? 3 : 2.2;
                CTX.shadowBlur = isLate ? 16 * fastPulse : 8; CTX.shadowColor = dangerGlow;
                CTX.strokeRect(cx - half + 1, cy - half + 1, this.cellSize - 2, this.cellSize - 2);
                CTX.shadowBlur = 0;

                // Countdown fill bar (bottom of cell, shrinks to 0)
                const barW = Math.max(0, (this.cellSize - 4) * (1 - prog));
                const barG = CTX.createLinearGradient(cx - half + 2, 0, cx - half + 2 + barW, 0);
                barG.addColorStop(0, isLate ? '#ef4444' : '#facc15');
                barG.addColorStop(1, isLate ? '#dc2626' : '#f97316');
                CTX.fillStyle = barG;
                CTX.globalAlpha = baseAlpha * 0.85;
                CTX.fillRect(cx - half + 2, cy + half - 7, barW, 5);
                CTX.globalAlpha = baseAlpha;

                // Corner danger ticks
                CTX.strokeStyle = dangerGlow; CTX.lineWidth = 2;
                const tk = 10;
                [[cx - half, cy - half, 1, 1], [cx + half, cy - half, -1, 1],
                [cx - half, cy + half, 1, -1], [cx + half, cy + half, -1, -1]].forEach(([bx, by, sx, sy]) => {
                    CTX.beginPath(); CTX.moveTo(bx + sx * tk, by); CTX.lineTo(bx, by); CTX.lineTo(bx, by + sy * tk); CTX.stroke();
                });

                // Math formula text
                const formulas = ['∑x²', 'dy/dx', 'log(x)', "f'(x)", 'det(A)', 'μ+2σ'];
                const fi2 = Math.abs(Math.round(cell.wx / 130 + cell.wy / 130)) % formulas.length;
                CTX.globalAlpha = baseAlpha * (isLate ? 0.50 * fastPulse : 0.22);
                CTX.font = `bold ${Math.max(9, Math.floor(half * 0.28))}px "Courier New",monospace`;
                CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
                CTX.fillStyle = isLate ? '#fca5a5' : '#fed7aa';
                CTX.fillText(formulas[fi2], cx, cy + 8);

                // ⚠ icon
                CTX.globalAlpha = baseAlpha * (0.55 + fastPulse * 0.45);
                CTX.font = `${Math.max(14, Math.floor(half * 0.42))}px Arial`;
                CTX.fillStyle = '#fff'; CTX.shadowBlur = isLate ? 12 : 5; CTX.shadowColor = dangerGlow;
                CTX.fillText('⚠', cx, cy - 8);
                CTX.shadowBlur = 0;
            }

            CTX.restore();
        }
    }
}

window.MatrixGridAttack = MatrixGridAttack;
