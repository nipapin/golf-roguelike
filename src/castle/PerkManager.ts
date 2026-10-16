/**
 * PerkManager: roguelike perks for castle mode, earned after each won round.
 * Modeled on RelicManager with hooks dispatched by effect.type.
 */
import type { Card, Suit } from '../core/types';
import perksData from '../data/perks.json';
import { RNG } from '../core/RNG';

export interface PerkEffect {
  type: string;
  [key: string]: unknown;
}

export interface PerkDef {
  id: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  category: 'suit' | 'deck' | 'units' | 'castle' | 'economy' | 'synergy' | 'risk';
  stack?: { max: number };
  prerequisites?: string[];
  replaces?: string;
  name: { en: string; ru: string };
  description: { en: string; ru: string };
  stackDesc?: { en: string; ru: string };
  effect: PerkEffect;
}

export interface OwnedPerk {
  id: string;
  stacks: number;
}

export interface PerkRoundState {
  heartHealUsed: number;
  trinityBombs: number;
  ranksPlayed: Map<number, number>;
  flushTracker: { suit: Suit | null; count: number };
  fireArrows: number;
  masonsElapsed: number;
  masonsHealUsed: number;
}

export const PERKS: PerkDef[] = perksData.perks as PerkDef[];
export const DROP_RULES = perksData.dropRules;
export const GLOBAL_BONUS_LINK_CAP = DROP_RULES.globalBonusLinkCap;

export function getPerk(id: string): PerkDef | undefined {
  return PERKS.find(p => p.id === id);
}

export function createPerkRoundState(): PerkRoundState {
  return {
    heartHealUsed: 0,
    trinityBombs: 0,
    ranksPlayed: new Map(),
    flushTracker: { suit: null, count: 0 },
    fireArrows: 0,
    masonsElapsed: 0,
    masonsHealUsed: 0,
  };
}

export class PerkManager {
  private perks: OwnedPerk[];
  private roundState: PerkRoundState;
  
  constructor(perks: OwnedPerk[] = []) {
    this.perks = perks;
    this.roundState = createPerkRoundState();
  }

  static fromOwned(perks: OwnedPerk[]): PerkManager {
    return new PerkManager(perks);
  }

  getOwned(): OwnedPerk[] {
    return this.perks;
  }

  owns(id: string): boolean {
    return this.perks.some(p => p.id === id);
  }

  getStacks(id: string): number {
    return this.perks.find(p => p.id === id)?.stacks ?? 0;
  }

  addPerk(id: string): void {
    const def = getPerk(id);
    if (!def) return;
    
    if (def.replaces) {
      this.perks = this.perks.filter(p => p.id !== def.replaces);
    }
    
    const existing = this.perks.find(p => p.id === id);
    if (existing) {
      const maxStacks = def.stack?.max ?? 1;
      existing.stacks = Math.min(existing.stacks + 1, maxStacks);
    } else {
      this.perks.push({ id, stacks: 1 });
    }
  }

  resetRound(): void {
    this.roundState = createPerkRoundState();
  }

  getRoundState(): PerkRoundState {
    return this.roundState;
  }

  private effectValue<T>(id: string, key: string, defaultValue: T): T {
    const stacks = this.getStacks(id);
    if (stacks === 0) return defaultValue;
    const def = getPerk(id);
    const base = (def?.effect[key] as T) ?? defaultValue;
    if (typeof base === 'number') {
      return (base * stacks) as T;
    }
    return base;
  }

  // ============ SUIT EFFECTS ============
  
  onSuitPlayed(suit: Suit): { heal: number; coins: number; armor: number; fireArrows: number } {
    let heal = 0, coins = 0, armor = 0, fireArrows = 0;
    
    if (suit === 'hearts') {
      const stacks = this.getStacks('heart_mend');
      if (stacks > 0) {
        const healPerCard = stacks;
        const cap = 8 + (stacks - 1) * 8;
        const canHeal = Math.max(0, cap - this.roundState.heartHealUsed);
        heal = Math.min(healPerCard, canHeal);
        this.roundState.heartHealUsed += heal;
      }
      const heartfireStacks = this.getStacks('heartfire');
      if (heartfireStacks > 0) {
        fireArrows = 3 + (heartfireStacks - 1) * 2;
        this.roundState.fireArrows += fireArrows;
      }
    }
    
    if (suit === 'diamonds') {
      coins = this.effectValue('diamond_vein', 'value', 0);
    }
    
    if (suit === 'clubs') {
      const stacks = this.getStacks('club_bulwark');
      armor = stacks;
    }
    
    return { heal, coins, armor, fireArrows };
  }

