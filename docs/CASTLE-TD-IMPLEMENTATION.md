# Castle TD: current implementation

## Gameplay

- Castle growth and its economy are deferred. The existing castle stays, and all five rewards are available from the first card chain. Internal legacy XP and archived upgrades remain compatible with saved games.
- Play adjacent ranks (±1) without A ↔ K wrapping. Q ↔ K remains legal and WILD permits any next rank. Castle saves adopt this rule; the separate original roguelike mode retains its existing wrapping rule. Then tap the closed stock to release the chain. Rewards repeat every five cards: soldiers at 1/6/11, archers at 2/7/12, turret magazines at 3/8/13, cannon damage at 4/9/14 and laser damage at 5/10/15. Turret and cannon reload the same mounted object.
- A new game deals exactly seven columns of five cards, one active card and 16 stock cards. The 52 ordinary cards are shuffled before dealing; jokers are excluded beforehand, so no column loses a card. Older ongoing four-row saves retain their boards; subsequent rounds use five rows.
- Initial card powers are one WILD and two GUARD cards. GUARD grants 1 armor, or 5 with a 20% chance. Its seeded roll repeats after undo rather than rerolling. HEAL, BOMB, ECHO and CRIT are removed from card upgrades, and jokers are removed from castle play. Reshuffling strips all card powers and temporary modifiers. Stock recycling still costs 5 HP; ordinary draws are free. Empty stock does not stop available tableau plays. Recycling is an explicit action and preserves the tableau.
- Victory carries current gold, HP, max HP and armor into the next round. Ability uses and undo limits reset. Defeat clears the continuation; a new run starts with base health, no armor and no battle gold. Saved continuations are consumed once, and inherited gold is not credited to the separate legacy wallet again.
- HEAL costs 30 gold and restores up to 8 HP. BOMB costs 100 and deals 12 damage to every enemy. ECHO costs 50 and adds two positions to the current chain. Each ability can be purchased and applied once per round. Invalid or unaffordable applications spend nothing.
- Undo restores the full pre-action snapshot. It is free, limited to three uses per round, and the remaining quota survives reloads and history barriers. Used abilities and spent gold cannot be recovered through undo.

## Combat

- Every wave contains `siegeNumber × 5` enemies; waves arrive every five simulation seconds. Every twentieth enemy is a boss. HP and speed scale with siege difficulty, and the population cap is 300.
- Enemy portals choose a deterministic random origin between 10% and 50% of the screen width. Ground lanes occupy the bottom 22% of the arena. Far enemies are half the size of equivalent foreground enemies and render behind them.
- The cannon starts targeting after enemies reach 50.7% of the screen width, so enemies survive their portal entrance. Soldiers use the same contact distance for attacking and blocking; damage is applied before the enemy's counterattack. Their attack and death clips remain visible.
- Boss castle attacks bypass armor and leave its stored value intact. Ordinary attacks consume armor before HP.
- Prepared enemy atlases supply walking, attack, hurt and death animations. Knights and archers retain imported AE walking/attack and use the prepared hurt/death clips. Texture changes preserve the intended visible height and grounded feet. Walking has no additional angle or vertical rocking.

## Presentation

- Compact top HUD: round/time, coins and styled pause button. Red HP and blue armor bars, with heart/shield and numbers, sit above the stock and active card beside the tableau. BUILD, level/XP, start prompt and enemy counter are hidden.
- Five dark gems below the deck light up as chain rewards accumulate. COMBO and the current chain multiplier sit above the gems; abilities occupy the bottom of the panel. Chains of three or more briefly display a large animated ×3, ×4, ×5… over the upper card row; supermonster arrivals appear in the same focus area.
- The closed stock and active card share the same size and have no captions. Tap the stock to draw; there is no duplicate DRAW button. No legal plays highlight the stock. An empty stock shows a shuffle arrow and heart with the 5 HP cost and remains a manual action. Draw flights start at the stock and land in the active slot; shuffle flights gather back into the stock.
- Panels use thin brass rims, deep teal/navy gradients and subtle ambient color motion. Desktop controls sit to the right; portrait controls remain below the card columns.
- Undo is a small circular back arrow beside the stock, with a red remaining-use badge. HEAL/BOMB/ECHO use their prepared images and display prices with a gold icon beside the deck. Settings use tap/drag sliders with live percentages in a wider responsive panel.
- Round results animate a gold crown and sparks for Victory, or a fading red shield for Defeated. Run totals reveal before the action buttons become available. Statistics cover the whole run: rounds won, enemies and bosses defeated, physical cards played, simulation time survived and gold earned. Current remaining gold, HP and armor are shown separately.
- The magic core uses the shared active/inactive ring and diamond textures. Its beam begins at the core root. Existing separate gate art remains in use; the unused castle-gates atlas is unchanged.

## Integrity and verification

- Gold is committed on actual kills: one per ordinary enemy and five per boss. Only unspent run gold reaches the archived wallet. Coin animations never determine accounting.
- Ability spending and kills clear incompatible undo history. Legacy and current saves sanitize removed powers, reserve jokers and obsolete combat modifiers without losing ordinary cards. Current saves validate ability use and undo quotas.
- Unit/integration tests cover exact deals, reward cycling, powers, abilities, undo persistence, migrations, soldier contact, boss armor bypass, spawn positions and perspective geometry.
- Chrome checks cover desktop, ultrawide, tiny phones and notched high-density phones, with no script errors or overlapping deck/gem/ability controls. Sliders are checked for tap/drag, endpoint clamping, live labels and persistence. Local screenshots and smoke scripts are under `.local/qa`.

## Deferred work

Tent-to-house-to-castle progression and its new economy are intentionally deferred. Existing permanent-upgrade storage and legacy module effects remain compatible, but no in-battle BUILD button is shown.
