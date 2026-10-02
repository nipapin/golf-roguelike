import { CastleManager } from './CastleManager';
import { createCastleRun, emptyUpgrades } from './CastleDefense';
import { gameConfig } from '../data/gameConfig';

const KEY = 'castle-interactive-training-v1';
let completedThisSession = false;
export function trainingCompleted(): boolean {
  if (completedThisSession) return true;
  try {
    return localStorage.getItem(KEY) === 'yes';
  } catch {
    return false;
  }
}
export function resetTrainingSession(): void {
  completedThisSession = false;
}
export function completeTraining(): void {
  completedThisSession = true;
  try {
    localStorage.setItem(KEY, 'yes');
  } catch {
    /* Private browsing. */
  }
}
export function createTraining(): { manager: CastleManager; ids: string[] } {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    key: (i) => [...values.keys()][i] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const manager = new CastleManager(storage);
  const state = createCastleRun('training', gameConfig, emptyUpgrades());
  const battle = state.run.battle!;
  const pool = [...battle.tableau.flatMap((c) => c.cards), ...battle.deck, battle.activeCard!];
  const take = (rank: number, suit: string) => {
    const index = pool.findIndex((c) => c.rank === rank && c.suit === suit && !c.joker);
    return pool.splice(index, 1)[0];
  };
  const active = take(7, 'clubs');
  const chain = [take(4, 'clubs'), take(5, 'clubs'), take(6, 'clubs')];
  const tops = [
    take(13, 'hearts'),
    take(12, 'spades'),
    take(11, 'diamonds'),
    take(10, 'hearts'),
    take(8, 'clubs'),
    take(3, 'hearts'),
  ];
  const next = take(9, 'spades');
  const tableau = [
    { cards: [...pool.splice(0, 2), ...chain] },
    ...tops.map((card) => ({ cards: [...pool.splice(0, 4), card] })),
  ];
  manager.state = {
    ...state,
    run: {
      ...state.run,
      battle: {
        ...battle,
        activeCard: active,
        tableau,
        deck: [next, ...pool],
        powerCards: [{ cardId: tops[4].id, type: 'WILD' }],
      },
    },
  };
  return { manager, ids: [chain[2].id, chain[1].id, chain[0].id, ...tops.map((c) => c.id)] };
}
export const trainingSteps = [
  ['Play the 6', 'The active card is 7. Only an open 6 or 8 connects. Tap the glowing 6.'],
  ['Continue with 5', 'Removing the 6 reveals the 5. Build your chain with the newly opened card.'],
  ['Try UNDO', 'Undo returns your last card and costs 1 castle HP. Tap the large button below.'],
  ['Play the 5 again', 'The castle paid 1 HP. Now continue the restored chain.'],
  [
    'Reach three cards',
    'Play 4. Your chain banks a soldier, a stationary archer and a 10-round turret reload.',
  ],
  ['Deploy your defense', 'NEXT previews the stock card. Tap DRAW to release all banked rewards.'],
  [
    'Watch the defense',
    'Soldiers advance toward enemies. Archers stay at the castle: 1 HP / 2 damage. The turret has 10 rounds.',
  ],
  [
    'Play the WILD 8',
    'From active 9 you can play 8. This special card lets the next card have any rank.',
  ],
  ['Use WILD: play King', 'Normally 8 cannot connect to King. WILD allows this one connection.'],
  ['King → Queen', 'Continue downward with Queen. Ordinary cards still follow the ±1 rule.'],
  ['Queen → Jack', 'Four cards bank an arc cannon as well as the earlier rewards.'],
  ['Jack → 10', 'Five cards charge a 40-damage laser. Longer chains earn stronger defense.'],
  ['Fire the laser', 'Tap DRAW. Rewards deploy only when you draw, never while building a chain.'],
  [
    'Ready for the siege',
    'Clear every column to win. Empty stock with no legal moves costs 5 HP and deals a new board. Upgrade between sieges; defeat resets difficulty.',
  ],
];
