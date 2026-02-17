/**
 * 🎮 MTC: ENHANCED EDITION - Main Game Loop
 * Game state, Boss, waves, input, loop
 *
 * REFACTORED (Database Feature — v3):
 * - ✅ MTC_DATABASE_SERVER — fixed world position for the interactive server object
 * - ✅ Proximity detection → shows db-prompt + HUD icon
 * - ✅ 'E' key / mobile btn-database → openExternalDatabase()
 *        → window.open(MTC_DB_URL, '_blank')  [external Claude Artifact]
 * - ✅ gameState = 'PAUSED' when DB is opened or window loses focus (blur)
 * - ✅ window.blur   → auto-pause
 * - ✅ window.focus  → keep paused, ensure resume prompt is visible
 * - ✅ resumeGame()  → restores gameState = 'PLAYING', resets keys, hides prompt
 * - ✅ Any key-press while PAUSED in-game → resumeGame()
 * - ✅ drawDatabaseServer() — glowing cyan server drawn on map each frame
 * - ✅ No local file dependency — fully external URL
 */

// ─── Game State ───────────────────────────────────────────
let gameState  = 'MENU';
let loopRunning = false;
const keys = { w: 0, a: 0, s: 0, d: 0, space: 0, q: 0, e: 0 };

// ─── Game Objects (global) ────────────────────────────────
window.player         = null;
window.enemies        = [];
window.boss           = null;
window.powerups       = [];
window.specialEffects = [];
window.meteorZones    = [];
let waveStartDamage   = 0;

// ─── MTC Database Server ──────────────────────────────────
/**
 * Fixed world-space position of the interactive "MTC Database" server.
 * Placed at (350, -350) — away from spawn so players must explore to find it.
 */
const MTC_DATABASE_SERVER = {
    x: 350,
    y: -350,
    INTERACTION_RADIUS: 90   // world units — must be within this to interact
};

// ─── External Database URL ────────────────────────────────
/**
 * The Claude Artifact that serves as the MTC Math Explorer.
 * Update this constant whenever the artifact URL changes —
 * it is the single source of truth used by openExternalDatabase().
 */
const MTC_DB_URL = 'https://claude.ai/public/artifacts/9779928b-11d1-442b-b17d-2ef5045b9660';

// ─── Database / Pause Helper Functions ───────────────────

/**
 * showResumePrompt(visible)
 * Toggles the lightweight #resume-prompt overlay and the
 * top-center #pause-indicator strip.
 */
function showResumePrompt(visible) {
    const el    = document.getElementById('resume-prompt');
    const strip = document.getElementById('pause-indicator');
    if (el)    el.style.display    = visible ? 'flex'  : 'none';
    if (strip) strip.style.display = visible ? 'block' : 'none';
}

/**
 * openExternalDatabase()
 * Pauses the game and opens the MTC Math Explorer Claude Artifact
 * in a new browser tab. Zero iframe overhead — fully external.
 */
function openExternalDatabase() {
    if (gameState !== 'PLAYING') return;
    gameState = 'PAUSED';

    // Open the external Claude Artifact in a new tab
    window.open(MTC_DB_URL, '_blank');

    showResumePrompt(true);

    // Hide proximity prompt while DB is open
    const promptEl = document.getElementById('db-prompt');
    if (promptEl) promptEl.style.display = 'none';

    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    if (player) spawnFloatingText('📚 MTC DATABASE', player.x, player.y - 60, '#06b6d4', 22);
}

/**
 * resumeGame()
 * Resumes the game from a paused state (DB opened or window blur).
 * Resets all key states to prevent stuck input on resume.
 */
function resumeGame() {
    if (gameState !== 'PAUSED') return;
    gameState = 'PLAYING';

    showResumePrompt(false);

    // Reset all held keys so nothing is "stuck" on resume
    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0;

    // Recapture keyboard focus from the new tab back to the game window
    window.focus();

    if (player) spawnFloatingText('▶ RESUMED', player.x, player.y - 50, '#34d399', 18);
}

// ── Backward-compatible aliases ────────────────────────────
// Kept so any external code referencing the old names still works.
function openDatabase()   { openExternalDatabase(); }
function showMathModal()  { openExternalDatabase(); }
function closeMathModal() { resumeGame(); }

// Expose all to global scope
window.openExternalDatabase = openExternalDatabase;
window.openDatabase         = openDatabase;
window.resumeGame           = resumeGame;
window.showMathModal        = showMathModal;
window.closeMathModal       = closeMathModal;

// ─── Window Focus / Blur Listeners ───────────────────────
/**
 * Auto-pause when the player switches away from the game tab
 * (e.g. to look at the math archive they just opened, or
 *  any other reason the window loses focus).
 */
