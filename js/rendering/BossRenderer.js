'use strict';
/**
 * js/rendering/BossRenderer.js
 *
 * BossRenderer — Canvas draw calls for all boss entities.
 *
 * Entry point: BossRenderer.draw(entity, ctx)
 *   Dispatches to the correct static method via instanceof.
 *   KruFirst checked first — both extend BossBase so order matters.
 *
 * Depends on: BossBase.js, ManopBoss.js, FirstBoss.js (all must load first)
 * Loaded after: FirstBoss.js
 */

// ════════════════════════════════════════════════════════════
// BossRenderer — Canvas draw calls for all boss entities
//
// Owns every ctx.* draw call previously inside each boss class.
// Godot equivalent: AnimatedSprite2D / Node2D children that own
// no game state and are driven by the parent Node's exported vars.
//
// Entry point: BossRenderer.draw(entity, ctx)
//   Dispatches to the correct static method via instanceof.
//   BossFirst is checked first — it extends Entity like Boss does
//   but is a distinct class, so order matters.
// ════════════════════════════════════════════════════════════
class BossRenderer {

    // ── Dispatcher ───────────────────────────────────────────
    // Call this from the game loop instead of boss.draw().
    // KruFirst checked before KruManop — both extend BossBase,
    // so instanceof KruManop would also match BossBase.
    static draw(e, ctx) {
        if (e instanceof KruFirst) BossRenderer.drawBossFirst(e, ctx);
        else if (e instanceof KruManop) BossRenderer.drawBoss(e, ctx);
        else if (e instanceof BossDog) BossRenderer.drawBossDog(e, ctx);
    }

