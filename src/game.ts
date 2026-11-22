import { SoundManager } from './audio';
import {
  GUEST_TYPES,
  RANDOM_EVENTS,
  SEAT_SLOTS,
  UPGRADES,
  getCurrentInnLevel,
  getNextInnLevel,
  getUpgradeCost,
} from './data';
import { formatGold } from './format';
import {
  BLACKSMITH_TOOLS,
  DUNGEONS,
  DUNGEON_MAP,
  EQUIPMENT_DEFS,
  EQUIPMENT_DEF_MAP,
  HERO_CLASSES,
  HERO_ROSTER,
  HERO_ROSTER_MAP,
  INN_MEAL_OPTIONS,
  MATERIALS,
  MATERIAL_MAP,
  MAX_ENHANCE_LEVEL,
  POTION_RECIPES,
  POTION_RECIPE_MAP,
  POTION_TOOLS,
  getEnhanceCost,
  getEnhanceSuccessRate,
  getHeroRequiredXp,
  getInnUpgradeMaterialRequirements,
} from './loopData';
import { CANVAS_WIDTH, HeroCanvasEntity, RenderContextState } from './renderer';
import {
  canClassEquip,
  evaluatePartyForDungeon,
  getEquipmentScoreForClass,
  getHeroStatBreakdown,
  selectBestPartyForDungeon,
} from './synergy';
import {
  ActiveEvent,
  ActiveExpedition,
  CoinParticle,
  CraftQueueItem,
  EnhanceAttemptResult,
  EquipSlot,
  EquipmentInstance,
  ExpeditionResultSummary,
  FloatingText,
  GuestEntity,
  GuestTypeDef,
  HeroBuff,
  HeroState,
  LogEntry,
  OrderType,
  RandomEventDef,
  SaveData,
  SeatSlot,
  ShopToolDef,
} from './types';

export const SAVE_STORAGE_KEY = 'pixel_dungeon_inn_save_v1';
export const CURRENT_SAVE_VERSION = 2;
export const MAX_OFFLINE_SECONDS = 8 * 3600; // 8시간 상한
export const PEDDLER_AUTO_SELL_AGE_SEC = 45; // 45초간 미매입 시 행상인 안전 매각

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  public removeItem(key: string): void {
    this.store.delete(key);
  }
}

function getDefaultStorageAdapter(): StorageAdapter {
  try {
    if (typeof localStorage !== 'undefined' && localStorage !== null) {
      return localStorage;
    }
  } catch {
    // headless environment
  }
  return new MemoryStorageAdapter();
}

export interface OfflineReport {
  elapsedSeconds: number;
  cappedSeconds: number;
  wasCapped: boolean;
  earnedGold: number;
  gpsUsed: number;
  expeditionsCompleted: number;
  potionsCrafted: number;
  equipsCrafted: number;
  peddlerSales: number;
  injuredCount: number;
}

export class DungeonInnGame {
  public gold = 35;
  public totalGoldEarned = 35;
  public reputation = 0;
  public totalServed = 0;
  public totalLootFound = 0;
  public upgrades: Record<string, number> = {};
  public discoveredGuests: Record<string, number> = {
    traveler: 1,
    warrior: 1,
  };
  public tutorialSeen = false;
  public migratedFromV1 = false;

  // 순환 경제 확장 상태
  public heroes: Record<string, HeroState> = {};
  public materials: Record<string, number> = {};
  public potionTools: Record<string, number> = {};
  public potionStock: Record<string, number> = {};
  public blacksmithTools: Record<string, number> = {};
  public equipmentStock: EquipmentInstance[] = [];
  public craftQueues: {
    potion: CraftQueueItem[];
    blacksmith: CraftQueueItem[];
  } = {
    potion: [],
    blacksmith: [],
  };
  public expeditions: ActiveExpedition[] = [];
  public dungeonClears: Record<string, number> = {};
  public dungeonAttempts: Record<string, number> = {};
  public recentExpeditionResults: ExpeditionResultSummary[] = [];

  public autoBuyLoot = false;
  public autoDispatch = false;

  public totalPotionsCrafted = 0;
  public totalEquipCrafted = 0;
  public totalEnhanceSuccess = 0;
  public totalEnhanceDestroyed = 0;
  public totalPeddlerSales = 0;
  public craftedByPotionId: Record<string, number> = {};
  public craftedByRarity: Record<string, { count: number; lastItemName: string }> = {};

  public guests: GuestEntity[] = [];
  public floatingTexts: FloatingText[] = [];
  public particles: CoinParticle[] = [];
  public logs: LogEntry[] = [];
  public activeEvent: ActiveEvent | null = null;
  public eventCooldownSec = 0;

  public sound: SoundManager;

  private storage: StorageAdapter;
  private rngState: number | null = null;

  private elapsedTime = 0;
  private nextGuestUid = 1;
  private nextLogId = 1;
  private nextEquipUid = 100;
  private nextCraftUid = 1;
  private nextExpeditionUid = 1;
  private spawnTimer = 0.6;
  private autoServeTimer = 0;
  private autoEventTimer = 38;
  private saveTimer = 0;
  private heroAiTimer = 0;
  private gardenTimer = 0;
  private lastMemorySaveAt = 0;
  private innkeeperWaveTimer = 0;
  private maidPos: { x: number; y: number; facing: 'left' | 'right' } = {
    x: 155,
    y: 92,
    facing: 'left',
  };

  private onUiUpdate: () => void;
  private onLevelUp: (newLevelTitle: string, rewardText: string) => void;

  constructor(
    onUiUpdate: () => void = () => {},
    onLevelUp: (newLevelTitle: string, rewardText: string) => void = () => {},
    customStorage?: StorageAdapter
  ) {
    this.sound = new SoundManager(false);
    this.onUiUpdate = onUiUpdate;
    this.onLevelUp = onLevelUp;
    this.storage = customStorage ?? getDefaultStorageAdapter();

    this.initFreshState();
  }

  /**
   * 재현 가능한 밸런스 시뮬레이션을 위한 고정 시드 설정 (Mulberry32 PRNG)
   */
  public setSeed(seed: number): void {
    this.rngState = seed >>> 0;
  }

