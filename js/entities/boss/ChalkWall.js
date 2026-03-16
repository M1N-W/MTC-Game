'use strict';

/**
 * js/entities/boss/ChalkWall.js
 * 🖊️ CHALK WALL — KruManop Phase 2 ground hazard
 */
class ChalkWall {
    /**
     * @param {number} cx    world centre X (midpoint of wall)
     * @param {number} cy    world centre Y
     * @param {number} angle perpendicular angle to boss→player direction
     */
    constructor(cx, cy, angle) {
        const P2 = BALANCE.boss.phase2;
        this.cx = cx;
        this.cy = cy;
        this.angle = angle;          // wall runs perpendicular to this angle
        this.length = P2.chalkWallLength ?? 340;
        this.damage = P2.chalkWallDamage ?? 15;
        this.duration = P2.chalkWallDuration ?? 6.0;
        this.timer = 0;
        this.dead = false;
        this._hitCd = 0;             // per-player crossing cooldown

        // Pre-seed visual — no Math.random() in draw()
        this._formula = ['∑Δx²=0', 'y=mx+b', 'dy/dx=m', '∫f(x)dx', 'Ax+By=C'][
            Math.floor(Math.abs(Math.sin(cx * 0.05 + cy * 0.07)) * 5)
        ];
        this._dashSeed = (cx * 31 + cy * 17) % 7; // deterministic dash offset
    }

    update(dt, player) {
        if (this.dead) return true;
        this.timer += dt;
        if (this._hitCd > 0) this._hitCd -= dt;

        if (this.timer >= this.duration) { this.dead = true; return true; }

        // Broad-phase: only check if player is roughly near the wall centre
        if (!player || player.dead) return false;
        const nearDist = this.length * 0.65;
        const dcx = Math.abs(player.x - this.cx), dcy = Math.abs(player.y - this.cy);
        if (dcx > nearDist && dcy > nearDist) return false;

        // Project player onto wall normal to get signed distance from wall line
        const perpAng = this.angle + Math.PI / 2;   // wall runs along perpAng
        const dxP = player.x - this.cx, dyP = player.y - this.cy;
        // Distance along wall normal (positive = one side, negative = other)
        const normalDist = dxP * Math.cos(this.angle) + dyP * Math.sin(this.angle);
        // Distance along wall direction (to check if player is within wall length)
        const tangentDist = Math.abs(dxP * Math.cos(perpAng) + dyP * Math.sin(perpAng));

        if (Math.abs(normalDist) < player.radius + 8 &&
            tangentDist < this.length * 0.5 &&
            this._hitCd <= 0) {
            player.takeDamage(this.damage);
            this._hitCd = 0.8;
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText('CHALK WALL!', player.x, player.y - 50, '#fef9c3', 20);
            if (typeof addScreenShake === 'function') addScreenShake(5);
        }
        return false;
    }

    draw() {
        if (this.dead || typeof CTX === 'undefined' || typeof worldToScreen !== 'function') return;

        const prog = this.timer / this.duration;
        const alpha = prog < 0.12 ? prog / 0.12                   // fade in
            : prog > 0.75 ? 1 - (prog - 0.75) / 0.25     // fade out
                : 1.0;
        const perpAng = this.angle + Math.PI / 2;
        const halfLen = this.length * 0.5;
        const x1w = this.cx + Math.cos(perpAng) * halfLen;
        const y1w = this.cy + Math.sin(perpAng) * halfLen;
        const x2w = this.cx - Math.cos(perpAng) * halfLen;
        const y2w = this.cy - Math.sin(perpAng) * halfLen;

        const s1 = worldToScreen(x1w, y1w);
        const s2 = worldToScreen(x2w, y2w);
        const sc = worldToScreen(this.cx, this.cy);
        const now = performance.now() / 1000;

        CTX.save();

        // ── Chalk glow underglow ──────────────────────────────
        CTX.globalAlpha = alpha * 0.22;
        CTX.strokeStyle = '#fef9c3';
        CTX.lineWidth = 18;
        CTX.shadowBlur = 24; CTX.shadowColor = '#fef9c3';
        CTX.lineCap = 'round';
        CTX.beginPath(); CTX.moveTo(s1.x, s1.y); CTX.lineTo(s2.x, s2.y); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Main chalk line — dashed ──────────────────────────
        CTX.globalAlpha = alpha * 0.92;
        CTX.strokeStyle = '#fffbeb';
        CTX.lineWidth = 4;
        CTX.setLineDash([18, 8]);
        CTX.lineDashOffset = -(now * 28 + this._dashSeed * 3) % 26;
        CTX.shadowBlur = 12; CTX.shadowColor = '#fef9c3';
        CTX.beginPath(); CTX.moveTo(s1.x, s1.y); CTX.lineTo(s2.x, s2.y); CTX.stroke();
        CTX.setLineDash([]); CTX.lineDashOffset = 0; CTX.shadowBlur = 0;

        // ── Tick marks at endpoints ───────────────────────────
        CTX.globalAlpha = alpha * 0.70;
        CTX.strokeStyle = '#fef08a'; CTX.lineWidth = 2.5;
        const tickLen = 10;
        for (const [sx, sy] of [[s1.x, s1.y], [s2.x, s2.y]]) {
            CTX.beginPath();
            CTX.moveTo(sx + Math.cos(this.angle) * tickLen, sy + Math.sin(this.angle) * tickLen);
            CTX.lineTo(sx - Math.cos(this.angle) * tickLen, sy - Math.sin(this.angle) * tickLen);
            CTX.stroke();
        }

        // ── Formula label at midpoint ─────────────────────────
        CTX.globalAlpha = alpha * (0.55 + Math.sin(now * 2.8) * 0.28);
        CTX.font = 'bold 13px "Courier New",monospace';
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillStyle = '#fef9c3';
        CTX.shadowBlur = 8; CTX.shadowColor = '#fbbf24';
        CTX.fillText(this._formula, sc.x, sc.y - 14);
        CTX.shadowBlur = 0;

        // ── Remaining-time arc ────────────────────────────────
        const arcR = 7;
        CTX.globalAlpha = alpha * 0.55;
        CTX.strokeStyle = '#fef9c3'; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.arc(sc.x, sc.y, arcR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - prog));
        CTX.stroke();

        CTX.restore();
    }
}

window.ChalkWall = ChalkWall;
