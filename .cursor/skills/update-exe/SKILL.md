---
name: update-exe
description: Builds the Windows portable EXE on the main branch with electron-builder and publishes it to a GitHub Release for the Monster Slayer repo. Use when the user says "/update-exe", "update exe", "publish the exe on GitHub", or wants to refresh the downloadable Windows build.
---

# Update EXE on GitHub (`/update-exe`)

The **website** deploy (`update-game`) pushes static files to the `gh-pages` branch. The **Windows EXE** is built from the same **`main`** branch and is distributed via **GitHub Releases**, not Pages. There is a single source-of-truth branch; no merging or cherry-picking between branches is required.

## Prerequisites

- **Windows** host (or a Windows toolchain) — `pack:win` targets Windows portable.
- Up-to-date checkout of `main` with whatever game changes you want in the desktop build.
- GitHub access: either **[GitHub CLI](https://cli.github.com/)** `gh` logged in (`gh auth login`) or the browser UI to create/upload a release.

## Build the portable EXE

From the **project root**:

```powershell
git checkout main
git pull origin main
npm ci
npm run pack:win
```

This runs `build:electron` (Vite in `--mode electron` → `dist-electron/`) then **electron-builder** with `win` → **portable** output.

- Artifacts land under **`release/`**.
- Filename pattern: **`MonsterSlayer-${version}-Portable.exe`** (version comes from `package.json`, e.g. `MonsterSlayer-1.0.8-Portable.exe`).
- `package.json` → `build` block sets `directories.output: "release"` and `artifactName`.

If the build fails, fix errors, commit on `main`, push, then rebuild.

## Publish to GitHub Releases

**Option A — GitHub CLI** (from repo root, adjust tag/version to match `package.json`):

```powershell
$v = (Get-Content package.json -Raw | ConvertFrom-Json).version
gh release upload "v$v" "release/MonsterSlayer-$v-Portable.exe" --clobber
```

If the release **`v$v`** does not exist yet, create it first:

```powershell
$v = (Get-Content package.json -Raw | ConvertFrom-Json).version
gh release create "v$v" "release/MonsterSlayer-$v-Portable.exe" --title "Monster Slayer v$v" --notes "Windows portable build"
```

**Option B — Browser:** open the repo on GitHub → **Releases** → create or edit a release → attach **`release/MonsterSlayer-<version>-Portable.exe`**.

Default repo when run inside this clone: **`woohoo-code/game`**. If `origin` points elsewhere, use that remote's GitHub URL.

## After publishing

- Remind the user that the **live site** is unchanged until they run **`/update-game`** (`npm run deploy`) if needed.

## Notes

- Do not commit **`release/`** binaries to git. They are build outputs; `.gitignore` excludes `release/` and `dist-electron/`.
- The `main` branch holds both the web code and the Electron scaffolding (`electron/main.cjs`, `build:electron` script, Vite `electron` mode, electron-builder config). No separate `exe-build` branch is used.
- If `npm ci` fails with EPERM on `esbuild.exe` / `rollup.*.node`, close any running `vite`/`npm run dev` processes and retry.
