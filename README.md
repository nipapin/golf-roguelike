# Golf Rogue

Responsive roguelike built with Phaser 3 + TypeScript + Vite.

## Desktop play

On Windows, double-click `Запустить игру.cmd`. Landscape windows at least 900px wide
use the full screen: the siege arena sits above seven card columns. Castle HP
and armor sit above the closed stock and active card in the panel on the right.
Tap the stock to draw; the small reverse arrow beside it provides undo. The UI scales
proportionally from a 1280×720 reference; narrower and portrait windows retain
the mobile layout. Resizing a running game keeps its siege state.
Castle Studio's game preview has **ПК / Телефон** controls for both layouts.

## Animation previews

With the dev server running, open
`/assets/generated-animations-v1/all-animations.html` for the complete sprite
catalog, including imported castle/troop animations, new poses and combat effects.
It supports action selection, pause, speed and single-frame stepping.
`/assets/generated-animations-v1/preview.html` is the empty missing-animation page.

## Local asset configurator

On Windows, double-click `Запустить конфигуратор.cmd` or run `npm run configurator`.
Castle Studio edits individual sound events, music, images, atlases, fonts and UI colors,
with previews, persistent project settings, original-file recovery and an embedded game preview.
See [CONFIGURATOR.md](CONFIGURATOR.md) for the Russian usage guide.

## Castle gameplay and presentation

Play adjacent ranks (±1) without A ↔ K wrapping; Q ↔ K remains legal. WILD
allows any next rank. Build a chain, then tap the closed stock to release its banked defenders. All five defender rewards are available from the first chain;
castle growth and a new upgrade economy are deferred.
Rewards repeat every five cards: soldiers at 1/6/11, archers at 2/7/12,
turret magazines at 3/8/13, cannon damage at 4/9/14 and laser damage at 5/10/15.
Drawing from the stock releases the banked rewards. A ten-card chain deploys two soldier squads
and two archers, loads two magazines into one turret, and grants double damage
to one cannon and one laser blast. Workshop bonuses apply before these multipliers.
Undo restores the complete state before a card play or draw, including defenders,
rewards, stock and siege time. Multiple undos and their history survive a reload;
undo is free and unlimited while previous steps exist, including draws and WILD. Settled
victory/defeat results are final. HEAL / BOMB / ECHO cost 30 / 100 / 50 gold
and can each be used once per round. Victory carries gold, HP and armor into
the next round; defeat starts a fresh run. Each new board has two GUARD cards
(1 armor, or 5 with a 20% chance) and one WILD;
reshuffling removes buffs from recycled waste while preserving powers on the field. Jokers and CRIT are removed from castle play.
The closed stock glows when there are no legal plays. Once it is empty, finish
any available chain and explicitly tap the empty stock, marked with a shuffle
arrow and a heart, to recycle the discard for 5 HP. Cards fly between the stock
and active slot; recycling never starts
automatically and the tableau is preserved.

New games deal five cards in each of seven columns, with one active card and
16 cards in stock. Enemies emerge from portals at 10–50% of the screen width,
stay on the ground and scale from half size in the distance to full size in
the foreground. Bosses damage HP through armor. Prepared enemy animations
cover walking, attacks, hits and death; the cannon begins targeting after
enemies cross the middle of the screen.

The stock and active card share the same size and have no captions. Below them,
COMBO and the current chain multiplier sit above the reward gems and abilities.
Brief combo and supermonster announcements appear above the upper card row.
The interface includes card flight and hover animations, reward bursts, contextual
character reactions and a restrained laser sweep. Reduced-effects settings also
disable ambient motes and camera shake. User-supplied audio in `public/audio/user-sfx-v1/`
provides separate menu and battle loops, card sounds, weapons and powers. Weapon,
critical and placement takes vary without consecutive repeats. Soldiers deploy
with footsteps; archers, turrets and cannons use placement cues. Audio events and
both music tracks are individually configurable in Castle Studio.
Audio sources and licenses are in [CREDITS.md](CREDITS.md) and
[the audio notes](public/audio/RECORDED_AUDIO_CREDITS.md).

## Run
```bash
npm install
npm run dev
```

## Deploy
Import this repository into Vercel. Framework preset: Vite. Build command: `npm run build`. Output: `dist`.

## PWA
A web app manifest and standalone iOS metadata are included. On iPhone use Safari → Share → Add to Home Screen.
