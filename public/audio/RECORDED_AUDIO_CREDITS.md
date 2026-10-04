# Castle audio: user-sfx-v1

## Current user-supplied audio (2026-10-04)

All 32 MP3 files from the user's `C:\Users\nipap\Music\SFX` folder are copied
byte-for-byte into `user-sfx-v1/`. The source folder is unchanged. Attribution
and licensing for these supplied recordings have not been provided.

| Event | Supplied recording |
| --- | --- |
| Menu / battle music | `menu.mp3` / `game.mp3` |
| Archer / soldier attack | `arrow_01`, `arrow_02` / `sword_01` through `sword_05` |
| Archer, turret, cannon placement | `place`, `place_02` (both variants) |
| Soldier deployment and marching / enemy footsteps | `step_01`, `step_02` |
| Turret / cannon / laser | `turret` / `cannon` / `laser` |
| Card play / draw / shuffle | `card_01` through `card_03` / `card_02` / `shuffle` |
| Critical / heal / armor and shield | `crit_01`, `crit_02` / `heal` / `armor` |
| Bomb / wild / echo | `bomb` / `wild` / `echo` |
| Button / invalid action | `button` / `not-allowed` |
| Victory / defeat | `victory` / `defeated` |
| Reward, purchase, upgrade, level-up | `succsess` |

Every filename above uses `.mp3`. The original spelling `succsess.mp3` is retained.
Variants share their event's volume, cooldown and voice cap. A configurator file
override replaces every take of that event. Missing variant files are skipped.
Music crossfades over 0.6 seconds and retains a separate playback position for
each track. Results use the menu track alongside the victory/defeat cue.
Music controls, scene filters, saved volume preferences and master compression
remain active. Versioned MP3 URLs are included in the PWA offline precache.

Events without a matching supplied recording (reload, castle/enemy impacts,
monster voices, gold power and coin collection, combo and jokers) retain the earlier recorded cues.

## Archived soft-v1 and Lucid revision

Monster growl, hurt and death cues now use `combat-v2/growl.mp3`,
`grunt.mp3` and `death.mp3`, copied byte-for-byte from the user's reference
deployment at https://golf-roguelike.vercel.app/ on 2026-10-04.
They replace the local `ci-v1` monster cues. Other sound events are unchanged.
The reference deployment did not provide separate attribution for these files.

The previous defaults used a quiet piano loop and restrained recorded weapon/foley cues.
Previous files remain available in Castle Studio for individual overrides.

## Music

Music by YannZ – https://yannz41.itch.io
Spotify: https://open.spotify.com/intl-it/artist/76CUcHd0t0XViSm9YBbHBw
Contact: yziango@gmail.com

Source: https://yannz41.itch.io/contemplative-fantasy-music-pack .
“Déjà Vus” first, second and third loops from Vol. 1: Lucid are copied byte-for-byte
to `lucid-v1/quiet-piano.ogg`, `quiet-piano-bass.ogg` and `quiet-strings.ogg`.
The first loop is the default. Original Vorbis metadata is preserved.
The included `lucid-v1/LICENSE.txt` permits commercial/non-commercial indie game
use with the attribution above; it is not CC0 and does not permit standalone resale
or redistribution. The credit also appears in the game's Credits screen.

The continuous loop is reused across scenes. Default music volume is 0.12;
existing saved volume preferences remain respected. Menu/results use a 4200 Hz
low-pass and scene gain 0.48; battle uses 7000 Hz and gain 0.65. Filter transitions
use a 0.6-second time constant, preserving the music's playback position.

## Soft recorded effects

| Cue | Source |
| --- | --- |
| Laser | Kenney Sci-fi Sounds: `laserLarge_000.ogg` |
| Soldier swipe | Kenney RPG Audio: `knifeSlice.ogg` |
| Footsteps | Kenney RPG Audio: `footstep04.ogg`, `footstep06.ogg` |
| Reload | Kenney RPG Audio: `metalLatch.ogg` |
| Deploy | Kenney RPG Audio: `cloth1.ogg` |
| Arrow, turret, mortar, castle damage | Existing processed CI v1 recordings, softened again |

Kenney sources: https://kenney.nl/assets/sci-fi-sounds and
https://kenney.nl/assets/rpg-audio . Both CC0; license files are in `soft-v1/`.
Chequered Ink terms are retained in `ci-v1/LICENSE.md`.

`tools/build-soft-audio.py` rebuilds ten mono 48 kHz/128 kbps MP3 cues from
`.local/audio-sources/` and the existing CI cues, using FFmpeg. It removes low-frequency
rumble, rolls off harsh high frequencies, normalizes each role conservatively,
caps pre-encoding peak at 0.5, and applies a 5 ms attack / 50 ms release.
Exact source/output SHA-256 hashes, cutoff, gain and duration are in
`soft-v1/manifest.json`. Original downloaded packs are local build inputs and are
not redistributed as part of the project.

