#!/usr/bin/env node
/**
 * gen-sw-manifest.js — Regenerate the AUTO-GEN block of sw.js.
 *
 * Introduced in v3.44.3 (tech-debt remediation: replace hand-maintained
 * CACHE_NAME comment + urlsToCache list).
 *
 * What it does:
 *   1. Reads `version` from package.json.
 *   2. Scans `index.html` for every <link rel="stylesheet" href="..."> and
 *      <script defer src="..."> reference → the authoritative boot asset list.
 *   3. Emits `CACHE_NAME = "mtc-cache-v<version>"` + a deduped, alphabetised
 *      `urlsToCache` array between the AUTO-GEN:START / AUTO-GEN:END markers
 *      in sw.js. All code outside the markers is preserved byte-for-byte.
 *
 * Usage:
 *     npm run gen:sw
 *     # or: node scripts/gen-sw-manifest.js
 *     # or: node scripts/gen-sw-manifest.js --check   (CI mode: exit 1 if out-of-date)
 */
const fs = require('fs');
const path = require('path');

const REPO   = path.resolve(__dirname, '..');
const SW     = path.join(REPO, 'sw.js');
const PKG    = path.join(REPO, 'package.json');
const INDEX  = path.join(REPO, 'index.html');

const START = '// AUTO-GEN:START';
const END   = '// AUTO-GEN:END';

// ── 1. Version from package.json ─────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
const version = pkg.version;
if (!version) {
  console.error('[gen:sw] package.json has no `version` field');
  process.exit(2);
}

// ── 2. Scan index.html for css/js references ─────────────────────────────
const indexSrc = fs.readFileSync(INDEX, 'utf8');

const refs = new Set(['./', './index.html']);

// <link rel="stylesheet" href="css/foo.css"> — capture the href value
for (const m of indexSrc.matchAll(/<link[^>]*href="([^"]+\.css)"/g)) {
  refs.add('./' + m[1].replace(/^\.\//, ''));
}
// <script src|defer src="js/foo.js">
for (const m of indexSrc.matchAll(/<script[^>]*\bsrc="([^"]+\.js)"/g)) {
  const p = m[1].replace(/^\.\//, '');
  // skip remote bundles (http://, https://, //cdn…)
  if (/^https?:|^\/\//.test(p)) continue;
  if (p === 'js/secrets.js') continue;
  refs.add('./' + p);
}

// Sanity: the file count shouldn't collapse — expect > 30 entries for this project.
if (refs.size < 20) {
  console.error(`[gen:sw] scanned only ${refs.size} refs from index.html — likely regex mismatch`);
  process.exit(3);
}

// Keep the existing convention: put ./ and ./index.html first, then stable sort.
const sorted = [...refs].sort((a, b) => {
  if (a === './') return -1;
  if (b === './') return 1;
  if (a === './index.html') return -1;
  if (b === './index.html') return 1;
  return a.localeCompare(b);
});

// ── 3. Render the AUTO-GEN block ─────────────────────────────────────────
const block = [
  START,
  `const CACHE_NAME = "mtc-cache-v${version}";`,
  '',
  'const urlsToCache = [',
  ...sorted.map((u) => `  "${u}",`),
  '];',
  END,
].join('\n');

// ── 4. Splice into sw.js between markers ─────────────────────────────────
const orig = fs.readFileSync(SW, 'utf8');
const a = orig.indexOf(START);
const b = orig.indexOf(END);
if (a === -1 || b === -1 || b < a) {
  console.error(`[gen:sw] markers not found in sw.js — expected ${START} and ${END}`);
  process.exit(4);
}
const next = orig.slice(0, a) + block + orig.slice(b + END.length);

// ── 5. Check-mode vs write-mode ──────────────────────────────────────────
const checkMode = process.argv.includes('--check');
if (checkMode) {
  if (next === orig) {
    console.log(`[gen:sw] sw.js is up-to-date (version ${version}, ${sorted.length} assets)`);
    process.exit(0);
  }
  console.error('[gen:sw] sw.js is STALE — run `npm run gen:sw` to regenerate');
  process.exit(1);
}

if (next === orig) {
  console.log(`[gen:sw] no changes (already v${version}, ${sorted.length} assets)`);
} else {
  fs.writeFileSync(SW, next);
  console.log(`[gen:sw] wrote sw.js  →  v${version}  |  ${sorted.length} assets`);
}
