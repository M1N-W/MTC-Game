'use strict';
/**
 * js/entities/FirstBoss.js
 *
 * KruFirst extends BossBase — "Kru First the Physics Master"
 *
 * Encounter 2 (Wave 6):  KruFirst(bossLevel, false)
 * Encounter 4 (Wave 12): KruFirst(bossLevel, true)  ← isAdvanced
 *
 * States: IDLE | CHASE | SUVAT_CHARGE | ORBIT_ATTACK |
 *         FREE_FALL | ROCKET | SANDWICH_TOSS | STUNNED | BERSERK
 *
 * Depends on: BossBase.js (BossBase), boss_attacks.js
 * Loaded after: BossBase.js
 */

// ════════════════════════════════════════════════════════════
// ⚛️  KRU FIRST — "PHYSICS MASTER"
//
// Encounter 2 (Wave 6):  KruFirst(bossLevel, false)
// Encounter 4 (Wave 12): KruFirst(bossLevel, true)  ← isAdvanced
//
// States: IDLE | CHASE | SUVAT_CHARGE | ORBIT_ATTACK |
//         FREE_FALL | ROCKET | SANDWICH_TOSS | STUNNED | BERSERK
// ════════════════════════════════════════════════════════════
class KruFirst extends BossBase {
    /**
     * @param {number}  difficulty  - HP/score multiplier
     * @param {boolean} isAdvanced  - true on encounter 4; extra stat boost
     */
    constructor(difficulty = 1, isAdvanced = false) {
        const BASE_R = BALANCE.boss.radius * 0.88;
        super(0, BALANCE.boss.spawnY, BASE_R);

        const advMult = isAdvanced ? 1.35 : 1.0;
        this.maxHp = BALANCE.boss.baseHp * difficulty * 0.85 * advMult;
        this.hp = this.maxHp;
        this.name = 'KRU FIRST';
        this.moveSpeed = Math.min(
            BALANCE.boss.moveSpeed * 2.2,
            BALANCE.boss.moveSpeed * 1.55 * advMult
        );
        this.difficulty = difficulty;
        this.isAdvanced = isAdvanced;
        this.isEnraged = false;
        this.state = 'CHASE';
        this.stateTimer = 0;
        this.timer = 0;

        // ── Skill cooldowns ──────────────────────────────────
        this.skills = {
            suvat: { cd: 0, max: 8.0 },
            orbit: { cd: 0, max: 12.0 },
            freeFall: { cd: 0, max: 15.0 },
            rocket: { cd: 0, max: 9.0 },
            sandwich: { cd: 0, max: 18.0 },
            emp: { cd: 0, max: 20.0 },
            formulaZone: { cd: 0, max: 14.0 },   // ── NEW: PhysicsFormulaZone drop
            parabolic: { cd: 0, max: 6.5 },       // ── NEW: ParabolicVolley burst
            gravityWell: { cd: 0, max: 16.0 },    // ── Phase 4: Derivation Mode only
            superClone: { cd: 0, max: 20.0 },     // ── Phase 4: Derivation Mode only
        };

        // ── Derivation Mode (HP < 40%) ───────────────────────
        // Fires once at threshold; reduces all cooldowns and unlocks
        // formulaZone + parabolic burst skills for sustained pressure.
        this._derivationMode = false;
        this._derivationTaunted = false;

        // ── Domain Expansion: Gravitational Singularity ───────
        // Triggers once at HP ≤ 25%. _domainUsed prevents re-trigger.
        this._domainUsed = false;
        this._domainActive = false;   // mirrors KruManop pattern for freeze logic

        // ── SINGULARITY Mode (HP < 25%, post-domain) ─────────
        // Activates after domain ends. All cooldown ×0.50, double charge,
        // REBOUND replaces STUNNED.
        this._singularityMode = false;
        this._suvatChargeCount = 0;    // tracks double-charge (max 2 per trigger)
        this._reboundTimer = 0;        // REBOUND state duration

        // ── Clone / GravityWell live refs ─────────────────────
        this._superClone = null;       // active SuperpositionClone instance
        this._gravityWell = null;      // active GravityWell instance

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
        if (this._reboundTimer > 0) this._reboundTimer -= dt;

        // ── SINGULARITY mode activates once domain ends ───────
        if (this._domainUsed && !this._singularityMode &&
            !this._domainActive && this.state !== 'DOMAIN' &&
            typeof GravitationalSingularity !== 'undefined' &&
            GravitationalSingularity.phase === 'idle') {
            this._singularityMode = true;
            // All cooldowns ×0.50 (stack on Derivation Mode ×0.65 if active)
            for (const sk of Object.values(this.skills)) {
                sk.max = Math.max(1.5, sk.max * 0.50);
                sk.cd = Math.min(sk.cd, sk.max);
            }
            spawnFloatingText('⚫ SINGULARITY MODE', this.x, this.y - 110, '#00ffff', 32);
            spawnFloatingText('ALL COOLDOWNS ×0.50', this.x, this.y - 148, '#39ff14', 18);
            addScreenShake(20);
            spawnParticles(this.x, this.y, 50, '#00ffff');
            spawnParticles(this.x, this.y, 30, '#39ff14');
            this.speak('ยังยืนอยู่ได้... น่าทึ่ง');
        }

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

        // ── Domain Expansion trigger: Gravitational Singularity ──
        // Fires once when HP drops to or below 25%.
        if (!this._domainUsed &&
            this.hp / this.maxHp <= 0.25 &&
            typeof GravitationalSingularity !== 'undefined' &&
            GravitationalSingularity.canTrigger()) {
            this._domainUsed = true;
            this.state = 'DOMAIN';
            this.stateTimer = 0;
            GravitationalSingularity.trigger(this);
        }

        // Freeze AI while domain is running — GravitationalSingularity.update() drives it
        if (this._domainActive) {
            // Sync: release freeze once domain returns to idle
            if (typeof GravitationalSingularity !== 'undefined' &&
                GravitationalSingularity.phase === 'idle') {
                this._domainActive = false;
            } else {
                this.vx = 0; this.vy = 0;
                this._updateHUD();
                return;
            }
        }
        if (this.state === 'DOMAIN') { this.state = 'CHASE'; this.stateTimer = 0; }

        // ── State machine ─────────────────────────────────────
        switch (this.state) {

            case 'CHASE': {
                if (d > 0) {
                    this.vx = (dx / d) * this.moveSpeed;
                    this.vy = (dy / d) * this.moveSpeed;
                }
                this._steerAroundObstacles(dt);
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
                        this._suvatAimY - this.y,
                        this._suvatAimX - this.x
                    );
                    this.vx = Math.cos(dashAngle) * this._suvatVel;
                    this.vy = Math.sin(dashAngle) * this._suvatVel;
                    this.applyPhysics(dt);

                    // Hit player
                    if (d < this.radius + player.radius + 12) {
                        player.takeDamage(80);
                        addScreenShake(14);
                        spawnFloatingText('v=u+at IMPACT!', player.x, player.y - 55, '#fbbf24', 28);
                        if (this._singularityMode) {
                            this._reboundTimer = 0.5;
                            this._enterState('REBOUND');
                        } else {
                            this._enterOrbit(player);
                        }
                        break;
                    }

                    if (this.stateTimer - this.SUVAT_WIND_UP > this.SUVAT_MAX_DUR) {
                        // ── Miss Punishment: ยิง ParabolicVolley ทันที ──
                        if (typeof ParabolicVolley !== 'undefined') {
                            ParabolicVolley.fire(this.x, this.y, player.x, player.y, this.isAdvanced);
                            spawnFloatingText('PARABOLIC RETALIATION!', this.x, this.y - 70, '#c084fc', 22);
                        }
                        if (this._singularityMode) {
                            this._reboundTimer = 0.5;
                            this._enterState('REBOUND');
                        } else {
                            this._enterOrbit(player);
                        }
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

            case 'EMP_ATTACK': {
                // Wind-up: stand still 0.8s with blue glow telegraph, then detonate
                this.vx *= 0.85; this.vy *= 0.85;
                if (this.stateTimer > 0.8 && !this._empFired) {
                    this._empFired = true;
                    window.specialEffects.push(new EmpPulse(
                        this.x, this.y,
                        260,                                        // max radius (world units)
                        0.7,                                        // expand duration
                        18 * (this.isAdvanced ? 1.3 : 1.0),        // damage
                        3.0                                         // grounded duration (seconds)
                    ));
                    spawnFloatingText('⚡ EMP!', this.x, this.y - 80, '#38bdf8', 32);
                    Audio.playBossSpecial();
                }
                if (this.stateTimer > 1.8) this._enterState('CHASE');
                break;
            }

            case 'BERSERK': {
                // Permanent enrage: fast aggressive chase + burst fire
                this.isEnraged = true;
                if (d > 0) {
                    this.vx = (dx / d) * this.moveSpeed * 1.25;
                    this.vy = (dy / d) * this.moveSpeed * 1.25;
                }
                this._steerAroundObstacles(dt);
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

            case 'REBOUND': {
                // SINGULARITY Mode: replaces STUNNED — brief push-back then re-engage
                this.vx *= 0.92; this.vy *= 0.92;
                if (this._reboundTimer <= 0) {
                    // Immediately queue another SUVAT if double-charge not spent
                    if (this._suvatChargeCount > 0 && d > 80) {
                        this._suvatChargeCount--;
                        this._suvatVel = 0;
                        this._suvatAimX = player.x;
                        this._suvatAimY = player.y;
                        spawnFloatingText('⚫ REBOUND CHARGE!', this.x, this.y - 70, '#00ffff', 24);
                        this._enterState('SUVAT_CHARGE');
                    } else {
                        this._suvatChargeCount = 0;
                        this._enterState('CHASE');
                    }
                }
                this.applyPhysics(dt);
                break;
            }

            case 'QUANTUM_LEAP': {
                // Brief freeze before teleport fires (handled in _useQuantumLeap)
                this.vx *= 0.8; this.vy *= 0.8;
                if (this.stateTimer > 0.25) {
                    this._executeQuantumLeap(player);
                }
                break;
            }
        }

        // Contact damage
        if (d < this.radius + player.radius) {
            player.takeDamage(BALANCE.boss.contactDamage * dt * 1.2);
        }

        if (this.sayTimer > BALANCE.boss.speechInterval && Math.random() < 0.1) {
            this.speak('Player at ' + Math.round(player.hp) + ' HP');
            this.sayTimer = 0;
        }

        this._updateHUD();
    }

    // ─────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────
    _enterState(s) {
        this.state = s; this.stateTimer = 0;
    }

    _pickSkill(player, d) {
        // ── PlayerPatternAnalyzer: counter player habits ──────
        // Reads cached results — no perf cost (recomputed 4Hz externally)
        if (typeof playerAnalyzer !== 'undefined') {
            const pattern = playerAnalyzer.dominantPattern();
            const dir = playerAnalyzer.dominantDirection();

            // Kiting: player running away → SUVAT_CHARGE or FREE_FALL to cut distance
            if (pattern === 'kiting' && playerAnalyzer.kitingScore() > 0.6) {
                if (this.skills.suvat.cd <= 0 && d > 150) {
                    this._enterState('SUVAT_CHARGE');
                    this.skills.suvat.cd = this.skills.suvat.max;
                    spawnFloatingText('v = u + at', this.x, this.y - 80, '#ef4444', 24);
                    return;
                }
                if (this.skills.freeFall.cd <= 0) {
                    this.skills.freeFall.cd = this.skills.freeFall.max;
                    this._fallTargetX = player.x;
                    this._fallTargetY = player.y;
                    window.specialEffects.push(new FreeFallWarningRing(
                        this._fallTargetX, this._fallTargetY, this.FREE_FALL_WARN
                    ));
                    spawnFloatingText('h=½gt² …', this.x, this.y - 80, '#ef4444', 26);
                    this._enterState('FREE_FALL');
                    return;
                }
            }

            // Circling: spawn ParabolicVolley to intercept orbit path
            if (pattern === 'circling' && this._derivationMode && this.skills.parabolic.cd <= 0) {
                // Lead the shot: offset target in dominant orbit direction
                const leadSign = dir === 'right' ? 1 : -1;
                const bpDist = d || 1;
                const perpX = -(player.y - this.y) / bpDist;
                const perpY = (player.x - this.x) / bpDist;
                const leadX = player.x + perpX * 120 * leadSign;
                const leadY = player.y + perpY * 120 * leadSign;
                this.skills.parabolic.cd = this.skills.parabolic.max;
                if (typeof ParabolicVolley !== 'undefined') {
                    ParabolicVolley.fire(this.x, this.y, leadX, leadY, this.isAdvanced);
                    spawnFloatingText('INTERCEPT!', this.x, this.y - 75, '#c084fc', 22);
                }
                return;
            }
        }

        // ── SINGULARITY Mode: QuantumLeap highest priority ────
        if (this._singularityMode && this.skills.suvat.cd <= 0 && d > 80 && Math.random() < 0.40) {
            this._enterState('QUANTUM_LEAP');
            return;
        }

        // Sandwich toss is highest priority (non-singularity)
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
            // ── Drop a PhysicsFormulaZone at boss's current position ──
            // บังคับผู้เล่นต้องออกจากตำแหน่งที่ยืน
            if (typeof PhysicsFormulaZone !== 'undefined') {
                window.specialEffects.push(new PhysicsFormulaZone(
                    this.x, this.y,
                    120,   // radius
                    5.0,   // duration
                    this.isAdvanced ? 18 : 14  // damage/s
                ));
            }
            spawnFloatingText('h=½gt² …', this.x, this.y - 80, '#ef4444', 26);
            this._enterState('FREE_FALL');
            return;
        }
        // ── Derivation Mode only: PhysicsFormulaZone standalone drop ──
        if (this._derivationMode && this.skills.formulaZone.cd <= 0) {
            this.skills.formulaZone.cd = this.skills.formulaZone.max;
            if (typeof PhysicsFormulaZone !== 'undefined') {
                // Drop at player position — force them to move
                window.specialEffects.push(new PhysicsFormulaZone(
                    player.x, player.y,
                    130, 5.5,
                    this.isAdvanced ? 20 : 15
                ));
                spawnFloatingText('⚠ SLOW FIELD!', player.x, player.y - 60, '#e879f9', 22);
                addScreenShake(5);
            }
            // Immediately chain into ParabolicVolley while player is distracted
            if (typeof ParabolicVolley !== 'undefined') {
                ParabolicVolley.fire(this.x, this.y, player.x, player.y, this.isAdvanced);
            }
            return;
        }
        // ── Derivation Mode: standalone ParabolicVolley ──────────────
        if (this._derivationMode && this.skills.parabolic.cd <= 0) {
            this.skills.parabolic.cd = this.skills.parabolic.max;
            if (typeof ParabolicVolley !== 'undefined') {
                ParabolicVolley.fire(this.x, this.y, player.x, player.y, this.isAdvanced);
                spawnFloatingText('PARABOLIC VOLLEY!', this.x, this.y - 75, '#c084fc', 24);
            }
            return;
        }
        // ── Derivation Mode: GravityWell ─────────────────────
        if (this._derivationMode && this.skills.gravityWell.cd <= 0 &&
            (!this._gravityWell || this._gravityWell.dead) &&
            typeof GravityWell !== 'undefined') {
            this.skills.gravityWell.cd = this.skills.gravityWell.max;
            const midX = (this.x + player.x) / 2;
            const midY = (this.y + player.y) / 2;
            this._gravityWell = new GravityWell(midX, midY, 80, 4.0,
                this.isAdvanced ? 110 : 90, this.isAdvanced ? 70 : 55);
            window.specialEffects.push(this._gravityWell);
            spawnFloatingText('∇ GRAVITY WELL!', midX, midY - 60, '#10b981', 24);
            addScreenShake(7);
            return;
        }
        // ── Derivation Mode: SuperpositionClone ──────────────
        if (this._derivationMode && this.skills.superClone.cd <= 0 &&
            (!this._superClone || this._superClone.dead) &&
            typeof SuperpositionClone !== 'undefined') {
            this.skills.superClone.cd = this.skills.superClone.max;
            // Spawn at mirrored position relative to player
            const cloneX = player.x + (player.x - this.x) * 0.6;
            const cloneY = player.y + (player.y - this.y) * 0.6;
            this._superClone = new SuperpositionClone(cloneX, cloneY, 3.0, this.isAdvanced);
            window.specialEffects.push(this._superClone);
            spawnFloatingText('ψ SUPERPOSITION!', this.x, this.y - 90, '#06b6d4', 26);
            spawnFloatingText('DESTROY THE CLONE!', player.x, player.y - 120, '#fbbf24', 20);
            addScreenShake(10);
            spawnParticles(cloneX, cloneY, 20, '#06b6d4');
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
        if (this.skills.emp.cd <= 0) {
            this.skills.emp.cd = this.skills.emp.max;
            this._empFired = false;
            this._enterState('EMP_ATTACK');
            spawnFloatingText('⚡ CHARGING EMP…', this.x, this.y - 80, '#38bdf8', 26);
            this.speak('Electromagnetic pulse — dodge this!');
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

    // ── QuantumLeap: teleport behind player + immediate SUVAT_CHARGE ──
    _executeQuantumLeap(player) {
        const dx = player.x - this.x, dy = player.y - this.y;
        const d = Math.hypot(dx, dy);
        const behindDist = this.radius + player.radius + 55;
        // Place boss directly behind player (opposite facing direction)
        const playerFacing = Math.atan2(dy, dx);
        const behindAngle = playerFacing + Math.PI;  // behind player
        this.x = player.x + Math.cos(behindAngle) * behindDist;
        this.y = player.y + Math.sin(behindAngle) * behindDist;
        this.vx = 0; this.vy = 0;

        spawnParticles(this.x, this.y, 25, '#00ffff');
        spawnParticles(this.x, this.y, 15, '#39ff14');
        spawnFloatingText('⚫ QUANTUM LEAP!', this.x, this.y - 70, '#00ffff', 26);
        if (typeof addScreenShake === 'function') addScreenShake(12);

        // Set up double charge
        this.skills.suvat.cd = this.skills.suvat.max;
        this._suvatVel = 0;
        this._suvatAimX = player.x;
        this._suvatAimY = player.y;
        this._suvatChargeCount = 1;   // 1 extra rebound charge queued
        this._enterState('SUVAT_CHARGE');
        if (typeof Audio !== 'undefined' && Audio.playBossSpecial) Audio.playBossSpecial();
    }

    takeDamage(amt) {
        if (this._inSafeZone) return; // push-out กำลัง active — immune damage ชั่วคราว
        if (typeof GravitationalSingularity !== 'undefined' && GravitationalSingularity.isInvincible()) {
            spawnFloatingText('DOMAIN SHIELD!', this.x, this.y - 40, '#39ff14', 20);
            return;
        }
        if (this.state === 'FREE_FALL' && this.stateTimer < this.FREE_FALL_WARN) return; // invulnerable
        this.hp -= amt;
        this.hitFlashTimer = 0.12;
        spawnParticles(this.x, this.y, 3, '#39ff14');

        // ── Derivation Mode: HP < 40% — "งั้นมาคำนวณกันให้จริงจัง" ─────
        // Fires once. Reduces all cooldown maxes by 35% and unlocks
        // formulaZone + parabolic skills for relentless pressure.
        if (!this._derivationMode && this.hp <= this.maxHp * 0.40 && this.hp > 0) {
            this._derivationMode = true;
            this._derivationTaunted = true;
            // Reduce all cooldown maxes by 35%
            for (const sk of Object.values(this.skills)) {
                sk.max = Math.max(2.5, sk.max * 0.65);
                sk.cd = Math.min(sk.cd, sk.max); // clamp current cd
            }
            // Fire ParabolicVolley immediately as announcement
            if (typeof ParabolicVolley !== 'undefined') {
                ParabolicVolley.fire(this.x, this.y,
                    window.player?.x ?? this.x + 100,
                    window.player?.y ?? this.y + 100,
                    this.isAdvanced);
            }
            spawnFloatingText('⚛️ DERIVATION MODE', this.x, this.y - 100, '#39ff14', 34);
            spawnFloatingText('d/dt ALL COOLDOWNS ×0.65', this.x, this.y - 135, '#a3e635', 18);
            addScreenShake(18);
            spawnParticles(this.x, this.y, 50, '#39ff14');
            spawnParticles(this.x, this.y, 30, '#00ffff');
            this._enterState('BERSERK');
            this.speak('กลับไปทบทวนสมการกันหน่อย!');
            Audio.playBossSpecial();
        }

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
            // KruFirst-specific death VFX before shared cleanup
            spawnParticles(this.x, this.y, 60, '#39ff14');
            spawnParticles(this.x, this.y, 30, '#00ffff');
            spawnFloatingText('⚛️ PHYSICS DISMISSED!', this.x, this.y, '#39ff14', 35);
            // ── INCREMENT STAT: ต้องทำก่อน check() เพื่อให้ condition เป็น true ──
            if (typeof Achievements !== 'undefined') {
                Achievements.stats.firstKills = (Achievements.stats.firstKills ?? 0) + 1;
                Achievements.check('first_down');
            }
            this._onDeath();
        }
    }

    // draw() → BossRenderer.drawBossFirst(e, ctx)

}


// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.KruFirst = KruFirst;
window.BossFirst = KruFirst;  // backward-compat alias (WaveManager, AdminSystem)