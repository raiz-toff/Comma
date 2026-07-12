# CLAUDE.md

The rules for this repository live in one file, so they cannot drift apart. Read it now:

@AGENTS.md

The three that break users' data if you get them wrong:

1. **Comma is two apps sharing one vault** (phone `src/` + web `web/src/`). Touching sync,
   schema, crypto, or the country registry on one side means handling its twin on the other.
   See AGENTS.md §1.
2. **Version numbers come from `node scripts/version.mjs`**, never from hand-editing files.
3. **Every user-visible change gets a `CHANGELOG.md` entry in the same commit** — that file
   is published as the `/changelog` page on the docs site.

Before reporting a change complete, run the checklist at the bottom of AGENTS.md.
