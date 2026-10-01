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
import { CastleService } from './CastleService';
export class CastleManager {
  state: CastleRun | null = null;
  readonly service: CastleService;
  constructor(storage: Storage) {
    this.service = new CastleService(storage);
  }
  start(): void {
    const seed = generateSeed();
    this.state = createCastleRun(
      seed,
      gameConfig,
      this.service.readMeta().upgrades,
      `${seed}:${Date.now()}`
    );
    this.save();
  }
  resume(): boolean {
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
    const result = this.apply(this.state ? playCastleCard(this.state, id, gameConfig) : null);
    this.save();
    return result;
  }
  draw(): SiegeResult | null {
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
