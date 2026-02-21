'use strict';
/**
 * js/entities/boss.js
 *
 * ► BossDog — "DOG" — Summoned by Kru Manop in Phase 2.
 * Standalone aggressive melee chaser.
 *
 * ► Boss — "KRU MANOP THE DOG SUMMONER"
 * Phase 1 (normal ranged attacks)
 * Phase 2 (enraged + summons BossDog; fights continue ranged)
 * States: CHASE | ATTACK | ULTIMATE
 * Skills: equationSlam | deadlyGraph | log457 | bark (phase 2 only)
 *
 * Depends on: base.js  (Entity)
 * player.js (BarkWave)
 * game.js   (Gemini global mock — must be loaded before this file)
 *
 * ────────────────────────────────────────────────────────────────
 * REFACTOR NOTES (Phase 2 Dog Summon)
 * ────────────────────────────────────────────────────────────────
 * ✅ BossDog class — standalone melee entity; migrated dog drawing from Boss._drawDog().
 * Coordinates shifted by (-6, -28) so dog body is centred on entity origin.
 * ✅ Boss no longer uses isRider / dogLegTimer / _drawDog.
 * enablePhase2 flag (set by game.js based on encounter) controls Phase 2 activation.
 * Encounter 1 (Wave 3): enablePhase2=false → Phase 1 only.
 * Encounter 2+ (Wave 6, 9): enablePhase2=true → summons BossDog on HP threshold.
 * ✅ MOD EXPORTS — module.exports now lists { Boss, BossDog }.
 */

// ════════════════════════════════════════════════════════════
// 🐕 BOSS DOG — "DOG" (Summoned Standalone Melee Unit)
// ════════════════════════════════════════════════════════════
class BossDog extends Entity {
    constructor(x, y) {
        const cfg = BALANCE.boss.bossDog;
        super(x, y, cfg.radius);
        this.maxHp     = cfg.hp;
        this.hp        = cfg.hp;
        this.moveSpeed = cfg.speed;
        this.damage    = cfg.damage;
        this.legTimer  = 0;
        this.isEnraged = false; // visually enraged from birth
        this.name      = 'DOG';
    }

    update(dt, player) {
        if (this.dead) return;

        this.legTimer += dt * 2.5;

        // Strict aggressive chase
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d  = Math.hypot(dx, dy);
        if (d > 0) {
            this.angle = Math.atan2(dy, dx);
            this.vx = (dx / d) * this.moveSpeed;
            this.vy = (dy / d) * this.moveSpeed;
        }
        this.applyPhysics(dt);

        // Melee contact damage
        if (d < this.radius + player.radius) {
            player.takeDamage(this.damage * dt);
        }

        if (this.hp <= 0 && !this.dead) {
            this.dead = true;
            spawnParticles(this.x, this.y, 25, BALANCE.boss.bossDog.color);
            spawnFloatingText('Go Get EM! 🐕', this.x, this.y - 40, '#d97706', 26);
            addScore(Math.round(BALANCE.score.boss * 0.15));
        }
    }

    takeDamage(amt) {
        this.hp -= amt;
        spawnParticles(this.x, this.y, 3, '#d97706');
    }

