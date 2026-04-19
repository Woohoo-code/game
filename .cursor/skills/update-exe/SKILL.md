---
name: update-exe
description: Builds the Windows portable EXE on the exe-build branch with electron-builder and publishes it to a GitHub Release for the Monster Slayer repo. Use when the user says "/update-exe", "update exe", "publish the exe on GitHub", or wants to refresh the downloadable Windows build.
---

# Update EXE on GitHub (`/update-exe`)

The **website** deploy (`update-game`) pushes static files to the `gh-pages` branch. The **Windows EXE** is built separately on the **`exe-build`** branch and is distributed via **GitHub Releases**, not Pages.

## Prerequisites

- **Windows** host (or a Windows toolchain) — `pack:win` targets Windows portable.
- **`exe-build`** branch present and up to date with changes you want in the desktop build.

**Do not** run `git merge origin/3d-prototype` on `exe-build` without resolving conflicts: a **fast-forward** can replace the whole branch with the web-only tree and **delete `electron/` and Electron `package.json` scripts**. Bring game changes over with a **merge that keeps Electron** (resolve `package.json` / `vite.config.ts` / `electron/`) or cherry-pick commits selectively.
- GitHub access: either **[GitHub CLI](https://cli.github.com/)** `gh` logged in (`gh auth login`) or the browser UI to create/upload a release.

## Build the portable EXE

From the **project root**:

```powershell
git checkout exe-build
git pull origin exe-build
npm ci
npm run pack:win
```

This runs `build:electron` then **electron-builder** with `win` → **portable** output.

- Artifacts land under **`release/`**.
- Filename pattern: **`MonsterSlayer-${version}-Portable.exe`** (version comes from `package.json`, e.g. `MonsterSlayer-1.0.0-Portable.exe`).
- Builder config on this branch uses `directories.output: "release"` and `artifactName` as in `package.json`.

If the build fails, fix errors, commit on `exe-build`, push, then rebuild.

## Publish to GitHub Releases

**Option A — GitHub CLI** (from repo root, adjust tag/version to match `package.json`):

```powershell
$v = (Get-Content package.json -Raw | ConvertFrom-Json).version
gh release upload "v$v" "release/MonsterSlayer-$v-Portable.exe" --clobber
```

If the release **`v1.0.0`** does not exist yet, create it first:

```powershell
$v = (Get-Content package.json -Raw | ConvertFrom-Json).version
gh release create "v$v" "release/MonsterSlayer-$v-Portable.exe" --title "Monster Slayer v$v" --notes "Windows portable build"
```

**Option B — Browser:** open the repo on GitHub → **Releases** → create or edit a release → attach **`release/MonsterSlayer-<version>-Portable.exe`**.

Default repo when run inside this clone: **`woohoo-code/game`**. If `origin` points elsewhere, use that remote’s GitHub URL.

## After publishing

- Optionally push commits on **`exe-build`** if the skill run included source changes:

```powershell
git push origin exe-build
```

- Remind the user that the **live site** is unchanged until they run **`/update-game`** (`npm run deploy`) on the web branch if needed.

## Notes

- Do not commit **`release/`** binaries to git unless the project explicitly version-controls them (default: they are build outputs; `.gitignore` may already exclude them).
- **`3d-prototype`** is web-only; Electron entry (`electron/main.cjs`, `build:electron`, Vite `electron` mode) exists on **`exe-build`** only.
