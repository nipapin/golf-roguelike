import { RelicManager } from './RelicManager';
import { enemiesForAct } from './GameState';
import { MIN_ATTACK_CHAIN } from './GameRules';
import {
  Relic,
  BattleState,
  RunState,
  GameConfig,
  ActionResult,
  GameEvent,
  TableauColumn,
} from './types';
import { RNG } from './RNG';
import {
  canConnect,
  isCardExposed,
  findCardColumn,
  getPowerType,
  isTableauEmpty,
  hasLegalMoves,
  setupBattle,
  createEnemy,
  EnemiesData,
} from './GameState';
import { calculateCardDamage } from './DamageCalculator';

function getFirstChainBonus(relics: Relic[]): number {
  return RelicManager.of(relics).firstChainBonus();
}

/**
 * Play a card from the tableau
 */
export function playCard(
  state: RunState,
  cardId: string,
  config: GameConfig
): ActionResult {
  const events: GameEvent[] = [];

  if (!state.battle || state.phase !== 'battle') {
    return { state, events };
  }

  const battle = state.battle;

  // Find the card in tableau
  const colIndex = findCardColumn(battle.tableau, cardId);
  if (colIndex === -1) {
    return { state, events };
  }

  // Check if card is exposed
  if (!isCardExposed(battle.tableau, cardId)) {
    return { state, events };
  }

  const column = battle.tableau[colIndex];
  const card = column.cards[column.cards.length - 1];

  // Check if card can connect
  if (!battle.activeCard || !canConnect(card, battle.activeCard, battle.wildActive)) {
    return { state, events };
  }

  // Remove card from tableau
  let newTableau: TableauColumn[] = battle.tableau.map((col, i) =>
    i === colIndex ? { cards: col.cards.slice(0, -1) } : col
  );

  const remainingDeck = [...battle.deck];
  if (battle.mode === 'boss' && remainingDeck.length) {
    newTableau = newTableau.map((col, i) => i === colIndex ? { cards: [remainingDeck.shift()!] } : col);
  }

  // Add previous active card to discard
  const newDiscard = battle.activeCard ? [...battle.discard, battle.activeCard] : battle.discard;

  // Calculate chain position
  let chainPosition = battle.chain.length + 1;

  // Apply first chain bonus
  if (battle.isFirstChain && battle.chain.length === 0) {
    const bonus = getFirstChainBonus(state.player.relics);
    chainPosition += bonus;
  }

  // Check for power card
  const powerType = getPowerType(battle.powerCards, card.id);

  // Handle ECHO - adds to chain position
  if (powerType === 'ECHO') {
    chainPosition += config.powerCards.ECHO.comboBonus;
  }

  // Calculate damage for this card
  const damageResult = calculateCardDamage({
    chainPosition,
    card,
    powerType,
    relics: state.player.relics,
    config,
  });

  const oldMultiplier = battle.jokerMultiplier ?? 1;
  const baseDamage = (battle.chainBaseDamage ?? battle.accumulatedDamage / oldMultiplier) + damageResult.totalDamage;
  const jokerMultiplier = card.joker === 'black' ? oldMultiplier * 5 : oldMultiplier;
  const lifestealMultiplier = card.joker === 'red' ? oldMultiplier : (battle.lifestealMultiplier ?? 0);
  if (card.joker) events.push({ type: 'joker_activated', color: card.joker });

  events.push({
    type: 'card_played',
    card,
    chainPosition,
    damage: card.joker ? 0 : damageResult.totalDamage * jokerMultiplier,
  });

  // Handle immediate suit effects (hearts, clubs, diamonds)
  let newPlayer = state.player;
  const relicManager = RelicManager.of(state.player.relics);

  if (!card.joker && card.suit === 'hearts') {
    let healAmount = config.combat.baseHeartHeal;
    healAmount += relicManager.suitBonus('hearts');
    if (powerType === 'HEAL') {
      healAmount += config.powerCards.HEAL.healAmount * relicManager.powerMultiplier('HEAL');
    }
    const newHp = Math.min(newPlayer.maxHp, newPlayer.hp + healAmount);
    newPlayer = { ...newPlayer, hp: newHp };
    events.push({ type: 'player_healed', amount: healAmount });
    events.push({ type: 'suit_effect', suit: 'hearts', value: healAmount });
  }

  if (!card.joker && card.suit === 'clubs') {
    let armorAmount = config.combat.baseClubArmor;
    armorAmount += relicManager.suitBonus('clubs');
    if (powerType === 'GUARD') {
      armorAmount += config.powerCards.GUARD.armorAmount * relicManager.powerMultiplier('GUARD');
    }
    newPlayer = { ...newPlayer, armor: newPlayer.armor + armorAmount };
    events.push({ type: 'armor_gained', amount: armorAmount });
    events.push({ type: 'suit_effect', suit: 'clubs', value: armorAmount });
  }

  if (!card.joker && card.suit === 'diamonds') {
    let goldAmount = config.combat.baseDiamondGold;
    goldAmount += relicManager.suitBonus('diamonds');
    if (powerType === 'GOLD') {
      goldAmount += config.powerCards.GOLD.goldAmount * relicManager.powerMultiplier('GOLD');
    }
    newPlayer = { ...newPlayer, gold: newPlayer.gold + goldAmount };
    events.push({ type: 'gold_gained', amount: goldAmount });
    events.push({ type: 'suit_effect', suit: 'diamonds', value: goldAmount });
  }

  // A power is independent of its card's suit. Matching suits were combined
  // above to preserve their existing event amounts and avoid double application.
  if (powerType === 'HEAL' && card.suit !== 'hearts') {
    const amount = config.powerCards.HEAL.healAmount * relicManager.powerMultiplier('HEAL');
    newPlayer = { ...newPlayer, hp: Math.min(newPlayer.maxHp, newPlayer.hp + amount) };
    events.push({ type: 'player_healed', amount });
  }
  if (powerType === 'GUARD' && card.suit !== 'clubs') {
    const amount = config.powerCards.GUARD.armorAmount * relicManager.powerMultiplier('GUARD');
    newPlayer = { ...newPlayer, armor: newPlayer.armor + amount };
    events.push({ type: 'armor_gained', amount });
  }
  if (powerType === 'GOLD' && card.suit !== 'diamonds') {
    const amount = config.powerCards.GOLD.goldAmount * relicManager.powerMultiplier('GOLD');
    newPlayer = { ...newPlayer, gold: newPlayer.gold + amount };
    events.push({ type: 'gold_gained', amount });
  }

  // Handle power card effects
  if (powerType) {
    events.push({ type: 'power_activated', powerType, card });
    if (powerType === 'WILD') events.push({ type: 'wild_activated' });
  }

  // Update accumulated damage
  const newAccumulatedDamage = Math.floor(baseDamage * jokerMultiplier);

  // Update battle state
  const newBattle: BattleState = {
    ...battle,
    tableau: newTableau,
    deck: remainingDeck,
    discard: newDiscard,
    activeCard: card,
    chain: [...battle.chain, card],
    accumulatedDamage: newAccumulatedDamage,
    wildActive: powerType === 'WILD',
    chainBaseDamage: baseDamage,
    jokerMultiplier,
    lifestealMultiplier,
  };

  const newState: RunState = {
    ...state,
    player: newPlayer,
    battle: newBattle,
  };

  // Check if tableau is cleared
  if (isTableauEmpty(newTableau)) {
    return resolveTableauCleared(newState, config, events);
  }

  return { state: newState, events };
}

