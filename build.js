#!/usr/bin/env node
/**
 * Macadam build script (esbuild).
 *   node build.js --dev   → watch + rebuild, sourcemaps, copy public/, concat css
 *   node build.js --prod  → minify, fingerprint bundle, no sourcemaps
 *
 * CSS concat order (strict): reset → tokens → themes → components → layout → animations → views/*
 * After every build: run generate-sw-manifest.js so the SW knows what to cache.
 */

const esbuild = require('esbuild');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DIST = path.join(ROOT, 'dist');
const CSS_DIR = path.join(SRC, 'css');

const isProd = process.argv.includes('--prod');
const isDev = !isProd;

const CSS_ORDER = [
  'reset.css',
  'tokens.css',
  'themes.css',
  'components.css',
  'layout.css',
  'animations.css',
  'widgets_theme.css',
];

async function ensureDist() {
  await fsp.rm(DIST, { recursive: true, force: true });
  await fsp.mkdir(DIST, { recursive: true });
}

async function copyDir(src, dst) {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}

async function copyPublic() {
  if (fs.existsSync(PUBLIC_DIR)) await copyDir(PUBLIC_DIR, DIST);
}

async function concatCss() {
  const out = [];
  out.push(`/* Macadam — concatenated stylesheet. Build: ${isProd ? 'prod' : 'dev'} */\n`);

  for (const name of CSS_ORDER) {
    const p = path.join(CSS_DIR, name);
    if (fs.existsSync(p)) {
      out.push(`/* === ${name} === */`);
      out.push(await fsp.readFile(p, 'utf8'));
      out.push('');
    }
  }

  const viewsDir = path.join(CSS_DIR, 'views');
  if (fs.existsSync(viewsDir)) {
    const viewFiles = (await fsp.readdir(viewsDir)).filter((f) => f.endsWith('.css')).sort();
    for (const name of viewFiles) {
      out.push(`/* === views/${name} === */`);
      out.push(await fsp.readFile(path.join(viewsDir, name), 'utf8'));
      out.push('');
    }
  }

  await fsp.writeFile(path.join(DIST, 'style.css'), out.join('\n'));
}

function fingerprint(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

async function renameBundleWithHash() {
  const bundlePath = path.join(DIST, 'bundle.js');
  const buf = await fsp.readFile(bundlePath);
  const hash = fingerprint(buf);
  const newName = `bundle-${hash}.js`;
  await fsp.rename(bundlePath, path.join(DIST, newName));

  const indexPath = path.join(DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = await fsp.readFile(indexPath, 'utf8');
    html = html.replace(/bundle\.js/g, newName);
    await fsp.writeFile(indexPath, html);
  }
  return newName;
}

function runSwManifest() {
  const script = path.join(ROOT, 'generate-sw-manifest.js');
  const res = spawnSync('node', [script], { stdio: 'inherit' });
  if (res.status !== 0) throw new Error('generate-sw-manifest.js failed');
}

async function postBuild() {
  await copyPublic();
  await concatCss();
  if (isProd) {
    const newName = await renameBundleWithHash();
    console.log(`[macadam] fingerprinted bundle → ${newName}`);
  }
  runSwManifest();
  console.log(`[macadam] build complete (${isProd ? 'prod' : 'dev'})`);
}

const baseOptions = {
  entryPoints: [path.join(SRC, 'main.js')],
  outfile: path.join(DIST, 'bundle.js'),
  bundle: true,
  format: 'iife',
  target: ['es2022'],
  loader: { '.js': 'js' },
  sourcemap: isDev,
  minify: isProd,
  logLevel: 'info',
};

async function buildOnce() {
  await ensureDist();
  await esbuild.build(baseOptions);
  await postBuild();
}

async function buildWatch() {
  await ensureDist();
  const ctx = await esbuild.context({
    ...baseOptions,
    plugins: [
      {
        name: 'macadam-post-build',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.errors.length) {
              console.error('[macadam] build had errors');
              return;
            }
            try {
              await postBuild();
            } catch (err) {
              console.error('[macadam] postBuild failed:', err);
            }
          });
        },
      },
    ],
  });
  await ctx.watch();
  
  fs.watch(CSS_DIR, { recursive: true }, async (eventType, filename) => {
    if (filename && filename.endsWith('.css')) {
      console.log(`[macadam] CSS changed: ${filename}`);
      try {
        await concatCss();
      } catch (err) {
        console.error('[macadam] CSS concat failed:', err);
      }
    }
  });

  console.log('[macadam] watching for changes…');
}

(async () => {
  try {
    if (isDev) {
      await buildWatch();
    } else {
      await buildOnce();
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
