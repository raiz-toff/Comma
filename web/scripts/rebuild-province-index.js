#!/usr/bin/env node
/**
 * Regenerate `src/registry/provinces/index.js` from all country subfolders:
 *   `src/registry/provinces/{CA|US|UK|…}/*.province.js` (skip `_*.province.js`).
 *
 * **US only:** also creates missing `US/{CODE}.province.js` stubs from
 * `WITHHOLDING_PRESETS_US` in `withholding-presets.js` (use `--force-us` to overwrite all).
 *
 * **Import names:** `ON` for CA Ontario; `prov{SUB}` for other CA provinces;
 * `p{SUB}` for US states (matches prior convention); `prov{COUNTRY}_{SUB}` for any other country.
 *
 * Usage:
 *   node scripts/rebuild-province-index.js
 *   node scripts/rebuild-province-index.js --force-us
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROVINCES_DIR = path.join(ROOT, 'src', 'registry', 'provinces');
const WITHHOLDING_PATH = path.join(ROOT, 'src', 'registry', 'tax', 'withholding-presets.js');

const US_STUB = (code) =>
  `import { createUsStateProvince } from './_usStateProvince.js';\n\nexport default createUsStateProvince('${code}');\n`;

function parseUsWithholdingKeys() {
  const wp = fs.readFileSync(WITHHOLDING_PATH, 'utf8');
  const i = wp.indexOf('export const WITHHOLDING_PRESETS_US = Object.freeze({');
  if (i < 0) throw new Error('WITHHOLDING_PRESETS_US block not found in withholding-presets.js');
  const end = wp.indexOf('\n});\n\n/**', i);
  if (end < 0) throw new Error('WITHHOLDING_PRESETS_US block end not found');
  const block = wp.slice(i, end);
  const keys = [...block.matchAll(/^\s+([A-Z]{2}):\s+\d+/gm)].map((m) => m[1]);
  return [...new Set(keys)].sort((a, b) => a.localeCompare(b));
}

/** Two-letter country folders only (matches CountryRegistry ids: CA, US, UK, …). */
function listCountryDirs() {
  if (!fs.existsSync(PROVINCES_DIR)) return [];
  return fs
    .readdirSync(PROVINCES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[A-Z]{2}$/i.test(d.name))
    .map((d) => d.name.toUpperCase())
    .sort((a, b) => {
      if (a === 'CA') return -1;
      if (b === 'CA') return 1;
      if (a === 'US') return -1;
      if (b === 'US') return 1;
      return a.localeCompare(b);
    });
}

/**
 * @param {string} countryId
 * @returns {string[]}
 */
