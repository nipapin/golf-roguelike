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
  /** Inclusive act range this enemy can appear in, e.g. [1, 3]. */
  acts?: number[];
  scale?: number;
  tint?: string;
  crown?: boolean;
}

export interface EnemySpriteDef {
  /** Inclusive frame ranges inside the atlas; -1 = last frame. */
  frames: { idle: number[]; attack: number[]; hurt: number[]; dead: number[] };
  /** Source art faces right (enemies should face the player, i.e. left). */
  facesRight?: boolean;
  /** Top of the head as a fraction of the frame height from the feet (crown / emote anchor). */
  headTop?: number;
}

export interface ActDef {
  name: string;
  /** Arena palette key (ArenaBackground EncounterType). */
  encounter: string;
  /** Multiplicative tint for every enemy in the act ("#rrggbb" or null). */
  tint: string | null;
  /** Glow colour drawn behind the enemy ("#rrggbb" or null). */
  aura: string | null;
  /** Extra sprite scale for the act. */
  scale: number;
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
  sprites?: Record<string, EnemySpriteDef>;
  acts?: ActDef[];
  emotions?: EmotionThresholds;
}

export interface EmotionThresholds {
  /** HP ratio at or below which the enemy is scared. */
  scaredBelow: number;
  /** HP ratio at or below which elites/bosses become angry. */
  angryBelow: number;
  /** Angry when the next attack is at least this multiple of the enemy's weakest attack. */
  angryAttackRatio: number;
}

export interface EnemyScaling {
  tier?: 'normal' | 'elite' | 'boss';
  act?: number;
  hpMultiplier?: number;
  attackMultiplier?: number;
}

/** Enemies whose act range contains `act` (falls back to the whole pool). */
export function enemiesForAct(pool: EnemyData[], act: number): EnemyData[] {
  const matching = pool.filter((enemy) => !enemy.acts || (act >= enemy.acts[0] && act <= enemy.acts[1]));
  return matching.length ? matching : pool;
}

export function scaledHp(data: EnemyData, scaling: EnemyScaling = {}): number {
  return Math.max(1, Math.round(data.hp * (scaling.hpMultiplier ?? 1)));
}

export function createEnemy(data: EnemyData, scaling: EnemyScaling = {}): Enemy {
  const hp = scaledHp(data, scaling);
  const attack = scaling.attackMultiplier ?? 1;
  return {
    id: data.id,
    name: data.name,
    maxHp: hp,
    hp,
    intents: data.intents.map((intent) => intent.type === 'attack' ? { ...intent, value: Math.max(1, Math.round(intent.value * attack)) } : intent),
    currentIntentIndex: 0,
    sprite: data.sprite,
    ...(data.scale !== undefined ? { scale: data.scale } : {}),
    ...(data.tint !== undefined ? { tint: data.tint } : {}),
    ...(data.crown ? { crown: true } : {}),
    ...(scaling.tier ? { tier: scaling.tier } : {}),
    ...(scaling.act ? { act: scaling.act } : {}),
  };
}

export function setupBattle(
  state: RunState,
  enemyData: EnemyData,
  powerCardCount: number,
  config: GameConfig,
  scaling: EnemyScaling = {}
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
    mode: 'solitaire',
    tableau,
    deck,
    discard: [],
    activeCard,
    chain: [],
    accumulatedDamage: 0,
    chainBaseDamage: 0,
    jokerMultiplier: activeCard?.joker === 'black' ? 5 : 1,
    lifestealMultiplier: activeCard?.joker === 'red' ? 1 : 0,
    enemy: createEnemy(enemyData, scaling),
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
