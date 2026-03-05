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
        let critChance = (owner.baseCritChance ?? 0.06) + (S.standCritBonus ?? 0.25);  // BUG-5 fix: was 0.40
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
    }

    draw(ctx) {
        if (!this.active || typeof ctx === 'undefined') return;
        const now = performance.now();
        const sc = worldToScreen(this.x, this.y);
        const isPunch = this._phaseTimer > 0;
        const flashT = isPunch ? Math.min(1, this._phaseTimer / 0.12) : 0;
        const side = this._punchSide ?? 1;
        const t = now / 1000;

        // ── Ghost trail — fading fire blobs ──────────────────
        for (let i = this.ghostTrail.length - 1; i >= 0; i--) {
            const g = this.ghostTrail[i];
            const gs = worldToScreen(g.x, g.y);
            ctx.save();
            ctx.globalAlpha = g.alpha * 0.30;
            ctx.fillStyle = '#ef4444';
            ctx.shadowBlur = 18; ctx.shadowColor = '#dc2626';
            ctx.beginPath();
            ctx.arc(gs.x, gs.y, 14 - i * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        const rp = Math.sin(t * 3.2);
        const ep = Math.sin(t * 5.8);
        const fp = Math.sin(t * 2.1);
        const facingLeft = Math.abs(this.angle) > Math.PI / 2;

        // ── LAYER 1: rotated context — ring + chains + flash ──
        ctx.save();
        ctx.translate(sc.x, sc.y);
        ctx.rotate(this.angle);

        // Outer corona ring
        ctx.globalAlpha = 0.15 + (isPunch ? flashT * 0.40 : Math.abs(rp) * 0.07);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = isPunch ? 3 : 1.5;
        ctx.shadowBlur = isPunch ? 32 : 14;
        ctx.shadowColor = '#b91c1c';
        ctx.beginPath(); ctx.arc(0, 0, 30 + rp * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // Fire chains
        const extA = isPunch && side > 0 ? 44 : 26;
        const extB = isPunch && side < 0 ? 44 : 26;

        const drawChain = (ext, yOff, active) => {
            const nodes = 4;
            ctx.lineCap = 'round';
            for (let n = 0; n < nodes; n++) {
                const nx = 12 + (ext - 12) * (n / (nodes - 1));
                const ny = yOff + Math.sin(t * 4 + n * 1.2) * (active ? 1.5 : 2.5);
                const nr = active ? 3.5 - n * 0.3 : 2.8 - n * 0.25;
                ctx.globalAlpha = active ? 0.85 : 0.50;
                ctx.fillStyle = n === nodes - 1 ? (active ? '#fbbf24' : '#f87171') : '#dc2626';
                ctx.shadowBlur = active ? 14 : 6;
                ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.arc(nx, ny, Math.max(nr, 1.2), 0, Math.PI * 2); ctx.fill();
            }
            const bx = ext;
            const by = yOff + Math.sin(t * 4 + 3 * 1.2) * (active ? 1.5 : 2.5);
            const bScale = active ? 1.0 + flashT * 0.4 : 0.75;
            const bG = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, 9 * bScale);
            bG.addColorStop(0, '#fef08a');
            bG.addColorStop(0.4, active ? '#f97316' : '#dc2626');
            bG.addColorStop(1, 'rgba(185,28,28,0)');
            ctx.globalAlpha = active ? 1.0 : 0.65;
            ctx.fillStyle = bG;
            ctx.shadowBlur = active ? 24 : 10;
            ctx.shadowColor = active ? '#fbbf24' : '#ef4444';
            ctx.beginPath(); ctx.arc(bx, by, 9 * bScale, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        };

        drawChain(extA, -5, isPunch && side > 0);
        drawChain(extB, 5, isPunch && side < 0);

        // Impact flash (in rotated space — follows chain direction)
        if (isPunch && flashT > 0.05) {
            const fy = side > 0 ? -5 : 5;
            const fx = side > 0 ? extA : extB;
            ctx.globalAlpha = flashT * 0.90;
            ctx.fillStyle = '#fef08a';
            ctx.shadowBlur = 30; ctx.shadowColor = '#fbbf24';
            ctx.beginPath(); ctx.arc(fx, fy, 11, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff9c4'; ctx.lineWidth = 1.5; ctx.shadowBlur = 12;
            for (let r = 0; r < 8; r++) {
                const ra = (r / 8) * Math.PI * 2;
                ctx.globalAlpha = flashT * 0.50;
                ctx.beginPath();
                ctx.moveTo(fx, fy);
                ctx.lineTo(fx + Math.cos(ra) * 20, fy + Math.sin(ra) * 20);
                ctx.stroke();
            }
        }

        ctx.restore(); // end rotated layer

        // ── LAYER 2: mask — translate only, scaleX flip for facing ──
        // No rotation: mask stays upright, mirrors left/right only
        ctx.save();
        ctx.translate(sc.x, sc.y);
        if (facingLeft) ctx.scale(-1, 1);

        // Ember core
        const cG = ctx.createRadialGradient(-4, -4, 2, 0, 0, 18);
        cG.addColorStop(0, '#fca5a5');
        cG.addColorStop(0.35, '#dc2626');
        cG.addColorStop(0.7, '#7f1d1d');
        cG.addColorStop(1, 'rgba(30,0,0,0)');
        ctx.globalAlpha = 0.90 + fp * 0.06;
        ctx.fillStyle = cG;
        ctx.shadowBlur = isPunch ? 28 : 16;
        ctx.shadowColor = '#ef4444';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Brow ridges
        ctx.globalAlpha = 0.70;
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath(); ctx.roundRect(-9, -10, 7, 4, [2, 2, 0, 0]); ctx.fill();
        ctx.beginPath(); ctx.roundRect(2, -10, 7, 4, [2, 2, 0, 0]); ctx.fill();

        // Eyes
        const eyeGlow = 0.75 + ep * 0.25;
        ctx.globalAlpha = eyeGlow;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowBlur = 16; ctx.shadowColor = '#f59e0b';
        ctx.beginPath(); ctx.ellipse(-5, -4, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -4, 4.5, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000'; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(-5, -4, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(5, -4, 1.6, 0, Math.PI * 2); ctx.fill();

        // Nose
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#fca5a5';
        ctx.beginPath(); ctx.arc(-2.5, 1, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(2.5, 1, 1.5, 0, Math.PI * 2); ctx.fill();

        // Mouth + fangs
        ctx.globalAlpha = 0.65;
        ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 4, 6, 0.1, Math.PI - 0.1); ctx.stroke();
        ctx.fillStyle = '#fff8'; ctx.globalAlpha = 0.50;
        ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-1.5, 4); ctx.lineTo(0, 8); ctx.fill();
        ctx.beginPath(); ctx.moveTo(1, 8); ctx.lineTo(2.5, 4); ctx.lineTo(4, 8); ctx.fill();

        // Horns
        ctx.globalAlpha = 0.60; ctx.fillStyle = '#7f1d1d';
        ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(-5, -22); ctx.lineTo(-2, -14); ctx.fill();
        ctx.beginPath(); ctx.moveTo(2, -14); ctx.lineTo(5, -22); ctx.lineTo(8, -14); ctx.fill();

        ctx.restore(); // end mask layer

        // ── Name tag ─────────────────────────────────────────
        ctx.save();
        ctx.translate(sc.x, sc.y);
        ctx.globalAlpha = 0.45 + Math.sin(t * 2.2) * 0.10;
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 6; ctx.shadowColor = '#dc2626';
        ctx.fillText('WANCHAI', 0, -42);
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
        const reduction = this.wanchaiActive ? (this.stats?.standDamageReduction ?? 0.30) : 0;  // fix: was 0.5 ≠ config 0.30
        const scaled = amt * (1 - reduction);
        super.takeDamage(scaled);
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
            const energyCost = this.stats?.wanchaiEnergyCost ?? 32;  // fix: was 35 ≠ config 32
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
            let detCrit = this.baseCritChance + (this.stats?.standCritBonus ?? 0.25);  // BUG-5 fix: was 0.40
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

        // Stand Rush fires toward cursor — Stand teleports to target, no range gate
        // Direct the WanchaiStand to rush that target immediately
        if (this.wanchaiStand?.active) {
            this.wanchaiStand.x = target.x - Math.cos(this.angle) * 20;
            this.wanchaiStand.y = target.y - Math.sin(this.angle) * 20;
        }

        let dmg = (S.wanchaiDamage ?? 32) * (this.damageMultiplier || 1.0);
        let critChance = (this.baseCritChance ?? 0.06) + (S.standCritBonus ?? 0.25);  // BUG-5 fix: was 0.40
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

    // INC-4 fix: Q / E cooldown visuals (was missing entirely)
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
};
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.AutoPlayer = AutoPlayer;