  // ============ LINK BONUSES ============
  
  getLinkBonus(card: Card, activeCard: Card | null, chainLength: number): number {
    let bonus = 0;
    
    if (card.suit === 'spades' && this.owns('spade_edge')) {
      bonus += 1;
    }
    
    if (this.owns('ouroboros') && activeCard) {
      const isWrap = (card.rank === 1 && activeCard.rank === 13) || 
                     (card.rank === 13 && activeCard.rank === 1);
      if (isWrap) {
        bonus += this.effectValue('ouroboros', 'links', 0);
      }
    }
    
    if (this.owns('momentum')) {
      const newLength = chainLength + 1;
      if (newLength % 4 === 0) {
        bonus += 1;
      }
    }
    
    if (card.joker && this.owns('jester')) {
      bonus += this.effectValue('jester', 'links', 0);
    }
    
    this.updateFlushTracker(card);
    if (this.owns('flush_run')) {
      const stacks = this.getStacks('flush_run');
      if (this.roundState.flushTracker.count >= 3 && this.roundState.flushTracker.count % 3 === 0) {
        bonus += 2 + (stacks - 1);
      }
    }
    
    return Math.min(bonus, GLOBAL_BONUS_LINK_CAP);
  }

  private updateFlushTracker(card: Card): void {
    if (card.joker) {
      this.roundState.flushTracker = { suit: null, count: 0 };
      return;
    }
    if (this.roundState.flushTracker.suit === card.suit) {
      this.roundState.flushTracker.count++;
    } else {
      this.roundState.flushTracker = { suit: card.suit, count: 1 };
    }
  }

  getChainEndBonus(chainLength: number): number {
    let bonus = 0;
    if (this.owns('blood_price') && chainLength >= 3) {
      bonus += this.effectValue('blood_price', 'links', 0);
    }
    return Math.min(bonus, GLOBAL_BONUS_LINK_CAP);
  }

  // ============ RANK EFFECTS ============
  
  onRankPlayed(rank: number, rng: RNG): { 
    deployUnit: 'soldier' | 'archer' | null;
    turretRounds: number;
    laserDamage: number;
    coins: number;
    armor: number;
    freeBomb: boolean;
  } {
    let deployUnit: 'soldier' | 'archer' | null = null;
    let turretRounds = 0, laserDamage = 0, coins = 0, armor = 0;
    let freeBomb = false;

    if (this.owns('royal_court')) {
      if (rank === 11) deployUnit = 'soldier';
      if (rank === 12) deployUnit = 'archer';
      if (rank === 13) turretRounds = 5;
    }

    if (rank === 1 && this.owns('ace_flare') && !this.owns('starfall')) {
      laserDamage = this.effectValue('ace_flare', 'damage', 0);
    }

    if (rank === 1 && this.owns('starfall')) {
      laserDamage = -1;
    }

    if (rank === 7 && this.owns('lucky_seven')) {
      const stacks = this.getStacks('lucky_seven');
      const chance = stacks === 1 ? 1/3 : 0.5;
      if (rng.next() < chance) {
        coins = 6;
        armor = 1;
      }
    }

    const played = this.roundState.ranksPlayed.get(rank) ?? 0;
    this.roundState.ranksPlayed.set(rank, played + 1);
    
    if (this.owns('trinity') && played + 1 === 3) {
      const maxBombs = 2;
      if (this.roundState.trinityBombs < maxBombs) {
        freeBomb = true;
        this.roundState.trinityBombs++;
      }
    }

    return { deployUnit, turretRounds, laserDamage, coins, armor, freeBomb };
  }

  // ============ SPADE SALVO ============
  
  shouldFireSalvo(suit: Suit): boolean {
    return suit === 'spades' && this.owns('spade_salvo');
  }

  getSalvoTargets(): number {
    const def = getPerk('spade_salvo');
    return (def?.effect.targets as number) ?? 3;
  }

  // ============ UNIT STATS ============
  
  getArcherDamageBonus(): number {
    return this.effectValue('longbow', 'value', 0);
  }

