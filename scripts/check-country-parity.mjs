#!/usr/bin/env node
/**
 * Country registry parity check — phone app vs PWA.
 *
 * The two apps keep separate country registries, and nothing used to notice when they drifted.
 * That is how the phone app ended up with Nepal while the web app did not, and how the web app
 * ended up with no UK mileage rate while the phone app had one — in both cases the web registry
 * silently served Canadian tax rules instead, which is worse than an error.
 *
 * This walks both registries and reports every difference that would change a number a driver
 * sees: which countries exist, their currency and distance unit, their default withholding, and
 * their mileage rates. Exits non-zero on any mismatch, so it can gate CI.
 *
 * Run: node scripts/check-country-parity.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The phone registry is TypeScript, so read the data out rather than importing it — this script
// stays dependency-free and runnable anywhere.
const MOBILE_DIR = resolve(root, 'src/registry/countries');
const WEB_DIR = resolve(root, 'web/src/registry/countries');

const num = (v) => (v == null || v === 'null' ? null : Number(v));

/** Pull the fields we care about out of a country definition source file. */
function scrape(src) {
  const pick = (re) => {
    const m = src.match(re);
    return m ? m[1] : null;
  };
  const mileageBlock = src.match(/mileage:\s*(null|\{[\s\S]*?\n {2}\},)/);
  const raw = mileageBlock ? mileageBlock[1] : null;

  let mileage = null;
  if (raw && raw !== 'null') {
    const car = raw.match(/car:\s*\{([^}]*)\}/);
    mileage = {
      authority: (raw.match(/authority:\s*['"]([^'"]+)['"]/) || [])[1] ?? null,
      car: car
        ? {
            ratePrimary: num((car[1].match(/ratePrimary:\s*([\d.]+|null)/) || [])[1]),
            rateSecondary: num((car[1].match(/rateSecondary:\s*([\d.]+|null)/) || [])[1]),
            rateThreshold: num((car[1].match(/rateThreshold:\s*([\d.]+|null)/) || [])[1]),
          }
        : null,
    };
  }

  return {
    currency: pick(/currency:\s*['"]([^'"]+)['"]/),
    symbol: pick(/symbol:\s*['"]([^'"]+)['"]/),
    distanceUnit: pick(/distanceUnit:\s*['"]([^'"]+)['"]/),
    withholding: num(pick(/defaultWithholdingPct:\s*([\d.]+)/)),
    mileage,
  };
}

function read(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Which countries each app actually REGISTERS (a definition sitting on disk unregistered is not
 *  shipped, and must not be reported as a divergence). */
function registeredMobile() {
  const src = read(`${MOBILE_DIR}/index.ts`) ?? '';
  const m = src.match(/COUNTRY_MAP:\s*Record<string,\s*CountryDef>\s*=\s*\{([^}]*)\}/);
  return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : [];
}
function registeredWeb() {
  const src = read(`${WEB_DIR}/index.js`) ?? '';
  const m = src.match(/const COUNTRIES\s*=\s*\[([^\]]*)\]/);
  return m ? m[1].split(',').map((x) => x.trim()).filter(Boolean) : [];
}

const mobileIds = registeredMobile();
const webIds = registeredWeb();
const ALL = [...new Set([...mobileIds, ...webIds])];

const mobile = {};
const web = {};
for (const id of ALL) {
  const m = mobileIds.includes(id) ? read(`${MOBILE_DIR}/${id}/index.ts`) : null;
  const w = webIds.includes(id) ? read(`${WEB_DIR}/${id}.country.js`) : null;
  if (m) mobile[id] = scrape(m);
  if (w) web[id] = scrape(w);
}

const problems = [];

// 1. Same country set?
for (const id of ALL) {
  if (mobile[id] && !web[id]) {
    problems.push(
      `${id}: registered on PHONE but MISSING on WEB. A synced ${id} profile will hit the web ` +
        `registry's fallback and be shown another country's currency and tax rate.`,
    );
  }
  if (web[id] && !mobile[id]) problems.push(`${id}: registered on WEB but MISSING on PHONE.`);
}

// 2. Same numbers where both exist?
for (const id of ALL) {
  const m = mobile[id];
  const w = web[id];
  if (!m || !w) continue;

  for (const key of ['currency', 'symbol', 'distanceUnit', 'withholding']) {
    if (String(m[key]) !== String(w[key])) {
      problems.push(`${id}.${key}: phone=${m[key]} web=${w[key]}`);
    }
  }

  const mm = m.mileage;
  const wm = w.mileage;
  if (!mm !== !wm) {
    problems.push(
      `${id}.mileage: phone=${mm ? 'has rates' : 'null'} web=${wm ? 'has rates' : 'null'} — ` +
        `the same shift would produce a different write-off on each platform.`,
    );
  } else if (mm && wm) {
    for (const key of ['ratePrimary', 'rateSecondary', 'rateThreshold']) {
      const a = mm.car?.[key] ?? null;
      const b = wm.car?.[key] ?? null;
      if (a !== b) problems.push(`${id}.mileage.car.${key}: phone=${a} web=${b}`);
    }
  }
}

console.log(`Phone registers: ${mobileIds.join(', ') || '(none)'}`);
console.log(`Web   registers: ${webIds.join(', ') || '(none)'}\n`);

if (!problems.length) {
  console.log('✓ Phone and web registries agree on every driver-visible number.');
  process.exit(0);
}

console.log(`✗ ${problems.length} divergence(s):\n`);
for (const p of problems) console.log(`  - ${p}`);
console.log('\nA driver whose vault moves between the two apps would see different numbers.');
process.exit(1);