window.addEventListener('blur', () => {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        showResumePrompt(true);
    }
});

/**
 * When focus returns, keep the game paused and ensure the
 * resume prompt is visible so the player isn't caught off guard.
 * The player must consciously click "Resume" or press a key.
 */
window.addEventListener('focus', () => {
    if (gameState === 'PAUSED') {
        showResumePrompt(true);  // already showing, but force-visible in case it was hidden
    }
});

// ─── Draw the Database Server on the map ─────────────────
/**
 * drawDatabaseServer()
 * Draws a glowing cyan server rack at MTC_DATABASE_SERVER world position.
 * Called inside drawGame() every frame.
 */
function drawDatabaseServer() {
    const screen = worldToScreen(MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const t    = performance.now() / 600;
    const glow = Math.abs(Math.sin(t)) * 0.5 + 0.5;

    // Interaction radius ring (subtle, only visible when nearby)
    if (player) {
        const d = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
        if (d < MTC_DATABASE_SERVER.INTERACTION_RADIUS * 2) {
            const alpha = Math.max(0, 1 - d / (MTC_DATABASE_SERVER.INTERACTION_RADIUS * 2));
            CTX.save();
            CTX.globalAlpha = alpha * 0.25 * glow;
            CTX.strokeStyle = '#06b6d4';
            CTX.lineWidth   = 2;
            CTX.setLineDash([6, 4]);
            CTX.beginPath();
            CTX.arc(screen.x, screen.y, MTC_DATABASE_SERVER.INTERACTION_RADIUS, 0, Math.PI * 2);
            CTX.stroke();
            CTX.setLineDash([]);
            CTX.restore();
        }
    }

    // Shadow
    CTX.fillStyle = 'rgba(0,0,0,0.35)';
    CTX.beginPath();
    CTX.ellipse(screen.x, screen.y + 28, 18, 7, 0, 0, Math.PI * 2);
    CTX.fill();

    // Server rack body
    CTX.save();
    CTX.translate(screen.x, screen.y);
    CTX.shadowBlur  = 14 * glow;
    CTX.shadowColor = '#06b6d4';

    CTX.fillStyle   = '#0c1a2e';
    CTX.strokeStyle = '#06b6d4';
    CTX.lineWidth   = 2;
    CTX.beginPath();
    CTX.roundRect(-18, -26, 36, 50, 5);
    CTX.fill();
    CTX.stroke();

    // Rack unit slots
    for (let i = 0; i < 3; i++) {
        // Slot bg
        CTX.fillStyle = '#0f2744';
        CTX.fillRect(-14, -20 + i * 14, 28, 10);

        // Status bar
        CTX.fillStyle = i === 0 ? '#22c55e' : '#0e7490';
        CTX.fillRect(-12, -18 + i * 14, 10, 6);

        // LED
        CTX.fillStyle   = i === 1 ? `rgba(6,182,212,${glow})` : '#22c55e';
        CTX.shadowBlur  = 6;
        CTX.shadowColor = i === 1 ? '#06b6d4' : '#22c55e';
        CTX.beginPath();
        CTX.arc(10, -15 + i * 14, 3.5, 0, Math.PI * 2);
        CTX.fill();
    }

    // Label
    CTX.shadowBlur = 0;
    CTX.fillStyle  = '#67e8f9';
    CTX.font       = 'bold 7px Arial';
    CTX.textAlign  = 'center';
    CTX.textBaseline = 'middle';
    CTX.fillText('MTC DATABASE', 0, 33);

    CTX.restore();
}

// ─── Proximity UI updater ─────────────────────────────────
/**
 * updateDatabaseServerUI()
 * Called each frame while PLAYING.
 * Shows / hides the "Press E" prompt and HUD/mobile shortcuts.
 */
function updateDatabaseServerUI() {
    if (!player) return;
    const d    = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    const near = d < MTC_DATABASE_SERVER.INTERACTION_RADIUS;

    const promptEl  = document.getElementById('db-prompt');
    const hudIcon   = document.getElementById('db-hud-icon');
    const btnDb     = document.getElementById('btn-database');

    if (promptEl) promptEl.style.display = near ? 'block' : 'none';
    if (hudIcon)  hudIcon.style.display  = near ? 'flex'  : 'none';
    if (btnDb)    btnDb.style.display    = near ? 'flex'  : 'none';
}

// ==================== BOSS ====================
class Boss extends Entity {
    constructor(difficulty = 1) {
        super(0, BALANCE.boss.spawnY, BALANCE.boss.radius);
        this.maxHp     = BALANCE.boss.baseHp * difficulty;
        this.hp        = this.maxHp;
        this.name      = "KRU MANOP";
        this.state     = 'CHASE';
        this.timer     = 0;
        this.moveSpeed = BALANCE.boss.moveSpeed;
        this.difficulty = difficulty;
        this.phase     = 1;
        this.sayTimer  = 0;
        this.skills = {
            slam:  { cd: 0, max: BALANCE.boss.slamCooldown },
            graph: { cd: 0, max: BALANCE.boss.graphCooldown },
            log:   { cd: 0, max: BALANCE.boss.log457Cooldown }
        };
        this.log457State       = null;
        this.log457Timer       = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable    = false;
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
            this.speak("Player at " + Math.round(player.hp) + " HP");
            this.sayTimer = 0;
        }

        if (this.hp < this.maxHp * BALANCE.boss.phase2Threshold && this.phase === 1) {
            this.phase     = 2;
            this.moveSpeed = BALANCE.boss.phase2Speed;
            spawnFloatingText("ENRAGED!", this.x, this.y - 80, '#ef4444', 40);
            addScreenShake(20);
            this.speak("Enough playing around!");
            Audio.playBossSpecial();
        }

        if (this.log457State === 'charging') {
            this.log457Timer += dt;
            this.isInvulnerable = true;
            this.hp = Math.min(this.maxHp, this.hp + this.maxHp * BALANCE.boss.log457HealRate * dt);
            if (this.log457Timer >= BALANCE.boss.log457ChargeDuration) {
                this.log457State       = 'active';
                this.log457Timer       = 0;
                this.log457AttackBonus = BALANCE.boss.log457AttackBonus;
                this.isInvulnerable    = false;
                addScreenShake(20);
                spawnFloatingText("67! 67! 67!", this.x, this.y - 80, '#facc15', 35);
                this.speak("0.6767!");
            }
        } else if (this.log457State === 'active') {
            this.log457Timer += dt;
            this.log457AttackBonus += BALANCE.boss.log457AttackGrowth * dt;
            if (this.log457Timer >= BALANCE.boss.log457ActiveDuration) {
                this.log457State = 'stunned';
                this.log457Timer = 0;
                this.vx = 0; this.vy = 0;
                spawnFloatingText("STUNNED!", this.x, this.y - 60, '#94a3b8', 30);
            }
        } else if (this.log457State === 'stunned') {
            this.log457Timer += dt;
            this.vx = 0; this.vy = 0;
            if (this.log457Timer >= BALANCE.boss.log457StunDuration) {
                this.log457State       = null;
                this.log457AttackBonus = 0;
            }
            return;
        }

        if (this.state === 'CHASE') {
            if (!player.isInvisible) {
                this.vx = Math.cos(this.angle) * this.moveSpeed;
                this.vy = Math.sin(this.angle) * this.moveSpeed;
            } else { this.vx *= 0.95; this.vy *= 0.95; }
            this.applyPhysics(dt);

            if (this.timer > 2) {
                this.timer = 0;
                if      (this.skills.log.cd   <= 0 && Math.random() < 0.20) this.useLog457();
                else if (this.skills.graph.cd <= 0 && Math.random() < 0.25) this.useDeadlyGraph(player);
                else if (this.skills.slam.cd  <= 0 && Math.random() < 0.30) this.useEquationSlam();
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
                spawnFloatingText("POP QUIZ!", this.x, this.y - 80, '#facc15', 40);
                Audio.playBossSpecial();
                this.state = 'CHASE';
                this.timer = -1;
            }
        }

        if (d < this.radius + player.radius) {
            player.takeDamage(BALANCE.boss.contactDamage * dt * (1 + this.log457AttackBonus));
        }
        UIManager.updateBossHUD(this);
        UIManager.updateBossSpeech(this);
    }

    useEquationSlam() {
        this.skills.slam.cd = this.skills.slam.max;
        this.state = 'CHASE';
        addScreenShake(15);
        spawnFloatingText("EQUATION SLAM!", this.x, this.y - 80, '#facc15', 30);
        this.speak("Equation Slam!");
        Audio.playBossSpecial();
        window.specialEffects.push(new EquationSlam(this.x, this.y));
    }

    useDeadlyGraph(player) {
        this.skills.graph.cd = this.skills.graph.max;
        this.state = 'CHASE';
        spawnFloatingText("DEADLY GRAPH!", this.x, this.y - 80, '#3b82f6', 30);
        this.speak("Feel the power of y=x!");
        Audio.playBossSpecial();
        window.specialEffects.push(new DeadlyGraph(this.x, this.y, player.x, player.y, BALANCE.boss.graphDuration));
    }

    useLog457() {
        this.skills.log.cd = this.skills.log.max;
        this.log457State   = 'charging';
        this.log457Timer   = 0;
        this.state         = 'CHASE';
        spawnFloatingText("log 4.57 = ?", this.x, this.y - 80, '#ef4444', 30);
        Audio.playBossSpecial();
    }

    async speak(context) {
        try {
            const text = await Gemini.getBossTaunt(context);
            if (text) UIManager.showBossSpeech(text);
        } catch (e) { console.warn('Speech failed:', e); }
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
            spawnFloatingText("CLASS DISMISSED!", this.x, this.y, '#facc15', 35);
            addScore(BALANCE.score.boss * this.difficulty);
            UIManager.updateBossHUD(null);
            Audio.playAchievement();
            for (let i = 0; i < 3; i++) {
                setTimeout(() => window.powerups.push(new PowerUp(this.x + rand(-50,50), this.y + rand(-50,50))), i * 200);
            }
            window.boss = null;
            Achievements.check('boss_down');
            setTimeout(() => {
                setWave(getWave() + 1);
                if (getWave() > BALANCE.waves.maxWaves) window.endGame('victory');
                else startNextWave();
            }, BALANCE.boss.nextWaveDelay);
        }
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save();
        CTX.translate(screen.x, screen.y);

        if (this.log457State === 'charging') {
            const sc = 1 + (this.log457Timer / 2) * 0.3;
            CTX.scale(sc, sc);
            const pu = Math.sin(this.log457Timer * 10) * 0.5 + 0.5;
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.fillStyle = `rgba(239, 68, 68, ${pu * 0.3})`; CTX.fill();
        }

        if (this.log457State === 'active')  { CTX.shadowBlur = 20; CTX.shadowColor = '#facc15'; }
        if (this.log457State === 'stunned') { CTX.font = 'bold 30px Arial'; CTX.textAlign = 'center'; CTX.fillText('😵', 0, -70); }

        if (this.state === 'ULTIMATE') {
            CTX.beginPath(); CTX.arc(0, 0, 70, 0, Math.PI * 2);
            CTX.strokeStyle = `rgba(239, 68, 68, ${Math.random()})`;
            CTX.lineWidth = 5; CTX.stroke();
        }
        if (this.phase === 2 && this.log457State !== 'charging') { CTX.shadowBlur = 20; CTX.shadowColor = '#ef4444'; }

        CTX.rotate(this.angle);
        CTX.fillStyle = '#f8fafc'; CTX.fillRect(-30, -30, 60, 60);
        CTX.fillStyle = '#e2e8f0';
        CTX.beginPath(); CTX.moveTo(-30,-30); CTX.lineTo(-20,-20); CTX.lineTo(20,-20); CTX.lineTo(30,-30); CTX.closePath(); CTX.fill();
        CTX.fillStyle = '#ef4444';
        CTX.beginPath(); CTX.moveTo(0,-20); CTX.lineTo(6,0); CTX.lineTo(0,25); CTX.lineTo(-6,0); CTX.closePath(); CTX.fill();
        CTX.fillStyle = this.log457State === 'charging' ? '#ff0000' : '#e2e8f0';
        CTX.beginPath(); CTX.arc(0, 0, 24, 0, Math.PI * 2); CTX.fill();
        CTX.fillStyle = '#94a3b8'; CTX.beginPath(); CTX.arc(0, 0, 26, Math.PI, 0); CTX.fill();
        if (this.phase === 2 || this.log457State === 'active') {
            CTX.fillStyle = '#ef4444';
            CTX.fillRect(-12,-5,10,3); CTX.fillRect(2,-5,10,3);
        }
        CTX.fillStyle = '#facc15'; CTX.fillRect(25, 12, 60, 10);
        CTX.fillStyle = '#000'; CTX.font = 'bold 8px Arial'; CTX.fillText('30cm', 50, 17);
        CTX.restore();
    }
}

