'use strict';

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP SYSTEM (extracted from game.js)
// ══════════════════════════════════════════════════════════════

// ─── MTC Shop Location ────────────────────────────────────────
// ⚠️  ห้ามแก้ค่าที่นี่ — แก้ที่ BALANCE.shop ใน config.js เท่านั้น
// Object นี้เป็น live proxy ให้โค้ดเดิมที่อ้าง MTC_SHOP_LOCATION ยังทำงานได้
const MTC_SHOP_LOCATION = {
    get x() { return BALANCE.shop.x; },
    get y() { return BALANCE.shop.y; },
    get INTERACTION_RADIUS() { return BALANCE.shop.interactionRadius; },
};
window.MTC_SHOP_LOCATION = MTC_SHOP_LOCATION;

// ══════════════════════════════════════════════════════════════
// 🛒 SHOP — DRAW, PROXIMITY, OPEN, CLOSE, BUY
// ══════════════════════════════════════════════════════════════

function drawShopObject() {
    // ── Visual ถูกแทนที่ด้วย MapObject 'coopstore' แล้ว ──
    // เหลือแค่ proximity aura ring เพื่อบอกผู้เล่นว่าเข้า interact ได้
    const cfg = BALANCE.shop;
    const screen = worldToScreen(cfg.x, cfg.y);
    const t = performance.now() / cfg.glowSpeedMs;
    const glow = Math.abs(Math.sin(t)) * 0.5 + 0.5;

    if (!window.player) return;
    const d = dist(window.player.x, window.player.y, cfg.x, cfg.y);
    if (d < cfg.interactionRadius * 2.5) {
        const alpha = Math.max(0, 1 - d / (cfg.interactionRadius * 2.5));
        CTX.save();
        CTX.globalAlpha = alpha * cfg.auraAlphaMult * glow;
        CTX.strokeStyle = cfg.auraColor;
        CTX.lineWidth = cfg.auraLineWidth;
        CTX.setLineDash(cfg.auraDash);
        CTX.beginPath();
        CTX.arc(screen.x, screen.y, cfg.interactionRadius, 0, Math.PI * 2);
        CTX.stroke();
        CTX.setLineDash([]);
        CTX.restore();

        // "ENTER" label เมื่อใกล้ enough
        if (d < cfg.interactionRadius * 1.2) {
            CTX.save();
            CTX.globalAlpha = Math.max(0, 1 - d / cfg.interactionRadius) * (0.7 + glow * 0.3);
            CTX.fillStyle = cfg.labelColor;
            CTX.font = 'bold 11px Orbitron,monospace';
            CTX.textAlign = 'center'; CTX.textBaseline = 'middle';
            CTX.fillText('[B] ENTER SHOP', screen.x, screen.y - cfg.interactionRadius - 12);
            CTX.restore();
        }
    }
}

function updateShopProximityUI() {
    if (!window.player) return;
    const cfg = BALANCE.shop;
    const d = dist(window.player.x, window.player.y, cfg.x, cfg.y);
    const near = d < cfg.interactionRadius;

    const promptEl = document.getElementById('shop-prompt');
    const hudIcon = document.getElementById('shop-hud-icon');
    const btnShop = document.getElementById('btn-shop');

    if (promptEl) promptEl.style.display = near ? 'block' : 'none';
    if (hudIcon) hudIcon.style.display = near ? 'flex' : 'none';
    if (btnShop) btnShop.style.display = near ? 'flex' : 'none';
}

function openShop() {
    if (window.gameState !== 'PLAYING') return;
    setGameState('PAUSED');

    const promptEl = document.getElementById('shop-prompt');
    if (promptEl) promptEl.style.display = 'none';

    ShopManager.open();

    if (window.player) spawnFloatingText(GAME_TEXTS.shop.open, window.player.x, window.player.y - 70, '#facc15', 22);
    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
}

function closeShop() {
    if (window.gameState !== 'PAUSED') return;
    setGameState('PLAYING');

    ShopManager.close();
    showResumePrompt(false);

    keys.w = 0; keys.a = 0; keys.s = 0; keys.d = 0;
    keys.space = 0; keys.q = 0; keys.e = 0; keys.b = 0; keys.f = 0;

    window.focus();

    if (window.player) spawnFloatingText(GAME_TEXTS.shop.resumed, window.player.x, window.player.y - 50, '#34d399', 18);
}

// ══════════════════════════════════════════════════════════════
// 🎲 ROGUELITE SHOP — Roll / Reroll / Buy
// ══════════════════════════════════════════════════════════════

window.currentShopOffers = [];

