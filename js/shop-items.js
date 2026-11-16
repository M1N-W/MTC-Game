'use strict';
/**
 * js/shop-items.js
 * Extracted shop catalog constants from the former config bundle.
 *
 * 🔔 NOTIFICATION SYSTEM — each item can define:
 *   - notifyOnHit: { icon, text, color, duration } — shown when item absorbs/reduces damage
 *   - notifyOnExpire: { icon, text, color } — shown when duration expires
 *   - notifyOnBuy: { icon, text, color } — shown on purchase
 */

// 🛒 SHOP ITEMS (Currency: MTC Credits 🪙 — rebalanced costs, costScale & maxPurchases caps)
const SHOP_ITEMS = [
    {
        id: "potion",
        name: "Energy Drink",
        icon: "🧃",
        cost: 200,
        costScale: 1.35,
        maxPurchases: 6,
        type: "instant",
        heal: 45,
        desc: "ฟื้นฟูเลือด 45 หน่วย",
        color: "#22c55e",
        notifyOnBuy: { icon: "🧃", text: "HP +{value}", color: "#22c55e" },
    },
    {
        id: "shield",
        name: "Energy Shield",
        icon: "💠",
        cost: 380,
        costScale: 1.45,
        maxPurchases: 4,
        type: "instant",
        desc: "โล่พลังงานลดดาเมจที่ได้รับ 40% เป็นเวลา 4 วินาที",
        color: "#3b82f6",
        duration: 4,
        damageReduction: 0.4,
        notifyOnBuy: { icon: "💠", text: "ENERGY SHIELD!", color: "#3b82f6" },
        notifyOnHit: {
            icon: "🔵",
            text: "-{value}%",
            color: "#3b82f6",
            duration: 1.5,
        },
        notifyOnExpire: { icon: "🔵", text: "SHIELD FADED", color: "#6b7280" },
    },
    {
        id: "maxHp",
        name: "Vital Supplement",
        icon: "❤️",
        cost: 420,
        costScale: 1.55,
        maxPurchases: 4,
        type: "permanent",
        hpBonus: 12,
        desc: "เพิ่มเลือดสูงสุด 12 หน่วย",
        color: "#f87171",
        notifyOnBuy: { icon: "❤️", text: "Max HP +{value}", color: "#f87171" },
    },
    {
        id: "dmgUp",
        name: "Weapon Tuner",
        icon: "🔧",
        cost: 520,
        costScale: 1.60,
        maxPurchases: 4,
        type: "permanent",
        dmgPct: 0.04,
        desc: "เพิ่มดาเมจ 4%",
        color: "#f59e0b",
        notifyOnBuy: { icon: "⚔️", text: "DMG +{value}%", color: "#f59e0b" },
    },
    {
        id: "speedUp",
        name: "Lightweight Boots",
        icon: "👟",
        cost: 360,
        costScale: 1.50,
        maxPurchases: 3,
        type: "permanent",
        speedPct: 0.04,
        desc: "เพิ่มความเร็ว 4%",
        color: "#06b6d4",
        notifyOnBuy: { icon: "💨", text: "Speed +{value}%", color: "#06b6d4" },
    },
    {
        id: "cdr",
        name: "Focus Crystal",
        icon: "🔮",
        cost: 520,
        costScale: 1.65,
        maxPurchases: 3,
        type: "permanent",
        cdrPct: 0.04,
        desc: "ลดคูลดาวน์สกิล 4%",
        color: "#a78bfa",
        notifyOnBuy: { icon: "🔮", text: "CDR -{value}%", color: "#a78bfa" },
    },
    // ── Defensive ──────────────────────────────────────────────
    {
        id: "reflectArmor",
        name: "Reflect Armor",
        icon: "🪞",
        cost: 560,
        costScale: 1.60,
        maxPurchases: 3,
        type: "permanent",
        reflectPct: 0.08,
        desc: "สะท้อนดาเมจ 8% กลับหาศัตรู (สูงสุด 30%)",
        color: "#818cf8",
        notifyOnBuy: {
            icon: "🪞",
            text: "REFLECT +{value}%",
            color: "#818cf8",
        },
        notifyOnReflect: {
            icon: "🪞",
            text: "{value}",
            color: "#818cf8",
            duration: 1.2,
        },
    },
    {
        id: "shieldBubble",
        name: "Shield Bubble",
        icon: "🛡️",
        cost: 460,
        costScale: 1.55,
        maxPurchases: 3,
        type: "instant",
        bubbleHits: 2,
        desc: "บล็อกการโจมตี 2 ครั้ง (สะสมสูงสุด 4)",
        color: "#7dd3fc",
        notifyOnBuy: { icon: "💠", text: "BUBBLE ×{value}!", color: "#7dd3fc" },
        notifyOnHit: {
            icon: "💠",
            text: "BUBBLE! ({remaining} left)",
            color: "#7dd3fc",
            duration: 1.5,
        },
    },
    // ── Utility ────────────────────────────────────────────────
    {
        id: "speedWave",
        name: "Adrenaline Wave",
        icon: "⚡",
        cost: 300,
        costScale: 1.40,
        maxPurchases: 4,
        type: "instant",
        speedMult: 1.2,
        duration: 6,
        desc: "เพิ่มความเร็ว +20% เป็นเวลา 6 วินาที",
        color: "#fbbf24",
        notifyOnBuy: {
            icon: "⚡",
            text: "SPEED WAVE {value}s!",
            color: "#fbbf24",
        },
    },
    {
        id: "cdrRound",
        name: "Cooldown Round",
        icon: "🔄",
        cost: 480,
        costScale: 1.50,
        maxPurchases: 3,
        type: "instant",
        desc: "รีเซ็ตคูลดาวน์สกิลทั้งหมดทันที",
        color: "#34d399",
        notifyOnBuy: {
            icon: "🔄",
            text: "ALL COOLDOWNS RESET!",
            color: "#34d399",
        },
    },
    // ── Character-specific ─────────────────────────────────────
    {
        id: "kaoAmmo",
        name: "ผีซุ่ม",
        icon: "👻",
        cost: 640,
        costScale: 1.70,
        maxPurchases: 1,
        type: "permanent",
        charReq: "kao",
        desc: "[KAO] Teleport charges +1 (สูงสุด 4)",
        color: "#facc15",
        notifyOnBuy: {
            icon: "👻",
            text: "GHOST ROUNDS! ×{value}",
            color: "#facc15",
        },
    },
    {
        id: "poomRice",
        name: "เทพเจ้าอีสาน",
        icon: "🍚",
        cost: 580,
        costScale: 1.70,
        maxPurchases: 1,
        type: "permanent",
        charReq: "poom",
        cdrPct: 0.08,
        desc: "[POOM] ลด CD ของ Naga/Garuda/Ritual 8%",
        color: "#4ade80",
        notifyOnBuy: {
            icon: "🍚",
            text: "SACRED RICE! CD -8%",
            color: "#4ade80",
        },
    },
    {
        id: "autoCore",
        name: "วันชัยระเบิด",
        icon: "🔥",
        cost: 680,
        costScale: 1.75,
        maxPurchases: 1,
        type: "permanent",
        charReq: "auto",
        hotMult: 0.90,
        desc: "[AUTO] ถึง HOT tier ง่ายขึ้น 10%",
        color: "#fb923c",
        notifyOnBuy: {
            icon: "🔥",
            text: "HEAT CORE! HOT ↓{value}",
            color: "#fb923c",
        },
    },
    {
        id: "patEdge",
        name: "คมดาบโรนิน",
        icon: "⚔️",
        cost: 640,
        costScale: 1.75,
        maxPurchases: 1,
        type: "permanent",
        charReq: "pat",
        parryMult: 1.08,
        atkSpdMult: 1.06,
        desc: "[PAT] Parry Ability +8% และฟันเร็วขึ้น 6%",
        color: "#7ec8e3",
        notifyOnBuy: {
            icon: "⚔️",
            text: "RONIN EDGE! PARRY +{value}%",
            color: "#7ec8e3",
        },
    },
];

/**
 * Get notification config for an item
 * @param {string} itemId - Item ID
 * @param {string} type - Notification type: 'buy' | 'hit' | 'expire' | 'reflect'
 * @returns {Object|null} Notification config or null
 */
function getItemNotification(itemId, type) {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return null;

    const keyMap = {
        'buy': 'notifyOnBuy',
        'hit': 'notifyOnHit',
        'expire': 'notifyOnExpire',
        'reflect': 'notifyOnReflect'
    };

    return item[keyMap[type]] || null;
}
window.getItemNotification = getItemNotification;
window.SHOP_ITEMS = SHOP_ITEMS;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SHOP_ITEMS };
}
