'use strict';
// ⚠️  SECURITY: API key is served from the backend proxy. Do NOT add real keys here.
// Route all Gemini calls through your server-side function (Firebase Function,
// Vercel serverless, etc.) that holds the key in an environment variable and
// enforces per-session rate-limiting.
//
// Backend proxy example (Node/Express):
//   app.post('/api/gemini', authMiddleware, async (req, res) => {
//       const key = process.env.GEMINI_API_KEY;   // env var only — never commit
//       const response = await callGemini(req.body, key);
//       res.json(response);
//   });
const CONFIG_SECRETS = {
    GEMINI_API_KEY: ""   // populated at runtime by backend proxy
};
// ══════════════════════════════════════════════════════════════
// 🌐 WINDOW EXPORTS
// ══════════════════════════════════════════════════════════════
window.CONFIG_SECRETS = CONFIG_SECRETS;