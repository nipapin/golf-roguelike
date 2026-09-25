import { RunState } from '../core/types';

const SAVE_KEY = 'golf-rogue-save';
const SAVE_VERSION = 1;

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

    const saveData: SaveData = JSON.parse(raw);

    // Version check - for now just accept version 1
    if (saveData.version !== SAVE_VERSION) {
      console.warn('Save version mismatch, clearing save');
      clearSave();
      return null;
    }

    // Basic validation
    if (!saveData.state || !saveData.state.seed) {
      console.warn('Invalid save data, clearing save');
      clearSave();
      return null;
    }

    return saveData.state;
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
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
