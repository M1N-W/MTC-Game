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
        const t = now / 1000;

        const isPunch = this._phaseTimer > 0;
        const flashT = isPunch ? Math.min(1, this._phaseTimer / 0.12) : 0;
        const side = this._punchSide ?? 1;       // +1 right fist active, -1 left
        const facingL = Math.abs(this.angle) > Math.PI / 2;
        const fs = facingL ? -1 : 1;           // facing scale — applied per-save

        // Shared oscillators — computed once, never inside draw sub-calls
        const breath = Math.sin(t * 2.6);          // slow body pulse
        const eyeFlick = Math.sin(t * 7.1);          // fast eye flicker
        const sway = Math.sin(t * 1.5) * 1.4;   // idle float

        // ── LAYER 0 : Ghost trail — humanoid silhouettes ─────────────────────
        for (let i = this.ghostTrail.length - 1; i >= 0; i--) {
            const g = this.ghostTrail[i];
            const ga = g.alpha * 0.25;
            if (ga < 0.02) continue;
            const gs = worldToScreen(g.x, g.y);
            ctx.save();
            ctx.globalAlpha = ga;
            ctx.shadowBlur = 8; ctx.shadowColor = '#dc2626';
            // head ghost
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(gs.x, gs.y - 20, 9, 0, Math.PI * 2); ctx.fill();
            // torso ghost
            ctx.beginPath();
            ctx.ellipse(gs.x, gs.y + 2, 10, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // ── LAYER 1 : Heat-distortion halo ───────────────────────────────────
        // Large oval — breathes, flares on punch
        {
            const hw = 22 + breath * 2;
            const hh = 36 + breath * 1.5;
            const ha = isPunch ? 0.22 + flashT * 0.18 : 0.10 + breath * 0.03;
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.3);
            const hG = ctx.createRadialGradient(0, 0, 2, 0, 0, hw + 8);
            hG.addColorStop(0, `rgba(249,115,22,${Math.min(1, ha * 1.9)})`);
            hG.addColorStop(0.45, `rgba(220,38,38,${ha})`);
            hG.addColorStop(1, 'rgba(30,0,0,0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = hG;
            ctx.shadowBlur = isPunch ? 28 : 14; ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.ellipse(0, 2, hw, hh * 0.58, 0, 0, Math.PI * 2); ctx.fill();
            // punch burst ring
            if (isPunch && flashT > 0.12) {
                ctx.globalAlpha = flashT * 0.50;
                ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
                ctx.shadowBlur = 18; ctx.shadowColor = '#fbbf24';
                ctx.beginPath(); ctx.arc(0, 0, 26 + (1 - flashT) * 12, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.restore();
        }

        // ── LAYER 2 : Lower-body / waist fade ────────────────────────────────
        // Stand has no legs — torso dissolves into heat shimmer below waist
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.4);
            const fadeG = ctx.createLinearGradient(0, 8, 0, 32);
            fadeG.addColorStop(0, 'rgba(127,29,29,0.80)');
            fadeG.addColorStop(0.55, 'rgba(90,10,10,0.38)');
            fadeG.addColorStop(1, 'rgba(40,0,0,0)');
            ctx.fillStyle = fadeG;
            ctx.globalAlpha = 0.88;
            ctx.beginPath();
            ctx.moveTo(-13, 8);
            ctx.quadraticCurveTo(-16, 24, 0, 32);
            ctx.quadraticCurveTo(16, 24, 13, 8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // ── LAYER 3 : Torso ───────────────────────────────────────────────────
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.4);
            ctx.scale(fs, 1);

            // Main torso shape — wider at shoulders, tapers to waist
            const tG = ctx.createRadialGradient(-3, -4, 1, 0, 4, 15);
            tG.addColorStop(0, '#9b1c1c');
            tG.addColorStop(0.55, '#7f1d1d');
            tG.addColorStop(1, '#450a0a');
            ctx.fillStyle = tG;
            ctx.globalAlpha = 0.92 + breath * 0.04;
            ctx.shadowBlur = isPunch ? 18 : 8; ctx.shadowColor = '#dc2626';
            ctx.beginPath();
            ctx.moveTo(-13, 0);
            ctx.quadraticCurveTo(-16, 10, -11, 20);
            ctx.lineTo(11, 20);
            ctx.quadraticCurveTo(16, 10, 13, 0);
            ctx.quadraticCurveTo(0, -4, -13, 0);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;

            // Armor plates clipped inside torso
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(-13, 0); ctx.quadraticCurveTo(-16, 10, -11, 20);
            ctx.lineTo(11, 20); ctx.quadraticCurveTo(16, 10, 13, 0);
            ctx.quadraticCurveTo(0, -4, -13, 0); ctx.closePath(); ctx.clip();
            ctx.fillStyle = 'rgba(153,27,27,0.50)';
            ctx.beginPath(); ctx.roundRect(-13, -2, 9, 13, 2); ctx.fill();  // L shoulder
            ctx.beginPath(); ctx.roundRect(4, -2, 9, 13, 2); ctx.fill();   // R shoulder
            ctx.strokeStyle = 'rgba(185,28,28,0.35)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 14); ctx.stroke(); // center seam
            // rivets
            ctx.fillStyle = 'rgba(251,146,60,0.45)';
            for (const [rx, ry] of [[-7, 2], [7, 2], [-7, 9], [7, 9]]) {
                ctx.beginPath(); ctx.arc(rx, ry, 1.1, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();

            // Hex power core on chest
            const cp = 0.5 + Math.sin(now / 160) * 0.45;
            const cr = 4;
            ctx.save(); ctx.translate(0, 12);
            ctx.beginPath();
            for (let hi = 0; hi < 6; hi++) {
                const ha = (hi / 6) * Math.PI * 2 - Math.PI / 6;
                hi === 0 ? ctx.moveTo(Math.cos(ha) * cr, Math.sin(ha) * cr)
                    : ctx.lineTo(Math.cos(ha) * cr, Math.sin(ha) * cr);
            }
            ctx.closePath();
            const cG2 = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
            cG2.addColorStop(0, `rgba(255,210,170,${Math.min(1, cp * 1.1)})`);
            cG2.addColorStop(0.5, `rgba(249,115,22,${Math.min(1, cp)})`);
            cG2.addColorStop(1, `rgba(153,27,27,${cp * 0.6})`);
            ctx.fillStyle = cG2;
            ctx.shadowBlur = 10 * cp; ctx.shadowColor = '#f97316';
            ctx.fill();
            ctx.strokeStyle = `rgba(251,146,60,${cp * 0.8})`; ctx.lineWidth = 0.8; ctx.stroke();
            ctx.fillStyle = `rgba(255,235,200,${cp * 0.9})`;
            ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            // Heat vents left side
            ctx.shadowBlur = 6 + eyeFlick * 3; ctx.shadowColor = '#fb923c';
            for (let vi = 0; vi < 3; vi++) {
                const va = 0.32 + vi * 0.12 + eyeFlick * 0.08;
                const vG = ctx.createLinearGradient(-13, 0, -9, 0);
                vG.addColorStop(0, `rgba(251,146,60,${va * 1.2})`);
                vG.addColorStop(1, `rgba(239,68,68,${va * 0.5})`);
                ctx.fillStyle = vG; ctx.globalAlpha = 0.78;
                ctx.beginPath(); ctx.roundRect(-13, 1 + vi * 4, 4, 2, 1); ctx.fill();
            }
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
            ctx.restore(); // end torso
        }

        // ── LAYER 4 : Arms & Fists ────────────────────────────────────────────
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.4);
            ctx.scale(fs, 1);

            // xDir: +1 = right arm, -1 = left arm (in facing-scaled space)
            const drawArm = (xDir, isActive) => {
                const sX = xDir * 12;       // shoulder attach X
                const sY = 2;               // shoulder attach Y (chest)
                const idleX = xDir * (14 + Math.sin(t * 2.1 + xDir) * 1.2);
                const idleY = 4 + Math.cos(t * 1.8 + xDir) * 1.5;
                const hitX = xDir * 30;
                const hitY = 0;
                const fX = isActive ? hitX : idleX;
                const fY = isActive ? hitY : idleY;

                // Upper arm
                ctx.strokeStyle = '#6b1010'; ctx.lineWidth = 5.5;
                ctx.lineCap = 'round';
                ctx.shadowBlur = isActive ? 12 : 3; ctx.shadowColor = '#dc2626';
                ctx.globalAlpha = 0.88;
                ctx.beginPath();
                ctx.moveTo(sX, sY);
                ctx.quadraticCurveTo(
                    sX + (fX - sX) * 0.45,
                    sY + (isActive ? -3 : 2),
                    fX, fY
                );
                ctx.stroke();

                // Fist
                const fR = isActive ? 7 : 6;
                const fBg = ctx.createRadialGradient(fX - 1.5, fY - 1.5, 0.5, fX, fY, fR);
                fBg.addColorStop(0, isActive ? '#fca5a5' : '#9b3a20');
                fBg.addColorStop(0.5, isActive ? '#ef4444' : '#7f1d1d');
                fBg.addColorStop(1, '#3a0808');
                ctx.fillStyle = fBg;
                ctx.strokeStyle = isActive ? 'rgba(249,115,22,0.65)' : 'rgba(50,8,8,0.7)';
                ctx.lineWidth = 1.1;
                ctx.shadowBlur = isActive ? 16 + flashT * 14 : 5;
                ctx.shadowColor = isActive ? '#f97316' : '#dc2626';
                ctx.globalAlpha = isActive ? 0.92 + flashT * 0.08 : 0.76;
                ctx.beginPath(); ctx.arc(fX, fY, fR, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();

                // Knuckle lines
                ctx.globalAlpha = isActive ? 0.50 : 0.25;
                ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.85;
                for (let k = 0; k < 3; k++) {
                    ctx.beginPath();
                    ctx.moveTo(fX - fR * 0.55, fY - fR * 0.25 + k * 1.9);
                    ctx.lineTo(fX + fR * 0.55, fY - fR * 0.25 + k * 1.9);
                    ctx.stroke();
                }

                // Impact burst on active fist
                if (isActive && flashT > 0.15) {
                    const bX = fX + xDir * 4;
                    ctx.globalAlpha = flashT * 0.82;
                    ctx.fillStyle = '#fef08a';
                    ctx.shadowBlur = 20; ctx.shadowColor = '#fbbf24';
                    ctx.beginPath(); ctx.arc(bX, fY, 5 + flashT * 5, 0, Math.PI * 2); ctx.fill();
                    // radial sparks
                    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 0.9;
                    for (let r = 0; r < 6; r++) {
                        const ra = (r / 6) * Math.PI * 2 + t * 4;
                        ctx.globalAlpha = flashT * 0.42;
                        ctx.beginPath();
                        ctx.moveTo(bX, fY);
                        ctx.lineTo(bX + Math.cos(ra) * 13, fY + Math.sin(ra) * 13);
                        ctx.stroke();
                    }
                }
                ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            };

            drawArm(1, isPunch && side > 0);  // right arm
            drawArm(-1, isPunch && side < 0);  // left arm
            ctx.restore();
        }

        // ── LAYER 5 : Head ────────────────────────────────────────────────────
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway);
            ctx.scale(fs, 1);

            const hy = -22 + breath * 0.7;   // head center Y, bobs with breath

            // Neck stub
            ctx.fillStyle = '#7f1d1d'; ctx.globalAlpha = 0.72;
            ctx.beginPath(); ctx.roundRect(-3.5, hy + 9, 7, 6, 1); ctx.fill();

            // Head base — skin tone matches Auto portrait
            const hG = ctx.createRadialGradient(-2.5, hy - 3, 1, 0, hy, 11);
            hG.addColorStop(0, '#cc7744');
            hG.addColorStop(0.6, '#a05828');
            hG.addColorStop(1, '#7a3810');
            ctx.fillStyle = hG;
            ctx.globalAlpha = 0.93;
            ctx.shadowBlur = isPunch ? 14 : 6; ctx.shadowColor = '#dc2626';
            ctx.beginPath(); ctx.arc(0, hy, 11, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // ── Buzzcut base cap ──
            ctx.fillStyle = '#1a0404'; ctx.globalAlpha = 0.86;
            ctx.beginPath(); ctx.arc(0, hy, 11, Math.PI, 0); ctx.closePath(); ctx.fill();

            // ── 3 forward-swept spikes — Auto's signature ──
            const spkBaseY = hy - 10;
            const spkData = [
                { bx: -3.5, lean: -3, h: 8 },   // left — shorter, leans left
                { bx: 0.5, lean: 2, h: 10 },   // center — tallest, forward lean
                { bx: 4.5, lean: 5, h: 7 },   // right — mid
            ];
            spkData.forEach(({ bx, lean, h }, idx) => {
                const wob = Math.sin(now / 340 + idx * 1.4) * 0.7;
                const tipX = bx + lean + wob;
                const tipY = spkBaseY - h - wob * 0.3;
                // flat dark base
                ctx.fillStyle = '#220606'; ctx.globalAlpha = 0.88;
                ctx.beginPath();
                ctx.moveTo(bx - 2.2, spkBaseY); ctx.lineTo(bx + 2.2, spkBaseY);
                ctx.lineTo(tipX, tipY); ctx.closePath(); ctx.fill();
                // gradient overlay base→tip
                const sg = ctx.createLinearGradient(bx, spkBaseY, tipX, tipY);
                sg.addColorStop(0, '#5c1010');
                sg.addColorStop(0.65, '#b91c1c');
                sg.addColorStop(1, '#f97316');
                ctx.fillStyle = sg; ctx.globalAlpha = 0.68;
                ctx.beginPath();
                ctx.moveTo(bx - 2.2, spkBaseY); ctx.lineTo(bx + 2.2, spkBaseY);
                ctx.lineTo(tipX, tipY); ctx.closePath(); ctx.fill();
                // ember tip glow
                const eA = 0.60 + Math.sin(now / 170 + idx) * 0.28;
                ctx.globalAlpha = Math.max(0, eA);
                ctx.fillStyle = '#f97316';
                ctx.shadowBlur = 9; ctx.shadowColor = '#f97316';
                ctx.beginPath(); ctx.arc(tipX, tipY, 1.5, 0, Math.PI * 2); ctx.fill();
                ctx.shadowBlur = 0;
            });
            ctx.globalAlpha = 1;

            // ── Thick furrowed brows ──
            ctx.strokeStyle = '#100202'; ctx.lineWidth = 3.0; ctx.lineCap = 'round';
            // left brow — slopes toward nose
            ctx.beginPath();
            ctx.moveTo(-9, hy - 3.5); ctx.quadraticCurveTo(-4, hy - 5.5, -1.5, hy - 4);
            ctx.stroke();
            // right brow
            ctx.beginPath();
            ctx.moveTo(1.5, hy - 4); ctx.quadraticCurveTo(4, hy - 5.5, 9, hy - 3.5);
            ctx.stroke();
            // inner crease
            ctx.lineWidth = 1.3; ctx.strokeStyle = '#200404';
            ctx.beginPath();
            ctx.moveTo(-2.5, hy - 3.8); ctx.lineTo(0, hy - 2.2); ctx.lineTo(2.5, hy - 3.8);
            ctx.stroke();

            // ── Eyes — narrow squint, fire-orange iris ──
            const eyeY = hy + 0.3;
            const eyeGA = 0.80 + eyeFlick * 0.20;

            // whites (narrow ellipses — squint)
            ctx.fillStyle = 'white'; ctx.globalAlpha = 0.82;
            ctx.beginPath(); ctx.ellipse(-4.2, eyeY, 3.5, 1.8, -0.12, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4.2, eyeY, 3.5, 1.8, 0.12, 0, Math.PI * 2); ctx.fill();

            // fire iris
            ctx.globalAlpha = eyeGA;
            ctx.shadowBlur = 10; ctx.shadowColor = '#f97316';
            const mkIris = (x, y) => {
                const ig = ctx.createRadialGradient(x - 0.7, y - 0.7, 0.4, x, y, 2.6);
                ig.addColorStop(0, '#ffe080');
                ig.addColorStop(0.5, '#f97316');
                ig.addColorStop(1, '#7c2d12');
                return ig;
            };
            ctx.fillStyle = mkIris(-4.2, eyeY);
            ctx.beginPath(); ctx.arc(-4.2, eyeY, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = mkIris(4.2, eyeY);
            ctx.beginPath(); ctx.arc(4.2, eyeY, 2.6, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            // narrow pupils
            ctx.fillStyle = '#040000'; ctx.globalAlpha = 1;
            ctx.beginPath(); ctx.ellipse(-4.2, eyeY, 0.9, 1.9, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4.2, eyeY, 0.9, 1.9, 0, 0, Math.PI * 2); ctx.fill();

            // eye shine
            ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.globalAlpha = 0.75;
            ctx.beginPath(); ctx.arc(-5.0, eyeY - 0.8, 0.8, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(3.4, eyeY - 0.8, 0.8, 0, Math.PI * 2); ctx.fill();

            // heavy upper lid (squint)
            ctx.strokeStyle = '#080000'; ctx.lineWidth = 2.0; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-7.6, eyeY - 1.6); ctx.quadraticCurveTo(-4.2, eyeY - 3.2, -0.8, eyeY - 1.6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0.8, eyeY - 1.6); ctx.quadraticCurveTo(4.2, eyeY - 3.2, 7.6, eyeY - 1.6); ctx.stroke();

            // ── Scar under left eye — Auto's battle damage ──
            ctx.strokeStyle = 'rgba(195,70,25,0.55)'; ctx.lineWidth = 0.95; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-7, eyeY + 2.0); ctx.lineTo(-5.2, eyeY + 4.5); ctx.stroke();

            // ── Tight-set mouth ──
            ctx.strokeStyle = '#7a3010'; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
            ctx.globalAlpha = 0.72;
            ctx.beginPath(); ctx.moveTo(-4, hy + 7); ctx.lineTo(4, hy + 7); ctx.stroke();
            // jaw tension lines
            ctx.strokeStyle = 'rgba(100,40,10,0.28)'; ctx.lineWidth = 0.65;
            ctx.beginPath(); ctx.moveTo(-6.5, hy + 3.5); ctx.lineTo(-6.5, hy + 6.5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(6.5, hy + 3.5); ctx.lineTo(6.5, hy + 6.5); ctx.stroke();

            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            ctx.restore(); // end head
        }

        // ── LAYER 6 : Name chip ───────────────────────────────────────────────
        {
            ctx.save();
            ctx.translate(sc.x, sc.y + sway * 0.2);
            const chipY = -46;
            const cA = 0.65 + Math.sin(t * 1.9) * 0.12;

            // UPGRADE: punch-flash halo ring behind chip
            if (isPunch && flashT > 0.1) {
                ctx.globalAlpha = flashT * 0.70;
                ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
                ctx.shadowBlur = 22; ctx.shadowColor = '#facc15';
                ctx.beginPath(); ctx.arc(0, chipY, 26 + (1 - flashT) * 10, 0, Math.PI * 2); ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // pill bg
            ctx.globalAlpha = cA * 0.70;
            ctx.fillStyle = 'rgba(25,2,2,0.72)';
            // UPGRADE: border flashes amber on punch
            ctx.strokeStyle = isPunch
                ? `rgba(251,191,36,${0.55 + flashT * 0.45})`
                : 'rgba(220,38,38,0.55)';
            ctx.lineWidth = isPunch ? 1.6 : 0.9;
            ctx.shadowBlur = isPunch ? 12 : 7;
            ctx.shadowColor = isPunch ? '#fbbf24' : '#dc2626';
            ctx.beginPath(); ctx.roundRect(-20, chipY - 5.5, 40, 11, 4);
            ctx.fill(); ctx.stroke();
            // label
            ctx.globalAlpha = cA;
            ctx.fillStyle = isPunch ? '#fef08a' : '#fca5a5';
            ctx.font = 'bold 7.5px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = isPunch ? 10 : 4;
            ctx.shadowColor = isPunch ? '#facc15' : '#ef4444';
            ctx.fillText('WANCHAI', 0, chipY);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            ctx.restore();
        }
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