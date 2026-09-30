# Combat feedback update

- Reward, shop and end-of-run use shared purple/cream/gold modal components. Battle remains paused behind reward/shop/result; restore routes draw an arena backdrop. Modal input blocks underlying cards.
- First-time rules explain ±1, A↔K, column exposure, WILD and the three-card turn threshold. Rules can be reopened in the main menu.
- A chain of three or more cards prevents the enemy response. Shorter chains still resolve their damage, then the enemy acts once. Exhausting the deck no longer causes a duplicate enemy hit. The deck and chain reset after drawing as before.
- Wrong/covered card taps shake the card and play the error signal, without committing an action. WILD changes the active-card rule hint to ANY RANK.
- Initial deal fans from the deck; played cards lift, follow a curved path, settle and emit sparks. Enemies breathe, wind up, lunge, react to damage and shrink/fade when defeated. Goblin idle excludes repeated terminal frames from its generated atlas.
- Recorded card foley and recorded music replace placeholder card samples and the oscillator loop. Audio provenance is in public/audio/RECORDED_AUDIO_CREDITS.md.

Validation: unit tests and production build. Live visual/audio testing is left to the user at their request.
