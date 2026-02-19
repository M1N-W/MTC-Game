'use strict';
/**
 * js/entities/boss.js
 *
 * ► Boss — "KRU MANOP THE DOG RIDER"
 *           Phase 1 (normal) → Phase 2 (enraged dog-rider)
 *           States: CHASE | ATTACK | ULTIMATE
 *           Skills: equationSlam | deadlyGraph | log457 | bark (phase 2 only)
 *
 * Depends on: base.js  (Entity)
 *             player.js (BarkWave)
 */

// ════════════════════════════════════════════════════════════
// 👑 BOSS — "KRU MANOP THE DOG RIDER"
// ════════════════════════════════════════════════════════════
class Boss extends Entity {
    constructor(difficulty = 1, isRider = false) {
        super(0, BALANCE.boss.spawnY, BALANCE.boss.radius);
        this.maxHp     = BALANCE.boss.baseHp * difficulty;
        this.hp        = this.maxHp;
        this.name      = 'KRU MANOP';
        this.state     = 'CHASE';
        this.timer     = 0;
        this.moveSpeed = BALANCE.boss.moveSpeed;
        this.difficulty = difficulty;
        this.phase     = 1;
        this.sayTimer  = 0;
        this.isRider   = isRider;

        this.skills = {
            slam:  { cd: 0, max: BALANCE.boss.slamCooldown  },
            graph: { cd: 0, max: BALANCE.boss.graphCooldown  },
            log:   { cd: 0, max: BALANCE.boss.log457Cooldown },
            bark:  { cd: 0, max: BALANCE.boss.phase2.barkCooldown }
        };

        this.log457State       = null;
        this.log457Timer       = 0;
        this.log457AttackBonus = 0;
        this.isInvulnerable    = false;
        this.isEnraged         = false;
        this.dogLegTimer       = 0;
    }

