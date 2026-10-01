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
import { UndoHistory } from '../core/UndoHistory';
import { saveGame, loadGame, clearSave, hasSave } from '../services/SaveService';

import { gameConfig } from '../data/gameConfig';
import { getActInfo, type ActInfo } from '../core/RunStructure';
import enemiesData from '../data/enemies.json';
import relicsData from '../data/relics.json';

export type GameEventCallback = (events: GameEvent[]) => void;

export class GameManager {
  private state: RunState | null = null;
  private config: GameConfig;
  private enemies: EnemiesData;
  private allRelics: Relic[];
  private eventListeners: GameEventCallback[] = [];
  private history: UndoHistory;

  constructor() {
    this.config = gameConfig;
    this.enemies = enemiesData as EnemiesData;
    this.allRelics = relicsData.relics as Relic[];
    this.history = new UndoHistory(this.config.undo?.maxDepth ?? 10);
  }

  /** True when the last card play(s) of the current battle can be taken back. */
  canUndo(): boolean {
    return this.history.canUndo(this.state);
  }

  getUndoDepth(): number {
    return this.history.size;
  }

  /** Revert the most recent card play (one step). Persists the reverted state. */
  undo(): ActionResult | null {
    const current = this.state;
    const restored = this.history.undo(current);
    if (!restored || !current) return null;
    const cardId = current.battle?.activeCard?.id ?? null;
    this.state = restored;
    this.save();
    const events: GameEvent[] = [{ type: 'undo_applied', cardId }];
    this.emitEvents(events);
    return { state: this.state, events };
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
      this.history.clear();
      this.state = saved;
      return true;
    }
    return false;
  }

  startNewRun(seed?: string): void {
    this.history.clear();
    const useSeed = seed || generateSeed();
    this.state = startRun(useSeed, this.config);
    this.state = setupRewards({ ...this.state, phase: 'reward', rewardKind: 'starter' }, this.allRelics);
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

    const before = this.state;
    const result = playCard(this.state, cardId, this.config);
    if (result.state === this.state) return result;
    this.history.recordPlay(before, result);
    this.state = result.state;
    if (this.state.phase === 'reward') {
      this.state = setupRewards(this.state, this.allRelics);
    }
    this.save();
    this.emitEvents(result.events);
    return { ...result, state: this.state };
  }

  draw(): ActionResult | null {
    if (!this.state) return null;

    const result = drawCard(this.state, this.config);
    if (result.state === this.state) return result;
    // Drawing from stock (and the enemy action it may trigger) commits the turn.
    this.history.clear();
    this.state = result.state;

    // Handle state transitions
    if (this.state.phase === 'reward') {
      this.state = setupRewards(this.state, this.allRelics);
    }

    this.save();
    this.emitEvents(result.events);
    return { ...result, state: this.state };
  }

  selectRelic(relicId: string): ActionResult | null {
    if (!this.state) return null;
    this.history.clear();

    const result = chooseRelic(this.state, relicId);
    this.state = result.state;
    if (this.state.phase === 'battle' && !this.state.battle) {
      this.state = startNextBattle(this.state, this.enemies, this.config);
    }
    this.save();
    this.emitEvents(result.events);
    return { ...result, state: this.state };
  }

  skipReward(): ActionResult | null {
    if (!this.state) return null;
    this.history.clear();

    const result = skipReward(this.state);
    this.state = result.state;
    if (this.state.phase === 'battle' && !this.state.battle) {
      this.state = startNextBattle(this.state, this.enemies, this.config);
    }
    this.save();
    this.emitEvents(result.events);
    return { ...result, state: this.state };
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
    this.history.clear();

    const result = leaveShop(this.state, this.config);
    this.state = result.state;

    // Start next battle
    this.state = startNextBattle(this.state, this.enemies, this.config);
    this.save();
    this.emitEvents(result.events);
  }

  abandonRun(): void {
    this.history.clear();
    clearSave();
    this.state = null;
  }

  getCurrentFightNumber(): number {
    return this.state ? this.state.currentFight + 1 : 0;
  }

  /** Act / fight-in-act for the current fight (ACT n · FIGHT m/7). */
  getActInfo(): ActInfo {
    return getActInfo(this.state?.currentFight ?? 0, this.config.runStructure, this.config.run);
  }

  getConfig(): GameConfig {
    return this.config;
  }

  getEnemiesData(): EnemiesData {
    return this.enemies;
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
    // Dev hook for testing
    if (typeof window !== 'undefined') {
      (window as any).$game = gameManagerInstance;
    }
  }
  return gameManagerInstance;
}

// Test hook interface - set by BattleScene when active
export interface TestHook {
  isActive: boolean;
  getPlayableCards: () => Array<{ cardId: string; bounds: { x: number; y: number; width: number; height: number } }>;
  getDrawPileBounds: () => { x: number; y: number; width: number; height: number };
  getTableauCount: () => number;
  getDeckCount: () => number;
  getActiveCardId: () => string | null;
  getUndoBounds?: () => { x: number; y: number; width: number; height: number };
  canUndo?: () => boolean;
}

export function setTestHook(hook: TestHook | null): void {
  if (typeof window !== 'undefined') {
    (window as any).__GOLF_TEST__ = hook;
  }
}
