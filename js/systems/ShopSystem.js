'use strict';
/**
 * js/systems/ShopSystem.js
 * ════════════════════════════════════════════════
 * Shop rendering, proximity detection, open/close lifecycle, item rolling,
 * reroll, and per-item buy logic. Extracted from game.js.
 *
 * Design notes:
 *   - All config (position, radius, costs, slot count) lives in BALANCE.shop (config.js).
 *     MTC_SHOP_LOCATION is a live proxy — reads from BALANCE.shop at access time.
 *   - ShopManager (class in ui.js) owns the DOM panel; this file owns the game-side
 *     logic (state mutation, score deduction, player property writes).
 *   - rollShopItems() uses swap-and-pop (O(1)) to avoid GC churn in pool draw.
 *   - speedWave item writes shopSpeedBoostActive/shopSpeedBoostTimer — NOT the
 *     dead _speedWaveTimer/_speedWaveMult props (BUG 2 fix).
 *   - shield duplicate-purchase guard fires BEFORE score deduction (BUG 6 fix).
 *
 * 🔔 ITEM NOTIFICATION SYSTEM (linked to shop-items.js)
 *   - Uses getItemNotification() from shop-items.js for centralized notification config
 *   - showItemNotification() — displays floating text with icon from item data
 *
 * Integration:
 *   game.js      → drawShopObject()         (render pass, canvas)
 *   game.js      → updateShopProximityUI()  (every frame, DOM)
 *   input.js     → openShop() / closeShop() (B key)
 *   ui.js        → ShopManager.renderItems() called after every buy/reroll
 *   config.js    → BALANCE.shop             sole source of truth for all values
 *
 * ── TABLE OF CONTENTS ────────────────────────
 *  L.10   MTC_SHOP_LOCATION         live proxy → BALANCE.shop.{x,y,interactionRadius}
 *  L.21   drawShopObject()          proximity aura ring + [B] label on canvas
 *  L.57   updateShopProximityUI()   show/hide #shop-prompt, #shop-hud-icon, #btn-shop
 *  L.72   openShop()                PLAYING→PAUSED + ShopManager.open()
 *  L.85   closeShop()               PAUSED→PLAYING + key state flush
 *  L.104  window.currentShopOffers  live offer array [{item, soldOut}]
 *  L.107  rollShopItems()           filters pool by charReq, fills slotCount offers
 *  L.123  rerollShop()              deducts rerollCost, re-rolls, re-renders
 *  L.137  buyItem(slotIndex)        full purchase handler for all item IDs
 *  L.380  showItemNotification()    unified notification display (linked to item config)
 *
 * ⚠️  drawShopObject() reads worldToScreen() — must be called in render pass, not update.
 * ⚠️  charReq filtering in rollShopItems() uses constructor name lowercased minus 'player'.
 *     If a new character's class name deviates from this pattern, items won't show.
 * ⚠️  speedWave stacks duration additively but resets base speed on first activation only
 *     (_baseMoveSpeed guard). Buying twice extends timer, does NOT re-multiply speed.
 * ⚠️  cdr item compounds (×= factor) and floors at 0.1 — buying 10+ times approaches
 *     but never reaches zero. Intentional.
 * ════════════════════════════════════════════════
 */

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

function getShopItemPurchases(itemId) {
    return window.player?._shopPurchaseCounts?.[itemId] ?? 0;
}

function getShopItemCost(item) {
    if (!item) return 0;
    const bought = getShopItemPurchases(item.id);
    const scale = item.costScale ?? 1.45;
    return Math.round(item.cost * Math.pow(scale, bought));
}

function getCurrentRerollCost() {
    const base = BALANCE.shop?.rerollCost ?? 120;
    const inc = BALANCE.shop?.rerollCostIncrement ?? 80;
    const count = window.shopRerollCountThisWave || 0;
    return base + count * inc;
}

