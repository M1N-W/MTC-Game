'use strict';
/**
 * js/entities/boss_attacks.js
 *
 * All projectiles, effects, and minions spawned BY bosses.
 * Boss entity classes (KruManop, KruFirst, BossDog) live in boss.js.
 *
 * Load order: must be loaded BEFORE boss.js
 *
 * ── Contents ────────────────────────────────────────────────
 *   BarkWave           — Sonic cone from KruManop bark (Phase 2)
 *   GoldfishMinion     — Kamikaze sine-wave chaser (Phase 3)
 *   BubbleProjectile   — Slow AoE projectile (Phase 3)
 *   FreeFallWarningRing — Visual AoE warning indicator (KruFirst)
 */
// ════════════════════════════════════════════════════════════
// 🌊 BARK WAVE — Sonic cone emitted by KruManop's bark attack
// ════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════
// 🐟 GOLDFISH MINION — Kamikaze sine-wave chaser (Phase 3)
// ════════════════════════════════════════════════════════════
class GoldfishMinion extends Entity {
    constructor(x, y) {
        const cfg = BALANCE.boss.goldfishMinion;
        super(x, y, cfg.radius);
        this.maxHp = cfg.hp;
        this.hp = cfg.hp;
        this.moveSpeed = cfg.speed;
        this.damage = cfg.damage;
        this.wobbleAmp = cfg.wobbleAmp;
        this.wobbleFreq = cfg.wobbleFreq;
        this.lifeTimer = 0;
        this._perpX = 0;
        this._perpY = 0;
        this.name = '🐟';
    }

    update(dt, player) {
        if (this.dead) return;

        this.lifeTimer += dt;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);

        if (d > 0) {
            this.angle = Math.atan2(dy, dx);
            this._perpX = -dy / d;
            this._perpY = dx / d;

            const wobble = Math.sin(this.lifeTimer * this.wobbleFreq) * this.wobbleAmp;
            this.vx = (dx / d) * this.moveSpeed + this._perpX * wobble;
            this.vy = (dy / d) * this.moveSpeed + this._perpY * wobble;
        }
        this.applyPhysics(dt);

        // Kamikaze explosion on player contact
        if (d < this.radius + player.radius) {
            player.takeDamage(this.damage);
            spawnParticles(this.x, this.y, 18, BALANCE.boss.goldfishMinion.color);
            spawnFloatingText('🐟 SPLASH!', this.x, this.y - 35, '#fb923c', 22);
            addScreenShake(6);
            this.dead = true;
        }

