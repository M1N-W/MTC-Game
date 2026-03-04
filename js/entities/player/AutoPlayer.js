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
        this._atkRate = S.wanchaiPunchRate ?? 0.08;
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
        let dmg = (S.wanchaiDamage ?? 32) * (owner.damageMultiplier || 1.0);

        // Second Wind bonus
        if (owner.isSecondWind) dmg *= (BALANCE?.player?.secondWindDamageMult || 1.5);

        // Crit
        let critChance = (owner.baseCritChance ?? 0.06) + (S.standCritBonus ?? 0.40);
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

        target.takeDamage(dmg, owner);

        // Lifesteal
        if (owner.passiveUnlocked) {
            owner.hp = Math.min(owner.maxHp, owner.hp + dmg * (S.passiveLifesteal ?? 0.02));
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
    }

    // SEARCH: (ใน AutoPlayer.js — ลบ draw() เดิมทั้งหมด แล้วแทนด้วย)
    // ── REPLACE lines 204–347 (draw method ของ WanchaiStand) ──

    draw(ctx) {
        if (!this.active || typeof ctx === 'undefined') return;
        const now = performance.now();
        const sc = worldToScreen(this.x, this.y);
        const isPunch = this._phaseTimer > 0;
        const flashT = isPunch ? Math.min(1, this._phaseTimer / 0.12) : 0;
        const side = this._punchSide ?? 1;
        const pulse = Math.sin(now / 180);
        const pulse2 = Math.sin(now / 110);

        // ── Ghost trail — wisps of shadow ──
        for (let i = this.ghostTrail.length - 1; i >= 0; i--) {
            const g = this.ghostTrail[i];
            const gs = worldToScreen(g.x, g.y);
            ctx.save();
            ctx.globalAlpha = g.alpha * 0.28;
            ctx.fillStyle = '#7c3aed';
            ctx.shadowBlur = 14; ctx.shadowColor = '#7c3aed';
            ctx.beginPath();
            ctx.ellipse(gs.x, gs.y, 9 - i * 1.0, 13 - i * 1.4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(sc.x, sc.y);

        // ── Outer aura ring — pulsing violet ──
        const ringR = 32 + pulse * 4;
        ctx.globalAlpha = 0.18 + (isPunch ? flashT * 0.30 : Math.abs(pulse) * 0.06);
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = isPunch ? 2.5 : 1.5;
        ctx.shadowBlur = isPunch ? 30 : 14;
        ctx.shadowColor = '#7c3aed';
        ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // ── Rotate to face target ──
        ctx.save();
        ctx.rotate(this.angle);

        // ── Shadow body — wispy humanoid silhouette ──
        // Body dissolves at the bottom (no legs, just smoke)

        // Smoke/mist lower body
        const mistAlpha = 0.38 + pulse * 0.06;
        for (let i = 0; i < 3; i++) {
            const my = 10 + i * 9;
            const mw = 14 - i * 3.5;
            ctx.globalAlpha = mistAlpha * (1 - i * 0.28);
            ctx.fillStyle = '#4c1d95';
            ctx.shadowBlur = 10 + i * 4;
            ctx.shadowColor = '#7c3aed';
            ctx.beginPath();
            ctx.ellipse(0, my, mw, 5 - i * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.shadowBlur = 0;

        // Torso — dark translucent wraith body
        ctx.globalAlpha = 0.72 + pulse * 0.06;
        const tG = ctx.createLinearGradient(0, -14, 0, 12);
        tG.addColorStop(0, '#6d28d9');
        tG.addColorStop(0.55, '#3b0764');
        tG.addColorStop(1, 'rgba(30,0,60,0)');
        ctx.fillStyle = tG;
        ctx.shadowBlur = isPunch ? 22 : 10;
        ctx.shadowColor = '#7c3aed';
        ctx.beginPath(); ctx.roundRect(-11, -14, 22, 28, 6); ctx.fill();
        ctx.shadowBlur = 0;

        // Soul tendrils — wisps floating off the body (precomputed via index)
        ctx.globalAlpha = 0.30 + pulse2 * 0.10;
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        const tendrilOffsets = [[-8, -8, -14, -18], [8, -6, 15, -16], [-5, 4, -12, -4], [6, 2, 13, -5]];
        for (const [x1, y1, x2, y2] of tendrilOffsets) {
            const wobble = Math.sin(now / 200 + x1) * 3;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo(x1 + wobble, (y1 + y2) / 2, x2 + wobble, y2);
            ctx.stroke();
        }

        // Head — shadowy orb
        ctx.globalAlpha = 0.85 + pulse2 * 0.08;
        const hG = ctx.createRadialGradient(-3, -24, 2, 0, -22, 11);
        hG.addColorStop(0, '#8b5cf6');
        hG.addColorStop(0.5, '#4c1d95');
        hG.addColorStop(1, '#1e0040');
        ctx.fillStyle = hG;
        ctx.shadowBlur = 14; ctx.shadowColor = '#7c3aed';
        ctx.beginPath(); ctx.arc(0, -22, 11, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Eyes — glowing soul fire
        const eg = 0.80 + pulse2 * 0.20;
        ctx.globalAlpha = eg;
        // Left eye
        ctx.fillStyle = '#c4b5fd';
        ctx.shadowBlur = 12; ctx.shadowColor = '#a78bfa';
        ctx.beginPath(); ctx.ellipse(-4, -22, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        // Right eye
        ctx.beginPath(); ctx.ellipse(4, -22, 3.5, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Pupils — deep void
        ctx.fillStyle = '#0f0020'; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(-3.8, -22, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(4.2, -22, 1.4, 0, Math.PI * 2); ctx.fill();

        // ── Ethereal Arms + Ghost Fists ──
        const extA = isPunch && side > 0 ? 40 : 24;
        const extB = isPunch && side < 0 ? 40 : 24;
        const yA = -4, yB = 5;

        // Arm helper — draw one ethereal arm
        const drawArm = (ext, y, active) => {
            // Arm wisp
            ctx.globalAlpha = active ? 0.90 : 0.55;
            ctx.strokeStyle = active ? '#c4b5fd' : '#7c3aed';
            ctx.lineWidth = active ? 4.5 : 3.5;
            ctx.lineCap = 'round';
            ctx.shadowBlur = active ? 16 : 6;
            ctx.shadowColor = '#7c3aed';
            ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(ext - 4, y); ctx.stroke();
            ctx.shadowBlur = 0;

            // Ghost fist — translucent orb
            ctx.globalAlpha = active ? 1.0 : 0.65;
            const fG = ctx.createRadialGradient(ext - 3, y, 1, ext, y, 10);
            fG.addColorStop(0, active ? '#ede9fe' : '#a78bfa');
            fG.addColorStop(0.5, active ? '#8b5cf6' : '#4c1d95');
            fG.addColorStop(1, 'rgba(76,29,149,0)');
            ctx.fillStyle = fG;
            ctx.shadowBlur = active ? 22 : 8;
            ctx.shadowColor = active ? '#c4b5fd' : '#7c3aed';
            ctx.beginPath(); ctx.ellipse(ext, y, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // Knuckle energy wisps
            ctx.globalAlpha = active ? 0.60 : 0.25;
            ctx.strokeStyle = '#ede9fe'; ctx.lineWidth = 0.8;
            for (let k = 0; k < 3; k++) {
                ctx.beginPath();
                ctx.moveTo(ext + 4, y - 3 + k * 3.2);
                ctx.lineTo(ext + 9, y - 3 + k * 3.2);
                ctx.stroke();
            }
        };

        drawArm(extA, yA, isPunch && side > 0);
        drawArm(extB, yB, isPunch && side < 0);

        // ── Impact flash — soul burst ──
        if (isPunch && flashT > 0.05) {
            const fy = side > 0 ? yA : yB;
            const fx = side > 0 ? extA : extB;
            ctx.globalAlpha = flashT * 0.80;
            ctx.fillStyle = '#ddd6fe';
            ctx.shadowBlur = 28; ctx.shadowColor = '#a78bfa';
            ctx.beginPath(); ctx.arc(fx + 12, fy, 10, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#ede9fe'; ctx.lineWidth = 1.2; ctx.shadowBlur = 10;
            for (let r = 0; r < 6; r++) {
                const ra = (r / 6) * Math.PI * 2;
                ctx.globalAlpha = flashT * 0.45;
                ctx.beginPath();
                ctx.moveTo(fx + 12, fy);
                ctx.lineTo(fx + 12 + Math.cos(ra) * 17, fy + Math.sin(ra) * 17);
                ctx.stroke();
            }
        }

        ctx.restore(); // end rotate

        // ── Name tag ──
        ctx.globalAlpha = 0.45 + Math.sin(now / 300) * 0.10;
        ctx.fillStyle = '#c4b5fd';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 8; ctx.shadowColor = '#7c3aed';
        ctx.fillText('WANCHAI', 0, -44);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
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

        // Decay player-owned rush fist overlay alpha
        if ((this._rushFistTimer ?? 0) > 0) {
            this._rushFistTimer -= dt;
            const _fade = Math.max(0, this._rushFistTimer / 0.10);
            if (this._rushFists) for (const f of this._rushFists) f.alpha = _fade;
        }

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
            // Miss swing VFX
            if (typeof spawnParticles === 'function') spawnParticles(cx, cy, 2, '#ef4444');
            if (typeof Audio !== 'undefined' && Audio.playPunch) Audio.playPunch();
            return;
        }

        // Must be within playerRushRange of the PLAYER (not just cursor)
        const distToPlayer = Math.hypot(target.x - this.x, target.y - this.y);
        if (distToPlayer > range + (target.radius ?? 14)) return;

        let dmg = (S.wanchaiDamage ?? 32) * (this.damageMultiplier || 1.0);
        let critChance = (this.baseCritChance ?? 0.06) + (S.standCritBonus ?? 0.40);
        if (this.passiveUnlocked) critChance += (S.passiveCritBonus ?? 0);
        const isCrit = Math.random() < critChance;
        if (isCrit) {
            dmg *= (S.critMultiplier ?? 2.0);
            if (this.passiveUnlocked) this.goldenAuraTimer = 1;
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.crits = (Achievements.stats.crits ?? 0) + 1;
                Achievements.check?.('crit_master');
            }
        }
        if (this.isSecondWind) dmg *= (BALANCE?.player?.secondWindDamageMult || 1.5);

        target.takeDamage(dmg, this);

        if (this.passiveUnlocked)
            this.hp = Math.min(this.maxHp, this.hp + dmg * (S.passiveLifesteal ?? 0.02));

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