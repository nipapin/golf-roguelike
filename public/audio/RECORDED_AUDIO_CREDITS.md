# Recorded audio

Runtime assets are compressed derivatives of CC0 sources:

- **Kenney — Casino Audio**: https://opengameart.org/content/54-casino-sound-effects-cards-dice-chips
  `card-tap-{1,2,3}.mp3`: recorded card placement trimmed to 180 ms with a short fade.
- **request — Heartfelt Battle**: https://opengameart.org/content/heartfelt-battle-loopable-fantasy-stringspianohorn
  `battle-orchestral.mp3`: fantasy strings, piano and horn loop, encoded at 96 kbps.

One continuous music loop uses the independent music volume control. Outside combat, a low-pass filter and lower gain give a muffled behind-the-wall sound without restarting the track. Power-card and ascending combo cues are synthesized short effects.

Unused legacy recordings (battle-rock, menu-fantasy, result-*, foley-*, card-place-*, card-slide) were removed from the build to keep the PWA precache small.