// ⚠️  slotCount และ rerollCost อ่านจาก BALANCE.shop ใน balance.js
function rollShopItems() {
    // Filter char-specific items + exclude items that already reached maxPurchases
    const charType = (typeof _selectedChar !== 'undefined') ? _selectedChar
        : (window.player?.constructor?.name?.toLowerCase().replace('player', '') ?? null);
    const pool = SHOP_ITEMS.filter(it => {
        if (it.charReq && it.charReq !== charType) return false;
        if (it.maxPurchases && getShopItemPurchases(it.id) >= it.maxPurchases) return false;
        return true;
    });
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
    const rerollCost = getCurrentRerollCost();
    const currentCredits = typeof getCredits === 'function' ? getCredits() : 0;
    if (currentCredits < rerollCost) {
        spawnFloatingText('เครดิตไม่พอ Reroll! 🪙', window.player.x, window.player.y - 60, '#ef4444', 18);
        return;
    }
    addCredits(-rerollCost);
    window.shopRerollCountThisWave = (window.shopRerollCountThisWave || 0) + 1;
    rollShopItems();
    ShopManager.renderItems();
    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
}

function buyItem(slotIndex) {
    const offer = window.currentShopOffers[slotIndex];
    if (!offer || offer.soldOut) return;
    if (!window.player) return;

    const p = window.player;
    const item = offer.item;

    // Enforce stack cap before charging Credits
    const boughtCount = getShopItemPurchases(item.id);
    if (item.maxPurchases && boughtCount >= item.maxPurchases) {
        spawnFloatingText('ซื้อครบจำนวนสูงสุดแล้ว!', p.x, p.y - 60, '#94a3b8', 16);
        offer.soldOut = true;
        ShopManager.renderItems();
        return;
    }

    const itemCost = getShopItemCost(item);
    const currentCredits = typeof getCredits === 'function' ? getCredits() : 0;
    if (currentCredits < itemCost) {
        spawnFloatingText(GAME_TEXTS.shop.notEnoughScore, p.x, p.y - 60, '#ef4444', 18);
        if (typeof Audio !== 'undefined' && Audio.playHit) Audio.playHit();
        return;
    }

    // Guards BEFORE deducting Credits or marking soldOut
    if (item.id === 'potion' && p.hp >= p.maxHp) {
        spawnFloatingText(GAME_TEXTS.shop.hpFull, p.x, p.y - 60, '#94a3b8', 16);
        return;
    }
    if (item.id === 'shield' && (p.energyShieldTimer ?? 0) > 0) {
        spawnFloatingText('มีโล่พลังงานอยู่แล้ว!', p.x, p.y - 60, '#94a3b8', 16);
        return;
    }
    if (item.id === 'shieldBubble' && (p.shieldBubbleHits || 0) >= 4) {
        spawnFloatingText('เกราะฟองสบู่เต็มแล้ว!', p.x, p.y - 60, '#94a3b8', 16);
        return;
    }
    if (item.id === 'kaoAmmo' && !(typeof KaoPlayer !== 'undefined' && p instanceof KaoPlayer)) {
        spawnFloatingText('❌ KAO เท่านั้น!', p.x, p.y - 60, '#ef4444', 16);
        return;
    }
    if (item.id === 'poomRice' && !(typeof PoomPlayer !== 'undefined' && p instanceof PoomPlayer)) {
        spawnFloatingText('❌ POOM เท่านั้น!', p.x, p.y - 60, '#ef4444', 16);
        return;
    }
    if (item.id === 'autoCore' && !(typeof AutoPlayer !== 'undefined' && p instanceof AutoPlayer)) {
        spawnFloatingText('❌ AUTO เท่านั้น!', p.x, p.y - 60, '#ef4444', 16);
        return;
    }
    if (item.id === 'patEdge' && !(typeof PatPlayer !== 'undefined' && p instanceof PatPlayer)) {
        spawnFloatingText('❌ PAT เท่านั้น!', p.x, p.y - 60, '#ef4444', 16);
        return;
    }

    addCredits(-itemCost);
    offer.soldOut = true;
    p._shopPurchaseCounts = p._shopPurchaseCounts || {};
    p._shopPurchaseCounts[item.id] = boughtCount + 1;
    if (item.type === 'permanent') {
        p._shopBuffStacks = (p._shopBuffStacks || 0) + 1;
        if (typeof Achievements !== 'undefined') Achievements.check('shop_max');
    }

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
        p.energyShieldTimer = item.duration || 4;
        p.energyShieldDamageReduction = item.damageReduction || 0.40;
        showItemNotificationWithParticles('shield', { x: p.x, y: p.y }, 20);

    } else if (item.id === 'maxHp') {
        p.maxHp += item.hpBonus;
        p.hp += item.hpBonus;
        showItemNotificationWithParticles('maxHp', { x: p.x, y: p.y, value: item.hpBonus }, 10);

    } else if (item.id === 'dmgUp') {
        p._baseDamageBoost = p._baseDamageBoost || p.damageBoost || 1.0;
        p.damageBoost = (p.damageBoost || 1.0) * (1 + item.dmgPct);
        showItemNotificationWithParticles('dmgUp', { x: p.x, y: p.y, value: Math.round(item.dmgPct * 100) }, 8);
        if (p.damageBoost >= (p._baseDamageBoost * 1.5)) Achievements.check('shop_max');

    } else if (item.id === 'speedUp') {
        p._baseMoveSpeed = p._baseMoveSpeed || (p.stats?.moveSpeed ?? p.moveSpeed);
        if (p.stats) p.stats.moveSpeed *= (1 + item.speedPct);
        else p.moveSpeed *= (1 + item.speedPct);
        showItemNotificationWithParticles('speedUp', { x: p.x, y: p.y, value: Math.round(item.speedPct * 100) }, 8);

    } else if (item.id === 'cdr') {
        // Compound each purchase: capped floor at 75% (max -25% CDR)
        p.skillCooldownMult = Math.max(0.75, (p.skillCooldownMult || 1.0) * (1 - item.cdrPct));
        showItemNotificationWithParticles('cdr', { x: p.x, y: p.y, value: Math.round(item.cdrPct * 100) }, 8);

        // ── Defensive ──────────────────────────────────────────────
    } else if (item.id === 'reflectArmor') {
        p.damageReflectPct = Math.min(0.30, (p.damageReflectPct || 0) + item.reflectPct);
        showItemNotificationWithParticles('reflectArmor', { x: p.x, y: p.y, value: Math.round(item.reflectPct * 100) }, 12);

    } else if (item.id === 'shieldBubble') {
        p.shieldBubbleHits = Math.min(4, (p.shieldBubbleHits || 0) + item.bubbleHits);
        showItemNotificationWithParticles('shieldBubble', { x: p.x, y: p.y, value: p.shieldBubbleHits }, 15);

        // ── Utility ────────────────────────────────────────────────
    } else if (item.id === 'speedWave') {
        p.shopSpeedBoostActive = true;
        p.shopSpeedBoostTimer = (p.shopSpeedBoostTimer > 0 ? p.shopSpeedBoostTimer : 0) + item.duration;
        if (p._baseMoveSpeed === undefined) p._baseMoveSpeed = p.stats?.moveSpeed ?? p.moveSpeed;
        const mult = item.speedMult ?? 1.2;
        if (p.stats) p.stats.moveSpeed = p._baseMoveSpeed * mult;
        else p.moveSpeed = p._baseMoveSpeed * mult;
        showItemNotificationWithParticles('speedWave', { x: p.x, y: p.y, value: item.duration }, 12);

    } else if (item.id === 'cdrRound') {
        if (p.cooldowns) {
            for (const key of Object.keys(p.cooldowns)) p.cooldowns[key] = 0;
        }
        // Kao: refill teleport charges too
        if (typeof KaoPlayer !== 'undefined' && p instanceof KaoPlayer) {
            p.teleportCharges = p.maxTeleportCharges;
            p.teleportTimers = [];
            p.cloneSkillCooldown = 0;
        }
        showItemNotificationWithParticles('cdrRound', { x: p.x, y: p.y }, 20);
        addScreenShake(6);

        // ── Character-specific ─────────────────────────────────────
    } else if (item.id === 'kaoAmmo') {
        p.maxTeleportCharges = Math.min(4, (p.maxTeleportCharges || 3) + 1);
        p.teleportCharges = Math.min(p.maxTeleportCharges, (p.teleportCharges || 0) + 1);
        showItemNotificationWithParticles('kaoAmmo', { x: p.x, y: p.y, value: p.maxTeleportCharges }, 12);

    } else if (item.id === 'poomRice') {
        const cdrPct = item.cdrPct ?? 0.08;
        p.skillCooldownMult = Math.max(0.75, (p.skillCooldownMult || 1.0) * (1 - cdrPct));
        showItemNotificationWithParticles('poomRice', { x: p.x, y: p.y }, 12);

    } else if (item.id === 'autoCore') {
        const current = p.stats?.heatTierHot ?? (p._heatTierHotOverride ?? BALANCE.characters?.auto?.heatTierHot ?? 67);
        const hotMult = item.hotMult ?? 0.90;
        p._heatTierHotOverride = Math.max(25, Math.round(current * hotMult));
        if (p.stats) p.stats.heatTierHot = p._heatTierHotOverride;
        showItemNotificationWithParticles('autoCore', { x: p.x, y: p.y, value: p._heatTierHotOverride }, 15);

    } else if (item.id === 'patEdge') {
        const baseWin = BALANCE.characters?.pat?.perfectParryWindow ?? 0.15;
        const curWin = p.stats?.perfectParryWindow ?? baseWin;
        const parryMult = item.parryMult ?? 1.08;
        const atkSpdMult = item.atkSpdMult ?? 1.06;
        if (p.stats) p.stats.perfectParryWindow = curWin * parryMult;
        p.attackSpeedMult = (p.attackSpeedMult || 1.0) * atkSpdMult;
        showItemNotificationWithParticles('patEdge', { x: p.x, y: p.y, value: Math.round((parryMult - 1) * 100) }, 12);
    }

    Achievements.stats.shopPurchases = (Achievements.stats.shopPurchases || 0) + 1;
    Achievements.check('shopaholic');

    ShopManager.renderItems();
}

