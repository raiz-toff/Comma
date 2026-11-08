# CLAUDE.md

The rules for this repository live in one file, so they cannot drift apart. Read it now:

@AGENTS.md

The three that break users' data if you get them wrong:

1. **Old vaults must keep opening.** Drivers' Google Drive files were written by older app
   versions, and two phones on one account can run different versions. Touching sync,
   schema, crypto, or the country registry needs care for both. See AGENTS.md §1.
2. **Version numbers come from `node scripts/version.mjs`**, never from hand-editing files.
3. **Every user-visible change gets a `CHANGELOG.md` entry in the same commit.**

Before reporting a change complete, run the checklist at the bottom of AGENTS.md.