/**
 * Draw a card from the deck (ends the chain)
 */
export function drawCard(state: RunState, config: GameConfig): ActionResult {
  const events: GameEvent[] = [];

  if (!state.battle || state.phase !== 'battle') {
    return { state, events };
  }

  const battle = state.battle;

  // First, resolve the chain if there is accumulated damage
  let newState = state;
  if (battle.accumulatedDamage > 0) {
    const resolveResult = resolveChain(newState, config);
    newState = resolveResult.state;
    events.push(...resolveResult.events);

    // Check if enemy died
    if (newState.battle && newState.battle.enemy.hp <= 0) {
      return handleEnemyDeath(newState, config, events);
    }
  }

  // A successful player turn staggers the enemy. Short/empty chains expose the player.
  if (battle.chain.length >= MIN_ATTACK_CHAIN) events.push({ type: 'enemy_staggered', chainLength: battle.chain.length });
  if (battle.chain.length < MIN_ATTACK_CHAIN && newState.battle && newState.battle.enemy.hp > 0) {
    const attackResult = enemyAttack(newState, config);
    newState = attackResult.state;
    events.push(...attackResult.events);

    // Check if player died
    if (newState.player.hp <= 0) {
      return handlePlayerDeath(newState, events);
    }
  }

  if (!newState.battle) {
    return { state: newState, events };
  }

  const updatedBattle = newState.battle;

  // Check if deck is empty and no legal moves
  if (updatedBattle.deck.length === 0 && !hasLegalMoves(updatedBattle)) {
    const reshuffleResult = reshuffleDeck(newState, config);
    newState = reshuffleResult.state;
    events.push(...reshuffleResult.events);
  }

  if (!newState.battle || newState.battle.deck.length === 0) {
    // Still no cards, check again for moves
    if (newState.battle && !hasLegalMoves(newState.battle)) {
      // Do not deal a second enemy hit merely because the deck is exhausted.
      const reshuffleResult2 = reshuffleDeck(newState, config);
      newState = reshuffleResult2.state;
      events.push(...reshuffleResult2.events);
    }
    return { state: newState, events };
  }

  // Draw a card
  const newDeck = [...newState.battle.deck];
  const drawnCard = newDeck.shift()!;
  const newDiscard = newState.battle.activeCard
    ? [...newState.battle.discard, newState.battle.activeCard]
    : newState.battle.discard;

  if (drawnCard.joker) events.push({ type: 'joker_activated', color: drawnCard.joker });
  const finalBattle: BattleState = {
    ...newState.battle,
    deck: newDeck,
    discard: newDiscard,
    activeCard: drawnCard,
    chain: [],
    accumulatedDamage: 0,
    wildActive: false,
    chainBaseDamage: 0,
    jokerMultiplier: drawnCard.joker === 'black' ? 5 : 1,
    lifestealMultiplier: drawnCard.joker === 'red' ? 1 : 0,
    isFirstChain: false,
    turnNumber: newState.battle.turnNumber + 1,
  };

  return {
    state: { ...newState, battle: finalBattle },
    events,
  };
}