        if (this.hp <= 0 && !this.dead) {
            this.dead = true;
            spawnParticles(this.x, this.y, 12, BALANCE.boss.goldfishMinion.color);
            addScore(50);
        }
    }

    takeDamage(amt) {
        if (this.dead) return;  // BUG B3 FIX: guard against double-death (contact + projectile same frame)
        this.hp -= amt;
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const now = performance.now();
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        if (isFacingLeft) CTX.scale(-1, 1);

        const breathe = Math.sin(now / 140);
        CTX.scale(1 + breathe * 0.038, 1 - breathe * 0.022);

        const cfg = BALANCE.boss.goldfishMinion;
        const r = cfg.radius;

        // ── Bubble trail (behind body, drawn first) ───────────
        CTX.save();
        for (let b = 0; b < 3; b++) {
            const bPhase = (now / 750 + b * 0.33) % 1;
            const bx = -r * (0.95 + bPhase * 1.85);
            const by = r * 0.08 + Math.sin(now / 200 + b * 1.5) * r * 0.38;
            CTX.globalAlpha = (1 - bPhase) * 0.52;
            CTX.strokeStyle = 'rgba(125,211,252,0.9)';
            CTX.lineWidth = 1.2;
            CTX.beginPath(); CTX.arc(bx, by, r * 0.10 + bPhase * r * 0.07, 0, Math.PI * 2); CTX.stroke();
        }
        CTX.globalAlpha = 1;
        CTX.restore();

        // ── Flowing double veil-tail (veiltail goldfish) ──────
        const tailWag = Math.sin(now / 95) * 0.52;
        // Upper lobe
        CTX.fillStyle = 'rgba(220,60,10,0.78)';
        CTX.shadowBlur = 7; CTX.shadowColor = '#f97316';
        CTX.beginPath();
        CTX.moveTo(-r * 0.82, 0);
        CTX.bezierCurveTo(
            -r * 1.28, -r * 0.52 + tailWag * r * 0.38,
            -r * 2.00, -r * 1.05 + tailWag * r * 0.28,
            -r * 2.28, -r * 0.85 + tailWag * r * 0.32);
        CTX.bezierCurveTo(-r * 1.78, -r * 0.40, -r * 1.18, -r * 0.16, -r * 0.82, 0);
        CTX.closePath(); CTX.fill();
        // Lower lobe
        CTX.beginPath();
        CTX.moveTo(-r * 0.82, 0);
        CTX.bezierCurveTo(
            -r * 1.28, r * 0.52 - tailWag * r * 0.38,
            -r * 2.00, r * 1.05 - tailWag * r * 0.28,
            -r * 2.28, r * 0.85 - tailWag * r * 0.32);
        CTX.bezierCurveTo(-r * 1.78, r * 0.40, -r * 1.18, r * 0.16, -r * 0.82, 0);
        CTX.closePath(); CTX.fill();
        // Tail vein rays
        CTX.strokeStyle = '#9a3412'; CTX.lineWidth = 1.1;
        CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.moveTo(-r * 0.82, 0); CTX.lineTo(-r * 2.28, -r * 0.85 + tailWag * r * 0.32); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-r * 0.82, 0); CTX.lineTo(-r * 1.60, -r * 0.70 + tailWag * r * 0.20); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-r * 0.82, 0); CTX.lineTo(-r * 2.28, r * 0.85 - tailWag * r * 0.32); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(-r * 0.82, 0); CTX.lineTo(-r * 1.60, r * 0.70 - tailWag * r * 0.20); CTX.stroke();

        // ── Spiky dorsal fin (multi-spike, dangerous) ─────────
        const dorsalWave = Math.sin(now / 125) * 0.22;
        CTX.fillStyle = 'rgba(220,38,38,0.82)';
        CTX.strokeStyle = '#7f1d1d'; CTX.lineWidth = 1.4;
        CTX.shadowBlur = 8; CTX.shadowColor = '#ef4444';
        CTX.beginPath();
        CTX.moveTo(-r * 0.30, -r * 0.80);
        CTX.lineTo(-r * 0.12, -r * 1.72 + dorsalWave * r * 0.16);  // spike 1
        CTX.lineTo(r * 0.08, -r * 1.42);
        CTX.lineTo(r * 0.26, -r * 1.88 + dorsalWave * r * 0.12);  // spike 2
        CTX.lineTo(r * 0.48, -r * 1.56);
        CTX.lineTo(r * 0.66, -r * 1.82 + dorsalWave * r * 0.10);  // spike 3
        CTX.lineTo(r * 0.78, -r * 0.82);
        CTX.closePath(); CTX.fill(); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Pectoral fins ─────────────────────────────────────
        CTX.fillStyle = 'rgba(234,88,12,0.70)';
        CTX.beginPath();
        CTX.moveTo(r * 0.05, -r * 0.44);
        CTX.quadraticCurveTo(r * 0.58, -r * 0.92, r * 0.64, -r * 0.44);
        CTX.quadraticCurveTo(r * 0.32, -r * 0.26, r * 0.05, -r * 0.44);
        CTX.closePath(); CTX.fill();
        CTX.beginPath();
        CTX.moveTo(r * 0.05, r * 0.44);
        CTX.quadraticCurveTo(r * 0.58, r * 0.92, r * 0.64, r * 0.44);
        CTX.quadraticCurveTo(r * 0.32, r * 0.26, r * 0.05, r * 0.44);
        CTX.closePath(); CTX.fill();

        // ── Main body — vivid orange-gold gradient ────────────
        const bodyG = CTX.createRadialGradient(-r * 0.18, -r * 0.22, 0, r * 0.05, 0, r);
        bodyG.addColorStop(0, '#ffb04a');
        bodyG.addColorStop(0.42, '#f97316');
        bodyG.addColorStop(0.78, '#ea580c');
        bodyG.addColorStop(1, '#c2410c');
        CTX.fillStyle = bodyG;
        CTX.shadowBlur = 14; CTX.shadowColor = '#f97316';
        CTX.beginPath(); CTX.ellipse(0, 0, r, r * 0.80, 0, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#9a3412'; CTX.lineWidth = 2.5; CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.ellipse(0, 0, r, r * 0.80, 0, 0, Math.PI * 2); CTX.stroke();

        // ── Golden belly shimmer ──────────────────────────────
        CTX.fillStyle = 'rgba(255,220,110,0.36)';
        CTX.beginPath(); CTX.ellipse(r * 0.12, r * 0.20, r * 0.42, r * 0.24, 0, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.32)';
        CTX.beginPath(); CTX.arc(-r * 0.24, -r * 0.26, r * 0.20, 0, Math.PI * 2); CTX.fill();

        // ── Overlapping scale arcs ────────────────────────────
        CTX.strokeStyle = 'rgba(154,52,18,0.42)'; CTX.lineWidth = 1.0;
        const scaleRows = [
            { y: -r * 0.18, xs: [-r * 0.44, -r * 0.18, r * 0.08, r * 0.34] },
            { y: r * 0.08, xs: [-r * 0.56, -r * 0.30, r * 0.00, r * 0.26] },
            { y: r * 0.32, xs: [-r * 0.44, -r * 0.18, r * 0.08] },
        ];
        for (const row of scaleRows) {
            for (const sx of row.xs) {
                CTX.beginPath(); CTX.arc(sx, row.y, r * 0.27, Math.PI, Math.PI * 2); CTX.stroke();
            }
        }

        // ── Demonic eye — red iris + slit pupil ──────────────
        const eyeGlow = 0.82 + Math.sin(now / 165) * 0.18;
        // Sclera
        CTX.fillStyle = '#fee2e2';
        CTX.beginPath(); CTX.ellipse(r * 0.52, -r * 0.24, r * 0.20, r * 0.16, -0.15, 0, Math.PI * 2); CTX.fill();
        // Red iris
        CTX.fillStyle = `rgba(220,38,38,${eyeGlow})`;
        CTX.shadowBlur = 13 * eyeGlow; CTX.shadowColor = '#ef4444';
        CTX.beginPath(); CTX.ellipse(r * 0.53, -r * 0.24, r * 0.13, r * 0.13, 0, 0, Math.PI * 2); CTX.fill();
        // Slit pupil
        CTX.fillStyle = '#0f0500'; CTX.shadowBlur = 0;
        CTX.beginPath(); CTX.ellipse(r * 0.54, -r * 0.24, r * 0.04, r * 0.13, 0, 0, Math.PI * 2); CTX.fill();
        // Eye shine
        CTX.fillStyle = 'rgba(255,255,255,0.88)';
        CTX.beginPath(); CTX.arc(r * 0.46, -r * 0.29, r * 0.04, 0, Math.PI * 2); CTX.fill();

        // ── Angry brow ────────────────────────────────────────
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.8; CTX.lineCap = 'round';
        CTX.beginPath();
        CTX.moveTo(r * 0.38, -r * 0.44);
        CTX.lineTo(r * 0.76, -r * 0.32);
        CTX.stroke();

        // ── Mouth with small fang ─────────────────────────────
        CTX.strokeStyle = '#7f1d1d'; CTX.lineWidth = 1.6; CTX.lineCap = 'round';
        CTX.beginPath(); CTX.arc(r * 0.80, r * 0.05, r * 0.14, 0.2, Math.PI - 0.2); CTX.stroke();
        CTX.fillStyle = '#fef2f2';
        CTX.beginPath();
        CTX.moveTo(r * 0.70, r * 0.10); CTX.lineTo(r * 0.68, r * 0.22); CTX.lineTo(r * 0.76, r * 0.10);
        CTX.closePath(); CTX.fill();

        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🫧 BUBBLE PROJECTILE — Slow + damage AoE (Phase 3)
// ════════════════════════════════════════════════════════════
class BubbleProjectile {
    constructor(x, y, angle) {
        const cfg = BALANCE.boss.bubbleProjectile;
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * cfg.speed;
        this.vy = Math.sin(angle) * cfg.speed;
        this.radius = cfg.radius;
        this.damage = cfg.damage;
        this.angle = angle;
        this.dead = false;
        this.lifeTimer = 0;
        this.maxLife = 6;
    }

    update(dt, player) {
        if (this.dead) return true;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.lifeTimer += dt;

        const worldBounds = GAME_CONFIG.physics.worldBounds;
        if (Math.abs(this.x) > worldBounds * 1.5 || Math.abs(this.y) > worldBounds * 1.5) {
            this.dead = true;
            return true;
        }

        if (this.lifeTimer >= this.maxLife) {
            this._pop();
            return true;
        }

        const d = Math.hypot(player.x - this.x, player.y - this.y);
        if (d < this.radius + player.radius) {
            player.takeDamage(this.damage);
            const P3 = BALANCE.boss.phase3;
            player._bubbleSlowTimer = P3.slowDuration;
            if (!player._bubbleSlowApplied) {
                player._bubbleSlowApplied = true;
                player._baseMoveSpeedBubble = player.moveSpeed;
                player.moveSpeed = player.moveSpeed * P3.slowFactor;
            }
            spawnFloatingText('🫧 SLOWED!', player.x, player.y - 50, '#38bdf8', 22);
            addScreenShake(8);
            this._pop();
            return true;
        }

        return false;
    }

    _pop() {
        this.dead = true;
        spawnParticles(this.x, this.y, 10, '#bae6fd');
        spawnFloatingText('POP!', this.x, this.y - 20, '#7dd3fc', 18);
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const r = this.radius;
        const now = performance.now();
        const pulse = 1 + Math.sin(this.lifeTimer * 5.2) * 0.09;
        const spinAngle = this.lifeTimer * 1.8;
        const urgency = Math.min(1, this.lifeTimer / this.maxLife);  // 0→1 as it ages

        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ── Outer toxic glow halo ─────────────────────────────
        const haloG = CTX.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.5);
        haloG.addColorStop(0, `rgba(56,189,248,${0.12 + urgency * 0.10})`);
        haloG.addColorStop(0.6, `rgba(34,211,238,${0.06 + urgency * 0.06})`);
        haloG.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.fillStyle = haloG;
        CTX.beginPath(); CTX.arc(0, 0, r * 1.5, 0, Math.PI * 2); CTX.fill();

        // ── Main bubble body ──────────────────────────────────
        CTX.shadowBlur = 20 + urgency * 12; CTX.shadowColor = urgency > 0.6 ? '#22d3ee' : '#38bdf8';
        const bubG = CTX.createRadialGradient(-r * 0.25, -r * 0.25, 0, 0, 0, r);
        bubG.addColorStop(0, `rgba(186,230,253,${0.55 + urgency * 0.20})`);
        bubG.addColorStop(0.45, `rgba(56,189,248,${0.25 + urgency * 0.15})`);
        bubG.addColorStop(1, `rgba(8,145,178,${0.40 + urgency * 0.20})`);
        CTX.fillStyle = bubG;
        CTX.beginPath(); CTX.arc(0, 0, r * pulse, 0, Math.PI * 2); CTX.fill();

        // Outer shell ring
        CTX.strokeStyle = `rgba(125,211,252,${0.75 + urgency * 0.20})`; CTX.lineWidth = 2.2 + urgency;
        CTX.beginPath(); CTX.arc(0, 0, r * pulse, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Spinning orbit segments (prison bars feel) ────────
        CTX.save();
        CTX.rotate(spinAngle);
        for (let seg = 0; seg < 6; seg++) {
            const sa = (seg / 6) * Math.PI * 2;
            const sAlpha = (0.18 + urgency * 0.20) * (0.6 + Math.sin(now / 300 + seg) * 0.4);
            CTX.strokeStyle = `rgba(34,211,238,${sAlpha})`;
            CTX.lineWidth = 1.2;
            CTX.beginPath();
            CTX.arc(0, 0, r * 0.80, sa, sa + Math.PI / 4);
            CTX.stroke();
        }
        CTX.restore();

        // ── Tox swirl inside ─────────────────────────────────
        CTX.save();
        CTX.rotate(-spinAngle * 0.55);
        CTX.globalAlpha = 0.20 + urgency * 0.18;
        CTX.strokeStyle = '#7dd3fc'; CTX.lineWidth = 1.0;
        CTX.beginPath();
        for (let sx = 0; sx < Math.PI * 2; sx += 0.25) {
            const sr = r * 0.45 * (1 + Math.sin(sx * 3) * 0.28);
            if (sx === 0) CTX.moveTo(Math.cos(sx) * sr, Math.sin(sx) * sr);
            else CTX.lineTo(Math.cos(sx) * sr, Math.sin(sx) * sr);
        }
        CTX.closePath(); CTX.stroke();
        CTX.restore();

        // ── Highlights ────────────────────────────────────────
        CTX.fillStyle = `rgba(255,255,255,${0.62 + Math.sin(now / 280) * 0.20})`;
        CTX.beginPath(); CTX.ellipse(-r * 0.28, -r * 0.30, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = 'rgba(255,255,255,0.45)';
        CTX.beginPath(); CTX.arc(-r * 0.10, r * 0.35, r * 0.07, 0, Math.PI * 2); CTX.fill();

        // ── Urgency warning flash when old ────────────────────
        if (urgency > 0.72) {
            const warnPulse = 0.5 + Math.sin(now / 90) * 0.5;
            CTX.strokeStyle = `rgba(34,211,238,${warnPulse * 0.65})`;
            CTX.lineWidth = 3; CTX.shadowBlur = 12; CTX.shadowColor = '#22d3ee';
            CTX.beginPath(); CTX.arc(0, 0, r * 1.18, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;
        }

        CTX.restore();
    }
}


// ════════════════════════════════════════════════════════════
// ⚠️  FREE FALL WARNING RING — AoE visual indicator (BossFirst)
// ════════════════════════════════════════════════════════════
class FreeFallWarningRing {
    constructor(x, y, duration) {
        this.x = x;
        this.y = y;
        this.duration = duration;
        this.timer = 0;
        this.dead = false;
        this.radius = 140;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration) { this.dead = true; return true; }
        return false;
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const prog = this.timer / this.duration;
        const pulse = 0.5 + Math.sin(this.timer * 12) * 0.45;
        const alpha = (1 - prog * 0.4) * pulse;

        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.shadowBlur = 20 * pulse;
        CTX.shadowColor = '#ef4444';
        CTX.strokeStyle = `rgba(239,68,68,${alpha})`;
        CTX.lineWidth = 3;
        CTX.setLineDash([12, 8]);
        CTX.beginPath(); CTX.arc(0, 0, this.radius * (0.85 + prog * 0.15), 0, Math.PI * 2); CTX.stroke();
        CTX.setLineDash([]);
        CTX.shadowBlur = 0;
        CTX.font = 'bold 22px Arial';
        CTX.textAlign = 'center';
        CTX.textBaseline = 'middle';
        CTX.globalAlpha = alpha;
        CTX.fillText('⚠️', 0, 0);
        CTX.globalAlpha = 1;
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🥪  PORK SANDWICH — BossFirst SANDWICH_TOSS projectile
// ════════════════════════════════════════════════════════════
class PorkSandwich {
    constructor(x, y, angle, boss) {
        this.x = x;
        this.y = y;
        this.boss = boss;
        this.dead = false;
        this.radius = 22;

        const speed = 500;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Visual spin
        this.rotation = 0;
        this.spinSpeed = 9; // rad/s

        // Weak homing — steers toward player for first 0.5 s
        this.homingTimer = 0;
        this.homingDuration = 0.5;
        this.homingStrength = 4.0; // rad/s max angular correction

        // Lifetime & damage
        this.lifeTimer = 0;
        this.maxLife = 3.5;
        this.damage = 160;
        this.hitCd = 0; // i-frame cooldown after hit

        // Motion trail: [{x, y, age}]
        this._trail = [];
    }

    update(dt, player) {
        if (this.dead) return true;

        this.lifeTimer += dt;
        this.rotation += this.spinSpeed * dt;
        if (this.hitCd > 0) this.hitCd -= dt;

        // ── Weak homing ───────────────────────────────────────
        if (this.homingTimer < this.homingDuration) {
            this.homingTimer += dt;
            const desired = Math.atan2(player.y - this.y, player.x - this.x);
            const current = Math.atan2(this.vy, this.vx);
            let diff = desired - current;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const correction = Math.sign(diff) * Math.min(Math.abs(diff), this.homingStrength * dt);
            const newAngle = current + correction;
            const spd = Math.hypot(this.vx, this.vy);
            this.vx = Math.cos(newAngle) * spd;
            this.vy = Math.sin(newAngle) * spd;
        }

        // ── Move ──────────────────────────────────────────────
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // ── Trail ─────────────────────────────────────────────
        this._trail.push({ x: this.x, y: this.y, age: 0 });
        for (const p of this._trail) p.age += dt;
        while (this._trail.length && this._trail[0].age > 0.2) this._trail.shift();

        // ── Parry — player projectile intercepts sandwich ──────
        // Scans all live player-team projectiles each frame.
        // First overlap deflects the sandwich back toward the boss
        // at +25 % speed, consumes the projectile, and unlocks the achievement.
        if (!this._parried && typeof projectileManager !== 'undefined' && projectileManager) {
            const allProjs = projectileManager.getAll
                ? projectileManager.getAll()
                : (projectileManager.list || []);

            for (const proj of allProjs) {
                if (!proj || proj.dead || proj.team !== 'player') continue;
                const pdx = proj.x - this.x;
                const pdy = proj.y - this.y;
                if (Math.hypot(pdx, pdy) < this.radius + (proj.radius ?? 8)) {
                    // ── Confirmed parry ───────────────────────
                    this._parried = true;

                    // Consume the intercepting projectile
                    proj.dead = true;

                    // Redirect toward boss (+25 % speed), or straight-back fallback
                    if (this.boss && !this.boss.dead) {
                        const toBossAngle = Math.atan2(
                            this.boss.y - this.y,
                            this.boss.x - this.x
                        );
                        const spd = Math.hypot(this.vx, this.vy) * 1.25;
                        this.vx = Math.cos(toBossAngle) * spd;
                        this.vy = Math.sin(toBossAngle) * spd;
                    } else {
                        this.vx *= -1;
                        this.vy *= -1;
                    }

                    // Cancel homing so it flies straight at the boss
                    this.homingTimer = this.homingDuration;

                    // Visual + audio feedback
                    spawnParticles(this.x, this.y, 14, '#facc15');
                    spawnFloatingText('🥪 PARRIED!', this.x, this.y - 55, '#facc15', 26);
                    addScreenShake(8);

                    // ── Achievement ───────────────────────────
                    // FIX: Was calling check() directly without incrementing the stat,
                    //      so parry_master could never satisfy `parries >= 1`.
                    if (typeof Achievements !== 'undefined') {
                        Achievements.stats.parries++;
                        Achievements.check('parry_master');
                    }
                    break;
                }
            }
        }

        // ── Parried sandwich hits boss (return damage ×2) ─────
        if (this._parried && this.boss && !this.boss.dead) {
            const bd = Math.hypot(this.boss.x - this.x, this.boss.y - this.y);
            if (bd < this.radius + this.boss.radius) {
                this.boss.takeDamage(this.damage * 2);
                spawnParticles(this.boss.x, this.boss.y, 20, '#facc15');
                spawnFloatingText('🥪 RETURN TO SENDER!', this.boss.x, this.boss.y - 70, '#facc15', 28);
                addScreenShake(12);
                this.dead = true;
                return true;
            }
        }

        // ── Player collision (un-parried only) ────────────────
        if (!this._parried && this.hitCd <= 0) {
            const d = Math.hypot(player.x - this.x, player.y - this.y);
            if (d < this.radius + player.radius) {
                player.takeDamage(this.damage);
                this.hitCd = 0.8;
                addScreenShake(7);
                spawnParticles(this.x, this.y, 12, '#f59e0b');
                spawnFloatingText('🥪 BONK!', this.x, this.y - 45, '#f97316', 22);
                this.dead = true;
                return true;
            }
        }

        // ── Out-of-bounds / expired ────────────────────────────
        const wb = GAME_CONFIG.physics.worldBounds;
        if (this.lifeTimer >= this.maxLife ||
            Math.abs(this.x) > wb * 1.5 || Math.abs(this.y) > wb * 1.5) {
            this.dead = true;
            return true;
        }

        return false;
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);

        // ── Motion trail ──────────────────────────────────────
        for (const p of this._trail) {
            const s = worldToScreen(p.x, p.y);
            const fac = 1 - p.age / 0.2;
            CTX.beginPath();
            CTX.arc(s.x, s.y, this.radius * 0.4 * fac, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(249,115,22,${0.3 * fac})`;
            CTX.fill();
        }

        // ── Sandwich body ─────────────────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.rotation);

        const r = this.radius;

        // Bottom bun
        CTX.fillStyle = '#d97706';
        CTX.beginPath(); CTX.ellipse(0, r * 0.32, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); CTX.fill();

        // Lettuce
        CTX.fillStyle = '#4ade80';
        CTX.beginPath(); CTX.ellipse(0, r * 0.06, r * 0.82, r * 0.20, 0, 0, Math.PI * 2); CTX.fill();

        // Pork
        CTX.fillStyle = '#fb923c';
        CTX.beginPath(); CTX.ellipse(0, -r * 0.06, r * 0.78, r * 0.17, 0, 0, Math.PI * 2); CTX.fill();

        // Top bun (dome)
        CTX.fillStyle = '#f59e0b';
        CTX.beginPath(); CTX.ellipse(0, -r * 0.28, r * 0.85, r * 0.40, 0, 0, Math.PI); CTX.fill();

        // Sesame seeds
        CTX.fillStyle = '#fef3c7';
        for (let i = -1; i <= 1; i++) {
            CTX.beginPath(); CTX.ellipse(i * r * 0.28, -r * 0.50, 3, 2, i * 0.4, 0, Math.PI * 2); CTX.fill();
        }

        // Glow
        CTX.shadowBlur = 14;
        CTX.shadowColor = '#f59e0b';
        CTX.strokeStyle = 'rgba(251,191,36,0.7)';
        CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.ellipse(0, -r * 0.28, r * 0.85, r * 0.40, 0, 0, Math.PI); CTX.stroke();
        CTX.shadowBlur = 0;

        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 💥 EXPANDING RING — Shockwave visual (BossFirst FREE_FALL)
// ════════════════════════════════════════════════════════════
class ExpandingRing {
    constructor(x, y, color, maxRadius = 140, duration = 0.5) {
        this.x = x; this.y = y; this.color = color;
        this.maxRadius = maxRadius; this.duration = duration;
        this.timer = 0; this.dead = false;
    }
    update(dt) {
        this.timer += dt;
        if (this.timer >= this.duration) this.dead = true;
        return this.dead;
    }
    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const prog = this.timer / this.duration;
        const r = this.maxRadius * Math.sqrt(prog);
        const alpha = 1 - prog;
        const now = performance.now();

        CTX.save();

        // ── Outer fill dome ───────────────────────────────────
        const fillG = CTX.createRadialGradient(screen.x, screen.y, r * 0.55, screen.x, screen.y, r);
        fillG.addColorStop(0, `rgba(255,255,255,0)`);
        fillG.addColorStop(0.7, (() => {
            const a = (alpha * 0.08).toFixed(3);
            if (this.color.startsWith('rgba(')) return this.color.replace(/,\s*[\d.]+\)$/, `,${a})`);
            if (this.color.startsWith('rgb(')) return this.color.replace('rgb(', 'rgba(').replace(')', `,${a})`);
            const hex = this.color.replace('#', '');
            const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
            const r = parseInt(full.slice(0, 2), 16);
            const g = parseInt(full.slice(2, 4), 16);
            const b = parseInt(full.slice(4, 6), 16);
            return `rgba(${r},${g},${b},${a})`;
        })());
        fillG.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.globalAlpha = alpha * 0.6;
        CTX.fillStyle = fillG;
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.fill();

        // ── Primary thick ring ────────────────────────────────
        CTX.globalAlpha = alpha * 0.95;
        CTX.strokeStyle = this.color; CTX.lineWidth = 7 * (1 - prog * 0.7);
        CTX.shadowBlur = 22 * (1 - prog); CTX.shadowColor = this.color;
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.stroke();

        // ── Trailing inner ring ───────────────────────────────
        const r2 = this.maxRadius * Math.sqrt(prog * 0.78);
        CTX.globalAlpha = alpha * 0.50;
        CTX.lineWidth = 3.5 * (1 - prog);
        CTX.shadowBlur = 10;
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r2, 0, Math.PI * 2); CTX.stroke();

        // ── Spike burst at origin ─────────────────────────────
        if (prog < 0.35) {
            const sp = 1 - prog / 0.35;
            CTX.globalAlpha = alpha * sp * 0.70;
            CTX.lineWidth = 2;
            for (let si = 0; si < 8; si++) {
                const sa = (si / 8) * Math.PI * 2 + now * 0.002;
                const sLen = r * 0.22 * sp;
                CTX.beginPath();
                CTX.moveTo(screen.x + Math.cos(sa) * r * 0.10, screen.y + Math.sin(sa) * r * 0.10);
                CTX.lineTo(screen.x + Math.cos(sa) * sLen, screen.y + Math.sin(sa) * sLen);
                CTX.stroke();
            }
        }

        CTX.shadowBlur = 0;
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🟥 MATRIX GRID — Area-denial zone attack (Boss Phase 2+)
// ════════════════════════════════════════════════════════════
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
                CTX.beginPath(); CTX.arc(cx, cy, half * 1.1, 0, Math.PI * 2); CTX.fill();

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

// ════════════════════════════════════════════════════════════
// ⚡ EMP PULSE — Expanding ring; applies Grounded status on hit
// ════════════════════════════════════════════════════════════
class EmpPulse {
    /**
     * @param {number} x           World-space origin X
     * @param {number} y           World-space origin Y
     * @param {number} maxR        Max radius (world units)
     * @param {number} duration    Seconds to expand fully
     * @param {number} damage      Damage on hit
     * @param {number} groundedDur Seconds player Dash is locked
     */
    constructor(x, y, maxR, duration, damage, groundedDur) {
        this.x = x; this.y = y;
        this.maxR = maxR;
        this.duration = duration;
        this.damage = damage;
        this.groundedDur = groundedDur;
        this.timer = 0;
        this.dead = false;
        this._hit = false; // hit player only once per pulse
    }

    update(dt, player) {
        if (this.dead) return true;
        this.timer += dt;

        if (!this._hit) {
            const r = this.maxR * (this.timer / this.duration);
            const d = Math.hypot(player.x - this.x, player.y - this.y);
            // Ring hits player when the expanding radius crosses their position
            if (d <= r + player.radius && d >= r - 35) {
                this._hit = true;
                player.takeDamage(this.damage);
                if (typeof player.applyGrounded === 'function') {
                    player.applyGrounded(this.groundedDur);
                }
                spawnFloatingText('⚡ GROUNDED!', player.x, player.y - 60, '#38bdf8', 28);
                addScreenShake(10);
                spawnParticles(player.x, player.y, 18, '#38bdf8');
            }
        }

        if (this.timer >= this.duration) this.dead = true;
        return this.dead;
    }

    draw() {
        if (this.dead) return;
        if (typeof CTX === 'undefined' || typeof worldToScreen === 'undefined') return;

        const prog = this.timer / this.duration;
        const r = this.maxR * prog;
        const screen = worldToScreen(this.x, this.y);
        const alpha = (1 - prog) * 0.9;
        const now = performance.now();

        CTX.save();

        // ── Dome fill ─────────────────────────────────────────
        CTX.globalAlpha = alpha * 0.12;
        CTX.fillStyle = '#38bdf8';
        CTX.beginPath(); CTX.arc(screen.x, screen.y, r, 0, Math.PI * 2); CTX.fill();

        // ── Triple concentric rings ────────────────────────────
        const ringWidths = [9, 5, 2.5];
        const ringRadii = [1.0, 0.93, 0.86];
        const ringAlphas = [1.0, 0.60, 0.35];
        for (let ri = 0; ri < 3; ri++) {
            CTX.globalAlpha = alpha * ringAlphas[ri];
            CTX.strokeStyle = ri === 0 ? '#ffffff' : '#38bdf8';
            CTX.shadowBlur = ri === 0 ? 28 : 12; CTX.shadowColor = '#38bdf8';
            CTX.lineWidth = ringWidths[ri] * (1 - prog * 0.55);
            CTX.beginPath(); CTX.arc(screen.x, screen.y, r * ringRadii[ri], 0, Math.PI * 2); CTX.stroke();
        }
        CTX.shadowBlur = 0;

        // ── Lightning arcs along the ring ─────────────────────
        CTX.globalAlpha = alpha * 0.80;
        CTX.strokeStyle = '#bfdbfe'; CTX.lineWidth = 1.5;
        CTX.shadowBlur = 12; CTX.shadowColor = '#38bdf8';
        const arcCount = 12;
        for (let ai = 0; ai < arcCount; ai++) {
            const baseA = (ai / arcCount) * Math.PI * 2 + now * 0.006;
            const arcSpan = 0.18 + Math.sin(now / 80 + ai * 2.1) * 0.10;
            const jitter = Math.sin(now / 40 + ai * 3.7) * r * 0.06;
            CTX.beginPath();
            CTX.moveTo(
                screen.x + Math.cos(baseA) * (r - jitter),
                screen.y + Math.sin(baseA) * (r - jitter)
            );
            CTX.lineTo(
                screen.x + Math.cos(baseA + arcSpan) * (r + jitter * 1.5),
                screen.y + Math.sin(baseA + arcSpan) * (r + jitter * 1.5)
            );
            CTX.stroke();
        }

        // ── Radial spikes outward ─────────────────────────────
        CTX.globalAlpha = alpha * 0.55;
        CTX.strokeStyle = '#e0f2fe'; CTX.lineWidth = 1.2;
        for (let si = 0; si < 16; si++) {
            const sa = (si / 16) * Math.PI * 2 + now * 0.003;
            const spikeLen = r * (0.04 + Math.abs(Math.sin(now / 60 + si * 1.9)) * 0.08);
            CTX.beginPath();
            CTX.moveTo(screen.x + Math.cos(sa) * r, screen.y + Math.sin(sa) * r);
            CTX.lineTo(screen.x + Math.cos(sa) * (r + spikeLen), screen.y + Math.sin(sa) * (r + spikeLen));
            CTX.stroke();
        }

        // ── Static crackle at origin ───────────────────────────
        if (prog < 0.20) {
            const cp = 1 - prog / 0.20;
            CTX.globalAlpha = alpha * cp * 0.85;
            CTX.fillStyle = '#ffffff'; CTX.shadowBlur = 30; CTX.shadowColor = '#38bdf8';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, 18 * cp, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#38bdf8';
            CTX.beginPath(); CTX.arc(screen.x, screen.y, 32 * cp, 0, Math.PI * 2); CTX.fill();
        }

        CTX.shadowBlur = 0;
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════
// 💠 DOMAIN EXPANSION: METRICS-MANIPULATION
//    Boss Manop Ultimate — integrated from DomainExpansion.js
//    Singleton; driven by game.js update/draw hooks.
// ════════════════════════════════════════════════════════════

// Domain Expansion configuration — now centralized in BALANCE.boss.domainExpansion
const _DE = BALANCE.boss.domainExpansion || {};
const _DC = {
    ARENA_RADIUS: 1500,
    GRID_SIZE: 120,
    CELL_SIZE: 60,
    CAST_DUR: 2.2,
    WARN_DUR: 1.5,
    WARN_DUR_MIN: 0.50,           // BUG-FIX B1: was undefined → NaN cycleTimer → cycles never advanced
    WARN_DUR_DECAY: 0.18,
    EXPLODE_DUR: 0.45,
    END_DUR: 1.8,                 // BUG-FIX B2: was undefined → ending phase never exited, globalA=NaN
    TOTAL_CYCLES: 6,
    DANGER_PCT: _DE.dangerPct || 0.62,
    DANGER_PCT_MAX: _DE.dangerPctMax || 0.84,
    DANGER_PCT_STEP: _DE.dangerPctStep || 0.04,
    CELL_DAMAGE: _DE.cellDamage || 28,
    CELL_SLOW_DUR: _DE.cellSlowDur || 1.8,
    CELL_SLOW_FACTOR: _DE.cellSlowFactor || 0.45,
    COOLDOWN: _DE.cooldown || 45.0,
    HIT_RADIUS: _DE.hitRadius || 0.58,
    RAIN_COLS: _DE.rainCols || 32,
    BOSS_VOLLEY_CYCLE: _DE.bossVolleyCycle || 3,
    BOSS_VOLLEY_COUNT: 8,
    LOCK_PUSH: 80,                // pixels/s push force when entity tries to leave domain
    // BUG-FIX B3: COLS/ROWS were undefined → _initCells() loop ran 0 times → cells=[] → no grid
    get COLS() { return Math.ceil((this.ARENA_RADIUS * 2) / this.CELL_SIZE); },  // 50
    get ROWS() { return Math.ceil((this.ARENA_RADIUS * 2) / this.CELL_SIZE); },  // 50
};

const _RAIN_POOL = '0123456789ABCDEFΑΒΓΔΩΣΨXYZμσπ∑∫∂∇+-×÷=≠≤≥ΦΘΛ';
function _rainChar() { return _RAIN_POOL[Math.floor(Math.random() * _RAIN_POOL.length)]; }
function _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
}

const DomainExpansion = {
    phase: 'idle',   // 'idle' | 'casting' | 'active' | 'ending'
    timer: 0, cycleTimer: 0, cyclePhase: 'warn', cycleCount: 0,
    originX: 0, originY: 0,
    cells: [], cooldownTimer: 0,
    _rain: [], _indices: [],
    _flashTimer: 0,     // full-screen purple flash on explosion hit
    _crackLines: [],    // screen crack visual during casting

    canTrigger() { return this.phase === 'idle' && this.cooldownTimer <= 0; },
    isInvincible() { return this.phase !== 'idle'; },

    trigger(boss) {
        if (!this.canTrigger()) return;
        this.phase = 'casting';
        this.timer = _DC.CAST_DUR;
        // Domain covers entire map — anchor to world centre
        this.originX = 0;
        this.originY = 0;
        this._initRain();

        boss._domainCasting = true;
        boss._domainActive = true;

        if (typeof addScreenShake === 'function') addScreenShake(14);
        if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
        if (typeof spawnFloatingText === 'function') {
            spawnFloatingText('領域展開', boss.x, boss.y - 130, '#d946ef', 50);
            setTimeout(() => spawnFloatingText('METRICS-MANIPULATION', boss.x, boss.y - 185, '#facc15', 34), 700);
        }
        if (window.UIManager && typeof window.UIManager.showVoiceBubble === 'function') {
            window.UIManager.showVoiceBubble('領域展開...', boss.x, boss.y - 50);
            setTimeout(() => { if (window.UIManager) window.UIManager.showVoiceBubble('Metrics!', boss.x, boss.y - 50); }, 950);
        }
        if (typeof spawnParticles === 'function') {
            spawnParticles(boss.x, boss.y, 35, '#d946ef');
            spawnParticles(boss.x, boss.y, 20, '#facc15');
            spawnParticles(boss.x, boss.y, 15, '#ffffff');
        }
        console.log('[DomainExpansion] 💠 METRICS-MANIPULATION TRIGGERED');
    },

    update(dt, boss, player) {
        if (this.phase === 'idle') { if (this.cooldownTimer > 0) this.cooldownTimer -= dt; return; }
        // Tick flash timer
        if (this._flashTimer > 0) this._flashTimer -= dt;
        // Tick player slow debuff
        if (typeof window !== 'undefined' && window.player && window.player._domainSlowActive) {
            window.player._domainSlowTimer -= dt;
            if (window.player._domainSlowTimer <= 0) {
                window.player._domainSlowActive = false;
                window.player.moveSpeed = window.player._domainSlowBase || window.player.moveSpeed;
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('SPEED RESTORED', window.player.x, window.player.y - 60, '#22c55e', 16);
            }
        }
        // Boundary wall message for player (visual only — physics handled by applyPhysics)
        if (this.phase === 'active' && typeof window !== 'undefined' && window.player && !window.player.dead) {
            const p = window.player;
            const R = _DC.ARENA_RADIUS;
            if (Math.hypot(p.x, p.y) > R - p.radius - 10 && !p._domainWallMsg) {
                p._domainWallMsg = true;
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('⛔ ออกไม่ได้!', p.x, p.y - 50, '#d946ef', 18);
                setTimeout(() => { if (p) p._domainWallMsg = false; }, 1200);
            }
        }
        if (!boss || boss.dead) { this._abort(boss); return; }
        this.timer -= dt;

        switch (this.phase) {
            case 'casting':
                if (this.timer <= 0) {
                    this.phase = 'active'; this.cycleCount = 0;
                    this.cyclePhase = 'warn'; this.cycleTimer = _DC.WARN_DUR;
                    this._initCells(); this._rollCells();
                    if (typeof addScreenShake === 'function') addScreenShake(28);
                    if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
                    if (typeof spawnFloatingText === 'function' && player)
                        spawnFloatingText('⚠ DOMAIN ACTIVE', player.x, player.y - 100, '#ef4444', 28);
                }
                break;

            case 'active':
                this.cycleTimer -= dt;
                if (this.cyclePhase === 'warn' && this.cycleTimer <= 0) {
                    this.cyclePhase = 'explode'; this.cycleTimer = _DC.EXPLODE_DUR;
                    this._doExplosions(player);
                } else if (this.cyclePhase === 'explode' && this.cycleTimer <= 0) {
                    this.cycleCount++;
                    if (this.cycleCount >= _DC.TOTAL_CYCLES) {
                        this.phase = 'ending'; this.timer = _DC.END_DUR;
                        boss._domainCasting = false;
                        if (typeof addScreenShake === 'function') addScreenShake(20);
                        if (typeof spawnFloatingText === 'function' && player)
                            spawnFloatingText('Domain Lifted', player.x, player.y - 90, '#d946ef', 26);
                        if (window.UIManager)
                            window.UIManager.showVoiceBubble('...แค่นั้นแหละ.', boss.x, boss.y - 50);
                    } else {
                        this.cyclePhase = 'warn';
                        this.cycleTimer = Math.max(_DC.WARN_DUR_MIN, _DC.WARN_DUR - this.cycleCount * _DC.WARN_DUR_DECAY);
                        this._rollCells();
                        // Boss volley on cycle 3+
                        if (this.cycleCount >= _DC.BOSS_VOLLEY_CYCLE && boss && !boss.dead && typeof projectileManager !== 'undefined') {
                            const n = _DC.BOSS_VOLLEY_COUNT;
                            for (let _vi = 0; _vi < n; _vi++) {
                                const _va = (Math.PI * 2 / n) * _vi;
                                projectileManager.add(new Projectile(boss.x, boss.y, _va, 520, 20, '#d946ef', true, 'enemy'));
                            }
                            if (typeof addScreenShake === 'function') addScreenShake(12);
                        }
                    }
                }
                break;

            case 'ending':
                if (this.timer <= 0) {
                    this.phase = 'idle'; this.cooldownTimer = _DC.COOLDOWN;
                    boss._domainCasting = false; boss._domainActive = false;
                    if (boss.state === 'DOMAIN') { boss.state = 'CHASE'; boss.timer = 0; }
                    this.cells = []; this._crackLines = []; this._flashTimer = 0;
                    console.log('[DomainExpansion] Domain ended — cooldown 45 s');
                }
                break;
        }
    },

    draw(ctx) {
        if (this.phase === 'idle' || !ctx) return;
        if (typeof worldToScreen !== 'function') return;
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const now = performance.now() / 1000;

        let globalA = 1.0;
        if (this.phase === 'casting') globalA = 1.0 - this.timer / _DC.CAST_DUR;
        else if (this.phase === 'ending') globalA = this.timer / _DC.END_DUR;
        globalA = Math.max(0, Math.min(1, globalA));

        ctx.save();

        // ── 1. Dark overlay ──────────────────────────────────
        ctx.globalAlpha = globalA * 0.80;
        ctx.fillStyle = 'rgba(2,0,14,1)';
        ctx.fillRect(0, 0, W, H);

        // ── 2. Matrix rain — denser, dual-colour ────────────
        ctx.font = '11px "Courier New",monospace';
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        for (const col of this._rain) {
            const cx = col.xNorm * W, charH = 14;
            for (let i = 0; i < col.chars.length; i++) {
                const rawY = ((now * col.speed * H * 0.20 + col.offsetY + i * charH)) % (H + charH * col.chars.length) - charH * 4;
                const fade = 1.0 - i / col.chars.length;
                ctx.globalAlpha = globalA * col.alpha * fade;
                if (i === 0) { ctx.fillStyle = '#fff'; ctx.shadowBlur = 8; ctx.shadowColor = '#d946ef'; }
                else if (i < 3) { ctx.fillStyle = '#d946ef'; ctx.shadowBlur = 4; ctx.shadowColor = '#d946ef'; }
                else { ctx.fillStyle = '#d97706'; ctx.shadowBlur = 0; }
                ctx.fillText(col.chars[i], cx, rawY);
            }
        }
        ctx.shadowBlur = 0;

        // ── 3. Domain border — circular arena ring ────────────
        if (this.phase === 'active' || this.phase === 'ending') {
            const originSS = worldToScreen(this.originX, this.originY);
            const edgeSS = worldToScreen(this.originX + _DC.ARENA_RADIUS, this.originY);
            const radiusSS = Math.abs(edgeSS.x - originSS.x);
            const bCX = originSS.x, bCY = originSS.y;
            const pulse = 0.55 + Math.sin(now * 5) * 0.45;
            const dangerPct = Math.min(_DC.DANGER_PCT_MAX, _DC.DANGER_PCT + this.cycleCount * _DC.DANGER_PCT_STEP);
            const tintR = Math.floor(180 + (dangerPct - _DC.DANGER_PCT) / (_DC.DANGER_PCT_MAX - _DC.DANGER_PCT) * 75);
            const borderCol = `rgb(${tintR},0,255)`;

            // ── REWORK: Inner energy tendrils rotating around border ──
            const tendrilCount = 8;
            for (let ti = 0; ti < tendrilCount; ti++) {
                const baseAngle = (ti / tendrilCount) * Math.PI * 2 + now * 0.8;
                const wobble = Math.sin(now * 3 + ti * 1.3) * 0.18;
                const ta = baseAngle + wobble;
                const innerR = radiusSS * 0.85;
                const tx1 = bCX + Math.cos(ta) * innerR;
                const ty1 = bCY + Math.sin(ta) * innerR;
                const tx2 = bCX + Math.cos(ta + Math.PI * 0.18) * radiusSS;
                const ty2 = bCY + Math.sin(ta + Math.PI * 0.18) * radiusSS;
                ctx.globalAlpha = globalA * (0.25 + pulse * 0.20);
                ctx.strokeStyle = borderCol;
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 8; ctx.shadowColor = borderCol;
                ctx.beginPath(); ctx.moveTo(tx1, ty1); ctx.lineTo(tx2, ty2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Outer glow ring
            ctx.globalAlpha = globalA * (0.55 + pulse * 0.45);
            ctx.shadowBlur = 32 * pulse; ctx.shadowColor = borderCol;
            ctx.strokeStyle = borderCol; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(bCX, bCY, radiusSS, 0, Math.PI * 2); ctx.stroke();

            // Inner dashed ring
            ctx.globalAlpha = globalA * 0.35;
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(217,70,239,0.4)'; ctx.lineWidth = 1.5;
            ctx.setLineDash([12, 8]);
            ctx.beginPath(); ctx.arc(bCX, bCY, radiusSS - 8, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);

            // Rotating rune symbols around the circle
            const runeSymbols = ['Σ', 'Ψ', 'Ω', '∇', 'Φ', '∫', 'Δ', 'Λ', 'θ', 'π', 'μ', '∂'];
            ctx.font = 'bold 14px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            for (let ri = 0; ri < runeSymbols.length; ri++) {
                const rAngle = (ri / runeSymbols.length) * Math.PI * 2 + now * 0.5;
                const rAlpha = 0.55 + Math.sin(now * 2.5 + ri) * 0.35;
                const rx = bCX + Math.cos(rAngle) * (radiusSS + 18);
                const ry = bCY + Math.sin(rAngle) * (radiusSS + 18);
                ctx.globalAlpha = globalA * rAlpha;
                ctx.fillStyle = '#d946ef';
                ctx.shadowBlur = 8; ctx.shadowColor = '#d946ef';
                ctx.fillText(runeSymbols[ri], rx, ry);
            }
            ctx.shadowBlur = 0;

            // Cycle counter chip — top of screen
            if (this.phase === 'active') {
                const warnDurCurrent = Math.max(_DC.WARN_DUR_MIN, _DC.WARN_DUR - this.cycleCount * _DC.WARN_DUR_DECAY);
                const warnProg = this.cyclePhase === 'warn' ? (1.0 - this.cycleTimer / warnDurCurrent) : 1.0;
                const chipX = bCX, chipY = bCY - radiusSS - 28;
                ctx.globalAlpha = globalA * 0.92;
                ctx.font = 'bold 11px "Orbitron",Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = 'rgba(2,0,14,0.9)';
                ctx.fillRect(chipX - 58, chipY - 12, 116, 24);
                ctx.strokeStyle = borderCol; ctx.lineWidth = 1.5;
                ctx.strokeRect(chipX - 58, chipY - 12, 116, 24);
                ctx.fillStyle = borderCol;
                ctx.globalAlpha = globalA * 0.5;
                ctx.fillRect(chipX - 56, chipY - 10, 112 * warnProg, 20);
                ctx.globalAlpha = globalA * 0.92;
                ctx.fillStyle = '#f0abfc';
                ctx.shadowBlur = 6; ctx.shadowColor = '#d946ef';
                ctx.fillText(`CYCLE ${this.cycleCount + 1} / ${_DC.TOTAL_CYCLES}`, chipX, chipY);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = globalA * 0.70;
                ctx.font = 'bold 9px "Orbitron",Arial';
                ctx.fillStyle = tintR > 210 ? '#ef4444' : '#facc15';
                ctx.fillText(`DANGER ${Math.round(dangerPct * 100)}%`, chipX, chipY + 18);
            }
        }

        // ── 4. Grid cells ────────────────────────────────────
        if ((this.phase === 'active' || this.phase === 'ending') && this.cells.length) {
            const warnDurCurrent = Math.max(_DC.WARN_DUR_MIN, _DC.WARN_DUR - this.cycleCount * _DC.WARN_DUR_DECAY);
            const warnProgress = this.cyclePhase === 'warn' ? (1.0 - this.cycleTimer / warnDurCurrent) : 1.0;
            const explodeProgress = this.cyclePhase === 'explode' ? (1.0 - this.cycleTimer / _DC.EXPLODE_DUR) : 0;
            const fastPulse = 0.5 + Math.sin(now * (4 + warnProgress * 10)) * 0.5;
            const isLate = warnProgress > 0.60;

            // ── REWORK: Collapse effect during ending phase ──
            const isEnding = this.phase === 'ending';
            const collapsePct = isEnding ? (1.0 - globalA) : 0;  // 0→1 as domain fades

            for (const cell of this.cells) {
                // Collapse: shift cell toward origin during ending
                let drawWx = cell.wx, drawWy = cell.wy;
                if (isEnding && collapsePct > 0) {
                    const cellCX = cell.wx + _DC.CELL_SIZE / 2;
                    const cellCY = cell.wy + _DC.CELL_SIZE / 2;
                    drawWx = cellCX + (this.originX - cellCX) * collapsePct * 0.6 - _DC.CELL_SIZE / 2;
                    drawWy = cellCY + (this.originY - cellCY) * collapsePct * 0.6 - _DC.CELL_SIZE / 2;
                }

                const tl = worldToScreen(drawWx, drawWy);
                const br = worldToScreen(drawWx + _DC.CELL_SIZE, drawWy + _DC.CELL_SIZE);
                const sw = br.x - tl.x, sh = br.y - tl.y;
                if (br.x < 0 || tl.x > W || br.y < 0 || tl.y > H || sw < 2 || sh < 2) continue;
                const mx = tl.x + sw / 2, my = tl.y + sh / 2;

                if (cell.dangerous) {
                    if (this.cyclePhase === 'explode') {
                        // ── Explosion flash ───────────────────
                        const ef = 1.0 - explodeProgress;
                        ctx.globalAlpha = globalA * ef * 0.98;
                        const eg = ctx.createRadialGradient(mx, my, 0, mx, my, sw * 0.72);
                        eg.addColorStop(0, `rgba(255,255,220,${ef})`);
                        eg.addColorStop(0.4, `rgba(239,68,68,${ef * 0.9})`);
                        eg.addColorStop(1, `rgba(217,70,239,0)`);
                        ctx.fillStyle = eg;
                        ctx.fillRect(tl.x, tl.y, sw, sh);
                        // Bright border
                        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
                        ctx.shadowBlur = 18; ctx.shadowColor = '#ef4444';
                        ctx.globalAlpha = globalA * ef * 0.85;
                        ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                        // REWORK: shockwave ring expanding from cell
                        const swRing = explodeProgress * sw * 1.8;
                        ctx.globalAlpha = globalA * (1.0 - explodeProgress) * 0.7;
                        ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
                        ctx.shadowBlur = 12; ctx.shadowColor = '#facc15';
                        ctx.beginPath(); ctx.arc(mx, my, swRing * 0.5, 0, Math.PI * 2); ctx.stroke();
                        ctx.shadowBlur = 0;
                    } else {
                        // ── Warning ───────────────────────────
                        const baseCol = isLate ? '#ef4444' : '#d97706';
                        const glowCol = isLate ? '#ef4444' : '#facc15';
                        const wg = ctx.createRadialGradient(mx, my, 0, mx, my, sw * 0.72);
                        const fillA = 0.18 + warnProgress * 0.45 * fastPulse;
                        wg.addColorStop(0, isLate ? `rgba(239,68,68,${fillA * 1.4})` : `rgba(251,146,60,${fillA})`);
                        wg.addColorStop(1, `rgba(0,0,0,0)`);
                        ctx.globalAlpha = globalA;
                        ctx.fillStyle = wg;
                        ctx.fillRect(tl.x, tl.y, sw, sh);
                        // Animated border
                        ctx.strokeStyle = baseCol; ctx.lineWidth = isLate ? 2.5 : 1.8;
                        ctx.shadowBlur = isLate ? (8 + fastPulse * 10) : 4; ctx.shadowColor = glowCol;
                        ctx.globalAlpha = globalA * (0.4 + fastPulse * 0.6);
                        ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                        ctx.shadowBlur = 0;
                        // Corner tick marks
                        ctx.strokeStyle = glowCol; ctx.lineWidth = 1.5;
                        ctx.globalAlpha = globalA * 0.85;
                        const tl2 = 7;
                        [[tl.x, tl.y, 1, 1], [tl.x + sw, tl.y, -1, 1], [tl.x, tl.y + sh, 1, -1], [tl.x + sw, tl.y + sh, -1, -1]].forEach(([bx, by, sx2, sy2]) => {
                            ctx.beginPath(); ctx.moveTo(bx + sx2 * tl2, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + sy2 * tl2); ctx.stroke();
                        });
                        // REWORK: crack lines — grow as warnProgress increases
                        if (warnProgress > 0.35) {
                            const crackProg = (warnProgress - 0.35) / 0.65;
                            const crackLen = sw * 0.3 * crackProg;
                            ctx.globalAlpha = globalA * crackProg * 0.75;
                            ctx.strokeStyle = isLate ? '#fca5a5' : '#fde68a';
                            ctx.lineWidth = 1;
                            ctx.shadowBlur = 4; ctx.shadowColor = glowCol;
                            // 3 cracks from center using cell position as deterministic seed
                            const seed = Math.abs(Math.round(cell.wx * 0.1 + cell.wy * 0.07));
                            for (let ci = 0; ci < 3; ci++) {
                                const ca = ((seed * 37 + ci * 120) % 360) * Math.PI / 180;
                                ctx.beginPath();
                                ctx.moveTo(mx, my);
                                ctx.lineTo(mx + Math.cos(ca) * crackLen, my + Math.sin(ca) * crackLen);
                                ctx.stroke();
                            }
                            ctx.shadowBlur = 0;
                        }
                        // Countdown bar (bottom of cell)
                        const barW = Math.max(0, (sw - 4) * (1.0 - warnProgress));
                        ctx.globalAlpha = globalA * 0.9;
                        const barG = ctx.createLinearGradient(tl.x + 2, 0, tl.x + 2 + barW, 0);
                        barG.addColorStop(0, isLate ? '#ef4444' : '#facc15');
                        barG.addColorStop(1, isLate ? '#fbbf24' : '#d97706');
                        ctx.fillStyle = barG;
                        ctx.fillRect(tl.x + 2, tl.y + sh - 6, barW, 5);
                        // Math formula inside cell
                        const formulas = ['∑x²', 'dy/dx', 'log(x)', 'f\'(x)', 'det(A)', 'eigenλ', 'μ+σ', '∫f dx'];
                        const fi = Math.abs(Math.round(cell.wx + cell.wy) % formulas.length);
                        const formulaAlpha = isLate ? (0.30 + fastPulse * 0.35) : 0.18;
                        ctx.globalAlpha = globalA * formulaAlpha;
                        ctx.font = `bold ${Math.max(8, Math.floor(sw * 0.15))}px "Courier New",monospace`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillStyle = isLate ? '#fca5a5' : '#fde68a';
                        ctx.fillText(formulas[fi], mx, my + sh * 0.15);
                        // ⚠ icon
                        const iconSize = Math.max(10, Math.floor(sh * 0.38));
                        ctx.globalAlpha = globalA * (0.6 + fastPulse * 0.4);
                        ctx.font = `${iconSize}px Arial`;
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillStyle = '#fff';
                        ctx.shadowBlur = isLate ? 10 : 4; ctx.shadowColor = glowCol;
                        ctx.fillText('⚠', mx, my - sh * 0.12);
                        ctx.shadowBlur = 0;
                    }
                } else {
                    // ── Safe cell — REWORK: shimmer particles inside ──
                    ctx.globalAlpha = globalA * 0.12;
                    ctx.fillStyle = '#22c55e'; ctx.fillRect(tl.x, tl.y, sw, sh);
                    ctx.globalAlpha = globalA * 0.35;
                    ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5;
                    ctx.shadowBlur = 6; ctx.shadowColor = '#22c55e';
                    ctx.strokeRect(tl.x + 1, tl.y + 1, sw - 2, sh - 2);
                    ctx.shadowBlur = 0;
                    // Shimmer dot — position oscillates using cell seed
                    const sSeed = Math.abs(Math.round(cell.wx * 0.13 + cell.wy * 0.09));
                    const sPhase = (sSeed % 100) / 100;
                    const sX = mx + Math.sin(now * 2.2 + sPhase * 6.28) * sw * 0.22;
                    const sY = my + Math.cos(now * 1.8 + sPhase * 6.28) * sh * 0.22;
                    ctx.globalAlpha = globalA * (0.4 + Math.sin(now * 3 + sPhase * 6.28) * 0.3);
                    ctx.fillStyle = '#86efac';
                    ctx.shadowBlur = 8; ctx.shadowColor = '#4ade80';
                    ctx.beginPath(); ctx.arc(sX, sY, 2.5, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                    // ✓ icon
                    const iconSize2 = Math.max(8, Math.floor(sh * 0.30));
                    ctx.globalAlpha = globalA * 0.55;
                    ctx.font = `bold ${iconSize2}px Arial`;
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#4ade80';
                    ctx.fillText('✓', mx, my);
                }
            }
        }

        // ── 5. Casting animation ─────────────────────────────
        if (this.phase === 'casting') {
            const elapsed = _DC.CAST_DUR - this.timer;
            const ringScreen = worldToScreen(this.originX, this.originY);

            // Expanding shockwave rings — grow to cover full arena
            const arenaEdgeSS = worldToScreen(_DC.ARENA_RADIUS, 0);
            const arenaOriginSS = worldToScreen(0, 0);
            const arenaSSRadius = Math.abs(arenaEdgeSS.x - arenaOriginSS.x);
            for (let ri = 0; ri < 3; ri++) {
                const delay = ri * 0.5;
                if (elapsed < delay) continue;
                const rProg = Math.min(1.0, (elapsed - delay) / (_DC.CAST_DUR - delay));
                const ringR = rProg * arenaSSRadius * 1.05;
                ctx.globalAlpha = globalA * (1.0 - rProg) * (0.5 - ri * 0.12);
                ctx.strokeStyle = ri === 0 ? '#d946ef' : ri === 1 ? '#facc15' : '#ffffff';
                ctx.lineWidth = 3 - ri * 0.8;
                ctx.shadowBlur = 24 - ri * 6; ctx.shadowColor = '#d946ef';
                ctx.beginPath(); ctx.arc(ringScreen.x, ringScreen.y, ringR, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // REWORK: Pillar of light rising from boss during cast
            if (elapsed > 0.3) {
                const pillarProg = Math.min(1.0, (elapsed - 0.3) / 1.0);
                const pillarH = H * pillarProg;
                const pillarW = 60 + pillarProg * 40;
                const pg = ctx.createLinearGradient(ringScreen.x, ringScreen.y, ringScreen.x, ringScreen.y - pillarH);
                pg.addColorStop(0, `rgba(217,70,239,${0.7 * pillarProg})`);
                pg.addColorStop(0.5, `rgba(250,204,21,${0.35 * pillarProg})`);
                pg.addColorStop(1, `rgba(217,70,239,0)`);
                ctx.globalAlpha = globalA * pillarProg;
                ctx.fillStyle = pg;
                ctx.shadowBlur = 40; ctx.shadowColor = '#d946ef';
                ctx.fillRect(ringScreen.x - pillarW / 2, ringScreen.y - pillarH, pillarW, pillarH);
                ctx.shadowBlur = 0;
                // Pillar edge lines
                ctx.globalAlpha = globalA * pillarProg * 0.6;
                ctx.strokeStyle = '#f0abfc'; ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(ringScreen.x - pillarW / 2, ringScreen.y);
                ctx.lineTo(ringScreen.x - pillarW * 0.1, ringScreen.y - pillarH);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(ringScreen.x + pillarW / 2, ringScreen.y);
                ctx.lineTo(ringScreen.x + pillarW * 0.1, ringScreen.y - pillarH);
                ctx.stroke();
            }

            // Chromatic aberration lines — horizontal scan lines
            if (elapsed > 0.8) {
                const caProg = Math.min(1.0, (elapsed - 0.8) / 1.2);
                const lineCount = Math.floor(caProg * 12);
                for (let li = 0; li < lineCount; li++) {
                    const ly = (li / lineCount) * H + Math.sin(now * 8 + li) * 15;
                    ctx.globalAlpha = globalA * 0.08 * caProg;
                    ctx.fillStyle = li % 3 === 0 ? '#d946ef' : li % 3 === 1 ? '#facc15' : '#38bdf8';
                    ctx.fillRect(0, ly, W, 2);
                }
            }

            // Screen crack lines (static from _crackLines — generated once)
            if (elapsed > 0.5 && this._crackLines.length === 0) {
                for (let ci = 0; ci < 8; ci++) {
                    const cx2 = W * (0.3 + Math.random() * 0.4);
                    const cy2 = H * (0.3 + Math.random() * 0.4);
                    const len = 40 + Math.random() * 100;
                    const angle = Math.random() * Math.PI * 2;
                    this._crackLines.push({ x: cx2, y: cy2, dx: Math.cos(angle) * len, dy: Math.sin(angle) * len });
                }
            }
            if (elapsed > 0.5 && this._crackLines.length > 0) {
                const crackA = Math.min(1.0, (elapsed - 0.5) / 0.8) * 0.55;
                ctx.strokeStyle = '#d946ef'; ctx.lineWidth = 1.5;
                ctx.shadowBlur = 10; ctx.shadowColor = '#d946ef';
                for (const cl of this._crackLines) {
                    ctx.globalAlpha = globalA * crackA;
                    ctx.beginPath(); ctx.moveTo(cl.x, cl.y); ctx.lineTo(cl.x + cl.dx, cl.y + cl.dy); ctx.stroke();
                    ctx.globalAlpha = globalA * crackA * 0.5;
                    ctx.beginPath(); ctx.moveTo(cl.x + cl.dx * 0.5, cl.y + cl.dy * 0.5);
                    ctx.lineTo(cl.x + cl.dx * 0.5 + cl.dy * 0.4, cl.y + cl.dy * 0.5 - cl.dx * 0.4); ctx.stroke();
                }
                ctx.shadowBlur = 0;
            }

            // 領域展開 kanji — scale + chromatic split
            if (elapsed > 0.35) {
                const ta = Math.min(1.0, (elapsed - 0.35) / 0.45);
                const sc = 0.78 + ta * 0.22;
                const fontSize = Math.round(52 * sc);
                ctx.globalAlpha = globalA * ta * 0.45;
                ctx.font = `bold ${fontSize}px serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#38bdf8';
                ctx.fillText('領域展開', W / 2 - 3, H / 2 - 42 + 2);
                ctx.fillStyle = '#ef4444';
                ctx.fillText('領域展開', W / 2 + 3, H / 2 - 42 - 2);
                ctx.globalAlpha = globalA * ta;
                ctx.fillStyle = '#f0abfc';
                ctx.shadowBlur = 40; ctx.shadowColor = '#d946ef';
                ctx.fillText('領域展開', W / 2, H / 2 - 42);
                ctx.shadowBlur = 0;
            }
            // METRICS-MANIPULATION subtitle
            if (elapsed > 1.05) {
                const tb = Math.min(1.0, (elapsed - 1.05) / 0.55);
                ctx.globalAlpha = globalA * tb;
                ctx.font = `900 ${Math.round(36 * (0.88 + tb * 0.12))}px "Orbitron","Bebas Neue",Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.shadowBlur = 28; ctx.shadowColor = '#facc15';
                ctx.fillStyle = '#fef08a';
                ctx.fillText('METRICS-MANIPULATION', W / 2, H / 2 + 28);
                ctx.shadowBlur = 0;
                ctx.globalAlpha = globalA * tb * 0.8;
                ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2;
                const ulW = tb * 280;
                ctx.beginPath(); ctx.moveTo(W / 2 - ulW / 2, H / 2 + 50); ctx.lineTo(W / 2 + ulW / 2, H / 2 + 50); ctx.stroke();
            }
            // Final white flash
            if (elapsed > _DC.CAST_DUR - 0.35) {
                const tf = (elapsed - (_DC.CAST_DUR - 0.35)) / 0.35;
                ctx.globalAlpha = globalA * tf * 0.70;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, W, H);
                ctx.globalAlpha = globalA * tf * 0.45;
                ctx.fillStyle = '#d946ef';
                ctx.fillRect(0, 0, W, H);
            }
        }

        // ── 6. Full-screen hit flash (purple) ────────────────
        if (this._flashTimer > 0) {
            ctx.globalAlpha = Math.min(this._flashTimer / 0.12, 1.0) * 0.55;
            ctx.fillStyle = '#d946ef';
            ctx.fillRect(0, 0, W, H);
        }

        // ── 7. Slow debuff HUD indicator ─────────────────────
        if (typeof window !== 'undefined' && window.player && window.player._domainSlowActive) {
            const slowPulse = 0.5 + Math.sin(now * 6) * 0.5;
            ctx.globalAlpha = globalA * 0.28 * slowPulse;
            ctx.fillStyle = '#d946ef';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = globalA * (0.6 + slowPulse * 0.35);
            ctx.font = 'bold 14px "Orbitron",Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#f0abfc';
            ctx.shadowBlur = 12; ctx.shadowColor = '#d946ef';
            ctx.fillText('🔮 SLOWED', W / 2, 12);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    },


    // ── Private ────────────────────────────────────────────────
    _initCells() {
        this.cells = []; this._indices = [];
        const half = (_DC.COLS * _DC.CELL_SIZE) / 2;
        const R = _DC.ARENA_RADIUS;
        const halfCell = _DC.CELL_SIZE / 2;
        for (let r = 0; r < _DC.ROWS; r++)
            for (let col = 0; col < _DC.COLS; col++) {
                const wx = this.originX - half + col * _DC.CELL_SIZE;
                const wy = this.originY - half + r * _DC.CELL_SIZE;
                // Cull cells outside arena circle
                const ccx = wx + halfCell, ccy = wy + halfCell;
                if (Math.hypot(ccx - this.originX, ccy - this.originY) > R) continue;
                this.cells.push({ wx, wy, dangerous: false, exploded: false });
            }
        this._indices = new Array(this.cells.length);
    },
    _rollCells() {
        const dangerPct = Math.min(_DC.DANGER_PCT_MAX, _DC.DANGER_PCT + this.cycleCount * _DC.DANGER_PCT_STEP);
        const n = this.cells.length, dangCount = Math.floor(n * dangerPct);
        for (let i = 0; i < n; i++) this._indices[i] = i;
        _shuffle(this._indices);
        for (let i = 0; i < n; i++) {
            this.cells[this._indices[i]].dangerous = i < dangCount;
            this.cells[this._indices[i]].exploded = false;
        }
    },
    _initRain() {
        this._rain = [];
        for (let i = 0; i < _DC.RAIN_COLS; i++) {
            const len = 8 + Math.floor(Math.random() * 10);
            this._rain.push({
                xNorm: Math.random(),
                offsetY: Math.random() * 600,
                speed: 0.6 + Math.random() * 0.9,
                alpha: 0.25 + Math.random() * 0.35,
                chars: Array.from({ length: len }, _rainChar),
            });
        }
    },
    _doExplosions(player) {
        for (const cell of this.cells) {
            if (!cell.dangerous) continue;
            cell.exploded = true;
            const cx = cell.wx + _DC.CELL_SIZE / 2, cy = cell.wy + _DC.CELL_SIZE / 2;
            if (typeof spawnParticles === 'function') {
                spawnParticles(cx, cy, 10, '#ef4444');
                spawnParticles(cx, cy, 5, '#facc15');
            }
            if (player && !player.dead) {
                const pd = Math.hypot(player.x - cx, player.y - cy);
                if (pd < _DC.CELL_SIZE * _DC.HIT_RADIUS) {
                    player.takeDamage(_DC.CELL_DAMAGE);
                    // Apply slow debuff
                    if (!player._domainSlowActive) {
                        player._domainSlowActive = true;
                        player._domainSlowTimer = _DC.CELL_SLOW_DUR;
                        player._domainSlowBase = player.moveSpeed;
                        player.moveSpeed *= _DC.CELL_SLOW_FACTOR;
                    } else {
                        player._domainSlowTimer = _DC.CELL_SLOW_DUR; // refresh
                    }
                    if (typeof spawnFloatingText === 'function') {
                        spawnFloatingText(`💥 ${_DC.CELL_DAMAGE}`, player.x, player.y - 55, '#ef4444', 20);
                        spawnFloatingText('🔮 SLOWED!', player.x, player.y - 80, '#d946ef', 18);
                    }
                    if (typeof addScreenShake === 'function') addScreenShake(10);
                    if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
                    // Screen flash
                    DomainExpansion._flashTimer = 0.12;
                }
            }
        }
    },
    _abort(boss) {
        this.phase = 'idle'; this.cooldownTimer = 0;
        this.cells = []; this._crackLines = []; this._flashTimer = 0;
        if (boss) { boss._domainCasting = false; boss._domainActive = false; }
        console.log('[DomainExpansion] Aborted — boss dead');
    },
};

window.DomainExpansion = DomainExpansion;
DomainExpansion._DC_RADIUS = _DC.ARENA_RADIUS; // exposed for base.js applyPhysics

// ════════════════════════════════════════════════════════════
// 💥 EQUATION SLAM — Boss shockwave ring with formula shards
// ════════════════════════════════════════════════════════════
class EquationSlam {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 50;
        this.maxRadius = BALANCE.boss.slamRadius;
        this.speed = 400;
        this.damage = BALANCE.boss.slamDamage;
        this.hit = false;
        // Shard formula symbols flung outward
        this._shards = Array.from({ length: 14 }, (_, i) => ({
            angle: (i / 14) * Math.PI * 2,
            speed: 180 + Math.random() * 120,
            dist: 30,
            formula: ['∑', 'Δ', 'π', '∞', '∂', 'Ω', '√', 'λ', 'θ', '∫', 'φ', 'σ', 'μ', 'γ'][i],
            spin: (Math.random() - 0.5) * 8,
            rot: Math.random() * Math.PI * 2,
        }));
    }

    update(dt, player) {
        this.radius += this.speed * dt;

        // Update shard positions
        for (const sh of this._shards) {
            sh.dist += sh.speed * dt;
            sh.rot += sh.spin * dt;
        }

        // Ring-front hit detection
        if (!this.hit) {
            const d = Math.hypot(player.x - this.x, player.y - this.y);
            if (d <= this.radius && d >= this.radius - 30) {
                player.takeDamage(this.damage);
                this.hit = true;
            }
        }

        return this.radius >= this.maxRadius;
    }

    draw() {
        if (typeof CTX === 'undefined') return;
        const screen = worldToScreen(this.x, this.y);
        const prog = this.radius / this.maxRadius;
        const alpha = 1 - prog;
        const now = performance.now();

        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ── Crater fill glow ──────────────────────────────────
        CTX.globalAlpha = alpha * 0.22;
        const craterG = CTX.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        craterG.addColorStop(0, 'rgba(255,255,255,0.8)');
        craterG.addColorStop(0.35, 'rgba(251,191,36,0.5)');
        craterG.addColorStop(1, 'rgba(120,53,15,0)');
        CTX.fillStyle = craterG;
        CTX.beginPath(); CTX.arc(0, 0, this.radius, 0, Math.PI * 2); CTX.fill();

        // ── Primary blast ring ────────────────────────────────
        CTX.globalAlpha = alpha * 0.95;
        CTX.shadowBlur = 30 * (1 - prog); CTX.shadowColor = '#fbbf24';
        CTX.strokeStyle = '#ffffff'; CTX.lineWidth = 8 * (1 - prog * 0.7);
        CTX.beginPath(); CTX.arc(0, 0, this.radius, 0, Math.PI * 2); CTX.stroke();

        // ── Secondary gold ring ───────────────────────────────
        CTX.globalAlpha = alpha * 0.65;
        CTX.strokeStyle = '#f59e0b'; CTX.lineWidth = 4 * (1 - prog * 0.6);
        CTX.shadowBlur = 14; CTX.shadowColor = '#fbbf24';
        CTX.beginPath(); CTX.arc(0, 0, this.radius * 0.88, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Radial chalk spikes ────────────────────────────────
        CTX.globalAlpha = alpha * 0.70;
        CTX.strokeStyle = '#fef3c7'; CTX.lineWidth = 2.5;
        for (let si = 0; si < 18; si++) {
            const sa = (si / 18) * Math.PI * 2 + now * 0.0015;
            const sLen = this.radius * (0.07 + Math.abs(Math.sin(now / 60 + si * 1.7)) * 0.12);
            CTX.beginPath();
            CTX.moveTo(Math.cos(sa) * this.radius, Math.sin(sa) * this.radius);
            CTX.lineTo(Math.cos(sa) * (this.radius + sLen), Math.sin(sa) * (this.radius + sLen));
            CTX.stroke();
        }

        // ── Origin burst (early) ──────────────────────────────
        if (prog < 0.18) {
            const bp = 1 - prog / 0.18;
            CTX.globalAlpha = bp * 0.90;
            CTX.fillStyle = '#ffffff'; CTX.shadowBlur = 50; CTX.shadowColor = '#fbbf24';
            CTX.beginPath(); CTX.arc(0, 0, 28 * bp, 0, Math.PI * 2); CTX.fill();
            CTX.fillStyle = '#fbbf24';
            CTX.beginPath(); CTX.arc(0, 0, 52 * bp, 0, Math.PI * 2); CTX.fill();
            CTX.shadowBlur = 0;
        }

        // ── Flying math formula shards ────────────────────────
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        for (const sh of this._shards) {
            const sx = Math.cos(sh.angle) * sh.dist;
            const sy = Math.sin(sh.angle) * sh.dist;
            const shAlpha = Math.max(0, alpha * (1 - sh.dist / (this.maxRadius * 1.1)));
            if (shAlpha <= 0.02) continue;
            CTX.save();
            CTX.globalAlpha = shAlpha * 0.90;
            CTX.translate(sx, sy);
            CTX.rotate(sh.rot);
            CTX.font = `bold ${12 + (1 - prog) * 8}px "Courier New",monospace`;
            CTX.fillStyle = '#fef9c3'; CTX.shadowBlur = 8; CTX.shadowColor = '#fbbf24';
            CTX.fillText(sh.formula, 0, 0);
            CTX.shadowBlur = 0;
            CTX.restore();
        }

        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 📈 DEADLY GRAPH — Expanding laser beam with risk/reward zone
// ════════════════════════════════════════════════════════════
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

    update(dt, player) {
        this.timer += dt;
        this._waveOffset += dt;

        if (this.phase === 'expanding') {
            this.length += this.speed * dt;

            const pd = this._pointToLineDistance(
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
                this.length = this.maxLength;
                this.phase = 'blocking';
                this.timer = 0;
            }

        } else if (this.phase === 'blocking') {
            if (this.timer >= this.blockingDuration) {
                this.phase = 'active';
                this.timer = 0;

                // ── Destruction FX when laser activates ──────────────
                if (window.mapSystem && typeof window.mapSystem.damageArea === 'function') {
                    const ex = this.startX + Math.cos(this.angle) * this.maxLength;
                    const ey = this.startY + Math.sin(this.angle) * this.maxLength;
                    window.mapSystem.damageArea(this.startX, this.startY, ex, ey);
                }
            }

        } else if (this.phase === 'active') {
            const endX = this.startX + Math.cos(this.angle) * this.length;
            const endY = this.startY + Math.sin(this.angle) * this.length;
            const pd = this._pointToLineDistance(
                player.x, player.y,
                this.startX, this.startY, endX, endY
            );

            const onBeam = pd < 25;
            player.onGraph = onBeam;

            // ── Universal Risk/Reward buff timer ──────────────────
            if (onBeam) {
                player.graphBuffTimer = 0.15;
            }

            if (this.timer >= this.activeDuration) {
                player.onGraph = false;
                player.graphBuffTimer = 0;
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

// ════════════════════════════════════════════════════════════
// 🧮 PHYSICS FORMULA ZONE — KruFirst sustained area-denial
//    วางสูตรฟิสิกส์ค้างไว้บนพื้น ผู้เล่นเหยียบ = ติด slow + damage
//    ทำให้ต้องเคลื่อนที่ตลอด ไม่สามารถยืนยิงนิ่งได้
// ════════════════════════════════════════════════════════════
class PhysicsFormulaZone {
    /**
     * @param {number} cx   world centre X
     * @param {number} cy   world centre Y
     * @param {number} radius   world-space radius (default 110)
     * @param {number} duration seconds before zone fades (default 5)
     * @param {number} damage   damage/s while standing in zone (default 14)
     */
    constructor(cx, cy, radius = 110, duration = 5.0, damage = 14) {
        this.x = cx;
        this.y = cy;
        this.radius = radius;
        this.duration = duration;
        this.damage = damage;
        this.timer = 0;
        this.dead = false;

        // Deterministic formula label — no Math.random() in draw()
        const FORMULAS = [
            'F = ma', 'v = u + at', 'KE = ½mv²',
            'p = mv', 'W = Fd', 'a = v²/r',
            'F = kx', 'E = mc²', 'τ = Iα',
        ];
        this._formula = FORMULAS[Math.floor(Math.abs(Math.sin(cx * 0.07 + cy * 0.13)) * FORMULAS.length)];

        // Slow debuff applied to player each tick while inside
        this._slowDPS = 0.55;   // speed multiplier while inside
        this._slowDuration = 0.35;  // seconds of slow per tick (refreshed)

        // Tick interval for damage (avoid per-frame DPS spike)
        this._tickCd = 0;
    }

    update(dt, player) {
        if (this.dead) return true;
        this.timer += dt;
        if (this._tickCd > 0) this._tickCd -= dt;

        if (this.timer >= this.duration) {
            this.dead = true;
            return true;
        }

        // Check player in zone
        const d = Math.hypot(player.x - this.x, player.y - this.y);
        if (d < this.radius + player.radius) {
            // Damage every 0.20 s (not every frame)
            if (this._tickCd <= 0) {
                this._tickCd = 0.20;
                player.takeDamage(this.damage * 0.20);
            }
            // Apply slow debuff — refresh each frame player is inside
            if (!player._formulaSlowActive) {
                player._formulaSlowActive = true;
                player._formulaSlowBase = player.moveSpeed;
            }
            player.moveSpeed = (player._formulaSlowBase || player.moveSpeed) * this._slowDPS;
            player._formulaSlowTimer = this._slowDuration;
        } else if (player._formulaSlowActive) {
            // Count down after leaving zone
            if (player._formulaSlowTimer > 0) {
                player._formulaSlowTimer -= dt;
            } else {
                player._formulaSlowActive = false;
                player.moveSpeed = player._formulaSlowBase || player.moveSpeed;
            }
        }

        return false;
    }

    draw() {
        if (this.dead) return;
        if (typeof CTX === 'undefined' || typeof worldToScreen === 'undefined') return;

        const screen = worldToScreen(this.x, this.y);
        const edgePt = worldToScreen(this.x + this.radius, this.y);
        const rSS = Math.abs(edgePt.x - screen.x);
        if (rSS < 2) return;

        const prog = this.timer / this.duration;
        const alpha = Math.sin(prog * Math.PI) * 0.90 + 0.10; // fade in + out
        const now = performance.now();
        const pulse = 0.5 + Math.sin(now / 200) * 0.5;

        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ── Outer danger glow ─────────────────────────────────
        const outerG = CTX.createRadialGradient(0, 0, rSS * 0.5, 0, 0, rSS * 1.2);
        outerG.addColorStop(0, `rgba(168,85,247,${alpha * 0.12})`);
        outerG.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.fillStyle = outerG;
        CTX.beginPath(); CTX.arc(0, 0, rSS * 1.2, 0, Math.PI * 2); CTX.fill();

        // ── Zone fill ─────────────────────────────────────────
        const zoneG = CTX.createRadialGradient(0, 0, 0, 0, 0, rSS);
        zoneG.addColorStop(0, `rgba(139,92,246,${alpha * 0.28})`);
        zoneG.addColorStop(0.65, `rgba(109,40,217,${alpha * 0.18})`);
        zoneG.addColorStop(1, `rgba(76,29,149,${alpha * 0.08})`);
        CTX.fillStyle = zoneG;
        CTX.beginPath(); CTX.arc(0, 0, rSS, 0, Math.PI * 2); CTX.fill();

        // ── Animated border ring ──────────────────────────────
        CTX.strokeStyle = `rgba(167,139,250,${alpha * (0.5 + pulse * 0.45)})`;
        CTX.lineWidth = 2.5;
        CTX.shadowBlur = 18 * pulse; CTX.shadowColor = '#a855f7';
        CTX.setLineDash([10, 6]);
        CTX.lineDashOffset = -(now * 0.06) % 16;
        CTX.beginPath(); CTX.arc(0, 0, rSS, 0, Math.PI * 2); CTX.stroke();
        CTX.setLineDash([]); CTX.lineDashOffset = 0;
        CTX.shadowBlur = 0;

        // ── Rotating inner hex ────────────────────────────────
        CTX.save();
        CTX.rotate(now * 0.0008);
        CTX.strokeStyle = `rgba(196,181,253,${alpha * 0.35})`;
        CTX.lineWidth = 1.2;
        CTX.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i;
            const hx = Math.cos(a) * rSS * 0.58, hy = Math.sin(a) * rSS * 0.58;
            i === 0 ? CTX.moveTo(hx, hy) : CTX.lineTo(hx, hy);
        }
        CTX.closePath(); CTX.stroke();
        CTX.restore();

        // ── Formula label (centre) ────────────────────────────
        CTX.globalAlpha = alpha * (0.70 + pulse * 0.28);
        CTX.font = `bold ${Math.round(rSS * 0.22)}px "Orbitron",monospace`;
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillStyle = '#e879f9';
        CTX.shadowBlur = 12 * pulse; CTX.shadowColor = '#a855f7';
        CTX.fillText(this._formula, 0, 0);
        CTX.shadowBlur = 0;

        // ── SLOW warning text (bottom) ────────────────────────
        CTX.globalAlpha = alpha * (0.45 + pulse * 0.30);
        CTX.font = `bold ${Math.round(rSS * 0.13)}px monospace`;
        CTX.fillStyle = '#f0abfc';
        CTX.fillText('⚠ SLOW FIELD', 0, rSS * 0.52);

        // ── Remaining time arc (outer) ────────────────────────
        const remaining = 1 - prog;
        CTX.globalAlpha = alpha * 0.55;
        CTX.strokeStyle = `rgba(216,180,254,${alpha * 0.6})`;
        CTX.lineWidth = 3;
        CTX.beginPath();
        CTX.arc(0, 0, rSS + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
        CTX.stroke();

        CTX.globalAlpha = 1;
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🔴 PARABOLIC VOLLEY — KruFirst adaptive fire pattern
//    ยิง projectiles 3 ชุดพร้อมกัน: ตรง + ซ้าย + ขวา
//    offset ถูกคำนวณให้ตัดเส้นทางหนีของผู้เล่น
//    ใช้ใน Derivation Mode (HP < 40%) เพื่อเพิ่ม sustained pressure
// ════════════════════════════════════════════════════════════
class ParabolicVolley {
    /**
     * Fires a 3-prong volley — left/centre/right split targeting player.
     * Call once; it spawns projectiles immediately into projectileManager.
     *
     * @param {number} bossX @param {number} bossY   boss world position
     * @param {number} playerX @param {number} playerY  player world position
     * @param {boolean} isAdvanced  advanced variant fires 5 prongs
     */
    static fire(bossX, bossY, playerX, playerY, isAdvanced = false) {
        if (typeof projectileManager === 'undefined') return;

        const baseAngle = Math.atan2(playerY - bossY, playerX - bossX);
        const speed = 420;
        const damage = 26;
        const prongCount = isAdvanced ? 5 : 3;

        // Spread offset: evenly spaced around baseAngle
        const spreadStep = isAdvanced ? 0.28 : 0.38;
        const halfSpread = ((prongCount - 1) / 2) * spreadStep;

        for (let i = 0; i < prongCount; i++) {
            const angle = baseAngle - halfSpread + i * spreadStep;
            projectileManager.add(new Projectile(
                bossX, bossY,
                angle, speed, damage,
                '#c084fc', false, 'enemy'
            ));
        }

        // Visual burst at origin
        if (typeof spawnParticles === 'function') {
            spawnParticles(bossX, bossY, 8, '#c084fc');
        }
        if (typeof addScreenShake === 'function') addScreenShake(4);
    }
}

// ─── Node/bundler export ──────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BarkWave, GoldfishMinion, BubbleProjectile, FreeFallWarningRing, PorkSandwich, ExpandingRing, MatrixGridAttack, EmpPulse, EquationSlam, DeadlyGraph, PhysicsFormulaZone, ParabolicVolley };
}
// ── Global exports ────────────────────────────────────────────
window.BarkWave = BarkWave;
window.GoldfishMinion = GoldfishMinion;
window.BubbleProjectile = BubbleProjectile;
window.FreeFallWarningRing = FreeFallWarningRing;
window.PorkSandwich = PorkSandwich;
window.ExpandingRing = ExpandingRing;
window.MatrixGridAttack = MatrixGridAttack;
window.EmpPulse = EmpPulse;
window.EquationSlam = EquationSlam;
window.DeadlyGraph = DeadlyGraph;
window.PhysicsFormulaZone = PhysicsFormulaZone;
window.ParabolicVolley = ParabolicVolley;