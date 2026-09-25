# Golf Rogue: visual assets & licenses

All assets used by `visual/mockup/*` (and proposed for the game). Every entry allows **commercial use** and **redistribution in a public GitHub repo**. License files sit next to the assets where the license asks for them.

## Fonts (`visual/mockup/fonts/`)
| File | Font | Source | License | Notes |
|---|---|---|---|---|
| `LilitaOne-Regular.ttf` | Lilita One, © 2011 Juan Montoreano (Reserved Font Name "Lilita") | https://fonts.google.com/specimen/Lilita+One · https://github.com/google/fonts/tree/main/ofl/lilitaone | SIL OFL 1.1 (`lilitaone_OFL.txt`) | Display/numbers. Latin only. Bundling and embedding allowed. The font can't be sold on its own, and a modified version can't keep the name "Lilita". |
| `Fredoka-Variable.ttf` | Fredoka, © 2016 The Fredoka Project Authors | https://fonts.google.com/specimen/Fredoka · https://github.com/google/fonts/tree/main/ofl/fredoka | SIL OFL 1.1 (`fredoka_OFL.txt`) | UI/body, wght 300–700. Latin + Hebrew. |
| `Rubik-Variable.ttf` | Rubik, © 2015 The Rubik Project Authors | https://fonts.google.com/specimen/Rubik · https://github.com/google/fonts/tree/main/ofl/rubik | SIL OFL 1.1 (`rubik_OFL.txt`) | Cyrillic fallback (RU locale), wght 300–900. |
`*_METADATA.pb` files are the Google Fonts metadata, kept as proof of license and subsets (checked 2026-09-25).

## Icons (`visual/mockup/icons/`, compiled into `mockup/sprite.js`)
Source: **game-icons.net**, repo https://github.com/game-icons/icons. License: **CC BY 3.0** (https://creativecommons.org/licenses/by/3.0/), verified on https://game-icons.net/about.html on 2026-09-25.
**Required credit** (game credits screen + README):
> Icons by Lorc, Delapouite, sbed and Carl Olsen, from https://game-icons.net, licensed CC BY 3.0.

| Sprite id | File | Author | Page |
|---|---|---|---|
| `i-sword` (♠ glyph, intent) | `lorc_broadsword.svg` | Lorc | https://game-icons.net/1x1/lorc/broadsword.html |
| `i-swords` (card back, progress) | `lorc_crossed-swords.svg` | Lorc | https://game-icons.net/1x1/lorc/crossed-swords.html |
| `i-shield` (♣ glyph, GUARD) | `lorc_checked-shield.svg` | Lorc | https://game-icons.net/1x1/lorc/checked-shield.html |
| `i-coins` (♦ glyph, GOLD) | `delapouite_two-coins.svg` | Delapouite | https://game-icons.net/1x1/delapouite/two-coins.html |
| `i-bomb` (BOMB) | `lorc_unlit-bomb.svg` | Lorc | https://game-icons.net/1x1/lorc/unlit-bomb.html |
| `i-heart-shine` (HEAL power) | `lorc_shining-heart.svg` | Lorc | https://game-icons.net/1x1/lorc/shining-heart.html |
| `i-crit` (CRIT) | `lorc_sword-wound.svg` | Lorc | https://game-icons.net/1x1/lorc/sword-wound.html |
| `i-echo` (ECHO) | `lorc_echo-ripples.svg` | Lorc | https://game-icons.net/1x1/lorc/echo-ripples.html |
| `i-joker` (WILD) | `delapouite_card-joker.svg` | Delapouite | https://game-icons.net/1x1/delapouite/card-joker.html |
| `i-cog` (settings) | `lorc_cog.svg` | Lorc | https://game-icons.net/1x1/lorc/cog.html |
| `i-orb` (relic) | `lorc_crystal-ball.svg` | Lorc | https://game-icons.net/1x1/lorc/crystal-ball.html |
| `i-pendant` (relic) | `lorc_gem-pendant.svg` | Lorc | https://game-icons.net/1x1/lorc/gem-pendant.html |
| `i-skull` (boss node) | `lorc_horned-skull.svg` | Lorc | https://game-icons.net/1x1/lorc/horned-skull.html |
| `i-flame` (status: enraged) | `carl-olsen_flame.svg` | Carl Olsen | https://game-icons.net/1x1/carl-olsen/flame.html |
| `i-heal` (spare) | `sbed_health-increase.svg` | sbed | https://game-icons.net/1x1/sbed/health-increase.html |
| `i-sparkles`, `i-map`, `i-gem`, `i-burst`, `i-hourglass`, `i-trophy`, `i-bolt` (spares for relics/VFX) | `delapouite_sparkles.svg`, `lorc_treasure-map.svg`, `lorc_cut-diamond.svg`, `lorc_crowned-explosion.svg`, `lorc_sands-of-time.svg`, `lorc_trophy.svg`, `lorc_lightning-frequency.svg` | Delapouite / Lorc | https://game-icons.net/1x1/<author>/<name>.html |

## Character sprites (`visual/mockup/assets/`, cropped single frames from `sprites/segel2d-chibi-monsters/`)
Author: **Segel (Segel2D)**, OpenGameArt. The full per-character table is in `enemy-sprites/LICENSES.md`.
| File | Source frame | OGA page | License |
|---|---|---|---|
| `goblin_idle.png` (battle), `goblin_attack.png` (start) | 2D CHIBI GOBLIN, Idle_000 / Attack_003 | https://opengameart.org/content/2d-goblin-chibi | **CC-BY 3.0 / OGA-BY 3.0** (re-verified on the page 2026-09-25). Credit needed. |
| `bat_idle.png` (start) | Bat02 Idle_000 | https://opengameart.org/content/2d-monster-bat-enemy | **CC-BY 3.0 / OGA-BY 3.0**. Credit needed. |
| `slime_idle.png` (start) | SLIME04 Idle_000 | https://opengameart.org/content/adventurer-and-slime-game-sprites | CC0 |
| `wolf_idle.png`, `mushroom_idle.png` (spare) | Wolf / Mushroom Idle_000 | https://opengameart.org/content/wolf-game-character · https://opengameart.org/content/little-monster-mushroom | CC0 |
Credit line: *"Character art by Segel (Segel2D), OpenGameArt.org, CC-BY 3.0: 2D Goblin Chibi, 2D Monster Bat Enemy."*

## Original project art (no third-party rights)
Made for Golf Rogue in this mockup and owned by the project (can go into the repo under the project license):
- Arena background SVGs (sky, sun, clouds, mountains, tent, palisade, torches, ground, arena disc) inline in `battle.html` / `start.html`
- Suit symbols `s-spade|heart|club|diamond`, heal plus `i-plus`, coin `i-coin`, shield badge, combo flame medallion, flame licks, logo treatment, card back, all CSS UI (cards, chips, bars, buttons)

## Reference screenshots (`visual/refs/`): **do not ship, do not commit**
Balatro, Slay the Spire 1/2, Marvel Snap (Steam store screenshots) and Clash Royale, Brawl Stars, Hearthstone, Marvel Snap (App Store screenshots). All © their publishers, downloaded only for internal art-direction research. Add `visual/refs/` to `.gitignore`.