// ⚠️  slotCount และ rerollCost อ่านจาก BALANCE.shop ใน config.js
function rollShopItems() {
    const pool = [...SHOP_ITEMS];
    const slotCount = BALANCE.shop.slotCount;
    window.currentShopOffers = [];
    for (let i = 0; i < slotCount && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        window.currentShopOffers.push({ item: pool[idx], soldOut: false });
        // swap-and-pop — O(1), no GC churn
        pool[idx] = pool[pool.length - 1];
        pool.pop();
    }
}

function rerollShop() {
    if (!window.player) return;
    const rerollCost = BALANCE.shop.rerollCost;
    const score = typeof getScore === 'function' ? getScore() : 0;
    if (score < rerollCost) {
        spawnFloatingText('คะแนนไม่พอ Reroll!', window.player.x, window.player.y - 60, '#ef4444', 18);
        return;
    }
    addScore(-rerollCost);
    rollShopItems();
    ShopManager.renderItems();
    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
}

function buyItem(slotIndex) {
    const offer = window.currentShopOffers[slotIndex];
    if (!offer || offer.soldOut) return;
    if (!window.player) return;

    const item = offer.item;
    const currentScore = typeof getScore === 'function' ? getScore() : 0;
    if (currentScore < item.cost) {
        spawnFloatingText(GAME_TEXTS.shop.notEnoughScore, window.player.x, window.player.y - 60, '#ef4444', 18);
        if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
        return;
    }

    addScore(-item.cost);
    offer.soldOut = true;

    const p = window.player;

    if (item.id === 'potion') {
        const lacking = p.maxHp - p.hp;
        const healAmt = Math.min(item.heal, lacking);
        if (healAmt > 0) {
            p.hp += healAmt;
            spawnFloatingText(GAME_TEXTS.shop.healPickup(healAmt), p.x, p.y - 70, '#22c55e', 22);
            spawnParticles(p.x, p.y, 10, '#22c55e');
            if (typeof Audio !== 'undefined' && Audio.playHeal) Audio.playHeal();
        } else {
            spawnFloatingText(GAME_TEXTS.shop.hpFull, p.x, p.y - 60, '#94a3b8', 16);
        }

    } else if (item.id === 'shield') {
        if (p.hasShield) {
            addScore(item.cost); // refund
            offer.soldOut = false;
            spawnFloatingText('มีโล่อยู่แล้ว!', p.x, p.y - 60, '#94a3b8', 16);
            ShopManager.renderItems();
            return;
        }
        p.hasShield = true;
        spawnFloatingText('🛡️ SHIELD ACTIVE!', p.x, p.y - 70, '#8b5cf6', 22);
        spawnParticles(p.x, p.y, 15, '#8b5cf6');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (item.id === 'maxHp') {
        p.maxHp += item.hpBonus;
        p.hp += item.hpBonus;
        spawnFloatingText(`❤️ Max HP +${item.hpBonus}!`, p.x, p.y - 70, '#f87171', 22);
        spawnParticles(p.x, p.y, 10, '#f87171');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (item.id === 'dmgUp') {
        p._baseDamageBoost = p._baseDamageBoost || p.damageBoost || 1.0;
        p.damageBoost = (p.damageBoost || 1.0) * (1 + item.dmgPct);
        spawnFloatingText(`⚔️ DMG +${Math.round(item.dmgPct * 100)}%!`, p.x, p.y - 70, '#f59e0b', 22);
        spawnParticles(p.x, p.y, 8, '#f59e0b');
        if (p.damageBoost >= (p._baseDamageBoost * 1.5)) Achievements.check('shop_max');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (item.id === 'speedUp') {
        p._baseMoveSpeed = p._baseMoveSpeed || p.moveSpeed;
        p.moveSpeed *= (1 + item.speedPct);
        spawnFloatingText(`💨 Speed +${Math.round(item.speedPct * 100)}%!`, p.x, p.y - 70, '#06b6d4', 22);
        spawnParticles(p.x, p.y, 8, '#06b6d4');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();

    } else if (item.id === 'cdr') {
        // Compound each purchase: floor at 10% of base (never zero)
        p.skillCooldownMult = Math.max(0.1, (p.skillCooldownMult || 1.0) * (1 - item.cdrPct));
        spawnFloatingText(`🔮 CDR -${Math.round(item.cdrPct * 100)}%!`, p.x, p.y - 70, '#a78bfa', 22);
        spawnParticles(p.x, p.y, 8, '#a78bfa');
        if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
    }

    Achievements.stats.shopPurchases = (Achievements.stats.shopPurchases || 0) + 1;
    Achievements.check('shopaholic');

    ShopManager.renderItems();
}

// Initial roll so offers are ready before first shop open
rollShopItems();

window.drawShopObject = drawShopObject;
window.updateShopProximityUI = updateShopProximityUI;
window.openShop = openShop;
window.closeShop = closeShop;
window.buyItem = buyItem;
window.rollShopItems = rollShopItems;
window.rerollShop = rerollShop;