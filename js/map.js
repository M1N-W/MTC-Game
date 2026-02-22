'use strict';
/**
 * 🏫 MTC: ENHANCED EDITION - Campus Map System (REFACTORED)
 *
 * CHANGES (Stability Overhaul):
 * - ✅ ALL calls to UIManager.showVoiceBubble() replaced with global showVoiceBubble()
 * - ✅ No helper functions redefined here — globals from utils.js.
 * - ✅ lerpColorHex / hexToRgb calls removed — those live in utils.js.
 *
 * FIXES:
 * - ✅ BUG 1: MapSystem.update() accepts dt param, removed getDeltaTime() call.
 * - ✅ Added 'use strict'.
 *
 * NEW (Terrain Update):
 * - ✅ drawTerrain(ctx, camera) added — reads all values from window.MAP_CONFIG.
 *      Load order: config.js must load before map.js.
 */

// ════════════════════════════════════════════════════════════
// 🎨 STANDALONE DRAW HELPERS
// ════════════════════════════════════════════════════════════

let _mapNow = 0;
function _updateMapNow() { _mapNow = performance.now(); }

function drawDesk(w, h) {
    const pal = BALANCE.map.mapColors;
    CTX.fillStyle = pal.deskTop;
    CTX.beginPath(); CTX.roundRect(0,0,w,h,4); CTX.fill();

    CTX.strokeStyle = pal.deskLegs; CTX.lineWidth = 1; CTX.globalAlpha = 0.35;
    for (let gx=6; gx<w-4; gx+=10) {
        CTX.beginPath(); CTX.moveTo(gx,2); CTX.lineTo(gx+3,h-2); CTX.stroke();
    }
    CTX.globalAlpha = 1;

    CTX.fillStyle = 'rgba(255,255,220,0.18)';
    CTX.beginPath(); CTX.roundRect(3,2,w-6,6,2); CTX.fill();

    CTX.fillStyle = pal.deskLegs;
    CTX.fillRect(4,h,6,6); CTX.fillRect(w-10,h,6,6);

    CTX.fillStyle = '#1e40af';
    CTX.beginPath(); CTX.roundRect(Math.floor(w*.1),Math.floor(h*.2),Math.floor(w*.45),Math.floor(h*.55),2); CTX.fill();
    CTX.fillStyle = '#93c5fd';
    CTX.fillRect(Math.floor(w*.12),Math.floor(h*.22),Math.floor(w*.2),2);
    CTX.fillRect(Math.floor(w*.12),Math.floor(h*.28),Math.floor(w*.35),2);

    CTX.fillStyle = '#fbbf24'; CTX.fillRect(Math.floor(w*.65),Math.floor(h*.25),Math.floor(w*.25),4);
    CTX.fillStyle = '#f87171'; CTX.fillRect(Math.floor(w*.65)-4,Math.floor(h*.25),4,4);
}

function drawTree(size) {
    const pal = BALANCE.map.mapColors;
    const t = _mapNow / 2000;

    CTX.fillStyle = 'rgba(0,0,0,0.25)';
    CTX.beginPath(); CTX.ellipse(0,size*.3,size*.7,size*.2,0,0,Math.PI*2); CTX.fill();

    CTX.fillStyle = pal.treeTrunk;
    CTX.beginPath(); CTX.roundRect(-5,-size*.15,10,size*.5,3); CTX.fill();

    CTX.fillStyle = pal.treeDark;
    CTX.beginPath(); CTX.arc(0,-size*.1,size*.72,0,Math.PI*2); CTX.fill();
    CTX.fillStyle = pal.treeMid;
    CTX.beginPath(); CTX.arc(0,-size*.45,size*.58,0,Math.PI*2); CTX.fill();
    CTX.fillStyle = pal.treeLight;
    CTX.beginPath(); CTX.arc(0,-size*.78,size*.40,0,Math.PI*2); CTX.fill();

    CTX.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i=0; i<3; i++) {
        const a=t+(Math.PI*2/3)*i, r=size*.3;
        CTX.beginPath(); CTX.arc(Math.cos(a)*r,-size*.45+Math.sin(a)*r*.5,3,0,Math.PI*2); CTX.fill();
    }

    CTX.strokeStyle = 'rgba(134,239,172,0.6)'; CTX.lineWidth = 1.5;
    CTX.beginPath();
    for (let i=0; i<6; i++) {
        const a=(Math.PI/3)*i-Math.PI/6, r=size*.42;
        i===0 ? CTX.moveTo(Math.cos(a)*r,-size*.78+Math.sin(a)*r)
              : CTX.lineTo(Math.cos(a)*r,-size*.78+Math.sin(a)*r);
    }
    CTX.closePath(); CTX.stroke();
}

function drawServer(w, h) {
    const pal = BALANCE.map.mapColors;
    const now = _mapNow;

    CTX.fillStyle = pal.serverBody;
    CTX.beginPath(); CTX.roundRect(0,0,w,h,5); CTX.fill();
    CTX.fillStyle = '#263451'; CTX.fillRect(4,4,w-8,h-8);

    const unitH = Math.floor((h-16)/4);
    for (let u=0; u<4; u++) {
        const uy = 8+u*unitH;
        CTX.fillStyle = '#1c2a3e';
        CTX.beginPath(); CTX.roundRect(6,uy,w-12,unitH-3,2); CTX.fill();

        const blinkOffset = u*317;
        const isOn = Math.sin((now+blinkOffset)/(400+u*100)) > 0;
        CTX.fillStyle = isOn ? pal.serverLightOn : pal.serverLightOff;
        CTX.shadowBlur = isOn ? 8 : 0; CTX.shadowColor = pal.serverLightOn;
        CTX.beginPath(); CTX.arc(12,uy+unitH*.45,3,0,Math.PI*2); CTX.fill(); CTX.shadowBlur=0;

        for (let d=0; d<3; d++) {
            const dOn=Math.sin((now+blinkOffset+d*150)/200)>0.6;
            CTX.fillStyle=dOn?'#3b82f6':'#1d3155';
            CTX.fillRect(18+d*6,uy+unitH*.3,4,4);
        }
        CTX.strokeStyle='#1a2738'; CTX.lineWidth=0.8;
        for (let vx=w-20; vx<w-8; vx+=3) {
            CTX.beginPath(); CTX.moveTo(vx,uy+3); CTX.lineTo(vx,uy+unitH-4); CTX.stroke();
        }
    }
    CTX.fillStyle='#334155'; CTX.fillRect(4,0,w-8,4);
    CTX.strokeStyle='#475569'; CTX.lineWidth=0.8;
    for (let vx=8; vx<w-8; vx+=4) {
        CTX.beginPath(); CTX.moveTo(vx,0); CTX.lineTo(vx,4); CTX.stroke();
    }
    CTX.fillStyle='#0ea5e9';
    for (let p=0; p<3; p++) CTX.fillRect(6+p*10,h-7,7,4);
}

