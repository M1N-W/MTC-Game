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
        this.maxHp = cfg.hp;
        this.hp = cfg.hp;
        this.moveSpeed = cfg.speed;
        this.damage = cfg.damage;
        this.legTimer = 0;
        this.isEnraged = false; // visually enraged from birth
        this.name = 'DOG';
    }

    update(dt, player) {
        if (this.dead) return;

        this.legTimer += dt * 2.5;

        // Strict aggressive chase
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);
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
    // draw() → BossRenderer.drawXxx(e, ctx)  — see bottom of file.


    _drawDogBody() {
        // Colours — always enraged-looking since it's a combat summon
        const bodyCol = '#dc2626';
        const darkCol = '#991b1b';
        const lightCol = '#ef4444';
        const eyeCol = '#facc15';

        const legSpeed = 9;
        const swingAmt = 0.45;
        const swingA = Math.sin(this.legTimer * legSpeed) * swingAmt;
        const swingB = -swingA;
        const LEG_LEN = 20, PAW_RY = 4;

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
        drawLeg(14, 36, swingA, -1); drawLeg(26, 36, swingB, 1);
        drawLeg(-14, 36, swingB, -1); drawLeg(-2, 36, swingA, 1);

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
            CTX.fillStyle = i % 2 === 0 ? '#ef4444' : '#f97316';
            CTX.shadowBlur = 10; CTX.shadowColor = '#ef4444';
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
        // Boss HP scales per encounter using hpMultiplier from config
        // Encounter 1: baseHp × 1, Encounter 2: baseHp × 1.25, Encounter 3: baseHp × 1.5625
        const encounterMult = Math.pow(BALANCE.boss.hpMultiplier, difficulty - 1);
        this.maxHp = Math.floor(BALANCE.boss.baseHp * encounterMult);
        this.hp = this.maxHp;
        this.name = 'KRU MANOP';
        this.state = 'CHASE';
        this.timer = 0;
        this.moveSpeed = BALANCE.boss.moveSpeed;
        this.difficulty = difficulty;
        this.phase = 1;
        this.sayTimer = 0;
        this.enablePhase2 = enablePhase2;
        this.enablePhase3 = enablePhase3;
        this.dogSummoned = false;

        this.skills = {
            slam: { cd: 0, max: BALANCE.boss.slamCooldown },
            graph: { cd: 0, max: BALANCE.boss.graphCooldown },
            log: { cd: 0, max: BALANCE.boss.log457Cooldown },
            bark: { cd: 0, max: BALANCE.boss.phase2.barkCooldown },
            goldfish: { cd: 0, max: BALANCE.boss.phase3.goldfishCooldown },
            bubble: { cd: 0, max: BALANCE.boss.phase3.bubbleCooldown }
        };

        this.log457State = null;
        this.log457Timer = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable = false;
        this.isEnraged = false;
        // BUG-4: lock flag prevents double startNextWave() from rapid damage hits
        this._waveSpawnLocked = false;
    }

    update(dt, player) {
        if (this.dead) return;
        const dx = player.x - this.x, dy = player.y - this.y;
        const d = dist(this.x, this.y, player.x, player.y);
        this.angle = Math.atan2(dy, dx);
        this.timer += dt;
        this.sayTimer += dt;

        for (let s in this.skills) if (this.skills[s].cd > 0) this.skills[s].cd -= dt;

        if (this.sayTimer > BALANCE.boss.speechInterval && Math.random() < 0.1) {
            this.speak('Player at ' + Math.round(player.hp) + ' HP');
            this.sayTimer = 0;
        }

        // ── Phase 2 transition ───────────────────────────────
        if (this.hp < this.maxHp * BALANCE.boss.phase2Threshold && this.phase === 1 && this.enablePhase2) {
            this.phase = 2;
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
            this.skills.bubble.cd = 0;
            spawnFloatingText('🐟 THE GOLDFISH LOVER!', this.x, this.y - 100, '#38bdf8', 42);
            spawnFloatingText('🫧 BUBBLE PRISON!', this.x, this.y - 145, '#7dd3fc', 30);
            addScreenShake(30);
            spawnParticles(this.x, this.y, 50, '#38bdf8');
            spawnParticles(this.x, this.y, 30, '#fb923c');
            this.speak('My goldfish... AVENGE THEM!');
            Audio.playBossSpecial();
        }

        // ── Phase 3 attacks ──────────────────────────────────
        if (this.phase === 3) {
            const P3 = BALANCE.boss.phase3;

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
                const half = Math.floor(P3.bubbleCount / 2);
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
                if (this.skills.log.cd <= 0 && Math.random() < 0.20) this.useLog457();
                else if (this.skills.graph.cd <= 0 && Math.random() < 0.25) this.useDeadlyGraph(player);
                else if (this.phase === 2 && this.skills.bark.cd <= 0 && Math.random() < barkChance) this.bark(player);
                else if (this.skills.slam.cd <= 0 && Math.random() < 0.30) this.useEquationSlam();
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
        const coneHalf = Math.PI / 3.5;
        window.specialEffects.push(new BarkWave(this.x, this.y, barkAngle, coneHalf, P2.barkRange));
        const dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy);
        if (d > 0 && d < P2.barkRange) {
            const playerAngle = Math.atan2(dy, dx);
            let diff = playerAngle - barkAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
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
        const graphStart = { x: this.x, y: this.y };
        const graphEnd = { x: player.x, y: player.y };

        window.specialEffects.push(new DeadlyGraph(
            graphStart.x, graphStart.y,
            graphEnd.x, graphEnd.y,
            BALANCE.boss.graphDuration
        ));
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
            Achievements.check('manop_down');
            setTimeout(() => {
                setWave(getWave() + 1);
                if (getWave() > BALANCE.waves.maxWaves) window.endGame('victory');
                else {
                    if (typeof window.startNextWave === 'function') window.startNextWave();
                }
            }, BALANCE.boss.nextWaveDelay);
        }
    }
    // draw() → BossRenderer.drawXxx(e, ctx)  — see bottom of file.

}

// ════════════════════════════════════════════════════════════
// ⚛️  BOSS FIRST — "KRU FIRST · PHYSICS MASTER"
//
// Encounter 2 (Wave 6):  BossFirst(bossLevel, false)
// Encounter 4 (Wave 12): BossFirst(bossLevel, true)  ← isAdvanced
//
// States: IDLE | CHASE | SUVAT_CHARGE | ORBIT_ATTACK |
//         FREE_FALL | ROCKET | SANDWICH_TOSS | STUNNED | BERSERK
// ════════════════════════════════════════════════════════════
class BossFirst extends Entity {
    /**
     * @param {number}  difficulty  - HP/score multiplier
     * @param {boolean} isAdvanced  - true on encounter 4; extra stat boost
     */
    constructor(difficulty = 1, isAdvanced = false) {
        const BASE_R = BALANCE.boss.radius * 0.88;
        super(0, BALANCE.boss.spawnY, BASE_R);

        const advMult = isAdvanced ? 1.35 : 1.0;
        this.maxHp = BALANCE.boss.baseHp * difficulty * 0.62 * advMult;
        this.hp = this.maxHp;
        this.name = 'KRU FIRST';
        this.moveSpeed = BALANCE.boss.moveSpeed * 1.55 * advMult;
        this.difficulty = difficulty;
        this.isAdvanced = isAdvanced;
        this.isEnraged = false;         // becomes true permanently when BERSERK triggered
        this.state = 'CHASE';
        this.stateTimer = 0;
        this.timer = 0;
        this.sayTimer = 0;
        this._waveSpawnLocked = false;

        // ── Skill cooldowns ──────────────────────────────────
        this.skills = {
            suvat: { cd: 0, max: 8.0 },
            orbit: { cd: 0, max: 12.0 },
            freeFall: { cd: 0, max: 15.0 },
            rocket: { cd: 0, max: 9.0 },
            sandwich: { cd: 0, max: 18.0 }
        };

        // ── SUVAT charge constants ────────────────────────────
        this.SUVAT_WIND_UP = 0.9;          // seconds of wind-up before dash
        this.SUVAT_ACCEL = 1900;         // px/s²
        this.SUVAT_MAX_DUR = 1.2;          // max dash duration
        this._suvatVel = 0;            // current dash scalar

        // ── ORBIT state ──────────────────────────────────────
        this.ORBIT_R = 115;              // px from centre of orbit
        this.ORBIT_W = 2.8;             // rad/s
        this.ORBIT_DUR = 3.5;
        this._orbitCX = 0;
        this._orbitCY = 0;
        this._orbitT = 0;
        this._orbitFireCd = 0;

        // ── FREE_FALL state ───────────────────────────────────
        this.FREE_FALL_WARN = 1.8;         // warning ring duration
        this._fallTargetX = 0;
        this._fallTargetY = 0;

        // ── BERSERK fire timer ────────────────────────────────
        this._berserkFireCd = 0;

        // ── Dodge system ──────────────────────────────────────
        this._dodgeCd = 0;

        // ── Active sandwich reference (drawn separately) ──────
        this._activeSandwich = null;

        // ── hitFlashTimer (for damage visual) ────────────────
        this.hitFlashTimer = 0;
    }

    // ─────────────────────────────────────────────────────────
    // UPDATE
    // ─────────────────────────────────────────────────────────
    update(dt, player) {
        if (this.dead) return;

        this.timer += dt;
        this.sayTimer += dt;
        this.stateTimer += dt;
        if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

        // Cooldown ticks
        for (const s in this.skills) if (this.skills[s].cd > 0) this.skills[s].cd -= dt;
        if (this._dodgeCd > 0) this._dodgeCd -= dt;
        if (this._orbitFireCd > 0) this._orbitFireCd -= dt;
        if (this._berserkFireCd > 0) this._berserkFireCd -= dt;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy);
        this.angle = Math.atan2(dy, dx);

