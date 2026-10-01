import type { ActionResult, GameEvent, RunState } from './types';

/** Events after which a card play can no longer be taken back. */
const IRREVERSIBLE_EVENTS: ReadonlySet<GameEvent['type']> = new Set([
  'enemy_attacked', 'enemy_died', 'battle_won', 'battle_lost', 'run_won', 'deck_reshuffled', 'chain_resolved',
]);

function snapshot(state: RunState): RunState {
  // Full deep copy of the run (battle tableau/stock/waste, enemy, player, chain,
  // power/joker state, RNG state, counters). States are immutable, but a deep
  // copy keeps snapshots safe from any accidental mutation downstream.
  return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
}

/**
 * Engine-level undo for card plays. One snapshot per accepted play; any other
 * action (draw from stock, enemy action, battle end, reward/shop) clears it.
 */
export class UndoHistory {
  private stack: RunState[] = [];

  constructor(private maxDepth: number) {}

  get size(): number { return this.stack.length; }
  canUndo(current: RunState | null): boolean {
    return this.stack.length > 0 && !!current && current.phase === 'battle' && !!current.battle;
  }

  /** Record the state *before* a successful card play. Plays that end the battle are not undoable. */
  recordPlay(before: RunState, result: ActionResult): void {
    if (result.state === before) return;
    const ended = result.state.phase !== 'battle' || !result.state.battle;
    if (ended || result.events.some((event) => IRREVERSIBLE_EVENTS.has(event.type))) {
      this.clear();
      return;
    }
    this.stack.push(snapshot(before));
    if (this.stack.length > Math.max(0, this.maxDepth)) this.stack.splice(0, this.stack.length - this.maxDepth);
  }

  /** Returns the state to restore, or null when there is nothing to undo. */
  undo(current: RunState | null): RunState | null {
    if (!this.canUndo(current)) return null;
    return this.stack.pop() ?? null;
  }

  clear(): void { this.stack = []; }
}