function drawDataPillar(w, h) {
    const pal = BALANCE.map.mapColors;
    const now = _mapNow;
    const glow = Math.sin(now/800)*0.4+0.6;

    CTX.fillStyle='rgba(0,0,0,0.3)';
    CTX.beginPath(); CTX.ellipse(w/2,h+4,w*.55,7,0,0,Math.PI*2); CTX.fill();

    CTX.fillStyle='#334155';
    CTX.beginPath(); CTX.roundRect(-4,h-8,w+8,10,2); CTX.fill();
    CTX.fillStyle='#475569';
    CTX.beginPath(); CTX.roundRect(-4,-6,w+8,9,2); CTX.fill();

    const grad=CTX.createLinearGradient(0,0,w,0);
    grad.addColorStop(0,'#334155'); grad.addColorStop(0.4,'#64748b'); grad.addColorStop(1,'#475569');
    CTX.fillStyle=grad; CTX.fillRect(0,0,w,h-6);

    CTX.strokeStyle=`rgba(6,182,212,${glow*.8})`; CTX.lineWidth=1.2;
    CTX.shadowBlur=6; CTX.shadowColor=pal.pillarCircuit;
    CTX.beginPath();
    CTX.moveTo(w*.35,4); CTX.lineTo(w*.35,h*.25); CTX.lineTo(w*.6,h*.35);
    CTX.lineTo(w*.6,h*.55); CTX.lineTo(w*.3,h*.65); CTX.lineTo(w*.3,h*.85); CTX.stroke();
    CTX.beginPath();
    CTX.moveTo(w*.35,h*.25); CTX.lineTo(w*.7,h*.25);
    CTX.moveTo(w*.6,h*.55); CTX.lineTo(w*.15,h*.55); CTX.stroke();

    CTX.fillStyle=pal.pillarCircuit;
    const nodes=[[w*.35,h*.25],[w*.6,h*.35],[w*.6,h*.55],[w*.3,h*.65]];
    for(const[nx,ny]of nodes){CTX.beginPath();CTX.arc(nx,ny,2.5,0,Math.PI*2);CTX.fill();}
    CTX.shadowBlur=0;

    CTX.fillStyle=`rgba(6,182,212,${glow})`; CTX.shadowBlur=10; CTX.shadowColor=pal.pillarCircuit;
    CTX.beginPath(); CTX.arc(w/2,-2,3,0,Math.PI*2); CTX.fill(); CTX.shadowBlur=0;
}

