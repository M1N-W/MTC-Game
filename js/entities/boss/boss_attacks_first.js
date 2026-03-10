'use strict';
/**
 * js/entities/boss/boss_attacks_first.js
 *
 * Attack effects used exclusively by KruFirst (FirstBoss).
 *
 * Load order: boss_attacks_shared.js → THIS FILE → BossBase.js → FirstBoss.js
 *
 * Contents:
 *   FreeFallWarningRing    — Visual AoE warning indicator
 *   PorkSandwich           — Seeking explosive projectile
 *   EmpPulse               — Radial energy burst
 *   PhysicsFormulaZone     — Sustained area-denial + slow
 *   ParabolicVolley        — 3-prong adaptive fire pattern
 *   OrbitalDebris          — Orbiting shards (used inside GravSingularity)
 *   GravitationalSingularity — Boss ultimate — singleton
 *   GravityWell            — Pull/push field (Derivation Mode)
 *   SuperpositionClone     — Quantum decoy clone
 */
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
        if (!isFinite(rSS) || rSS < 2) return;

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

// ════════════════════════════════════════════════════════════
// ⚫ ORBITAL DEBRIS — 6 Projectiles orbiting KruFirst during Domain
//    สร้างจาก GravitationalSingularity ใน Pulse 3
//    update() รับ (dt, bossX, bossY, player) — โคจรรอบ boss
// ════════════════════════════════════════════════════════════
class OrbitalDebris {
    /**
     * @param {number} bossX @param {number} bossY  anchor (world)
     * @param {number} startAngle  initial angle offset for this shard
     */
    constructor(bossX, bossY, startAngle) {
        const _GS = (typeof BALANCE !== 'undefined' && BALANCE.boss && BALANCE.boss.gravitationalSingularity)
            ? BALANCE.boss.gravitationalSingularity : {};
        this.orbitR = _GS.orbitalRadius ?? 90;
        this.orbitSpd = _GS.orbitalSpeed ?? 2.2;
        this.damage = _GS.orbitalDamage ?? 25;
        this.angle = startAngle;
        this.x = bossX + Math.cos(startAngle) * this.orbitR;
        this.y = bossY + Math.sin(startAngle) * this.orbitR;
        this.radius = 10;
        this.dead = false;
        this._hitCd = 0;     // per-debris hit cooldown to avoid frame spam
        // Pre-seed visual noise so draw() uses no Math.random()
        this._glowPhase = startAngle * 2.7;
    }

    update(dt, bossX, bossY, player) {
        if (this.dead) return;
        this.angle += this.orbitSpd * dt;
        this.x = bossX + Math.cos(this.angle) * this.orbitR;
        this.y = bossY + Math.sin(this.angle) * this.orbitR;

        if (this._hitCd > 0) this._hitCd -= dt;
        if (this._hitCd <= 0 && player && !player.dead) {
            const d = Math.hypot(player.x - this.x, player.y - this.y);
            if (d < this.radius + player.radius) {
                player.takeDamage(this.damage);
                this._hitCd = 0.5;
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('DEBRIS!', player.x, player.y - 50, '#00ffff', 20);
                if (typeof addScreenShake === 'function') addScreenShake(8);
            }
        }
    }

