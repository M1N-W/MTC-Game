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
        this._atkTimer = 0;
        this._atkRate = 0;
        this._punchPhase = 0;       // 0=idle 1=wind-up 2=strike
        this._phaseTimer = 0;
        this._punchSide = 1;        // 1=right, -1=left — alternates each punch
        this.lastPunchSoundTime = 0;

        // ── ORA ORA Combo System ──────────────────────────────
        this._comboCount = 0;       // hits in current combo
        this._comboTimer = 0;       // resets combo if > 0.45s since last hit
        this._rushMode = false;     // true during burst phase (every 6 hits)
        this._rushTimer = 0;        // duration of rush burst
        this._rushFists = [];       // [{x,y,alpha,side}] — precomputed each punch in update()
        this._oraLabel = '';        // current ora text ('ORA!', 'ORA ORA!', 'ORА ORA ORA!!', etc.)
        this._oraAlpha = 0;         // fade timer for ora text
        this._hitStopTimer = 0;     // when > 0, stand freezes in place (hit-stop feel)
        this._targetHitStopX = 0;   // cached target pos during hit-stop
        this._targetHitStopY = 0;

        // Rendering
        this.angle = owner.angle;
        this.ghostTrail = [];
    }

    update(dt) {
        if (!this.active) return;
        const owner = this.owner;
        if (!owner || !owner.wanchaiActive) { this.active = false; return; }

        const S = owner.stats ?? {};
        this._atkRate = S.wanchaiPunchRate ?? 0.08;
        const baseAtkRate = this._atkRate;
        const atkRange = S.standPunchRange ?? 110;
        const chaseSpeed = S.standMoveSpeed ?? 340;
        const leashRadius = S.standLeashRadius ?? 420;

        // ── Combo decay ──────────────────────────────────────
        if (this._comboCount > 0) {
            this._comboTimer -= dt;
            if (this._comboTimer <= 0) {
                this._comboCount = 0;
                this._rushMode = false;
            }
        }

        // ── Rush burst timer ─────────────────────────────────
        if (this._rushMode) {
            this._rushTimer -= dt;
            if (this._rushTimer <= 0) { this._rushMode = false; this._rushTimer = 0; }
        }

        // ── Hit-stop (stand pauses briefly after hard hit) ───
        if (this._hitStopTimer > 0) {
            this._hitStopTimer -= dt;
            this._oraAlpha = Math.max(0, this._oraAlpha - dt * 2);
            this._phaseTimer = Math.max(0, this._phaseTimer - dt);
            // Decay rush fists alpha
            for (const f of this._rushFists) f.alpha = Math.max(0, f.alpha - dt * 6);
            return; // freeze movement during hit-stop
        }

        // ── Find nearest target ──────────────────────────────
        let target = null;
        let nearestDist = atkRange * 2.5;

        const fx = this._forcedTargetX;
        const fy = this._forcedTargetY;
        if (fx !== undefined && fy !== undefined) {
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
            this._forcedTargetX = undefined;
            this._forcedTargetY = undefined;
        }
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

        // ── Movement ─────────────────────────────────────────
        if (target) {
            this.angle = Math.atan2(target.y - this.y, target.x - this.x);
            const d = Math.hypot(target.x - this.x, target.y - this.y);
            const step = chaseSpeed * dt;
            if (d > this.radius + (target.radius ?? 14)) {
                this.x += (target.x - this.x) / d * step;
                this.y += (target.y - this.y) / d * step;
            }
        } else {
            const ox = owner.x + Math.cos(owner.angle) * 60;
            const oy = owner.y + Math.sin(owner.angle) * 60;
            const d = Math.hypot(ox - this.x, oy - this.y);
            if (d > 12) {
                const step = chaseSpeed * 0.5 * dt;
                this.x += (ox - this.x) / d * step;
                this.y += (oy - this.y) / d * step;
            }
        }

        // Leash
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

        // Decay ora text
        this._oraAlpha = Math.max(0, this._oraAlpha - dt * 2.5);
        // Decay rush fist ghosts
        for (const f of this._rushFists) f.alpha = Math.max(0, f.alpha - dt * 5);

        // ── Attack logic ─────────────────────────────────────
        // Rush mode fires at 2.5× base rate
        const effectiveRate = this._rushMode ? baseAtkRate * 0.38 : baseAtkRate;

        this._atkTimer -= dt;
        this._phaseTimer = Math.max(0, this._phaseTimer - dt);

        if (this._atkTimer <= 0 && target) {
            const distToTarget = Math.hypot(target.x - this.x, target.y - this.y);
            if (distToTarget < atkRange + (target.radius ?? 14)) {
                this._atkTimer = effectiveRate;
                this._punch(target, owner);
            } else {
                this._atkTimer = Math.min(this._atkTimer, 0);
            }
        } else if (this._atkTimer <= 0) {
            this._atkTimer = effectiveRate * 0.5;
        }
    }

    _punch(target, owner) {
        const S = owner.stats ?? {};
        let dmg = (S.wanchaiDamage ?? 32) * (owner.damageMultiplier || 1.0);

        // Second Wind bonus
        if (owner.isSecondWind) dmg *= (BALANCE?.player?.secondWindDamageMult || 1.5);

        // Crit — higher chance in rush mode
        let critChance = (owner.baseCritChance ?? 0.06) + (S.standCritBonus ?? 0.40);
        if (this._rushMode) critChance += 0.15;
        if (owner.passiveUnlocked) critChance += (S.passiveCritBonus ?? 0);
        const isCrit = Math.random() < critChance;
        if (isCrit) {
            dmg *= (S.critMultiplier ?? 2.0);
            if (owner.passiveUnlocked) owner.goldenAuraTimer = 1;
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.crits = (Achievements.stats.crits ?? 0) + 1;
                Achievements.check?.('crit_master');
            }
        }

        // Rush-mode damage bonus (the barrage hits harder)
        if (this._rushMode) dmg *= 1.25;

        target.takeDamage(dmg, owner);

        // Lifesteal
        if (owner.passiveUnlocked) {
            owner.hp = Math.min(owner.maxHp, owner.hp + dmg * (S.passiveLifesteal ?? 0.02));
        }

        // ── Knockback — alternating side per punch ───────────
        const ka = Math.atan2(target.y - this.y, target.x - this.x);
        const kf = (S.standKnockback ?? 180) * (this._rushMode ? 0.5 : 1.0); // less KB in rush
        target.vx = (target.vx ?? 0) + Math.cos(ka) * kf;
        target.vy = (target.vy ?? 0) + Math.sin(ka) * kf;

        // ── Combo counter ────────────────────────────────────
        this._comboCount++;
        this._comboTimer = 0.45; // window to continue combo
        this._punchSide *= -1;   // alternate fists

        // Every 6 hits → trigger rush burst
        if (this._comboCount % 6 === 0) {
            this._rushMode = true;
            this._rushTimer = 0.9;
            if (typeof addScreenShake === 'function') addScreenShake(7);
            if (typeof spawnFloatingText === 'function')
                spawnFloatingText('ORA ORA ORA!!!', this.x, this.y - 55, '#facc15', 22);
        }

        // ── Precompute rush fist ghosts (no Math.random in draw!) ─
        this._rushFists.length = 0;
        const fistCount = this._rushMode ? 9 : (this._comboCount >= 3 ? 5 : 3);
        for (let i = 0; i < fistCount; i++) {
            this._rushFists.push({
                ox: 38 + Math.random() * 85,   // offset along stand angle
                oy: (Math.random() - 0.5) * 65,
                scale: 0.45 + Math.random() * 0.7,
                side: Math.random() < 0.5 ? 1 : -1,
                alpha: 0.75 + Math.random() * 0.25
            });
        }

        // ── ORA label — escalates with combo ─────────────────
        const oraLabels = ['ORA!', 'ORA ORA!', 'ORA ORA ORA!!', 'ORA×4!!', 'ORA×5!!!', 'ORAAAA!!!'];
        const idx = Math.min(this._comboCount - 1, oraLabels.length - 1);
        this._oraLabel = oraLabels[idx];
        this._oraAlpha = 1.0;

        // ── VFX ──────────────────────────────────────────────
        const particleCount = this._rushMode ? 8 : (isCrit ? 5 : 3);
        const particleColor = this._rushMode ? '#f97316' : (isCrit ? '#facc15' : '#ef4444');
        if (typeof spawnParticles === 'function')
            spawnParticles(target.x, target.y, particleCount, particleColor);

        const shakeAmt = this._rushMode ? 6 : (isCrit ? 5 : 2);
        if (typeof addScreenShake === 'function') addScreenShake(shakeAmt);

        if (isCrit && !this._rushMode && typeof spawnFloatingText === 'function')
            spawnFloatingText('วันชัย!', this.x, this.y - 30, '#facc15', 18);

        // ── Hit-stop: freeze stand briefly on heavy hits ──────
        if (isCrit || this._comboCount % 6 === 0) {
            this._hitStopTimer = 0.07;
            this._targetHitStopX = target.x;
            this._targetHitStopY = target.y;
        }

        // Punch animation phase
        this._punchPhase = 2;
        this._phaseTimer = this._rushMode ? 0.07 : 0.12;

        // ── Achievements ─────────────────────────────────────
        if (typeof Achievements !== 'undefined') {
            Achievements.stats.standRushKills = Achievements.stats.standRushKills ?? 0;
            if (target.hp <= 0) {
                Achievements.stats.standRushKills++;
                Achievements.check?.('stand_rush_kill');
            }
        }

        // Sound
        const now = Date.now();
        const soundCooldown = this._rushMode ? 40 : 60;
        if (now - this.lastPunchSoundTime > soundCooldown) {
            if (typeof Audio !== 'undefined' && Audio.playStandRush) Audio.playStandRush();
            this.lastPunchSoundTime = now;
        }
    }

    draw(ctx) {
        if (!this.active || typeof ctx === 'undefined') return;
        const now = performance.now();
        const screen = worldToScreen(this.x, this.y);

        // Ghost trail
        for (let i = this.ghostTrail.length - 1; i >= 0; i--) {
            const g = this.ghostTrail[i];
            const gs = worldToScreen(g.x, g.y);
            ctx.save();
            ctx.globalAlpha = g.alpha * 0.6;
            ctx.strokeStyle = this._rushMode ? '#f97316' : '#ef4444';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10; ctx.shadowColor = this._rushMode ? '#ea580c' : '#dc2626';
            ctx.beginPath(); ctx.arc(gs.x, gs.y, 18 - i * 2, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(screen.x, screen.y);

        // ── Rush fist afterimages (precomputed in update/_punch) ───
        if (this._rushFists.length > 0) {
            ctx.save();
            ctx.rotate(this.angle);
            for (const f of this._rushFists) {
                if (f.alpha <= 0) continue;
                const fy = f.oy * f.side;
                ctx.globalAlpha = f.alpha * (this._rushMode ? 0.75 : 0.55);
                ctx.fillStyle = this._rushMode ? 'rgba(251,146,60,0.85)' : 'rgba(239,68,68,0.80)';
                ctx.shadowBlur = this._rushMode ? 16 : 8;
                ctx.shadowColor = this._rushMode ? '#f97316' : '#dc2626';
                ctx.beginPath();
                ctx.ellipse(f.ox, fy, 14 * f.scale, 9 * f.scale, 0, 0, Math.PI * 2);
                ctx.fill();
                // Motion line
                ctx.strokeStyle = this._rushMode ? 'rgba(251,146,60,0.5)' : 'rgba(248,113,113,0.45)';
                ctx.lineWidth = 4 * f.scale;
                ctx.shadowBlur = 4;
                ctx.beginPath();
                ctx.moveTo(f.ox - 28 * f.scale, fy);
                ctx.lineTo(f.ox, fy);
                ctx.stroke();
            }
            ctx.restore();
        }

        // ── Outer aura ring ───────────────────────────────────
        const pulseMult = (this._phaseTimer > 0) ? 2.5 : (this._rushMode ? 4.0 : 1);
        const auraColor = this._rushMode ? '#f97316' : '#ef4444';
        const auraAlpha = (this._rushMode ? 0.55 : 0.3) + Math.sin(now / 100 * pulseMult) * 0.2;
        ctx.globalAlpha = auraAlpha;
        ctx.strokeStyle = auraColor; ctx.lineWidth = this._rushMode ? 4 : 3;
        ctx.shadowBlur = this._rushMode ? 40 : 22;
        ctx.shadowColor = this._rushMode ? '#ea580c' : '#dc2626';
        ctx.beginPath();
        ctx.arc(0, 0, (this._rushMode ? 36 : 30) + Math.sin(now / 120) * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Rush mode — second ring
        if (this._rushMode) {
            ctx.globalAlpha = 0.35 + Math.sin(now / 60) * 0.2;
            ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
            ctx.shadowBlur = 20; ctx.shadowColor = '#f59e0b';
            ctx.beginPath();
            ctx.arc(0, 0, 48 + Math.sin(now / 80) * 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // ── Body ─────────────────────────────────────────────
        ctx.save();
        ctx.rotate(this.angle);
        ctx.globalAlpha = this._rushMode ? 0.85 : 0.70;
        const bodyColor0 = this._rushMode ? 'rgba(253,186,116,0.90)' : 'rgba(248,113,113,0.85)';
        const bodyColor1 = this._rushMode ? 'rgba(234,88,12,0.75)' : 'rgba(220,38,38,0.70)';
        const bodyColor2 = this._rushMode ? 'rgba(154,52,18,0.25)' : 'rgba(127,29,29,0.20)';
        const bodyG = ctx.createRadialGradient(-4, -3, 0, 0, 0, 20);
        bodyG.addColorStop(0, bodyColor0);
        bodyG.addColorStop(0.5, bodyColor1);
        bodyG.addColorStop(1, bodyColor2);
        ctx.fillStyle = bodyG;
        ctx.shadowBlur = this._rushMode ? 28 : 18;
        ctx.shadowColor = this._rushMode ? '#ea580c' : '#dc2626';
        ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Fists — alternates left/right each punch
        const fistExtend = (this._phaseTimer > 0) ? 34 : 24;
        const fistYOff = this._punchSide * 3; // slight vertical offset per side
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = this._phaseTimer > 0
            ? (this._rushMode ? '#fb923c' : '#facc15')
            : '#fb7185';
        ctx.shadowBlur = this._phaseTimer > 0 ? (this._rushMode ? 30 : 20) : 8;
        ctx.shadowColor = this._rushMode ? '#f97316' : '#f97316';
        ctx.beginPath(); ctx.ellipse(fistExtend, fistYOff, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
        // Knuckle lines
        ctx.strokeStyle = '#9f1239'; ctx.lineWidth = 1; ctx.shadowBlur = 0;
        for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.moveTo(fistExtend + 4, fistYOff - 3 + k * 4);
            ctx.lineTo(fistExtend + 10, fistYOff - 3 + k * 4);
            ctx.stroke();
        }
        // Impact flash
        if (this._phaseTimer > 0) {
            const flashT = this._phaseTimer / (this._rushMode ? 0.07 : 0.12);
            ctx.globalAlpha = flashT * (this._rushMode ? 0.9 : 0.6);
            ctx.fillStyle = this._rushMode ? '#fed7aa' : '#fef08a';
            ctx.shadowBlur = this._rushMode ? 36 : 24;
            ctx.shadowColor = this._rushMode ? '#f97316' : '#facc15';
            ctx.beginPath(); ctx.arc(fistExtend + 14, fistYOff, this._rushMode ? 14 : 9, 0, Math.PI * 2); ctx.fill();
            // Star burst lines (rush only)
            if (this._rushMode) {
                ctx.strokeStyle = '#fef9c3'; ctx.lineWidth = 2; ctx.shadowBlur = 12;
                for (let si = 0; si < 6; si++) {
                    const sa = (si / 6) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(fistExtend + 14, fistYOff);
                    ctx.lineTo(fistExtend + 14 + Math.cos(sa) * 20, fistYOff + Math.sin(sa) * 20);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();

        // ── Energy eyes ──────────────────────────────────────
        ctx.save();
        ctx.rotate(this.angle);
        const eyeGlow = (this._rushMode ? 0.9 : 0.7) + Math.sin(now / 120) * 0.3;
        ctx.globalAlpha = eyeGlow;
        ctx.fillStyle = this._rushMode ? '#fb923c' : '#fbbf24';
        ctx.shadowBlur = this._rushMode ? 18 : 12;
        ctx.shadowColor = this._rushMode ? '#ea580c' : '#f59e0b';
        ctx.beginPath(); ctx.ellipse(6, -6, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, 4, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.ellipse(7, -6, 1.5, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(7, 4, 1.5, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── ORA ORA text — escalates with combo ──────────────
        if (this._oraAlpha > 0 && this._oraLabel) {
            const oraScale = this._rushMode ? 1.3 : 1.0;
            const jx = (this._hitStopTimer > 0 ? 0 : (Math.sin(now / 18) * (this._rushMode ? 3 : 1)));
            const jy = (this._hitStopTimer > 0 ? 0 : (Math.cos(now / 15) * (this._rushMode ? 3 : 1)));
            ctx.save();
            ctx.translate(jx, -42 + jy);
            ctx.scale(oraScale, oraScale);
            ctx.globalAlpha = this._oraAlpha;
            ctx.font = `900 ${this._rushMode ? 18 : 15}px "Arial Black", Arial, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#000';
            ctx.strokeText(this._oraLabel, 0, 0);
            ctx.fillStyle = this._rushMode ? '#fed7aa' : '#facc15';
            ctx.shadowBlur = this._rushMode ? 20 : 10;
            ctx.shadowColor = this._rushMode ? '#f97316' : '#fbbf24';
            ctx.fillText(this._oraLabel, 0, 0);
            ctx.restore();
        }

        // ── Combo counter badge ────────────────────────────────
        if (this._comboCount >= 3) {
            const badgeAlpha = Math.min(1, this._comboTimer / 0.45);
            ctx.save();
            ctx.globalAlpha = badgeAlpha * 0.9;
            ctx.fillStyle = this._rushMode ? '#ea580c' : '#dc2626';
            ctx.shadowBlur = 10; ctx.shadowColor = this._rushMode ? '#f97316' : '#ef4444';
            ctx.beginPath(); ctx.arc(18, -28, 10, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = badgeAlpha;
            ctx.fillStyle = '#fff'; ctx.shadowBlur = 0;
            ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.min(this._comboCount, 99), 18, -28);
            ctx.restore();
        }

        // ── Name tag ─────────────────────────────────────────
        ctx.globalAlpha = 0.55 + Math.sin(now / 200) * 0.15;
        ctx.fillStyle = this._rushMode ? '#fed7aa' : '#fca5a5';
        ctx.font = 'bold 8px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('วันชัย', 0, -38);
        ctx.globalAlpha = 1;

        ctx.restore();
    }
}

'use strict';

// ════════════════════════════════════════════════════════════
// 🔥 AUTO PLAYER — Thermodynamic Brawler + Stand "Wanchai"
// ════════════════════════════════════════════════════════════
class AutoPlayer extends Player {
    constructor(x = 0, y = 0) {
        super('auto');
        this.x = x;
        this.y = y;

        this.charId = 'auto';

        this.wanchaiActive = false;
        this.wanchaiTimer = 0;

        this._punchTimer = 0;
        this._heatTimer = 0;

        // ── NEW: Stand Rush State ────────────────────────────────
        this.isStandAttacking = false;
        this.standAttackTimer = 0;
        this.lastPunchSoundTime = 0;

        this.cooldowns = { ...(this.cooldowns || {}), dash: this.cooldowns?.dash ?? 0, stealth: this.cooldowns?.stealth ?? 0, shoot: 0, wanchai: 0, vacuum: 0, detonation: 0 };

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
        const reduction = this.wanchaiActive ? (this.stats?.standDamageReduction ?? 0.5) : 0;
        const scaled = amt * (1 - reduction);
        super.takeDamage(scaled);
    }

    dealDamage(baseDamage) {
        // Temporarily boost baseCritChance during calculation if Stand is active
        const originalCrit = this.baseCritChance;
        if (this.wanchaiActive) {
            this.baseCritChance += (this.stats?.standCritBonus ?? 0.50);
        }

        const result = super.dealDamage(baseDamage);

        // Restore original crit for state safety
        this.baseCritChance = originalCrit;

        // ── Graph Buff: ยืนบนเลเซอร์ระยะ 3 → ดาเมจ x1.5 ──────
        if ((this.graphBuffTimer ?? 0) > 0) result.damage *= 1.5;

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

    update(dt, keys, mouse) {
        if (this.cooldowns?.wanchai > 0) this.cooldowns.wanchai -= dt;
        if (this.cooldowns?.shoot > 0) this.cooldowns.shoot -= dt;
        if (this.cooldowns?.vacuum > 0) this.cooldowns.vacuum -= dt;
        if (this.cooldowns?.detonation > 0) this.cooldowns.detonation -= dt;

        if (this.wanchaiActive) {
            this.wanchaiTimer -= dt;
            if (this.wanchaiTimer <= 0) {
                this.wanchaiActive = false;
                this.wanchaiTimer = 0;
                if (this.wanchaiStand) { this.wanchaiStand.active = false; this.wanchaiStand = null; }
            }
        }

        // ── Tick WanchaiStand each frame ──────────────────────
        if (this.wanchaiStand?.active) this.wanchaiStand.update(dt);

        if (checkInput('rightClick')) {
            const energyCost = this.stats?.wanchaiEnergyCost ?? 35;
            if (!this.wanchaiActive && (this.cooldowns?.wanchai ?? 0) <= 0 && (this.energy ?? 0) >= energyCost) {
                this.energy = Math.max(0, (this.energy ?? 0) - energyCost);
                this._activateWanchai();
                consumeInput('rightClick');
            }
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
        if (checkInput('q') && (this.cooldowns?.vacuum ?? 0) <= 0) {
            const VACUUM_RANGE = this.stats?.vacuumRange ?? 320;
            const VACUUM_FORCE = this.stats?.vacuumForce ?? 1400; // stronger impulse
            const STUN_DUR = this.stats?.vacuumStunDur ?? 0.55; // AI lock duration
            const PULL_DUR = this.stats?.vacuumPullDur ?? 0.45; // continuous pull
            const BURST_DMG = (this.stats?.wanchaiDamage ?? 32) * 2 * (this.damageMultiplier || 1.0);

            let pulled = 0;
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
                    pulled++;
                }
            }
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
            keys.q = 0;
            consumeInput('q');
        }

        // ── E: Overheat Detonation — ระเบิดสแตนด์ทิ้งปิดฉาก ─────
        // กด E ระหว่าง Wanchai active เท่านั้น
        // AOE 220px, ดาเมจสูง, แต่ Wanchai สิ้นสุดทันที
        if (checkInput('e') && this.wanchaiActive && (this.cooldowns?.detonation ?? 0) <= 0) {
            const DET_RANGE = this.stats?.detonationRange ?? 220;
            // ดาเมจ = wanchaiDamage × 6 (burst ทิ้ง 6 หมัดพร้อมกัน)
            const detBaseDmg = (this.stats?.wanchaiDamage ?? 32) * 6 * (this.damageMultiplier || 1.0);
            let detCrit = this.baseCritChance + (this.stats?.standCritBonus ?? 0.40);
            let detIsCrit = Math.random() < detCrit;
            let detFinalDmg = detBaseDmg * (detIsCrit ? (this.stats?.critMultiplier ?? 2.0) : 1.0);

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

            // ── บังคับปิด Wanchai + Stand ──
            this.wanchaiActive = false;
            this.wanchaiTimer = 0;
            if (this.wanchaiStand) { this.wanchaiStand.active = false; this.wanchaiStand = null; }
            this.cooldowns.detonation = this.stats?.detonationCooldown ?? 5; // short CD เพราะต้องเปิด Wanchai ก่อน

            spawnParticles(this.x, this.y, 60, '#dc2626');
            addScreenShake(10);
            spawnFloatingText(
                detIsCrit ? '💥 OVERHEAT CRIT!' : '💥 OVERHEAT!',
                this.x, this.y - 70,
                detIsCrit ? '#facc15' : '#dc2626', 28
            );
            if (typeof Audio !== 'undefined' && Audio.playDetonation) Audio.playDetonation();
            consumeInput('e');
        }



        // Reset attack state every frame; proven true below if mouse is held
        this.isStandAttacking = false;

        if (!mouse || mouse.left !== 1) return; if (typeof projectileManager === 'undefined' || !projectileManager) return;

        // ── Stand active: L-Click moves stand toward cursor (target assist) ──
        // WanchaiStand.update() handles autonomous punching.
        // Holding L-Click forces the stand to rush the cursor position.
        if (this.wanchaiActive) {
            this.isStandAttacking = !!(this.wanchaiStand?.active);
            if (this.wanchaiStand?.active && mouse) {
                // Direct stand toward mouse cursor (override autonomous target)
                this.wanchaiStand._forcedTargetX = mouse.wx;
                this.wanchaiStand._forcedTargetY = mouse.wy;
            }
            // Still fire heatwave while Wanchai is active (bonus DPS)
            const heatCd = this.stats?.heatWaveCooldown ?? 0.28;
            if ((this.cooldowns?.shoot ?? 0) <= 0) {
                this.cooldowns.shoot = heatCd;
                if (typeof projectileManager?.spawnHeatWave === 'function') {
                    projectileManager.spawnHeatWave(this, this.angle);
                }
                if (typeof Audio !== 'undefined' && Audio.playPunch) Audio.playPunch();
            }
            return;
        }

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

    // draw() ย้ายไป PlayerRenderer._drawAuto() แล้ว

}

// ════════════════════════════════════════════════════════════
// 🔥 AUTO PLAYER — Prototype Overrides
// ════════════════════════════════════════════════════════════
AutoPlayer.prototype.updateUI = function () {
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

    const levelEl = document.getElementById('player-level');
    if (levelEl) levelEl.textContent = `Lv.${this.level}`;
    const expBar = document.getElementById('exp-bar');
    if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;

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
};
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.AutoPlayer = AutoPlayer;