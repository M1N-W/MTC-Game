// ════════════════════════════════════════════════════════════
// 👊 WANCHAI STAND — Autonomous Stand Entity
//    - Spawned on _activateWanchai(), removed when wanchaiTimer <= 0
//    - Chases nearest enemy independently from the player
//    - Punches automatically (no L-Click required)
//    - Drawn via PlayerRenderer._drawAuto (wanchaiStand overlay)
// ════════════════════════════════════════════════════════════
class WanchaiStand {
    constructor(owner) {
        this.owner = owner;
        this.x = owner.x + Math.cos(owner.angle) * 40;
        this.y = owner.y + Math.sin(owner.angle) * 40;
        this.vx = 0;
        this.vy = 0;
        this.radius = 22;
        this.active = true;

        // Combat timers
        this._atkTimer = 0;         // countdown to next punch
        this._atkRate = 0;         // set from BALANCE each frame
        this._punchPhase = 0;         // 0=idle 1=wind-up 2=strike (visual only)
        this._phaseTimer = 0;
        this.lastPunchSoundTime = 0;

        // Rendering
        this.angle = owner.angle;  // faces toward target
        this.ghostTrail = [];          // [{x,y,alpha}] motion blur
    }

    update(dt) {
        if (!this.active) return;
        const owner = this.owner;
        if (!owner || !owner.wanchaiActive) { this.active = false; return; }

        const S = owner.stats ?? {};
        // ── Heat tier → punch rate multiplier ─────────────
        const ht = owner._heatTier ?? 0;
        const punchRateMult = ht >= 2 ? (S.heatPunchRateHot ?? 0.70)
            : ht >= 1 ? (S.heatPunchRateWarm ?? 0.85) : 1.0;
        this._atkRate = (S.wanchaiPunchRate ?? 0.08) * punchRateMult;
        const atkRange = S.standPunchRange ?? 110;  // hitbox reach
        const chaseSpeed = S.standMoveSpeed ?? 340;  // px/s
        const leashRadius = S.standLeashRadius ?? 420;  // max dist from owner

        // ── Find nearest target (prefers forced cursor target) ──
        let target = null;
        let nearestDist = atkRange * 2.5; // chase range = 2.5× attack range

        // L-Click player input: prioritise enemy nearest to cursor
        const fx = this._forcedTargetX;
        const fy = this._forcedTargetY;
        if (fx !== undefined && fy !== undefined) {
            // Find closest enemy to cursor position
            let bestD = atkRange * 4;
            for (const e of (window.enemies || [])) {
                if (e.dead) continue;
                const d = Math.hypot(e.x - fx, e.y - fy);
                if (d < bestD) { bestD = d; target = e; }
            }
            if (!target && window.boss && !window.boss.dead) {
                const d = Math.hypot(window.boss.x - fx, window.boss.y - fy);
                if (d < bestD) target = window.boss;
            }
            // Clear after use (only applies this frame)
            this._forcedTargetX = undefined;
            this._forcedTargetY = undefined;
        }
        // Fallback: nearest enemy to stand
        if (!target) {
            for (const e of (window.enemies || [])) {
                if (e.dead) continue;
                const d = Math.hypot(e.x - this.x, e.y - this.y);
                if (d < nearestDist) { nearestDist = d; target = e; }
            }
            if (!target && window.boss && !window.boss.dead) {
                const d = Math.hypot(window.boss.x - this.x, window.boss.y - this.y);
                if (d < nearestDist) target = window.boss;
            }
        }

        // ── Movement — chase target, leash to owner ─────────
        if (target) {
            this.angle = Math.atan2(target.y - this.y, target.x - this.x);
            const d = Math.hypot(target.x - this.x, target.y - this.y);
            const step = chaseSpeed * dt;
            if (d > this.radius + (target.radius ?? 14)) {
                this.x += (target.x - this.x) / d * step;
                this.y += (target.y - this.y) / d * step;
            }
        } else {
            // Float near owner when no target
            const ox = owner.x + Math.cos(owner.angle) * 60;
            const oy = owner.y + Math.sin(owner.angle) * 60;
            const d = Math.hypot(ox - this.x, oy - this.y);
            if (d > 12) {
                const step = chaseSpeed * 0.5 * dt;
                this.x += (ox - this.x) / d * step;
                this.y += (oy - this.y) / d * step;
            }
        }

        // Leash — don't stray too far from owner
        const ownerDist = Math.hypot(this.x - owner.x, this.y - owner.y);
        if (ownerDist > leashRadius) {
            const la = Math.atan2(this.y - owner.y, this.x - owner.x);
            this.x = owner.x + Math.cos(la) * leashRadius;
            this.y = owner.y + Math.sin(la) * leashRadius;
        }

        // ── Ghost trail ──────────────────────────────────────
        if (this.ghostTrail.length === 0 || Math.hypot(this.x - this.ghostTrail[0]?.x, this.y - this.ghostTrail[0]?.y) > 8) {
            this.ghostTrail.unshift({ x: this.x, y: this.y, alpha: 0.45 });
            if (this.ghostTrail.length > 6) this.ghostTrail.length = 6;
        }
        for (const g of this.ghostTrail) g.alpha = Math.max(0, g.alpha - dt * 1.8);

        // Decay precomputed rush fists alpha
        if ((this._rushFistTimer ?? 0) > 0) {
            this._rushFistTimer -= dt;
            const fade = this._rushFistTimer / 0.10;
            if (this._rushFists) for (const f of this._rushFists) f.alpha = Math.max(0, fade);
        }

        // ── Attack logic (auto-fires regardless of L-Click) ──
        this._atkTimer -= dt;
        this._phaseTimer = Math.max(0, this._phaseTimer - dt);

        if (this._atkTimer <= 0 && target) {
            const distToTarget = Math.hypot(target.x - this.x, target.y - this.y);
            if (distToTarget < atkRange + (target.radius ?? 14)) {
                this._atkTimer = this._atkRate;
                this._punch(target, owner);
            } else {
                // Still advance timer so we punch the instant we arrive
                this._atkTimer = Math.min(this._atkTimer, 0);
            }
        } else if (this._atkTimer <= 0) {
            this._atkTimer = this._atkRate * 0.5; // idle tick
        }
    }

    _punch(target, owner) {
        const S = owner.stats ?? {};

        // ── Heat gain per punch ────────────────────────────────
        if (typeof owner.gainHeat === 'function') owner.gainHeat(S.heatPerHit ?? 12);

        // ── Heat tier damage multiplier ────────────────────────
        const tier = owner._heatTier ?? 0;
        const heatDmgMult = tier >= 3 ? (S.heatDmgOverheat ?? 1.50)
            : tier >= 2 ? (S.heatDmgHot ?? 1.30)
                : tier >= 1 ? (S.heatDmgWarm ?? 1.15) : 1.0;

        let dmg = (S.wanchaiDamage ?? 32) * (owner.damageMultiplier || 1.0) * heatDmgMult;

        // Second Wind bonus
        if (owner.isSecondWind) dmg *= (BALANCE?.player?.secondWindDamageMult || 1.5);

        // Crit
        let critChance = (owner.baseCritChance ?? 0.06) + (S.standCritBonus ?? 0.25);  // BUG-5 fix: was 0.40
        if (owner.passiveUnlocked) critChance += (S.passiveCritBonus ?? 0);
        // OVERHEAT crit bonus
        if ((owner._heatTier ?? 0) >= 3) critChance += (S.heatCritBonusOverheat ?? 0.20);
        const isCrit = Math.random() < critChance;
        if (isCrit) {
            dmg *= (S.critMultiplier ?? 2.0);
            if (owner.passiveUnlocked) owner.goldenAuraTimer = 1;
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.crits = (Achievements.stats.crits ?? 0) + 1;
                Achievements.check?.('crit_master');
            }
        }

        target.takeDamage(dmg, owner);