    update(dt, player) {
        if (this.dead) return;
        const dx=player.x-this.x, dy=player.y-this.y;
        const d=dist(this.x,this.y,player.x,player.y);
        this.angle=Math.atan2(dy,dx);
        this.timer+=dt; this.sayTimer+=dt;
        if (this.isRider) this.dogLegTimer+=dt*(this.isEnraged?2.5:1.0);

        for (let s in this.skills) if (this.skills[s].cd>0) this.skills[s].cd-=dt;

        if (this.sayTimer>BALANCE.boss.speechInterval && Math.random()<0.1) {
            this.speak('Player at '+Math.round(player.hp)+' HP');
            this.sayTimer=0;
        }

        if (this.hp<this.maxHp*BALANCE.boss.phase2Threshold && this.phase===1) {
            this.phase=2; this.isEnraged=true;
            this.moveSpeed=BALANCE.boss.moveSpeed*BALANCE.boss.phase2.enrageSpeedMult;
            spawnFloatingText('ENRAGED!',this.x,this.y-80,'#ef4444',40);
            if(this.isRider) spawnFloatingText('🐕 DOG RIDER!',this.x,this.y-120,'#d97706',32);
            addScreenShake(20);
            spawnParticles(this.x,this.y,35,'#ef4444');
            spawnParticles(this.x,this.y,20,'#d97706');
            this.speak(this.isRider?'Hop on, boy! Let\'s go!':'You think you can stop me?!');
            Audio.playBossSpecial();
        }

        if (this.log457State==='charging') {
            this.log457Timer+=dt; this.isInvulnerable=true;
            this.hp=Math.min(this.maxHp,this.hp+this.maxHp*BALANCE.boss.log457HealRate*dt);
            if (this.log457Timer>=BALANCE.boss.log457ChargeDuration) {
                this.log457State='active'; this.log457Timer=0;
                this.log457AttackBonus=BALANCE.boss.log457AttackBonus;
                this.isInvulnerable=false;
                addScreenShake(20); spawnFloatingText('67! 67! 67!',this.x,this.y-80,'#facc15',35);
                this.speak('0.6767!');
            }
        } else if (this.log457State==='active') {
            this.log457Timer+=dt;
            this.log457AttackBonus+=BALANCE.boss.log457AttackGrowth*dt;
            if (this.log457Timer>=BALANCE.boss.log457ActiveDuration) {
                this.log457State='stunned'; this.log457Timer=0;
                this.vx=0; this.vy=0;
                spawnFloatingText('STUNNED!',this.x,this.y-60,'#94a3b8',30);
            }
        } else if (this.log457State==='stunned') {
            this.log457Timer+=dt; this.vx=0; this.vy=0;
            if (this.log457Timer>=BALANCE.boss.log457StunDuration) {
                this.log457State=null; this.log457AttackBonus=0;
            }
            return;
        }

        if (this.state==='CHASE') {
            if (!player.isInvisible) { this.vx=Math.cos(this.angle)*this.moveSpeed; this.vy=Math.sin(this.angle)*this.moveSpeed; }
            else { this.vx*=0.95; this.vy*=0.95; }
            this.applyPhysics(dt);

            if (this.timer>2) {
                this.timer=0;
                const barkChance=(this.isRider&&this.phase===2)?0.40:(this.isRider)?0.18:0;
                if      (this.skills.log.cd<=0 && Math.random()<0.20) this.useLog457();
                else if (this.skills.graph.cd<=0 && Math.random()<0.25) this.useDeadlyGraph(player);
                else if (this.isRider && this.skills.bark.cd<=0 && Math.random()<barkChance) this.bark(player);
                else if (this.skills.slam.cd<=0 && Math.random()<0.30) this.useEquationSlam();
                else this.state=Math.random()<0.3?'ULTIMATE':'ATTACK';
            }
        } else if (this.state==='ATTACK') {
            this.vx*=0.9; this.vy*=0.9;
            const fr=this.phase===2?BALANCE.boss.phase2AttackFireRate:BALANCE.boss.attackFireRate;
            const bf=fr/(1+this.log457AttackBonus);
            if (this.timer>bf) {
                projectileManager.add(new Projectile(this.x,this.y,this.angle,BALANCE.boss.chalkProjectileSpeed,BALANCE.boss.chalkDamage,'#fff',false,'enemy'));
                if (this.phase===2) {
                    projectileManager.add(new Projectile(this.x,this.y,this.angle+0.3,BALANCE.boss.chalkProjectileSpeed,BALANCE.boss.chalkDamage,'#fff',false,'enemy'));
                    projectileManager.add(new Projectile(this.x,this.y,this.angle-0.3,BALANCE.boss.chalkProjectileSpeed,BALANCE.boss.chalkDamage,'#fff',false,'enemy'));
                }
                this.timer=0;
                if (Math.random()<0.08) this.state='CHASE';
            }
        } else if (this.state==='ULTIMATE') {
            this.vx=0; this.vy=0;
            if (this.timer>1) {
                const bullets=this.phase===2?BALANCE.boss.phase2UltimateBullets:BALANCE.boss.ultimateBullets;
                for(let i=0;i<bullets;i++){
                    const a=(Math.PI*2/bullets)*i;
                    projectileManager.add(new Projectile(this.x,this.y,a,BALANCE.boss.ultimateProjectileSpeed,BALANCE.boss.ultimateDamage,'#ef4444',true,'enemy'));
                }
                addScreenShake(15);
                spawnFloatingText('POP QUIZ!',this.x,this.y-80,'#facc15',40);
                Audio.playBossSpecial();
                this.state='CHASE'; this.timer=-1;
            }
        }

        if (d<this.radius+player.radius)
            player.takeDamage(BALANCE.boss.contactDamage*dt*(1+this.log457AttackBonus));

        if (window.UIManager) {
            window.UIManager.updateBossHUD(this);
            window.UIManager.updateBossSpeech(this);
        }
    }

    bark(player) {
        const P2=BALANCE.boss.phase2;
        this.skills.bark.cd=this.skills.bark.max;
        this.state='CHASE';
        const barkAngle=Math.atan2(player.y-this.y,player.x-this.x);
        const coneHalf=Math.PI/3.5;
        window.specialEffects.push(new BarkWave(this.x,this.y,barkAngle,coneHalf,P2.barkRange));
        const dx=player.x-this.x, dy=player.y-this.y, d=Math.hypot(dx,dy);
        if (d>0 && d<P2.barkRange) {
            const playerAngle=Math.atan2(dy,dx);
            let diff=playerAngle-barkAngle;
            while(diff>Math.PI) diff-=Math.PI*2;
            while(diff<-Math.PI) diff+=Math.PI*2;
            if (Math.abs(diff)<coneHalf) {
                player.takeDamage(P2.barkDamage);
                const pushMag=480;
                player.vx+=(dx/d)*pushMag; player.vy+=(dy/d)*pushMag;
                spawnFloatingText('BARK! 🐕',player.x,player.y-55,'#f59e0b',26);
                addScreenShake(10);
            }
        }
        spawnFloatingText('WOOF WOOF!',this.x,this.y-100,'#d97706',30);
        spawnParticles(this.x,this.y,12,'#d97706');
        Audio.playBossSpecial();
        this.speak('BARK BARK BARK!');
    }

