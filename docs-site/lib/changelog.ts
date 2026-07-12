import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface ChangeGroup {
  heading: string;
  items: string[];
}

export interface Release {
  version: string;
  date: string | null;
  build: string | null;
  groups: ChangeGroup[];
}

// Parse CHANGELOG.md (Keep-a-Changelog style) into structured releases.
//
//   ## [1.3.1] — 2026-07-12 (versionCode 7)
//   ### Added
//   - **Thing**: detail
//
// The file is vendored to lib/changelog.md by scripts/sync-content.mjs so this
// builds even when docs-site is deployed on its own.
export function getReleases(): Release[] {
  let raw: string;
  try {
    raw = readFileSync(path.join(process.cwd(), 'lib/changelog.md'), 'utf8');
  } catch {
    return [];
  }

  const releases: Release[] = [];
  let current: Release | null = null;
  let group: ChangeGroup | null = null;

  for (const line of raw.split('\n')) {
    const rel = line.match(/^##\s+\[?([0-9][^\]\s]*)\]?\s*[—-]?\s*(\d{4}-\d{2}-\d{2})?\s*(?:\(([^)]+)\))?/);
    if (rel) {
      current = { version: rel[1], date: rel[2] ?? null, build: rel[3] ?? null, groups: [] };
      releases.push(current);
      group = null;
      continue;
    }
    if (!current) continue;

    const grp = line.match(/^###\s+(.+?)\s*$/);
    if (grp) {
      group = { heading: grp[1], items: [] };
      current.groups.push(group);
      continue;
    }

    const item = line.match(/^[-*]\s+(.+?)\s*$/);
    if (item && group) group.items.push(item[1]);
  }

  return releases;
}