  getArcherSpeedMultiplier(): number {
    const stacks = this.getStacks('quick_draw');
    if (stacks === 0) return 1;
    return Math.pow(0.8, stacks);
  }

  getTurretMagBonus(): number {
    return this.effectValue('extended_mag', 'extraRounds', 0);
  }

  shouldKeepTurretLeftover(): boolean {
    return this.owns('extended_mag');
  }

  getMortarDamageBonus(): number {
    return this.effectValue('heavy_shells', 'value', 0);
  }

  getMortarTargets(): number {
    return this.owns('cluster_shells') ? 4 : 3;
  }

  getLaserDamageBonus(): number {
    return this.effectValue('focusing_lens', 'value', 0);
  }

  getSoldierHpBonus(): number {
    return this.effectValue('veteran_militia', 'hpBonus', 0);
  }

  getSoldierLifetimeBonus(): number {
    return this.effectValue('veteran_militia', 'lifetimeBonus', 0);
  }

  // ============ GLASS CANNON ============
  
  getDamageMultiplier(): number {
    return this.owns('glass_cannon') ? 1.4 : 1;
  }

  getMaxHpMultiplier(): number {
    return this.owns('glass_cannon') ? 0.7 : 1;
  }

  // ============ CASTLE / ECONOMY ============
  
  getMaxHpBonus(): number {
    return this.effectValue('stone_walls', 'maxHpBonus', 0);
  }

  getImmediateHeal(): number {
    return this.effectValue('stone_walls', 'healNow', 0);
  }

  getEnemySpeedMultiplier(isBoss: boolean): number {
    const stacks = this.getStacks('tar_moat');
    if (stacks === 0) return 1;
    const slow = isBoss ? 0.06 : 0.12;
    return Math.pow(1 - slow, stacks);
  }

  getBossCoinsBonus(): number {
    return this.effectValue('bounty_board', 'bossCoins', 0);
  }

  getKillMilestoneBonus(killCount: number): number {
    if (!this.owns('bounty_board')) return 0;
    const stacks = this.getStacks('bounty_board');
    const milestone = 10;
    if (killCount % milestone === 0) {
      return 2 * stacks;
    }
    return 0;
  }

  getAbilityCostMultiplier(): number {
    const discount = this.effectValue('guild_charter', 'discount', 0);
    return discount > 0 ? 1 - discount : 1;
  }

  // ============ ROUND START/END ============
  
  getExtraStockCards(): number {
    return this.effectValue('spare_stock', 'extraCards', 0);
  }

  getRecycleHpCost(baseCost: number): number {
    const stacks = this.getStacks('spare_stock');
    return Math.max(1, baseCost - stacks * 2);
  }

  getExtraJokers(): number {
    return this.effectValue('jester', 'jokers', 0);
  }

  showNextCard(): boolean {
    return this.owns('card_counter');
  }

  getDrawAssistThreshold(): number {
    return this.owns('card_counter') ? 2 : 3;
  }

  onRoundEnd(missingHp: number): number {
    if (!this.owns('field_hospital')) return 0;
    return Math.floor(missingHp * 0.3);
  }

  tickMasons(elapsed: number, currentHp: number, maxHp: number): number {
    if (!this.owns('masons')) return 0;
    const stacks = this.getStacks('masons');
    const interval = stacks === 1 ? 15 : 10;
    const cap = stacks === 1 ? 8 : 12;
    
    this.roundState.masonsElapsed += elapsed;
    const ticks = Math.floor(this.roundState.masonsElapsed / interval);
    this.roundState.masonsElapsed %= interval;
    
    if (ticks === 0 || currentHp >= maxHp) return 0;
    
    const canHeal = Math.min(ticks, cap - this.roundState.masonsHealUsed, maxHp - currentHp);
    this.roundState.masonsHealUsed += canHeal;
    return canHeal;
  }

  // ============ BLOOD PRICE ============
  
  getShortChainDrawCost(chainLength: number): number {
    if (!this.owns('blood_price')) return 0;
    return chainLength < 3 ? 1 : 0;
  }

  // ============ FIRE ARROWS ============
  
  consumeFireArrow(): boolean {
    if (this.roundState.fireArrows > 0) {
      this.roundState.fireArrows--;
      return true;
    }
    return false;
  }

  // ============ ARMOR CAP ============
  
  getArmorCap(): number {
    const stacks = this.getStacks('club_bulwark');
    return stacks > 0 ? 12 + (stacks - 1) * 6 : 999;
  }
}

