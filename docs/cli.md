---
title: 'CLI'
description: 'Commands, flags, config files, and state on disk.'
---

# CLI

CLI package: `packages/clawdhub/` (bin: `clawdhub`).

From this repo you can run it via the wrapper script:

```bash
bun clawdhub --help
```

## Global flags

- `--workdir <dir>`: working directory (default: cwd)
- `--dir <dir>`: install dir under workdir (default: `skills`)
- `--site <url>`: base URL for browser login (default: `https://clawdhub.com`)
- `--registry <url>`: API base URL (default: discovered, else `https://clawdhub.com`)
- `--no-input`: disable prompts

Env equivalents:

- `CLAWDHUB_SITE`
- `CLAWDHUB_REGISTRY`

## Config file

Stores your API token + cached registry URL.

- macOS: `~/Library/Application Support/clawdhub/config.json`
- override: `CLAWDHUB_CONFIG_PATH`

## Commands

### `login` / `auth login`

- Default: opens browser to `<site>/cli/auth` and completes via loopback callback.
- Headless: `clawdhub login --token clh_...`

### `whoami`

- Verifies the stored token via `/api/cli/whoami`.

### `search <query...>`

- Calls `/api/search?q=...`.

### `install <slug>`

- Resolves latest version via `/api/skill?slug=...`.
- Downloads zip via `/api/download`.
- Extracts into `<workdir>/<dir>/<slug>`.
- Writes:
  - `<workdir>/.clawdhub/lock.json`
  - `<skill>/.clawdhub/origin.json`

### `list`

- Reads `<workdir>/.clawdhub/lock.json`.

### `update [slug]` / `update --all`

- Computes fingerprint from local files.
- If fingerprint matches a known version: no prompt.
- If fingerprint does not match:
  - refuses by default
  - overwrites with `--force` (or prompt, if interactive)

### `publish <path>`

- Uploads each file via `/api/cli/upload-url`.
- Publishes via `/api/cli/publish`.
- Requires semver: `--version 1.2.3`.

### `sync`

- Scans for local skill folders and publishes new/changed ones.
- Flags:
  - `--root <dir...>` extra scan roots
  - `--all` upload without prompting
  - `--dry-run` show plan only
  - `--bump patch|minor|major` (default: patch)
  - `--changelog <text>` (non-interactive)
  - `--tags a,b,c` (default: latest)
  - `--concurrency <n>` (default: 4)

Telemetry:

- Sent during `sync` when logged in, unless `CLAWDHUB_DISABLE_TELEMETRY=1`.
- Details: `docs/telemetry.md`.

