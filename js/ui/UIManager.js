"use strict";

/**
 * js/ui/UIManager.js
 * ════════════════════════════════════════════════
 * Main UI manager. Handles skill icons, boss HP bars, voice bubbles,
 * boss speech, and high-score displays.
 * ════════════════════════════════════════════════
 */

// ── Portrait SVG definitions (inner-content, no outer <svg> tag) ────────────
window.PORTRAITS = {
  kao: `<defs>
        <clipPath id="cpk"><rect width="96" height="112" rx="4" /></clipPath>
<linearGradient id="kBg" x1="0" y1="0" x2="0.2" y2="1">
<stop offset="0%" stop-color="#08112e"/>
<stop offset="60%" stop-color="#040c1e"/>
<stop offset="100%" stop-color="#020610"/>
</linearGradient>
<radialGradient id="kFace" cx="50%" cy="44%" r="50%">
<stop offset="0%" stop-color="#f0c88a"/>
<stop offset="70%" stop-color="#d4924e"/>
<stop offset="100%" stop-color="#b87030"/>
</radialGradient>
<radialGradient id="kIris" cx="30%" cy="28%" r="65%">
<stop offset="0%" stop-color="#60aaff"/>
<stop offset="50%" stop-color="#1a5fdd"/>
<stop offset="100%" stop-color="#071a70"/>
</radialGradient>
<radialGradient id="kAura" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="rgba(59,130,246,0.18)"/>
<stop offset="100%" stop-color="rgba(59,130,246,0)"/>
</radialGradient>
<filter id="kGlw" x="-40%" y="-40%" width="180%" height="180%">
<feGaussianBlur stdDeviation="3" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="kSft" x="-20%" y="-20%" width="140%" height="140%">
<feGaussianBlur stdDeviation="1.5" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="kSkin" x="-10%" y="-10%" width="120%" height="120%">
<feGaussianBlur stdDeviation="0.6" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
    <g clip-path="url(#cpk)">
        <rect width="96" height="112" fill="url(#kBg)" />
        <ellipse cx="48" cy="70" rx="44" ry="50" fill="url(#kAura)" />
        <line x1="0" y1="56" x2="96" y2="56" stroke="rgba(59,130,246,0.05)" stroke-width="24" />
        <line x1="48" y1="0" x2="48" y2="112" stroke="rgba(59,130,246,0.04)" stroke-width="16" />
        <path d="M-8 112 L16 70 Q48 84 80 70 L104 112Z" fill="#0b1a3a" />
        <path d="M16 70 Q48 84 80 70 L78 80 Q48 94 18 80Z" fill="#102244" />
        <path d="M16 72 Q10 68 8 74 Q10 80 16 80" fill="#1a3060" stroke="rgba(250,204,21,0.4)" stroke-width="0.8" />
        <path d="M80 72 Q86 68 88 74 Q86 80 80 80" fill="#1a3060" stroke="rgba(250,204,21,0.4)" stroke-width="0.8" />
        <line x1="10" y1="72" x2="15" y2="72" stroke="#facc15" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
        <line x1="9" y1="75" x2="15" y2="75" stroke="#facc15" stroke-width="1.5" stroke-linecap="round" opacity="0.6" />
        <path d="M37 70 L48 86 L59 70" fill="none" stroke="#facc15" stroke-width="2" stroke-linejoin="round" />
        <path d="M40 70 L48 82 L56 70" fill="rgba(0,0,20,0.4)" />
        <rect x="40" y="90" width="16" height="9" rx="1.5" fill="rgba(250,204,21,0.1)" stroke="rgba(250,204,21,0.55)" stroke-width="0.8" />
        <text x="48" y="96.5" text-anchor="middle" fill="#facc15" font-size="5.5" font-family="monospace" font-weight="bold" letter-spacing="0.8">MTC</text>
        <path d="M39 66 Q48 73 57 66 L56 73 Q48 79 40 73Z" fill="#d49050" filter="url(#kSkin)" />
        <path d="M41 66 Q48 70 55 66 L55 69 Q48 73 41 69Z" fill="rgba(0,0,0,0.2)" />
        <ellipse cx="27" cy="51" rx="4.5" ry="5.5" fill="#d49050" />
        <path d="M28.5 48 Q26 51 28.5 54" fill="none" stroke="#b07030" stroke-width="1.2" />
        <ellipse cx="69" cy="51" rx="4.5" ry="5.5" fill="#d49050" />
        <path d="M27 53 Q26 36 48 28 Q70 36 69 53 Q69 65 59 70 Q48 74 37 70 Q27 65 27 53Z" fill="url(#kFace)" filter="url(#kSkin)" />
        <ellipse cx="36" cy="58" rx="5" ry="3" fill="rgba(220,120,80,0.18)" />
        <ellipse cx="60" cy="58" rx="5" ry="3" fill="rgba(220,120,80,0.18)" />
        <path d="M44 70 Q48 73 52 70" fill="rgba(255,200,140,0.25)" />
        <path d="M26 50 Q24 30 48 22 Q72 30 70 50" fill="#080e28" />
        <path d="M26 48 Q20 38 18 26 Q24 30 28 40Z" fill="#0c1535" />
        <path d="M70 48 Q76 38 78 26 Q72 30 68 40Z" fill="#0c1535" />
        <path d="M38 26 Q36 16 40 11 Q42 18 43 24Z" fill="#0c1535" />
        <path d="M44 24 Q44 13 48 9 Q50 16 50 23Z" fill="#080e28" />
        <path d="M50 24 Q53 14 57 12 Q56 19 54 25Z" fill="#0c1535" />
        <path d="M34 28 Q38 24 44 26" fill="none" stroke="rgba(100,140,255,0.35)" stroke-width="1.5" stroke-linecap="round" />
        <path d="M52 24 Q56 22 60 25" fill="none" stroke="rgba(100,140,255,0.35)" stroke-width="1.5" stroke-linecap="round" />
        <rect x="29" y="30" width="38" height="4.5" rx="1" fill="#04071a" />
        <rect x="35" y="24" width="26" height="7" rx="1.5" fill="#04071a" />
        <line x1="35" y1="26" x2="53" y2="26" stroke="rgba(255,255,255,0.1)" stroke-width="0.8" />
        <path d="M61 27 Q70 33 68 44" fill="none" stroke="#facc15" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="68" cy="45" r="3.2" fill="#facc15" filter="url(#kGlw)" />
        <circle cx="68" cy="45" r="1.5" fill="#fff8b0" />
        <ellipse cx="37" cy="50" rx="6.5" ry="5.5" fill="white" />
        <ellipse cx="37" cy="51.5" rx="6" ry="4" fill="rgba(200,220,255,0.3)" />
        <circle cx="37" cy="50" r="4.5" fill="url(#kIris)" />
        <circle cx="37" cy="50" r="2.4" fill="#040a1e" />
        <circle cx="34.5" cy="47.5" r="2" fill="white" opacity="0.95" />
        <circle cx="39.5" cy="52" r="0.9" fill="white" opacity="0.55" />
        <path d="M30.5 47 Q37 44 43.5 47" fill="none" stroke="#0a0820" stroke-width="2" stroke-linecap="round" />
        <path d="M31 53 Q37 55 43 53" fill="none" stroke="rgba(20,10,40,0.4)" stroke-width="0.8" stroke-linecap="round" />
        <ellipse cx="59" cy="50" rx="6.5" ry="5.5" fill="white" />
        <ellipse cx="59" cy="51.5" rx="6" ry="4" fill="rgba(200,220,255,0.3)" />
        <circle cx="59" cy="50" r="4.5" fill="url(#kIris)" />
        <circle cx="59" cy="50" r="2.4" fill="#040a1e" />
        <circle cx="56.5" cy="47.5" r="2" fill="white" opacity="0.95" />
        <circle cx="61.5" cy="52" r="0.9" fill="white" opacity="0.55" />
        <path d="M52.5 47 Q59 44 65.5 47" fill="none" stroke="#0a0820" stroke-width="2" stroke-linecap="round" />
        <path d="M53 53 Q59 55 65 53" fill="none" stroke="rgba(20,10,40,0.4)" stroke-width="0.8" stroke-linecap="round" />
        <circle cx="59" cy="50" r="9.5" fill="none" stroke="rgba(34,220,255,0.75)" stroke-width="1.4" filter="url(#kSft)" />
        <circle cx="59" cy="50" r="9.5" fill="none" stroke="rgba(34,220,255,0.35)" stroke-width="3" />
        <line x1="59" y1="39.5" x2="59" y2="42.5" stroke="#22ddff" stroke-width="1.1" opacity="0.8" />
        <line x1="59" y1="57.5" x2="59" y2="60.5" stroke="#22ddff" stroke-width="1.1" opacity="0.8" />
        <line x1="48.5" y1="50" x2="51.5" y2="50" stroke="#22ddff" stroke-width="1.1" opacity="0.8" />
        <line x1="66.5" y1="50" x2="69.5" y2="50" stroke="#22ddff" stroke-width="1.1" opacity="0.8" />
        <path d="M68.5 44 Q74 40 77 37" fill="none" stroke="#22ddff" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
        <path d="M30 45.5 Q37 42 44 44.5" fill="none" stroke="#0a0e28" stroke-width="2.8" stroke-linecap="round" />
        <path d="M52 44.5 Q59 42 66 45.5" fill="none" stroke="#0a0e28" stroke-width="2.8" stroke-linecap="round" />
        <path d="M43 44 Q48 43 53 44" fill="none" stroke="#0a0e28" stroke-width="1.2" stroke-linecap="round" />
        <path d="M46 56.5 L48 60 L50 56.5" fill="none" stroke="rgba(150,80,20,0.5)" stroke-width="1.2" stroke-linejoin="round" />
        <line x1="48" y1="51" x2="48" y2="57" stroke="rgba(100,50,10,0.15)" stroke-width="2.5" />
        <path d="M42 64.5 Q48 68.5 55 65" fill="none" stroke="#b06030" stroke-width="1.8" stroke-linecap="round" />
        <path d="M44 65 Q48 67 53 65.5" fill="rgba(255,180,120,0.22)" />
        <g opacity="0.22" filter="url(#kSft)">
            <circle cx="13" cy="13" r="9" fill="none" stroke="#facc15" stroke-width="1" />
            <circle cx="13" cy="13" r="2.5" fill="rgba(250,204,21,0.4)" />
            <line x1="13" y1="2" x2="13" y2="7" stroke="#facc15" stroke-width="1" />
            <line x1="13" y1="19" x2="13" y2="24" stroke="#facc15" stroke-width="1" />
            <line x1="2" y1="13" x2="7" y2="13" stroke="#facc15" stroke-width="1" />
            <line x1="19" y1="13" x2="24" y2="13" stroke="#facc15" stroke-width="1" />
        </g>
        <rect x="0" y="108" width="96" height="4" fill="rgba(59,130,246,0.2)" />
        <line x1="0" y1="108" x2="96" y2="108" stroke="rgba(59,130,246,0.6)" stroke-width="0.8" />
        <line x1="0" y1="108" x2="24" y2="108" stroke="rgba(250,204,21,0.7)" stroke-width="0.8" />
    </g>`,
  poom: `<defs>
    <clipPath id="cpp"><rect width="96" height="112" rx="4" /></clipPath>
<linearGradient id="pBg" x1="0.1" y1="0" x2="0.3" y2="1">
<stop offset="0%" stop-color="#040e08"/>
<stop offset="50%" stop-color="#030a06"/>
<stop offset="100%" stop-color="#010402"/>
</linearGradient>
<radialGradient id="pFace" cx="50%" cy="42%" r="50%">
<stop offset="0%" stop-color="#e0b078"/>
<stop offset="70%" stop-color="#c08040"/>
<stop offset="100%" stop-color="#8a5020"/>
</radialGradient>
<radialGradient id="pIris" cx="28%" cy="26%" r="65%">
<stop offset="0%" stop-color="#a0ffd8"/>
<stop offset="40%" stop-color="#10c878"/>
<stop offset="100%" stop-color="#044a28"/>
</radialGradient>
<radialGradient id="pAura" cx="30%" cy="60%" r="60%">
<stop offset="0%" stop-color="rgba(16,185,129,0.2)"/>
<stop offset="100%" stop-color="rgba(16,185,129,0)"/>
</radialGradient>
<linearGradient id="pRobe" x1="0" y1="0" x2="0.15" y2="1">
<stop offset="0%" stop-color="#1c4228"/>
<stop offset="100%" stop-color="#060e08"/>
</linearGradient>
<filter id="pNaga" x="-50%" y="-50%" width="200%" height="200%">
<feGaussianBlur stdDeviation="4" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="pSft" x="-20%" y="-20%" width="140%" height="140%">
<feGaussianBlur stdDeviation="1.5" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="pSkin" x="-10%" y="-10%" width="120%" height="120%">
<feGaussianBlur stdDeviation="0.7" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
    <g clip-path="url(#cpp)">
        <rect width="96" height="112" fill="url(#pBg)" />
        <ellipse cx="20" cy="65" rx="50" ry="55" fill="url(#pAura)" />
        <circle cx="14" cy="30" r="1" fill="rgba(16,185,129,0.35)" />
        <circle cx="8" cy="55" r="0.7" fill="rgba(16,185,129,0.25)" />
        <circle cx="82" cy="42" r="0.8" fill="rgba(245,158,11,0.3)" />
        <circle cx="88" cy="25" r="1.2" fill="rgba(245,158,11,0.2)" />
        <path d="M-8 112 L16 68 Q48 82 80 68 L104 112Z" fill="url(#pRobe)" />
        <path d="M16 68 Q48 82 80 68 L78 78 Q48 92 18 78Z" fill="#224830" />
        <path d="M30 78 Q48 88 66 78" fill="none" stroke="rgba(245,158,11,0.2)" stroke-width="1" />
        <line x1="48" y1="74" x2="48" y2="112" stroke="rgba(245,158,11,0.18)" stroke-width="1.5" />
        <path d="M36 68 L48 84 L60 68" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linejoin="round" />
        <circle cx="40" cy="74" r="1.8" fill="#f59e0b" opacity="0.9" />
        <circle cx="44" cy="80" r="1.5" fill="#f59e0b" opacity="0.8" />
        <circle cx="48" cy="84" r="2" fill="#f59e0b" opacity="0.9" filter="url(#pSft)" />
        <circle cx="52" cy="80" r="1.5" fill="#f59e0b" opacity="0.8" />
        <circle cx="56" cy="74" r="1.8" fill="#f59e0b" opacity="0.9" />
        <path d="M22 82 Q30 86 38 82" fill="none" stroke="rgba(245,158,11,0.12)" stroke-width="0.8" />
        <path d="M58 82 Q66 86 74 82" fill="none" stroke="rgba(245,158,11,0.12)" stroke-width="0.8" />
        <path d="M39 64 Q48 71 57 64 L56 72 Q48 78 40 72Z" fill="#b07040" filter="url(#pSkin)" />
        <ellipse cx="27" cy="52" rx="4.5" ry="5.5" fill="#c08040" />
        <circle cx="27" cy="49" r="2.5" fill="#f59e0b" filter="url(#pSft)" opacity="0.9" />
        <circle cx="27" cy="49" r="1.2" fill="#fff8e0" />
        <ellipse cx="69" cy="52" rx="4.5" ry="5.5" fill="#c08040" />
        <circle cx="69" cy="49" r="2.5" fill="#f59e0b" filter="url(#pSft)" opacity="0.9" />
        <circle cx="69" cy="49" r="1.2" fill="#fff8e0" />
        <path d="M27 54 Q26 36 48 28 Q70 36 69 54 Q69 66 58 71 Q48 75 38 71 Q27 66 27 54Z" fill="url(#pFace)" filter="url(#pSkin)" />
        <ellipse cx="36" cy="59" rx="5.5" ry="3" fill="rgba(200,100,60,0.15)" />
        <ellipse cx="60" cy="59" rx="5.5" ry="3" fill="rgba(200,100,60,0.15)" />
        <path d="M27 52 Q22 35 28 20 Q38 12 48 13 Q58 12 68 20 Q74 35 69 52" fill="#1a0700" />
        <path d="M27 52 Q20 58 18 70 Q16 80 20 88" fill="none" stroke="#240c00" stroke-width="8" stroke-linecap="round" />
        <path d="M69 52 Q76 58 78 70 Q80 80 76 88" fill="none" stroke="#240c00" stroke-width="8" stroke-linecap="round" />
        <path d="M24 40 Q20 50 22 62" fill="none" stroke="rgba(100,40,0,0.5)" stroke-width="1.8" stroke-linecap="round" />
        <path d="M26 36 Q22 46 24 58" fill="none" stroke="rgba(70,25,0,0.35)" stroke-width="1.2" stroke-linecap="round" />
        <path d="M72 40 Q76 50 74 62" fill="none" stroke="rgba(100,40,0,0.5)" stroke-width="1.8" stroke-linecap="round" />
        <path d="M36 18 Q44 14 52 16" fill="none" stroke="rgba(200,100,30,0.45)" stroke-width="2" stroke-linecap="round" />
        <path d="M38 20 Q44 16 50 18" fill="none" stroke="rgba(255,180,80,0.3)" stroke-width="1.5" stroke-linecap="round" />
        <path d="M62 33 Q70 28 72 22" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" opacity="0.7" />
        <circle cx="62" cy="33" r="3" fill="#f59e0b" opacity="0.8" filter="url(#pSft)" />
        <circle cx="62" cy="33" r="1.5" fill="#fff8c0" />
        <ellipse cx="37" cy="50" rx="7" ry="5.5" fill="white" />
        <ellipse cx="37" cy="51" rx="6.5" ry="4.5" fill="rgba(200,255,220,0.2)" />
        <circle cx="37" cy="50" r="4.8" fill="url(#pIris)" />
        <ellipse cx="37" cy="50" rx="1.3" ry="4" fill="#021008" />
        <circle cx="34.5" cy="47.5" r="2.2" fill="white" opacity="0.95" />
        <circle cx="40" cy="52.5" r="1" fill="white" opacity="0.5" />
        <path d="M30 47 Q37 43.5 44 47" fill="none" stroke="#100800" stroke-width="2.2" stroke-linecap="round" />
        <line x1="30.5" y1="47.5" x2="28.5" y2="45" stroke="#100800" stroke-width="1.4" stroke-linecap="round" />
        <line x1="43.5" y1="47.5" x2="45.5" y2="45" stroke="#100800" stroke-width="1.4" stroke-linecap="round" />
        <path d="M31 54 Q37 56.5 43 54" fill="none" stroke="rgba(10,20,5,0.35)" stroke-width="0.8" />
        <ellipse cx="59" cy="50" rx="7" ry="5.5" fill="white" />
        <ellipse cx="59" cy="51" rx="6.5" ry="4.5" fill="rgba(200,255,220,0.2)" />
        <circle cx="59" cy="50" r="4.8" fill="url(#pIris)" />
        <ellipse cx="59" cy="50" rx="1.3" ry="4" fill="#021008" />
        <circle cx="56.5" cy="47.5" r="2.2" fill="white" opacity="0.95" />
        <circle cx="62" cy="52.5" r="1" fill="white" opacity="0.5" />
        <path d="M52 47 Q59 43.5 66 47" fill="none" stroke="#100800" stroke-width="2.2" stroke-linecap="round" />
        <line x1="52.5" y1="47.5" x2="50.5" y2="45" stroke="#100800" stroke-width="1.4" stroke-linecap="round" />
        <line x1="65.5" y1="47.5" x2="67.5" y2="45" stroke="#100800" stroke-width="1.4" stroke-linecap="round" />
        <path d="M53 54 Q59 56.5 65 54" fill="none" stroke="rgba(10,20,5,0.35)" stroke-width="0.8" />
        <path d="M30 44 Q37 40.5 44 43" fill="none" stroke="#200800" stroke-width="3" stroke-linecap="round" />
        <path d="M52 43 Q59 40.5 66 44" fill="none" stroke="#200800" stroke-width="3" stroke-linecap="round" />
        <path d="M46 57 L48 61 L50 57" fill="none" stroke="rgba(130,65,10,0.45)" stroke-width="1.2" stroke-linejoin="round" />
        <line x1="48" y1="51" x2="48" y2="57" stroke="rgba(100,50,5,0.12)" stroke-width="3" />
        <path d="M41 65.5 Q48 70.5 55 65.5" fill="none" stroke="#905030" stroke-width="1.8" stroke-linecap="round" />
        <path d="M42 65.5 Q45 64 48 65 Q51 64 54 65.5" fill="rgba(200,130,70,0.25)" />
        <path d="M43 65.5 Q48 67.5 53 65.5" fill="rgba(255,160,80,0.18)" />
        <path d="M4 110 Q-4 85 5 60 Q12 42 26 38" fill="none" stroke="#10b981" stroke-width="14" stroke-linecap="round" opacity="0.12" filter="url(#pNaga)" />
        <path d="M4 110 Q-4 85 5 60 Q12 42 26 38" fill="none" stroke="#10b981" stroke-width="7" stroke-linecap="round" opacity="0.3" filter="url(#pSft)" />
        <path d="M4 110 Q-4 85 5 60 Q12 42 26 38" fill="none" stroke="#059669" stroke-width="5" stroke-linecap="round" />
        <path d="M4 110 Q-4 85 5 60 Q12 42 26 38" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-dasharray="5 4" />
        <path d="M5 105 Q-3 82 6 58 Q13 44 26 40" fill="none" stroke="rgba(160,255,210,0.3)" stroke-width="1" stroke-linecap="round" />
        <ellipse cx="27" cy="37" rx="11" ry="7" fill="#059669" transform="rotate(-35,27,37)" filter="url(#pSft)" />
        <ellipse cx="27" cy="37" rx="11" ry="7" fill="#34d399" transform="rotate(-35,27,37)" opacity="0.45" />
        <path d="M20 32 Q27 30 33 35" fill="none" stroke="rgba(0,80,40,0.5)" stroke-width="1.5" />
        <circle cx="22.5" cy="33" r="2.8" fill="#f59e0b" filter="url(#pSft)" />
        <circle cx="22.5" cy="33" r="2.8" fill="#fbbf24" opacity="0.7" />
        <ellipse cx="22.5" cy="33" rx="0.9" ry="2.4" fill="#060100" />
        <circle cx="21.8" cy="32.2" r="1" fill="rgba(255,255,200,0.85)" />
        <path d="M32 33 L38 28" fill="none" stroke="#34d399" stroke-width="1.5" stroke-linecap="round" />
        <path d="M38 28 L36.5 25.5 M38 28 L40 25.5" fill="none" stroke="#34d399" stroke-width="1.2" stroke-linecap="round" />
        <rect x="0" y="108" width="96" height="4" fill="rgba(16,185,129,0.2)" />
        <line x1="0" y1="108" x2="96" y2="108" stroke="rgba(16,185,129,0.6)" stroke-width="0.8" />
        <line x1="72" y1="108" x2="96" y2="108" stroke="rgba(245,158,11,0.6)" stroke-width="0.8" />
    </g>`,
  auto: `<defs>
    <clipPath id="cpa"><rect width="96" height="112" rx="4" /></clipPath>
<radialGradient id="aBg" cx="50%" cy="50%" r="65%">
<stop offset="0%" stop-color="#1e0404"/>
<stop offset="60%" stop-color="#0e0202"/>
<stop offset="100%" stop-color="#060101"/>
</radialGradient>
<radialGradient id="aFace" cx="48%" cy="40%" r="52%">
<stop offset="0%" stop-color="#d49060"/>
<stop offset="70%" stop-color="#a86030"/>
<stop offset="100%" stop-color="#7a3a10"/>
</radialGradient>
<radialGradient id="aIris" cx="28%" cy="24%" r="65%">
<stop offset="0%" stop-color="#ffdd60"/>
<stop offset="45%" stop-color="#f97316"/>
<stop offset="100%" stop-color="#7c1a04"/>
</radialGradient>
<radialGradient id="aBody" cx="50%" cy="25%" r="70%">
<stop offset="0%" stop-color="#400808"/>
<stop offset="100%" stop-color="#100101"/>
</radialGradient>
<radialGradient id="aAura" cx="50%" cy="50%" r="55%">
<stop offset="0%" stop-color="rgba(220,38,38,0.2)"/>
<stop offset="100%" stop-color="rgba(220,38,38,0)"/>
</radialGradient>
<filter id="aFire" x="-50%" y="-80%" width="200%" height="280%">
<feGaussianBlur stdDeviation="4" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="aHeat" x="-30%" y="-30%" width="160%" height="160%">
<feGaussianBlur stdDeviation="2.5" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="aSft" x="-15%" y="-15%" width="130%" height="130%">
<feGaussianBlur stdDeviation="1.2" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="aSkin" x="-10%" y="-10%" width="120%" height="120%">
<feGaussianBlur stdDeviation="0.7" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
    <g clip-path="url(#cpa)">
        <rect width="96" height="112" fill="url(#aBg)" />
        <ellipse cx="48" cy="60" rx="48" ry="55" fill="url(#aAura)" />
        <circle cx="48" cy="60" r="46" fill="none" stroke="rgba(220,38,38,0.07)" stroke-width="3" />
        <circle cx="48" cy="60" r="32" fill="none" stroke="rgba(249,115,22,0.09)" stroke-width="2" />
        <circle cx="48" cy="60" r="18" fill="none" stroke="rgba(251,191,36,0.1)" stroke-width="1.5" />
        <line x1="-10" y1="95" x2="106" y2="65" stroke="rgba(220,38,38,0.06)" stroke-width="16" />
        <path d="M-6 112 L18 66 Q48 80 78 66 L102 112Z" fill="url(#aBody)" />
        <path d="M18 66 Q8 58 6 68 Q8 78 18 80 Q10 76 12 67 Q14 59 18 66Z" fill="#560a0a" stroke="rgba(220,38,38,0.6)" stroke-width="1" />
        <path d="M78 66 Q88 58 90 68 Q88 78 78 80 Q86 76 84 67 Q82 59 78 66Z" fill="#560a0a" stroke="rgba(220,38,38,0.6)" stroke-width="1" />
        <circle cx="10" cy="66" r="1.2" fill="rgba(220,38,38,0.6)" />
        <circle cx="10" cy="72" r="1.2" fill="rgba(220,38,38,0.6)" />
        <circle cx="86" cy="66" r="1.2" fill="rgba(220,38,38,0.6)" />
        <circle cx="86" cy="72" r="1.2" fill="rgba(220,38,38,0.6)" />
        <path d="M36 66 L48 80 L60 66" fill="none" stroke="rgba(220,38,38,0.7)" stroke-width="2.2" stroke-linejoin="round" />
        <path d="M39 66 L48 76 L57 66" fill="rgba(0,0,0,0.3)" />
        <circle cx="48" cy="90" r="11" fill="rgba(220,38,38,0.12)" stroke="rgba(220,38,38,0.55)" stroke-width="1.2" filter="url(#aHeat)" />
        <circle cx="48" cy="90" r="8" fill="none" stroke="rgba(220,38,38,0.25)" stroke-width="0.6" />
        <text x="48" y="94.5" text-anchor="middle" fill="#fca5a5" font-size="11" font-family="Arial Black, Impact, sans-serif" font-weight="900" filter="url(#aSft)">W</text>
        <path d="M39 63 Q48 70 57 63 L56 71 Q48 77 40 71Z" fill="#a06030" filter="url(#aSkin)" />
        <path d="M41 63 Q48 67 55 63 L55 66 Q48 70 41 66Z" fill="rgba(0,0,0,0.2)" />
        <ellipse cx="26" cy="51" rx="4.5" ry="5.5" fill="#a06030" />
        <path d="M27.5 48 Q25 51 27.5 54" fill="none" stroke="#7a3010" stroke-width="1.2" />
        <ellipse cx="70" cy="51" rx="4.5" ry="5.5" fill="#a06030" />
        <path d="M26 53 Q25 35 48 27 Q71 35 70 53 Q70 65 60 70 Q48 74 36 70 Q26 65 26 53Z" fill="url(#aFace)" filter="url(#aSkin)" />
        <path d="M36 68 Q48 73 60 68" fill="none" stroke="rgba(100,45,10,0.3)" stroke-width="1.5" />
        <path d="M34 60 Q33 64 35 67" fill="none" stroke="rgba(100,45,10,0.25)" stroke-width="1.5" />
        <path d="M62 60 Q63 64 61 67" fill="none" stroke="rgba(100,45,10,0.25)" stroke-width="1.5" />
        <path d="M26 46 Q25 28 48 22 Q71 28 70 46 L68 40 Q65 25 48 24 Q31 25 28 40Z" fill="#1a0303" />
        <path d="M44 26 Q40 16 38 10 Q44 14 46 22Z" fill="#220505" />
        <path d="M48 24 Q48 12 52 8 Q54 14 52 23Z" fill="#1a0303" />
        <path d="M52 25 Q56 15 60 12 Q60 18 56 26Z" fill="#220505" />
        <path d="M56 27 Q62 18 65 14 Q64 22 59 28Z" fill="#1a0303" />
        <path d="M46 19 Q50 15 55 17" fill="none" stroke="rgba(180,60,30,0.5)" stroke-width="1.5" stroke-linecap="round" />
        <path d="M54 20 Q58 17 62 19" fill="none" stroke="rgba(180,60,30,0.35)" stroke-width="1.2" stroke-linecap="round" />
        <!-- Left eye — almond -->
        <path d="M29 49.5 Q37 46 45 49.5 Q37 54 29 49.5Z" fill="white" />
        <circle cx="37" cy="50" r="4" fill="url(#aIris)" />
        <circle cx="37" cy="50" r="2.2" fill="#080000" />
        <circle cx="35" cy="48" r="1.6" fill="white" opacity="0.92" />
        <circle cx="39.5" cy="52" r="0.8" fill="white" opacity="0.45" />
        <path d="M29 48.5 Q37 44.5 45 48.5" fill="none" stroke="#080000" stroke-width="3" stroke-linecap="round" />
        <path d="M30 51.5 Q37 54 44 51.5" fill="none" stroke="#1a0500" stroke-width="1.2" stroke-linecap="round" opacity="0.7" />
        <!-- Right eye — almond -->
        <path d="M51 49.5 Q59 46 67 49.5 Q59 54 51 49.5Z" fill="white" />
        <circle cx="59" cy="50" r="4" fill="url(#aIris)" />
        <circle cx="59" cy="50" r="2.2" fill="#080000" />
        <circle cx="57" cy="48" r="1.6" fill="white" opacity="0.92" />
        <circle cx="61.5" cy="52" r="0.8" fill="white" opacity="0.45" />
        <path d="M51 48.5 Q59 44.5 67 48.5" fill="none" stroke="#080000" stroke-width="3" stroke-linecap="round" />
        <path d="M52 51.5 Q59 54 66 51.5" fill="none" stroke="#1a0500" stroke-width="1.2" stroke-linecap="round" opacity="0.7" />
        <!-- Eyebrows — heavy/furrowed (stroke-width 4) -->
        <path d="M28 44 Q37 40 45 43" fill="none" stroke="#0c0101" stroke-width="4" stroke-linecap="round" />
        <path d="M51 43 Q59 40 68 44" fill="none" stroke="#0c0101" stroke-width="4" stroke-linecap="round" />
        <path d="M43.5 42.5 Q48 41 52.5 42.5" fill="none" stroke="#0c0101" stroke-width="2" stroke-linecap="round" />
        <path d="M30 43 Q37 40.5 44 42.5" fill="none" stroke="rgba(60,15,5,0.4)" stroke-width="1" stroke-linecap="round" />
        <!-- Scar — left cheek -->
        <path d="M30 53.5 L27 58" stroke="rgba(180,70,30,0.6)" stroke-width="1.2" stroke-linecap="round" />
        <path d="M29 55 L27.5 54" stroke="rgba(180,70,30,0.35)" stroke-width="0.8" stroke-linecap="round" />
        <!-- Nose -->
        <path d="M46 57 L48 61 L50 57" fill="none" stroke="rgba(110,45,10,0.5)" stroke-width="1.3" stroke-linejoin="round" />
        <!-- Mouth — straight, stern line -->
        <path d="M40 65.5 L56 65.5" stroke="#7a2808" stroke-width="2" stroke-linecap="round" fill="none" />
        <path d="M40 65.5 Q39 66.5 40 67.5" fill="none" stroke="rgba(100,30,10,0.4)" stroke-width="0.8" />
        <path d="M56 65.5 Q57 66.5 56 67.5" fill="none" stroke="rgba(100,30,10,0.4)" stroke-width="0.8" />
        <!-- Hair accent highlights -->
        <path d="M46 19 Q50 15 55 17" fill="none" stroke="rgba(180,60,30,0.5)" stroke-width="1.5" stroke-linecap="round" />
        <path d="M54 20 Q58 17 62 19" fill="none" stroke="rgba(180,60,30,0.35)" stroke-width="1.2" stroke-linecap="round" />
        <!-- Corner accent fire (right side) -->
        <path d="M75 28 Q80 16 78 5 Q86 12 84 22 Q90 14 89 5 Q97 15 93 26 Q98 19 96 10 Q104 22 99 33 Q94 42 84 38 Q74 34 74 26 Q74.5 27 75 28Z" fill="rgba(220,38,38,0.5)" filter="url(#aFire)" />
        <path d="M77 30 Q81 19 79 10 Q85 16 84 24 Q88 17 88 11 Q93 19 90 28 Q87 35 82 33 Q77 31 77 30Z" fill="rgba(249,115,22,0.6)" />
        <path d="M80 30 Q82 22 81 16 Q84 20 84 26 Q86 21 87 17 Q89 23 87 29 Q85 33 82 32Z" fill="rgba(251,191,36,0.5)" />
        <path d="M82 28 Q83 22 83 18 Q85 22 84 27Z" fill="rgba(255,240,180,0.4)" />
        <rect x="0" y="108" width="96" height="4" fill="rgba(220,38,38,0.22)" />
        <line x1="0" y1="108" x2="96" y2="108" stroke="rgba(220,38,38,0.65)" stroke-width="0.8" />
        <line x1="0" y1="108" x2="28" y2="108" stroke="rgba(251,191,36,0.5)" stroke-width="0.8" />
    </g>`,
  pat: `<defs>
    <clipPath id="cppt"><rect width="96" height="112" rx="4" /></clipPath>
<linearGradient id="ptBg" x1="0" y1="0" x2="0.1" y2="1">
<stop offset="0%" stop-color="#08091a"/>
<stop offset="60%" stop-color="#050610"/>
<stop offset="100%" stop-color="#020308"/>
</linearGradient>
<radialGradient id="ptFace" cx="50%" cy="44%" r="50%">
<stop offset="0%" stop-color="#f5d6b8"/>
<stop offset="70%" stop-color="#ddb07a"/>
<stop offset="100%" stop-color="#b8844a"/>
</radialGradient>
<radialGradient id="ptIris" cx="28%" cy="26%" r="65%">
<stop offset="0%" stop-color="#c8f0ff"/>
<stop offset="45%" stop-color="#5ab8e0"/>
<stop offset="100%" stop-color="#0a3a60"/>
</radialGradient>
<radialGradient id="ptAura" cx="50%" cy="50%" r="55%">
<stop offset="0%" stop-color="rgba(126,200,227,0.16)"/>
<stop offset="100%" stop-color="rgba(126,200,227,0)"/>
</radialGradient>
<linearGradient id="ptBlade" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#daeef8"/>
<stop offset="55%" stop-color="#8fc8e0"/>
<stop offset="100%" stop-color="rgba(80,140,170,0.1)"/>
</linearGradient>
<filter id="ptGlw" x="-40%" y="-40%" width="180%" height="180%">
<feGaussianBlur stdDeviation="3" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="ptFlash" x="-60%" y="-60%" width="220%" height="220%">
<feGaussianBlur stdDeviation="5" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="ptSft" x="-20%" y="-20%" width="140%" height="140%">
<feGaussianBlur stdDeviation="1.2" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="ptSkin" x="-10%" y="-10%" width="120%" height="120%">
<feGaussianBlur stdDeviation="0.6" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>
    <g clip-path="url(#cppt)">
        <rect width="96" height="112" fill="url(#ptBg)" />
        <ellipse cx="48" cy="68" rx="44" ry="48" fill="url(#ptAura)" />
        <!-- Iaido flash — triple diagonal sweep, signature element -->
        <g filter="url(#ptFlash)" opacity="0.65">
            <line x1="-4" y1="92" x2="100" y2="8"  stroke="#7ec8e3" stroke-width="12" stroke-linecap="round" />
        </g>
        <g filter="url(#ptFlash)" opacity="0.35">
            <line x1="-4" y1="100" x2="100" y2="16" stroke="#7ec8e3" stroke-width="7"  stroke-linecap="round" />
        </g>
        <g filter="url(#ptFlash)" opacity="0.2">
            <line x1="-4" y1="82"  x2="100" y2="-2" stroke="#7ec8e3" stroke-width="5"  stroke-linecap="round" />
        </g>
        <!-- Sharp edge lines -->
        <line x1="-4" y1="92"  x2="100" y2="8"  stroke="#daeef8" stroke-width="1.4" stroke-linecap="round" opacity="0.85" />
        <line x1="-4" y1="100" x2="100" y2="16" stroke="#a8ddf0" stroke-width="0.8" stroke-linecap="round" opacity="0.5" />
        <line x1="-4" y1="82"  x2="100" y2="-2" stroke="#c0e8f4" stroke-width="0.6" stroke-linecap="round" opacity="0.3" />
        <!-- Body — dark navy haori -->
        <path d="M-6 112 L14 74 Q48 88 82 74 L102 112Z" fill="#0e0f22" />
        <path d="M14 74 Q48 88 82 74 L80 84 Q48 98 16 84Z" fill="#13153a" />
        <!-- Haori lapels / collar detail -->
        <path d="M36 74 L48 90 L60 74" fill="none" stroke="rgba(126,200,227,0.5)" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M38 74 L48 86 L58 74" fill="rgba(0,0,20,0.35)" />
        <!-- Katana blade — prominent, crossing left-to-right in front of body -->
        <!-- Scabbard (saya) at hip -->
        <g filter="url(#ptSft)">
            <line x1="58" y1="74" x2="82" y2="100" stroke="#2a2a4a" stroke-width="5" stroke-linecap="round" />
            <ellipse cx="62" cy="79" rx="5" ry="2.2" fill="#606080" transform="rotate(42,62,79)" />
            <ellipse cx="62" cy="79" rx="5" ry="2.2" fill="none" stroke="rgba(185,142,38,0.7)" stroke-width="0.8" transform="rotate(42,62,79)" />
        </g>
        <line x1="58" y1="74" x2="82" y2="100" stroke="#daeef8" stroke-width="1.2" stroke-linecap="round" opacity="0.92" />
        <!-- Neck -->
        <rect x="42" y="66" width="12" height="10" rx="2" fill="#ddb07a" filter="url(#ptSkin)" />
        <!-- Head -->
        <path d="M28 56 Q26 38 48 30 Q70 38 68 56 Q68 68 60 72 Q48 76 36 72 Q28 65 28 56Z" fill="url(#ptFace)" filter="url(#ptSkin)" />
        <!-- Ears -->
        <ellipse cx="27" cy="53" rx="3.5" ry="4.5" fill="#ddb07a" />
        <ellipse cx="69" cy="53" rx="3.5" ry="4.5" fill="#ddb07a" />
        <!-- Hair — dark chonmage (top-knot base, not just bowl cut) -->
        <path d="M28 52 Q26 32 48 24 Q70 32 68 52" fill="#130d06" />
        <path d="M28 50 Q20 36 18 22 Q26 28 28 40Z" fill="#0e0904" />
        <path d="M68 50 Q76 36 78 22 Q70 28 68 40Z" fill="#0e0904" />
        <!-- Topknot stem + bun (chonmage) — key samurai identifier -->
        <path d="M42 26 Q44 18 48 14 Q52 18 54 26Z" fill="#130d06" />
        <ellipse cx="48" cy="13" rx="5.5" ry="3" fill="#1a1108" />
        <ellipse cx="48" cy="8.5" rx="5" ry="5.5" fill="#1c1309" />
        <ellipse cx="48" cy="12.5" rx="4.8" ry="2.2" fill="none" stroke="rgba(185,142,38,0.72)" stroke-width="1.1" />
        <ellipse cx="46" cy="6.5" rx="2.2" ry="1.5" fill="rgba(255,255,255,0.08)" />
        <!-- Loose hair strands -->
        <path d="M30 38 Q26 33 28 40" fill="none" stroke="#130d06" stroke-width="1.5" stroke-linecap="round" opacity="0.8" />
        <path d="M66 38 Q70 33 68 40" fill="none" stroke="#130d06" stroke-width="1.5" stroke-linecap="round" opacity="0.7" />
        <!-- Round glasses — same r=7.5, enhanced iris behind them -->
        <!-- Left lens + iris -->
        <circle cx="37" cy="51" r="7.5" fill="white" />
        <circle cx="37" cy="51" r="7.5" fill="rgba(180,225,245,0.2)" />
        <circle cx="37" cy="51" r="5" fill="url(#ptIris)" />
        <circle cx="37" cy="51" r="2.6" fill="#040a1a" />
        <circle cx="35" cy="49" r="1.8" fill="white" opacity="0.92" />
        <circle cx="40" cy="53" r="0.8" fill="white" opacity="0.45" />
        <circle cx="37" cy="51" r="7.5" fill="rgba(126,200,227,0.12)" stroke="#2a2a2a" stroke-width="1.6" />
        <circle cx="37" cy="51" r="7.5" fill="none" stroke="rgba(126,200,227,0.45)" stroke-width="0.7" />
        <!-- Right lens + iris -->
        <circle cx="59" cy="51" r="7.5" fill="white" />
        <circle cx="59" cy="51" r="7.5" fill="rgba(180,225,245,0.2)" />
        <circle cx="59" cy="51" r="5" fill="url(#ptIris)" />
        <circle cx="59" cy="51" r="2.6" fill="#040a1a" />
        <circle cx="57" cy="49" r="1.8" fill="white" opacity="0.92" />
        <circle cx="62" cy="53" r="0.8" fill="white" opacity="0.45" />
        <circle cx="59" cy="51" r="7.5" fill="rgba(126,200,227,0.12)" stroke="#2a2a2a" stroke-width="1.6" />
        <circle cx="59" cy="51" r="7.5" fill="none" stroke="rgba(126,200,227,0.45)" stroke-width="0.7" />
        <!-- Bridge + temples -->
        <line x1="44.5" y1="51" x2="51.5" y2="51" stroke="#2a2a2a" stroke-width="1.4" />
        <line x1="29.5" y1="51" x2="26" y2="50" stroke="#2a2a2a" stroke-width="1.2" stroke-linecap="round" />
        <line x1="66.5" y1="51" x2="70" y2="50" stroke="#2a2a2a" stroke-width="1.2" stroke-linecap="round" />
        <!-- Eyebrows — heavy/furrowed (intensity) -->
        <path d="M30 44 Q37 41.5 44 43.5" fill="none" stroke="#0e0a04" stroke-width="2.8" stroke-linecap="round" />
        <path d="M52 43.5 Q59 41.5 66 44" fill="none" stroke="#0e0a04" stroke-width="2.8" stroke-linecap="round" />
        <!-- Nose -->
        <path d="M47 57 L48 61 L49 57" fill="none" stroke="rgba(120,70,20,0.4)" stroke-width="1.1" stroke-linejoin="round" />
        <!-- Mouth — stoic tight line -->
        <path d="M42 65 Q48 68 54 65" fill="none" stroke="#9a6030" stroke-width="1.8" stroke-linecap="round" />
        <!-- Scar — left cheek (battle-worn) -->
        <path d="M31 56 L33 60" stroke="#c07840" stroke-width="1.1" stroke-linecap="round" opacity="0.5" />
        <!-- Zanzo ghost hint (dim afterimage left side — more visible) -->
        <g opacity="0.18" filter="url(#ptSft)">
            <ellipse cx="10" cy="56" rx="7" ry="11" fill="#4a90d9" />
            <ellipse cx="10" cy="44" rx="5" ry="5" fill="#4a90d9" />
            <line x1="6" y1="68" x2="18" y2="90" stroke="#4a4a8a" stroke-width="3" stroke-linecap="round" opacity="0.6" />
        </g>
        <!-- Bottom bar — ice blue theme -->
        <rect x="0" y="108" width="96" height="4" fill="rgba(126,200,227,0.2)" />
        <line x1="0" y1="108" x2="96" y2="108" stroke="rgba(126,200,227,0.6)" stroke-width="0.8" />
        <line x1="0" y1="108" x2="32" y2="108" stroke="rgba(126,200,227,0.85)" stroke-width="0.8" />
    </g>`,
};

