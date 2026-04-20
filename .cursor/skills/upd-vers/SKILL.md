---
name: upd-vers
description: Bumps the Monster Slayer release version by one semver patch step (e.g. 1.0.0 → 1.0.1) and syncs all user-visible branding. Use when the user says "/upd-vers", "upd-vers", or asks to bump the game version by 0.01, increment patch, or tick the release number.
---

# Update version (`/upd-vers`)

In this repo, **"+0.01"** means **semver patch +1** (smallest release step): `1.0.0` → `1.0.1`, then `1.0.2`, etc.

## Steps

1. From the **project root**, bump npm version and lockfile in one step:

```powershell
npm version patch --no-git-tag-version
```

This updates `package.json` and the root entry in `package-lock.json`. Do **not** edit the lockfile by hand.

2. Read the new `version` from `package.json` (e.g. `1.0.1`).

3. Set the **release label** to the full semver with a leading `V`:

   - Edit `src/version.ts`: `export const GAME_VERSION_LABEL = "V1.0.1";` (match `major.minor.patch` exactly).

4. Sync **browser / PWA** strings to the same label:

   - `index.html`: `<title>Monster Slayer V1.0.1</title>` (reuse the same `V…` as `GAME_VERSION_LABEL`).
   - `public/manifest.webmanifest`: `"name": "Monster Slayer V1.0.1"`, and refresh `"short_name"` so it stays readable (e.g. `Slayer V1.0.1` or a shorter variant consistent with the previous line).

5. Run `npx tsc -b` (or `npm run build`) to confirm nothing broke.

6. **Do not** hand-edit built output (`dist/`, `dist-electron/`, `release/`) — those refresh on the next build.

## Notes

- `GAME_VERSION_LABEL` is imported by `App.tsx` and `WorldStatusOverlay.tsx`; keep a single source of truth in `src/version.ts`.
- If Git tags are desired after the bump, the user can run `git tag v…` separately; this skill does not require tagging.
