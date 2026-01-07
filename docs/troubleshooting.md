---
title: 'Troubleshooting'
description: 'Common setup and runtime issues (CLI + backend).'
---

# Troubleshooting

## `clawdhub login` opens browser but never completes

- Ensure your browser can reach `http://127.0.0.1:<port>/callback` (local firewalls/VPNs can interfere).
- Use headless mode:
  - create a token in the web UI (Settings → API tokens)
  - `clawdhub login --token clh_...`

## `whoami` / `publish` returns `Unauthorized` (401)

- Token missing or revoked: check your config file (`CLAWDHUB_CONFIG_PATH` override?).
- Ensure requests include `Authorization: Bearer ...` (CLI does this automatically).

## `publish` fails with `OPENAI_API_KEY is not configured`

- Set `OPENAI_API_KEY` in the Convex environment (not only locally).
- Re-run `bunx convex dev` / `bunx convex deploy` after setting env.

## `sync` says “No skills found”

- `sync` looks for folders containing `SKILL.md` (or `skill.md`).
- It scans:
  - workdir first
  - then fallback roots (legacy `~/clawdis/skills`, `~/clawdbot/skills`, etc.)
- Provide explicit roots:

```bash
clawdhub sync --root /path/to/skills
```

## `update` refuses due to “local changes (no match)”

- Your local files don’t match any published fingerprint.
- Options:
  - keep local edits; skip updating
  - overwrite: `clawdhub update <slug> --force`
  - publish as fork: copy to new folder/slug then `clawdhub publish ... --fork-of upstream@version`

## `GET /api/*` works locally but not on Vercel

- Check `vercel.json` rewrite destination points at your Convex site URL.
- Ensure `VITE_CONVEX_SITE_URL` and `CONVEX_SITE_URL` match your deployment.

