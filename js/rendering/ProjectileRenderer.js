'use strict';
/**
 * js/rendering/ProjectileRenderer.js
 * ════════════════════════════════════════════════════════════════════
 * ProjectileRenderer — Decoupled rendering logic for all projectiles.
 * Static class that owns every ctx.* call for bullets, punches, and
 * character-specific effects.
 *
 * Load after: Projectile.js, map.js (worldToScreen)
 * Exports: window.ProjectileRenderer
 * ════════════════════════════════════════════════════════════════════
 */

class ProjectileRenderer {
    /**
     * Helper to draw all projectiles in a collection.
     */
    static drawAll(projectiles, ctx) {
        if (!projectiles || !ctx) return;
        for (const p of projectiles) {
            ProjectileRenderer.draw(p, ctx);
        }
    }

    /**
     * Dispatcher/Entry point for a single projectile.
     */
    static draw(p, ctx) {
        const screen = worldToScreen(p.x, p.y);
        ctx.save();
        ctx.translate(screen.x, screen.y);

        // ════════════════════════════════════════════════
        // HEAT WAVE (Auto — หมัดพุ่งออกมาจากสแตนด์)
        // ════════════════════════════════════════════════
        if (p.kind === "heatwave") {
            ProjectileRenderer._drawHeatWave(p, ctx);
        }
        // ════════════════════════════════════════════════
        // WANCHAI PUNCH (Actual Fist Model)
        // ════════════════════════════════════════════════
        else if (p.kind === "punch") {
            ProjectileRenderer._drawWanchaiPunch(p, ctx);
        }
        // ════════════════════════════════════════════════
        // POOM — Enchanted Rice Cluster
        // ════════════════════════════════════════════════
        else if (p.isPoom) {
            ProjectileRenderer._drawPoomProjectile(p, ctx);
        }
        // ════════════════════════════════════════════════
        // PLAYER PROJECTILES — weapon-specific art
        // ════════════════════════════════════════════════
        else if (p.team === "player") {
            ProjectileRenderer._drawPlayerProjectile(p, ctx);
        }
        // ════════════════════════════════════════════════
        // ENEMY PROJECTILES — hex-grid math symbols
        // ════════════════════════════════════════════════
        else {
            ProjectileRenderer._drawEnemyProjectile(p, ctx);
        }

        ctx.restore();
    }

    static _drawHeatWave(p, ctx) {
        ctx.rotate(p.angle);
        const now = performance.now();
        // ── ลำแสงพลังงานลากหลังหมัด ─────────────────
        const trailLen = 36;
        const trailG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
        trailG.addColorStop(0, "rgba(220,38,38,0)");
        trailG.addColorStop(0.5, "rgba(239,68,68,0.25)");
        trailG.addColorStop(1, "rgba(251,113,133,0.55)");
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = trailG;
        ctx.lineWidth = 12;
        ctx.lineCap = "round";
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#dc2626";
        ctx.beginPath();
        ctx.moveTo(-trailLen, -4);
        ctx.lineTo(-4, -4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-trailLen + 6, 4);
        ctx.lineTo(-4, 4);
        ctx.stroke();

        // ── กำปั้น: ฝ่ามือ (Palm) ────────────────────
        ctx.globalAlpha = 0.97;
        const palmG = ctx.createLinearGradient(-10, -13, 14, 13);
        palmG.addColorStop(0, "#fff1f2");
        palmG.addColorStop(0.35, "#fb7185");
        palmG.addColorStop(1, "#be123c");
        ctx.fillStyle = palmG;
        ctx.shadowBlur = 22;
        ctx.shadowColor = "#f97316";
        ctx.beginPath();
        ctx.roundRect(-9, -12, 17, 24, [3, 5, 5, 3]);
        ctx.fill();

        // ── กำปั้น: แนวนิ้ว 4 นิ้ว (Knuckles) ────────
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff1f2";
        ctx.strokeStyle = "#9f1239";
        ctx.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.roundRect(6, -11 + k * 6, 9, 5, [2, 3, 2, 1]);
            ctx.fill();
            ctx.stroke();
        }

        // ── แสง crit/heat ที่ข้อนิ้ว ─────────────────
        const kGlow = 0.6 + Math.sin(now / 60) * 0.4;
        ctx.globalAlpha = kGlow;
        ctx.fillStyle = "#fbbf24";
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#f97316";
        ctx.beginPath();
        ctx.arc(10, -8, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, 4, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // ── หัวแม่มือ (Thumb) ─────────────────────────
        ctx.globalAlpha = 0.92;
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fb7185";
        ctx.strokeStyle = "#9f1239";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-4, 11, 13, 6, 3);
        ctx.fill();
        ctx.stroke();