Growls, hurt and death reactions have separate cooldowns and voice limits;
weapon events retain independent throttles. The existing compressor, total voice
cap and short fades prevent excessive overlapping cues. Default SFX volume stays
0.22. Gameplay laser audio is now an energy pulse rather than a machine recording.

## Previous CI v1 revision (source archive)

This earlier revision derived its SFX from **Chequered Ink — 400 Sounds Pack**:
https://ci.itch.io/400-sounds-pack . Commercial-use permission, **not CC0**;
see `ci-v1/LICENSE.md`. The original WAV collection is not redistributed.

| Game cue | Sources inside the pack |
| --- | --- |
| Cards / shuffle | Card and Board/card_draw_{1,2,3}, card_fan_2 |
| Footsteps / vocal cues | Footsteps/foley_footstep_gravel_{1,2}; Human/man_{0,8,6} |
| Turret | Weapons/shot_muffled + Materials/metal_blunt_tap |
| Arc cannon / bomb | Weapons/harsh_thud + Environment/air_burst + Materials/cardboard_hit |
| Laser | Machines/drill_whizz + hydraulic_up + Environment/air_burst |
| Archer / soldier | Other/elastic_twang + Combat and Gore/swipe; Weapons/sword_light |
| Castle damage / enemy impact | cardboard_hit + harsh_thud; punch_2 + cardboard_hit |
| Shield / deploy / reload | sword_clash_2; weapon_pick_up; weapon_equip_short |
| Combo | Match Three/match_xylophone_1 |
| CRIT / black joker | weapon_upgrade + metal impact |
| HEAL / red joker | heart_collect; red joker adds vibraphone |
| GOLD / reward | coins_gather_quick |
| WILD / ECHO | Vibraphone; glass ping + xylophone |
| UI / invalid | controller_button_press; UI/cancel |
| Victory / defeat | brass_level_complete; grand_piano_defeated |

Exact source paths, SHA-256 hashes, layer weights, rate adjustments and decoded
measurements are in `ci-v1/manifest.json`. Rebuild with:

```
python scripts/pack-ci-audio.py /path/to/extracted/400-sounds-pack
```

Requires FFmpeg, ffprobe and NumPy. Do not commit the original pack.
31 mono MP3 cues, 128 kbps / 48 kHz. Trimmed silence with a short lead-in,
gentle saturation, role-specific RMS targets, a 35 ms release, and encoded-file
true-peak checks (at or below −1.5 dBTP). Peak bounds take priority over RMS.
Integrated LUFS is recorded only when measurable; no universal −14 LUFS claim
is made for short cues. Mono SFX avoid stereo cancellation on mobile speakers.

Saved controls stay independent (then-defaults SFX 0.22 / music 0.18). Per-cue gain
multiplies the SFX bus. Both buses pass through a master compressor: threshold
−6 dB, knee 3 dB, ratio 20:1, attack 3 ms, release 120 ms; output gain 0.85.
This controls extreme overlap, but is not a guaranteed true-peak brickwall limiter.

Independent weapon throttles let turret, arrows and cannon sound in one tick.
Multi-target mortar events coalesce; castle hits within 80 ms coalesce.
Laser starts within 120 ms coalesce, with one active laser tail. Per-cue voice caps
and a total cap of 24 SFX voices apply; replaced tails fade over 10 ms.
Combo starts on card 2, grows from gain 0.35 to 0.6, and rises by half a semitone
per card up to seven semitones. Both jokers have separately processed cues.
Versioned `/audio/ci-v1/` URLs avoid old cached SFX; unused legacy SFX are removed.

## Music and additional packs reviewed

The previous continuous **MintoDog — Hope** track remains available as a configurator
option (CC0), and is no longer the default:
https://opengameart.org/content/hopeorchestral-battle-music .
`hd-v3/hope-battle.mp3`: 69.818 s decoded, stereo 192 kbps / 48 kHz.
Menu/results retain 650 Hz low-pass, Q 0.65, scene gain 0.48;
battle uses 18000 Hz and gain 1.

The 400 Sounds Pack has musical stingers, not a full battle loop.
No assets from the following reviewed sources ship in this revision:

- https://placeholder-assets.itch.io/50-free-sounds-pack : useful explosions,
  guns, shields, creatures and magic. Royalty-free project-use license, not CC0;
  standalone redistribution and sound-library inclusion prohibited.
- https://pixelloops.itch.io/free2-game-audio-starter-pack-music-sfx-for-games :
  fantasy tavern, horror ambient and sci-fi combat demos plus five SFX.
  Supplied license permits game use but prohibits standalone sharing.
  None was selected as the fantasy battle loop.
- https://itch.io/game-assets/free/tag-audio : Tallbeard's CC0 music-loop bundle
  and TomMusic's fantasy SFX are possible future sources, not included here.

Device auditioning is still required for mobile speaker/headphone balance.
