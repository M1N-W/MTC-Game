'use strict';

// ════════════════════════════════════════════════════════════
// 🌾 POOM PLAYER
// ════════════════════════════════════════════════════════════
class PoomPlayer extends Player {
    constructor() {
        // ── ให้ Player constructor ตั้งค่า base properties ทั้งหมด ──
        super('poom');

        // ── Override baseCritChance ด้วยค่าจาก config ของภูมิ ──
        // (Player ใช้ stats.baseCritChance แต่ poom config ใช้ key ว่า critChance)
        this.baseCritChance = this.stats.critChance;

        // ── เพิ่ม cooldown slots พิเศษของภูมิ ──
        // (Player constructor สร้าง { dash, stealth, shoot } ไว้แล้ว)
        this.cooldowns.eat = 0;
        this.cooldowns.naga = 0;
        this.cooldowns.ritual = 0;

        // ── State เฉพาะของภูมิ ──────────────────────────────────
        this.isEatingRice = false;
        this.eatRiceTimer = 0;
        this.currentSpeedMult = 1;
        this.nagaCount = 0;
        this.naga = null;

        // ── Session C: Legacy sticky system removed - using StatusEffect framework ──
        this.ritualPoints = 0;
        this.nagaRiteState = {
            active: false,
            castRemaining: 0,
            windowRemaining: 0,
            cooldownRemaining: 0
        };
    }

    // ── Second Wind: computed live, no timer needed ──────────
    get isSecondWind() {
        return this.hp > 0 && (this.hp / this.maxHp) <= (BALANCE.player.secondWindHpPct || 0.2);
    }

    update(dt, keys, mouse) {
        const S = this.stats;
        const PHY = BALANCE.physics;

        // ── Contact Warning Timer (ใช้โดย PlayerRenderer.draw contact ring) ──
        if (this._contactWarningTimer > 0) {
            this._contactWarningTimer = Math.max(0, this._contactWarningTimer - dt);
        }

        // ── Combo System Update ────────────────────────────────
        if (this.comboCount > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                this.comboTimer = 0;
            }
        }

        if (this.isBurning) {
            this.burnTimer -= dt; this.hp -= this.burnDamage * dt;
            if (this.burnTimer <= 0) this.isBurning = false;
            if (Math.random() < 0.3) spawnParticles(this.x + rand(-15, 15), this.y + rand(-15, 15), 1, '#f59e0b');
        }
        if (this.isConfused) {
            this.confusedTimer -= dt;
            if (this.confusedTimer <= 0) { this.isConfused = false; this.confusedTimer = 0; }
        }
        if (this.speedBoostTimer > 0) this.speedBoostTimer -= dt;
        // ── goldenAuraTimer tick (was missing from PoomPlayer) ──
        if (this.goldenAuraTimer > 0) {
            this.goldenAuraTimer -= dt;
            if (Math.random() < 0.5) spawnParticles(this.x + rand(-25, 25), this.y + rand(-25, 25), 1, '#fbbf24');
        }

        if (this.isEatingRice) {
            this.eatRiceTimer -= dt;
            this.currentSpeedMult = S.eatRiceSpeedMult;
            if (Math.random() < 0.2) spawnParticles(this.x + rand(-20, 20), this.y + rand(-20, 20), 1, '#fbbf24');
            if (this.eatRiceTimer <= 0) {
                this.isEatingRice = false;
                this.currentSpeedMult = 1;
                spawnFloatingText('หมดฤทธิ์!', this.x, this.y - 40, '#94a3b8', 14);
            }
        }

        let ax = 0, ay = 0, isTouchMove = false;
        if (window.touchJoystickLeft && window.touchJoystickLeft.active) {
            ax = window.touchJoystickLeft.nx; ay = window.touchJoystickLeft.ny; isTouchMove = true;
        } else {
            if (keys.w) ay -= 1; if (keys.s) ay += 1;
            if (keys.a) ax -= 1; if (keys.d) ax += 1;
        }
        if (this.isConfused) { ax *= -1; ay *= -1; }
        if (ax || ay) {
            if (!isTouchMove) { const len = Math.hypot(ax, ay); ax /= len; ay /= len; }
            this.walkCycle += dt * 15;
        } else { this.walkCycle = 0; }

