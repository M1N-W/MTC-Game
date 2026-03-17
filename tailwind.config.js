module.exports = {
  content: ["./index.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        "mtc-gold": "#facc15",
        "mtc-gold-dk": "#f59e0b",
        "mtc-navy": "#0f172a",
        "mtc-navy-md": "#1e293b",
        "mtc-slate": "#334155",
        "mtc-cyan": "#06b6d4",
        "mtc-cyan-lt": "#67e8f9",
        "mtc-green": "#00ff41",
        "mtc-red": "#ef4444",
      },
      keyframes: {
        loadingPulse: {
          "0%,100%": { transform: "scale(1)", opacity: "0.8" },
          "50%": { transform: "scale(1.1)", opacity: "1" },
        },
        promptPulse: {
          "0%,100%": { boxShadow: "0 0 12px var(--prompt-glow-sm)" },
          "50%": { boxShadow: "0 0 28px var(--prompt-glow-lg)" },
        },
        rpEnter: {
          from: { opacity: "0", transform: "scale(0.93) translateY(14px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        phosphorFlicker: {
          "0%,98%,100%": { opacity: "1" },
          "99%": { opacity: "0.88" },
        },
      },
      animation: {
        "loading-pulse": "loadingPulse 2s ease-in-out infinite",
        "prompt-pulse": "promptPulse 1.5s ease-in-out infinite",
        "rp-enter": "rpEnter 0.24s cubic-bezier(0.22,1,0.36,1) both",
        "phosphor-flicker": "phosphorFlicker 6s infinite",
      },
      backdropBlur: { 4: "4px", 8: "8px", 12: "12px" },
    },
  },
  plugins: [],
};