// ════════════════════════════════════════════════════════════
// 🖥️ UI MANAGER
// ════════════════════════════════════════════════════════════
class UIManager {
  // ════════════════════════════════════════════════════════════
  // 💉 COOLDOWN VISUAL SYSTEM
  // Injects CSS once, then draws circular arc + countdown text
  // on any skill icon element via _setCooldownVisual().
  // ════════════════════════════════════════════════════════════

  /**
   * Inject the shared CSS rules for circular cooldown overlays.
   * Safe to call every frame — exits immediately after first run.
   */
  static injectCooldownStyles() {
    if (document.getElementById("mtc-cd-styles")) return;
    const s = document.createElement("style");
    s.id = "mtc-cd-styles";
    s.textContent = `
            .skill-icon { position: relative !important; }
            .cooldown-mask { display: none !important; }
            .cd-arc-overlay {
                position: absolute; inset: 0;
                border-radius: 10px;
                pointer-events: none;
                z-index: 5;
                transition: background 0.05s linear;
            }
            .cd-timer-text {
                position: absolute; inset: 0;
                display: flex; align-items: center; justify-content: center;
                font: 700 13px 'Rajdhani', sans-serif;
                letter-spacing: 0.5px;
                text-shadow:
                    0 0 6px #000,
                    0  1px 4px rgba(0,0,0,0.95),
                    0 -1px 4px rgba(0,0,0,0.95),
                    1px 0   4px rgba(0,0,0,0.95),
                   -1px 0   4px rgba(0,0,0,0.95);
                pointer-events: none;
                z-index: 6;
            }
            /* Text contrast: strong drop-shadow on all HUD bar labels */
            #player-level, .hud-label, .skill-name {
                text-shadow:
                    0 1px 3px rgba(0,0,0,0.95),
                    0 0 6px rgba(0,0,0,0.7) !important;
            }

            /* ── Eat Rice buff-active state ────────────────────────────────── */
            @keyframes mtc-eat-pulse {
                0%   { box-shadow: 0 0 8px 2px rgba(52,211,153,0.55), inset 0 0 6px rgba(52,211,153,0.15); }
                50%  { box-shadow: 0 0 18px 5px rgba(52,211,153,0.90), inset 0 0 10px rgba(52,211,153,0.30); }
                100% { box-shadow: 0 0 8px 2px rgba(52,211,153,0.55), inset 0 0 6px rgba(52,211,153,0.15); }
            }
            .eat-buff-active {
                animation: mtc-eat-pulse 1.1s ease-in-out infinite !important;
                border-color: #34d399 !important;
            }
            /* drain bar — thin strip at bottom of icon */
            .eat-buff-bar {
                position: absolute;
                bottom: 0; left: 0;
                height: 3px;
                border-radius: 0 0 8px 8px;
                background: #34d399;
                box-shadow: 0 0 6px #34d399;
                pointer-events: none;
                z-index: 7;
                transition: width 0.1s linear;
            }
        `;
    document.head.appendChild(s);
  }