        let speedMult = this.currentSpeedMult * this.speedBoost;
        if (this.speedBoostTimer > 0) speedMult += S.speedOnHit / S.moveSpeed;
        if (this.obstacleBuffTimer > 0) speedMult *= BALANCE.player.obstacleBuffPower;

        // ── Apply Combo Speed Buff ──
        speedMult *= (1 + ((this.comboCount || 0) * 0.01));
        // ── Second Wind Speed Buff ──
        if (this.isSecondWind) {
            speedMult *= (BALANCE.player.secondWindSpeedMult || 1.3);
            if (Math.random() < 0.1) spawnParticles(this.x + rand(-15, 15), this.y + rand(-15, 15), 1, '#ef4444');
        }

        if (!this.isDashing) {
            this.vx += ax * PHY.acceleration * dt;
            this.vy += ay * PHY.acceleration * dt;
            this.vx *= PHY.friction;
            this.vy *= PHY.friction;
            const cs = Math.hypot(this.vx, this.vy);
            if (cs > S.moveSpeed * speedMult) {
                const scale = S.moveSpeed * speedMult / cs;
                this.vx *= scale; this.vy *= scale;
            }
        }
        this.applyPhysics(dt);
        this.x = clamp(this.x, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);
        this.y = clamp(this.y, -GAME_CONFIG.physics.worldBounds, GAME_CONFIG.physics.worldBounds);

        if (!this.isDashing) {
            this.checkObstacleProximity(ax, ay, dt, '#fcd34d');
        }

        if (this.cooldowns.dash > 0) this.cooldowns.dash -= dt;
        if (this.cooldowns.eat > 0) this.cooldowns.eat -= dt;
        if (this.cooldowns.naga > 0) this.cooldowns.naga -= dt;
        if (this.cooldowns.shoot > 0) this.cooldowns.shoot -= dt;
        if (this.cooldowns.ritual > 0) this.cooldowns.ritual -= dt; // ── Phase 3 Session 2 ──
        if ((this.graphBuffTimer ?? 0) > 0) this.graphBuffTimer = Math.max(0, this.graphBuffTimer - dt);
        // ── Session C: updateStickyStacks removed - enemies manage their own status expiration ──

        // ── Update Naga Rite State ─────────────────────────────
        const riteState = this.nagaRiteState;
        if (riteState.cooldownRemaining > 0) {
            riteState.cooldownRemaining -= dt;
        }
        if (riteState.castRemaining > 0) {
            riteState.castRemaining -= dt;
            if (riteState.castRemaining <= 0) {
                riteState.active = true;
                riteState.windowRemaining = GAME_CONFIG.abilities.ritual.windowDuration;
                spawnFloatingText('พิธีเริ่ม!', this.x, this.y - 40, '#10b981', 22);
            }
        }
        if (riteState.active) {
            riteState.windowRemaining -= dt;
            if (riteState.windowRemaining <= 0) {
                riteState.active = false;
                spawnFloatingText('พิธีสิ้นสุด', this.x, this.y - 40, '#94a3b8', 14);
            }
        }

        // ── Dash Input (space) — เช็ค groundedTimer เหมือน PlayerBase ──
        if (checkInput('space')) {
            if (this.cooldowns.dash <= 0 && this.groundedTimer <= 0) {
                this.dash(ax || 1, ay || 0);
                consumeInput('space');
            } else if (this.groundedTimer > 0) {
                consumeInput('space'); // consume silently — dash blocked by Grounded
            }
        }
        if (keys.e && this.cooldowns.eat <= 0 && !this.isEatingRice) { consumeInput('e'); } // E reserved — eat via R-Click only
        // ── Updated Controls: R = Ritual Burst, Q = Naga Summon ──
        if (checkInput('r') && this.cooldowns.ritual <= 0) {
            this.ritualBurst();
            consumeInput('r');
        }
        if (checkInput('q') && this.cooldowns.naga <= 0) {
            this.summonNaga();
            consumeInput('q');
        }

        this.energy = Math.min(this.maxEnergy, this.energy + S.energyRegen * dt);

