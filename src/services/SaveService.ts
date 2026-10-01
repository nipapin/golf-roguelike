import { RunState } from '../core/types';
import { isSavedRun } from './validateSave';

const SAVE_KEY = 'golf-rogue-save';
/**
 * v2: 6 acts x 7 fights. v1 saves (single 7-fight act) migrate as-is: fight indices 0-6 are
 * the same positions in act 1 and the in-progress battle is self-contained.
 */
export const SAVE_VERSION = 2;
const MIGRATABLE_VERSIONS = [1];

export function migrateSave(version: unknown, state: unknown): unknown {
  if (version === SAVE_VERSION) return state;
  if (typeof version === 'number' && MIGRATABLE_VERSIONS.includes(version)) return state;
  return null;
}

interface SaveData {
  version: number;
  state: RunState;
  savedAt: number;
}

export function saveGame(state: RunState): boolean {
  try {
    const saveData: SaveData = {
      version: SAVE_VERSION,
      state,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    return true;
  } catch (e) {
    console.error('Failed to save game:', e);
    return false;
  }
}

export function loadGame(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      clearSave();
      return null;
    }
    const saveData = parsed as Partial<SaveData>;

    // Version check: current version passes, older known versions are migrated, others reset.
    const migrated = migrateSave(saveData.version, saveData.state);
    if (migrated === null) {
      console.warn('Save version mismatch, clearing save');
      clearSave();
      return null;
    }

    // Basic validation
    if (!isSavedRun(migrated)) {
      console.warn('Invalid save data, clearing save');
      clearSave();
      return null;
    }

    if (saveData.version !== SAVE_VERSION) saveGame(migrated);
    return migrated;
  } catch (e) {
    console.error('Failed to load game:', e);
    clearSave();
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.error('Failed to clear save:', e);
  }
}

export function hasSave(): boolean {
  try {
    return loadGame() !== null;
  } catch {
    return false;
  }
}