  /**
   * _E(group, key)
   * อ่าน emoji จาก GAME_TEXTS.hudEmoji — ถ้าหา config ไม่เจอ fallback เป็น key นั้น
   * @param {string} group  — 'attack' | 'skill1' | 'q' | 'e' | 'r' | 'mobile'
   * @param {string} key    — ชื่อ character หรือ 'default'
   */
  static _E(group, key) {
    const HE =
      typeof GAME_TEXTS !== "undefined"
        ? GAME_TEXTS.hudEmoji?.[group]
        : undefined;
    return HE?.[key] ?? HE?.["default"] ?? "";
  }

  /**
   * _setCooldownVisual(iconId, cooldownCurrent, cooldownMax)
   *
   * Renders a circular clock-wipe overlay + numeric countdown on top
   * of any .skill-icon element. Call this every frame from updateUI().
   *
   * @param {string} iconId           — id of the skill icon element
   * @param {number} cooldownCurrent  — seconds remaining on cooldown
   * @param {number} cooldownMax      — full cooldown duration in seconds
   */
  static _setCooldownVisual(iconId, cooldownCurrent, cooldownMax) {
    const icon = document.getElementById(iconId);
    if (!icon) return;

    // ── Circular arc overlay (conic-gradient clock-wipe) ──────
    let arc = icon.querySelector(".cd-arc-overlay");
    if (!arc) {
      arc = document.createElement("div");
      arc.className = "cd-arc-overlay";
      icon.appendChild(arc);
    }

    const elapsed =
      cooldownMax > 0 ? Math.min(1, 1 - cooldownCurrent / cooldownMax) : 1;
    const pct = (elapsed * 100).toFixed(1);

    if (cooldownCurrent > 0.05) {
      // Transparent slice = elapsed (done); dark slice = remaining
      arc.style.background = `conic-gradient(transparent 0% ${pct}%, rgba(0,0,0,0.62) ${pct}% 100%)`;
    } else {
      arc.style.background = "transparent";
    }

    // ── Countdown text ─────────────────────────────────────────
    let timer = icon.querySelector(".cd-timer-text");
    if (!timer) {
      timer = document.createElement("div");
      timer.className = "cd-timer-text";
      icon.appendChild(timer);
    }

    // Hybrid: แสดง timer เฉพาะ cooldown ยาว (> 5s) เพื่อลด Visual Noise
    if (cooldownCurrent > 0.09 && cooldownMax > 5) {
      timer.textContent = cooldownCurrent.toFixed(1) + "s";
      timer.style.display = "flex";
    } else {
      timer.style.display = "none";
    }
  }

