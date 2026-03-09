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
        this._atkRate = 0;          // set from BALANCE each frame
        this._punchPhase = 0;       // 0=idle 1=wind-up 2=strike (visual only)
        this._phaseTimer = 0;
        this.lastPunchSoundTime = 0;

        // Rush burst — velocity dash toward target on L-Click
        this._rushBurstVx = 0;      // burst velocity this frame
        this._rushBurstVy = 0;
        this._rushBurstTimer = 0;   // > 0 = currently dashing

        // ORA Combo escalation — synced with owner._oraComboCount
        this._oraWindowTimer = 0;   // time window to chain next hit

        // Rendering
        this.angle = owner.angle;   // faces toward target
        this.ghostTrail = [];       // [{x,y,alpha}] motion blur
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
        // Feature 3C: Stand Guard → Stand moves in front of player instead of chasing
        if (owner._standGuard) {
            const guardDist = 35;
            const guardX = owner.x + Math.cos(owner.angle) * guardDist;
            const guardY = owner.y + Math.sin(owner.angle) * guardDist;
            const gd = Math.hypot(guardX - this.x, guardY - this.y);
            if (gd > 5) {
                const step = chaseSpeed * dt;
                this.x += (guardX - this.x) / gd * step;
                this.y += (guardY - this.y) / gd * step;
            }
            this.angle = owner.angle;
        } else if (target) {
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

        // ── Rush burst — player L-Click triggers velocity dash ───────────────
        // _rushTarget set by _doPlayerMelee; stand surges toward it then decays
        if (this._rushBurstTimer > 0) {
            this._rushBurstTimer -= dt;
            const decay = Math.max(0, this._rushBurstTimer / 0.18); // 0.18s burst window
            this.x += this._rushBurstVx * dt * decay;
            this.y += this._rushBurstVy * dt * decay;
            if (this._rushBurstTimer <= 0) {
                this._rushBurstVx = 0;
                this._rushBurstVy = 0;
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

        // ORA combo window decay
        if (this._oraWindowTimer > 0) {
            this._oraWindowTimer -= dt;
            if (this._oraWindowTimer <= 0 && owner) {
                owner._oraComboCount = 0; // combo expired
            }
        }

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
        if (typeof owner.gainHeat === 'function') owner.gainHeat(S.heatPerHit ?? 12, true);

        // ── Heat tier damage multiplier ────────────────────────
        const tier = owner._heatTier ?? 0;
        // Feature 1: COLD tier damage penalty
        const heatDmgMult = tier >= 3 ? (S.heatDmgOverheat ?? 1.50)
            : tier >= 2 ? (S.heatDmgHot ?? 1.30)
                : tier >= 1 ? (S.heatDmgWarm ?? 1.15)
                    : (S.coldDamageMult ?? 0.70); // COLD penalty

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
            dmg *= (S.critMultiplier ?? 2.2);  // FIX: fallback 2.0 → 2.2 ให้ match config
            if (owner.passiveUnlocked) owner.goldenAuraTimer = 1;
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.crits = (Achievements.stats.crits ?? 0) + 1;
                Achievements.check?.('crit_master');
            }
        }

        target.takeDamage(dmg, owner);

        // Lifesteal
        if (owner.passiveUnlocked) {
            owner.hp = Math.min(owner.maxHp, owner.hp + dmg * (S.passiveLifesteal ?? 0.025));  // BUG FIX: was hardcode 0.01 ≠ config 0.025
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

        // ── ORA Combo escalation — each punch extends the window ──
        if (owner) {
            owner._oraComboCount = Math.min(10, (owner._oraComboCount ?? 0) + 1);
            this._oraWindowTimer = 0.55; // 550ms window to chain next hit
            owner._oraTextTimer = 0.45; // Reset ORA text timer to 0.45s on each punch
        }

        // Precompute rush fists — ORA barrage fan (scales with combo)
        this._rushFists = this._rushFists ?? [];
        this._rushFists.length = 0;
        const _oraCombo = owner._oraComboCount ?? 1;
        // More combo → more fists, tighter spread (more like Star Platinum barrage)
        const _fanCount = Math.min(12, 5 + Math.floor(_oraCombo * 0.8));
        const _fanSpread = Math.max(Math.PI * 0.15, Math.PI * 0.38 - _oraCombo * 0.025); // tightens with combo
        const _faceA = this.angle;
        for (let i = 0; i < _fanCount; i++) {
            const t_ = i / (_fanCount - 1);        // 0→1
            const a = _faceA - _fanSpread / 2 + t_ * _fanSpread;
            const r = 36 + t_ * 60;               // near→far depth
            this._rushFists.push({
                ox: Math.cos(a) * r,
                oy: Math.sin(a) * r,
                sc: 0.45 + t_ * 0.60,               // small→big toward edge
                alpha: 1.0
            });
        }
        this._rushFistTimer = 0.12; // slightly longer fade

        // Sound
        const now = Date.now();
        if (now - this.lastPunchSoundTime > 60) {
            if (typeof Audio !== 'undefined' && Audio.playStandRush) Audio.playStandRush();
            this.lastPunchSoundTime = now;
        }

        // Kill bonus: +Heat + heal (only during Wanchai)
        if (target.hp !== undefined && target.hp <= 0 && owner.wanchaiActive) {
            const S2 = owner.stats ?? {};
            // ── Feature 4: Stand Meter on kill ──────────────────
            owner.standMeter = Math.min(S2.standMeterMax ?? 100, (owner.standMeter ?? 0) + (S2.standMeterOnKill ?? 12));

            // ── Feature 2: Killing Blow Supercharge from Stand punch ──
            if ((owner._oraComboCount ?? 0) >= (S2.oraComboSuperchargeMin ?? 5)) {
                if (typeof owner.gainHeat === 'function') owner.gainHeat(S2.heatOnKillSupercharge ?? 30, true);
                owner.cooldowns.shoot = 0; // reset rush cooldown
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('SUPERCHARGE!', owner.x, owner.y - 70, '#fef08a', 22);
                if (typeof addScreenShake === 'function') addScreenShake(5);
            } else {
                if (typeof owner.gainHeat === 'function') owner.gainHeat(S2.heatOnKillWanchai ?? 15, true);
            }
            const healPct = S2.heatHealOnKillWanchai ?? 0.08;
            owner.hp = Math.min(owner.maxHp, owner.hp + owner.maxHp * healPct);
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(`+${Math.floor(owner.maxHp * healPct)}hp 🔥`, owner.x, owner.y - 55, '#4ade80', 16);
        }

        // ── Feature 4: Stand Meter fill on hit ──────────────────
        if (owner.wanchaiActive) {
            const S3 = owner.stats ?? {};
            owner.standMeter = Math.min(S3.standMeterMax ?? 100, (owner.standMeter ?? 0) + (S3.standMeterPerHit ?? 4));
        }
    }

    draw(ctx) {
        if (!this.active || typeof ctx === 'undefined') return;
        const now = performance.now();
        const sc = worldToScreen(this.x, this.y);
        const t = now / 1000;
        const owner = this.owner;

        // ── HEAT TIER COLORS — Crimson/Gold palette matching Auto ──
        // Base: Deep crimson ghost — unified identity with Auto's red theme
        // HOT: flares to amber/gold — escalation signal
        // OVERHEAT: blazing white-gold — peak fury
        const ht = owner?._heatTier ?? 0;
        const coreCol = ht >= 3 ? '#fef08a' : ht >= 2 ? '#f59e0b' : ht >= 1 ? '#ef4444' : '#dc2626';
        const auraCol = ht >= 3 ? 'rgba(254,240,138,' : ht >= 2 ? 'rgba(245,158,11,' : ht >= 1 ? 'rgba(239,68,68,' : 'rgba(220,38,38,';
        const punchCol = ht >= 3 ? '#fef08a' : ht >= 2 ? '#fbbf24' : '#ff6b6b';
        const armorCol1 = ht >= 2 ? '#92400e' : '#7f1d1d';   // dark base
        const armorCol2 = ht >= 2 ? '#b45309' : '#991b1b';   // mid plate
        const armorCol3 = ht >= 2 ? '#f59e0b' : '#dc2626';   // highlight / trim
        const goldCol = ht >= 3 ? '#fef08a' : '#f59e0b';   // gold accents

        const isPunch = this._phaseTimer > 0;
        const flashT = isPunch ? Math.min(1, this._phaseTimer / 0.12) : 0;
        const side = this._punchSide ?? 1;
        const facingL = Math.abs(this.angle) > Math.PI / 2;
        const fs = facingL ? -1 : 1;

        // ── Stand pose oscillators ──
        const bob = Math.sin(t * 2.8);           // weight shift (slower = heavier)
        const sway = bob * 1.2;
        const breathe = Math.sin(t * 1.9) * 0.6;
        const eyeFlick = Math.sin(t * 7.0);
        // Ora Ora combo escalation — oraCombo comes from owner
        const oraCombo = owner?._oraComboCount ?? 0;
        const comboIntensity = Math.min(1, oraCombo / 6); // 0→1 over 6 hits

        // ═══ LAYER 0 — Ghost trail (crimson afterimage) ════════════════════════
        for (let i = this.ghostTrail.length - 1; i >= 0; i--) {
            const g = this.ghostTrail[i];
            const ga = g.alpha * 0.35;
            if (ga < 0.02) continue;
            const gs = worldToScreen(g.x, g.y);
            ctx.save();
            ctx.globalAlpha = ga;
            ctx.shadowBlur = 12; ctx.shadowColor = coreCol;
            // Stand silhouette ghost — head + broad shoulders
            ctx.fillStyle = coreCol;
            ctx.beginPath(); ctx.arc(gs.x, gs.y - 22, 10, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(gs.x, gs.y + 2, 13, 16, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }

        // ═══ LAYER 1 — Ground aura + shockwave ring ══════════════════════════════
        {
            const hw = 30 + breathe * 3 + comboIntensity * 8;
            const ha = isPunch ? 0.35 + flashT * 0.30 : 0.10 + breathe * 0.03 + comboIntensity * 0.08;
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.15);

            // ── Feature 2: Stand Absorb — grow with combo ≥ 5 ────────
            if (owner?.passiveUnlocked && (owner?._oraComboCount ?? 0) >= 5) {
                const absorbScale = 1.0 + comboIntensity * 0.25;
                ctx.scale(absorbScale, absorbScale);
                // Absorb ring
                ctx.globalAlpha = comboIntensity * 0.45;
                ctx.strokeStyle = goldCol; ctx.lineWidth = 2 + comboIntensity * 2;
                ctx.shadowBlur = 18; ctx.shadowColor = goldCol;
                ctx.setLineDash([3, 4]);
                ctx.beginPath(); ctx.arc(0, 0, 28 + comboIntensity * 10, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            }

            // ── Feature 1: COLD indicator on Stand ────────────────────
            if (ht === 0) {
                ctx.globalAlpha = 0.30 + Math.sin(t * 3) * 0.10;
                ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 1.5;
                ctx.setLineDash([3, 5]);
                ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            }

            const hG = ctx.createRadialGradient(0, 0, 2, 0, 0, hw + 14);
            hG.addColorStop(0, `${auraCol}${Math.min(1, ha * 2.5)})`);
            hG.addColorStop(0.35, `${auraCol}${ha})`);
            hG.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = hG;
            ctx.shadowBlur = isPunch ? 40 : 20; ctx.shadowColor = coreCol;
            ctx.beginPath(); ctx.ellipse(0, 0, hw, hw * 0.45, 0, 0, Math.PI * 2); ctx.fill();
            // Punch burst shockwave rings — double ring like JoJo impact
            if (isPunch && flashT > 0.06) {
                ctx.globalAlpha = flashT * 0.80;
                ctx.strokeStyle = punchCol; ctx.lineWidth = 3;
                ctx.shadowBlur = 28; ctx.shadowColor = punchCol;
                ctx.beginPath(); ctx.arc(0, 0, 32 + (1 - flashT) * 22, 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = flashT * 0.45;
                ctx.lineWidth = 1.8;
                ctx.beginPath(); ctx.arc(0, 0, 50 + (1 - flashT) * 16, 0, Math.PI * 2); ctx.stroke();
                // Inner bright flash
                ctx.globalAlpha = flashT * 0.25;
                ctx.fillStyle = punchCol;
                ctx.shadowBlur = 50;
                ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }

        // ═══ LAYER 2 — Stand body (JoJo-style large warrior) ════════════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.25);
            ctx.scale(fs, 1);

            // ── Legs — thick, armored, planted stance ──────────────────
            const legBob = isPunch ? 0 : bob * 1.8;
            // Left leg
            const lgG = ctx.createLinearGradient(-10, 18, -10, 52);
            lgG.addColorStop(0, armorCol2); lgG.addColorStop(1, armorCol1);
            ctx.fillStyle = lgG; ctx.globalAlpha = 0.88;
            ctx.beginPath();
            ctx.moveTo(-13, 18);
            ctx.lineTo(-16, 48 + legBob * 0.5);
            ctx.lineTo(-6, 50 + legBob * 0.5);
            ctx.lineTo(-5, 18);
            ctx.closePath(); ctx.fill();
            // Right leg
            ctx.beginPath();
            ctx.moveTo(5, 18);
            ctx.lineTo(4, 50 - legBob * 0.5);
            ctx.lineTo(14, 48 - legBob * 0.5);
            ctx.lineTo(13, 18);
            ctx.closePath(); ctx.fill();
            // Gold knee guards
            ctx.fillStyle = goldCol; ctx.globalAlpha = 0.85;
            ctx.shadowBlur = 6; ctx.shadowColor = goldCol;
            ctx.beginPath(); ctx.ellipse(-10, 34, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(9, 34, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // ── Main torso — broad, imposing, armored ──────────────────
            const tG = ctx.createRadialGradient(-5, -8, 2, 0, 0, 22);
            tG.addColorStop(0, armorCol2);
            tG.addColorStop(0.5, armorCol1);
            tG.addColorStop(1, '#3d0000');
            ctx.fillStyle = tG; ctx.globalAlpha = 0.92 + breathe * 0.05;
            ctx.shadowBlur = isPunch ? 24 : 12; ctx.shadowColor = coreCol;

            // JoJo-style wide shoulders, defined chest
            ctx.beginPath();
            ctx.moveTo(-22, -4);          // left shoulder — very wide
            ctx.quadraticCurveTo(-26, 6, -18, 20);
            ctx.lineTo(18, 20);
            ctx.quadraticCurveTo(26, 6, 22, -4);
            ctx.quadraticCurveTo(0, -10, -22, -4);
            ctx.closePath(); ctx.fill();
            ctx.shadowBlur = 0;

            // Armor plate details — chest divider + rivet dots
            ctx.strokeStyle = `${auraCol}0.18)`; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 20); ctx.stroke();
            // Pec plate lines
            ctx.beginPath(); ctx.moveTo(-20, -2); ctx.quadraticCurveTo(-10, 2, 0, 1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(20, -2); ctx.quadraticCurveTo(10, 2, 0, 1); ctx.stroke();

            // Gold shoulder pauldrons — signature JoJo detail
            ctx.fillStyle = goldCol; ctx.globalAlpha = 0.90;
            ctx.shadowBlur = 8; ctx.shadowColor = goldCol;
            // Left pauldron
            ctx.beginPath();
            ctx.ellipse(-22, -4, 8, 5, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-22, -4, 5, 3, -0.2, 0, Math.PI * 2);
            ctx.fillStyle = armorCol1; ctx.fill();
            // Right pauldron
            ctx.fillStyle = goldCol;
            ctx.beginPath(); ctx.ellipse(22, -4, 8, 5, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(22, -4, 5, 3, 0.2, 0, Math.PI * 2);
            ctx.fillStyle = armorCol1; ctx.fill();
            ctx.shadowBlur = 0;

            // Belt / waist band with gold buckle
            ctx.fillStyle = armorCol1; ctx.globalAlpha = 0.90;
            ctx.beginPath(); ctx.roundRect(-18, 14, 36, 6, 2); ctx.fill();
            ctx.fillStyle = goldCol; ctx.globalAlpha = 0.95;
            ctx.shadowBlur = 6; ctx.shadowColor = goldCol;
            ctx.beginPath(); ctx.roundRect(-4, 14, 8, 6, 1); ctx.fill();
            ctx.shadowBlur = 0;

            // Energy core — hexagonal, crimson/gold pulsing
            const cp = Math.max(0.4, 0.5 + Math.sin(now / 180) * 0.45) * (isPunch ? 1.8 : 1.0 + comboIntensity * 0.5);
            const cr = 6;
            ctx.save(); ctx.translate(0, 8);
            ctx.beginPath();
            for (let hi = 0; hi < 6; hi++) {
                const ha2 = (hi / 6) * Math.PI * 2 - Math.PI / 6;
                hi === 0 ? ctx.moveTo(Math.cos(ha2) * cr, Math.sin(ha2) * cr)
                    : ctx.lineTo(Math.cos(ha2) * cr, Math.sin(ha2) * cr);
            }
            ctx.closePath();
            const cG = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
            cG.addColorStop(0, `rgba(255,255,255,${Math.min(1, cp * 0.9)})`);
            cG.addColorStop(0.4, `${auraCol}${Math.min(1, cp)})`);
            cG.addColorStop(1, `${auraCol}${cp * 0.3})`);
            ctx.fillStyle = cG;
            ctx.shadowBlur = 16 * cp; ctx.shadowColor = coreCol;
            ctx.fill();
            ctx.strokeStyle = goldCol; ctx.lineWidth = 0.9; ctx.globalAlpha = cp * 0.7;
            ctx.stroke();
            ctx.restore();

            ctx.restore(); // end torso/legs
        }

        // ═══ LAYER 3 — Arms (JoJo guard + punch) ════════════════════════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.25);
            ctx.scale(fs, 1);

            // JoJo stance: one arm forward (jab guard), one arm cocked (power cross)
            const drawArm = (xDir, isActive) => {
                const isLead = xDir > 0;
                const elbX = isLead ? xDir * 16 : xDir * 12;
                const elbY = isLead ? -10 : 0;
                const idleX = isLead ? xDir * 20 : xDir * 24;
                const idleY = isLead ? -14 + bob * 1.0 : 4 + bob * 0.4;
                // Strike: lead arm jab straight, rear arm wide haymaker
                const hitX = isActive ? (isLead ? xDir * 42 : xDir * 36) : idleX;
                const hitY = isActive ? (isLead ? -8 : -5) : idleY;
                const fX = hitX, fY = hitY;

                // Upper arm — thick armored
                ctx.strokeStyle = armorCol1; ctx.lineWidth = 8; ctx.lineCap = 'round';
                ctx.shadowBlur = isActive ? 16 : 4; ctx.shadowColor = coreCol;
                ctx.globalAlpha = 0.92;
                ctx.beginPath();
                ctx.moveTo(xDir * 20, -4);
                ctx.quadraticCurveTo(elbX + (isActive ? xDir * 5 : 0), elbY, fX, fY);
                ctx.stroke();

                // Forearm
                ctx.lineWidth = 6; ctx.strokeStyle = armorCol2; ctx.globalAlpha = 0.85;

                // Gold arm guard stripe
                ctx.strokeStyle = goldCol; ctx.lineWidth = 1.5;
                ctx.globalAlpha = 0.55;
                ctx.beginPath();
                ctx.moveTo(xDir * 19, -3);
                ctx.quadraticCurveTo(elbX, elbY + 1, fX * 0.7, fY * 0.7 + (idleY > 0 ? 1 : -1));
                ctx.stroke();
                ctx.shadowBlur = 0;

                // ── Boxing glove — large, gold-trimmed ─────────────────────
                const fR = isActive ? 11 : 9;
                // Main glove body
                const gloveG = ctx.createRadialGradient(fX - 2, fY - 2, 0.5, fX, fY, fR);
                gloveG.addColorStop(0, isActive ? '#ffffff' : armorCol3);
                gloveG.addColorStop(0.3, isActive ? punchCol : armorCol2);
                gloveG.addColorStop(0.7, armorCol1);
                gloveG.addColorStop(1, '#1a0000');
                ctx.fillStyle = gloveG;
                ctx.shadowBlur = isActive ? 22 + flashT * 20 : 8;
                ctx.shadowColor = isActive ? punchCol : coreCol;
                ctx.globalAlpha = isActive ? 0.97 : 0.82;
                ctx.beginPath(); ctx.arc(fX, fY, fR, 0, Math.PI * 2);
                ctx.fill();

                // Gold trim ring around glove
                ctx.strokeStyle = isActive ? goldCol : armorCol3;
                ctx.lineWidth = isActive ? 2.0 : 1.2;
                ctx.shadowBlur = isActive ? 12 : 4; ctx.shadowColor = goldCol;
                ctx.globalAlpha = isActive ? 0.90 : 0.45;
                ctx.beginPath(); ctx.arc(fX, fY, fR, 0, Math.PI * 2); ctx.stroke();

                // 4 Knuckle bumps
                ctx.shadowBlur = isActive ? 10 : 4; ctx.shadowColor = '#ffffff';
                for (let k = 0; k < 4; k++) {
                    const ky = fY - fR * 0.35 + k * (fR * 0.24);
                    const kG = ctx.createRadialGradient(fX + fR * 0.7, ky, 0, fX + fR * 0.7, ky, fR * 0.22);
                    kG.addColorStop(0, 'rgba(255,255,255,0.85)');
                    kG.addColorStop(1, 'rgba(220,38,38,0)');
                    ctx.fillStyle = kG; ctx.globalAlpha = isActive ? 0.90 : 0.50;
                    ctx.beginPath(); ctx.ellipse(fX + fR * 0.7, ky, fR * 0.22, fR * 0.16, 0, 0, Math.PI * 2); ctx.fill();
                }

                // Wrist tape lines
                ctx.strokeStyle = isActive ? 'rgba(255,255,255,0.55)' : `${auraCol}0.25)`;
                ctx.lineWidth = 1.0; ctx.globalAlpha = isActive ? 0.60 : 0.28;
                for (let k = 0; k < 3; k++) {
                    ctx.beginPath();
                    ctx.moveTo(fX - fR * 0.65, fY - fR * 0.22 + k * 2.5);
                    ctx.lineTo(fX + fR * 0.65, fY - fR * 0.22 + k * 2.5);
                    ctx.stroke();
                }

                // Impact burst on active fist — star burst + shockwave
                if (isActive && flashT > 0.08) {
                    const bX = fX + xDir * 7;
                    ctx.globalAlpha = flashT * 0.95;
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = 28; ctx.shadowColor = punchCol;
                    ctx.beginPath(); ctx.arc(bX, fY, 7 + flashT * 9, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = punchCol; ctx.globalAlpha = flashT * 0.65;
                    ctx.beginPath(); ctx.arc(bX, fY, 4 + flashT * 5, 0, Math.PI * 2); ctx.fill();
                    // 8-spike starburst
                    ctx.strokeStyle = goldCol; ctx.lineWidth = 1.5;
                    for (let r = 0; r < 8; r++) {
                        const ra = (r / 8) * Math.PI * 2;
                        ctx.globalAlpha = flashT * 0.65;
                        ctx.beginPath();
                        ctx.moveTo(bX + Math.cos(ra) * 6, fY + Math.sin(ra) * 6);
                        ctx.lineTo(bX + Math.cos(ra) * 20, fY + Math.sin(ra) * 20);
                        ctx.stroke();
                    }
                    // Diamond shards (4 diagonal)
                    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
                    for (let r = 0; r < 4; r++) {
                        const ra = (r / 4) * Math.PI * 2 + Math.PI / 4;
                        ctx.globalAlpha = flashT * 0.45;
                        ctx.beginPath();
                        ctx.moveTo(bX + Math.cos(ra) * 4, fY + Math.sin(ra) * 4);
                        ctx.lineTo(bX + Math.cos(ra) * 28, fY + Math.sin(ra) * 28);
                        ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            };

            drawArm(1, isPunch && side > 0);   // lead arm
            drawArm(-1, isPunch && side < 0);  // power arm

            // ── Feature 3C: Stand Guard — arms crossed + shield arc ──
            if (owner?._standGuard) {
                // Arms crossed in front
                ctx.save();
                ctx.globalAlpha = 0.75 + Math.sin(t * 6) * 0.10;
                ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
                ctx.shadowBlur = 14; ctx.shadowColor = '#fbbf24';
                // Cross left
                ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(22, -14); ctx.stroke();
                // Cross right
                ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(-22, -14); ctx.stroke();
                // Shield arc
                ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.10;
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(0, 0, 26, -Math.PI * 0.65, Math.PI * 0.65); ctx.stroke();
                ctx.restore();
            }
            ctx.restore();
        }

        // ═══ LAYER 4 — Head (warrior face — intense, angular) ════════════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + bob * 1.2);
            ctx.scale(fs, 1);

            const hy = -32 + breathe * 0.5; // head center — taller than before

            // Neck — thick warrior neck
            ctx.fillStyle = armorCol1; ctx.globalAlpha = 0.80;
            ctx.beginPath(); ctx.roundRect(-5, hy + 12, 10, 8, 1); ctx.fill();

            // ── MONGKHON CROWN — gold tiered, 5 spikes ──────────────────────
            const mkCol = goldCol;
            const mkColMid = ht >= 2 ? '#92400e' : '#b45309';
            const mkColDim = ht >= 2 ? '#78350f' : '#7c1d1d';
            const mkGlow = goldCol;
            const mkBandY = hy - 7;
            const mkBandH = 7;
            const mkPulse = 0.75 + Math.sin(t * 2.8) * 0.25;

            ctx.shadowBlur = 18 * mkPulse; ctx.shadowColor = mkGlow;

            // Band: dark base → gold fill → bright rim
            ctx.fillStyle = mkColDim; ctx.globalAlpha = 0.96;
            ctx.beginPath(); ctx.roundRect(-16, mkBandY, 32, mkBandH, 3); ctx.fill();
            const bandG = ctx.createLinearGradient(-16, 0, 16, 0);
            bandG.addColorStop(0, mkColDim); bandG.addColorStop(0.25, mkColMid);
            bandG.addColorStop(0.5, mkGlow); bandG.addColorStop(0.75, mkColMid);
            bandG.addColorStop(1, mkColDim);
            ctx.fillStyle = bandG; ctx.globalAlpha = 0.92;
            ctx.beginPath(); ctx.roundRect(-15, mkBandY + 1, 30, mkBandH - 2, 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.40)'; ctx.lineWidth = 0.9;
            ctx.globalAlpha = 0.70;
            ctx.beginPath(); ctx.roundRect(-15, mkBandY + 1, 30, 2.0, 1); ctx.fill();

            // 5 Spikes — taller, more dramatic
            ctx.globalAlpha = 1.0;
            const mkSpikes = [
                { x: 0, h: 20, w: 4.2 },
                { x: -7, h: 15, w: 3.5 },
                { x: 7, h: 15, w: 3.5 },
                { x: -13, h: 10, w: 2.8 },
                { x: 13, h: 10, w: 2.8 },
            ];
            for (const sp of mkSpikes) {
                const bY = mkBandY + 1;
                const tipY = bY - sp.h;
                const spG = ctx.createLinearGradient(sp.x, bY, sp.x, tipY);
                spG.addColorStop(0, mkColDim); spG.addColorStop(0.3, mkColMid);
                spG.addColorStop(0.7, mkCol); spG.addColorStop(1, mkGlow);
                ctx.fillStyle = spG;
                ctx.shadowBlur = 14 * mkPulse; ctx.shadowColor = mkGlow;
                ctx.globalAlpha = 0.96;
                ctx.beginPath();
                ctx.moveTo(sp.x - sp.w, bY);
                ctx.quadraticCurveTo(sp.x - sp.w * 0.5, bY - sp.h * 0.5, sp.x, tipY);
                ctx.quadraticCurveTo(sp.x + sp.w * 0.5, bY - sp.h * 0.5, sp.x + sp.w, bY);
                ctx.closePath(); ctx.fill();
                // Gleam
                ctx.strokeStyle = 'rgba(255,255,255,0.50)'; ctx.lineWidth = 0.9;
                ctx.globalAlpha = 0.60;
                ctx.beginPath(); ctx.moveTo(sp.x, bY - 2); ctx.lineTo(sp.x, tipY + 4); ctx.stroke();
                // Tip glow dot
                ctx.fillStyle = '#ffffff';
                ctx.shadowBlur = 10; ctx.shadowColor = mkGlow;
                ctx.globalAlpha = mkPulse * 0.85;
                ctx.beginPath(); ctx.arc(sp.x, tipY, 1.4, 0, Math.PI * 2); ctx.fill();
            }

            // Centre jewel (diamond) — crimson gem
            const jY = mkBandY + mkBandH * 0.5;
            const jewelG = ctx.createRadialGradient(0, jY - 0.5, 0, 0, jY, 4.5);
            jewelG.addColorStop(0, '#ffffff');
            jewelG.addColorStop(0.3, coreCol);
            jewelG.addColorStop(1, mkColDim);
            ctx.fillStyle = jewelG;
            ctx.shadowBlur = 16 * mkPulse; ctx.shadowColor = coreCol;
            ctx.globalAlpha = mkPulse * 0.95;
            ctx.beginPath();
            ctx.moveTo(0, jY - 4.5); ctx.lineTo(3.5, jY);
            ctx.lineTo(0, jY + 4.5); ctx.lineTo(-3.5, jY);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.70;
            ctx.beginPath(); ctx.moveTo(0, jY - 4.5); ctx.lineTo(3.5, jY);
            ctx.lineTo(0, jY + 4.5); ctx.lineTo(-3.5, jY); ctx.closePath(); ctx.stroke();

            // Side tassel ribbons
            ctx.strokeStyle = mkCol; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
            ctx.shadowBlur = 6; ctx.shadowColor = mkGlow;
            ctx.globalAlpha = 0.70;
            ctx.beginPath(); ctx.moveTo(-16, mkBandY + 2); ctx.quadraticCurveTo(-20, mkBandY + 4, -19, mkBandY + 10); ctx.stroke();
            ctx.globalAlpha = 0.42;
            ctx.beginPath(); ctx.moveTo(-16, mkBandY + 4); ctx.quadraticCurveTo(-21, mkBandY + 5, -20, mkBandY + 11); ctx.stroke();
            ctx.globalAlpha = 0.70;
            ctx.beginPath(); ctx.moveTo(16, mkBandY + 2); ctx.quadraticCurveTo(20, mkBandY + 4, 19, mkBandY + 10); ctx.stroke();
            ctx.globalAlpha = 0.42;
            ctx.beginPath(); ctx.moveTo(16, mkBandY + 4); ctx.quadraticCurveTo(21, mkBandY + 5, 20, mkBandY + 11); ctx.stroke();
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;

            // Head base — dark warrior skin (same hue as Auto but deeper)
            const hG = ctx.createRadialGradient(-3, hy - 4, 1, 0, hy, 13);
            hG.addColorStop(0, ht >= 2 ? '#c47c40' : '#7a3030');
            hG.addColorStop(0.5, ht >= 2 ? '#8a4a10' : '#4a1010');
            hG.addColorStop(1, ht >= 2 ? '#3d1500' : '#1a0000');
            ctx.fillStyle = hG; ctx.globalAlpha = 0.90;
            ctx.shadowBlur = isPunch ? 18 : 8; ctx.shadowColor = coreCol;
            ctx.beginPath(); ctx.arc(0, hy, 13, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // Short spiky hair (matching Auto's hair style)
            ctx.fillStyle = '#100000'; ctx.globalAlpha = 0.92;
            ctx.beginPath(); ctx.arc(0, hy, 13, Math.PI * 1.05, Math.PI * 2.0); ctx.closePath(); ctx.fill();

            // Overheat flame crown
            if (ht >= 3) {
                const _fc = 7, _fBaseY = hy - 13;
                ctx.shadowBlur = 20; ctx.shadowColor = '#f97316';
                for (let fi = 0; fi < _fc; fi++) {
                    const _fa = (fi / _fc) * Math.PI + Math.PI * 0.02;
                    const _fx = Math.cos(_fa) * 14;
                    const _fy = _fBaseY + Math.sin(_fa) * 4;
                    const _fh = 9 + Math.abs(Math.sin(t * 5.5 + fi * 1.1)) * 10;
                    const _fw = 3.5 - fi * 0.08;
                    const _fG = ctx.createLinearGradient(_fx, _fy, _fx, _fy - _fh);
                    _fG.addColorStop(0, 'rgba(251,191,36,0.0)');
                    _fG.addColorStop(0.25, 'rgba(249,115,22,0.85)');
                    _fG.addColorStop(0.65, 'rgba(239,68,68,0.72)');
                    _fG.addColorStop(1, 'rgba(255,255,255,0.92)');
                    ctx.globalAlpha = 0.85 + Math.sin(t * 4.1 + fi) * 0.12;
                    ctx.fillStyle = _fG;
                    ctx.beginPath(); ctx.ellipse(_fx, _fy - _fh * 0.5, _fw, _fh * 0.55, 0, 0, Math.PI * 2); ctx.fill();
                }
                ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            }

            // Hollow spirit eyes — solid crimson glow irises
            const eyeY = hy + 1;
            ctx.shadowBlur = isPunch ? 20 : 11; ctx.shadowColor = coreCol;
            // Eye sockets
            ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.96;
            ctx.beginPath(); ctx.ellipse(-5, eyeY, 4.5, 2.4, -0.08, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(5, eyeY, 4.5, 2.4, 0.08, 0, Math.PI * 2); ctx.fill();
            // Crimson glow irises (no pupils — spirit eyes)
            const eyeInt = Math.max(0.65, 0.75 + eyeFlick * 0.25) * (isPunch ? 1.5 : 1.0 + comboIntensity * 0.5);
            const mkEye = (x, y) => {
                const eG = ctx.createRadialGradient(x, y, 0, x, y, 3.8);
                eG.addColorStop(0, `rgba(255,255,255,${Math.min(1, eyeInt)})`);
                eG.addColorStop(0.35, `${auraCol}${Math.min(1, eyeInt * 0.95)})`);
                eG.addColorStop(1, `${auraCol}0.0)`);
                return eG;
            };
            ctx.fillStyle = mkEye(-5, eyeY); ctx.globalAlpha = 0.96;
            ctx.beginPath(); ctx.ellipse(-5, eyeY, 4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = mkEye(5, eyeY);
            ctx.beginPath(); ctx.ellipse(5, eyeY, 4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // Horizontal eye gleam streaks
            ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.7;
            ctx.globalAlpha = 0.55;
            ctx.beginPath(); ctx.moveTo(-8, eyeY); ctx.lineTo(-2, eyeY); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(2, eyeY); ctx.lineTo(8, eyeY); ctx.stroke();

            // Heavy warrior brows — severe inward angle
            ctx.strokeStyle = '#050000'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
            ctx.globalAlpha = 0.96;
            ctx.beginPath(); ctx.moveTo(-12, hy - 5); ctx.lineTo(-2, hy - 8); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(2, hy - 8); ctx.lineTo(12, hy - 5); ctx.stroke();
            // Crease at bridge
            ctx.lineWidth = 2.0; ctx.strokeStyle = '#1a0000';
            ctx.beginPath(); ctx.moveTo(-3, hy - 7); ctx.quadraticCurveTo(0, hy - 4.5, 3, hy - 7); ctx.stroke();

            // Battle scar
            ctx.strokeStyle = 'rgba(200,80,30,0.65)'; ctx.lineWidth = 1.2;
            ctx.globalAlpha = 0.72;
            ctx.beginPath(); ctx.moveTo(6, eyeY + 2.5); ctx.lineTo(10, eyeY + 7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(7, eyeY + 3); ctx.lineTo(9, eyeY + 6); ctx.stroke();

            // Tight jaw set
            ctx.strokeStyle = armorCol2; ctx.lineWidth = 2.0; ctx.lineCap = 'round';
            ctx.globalAlpha = 0.82;
            ctx.beginPath(); ctx.moveTo(-5, hy + 9); ctx.lineTo(5, hy + 9); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.7;
            ctx.beginPath(); ctx.moveTo(-8, hy + 6); ctx.lineTo(-8, hy + 9); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(8, hy + 6); ctx.lineTo(8, hy + 9); ctx.stroke();

            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            ctx.restore(); // end head
        }

        // ═══ LAYER 5 — ORA combo counter + name chip ═════════════════════════
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + bob * 0.4);
            const chipY = -60;
            const cA = 0.65 + Math.sin(t * 2.1) * 0.15;

            // Punch flash ring behind chip
            if (isPunch && flashT > 0.06) {
                ctx.globalAlpha = flashT * 0.80;
                ctx.strokeStyle = punchCol; ctx.lineWidth = 2.5;
                ctx.shadowBlur = 28; ctx.shadowColor = punchCol;
                ctx.beginPath(); ctx.arc(0, chipY, 30 + (1 - flashT) * 14, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // ORA combo ring — grows with combo count
            if (oraCombo > 0) {
                const oraR = 20 + oraCombo * 2.5;
                const oraA = Math.min(0.7, oraCombo * 0.10);
                ctx.globalAlpha = oraA;
                ctx.strokeStyle = goldCol; ctx.lineWidth = 1.5 + oraCombo * 0.2;
                ctx.shadowBlur = 12; ctx.shadowColor = goldCol;
                ctx.setLineDash([4, 3]);
                ctx.beginPath(); ctx.arc(0, chipY, oraR, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.shadowBlur = 0;
            }

            // Pill bg
            ctx.globalAlpha = cA * 0.80;
            ctx.fillStyle = 'rgba(10,0,0,0.85)';
            ctx.strokeStyle = isPunch
                ? `rgba(255,200,50,${0.55 + flashT * 0.45})`
                : `${auraCol}0.55)`;
            ctx.lineWidth = isPunch ? 2.0 : 1.1;
            ctx.shadowBlur = isPunch ? 16 : 9;
            ctx.shadowColor = isPunch ? goldCol : coreCol;
            ctx.beginPath(); ctx.roundRect(-24, chipY - 7, 48, 14, 4);
            ctx.fill(); ctx.stroke();

            // Heat tier badge
            if (ht > 0) {
                const tierMark = ht >= 3 ? '💥' : ht >= 2 ? '🔥🔥' : '🔥';
                ctx.globalAlpha = cA * 0.96;
                ctx.font = 'bold 7px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
                ctx.fillStyle = ht >= 3 ? '#fef08a' : ht >= 2 ? '#f97316' : '#fb923c';
                ctx.fillText(tierMark, -23, chipY);
            }

            // Label — show combo count if active
            ctx.globalAlpha = cA;
            ctx.fillStyle = isPunch ? goldCol : coreCol;
            ctx.font = 'bold 7.5px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = isPunch ? 14 : 6;
            ctx.shadowColor = isPunch ? goldCol : coreCol;
            const chipLabel = oraCombo >= 3 ? `ORA ×${oraCombo}` : 'WANCHAI';
            ctx.fillText(chipLabel, 0, chipY);
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
        this._oraComboCount = 0;    // ORA combo counter (resets on miss/timeout)
        this._oraTextTimer = 0;     // FIX: timer ควบคุมการแสดง ORA text (กัน flash ทุก frame)

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

        // ── Feature 1: Heat idle decay tracker ───────────────
        this._timeSinceLastHit = 0;     // reset ทุกครั้งที่ gainHeat จาก hit
        this._prevHeatTier = 0;         // ใช้ detect OVERHEAT → tier drop (Vent Explosion)

        // ── Feature 3B: Charge Punch state ───────────────────
        this._chargeTimer = 0;          // > 0 ขณะ hold E
        this._chargeReady = false;      // true เมื่อ charge ถึง chargeMaxTime
        this._eHeld = false;            // track E key hold state

        // ── Feature 3C: Stand Guard state ────────────────────
        this._standGuard = false;

        // ── Feature 4: Stand Meter (แทน wanchaiTimer) ────────
        this.standMeter = 0;            // 0–100, แทน countdown timer
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

        // ── Feature 4: Set Stand Meter full on activation ─────
        this.standMeter = this.stats?.standMeterMax ?? 100;

        // ── Feature 3B/3C: reset charge/guard state on new activation ──
        this._chargeTimer = 0;
        this._chargeReady = false;
        this._eHeld = false;
        this._standGuard = false;

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
    gainHeat(amount, fromHit = false) {
        const S = this.stats ?? {};
        const bonus = this.passiveUnlocked ? (S.passiveHeatGainBonus ?? 1.25) : 1.0;
        this.heat = Math.min(S.heatMax ?? 100, this.heat + amount * bonus);

        // Feature 1: reset idle decay timer เมื่อ hit (ไม่ใช่จาก damage taken)
        if (fromHit) this._timeSinceLastHit = 0;

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
        if (this._oraTextTimer > 0) this._oraTextTimer = Math.max(0, this._oraTextTimer - dt);

        // ── Heat Gauge tick ───────────────────────────────────────
        {
            const S = this.stats ?? {};
            // ── Passive: Heat ไม่ decay ขณะเคลื่อนที่หลัง passive unlock ──
            const isMoving = Math.hypot(this.vx, this.vy) > 5;
            const noDecayOnMove = this.passiveUnlocked && (S.passiveHeatNoDecayOnMove ?? true) && isMoving;
            const decayRate = (this.wanchaiActive || noDecayOnMove)
                ? (S.heatDecayRateActive ?? 0)
                : (S.heatDecayRate ?? 8);
            this.heat = Math.max(0, this.heat - decayRate * dt);

            // ── Feature 1: Idle decay — ไม่ hit 2s+ → heat หายเร็วขึ้น ──────
            this._timeSinceLastHit = (this._timeSinceLastHit ?? 0) + dt;
            const idleDelay = S.heatIdleDecayDelay ?? 2.0;
            if (this._timeSinceLastHit > idleDelay && !this.wanchaiActive) {
                const idleDecay = S.heatIdleDecayRate ?? 8;
                this.heat = Math.max(0, this.heat - idleDecay * dt);
            }

            // Sync tier downward (gainHeat handles upward)
            const newTier = this.heat >= (S.heatTierOverheat ?? 100) ? 3
                : this.heat >= (S.heatTierHot ?? 67) ? 2
                    : this.heat >= (S.heatTierWarm ?? 34) ? 1 : 0;

            // ── Feature 1: Vent Explosion — OVERHEAT tier drop ───────────
            const prevTier = this._prevHeatTier ?? 0;
            if (prevTier >= 3 && newTier < 3) {
                // OVERHEAT จบ → AOE burst
                const ventRange = S.ventExplosionRange ?? 160;
                const ventDmg = S.ventExplosionDamage ?? 45;
                for (const e of (window.enemies || [])) {
                    if (e.dead) continue;
                    if (Math.hypot(e.x - this.x, e.y - this.y) < ventRange) {
                        e.takeDamage?.(ventDmg * (this.damageMultiplier || 1.0), this);
                    }
                }
                if (window.boss && !window.boss.dead) {
                    if (Math.hypot(window.boss.x - this.x, window.boss.y - this.y) < ventRange + (window.boss.radius ?? 0)) {
                        window.boss.takeDamage?.(ventDmg * 0.5 * (this.damageMultiplier || 1.0), this);
                    }
                }
                if (typeof spawnParticles === 'function') {
                    spawnParticles(this.x, this.y, 25, '#f97316', 'explosion');
                }
                if (typeof addScreenShake === 'function') addScreenShake(6);
                if (typeof spawnFloatingText === 'function')
                    spawnFloatingText('VENT!', this.x, this.y - 60, '#fb923c', 20);
            }
            this._prevHeatTier = newTier;
            this._heatTier = newTier;

            // ── Feature 1: COLD tier — display text ─────────────────────
            const prevWasCold = (prevTier > 0);
            if (newTier === 0 && prevWasCold && typeof spawnFloatingText === 'function') {
                spawnFloatingText('❄️ COLD', this.x, this.y - 60, '#93c5fd', 14);
            }

            // ── Feature 1: COLD penalty on move speed ────────────────────
            // (damage penalty applied in _punch / _doPlayerMelee below)
            // speedMult applied via speedBoost before super.update()

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
                if (typeof Achievements !== 'undefined') Achievements.check('rage_mode');
            }
        }

        if (this.wanchaiActive) {
            // ── Feature 4: Stand Meter drain (แทน wanchaiTimer) ──────────
            const S4 = this.stats ?? {};
            let drainRate = S4.standMeterDrainRate ?? 8;
            const ht4 = this._heatTier ?? 0;
            if (ht4 >= 3) drainRate *= (S4.standMeterDrainOverheat ?? 0.50);
            else if (ht4 === 0) drainRate *= (S4.standMeterDrainCold ?? 1.30);
            this.standMeter = Math.max(0, (this.standMeter ?? 0) - drainRate * dt);

            // Still tick wanchaiTimer for HUD compat (but deactivation uses standMeter)
            this.wanchaiTimer -= dt;

            if (this.standMeter <= 0) {
                this.wanchaiActive = false;
                this.wanchaiTimer = 0;
                this.standMeter = 0;
                if (this.wanchaiStand) { this.wanchaiStand.active = false; this.wanchaiStand = null; }
                // BUG-FIX (OVERHEATED spam): กัน heat wave ยิงทันทีที่ Wanchai จบ
                this.cooldowns.shoot = Math.max(this.cooldowns.shoot ?? 0, 0.18);
                // Feature 3B: reset charge state เมื่อ Stand หมด
                this._chargeTimer = 0;
                this._chargeReady = false;
                this._eHeld = false;
                this._standGuard = false;
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

        // ── Feature 1: COLD tier — speed penalty ──────────────────
        if ((this._heatTier ?? 0) === 0) {
            const coldSpeedMult = this.stats?.coldSpeedMult ?? 0.90;
            this.speedBoost = (this.speedBoost || 1) * coldSpeedMult;
        }

        // ── Feature 3C: Stand Guard — block movement ──────────────
        this._standGuard = !!(this.wanchaiActive && keys?.shift);
        // (movement is handled naturally — player can still move while guarding,
        //  but shooting is blocked below. Full movement block would frustrate players.)

        super.update(dt, keys, mouse);

        // ── Tick graphBuffTimer ────────────────────────────────
        if ((this.graphBuffTimer ?? 0) > 0) this.graphBuffTimer = Math.max(0, this.graphBuffTimer - dt);

        // Stateless restore
        this.speedBoost = oldSpeedBoost;

        // ── Q: Vacuum Heat — ดูดศัตรูเข้ามากอง ────────────────────
        // กด Q ดึงทุกตัวในรัศมี 320px เข้าหาออโต้ทันที
        // cooldown 8 วินาที | ออกแบบให้ combo กับ Wanchai
        if (mouse?.middle !== undefined) { /* placeholder */ }

        // ── Feature 3A: Stand Pull — Q ขณะ Wanchai active ─────────
        if (checkInput('q') && this.wanchaiActive && this.passiveUnlocked && (this.cooldowns?.vacuum ?? 0) <= 0) {
            const vCost = this.stats?.vacuumEnergyCost ?? 20;
            if ((this.energy ?? 0) < vCost) {
                spawnFloatingText('⚡ FOCUS LOW!', this.x, this.y - 50, '#facc15', 16);
            } else {
                this.energy = Math.max(0, (this.energy ?? 0) - vCost);
                this._doStandPull();
            }
            consumeInput('q');
        } else if (checkInput('q') && !this.passiveUnlocked) {
            // ── Vacuum ใช้ได้ตั้งแต่ต้น (basic version: ดูดอย่างเดียว) ──────
            if ((this.cooldowns?.vacuum ?? 0) <= 0) {
                const vCost = this.stats?.vacuumEnergyCost ?? 20;
                if ((this.energy ?? 0) < vCost) {
                    spawnFloatingText('⚡ FOCUS LOW!', this.x, this.y - 50, '#facc15', 16);
                } else {
                    this.energy = Math.max(0, (this.energy ?? 0) - vCost);
                    this._doVacuum({ earlyMode: true });
                }
            } else {
                spawnFloatingText(`⏳ ${Math.ceil(this.cooldowns.vacuum)}s`, this.x, this.y - 40, '#94a3b8', 14);
            }
            consumeInput('q');
        } else if (checkInput('q') && this.passiveUnlocked && (this.cooldowns?.vacuum ?? 0) <= 0) {
            const vCost = this.stats?.vacuumEnergyCost ?? 20;
            if ((this.energy ?? 0) < vCost) {
                spawnFloatingText('⚡ FOCUS LOW!', this.x, this.y - 50, '#facc15', 16);
            } else {
                this.energy = Math.max(0, (this.energy ?? 0) - vCost);
                this._doVacuum({ earlyMode: false });
            }
            consumeInput('q');
        }

        // ── E: Charge Punch (Feature 3B) / Overheat Detonation ─────
        // กด E ค้างขณะ Wanchai active = charge, ปล่อย = super punch
        // กด E ขณะไม่ได้ unlock = locked message
        if (!this.passiveUnlocked) {
            if (checkInput('e')) {
                spawnFloatingText('🔒 ทำ Heat เต็ม 100 ก่อน!', this.x, this.y - 40, '#94a3b8', 14);
                consumeInput('e');
            }
            // reset charge if passive not unlocked
            this._chargeTimer = 0; this._chargeReady = false; this._eHeld = false;
        } else if (this.wanchaiActive && (this.cooldowns?.detonation ?? 0) <= 0) {
            // ── Charge Punch logic — track hold/release manually ──────
            const eDown = checkInput('e') || (typeof keys !== 'undefined' && keys?.e);

            if (eDown && !this._eHeld) {
                // Rising edge — start charge
                this._eHeld = true;
                this._chargeTimer = 0;
                this._chargeReady = false;
                consumeInput('e'); // consume once on press
            } else if (eDown && this._eHeld) {
                // Holding — advance charge
                const S = this.stats ?? {};
                this._chargeTimer = Math.min((this._chargeTimer ?? 0) + dt, S.chargeMaxTime ?? 1.5);
                if (this._chargeTimer >= (S.chargeMaxTime ?? 1.5)) {
                    this._chargeReady = true;
                }
            } else if (!eDown && this._eHeld) {
                // Release — fire!
                this._eHeld = false;
                const S = this.stats ?? {};
                const chargeRatio = Math.min(1, (this._chargeTimer ?? 0) / (S.chargeMaxTime ?? 1.5));
                const maxDmgMult = S.chargeDamageMultMax ?? 3.5;
                const maxRangeMult = S.chargeRangeMultMax ?? 1.3;
                const dmgMult = 1 + chargeRatio * (maxDmgMult - 1);
                const rangeMult = 0.5 + chargeRatio * (maxRangeMult - 0.5);
                const detCost = S.detonationEnergyCost ?? 30;
                if ((this.energy ?? 0) < detCost) {
                    spawnFloatingText('⚡ FOCUS LOW!', this.x, this.y - 50, '#facc15', 16);
                } else {
                    this.energy = Math.max(0, (this.energy ?? 0) - detCost);
                    const isOverheat = (this._heatTier ?? 0) >= 3;
                    const DET_RANGE = (S.detonationRange ?? 240) * rangeMult * (isOverheat ? 1.5 : 1.0);
                    const detBaseDmg = (S.detonationBaseDamage ?? 55) * dmgMult + this.heat * (S.detonationHeatScaling ?? 1.2);
                    const detFinalBase = detBaseDmg * (this.damageMultiplier || 1.0);
                    let detCrit = this.baseCritChance + (S.standCritBonus ?? 0.25);
                    if (isOverheat) detCrit += (S.heatCritBonusOverheat ?? 0.20);
                    const detIsCrit = Math.random() < detCrit;
                    let detFinalDmg = detFinalBase * (detIsCrit ? (S.critMultiplier ?? 2.2) : 1.0);
                    if (this.isSecondWind) detFinalDmg *= (BALANCE.player.secondWindDamageMult || 1.5);
                    // Hard cap — กัน RAGE+OVERHEAT+crit stack สุดขีด
                    detFinalDmg = Math.min(detFinalDmg, S.detonationDamageHardCap ?? 600);

                    // Stand position is the blast origin
                    const bx = this.wanchaiStand?.x ?? this.x;
                    const by = this.wanchaiStand?.y ?? this.y;

                    let totalDet = 0;
                    for (const enemy of (window.enemies || [])) {
                        if (enemy.dead) continue;
                        if (Math.hypot(enemy.x - bx, enemy.y - by) < DET_RANGE) {
                            enemy.takeDamage(detFinalDmg);
                            totalDet += detFinalDmg;
                            spawnParticles(enemy.x, enemy.y, 5, detIsCrit ? '#facc15' : '#dc2626');
                        }
                    }
                    if (window.boss && !window.boss.dead) {
                        if (Math.hypot(window.boss.x - bx, window.boss.y - by) < DET_RANGE + (window.boss.radius ?? 0)) {
                            const bossPx = window.boss.x, bossPy = window.boss.y;  // FIX: snapshot ก่อน takeDamage — boss อาจ null หลัง call
                            window.boss.takeDamage(detFinalDmg);
                            totalDet += detFinalDmg;
                            spawnParticles(bossPx, bossPy, 8, detIsCrit ? '#facc15' : '#dc2626');
                        }
                    }
                    if (this.passiveUnlocked && totalDet > 0) {
                        this.hp = Math.min(this.maxHp, this.hp + totalDet * (S.passiveLifesteal ?? 0.01));
                    }

                    this.heat = Math.max(0, this.heat - 80);  // BUFF drain: 50 → 80 (รู้สึก "ระบาย" จริง)
                    this._heatTier = this.heat >= (S.heatTierHot ?? 67) ? 2
                        : this.heat >= (S.heatTierWarm ?? 34) ? 1 : 0;
                    this.cooldowns.detonation = S.detonationCooldown ?? 8;

                    spawnParticles(bx, by, 60, '#dc2626');
                    addScreenShake(chargeRatio >= 0.99 ? 16 : 10);
                    const chargeLabel = chargeRatio >= 0.99 ? '💥 MAX CHARGE!' : detIsCrit ? `💥 CRIT! ${Math.floor(detFinalDmg)}` : `💥 ${Math.floor(detFinalDmg)}`;
                    spawnFloatingText(chargeLabel, bx, by - 70, detIsCrit ? '#facc15' : '#dc2626', chargeRatio >= 0.99 ? 34 : 28);
                    if (typeof Audio !== 'undefined' && Audio.playDetonation) Audio.playDetonation();
                }
                this._chargeTimer = 0;
                this._chargeReady = false;
            }
        } else if (this.passiveUnlocked && !this.wanchaiActive) {
            // Not in Wanchai — cooldown message only
            if (checkInput('e')) {
                if ((this.cooldowns?.detonation ?? 0) > 0) {
                    spawnFloatingText(`⏳ ${Math.ceil(this.cooldowns.detonation)}s`, this.x, this.y - 40, '#94a3b8', 14);
                } else {
                    spawnFloatingText('เรียก Stand ก่อน!', this.x, this.y - 40, '#94a3b8', 14);
                }
                consumeInput('e');
                this._chargeTimer = 0; this._chargeReady = false; this._eHeld = false;
            }
        }



        // ── Feature 3C: Stand Guard — block shooting ───────────────
        if (this._standGuard) {
            this.isStandAttacking = false;  // FIX: reset ก่อน return กัน ORA visual ค้าง
            return;
        }

        // Reset attack state every frame
        this.isStandAttacking = false;

        // ── MODE A: Wanchai active → L-Click = Stand Rush (ต่อยรัวระยะใกล้) ────
        if (this.wanchaiActive) {
            if (!mouse || mouse.left !== 1) return;
            if (this.wanchaiStand?.active) {
                this.wanchaiStand._forcedTargetX = mouse.wx;
                this.wanchaiStand._forcedTargetY = mouse.wy;
            }
            if ((this.cooldowns?.shoot ?? 0) <= 0) {
                this.isStandAttacking = true;
                this.cooldowns.shoot = this.stats?.playerRushCooldown ?? 0.10;
                this._doPlayerMelee(mouse);
            }
            // Stand Rush on cooldown → wait (ไม่ fallthrough ไป Heat Wave อีกต่อไป)
            return;
        }

        // ── MODE B: ไม่มี Stand → L-Click = ยิง Heat Wave ปกติ (มี CD) ──────────
        if (!mouse || mouse.left !== 1) return;
        if (typeof projectileManager === 'undefined' || !projectileManager) return;

        const heatCd = this.stats?.heatWaveCooldown ?? 0.28;
        if ((this.cooldowns?.shoot ?? 0) > 0) return;  // FIX: เพิ่ม CD check — เดิมไม่มีทำให้รัวทุก frame
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
        // +15 = enemy radius allowance เท่านั้น ไม่ใช่ +60 ที่ทำให้ hit range = 145px
        let target = null;
        let bestD = range + 15;
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
            // Miss fan — narrower arc, dimmer alpha to signal whiff
            const _mFanCount = 4, _mSpread = Math.PI * 0.22;
            const _mFaceA = this.angle;
            for (let i = 0; i < _mFanCount; i++) {
                const t_ = i / (_mFanCount - 1);
                const a = _mFaceA - _mSpread / 2 + t_ * _mSpread;
                const r = 30 + t_ * 35;
                this._rushFists.push({
                    ox: Math.cos(a) * r,
                    oy: Math.sin(a) * r,
                    sc: 0.30 + t_ * 0.30,
                    alpha: 0.45  // ← จางกว่า hit เพื่อบ่งบอกว่า miss
                });
            }
            this._rushFistTimer = 0.08;
            // Miss breaks ORA combo
            this._oraComboCount = Math.max(0, (this._oraComboCount ?? 0) - 1);
            // Miss VFX + sound
            if (typeof spawnParticles === 'function') spawnParticles(cx, cy, 2, '#ef4444');
            if (typeof Audio !== 'undefined' && Audio.playPunch) Audio.playPunch();
            return;
        }

        // Stand Rush — velocity burst toward target (replaces instant teleport)
        if (this.wanchaiStand?.active) {
            const _sd = Math.hypot(target.x - this.wanchaiStand.x, target.y - this.wanchaiStand.y);
            if (_sd > 1) {
                const _rushSpeed = 2200; // px/s burst — fast but not instant
                this.wanchaiStand._rushBurstVx = (target.x - this.wanchaiStand.x) / _sd * _rushSpeed;
                this.wanchaiStand._rushBurstVy = (target.y - this.wanchaiStand.y) / _sd * _rushSpeed;
                this.wanchaiStand._rushBurstTimer = 0.18;
                this.wanchaiStand.angle = Math.atan2(target.y - this.wanchaiStand.y, target.x - this.wanchaiStand.x);
            }
        }

        // Heat gain per player rush hit
        this.gainHeat(S.heatPerPlayerHit ?? 8, true);
        // Heat tier damage (Feature 1: COLD penalty)
        const pht = this._heatTier ?? 0;
        const pHeatMult = pht >= 3 ? (S.heatDmgOverheat ?? 1.50)
            : pht >= 2 ? (S.heatDmgHot ?? 1.30)
                : pht >= 1 ? (S.heatDmgWarm ?? 1.15)
                    : (S.coldDamageMult ?? 0.70); // COLD penalty
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

        // ── ORA Combo escalation from player hits ─────────────────────────
        this._oraComboCount = Math.min(10, (this._oraComboCount ?? 0) + 1);
        this._oraTextTimer = 0.45;  // FIX: แสดง ORA text 0.45s แล้วจาง — reset ทุกครั้งที่ punch
        // High combo = escalating ORA text
        if (this._oraComboCount >= 5 && typeof spawnFloatingText === 'function') {
            spawnFloatingText(`ORA ORA ×${this._oraComboCount}`, this.x, this.y - 60, '#f59e0b', 16);
        }
        // Attack speed bonus from combo — faster playerRushCooldown at high combo
        const _comboSpeedBonus = Math.min(0.04, this._oraComboCount * 0.006);
        this.cooldowns.shoot = Math.max(0.04, (this.stats?.playerRushCooldown ?? 0.10) - _comboSpeedBonus);

        // Precompute rush fist positions — combo-scaled barrage (drawn by PlayerRenderer)
        this._rushFists = this._rushFists ?? [];
        this._rushFists.length = 0;
        const _hFanCount = Math.min(12, 5 + Math.floor(this._oraComboCount * 0.8));
        const _hSpread = Math.max(Math.PI * 0.15, Math.PI * 0.38 - this._oraComboCount * 0.025);
        const _hFaceA = this.angle;
        for (let i = 0; i < _hFanCount; i++) {
            const t_ = i / (_hFanCount - 1);
            const a = _hFaceA - _hSpread / 2 + t_ * _hSpread;
            const r = 40 + t_ * 55;
            this._rushFists.push({
                ox: Math.cos(a) * r,
                oy: Math.sin(a) * r,
                sc: 0.45 + t_ * 0.60,
                alpha: 1.0
            });
        }
        this._rushFistTimer = 0.12;

        // Sync combo into WanchaiStand so ORA counter escalates
        if (this.wanchaiStand) {
            this.wanchaiStand._punchPhase = 2;
            this.wanchaiStand._phaseTimer = 0.10;
        }

        if (typeof Achievements !== 'undefined' && target.hp <= 0) {
            Achievements.stats.standRushKills = (Achievements.stats.standRushKills ?? 0) + 1;
            Achievements.check?.('stand_rush_kill');
        }

        // ── Feature 4: Stand Meter fill on hit ──────────────────
        const S_meter = this.stats ?? {};
        this.standMeter = Math.min(S_meter.standMeterMax ?? 100, (this.standMeter ?? 0) + (S_meter.standMeterPerHit ?? 4));

        // ── Feature 2: Killing Blow Supercharge ─────────────────
        if (target.hp <= 0 && (this._oraComboCount ?? 0) >= (S_meter.oraComboSuperchargeMin ?? 5)) {
            this.gainHeat(S_meter.heatOnKillSupercharge ?? 30, true);
            this.cooldowns.shoot = 0; // reset rush cooldown ทันที
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText('SUPERCHARGE!', this.x, this.y - 70, '#fef08a', 22);
            if (typeof addScreenShake === 'function') addScreenShake(5);
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
        // ── Achievement: SCORCHED SOUL ────────────────────────────────────
        if (typeof Achievements !== 'undefined') Achievements.check('scorched_soul');

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

    // ── Feature 3A: Stand Pull — Q ขณะ Wanchai active ─────────────────────
    // Stand ดึง enemy เข้าหาตำแหน่ง Stand แบบ instant
    _doStandPull() {
        const S = this.stats ?? {};
        const standX = this.wanchaiStand?.x ?? this.x;
        const standY = this.wanchaiStand?.y ?? this.y;
        const pullRange = S.standPullRange ?? 380;
        const pullDmg = S.standPullDamage ?? 18;

        let pulled = 0;
        for (const enemy of (window.enemies || [])) {
            if (enemy.dead) continue;
            const d = Math.hypot(enemy.x - standX, enemy.y - standY);
            if (d < pullRange) {
                // Instant position pull → beside Stand
                const pullAngle = Math.atan2(enemy.y - standY, enemy.x - standX);
                const offset = (enemy.radius ?? 14) + 40;
                enemy.x = standX + Math.cos(pullAngle) * offset;
                enemy.y = standY + Math.sin(pullAngle) * offset;
                enemy.vx = 0; enemy.vy = 0;
                enemy.takeDamage?.(pullDmg * (this.damageMultiplier || 1.0), this);
                pulled++;
            }
        }
        // Boss — weak pull (30%)
        if (window.boss && !window.boss.dead) {
            const d = Math.hypot(window.boss.x - standX, window.boss.y - standY);
            if (d < pullRange && d > 1) {
                const pullAngle = Math.atan2(window.boss.y - standY, window.boss.x - standX);
                const bossOffset = (window.boss.radius ?? 30) + 50;
                window.boss.vx = ((standX + Math.cos(pullAngle) * bossOffset) - window.boss.x) * 8;
                window.boss.vy = ((standY + Math.sin(pullAngle) * bossOffset) - window.boss.y) * 8;
            }
        }
        this.cooldowns.vacuum = S.standPullCooldown ?? 10;  // FIX: Stand Pull CD แยกจาก Vacuum (แรงกว่า = CD ยาวกว่า)
        if (pulled > 0) {
            this.gainHeat(S.vacuumHeatGain ?? 25, true);
            if (typeof spawnParticles === 'function') spawnParticles(standX, standY, 35, '#dc2626');
            if (typeof addScreenShake === 'function') addScreenShake(5);
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText(`🥊 STAND PULL ×${pulled}`, standX, standY - 60, '#dc2626', 22);
        } else {
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText('STAND PULL', standX, standY - 40, '#94a3b8', 14);
        }
    }

    // ── Vacuum Heat — shared logic for early (basic) and post-passive (full) ──
    _doVacuum({ earlyMode = false } = {}) {
        const S = this.stats ?? {};
        const VACUUM_RANGE = S.vacuumRange ?? 340;
        const VACUUM_FORCE = S.vacuumForce ?? 1900;
        const STUN_DUR = S.vacuumStunDur ?? 0.50;
        const PULL_DUR = S.vacuumPullDur ?? 0.45;
        // earlyMode: ดูดอย่างเดียว ไม่มี Ignite ไม่มี Heat gain มาก
        const vacDmg = earlyMode ? 0 : (S.vacuumDamage ?? 18);
        const ignDur = earlyMode ? 0 : (S.vacuumIgniteDuration ?? 1.5);
        const ignDps = earlyMode ? 0 : (S.vacuumIgniteDPS ?? 12);
        const heatGain = earlyMode ? 10 : (S.vacuumHeatGain ?? 25);

        let pulled = 0;
        for (const enemy of (window.enemies || [])) {
            if (enemy.dead) continue;
            const dx = this.x - enemy.x;
            const dy = this.y - enemy.y;
            const d = Math.hypot(dx, dy);
            if (d < VACUUM_RANGE && d > 1) {
                enemy.vx = (dx / d) * VACUUM_FORCE;
                enemy.vy = (dy / d) * VACUUM_FORCE;
                enemy.vacuumStunTimer = STUN_DUR;
                enemy._vacuumTargetX = this.x;
                enemy._vacuumTargetY = this.y;
                enemy._vacuumPullTimer = PULL_DUR;
                if (!earlyMode) {
                    enemy.takeDamage?.(vacDmg * (this.damageMultiplier || 1.0), this);
                    enemy.isBurning = true;
                    enemy.burnTimer = ignDur;
                    enemy.burnDps = ignDps;
                }
                pulled++;
            }
        }
        if (pulled > 0) this.gainHeat(heatGain);
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
        this.cooldowns.vacuum = S.vacuumCooldown ?? 6;
        if (pulled > 0 || (window.boss && !window.boss.dead)) {
            spawnParticles(this.x, this.y, 40, '#f97316');
            addScreenShake(6);
            const label = earlyMode
                ? `💨 VACUUM ×${pulled}`
                : `🔥 VACUUM HEAT ×${pulled}`;
            spawnFloatingText(label, this.x, this.y - 60, '#f97316', 24);
            if (typeof Audio !== 'undefined' && Audio.playVacuum) Audio.playVacuum();
        }
    }

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
            if (iconLabelEl) {
                // Feature 4: Show Stand Meter % instead of countdown timer
                const meterPct = Math.ceil((this.standMeter ?? 0));
                const htLabel = (this._heatTier ?? 0) === 0 ? '❄️' : (this._heatTier ?? 0) >= 3 ? '💥' : '';
                iconLabelEl.textContent = `${htLabel}${meterPct}%`;
            }
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