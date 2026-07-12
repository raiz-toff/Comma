#!/usr/bin/env node
// Single source of truth for Comma's version number: app.json → expo.version.
// Every other place that states a version must agree with it.
//
//   node scripts/version.mjs check          verify every site agrees (CI runs this)
//   node scripts/version.mjs sync           realign stragglers to app.json, nothing else
//   node scripts/version.mjs bump 1.4.0     new release: every site + versionCode++ + CHANGELOG
//
// sync and bump are deliberately different. bump increments versionCode, which Play
// requires to increase on every upload — doing that while merely repairing drift would
// desync from the build already on the store.
//
// Why a script and not a checklist: the versions drifted to 1.3.1 / 1.0.0 / 1.3.0
// across four files while a hand-kept checklist said "keep these in step by hand".

import { promises as fs, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (rel) => path.join(ROOT, rel);
const read = (rel) => fs.readFile(p(rel), 'utf8');
const write = (rel, s) => fs.writeFile(p(rel), s);

const SEMVER = /^\d+\.\d+\.\d+$/;

// Each site: how to read the version out of the file, and how to write it back.
// `optional` = the file is git-ignored (android/ is Expo-managed and untracked),
// so it exists on a build machine but never in CI. Absent means skipped, not failed.
const SITES = [
  {
    file: 'app.json',
    label: 'expo.version',
    source: true, // the one everything else follows
    get: (s) => s.match(/"version":\s*"([^"]+)"/)?.[1],
    set: (s, v) => s.replace(/("version":\s*")[^"]+(")/, `$1${v}$2`),
  },
  {
    file: 'package.json',
    label: 'version',
    // Only the first "version" key — the top-level one, before dependencies.
    get: (s) => s.match(/"version":\s*"([^"]+)"/)?.[1],
    set: (s, v) => s.replace(/("version":\s*")[^"]+(")/, `$1${v}$2`),
  },
  {
    file: 'web/src/modules/changelog/changelog.js',
    label: 'APP_VERSION',
    // Drives the web "What's New" modal and window.__comma.version in support reports.
    get: (s) => s.match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1],
    set: (s, v) => s.replace(/(APP_VERSION\s*=\s*')[^']+(')/, `$1${v}$2`),
  },
  {
    file: 'CHANGELOG.md',
    label: 'latest release heading',
    // The docs site renders this file verbatim at /changelog, so the newest
    // heading here IS the version the world sees.
    get: (s) => s.match(/^##\s*\[([^\]]+)\]/m)?.[1],
    set: null, // written by `bump`, which adds a whole entry rather than editing one
  },
  {
    file: 'android/app/build.gradle',
    label: 'versionName',
    optional: true,
    get: (s) => s.match(/versionName\s+"([^"]+)"/)?.[1],
    set: (s, v) => s.replace(/(versionName\s+")[^"]+(")/, `$1${v}$2`),
  },
];

async function collect() {
  const found = [];
  for (const site of SITES) {
    if (!existsSync(p(site.file))) {
      if (site.optional) continue;
      throw new Error(`missing ${site.file}`);
    }
    const text = await read(site.file);
    found.push({ ...site, text, version: site.get(text) });
  }
  return found;
}

async function check() {
  const sites = await collect();
  const truth = sites.find((s) => s.source).version;

  if (!truth || !SEMVER.test(truth)) {
    console.error(`✗ app.json expo.version is "${truth}" — not a valid semver`);
    process.exit(1);
  }

  const bad = sites.filter((s) => s.version !== truth);
  const width = Math.max(...sites.map((s) => s.file.length));

  for (const s of sites) {
    const ok = s.version === truth;
    console.log(
      `${ok ? '✓' : '✗'} ${s.file.padEnd(width)}  ${s.version ?? '(not found)'}  ${s.label}`,
    );
  }

  if (bad.length) {
    console.error(
      `\n✗ ${bad.length} file(s) disagree with app.json (${truth}).\n` +
        `  Repairing drift?   node scripts/version.mjs sync\n` +
        `  Cutting a release? node scripts/version.mjs bump <x.y.z>`,
    );
    process.exit(1);
  }

  console.log(`\n✓ all version sites agree on ${truth}`);
}

// Rewrite every follower site to `next`. Shared by sync and bump.
async function setVersions(sites, next) {
  for (const s of sites) {
    if (!s.set) continue;
    const updated = s.set(s.text, next);
    if (updated !== s.text) {
      await write(s.file, updated);
      console.log(`  ${s.file} — ${s.label}: ${s.version} → ${next}`);
    }
  }
}

// Repair drift: pull every follower up to app.json. Touches no versionCode and
// writes no CHANGELOG entry — nothing is being released.
async function sync() {
  const sites = await collect();
  const truth = sites.find((s) => s.source).version;
  const bad = sites.filter((s) => s.version !== truth && s.set);

  if (!bad.length) {
    console.log(`✓ already in sync on ${truth} — nothing to do`);
    return;
  }

  await setVersions(sites, truth);
  console.log(`\n✓ realigned ${bad.length} file(s) to ${truth}`);
}

async function bump(next) {
  if (!SEMVER.test(next)) {
    console.error(`✗ "${next}" is not a valid semver (expected x.y.z)`);
    process.exit(1);
  }

  const sites = await collect();
  const current = sites.find((s) => s.source).version;

  await setVersions(sites, next);

  // versionCode is an integer Play requires to increase on every upload. It is
  // NOT derived from the semver, so bump it independently — and only locally,
  // since android/ is git-ignored.
  const gradle = 'android/app/build.gradle';
  if (existsSync(p(gradle))) {
    const text = await read(gradle);
    const code = Number(text.match(/versionCode\s+(\d+)/)?.[1]);
    if (Number.isFinite(code)) {
      await write(gradle, text.replace(/(versionCode\s+)\d+/, `$1${code + 1}`));
      console.log(`  ${gradle} — versionCode: ${code} → ${code + 1}`);
    }
  } else {
    console.log(`  ${gradle} — absent (not a build machine); bump versionCode there before you build`);
  }

  // Open a CHANGELOG entry. The docs site renders CHANGELOG.md at /changelog,
  // so this is also how the release reaches the website — no second step.
  const changelog = await read('CHANGELOG.md');
  if (!changelog.includes(`## [${next}]`)) {
    const today = new Date().toISOString().slice(0, 10);
    const entry = `## [${next}] — ${today}\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n\n`;
    const at = changelog.search(/^## \[/m);
    await write(
      'CHANGELOG.md',
      at === -1 ? changelog.trimEnd() + '\n\n' + entry : changelog.slice(0, at) + entry + changelog.slice(at),
    );
    console.log(`  CHANGELOG.md — added a [${next}] entry (fill it in, delete empty sections)`);
  }

  console.log(
    `\n✓ ${current} → ${next}\n` +
      `  Next: write the CHANGELOG entry, then refresh the web What's New highlights\n` +
      `  in web/src/modules/changelog/changelog.js so they describe ${next}.`,
  );
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'check') await check();
else if (cmd === 'sync') await sync();
else if (cmd === 'bump' && arg) await bump(arg);
else {
  console.error('usage: node scripts/version.mjs check | sync | bump <x.y.z>');
  process.exit(1);
}
