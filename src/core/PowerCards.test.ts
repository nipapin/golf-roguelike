import { describe, expect, it } from 'vitest';
import { playCard, drawCard } from './GameActions';
import { battleFixture, config } from '../test/fixtures';
import type { Card, PowerType, RunState, Suit } from './types';

// Explicit positions ensure every test exercises a legal action, without seed searches.
function fixture(powerType: PowerType, suit: Suit = 'spades'): RunState {
  const state = battleFixture();
  const card: Card = { id: 'power', rank: 6, suit };
  return {
    ...state,
    player: { ...state.player, hp: 5 },
    battle: {
      ...state.battle!,
      activeCard: { id: 'active', rank: 5, suit: 'diamonds' },
      tableau: [{ cards: [card] }, { cards: [{ id: 'next', rank: 10, suit: 'clubs' }] }],
      powerCards: [{ cardId: card.id, type: powerType }],
      enemy: { ...state.battle!.enemy, hp: 100, maxHp: 100 },
    },
  };
}

describe('power cards', () => {
  it('WILD permits any next rank and is consumed by that play', () => {
    const initial = fixture('WILD');
    const state = { ...initial, battle: { ...initial.battle!, tableau: [...initial.battle!.tableau, { cards: [{ id: 'spare', rank: 3, suit: 'clubs' as const }] }] } };
    const first = playCard(state, 'power', config);
    expect(first.state.battle!.wildActive).toBe(true);
    expect(first.events.find(e => e.type === 'card_played')).toMatchObject({ damage: 2 });
    const next = playCard(first.state, 'next', config);
    expect(next.state).not.toBe(first.state);
    expect(next.state.battle!.wildActive).toBe(false);
    expect(playCard(next.state, 'spare', config).state).toBe(next.state);
  });

  it('ECHO increases the played card damage position by the configured bonus', () => {
    const result = playCard(fixture('ECHO'), 'power', config);
    expect(result.events.find((event) => event.type === 'card_played')).toMatchObject({
      chainPosition: 1 + config.powerCards.ECHO.comboBonus,
    });
  });

  it.each(['spades', 'hearts', 'diamonds', 'clubs'] as const)(
    'HEAL/GUARD/GOLD apply on %s',
    (suit) => {
      const heal = playCard(fixture('HEAL', suit), 'power', config);
      expect(heal.state.player.hp).toBe(
        5 +
          config.powerCards.HEAL.healAmount +
          (suit === 'hearts' ? config.combat.baseHeartHeal : 0)
      );
      const guard = playCard(fixture('GUARD', suit), 'power', config);
      expect(guard.state.player.armor).toBe(
        config.powerCards.GUARD.armorAmount + (suit === 'clubs' ? config.combat.baseClubArmor : 0)
      );
      const gold = playCard(fixture('GOLD', suit), 'power', config);
      expect(gold.state.player.gold).toBe(
        config.powerCards.GOLD.goldAmount +
          (suit === 'diamonds' ? config.combat.baseDiamondGold : 0)
      );
    }
  );

  it('clearing the last tableau card wins immediately', () => {
    const state = fixture('BOMB');
    const result = playCard(
      { ...state, battle: { ...state.battle!, tableau: [state.battle!.tableau[0]] } },
      'power',
      config
    );
    expect(result.state.phase).toBe('reward');
    expect(result.events).toContainEqual({ type: 'battle_won' });
  });

  it('reshuffles deterministically when there are no draws or legal moves', () => {
    const state = fixture('CRIT');
    const emptyDeck = {
      ...state,
      player: { ...state.player, hp: 30 },
      battle: {
        ...state.battle!,
        deck: [],
        tableau: [{ cards: [{ id: 'blocked', rank: 10, suit: 'spades' as const }] }],
      },
    };
    const result = drawCard(emptyDeck, config);
    expect(result.events).toContainEqual({ type: 'deck_reshuffled' });
    expect(result).toEqual(drawCard(structuredClone(emptyDeck), config));
  });
});

it('deals all seven power types across seeded normal encounters', () => {
  const dealt = new Set<string>();
  for (let i = 0; i < 40; i++) {
    for (const power of battleFixture(`power-variety-${i}`).battle!.powerCards) dealt.add(power.type);
  }
  expect([...dealt].sort()).toEqual(['BOMB', 'CRIT', 'ECHO', 'GOLD', 'GUARD', 'HEAL', 'WILD']);
});
