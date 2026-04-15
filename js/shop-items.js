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

// 🛒 SHOP ITEMS
const SHOP_ITEMS = [
    {
        id: "potion",
        name: "Energy Drink",
        icon: "🧃",
        cost: 300,
        type: "instant",
        heal: 60,
        desc: "ฟื้นฟูเลือด 60 หน่วย",
        color: "#22c55e",
        notifyOnBuy: { icon: "🧃", text: "HP +{value}", color: "#22c55e" },
    },
    {
        id: "shield",
        name: "Energy Shield",
        icon: "💠",
        cost: 600,
        type: "instant",
        desc: "โล่พลังงานลดดาเมจที่ได้รับครึ่งหนึ่งเป็นเวลา 6 วินาที",
        color: "#3b82f6",
        duration: 6,
        damageReduction: 0.5,
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
        cost: 500,
        type: "permanent",
        hpBonus: 15,
        desc: "เพิ่มเลือดสูงสุด 15 หน่วย",
        color: "#f87171",
        notifyOnBuy: { icon: "❤️", text: "Max HP +{value}", color: "#f87171" },
    },
    {
        id: "dmgUp",
        name: "Weapon Tuner",
        icon: "🔧",
        cost: 800,
        type: "permanent",
        dmgPct: 0.05,
        desc: "เพิ่มดาเมจ 5%",
        color: "#f59e0b",
        notifyOnBuy: { icon: "⚔️", text: "DMG +{value}%", color: "#f59e0b" },
    },
    {
        id: "speedUp",
        name: "Lightweight Boots",
        icon: "👟",
        cost: 500,
        type: "permanent",
        speedPct: 0.05,
        desc: "เพิ่มความเร็ว 5%",
        color: "#06b6d4",
        notifyOnBuy: { icon: "💨", text: "Speed +{value}%", color: "#06b6d4" },
    },
    {
        id: "cdr",
        name: "Focus Crystal",
        icon: "🔮",
        cost: 700,
        type: "permanent",
        cdrPct: 0.05,
        desc: "ลดคูลดาวน์สกิล 5%",
        color: "#a78bfa",
        notifyOnBuy: { icon: "🔮", text: "CDR -{value}%", color: "#a78bfa" },
    },
    // ── Defensive ──────────────────────────────────────────────
    {
        id: "reflectArmor",
        name: "Reflect Armor",
        icon: "🔮",
        cost: 900,
        type: "permanent",
        reflectPct: 0.15,
        desc: "สะท้อน 15% ดาเมจกลับหาศัตรู",
        color: "#818cf8",
        notifyOnBuy: {
            icon: "🔮",
            text: "REFLECT +{value}%",
            color: "#818cf8",
        },
        notifyOnReflect: {
            icon: "🔮",
            text: "{value}",
            color: "#818cf8",
            duration: 1.2,
        },
    },
    {
        id: "shieldBubble",
        name: "Shield Bubble",
        icon: "🛡️",
        cost: 500,
        type: "instant",
        bubbleHits: 3,
        desc: "บล็อกการโจมตี 3 ครั้ง",
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
        cost: 400,
        type: "instant",
        speedMult: 1.3,
        duration: 8,
        desc: "เพิ่มความเร็ว +30% เป็นเวลา 8 วินาที",
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
        cost: 600,
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
        cost: 750,
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
        cost: 650,
        type: "permanent",
        charReq: "poom",
        desc: "[POOM] ลด CD ของ Naga/Garuda/Ritual 15%",
        color: "#4ade80",
        notifyOnBuy: {
            icon: "🍚",
            text: "SACRED RICE! CD -15%",
            color: "#4ade80",
        },
    },
    {
        id: "autoCore",
        name: "วันชัยระเบิด",
        icon: "🔥",
        cost: 850,
        type: "permanent",
        charReq: "auto",
        desc: "[AUTO] ถึง HOT tier ง่ายขึ้น 15%",
        color: "#fb923c",
        notifyOnBuy: {
            icon: "🔥",
            text: "HEAT CORE! HOT ↓{value}",
            color: "#fb923c",
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
