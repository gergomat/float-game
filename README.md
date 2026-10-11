# Raft Game

A small ocean survival game in the spirit of Raft, built to run in the browser with Three.js.

## Play locally

```sh
npm install
npm run dev
```

Then open the printed URL (usually http://localhost:5173) and click **Click to play**.

Controls: mouse to look, WASD to move, Shift to sprint, Space to jump, swim up, or climb back onto the raft. Esc pauses.

## Deploy

Every push to `main` builds the game and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).

## Layout

- `src/waves.ts`: the wave field, shared by the ocean shader and gameplay so things float on the surface you see
- `src/ocean.ts`: endless ocean mesh and water shader
- `src/raft.ts`: tile-based raft that floats and tilts on the waves
- `src/player.ts`: first-person walking, jumping, swimming and climbing
- `src/sky.ts`: sky dome and sun
- `src/main.ts`: scene setup and game loop

## Roadmap

1. Floating (done): ocean, raft, walking, swimming
2. Hook: drifting debris and a throwable hook
3. Build: crafting and placing raft tiles
4. Survive: hunger, thirst, food and water
5. Shark
6. Polish: save/load, sound, menu
