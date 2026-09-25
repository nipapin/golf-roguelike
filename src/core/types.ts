export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type PowerType = 'CRIT' | 'HEAL' | 'GUARD' | 'GOLD' | 'BOMB' | 'WILD' | 'ECHO';

export interface Card {
  readonly rank: number; // 1-13 (Ace=1, King=13)
  readonly suit: Suit;
  readonly id: string; // unique identifier
}

export interface PowerCard {
  readonly cardId: string;
  readonly type: PowerType;
}

export interface Enemy {
  readonly id: string;
  readonly name: string;
  readonly maxHp: number;
  readonly hp: number;
  readonly intents: Intent[];
  readonly currentIntentIndex: number;
  readonly sprite: string;
  readonly scale?: number;
  readonly tint?: string;
  readonly crown?: boolean;
  readonly tier?: 'normal' | 'elite' | 'boss';
}

export interface Intent {
  readonly type: 'attack' | 'defend' | 'buff' | 'debuff';
  readonly value: number;
}

export interface RelicEffect {
  readonly type: string;
  readonly value?: number | boolean;
  readonly rank?: number;
  readonly bonus?: number;
  readonly powerType?: PowerType;
  readonly ratio?: number;
}

export interface Relic {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly effect: RelicEffect;
}

export interface TableauColumn {
  readonly cards: Card[];
}

export interface BattleState {
  readonly tableau: TableauColumn[];
  readonly deck: Card[];
  readonly discard: Card[];
  readonly activeCard: Card | null;
  readonly chain: Card[];
  readonly accumulatedDamage: number;
  readonly enemy: Enemy;
  readonly powerCards: PowerCard[];
  readonly wildActive: boolean;
  readonly isFirstChain: boolean;
  readonly turnNumber: number;
}

export interface PlayerState {
  readonly hp: number;
  readonly maxHp: number;
  readonly armor: number;
  readonly gold: number;
  readonly relics: Relic[];
}

export interface RunState {
  readonly seed: string;
  readonly currentFight: number;
  readonly player: PlayerState;
  readonly battle: BattleState | null;
  readonly phase: 'start' | 'battle' | 'reward' | 'shop' | 'victory' | 'defeat';
  readonly availableRewards: Relic[];
  readonly rngState: number;
}

export interface GameConfig {
  readonly player: {
    readonly startingHp: number;
    readonly maxHp: number;
  };
  readonly combat: {
    readonly baseSpadeDamageBonus: number;
    readonly baseHeartHeal: number;
    readonly baseClubArmor: number;
    readonly baseDiamondGold: number;
  };
  readonly powerCards: {
    readonly CRIT: { readonly damageMultiplier: number };
    readonly HEAL: { readonly healAmount: number };
    readonly GUARD: { readonly armorAmount: number };
    readonly GOLD: { readonly goldAmount: number };
    readonly BOMB: { readonly flatDamage: number };
    readonly WILD: { readonly description: string };
    readonly ECHO: { readonly comboBonus: number };
  };
  readonly tableau: {
    readonly columns: number;
    readonly rows: number;
  };
  readonly shop: {
    readonly healCost: number;
    readonly healAmount: number;
    readonly relicBaseCost: number;
  };
  readonly runStructure: ReadonlyArray<{
    readonly type: string;
    readonly enemyTier: 'normal' | 'elite' | 'boss';
  }>;
}

export type ActionResult = {
  readonly state: RunState;
  readonly events: GameEvent[];
};

export type GameEvent =
  | { type: 'card_played'; card: Card; chainPosition: number; damage: number }
  | { type: 'suit_effect'; suit: Suit; value: number }
  | { type: 'power_activated'; powerType: PowerType; card: Card }
  | { type: 'chain_resolved'; totalDamage: number; chainLength: number }
  | { type: 'enemy_attacked'; damage: number; blocked: number }
  | { type: 'enemy_died' }
  | { type: 'player_healed'; amount: number }
  | { type: 'armor_gained'; amount: number }
  | { type: 'gold_gained'; amount: number }
  | { type: 'tableau_cleared'; bonusReward: boolean }
  | { type: 'deck_reshuffled' }
  | { type: 'wild_activated' }
  | { type: 'battle_won' }
  | { type: 'battle_lost' }
  | { type: 'run_won' }
  | { type: 'relic_chosen'; relic: Relic }
  | { type: 'shop_purchase'; item: string; cost: number };
