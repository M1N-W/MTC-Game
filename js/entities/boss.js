'use strict';
/**
 * js/entities/boss.js
 *
 * ► BossDog — "DOG" — Summoned by Kru Manop in Phase 2.
 *             Standalone aggressive melee chaser.
 *
 * ► Boss — "KRU MANOP THE DOG SUMMONER"
 *           Phase 1 (normal ranged attacks)
 *           Phase 2 (enraged + summons BossDog; fights continue ranged)
 *           States: CHASE | ATTACK | ULTIMATE
 *           Skills: equationSlam | deadlyGraph | log457 | bark (phase 2 only)
 *
 * Depends on: base.js  (Entity)
 *             player.js (BarkWave)
 *             game.js   (Gemini global mock — must be loaded before this file)
 *
 * ────────────────────────────────────────────────────────────────
 * REFACTOR NOTES (Phase 2 Dog Summon)
 * ────────────────────────────────────────────────────────────────
 * ✅ BossDog class — standalone melee entity; migrated dog drawing from Boss._drawDog().
 *    Coordinates shifted by (-6, -28) so dog body is centred on entity origin.
 * ✅ Boss no longer uses isRider / dogLegTimer / _drawDog.
 *    enablePhase2 flag (set by game.js based on encounter) controls Phase 2 activation.
 *    Encounter 1 (Wave 3): enablePhase2=false → Phase 1 only.
 *    Encounter 2+ (Wave 6, 9): enablePhase2=true → summons BossDog on HP threshold.
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
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        // HP bar above dog
        {
            const barW = 60, barH = 6;
            const pct  = Math.max(0, this.hp / this.maxHp);
            CTX.save();
            CTX.rotate(-this.angle); // keep bar level
            CTX.fillStyle = 'rgba(0,0,0,0.55)';
            CTX.fillRect(-barW / 2, -42, barW, barH);
            CTX.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
            CTX.fillRect(-barW / 2, -42, barW * pct, barH);
            CTX.restore();
        }

        // Draw the dog (coordinates shifted by -6, -28 to centre on entity origin)
        CTX.translate(-6, -28);
        this._drawDogBody();

        CTX.restore();
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
                if (typeof window.enemies !== 'undefined' && Array.isArray(window.enemies)) {
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
                    if (typeof window.enemies !== 'undefined' && Array.isArray(window.enemies)) {
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
        if (this.hp <= 0) {
            this.dead = true; this.hp = 0;
            spawnParticles(this.x, this.y, 60, '#dc2626');
            spawnFloatingText('CLASS DISMISSED!', this.x, this.y, '#facc15', 35);
            addScore(BALANCE.score.boss * this.difficulty);
            if (window.UIManager) window.UIManager.updateBossHUD(null);
            Audio.playAchievement();
            for (let i = 0; i < 3; i++) {
                setTimeout(() => window.powerups.push(new PowerUp(this.x + rand(-50, 50), this.y + rand(-50, 50))), i * 200);
            }
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
        const screen = worldToScreen(this.x, this.y);
        CTX.save(); CTX.translate(screen.x, screen.y);

        if (this.log457State === 'charging') {
            const sc = 1 + (this.log457Timer / 2) * 0.3;
            CTX.scale(sc, sc);
            const pu = Math.sin(this.log457Timer * 10) * 0.5 + 0.5;
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(239,68,68,${pu * 0.3})`; CTX.fill();
        }
        if (this.log457State === 'active')  { CTX.shadowBlur = 20; CTX.shadowColor = '#facc15'; }
        if (this.log457State === 'stunned') {
            CTX.font = 'bold 30px Arial'; CTX.textAlign = 'center'; CTX.fillText('😵', 0, -70);
        }
        if (this.state === 'ULTIMATE') {
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.strokeStyle = `rgba(239,68,68,${Math.random()})`;
            CTX.lineWidth = 5; CTX.stroke();
        }
        if (this.phase === 2 && this.log457State !== 'charging') {
            CTX.shadowBlur = 20; CTX.shadowColor = '#ef4444';
        }

        // ── Phase 3 water aura ───────────────────────────────
        if (this.phase === 3) {
            const t3 = performance.now() / 600;
            const auraR = 80 + Math.sin(t3 * 2.5) * 10;
            CTX.shadowBlur = 0;

            // Outer pulsating water ring
            const grad3 = CTX.createRadialGradient(0, 0, auraR * 0.4, 0, 0, auraR);
            grad3.addColorStop(0,   'rgba(56, 189, 248, 0.0)');
            grad3.addColorStop(0.7, 'rgba(56, 189, 248, 0.18)');
            grad3.addColorStop(1,   'rgba(56, 189, 248, 0.45)');
            CTX.fillStyle = grad3;
            CTX.beginPath(); CTX.arc(0, 0, auraR, 0, Math.PI * 2); CTX.fill();

            // Rim stroke
            CTX.strokeStyle = `rgba(125, 211, 252, ${0.5 + Math.sin(t3 * 3) * 0.3})`;
            CTX.lineWidth = 3;
            CTX.shadowBlur = 20; CTX.shadowColor = '#38bdf8';
            CTX.beginPath(); CTX.arc(0, 0, auraR, 0, Math.PI * 2); CTX.stroke();
            CTX.shadowBlur = 0;

            // Orbiting bubble accents
            for (let i = 0; i < 5; i++) {
                const bAngle = t3 * 1.8 + i * (Math.PI * 2 / 5);
                const bx = Math.cos(bAngle) * (auraR - 10);
                const by = Math.sin(bAngle) * (auraR - 10);
                CTX.fillStyle = `rgba(186, 230, 253, ${0.4 + Math.sin(t3 + i) * 0.3})`;
                CTX.beginPath(); CTX.arc(bx, by, 5 + Math.sin(t3 * 2 + i) * 2, 0, Math.PI * 2); CTX.fill();
            }
        }

        CTX.rotate(this.angle);

        // ── Kru Manop body ───────────────────────────────────
        CTX.save(); CTX.translate(0, 0);
        CTX.fillStyle = '#f8fafc'; CTX.fillRect(-30, -30, 60, 60);
        CTX.fillStyle = '#e2e8f0';
        CTX.beginPath(); CTX.moveTo(-30, -30); CTX.lineTo(-20, -20); CTX.lineTo(20, -20); CTX.lineTo(30, -30); CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#ef4444';
        CTX.beginPath(); CTX.moveTo(0, -20); CTX.lineTo(6, 0); CTX.lineTo(0, 25); CTX.lineTo(-6, 0); CTX.closePath(); CTX.fill();
        CTX.fillStyle = this.log457State === 'charging' ? '#ff0000' : '#e2e8f0';
        CTX.beginPath(); CTX.arc(0, 0, 24, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#94a3b8'; CTX.beginPath(); CTX.arc(0, 0, 26, Math.PI, 0); CTX.fill();
        if (this.phase === 2 || this.log457State === 'active') {
            CTX.fillStyle = '#ef4444';
            CTX.fillRect(-12, -5, 10, 3); CTX.fillRect(2, -5, 10, 3);
        }
        CTX.fillStyle = '#facc15'; CTX.fillRect(25, 12, 60, 10);
        CTX.fillStyle = '#000'; CTX.font = 'bold 8px Arial'; CTX.fillText('30cm', 50, 17);

        if (this.isEnraged) {
            const t = performance.now() / 80;
            // Phase 3: orange+blue fish-water particles; Phase 2: red+orange fire
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
        CTX.restore();

        CTX.restore();
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
        if (this.dead) return;
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);
        CTX.rotate(this.angle);

        const cfg = BALANCE.boss.goldfishMinion;
        const r   = cfg.radius;

        // Glow
        CTX.shadowBlur  = 12;
        CTX.shadowColor = '#fb923c';

        // Body (orange oval)
        CTX.fillStyle = '#fb923c';
        CTX.beginPath();
        CTX.ellipse(0, 0, r * 1.6, r * 0.9, 0, 0, Math.PI * 2);
        CTX.fill();

        // Belly highlight
        CTX.fillStyle = '#fed7aa';
        CTX.beginPath();
        CTX.ellipse(0, 2, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
        CTX.fill();

        // Tail (triangle pointing backwards = negative x)
        CTX.fillStyle = '#ea580c';
        CTX.beginPath();
        CTX.moveTo(-r * 1.6, 0);
        CTX.lineTo(-r * 2.6,  r * 0.9);
        CTX.lineTo(-r * 2.6, -r * 0.9);
        CTX.closePath();
        CTX.fill();

        // Dorsal fin
        CTX.fillStyle = '#ea580c';
        CTX.beginPath();
        CTX.moveTo(-r * 0.2, -r * 0.9);
        CTX.lineTo( r * 0.6, -r * 1.6);
        CTX.lineTo( r * 1.0, -r * 0.9);
        CTX.closePath();
        CTX.fill();

        // Eye
        CTX.shadowBlur = 0;
        CTX.fillStyle = '#1e293b';
        CTX.beginPath();
        CTX.arc(r * 0.9, -r * 0.2, r * 0.28, 0, Math.PI * 2);
        CTX.fill();
        CTX.fillStyle = '#ffffff';
        CTX.beginPath();
        CTX.arc(r * 0.96, -r * 0.26, r * 0.1, 0, Math.PI * 2);
        CTX.fill();

        CTX.restore();
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
    module.exports = { Boss, BossDog, GoldfishMinion, BubbleProjectile };
}