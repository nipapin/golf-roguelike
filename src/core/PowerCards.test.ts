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
  it('WILD permits exactly one arbitrary-rank play', () => {
    const first = playCard(fixture('WILD'), 'power', config);
    expect(first.state.battle!.wildActive).toBe(true);
    // Keep one covered card so the next play does not clear the whole tableau.
    const state = {
      ...first.state,
      battle: {
        ...first.state.battle!,
        tableau: [
          {
            cards: [
              { id: 'covered', rank: 3, suit: 'hearts' as const },
              { id: 'next', rank: 10, suit: 'clubs' as const },
            ],
          },
        ],
      },
    };
    const second = playCard(state, 'next', config);
    expect(second.state.battle!.chain).toHaveLength(2);
    expect(second.state.battle!.wildActive).toBe(false);
    expect(playCard(second.state, 'covered', config).state).toBe(second.state);
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