    // ── Shared: polished rounded HP bar ──────────────────────
    // ctx must be in the coordinate space where (cx, cy) is the
    // bar's top-left corner (typically after translate to screen pos).
    static _drawBossHpBar(ctx, e, cx, cy, barW, barH, label, now) {
        const hpPct = Math.max(0, e.hp / e.maxHp);
        const hpCol = hpPct > 0.55 ? '#39ff14' : hpPct > 0.28 ? '#fbbf24' : '#ef4444';

        // Shadow border
        ctx.fillStyle = 'rgba(0,0,0,0.70)';
        ctx.beginPath(); ctx.roundRect(cx - 1, cy - 1, barW + 2, barH + 2, 3); ctx.fill();

        // HP fill
        if (hpPct > 0) {
            ctx.shadowBlur = 7; ctx.shadowColor = hpCol;
            ctx.fillStyle = hpCol;
            ctx.beginPath(); ctx.roundRect(cx, cy, barW * hpPct, barH, 3); ctx.fill();
            // Sheen — top highlight strip
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath(); ctx.roundRect(cx, cy, barW * hpPct, barH * 0.38, 2); ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Low-HP flicker border
        if (hpPct < 0.28) {
            const lA = 0.50 + Math.sin(now / 85) * 0.38;
            ctx.save();
            ctx.globalAlpha = lA;
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.6;
            ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
            ctx.beginPath(); ctx.roundRect(cx - 1, cy - 1, barW + 2, barH + 2, 3); ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // Label
        if (label) {
            ctx.save();
            ctx.globalAlpha = 0.88;
            ctx.font = `bold 9px "Orbitron",Arial,sans-serif`;
            ctx.textAlign = 'center';
            const labelCol = e.isEnraged ? '#ef4444' : hpCol;
            ctx.fillStyle = labelCol;
            ctx.shadowBlur = 7; ctx.shadowColor = labelCol;
            ctx.fillText(label, cx + barW / 2, cy - 5);
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }

    // ── Shared: low-HP danger pulse ring ─────────────────────
    // Must be called inside a block translated to entity centre.
    static _drawBossLowHpGlow(ctx, e, R, now) {
        if (!e.maxHp) return;
        const ratio = e.hp / e.maxHp;
        if (ratio >= 0.30) return;
        const severity = 1 - ratio / 0.30;
        const pulse = 0.28 + Math.sin(now / 95) * 0.22;
        ctx.save();
        ctx.globalAlpha = pulse * severity;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.5;
        ctx.shadowBlur = 24 + Math.sin(now / 75) * 10;
        ctx.shadowColor = '#ef4444';
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.arc(0, 0, R + 14 + Math.sin(now / 90) * 4, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }


    static drawBossDog(e, ctx) {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  BOSS DOG — Hellhound Combat Summon (Dog Rider's Beast) ║
        // ║  4-legged dog anatomy · Fangs · Pointed ears · Hellfire ║
        // ╚══════════════════════════════════════════════════════════╝
        if (e.dead) return;
        const screen = worldToScreen(e.x, e.y);
        const now = performance.now();
        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

        // ── HP bar ────────────────────────────────────────────────────
        {
            const barW = 66, barH = 6;
            BossRenderer._drawBossHpBar(
                ctx, e,
                screen.x - barW / 2, screen.y - 62,
                barW, barH, 'DOG', now
            );
        }

        // ── Ground shadow ─────────────────────────────────────────────
        ctx.save();
        ctx.globalAlpha = 0.26;
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.beginPath(); ctx.ellipse(screen.x + 4, screen.y + 34, 42, 9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── Main body transform (flip when facing left) ───────────────
        ctx.save();
        ctx.translate(screen.x, screen.y);
        if (isFacingLeft) ctx.scale(-1, 1);

        const breathe = Math.sin(now / 235);
        ctx.scale(1 + breathe * 0.016, 1 - breathe * 0.016);

        const R = e.radius;
        const legCycle = e.legTimer;
        const t = now / 1000;

        // ── Color palette ─────────────────────────────────────────────
        const furDark = '#2d1205';
        const furMid = '#6b3010';
        const furBase = '#a04818';
        const furBelly = '#d88040';

        // ── Leg-drawing helper (closure over ctx / legCycle / R) ──────
        const drawDogLeg = (pivX, pivY, phase, behind) => {
            const swing = Math.sin(legCycle * 9 + phase) * 0.28;
            const thighL = R * 0.60;
            const shinL = R * 0.50;
            const kx = pivX + Math.sin(swing) * thighL;
            const ky = pivY + Math.cos(swing) * thighL;
            const px = kx - Math.sin(swing * 0.3) * shinL * 0.22;
            const py = ky + shinL * 0.88;

            ctx.globalAlpha = behind ? 0.65 : 1.0;
            ctx.lineCap = 'round';
            // Thigh
            ctx.strokeStyle = behind ? furDark : furMid;
            ctx.lineWidth = R * (behind ? 0.36 : 0.42);
            ctx.beginPath(); ctx.moveTo(pivX, pivY); ctx.lineTo(kx, ky); ctx.stroke();
            // Shin
            ctx.strokeStyle = furDark;
            ctx.lineWidth = R * (behind ? 0.26 : 0.30);
            ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(px, py); ctx.stroke();
            // Paw
            ctx.fillStyle = furDark;
            ctx.shadowBlur = behind ? 0 : 5; ctx.shadowColor = 'rgba(220,38,38,0.35)';
            ctx.beginPath(); ctx.ellipse(px, py, R * 0.17, R * 0.11, swing * 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
            // Claws
            ctx.strokeStyle = '#150500'; ctx.lineWidth = 1.4;
            for (let c = -1; c <= 1; c++) {
                ctx.beginPath();
                ctx.moveTo(px + c * R * 0.08, py + R * 0.09);
                ctx.lineTo(px + c * R * 0.09, py + R * 0.21);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        };

        // ── Back legs (drawn behind body) ─────────────────────────────
        drawDogLeg(-R * 0.60, R * 0.46, Math.PI, true);
        drawDogLeg(-R * 0.40, R * 0.46, 0, true);

        // ── Tail ──────────────────────────────────────────────────────
        const tailWag = Math.sin(legCycle * 11) * R * 0.24;
        ctx.strokeStyle = furMid; ctx.lineWidth = R * 0.22; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-R * 1.05, R * 0.06);
        ctx.quadraticCurveTo(-R * 1.52, -R * 0.32 + tailWag * 0.38, -R * 1.72, -R * 0.76 + tailWag);
        ctx.stroke();
        ctx.fillStyle = furBase;
        ctx.beginPath(); ctx.arc(-R * 1.72, -R * 0.76 + tailWag, R * 0.15, 0, Math.PI * 2); ctx.fill();

        // ── Main torso ────────────────────────────────────────────────
        const bodyG = ctx.createRadialGradient(-R * 0.18, -R * 0.08, 0, R * 0.05, R * 0.10, R * 1.10);
        bodyG.addColorStop(0, furBelly);
        bodyG.addColorStop(0.38, furBase);
        bodyG.addColorStop(0.72, furMid);
        bodyG.addColorStop(1, furDark);
        ctx.fillStyle = bodyG; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.ellipse(R * 0.05, R * 0.10, R * 1.05, R * 0.54, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = furDark; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.ellipse(R * 0.05, R * 0.10, R * 1.05, R * 0.54, 0, 0, Math.PI * 2); ctx.stroke();

        // Belly lighter patch
        ctx.fillStyle = 'rgba(210,140,70,0.32)';
        ctx.beginPath(); ctx.ellipse(R * 0.10, R * 0.26, R * 0.52, R * 0.23, 0, 0, Math.PI * 2); ctx.fill();

        // Fur texture lines
        ctx.strokeStyle = 'rgba(45,18,5,0.28)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
        for (let fi = -2; fi <= 2; fi++) {
            const fx = fi * R * 0.26;
            ctx.beginPath(); ctx.moveTo(fx, -R * 0.38); ctx.lineTo(fx + R * 0.07, -R * 0.52); ctx.stroke();
        }

        // ── Spiked collar ─────────────────────────────────────────────
        const collarCX = R * 0.82, collarCY = -R * 0.04, collarR = R * 0.60;
        ctx.lineWidth = 7; ctx.strokeStyle = '#1a0d00';
        ctx.beginPath(); ctx.arc(collarCX, collarCY, collarR, -Math.PI * 0.60, Math.PI * 0.60); ctx.stroke();
        ctx.lineWidth = 5; ctx.strokeStyle = '#4a2000';
        ctx.beginPath(); ctx.arc(collarCX, collarCY, collarR, -Math.PI * 0.60, Math.PI * 0.60); ctx.stroke();
        const spikeCount = 7;
        for (let si = 0; si < spikeCount; si++) {
            const sa = -Math.PI * 0.54 + (si / (spikeCount - 1)) * Math.PI * 1.08;
            const iR = collarR - 2, oR = collarR + 7;
            ctx.fillStyle = si % 2 === 0 ? '#6b3500' : '#7c4010';
            ctx.strokeStyle = '#1a0d00'; ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(collarCX + Math.cos(sa - 0.20) * iR, collarCY + Math.sin(sa - 0.20) * iR);
            ctx.lineTo(collarCX + Math.cos(sa) * oR, collarCY + Math.sin(sa) * oR);
            ctx.lineTo(collarCX + Math.cos(sa + 0.20) * iR, collarCY + Math.sin(sa + 0.20) * iR);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }

        // ── Neck bridge ───────────────────────────────────────────────
        ctx.fillStyle = furMid;
        ctx.beginPath(); ctx.ellipse(R * 0.82, -R * 0.02, R * 0.27, R * 0.36, 0, 0, Math.PI * 2); ctx.fill();

        // ── Head ──────────────────────────────────────────────────────
        const headG = ctx.createRadialGradient(R * 1.05, -R * 0.28, 0, R * 1.18, -R * 0.16, R * 0.58);
        headG.addColorStop(0, furBase);
        headG.addColorStop(0.52, furMid);
        headG.addColorStop(1, furDark);
        ctx.fillStyle = headG; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.ellipse(R * 1.18, -R * 0.16, R * 0.57, R * 0.50, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = furDark; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.ellipse(R * 1.18, -R * 0.16, R * 0.57, R * 0.50, 0, 0, Math.PI * 2); ctx.stroke();

        // ── Pointed ears (Doberman/Shepherd style) ────────────────────
        // Back ear (slightly darker, behind head)
        ctx.fillStyle = furDark; ctx.strokeStyle = furDark; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(R * 0.88, -R * 0.56);
        ctx.lineTo(R * 0.74, -R * 1.16);
        ctx.lineTo(R * 1.08, -R * 0.66);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(160,50,50,0.52)';
        ctx.beginPath();
        ctx.moveTo(R * 0.90, -R * 0.60);
        ctx.lineTo(R * 0.80, -R * 1.04);
        ctx.lineTo(R * 1.04, -R * 0.68);
        ctx.closePath(); ctx.fill();
        // Front ear
        ctx.fillStyle = furMid; ctx.strokeStyle = furDark; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(R * 1.26, -R * 0.60);
        ctx.lineTo(R * 1.18, -R * 1.20);
        ctx.lineTo(R * 1.56, -R * 0.68);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(180,65,65,0.58)';
        ctx.beginPath();
        ctx.moveTo(R * 1.28, -R * 0.62);
        ctx.lineTo(R * 1.22, -R * 1.08);
        ctx.lineTo(R * 1.50, -R * 0.70);
        ctx.closePath(); ctx.fill();

        // ── Snout ─────────────────────────────────────────────────────
        ctx.fillStyle = furBelly; ctx.strokeStyle = furDark; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.ellipse(R * 1.68, R * 0.06, R * 0.37, R * 0.24, 0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Snout centre divide
        ctx.strokeStyle = furDark; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(R * 1.68, -R * 0.15); ctx.lineTo(R * 1.68, R * 0.08); ctx.stroke();

        // ── Nose ──────────────────────────────────────────────────────
        ctx.fillStyle = '#0a0300';
        ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.beginPath(); ctx.ellipse(R * 1.96, -R * 0.04, R * 0.13, R * 0.09, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(R * 1.92, -R * 0.08, R * 0.04, 0, Math.PI * 2); ctx.fill();

        // ── Mouth + fangs ─────────────────────────────────────────────
        ctx.strokeStyle = furDark; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(R * 1.68, R * 0.06); ctx.lineTo(R * 1.68, R * 0.22); ctx.stroke();
        ctx.fillStyle = '#f5f0ec';
        ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(255,200,180,0.5)';
        // Left fang
        ctx.beginPath();
        ctx.moveTo(R * 1.57, R * 0.18); ctx.lineTo(R * 1.53, R * 0.35); ctx.lineTo(R * 1.65, R * 0.18);
        ctx.closePath(); ctx.fill();
        // Right fang
        ctx.beginPath();
        ctx.moveTo(R * 1.74, R * 0.18); ctx.lineTo(R * 1.70, R * 0.34); ctx.lineTo(R * 1.82, R * 0.18);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        // Tongue
        ctx.fillStyle = '#fb7185';
        ctx.beginPath(); ctx.ellipse(R * 1.67, R * 0.37, R * 0.12, R * 0.14, 0, 0, Math.PI * 2); ctx.fill();

        // ── Glowing red eyes with slit pupils ────────────────────────
        const eyePulse = 0.80 + Math.sin(now / 175) * 0.20;
        // Socket shadow
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath(); ctx.ellipse(R * 1.36, -R * 0.32, R * 0.20, R * 0.16, -0.25, 0, Math.PI * 2); ctx.fill();
        // Iris glow
        ctx.fillStyle = `rgba(220,38,38,${eyePulse})`;
        ctx.shadowBlur = 16 * eyePulse; ctx.shadowColor = '#ef4444';
        ctx.beginPath(); ctx.ellipse(R * 1.36, -R * 0.32, R * 0.16, R * 0.14, -0.25, 0, Math.PI * 2); ctx.fill();
        // Slit pupil
        ctx.fillStyle = '#0a0000'; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.ellipse(R * 1.36, -R * 0.32, R * 0.05, R * 0.14, -0.25, 0, Math.PI * 2); ctx.fill();
        // Eye shine
        ctx.fillStyle = 'rgba(255,255,255,0.72)';
        ctx.beginPath(); ctx.arc(R * 1.30, -R * 0.38, R * 0.04, 0, Math.PI * 2); ctx.fill();

        // ── Battle scars on body ──────────────────────────────────────
        ctx.strokeStyle = 'rgba(45,18,5,0.52)'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-R * 0.22, -R * 0.26); ctx.lineTo(-R * 0.08, -R * 0.16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R * 0.32, -R * 0.36); ctx.lineTo(R * 0.44, -R * 0.22); ctx.stroke();

        // ── Front legs (drawn in front of body) ───────────────────────
        drawDogLeg(R * 0.62, R * 0.50, 0, false);
        drawDogLeg(R * 0.82, R * 0.50, Math.PI, false);

        // ── Hellfire ember particles ───────────────────────────────────
        ctx.save();
        for (let i = 0; i < 6; i++) {
            const ea = t * 0.72 + i * 1.047;
            const eRad = R * 0.70 + Math.abs(Math.sin(t * 2.2 + i * 1.7)) * R * 0.22;
            const ex = Math.cos(ea) * eRad * 1.35;
            const ey = Math.sin(ea) * eRad * 0.52;
            const eps = 2.2 + Math.abs(Math.sin(t * 1.8 + i * 2.1)) * 1.6;
            ctx.globalAlpha = 0.36 + Math.abs(Math.sin(t * 1.3 + i)) * 0.34;
            ctx.fillStyle = ['#ef4444', '#f97316', '#facc15'][i % 3];
            ctx.shadowBlur = 9; ctx.shadowColor = '#ef4444';
            ctx.beginPath(); ctx.arc(ex, ey, eps, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // ── Low-HP danger glow ────────────────────────────────────────
        BossRenderer._drawBossLowHpGlow(ctx, e, R, now);

        ctx.restore(); // end body transform
    }

    // ── Boss (ครูมานพ) — Physics Teacher ─────────────────────
    static drawBoss(e, ctx) {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  KRU MANOP — The Math Boss · Chibi Strict Teacher       ║
        // ║  Dark-grey bean · Suit+tie · Glowing glasses · Ruler    ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(e.x, e.y);
        const now = performance.now();
        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

        ctx.save();
        ctx.translate(screen.x, screen.y);

        // ── Charging scale pulse (log457) ─────────────────────────────
        if (e.log457State === 'charging') {
            const sc = 1 + (e.log457Timer / 2) * 0.3;
            ctx.scale(sc, sc);
            const pu = Math.sin(e.log457Timer * 12) * 0.5 + 0.5;
            // Healing green aura
            const healG = ctx.createRadialGradient(0, 0, 40, 0, 0, 90);
            healG.addColorStop(0, `rgba(74,222,128,${pu * 0.30})`);
            healG.addColorStop(0.6, `rgba(34,197,94,${pu * 0.20})`);
            healG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = healG;
            ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.fill();
            // Pulsing ring
            ctx.shadowBlur = 28 * pu; ctx.shadowColor = '#4ade80';
            ctx.strokeStyle = `rgba(74,222,128,${pu * 0.75})`; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke();
            // Spinning rune circles
            ctx.save(); ctx.rotate(now * 0.006);
            ctx.strokeStyle = `rgba(134,239,172,${pu * 0.55})`; ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 12]);
            ctx.beginPath(); ctx.arc(0, 0, 82, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]); ctx.restore();
            // Text: log 4.57 =?
            ctx.save();
            ctx.font = 'bold 11px "Courier New",monospace';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.globalAlpha = pu * 0.75;
            ctx.fillStyle = '#86efac'; ctx.shadowBlur = 6; ctx.shadowColor = '#4ade80';
            ctx.fillText('log 4.57 = ?', 0, -94);
            ctx.shadowBlur = 0; ctx.restore();
            ctx.shadowBlur = 0;
        }
        if (e.log457State === 'active') {
            // Gold aura burst
            const activePulse = 0.5 + Math.sin(now / 55) * 0.5;
            ctx.shadowBlur = 30 * activePulse; ctx.shadowColor = '#facc15';
            const actG = ctx.createRadialGradient(0, 0, 30, 0, 0, 80);
            actG.addColorStop(0, `rgba(251,191,36,${activePulse * 0.25})`);
            actG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = actG;
            ctx.beginPath(); ctx.arc(0, 0, 80, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(251,191,36,${activePulse * 0.60})`; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke();
        }
        if (e.log457State === 'stunned') {
            ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText('😵', 0, -78);
            // Stunned visual: greyed-out dashed ring
            ctx.strokeStyle = 'rgba(148,163,184,0.50)'; ctx.lineWidth = 2;
            ctx.setLineDash([8, 10]);
            ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        }
        if (e.state === 'ULTIMATE') {
            const ultTimer = e.timer;
            const wound = e._ultWound;
            if (!wound) {
                // ── Wind-up implosion (0 → 0.65s) ────────────────
                const windProg = Math.min(1, ultTimer / 0.65);
                const impPulse = 0.5 + Math.sin(now / 45) * 0.5;
                // Inward-pulling glow ring
                const impR = 72 + (1 - windProg) * 55;
                ctx.globalAlpha = windProg * (0.55 + impPulse * 0.40);
                ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 6 * windProg;
                ctx.shadowBlur = 28 * windProg; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.arc(0, 0, impR, 0, Math.PI * 2); ctx.stroke();
                // Inner contracted burst
                ctx.globalAlpha = windProg * impPulse * 0.50;
                ctx.fillStyle = '#fef2f2';
                ctx.beginPath(); ctx.arc(0, 0, 18 * windProg, 0, Math.PI * 2); ctx.fill();
                // Spinning red dashes
                ctx.save(); ctx.rotate(now * 0.012 * windProg);
                ctx.globalAlpha = windProg * 0.65;
                ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2.5;
                ctx.setLineDash([10, 18]);
                ctx.beginPath(); ctx.arc(0, 0, 58 * windProg + 14, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]); ctx.restore();
                ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            }
        }

        // ── Enhanced Power Aura (Phase-based) ────────────────────────
        const t3 = now / 600;
        const auraR = 80 + Math.sin(t3 * 2.5) * 10;

        if (e.phase === 1) {
            // Phase 1: Golden mathematical aura
            ctx.shadowBlur = 0;
            const grad1 = ctx.createRadialGradient(0, 0, auraR * 0.4, 0, 0, auraR);
            grad1.addColorStop(0, 'rgba(251,191,36,0.0)');
            grad1.addColorStop(0.7, 'rgba(251,191,36,0.15)');
            grad1.addColorStop(1, 'rgba(251,191,36,0.35)');
            ctx.fillStyle = grad1;
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(252,211,77,${0.45 + Math.sin(t3 * 3) * 0.25})`;
            ctx.lineWidth = 2.5; ctx.shadowBlur = 18; ctx.shadowColor = '#fbbf24';
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            for (let i = 0; i < 4; i++) {
                const bA = t3 * 1.5 + i * (Math.PI * 2 / 4);
                ctx.fillStyle = `rgba(254,240,138,${0.35 + Math.sin(t3 + i) * 0.25})`;
                ctx.shadowBlur = 8; ctx.shadowColor = '#fbbf24';
                ctx.beginPath(); ctx.arc(Math.cos(bA) * (auraR - 8), Math.sin(bA) * (auraR - 8), 4 + Math.sin(t3 * 2 + i) * 1.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
        } else if (e.phase === 2) {
            // Phase 2: Red enraged aura with energy crackling
            ctx.shadowBlur = 0;
            const grad2 = ctx.createRadialGradient(0, 0, auraR * 0.4, 0, 0, auraR);
            grad2.addColorStop(0, 'rgba(239,68,68,0.0)');
            grad2.addColorStop(0.7, 'rgba(239,68,68,0.20)');
            grad2.addColorStop(1, 'rgba(239,68,68,0.50)');
            ctx.fillStyle = grad2;
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(248,113,113,${0.55 + Math.sin(t3 * 4) * 0.35})`;
            ctx.lineWidth = 3; ctx.shadowBlur = 22; ctx.shadowColor = '#ef4444';
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.stroke();
            // Inner pulsing ring
            ctx.strokeStyle = `rgba(220,38,38,${0.40 + Math.sin(t3 * 5) * 0.30})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, auraR * 0.70, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            for (let i = 0; i < 6; i++) {
                const bA = t3 * 2.2 + i * (Math.PI * 2 / 6);
                ctx.fillStyle = `rgba(252,165,165,${0.40 + Math.sin(t3 * 1.5 + i) * 0.30})`;
                ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.arc(Math.cos(bA) * (auraR - 6), Math.sin(bA) * (auraR - 6), 5 + Math.sin(t3 * 3 + i) * 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
        } else if (e.phase === 3) {
            // Phase 3: Cyan water aura
            ctx.shadowBlur = 0;
            const grad3 = ctx.createRadialGradient(0, 0, auraR * 0.4, 0, 0, auraR);
            grad3.addColorStop(0, 'rgba(56,189,248,0.0)');
            grad3.addColorStop(0.7, 'rgba(56,189,248,0.18)');
            grad3.addColorStop(1, 'rgba(56,189,248,0.45)');
            ctx.fillStyle = grad3;
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(125,211,252,${0.5 + Math.sin(t3 * 3) * 0.3})`;
            ctx.lineWidth = 3; ctx.shadowBlur = 20; ctx.shadowColor = '#38bdf8';
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            for (let i = 0; i < 5; i++) {
                const bA = t3 * 1.8 + i * (Math.PI * 2 / 5);
                ctx.fillStyle = `rgba(186,230,253,${0.4 + Math.sin(t3 + i) * 0.3})`;
                ctx.beginPath(); ctx.arc(Math.cos(bA) * (auraR - 10), Math.sin(bA) * (auraR - 10), 5 + Math.sin(t3 * 2 + i) * 2, 0, Math.PI * 2); ctx.fill();
            }
        }

        // ── Orbiting Math Symbols ─────────────────────────────────────
        // π, Σ, ∞, ∂, ≈ orbit at varying radii and speeds, glowing white/gold
        const symbols = ['π', 'Σ', '∞', '∂', '≈', '∫'];
        const orbitR = 62;
        const baseSpeed = e.isEnraged ? 1.8 : 1.0;
        ctx.save();
        for (let i = 0; i < symbols.length; i++) {
            const angle = (now / 1000) * baseSpeed + (i / symbols.length) * Math.PI * 2;
            const ox = Math.cos(angle) * orbitR;
            const oy = Math.sin(angle) * (orbitR * 0.55); // elliptical orbit
            const alpha = 0.55 + Math.sin(now / 300 + i * 1.2) * 0.35;
            const gCol = e.phase === 3 ? '#38bdf8'
                : e.isEnraged ? '#ef4444'
                    : '#facc15';
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(-e.angle); // keep text readable
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${14 + Math.sin(now / 400 + i) * 2}px Arial`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 12 + Math.sin(now / 250 + i) * 5;
            ctx.shadowColor = gCol;
            ctx.fillStyle = gCol;
            ctx.fillText(symbols[i], 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.restore();

        // ── Body Block (Body Anti-Flip) ───────────────────────────────
        ctx.save();
        if (isFacingLeft) ctx.scale(-1, 1);

        // Boss breathing
        const breathe = Math.sin(now / 260);
        const scaleX = 1 + breathe * 0.018;
        const scaleY = 1 - breathe * 0.022;
        ctx.scale(scaleX, scaleY);

        const R = BALANCE.boss.radius;

        // ── Phase 2 enrage glow ring ──────────────────────────────────
        if (e.phase === 2 && e.log457State !== 'charging') {
            ctx.shadowBlur = 22; ctx.shadowColor = '#ef4444';
            ctx.strokeStyle = 'rgba(220,38,38,0.55)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, R + 5, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // ── Silhouette glow ring ──────────────────────────────────────
        const glowCol = e.phase === 3 ? 'rgba(56,189,248,0.50)'
            : e.isEnraged ? 'rgba(220,38,38,0.55)'
                : 'rgba(148,163,184,0.40)';
        const shadowC = e.phase === 3 ? '#38bdf8'
            : e.isEnraged ? '#ef4444' : '#94a3b8';
        ctx.shadowBlur = 16; ctx.shadowColor = shadowC;
        ctx.strokeStyle = glowCol; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // ── Bean body — tall dark-grey gradient (slightly taller) ─────
        ctx.save(); ctx.scale(0.92, 1.12); // tall bean
        const bodyG = ctx.createRadialGradient(-R * 0.25, -R * 0.30, 1, 0, 0, R);
        bodyG.addColorStop(0, '#374151');
        bodyG.addColorStop(0.55, '#1f2937');
        bodyG.addColorStop(1, '#111827');
        ctx.fillStyle = bodyG;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore(); // end tall scale

        // Specular highlight
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.32, R * 0.28, 0, Math.PI * 2); ctx.fill();

        // ── Suit jacket (dark navy vest panels) ──────────────────────
        // Left lapel
        ctx.fillStyle = '#1e2d40';
        ctx.beginPath();
        ctx.moveTo(-R * 0.08, -R * 0.48);
        ctx.lineTo(-R * 0.55, -R * 0.15);
        ctx.lineTo(-R * 0.52, R * 0.50);
        ctx.lineTo(-R * 0.05, R * 0.52);
        ctx.closePath(); ctx.fill();
        // Right lapel
        ctx.beginPath();
        ctx.moveTo(R * 0.08, -R * 0.48);
        ctx.lineTo(R * 0.55, -R * 0.15);
        ctx.lineTo(R * 0.52, R * 0.50);
        ctx.lineTo(R * 0.05, R * 0.52);
        ctx.closePath(); ctx.fill();

        // Jacket sticker outlines
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-R * 0.08, -R * 0.48); ctx.lineTo(-R * 0.55, -R * 0.15); ctx.lineTo(-R * 0.52, R * 0.50);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(R * 0.08, -R * 0.48); ctx.lineTo(R * 0.55, -R * 0.15); ctx.lineTo(R * 0.52, R * 0.50);
        ctx.stroke();

        // Suit buttons — 3 small dark dots down centre seam
        ctx.fillStyle = '#111827';
        for (let bi = 0; bi < 3; bi++) {
            ctx.beginPath(); ctx.arc(0, -R * 0.1 + bi * R * 0.25, 2, 0, Math.PI * 2); ctx.fill();
        }

        // ── Red necktie — diamond/wedge down the centre chest ────────
        const tieCol = e.isEnraged ? '#ef4444' : '#dc2626';
        const tieGlow = e.isEnraged ? 0.55 : 0;
        ctx.fillStyle = tieCol;
        ctx.shadowBlur = 8 * (tieGlow + 0.2); ctx.shadowColor = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.48);       // knot top
        ctx.lineTo(R * 0.10, -R * 0.30);
        ctx.lineTo(R * 0.07, R * 0.48); // tip
        ctx.lineTo(0, R * 0.55);
        ctx.lineTo(-R * 0.07, R * 0.48);
        ctx.lineTo(-R * 0.10, -R * 0.30);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.48); ctx.lineTo(R * 0.10, -R * 0.30);
        ctx.lineTo(R * 0.07, R * 0.48); ctx.lineTo(0, R * 0.55);
        ctx.lineTo(-R * 0.07, R * 0.48); ctx.lineTo(-R * 0.10, -R * 0.30);
        ctx.closePath(); ctx.stroke();
        ctx.shadowBlur = 0;

        // Tie knot
        ctx.fillStyle = e.isEnraged ? '#b91c1c' : '#991b1b';
        ctx.beginPath(); ctx.ellipse(0, -R * 0.42, R * 0.09, R * 0.06, 0, 0, Math.PI * 2); ctx.fill();

        // ── Neat Combed Hair (covers upper ~50% of bean) ──────────────
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(-R * 0.88, -R * 0.04);
        ctx.quadraticCurveTo(-R * 1.05, -R * 0.65, -R * 0.42, -R - 6);
        ctx.quadraticCurveTo(0, -R - 9, R * 0.42, -R - 6);
        ctx.quadraticCurveTo(R * 1.05, -R * 0.65, R * 0.88, -R * 0.04);
        ctx.quadraticCurveTo(R * 0.50, R * 0.04, 0, R * 0.05);
        ctx.quadraticCurveTo(-R * 0.50, R * 0.04, -R * 0.88, -R * 0.04);
        ctx.closePath(); ctx.fill();

        // Hair sticker outline
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-R * 0.88, -R * 0.04);
        ctx.quadraticCurveTo(-R * 1.05, -R * 0.65, -R * 0.42, -R - 6);
        ctx.quadraticCurveTo(0, -R - 9, R * 0.42, -R - 6);
        ctx.quadraticCurveTo(R * 1.05, -R * 0.65, R * 0.88, -R * 0.04);
        ctx.closePath(); ctx.stroke();

        // Strict centre parting
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.05);
        ctx.quadraticCurveTo(R * 0.04, -R * 0.50, 0, -R - 8);
        ctx.stroke();

        // Hair highlight (glossy strand)
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.moveTo(-R * 0.32, -R * 0.55);
        ctx.quadraticCurveTo(-R * 0.48, -R, -R * 0.22, -R - 6);
        ctx.quadraticCurveTo(-R * 0.10, -R - 2, -R * 0.18, -R * 0.48);
        ctx.quadraticCurveTo(-R * 0.22, -R * 0.28, -R * 0.32, -R * 0.55);
        ctx.closePath(); ctx.fill();

        // ── Glowing Square-Framed Glasses ────────────────────────────
        // Two square lens frames side-by-side across the "face zone"
        const glassGlow = e.isEnraged ? '#ef4444' : '#e0f2fe';
        const glassRefl = e.log457State === 'active' ? '#facc15' : '#e0f2fe';
        const lensW = R * 0.38, lensH = R * 0.28;
        const lensY = -R * 0.28;

        // Left lens
        ctx.shadowBlur = 14; ctx.shadowColor = glassGlow;
        ctx.fillStyle = `rgba(224,242,254,0.20)`;
        ctx.strokeStyle = glassGlow; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.roundRect(-R * 0.72, lensY - lensH / 2, lensW, lensH, 3); ctx.fill(); ctx.stroke();
        // Right lens
        ctx.beginPath(); ctx.roundRect(R * 0.34, lensY - lensH / 2, lensW, lensH, 3); ctx.fill(); ctx.stroke();
        // Bridge connecting lenses
        ctx.strokeStyle = glassGlow; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-R * 0.34, lensY); ctx.lineTo(R * 0.34, lensY); ctx.stroke();
        // Temple arms (go to sides)
        ctx.beginPath(); ctx.moveTo(-R * 0.72, lensY); ctx.lineTo(-R * 1.0, lensY + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R * 0.72, lensY); ctx.lineTo(R * 1.0, lensY + 2); ctx.stroke();

        // Lens reflections — bright diagonal highlight inside each lens
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,255,255,${0.55 + Math.sin(now / 280) * 0.30})`;
        // Left lens reflection
        ctx.beginPath(); ctx.ellipse(-R * 0.56, lensY - R * 0.06, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); ctx.fill();
        // Right lens reflection
        ctx.beginPath(); ctx.ellipse(R * 0.50, lensY - R * 0.06, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); ctx.fill();

        // ── Enraged phase fire particles (preserved) ──────────────────
        if (e.isEnraged) {
            const t = now / 80;
            const colA = e.phase === 3 ? '#fb923c' : '#ef4444';
            const colB = e.phase === 3 ? '#38bdf8' : '#f97316';
            for (let i = 0; i < 4; i++) {
                const px = Math.sin(t * 0.9 + i * 1.57) * 18;
                const py = -Math.abs(Math.cos(t * 1.1 + i * 1.57)) * 22 - 30;
                const ps = 3 + Math.sin(t + i) * 1.5;
                ctx.globalAlpha = 0.55 + Math.sin(t + i) * 0.3;
                ctx.fillStyle = i % 2 === 0 ? colA : colB;
                ctx.shadowBlur = 8; ctx.shadowColor = colA;
                ctx.beginPath(); ctx.arc(px, py, ps, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }

        // ── Low-HP danger glow ────────────────────────────────────────
        BossRenderer._drawBossLowHpGlow(ctx, e, R, now);

        ctx.restore(); // end body block

        // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
        ctx.save();
        ctx.rotate(e.angle);
        if (isFacingLeft) ctx.scale(1, -1);

        // ── Floating Hands — holding a glowing ruler / chalk ─────────
        // Front hand — holding ruler, forward weapon side
        ctx.fillStyle = '#2d3748'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(148,163,184,0.6)';
        ctx.beginPath(); ctx.arc(R + 7, 4, R * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Ruler extending from front hand
        const rulerGlow = e.state === 'ATTACK' || e.state === 'ULTIMATE' ? 1.0 : 0.55;
        ctx.fillStyle = '#f59e0b';
        ctx.shadowBlur = 12 * rulerGlow; ctx.shadowColor = '#fbbf24';
        ctx.beginPath(); ctx.roundRect(R + 9, 1, R * 1.6, R * 0.22, 2); ctx.fill();
        // Ruler tick marks
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
        for (let ti = 0; ti < 5; ti++) {
            const tx = R + 11 + ti * (R * 1.5 / 5);
            ctx.beginPath(); ctx.moveTo(tx, 1); ctx.lineTo(tx, 5); ctx.stroke();
        }
        ctx.fillStyle = '#000'; ctx.font = `bold ${R * 0.16}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('30cm', R + 9 + R * 0.8, R * 0.11 + 2);
        ctx.shadowBlur = 0;

        // Back hand — off-side, open palm
        ctx.fillStyle = '#374151'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(148,163,184,0.5)';
        ctx.beginPath(); ctx.arc(-(R + 7), 2, R * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.restore(); // end weapon block

        ctx.restore(); // end main translate
    }

    // ── BossFirst (ครูเฟิร์ส) — Physics Master ───────────────
    static drawBossFirst(e, ctx) {
        // ╔══════════════════════════════════════════════════════════════╗
        // ║  KRU FIRST — Physics Master                                 ║
        // ║  Agile chibi teacher · Jetpack · Holographic equation ring  ║
        // ║  Cyan science goggles · Neon-green tech vest · Hit-flash    ║
        // ╚══════════════════════════════════════════════════════════════╝

        // ── Draw active sandwich BEFORE the boss body (world space) ────
        if (e._activeSandwich && !e._activeSandwich.dead) {
            e._activeSandwich.draw();
        }

        // ── FREE_FALL invisible phase ───────────────────────────────────
        if (e.state === 'FREE_FALL' && e.stateTimer > 0.12) return;

        // ── Core setup ─────────────────────────────────────────────────
        const screen = worldToScreen(e.x, e.y);
        const now = performance.now();
        const t = now / 1000;

        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;
        const R = e.radius;

        // ── Hover animation ────────────────────────────────────────────
        const hoverY = Math.sin(now / 150) * 4;
        const hoverX = Math.sin(now / 230) * 1.2;

        ctx.save();
        ctx.translate(screen.x + hoverX, screen.y + hoverY);

        // ── LAYER 0 — Ground shadow ─────────────────────────────────────
        ctx.save();
        ctx.globalAlpha = 0.22 - Math.abs(hoverY) * 0.012;
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.beginPath();
        ctx.ellipse(0, R * 1.25 - hoverY * 0.4, R * 1.05, R * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ── LAYER 1 — Berserk aura ──────────────────────────────────────
        if (e.isEnraged) {
            ctx.save();
            const berserkT = t * 3.5;
            const berserkR = R * 1.85 + Math.sin(berserkT) * R * 0.18;
            const bAlpha = 0.22 + Math.sin(berserkT * 1.3) * 0.12;
            const bGrad = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, berserkR);
            bGrad.addColorStop(0, 'rgba(239,68,68,0)');
            bGrad.addColorStop(0.65, `rgba(239,68,68,${bAlpha})`);
            bGrad.addColorStop(1, `rgba(220,38,38,${bAlpha * 1.6})`);
            ctx.fillStyle = bGrad;
            ctx.beginPath(); ctx.arc(0, 0, berserkR, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 24; ctx.shadowColor = '#ef4444';
            ctx.strokeStyle = `rgba(239,68,68,${0.55 + Math.sin(berserkT * 2.1) * 0.35})`;
            ctx.lineWidth = 2.8;
            ctx.beginPath(); ctx.arc(0, 0, berserkR * 0.96, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            for (let fi = 0; fi < 6; fi++) {
                const fa = (fi / 6) * Math.PI * 2 + t * 1.8;
                const fBob = Math.sin(t * 4.2 + fi * 1.1) * R * 0.25;
                const fx1 = Math.cos(fa) * berserkR * 0.82;
                const fy1 = Math.sin(fa) * berserkR * 0.82;
                const fx2 = Math.cos(fa) * (berserkR + R * 0.38 + fBob);
                const fy2 = Math.sin(fa) * (berserkR + R * 0.38 + fBob);
                ctx.globalAlpha = 0.35 + Math.sin(t * 3.5 + fi) * 0.25;
                ctx.strokeStyle = fi % 2 === 0 ? '#ef4444' : '#fb923c';
                ctx.lineWidth = 2 + Math.sin(t * 5 + fi) * 1.0;
                ctx.lineCap = 'round';
                ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.moveTo(fx1, fy1); ctx.lineTo(fx2, fy2); ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.lineCap = 'butt';
            ctx.restore();
        }

        // ── LAYER 2 — Holographic equation ring ────────────────────────
        ctx.save();
        const ringR = R * 2.0;
        const ringCol = e.isEnraged ? '#ff4444' : '#39ff14';
        const ringGlow = e.isEnraged ? '#dc2626' : '#16a34a';

        // Outer ring
        ctx.save();
        ctx.rotate(t * 0.9);
        ctx.shadowBlur = 12; ctx.shadowColor = ringGlow;
        ctx.strokeStyle = `${ringCol}99`; ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 5]);
        ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        for (let ti = 0; ti < 12; ti++) {
            const ta = (ti / 12) * Math.PI * 2;
            const tLen = ti % 3 === 0 ? R * 0.18 : R * 0.09;
            ctx.strokeStyle = ti % 3 === 0 ? ringCol : `${ringCol}77`;
            ctx.lineWidth = ti % 3 === 0 ? 2.2 : 1.2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ta) * (ringR - tLen), Math.sin(ta) * (ringR - tLen));
            ctx.lineTo(Math.cos(ta) * ringR, Math.sin(ta) * ringR);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.restore();

        // Inner counter-rotating ring
        ctx.save();
        ctx.rotate(-(t * 0.55));
        ctx.shadowBlur = 8; ctx.shadowColor = ringGlow;
        ctx.strokeStyle = `${ringCol}55`; ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(0, 0, ringR * 0.72, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Orbiting formula labels
        const formulas = ['F=ma', 'v=u+at', 'E=mc²', 'p=mv', 'ω=v/r', 'h=½gt²'];
        const fOrbitR = ringR * 0.88;
        const fSpeed = e.isEnraged ? 1.35 : 0.72;
        for (let fi = 0; fi < formulas.length; fi++) {
            const fAngle = t * fSpeed + (fi / formulas.length) * Math.PI * 2;
            const fAlpha = 0.45 + Math.sin(t * 1.8 + fi * 0.9) * 0.30;
            ctx.save();
            ctx.translate(
                Math.cos(fAngle) * fOrbitR,
                Math.sin(fAngle) * fOrbitR * 0.55
            );
            ctx.rotate(-fAngle * 0.18);
            ctx.globalAlpha = fAlpha;
            ctx.font = `bold ${10 + Math.sin(t * 1.5 + fi) * 1.5}px "Orbitron",monospace,Arial`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10 + Math.sin(t * 2.2 + fi) * 5;
            ctx.shadowColor = ringGlow;
            ctx.fillStyle = ringCol;
            ctx.fillText(formulas[fi], 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.restore();

        // ── LAYER 3 — SUVAT charge ring ─────────────────────────────────
        if (e.state === 'SUVAT_CHARGE' && e.stateTimer <= e.SUVAT_WIND_UP) {
            ctx.save();
            const prog = Math.min(e.stateTimer / e.SUVAT_WIND_UP, 1);
            const cRingR = R * (1.15 + prog * 0.65);
            const pulse = Math.abs(Math.sin(now / 55));
            const cGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, cRingR);
            cGrad.addColorStop(0, `rgba(251,191,36,${prog * 0.18})`);
            cGrad.addColorStop(0.7, `rgba(251,191,36,${prog * 0.08})`);
            cGrad.addColorStop(1, 'rgba(251,191,36,0)');
            ctx.shadowBlur = 28 * prog; ctx.shadowColor = '#fbbf24';
            ctx.fillStyle = cGrad;
            ctx.beginPath(); ctx.arc(0, 0, cRingR, 0, Math.PI * 2); ctx.fill();
            ctx.rotate(t * 5.5);
            ctx.strokeStyle = `rgba(251,191,36,${0.5 + pulse * 0.45})`;
            ctx.lineWidth = 3.5 * prog;
            ctx.setLineDash([10, 6]);
            ctx.beginPath(); ctx.arc(0, 0, cRingR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;

            // ── Laser telegraph ──
            const aimScreen = worldToScreen(e._suvatAimX, e._suvatAimY);
            ctx.strokeStyle = `rgba(239, 68, 68, ${prog})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([15, 10]);
            ctx.beginPath();
            ctx.moveTo(0, 0); // Boss local center
            ctx.lineTo(aimScreen.x - (screen.x + hoverX), aimScreen.y - (screen.y + hoverY));
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.restore();
        }

        // ── BODY BLOCK (facing flip + breathe) ─────────────────────────
        ctx.save();
        if (isFacingLeft) ctx.scale(-1, 1);
        const breathe = Math.sin(now / 195);
        ctx.scale(1 + breathe * 0.022, 1 - breathe * 0.016);

        // ── LAYER 4 — Jetpack ───────────────────────────────────────────
        ctx.save();
        const jpX = -R * 0.72, jpY = -R * 0.12;
        const jpW = R * 0.55, jpH = R * 1.10;
        ctx.shadowBlur = 8; ctx.shadowColor = '#0e7490';
        const jpGrad = ctx.createLinearGradient(jpX - jpW / 2, 0, jpX + jpW / 2, 0);
        jpGrad.addColorStop(0, '#0f172a');
        jpGrad.addColorStop(0.4, '#1e293b');
        jpGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = jpGrad;
        ctx.beginPath(); ctx.roundRect(jpX - jpW / 2, jpY - jpH / 2, jpW, jpH, R * 0.14); ctx.fill();
        ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(jpX - jpW / 2, jpY - jpH / 2, jpW, jpH, R * 0.14); ctx.stroke();
        ctx.shadowBlur = 0;
        // Panel rivets
        ctx.fillStyle = '#334155';
        for (let ri = 0; ri < 2; ri++) for (let rj = 0; rj < 2; rj++) {
            ctx.beginPath();
            ctx.arc(jpX - jpW * 0.28 + ri * jpW * 0.56, jpY - jpH * 0.35 + rj * jpH * 0.70, 2.2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Energy cell
        const cellAlpha = 0.7 + Math.sin(t * 2.8) * 0.25;
        ctx.shadowBlur = 14; ctx.shadowColor = '#00ffff';
        ctx.fillStyle = `rgba(0,255,255,${cellAlpha * 0.55})`;
        ctx.beginPath(); ctx.roundRect(jpX - jpW * 0.22, jpY - jpH * 0.18, jpW * 0.44, jpH * 0.36, 3); ctx.fill();
        ctx.strokeStyle = `rgba(0,255,255,${cellAlpha})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(jpX - jpW * 0.22, jpY - jpH * 0.18, jpW * 0.44, jpH * 0.36, 3); ctx.stroke();
        ctx.shadowBlur = 0;
        // Nozzle flames
        const nozzleOffsets = [-jpW * 0.22, jpW * 0.22];
        for (let ni = 0; ni < 2; ni++) {
            const nx = jpX + nozzleOffsets[ni], ny = jpY + jpH / 2;
            const nW = jpW * 0.22, nH = R * 0.20;
            ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(nx - nW * 0.6, ny); ctx.lineTo(nx - nW * 0.85, ny + nH);
            ctx.lineTo(nx + nW * 0.85, ny + nH); ctx.lineTo(nx + nW * 0.6, ny);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff';
            ctx.strokeStyle = 'rgba(0,255,255,0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(nx, ny + 2, nW * 0.55, nW * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            // Outer flame — ENHANCED intensity
            const flameBoost = e.isEnraged ? 1.5 : 1.0;
            const flameLen = R * (0.70 + Math.sin(t * 8.5 + ni * 2.1) * 0.30 + Math.abs(Math.sin(t * 17.3 + ni * 3.7)) * 0.18) * flameBoost;
            const flameW = nW * (0.70 + Math.sin(t * 11.2 + ni * 1.7) * 0.25) * flameBoost;
            const fJitter = Math.sin(t * 13.1 + ni * 2.9) * 3.5;
            ctx.save();
            ctx.shadowBlur = e.isEnraged ? 35 : 28;
            ctx.shadowColor = e.isEnraged ? '#ef4444' : '#3b82f6';
            ctx.globalAlpha = 0.70 + Math.sin(t * 7.1 + ni) * 0.25;
            ctx.fillStyle = e.isEnraged ? '#ef4444' : '#3b82f6';
            ctx.beginPath();
            ctx.moveTo(nx - flameW * 1.3, ny + nH);
            ctx.quadraticCurveTo(nx + fJitter * 0.5, ny + nH + flameLen * 0.55, nx, ny + nH + flameLen * 1.7);
            ctx.quadraticCurveTo(nx + fJitter * 0.3, ny + nH + flameLen * 0.55, nx + flameW * 1.3, ny + nH);
            ctx.closePath(); ctx.fill();
            ctx.restore();
            // Cyan mid flame — ENHANCED
            ctx.save();
            const cLen = flameLen * 0.85, cW = flameW * 0.75;
            ctx.shadowBlur = e.isEnraged ? 24 : 20;
            ctx.shadowColor = e.isEnraged ? '#fb923c' : '#00ffff';
            ctx.globalAlpha = 0.75 + Math.sin(t * 9.3 + ni * 1.3) * 0.20;
            ctx.fillStyle = e.isEnraged ? '#fb923c' : '#00e5ff';
            ctx.beginPath();
            ctx.moveTo(nx - cW, ny + nH);
            ctx.quadraticCurveTo(nx, ny + nH + cLen * 0.5, nx, ny + nH + cLen * 1.25);
            ctx.quadraticCurveTo(nx, ny + nH + cLen * 0.5, nx + cW, ny + nH);
            ctx.closePath(); ctx.fill();
            ctx.restore();
            // White-hot core
            ctx.save();
            const wLen = flameLen * 0.45, wW = flameW * 0.28;
            ctx.shadowBlur = 14; ctx.shadowColor = '#ffffff';
            ctx.globalAlpha = 0.85 + Math.sin(t * 13 + ni) * 0.12;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(nx - wW, ny + nH);
            ctx.quadraticCurveTo(nx, ny + nH + wLen * 0.4, nx, ny + nH + wLen);
            ctx.quadraticCurveTo(nx, ny + nH + wLen * 0.4, nx + wW, ny + nH);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.restore(); // end jetpack

        // ── LAYER 5 — Silhouette glow ring ─────────────────────────────
        const mainCol = e.isEnraged ? '#ef4444' : '#39ff14';
        const glowShadow = e.isEnraged ? '#dc2626' : '#16a34a';
        ctx.shadowBlur = 18; ctx.shadowColor = glowShadow;
        ctx.strokeStyle = `${mainCol}66`; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // ── LAYER 6 — Bean body ─────────────────────────────────────────
        ctx.save(); ctx.scale(0.90, 1.10);
        const bodyDark = e.isEnraged ? '#2d0a0a' : '#0a1a08';
        const bodyMid = e.isEnraged ? '#3f0e0e' : '#0f2d0c';
        const bodyG = ctx.createRadialGradient(-R * 0.22, -R * 0.25, 1, 0, 0, R);
        bodyG.addColorStop(0, bodyDark);
        bodyG.addColorStop(0.5, bodyMid);
        bodyG.addColorStop(1, '#050c04');
        ctx.fillStyle = bodyG;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0a1a08'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        // ── LAYER 7 — Khaki uniform + dark-grey tech vest ──────────────
        ctx.fillStyle = '#d4b886';
        ctx.beginPath();
        ctx.moveTo(-R * 0.85, -R * 0.42);
        ctx.quadraticCurveTo(-R * 1.0, -R * 0.12, -R * 0.88, R * 0.18);
        ctx.lineTo(-R * 0.62, R * 0.22); ctx.lineTo(-R * 0.58, -R * 0.46);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(R * 0.85, -R * 0.42);
        ctx.quadraticCurveTo(R * 1.0, -R * 0.12, R * 0.88, R * 0.18);
        ctx.lineTo(R * 0.62, R * 0.22); ctx.lineTo(R * 0.58, -R * 0.46);
        ctx.closePath(); ctx.fill();
        // Tech vest panels
        ctx.fillStyle = '#1c2533';
        ctx.beginPath();
        ctx.moveTo(-R * 0.08, -R * 0.52); ctx.lineTo(-R * 0.58, -R * 0.18);
        ctx.lineTo(-R * 0.55, R * 0.52); ctx.lineTo(-R * 0.06, R * 0.54);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(R * 0.08, -R * 0.52); ctx.lineTo(R * 0.58, -R * 0.18);
        ctx.lineTo(R * 0.55, R * 0.52); ctx.lineTo(R * 0.06, R * 0.54);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-R * 0.08, -R * 0.52); ctx.lineTo(-R * 0.58, -R * 0.18); ctx.lineTo(-R * 0.55, R * 0.52);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(R * 0.08, -R * 0.52); ctx.lineTo(R * 0.58, -R * 0.18); ctx.lineTo(R * 0.55, R * 0.52);
        ctx.stroke();
        // Chest stripe — enhanced glow
        const stripeCol = e.isEnraged ? '#ef4444' : '#39ff14';
        ctx.shadowBlur = e.isEnraged ? 12 : 10; ctx.shadowColor = stripeCol; ctx.fillStyle = stripeCol;
        ctx.beginPath();
        ctx.moveTo(-R * 0.44, -R * 0.56); ctx.lineTo(-R * 0.10, -R * 0.56);
        ctx.lineTo(R * 0.44, R * 0.56); ctx.lineTo(R * 0.10, R * 0.56);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        // Pocket
        ctx.fillStyle = '#263348';
        ctx.beginPath(); ctx.roundRect(-R * 0.50, R * 0.06, R * 0.30, R * 0.26, 3); ctx.fill();
        ctx.strokeStyle = '#39ff1444'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(-R * 0.50, R * 0.06, R * 0.30, R * 0.26, 3); ctx.stroke();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-R * 0.50, R * 0.14); ctx.lineTo(-R * 0.20, R * 0.14); ctx.stroke();
        // Belt
        ctx.fillStyle = '#111827'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, R * 0.52, R * 0.72, R * 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#39ff1488'; ctx.shadowBlur = 8; ctx.shadowColor = '#39ff14';
        ctx.beginPath(); ctx.roundRect(-R * 0.10, R * 0.44, R * 0.20, R * 0.16, 2); ctx.fill();
        ctx.shadowBlur = 0;

        // ── LAYER 8 — Head ──────────────────────────────────────────────
        ctx.fillStyle = '#c8956c';
        ctx.beginPath();
        ctx.arc(0, -R * 0.32, R * 0.50, Math.PI * 0.08, Math.PI * 0.92, false);
        ctx.quadraticCurveTo(0, R * 0.05, -R * 0.46, -R * 0.06);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(230,150,100,0.35)';
        ctx.beginPath(); ctx.ellipse(-R * 0.24, -R * 0.22, R * 0.15, R * 0.10, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(R * 0.24, -R * 0.22, R * 0.15, R * 0.10, -0.3, 0, Math.PI * 2); ctx.fill();
        // Wild spiky hair
        ctx.fillStyle = '#1c1008'; ctx.strokeStyle = '#0f0905'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-R * 0.88, -R * 0.15);
        ctx.quadraticCurveTo(-R * 1.05, -R * 0.62, -R * 0.50, -R * 0.98);
        ctx.quadraticCurveTo(-R * 0.18, -R * 1.18, R * 0.18, -R * 1.18);
        ctx.quadraticCurveTo(R * 0.50, -R * 0.98, R * 1.05, -R * 0.62);
        ctx.quadraticCurveTo(R * 0.88, -R * 0.15, R * 0.65, -R * 0.08);
        ctx.quadraticCurveTo(0, R * 0.02, -R * 0.65, -R * 0.08);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        const spikeData = [
            { bx: -R * 0.62, by: -R * 0.85, tx: -R * 0.88, ty: -R * 1.28 },
            { bx: -R * 0.22, by: -R * 1.05, tx: -R * 0.32, ty: -R * 1.45 },
            { bx: R * 0.05, by: -R * 1.10, tx: R * 0.10, ty: -R * 1.52 },
            { bx: R * 0.32, by: -R * 1.02, tx: R * 0.50, ty: -R * 1.40 },
            { bx: R * 0.68, by: -R * 0.80, tx: R * 0.90, ty: -R * 1.18 },
        ];
        for (const sp of spikeData) {
            const halfW = R * 0.12;
            const perpA = Math.atan2(sp.ty - sp.by, sp.tx - sp.bx) + Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(sp.bx + Math.cos(perpA) * halfW, sp.by + Math.sin(perpA) * halfW);
            ctx.lineTo(sp.tx, sp.ty);
            ctx.lineTo(sp.bx - Math.cos(perpA) * halfW, sp.by - Math.sin(perpA) * halfW);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.strokeStyle = '#2d1f0f'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-R * 0.38, -R * 0.60);
        ctx.quadraticCurveTo(-R * 0.50, -R * 0.95, -R * 0.22, -R * 1.10);
        ctx.stroke();
        ctx.lineCap = 'butt';
        // Ears
        ctx.fillStyle = '#c8956c'; ctx.strokeStyle = '#a0714a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(-R * 0.85, -R * 0.38, R * 0.14, R * 0.18, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(R * 0.85, -R * 0.38, R * 0.14, R * 0.18, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Mouth
        ctx.strokeStyle = '#7a4830'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        if (e.isEnraged) {
            ctx.beginPath();
            ctx.moveTo(-R * 0.22, -R * 0.05);
            ctx.quadraticCurveTo(0, R * 0.10, R * 0.22, -R * 0.05);
            ctx.stroke();
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath(); ctx.roundRect(-R * 0.16, -R * 0.07, R * 0.32, R * 0.10, 2); ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(-R * 0.18, -R * 0.05); ctx.lineTo(R * 0.18, -R * 0.05); ctx.stroke();
        }
        ctx.lineCap = 'butt';

        // ── LAYER 9 — Science goggles ───────────────────────────────────
        const goggleY = -R * 0.38;
        const goggleGlow = e.isEnraged ? '#ff4444'
            : e.state === 'EMP_ATTACK' ? '#38bdf8'
                : e.state === 'SUVAT_CHARGE' ? '#f97316'
                    : '#00ffff';
        const gogglePulse = 0.6 + Math.sin(t * 2.5) * 0.35;
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = R * 0.14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-R * 1.02, goggleY); ctx.lineTo(R * 1.02, goggleY); ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#334155'; ctx.lineWidth = R * 0.08;
        ctx.beginPath(); ctx.moveTo(-R * 1.02, goggleY); ctx.lineTo(R * 1.02, goggleY); ctx.stroke();
        ctx.shadowBlur = 14 * gogglePulse; ctx.shadowColor = goggleGlow;
        ctx.fillStyle = '#0f172a'; ctx.strokeStyle = goggleGlow; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.roundRect(-R * 0.75, goggleY - R * 0.20, R * 0.40, R * 0.36, 4); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(R * 0.35, goggleY - R * 0.20, R * 0.40, R * 0.36, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = goggleGlow; ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.moveTo(-R * 0.35, goggleY); ctx.lineTo(R * 0.35, goggleY); ctx.stroke();
        ctx.shadowBlur = 0;
        const lensAlpha = 0.45 + Math.sin(t * 3.2) * 0.28;
        ctx.fillStyle = e.isEnraged ? `rgba(239,68,68,${lensAlpha})` : `rgba(0,255,255,${lensAlpha})`;
        ctx.shadowBlur = 10 * gogglePulse; ctx.shadowColor = goggleGlow;
        ctx.beginPath(); ctx.roundRect(-R * 0.72, goggleY - R * 0.17, R * 0.34, R * 0.30, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(R * 0.38, goggleY - R * 0.17, R * 0.34, R * 0.30, 3); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,255,255,${0.55 + Math.sin(t * 2.8) * 0.25})`;
        ctx.beginPath(); ctx.ellipse(-R * 0.60, goggleY - R * 0.10, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(R * 0.52, goggleY - R * 0.10, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); ctx.fill();

        // ── LAYER 10 — Back hand ────────────────────────────────────────
        const handBob = Math.sin(t * 2.1) * 3;
        ctx.fillStyle = '#c8956c'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.2;
        ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(0,255,255,0.3)';
        ctx.beginPath(); ctx.arc(-(R + 8), 4 + handBob, R * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        // ── LAYER 11 — State indicators ─────────────────────────────────
        if (e.state === 'STUNNED') {
            for (let si = 0; si < 3; si++) {
                const sa = t * 3.5 + (si / 3) * Math.PI * 2;
                const sx = Math.cos(sa) * R * 0.60;
                const sy = -R * 1.12 + Math.sin(sa) * R * 0.35;
                ctx.font = `bold ${13 + Math.sin(t * 4 + si) * 2}px Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fbbf24'; ctx.shadowBlur = 8; ctx.shadowColor = '#fbbf24';
                ctx.fillText('★', sx, sy);
            }
            ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
            ctx.fillText('😵', 0, -R * 1.35);
            ctx.shadowBlur = 0;
        }
        if (e.state === 'ORBIT_ATTACK') {
            ctx.save();
            ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.35;
            ctx.shadowBlur = 12; ctx.shadowColor = '#818cf8';
            ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.arc(0, 0, R * 1.55, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // ── LAYER 12 — Berserk fire particles ───────────────────────────
        if (e.isEnraged) {
            for (let pi = 0; pi < 5; pi++) {
                const pa = t * 0.85 + pi * 1.26;
                const pr = R * 0.60 + Math.sin(t * 1.3 + pi) * R * 0.18;
                const px = Math.sin(pa * 1.1) * pr;
                const py = -Math.abs(Math.cos(pa * 0.9 + pi)) * R * 0.70 - R * 0.45;
                const ps = 3.5 + Math.sin(t * 2.2 + pi) * 1.8;
                ctx.globalAlpha = 0.50 + Math.sin(t * 3 + pi) * 0.28;
                ctx.fillStyle = pi % 2 === 0 ? '#ef4444' : '#fb923c';
                ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.arc(px, py, ps, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }

        // ── LAYER 13 — HP bar ────────────────────────────────────────────
        {
            const barW = R * 2.0, barH = 6;
            const barX = -barW / 2, barYp = -R * 1.72;
            BossRenderer._drawBossHpBar(ctx, e, barX, barYp, barW, barH, 'KRU FIRST', t * 1000);
        }

        // ── Low-HP danger glow ────────────────────────────────────────
        BossRenderer._drawBossLowHpGlow(ctx, e, R, t * 1000);

        ctx.restore(); // end body block

        // ── WEAPON BLOCK — Energy pointer ──────────────────────────────
        ctx.save();
        ctx.rotate(e.angle);
        if (isFacingLeft) ctx.scale(1, -1);
        ctx.fillStyle = '#c8956c'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.2;
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(0,255,255,0.4)';
        ctx.beginPath(); ctx.arc(R + 8, 4, R * 0.30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        const ptrGlow = (e.state === 'SUVAT_CHARGE' || e.state === 'ORBIT_ATTACK' || e.state === 'EMP_ATTACK') ? 1.0 : 0.55;
        const ptrCol = e.isEnraged ? '#ff4444'
            : e.state === 'EMP_ATTACK' ? '#38bdf8'     // blue  — EMP incoming
                : e.state === 'SUVAT_CHARGE' ? '#f97316'     // orange — charge incoming
                    : '#00ffff';                                    // default cyan
        ctx.shadowBlur = 14 * ptrGlow; ctx.shadowColor = ptrCol;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.roundRect(R + 12, -R * 0.08, R * 1.45, R * 0.17, 2); ctx.fill();
        ctx.fillStyle = ptrCol; ctx.globalAlpha = ptrGlow;
        ctx.beginPath(); ctx.roundRect(R + 14, -R * 0.04, R * 1.38, R * 0.08, 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(R + 12 + R * 1.45, 0, R * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.45 * ptrGlow;
        ctx.beginPath(); ctx.arc(R + 12 + R * 1.45, 0, R * 0.30, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.restore();

        // ── HIT FLASH OVERLAY ────────────────────────────────────────────
        if (e.hitFlashTimer && e.hitFlashTimer > 0) {
            ctx.save();
            ctx.beginPath(); ctx.arc(0, 0, R + 8, 0, Math.PI * 2); ctx.clip();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255,255,255,${Math.min(e.hitFlashTimer * 2.0, 0.88)})`;
            ctx.fillRect(-R - 12, -R * 1.60, (R + 12) * 2, R * 2.8);
            ctx.restore();
        }

        ctx.restore(); // outermost
    }
}


// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORT
// ══════════════════════════════════════════════════════════════
window.BossRenderer = BossRenderer;