  public random(): number {
    if (this.rngState === null) {
      return Math.random();
    }
    let t = (this.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    this.rngState = t >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private initFreshState(): void {
    this.gold = 35;
    this.totalGoldEarned = 35;
    this.reputation = 0;
    this.totalServed = 0;
    this.totalLootFound = 0;

    for (const u of UPGRADES) {
      this.upgrades[u.id] = 0;
    }
    for (const m of MATERIALS) {
      this.materials[m.id] = 0;
    }
    for (const pt of POTION_TOOLS) {
      this.potionTools[pt.id] = 0;
    }
    // 시작 시 약초 절구 Lv.1 및 드워프 화로 Lv.1을 기본 비치해 초반 순환을 즉시 체험 가능하게 구성
    this.potionTools['pot_tool_mortar'] = 1;
    for (const pr of POTION_RECIPES) {
      this.potionStock[pr.id] = 0;
    }
    this.potionStock['potion_heal_minor'] = 1;

    for (const bt of BLACKSMITH_TOOLS) {
      this.blacksmithTools[bt.id] = 0;
    }
    this.blacksmithTools['smith_forge'] = 1;

    this.equipmentStock = [];
    this.craftQueues = { potion: [], blacksmith: [] };
    this.expeditions = [];
    this.dungeonClears = {};
    this.dungeonAttempts = {};
    for (const d of DUNGEONS) {
      this.dungeonClears[d.id] = 0;
      this.dungeonAttempts[d.id] = 0;
    }
    this.recentExpeditionResults = [];
    this.totalPotionsCrafted = 0;
    this.totalEquipCrafted = 0;
    this.totalEnhanceSuccess = 0;
    this.totalEnhanceDestroyed = 0;
    this.totalPeddlerSales = 0;
    this.craftedByPotionId = {};
    this.craftedByRarity = {};

    this.initHeroRoster();
  }

  private createBaseEquipForClass(
    classId: keyof typeof HERO_CLASSES,
    slot: EquipSlot
  ): EquipmentInstance {
    const cls = HERO_CLASSES[classId];
    const baseDefId = cls.baseEquipIds[slot];
    return {
      uid: this.nextEquipUid++,
      defId: baseDefId,
      enhanceLevel: 0,
    };
  }

  private initHeroRoster(): void {
    this.heroes = {};
    for (const def of HERO_ROSTER) {
      const cls = HERO_CLASSES[def.classId];
      const isStarter = Boolean(def.unlock.isStarter);
      const equip: Record<EquipSlot, EquipmentInstance> = {
        weapon: this.createBaseEquipForClass(def.classId, 'weapon'),
        armor: this.createBaseEquipForClass(def.classId, 'armor'),
        offhand: this.createBaseEquipForClass(def.classId, 'offhand'),
        accessory: this.createBaseEquipForClass(def.classId, 'accessory'),
      };
      this.heroes[def.id] = {
        id: def.id,
        unlocked: isStarter,
        level: 1,
        xp: 0,
        currentHp: cls.baseStats.hp,
        gold: isStarter ? 24 : 20,
        status: 'idle',
        restTimerSec: 0,
        expeditionId: null,
        equipment: equip,
        buffs: [],
        lootBag: [],
        totalRuns: 0,
        totalWins: 0,
        lastMealTimer: 0,
      };
    }
  }

  /**
   * 해금 조건을 만족한 미합류 고유 영웅이 있는지 확인하고 자동 합류 처리합니다.
   */
  public checkHeroUnlocks(): string[] {
    const newlyJoined: string[] = [];
    for (const def of HERO_ROSTER) {
      const state = this.heroes[def.id];
      if (!state || state.unlocked) continue;

      let canUnlock = false;
      if (def.unlock.isStarter) {
        canUnlock = true;
      } else if (
        def.unlock.minRep !== undefined &&
        this.reputation >= def.unlock.minRep
      ) {
        canUnlock = true;
      } else if (def.unlock.dungeonClear) {
        const clears =
          this.dungeonClears[def.unlock.dungeonClear.dungeonId] ?? 0;
        if (clears >= def.unlock.dungeonClear.count) {
          canUnlock = true;
        }
      }

      if (canUnlock) {
        state.unlocked = true;
        const bd = getHeroStatBreakdown(state);
        state.currentHp = bd.totalStats.hp;
        state.gold = Math.max(state.gold, 25 + this.getUnlockedHeroCount() * 8);
        newlyJoined.push(def.id);

        const cls = HERO_CLASSES[def.classId];
        this.addLog(
          `🦸 새로운 동료 합류! [${def.name} · ${cls.name}] — "${def.joinQuote}"`,
          'unlock'
        );
        this.spawnFloatingText(
          CANVAS_WIDTH / 2 - 40,
          60,
          `★ 동료 합류: ${def.name}!`,
          '#63e6be'
        );
      }
    }
    return newlyJoined;
  }

  public getUnlockedHeroes(): HeroState[] {
    return HERO_ROSTER.map((r) => this.heroes[r.id]).filter(
      (h): h is HeroState => Boolean(h && h.unlocked)
    );
  }

  public getUnlockedHeroCount(): number {
    return this.getUnlockedHeroes().length;
  }

  /**
   * 저장 데이터를 불러오고 v1 마이그레이션 및 오프라인 정산 결과를 반환합니다.
   */
  public loadFromStorage(): OfflineReport | null {
    try {
      const raw = this.storage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        this.addLog(
          '던전 입구 옆 작은 여관의 문을 열었습니다! 시작 파티 4명(가릭·엘레나·카엘·아린)이 대기 중입니다.',
          'normal'
        );
        this.spawnGuest();
        return null;
      }

      const data = JSON.parse(raw) as Partial<SaveData>;
      const isLegacyV1 = !data.version || data.version < CURRENT_SAVE_VERSION || !data.heroes;

      if (typeof data.gold === 'number' && Number.isFinite(data.gold)) {
        this.gold = Math.max(0, data.gold);
      }
      if (
        typeof data.totalGoldEarned === 'number' &&
        Number.isFinite(data.totalGoldEarned)
      ) {
        this.totalGoldEarned = Math.max(this.gold, data.totalGoldEarned);
      }
      if (
        typeof data.reputation === 'number' &&
        Number.isFinite(data.reputation)
      ) {
        this.reputation = Math.max(0, Math.floor(data.reputation));
      }
      if (typeof data.totalServed === 'number') {
        this.totalServed = Math.max(0, Math.floor(data.totalServed));
      }
      if (typeof data.totalLootFound === 'number') {
        this.totalLootFound = Math.max(0, Math.floor(data.totalLootFound));
      }
      if (data.upgrades && typeof data.upgrades === 'object') {
        for (const u of UPGRADES) {
          const lv = data.upgrades[u.id];
          this.upgrades[u.id] =
            typeof lv === 'number' && lv >= 0 ? Math.floor(lv) : 0;
        }
      }
      if (data.discoveredGuests && typeof data.discoveredGuests === 'object') {
        this.discoveredGuests = {
          ...this.discoveredGuests,
          ...data.discoveredGuests,
        };
      }
      if (typeof data.muted === 'boolean') {
        this.sound.setMuted(data.muted);
      }
      if (typeof data.tutorialSeen === 'boolean') {
        this.tutorialSeen = data.tutorialSeen;
      }

      // v2 확장 데이터 복원
      if (data.materials && typeof data.materials === 'object') {
        for (const m of MATERIALS) {
          this.materials[m.id] = Math.max(0, Math.floor(data.materials[m.id] ?? 0));
        }
      }
      if (data.potionTools && typeof data.potionTools === 'object') {
        for (const pt of POTION_TOOLS) {
          const fallback = pt.id === 'pot_tool_mortar' ? 1 : 0;
          this.potionTools[pt.id] = Math.max(
            fallback,
            Math.floor(data.potionTools[pt.id] ?? fallback)
          );
        }
      }
      if (data.potionStock && typeof data.potionStock === 'object') {
        for (const pr of POTION_RECIPES) {
          this.potionStock[pr.id] = Math.max(
            0,
            Math.floor(data.potionStock[pr.id] ?? 0)
          );
        }
      }
      if (data.blacksmithTools && typeof data.blacksmithTools === 'object') {
        for (const bt of BLACKSMITH_TOOLS) {
          const fallback = bt.id === 'smith_forge' ? 1 : 0;
          this.blacksmithTools[bt.id] = Math.max(
            fallback,
            Math.floor(data.blacksmithTools[bt.id] ?? fallback)
          );
        }
      }
      if (Array.isArray(data.equipmentStock)) {
        this.equipmentStock = data.equipmentStock.filter(
          (e) => e && EQUIPMENT_DEF_MAP[e.defId]
        );
      }
      if (data.craftQueues && typeof data.craftQueues === 'object') {
        this.craftQueues = {
          potion: Array.isArray(data.craftQueues.potion)
            ? data.craftQueues.potion
            : [],
          blacksmith: Array.isArray(data.craftQueues.blacksmith)
            ? data.craftQueues.blacksmith
            : [],
        };
      }
      if (Array.isArray(data.expeditions)) {
        this.expeditions = data.expeditions;
      }
      if (data.dungeonClears && typeof data.dungeonClears === 'object') {
        for (const d of DUNGEONS) {
          this.dungeonClears[d.id] = Math.max(
            0,
            Math.floor(data.dungeonClears[d.id] ?? 0)
          );
        }
      }
      if (data.dungeonAttempts && typeof data.dungeonAttempts === 'object') {
        for (const d of DUNGEONS) {
          this.dungeonAttempts[d.id] = Math.max(
            0,
            Math.floor(data.dungeonAttempts[d.id] ?? 0)
          );
        }
      }
      if (Array.isArray(data.recentExpeditionResults)) {
        this.recentExpeditionResults = data.recentExpeditionResults.slice(0, 12);
      }
      if (typeof data.autoBuyLoot === 'boolean') {
        this.autoBuyLoot = data.autoBuyLoot;
      }
      if (typeof data.autoDispatch === 'boolean') {
        this.autoDispatch = data.autoDispatch;
      }
      if (typeof data.nextEquipUid === 'number') {
        this.nextEquipUid = Math.max(100, data.nextEquipUid);
      }
      if (typeof data.totalPotionsCrafted === 'number') {
        this.totalPotionsCrafted = data.totalPotionsCrafted;
      }
      if (typeof data.totalEquipCrafted === 'number') {
        this.totalEquipCrafted = data.totalEquipCrafted;
      }
      if (typeof data.totalEnhanceSuccess === 'number') {
        this.totalEnhanceSuccess = data.totalEnhanceSuccess;
      }
      if (typeof data.totalEnhanceDestroyed === 'number') {
        this.totalEnhanceDestroyed = data.totalEnhanceDestroyed;
      }
      if (typeof data.totalPeddlerSales === 'number') {
        this.totalPeddlerSales = data.totalPeddlerSales;
      }

      if (data.heroes && typeof data.heroes === 'object') {
        for (const def of HERO_ROSTER) {
          const savedHero = data.heroes[def.id];
          if (savedHero) {
            // 기본 장비 슬롯 누락 보정
            const equip = { ...this.heroes[def.id].equipment };
            for (const slot of ['weapon', 'armor', 'offhand', 'accessory'] as const) {
              if (
                savedHero.equipment?.[slot] &&
                EQUIPMENT_DEF_MAP[savedHero.equipment[slot].defId]
              ) {
                equip[slot] = savedHero.equipment[slot];
              }
            }
            this.heroes[def.id] = {
              ...this.heroes[def.id],
              ...savedHero,
              equipment: equip,
              buffs: Array.isArray(savedHero.buffs) ? savedHero.buffs : [],
              lootBag: Array.isArray(savedHero.lootBag) ? savedHero.lootBag : [],
            };
          }
        }
      }

      if (isLegacyV1) {
        this.migratedFromV1 = true;
        this.gold = Math.max(35, this.gold);
        this.checkHeroUnlocks();
        this.saveToStorage();
        this.addLog(
          '🔄 v1 세이브 데이터를 v2 순환 경제 시스템으로 마이그레이션했습니다! 스타터 영웅단이 합류했습니다.',
          'unlock'
        );
      } else {
        this.checkHeroUnlocks();
      }

      // 해금된 손님 도감 동기화
      for (const g of GUEST_TYPES) {
        if (this.reputation >= g.unlockRep && !this.discoveredGuests[g.id]) {
          this.discoveredGuests[g.id] = 1;
        }
      }

      this.spawnGuest();

      // 오프라인 시간 계산 및 시뮬레이션 정산
      const now = Date.now();
      const lastSaved =
        typeof data.lastSavedAt === 'number' && data.lastSavedAt > 0
          ? data.lastSavedAt
          : now;
      const elapsedSec = Math.floor((now - lastSaved) / 1000);

      if (elapsedSec >= 10) {
        const cappedSec = Math.min(MAX_OFFLINE_SECONDS, elapsedSec);
        const report = this.settleOfflineProgress(elapsedSec, cappedSec);
        this.saveToStorage();
        return report;
      }

      this.addLog('여관 장부를 불러왔습니다. 영웅들과 모험가들이 대기 중입니다!', 'normal');
      return null;
    } catch {
      this.initFreshState();
      this.addLog('새 여관 장부를 시작합니다!', 'normal');
      this.spawnGuest();
      return null;
    }
  }

  private settleOfflineProgress(
    elapsedSec: number,
    cappedSec: number
  ): OfflineReport {
    const gps = this.getGoldPerSecond();
    const vaultLv = this.upgrades['fac_vault'] ?? 0;
    const offlineEfficiency = 0.85 + vaultLv * 0.1;
    let earnedGold = Math.floor(cappedSec * gps * offlineEfficiency);
    if (earnedGold > 0) {
      this.addGold(earnedGold);
    }

    const beforePotions = this.totalPotionsCrafted;
    const beforeEquips = this.totalEquipCrafted;
    const beforePeddler = this.totalPeddlerSales;
    let expeditionsCompleted = 0;

    // 진행 중이던 탐험과 제작 큐, 영웅 회복을 오프라인 시간만큼 진행 (최대 1초~5초 단위 빠른 스텝)
    let remaining = cappedSec;
    const step = Math.max(1, Math.min(5, Math.floor(cappedSec / 120) || 1));
    const prevGold = this.gold;

    while (remaining > 0) {
      const dt = Math.min(step, remaining);
      remaining -= dt;

      const expBefore = this.expeditions.length;
      this.updateCraftQueues(dt);
      this.updateExpeditions(dt);
      this.updateHeroesRestAndLootAge(dt);
      if (this.expeditions.length < expBefore) {
        expeditionsCompleted += expBefore - this.expeditions.length;
      }
      // 자동 파견이 켜져 있으면 오프라인 중에도 일부 재파견 (최대 25회 상한으로 과도한 폭주 방지)
      if (this.autoDispatch && expeditionsCompleted < 25 && this.expeditions.length === 0) {
        this.tryAutoDispatch();
      }
    }

    const extraLoopGold = Math.max(0, Math.floor(this.gold - prevGold));
    const totalOfflineGold = earnedGold + extraLoopGold;
    const injuredCount = this.getUnlockedHeroes().filter(
      (h) => h.status === 'injured'
    ).length;

    if (totalOfflineGold > 0 || expeditionsCompleted > 0) {
      this.addLog(
        `🌙 오프라인 정산: +${formatGold(totalOfflineGold)}G, 탐험 완료 ${expeditionsCompleted}회!`,
        'event'
      );
    }

    return {
      elapsedSeconds: elapsedSec,
      cappedSeconds: cappedSec,
      wasCapped: elapsedSec > MAX_OFFLINE_SECONDS,
      earnedGold: totalOfflineGold,
      gpsUsed: gps,
      expeditionsCompleted,
      potionsCrafted: this.totalPotionsCrafted - beforePotions,
      equipsCrafted: this.totalEquipCrafted - beforeEquips,
      peddlerSales: this.totalPeddlerSales - beforePeddler,
      injuredCount,
    };
  }

  public saveToStorage(isUnloadEvent = false): void {
    try {
      const now = Date.now();
      if (isUnloadEvent && this.lastMemorySaveAt > 0) {
        const existingRaw = this.storage.getItem(SAVE_STORAGE_KEY);
        if (existingRaw) {
          const existing = JSON.parse(existingRaw) as Partial<SaveData>;
          if (
            typeof existing.lastSavedAt === 'number' &&
            existing.lastSavedAt < this.lastMemorySaveAt - 5000
          ) {
            return;
          }
        }
      }
      this.lastMemorySaveAt = now;
      const payload: SaveData = {
        version: CURRENT_SAVE_VERSION,
        gold: this.gold,
        totalGoldEarned: this.totalGoldEarned,
        reputation: this.reputation,
        totalServed: this.totalServed,
        totalLootFound: this.totalLootFound,
        upgrades: this.upgrades,
        discoveredGuests: this.discoveredGuests,
        muted: this.sound.isMuted(),
        tutorialSeen: this.tutorialSeen,
        lastSavedAt: now,
        heroes: this.heroes,
        materials: this.materials,
        potionTools: this.potionTools,
        potionStock: this.potionStock,
        blacksmithTools: this.blacksmithTools,
        equipmentStock: this.equipmentStock,
        craftQueues: this.craftQueues,
        expeditions: this.expeditions,
        dungeonClears: this.dungeonClears,
        dungeonAttempts: this.dungeonAttempts,
        recentExpeditionResults: this.recentExpeditionResults,
        autoBuyLoot: this.autoBuyLoot,
        autoDispatch: this.autoDispatch,
        nextEquipUid: this.nextEquipUid,
        totalPotionsCrafted: this.totalPotionsCrafted,
        totalEquipCrafted: this.totalEquipCrafted,
        totalEnhanceSuccess: this.totalEnhanceSuccess,
        totalEnhanceDestroyed: this.totalEnhanceDestroyed,
        totalPeddlerSales: this.totalPeddlerSales,
      };
      this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // storage 예외 무시
    }
  }

  public resetGame(): void {
    try {
      this.storage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.initFreshState();
    this.discoveredGuests = {
      traveler: 1,
      warrior: 1,
    };
    this.guests = [];
    this.floatingTexts = [];
    this.particles = [];
    this.logs = [];
    this.activeEvent = null;
    this.eventCooldownSec = 0;
    this.spawnTimer = 0.4;
    this.migratedFromV1 = false;

    this.addLog(
      '여관을 처음부터 다시 단장했습니다! 시작 영웅 4명과 첫 손님이 여관에 모였습니다.',
      'normal'
    );
    this.spawnGuest();
    this.saveToStorage();
    this.onUiUpdate();
  }

  // ==========================================================================
  // 기본 여관 골드 · 평판 · 업그레이드 (상위 레벨 재료 요구 포함)
  // ==========================================================================

  public getGlobalGoldMultiplier(): number {
    let mult = 1.0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.globalMultiplierBonus) {
        mult += lv * u.globalMultiplierBonus;
      }
    }
    const innLv = getCurrentInnLevel(this.reputation).level;
    mult += (innLv - 1) * 0.05;

    // 인플레이션 폭주 방지를 위한 소프트캡 (2.2배 이상부터 완만하게 증가)
    if (mult > 2.2) {
      mult = 2.2 + Math.sqrt(mult - 2.2) * 0.4;
    }

    if (this.activeEvent) {
      mult *= Math.min(1.4, this.activeEvent.def.goldMult);
    }
    return mult;
  }