// ==================== WAVE SYSTEM ====================
function startNextWave() {
    resetEnemiesKilled();
    waveStartDamage = Achievements.stats.damageTaken;
    setElementText('wave-badge', `WAVE ${getWave()}`);
    spawnFloatingText(`WAVE ${getWave()}`, player.x, player.y - 100, '#8b5cf6', 40);

    const count = BALANCE.waves.enemiesBase + (getWave() - 1) * BALANCE.waves.enemiesPerWave;
    spawnEnemies(count);

    if (getWave() % BALANCE.waves.bossEveryNWaves === 0) {
        setTimeout(() => {
            window.boss = new Boss(Math.floor(getWave() / BALANCE.waves.bossEveryNWaves));
            UIManager.updateBossHUD(window.boss);
            document.getElementById('boss-name').innerHTML =
                `KRU MANOP - LEVEL ${Math.floor(getWave() / BALANCE.waves.bossEveryNWaves)} <span class="ai-badge">AI</span>`;
            spawnFloatingText('BOSS INCOMING!', player.x, player.y - 100, '#ef4444', 35);
            addScreenShake(15);
            Audio.playBossSpecial();
        }, BALANCE.waves.bossSpawnDelay);
    }
}

function spawnEnemies(count) {
    for (let i = 0; i < count; i++) {
        const angle    = Math.random() * Math.PI * 2;
        const distance = BALANCE.waves.spawnDistance;
        let x = player.x + Math.cos(angle) * distance;
        let y = player.y + Math.sin(angle) * distance;
        const safe = mapSystem.findSafeSpawn(x, y, BALANCE.enemy.radius);
        x = safe.x; y = safe.y;
        const r = Math.random();
        if      (r < BALANCE.waves.mageSpawnChance) window.enemies.push(new MageEnemy(x, y));
        else if (r < BALANCE.waves.mageSpawnChance + BALANCE.waves.tankSpawnChance) window.enemies.push(new TankEnemy(x, y));
        else    window.enemies.push(new Enemy(x, y));
    }
}

