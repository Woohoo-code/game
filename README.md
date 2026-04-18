# Top-Down RPG PoC

Browser-first 2D top-down RPG proof of concept with:

- Overworld movement (keyboard + touch buttons)
- Random encounters
- Turn-based battle loop (attack, skill, item, run)
- Shop and inn interactions
- Progression with XP/gold/leveling
- Save/load abstraction with local persistence enabled now

## Tech

- React + TypeScript + Vite
- Phaser 3 for world rendering and input/game loop

## Run

1. Install Node.js LTS (includes `npm`) if missing.
2. Install dependencies:
   - `npm install`
3. Start dev server:
   - `npm run dev`
4. Build for production:
   - `npm run build`

## Controls

- Desktop: `WASD` or arrow keys
- Mobile: on-screen touch direction pad

## Deploy (PoC)

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`

### Vercel

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

## Notes for Phase 2

- Keep `SaveRepository` interface and replace `LocalSaveRepository` with cloud-backed implementation (Supabase/Firebase) after authentication is added.