        // ── Dodge incoming projectiles ────────────────────────
        if (this._dodgeCd <= 0 && typeof projectileManager !== 'undefined') {
            for (const p of projectileManager.getAll ? projectileManager.getAll() : (projectileManager.list || [])) {
                if (!p || p.dead || p.team === 'enemy') continue;
                const pdx = p.x - this.x, pdy = p.y - this.y;
                if (Math.hypot(pdx, pdy) < 130) {
                    // Perpendicular impulse
                    this.vx += -pdy / (Math.hypot(pdx, pdy) + 1) * 420;
                    this.vy += pdx / (Math.hypot(pdx, pdy) + 1) * 420;
                    this._dodgeCd = 1.2;
                    break;
                }
            }
        }

        // ── State machine ─────────────────────────────────────
        switch (this.state) {

            case 'CHASE': {
                if (d > 0) {
                    this.vx = (dx / d) * this.moveSpeed;
                    this.vy = (dy / d) * this.moveSpeed;
                }
                this.applyPhysics(dt);

                if (this.stateTimer > 2.0) {
                    this.stateTimer = 0;
                    this._pickSkill(player, d);
                }
                break;
            }

            case 'SUVAT_CHARGE': {
                // Phase 1 — wind-up
                if (this.stateTimer <= this.SUVAT_WIND_UP) {
                    this.vx *= 0.85; this.vy *= 0.85;
                } else {
                    // Phase 2 — v = u + at dash
                    this._suvatVel += this.SUVAT_ACCEL * dt;
                    const dashAngle = Math.atan2(
                        player.y - this._suvatAimY,
                        player.x - this._suvatAimX
                    );
                    this.vx = Math.cos(dashAngle) * this._suvatVel;
                    this.vy = Math.sin(dashAngle) * this._suvatVel;
                    this.applyPhysics(dt);

                    // Hit player
                    if (d < this.radius + player.radius + 12) {
                        player.takeDamage(80);
                        addScreenShake(14);
                        spawnFloatingText('v=u+at IMPACT!', player.x, player.y - 55, '#fbbf24', 28);
                        this._enterOrbit(player);
                        break;
                    }

                    if (this.stateTimer - this.SUVAT_WIND_UP > this.SUVAT_MAX_DUR) {
                        this._enterState('CHASE');
                    }
                }
                break;
            }

            case 'ORBIT_ATTACK': {
                this._orbitT += this.ORBIT_W * dt;
                this.x = this._orbitCX + Math.cos(this._orbitT) * this.ORBIT_R;
                this.y = this._orbitCY + Math.sin(this._orbitT) * this.ORBIT_R;
                this.vx = 0; this.vy = 0;

                if (this._orbitFireCd <= 0) {
                    this._orbitFireCd = 0.50;
                    const aimA = Math.atan2(player.y - this.y, player.x - this.x);
                    projectileManager.add(new Projectile(
                        this.x, this.y, aimA,
                        520, 24,
                        '#818cf8', false, 'enemy'
                    ));
                }

                // Track player centre slowly
                this._orbitCX += (player.x - this._orbitCX) * dt * 1.2;
                this._orbitCY += (player.y - this._orbitCY) * dt * 1.2;

                if (this.stateTimer > this.ORBIT_DUR) this._enterState('CHASE');
                break;
            }

            case 'FREE_FALL': {
                // Invisible + invulnerable warning phase
                if (this.stateTimer < this.FREE_FALL_WARN) {
                    this.vx = 0; this.vy = 0;
                } else {
                    // Teleport + AoE
                    this.x = this._fallTargetX;
                    this.y = this._fallTargetY;
                    // AoE damage
                    const aoeR = 140;
                    const fdx = player.x - this.x, fdy = player.y - this.y;
                    if (Math.hypot(fdx, fdy) < aoeR + player.radius) {
                        player.takeDamage(95 * (this.isAdvanced ? 1.25 : 1.0));
                        spawnFloatingText('h=½gt² CRASH!', player.x, player.y - 60, '#ef4444', 30);
                        addScreenShake(20);
                    }
                    // ── Shockwave ring ──
                    window.specialEffects.push(new ExpandingRing(this.x, this.y, '#ef4444', 180, 0.6));
                    spawnParticles(this.x, this.y, 35, '#ef4444');
                    spawnParticles(this.x, this.y, 20, '#fbbf24');
                    this._enterState('CHASE');
                }
                break;
            }

            case 'ROCKET': {
                // Jump backward for first 0.3s then idle
                if (this.stateTimer < 0.3) {
                    const awayA = this.angle + Math.PI;
                    this.vx = Math.cos(awayA) * 230;
                    this.vy = Math.sin(awayA) * 230;
                    this.applyPhysics(dt);
                }
                if (this.stateTimer > 0.35 && this.stateTimer < 0.45) {
                    // Fire scaled rocket projectile — p = mv
                    const dist_ = Math.max(100, Math.min(700, d));
                    const scale = 0.5 + ((dist_ - 100) / 600) * 2.0;  // 0.5 – 2.5
                    const rDmg = 28 * scale * (this.isAdvanced ? 1.3 : 1.0);
                    const rSpeed = 480 + scale * 180;
                    const rRad = 14 + scale * 8;
                    projectileManager.add(new Projectile(
                        this.x, this.y, this.angle, rSpeed, rDmg,
                        '#f97316', false, 'enemy', rRad
                    ));
                    spawnFloatingText('p=mv ROCKET!', this.x, this.y - 65, '#f97316', 26);
                    Audio.playBossSpecial();
                }
                if (this.stateTimer > 1.0) this._enterState('CHASE');
                break;
            }

            case 'SANDWICH_TOSS': {
                // Sandwich is managed as its own entity in specialEffects
                if (this.stateTimer > 0.5 && !this._sandwichFired) {
                    this._sandwichFired = true;
                    const sw = new PorkSandwich(this.x, this.y, this.angle, this);
                    window.specialEffects.push(sw);
                    this._activeSandwich = sw;
                }
                if (this.stateTimer > 1.2) this._enterState('CHASE');
                break;
            }

            case 'STUNNED': {
                this.vx *= 0.88; this.vy *= 0.88;
                const stunDur = this.isEnraged ? 2.5 : 3.8;
                if (this.stateTimer > stunDur) this._enterState('CHASE');
                break;
            }

            case 'BERSERK': {
                // Permanent enrage: fast aggressive chase + burst fire
                this.isEnraged = true;
                if (d > 0) {
                    this.vx = (dx / d) * this.moveSpeed * 1.25;
                    this.vy = (dy / d) * this.moveSpeed * 1.25;
                }
                this.applyPhysics(dt);

                if (this._berserkFireCd <= 0) {
                    this._berserkFireCd = 2.2;
                    for (let i = -1; i <= 1; i++) {
                        projectileManager.add(new Projectile(
                            this.x, this.y, this.angle + i * 0.22,
                            540, 22 * (this.isAdvanced ? 1.3 : 1.0),
                            '#ef4444', false, 'enemy'
                        ));
                    }
                }

                if (this.stateTimer > 3.5) this._enterState('CHASE');
                break;
            }
        }

        // Contact damage
        if (d < this.radius + player.radius) {
            player.takeDamage(BALANCE.boss.contactDamage * dt * 1.2);
        }

        if (this.sayTimer > BALANCE.boss.speechInterval && Math.random() < 0.1) {
            this._speak('Player at ' + Math.round(player.hp) + ' HP');
            this.sayTimer = 0;
        }

        if (window.UIManager) {
            window.UIManager.updateBossHUD(this);
            window.UIManager.updateBossSpeech(this);
        }
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    _enterState(s) {
        this.state = s; this.stateTimer = 0;
    }

    _pickSkill(player, d) {
        // Sandwich toss is highest priority
        if (this.skills.sandwich.cd <= 0) {
            this.skills.sandwich.cd = this.skills.sandwich.max;
            this._sandwichFired = false;
            this._enterState('SANDWICH_TOSS');
            spawnFloatingText('🥪 PORK SANDWICH!', this.x, this.y - 80, '#fbbf24', 28);
            Audio.playBossSpecial();
            return;
        }
        if (this.skills.freeFall.cd <= 0) {
            this.skills.freeFall.cd = this.skills.freeFall.max;
            this._fallTargetX = player.x + (Math.random() - 0.5) * 30;
            this._fallTargetY = player.y + (Math.random() - 0.5) * 30;
            // Spawn warning ring
            window.specialEffects.push(new FreeFallWarningRing(
                this._fallTargetX, this._fallTargetY, this.FREE_FALL_WARN
            ));
            spawnFloatingText('h=½gt² …', this.x, this.y - 80, '#ef4444', 26);
            this._enterState('FREE_FALL');
            return;
        }
        if (this.skills.suvat.cd <= 0 && d > 120) {
            this.skills.suvat.cd = this.skills.suvat.max;
            this._suvatVel = 0;
            this._suvatAimX = player.x;
            this._suvatAimY = player.y;
            spawnFloatingText('v=u+at CHARGE!', this.x, this.y - 80, '#fbbf24', 28);
            this._enterState('SUVAT_CHARGE');
            Audio.playBossSpecial();
            return;
        }
        if (this.skills.orbit.cd <= 0) {
            this.skills.orbit.cd = this.skills.orbit.max;
            this._enterOrbit(player);
            return;
        }
        if (this.skills.rocket.cd <= 0) {
            this.skills.rocket.cd = this.skills.rocket.max;
            this._enterState('ROCKET');
            return;
        }
    }

    _enterOrbit(player) {
        this.skills.orbit.cd = this.skills.orbit.max;
        this._orbitCX = player.x;
        this._orbitCY = player.y;
        this._orbitT = Math.atan2(this.y - player.y, this.x - player.x);
        this._orbitFireCd = 0;
        spawnFloatingText('ω=v/r ORBIT!', this.x, this.y - 80, '#818cf8', 26);
        this._enterState('ORBIT_ATTACK');
        Audio.playBossSpecial();
    }