    useEquationSlam() {
        this.skills.slam.cd=this.skills.slam.max; this.state='CHASE';
        addScreenShake(15);
        spawnFloatingText('EQUATION SLAM!',this.x,this.y-80,'#facc15',30);
        this.speak('Equation Slam!'); Audio.playBossSpecial();
        window.specialEffects.push(new EquationSlam(this.x,this.y));
    }

    useDeadlyGraph(player) {
        this.skills.graph.cd=this.skills.graph.max; this.state='CHASE';
        spawnFloatingText('DEADLY GRAPH!',this.x,this.y-80,'#3b82f6',30);
        this.speak('Feel the power of y=x!'); Audio.playBossSpecial();
        window.specialEffects.push(new DeadlyGraph(this.x,this.y,player.x,player.y,BALANCE.boss.graphDuration));
    }

    useLog457() {
        this.skills.log.cd=this.skills.log.max;
        this.log457State='charging'; this.log457Timer=0; this.state='CHASE';
        spawnFloatingText('log 4.57 = ?',this.x,this.y-80,'#ef4444',30);
        Audio.playBossSpecial();
    }

    async speak(context) {
        try {
            const text=await Gemini.getBossTaunt(context);
            if (text && window.UIManager) window.UIManager.showBossSpeech(text);
        } catch(e) { console.warn('Speech failed:',e); }
    }

    takeDamage(amt) {
        if (this.isInvulnerable) {
            spawnFloatingText('INVINCIBLE!',this.x,this.y-40,'#facc15',20);
            return;
        }
        this.hp-=amt;
        if (this.hp<=0) {
            this.dead=true; this.hp=0;
            spawnParticles(this.x,this.y,60,'#dc2626');
            spawnFloatingText('CLASS DISMISSED!',this.x,this.y,'#facc15',35);
            addScore(BALANCE.score.boss*this.difficulty);
            if (window.UIManager) window.UIManager.updateBossHUD(null);
            Audio.playAchievement();
            for(let i=0;i<3;i++){
                setTimeout(()=>window.powerups.push(new PowerUp(this.x+rand(-50,50),this.y+rand(-50,50))),i*200);
            }
            window.boss=null;
            Achievements.check('boss_down');
            setTimeout(()=>{
                setWave(getWave()+1);
                if (getWave()>BALANCE.waves.maxWaves) window.endGame('victory');
                else if (typeof window.startNextWave==='function') window.startNextWave();
            }, BALANCE.boss.nextWaveDelay);
        }
    }

