import { isSavedRun } from '../services/validateSave';
import {
  castleLevel,
  MODULES,
  normalizeCastleProgression,
  XP_THRESHOLDS,
} from './CastleProgression';
import {
  CASTLE_ABILITIES,
  emptyUpgrades,
  UPGRADE_KEYS,
  UPGRADE_LIMIT,
  upgradeCost,
  earnedCoins,
  upgradeValue,
  SIEGE_PACING,
  type CastleRun,
  type CastleRunStats,
  type Upgrades,
  type UpgradeKey,
} from './CastleDefense';
const META_KEY = 'golf-castle-meta-v1';
const RUN_KEY = 'golf-castle-run-v1';
export interface CastleUndoHistory {
  cost: number;
  entries: { state: CastleRun; cost: number }[];
}
export interface CastleContinuation {
  sourceSiege: string;
  siegeNumber: number;
  coins: number;
  hp: number;
  maxHp: number;
  armor: number;
  stats?: CastleRunStats;
  perks?: { id: string; stacks: number }[];
  perkRerollsUsed?: number;
  perkFreeRerollsUsed?: number;
  perkRareStreak?: number;
  progression?: { xp: number; level: number; modules: string[] };
}
export interface CastleSiegeStart extends CastleMeta {
  /** Returned only after the saved continuation has been consumed. */
  carryover?: CastleContinuation;
}
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
  continuation?: CastleContinuation;
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
function runStats(v: unknown): v is CastleRunStats {
  return (
    record(v) &&
    finite(v.seconds) &&
    ['roundsWon', 'enemiesDefeated', 'bossesDefeated', 'cardsPlayed', 'goldEarned'].every((key) =>
      integer(v[key])
    )
  );
}
/** Older saves retain the statistics that can be reconstructed from their board. */
function legacyRunStats(v: Record<string, unknown>): CastleRunStats {
  const siege = record(v.siege) ? v.siege : {};
  const run = record(v.run) ? v.run : {};
  const battle = record(run.battle) ? run.battle : {};
  const remaining = Array.isArray(battle.tableau)
    ? battle.tableau.reduce(
        (total, column) =>
          total + (record(column) && Array.isArray(column.cards) ? column.cards.length : 0),
        0
      )
    : 28;
  return {
    roundsWon: Math.max(0, Number(v.siegeNumber ?? 1) - 1) + (run.phase === 'victory' ? 1 : 0),
    enemiesDefeated: Number(siege.kills ?? 0),
    bossesDefeated: 0,
    cardsPlayed: Math.max(0, 28 - remaining),
    seconds: Number(siege.elapsed ?? 0),
    goldEarned: Math.max(0, Number(siege.coins ?? 0) - Number(v.inheritedCoins ?? 0)),
  };
}
function ownedPerks(v: unknown): v is { id: string; stacks: number }[] {
  return (
    Array.isArray(v) &&
    v.every(
      (p) =>
        record(p) &&
        typeof p.id === 'string' &&
        p.id.length > 0 &&
        integer(p.stacks) &&
        p.stacks >= 1 &&
        p.stacks <= 3
    )
  );
}
function savedProgression(v: unknown): v is { xp: number; level: number; modules: string[] } {
  return (
    record(v) &&
    integer(v.xp) &&
    integer(v.level) &&
    Array.isArray(v.modules) &&
    v.modules.every((m) => typeof m === 'string')
  );
}
function continuation(v: unknown): v is CastleContinuation {
  return (
    record(v) &&
    typeof v.sourceSiege === 'string' &&
    v.sourceSiege.length > 0 &&
    integer(v.siegeNumber) &&
    v.siegeNumber >= 1 &&
    integer(v.coins) &&
    integer(v.armor) &&
    finite(v.hp) &&
    finite(v.maxHp) &&
    v.hp > 0 &&
    v.hp <= v.maxHp &&
    (v.stats === undefined || runStats(v.stats)) &&
    (v.perks === undefined || ownedPerks(v.perks)) &&
    (v.perkRerollsUsed === undefined || integer(v.perkRerollsUsed)) &&
    (v.perkFreeRerollsUsed === undefined || integer(v.perkFreeRerollsUsed)) &&
    (v.perkRareStreak === undefined || integer(v.perkRareStreak)) &&
    (v.progression === undefined || savedProgression(v.progression))
  );
}
function upgrades(v: unknown): v is Upgrades {
  return record(v) && UPGRADE_KEYS.every((k) => integer(v[k]) && v[k] <= UPGRADE_LIMIT);
}
function reserve(v: unknown): boolean {
  return record(v) && ['red', 'black'].every((color) => integer(v[color]) && v[color] <= 1);
}
function progression(v: unknown): boolean {
  return (
    record(v) &&
    integer(v.xp) &&
    v.level === castleLevel(v.xp) &&
    Array.isArray(v.modules) &&
    v.modules.every((key) =>
      MODULES.some((module) => module.id === key && module.level <= Number(v.level))
    ) &&
    new Set(v.modules).size === v.modules.length
  );
}
/** Remove retired resources without losing any of the 52 ordinary cards. */
function migrateProgressionAndReserve(v: Record<string, unknown>): void {
  if (!record(v.run) || !record(v.run.battle) || !record(v.siege)) return;
  const units = Array.isArray(v.siege.units) ? v.siege.units : [];
  let level = 1;
  for (const unit of units) {
    if (!record(unit)) continue;
    level = Math.max(
      level,
      ['soldier', 'archer', 'turret', 'mortar'].indexOf(String(unit.kind)) + 1
    );
  }
  if (finite(v.siege.laserCharge) && v.siege.laserCharge > 0) level = 5;
  v.progression = normalizeCastleProgression({ xp: XP_THRESHOLDS[level - 1], modules: [] });
  v.reserve = { red: 0, black: 0 };
  v.balanceVersion = 3;
  delete v.undoHistory;
}
/** Returns true when an obsolete board/history needs a rules migration. */
function migrateRules(v: Record<string, unknown>): boolean {
  if (!record(v.run) || !record(v.run.battle)) return false;
  const battle = v.run.battle;
  battle.allowRankWrap = true;
  if (v.runStats === undefined) v.runStats = legacyRunStats(v);
  let changed = v.undoRemaining === undefined || v.abilitiesUsed === undefined;
  const isJoker = (card: unknown): boolean =>
    record(card) && (card.joker === 'red' || card.joker === 'black');
  const withoutJokers = (cards: unknown[]) =>
    cards.filter((card) => {
      if (!isJoker(card)) return true;
      changed = true;
      return false;
    });
  for (const key of ['deck', 'discard', 'chain']) {
    if (Array.isArray(battle[key])) battle[key] = withoutJokers(battle[key]);
  }
  if (Array.isArray(battle.tableau))
    battle.tableau = battle.tableau.map((column) =>
      record(column) && Array.isArray(column.cards)
        ? { ...column, cards: withoutJokers(column.cards) }
        : column
    );
  if (isJoker(battle.activeCard)) {
    changed = true;
    // An ordinary stock/discard card becomes the anchor in exactly one place.
    battle.activeCard =
      (Array.isArray(battle.deck) ? battle.deck.shift() : undefined) ??
      (Array.isArray(battle.discard) ? battle.discard.pop() : undefined);
  }
  if (Array.isArray(battle.powerCards)) {
    let guards = 0;
    battle.powerCards = battle.powerCards.flatMap((power) => {
      if (!record(power)) return [power]; // Validation still rejects damaged records.
      if (power.type === 'GOLD') {
        changed = true;
        if (++guards > 2) return [];
        return [{ ...power, type: 'GUARD' }];
      }
      if (['HEAL', 'BOMB', 'ECHO', 'CRIT'].includes(String(power.type))) {
        changed = true;
        return [];
      }
      // WILD cards are no longer supported; remove them.
      if (power.type === 'WILD') {
        changed = true;
        return [];
      }
      if (power.type === 'GUARD' && ++guards > 3) {
        changed = true;
        return [];
      }
      return [power];
    });
  }
  if (v.reserve === undefined || reserve(v.reserve)) {
    if (
      v.reserve === undefined ||
      (v.reserve as Record<string, unknown>).red !== 0 ||
      (v.reserve as Record<string, unknown>).black !== 0
    )
      changed = true;
    v.reserve = { red: 0, black: 0 };
  }
  if (
    battle.castleJokerExit !== undefined ||
    battle.castleCritical === true ||
    (battle.jokerMultiplier !== undefined && battle.jokerMultiplier !== 1) ||
    (battle.lifestealMultiplier !== undefined && battle.lifestealMultiplier !== 0)
  )
    changed = true;
  delete battle.castleJokerExit;
  if (battle.castleCritical !== undefined) battle.castleCritical = false;
  battle.jokerMultiplier = 1;
  battle.lifestealMultiplier = 0;
  if (v.undoRemaining === undefined) v.undoRemaining = 3;
  if (v.abilitiesUsed === undefined) v.abilitiesUsed = [];
  if (record(v.siege) && Array.isArray(v.siege.units))
    for (const unit of v.siege.units) {
      if (record(unit) && finite(unit.heal) && unit.heal > 0) {
        unit.heal = 0;
        changed = true;
      }
    }
  if (changed) delete v.undoHistory;
  return changed;
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
    v.balanceVersion !== 3 ||
    !progression(v.progression) ||
    !reserve(v.reserve) ||
    !record(v.run) ||
    !record(v.run.player) ||
    !record(v.siege)
  )
    return false;
  if (!['battle', 'victory', 'defeat'].includes(String(v.run.phase))) return false;
  if (!record(v.run.battle)) return false;
  const battle = v.run.battle;
  const physical = [
    battle.activeCard,
    ...(Array.isArray(battle.deck) ? battle.deck : []),
    ...(Array.isArray(battle.discard) ? battle.discard : []),
    ...(Array.isArray(battle.chain) ? battle.chain : []),
    ...(Array.isArray(battle.tableau)
      ? battle.tableau.flatMap((column) =>
          record(column) && Array.isArray(column.cards) ? column.cards : []
        )
      : []),
  ];
  if (physical.some((card) => record(card) && card.joker !== undefined)) return false;
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
  if (v.inheritedCoins !== undefined && !integer(v.inheritedCoins)) return false;
  if (v.emptyDraws !== undefined && (!integer(v.emptyDraws) || v.emptyDraws > 6)) return false;
  if (v.drawAssistAt !== undefined && (!integer(v.drawAssistAt) || v.drawAssistAt < 3 || v.drawAssistAt > 7)) return false;
  if (v.drawAssistRngState !== undefined && (!integer(v.drawAssistRngState) || v.drawAssistRngState > 0xffffffff)) return false;
  if (!runStats(v.runStats)) return false;
  if (
    !integer(v.undoRemaining) ||
    v.undoRemaining > 3 ||
    !Array.isArray(v.abilitiesUsed) ||
    !v.abilitiesUsed.every(
      (ability) => typeof ability === 'string' && Object.hasOwn(CASTLE_ABILITIES, ability)
    ) ||
    new Set(v.abilitiesUsed).size !== v.abilitiesUsed.length
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
        ['burning', 'burnDamage'].every((key) => e[key] === undefined || finite(e[key])) &&
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
          continuation: continuation(v.continuation) ? v.continuation : undefined,
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
  beginSiege(): CastleSiegeStart {
    const meta = this.readMeta();
    let carryover =
      meta.continuation?.siegeNumber === meta.currentStreak &&
      meta.claimed.includes(meta.continuation.sourceSiege)
        ? meta.continuation
        : undefined;
    // Migrate deprecated perks (wild_reserve was removed with the WILD card).
    if (carryover?.perks) {
      carryover = { ...carryover, perks: carryover.perks.filter((p) => p.id !== 'wild_reserve') };
    }
    delete meta.continuation;
    meta.siegesStarted++;
    meta.currentStreak++;
    meta.bestSiege = Math.max(meta.bestSiege, meta.currentStreak);
    // One write consumes the carryover and advances the round together. If it
    // fails, the caller must retain the old run rather than transfer it twice.
    try {
      this.storage.setItem(META_KEY, JSON.stringify(meta));
    } catch (error) {
      if (carryover) throw error;
      // A fresh attempt can remain playable in memory when storage is disabled.
    }
    return { ...meta, carryover };
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
    meta.coins += Math.max(0, earnedCoins(state) - (state.inheritedCoins ?? 0));
    meta.bestKills = Math.max(meta.bestKills, state.siege.kills);
    meta.bestSiege = Math.max(meta.bestSiege, state.siegeNumber);
    if (state.run.phase === 'defeat') {
      meta.currentStreak = 0;
      delete meta.continuation;
    }
    if (state.run.phase === 'victory') {
      meta.victories++;
      meta.currentStreak = state.siegeNumber;
      const next = {
        sourceSiege: state.id,
        siegeNumber: state.siegeNumber,
        coins: state.siege.coins,
        hp: state.run.player.hp,
        maxHp: state.run.player.maxHp,
        armor: state.run.player.armor,
        stats: {
          ...(state.runStats ?? legacyRunStats(state as unknown as Record<string, unknown>)),
        },
        perks: state.perks,
        perkRerollsUsed: state.perkRerollsUsed,
        perkFreeRerollsUsed: state.perkFreeRerollsUsed,
        perkRareStreak: state.perkRareStreak,
        progression: {
          xp: state.progression.xp,
          level: state.progression.level,
          modules: [...state.progression.modules],
        },
      };
      if (continuation(next)) meta.continuation = next;
    }
    meta.claimed = [...meta.claimed, state.id].slice(-100);
    try {
      this.storage.setItem(META_KEY, JSON.stringify(meta));
      return true;
    } catch {
      return false;
    }
  }
  save(state: CastleRun, undoHistory?: CastleUndoHistory): boolean {
    try {
      const linear = (snapshot: CastleRun): CastleRun => ({
        ...snapshot,
        run: {
          ...snapshot.run,
          battle: snapshot.run.battle ? { ...snapshot.run.battle, allowRankWrap: true } : null,
        },
      });
      const history = undoHistory
        ? {
            ...undoHistory,
            entries: undoHistory.entries.map((entry) => ({ ...entry, state: linear(entry.state) })),
          }
        : undefined;
      this.storage.setItem(RUN_KEY, JSON.stringify({ ...linear(state), undoHistory: history }));
      return true;
    } catch {
      return false;
    }
  }
  load(): CastleRun | null {
    try {
      const v: unknown = JSON.parse(this.storage.getItem(RUN_KEY) ?? 'null');
      if (
        record(v) &&
        v.balanceVersion !== undefined &&
        v.balanceVersion !== 2 &&
        v.balanceVersion !== 3
      )
        return null;
      // Existing saves predate marching infantry; preserve their board and wallet.
      if (record(v) && v.siegeNumber === undefined) v.siegeNumber = 1;
      if (record(v) && v.balanceVersion !== 3 && record(v.siege) && Array.isArray(v.siege.units)) {
        const legacyBalance = v.balanceVersion !== 2 && v.balanceVersion !== 3;
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
      }
      if (record(v) && v.balanceVersion !== 3) migrateProgressionAndReserve(v);
      if (record(v)) migrateRules(v);
      // Migrate deprecated perks (wild_reserve was removed with the WILD card).
      if (record(v) && Array.isArray(v.perks)) {
        v.perks = v.perks.filter((p) => record(p) && p.id !== 'wild_reserve');
      }
      if (!validRun(v)) return null;
      // Merge legacy duplicate cannons into one without summing their magazines.
      const turrets = v.siege.units.filter((u) => u.kind === 'turret');
      if (turrets.length > 1) {
        const best = turrets.reduce((a, b) => (a.ammo >= b.ammo ? a : b));
        v.siege.units = v.siege.units.filter((u) => u.kind !== 'turret' || u.id === best.id);
      }
      const mortars = v.siege.units.filter((unit) => unit.kind === 'mortar');
      if (mortars.length > 1) {
        const best = mortars.reduce((a, b) =>
          a.damage > b.damage || (a.damage === b.damage && a.ammo >= b.ammo) ? a : b
        );
        v.siege.units = v.siege.units.filter(
          (unit) => unit.kind !== 'mortar' || unit.id === best.id
        );
      }
      // Retain old boards and paid upgrade levels while replacing obsolete knight stats.
      // History is kept separately in memory; snapshots must never nest other history.
      delete (v as CastleRun & { undoHistory?: unknown }).undoHistory;
      return v;
    } catch {
      return null;
    }
  }
  loadUndoHistory(state: CastleRun): CastleUndoHistory {
    const empty = { cost: 0, entries: [] };
    try {
      const saved: unknown = JSON.parse(this.storage.getItem(RUN_KEY) ?? 'null');
      if (
        !record(saved) ||
        saved.id !== state.id ||
        saved.balanceVersion !== 3 ||
        state.run.phase !== 'battle'
      )
        return empty;
      if (migrateRules(saved)) return empty;
      const history = saved.undoHistory;
      if (!record(history) || !integer(history.cost) || !Array.isArray(history.entries))
        return empty;
      const entries: CastleUndoHistory['entries'] = [];
      for (const entry of history.entries) {
        if (
          !record(entry) ||
          !integer(entry.cost) ||
          entry.cost > history.cost ||
          !record(entry.state) ||
          migrateRules(entry.state) ||
          !validRun(entry.state) ||
          entry.state.id !== state.id ||
          entry.state.run.phase !== 'battle' ||
          entry.state.balanceVersion !== 3 ||
          (entry.state.inheritedCoins ?? 0) !== (state.inheritedCoins ?? 0)
        )
          return empty;
        const snapshot = entry.state;
        delete (snapshot as CastleRun & { undoHistory?: unknown }).undoHistory;
        entries.push({ state: snapshot, cost: entry.cost });
      }
      return { cost: history.cost, entries };
    } catch {
      return empty;
    }
  }
  resetProgress(): boolean {
    const keys = [
      META_KEY,
      RUN_KEY,
      'castle-interactive-training-v1',
      'castle-interactive-training-v2',
      'golf-castle-rules-v1',
    ];
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
