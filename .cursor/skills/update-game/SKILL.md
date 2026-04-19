---
name: update-game
description: Deploy the Monster Slayer game to GitHub Pages by running npm run deploy. Use when the user says "update game", "deploy", "push to GitHub Pages", "publish", or "/update-game".
---

# Update Game

Builds and deploys the game to GitHub Pages in one step.

## Steps

1. Run the deploy command from the project root:

```powershell
npm run deploy
```

This runs `predeploy` (which calls `npm run build`) then pushes `dist/` to the `gh-pages` branch automatically.

2. Confirm success — output should end with `Published`.

3. Optionally commit and push any source changes to `main`:

```powershell
git add -A
git commit -m "<describe changes>"
git push origin main
```

## Live URL

https://woohoo-code.github.io/game/

## Notes

- `npm run deploy` handles the build step — no need to run `npm run build` separately.
- The `gh-pages` branch is managed automatically; never commit to it directly.
- GitHub Pages takes ~30–60 seconds to reflect a new deploy.
- Source of truth is the single `main` branch. It contains both the web code and the Electron scaffolding, so `/update-exe` runs from the same branch.
