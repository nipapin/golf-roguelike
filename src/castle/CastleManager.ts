import { gameConfig } from '../data/gameConfig';
import { generateSeed } from '../core/RNG';
import {
  createCastleRun,
  playCastleCard,
  drawCastleCard,
  stepSiege,
  emptyUpgrades,
  activateCastleJoker,
  buyCastleModule,
  useCastleAbility,
  type CastleAbility,
  type CastleRun,
  type SiegeResult,
} from './CastleDefense';
import { CastleService, type CastleUndoHistory } from './CastleService';
import type { ModuleKey } from './CastleProgression';
/** HP cost for each undo. Set to 0 to disable damage. */
export const CASTLE_UNDO_HP_COST = 1;
export class CastleManager {
  state: CastleRun | null = null;
  private history: CastleUndoHistory = { cost: 0, entries: [] };
  readonly service: CastleService;
  constructor(storage: Storage) {
    this.service = new CastleService(storage);
  }
  resetProgress(): boolean {
    if (!this.service.resetProgress()) return false;
    this.state = null;
    this.history = { cost: 0, entries: [] };
    return true;
  }
  start(): boolean {
    if (this.state && this.state.run.phase !== 'battle' && !this.service.settle(this.state))
      return false;
    let meta;
    try {
      meta = this.service.beginSiege();
    } catch {
      return false;
    }
    this.history = { cost: 0, entries: [] };
    const seed = generateSeed();
    this.state = createCastleRun(
      seed,
      gameConfig,
      emptyUpgrades(),
      `${seed}:${Date.now()}`,
      meta.currentStreak
    );
    if (meta.carryover) {
      const stats =
        meta.carryover.stats ??
        (() => {
          const previous = this.service.load();
          return previous?.id === meta.carryover!.sourceSiege ? previous.runStats : undefined;
        })();
      if (stats) this.state.runStats = { ...stats };
      this.state.inheritedCoins = meta.carryover.coins;
      this.state.siege.coins = meta.carryover.coins;
      this.state.run = {
        ...this.state.run,
        player: {
          ...this.state.run.player,
          hp: meta.carryover.hp,
          maxHp: meta.carryover.maxHp,
          armor: meta.carryover.armor,
        },
      };
    }
    this.save();
    return true;
  }
  resume(): boolean {
    this.state = this.service.load();
    this.history = this.state ? this.service.loadUndoHistory(this.state) : { cost: 0, entries: [] };
    if (this.state && this.state.run.phase !== 'battle') this.service.settle(this.state);
    return !!this.state;
  }
  private apply(result: SiegeResult | null): SiegeResult | null {
    if (!result) return null;
    this.state = result.state;
    // Save loot immediately, retaining move history. A full undo also restores
    // coins, XP and kill counters, so replaying the move cannot duplicate loot.
    if (result.events.some((event) => event.type === 'killed')) {
      this.save();
    }
    if (result.state.run.phase !== 'battle') {
      this.history = { cost: 0, entries: [] };
      this.save();
      this.service.settle(result.state);
    }
    return result;
  }
  play(id: string): SiegeResult | null {
    const before = this.state;
    const result = before ? playCastleCard(before, id, gameConfig) : null;
    if (result && result.state !== before) this.remember(before!);
    this.apply(result);
    this.save();
    return result;
  }
  get canUndo(): boolean {
    const entry = this.history.entries.at(-1);
    if (!entry || this.state?.run.phase !== 'battle') return false;
    if (CASTLE_UNDO_HP_COST > 0 && this.state.run.player.hp <= CASTLE_UNDO_HP_COST) return false;
    return true;
  }
  get undoDepth(): number {
    return this.history.entries.length;
  }
  /** Undo the last move. Returns { success, damage } where damage is HP lost. */
  undo(): { success: boolean; damage: number } {
    if (!this.canUndo) return { success: false, damage: 0 };
    const entry = this.history.entries.pop()!;
    const damage = CASTLE_UNDO_HP_COST;
    const currentHp = this.state!.run.player.hp;
    this.state = {
      ...entry.state,
      run: {
        ...entry.state.run,
        player: {
          ...entry.state.run.player,
          hp: currentHp - damage,
        },
      },
    };
    this.save();
    return { success: true, damage };
  }
  draw(): SiegeResult | null {
    const before = this.state;
    const result = before ? drawCastleCard(before, gameConfig) : null;
    if (result && result.state !== before) this.remember(before!);
    this.apply(result);
    this.save();
    return result;
  }
  step(): SiegeResult | null {
    return this.apply(this.state ? stepSiege(this.state) : null);
  }
  joker(color: 'red' | 'black'): SiegeResult | null {
    const before = this.state;
    const result = before ? activateCastleJoker(before, color) : null;
    if (result && result.state !== before) this.remember(before!);
    this.apply(result);
    this.save();
    return result;
  }
  useAbility(ability: CastleAbility): SiegeResult | null {
    const before = this.state;
    const result = before ? useCastleAbility(before, ability, gameConfig) : null;
    if (result && result.state !== before) this.remember(before!);
    this.apply(result);
    this.save();
    return result;
  }
  buyModule(key: ModuleKey): SiegeResult | null {
    const before = this.state;
    const result = before ? buyCastleModule(before, key) : null;
    if (result && result.state !== before) this.remember(before!);
    this.apply(result);
    this.save();
    return result;
  }
  save(): boolean {
    return this.state ? this.service.save(this.state, this.history) : true;
  }
  private remember(state: CastleRun): void {
    this.history.entries.push({ state: structuredClone(state), cost: this.history.cost });
  }
}
let singleton: CastleManager | null = null;
export function castleManager(): CastleManager {
  if (!singleton) singleton = new CastleManager(localStorage);
  return singleton;
}
