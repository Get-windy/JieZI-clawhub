---
title: 'HTTP API'
description: 'Public endpoints + CLI endpoints (token auth).'
---

# HTTP API

Base URL: `https://clawdhub.com` (default).

All paths below are under `/api/...` and implemented by Convex HTTP routes (`convex/http.ts`).

## Public endpoints (no auth)

### `GET /api/search`

Query params:

- `q` (required): query string
- `limit` (optional): integer
- `approvedOnly` (optional): `true` to filter to approved-only skills (server may treat as “approved”/badged)

Response:

```json
{ "results": [{ "score": 0.123, "slug": "gifgrep", "displayName": "GifGrep", "summary": "…", "version": "1.2.3", "updatedAt": 1730000000000 }] }
```

### `GET /api/skill`

Query params:

- `slug` (required)

Response (shape is stable; contents may expand):

```json
{ "skill": { "slug": "gifgrep", "displayName": "GifGrep", "summary": "…", "tags": { "latest": "…" }, "stats": {}, "createdAt": 0, "updatedAt": 0 }, "latestVersion": { "version": "1.2.3", "createdAt": 0, "changelog": "…" }, "owner": { "handle": "steipete", "displayName": "Peter", "image": null } }
```

### `GET /api/skill/resolve`

Used by the CLI to map a local fingerprint to a known version.

Query params:

- `slug` (required)
- `hash` (required): 64-char hex sha256 of the bundle fingerprint

Response:

```json
{ "slug": "gifgrep", "match": { "version": "1.2.2" }, "latestVersion": { "version": "1.2.3" } }
```

### `GET /api/download`

Downloads a zip of a skill version.

Query params:

- `slug` (required)
- `version` (optional): semver string
- `tag` (optional): tag name (e.g. `latest`)

Notes:

- If neither `version` nor `tag` is provided, the latest version is used.
- Soft-deleted versions return `410`.

## CLI endpoints (Bearer token)

All CLI endpoints require:

```
Authorization: Bearer clh_...
```

### `GET /api/cli/whoami`

Validates token and returns the user handle.

### `POST /api/cli/upload-url`

Returns a Convex upload URL for a single file upload.

Response:

```json
{ "uploadUrl": "https://..." }
```

### `POST /api/cli/publish`

Publishes a new version from uploaded files.

- Validates semver, slug, size limits, text-only files, and `SKILL.md`.
- Generates embeddings (requires `OPENAI_API_KEY` server-side).

### `POST /api/cli/telemetry/sync`

Used by `clawdhub sync` to report install telemetry.

Details: `docs/telemetry.md`.

### `POST /api/cli/skill/delete` / `POST /api/cli/skill/undelete`

Soft-delete / restore a skill (owner/admin only).

## Registry discovery (`/.well-known/clawdhub.json`)

The CLI can discover registry/auth settings from the site:

- `/.well-known/clawdhub.json` (JSON)

Schema:

```json
{ "apiBase": "https://clawdhub.com", "authBase": "https://clawdhub.com", "minCliVersion": "0.0.5" }
```

If you self-host, serve this file (or set `CLAWDHUB_REGISTRY` explicitly).

