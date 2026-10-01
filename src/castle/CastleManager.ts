import { gameConfig } from '../data/gameConfig';
import { generateSeed } from '../core/RNG';
import {
  createCastleRun,
  playCastleCard,
  drawCastleCard,
  stepSiege,
  type CastleRun,
  type SiegeResult,
} from './CastleDefense';
import type { BattleState } from '../core/types';
import { CastleService } from './CastleService';
export class CastleManager {
  state: CastleRun | null = null;
  private previousCard: BattleState | null = null;
  readonly service: CastleService;
  constructor(storage: Storage) {
    this.service = new CastleService(storage);
  }
  start(): void {
    this.previousCard = null;
    const seed = generateSeed(),
      meta = this.service.beginSiege();
    this.state = createCastleRun(
      seed,
      gameConfig,
      meta.upgrades,
      `${seed}:${Date.now()}`,
      meta.currentStreak
    );
    this.save();
  }
  resume(): boolean {
    this.previousCard = null;
    this.state = this.service.load();
    if (this.state && this.state.run.phase !== 'battle') this.service.settle(this.state);
    return !!this.state;
  }
  private apply(result: SiegeResult | null): SiegeResult | null {
    if (!result) return null;
    this.state = result.state;
    if (result.state.run.phase !== 'battle') {
      this.save();
      this.service.settle(result.state);
    }
    return result;
  }
  play(id: string): SiegeResult | null {
    const before = this.state;
    const result = this.apply(before ? playCastleCard(before, id, gameConfig) : null);
    if (result && result.state !== before) this.previousCard = before!.run.battle;
    this.save();
    return result;
  }
  get canUndo(): boolean {
    return (
      !!this.previousCard && this.state?.run.phase === 'battle' && this.state.run.player.hp > 1
    );
  }
  undo(): boolean {
    if (!this.canUndo || !this.state || !this.previousCard) return false;
    this.state = {
      ...this.state,
      run: {
        ...this.state.run,
        battle: this.previousCard,
        player: { ...this.state.run.player, hp: this.state.run.player.hp - 1 },
      },
    };
    this.previousCard = null;
    this.save();
    return true;
  }
  draw(): SiegeResult | null {
    this.previousCard = null;
    const result = this.apply(this.state ? drawCastleCard(this.state, gameConfig) : null);
    this.save();
    return result;
  }
  step(): SiegeResult | null {
    return this.apply(this.state ? stepSiege(this.state) : null);
  }
  save(): boolean {
    return this.state ? this.service.save(this.state) : true;
  }
}
let singleton: CastleManager | null = null;
export function castleManager(): CastleManager {
  if (!singleton) singleton = new CastleManager(localStorage);
  return singleton;
}