    draw() {
        const screen=worldToScreen(this.x,this.y);
        const RIDER_OFFSET_Y=this.isRider?-22:0;
        CTX.save(); CTX.translate(screen.x,screen.y);

        if (this.log457State==='charging') {
            const sc=1+(this.log457Timer/2)*0.3;
            CTX.scale(sc,sc);
            const pu=Math.sin(this.log457Timer*10)*0.5+0.5;
            CTX.beginPath(); CTX.arc(0,0,70,0,Math.PI*2);
            CTX.fillStyle=`rgba(239,68,68,${pu*0.3})`; CTX.fill();
        }
        if (this.log457State==='active')  {CTX.shadowBlur=20;CTX.shadowColor='#facc15';}
        if (this.log457State==='stunned') {
            CTX.font='bold 30px Arial'; CTX.textAlign='center'; CTX.fillText('😵',0,-70);
        }
        if (this.state==='ULTIMATE') {
            CTX.beginPath(); CTX.arc(0,0,70,0,Math.PI*2);
            CTX.strokeStyle=`rgba(239,68,68,${Math.random()})`;
            CTX.lineWidth=5; CTX.stroke();
        }
        if (this.phase===2 && this.log457State!=='charging') {
            CTX.shadowBlur=20; CTX.shadowColor='#ef4444';
        }

        CTX.rotate(this.angle);
        if (this.isRider) this._drawDog();

        CTX.save(); CTX.translate(0,RIDER_OFFSET_Y);
        CTX.fillStyle='#f8fafc'; CTX.fillRect(-30,-30,60,60);
        CTX.fillStyle='#e2e8f0';
        CTX.beginPath(); CTX.moveTo(-30,-30); CTX.lineTo(-20,-20); CTX.lineTo(20,-20); CTX.lineTo(30,-30); CTX.closePath(); CTX.fill();
        CTX.fillStyle='#ef4444';
        CTX.beginPath(); CTX.moveTo(0,-20); CTX.lineTo(6,0); CTX.lineTo(0,25); CTX.lineTo(-6,0); CTX.closePath(); CTX.fill();
        CTX.fillStyle=this.log457State==='charging'?'#ff0000':'#e2e8f0';
        CTX.beginPath(); CTX.arc(0,0,24,0,Math.PI*2); CTX.fill();
        CTX.fillStyle='#94a3b8'; CTX.beginPath(); CTX.arc(0,0,26,Math.PI,0); CTX.fill();
        if (this.phase===2||this.log457State==='active') {
            CTX.fillStyle='#ef4444';
            CTX.fillRect(-12,-5,10,3); CTX.fillRect(2,-5,10,3);
        }
        CTX.fillStyle='#facc15'; CTX.fillRect(25,12,60,10);
        CTX.fillStyle='#000'; CTX.font='bold 8px Arial'; CTX.fillText('30cm',50,17);

        if (this.isEnraged) {
            const t=performance.now()/80;
            for(let i=0;i<4;i++){
                const px=Math.sin(t*.9+i*1.57)*18;
                const py=-Math.abs(Math.cos(t*1.1+i*1.57))*22-30;
                const ps=3+Math.sin(t+i)*1.5;
                CTX.globalAlpha=0.55+Math.sin(t+i)*0.3;
                CTX.fillStyle=i%2===0?'#ef4444':'#f97316';
                CTX.shadowBlur=8; CTX.shadowColor='#ef4444';
                CTX.beginPath(); CTX.arc(px,py,ps,0,Math.PI*2); CTX.fill();
            }
            CTX.globalAlpha=1; CTX.shadowBlur=0;
        }
        CTX.restore();
        CTX.restore();
    }