    takeDamage(amt) {
        if (this.state === 'FREE_FALL' && this.stateTimer < this.FREE_FALL_WARN) return; // invulnerable
        this.hp -= amt;
        this.hitFlashTimer = 0.12;
        spawnParticles(this.x, this.y, 3, '#39ff14');

        // ── Phase transition at 50 % HP — trigger BERSERK with physics taunt ──
        if (!this._halfHpTaunted && this.hp <= this.maxHp * 0.5 && this.hp > 0) {
            this._halfHpTaunted = true;
            const taunts = GAME_TEXTS.boss.firstTaunts;
            const taunt = taunts[Math.floor(Math.random() * taunts.length)];
            spawnFloatingText(`⚛️ ${taunt}`, this.x, this.y - 90, '#39ff14', 28);
            addScreenShake(8);
            this._enterState('BERSERK');
            spawnFloatingText('⚠️ BERSERK MODE!', this.x, this.y - 130, '#ef4444', 32);
        }

        if (this.hp <= 0 && !this._waveSpawnLocked) {
            this._waveSpawnLocked = true;
            this.dead = true; this.hp = 0;
            spawnParticles(this.x, this.y, 60, '#39ff14');
            spawnParticles(this.x, this.y, 30, '#00ffff');
            spawnFloatingText('⚛️ PHYSICS DISMISSED!', this.x, this.y, '#39ff14', 35);
            addScore(BALANCE.score.boss * this.difficulty);
            if (window.UIManager) window.UIManager.updateBossHUD(null);
            Audio.playAchievement();
            for (let i = 0; i < 3; i++) {
                setTimeout(() => window.powerups.push(
                    new PowerUp(this.x + rand(-50, 50), this.y + rand(-50, 50))
                ), i * 200);
            }
            window.lastBossKilled = true;
            window.boss = null;
            Achievements.check('first_down');
            setTimeout(() => {
                setWave(getWave() + 1);
                if (getWave() > BALANCE.waves.maxWaves) window.endGame('victory');
                else if (typeof window.startNextWave === 'function') window.startNextWave();
            }, BALANCE.boss.nextWaveDelay);
        }
    }

    async _speak(context) {
        try {
            const text = await Gemini.getBossTaunt(context);
            if (text && window.UIManager) window.UIManager.showBossSpeech(text);
        } catch (e) {
            console.debug('[BossFirst] Speech unavailable:', e);
        }
    }

    // ─────────────────────────────────────────────────────────
    // DRAW
    // draw() → BossRenderer.drawXxx(e, ctx)  — see bottom of file.

}


// ─── Node/bundler export ──────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Boss, BossDog, BossFirst };
}
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.Boss = Boss;
window.BossDog = BossDog;
window.BossFirst = BossFirst;
// ════════════════════════════════════════════════════════════
// BossRenderer — Canvas draw calls for all boss entities
//
// Owns every ctx.* draw call previously inside each boss class.
// Godot equivalent: AnimatedSprite2D / Node2D children that own
// no game state and are driven by the parent Node's exported vars.
//
// Entry point: BossRenderer.draw(entity, ctx)
//   Dispatches to the correct static method via instanceof.
//   BossFirst is checked first — it extends Entity like Boss does
//   but is a distinct class, so order matters.
// ════════════════════════════════════════════════════════════
class BossRenderer {

    // ── Dispatcher ───────────────────────────────────────────
    // Call this from the game loop instead of boss.draw().
    // BossFirst checked before Boss to avoid false instanceof match
    // if class hierarchy ever changes.
    static draw(e, ctx) {
        if (e instanceof BossFirst) BossRenderer.drawBossFirst(e, ctx);
        else if (e instanceof Boss) BossRenderer.drawBoss(e, ctx);
        else if (e instanceof BossDog) BossRenderer.drawBossDog(e, ctx);
    }