  // ── VoiceBubble — queue-based, military HUD chip ─────────────────────────
  static _vbQueue = [];
  static _vbTimer = null;
  static _vbHideTimer = null;

  static showVoiceBubble(text, x, y) {
    if (UIManager._vbQueue.length >= 3) UIManager._vbQueue.shift();
    UIManager._vbQueue.push({ text, x, y });
    if (!UIManager._vbTimer) UIManager._flushVoiceBubble();
  }

  static _flushVoiceBubble() {
    if (UIManager._vbQueue.length === 0) {
      UIManager._vbTimer = null;
      return;
    }

    const { text, x, y } = UIManager._vbQueue.shift();
    const bubble = document.getElementById("voice-bubble");
    if (!bubble) {
      UIManager._vbTimer = null;
      return;
    }

    if (UIManager._vbHideTimer) {
      clearTimeout(UIManager._vbHideTimer);
      UIManager._vbHideTimer = null;
    }

    const screen = worldToScreen(x, y - 40);
    bubble.style.left = screen.x - bubble.offsetWidth / 2 + "px";
    bubble.style.top = screen.y - bubble.offsetHeight + "px";
    bubble.textContent = text;

    bubble.classList.remove("visible", "hiding");
    void bubble.offsetWidth;
    bubble.classList.add("visible");

    const displayMs = Math.max(1200, text.length * 55);
    UIManager._vbHideTimer = setTimeout(() => {
      bubble.classList.remove("visible");
      bubble.classList.add("hiding");
      UIManager._vbHideTimer = setTimeout(() => {
        bubble.classList.remove("hiding");
        UIManager._vbTimer = null;
        UIManager._flushVoiceBubble();
      }, 200);
    }, displayMs);

    UIManager._vbTimer = true;
  }

