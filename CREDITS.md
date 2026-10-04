# Golf Rogue - Credits & Licenses

## Character Sprites

**Artist:** Segel (Segel2D)
**Source:** OpenGameArt.org

### CC-BY 3.0 Licensed Characters
These characters require attribution under Creative Commons Attribution 3.0:

- **Cave Bat** - https://opengameart.org/content/2d-monster-bat-enemy
- **Goblin Thief** - https://opengameart.org/content/2d-goblin-chibi
- **Highway Bandit** - https://opengameart.org/content/2d-goblin-chibi
- **Dark Knight** - https://opengameart.org/content/2d-knight-chibi

### CC0 Licensed Characters (Public Domain)
No attribution required, but credit given:

- **Green Slime** - https://opengameart.org/content/adventurer-and-slime-game-sprites
- **Spore Shroom** - https://opengameart.org/content/little-monster-mushroom
- **Dire Wolf** - https://opengameart.org/content/wolf-game-character
- **Undead** - https://opengameart.org/content/2d-zombie-chibi
- **The Golf King (Samurai)** - https://opengameart.org/content/2d-samurai-chibi

### CraftPix chibi monsters (OGA-BY 3.0)
Credit:

> Chibi monster sprites by CraftPix.net (https://craftpix.net), via OpenGameArt.org, licensed OGA-BY 3.0: Orc, Ogre and Goblin Chibi Sprites; Reaper Man Chibi Sprites; Fallen Angel Chibi Sprites.

- License: OGA-BY 3.0, https://static.opengameart.org/OGA-BY-3.0.txt
- Orc, Ogre and Goblin Chibi Sprites: https://opengameart.org/content/orc-ogre-and-goblin-chibi-sprites (Goblin Scrapper, Orc Brute, Ogre Crusher, Ogre Warlord)
- Reaper Man Chibi Sprites: https://opengameart.org/content/reaper-man-chibi-sprites (Soul Reaper, Grave Reaper, Reaper Lord)
- Fallen Angel Chibi Sprites: https://opengameart.org/content/fallen-angel-chibi-sprites (Fallen Knight, Fallen Squire, Fallen Seraph)
- Files: `public/assets/enemies/atlases/c_*.webp|json`. Modified: frames picked from the PNG sequences, trimmed, resized to 160 px cells, packed into WebP atlases (`scripts/build-chibi-atlases.sh`), tinted per act in game.

---

## Icons

**Source:** game-icons.net
**License:** CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/)

### Icon Authors
- **Lorc** - broadsword, checked-shield, crossed-swords, shining-heart, sword-wound, echo-ripples, unlit-bomb, cog, horned-skull, crystal-ball, gem-pendant, crowned-explosion, sands-of-time, treasure-map, cut-diamond, trophy, lightning-frequency
- **Delapouite** - two-coins, card-joker, sparkles
- **sbed** - health-increase
- **Carl Olsen** - flame

---

## Fonts

All fonts are licensed under SIL Open Font License 1.1, which permits commercial use and redistribution.

- **Lilita One** - © 2011 Juan Montoreano (Google Fonts)
- **Fredoka** - © 2016 The Fredoka Project Authors (Google Fonts)
- **Rubik** - © 2015 The Rubik Project Authors (Google Fonts)

---

## Audio

### Castle Solitaire current defaults

Music by YannZ – https://yannz41.itch.io
Spotify: https://open.spotify.com/intl-it/artist/76CUcHd0t0XViSm9YBbHBw
Contact: yziango@gmail.com

**Pack:** [Contemplative Fantasy Music Pack, Vol. 1: Lucid](https://yannz41.itch.io/contemplative-fantasy-music-pack).
The first three “Déjà Vus” loops remain in `public/audio/lucid-v1/` as archived
configurator options. The current default music and matching effects were supplied
by the user in the SFX folder and copied into `public/audio/user-sfx-v1/`.
Original OGG bytes and embedded metadata are preserved in the archived loops.
The pack's indie project license requires attribution and prohibits standalone
audio redistribution; see `public/audio/lucid-v1/LICENSE.txt` for the full terms.

Soft weapon and foley cues use Kenney's [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds)
and [RPG Audio](https://kenney.nl/assets/rpg-audio), both CC0. Existing Chequered Ink
recordings are retained for other cues and as source material for softened bow,
turret, mortar and castle impact sounds. Chequered Ink's **400 Sounds Pack** allows
commercial project use and is not CC0; see `public/audio/ci-v1/LICENSE.md`.

Processing details and exact source mappings:
[RECORDED_AUDIO_CREDITS.md](public/audio/RECORDED_AUDIO_CREDITS.md).

### Legacy Golf Rogue audio

**Artist:** Kenney (kenney.nl)
**License:** CC0 1.0 (Public Domain Dedication)
**Source:** https://kenney.nl/assets

Sound effects used from:
- **Casino Audio** (https://kenney.nl/assets/casino-audio)
  - card-tap-1/2/3 (card play and draw sounds, trimmed recordings)
  - chips-stack-3 (reward pickup)
- **Interface Sounds** (https://kenney.nl/assets/interface-sounds)
  - click_002 (button tap)
  - error_004 (invalid action)
  - maximize_006 (combo tier up)
- **Impact Sounds** (https://kenney.nl/assets/impact-sounds)
  - impactPunch_medium_000 (enemy hit)
  - impactPunch_heavy_001 (player hit)
  - impactMetal_light_002 (shield gain)
  - impactPlate_heavy_000 (enemy death)
- **Music Jingles** (https://kenney.nl/assets/music-jingles)
  - jingles_PIZZI03 (victory)
  - jingles_PIZZI16 (defeat)

No attribution required (CC0), but credit given to support the creator.

---

## Attribution Notice

When using this project's assets, please include the following credit:

```
Character art by Segel (Segel2D), OpenGameArt.org.
Icons by Lorc, Delapouite, sbed, and Carl Olsen from https://game-icons.net, licensed CC BY 3.0.
Sound effects by Kenney (kenney.nl), CC0.
Additional sound recordings by Chequered Ink, https://ci.itch.io/400-sounds-pack.
Music by YannZ – https://yannz41.itch.io
Spotify: https://open.spotify.com/intl-it/artist/76CUcHd0t0XViSm9YBbHBw
Contact: yziango@gmail.com
```
