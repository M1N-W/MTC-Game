'use strict';
/**
 * js/entities/boss/ManopBoss.js
 * ════════════════════════════════════════════════════════════════════
 * Two classes in one file:
 *   BossDog  — standalone melee sub-unit (extends Entity, not BossBase)
 *   KruManop — "The Dog Summoner" math teacher boss (extends BossBase)
 *
 * Encounter scaling (constructor args: difficulty, enablePhase2, enablePhase3):
 *   Wave 3 : KruManop(diff, false, false) — Phase 1 only
 *   Wave 6 : KruManop(diff, true,  false) — Phase 1 + 2 (dog + enrage)
 *   Wave 9 : KruManop(diff, true,  true)  — Phase 1 + 2 + 3 (goldfish)
 *
 * Load after: BossBase.js, boss_attacks_manop.js (EquationSlam, DeadlyGraph,
 *             MatrixGridAttack, BarkWave, ChalkWall, BubbleProjectile,
 *             GoldfishMinion, ExpandingRing), DomainExpansion.js
 * Exports: window.BossDog, window.KruManop,
 *          window.ManopBoss (= KruManop),
 *          window.Boss      (= KruManop, backward-compat)
 *
 * ── TABLE OF CONTENTS ──────────────────────────────────────────────
 *  L.18  class BossDog extends Entity       sub-unit constructor + update + takeDamage
 *  L.70  BossDog._drawDogBody()             legacy CTX draw — DEAD CODE (use BossRenderer)
 *  L.173 class KruManop extends BossBase    constructor (difficulty, enablePhase2, enablePhase3)
 *  L.235 KruManop.update(dt, player)        main state machine — all phases, log457, domain
 *  L.556 KruManop.bark(player)              Phase 2 — sonic cone push
 *  L.590 KruManop._summonDog()              Phase 2 — spawns BossDog into window.enemies
 *  L.600 KruManop.useEquationSlam()         skill — AoE shockwave
 *  L.611 KruManop.useDeadlyGraph(player)    skill — laser line (kiter counter)
 *  L.631 KruManop.useMatrixGrid(player)     skill — grid with one safe cell
 *  L.656 KruManop.useLog457()               skill — charge→active→stun 3-phase buff
 *  L.665 KruManop.useChalkWall(player)      Phase 2 — perpendicular barrier
 *  L.692 KruManop.useDogPackCombo(player)   Phase 2 — dog rush + radial burst sync
 *  L.706 KruManop.takeDamage(amt)           domain/invuln guards → _onDeath → Achievement
 *  L.735 window exports                     BossDog, KruManop, ManopBoss, Boss
 *
 * State machine states (this.state):
 *   'CHASE' → 'ATTACK' → 'ULTIMATE' → 'MATRIX_GRID' → 'DOMAIN'
 *   log457 runs as a parallel sub-state (log457State: null|'charging'|'active'|'stunned')
 *   _dogPackActive is a parallel freeze flag, not a state string
 *
 * ⚠️  Class name: KruManop (not ManopBoss, Boss, or KruManopBoss).
 *     window.ManopBoss and window.Boss are aliases only — never use as constructor name.
 * ⚠️  BossDog extends Entity (NOT BossBase / EnemyBase) — has no StatusEffect framework,
 *     no _tickShared(), no addStatus(). Do NOT call addStatus on dog.
 * ⚠️  BossDog._drawDogBody() is dead code — uses bare CTX (global) instead of ctx param.
 *     All rendering goes through BossRenderer.drawBossDog(). Do not resurrect.
 * ⚠️  DomainExpansion.trigger() sets _domainActive=true; update() freezes boss and
 *     returns early while it's true. Any code after the domain return block is skipped.
 * ⚠️  log457 'stunned' phase also returns early — boss cannot act or take skill decisions.
 *     isInvulnerable=true only during 'charging' sub-phase, NOT during 'stunned'.
 * ⚠️  _phase2Threshold / _phase3Threshold read from BALANCE.boss.phase2ThresholdByEnc[]
 *     keyed by difficulty (1-based encounter index). Missing key silently falls back to
 *     BALANCE.boss.phase2Threshold. Always provide both arrays in config.
 * ⚠️  takeDamage: three independent invulnerability layers in priority order —
 *     _inSafeZone → DomainExpansion.isInvincible() → this.isInvulnerable (log457 charge)
 * ⚠️  PlayerPatternAnalyzer is consulted every 2s in CHASE (L.447–458).
 *     Uses dominantPattern(), kitingScore(), standingScore() — NOT getDominantStyle().
 * ════════════════════════════════════════════════════════════════════
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
        this._steerAroundObstacles(dt);
        this.applyPhysics(dt);

        // Melee contact damage
        if (d < this.radius + player.radius) {
            player.takeDamage(this.damage * dt);
        }

        if (this.hp <= 0 && !this.dead && !this._scored) {
            this._scored = true;  // BUG B4 FIX: prevent double addScore if killed same frame as boss
            this.dead = true;
            spawnParticles(this.x, this.y, 25, BALANCE.boss.bossDog.color);
            spawnFloatingText('Go Get EM! 🐕', this.x, this.y - 40, '#d97706', 26);
            addScore(Math.round(BALANCE.score.boss * 0.15));
        }
    }

    takeDamage(amt) {
        if (this._inSafeZone) return; // push-out กำลัง active — immune damage ชั่วคราว
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
// 👑 KRU MANOP — "THE DOG SUMMONER"
//
// Encounter 1 (Wave 3):  KruManop(diff, false, false)  → Phase 1 only
// Encounter 2 (Wave 6):  KruManop(diff, true,  false)  → Phase 1 + 2
// Encounter 3 (Wave 9):  KruManop(diff, true,  true)   → Phase 1 + 2 + 3
//
// Phase 1: ranged attacks (equationSlam, deadlyGraph, log457, matrixGrid, domain)
// Phase 2: enrage + BossDog summon + bark skill
// Phase 3: GoldfishLover — goldfish swarm + bubble volley
// ════════════════════════════════════════════════════════════
class KruManop extends BossBase {
    /**
     * @param {number}  difficulty   - HP/score multiplier (bossLevel from game.js)
     * @param {boolean} enablePhase2 - enables dog summon on HP threshold
     * @param {boolean} enablePhase3 - enables GoldfishLover on HP threshold
     */
    constructor(difficulty = 1, enablePhase2 = false, enablePhase3 = false) {
        super(0, BALANCE.boss.spawnY, BALANCE.boss.radius);
        const encounterMult = Math.pow(BALANCE.boss.hpMultiplier, difficulty - 1);
        this.maxHp = Math.floor(BALANCE.boss.baseHp * encounterMult);
        this.hp = this.maxHp;
        this.name = 'KRU MANOP';
        this.state = 'CHASE';
        this.timer = 0;
        this.moveSpeed = BALANCE.boss.moveSpeed;
        this.difficulty = difficulty;
        this.phase = 1;
        this.enablePhase2 = enablePhase2;
        this.enablePhase3 = enablePhase3;

        // ── Per-encounter phase thresholds ────────────────────
        // enc 1 (wave 3): phase2 at 50% — guaranteed dog encounter
        // enc 3 (wave 9): phase2 at 60%  phase3 at 30%
        // enc 5 (wave 15): phase2 at 65% phase3 at 35%
        const enc = difficulty;   // difficulty == bossLevel == encounter index (1-based Manop)
        const p2t = BALANCE.boss.phase2ThresholdByEnc;
        const p3t = BALANCE.boss.phase3ThresholdByEnc;
        this._phase2Threshold = (p2t && p2t[enc] != null) ? p2t[enc] : BALANCE.boss.phase2Threshold;
        this._phase3Threshold = (p3t && p3t[enc] != null) ? p3t[enc] : (BALANCE.boss.phase3Threshold ?? 0.25);

        // Phase 2 sub-unit: BossDog is conceptually part of KruManop.
        this.dog = null;

        this.skills = {
            slam: { cd: 0, max: BALANCE.boss.slamCooldown },
            graph: { cd: 0, max: BALANCE.boss.graphCooldown },
            log: { cd: 0, max: BALANCE.boss.log457Cooldown },
            bark: { cd: 0, max: BALANCE.boss.phase2.barkCooldown },
            goldfish: { cd: 0, max: BALANCE.boss.phase3.goldfishCooldown },
            bubble: { cd: 0, max: BALANCE.boss.phase3.bubbleCooldown },
            matrixGrid: { cd: 0, max: BALANCE.boss.matrixGridCooldown ?? 22.0 },
            domain: { cd: 0, max: _DC ? _DC.COOLDOWN : 45.0 },
            // ── Phase 2 new skills ────────────────────────────
            chalkWall: { cd: 0, max: BALANCE.boss.phase2.chalkWallCooldown ?? 12.0 },
            dogPack: { cd: 0, max: BALANCE.boss.phase2.dogPackCooldown ?? 18.0 },
        };
        this._domainCasting = false;
        this._domainActive = false;

        this.log457State = null;
        this.log457Timer = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable = false;
        this.isEnraged = false;

        // ── DogPackCombo state ────────────────────────────────
        // Set true while the combo sequence is animating.
        // KruManop freezes briefly, then simultaneous dog rush + ultimate fires.
        this._dogPackActive = false;
        this._dogPackTimer = 0;
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
        if (this.hp < this.maxHp * this._phase2Threshold && this.phase === 1 && this.enablePhase2) {
            this.phase = 2;
            this.isEnraged = true;
            this.moveSpeed = BALANCE.boss.moveSpeed * BALANCE.boss.phase2.enrageSpeedMult;
            spawnFloatingText('ENRAGED!', this.x, this.y - 80, '#ef4444', 40);
            addScreenShake(20);
            spawnParticles(this.x, this.y, 35, '#ef4444');
            spawnParticles(this.x, this.y, 20, '#d97706');

            // ── PlayerPatternAnalyzer: reset history at phase break ──
            // Fresh data more relevant — player may shift strategy now
            if (typeof playerAnalyzer !== 'undefined') playerAnalyzer.reset();

            this._summonDog();

            this.speak('You think you can stop me?!');
            Audio.playBossSpecial();
        }

        // ── Phase 3 transition — "The Goldfish Lover" ────────
        if (this.hp < this.maxHp * this._phase3Threshold && this.phase === 2 && this.enablePhase3) {
            this.phase = 3;
            this.moveSpeed = BALANCE.boss.moveSpeed
                * BALANCE.boss.phase2.enrageSpeedMult
                * 1.15;
            this.skills.goldfish.cd = 0;
            this.skills.bubble.cd = 0;

            // ── PlayerPatternAnalyzer: reset + immediate kite-counter on phase 3 ──
            if (typeof playerAnalyzer !== 'undefined') {
                playerAnalyzer.reset();
                // Force-prime: reduce DeadlyGraph + ChalkWall CD so kiter gets punished fast
                if (this.skills.graph.cd > 3) this.skills.graph.cd = 3;
                if (this.skills.chalkWall.cd > 4) this.skills.chalkWall.cd = 4;
            }

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

        // ── DogPackCombo sequence ─────────────────────────────
        // Phase: 0.0–0.5s  boss freezes + telegraph
        //        0.5–1.1s  dog rushes player + boss fires ultimate simultaneously
        if (this._dogPackActive) {
            this._dogPackTimer += dt;
            this.vx = 0; this.vy = 0;
            if (this._dogPackTimer >= 0.5 && !this._dogPackFired) {
                this._dogPackFired = true;
                // Dog gets a direct velocity impulse toward player
                if (this.dog && !this.dog.dead) {
                    const ddx = player.x - this.dog.x, ddy = player.y - this.dog.y;
                    const dd = Math.hypot(ddx, ddy);
                    if (dd > 0) {
                        this.dog.vx = (ddx / dd) * 620;
                        this.dog.vy = (ddy / dd) * 620;
                    }
                    spawnFloatingText('🐕 PACK RUSH!', this.dog.x, this.dog.y - 60, '#d97706', 24);
                }
                // Boss fires radial ultimate simultaneously
                const bullets = BALANCE.boss.phase2UltimateBullets;
                for (let i = 0; i < bullets; i++) {
                    const a = (Math.PI * 2 / bullets) * i;
                    projectileManager.add(new Projectile(
                        this.x, this.y, a,
                        BALANCE.boss.ultimateProjectileSpeed, BALANCE.boss.ultimateDamage * 0.85,
                        '#ef4444', true, 'enemy'
                    ));
                }
                if (typeof window.specialEffects !== 'undefined') {
                    window.specialEffects.push(new ExpandingRing(this.x, this.y, '#d97706', 260, 0.5));
                }
                addScreenShake(18);
                Audio.playBossSpecial();
            }
            if (this._dogPackTimer >= 1.2) {
                this._dogPackActive = false;
                this._dogPackTimer = 0;
                this._dogPackFired = false;
                this.state = 'CHASE';
            }
            this._updateHUD();
            return;
        }

        // ── log457 state machine ─────────────────────────────
        if (this.log457State === 'charging') {
            this.log457Timer += dt; this.isInvulnerable = true;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * BALANCE.boss.log457HealRate * dt);
            // Visual particles during charge (green healing aura)
            if (!this._log457PtCd || this._log457PtCd <= 0) {
                this._log457PtCd = 0.08;
                if (typeof spawnParticles === 'function') {
                    spawnParticles(this.x, this.y, 3, '#4ade80');
                }
            } else { this._log457PtCd -= dt; }
            if (this.log457Timer >= BALANCE.boss.log457ChargeDuration) {
                this.log457State = 'active'; this.log457Timer = 0;
                this.log457AttackBonus = BALANCE.boss.log457AttackBonus;
                this.isInvulnerable = false;
                addScreenShake(25);
                spawnFloatingText('log 4.57 = 0.6599...', this.x, this.y - 110, '#facc15', 22);
                spawnFloatingText('67! 67! 67!', this.x, this.y - 75, '#ef4444', 42);
                spawnParticles(this.x, this.y, 40, '#facc15');
                spawnParticles(this.x, this.y, 22, '#ef4444');
                if (typeof window.specialEffects !== 'undefined') {
                    window.specialEffects.push(new ExpandingRing(this.x, this.y, '#facc15', 220, 0.5));
                }
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

        // ── Domain Expansion trigger ─────────────────────────
        if (this.enablePhase2 &&
            this.hp / this.maxHp <= 0.40 &&
            typeof DomainExpansion !== 'undefined' &&
            DomainExpansion.canTrigger()) {
            this.state = 'DOMAIN';
            this.timer = 0;
            DomainExpansion.trigger(this);
        }

        // Freeze all AI while domain is running — DomainExpansion.update() drives it
        if (this._domainActive) {
            this.vx = 0; this.vy = 0;
            if (window.UIManager) { this._updateHUD(); }
            return;
        }
        // Safety: if domain ended but state wasn't reset (e.g. frame gap), recover
        if (this.state === 'DOMAIN') { this.state = 'CHASE'; this.timer = 0; }

        // ── State machine ────────────────────────────────────
        if (this.state === 'CHASE') {
            if (!player.isInvisible) { this.vx = Math.cos(this.angle) * this.moveSpeed; this.vy = Math.sin(this.angle) * this.moveSpeed; }
            else { this.vx *= 0.95; this.vy *= 0.95; }
            this._steerAroundObstacles(dt);
            this.applyPhysics(dt);

            if (this.timer > 2) {
                this.timer = 0;

                // ── PlayerPatternAnalyzer: counter-pick attack ──
                if (typeof playerAnalyzer !== 'undefined') {
                    const pattern = playerAnalyzer.dominantPattern();
                    // Kiting: player runs away → DeadlyGraph (ranged) or ChalkWall to cut off
                    if (pattern === 'kiting' && playerAnalyzer.kitingScore() > 0.55) {
                        if (this.skills.graph.cd <= 0) { this.useDeadlyGraph(player); return; }
                        if (this.phase >= 2 && this.skills.chalkWall.cd <= 0) { this.useChalkWall(player); return; }
                    }
                    // Standing still: player is stationary → slam for high punishment
                    if (pattern === 'standing' && playerAnalyzer.standingScore() > 0.6) {
                        if (this.skills.slam.cd <= 0) { this.useEquationSlam(); return; }
                        if (this.skills.log.cd <= 0) { this.useLog457(); return; }
                    }
                }

                const barkChance = this.phase === 2 ? 0.40 : 0;
                // DogPackCombo — highest phase-2 priority: dog must be alive
                if (this.phase >= 2 && this.dog && !this.dog.dead &&
                    this.skills.dogPack.cd <= 0 && Math.random() < 0.30) {
                    this.useDogPackCombo(player);
                } else if (this.skills.log.cd <= 0 && Math.random() < 0.20) {
                    this.useLog457();
                } else if (this.skills.graph.cd <= 0 && Math.random() < 0.25) {
                    this.useDeadlyGraph(player);
                } else if (this.phase === 2 && this.skills.bark.cd <= 0 && Math.random() < barkChance) {
                    this.bark(player);
                } else if (this.phase >= 2 && this.skills.chalkWall.cd <= 0 && Math.random() < 0.35) {
                    this.useChalkWall(player);
                } else if (this.skills.slam.cd <= 0 && Math.random() < 0.30) {
                    this.useEquationSlam();
                } else if (this.phase >= 2 && this.skills.matrixGrid.cd <= 0 && Math.random() < 0.35) {
                    this.useMatrixGrid(player);
                } else {
                    this.state = Math.random() < 0.3 ? 'ULTIMATE' : 'ATTACK';
                }
            }
            // ManopBoss.js — ATTACK state, แทนที่ทั้ง block (line ~482–494)

        } else if (this.state === 'ATTACK') {
            this.vx *= 0.9; this.vy *= 0.9;
            const fr = this.phase === 2 ? BALANCE.boss.phase2AttackFireRate : BALANCE.boss.attackFireRate;
            const bf = fr / (1 + this.log457AttackBonus);
            if (this.timer > bf) {
                // Predictive aim — lead scales with phase (phase2 boss is smarter)
                const _leadT = this.phase === 2 ? 0.35 : 0.20;
                const _pred = (typeof playerAnalyzer !== 'undefined')
                    ? playerAnalyzer.predictedPosition(_leadT)
                    : null;
                const _aimAngle = _pred
                    ? Math.atan2(_pred.y - this.y, _pred.x - this.x)
                    : this.angle;

                projectileManager.add(new Projectile(this.x, this.y, _aimAngle, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                if (this.phase === 2) {
                    projectileManager.add(new Projectile(this.x, this.y, _aimAngle + 0.3, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                    projectileManager.add(new Projectile(this.x, this.y, _aimAngle - 0.3, BALANCE.boss.chalkProjectileSpeed, BALANCE.boss.chalkDamage, '#fff', false, 'enemy'));
                }
                this.timer = 0;
                if (Math.random() < 0.08) this.state = 'CHASE';
            }
        } else if (this.state === 'ULTIMATE') {
            this.vx = 0; this.vy = 0;
            // Wind-up: 0→0.65s — implosion visual (drawn in BossRenderer)
            // Release:  > 0.65s — radial bullet burst + EMP-style shockwave
            if (!this._ultWound && this.timer > 0.65) {
                this._ultWound = true;
                const bullets = this.phase === 2 ? BALANCE.boss.phase2UltimateBullets : BALANCE.boss.ultimateBullets;
                // Primary radial burst
                for (let i = 0; i < bullets; i++) {
                    const a = (Math.PI * 2 / bullets) * i;
                    projectileManager.add(new Projectile(this.x, this.y, a, BALANCE.boss.ultimateProjectileSpeed, BALANCE.boss.ultimateDamage, '#ef4444', true, 'enemy'));
                }
                // Phase-2: secondary diagonal burst
                if (this.phase === 2) {
                    const offset = Math.PI / bullets;
                    for (let i = 0; i < bullets; i++) {
                        const a = (Math.PI * 2 / bullets) * i + offset;
                        projectileManager.add(new Projectile(this.x, this.y, a, BALANCE.boss.ultimateProjectileSpeed * 0.78, BALANCE.boss.ultimateDamage * 0.75, '#f97316', true, 'enemy'));
                    }
                }
                // Concussive shockwave ring (visual + force)
                if (typeof window.specialEffects !== 'undefined') {
                    window.specialEffects.push(new ExpandingRing(this.x, this.y, '#facc15', 280, 0.65));
                    window.specialEffects.push(new ExpandingRing(this.x, this.y, '#ef4444', 200, 0.45));
                }
                addScreenShake(22);
                spawnFloatingText('📚 POP QUIZ!', this.x, this.y - 90, '#facc15', 42);
                spawnParticles(this.x, this.y, 30, '#facc15');
                spawnParticles(this.x, this.y, 20, '#ef4444');
                Audio.playBossSpecial();
            }
            if (this.timer > 1.25) {
                this._ultWound = false;
                this.state = 'CHASE'; this.timer = -1;
            }
        } else if (this.state === 'MATRIX_GRID') {
            // Boss stands still during wind-up; MatrixGridAttack object handles detonation
            this.vx = 0; this.vy = 0;
            // warnDur(1.5) + linger(0.5) + wind-up buffer(0.6)
            if (this.timer > 2.6) {
                this.state = 'CHASE'; this.timer = 0;
            }
        }

        if (d < this.radius + player.radius)
            player.takeDamage(BALANCE.boss.contactDamage * dt * (1 + this.log457AttackBonus));

        this._updateHUD();
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
        spawnFloatingText('🔊 WOOF WOOF!', this.x, this.y - 100, '#d97706', 34);
        spawnFloatingText('SONIC BARK!', this.x, this.y - 140, '#fef3c7', 20);
        spawnParticles(this.x, this.y, 20, '#d97706');
        spawnParticles(this.x, this.y, 10, '#fbbf24');
        addScreenShake(12);
        Audio.playBossSpecial();
        this.speak('BARK BARK BARK!');
    }

    // ── Phase 2: Summon the Dog ─────────────────────────
    // BossDog is a sub-unit of KruManop — spawned into window.enemies
    // so it shares the normal enemy update/collision/draw loop.
    // this.dog holds ownership reference; dog.owner points back here.
    _summonDog() {
        if (this.dog && !this.dog.dead) return; // already alive
        if (!Array.isArray(window.enemies)) return;
        const dog = new BossDog(this.x, this.y);
        dog.owner = this;   // BossDog → KruManop back-reference
        this.dog = dog;    // KruManop → BossDog ownership
        window.enemies.push(dog);
        spawnFloatingText('🐕 GO GET \'EM!', this.x, this.y - 120, '#d97706', 32);
    }

    useEquationSlam() {
        this.skills.slam.cd = this.skills.slam.max; this.state = 'CHASE';
        addScreenShake(18);
        spawnFloatingText('📐 EQUATION SLAM!', this.x, this.y - 80, '#facc15', 32);
        spawnFloatingText('∑Δx² = 0', this.x, this.y - 120, '#fef9c3', 18);
        spawnParticles(this.x, this.y, 25, '#facc15');
        spawnParticles(this.x, this.y, 12, '#ffffff');
        this.speak('Equation Slam!'); Audio.playBossSpecial();
        window.specialEffects.push(new EquationSlam(this.x, this.y));
    }

    useDeadlyGraph(player) {
        this.skills.graph.cd = this.skills.graph.max; this.state = 'CHASE';
        spawnFloatingText('📈 DEADLY GRAPH!', this.x, this.y - 80, '#3b82f6', 32);
        spawnFloatingText('y = x', this.x, this.y - 118, '#93c5fd', 20);
        spawnParticles(this.x, this.y, 16, '#3b82f6');
        addScreenShake(10);
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

    useMatrixGrid(player) {
        this.skills.matrixGrid.cd = this.skills.matrixGrid.max;
        this.state = 'MATRIX_GRID';
        this.timer = 0;

        const cols = 3, rows = 2;
        const cellSize = 130;
        const safeIndex = Math.floor(Math.random() * cols * rows);

        // Centre grid on player's current position (snapshot)
        window.specialEffects.push(new MatrixGridAttack(
            player.x, player.y,
            cols, rows, cellSize,
            1.5,                                        // warn duration seconds
            BALANCE.boss.ultimateDamage * 1.4,          // damage
            safeIndex
        ));

        spawnFloatingText('MATRIX GRID!', this.x, this.y - 80, '#ef4444', 32);
        spawnFloatingText('FIND THE SAFE CELL!', player.x, player.y - 110, '#22c55e', 24);
        addScreenShake(8);
        Audio.playBossSpecial();
        this.speak('There is no escape from my matrix!');
    }

    useLog457() {
        this.log457State = 'charging'; this.log457Timer = 0; this.state = 'CHASE';
        spawnFloatingText('log 4.57 = ?', this.x, this.y - 80, '#ef4444', 30);
        Audio.playBossSpecial();
    }

    // ── Phase 2: Chalk Wall ───────────────────────────────────
    // Draws a chalk line perpendicular to the boss→player vector,
    // blocking the player's direct escape path.
    useChalkWall(player) {
        this.skills.chalkWall.cd = this.skills.chalkWall.max;
        this.state = 'CHASE';

        // Wall angle = boss→player angle (wall is perpendicular to this)
        const wallAngle = Math.atan2(player.y - this.y, player.x - this.x);
        // Place wall slightly in front of player (between boss and player, 60% of the way)
        const d = Math.hypot(player.x - this.x, player.y - this.y);
        const t = Math.min(0.60, 200 / Math.max(d, 1));
        const wx = this.x + (player.x - this.x) * t;
        const wy = this.y + (player.y - this.y) * t;

        if (typeof ChalkWall !== 'undefined' && typeof window.specialEffects !== 'undefined') {
            window.specialEffects.push(new ChalkWall(wx, wy, wallAngle));
        }
        spawnFloatingText('📐 CHALK WALL!', this.x, this.y - 80, '#fef9c3', 28);
        spawnFloatingText('EQUATION BARRIER', wx, wy - 50, '#fef08a', 17);
        spawnParticles(this.x, this.y, 12, '#fef9c3');
        addScreenShake(6);
        this.speak('You cannot pass!');
        Audio.playBossSpecial();
    }

    // ── Phase 2: Dog Pack Combo ───────────────────────────────
    // Synchronized attack: boss freezes 0.5s (telegraph),
    // then BossDog rushes player AND boss fires radial ultimate simultaneously.
    // Requires dog to be alive. Handled in update() _dogPackActive block.
    useDogPackCombo(player) {
        this.skills.dogPack.cd = this.skills.dogPack.max;
        this.state = 'CHASE';
        this._dogPackActive = true;
        this._dogPackTimer = 0;
        this._dogPackFired = false;
        spawnFloatingText('🐕 PACK TACTICS!', this.x, this.y - 100, '#d97706', 32);
        spawnFloatingText('COMBO INCOMING!', this.x, this.y - 138, '#ef4444', 20);
        spawnParticles(this.x, this.y, 18, '#d97706');
        addScreenShake(10);
        this.speak('GO, BOY! TOGETHER!');
        Audio.playBossSpecial();
    }

    takeDamage(amt) {
        if (this._inSafeZone) return; // push-out กำลัง active — immune damage ชั่วคราว
        if (typeof DomainExpansion !== 'undefined' && DomainExpansion.isInvincible()) {
            spawnFloatingText('DOMAIN SHIELD!', this.x, this.y - 40, '#d946ef', 20);
            return;
        }
        if (this.isInvulnerable) {
            spawnFloatingText('INVINCIBLE!', this.x, this.y - 40, '#facc15', 20);
            return;
        }
        this.hp -= amt;
        if (this.hp <= 0 && !this._waveSpawnLocked) {
            this._waveSpawnLocked = true;
            // ── INCREMENT STAT: ต้องทำก่อน check() เพื่อให้ condition เป็น true ──
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.manopKills = (Achievements.stats.manopKills ?? 0) + 1;
                Achievements.check('manop_down');
            }
            this._onDeath();
        }
    }
    // draw() → BossRenderer.drawBoss(e, ctx)

}


// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.BossDog = BossDog;
window.KruManop = KruManop;
window.ManopBoss = KruManop;  // alias — WaveManager, AdminSystem, instanceof checks
window.Boss = KruManop;   // backward-compat alias (WaveManager, AdminSystem)