        if (this.naga && this.naga.dead) {
            this.naga = null;
        }

        if (window.touchJoystickRight && window.touchJoystickRight.active) {
            this.angle = Math.atan2(window.touchJoystickRight.ny, window.touchJoystickRight.nx);
        } else {
            this.angle = Math.atan2(mouse.wy - this.y, mouse.wx - this.x);
        }

        for (let i = this.dashGhosts.length - 1; i >= 0; i--) {
            this.dashGhosts[i].life -= dt * 5;
            if (this.dashGhosts[i].life <= 0) this.dashGhosts.splice(i, 1);
        }

        if (typeof _standAura_update === 'function') _standAura_update(this, dt);

        if (this.dead && this.dashTimeouts && this.dashTimeouts.length) {
            const ids = this.dashTimeouts.slice();
            this.dashTimeouts.length = 0;
            for (const timeoutId of ids) {
                try { clearTimeout(timeoutId); } catch (e) { }
            }
        }
        this.updateUI();
    }

    shoot() {
        const S = this.stats;
        if (this.cooldowns.shoot > 0) return;
        this.cooldowns.shoot = S.riceCooldown * this.cooldownMultiplier;
        const { damage, isCrit } = this.dealDamage(S.riceDamage * this.damageBoost * (this.damageMultiplier || 1.0));
        const proj = new Projectile(this.x, this.y, this.angle, S.riceSpeed, damage, S.riceColor, false, 'player');
        proj.isPoom = true;
        proj.isCrit = isCrit;
        // Apply sticky stack on direct hit (Fragment projectiles bypass this)
        const self = this;
        proj.onHit = function (enemy) {
            self.applyStickyTo(enemy);
        };
        projectileManager.add(proj);
        if (isCrit) spawnFloatingText('สาดข้าว!', this.x, this.y - 40, '#fbbf24', 18);
        this.speedBoostTimer = S.speedOnHitDuration;
        // NOTE: Audio.playPoomShoot() is called in shootPoom() (game.js) — the
        // actual execution path.  This method returns early because shootPoom()
        // consumes the cooldown first.  Audio lives in game.js to avoid double-fire.
    }

    eatRice() {
        const S = this.stats;
        this.isEatingRice = true;
        this.eatRiceTimer = S.eatRiceDuration;
        this.cooldowns.eat = S.eatRiceCooldown * this.cooldownMultiplier;
        spawnParticles(this.x, this.y, 30, '#fbbf24');
        spawnFloatingText('กินข้าวเหนียว!', this.x, this.y - 50, '#fbbf24', 22);
        if (typeof UIManager !== 'undefined') UIManager.showVoiceBubble('อร่อยแท้ๆ!', this.x, this.y - 40);
        addScreenShake(5); Audio.playPowerUp();
    }

    summonNaga() {
        const S = this.stats;
        this.cooldowns.naga = S.nagaCooldown * this.cooldownMultiplier;
        this.naga = new NagaEntity(this.x, this.y, this);
        window.specialEffects.push(this.naga);
        spawnParticles(this.x, this.y, 40, '#10b981');
        spawnFloatingText('อัญเชิญพญานาค!', this.x, this.y - 60, '#10b981', 24);
        if (typeof UIManager !== 'undefined') UIManager.showVoiceBubble('ขอพรพญานาค!', this.x, this.y - 40);
        addScreenShake(10); Audio.playAchievement();
        this.nagaCount++;
        if (this.nagaCount >= 3) Achievements.check('naga_summoner');
    }

    // ════════════════════════════════════════════════════════════
    // 🌾 RITUAL BURST — Phase 3 Session 1
    // Consumes all sticky stacks and deals bonus damage to each
    // stacked enemy. Triggered by Shift+R.
    // CONSTRAINT: Only runs on key press, never every frame.
    // CONSTRAINT: Does not affect projectile or slow logic.
    // ════════════════════════════════════════════════════════════
    ritualBurst() {
        // ── Session C/D: Read sticky from StatusEffect framework ──
        if (!GAME_CONFIG || !GAME_CONFIG.abilities || !GAME_CONFIG.abilities.ritual) {
            console.error('[Poom] GAME_CONFIG.abilities.ritual not found! Cannot execute ritual burst.');
            return;
        }
        const RC = GAME_CONFIG.abilities.ritual;
        const DAMAGE_PER_STACK = RC.damagePerStack || 10;

        let totalEnemiesAffected = 0;
        let ritualKills = 0;  // ✨ [ritual_wipe] นับเฉพาะตัวที่ตายจาก ritual นี้ 

        // Iterate all living enemies and consume their sticky status
        if (window.enemies && window.enemies.length > 0) {
            for (const enemy of window.enemies) {
                if (enemy.dead) continue;

                if (typeof enemy.getStatus !== 'function') continue;
                const stickyStatus = enemy.getStatus('sticky');
                if (stickyStatus && stickyStatus.stacks > 0) {
                    // Deal damage based on stacks (flat + percentage)
                    const flatDamage = stickyStatus.stacks * DAMAGE_PER_STACK;
                    const pctDamage = enemy.maxHp * RC.stackBurstPct * stickyStatus.stacks;
                    const totalDamage = flatDamage + pctDamage;
                    const wasAlive = true; // ผ่าน if(enemy.dead) มาแล้ว
                    enemy.takeDamage(totalDamage, this);
                    if (enemy.dead) ritualKills++;
                    spawnFloatingText(Math.round(totalDamage), enemy.x, enemy.y - 30, '#00ff88', 16);

                    // Remove sticky status
                    enemy.removeStatus('sticky');
                    totalEnemiesAffected++;
                }
            }
        }

        // Always trigger cooldown and effects
        if (totalEnemiesAffected === 0) {
            console.log('[Poom] No sticky enemies found - dealing base ritual damage');
            // Deal base damage to nearby enemies without sticky
            const BASE_DAMAGE = RC.baseDamage || 75;
            const BASE_DAMAGE_PCT = RC.baseDamagePct || 0.15;
            const RITUAL_RANGE = RC.range || 280;

            if (window.enemies && window.enemies.length > 0) {
                for (const enemy of window.enemies) {
                    if (enemy.dead) continue;
                    const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
                    if (dist <= RITUAL_RANGE) {
                        // Calculate damage: flat base + percentage of max HP
                        const flatDamage = BASE_DAMAGE;
                        const pctDamage = enemy.maxHp * BASE_DAMAGE_PCT;
                        const totalDamage = flatDamage + pctDamage;

                        enemy.takeDamage(totalDamage, this);
                        const alreadyDead = false; // ผ่าน if(enemy.dead) มาแล้ว
                        if (enemy.dead) ritualKills++;
                        spawnFloatingText(Math.round(totalDamage), enemy.x, enemy.y - 30, '#00ff88', 16);
                        totalEnemiesAffected++;
                    }
                }
            }

            if (totalEnemiesAffected === 0) {
                console.log('[Poom] No enemies in range - ritual used anyway');
            } else {
                console.log(`[Poom] Ritual dealt base damage to ${totalEnemiesAffected} enemies`);
            }
        } else {
            console.log(`[Poom] Ritual burst consumed sticky on ${totalEnemiesAffected} enemies`);
        }

        // Always set cooldown
        this.cooldowns.ritual = RC.cooldown || 20;
        // ✨ [ritual_wipe] ปลดล็อคถ้าฆ่า 3+ ตัวในครั้งเดียว
        if (ritualKills >= 3 && typeof Achievements !== 'undefined') {
            Achievements._ritualWipeUnlocked = true;
            Achievements.check('ritual_wipe');
        }

        // ── Boss: เช็คทุกครั้ง ไม่ขึ้นกับ totalEnemiesAffected ──
        // Boss ไม่มี StatusEffect framework → ใช้ stickyStacks property แทน
        const currentBoss = window.boss;
        if (currentBoss && !currentBoss.dead) {
            const bx = currentBoss.x;
            const by = currentBoss.y;
            const bd = Math.max(0, Math.hypot(bx - this.x, by - this.y) - (currentBoss.radius || 0));
            const RITUAL_RANGE = RC.range || 280;
            if (bd <= RITUAL_RANGE) {
                const bossStacks = currentBoss.stickyStacks || 0;
                let bossDmg;
                if (bossStacks > 0) {
                    // มี stack → คำนวณแบบเดียวกับ enemy ทั่วไป
                    const flatDamage = bossStacks * DAMAGE_PER_STACK;
                    const pctDamage = currentBoss.maxHp * RC.stackBurstPct * bossStacks;
                    bossDmg = flatDamage + pctDamage;
                    currentBoss.stickyStacks = 0; // consume stacks
                    spawnFloatingText(`🌾💥 ${Math.round(bossDmg)}`, bx, by - 60, '#00ff88', 24);
                } else {
                    // ไม่มี stack → base damage
                    bossDmg = (RC.baseDamage || 75) + currentBoss.maxHp * (RC.baseDamagePct || 0.15);
                    spawnFloatingText(`🌾 ${Math.round(bossDmg)}`, bx, by - 60, '#00ff88', 20);
                }
                currentBoss.takeDamage(bossDmg);
            }
        }

        spawnParticles(this.x, this.y, 30, '#00ff88');
        spawnFloatingText('RITUAL BURST!', this.x, this.y - 50, '#00ff88', 22);
        addScreenShake(6);
        if (typeof Audio !== 'undefined' && Audio.playRitualBurst) Audio.playRitualBurst();
    }

    dash(ax, ay) {
        const S = this.stats;
        if (this.isDashing) return;
        this.isDashing = true;
        this.cooldowns.dash = S.dashCooldown * this.cooldownMultiplier;
        const angle = (ax === 0 && ay === 0) ? this.angle : Math.atan2(ay, ax);
        let dashSpeed = S.dashDistance / 0.2;
        let currentScale = 1.0;
        if (typeof window.timeScale === 'number' && Number.isFinite(window.timeScale)) {
            currentScale = window.timeScale;
        }
        currentScale = Math.min(10.0, Math.max(0.1, currentScale));
        if (currentScale < 1.0) {
            const matrixMult = (1 / currentScale) * 1.5;
            dashSpeed *= matrixMult;
        }
        this.vx = Math.cos(angle) * dashSpeed;
        this.vy = Math.sin(angle) * dashSpeed;
        for (let i = 0; i < 5; i++) {
            const timeoutId = setTimeout(() => {
                if (!this.dead) this.dashGhosts.push({ x: this.x, y: this.y, angle: this.angle, life: 1 });
                const idx = this.dashTimeouts.indexOf(timeoutId);
                if (idx > -1) this.dashTimeouts.splice(idx, 1);
            }, i * 30);
            this.dashTimeouts.push(timeoutId);
        }
        spawnParticles(this.x, this.y, 15, '#fbbf24');
        Audio.playDash(); Achievements.stats.dashes++; Achievements.check('speedster');
        const dashEndTimeoutId = setTimeout(() => { if (!this.dead) this.isDashing = false; }, 200);
        this.dashTimeouts.push(dashEndTimeoutId);
    }

    takeDamage(amt) {
        // ── Naga Shield: ขณะ Naga มีชีวิตและ active → ภูมิอยู่ยงคงกระพัน ──
        if (this.naga && !this.naga.dead && this.naga.active) return;
        // ── Graph Risk ────────────────────────────────────────────
        // (ไม่ผ่าน super เพราะ PlayerBase.takeDamage ก็เช็คอยู่แล้ว — x2 แทน x1.5 ของ Kao)
        if (this.onGraph) {
            amt *= 2;
            spawnFloatingText('EXPOSED!', this.x, this.y - 40, '#ef4444', 16);
        }
        // ── ส่งต่อระบบ contact warning + ตัวเลขกรอง + dead flag ──
        Player.prototype.takeDamage.call(this, amt);
    }

    dealDamage(baseDamage) {
        const S = this.stats;
        let damage = baseDamage, isCrit = false;
        let critChance = this.baseCritChance;
        if (this.isEatingRice) critChance += S.eatRiceCritBonus;
        if (Math.random() < critChance) {
            damage *= S.critMultiplier; isCrit = true;
            if (this.passiveUnlocked) this.goldenAuraTimer = 1;
            Achievements.stats.crits++; Achievements.check('crit_master');
        }
        // ── Second Wind Damage Multiplier ──
        if (this.isSecondWind) {
            damage *= (BALANCE.player.secondWindDamageMult || 1.5);
        }
        // ── Graph Buff: ยืนบนเลเซอร์ระยะ 3 → ดาเมจ x1.5 ─────
        if ((this.graphBuffTimer ?? 0) > 0) damage *= 1.5;
        // ── Passive Lifesteal ──
        if (this.passiveUnlocked) {
            const healAmount = damage * S.passiveLifesteal;
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            if (Math.random() < 0.3) spawnFloatingText(`+${Math.round(healAmount)}`, this.x, this.y - 35, '#10b981', 12);
        }
        return { damage, isCrit };
    }

    heal(amt) {
        this.hp = Math.min(this.maxHp, this.hp + amt);
        spawnFloatingText(`+${amt} HP`, this.x, this.y - 30, '#10b981');
        spawnParticles(this.x, this.y, 10, '#10b981'); Audio.playHeal();
    }

    addSpeedBoost() { this.speedBoostTimer = this.stats.speedOnHitDuration; }

    // ════════════════════════════════════════════════════════════
    // 🌾 STICKY RICE STACK SYSTEM
    // ════════════════════════════════════════════════════════════

    // ════════════════════════════════════════════════════════════
    // 🌾 SESSION B/C: STICKY ADAPTER - StatusEffect Framework
    // ════════════════════════════════════════════════════════════

    /**
     * Apply sticky status effect to enemy using StatusEffect framework
     * @param {object} enemy - Enemy instance
     */
    applyStickyTo(enemy) {
        if (!enemy) return;
        const S = this.stats;

        // ── Boss: ไม่มี StatusEffect framework → ใช้ stickyStacks property ตรงๆ ──
        if (typeof enemy.addStatus !== 'function') {
            if (typeof enemy.stickyStacks === 'number') {
                enemy.stickyStacks = Math.min((enemy.stickyStacks || 0) + 1, 10);
            }
            return;
        }

        // ── Enemy ปกติ: ใช้ StatusEffect framework ──
        const now = performance.now() / 1000;
        const stackDuration = S.sticky.stackDuration || 5;
        const slowPerStack = 0.04;

        enemy.addStatus('sticky', {
            stacks: 1,
            expireAt: now + stackDuration,
            meta: { slowPerStack: slowPerStack }
        });
    }

    // draw() ย้ายไป PlayerRenderer._drawPoom() แล้ว


    updateUI() {
        const S = this.stats;
        const hpBar = document.getElementById('hp-bar');
        const enBar = document.getElementById('en-bar');
        if (hpBar) hpBar.style.width = `${this.hp / this.maxHp * 100}%`;
        if (enBar) enBar.style.width = `${this.energy / this.maxEnergy * 100}%`;

        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('dash-icon',
                Math.max(0, this.cooldowns.dash), S.dashCooldown);
        }

        const eatIcon = document.getElementById('eat-icon');
        if (this.isEatingRice) eatIcon?.classList.add('active');
        else eatIcon?.classList.remove('active');
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('eat-icon',
                this.isEatingRice ? 0 : Math.max(0, this.cooldowns.eat),
                S.eatRiceCooldown);
        }

        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            UIManager._setCooldownVisual('naga-icon',
                Math.max(0, this.cooldowns.naga), S.nagaCooldown);
        }

        // ── Phase 3 Session 3: Ritual cooldown — mirrored in ui.js updateSkillIcons ──
        if (typeof UIManager !== 'undefined' && UIManager._setCooldownVisual) {
            const maxRcd = GAME_CONFIG?.abilities?.ritual?.cooldown || 20;
            UIManager._setCooldownVisual('ritual-icon',
                Math.max(0, this.cooldowns.ritual), maxRcd);
        }

        const levelEl = document.getElementById('player-level');
        if (levelEl) levelEl.textContent = `Lv.${this.level}`;
        const expBar = document.getElementById('exp-bar');
        if (expBar) expBar.style.width = `${(this.exp / this.expToNextLevel) * 100}%`;
    }
}

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.PoomPlayer = PoomPlayer;