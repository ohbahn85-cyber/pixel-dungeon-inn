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
  MAP_WIDTH,
  SpeechSituation,
  ZONE_LABELS,
  ZONE_SPOTS,
  createFloorMonsters,
  detectZoneAtPixel,
  findGridPath,
  generateHeroSpeech,
  getDungeonTotalFloors,
  pixelToTile,
  tileToPixel,
} from './innMap';
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
  ExpeditionFloorLog,
  ExpeditionResultSummary,
  FloatingText,
  GuestEntity,
  GuestTypeDef,
  HeroBuff,
  HeroPlayerOrder,
  HeroState,
  InnZoneId,
  LogEntry,
  OrderType,
  RandomEventDef,
  SaveData,
  SeatSlot,
  ShopMarketConfig,
  ShopToolDef,
} from './types';

export const SAVE_STORAGE_KEY = 'pixel_dungeon_inn_save_v1';
export const CURRENT_SAVE_VERSION = 3;
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
  heroShopTransactions: number;
  heroesHealedCount: number;
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

  // 순환 경제 & 살아있는 여관 상태
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

  public autoBuyLoot = true;
  public autoDispatch = true;
  public shopConfig!: ShopMarketConfig;

  public selectedHeroId: string | null = 'hero_garrick';
  public focusedExpeditionId: string | null = null;

  public totalPotionsCrafted = 0;
  public totalEquipCrafted = 0;
  public totalEnhanceSuccess = 0;
  public totalEnhanceDestroyed = 0;
  public totalPeddlerSales = 0;
  public totalHeroShopTransactions = 0;
  public totalHeroesHealed = 0;
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
  private nextFloorLogId = 1;
  private spawnTimer = 0.6;
  private autoServeTimer = 0;
  private autoEventTimer = 38;
  private saveTimer = 0;
  private heroAiTimer = 0;
  private agentDecisionTimer = 0;
  private agentDecisionCursor = 0;
  private boardDispatchTimer = 0;
  private gardenTimer = 0;
  private lastMemorySaveAt = 0;
  private innkeeperWaveTimer = 0;
  private maidPos: { x: number; y: number; facing: 'left' | 'right' } = {
    x: 112,
    y: 150,
    facing: 'left',
  };

  private onUiUpdate: () => void;
  private onLevelUp: (newLevelTitle: string, rewardText: string) => void;
  private onZoneTapped?: (
    zone: 'potion' | 'blacksmith' | 'trade' | 'dungeon' | 'menu' | 'room'
  ) => void;

  constructor(
    onUiUpdate: () => void = () => {},
    onLevelUp: (newLevelTitle: string, rewardText: string) => void = () => {},
    customStorage?: StorageAdapter,
    onZoneTapped?: (
      zone: 'potion' | 'blacksmith' | 'trade' | 'dungeon' | 'menu' | 'room'
    ) => void
  ) {
    this.sound = new SoundManager(false);
    this.onUiUpdate = onUiUpdate;
    this.onLevelUp = onLevelUp;
    this.onZoneTapped = onZoneTapped;
    this.storage = customStorage ?? getDefaultStorageAdapter();

    this.initFreshState();
  }

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

  private createDefaultShopConfig(): ShopMarketConfig {
    const potionSaleEnabled: Record<string, boolean> = {};
    for (const pr of POTION_RECIPES) {
      potionSaleEnabled[pr.id] = true;
    }
    const lootBuyEnabled: Record<string, boolean> = {};
    for (const m of MATERIALS) {
      lootBuyEnabled[m.id] = true;
    }
    return {
      mealSaleEnabled: true,
      mealPriceMultiplier: 1.0,
      potionSaleEnabled,
      potionPriceMultiplier: 1.0,
      lootBuyEnabled,
      lootBuyRatePct: 100,
      lootReserveGold: 15,
      blacksmithSaleEnabled: true,
      blacksmithPriceMultiplier: 1.0,
      blacksmithAutoEnhanceEnabled: false,
    };
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
    this.autoBuyLoot = true;
    this.autoDispatch = true;
    this.shopConfig = this.createDefaultShopConfig();
    this.selectedHeroId = 'hero_garrick';
    this.focusedExpeditionId = null;

    this.totalPotionsCrafted = 0;
    this.totalEquipCrafted = 0;
    this.totalEnhanceSuccess = 0;
    this.totalEnhanceDestroyed = 0;
    this.totalPeddlerSales = 0;
    this.totalHeroShopTransactions = 0;
    this.totalHeroesHealed = 0;
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
    const hallSpots = ZONE_SPOTS.hall;
    const boardSpots = ZONE_SPOTS.board;

    HERO_ROSTER.forEach((def, idx) => {
      const cls = HERO_CLASSES[def.classId];
      const isStarter = Boolean(def.unlock.isStarter);
      const equip: Record<EquipSlot, EquipmentInstance> = {
        weapon: this.createBaseEquipForClass(def.classId, 'weapon'),
        armor: this.createBaseEquipForClass(def.classId, 'armor'),
        offhand: this.createBaseEquipForClass(def.classId, 'offhand'),
        accessory: this.createBaseEquipForClass(def.classId, 'accessory'),
      };
      const spot = isStarter
        ? boardSpots[idx % boardSpots.length]
        : hallSpots[idx % hallSpots.length];
      const px = tileToPixel(spot.col, spot.row);

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
        hunger: isStarter ? 35 + (idx % 3) * 10 : 25,
        fatigue: 10,
        morale: 80,
        tileX: spot.col,
        tileY: spot.row,
        x: px.x,
        y: px.y,
        facing: spot.facing,
        path: [],
        targetTileX: spot.col,
        targetTileY: spot.row,
        targetZone: isStarter ? 'board' : 'hall',
        activity: 'idle',
        activityTimer: 0,
        intentText: '의뢰 게시판 근처에서 대기 중',
        partyId: null,
        rallyDungeonId: null,
        playerOrder: null,
        speechText: isStarter && idx === 0 ? def.joinQuote.slice(0, 18) : null,
        speechTimer: isStarter && idx === 0 ? 3.5 : 0,
        speechCooldown: idx * 1.5,
        interactionEffect: null,
      };
    });
  }

  private ensureHeroAgentFields(hero: HeroState, idx = 0): void {
    const spots = ZONE_SPOTS.hall;
    const fallbackSpot = spots[idx % spots.length];
    if (typeof hero.hunger !== 'number' || !Number.isFinite(hero.hunger)) {
      hero.hunger = 25;
    }
    if (typeof hero.fatigue !== 'number' || !Number.isFinite(hero.fatigue)) {
      hero.fatigue = hero.status === 'fatigued' ? 75 : hero.status === 'injured' ? 85 : 12;
    }
    if (typeof hero.morale !== 'number' || !Number.isFinite(hero.morale)) {
      hero.morale = 80;
    }
    if (typeof hero.tileX !== 'number' || typeof hero.tileY !== 'number') {
      hero.tileX = fallbackSpot.col;
      hero.tileY = fallbackSpot.row;
    }
    const px = tileToPixel(hero.tileX, hero.tileY);
    if (typeof hero.x !== 'number' || !Number.isFinite(hero.x)) hero.x = px.x;
    if (typeof hero.y !== 'number' || !Number.isFinite(hero.y)) hero.y = px.y;
    if (!hero.facing) hero.facing = fallbackSpot.facing;
    if (!Array.isArray(hero.path)) hero.path = [];
    if (!hero.targetZone) hero.targetZone = 'hall';
    if (!hero.activity) {
      hero.activity = hero.status === 'exploring' ? 'exploring' : 'idle';
    }
    if (typeof hero.activityTimer !== 'number') hero.activityTimer = 0;
    if (!hero.intentText) {
      hero.intentText =
        hero.status === 'exploring' ? '던전 원정 탐험 중' : '여관 홀에서 대기 중';
    }
    if (hero.playerOrder === undefined) hero.playerOrder = null;
    if (hero.speechText === undefined) hero.speechText = null;
    if (typeof hero.speechTimer !== 'number') hero.speechTimer = 0;
    if (typeof hero.speechCooldown !== 'number') hero.speechCooldown = 0;
    if (hero.interactionEffect === undefined) hero.interactionEffect = null;
  }

  // ==========================================================================
  // 상점·거래소 가격 및 매입 설정 헬퍼
  // ==========================================================================

  public getEffectiveMaterialBuyPrice(materialId: string): number {
    const mat = MATERIAL_MAP[materialId];
    if (!mat) return 1;
    const rate = (this.shopConfig?.lootBuyRatePct ?? 100) / 100;
    return Math.max(1, Math.round(mat.buyPrice * rate));
  }

  public getEffectivePotionSellPrice(potionId: string): number {
    const rec = POTION_RECIPE_MAP[potionId];
    if (!rec) return 10;
    const mult = this.shopConfig?.potionPriceMultiplier ?? 1.0;
    return Math.max(2, Math.round(rec.sellPriceToHero * mult));
  }

  public getEffectiveMealPrice(mealUpgradeId: string): number {
    const base = this.getMealEffectiveBuff(mealUpgradeId).price;
    const mult = this.shopConfig?.mealPriceMultiplier ?? 1.0;
    return Math.max(2, Math.round(base * mult));
  }

  public getEffectiveEquipSellPrice(equipDefId: string): number {
    const def = EQUIPMENT_DEF_MAP[equipDefId];
    if (!def) return 20;
    const mult = this.shopConfig?.blacksmithPriceMultiplier ?? 1.0;
    return Math.max(5, Math.round(def.buyPriceGold * mult));
  }

  public triggerHeroSpeech(
    hero: HeroState,
    situation: SpeechSituation,
    force = false,
    extraLabel?: string
  ): void {
    if (!hero.unlocked) return;
    if (!force && (hero.speechCooldown ?? 0) > 0) return;
    const roster = HERO_ROSTER_MAP[hero.id];
    if (!roster) return;
    hero.speechText = generateHeroSpeech(
      situation,
      roster.personalities,
      () => this.random(),
      extraLabel
    );
    hero.speechTimer = 3.2;
    hero.speechCooldown = force ? 2.0 : 5.5 + this.random() * 3.5;
  }

  public setHeroInteractionEffect(
    hero: HeroState,
    icon: string,
    text: string,
    color = '#ebd186'
  ): void {
    hero.interactionEffect = {
      icon,
      text,
      color,
      timer: 1.4,
    };
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
        this.ensureHeroAgentFields(state, this.getUnlockedHeroCount());
        const bd = getHeroStatBreakdown(state);
        state.currentHp = bd.totalStats.hp;
        state.gold = Math.max(state.gold, 25 + this.getUnlockedHeroCount() * 8);
        // 여관 입구에서 걸어 들어오게 배치
        const entryPx = tileToPixel(2, 11);
        state.tileX = 2;
        state.tileY = 11;
        state.x = entryPx.x;
        state.y = entryPx.y;
        this.sendHeroToZone(state, 'board', '여관 합류! 의뢰 게시판으로 이동 중');
        this.triggerHeroSpeech(state, 'pre_dungeon', true);

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
          '#7eb38a'
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
   * 저장 데이터를 불러오고 v1/v2 → v3 마이그레이션 및 오프라인 정산 결과를 반환합니다.
   */
  public loadFromStorage(): OfflineReport | null {
    try {
      const raw = this.storage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        this.addLog(
          '던전 입구 옆 여관의 문을 열었습니다! 시작 파티 4명(가릭·엘레나·카엘·아린)이 여관 안에서 움직이기 시작합니다.',
          'normal'
        );
        this.spawnGuest();
        return null;
      }

      const data = JSON.parse(raw) as Partial<SaveData>;
      const isLegacy =
        !data.version || data.version < CURRENT_SAVE_VERSION || !data.heroes;

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

      if (data.materials && typeof data.materials === 'object') {
        for (const m of MATERIALS) {
          this.materials[m.id] = Math.max(
            0,
            Math.floor(data.materials[m.id] ?? 0)
          );
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
        for (const exp of this.expeditions) {
          this.ensureExpeditionFloorFields(exp);
        }
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
      if (data.shopConfig && typeof data.shopConfig === 'object') {
        const defCfg = this.createDefaultShopConfig();
        this.shopConfig = {
          ...defCfg,
          ...data.shopConfig,
          potionSaleEnabled: {
            ...defCfg.potionSaleEnabled,
            ...(data.shopConfig.potionSaleEnabled ?? {}),
          },
          lootBuyEnabled: {
            ...defCfg.lootBuyEnabled,
            ...(data.shopConfig.lootBuyEnabled ?? {}),
          },
        };
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
        HERO_ROSTER.forEach((def, idx) => {
          const savedHero = data.heroes?.[def.id];
          if (savedHero) {
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
            this.ensureHeroAgentFields(this.heroes[def.id], idx);
          }
        });
      }

      if (isLegacy) {
        this.migratedFromV1 = true;
        this.gold = Math.max(35, this.gold);
        this.autoDispatch = true;
        this.autoBuyLoot = true;
        this.checkHeroUnlocks();
        this.saveToStorage();
        this.addLog(
          '🔄 기존 세이브 데이터를 v3 살아있는 여관 & 층별 던전 탐험 시스템으로 안전하게 이전했습니다!',
          'unlock'
        );
      } else {
        this.checkHeroUnlocks();
      }

      for (const g of GUEST_TYPES) {
        if (this.reputation >= g.unlockRep && !this.discoveredGuests[g.id]) {
          this.discoveredGuests[g.id] = 1;
        }
      }

      this.spawnGuest();

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

      this.addLog(
        '여관 장부를 불러왔습니다. 영웅들이 여관 각 구역을 오가며 다음 원정을 준비합니다!',
        'normal'
      );
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
    const earnedGold = Math.floor(cappedSec * gps * offlineEfficiency);
    if (earnedGold > 0) {
      this.addGold(earnedGold);
    }

    const beforePotions = this.totalPotionsCrafted;
    const beforeEquips = this.totalEquipCrafted;
    const beforePeddler = this.totalPeddlerSales;
    const beforeShopTx = this.totalHeroShopTransactions;
    const beforeHealed = this.totalHeroesHealed;
    let expeditionsCompleted = 0;

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
      if (
        this.autoDispatch &&
        expeditionsCompleted < 25 &&
        this.expeditions.length === 0
      ) {
        this.tryAutoDispatch();
      }
    }

    const extraLoopGold = Math.max(0, Math.floor(this.gold - prevGold));
    const totalOfflineGold = earnedGold + extraLoopGold;
    const injuredCount = this.getUnlockedHeroes().filter(
      (h) => h.status === 'injured'
    ).length;
    const heroShopTransactions = Math.max(
      0,
      this.totalHeroShopTransactions - beforeShopTx
    );
    const heroesHealedCount = Math.max(0, this.totalHeroesHealed - beforeHealed);

    if (totalOfflineGold > 0 || expeditionsCompleted > 0) {
      this.addLog(
        `🌙 오프라인 정산: +${formatGold(
          totalOfflineGold
        )}G, 탐험 완료 ${expeditionsCompleted}회, 상점 거래 ${heroShopTransactions}건!`,
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
      heroShopTransactions,
      heroesHealedCount,
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
        shopConfig: this.shopConfig,
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
  // 기본 여관 골드 · 평판 · 업그레이드
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

    if (mult > 2.2) {
      mult = 2.2 + Math.sqrt(mult - 2.2) * 0.4;
    }

    if (this.activeEvent) {
      mult *= Math.min(1.4, this.activeEvent.def.goldMult);
    }
    return mult;
  }

  public getGoldPerSecond(): number {
    let baseGps = 0.8;
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
        '#ebd186'
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
      '#7eb38a'
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
  // 영웅 타일 그리드 경로탐색 · 욕구 기반 자율 AI · 플레이어 행동 지시
  // ==========================================================================

  private pickSpotInZone(
    zone: InnZoneId,
    hero: HeroState
  ): { col: number; row: number; facing: 'left' | 'right' } {
    const spots = ZONE_SPOTS[zone] ?? ZONE_SPOTS.hall;
    // 다른 영웅이 점유하지 않은 좌석 우선 선택
    const occupied = new Set<string>();
    for (const other of this.getUnlockedHeroes()) {
      if (other.id === hero.id || other.status === 'exploring') continue;
      occupied.add(`${other.targetTileX ?? other.tileX},${other.targetTileY ?? other.tileY}`);
    }
    for (const s of spots) {
      if (!occupied.has(`${s.col},${s.row}`)) {
        return s;
      }
    }
    const hash = hero.id.charCodeAt(hero.id.length - 1) % spots.length;
    return spots[hash];
  }

  public sendHeroToZone(
    hero: HeroState,
    zone: InnZoneId,
    intentText: string
  ): void {
    this.ensureHeroAgentFields(hero);
    const curTile = pixelToTile(hero.x!, hero.y!);
    hero.tileX = curTile.col;
    hero.tileY = curTile.row;

    const spot = this.pickSpotInZone(zone, hero);
    hero.targetZone = zone;
    hero.targetTileX = spot.col;
    hero.targetTileY = spot.row;
    hero.intentText = intentText;

    if (curTile.col === spot.col && curTile.row === spot.row) {
      hero.path = [];
      hero.facing = spot.facing;
      this.onHeroArriveAtZone(hero, zone);
      return;
    }

    hero.path = findGridPath(curTile.col, curTile.row, spot.col, spot.row);
    hero.activity = 'walking';
    hero.activityTimer = 0;
  }

  /**
   * 플레이어가 특정 영웅에게 직접 행동을 지시합니다 (그 행동이 끝날 때까지 자율 AI를 덮어씀).
   */
  public issueHeroOrder(heroId: string, order: HeroPlayerOrder): boolean {
    const hero = this.heroes[heroId];
    if (!hero || !hero.unlocked || hero.status === 'exploring') return false;

    hero.playerOrder = order;
    this.triggerHeroSpeech(hero, 'order_ack', true, order.label);

    switch (order.kind) {
      case 'eat_meal':
        this.sendHeroToZone(hero, 'dining', `🎯 지시: 식당으로 식사하러 이동 중`);
        break;
      case 'drink_ale':
        this.sendHeroToZone(hero, 'bar', `🎯 지시: 바 카운터로 음료 마시러 이동 중`);
        break;
      case 'rest_room':
        this.sendHeroToZone(hero, 'room', `🎯 지시: 2층 객실로 휴식·치료 이동 중`);
        break;
      case 'buy_potion':
        this.sendHeroToZone(hero, 'potion', `🎯 지시: 포션 가게로 물약 구매 이동 중`);
        break;
      case 'buy_equip':
        this.sendHeroToZone(hero, 'blacksmith', `🎯 지시: 대장간으로 장비 구매/장착 이동 중`);
        break;
      case 'enhance_equip':
        this.sendHeroToZone(hero, 'blacksmith', `🎯 지시: 대장간으로 장비 +강화 이동 중`);
        break;
      case 'sell_loot':
        this.sendHeroToZone(hero, 'trade', `🎯 지시: 거래대로 전리품 매각 이동 중`);
        break;
      case 'rally_board':
        this.sendHeroToZone(hero, 'board', `🎯 지시: 의뢰 게시판에서 파티 결성 중`);
        break;
      case 'depart_dungeon': {
        const dId = order.targetId ?? DUNGEONS[0].id;
        const dName = DUNGEON_MAP[dId]?.name ?? '던전';
        hero.rallyDungeonId = dId;
        this.sendHeroToZone(hero, 'gate', `🎯 지시: [${dName}] 출정 입구로 이동 중`);
        break;
      }
    }

    this.onUiUpdate();
    return true;
  }

  public cancelHeroOrder(heroId: string): boolean {
    const hero = this.heroes[heroId];
    if (!hero || !hero.unlocked) return false;
    hero.playerOrder = null;
    hero.rallyDungeonId = null;
    if (hero.status !== 'exploring') {
      hero.activity = 'idle';
      hero.activityTimer = 0;
      hero.path = [];
      hero.intentText = '지시 취소됨 (자율 행동 복귀)';
    }
    this.onUiUpdate();
    return true;
  }

  private updateHeroAgents(dt: number): void {
    const walkSpeed = 72; // 타일 이동 속도 (픽셀/초)
    const unlocked = this.getUnlockedHeroes();

    for (const hero of unlocked) {
      this.ensureHeroAgentFields(hero);

      // 말풍선 & 상호작용 이펙트 타이머 감소
      if ((hero.speechTimer ?? 0) > 0) {
        hero.speechTimer = Math.max(0, (hero.speechTimer ?? 0) - dt);
        if (hero.speechTimer === 0) {
          hero.speechText = null;
        }
      }
      if ((hero.speechCooldown ?? 0) > 0) {
        hero.speechCooldown = Math.max(0, (hero.speechCooldown ?? 0) - dt);
      }
      if (hero.interactionEffect) {
        hero.interactionEffect.timer -= dt;
        if (hero.interactionEffect.timer <= 0) {
          hero.interactionEffect = null;
        }
      }

      if (hero.status === 'exploring') {
        hero.activity = 'exploring';
        const exp = this.expeditions.find((e) => e.id === hero.expeditionId);
        const dName = exp ? DUNGEON_MAP[exp.dungeonId]?.name ?? '던전' : '던전';
        const fl = exp?.currentFloor ?? 1;
        const tot = exp?.totalFloors ?? 3;
        hero.intentText = `🗺️ ${dName} (${fl}/${tot}층) 탐험 중`;
        continue;
      }

      // 여관 체류 중 서서히 허기 증가
      hero.hunger = Math.min(100, (hero.hunger ?? 20) + dt * 0.42);

      // 1. 경로 이동 중인 경우
      if (hero.path && hero.path.length > 0) {
        hero.activity = 'walking';
        const nextStep = hero.path[0];
        const targetPx = tileToPixel(nextStep.col, nextStep.row);
        const dx = targetPx.x - hero.x!;
        const dy = targetPx.y - hero.y!;
        const dist = Math.hypot(dx, dy);

        if (dist <= walkSpeed * dt + 1.5) {
          hero.x = targetPx.x;
          hero.y = targetPx.y;
          hero.tileX = nextStep.col;
          hero.tileY = nextStep.row;
          hero.path.shift();
          if (hero.path.length === 0) {
            this.onHeroArriveAtZone(hero, hero.targetZone ?? 'hall');
          }
        } else {
          hero.x! += (dx / dist) * walkSpeed * dt;
          hero.y! += (dy / dist) * walkSpeed * dt;
          if (Math.abs(dx) > 0.5) {
            hero.facing = dx >= 0 ? 'right' : 'left';
          }
        }
        continue;
      }

      // 2. 도착 후 작업/상호작용 애니메이션 타이머 진행
      if (hero.activityTimer && hero.activityTimer > 0) {
        hero.activityTimer -= dt;
        if (hero.activityTimer <= 0) {
          hero.activityTimer = 0;
          this.completeHeroStationAction(hero);
        }
      }
    }

    // 3. 프레임 분산 자율 AI 의사결정 (0.35초마다 최대 3명씩 평가하여 30명일 때도 프레임 드랍 없음)
    this.agentDecisionTimer += dt;
    if (this.agentDecisionTimer >= 0.35 && unlocked.length > 0) {
      this.agentDecisionTimer = 0;
      const batchSize = Math.min(3, unlocked.length);
      for (let i = 0; i < batchSize; i++) {
        const h = unlocked[this.agentDecisionCursor % unlocked.length];
        this.agentDecisionCursor = (this.agentDecisionCursor + 1) % unlocked.length;
        this.evaluateHeroAutonomousNeed(h);
      }
    }

    // 4. 의뢰 게시판에 모인 영웅들의 자동 파티 결성 및 출정 행진 체크
    this.boardDispatchTimer += dt;
    if (this.boardDispatchTimer >= 1.4) {
      this.boardDispatchTimer = 0;
      if (this.autoDispatch) {
        this.tryAutonomousBoardRallyAndDepart();
      }
    }
  }

  private onHeroArriveAtZone(hero: HeroState, zone: InnZoneId): void {
    const spots = ZONE_SPOTS[zone] ?? ZONE_SPOTS.hall;
    const match = spots.find(
      (s) => s.col === hero.tileX && s.row === hero.tileY
    );
    if (match) {
      hero.facing = match.facing;
    }

    switch (zone) {
      case 'trade':
        hero.activity = 'selling_loot';
        hero.activityTimer = 1.3;
        hero.intentText = '💎 거래 가판대에서 전리품 흥정·매각 중';
        break;
      case 'potion':
        hero.activity = 'shopping_potion';
        hero.activityTimer = 1.4;
        hero.intentText = '⚗️ 포션 가게에서 비약 고르는 중';
        break;
      case 'blacksmith':
        hero.activity =
          hero.playerOrder?.kind === 'enhance_equip'
            ? 'enhancing'
            : 'shopping_equip';
        hero.activityTimer = 1.5;
        hero.intentText = '⚒️ 대장간에서 장비 정비 중';
        break;
      case 'dining':
        hero.activity = 'eating';
        hero.activityTimer = 1.6;
        hero.intentText = '🍲 1층 식당에서 따뜻한 식사 중';
        break;
      case 'bar':
        hero.activity = 'drinking';
        hero.activityTimer = 1.5;
        hero.intentText = '🍺 바 카운터에서 맥아 에일 시음 중';
        break;
      case 'room':
        hero.activity = 'sleeping';
        hero.activityTimer = Math.max(1.8, Math.min(4.5, hero.restTimerSec || 2.2));
        hero.intentText = '🛏️ 2층 객실 침대에서 수면·회복 중';
        this.triggerHeroSpeech(hero, 'resting');
        break;
      case 'board':
        hero.activity = 'rallying';
        hero.activityTimer = 1.0;
        hero.intentText = '📋 의뢰 게시판에서 파티원 모집 중';
        this.triggerHeroSpeech(hero, 'party_banter');
        break;
      case 'gate':
        hero.activity = 'rallying';
        hero.activityTimer = 0.6;
        hero.intentText = '🗺️ 던전 입구에서 출정 준비 완료!';
        break;
      default:
        hero.activity = 'idle';
        hero.activityTimer = 0;
        hero.intentText = '🏠 여관 홀에서 휴식 중';
        break;
    }
  }

  private completeHeroStationAction(hero: HeroState): void {
    const zone = hero.targetZone ?? 'hall';
    const order = hero.playerOrder;

    if (zone === 'trade') {
      this.executeHeroTradeAtStall(hero);
    } else if (zone === 'potion') {
      this.executeHeroPotionShopVisit(hero, order?.targetId);
    } else if (zone === 'blacksmith') {
      this.executeHeroBlacksmithVisit(hero, order);
    } else if (zone === 'dining' || zone === 'bar') {
      this.executeHeroDiningVisit(hero, order?.targetId);
    } else if (zone === 'room') {
      this.executeHeroRoomRestVisit(hero);
    } else if (zone === 'gate') {
      const targetDungeonId =
        order?.kind === 'depart_dungeon' && order.targetId
          ? order.targetId
          : hero.rallyDungeonId;
      if (targetDungeonId && this.isDungeonUnlocked(targetDungeonId)) {
        const dungeon = DUNGEON_MAP[targetDungeonId];
        const idlePool = this.getUnlockedHeroes().filter(
          (h) => h.status === 'idle' && !h.expeditionId
        );
        const party = selectBestPartyForDungeon(
          idlePool,
          dungeon,
          this.getMaxPartySize()
        );
        if (!party.some((p) => p.id === hero.id)) {
          party[0] = hero;
        }
        this.dispatchParty(
          targetDungeonId,
          party.map((p) => p.id)
        );
      }
      hero.rallyDungeonId = null;
    }

    if (hero.playerOrder) {
      hero.playerOrder = null;
    }
    if (hero.status !== 'exploring') {
      hero.activity = 'idle';
      if (zone === 'board') {
        hero.intentText = '📋 의뢰 게시판에서 파티 대기 중';
      } else {
        hero.intentText = `${ZONE_LABELS[zone]} 활동 완료`;
      }
    }
    this.onUiUpdate();
  }

  private executeHeroTradeAtStall(hero: HeroState): void {
    if (hero.lootBag.length === 0) return;

    const ratePct = this.shopConfig.lootBuyRatePct;
    if (ratePct < 85) {
      this.triggerHeroSpeech(hero, 'loot_price_low');
    }

    let soldCount = 0;
    let earnedGold = 0;
    const reserve = this.autoBuyLoot ? this.shopConfig.lootReserveGold : 0;

    for (const stack of [...hero.lootBag]) {
      if (stack.count <= 0) continue;
      if (this.shopConfig.lootBuyEnabled[stack.materialId] === false) {
        continue;
      }
      // 매입가가 너무 낮으면(75% 이하) 탐욕/자만 성격 영웅은 잠시 판매를 망설임 (단, 오래된 전리품은 매각)
      const roster = HERO_ROSTER_MAP[hero.id];
      if (
        ratePct <= 75 &&
        stack.ageSeconds < 20 &&
        (roster.personalities.includes('greedy') ||
          roster.personalities.includes('arrogant'))
      ) {
        this.triggerHeroSpeech(hero, 'loot_price_low', true);
        continue;
      }

      const unitPrice = this.getEffectiveMaterialBuyPrice(stack.materialId);
      const availGold = Math.max(0, this.gold - reserve);
      const canBuy = Math.min(stack.count, Math.floor(availGold / unitPrice));
      if (canBuy > 0) {
        const total = canBuy * unitPrice;
        this.gold -= total;
        hero.gold += total;
        this.materials[stack.materialId] =
          (this.materials[stack.materialId] ?? 0) + canBuy;
        stack.count -= canBuy;
        soldCount += canBuy;
        earnedGold += total;
      }
    }

    hero.lootBag = hero.lootBag.filter((s) => s.count > 0);

    if (soldCount > 0) {
      this.totalHeroShopTransactions += 1;
      this.sound.playCoin();
      this.spawnCoins(hero.x!, hero.y! - 10, 4);
      this.setHeroInteractionEffect(
        hero,
        '💎',
        `+${earnedGold}G`,
        '#ebd186'
      );
      this.triggerHeroSpeech(
        hero,
        ratePct >= 110 ? 'price_good' : 'loot_sold'
      );
    }
  }

  private executeHeroPotionShopVisit(
    hero: HeroState,
    specificPotionId?: string
  ): void {
    const mult = this.shopConfig.potionPriceMultiplier;
    if (mult >= 1.25 && this.random() < 0.55) {
      this.triggerHeroSpeech(hero, 'price_high');
    }

    const candidates = specificPotionId
      ? [specificPotionId]
      : hero.status === 'injured'
      ? [
          'potion_cure_injury',
          'potion_ironblood',
          'potion_wisdom',
          'potion_dragon_elixir',
          'potion_heal_minor',
        ]
      : [
          'potion_dragon_elixir',
          'potion_ironblood',
          'potion_wisdom',
          'potion_gale',
          'potion_might',
          'potion_cure_injury',
          'potion_heal_minor',
          'potion_herb_water',
        ];

    for (const pId of candidates) {
      if (this.shopConfig.potionSaleEnabled[pId] === false && !specificPotionId) {
        continue;
      }
      const rec = POTION_RECIPE_MAP[pId];
      if (!rec || (this.potionStock[pId] ?? 0) <= 0) continue;
      const price = this.getEffectivePotionSellPrice(pId);

      // 가격이 1.5배 이상 비싸고 부상이 아니면 가끔 구매를 포기하고 불평
      if (
        !specificPotionId &&
        mult >= 1.5 &&
        hero.status !== 'injured' &&
        hero.gold < price * 1.6
      ) {
        this.triggerHeroSpeech(hero, 'price_high', true);
        return;
      }

      if (hero.gold >= price) {
        hero.gold -= price;
        this.addGold(price);
        this.potionStock[pId] -= 1;
        this.totalHeroShopTransactions += 1;

        const buff: HeroBuff | null = rec.buff
          ? {
              id: rec.buff.id,
              name: rec.buff.name,
              icon: rec.buff.icon,
              source: 'potion',
              statBonusPct: { ...rec.buff.statBonusPct },
              successRateBonus: rec.buff.successRateBonus,
              xpMultBonus: rec.buff.xpMultBonus,
              injuryImmune: rec.buff.injuryImmune,
              remainingRuns: rec.buff.runs,
            }
          : null;

        this.applyBuffAndHealToHero(
          hero,
          buff,
          rec.hpRestorePct,
          rec.healsInjury,
          rec.healsFatigue
        );
        this.spawnCoins(hero.x!, hero.y! - 10, 3);
        this.setHeroInteractionEffect(
          hero,
          rec.icon,
          `+${price}G`,
          '#78b2bf'
        );
        this.triggerHeroSpeech(
          hero,
          mult <= 0.85 ? 'price_good' : 'potion_bought'
        );
        const roster = HERO_ROSTER_MAP[hero.id];
        this.addLog(
          `🧪 [${roster.name}]이(가) 포션 가게에서 〈${rec.name}〉을(를) 구매했습니다! (+${formatGold(
            price
          )}G 여관 수입)`,
          'normal'
        );
        return;
      }
    }
  }

  private executeHeroBlacksmithVisit(
    hero: HeroState,
    order?: HeroPlayerOrder | null
  ): void {
    // 1. 플레이어가 특정 재고 장비 장착/구매를 지시한 경우
    if (order?.kind === 'buy_equip' && order.stockUid !== undefined) {
      if (this.equipItemToHero(hero.id, order.stockUid)) {
        this.setHeroInteractionEffect(hero, '⚒️', '장착 완료!', '#e6c274');
        this.triggerHeroSpeech(hero, 'equip_bought', true);
      }
      return;
    }

    // 2. 자율 장비 쇼핑
    if (this.shopConfig.blacksmithSaleEnabled) {
      const bought = this.heroTryBuyBetterEquipment(hero);
      if (bought) {
        this.totalHeroShopTransactions += 1;
        this.spawnCoins(hero.x!, hero.y! - 10, 4);
        this.setHeroInteractionEffect(hero, '⚒️', '신규 장착!', '#e6c274');
        this.triggerHeroSpeech(hero, 'equip_bought');
      }
    }

    // 3. 대장간 자율 안전 강화 의뢰 (옵션이 켜져 있고 영웅 골드가 넉넉할 때 +1~+2 시도)
    if (this.shopConfig.blacksmithAutoEnhanceEnabled && hero.gold >= 90) {
      for (const slot of ['weapon', 'armor', 'offhand', 'accessory'] as EquipSlot[]) {
        const inst = hero.equipment[slot];
        const def = EQUIPMENT_DEF_MAP[inst.defId];
        if (!def || def.isBase || inst.enhanceLevel >= 2) continue;
        const res = this.enhanceEquipment({ heroId: hero.id, slot }, true);
        if (res) {
          this.setHeroInteractionEffect(
            hero,
            res.success ? '✨' : '💥',
            res.success ? `+${res.newLevel}!` : '파괴..',
            res.success ? '#ebd186' : '#c7635b'
          );
          this.triggerHeroSpeech(
            hero,
            res.success ? 'enhance_success' : 'enhance_fail',
            true
          );
          break;
        }
      }
    }
  }

  private executeHeroDiningVisit(
    hero: HeroState,
    specificMealUpgradeId?: string
  ): void {
    if (!this.shopConfig.mealSaleEnabled && !specificMealUpgradeId) return;

    const meals = this.getUnlockedMeals();
    const mult = this.shopConfig.mealPriceMultiplier;

    for (let i = meals.length - 1; i >= 0; i--) {
      const m = meals[i];
      if (specificMealUpgradeId && m.upgradeId !== specificMealUpgradeId) {
        continue;
      }
      const { option, buff } = this.getMealEffectiveBuff(m.upgradeId);
      const price = this.getEffectiveMealPrice(m.upgradeId);

      if (hero.gold >= price) {
        hero.gold -= price;
        this.addGold(price);
        hero.hunger = Math.max(0, (hero.hunger ?? 50) - 75);
        hero.fatigue = Math.max(0, (hero.fatigue ?? 20) - 20);
        this.totalHeroShopTransactions += 1;

        this.applyBuffAndHealToHero(
          hero,
          buff,
          option.hpRestorePct,
          false,
          true
        );
        this.spawnCoins(hero.x!, hero.y! - 10, 3);
        this.setHeroInteractionEffect(
          hero,
          option.icon,
          `+${price}G`,
          '#7eb38a'
        );
        this.triggerHeroSpeech(
          hero,
          mult >= 1.25 ? 'price_high' : mult <= 0.85 ? 'price_good' : 'eating'
        );
        return;
      }
    }

    // 영웅 골드가 부족해도 여관 기본 약초 수프로 허기 해소
    hero.hunger = Math.max(0, (hero.hunger ?? 50) - 55);
    this.setHeroInteractionEffect(hero, '🥣', '식사 완료', '#7eb38a');
    this.triggerHeroSpeech(hero, 'eating');
  }

  private executeHeroRoomRestVisit(hero: HeroState): void {
    const bd = getHeroStatBreakdown(hero);
    hero.currentHp = bd.totalStats.hp;
    hero.status = 'idle';
    hero.restTimerSec = 0;
    hero.fatigue = 0;
    this.totalHeroesHealed += 1;

    const roomFee = Math.min(
      hero.gold,
      Math.round(6 * this.getRoomRecoveryBonus())
    );
    if (roomFee > 0) {
      hero.gold -= roomFee;
      this.addGold(roomFee);
      this.totalHeroShopTransactions += 1;
      this.spawnCoins(hero.x!, hero.y! - 10, 3);
    }

    const rBonus = Math.min(
      0.2,
      0.06 + (this.getRoomRecoveryBonus() - 1) * 0.05
    );
    hero.buffs = hero.buffs.filter((b) => b.source !== 'rest');
    hero.buffs.push({
      id: 'buff_room_sleep',
      name: '여관 숙면 회복',
      icon: '🛏️',
      source: 'rest',
      statBonusPct: { hp: rBonus, def: rBonus },
      successRateBonus: 0.03,
      xpMultBonus: 0.05,
      remainingRuns: 1,
    });

    this.setHeroInteractionEffect(hero, '🛏️', '완전 회복!', '#7eb38a');
    this.triggerHeroSpeech(hero, 'healed');
  }

  /**
   * 대기 중인 영웅의 욕구(부상/피로 → 전리품 판매 → 장비/포션 쇼핑 → 허기/식사 → 게시판 집결)를 평가하여 목적지로 이동시킵니다.
   */
  private evaluateHeroAutonomousNeed(hero: HeroState): void {
    if (!hero.unlocked || hero.status === 'exploring') return;
    if (hero.playerOrder) return; // 플레이어 지시 수행 중에는 자율 AI가 덮어쓰지 않음
    if (hero.path && hero.path.length > 0) return;
    if ((hero.activityTimer ?? 0) > 0) return;

    const bd = getHeroStatBreakdown(hero);

    // 1. 부상 또는 저체력/과피로 치료 및 휴식
    if (
      hero.status === 'injured' ||
      hero.status === 'fatigued' ||
      (hero.fatigue ?? 0) >= 72 ||
      hero.currentHp < bd.totalStats.hp * 0.6
    ) {
      if (hero.status === 'injured' && this.hasAffordableHealingPotion(hero)) {
        this.sendHeroToZone(hero, 'potion', '치료 포션을 사러 포션 가게로 이동 중');
        return;
      }
      this.sendHeroToZone(hero, 'room', '부상·피로 회복을 위해 2층 객실로 이동 중');
      return;
    }

    // 2. 가방에 전리품이 있으면 거래 가판대로 이동하여 매각
    const hasSellableLoot = hero.lootBag.some(
      (s) => s.count > 0 && this.shopConfig.lootBuyEnabled[s.materialId] !== false
    );
    if (hasSellableLoot && hero.targetZone !== 'trade') {
      this.sendHeroToZone(hero, 'trade', '전리품을 팔러 거래 가판대로 이동 중');
      return;
    }

    // 3. 대장간에 착용 가능한 더 좋은 장비가 있고 구매 가능하면 대장간으로 이동
    if (
      this.shopConfig.blacksmithSaleEnabled &&
      this.hasAffordableBetterEquipment(hero) &&
      hero.targetZone !== 'blacksmith'
    ) {
      this.sendHeroToZone(hero, 'blacksmith', '새 장비를 구매하러 대장간으로 이동 중');
      return;
    }

    // 4. 포션 버프가 없고 구매 가능한 포션이 있으면 포션 가게로 이동
    const hasPotionBuff = hero.buffs.some((b) => b.source === 'potion');
    if (
      !hasPotionBuff &&
      this.hasAffordableBuffPotion(hero) &&
      hero.targetZone !== 'potion'
    ) {
      this.sendHeroToZone(hero, 'potion', '탐험용 비약을 사러 포션 가게로 이동 중');
      return;
    }

    // 5. 허기가 높거나(>=48) 음식 버프가 없으면 식당 또는 바로 이동
    const hasFoodBuff = hero.buffs.some((b) => b.source === 'food');
    if (
      this.shopConfig.mealSaleEnabled &&
      ((hero.hunger ?? 0) >= 48 || (!hasFoodBuff && hero.gold >= 8)) &&
      hero.targetZone !== 'dining' &&
      hero.targetZone !== 'bar'
    ) {
      if ((hero.hunger ?? 0) >= 65) {
        this.triggerHeroSpeech(hero, 'hungry');
      }
      const goBar =
        (this.upgrades['menu_ale'] ?? 0) > 0 && this.random() < 0.35;
      this.sendHeroToZone(
        hero,
        goBar ? 'bar' : 'dining',
        goBar
          ? '맥아 에일을 마시러 바 카운터로 이동 중'
          : '식사하러 1층 식당 테이블로 이동 중'
      );
      return;
    }

    // 6. 모든 준비가 끝났으면 의뢰 게시판으로 모여 파티 결성 대기
    if (hero.targetZone !== 'board' && hero.targetZone !== 'gate') {
      this.sendHeroToZone(
        hero,
        'board',
        '원정 파티를 꾸리러 의뢰 게시판으로 이동 중'
      );
    }
  }

  private hasAffordableHealingPotion(hero: HeroState): boolean {
    for (const pId of [
      'potion_cure_injury',
      'potion_ironblood',
      'potion_wisdom',
      'potion_dragon_elixir',
    ]) {
      if (this.shopConfig.potionSaleEnabled[pId] === false) continue;
      if ((this.potionStock[pId] ?? 0) <= 0) continue;
      if (hero.gold >= this.getEffectivePotionSellPrice(pId)) return true;
    }
    return false;
  }

  private hasAffordableBuffPotion(hero: HeroState): boolean {
    for (const pId of [
      'potion_dragon_elixir',
      'potion_ironblood',
      'potion_wisdom',
      'potion_gale',
      'potion_might',
      'potion_heal_minor',
      'potion_herb_water',
    ]) {
      if (this.shopConfig.potionSaleEnabled[pId] === false) continue;
      if ((this.potionStock[pId] ?? 0) <= 0) continue;
      if (hero.gold >= this.getEffectivePotionSellPrice(pId)) return true;
    }
    return false;
  }

  private hasAffordableBetterEquipment(hero: HeroState): boolean {
    if (this.equipmentStock.length === 0) return false;
    const roster = HERO_ROSTER_MAP[hero.id];
    for (const slot of ['weapon', 'armor', 'offhand', 'accessory'] as const) {
      const curScore = getEquipmentScoreForClass(
        roster.classId,
        hero.equipment[slot]
      );
      for (const cand of this.equipmentStock) {
        const def = EQUIPMENT_DEF_MAP[cand.defId];
        if (!def || def.slot !== slot) continue;
        if (!canClassEquip(roster.classId, def)) continue;
        const price = this.getEffectiveEquipSellPrice(def.id);
        if (hero.gold < price) continue;
        if (getEquipmentScoreForClass(roster.classId, cand) > curScore + 1) {
          return true;
        }
      }
    }
    return false;
  }

  private tryAutonomousBoardRallyAndDepart(): void {
    if (this.expeditions.length >= this.getMaxConcurrentExpeditions()) return;

    // 이미 출정 게이트로 걸어가는 중인 영웅이 있으면 도착을 기다림
    const marchingToGate = this.getUnlockedHeroes().filter(
      (h) =>
        h.status === 'idle' &&
        !h.expeditionId &&
        h.targetZone === 'gate' &&
        Boolean(h.rallyDungeonId)
    );
    if (marchingToGate.length > 0) return;

    const unlockedDungeons = DUNGEONS.filter((d) =>
      this.isDungeonUnlocked(d.id)
    );
    if (unlockedDungeons.length === 0) return;

    const readyHeroes = this.getUnlockedHeroes().filter(
      (h) => h.status === 'idle' && !h.expeditionId
    );
    if (readyHeroes.length === 0) return;

    const maxParty = this.getMaxPartySize();
    for (let i = unlockedDungeons.length - 1; i >= 0; i--) {
      const d = unlockedDungeons[i];
      const party = selectBestPartyForDungeon(readyHeroes, d, maxParty);
      if (party.length === 0) continue;
      const ev = evaluatePartyForDungeon(party, d);
      if (ev.finalSuccessRate >= 0.6 || i === 0) {
        const partyTag = `party_${this.nextExpeditionUid}`;
        party.forEach((member, idx) => {
          member.partyId = partyTag;
          member.rallyDungeonId = d.id;
          this.sendHeroToZone(
            member,
            'gate',
            `🗺️ [${d.name}] 파티 결성! 던전 입구로 이동 중`
          );
          if (idx === 0) {
            this.triggerHeroSpeech(member, 'pre_dungeon', true);
          } else if (idx === 1) {
            this.triggerHeroSpeech(member, 'party_banter', true);
          }
        });
        break;
      }
    }
  }

  // ==========================================================================
  // 던전 해금 · 파티 파견 · 카이로소프트풍 층별 탐험 & 자동 전투
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

  private ensureExpeditionFloorFields(exp: ActiveExpedition): void {
    const dungeon = DUNGEON_MAP[exp.dungeonId] ?? DUNGEONS[0];
    if (!exp.totalFloors) {
      exp.totalFloors = getDungeonTotalFloors(dungeon);
    }
    if (!exp.currentFloor) {
      exp.currentFloor = 1;
    }
    if (!exp.floorPhase) {
      exp.floorPhase = 'marching';
    }
    if (typeof exp.marchProgress !== 'number') {
      exp.marchProgress = 0;
    }
    if (!Array.isArray(exp.monsters) || exp.monsters.length === 0) {
      exp.monsters = createFloorMonsters(
        dungeon,
        exp.currentFloor,
        exp.totalFloors
      );
    }
    if (!exp.partyCombatState) {
      exp.partyCombatState = {};
      for (const hId of exp.heroIds) {
        const h = this.heroes[hId];
        const maxHp = h ? getHeroStatBreakdown(h).totalStats.hp : 100;
        exp.partyCombatState[hId] = {
          currentHp: h ? Math.max(20, h.currentHp) : maxHp,
          maxHp,
          hitFlashTimer: 0,
          lungeTimer: 0,
        };
      }
    }
    if (typeof exp.combatRoundTimer !== 'number') exp.combatRoundTimer = 0.45;
    if (typeof exp.floorTransitionTimer !== 'number') exp.floorTransitionTimer = 0;
    if (!Array.isArray(exp.combatFloats)) exp.combatFloats = [];
    if (!Array.isArray(exp.dropVisuals)) exp.dropVisuals = [];
    if (!Array.isArray(exp.floorLogs)) exp.floorLogs = [];
    if (!exp.accumulatedLoot) exp.accumulatedLoot = {};
    if (typeof exp.willSucceed !== 'boolean') {
      exp.willSucceed = this.random() < exp.expectedSuccessRate;
      exp.failAtFloor = exp.willSucceed
        ? exp.totalFloors + 1
        : Math.max(2, exp.totalFloors);
    }
  }

  private appendExpeditionFloorLog(
    exp: ActiveExpedition,
    text: string,
    type: ExpeditionFloorLog['type']
  ): void {
    if (!exp.floorLogs) exp.floorLogs = [];
    exp.floorLogs.unshift({
      id: this.nextFloorLogId++,
      floor: exp.currentFloor ?? 1,
      text,
      type,
    });
    if (exp.floorLogs.length > 14) {
      exp.floorLogs.length = 14;
    }
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

    for (const h of partyHeroes) {
      this.heroAutoPrepareForExpedition(h);
    }

    // 역할 순서(탱커 전열 -> 딜러/지원 -> 힐러 후열)로 정렬하여 전투 대열 구성
    const roleOrder = { tank: 0, dps: 1, support: 2, healer: 3 };
    partyHeroes.sort((a, b) => {
      const ra = HERO_CLASSES[HERO_ROSTER_MAP[a.id].classId].role;
      const rb = HERO_CLASSES[HERO_ROSTER_MAP[b.id].classId].role;
      return roleOrder[ra] - roleOrder[rb];
    });
    const orderedIds = partyHeroes.map((h) => h.id);

    const preview = evaluatePartyForDungeon(partyHeroes, dungeon);
    const expId = `exp_${this.nextExpeditionUid++}`;
    const totalFloors = getDungeonTotalFloors(dungeon);
    const willSucceed = this.random() < preview.finalSuccessRate;

    const partyCombatState: ActiveExpedition['partyCombatState'] = {};
    for (const h of partyHeroes) {
      const bd = getHeroStatBreakdown(h);
      h.status = 'exploring';
      h.expeditionId = expId;
      h.activity = 'exploring';
      h.path = [];
      h.activityTimer = 0;
      h.rallyDungeonId = null;
      h.partyId = expId;
      h.intentText = `🗺️ ${dungeon.name} (1/${totalFloors}층) 탐험 중`;
      partyCombatState[h.id] = {
        currentHp: bd.totalStats.hp,
        maxHp: bd.totalStats.hp,
        hitFlashTimer: 0,
        lungeTimer: 0,
      };
    }

    const newExp: ActiveExpedition = {
      id: expId,
      dungeonId,
      heroIds: orderedIds,
      totalDurationSec: preview.durationSec,
      remainingSec: preview.durationSec,
      expectedSuccessRate: preview.finalSuccessRate,
      totalFloors,
      currentFloor: 1,
      floorPhase: 'marching',
      marchProgress: 0,
      monsters: createFloorMonsters(dungeon, 1, totalFloors),
      partyCombatState,
      combatRoundTimer: 0.5,
      floorTransitionTimer: 0,
      combatFloats: [],
      dropVisuals: [],
      floorLogs: [],
      accumulatedLoot: {},
      willSucceed,
      failAtFloor: willSucceed ? totalFloors + 1 : totalFloors,
    };

    this.appendExpeditionFloorLog(
      newExp,
      `1층 진입: [${preview.heroNames.join('·')}] 파티가 ${dungeon.name} 탐험을 시작합니다!`,
      'march'
    );

    this.expeditions.push(newExp);
    if (
      !this.focusedExpeditionId ||
      !this.expeditions.some((e) => e.id === this.focusedExpeditionId)
    ) {
      this.focusedExpeditionId = expId;
    }

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
      this.ensureExpeditionFloorFields(exp);
      exp.remainingSec -= dt;

      // 층별 진행 및 자동 전투 시뮬레이션
      this.updateSingleExpeditionFloorCombat(exp, dt);

      if (exp.remainingSec <= 0) {
        this.resolveExpedition(exp);
      } else {
        stillRunning.push(exp);
      }
    }

    this.expeditions = stillRunning;
    if (
      this.focusedExpeditionId &&
      !this.expeditions.some((e) => e.id === this.focusedExpeditionId)
    ) {
      this.focusedExpeditionId = this.expeditions[0]?.id ?? null;
    }
  }

  private updateSingleExpeditionFloorCombat(
    exp: ActiveExpedition,
    dt: number
  ): void {
    const dungeon = DUNGEON_MAP[exp.dungeonId];
    if (!dungeon) return;

    const totalFloors = exp.totalFloors ?? 3;
    const elapsed = Math.max(0, exp.totalDurationSec - exp.remainingSec);
    const floorSpan = Math.max(2, exp.totalDurationSec / totalFloors);
    const targetFloor = Math.min(
      totalFloors,
      Math.floor(elapsed / floorSpan) + 1
    );
    const floorLocalElapsed = elapsed - (targetFloor - 1) * floorSpan;
    const floorLocalRatio = Math.min(1, Math.max(0, floorLocalElapsed / floorSpan));

    // 플로팅 텍스트 및 드랍 시각효과 타이머 감쇠
    if (exp.combatFloats && exp.combatFloats.length > 0) {
      exp.combatFloats = exp.combatFloats.filter((cf) => {
        cf.y -= 14 * dt;
        cf.life -= dt;
        return cf.life > 0;
      });
    }
    if (exp.dropVisuals && exp.dropVisuals.length > 0) {
      exp.dropVisuals = exp.dropVisuals.filter((dv) => {
        dv.life -= dt;
        return dv.life > 0;
      });
    }
    for (const m of exp.monsters ?? []) {
      if (m.hitFlashTimer > 0) m.hitFlashTimer = Math.max(0, m.hitFlashTimer - dt);
      if (m.lungeTimer > 0) m.lungeTimer = Math.max(0, m.lungeTimer - dt);
    }
    for (const cState of Object.values(exp.partyCombatState ?? {})) {
      if (cState.hitFlashTimer > 0) {
        cState.hitFlashTimer = Math.max(0, cState.hitFlashTimer - dt);
      }
      if (cState.lungeTimer > 0) {
        cState.lungeTimer = Math.max(0, cState.lungeTimer - dt);
      }
    }

    // 층 전환 감지
    if (targetFloor > (exp.currentFloor ?? 1)) {
      exp.currentFloor = targetFloor;
      exp.floorPhase = 'marching';
      exp.marchProgress = 0;
      exp.monsters = createFloorMonsters(dungeon, targetFloor, totalFloors);
      const isBoss = targetFloor === totalFloors;
      this.appendExpeditionFloorLog(
        exp,
        isBoss
          ? `👑 [${targetFloor}층 보스방 진입!] ${exp.monsters[0]?.name}이(가) 모습을 드러냈습니다!`
          : `🏃 ${targetFloor}층 진입: 어두운 복도를 따라 전진합니다.`,
        isBoss ? 'boss' : 'march'
      );
    }

    // 층 내 단계(복도 행진 -> 몬스터 교전 -> 층 클리어 및 드랍)
    if (floorLocalRatio < 0.24) {
      exp.floorPhase = 'marching';
      exp.marchProgress = floorLocalRatio / 0.24;
    } else if (floorLocalRatio < 0.84) {
      if (exp.floorPhase === 'marching') {
        exp.floorPhase = 'fighting';
        const mNames = (exp.monsters ?? []).map((m) => m.name).join(', ');
        this.appendExpeditionFloorLog(
          exp,
          `⚔️ ${exp.currentFloor}층 교전 시작! (${mNames})`,
          'combat'
        );
      }

      exp.combatRoundTimer = (exp.combatRoundTimer ?? 0.5) - dt;
      if (exp.combatRoundTimer <= 0) {
        exp.combatRoundTimer = 0.65;
        this.executeExpeditionCombatTick(exp, dungeon, floorLocalRatio);
      }
    } else {
      if (exp.floorPhase === 'fighting') {
        const isFailFloor =
          !exp.willSucceed && exp.currentFloor === (exp.failAtFloor ?? totalFloors);
        if (isFailFloor) {
          exp.floorPhase = 'retreated';
          this.appendExpeditionFloorLog(
            exp,
            `💥 ${exp.currentFloor}층 보스의 맹공에 전열이 위태롭습니다! 부상자를 엄호하며 여관으로 후퇴합니다!`,
            'retreat'
          );
        } else {
          exp.floorPhase = 'floor_clear';
          for (const m of exp.monsters ?? []) {
            m.currentHp = 0;
          }
          // 층 클리어 시 가시적 드랍 아이템 연출
          if (dungeon.drops.length > 0) {
            const dropDef =
              dungeon.drops[(exp.currentFloor ?? 1) % dungeon.drops.length];
            const mat = MATERIAL_MAP[dropDef.materialId];
            if (mat && (exp.willSucceed || this.random() < 0.5)) {
              exp.dropVisuals?.push({
                x: 315,
                y: 98,
                icon: mat.icon,
                name: mat.name,
                count: 1,
                life: 1.6,
              });
              this.appendExpeditionFloorLog(
                exp,
                `🎁 ${exp.currentFloor}층 처치 보상! ${mat.icon}${mat.name} 획득!`,
                'drop'
              );
            }
          }
        }
      }
    }
  }

  private executeExpeditionCombatTick(
    exp: ActiveExpedition,
    _dungeon: (typeof DUNGEONS)[number],
    floorLocalRatio: number
  ): void {
    const aliveMonsters = (exp.monsters ?? []).filter((m) => m.currentHp > 0);
    if (aliveMonsters.length === 0) return;

    const attackerId =
      exp.heroIds[Math.floor(this.random() * exp.heroIds.length)];
    const attacker = this.heroes[attackerId];
    const targetMonster = aliveMonsters[0];

    if (attacker && exp.partyCombatState?.[attackerId]) {
      const roster = HERO_ROSTER_MAP[attackerId];
      const cls = HERO_CLASSES[roster.classId];
      const bd = getHeroStatBreakdown(attacker);
      exp.partyCombatState[attackerId].lungeTimer = 0.25;

      const isCrit = this.random() < 0.22;
      const rawDmg = Math.max(
        12,
        Math.round(
          (bd.totalStats.atk + bd.totalStats.int * 0.85) *
            (isCrit ? 1.45 : 1.0)
        )
      );

      // 층 진행도에 맞춰 몬스터 체력이 자연스럽게 깎이도록 보정
      const isFailFloor =
        !exp.willSucceed &&
        exp.currentFloor === (exp.failAtFloor ?? exp.totalFloors);
      const maxPull = isFailFloor
        ? Math.floor(targetMonster.maxHp * 0.28)
        : Math.floor(targetMonster.maxHp * 0.45);
      const dmg = Math.min(maxPull, rawDmg);

      targetMonster.currentHp = Math.max(
        isFailFloor ? Math.floor(targetMonster.maxHp * 0.2) : 1,
        targetMonster.currentHp - dmg
      );
      targetMonster.hitFlashTimer = 0.2;

      exp.combatFloats?.push({
        x: 295 + this.random() * 30,
        y: 66,
        text: isCrit ? `⚡-${dmg}!` : `-${dmg}`,
        color: isCrit ? '#ebd186' : '#f6efe2',
        life: 0.75,
      });

      if (cls.role === 'healer') {
        const frontId = exp.heroIds[0];
        const frontState = exp.partyCombatState?.[frontId];
        if (frontState) {
          const healAmt = Math.max(10, Math.round(bd.totalStats.int * 0.65));
          frontState.currentHp = Math.min(
            frontState.maxHp,
            frontState.currentHp + healAmt
          );
          exp.combatFloats?.push({
            x: 165,
            y: 66,
            text: `+${healAmt}`,
            color: '#7eb38a',
            life: 0.75,
          });
        }
      }
    }

    // 몬스터 반격 (전열 탱커 우선 피격)
    const frontId = exp.heroIds[0];
    const frontState = exp.partyCombatState?.[frontId];
    if (frontState && targetMonster) {
      targetMonster.lungeTimer = 0.22;
      const isFailFloor =
        !exp.willSucceed &&
        exp.currentFloor === (exp.failAtFloor ?? exp.totalFloors);
      const mDmg = Math.max(
        4,
        Math.round(
          targetMonster.atk * (isFailFloor && floorLocalRatio > 0.55 ? 1.5 : 0.55)
        )
      );
      frontState.currentHp = Math.max(
        isFailFloor ? Math.floor(frontState.maxHp * 0.18) : Math.floor(frontState.maxHp * 0.45),
        frontState.currentHp - mDmg
      );
      frontState.hitFlashTimer = 0.2;

      exp.combatFloats?.push({
        x: 168,
        y: 74,
        text: `-${mDmg}`,
        color: '#d47a72',
        life: 0.7,
      });
    }
  }

  private resolveExpedition(exp: ActiveExpedition): void {
    const dungeon = DUNGEON_MAP[exp.dungeonId];
    const partyHeroes = exp.heroIds
      .map((id) => this.heroes[id])
      .filter((h): h is HeroState => Boolean(h));

    if (!dungeon || partyHeroes.length === 0) return;

    const preview = evaluatePartyForDungeon(partyHeroes, dungeon);
    const isSuccess =
      typeof exp.willSucceed === 'boolean'
        ? exp.willSucceed
        : this.random() < preview.finalSuccessRate;

    const immuneHeroIds = new Set<string>();
    const gatePx = tileToPixel(28, 14);

    for (const h of partyHeroes) {
      h.expeditionId = null;
      h.partyId = null;
      h.totalRuns += 1;
      // 귀환 시 던전 입구 아치(28, 14)에 다시 등장!
      h.tileX = 28;
      h.tileY = 14;
      h.x = gatePx.x;
      h.y = gatePx.y;
      h.facing = 'left';
      h.path = [];
      h.hunger = Math.min(100, (h.hunger ?? 30) + 24);
      h.fatigue = Math.min(100, (h.fatigue ?? 15) + 30);

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

      for (const drop of dungeon.drops) {
        const effChance = Math.min(0.98, drop.chance + preview.lootChanceBonus);
        if (this.random() < effChance) {
          const count =
            drop.minCount +
            Math.floor(this.random() * (drop.maxCount - drop.minCount + 1));
          lootDropped[drop.materialId] =
            (lootDropped[drop.materialId] ?? 0) + count;
          this.totalLootFound += count;

          const recipient =
            partyHeroes[Math.floor(this.random() * partyHeroes.length)];
          this.addLootToHeroBag(recipient, drop.materialId, count);
        }
      }

      partyHeroes.forEach((h, idx) => {
        h.totalWins += 1;
        h.gold += goldPerHero;
        this.grantHeroXp(h, xpGain);
        const bd = getHeroStatBreakdown(h);
        const hpLoss = Math.floor(
          bd.totalStats.hp * (0.15 + this.random() * 0.15)
        );
        h.currentHp = Math.max(1, h.currentHp - hpLoss);
        if (h.currentHp < bd.totalStats.hp * 0.45) {
          h.status = 'fatigued';
          h.restTimerSec = this.getHeroRestDuration(h, 'fatigued');
          this.sendHeroToZone(h, 'room', '원정 귀환 후 2층 객실로 휴식 이동 중');
        } else {
          h.status = 'idle';
          h.currentHp = bd.totalStats.hp;
          if (h.lootBag.length > 0) {
            this.sendHeroToZone(
              h,
              'trade',
              '원정 성공 귀환! 거래대로 전리품 매각하러 이동 중'
            );
          } else {
            this.sendHeroToZone(
              h,
              'dining',
              '원정 성공 귀환! 식당으로 축하 식사하러 이동 중'
            );
          }
        }
        if (idx === 0) {
          this.triggerHeroSpeech(h, 'returned_win', true);
        }
      });

      this.addReputation(dungeon.rewardRep);

      const lootText = Object.entries(lootDropped)
        .map(([mId, cnt]) => `${MATERIAL_MAP[mId]?.name ?? mId} x${cnt}`)
        .join(', ');

      this.appendExpeditionFloorLog(
        exp,
        `🏆 [${dungeon.name} ${exp.totalFloors}층 보스 토벌 완료!] 파티가 전리품을 들고 여관으로 귀환합니다.`,
        'win'
      );

      this.addLog(
        `🏆 [${dungeon.name}] 전 층 공략 성공! (${preview.heroNames.join(
          '·'
        )}) — XP +${xpGain}, 영웅 골드 +${goldPerHero}G${
          lootText ? `, 전리품: ${lootText}` : ''
        }`,
        'loot'
      );

      this.checkHeroUnlocks();
    } else {
      const xpGain = Math.max(3, Math.round(dungeon.rewardXp * 0.35));
      const goldPerHero = Math.max(
        2,
        Math.round(dungeon.rewardHeroGold * 0.25)
      );

      if (dungeon.drops.length > 0 && this.random() < 0.45) {
        const firstMat = dungeon.drops[0].materialId;
        lootDropped[firstMat] = 1;
        this.addLootToHeroBag(partyHeroes[0], firstMat, 1);
      }

      partyHeroes.forEach((h, idx) => {
        h.gold += goldPerHero;
        this.grantHeroXp(h, xpGain);
        h.fatigue = Math.min(100, (h.fatigue ?? 40) + 35);

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
        this.sendHeroToZone(
          h,
          h.status === 'injured' && this.hasAffordableHealingPotion(h)
            ? 'potion'
            : 'room',
          '던전 후퇴 귀환! 치료와 휴식을 위해 이동 중'
        );
        if (idx === 0) {
          this.triggerHeroSpeech(h, 'returned_fail', true);
        }
      });

      this.addLog(
        `💥 [${dungeon.name}] ${exp.currentFloor ?? 2}층에서 후퇴 (${preview.heroNames.join(
          '·'
        )}) — ${
          injuredHeroNames.length > 0
            ? `부상: ${injuredHeroNames.join(', ')} (객실/포션 치료 이동)`
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
      reachedFloor: exp.currentFloor ?? exp.totalFloors ?? 3,
      totalFloors: exp.totalFloors ?? 3,
      floorLogs: exp.floorLogs ? [...exp.floorLogs] : [],
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
      buyEnabled: boolean;
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
      buyEnabled: boolean;
    }[] = [];
    let totalCost = 0;
    let totalCount = 0;

    for (const h of this.getUnlockedHeroes()) {
      const roster = HERO_ROSTER_MAP[h.id];
      for (const stack of h.lootBag) {
        if (stack.count <= 0) continue;
        const mat = MATERIAL_MAP[stack.materialId];
        if (!mat) continue;
        const unitPrice = this.getEffectiveMaterialBuyPrice(mat.id);
        const buyEnabled = this.shopConfig.lootBuyEnabled[mat.id] !== false;
        const cost = stack.count * unitPrice;
        if (buyEnabled) {
          totalCost += cost;
        }
        totalCount += stack.count;
        items.push({
          heroId: h.id,
          heroName: roster.name,
          materialId: mat.id,
          materialName: mat.name,
          icon: mat.icon,
          rarity: mat.rarity,
          count: stack.count,
          unitPrice,
          totalPrice: cost,
          ageSeconds: stack.ageSeconds,
          buyEnabled,
        });
      }
    }

    return { items, totalCost, totalCount };
  }

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

    const unitPrice = this.getEffectiveMaterialBuyPrice(materialId);
    const affordable = Math.floor(this.gold / unitPrice);
    if (affordable <= 0) return 0;

    const buyCount = Math.min(
      stack.count,
      affordable,
      maxCount ?? stack.count
    );
    if (buyCount <= 0) return 0;

    const totalCost = buyCount * unitPrice;
    this.gold -= totalCost;
    hero.gold += totalCost;
    this.materials[materialId] = (this.materials[materialId] ?? 0) + buyCount;
    stack.count -= buyCount;

    hero.lootBag = hero.lootBag.filter((s) => s.count > 0);
    this.setHeroInteractionEffect(hero, '💎', `+${totalCost}G`, '#ebd186');
    this.triggerHeroSpeech(hero, 'loot_sold');
    this.onUiUpdate();
    return buyCount;
  }

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
        if (this.shopConfig.lootBuyEnabled[mat.id] === false) continue;
        const unitPrice = this.getEffectiveMaterialBuyPrice(mat.id);
        const availGold = Math.max(0, this.gold - reserveGold);
        const canBuy = Math.min(stack.count, Math.floor(availGold / unitPrice));
        if (canBuy > 0) {
          const cost = canBuy * unitPrice;
          this.gold -= cost;
          h.gold += cost;
          this.materials[mat.id] = (this.materials[mat.id] ?? 0) + canBuy;
          stack.count -= canBuy;
          boughtCount += canBuy;
          spentGold += cost;
          this.setHeroInteractionEffect(h, '💎', `+${cost}G`, '#ebd186');
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

  public treatHeroMeal(heroId: string, mealUpgradeId?: string): boolean {
    const hero = this.heroes[heroId];
    if (!hero || !hero.unlocked) return false;

    const meals = this.getUnlockedMeals();
    const chosenOpt = mealUpgradeId
      ? meals.find((m) => m.upgradeId === mealUpgradeId) ??
        meals[meals.length - 1]
      : meals[meals.length - 1];

    const { option, price, buff } = this.getMealEffectiveBuff(
      chosenOpt.upgradeId
    );
    const treatCost = Math.max(4, Math.floor(price * 0.7));
    if (this.gold < treatCost) return false;

    this.gold -= treatCost;
    hero.hunger = 0;
    this.applyBuffAndHealToHero(hero, buff, option.hpRestorePct, false, true);
    this.setHeroInteractionEffect(hero, option.icon, '대접!', '#7eb38a');
    this.triggerHeroSpeech(hero, 'eating', true);

    const roster = HERO_ROSTER_MAP[hero.id];
    this.addLog(
      `🍲 [${roster.name}]에게 〈${option.name}〉을(를) 대접했습니다! (허기 해소 & 다음 탐험 버프)`,
      'normal'
    );
    this.onUiUpdate();
    return true;
  }

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
    hero.fatigue = 0;
    this.totalHeroesHealed += 1;

    const roomBonus = Math.min(
      0.25,
      0.08 + (this.getRoomRecoveryBonus() - 1) * 0.06
    );
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

    this.setHeroInteractionEffect(hero, '🛏️', '특실 회복!', '#7eb38a');
    this.triggerHeroSpeech(hero, 'healed', true);

    const roster = HERO_ROSTER_MAP[hero.id];
    this.addLog(
      `🛏️ [${roster.name}]이(가) 여관 객실에서 푹 쉬고 부상·피로를 완벽히 회복했습니다!`,
      'normal'
    );
    this.onUiUpdate();
    return true;
  }

  public givePotionToHero(
    heroId: string,
    potionId: string,
    paidByHero = false
  ): boolean {
    const hero = this.heroes[heroId];
    const recipe = POTION_RECIPE_MAP[potionId];
    if (!hero || !hero.unlocked || !recipe) return false;
    if ((this.potionStock[potionId] ?? 0) <= 0) return false;

    const effPrice = this.getEffectivePotionSellPrice(potionId);
    if (paidByHero) {
      if (hero.gold < effPrice) return false;
      hero.gold -= effPrice;
      this.addGold(effPrice);
      this.totalHeroShopTransactions += 1;
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

    this.setHeroInteractionEffect(hero, recipe.icon, '포션!', '#78b2bf');
    this.triggerHeroSpeech(hero, 'potion_bought');

    const roster = HERO_ROSTER_MAP[hero.id];
    if (paidByHero) {
      this.addLog(
        `🧪 [${roster.name}]이(가) 포션 가게에서 〈${recipe.name}〉을(를) 구매했습니다! (+${formatGold(
          effPrice
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
      hero.fatigue = Math.max(0, (hero.fatigue ?? 30) - 40);
      this.totalHeroesHealed += 1;
    } else if (healsFatigue && hero.status === 'fatigued') {
      hero.status = 'idle';
      hero.restTimerSec = 0;
      hero.currentHp = bd.totalStats.hp;
      hero.fatigue = 0;
      this.totalHeroesHealed += 1;
    }
  }

  private updateHeroesRestAndLootAge(dt: number): void {
    for (const h of this.getUnlockedHeroes()) {
      // 1. 휴식 타이머 진행
      if (h.status === 'injured' || h.status === 'fatigued') {
        if (h.status === 'injured') {
          for (const pId of [
            'potion_cure_injury',
            'potion_ironblood',
            'potion_wisdom',
            'potion_dragon_elixir',
          ]) {
            if (this.shopConfig.potionSaleEnabled[pId] === false) continue;
            const rec = POTION_RECIPE_MAP[pId];
            const effPrice = this.getEffectivePotionSellPrice(pId);
            if (
              rec &&
              (this.potionStock[pId] ?? 0) > 0 &&
              h.gold >= effPrice
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
            h.fatigue = 0;
            this.totalHeroesHealed += 1;
            const bd = getHeroStatBreakdown(h);
            h.currentHp = bd.totalStats.hp;

            const roomFee = Math.min(
              h.gold,
              Math.round(6 * this.getRoomRecoveryBonus())
            );
            if (roomFee > 0) {
              h.gold -= roomFee;
              this.addGold(roomFee);
              this.totalHeroShopTransactions += 1;
            }
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

  public heroAutoPrepareForExpedition(hero: HeroState): void {
    if (!hero.unlocked || hero.status !== 'idle') return;

    if (this.shopConfig.blacksmithSaleEnabled) {
      this.heroTryBuyBetterEquipment(hero);
    }

    const hasFoodBuff = hero.buffs.some((b) => b.source === 'food');
    if (this.shopConfig.mealSaleEnabled && !hasFoodBuff && hero.gold >= 8) {
      const meals = this.getUnlockedMeals();
      for (let i = meals.length - 1; i >= 0; i--) {
        const { option, buff } = this.getMealEffectiveBuff(meals[i].upgradeId);
        const effPrice = this.getEffectiveMealPrice(meals[i].upgradeId);
        if (hero.gold >= effPrice) {
          hero.gold -= effPrice;
          this.addGold(effPrice);
          hero.hunger = 0;
          this.totalHeroShopTransactions += 1;
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
        if (this.shopConfig.potionSaleEnabled[pId] === false) continue;
        const rec = POTION_RECIPE_MAP[pId];
        const effPrice = this.getEffectivePotionSellPrice(pId);
        if (
          rec &&
          (this.potionStock[pId] ?? 0) > 0 &&
          hero.gold >= effPrice
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
        const effPrice = this.getEffectiveEquipSellPrice(def.id);
        if (hero.gold < effPrice) continue;

        const score = getEquipmentScoreForClass(roster.classId, cand);
        if (score > bestScore + 1) {
          bestScore = score;
          bestIdx = idx;
        }
      }

      if (bestIdx >= 0) {
        const chosen = this.equipmentStock.splice(bestIdx, 1)[0];
        const def = EQUIPMENT_DEF_MAP[chosen.defId];
        const effPrice = this.getEffectiveEquipSellPrice(def.id);
        hero.gold -= effPrice;
        this.addGold(effPrice);

        const oldDef = EQUIPMENT_DEF_MAP[currentInst.defId];
        if (oldDef && !oldDef.isBase) {
          this.equipmentStock.push(currentInst);
        }
        hero.equipment[slot] = chosen;
        boughtAny = true;

        this.addLog(
          `⚒️ [${roster.name}]이(가) 대장간에서 〈${def.name}${
            chosen.enhanceLevel > 0 ? ` +${chosen.enhanceLevel}` : ''
          }〉을(를) 구매·장착했습니다! (+${formatGold(effPrice)}G)`,
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
        this.materials['mat_iron_scrap'] =
          (this.materials['mat_iron_scrap'] ?? 0) + 1;
        this.addLog(
          `💨 〈${def.name}〉 단조에 실패하여 고철 파편 1개만 회수했습니다.`,
          'normal'
        );
      }
    }
  }

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

    this.setHeroInteractionEffect(hero, def.icon, '장착!', '#e6c274');
    this.triggerHeroSpeech(hero, 'equip_bought');

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
  // +강화 시스템 (실패 시 장비 완전 파괴 & 기본 장비 즉시 복귀)
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
      if (!def || def.isBase) return null;
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

      if (target.heroId && this.heroes[target.heroId]) {
        const h = this.heroes[target.heroId];
        this.setHeroInteractionEffect(
          h,
          '✨',
          `+${inst.enhanceLevel} 성공!`,
          '#ebd186'
        );
        this.triggerHeroSpeech(h, 'enhance_success', true);
      }

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
      this.totalEnhanceDestroyed += 1;

      if (target.heroId && target.slot) {
        const hero = this.heroes[target.heroId];
        const roster = HERO_ROSTER_MAP[hero.id];
        hero.equipment[target.slot] = this.createBaseEquipForClass(
          roster.classId,
          target.slot
        );
        this.setHeroInteractionEffect(hero, '💥', '장비 파괴..', '#c7635b');
        this.triggerHeroSpeech(hero, 'enhance_fail', true);
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
      this.innkeeperWaveTimer = Math.max(
        0,
        this.innkeeperWaveTimer - clampedDt
      );
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

    // 8. 살아있는 여관 영웅 에이전트 타일 이동 및 구역 상호작용 업데이트
    this.updateHeroAgents(clampedDt);

    // 9. 약초 정원 자동 수확
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

    // 10. 2초마다 보조 체크 (자동 매입/소비/자동 파견 백업)
    this.heroAiTimer += clampedDt;
    if (this.heroAiTimer >= 2.0) {
      this.heroAiTimer = 0;
      if (this.autoBuyLoot) {
        this.buyAllHeroLoot(this.shopConfig.lootReserveGold);
      }
      for (const h of this.getUnlockedHeroes()) {
        if (h.status === 'idle' && !h.expeditionId) {
          this.heroAutoPrepareForExpedition(h);
        }
      }
      if (this.autoDispatch && this.expeditions.length === 0) {
        this.tryAutoDispatch();
      }
    }

    // 11. 파티클 & 플로팅 텍스트 업데이트
    this.updateParticlesAndTexts(clampedDt);

    // 12. 5초마다 자동 저장
    this.saveTimer += clampedDt;
    if (this.saveTimer >= 5.0) {
      this.saveTimer = 0;
      this.saveToStorage();
    }
  }

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

    const destX = targetGuest ? targetGuest.x - 10 : 112;
    const destY = targetGuest ? targetGuest.y + 2 : 150;

    const dx = destX - this.maidPos.x;
    const dy = destY - this.maidPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 2) {
      const speed = 58;
      this.maidPos.x += (dx / dist) * speed * dt;
      this.maidPos.y += (dy / dist) * speed * dt;
      this.maidPos.facing = dx >= 0 ? 'right' : 'left';
    }
  }

  private updateGuests(dt: number): void {
    const walkSpeed = 76;
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
          g.targetY = 188;
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
      y: isFirstGuest ? 178 : 186 + (this.random() * 8 - 4),
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
      '#ebd186'
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
        '#d68a54'
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

  /**
   * 여관 캔버스 클릭/탭:
   * 1) 맵 위의 영웅을 탭하면 해당 영웅을 선택하여 상태/지시 패널을 엶
   * 2) 대기 중인 방문 손님을 탭하면 즉시 서빙
   * 3) 특정 구역(포션가게/대장간/거래소/게시판 등)을 탭하면 해당 탭 전환 콜백 호출 및 팁 획득
   */
  public handleCanvasTap(canvasX: number, canvasY: number): void {
    // 1. 여관 내 영웅 클릭 감지
    let closestHero: HeroState | null = null;
    let minHeroDist = 20;
    for (const h of this.getUnlockedHeroes()) {
      if (h.status === 'exploring') continue;
      const hx = h.x ?? 0;
      const hy = (h.y ?? 0) - 8;
      const dist = Math.hypot(hx - canvasX, hy - canvasY);
      if (dist < minHeroDist) {
        minHeroDist = dist;
        closestHero = h;
      }
    }

    if (closestHero) {
      this.selectedHeroId = closestHero.id;
      this.sound.playCoin();
      this.onUiUpdate();
      return;
    }

    // 2. 대기 중인 일반 방문 손님 서빙
    let closestWaiting: GuestEntity | null = null;
    let minWaitDist = 28;
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

    // 3. 특정 구역 표지판/시설 클릭 감지
    const tappedZone = detectZoneAtPixel(canvasX, canvasY);
    if (tappedZone && this.onZoneTapped) {
      this.onZoneTapped(tappedZone);
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
      Math.max(8, Math.min(MAP_WIDTH - 48, canvasX - 12)),
      Math.max(14, canvasY - 6),
      `+${formatGold(tipGold)}G`,
      '#ebd186'
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
    this.spawnCoins(210, 56, 5);
    this.spawnFloatingText(
      194,
      42,
      `+${formatGold(tipGold)}G 호객!`,
      '#ebd186'
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
        '#ebd186'
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
    const colors = ['#ebd186', '#e6c274', '#d68a54', '#f6efe2'];
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
    const unlocked = this.getUnlockedHeroes();
    const heroEntities: HeroCanvasEntity[] = unlocked.map((h, idx) => {
      this.ensureHeroAgentFields(h, idx);
      const roster = HERO_ROSTER_MAP[h.id];
      const bd = getHeroStatBreakdown(h);
      const hpPct = Math.max(
        0,
        Math.min(1, h.currentHp / Math.max(1, bd.totalStats.hp))
      );

      return {
        heroId: h.id,
        name: roster.name,
        status: h.status,
        activity: h.activity ?? 'idle',
        x: h.x ?? 240,
        y: h.y ?? 180,
        facing: h.facing ?? 'right',
        hpPct,
        speechText:
          (h.speechTimer ?? 0) > 0 && h.speechText ? h.speechText : null,
        isSelected: this.selectedHeroId === h.id,
        hasPlayerOrder: Boolean(h.playerOrder),
        interactionEffect: h.interactionEffect ?? null,
      };
    });

    const pendingLoot = this.getPendingLootSummary();
    const potionStockTotal = Object.values(this.potionStock).reduce(
      (a, b) => a + b,
      0
    );

    return {
      time: this.elapsedTime,
      guests: this.guests,
      floatingTexts: this.floatingTexts,
      particles: this.particles,
      upgrades: this.upgrades,
      potionTools: this.potionTools,
      blacksmithTools: this.blacksmithTools,
      heroEntities,
      selectedHeroId: this.selectedHeroId,
      activeEvent: this.activeEvent,
      maidPos: this.maidPos,
      innkeeperWaveTimer: this.innkeeperWaveTimer,
      expeditions: this.expeditions,
      focusedExpeditionId: this.focusedExpeditionId,
      lastExpeditionResult: this.recentExpeditionResults[0] ?? null,
      pendingLootCount: pendingLoot.totalCount,
      potionStockTotal,
      equipStockTotal: this.equipmentStock.length,
    };
  }
}