// ==================== GAME LOOP ====================
function gameLoop(now) {
    const dt = getDeltaTime(now);

    if (gameState === 'PLAYING') {
        updateGame(dt);
        drawGame();
    } else if (gameState === 'PAUSED') {
        // Render frozen scene behind the resume-prompt overlay
        drawGame();
    }

    requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
    updateCamera(player.x, player.y);
    updateMouseWorld();

    // ── Database server: check E key BEFORE player.update()
    //    so PoomPlayer doesn't steal keys.e for eatRice when near server
    const dToServer = dist(player.x, player.y, MTC_DATABASE_SERVER.x, MTC_DATABASE_SERVER.y);
    if (dToServer < MTC_DATABASE_SERVER.INTERACTION_RADIUS && keys.e === 1) {
        keys.e = 0;
        openExternalDatabase();
        return;
    }

    player.update(dt, keys, mouse);

    // ── Weapon system (non-Poom) ──
    if (!(player instanceof PoomPlayer)) {
        weaponSystem.update(dt);
        const burstProjectiles = weaponSystem.updateBurst(player, player.damageBoost);
        if (burstProjectiles && burstProjectiles.length > 0) projectileManager.add(burstProjectiles);
        if (mouse.left === 1 && gameState === 'PLAYING') {
            if (weaponSystem.canShoot()) {
                const projectiles = weaponSystem.shoot(player, player.damageBoost);
                if (projectiles && projectiles.length > 0) projectileManager.add(projectiles);
            }
        }
    }

    // ── Poom input ──
    if (player instanceof PoomPlayer) {
        if (mouse.left === 1 && gameState === 'PLAYING') shootPoom(player);
        if (mouse.right === 1) {
            if (player.cooldowns.eat <= 0 && !player.isEatingRice) player.eatRice();
            mouse.right = 0;
        }
        if (keys.q === 1) {
            if (player.cooldowns.naga <= 0) player.summonNaga();
            keys.q = 0;
        }
        UIManager.updateSkillIcons(player);
    }

    if (boss) boss.update(dt, player);

    for (let i = enemies.length - 1; i >= 0; i--) {
        enemies[i].update(dt, player);
        if (enemies[i].dead) enemies.splice(i, 1);
    }

    if (getWave() % BALANCE.waves.bossEveryNWaves !== 0 && enemies.length === 0 && !boss) {
        if (Achievements.stats.damageTaken === waveStartDamage && getEnemiesKilled() >= BALANCE.waves.minKillsForNoDamage) {
            Achievements.check('no_damage');
        }
        setWave(getWave() + 1);
        Achievements.check('wave_1');
        startNextWave();
    }

    for (let i = specialEffects.length - 1; i >= 0; i--) {
        const remove = specialEffects[i].update(dt, player, meteorZones);
        if (remove) specialEffects.splice(i, 1);
    }

    projectileManager.update(dt, player, enemies, boss);

    for (let i = powerups.length - 1; i >= 0; i--) {
        if (powerups[i].update(dt, player)) powerups.splice(i, 1);
    }

    for (let i = meteorZones.length - 1; i >= 0; i--) {
        meteorZones[i].life -= dt;
        if (dist(meteorZones[i].x, meteorZones[i].y, player.x, player.y) < meteorZones[i].radius) {
            player.takeDamage(meteorZones[i].damage * dt);
        }
        if (meteorZones[i].life <= 0) meteorZones.splice(i, 1);
    }

    mapSystem.update([player, ...enemies, boss].filter(e => e && !e.dead));
    particleSystem.update(dt);
    floatingTextSystem.update(dt);
    updateScreenShake();
    Achievements.checkAll();

    // ── Database proximity UI ──
    updateDatabaseServerUI();
}

