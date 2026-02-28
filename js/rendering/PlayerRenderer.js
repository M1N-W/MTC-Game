'use strict';
/**
 * js/rendering/PlayerRenderer.js
 * ════════════════════════════════════════════════════════════════
 * Step 4: Rendering Decoupling — PlayerRenderer
 *
 * รวมโค้ดวาดทั้งหมดของ Player classes ไว้ที่นี่
 * เดิม: draw() อยู่ใน PlayerBase / KaoPlayer / AutoPlayer / PoomPlayer
 * ใหม่: PlayerRenderer.draw(entity, ctx) เป็น entry point เดียว
 *
 * CHANGELOG:
 *  - ย้าย Player.draw()      → PlayerRenderer._drawBase(entity, ctx)
 *  - ย้าย KaoPlayer.draw()   → PlayerRenderer._drawKao(entity, ctx)
 *  - ย้าย KaoClone.draw()    → PlayerRenderer._drawKaoClone(clone, ctx)
 *  - ย้าย AutoPlayer.draw()  → PlayerRenderer._drawAuto(entity, ctx)
 *  - ย้าย PoomPlayer.draw()  → PlayerRenderer._drawPoom(entity, ctx)
 *  - ย้าย _standAura_draw()  → PlayerRenderer._standAuraDraw(entity, charId, ctx)
 * ════════════════════════════════════════════════════════════════
 */

class PlayerRenderer {

    // ══════════════════════════════════════════════════════════
    // PUBLIC ENTRY POINT — dispatcher
    // ══════════════════════════════════════════════════════════