// ============ PERK OFFERING ============

export interface PerkOffer {
  perks: PerkDef[];
  rerollCost: number;
  canReroll: boolean;
}

export function generatePerkOffer(
  owned: OwnedPerk[],
  roundNumber: number,
  rerollsUsed: number,
  freeRerollsUsed: number,
  rareStreakWithout: number,
  rng: RNG
): PerkOffer {
  const ownedIds = new Set(owned.map(p => p.id));
  
  const canPick = (perk: PerkDef): boolean => {
    if (perk.prerequisites && !perk.prerequisites.every(p => ownedIds.has(p))) return false;
    if (perk.stack) {
      const existing = owned.find(p => p.id === perk.id);
      if (existing && existing.stacks >= perk.stack.max) return false;
    } else {
      if (ownedIds.has(perk.id)) return false;
    }
    return true;
  };

  const weights = roundNumber <= 2 ? DROP_RULES.rarityWeights.early :
                  roundNumber <= 5 ? DROP_RULES.rarityWeights.mid :
                  DROP_RULES.rarityWeights.late;

  const totalWeight = weights.common + weights.uncommon + weights.rare + weights.legendary;
  
  const pickRarity = (forceRareOrHigher = false): 'common' | 'uncommon' | 'rare' | 'legendary' => {
    const roll = rng.next() * totalWeight;
    if (forceRareOrHigher) {
      const rareTotal = weights.rare + weights.legendary;
      const rareRoll = rng.next() * rareTotal;
      return rareRoll < weights.rare ? 'rare' : 'legendary';
    }
    if (roll < weights.common) return 'common';
    if (roll < weights.common + weights.uncommon) return 'uncommon';
    if (roll < weights.common + weights.uncommon + weights.rare) return 'rare';
    return 'legendary';
  };

  const eligible = PERKS.filter(canPick);
  const byCategory = {
    deckSuit: eligible.filter(p => p.category === 'deck' || p.category === 'suit'),
    defense: eligible.filter(p => ['units', 'castle', 'economy'].includes(p.category)),
    free: eligible,
    risk: eligible.filter(p => p.category === 'risk'),
  };

  const selected: PerkDef[] = [];
  const usedIds = new Set<string>();

  const pickFromPool = (pool: PerkDef[], rarity: 'common' | 'uncommon' | 'rare' | 'legendary'): PerkDef | null => {
    const matching = pool.filter(p => p.rarity === rarity && !usedIds.has(p.id));
    if (matching.length === 0) {
      const fallback = pool.filter(p => !usedIds.has(p.id));
      if (fallback.length === 0) return null;
      const pick = rng.pickOne(fallback);
      usedIds.add(pick.id);
      return pick;
    }
    const pick = rng.pickOne(matching);
    usedIds.add(pick.id);
    return pick;
  };

  const pityActive = rareStreakWithout >= DROP_RULES.pityThreshold;

  const slot1Rarity = pickRarity();
  const slot1 = pickFromPool(byCategory.deckSuit, slot1Rarity);
  if (slot1) selected.push(slot1);

  const slot2Rarity = pickRarity();
  const slot2 = pickFromPool(byCategory.defense, slot2Rarity);
  if (slot2) selected.push(slot2);

  const slot3Rarity = pityActive ? pickRarity(true) : pickRarity();
  const slot3Pool = byCategory.risk.length > 0 && !selected.some(p => p.category === 'risk') && rng.next() < 0.15
    ? byCategory.risk
    : byCategory.free;
  const slot3 = pickFromPool(slot3Pool, slot3Rarity);
  if (slot3) selected.push(slot3);

  const legendaries = eligible.filter(p => p.rarity === 'legendary' && !usedIds.has(p.id));
  if (legendaries.length > 0 && rng.next() < DROP_RULES.legendarySlotChance) {
    const legendary = rng.pickOne(legendaries);
    if (selected.length === 3) {
      selected[2] = legendary;
    } else {
      selected.push(legendary);
    }
  }

  const freeRerolls = DROP_RULES.freeRerollsPerRun - freeRerollsUsed;
  const rerollCost = freeRerolls > 0 ? 0 : 
    DROP_RULES.rerollBaseCost + rerollsUsed * DROP_RULES.rerollCostIncrement;

  return {
    perks: selected,
    rerollCost,
    canReroll: selected.length > 0,
  };
}