function drawGame() {
    const grad = CTX.createLinearGradient(0, 0, 0, CANVAS.height);
    grad.addColorStop(0, GAME_CONFIG.visual.bgColorTop);
    grad.addColorStop(1, GAME_CONFIG.visual.bgColorBottom);
    CTX.fillStyle = grad;
    CTX.fillRect(0, 0, CANVAS.width, CANVAS.height);

    CTX.save();
    const shake = getScreenShakeOffset();
    CTX.translate(shake.x, shake.y);

    drawGrid();

    for (let z of meteorZones) {
        const screen = worldToScreen(z.x, z.y);
        const a = Math.sin(performance.now() / 200) * 0.3 + 0.7;
        CTX.fillStyle = `rgba(239, 68, 68, ${a * 0.4})`;
        CTX.beginPath(); CTX.arc(screen.x, screen.y, z.radius, 0, Math.PI * 2); CTX.fill();
    }

    mapSystem.draw();
    drawDatabaseServer();      // ← MTC Database server object
    powerups.forEach(p => p.draw());
    specialEffects.forEach(e => e.draw());
    player.draw();
    enemies.forEach(e => e.draw());
    if (boss && !boss.dead) boss.draw();
    projectileManager.draw();
    particleSystem.draw();
    floatingTextSystem.draw();

    CTX.restore();
}

