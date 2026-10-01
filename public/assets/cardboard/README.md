# Cardboard diorama asset pack

Original raster art generated with the built-in `image_gen` tool for the active Castle Siege mode. Full prompt set is in `prompts.json`. The look is layered colored cardstock, exposed tan edges, matte texture, cream/teal/coral defenders and green/ochre/violet enemies. Characters are torso puppets on cardboard tabs, not articulated walking characters.

## Contents

- `actors/`: soldier, archer, orc, goblin, reaper, ogre-boss, reaper-boss.
- `buildings/`: castle, turret, mortar (arc cannon), laser emitter.
- `powers/`: CRIT, HEAL, GUARD, GOLD, BOMB, WILD, ECHO as individual icons.
- `props/`: crown, arrow, shell.
- `environment/`: opaque empty battlefield plus transparent forest and hills layers.
- `manifest.json`: dimensions, alpha, visible bounds, origins, orientation, hashes and exact code mappings.
- `index.html`: responsive asset catalog, small-size previews and a composed diorama.

All PNG originals are preserved without resampling or background removal. Except for `battlefield.png`, they have genuine RGBA transparency. Images are large originals: load only the subset needed for a scene. The pack is excluded from PWA precaching; requested images use the existing runtime image cache. Consider a separate optimized delivery version before making the entire pack part of the PWA precache.

## Code mapping

| Existing siege sprite | New asset |
| --- | --- |
| c_angel1 | soldier |
| c_angel2 | archer |
| c_orc | orc |
| c_goblin | goblin |
| c_reaper2 | reaper |
| c_ogre | ogre-boss |
| c_reaper1 | reaper-boss |

The persisted `knight` upgrade still maps to the archer. `magazine` maps to the turret and `mortar` to the arc cannon. No save keys or game balance are changed.

## Phaser usage

```ts
import { preloadCardboardArt, cardboardArt, rockCardboardPuppet } from './CardboardArt';

// In preload():
preloadCardboardArt(this);

// In create(): visible paper height, with feet/base anchored at y:
const archer = cardboardArt(this, 'archer', 310, 200, 67);
const walk = rockCardboardPuppet(this, archer);
// Call walk.stop() when the puppet stops walking or dies.
```

Defenders face left and enemies face right already; do not reuse the old defender `setFlipX(true)`. `cardboardArt()` preserves aspect ratio and computes the origin from visible alpha bounds, so varying transparent margins do not shift the base. Cast shadows should be drawn in the scene separately. The archer includes its bow; do not overlay the legacy programmatic bow on it.

These are static cutouts. Use rocking, recoil, lean and fade transforms for puppet-style motion. They are not substitutes for existing multi-frame atlases: do not pass the PNGs to the old atlas animation loader.

Gameplay, the start menu and the workshop now use the cardboard pack. Runtime delivery copies live in `/assets/cardboard-runtime/` (cropped, aspect-preserving WebP); the PNG originals remain here for editing. Runtime copies are precached for offline play. Puppet movement uses rocking, recoil and fade transforms with the existing gameplay action names. The 54-card deck and retired duel enemies/relics remain outside this Castle Siege entity pack. Preview locally at `/assets/cardboard/index.html` after `npm run dev`.