// ══════════════════════════════════════════════════════════════
// 🔔 ITEM NOTIFICATION SYSTEM — Unified notification display
// Linked to shop-items.js config for consistent icons/messages
// ══════════════════════════════════════════════════════════════

/**
 * Show item notification using centralized config from shop-items.js
 * @param {string} itemId — item identifier (e.g., 'shield', 'reflectArmor')
 * @param {string} type — notification type: 'buy' | 'hit' | 'expire' | 'reflect'
 * @param {Object} params — values to interpolate: { value, remaining, x, y }
 * @param {number} [fontSize] — optional font size override
 */
function showItemNotification(itemId, type, params, fontSize = 20) {
    const cfg = typeof getItemNotification === 'function' ? getItemNotification(itemId, type) : null;
    if (!cfg) return;

    const { x, y, value, remaining } = params || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;

    // Build notification text with interpolation
    let text = cfg.text;
    if (value !== undefined) text = text.replace('{value}', value);
    if (remaining !== undefined) text = text.replace('{remaining}', remaining);

    // Show notification with item's configured icon and color
    const icon = cfg.icon || '✨';
    const color = cfg.color || '#ffffff';
    const duration = cfg.duration || null; // floating text duration (seconds)

    spawnFloatingText(`${icon} ${text}`, x, y, color, fontSize, duration);
}
window.showItemNotification = showItemNotification;