function drawGrid() {
    const sz = GAME_CONFIG.physics.gridSize;
    const ox = -getCamera().x % sz;
    const oy = -getCamera().y % sz;
    CTX.strokeStyle = GAME_CONFIG.visual.gridColor;
    CTX.lineWidth = 1;
    CTX.beginPath();
    for (let x = ox; x < CANVAS.width; x += sz) { CTX.moveTo(x, 0); CTX.lineTo(x, CANVAS.height); }
    for (let y = oy; y < CANVAS.height; y += sz) { CTX.moveTo(0, y); CTX.lineTo(CANVAS.width, y); }
    CTX.stroke();
}

// ==================== POOM ATTACK SYSTEM ====================
function shootPoom(player) {
    const S = BALANCE.characters.poom;
    if (player.cooldowns.shoot > 0) return;
    const attackSpeedMult  = player.isEatingRice ? 0.7 : 1.0;
    player.cooldowns.shoot = S.riceCooldown * attackSpeedMult;
    const { damage, isCrit } = player.dealDamage(S.riceDamage * player.damageBoost);
    projectileManager.add(new Projectile(player.x, player.y, player.angle, S.riceSpeed, damage, S.riceColor, false, 'player'));
    if (isCrit) {
        spawnFloatingText('สาดข้าว! CRIT!', player.x, player.y - 45, '#fbbf24', 20);
        spawnParticles(player.x, player.y, 5, '#ffffff');
    }
    player.speedBoostTimer = S.speedOnHitDuration;
}

// ==================== INIT & START ====================
async function initAI() {
    const brief = document.getElementById('mission-brief');
    if (!brief) { console.warn('⚠️ mission-brief not found'); return; }
    brief.textContent = "กำลังโหลดภารกิจ...";
    try {
        const name = await Gemini.getMissionName();
        brief.textContent = `ภารกิจ "${name}"`;
    } catch (e) {
        console.warn('Failed to get mission name:', e);
        brief.textContent = 'ภารกิจ "พิชิตครูมานพ"';
    }
}

function startGame(charType = 'kao') {
    console.log('🎮 Starting game... charType:', charType);
    Audio.init();

    player = charType === 'poom' ? new PoomPlayer() : new Player(charType);

    enemies = []; powerups = []; specialEffects = []; meteorZones = [];
    boss = null;

    UIManager.updateBossHUD(null);
    resetScore();
    setWave(1);
    projectileManager.clear();
    particleSystem.clear();
    floatingTextSystem.clear();
    mapSystem.init();

    // ── Tell WeaponSystem which char is active BEFORE updateWeaponUI().
    //    Wrapped in try-catch so a UI failure never aborts game start. ──
    weaponSystem.setActiveChar(charType);
    try {
        weaponSystem.updateWeaponUI();   // safe for Kao AND Poom (Poom shim in WeaponSystem)
    } catch (err) {
        console.error('[startGame] updateWeaponUI threw — continuing anyway:', err);
    }
    UIManager.setupCharacterHUD(player);

    Achievements.stats.damageTaken = 0;
    waveStartDamage = 0;

    hideElement('overlay');
    hideElement('report-card');

    // ── FIX: Reset report-card stat boxes so replays don't show stale data ──
    UIManager.resetGameOverUI();

    // Ensure resume prompt is hidden on fresh game start
    showResumePrompt(false);

    startNextWave();
    gameState = 'PLAYING';
    resetTime();

    // ── Show mobile controls now that we're in-game, and focus the window
    //    so keyboard events are captured correctly after button tap. ──
    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) mobileUI.style.display = 'block';
    window.focus();

    console.log('✅ Game started!');
    if (!loopRunning) {
        loopRunning = true;
        requestAnimationFrame(gameLoop);
    }
}

