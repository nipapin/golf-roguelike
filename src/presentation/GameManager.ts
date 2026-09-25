import {
  RunState,
  GameConfig,
  Relic,
  GameEvent,
  ActionResult,
} from '../core/types';
import { EnemiesData } from '../core/GameState';
import {
  startRun,
  startNextBattle,
  playCard,
  drawCard,
  chooseRelic,
  skipReward,
  buyHealing,
  buyRelic,
  leaveShop,
  setupRewards,
} from '../core/GameActions';
import { generateSeed } from '../core/RNG';
import { saveGame, loadGame, clearSave, hasSave } from '../services/SaveService';

import configData from '../data/config.json';
import enemiesData from '../data/enemies.json';
import relicsData from '../data/relics.json';

export type GameEventCallback = (events: GameEvent[]) => void;

export class GameManager {
  private state: RunState | null = null;
  private config: GameConfig;
  private enemies: EnemiesData;
  private allRelics: Relic[];
  private eventListeners: GameEventCallback[] = [];

  constructor() {
    this.config = configData as GameConfig;
    this.enemies = enemiesData as EnemiesData;
    this.allRelics = relicsData.relics as Relic[];
  }

  getConfig(): GameConfig {
    return this.config;
  }

  getState(): RunState | null {
    return this.state;
  }

  getAllRelics(): Relic[] {
    return this.allRelics;
  }

  hasSavedGame(): boolean {
    return hasSave();
  }

  loadSavedGame(): boolean {
    const saved = loadGame();
    if (saved) {
      this.state = saved;
      return true;
    }
    return false;
  }

  startNewRun(seed?: string): void {
    const useSeed = seed || generateSeed();
    this.state = startRun(useSeed, this.config);
    this.state = startNextBattle(this.state, this.enemies, this.config);
    this.save();
  }

  private save(): void {
    if (this.state) {
      saveGame(this.state);
    }
  }

  private emitEvents(events: GameEvent[]): void {
    for (const listener of this.eventListeners) {
      listener(events);
    }
  }

  onEvents(callback: GameEventCallback): () => void {
    this.eventListeners.push(callback);
    return () => {
      const index = this.eventListeners.indexOf(callback);
      if (index >= 0) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  playCard(cardId: string): ActionResult | null {
    if (!this.state) return null;

    const result = playCard(this.state, cardId, this.config);
    this.state = result.state;
    this.save();
    this.emitEvents(result.events);
    return result;
  }

  draw(): ActionResult | null {
    if (!this.state) return null;

    const result = drawCard(this.state, this.config);
    this.state = result.state;

    // Handle state transitions
    if (this.state.phase === 'reward') {
      this.state = setupRewards(this.state, this.allRelics);
    }

    this.save();
    this.emitEvents(result.events);
    return result;
  }

  selectRelic(relicId: string): ActionResult | null {
    if (!this.state) return null;

    const result = chooseRelic(this.state, relicId);
    this.state = result.state;
    this.save();
    this.emitEvents(result.events);
    return result;
  }

  skipReward(): ActionResult | null {
    if (!this.state) return null;

    const result = skipReward(this.state);
    this.state = result.state;
    this.save();
    this.emitEvents(result.events);
    return result;
  }

  buyHealing(): ActionResult | null {
    if (!this.state) return null;

    const result = buyHealing(this.state, this.config);
    this.state = result.state;
    this.save();
    this.emitEvents(result.events);
    return result;
  }

  buyShopRelic(relicId: string): ActionResult | null {
    if (!this.state) return null;

    const result = buyRelic(this.state, relicId, this.allRelics, this.config);
    this.state = result.state;
    this.save();
    this.emitEvents(result.events);
    return result;
  }

  proceedFromShop(): void {
    if (!this.state) return;

    const result = leaveShop(this.state);
    this.state = result.state;

    // Start next battle
    this.state = startNextBattle(this.state, this.enemies, this.config);
    this.save();
    this.emitEvents(result.events);
  }

  abandonRun(): void {
    clearSave();
    this.state = null;
  }

  getCurrentFightNumber(): number {
    return this.state ? this.state.currentFight + 1 : 0;
  }

  getTotalFights(): number {
    return this.config.runStructure.length;
  }

  isEliteFight(): boolean {
    if (!this.state) return false;
    const fight = this.config.runStructure[this.state.currentFight];
    return fight?.enemyTier === 'elite';
  }

  isBossFight(): boolean {
    if (!this.state) return false;
    const fight = this.config.runStructure[this.state.currentFight];
    return fight?.enemyTier === 'boss';
  }
}

// Singleton instance
let gameManagerInstance: GameManager | null = null;

export function getGameManager(): GameManager {
  if (!gameManagerInstance) {
    gameManagerInstance = new GameManager();
    // Dev hook for testing (tree-shaken in production if unused)
    if (typeof window !== 'undefined') {
      (window as any).$game = gameManagerInstance;
    }
  }
  return gameManagerInstance;
}