        // ── Impact rings — dual expanding arcs ───────
        const ringPhase = (now / 80) % (Math.PI * 2);
        const rInner = 14 + Math.sin(ringPhase) * 3;
        const rOuter = 20 + Math.sin(ringPhase * 0.7 + 1) * 4;
        ctx.globalAlpha = 0.55 + Math.sin(ringPhase) * 0.25;
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 16;
        ctx.shadowColor = "#dc2626";
        ctx.beginPath();
        ctx.arc(8, 0, rInner, -Math.PI * 0.45, Math.PI * 0.45);
        ctx.stroke();
        ctx.globalAlpha = 0.28 + Math.sin(ringPhase * 0.7) * 0.15;
        ctx.strokeStyle = "#fca5a5";
        ctx.lineWidth = 1.2;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(8, 0, rOuter, -Math.PI * 0.55, Math.PI * 0.55);
        ctx.stroke();
        // Heat shimmer dots at ring edge
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#fbbf24";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#f97316";
        for (let ri = -1; ri <= 1; ri++) {
            const ra = ri * 0.35;
            ctx.beginPath();
            ctx.arc(
                8 + Math.cos(ra) * rInner,
                Math.sin(ra) * rInner,
                1.5,
                0,
                Math.PI * 2,
            );
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    static _drawWanchaiPunch(p, ctx) {
        ctx.rotate(p.angle);
        const now = performance.now();

        // Outer shockwave ring
        const swPhase = (now / 90) % (Math.PI * 2);
        const swR = 18 + Math.sin(swPhase) * 4;
        ctx.globalAlpha = 0.35 + Math.sin(swPhase) * 0.2;
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#dc2626";
        ctx.beginPath();
        ctx.arc(4, 0, swR, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.stroke();
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = "#fca5a5";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(4, 0, swR + 6, -Math.PI * 0.6, Math.PI * 0.6);
        ctx.stroke();
        ctx.shadowBlur = 0;

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
            const tg = ctx.createLinearGradient(x, y, 4, y);
            tg.addColorStop(0, trailCols[ti] + "0)");
            tg.addColorStop(0.5, trailCols[ti] + "0.3)");
            tg.addColorStop(1, trailCols[ti] + "0.7)");
            ctx.globalAlpha = 0.8;
            ctx.strokeStyle = tg;
            ctx.lineWidth = w;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(4, y);
            ctx.stroke();
        });

        // Fist body — palm with gradient
        ctx.globalAlpha = 0.97;
        const fg = ctx.createLinearGradient(-10, -13, 14, 13);
        fg.addColorStop(0, "#fff1f2");
        fg.addColorStop(0.35, "#fb7185");
        fg.addColorStop(1, "#be123c");
        ctx.fillStyle = fg;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#f97316";
        ctx.beginPath();
        ctx.roundRect(-9, -12, 17, 24, [3, 5, 5, 3]);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Knuckle guards — 4 raised ridges
        ctx.fillStyle = "#ffe4e6";
        ctx.strokeStyle = "#9f1239";
        ctx.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) {
            ctx.beginPath();
            ctx.roundRect(6, -11 + k * 6, 9, 5, [2, 3, 2, 1]);
            ctx.fill();
            ctx.stroke();
            // Knuckle impact glow
            const kg = 0.55 + Math.sin(now / 55 + k * 0.9) * 0.45;
            ctx.globalAlpha = kg;
            ctx.fillStyle = k % 2 === 0 ? "#fbbf24" : "#f97316";
            ctx.shadowBlur = 10 * kg;
            ctx.shadowColor = "#f97316";
            ctx.beginPath();
            ctx.arc(11, -8.5 + k * 6, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Thumb
        ctx.fillStyle = "#fb7185";
        ctx.strokeStyle = "#9f1239";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-4, 11, 13, 6, 3);
        ctx.fill();
        ctx.stroke();

        // Wrist band — golden stripe (Wanchai signature)
        ctx.fillStyle = "#fbbf24";
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#f59e0b";
        ctx.beginPath();
        ctx.roundRect(-9, 5, 17, 3, 1);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    static _drawPoomProjectile(p, ctx) {
        ctx.rotate(p.angle);
        const r = p.isCrit ? 11 : 7.5;
        const now = performance.now();
        // emerald magic trail
        for (let ti = 0; ti < 5; ti++) {
            const td = (ti + 1) * (r * 0.65);
            const tR = r * (0.38 - ti * 0.055);
            if (tR <= 0) continue;
            ctx.globalAlpha = (1 - ti / 5) * 0.5;
            const wispG = ctx.createRadialGradient(-td, 0, 0, -td, 0, tR);
            wispG.addColorStop(0, "#34d399");
            wispG.addColorStop(1, "rgba(16,185,129,0)");
            ctx.fillStyle = wispG;
            ctx.shadowBlur = 8;
            ctx.shadowColor = "#10b981";
            ctx.beginPath();
            ctx.arc(-td, 0, tR, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#6ee7b7";
        ctx.shadowBlur = 18;
        ctx.shadowColor = "#10b981";
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        const poomGrains = [
            [0, 0, r],
            [-r * 0.65, -r * 0.42, r * 0.72],
            [r * 0.55, -r * 0.48, r * 0.68],
            [-r * 0.48, r * 0.55, r * 0.63],
            [r * 0.38, r * 0.52, r * 0.58],
        ];
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#fbbf24";
        for (const [gx, gy, gr] of poomGrains) {
            const gGrad = ctx.createRadialGradient(
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
            ctx.fillStyle = gGrad;
            ctx.beginPath();
            ctx.arc(gx, gy, gr, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;
        const veinPulse = 0.5 + Math.sin(now / 180) * 0.5;
        ctx.globalAlpha = 0.3 + veinPulse * 0.3;
        ctx.fillStyle = "#6ee7b7";
        ctx.shadowBlur = 5;
        ctx.shadowColor = "#10b981";
        ctx.beginPath();
        ctx.arc(-r * 0.18, -r * 0.2, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(r * 0.25, r * 0.15, r * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (p.isCrit) {
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = "#facc15";
            ctx.lineWidth = 1.8;
            ctx.shadowBlur = 22;
            ctx.shadowColor = "#facc15";
            ctx.beginPath();
            ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = "#fef08a";
            ctx.lineWidth = 1;
            ctx.shadowBlur = 10;
            for (let si = 0; si < 8; si++) {
                const sa = (si / 8) * Math.PI * 2;
                ctx.globalAlpha = 0.6 + Math.sin(now / 120 + si) * 0.3;
                ctx.beginPath();
                ctx.moveTo(Math.cos(sa) * (r + 3), Math.sin(sa) * (r + 3));
                ctx.lineTo(Math.cos(sa) * (r + 11), Math.sin(sa) * (r + 11));
                ctx.stroke();
            }
        }
    }

    static _drawPlayerProjectile(p, ctx) {
        ctx.rotate(p.angle);
        const now = performance.now();

        // ── Determine effective weapon and visual state ────────────────
        const wk = p.weaponKind || (p.color === "#3b82f6" ? "auto" : "rifle");
        const isGolden = p.color === "#facc15"; // Ambush / Master buff
        const isCharged = p.symbol === "∑"; // Master charged release

        // ── KAO/AUTO Common: Base arrow/bullet geometry ──────────────────
        if (wk === "rifle" || wk === "sniper" || wk === "auto") {
            const isSniper = wk === "sniper";
            const isGold = isGolden || isCharged;

            const trailCol = isGold ? "rgba(250,204,21," : isSniper ? "rgba(244,63,94," : "rgba(59,130,246,";
            const glowCol = isGold ? "#facc15" : isSniper ? "#f43f5e" : "#3b82f6";
            const coreCol = isGold ? "#fef08a" : isSniper ? "#fda4af" : "#93c5fd";
            const edgeCol = isGold ? "#eab308" : isSniper ? "#be123c" : "#1d4ed8";

            const trailLen = isGold ? 38 : 28;
            const trailG = ctx.createLinearGradient(-trailLen, 0, 0, 0);
            trailG.addColorStop(0, trailCol + "0)");
            trailG.addColorStop(0.55, trailCol + "0.15)");
            trailG.addColorStop(1, trailCol + "0.42)");
            ctx.globalAlpha = 1;
            ctx.strokeStyle = trailG;
            ctx.lineWidth = isGold ? 10 : 7;
            ctx.lineCap = "butt";
            ctx.shadowBlur = isGold ? 18 : 10;
            ctx.shadowColor = glowCol;
            ctx.beginPath();
            ctx.moveTo(-trailLen, 0);
            ctx.lineTo(0, 0);
            ctx.stroke();
            ctx.shadowBlur = 0;

            const BW = isGold ? 15 : 11;
            const BL = isGold ? 22 : 16;
            const grad = ctx.createLinearGradient(-4, 0, BL, 0);
            grad.addColorStop(0, edgeCol);
            grad.addColorStop(0.35, coreCol);
            grad.addColorStop(0.75, isGold ? "#c89a00" : "#2280a8");
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalAlpha = 0.96;
            ctx.fillStyle = grad;
            ctx.shadowBlur = isGold ? 22 : 14;
            ctx.shadowColor = glowCol;
            ctx.beginPath();
            ctx.moveTo(-4, -BW * 0.3);
            ctx.bezierCurveTo(BL * 0.2, -BW * 0.8, BL * 0.55, -BW * 0.6, BL, 0);
            ctx.bezierCurveTo(
                BL * 0.55,
                BW * 0.38,
                BL * 0.22,
                BW * 0.62,
                -4,
                BW * 0.3,
            );
            ctx.closePath();
            ctx.fill();

            ctx.globalAlpha = 0.82;
            ctx.strokeStyle = isGold ? "#ffffff" : "#e8f8ff";
            ctx.lineWidth = 0.9;
            ctx.lineCap = "round";
            ctx.shadowBlur = 6;
            ctx.shadowColor = edgeCol;
            ctx.beginPath();
            ctx.moveTo(-2, BW * 0.05);
            ctx.bezierCurveTo(
                BL * 0.22,
                BW * 0.3,
                BL * 0.55,
                BW * 0.18,
                BL * 0.92,
                0,
            );
            ctx.stroke();

            const wavePhase = (now / 100) % (Math.PI * 2);
            const wR1 = 10 + Math.sin(wavePhase) * 2.5;
            ctx.globalAlpha = 0.38 + Math.sin(wavePhase) * 0.18;
            ctx.strokeStyle = coreCol;
            ctx.lineWidth = 1.4;
            ctx.shadowBlur = 10;
            ctx.shadowColor = glowCol;
            ctx.beginPath();
            ctx.arc(BL + 4, 0, wR1, -Math.PI * 0.55, Math.PI * 0.55);
            ctx.stroke();
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = edgeCol;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(BL + 4, 0, wR1 + 5, -Math.PI * 0.48, Math.PI * 0.48);
            ctx.stroke();
            ctx.shadowBlur = 0;

            if (isGold) {
                ctx.globalAlpha = 0.72;
                ctx.strokeStyle = "#facc15";
                ctx.lineWidth = 1.6;
                ctx.shadowBlur = 20;
                ctx.shadowColor = "#facc15";
                ctx.beginPath();
                ctx.arc(0, 0, BW + 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = "#fef9c3";
                ctx.lineWidth = 0.9;
                ctx.shadowBlur = 8;
                for (let si = 0; si < 8; si++) {
                    const sa = (si / 8) * Math.PI * 2 + now / 400;
                    ctx.globalAlpha = 0.55 + Math.sin(now / 100 + si) * 0.35;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(sa) * (BW + 2), Math.sin(sa) * (BW + 2));
                    ctx.lineTo(Math.cos(sa) * (BW + 11), Math.sin(sa) * (BW + 11));
                    ctx.stroke();
                }
            }
            ctx.lineCap = "butt";

            // ── FALLBACK (unknown weaponKind) — glowing dot, no arrow ─────
        } else {
            const fw = p.isCrit || isGolden ? 5 : 3.5;
            ctx.fillStyle = isGolden ? "#facc15" : p.color || "#ffffff";
            ctx.shadowBlur = p.isCrit || isGolden ? 20 : 10;
            ctx.shadowColor = isGolden ? "#facc15" : p.color;
            ctx.beginPath();
            ctx.arc(0, 0, fw, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    static _drawEnemyProjectile(p, ctx) {
        ctx.rotate(p.angle);
        const now = performance.now();
        const symSize = p.size || 14;
        const hexR = symSize * 0.85;

        const coronaG = ctx.createRadialGradient(
            0,
            0,
            hexR * 0.3,
            0,
            0,
            hexR * 1.8,
        );
        const colStr = p.color || 'rgba(220,38,38,1)';
        coronaG.addColorStop(
            0,
            colStr.replace(")", ",0.35)").replace("rgb", "rgba")
        );
        coronaG.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = coronaG;
        ctx.globalAlpha = 0.6 + Math.sin(now / 180) * 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, hexR * 1.8, 0, Math.PI * 2);
        ctx.fill();

        const hexRot = (now / 600) % (Math.PI * 2);
        ctx.save();
        ctx.rotate(hexRot);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.45 + Math.sin(now / 220) * 0.25;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        for (let hi = 0; hi < 6; hi++) {
            const ha = (hi / 6) * Math.PI * 2;
            if (hi === 0) ctx.moveTo(Math.cos(ha) * hexR, Math.sin(ha) * hexR);
            else ctx.lineTo(Math.cos(ha) * hexR, Math.sin(ha) * hexR);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        for (let hi = 0; hi < 6; hi += 2) {
            const ha = (hi / 6) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(Math.cos(ha) * hexR, Math.sin(ha) * hexR, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 14;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${symSize}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 3;
        ctx.strokeText(p.symbol, 0, 0);
        ctx.fillText(p.symbol, 0, 0);
        ctx.shadowBlur = 0;
    }
}

window.ProjectileRenderer = ProjectileRenderer;
