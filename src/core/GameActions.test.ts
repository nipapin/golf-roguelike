import { describe, it, expect, beforeEach } from 'vitest';
import {
  playCard,
  drawCard,
  chooseRelic,
  skipReward,
  buyHealing,
  buyRelic,
  leaveShop,
  startRun,
  setupRewards,
  startNextBattle,
} from './GameActions';
import { setupBattle, createInitialRunState, EnemiesData } from './GameState';
import { RunState, BattleState, GameConfig, Relic, Card } from './types';
import { RNG } from './RNG';

const mockConfig: GameConfig = {
  player: { startingHp: 30, maxHp: 30 },
  combat: {
    baseSpadeDamageBonus: 1,
    baseHeartHeal: 1,
    baseClubArmor: 1,
    baseDiamondGold: 1,
  },
  powerCards: {
    CRIT: { damageMultiplier: 3 },
    HEAL: { healAmount: 8 },
    GUARD: { armorAmount: 8 },
    GOLD: { goldAmount: 8 },
    BOMB: { flatDamage: 12 },
    WILD: { description: 'Next play connects to any rank' },
    ECHO: { comboBonus: 2 },
  },
  tableau: { columns: 7, rows: 5 },
  shop: { healCost: 10, healAmount: 8, relicBaseCost: 15 },
  runStructure: [
    { type: 'battle', enemyTier: 'normal' },
    { type: 'battle', enemyTier: 'normal' },
    { type: 'battle', enemyTier: 'boss' },
  ],
};

const mockEnemiesData: EnemiesData = {
  normal: [
    {
      id: 'slime',
      name: 'SLIME',
      hp: 26,
      intents: [
        { type: 'attack', value: 4 },
        { type: 'attack', value: 6 },
      ],
      sprite: 'enemy-slime',
    },
  ],
  elite: [
    {
      id: 'mimic',
      name: 'MIMIC',
      hp: 55,
      intents: [{ type: 'attack', value: 8 }],
      sprite: 'enemy-mimic',
      powerCardCount: 5,
    },
  ],
  boss: [
    {
      id: 'king',
      name: 'GOLF KING',
      hp: 85,
      intents: [{ type: 'attack', value: 10 }],
      sprite: 'enemy-king',
      powerCardCount: 4,
    },
  ],
  defaults: {
    powerCardCount: { normal: 3, elite: 5, boss: 4 },
  },
};

const mockRelics: Relic[] = [
  {
    id: 'ace_king_link',
    name: 'SNAKE RING',
    description: 'Ace connects to King',
    effect: { type: 'aceKingWrap', value: true },
  },
  {
    id: 'spade_bonus',
    name: 'SHARP SPADE',
    description: '♠ deal +2',
    effect: { type: 'spadeDamageBonus', value: 2 },
  },
  {
    id: 'heart_bonus',
    name: 'RED HEART',
    description: '♥ heal +2',
    effect: { type: 'heartHealBonus', value: 2 },
  },
];

function createTestBattleState(seed: string = 'test-seed'): RunState {
  let state = startRun(seed, mockConfig);
  state = startNextBattle(state, mockEnemiesData, mockConfig);
  return state;
}