function resolveChain(state: RunState, _config: GameConfig): ActionResult {
  const events: GameEvent[] = [];

  if (!state.battle) {
    return { state, events };
  }

  const damage = state.battle.accumulatedDamage;
  const chainLength = state.battle.chain.length;

  events.push({ type: 'chain_resolved', totalDamage: damage, chainLength });

  // Apply damage to enemy
  const newEnemyHp = Math.max(0, state.battle.enemy.hp - damage);
  const newEnemy = { ...state.battle.enemy, hp: newEnemyHp };

  // Red joker captures the multiplier at activation, preserving joker order.
  const jokerHeal = Math.floor((state.battle.chainBaseDamage ?? damage) * (state.battle.lifestealMultiplier ?? 0) * .3);
  // Vampiric healing
  let newPlayer = state.player;
  {
    const healAmount = RelicManager.of(state.player.relics).chainHeal(damage);
    if (healAmount > 0) {
      newPlayer = {
        ...newPlayer,
        hp: Math.min(newPlayer.maxHp, newPlayer.hp + healAmount),
      };
      events.push({ type: 'player_healed', amount: healAmount });
    }
  }

  if (jokerHeal > 0) {
    const actual = Math.min(jokerHeal, newPlayer.maxHp - newPlayer.hp);
    newPlayer = { ...newPlayer, hp: newPlayer.hp + actual };
    events.push({ type: 'player_healed', amount: actual });
  }

  const newBattle: BattleState = {
    ...state.battle,
    enemy: newEnemy,
    accumulatedDamage: 0,
    chainBaseDamage: 0,
    jokerMultiplier: 1,
    lifestealMultiplier: 0,
  };

  return {
    state: { ...state, battle: newBattle, player: newPlayer },
    events,
  };
}

