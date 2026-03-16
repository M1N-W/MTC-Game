'use strict';

/**
 * js/entities/boss/DeadlyGraph.js
 * 📈 DEADLY GRAPH — Expanding laser beam with risk/reward zone
 */
class DeadlyGraph {
    constructor(startX, startY, targetX, targetY, duration = null) {
        this.startX = startX;
        this.startY = startY;
        this.angle = Math.atan2(targetY - startY, targetX - startX);
        this.length = 0;
        this.speed = 600;
        this.damage = BALANCE.boss.graphDamage;
        this.phase = 'expanding'; // expanding → blocking → active
        this.timer = 0;
        this.hasHit = false;
        this._waveOffset = 0; // animates sine wave along beam

        // ── Dynamic max length: ray vs circular arena boundary ───
        const R = (MAP_CONFIG?.arena?.radius ?? 1500);
        const dx = Math.cos(this.angle);
        const dy = Math.sin(this.angle);
        const a = dx * dx + dy * dy;                // always 1
        const b = 2 * (startX * dx + startY * dy);
        const c = startX * startX + startY * startY - R * R;
        const disc = b * b - 4 * a * c;
        if (disc >= 0) {
            const t1 = (-b - Math.sqrt(disc)) / (2 * a);
            const t2 = (-b + Math.sqrt(disc)) / (2 * a);
            this.maxLength = Math.max(t1, t2, 0);
        } else {
            this.maxLength = BALANCE.boss.graphLength;
        }

        this.blockingDuration = duration !== null ? duration / 2 : 5;
        this.activeDuration = duration !== null ? duration / 2 : 5;
    }

    update(dt, player, _meteorZones, boss) {
        this.timer += dt;
        this._waveOffset += dt;

        if (this.phase === 'expanding') {
            this.length += this.speed * dt;

            const tipX = this.startX + Math.cos(this.angle) * this.length;
            const tipY = this.startY + Math.sin(this.angle) * this.length;

            // ── Player hit (only if graph is NOT reflected) ───────
            if (!this._reflected) {
                const pd = this._pointToLineDistance(
                    player.x, player.y,
                    this.startX, this.startY, tipX, tipY
                );
                if (!this.hasHit && pd < 20) {
                    player.takeDamage(this.damage);
                    this.hasHit = true;
                }
            }

            // ── Boss hit (only if graph IS reflected back) ────────
            if (this._reflected && boss && !boss.dead) {
                const bd = this._pointToLineDistance(
                    boss.x, boss.y,
                    this.startX, this.startY, tipX, tipY
                );
                if (!this.hasHit && bd < (boss.radius ?? 50) + 10) {
                    if (typeof boss.takeDamage === 'function') {
                        boss.takeDamage(this.damage, player);
                    }
                    this.hasHit = true;
                    if (typeof spawnFloatingText === 'function') {
                        spawnFloatingText('📈 GRAPH REFLECTED!', boss.x, boss.y - 90, '#facc15', 28);
                    }
                    if (typeof spawnParticles === 'function') spawnParticles(boss.x, boss.y, 20, '#facc15');
                    if (typeof addScreenShake === 'function') addScreenShake(10);
                }
            }

            if (this.length >= this.maxLength) {
                this.length = this.maxLength;
                this.phase = 'blocking';
                this.timer = 0;
            }

        } else if (this.phase === 'blocking') {
            if (this.timer >= this.blockingDuration) {
                this.phase = 'active';
                this.timer = 0;

                // ── Destruction FX when laser activates ──────────────
                if (!this._reflected && window.mapSystem && typeof window.mapSystem.damageArea === 'function') {
                    const ex = this.startX + Math.cos(this.angle) * this.maxLength;
                    const ey = this.startY + Math.sin(this.angle) * this.maxLength;
                    window.mapSystem.damageArea(this.startX, this.startY, ex, ey);
                }
            }

        } else if (this.phase === 'active') {
            const endX = this.startX + Math.cos(this.angle) * this.length;
            const endY = this.startY + Math.sin(this.angle) * this.length;

            // ── Player exposure (only if not reflected — reflected graph chases boss) ──
            if (!this._reflected) {
                const pd = this._pointToLineDistance(
                    player.x, player.y,
                    this.startX, this.startY, endX, endY
                );
                const onBeam = pd < 25;
                player.onGraph = onBeam;
                if (onBeam) player.graphBuffTimer = 0.15;
            }

            if (this.timer >= this.activeDuration) {
                if (!this._reflected) {
                    player.onGraph = false;
                    player.graphBuffTimer = 0;
                }
                return true; // Remove
            }
        }

        return false;
    }