/**
 * Show item notification with particles (convenience for buy notifications)
 * @param {string} itemId — item identifier
 * @param {Object} params — { value, x, y }
 * @param {number} particleCount — number of particles
 */
function showItemNotificationWithParticles(itemId, params, particleCount = 12) {
    const cfg = typeof getItemNotification === 'function' ? getItemNotification(itemId, 'buy') : null;
    if (!cfg) return;

    const { x, y, value } = params || {};
    if (typeof x !== 'number' || typeof y !== 'number') return;

    // Show notification
    showItemNotification(itemId, 'buy', { x, y, value }, 22);

    // Spawn particles with item color
    spawnParticles(x, y, particleCount, cfg.color || '#ffffff');

    // Play power up sound
    if (typeof Audio !== 'undefined' && Audio.playPowerUp) Audio.playPowerUp();
}
window.showItemNotificationWithParticles = showItemNotificationWithParticles;

// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.drawShopObject = drawShopObject;
window.updateShopProximityUI = updateShopProximityUI;
window.openShop = openShop;
window.closeShop = closeShop;
window.buyItem = buyItem;
window.rollShopItems = rollShopItems;
window.rerollShop = rerollShop;
window.getShopItemPurchases = getShopItemPurchases;
window.getShopItemCost = getShopItemCost;
window.getCurrentRerollCost = getCurrentRerollCost;