function resolveTableauCleared(
  state: RunState,
  config: GameConfig,
  existingEvents: GameEvent[]
): ActionResult {
  const events = [...existingEvents];

  if (!state.battle) {
    return { state, events };
  }

  // Resolve chain damage first
  const resolveResult = resolveChain(state, config);
  let newState = resolveResult.state;
  events.push(...resolveResult.events);

  events.push({ type: 'tableau_cleared', bonusReward: true });

  // Clearing the solitaire opens the boss; an exhausted boss hand is recycled
  // rather than awarding a victory without dealing its remaining HP.
  if (newState.battle?.mode === 'boss' && newState.battle.enemy.hp > 0) {
    return { state: refillBossHand(newState), events };
  }

  // The last ordinary opponent yields when the solitaire is completed.
  if (newState.battle) {
    const newEnemy = { ...newState.battle.enemy, hp: 0 };
    newState = {
      ...newState,
      battle: { ...newState.battle, enemy: newEnemy },
    };
  }

  return handleEnemyDeath(newState, config, events);
}

function enemyAttack(state: RunState, _config: GameConfig): ActionResult {
  const events: GameEvent[] = [];

  if (!state.battle) {
    return { state, events };
  }

  const enemy = state.battle.enemy;
  const intent = enemy.intents[enemy.currentIntentIndex];

  if (intent.type === 'attack') {
    const damage = intent.value;
    const blocked = Math.min(state.player.armor, damage);
    const actualDamage = damage - blocked;

    events.push({ type: 'enemy_attacked', damage, blocked });

    const newPlayer = {
      ...state.player,
      hp: state.player.hp - actualDamage,
      armor: 0, // Armor resets after absorbing
    };

    // Advance enemy intent
    const nextIntentIndex = (enemy.currentIntentIndex + 1) % enemy.intents.length;
    const newEnemy = { ...enemy, currentIntentIndex: nextIntentIndex };

    return {
      state: {
        ...state,
        player: newPlayer,
        battle: { ...state.battle, enemy: newEnemy },
      },
      events,
    };
  }

  // For defend/buff/debuff, just advance intent (simplified for now)
  const nextIntentIndex = (enemy.currentIntentIndex + 1) % enemy.intents.length;
  const newEnemy = { ...enemy, currentIntentIndex: nextIntentIndex };

  return {
    state: { ...state, battle: { ...state.battle, enemy: newEnemy } },
    events,
  };
}

function reshuffleDeck(state: RunState, _config: GameConfig): ActionResult {
  const events: GameEvent[] = [];

  if (!state.battle) {
    return { state, events };
  }

  const rng = RNG.fromState(state.rngState);

  // Combine discard and active card into new deck
  const cardsToShuffle = [...state.battle.discard];
  if (state.battle.activeCard) {
    cardsToShuffle.push(state.battle.activeCard);
  }

  const newDeck = rng.shuffle(cardsToShuffle);
  const newActiveCard = newDeck.shift() || null;

  events.push({ type: 'deck_reshuffled' });

  const newBattle: BattleState = {
    ...state.battle,
    deck: newDeck,
    discard: [],
    activeCard: newActiveCard,
    chain: [],
    accumulatedDamage: 0,
    wildActive: false,
    chainBaseDamage: 0,
    jokerMultiplier: newActiveCard?.joker === 'black' ? 5 : 1,
    lifestealMultiplier: newActiveCard?.joker === 'red' ? 1 : 0,
  };

  return {
    state: { ...state, battle: newBattle, rngState: rng.getState() },
    events,
  };
}

function handleEnemyDeath(
  state: RunState,
  config: GameConfig,
  existingEvents: GameEvent[]
): ActionResult {
  const events = [...existingEvents];
  events.push({ type: 'enemy_died' });
  events.push({ type: 'battle_won' });

  const isFinalBoss = state.battle?.mode === 'boss';
  void config;

  if (isFinalBoss) {
    events.push({ type: 'run_won' });
    return {
      state: { ...state, phase: 'victory', battle: null },
      events,
    };
  }

  return {
    state: { ...state, phase: 'reward', battle: state.battle ? { ...state.battle, chain: [], accumulatedDamage: 0, chainBaseDamage: 0, jokerMultiplier: state.battle.activeCard?.joker === 'black' ? 5 : 1, lifestealMultiplier: state.battle.activeCard?.joker === 'red' ? 1 : 0 } : null },
    events,
  };
}

