# Castle Solitaire — first playable defense version

One 54-card Golf Solitaire board powers a real-time castle siege. Keep the rank ±1 / A↔K rules, WILD and the two colored jokers. Never re-deal the tableau between waves.

The first card or draw starts the siege. Enemies arrive from the left and attack the castle on the right. Completing the tableau fires a final blast, defeats the remaining invaders and wins the siege. A fallen castle ends the run; the same deck, army, enemy positions, magazines, health and seeded RNG resume after reload. Pause/settings, app backgrounding and the menu stop simulation time; returning never catches up missed real time.

## Chains

| Cards in the uninterrupted chain | Reward | Baseline behavior |
|---|---|---|
| 1 | Soldier | 1 HP, 1 damage once per second, marches left and fights in melee; 18 seconds after engagement |
| 2 | Knight | 6 damage every 1.5 seconds; 6 HP, marches left; 24 seconds after engagement |
| 3 | Turret | 100 rounds, 2 damage per bullet, 4 bullets/second, targets the closest enemy to the castle |
| 4 | Mortar | 12 shells, 9 damage to up to three leading enemies, one shot every 2 seconds |
| 5 | Laser | Deletes normal invaders, deals 80 damage to supermonsters |
| 8, 11, 14… | Another laser | Same effect; rewards never downgrade when extending a chain |

A chain banks every intermediate reward. No defender or chain laser appears during card selection. Drawing releases all banked rewards once, then resets the chain; it does not cause an instant enemy hit. Time keeps passing while the player thinks. The stock recycles the waste when exhausted, preserving every physical card and the tableau.

Thirty-two defenders can occupy the field. Beyond that limit, the matching defender is refreshed rather than discarding a reward. Infantry waits without expiring until an enemy enters range. Turrets stop firing at zero ammunition; their counts are displayed on the field.

Hearts repair castle HP; clubs provide armor; diamonds add bankable coins. Existing HEAL, GUARD, GOLD and WILD powers work. BOMB damages the lane and CRIT boosts the new defender. Black joker multiplies newly deployed damage by five; red joker grants lifesteal. The multiplier captured at red activation preserves the requested red/black order: red→black heals from damage before the critical multiplier, black→red heals from the critical damage. Units retain their deployment stats while the next chain is built.

## Waves and difficulty

The first spawn has a one-second grace period after the first action. Spawn intervals start near 1.5 seconds and shorten toward 0.75 seconds. Regular enemy HP grows with spawn count. A supermonster appears after each ten regular invaders, with larger HP, slower approach and heavier castle attacks. At most thirty-two invaders are alive concurrently; additional spawns wait instead of disappearing or advancing offscreen.

Normal enemies need roughly 30–45 seconds to traverse the lane. Contact deals damage every 3.5 seconds; supermonsters attack every three seconds. Armor absorbs damage before castle HP.

The prototype favors readable decisions over frantic tapping. Automated seeded simulations check board completion and the effect of upgrades; human pacing feedback should guide the next tuning pass.

## Permanent progression

Kills pay one coin; supermonsters pay five; completing the tableau pays ten extra. Diamond income is also banked. Defeat retains earned coins. Settlement records the run ID to prevent duplicate rewards after reopening/reloading a result screen.

| Workshop upgrade | Baseline | Each level |
|---|---|---|
| Castle walls | 30 HP | +5 HP |
| Soldiers per deployment (each 1 HP / 1 damage) | 1 | +1 soldier |
| Knight damage | 6 | +2 |
| Turret magazine | 100 rounds | +20 rounds |
| Mortar damage | 9 | +2 |
| Laser damage against supermonsters | 80 | +20 |

Each upgrade caps at level ten. The next purchase costs `10 + 8 × current level`. The workshop shows the exact current and next values. Purchases take effect on the next siege; a resumed siege retains its original upgrade snapshot.

## Implementation and limits

`src/castle/CastleDefense.ts` owns deterministic quarter-second simulation, chain deployment, combat, difficulty and shared tuning values. `CastleService.ts` validates separate siege saves and persists workshop levels and settlements. `CastleScene.ts` presents the scene using existing card visuals, authored CraftPix monster animations, combat flipbooks, short recorded card sounds and the continuous filtered soundtrack. Castle/turret geometry is vector art for crisp scaling. The new menu and workshop become the default entry point; the earlier duel's saves are retained separately.

This is the first complete playable loop. No paid purchases, backend accounts, branching campaign or additional solitaire decks are included. Current monster animation sets expose idle/attack/hurt/death rather than authored walking cycles; translating and bobbing the animated sprites provides movement until a dedicated walk sheet is added.
