'use strict';

/**
 * js/weapons/Projectile.js
 * ════════════════════════════════════════════════
 * Projectile base class and variant rendering logic.
 * ════════════════════════════════════════════════
 */

// ============================================================================
// 🚀 PROJECTILE CLASS
// ============================================================================
class Projectile {
    constructor(x, y, angle, speed, damage, color, isCrit, team, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = damage;
        this.color = color;
        this.team = team;

        this.life = options && options.life !== undefined ? options.life : 3;
        this.angle = angle;
        this.isCrit = isCrit;

        this.kind = options?.kind || "bullet";
        this.size =
            options && options.size !== undefined ? options.size : isCrit ? 24 : 14;
        this.radius = options && options.radius !== undefined ? options.radius : 10;
        this.pierce = options && options.pierce !== undefined ? options.pierce : 0;

        // --- RICOCHET PROPERTY ---
        this.bounces =
            options && options.bounces !== undefined ? options.bounces : 0;

        this.hitSet = null;
        this.symbol = options?.symbol || this.getSymbol(isCrit, team);
    }

    getSymbol(isCrit, team) {
        if (team === "player") return isCrit ? "∑" : "x";
        const symbols = ["sin", "cos", "tan", "√", "π", "-b±√", "dx", "dy", "Δ"];
        return randomChoice(symbols);
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.angle += dt * 2; // Preserves visual spinning effect

        // --- BULLET-PROOF RICOCHET & BOUNDARY PHYSICS ---
        const _wb =
            typeof GAME_CONFIG !== "undefined" && GAME_CONFIG.physics?.worldBounds
                ? GAME_CONFIG.physics.worldBounds
                : 1500;
        const minX = -_wb,
            maxX = _wb;
        const minY = -_wb,
            maxY = _wb;

        let hitWall = false;

        if (this.x - this.radius < minX) {
            this.x = minX + this.radius;
            hitWall = true;
            if (this.bounces > 0) {
                this.vx *= -1;
                this.bounces--;
                this.angle = Math.atan2(this.vy, this.vx);
            }
        } else if (this.x + this.radius > maxX) {
            this.x = maxX - this.radius;
            hitWall = true;
            if (this.bounces > 0) {
                this.vx *= -1;
                this.bounces--;
                this.angle = Math.atan2(this.vy, this.vx);
            }
        }

        if (this.y - this.radius < minY) {
            this.y = minY + this.radius;
            hitWall = true;
            if (this.bounces > 0) {
                this.vy *= -1;
                this.bounces--;
                this.angle = Math.atan2(this.vy, this.vx);
            }
        } else if (this.y + this.radius > maxY) {
            this.y = maxY - this.radius;
            hitWall = true;
            if (this.bounces > 0) {
                this.vy *= -1;
                this.bounces--;
                this.angle = Math.atan2(this.vy, this.vx);
            }
        }

        if (hitWall && this.bounces <= 0) {
            this.life = 0;
        }

        if (this.kind !== "punch" && Math.random() < 0.15) {
            spawnParticles(this.x, this.y, 1, this.color);
        }

        return this.life <= 0;
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ════════════════════════════════════════════════
        // HEAT WAVE (Auto — หมัดพุ่งออกมาจากสแตนด์)
        // ════════════════════════════════════════════════
        if (this.kind === "heatwave") {
            CTX.rotate(this.angle);

            const now = performance.now();
            // ── ลำแสงพลังงานลากหลังหมัด ─────────────────
            const trailLen = 36;
            const trailG = CTX.createLinearGradient(-trailLen, 0, 0, 0);
            trailG.addColorStop(0, "rgba(220,38,38,0)");
            trailG.addColorStop(0.5, "rgba(239,68,68,0.25)");
            trailG.addColorStop(1, "rgba(251,113,133,0.55)");
            CTX.globalAlpha = 0.9;
            CTX.strokeStyle = trailG;
            CTX.lineWidth = 12;
            CTX.lineCap = "round";
            CTX.shadowBlur = 18;
            CTX.shadowColor = "#dc2626";
            CTX.beginPath();
            CTX.moveTo(-trailLen, -4);
            CTX.lineTo(-4, -4);
            CTX.stroke();
            CTX.beginPath();
            CTX.moveTo(-trailLen + 6, 4);
            CTX.lineTo(-4, 4);
            CTX.stroke();

            // ── กำปั้น: ฝ่ามือ (Palm) ────────────────────
            CTX.globalAlpha = 0.97;
            const palmG = CTX.createLinearGradient(-10, -13, 14, 13);
            palmG.addColorStop(0, "#fff1f2");
            palmG.addColorStop(0.35, "#fb7185");
            palmG.addColorStop(1, "#be123c");
            CTX.fillStyle = palmG;
            CTX.shadowBlur = 22;
            CTX.shadowColor = "#f97316";
            CTX.beginPath();
            CTX.roundRect(-9, -12, 17, 24, [3, 5, 5, 3]);
            CTX.fill();

            // ── กำปั้น: แนวนิ้ว 4 นิ้ว (Knuckles) ────────
            CTX.shadowBlur = 0;
            CTX.fillStyle = "#fff1f2";
            CTX.strokeStyle = "#9f1239";
            CTX.lineWidth = 1.2;
            for (let k = 0; k < 4; k++) {
                CTX.beginPath();
                CTX.roundRect(6, -11 + k * 6, 9, 5, [2, 3, 2, 1]);
                CTX.fill();
                CTX.stroke();
            }

            // ── แสง crit/heat ที่ข้อนิ้ว ─────────────────
            const kGlow = 0.6 + Math.sin(now / 60) * 0.4;
            CTX.globalAlpha = kGlow;
            CTX.fillStyle = "#fbbf24";
            CTX.shadowBlur = 14;
            CTX.shadowColor = "#f97316";
            CTX.beginPath();
            CTX.arc(10, -8, 3.5, 0, Math.PI * 2);
            CTX.fill();
            CTX.beginPath();
            CTX.arc(10, 4, 3.5, 0, Math.PI * 2);
            CTX.fill();

            // ── หัวแม่มือ (Thumb) ─────────────────────────
            CTX.globalAlpha = 0.92;
            CTX.shadowBlur = 0;
            CTX.fillStyle = "#fb7185";
            CTX.strokeStyle = "#9f1239";
            CTX.lineWidth = 1;
            CTX.beginPath();
            CTX.roundRect(-4, 11, 13, 6, 3);
            CTX.fill();
            CTX.stroke();

            // ── Impact rings — dual expanding arcs ───────
            const ringPhase = (now / 80) % (Math.PI * 2);
            const rInner = 14 + Math.sin(ringPhase) * 3;
            const rOuter = 20 + Math.sin(ringPhase * 0.7 + 1) * 4;
            CTX.globalAlpha = 0.55 + Math.sin(ringPhase) * 0.25;
            CTX.strokeStyle = "#f97316";
            CTX.lineWidth = 2.5;
            CTX.shadowBlur = 16;
            CTX.shadowColor = "#dc2626";
            CTX.beginPath();
            CTX.arc(8, 0, rInner, -Math.PI * 0.45, Math.PI * 0.45);
            CTX.stroke();
            CTX.globalAlpha = 0.28 + Math.sin(ringPhase * 0.7) * 0.15;
            CTX.strokeStyle = "#fca5a5";
            CTX.lineWidth = 1.2;
            CTX.shadowBlur = 8;
            CTX.beginPath();
            CTX.arc(8, 0, rOuter, -Math.PI * 0.55, Math.PI * 0.55);
            CTX.stroke();
            // Heat shimmer dots at ring edge
            CTX.globalAlpha = 0.7;
            CTX.fillStyle = "#fbbf24";
            CTX.shadowBlur = 6;
            CTX.shadowColor = "#f97316";
            for (let ri = -1; ri <= 1; ri++) {
                const ra = ri * 0.35;
                CTX.beginPath();
                CTX.arc(
                    8 + Math.cos(ra) * rInner,
                    Math.sin(ra) * rInner,
                    1.5,
                    0,
                    Math.PI * 2,
                );
                CTX.fill();
            }

            CTX.restore();
            return;
        }

        // ════════════════════════════════════════════════
        // WANCHAI PUNCH (Actual Fist Model)
        // ════════════════════════════════════════════════
        if (this.kind === "punch") {
            CTX.rotate(this.angle);
            const now = performance.now();

            // Outer shockwave ring
            const swPhase = (now / 90) % (Math.PI * 2);
            const swR = 18 + Math.sin(swPhase) * 4;
            CTX.globalAlpha = 0.35 + Math.sin(swPhase) * 0.2;
            CTX.strokeStyle = "#f97316";
            CTX.lineWidth = 2.5;
            CTX.shadowBlur = 18;
            CTX.shadowColor = "#dc2626";
            CTX.beginPath();
            CTX.arc(4, 0, swR, -Math.PI * 0.5, Math.PI * 0.5);
            CTX.stroke();
            CTX.globalAlpha = 0.18;
            CTX.strokeStyle = "#fca5a5";
            CTX.lineWidth = 1;
            CTX.beginPath();
            CTX.arc(4, 0, swR + 6, -Math.PI * 0.6, Math.PI * 0.6);
            CTX.stroke();
            CTX.shadowBlur = 0;

            // Speed lines — 3 tapered trails
            const trailCols = [
                "rgba(239,68,68,",
                "rgba(251,113,133,",
                "rgba(253,164,175,",
            ];
            [
                [-28, -9, 3],
                [-33, 0, 2.5],
                [-28, 9, 2],
            ].forEach(([x, y, w], ti) => {
                const tg = CTX.createLinearGradient(x, y, 4, y);
                tg.addColorStop(0, trailCols[ti] + "0)");
                tg.addColorStop(0.5, trailCols[ti] + "0.3)");
                tg.addColorStop(1, trailCols[ti] + "0.7)");
                CTX.globalAlpha = 0.8;
                CTX.strokeStyle = tg;
                CTX.lineWidth = w;
                CTX.lineCap = "round";
                CTX.beginPath();
                CTX.moveTo(x, y);
                CTX.lineTo(4, y);
                CTX.stroke();
            });

            // Fist body — palm with gradient
            CTX.globalAlpha = 0.97;
            const fg = CTX.createLinearGradient(-10, -13, 14, 13);
            fg.addColorStop(0, "#fff1f2");
            fg.addColorStop(0.35, "#fb7185");
            fg.addColorStop(1, "#be123c");
            CTX.fillStyle = fg;
            CTX.shadowBlur = 20;
            CTX.shadowColor = "#f97316";
            CTX.beginPath();
            CTX.roundRect(-9, -12, 17, 24, [3, 5, 5, 3]);
            CTX.fill();
            CTX.shadowBlur = 0;

            // Knuckle guards — 4 raised ridges
            CTX.fillStyle = "#ffe4e6";
            CTX.strokeStyle = "#9f1239";
            CTX.lineWidth = 1.2;
            for (let k = 0; k < 4; k++) {
                CTX.beginPath();
                CTX.roundRect(6, -11 + k * 6, 9, 5, [2, 3, 2, 1]);
                CTX.fill();
                CTX.stroke();
                // Knuckle impact glow
                const kg = 0.55 + Math.sin(now / 55 + k * 0.9) * 0.45;
                CTX.globalAlpha = kg;
                CTX.fillStyle = k % 2 === 0 ? "#fbbf24" : "#f97316";
                CTX.shadowBlur = 10 * kg;
                CTX.shadowColor = "#f97316";
                CTX.beginPath();
                CTX.arc(11, -8.5 + k * 6, 2.5, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.globalAlpha = 1;
            CTX.shadowBlur = 0;

            // Thumb
            CTX.fillStyle = "#fb7185";
            CTX.strokeStyle = "#9f1239";
            CTX.lineWidth = 1;
            CTX.beginPath();
            CTX.roundRect(-4, 11, 13, 6, 3);
            CTX.fill();
            CTX.stroke();

            // Wrist band — golden stripe (Wanchai signature)
            CTX.fillStyle = "#fbbf24";
            CTX.shadowBlur = 8;
            CTX.shadowColor = "#f59e0b";
            CTX.beginPath();
            CTX.roundRect(-9, 5, 17, 3, 1);
            CTX.fill();
            CTX.shadowBlur = 0;

            CTX.restore();
            return;
        }

        // ════════════════════════════════════════════════
        // PLAYER PROJECTILES — weapon-specific art
        // Routing priority: isPoom > weaponKind > color-derived
        // isGolden = Ambush break / Weapon Master buff (color #facc15)
        // isCharged = Weapon Master charged sniper release (symbol '∑')
        // ════════════════════════════════════════════════
        if (this.isPoom) {
            // ── POOM — Enchanted Rice Cluster (always, regardless of isCrit/symbol) ──
            CTX.rotate(this.angle);
            const r = this.isCrit ? 11 : 7.5;
            const now = performance.now();
            // emerald magic trail
            for (let ti = 0; ti < 5; ti++) {
                const td = (ti + 1) * (r * 0.65);
                const tR = r * (0.38 - ti * 0.055);
                if (tR <= 0) continue;
                CTX.globalAlpha = (1 - ti / 5) * 0.5;
                const wispG = CTX.createRadialGradient(-td, 0, 0, -td, 0, tR);
                wispG.addColorStop(0, "#34d399");
                wispG.addColorStop(1, "rgba(16,185,129,0)");
                CTX.fillStyle = wispG;
                CTX.shadowBlur = 8;
                CTX.shadowColor = "#10b981";
                CTX.beginPath();
                CTX.arc(-td, 0, tR, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.shadowBlur = 0;
            CTX.globalAlpha = 0.18;
            CTX.fillStyle = "#6ee7b7";
            CTX.shadowBlur = 18;
            CTX.shadowColor = "#10b981";
            CTX.beginPath();
            CTX.arc(0, 0, r * 1.65, 0, Math.PI * 2);
            CTX.fill();
            CTX.shadowBlur = 0;
            const poomGrains = [
                [0, 0, r],
                [-r * 0.65, -r * 0.42, r * 0.72],
                [r * 0.55, -r * 0.48, r * 0.68],
                [-r * 0.48, r * 0.55, r * 0.63],
                [r * 0.38, r * 0.52, r * 0.58],
            ];
            CTX.globalAlpha = 1;
            CTX.shadowBlur = 10;
            CTX.shadowColor = "#fbbf24";
            for (const [gx, gy, gr] of poomGrains) {
                const gGrad = CTX.createRadialGradient(
                    gx - gr * 0.25,
                    gy - gr * 0.25,
                    0,
                    gx,
                    gy,
                    gr,
                );
                gGrad.addColorStop(0, "#fffbeb");
                gGrad.addColorStop(0.55, "#fde68a");
                gGrad.addColorStop(1, "#d97706");
                CTX.fillStyle = gGrad;
                CTX.beginPath();
                CTX.arc(gx, gy, gr, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.shadowBlur = 0;
            const veinPulse = 0.5 + Math.sin(now / 180) * 0.5;
            CTX.globalAlpha = 0.3 + veinPulse * 0.3;
            CTX.fillStyle = "#6ee7b7";
            CTX.shadowBlur = 5;
            CTX.shadowColor = "#10b981";
            CTX.beginPath();
            CTX.arc(-r * 0.18, -r * 0.2, r * 0.22, 0, Math.PI * 2);
            CTX.fill();
            CTX.beginPath();
            CTX.arc(r * 0.25, r * 0.15, r * 0.18, 0, Math.PI * 2);
            CTX.fill();
            CTX.shadowBlur = 0;
            if (this.isCrit) {
                CTX.globalAlpha = 0.85;
                CTX.strokeStyle = "#facc15";
                CTX.lineWidth = 1.8;
                CTX.shadowBlur = 22;
                CTX.shadowColor = "#facc15";
                CTX.beginPath();
                CTX.arc(0, 0, r + 7, 0, Math.PI * 2);
                CTX.stroke();
                CTX.strokeStyle = "#fef08a";
                CTX.lineWidth = 1;
                CTX.shadowBlur = 10;
                for (let si = 0; si < 8; si++) {
                    const sa = (si / 8) * Math.PI * 2;
                    CTX.globalAlpha = 0.6 + Math.sin(now / 120 + si) * 0.3;
                    CTX.beginPath();
                    CTX.moveTo(Math.cos(sa) * (r + 3), Math.sin(sa) * (r + 3));
                    CTX.lineTo(Math.cos(sa) * (r + 11), Math.sin(sa) * (r + 11));
                    CTX.stroke();
                }
            }
        } else if (this.team === "player") {
            CTX.rotate(this.angle);
            const now = performance.now();

            // ── Determine effective weapon and visual state ────────────────
            const wk =
                this.weaponKind ||
                (this.color === "#3b82f6"
                    ? "auto"
                    : this.color === "#f59e0b"
                        ? "shotgun"
                        : this.color === "#ef4444"
                            ? "sniper"
                            : "auto");
            const isGolden = this.color === "#facc15";
            const isCharged = this.symbol === "∑" && wk === "sniper";

            // ── AUTO RIFLE — Plasma Tracer with holo rings ────────────────
            if (wk === "auto") {
                const coreColor = isGolden
                    ? "#facc15"
                    : this.isCrit
                        ? "#facc15"
                        : "#93c5fd";
                const glowColor = isGolden
                    ? "#f59e0b"
                    : this.isCrit
                        ? "#facc15"
                        : "#60a5fa";
                const trailColor = isGolden ? "rgba(251,191,36," : "rgba(59,130,246,";
                const trailLen = this.isCrit || isGolden ? 28 : 18;
                const coreW = this.isCrit || isGolden ? 4 : 2.5;

                const trailGrad = CTX.createLinearGradient(-trailLen, 0, 0, 0);
                trailGrad.addColorStop(0, "rgba(0,0,0,0)");
                trailGrad.addColorStop(0.6, `${trailColor}0.2)`);
                trailGrad.addColorStop(1, `${trailColor}0.55)`);
                CTX.globalAlpha = 1;
                CTX.strokeStyle = trailGrad;
                CTX.lineWidth = coreW + 6;
                CTX.lineCap = "butt";
                CTX.beginPath();
                CTX.moveTo(-trailLen, 0);
                CTX.lineTo(0, 0);
                CTX.stroke();

                CTX.strokeStyle = coreColor;
                CTX.lineWidth = coreW;
                CTX.shadowBlur = this.isCrit || isGolden ? 22 : 14;
                CTX.shadowColor = glowColor;
                CTX.beginPath();
                CTX.moveTo(-trailLen * 0.5, 0);
                CTX.lineTo(5, 0);
                CTX.stroke();

                CTX.fillStyle = "#ffffff";
                CTX.shadowBlur = 16;
                CTX.shadowColor = glowColor;
                CTX.beginPath();
                CTX.arc(5, 0, coreW * 0.85, 0, Math.PI * 2);
                CTX.fill();
                CTX.shadowBlur = 0;

                if (isGolden) {
                    const ringAngle = (now / 80) % (Math.PI * 2);
                    CTX.globalAlpha = 0.7;
                    CTX.strokeStyle = "#facc15";
                    CTX.lineWidth = 1;
                    CTX.shadowBlur = 10;
                    CTX.shadowColor = "#facc15";
                    CTX.beginPath();
                    CTX.ellipse(0, 0, 8, 4, ringAngle, 0, Math.PI * 2);
                    CTX.stroke();
                    CTX.globalAlpha = 0.45;
                    CTX.strokeStyle = "#fde68a";
                    CTX.lineWidth = 0.7;
                    CTX.beginPath();
                    CTX.ellipse(0, 0, 11, 3, -ringAngle * 0.7, 0, Math.PI * 2);
                    CTX.stroke();
                } else if (this.isCrit) {
                    CTX.globalAlpha = 0.7;
                    CTX.strokeStyle = "#facc15";
                    CTX.lineWidth = 1;
                    CTX.shadowBlur = 10;
                    CTX.shadowColor = "#facc15";
                    for (let sp = 0; sp < 6; sp++) {
                        const sa = (sp / 6) * Math.PI * 2;
                        CTX.beginPath();
                        CTX.moveTo(Math.cos(sa) * 5, Math.sin(sa) * 5);
                        CTX.lineTo(Math.cos(sa) * 10, Math.sin(sa) * 10);
                        CTX.stroke();
                    }
                } else {
                    const ringAngle = (now / 120) % (Math.PI * 2);
                    CTX.globalAlpha = 0.55;
                    CTX.strokeStyle = "#7dd3fc";
                    CTX.lineWidth = 0.8;
                    CTX.beginPath();
                    CTX.ellipse(0, 0, 7, 3.5, ringAngle, 0, Math.PI * 2);
                    CTX.stroke();
                    CTX.globalAlpha = 0.35;
                    CTX.strokeStyle = "#bfdbfe";
                    CTX.lineWidth = 0.7;
                    CTX.beginPath();
                    CTX.ellipse(0, 0, 9, 2.5, -ringAngle * 0.7, 0, Math.PI * 2);
                    CTX.stroke();
                }

                // ── SHOTGUN — Molten Shrapnel ─────────────────────────────────
            } else if (wk === "shotgun") {
                const sz = this.isCrit || isGolden ? 7 : 5;
                const glowColor = isGolden ? "#facc15" : "#f97316";

                CTX.globalAlpha = 0.3;
                CTX.fillStyle = isGolden ? "#facc15" : "#fbbf24";
                CTX.shadowBlur = 14;
                CTX.shadowColor = glowColor;
                CTX.beginPath();
                CTX.ellipse(-sz, 0, sz * 2, sz, 0, 0, Math.PI * 2);
                CTX.fill();
                CTX.shadowBlur = 0;

                CTX.globalAlpha = 1;
                const shardG = CTX.createLinearGradient(-sz, -sz, sz, sz);
                if (isGolden) {
                    shardG.addColorStop(0, "#fef9c3");
                    shardG.addColorStop(0.4, "#facc15");
                    shardG.addColorStop(1, "#b45309");
                } else {
                    shardG.addColorStop(0, "#fef3c7");
                    shardG.addColorStop(0.4, "#f59e0b");
                    shardG.addColorStop(1, "#c2410c");
                }
                CTX.fillStyle = shardG;
                CTX.shadowBlur = this.isCrit || isGolden ? 22 : 10;
                CTX.shadowColor = glowColor;
                CTX.beginPath();
                CTX.moveTo(sz * 1.4, 0);
                CTX.lineTo(sz * 0.4, -sz * 1.1);
                CTX.lineTo(-sz * 0.5, -sz * 0.6);
                CTX.lineTo(-sz * 1.2, 0.5);
                CTX.lineTo(-sz * 0.4, sz * 0.9);
                CTX.lineTo(sz * 0.7, sz * 0.5);
                CTX.closePath();
                CTX.fill();

                CTX.fillStyle = isGolden ? "#fef9c3" : "#fffbeb";
                CTX.shadowBlur = 8;
                CTX.shadowColor = glowColor;
                CTX.beginPath();
                CTX.arc(0, 0, sz * 0.45, 0, Math.PI * 2);
                CTX.fill();
                CTX.shadowBlur = 0;

                CTX.globalAlpha = 0.7;
                CTX.fillStyle = isGolden ? "#facc15" : "#fbbf24";
                CTX.beginPath();
                CTX.arc(-sz * 1.5, 1, 1.2, 0, Math.PI * 2);
                CTX.fill();
                CTX.globalAlpha = 0.42;
                CTX.beginPath();
                CTX.arc(-sz * 2.1, -1.5, 0.9, 0, Math.PI * 2);
                CTX.fill();
                CTX.globalAlpha = 0.25;
                CTX.beginPath();
                CTX.arc(-sz * 2.8, 0.5, 0.7, 0, Math.PI * 2);
                CTX.fill();

                if (this.isCrit || isGolden) {
                    CTX.globalAlpha = 0.85;
                    CTX.strokeStyle = "#facc15";
                    CTX.lineWidth = 1.5;
                    CTX.shadowBlur = 18;
                    CTX.shadowColor = "#facc15";
                    CTX.beginPath();
                    CTX.arc(0, 0, sz + 5, 0, Math.PI * 2);
                    CTX.stroke();
                }

                // ── SNIPER — charged golden lance (Weapon Master release) ─────
            } else if (wk === "sniper" && isCharged) {
                CTX.globalAlpha = 0.25;
                CTX.fillStyle = "#facc15";
                CTX.beginPath();
                CTX.ellipse(-16, 0, 22, 8, 0, 0, Math.PI * 2);
                CTX.fill();
                CTX.globalAlpha = 1;
                const cg = CTX.createLinearGradient(-28, 0, 6, 0);
                cg.addColorStop(0, "rgba(251,191,36,0)");
                cg.addColorStop(0.55, "#facc15");
                cg.addColorStop(1, "#ffffff");
                CTX.strokeStyle = cg;
                CTX.lineWidth = 6;
                CTX.lineCap = "round";
                CTX.shadowBlur = 28;
                CTX.shadowColor = "#facc15";
                CTX.beginPath();
                CTX.moveTo(-28, 0);
                CTX.lineTo(6, 0);
                CTX.stroke();
                // energy rings
                CTX.strokeStyle = "#fde68a";
                CTX.lineWidth = 1.2;
                CTX.shadowBlur = 8;
                for (let ri = -20; ri < 4; ri += 8) {
                    const ra = Math.max(0, (28 + ri) / 34);
                    CTX.globalAlpha = ra * 0.5;
                    CTX.beginPath();
                    CTX.arc(ri, 0, 4 + ra * 3, 0, Math.PI * 2);
                    CTX.stroke();
                }
                CTX.shadowBlur = 0;

                // ── SNIPER — Railgun Needle (normal + golden ambush variant) ──
            } else if (wk === "sniper") {
                const needleLen = this.isCrit || isGolden ? 38 : 28;
                const needleW = this.isCrit || isGolden ? 2.2 : 1.4;
                const needleColor = isGolden
                    ? "#facc15"
                    : this.isCrit
                        ? "#facc15"
                        : "#ef4444";
                const glowColor = isGolden
                    ? "#f59e0b"
                    : this.isCrit
                        ? "#facc15"
                        : "#ef4444";
                const coneColor = isGolden ? "#fca5a5" : "#fca5a5";

                const coneCount = 3;
                for (let ci = 0; ci < coneCount; ci++) {
                    const coneLen = needleLen * (0.45 + ci * 0.2);
                    const coneW = (3 + ci * 2.5) * (this.isCrit || isGolden ? 1.4 : 1);
                    CTX.globalAlpha = 0.12 - ci * 0.03;
                    CTX.fillStyle = coneColor;
                    CTX.beginPath();
                    CTX.moveTo(-coneLen * 0.15, 0);
                    CTX.lineTo(-coneLen, -coneW);
                    CTX.lineTo(-coneLen, coneW);
                    CTX.closePath();
                    CTX.fill();
                }

                CTX.globalAlpha = 0.35;
                const wakeGrad = CTX.createLinearGradient(-needleLen, 0, 0, 0);
                wakeGrad.addColorStop(0, "rgba(0,0,0,0)");
                wakeGrad.addColorStop(
                    1,
                    isGolden ? "rgba(251,191,36,0.6)" : "rgba(252,165,165,0.6)",
                );
                CTX.strokeStyle = wakeGrad;
                CTX.lineWidth = needleW + 4;
                CTX.lineCap = "butt";
                CTX.beginPath();
                CTX.moveTo(-needleLen, 0);
                CTX.lineTo(0, 0);
                CTX.stroke();

                CTX.globalAlpha = 1;
                const needleGrad = CTX.createLinearGradient(
                    -needleLen,
                    0,
                    needleLen * 0.15,
                    0,
                );
                needleGrad.addColorStop(
                    0,
                    isGolden ? "rgba(251,191,36,0.3)" : "rgba(239,68,68,0.3)",
                );
                needleGrad.addColorStop(0.7, needleColor);
                needleGrad.addColorStop(1, "#ffffff");
                CTX.strokeStyle = needleGrad;
                CTX.lineWidth = needleW;
                CTX.shadowBlur = this.isCrit || isGolden ? 24 : 16;
                CTX.shadowColor = glowColor;
                CTX.lineCap = "round";
                CTX.beginPath();
                CTX.moveTo(-needleLen, 0);
                CTX.lineTo(needleLen * 0.12, 0);
                CTX.stroke();

                // sharp tip — rounded dot, NO arrow-head
                CTX.fillStyle = "#ffffff";
                CTX.shadowBlur = 12;
                CTX.shadowColor = glowColor;
                CTX.beginPath();
                CTX.arc(needleLen * 0.12, 0, needleW * 1.1, 0, Math.PI * 2);
                CTX.fill();
                CTX.shadowBlur = 0;

                if (this.isCrit || isGolden) {
                    CTX.globalAlpha = 0.5;
                    CTX.strokeStyle = "#facc15";
                    CTX.lineWidth = 0.8;
                    for (let ri = -24; ri < 0; ri += 9) {
                        CTX.beginPath();
                        CTX.arc(ri, 0, 3.5, 0, Math.PI * 2);
                        CTX.stroke();
                    }
                }

                // ── KATANA SLASH WAVE — curved blade ripple ─────────────────
            } else if (wk === "katana") {
                const now = performance.now();
                const isGold = isGolden || this.isCrit;
                const coreCol = isGold ? "#facc15" : "#7ec8e3";
                const glowCol = isGold ? "#fde68a" : "#38d0f8";
                const edgeCol = isGold ? "#fffbe0" : "#daf4ff";
                const trailCol = isGold ? "rgba(251,204,21," : "rgba(56,208,248,";

                const trailLen = isGold ? 38 : 28;
                const trailG = CTX.createLinearGradient(-trailLen, 0, 0, 0);
                trailG.addColorStop(0, trailCol + "0)");
                trailG.addColorStop(0.55, trailCol + "0.15)");
                trailG.addColorStop(1, trailCol + "0.42)");
                CTX.globalAlpha = 1;
                CTX.strokeStyle = trailG;
                CTX.lineWidth = isGold ? 10 : 7;
                CTX.lineCap = "butt";
                CTX.shadowBlur = isGold ? 18 : 10;
                CTX.shadowColor = glowCol;
                CTX.beginPath();
                CTX.moveTo(-trailLen, 0);
                CTX.lineTo(0, 0);
                CTX.stroke();
                CTX.shadowBlur = 0;

                const BW = isGold ? 15 : 11;
                const BL = isGold ? 22 : 16;
                const grad = CTX.createLinearGradient(-4, 0, BL, 0);
                grad.addColorStop(0, edgeCol);
                grad.addColorStop(0.35, coreCol);
                grad.addColorStop(0.75, isGold ? "#c89a00" : "#2280a8");
                grad.addColorStop(1, "rgba(0,0,0,0)");
                CTX.globalAlpha = 0.96;
                CTX.fillStyle = grad;
                CTX.shadowBlur = isGold ? 22 : 14;
                CTX.shadowColor = glowCol;
                CTX.beginPath();
                CTX.moveTo(-4, -BW * 0.3);
                CTX.bezierCurveTo(BL * 0.2, -BW * 0.8, BL * 0.55, -BW * 0.6, BL, 0);
                CTX.bezierCurveTo(
                    BL * 0.55,
                    BW * 0.38,
                    BL * 0.22,
                    BW * 0.62,
                    -4,
                    BW * 0.3,
                );
                CTX.closePath();
                CTX.fill();

                CTX.globalAlpha = 0.82;
                CTX.strokeStyle = isGold ? "#ffffff" : "#e8f8ff";
                CTX.lineWidth = 0.9;
                CTX.lineCap = "round";
                CTX.shadowBlur = 6;
                CTX.shadowColor = edgeCol;
                CTX.beginPath();
                CTX.moveTo(-2, BW * 0.05);
                CTX.bezierCurveTo(
                    BL * 0.22,
                    BW * 0.3,
                    BL * 0.55,
                    BW * 0.18,
                    BL * 0.92,
                    0,
                );
                CTX.stroke();

                const wavePhase = (now / 100) % (Math.PI * 2);
                const wR1 = 10 + Math.sin(wavePhase) * 2.5;
                CTX.globalAlpha = 0.38 + Math.sin(wavePhase) * 0.18;
                CTX.strokeStyle = coreCol;
                CTX.lineWidth = 1.4;
                CTX.shadowBlur = 10;
                CTX.shadowColor = glowCol;
                CTX.beginPath();
                CTX.arc(BL + 4, 0, wR1, -Math.PI * 0.55, Math.PI * 0.55);
                CTX.stroke();
                CTX.globalAlpha = 0.2;
                CTX.strokeStyle = edgeCol;
                CTX.lineWidth = 0.8;
                CTX.beginPath();
                CTX.arc(BL + 4, 0, wR1 + 5, -Math.PI * 0.48, Math.PI * 0.48);
                CTX.stroke();
                CTX.shadowBlur = 0;

                if (isGold) {
                    CTX.globalAlpha = 0.72;
                    CTX.strokeStyle = "#facc15";
                    CTX.lineWidth = 1.6;
                    CTX.shadowBlur = 20;
                    CTX.shadowColor = "#facc15";
                    CTX.beginPath();
                    CTX.arc(0, 0, BW + 6, 0, Math.PI * 2);
                    CTX.stroke();
                    CTX.strokeStyle = "#fef9c3";
                    CTX.lineWidth = 0.9;
                    CTX.shadowBlur = 8;
                    for (let si = 0; si < 8; si++) {
                        const sa = (si / 8) * Math.PI * 2 + now / 400;
                        CTX.globalAlpha = 0.55 + Math.sin(now / 100 + si) * 0.35;
                        CTX.beginPath();
                        CTX.moveTo(Math.cos(sa) * (BW + 2), Math.sin(sa) * (BW + 2));
                        CTX.lineTo(Math.cos(sa) * (BW + 11), Math.sin(sa) * (BW + 11));
                        CTX.stroke();
                    }
                }
                CTX.lineCap = "butt";

                // ── FALLBACK (unknown weaponKind) — glowing dot, no arrow ─────
            } else {
                const fw = this.isCrit || isGolden ? 5 : 3.5;
                CTX.fillStyle = isGolden ? "#facc15" : this.color || "#ffffff";
                CTX.shadowBlur = this.isCrit || isGolden ? 20 : 10;
                CTX.shadowColor = isGolden ? "#facc15" : this.color;
                CTX.beginPath();
                CTX.arc(0, 0, fw, 0, Math.PI * 2);
                CTX.fill();
                CTX.shadowBlur = 0;
            }
        } else if (!this.isPoom) {
            CTX.rotate(this.angle);
            const now = performance.now();
            const symSize = this.size || 14;
            const hexR = symSize * 0.85;

            const coronaG = CTX.createRadialGradient(
                0,
                0,
                hexR * 0.3,
                0,
                0,
                hexR * 1.8,
            );
            coronaG.addColorStop(
                0,
                this.color.replace(")", ",0.35)").replace("rgb", "rgba") ||
                `rgba(220,38,38,0.35)`,
            );
            coronaG.addColorStop(1, "rgba(0,0,0,0)");
            CTX.fillStyle = coronaG;
            CTX.globalAlpha = 0.6 + Math.sin(now / 180) * 0.3;
            CTX.beginPath();
            CTX.arc(0, 0, hexR * 1.8, 0, Math.PI * 2);
            CTX.fill();

            const hexRot = (now / 600) % (Math.PI * 2);
            CTX.save();
            CTX.rotate(hexRot);
            CTX.strokeStyle = this.color;
            CTX.lineWidth = 1;
            CTX.globalAlpha = 0.45 + Math.sin(now / 220) * 0.25;
            CTX.shadowBlur = 8;
            CTX.shadowColor = this.color;
            CTX.beginPath();
            for (let hi = 0; hi < 6; hi++) {
                const ha = (hi / 6) * Math.PI * 2;
                if (hi === 0) CTX.moveTo(Math.cos(ha) * hexR, Math.sin(ha) * hexR);
                else CTX.lineTo(Math.cos(ha) * hexR, Math.sin(ha) * hexR);
            }
            CTX.closePath();
            CTX.stroke();
            CTX.fillStyle = this.color;
            CTX.shadowBlur = 6;
            for (let hi = 0; hi < 6; hi += 2) {
                const ha = (hi / 6) * Math.PI * 2;
                CTX.beginPath();
                CTX.arc(Math.cos(ha) * hexR, Math.sin(ha) * hexR, 1.2, 0, Math.PI * 2);
                CTX.fill();
            }
            CTX.restore();

            CTX.globalAlpha = 1;
            CTX.shadowBlur = 14;
            CTX.shadowColor = this.color;
            CTX.fillStyle = this.color;
            CTX.font = `bold ${symSize}px monospace`;
            CTX.textAlign = "center";
            CTX.textBaseline = "middle";
            CTX.strokeStyle = "rgba(0,0,0,0.6)";
            CTX.lineWidth = 3;
            CTX.strokeText(this.symbol, 0, 0);
            CTX.fillText(this.symbol, 0, 0);
            CTX.shadowBlur = 0;
        }

        CTX.restore();
    }

    checkCollision(entity) {
        const r = this.radius !== undefined ? this.radius : 10;
        return circleCollision(
            this.x,
            this.y,
            r,
            entity.x,
            entity.y,
            entity.radius,
        );
    }
}

window.Projectile = Projectile;