describe('playCard', () => {
  it('should reject playing non-exposed cards', () => {
    const state = createTestBattleState('play-test-1');
    const battle = state.battle!;

    // Find a card that's not on top
    const column = battle.tableau.find((col) => col.cards.length > 1)!;
    const coveredCard = column.cards[0];

    const result = playCard(state, coveredCard.id, mockConfig);

    // Should return unchanged state
    expect(result.state.battle?.chain.length).toBe(0);
    expect(result.events).toHaveLength(0);
  });

  it('should reject playing cards that cannot connect', () => {
    const state = createTestBattleState('play-test-2');
    const battle = state.battle!;

    // Find an exposed card that doesn't connect to active card
    const activeRank = battle.activeCard!.rank;
    let nonConnectingCard: Card | null = null;

    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if (diff > 1 && diff !== 12) {
        nonConnectingCard = top;
        break;
      }
    }

    if (nonConnectingCard) {
      const result = playCard(state, nonConnectingCard.id, mockConfig);
      expect(result.state.battle?.chain.length).toBe(0);
    }
  });

  it('should play a valid card and update chain', () => {
    // Try multiple seeds to find one with a playable card
    const seeds = ['play-valid-1', 'play-valid-2', 'play-valid-3', 'play-valid-4', 'test123'];
    
    for (const seed of seeds) {
      const state = createTestBattleState(seed);
      const battle = state.battle!;

      // Find a playable card (only diff === 1, since we don't have aceKingWrap relic)
      const activeRank = battle.activeCard!.rank;
      let playableCard: Card | null = null;

      for (const col of battle.tableau) {
        if (col.cards.length === 0) continue;
        const top = col.cards[col.cards.length - 1];
        const diff = Math.abs(top.rank - activeRank);
        if (diff === 1) {
          playableCard = top;
          break;
        }
      }

      if (playableCard) {
        const result = playCard(state, playableCard.id, mockConfig);
        expect(result.state.battle?.chain.length).toBe(1);
        expect(result.state.battle?.activeCard?.id).toBe(playableCard.id);
        expect(result.events.some((e) => e.type === 'card_played')).toBe(true);
        return; // Test passed
      }
    }
    
    // If no seed works, that's an issue with our RNG/setup
    throw new Error('Could not find any seed with a playable card in starting position');
  });

  it('should accumulate damage during chain', () => {
    const state = createTestBattleState('chain-damage-1');

    // Play multiple cards to build chain
    let currentState = state;
    let chainPlayed = 0;

    for (let i = 0; i < 10 && chainPlayed < 3; i++) {
      const battle = currentState.battle!;
      const activeRank = battle.activeCard!.rank;

      for (const col of battle.tableau) {
        if (col.cards.length === 0) continue;
        const top = col.cards[col.cards.length - 1];
        const diff = Math.abs(top.rank - activeRank);
        if (diff === 1) {
          const result = playCard(currentState, top.id, mockConfig);
          if (result.state.battle?.chain.length === chainPlayed + 1) {
            currentState = result.state;
            chainPlayed++;
            break;
          }
        }
      }
    }

    if (chainPlayed > 0) {
      expect(currentState.battle?.accumulatedDamage).toBeGreaterThan(0);
    }
  });

  it('should apply hearts heal immediately', () => {
    const state = createTestBattleState('hearts-test');

    // Damage player first
    const damagedState: RunState = {
      ...state,
      player: { ...state.player, hp: 20 },
    };

    const battle = damagedState.battle!;
    const activeRank = battle.activeCard!.rank;

    // Find a hearts card that can be played
    let heartsCard: Card | null = null;
    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if ((diff === 1 || diff === 12) && top.suit === 'hearts') {
        heartsCard = top;
        break;
      }
    }

    if (heartsCard) {
      const result = playCard(damagedState, heartsCard.id, mockConfig);
      expect(result.state.player.hp).toBeGreaterThan(20);
      expect(result.events.some((e) => e.type === 'player_healed')).toBe(true);
    }
  });

  it('should apply clubs armor immediately', () => {
    const state = createTestBattleState('clubs-test');
    const battle = state.battle!;
    const activeRank = battle.activeCard!.rank;

    // Find a clubs card
    let clubsCard: Card | null = null;
    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if ((diff === 1 || diff === 12) && top.suit === 'clubs') {
        clubsCard = top;
        break;
      }
    }

    if (clubsCard) {
      const result = playCard(state, clubsCard.id, mockConfig);
      expect(result.state.player.armor).toBeGreaterThan(0);
      expect(result.events.some((e) => e.type === 'armor_gained')).toBe(true);
    }
  });

  it('should apply diamonds gold immediately', () => {
    const state = createTestBattleState('diamonds-test');
    const battle = state.battle!;
    const activeRank = battle.activeCard!.rank;

    // Find a diamonds card
    let diamondsCard: Card | null = null;
    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if ((diff === 1 || diff === 12) && top.suit === 'diamonds') {
        diamondsCard = top;
        break;
      }
    }

    if (diamondsCard) {
      const result = playCard(state, diamondsCard.id, mockConfig);
      expect(result.state.player.gold).toBeGreaterThan(0);
      expect(result.events.some((e) => e.type === 'gold_gained')).toBe(true);
    }
  });
});

