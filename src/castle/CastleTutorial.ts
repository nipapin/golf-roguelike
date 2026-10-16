import { CastleManager } from './CastleManager';
import { createCastleRun, emptyUpgrades } from './CastleDefense';
import { gameConfig } from '../data/gameConfig';

const KEY = 'castle-interactive-training-v2';
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
    take(1, 'hearts'),
    take(13, 'spades'),
    take(12, 'diamonds'),
    take(11, 'hearts'),
    take(10, 'clubs'),
    take(3, 'hearts'),
  ];
  const next = take(9, 'spades');
  const tableau = [
    { cards: [...pool.splice(0, 2), ...chain] },
    ...tops.map((card) => ({ cards: [...pool.splice(0, 4), card] })),
  ];
  manager.state = {
    ...state,
    // Preserve legacy progression data; chain rewards are available in every round.
    progression: { xp: 56, level: 5, modules: [] },
    run: {
      ...state.run,
      battle: {
        ...battle,
        activeCard: active,
        tableau,
        deck: [next, ...pool],
        powerCards: [{ cardId: tops[4].id, type: 'GUARD' }],
      },
    },
  };
  return { manager, ids: [chain[2].id, chain[1].id, chain[0].id, ...tops.map((c) => c.id)] };
}
export const trainingSteps = [
  ['Play the 6', 'The active card is 7. Only an open 6 or 8 connects. Tap the glowing 6.'],
  ['Continue with 5', 'Removing the 6 reveals the 5. Build your chain with the newly opened card.'],
  ['Try the reverse arrow', 'The reverse arrow beside the stock restores your previous step, including stock draws. Undo is free and unlimited while there are earlier moves in this round. Tap it.'],
  ['Play the 5 again', 'Continue the restored chain with 5. You can undo again whenever you need to.'],
  [
    'Reach three cards',
    'Play 4. Your chain banks a soldier, a stationary archer and a 10-round turret reload.',
  ],
  ['Deploy your defense', 'Tap the closed stock to take a card and deploy your banked rewards. The stock glows when there are no legal plays.'],
  [
    'Watch the defense',
    'Soldiers leave the gate; archers stand on walls; weapons mount to towers. Every reward is available from the first round through card chains.',
  ],
  [
    'Play the GUARD 10',
    'From active 9 you can play 10. GUARD cards give armor when played.',
  ],
  ['10 → Jack', 'Continue upward with Jack. Build longer chains for bigger rewards.'],
  ['Jack → Queen', 'Continue with Queen.'],
  ['Queen → King', 'Four cards bank an arc cannon as well as the earlier rewards.'],
  ['King → Ace', 'Kings and Aces wrap: K ↔ A connects both ways. Five cards charge a 40-damage laser.'],
  ['Fire the laser', 'Tap the closed stock. Drawing deploys your banked rewards and fires the charged laser.'],
  [
    'Ready for the siege',
    'Clear every column to win. Kills give coins. HEAL costs 30, BOMB 100, ECHO 50; each can be used once per round. ECHO adds two chain positions. GUARD cards give armor. Empty stock does not end the round: finish any available chain, then tap the empty stock marked with a shuffle arrow and heart for 5 HP. Recycled waste loses its powers; cards on the field keep them. The reverse arrow restores the previous step, including draws, with no undo limit.',
  ],
];