    _drawDog() {
        const P2=BALANCE.boss.phase2;
        const bodyCol =this.isEnraged?'#dc2626':P2.dogColor;
        const darkCol =this.isEnraged?'#991b1b':'#92400e';
        const lightCol=this.isEnraged?'#ef4444':'#b45309';
        const eyeCol  =this.isEnraged?'#facc15':'#1e293b';

        const legSpeed=this.isEnraged?9:4.5;
        const swingAmt=0.45;
        const swingA= Math.sin(this.dogLegTimer*legSpeed)*swingAmt;
        const swingB=-swingA;
        const LEG_LEN=20, PAW_RY=4;

        CTX.save(); CTX.globalAlpha=0.22; CTX.fillStyle='rgba(0,0,0,0.9)';
        CTX.beginPath(); CTX.ellipse(6,62,44,10,0,0,Math.PI*2); CTX.fill(); CTX.restore();

        const drawLeg=(pivotX,pivotY,swingAngle,pawTiltSign)=>{
            CTX.save(); CTX.translate(pivotX,pivotY); CTX.rotate(swingAngle);
            CTX.strokeStyle=darkCol; CTX.lineWidth=7; CTX.lineCap='round';
            CTX.beginPath(); CTX.moveTo(0,0); CTX.lineTo(0,LEG_LEN); CTX.stroke();
            CTX.fillStyle=darkCol; CTX.beginPath(); CTX.arc(0,LEG_LEN,3.5,0,Math.PI*2); CTX.fill();
            CTX.strokeStyle=darkCol; CTX.lineWidth=5;
            CTX.beginPath(); CTX.moveTo(0,LEG_LEN); CTX.lineTo(pawTiltSign*3,LEG_LEN+11); CTX.stroke();
            CTX.fillStyle=darkCol;
            CTX.beginPath(); CTX.ellipse(pawTiltSign*3,LEG_LEN+13,6,PAW_RY,pawTiltSign*.25,0,Math.PI*2); CTX.fill();
            CTX.restore();
        };
        drawLeg( 14,36, swingA,-1); drawLeg( 26,36, swingB, 1);
        drawLeg(-14,36, swingB,-1); drawLeg( -2,36, swingA, 1);

        CTX.fillStyle=bodyCol; CTX.strokeStyle=darkCol; CTX.lineWidth=2.5;
        CTX.beginPath(); CTX.ellipse(6,28,44,18,0,0,Math.PI*2); CTX.fill(); CTX.stroke();
        CTX.fillStyle=lightCol;
        CTX.beginPath(); CTX.ellipse(0,20,22,10,0,0,Math.PI*2); CTX.fill();

        const tailWag=Math.sin(this.dogLegTimer*(this.isEnraged?12:6))*18;
        CTX.strokeStyle=darkCol; CTX.lineWidth=6; CTX.lineCap='round';
        CTX.beginPath(); CTX.moveTo(-44,22);
        CTX.quadraticCurveTo(-58,8,-55+tailWag*.35,-6+tailWag); CTX.stroke();
        CTX.fillStyle=bodyCol;
        CTX.beginPath(); CTX.arc(-55+tailWag*.35,-7+tailWag,7,0,Math.PI*2); CTX.fill();

        CTX.fillStyle=bodyCol; CTX.strokeStyle=darkCol; CTX.lineWidth=2.5;
        CTX.beginPath(); CTX.arc(52,20,18,0,Math.PI*2); CTX.fill(); CTX.stroke();

        CTX.fillStyle=darkCol; CTX.strokeStyle=darkCol; CTX.lineWidth=1.5;
        CTX.beginPath(); CTX.ellipse(44,8,9,15,-0.5,0,Math.PI*2); CTX.fill();

        CTX.fillStyle=lightCol; CTX.strokeStyle=darkCol; CTX.lineWidth=1.5;
        CTX.beginPath(); CTX.ellipse(64,23,12,8,0.2,0,Math.PI*2); CTX.fill(); CTX.stroke();

        CTX.fillStyle='#1e293b';
        CTX.beginPath(); CTX.arc(71,20,3.5,0,Math.PI*2); CTX.fill();

        CTX.fillStyle=eyeCol; CTX.shadowBlur=this.isEnraged?8:0; CTX.shadowColor='#facc15';
        CTX.beginPath(); CTX.arc(56,13,4,0,Math.PI*2); CTX.fill();
        CTX.shadowBlur=0; CTX.fillStyle='#1e293b';
        CTX.beginPath(); CTX.arc(57,13,2,0,Math.PI*2); CTX.fill();

        CTX.strokeStyle=darkCol; CTX.lineWidth=2; CTX.lineCap='round';
        CTX.beginPath(); CTX.arc(63,24,5,0.1,Math.PI-0.1); CTX.stroke();

        if (this.isEnraged||Math.sin(this.dogLegTimer*3)>0.2) {
            CTX.fillStyle='#fb7185';
            CTX.beginPath(); CTX.ellipse(63,32,5,7,0,0,Math.PI*2); CTX.fill();
        }

        if (this.isEnraged) {
            const t=performance.now()/120;
            CTX.save();
            for(let i=0;i<5;i++){
                const ex=Math.sin(t*.7+i*1.26)*36;
                const ey=Math.cos(t*.9+i*1.26)*16+28;
                const er=3+Math.sin(t*1.5+i)*1.5;
                CTX.globalAlpha=0.5+Math.sin(t+i)*0.3;
                CTX.fillStyle=i%2===0?'#ef4444':'#f97316';
                CTX.shadowBlur=10; CTX.shadowColor='#ef4444';
                CTX.beginPath(); CTX.arc(ex,ey,er,0,Math.PI*2); CTX.fill();
            }
            CTX.restore();
        }
    }
}

// ─── Node/bundler export (all classes) ───────────────────────
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Entity, Player, PoomPlayer, NagaEntity, Drone, BarkWave, Enemy, TankEnemy, MageEnemy, PowerUp, Boss };
}