describe('drawCard', () => {
  it('should resolve chain damage when drawing', () => {
    let state = createTestBattleState('draw-test-1');

    // Build a small chain first
    let currentState = state;
    const battle = currentState.battle!;
    const activeRank = battle.activeCard!.rank;

    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if (diff === 1) {
        const playResult = playCard(currentState, top.id, mockConfig);
        currentState = playResult.state;
        break;
      }
    }

    if (currentState.battle?.chain.length === 1) {
      const initialEnemyHp = currentState.battle.enemy.hp;
      const accumulated = currentState.battle.accumulatedDamage;

      const drawResult = drawCard(currentState, mockConfig);

      if (drawResult.state.battle) {
        // Damage should have been applied
        expect(drawResult.events.some((e) => e.type === 'chain_resolved')).toBe(true);
      }
    }
  });

  it('should trigger enemy attack after chain resolves', () => {
    let state = createTestBattleState('enemy-attack-test');

    // Play a card then draw
    const battle = state.battle!;
    const activeRank = battle.activeCard!.rank;

    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if (diff === 1) {
        state = playCard(state, top.id, mockConfig).state;
        break;
      }
    }

    if (state.battle?.chain.length === 1) {
      const result = drawCard(state, mockConfig);
      expect(result.events.some((e) => e.type === 'enemy_attacked')).toBe(true);
    }
  });

  it('should reset armor after enemy attack', () => {
    let state = createTestBattleState('armor-reset-test');
    state = { ...state, player: { ...state.player, armor: 10 } };

    // Play a card to build chain
    const battle = state.battle!;
    const activeRank = battle.activeCard!.rank;

    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if (diff === 1) {
        state = playCard(state, top.id, mockConfig).state;
        break;
      }
    }

    if (state.battle?.chain.length === 1) {
      const result = drawCard(state, mockConfig);
      expect(result.state.player.armor).toBe(0);
    }
  });

  it('should clear chain after draw', () => {
    let state = createTestBattleState('chain-clear-test');

    // Play a card
    const battle = state.battle!;
    const activeRank = battle.activeCard!.rank;

    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if (diff === 1) {
        state = playCard(state, top.id, mockConfig).state;
        break;
      }
    }

    if (state.battle?.chain.length === 1) {
      const result = drawCard(state, mockConfig);
      expect(result.state.battle?.chain.length).toBe(0);
      expect(result.state.battle?.accumulatedDamage).toBe(0);
    }
  });
});

describe('enemy death during chain', () => {
  it('should handle enemy dying from chain damage', () => {
    let state = createTestBattleState('enemy-death-test');

    // Set enemy HP very low
    state = {
      ...state,
      battle: {
        ...state.battle!,
        enemy: { ...state.battle!.enemy, hp: 1 },
      },
    };

    // Play a card (will deal at least 1 damage)
    const battle = state.battle!;
    const activeRank = battle.activeCard!.rank;

    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if (diff === 1) {
        state = playCard(state, top.id, mockConfig).state;
        break;
      }
    }

    if (state.battle?.chain.length === 1) {
      // Draw to resolve chain
      const result = drawCard(state, mockConfig);

      // Enemy should be dead, battle won
      expect(result.events.some((e) => e.type === 'enemy_died')).toBe(true);
      expect(result.events.some((e) => e.type === 'battle_won')).toBe(true);
    }
  });
});

describe('shop actions', () => {
  it('should buy healing when player has enough gold', () => {
    const state: RunState = {
      ...createTestBattleState('shop-heal'),
      phase: 'shop',
      player: {
        hp: 20,
        maxHp: 30,
        armor: 0,
        gold: 15,
        relics: [],
      },
      battle: null,
    };

    const result = buyHealing(state, mockConfig);

    expect(result.state.player.hp).toBe(28);
    expect(result.state.player.gold).toBe(5);
  });

  it('should reject healing when not enough gold', () => {
    const state: RunState = {
      ...createTestBattleState('shop-no-gold'),
      phase: 'shop',
      player: {
        hp: 20,
        maxHp: 30,
        armor: 0,
        gold: 5,
        relics: [],
      },
      battle: null,
    };

    const result = buyHealing(state, mockConfig);

    expect(result.state.player.hp).toBe(20);
    expect(result.state.player.gold).toBe(5);
  });

  it('should buy relic when player has enough gold', () => {
    const state: RunState = {
      ...createTestBattleState('shop-relic'),
      phase: 'shop',
      player: {
        hp: 30,
        maxHp: 30,
        armor: 0,
        gold: 20,
        relics: [],
      },
      battle: null,
    };

    const result = buyRelic(state, 'spade_bonus', mockRelics, mockConfig);

    expect(result.state.player.relics.length).toBe(1);
    expect(result.state.player.relics[0].id).toBe('spade_bonus');
    expect(result.state.player.gold).toBe(5);
  });

  it('should not allow buying duplicate relics', () => {
    const state: RunState = {
      ...createTestBattleState('shop-duplicate'),
      phase: 'shop',
      player: {
        hp: 30,
        maxHp: 30,
        armor: 0,
        gold: 30,
        relics: [mockRelics[1]], // Already has spade_bonus
      },
      battle: null,
    };

    const result = buyRelic(state, 'spade_bonus', mockRelics, mockConfig);

    expect(result.state.player.relics.length).toBe(1);
    expect(result.state.player.gold).toBe(30);
  });
});

