# Audio revision CI v1 + combat-v2

Card, UI, item and remaining foley SFX derive from **Chequered Ink — 400 Sounds Pack**:
https://ci.itch.io/400-sounds-pack . Commercial-use permission, **not CC0**;
see `ci-v1/LICENSE.md`. The original WAV collection is not redistributed.

| Game cue | Sources inside the pack |
| --- | --- |
| Cards / shuffle | Card and Board/card_draw_{1,2,3}, card_fan_2 |
| Footsteps | Footsteps/foley_footstep_gravel_{1,2} |
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
25 mono MP3 cues, 128 kbps / 48 kHz. Trimmed silence with a short lead-in,
gentle saturation, role-specific RMS targets, a 35 ms release, and encoded-file
true-peak checks (at or below −1.5 dBTP). Peak bounds take priority over RMS.
Integrated LUFS is recorded only when measurable; no universal −14 LUFS claim
is made for short cues. Mono SFX avoid stereo cancellation on mobile speakers.

Saved controls stay independent (defaults SFX 0.22 / music 0.18). Per-cue gain
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

## Recorded combat replacements

`combat-v2/` restores the actual weapon and creature recordings from commit
075336466ad86516227458a2b30ef00fffe66153. No Human/man_* voice takes or
Machines/drill_whizz/hydraulic_up laser layers are loaded or shipped.
Cards and the other CI cues retain their exact files and playback settings.

- `gun.mp3`, `bomb.mp3`: kurt — Gunshots, .22 pistol / black powder recordings.
  https://opengameart.org/content/gunshots (CC0).
- `laser.mp3`: Kenney — Sci-fi Sounds, laserLarge_000.
  https://kenney.nl/assets/sci-fi-sounds (CC0).
- `growl.mp3`, `grunt.mp3`, `death.mp3`: Tim Rockk — Orc Voice,
  ORC GROWL / ORC GRUNT / ORC DIES.
  https://opengameart.org/content/orc-voice (CC0).

These are the original repository-prepared MP3s, without further synthesis or
processing in this correction. They retain the older mono 44.1 kHz / 96 kbps
encoding and processing; the −1.5 dBTP CI checks above apply only to CI cues.
`combat-v2/manifest.json` records the source commit, paths and SHA-256 hashes.
BOMB power uses the same recorded explosion as the arc cannon. Enemy-death
aliases share the same recorded orc death buffer. Source authors retain credit.
Fresh URLs avoid reusing the mistaken sounds from the PWA cache.
Device auditioning is still needed; numerical validation does not establish fit.

## Music and additional packs reviewed

The continuous **MintoDog — Hope** track remains (CC0):
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