    // ── Private helpers ───────────────────────────────────────
    _pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1, B = py - y1;
        const C = x2 - x1, D = y2 - y1;
        const lenSq = C * C + D * D;
        let param = lenSq !== 0 ? (A * C + B * D) / lenSq : -1;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        return Math.hypot(px - xx, py - yy);
    }

    // ── Draw ──────────────────────────────────────────────────
    draw() {
        if (typeof CTX === 'undefined') return;
        const ss = worldToScreen(this.startX, this.startY);
        const ex = this.startX + Math.cos(this.angle) * this.length;
        const ey = this.startY + Math.sin(this.angle) * this.length;
        const es = worldToScreen(ex, ey);

        const bx = es.x - ss.x;
        const by = es.y - ss.y;
        const bLen = Math.hypot(bx, by);
        if (bLen < 1) return;
        // Unit perpendicular
        const perp_x = -by / bLen;
        const perp_y = bx / bLen;

        CTX.save();

        // ── PHASE: expanding — bright traveling tip + building beam ──
        if (this.phase === 'expanding') {
            const now = performance.now();
            // Wide outer glow
            CTX.globalAlpha = 0.35;
            CTX.strokeStyle = '#60a5fa'; CTX.lineWidth = 24;
            CTX.shadowBlur = 32; CTX.shadowColor = '#3b82f6';
            CTX.lineCap = 'round';
            CTX.beginPath(); CTX.moveTo(ss.x, ss.y); CTX.lineTo(es.x, es.y); CTX.stroke();
            // Core beam
            CTX.globalAlpha = 0.90;
            CTX.strokeStyle = '#93c5fd'; CTX.lineWidth = 4; CTX.shadowBlur = 18;
            CTX.beginPath(); CTX.moveTo(ss.x, ss.y); CTX.lineTo(es.x, es.y); CTX.stroke();
            // Bright white center line
            CTX.strokeStyle = '#ffffff'; CTX.lineWidth = 2; CTX.shadowBlur = 10;
            CTX.beginPath(); CTX.moveTo(ss.x, ss.y); CTX.lineTo(es.x, es.y); CTX.stroke();
            CTX.shadowBlur = 0;
            // Traveling hot dot at tip
            CTX.globalAlpha = 0.90;
            CTX.fillStyle = '#ffffff'; CTX.shadowBlur = 22; CTX.shadowColor = '#60a5fa';
            CTX.beginPath(); CTX.arc(es.x, es.y, 9, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#3b82f6';
            CTX.beginPath(); CTX.arc(es.x, es.y, 5, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;
            // Grid tick marks
            CTX.globalAlpha = 0.40;
            CTX.strokeStyle = 'rgba(0,229,255,0.60)'; CTX.lineWidth = 1.2;
            const tickStep = 55;
            const steps = Math.floor(bLen / tickStep);
            for (let i = 1; i <= steps; i++) {
                const t = (i * tickStep) / bLen;
                const tx = ss.x + bx * t, ty = ss.y + by * t;
                CTX.beginPath();
                CTX.moveTo(tx + perp_x * 8, ty + perp_y * 8);
                CTX.lineTo(tx - perp_x * 8, ty - perp_y * 8);
                CTX.stroke();
            }
            CTX.restore();
            return;
        }

        // ── PHASE: blocking — dashed standby with pulsing warning ──
        if (this.phase === 'blocking') {
            const now = performance.now();
            const pulse = 0.4 + Math.sin(now / 160) * 0.35;
            // Faint dashed standby line
            CTX.globalAlpha = 0.22 + pulse * 0.12;
            CTX.strokeStyle = 'rgba(100,160,255,0.85)';
            CTX.lineWidth = 3; CTX.setLineDash([12, 10]);
            CTX.shadowBlur = 8 * pulse; CTX.shadowColor = '#60a5fa';
            CTX.beginPath(); CTX.moveTo(ss.x, ss.y); CTX.lineTo(es.x, es.y); CTX.stroke();
            CTX.setLineDash([]);
            // "INCOMING" warning label at midpoint
            const midX = (ss.x + es.x) / 2, midY = (ss.y + es.y) / 2;
            CTX.shadowBlur = 0;
            CTX.globalAlpha = 0.55 + pulse * 0.35;
            CTX.font = 'bold 11px "Orbitron",monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillStyle = '#93c5fd';
            CTX.fillText('▶ GRAPH INCOMING ◀', midX + perp_x * 26, midY + perp_y * 26);
            CTX.restore();
            return;
        }

        // ── PHASE: active — full danger beam ─────────────────
        const now = performance.now();
        const waveNow = this._waveOffset;
        const waveAmp = 14; const waveFreq = 0.055; const waveSpeed = 5.5;

        // Outer kill-zone glow (wide, red-orange)
        CTX.globalAlpha = 0.20;
        CTX.strokeStyle = '#ff6b00'; CTX.lineWidth = 36;
        CTX.shadowBlur = 45; CTX.shadowColor = '#ff4500';
        CTX.lineCap = 'round';
        CTX.beginPath(); CTX.moveTo(ss.x, ss.y); CTX.lineTo(es.x, es.y); CTX.stroke();

        // Mid glow
        CTX.globalAlpha = 0.38;
        CTX.strokeStyle = '#ff4500'; CTX.lineWidth = 16; CTX.shadowBlur = 28;
        CTX.beginPath(); CTX.moveTo(ss.x, ss.y); CTX.lineTo(es.x, es.y); CTX.stroke();

        // Core beam
        CTX.globalAlpha = 1.0;
        CTX.strokeStyle = '#ff4500'; CTX.lineWidth = 10; CTX.shadowBlur = 30;
        CTX.beginPath(); CTX.moveTo(ss.x, ss.y); CTX.lineTo(es.x, es.y); CTX.stroke();

        // White hot center
        CTX.strokeStyle = '#ffffff'; CTX.lineWidth = 3; CTX.shadowBlur = 12; CTX.shadowColor = '#ff4500';
        CTX.beginPath(); CTX.moveTo(ss.x, ss.y); CTX.lineTo(es.x, es.y); CTX.stroke();

        // Grid ticks (orange danger)
        CTX.shadowBlur = 0; CTX.globalAlpha = 0.55;
        CTX.strokeStyle = 'rgba(255,140,0,0.65)'; CTX.lineWidth = 1.5;
        const tickSpacing = 55;
        const tickLen = 12;
        const numTicks = Math.floor(bLen / tickSpacing);
        for (let i = 1; i <= numTicks; i++) {
            const t = (i * tickSpacing) / bLen;
            const tx = ss.x + bx * t, ty = ss.y + by * t;
            CTX.beginPath();
            CTX.moveTo(tx + perp_x * tickLen, ty + perp_y * tickLen);
            CTX.lineTo(tx - perp_x * tickLen, ty - perp_y * tickLen);
            CTX.stroke();
        }

        // Sine wave overlay
        CTX.globalAlpha = 0.80;
        CTX.strokeStyle = 'rgba(255,120,0,0.80)'; CTX.lineWidth = 3;
        CTX.shadowBlur = 14; CTX.shadowColor = 'rgba(255,100,0,0.8)';
        CTX.beginPath();
        const WAVE_STEPS = Math.ceil(bLen / 3);
        for (let i = 0; i <= WAVE_STEPS; i++) {
            const t = i / WAVE_STEPS;
            const bpx = ss.x + bx * t, bpy = ss.y + by * t;
            const beamDist = t * bLen;
            const amp = Math.sin(beamDist * waveFreq * Math.PI * 2 - waveNow * waveSpeed) * waveAmp;
            const wpx = bpx + perp_x * amp, wpy = bpy + perp_y * amp;
            i === 0 ? CTX.moveTo(wpx, wpy) : CTX.lineTo(wpx, wpy);
        }
        CTX.stroke();
        CTX.shadowBlur = 0;

        // Animated endpoint explosion ring
        const epPulse = 0.5 + Math.sin(now / 75) * 0.5;
        CTX.globalAlpha = 0.70 * epPulse;
        CTX.strokeStyle = '#ff4500'; CTX.lineWidth = 3;
        CTX.shadowBlur = 16; CTX.shadowColor = '#ff6b00';
        CTX.beginPath(); CTX.arc(es.x, es.y, 16 + epPulse * 10, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // Label
        CTX.globalAlpha = 0.88;
        CTX.font = 'bold 18px "Orbitron",monospace';
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillStyle = '#ff6b00'; CTX.shadowBlur = 8; CTX.shadowColor = '#ff4500';
        const labelX = es.x + perp_x * 30, labelY = es.y + perp_y * 30;
        CTX.fillText('f(x) !!!', labelX, labelY);

        // Risk/reward zone label (preserved)
        CTX.shadowBlur = 0;
        CTX.font = 'bold 12px monospace';
        CTX.fillStyle = 'rgba(255,180,0,0.90)';
        CTX.fillText('⚡ RISK/REWARD ZONE ⚡', (ss.x + es.x) / 2, (ss.y + es.y) / 2 + perp_y * 32);

        CTX.restore();
    }
}

window.DeadlyGraph = DeadlyGraph;