function listProvinceFilesForCountry(countryId) {
  const dir = path.join(PROVINCES_DIR, countryId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.province.js') && !f.startsWith('_'))
    .sort((a, b) => {
      if (countryId === 'CA') {
        if (a === 'ON.province.js') return -1;
        if (b === 'ON.province.js') return 1;
      }
      return a.localeCompare(b);
    });
}

/**
 * Unique JS binding for a province module (stable across rebuilds for CA/US).
 * @param {string} countryId
 * @param {string} subdivisionCode from filename without .province.js
 */
function importBindingName(countryId, subdivisionCode) {
  const c = String(countryId).toUpperCase();
  const s = String(subdivisionCode).toUpperCase();
  if (c === 'US') return `p${s}`;
  if (c === 'CA' && s === 'ON') return 'ON';
  if (c === 'CA') return `prov${s}`;
  return `prov${c}_${s}`;
}

function registryFooter() {
  return [
    '/** @type {Map<string, typeof ON>} */',
    'const byId = new Map(PROVINCES.map((p) => [p.id, p]));',
    '',
    "const FALLBACK_ID = 'ON';",
    '',
    'function validateProvinceDefinition(def) {',
    "  const required = ['id', 'countryId', 'availablePlatforms', 'expenseCategories'];",
    '  const missing = required.filter((k) => def[k] == null);',
    '  if (missing.length) throw new Error(`Province definition missing: ${missing.join(\', \')}`);',
    '  if (!Array.isArray(def.availablePlatforms) || def.availablePlatforms.length === 0) {',
    '    throw new Error(`Province ${def.id} needs availablePlatforms`);',
    '  }',
    '  return true;',
    '}',
    '',
    'export const ProvinceRegistry = {',
    '  /** @returns {readonly typeof ON[]} */',
    '  getAll: () => PROVINCES,',
    '',
    '  /**',
    '   * @param {string | null | undefined} id',
    '   * @returns {typeof ON}',
    '   */',
    '  getById: (id) => {',
    "    const key = String(id || '').toUpperCase();",
    '    return byId.get(key) || byId.get(FALLBACK_ID) || ON;',
    '  },',
    '',
    '  /**',
    '   * @param {string} countryId',
    '   * @returns {typeof ON[]}',
    '   */',
    '  getByCountry: (countryId) => {',
    "    const c = String(countryId || '').toUpperCase();",
    "    return PROVINCES.filter((p) => String(p.countryId).toUpperCase() === c);",
    '  },',
    '',
    '  /** @param {typeof ON} def */',
    '  validate: (def) => validateProvinceDefinition(def),',
    '};',
    '',
    'export function assertProvinceRegistryValid() {',
    '  for (const p of PROVINCES) validateProvinceDefinition(p);',
    '}',
    '',
  ].join('\n');
}

function main() {
  const forceUs = process.argv.includes('--force-us');
  const countries = listCountryDirs();
  if (!countries.includes('CA')) {
    throw new Error('Expected a CA country folder under src/registry/provinces/');
  }

  const usDir = path.join(PROVINCES_DIR, 'US');
  const usKeys = parseUsWithholdingKeys();

  if (countries.includes('US')) {
    if (!fs.existsSync(usDir)) fs.mkdirSync(usDir, { recursive: true });
    for (const code of usKeys) {
      const fp = path.join(usDir, `${code}.province.js`);
      if (forceUs || !fs.existsSync(fp)) {
        fs.writeFileSync(fp, US_STUB(code));
      }
    }
  }

  const allImports = [];
  const allVars = [];
  const counts = /** @type {Record<string, number>} */ ({});

  for (const countryId of countries) {
    let files;
    if (countryId === 'US') {
      files = usKeys.map((k) => `${k}.province.js`);
    } else {
      files = listProvinceFilesForCountry(countryId);
    }

    counts[countryId] = files.length;
    for (const file of files) {
      const sub = file.replace(/\.province\.js$/i, '').toUpperCase();
      const binding = importBindingName(countryId, sub);
      allImports.push(`import ${binding} from './${countryId}/${file}';`);
      allVars.push(binding);
    }
  }

  if (!listProvinceFilesForCountry('CA').includes('ON.province.js')) {
    throw new Error('Expected src/registry/provinces/CA/ON.province.js');
  }

  const header =
    '/**\n' +
    ' * Province / territory registry (plan F9).\n' +
    ' * Layout: `{ISO}/*.province.js` under this folder (CA, US, UK, …). Skip `_*.province.js`.\n' +
    ' * Run `npm run rebuild:provinces` to regenerate this file from the folders; US stubs also\n' +
    ' * sync from `WITHHOLDING_PRESETS_US`.\n' +
    ' */\n\n';

  const imports = allImports.join('\n');
  const provincesList = allVars.join(', ');
  const body = `${header}${imports}

/** @type {typeof ON[]} */
const PROVINCES = [${provincesList}];

${registryFooter()}`;

  const indexPath = path.join(PROVINCES_DIR, 'index.js');
  fs.writeFileSync(indexPath, body);
  const summary = countries.map((c) => `${c}:${counts[c] ?? 0}`).join(', ');
  console.log(`Wrote ${indexPath} (${summary}).`);
  if (countries.includes('US')) {
    if (forceUs) console.log('US stubs: --force-us (all US/*.province.js overwritten).');
    else console.log('US stubs: created missing files only (use --force-us to overwrite all).');
  }
}

main();