  static updateBossHUD(boss) {
    const hud = document.getElementById("boss-hud");
    const hpBar = document.getElementById("boss-hp-bar");
    if (!hud) return;
    if (boss && !boss.dead) {
      hud.classList.add("active");
      if (hpBar) {
        const pct = boss.hp / boss.maxHp;
        const widthPct = `${Math.max(0, pct * 100)}%`;
        hpBar.style.width = widthPct;
        hpBar.classList.remove(
          "phase-safe",
          "phase-caution",
          "phase-danger",
          "phase-critical"
        );
        if (pct > 0.6) hpBar.classList.add("phase-safe");
        else if (pct > 0.3) hpBar.classList.add("phase-caution");
        else if (pct > 0.15) hpBar.classList.add("phase-danger");
        else hpBar.classList.add("phase-critical");

        const bg = hpBar.parentElement;
        if (bg) {
          let drain = bg.querySelector(".boss-hp-drain");
          if (!drain) {
            drain = document.createElement("div");
            drain.className = "boss-hp-drain";
            bg.insertBefore(drain, hpBar);
            drain._lastPct = pct;
            drain.style.width = widthPct;
          }
          if (pct < (drain._lastPct ?? pct)) {
            const snapWidth = drain.style.width;
            drain.style.transition = "none";
            drain.style.width = snapWidth;
            drain.offsetWidth;
            drain.style.transition = "";
            drain.style.width = widthPct;
          }
          drain._lastPct = pct;
        }
      }
    } else {
      hud.classList.remove("active");
    }
  }

  // ── BossSpeech — typewriter reveal, per-frame reposition ─────────────────
  static _bsTypeTimer = null;
  static _bsHideTimer = null;
  static _bsBossRef = null;

  static updateBossSpeech(boss) {
    const speech = document.getElementById("boss-speech");
    if (!speech || !boss) return;
    UIManager._bsBossRef = boss;
    if (speech.classList.contains("visible")) {
      const screen = worldToScreen(boss.x, boss.y - 100);
      speech.style.left = screen.x - speech.offsetWidth / 2 + "px";
      speech.style.top = screen.y - speech.offsetHeight + "px";
    }
  }

  static showBossSpeech(text) {
    const speech = document.getElementById("boss-speech");
    if (!speech) return;

    if (UIManager._bsTypeTimer) {
      clearTimeout(UIManager._bsTypeTimer);
      UIManager._bsTypeTimer = null;
    }
    if (UIManager._bsHideTimer) {
      clearTimeout(UIManager._bsHideTimer);
      UIManager._bsHideTimer = null;
    }

    speech.innerHTML =
      '<span class="speech-label">⚠ KRU MANOP</span>' +
      '<span class="speech-text"></span>';

    const textEl = speech.querySelector(".speech-text");

    if (UIManager._bsBossRef && !UIManager._bsBossRef.dead) {
      const screen = worldToScreen(
        UIManager._bsBossRef.x,
        UIManager._bsBossRef.y - 100
      );
      speech.style.left = screen.x - 140 + "px";
      speech.style.top = screen.y - 60 + "px";
    }

    speech.classList.remove("visible", "hiding");
    void speech.offsetWidth;
    speech.classList.add("visible");

    let i = 0;
    const interval = Math.max(22, Math.min(55, 1100 / text.length));
    const type = () => {
      if (i <= text.length) {
        textEl.textContent = text.slice(0, i);
        i++;
        UIManager._bsTypeTimer = setTimeout(type, interval);
      } else {
        UIManager._bsTypeTimer = null;
        const holdMs = Math.max(2000, text.length * 45);
        UIManager._bsHideTimer = setTimeout(() => {
          speech.classList.remove("visible");
          speech.classList.add("hiding");
          UIManager._bsHideTimer = setTimeout(() => {
            speech.classList.remove("hiding");
            speech.textContent = "";
          }, 280);
        }, holdMs);
      }
    };
    type();
  }

  static updateHighScoreDisplay(highScore) {
    const formatted =
      highScore > 0 ? Number(highScore).toLocaleString() : "— —";
    const valEl = document.getElementById("hs-value");
    if (valEl) valEl.textContent = formatted;
  }