    draw() {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  BOSS DOG — Robotic Combat Hound                        ║
        // ║  Wide metallic bean · Spiked collar · 4 floating paws   ║
        // ╚══════════════════════════════════════════════════════════╝
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const now    = Date.now();
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        // ── HP bar (level) ────────────────────────────────────────────
        {
            const barW = 60, barH = 6, pct = Math.max(0, this.hp / this.maxHp);
            CTX.save();
            CTX.fillStyle = 'rgba(0,0,0,0.55)';
            CTX.fillRect(screen.x - barW / 2, screen.y - 46, barW, barH);
            CTX.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
            CTX.fillRect(screen.x - barW / 2, screen.y - 46, barW * pct, barH);
            CTX.restore();
        }

        // ── Ground shadow ─────────────────────────────────────────────
        CTX.save();
        CTX.globalAlpha = 0.28;
        CTX.fillStyle   = 'rgba(0,0,0,0.9)';
        CTX.beginPath(); CTX.ellipse(screen.x, screen.y + 20, 32, 7, 0, 0, Math.PI * 2); CTX.fill();
        CTX.restore();

        // ── Body Block (Body Anti-Flip logic) ─────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        if (isFacingLeft) CTX.scale(-1, 1);

        // Heavy breathing — power unit
        const breathe = Math.sin(now / 230);
        CTX.scale(1 + breathe * 0.022, 1 - breathe * 0.022);

        const R = this.radius;

        // ── Four floating robotic paws (cycling with legTimer) ────────
        // Paws bob up/down in alternating pairs like a trotting dog
        const legCycle   = this.legTimer;
        const pawR       = R * 0.32;
        const pawOffsets = [
            { ox: R * 0.55,  oy:  R * 0.75, phase: 0     },  // front-right
            { ox: -R * 0.55, oy:  R * 0.75, phase: Math.PI }, // back-right
            { ox: R * 0.55,  oy: -R * 0.75, phase: Math.PI }, // front-left
            { ox: -R * 0.55, oy: -R * 0.75, phase: 0     },  // back-left
        ];
        for (const pw of pawOffsets) {
            const bob = Math.sin(legCycle * 9 + pw.phase) * 5;
            const px  = pw.ox;
            const py  = pw.oy + bob;

            // Robotic paw — small rounded rectangle + claws
            CTX.fillStyle   = '#374151'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
            CTX.shadowBlur  = 4; CTX.shadowColor = 'rgba(220,38,38,0.4)';
            CTX.beginPath(); CTX.roundRect(px - pawR, py - pawR * 0.7, pawR * 2, pawR * 1.4, pawR * 0.4); CTX.fill(); CTX.stroke();
            // Two tiny claw spikes
            CTX.fillStyle = '#1e293b';
            for (let ci = -1; ci <= 1; ci += 2) {
                CTX.beginPath();
                CTX.moveTo(px + ci * pawR * 0.4, py + pawR * 0.7);
                CTX.lineTo(px + ci * pawR * 0.6, py + pawR * 1.3);
                CTX.lineTo(px + ci * pawR * 0.2, py + pawR * 0.7);
                CTX.closePath(); CTX.fill();
            }
            CTX.shadowBlur = 0;
        }

        // ── Main bean body — wide horizontal metallic dark ────────────
        // Horizontal bean: wider X than Y
        CTX.save(); CTX.scale(1.5, 0.90);
        const bodyG = CTX.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
        bodyG.addColorStop(0,   '#374151');
        bodyG.addColorStop(0.55, '#1f2937');
        bodyG.addColorStop(1,   '#111827');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();
        CTX.restore(); // end wide scale

        // Metallic specular stripe
        CTX.fillStyle = 'rgba(255,255,255,0.08)';
        CTX.beginPath(); CTX.ellipse(-R * 0.1, -R * 0.25, R * 0.55, R * 0.20, 0, 0, Math.PI * 2); CTX.fill();

        // ── Spiked collar — ring of sharp triangles around neck area ──
        const collarR = R * 0.68;
        const spikeCount = 8;
        CTX.fillStyle   = '#4b5563'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.5;
        // Collar band
        CTX.beginPath(); CTX.arc(0, 0, collarR + 2, -Math.PI * 0.5 - 0.7, Math.PI * 0.5 + 0.7);
        CTX.lineWidth = 6; CTX.strokeStyle = '#374151'; CTX.stroke();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.5;
        // Collar spikes
        for (let i = 0; i < spikeCount; i++) {
            const sa = -Math.PI * 0.55 + (i / (spikeCount - 1)) * Math.PI * 1.1;
            const sInner = collarR - 2;
            const sOuter = collarR + 6;
            const sx = Math.cos(sa);
            const sy = Math.sin(sa);
            CTX.fillStyle = i % 2 === 0 ? '#6b7280' : '#4b5563';
            CTX.beginPath();
            CTX.moveTo(sx * sInner + Math.cos(sa - 0.15) * 0, sy * sInner + Math.sin(sa - 0.15) * 0);
            CTX.lineTo(Math.cos(sa - 0.18) * sInner, Math.sin(sa - 0.18) * sInner);
            CTX.lineTo(sx * sOuter, sy * sOuter);
            CTX.lineTo(Math.cos(sa + 0.18) * sInner, Math.sin(sa + 0.18) * sInner);
            CTX.closePath(); CTX.fill(); CTX.stroke();
        }

        // ── Red angular visor eyes (two connected horizontal slits) ───
        const visorA = 0.8 + Math.sin(now / 180) * 0.20;
        CTX.fillStyle  = `rgba(220,38,38,${visorA})`;
        CTX.shadowBlur = 14 * visorA; CTX.shadowColor = '#ef4444';
        // Angular visor left slit
        CTX.beginPath();
        CTX.moveTo(R * 0.28, -R * 0.25);
        CTX.lineTo(R * 0.72, -R * 0.15);
        CTX.lineTo(R * 0.68,  R * 0.05);
        CTX.lineTo(R * 0.24,  R * 0.10);
        CTX.closePath(); CTX.fill();
        // Angular visor right slit (mirrored slightly)
        CTX.beginPath();
        CTX.moveTo(R * 0.28,  R * 0.22);
        CTX.lineTo(R * 0.72,  R * 0.14);
        CTX.lineTo(R * 0.70,  R * 0.38);
        CTX.lineTo(R * 0.26,  R * 0.42);
        CTX.closePath(); CTX.fill();
        // Visor glow bleed
        CTX.fillStyle = `rgba(220,38,38,${visorA * 0.15})`;
        CTX.beginPath(); CTX.arc(R * 0.52, R * 0.1, R * 0.35, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0;

        // ── Back tail (angular robotic fin) ───────────────────────────
        CTX.fillStyle   = '#374151'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        const tailWag = Math.sin(now / 90) * 8;
        CTX.beginPath();
        CTX.moveTo(-R * 1.4, -R * 0.2);
        CTX.lineTo(-R * 2.0, -R * 0.6 + tailWag * 0.05);
        CTX.lineTo(-R * 2.1,  R * 0.2 + tailWag * 0.08);
        CTX.lineTo(-R * 1.4,  R * 0.2);
        CTX.closePath(); CTX.fill(); CTX.stroke();

        // ── Heat vent dots on body ────────────────────────────────────
        const ventA = 0.4 + Math.sin(now / 190) * 0.35;
        CTX.fillStyle = `rgba(251,146,60,${ventA})`;
        CTX.shadowBlur = 6; CTX.shadowColor = '#fb923c';
        for (let vi = 0; vi < 3; vi++) {
            CTX.beginPath(); CTX.arc(-R * 0.15 + vi * R * 0.18, R * 0.55, 2.5, 0, Math.PI * 2); CTX.fill();
        }
        CTX.shadowBlur = 0;

        CTX.restore(); // end body transform
    }

    _drawDogBody() {
        // Colours — always enraged-looking since it's a combat summon
        const bodyCol  = '#dc2626';
        const darkCol  = '#991b1b';
        const lightCol = '#ef4444';
        const eyeCol   = '#facc15';

        const legSpeed = 9;
        const swingAmt = 0.45;
        const swingA   =  Math.sin(this.legTimer * legSpeed) * swingAmt;
        const swingB   = -swingA;
        const LEG_LEN  = 20, PAW_RY = 4;

        // Shadow
        CTX.save(); CTX.globalAlpha = 0.22; CTX.fillStyle = 'rgba(0,0,0,0.9)';
        CTX.beginPath(); CTX.ellipse(6, 62, 44, 10, 0, 0, Math.PI * 2); CTX.fill(); CTX.restore();

        const drawLeg = (pivotX, pivotY, swingAngle, pawTiltSign) => {
            CTX.save(); CTX.translate(pivotX, pivotY); CTX.rotate(swingAngle);
            CTX.strokeStyle = darkCol; CTX.lineWidth = 7; CTX.lineCap = 'round';
            CTX.beginPath(); CTX.moveTo(0, 0); CTX.lineTo(0, LEG_LEN); CTX.stroke();
            CTX.fillStyle = darkCol; CTX.beginPath(); CTX.arc(0, LEG_LEN, 3.5, 0, Math.PI * 2); CTX.fill();
            CTX.strokeStyle = darkCol; CTX.lineWidth = 5;
            CTX.beginPath(); CTX.moveTo(0, LEG_LEN); CTX.lineTo(pawTiltSign * 3, LEG_LEN + 11); CTX.stroke();
            CTX.fillStyle = darkCol;
            CTX.beginPath(); CTX.ellipse(pawTiltSign * 3, LEG_LEN + 13, 6, PAW_RY, pawTiltSign * 0.25, 0, Math.PI * 2); CTX.fill();
            CTX.restore();
        };
        drawLeg( 14, 36,  swingA, -1); drawLeg( 26, 36,  swingB, 1);
        drawLeg(-14, 36,  swingB, -1); drawLeg( -2, 36,  swingA, 1);

        // Body
        CTX.fillStyle = bodyCol; CTX.strokeStyle = darkCol; CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.ellipse(6, 28, 44, 18, 0, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.fillStyle = lightCol;
        CTX.beginPath(); CTX.ellipse(0, 20, 22, 10, 0, 0, Math.PI * 2); CTX.fill();

        // Tail
        const tailWag = Math.sin(this.legTimer * 12) * 18;
        CTX.strokeStyle = darkCol; CTX.lineWidth = 6; CTX.lineCap = 'round';
        CTX.beginPath(); CTX.moveTo(-44, 22);
        CTX.quadraticCurveTo(-58, 8, -55 + tailWag * 0.35, -6 + tailWag); CTX.stroke();
        CTX.fillStyle = bodyCol;
        CTX.beginPath(); CTX.arc(-55 + tailWag * 0.35, -7 + tailWag, 7, 0, Math.PI * 2); CTX.fill();

        // Head
        CTX.fillStyle = bodyCol; CTX.strokeStyle = darkCol; CTX.lineWidth = 2.5;
        CTX.beginPath(); CTX.arc(52, 20, 18, 0, Math.PI * 2); CTX.fill(); CTX.stroke();

        // Ear
        CTX.fillStyle = darkCol; CTX.strokeStyle = darkCol; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.ellipse(44, 8, 9, 15, -0.5, 0, Math.PI * 2); CTX.fill();

        // Snout
        CTX.fillStyle = lightCol; CTX.strokeStyle = darkCol; CTX.lineWidth = 1.5;
        CTX.beginPath(); CTX.ellipse(64, 23, 12, 8, 0.2, 0, Math.PI * 2); CTX.fill(); CTX.stroke();

        // Nose
        CTX.fillStyle = '#1e293b';
        CTX.beginPath(); CTX.arc(71, 20, 3.5, 0, Math.PI * 2); CTX.fill();

        // Eye (enraged glow)
        CTX.fillStyle = eyeCol; CTX.shadowBlur = 8; CTX.shadowColor = '#facc15';
        CTX.beginPath(); CTX.arc(56, 13, 4, 0, Math.PI * 2); CTX.fill();
        CTX.shadowBlur = 0; CTX.fillStyle = '#1e293b';
        CTX.beginPath(); CTX.arc(57, 13, 2, 0, Math.PI * 2); CTX.fill();

        // Mouth
        CTX.strokeStyle = darkCol; CTX.lineWidth = 2; CTX.lineCap = 'round';
        CTX.beginPath(); CTX.arc(63, 24, 5, 0.1, Math.PI - 0.1); CTX.stroke();

        // Tongue
        CTX.fillStyle = '#fb7185';
        CTX.beginPath(); CTX.ellipse(63, 32, 5, 7, 0, 0, Math.PI * 2); CTX.fill();

        // Enrage fire particles
        const t = performance.now() / 120;
        CTX.save();
        for (let i = 0; i < 5; i++) {
            const ex = Math.sin(t * 0.7 + i * 1.26) * 36;
            const ey = Math.cos(t * 0.9 + i * 1.26) * 16 + 28;
            const er = 3 + Math.sin(t * 1.5 + i) * 1.5;
            CTX.globalAlpha = 0.5 + Math.sin(t + i) * 0.3;
            CTX.fillStyle   = i % 2 === 0 ? '#ef4444' : '#f97316';
            CTX.shadowBlur  = 10; CTX.shadowColor = '#ef4444';
            CTX.beginPath(); CTX.arc(ex, ey, er, 0, Math.PI * 2); CTX.fill();
        }
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 👑 BOSS — "KRU MANOP THE DOG SUMMONER"
// ════════════════════════════════════════════════════════════
class Boss extends Entity {
    /**
     * @param {number}  difficulty  - HP/score multiplier (bossLevel from game.js)
     * @param {boolean} enablePhase2 - true from encounter 2 onward; enables dog summon
     * @param {boolean} enablePhase3 - true on encounter 3 (Wave 9); enables Goldfish Lover
     */
    constructor(difficulty = 1, enablePhase2 = false, enablePhase3 = false) {
        super(0, BALANCE.boss.spawnY, BALANCE.boss.radius);
        this.maxHp        = BALANCE.boss.baseHp * difficulty;
        this.hp           = this.maxHp;
        this.name         = 'KRU MANOP';
        this.state        = 'CHASE';
        this.timer        = 0;
        this.moveSpeed    = BALANCE.boss.moveSpeed;
        this.difficulty   = difficulty;
        this.phase        = 1;
        this.sayTimer     = 0;
        this.enablePhase2 = enablePhase2;
        this.enablePhase3 = enablePhase3;
        this.dogSummoned  = false;

        this.skills = {
            slam:     { cd: 0, max: BALANCE.boss.slamCooldown  },
            graph:    { cd: 0, max: BALANCE.boss.graphCooldown  },
            log:      { cd: 0, max: BALANCE.boss.log457Cooldown },
            bark:     { cd: 0, max: BALANCE.boss.phase2.barkCooldown },
            goldfish: { cd: 0, max: BALANCE.boss.phase3.goldfishCooldown },
            bubble:   { cd: 0, max: BALANCE.boss.phase3.bubbleCooldown  }
        };

        this.log457State       = null;
        this.log457Timer       = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable    = false;
        this.isEnraged         = false;
        // BUG-4: lock flag prevents double startNextWave() from rapid damage hits
        this._waveSpawnLocked  = false;
    }

    update(dt, player) {
        if (this.dead) return;
        const dx = player.x - this.x, dy = player.y - this.y;
        const d  = dist(this.x, this.y, player.x, player.y);
        this.angle    = Math.atan2(dy, dx);
        this.timer   += dt;
        this.sayTimer += dt;

        for (let s in this.skills) if (this.skills[s].cd > 0) this.skills[s].cd -= dt;

        if (this.sayTimer > BALANCE.boss.speechInterval && Math.random() < 0.1) {
            this.speak('Player at ' + Math.round(player.hp) + ' HP');
            this.sayTimer = 0;
        }

        // ── Phase 2 transition ───────────────────────────────
        if (this.hp < this.maxHp * BALANCE.boss.phase2Threshold && this.phase === 1 && this.enablePhase2) {
            this.phase     = 2;
            this.isEnraged = true;
            this.moveSpeed = BALANCE.boss.moveSpeed * BALANCE.boss.phase2.enrageSpeedMult;
            spawnFloatingText('ENRAGED!', this.x, this.y - 80, '#ef4444', 40);
            addScreenShake(20);
            spawnParticles(this.x, this.y, 35, '#ef4444');
            spawnParticles(this.x, this.y, 20, '#d97706');

            // Summon Dog as a standalone enemy
            if (!this.dogSummoned) {
                this.dogSummoned = true;
                if (Array.isArray(window.enemies)) {
                    window.enemies.push(new BossDog(this.x, this.y));
                }
                spawnFloatingText('🐕 GO GET \'EM!', this.x, this.y - 120, '#d97706', 32);
            }

            this.speak('You think you can stop me?!');
            Audio.playBossSpecial();
        }

        // ── Phase 3 transition — "The Goldfish Lover" ────────
        if (this.hp < this.maxHp * BALANCE.boss.phase3Threshold && this.phase === 2 && this.enablePhase3) {
            this.phase = 3;
            this.skills.goldfish.cd = 0;
            this.skills.bubble.cd   = 0;
            spawnFloatingText('🐟 THE GOLDFISH LOVER!', this.x, this.y - 100, '#38bdf8', 42);
            spawnFloatingText('🫧 BUBBLE PRISON!',      this.x, this.y - 145, '#7dd3fc', 30);
            addScreenShake(30);
            spawnParticles(this.x, this.y, 50, '#38bdf8');
            spawnParticles(this.x, this.y, 30, '#fb923c');
            this.speak('My goldfish... AVENGE THEM!');
            Audio.playBossSpecial();
        }

        // ── Phase 3 attacks ──────────────────────────────────
        if (this.phase === 3) {
            const P3  = BALANCE.boss.phase3;

            // Summon goldfish swarm
            if (this.skills.goldfish.cd <= 0) {
                this.skills.goldfish.cd = P3.goldfishCooldown;
                for (let i = 0; i < P3.goldfishCount; i++) {
                    const spawnAngle = this.angle + (i - 1) * 0.5;
                    const sx = this.x + Math.cos(spawnAngle) * 60;
                    const sy = this.y + Math.sin(spawnAngle) * 60;
                    if (Array.isArray(window.enemies)) {
                        window.enemies.push(new GoldfishMinion(sx, sy));
                    }
                }
                spawnFloatingText('🐟 GOLDFISH SWARM!', this.x, this.y - 90, '#fb923c', 28);
                spawnParticles(this.x, this.y, 15, '#fb923c');
                this.speak('Go, my babies!');
                Audio.playBossSpecial();
            }

            // Fire bubble volley
            if (this.skills.bubble.cd <= 0) {
                this.skills.bubble.cd = P3.bubbleCooldown;
                const spread = 0.35;
                const half   = Math.floor(P3.bubbleCount / 2);
                for (let i = -half; i <= half; i++) {
                    const a = this.angle + i * spread;
                    window.specialEffects.push(new BubbleProjectile(this.x, this.y, a));
                }
                spawnFloatingText('🫧 BUBBLE PRISON!', this.x, this.y - 90, '#38bdf8', 28);
                this.speak('You cannot escape my bubbles!');
                Audio.playBossSpecial();
            }
        }

        // ── log457 state machine ─────────────────────────────
        if (this.log457State === 'charging') {
            this.log457Timer += dt; this.isInvulnerable = true;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * BALANCE.boss.log457HealRate * dt);
            if (this.log457Timer >= BALANCE.boss.log457ChargeDuration) {
                this.log457State = 'active'; this.log457Timer = 0;
                this.log457AttackBonus = BALANCE.boss.log457AttackBonus;
                this.isInvulnerable = false;
                addScreenShake(20); spawnFloatingText('67! 67! 67!', this.x, this.y - 80, '#facc15', 35);
                this.speak('0.6767!');
            }
        } else if (this.log457State === 'active') {
            this.log457Timer += dt;
            this.log457AttackBonus += BALANCE.boss.log457AttackGrowth * dt;
            if (this.log457Timer >= BALANCE.boss.log457ActiveDuration) {
                this.log457State = 'stunned'; this.log457Timer = 0;
                this.vx = 0; this.vy = 0;
                spawnFloatingText('STUNNED!', this.x, this.y - 60, '#94a3b8', 30);
            }
        } else if (this.log457State === 'stunned') {
            this.log457Timer += dt; this.vx = 0; this.vy = 0;
            if (this.log457Timer >= BALANCE.boss.log457StunDuration) {
                this.log457State = null; this.log457AttackBonus = 0;
            }
            return;
        }

        // ── State machine ────────────────────────────────────
        if (this.state === 'CHASE') {
            if (!player.isInvisible) { this.vx = Math.cos(this.angle) * this.moveSpeed; this.vy = Math.sin(this.angle) * this.moveSpeed; }
            else { this.vx *= 0.95; this.vy *= 0.95; }
            this.applyPhysics(dt);

            if (this.timer > 2) {
                this.timer = 0;
                const barkChance = this.phase === 2 ? 0.40 : 0;
                if      (this.skills.log.cd <= 0  && Math.random() < 0.20) this.useLog457();
                else if (this.skills.graph.cd <= 0 && Math.random() < 0.25) this.useDeadlyGraph(player);
                else if (this.phase === 2 && this.skills.bark.cd <= 0 && Math.random() < barkChance) this.bark(player);
                else if (this.skills.slam.cd <= 0  && Math.random() < 0.30) this.useEquationSlam();
                else this.state = Math.random() < 0.3 ? 'ULTIMATE' : 'ATTACK';
            }
        } else if (this.state === 'ATTACK') {
            this.vx *= 0.9; this.vy *= 0.9;
            const fr = this.phase === 2 ? BALANCE.boss.phase2AttackFireRate : BALANCE.boss.attackFireRate;
            const bf = fr / (1 + this.log457AttackBonus);
            if (this.timer > bf) {
                projectileManager.add(new Projectile(this.x, this.y, this.angle, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                if (this.phase === 2) {
                    projectileManager.add(new Projectile(this.x, this.y, this.angle + 0.3, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                    projectileManager.add(new Projectile(this.x, this.y, this.angle - 0.3, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                }
                this.timer = 0;
                if (Math.random() < 0.08) this.state = 'CHASE';
            }
        } else if (this.state === 'ULTIMATE') {
            this.vx = 0; this.vy = 0;
            if (this.timer > 1) {
                const bullets = this.phase === 2 ? BALANCE.boss.phase2UltimateBullets : BALANCE.boss.ultimateBullets;
                for (let i = 0; i < bullets; i++) {
                    const a = (Math.PI * 2 / bullets) * i;
                    projectileManager.add(new Projectile(this.x, this.y, a, BALANCE.boss.ultimateProjectileSpeed, BALANCE.boss.ultimateDamage, '#ef4444', true, 'enemy'));
                }
                addScreenShake(15);
                spawnFloatingText('POP QUIZ!', this.x, this.y - 80, '#facc15', 40);
                Audio.playBossSpecial();
                this.state = 'CHASE'; this.timer = -1;
            }
        }

        if (d < this.radius + player.radius)
            player.takeDamage(BALANCE.boss.contactDamage * dt * (1 + this.log457AttackBonus));

        if (window.UIManager) {
            window.UIManager.updateBossHUD(this);
            window.UIManager.updateBossSpeech(this);
        }
    }

    bark(player) {
        const P2 = BALANCE.boss.phase2;
        this.skills.bark.cd = this.skills.bark.max;
        this.state = 'CHASE';
        const barkAngle = Math.atan2(player.y - this.y, player.x - this.x);
        const coneHalf  = Math.PI / 3.5;
        window.specialEffects.push(new BarkWave(this.x, this.y, barkAngle, coneHalf, P2.barkRange));
        const dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < P2.barkRange) {
            const playerAngle = Math.atan2(dy, dx);
            let diff = playerAngle - barkAngle;
            while (diff >  Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            if (Math.abs(diff) < coneHalf) {
                player.takeDamage(P2.barkDamage);
                const pushMag = 480;
                player.vx += (dx / d) * pushMag; player.vy += (dy / d) * pushMag;
                spawnFloatingText('BARK! 🐕', player.x, player.y - 55, '#f59e0b', 26);
                addScreenShake(10);
            }
        }
        spawnFloatingText('WOOF WOOF!', this.x, this.y - 100, '#d97706', 30);
        spawnParticles(this.x, this.y, 12, '#d97706');
        Audio.playBossSpecial();
        this.speak('BARK BARK BARK!');
    }

    useEquationSlam() {
        this.skills.slam.cd = this.skills.slam.max; this.state = 'CHASE';
        addScreenShake(15);
        spawnFloatingText('EQUATION SLAM!', this.x, this.y - 80, '#facc15', 30);
        this.speak('Equation Slam!'); Audio.playBossSpecial();
        window.specialEffects.push(new EquationSlam(this.x, this.y));
    }

    useDeadlyGraph(player) {
        this.skills.graph.cd = this.skills.graph.max; this.state = 'CHASE';
        spawnFloatingText('DEADLY GRAPH!', this.x, this.y - 80, '#3b82f6', 30);
        this.speak('Feel the power of y=x!'); Audio.playBossSpecial();

        // Record the line endpoints before pushing the visual effect so we have
        // stable coordinates even if the player reference changes later.
        const graphStart = { x: this.x,   y: this.y   };
        const graphEnd   = { x: player.x, y: player.y };

        window.specialEffects.push(new DeadlyGraph(
            graphStart.x, graphStart.y,
            graphEnd.x,   graphEnd.y,
            BALANCE.boss.graphDuration
        ));

        // ── Destructible environment: line-AABB sweep ────────
        // Called at the moment the graph becomes fully active.
        // Destroys any MapObject the damage line passes through
        // and shrinks the MTCRoom by 10% if it is intersected.
        if (window.mapSystem && typeof window.mapSystem.damageArea === 'function') {
            window.mapSystem.damageArea(
                graphStart.x, graphStart.y,
                graphEnd.x,   graphEnd.y
            );
        }
    }

    useLog457() {
        this.skills.log.cd = this.skills.log.max;
        this.log457State = 'charging'; this.log457Timer = 0; this.state = 'CHASE';
        spawnFloatingText('log 4.57 = ?', this.x, this.y - 80, '#ef4444', 30);
        Audio.playBossSpecial();
    }

    async speak(context) {
        // Gemini is always defined — the global mock in game.js guarantees it.
        // getBossTaunt() on the mock returns '' so the UIManager branch is a
        // no-op and the boss simply stays silent when ai.js is offline.
        // try/catch is kept to handle real API/network errors gracefully;
        // demoted to console.debug so routine offline runs don't spam the console.
        try {
            const text = await Gemini.getBossTaunt(context);
            if (text && window.UIManager) window.UIManager.showBossSpeech(text);
        } catch (e) {
            console.debug('[Boss] Speech unavailable:', e);
        }
    }

    takeDamage(amt) {
        if (this.isInvulnerable) {
            spawnFloatingText('INVINCIBLE!', this.x, this.y - 40, '#facc15', 20);
            return;
        }
        this.hp -= amt;
        if (this.hp <= 0 && !this._waveSpawnLocked) {
            // BUG-4 FIX: lock immediately so simultaneous damage calls can't
            // trigger startNextWave() twice (race condition guard)
            this._waveSpawnLocked = true;
            this.dead = true; this.hp = 0;
            spawnParticles(this.x, this.y, 60, '#dc2626');
            spawnFloatingText('CLASS DISMISSED!', this.x, this.y, '#facc15', 35);
            addScore(BALANCE.score.boss * this.difficulty);
            if (window.UIManager) window.UIManager.updateBossHUD(null);
            Audio.playAchievement();
            for (let i = 0; i < 3; i++) {
                setTimeout(() => window.powerups.push(new PowerUp(this.x + rand(-50, 50), this.y + rand(-50, 50))), i * 200);
            }
            // WARN-9 FIX: set lastBossKilled BEFORE nulling window.boss so
            // the achievement check can still evaluate to true
            window.lastBossKilled = true;
            window.boss = null;
            Achievements.check('boss_down');
            setTimeout(() => {
                setWave(getWave() + 1);
                if (getWave() > BALANCE.waves.maxWaves) window.endGame('victory');
                else if (typeof window.startNextWave === 'function') window.startNextWave();
            }, BALANCE.boss.nextWaveDelay);
        }
    }

    draw() {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  KRU MANOP — The Math Boss · Chibi Strict Teacher       ║
        // ║  Dark-grey bean · Suit+tie · Glowing glasses · Ruler    ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(this.x, this.y);
        const now    = Date.now();
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        CTX.save();
        CTX.translate(screen.x, screen.y);

        // ── Charging scale pulse (log457) ─────────────────────────────
        if (this.log457State === 'charging') {
            const sc  = 1 + (this.log457Timer / 2) * 0.3;
            CTX.scale(sc, sc);
            const pu = Math.sin(this.log457Timer * 10) * 0.5 + 0.5;
            CTX.shadowBlur = 30 * pu; CTX.shadowColor = '#ef4444';
            CTX.beginPath(); CTX.arc(0, 0, 72, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(239,68,68,${pu * 0.25})`; CTX.fill();
            CTX.shadowBlur = 0;
        }
        if (this.log457State === 'active') {
            CTX.shadowBlur = 22; CTX.shadowColor = '#facc15';
        }
        if (this.log457State === 'stunned') {
            CTX.font = 'bold 30px Arial'; CTX.textAlign = 'center'; CTX.fillText('😵', 0, -78);
        }
        if (this.state === 'ULTIMATE') {
            const ult = Math.abs(Math.sin(now / 80));
            CTX.strokeStyle = `rgba(239,68,68,${ult})`; CTX.lineWidth = 5;
            CTX.beginPath(); CTX.arc(0, 0, 72, 0, Math.PI * 2); CTX.stroke();
        }

        // ── Phase 3 water aura (preserved) ───────────────────────────
        if (this.phase === 3) {
            const t3    = now / 600;
            const auraR = 80 + Math.sin(t3 * 2.5) * 10;
            CTX.shadowBlur = 0;
            const grad3 = CTX.createRadialGradient(0, 0, auraR * 0.4, 0, 0, auraR);
            grad3.addColorStop(0,   'rgba(56,189,248,0.0)');
            grad3.addColorStop(0.7, 'rgba(56,189,248,0.18)');
            grad3.addColorStop(1,   'rgba(56,189,248,0.45)');
            CTX.fillStyle = grad3;
            CTX.beginPath(); CTX.arc(0, 0, auraR, 0, Math.PI * 2); CTX.fill();
            CTX.strokeStyle = `rgba(125,211,252,${0.5 + Math.sin(t3 * 3) * 0.3})`;
            CTX.lineWidth = 3; CTX.shadowBlur = 20; CTX.shadowColor = '#38bdf8';
            CTX.beginPath(); CTX.arc(0, 0, auraR, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;
            for (let i = 0; i < 5; i++) {
                const bA = t3 * 1.8 + i * (Math.PI * 2 / 5);
                CTX.fillStyle = `rgba(186,230,253,${0.4 + Math.sin(t3 + i) * 0.3})`;
                CTX.beginPath(); CTX.arc(Math.cos(bA) * (auraR - 10), Math.sin(bA) * (auraR - 10), 5 + Math.sin(t3 * 2 + i) * 2, 0, Math.PI * 2); CTX.fill();
            }
        }

        // ── Orbiting Math Symbols ─────────────────────────────────────
        // π, Σ, ∞, ∂, ≈ orbit at varying radii and speeds, glowing white/gold
        const symbols   = ['π', 'Σ', '∞', '∂', '≈', '∫'];
        const orbitR    = 62;
        const baseSpeed = this.isEnraged ? 1.8 : 1.0;
        CTX.save();
        for (let i = 0; i < symbols.length; i++) {
            const angle  = (now / 1000) * baseSpeed + (i / symbols.length) * Math.PI * 2;
            const ox     = Math.cos(angle) * orbitR;
            const oy     = Math.sin(angle) * (orbitR * 0.55); // elliptical orbit
            const alpha  = 0.55 + Math.sin(now / 300 + i * 1.2) * 0.35;
            const gCol   = this.phase === 3 ? '#38bdf8'
                         : this.isEnraged   ? '#ef4444'
                         :                    '#facc15';
            CTX.save();
            CTX.translate(ox, oy);
            CTX.rotate(-this.angle); // keep text readable
            CTX.globalAlpha  = alpha;
            CTX.font         = `bold ${14 + Math.sin(now / 400 + i) * 2}px Arial`;
            CTX.textAlign    = 'center'; CTX.textBaseline = 'middle';
            CTX.shadowBlur   = 12 + Math.sin(now / 250 + i) * 5;
            CTX.shadowColor  = gCol;
            CTX.fillStyle    = gCol;
            CTX.fillText(symbols[i], 0, 0);
            CTX.restore();
        }
        CTX.globalAlpha = 1; CTX.shadowBlur = 0;
        CTX.restore();

        // ── Body Block (Body Anti-Flip) ───────────────────────────────
        CTX.save();
        if (isFacingLeft) CTX.scale(-1, 1);

        // Boss breathing
        const breathe = Math.sin(now / 260);
        const scaleX  = 1 + breathe * 0.018;
        const scaleY  = 1 - breathe * 0.022;
        CTX.scale(scaleX, scaleY);

        const R = BALANCE.boss.radius;

        // ── Phase 2 enrage glow ring ──────────────────────────────────
        if (this.phase === 2 && this.log457State !== 'charging') {
            CTX.shadowBlur  = 22; CTX.shadowColor = '#ef4444';
            CTX.strokeStyle = 'rgba(220,38,38,0.55)'; CTX.lineWidth = 3;
            CTX.beginPath(); CTX.arc(0, 0, R + 5, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;
        }

        // ── Silhouette glow ring ──────────────────────────────────────
        const glowCol   = this.phase === 3 ? 'rgba(56,189,248,0.50)'
                        : this.isEnraged   ? 'rgba(220,38,38,0.55)'
                        :                    'rgba(148,163,184,0.40)';
        const shadowC   = this.phase === 3 ? '#38bdf8'
                        : this.isEnraged   ? '#ef4444' : '#94a3b8';
        CTX.shadowBlur  = 16; CTX.shadowColor = shadowC;
        CTX.strokeStyle = glowCol; CTX.lineWidth = 2.8;
        CTX.beginPath(); CTX.arc(0, 0, R + 3, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur  = 0;

        // ── Bean body — tall dark-grey gradient (slightly taller) ─────
        CTX.save(); CTX.scale(0.92, 1.12); // tall bean
        const bodyG = CTX.createRadialGradient(-R * 0.25, -R * 0.30, 1, 0, 0, R);
        bodyG.addColorStop(0,   '#374151');
        bodyG.addColorStop(0.55, '#1f2937');
        bodyG.addColorStop(1,   '#111827');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, R, 0, Math.PI * 2); CTX.stroke();
        CTX.restore(); // end tall scale

        // Specular highlight
        CTX.fillStyle = 'rgba(255,255,255,0.09)';
        CTX.beginPath(); CTX.arc(-R * 0.3, -R * 0.32, R * 0.28, 0, Math.PI * 2); CTX.fill();

        // ── Suit jacket (dark navy vest panels) ──────────────────────
        // Left lapel
        CTX.fillStyle = '#1e2d40';
        CTX.beginPath();
        CTX.moveTo(-R * 0.08, -R * 0.48);
        CTX.lineTo(-R * 0.55, -R * 0.15);
        CTX.lineTo(-R * 0.52,  R * 0.50);
        CTX.lineTo(-R * 0.05,  R * 0.52);
        CTX.closePath(); CTX.fill();
        // Right lapel
        CTX.beginPath();
        CTX.moveTo(R * 0.08, -R * 0.48);
        CTX.lineTo(R * 0.55, -R * 0.15);
        CTX.lineTo(R * 0.52,  R * 0.50);
        CTX.lineTo(R * 0.05,  R * 0.52);
        CTX.closePath(); CTX.fill();

        // Jacket sticker outlines
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.5;
        CTX.beginPath();
        CTX.moveTo(-R * 0.08, -R * 0.48); CTX.lineTo(-R * 0.55, -R * 0.15); CTX.lineTo(-R * 0.52, R * 0.50);
        CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(R * 0.08, -R * 0.48); CTX.lineTo(R * 0.55, -R * 0.15); CTX.lineTo(R * 0.52, R * 0.50);
        CTX.stroke();

        // Suit buttons — 3 small dark dots down centre seam
        CTX.fillStyle = '#111827';
        for (let bi = 0; bi < 3; bi++) {
            CTX.beginPath(); CTX.arc(0, -R * 0.1 + bi * R * 0.25, 2, 0, Math.PI * 2); CTX.fill();
        }

        // ── Red necktie — diamond/wedge down the centre chest ────────
        const tieCol  = this.isEnraged ? '#ef4444' : '#dc2626';
        const tieGlow = this.isEnraged ? 0.55 : 0;
        CTX.fillStyle  = tieCol;
        CTX.shadowBlur = 8 * (tieGlow + 0.2); CTX.shadowColor = '#ef4444';
        CTX.beginPath();
        CTX.moveTo(0, -R * 0.48);       // knot top
        CTX.lineTo(R * 0.10, -R * 0.30);
        CTX.lineTo(R * 0.07,  R * 0.48); // tip
        CTX.lineTo(0,          R * 0.55);
        CTX.lineTo(-R * 0.07,  R * 0.48);
        CTX.lineTo(-R * 0.10, -R * 0.30);
        CTX.closePath(); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.5;
        CTX.beginPath();
        CTX.moveTo(0, -R * 0.48); CTX.lineTo(R * 0.10, -R * 0.30);
        CTX.lineTo(R * 0.07, R * 0.48); CTX.lineTo(0, R * 0.55);
        CTX.lineTo(-R * 0.07, R * 0.48); CTX.lineTo(-R * 0.10, -R * 0.30);
        CTX.closePath(); CTX.stroke();
        CTX.shadowBlur = 0;

        // Tie knot
        CTX.fillStyle = this.isEnraged ? '#b91c1c' : '#991b1b';
        CTX.beginPath(); CTX.ellipse(0, -R * 0.42, R * 0.09, R * 0.06, 0, 0, Math.PI * 2); CTX.fill();

        // ── Neat Combed Hair (covers upper ~50% of bean) ──────────────
        CTX.fillStyle = '#111827';
        CTX.beginPath();
        CTX.moveTo(-R * 0.88, -R * 0.04);
        CTX.quadraticCurveTo(-R * 1.05, -R * 0.65, -R * 0.42, -R - 6);
        CTX.quadraticCurveTo(0, -R - 9, R * 0.42, -R - 6);
        CTX.quadraticCurveTo(R * 1.05, -R * 0.65, R * 0.88, -R * 0.04);
        CTX.quadraticCurveTo(R * 0.50, R * 0.04, 0, R * 0.05);
        CTX.quadraticCurveTo(-R * 0.50, R * 0.04, -R * 0.88, -R * 0.04);
        CTX.closePath(); CTX.fill();

        // Hair sticker outline
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(-R * 0.88, -R * 0.04);
        CTX.quadraticCurveTo(-R * 1.05, -R * 0.65, -R * 0.42, -R - 6);
        CTX.quadraticCurveTo(0, -R - 9, R * 0.42, -R - 6);
        CTX.quadraticCurveTo(R * 1.05, -R * 0.65, R * 0.88, -R * 0.04);
        CTX.closePath(); CTX.stroke();

        // Strict centre parting
        CTX.strokeStyle = '#1f2937'; CTX.lineWidth = 1.8;
        CTX.beginPath();
        CTX.moveTo(0, -R * 0.05);
        CTX.quadraticCurveTo(R * 0.04, -R * 0.50, 0, -R - 8);
        CTX.stroke();

        // Hair highlight (glossy strand)
        CTX.fillStyle = '#1f2937';
        CTX.beginPath();
        CTX.moveTo(-R * 0.32, -R * 0.55);
        CTX.quadraticCurveTo(-R * 0.48, -R, -R * 0.22, -R - 6);
        CTX.quadraticCurveTo(-R * 0.10, -R - 2, -R * 0.18, -R * 0.48);
        CTX.quadraticCurveTo(-R * 0.22, -R * 0.28, -R * 0.32, -R * 0.55);
        CTX.closePath(); CTX.fill();

        // ── Glowing Square-Framed Glasses ────────────────────────────
        // Two square lens frames side-by-side across the "face zone"
        const glassGlow = this.isEnraged ? '#ef4444' : '#e0f2fe';
        const glassRefl = this.log457State === 'active' ? '#facc15' : '#e0f2fe';
        const lensW     = R * 0.38, lensH = R * 0.28;
        const lensY     = -R * 0.28;

        // Left lens
        CTX.shadowBlur  = 14; CTX.shadowColor = glassGlow;
        CTX.fillStyle   = `rgba(224,242,254,0.20)`;
        CTX.strokeStyle = glassGlow; CTX.lineWidth = 2.2;
        CTX.beginPath(); CTX.roundRect(-R * 0.72, lensY - lensH / 2, lensW, lensH, 3); CTX.fill(); CTX.stroke();
        // Right lens
        CTX.beginPath(); CTX.roundRect(R * 0.34, lensY - lensH / 2, lensW, lensH, 3); CTX.fill(); CTX.stroke();
        // Bridge connecting lenses
        CTX.strokeStyle = glassGlow; CTX.lineWidth = 1.8;
        CTX.beginPath(); CTX.moveTo(-R * 0.34, lensY); CTX.lineTo(R * 0.34, lensY); CTX.stroke();
        // Temple arms (go to sides)
        CTX.beginPath(); CTX.moveTo(-R * 0.72, lensY); CTX.lineTo(-R * 1.0, lensY + 2); CTX.stroke();
        CTX.beginPath(); CTX.moveTo(R * 0.72, lensY); CTX.lineTo(R * 1.0, lensY + 2); CTX.stroke();

        // Lens reflections — bright diagonal highlight inside each lens
        CTX.shadowBlur = 0;
        CTX.fillStyle  = `rgba(255,255,255,${0.55 + Math.sin(now / 280) * 0.30})`;
        // Left lens reflection
        CTX.beginPath(); CTX.ellipse(-R * 0.56, lensY - R * 0.06, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); CTX.fill();
        // Right lens reflection
        CTX.beginPath(); CTX.ellipse(R * 0.50, lensY - R * 0.06, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); CTX.fill();

        // ── Enraged phase fire particles (preserved) ──────────────────
        if (this.isEnraged) {
            const t = now / 80;
            const colA = this.phase === 3 ? '#fb923c' : '#ef4444';
            const colB = this.phase === 3 ? '#38bdf8' : '#f97316';
            for (let i = 0; i < 4; i++) {
                const px = Math.sin(t * 0.9 + i * 1.57) * 18;
                const py = -Math.abs(Math.cos(t * 1.1 + i * 1.57)) * 22 - 30;
                const ps = 3 + Math.sin(t + i) * 1.5;
                CTX.globalAlpha = 0.55 + Math.sin(t + i) * 0.3;
                CTX.fillStyle   = i % 2 === 0 ? colA : colB;
                CTX.shadowBlur  = 8; CTX.shadowColor = colA;
                CTX.beginPath(); CTX.arc(px, py, ps, 0, Math.PI * 2); CTX.fill();
            }
            CTX.globalAlpha = 1; CTX.shadowBlur = 0;
        }

        CTX.restore(); // end body block

        // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
        CTX.save();
        CTX.rotate(this.angle);
        if (isFacingLeft) CTX.scale(1, -1);

        // ── Floating Hands — holding a glowing ruler / chalk ─────────
        // Front hand — holding ruler, forward weapon side
        CTX.fillStyle   = '#2d3748'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5;
        CTX.shadowBlur  = 6; CTX.shadowColor = 'rgba(148,163,184,0.6)';
        CTX.beginPath(); CTX.arc(R + 7, 4, R * 0.32, 0, Math.PI * 2); CTX.fill(); CTX.stroke();

        // Ruler extending from front hand
        const rulerGlow = this.state === 'ATTACK' || this.state === 'ULTIMATE' ? 1.0 : 0.55;
        CTX.fillStyle   = '#f59e0b';
        CTX.shadowBlur  = 12 * rulerGlow; CTX.shadowColor = '#fbbf24';
        CTX.beginPath(); CTX.roundRect(R + 9, 1, R * 1.6, R * 0.22, 2); CTX.fill();
        // Ruler tick marks
        CTX.strokeStyle = 'rgba(0,0,0,0.5)'; CTX.lineWidth = 1;
        for (let ti = 0; ti < 5; ti++) {
            const tx = R + 11 + ti * (R * 1.5 / 5);
            CTX.beginPath(); CTX.moveTo(tx, 1); CTX.lineTo(tx, 5); CTX.stroke();
        }
        CTX.fillStyle = '#000'; CTX.font = `bold ${R * 0.16}px Arial`;
        CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
        CTX.fillText('30cm', R + 9 + R * 0.8, R * 0.11 + 2);
        CTX.shadowBlur = 0;

        // Back hand — off-side, open palm
        CTX.fillStyle   = '#374151'; CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5;
        CTX.shadowBlur  = 4; CTX.shadowColor = 'rgba(148,163,184,0.5)';
        CTX.beginPath(); CTX.arc(-(R + 7), 2, R * 0.28, 0, Math.PI * 2); CTX.fill(); CTX.stroke();
        CTX.shadowBlur = 0;

        CTX.restore(); // end weapon block

        CTX.restore(); // end main translate
    }
}

// ════════════════════════════════════════════════════════════
// 🐟 GOLDFISH MINION — Kamikaze sine-wave chaser (Phase 3)
// ════════════════════════════════════════════════════════════
class GoldfishMinion extends Entity {
    constructor(x, y) {
        const cfg = BALANCE.boss.goldfishMinion;
        super(x, y, cfg.radius);
        this.maxHp     = cfg.hp;
        this.hp        = cfg.hp;
        this.moveSpeed = cfg.speed;
        this.damage    = cfg.damage;
        this.wobbleAmp = cfg.wobbleAmp;
        this.wobbleFreq = cfg.wobbleFreq;
        this.lifeTimer = 0;   // drives sine wave
        // perpendicular direction for wobble offset
        this._perpX = 0;
        this._perpY = 0;
        this.name  = '🐟';
    }

    update(dt, player) {
        if (this.dead) return;

        this.lifeTimer += dt;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d  = Math.hypot(dx, dy);

        if (d > 0) {
            this.angle = Math.atan2(dy, dx);
            // Perpendicular axis for wobble (rotate 90°)
            this._perpX = -dy / d;
            this._perpY =  dx / d;

            const wobble = Math.sin(this.lifeTimer * this.wobbleFreq) * this.wobbleAmp;
            this.vx = (dx / d) * this.moveSpeed + this._perpX * wobble;
            this.vy = (dy / d) * this.moveSpeed + this._perpY * wobble;
        }
        this.applyPhysics(dt);

        // Kamikaze explosion on player contact
        if (d < this.radius + player.radius) {
            player.takeDamage(this.damage);
            spawnParticles(this.x, this.y, 18, BALANCE.boss.goldfishMinion.color);
            spawnFloatingText('🐟 SPLASH!', this.x, this.y - 35, '#fb923c', 22);
            addScreenShake(6);
            this.dead = true;
        }

        if (this.hp <= 0 && !this.dead) {
            this.dead = true;
            spawnParticles(this.x, this.y, 12, BALANCE.boss.goldfishMinion.color);
            addScore(50);
        }
    }

    takeDamage(amt) {
        this.hp -= amt;
        spawnParticles(this.x, this.y, 3, BALANCE.boss.goldfishMinion.color);
    }

    draw() {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  GOLDFISH MINION — Angry Kamikaze Fish                  ║
        // ║  Orange teardrop bean · Glowing fins · Sharp teeth      ║
        // ╚══════════════════════════════════════════════════════════╝
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const now    = Date.now();
        const isFacingLeft = Math.abs(this.angle) > Math.PI / 2;

        // ── Body Block (Body Anti-Flip logic) ─────────────────────────
        CTX.save();
        CTX.translate(screen.x, screen.y);
        if (isFacingLeft) CTX.scale(-1, 1);

        // Fast breathe — fish are always in motion
        const breathe = Math.sin(now / 140);
        CTX.scale(1 + breathe * 0.040, 1 - breathe * 0.025);

        const cfg = BALANCE.boss.goldfishMinion;
        const r   = cfg.radius;

        // ── Outer orange glow ─────────────────────────────────────────
        CTX.shadowBlur  = 12; CTX.shadowColor = '#fb923c';
        CTX.strokeStyle = 'rgba(251,146,60,0.60)'; CTX.lineWidth = 2;
        CTX.beginPath(); CTX.arc(0, 0, r + 2, 0, Math.PI * 2); CTX.stroke();
        CTX.shadowBlur  = 0;

        // ── Glowing tail fin (wide fan — behind body = negative X) ───
        const tailWag = Math.sin(now / 100) * 0.35;
        // Upper tail lobe
        CTX.fillStyle = '#ea580c';
        CTX.shadowBlur = 8; CTX.shadowColor = '#f97316';
        CTX.beginPath();
        CTX.moveTo(-r * 0.85, 0);
        CTX.quadraticCurveTo(-r * 1.70 + Math.cos(tailWag) * 6, -r * 1.00, -r * 2.20 + Math.sin(tailWag) * 4, -r * 0.80);
        CTX.quadraticCurveTo(-r * 1.60, -r * 0.25, -r * 0.85, 0);
        CTX.closePath(); CTX.fill();
        // Lower tail lobe
        CTX.beginPath();
        CTX.moveTo(-r * 0.85, 0);
        CTX.quadraticCurveTo(-r * 1.70 - Math.cos(tailWag) * 6,  r * 1.00,  -r * 2.20 - Math.sin(tailWag) * 4, r * 0.80);
        CTX.quadraticCurveTo(-r * 1.60,  r * 0.25, -r * 0.85, 0);
        CTX.closePath(); CTX.fill();
        // Tail sticker outlines
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2;
        CTX.beginPath();
        CTX.moveTo(-r * 0.85, 0);
        CTX.quadraticCurveTo(-r * 1.70 + Math.cos(tailWag) * 6, -r * 1.00, -r * 2.20 + Math.sin(tailWag) * 4, -r * 0.80);
        CTX.stroke();
        CTX.beginPath();
        CTX.moveTo(-r * 0.85, 0);
        CTX.quadraticCurveTo(-r * 1.70 - Math.cos(tailWag) * 6,  r * 1.00, -r * 2.20 - Math.sin(tailWag) * 4, r * 0.80);
        CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Dorsal fin (glowing, top) ─────────────────────────────────
        const dorsalWave = Math.sin(now / 130) * 0.3;
        CTX.fillStyle  = '#f97316';
        CTX.shadowBlur = 6; CTX.shadowColor = '#fb923c';
        CTX.beginPath();
        CTX.moveTo(-r * 0.25, -r * 0.85);
        CTX.quadraticCurveTo(r * 0.1 + dorsalWave * 5, -r * 1.80, r * 0.55, -r * 0.85);
        CTX.lineTo(-r * 0.25, -r * 0.85);
        CTX.closePath(); CTX.fill();
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.8;
        CTX.beginPath();
        CTX.moveTo(-r * 0.25, -r * 0.85);
        CTX.quadraticCurveTo(r * 0.1 + dorsalWave * 5, -r * 1.80, r * 0.55, -r * 0.85);
        CTX.stroke();
        CTX.shadowBlur = 0;

        // ── Side pectoral fins (small, glowing) ───────────────────────
        CTX.fillStyle = '#ea580c'; CTX.shadowBlur = 4; CTX.shadowColor = '#fb923c';
        // Upper pectoral
        CTX.beginPath();
        CTX.moveTo(r * 0.05, -r * 0.45);
        CTX.quadraticCurveTo(r * 0.55, -r * 0.90, r * 0.60, -r * 0.45);
        CTX.quadraticCurveTo(r * 0.30, -r * 0.25, r * 0.05, -r * 0.45);
        CTX.closePath(); CTX.fill();
        // Lower pectoral
        CTX.beginPath();
        CTX.moveTo(r * 0.05,  r * 0.45);
        CTX.quadraticCurveTo(r * 0.55,  r * 0.90, r * 0.60,  r * 0.45);
        CTX.quadraticCurveTo(r * 0.30,  r * 0.25, r * 0.05,  r * 0.45);
        CTX.closePath(); CTX.fill();
        CTX.shadowBlur = 0;

        // ── Main teardrop/bean body — orange/gold ─────────────────────
        // Slightly teardrop: wider toward the tail, pointed toward snout
        const bodyG = CTX.createRadialGradient(-r * 0.1, -r * 0.2, 1, 0, 0, r);
        bodyG.addColorStop(0,   '#fb923c');
        bodyG.addColorStop(0.55, '#f97316');
        bodyG.addColorStop(1,   '#c2410c');
        CTX.fillStyle = bodyG;
        CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.fill();

        // Thick sticker outline
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 3;
        CTX.beginPath(); CTX.arc(0, 0, r, 0, Math.PI * 2); CTX.stroke();

        // Belly highlight
        CTX.fillStyle = 'rgba(254,215,170,0.55)';
        CTX.beginPath(); CTX.ellipse(r * 0.15, r * 0.20, r * 0.42, r * 0.28, 0, 0, Math.PI * 2); CTX.fill();

        // Specular highlight
        CTX.fillStyle = 'rgba(255,255,255,0.20)';
        CTX.beginPath(); CTX.arc(-r * 0.28, -r * 0.28, r * 0.22, 0, Math.PI * 2); CTX.fill();

        // Scales pattern — two arcs of overlapping circles
        CTX.strokeStyle = 'rgba(234,88,12,0.45)'; CTX.lineWidth = 1.2;
        for (let si = 0; si < 3; si++) {
            const sx = -r * 0.2 + si * r * 0.28;
            CTX.beginPath(); CTX.arc(sx, r * 0.15, r * 0.30, Math.PI, Math.PI * 2); CTX.stroke();
            CTX.beginPath(); CTX.arc(sx + r * 0.14, -r * 0.15, r * 0.30, Math.PI, Math.PI * 2); CTX.stroke();
        }

        // ── Sharp white teeth (visible on mouth outline) ──────────────
        // Draw a snout area at the front (+X side)
        const snoutX = r * 0.78;
        // Mouth opening (black gap)
        CTX.fillStyle = '#1e293b';
        CTX.beginPath();
        CTX.moveTo(snoutX, -r * 0.18);
        CTX.lineTo(r * 1.15, 0);
        CTX.lineTo(snoutX,  r * 0.18);
        CTX.closePath(); CTX.fill();

        // Upper teeth — 3 sharp triangular spikes
        CTX.fillStyle = '#f8fafc';
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 1.2;
        const teethCount = 3;
        const toothSpan  = r * 0.30;
        for (let ti = 0; ti < teethCount; ti++) {
            const ty = -r * 0.14 + ti * (toothSpan / (teethCount - 1));
            CTX.beginPath();
            CTX.moveTo(snoutX, ty - r * 0.04);
            CTX.lineTo(r * 1.08, ty + r * 0.01);
            CTX.lineTo(snoutX, ty + r * 0.04);
            CTX.closePath(); CTX.fill(); CTX.stroke();
        }
        // Lower teeth
        for (let ti = 0; ti < 2; ti++) {
            const ty = r * 0.06 + ti * (toothSpan * 0.5 / 1);
            CTX.beginPath();
            CTX.moveTo(snoutX,   ty - r * 0.03);
            CTX.lineTo(r * 1.06, ty + r * 0.01);
            CTX.lineTo(snoutX,   ty + r * 0.03);
            CTX.closePath(); CTX.fill(); CTX.stroke();
        }

        // Angry brow slash above snout
        CTX.strokeStyle = '#1e293b'; CTX.lineWidth = 2.5; CTX.lineCap = 'round';
        CTX.beginPath();
        CTX.moveTo(r * 0.48, -r * 0.55);
        CTX.lineTo(r * 0.85, -r * 0.35);
        CTX.stroke();

        CTX.restore(); // end body transform
    }
}

// ════════════════════════════════════════════════════════════
// 🫧 BUBBLE PROJECTILE — Slow AoE slow + damage (Phase 3)
// ════════════════════════════════════════════════════════════
class BubbleProjectile {
    constructor(x, y, angle) {
        const cfg   = BALANCE.boss.bubbleProjectile;
        this.x      = x;
        this.y      = y;
        this.vx     = Math.cos(angle) * cfg.speed;
        this.vy     = Math.sin(angle) * cfg.speed;
        this.radius = cfg.radius;
        this.damage = cfg.damage;
        this.angle  = angle;
        this.dead   = false;
        this.lifeTimer = 0;
        this.maxLife   = 6;   // seconds before popping
    }

    update(dt, player) {
        if (this.dead) return true;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.lifeTimer += dt;

        // ── Off-screen cleanup ───────────────────────────────────
        // Remove bubble if it goes too far off-screen to prevent array growth
        const worldBounds = GAME_CONFIG.physics.worldBounds;
        if (Math.abs(this.x) > worldBounds * 1.5 || Math.abs(this.y) > worldBounds * 1.5) {
            this.dead = true;
            return true;
        }

        if (this.lifeTimer >= this.maxLife) {
            this._pop();
            return true;
        }

        // Hit player
        const d = Math.hypot(player.x - this.x, player.y - this.y);
        if (d < this.radius + player.radius) {
            player.takeDamage(this.damage);
            // Apply slow
            const P3 = BALANCE.boss.phase3;
            player._bubbleSlowTimer = P3.slowDuration;
            if (!player._bubbleSlowApplied) {
                player._bubbleSlowApplied = true;
                player._baseMoveSpeedBubble = player.moveSpeed;
                player.moveSpeed = player.moveSpeed * P3.slowFactor;
            }
            spawnFloatingText('🫧 SLOWED!', player.x, player.y - 50, '#38bdf8', 22);
            addScreenShake(8);
            this._pop();
            return true;
        }

        return false;
    }

    _pop() {
        this.dead = true;
        spawnParticles(this.x, this.y, 10, '#bae6fd');
        spawnFloatingText('POP!', this.x, this.y - 20, '#7dd3fc', 18);
    }

    draw() {
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        const r = this.radius;
        const pulse = Math.sin(this.lifeTimer * 4) * 0.08 + 1;

        CTX.save();
        CTX.translate(screen.x, screen.y);

        // Bubble body — semi-transparent fill
        CTX.shadowBlur  = 18;
        CTX.shadowColor = '#38bdf8';
        CTX.fillStyle   = 'rgba(186, 230, 253, 0.35)';
        CTX.beginPath();
        CTX.arc(0, 0, r * pulse, 0, Math.PI * 2);
        CTX.fill();

        // Rim
        CTX.strokeStyle = 'rgba(125, 211, 252, 0.8)';
        CTX.lineWidth   = 2;
        CTX.stroke();

        // White highlight reflection
        CTX.shadowBlur  = 0;
        CTX.fillStyle   = 'rgba(255, 255, 255, 0.7)';
        CTX.beginPath();
        CTX.ellipse(-r * 0.3, -r * 0.3, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2);
        CTX.fill();

        // Small secondary reflection dot
        CTX.fillStyle = 'rgba(255,255,255,0.5)';
        CTX.beginPath();
        CTX.arc(-r * 0.1, r * 0.35, r * 0.07, 0, Math.PI * 2);
        CTX.fill();

        CTX.restore();
    }
}

// ─── Node/bundler export ──────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Boss, BossDog, GoldfishMinion, BubbleProjectile, BarkWave };
}
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.Boss              = Boss;
window.BossDog           = BossDog;
window.GoldfishMinion    = GoldfishMinion;
window.BubbleProjectile  = BubbleProjectile;
window.BarkWave          = BarkWave;