# Golf Rogue

Mobile-first roguelike built with Phaser 3 + TypeScript + Vite.

## Core loop
Golf Solitaire (±1 rank) → build combos → damage enemy → choose relic → next fight → boss.

Suits have combat effects: ♠ damage, ♥ healing, ♦ gold, ♣ armor.

## Run
```bash
npm install
npm run dev
```

## Deploy
Import this repository into Vercel. Framework preset: Vite. Build command: `npm run build`. Output: `dist`.

## PWA
A web app manifest and standalone iOS metadata are included. On iPhone use Safari → Share → Add to Home Screen.