function drawBookshelf(w, h) {
    const pal = BALANCE.map.mapColors;
    const bookColors = pal.bookColors;

    CTX.fillStyle='#78350f';
    CTX.beginPath(); CTX.roundRect(0,0,w,h,3); CTX.fill();
    CTX.fillStyle='#92400e';
    CTX.fillRect(0,0,5,h); CTX.fillRect(w-5,0,5,h);

    const shelfCount=3, shelfH=(h-6)/shelfCount;
    for(let s=0;s<shelfCount;s++){
        const sy=3+s*shelfH;
        CTX.fillStyle='#a16207'; CTX.fillRect(5,sy+shelfH-4,w-10,5);
        let bx=7, bookIdx=(s*7)%bookColors.length;
        while(bx<w-12){
            const bw=8+Math.floor(Math.abs(Math.sin(bx*.3+s))*8);
            const bh=shelfH*(0.55+Math.abs(Math.sin(bx*.7))*.3);
            CTX.fillStyle=bookColors[bookIdx%bookColors.length];
            CTX.beginPath(); CTX.roundRect(bx,sy+shelfH-4-bh,bw,bh,1); CTX.fill();
            CTX.fillStyle='rgba(255,255,255,0.2)'; CTX.fillRect(bx+1,sy+shelfH-4-bh+2,2,bh-4);
            CTX.fillStyle='rgba(0,0,0,0.3)'; CTX.fillRect(bx+bw*.25,sy+shelfH-4-bh+bh*.3,bw*.5,1.5);
            bx+=bw+1; bookIdx++;
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🗺️ MAP OBJECT CLASS
// ════════════════════════════════════════════════════════════
class MapObject {
    constructor(x, y, w, h, type) {
        this.x=x; this.y=y; this.w=w; this.h=h;
        this.type=type; this.solid=(type!=='decoration');
    }

    checkCollision(cx, cy, radius) {
        if (!this.solid) return false;
        return circleRectCollision(cx, cy, radius, this.x, this.y, this.w, this.h);
    }

    resolveCollision(entity) {
        if (!this.solid) return;
        const closestX = clamp(entity.x, this.x, this.x+this.w);
        const closestY = clamp(entity.y, this.y, this.y+this.h);
        const dx=entity.x-closestX, dy=entity.y-closestY;
        const distance=Math.sqrt(dx*dx+dy*dy);
        if (distance < entity.radius) {
            const overlap=entity.radius-distance;
            if (distance>0) { entity.x+=(dx/distance)*overlap; entity.y+=(dy/distance)*overlap; }
            else { entity.x+=overlap; }
            entity.vx*=0.5; entity.vy*=0.5;
        }
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        CTX.save(); CTX.translate(screen.x, screen.y);
        switch (this.type) {
            case 'desk':       drawDesk(this.w, this.h);       break;
            case 'tree':       drawTree(this.w/2);             break;
            case 'server':     drawServer(this.w, this.h);     break;
            case 'datapillar': drawDataPillar(this.w, this.h); break;
            case 'bookshelf':  drawBookshelf(this.w, this.h);  break;
            case 'blackboard': this.drawBlackboard();          break;
            case 'wall':       this.drawWall();                break;
            case 'chair':      this.drawChair();               break;
            case 'cabinet':    this.drawCabinet();             break;
            // 'barrel' falls through: ExplosiveBarrel overrides draw() entirely
        }
        CTX.restore();
    }

    drawChair() {
        CTX.fillStyle='#475569'; CTX.fillRect(5,0,this.w-10,this.h-15);
        CTX.fillStyle='#64748b'; CTX.fillRect(0,this.h-15,this.w,15);
        CTX.fillStyle='#334155'; CTX.fillRect(3,this.h-12,4,12); CTX.fillRect(this.w-7,this.h-12,4,12);
    }

    drawCabinet() {
        CTX.fillStyle='#92400e'; CTX.fillRect(0,0,this.w,this.h);
        CTX.fillStyle='#78350f';
        CTX.fillRect(4,4,this.w/2-8,this.h-8); CTX.fillRect(this.w/2+4,4,this.w/2-8,this.h-8);
        CTX.fillStyle='#fbbf24';
        CTX.beginPath(); CTX.arc(this.w/4,this.h/2,4,0,Math.PI*2); CTX.fill();
        CTX.beginPath(); CTX.arc(3*this.w/4,this.h/2,4,0,Math.PI*2); CTX.fill();
    }

    drawBlackboard() {
        const pal = BALANCE.map.mapColors;
        CTX.fillStyle='#451a03';
        CTX.beginPath(); CTX.roundRect(0,0,this.w,this.h,4); CTX.fill();
        CTX.fillStyle=pal.whiteboardGreen;
        CTX.beginPath(); CTX.roundRect(6,5,this.w-12,this.h-10,2); CTX.fill();

        CTX.globalAlpha=0.06; CTX.fillStyle='#ffffff';
        for(let i=0;i<30;i++){
            CTX.fillRect(8+Math.floor(Math.abs(Math.sin(i*13))*(this.w-20)),
                         7+Math.floor(Math.abs(Math.cos(i*7))*(this.h-14)),2,1);
        }
        CTX.globalAlpha=1;

        CTX.fillStyle=pal.chalkWhite; CTX.textAlign='center'; CTX.textBaseline='middle';
        CTX.font=`bold ${Math.floor(this.h*.22)}px monospace`;
        CTX.fillText('ax²+bx+c = 0',this.w/2,this.h*.35);
        CTX.font=`${Math.floor(this.h*.16)}px monospace`;
        CTX.fillText('∫f(x)dx',this.w*.28,this.h*.72);
        CTX.fillText('lim x→∞',this.w*.72,this.h*.72);

        CTX.fillStyle='#78350f'; CTX.fillRect(6,this.h-6,this.w-12,5);
        const chalkColors=[pal.chalkWhite,'#f87171','#fbbf24','#86efac'];
        for(let c=0;c<4;c++){CTX.fillStyle=chalkColors[c];CTX.fillRect(12+c*18,this.h-5,14,3);}
        CTX.fillStyle='rgba(240,235,224,0.4)'; CTX.fillRect(this.w*.55,this.h-5,22,3);
    }

    drawWall() {
        const pal = BALANCE.map.mapColors;
        CTX.fillStyle=pal.wallColor; CTX.fillRect(0,0,this.w,this.h);
        CTX.strokeStyle=pal.wallBrick; CTX.lineWidth=1.5;
        const brickW=50, brickH=25;
        for(let y=0;y<this.h;y+=brickH){
            for(let x=0;x<this.w;x+=brickW){
                const offset=(Math.floor(y/brickH)%2)*(brickW/2);
                CTX.strokeRect(x+offset,y,brickW,brickH);
            }
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🛢️ EXPLOSIVE BARREL — Destructible environment trap
//
// Hit by any projectile → loses HP.
// Reaches 0 HP → triggers a high-damage AoE explosion
// handled in game.js (updateGame loop).
// Extends MapObject so it participates in collision resolution
// and the existing mapSystem.objects array automatically.
// ════════════════════════════════════════════════════════════
class ExplosiveBarrel extends MapObject {
    constructor(x, y) {
        // Barrels are 30×38 world units; solid so entities collide with them
        super(x, y, 30, 38, 'barrel');
        this.hp         = 50;
        this.maxHp      = 50;
        this.isExploded = false;
        this.radius     = 35;   // visual/interaction radius — used by explosion AoE
    }

    draw() {
        const screen = worldToScreen(this.x, this.y);
        const cx     = screen.x + this.w / 2;
        const cy     = screen.y + this.h / 2;
        const now    = _mapNow;

        CTX.save();
        CTX.translate(screen.x, screen.y);

        const W = this.w;   // 30
        const H = this.h;   // 38

        // ── Ground shadow ─────────────────────────────────────
        CTX.save();
        CTX.globalAlpha = 0.30;
        CTX.fillStyle   = '#000000';
        CTX.beginPath();
        CTX.ellipse(W / 2, H + 5, W * 0.55, 6, 0, 0, Math.PI * 2);
        CTX.fill();
        CTX.restore();

        // ── Barrel body — dark red cylinder ───────────────────
        // Base colour shifts to bright orange as HP drops
        const hpFrac   = this.hp / this.maxHp;
        const bodyR    = Math.round(140 + (1 - hpFrac) * 80);   // 140 → 220
        const bodyG    = Math.round(20  + (1 - hpFrac) * 40);   // 20  → 60
        CTX.fillStyle  = `rgb(${bodyR},${bodyG},20)`;
        CTX.strokeStyle = '#1c0a00';
        CTX.lineWidth   = 2;
        CTX.beginPath();
        CTX.roundRect(0, 4, W, H - 8, 5);
        CTX.fill();
        CTX.stroke();

        // Top cap
        CTX.fillStyle = `rgb(${Math.round(bodyR * 0.7)},${Math.round(bodyG * 0.7)},15)`;
        CTX.beginPath();
        CTX.roundRect(2, 0, W - 4, 8, 3);
        CTX.fill();
        CTX.stroke();

        // Bottom cap
        CTX.fillStyle = `rgb(${Math.round(bodyR * 0.7)},${Math.round(bodyG * 0.7)},15)`;
        CTX.beginPath();
        CTX.roundRect(2, H - 8, W - 4, 8, 3);
        CTX.fill();
        CTX.stroke();

        // ── Hazard stripes — three yellow/black diagonal bands ─
        // Clipped inside the barrel body so they don't overflow
        CTX.save();
        CTX.beginPath();
        CTX.roundRect(1, 5, W - 2, H - 10, 4);
        CTX.clip();
        const stripeW = 9;
        CTX.fillStyle = 'rgba(250,204,21,0.75)';
        for (let i = -2; i < 6; i++) {
            // Diagonal slash: offset every other one for classic chevron look
            const sx = i * stripeW * 2;
            CTX.beginPath();
            CTX.moveTo(sx,         5);
            CTX.lineTo(sx + stripeW, 5);
            CTX.lineTo(sx + stripeW - (H - 10) * 0.5, H - 5);
            CTX.lineTo(sx           - (H - 10) * 0.5, H - 5);
            CTX.closePath();
            CTX.fill();
        }
        CTX.restore();

        // ── Metal bands (rims) ────────────────────────────────
        CTX.strokeStyle = 'rgba(80,30,10,0.85)';
        CTX.lineWidth   = 3;
        CTX.beginPath();
        CTX.roundRect(1, Math.round(H * 0.30), W - 2, 4, 1);
        CTX.stroke();
        CTX.beginPath();
        CTX.roundRect(1, Math.round(H * 0.62), W - 2, 4, 1);
        CTX.stroke();

        // ── ⚠ Hazard symbol centred on body ──────────────────
        CTX.font         = '12px Arial';
        CTX.textAlign    = 'center';
        CTX.textBaseline = 'middle';
        CTX.shadowBlur   = 0;
        CTX.fillText('⚠️', W / 2, H / 2);

        // ── Low-HP flicker glow — barrel glows hotter near death ─
        if (hpFrac < 0.5) {
            const glow  = (1 - hpFrac * 2) * (0.5 + Math.sin(now / 80) * 0.5);
            CTX.globalAlpha = glow * 0.55;
            CTX.shadowBlur  = 0;
            CTX.fillStyle   = 'rgba(249,115,22,0.9)';
            CTX.beginPath();
            CTX.roundRect(0, 4, W, H - 8, 5);
            CTX.fill();
            CTX.globalAlpha = 1;
        }

        CTX.restore();

        // ── HP bar — only drawn if barrel has taken damage ────
        // Drawn after the main CTX.restore() so it sits in world
        // space above the barrel, not clipped by any inner state.
        if (this.hp < this.maxHp) {
            const BAR_W  = 34;
            const BAR_H  = 5;
            const barX   = cx - BAR_W / 2;
            const barY   = screen.y - 10;
            const pct    = Math.max(0, this.hp / this.maxHp);
            const barCol = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#f59e0b' : '#ef4444';

            CTX.save();
            // Background track
            CTX.fillStyle = 'rgba(0,0,0,0.60)';
            CTX.fillRect(barX, barY, BAR_W, BAR_H);
            // Filled portion
            CTX.fillStyle = barCol;
            CTX.fillRect(barX, barY, BAR_W * pct, BAR_H);
            // Border
            CTX.strokeStyle = 'rgba(0,0,0,0.80)';
            CTX.lineWidth   = 1;
            CTX.strokeRect(barX, barY, BAR_W, BAR_H);
            CTX.restore();
        }
    }
}

// ════════════════════════════════════════════════════════════
// 🏫 MTC ROOM — Safe Zone
// ════════════════════════════════════════════════════════════
class MTCRoom {
    constructor(x, y) {
        this.x=x; this.y=y;
        this.w=BALANCE.mtcRoom.size; this.h=BALANCE.mtcRoom.size;
        this.healRate=BALANCE.mtcRoom.healRate;
        this.maxStayTime=BALANCE.mtcRoom.maxStayTime;
        this.cooldownTime=BALANCE.mtcRoom.cooldownTime;
        this.playerStayTime=0; this.cooldown=0; this.isPlayerInside=false;
    }

    update(dt, player) {
        this.cooldown=Math.max(0,this.cooldown-dt);
        const inside=this.checkPlayerInside(player.x,player.y);

        if (inside && this.cooldown<=0) {
            if (!this.isPlayerInside) {
                this.isPlayerInside=true; this.playerStayTime=0;
                spawnFloatingText('SAFE ZONE!',player.x,player.y-60,'#10b981',25);
                showVoiceBubble('เข้าสู่ MTC Room - กำลังรักษา...',player.x,player.y-40);
            }
            this.playerStayTime+=dt;
            if (player.hp<player.maxHp) {
                player.hp=Math.min(player.maxHp,player.hp+this.healRate*dt);
                if (Math.random()<0.3)
                    spawnParticles(player.x+rand(-20,20),player.y+rand(-20,20),1,'#10b981');
            }
            if (player.energy<player.maxEnergy)
                player.energy=Math.min(player.maxEnergy,player.energy+30*dt);
            if (this.playerStayTime>=this.maxStayTime) this.kickOut(player);
        } else {
            if (this.isPlayerInside) this.isPlayerInside=false;
        }
    }

    checkPlayerInside(px, py) {
        return px>=this.x && px<=this.x+this.w && py>=this.y && py<=this.y+this.h;
    }

    kickOut(player) {
        this.isPlayerInside=false; this.cooldown=this.cooldownTime;
        spawnFloatingText('เวลาหมด!',player.x,player.y-60,'#f59e0b',20);
        showVoiceBubble('ออกจาก MTC Room แล้ว',player.x,player.y-40);
        const centerX=this.x+this.w/2, centerY=this.y+this.h/2;
        const angle=Math.atan2(player.y-centerY,player.x-centerX);
        player.vx=Math.cos(angle)*200; player.vy=Math.sin(angle)*200;
    }

    draw() {
        const s=worldToScreen(this.x,this.y);
        const W=this.w, H=this.h;
        const pal=BALANCE.map.mapColors;
        const now=_mapNow;
        CTX.save();

        const tileSize=30;
        CTX.save();
        CTX.beginPath(); CTX.rect(s.x,s.y,W,H); CTX.clip();
        for(let ty=0;ty<H;ty+=tileSize){
            for(let tx=0;tx<W;tx+=tileSize){
                const alt=(Math.floor(tx/tileSize)+Math.floor(ty/tileSize))%2;
                CTX.fillStyle=alt?pal.floor:pal.floorAlt;
                CTX.fillRect(s.x+tx,s.y+ty,tileSize,tileSize);
            }
        }
        CTX.strokeStyle='rgba(0,0,0,0.12)'; CTX.lineWidth=0.8;
        for(let ty=0;ty<=H;ty+=tileSize){CTX.beginPath();CTX.moveTo(s.x,s.y+ty);CTX.lineTo(s.x+W,s.y+ty);CTX.stroke();}
        for(let tx=0;tx<=W;tx+=tileSize){CTX.beginPath();CTX.moveTo(s.x+tx,s.y);CTX.lineTo(s.x+tx,s.y+H);CTX.stroke();}
        CTX.restore();

        const wbX=s.x+20,wbY=s.y+8,wbW=W-40,wbH=48;
        CTX.fillStyle='#3d1c00';
        CTX.beginPath(); CTX.roundRect(wbX-4,wbY-4,wbW+8,wbH+8,3); CTX.fill();
        CTX.fillStyle=pal.whiteboardGreen;
        CTX.beginPath(); CTX.roundRect(wbX,wbY,wbW,wbH,2); CTX.fill();
        CTX.fillStyle=pal.chalkWhite; CTX.font='bold 11px monospace'; CTX.textAlign='center'; CTX.textBaseline='middle';
        CTX.fillText('MTC  •  Math & Computer Engineering',s.x+W/2,wbY+12);
        CTX.font='10px monospace';
        CTX.fillText('y = mx + c    |    ∑n²    |    P(A∩B)',s.x+W/2,wbY+28);
        CTX.font='bold 9px monospace'; CTX.fillStyle='#86efac';
        CTX.fillText('>>> print("Hello, MTC!")   →   O(log n)',s.x+W/2,wbY+42);
        CTX.fillStyle='#4a2000'; CTX.fillRect(wbX,wbY+wbH,wbW,5);
        [pal.chalkWhite,'#fca5a5','#fde68a','#86efac'].forEach((c,i)=>{
            CTX.fillStyle=c; CTX.fillRect(wbX+10+i*20,wbY+wbH+1,14,3);
        });

        const deskW=44,deskH=28,deskStartX=s.x+18,deskStartY=s.y+76;
        const deskCols=3,deskRows=2;
        const deskColGap=(W-36-deskCols*deskW)/(deskCols-1);
        for(let row=0;row<deskRows;row++){
            for(let col=0;col<deskCols;col++){
                const dx=deskStartX+col*(deskW+deskColGap);
                const dy=deskStartY+row*(deskH+38);
                CTX.save(); CTX.translate(dx,dy); drawDesk(deskW,deskH); CTX.restore();
            }
        }

        CTX.save(); CTX.translate(s.x+W-60,s.y+H-80); drawServer(48,68); CTX.restore();

        CTX.save(); CTX.translate(s.x+16,s.y+H-54); drawDesk(72,36);
        CTX.fillStyle='#1e40af'; CTX.beginPath(); CTX.arc(62,10,8,0,Math.PI*2); CTX.fill();
        CTX.fillStyle='#93c5fd'; CTX.beginPath(); CTX.arc(62,10,5,0,Math.PI*2); CTX.fill();
        CTX.strokeStyle='#1e40af'; CTX.lineWidth=2;
        CTX.beginPath(); CTX.arc(71,12,5,-0.5,1.2); CTX.stroke();
        CTX.restore();

        const pulse=this.cooldown>0?1:(Math.sin(now/350)*.3+.7);
        CTX.strokeStyle=this.cooldown>0?'#64748b':'#10b981';
        CTX.lineWidth=3; CTX.globalAlpha=pulse;
        if (this.cooldown>0) CTX.setLineDash([10,6]);
        CTX.strokeRect(s.x,s.y,W,H);
        CTX.setLineDash([]); CTX.globalAlpha=1;

        const cornerLen=18;
        CTX.strokeStyle=this.cooldown>0?'#94a3b8':'#34d399'; CTX.lineWidth=3;
        [[s.x,s.y,1,1],[s.x+W,s.y,-1,1],[s.x,s.y+H,1,-1],[s.x+W,s.y+H,-1,-1]].forEach(([cx,cy,sx2,sy2])=>{
            CTX.beginPath();
            CTX.moveTo(cx+sx2*cornerLen,cy); CTX.lineTo(cx,cy); CTX.lineTo(cx,cy+sy2*cornerLen);
            CTX.stroke();
        });

        if (this.cooldown>0) {
            CTX.fillStyle='rgba(15,23,42,0.82)';
            CTX.beginPath(); CTX.roundRect(s.x+W/2-65,s.y+H/2-18,130,36,8); CTX.fill();
            CTX.fillStyle='#94a3b8'; CTX.font='bold 11px Orbitron,monospace';
            CTX.textAlign='center'; CTX.textBaseline='middle';
            CTX.fillText('MTC ROOM',s.x+W/2,s.y+H/2-6);
            CTX.font='bold 12px Arial'; CTX.fillStyle='#f59e0b';
            CTX.fillText(`CD ${Math.ceil(this.cooldown)}s`,s.x+W/2,s.y+H/2+10);
        } else {
            CTX.fillStyle='rgba(16,185,129,0.18)';
            CTX.beginPath(); CTX.roundRect(s.x+W/2-58,s.y+H-26,116,20,6); CTX.fill();
            CTX.fillStyle=`rgba(52,211,153,${pulse})`; CTX.font='bold 10px Orbitron,monospace';
            CTX.textAlign='center'; CTX.textBaseline='middle';
            CTX.fillText('⚕ SAFE ZONE — ฟื้นฟู HP',s.x+W/2,s.y+H-16);
        }
        if (this.isPlayerInside) {
            const timeLeft=this.maxStayTime-this.playerStayTime;
            CTX.fillStyle='#fbbf24'; CTX.font='bold 20px Arial';
            CTX.textAlign='center'; CTX.textBaseline='middle';
            CTX.fillText(`⏱ ${timeLeft.toFixed(1)}s`,s.x+W/2,s.y+H-44);
        }
        CTX.restore();
    }
}

// ════════════════════════════════════════════════════════════
// 🗺️ MAP SYSTEM
// ════════════════════════════════════════════════════════════
class MapSystem {
    constructor() {
        this.objects     = [];
        this.mtcRoom     = null;
        this.initialized = false;
        this._lightCanvas = null;
        this._lightCtx    = null;
    }

    init() {
        if (this.initialized) return;
        this.objects = [];

        if (!this._lightCanvas) {
            this._lightCanvas = document.createElement('canvas');
            this._lightCtx    = this._lightCanvas.getContext('2d');
        }

        this.generateCampusMap();
        this.mtcRoom = new MTCRoom(-400, -100);
        this._sortedObjects = null;
        this.initialized = true;
        console.log(`✅ Campus Map: ${this.objects.length} objects + MTC Room`);
    }

    generateCampusMap() {
        const sizes = {
            desk:       { w:60,  h:40  },
            tree:       { w:50,  h:50  },
            server:     { w:45,  h:80  },
            datapillar: { w:35,  h:70  },
            bookshelf:  { w:80,  h:40  },
            blackboard: { w:150, h:80  }
        };

        const placeZone=(xMin,xMax,yMin,yMax,types,count,minSep=220)=>{
            let placed=0, tries=0;
            while(placed<count && tries<count*15){
                tries++;
                const x=xMin+Math.random()*(xMax-xMin);
                const y=yMin+Math.random()*(yMax-yMin);
                if(Math.abs(x)<180 && Math.abs(y)<180) continue;
                if(x>-520&&x<-80&&y>-220&&y<220) continue;
                let tooClose=false;
                for(const obj of this.objects){
                    if(Math.hypot(obj.x-x,obj.y-y)<minSep){tooClose=true;break;}
                }
                if(tooClose) continue;
                const type=types[Math.floor(Math.random()*types.length)];
                const sz=sizes[type];
                this.objects.push(new MapObject(x,y,sz.w,sz.h,type));
                placed++;
            }
        };

        // IMP-7 FIX: each zone previously had two placeZone() calls with the
        // same bounds but different minSep values (e.g. 200 then 180).  The
        // second pass could place objects within 180 px of objects already
        // placed at 200 px separation, producing occasional overlaps.
        // Consolidated to one call per zone using the larger minSep throughout.
        placeZone(-1400,-500,-1400,-450,['tree','tree','tree','bookshelf'],16,200);
        placeZone(500,1400,-1400,-450, ['datapillar','datapillar','server'],13,200);
        placeZone(-1400,-500,450,1400, ['bookshelf','bookshelf','desk','tree'],12,200);
        placeZone(500,1400,450,1400,   ['desk','desk','tree','bookshelf'],12,200);
        placeZone(-450,450,-1400,-600,['datapillar','tree'],4,350);
        placeZone(-450,450,600,1400,['tree','bookshelf'],4,350);
        placeZone(-1400,-600,-300,300,['datapillar','tree'],4,350);
        placeZone(600,1400,-300,300,['datapillar','server'],4,350);

        this.objects.push(new MapObject(-75,-620,150,80,'blackboard'));
        this.objects.push(new MapObject(-220,-240,35,70,'datapillar'));
        this.objects.push(new MapObject(160,-240,35,70,'datapillar'));

        [[-480,-430],[430,-430],[-480,380],[430,380]].forEach(([tx,ty])=>{
            this.objects.push(new MapObject(tx,ty,50,50,'tree'));
        });

        for(const wall of BALANCE.map.wallPositions){
            this.objects.push(new MapObject(wall.x,wall.y,wall.w,wall.h,'wall'));
        }

        // ── Explosive Barrels (5–8 placed in mid-range zones) ──────
        // Placed 200–900 units from origin to keep them in playable
        // territory without blocking the spawn point or MTC Room.
        // Each barrel is separated from every other object by at least
        // 280 world units so clusters don't create impassable walls.
        const barrelCount = 5 + Math.floor(Math.random() * 4); // 5–8
        let barrelsPlaced = 0;
        let barrelTries   = 0;
        while (barrelsPlaced < barrelCount && barrelTries < barrelCount * 25) {
            barrelTries++;
            const angle = Math.random() * Math.PI * 2;
            // Spawn between 200 and 900 units from origin
            const distance = 200 + Math.random() * 700;
            const bx = Math.cos(angle) * distance;
            const by = Math.sin(angle) * distance;

            // Skip the MTC Room footprint (guard rectangle -520 to -80, -220 to 220)
            if (bx > -560 && bx < -50 && by > -250 && by < 250) continue;
            // Skip the player spawn zone
            if (Math.abs(bx) < 200 && Math.abs(by) < 200) continue;

            // Ensure minimum separation from every existing object
            let tooClose = false;
            for (const obj of this.objects) {
                if (Math.hypot(obj.x - bx, obj.y - by) < 280) { tooClose = true; break; }
            }
            if (tooClose) continue;

            this.objects.push(new ExplosiveBarrel(bx, by));
            barrelsPlaced++;
        }
        console.log(`🛢️ Campus Map: placed ${barrelsPlaced} explosive barrel(s)`);
    }

    update(entities, dt = 0) {
        for(const entity of entities){
            if(entity.dead) continue;
            for(const obj of this.objects) obj.resolveCollision(entity);
        }
        if(this.mtcRoom && window.player){
            this.mtcRoom.update(dt, window.player);
        }
    }

    // ════════════════════════════════════════════════════════
    // 🌐 drawTerrain(ctx, camera)
    //
    // Renders the "MTC Cyber-Campus Arena" floor every frame.
    // All style values are read from window.MAP_CONFIG (config.js).
    // Load order requirement:  config.js  →  map.js
    //
    // Layers (back → front):
    //   1. Arena boundary  — 3 concentric rings + animated dashes
    //   2. Tech-hex grid   — flat-top hexagons, fading outward
    //   3. Circuit paths   — animated PCB traces to DB & Shop
    //   4. Zone auras      — radial glow pools under landmarks
    // ════════════════════════════════════════════════════════
    drawTerrain(ctx, camera) {
        if (typeof MAP_CONFIG === 'undefined') return;

        const C  = MAP_CONFIG;
        const ws = (wx, wy) => worldToScreen(wx, wy);
        const t  = performance.now() * 0.001;

        // ── 1. ARENA BOUNDARY ────────────────────────────────────
        {
            const A        = C.arena;
            const origin   = ws(0, 0);
            const edgePt   = ws(A.radius, 0);
            const radiusSS = Math.abs(edgePt.x - origin.x);

            ctx.save();

            ctx.strokeStyle = A.haloColor.replace('{a}',
                (A.haloAlphaBase + Math.sin(t * 0.6) * 0.03).toFixed(3));
            ctx.lineWidth   = 52;
            ctx.beginPath();
            ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = A.midColor.replace('{a}',
                (A.midAlphaBase + Math.sin(t * 0.9) * 0.04).toFixed(3));
            ctx.lineWidth   = 20;
            ctx.beginPath();
            ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2);
            ctx.stroke();

            ctx.strokeStyle = A.rimColor.replace('{a}',
                (A.rimAlphaBase + Math.sin(t * 1.4) * 0.12).toFixed(3));
            ctx.lineWidth   = 3;
            ctx.shadowBlur  = A.rimGlowBlur;
            ctx.shadowColor = A.rimGlowColor;
            ctx.beginPath();
            ctx.arc(origin.x, origin.y, radiusSS, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur  = 0;

            ctx.strokeStyle    = A.dashColor.replace('{a}',
                (A.dashAlphaBase + Math.sin(t * 1.8) * 0.10).toFixed(3));
            ctx.lineWidth      = 1.5;
            ctx.setLineDash([6, 30]);
            ctx.lineDashOffset = -(t * 18) % 36;
            ctx.beginPath();
            ctx.arc(origin.x, origin.y, radiusSS + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;

            ctx.restore();
        }

        // ── 2. TECH-HEX GRID ─────────────────────────────────────
        {
            const H        = C.hex;
            const HEX_SIZE = H.size;
            const HEX_W    = HEX_SIZE * 2;
            const HEX_H    = Math.sqrt(3) * HEX_SIZE;
            const COL_STEP = HEX_W * 0.75;
            const ROW_STEP = HEX_H;

            const viewL    = camera.x - CANVAS.width  * 0.5;
            const viewT    = camera.y - CANVAS.height * 0.5;

            const colStart = Math.floor(viewL / COL_STEP) - 1;
            const colEnd   = colStart + Math.ceil((CANVAS.width  + HEX_W * 2) / COL_STEP) + 2;
            const rowStart = Math.floor(viewT / ROW_STEP) - 1;
            const rowEnd   = rowStart + Math.ceil((CANVAS.height + HEX_H * 2) / ROW_STEP) + 2;

            ctx.save();
            ctx.lineWidth = 0.9;

            for (let col = colStart; col <= colEnd; col++) {
                for (let row = rowStart; row <= rowEnd; row++) {
                    const wx      = col * COL_STEP;
                    const wy      = row * ROW_STEP + (col % 2 === 0 ? 0 : HEX_H * 0.5);
                    const distW   = Math.sqrt(wx * wx + wy * wy);
                    const falloff = Math.max(0, 1 - distW / H.falloffRadius);
                    if (falloff < 0.02) continue;

                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle  = (Math.PI / 3) * i;
                        const corner = ws(
                            wx + HEX_SIZE * Math.cos(angle),
                            wy + HEX_SIZE * Math.sin(angle)
                        );
                        i === 0 ? ctx.moveTo(corner.x, corner.y)
                                : ctx.lineTo(corner.x, corner.y);
                    }
                    ctx.closePath();

                    if ((Math.abs(col) + Math.abs(row)) % 3 === 0) {
                        ctx.fillStyle = H.fillColor.replace('{a}',
                            (H.fillAlpha * falloff).toFixed(3));
                        ctx.fill();
                    }

                    ctx.strokeStyle = H.strokeColor.replace('{a}',
                        (H.strokeAlpha * falloff).toFixed(3));
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        // ── 3. CIRCUIT PATHS ─────────────────────────────────────
        const drawCircuitPath = (pathCfg) => {
            const P  = C.paths;
            const pc = pathCfg;

            const A  = ws(pc.from.x, pc.from.y);
            const B  = ws(pc.to.x,   pc.to.y  );
            const M  = ws(pc.to.x,   pc.from.y);  // L-elbow: horizontal first

            ctx.save();

            // Outer glow
            ctx.strokeStyle = pc.glowColor;
            ctx.lineWidth   = P.glowWidth;
            ctx.globalAlpha = P.glowAlphaBase + Math.sin(t * 1.2 + pc.phase) * 0.05;
            ctx.beginPath();
            ctx.moveTo(A.x, A.y); ctx.lineTo(M.x, M.y); ctx.lineTo(B.x, B.y);
            ctx.stroke();

            // Mid halo
            ctx.lineWidth   = P.glowWidth * 0.5;
            ctx.globalAlpha = (P.glowAlphaBase + 0.08) + Math.sin(t * 0.8 + pc.phase) * 0.06;
            ctx.beginPath();
            ctx.moveTo(A.x, A.y); ctx.lineTo(M.x, M.y); ctx.lineTo(B.x, B.y);
            ctx.stroke();

            // Core bright line
            ctx.strokeStyle = pc.coreColor;
            ctx.lineWidth   = P.coreWidth;
            ctx.globalAlpha = P.coreAlphaBase + Math.sin(t * 2.2 + pc.phase) * 0.15;
            ctx.shadowBlur  = P.coreGlowBlur;
            ctx.shadowColor = pc.glowColor;
            ctx.beginPath();
            ctx.moveTo(A.x, A.y); ctx.lineTo(M.x, M.y); ctx.lineTo(B.x, B.y);
            ctx.stroke();
            ctx.shadowBlur  = 0;

            // Animated packet dots
            const seg1Len = Math.hypot(M.x - A.x, M.y - A.y);
            const seg2Len = Math.hypot(B.x - M.x, B.y - M.y);
            const total   = seg1Len + seg2Len;

            if (total > 1) {
                for (let p = 0; p < P.packetCount; p++) {
                    const progress  = ((t * P.packetSpeed + pc.phase * 0.25 + p * (1 / P.packetCount)) % 1 + 1) % 1;
                    const travelled = progress * total;

                    let px, py;
                    if (travelled <= seg1Len) {
                        const u = travelled / seg1Len;
                        px = A.x + (M.x - A.x) * u;
                        py = A.y + (M.y - A.y) * u;
                    } else {
                        const u = (travelled - seg1Len) / seg2Len;
                        px = M.x + (B.x - M.x) * u;
                        py = M.y + (B.y - M.y) * u;
                    }

                    ctx.fillStyle   = pc.coreColor;
                    ctx.shadowBlur  = P.coreGlowBlur;
                    ctx.shadowColor = pc.glowColor;

                    ctx.globalAlpha = 0.30;
                    ctx.beginPath();
                    ctx.arc(px, py, P.packetAuraRadius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.globalAlpha = 0.95;
                    ctx.beginPath();
                    ctx.arc(px, py, P.packetRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur  = 0;
                }
            }

            // Elbow node
            ctx.globalAlpha = 0.85 + Math.sin(t * 2.5 + pc.phase) * 0.10;
            ctx.fillStyle   = pc.coreColor;
            ctx.shadowBlur  = 12;
            ctx.shadowColor = pc.glowColor;
            ctx.beginPath();
            ctx.arc(M.x, M.y, P.elbowRadius, 0, Math.PI * 2);
            ctx.fill();

            // Origin node
            ctx.globalAlpha = 0.75;
            ctx.beginPath();
            ctx.arc(A.x, A.y, P.elbowRadius - 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur  = 0;

            ctx.restore();
        };

        drawCircuitPath(C.paths.database);
        drawCircuitPath(C.paths.shop);

        // ── 4. ZONE AURAS ─────────────────────────────────────────
        const drawZoneAura = (auraCfg) => {
            const S  = C.auras;
            const ac = auraCfg;

            const sc     = ws(ac.worldX, ac.worldY);
            const edgePt = ws(ac.worldX + ac.radius, ac.worldY);
            const rSS    = Math.abs(edgePt.x - sc.x);
            const pulse  = 0.50 + Math.sin(t * 1.5 + ac.phase) * 0.18;

            ctx.save();

            const grad = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, rSS);
            grad.addColorStop(0,    `rgba(${ac.innerRgb}, ${(S.innerAlphaBase * pulse).toFixed(3)})`);
            grad.addColorStop(0.50, `rgba(${ac.innerRgb}, ${(S.midAlphaBase   * pulse).toFixed(3)})`);
            grad.addColorStop(0.80, `rgba(${ac.outerRgb}, ${(S.outerAlphaBase * pulse).toFixed(3)})`);
            grad.addColorStop(1,    `rgba(${ac.outerRgb}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, rSS, 0, Math.PI * 2);
            ctx.fill();

            // Pulsing rim
            ctx.globalAlpha = S.rimAlphaBase * pulse;
            ctx.strokeStyle = `rgba(${ac.innerRgb}, 1)`;
            ctx.lineWidth   = S.rimWidth;
            ctx.shadowBlur  = S.rimGlowBlur;
            ctx.shadowColor = `rgba(${ac.innerRgb}, 0.9)`;
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, rSS, 0, Math.PI * 2);
            ctx.stroke();

            // Outer dashed ring
            ctx.globalAlpha    = S.dashAlphaBase * pulse;
            ctx.shadowBlur     = 0;
            ctx.setLineDash([8, 14]);
            ctx.lineDashOffset = -(t * 12 + ac.phase * 8) % 22;
            ctx.beginPath();
            ctx.arc(sc.x, sc.y, rSS * S.dashOuterMult, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset = 0;

            ctx.restore();
        };

        drawZoneAura(C.auras.database);
        drawZoneAura(C.auras.shop);
        drawZoneAura(C.auras.origin);
    }

    draw() {
        _updateMapNow();
        if(this.mtcRoom) this.mtcRoom.draw();
        const CULL=120;
        if(!this._sortedObjects) this._sortedObjects=[...this.objects].sort((a,b)=>a.y-b.y);
        for(const obj of this._sortedObjects){
            const screen=worldToScreen(obj.x,obj.y);
            if(screen.x+obj.w<-CULL||screen.x>CANVAS.width+CULL) continue;
            if(screen.y+obj.h<-CULL||screen.y>CANVAS.height+CULL) continue;
            obj.draw();
        }
    }

    // ════════════════════════════════════════════════════════
    // 💡 drawLighting
    // ════════════════════════════════════════════════════════
    drawLighting(player, projectiles=[], extraLights=[]) {
        const L=BALANCE.LIGHTING;
        const darkness=1.0-L.ambientLight;
        if(darkness<0.02) return;

        const lc=this._lightCanvas, lctx=this._lightCtx;
        if(lc.width!==CANVAS.width||lc.height!==CANVAS.height){
            lc.width=CANVAS.width; lc.height=CANVAS.height;
        }

        const shake=getScreenShakeOffset();
        const toSS=(wx,wy)=>{
            const s=worldToScreen(wx,wy);
            return{x:s.x+shake.x, y:s.y+shake.y};
        };

        lctx.globalCompositeOperation='source-over';
        lctx.clearRect(0,0,lc.width,lc.height);
        lctx.fillStyle=`rgba(${L.nightR},${L.nightG},${L.nightB},${darkness.toFixed(3)})`;
        lctx.fillRect(0,0,lc.width,lc.height);

        const punchLight=(wx,wy,radius,type='neutral',intensity=1.0)=>{
            const{x,y}=toSS(wx,wy);
            const r=radius*intensity;

            lctx.globalCompositeOperation='destination-out';
            const erase=lctx.createRadialGradient(x,y,0,x,y,r);
            erase.addColorStop(0,'rgba(0,0,0,1)');
            erase.addColorStop(0.38,'rgba(0,0,0,0.92)');
            erase.addColorStop(0.65,'rgba(0,0,0,0.55)');
            erase.addColorStop(0.88,'rgba(0,0,0,0.18)');
            erase.addColorStop(1,'rgba(0,0,0,0)');
            lctx.fillStyle=erase;
            lctx.beginPath(); lctx.arc(x,y,r,0,Math.PI*2); lctx.fill();

            lctx.globalCompositeOperation='source-over';
            const tintR=r*0.55;
            const tAlpha=0.11*darkness;
            let tInner,tOuter;
            if(type==='warm'){tInner=`rgba(255,190,70,${tAlpha})`;tOuter='rgba(255,140,30,0)';}
            else if(type==='cool'){tInner=`rgba(60,220,255,${tAlpha})`;tOuter='rgba(0,180,255,0)';}
            else{tInner=`rgba(210,225,255,${tAlpha*.7})`;tOuter='rgba(180,205,255,0)';}
            const tint=lctx.createRadialGradient(x,y,0,x,y,tintR);
            tint.addColorStop(0,tInner); tint.addColorStop(1,tOuter);
            lctx.fillStyle=tint;
            lctx.beginPath(); lctx.arc(x,y,tintR,0,Math.PI*2); lctx.fill();
        };

        if(player&&!player.dead){
            const dashMult=player.isDashing?1.25:1.0;
            punchLight(player.x,player.y,L.playerLightRadius,'warm',dashMult);
        }

        if (typeof window.projectiles !== 'undefined' && Array.isArray(window.projectiles)) {
            for(const proj of window.projectiles){
                if(!proj||proj.dead) continue;
                punchLight(proj.x,proj.y,L.projectileLightRadius,proj.team==='player'?'cool':'warm');
            }
        }

        const MAX_LIGHT_RADIUS=Math.max(L.dataPillarLightRadius,L.serverRackLightRadius)+40;
        for(const obj of this.objects){
            if(obj.type==='datapillar'||obj.type==='server'){
                const cx=obj.x+obj.w*.5;
                const cy=obj.type==='datapillar'?obj.y-5:obj.y+obj.h*.4;
                const sp=toSS(cx,cy);
                if(sp.x+MAX_LIGHT_RADIUS<0||sp.x-MAX_LIGHT_RADIUS>lc.width) continue;
                if(sp.y+MAX_LIGHT_RADIUS<0||sp.y-MAX_LIGHT_RADIUS>lc.height) continue;
            }
            if(obj.type==='datapillar') punchLight(obj.x+obj.w*.5,obj.y-5,L.dataPillarLightRadius,'cool');
            else if(obj.type==='server') punchLight(obj.x+obj.w*.5,obj.y+obj.h*.4,L.serverRackLightRadius,'cool');
        }

        for(const light of extraLights){
            punchLight(light.x,light.y,light.radius||100,light.type||'neutral',light.intensity||1.0);
        }

        if(this.mtcRoom){
            const rx=this.mtcRoom.x+this.mtcRoom.w*.5;
            const ry=this.mtcRoom.y+this.mtcRoom.h*.5;
            punchLight(rx,ry,180,'warm',1.1);
        }

        lctx.globalCompositeOperation='source-over';
        CTX.drawImage(lc,0,0);
    }

    // ════════════════════════════════════════════════════════
    // 💥 damageArea
    // ════════════════════════════════════════════════════════
    damageArea(startX, startY, endX, endY) {
        const lineHitsAABB = (x1, y1, x2, y2, rx, ry, rw, rh) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            let tMin = 0;
            let tMax = 1;

            if (Math.abs(dx) < 1e-9) {
                if (x1 < rx || x1 > rx + rw) return false;
            } else {
                const invDx = 1 / dx;
                let t1 = (rx        - x1) * invDx;
                let t2 = (rx + rw   - x1) * invDx;
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                tMin = Math.max(tMin, t1);
                tMax = Math.min(tMax, t2);
                if (tMin > tMax) return false;
            }

            if (Math.abs(dy) < 1e-9) {
                if (y1 < ry || y1 > ry + rh) return false;
            } else {
                const invDy = 1 / dy;
                let t1 = (ry        - y1) * invDy;
                let t2 = (ry + rh   - y1) * invDy;
                if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
                tMin = Math.max(tMin, t1);
                tMax = Math.min(tMax, t2);
                if (tMin > tMax) return false;
            }

            return true;
        };

        const surviving = [];
        for (const obj of this.objects) {
            if (lineHitsAABB(startX, startY, endX, endY, obj.x, obj.y, obj.w, obj.h)) {
                if (typeof spawnParticles === 'function') {
                    spawnParticles(obj.x + obj.w * 0.5, obj.y + obj.h * 0.5, 12, '#3b82f6');
                }
                if (typeof spawnFloatingText === 'function') {
                    spawnFloatingText('💥', obj.x + obj.w * 0.5, obj.y - 20, '#60a5fa', 20);
                }
            } else {
                surviving.push(obj);
            }
        }
        this.objects = surviving;
        this._sortedObjects = null;

        if (this.mtcRoom) {
            const r = this.mtcRoom;
            if (lineHitsAABB(startX, startY, endX, endY, r.x, r.y, r.w, r.h)) {
                const shrink   = 0.10;
                const oldW     = r.w;
                const oldH     = r.h;
                const newW     = oldW * (1 - shrink);
                const newH     = oldH * (1 - shrink);
                r.x += (oldW - newW) * 0.5;
                r.y += (oldH - newH) * 0.5;
                r.w  = newW;
                r.h  = newH;

                if (typeof spawnFloatingText === 'function') {
                    spawnFloatingText('MTC ROOM DAMAGED!', r.x + r.w * 0.5, r.y - 30, '#f59e0b', 22);
                }
            }
        }
    }

    clear() {
        this.objects=[]; this.mtcRoom=null; this.initialized=false; this._sortedObjects=null;
    }

    getObjects() { return this.objects; }

    isBlocked(x,y,radius=0) {
        for(const obj of this.objects) if(obj.checkCollision(x,y,radius)) return true;
        return false;
    }

    findSafeSpawn(preferredX,preferredY,radius) {
        for(let i=0;i<50;i++){
            const angle=(Math.PI*2/50)*i;
            const distance=100+i*50;
            const x=preferredX+Math.cos(angle)*distance;
            const y=preferredY+Math.sin(angle)*distance;
            if(!this.isBlocked(x,y,radius)) return{x,y};
        }
        return{x:preferredX,y:preferredY};
    }
}

const mapSystem = new MapSystem();

window.mapSystem        = mapSystem;
window.MapSystem        = MapSystem;
window.MapObject        = MapObject;
window.MTCRoom          = MTCRoom;
window.ExplosiveBarrel  = ExplosiveBarrel;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MapObject, MTCRoom, MapSystem, mapSystem, ExplosiveBarrel };
}