describe('reward selection', () => {
  it('should add chosen relic to player', () => {
    let state: RunState = {
      ...createTestBattleState('reward-test'),
      phase: 'reward',
      battle: null,
    };

    state = setupRewards(state, mockRelics);

    const relicToChoose = state.availableRewards[0];
    const result = chooseRelic(state, relicToChoose.id);

    expect(result.state.player.relics).toContain(relicToChoose);
    expect(result.state.phase).toBe('shop');
  });

  it('should skip reward and proceed to shop', () => {
    const state: RunState = {
      ...createTestBattleState('skip-reward'),
      phase: 'reward',
      availableRewards: mockRelics,
      battle: null,
    };

    const result = skipReward(state);

    expect(result.state.phase).toBe('shop');
    expect(result.state.player.relics.length).toBe(0);
  });
});

describe('run progression', () => {
  it('should increment fight number when leaving shop', () => {
    const state: RunState = {
      ...createTestBattleState('progress-test'),
      currentFight: 0,
      phase: 'shop',
      battle: null,
    };

    const result = leaveShop(state);

    expect(result.state.currentFight).toBe(1);
    expect(result.state.phase).toBe('battle');
  });

  it('should reach victory after defeating boss', () => {
    const state: RunState = {
      ...createTestBattleState('boss-win'),
      currentFight: 2, // Last fight (index 2 in 3-fight run)
      phase: 'battle',
    };

    // Set enemy HP to 0
    const stateWithDeadBoss: RunState = {
      ...state,
      battle: {
        ...state.battle!,
        enemy: { ...state.battle!.enemy, hp: 0 },
        accumulatedDamage: 1,
        chain: [state.battle!.tableau[0].cards[0]],
      },
    };

    const result = drawCard(stateWithDeadBoss, mockConfig);

    expect(result.events.some((e) => e.type === 'run_won')).toBe(true);
    expect(result.state.phase).toBe('victory');
  });
});

describe('save/load round-trip', () => {
  it('should serialize and deserialize run state correctly', () => {
    const state = createTestBattleState('save-test');

    // Simulate JSON save/load
    const serialized = JSON.stringify(state);
    const restored: RunState = JSON.parse(serialized);

    expect(restored.seed).toBe(state.seed);
    expect(restored.currentFight).toBe(state.currentFight);
    expect(restored.player.hp).toBe(state.player.hp);
    expect(restored.battle?.enemy.hp).toBe(state.battle?.enemy.hp);
    expect(restored.rngState).toBe(state.rngState);
  });

  it('should continue from restored state deterministically', () => {
    const state1 = createTestBattleState('determinism-test');
    const state2: RunState = JSON.parse(JSON.stringify(state1));

    // Both states should have same tableau
    expect(state1.battle?.tableau).toEqual(state2.battle?.tableau);

    // Find a playable card in state1
    const battle = state1.battle!;
    const activeRank = battle.activeCard!.rank;
    let playableCardId: string | null = null;

    for (const col of battle.tableau) {
      if (col.cards.length === 0) continue;
      const top = col.cards[col.cards.length - 1];
      const diff = Math.abs(top.rank - activeRank);
      if (diff === 1) {
        playableCardId = top.id;
        break;
      }
    }

    if (playableCardId) {
      const result1 = playCard(state1, playableCardId, mockConfig);
      const result2 = playCard(state2, playableCardId, mockConfig);

      expect(result1.state.battle?.chain.length).toBe(result2.state.battle?.chain.length);
      expect(result1.state.battle?.accumulatedDamage).toBe(
        result2.state.battle?.accumulatedDamage
      );
    }
  });
});