function handlePlayerDeath(state: RunState, existingEvents: GameEvent[]): ActionResult {
  const events = [...existingEvents];
  events.push({ type: 'battle_lost' });

  return {
    state: { ...state, phase: 'defeat', battle: null },
    events,
  };
}

/**
 * Choose a relic from reward screen
 */
export function chooseRelic(state: RunState, relicId: string): ActionResult {
  const events: GameEvent[] = [];

  if (state.phase !== 'reward') {
    return { state, events };
  }

  const relic = state.availableRewards.find((r) => r.id === relicId);
  if (!relic) {
    return { state, events };
  }

  events.push({ type: 'relic_chosen', relic });

  const newPlayer = {
    ...state.player,
    relics: [...state.player.relics, relic],
  };

  return {
    state: {
      ...state,
      player: newPlayer,
      phase: state.rewardKind === 'starter' ? 'battle' : 'shop',
      rewardKind: 'battle',
      availableRewards: [],
    },
    events,
  };
}

/**
 * Skip reward selection
 */
export function skipReward(state: RunState): ActionResult {
  if (state.phase !== 'reward') {
    return { state, events: [] };
  }

  return {
    state: { ...state, phase: state.rewardKind === 'starter' ? 'battle' : 'shop', rewardKind: 'battle', availableRewards: [] },
    events: [],
  };
}

/**
 * Purchase healing at shop
 */
export function buyHealing(state: RunState, config: GameConfig): ActionResult {
  const events: GameEvent[] = [];

  if (state.phase !== 'shop') {
    return { state, events };
  }

  if (state.player.gold < config.shop.healCost) {
    return { state, events };
  }

  const newHp = Math.min(state.player.maxHp, state.player.hp + config.shop.healAmount);
  const newPlayer = {
    ...state.player,
    hp: newHp,
    gold: state.player.gold - config.shop.healCost,
  };

  events.push({
    type: 'shop_purchase',
    item: 'healing',
    cost: config.shop.healCost,
  });
  events.push({ type: 'player_healed', amount: config.shop.healAmount });

  return { state: { ...state, player: newPlayer }, events };
}

/**
 * Purchase relic at shop
 */
export function buyRelic(
  state: RunState,
  relicId: string,
  allRelics: Relic[],
  config: GameConfig
): ActionResult {
  const events: GameEvent[] = [];

  if (state.phase !== 'shop') {
    return { state, events };
  }

  const relic = allRelics.find((r) => r.id === relicId);
  if (!relic) {
    return { state, events };
  }

  if (state.player.gold < config.shop.relicBaseCost) {
    return { state, events };
  }

  // Don't allow duplicate relics
  if (state.player.relics.some((r) => r.id === relicId)) {
    return { state, events };
  }

  const newPlayer = {
    ...state.player,
    relics: [...state.player.relics, relic],
    gold: state.player.gold - config.shop.relicBaseCost,
  };

  events.push({
    type: 'shop_purchase',
    item: relic.name,
    cost: config.shop.relicBaseCost,
  });
  events.push({ type: 'relic_chosen', relic });

  return { state: { ...state, player: newPlayer }, events };
}

/**
 * Leave shop and proceed to next battle
 */
export function leaveShop(state: RunState, config?: GameConfig): ActionResult {
  if (state.phase !== 'shop') {
    return { state, events: [] };
  }

  const nextFight = state.currentFight + 1;
  const spec = config?.runStructure[nextFight];
  const events: GameEvent[] = [];
  let player = state.player;
  // Entering a new act: max HP grows and the player is healed (config.run.actStart).
  if (config?.run && spec && spec.fightInAct === 1 && (spec.act ?? 1) > 1) {
    const { maxHpBonus, healPercent } = config.run.actStart;
    const maxHp = player.maxHp + maxHpBonus;
    const heal = Math.max(0, Math.min(maxHp, player.hp + maxHpBonus + Math.round(maxHp * healPercent)) - player.hp);
    player = { ...player, maxHp, hp: player.hp + heal };
    events.push({ type: 'act_started', act: spec.act ?? 1, maxHpBonus, healed: heal });
  }

  return {
    state: {
      ...state,
      player,
      currentFight: nextFight,
      phase: 'battle',
    },
    events,
  };
}