        // Lifesteal
        if (owner.passiveUnlocked) {
            owner.hp = Math.min(owner.maxHp, owner.hp + dmg * (S.passiveLifesteal ?? 0.01));  // BUG-4 fix: was 0.02
        }

        // Knockback — push enemy away from stand
        const ka = Math.atan2(target.y - this.y, target.x - this.x);
        const kf = S.standKnockback ?? 180;
        target.vx = (target.vx ?? 0) + Math.cos(ka) * kf;
        target.vy = (target.vy ?? 0) + Math.sin(ka) * kf;

        // VFX
        if (typeof spawnParticles === 'function')
            spawnParticles(target.x, target.y, isCrit ? 5 : 3, isCrit ? '#facc15' : '#ef4444');
        if (typeof addScreenShake === 'function') addScreenShake(isCrit ? 5 : 2);
        if (isCrit && typeof spawnFloatingText === 'function')
            spawnFloatingText('วันชัย!', this.x, this.y - 30, '#facc15', 18);

        // Punch animation -- alternate fist side each hit
        this._punchPhase = 2;
        this._phaseTimer = 0.12;
        this._punchSide = (this._punchSide ?? 1) * -1;

        // Precompute rush fists positions for Stand Rush overlay (no Math.random in draw)
        this._rushFists = this._rushFists ?? [];
        this._rushFists.length = 0;
        for (let i = 0; i < 7; i++) {
            this._rushFists.push({
                ox: 38 + Math.random() * 75,
                oy: (Math.random() - 0.5) * 60,
                sc: 0.45 + Math.random() * 0.65,
                alpha: 1.0
            });
        }
        this._rushFistTimer = 0.10; // fade out over 100ms

        // Sound
        const now = Date.now();
        if (now - this.lastPunchSoundTime > 60) {
            if (typeof Audio !== 'undefined' && Audio.playStandRush) Audio.playStandRush();
            this.lastPunchSoundTime = now;
        }