  public getGoldPerSecond(): number {
    let baseGps = 0.8; // 기본 여관 유지 수입 (교착 방지 안전망)
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0) {
        baseGps += lv * u.gpsPerLevel;
      }
    }
    return baseGps * this.getGlobalGoldMultiplier();
  }

  public getClickServeBonus(): number {
    let baseClick = 5;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0) {
        baseClick += lv * u.clickPerLevel;
      }
    }
    return Math.max(5, Math.floor(baseClick * this.getGlobalGoldMultiplier()));
  }

  public getGuestServeGold(
    guestDef: GuestTypeDef,
    isManualClick: boolean
  ): number {
    let raw = guestDef.baseGold;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0) {
        raw += lv * u.clickPerLevel;
      }
    }
    let total = raw * this.getGlobalGoldMultiplier();
    if (isManualClick) {
      total *= 1.25;
    }
    return Math.max(1, Math.floor(total));
  }

  public getServeReputationGain(guestDef: GuestTypeDef): number {
    let rep = guestDef.baseRep;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.repPerServeBonus) {
        rep += lv * u.repPerServeBonus;
      }
    }
    return Math.max(1, Math.round(rep));
  }

  public getMaxGuests(): number {
    let bonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.maxGuestsBonusPerLevel) {
        bonus += Math.ceil((lv * u.maxGuestsBonusPerLevel) / 2);
      }
    }
    return Math.min(12, 4 + bonus);
  }

  public getTotalStaffLevels(): number {
    return (
      (this.upgrades['staff_maid'] ?? 0) +
      (this.upgrades['staff_bartender'] ?? 0) +
      (this.upgrades['staff_chef'] ?? 0) +
      (this.upgrades['staff_bard'] ?? 0)
    );
  }

  public getAutoServeInterval(): number {
    let speed = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.autoServeSpeedBonus) {
        speed += lv * u.autoServeSpeedBonus;
      }
    }
    if (speed <= 0) {
      return 6.5;
    }
    return Math.max(0.55, 3.0 / (1 + speed * 0.65));
  }

  public getExtraLootChance(): number {
    let bonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.lootChanceBonus) {
        bonus += lv * u.lootChanceBonus;
      }
    }
    if (getCurrentInnLevel(this.reputation).level >= 8) {
      bonus += 0.08;
    }
    if (this.activeEvent) {
      bonus += this.activeEvent.def.lootChanceAdd;
    }
    return bonus;
  }

  public addGold(amount: number): void {
    if (amount <= 0) return;
    this.gold += amount;
    this.totalGoldEarned += amount;
  }

  public addReputation(amount: number): void {
    if (amount <= 0) return;
    const prevLevel = getCurrentInnLevel(this.reputation).level;
    this.reputation += amount;
    const newLevelDef = getCurrentInnLevel(this.reputation);

    for (const g of GUEST_TYPES) {
      if (this.reputation >= g.unlockRep && !this.discoveredGuests[g.id]) {
        this.discoveredGuests[g.id] = 1;
        this.addLog(
          `새로운 손님 [${g.name}]이(가) 여관 소문을 듣고 찾아오기 시작합니다!`,
          'unlock'
        );
      }
    }

    // 평판 상승에 따른 고유 영웅 합류 체크
    this.checkHeroUnlocks();

    if (newLevelDef.level > prevLevel) {
      this.sound.playLevelUp();
      this.addLog(
        `🎊 여관 등급 상승! [${newLevelDef.title}] 달성! (${newLevelDef.rewardText})`,
        'unlock'
      );
      this.spawnFloatingText(
        CANVAS_WIDTH / 2 - 35,
        50,
        `★ ${newLevelDef.title}!`,
        '#ffd166'
      );
      this.onLevelUp(newLevelDef.title, newLevelDef.rewardText);
    }
  }

  public hasMaterials(reqs: Record<string, number>): boolean {
    for (const [matId, needed] of Object.entries(reqs)) {
      if ((this.materials[matId] ?? 0) < needed) {
        return false;
      }
    }
    return true;
  }

  public consumeMaterials(reqs: Record<string, number>): void {
    for (const [matId, needed] of Object.entries(reqs)) {
      this.materials[matId] = Math.max(0, (this.materials[matId] ?? 0) - needed);
    }
  }

  /**
   * 여관 업그레이드 구매 (Lv.3 이상은 전리품 재료도 함께 요구)
   */
  public canBuyUpgrade(upgradeId: string): boolean {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return false;
    if (this.reputation < def.unlockRep) return false;
    const currentLv = this.upgrades[upgradeId] ?? 0;
    const cost = getUpgradeCost(def, currentLv);
    if (this.gold < cost) return false;
    const matReqs = getInnUpgradeMaterialRequirements(upgradeId, currentLv);
    return this.hasMaterials(matReqs);
  }

  public buyUpgrade(upgradeId: string): boolean {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def || !this.canBuyUpgrade(upgradeId)) return false;

    const currentLv = this.upgrades[upgradeId] ?? 0;
    const cost = getUpgradeCost(def, currentLv);
    const matReqs = getInnUpgradeMaterialRequirements(upgradeId, currentLv);

    this.gold -= cost;
    this.consumeMaterials(matReqs);
    this.upgrades[upgradeId] = currentLv + 1;
    this.sound.playUpgrade();

    this.addReputation(currentLv === 0 ? 2 : 1);

    this.spawnFloatingText(
      140,
      64,
      `${def.name} Lv.${currentLv + 1}!`,
      '#63e6be'
    );
    this.addLog(
      `[${def.name}] Lv.${currentLv + 1} 업그레이드 완료!`,
      'normal'
    );

    this.saveToStorage();
    this.onUiUpdate();
    return true;
  }

  // ==========================================================================
  // 던전 해금 · 파티 파견 · 탐험 완료 처리
  // ==========================================================================

  public isDungeonUnlocked(dungeonId: string): boolean {
    const d = DUNGEON_MAP[dungeonId];
    if (!d) return false;
    if (d.tier === 1) return true;
    const repOk = this.reputation >= d.unlockRep;
    const prevOk =
      d.unlockPrevDungeonId && d.unlockPrevClears
        ? (this.dungeonClears[d.unlockPrevDungeonId] ?? 0) >= d.unlockPrevClears
        : true;
    return repOk && prevOk;
  }

  public getMaxPartySize(): number {
    return getCurrentInnLevel(this.reputation).level >= 5 ? 4 : 3;
  }

  public getMaxConcurrentExpeditions(): number {
    const unlockedCount = this.getUnlockedHeroCount();
    const boardLv = this.upgrades['fac_board'] ?? 0;
    if (unlockedCount >= 12 || boardLv >= 5) return 3;
    if (unlockedCount >= 6 || boardLv >= 2) return 2;
    return 1;
  }

  public dispatchParty(dungeonId: string, heroIds: string[]): boolean {
    if (!this.isDungeonUnlocked(dungeonId)) return false;
    if (this.expeditions.length >= this.getMaxConcurrentExpeditions()) {
      return false;
    }

    const dungeon = DUNGEON_MAP[dungeonId];
    if (!dungeon) return false;

    const maxSize = this.getMaxPartySize();
    const uniqueIds = Array.from(new Set(heroIds)).slice(0, maxSize);
    if (uniqueIds.length === 0) return false;

    const partyHeroes: HeroState[] = [];
    for (const id of uniqueIds) {
      const h = this.heroes[id];
      if (!h || !h.unlocked || h.status !== 'idle' || h.expeditionId) {
        return false;
      }
      partyHeroes.push(h);
    }

    // 출발 전 대기 영웅들이 보유 골드로 음식/포션/장비를 자율 구매하도록 한 번 실행
    for (const h of partyHeroes) {
      this.heroAutoPrepareForExpedition(h);
    }

    const preview = evaluatePartyForDungeon(partyHeroes, dungeon);
    const expId = `exp_${this.nextExpeditionUid++}`;

    for (const h of partyHeroes) {
      h.status = 'exploring';
      h.expeditionId = expId;
    }

    this.expeditions.push({
      id: expId,
      dungeonId,
      heroIds: uniqueIds,
      totalDurationSec: preview.durationSec,
      remainingSec: preview.durationSec,
      expectedSuccessRate: preview.finalSuccessRate,
    });
    this.dungeonAttempts[dungeonId] = (this.dungeonAttempts[dungeonId] ?? 0) + 1;

    const leadRoster = HERO_ROSTER_MAP[partyHeroes[0].id];
    this.addLog(
      `🗺️ [${dungeon.name}] 원정 출발! (${preview.heroNames.join('·')} / 예상 성공률 ${Math.round(
        preview.finalSuccessRate * 100
      )}%) — ${leadRoster.name}: "${leadRoster.expeditionQuote}"`,
      'normal'
    );

    this.onUiUpdate();
    return true;
  }

  private updateExpeditions(dt: number): void {
    if (this.expeditions.length === 0) return;
    const stillRunning: ActiveExpedition[] = [];

    for (const exp of this.expeditions) {
      exp.remainingSec -= dt;
      if (exp.remainingSec <= 0) {
        this.resolveExpedition(exp);
      } else {
        stillRunning.push(exp);
      }
    }

    this.expeditions = stillRunning;
  }

  private resolveExpedition(exp: ActiveExpedition): void {
    const dungeon = DUNGEON_MAP[exp.dungeonId];
    const partyHeroes = exp.heroIds
      .map((id) => this.heroes[id])
      .filter((h): h is HeroState => Boolean(h));

    if (!dungeon || partyHeroes.length === 0) return;

    const preview = evaluatePartyForDungeon(partyHeroes, dungeon);
    const roll = this.random();
    const isSuccess = roll < preview.finalSuccessRate;

    // 버프 차감
    const immuneHeroIds = new Set<string>();
    for (const h of partyHeroes) {
      h.expeditionId = null;
      h.totalRuns += 1;
      for (const b of h.buffs) {
        if (b.injuryImmune) immuneHeroIds.add(h.id);
        b.remainingRuns -= 1;
      }
      h.buffs = h.buffs.filter((b) => b.remainingRuns > 0);
    }

    const lootDropped: Record<string, number> = {};
    const injuredHeroNames: string[] = [];

    if (isSuccess) {
      this.dungeonClears[dungeon.id] = (this.dungeonClears[dungeon.id] ?? 0) + 1;
      const xpGain = Math.max(
        5,
        Math.round(dungeon.rewardXp * preview.xpMult)
      );
      const goldPerHero = Math.max(
        4,
        Math.round(dungeon.rewardHeroGold * preview.goldMult)
      );

      // 전리품 드랍 판정
      for (const drop of dungeon.drops) {
        const effChance = Math.min(0.98, drop.chance + preview.lootChanceBonus);
        if (this.random() < effChance) {
          const count =
            drop.minCount +
            Math.floor(this.random() * (drop.maxCount - drop.minCount + 1));
          lootDropped[drop.materialId] =
            (lootDropped[drop.materialId] ?? 0) + count;
          this.totalLootFound += count;

          // 파티원 인벤토리에 고르게 분배
          const recipient =
            partyHeroes[Math.floor(this.random() * partyHeroes.length)];
          this.addLootToHeroBag(recipient, drop.materialId, count);
        }
      }

      for (const h of partyHeroes) {
        h.totalWins += 1;
        h.gold += goldPerHero;
        this.grantHeroXp(h, xpGain);
        const bd = getHeroStatBreakdown(h);
        // 성공 시 가벼운 체력 소모
        const hpLoss = Math.floor(bd.totalStats.hp * (0.15 + this.random() * 0.15));
        h.currentHp = Math.max(1, h.currentHp - hpLoss);
        if (h.currentHp < bd.totalStats.hp * 0.45) {
          h.status = 'fatigued';
          h.restTimerSec = this.getHeroRestDuration(h, 'fatigued');
        } else {
          h.status = 'idle';
          h.currentHp = bd.totalStats.hp;
        }
      }

      this.addReputation(dungeon.rewardRep);

      // 자동 매입이 켜져 있으면 즉시 매입 시도
      if (this.autoBuyLoot) {
        this.buyAllHeroLoot(15);
      }

      const lootText = Object.entries(lootDropped)
        .map(([mId, cnt]) => `${MATERIAL_MAP[mId]?.name ?? mId} x${cnt}`)
        .join(', ');

      this.addLog(
        `🏆 [${dungeon.name}] 공략 성공! (${preview.heroNames.join('·')}) — XP +${xpGain}, 영웅 골드 +${goldPerHero}G${
          lootText ? `, 전리품: ${lootText}` : ''
        }`,
        'loot'
      );

      this.checkHeroUnlocks();
    } else {
      // 실패 처리: 소량의 경험치/골드 지급 + 부상/피로 부여
      const xpGain = Math.max(3, Math.round(dungeon.rewardXp * 0.35));
      const goldPerHero = Math.max(2, Math.round(dungeon.rewardHeroGold * 0.25));

      // 실패해도 첫 1티어 재료 1개는 가끔 건져옴 (완전 빈손 정체 방지)
      if (dungeon.drops.length > 0 && this.random() < 0.45) {
        const firstMat = dungeon.drops[0].materialId;
        lootDropped[firstMat] = 1;
        this.addLootToHeroBag(partyHeroes[0], firstMat, 1);
      }

      for (const h of partyHeroes) {
        h.gold += goldPerHero;
        this.grantHeroXp(h, xpGain);

        const isImmune = immuneHeroIds.has(h.id);
        const injuryChance = isImmune
          ? 0
          : Math.min(0.85, 0.55 * preview.injuryRiskMult);
        if (this.random() < injuryChance) {
          h.status = 'injured';
          h.currentHp = Math.max(1, Math.floor(h.currentHp * 0.25));
          h.restTimerSec = this.getHeroRestDuration(h, 'injured');
          injuredHeroNames.push(HERO_ROSTER_MAP[h.id].name);
        } else {
          h.status = 'fatigued';
          h.currentHp = Math.max(1, Math.floor(h.currentHp * 0.5));
          h.restTimerSec = this.getHeroRestDuration(h, 'fatigued');
        }
      }

      this.addLog(
        `💥 [${dungeon.name}] 탐험 실패 (${preview.heroNames.join('·')}) — ${
          injuredHeroNames.length > 0
            ? `부상: ${injuredHeroNames.join(', ')} (휴식/포션 치료 필요)`
            : '파티원 피로 누적'
        }`,
        'event'
      );
    }

    const now = new Date();
    const ts = `${String(now.getMinutes()).padStart(2, '0')}:${String(
      now.getSeconds()
    ).padStart(2, '0')}`;
    this.recentExpeditionResults.unshift({
      id: this.nextLogId++,
      timestampText: ts,
      dungeonId: dungeon.id,
      dungeonName: dungeon.name,
      heroIds: exp.heroIds,
      heroNames: preview.heroNames,
      success: isSuccess,
      successRateUsed: preview.finalSuccessRate,
      xpGained: isSuccess
        ? Math.round(dungeon.rewardXp * preview.xpMult)
        : Math.round(dungeon.rewardXp * 0.35),
      heroGoldGained: isSuccess
        ? Math.round(dungeon.rewardHeroGold * preview.goldMult)
        : Math.round(dungeon.rewardHeroGold * 0.25),
      lootDropped,
      injuredHeroNames,
      synergySummaryText: `${preview.roleSynergyTitle} (${
        preview.totalSynergyDelta >= 0 ? '+' : ''
      }${Math.round(preview.totalSynergyDelta * 100)}%)`,
    });
    if (this.recentExpeditionResults.length > 10) {
      this.recentExpeditionResults.length = 10;
    }

    this.onUiUpdate();
  }

  private addLootToHeroBag(
    hero: HeroState,
    materialId: string,
    count: number
  ): void {
    if (count <= 0) return;
    const existing = hero.lootBag.find((s) => s.materialId === materialId);
    if (existing) {
      existing.count += count;
    } else {
      hero.lootBag.push({
        materialId,
        count,
        ageSeconds: 0,
      });
    }
  }

  public grantHeroXp(hero: HeroState, amount: number): void {
    if (amount <= 0) return;
    hero.xp += amount;
    let leveledUp = false;
    while (hero.xp >= getHeroRequiredXp(hero.level)) {
      hero.xp -= getHeroRequiredXp(hero.level);
      hero.level += 1;
      leveledUp = true;
    }
    if (leveledUp) {
      const bd = getHeroStatBreakdown(hero);
      hero.currentHp = bd.totalStats.hp;
      const roster = HERO_ROSTER_MAP[hero.id];
      this.addLog(
        `⬆️ [${roster.name}] 레벨 업! (Lv.${hero.level} 달성 · 전투력 ${bd.combatPower})`,
        'unlock'
      );
    }
  }

  public getRoomRecoveryBonus(): number {
    const straw = this.upgrades['room_straw'] ?? 0;
    const oak = this.upgrades['room_oak'] ?? 0;
    const wool = this.upgrades['room_wool'] ?? 0;
    const magic = this.upgrades['room_magic'] ?? 0;
    const royal = this.upgrades['room_royal'] ?? 0;
    const spring = this.upgrades['fac_hotspring'] ?? 0;
    return (
      1 +
      straw * 0.1 +
      oak * 0.15 +
      wool * 0.22 +
      magic * 0.3 +
      royal * 0.45 +
      spring * 0.35
    );
  }

  public getHeroRestDuration(
    _hero: HeroState,
    kind: 'injured' | 'fatigued'
  ): number {
    const base = kind === 'injured' ? 16 : 7;
    return Math.max(2.5, base / this.getRoomRecoveryBonus());
  }

  // ==========================================================================
  // 전리품 매입 (거래 탭) 및 행상인 자동 매각 안전장치
  // ==========================================================================

  public getPendingLootSummary(): {
    items: {
      heroId: string;
      heroName: string;
      materialId: string;
      materialName: string;
      icon: string;
      rarity: string;
      count: number;
      unitPrice: number;
      totalPrice: number;
      ageSeconds: number;
    }[];
    totalCost: number;
    totalCount: number;
  } {
    const items: {
      heroId: string;
      heroName: string;
      materialId: string;
      materialName: string;
      icon: string;
      rarity: string;
      count: number;
      unitPrice: number;
      totalPrice: number;
      ageSeconds: number;
    }[] = [];
    let totalCost = 0;
    let totalCount = 0;

    for (const h of this.getUnlockedHeroes()) {
      const roster = HERO_ROSTER_MAP[h.id];
      for (const stack of h.lootBag) {
        if (stack.count <= 0) continue;
        const mat = MATERIAL_MAP[stack.materialId];
        if (!mat) continue;
        const cost = stack.count * mat.buyPrice;
        totalCost += cost;
        totalCount += stack.count;
        items.push({
          heroId: h.id,
          heroName: roster.name,
          materialId: mat.id,
          materialName: mat.name,
          icon: mat.icon,
          rarity: mat.rarity,
          count: stack.count,
          unitPrice: mat.buyPrice,
          totalPrice: cost,
          ageSeconds: stack.ageSeconds,
        });
      }
    }

    return { items, totalCost, totalCount };
  }

  /**
   * 특정 영웅의 전리품 스택을 플레이어가 골드로 매입합니다. (영웅 골드 증가 + 플레이어 창고 재료 증가)
   */
  public buyHeroLoot(
    heroId: string,
    materialId: string,
    maxCount?: number
  ): number {
    const hero = this.heroes[heroId];
    const mat = MATERIAL_MAP[materialId];
    if (!hero || !mat) return 0;

    const stack = hero.lootBag.find((s) => s.materialId === materialId);
    if (!stack || stack.count <= 0) return 0;

    const affordable = Math.floor(this.gold / mat.buyPrice);
    if (affordable <= 0) return 0;

    const buyCount = Math.min(
      stack.count,
      affordable,
      maxCount ?? stack.count
    );
    if (buyCount <= 0) return 0;

    const totalCost = buyCount * mat.buyPrice;
    this.gold -= totalCost;
    hero.gold += totalCost;
    this.materials[materialId] = (this.materials[materialId] ?? 0) + buyCount;
    stack.count -= buyCount;

    hero.lootBag = hero.lootBag.filter((s) => s.count > 0);
    this.onUiUpdate();
    return buyCount;
  }

  /**
   * 모든 영웅의 전리품을 플레이어가 감당 가능한 만큼 일괄 매입합니다.
   */
  public buyAllHeroLoot(reserveGold = 0): {
    boughtCount: number;
    spentGold: number;
  } {
    let boughtCount = 0;
    let spentGold = 0;

    for (const h of this.getUnlockedHeroes()) {
      for (const stack of [...h.lootBag]) {
        const mat = MATERIAL_MAP[stack.materialId];
        if (!mat || stack.count <= 0) continue;
        const availGold = Math.max(0, this.gold - reserveGold);
        const canBuy = Math.min(
          stack.count,
          Math.floor(availGold / mat.buyPrice)
        );
        if (canBuy > 0) {
          const cost = canBuy * mat.buyPrice;
          this.gold -= cost;
          h.gold += cost;
          this.materials[mat.id] = (this.materials[mat.id] ?? 0) + canBuy;
          stack.count -= canBuy;
          boughtCount += canBuy;
          spentGold += cost;
        }
      }
      h.lootBag = h.lootBag.filter((s) => s.count > 0);
    }

    if (boughtCount > 0) {
      this.sound.playCoin();
      this.onUiUpdate();
    }
    return { boughtCount, spentGold };
  }

  // ==========================================================================
  // 여관 효과: 영웅 식사 대접 / 객실 휴식 / 포션 지급 / 영웅 자율 소비 AI
  // ==========================================================================

  public getUnlockedMeals() {
    // 첫 번째 기본 수프는 항상 이용 가능하며, 상위 메뉴는 업그레이드 레벨 > 0 일 때 해금
    return INN_MEAL_OPTIONS.filter(
      (m, idx) => idx === 0 || (this.upgrades[m.upgradeId] ?? 0) > 0
    );
  }

  public getMealEffectiveBuff(mealUpgradeId: string): {
    option: (typeof INN_MEAL_OPTIONS)[number];
    price: number;
    buff: HeroBuff;
  } {
    const opt =
      INN_MEAL_OPTIONS.find((m) => m.upgradeId === mealUpgradeId) ??
      INN_MEAL_OPTIONS[0];
    const lv = Math.max(1, this.upgrades[opt.upgradeId] ?? 1);
    const levelMult = 1 + (lv - 1) * 0.08;
    const price = Math.round(opt.basePrice * (1 + (lv - 1) * 0.05));

    const scaledStats: HeroBuff['statBonusPct'] = {};
    for (const [k, v] of Object.entries(opt.statBonusPct)) {
      scaledStats[k as keyof typeof scaledStats] = Number(
        ((v ?? 0) * levelMult).toFixed(3)
      );
    }

    return {
      option: opt,
      price,
      buff: {
        id: `buff_meal_${opt.upgradeId}`,
        name: `${opt.name} Lv.${lv}`,
        icon: opt.icon,
        source: 'food',
        statBonusPct: scaledStats,
        successRateBonus: Math.min(0.18, opt.successRateBonus * levelMult),
        xpMultBonus: opt.xpMultBonus * levelMult,
        remainingRuns: 1,
      },
    };
  }

  /**
   * 플레이어가 영웅에게 여관 음식을 대접합니다 (플레이어 골드 지출 -> 영웅 회복 + 음식 버프).
   */
  public treatHeroMeal(heroId: string, mealUpgradeId?: string): boolean {
    const hero = this.heroes[heroId];
    if (!hero || !hero.unlocked) return false;

    const meals = this.getUnlockedMeals();
    const chosenOpt = mealUpgradeId
      ? meals.find((m) => m.upgradeId === mealUpgradeId) ?? meals[meals.length - 1]
      : meals[meals.length - 1];

    const { option, price, buff } = this.getMealEffectiveBuff(
      chosenOpt.upgradeId
    );
    const treatCost = Math.max(4, Math.floor(price * 0.7));
    if (this.gold < treatCost) return false;

    this.gold -= treatCost;
    this.applyBuffAndHealToHero(hero, buff, option.hpRestorePct, false, true);

    const roster = HERO_ROSTER_MAP[hero.id];
    this.addLog(
      `🍲 [${roster.name}]에게 〈${option.name}〉을(를) 대접했습니다! (다음 탐험 버프 획득)`,
      'normal'
    );
    this.onUiUpdate();
    return true;
  }

  /**
   * 플레이어가 부상/피로 영웅에게 객실 특실 휴식을 즉시 제공합니다.
   */
  public restHeroInRoom(heroId: string): boolean {
    const hero = this.heroes[heroId];
    if (!hero || !hero.unlocked || hero.status === 'exploring') return false;

    const roomCost = 10;
    if (this.gold < roomCost) return false;
    this.gold -= roomCost;

    const bd = getHeroStatBreakdown(hero);
    hero.currentHp = bd.totalStats.hp;
    hero.status = 'idle';
    hero.restTimerSec = 0;

    const roomBonus = Math.min(0.25, 0.08 + (this.getRoomRecoveryBonus() - 1) * 0.06);
    const restBuff: HeroBuff = {
      id: 'buff_well_rested',
      name: '특실 숙면 활력',
      icon: '🛏️',
      source: 'rest',
      statBonusPct: { hp: roomBonus, def: roomBonus },
      successRateBonus: 0.04,
      xpMultBonus: 0.08,
      remainingRuns: 1,
    };
    hero.buffs = hero.buffs.filter((b) => b.source !== 'rest');
    hero.buffs.push(restBuff);

    const roster = HERO_ROSTER_MAP[hero.id];
    this.addLog(
      `🛏️ [${roster.name}]이(가) 여관 객실에서 푹 쉬고 부상·피로를 완벽히 회복했습니다!`,
      'normal'
    );
    this.onUiUpdate();
    return true;
  }

  /**
   * 가게 포션 재고를 영웅에게 먹입니다 (paidByHero=true 이면 영웅 골드 -> 여관 수입!)
   */
  public givePotionToHero(
    heroId: string,
    potionId: string,
    paidByHero = false
  ): boolean {
    const hero = this.heroes[heroId];
    const recipe = POTION_RECIPE_MAP[potionId];
    if (!hero || !hero.unlocked || !recipe) return false;
    if ((this.potionStock[potionId] ?? 0) <= 0) return false;

    if (paidByHero) {
      if (hero.gold < recipe.sellPriceToHero) return false;
      hero.gold -= recipe.sellPriceToHero;
      this.addGold(recipe.sellPriceToHero);
    }

    this.potionStock[potionId] -= 1;

    const buff: HeroBuff | null = recipe.buff
      ? {
          id: recipe.buff.id,
          name: recipe.buff.name,
          icon: recipe.buff.icon,
          source: 'potion',
          statBonusPct: { ...recipe.buff.statBonusPct },
          successRateBonus: recipe.buff.successRateBonus,
          xpMultBonus: recipe.buff.xpMultBonus,
          injuryImmune: recipe.buff.injuryImmune,
          remainingRuns: recipe.buff.runs,
        }
      : null;

    this.applyBuffAndHealToHero(
      hero,
      buff,
      recipe.hpRestorePct,
      recipe.healsInjury,
      recipe.healsFatigue
    );

    const roster = HERO_ROSTER_MAP[hero.id];
    if (paidByHero) {
      this.addLog(
        `🧪 [${roster.name}]이(가) 포션 가게에서 〈${recipe.name}〉을(를) 구매했습니다! (+${formatGold(
          recipe.sellPriceToHero
        )}G 여관 수입)`,
        'normal'
      );
    } else {
      this.addLog(
        `🧪 [${roster.name}]에게 〈${recipe.name}〉을(를) 지급했습니다!`,
        'normal'
      );
    }

    this.onUiUpdate();
    return true;
  }

  private applyBuffAndHealToHero(
    hero: HeroState,
    buff: HeroBuff | null,
    hpRestorePct: number,
    healsInjury: boolean,
    healsFatigue: boolean
  ): void {
    if (buff) {
      hero.buffs = hero.buffs.filter((b) => b.source !== buff.source);
      hero.buffs.push(buff);
    }
    const bd = getHeroStatBreakdown(hero);
    hero.currentHp = Math.min(
      bd.totalStats.hp,
      Math.round(hero.currentHp + bd.totalStats.hp * hpRestorePct)
    );
    if (healsInjury && hero.status === 'injured') {
      hero.status = 'idle';
      hero.restTimerSec = 0;
      hero.currentHp = bd.totalStats.hp;
    } else if (healsFatigue && hero.status === 'fatigued') {
      hero.status = 'idle';
      hero.restTimerSec = 0;
      hero.currentHp = bd.totalStats.hp;
    }
  }

  private updateHeroesRestAndLootAge(dt: number): void {
    for (const h of this.getUnlockedHeroes()) {
      // 1. 휴식 타이머 진행
      if (h.status === 'injured' || h.status === 'fatigued') {
        // 부상 중인데 포션 가게에 치료 포션이 있고 돈이 있으면 즉시 구매해서 회복!
        if (h.status === 'injured') {
          for (const pId of [
            'potion_cure_injury',
            'potion_ironblood',
            'potion_wisdom',
            'potion_dragon_elixir',
          ]) {
            const rec = POTION_RECIPE_MAP[pId];
            if (
              rec &&
              (this.potionStock[pId] ?? 0) > 0 &&
              h.gold >= rec.sellPriceToHero
            ) {
              this.givePotionToHero(h.id, pId, true);
              break;
            }
          }
        }

        if (h.status === 'injured' || h.status === 'fatigued') {
          h.restTimerSec -= dt;
          if (h.restTimerSec <= 0) {
            h.status = 'idle';
            h.restTimerSec = 0;
            const bd = getHeroStatBreakdown(h);
            h.currentHp = bd.totalStats.hp;

            // 객실 숙박비 지불 -> 여관 수입!
            const roomFee = Math.min(h.gold, Math.round(6 * this.getRoomRecoveryBonus()));
            if (roomFee > 0) {
              h.gold -= roomFee;
              this.addGold(roomFee);
            }
            // 객실 레벨이 높으면 숙면 버프 획득
            if (this.getRoomRecoveryBonus() >= 1.2) {
              const rBonus = Math.min(
                0.2,
                0.06 + (this.getRoomRecoveryBonus() - 1) * 0.05
              );
              h.buffs = h.buffs.filter((b) => b.source !== 'rest');
              h.buffs.push({
                id: 'buff_room_sleep',
                name: '여관 숙면 회복',
                icon: '🛏️',
                source: 'rest',
                statBonusPct: { hp: rBonus, def: rBonus },
                successRateBonus: 0.03,
                xpMultBonus: 0.05,
                remainingRuns: 1,
              });
            }
          }
        }
      }

      // 2. 전리품 대기 시간 증가 및 행상인 자동 매각 안전장치 (교착 방지)
      if (h.lootBag.length > 0) {
        const remainingStacks = [];
        for (const stack of h.lootBag) {
          stack.ageSeconds += dt;
          if (stack.ageSeconds >= PEDDLER_AUTO_SELL_AGE_SEC) {
            const mat = MATERIAL_MAP[stack.materialId];
            if (mat && stack.count > 0) {
              const heroGain = stack.count * mat.peddlerPrice;
              const innCommission = Math.max(1, Math.floor(heroGain * 0.25));
              h.gold += heroGain;
              this.addGold(innCommission);
              // 행상인 거래세로 재료 1개는 여관 창고에도 남음 (순환 정체 방지)
              this.materials[mat.id] = (this.materials[mat.id] ?? 0) + 1;
              this.totalPeddlerSales += stack.count;
            }
          } else {
            remainingStacks.push(stack);
          }
        }
        h.lootBag = remainingStacks;
      }
    }
  }

  /**
   * 대기 중인 영웅이 탐험 출발 전(또는 여관 체류 중) 보유 골드로
   * 여관 음식, 가게 포션, 대장간 장비를 자율 구매합니다 (순환의 핵심).
   */
  public heroAutoPrepareForExpedition(hero: HeroState): void {
    if (!hero.unlocked || hero.status !== 'idle') return;

    // 1. 대장간 재고 중 착용 가능하고 현재 장비보다 더 좋은 장비가 있으면 구매
    this.heroTryBuyBetterEquipment(hero);

    // 2. 음식 버프가 없으면 감당 가능한 가장 좋은 여관 요리 구매 (-> 여관 수입!)
    const hasFoodBuff = hero.buffs.some((b) => b.source === 'food');
    if (!hasFoodBuff && hero.gold >= 8) {
      const meals = this.getUnlockedMeals();
      for (let i = meals.length - 1; i >= 0; i--) {
        const { option, price, buff } = this.getMealEffectiveBuff(
          meals[i].upgradeId
        );
        if (hero.gold >= price) {
          hero.gold -= price;
          this.addGold(price);
          this.applyBuffAndHealToHero(
            hero,
            buff,
            option.hpRestorePct,
            false,
            true
          );
          break;
        }
      }
    }

    // 3. 포션 버프가 없으면 포션 가게 재고에서 감당 가능한 최고 포션 구매 (-> 여관 수입!)
    const hasPotionBuff = hero.buffs.some((b) => b.source === 'potion');
    if (!hasPotionBuff) {
      const priorityPotions = [
        'potion_dragon_elixir',
        'potion_ironblood',
        'potion_wisdom',
        'potion_gale',
        'potion_might',
        'potion_cure_injury',
        'potion_heal_minor',
        'potion_herb_water',
      ];
      for (const pId of priorityPotions) {
        const rec = POTION_RECIPE_MAP[pId];
        if (
          rec &&
          (this.potionStock[pId] ?? 0) > 0 &&
          hero.gold >= rec.sellPriceToHero
        ) {
          this.givePotionToHero(hero.id, pId, true);
          break;
        }
      }
    }
  }

  private heroTryBuyBetterEquipment(hero: HeroState): boolean {
    if (this.equipmentStock.length === 0) return false;
    const roster = HERO_ROSTER_MAP[hero.id];
    let boughtAny = false;

    for (const slot of ['weapon', 'armor', 'offhand', 'accessory'] as const) {
      const currentInst = hero.equipment[slot];
      const currentScore = getEquipmentScoreForClass(
        roster.classId,
        currentInst
      );

      let bestIdx = -1;
      let bestScore = currentScore;

      for (let idx = 0; idx < this.equipmentStock.length; idx++) {
        const cand = this.equipmentStock[idx];
        const def = EQUIPMENT_DEF_MAP[cand.defId];
        if (!def || def.slot !== slot) continue;
        if (!canClassEquip(roster.classId, def)) continue;
        if (hero.gold < def.buyPriceGold) continue;

        const score = getEquipmentScoreForClass(roster.classId, cand);
        if (score > bestScore + 1) {
          bestScore = score;
          bestIdx = idx;
        }
      }

      if (bestIdx >= 0) {
        const chosen = this.equipmentStock.splice(bestIdx, 1)[0];
        const def = EQUIPMENT_DEF_MAP[chosen.defId];
        hero.gold -= def.buyPriceGold;
        this.addGold(def.buyPriceGold);

        // 기존 착용 장비가 기본 장비가 아니면 대장간 재고로 반납
        const oldDef = EQUIPMENT_DEF_MAP[currentInst.defId];
        if (oldDef && !oldDef.isBase) {
          this.equipmentStock.push(currentInst);
        }
        hero.equipment[slot] = chosen;
        boughtAny = true;

        this.addLog(
          `⚒️ [${roster.name}]이(가) 대장간에서 〈${def.name}${
            chosen.enhanceLevel > 0 ? ` +${chosen.enhanceLevel}` : ''
          }〉을(를) 구매·장착했습니다! (+${formatGold(def.buyPriceGold)}G)`,
          'normal'
        );
      }
    }

    return boughtAny;
  }

  // ==========================================================================
  // 포션 가게 & 대장간: 도구 업그레이드 · 레시피 제작 · 장비 장착 · +강화 (파괴)
  // ==========================================================================

  public getShopToolLevel(
    shop: 'potion' | 'blacksmith',
    toolId: string
  ): number {
    return shop === 'potion'
      ? this.potionTools[toolId] ?? 0
      : this.blacksmithTools[toolId] ?? 0;
  }

  public getShopToolUpgradeCost(def: ShopToolDef): {
    gold: number;
    materials: Record<string, number>;
  } {
    const lv = this.getShopToolLevel(def.shop, def.id);
    const gold = Math.floor(def.baseGoldCost * Math.pow(def.costScale, lv));
    const materials: Record<string, number> = {};
    if (lv >= def.materialStartLevel) {
      const mult = Math.max(1, lv - def.materialStartLevel + 1);
      for (const [mId, baseCnt] of Object.entries(def.materialCostsPerLevel)) {
        materials[mId] = baseCnt * mult;
      }
    }
    return { gold, materials };
  }

  public canUpgradeShopTool(toolId: string): boolean {
    const def =
      POTION_TOOLS.find((t) => t.id === toolId) ??
      BLACKSMITH_TOOLS.find((t) => t.id === toolId);
    if (!def) return false;
    const lv = this.getShopToolLevel(def.shop, def.id);
    if (lv >= def.maxLevel) return false;
    const { gold, materials } = this.getShopToolUpgradeCost(def);
    return this.gold >= gold && this.hasMaterials(materials);
  }

  public upgradeShopTool(toolId: string): boolean {
    const def =
      POTION_TOOLS.find((t) => t.id === toolId) ??
      BLACKSMITH_TOOLS.find((t) => t.id === toolId);
    if (!def || !this.canUpgradeShopTool(toolId)) return false;

    const lv = this.getShopToolLevel(def.shop, def.id);
    const { gold, materials } = this.getShopToolUpgradeCost(def);

    this.gold -= gold;
    this.consumeMaterials(materials);

    if (def.shop === 'potion') {
      this.potionTools[def.id] = lv + 1;
    } else {
      this.blacksmithTools[def.id] = lv + 1;
    }

    this.sound.playUpgrade();
    this.addReputation(2);
    this.addLog(
      `${def.icon} [${def.name}] Lv.${lv + 1} 건설/강화 완료!`,
      'unlock'
    );
    this.onUiUpdate();
    return true;
  }

  public getMaxCraftSlots(shop: 'potion' | 'blacksmith'): number {
    let slots = 1;
    const list = shop === 'potion' ? POTION_TOOLS : BLACKSMITH_TOOLS;
    for (const t of list) {
      if (t.slotBonusAtLevels) {
        const lv = this.getShopToolLevel(shop, t.id);
        for (const reqLv of t.slotBonusAtLevels) {
          if (lv >= reqLv) slots += 1;
        }
      }
    }
    return Math.min(3, slots);
  }

  public getShopSuccessAndSpeedBonus(shop: 'potion' | 'blacksmith'): {
    successAdd: number;
    speedMult: number;
  } {
    const list = shop === 'potion' ? POTION_TOOLS : BLACKSMITH_TOOLS;
    let successAdd = 0;
    let speedMult = 1.0;
    for (const t of list) {
      const lv = this.getShopToolLevel(shop, t.id);
      if (lv > 0) {
        successAdd += lv * t.successBonusPerLevel;
        speedMult += lv * t.speedBonusPerLevel;
      }
    }
    return { successAdd, speedMult };
  }

  public isPotionRecipeUnlocked(potionId: string): boolean {
    const r = POTION_RECIPE_MAP[potionId];
    if (!r) return false;
    if ((this.potionTools[r.reqToolId] ?? 0) < r.reqToolLevel) return false;
    if (
      r.reqFacilityId &&
      r.reqFacilityLevel &&
      (this.potionTools[r.reqFacilityId] ?? 0) < r.reqFacilityLevel
    ) {
      return false;
    }
    return true;
  }

  public getPotionCraftPreview(potionId: string): {
    successRate: number;
    durationSec: number;
  } {
    const r = POTION_RECIPE_MAP[potionId];
    if (!r) return { successRate: 0, durationSec: 10 };
    const { successAdd, speedMult } = this.getShopSuccessAndSpeedBonus('potion');
    const successRate = Math.min(0.98, r.baseSuccessRate + successAdd * 0.65);
    const durationSec = Math.max(3, Math.round(r.craftTimeSec / speedMult));
    return { successRate, durationSec };
  }

  public canCraftPotion(potionId: string): boolean {
    const r = POTION_RECIPE_MAP[potionId];
    if (!r || !this.isPotionRecipeUnlocked(potionId)) return false;
    if (this.craftQueues.potion.length >= this.getMaxCraftSlots('potion')) {
      return false;
    }
    return this.gold >= r.goldCost && this.hasMaterials(r.materials);
  }

  public startCraftPotion(potionId: string): boolean {
    const r = POTION_RECIPE_MAP[potionId];
    if (!r || !this.canCraftPotion(potionId)) return false;

    this.gold -= r.goldCost;
    this.consumeMaterials(r.materials);
    const { successRate, durationSec } = this.getPotionCraftPreview(potionId);

    this.craftQueues.potion.push({
      uid: this.nextCraftUid++,
      shop: 'potion',
      recipeId: potionId,
      totalSec: durationSec,
      remainingSec: durationSec,
      successRate,
    });

    this.onUiUpdate();
    return true;
  }

  public isEquipmentRecipeUnlocked(equipDefId: string): boolean {
    const def = EQUIPMENT_DEF_MAP[equipDefId];
    if (!def || def.isBase) return false;
    if (
      def.reqToolId &&
      def.reqToolLevel &&
      (this.blacksmithTools[def.reqToolId] ?? 0) < def.reqToolLevel
    ) {
      return false;
    }
    if (
      def.reqFacilityId &&
      def.reqFacilityLevel &&
      (this.blacksmithTools[def.reqFacilityId] ?? 0) < def.reqFacilityLevel
    ) {
      return false;
    }
    return true;
  }

  public getEquipmentCraftPreview(equipDefId: string): {
    successRate: number;
    durationSec: number;
  } {
    const def = EQUIPMENT_DEF_MAP[equipDefId];
    if (!def) return { successRate: 0, durationSec: 10 };
    const { successAdd, speedMult } =
      this.getShopSuccessAndSpeedBonus('blacksmith');
    const successRate = Math.min(0.97, def.baseSuccessRate + successAdd * 0.65);
    const durationSec = Math.max(4, Math.round(def.craftTimeSec / speedMult));
    return { successRate, durationSec };
  }

  public canCraftEquipment(equipDefId: string): boolean {
    const def = EQUIPMENT_DEF_MAP[equipDefId];
    if (!def || def.isBase || !this.isEquipmentRecipeUnlocked(equipDefId)) {
      return false;
    }
    if (
      this.craftQueues.blacksmith.length >= this.getMaxCraftSlots('blacksmith')
    ) {
      return false;
    }
    return this.gold >= def.craftGoldCost && this.hasMaterials(def.craftMaterials);
  }

  public startCraftEquipment(equipDefId: string): boolean {
    const def = EQUIPMENT_DEF_MAP[equipDefId];
    if (!def || !this.canCraftEquipment(equipDefId)) return false;

    this.gold -= def.craftGoldCost;
    this.consumeMaterials(def.craftMaterials);
    const { successRate, durationSec } =
      this.getEquipmentCraftPreview(equipDefId);

    this.craftQueues.blacksmith.push({
      uid: this.nextCraftUid++,
      shop: 'blacksmith',
      recipeId: equipDefId,
      totalSec: durationSec,
      remainingSec: durationSec,
      successRate,
    });

    this.onUiUpdate();
    return true;
  }

  private updateCraftQueues(dt: number): void {
    // 1. 포션 제작 큐 진행 (동시 슬롯 모두 병렬 진행)
    if (this.craftQueues.potion.length > 0) {
      const remainPot: CraftQueueItem[] = [];
      for (const item of this.craftQueues.potion) {
        item.remainingSec -= dt;
        if (item.remainingSec <= 0) {
          this.resolvePotionCraft(item);
        } else {
          remainPot.push(item);
        }
      }
      this.craftQueues.potion = remainPot;
    }

    // 2. 대장간 단조 큐 진행
    if (this.craftQueues.blacksmith.length > 0) {
      const remainSmith: CraftQueueItem[] = [];
      for (const item of this.craftQueues.blacksmith) {
        item.remainingSec -= dt;
        if (item.remainingSec <= 0) {
          this.resolveEquipmentCraft(item);
        } else {
          remainSmith.push(item);
        }
      }
      this.craftQueues.blacksmith = remainSmith;
    }
  }

  private resolvePotionCraft(item: CraftQueueItem): void {
    const recipe = POTION_RECIPE_MAP[item.recipeId];
    if (!recipe) return;

    if (this.random() < item.successRate) {
      this.potionStock[recipe.id] = (this.potionStock[recipe.id] ?? 0) + 1;
      this.totalPotionsCrafted += 1;
      this.craftedByPotionId[recipe.id] =
        (this.craftedByPotionId[recipe.id] ?? 0) + 1;
      this.addLog(
        `⚗️ 포션 제작 성공! 〈${recipe.name}〉 1병이 가게 재고에 추가되었습니다.`,
        'loot'
      );
    } else {
      if (recipe.fallbackPotionId && POTION_RECIPE_MAP[recipe.fallbackPotionId]) {
        const fb = POTION_RECIPE_MAP[recipe.fallbackPotionId];
        this.potionStock[fb.id] = (this.potionStock[fb.id] ?? 0) + 1;
        this.totalPotionsCrafted += 1;
        this.craftedByPotionId[fb.id] =
          (this.craftedByPotionId[fb.id] ?? 0) + 1;
        this.addLog(
          `💨 〈${recipe.name}〉 연금 실패... 대신 하위 등급 〈${fb.name}〉 1병을 건졌습니다.`,
          'normal'
        );
      } else {
        this.addLog(
          `💨 〈${recipe.name}〉 조제에 실패하여 재료 일부가 증발했습니다.`,
          'normal'
        );
      }
    }
  }

  private resolveEquipmentCraft(item: CraftQueueItem): void {
    const def = EQUIPMENT_DEF_MAP[item.recipeId];
    if (!def) return;

    if (this.random() < item.successRate) {
      const inst: EquipmentInstance = {
        uid: this.nextEquipUid++,
        defId: def.id,
        enhanceLevel: 0,
      };
      this.equipmentStock.push(inst);
      this.totalEquipCrafted += 1;
      const prevR = this.craftedByRarity[def.rarity]?.count ?? 0;
      this.craftedByRarity[def.rarity] = {
        count: prevR + 1,
        lastItemName: def.name,
      };
      this.addLog(
        `⚒️ 장비 단조 성공! 〈${def.name}〉이(가) 대장간 진열대에 추가되었습니다.`,
        'loot'
      );
    } else {
      if (def.fallbackEquipId && EQUIPMENT_DEF_MAP[def.fallbackEquipId]) {
        const fb = EQUIPMENT_DEF_MAP[def.fallbackEquipId];
        this.equipmentStock.push({
          uid: this.nextEquipUid++,
          defId: fb.id,
          enhanceLevel: 0,
        });
        this.totalEquipCrafted += 1;
        const prevR = this.craftedByRarity[fb.rarity]?.count ?? 0;
        this.craftedByRarity[fb.rarity] = {
          count: prevR + 1,
          lastItemName: fb.name,
        };
        this.addLog(
          `火花 〈${def.name}〉 단조 실패... 대신 하위 등급 〈${fb.name}〉이(가) 완성되었습니다.`,
          'normal'
        );
      } else {
        // 일반/고급 실패 시 고철 파편 1개 회수
        this.materials['mat_iron_scrap'] =
          (this.materials['mat_iron_scrap'] ?? 0) + 1;
        this.addLog(
          `💨 〈${def.name}〉 단조에 실패하여 고철 파편 1개만 회수했습니다.`,
          'normal'
        );
      }
    }
  }

  /**
   * 플레이어가 대장간 재고 장비를 특정 영웅에게 직접 입혀 줍니다.
   */
  public equipItemToHero(heroId: string, stockEquipUid: number): boolean {
    const hero = this.heroes[heroId];
    if (!hero || !hero.unlocked) return false;
    const idx = this.equipmentStock.findIndex((e) => e.uid === stockEquipUid);
    if (idx < 0) return false;

    const inst = this.equipmentStock[idx];
    const def = EQUIPMENT_DEF_MAP[inst.defId];
    const roster = HERO_ROSTER_MAP[hero.id];
    if (!def || !canClassEquip(roster.classId, def)) return false;

    this.equipmentStock.splice(idx, 1);
    const oldInst = hero.equipment[def.slot];
    const oldDef = EQUIPMENT_DEF_MAP[oldInst.defId];
    if (oldDef && !oldDef.isBase) {
      this.equipmentStock.push(oldInst);
    }

    hero.equipment[def.slot] = inst;
    const bd = getHeroStatBreakdown(hero);
    hero.currentHp = Math.min(bd.totalStats.hp, hero.currentHp);

    this.addLog(
      `🛡️ [${roster.name}]에게 〈${def.name}${
        inst.enhanceLevel > 0 ? ` +${inst.enhanceLevel}` : ''
      }〉을(를) 장착시켰습니다!`,
      'normal'
    );
    this.onUiUpdate();
    return true;
  }

  // ==========================================================================
  // 9.4 +강화 시스템 (실패 시 장비 완전 파괴 & 기본 장비 즉시 복귀)
  // ==========================================================================

  public getTargetEquipmentForEnhance(target: {
    heroId?: string;
    slot?: EquipSlot;
    stockUid?: number;
  }): {
    inst: EquipmentInstance;
    def: (typeof EQUIPMENT_DEFS)[number];
    hasDwarfOrigin: boolean;
    heroName?: string;
  } | null {
    if (target.heroId && target.slot) {
      const hero = this.heroes[target.heroId];
      if (!hero || !hero.unlocked) return null;
      const inst = hero.equipment[target.slot];
      const def = EQUIPMENT_DEF_MAP[inst.defId];
      if (!def || def.isBase) return null; // 기본 장비는 강화/파괴 대상이 아님
      const roster = HERO_ROSTER_MAP[hero.id];
      return {
        inst,
        def,
        hasDwarfOrigin: roster.originId === 'dwarf_mountain',
        heroName: roster.name,
      };
    }
    if (target.stockUid !== undefined) {
      const inst = this.equipmentStock.find((e) => e.uid === target.stockUid);
      if (!inst) return null;
      const def = EQUIPMENT_DEF_MAP[inst.defId];
      if (!def || def.isBase) return null;
      return {
        inst,
        def,
        hasDwarfOrigin: false,
      };
    }
    return null;
  }

  public getEnhancePreview(target: {
    heroId?: string;
    slot?: EquipSlot;
    stockUid?: number;
  }): {
    canAttempt: boolean;
    itemName: string;
    currentLevel: number;
    nextLevel: number;
    successRate: number;
    goldCost: number;
    materialCosts: Record<string, number>;
    heroName?: string;
  } | null {
    const info = this.getTargetEquipmentForEnhance(target);
    if (!info) return null;
    const { inst, def, hasDwarfOrigin, heroName } = info;
    if (inst.enhanceLevel >= MAX_ENHANCE_LEVEL) return null;

    const grindstoneLv = this.blacksmithTools['smith_grindstone'] ?? 0;
    const successRate = getEnhanceSuccessRate(
      inst.enhanceLevel,
      grindstoneLv,
      hasDwarfOrigin
    );
    const { gold, materials } = getEnhanceCost(def, inst.enhanceLevel);
    const canAttempt = this.gold >= gold && this.hasMaterials(materials);

    return {
      canAttempt,
      itemName: def.name,
      currentLevel: inst.enhanceLevel,
      nextLevel: inst.enhanceLevel + 1,
      successRate,
      goldCost: gold,
      materialCosts: materials,
      heroName,
    };
  }

  /**
   * +강화를 실행합니다. 실패 시 해당 아이템(+강화 및 원본 장비)은 완전히 파괴되고,
   * 착용 중이던 영웅은 즉시 파괴 불가 기본 장비로 되돌아갑니다.
   */
  public enhanceEquipment(
    target: {
      heroId?: string;
      slot?: EquipSlot;
      stockUid?: number;
    },
    paidByHero = false
  ): EnhanceAttemptResult | null {
    const info = this.getTargetEquipmentForEnhance(target);
    if (!info) return null;
    const { inst, def, hasDwarfOrigin, heroName } = info;
    if (inst.enhanceLevel >= MAX_ENHANCE_LEVEL) return null;

    const grindstoneLv = this.blacksmithTools['smith_grindstone'] ?? 0;
    const chance = getEnhanceSuccessRate(
      inst.enhanceLevel,
      grindstoneLv,
      hasDwarfOrigin
    );
    const { gold, materials } = getEnhanceCost(def, inst.enhanceLevel);

    if (paidByHero && target.heroId) {
      const hero = this.heroes[target.heroId];
      if (!hero || hero.gold < gold || !this.hasMaterials(materials)) {
        return null;
      }
      hero.gold -= gold;
      this.addGold(gold);
      this.consumeMaterials(materials);
    } else {
      if (this.gold < gold || !this.hasMaterials(materials)) {
        return null;
      }
      this.gold -= gold;
      this.consumeMaterials(materials);
    }

    const prevLevel = inst.enhanceLevel;
    const isSuccess = this.random() < chance;

    if (isSuccess) {
      inst.enhanceLevel += 1;
      this.totalEnhanceSuccess += 1;
      this.sound.playUpgrade();

      this.addLog(
        `✨ [+강화 성공!] ${heroName ? `[${heroName}]의 ` : ''}〈${
          def.name
        }〉 +${prevLevel} → +${inst.enhanceLevel} 달성! (확률 ${(
          chance * 100
        ).toFixed(1)}%)`,
        'unlock'
      );
      this.onUiUpdate();
      return {
        success: true,
        destroyed: false,
        itemName: def.name,
        prevLevel,
        newLevel: inst.enhanceLevel,
        chanceUsed: chance,
        heroName,
      };
    } else {
      // 실패 시 완전 파괴!
      this.totalEnhanceDestroyed += 1;

      if (target.heroId && target.slot) {
        const hero = this.heroes[target.heroId];
        const roster = HERO_ROSTER_MAP[hero.id];
        hero.equipment[target.slot] = this.createBaseEquipForClass(
          roster.classId,
          target.slot
        );
        const fallbackDef =
          EQUIPMENT_DEF_MAP[hero.equipment[target.slot].defId];
        this.addLog(
          `💥 [+강화 실패 · 장비 파괴!] [${roster.name}]의 〈${def.name} +${prevLevel}〉이(가) 산산조각 났습니다! (${fallbackDef.name}(으)로 즉시 대체되어 탐험은 계속 가능합니다)`,
          'event'
        );
      } else if (target.stockUid !== undefined) {
        this.equipmentStock = this.equipmentStock.filter(
          (e) => e.uid !== target.stockUid
        );
        this.addLog(
          `💥 [+강화 실패 · 장비 파괴!] 대장간 재고 〈${def.name} +${prevLevel}〉이(가) 강화 실패로 완전히 파괴되었습니다!`,
          'event'
        );
      }

      this.onUiUpdate();
      return {
        success: false,
        destroyed: true,
        itemName: def.name,
        prevLevel,
        newLevel: 0,
        chanceUsed: chance,
        heroName,
      };
    }
  }

  // ==========================================================================
  // 메인 프레임 업데이트 루프
  // ==========================================================================

  public update(dt: number): void {
    const clampedDt = Math.min(2.0, Math.max(0, dt));
    this.elapsedTime += clampedDt;

    // 1. 초당 자동 골드 수입 (GPS)
    const gps = this.getGoldPerSecond();
    if (gps > 0) {
      this.addGold(gps * clampedDt);
    }

    // 2. 활성 랜덤 이벤트 타이머
    if (this.activeEvent) {
      this.activeEvent.remainingSec -= clampedDt;
      if (this.activeEvent.remainingSec <= 0) {
        this.addLog(
          `[${this.activeEvent.def.title}] 이벤트가 마무리되었습니다.`,
          'normal'
        );
        this.activeEvent = null;
        this.onUiUpdate();
      }
    } else {
      this.autoEventTimer -= clampedDt;
      if (this.autoEventTimer <= 0) {
        this.autoEventTimer = 48 + this.random() * 20;
        this.triggerRandomEvent();
      }
    }

    if (this.eventCooldownSec > 0) {
      this.eventCooldownSec = Math.max(0, this.eventCooldownSec - clampedDt);
    }

    if (this.innkeeperWaveTimer > 0) {
      this.innkeeperWaveTimer = Math.max(0, this.innkeeperWaveTimer - clampedDt);
    }

    // 3. 손님 입장 스폰 타이머
    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      if (this.guests.length < this.getMaxGuests()) {
        this.spawnGuest();
      }
      this.spawnTimer = this.getNextSpawnDelay();
    }

    // 4. 직원 자동 서빙 타이머
    const waitingGuests = this.guests.filter((g) => g.state === 'waiting');
    if (waitingGuests.length > 0) {
      this.autoServeTimer += clampedDt;
      const interval = this.getAutoServeInterval();
      if (this.autoServeTimer >= interval) {
        this.autoServeTimer = 0;
        this.serveGuest(waitingGuests[0], false);
      }
    } else {
      this.autoServeTimer = 0;
    }

    // 5. 메이드 이동 애니메이션
    this.updateMaidMovement(clampedDt, waitingGuests[0]);

    // 6. 손님 상태 머신 업데이트
    this.updateGuests(clampedDt);

    // 7. 포션 제작 큐 · 대장간 단조 큐 · 던전 탐험 · 영웅 휴식/안전 매각 업데이트
    this.updateCraftQueues(clampedDt);
    this.updateExpeditions(clampedDt);
    this.updateHeroesRestAndLootAge(clampedDt);

    // 8. 약초 정원 자동 수확
    const gardenLv = this.potionTools['pot_fac_garden'] ?? 0;
    if (gardenLv > 0) {
      this.gardenTimer += clampedDt;
      const harvestInterval = Math.max(10, 26 - gardenLv * 2);
      if (this.gardenTimer >= harvestInterval) {
        this.gardenTimer = 0;
        this.materials['mat_herb_leaf'] =
          (this.materials['mat_herb_leaf'] ?? 0) + 1;
        if (gardenLv >= 3 && this.random() < 0.45) {
          this.materials['mat_shadow_herb'] =
            (this.materials['mat_shadow_herb'] ?? 0) + 1;
        }
      }
    }

    // 9. 2초마다 대기 영웅 자율 소비(음식·포션·장비 구매) 및 자동 매입/자동 파견 체크
    this.heroAiTimer += clampedDt;
    if (this.heroAiTimer >= 2.0) {
      this.heroAiTimer = 0;
      if (this.autoBuyLoot) {
        this.buyAllHeroLoot(15);
      }
      for (const h of this.getUnlockedHeroes()) {
        if (h.status === 'idle' && !h.expeditionId) {
          this.heroAutoPrepareForExpedition(h);
        }
      }
      if (this.autoDispatch) {
        this.tryAutoDispatch();
      }
    }

    // 10. 파티클 & 플로팅 텍스트 업데이트
    this.updateParticlesAndTexts(clampedDt);

    // 11. 5초마다 자동 저장
    this.saveTimer += clampedDt;
    if (this.saveTimer >= 5.0) {
      this.saveTimer = 0;
      this.saveToStorage();
    }
  }

  /**
   * 자동 파견(또는 시뮬레이션 AI 보조): 가용 영웅으로 성공률 60% 이상인 최고 티어 해금 던전에 파견
   */
  public tryAutoDispatch(): boolean {
    if (this.expeditions.length >= this.getMaxConcurrentExpeditions()) {
      return false;
    }
    const unlockedDungeons = DUNGEONS.filter((d) =>
      this.isDungeonUnlocked(d.id)
    );
    if (unlockedDungeons.length === 0) return false;

    const maxParty = this.getMaxPartySize();
    const idleHeroes = this.getUnlockedHeroes().filter(
      (h) => h.status === 'idle' && !h.expeditionId
    );
    if (idleHeroes.length === 0) return false;

    for (let i = unlockedDungeons.length - 1; i >= 0; i--) {
      const d = unlockedDungeons[i];
      const party = selectBestPartyForDungeon(idleHeroes, d, maxParty);
      if (party.length === 0) continue;
      const ev = evaluatePartyForDungeon(party, d);
      if (ev.finalSuccessRate >= 0.62 || i === 0) {
        return this.dispatchParty(
          d.id,
          party.map((p) => p.id)
        );
      }
    }
    return false;
  }

  private getNextSpawnDelay(): number {
    let rateBonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.spawnRateBonus) {
        rateBonus += lv * u.spawnRateBonus;
      }
    }
    let delay = 3.2 / (1 + rateBonus * 0.45);
    if (this.activeEvent) {
      delay /= this.activeEvent.def.spawnMult;
    }
    return Math.max(0.75, delay + (this.random() * 0.6 - 0.3));
  }

  private updateMaidMovement(dt: number, targetGuest?: GuestEntity): void {
    if ((this.upgrades['staff_maid'] ?? 0) <= 0) return;

    const destX = targetGuest ? targetGuest.x - 10 : 155;
    const destY = targetGuest ? targetGuest.y + 2 : 92;

    const dx = destX - this.maidPos.x;
    const dy = destY - this.maidPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 2) {
      const speed = 52;
      this.maidPos.x += (dx / dist) * speed * dt;
      this.maidPos.y += (dy / dist) * speed * dt;
      this.maidPos.facing = dx >= 0 ? 'right' : 'left';
    }
  }

  private updateGuests(dt: number): void {
    const walkSpeed = 72;
    const remaining: GuestEntity[] = [];

    for (const g of this.guests) {
      g.animTime += dt;
      if (g.quoteTimer > 0) {
        g.quoteTimer = Math.max(0, g.quoteTimer - dt);
      }

      if (g.state === 'entering') {
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 2) {
          g.x = g.targetX;
          g.y = g.targetY;
          const seat = SEAT_SLOTS.find((s) => s.id === g.seatId);
          g.facing = seat ? seat.facing : 'right';
          g.state = 'waiting';
          g.stateTimer = 0;
        } else {
          g.x += (dx / dist) * walkSpeed * dt;
          g.y += (dy / dist) * walkSpeed * dt;
          g.facing = dx >= 0 ? 'right' : 'left';
        }
        remaining.push(g);
      } else if (g.state === 'waiting') {
        g.stateTimer += dt;
        remaining.push(g);
      } else if (g.state === 'enjoying') {
        g.stateTimer += dt;
        if (g.stateTimer >= g.maxWaitTime) {
          g.state = 'leaving';
          g.targetX = 8;
          g.targetY = 122;
          g.facing = 'left';
        }
        remaining.push(g);
      } else if (g.state === 'leaving') {
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 3) {
          g.x += (dx / dist) * walkSpeed * dt;
          g.y += (dy / dist) * walkSpeed * dt;
          g.facing = 'left';
          remaining.push(g);
        }
      }
    }

    this.guests = remaining;
  }

  private updateParticlesAndTexts(dt: number): void {
    this.floatingTexts = this.floatingTexts.filter((ft) => {
      ft.y += ft.vy * dt;
      ft.life -= dt;
      return ft.life > 0;
    });

    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 110 * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }

  public spawnGuest(): void {
    const occupiedSeatIds = new Set(this.guests.map((g) => g.seatId));
    const availableSeats = SEAT_SLOTS.filter((s) => {
      if (occupiedSeatIds.has(s.id)) return false;
      if (s.type === 'smithy' && (this.upgrades['fac_smithy'] ?? 0) <= 0) {
        return false;
      }
      if (
        s.type === 'room' &&
        (this.upgrades['room_straw'] ?? 0) + (this.upgrades['room_oak'] ?? 0) <=
          0
      ) {
        return false;
      }
      return true;
    });

    if (availableSeats.length === 0) return;

    const unlockedGuests = GUEST_TYPES.filter(
      (g) => this.reputation >= g.unlockRep
    );
    const boardLv = this.upgrades['fac_board'] ?? 0;
    const weights = unlockedGuests.map((_, idx) => {
      return 1 + idx * (0.35 + boardLv * 0.12);
    });
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let r = this.random() * totalWeight;
    let chosenDef = unlockedGuests[0];
    for (let i = 0; i < unlockedGuests.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        chosenDef = unlockedGuests[i];
        break;
      }
    }

    const isFirstGuest = this.guests.length === 0;
    const seat: SeatSlot = isFirstGuest
      ? availableSeats[0]
      : availableSeats[Math.floor(this.random() * availableSeats.length)];

    let orderType: OrderType = 'stew';
    if (seat.type === 'smithy') {
      orderType = 'repair';
    } else if (seat.type === 'room') {
      orderType = 'sleep';
    } else {
      const availOrders = chosenDef.preferredOrders.filter((ord) => {
        if (ord === 'ale' && (this.upgrades['menu_ale'] ?? 0) <= 0) return false;
        if (ord === 'potion' && (this.upgrades['menu_potion'] ?? 0) <= 0)
          return false;
        if (ord === 'repair' && (this.upgrades['fac_smithy'] ?? 0) <= 0)
          return false;
        return true;
      });
      orderType =
        availOrders.length > 0
          ? availOrders[Math.floor(this.random() * availOrders.length)]
          : 'stew';
    }

    const guest: GuestEntity = {
      uid: this.nextGuestUid++,
      typeId: chosenDef.id,
      state: 'entering',
      x: isFirstGuest ? 34 : 12,
      y: isFirstGuest ? 110 : 120 + (this.random() * 8 - 4),
      targetX: seat.x,
      targetY: seat.y,
      facing: 'right',
      seatId: seat.id,
      seatType: seat.type,
      orderType,
      stateTimer: 0,
      maxWaitTime: 3.8 + this.random() * 1.8,
      animTime: this.random() * 10,
      quoteText: null,
      quoteTimer: 0,
      isSleeping: orderType === 'sleep',
    };

    this.guests.push(guest);
    this.discoveredGuests[chosenDef.id] =
      (this.discoveredGuests[chosenDef.id] ?? 0) + 1;
  }

  public serveGuest(guest: GuestEntity, isManualClick: boolean): void {
    if (guest.state !== 'waiting') return;

    const def =
      GUEST_TYPES.find((g) => g.id === guest.typeId) ?? GUEST_TYPES[0];
    const earnedGold = this.getGuestServeGold(def, isManualClick);
    const earnedRep = this.getServeReputationGain(def);

    this.addGold(earnedGold);
    this.addReputation(earnedRep);
    this.totalServed += 1;

    guest.state = 'enjoying';
    guest.stateTimer = 0;
    guest.isSleeping =
      guest.orderType === 'sleep' ||
      (guest.orderType === 'stew' && this.random() < 0.35);

    const quotePool = guest.isSleeping ? def.sleepQuotes : def.quotes;
    const chosenQuote =
      quotePool[Math.floor(this.random() * quotePool.length)];
    guest.quoteText = chosenQuote;
    guest.quoteTimer = 3.0;

    this.spawnCoins(guest.x, guest.y - 12, isManualClick ? 7 : 4);
    this.spawnFloatingText(
      guest.x - 12,
      guest.y - 22,
      `+${formatGold(earnedGold)}G`,
      '#ffd166'
    );

    const lootChance = Math.min(
      0.75,
      def.lootChance + this.getExtraLootChance()
    );
    if (this.random() < lootChance) {
      const hotSpringLv = this.upgrades['fac_hotspring'] ?? 0;
      const lootGold = Math.max(
        5,
        Math.floor(
          earnedGold *
            (0.65 + (def.lootGoldMultiplier - 1) * 0.35 + hotSpringLv * 0.1)
        )
      );
      this.addGold(lootGold);
      this.totalLootFound += 1;
      this.sound.playLoot();

      this.spawnFloatingText(
        guest.x - 18,
        guest.y - 33,
        `★${def.lootName} +${formatGold(lootGold)}G`,
        '#ff922b'
      );
      this.addLog(
        `🎁 [${def.name}] 손님이 던전 전리품 〈${def.lootName}〉을(를) 팁으로 남겼습니다! (+${formatGold(
          lootGold
        )}G)`,
        'loot'
      );
    } else {
      if (isManualClick) {
        this.sound.playCoin();
      }
      if (this.random() < 0.35 || this.logs.length < 3) {
        this.addLog(
          `${def.name}: "${chosenQuote}" (+${formatGold(earnedGold)}G)`,
          'normal'
        );
      }
    }

    if (isManualClick) {
      this.innkeeperWaveTimer = 0.4;
    }

    this.onUiUpdate();
  }

  public handleCanvasTap(canvasX: number, canvasY: number): void {
    let closestWaiting: GuestEntity | null = null;
    let minWaitDist = 30;

    for (const g of this.guests) {
      if (g.state === 'waiting') {
        const dist = Math.hypot(g.x - canvasX, g.y - 10 - canvasY);
        if (dist < minWaitDist) {
          minWaitDist = dist;
          closestWaiting = g;
        }
      }
    }

    if (closestWaiting) {
      this.serveGuest(closestWaiting, true);
      return;
    }

    const anyWaiting = this.guests.find((g) => g.state === 'waiting');
    if (anyWaiting) {
      this.serveGuest(anyWaiting, true);
      return;
    }

    const tipGold = Math.max(2, Math.floor(this.getClickServeBonus() * 0.35));
    this.addGold(tipGold);
    this.sound.playCoin();
    this.innkeeperWaveTimer = 0.35;
    this.spawnTimer = Math.max(0.1, this.spawnTimer - 0.45);

    this.spawnCoins(canvasX, canvasY, 4);
    this.spawnFloatingText(
      Math.max(8, Math.min(CANVAS_WIDTH - 48, canvasX - 12)),
      Math.max(14, canvasY - 6),
      `+${formatGold(tipGold)}G`,
      '#fde047'
    );
    this.onUiUpdate();
  }

  public serveAllOrSolicit(): void {
    const waiting = this.guests.filter((g) => g.state === 'waiting');
    if (waiting.length > 0) {
      for (const g of waiting) {
        this.serveGuest(g, true);
      }
      return;
    }

    const tipGold = Math.max(3, Math.floor(this.getClickServeBonus() * 0.45));
    this.addGold(tipGold);
    this.sound.playCoin();
    this.innkeeperWaveTimer = 0.4;
    if (this.guests.length < this.getMaxGuests()) {
      this.spawnGuest();
    }
    this.spawnCoins(180, 56, 5);
    this.spawnFloatingText(
      164,
      42,
      `+${formatGold(tipGold)}G 호객!`,
      '#fde047'
    );
    this.onUiUpdate();
  }

  public triggerRandomEvent(manual = false): boolean {
    if (manual && (this.activeEvent || this.eventCooldownSec > 0)) {
      return false;
    }

    const def: RandomEventDef =
      RANDOM_EVENTS[Math.floor(this.random() * RANDOM_EVENTS.length)];
    this.activeEvent = {
      def,
      remainingSec: def.durationSec,
    };
    this.eventCooldownSec = 30;
    this.sound.playEvent();

    let extraMsg = '';
    if (def.instantGoldFactor) {
      const bonusGold = Math.max(
        15,
        Math.floor(
          (this.getClickServeBonus() + this.getGoldPerSecond() * 2) *
            def.instantGoldFactor
        )
      );
      this.addGold(bonusGold);
      this.spawnCoins(CANVAS_WIDTH / 2, 70, 10);
      this.spawnFloatingText(
        CANVAS_WIDTH / 2 - 28,
        62,
        `+${formatGold(bonusGold)}G 보너스!`,
        '#ffd166'
      );
      extraMsg += ` (+${formatGold(bonusGold)} 골드)`;
    }
    if (def.instantRep) {
      this.addReputation(def.instantRep);
      extraMsg += ` (평판 +${def.instantRep})`;
    }

    if (this.guests.length < this.getMaxGuests()) {
      this.spawnGuest();
    }

    this.addLog(`${def.title} — ${def.description}${extraMsg}`, 'event');
    this.onUiUpdate();
    return true;
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string
  ): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -18,
      text,
      color,
      life: 1.15,
      maxLife: 1.15,
    });
  }

  public spawnCoins(x: number, y: number, count: number): void {
    const colors = ['#ffd166', '#fcbf49', '#f77f00', '#fef08a'];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (this.random() - 0.5) * 1.8;
      const speed = 28 + this.random() * 36;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        color: colors[i % colors.length],
        size: i % 2 === 0 ? 3 : 2,
        life: 0.55 + this.random() * 0.25,
        maxLife: 0.8,
      });
    }
  }

  public addLog(text: string, type: LogEntry['type']): void {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    this.logs.unshift({
      id: this.nextLogId++,
      timeText: `${hh}:${mm}:${ss}`,
      text,
      type,
    });
    if (this.logs.length > 24) {
      this.logs.length = 24;
    }
  }

  public getNextGoalDescription(): string {
    const nextLv = getNextInnLevel(this.reputation);
    if (nextLv) {
      const remain = Math.max(0, nextLv.requiredRep - this.reputation);
      return `다음 목표: 평판 ${formatGold(
        nextLv.requiredRep
      )} 달성 시 [${nextLv.title}] 승급 (${
        nextLv.rewardText
      }) — 남은 평판 ${formatGold(remain)}`;
    }
    return '최고 등급 [Lv.10 전설의 던전 여관] 달성! 모든 모험가와 용왕의 안식처입니다.';
  }

  public getRenderState(): RenderContextState {
    // 여관에 머물거나 탐험 중인 대표 영웅 최대 5명을 캔버스에 표시
    const unlocked = this.getUnlockedHeroes().slice(0, 5);
    const heroSpots = [
      { x: 112, y: 126, facing: 'right' as const },
      { x: 142, y: 128, facing: 'left' as const },
      { x: 220, y: 118, facing: 'right' as const },
      { x: 244, y: 158, facing: 'left' as const },
      { x: 38, y: 140, facing: 'right' as const },
    ];
    const heroEntities: HeroCanvasEntity[] = unlocked.map((h, idx) => {
      const roster = HERO_ROSTER_MAP[h.id];
      const spot = heroSpots[idx % heroSpots.length];
      // 탐험 중인 영웅은 창문 아래 던전 출입구 쪽으로 이동한 연출
      const isExp = h.status === 'exploring';
      return {
        heroId: h.id,
        name: roster.name,
        status: h.status,
        x: isExp ? 142 + (idx % 3) * 14 : spot.x,
        y: isExp ? 78 : spot.y,
        facing: isExp ? 'right' : spot.facing,
      };
    });

    return {
      time: this.elapsedTime,
      guests: this.guests,
      floatingTexts: this.floatingTexts,
      particles: this.particles,
      upgrades: this.upgrades,
      potionTools: this.potionTools,
      blacksmithTools: this.blacksmithTools,
      heroEntities,
      activeEvent: this.activeEvent,
      maidPos: this.maidPos,
      innkeeperWaveTimer: this.innkeeperWaveTimer,
    };
  }
}