    draw() {
        if (this.dead || typeof CTX === 'undefined' || typeof worldToScreen !== 'function') return;
        const sc = worldToScreen(this.x, this.y);
        const now = performance.now() / 1000;
        const pulse = 0.55 + Math.sin(now * 4 + this._glowPhase) * 0.45;

        CTX.save();
        CTX.translate(sc.x, sc.y);

        // Outer glow
        CTX.globalAlpha = 0.45 * pulse;
        const grd = CTX.createRadialGradient(0, 0, 0, 0, 0, this.radius * 2.2);
        grd.addColorStop(0, '#00ffff');
        grd.addColorStop(1, 'rgba(0,255,255,0)');
        CTX.fillStyle = grd;
        CTX.beginPath(); CTX.arc(0, 0, this.radius * 2.2, 0, Math.PI * 2); CTX.fill();

        // Core — spinning square
        CTX.globalAlpha = 0.9;
        CTX.fillStyle = '#00ffff';
        CTX.shadowBlur = 18; CTX.shadowColor = '#39ff14';
        CTX.save();
        CTX.rotate(now * 3 + this._glowPhase);
        const hs = this.radius * 0.82;
        CTX.fillRect(-hs, -hs, hs * 2, hs * 2);
        CTX.restore();
        CTX.shadowBlur = 0;

        // Trail line toward boss (drawn as thin line from debris outward)
        CTX.globalAlpha = 0.22 * pulse;
        CTX.strokeStyle = '#39ff14';
        CTX.lineWidth = 1.5;
        const trailLen = this.orbitR * 0.35;
        const trailAng = this.angle + Math.PI;  // pointing away from boss
        CTX.beginPath();
        CTX.moveTo(0, 0);
        CTX.lineTo(Math.cos(trailAng) * trailLen, Math.sin(trailAng) * trailLen);
        CTX.stroke();

        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// ⚫ GRAVITATIONAL SINGULARITY — KruFirst Domain Expansion
//
//    Singleton, driven by game.js update/draw hooks.
//    Mirror structure of DomainExpansion (Manop) so game.js
//    hooks are identical in pattern.
//
//    Pulse sequence:
//      PULL    (4s) — player + projectiles bent toward boss
//      ESCAPE  (4.5s) — push outward; near boss = safe zone
//      TIDAL   (4.5s) — oscillating pull/push + FormulaZones
//      COLLAPSE(2.5s) — ramp pull + final shockwave AoE
// ════════════════════════════════════════════════════════════
const GravitationalSingularity = {
    phase: 'idle',      // 'idle' | 'casting' | 'active' | 'ending'
    pulse: 'PULL',      // current active pulse
    pulseTimer: 0,
    timer: 0,
    cooldownTimer: 0,
    originX: 0, originY: 0,
    _orbitals: [],      // OrbitalDebris instances (active in TIDAL)
    _rain: [],          // physics char rain (same pattern as DomainExpansion)
    _flashTimer: 0,
    _flashColor: '#00ffff',
    _pulse2FireTimer: 0,
    _pulse2TeleportsDone: 0,
    _pulse3ZonesDone: false,
    _collapseWarnDone: false,
    _collapseShockDone: false,

    canTrigger() { return this.phase === 'idle' && this.cooldownTimer <= 0; },
    isInvincible() { return this.phase !== 'idle'; },

    trigger(boss) {
        if (!this.canTrigger()) return;
        const _GS = BALANCE.boss.gravitationalSingularity;
        this.phase = 'casting';
        this.timer = _GS.castDur;
        this.originX = boss.x;
        this.originY = boss.y;
        this._orbitals = [];
        this._pulse2FireTimer = 0;
        this._pulse2TeleportsDone = 0;
        this._pulse3ZonesDone = false;
        this._collapseWarnDone = false;
        this._collapseShockDone = false;
        this._initRain();

        boss._domainCasting = true;
        boss._domainActive = true;

        if (typeof addScreenShake === 'function') addScreenShake(18);
        if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
        if (typeof spawnFloatingText === 'function') {
            spawnFloatingText('領域展開', boss.x, boss.y - 130, '#39ff14', 50);
            setTimeout(() => {
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('重力特異点', boss.x, boss.y - 185, '#00ffff', 36);
            }, 700);
            setTimeout(() => {
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('GRAVITATIONAL SINGULARITY', boss.x, boss.y - 230, '#a3e635', 24);
            }, 1200);
        }
        if (window.UIManager && typeof window.UIManager.showVoiceBubble === 'function') {
            window.UIManager.showVoiceBubble('領域展開...', boss.x, boss.y - 50);
            setTimeout(() => {
                if (window.UIManager)
                    window.UIManager.showVoiceBubble('นิวตัน... อภัยให้ข้าด้วย', boss.x, boss.y - 50);
            }, 1000);
        }
        if (typeof spawnParticles === 'function') {
            spawnParticles(boss.x, boss.y, 40, '#39ff14');
            spawnParticles(boss.x, boss.y, 25, '#00ffff');
            spawnParticles(boss.x, boss.y, 15, '#ffffff');
        }
        console.log('[GravitationalSingularity] ⚫ TRIGGERED');
    },

    update(dt, boss, player) {
        if (this.phase === 'idle') {
            if (this.cooldownTimer > 0) this.cooldownTimer -= dt;
            return;
        }
        if (this._flashTimer > 0) this._flashTimer -= dt;
        if (!boss || boss.dead) { this._abort(boss); return; }

        const _GS = BALANCE.boss.gravitationalSingularity;
        this.timer -= dt;

        // ── casting ──────────────────────────────────────────
        if (this.phase === 'casting') {
            if (this.timer <= 0) {
                this.phase = 'active';
                this.pulse = 'PULL';
                this.pulseTimer = _GS.pullDur;
                if (typeof addScreenShake === 'function') addScreenShake(30);
                if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
                if (typeof spawnFloatingText === 'function' && player)
                    spawnFloatingText('⚫ GRAVITATIONAL FIELD ACTIVE', player.x, player.y - 100, '#39ff14', 26);
            }
            return;
        }

        // ── ending ───────────────────────────────────────────
        if (this.phase === 'ending') {
            if (this.timer <= 0) {
                this.phase = 'idle';
                this.cooldownTimer = _GS.cooldown;
                this._orbitals = [];
                boss._domainCasting = false;
                boss._domainActive = false;
                if (boss.state === 'DOMAIN') { boss.state = 'CHASE'; boss.stateTimer = 0; }
                // Give player a brief immunity window
                if (player) {
                    player._gsImmunity = 0.5;
                    if (typeof spawnFloatingText === 'function')
                        spawnFloatingText('FIELD COLLAPSED', player.x, player.y - 80, '#39ff14', 22);
                }
                if (window.UIManager)
                    window.UIManager.showVoiceBubble('ยังยืนอยู่ได้... น่าทึ่ง', boss.x, boss.y - 50);
                console.log('[GravitationalSingularity] Domain ended');
            }
            return;
        }

        // ── active ───────────────────────────────────────────
        if (this.phase !== 'active') return;

        // Player GS immunity tick
        if (player && player._gsImmunity > 0) player._gsImmunity -= dt;

        this.pulseTimer -= dt;

        switch (this.pulse) {

            // ── Pulse 1: PULL — constant gravity toward boss ──────────
            case 'PULL': {
                if (player && !player.dead) {
                    const dx = boss.x - player.x, dy = boss.y - player.y;
                    const d = Math.hypot(dx, dy);
                    if (d > 0) {
                        const f = _GS.pullForce * dt;
                        player.vx = (player.vx || 0) + (dx / d) * f;
                        player.vy = (player.vy || 0) + (dy / d) * f;
                    }
                }
                // Bend player projectiles toward boss
                if (typeof projectileManager !== 'undefined') {
                    const _pullProjs = projectileManager.getAll
                        ? projectileManager.getAll()
                        : (projectileManager.list || []);
                    for (const p of _pullProjs) {
                        if (!p || p.dead || p.team === 'enemy') continue;
                        const pdx = boss.x - p.x, pdy = boss.y - p.y;
                        const pd = Math.hypot(pdx, pdy);
                        if (pd > 0 && pd < 600) {
                            const pf = _GS.projPullForce * dt;
                            p.vx = (p.vx || 0) + (pdx / pd) * pf;
                            p.vy = (p.vy || 0) + (pdy / pd) * pf;
                        }
                    }
                }
                if (this.pulseTimer <= 0) this._nextPulse(boss, player, 'ESCAPE', _GS.escapeDur);
                break;
            }

            // ── Pulse 2: ESCAPE — push outward; near boss = safe zone ─
            case 'ESCAPE': {
                if (player && !player.dead) {
                    const dx = player.x - boss.x, dy = player.y - boss.y;
                    const d = Math.hypot(dx, dy);
                    // Outside safe radius → push away
                    if (d > _GS.safeRadius && d > 0) {
                        const f = _GS.pushForce * dt;
                        player.vx = (player.vx || 0) + (dx / d) * f;
                        player.vy = (player.vy || 0) + (dy / d) * f;
                    } else if (d <= _GS.safeRadius && !player._gsSafeMsg) {
                        // Inside safe zone — notify once
                        player._gsSafeMsg = true;
                        if (typeof spawnFloatingText === 'function')
                            spawnFloatingText('⚫ SAFE ZONE', player.x, player.y - 55, '#39ff14', 20);
                        setTimeout(() => { if (player) player._gsSafeMsg = false; }, 1500);
                    }
                }
                // Boss teleports around arena and fires 3-way bursts
                this._pulse2FireTimer -= dt;
                if (this._pulse2FireTimer <= 0 && this._pulse2TeleportsDone < _GS.pulse2Teleports) {
                    this._pulse2TeleportsDone++;
                    this._pulse2FireTimer = _GS.pulse2FireCd;
                    if (player) {
                        // Teleport to random position near player at safe distance
                        const tAngle = Math.random() * Math.PI * 2;
                        const tDist = 180 + Math.random() * 120;
                        boss.x = player.x + Math.cos(tAngle) * tDist;
                        boss.y = player.y + Math.sin(tAngle) * tDist;
                        // 3-way fire toward player
                        const aimA = Math.atan2(player.y - boss.y, player.x - boss.x);
                        if (typeof projectileManager !== 'undefined') {
                            for (let i = -1; i <= 1; i++) {
                                projectileManager.add(new Projectile(
                                    boss.x, boss.y, aimA + i * 0.28, 520, 22, '#39ff14', false, 'enemy'
                                ));
                            }
                        }
                        if (typeof spawnParticles === 'function')
                            spawnParticles(boss.x, boss.y, 15, '#39ff14');
                        if (typeof addScreenShake === 'function') addScreenShake(6);
                    }
                }
                if (this.pulseTimer <= 0) this._nextPulse(boss, player, 'TIDAL', _GS.tidalDur);
                break;
            }

            // ── Pulse 3: TIDAL — oscillating pull/push + orbitals + zones ─
            case 'TIDAL': {
                const totalTidal = _GS.tidalDur;
                const elapsed = totalTidal - this.pulseTimer;
                const cycle = Math.sin((elapsed / _GS.tidalPeriod) * Math.PI * 2);
                const force = cycle * _GS.tidalForce * dt;

                if (player && !player.dead) {
                    const dx = boss.x - player.x, dy = boss.y - player.y;
                    const d = Math.hypot(dx, dy);
                    if (d > 0) {
                        player.vx = (player.vx || 0) + (dx / d) * force;
                        player.vy = (player.vy || 0) + (dy / d) * force;
                    }
                }

                // Spawn orbitals once at start
                if (this._orbitals.length === 0) {
                    const n = _GS.orbitalCount;
                    for (let i = 0; i < n; i++) {
                        this._orbitals.push(new OrbitalDebris(boss.x, boss.y, (i / n) * Math.PI * 2));
                    }
                    if (typeof spawnFloatingText === 'function')
                        spawnFloatingText('⚫ ORBITAL DEBRIS!', boss.x, boss.y - 90, '#00ffff', 28);
                }
                // Update orbitals
                for (const orb of this._orbitals) orb.update(dt, boss.x, boss.y, player);

                // Drop PhysicsFormulaZones once in this pulse
                if (!this._pulse3ZonesDone && elapsed > 1.0 && typeof PhysicsFormulaZone !== 'undefined') {
                    this._pulse3ZonesDone = true;
                    const n = _GS.pulse3ZoneCount;
                    for (let i = 0; i < n; i++) {
                        const zAngle = (i / n) * Math.PI * 2;
                        const zDist = 160;
                        if (player) {
                            window.specialEffects.push(new PhysicsFormulaZone(
                                player.x + Math.cos(zAngle) * zDist,
                                player.y + Math.sin(zAngle) * zDist,
                                110, 5.0, 15
                            ));
                        }
                    }
                    if (typeof spawnFloatingText === 'function' && player)
                        spawnFloatingText('⚠ TIDAL EQUATIONS!', player.x, player.y - 100, '#e879f9', 24);
                }

                if (this.pulseTimer <= 0) this._nextPulse(boss, player, 'COLLAPSE', _GS.collapseDur);
                break;
            }

            // ── Pulse 4: COLLAPSE — ramp pull + final shockwave ──────────
            case 'COLLAPSE': {
                const totalCollapse = _GS.collapseDur;
                const elapsed = totalCollapse - this.pulseTimer;
                const ramp = elapsed / totalCollapse;  // 0→1
                const f = _GS.collapseForce * ramp * dt;

                if (player && !player.dead) {
                    const dx = boss.x - player.x, dy = boss.y - player.y;
                    const d = Math.hypot(dx, dy);
                    if (d > 0) {
                        player.vx = (player.vx || 0) + (dx / d) * f;
                        player.vy = (player.vy || 0) + (dy / d) * f;
                    }
                }

                // Warn text once at start
                if (!this._collapseWarnDone) {
                    this._collapseWarnDone = true;
                    if (typeof spawnFloatingText === 'function') {
                        spawnFloatingText('⚫ SINGULARITY COLLAPSE!', boss.x, boss.y - 110, '#ef4444', 34);
                        spawnFloatingText('DASH TO ESCAPE!', boss.x, boss.y - 148, '#fbbf24', 22);
                    }
                    // Reset player dash so they always have an escape tool
                    if (player && player.cooldowns) player.cooldowns.dash = 0;
                    if (typeof addScreenShake === 'function') addScreenShake(20);
                    if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
                }

                // Final shockwave at the very end
                if (!this._collapseShockDone && this.pulseTimer <= 0.15) {
                    this._collapseShockDone = true;
                    // AoE damage
                    if (player && !player.dead) {
                        const d = Math.hypot(player.x - boss.x, player.y - boss.y);
                        if (d < _GS.collapseRadius + player.radius) {
                            const falloff = 1 - (d / _GS.collapseRadius) * 0.5;
                            player.takeDamage(_GS.collapseDamage * falloff);
                            spawnFloatingText('💥 COLLAPSE!', player.x, player.y - 60, '#ef4444', 30);
                        }
                    }
                    if (typeof window.specialEffects !== 'undefined') {
                        window.specialEffects.push(new ExpandingRing(boss.x, boss.y, '#39ff14', _GS.collapseRadius, 0.9));
                        window.specialEffects.push(new ExpandingRing(boss.x, boss.y, '#00ffff', _GS.collapseRadius * 0.65, 0.7));
                    }
                    if (typeof spawnParticles === 'function') {
                        spawnParticles(boss.x, boss.y, 60, '#39ff14');
                        spawnParticles(boss.x, boss.y, 35, '#00ffff');
                        spawnParticles(boss.x, boss.y, 20, '#ffffff');
                    }
                    if (typeof addScreenShake === 'function') addScreenShake(35);
                    this._flashTimer = 0.18;
                    this._flashColor = '#39ff14';
                    if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
                }

                if (this.pulseTimer <= 0) {
                    // Domain ends
                    const _GS2 = BALANCE.boss.gravitationalSingularity;
                    this.phase = 'ending';
                    this.timer = _GS2.endDur;
                    this._orbitals = [];
                    boss._domainCasting = false;
                    if (typeof addScreenShake === 'function') addScreenShake(22);
                    if (typeof spawnFloatingText === 'function' && player)
                        spawnFloatingText('Domain Lifted', player.x, player.y - 90, '#39ff14', 26);
                }
                break;
            }
        }
    },

    draw(ctx) {
        if (this.phase === 'idle' || !ctx) return;
        if (typeof worldToScreen !== 'function') return;
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const now = performance.now() / 1000;
        const _GS = BALANCE.boss.gravitationalSingularity;

        // Compute global alpha for fade in/out
        let globalA = 1.0;
        const castDur = _GS.castDur, endDur = _GS.endDur;
        if (this.phase === 'casting') globalA = 1.0 - this.timer / castDur;
        else if (this.phase === 'ending') globalA = this.timer / endDur;
        globalA = Math.max(0, Math.min(1, globalA));

        ctx.save();

        // ── 1. Dark overlay — deep space feel ────────────────
        ctx.globalAlpha = globalA * 0.72;
        ctx.fillStyle = 'rgba(0,4,8,1)';
        ctx.fillRect(0, 0, W, H);

        // ── 2. Physics char rain (green palette) ─────────────
        ctx.font = '11px "Courier New",monospace';
        ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        for (const col of this._rain) {
            const cx = col.xNorm * W, charH = 14;
            for (let i = 0; i < col.chars.length; i++) {
                const rawY = ((now * col.speed * H * 0.20 + col.offsetY + i * charH))
                    % (H + charH * col.chars.length) - charH * 4;
                const fade = 1.0 - i / col.chars.length;
                ctx.globalAlpha = globalA * col.alpha * fade;
                if (i === 0) { ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 8; ctx.shadowColor = '#39ff14'; }
                else if (i < 3) { ctx.fillStyle = '#39ff14'; ctx.shadowBlur = 4; ctx.shadowColor = '#39ff14'; }
                else { ctx.fillStyle = '#00ffff'; ctx.shadowBlur = 0; }
                ctx.fillText(col.chars[i], cx, rawY);
            }
        }
        ctx.shadowBlur = 0;

        // ── 3. Singularity point — black circle at boss ───────
        if ((this.phase === 'active' || this.phase === 'ending') && window.boss) {
            const bsc = worldToScreen(window.boss.x, window.boss.y);
            if (!isFinite(bsc.x) || !isFinite(bsc.y)) return;
            const pulse = 0.5 + Math.sin(now * 3.5) * 0.5;
            const singR = 28 + pulse * 8;

            // Lensing rings
            for (let ri = 0; ri < 4; ri++) {
                const rp = (ri + now * 0.6) % 4 / 4;
                const rr = singR * (1.5 + rp * 3.5);
                const ra = (1 - rp) * 0.55 * globalA;
                ctx.globalAlpha = ra;
                ctx.strokeStyle = ri % 2 === 0 ? '#39ff14' : '#00ffff';
                ctx.lineWidth = 2.5 - ri * 0.5;
                ctx.shadowBlur = 14; ctx.shadowColor = '#39ff14';
                ctx.beginPath(); ctx.arc(bsc.x, bsc.y, rr, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Black hole core
            ctx.globalAlpha = globalA * 0.95;
            const coreG = ctx.createRadialGradient(bsc.x, bsc.y, 0, bsc.x, bsc.y, singR);
            coreG.addColorStop(0, '#000000');
            coreG.addColorStop(0.55, '#001a00');
            coreG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = coreG;
            ctx.beginPath(); ctx.arc(bsc.x, bsc.y, singR * 1.3, 0, Math.PI * 2); ctx.fill();

            // Event horizon ring
            ctx.globalAlpha = globalA * (0.7 + pulse * 0.3);
            ctx.strokeStyle = '#39ff14';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 24; ctx.shadowColor = '#39ff14';
            ctx.beginPath(); ctx.arc(bsc.x, bsc.y, singR, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // ── 4. Pulse-specific overlays ────────────────────────
        if (this.phase === 'active' && window.boss && window.player) {
            const bsc = worldToScreen(window.boss.x, window.boss.y);
            const psc = worldToScreen(window.player.x, window.player.y);

            if (this.pulse === 'PULL') {
                // Gravity lines from player toward boss
                const lineCount = 8;
                for (let li = 0; li < lineCount; li++) {
                    const lAngle = (li / lineCount) * Math.PI * 2 + now * 0.4;
                    const lDist = 80 + li * 20;
                    const lx = psc.x + Math.cos(lAngle) * lDist;
                    const ly = psc.y + Math.sin(lAngle) * lDist;
                    const dx = bsc.x - lx, dy = bsc.y - ly;
                    const ld = Math.hypot(dx, dy);
                    if (ld < 5) continue;
                    const endX = lx + (dx / ld) * Math.min(ld, 55);
                    const endY = ly + (dy / ld) * Math.min(ld, 55);
                    ctx.globalAlpha = globalA * 0.35;
                    ctx.strokeStyle = '#39ff14';
                    ctx.lineWidth = 1.2;
                    ctx.setLineDash([6, 5]);
                    ctx.lineDashOffset = -(now * 60) % 11;
                    ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(endX, endY); ctx.stroke();
                    ctx.setLineDash([]); ctx.lineDashOffset = 0;
                }
                // PULL HUD label
                ctx.globalAlpha = globalA * 0.80;
                ctx.font = 'bold 12px "Orbitron",Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#39ff14';
                ctx.shadowBlur = 8; ctx.shadowColor = '#39ff14';
                ctx.fillText('⚫ GRAVITATIONAL PULL', W / 2, 28);
                ctx.shadowBlur = 0;
            }

            if (this.pulse === 'ESCAPE') {
                // Safe zone circle around boss
                const edgeSS = worldToScreen(window.boss.x + _GS.safeRadius, window.boss.y);
                const rSS = Math.abs(edgeSS.x - bsc.x);
                const sp = 0.5 + Math.sin(now * 4) * 0.5;
                ctx.globalAlpha = globalA * (0.25 + sp * 0.20);
                ctx.fillStyle = 'rgba(57,255,20,0.15)';
                ctx.beginPath(); ctx.arc(bsc.x, bsc.y, rSS, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = globalA * (0.55 + sp * 0.40);
                ctx.strokeStyle = '#39ff14';
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 16; ctx.shadowColor = '#39ff14';
                ctx.setLineDash([8, 5]);
                ctx.beginPath(); ctx.arc(bsc.x, bsc.y, rSS, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]); ctx.shadowBlur = 0;
                // SAFE ZONE label near boss
                ctx.globalAlpha = globalA * 0.85;
                ctx.font = 'bold 10px "Orbitron",Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#39ff14';
                ctx.fillText('SAFE', bsc.x, bsc.y + rSS + 14);

                // ESCAPE HUD label
                ctx.globalAlpha = globalA * 0.80;
                ctx.font = 'bold 12px "Orbitron",Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#00ffff';
                ctx.shadowBlur = 8; ctx.shadowColor = '#00ffff';
                ctx.fillText('⚡ ESCAPE VELOCITY — APPROACH BOSS!', W / 2, 28);
                ctx.shadowBlur = 0;
            }

            if (this.pulse === 'TIDAL') {
                // Tidal force direction hint (arrow pulsing pull/push)
                const totalTidal = _GS.tidalDur;
                const elapsed = totalTidal - this.pulseTimer;
                const cycle = Math.sin((elapsed / _GS.tidalPeriod) * Math.PI * 2);
                const isPull = cycle > 0;
                ctx.globalAlpha = globalA * 0.75;
                ctx.font = 'bold 12px "Orbitron",Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#e879f9';
                ctx.shadowBlur = 8; ctx.shadowColor = '#e879f9';
                ctx.fillText(isPull ? '⚫ TIDAL — PULLING' : '⚡ TIDAL — PUSHING', W / 2, 28);
                ctx.shadowBlur = 0;

                // Draw orbital debris
                for (const orb of this._orbitals) orb.draw();
            }

            if (this.pulse === 'COLLAPSE') {
                // Red vignette ramp
                const totalCollapse = _GS.collapseDur;
                const elapsed = totalCollapse - this.pulseTimer;
                const ramp = elapsed / totalCollapse;
                ctx.globalAlpha = globalA * ramp * 0.45;
                ctx.fillStyle = 'rgba(200,0,0,1)';
                ctx.fillRect(0, 0, W, H);

                // Concentric warning rings
                ctx.globalAlpha = globalA * 0.55;
                const edgeSS = worldToScreen(window.boss.x + _GS.collapseRadius, window.boss.y);
                const colRSS = Math.abs(edgeSS.x - bsc.x);
                for (let i = 0; i < 3; i++) {
                    const rr = colRSS * (0.35 + i * 0.32);
                    const cp = (now * 1.5 + i * 0.5) % 1;
                    ctx.globalAlpha = globalA * (1 - cp) * 0.55;
                    ctx.strokeStyle = i === 0 ? '#ef4444' : '#39ff14';
                    ctx.lineWidth = 2 - i * 0.4;
                    ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
                    ctx.beginPath(); ctx.arc(bsc.x, bsc.y, rr, 0, Math.PI * 2); ctx.stroke();
                    ctx.shadowBlur = 0;
                }

                ctx.globalAlpha = globalA * 0.85;
                ctx.font = 'bold 14px "Orbitron",Arial';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ef4444';
                ctx.shadowBlur = 12; ctx.shadowColor = '#ef4444';
                ctx.fillText('⚫ SINGULARITY COLLAPSE — DASH!', W / 2, 28);
                ctx.shadowBlur = 0;
            }
        }

        // ── 5. Full-screen hit flash ──────────────────────────
        if (this._flashTimer > 0) {
            ctx.globalAlpha = Math.min(this._flashTimer / 0.18, 1.0) * 0.50;
            ctx.fillStyle = this._flashColor;
            ctx.fillRect(0, 0, W, H);
        }

        // ── 6. Slow debuff HUD (reuse existing pattern) ──────
        if (typeof window !== 'undefined' && window.player && window.player._formulaSlowActive) {
            const sp = 0.5 + Math.sin(now * 6) * 0.5;
            ctx.globalAlpha = globalA * 0.22 * sp;
            ctx.fillStyle = '#39ff14';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = globalA * (0.55 + sp * 0.35);
            ctx.font = 'bold 14px "Orbitron",Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillStyle = '#a3e635';
            ctx.shadowBlur = 10; ctx.shadowColor = '#39ff14';
            ctx.fillText('⚫ SLOW FIELD', W / 2, 12);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    },

    _nextPulse(boss, player, nextPulse, duration) {
        this.pulse = nextPulse;
        this.pulseTimer = duration;
        // Reset per-pulse state
        this._pulse2FireTimer = 0;
        this._pulse2TeleportsDone = 0;
        this._pulse3ZonesDone = false;
        this._collapseWarnDone = false;
        this._collapseShockDone = false;

        const labels = {
            ESCAPE: ['⚡ ESCAPE VELOCITY!', 'GO NEAR THE BOSS!', '#00ffff'],
            TIDAL: ['〰 TIDAL FORCE!', 'BRACE FOR OSCILLATION', '#e879f9'],
            COLLAPSE: ['⚫ SINGULARITY COLLAPSE!', 'DASH TO ESCAPE!', '#ef4444'],
        };
        if (labels[nextPulse] && typeof spawnFloatingText === 'function' && player) {
            const [title, sub, col] = labels[nextPulse];
            spawnFloatingText(title, player.x, player.y - 110, col, 30);
            setTimeout(() => {
                if (typeof spawnFloatingText === 'function' && player)
                    spawnFloatingText(sub, player.x, player.y - 148, '#fbbf24', 20);
            }, 500);
        }
        if (typeof addScreenShake === 'function') addScreenShake(12);
        if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
    },

    _initRain() {
        const POOL = '0123456789FvamgEtωρABCΔΩΣΨFmav∫∂∇+-×÷=≤≥';
        const rainChar = () => POOL[Math.floor(Math.random() * POOL.length)];
        this._rain = [];
        for (let i = 0; i < 32; i++) {
            const len = 7 + Math.floor(Math.random() * 9);
            this._rain.push({
                xNorm: Math.random(),
                offsetY: Math.random() * 600,
                speed: 0.5 + Math.random() * 0.8,
                alpha: 0.20 + Math.random() * 0.30,
                chars: Array.from({ length: len }, rainChar),
            });
        }
    },

    _abort(boss) {
        this.phase = 'idle'; this.cooldownTimer = 0;
        this._orbitals = []; this._flashTimer = 0;
        if (boss) { boss._domainCasting = false; boss._domainActive = false; }
        console.log('[GravitationalSingularity] Aborted — boss dead');
    },
};

window.GravitationalSingularity = GravitationalSingularity;
window.OrbitalDebris = OrbitalDebris;
// ════════════════════════════════════════════════════════════
// 🌀 GRAVITY WELL — KruFirst Derivation Mode hazard
//
//    A pull/push field placed between boss and player.
//    Bends player velocity + all enemy projectiles toward centre.
//    Radius 80px, duration 4s.
//
//    update(dt, player) → true when expired
//    draw()             → concentric rings + distortion lines
// ════════════════════════════════════════════════════════════
class GravityWell {
    /**
     * @param {number} x       world centre X
     * @param {number} y       world centre Y
     * @param {number} radius  influence radius (px)
     * @param {number} duration seconds active
     * @param {number} force   pull force px/s on player
     * @param {number} projForce pull force px/s on projectiles
     */
    constructor(x, y, radius = 80, duration = 4.0, force = 90, projForce = 55) {
        this.x = x; this.y = y;
        this.radius = radius;
        this.duration = duration;
        this.force = force;
        this.projForce = projForce;
        this.timer = 0;
        this.dead = false;
        // Pre-seed visual — no Math.random() in draw()
        this._ringSeeds = [x * 0.13 + y * 0.07, x * 0.09 - y * 0.11, x * 0.17 + y * 0.03];
    }

    update(dt, player) {
        if (this.dead) return true;
        this.timer += dt;
        if (this.timer >= this.duration) { this.dead = true; return true; }

        // ── Pull player if within radius ─────────────────────
        if (player && !player.dead) {
            const pdx = this.x - player.x, pdy = this.y - player.y;
            const pd = Math.hypot(pdx, pdy);
            if (pd > 0 && pd < this.radius) {
                const strength = this.force * (1.0 - pd / this.radius);
                player.vx += (pdx / pd) * strength * dt;
                player.vy += (pdy / pd) * strength * dt;
            }
        }

        // ── Bend player projectiles ───────────────────────────
        if (typeof projectileManager !== 'undefined') {
            const projs = projectileManager.getAll
                ? projectileManager.getAll()
                : (projectileManager.list || []);
            for (const p of projs) {
                if (!p || p.dead || p.team !== 'player') continue;
                const pdx = this.x - p.x, pdy = this.y - p.y;
                const pd = Math.hypot(pdx, pdy);
                if (pd > 0 && pd < this.radius * 1.5) {
                    const strength = this.projForce * (1.0 - pd / (this.radius * 1.5));
                    p.vx += (pdx / pd) * strength * dt;
                    p.vy += (pdy / pd) * strength * dt;
                }
            }
        }

        return false;
    }

    draw() {
        if (this.dead || typeof CTX === 'undefined' || typeof worldToScreen !== 'function') return;
        const sc = worldToScreen(this.x, this.y);
        const prog = this.timer / this.duration;
        const alpha = prog < 0.1 ? prog / 0.1 : prog > 0.8 ? 1 - (prog - 0.8) / 0.2 : 1.0;
        const now = performance.now() / 1000;
        const pulse = 0.55 + Math.sin(now * 5.5) * 0.45;

        // Approximate screen radius (world→screen scale)
        const edgeSS = worldToScreen(this.x + this.radius, this.y);
        const rSS = Math.abs(edgeSS.x - sc.x);
        if (!isFinite(rSS) || rSS < 1) { CTX.restore?.(); return; }

        CTX.save();

        // ── Outer glow fill ───────────────────────────────────
        const grd = CTX.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, rSS);
        grd.addColorStop(0, `rgba(16,185,129,${alpha * 0.35})`);
        grd.addColorStop(0.6, `rgba(6,182,212,${alpha * 0.12})`);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        CTX.fillStyle = grd;
        CTX.beginPath(); CTX.arc(sc.x, sc.y, rSS, 0, Math.PI * 2); CTX.fill();

        // ── Concentric pull rings (3) ─────────────────────────
        for (let ri = 0; ri < 3; ri++) {
            const rFrac = (((now * (0.8 + ri * 0.3) + this._ringSeeds[ri]) % 1.0) + 1.0) % 1.0;
            // Rings animate inward (toward centre)
            const rr = rSS * (1.0 - rFrac);
            if (rr < 2) continue;
            CTX.globalAlpha = alpha * (1.0 - rFrac) * (0.7 - ri * 0.15);
            CTX.strokeStyle = ri === 0 ? '#10b981' : '#06b6d4';
            CTX.lineWidth = 2.0 - ri * 0.5;
            CTX.shadowBlur = 10 - ri * 2; CTX.shadowColor = '#10b981';
            CTX.beginPath(); CTX.arc(sc.x, sc.y, rr, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;
        }

        // ── Inward arrow lines (6 directions) ────────────────
        CTX.globalAlpha = alpha * pulse * 0.55;
        CTX.strokeStyle = '#34d399'; CTX.lineWidth = 1.5;
        for (let ai = 0; ai < 6; ai++) {
            const ang = (ai / 6) * Math.PI * 2 + now * 0.6;
            const startR = rSS * 0.85;
            const endR = rSS * 0.25;
            CTX.beginPath();
            CTX.moveTo(sc.x + Math.cos(ang) * startR, sc.y + Math.sin(ang) * startR);
            CTX.lineTo(sc.x + Math.cos(ang) * endR, sc.y + Math.sin(ang) * endR);
            CTX.stroke();
            // Arrowhead
            const hx = sc.x + Math.cos(ang) * endR;
            const hy = sc.y + Math.sin(ang) * endR;
            const perp = ang + Math.PI / 2;
            CTX.beginPath();
            CTX.moveTo(hx, hy);
            CTX.lineTo(hx + Math.cos(ang + 2.4) * 7, hy + Math.sin(ang + 2.4) * 7);
            CTX.moveTo(hx, hy);
            CTX.lineTo(hx + Math.cos(ang - 2.4) * 7, hy + Math.sin(ang - 2.4) * 7);
            CTX.stroke();
        }

        // ── Centre singularity dot ────────────────────────────
        CTX.globalAlpha = alpha * (0.7 + pulse * 0.3);
        CTX.fillStyle = '#ffffff';
        CTX.shadowBlur = 20 * pulse; CTX.shadowColor = '#10b981';
        CTX.beginPath(); CTX.arc(sc.x, sc.y, 4 + pulse * 3, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // ── Remaining-time arc ────────────────────────────────
        CTX.globalAlpha = alpha * 0.45;
        CTX.strokeStyle = '#34d399'; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.arc(sc.x, sc.y, rSS + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - prog));
        CTX.stroke();

        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 👻 SUPERPOSITION CLONE — KruFirst Derivation Mode phantom
//
//    A phantom copy of KruFirst. 1 HP, fires projectiles like
//    the real boss. Player must destroy it or take sustained fire.
//    Does NOT deal contact damage. Dies to 1 hit.
//
//    update(dt, player) → true when dead/expired
//    draw(ctx)          → ghost rendering of KruFirst silhouette
// ════════════════════════════════════════════════════════════
class SuperpositionClone {
    /**
     * @param {number} x      spawn X (world)
     * @param {number} y      spawn Y (world)
     * @param {number} duration seconds before vanishing
     * @param {boolean} isAdvanced  mirror boss advanced state
     */
    constructor(x, y, duration = 3.0, isAdvanced = false) {
        this.x = x; this.y = y;
        this.duration = duration;
        this.isAdvanced = isAdvanced;
        this.timer = 0;
        this.dead = false;
        this.hp = 1;
        this.radius = (BALANCE.boss.radius ?? 38) * 0.88;
        this._fireCd = 1.0;    // time until first shot
        this._fireInterval = isAdvanced ? 1.1 : 1.5;
        // Pre-seed angle offset so it doesn't mirror exact boss shots
        this._angleOffset = (x * 0.031 + y * 0.017) % (Math.PI * 2);
    }

    takeDamage() {
        this.hp = 0;
        this.dead = true;
        if (typeof spawnParticles === 'function') spawnParticles(this.x, this.y, 20, '#06b6d4');
        if (typeof spawnFloatingText === 'function') spawnFloatingText('CLONE DESTROYED!', this.x, this.y - 55, '#00ffff', 22);
        if (typeof addScreenShake === 'function') addScreenShake(6);
    }

    update(dt, player) {
        if (this.dead) return true;
        this.timer += dt;
        if (this.timer >= this.duration) { this.dead = true; return true; }

        this._fireCd -= dt;

        if (!player || player.dead) return false;

        // Rotate to face player
        const dx = player.x - this.x, dy = player.y - this.y;
        this.angle = Math.atan2(dy, dx);

        // Fire toward player
        if (this._fireCd <= 0 && typeof projectileManager !== 'undefined') {
            this._fireCd = this._fireInterval;
            const spd = 420;
            const dmg = this.isAdvanced ? 16 : 12;
            // 2-way spread (weaker than real boss)
            for (const spread of [-0.15, 0.15]) {
                projectileManager.add(new Projectile(
                    this.x, this.y, this.angle + spread + this._angleOffset * 0.05,
                    spd, dmg, '#06b6d4', false, 'enemy'
                ));
            }
            if (typeof spawnParticles === 'function') spawnParticles(this.x, this.y, 4, '#06b6d4');
        }

        // Projectile hit detection (player's bullets)
        if (typeof projectileManager !== 'undefined') {
            const projs = projectileManager.getAll
                ? projectileManager.getAll()
                : (projectileManager.list || []);
            for (const p of projs) {
                if (!p || p.dead || p.team !== 'player') continue;
                if (Math.hypot(p.x - this.x, p.y - this.y) < this.radius + (p.radius ?? 8)) {
                    p.dead = true;
                    this.takeDamage();
                    return true;
                }
            }
        }

        return false;
    }

    draw() {
        if (this.dead || typeof CTX === 'undefined' || typeof worldToScreen !== 'function') return;
        const sc = worldToScreen(this.x, this.y);
        const prog = this.timer / this.duration;
        const alpha = prog < 0.12 ? prog / 0.12 : prog > 0.80 ? 1 - (prog - 0.80) / 0.20 : 1.0;
        const now = performance.now() / 1000;
        const flicker = 0.55 + Math.sin(now * 14 + this._angleOffset) * 0.45;
        const r = this.radius;

        CTX.save();
        CTX.translate(sc.x, sc.y);
        CTX.globalAlpha = alpha * flicker * 0.70;

        // ── Ghost silhouette of KruFirst body ─────────────────
        // Simplified cyan ghost — no per-frame random
        CTX.shadowBlur = 22; CTX.shadowColor = '#06b6d4';

        // Body circle
        CTX.strokeStyle = '#00ffff'; CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.stroke();

        // Lab coat outline (cross shape)
        CTX.strokeStyle = '#67e8f9'; CTX.lineWidth = 1.5;
        CTX.beginPath();
        CTX.moveTo(-r * 0.5, -r * 0.3); CTX.lineTo(-r * 0.5, r * 0.6);
        CTX.moveTo(r * 0.5, -r * 0.3); CTX.lineTo(r * 0.5, r * 0.6);
        CTX.moveTo(-r * 0.5, -r * 0.3); CTX.lineTo(r * 0.5, -r * 0.3);
        CTX.stroke();

        // Head
        CTX.beginPath(); CTX.arc(0, -r * 0.55, r * 0.32, 0, Math.PI * 2); CTX.stroke();

        // ψ (Quantum superposition symbol) at centre
        CTX.shadowBlur = 0;
        CTX.globalAlpha = alpha * (0.6 + Math.sin(now * 8) * 0.4);
        CTX.font = `bold ${Math.max(12, r * 0.55)}px serif`;
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillStyle = '#00ffff';
        CTX.shadowBlur = 12; CTX.shadowColor = '#06b6d4';
        CTX.fillText('ψ', 0, 0);
        CTX.shadowBlur = 0;

        // ── Remaining-time arc ────────────────────────────────
        CTX.globalAlpha = alpha * 0.40;
        CTX.strokeStyle = '#06b6d4'; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.arc(0, 0, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - prog));
        CTX.stroke();

        CTX.restore();
    }
}

window.GravityWell = GravityWell;
window.SuperpositionClone = SuperpositionClone;
// ── Global exports ────────────────────────────────────────────
window.FreeFallWarningRing = FreeFallWarningRing;
window.PorkSandwich = PorkSandwich;
window.EmpPulse = EmpPulse;
window.PhysicsFormulaZone = PhysicsFormulaZone;
window.ParabolicVolley = ParabolicVolley;