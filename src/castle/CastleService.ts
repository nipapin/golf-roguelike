import { isSavedRun } from '../services/validateSave';
import {
  emptyUpgrades,
  UPGRADE_KEYS,
  UPGRADE_LIMIT,
  upgradeCost,
  earnedCoins,
  type CastleRun,
  type Upgrades,
  type UpgradeKey,
} from './CastleDefense';
const META_KEY = 'golf-castle-meta-v1';
const RUN_KEY = 'golf-castle-run-v1';
export interface CastleMeta {
  version: 1;
  coins: number;
  upgrades: Upgrades;
  claimed: string[];
  bestKills: number;
  victories: number;
}
const fresh = (): CastleMeta => ({
  version: 1,
  coins: 0,
  upgrades: emptyUpgrades(),
  claimed: [],
  bestKills: 0,
  victories: 0,
});
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
function upgrades(v: unknown): v is Upgrades {
  return record(v) && UPGRADE_KEYS.every((k) => integer(v[k]) && v[k] <= UPGRADE_LIMIT);
}
function validRun(v: unknown): v is CastleRun {
  if (
    !record(v) ||
    v.version !== 1 ||
    typeof v.id !== 'string' ||
    !v.id ||
    !upgrades(v.upgrades) ||
    !record(v.run) ||
    !record(v.run.player) ||
    !record(v.siege)
  )
    return false;
  if (!['battle', 'victory', 'defeat'].includes(String(v.run.phase))) return false;
  // The solitaire pack remains intact in terminal siege saves too.
  if (
    !isSavedRun({
      ...v.run,
      phase: 'battle',
      player: { ...v.run.player, hp: Math.max(1, Number(v.run.player.hp)) },
    })
  )
    return false;
  const s = v.siege;
  return (
    typeof s.started === 'boolean' &&
    ['elapsed', 'spawned', 'kills', 'coins', 'nextId', 'rngState', 'laserCharge'].every((k) =>
      finite(s[k])
    ) &&
    typeof s.spawnIn === 'number' &&
    Number.isFinite(s.spawnIn) &&
    Array.isArray(s.enemies) &&
    s.enemies.length <= 16 &&
    s.enemies.every(
      (e) =>
        record(e) &&
        integer(e.id) &&
        ['c_orc', 'c_goblin', 'c_reaper2', 'c_ogre', 'c_reaper1'].includes(String(e.sprite)) &&
        typeof e.boss === 'boolean' &&
        ['hp', 'maxHp', 'progress', 'speed', 'damage'].every((k) => finite(e[k])) &&
        (e.progress as number) <= 0.94 &&
        (e.hp as number) > 0 &&
        (e.hp as number) <= (e.maxHp as number) &&
        typeof e.cooldown === 'number' &&
        Number.isFinite(e.cooldown)
    ) &&
    Array.isArray(s.units) &&
    s.units.length <= 8 &&
    s.units.every(
      (u) =>
        record(u) &&
        integer(u.id) &&
        ['soldier', 'knight', 'turret', 'mortar'].includes(String(u.kind)) &&
        typeof u.engaged === 'boolean' &&
        ['damage', 'heal', 'ttl', 'ammo'].every((k) => finite(u[k])) &&
        typeof u.cooldown === 'number' &&
        Number.isFinite(u.cooldown)
    )
  );
}
export class CastleService {
  constructor(private storage: Storage) {}
  readMeta(): CastleMeta {
    try {
      const v: unknown = JSON.parse(this.storage.getItem(META_KEY) ?? 'null');
      if (
        record(v) &&
        v.version === 1 &&
        integer(v.coins) &&
        upgrades(v.upgrades) &&
        integer(v.bestKills) &&
        integer(v.victories) &&
        Array.isArray(v.claimed) &&
        v.claimed.every((id) => typeof id === 'string')
      )
        return v as unknown as CastleMeta;
    } catch {
      /* A damaged wallet never blocks a new game. */
    }
    return fresh();
  }
  purchase(key: UpgradeKey): boolean {
    const meta = this.readMeta(),
      level = meta.upgrades[key];
    if (level >= UPGRADE_LIMIT || meta.coins < upgradeCost(level)) return false;
    meta.coins -= upgradeCost(level);
    meta.upgrades[key]++;
    try {
      this.storage.setItem(META_KEY, JSON.stringify(meta));
      return true;
    } catch {
      return false;
    }
  }
  settle(state: CastleRun): boolean {
    if (!['victory', 'defeat'].includes(state.run.phase)) return false;
    const meta = this.readMeta();
    if (meta.claimed.includes(state.id)) return true;
    meta.coins += earnedCoins(state);
    meta.bestKills = Math.max(meta.bestKills, state.siege.kills);
    if (state.run.phase === 'victory') meta.victories++;
    meta.claimed = [...meta.claimed, state.id].slice(-100);
    try {
      this.storage.setItem(META_KEY, JSON.stringify(meta));
      return true;
    } catch {
      return false;
    }
  }
  save(state: CastleRun): boolean {
    try {
      this.storage.setItem(RUN_KEY, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }
  load(): CastleRun | null {
    try {
      const v: unknown = JSON.parse(this.storage.getItem(RUN_KEY) ?? 'null');
      return validRun(v) ? v : null;
    } catch {
      return null;
    }
  }
  clear(): void {
    try {
      this.storage.removeItem(RUN_KEY);
    } catch {
      /* Unavailable storage. */
    }
  }
}