    /**
     * วาด player ทุก type
     * @param {Player|PoomPlayer} entity
     * @param {CanvasRenderingContext2D} ctx
     */
    static draw(entity, ctx) {
        if (!entity || !ctx) return;

        if (typeof AutoPlayer !== 'undefined' && entity instanceof AutoPlayer) {
            PlayerRenderer._drawAuto(entity, ctx);
        } else if (typeof PoomPlayer !== 'undefined' && entity instanceof PoomPlayer) {
            PlayerRenderer._drawPoom(entity, ctx);
        } else if (typeof KaoPlayer !== 'undefined' && entity instanceof KaoPlayer) {
            PlayerRenderer._drawKao(entity, ctx);
        } else {
            // Generic Player fallback
            PlayerRenderer._drawBase(entity, ctx);
        }

        // ── Contact Warning Ring — แสดงเมื่อโดน melee ─────────
        if ((entity._contactWarningTimer ?? 0) > 0) {
            const t = entity._contactWarningTimer;   // 1.2 → 0
            const ratio = t / 1.2;                       // 1.0 → 0 (fade out)
            const pulse = Math.sin(performance.now() / 80) * 0.3 + 0.7;
            const screen = worldToScreen(entity.x, entity.y);
            const R = (entity.radius || 20) + 8 + (1 - ratio) * 14; // ขยายออกตาม fade

            ctx.save();
            ctx.globalAlpha = ratio * pulse * 0.85;
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2.5;
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#fbbf24';
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, R, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }

    // ══════════════════════════════════════════════════════════
    // HELPER — Stand Aura (ใช้ร่วมกันทุก character)
    // เดิมคือ _standAura_draw() global function
    // ══════════════════════════════════════════════════════════

    static _standAuraDraw(entity, charId, ctx) {
        // ── forward to the existing global helper if it exists ──
        // _standAura_draw อาจยังอยู่ใน effects.js / standAura.js
        // wrap ไว้ที่นี่เพื่อให้ย้ายได้ทีหลังโดยไม่ break
        if (charId === 'auto') {
            // Auto มี theme แดง/ส้ม — วาด aura เองแทนการใช้ global helper
            PlayerRenderer._drawAutoAura(entity, ctx);
            return;
        }
        if (typeof _standAura_draw === 'function') {
            _standAura_draw(entity, charId);
        }
    }

    // ── Auto-exclusive Stand Aura (แดง/ส้ม theme) ────────────
    static _drawAutoAura(entity, ctx) {
        if (!entity.standGhosts) return;
        const ts = window.timeScale ?? 1;
        const inSlowmo = ts < 1.0;

        // สีหลัก: ส้มแดง — ตาม theme Thermodynamic Brawler
        const auraCol = inSlowmo ? '#ff6b00' : '#dc2626';
        const ghostCol = inSlowmo ? 'rgba(255,107,0,0.55)' : 'rgba(220,38,38,0.55)';
        const BASE_R = 44;
        const auraR = inSlowmo ? BASE_R * 1.5 : BASE_R;
        const screen = worldToScreen(entity.x, entity.y);

        // ── Ghost silhouettes ─────────────────────────────────
        for (const img of entity.standGhosts) {
            const gs = worldToScreen(img.x, img.y);
            ctx.save();
            ctx.translate(gs.x, gs.y);
            ctx.rotate(img.angle);
            ctx.globalAlpha = Math.max(0, img.alpha) * 0.55;
            ctx.fillStyle = inSlowmo ? '#ff6b00' : ghostCol;
            ctx.shadowBlur = inSlowmo ? 14 : 8;
            ctx.shadowColor = auraCol;
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha *= 0.4;
            ctx.fillStyle = inSlowmo ? '#ffffff' : auraCol;
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // ── Inner glow ring ───────────────────────────────────
        const ringPulse = 0.10 + Math.sin(entity.auraRotation * 2) * 0.05;
        ctx.save();
        ctx.globalAlpha = ringPulse * (inSlowmo ? 1.8 : 1.0);
        ctx.beginPath(); ctx.arc(screen.x, screen.y, auraR * 0.52, 0, Math.PI * 2);
        ctx.strokeStyle = auraCol;
        ctx.lineWidth = inSlowmo ? 3.5 : 1.8;
        ctx.shadowBlur = inSlowmo ? 30 : 14;
        ctx.shadowColor = auraCol;
        ctx.stroke();
        ctx.restore();

        // ── Rotating symbol ring ──────────────────────────────
        const SYMBOLS = ['∑', 'π', '∫', 'Δ', '0', '1', '∞', 'λ'];
        const COUNT = SYMBOLS.length;
        const drawRing = (ox, oy, colOverride) => {
            const col = colOverride || auraCol;
            for (let i = 0; i < COUNT; i++) {
                const baseAngle = (i / COUNT) * Math.PI * 2;
                const orbit = baseAngle + entity.auraRotation;
                const bob = Math.sin(entity.auraRotation * 2.5 + i * 0.85) * 6;
                const r = auraR + bob;
                const sx = screen.x + ox + Math.cos(orbit) * r;
                const sy = screen.y + oy + Math.sin(orbit) * r;
                const pulse = 0.50 + Math.sin(entity.auraRotation * 3.2 + i * 1.1) * 0.38;
                ctx.save();
                ctx.globalAlpha = pulse * (inSlowmo ? 0.95 : 0.72);
                ctx.translate(sx, sy);
                ctx.rotate(orbit + Math.PI / 2);
                ctx.fillStyle = col;
                ctx.shadowBlur = inSlowmo ? 22 : 11;
                ctx.shadowColor = col;
                ctx.font = `bold ${10 + Math.round(pulse * 5)}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(SYMBOLS[i % COUNT], 0, 0);
                ctx.restore();
            }
        };
        if (inSlowmo) {
            ctx.save(); ctx.globalAlpha = 0.40;
            drawRing(-2.5, 0, '#ff0055');   // red-pink (left)
            drawRing(2.5, 0, '#ff6b00');   // orange   (right)
            drawRing(0, -2.5, '#fbbf24');   // amber    (up)
            ctx.restore();
        }
        drawRing(0, 0, null);
    }

    // ══════════════════════════════════════════════════════════
    // KAO CLONE
    // เดิมคือ KaoClone.draw()
    // ══════════════════════════════════════════════════════════

    static _drawKaoClone(clone, ctx) {
        const sc = worldToScreen(clone.x, clone.y);
        const aimAngle = Math.atan2(window.mouse.wy - clone.y, window.mouse.wx - clone.x);
        const isWM = clone.owner.isWeaponMaster;
        const accentColor = isWM ? '#facc15' : '#60a5fa';
        const now = performance.now();
        const flicker = 0.85 + Math.sin(now * 0.017) * 0.08;
        const baseAlpha = (clone.owner.isInvisible || clone.owner.isFreeStealthy) ? 0.15 : clone.alpha;

        ctx.save();
        ctx.globalAlpha = baseAlpha * flicker;

        // ── Shadow body (dark translucent fill) ──
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, clone.radius, 0, Math.PI * 2);
        ctx.fillStyle = isWM ? 'rgba(250,204,21,0.12)' : 'rgba(30,58,138,0.25)';
        ctx.fill();

        // ── Wireframe ring ──
        ctx.shadowBlur = 10;
        ctx.shadowColor = accentColor;
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, clone.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // ── Scanlines (3 horizontal bands) ──
        ctx.save();
        ctx.beginPath();
        ctx.arc(sc.x, sc.y, clone.radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = isWM ? 'rgba(250,204,21,0.18)' : 'rgba(96,165,250,0.18)';
        ctx.lineWidth = 1;
        const step = clone.radius * 0.55;
        for (let i = -1; i <= 1; i++) {
            const ly = sc.y + i * step;
            ctx.beginPath();
            ctx.moveTo(sc.x - clone.radius, ly);
            ctx.lineTo(sc.x + clone.radius, ly);
            ctx.stroke();
        }
        ctx.restore();

        // ── Dashed aim laser + tip dot ──
        const laserEnd = {
            x: sc.x + Math.cos(aimAngle) * 28,
            y: sc.y + Math.sin(aimAngle) * 28
        };
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(sc.x, sc.y);
        ctx.lineTo(laserEnd.x, laserEnd.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // ── Tip dot ──
        ctx.beginPath();
        ctx.arc(laserEnd.x, laserEnd.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = accentColor;
        ctx.fill();

        ctx.restore();
    }

    // ══════════════════════════════════════════════════════════
    // KAO PLAYER
    // เดิมคือ KaoPlayer.draw()  +  super.draw() → _drawBase
    // ══════════════════════════════════════════════════════════

    static _drawKao(entity, ctx) {
        // Clones ก่อน (วาดหลังพื้นหลัง)
        entity.clones.forEach(c => PlayerRenderer._drawKaoClone(c, ctx));

        const now = performance.now();

        // ── Weapon Master golden aura (double ring) ───────────
        if (entity.isWeaponMaster) {
            const wmScreen = worldToScreen(entity.x, entity.y);
            ctx.save();
            ctx.globalAlpha = 0.28 + Math.sin(now / 150) * 0.18;
            ctx.fillStyle = '#facc15';
            ctx.shadowBlur = 24; ctx.shadowColor = '#facc15';
            ctx.beginPath();
            ctx.arc(wmScreen.x, wmScreen.y, entity.radius + 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 0.12 + Math.sin(now / 200) * 0.08;
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
            ctx.shadowBlur = 14;
            ctx.beginPath();
            ctx.arc(wmScreen.x, wmScreen.y, entity.radius + 18, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // ── Sniper charge laser-sight (dual-beam) ─────────────
        if (entity.sniperChargeTime > 0) {
            const screen = worldToScreen(entity.x, entity.y);
            const aimAngle = Math.atan2(window.mouse.wy - entity.y, window.mouse.wx - entity.x);
            const chargeT = Math.min(1, entity.sniperChargeTime);
            ctx.save();
            ctx.strokeStyle = `rgba(239,68,68,${chargeT * 0.22})`;
            ctx.lineWidth = 6 + chargeT * 10;
            ctx.shadowBlur = 18 * chargeT; ctx.shadowColor = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(screen.x + Math.cos(aimAngle) * 2000, screen.y + Math.sin(aimAngle) * 2000);
            ctx.stroke();
            ctx.strokeStyle = `rgba(252,165,165,${chargeT * 0.90})`;
            ctx.lineWidth = 1 + chargeT * 1.5;
            ctx.shadowBlur = 6 * chargeT;
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.lineTo(screen.x + Math.cos(aimAngle) * 2000, screen.y + Math.sin(aimAngle) * 2000);
            ctx.stroke();
            ctx.restore();
        }

        // ── Skill-state indicators (visible only when not stealthed) ──
        if (!entity.isInvisible && !entity.isFreeStealthy) {
            const kaoNow = performance.now();
            const kaoScr = worldToScreen(entity.x, entity.y);

            // Teleport-ready: spinning dashed ring
            if (entity.passiveUnlocked && entity.teleportCharges > 0) {
                ctx.save();
                ctx.translate(kaoScr.x, kaoScr.y);
                ctx.rotate(kaoNow / 600);
                ctx.strokeStyle = 'rgba(56,189,248,0.70)';
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 8; ctx.shadowColor = '#38bdf8';
                ctx.setLineDash([4, 5]);
                ctx.beginPath(); ctx.arc(0, 0, entity.radius + 8, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }

            // Second-wind danger ring
            if (entity.isSecondWind) {
                const swA = 0.30 + Math.sin(kaoNow / 110) * 0.20;
                ctx.save();
                ctx.globalAlpha = swA;
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 16; ctx.shadowColor = '#ef4444';
                ctx.beginPath();
                ctx.arc(kaoScr.x, kaoScr.y, entity.radius + 10 + Math.sin(kaoNow / 100) * 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // ── Body, stealth, weapon, dash ghosts (Base) ────────
        PlayerRenderer._drawBase(entity, ctx);
    }

    // ══════════════════════════════════════════════════════════
    // AUTO PLAYER
    // เดิมคือ AutoPlayer.draw()
    // ══════════════════════════════════════════════════════════

    static _drawAuto(entity, ctx) {
        const screen = worldToScreen(entity.x, entity.y);
        const now = performance.now();
        if (typeof ctx === 'undefined' || !ctx) return;

        const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;
        const facingSign = isFacingLeft ? -1 : 1;

        // ── Stand Aura (Signature Auto — แดง/ส้ม) ─────────────
        PlayerRenderer._standAuraDraw(entity, 'auto', ctx);

        // ── Dash Ghost Trail ────────────────────────────────────
        for (const img of (entity.dashGhosts || [])) {
            const gs = worldToScreen(img.x, img.y);
            const ghostFacing = Math.abs(img.angle) > Math.PI / 2 ? -1 : 1;
            ctx.save();
            ctx.translate(gs.x, gs.y);
            ctx.scale(ghostFacing, 1);
            ctx.globalAlpha = img.life * 0.35;
            ctx.fillStyle = '#ef4444';
            ctx.shadowBlur = 10 * img.life;
            ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // Ground shadow
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.beginPath(); ctx.ellipse(screen.x, screen.y + 16, 17, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── Vacuum Heat range ring (Q cooldown ready) ──────────
        // วงแสดงระยะดูด 320px — แสดงเฉพาะตอนพร้อมใช้ (cooldown <= 0)
        // ใช้ worldToScreen scale เพื่อให้ ring ขนาดถูกต้องใน camera zoom
        if ((entity.cooldowns?.vacuum ?? 1) <= 0) {
            const VACUUM_RANGE_PX = BALANCE?.characters?.auto?.vacuumRange ?? 320;
            const camScale = typeof camera !== 'undefined' ? (camera.scale ?? 1) : 1;
            const vacRingR = VACUUM_RANGE_PX * camScale;
            const pulse = 0.12 + Math.sin(now / 500) * 0.07;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 8]);
            ctx.shadowBlur = 8; ctx.shadowColor = '#f97316';
            ctx.beginPath(); ctx.arc(screen.x, screen.y, vacRingR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // ── Detonation AOE ring (active only during Wanchai) ───
        // วงแดงบอกพื้นที่ระเบิด 220px — แสดงเฉพาะระหว่าง Wanchai active
        if (entity.wanchaiActive) {
            const DET_RANGE_PX = BALANCE?.characters?.auto?.detonationRange ?? 220;
            const camScale = typeof camera !== 'undefined' ? (camera.scale ?? 1) : 1;
            const detRingR = DET_RANGE_PX * camScale;
            const detPulse = 0.18 + Math.sin(now / 200) * 0.12;
            ctx.save();
            ctx.globalAlpha = detPulse;
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 6]);
            ctx.shadowBlur = 12; ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.arc(screen.x, screen.y, detRingR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
        if (entity.wanchaiActive) {
            const bob = Math.sin(now / 130) * 7;
            const sx = screen.x - Math.cos(entity.angle) * 30;
            const sy = screen.y - Math.sin(entity.angle) * 30 - 30 + bob;
            ctx.save(); ctx.translate(sx, sy);
            const wA = 0.55 + Math.sin(now / 160) * 0.15;
            ctx.globalAlpha = 0.35 + Math.sin(now / 200) * 0.15;
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3.5;
            ctx.shadowBlur = 30; ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.arc(0, 0, 38 + Math.sin(now / 140) * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = wA * 0.65;
            const tL = -14, tT = -19, tW = 28, tH = 38;
            ctx.save();
            ctx.beginPath(); ctx.roundRect(tL, tT, tW, tH, 6); ctx.clip();
            for (let ly = tT; ly <= tT + tH; ly += 4) {
                const la = 0.4 + 0.5 * Math.abs(Math.sin(now / 80 + ly * 0.15));
                ctx.strokeStyle = `rgba(248,113,113,${la})`; ctx.lineWidth = 1.2;
                ctx.shadowBlur = 4; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.moveTo(tL, ly); ctx.lineTo(tL + tW, ly); ctx.stroke();
            }
            ctx.restore();
            ctx.globalAlpha = wA;
            ctx.strokeStyle = 'rgba(220,38,38,0.80)'; ctx.lineWidth = 2;
            ctx.shadowBlur = 16; ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.roundRect(tL, tT, tW, tH, 6); ctx.stroke();
            for (let side = -1; side <= 1; side += 2) {
                ctx.globalAlpha = wA * 0.7; ctx.strokeStyle = 'rgba(220,38,38,0.70)'; ctx.lineWidth = 1.5; ctx.shadowBlur = 10;
                ctx.beginPath(); ctx.roundRect(side * 22 - 5, -8, 10, 22, 5); ctx.stroke();
            }
            ctx.globalAlpha = wA * 0.75; ctx.shadowBlur = 18; ctx.shadowColor = '#dc2626';
            ctx.strokeStyle = 'rgba(254,202,202,0.60)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, -28, 12, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(220,38,38,0.70)';
            for (let si = -2; si <= 2; si++) {
                ctx.beginPath(); ctx.moveTo(si * 5 - 3, -37); ctx.lineTo(si * 5 + 3, -37);
                ctx.lineTo(si * 5, -42 + Math.abs(si) * 2); ctx.closePath(); ctx.fill();
            }
            const eg = 0.7 + Math.sin(now / 110) * 0.3;
            ctx.globalAlpha = eg; ctx.fillStyle = '#f87171'; ctx.shadowBlur = 12; ctx.shadowColor = '#ef4444';
            ctx.beginPath(); ctx.arc(-4, -28, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(4, -28, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            // Stand Rush Animation
            if (entity.isStandAttacking) {
                ctx.save();
                ctx.translate(screen.x, screen.y);
                ctx.rotate(entity.angle);
                ctx.shadowBlur = 12; ctx.shadowColor = '#dc2626';
                for (let i = 0; i < 8; i++) {
                    const fistX = 40 + Math.random() * 80;
                    const fistY = (Math.random() - 0.5) * 70;
                    const scale = 0.5 + Math.random() * 0.7;
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
                    ctx.beginPath();
                    ctx.ellipse(fistX, fistY, 14 * scale, 9 * scale, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(248, 113, 113, 0.5)';
                    ctx.lineWidth = 4 * scale;
                    ctx.beginPath();
                    ctx.moveTo(fistX - 25 * scale, fistY);
                    ctx.lineTo(fistX, fistY);
                    ctx.stroke();
                }
                ctx.rotate(-entity.angle);
                const textScale = 1 + Math.sin(now / 30) * 0.15;
                const jitterX = (Math.random() - 0.5) * 6;
                const jitterY = (Math.random() - 0.5) * 6;
                ctx.translate(0, -75);
                ctx.scale(textScale, textScale);
                ctx.font = '900 28px "Arial Black", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.lineWidth = 5;
                ctx.strokeStyle = '#000000';
                ctx.strokeText('วันชัย วันชัย วันชัย!', jitterX, jitterY);
                ctx.fillStyle = '#facc15';
                ctx.fillText('วันชัย วันชัย วันชัย!', jitterX, jitterY);
                ctx.restore();
            }
        }

        // Breathing squash/stretch
        const breatheAuto = Math.sin(Date.now() / 200);
        const speed = Math.hypot(entity.vx, entity.vy);
        const moveT = Math.min(1, speed / 180);
        const bobT = Math.sin(entity.walkCycle * 0.9);
        const stretchX = 1 + breatheAuto * 0.025 + moveT * bobT * 0.09;
        const stretchY = 1 - breatheAuto * 0.025 - moveT * Math.abs(bobT) * 0.065;

        const attackIntensity = entity.wanchaiActive ? 1.0
            : Math.min(1, (Math.abs(entity.vx) + Math.abs(entity.vy)) / 150 + 0.2);
        const ventGlow = Math.max(0, attackIntensity * (0.5 + Math.sin(now / 180) * 0.5));

        const R = 15;

        // ════ LAYER 1 — BODY ════
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.scale(stretchX * facingSign, stretchY);

        ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(220,38,38,0.75)';
        ctx.strokeStyle = 'rgba(220,38,38,0.55)'; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        const bG = ctx.createRadialGradient(-4, -4, 1, 0, 0, R);
        bG.addColorStop(0, '#7f1d1d');
        bG.addColorStop(0.5, '#5a0e0e');
        bG.addColorStop(1, '#2d0606');
        ctx.fillStyle = bG;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.beginPath(); ctx.arc(-5, -6, 6, 0, Math.PI * 2); ctx.fill();

        // Heat vents
        ctx.shadowBlur = 10 * ventGlow; ctx.shadowColor = '#fb923c';
        for (let vi = 0; vi < 3; vi++) {
            const va = ventGlow * (0.45 + vi * 0.18);
            ctx.fillStyle = `rgba(251,146,60,${va})`;
            ctx.beginPath(); ctx.roundRect(-R, -4 + vi * 5, 4, 2.5, 1); ctx.fill();
            ctx.beginPath(); ctx.roundRect(R - 4, -4 + vi * 5, 4, 2.5, 1); ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Power core
        const cP = Math.max(0, 0.4 + Math.sin(now / 200) * 0.5) * (entity.wanchaiActive ? 1.5 : 1);
        ctx.fillStyle = `rgba(239,68,68,${Math.min(1, cP)})`;
        ctx.shadowBlur = 12 * cP; ctx.shadowColor = '#dc2626';
        ctx.beginPath(); ctx.roundRect(-4.5, 0, 9, 6, 2); ctx.fill();
        ctx.fillStyle = `rgba(255,180,180,${cP * 0.80})`;
        ctx.beginPath(); ctx.arc(0, 3, 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        if (entity.wanchaiActive) {
            const hA = 0.35 + Math.sin(now / 90) * 0.20;
            ctx.save();
            ctx.globalAlpha = hA;
            ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5;
            ctx.shadowBlur = 12; ctx.shadowColor = '#f97316';
            ctx.beginPath(); ctx.arc(0, 0, R + 6, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // Anime-Spiky Hair
        ctx.fillStyle = '#1a0505';
        ctx.beginPath();
        ctx.moveTo(-(R - 1), -1);
        ctx.quadraticCurveTo(-R - 1, -R * 0.6, -R * 0.4, -R - 2);
        ctx.quadraticCurveTo(0, -R - 4, R * 0.4, -R - 2);
        ctx.quadraticCurveTo(R + 1, -R * 0.6, R - 1, -1);
        ctx.quadraticCurveTo(R * 0.5, 2, 0, 2.5);
        ctx.quadraticCurveTo(-R * 0.5, 2, -(R - 1), -1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-(R - 1), -1);
        ctx.quadraticCurveTo(-R - 1, -R * 0.6, -R * 0.4, -R - 2);
        ctx.quadraticCurveTo(0, -R - 4, R * 0.4, -R - 2);
        ctx.quadraticCurveTo(R + 1, -R * 0.6, R - 1, -1);
        ctx.quadraticCurveTo(R * 0.5, 2, 0, 2.5);
        ctx.quadraticCurveTo(-R * 0.5, 2, -(R - 1), -1);
        ctx.closePath(); ctx.stroke();

        ctx.fillStyle = '#5c1010';
        ctx.beginPath();
        ctx.moveTo(-5, -R - 2);
        ctx.quadraticCurveTo(-1, -R - 5, 4, -R - 2);
        ctx.quadraticCurveTo(2, -R + 2, -2, -R + 1);
        ctx.quadraticCurveTo(-4, -R, -5, -R - 2);
        ctx.closePath(); ctx.fill();

        const spikeData = [
            [-11, -2, 12, '#3d0909'],
            [-5, -1, 9, '#450a0a'],
            [1, 0, 11, '#450a0a'],
            [7, 1, 8, '#3d0909'],
            [12, 2, 6, '#2d0606'],
        ];
        for (const [bx, tipOff, h, col] of spikeData) {
            const wobble = Math.sin(now / 380 + bx * 0.4) * 1.2;
            ctx.fillStyle = col;
            ctx.beginPath();
            ctx.moveTo(bx - 3.5, -R - 1);
            ctx.lineTo(bx + 3.5, -R - 1);
            ctx.lineTo(bx + tipOff + wobble, -R - 1 - h - wobble * 0.4);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx - 3.5, -R - 1);
            ctx.lineTo(bx + 3.5, -R - 1);
            ctx.lineTo(bx + tipOff + wobble, -R - 1 - h - wobble * 0.4);
            ctx.closePath(); ctx.stroke();
        }
        ctx.shadowBlur = entity.wanchaiActive ? 16 : 6;
        ctx.shadowColor = '#f97316';
        const emberColors = ['#f97316', '#ef4444', '#fb923c', '#f87171', '#fca5a5'];
        spikeData.forEach(([bx, tipOff, h], idx) => {
            const wobble = Math.sin(now / 380 + bx * 0.4) * 1.2;
            const tx = bx + tipOff + wobble;
            const ty = -R - 1 - h - wobble * 0.4;
            const eA = (entity.wanchaiActive ? 0.9 : 0.6) + Math.sin(now / 200 + idx) * 0.25;
            ctx.fillStyle = emberColors[idx % emberColors.length];
            ctx.globalAlpha = Math.max(0, Math.min(1, eA));
            ctx.beginPath(); ctx.arc(tx, ty, 2, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;

        // Second-wind danger ring
        if (entity.isSecondWind) {
            const swA = 0.30 + Math.sin(now / 110) * 0.20;
            ctx.save();
            ctx.globalAlpha = swA;
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
            ctx.shadowBlur = 14; ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.arc(0, 0, R + 9 + Math.sin(now / 100) * 2, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // Energy Shield
        if (entity.hasShield) {
            const shieldT = performance.now() / 200;
            ctx.save();
            ctx.globalAlpha = 0.6 + Math.sin(shieldT) * 0.2;
            ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 3;
            ctx.shadowBlur = 15; ctx.shadowColor = '#8b5cf6';
            ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
            ctx.fill();
            ctx.restore();
        }

        ctx.restore(); // end LAYER 1

        // ════ LAYER 2 — WEAPON + FISTS ════
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(entity.angle);
        if (isFacingLeft) ctx.scale(1, -1);

        if (typeof drawAutoWeapon === 'function') {
            drawAutoWeapon(ctx, entity.wanchaiActive, ventGlow);
        }

        const fistGlow = ventGlow * 0.8 + (entity.wanchaiActive ? 0.6 : 0);
        ctx.shadowBlur = 10 * fistGlow; ctx.shadowColor = '#dc2626';
        ctx.fillStyle = '#4a0e0e'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(R + 8, 3, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath(); ctx.arc(R + 6, 1, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2d0606'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(R + 3, 1); ctx.lineTo(R + 13, 1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R + 3, 4); ctx.lineTo(R + 13, 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R + 3, 6.5); ctx.lineTo(R + 13, 6.5); ctx.stroke();
        const fistEmber = Math.max(0, 0.5 + Math.sin(now / 160) * 0.4) * (entity.wanchaiActive ? 1 : 0.6);
        ctx.fillStyle = `rgba(251,146,60,${fistEmber})`;
        ctx.shadowBlur = 8 * fistEmber; ctx.shadowColor = '#fb923c';
        ctx.beginPath(); ctx.roundRect(R + 4, 2.5, 8, 1.5, 1); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#3d0808'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 6 * fistGlow; ctx.shadowColor = '#dc2626';
        ctx.beginPath(); ctx.arc(-(R + 7), -1, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5c1010';
        ctx.beginPath(); ctx.arc(-(R + 9), -2, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore(); // end LAYER 2

        // Heat shimmer particles
        if (typeof spawnParticles === 'function' &&
            (Math.abs(entity.vx) + Math.abs(entity.vy)) > 60 &&
            Math.random() < 0.1) {
            spawnParticles(entity.x + rand(-10, 10), entity.y + rand(-10, 10), 1, '#fb7185', 'steam');
        }

        // Level badge
        if (entity.level > 1) {
            ctx.fillStyle = 'rgba(185,28,28,0.92)';
            ctx.beginPath(); ctx.arc(screen.x + 22, screen.y - 22, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(entity.level, screen.x + 22, screen.y - 22);
        }
    }

    // ══════════════════════════════════════════════════════════
    // POOM PLAYER
    // เดิมคือ PoomPlayer.draw()
    // ══════════════════════════════════════════════════════════

    static _drawPoom(entity, ctx) {
        const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;
        const facingSign = isFacingLeft ? -1 : 1;

        PlayerRenderer._standAuraDraw(entity, 'poom', ctx);

        // Dash ghost trail — เขียวมรกต match body Poom
        for (const img of entity.dashGhosts) {
            const s = worldToScreen(img.x, img.y);
            const ghostFacing = Math.abs(img.angle) > Math.PI / 2 ? -1 : 1;
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.scale(ghostFacing, 1);
            ctx.globalAlpha = img.life * 0.35;
            ctx.fillStyle = '#34d399';
            ctx.shadowBlur = 8 * img.life; ctx.shadowColor = '#10b981';
            ctx.beginPath(); ctx.roundRect(-15, -12, 30, 24, 8); ctx.fill();
            ctx.restore();
        }

        const screen = worldToScreen(entity.x, entity.y);

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(screen.x, screen.y + 25, 18, 8, 0, 0, Math.PI * 2); ctx.fill();

        // Eating-rice power aura
        if (entity.isEatingRice) {
            const t = performance.now() / 200;
            const auraSize = 38 + Math.sin(t) * 6;
            const auraAlpha = 0.4 + Math.sin(t * 1.5) * 0.15;
            ctx.save();
            ctx.globalAlpha = auraAlpha;
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 4;
            ctx.shadowBlur = 25; ctx.shadowColor = '#fbbf24';
            ctx.beginPath(); ctx.arc(screen.x, screen.y, auraSize, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = auraAlpha * 0.35;
            ctx.beginPath(); ctx.arc(screen.x, screen.y, auraSize + 12, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // Naga invincibility shield
        if (entity.naga && entity.naga.active) {
            const gt = performance.now() / 350;
            const shieldR = 36 + Math.sin(gt) * 4;
            const shieldA = 0.25 + Math.sin(gt * 1.3) * 0.12;
            ctx.save();
            ctx.globalAlpha = shieldA;
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2.5;
            ctx.shadowBlur = 18; ctx.shadowColor = '#f59e0b';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(screen.x, screen.y, shieldR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = shieldA * 0.4;
            ctx.beginPath(); ctx.arc(screen.x, screen.y, shieldR + 8, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        if (entity.isConfused) { ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center'; ctx.fillText('😵', screen.x, screen.y - 44); }
        if (entity.isBurning) { ctx.font = 'bold 20px Arial'; ctx.fillText('🔥', screen.x + 20, screen.y - 35); }
        if (entity.isEatingRice) { ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.fillText('🍚', screen.x, screen.y - 44); }

        // Naga channeling aura + connection tether
        const nagaEntity = window.specialEffects &&
            window.specialEffects.find(e => e instanceof NagaEntity);
        const isChanneling = !!nagaEntity;
        if (isChanneling) {
            const ct = performance.now() / 220;
            const cr = 42 + Math.sin(ct) * 7;
            const ca = 0.55 + Math.sin(ct * 1.6) * 0.25;
            ctx.save();
            ctx.globalAlpha = ca;
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 3.5 + Math.sin(ct * 2.1) * 1.5;
            ctx.shadowBlur = 24 + Math.sin(ct) * 10; ctx.shadowColor = '#10b981';
            ctx.beginPath(); ctx.arc(screen.x, screen.y, cr, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = ca * 0.55;
            ctx.lineWidth = 1.5; ctx.shadowBlur = 10;
            ctx.beginPath(); ctx.arc(screen.x, screen.y, cr - 12, 0, Math.PI * 2); ctx.stroke();
            if (Math.random() < 0.35) {
                const sa = Math.random() * Math.PI * 2;
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = '#34d399'; ctx.shadowBlur = 8; ctx.shadowColor = '#10b981';
                ctx.beginPath(); ctx.arc(screen.x + Math.cos(sa) * cr, screen.y + Math.sin(sa) * cr, 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();

            if (nagaEntity.segments && nagaEntity.segments.length > 0) {
                const nagaHead = nagaEntity.segments[0];
                const nagaScreen = worldToScreen(nagaHead.x, nagaHead.y);
                const lifeAlpha = Math.min(1, nagaEntity.life / nagaEntity.maxLife);
                const SEGS = 10;
                const pts = [];
                for (let i = 0; i <= SEGS; i++) {
                    const t = i / SEGS;
                    const bx = screen.x + (nagaScreen.x - screen.x) * t;
                    const by = screen.y + (nagaScreen.y - screen.y) * t;
                    const jAmp = Math.sin(t * Math.PI) * (8 + Math.sin(performance.now() / 80 + i) * 4);
                    const perp = Math.atan2(nagaScreen.y - screen.y, nagaScreen.x - screen.x) + Math.PI / 2;
                    const jit = (Math.random() - 0.5) * 2 * jAmp;
                    pts.push({ x: bx + Math.cos(perp) * jit, y: by + Math.sin(perp) * jit });
                }
                pts[0] = { x: screen.x, y: screen.y };
                pts[SEGS] = { x: nagaScreen.x, y: nagaScreen.y };

                const drawThread = (lw, alpha, color, blur) => {
                    ctx.save();
                    ctx.globalAlpha = lifeAlpha * alpha;
                    ctx.strokeStyle = color; ctx.lineWidth = lw;
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.shadowBlur = blur; ctx.shadowColor = '#10b981';
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i <= SEGS; i++) ctx.lineTo(pts[i].x, pts[i].y);
                    ctx.stroke();
                    ctx.restore();
                };
                drawThread(5, 0.25, '#10b981', 18);
                drawThread(1.5, 0.85, '#6ee7b7', 8);

                ctx.save();
                ctx.globalAlpha = lifeAlpha * (0.7 + Math.sin(performance.now() / 120) * 0.3);
                ctx.fillStyle = '#34d399'; ctx.shadowBlur = 14; ctx.shadowColor = '#10b981';
                ctx.beginPath(); ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        }

        // Breathing squash/stretch
        const now2 = performance.now();
        const breathePoom = Math.sin(Date.now() / 200);
        const speed2 = Math.hypot(entity.vx, entity.vy);
        const moveT2 = Math.min(1, speed2 / 190);
        const bobT2 = Math.sin(entity.walkCycle);
        const stretchX2 = 1 + breathePoom * 0.035 + moveT2 * bobT2 * 0.12;
        const stretchY2 = 1 - breathePoom * 0.035 - moveT2 * Math.abs(bobT2) * 0.09;

        const R2 = 13;

        // ════ LAYER 1 — BODY ════
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.scale(stretchX2 * facingSign, stretchY2);

        ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(168,85,247,0.65)';
        ctx.strokeStyle = 'rgba(168,85,247,0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R2 + 2, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        const poomBodyG = ctx.createRadialGradient(-3, -3, 1, 0, 0, R2);
        poomBodyG.addColorStop(0, '#3d2a14');
        poomBodyG.addColorStop(0.55, '#241808');
        poomBodyG.addColorStop(1, '#120d04');
        ctx.fillStyle = poomBodyG;
        ctx.beginPath(); ctx.arc(0, 0, R2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R2, 0, Math.PI * 2); ctx.stroke();

        // School uniform (clipped)
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, R2, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(241,245,249,0.90)';
        ctx.fillRect(-R2, -R2, R2 * 2, R2);
        ctx.fillStyle = 'rgba(120,113,85,0.85)';
        ctx.fillRect(-R2, 0, R2 * 2, R2);
        ctx.fillStyle = 'rgba(185,28,28,0.92)';
        ctx.fillRect(-R2, -2, R2 * 2, 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1;
        for (let px = -R2; px < R2; px += 3) {
            ctx.beginPath(); ctx.moveTo(px, -2); ctx.lineTo(px, 4); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(-R2, 1); ctx.lineTo(R2, 1); ctx.stroke();
        ctx.strokeStyle = 'rgba(148,163,184,0.70)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, -R2); ctx.lineTo(0, -2); ctx.stroke();
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.beginPath(); ctx.arc(-R2 * 0.35, -R2 * 0.35, R2 * 0.30, 0, Math.PI * 2); ctx.fill();

        // Shirt pocket
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, R2, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(203,213,225,0.80)';
        ctx.fillRect(-6, -9, 4, 5);
        ctx.fillStyle = 'rgba(59,130,246,0.75)';
        ctx.fillRect(3, -8, 4, 1.5);
        ctx.restore();

        // Thai Kranok pattern
        const kranokT2 = now2 / 500;
        const kranokAlpha = 0.55 + Math.sin(kranokT2 * 1.3) * 0.25;
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, R2 - 1, 0, Math.PI * 2); ctx.clip();
        ctx.globalAlpha = kranokAlpha;
        ctx.strokeStyle = '#fef3c7'; ctx.lineWidth = 1.1;
        ctx.shadowBlur = 6 + Math.sin(kranokT2 * 2) * 3; ctx.shadowColor = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-8, 7); ctx.quadraticCurveTo(-9, 1, -4, -1);
        ctx.quadraticCurveTo(-1, -2, -3, 3); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-4, -1); ctx.quadraticCurveTo(-6, -4, -3, -5);
        ctx.quadraticCurveTo(-1, -6, -2, -3); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8, 7); ctx.quadraticCurveTo(9, 1, 4, -1);
        ctx.quadraticCurveTo(1, -2, 3, 3); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(4, -1); ctx.quadraticCurveTo(6, -4, 3, -5);
        ctx.quadraticCurveTo(1, -6, 2, -3); ctx.stroke();
        ctx.globalAlpha = kranokAlpha * 0.95;
        ctx.fillStyle = 'rgba(255,251,235,0.90)'; ctx.shadowBlur = 8; ctx.shadowColor = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(0, -5); ctx.lineTo(2.5, -1); ctx.lineTo(0, 3); ctx.lineTo(-2.5, -1);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(254,243,199,0.85)'; ctx.shadowBlur = 3;
        for (const [dx2, dy2] of [[-5, 8], [0, 9], [5, 8]]) {
            ctx.beginPath(); ctx.arc(dx2, dy2, 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        // Messy Spiky Hair
        ctx.fillStyle = '#1c0f05';
        ctx.beginPath();
        ctx.moveTo(-R2, -2);
        ctx.quadraticCurveTo(-R2 - 1, -R2 * 1.1, 0, -R2 - 7);
        ctx.quadraticCurveTo(R2 + 1, -R2 * 1.1, R2, -2);
        ctx.quadraticCurveTo(R2 * 0.6, -1, 0, 0);
        ctx.quadraticCurveTo(-R2 * 0.6, -1, -R2, -2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-R2, -2);
        ctx.quadraticCurveTo(-R2 - 1, -R2 * 1.1, 0, -R2 - 7);
        ctx.quadraticCurveTo(R2 + 1, -R2 * 1.1, R2, -2);
        ctx.quadraticCurveTo(R2 * 0.6, -1, 0, 0);
        ctx.quadraticCurveTo(-R2 * 0.6, -1, -R2, -2);
        ctx.closePath(); ctx.stroke();

        ctx.fillStyle = '#3b1a07';
        ctx.beginPath();
        ctx.moveTo(-6, -R2 - 4);
        ctx.quadraticCurveTo(-1, -R2 - 8, 4, -R2 - 5);
        ctx.quadraticCurveTo(2, -R2 - 1, -2, -R2);
        ctx.quadraticCurveTo(-5, -R2, -6, -R2 - 4);
        ctx.closePath(); ctx.fill();

        ctx.fillStyle = '#15080a';
        const hairSpikes = [
            { bx: -9, angle: -2.4, len: 7 },
            { bx: -4, angle: -2.0, len: 9 },
            { bx: 1, angle: -1.57, len: 10 },
            { bx: 6, angle: -1.1, len: 8 },
            { bx: 10, angle: -0.8, len: 6 },
        ];
        for (const sp of hairSpikes) {
            const tipX = sp.bx + Math.cos(sp.angle) * sp.len;
            const tipY = -R2 - 5 + Math.sin(sp.angle) * sp.len;
            const wob = Math.sin(now2 / 500 + sp.bx) * 1.2;
            ctx.fillStyle = '#15080a';
            ctx.beginPath();
            ctx.moveTo(sp.bx - 3, -R2 - 3);
            ctx.lineTo(sp.bx + 3, -R2 - 3);
            ctx.lineTo(tipX + wob, tipY - wob * 0.5);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sp.bx - 3, -R2 - 3);
            ctx.lineTo(sp.bx + 3, -R2 - 3);
            ctx.lineTo(tipX + wob, tipY - wob * 0.5);
            ctx.closePath(); ctx.stroke();
        }

        // Energy Shield
        if (entity.hasShield) {
            const shieldT = performance.now() / 200;
            ctx.save();
            ctx.globalAlpha = 0.6 + Math.sin(shieldT) * 0.2;
            ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 3;
            ctx.shadowBlur = 15; ctx.shadowColor = '#8b5cf6';
            ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
            ctx.fill();
            ctx.restore();
        }

        ctx.restore(); // end LAYER 1

        // ════ LAYER 2 — WEAPON + HANDS ════
        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.rotate(entity.angle);
        if (isFacingLeft) ctx.scale(1, -1);

        if (typeof drawPoomWeapon === 'function') drawPoomWeapon(ctx);

        const pR = 5;
        ctx.fillStyle = '#d97706'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 6; ctx.shadowColor = '#f59e0b';
        ctx.beginPath(); ctx.arc(R2 + 6, 1, pR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.save();
        ctx.beginPath(); ctx.arc(R2 + 6, 1, pR, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.80)';
        ctx.fillRect(R2 + 1, -1.5, 10, 1.5);
        ctx.fillRect(R2 + 1, 1.5, 10, 1.2);
        ctx.fillStyle = 'rgba(220,38,38,0.60)';
        ctx.fillRect(R2 + 1, 0.1, 10, 0.8);
        ctx.restore();

        ctx.fillStyle = '#b45309'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 4; ctx.shadowColor = '#f59e0b';
        ctx.beginPath(); ctx.arc(-(R2 + 5), 1, pR - 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.save();
        ctx.beginPath(); ctx.arc(-(R2 + 5), 1, pR - 1, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillRect(-(R2 + 10), -1, 10, 1.3);
        ctx.fillRect(-(R2 + 10), 1.5, 10, 1.1);
        ctx.restore();

        ctx.restore(); // end LAYER 2

        // Level badge
        if (entity.level > 1) {
            ctx.fillStyle = 'rgba(217,119,6,0.92)';
            ctx.beginPath(); ctx.arc(screen.x + 20, screen.y - 20, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(entity.level, screen.x + 20, screen.y - 20);
        }
    }

    // ══════════════════════════════════════════════════════════
    // BASE PLAYER (Kao body / generic)
    // เดิมคือ Player.draw() ใน PlayerBase.js
    // ══════════════════════════════════════════════════════════

    static _drawBase(entity, ctx) {
        const now = performance.now();
        PlayerRenderer._standAuraDraw(entity, entity.charId || 'kao', ctx);

        const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;
        const facingSign = isFacingLeft ? -1 : 1;

        const recoilAmt = entity.weaponRecoil > 0.05 ? entity.weaponRecoil * 3.5 : 0;
        const recoilX = -Math.cos(entity.angle) * recoilAmt;
        const recoilY = -Math.sin(entity.angle) * recoilAmt;

        // Dash ghost trail
        for (const img of entity.dashGhosts) {
            const gs = worldToScreen(img.x, img.y);
            const ghostFacing = Math.abs(img.angle) > Math.PI / 2 ? -1 : 1;
            ctx.save();
            ctx.translate(gs.x, gs.y);
            ctx.scale(ghostFacing, 1);
            ctx.globalAlpha = img.life * 0.35;
            ctx.fillStyle = '#60a5fa';
            ctx.shadowBlur = 8 * img.life; ctx.shadowColor = '#3b82f6';
            ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 6); ctx.fill();
            ctx.restore();
        }

        const screen = worldToScreen(entity.x, entity.y);

        // Ground shadow
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.beginPath(); ctx.ellipse(screen.x, screen.y + 14, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Passive aura
        if (entity.passiveUnlocked) {
            const aS = 30 + Math.sin(now / 200) * 4;
            const aA = 0.3 + Math.sin(now / 300) * 0.1;
            ctx.save(); ctx.globalAlpha = aA;
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
            ctx.shadowBlur = 18; ctx.shadowColor = '#fbbf24';
            ctx.beginPath(); ctx.arc(screen.x, screen.y, aS, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        if (entity.isConfused) {
            ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center';
            ctx.fillText('😵', screen.x, screen.y - 32);
        }
        if (entity.isBurning) {
            ctx.font = 'bold 18px Arial';
            ctx.fillText('🔥', screen.x + 18, screen.y - 26);
        }

        // Breathing squash/stretch
        const breatheKao = Math.sin(Date.now() / 200);
        const speed = Math.hypot(entity.vx, entity.vy);
        const moveT = Math.min(1, speed / 200);
        const bobT = Math.sin(entity.walkCycle);
        const stretchX = 1 + breatheKao * 0.030 + moveT * bobT * 0.10;
        const stretchY = 1 - breatheKao * 0.030 - moveT * Math.abs(bobT) * 0.07;

        const R = 13;

        if (entity.isInvisible || entity.isFreeStealthy) {
            // STEALTH: glitch scanlines + ghost bean
            const gT = now / 60;
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.scale(stretchX * facingSign, stretchY);

            ctx.save();
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
            for (let sy2 = -R; sy2 < R; sy2 += 3) {
                const la = (Math.sin(gT * 4 + sy2 * 0.7) * 0.5 + 0.5) * 0.3;
                ctx.globalAlpha = la;
                ctx.fillStyle = '#60a5fa';
                ctx.fillRect(-R + Math.sin(gT * 7.3 + sy2) * 2.5, sy2, R * 2, 1.5);
            }
            ctx.restore();

            ctx.globalAlpha = 0.18 + Math.sin(gT * 2.1) * 0.07;
            ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1.5;
            ctx.shadowBlur = 8; ctx.shadowColor = '#60a5fa';
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();

            ctx.globalAlpha = 0.5 + Math.sin(gT * 5) * 0.3;
            ctx.fillStyle = '#06b6d4';
            ctx.shadowBlur = 12; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.roundRect(-5, -3.5, 10, 2.5, 1); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

        } else {
            // ════ LAYER 1 — BODY ════
            ctx.save();
            ctx.translate(screen.x + recoilX, screen.y + recoilY);
            ctx.scale(stretchX * facingSign, stretchY);

            ctx.shadowBlur = 16; ctx.shadowColor = 'rgba(0,255,65,0.70)';
            ctx.strokeStyle = 'rgba(0,255,65,0.45)'; ctx.lineWidth = 2.8;
            ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;

            const bodyG = ctx.createRadialGradient(-3, -3, 1, 0, 0, R);
            bodyG.addColorStop(0, '#1d3461');
            bodyG.addColorStop(0.55, '#0f2140');
            bodyG.addColorStop(1, '#07111e');
            ctx.fillStyle = bodyG;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();

            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.beginPath(); ctx.arc(-4, -5, 5.5, 0, Math.PI * 2); ctx.fill();

            // Tactical Hood
            ctx.fillStyle = '#0b1623';
            ctx.beginPath();
            ctx.moveTo(-(R - 1), -1);
            ctx.quadraticCurveTo(-(R + 2), -R * 0.45, -R * 0.35, -R - 5);
            ctx.quadraticCurveTo(0, -R - 8, R * 0.35, -R - 5);
            ctx.quadraticCurveTo(R + 2, -R * 0.45, R - 1, -1);
            ctx.quadraticCurveTo(R * 0.55, 1, 0, 2);
            ctx.quadraticCurveTo(-R * 0.55, 1, -(R - 1), -1);
            ctx.closePath(); ctx.fill();

            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-(R - 1), -1);
            ctx.quadraticCurveTo(-(R + 2), -R * 0.45, -R * 0.35, -R - 5);
            ctx.quadraticCurveTo(0, -R - 8, R * 0.35, -R - 5);
            ctx.quadraticCurveTo(R + 2, -R * 0.45, R - 1, -1);
            ctx.quadraticCurveTo(R * 0.55, 1, 0, 2);
            ctx.quadraticCurveTo(-R * 0.55, 1, -(R - 1), -1);
            ctx.closePath(); ctx.stroke();

            ctx.fillStyle = '#16304f';
            ctx.beginPath();
            ctx.moveTo(-7, -R - 3);
            ctx.quadraticCurveTo(-2, -R - 6, 3, -R - 5);
            ctx.quadraticCurveTo(1, -R - 1, -3, -R);
            ctx.quadraticCurveTo(-6, -R, -7, -R - 3);
            ctx.closePath(); ctx.fill();

            ctx.strokeStyle = '#1e40af'; ctx.lineWidth = 1;
            ctx.shadowBlur = 4; ctx.shadowColor = '#3b82f6';
            ctx.beginPath(); ctx.moveTo(R * 0.35, -3); ctx.lineTo(R + 1, -2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-R * 0.35, -3); ctx.lineTo(-R - 1, -2); ctx.stroke();
            ctx.shadowBlur = 0;

            // Glowing cyan visor slit
            const vp = 0.65 + Math.sin(Date.now() / 350) * 0.35;
            ctx.fillStyle = `rgba(6,182,212,${vp})`;
            ctx.shadowBlur = 12 * vp; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.roundRect(-6.5, -3.5, 13, 2.5, 1.5); ctx.fill();
            ctx.fillStyle = `rgba(6,182,212,${vp * 0.20})`;
            ctx.beginPath(); ctx.roundRect(-5, -5.5, 10, 7, 3); ctx.fill();
            ctx.shadowBlur = 0;

            // Energy Shield
            if (entity.hasShield) {
                const shieldT = performance.now() / 200;
                ctx.save();
                ctx.globalAlpha = 0.6 + Math.sin(shieldT) * 0.2;
                ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 3;
                ctx.shadowBlur = 15; ctx.shadowColor = '#8b5cf6';
                ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
                ctx.fill();
                ctx.restore();
            }

            ctx.restore(); // end LAYER 1

            // ════ LAYER 2 — WEAPON + HANDS ════
            ctx.save();
            ctx.translate(screen.x + recoilX, screen.y + recoilY);
            ctx.rotate(entity.angle);
            if (isFacingLeft) ctx.scale(1, -1);

            if (typeof weaponSystem !== 'undefined') weaponSystem.drawWeaponOnPlayer(entity);

            // Floating Dark-Blue Gloves
            const gR = 5;
            ctx.fillStyle = '#1e3a5f';
            ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
            ctx.shadowBlur = 6; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.arc(R + 6, 2, gR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#2d5a8e'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(R + 3, 0); ctx.lineTo(R + 9, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(R + 3, 2.5); ctx.lineTo(R + 9, 2.5); ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#0e2340'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
            ctx.shadowBlur = 3; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.arc(-(R + 5), 1, gR - 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.restore(); // end LAYER 2

            // Muzzle flash (screen space)
            if (entity.weaponRecoil > 0.45) {
                const fT = (entity.weaponRecoil - 0.45) / 0.55;
                const mDist = 36 + (1 - fT) * 10;
                const mx = screen.x + Math.cos(entity.angle) * mDist;
                const my = screen.y + Math.sin(entity.angle) * mDist;
                ctx.save();
                ctx.globalAlpha = fT * 0.9;
                ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 2;
                ctx.shadowBlur = 16; ctx.shadowColor = '#06b6d4';
                ctx.beginPath(); ctx.arc(mx, my, 3 + (1 - fT) * 6, 0, Math.PI * 2); ctx.stroke();
                ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1.2;
                for (let ri = 0; ri < 6; ri++) {
                    const ra = entity.angle + (ri / 6) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(mx + Math.cos(ra) * 2, my + Math.sin(ra) * 2);
                    ctx.lineTo(mx + Math.cos(ra) * (5 + fT * 5), my + Math.sin(ra) * (5 + fT * 5));
                    ctx.stroke();
                }
                ctx.globalAlpha = fT;
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 8; ctx.shadowColor = '#06b6d4';
                ctx.beginPath(); ctx.arc(mx, my, 2, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        }

        // Level badge (screen space)
        if (entity.level > 1) {
            ctx.fillStyle = 'rgba(37,99,235,0.92)';
            ctx.beginPath(); ctx.arc(screen.x + 20, screen.y - 20, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(entity.level, screen.x + 20, screen.y - 20);
        }
    }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.PlayerRenderer = PlayerRenderer;