async function endGame(result) {
    gameState = 'GAMEOVER';

    // ── Hide mobile joystick zones so they don't block overlay touches ──
    const mobileUI = document.getElementById('mobile-ui');
    if (mobileUI) mobileUI.style.display = 'none';

    // Force-hide resume prompt if game ended while paused
    showResumePrompt(false);

    if (result === 'victory') {
        showElement('victory-screen');
        setElementText('final-score', `SCORE ${getScore()}`);
        setElementText('final-wave',  `WAVES CLEARED ${getWave() - 1}`);
    } else {
        // ── FIX: Snapshot score/wave NOW — async awaits below must not read
        //    stale values if resetScore() is ever called before the promise resolves ──
        const finalScore = getScore();
        const finalWave  = getWave();

        showElement('overlay');

        // ── Delegate all DOM writes to UIManager (single source of truth) ──
        UIManager.showGameOver(finalScore, finalWave);

        // ── AI commentary (async — uses snapshotted values, not live getScore()) ──
        const ld = document.getElementById('ai-loading');
        if (ld) ld.style.display = 'block';
        const reportText = document.getElementById('report-text');
        try {
            const comment = await Gemini.getReportCard(finalScore, finalWave);
            if (ld) ld.style.display = 'none';
            if (reportText) reportText.textContent = comment;
        } catch (e) {
            console.warn('Failed to get AI report card:', e);
            if (ld) ld.style.display = 'none';
            if (reportText) reportText.textContent = 'ตั้งใจเรียนให้มากกว่านี้นะ...';
        }
    }
}

// ==================== INPUT ====================
window.addEventListener('keydown', e => {
    // ── While the game is PAUSED in-game, any key resumes play ──
    // (Excludes MENU and GAMEOVER states where gameState !== 'PAUSED')
    if (gameState === 'PAUSED') {
        resumeGame();
        return;
    }

    if (gameState !== 'PLAYING') return;

    if (e.code === 'KeyW')   keys.w     = 1;
    if (e.code === 'KeyS')   keys.s     = 1;
    if (e.code === 'KeyA')   keys.a     = 1;
    if (e.code === 'KeyD')   keys.d     = 1;
    if (e.code === 'Space') { keys.space = 1; e.preventDefault(); }
    if (e.code === 'KeyQ')   keys.q     = 1;
    if (e.code === 'KeyE')   keys.e     = 1;   // Database open / Poom eat-rice fallback
});

window.addEventListener('keyup', e => {
    if (e.code === 'KeyW')  keys.w     = 0;
    if (e.code === 'KeyS')  keys.s     = 0;
    if (e.code === 'KeyA')  keys.a     = 0;
    if (e.code === 'KeyD')  keys.d     = 0;
    if (e.code === 'Space') keys.space = 0;
    if (e.code === 'KeyE')  keys.e     = 0;
    if (e.code === 'KeyQ') {
        if (gameState === 'PLAYING') {
            if (player instanceof PoomPlayer) keys.q = 0;
            else { weaponSystem.switchWeapon(); keys.q = 0; }
        } else { keys.q = 0; }
    }
});

window.addEventListener('mousemove', e => {
    if (!CANVAS) return;
    const r = CANVAS.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    updateMouseWorld();
});

window.addEventListener('mousedown', e => {
    if (!CANVAS) return;
    if (e.button === 0) mouse.left  = 1;
    if (e.button === 2) mouse.right = 1;
    e.preventDefault();
});

window.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.left  = 0;
    if (e.button === 2) mouse.right = 0;
});

window.addEventListener('contextmenu', e => e.preventDefault());

// ==================== EXPOSE TO GLOBAL ====================
window.startGame = startGame;
window.endGame   = endGame;

window.onload = () => {
    console.log('🚀 Initializing game...');
    initCanvas();
    initAI();
};

// ==========================================================
// 📱 MOBILE TWIN-STICK CONTROLS
// ==========================================================
window.touchJoystickLeft  = { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 };
window.touchJoystickRight = { active: false, id: null, originX: 0, originY: 0, nx: 0, ny: 0 };

