import {
  Card,
  Suit,
  PowerType,
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
  EnemyData,
  EnemiesData,
  createDeck,
} from './GameState';
import { calculateCardDamage } from './DamageCalculator';

function hasAceKingWrap(relics: Relic[]): boolean {
  return relics.some((r) => r.effect.type === 'aceKingWrap');
}

function getFirstChainBonus(relics: Relic[]): number {
  const relic = relics.find((r) => r.effect.type === 'firstChainBonus');
  return relic && typeof relic.effect.value === 'number' ? relic.effect.value : 0;
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
  const aceKingWrap = hasAceKingWrap(state.player.relics);

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
  if (!battle.activeCard || !canConnect(card, battle.activeCard, aceKingWrap, battle.wildActive)) {
    return { state, events };
  }

  // Remove card from tableau
  const newTableau: TableauColumn[] = battle.tableau.map((col, i) =>
    i === colIndex ? { cards: col.cards.slice(0, -1) } : col
  );

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

  events.push({
    type: 'card_played',
    card,
    chainPosition,
    damage: damageResult.totalDamage,
  });

  // Handle immediate suit effects (hearts, clubs, diamonds)
  let newPlayer = state.player;

  if (card.suit === 'hearts') {
    let healAmount = config.combat.baseHeartHeal;
    const heartBonus = state.player.relics.find((r) => r.effect.type === 'heartHealBonus');
    if (heartBonus && typeof heartBonus.effect.value === 'number') {
      healAmount += heartBonus.effect.value;
    }
    if (powerType === 'HEAL') {
      const doublePower = state.player.relics.find(
        (r) => r.effect.type === 'doublePower' && r.effect.powerType === 'HEAL'
      );
      healAmount += config.powerCards.HEAL.healAmount * (doublePower ? 2 : 1);
    }
    const newHp = Math.min(newPlayer.maxHp, newPlayer.hp + healAmount);
    newPlayer = { ...newPlayer, hp: newHp };
    events.push({ type: 'player_healed', amount: healAmount });
    events.push({ type: 'suit_effect', suit: 'hearts', value: healAmount });
  }

  if (card.suit === 'clubs') {
    let armorAmount = config.combat.baseClubArmor;
    const clubBonus = state.player.relics.find((r) => r.effect.type === 'clubArmorBonus');
    if (clubBonus && typeof clubBonus.effect.value === 'number') {
      armorAmount += clubBonus.effect.value;
    }
    if (powerType === 'GUARD') {
      const doublePower = state.player.relics.find(
        (r) => r.effect.type === 'doublePower' && r.effect.powerType === 'GUARD'
      );
      armorAmount += config.powerCards.GUARD.armorAmount * (doublePower ? 2 : 1);
    }
    newPlayer = { ...newPlayer, armor: newPlayer.armor + armorAmount };
    events.push({ type: 'armor_gained', amount: armorAmount });
    events.push({ type: 'suit_effect', suit: 'clubs', value: armorAmount });
  }

  if (card.suit === 'diamonds') {
    let goldAmount = config.combat.baseDiamondGold;
    const diamondBonus = state.player.relics.find((r) => r.effect.type === 'diamondGoldBonus');
    if (diamondBonus && typeof diamondBonus.effect.value === 'number') {
      goldAmount += diamondBonus.effect.value;
    }
    if (powerType === 'GOLD') {
      const doublePower = state.player.relics.find(
        (r) => r.effect.type === 'doublePower' && r.effect.powerType === 'GOLD'
      );
      goldAmount += config.powerCards.GOLD.goldAmount * (doublePower ? 2 : 1);
    }
    newPlayer = { ...newPlayer, gold: newPlayer.gold + goldAmount };
    events.push({ type: 'gold_gained', amount: goldAmount });
    events.push({ type: 'suit_effect', suit: 'diamonds', value: goldAmount });
  }

  // Handle power card effects
  if (powerType) {
    events.push({ type: 'power_activated', powerType, card });

    if (powerType === 'WILD') {
      events.push({ type: 'wild_activated' });
    }
  }

  // Update accumulated damage
  const newAccumulatedDamage = battle.accumulatedDamage + damageResult.totalDamage;

  // Update battle state
  const newBattle: BattleState = {
    ...battle,
    tableau: newTableau,
    discard: newDiscard,
    activeCard: card,
    chain: [...battle.chain, card],
    accumulatedDamage: newAccumulatedDamage,
    wildActive: powerType === 'WILD',
  };

  let newState: RunState = {
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

  // Enemy attacks if alive
  if (newState.battle && newState.battle.enemy.hp > 0) {
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
  const aceKingWrap = hasAceKingWrap(newState.player.relics);

  // Check if deck is empty and no legal moves
  if (updatedBattle.deck.length === 0 && !hasLegalMoves(updatedBattle, aceKingWrap)) {
    const reshuffleResult = reshuffleDeck(newState, config);
    newState = reshuffleResult.state;
    events.push(...reshuffleResult.events);
  }

  if (!newState.battle || newState.battle.deck.length === 0) {
    // Still no cards, check again for moves
    if (newState.battle && !hasLegalMoves(newState.battle, aceKingWrap)) {
      // Enemy attacks again, then reshuffle
      const attackResult2 = enemyAttack(newState, config);
      newState = attackResult2.state;
      events.push(...attackResult2.events);

      if (newState.player.hp <= 0) {
        return handlePlayerDeath(newState, events);
      }

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

  const finalBattle: BattleState = {
    ...newState.battle,
    deck: newDeck,
    discard: newDiscard,
    activeCard: drawnCard,
    chain: [],
    accumulatedDamage: 0,
    wildActive: false,
    isFirstChain: false,
    turnNumber: newState.battle.turnNumber + 1,
  };

  return {
    state: { ...newState, battle: finalBattle },
    events,
  };
}

function resolveChain(state: RunState, config: GameConfig): ActionResult {
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

  // Vampiric healing
  const vampiricRelic = state.player.relics.find((r) => r.effect.type === 'vampiric');
  let newPlayer = state.player;
  if (vampiricRelic && typeof vampiricRelic.effect.ratio === 'number') {
    const healAmount = Math.floor(damage / vampiricRelic.effect.ratio);
    if (healAmount > 0) {
      newPlayer = {
        ...newPlayer,
        hp: Math.min(newPlayer.maxHp, newPlayer.hp + healAmount),
      };
      events.push({ type: 'player_healed', amount: healAmount });
    }
  }

  const newBattle: BattleState = {
    ...state.battle,
    enemy: newEnemy,
    accumulatedDamage: 0,
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

  // Instant victory
  if (newState.battle) {
    const newEnemy = { ...newState.battle.enemy, hp: 0 };
    newState = {
      ...newState,
      battle: { ...newState.battle, enemy: newEnemy },
    };
  }

  return handleEnemyDeath(newState, config, events);
}

function enemyAttack(state: RunState, config: GameConfig): ActionResult {
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

function reshuffleDeck(state: RunState, config: GameConfig): ActionResult {
  const events: GameEvent[] = [];

  if (!state.battle) {
    return { state, events };
  }

  const rng = RNG.fromState(state.rngState);

  // Combine discard and active card into new deck
  let cardsToShuffle = [...state.battle.discard];
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

  const isFinalBoss = state.currentFight >= config.runStructure.length - 1;

  if (isFinalBoss) {
    events.push({ type: 'run_won' });
    return {
      state: { ...state, phase: 'victory', battle: null },
      events,
    };
  }

  return {
    state: { ...state, phase: 'reward', battle: null },
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
      phase: 'shop',
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
    state: { ...state, phase: 'shop', availableRewards: [] },
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
export function leaveShop(state: RunState): ActionResult {
  if (state.phase !== 'shop') {
    return { state, events: [] };
  }

  return {
    state: {
      ...state,
      currentFight: state.currentFight + 1,
      phase: 'battle',
    },
    events: [],
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
  if (state.currentFight >= config.runStructure.length) {
    return { ...state, phase: 'victory' };
  }

  const rng = RNG.fromState(state.rngState);
  const fightConfig = config.runStructure[state.currentFight];
  const tier = fightConfig.enemyTier;

  const enemyPool = enemiesData[tier];
  const enemyData = rng.pickOne(enemyPool);

  const powerCardCount =
    enemyData.powerCardCount ?? enemiesData.defaults.powerCardCount[tier];

  // Apply extra power cards from relics
  const extraPowerRelic = state.player.relics.find(
    (r) => r.effect.type === 'extraPowerCards'
  );
  const finalPowerCardCount =
    powerCardCount +
    (extraPowerRelic && typeof extraPowerRelic.effect.value === 'number'
      ? extraPowerRelic.effect.value
      : 0);

  const newState = setupBattle(
    { ...state, rngState: rng.getState() },
    enemyData,
    finalPowerCardCount,
    config
  );

  // Reset armor at battle start
  return {
    ...newState,
    player: { ...newState.player, armor: 0 },
  };
}