  static initSkillNames() {
    const SN =
      typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.skillNames
        ? GAME_TEXTS.skillNames
        : {};
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el && text) el.textContent = text;
    };

    set("sn-attack", SN.attack);
    set("sn-dash", SN.dash);
    set("sn-naga", SN.poom?.naga);
    set("sn-ritual", SN.poom?.ritual);
    set("sn-passive", SN.kao?.passive);
    set("sn-database", SN.database);
    set("sn-terminal", SN.terminal);
    set("sn-shop", SN.shop);
    UIManager.patchTooltipEmojis();
  }

  static patchTooltipEmojis() {
    const spans = document.querySelectorAll(".tt-icon[data-emoji-group]");
    spans.forEach((span) => {
      const e = UIManager._E(span.dataset.emojiGroup, span.dataset.emojiKey);
      if (e) span.textContent = e;
    });
  }

  static setupCharacterHUD(player) {
    const isPoom = player instanceof PoomPlayer;
    const charId = player.charId || (isPoom ? "poom" : "kao");
    const isKao = charId === "kao";
    const isAuto =
      charId === "auto" ||
      (typeof AutoPlayer === "function" && player instanceof AutoPlayer);
    const isPat =
      charId === "pat" ||
      (typeof PatPlayer === "function" && player instanceof PatPlayer);
    const SN =
      typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.skillNames
        ? GAME_TEXTS.skillNames
        : {};
    const hudBottom = document.querySelector(".hud-bottom");

    UIManager._hudApplyThemeAndLabel(isPoom, isKao, isAuto, isPat, hudBottom);
    UIManager._hudSetupAttackSlot(isPoom, isAuto, isPat);
    UIManager._hudSetupPortraitAndWeapon(isPoom, isAuto, isPat, player);
    UIManager._hudSetupPassiveSlot(isKao, isPat, player);
    UIManager._hudSetupSkill1Slot(isPoom, isKao, isAuto, isPat, SN);
    UIManager._hudSetupQSlot(isPoom, isKao, isAuto, isPat, SN, hudBottom);
    UIManager._hudSetupExclusiveESlots(
      isPoom,
      isKao,
      isAuto,
      isPat,
      SN,
      hudBottom
    );
    UIManager._hudSetupRitualAndMobileButtons(isPoom, isKao, isAuto, isPat, SN);
  }

  static _hudApplyThemeAndLabel(isPoom, isKao, isAuto, isPat, hudBottomEl) {
    const _THEME_CLASSES = [
      "t-neutral",
      "t-blue",
      "t-emerald",
      "t-red",
      "t-gold",
    ];
    const _applyTheme = (id, theme) => {
      const el = document.getElementById(id);
      if (!el) return;
      _THEME_CLASSES.forEach((c) => el.classList.remove(c));
      el.classList.add(theme);
    };
    const charTheme = isAuto
      ? "t-red"
      : isPoom
      ? "t-emerald"
      : isPat
      ? "t-neutral"
      : "t-blue";
    _applyTheme("dash-icon", charTheme);
    _applyTheme("stealth-icon", charTheme);

    const weaponIndicator = document.querySelector(".weapon-indicator");
    if (weaponIndicator)
      weaponIndicator.style.display = isPoom || isAuto ? "none" : "";

    if (!hudBottomEl) return;
    hudBottomEl.classList.remove(
      "hud-theme-kao",
      "hud-theme-poom",
      "hud-theme-auto",
      "hud-theme-pat"
    );
    hudBottomEl.classList.add(
      isAuto
        ? "hud-theme-auto"
        : isPoom
        ? "hud-theme-poom"
        : isPat
        ? "hud-theme-pat"
        : "hud-theme-kao"
    );

    let charLabel = hudBottomEl.querySelector(".hud-char-label");
    if (!charLabel) {
      charLabel = document.createElement("div");
      charLabel.className = "hud-char-label";
      hudBottomEl.prepend(charLabel);
    }
    const lc = isAuto
      ? {
          name: "AUTO",
          tag: "BRAWLER",
          color: "#fca5a5",
          glow: "rgba(220,38,38,0.5)",
        }
      : isPoom
      ? {
          name: "POOM",
          tag: "SPIRITUAL",
          color: "#6ee7b7",
          glow: "rgba(16,185,129,0.5)",
        }
      : isPat
      ? {
          name: "PAT",
          tag: "RONIN",
          color: "#7ec8e3",
          glow: "rgba(74,144,217,0.5)",
        }
      : {
          name: "KAO",
          tag: "ASSASSIN",
          color: "#93c5fd",
          glow: "rgba(59,130,246,0.5)",
        };
    charLabel.innerHTML =
      `<span class="hud-char-name" style="color:${lc.color};text-shadow:0 0 8px ${lc.glow};">${lc.name}</span>` +
      `<span class="hud-char-tag">${lc.tag}</span>`;
  }

  static _hudSetupAttackSlot(isPoom, isAuto, isPat) {
    const attackIcon = document.getElementById("attack-icon");
    if (!attackIcon) return;
    const _THEME_CLASSES = [
      "t-neutral",
      "t-blue",
      "t-emerald",
      "t-red",
      "t-gold",
    ];
    _THEME_CLASSES.forEach((c) => attackIcon.classList.remove(c));
    const emoji = document.getElementById("attack-emoji");
    const hint = document.getElementById("attack-hint");
    const name = document.getElementById("sn-attack");
    const _SN = typeof GAME_TEXTS !== "undefined" ? GAME_TEXTS.skillNames : {};
    if (isPoom) {
      attackIcon.classList.add("t-emerald");
      if (emoji) emoji.textContent = UIManager._E("attack", "poom");
      if (hint) {
        hint.style.background = "#064e3b";
        hint.style.color = "#6ee7b7";
      }
      if (name) {
        name.textContent = _SN.attack ?? "SHOOT";
        name.style.color = "#6ee7b7";
      }
    } else if (isAuto) {
      attackIcon.classList.add("t-red");
      if (emoji) emoji.textContent = UIManager._E("attack", "auto");
      if (hint) {
        hint.style.background = "#7f1d1d";
        hint.style.color = "#fca5a5";
      }
      if (name) {
        name.textContent = _SN.attack ?? "SHOOT";
        name.style.color = "#fca5a5";
      }
    } else if (isPat) {
      attackIcon.classList.add("t-neutral");
      if (emoji) emoji.textContent = UIManager._E("attack", "pat");
      if (hint) {
        hint.style.background = "#0a1a2e";
        hint.style.color = "#7ec8e3";
      }
      if (name) {
        name.textContent = _SN.pat?.attack ?? "SLASH";
        name.style.color = "#7ec8e3";
      }
    } else {
      attackIcon.classList.add("t-blue");
      if (emoji) emoji.textContent = UIManager._E("attack", "default");
      if (hint) {
        hint.style.background = "#1e3a8a";
        hint.style.color = "#bfdbfe";
      }
      if (name) {
        name.textContent = _SN.attack ?? "SHOOT";
        name.style.color = "#93c5fd";
      }
    }
  }

  static _hudSetupPortraitAndWeapon(isPoom, isAuto, isPat, player) {
    const hudSvg = document.getElementById("hud-portrait-svg");
    if (hudSvg) {
      const key = isPoom ? "poom" : isAuto ? "auto" : isPat ? "pat" : "kao";
      hudSvg.innerHTML = (window.PORTRAITS || {})[key] || "";
    }
  }

  static _hudSetupPassiveSlot(isKao, isPat, player) {
    const el = document.getElementById("passive-skill");
    if (!el) return;
    if (isKao || isPat) {
      el.style.display = "";
      const skillName = el.querySelector(".skill-name");
      if (player.passiveUnlocked) {
        el.style.opacity = "1";
        el.classList.add("unlocked");
        if (skillName) {
          skillName.textContent = isPat
            ? (typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.ui?.patEdge) ??
              "⚔ EDGE"
            : "MAX";
          skillName.style.color = isPat ? "#7ec8e3" : "#facc15";
        }
      } else {
        el.style.opacity = "0.35";
        el.classList.remove("unlocked");
        if (skillName) {
          skillName.textContent = isPat
            ? (typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.ui?.patRonin) ??
              "RONIN"
            : "R-Click!";
          skillName.style.color = isPat ? "#4a90d9" : "#a855f7";
        }
      }
    } else {
      el.style.display = "none";
      el.classList.remove("unlocked");
    }
  }

  static _hudSetupSkill1Slot(isPoom, isKao, isAuto, isPat, SN) {
    const skill1El =
      document.getElementById("eat-icon") ||
      document.getElementById("stealth-icon");
    if (!skill1El) return;
    const nameEl =
      skill1El.querySelector(".skill-name") ||
      (() => {
        const d = document.createElement("div");
        d.className = "skill-name";
        skill1El.appendChild(d);
        return d;
      })();
    const emojiEl = document.getElementById("skill1-emoji");
    const hintEl = document.getElementById("skill1-hint");
    const cdEl = skill1El.querySelector(".cooldown-mask");
    if (isPoom) {
      skill1El.id = "eat-icon";
      if (emojiEl) emojiEl.textContent = UIManager._E("skill1", "poom");
      if (hintEl) hintEl.textContent = "R-Click";
      if (cdEl) cdEl.id = "eat-cd";
      nameEl.textContent = SN.poom?.skill1 ?? "EAT RICE";
      nameEl.style.color = "#6ee7b7";
    } else if (isAuto) {
      skill1El.id = "stealth-icon";
      if (emojiEl) emojiEl.textContent = UIManager._E("skill1", "auto");
      if (hintEl) hintEl.textContent = "R-Click";
      if (cdEl) cdEl.id = "stealth-cd";
      nameEl.textContent = SN.auto?.skill1 ?? "WANCHAI";
      nameEl.style.color = "#fca5a5";
    } else if (isKao) {
      skill1El.id = "stealth-icon";
      if (emojiEl) emojiEl.textContent = UIManager._E("skill1", "kao");
      if (hintEl) hintEl.textContent = "R-Click";
      if (cdEl) cdEl.id = "stealth-cd";
      nameEl.textContent = SN.kao?.skill1 ?? "STEALTH";
      nameEl.style.color = "#c4b5fd";
    } else if (isPat) {
      skill1El.id = "pat-guard-icon";
      if (emojiEl) emojiEl.textContent = UIManager._E("skill1", "pat");
      if (hintEl) {
        hintEl.textContent = "R-Click";
        hintEl.style.background = "#0a1a2e";
        hintEl.style.color = "#7ec8e3";
      }
      if (cdEl) cdEl.id = "pat-guard-cd";
      nameEl.textContent = SN.pat?.skill1 ?? "BLADE GUARD";
      nameEl.style.color = "#7ec8e3";
    } else {
      skill1El.id = "stealth-icon";
      if (emojiEl) emojiEl.textContent = UIManager._E("skill1", "default");
      if (hintEl) hintEl.textContent = "R-Click";
      if (cdEl) cdEl.id = "stealth-cd";
      nameEl.textContent = "SKILL";
      nameEl.style.color = "#fbbf24";
    }
  }

  static _hudSetupQSlot(isPoom, isKao, isAuto, isPat, SN, hudBottom) {
    const nagaSlot =
      document.getElementById("naga-icon") ||
      document.getElementById("teleport-icon") ||
      document.getElementById("vacuum-icon") ||
      document.getElementById("zanzo-icon");
    const baseSlot = nagaSlot;
    if (baseSlot) {
      if (isPoom) {
        baseSlot.style.display = "flex";
        baseSlot.id = "naga-icon";
        baseSlot.style.borderColor = "#10b981";
        baseSlot.style.boxShadow = "0 0 15px rgba(16,185,129,0.4)";
        const h = baseSlot.querySelector(".key-hint");
        if (h) {
          h.textContent = "Q";
          h.style.background = "#10b981";
        }
        let n = baseSlot.querySelector(".skill-name");
        if (!n) {
          n = document.createElement("div");
          n.className = "skill-name";
          baseSlot.appendChild(n);
        }
        n.textContent = SN.poom?.naga ?? "NAGA";
        n.style.color = "#6ee7b7";
      } else if (isKao) {
        baseSlot.style.display = "flex";
        baseSlot.id = "teleport-icon";
        baseSlot.style.borderColor = "#00e5ff";
        baseSlot.style.boxShadow = "0 0 15px rgba(0,229,255,0.45)";
        baseSlot.innerHTML = `
                    <div class="key-hint" id="teleport-hint" style="background:#00e5ff;color:#0c1a2e;">Q</div>
                    <span id="teleport-emoji">${UIManager._E("q", "kao")}</span>
                    <div class="skill-name" style="color:#67e8f9;">${
                      SN.kao?.teleport ?? "TELEPORT"
                    }</div>
                    <div class="cooldown-mask" id="teleport-cd"></div>`;
      } else if (isAuto) {
        baseSlot.style.display = "flex";
        baseSlot.id = "vacuum-icon";
        baseSlot.style.borderColor = "#f97316";
        baseSlot.style.boxShadow = "0 0 15px rgba(249,115,22,0.45)";
        baseSlot.innerHTML = `
                    <div class="key-hint" id="vacuum-hint" style="background:#f97316;color:#1a0505;">Q</div>
                    <span id="vacuum-emoji">${UIManager._E("q", "auto")}</span>
                    <div class="skill-name" style="color:#fdba74;">${
                      SN.auto?.vacuum ?? "VACUUM"
                    }</div>
                    <div class="cooldown-mask" id="vacuum-cd"></div>`;
      } else if (isPat) {
        baseSlot.style.display = "flex";
        baseSlot.id = "zanzo-icon";
        baseSlot.style.borderColor = "#4a90d9";
        baseSlot.style.boxShadow = "0 0 15px rgba(74,144,217,0.45)";
        baseSlot.innerHTML = `
                    <div class="key-hint" style="background:#4a90d9;color:#0a1020;">Q</div>
                    <span>${UIManager._E("q", "pat")}</span>
                    <div class="skill-name" style="color:#7ec8e3;">${
                      SN.pat?.zanzo ?? "ZANZO"
                    }</div>
                    <div class="cooldown-mask" id="zanzo-cd"></div>`;
      } else {
        baseSlot.style.display = "none";
      }
    }

    if (!isKao && !isAuto && !isPat) {
      const maybeTeleport = document.getElementById("teleport-icon");
      if (maybeTeleport) {
        maybeTeleport.id = "naga-icon";
        maybeTeleport.style.borderColor = "#10b981";
        maybeTeleport.style.boxShadow = "0 0 15px rgba(16,185,129,0.4)";
        maybeTeleport.innerHTML = `
                    <div class="key-hint" style="background:#10b981;">Q</div>${UIManager._E(
                      "q",
                      "poom"
                    )}
                    <div class="cooldown-mask" id="naga-cd"></div>
                    <span id="naga-timer"></span>
                    <div class="skill-name" style="color:#6ee7b7;">${
                      SN.poom?.naga ?? "NAGA"
                    }</div>`;
      }
      const maybeVacuum = document.getElementById("vacuum-icon");
      if (maybeVacuum) {
        maybeVacuum.id = "naga-icon";
        maybeVacuum.style.borderColor = "#10b981";
        maybeVacuum.style.boxShadow = "0 0 15px rgba(16,185,129,0.4)";
        maybeVacuum.innerHTML = `
                    <div class="key-hint" style="background:#10b981;">Q</div>${UIManager._E(
                      "q",
                      "poom"
                    )}
                    <div class="cooldown-mask" id="naga-cd"></div>
                    <span id="naga-timer"></span>
                    <div class="skill-name" style="color:#6ee7b7;">${
                      SN.poom?.naga ?? "NAGA"
                    }</div>`;
      }
      const maybeZanzo = document.getElementById("zanzo-icon");
      if (maybeZanzo) {
        maybeZanzo.id = "naga-icon";
        maybeZanzo.style.borderColor = "#10b981";
        maybeZanzo.style.boxShadow = "0 0 15px rgba(16,185,129,0.4)";
        maybeZanzo.innerHTML = `
                    <div class="key-hint" style="background:#10b981;">Q</div>${UIManager._E(
                      "q",
                      "poom"
                    )}
                    <div class="cooldown-mask" id="naga-cd"></div>
                    <span id="naga-timer"></span>
                    <div class="skill-name" style="color:#6ee7b7;">${
                      SN.poom?.naga ?? "NAGA"
                    }</div>`;
      }
    }
  }

  static _hudSetupExclusiveESlots(isPoom, isKao, isAuto, isPat, SN, hudBottom) {
    let cloneSlot = document.getElementById("kao-clone-icon");
    if (isKao) {
      if (!cloneSlot && hudBottom) {
        cloneSlot = document.createElement("div");
        cloneSlot.className = "skill-icon";
        cloneSlot.id = "kao-clone-icon";
        cloneSlot.style.cssText =
          "border-color:#3b82f6; box-shadow:0 0 15px rgba(59,130,246,0.45);";
        cloneSlot.innerHTML = `
                    <div class="key-hint" style="background:#3b82f6;">E</div>
                    <span>${UIManager._E("e", "kao")}</span>
                    <div class="skill-name" style="color:#93c5fd;">${
                      SN.kao?.clones ?? "CLONES"
                    }</div>
                    <div class="cooldown-mask" id="clone-cd"></div>`;
        const passiveRef = document.getElementById("passive-skill");
        if (passiveRef && passiveRef.parentNode === hudBottom)
          hudBottom.insertBefore(cloneSlot, passiveRef.nextSibling);
        else hudBottom.appendChild(cloneSlot);
      }
      if (cloneSlot) cloneSlot.style.display = "flex";
    } else {
      if (cloneSlot) cloneSlot.style.display = "none";
    }

    let detSlot = document.getElementById("auto-det-icon");
    if (isAuto) {
      if (!detSlot && hudBottom) {
        detSlot = document.createElement("div");
        detSlot.className = "skill-icon";
        detSlot.id = "auto-det-icon";
        detSlot.style.cssText =
          "border-color:#dc2626; box-shadow:0 0 15px rgba(220,38,38,0.45); opacity:0.4; transition:opacity 0.2s;";
        detSlot.innerHTML = `
                    <div class="key-hint" style="background:#dc2626;">E</div>
                    <span>${UIManager._E("e", "auto")}</span>
                    <div class="skill-name" style="color:#fca5a5;">${
                      SN.auto?.detonate ?? "DETONATE"
                    }</div>
                    <div class="cooldown-mask" id="det-cd"></div>`;
        hudBottom.appendChild(detSlot);
      }
      if (detSlot) detSlot.style.display = "flex";
    } else {
      if (detSlot) detSlot.style.display = "none";
    }

    let garudaSlot = document.getElementById("garuda-icon");
    if (isPoom) {
      if (!garudaSlot && hudBottom) {
        garudaSlot = document.createElement("div");
        garudaSlot.className = "skill-icon";
        garudaSlot.id = "garuda-icon";
        garudaSlot.style.cssText =
          "border-color:#f97316; box-shadow:0 0 15px rgba(249,115,22,0.45);";
        garudaSlot.innerHTML = `
                    <div class="key-hint" style="background:#f97316;color:#1a0505;">E</div>
                    <span>${UIManager._E("e", "poom")}</span>
                    <div class="skill-name" style="color:#fdba74;font-size:9px;letter-spacing:0.02em;">${
                      GAME_TEXTS.skillNames?.poom?.garuda || "GARUDA"
                    }</div>
                    <div class="cooldown-mask" id="garuda-cd"></div>`;
        const passiveRef = document.getElementById("passive-skill");
        if (passiveRef && passiveRef.parentNode === hudBottom)
          hudBottom.insertBefore(garudaSlot, passiveRef.nextSibling);
        else hudBottom.appendChild(garudaSlot);
      }
      if (garudaSlot) garudaSlot.style.display = "flex";
    } else {
      if (garudaSlot) garudaSlot.style.display = "none";
    }

    let iaidoSlot = document.getElementById("pat-iaido-icon");
    if (isPat) {
      if (!iaidoSlot && hudBottom) {
        iaidoSlot = document.createElement("div");
        iaidoSlot.className = "skill-icon";
        iaidoSlot.id = "pat-iaido-icon";
        iaidoSlot.style.cssText =
          "border-color:#7ec8e3; box-shadow:0 0 15px rgba(126,200,227,0.45);";
        iaidoSlot.innerHTML = `
                    <div class="key-hint" style="background:#4a90d9;color:#0a1020;">R</div>
                    <span>${UIManager._E("e", "pat")}</span>
                    <div class="skill-name" style="color:#7ec8e3;font-size:9px;letter-spacing:0.02em;">${
                      SN.pat?.iaido ?? "IAIDO"
                    }</div>
                    <div class="cooldown-mask" id="pat-iaido-cd"></div>`;
        const passiveRef = document.getElementById("passive-skill");
        if (passiveRef && passiveRef.parentNode === hudBottom)
          hudBottom.insertBefore(iaidoSlot, passiveRef.nextSibling);
        else hudBottom.appendChild(iaidoSlot);
      }
      if (iaidoSlot) iaidoSlot.style.display = "flex";
    } else {
      if (iaidoSlot) iaidoSlot.style.display = "none";
    }
  }

  static _hudSetupRitualAndMobileButtons(isPoom, isKao, isAuto, isPat, SN) {
    const ritualSlot = document.getElementById("ritual-icon");
    if (ritualSlot) {
      ritualSlot.style.display = isPoom ? "flex" : "none";
      if (isPoom) {
        let n = ritualSlot.querySelector(".skill-name");
        if (!n) {
          n = document.createElement("div");
          n.className = "skill-name";
          ritualSlot.appendChild(n);
        }
        n.textContent = SN.poom?.ritual ?? "RITUAL";
        n.style.color = "#86efac";
      }
    }
    const btnNaga = document.getElementById("btn-naga");
    if (btnNaga) btnNaga.style.display = isPoom || isKao ? "flex" : "none";
    const btnSkill = document.getElementById("btn-skill");
    if (btnSkill)
      btnSkill.textContent = isPoom
        ? UIManager._E("mobile", "poom")
        : isAuto
        ? UIManager._E("mobile", "auto")
        : isKao
        ? UIManager._E("mobile", "kao")
        : isPat
        ? UIManager._E("mobile", "pat")
        : UIManager._E("mobile", "default");
  }

  static updateSkillIcons(player) {
    const setLockOverlay = (icon, locked) => {
      if (!icon) return;
      let lock = icon.querySelector(".skill-lock");
      if (locked) {
        if (!lock) {
          lock = document.createElement("div");
          lock.className = "skill-lock";
          lock.style.cssText =
            "position:absolute;inset:0;display:flex;align-items:center;" +
            "justify-content:center;font-size:20px;background:rgba(0,0,0,0.65);" +
            "border-radius:8px;z-index:10;pointer-events:none;";
          lock.textContent = "\uD83D\uDD12";
          icon.appendChild(lock);
        }
      } else if (lock) {
        lock.remove();
      }
    };

    if (player instanceof PoomPlayer) {
      UIManager._updateIconsPoom(player, setLockOverlay);
    } else if (
      typeof AutoPlayer !== "undefined" &&
      player instanceof AutoPlayer
    ) {
      UIManager._updateIconsAuto(player, setLockOverlay);
    } else if (
      typeof PatPlayer !== "undefined" &&
      player instanceof PatPlayer
    ) {
      UIManager._updateIconsPat(player, setLockOverlay);
    } else if (player.charId === "kao") {
      UIManager._updateIconsKao(player, setLockOverlay);
    }
  }

  static _updateIconsPat(player, setLockOverlay) {
    const S =
      typeof BALANCE !== "undefined" && BALANCE.characters?.pat
        ? BALANCE.characters.pat
        : {};
    const guardIcon = document.getElementById("pat-guard-icon");
    if (guardIcon) {
      const isActive = !!player.bladeGuardActive;
      guardIcon.classList.toggle("active", isActive);
      guardIcon.style.borderColor = isActive ? "#7ec8e3" : "";
      guardIcon.style.boxShadow = isActive
        ? "0 0 20px rgba(126,200,227,0.85)"
        : "";
      const nameEl = guardIcon.querySelector(".skill-name");
      if (nameEl) {
        nameEl.textContent = isActive
          ? (typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.ui?.skillActive) ??
            "ACTIVE"
          : (typeof GAME_TEXTS !== "undefined" &&
              GAME_TEXTS.skillNames?.pat?.skill1) ??
            "BLADE GUARD";
        nameEl.style.color = isActive ? "#ffffff" : "#7ec8e3";
      }
    }
    const zanzoIcon = document.getElementById("zanzo-icon");
    if (zanzoIcon) {
      const cd = Math.max(0, player.skills?.zanzo?.cd ?? 0);
      const maxCd = S.zanzoCooldown ?? 7;
      zanzoIcon.classList.toggle("active", cd <= 0);
      UIManager._setCooldownVisual("zanzo-icon", cd, maxCd);
    }
    const iaidoIcon = document.getElementById("pat-iaido-icon");
    if (iaidoIcon) {
      const phase = player._iaidoPhase ?? "none";
      const isCharging = phase === "charge";
      const isCinematic = phase === "cinematic" || phase === "flash";
      const cd = Math.max(0, player.skills?.iaido?.cd ?? 0);
      const maxCd = S.iaidoCooldown ?? 14;

      if (isCharging) {
        iaidoIcon.classList.add("active");
        iaidoIcon.style.borderColor = "#7ec8e3";
        iaidoIcon.style.boxShadow = "0 0 22px rgba(126,200,227,0.90)";
        const chargeTimer = player._iaidoTimer ?? 0;
        const chargeDur = S.iaidoChargeDuration ?? 0.6;
        const chargeProgress = Math.min(1, chargeTimer / chargeDur);
        UIManager._setCooldownVisual(
          "pat-iaido-icon",
          (1 - chargeProgress) * 0.6,
          0.6
        );
        const nameEl = iaidoIcon.querySelector(".skill-name");
        if (nameEl) {
          nameEl.textContent =
            (typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.ui?.patCharging) ??
            "CHARGING";
          nameEl.style.color = "#ffffff";
        }
      } else if (isCinematic) {
        iaidoIcon.classList.add("active");
        iaidoIcon.style.borderColor = "#ff4444";
        iaidoIcon.style.boxShadow = "0 0 22px rgba(204,34,34,0.85)";
        const nameEl = iaidoIcon.querySelector(".skill-name");
        if (nameEl) {
          nameEl.textContent =
            (typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.ui?.patIaido) ??
            "IAIDO!";
          nameEl.style.color = "#ff6666";
        }
      } else {
        iaidoIcon.classList.toggle("active", cd <= 0);
        iaidoIcon.style.borderColor = "";
        iaidoIcon.style.boxShadow = "";
        UIManager._setCooldownVisual("pat-iaido-icon", cd, maxCd);
        const nameEl = iaidoIcon.querySelector(".skill-name");
        if (nameEl) {
          nameEl.textContent =
            (typeof GAME_TEXTS !== "undefined" &&
              GAME_TEXTS.skillNames?.pat?.iaido) ??
            "IAIDO";
          nameEl.style.color = "#7ec8e3";
        }
      }
    }
    const passiveEl = document.getElementById("passive-skill");
    if (passiveEl) {
      const unlocked = !!player.passiveUnlocked;
      passiveEl.style.opacity = unlocked ? "1" : "0.35";
      const skillName = passiveEl.querySelector(".skill-name");
      if (skillName) {
        skillName.textContent = unlocked
          ? (typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.ui?.patEdge) ??
            "⚔ EDGE"
          : (typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.ui?.patRonin) ??
            "RONIN";
        skillName.style.color = unlocked ? "#7ec8e3" : "#4a90d9";
      }
    }
  }

  static _updateIconsPoom(player, setLockOverlay) {
    const S = BALANCE.characters.poom;
    const nagaReady = !!player._nagaUnlocked;
    setLockOverlay(document.getElementById("eat-icon"), false);
    setLockOverlay(document.getElementById("naga-icon"), !nagaReady);
    setLockOverlay(document.getElementById("ritual-icon"), !nagaReady);
    setLockOverlay(
      document.getElementById("garuda-icon"),
      !player.passiveUnlocked
    );
    const eatIcon = document.getElementById("eat-icon");
    if (eatIcon) {
      const eating = !!player.isEatingRice;
      eatIcon.classList.toggle("active", eating);
      eatIcon.classList.toggle("eat-buff-active", eating);
      let bar = eatIcon.querySelector(".eat-buff-bar");
      if (eating) {
        if (!bar) {
          bar = document.createElement("div");
          bar.className = "eat-buff-bar";
          eatIcon.appendChild(bar);
        }
        const pct = Math.max(
          0,
          Math.min(1, (player.eatRiceTimer ?? 0) / (S.eatRiceDuration ?? 6))
        );
        bar.style.width = pct * 100 + "%";
      } else {
        if (bar) bar.remove();
      }
      const nameEl = eatIcon.querySelector(".skill-name");
      if (nameEl) {
        if (eating && player.eatRiceTimer > 0) {
          nameEl.textContent = player.eatRiceTimer.toFixed(1) + "s";
          nameEl.style.color = "#34d399";
        } else {
          nameEl.textContent =
            (typeof GAME_TEXTS !== "undefined" &&
              GAME_TEXTS.skillNames?.poom?.skill1) ??
            "EAT RICE";
          nameEl.style.color = "#6ee7b7";
        }
      }
    }
    UIManager._setCooldownVisual(
      "eat-icon",
      player.isEatingRice ? 0 : Math.max(0, player.cooldowns.eat),
      S.eatRiceCooldown
    );
    const nagaIcon = document.getElementById("naga-icon");
    const nagaTimer = document.getElementById("naga-timer");
    if (nagaIcon)
      nagaIcon.classList.toggle("active", player.cooldowns.naga <= 0);
    if (nagaTimer) nagaTimer.style.display = "none";
    UIManager._setCooldownVisual(
      "naga-icon",
      Math.max(0, player.cooldowns.naga),
      S.nagaCooldown
    );
    const ritualIcon = document.getElementById("ritual-icon");
    const ritualTimer = document.getElementById("ritual-timer");
    const maxRitualCd = GAME_CONFIG?.abilities?.ritual?.cooldown || 20;
    if (ritualIcon)
      ritualIcon.classList.toggle("active", player.cooldowns.ritual <= 0);
    if (ritualTimer) ritualTimer.style.display = "none";
    UIManager._setCooldownVisual(
      "ritual-icon",
      Math.max(0, player.cooldowns.ritual),
      maxRitualCd
    );
    const garudaIcon = document.getElementById("garuda-icon");
    if (garudaIcon)
      garudaIcon.classList.toggle("active", player.cooldowns.garuda <= 0);
    UIManager._setCooldownVisual(
      "garuda-icon",
      Math.max(0, player.cooldowns.garuda),
      BALANCE.characters.poom.garudaCooldown ?? 24
    );
  }

  static _updateIconsAuto(player, setLockOverlay) {
    const S = BALANCE.characters.auto;
    setLockOverlay(document.getElementById("stealth-icon"), false);
    setLockOverlay(
      document.getElementById("vacuum-icon"),
      !player.passiveUnlocked
    );
    setLockOverlay(
      document.getElementById("auto-det-icon"),
      !player.passiveUnlocked
    );
    const wanchaiCd = S.wanchaiCooldown ?? 12;
    UIManager._setCooldownVisual(
      "stealth-icon",
      player.wanchaiActive ? 0 : Math.max(0, player.cooldowns.wanchai ?? 0),
      wanchaiCd
    );
    const stealthIcon = document.getElementById("stealth-icon");
    if (stealthIcon) {
      const nameEl = stealthIcon.querySelector(".skill-name");
      if (nameEl) {
        if (player.wanchaiActive && player.wanchaiTimer > 0) {
          nameEl.textContent = player.wanchaiTimer.toFixed(1) + "s";
          nameEl.style.color = "#fca5a5";
        } else {
          nameEl.textContent =
            (typeof GAME_TEXTS !== "undefined" &&
              GAME_TEXTS.skillNames?.auto?.skill1) ??
            "WANCHAI";
          nameEl.style.color = "#fca5a5";
        }
      }
    }
    const vacMaxCd = player.wanchaiActive
      ? S.standPullCooldown ?? 10
      : S.vacuumCooldown ?? 6;
    UIManager._setCooldownVisual(
      "vacuum-icon",
      Math.max(0, player.cooldowns.vacuum ?? 0),
      vacMaxCd
    );
    const detIcon = document.getElementById("auto-det-icon");
    if (detIcon) {
      if (player.wanchaiActive) {
        detIcon.style.opacity = "1";
        detIcon.style.boxShadow = "0 0 20px rgba(220,38,38,0.80)";
        detIcon.classList.add("active");
      } else {
        detIcon.style.opacity = "0.35";
        detIcon.style.boxShadow = "0 0 8px rgba(220,38,38,0.25)";
        detIcon.classList.remove("active");
      }
    }
    UIManager._setCooldownVisual(
      "auto-det-icon",
      Math.max(0, player.cooldowns.detonation ?? 0),
      S.detonationCooldown ?? 8
    );
  }

  static _updateIconsKao(player, setLockOverlay) {
    const S = BALANCE.characters.kao;
    const passive = player.passiveUnlocked;
    const teleportIcon = document.getElementById("teleport-icon");
    setLockOverlay(teleportIcon, !passive);
    if (teleportIcon && passive) {
      const charges = player.teleportCharges || 0;
      const maxCharges = player.maxTeleportCharges || 3;
      const isFull = charges >= maxCharges;
      teleportIcon.classList.toggle("active", charges > 0);
      if (
        !isFull &&
        player.teleportTimers &&
        player.teleportTimers.length > 0
      ) {
        const best = player.teleportTimers.reduce(
          (b, t) => (t.elapsed > b.elapsed ? t : b),
          player.teleportTimers[0]
        );
        const remaining = Math.max(0, best.max - best.elapsed);
        if (charges > 0) {
          let arc = teleportIcon.querySelector(".cd-arc-overlay");
          if (!arc) {
            arc = document.createElement("div");
            arc.className = "cd-arc-overlay";
            teleportIcon.appendChild(arc);
          }
          const elapsed =
            best.max > 0 ? Math.min(1, 1 - remaining / best.max) : 1;
          const p = (elapsed * 100).toFixed(1);
          arc.style.background =
            remaining > 0.05
              ? `conic-gradient(transparent 0% ${p}%, rgba(0,0,0,0.62) ${p}% 100%)`
              : "transparent";
          let tmr = teleportIcon.querySelector(".cd-timer-text");
          if (!tmr) {
            tmr = document.createElement("div");
            tmr.className = "cd-timer-text";
            teleportIcon.appendChild(tmr);
          }
          tmr.style.display = "none";
        } else {
          UIManager._setCooldownVisual("teleport-icon", remaining, best.max);
        }
      } else {
        UIManager._setCooldownVisual("teleport-icon", 0, 1);
      }
      let chargeLabel = teleportIcon.querySelector(".charge-label");
      if (!chargeLabel) {
        chargeLabel = document.createElement("span");
        chargeLabel.className = "charge-label";
        chargeLabel.style.cssText =
          "position:absolute;bottom:2px;right:4px;font-size:10px;" +
          "font-weight:bold;color:#00e5ff;text-shadow:0 0 4px #000;pointer-events:none;";
        teleportIcon.appendChild(chargeLabel);
      }
      chargeLabel.textContent = charges > 0 ? `${charges}` : "";
    } else if (teleportIcon && !passive) {
      UIManager._setCooldownVisual("teleport-icon", 0, 1);
      const cl = teleportIcon.querySelector(".charge-label");
      if (cl) cl.textContent = "";
    }
    const cloneIcon = document.getElementById("kao-clone-icon");
    setLockOverlay(cloneIcon, !passive);
    if (cloneIcon) {
      const cloneReady = player.cloneSkillCooldown <= 0;
      cloneIcon.classList.toggle("active", passive && cloneReady);
      if (player.clonesActiveTimer > 0) {
        cloneIcon.style.borderColor = "#00e5ff";
        cloneIcon.style.boxShadow = "0 0 20px rgba(0,229,255,0.7)";
      } else {
        cloneIcon.style.borderColor =
          passive && cloneReady ? "#60a5fa" : "#3b82f6";
        cloneIcon.style.boxShadow =
          passive && cloneReady
            ? "0 0 18px rgba(96,165,250,0.65)"
            : "0 0 15px rgba(59,130,246,0.45)";
      }
      UIManager._setCooldownVisual(
        "kao-clone-icon",
        passive ? Math.max(0, player.cloneSkillCooldown) : 0,
        player.maxCloneCooldown
      );
    }
  }

  static showGameOver(score, wave, kills) {
    const titleEl = document.querySelector(".title");
    if (titleEl) {
      titleEl.textContent = "MTC the Game";
    }
    const reportScoreEl = document.getElementById("report-score");
    if (reportScoreEl) reportScoreEl.textContent = score.toLocaleString();
    const reportWaveEl = document.getElementById("report-wave");
    if (reportWaveEl) reportWaveEl.textContent = wave;
    const reportKillsEl = document.getElementById("report-kills");
    if (reportKillsEl)
      reportKillsEl.textContent = (kills || 0).toLocaleString();
    const rc = document.getElementById("report-card");
    if (rc) rc.style.display = "block";

    const charSection = document.querySelector(".char-select-section");
    if (charSection) charSection.style.display = "block";

    const missionBrief = document.getElementById("mission-brief");
    if (missionBrief)
      missionBrief.textContent =
        (typeof GAME_TEXTS !== "undefined" && GAME_TEXTS.ui?.endGameSubtitle) ??
        "เลือกตัวละครใหม่หรือลองอีกครั้ง";
  }

  static resetGameOverUI() {
    const els = {
      "report-score": "0",
      "report-wave": "0",
      "report-text": "Loading...",
    };
    for (const [id, val] of Object.entries(els)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }
  }

  static draw(ctx, dt) {
    if (window.CanvasHUD) CanvasHUD.draw(ctx, dt);
  }
}

window.UIManager = UIManager;
