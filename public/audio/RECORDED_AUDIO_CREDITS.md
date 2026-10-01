# Audio revision HD v3

Runtime now uses decoded samples for every effect. No Web Audio oscillators are used for combo, power, reward or end-screen cues.

- **MintoDog — Hope (Orchestral battle music)**, CC0: https://opengameart.org/content/hopeorchestral-battle-music . New 69.8-second loop from the lossless FLAC source, stereo MP3 192 kbps / 48 kHz, normalized to −16 LUFS / −1.5 dB peak. Runtime file: `hd-v3/hope-battle.mp3`.
- **Kenney — Impact Sounds**, CC0: https://kenney.nl/assets/impact-sounds . Recorded metal, bell, glass, plate, wood and punch sounds underpin `strike`, `wall-hit`, `armor`, `combo`, `coin`, `heal`, `wild`, `echo`, `crit`, `invalid`, `click`, `win` and `lose`. License included under `public/assets/kenney/licenses/impact.txt`.
- **kurt — Gunshots**, CC0: https://opengameart.org/content/gunshots . Original .22 Pistol and Black Powder WAV recordings underpin `gun`, `bomb` and the designed `laser` charge/impact, layered with Kenney foley.
- **Kenney — Casino Audio**, CC0: https://kenney.nl/assets/casino-audio . Short 0.22s recorded card slides; existing shuffle is retained.
- **Kenney — RPG Audio**, CC0: https://kenney.nl/assets/rpg-audio . Footsteps retained.
- **Tim Rockk — Orc Voice**, CC0: https://opengameart.org/content/orc-voice . Recorded growl, grunt and death retained.

Effects are mixed from recordings, trimmed, equalized and moderately compressed while preserving their attacks. Output is stereo 192 kbps MP3 at 48 kHz, normalized to −14 LUFS / −1.5 dB peak. Final level remains controlled by the player's saved independent SFX/music sliders.

Combo pitches rise by half a semitone per card, capped at seven semitones. Powers use different samples; jokers use lower-pitched healing/critical cues. Menu and results still filter the same continuous new soundtrack behind a wall.

New `/audio/hd-v3/` URLs prevent old cached files from replacing the new sounds. PWA checks for application updates immediately on launch and when foregrounded. Gameplay is saved before the existing update button reloads the application.
