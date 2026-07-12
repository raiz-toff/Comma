#!/usr/bin/env node
/**
 * Direct Google Play submission — no EAS, no fastlane, no deps.
 *
 * Auths with the service account key, then drives the Play Developer API:
 * create edit → upload AAB → assign track → commit.
 *
 * Usage:
 *   node scripts/submit-play.mjs [--aab <path>] [--track internal|alpha|beta|production] [--dry-run]
 *
 * --dry-run stops after creating (and deleting) an edit — proves the key,
 * API enablement, and app permissions without uploading or releasing anything.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';

const PACKAGE = 'app.comma.tracker';
const KEY_PATH = new URL('../secrets/play-service-account.json', import.meta.url);
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const dryRun = args.includes('--dry-run');
const track = flag('track', 'internal');
const aabPath = flag('aab', 'android/app/build/outputs/bundle/release/app-release.aab');

const b64url = (buf) => Buffer.from(buf).toString('base64url');

async function getAccessToken() {
  const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: key.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(key.private_key))}`;

  const res = await fetch(key.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function api(token, method, path, body, contentType) {
  const base = contentType === 'application/octet-stream' ? API.replace('/androidpublisher/v3/', '/upload/androidpublisher/v3/') : API;
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body: body ?? undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

const token = await getAccessToken();
console.log('✓ authenticated as service account');

const edit = await api(token, 'POST', '/edits');
console.log(`✓ edit created (${edit.id})`);

if (dryRun) {
  await api(token, 'DELETE', `/edits/${edit.id}`);
  console.log('✓ dry run OK — key, API, and app permissions all work. Edit deleted, nothing changed.');
  process.exit(0);
}

console.log(`… uploading ${aabPath} (this can take a few minutes)`);
const aab = readFileSync(aabPath);
const bundle = await api(token, 'POST', `/edits/${edit.id}/bundles?uploadType=media`, aab, 'application/octet-stream');
console.log(`✓ uploaded — versionCode ${bundle.versionCode}`);

await api(
  token,
  'PUT',
  `/edits/${edit.id}/tracks/${track}`,
  JSON.stringify({ releases: [{ versionCodes: [String(bundle.versionCode)], status: 'completed' }] }),
  'application/json',
);
console.log(`✓ assigned to "${track}" track`);

await api(token, 'POST', `/edits/${edit.id}:commit`);
console.log(`✅ committed — versionCode ${bundle.versionCode} is live on the "${track}" track.`);