function initMobileControls() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouchDevice && window.innerWidth > 1024) return;

    const maxRadius = 60;
    const zoneL  = document.getElementById('joystick-left-zone');
    const baseL  = document.getElementById('joystick-left-base');
    const stickL = document.getElementById('joystick-left-stick');
    const zoneR  = document.getElementById('joystick-right-zone');
    const baseR  = document.getElementById('joystick-right-base');
    const stickR = document.getElementById('joystick-right-stick');

    function startJoystick(e, joystick, baseElem, stickElem, zoneElem, isRight = false) {
        if (gameState !== 'PLAYING') return;  // ← FIX: never intercept menu/gameover touches
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (joystick.id === null) {
                joystick.id = touch.identifier; joystick.active = true;
                joystick.originX = touch.clientX; joystick.originY = touch.clientY;
                const zr = zoneElem.getBoundingClientRect();
                baseElem.style.display = 'block';
                baseElem.style.left = (touch.clientX - zr.left) + 'px';
                baseElem.style.top  = (touch.clientY - zr.top)  + 'px';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 1;
                break;
            }
        }
    }

    function moveJoystick(e, joystick, stickElem) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                let dx = touch.clientX - joystick.originX;
                let dy = touch.clientY - joystick.originY;
                const d = Math.hypot(dx, dy);
                if (d > maxRadius) { dx = (dx / d) * maxRadius; dy = (dy / d) * maxRadius; }
                joystick.nx = dx / maxRadius; joystick.ny = dy / maxRadius;
                stickElem.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            }
        }
    }

    function endJoystick(e, joystick, baseElem, stickElem, isRight = false) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === joystick.id) {
                joystick.active = false; joystick.id = null;
                joystick.nx = 0; joystick.ny = 0;
                baseElem.style.display = 'none';
                stickElem.style.transform = 'translate(-50%, -50%)';
                if (isRight) mouse.left = 0;
            }
        }
    }

    zoneL.addEventListener('touchstart',  (e) => startJoystick(e, window.touchJoystickLeft,  baseL,  stickL, zoneL),        { passive: false });
    zoneL.addEventListener('touchmove',   (e) => moveJoystick(e,  window.touchJoystickLeft,  stickL),                        { passive: false });
    zoneL.addEventListener('touchend',    (e) => endJoystick(e,   window.touchJoystickLeft,  baseL,  stickL),                { passive: false });
    zoneL.addEventListener('touchcancel', (e) => endJoystick(e,   window.touchJoystickLeft,  baseL,  stickL),                { passive: false });

    zoneR.addEventListener('touchstart',  (e) => startJoystick(e, window.touchJoystickRight, baseR,  stickR, zoneR, true),  { passive: false });
    zoneR.addEventListener('touchmove',   (e) => moveJoystick(e,  window.touchJoystickRight, stickR),                        { passive: false });
    zoneR.addEventListener('touchend',    (e) => endJoystick(e,   window.touchJoystickRight, baseR,  stickR, true),          { passive: false });
    zoneR.addEventListener('touchcancel', (e) => endJoystick(e,   window.touchJoystickRight, baseR,  stickR, true),          { passive: false });

    const btnDash     = document.getElementById('btn-dash');
    const btnSkill    = document.getElementById('btn-skill');
    const btnSwitch   = document.getElementById('btn-switch');
    const btnNaga     = document.getElementById('btn-naga');
    const btnDatabase = document.getElementById('btn-database');

    if (btnDash) {
        btnDash.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); keys.space = 1; }, { passive: false });
        btnDash.addEventListener('touchend',   (e) => { e.preventDefault(); e.stopPropagation(); keys.space = 0; }, { passive: false });
    }
    if (btnSkill) {
        btnSkill.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); mouse.right = 1; }, { passive: false });
        btnSkill.addEventListener('touchend',   (e) => { e.preventDefault(); e.stopPropagation(); mouse.right = 0; }, { passive: false });
    }
    if (btnSwitch) {
        btnSwitch.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING' && weaponSystem) weaponSystem.switchWeapon();
        }, { passive: false });
    }
    if (btnNaga) {
        btnNaga.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING' && player instanceof PoomPlayer) {
                if (player.cooldowns.naga <= 0) player.summonNaga();
            }
        }, { passive: false });
    }

    // ── Database button (mobile) ──
    // Opens external DB in new tab when PLAYING; resumes game when PAUSED.
    if (btnDatabase) {
        btnDatabase.addEventListener('touchstart', (e) => {
            e.preventDefault(); e.stopPropagation();
            if (gameState === 'PLAYING') openExternalDatabase();
            else if (gameState === 'PAUSED') resumeGame();
        }, { passive: false });
    }

    document.addEventListener('touchmove', function(e) {
        if (!e.target.closest('.joystick-zone') && !e.target.closest('.action-btn')) {
            e.preventDefault();
        }
    }, { passive: false });
}

window.addEventListener('DOMContentLoaded', initMobileControls);