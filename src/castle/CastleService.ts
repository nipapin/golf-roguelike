import { isSavedRun } from '../services/validateSave';
import {
  emptyUpgrades,
  UPGRADE_KEYS,
  UPGRADE_LIMIT,
  upgradeCost,
  earnedCoins,
  upgradeValue,
  SIEGE_PACING,
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
  siegesStarted: number;
  currentStreak: number;
  bestSiege: number;
}
const fresh = (): CastleMeta => ({
  version: 1,
  coins: 0,
  upgrades: emptyUpgrades(),
  claimed: [],
  bestKills: 0,
  victories: 0,
  siegesStarted: 0,
  currentStreak: 0,
  bestSiege: 0,
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
    !integer(v.siegeNumber) ||
    v.siegeNumber < 1 ||
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
  if (
    v.usedPowers !== undefined &&
    (!Array.isArray(v.usedPowers) || !v.usedPowers.every((id) => typeof id === 'string'))
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
    s.enemies.length <= SIEGE_PACING.maxEnemies &&
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
    s.units.length <= 32 &&
    s.units.every(
      (u) =>
        record(u) &&
        integer(u.id) &&
        ['soldier', 'archer', 'turret', 'mortar'].includes(String(u.kind)) &&
        typeof u.engaged === 'boolean' &&
        ['damage', 'heal', 'ttl', 'ammo', 'hp', 'maxHp', 'progress'].every((k) => finite(u[k])) &&
        (u.progress as number) <= 0.94 &&
        (u.hp as number) > 0 &&
        (u.hp as number) <= (u.maxHp as number) &&
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
        return {
          ...v,
          siegesStarted: integer(v.siegesStarted) ? v.siegesStarted : v.claimed.length,
          currentStreak: integer(v.currentStreak) ? v.currentStreak : 0,
          bestSiege: integer(v.bestSiege)
            ? v.bestSiege
            : integer(v.siegesStarted)
              ? v.siegesStarted
              : 0,
        } as unknown as CastleMeta;
    } catch {
      /* A damaged wallet never blocks a new game. */
    }
    return fresh();
  }
  beginSiege(): CastleMeta {
    const meta = this.readMeta();
    meta.siegesStarted++;
    meta.currentStreak++;
    meta.bestSiege = Math.max(meta.bestSiege, meta.currentStreak);
    try {
      this.storage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* Private storage. */
    }
    return meta;
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
    meta.bestSiege = Math.max(meta.bestSiege, state.siegeNumber);
    if (state.run.phase === 'defeat') meta.currentStreak = 0;
    if (state.run.phase === 'victory') {
      meta.victories++;
      meta.currentStreak = state.siegeNumber;
    }
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
      // Existing saves predate marching infantry; preserve their board and wallet.
      if (record(v) && v.siegeNumber === undefined) v.siegeNumber = 1;
      if (record(v) && record(v.siege) && Array.isArray(v.siege.units)) {
        const legacyBalance = v.balanceVersion !== 2;
        const levels = upgrades(v.upgrades) ? v.upgrades : emptyUpgrades();
        v.siege.units = v.siege.units.map((u) => {
          if (!record(u)) return u;
          const wasKnight = u.kind === 'knight';
          const migrated: Record<string, unknown> = {
            ...u,
            kind: wasKnight ? 'archer' : u.kind,
            hp: wasKnight ? 1 : (u.hp ?? (u.kind === 'soldier' ? 1 : 6)),
            maxHp: wasKnight ? 1 : (u.maxHp ?? (u.kind === 'soldier' ? 1 : 6)),
            progress: wasKnight ? 0.94 : (u.progress ?? 0.94),
            damage: wasKnight
              ? upgradeValue('knight', levels.knight)
              : u.hp === undefined && u.kind === 'soldier'
                ? 1
                : u.damage,
          };
          if (legacyBalance && migrated.kind === 'turret' && finite(u.ammo))
            migrated.ammo = Math.min(u.ammo, upgradeValue('magazine', levels.magazine));
          return migrated;
        });
        v.balanceVersion = 2;
      }
      if (!validRun(v)) return null;
      // Merge legacy duplicate cannons into one without summing their magazines.
      const turrets = v.siege.units.filter((u) => u.kind === 'turret');
      if (turrets.length > 1) {
        const best = turrets.reduce((a, b) => (a.ammo >= b.ammo ? a : b));
        v.siege.units = v.siege.units.filter((u) => u.kind !== 'turret' || u.id === best.id);
      }
      // Retain old boards and paid upgrade levels while replacing obsolete knight stats.
      return v;
    } catch {
      return null;
    }
  }
  resetProgress(): boolean {
    const keys = [META_KEY, RUN_KEY, 'castle-interactive-training-v1', 'golf-castle-rules-v1'];
    const previous = new Map<string, string | null>();
    try {
      for (const key of keys) previous.set(key, this.storage.getItem(key));
      for (const key of keys) this.storage.removeItem(key);
      return true;
    } catch {
      // Do not leave a partially erased wallet/save if storage refuses a write.
      for (const [key, value] of previous) {
        try {
          if (value === null) this.storage.removeItem(key);
          else this.storage.setItem(key, value);
        } catch {
          /* Storage is unavailable. */
        }
      }
      return false;
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
