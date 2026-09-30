import type { RunState } from '../core/types';
import config from '../data/config.json';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const number = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const integer = (value: unknown): value is number =>
  number(value) && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const arrayOf = (value: unknown, check: (item: unknown) => boolean): value is unknown[] =>
  Array.isArray(value) && value.every(check);
const powers = ['CRIT', 'HEAL', 'GUARD', 'GOLD', 'BOMB', 'WILD', 'ECHO'];

function card(value: unknown): boolean {
  return (
    record(value) &&
    text(value.id) &&
    integer(value.rank) &&
    (value.joker === undefined ? value.rank >= 1 && value.rank <= 13 :
      value.rank === 0 && (value.joker === 'red' || value.joker === 'black') && value.suit === (value.joker === 'red' ? 'hearts' : 'spades')) &&
    ['spades', 'hearts', 'diamonds', 'clubs'].includes(String(value.suit))
  );
}

function relic(value: unknown): boolean {
  if (
    !record(value) ||
    !text(value.id) ||
    !text(value.name) ||
    typeof value.description !== 'string' ||
    !record(value.effect) ||
    !text(value.effect.type)
  )
    return false;
  const effect = value.effect;
  return (
    (effect.value === undefined || typeof effect.value === 'boolean' || number(effect.value)) &&
    ['rank', 'bonus', 'ratio'].every((key) => effect[key] === undefined || number(effect[key])) &&
    (effect.powerType === undefined || powers.includes(String(effect.powerType)))
  );
}

/** Validate untrusted storage before any Phaser scene or game action uses it. */
export function isSavedRun(value: unknown): value is RunState {
  if (
    !record(value) ||
    !text(value.seed) ||
    !integer(value.currentFight) ||
    value.currentFight >= config.runStructure.length ||
    !integer(value.rngState) ||
    !['start', 'battle', 'reward', 'shop', 'victory', 'defeat'].includes(String(value.phase)) ||
    !arrayOf(value.availableRewards, relic) ||
    !record(value.player)
  )
    return false;
  if (value.rewardKind !== undefined && value.rewardKind !== 'starter' && value.rewardKind !== 'battle') return false;
  const player = value.player;
  if (
    !number(player.hp) ||
    !number(player.maxHp) ||
    player.maxHp <= 0 ||
    player.hp > player.maxHp ||
    !integer(player.armor) ||
    !integer(player.gold) ||
    !arrayOf(player.relics, relic)
  )
    return false;
  if (value.phase !== 'defeat' && player.hp <= 0) return false;
  if (value.battle === null) return value.phase !== 'battle';
  if (value.phase !== 'battle' || !record(value.battle)) return false;
  const battle = value.battle;
  if (
    !Array.isArray(battle.tableau) ||
    battle.tableau.length !== config.tableau.columns ||
    !battle.tableau.every(
      (col) => record(col) && arrayOf(col.cards, card) && col.cards.length <= config.tableau.rows
    ) ||
    !arrayOf(battle.deck, card) ||
    !arrayOf(battle.discard, card) ||
    !arrayOf(battle.chain, card) ||
    !card(battle.activeCard) ||
    !integer(battle.accumulatedDamage) ||
    ['chainBaseDamage', 'jokerMultiplier', 'lifestealMultiplier'].some(key => battle[key] !== undefined && (!number(battle[key]) || (battle[key] as number) < 0)) ||
    (battle.jokerMultiplier !== undefined && (!number(battle.jokerMultiplier) || battle.jokerMultiplier < 1)) ||
    !integer(battle.turnNumber) ||
    typeof battle.wildActive !== 'boolean' ||
    typeof battle.isFirstChain !== 'boolean' ||
    !arrayOf(
      battle.powerCards,
      (power) => record(power) && text(power.cardId) && powers.includes(String(power.type))
    ) ||
    !record(battle.enemy)
  )
    return false;
  const enemy = battle.enemy;
  if (
    !text(enemy.id) ||
    !text(enemy.name) ||
    !text(enemy.sprite) ||
    !number(enemy.hp) ||
    !number(enemy.maxHp) ||
    enemy.hp <= 0 ||
    enemy.hp > enemy.maxHp ||
    !integer(enemy.currentIntentIndex) ||
    !arrayOf(
      enemy.intents,
      (intent) =>
        record(intent) &&
        ['attack', 'defend', 'buff', 'debuff'].includes(String(intent.type)) &&
        integer(intent.value)
    ) ||
    enemy.currentIntentIndex >= enemy.intents.length
  )
    return false;
  if (
    (enemy.scale !== undefined && (!number(enemy.scale) || enemy.scale <= 0)) ||
    (enemy.tint !== undefined && typeof enemy.tint !== 'string') ||
    (enemy.crown !== undefined && typeof enemy.crown !== 'boolean') ||
    (enemy.tier !== undefined && !['normal', 'elite', 'boss'].includes(String(enemy.tier)))
  )
    return false;
  // Chain is history and intentionally references cards in active/discard.
  // Physical card locations, however, must never contain duplicates.
  const cards = [
    ...battle.tableau.flatMap((col) => col.cards),
    ...battle.deck,
    ...battle.discard,
    battle.activeCard,
  ];
  const ids = cards.map((item) => (item as { id: string }).id);
  const jokers = cards.filter(item => (item as { joker?: string }).joker);
  const validPack = ids.length === 52 && jokers.length === 0 || ids.length === 54 && jokers.length === 2 && new Set(jokers.map(item => (item as { joker: string }).joker)).size === 2;
  return validPack && new Set(ids).size === ids.length;
}
