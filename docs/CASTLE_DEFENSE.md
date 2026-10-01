# Castle Solitaire — first playable defense version

One 54-card Golf Solitaire board powers a real-time castle siege. Keep the rank ±1 / A↔K rules, WILD and the two colored jokers. Never re-deal the tableau between waves.

The first card or draw starts the siege. Enemies arrive from the left and attack the castle on the right. Completing the tableau fires a final blast, defeats the remaining invaders and wins the siege. A fallen castle ends the run; the same deck, army, enemy positions, magazines, health and seeded RNG resume after reload. Pause/settings, app backgrounding and the menu stop simulation time; returning never catches up missed real time.

## Chains

| Cards in the uninterrupted chain | Reward | Baseline behavior |
|---|---|---|
| 1 | Soldier | 1 HP, 1 damage once per second, marches left and fights in melee; 18 seconds after engagement |
| 2 | Knight | 6 damage every 1.5 seconds; 6 HP, marches left; 24 seconds after engagement |
| 3 | Turret | 100 rounds, 2 damage per bullet, 4 bullets/second, targets the closest enemy to the castle after it travels 40% of the road |
| 4 | Mortar | 12 shells, 9 damage to up to three leading enemies, one shot every 2 seconds, starts firing after enemies travel 22% of the road |
| 5 | Laser | Deletes normal invaders, deals 80 damage to supermonsters |
| 8, 11, 14… | Another laser | Same effect; rewards never downgrade when extending a chain |

A chain banks every intermediate reward. No defender or chain laser appears during card selection. Drawing releases all banked rewards once, then resets the chain; it does not cause an instant enemy hit. Time keeps passing while the player thinks. The stock recycles the waste when exhausted, preserving every physical card and the tableau.

Thirty-two defenders can occupy the field. Beyond that limit, the matching defender is refreshed rather than discarding a reward. Infantry waits without expiring until an enemy enters range. Turrets stop firing at zero ammunition; their counts are displayed on the field.

Hearts repair castle HP; clubs provide armor; diamonds add bankable coins. Existing HEAL, GUARD, GOLD and WILD powers work. BOMB damages the lane and CRIT boosts the new defender. Black joker multiplies newly deployed damage by five; red joker grants lifesteal. The multiplier captured at red activation preserves the requested red/black order: red→black heals from damage before the critical multiplier, black→red heals from the critical damage. Units retain their deployment stats while the next chain is built.

## Waves and difficulty

The first group arrives one second after the first action. Groups of three enemies spawn every two seconds; group size rises to four at 30 seconds and five at 60 seconds. Intervals shorten toward 1.25 seconds. Regular HP starts at six and increases by two every 30 seconds, independently of how many enemies have spawned. A supermonster follows every twenty regular invaders. At most 48 invaders can be alive; a partially filled group respects the cap.

Turrets and mortars no longer shoot enemies at the spawn edge. Their firing zones let groups enter and cross the field before combat, while infantry marches to meet them. Group members have staggered positions, seeded speed variation and four visual ranks so they read as an advancing horde. The HUD shows live enemy count and turns red when an enemy reaches the final quarter of the approach; near-castle enemies show a danger marker.

Normal invaders reach the castle in roughly 23–30 seconds if unopposed. Contact damages armor before castle HP; regular invaders attack every 3.5 seconds and bosses every three seconds. An unattended baseline castle falls within a minute. The tableau, stock-draw deployment timing, soldier 1 HP / 1 base damage and final victory blast remain unchanged.

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