/**
 * Start a new run
 */
export function startRun(seed: string, config: GameConfig): RunState {
  const rng = new RNG(seed);
  return {
    seed,
    currentFight: 0,
    player: {
      hp: config.player.startingHp,
      maxHp: config.player.maxHp,
      armor: 0,
      gold: 0,
      relics: [],
    },
    battle: null,
    phase: 'battle',
    availableRewards: [],
    rngState: rng.getState(),
  };
}

/**
 * Set up rewards after battle
 */
export function setupRewards(state: RunState, allRelics: Relic[]): RunState {
  const rng = RNG.fromState(state.rngState);

  // Filter out already owned relics
  const availableRelics = allRelics.filter(
    (r) => !state.player.relics.some((owned) => owned.id === r.id)
  );

  const rewards = rng.pick(availableRelics, 3);

  return {
    ...state,
    availableRewards: rewards,
    rngState: rng.getState(),
  };
}

/**
 * Start the next battle
 */
export function startNextBattle(
  state: RunState,
  enemiesData: EnemiesData,
  config: GameConfig
): RunState {
  const rng = RNG.fromState(state.rngState);
  const enteringBoss = !!state.battle && isTableauEmpty(state.battle.tableau);
  const tier: 'normal' | 'elite' | 'boss' = enteringBoss ? 'boss' : state.currentFight > 0 && state.currentFight % 3 === 0 ? 'elite' : 'normal';
  const act = Math.min(enemiesData.acts?.length ?? 1, Math.floor(state.currentFight / 3) + 1);
  const data = rng.pickOne(enemiesForAct(enemiesData[tier], act));
  const levelHp = 10 + state.currentFight * 6;
  const remaining = state.battle?.tableau.flatMap(col => col.cards);
  // Each ordinary card deals at least one damage even when banked alone.
  // Powers, spades, combos and relics only increase this conservative allowance.
  const budget = remaining?.filter(card => !card.joker).length ?? config.tableau.columns * config.tableau.rows - 2;
  const hp = enteringBoss ? 48 : Math.max(1, Math.min(levelHp, budget));
  const enemyData = { ...data, id: `${data.id}-level-${state.currentFight + 1}`, hp, tier };
  if (state.battle) {
    const next = { ...state, rngState: rng.getState(), phase: 'battle' as const,
      battle: { ...state.battle, enemy: createEnemy(enemyData, { tier, act }), isFirstChain: true } };
    return enteringBoss ? refillBossHand({ ...next, battle: { ...next.battle, mode: 'boss' } }) : next;
  }
  const extra = state.player.relics.find(r => r.effect.type === 'extraPowerCards');
  return setupBattle({ ...state, rngState: rng.getState() }, enemyData,
    (data.powerCardCount ?? enemiesData.defaults.powerCardCount[tier]) + (typeof extra?.effect.value === 'number' ? extra.effect.value : 0), config, { tier, act });
}

/** Reuse the collected physical pack as seven open boss slots, never a new solitaire. */
function refillBossHand(state: RunState): RunState {
  if (!state.battle) return state;
  const battle = state.battle;
  const rng = RNG.fromState(state.rngState);
  const cards = rng.shuffle([...battle.discard, ...battle.deck, ...battle.tableau.flatMap(col => col.cards)]);
  const tableau = Array.from({ length: 7 }, () => ({ cards: cards.length ? [cards.shift()!] : [] }));
  return { ...state, rngState: rng.getState(), battle: { ...battle, tableau, deck: cards, discard: [], mode: 'boss',
    chain: [], accumulatedDamage: 0, chainBaseDamage: 0, jokerMultiplier: battle.activeCard?.joker === 'black' ? 5 : 1,
    lifestealMultiplier: battle.activeCard?.joker === 'red' ? 1 : 0 } };
}
