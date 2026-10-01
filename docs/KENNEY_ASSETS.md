# Castle Solitaire — asset provenance

The castle mode uses a coherent Kenney low-poly diorama style. GLB models are rendered offline with directional lighting and soft shadows; the game still runs in Phaser 2D. Character atlases preserve the model's authored idle, walking, melee, reaction and death animations.

| Asset | Author / source | License |
| --- | --- | --- |
| Castle, gate, flag, landscape | Kenney, [Castle Kit](https://kenney.nl/assets/castle-kit) | CC0 |
| Turret and mortar models | Kenney, [Tower Defense Kit](https://kenney.nl/assets/tower-defense-kit) | CC0 |
| Animated human and orc | Kenney, [Mini Dungeon](https://kenney.nl/assets/mini-dungeon) | CC0 |
| Short card slides and shuffle | Kenney, [Casino Audio](https://kenney.nl/assets/casino-audio) | CC0 |
| Footsteps | Kenney, [RPG Audio](https://kenney.nl/assets/rpg-audio) | CC0 |
| Laser | Kenney, [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds) | CC0 |
| Orc growl, grunt, death | Tim Rockk, [Orc Voice](https://opengameart.org/content/orc-voice) | CC0 |
| Turret and mortar recordings | kurt, [Gunshots](https://opengameart.org/content/gunshots), .22 pistol / black powder | CC0 |
| Orchestral combat loop | MintoDog, [Hope](https://opengameart.org/content/hopeorchestral-battle-music) | CC0 |
| Layered recorded impacts / power cues | Kenney, [Impact Sounds](https://kenney.nl/assets/impact-sounds) | CC0 |

Kenney license files are included in `public/assets/kenney/licenses`. Existing attributed VFX remain under their original license in the game's credits.

## Rebuilding art

Unzip the Kenney packs into `PACK_ROOT/{castle,tower,dungeon}`. With Blender 4.3+:

```sh
blender -b -t 4 --python scripts/render-kenney.py -- PACK_ROOT OUTPUT_DIR
```

`scripts/pack-kenney.py PACK_ROOT PUBLIC_DIR` assembles WebP atlases and audio. Put the source audio packs in `PACK_ROOT/{casino,rpg,scifi,orcs}`, the music loop in `music.ogg`, and the downloaded gun recordings in `turret-shot.wav` / `mortar-shot.wav`.

Render at 640px (castle), 256px (weapons), 1280×560 (terrain) and 160px per actor frame. Assemble 8×3 atlases in the order idle (4), walk (8), attack (4), hurt (2), death (4). Frame keys keep existing actor identifiers so previous saves continue to load. WebP quality 94 preserves smooth edges at mobile render density.

SFX are silence-trimmed, normalized to −18 LUFS / −2 dB peak and faded out. Card slides last 0.28s, reshuffle 1s, footsteps 0.35s, turret 0.2s; combat voices are throttled. The complete 153.6s music loop is normalized to −19 LUFS and encoded as stereo MP3 at 96 kbps. Menu and end-screen low-pass filtering continues to use the same loop.

## Gameplay additions

NEXT peeks at the stock's first card. With exhausted stock it previews the deterministic discard shuffle using a copied RNG. No tableau is redealt. Recycling plays a 900ms animated fan / gather sequence; siege time pauses during that animation.

UNDO restores the previous successful tableau card and chain, costs one castle HP, and leaves live combat and already triggered effects intact. Immediate HEAL/GUARD/GOLD/BOMB powers are consumed once to prevent replay farming. Drawing commits deployment and clears undo. Undo is unavailable with one HP or after the run ends.

The difficulty streak advances per new siege and resets after defeat. Total attempts, best siege, best kills, coins and workshop upgrades are tracked separately. Resuming a saved siege keeps its saved difficulty. Old wallets migrate to a fresh streak without losing permanent progression.

The active audio revision is HD v3. See `public/audio/RECORDED_AUDIO_CREDITS.md` for current files, processing and source provenance; older render instructions describe the initial audio assets.