        // Kill bonus: +Heat + heal (only during Wanchai)
        if (target.hp !== undefined && target.hp <= 0 && owner.wanchaiActive) {
            const S2 = owner.stats ?? {};
            if (typeof owner.gainHeat === 'function') owner.gainHeat(S2.heatOnKillWanchai ?? 15);
            const healPct = S2.heatHealOnKillWanchai ?? 0.08;
            owner.hp = Math.min(owner.maxHp, owner.hp + owner.maxHp * healPct);
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(`+${Math.floor(owner.maxHp * healPct)}hp 🔥`, owner.x, owner.y - 55, '#4ade80', 16);
        }
    }

    draw(ctx) {
        if (!this.active || typeof ctx === 'undefined') return;
        const now = performance.now();
        const sc = worldToScreen(this.x, this.y);
        const t = now / 1000;
        const owner = this.owner;

        // ── HEAT TIER COLORS ─────────────────────────────────────
        // Base: Ice-blue/white ghost — contrasts sharply with Auto red
        // HOT/OVERHEAT: core flares amber/red to signal escalation
        const ht = owner?._heatTier ?? 0;
        const coreCol = ht >= 3 ? '#f97316' : ht >= 2 ? '#fbbf24' : ht >= 1 ? '#67e8f9' : '#a5f3fc';
        const auraCol = ht >= 3 ? 'rgba(249,115,22,' : ht >= 2 ? 'rgba(251,191,36,' : 'rgba(103,232,249,';
        const punchCol = ht >= 2 ? '#fbbf24' : '#e0f2fe';

        const isPunch = this._phaseTimer > 0;
        const flashT = isPunch ? Math.min(1, this._phaseTimer / 0.12) : 0;
        const side = this._punchSide ?? 1;
        const facingL = Math.abs(this.angle) > Math.PI / 2;
        const fs = facingL ? -1 : 1;

        // ── Fighter bob oscillators (pre-computed once) ──
        const bob = Math.sin(t * 3.2);         // weight shift bob
        const sway = bob * 1.8;                 // horizontal rock
        const breathe = Math.sin(t * 2.1) * 0.8; // torso expand
        const eyeFlick = Math.sin(t * 8.5);       // eye intensity

        // ═══ LAYER 0 — Ghost trail (cyan-white afterimage) ═══════════════════
        for (let i = this.ghostTrail.length - 1; i >= 0; i--) {
            const g = this.ghostTrail[i];
            const ga = g.alpha * 0.30;
            if (ga < 0.02) continue;
            const gs = worldToScreen(g.x, g.y);
            ctx.save();
            ctx.globalAlpha = ga;
            ctx.shadowBlur = 10; ctx.shadowColor = coreCol;
            // Muay Thai silhouette ghost — head + torso only
            ctx.fillStyle = coreCol;
            ctx.beginPath(); ctx.arc(gs.x, gs.y - 18, 8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(gs.x, gs.y + 4, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // ═══ LAYER 1 — Spectral halo / aura ══════════════════════════════════
        {
            const hw = 24 + breathe * 2;
            const ha = isPunch ? 0.28 + flashT * 0.22 : 0.12 + breathe * 0.04;
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.2);
            const hG = ctx.createRadialGradient(0, 0, 2, 0, 0, hw + 10);
            hG.addColorStop(0, `${auraCol}${Math.min(1, ha * 2.2)})`);
            hG.addColorStop(0.4, `${auraCol}${ha})`);
            hG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = hG;
            ctx.shadowBlur = isPunch ? 32 : 16; ctx.shadowColor = coreCol;
            ctx.beginPath(); ctx.ellipse(0, 0, hw, hw * 0.55, 0, 0, Math.PI * 2); ctx.fill();
            // Punch burst shockwave ring
            if (isPunch && flashT > 0.08) {
                ctx.globalAlpha = flashT * 0.65;
                ctx.strokeStyle = punchCol; ctx.lineWidth = 2.5;
                ctx.shadowBlur = 22; ctx.shadowColor = punchCol;
                ctx.beginPath(); ctx.arc(0, 0, 28 + (1 - flashT) * 18, 0, Math.PI * 2); ctx.stroke();
                // Second ring
                ctx.globalAlpha = flashT * 0.30;
                ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.arc(0, 0, 40 + (1 - flashT) * 14, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        }

        // ═══ LAYER 2 — Lower-body fade (spirit dissolves below waist) ════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.35);
            const fadeG = ctx.createLinearGradient(0, 10, 0, 36);
            fadeG.addColorStop(0, ht >= 2 ? 'rgba(180,120,20,0.75)' : 'rgba(20,100,140,0.70)');
            fadeG.addColorStop(0.5, ht >= 2 ? 'rgba(100,40,0,0.30)' : 'rgba(10,50,90,0.28)');
            fadeG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = fadeG; ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.moveTo(-14, 10);
            ctx.quadraticCurveTo(-17, 26, 0, 36);
            ctx.quadraticCurveTo(17, 26, 14, 10);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }

        // ═══ LAYER 3 — Torso (Muay Thai physique) ════════════════════════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.35);
            ctx.scale(fs, 1);

            // Main torso — wider shoulders, strong V-taper
            // Muay Thai fighters: broad shoulder line, narrow waist
            const tCol1 = ht >= 2 ? '#4a2800' : '#0c3a52';
            const tCol2 = ht >= 2 ? '#7c4500' : '#0e4f6e';
            const tCol3 = ht >= 2 ? '#1a0800' : '#061c2e';
            const tG = ctx.createRadialGradient(-4, -6, 1, 0, 2, 18);
            tG.addColorStop(0, tCol2);
            tG.addColorStop(0.6, tCol1);
            tG.addColorStop(1, tCol3);
            ctx.fillStyle = tG;
            ctx.globalAlpha = 0.90 + breathe * 0.06;
            ctx.shadowBlur = isPunch ? 20 : 10; ctx.shadowColor = coreCol;

            // Broader shoulder, fighter V-shape
            ctx.beginPath();
            ctx.moveTo(-17, -2);          // left shoulder — wide
            ctx.quadraticCurveTo(-20, 8, -13, 22);
            ctx.lineTo(13, 22);
            ctx.quadraticCurveTo(20, 8, 17, -2);
            ctx.quadraticCurveTo(0, -6, -17, -2);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;

            // Pec definition lines
            ctx.strokeStyle = `${auraCol}0.22)`;
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(-16, 0); ctx.quadraticCurveTo(-8, 4, 0, 3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(16, 0); ctx.quadraticCurveTo(8, 4, 0, 3); ctx.stroke();

            // Mongkhon (headband rope) wrapped around upper chest — signature Muay Thai
            const mongkCol = ht >= 2 ? '#fbbf24' : '#38bdf8';
            ctx.strokeStyle = mongkCol; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
            ctx.shadowBlur = 6; ctx.shadowColor = mongkCol;
            ctx.globalAlpha = 0.70;
            ctx.beginPath();
            ctx.moveTo(-14, 0);
            ctx.quadraticCurveTo(0, -4, 14, 0);
            ctx.stroke();
            // Mongkhon knot dots
            ctx.fillStyle = mongkCol; ctx.globalAlpha = 0.80;
            ctx.beginPath(); ctx.arc(-14, 0, 2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(14, 0, 2, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;

            // Spectral energy core (hexagonal, same as Auto but different color)
            const cp = Math.max(0.3, 0.5 + Math.sin(now / 180) * 0.45) * (isPunch ? 1.6 : 1.0);
            const cr = 5;
            ctx.save(); ctx.translate(0, 13);
            ctx.beginPath();
            for (let hi = 0; hi < 6; hi++) {
                const ha = (hi / 6) * Math.PI * 2 - Math.PI / 6;
                hi === 0 ? ctx.moveTo(Math.cos(ha) * cr, Math.sin(ha) * cr)
                    : ctx.lineTo(Math.cos(ha) * cr, Math.sin(ha) * cr);
            }
            ctx.closePath();
            const cG = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
            cG.addColorStop(0, `rgba(255,255,255,${Math.min(1, cp * 0.9)})`);
            cG.addColorStop(0.5, `${auraCol}${Math.min(1, cp)})`);
            cG.addColorStop(1, `${auraCol}${cp * 0.4})`);
            ctx.fillStyle = cG;
            ctx.shadowBlur = 12 * cp; ctx.shadowColor = coreCol;
            ctx.fill();
            ctx.strokeStyle = `${auraCol}${cp * 0.6})`; ctx.lineWidth = 0.8; ctx.stroke();
            ctx.restore();

            ctx.restore(); // end torso
        }

        // ═══ LAYER 4 — Arms (Muay Thai guard stance) ════════════════════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.35);
            ctx.scale(fs, 1);

            // MUAY THAI GUARD: front arm raised (guard), rear arm cocked for power punch
            // xDir: +1 = lead arm (right in screen space), -1 = rear arm (power)
            const drawArm = (xDir, isActive) => {
                // Lead arm (guard): elbow up, forearm crosses centerline
                // Rear arm (power): hip level, wound back for cross punch
                const isLead = xDir > 0;
                const elbX = isLead ? xDir * 14 : xDir * 10;
                const elbY = isLead ? -8 : 2;   // lead arm elbow is HIGH (guard)
                const idleX = isLead ? xDir * 18 : xDir * 22;
                const idleY = isLead ? -12 + bob * 1.2 : 6 + bob * 0.5;
                // Strike: lead = straight jab forward, rear = haymaker cross
                const hitX = isActive ? (isLead ? xDir * 38 : xDir * 32) : idleX;
                const hitY = isActive ? (isLead ? -6 : -4) : idleY;
                const fX = hitX, fY = hitY;

                // Upper arm
                ctx.strokeStyle = ht >= 2 ? '#5a3a00' : '#0a2e45';
                ctx.lineWidth = 6;
                ctx.lineCap = 'round';
                ctx.shadowBlur = isActive ? 14 : 4; ctx.shadowColor = coreCol;
                ctx.globalAlpha = 0.90;
                ctx.beginPath();
                ctx.moveTo(xDir * 15, -2);
                ctx.quadraticCurveTo(elbX + (isActive ? xDir * 4 : 0), elbY, fX, fY);
                ctx.stroke();

                // Forearm (second segment for more humanoid look)
                ctx.lineWidth = 5;
                ctx.strokeStyle = ht >= 2 ? '#7c5200' : '#0e4060';
                ctx.globalAlpha = 0.82;

                // Muay Thai glove (fist)
                const fR = isActive ? 8.5 : 7;
                const gloveColA = isActive ? (ht >= 2 ? '#f97316' : '#0ea5e9') : (ht >= 2 ? '#7c4500' : '#0c4a6e');
                const gloveColB = isActive ? (ht >= 2 ? '#dc2626' : '#0284c7') : (ht >= 2 ? '#3d1f00' : '#082f49');
                const fBg = ctx.createRadialGradient(fX - 2, fY - 2, 0.5, fX, fY, fR);
                fBg.addColorStop(0, isActive ? 'rgba(255,255,255,0.90)' : gloveColA);
                fBg.addColorStop(0.45, gloveColA);
                fBg.addColorStop(1, gloveColB);
                ctx.fillStyle = fBg;
                ctx.strokeStyle = isActive ? `${auraCol}0.80)` : 'rgba(0,0,0,0.5)';
                ctx.lineWidth = 1.2;
                ctx.shadowBlur = isActive ? 18 + flashT * 16 : 6;
                ctx.shadowColor = isActive ? punchCol : coreCol;
                ctx.globalAlpha = isActive ? 0.95 + flashT * 0.05 : 0.78;
                ctx.beginPath(); ctx.arc(fX, fY, fR, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();

                // Glove lace lines (wrapping tape detail)
                ctx.globalAlpha = isActive ? 0.55 : 0.30;
                ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.45)';
                ctx.lineWidth = 0.9;
                for (let k = 0; k < 3; k++) {
                    ctx.beginPath();
                    ctx.moveTo(fX - fR * 0.6, fY - fR * 0.20 + k * 2.2);
                    ctx.lineTo(fX + fR * 0.6, fY - fR * 0.20 + k * 2.2);
                    ctx.stroke();
                }

                // Impact burst on active fist (bigger and more dramatic)
                if (isActive && flashT > 0.10) {
                    const bX = fX + xDir * 5;
                    // Primary burst
                    ctx.globalAlpha = flashT * 0.90;
                    ctx.fillStyle = 'white';
                    ctx.shadowBlur = 24; ctx.shadowColor = punchCol;
                    ctx.beginPath(); ctx.arc(bX, fY, 6 + flashT * 7, 0, Math.PI * 2); ctx.fill();
                    // Color overlay
                    ctx.fillStyle = punchCol; ctx.globalAlpha = flashT * 0.60;
                    ctx.beginPath(); ctx.arc(bX, fY, 3 + flashT * 4, 0, Math.PI * 2); ctx.fill();
                    // Star-burst spikes (8 direction)
                    ctx.strokeStyle = punchCol; ctx.lineWidth = 1.2;
                    for (let r = 0; r < 8; r++) {
                        const ra = (r / 8) * Math.PI * 2 + t * 6;
                        ctx.globalAlpha = flashT * 0.55;
                        ctx.beginPath();
                        ctx.moveTo(bX + Math.cos(ra) * 5, fY + Math.sin(ra) * 5);
                        ctx.lineTo(bX + Math.cos(ra) * 17, fY + Math.sin(ra) * 17);
                        ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            };

            drawArm(1, isPunch && side > 0);   // lead arm
            drawArm(-1, isPunch && side < 0);  // power arm
            ctx.restore();
        }

        // ═══ LAYER 5 — Head (Spirit face — angular, hollow eyes) ═════════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + bob * 1.5); // bob = fighter weight shift
            ctx.scale(fs, 1);

            const hy = -26 + breathe * 0.6; // head center, slightly higher (taller fighter)

            // Neck
            ctx.fillStyle = ht >= 2 ? '#3d1a00' : '#082f49'; ctx.globalAlpha = 0.75;
            ctx.beginPath(); ctx.roundRect(-4, hy + 10, 8, 7, 1); ctx.fill();

            // ── MONGKHON HEADBAND — before head so it clips under ──
            const mkBandY = hy - 3;
            const mkCol = ht >= 2 ? '#f59e0b' : '#38bdf8';
            ctx.shadowBlur = 8; ctx.shadowColor = mkCol;
            ctx.fillStyle = mkCol; ctx.globalAlpha = 0.80;
            ctx.beginPath(); ctx.roundRect(-13, mkBandY, 26, 4.5, 2); ctx.fill();
            // Mongkhon ribbon tie on side
            ctx.strokeStyle = mkCol; ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.65;
            ctx.beginPath();
            ctx.moveTo(13, mkBandY + 2); ctx.lineTo(18, mkBandY); ctx.lineTo(17, mkBandY + 5);
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Head base — spirit skin (slightly translucent, slightly inhuman)
            const hG = ctx.createRadialGradient(-3, hy - 4, 1, 0, hy, 12);
            hG.addColorStop(0, ht >= 2 ? '#a86030' : '#336688');   // warm/cold skin
            hG.addColorStop(0.55, ht >= 2 ? '#7a3a14' : '#1a4d6e');
            hG.addColorStop(1, ht >= 2 ? '#3d1500' : '#091f30');
            ctx.fillStyle = hG;
            ctx.globalAlpha = 0.88;
            ctx.shadowBlur = isPunch ? 16 : 7; ctx.shadowColor = coreCol;
            ctx.beginPath(); ctx.arc(0, hy, 12, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // ── Short cropped hair ──
            ctx.fillStyle = '#050505'; ctx.globalAlpha = 0.90;
            ctx.beginPath(); ctx.arc(0, hy, 12, Math.PI * 1.05, Math.PI * 2.0); ctx.closePath(); ctx.fill();
            // Hair texture line
            ctx.strokeStyle = 'rgba(80,40,0,0.20)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.arc(0, hy, 10, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();

            // ── Hollow spirit eyes — key distinguisher from Auto ──
            // Outer glow first
            const eyeY = hy + 1;
            ctx.shadowBlur = isPunch ? 18 : 10; ctx.shadowColor = coreCol;

            // Eye sockets — dark recesses
            ctx.fillStyle = '#000408'; ctx.globalAlpha = 0.95;
            ctx.beginPath(); ctx.ellipse(-4.5, eyeY, 4, 2.2, -0.08, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4.5, eyeY, 4, 2.2, 0.08, 0, Math.PI * 2); ctx.fill();

            // Spirit glow irises — no pupils (completely hollow glow)
            const eyeIntensity = Math.max(0.6, 0.7 + eyeFlick * 0.3) * (isPunch ? 1.4 : 1.0);
            const mkEye = (x, y) => {
                const eG = ctx.createRadialGradient(x, y, 0, x, y, 3.5);
                eG.addColorStop(0, `rgba(255,255,255,${Math.min(1, eyeIntensity)})`);
                eG.addColorStop(0.4, `${auraCol}${Math.min(1, eyeIntensity * 0.9)})`);
                eG.addColorStop(1, `${auraCol}0.0)`);
                return eG;
            };
            ctx.fillStyle = mkEye(-4.5, eyeY);
            ctx.globalAlpha = 0.95;
            ctx.beginPath(); ctx.ellipse(-4.5, eyeY, 3.5, 1.9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = mkEye(4.5, eyeY);
            ctx.beginPath(); ctx.ellipse(4.5, eyeY, 3.5, 1.9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // Eye gleam streaks (horizontal — otherworldly)
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.7;
            ctx.globalAlpha = 0.55;
            ctx.beginPath(); ctx.moveTo(-7, eyeY); ctx.lineTo(-2, eyeY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(2, eyeY); ctx.lineTo(7, eyeY); ctx.stroke();

            // ── Heavy angular brows — warrior intensity ──
            ctx.strokeStyle = '#080000'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
            ctx.globalAlpha = 0.95;
            // Left brow — severe inward angle
            ctx.beginPath();
            ctx.moveTo(-11, hy - 4); ctx.lineTo(-2, hy - 6.5);
            ctx.stroke();
            // Right brow — mirror
            ctx.beginPath();
            ctx.moveTo(2, hy - 6.5); ctx.lineTo(11, hy - 4);
            ctx.stroke();
            // Unibrow crease at nose bridge (intense warrior expression)
            ctx.lineWidth = 1.8; ctx.strokeStyle = '#1a0000';
            ctx.beginPath();
            ctx.moveTo(-3, hy - 6); ctx.quadraticCurveTo(0, hy - 3.5, 3, hy - 6);
            ctx.stroke();

            // Battle scar — diagonal on right cheek
            ctx.strokeStyle = 'rgba(200,80,30,0.60)'; ctx.lineWidth = 1.1;
            ctx.globalAlpha = 0.70;
            ctx.beginPath(); ctx.moveTo(5, eyeY + 2.5); ctx.lineTo(9, eyeY + 6.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(6, eyeY + 3.0); ctx.lineTo(8, eyeY + 5.5); ctx.stroke();

            // Tight warrior mouth — set jaw
            ctx.strokeStyle = ht >= 2 ? '#7c4500' : '#0a3a5a';
            ctx.lineWidth = 1.8; ctx.lineCap = 'round';
            ctx.globalAlpha = 0.80;
            ctx.beginPath(); ctx.moveTo(-4.5, hy + 8); ctx.lineTo(4.5, hy + 8); ctx.stroke();
            // Jaw clench lines
            ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.65;
            ctx.beginPath(); ctx.moveTo(-7, hy + 5); ctx.lineTo(-7, hy + 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(7, hy + 5); ctx.lineTo(7, hy + 8); ctx.stroke();

            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            ctx.restore(); // end head
        }

        // ═══ LAYER 6 — Name chip ════════════════════════════════════════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + bob * 0.5);
            const chipY = -52;
            const cA = 0.60 + Math.sin(t * 2.1) * 0.15;

            // Punch flash ring behind chip
            if (isPunch && flashT > 0.08) {
                ctx.globalAlpha = flashT * 0.75;
                ctx.strokeStyle = punchCol; ctx.lineWidth = 2.2;
                ctx.shadowBlur = 24; ctx.shadowColor = punchCol;
                ctx.beginPath(); ctx.arc(0, chipY, 28 + (1 - flashT) * 12, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // Pill bg
            ctx.globalAlpha = cA * 0.75;
            ctx.fillStyle = 'rgba(0,8,18,0.80)';
            ctx.strokeStyle = isPunch
                ? `rgba(255,255,255,${0.50 + flashT * 0.50})`
                : `${auraCol}0.60)`;
            ctx.lineWidth = isPunch ? 1.8 : 1.0;
            ctx.shadowBlur = isPunch ? 14 : 8;
            ctx.shadowColor = isPunch ? punchCol : coreCol;
            ctx.beginPath(); ctx.roundRect(-22, chipY - 6, 44, 12, 4);
            ctx.fill(); ctx.stroke();

            // Heat tier badge (left side of chip)
            if (ht > 0) {
                const tierMark = ht >= 3 ? '💥' : ht >= 2 ? '🔥🔥' : '🔥';
                ctx.globalAlpha = cA * 0.95;
                ctx.font = 'bold 7px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillStyle = ht >= 3 ? '#facc15' : ht >= 2 ? '#f97316' : '#fb923c';
                ctx.fillText(tierMark, -21, chipY);
            }

            // Label
            ctx.globalAlpha = cA;
            ctx.fillStyle = isPunch ? '#ffffff' : coreCol;
            ctx.font = 'bold 7.5px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = isPunch ? 12 : 5;
            ctx.shadowColor = isPunch ? punchCol : coreCol;
            ctx.fillText('WANCHAI', 0, chipY);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🔥 AUTO PLAYER — Thermodynamic Brawler + Stand "Wanchai"
// ════════════════════════════════════════════════════════════
class AutoPlayer extends Player {
    constructor(x = 0, y = 0) {
        super('auto');
        this.x = x;
        this.y = y;

        // ── Passive behaviour flags (overrides PlayerBase defaults) ──────────
        this.passiveSpeedBonus = 0;     // Auto ไม่มี passive speed bonus
        this.usesOwnLifesteal = false;  // ใช้ base lifesteal logic ปกติ

        this.wanchaiActive = false;
        this.wanchaiTimer = 0;

        this._punchTimer = 0;
        this._heatTimer = 0;

        // ── NEW: Stand Rush State ────────────────────────────────
        this.isStandAttacking = false;
        this.standAttackTimer = 0;
        this.lastPunchSoundTime = 0;

        this.cooldowns = { ...(this.cooldowns || {}), dash: this.cooldowns?.dash ?? 0, stealth: this.cooldowns?.stealth ?? 0, shoot: 0, wanchai: 0, vacuum: 0, detonation: 0 };

        // ── Heat Gauge (implements config heatMax/heatTier* system) ──
        this.heat = 0;              // 0–100
        this._heatTier = 0;        // 0=COLD 1=WARM 2=HOT 3=OVERHEAT
        this._heatTierLabel = '';  // for HUD floating text throttle

        // ── Passive unlock flag: ตั้งเป็น true ครั้งแรกที่ถึง OVERHEAT ──
        // checkPassiveUnlock() อ่าน flag นี้แทน passiveUnlockLevel
        this._hasReachedOverheat = false;

        // ── Wanchai Stand entity (created on activation) ──────
        this.wanchaiStand = null;
    }

    takeDamage(amt) {
        // ── Energy Shield block (checked before Wanchai reduction) ──
        if (this.isDashing) return;
        if (this.hasShield) {
            this.hasShield = false;
            spawnFloatingText('🛡️ BLOCKED!', this.x, this.y - 40, '#8b5cf6', 22);
            spawnParticles(this.x, this.y, 20, '#c4b5fd');
            if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
            return;
        }
        // ── Graph Risk: ยืนบนเลเซอร์ → รับดาเมจ x1.5 ─────────
        if (this.onGraph) {
            amt *= 1.5;
            spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16);
        }
        const reduction = this.wanchaiActive ? (this.stats?.standDamageReduction ?? 0.30) : 0;  // fix: was 0.5 ≠ config 0.30
        const scaled = amt * (1 - reduction);
        // Heat gain from damage taken
        const heatGain = scaled * (this.stats?.heatPerDamageTaken ?? 0.5);
        if (heatGain > 0) this.gainHeat(heatGain);

        // ── RAGE MODE: ลด incoming damage 20% ขณะ rage (trade: ยังรับดาเมจ HP drain) ──
        const rageReduction = this._rageMode ? (this.stats?.rageDamageReduction ?? 0.20) : 0;
        super.takeDamage(scaled * (1 - rageReduction));
    }

    dealDamage(baseDamage) {
        // Temporarily boost baseCritChance during calculation if Stand is active
        const originalCrit = this.baseCritChance;
        if (this.wanchaiActive) {
            this.baseCritChance += (this.stats?.standCritBonus ?? 0.25);  // BUG-5 fix: was 0.50
        }

        const result = super.dealDamage(baseDamage);

        // Restore original crit for state safety
        this.baseCritChance = originalCrit;

        // ── Graph Buff: ยืนบนเลเซอร์ระยะ 3 → ดาเมจ x1.5 ──────
        if ((this.graphBuffTimer ?? 0) > 0) result.damage *= 1.5;

        // ── RAGE MODE: ดาเมจ x1.3 ขณะ OVERHEAT + HP ต่ำ ────────
        // ออกแบบ: เสี่ยงตายแต่ได้ดาเมจสูงขึ้น — quintessential brawler fantasy
        if (this._rageMode) result.damage *= (this.stats?.rageDamageMult ?? 1.30);

        return result;
    }

    _activateWanchai() {
        // WARN-1 FIX: BALANCE was refactored — correct path is
        // BALANCE.characters.auto, not the stale BALANCE.player.auto
        const dur = this.stats?.wanchaiDuration ?? BALANCE.characters?.auto?.wanchaiDuration ?? 3.0;
        const cd = this.stats?.wanchaiCooldown ?? BALANCE.characters?.auto?.wanchaiCooldown ?? 12;

        this.wanchaiActive = true;
        this.wanchaiTimer = dur;
        this.cooldowns.wanchai = cd;
        this._punchTimer = 0;

        // ── Spawn WanchaiStand autonomous entity ─────────────
        this.wanchaiStand = new WanchaiStand(this);

        if (typeof spawnFloatingText === 'function') {
            spawnFloatingText('STAND: WANCHAI!', this.x, this.y - 90, '#dc2626', 34);
        }
        if (typeof spawnParticles === 'function') {
            spawnParticles(this.x, this.y, 18, '#dc2626', 'steam');
        }
    }

    // ── Heat Gauge — call from _punch / _doPlayerMelee / takeDamage ─────────
    gainHeat(amount) {
        const S = this.stats ?? {};
        const bonus = this.passiveUnlocked ? (S.passiveHeatGainBonus ?? 1.25) : 1.0;
        this.heat = Math.min(S.heatMax ?? 100, this.heat + amount * bonus);

        // ── Tier transition floating text (throttled — once per tier change) ──
        const newTier = this.heat >= (S.heatTierOverheat ?? 100) ? 3
            : this.heat >= (S.heatTierHot ?? 67) ? 2
                : this.heat >= (S.heatTierWarm ?? 34) ? 1 : 0;
        if (newTier > this._heatTier) {
            this._heatTier = newTier;
            const labels = ['', '🔥 WARM', '🔥🔥 HOT!', '💥 OVERHEATED!!'];
            const colors = ['', '#fb923c', '#ef4444', '#facc15'];
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(labels[newTier], this.x, this.y - 80, colors[newTier], 22);
            if (typeof addScreenShake === 'function' && newTier === 3) addScreenShake(4);

            // ── PASSIVE UNLOCK TRIGGER: ครั้งแรกที่ถึง OVERHEAT ──────────────
            // ตั้ง flag แล้วส่งต่อให้ checkPassiveUnlock() ตัดสินใจ
            // (guard !passiveUnlocked เพื่อไม่ยิง floating text ซ้ำ)
            if (newTier === 3 && !this._hasReachedOverheat && !this.passiveUnlocked) {
                this._hasReachedOverheat = true;
                this.checkPassiveUnlock();
            }
        }
        this._heatTier = newTier; // always sync downward too
    }

    update(dt, keys, mouse) {
        if (this.cooldowns?.wanchai > 0) this.cooldowns.wanchai -= dt;
        if (this.cooldowns?.shoot > 0) this.cooldowns.shoot -= dt;
        if (this.cooldowns?.vacuum > 0) this.cooldowns.vacuum -= dt;
        if (this.cooldowns?.detonation > 0) this.cooldowns.detonation -= dt;

        // ── Heat Gauge tick ───────────────────────────────────────
        {
            const S = this.stats ?? {};
            const decayRate = this.wanchaiActive
                ? (S.heatDecayRateActive ?? 0)
                : (S.heatDecayRate ?? 8);
            this.heat = Math.max(0, this.heat - decayRate * dt);

            // Sync tier downward (gainHeat handles upward)
            const newTier = this.heat >= (S.heatTierOverheat ?? 100) ? 3
                : this.heat >= (S.heatTierHot ?? 67) ? 2
                    : this.heat >= (S.heatTierWarm ?? 34) ? 1 : 0;
            this._heatTier = newTier;

            // OVERHEAT: HP drain
            if (newTier === 3) {
                const drain = (S.heatHpDrainOverheat ?? 3) * dt;
                this.hp = Math.max(1, this.hp - drain);
            }

            // ── RAGE MODE: OVERHEAT + HP ต่ำกว่า 30% → damage buff + slow immunity ──
            // ออกแบบเป็น high-risk-high-reward — ยิ่งเสียหายยิ่งอันตราย
            const isLowHp = (this.hp / this.maxHp) <= (S.rageModeHpThreshold ?? 0.30);
            const wasRage = this._rageMode ?? false;
            this._rageMode = this.passiveUnlocked && newTier === 3 && isLowHp;
            if (this._rageMode && !wasRage) {
                // Rising edge — แจ้งผู้เล่นครั้งเดียว
                spawnFloatingText('🔥 RAGE MODE!', this.x, this.y - 95, '#facc15', 26);
                addScreenShake(6);
            }
        }

        if (this.wanchaiActive) {
            this.wanchaiTimer -= dt;
            if (this.wanchaiTimer <= 0) {
                this.wanchaiActive = false;
                this.wanchaiTimer = 0;
                if (this.wanchaiStand) { this.wanchaiStand.active = false; this.wanchaiStand = null; }
                // BUG-FIX (OVERHEATED spam): กัน heat wave ยิงทันทีที่ Wanchai จบ
                // mouse.left ที่ค้างอยู่จะตกลง heat wave path ใน frame เดียวกัน
                // ใส่ gap เล็กน้อยเพื่อ break the chain
                this.cooldowns.shoot = Math.max(this.cooldowns.shoot ?? 0, 0.18);
            }
        }

        // ── Tick WanchaiStand each frame ──────────────────────
        if (this.wanchaiStand?.active) this.wanchaiStand.update(dt);

        // Decay player-owned rush fist overlay alpha
        if ((this._rushFistTimer ?? 0) > 0) {
            this._rushFistTimer -= dt;
            const _fade = Math.max(0, this._rushFistTimer / 0.10);
            if (this._rushFists) for (const f of this._rushFists) f.alpha = _fade;
        }

        if (checkInput('rightClick')) {
            // ── R-Click: Wanchai Stand — ใช้ได้ตั้งแต่ต้นเกม ──────────────────
            // passive bonuses (Heat gain, crit, lifesteal) ยังต้องปลดล็อคตามปกติ
            const energyCost = this.stats?.wanchaiEnergyCost ?? 25;
            if (!this.wanchaiActive && (this.cooldowns?.wanchai ?? 0) <= 0 && (this.energy ?? 0) >= energyCost) {
                this.energy = Math.max(0, (this.energy ?? 0) - energyCost);
                this._activateWanchai();
            } else if (!this.wanchaiActive && (this.cooldowns?.wanchai ?? 0) <= 0 && (this.energy ?? 0) < energyCost) {
                spawnFloatingText('⚡ พลังงานไม่พอ!', this.x, this.y - 40, '#fbbf24', 14);
            }
            consumeInput('rightClick');
        }

        const oldSpeedBoost = this.speedBoost;
        // Apply Awakening speed buff instead of slowing down
        if (this.wanchaiActive) this.speedBoost = (this.speedBoost || 1) * (this.stats?.standSpeedMod ?? 1.5);

        super.update(dt, keys, mouse);

        // ── Tick graphBuffTimer ────────────────────────────────
        if ((this.graphBuffTimer ?? 0) > 0) this.graphBuffTimer = Math.max(0, this.graphBuffTimer - dt);

        // Stateless restore
        this.speedBoost = oldSpeedBoost;

        // ── Q: Vacuum Heat — ดูดศัตรูเข้ามากอง ────────────────────
        // กด Q ดึงทุกตัวในรัศมี 320px เข้าหาออโต้ทันที
        // cooldown 8 วินาที | ออกแบบให้ combo กับ Wanchai
        if (mouse?.middle !== undefined) { /* placeholder */ }
        if (checkInput('q') && !this.passiveUnlocked) {
            spawnFloatingText('🔒 ทำ Heat เต็ม 100 ก่อน!', this.x, this.y - 40, '#94a3b8', 14);
            consumeInput('q');
        } else if (checkInput('q') && this.passiveUnlocked && (this.cooldowns?.vacuum ?? 0) <= 0) {
            const VACUUM_RANGE = this.stats?.vacuumRange ?? 320;
            const VACUUM_FORCE = this.stats?.vacuumForce ?? 1400; // stronger impulse
            const STUN_DUR = this.stats?.vacuumStunDur ?? 0.55; // AI lock duration
            const PULL_DUR = this.stats?.vacuumPullDur ?? 0.45; // continuous pull

            let pulled = 0;
            const vacDmg = this.stats?.vacuumDamage ?? 18;
            const ignDur = this.stats?.vacuumIgniteDuration ?? 1.5;
            const ignDps = this.stats?.vacuumIgniteDPS ?? 12;
            for (const enemy of (window.enemies || [])) {
                if (enemy.dead) continue;
                const dx = this.x - enemy.x;
                const dy = this.y - enemy.y;
                const d = Math.hypot(dx, dy);
                if (d < VACUUM_RANGE && d > 1) {
                    // ── Impulse + AI-stun so enemy.update() cannot override vx/vy ──
                    enemy.vx = (dx / d) * VACUUM_FORCE;
                    enemy.vy = (dy / d) * VACUUM_FORCE;
                    // vacuumStunTimer: enemy.js checks this and skips vx/vy override
                    enemy.vacuumStunTimer = STUN_DUR;
                    // Continuous pull target — enemy.js lerps toward this position
                    enemy._vacuumTargetX = this.x;
                    enemy._vacuumTargetY = this.y;
                    enemy._vacuumPullTimer = PULL_DUR;
                    // ── NEW: instant damage + Ignite ──────────────────
                    enemy.takeDamage?.(vacDmg * (this.damageMultiplier || 1.0), this);
                    enemy.isBurning = true;
                    enemy.burnTimer = ignDur;
                    enemy.burnDps = ignDps;
                    pulled++;
                }
            }
            // ── Heat gain from Vacuum ──────────────────────────
            if (pulled > 0) this.gainHeat(this.stats?.vacuumHeatGain ?? 25);
            // Boss — weak pull (30%)
            if (window.boss && !window.boss.dead) {
                const dx = this.x - window.boss.x;
                const dy = this.y - window.boss.y;
                const d = Math.hypot(dx, dy);
                if (d < VACUUM_RANGE && d > 1) {
                    window.boss.vx = (dx / d) * VACUUM_FORCE * 0.30;
                    window.boss.vy = (dy / d) * VACUUM_FORCE * 0.30;
                    window.boss.vacuumStunTimer = STUN_DUR * 0.4;
                }
            }
            this.cooldowns.vacuum = this.stats?.vacuumCooldown ?? 8;
            if (pulled > 0 || (window.boss && !window.boss.dead)) {
                spawnParticles(this.x, this.y, 40, '#f97316');
                addScreenShake(6);
                spawnFloatingText(`🔥 VACUUM HEAT ×${pulled}`, this.x, this.y - 60, '#f97316', 24);
                if (typeof Audio !== 'undefined' && Audio.playVacuum) Audio.playVacuum();
            }
            consumeInput('q');
        }

        // ── E: Overheat Detonation — Heat-scaled, DOES NOT kill Wanchai ─────
        // กด E ระหว่าง Wanchai active เท่านั้น
        // AOE = detonationRange (×1.5 ถ้า OVERHEATED), damage = base + heat×scaling
        if (checkInput('e') && !this.passiveUnlocked) {
            spawnFloatingText('🔒 ทำ Heat เต็ม 100 ก่อน!', this.x, this.y - 40, '#94a3b8', 14);
            consumeInput('e');
        } else if (checkInput('e') && this.passiveUnlocked && this.wanchaiActive && (this.cooldowns?.detonation ?? 0) <= 0) {
            const S = this.stats ?? {};
            const isOverheat = (this._heatTier ?? 0) >= 3;
            const DET_RANGE = (S.detonationRange ?? 240) * (isOverheat ? 1.5 : 1.0);
            // Heat-scaled damage
            const detBaseDmg = (S.detonationBaseDamage ?? 80) + this.heat * (S.detonationHeatScaling ?? 2.5);
            const detFinalBase = detBaseDmg * (this.damageMultiplier || 1.0);
            let detCrit = this.baseCritChance + (S.standCritBonus ?? 0.25);
            if (isOverheat) detCrit += (S.heatCritBonusOverheat ?? 0.20);
            let detIsCrit = Math.random() < detCrit;
            let detFinalDmg = detFinalBase * (detIsCrit ? (S.critMultiplier ?? 2.2) : 1.0);

            // ── Second Wind bonus ──
            if (this.isSecondWind) detFinalDmg *= (BALANCE.player.secondWindDamageMult || 1.5);

            let totalDet = 0;
            for (const enemy of (window.enemies || [])) {
                if (enemy.dead) continue;
                const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                if (dist < DET_RANGE) {
                    enemy.takeDamage(detFinalDmg);
                    totalDet += detFinalDmg;
                    spawnParticles(enemy.x, enemy.y, 5, detIsCrit ? '#facc15' : '#dc2626');
                }
            }
            if (window.boss && !window.boss.dead) {
                const dist = Math.hypot(window.boss.x - this.x, window.boss.y - this.y);
                if (dist < DET_RANGE + window.boss.radius) {
                    window.boss.takeDamage(detFinalDmg);
                    totalDet += detFinalDmg;
                    spawnParticles(window.boss.x, window.boss.y, 8, detIsCrit ? '#facc15' : '#dc2626');
                }
            }

            // Lifesteal จากดาเมจที่ทำได้
            if (this.passiveUnlocked && totalDet > 0) {
                this.hp = Math.min(this.maxHp, this.hp + totalDet * (this.stats?.passiveLifesteal ?? 0.01));
            }

            // ── REWORK: Wanchai STAYS active after Detonation ──
            // Heat resets -50 (keeps momentum, can chain)
            this.heat = Math.max(0, this.heat - 50);
            this._heatTier = this.heat >= (S.heatTierHot ?? 67) ? 2
                : this.heat >= (S.heatTierWarm ?? 34) ? 1 : 0;
            this.cooldowns.detonation = S.detonationCooldown ?? 8;

            spawnParticles(this.x, this.y, 60, '#dc2626');
            addScreenShake(10);
            spawnFloatingText(
                detIsCrit ? `💥 OVERHEAT CRIT! ${Math.floor(detFinalDmg)}` : `💥 OVERHEAT! ${Math.floor(detFinalDmg)}`,
                this.x, this.y - 70,
                detIsCrit ? '#facc15' : '#dc2626', isOverheat ? 32 : 28
            );
            if (typeof Audio !== 'undefined' && Audio.playDetonation) Audio.playDetonation();
            consumeInput('e');
        }



        // Reset attack state every frame
        this.isStandAttacking = false;

        // Wanchai active: L-Click = player melee Stand Rush (stand punches autonomously too)
        if (this.wanchaiActive && mouse && mouse.left === 1) {
            this.isStandAttacking = true;
            if (this.wanchaiStand?.active) {
                this.wanchaiStand._forcedTargetX = mouse.wx;
                this.wanchaiStand._forcedTargetY = mouse.wy;
            }
            if ((this.cooldowns?.shoot ?? 0) <= 0) {
                this.cooldowns.shoot = this.stats?.playerRushCooldown ?? 0.10;
                this._doPlayerMelee(mouse);
            }
            return;
        }

        if (!mouse || mouse.left !== 1) return;
        if (typeof projectileManager === 'undefined' || !projectileManager) return;

        const heatCd = this.stats?.heatWaveCooldown ?? 0.28;
        if ((this.cooldowns?.shoot ?? 0) > 0) return;
        this.cooldowns.shoot = heatCd;

        if (typeof projectileManager.spawnHeatWave === 'function') {
            projectileManager.spawnHeatWave(this, this.angle);
        } else {
            try {
                projectileManager.add(new Projectile(this.x, this.y, this.angle, 900, 22, '#dc2626', false, 'player'));
            } catch (e) { }
        }
        if (typeof Audio !== 'undefined' && Audio.playPunch) Audio.playPunch();
    }

    // Player melee punch during Stand Rush
    // Finds nearest enemy within playerRushRange of cursor, deals wanchaiDamage
    _doPlayerMelee(mouse) {
        const S = this.stats ?? {};
        const range = S.playerRushRange ?? 85;
        const cx = mouse?.wx ?? this.x;
        const cy = mouse?.wy ?? this.y;

        // Find nearest enemy to cursor within range
        let target = null;
        let bestD = range + 60;
        for (const e of (window.enemies || [])) {
            if (e.dead) continue;
            const d = Math.hypot(e.x - cx, e.y - cy);
            if (d < bestD) { bestD = d; target = e; }
        }
        if (!target && window.boss && !window.boss.dead) {
            const d = Math.hypot(window.boss.x - cx, window.boss.y - cy);
            if (d < bestD) target = window.boss;
        }

        if (!target) {
            // BUG-FIX (miss no animation): spawn fist overlay ที่ cursor แม้จะ miss
            this._rushFists = this._rushFists ?? [];
            this._rushFists.length = 0;
            for (let i = 0; i < 4; i++) {
                this._rushFists.push({
                    ox: 30 + Math.random() * 55,
                    oy: (Math.random() - 0.5) * 50,
                    sc: 0.35 + Math.random() * 0.45,
                    alpha: 0.55  // ← จางกว่า hit เพื่อบ่งบอกว่า miss
                });
            }
            this._rushFistTimer = 0.08;
            // Miss VFX + sound
            if (typeof spawnParticles === 'function') spawnParticles(cx, cy, 2, '#ef4444');
            if (typeof Audio !== 'undefined' && Audio.playPunch) Audio.playPunch();
            return;
        }

        // Stand Rush fires toward cursor — Stand teleports to target, no range gate
        // Direct the WanchaiStand to rush that target immediately
        if (this.wanchaiStand?.active) {
            this.wanchaiStand.x = target.x - Math.cos(this.angle) * 20;
            this.wanchaiStand.y = target.y - Math.sin(this.angle) * 20;
        }

        // Heat gain per player rush hit
        this.gainHeat(S.heatPerPlayerHit ?? 8);
        // Heat tier damage
        const pht = this._heatTier ?? 0;
        const pHeatMult = pht >= 3 ? (S.heatDmgOverheat ?? 1.50)
            : pht >= 2 ? (S.heatDmgHot ?? 1.30)
                : pht >= 1 ? (S.heatDmgWarm ?? 1.15) : 1.0;
        let dmg = (S.wanchaiDamage ?? 32) * (this.damageMultiplier || 1.0) * pHeatMult;
        let critChance = (this.baseCritChance ?? 0.06) + (S.standCritBonus ?? 0.25);  // BUG-5 fix: was 0.40
        if (this.passiveUnlocked) critChance += (S.passiveCritBonus ?? 0);
        if (pht >= 3) critChance += (S.heatCritBonusOverheat ?? 0.20);
        const isCrit = Math.random() < critChance;
        if (isCrit) {
            dmg *= (S.critMultiplier ?? 2.2);
            if (this.passiveUnlocked) this.goldenAuraTimer = 1;
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.crits = (Achievements.stats.crits ?? 0) + 1;
                Achievements.check?.('crit_master');
            }
        }
        if (this.isSecondWind) dmg *= (BALANCE?.player?.secondWindDamageMult || 1.5);

        target.takeDamage(dmg, this);

        if (this.passiveUnlocked)
            this.hp = Math.min(this.maxHp, this.hp + dmg * (S.passiveLifesteal ?? 0.01));  // BUG-4 fix: was 0.02

        // Knockback
        const ka = Math.atan2(target.y - this.y, target.x - this.x);
        const kf = (S.standKnockback ?? 180) * 0.6;
        target.vx = (target.vx ?? 0) + Math.cos(ka) * kf;
        target.vy = (target.vy ?? 0) + Math.sin(ka) * kf;

        // VFX + sound
        if (typeof spawnParticles === 'function')
            spawnParticles(target.x, target.y, isCrit ? 6 : 3, isCrit ? '#facc15' : '#ef4444');
        if (typeof addScreenShake === 'function') addScreenShake(isCrit ? 4 : 2);
        if (isCrit && typeof spawnFloatingText === 'function')
            spawnFloatingText('ORA!', this.x, this.y - 45, '#facc15', 20);
        if (typeof Audio !== 'undefined' && Audio.playStandRush) Audio.playStandRush();

        // Precompute rush fist positions for overlay (drawn by PlayerRenderer)
        this._rushFists = this._rushFists ?? [];
        this._rushFists.length = 0;
        for (let i = 0; i < 7; i++) {
            this._rushFists.push({
                ox: 38 + Math.random() * 75,
                oy: (Math.random() - 0.5) * 60,
                sc: 0.45 + Math.random() * 0.65,
                alpha: 1.0
            });
        }
        this._rushFistTimer = 0.10;

        // Sync combo into WanchaiStand so ORA counter escalates
        if (this.wanchaiStand) {
            this.wanchaiStand._punchPhase = 2;
            this.wanchaiStand._phaseTimer = 0.10;
        }

        if (typeof Achievements !== 'undefined' && target.hp <= 0) {
            Achievements.stats.standRushKills = (Achievements.stats.standRushKills ?? 0) + 1;
            Achievements.check?.('stand_rush_kill');
        }
    }

    // ── Override: Auto ปลดล็อคเมื่อถึง OVERHEAT ครั้งแรก ──────────────────────
    // เปลี่ยนจาก "รอ Level 5 เฉยๆ" → "ร่างกายถูกเผาจนสุด = Awakening"
    // Thematic: ออโต้ค้นพบตัวเองตอนที่ร่างกาย "โอเวอร์ฮีต" ครั้งแรก
    checkPassiveUnlock() {
        const S = this.stats;
        if (this.passiveUnlocked) return; // guard: ปลดแล้ว ไม่ต้องทำซ้ำ

        // ── Condition: ถึง OVERHEAT ครั้งแรก (set โดย gainHeat()) ──────────
        if (!this._hasReachedOverheat) return;

        this.passiveUnlocked = true;

        // ── HP Bonus (เหมือนเดิม) ─────────────────────────────────────────
        const hpBonus = Math.floor(this.maxHp * (S.passiveHpBonusPct ?? 0.35));
        this.maxHp += hpBonus;
        this.hp += hpBonus;

        // ── Unlock VFX — สีส้ม/แดง สะท้อน SCORCHED SOUL ────────────────
        const unlockText = S.passiveUnlockText ?? '💥 SCORCHED SOUL AWAKENED!';
        spawnFloatingText(unlockText, this.x, this.y - 70, '#f97316', 32);
        spawnFloatingText('🔥 Q & E UNLOCKED', this.x, this.y - 105, '#facc15', 18);
        spawnParticles(this.x, this.y, 60, '#f97316');
        spawnParticles(this.x, this.y, 30, '#facc15');
        addScreenShake(18);
        this.goldenAuraTimer = 4;
        Audio.playAchievement();

        if (typeof UIManager !== 'undefined') UIManager.showVoiceBubble(unlockText, this.x, this.y - 40);

        // ── Persist save ──────────────────────────────────────────────────
        try {
            const saved = getSaveData();
            const set = new Set(saved.unlockedPassives || []);
            set.add(this.charId);
            updateSaveData({ unlockedPassives: [...set] });
        } catch (e) { console.warn('[MTC Save] Could not persist passive unlock:', e); }
    }

    // draw() ย้ายไป PlayerRenderer._drawAuto() แล้ว

    updateUI() {
        const S = this.stats;

        const hpEl = document.getElementById('hp-bar');
        const enEl = document.getElementById('en-bar');
        if (hpEl) hpEl.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enEl) enEl.style.width = `${this.energy / this.maxEnergy * 100}%`;

        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('dash-icon',
                Math.max(0, this.cooldowns.dash), S.dashCooldown || 2.0);
        }

        // WARN-1 FIX: use BALANCE.characters.auto (correct path after refactor)
        const wanchaiCd = S.wanchaiCooldown || BALANCE.characters?.auto?.wanchaiCooldown || 12;
        const standEl = document.getElementById('stealth-icon');

        const skill1Emoji = document.getElementById('skill1-emoji');
        const skill1Hint = document.getElementById('skill1-hint');
        if (skill1Emoji) skill1Emoji.textContent = this.wanchaiActive ? '🥊' : '🔥';
        if (skill1Hint) skill1Hint.textContent = 'R-Click';
        if (standEl) standEl.style.borderColor = '#dc2626';
        if (standEl) standEl.style.boxShadow = this.wanchaiActive
            ? '0 0 20px rgba(220,38,38,0.80)'
            : '0 0 10px rgba(220,38,38,0.35)';

        if (this.wanchaiActive) {
            standEl?.classList.add('active');
            if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
                UIManager._setCooldownVisual('stealth-icon', 0, wanchaiCd);
            }
            const iconLabelEl = standEl?.querySelector('.skill-name');
            if (iconLabelEl) iconLabelEl.textContent = `${Math.ceil(this.wanchaiTimer)}s`;
        } else {
            standEl?.classList.remove('active');
            if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
                UIManager._setCooldownVisual('stealth-icon',
                    Math.max(0, this.cooldowns.wanchai ?? 0), wanchaiCd);
            }
        }

        // ── Heat Gauge HUD ──────────────────────────────────────────
        {
            const heatPct = (this.heat ?? 0) / ((this.stats?.heatMax) ?? 100);
            const ht = this._heatTier ?? 0;
            const heatBarEl = document.getElementById('heat-bar');
            const heatLabelEl = document.getElementById('heat-label');
            if (heatBarEl) {
                heatBarEl.style.width = `${heatPct * 100}%`;
                heatBarEl.style.background = ht >= 3 ? '#facc15'
                    : ht >= 2 ? '#ef4444'
                        : ht >= 1 ? '#f97316' : '#fb923c';
                heatBarEl.style.boxShadow = ht >= 3 ? '0 0 12px #facc15'
                    : ht >= 2 ? '0 0 10px #ef4444'
                        : ht >= 1 ? '0 0 8px #f97316' : 'none';
            }
            if (heatLabelEl) {
                const label = ht >= 3 ? 'OVERHEAT' : ht >= 2 ? 'HOT' : ht >= 1 ? 'WARM' : 'HEAT';
                heatLabelEl.textContent = label;
            }
        }

        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;

        // INC-4 fix: Q / E cooldown visuals
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('q-icon',
                Math.max(0, this.cooldowns.vacuum ?? 0), S.vacuumCooldown ?? 8);
            UIManager._setCooldownVisual('e-icon',
                Math.max(0, this.cooldowns.detonation ?? 0), S.detonationCooldown ?? 5);
        }

        const passiveEl = document.getElementById('passive-skill');
        if (passiveEl) {
            if (this.passiveUnlocked) {
                passiveEl.classList.add('unlocked');
                passiveEl.style.opacity = '1';
            } else if (this.level >= (S.passiveUnlockLevel ?? 5)) {
                passiveEl.style.display = 'flex';
                passiveEl.style.opacity = '0.5';
            }
        }
    }

}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.AutoPlayer = AutoPlayer;