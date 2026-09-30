import {
  Card,
  Suit,
  PowerType,
  PowerCard,
  Enemy,
  TableauColumn,
  BattleState,
  PlayerState,
  RunState,
  GameConfig,
} from './types';
import { RNG } from './RNG';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const POWER_TYPES: PowerType[] = ['CRIT', 'HEAL', 'GUARD', 'GOLD', 'BOMB', 'WILD', 'ECHO'];

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank, suit, id: `card-${id++}` });
    }
  }
  deck.push({ id: 'joker-red', rank: 0, suit: 'hearts', joker: 'red' }, { id: 'joker-black', rank: 0, suit: 'spades', joker: 'black' });
  return deck;
}

export function createInitialPlayerState(config: GameConfig): PlayerState {
  return {
    hp: config.player.startingHp,
    maxHp: config.player.maxHp,
    armor: 0,
    gold: 0,
    relics: [],
  };
}

export function createInitialRunState(seed: string, config: GameConfig): RunState {
  const rng = new RNG(seed);
  return {
    seed,
    currentFight: 0,
    player: createInitialPlayerState(config),
    battle: null,
    phase: 'start',
    availableRewards: [],
    rngState: rng.getState(),
  };
}

export interface EnemyData {
  id: string;
  name: string;
  hp: number;
  intents: { type: 'attack' | 'defend' | 'buff' | 'debuff'; value: number }[];
  sprite: string;
  powerCardCount?: number;
}

export interface EnemiesData {
  normal: EnemyData[];
  elite: EnemyData[];
  boss: EnemyData[];
  defaults: {
    powerCardCount: {
      normal: number;
      elite: number;
      boss: number;
    };
  };
}

export function createEnemy(data: EnemyData): Enemy {
  return {
    id: data.id,
    name: data.name,
    maxHp: data.hp,
    hp: data.hp,
    intents: data.intents,
    currentIntentIndex: 0,
    sprite: data.sprite,
  };
}

export function setupBattle(
  state: RunState,
  enemyData: EnemyData,
  powerCardCount: number,
  config: GameConfig
): RunState {
  const rng = RNG.fromState(state.rngState);

  const deck = rng.shuffle(createDeck());
  const tableau: TableauColumn[] = [];

  for (let col = 0; col < config.tableau.columns; col++) {
    const cards = deck.splice(0, config.tableau.rows);
    tableau.push({ cards });
  }

  const activeCard = deck.shift() || null;

  // Assign power cards to random tableau positions
  const allTableauCards: { col: number; row: number; card: Card }[] = [];
  tableau.forEach((column, col) => {
    column.cards.forEach((card, row) => {
      if (!card.joker) allTableauCards.push({ col, row, card });
    });
  });

  const powerPositions = rng.pick(allTableauCards, powerCardCount);
  const powerCards: PowerCard[] = powerPositions.map((pos) => ({
    cardId: pos.card.id,
    type: rng.pickOne(POWER_TYPES),
  }));

  const battle: BattleState = {
    tableau,
    deck,
    discard: [],
    activeCard,
    chain: [],
    accumulatedDamage: 0,
    chainBaseDamage: 0,
    jokerMultiplier: activeCard?.joker === 'black' ? 5 : 1,
    lifestealMultiplier: activeCard?.joker === 'red' ? 1 : 0,
    enemy: createEnemy(enemyData),
    powerCards,
    wildActive: false,
    isFirstChain: true,
    turnNumber: 0,
  };

  return {
    ...state,
    battle,
    phase: 'battle',
    rngState: rng.getState(),
  };
}

export function getExposedCards(tableau: TableauColumn[]): Card[] {
  return tableau
    .map((col) => (col.cards.length > 0 ? col.cards[col.cards.length - 1] : null))
    .filter((card): card is Card => card !== null);
}

export function isTableauEmpty(tableau: TableauColumn[]): boolean {
  return tableau.every((col) => col.cards.length === 0);
}

export function hasLegalMoves(battle: BattleState): boolean {
  if (!battle.activeCard) return false;

  const exposed = getExposedCards(battle.tableau);
  return exposed.some((card) => canConnect(card, battle.activeCard!, battle.wildActive));
}

export function canConnect(
  card: Card,
  activeCard: Card,
  wildActive: boolean = false
): boolean {
  // WILD explicitly allows any next rank; jokers apply their color rule.
  if (wildActive) return true;
  if (card.joker) return true;
  if (activeCard.joker) {
    const red = card.suit === 'hearts' || card.suit === 'diamonds';
    return activeCard.joker === 'red' ? red : !red;
  }

  const diff = Math.abs(card.rank - activeCard.rank);
  // A-K wrap is ALWAYS legal (base rule)
  if (diff === 1 || diff === 12) return true;
  return false;
}

export function findCardColumn(tableau: TableauColumn[], cardId: string): number {
  return tableau.findIndex((col) =>
    col.cards.some((c) => c.id === cardId)
  );
}

export function isCardExposed(tableau: TableauColumn[], cardId: string): boolean {
  const col = tableau.find((col) => col.cards.some((c) => c.id === cardId));
  if (!col || col.cards.length === 0) return false;
  return col.cards[col.cards.length - 1].id === cardId;
}

export function getPowerType(powerCards: PowerCard[], cardId: string): PowerType | null {
  const pc = powerCards.find((p) => p.cardId === cardId);
  return pc ? pc.type : null;
}
