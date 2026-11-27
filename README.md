# New LÖVE (Love2D) + Lua Project

Clean-slate LÖVE (11.3) + Lua starter project configured for automatic `love.js` web builds.

## Structure
- `game/conf.lua` — LÖVE configuration
- `game/main.lua` — Lua entry point (`love.load`, `love.update`, `love.draw`)
- `scripts/build-web.mjs` — `love.js` web build & `.love` packaging

## Build
```bash
npm install
npm run build
```