    // ── BossDog — Robotic Combat Hound ───────────────────────
    static drawBossDog(e, ctx) {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  BOSS DOG — Robotic Combat Hound                        ║
        // ║  Wide metallic bean · Spiked collar · 4 floating paws   ║
        // ╚══════════════════════════════════════════════════════════╝
        if (e.dead) return;
        const screen = worldToScreen(e.x, e.y);
        const now = Date.now();
        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

        // ── HP bar (level) ────────────────────────────────────────────
        {
            const barW = 60, barH = 6, pct = Math.max(0, e.hp / e.maxHp);
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(screen.x - barW / 2, screen.y - 46, barW, barH);
            ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';
            ctx.fillRect(screen.x - barW / 2, screen.y - 46, barW * pct, barH);
            ctx.restore();
        }

        // ── Ground shadow ─────────────────────────────────────────────
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.beginPath(); ctx.ellipse(screen.x, screen.y + 20, 32, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // ── Body Block (Body Anti-Flip logic) ─────────────────────────
        ctx.save();
        ctx.translate(screen.x, screen.y);
        if (isFacingLeft) ctx.scale(-1, 1);

        // Heavy breathing — power unit
        const breathe = Math.sin(now / 230);
        ctx.scale(1 + breathe * 0.022, 1 - breathe * 0.022);

        const R = e.radius;

        // ── Four floating robotic paws (cycling with legTimer) ────────
        // Paws bob up/down in alternating pairs like a trotting dog
        const legCycle = e.legTimer;
        const pawR = R * 0.32;
        const pawOffsets = [
            { ox: R * 0.55, oy: R * 0.75, phase: 0 },  // front-right
            { ox: -R * 0.55, oy: R * 0.75, phase: Math.PI }, // back-right
            { ox: R * 0.55, oy: -R * 0.75, phase: Math.PI }, // front-left
            { ox: -R * 0.55, oy: -R * 0.75, phase: 0 },  // back-left
        ];
        for (const pw of pawOffsets) {
            const bob = Math.sin(legCycle * 9 + pw.phase) * 5;
            const px = pw.ox;
            const py = pw.oy + bob;

            // Robotic paw — small rounded rectangle + claws
            ctx.fillStyle = '#374151'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
            ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(220,38,38,0.4)';
            ctx.beginPath(); ctx.roundRect(px - pawR, py - pawR * 0.7, pawR * 2, pawR * 1.4, pawR * 0.4); ctx.fill(); ctx.stroke();
            // Two tiny claw spikes
            ctx.fillStyle = '#1e293b';
            for (let ci = -1; ci <= 1; ci += 2) {
                ctx.beginPath();
                ctx.moveTo(px + ci * pawR * 0.4, py + pawR * 0.7);
                ctx.lineTo(px + ci * pawR * 0.6, py + pawR * 1.3);
                ctx.lineTo(px + ci * pawR * 0.2, py + pawR * 0.7);
                ctx.closePath(); ctx.fill();
            }
            ctx.shadowBlur = 0;
        }

        // ── Main bean body — Sleek White Sci-Fi Chassis ───────────────
        // Horizontal bean: wider X than Y
        ctx.save(); ctx.scale(1.5, 0.90);
        const bodyG = ctx.createRadialGradient(-R * 0.3, -R * 0.3, 1, 0, 0, R);
        bodyG.addColorStop(0, '#ffffff');
        bodyG.addColorStop(0.55, '#e2e8f0');
        bodyG.addColorStop(1, '#94a3b8');
        ctx.fillStyle = bodyG;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore(); // end wide scale

        // Metallic specular stripe
        ctx.fillStyle = 'rgba(255,255,255,0.70)';
        ctx.beginPath(); ctx.ellipse(-R * 0.1, -R * 0.25, R * 0.55, R * 0.20, 0, 0, Math.PI * 2); ctx.fill();

        // ── Spiked collar — ring of sharp triangles around neck area ──
        const collarR = R * 0.68;
        const spikeCount = 8;
        ctx.fillStyle = '#4b5563'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
        // Collar band
        ctx.beginPath(); ctx.arc(0, 0, collarR + 2, -Math.PI * 0.5 - 0.7, Math.PI * 0.5 + 0.7);
        ctx.lineWidth = 6; ctx.strokeStyle = '#374151'; ctx.stroke();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
        // Collar spikes
        for (let i = 0; i < spikeCount; i++) {
            const sa = -Math.PI * 0.55 + (i / (spikeCount - 1)) * Math.PI * 1.1;
            const sInner = collarR - 2;
            const sOuter = collarR + 6;
            const sx = Math.cos(sa);
            const sy = Math.sin(sa);
            ctx.fillStyle = i % 2 === 0 ? '#6b7280' : '#4b5563';
            ctx.beginPath();
            ctx.moveTo(sx * sInner + Math.cos(sa - 0.15) * 0, sy * sInner + Math.sin(sa - 0.15) * 0);
            ctx.lineTo(Math.cos(sa - 0.18) * sInner, Math.sin(sa - 0.18) * sInner);
            ctx.lineTo(sx * sOuter, sy * sOuter);
            ctx.lineTo(Math.cos(sa + 0.18) * sInner, Math.sin(sa + 0.18) * sInner);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }

        // ── Red angular visor eyes (two connected horizontal slits) ───
        const visorA = 0.8 + Math.sin(now / 180) * 0.20;
        ctx.fillStyle = `rgba(220,38,38,${visorA})`;
        ctx.shadowBlur = 14 * visorA; ctx.shadowColor = '#ef4444';
        // Angular visor left slit
        ctx.beginPath();
        ctx.moveTo(R * 0.28, -R * 0.25);
        ctx.lineTo(R * 0.72, -R * 0.15);
        ctx.lineTo(R * 0.68, R * 0.05);
        ctx.lineTo(R * 0.24, R * 0.10);
        ctx.closePath(); ctx.fill();
        // Angular visor right slit (mirrored slightly)
        ctx.beginPath();
        ctx.moveTo(R * 0.28, R * 0.22);
        ctx.lineTo(R * 0.72, R * 0.14);
        ctx.lineTo(R * 0.70, R * 0.38);
        ctx.lineTo(R * 0.26, R * 0.42);
        ctx.closePath(); ctx.fill();
        // Visor glow bleed
        ctx.fillStyle = `rgba(220,38,38,${visorA * 0.15})`;
        ctx.beginPath(); ctx.arc(R * 0.52, R * 0.1, R * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // ── Back tail (angular robotic fin) ───────────────────────────
        ctx.fillStyle = '#374151'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
        const tailWag = Math.sin(now / 90) * 8;
        ctx.beginPath();
        ctx.moveTo(-R * 1.4, -R * 0.2);
        ctx.lineTo(-R * 2.0, -R * 0.6 + tailWag * 0.05);
        ctx.lineTo(-R * 2.1, R * 0.2 + tailWag * 0.08);
        ctx.lineTo(-R * 1.4, R * 0.2);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        // ── Heat vent dots on body ────────────────────────────────────
        const ventA = 0.4 + Math.sin(now / 190) * 0.35;
        ctx.fillStyle = `rgba(251,146,60,${ventA})`;
        ctx.shadowBlur = 6; ctx.shadowColor = '#fb923c';
        for (let vi = 0; vi < 3; vi++) {
            ctx.beginPath(); ctx.arc(-R * 0.15 + vi * R * 0.18, R * 0.55, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;

        ctx.restore(); // end body transform
    }

    // ── Boss (ครูมานพ) — Physics Teacher ─────────────────────
    static drawBoss(e, ctx) {
        // ╔══════════════════════════════════════════════════════════╗
        // ║  KRU MANOP — The Math Boss · Chibi Strict Teacher       ║
        // ║  Dark-grey bean · Suit+tie · Glowing glasses · Ruler    ║
        // ╚══════════════════════════════════════════════════════════╝
        const screen = worldToScreen(e.x, e.y);
        const now = Date.now();
        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;

        ctx.save();
        ctx.translate(screen.x, screen.y);

        // ── Charging scale pulse (log457) ─────────────────────────────
        if (e.log457State === 'charging') {
            const sc = 1 + (e.log457Timer / 2) * 0.3;
            ctx.scale(sc, sc);
            const pu = Math.sin(e.log457Timer * 10) * 0.5 + 0.5;
            ctx.shadowBlur = 30 * pu; ctx.shadowColor = '#ef4444';
            ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(239,68,68,${pu * 0.25})`; ctx.fill();
            ctx.shadowBlur = 0;
        }
        if (e.log457State === 'active') {
            ctx.shadowBlur = 22; ctx.shadowColor = '#facc15';
        }
        if (e.log457State === 'stunned') {
            ctx.font = 'bold 30px Arial'; ctx.textAlign = 'center'; ctx.fillText('😵', 0, -78);
        }
        if (e.state === 'ULTIMATE') {
            const ult = Math.abs(Math.sin(now / 80));
            ctx.strokeStyle = `rgba(239,68,68,${ult})`; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke();
        }

        // ── Enhanced Power Aura (Phase-based) ────────────────────────
        const t3 = now / 600;
        const auraR = 80 + Math.sin(t3 * 2.5) * 10;

        if (e.phase === 1) {
            // Phase 1: Golden mathematical aura
            ctx.shadowBlur = 0;
            const grad1 = ctx.createRadialGradient(0, 0, auraR * 0.4, 0, 0, auraR);
            grad1.addColorStop(0, 'rgba(251,191,36,0.0)');
            grad1.addColorStop(0.7, 'rgba(251,191,36,0.15)');
            grad1.addColorStop(1, 'rgba(251,191,36,0.35)');
            ctx.fillStyle = grad1;
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(252,211,77,${0.45 + Math.sin(t3 * 3) * 0.25})`;
            ctx.lineWidth = 2.5; ctx.shadowBlur = 18; ctx.shadowColor = '#fbbf24';
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            for (let i = 0; i < 4; i++) {
                const bA = t3 * 1.5 + i * (Math.PI * 2 / 4);
                ctx.fillStyle = `rgba(254,240,138,${0.35 + Math.sin(t3 + i) * 0.25})`;
                ctx.shadowBlur = 8; ctx.shadowColor = '#fbbf24';
                ctx.beginPath(); ctx.arc(Math.cos(bA) * (auraR - 8), Math.sin(bA) * (auraR - 8), 4 + Math.sin(t3 * 2 + i) * 1.5, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
        } else if (e.phase === 2) {
            // Phase 2: Red enraged aura with energy crackling
            ctx.shadowBlur = 0;
            const grad2 = ctx.createRadialGradient(0, 0, auraR * 0.4, 0, 0, auraR);
            grad2.addColorStop(0, 'rgba(239,68,68,0.0)');
            grad2.addColorStop(0.7, 'rgba(239,68,68,0.20)');
            grad2.addColorStop(1, 'rgba(239,68,68,0.50)');
            ctx.fillStyle = grad2;
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(248,113,113,${0.55 + Math.sin(t3 * 4) * 0.35})`;
            ctx.lineWidth = 3; ctx.shadowBlur = 22; ctx.shadowColor = '#ef4444';
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.stroke();
            // Inner pulsing ring
            ctx.strokeStyle = `rgba(220,38,38,${0.40 + Math.sin(t3 * 5) * 0.30})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0, 0, auraR * 0.70, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            for (let i = 0; i < 6; i++) {
                const bA = t3 * 2.2 + i * (Math.PI * 2 / 6);
                ctx.fillStyle = `rgba(252,165,165,${0.40 + Math.sin(t3 * 1.5 + i) * 0.30})`;
                ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.arc(Math.cos(bA) * (auraR - 6), Math.sin(bA) * (auraR - 6), 5 + Math.sin(t3 * 3 + i) * 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.shadowBlur = 0;
        } else if (e.phase === 3) {
            // Phase 3: Cyan water aura
            ctx.shadowBlur = 0;
            const grad3 = ctx.createRadialGradient(0, 0, auraR * 0.4, 0, 0, auraR);
            grad3.addColorStop(0, 'rgba(56,189,248,0.0)');
            grad3.addColorStop(0.7, 'rgba(56,189,248,0.18)');
            grad3.addColorStop(1, 'rgba(56,189,248,0.45)');
            ctx.fillStyle = grad3;
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(125,211,252,${0.5 + Math.sin(t3 * 3) * 0.3})`;
            ctx.lineWidth = 3; ctx.shadowBlur = 20; ctx.shadowColor = '#38bdf8';
            ctx.beginPath(); ctx.arc(0, 0, auraR, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            for (let i = 0; i < 5; i++) {
                const bA = t3 * 1.8 + i * (Math.PI * 2 / 5);
                ctx.fillStyle = `rgba(186,230,253,${0.4 + Math.sin(t3 + i) * 0.3})`;
                ctx.beginPath(); ctx.arc(Math.cos(bA) * (auraR - 10), Math.sin(bA) * (auraR - 10), 5 + Math.sin(t3 * 2 + i) * 2, 0, Math.PI * 2); ctx.fill();
            }
        }

        // ── Orbiting Math Symbols ─────────────────────────────────────
        // π, Σ, ∞, ∂, ≈ orbit at varying radii and speeds, glowing white/gold
        const symbols = ['π', 'Σ', '∞', '∂', '≈', '∫'];
        const orbitR = 62;
        const baseSpeed = e.isEnraged ? 1.8 : 1.0;
        ctx.save();
        for (let i = 0; i < symbols.length; i++) {
            const angle = (now / 1000) * baseSpeed + (i / symbols.length) * Math.PI * 2;
            const ox = Math.cos(angle) * orbitR;
            const oy = Math.sin(angle) * (orbitR * 0.55); // elliptical orbit
            const alpha = 0.55 + Math.sin(now / 300 + i * 1.2) * 0.35;
            const gCol = e.phase === 3 ? '#38bdf8'
                : e.isEnraged ? '#ef4444'
                    : '#facc15';
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(-e.angle); // keep text readable
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${14 + Math.sin(now / 400 + i) * 2}px Arial`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 12 + Math.sin(now / 250 + i) * 5;
            ctx.shadowColor = gCol;
            ctx.fillStyle = gCol;
            ctx.fillText(symbols[i], 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.restore();

        // ── Body Block (Body Anti-Flip) ───────────────────────────────
        ctx.save();
        if (isFacingLeft) ctx.scale(-1, 1);

        // Boss breathing
        const breathe = Math.sin(now / 260);
        const scaleX = 1 + breathe * 0.018;
        const scaleY = 1 - breathe * 0.022;
        ctx.scale(scaleX, scaleY);

        const R = BALANCE.boss.radius;

        // ── Phase 2 enrage glow ring ──────────────────────────────────
        if (e.phase === 2 && e.log457State !== 'charging') {
            ctx.shadowBlur = 22; ctx.shadowColor = '#ef4444';
            ctx.strokeStyle = 'rgba(220,38,38,0.55)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, R + 5, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // ── Silhouette glow ring ──────────────────────────────────────
        const glowCol = e.phase === 3 ? 'rgba(56,189,248,0.50)'
            : e.isEnraged ? 'rgba(220,38,38,0.55)'
                : 'rgba(148,163,184,0.40)';
        const shadowC = e.phase === 3 ? '#38bdf8'
            : e.isEnraged ? '#ef4444' : '#94a3b8';
        ctx.shadowBlur = 16; ctx.shadowColor = shadowC;
        ctx.strokeStyle = glowCol; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // ── Bean body — tall dark-grey gradient (slightly taller) ─────
        ctx.save(); ctx.scale(0.92, 1.12); // tall bean
        const bodyG = ctx.createRadialGradient(-R * 0.25, -R * 0.30, 1, 0, 0, R);
        bodyG.addColorStop(0, '#374151');
        bodyG.addColorStop(0.55, '#1f2937');
        bodyG.addColorStop(1, '#111827');
        ctx.fillStyle = bodyG;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore(); // end tall scale

        // Specular highlight
        ctx.fillStyle = 'rgba(255,255,255,0.09)';
        ctx.beginPath(); ctx.arc(-R * 0.3, -R * 0.32, R * 0.28, 0, Math.PI * 2); ctx.fill();

        // ── Suit jacket (dark navy vest panels) ──────────────────────
        // Left lapel
        ctx.fillStyle = '#1e2d40';
        ctx.beginPath();
        ctx.moveTo(-R * 0.08, -R * 0.48);
        ctx.lineTo(-R * 0.55, -R * 0.15);
        ctx.lineTo(-R * 0.52, R * 0.50);
        ctx.lineTo(-R * 0.05, R * 0.52);
        ctx.closePath(); ctx.fill();
        // Right lapel
        ctx.beginPath();
        ctx.moveTo(R * 0.08, -R * 0.48);
        ctx.lineTo(R * 0.55, -R * 0.15);
        ctx.lineTo(R * 0.52, R * 0.50);
        ctx.lineTo(R * 0.05, R * 0.52);
        ctx.closePath(); ctx.fill();

        // Jacket sticker outlines
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-R * 0.08, -R * 0.48); ctx.lineTo(-R * 0.55, -R * 0.15); ctx.lineTo(-R * 0.52, R * 0.50);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(R * 0.08, -R * 0.48); ctx.lineTo(R * 0.55, -R * 0.15); ctx.lineTo(R * 0.52, R * 0.50);
        ctx.stroke();

        // Suit buttons — 3 small dark dots down centre seam
        ctx.fillStyle = '#111827';
        for (let bi = 0; bi < 3; bi++) {
            ctx.beginPath(); ctx.arc(0, -R * 0.1 + bi * R * 0.25, 2, 0, Math.PI * 2); ctx.fill();
        }

        // ── Red necktie — diamond/wedge down the centre chest ────────
        const tieCol = e.isEnraged ? '#ef4444' : '#dc2626';
        const tieGlow = e.isEnraged ? 0.55 : 0;
        ctx.fillStyle = tieCol;
        ctx.shadowBlur = 8 * (tieGlow + 0.2); ctx.shadowColor = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.48);       // knot top
        ctx.lineTo(R * 0.10, -R * 0.30);
        ctx.lineTo(R * 0.07, R * 0.48); // tip
        ctx.lineTo(0, R * 0.55);
        ctx.lineTo(-R * 0.07, R * 0.48);
        ctx.lineTo(-R * 0.10, -R * 0.30);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.48); ctx.lineTo(R * 0.10, -R * 0.30);
        ctx.lineTo(R * 0.07, R * 0.48); ctx.lineTo(0, R * 0.55);
        ctx.lineTo(-R * 0.07, R * 0.48); ctx.lineTo(-R * 0.10, -R * 0.30);
        ctx.closePath(); ctx.stroke();
        ctx.shadowBlur = 0;

        // Tie knot
        ctx.fillStyle = e.isEnraged ? '#b91c1c' : '#991b1b';
        ctx.beginPath(); ctx.ellipse(0, -R * 0.42, R * 0.09, R * 0.06, 0, 0, Math.PI * 2); ctx.fill();

        // ── Neat Combed Hair (covers upper ~50% of bean) ──────────────
        ctx.fillStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(-R * 0.88, -R * 0.04);
        ctx.quadraticCurveTo(-R * 1.05, -R * 0.65, -R * 0.42, -R - 6);
        ctx.quadraticCurveTo(0, -R - 9, R * 0.42, -R - 6);
        ctx.quadraticCurveTo(R * 1.05, -R * 0.65, R * 0.88, -R * 0.04);
        ctx.quadraticCurveTo(R * 0.50, R * 0.04, 0, R * 0.05);
        ctx.quadraticCurveTo(-R * 0.50, R * 0.04, -R * 0.88, -R * 0.04);
        ctx.closePath(); ctx.fill();

        // Hair sticker outline
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-R * 0.88, -R * 0.04);
        ctx.quadraticCurveTo(-R * 1.05, -R * 0.65, -R * 0.42, -R - 6);
        ctx.quadraticCurveTo(0, -R - 9, R * 0.42, -R - 6);
        ctx.quadraticCurveTo(R * 1.05, -R * 0.65, R * 0.88, -R * 0.04);
        ctx.closePath(); ctx.stroke();

        // Strict centre parting
        ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.05);
        ctx.quadraticCurveTo(R * 0.04, -R * 0.50, 0, -R - 8);
        ctx.stroke();

        // Hair highlight (glossy strand)
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.moveTo(-R * 0.32, -R * 0.55);
        ctx.quadraticCurveTo(-R * 0.48, -R, -R * 0.22, -R - 6);
        ctx.quadraticCurveTo(-R * 0.10, -R - 2, -R * 0.18, -R * 0.48);
        ctx.quadraticCurveTo(-R * 0.22, -R * 0.28, -R * 0.32, -R * 0.55);
        ctx.closePath(); ctx.fill();

        // ── Glowing Square-Framed Glasses ────────────────────────────
        // Two square lens frames side-by-side across the "face zone"
        const glassGlow = e.isEnraged ? '#ef4444' : '#e0f2fe';
        const glassRefl = e.log457State === 'active' ? '#facc15' : '#e0f2fe';
        const lensW = R * 0.38, lensH = R * 0.28;
        const lensY = -R * 0.28;

        // Left lens
        ctx.shadowBlur = 14; ctx.shadowColor = glassGlow;
        ctx.fillStyle = `rgba(224,242,254,0.20)`;
        ctx.strokeStyle = glassGlow; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.roundRect(-R * 0.72, lensY - lensH / 2, lensW, lensH, 3); ctx.fill(); ctx.stroke();
        // Right lens
        ctx.beginPath(); ctx.roundRect(R * 0.34, lensY - lensH / 2, lensW, lensH, 3); ctx.fill(); ctx.stroke();
        // Bridge connecting lenses
        ctx.strokeStyle = glassGlow; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-R * 0.34, lensY); ctx.lineTo(R * 0.34, lensY); ctx.stroke();
        // Temple arms (go to sides)
        ctx.beginPath(); ctx.moveTo(-R * 0.72, lensY); ctx.lineTo(-R * 1.0, lensY + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R * 0.72, lensY); ctx.lineTo(R * 1.0, lensY + 2); ctx.stroke();

        // Lens reflections — bright diagonal highlight inside each lens
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,255,255,${0.55 + Math.sin(now / 280) * 0.30})`;
        // Left lens reflection
        ctx.beginPath(); ctx.ellipse(-R * 0.56, lensY - R * 0.06, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); ctx.fill();
        // Right lens reflection
        ctx.beginPath(); ctx.ellipse(R * 0.50, lensY - R * 0.06, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); ctx.fill();

        // ── Enraged phase fire particles (preserved) ──────────────────
        if (e.isEnraged) {
            const t = now / 80;
            const colA = e.phase === 3 ? '#fb923c' : '#ef4444';
            const colB = e.phase === 3 ? '#38bdf8' : '#f97316';
            for (let i = 0; i < 4; i++) {
                const px = Math.sin(t * 0.9 + i * 1.57) * 18;
                const py = -Math.abs(Math.cos(t * 1.1 + i * 1.57)) * 22 - 30;
                const ps = 3 + Math.sin(t + i) * 1.5;
                ctx.globalAlpha = 0.55 + Math.sin(t + i) * 0.3;
                ctx.fillStyle = i % 2 === 0 ? colA : colB;
                ctx.shadowBlur = 8; ctx.shadowColor = colA;
                ctx.beginPath(); ctx.arc(px, py, ps, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }

        ctx.restore(); // end body block

        // ── Weapon Block (Weapon Anti-Flip) ───────────────────────────
        ctx.save();
        ctx.rotate(e.angle);
        if (isFacingLeft) ctx.scale(1, -1);

        // ── Floating Hands — holding a glowing ruler / chalk ─────────
        // Front hand — holding ruler, forward weapon side
        ctx.fillStyle = '#2d3748'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(148,163,184,0.6)';
        ctx.beginPath(); ctx.arc(R + 7, 4, R * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // Ruler extending from front hand
        const rulerGlow = e.state === 'ATTACK' || e.state === 'ULTIMATE' ? 1.0 : 0.55;
        ctx.fillStyle = '#f59e0b';
        ctx.shadowBlur = 12 * rulerGlow; ctx.shadowColor = '#fbbf24';
        ctx.beginPath(); ctx.roundRect(R + 9, 1, R * 1.6, R * 0.22, 2); ctx.fill();
        // Ruler tick marks
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
        for (let ti = 0; ti < 5; ti++) {
            const tx = R + 11 + ti * (R * 1.5 / 5);
            ctx.beginPath(); ctx.moveTo(tx, 1); ctx.lineTo(tx, 5); ctx.stroke();
        }
        ctx.fillStyle = '#000'; ctx.font = `bold ${R * 0.16}px Arial`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('30cm', R + 9 + R * 0.8, R * 0.11 + 2);
        ctx.shadowBlur = 0;

        // Back hand — off-side, open palm
        ctx.fillStyle = '#374151'; ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2.5;
        ctx.shadowBlur = 4; ctx.shadowColor = 'rgba(148,163,184,0.5)';
        ctx.beginPath(); ctx.arc(-(R + 7), 2, R * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.restore(); // end weapon block

        ctx.restore(); // end main translate
    }

    // ── BossFirst (ครูเฟิร์ส) — Physics Master ───────────────
    static drawBossFirst(e, ctx) {
        // ╔══════════════════════════════════════════════════════════════╗
        // ║  KRU FIRST — Physics Master                                 ║
        // ║  Agile chibi teacher · Jetpack · Holographic equation ring  ║
        // ║  Cyan science goggles · Neon-green tech vest · Hit-flash    ║
        // ╚══════════════════════════════════════════════════════════════╝

        // ── Draw active sandwich BEFORE the boss body (world space) ────
        if (e._activeSandwich && !e._activeSandwich.dead) {
            e._activeSandwich.draw();
        }

        // ── FREE_FALL invisible phase ───────────────────────────────────
        if (e.state === 'FREE_FALL' && e.stateTimer > 0.12) return;

        // ── Core setup ─────────────────────────────────────────────────
        const screen = worldToScreen(e.x, e.y);
        const now = performance.now();
        const t = now / 1000;

        const isFacingLeft = Math.abs(e.angle) > Math.PI / 2;
        const R = e.radius;

        // ── Hover animation ────────────────────────────────────────────
        const hoverY = Math.sin(now / 150) * 4;
        const hoverX = Math.sin(now / 230) * 1.2;

        ctx.save();
        ctx.translate(screen.x + hoverX, screen.y + hoverY);

        // ── LAYER 0 — Ground shadow ─────────────────────────────────────
        ctx.save();
        ctx.globalAlpha = 0.22 - Math.abs(hoverY) * 0.012;
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.beginPath();
        ctx.ellipse(0, R * 1.25 - hoverY * 0.4, R * 1.05, R * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ── LAYER 1 — Berserk aura ──────────────────────────────────────
        if (e.isEnraged) {
            ctx.save();
            const berserkT = t * 3.5;
            const berserkR = R * 1.85 + Math.sin(berserkT) * R * 0.18;
            const bAlpha = 0.22 + Math.sin(berserkT * 1.3) * 0.12;
            const bGrad = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, berserkR);
            bGrad.addColorStop(0, 'rgba(239,68,68,0)');
            bGrad.addColorStop(0.65, `rgba(239,68,68,${bAlpha})`);
            bGrad.addColorStop(1, `rgba(220,38,38,${bAlpha * 1.6})`);
            ctx.fillStyle = bGrad;
            ctx.beginPath(); ctx.arc(0, 0, berserkR, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 24; ctx.shadowColor = '#ef4444';
            ctx.strokeStyle = `rgba(239,68,68,${0.55 + Math.sin(berserkT * 2.1) * 0.35})`;
            ctx.lineWidth = 2.8;
            ctx.beginPath(); ctx.arc(0, 0, berserkR * 0.96, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            for (let fi = 0; fi < 6; fi++) {
                const fa = (fi / 6) * Math.PI * 2 + t * 1.8;
                const fBob = Math.sin(t * 4.2 + fi * 1.1) * R * 0.25;
                const fx1 = Math.cos(fa) * berserkR * 0.82;
                const fy1 = Math.sin(fa) * berserkR * 0.82;
                const fx2 = Math.cos(fa) * (berserkR + R * 0.38 + fBob);
                const fy2 = Math.sin(fa) * (berserkR + R * 0.38 + fBob);
                ctx.globalAlpha = 0.35 + Math.sin(t * 3.5 + fi) * 0.25;
                ctx.strokeStyle = fi % 2 === 0 ? '#ef4444' : '#fb923c';
                ctx.lineWidth = 2 + Math.sin(t * 5 + fi) * 1.0;
                ctx.lineCap = 'round';
                ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.moveTo(fx1, fy1); ctx.lineTo(fx2, fy2); ctx.stroke();
            }
            ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.lineCap = 'butt';
            ctx.restore();
        }

        // ── LAYER 2 — Holographic equation ring ────────────────────────
        ctx.save();
        const ringR = R * 2.0;
        const ringCol = e.isEnraged ? '#ff4444' : '#39ff14';
        const ringGlow = e.isEnraged ? '#dc2626' : '#16a34a';

        // Outer ring
        ctx.save();
        ctx.rotate(t * 0.9);
        ctx.shadowBlur = 12; ctx.shadowColor = ringGlow;
        ctx.strokeStyle = `${ringCol}99`; ctx.lineWidth = 1.8;
        ctx.setLineDash([8, 5]);
        ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        for (let ti = 0; ti < 12; ti++) {
            const ta = (ti / 12) * Math.PI * 2;
            const tLen = ti % 3 === 0 ? R * 0.18 : R * 0.09;
            ctx.strokeStyle = ti % 3 === 0 ? ringCol : `${ringCol}77`;
            ctx.lineWidth = ti % 3 === 0 ? 2.2 : 1.2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ta) * (ringR - tLen), Math.sin(ta) * (ringR - tLen));
            ctx.lineTo(Math.cos(ta) * ringR, Math.sin(ta) * ringR);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.restore();

        // Inner counter-rotating ring
        ctx.save();
        ctx.rotate(-(t * 0.55));
        ctx.shadowBlur = 8; ctx.shadowColor = ringGlow;
        ctx.strokeStyle = `${ringCol}55`; ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(0, 0, ringR * 0.72, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Orbiting formula labels
        const formulas = ['F=ma', 'v=u+at', 'E=mc²', 'p=mv', 'ω=v/r', 'h=½gt²'];
        const fOrbitR = ringR * 0.88;
        const fSpeed = e.isEnraged ? 1.35 : 0.72;
        for (let fi = 0; fi < formulas.length; fi++) {
            const fAngle = t * fSpeed + (fi / formulas.length) * Math.PI * 2;
            const fAlpha = 0.45 + Math.sin(t * 1.8 + fi * 0.9) * 0.30;
            ctx.save();
            ctx.translate(
                Math.cos(fAngle) * fOrbitR,
                Math.sin(fAngle) * fOrbitR * 0.55
            );
            ctx.rotate(-fAngle * 0.18);
            ctx.globalAlpha = fAlpha;
            ctx.font = `bold ${10 + Math.sin(t * 1.5 + fi) * 1.5}px "Orbitron",monospace,Arial`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowBlur = 10 + Math.sin(t * 2.2 + fi) * 5;
            ctx.shadowColor = ringGlow;
            ctx.fillStyle = ringCol;
            ctx.fillText(formulas[fi], 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.restore();

        // ── LAYER 3 — SUVAT charge ring ─────────────────────────────────
        if (e.state === 'SUVAT_CHARGE' && e.stateTimer <= e.SUVAT_WIND_UP) {
            ctx.save();
            const prog = Math.min(e.stateTimer / e.SUVAT_WIND_UP, 1);
            const cRingR = R * (1.15 + prog * 0.65);
            const pulse = Math.abs(Math.sin(now / 55));
            const cGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, cRingR);
            cGrad.addColorStop(0, `rgba(251,191,36,${prog * 0.18})`);
            cGrad.addColorStop(0.7, `rgba(251,191,36,${prog * 0.08})`);
            cGrad.addColorStop(1, 'rgba(251,191,36,0)');
            ctx.shadowBlur = 28 * prog; ctx.shadowColor = '#fbbf24';
            ctx.fillStyle = cGrad;
            ctx.beginPath(); ctx.arc(0, 0, cRingR, 0, Math.PI * 2); ctx.fill();
            ctx.rotate(t * 5.5);
            ctx.strokeStyle = `rgba(251,191,36,${0.5 + pulse * 0.45})`;
            ctx.lineWidth = 3.5 * prog;
            ctx.setLineDash([10, 6]);
            ctx.beginPath(); ctx.arc(0, 0, cRingR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;

            // ── Laser telegraph ──
            const aimScreen = worldToScreen(e._suvatAimX, e._suvatAimY);
            ctx.strokeStyle = `rgba(239, 68, 68, ${prog})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([15, 10]);
            ctx.beginPath();
            ctx.moveTo(0, 0); // Boss local center
            ctx.lineTo(aimScreen.x - (screen.x + hoverX), aimScreen.y - (screen.y + hoverY));
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.restore();
        }

        // ── BODY BLOCK (facing flip + breathe) ─────────────────────────
        ctx.save();
        if (isFacingLeft) ctx.scale(-1, 1);
        const breathe = Math.sin(now / 195);
        ctx.scale(1 + breathe * 0.022, 1 - breathe * 0.016);

        // ── LAYER 4 — Jetpack ───────────────────────────────────────────
        ctx.save();
        const jpX = -R * 0.72, jpY = -R * 0.12;
        const jpW = R * 0.55, jpH = R * 1.10;
        ctx.shadowBlur = 8; ctx.shadowColor = '#0e7490';
        const jpGrad = ctx.createLinearGradient(jpX - jpW / 2, 0, jpX + jpW / 2, 0);
        jpGrad.addColorStop(0, '#0f172a');
        jpGrad.addColorStop(0.4, '#1e293b');
        jpGrad.addColorStop(1, '#0f172a');
        ctx.fillStyle = jpGrad;
        ctx.beginPath(); ctx.roundRect(jpX - jpW / 2, jpY - jpH / 2, jpW, jpH, R * 0.14); ctx.fill();
        ctx.strokeStyle = '#0ea5e9'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(jpX - jpW / 2, jpY - jpH / 2, jpW, jpH, R * 0.14); ctx.stroke();
        ctx.shadowBlur = 0;
        // Panel rivets
        ctx.fillStyle = '#334155';
        for (let ri = 0; ri < 2; ri++) for (let rj = 0; rj < 2; rj++) {
            ctx.beginPath();
            ctx.arc(jpX - jpW * 0.28 + ri * jpW * 0.56, jpY - jpH * 0.35 + rj * jpH * 0.70, 2.2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Energy cell
        const cellAlpha = 0.7 + Math.sin(t * 2.8) * 0.25;
        ctx.shadowBlur = 14; ctx.shadowColor = '#00ffff';
        ctx.fillStyle = `rgba(0,255,255,${cellAlpha * 0.55})`;
        ctx.beginPath(); ctx.roundRect(jpX - jpW * 0.22, jpY - jpH * 0.18, jpW * 0.44, jpH * 0.36, 3); ctx.fill();
        ctx.strokeStyle = `rgba(0,255,255,${cellAlpha})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(jpX - jpW * 0.22, jpY - jpH * 0.18, jpW * 0.44, jpH * 0.36, 3); ctx.stroke();
        ctx.shadowBlur = 0;
        // Nozzle flames
        const nozzleOffsets = [-jpW * 0.22, jpW * 0.22];
        for (let ni = 0; ni < 2; ni++) {
            const nx = jpX + nozzleOffsets[ni], ny = jpY + jpH / 2;
            const nW = jpW * 0.22, nH = R * 0.20;
            ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#475569'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(nx - nW * 0.6, ny); ctx.lineTo(nx - nW * 0.85, ny + nH);
            ctx.lineTo(nx + nW * 0.85, ny + nH); ctx.lineTo(nx + nW * 0.6, ny);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.shadowBlur = 10; ctx.shadowColor = '#00ffff';
            ctx.strokeStyle = 'rgba(0,255,255,0.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(nx, ny + 2, nW * 0.55, nW * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.shadowBlur = 0;
            // Outer flame — ENHANCED intensity
            const flameBoost = e.isEnraged ? 1.5 : 1.0;
            const flameLen = R * (0.70 + Math.sin(t * 8.5 + ni * 2.1) * 0.30 + Math.random() * 0.18) * flameBoost;
            const flameW = nW * (0.70 + Math.sin(t * 11.2 + ni * 1.7) * 0.25) * flameBoost;
            const fJitter = (Math.random() - 0.5) * 7;
            ctx.save();
            ctx.shadowBlur = e.isEnraged ? 35 : 28;
            ctx.shadowColor = e.isEnraged ? '#ef4444' : '#3b82f6';
            ctx.globalAlpha = 0.70 + Math.sin(t * 7.1 + ni) * 0.25;
            ctx.fillStyle = e.isEnraged ? '#ef4444' : '#3b82f6';
            ctx.beginPath();
            ctx.moveTo(nx - flameW * 1.3, ny + nH);
            ctx.quadraticCurveTo(nx + fJitter * 0.5, ny + nH + flameLen * 0.55, nx, ny + nH + flameLen * 1.7);
            ctx.quadraticCurveTo(nx + fJitter * 0.3, ny + nH + flameLen * 0.55, nx + flameW * 1.3, ny + nH);
            ctx.closePath(); ctx.fill();
            ctx.restore();
            // Cyan mid flame — ENHANCED
            ctx.save();
            const cLen = flameLen * 0.85, cW = flameW * 0.75;
            ctx.shadowBlur = e.isEnraged ? 24 : 20;
            ctx.shadowColor = e.isEnraged ? '#fb923c' : '#00ffff';
            ctx.globalAlpha = 0.75 + Math.sin(t * 9.3 + ni * 1.3) * 0.20;
            ctx.fillStyle = e.isEnraged ? '#fb923c' : '#00e5ff';
            ctx.beginPath();
            ctx.moveTo(nx - cW, ny + nH);
            ctx.quadraticCurveTo(nx, ny + nH + cLen * 0.5, nx, ny + nH + cLen * 1.25);
            ctx.quadraticCurveTo(nx, ny + nH + cLen * 0.5, nx + cW, ny + nH);
            ctx.closePath(); ctx.fill();
            ctx.restore();
            // White-hot core
            ctx.save();
            const wLen = flameLen * 0.45, wW = flameW * 0.28;
            ctx.shadowBlur = 14; ctx.shadowColor = '#ffffff';
            ctx.globalAlpha = 0.85 + Math.sin(t * 13 + ni) * 0.12;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(nx - wW, ny + nH);
            ctx.quadraticCurveTo(nx, ny + nH + wLen * 0.4, nx, ny + nH + wLen);
            ctx.quadraticCurveTo(nx, ny + nH + wLen * 0.4, nx + wW, ny + nH);
            ctx.closePath(); ctx.fill();
            ctx.restore();
        }
        ctx.restore(); // end jetpack

        // ── LAYER 5 — Silhouette glow ring ─────────────────────────────
        const mainCol = e.isEnraged ? '#ef4444' : '#39ff14';
        const glowShadow = e.isEnraged ? '#dc2626' : '#16a34a';
        ctx.shadowBlur = 18; ctx.shadowColor = glowShadow;
        ctx.strokeStyle = `${mainCol}66`; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.arc(0, 0, R + 4, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;

        // ── LAYER 6 — Bean body ─────────────────────────────────────────
        ctx.save(); ctx.scale(0.90, 1.10);
        const bodyDark = e.isEnraged ? '#2d0a0a' : '#0a1a08';
        const bodyMid = e.isEnraged ? '#3f0e0e' : '#0f2d0c';
        const bodyG = ctx.createRadialGradient(-R * 0.22, -R * 0.25, 1, 0, 0, R);
        bodyG.addColorStop(0, bodyDark);
        bodyG.addColorStop(0.5, bodyMid);
        bodyG.addColorStop(1, '#050c04');
        ctx.fillStyle = bodyG;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0a1a08'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        // ── LAYER 7 — Khaki uniform + dark-grey tech vest ──────────────
        ctx.fillStyle = '#d4b886';
        ctx.beginPath();
        ctx.moveTo(-R * 0.85, -R * 0.42);
        ctx.quadraticCurveTo(-R * 1.0, -R * 0.12, -R * 0.88, R * 0.18);
        ctx.lineTo(-R * 0.62, R * 0.22); ctx.lineTo(-R * 0.58, -R * 0.46);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(R * 0.85, -R * 0.42);
        ctx.quadraticCurveTo(R * 1.0, -R * 0.12, R * 0.88, R * 0.18);
        ctx.lineTo(R * 0.62, R * 0.22); ctx.lineTo(R * 0.58, -R * 0.46);
        ctx.closePath(); ctx.fill();
        // Tech vest panels
        ctx.fillStyle = '#1c2533';
        ctx.beginPath();
        ctx.moveTo(-R * 0.08, -R * 0.52); ctx.lineTo(-R * 0.58, -R * 0.18);
        ctx.lineTo(-R * 0.55, R * 0.52); ctx.lineTo(-R * 0.06, R * 0.54);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(R * 0.08, -R * 0.52); ctx.lineTo(R * 0.58, -R * 0.18);
        ctx.lineTo(R * 0.55, R * 0.52); ctx.lineTo(R * 0.06, R * 0.54);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-R * 0.08, -R * 0.52); ctx.lineTo(-R * 0.58, -R * 0.18); ctx.lineTo(-R * 0.55, R * 0.52);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(R * 0.08, -R * 0.52); ctx.lineTo(R * 0.58, -R * 0.18); ctx.lineTo(R * 0.55, R * 0.52);
        ctx.stroke();
        // Chest stripe — enhanced glow
        const stripeCol = e.isEnraged ? '#ef4444' : '#39ff14';
        ctx.shadowBlur = e.isEnraged ? 12 : 10; ctx.shadowColor = stripeCol; ctx.fillStyle = stripeCol;
        ctx.beginPath();
        ctx.moveTo(-R * 0.44, -R * 0.56); ctx.lineTo(-R * 0.10, -R * 0.56);
        ctx.lineTo(R * 0.44, R * 0.56); ctx.lineTo(R * 0.10, R * 0.56);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        // Pocket
        ctx.fillStyle = '#263348';
        ctx.beginPath(); ctx.roundRect(-R * 0.50, R * 0.06, R * 0.30, R * 0.26, 3); ctx.fill();
        ctx.strokeStyle = '#39ff1444'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(-R * 0.50, R * 0.06, R * 0.30, R * 0.26, 3); ctx.stroke();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-R * 0.50, R * 0.14); ctx.lineTo(-R * 0.20, R * 0.14); ctx.stroke();
        // Belt
        ctx.fillStyle = '#111827'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, R * 0.52, R * 0.72, R * 0.12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#39ff1488'; ctx.shadowBlur = 8; ctx.shadowColor = '#39ff14';
        ctx.beginPath(); ctx.roundRect(-R * 0.10, R * 0.44, R * 0.20, R * 0.16, 2); ctx.fill();
        ctx.shadowBlur = 0;

        // ── LAYER 8 — Head ──────────────────────────────────────────────
        ctx.fillStyle = '#c8956c';
        ctx.beginPath();
        ctx.arc(0, -R * 0.32, R * 0.50, Math.PI * 0.08, Math.PI * 0.92, false);
        ctx.quadraticCurveTo(0, R * 0.05, -R * 0.46, -R * 0.06);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(230,150,100,0.35)';
        ctx.beginPath(); ctx.ellipse(-R * 0.24, -R * 0.22, R * 0.15, R * 0.10, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(R * 0.24, -R * 0.22, R * 0.15, R * 0.10, -0.3, 0, Math.PI * 2); ctx.fill();
        // Wild spiky hair
        ctx.fillStyle = '#1c1008'; ctx.strokeStyle = '#0f0905'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-R * 0.88, -R * 0.15);
        ctx.quadraticCurveTo(-R * 1.05, -R * 0.62, -R * 0.50, -R * 0.98);
        ctx.quadraticCurveTo(-R * 0.18, -R * 1.18, R * 0.18, -R * 1.18);
        ctx.quadraticCurveTo(R * 0.50, -R * 0.98, R * 1.05, -R * 0.62);
        ctx.quadraticCurveTo(R * 0.88, -R * 0.15, R * 0.65, -R * 0.08);
        ctx.quadraticCurveTo(0, R * 0.02, -R * 0.65, -R * 0.08);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        const spikeData = [
            { bx: -R * 0.62, by: -R * 0.85, tx: -R * 0.88, ty: -R * 1.28 },
            { bx: -R * 0.22, by: -R * 1.05, tx: -R * 0.32, ty: -R * 1.45 },
            { bx: R * 0.05, by: -R * 1.10, tx: R * 0.10, ty: -R * 1.52 },
            { bx: R * 0.32, by: -R * 1.02, tx: R * 0.50, ty: -R * 1.40 },
            { bx: R * 0.68, by: -R * 0.80, tx: R * 0.90, ty: -R * 1.18 },
        ];
        for (const sp of spikeData) {
            const halfW = R * 0.12;
            const perpA = Math.atan2(sp.ty - sp.by, sp.tx - sp.bx) + Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(sp.bx + Math.cos(perpA) * halfW, sp.by + Math.sin(perpA) * halfW);
            ctx.lineTo(sp.tx, sp.ty);
            ctx.lineTo(sp.bx - Math.cos(perpA) * halfW, sp.by - Math.sin(perpA) * halfW);
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.strokeStyle = '#2d1f0f'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-R * 0.38, -R * 0.60);
        ctx.quadraticCurveTo(-R * 0.50, -R * 0.95, -R * 0.22, -R * 1.10);
        ctx.stroke();
        ctx.lineCap = 'butt';
        // Ears
        ctx.fillStyle = '#c8956c'; ctx.strokeStyle = '#a0714a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(-R * 0.85, -R * 0.38, R * 0.14, R * 0.18, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(R * 0.85, -R * 0.38, R * 0.14, R * 0.18, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Mouth
        ctx.strokeStyle = '#7a4830'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
        if (e.isEnraged) {
            ctx.beginPath();
            ctx.moveTo(-R * 0.22, -R * 0.05);
            ctx.quadraticCurveTo(0, R * 0.10, R * 0.22, -R * 0.05);
            ctx.stroke();
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath(); ctx.roundRect(-R * 0.16, -R * 0.07, R * 0.32, R * 0.10, 2); ctx.fill();
        } else {
            ctx.beginPath();
            ctx.moveTo(-R * 0.18, -R * 0.05); ctx.lineTo(R * 0.18, -R * 0.05); ctx.stroke();
        }
        ctx.lineCap = 'butt';

        // ── LAYER 9 — Science goggles ───────────────────────────────────
        const goggleY = -R * 0.38;
        const goggleGlow = e.isEnraged ? '#ff4444' : '#00ffff';
        const gogglePulse = 0.6 + Math.sin(t * 2.5) * 0.35;
        ctx.strokeStyle = '#1e293b'; ctx.lineWidth = R * 0.14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-R * 1.02, goggleY); ctx.lineTo(R * 1.02, goggleY); ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.strokeStyle = '#334155'; ctx.lineWidth = R * 0.08;
        ctx.beginPath(); ctx.moveTo(-R * 1.02, goggleY); ctx.lineTo(R * 1.02, goggleY); ctx.stroke();
        ctx.shadowBlur = 14 * gogglePulse; ctx.shadowColor = goggleGlow;
        ctx.fillStyle = '#0f172a'; ctx.strokeStyle = goggleGlow; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.roundRect(-R * 0.75, goggleY - R * 0.20, R * 0.40, R * 0.36, 4); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.roundRect(R * 0.35, goggleY - R * 0.20, R * 0.40, R * 0.36, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = goggleGlow; ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.moveTo(-R * 0.35, goggleY); ctx.lineTo(R * 0.35, goggleY); ctx.stroke();
        ctx.shadowBlur = 0;
        const lensAlpha = 0.45 + Math.sin(t * 3.2) * 0.28;
        ctx.fillStyle = e.isEnraged ? `rgba(239,68,68,${lensAlpha})` : `rgba(0,255,255,${lensAlpha})`;
        ctx.shadowBlur = 10 * gogglePulse; ctx.shadowColor = goggleGlow;
        ctx.beginPath(); ctx.roundRect(-R * 0.72, goggleY - R * 0.17, R * 0.34, R * 0.30, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(R * 0.38, goggleY - R * 0.17, R * 0.34, R * 0.30, 3); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(255,255,255,${0.55 + Math.sin(t * 2.8) * 0.25})`;
        ctx.beginPath(); ctx.ellipse(-R * 0.60, goggleY - R * 0.10, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(R * 0.52, goggleY - R * 0.10, R * 0.08, R * 0.05, -0.4, 0, Math.PI * 2); ctx.fill();

        // ── LAYER 10 — Back hand ────────────────────────────────────────
        const handBob = Math.sin(t * 2.1) * 3;
        ctx.fillStyle = '#c8956c'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.2;
        ctx.shadowBlur = 5; ctx.shadowColor = 'rgba(0,255,255,0.3)';
        ctx.beginPath(); ctx.arc(-(R + 8), 4 + handBob, R * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;

        // ── LAYER 11 — State indicators ─────────────────────────────────
        if (e.state === 'STUNNED') {
            for (let si = 0; si < 3; si++) {
                const sa = t * 3.5 + (si / 3) * Math.PI * 2;
                const sx = Math.cos(sa) * R * 0.60;
                const sy = -R * 1.12 + Math.sin(sa) * R * 0.35;
                ctx.font = `bold ${13 + Math.sin(t * 4 + si) * 2}px Arial`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillStyle = '#fbbf24'; ctx.shadowBlur = 8; ctx.shadowColor = '#fbbf24';
                ctx.fillText('★', sx, sy);
            }
            ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center';
            ctx.fillText('😵', 0, -R * 1.35);
            ctx.shadowBlur = 0;
        }
        if (e.state === 'ORBIT_ATTACK') {
            ctx.save();
            ctx.globalAlpha = 0.55 + Math.sin(t * 4) * 0.35;
            ctx.shadowBlur = 12; ctx.shadowColor = '#818cf8';
            ctx.strokeStyle = '#818cf8'; ctx.lineWidth = 2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.arc(0, 0, R * 1.55, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // ── LAYER 12 — Berserk fire particles ───────────────────────────
        if (e.isEnraged) {
            for (let pi = 0; pi < 5; pi++) {
                const pa = t * 0.85 + pi * 1.26;
                const pr = R * 0.60 + Math.sin(t * 1.3 + pi) * R * 0.18;
                const px = Math.sin(pa * 1.1) * pr;
                const py = -Math.abs(Math.cos(pa * 0.9 + pi)) * R * 0.70 - R * 0.45;
                const ps = 3.5 + Math.sin(t * 2.2 + pi) * 1.8;
                ctx.globalAlpha = 0.50 + Math.sin(t * 3 + pi) * 0.28;
                ctx.fillStyle = pi % 2 === 0 ? '#ef4444' : '#fb923c';
                ctx.shadowBlur = 10; ctx.shadowColor = '#ef4444';
                ctx.beginPath(); ctx.arc(px, py, ps, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }

        // ── LAYER 13 — HP bar ────────────────────────────────────────────
        {
            const barW = R * 2.0, barH = 6;
            const barX = -barW / 2, barYp = -R * 1.72;
            const hpPct = Math.max(0, e.hp / e.maxHp);
            ctx.fillStyle = 'rgba(0,0,0,0.60)';
            ctx.beginPath(); ctx.roundRect(barX - 1, barYp - 1, barW + 2, barH + 2, 3); ctx.fill();
            const hpCol = hpPct > 0.55 ? '#39ff14' : hpPct > 0.28 ? '#fbbf24' : '#ef4444';
            ctx.shadowBlur = 6; ctx.shadowColor = hpCol; ctx.fillStyle = hpCol;
            ctx.beginPath(); ctx.roundRect(barX, barYp, barW * hpPct, barH, 3); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.80;
            ctx.font = `bold 9px "Orbitron",Arial,sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = e.isEnraged ? '#ef4444' : '#39ff14';
            ctx.shadowBlur = 6; ctx.shadowColor = e.isEnraged ? '#ef4444' : '#39ff14';
            ctx.fillText('KRU FIRST', 0, barYp - 5);
            ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }

        ctx.restore(); // end body block

        // ── WEAPON BLOCK — Energy pointer ──────────────────────────────
        ctx.save();
        ctx.rotate(e.angle);
        if (isFacingLeft) ctx.scale(1, -1);
        ctx.fillStyle = '#c8956c'; ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2.2;
        ctx.shadowBlur = 6; ctx.shadowColor = 'rgba(0,255,255,0.4)';
        ctx.beginPath(); ctx.arc(R + 8, 4, R * 0.30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        const ptrGlow = (e.state === 'SUVAT_CHARGE' || e.state === 'ORBIT_ATTACK') ? 1.0 : 0.55;
        const ptrCol = e.isEnraged ? '#ff4444' : '#00ffff';
        ctx.shadowBlur = 14 * ptrGlow; ctx.shadowColor = ptrCol;
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.roundRect(R + 12, -R * 0.08, R * 1.45, R * 0.17, 2); ctx.fill();
        ctx.fillStyle = ptrCol; ctx.globalAlpha = ptrGlow;
        ctx.beginPath(); ctx.roundRect(R + 14, -R * 0.04, R * 1.38, R * 0.08, 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(R + 12 + R * 1.45, 0, R * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.45 * ptrGlow;
        ctx.beginPath(); ctx.arc(R + 12 + R * 1.45, 0, R * 0.30, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        ctx.restore();

        // ── HIT FLASH OVERLAY ────────────────────────────────────────────
        if (e.hitFlashTimer && e.hitFlashTimer > 0) {
            ctx.save();
            ctx.beginPath(); ctx.arc(0, 0, R + 8, 0, Math.PI * 2); ctx.clip();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `rgba(255,255,255,${Math.min(e.hitFlashTimer * 2.0, 0.88)})`;
            ctx.fillRect(-R - 12, -R * 1.60, (R + 12) * 2, R * 2.8);
            ctx.restore();
        }

        ctx.restore(); // outermost
    }
}

window.BossRenderer = BossRenderer;