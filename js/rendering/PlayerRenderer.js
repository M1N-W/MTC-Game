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
    // SHARED HELPERS (extracted from 3 identical blocks)
    // ══════════════════════════════════════════════════════════

    /**
     * Energy shield ring — identical block was in _drawBase / _drawAuto / _drawPoom.
     * Call inside a ctx.save block already translated to entity centre.
     */
    static _drawEnergyShield(ctx, now) {
        const shieldT = now / 200;
        const pulse = 0.6 + Math.sin(shieldT) * 0.2;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 3;
        ctx.shadowBlur = 15 + Math.sin(shieldT * 1.4) * 5; ctx.shadowColor = '#8b5cf6';
        ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(139,92,246,0.15)'; ctx.fill();
        // Rotating shimmer arc
        ctx.globalAlpha = pulse * 0.55;
        ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8; ctx.shadowColor = '#c4b5fd';
        ctx.setLineDash([6, 10]);
        ctx.beginPath(); ctx.arc(0, 0, 25, shieldT * 2.5, shieldT * 2.5 + Math.PI * 1.2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

    /**
     * Level badge — polished hexagon-backed badge.
     * Call in screen space (after all transforms restored).
     * @param {string} badgeColor  — css colour matching character theme
     * @param {number} ox / oy     — offset from screen centre
     */
    static _drawLevelBadge(ctx, screen, entity, badgeColor, ox = 20, oy = -20) {
        if ((entity.level ?? 1) <= 1) return;
        const bx = screen.x + ox, by = screen.y + oy;
        ctx.save();
        // Outer shadow disc
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
        // Coloured fill
        ctx.fillStyle = badgeColor;
        ctx.shadowBlur = 10; ctx.shadowColor = badgeColor;
        ctx.beginPath(); ctx.arc(bx, by, 9.5, 0, Math.PI * 2); ctx.fill();
        // Highlight rim
        ctx.strokeStyle = 'rgba(255,255,255,0.40)'; ctx.lineWidth = 1.4;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(bx, by - 1.5, 7.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        // Level number
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "Orbitron",Arial,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(entity.level, bx, by + 0.5);
        ctx.restore();
    }

    /**
     * Low-HP danger pulse ring — drawn in screen space.
     * Shows at < 30 % HP; intensity scales with how low HP is.
     */
    static _drawLowHpGlow(ctx, entity, now, screen) {
        if (!entity.maxHp) return;
        const ratio = entity.hp / entity.maxHp;
        if (ratio >= 0.30) return;
        const severity = 1 - ratio / 0.30;          // 0 → 1 as HP drops from 30 % to 0
        const pulse = 0.22 + Math.sin(now / 100) * 0.18;
        const R = (entity.radius || 18) + 10 + Math.sin(now / 90) * 3;
        ctx.save();
        ctx.globalAlpha = pulse * severity;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 18 + Math.sin(now / 80) * 8;
        ctx.shadowColor = '#ef4444';
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(screen.x, screen.y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    /**
     * Hit flash overlay — white/red burst on body when taking damage.
     * Must be called INSIDE the body ctx.save/translate block (entity-space).
     * @param {CanvasRenderingContext2D} ctx
     * @param {Player} entity
     * @param {number} bodyR  — radius of character body
     */
    static _drawHitFlash(ctx, entity, bodyR) {
        const t = entity._hitFlashTimer ?? 0;
        if (t <= 0) return;
        // Ease out: fast bright → fade
        const alpha = t * (entity._hitFlashBig ? 0.82 : 0.52);
        const r = bodyR + (entity._hitFlashBig ? t * 5 : t * 2);
        ctx.save();
        // Inner body flash — white core
        ctx.globalAlpha = alpha * 0.75;
        ctx.fillStyle = entity._hitFlashBig ? '#fca5a5' : '#fecaca';
        ctx.shadowBlur = entity._hitFlashBig ? 18 : 8;
        ctx.shadowColor = '#ef4444';
        ctx.beginPath(); ctx.arc(0, 0, bodyR, 0, Math.PI * 2); ctx.fill();
        // Outer shockwave ring
        ctx.globalAlpha = alpha * 0.55 * (1 - t * 0.5);
        ctx.strokeStyle = entity._hitFlashBig ? '#ef4444' : '#fca5a5';
        ctx.lineWidth = entity._hitFlashBig ? 2.5 : 1.5;
        ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
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

        // ── Movement vars (declared early — used by ghost, shadow, body) ──
        const breatheAuto = Math.sin(now / 200);
        const speed = Math.hypot(entity.vx, entity.vy);
        const moveT = Math.min(1, speed / 180);
        const bobT = Math.sin(entity.walkCycle * 0.9);
        const stretchX = 1 + breatheAuto * 0.025 + moveT * bobT * 0.09;
        const stretchY = 1 - breatheAuto * 0.025 - moveT * Math.abs(bobT) * 0.065;
        const recoilAmt = entity.weaponRecoil > 0.05 ? entity.weaponRecoil * 3.0 : 0;
        const recoilX = -Math.cos(entity.angle) * recoilAmt;
        const recoilY = -Math.sin(entity.angle) * recoilAmt;
        const bobOffsetY = moveT * Math.abs(Math.sin(entity.walkCycle * 0.9)) * 2.5;
        const R = 15;

        // ── Stand Aura (Signature Auto — แดง/ส้ม) ─────────────
        PlayerRenderer._standAuraDraw(entity, 'auto', ctx);

        // ── Dash Ghost Trail ────────────────────────────────────
        for (const img of (entity.dashGhosts || [])) {
            const gs = worldToScreen(img.x, img.y);
            ctx.save();
            ctx.globalAlpha = img.life * 0.35;
            ctx.fillStyle = '#ef4444';
            ctx.shadowBlur = 10 * img.life;
            ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.arc(gs.x, gs.y, R, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // Ground shadow
        ctx.save();
        ctx.globalAlpha = 0.28 - moveT * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.beginPath(); ctx.ellipse(screen.x, screen.y + 17 + bobOffsetY, 16 - moveT * 2, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── Vacuum Heat range ring (Q cooldown ready) ──────────
        if ((entity.cooldowns?.vacuum ?? 1) <= 0) {
            const VACUUM_RANGE_PX = BALANCE?.characters?.auto?.vacuumRange ?? 320;
            // BUG-10 FIX: camera.scale doesn't exist. Derive pixel-per-world-unit
            // scale from worldToScreen by comparing two world points 1px apart.
            const _s0 = worldToScreen(entity.x, entity.y);
            const _s1 = worldToScreen(entity.x + 1, entity.y);
            const camScale = _s1.x - _s0.x; // px per world unit
            const vacRingR = VACUUM_RANGE_PX * camScale;
            const pulse = 0.14 + Math.sin(now / 420) * 0.09;
            // ขณะ Wanchai + passive: Q = Stand Pull (origin ที่ Stand)
            const isStandPull = entity.wanchaiActive && entity.passiveUnlocked;
            const ringOriginX = isStandPull ? worldToScreen(entity.wanchaiStand?.x ?? entity.x, entity.wanchaiStand?.y ?? entity.y).x : screen.x;
            const ringOriginY = isStandPull ? worldToScreen(entity.wanchaiStand?.x ?? entity.x, entity.wanchaiStand?.y ?? entity.y).y : screen.y;
            ctx.save();
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = isStandPull ? '#dc2626' : '#f97316';
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.shadowBlur = 12; ctx.shadowColor = isStandPull ? '#dc2626' : '#f97316';
            ctx.beginPath(); ctx.arc(ringOriginX, ringOriginY, vacRingR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            // Inner spiral indicator (ready indicator)
            ctx.globalAlpha = pulse * 0.6;
            ctx.strokeStyle = isStandPull ? '#ef4444' : '#fb923c'; ctx.lineWidth = 1;
            ctx.shadowBlur = 6;
            ctx.beginPath(); ctx.arc(ringOriginX, ringOriginY, vacRingR * 0.5, 0, Math.PI * 2); ctx.stroke();
            // Q label — แสดง context ที่ถูก
            const qLabel = isStandPull ? '[Q] STAND PULL' : '[Q] VACUUM';
            ctx.globalAlpha = 0.55 + Math.sin(now / 300) * 0.2;
            ctx.fillStyle = isStandPull ? '#ef4444' : '#f97316';
            ctx.shadowBlur = 8; ctx.shadowColor = isStandPull ? '#dc2626' : '#fb923c';
            ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(qLabel, ringOriginX, ringOriginY - vacRingR - 10);
            ctx.restore();
        }

        // ── Detonation AOE ring — วาดรอบ Stand (blast origin จริง) ───
        if (entity.wanchaiActive) {
            const DET_RANGE_PX = BALANCE?.characters?.auto?.detonationRange ?? 220;
            // ใช้ Stand position เป็น origin (ตรงกับ blast จริงใน AutoPlayer)
            const standX = entity.wanchaiStand?.x ?? entity.x;
            const standY = entity.wanchaiStand?.y ?? entity.y;
            const _ds0 = worldToScreen(standX, standY);
            const _ds1 = worldToScreen(standX + 1, standY);
            const camScale = _ds1.x - _ds0.x;
            const detRingR = DET_RANGE_PX * camScale;
            const detPulse = 0.18 + Math.sin(now / 200) * 0.12;
            ctx.save();
            ctx.globalAlpha = detPulse;
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 6]);
            ctx.shadowBlur = 12; ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.arc(_ds0.x, _ds0.y, detRingR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // ── Feature 3C: Stand Guard visual ─────────────────────
        if (entity._standGuard) {
            ctx.save();
            ctx.globalAlpha = 0.55 + Math.sin(now / 80) * 0.15;
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 18; ctx.shadowColor = '#fbbf24';
            // Shield arc — ครึ่งวงกลมด้านหน้า
            const guardStartA = entity.angle - Math.PI * 0.6;
            const guardEndA = entity.angle + Math.PI * 0.6;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 28 + Math.sin(now / 100) * 3, guardStartA, guardEndA);
            ctx.stroke();
            ctx.globalAlpha = 0.20 + Math.sin(now / 120) * 0.08;
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.moveTo(screen.x, screen.y);
            ctx.arc(screen.x, screen.y, 28, guardStartA, guardEndA);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 0.7;
            ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#fbbf24';
            ctx.shadowBlur = 8; ctx.shadowColor = '#f59e0b';
            ctx.fillText('GUARD', screen.x, screen.y - 35);
            ctx.restore();
        }
        if (entity.wanchaiActive) {
            // Stand Rush Animation — fist fan (local-space rotated) + ORA text
            if (entity.isStandAttacking) {
                const fists = entity._rushFists;
                const stand = entity.wanchaiStand;
                if (fists && fists.length > 0) {
                    const ht = entity._heatTier ?? 0;
                    const oraCombo = entity._oraComboCount ?? 0;
                    // Colors match Stand body — crimson/gold palette
                    const fistCol = ht >= 3 ? '#fef08a' : ht >= 2 ? '#f59e0b' : '#dc2626';
                    const fistColDim = ht >= 3 ? '#92400e' : ht >= 2 ? '#78350f' : '#7f1d1d';
                    const trailHex = ht >= 3 ? '254,240,138' : ht >= 2 ? '245,158,11' : '220,38,38';
                    const goldHex = '245,158,11';
                    const punchAngle = entity.angle;

                    // ── Helper: วาดหมัดกำปั้น Muay Thai ──────────────────────
                    // cx/cy = ตำแหน่งกึ่งกลางหมัด (screen-relative)
                    // sc    = scale (0.5–1.0)
                    // faceA = มุมที่หมัดกำลังชี้/พุ่ง
                    // alpha = ความโปร่งใส
                    const drawGlove = (cx, cy, sc, faceA, alpha) => {
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.rotate(faceA);          // หมุนให้หมัดชี้ไปทิศที่ถูก
                        ctx.globalAlpha = alpha;

                        const W = 13 * sc;  // ความกว้างหมัด
                        const H = 10 * sc;  // ความสูงหมัด

                        // ── Wrist / arm stub (ด้านหลัง) ─────────────────────
                        const wristG = ctx.createLinearGradient(-W * 1.1, 0, -W * 0.3, 0);
                        wristG.addColorStop(0, `rgba(${trailHex},0)`);
                        wristG.addColorStop(1, fistColDim);
                        ctx.fillStyle = wristG;
                        ctx.beginPath();
                        ctx.roundRect(-W * 1.1, -H * 0.45, W * 0.85, H * 0.90, 3 * sc);
                        ctx.fill();

                        // ── Main fist body ────────────────────────────────────
                        // รูปทรงสี่เหลี่ยมมนนิดหน่อย กว้างกว่าสูง (boxing glove proportion)
                        const bodyG = ctx.createRadialGradient(-W * 0.15, -H * 0.25, 0.5, 0, 0, W);
                        bodyG.addColorStop(0, '#ffffff');
                        bodyG.addColorStop(0.18, fistCol);
                        bodyG.addColorStop(0.65, fistCol);
                        bodyG.addColorStop(1, fistColDim);
                        ctx.fillStyle = bodyG;
                        ctx.shadowBlur = 18 * sc; ctx.shadowColor = fistCol;
                        ctx.beginPath();
                        ctx.roundRect(-W * 0.35, -H * 0.50, W * 1.35, H, 4 * sc);
                        ctx.fill();

                        // ── Thumb bump (ด้านบน) ──────────────────────────────
                        ctx.fillStyle = fistCol;
                        ctx.shadowBlur = 0;
                        ctx.beginPath();
                        ctx.ellipse(W * 0.25, -H * 0.48, W * 0.30, H * 0.28, -0.3, 0, Math.PI * 2);
                        ctx.fill();

                        // ── 4 Knuckle ridges (ด้านหน้า leading edge) ──────────
                        ctx.shadowBlur = 8 * sc; ctx.shadowColor = '#ffffff';
                        for (let k = 0; k < 4; k++) {
                            const ky = -H * 0.32 + k * (H * 0.22);
                            const kw = W * 0.16;
                            const kh = H * 0.15;
                            const kG = ctx.createRadialGradient(W * 0.88, ky, 0, W * 0.88, ky, kw);
                            kG.addColorStop(0, 'rgba(255,255,255,0.90)');
                            kG.addColorStop(0.5, `rgba(${trailHex},0.55)`);
                            kG.addColorStop(1, `rgba(${trailHex},0)`);
                            ctx.fillStyle = kG;
                            ctx.beginPath();
                            ctx.ellipse(W * 0.88, ky, kw, kh, 0.2, 0, Math.PI * 2);
                            ctx.fill();
                        }

                        // ── Rim stroke ────────────────────────────────────────
                        ctx.shadowBlur = 0;
                        ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.25).toFixed(2)})`;
                        ctx.lineWidth = 1.2 * sc;
                        ctx.beginPath();
                        ctx.roundRect(-W * 0.35, -H * 0.50, W * 1.35, H, 4 * sc);
                        ctx.stroke();

                        ctx.restore();
                    };

                    ctx.save();
                    ctx.translate(screen.x, screen.y);

                    // ── Layout: fists เรียงแนวเดียวในทิศ punchAngle ─────────
                    // spacing แบบ staggered — ด้านขวาซ้ายสลับกัน ±sideOffset
                    // ระยะ dist เพิ่มตาม index → ดูเหมือนหมัดพุ่งออกมาต่อเนื่อง
                    const COUNT = fists.length;   // 7 (hit) or 4 (miss)
                    const SPACING = 16;             // px ระหว่างหมัดตาม forward axis
                    const SIDE_AMP = 5;              // px สลับซ้ายขวา (เพิ่มความมีชีวิต)
                    const perpA = punchAngle + Math.PI / 2; // แกนตั้งฉาก

                    for (let i = 0; i < COUNT; i++) {
                        const f = fists[i];
                        if (f.alpha <= 0) continue;

                        // ระยะตาม forward axis: หมัดแรก = ใกล้สุด, หมัดหลัง = ไกลสุด
                        const forwardDist = 38 + i * SPACING;
                        const sideDrift = Math.sin(i * Math.PI) * SIDE_AMP * f.sc; // สลับซ้ายขวา

                        const fx = Math.cos(punchAngle) * forwardDist + Math.cos(perpA) * sideDrift;
                        const fy = Math.sin(punchAngle) * forwardDist + Math.sin(perpA) * sideDrift;

                        // Trail: ตาม forward axis กลับทาง
                        const trailLen = 28 * f.sc;
                        const t0x = fx - Math.cos(punchAngle) * trailLen;
                        const t0y = fy - Math.sin(punchAngle) * trailLen;
                        const trailG = ctx.createLinearGradient(t0x, t0y, fx, fy);
                        trailG.addColorStop(0, `rgba(${trailHex},0)`);
                        trailG.addColorStop(1, `rgba(${trailHex},${(f.alpha * 0.55).toFixed(2)})`);
                        ctx.save();
                        ctx.strokeStyle = trailG;
                        ctx.lineWidth = 8 * f.sc;
                        ctx.lineCap = 'round';
                        ctx.globalAlpha = f.alpha;
                        ctx.beginPath(); ctx.moveTo(t0x, t0y); ctx.lineTo(fx, fy); ctx.stroke();
                        ctx.restore();

                        // วาดหมัด
                        const gloveScale = 0.60 + (i / (COUNT - 1)) * 0.40; // หมัดแรกเล็ก → หมัดหลังใหญ่
                        drawGlove(fx, fy, f.sc * gloveScale, punchAngle, f.alpha);
                    }

                    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
                    ctx.restore();

                    // ORA BARRAGE text — แสดงเมื่อ punch และ fade ออก (ไม่กระพริบ)
                    const oraTimer = entity._oraTextTimer ?? 0;
                    if (oraTimer > 0) {
                        ctx.save();
                        // alpha: เต็มในช่วงแรก (0.45→0.15s) แล้วค่อย fade (0.15→0s)
                        const fadeAlpha = Math.min(1, oraTimer / 0.15);
                        // scale: โตขึ้นตาม combo แต่ไม่ pulse
                        const comboScale = 1 + oraCombo * 0.022;
                        const jx = screen.x;
                        const jy = screen.y - 82;
                        ctx.globalAlpha = fadeAlpha;
                        ctx.scale(comboScale, comboScale);
                        ctx.font = '900 28px "Arial Black", Arial, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.lineWidth = 7; ctx.strokeStyle = '#3d0000';
                        ctx.strokeText('ORA ORA ORA!', jx, jy);
                        ctx.lineWidth = 3; ctx.strokeStyle = oraCombo >= 5 ? '#fef08a' : '#f59e0b';
                        ctx.shadowBlur = 22; ctx.shadowColor = oraCombo >= 5 ? '#fef08a' : '#f59e0b';
                        ctx.strokeText('ORA ORA ORA!', jx, jy);
                        ctx.fillStyle = oraCombo >= 5 ? '#fef08a' : '#ffffff'; ctx.shadowBlur = 16;
                        ctx.fillText('ORA ORA ORA!', jx, jy);
                        ctx.restore();
                    }
                }
            }
        }

        // ── Feature 3B: Charge Punch ring (E hold ขณะ Wanchai) ────────
        if (entity.wanchaiActive && entity._eHeld && entity._chargeTimer > 0) {
            const chargeRatio = Math.min(1, (entity._chargeTimer ?? 0) / (entity.stats?.chargeMaxTime ?? 1.5));
            const standScreen = worldToScreen(entity.wanchaiStand?.x ?? entity.x, entity.wanchaiStand?.y ?? entity.y);
            const isReady = entity._chargeReady ?? false;

            ctx.save();
            ctx.globalAlpha = 0.6 + chargeRatio * 0.4;
            ctx.strokeStyle = isReady ? '#facc15' : chargeRatio >= 0.5 ? '#f59e0b' : '#dc2626';
            ctx.lineWidth = 2 + chargeRatio * 3;
            ctx.shadowBlur = 12 + chargeRatio * 8;
            ctx.shadowColor = isReady ? '#facc15' : '#f59e0b';

            // Pulsing charge ring
            const pulseRadius = 35 + chargeRatio * 15 + Math.sin(now / 100) * 3;
            // Arc proportional to charge progress (ไม่เต็มวงจนกว่าจะ MAX)
            ctx.beginPath();
            ctx.arc(standScreen.x, standScreen.y, pulseRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
            ctx.stroke();

            // Inner ring + MAX text เมื่อใกล้เต็ม
            if (chargeRatio >= 0.8) {
                ctx.globalAlpha = (chargeRatio - 0.8) * 3;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath();
                ctx.arc(standScreen.x, standScreen.y, pulseRadius - 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            if (isReady) {
                ctx.globalAlpha = 0.95;
                ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillStyle = '#fef08a';
                ctx.shadowBlur = 10; ctx.shadowColor = '#facc15';
                ctx.fillText('MAX!', standScreen.x, standScreen.y - pulseRadius - 10);
            }

            ctx.restore();
        }

        const attackIntensity = entity.wanchaiActive ? 1.0
            : Math.min(1, (Math.abs(entity.vx) + Math.abs(entity.vy)) / 150 + 0.2);
        const ventGlow = Math.max(0, attackIntensity * (0.5 + Math.sin(now / 180) * 0.5));

        // ════ LAYER 1 — BODY ════
        ctx.save();
        ctx.translate(screen.x + recoilX, screen.y + recoilY + bobOffsetY);
        ctx.scale(stretchX * facingSign, stretchY);

        // ── Heat Tier Body Color Shift — COLD/WARM/HOT/OVERHEAT ──
        const heatTier = entity._heatTier ?? 0;  // 0=COLD, 1=WARM, 2=HOT, 3=OVERHEAT

        ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(220,38,38,0.75)';
        ctx.strokeStyle = 'rgba(220,38,38,0.55)'; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // Body gradient — shifts warmer per tier
        const bG = ctx.createRadialGradient(-4, -4, 1, 0, 0, R);
        if (heatTier === 0) {
            // COLD — original dark crimson
            bG.addColorStop(0, '#7f1d1d');
            bG.addColorStop(0.5, '#5a0e0e');
            bG.addColorStop(1, '#2d0606');
        } else if (heatTier === 1) {
            // WARM — body has a soft orange glow bleeding through
            bG.addColorStop(0, '#9a2a14');
            bG.addColorStop(0.5, '#6b1a0a');
            bG.addColorStop(1, '#3a1204');
        } else if (heatTier === 2) {
            // HOT — saturated orange-crimson, brighter
            bG.addColorStop(0, '#c84a10');
            bG.addColorStop(0.5, '#952208');
            bG.addColorStop(1, '#5c1404');
        } else {
            // OVERHEAT — near-white core, full crimson outer
            bG.addColorStop(0, '#fff3e0');
            bG.addColorStop(0.25, '#fb923c');
            bG.addColorStop(0.6, '#dc2626');
            bG.addColorStop(1, '#7f1d1d');
        }
        ctx.fillStyle = bG;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();

        // ── WARM: subtle orange body glow rim ──
        if (heatTier === 1) {
            const warmPulse = 0.15 + Math.sin(now / 320) * 0.08;
            ctx.save();
            ctx.globalAlpha = warmPulse;
            ctx.strokeStyle = '#fb923c'; ctx.lineWidth = 2;
            ctx.shadowBlur = 12; ctx.shadowColor = '#f97316';
            ctx.beginPath(); ctx.arc(0, 0, R + 1, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        // ── HOT: hair tips glow orange-hot ──
        // (handled in spike tip section below via ventGlow override)

        // ── OVERHEAT: full crimson body rim + steam vent bursts ──
        if (heatTier === 3) {
            const ohPulse = 0.55 + Math.sin(now / 90) * 0.35;
            ctx.save();
            ctx.globalAlpha = ohPulse;
            ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3.5;
            ctx.shadowBlur = 22; ctx.shadowColor = '#fb923c';
            ctx.beginPath(); ctx.arc(0, 0, R + 2, 0, Math.PI * 2); ctx.stroke();
            // Extra outer ring
            ctx.globalAlpha = ohPulse * 0.45;
            ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 1.5;
            ctx.shadowBlur = 14; ctx.shadowColor = '#facc15';
            ctx.beginPath(); ctx.arc(0, 0, R + 7 + Math.sin(now / 80) * 2, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            // Steam vent bursts (bright vents at overheat)
            ctx.save();
            ctx.globalAlpha = 0.75 + Math.sin(now / 70) * 0.22;
            ctx.shadowBlur = 20; ctx.shadowColor = '#fb923c';
            for (let vi = 0; vi < 3; vi++) {
                const steamA = 0.55 + Math.sin(now / 90 + vi * 1.2) * 0.35;
                ctx.globalAlpha = steamA;
                ctx.fillStyle = vi % 2 === 0 ? '#fb923c' : '#fef08a';
                ctx.beginPath(); ctx.roundRect(-R, -5 + vi * 5, 5, 3, 1.5); ctx.fill();
                ctx.beginPath(); ctx.roundRect(R - 5, -5 + vi * 5, 5, 3, 1.5); ctx.fill();
            }
            ctx.restore();
        }

        // Specular highlight
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.beginPath(); ctx.arc(-5, -6, 6, 0, Math.PI * 2); ctx.fill();

        // ── Armor plate overlay (clipped inside body) ─────
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
        // Upper shoulder plates
        ctx.fillStyle = 'rgba(120,20,20,0.65)';
        ctx.beginPath(); ctx.roundRect(-R, -R, R * 0.7, R * 0.9, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(R * 0.25, -R, R * 0.8, R * 0.9, 2); ctx.fill();
        // Plate divider lines
        ctx.strokeStyle = 'rgba(153,27,27,0.55)'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(-R * 0.25, -R); ctx.lineTo(-R * 0.25, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R * 0.25, -R); ctx.lineTo(R * 0.25, 0); ctx.stroke();
        // Rivets
        ctx.fillStyle = 'rgba(220,38,38,0.45)';
        for (const [rx, ry] of [[-R * 0.45, -R * 0.6], [R * 0.45, -R * 0.6], [-R * 0.45, -R * 0.2], [R * 0.45, -R * 0.2]]) {
            ctx.beginPath(); ctx.arc(rx, ry, 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // Heat vents — upgraded with gradient slots
        ctx.shadowBlur = 10 * ventGlow; ctx.shadowColor = '#fb923c';
        for (let vi = 0; vi < 3; vi++) {
            const va = ventGlow * (0.45 + vi * 0.18);
            const ventG = ctx.createLinearGradient(-R, 0, -R + 4, 0);
            ventG.addColorStop(0, `rgba(251,146,60,${va * 1.2})`);
            ventG.addColorStop(1, `rgba(239,68,68,${va * 0.6})`);
            ctx.fillStyle = ventG;
            ctx.beginPath(); ctx.roundRect(-R, -4 + vi * 5, 4, 2.5, 1); ctx.fill();
            const ventGR = ctx.createLinearGradient(R - 4, 0, R, 0);
            ventGR.addColorStop(0, `rgba(239,68,68,${va * 0.6})`);
            ventGR.addColorStop(1, `rgba(251,146,60,${va * 1.2})`);
            ctx.fillStyle = ventGR;
            ctx.beginPath(); ctx.roundRect(R - 4, -4 + vi * 5, 4, 2.5, 1); ctx.fill();
        }
        ctx.shadowBlur = 0;

        // ── Hexagonal Power Core (upgrade from roundRect) ──
        const cP = Math.max(0, 0.4 + Math.sin(now / 200) * 0.5) * (entity.wanchaiActive ? 1.5 : 1);
        const hexCR = 5.5;
        ctx.save();
        ctx.translate(0, 3);
        ctx.beginPath();
        for (let hi = 0; hi < 6; hi++) {
            const ha = (hi / 6) * Math.PI * 2 - Math.PI / 6;
            if (hi === 0) ctx.moveTo(Math.cos(ha) * hexCR, Math.sin(ha) * hexCR);
            else ctx.lineTo(Math.cos(ha) * hexCR, Math.sin(ha) * hexCR);
        }
        ctx.closePath();
        const hexG = ctx.createRadialGradient(0, 0, 0, 0, 0, hexCR);
        hexG.addColorStop(0, `rgba(255,200,200,${Math.min(1, cP * 0.9)})`);
        hexG.addColorStop(0.5, `rgba(239,68,68,${Math.min(1, cP)})`);
        hexG.addColorStop(1, `rgba(153,27,27,${cP * 0.7})`);
        ctx.fillStyle = hexG;
        ctx.shadowBlur = 14 * cP; ctx.shadowColor = '#dc2626';
        ctx.fill();
        ctx.strokeStyle = `rgba(252,165,165,${cP * 0.7})`; ctx.lineWidth = 1;
        ctx.stroke();
        // Hex inner dot
        ctx.fillStyle = `rgba(255,220,220,${cP * 0.9})`;
        ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.shadowBlur = 0;

        if (entity.wanchaiActive) {
            const hA = 0.35 + Math.sin(now / 90) * 0.20;  // faster pulse when Stand active
            ctx.save();
            ctx.globalAlpha = hA;
            ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5;
            ctx.shadowBlur = 12; ctx.shadowColor = '#f97316';
            ctx.beginPath(); ctx.arc(0, 0, R + 6, 0, Math.PI * 2); ctx.stroke();
            // UPGRADE: outer amber pulse ring (stronger intensity)
            ctx.globalAlpha = hA * 0.65;
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3.5;
            ctx.shadowBlur = 28; ctx.shadowColor = '#fbbf24';
            ctx.beginPath(); ctx.arc(0, 0, R + 14 + Math.sin(now / 110) * 3, 0, Math.PI * 2); ctx.stroke();
            // UPGRADE: third ripple ring (large, fast-pulsing, low alpha)
            ctx.globalAlpha = hA * 0.28;
            ctx.strokeStyle = '#f97316'; ctx.lineWidth = 2;
            ctx.shadowBlur = 18; ctx.shadowColor = '#f97316';
            ctx.beginPath(); ctx.arc(0, 0, R + 22 + Math.sin(now / 80) * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            // UPGRADE: body vibrate shimmer — rapid horizontal offset shimmer overlay
            const vibShim = Math.sin(now / 40) * 1.8;  // fast horizontal micro-jitter
            ctx.save();
            ctx.globalAlpha = 0.20 + Math.sin(now / 60) * 0.10;
            ctx.translate(vibShim, 0);
            ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 1;
            ctx.shadowBlur = 8; ctx.shadowColor = '#facc15';
            ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
            ctx.restore();
        }

        // UPGRADE: Passive golden aura when unlocked
        if (entity.passiveUnlocked) {
            const gA = 0.12 + Math.sin(now / 300) * 0.07;
            ctx.save();
            ctx.globalAlpha = gA;
            ctx.strokeStyle = '#facc15'; ctx.lineWidth = 2.5;
            ctx.shadowBlur = 18; ctx.shadowColor = '#facc15';
            ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.arc(0, 0, R + 20 + Math.sin(now / 220) * 4, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
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
        // Wobble period: fast when berserk (wanchaiActive), normal otherwise
        const hairPeriod = entity.wanchaiActive ? 150 : 380;
        for (const [bx, tipOff, h, col] of spikeData) {
            const wobble = Math.sin(now / hairPeriod + bx * 0.4) * 1.2;
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
        // Spike tips — gradient per spike + ember corona
        spikeData.forEach(([bx, tipOff, h], idx) => {
            const wobble = Math.sin(now / hairPeriod + bx * 0.4) * 1.2;
            const tx = bx + tipOff + wobble;
            const ty = -R - 1 - h - wobble * 0.4;
            // Spike fill gradient — dark base to bright tip
            const sg = ctx.createLinearGradient(bx, -R - 1, tx, ty);
            sg.addColorStop(0, '#5c1010');
            // HOT/OVERHEAT: spike tips glow significantly brighter
            if (heatTier >= 2) {
                sg.addColorStop(0.5, '#ef4444');
                sg.addColorStop(1, heatTier === 3 ? '#fef08a' : '#fb923c');
            } else {
                sg.addColorStop(0.6, '#b91c1c');
                sg.addColorStop(1, '#f97316');
            }
            // Re-fill spike with gradient (on top of flat fill)
            ctx.fillStyle = sg;
            ctx.globalAlpha = heatTier >= 2 ? 0.90 : 0.75;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(bx - 3.5, -R - 1);
            ctx.lineTo(bx + 3.5, -R - 1);
            ctx.lineTo(tx, ty);
            ctx.closePath(); ctx.fill();
            // Tip ember glow — enhanced at HOT/OVERHEAT
            const eBaseA = heatTier >= 2 ? 0.80 : 0.65;
            const eA = (entity.wanchaiActive ? 0.95 : eBaseA) + Math.sin(now / 200 + idx) * 0.25;
            ctx.globalAlpha = Math.max(0, Math.min(1, eA));
            // HOT: orange tips; OVERHEAT: yellow-white tips
            const tipColor = heatTier === 3 ? '#fef08a' : (heatTier === 2 ? '#fb923c' : (idx % 2 === 0 ? '#f97316' : '#ef4444'));
            ctx.fillStyle = tipColor;
            ctx.shadowBlur = entity.wanchaiActive ? 14 : (heatTier >= 2 ? 12 : 7);
            ctx.shadowColor = heatTier >= 2 ? '#f97316' : '#f97316';
            ctx.beginPath(); ctx.arc(tx, ty, heatTier >= 2 ? 3.0 : 2.2, 0, Math.PI * 2); ctx.fill();
            // Tiny spark above tip (wanchai or OVERHEAT)
            if ((entity.wanchaiActive || heatTier === 3) && Math.sin(now / 120 + idx * 1.5) > 0.5) {
                ctx.globalAlpha = heatTier === 3 ? 0.95 : 0.8;
                ctx.fillStyle = heatTier === 3 ? '#ffffff' : '#fef08a';
                ctx.shadowBlur = 10; ctx.shadowColor = '#facc15';
                ctx.beginPath(); ctx.arc(tx + Math.sin(now / 80 + idx) * 1.5, ty - 4, heatTier === 3 ? 1.5 : 1, 0, Math.PI * 2); ctx.fill();
            }
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

        // ── Hit Flash ──────────────────────────────────────────
        PlayerRenderer._drawHitFlash(ctx, entity, R);

        // Energy Shield
        if (entity.hasShield) PlayerRenderer._drawEnergyShield(ctx, now);

        ctx.restore(); // end LAYER 1
        ctx.save();
        ctx.translate(screen.x + recoilX, screen.y + recoilY + bobOffsetY);
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

        // Low-HP danger glow (screen space)
        PlayerRenderer._drawLowHpGlow(ctx, entity, now, screen);

        // ── Draw WanchaiStand entity AFTER Auto body+weapon (z-order: Stand on top) ──
        if (entity.wanchaiStand?.active) {
            entity.wanchaiStand.draw(ctx);
        }

        // BUG-8 FIX: Heat shimmer particles belong in update(), not draw().
        // Removed Math.random() + spawnParticles() call from draw path.
        // Particle spawning for heat shimmer is handled by AutoPlayer.update().

        // Level badge
        PlayerRenderer._drawLevelBadge(ctx, screen, entity, 'rgba(185,28,28,0.92)', 22, -22);
    }

    // ══════════════════════════════════════════════════════════
    // POOM PLAYER
    // เดิมคือ PoomPlayer.draw()
    // ══════════════════════════════════════════════════════════

    static _drawPoom(entity, ctx) {
        const isFacingLeft = Math.abs(entity.angle) > Math.PI / 2;
        const facingSign = isFacingLeft ? -1 : 1;

        // ── Movement vars (declared early — used by ghost, shadow, body) ──
        const now2 = performance.now();
        const breathePoom = Math.sin(now2 / 200);
        const speed2 = Math.hypot(entity.vx, entity.vy);
        const moveT2 = Math.min(1, speed2 / 190);
        const bobT2 = Math.sin(entity.walkCycle);
        const stretchX2 = 1 + breathePoom * 0.035 + moveT2 * bobT2 * 0.12;
        const stretchY2 = 1 - breathePoom * 0.035 - moveT2 * Math.abs(bobT2) * 0.09;
        const poomRecoilAmt = entity.weaponRecoil > 0.05 ? entity.weaponRecoil * 2.5 : 0;
        const poomRecoilX = -Math.cos(entity.angle) * poomRecoilAmt;
        const poomRecoilY = -Math.sin(entity.angle) * poomRecoilAmt;
        const poomBobY = moveT2 * Math.abs(Math.sin(entity.walkCycle)) * 2.0;
        const R2 = 13;

        PlayerRenderer._standAuraDraw(entity, 'poom', ctx);

        // Dash ghost trail — เขียวมรกต match body Poom
        for (const img of entity.dashGhosts) {
            const s = worldToScreen(img.x, img.y);
            ctx.save();
            ctx.globalAlpha = img.life * 0.35;
            ctx.fillStyle = '#34d399';
            ctx.shadowBlur = 8 * img.life; ctx.shadowColor = '#10b981';
            ctx.beginPath(); ctx.arc(s.x, s.y, R2 + 1, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        const screen = worldToScreen(entity.x, entity.y);

        // Ground shadow
        ctx.save();
        ctx.globalAlpha = 0.28 - moveT2 * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.beginPath(); ctx.ellipse(screen.x, screen.y + 16 + poomBobY, 14 - moveT2 * 2, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

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
            // BUG-7 FIX: Replaced Math.random() with deterministic sin-based orbit dot
            {
                const sa = ct * 2.3; // deterministic angle
                ctx.globalAlpha = 0.55 + Math.sin(ct * 3.1) * 0.35;
                ctx.fillStyle = '#34d399'; ctx.shadowBlur = 8; ctx.shadowColor = '#10b981';
                ctx.beginPath(); ctx.arc(screen.x + Math.cos(sa) * cr, screen.y + Math.sin(sa) * cr, 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();

            if (nagaEntity.segments && nagaEntity.segments.length > 0) {
                const nagaHead = nagaEntity.segments[0];
                const nagaScreen = worldToScreen(nagaHead.x, nagaHead.y);
                const lifeAlpha = Math.min(1, nagaEntity.life / nagaEntity.maxLife);
                // HP-scaled glow: brighter/thicker when naga is healthy
                const hpGlow = lifeAlpha;
                const SEGS = 16;   // more segments = smoother serpentine wave
                const pts = [];
                const now_t = performance.now();
                const dx = nagaScreen.x - screen.x;
                const dy = nagaScreen.y - screen.y;
                const dist = Math.hypot(dx, dy);
                const perp = Math.atan2(dy, dx) + Math.PI / 2;

                for (let i = 0; i <= SEGS; i++) {
                    const t = i / SEGS;
                    const bx = screen.x + dx * t;
                    const by = screen.y + dy * t;
                    // Serpentine: sin-wave amplitude peaks at midpoint, tapers at ends
                    const midFactor = Math.sin(t * Math.PI);
                    // Two overlapping waves for organic serpent motion
                    const wave1 = Math.sin(t * Math.PI * 2.5 - now_t / 180) * 10 * midFactor;
                    const wave2 = Math.sin(t * Math.PI * 1.2 - now_t / 240 + 1.0) * 5 * midFactor;
                    const totalWave = (wave1 + wave2) * hpGlow;
                    pts.push({
                        x: bx + Math.cos(perp) * totalWave,
                        y: by + Math.sin(perp) * totalWave
                    });
                }
                pts[0] = { x: screen.x, y: screen.y };
                pts[SEGS] = { x: nagaScreen.x, y: nagaScreen.y };

                const drawThread = (lw, alpha, color, blur) => {
                    ctx.save();
                    ctx.globalAlpha = lifeAlpha * alpha;
                    ctx.strokeStyle = color; ctx.lineWidth = lw;
                    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.shadowBlur = blur * hpGlow; ctx.shadowColor = '#10b981';
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    // Smooth bezier through all points
                    for (let i = 1; i < pts.length - 1; i++) {
                        const cpx = (pts[i].x + pts[i + 1].x) / 2;
                        const cpy = (pts[i].y + pts[i + 1].y) / 2;
                        ctx.quadraticCurveTo(pts[i].x, pts[i].y, cpx, cpy);
                    }
                    ctx.lineTo(pts[SEGS].x, pts[SEGS].y);
                    ctx.stroke();
                    ctx.restore();
                };
                // Outer glow layer (thick, dim) — scales with HP
                drawThread(4 + hpGlow * 3, 0.20 + hpGlow * 0.12, '#10b981', 20);
                // Scale pattern (mid layer) — gold shimmer at high HP
                const scaleColor = hpGlow > 0.6 ? '#34d399' : '#10b981';
                drawThread(2, 0.55 + hpGlow * 0.25, scaleColor, 10);
                // Bright spine (thin, crisp)
                drawThread(1, 0.90, '#6ee7b7', 6);

                // ── Scale segment ticks along tether ──
                ctx.save();
                const tickCount = Math.floor(SEGS * 0.6);
                for (let i = 2; i < tickCount; i += 2) {
                    const p = pts[i];
                    const pn = pts[Math.min(i + 1, SEGS)];
                    const tickA = Math.atan2(pn.y - p.y, pn.x - p.x) + Math.PI / 2;
                    const tLen = 2.5 * hpGlow;
                    ctx.globalAlpha = lifeAlpha * 0.45;
                    ctx.strokeStyle = '#34d399'; ctx.lineWidth = 0.8;
                    ctx.shadowBlur = 4; ctx.shadowColor = '#10b981';
                    ctx.beginPath();
                    ctx.moveTo(p.x + Math.cos(tickA) * tLen, p.y + Math.sin(tickA) * tLen);
                    ctx.lineTo(p.x - Math.cos(tickA) * tLen, p.y - Math.sin(tickA) * tLen);
                    ctx.stroke();
                }
                ctx.restore();

                ctx.save();
                ctx.globalAlpha = lifeAlpha * (0.7 + Math.sin(performance.now() / 120) * 0.3);
                ctx.fillStyle = '#34d399'; ctx.shadowBlur = 14; ctx.shadowColor = '#10b981';
                ctx.beginPath(); ctx.arc(screen.x, screen.y, 4, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
        }

        // ════ LAYER 1 — BODY ════
        ctx.save();
        ctx.translate(screen.x + poomRecoilX, screen.y + poomRecoilY + poomBobY);
        ctx.scale(stretchX2 * facingSign, stretchY2);

        // Dual outer ring — purple base + gold shimmer
        ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(168,85,247,0.65)';
        ctx.strokeStyle = 'rgba(168,85,247,0.45)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, R2 + 2, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        const outerPulse = 0.18 + Math.sin(now2 / 400) * 0.12;
        ctx.strokeStyle = `rgba(251,191,36,${outerPulse})`; ctx.lineWidth = 1.2;
        ctx.shadowBlur = 6 * outerPulse; ctx.shadowColor = '#fbbf24';
        ctx.beginPath(); ctx.arc(0, 0, R2 + 4.5, 0, Math.PI * 2); ctx.stroke();
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
        const kranokAlpha = (0.30 + Math.sin(kranokT2 * 1.3) * 0.15) * (1 - moveT2 * 0.35);
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

        // ── Lotus Bloom — expands and orbits body when passive unlocked ──
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, R2 - 1, 0, Math.PI * 2); ctx.clip();
        const lotusA = 0.35 + Math.sin(now2 / 320) * 0.18;
        ctx.globalAlpha = lotusA;
        ctx.fillStyle = '#fde68a'; ctx.shadowBlur = 8; ctx.shadowColor = '#fbbf24';
        // 4 small petals around center diamond (always visible on body)
        for (let pi = 0; pi < 4; pi++) {
            const pa = pi * Math.PI / 2 + Math.PI / 4;
            ctx.save();
            ctx.translate(Math.cos(pa) * 4.5, Math.sin(pa) * 4.5);
            ctx.rotate(pa);
            ctx.beginPath();
            ctx.ellipse(0, 0, 1.2, 2.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
        ctx.globalAlpha = 1;

        // ── Passive unlock: 8 outer petals orbit and bloom around body ──
        if (entity.passiveUnlocked) {
            const bloomAngle = now2 / 1800;    // slow orbit
            const bloomPulse = 0.7 + Math.sin(now2 / 380) * 0.3;   // breathing bloom
            const orbitR = R2 + 7 + bloomPulse * 3;
            const PETAL_COUNT = 8;
            ctx.save();
            for (let pi = 0; pi < PETAL_COUNT; pi++) {
                const pa = (pi / PETAL_COUNT) * Math.PI * 2 + bloomAngle;
                const pA = (0.55 + Math.sin(now2 / 260 + pi * 0.8) * 0.28) * bloomPulse;
                ctx.save();
                ctx.translate(Math.cos(pa) * orbitR, Math.sin(pa) * orbitR);
                ctx.rotate(pa + Math.PI / 2);
                ctx.globalAlpha = pA;
                // Petal shape — elongated ellipse, pink-gold gradient
                const pG = ctx.createRadialGradient(0, 0, 0, 0, 0, 4.5);
                pG.addColorStop(0, '#fef3c7');
                pG.addColorStop(0.5, '#fde68a');
                pG.addColorStop(1, 'rgba(251,191,36,0)');
                ctx.fillStyle = pG;
                ctx.shadowBlur = 6 * bloomPulse; ctx.shadowColor = '#fbbf24';
                ctx.beginPath();
                ctx.ellipse(0, 0, 2.0, 4.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
            // Center lotus glow (visible outside body clip)
            ctx.globalAlpha = bloomPulse * 0.30;
            ctx.fillStyle = '#fde68a';
            ctx.shadowBlur = 14 * bloomPulse; ctx.shadowColor = '#fbbf24';
            ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
        }

        // ── Floating scroll orbit — signature cultural detail ──
        ctx.save();
        const scrollOrbitR = R2 + 10;
        const scrollAngle = now2 / 1200;
        const sx = Math.cos(scrollAngle) * scrollOrbitR;
        const sy = Math.sin(scrollAngle) * scrollOrbitR - 2;
        ctx.translate(sx, sy);
        ctx.rotate(scrollAngle + 0.4);
        const scrollA = 0.55 + Math.sin(now2 / 300) * 0.25;
        ctx.globalAlpha = scrollA;
        ctx.shadowBlur = 8; ctx.shadowColor = '#fbbf24';
        // Scroll body
        ctx.fillStyle = '#fef3c7';
        ctx.beginPath(); ctx.roundRect(-4, -2.5, 8, 5, 1); ctx.fill();
        // Scroll end rolls
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.ellipse(-4, 0, 1.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(4, 0, 1.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        // Tiny text lines on scroll
        ctx.strokeStyle = 'rgba(146,64,14,0.65)'; ctx.lineWidth = 0.6;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.moveTo(-2.5, -0.8); ctx.lineTo(2.5, -0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-2.5, 0.5); ctx.lineTo(2.5, 0.5); ctx.stroke();
        ctx.restore();

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
        // Wobble period: faster when moving (responsive to player motion)
        const poomHairPeriod = 220 + (1 - moveT2) * 280;
        for (const sp of hairSpikes) {
            const tipX = sp.bx + Math.cos(sp.angle) * sp.len;
            const tipY = -R2 - 5 + Math.sin(sp.angle) * sp.len;
            const wob = Math.sin(now2 / poomHairPeriod + sp.bx) * (1.2 + moveT2 * 1.5);
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

        // ── Hit Flash ──────────────────────────────────────────
        PlayerRenderer._drawHitFlash(ctx, entity, R2);

        // Energy Shield
        if (entity.hasShield) PlayerRenderer._drawEnergyShield(ctx, now2);

        ctx.restore(); // end LAYER 1

        // ════ LAYER 2 — WEAPON + HANDS ════
        ctx.save();
        ctx.translate(screen.x + poomRecoilX, screen.y + poomRecoilY + poomBobY);
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

        // Low-HP danger glow (screen space)
        PlayerRenderer._drawLowHpGlow(ctx, entity, now2, screen);

        // ── Garuda Wind Visual — wing-shadow + wind arcs when garudaActive ──
        if (entity.garudaActive) {
            const grdT = now2 / 1;
            const grdScreen = screen;
            const wingPhase = now2 / 220;
            // Wing flap: oscillates between spread and tuck
            const wingSpread = 0.6 + Math.sin(wingPhase) * 0.4;
            ctx.save();
            ctx.translate(grdScreen.x, grdScreen.y);

            // ── Wind arc sweeps (4 arcs rotating around body) ──
            for (let wi = 0; wi < 4; wi++) {
                const arcAngle = (wi / 4) * Math.PI * 2 + now2 / 400;
                const arcAlpha = (0.25 + Math.sin(now2 / 180 + wi * 1.57) * 0.18) * wingSpread;
                const arcR = 30 + wi * 5 + Math.sin(now2 / 250 + wi) * 4;
                ctx.save();
                ctx.globalAlpha = arcAlpha;
                ctx.strokeStyle = wi % 2 === 0 ? '#fde68a' : '#fbbf24';
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 10 * wingSpread; ctx.shadowColor = '#fbbf24';
                ctx.setLineDash([4, 6]);
                ctx.beginPath();
                ctx.arc(0, 0, arcR, arcAngle, arcAngle + Math.PI * 0.6);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }

            // ── Wing silhouettes (left and right) ──
            const wingAlpha = (0.35 + Math.sin(wingPhase) * 0.20) * wingSpread;
            for (const side of [-1, 1]) {
                ctx.save();
                ctx.scale(side, 1);
                ctx.globalAlpha = wingAlpha;

                // Wing body — curved shape spreading outward
                const wG = ctx.createLinearGradient(0, -20, 45 * wingSpread, -5);
                wG.addColorStop(0, 'rgba(251,191,36,0.70)');
                wG.addColorStop(0.5, 'rgba(253,230,138,0.35)');
                wG.addColorStop(1, 'rgba(251,191,36,0)');
                ctx.fillStyle = wG;
                ctx.shadowBlur = 14 * wingSpread; ctx.shadowColor = '#fbbf24';
                ctx.beginPath();
                ctx.moveTo(5, -8);
                ctx.quadraticCurveTo(20 * wingSpread, -28, 44 * wingSpread, -18);
                ctx.quadraticCurveTo(46 * wingSpread, -10, 36 * wingSpread, -2);
                ctx.quadraticCurveTo(18 * wingSpread, 4, 5, 4);
                ctx.closePath();
                ctx.fill();

                // Wing feather edge lines
                ctx.strokeStyle = 'rgba(253,230,138,0.55)'; ctx.lineWidth = 0.8;
                ctx.shadowBlur = 6;
                for (let fi = 0; fi < 4; fi++) {
                    const ft = fi / 3;
                    const fx0 = 5 + ft * 20 * wingSpread;
                    const fy0 = -8 + ft * 6;
                    const fx1 = 10 + ft * 30 * wingSpread;
                    const fy1 = -24 + ft * 10;
                    ctx.globalAlpha = wingAlpha * (0.7 - ft * 0.3);
                    ctx.beginPath();
                    ctx.moveTo(fx0, fy0);
                    ctx.lineTo(fx1, fy1);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // ── Central Garuda glow (golden aura burst) ──
            const garudaCore = 0.20 + Math.sin(now2 / 150) * 0.12;
            ctx.globalAlpha = garudaCore * wingSpread;
            ctx.fillStyle = '#fbbf24';
            ctx.shadowBlur = 22 * wingSpread; ctx.shadowColor = '#f59e0b';
            ctx.beginPath(); ctx.arc(0, 0, 10 + wingSpread * 4, 0, Math.PI * 2); ctx.fill();

            ctx.restore();
        }

        // Level badge
        PlayerRenderer._drawLevelBadge(ctx, screen, entity, 'rgba(217,119,6,0.92)', 20, -20);
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

        // ── Movement vars (declared early — used by ghost, shadow, body) ──
        const breatheKao = Math.sin(now / 200);
        const speed = Math.hypot(entity.vx, entity.vy);
        const moveT = Math.min(1, speed / 200);
        const bobT = Math.sin(entity.walkCycle);
        const stretchX = 1 + breatheKao * 0.030 + moveT * bobT * 0.10;
        const stretchY = 1 - breatheKao * 0.030 - moveT * Math.abs(bobT) * 0.07;
        const kaoBobY = moveT * Math.abs(Math.sin(entity.walkCycle)) * 2.0;
        const R = 13;

        // Dash ghost trail
        for (const img of entity.dashGhosts) {
            const gs = worldToScreen(img.x, img.y);
            ctx.save();
            ctx.globalAlpha = img.life * 0.35;
            ctx.fillStyle = '#60a5fa';
            ctx.shadowBlur = 10 * img.life; ctx.shadowColor = '#3b82f6';
            ctx.beginPath(); ctx.arc(gs.x, gs.y, R + 1, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        const screen = worldToScreen(entity.x, entity.y);

        // Ground shadow (improved — scales with bob)
        ctx.save();
        ctx.globalAlpha = 0.28 - moveT * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.beginPath(); ctx.ellipse(screen.x, screen.y + 15 + kaoBobY, 14 - moveT * 2, 5, 0, 0, Math.PI * 2); ctx.fill();
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

        if (entity.isInvisible || entity.isFreeStealthy) {
            // STEALTH: holographic shimmer + glitch pixel dissolve
            const gT = now / 60;
            ctx.save();
            ctx.translate(screen.x, screen.y);
            ctx.scale(stretchX * facingSign, stretchY);

            // ── Holographic body fill (prismatic iridescent shimmer) ──
            ctx.save();
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
            // Shifting hologram gradient that moves over time
            const holoShift = (now / 800) % 1;
            const holoG = ctx.createLinearGradient(-R, -R, R, R);
            holoG.addColorStop(0, `rgba(6,182,212,${0.08 + Math.sin(gT * 0.7) * 0.04})`);
            holoG.addColorStop(Math.max(0, holoShift - 0.1), `rgba(6,182,212,0.04)`);
            holoG.addColorStop(holoShift, `rgba(180,230,255,${0.22 + Math.sin(gT * 1.3) * 0.10})`);
            holoG.addColorStop(Math.min(1, holoShift + 0.1), `rgba(99,179,237,0.06)`);
            holoG.addColorStop(1, `rgba(56,189,248,${0.06 + Math.sin(gT * 0.9 + 1) * 0.03})`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = holoG;
            ctx.fillRect(-R, -R, R * 2, R * 2);

            // ── Glitch pixel dissolve — scattered rectangular fragments ──
            // Uses deterministic sin pattern — no Math.random()
            const dissolvePixels = [
                [-8, -9, 4, 2], [3, -7, 5, 2], [-5, -4, 3, 2], [6, -2, 4, 2],
                [-9, 2, 5, 2], [2, 5, 6, 2], [-3, 8, 4, 2], [7, 7, 3, 2],
                [-6, -12, 3, 2], [4, -11, 5, 2], [-10, 6, 3, 2], [8, 3, 4, 2],
            ];
            for (let di = 0; di < dissolvePixels.length; di++) {
                const [px, py, pw, ph] = dissolvePixels[di];
                // Each pixel blinks in/out independently via phase-shifted sin
                const pixA = (Math.sin(gT * 3.7 + di * 1.57) * 0.5 + 0.5) * 0.55;
                if (pixA < 0.05) continue;
                ctx.globalAlpha = pixA;
                const hue = (di % 3 === 0) ? '#06b6d4' : (di % 3 === 1) ? '#38bdf8' : '#7dd3fc';
                ctx.fillStyle = hue;
                ctx.shadowBlur = 4; ctx.shadowColor = '#06b6d4';
                ctx.fillRect(px, py, pw, ph);
            }
            ctx.shadowBlur = 0;
            ctx.restore();

            // ── Outer holographic ring (color-shifting) ──
            const ringHue1 = `rgba(6,182,212,${0.20 + Math.sin(gT * 2.1) * 0.10})`;
            const ringHue2 = `rgba(56,189,248,${0.12 + Math.sin(gT * 1.5 + 1) * 0.08})`;
            ctx.globalAlpha = 1;
            ctx.strokeStyle = ringHue1; ctx.lineWidth = 1.5;
            ctx.shadowBlur = 10; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
            ctx.strokeStyle = ringHue2; ctx.lineWidth = 1;
            ctx.shadowBlur = 6; ctx.shadowColor = '#38bdf8';
            ctx.setLineDash([3, 4]);
            ctx.beginPath(); ctx.arc(0, 0, R + 3, gT * 0.8, gT * 0.8 + Math.PI * 1.4); ctx.stroke();
            ctx.setLineDash([]);

            // ── Visor ghost (dim cyan slit — shows even stealthed) ──
            const vGhost = 0.30 + Math.sin(gT * 5) * 0.18;
            ctx.globalAlpha = vGhost;
            ctx.fillStyle = '#06b6d4';
            ctx.shadowBlur = 8; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.roundRect(-5, -3.5, 10, 2, 1); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.restore();

        } else {
            // ════ LAYER 1 — BODY ════
            ctx.save();
            ctx.translate(screen.x + recoilX, screen.y + recoilY + kaoBobY);
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

            // ── Tactical Hood (upgraded) ──────────────────────
            // Main hood silhouette — two-tone with inner panel
            const hoodG = ctx.createLinearGradient(0, -R - 8, 0, 2);
            hoodG.addColorStop(0, '#0d1f38');
            hoodG.addColorStop(0.6, '#0b1623');
            hoodG.addColorStop(1, '#071020');
            ctx.fillStyle = hoodG;
            ctx.beginPath();
            ctx.moveTo(-(R - 1), -1);
            ctx.quadraticCurveTo(-(R + 2), -R * 0.45, -R * 0.35, -R - 5);
            ctx.quadraticCurveTo(0, -R - 8, R * 0.35, -R - 5);
            ctx.quadraticCurveTo(R + 2, -R * 0.45, R - 1, -1);
            ctx.quadraticCurveTo(R * 0.55, 1, 0, 2);
            ctx.quadraticCurveTo(-R * 0.55, 1, -(R - 1), -1);
            ctx.closePath(); ctx.fill();

            // Hood outline with blue edge
            ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2.5;
            ctx.shadowBlur = 5; ctx.shadowColor = '#1d4ed8';
            ctx.beginPath();
            ctx.moveTo(-(R - 1), -1);
            ctx.quadraticCurveTo(-(R + 2), -R * 0.45, -R * 0.35, -R - 5);
            ctx.quadraticCurveTo(0, -R - 8, R * 0.35, -R - 5);
            ctx.quadraticCurveTo(R + 2, -R * 0.45, R - 1, -1);
            ctx.quadraticCurveTo(R * 0.55, 1, 0, 2);
            ctx.quadraticCurveTo(-R * 0.55, 1, -(R - 1), -1);
            ctx.closePath(); ctx.stroke();
            ctx.shadowBlur = 0;

            // Hood inner panel (clipped)
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(-(R - 1), -1);
            ctx.quadraticCurveTo(-(R + 2), -R * 0.45, -R * 0.35, -R - 5);
            ctx.quadraticCurveTo(0, -R - 8, R * 0.35, -R - 5);
            ctx.quadraticCurveTo(R + 2, -R * 0.45, R - 1, -1);
            ctx.quadraticCurveTo(R * 0.55, 1, 0, 2);
            ctx.quadraticCurveTo(-R * 0.55, 1, -(R - 1), -1);
            ctx.clip();
            // Circuit line overlay
            ctx.strokeStyle = 'rgba(59,130,246,0.18)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(-R, -R); ctx.lineTo(-R * 0.3, -R * 0.6); ctx.lineTo(-R * 0.3, -2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(R * 0.1, -R); ctx.lineTo(R * 0.1, -R * 0.5); ctx.lineTo(R * 0.5, -R * 0.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(R, -R * 0.5); ctx.lineTo(R * 0.6, -R * 0.5); ctx.lineTo(R * 0.6, -2); ctx.stroke();
            // Circuit node dots
            ctx.fillStyle = 'rgba(6,182,212,0.45)';
            for (const [nx, ny] of [[-R * 0.3, -R * 0.6], [-R * 0.3, -2], [R * 0.1, -R * 0.5], [R * 0.6, -R * 0.5], [R * 0.6, -2]]) {
                ctx.beginPath(); ctx.arc(nx, ny, 1.2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();

            // Top of hood — dark crown panel
            ctx.fillStyle = '#16304f';
            ctx.beginPath();
            ctx.moveTo(-7, -R - 3);
            ctx.quadraticCurveTo(-2, -R - 6, 3, -R - 5);
            ctx.quadraticCurveTo(1, -R - 1, -3, -R);
            ctx.quadraticCurveTo(-6, -R, -7, -R - 3);
            ctx.closePath(); ctx.fill();

            // Side tactical stripe details
            ctx.strokeStyle = '#1e40af'; ctx.lineWidth = 1;
            ctx.shadowBlur = 4; ctx.shadowColor = '#3b82f6';
            ctx.beginPath(); ctx.moveTo(R * 0.35, -3); ctx.lineTo(R + 1, -2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-R * 0.35, -3); ctx.lineTo(-R - 1, -2); ctx.stroke();
            // Extra small perpendicular tick marks on stripes
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(R * 0.55, -3.5); ctx.lineTo(R * 0.55, -0.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-R * 0.55, -3.5); ctx.lineTo(-R * 0.55, -0.5); ctx.stroke();
            ctx.shadowBlur = 0;

            // ── Dual split visor (upgrade from single slit) ──
            const vp = 0.65 + Math.sin(now / 350) * 0.35;
            const vp2 = 0.55 + Math.sin(now / 280 + 1.2) * 0.35;
            // Left visor shard
            ctx.fillStyle = `rgba(6,182,212,${vp})`;
            ctx.shadowBlur = 14 * vp; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.roundRect(-6.5, -4, 5.5, 2.2, 1.5); ctx.fill();
            // Right visor shard
            ctx.fillStyle = `rgba(56,189,248,${vp2})`;
            ctx.shadowBlur = 10 * vp2; ctx.shadowColor = '#38bdf8';
            ctx.beginPath(); ctx.roundRect(1.5, -4, 5, 2.2, 1.5); ctx.fill();
            // Ambient glow halo behind visor
            ctx.fillStyle = `rgba(6,182,212,${vp * 0.15})`;
            ctx.beginPath(); ctx.roundRect(-7, -6, 14, 6, 3); ctx.fill();
            ctx.shadowBlur = 0;

            // Hex body panel detail (front armour plate)
            ctx.save();
            ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
            ctx.strokeStyle = 'rgba(30,64,175,0.35)'; ctx.lineWidth = 0.9;
            // Mini hexagon on chest area
            const hx = 0, hy = 5, hr = 4.5;
            ctx.beginPath();
            for (let hi = 0; hi < 6; hi++) {
                const ha = (hi / 6) * Math.PI * 2 - Math.PI / 6;
                if (hi === 0) ctx.moveTo(hx + Math.cos(ha) * hr, hy + Math.sin(ha) * hr);
                else ctx.lineTo(hx + Math.cos(ha) * hr, hy + Math.sin(ha) * hr);
            }
            ctx.closePath(); ctx.stroke();
            // Hex fill glow
            ctx.fillStyle = `rgba(6,182,212,${0.08 + Math.sin(now / 400) * 0.04})`;
            ctx.fill();
            ctx.restore();

            // ── Hit Flash ──────────────────────────────────────────
            PlayerRenderer._drawHitFlash(ctx, entity, R);

            // Energy Shield
            if (entity.hasShield) PlayerRenderer._drawEnergyShield(ctx, now);

            ctx.restore(); // end LAYER 1

            // ════ LAYER 2 — WEAPON + HANDS ════
            ctx.save();
            ctx.translate(screen.x + recoilX, screen.y + recoilY + kaoBobY);
            ctx.rotate(entity.angle);
            if (isFacingLeft) ctx.scale(1, -1);

            if (typeof weaponSystem !== 'undefined') weaponSystem.drawWeaponOnPlayer(entity);

            // ── Tactical Energy Gloves (upgraded) ──────────
            const gR = 5;
            // Front glove — main (right)
            const gloveG = ctx.createRadialGradient(R + 4, 0, 0, R + 6, 2, gR);
            gloveG.addColorStop(0, '#1e4a7f');
            gloveG.addColorStop(1, '#0e2340');
            ctx.fillStyle = gloveG;
            ctx.strokeStyle = '#1e3a5f'; ctx.lineWidth = 2.5;
            ctx.shadowBlur = 8; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.arc(R + 6, 2, gR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // Knuckle lines
            ctx.strokeStyle = 'rgba(6,182,212,0.70)'; ctx.lineWidth = 1.0;
            ctx.shadowBlur = 4; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.moveTo(R + 3, 0.5); ctx.lineTo(R + 9, 0.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(R + 3, 2.8); ctx.lineTo(R + 9, 2.8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(R + 3, 4.8); ctx.lineTo(R + 9, 4.8); ctx.stroke();
            // Knuckle energy dot
            const kp = 0.5 + Math.sin(now / 250) * 0.4;
            ctx.fillStyle = `rgba(6,182,212,${kp})`;
            ctx.shadowBlur = 6 * kp; ctx.shadowColor = '#38bdf8';
            ctx.beginPath(); ctx.arc(R + 10.5, 2, 1.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // Back glove (left)
            ctx.fillStyle = '#0e2340'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
            ctx.shadowBlur = 4; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.arc(-(R + 5), 1, gR - 1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(6,182,212,0.40)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(-(R + 2), 0); ctx.lineTo(-(R + 8), 0); ctx.stroke();
            ctx.shadowBlur = 0;

            ctx.restore(); // end LAYER 2

            // Muzzle flash (screen space) — directional sparks + shockwave ring
            if (entity.weaponRecoil > 0.45) {
                const fT = (entity.weaponRecoil - 0.45) / 0.55;
                const mDist = 36 + (1 - fT) * 10;
                const mx = screen.x + Math.cos(entity.angle) * mDist;
                const my = screen.y + Math.sin(entity.angle) * mDist;
                ctx.save();

                // ── Shockwave ring — expands outward as recoil decays ──
                const swR = 4 + (1 - fT) * 18;
                ctx.globalAlpha = fT * 0.65;
                ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 1.5;
                ctx.shadowBlur = 14; ctx.shadowColor = '#06b6d4';
                ctx.beginPath(); ctx.arc(mx, my, swR, 0, Math.PI * 2); ctx.stroke();
                // Second inner ring (offset timing)
                ctx.globalAlpha = fT * 0.35;
                ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1;
                ctx.shadowBlur = 8;
                ctx.beginPath(); ctx.arc(mx, my, swR * 0.55, 0, Math.PI * 2); ctx.stroke();

                // ── Directional spark rays — forward-biased fan ──
                // Forward rays: longer, brighter
                ctx.strokeStyle = '#e0f2fe'; ctx.lineWidth = 1.6;
                ctx.shadowBlur = 12; ctx.shadowColor = '#38bdf8';
                const fwdRays = 5;
                for (let ri = 0; ri < fwdRays; ri++) {
                    const spread = (ri / (fwdRays - 1) - 0.5) * (Math.PI * 0.45);
                    const ra = entity.angle + spread;
                    const rayLen = (8 + fT * 14) * (1 - Math.abs(spread) / (Math.PI * 0.5));
                    ctx.globalAlpha = fT * (0.8 - Math.abs(spread) * 0.6);
                    ctx.beginPath();
                    ctx.moveTo(mx + Math.cos(ra) * 2, my + Math.sin(ra) * 2);
                    ctx.lineTo(mx + Math.cos(ra) * rayLen, my + Math.sin(ra) * rayLen);
                    ctx.stroke();
                }
                // Side scatter rays (short, dim)
                ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1;
                ctx.shadowBlur = 6;
                for (let ri = 0; ri < 4; ri++) {
                    const ra = entity.angle + Math.PI * 0.55 + (ri / 3) * Math.PI * 0.9;
                    ctx.globalAlpha = fT * 0.30;
                    ctx.beginPath();
                    ctx.moveTo(mx + Math.cos(ra) * 2, my + Math.sin(ra) * 2);
                    ctx.lineTo(mx + Math.cos(ra) * (3 + fT * 5), my + Math.sin(ra) * (3 + fT * 5));
                    ctx.stroke();
                }

                // ── Core flash dot ──
                ctx.globalAlpha = fT;
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 12; ctx.shadowColor = '#06b6d4';
                ctx.beginPath(); ctx.arc(mx, my, 2.5 + fT * 1.5, 0, Math.PI * 2); ctx.fill();

                ctx.restore();
            }
        }

        // Low-HP danger glow (screen space)
        PlayerRenderer._drawLowHpGlow(ctx, entity, now, screen);

        // ── Weapon Switch Indicator — flash on body when weapon changes ──
        if ((entity._weaponSwitchFlash ?? 0) > 0) {
            const wsT = entity._weaponSwitchFlash;   // counts down 0.5 → 0
            const wsRatio = wsT / 0.5;               // 1.0 → 0
            const wsAlpha = wsRatio * (0.7 + Math.sin(wsRatio * Math.PI) * 0.3);
            const wsScreen = worldToScreen(entity.x, entity.y);
            // Determine icon character based on current weapon
            const wIcon = (entity.currentWeapon === 'sniper') ? '🎯'
                : (entity.currentWeapon === 'shotgun') ? '💥'
                    : '⚡';
            ctx.save();
            ctx.globalAlpha = wsAlpha;
            // Glow ring around body
            ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2;
            ctx.shadowBlur = 14 * wsRatio; ctx.shadowColor = '#06b6d4';
            ctx.beginPath(); ctx.arc(wsScreen.x, wsScreen.y, 20 + (1 - wsRatio) * 10, 0, Math.PI * 2); ctx.stroke();
            // Weapon icon above head (rises upward as it fades)
            const riseY = wsScreen.y - 28 - (1 - wsRatio) * 14;
            ctx.globalAlpha = wsAlpha * 0.95;
            ctx.font = `${12 + wsRatio * 4}px Arial`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10; ctx.shadowColor = '#06b6d4';
            ctx.fillText(wIcon, wsScreen.x, riseY);
            ctx.restore();
        }

        // Level badge (screen space)
        PlayerRenderer._drawLevelBadge(ctx, screen, entity, 'rgba(180,100,10,0.92)', 20, -20);
    }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.PlayerRenderer = PlayerRenderer;