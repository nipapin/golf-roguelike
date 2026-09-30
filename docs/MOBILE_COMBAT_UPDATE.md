# Mobile combat feedback update

- Battle layout uses the actual canvas viewport and CSS safe-area insets once.
  Separate regions: fight/gold/settings, player HP/armor, build button, enemy,
  compact chain/damage strip, 7×5 tableau, draw/end-turn button and active card.
  Cards cannot overlap the tray, HP bar or HUD at tested mobile dimensions.
- Tableau plays animate to the active slot for 260ms; draw slides the next card
  into place. Input is blocked during the transition; logic/autosave commit first.
- Power badges/ribbons stay inside their card, hide on covered cards, and no
  longer float across neighbouring columns. Opaque Canvas fallbacks make card
  faces visible without WebGL and on generated textures.
- A new run begins with a deterministic choice of three starter relics. The
  selection persists, then starts fight 1. Old saved runs continue normally.
  A redundant A↔K relic is replaced by ACE STRIKE (+4 damage to Aces).
- The build button opens a paginated collection with each relic's effect.
  Victory choices use readable cream tiles and the same icon mapping.
- All seven power-card types participate in seeded assignment; previously a
  normal fight with three powers could only deal CRIT/HEAL/GUARD.
- Quiet original procedural background music starts after a user gesture.
  Separate persistent music/SFX toggles and levels; default SFX bus 22%, music
  bus 18%. Music stops in background, one loop is shared across scenes, and
  audio unlock retries after iOS suspends the context.

Validation: unit tests cover mobile region separation, starter reward persistence,
first encounter preservation, full power variety and audio mixer/scheduler behavior.
Production build and lint checked. Synth music is a basic original loop, not a
finished soundtrack. iPhone physical audio balance still needs the user's check.
