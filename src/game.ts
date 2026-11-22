import { SoundManager } from './audio';
import {
  GUEST_TYPES,
  INN_LEVELS,
  OPTIONAL_QUESTS,
  RANDOM_EVENTS,
  SEAT_SLOTS,
  UPGRADES,
  getCurrentInnLevel,
  getNextInnLevel,
  getUpgradeCost,
} from './data';
import { formatGold } from './format';
import {
  CLASS_COMBAT_SKILLS,
  DUNGEON_ROOM_EVENTS,
  MAP_WIDTH,
  ROOM_TYPE_META,
  SpeechSituation,
  ZONE_LABELS,
  ZONE_SPOTS,
  createDungeonRoomGraph,
  createFloorMonsters,
  detectZoneAtPixel,
  findGridPath,
  generateCombatPersonalitySpeech,
  generateHeroSpeech,
  getDungeonTotalFloors,
  getPersonalitySpeechCooldownMultiplier,
  getPersonalityWalkSpeedMultiplier,
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
  PERSONALITIES,
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
  DailyFinancialReport,
  DayPhase,
  DungeonRoomNode,
  EnhanceAttemptResult,
  EquipSlot,
  EquipmentInstance,
  ExpenseCategory,
  ExpeditionFloorLog,
  ExpeditionResultSummary,
  FloatingText,
  GuestEntity,
  GuestTypeDef,
  HeroBuff,
  HeroPlayerOrder,
  HeroState,
  IncomeCategory,
  InnLevelDef,
  InnRankGoalCondition,
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
export const CURRENT_SAVE_VERSION = 4;
export const DAY_DURATION_SEC = 240; // 게임 내 하루 = 실시간 4분 (240초)
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
  simulatedDays: number;
  totalIncome: number;
  totalExpense: number;
  earnedGold: number; // 순이익 합계
  expeditionsCompleted: number;
  potionsCrafted: number;
  equipsCrafted: number;
  peddlerSales: number;
  injuredCount: number;
  heroShopTransactions: number;
  heroesHealedCount: number;
}

export interface RankGoalStatusItem {
  condition: InnRankGoalCondition;
  current: number;
  target: number;
  completed: boolean;
  pct: number;
}

export class DungeonInnGame {
  public gold = 45;
  public totalGoldEarned = 45;
  public reputation = 0;
  public innRank = 1;
  public totalServed = 0;
  public totalLootFound = 0;
  public upgrades: Record<string, number> = {};
  public discoveredGuests: Record<string, number> = {
    traveler: 1,
    warrior: 1,
  };
  public tutorialSeen = false;
  public migratedFromLegacy = false;
  public legacyVersionDetected: number | null = null;

  // 하루 주기 & 일일 장부 상태
  public dayNumber = 1;
  public dayTimeSec = 0;
  public currentDayLedger!: DailyFinancialReport;
  public dayHistory: DailyFinancialReport[] = [];
  public unpaidWages = 0;
  public maxDailyNetProfitReached = 0;
  public lastSettledDayReport: DailyFinancialReport | null = null;

  // 목표 및 선택 퀘스트 상태
  public completedQuests: Record<string, boolean> = {};
  public rankMilestones: Record<
    number,
    { timeSec: number; day: number; title: string }
  > = {
    1: { timeSec: 0, day: 1, title: INN_LEVELS[0].title },
  };

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

  // 영웅 상태/지시 패널은 기본적으로 닫혀 있으며(null), 영웅을 탭했을 때만 열림
  public selectedHeroId: string | null = null;
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
  private nextSkillEffectId = 1;
  private spawnTimer = 0.5;
  private autoServeTimer = 0;
  private autoEventTimer = 42;
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
  private onDaySettled?: (report: DailyFinancialReport) => void;

  constructor(
    onUiUpdate: () => void = () => {},
    onLevelUp: (newLevelTitle: string, rewardText: string) => void = () => {},
    customStorage?: StorageAdapter,
    onZoneTapped?: (
      zone: 'potion' | 'blacksmith' | 'trade' | 'dungeon' | 'menu' | 'room'
    ) => void,
    onDaySettled?: (report: DailyFinancialReport) => void
  ) {
    this.sound = new SoundManager(false);
    this.onUiUpdate = onUiUpdate;
    this.onLevelUp = onLevelUp;
    this.onZoneTapped = onZoneTapped;
    this.onDaySettled = onDaySettled;
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

  private createEmptyDailyLedger(day: number): DailyFinancialReport {
    const rankDef = this.getCurrentInnRankDef();
    return {
      day,
      income: {
        foodAndDrink: 0,
        guestServing: 0,
        roomAndRest: 0,
        potionSales: 0,
        blacksmithSales: 0,
        lootMargin: 0,
        totalIncome: 0,
      },
      expense: {
        wages: 0,
        upkeep: 0,
        craftCost: 0,
        lootPurchase: 0,
        facilityInvest: 0,
        totalOperatingExpense: 0,
        totalWithInvest: 0,
      },
      netProfit: 0,
      netCashFlow: 0,
      endGold: Math.floor(this.gold),
      innRank: this.innRank,
      innRankTitle: rankDef.title,
      servedCount: 0,
      heroTransactions: 0,
      dungeonWins: 0,
      dungeonFails: 0,
      newHeroesJoined: [],
      injuredHeroes: [],
      wageArrears: this.unpaidWages,
    };
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
      lootReserveGold: 20,
      blacksmithSaleEnabled: true,
      blacksmithPriceMultiplier: 1.0,
      blacksmithAutoEnhanceEnabled: false,
    };
  }

  private initFreshState(): void {
    this.gold = 45;
    this.totalGoldEarned = 45;
    this.reputation = 0;
    this.innRank = 1;
    this.totalServed = 0;
    this.totalLootFound = 0;
    this.elapsedTime = 0;

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
    this.selectedHeroId = null;
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

    this.dayNumber = 1;
    this.dayTimeSec = 0;
    this.unpaidWages = 0;
    this.maxDailyNetProfitReached = 0;
    this.dayHistory = [];
    this.completedQuests = {};
    this.rankMilestones = {
      1: { timeSec: 0, day: 1, title: INN_LEVELS[0].title },
    };
    this.currentDayLedger = this.createEmptyDailyLedger(1);
    this.lastSettledDayReport = null;

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
        gold: isStarter ? 28 : 24,
        status: 'idle',
        restTimerSec: 0,
        expeditionId: null,
        equipment: equip,
        buffs: [],
        lootBag: [],
        totalRuns: 0,
        totalWins: 0,
        lastMealTimer: 0,
        hunger: isStarter ? 42 + (idx % 3) * 10 : 25,
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
        hesitateTimer: 0,
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
      hero.fatigue =
        hero.status === 'fatigued' ? 75 : hero.status === 'injured' ? 85 : 12;
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
    if (typeof hero.hesitateTimer !== 'number') hero.hesitateTimer = 0;
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
  // 하루 주기(Day Cycle) · 수입/지출 장부 기록 · 급료 및 유지비 정산
  // ==========================================================================

  public getDayProgressRatio(): number {
    return Math.max(0, Math.min(1, this.dayTimeSec / DAY_DURATION_SEC));
  }

  public getDayPhase(): DayPhase {
    const r = this.getDayProgressRatio();
    if (r < 0.22) return 'morning';
    if (r < 0.58) return 'day';
    if (r < 0.78) return 'evening';
    return 'night';
  }

  public getDayPhaseLabel(): { icon: string; label: string; clockText: string } {
    const r = this.getDayProgressRatio();
    // 06:00부터 다음날 06:00까지 24시간 매핑
    const totalMinutes = Math.floor(r * 24 * 60) + 6 * 60;
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = Math.floor((totalMinutes % 60) / 10) * 10;
    const clockText = `${String(hh).padStart(2, '0')}:${String(mm).padStart(
      2,
      '0'
    )}`;

    const phase = this.getDayPhase();
    const map: Record<DayPhase, { icon: string; label: string }> = {
      morning: { icon: '🌅', label: '아침' },
      day: { icon: '☀️', label: '낮' },
      evening: { icon: '🌆', label: '저녁' },
      night: { icon: '🌙', label: '밤' },
    };
    return { ...map[phase], clockText };
  }

  public recordIncome(category: IncomeCategory, amount: number): void {
    const rounded = Math.round(amount);
    if (rounded <= 0) return;
    this.addGold(rounded);
    if (!this.currentDayLedger) {
      this.currentDayLedger = this.createEmptyDailyLedger(this.dayNumber);
    }
    this.currentDayLedger.income[category] += rounded;
    this.currentDayLedger.income.totalIncome += rounded;
    this.recomputeCurrentDayNetProfit();
  }

  public recordExpense(category: ExpenseCategory, amount: number): void {
    const rounded = Math.round(amount);
    if (rounded <= 0) return;
    if (!this.currentDayLedger) {
      this.currentDayLedger = this.createEmptyDailyLedger(this.dayNumber);
    }
    this.currentDayLedger.expense[category] += rounded;
    if (category !== 'facilityInvest') {
      this.currentDayLedger.expense.totalOperatingExpense += rounded;
    }
    this.currentDayLedger.expense.totalWithInvest += rounded;
    this.recomputeCurrentDayNetProfit();
  }

  private recomputeCurrentDayNetProfit(): void {
    if (!this.currentDayLedger) return;
    this.currentDayLedger.netProfit =
      this.currentDayLedger.income.totalIncome -
      this.currentDayLedger.expense.totalOperatingExpense;
    this.currentDayLedger.netCashFlow =
      this.currentDayLedger.income.totalIncome -
      this.currentDayLedger.expense.totalWithInvest;
    this.currentDayLedger.endGold = Math.floor(this.gold);
    if (this.currentDayLedger.netProfit > this.maxDailyNetProfitReached) {
      this.maxDailyNetProfitReached = this.currentDayLedger.netProfit;
    }
  }

  /**
   * 고용된 직원별 일당/급료 상세 내역
   */
  public getDailyWagesBreakdown(): {
    items: { id: string; name: string; icon: string; level: number; wage: number }[];
    totalWages: number;
  } {
    const items: {
      id: string;
      name: string;
      icon: string;
      level: number;
      wage: number;
    }[] = [];
    let totalWages = 0;

    for (const u of UPGRADES) {
      if (u.category === 'staff' && u.dailyWagePerLevel) {
        const lv = this.upgrades[u.id] ?? 0;
        if (lv > 0) {
          const wage = lv * u.dailyWagePerLevel;
          totalWages += wage;
          items.push({
            id: u.id,
            name: u.name,
            icon: u.icon,
            level: lv,
            wage,
          });
        }
      }
    }

    for (const pt of POTION_TOOLS) {
      if (pt.kind === 'staff' && pt.dailyWagePerLevel) {
        const lv = this.potionTools[pt.id] ?? 0;
        if (lv > 0) {
          const wage = lv * pt.dailyWagePerLevel;
          totalWages += wage;
          items.push({
            id: pt.id,
            name: pt.name,
            icon: pt.icon,
            level: lv,
            wage,
          });
        }
      }
    }

    for (const bt of BLACKSMITH_TOOLS) {
      if (bt.kind === 'staff' && bt.dailyWagePerLevel) {
        const lv = this.blacksmithTools[bt.id] ?? 0;
        if (lv > 0) {
          const wage = lv * bt.dailyWagePerLevel;
          totalWages += wage;
          items.push({
            id: bt.id,
            name: bt.name,
            icon: bt.icon,
            level: lv,
            wage,
          });
        }
      }
    }

    return { items, totalWages };
  }

  /**
   * 일일 기본 유지비 (화덕 연료, 기본 식자재, 객실 침구 및 시설 유지)
   */
  public getDailyUpkeepCost(): number {
    let upkeep = 6; // 여관 기본 촛불·화덕 연료비
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.dailyUpkeepPerLevel) {
        upkeep += lv * u.dailyUpkeepPerLevel;
      }
    }
    return upkeep;
  }

  public getStaffEfficiencyMultiplier(): number {
    return this.unpaidWages > 0 ? 0.7 : 1.0;
  }

  /**
   * 하루가 끝났을 때 호출되어 급료·유지비를 정산하고 일일 결산 리포트를 확정합니다.
   */
  public settleEndOfDay(): DailyFinancialReport {
    const { totalWages } = this.getDailyWagesBreakdown();
    const upkeep = this.getDailyUpkeepCost();

    // 1. 유지비 및 급료 지출 기록
    this.recordExpense('upkeep', upkeep);
    this.recordExpense('wages', totalWages);

    const totalNeed = upkeep + totalWages + this.unpaidWages;
    if (this.gold >= totalNeed) {
      this.gold -= totalNeed;
      if (this.unpaidWages > 0) {
        this.addLog(
          `✅ 밀린 직원 급료(${formatGold(this.unpaidWages)}G)를 모두 상환하여 직원 효율이 100%로 정상화되었습니다!`,
          'unlock'
        );
      }
      this.unpaidWages = 0;
    } else {
      // 파산·교착 방지: 보유 골드 한도 내에서만 차감하고 나머지는 체불(미지급금)로 이월, 기본 영업은 계속 유지!
      const paid = Math.floor(this.gold);
      this.gold = 0;
      const shortfall = Math.max(0, totalNeed - paid);
      const maxCap = Math.max(40, (totalWages + upkeep) * 3);
      this.unpaidWages = Math.min(maxCap, shortfall);
      this.addLog(
        `⚠️ [${this.dayNumber}일차 결산] 골드가 부족해 급료·유지비 중 ${formatGold(
          this.unpaidWages
        )}G가 체불되었습니다. (직원 효율 70%, 기본 수프·침대 영업은 계속됩니다)`,
        'event'
      );
    }

    this.recomputeCurrentDayNetProfit();
    const rankDef = this.getCurrentInnRankDef();
    this.currentDayLedger.innRank = this.innRank;
    this.currentDayLedger.innRankTitle = rankDef.title;
    this.currentDayLedger.endGold = Math.floor(this.gold);
    this.currentDayLedger.wageArrears = this.unpaidWages;

    const settledReport: DailyFinancialReport = JSON.parse(
      JSON.stringify(this.currentDayLedger)
    );
    this.dayHistory.push(settledReport);
    if (this.dayHistory.length > 30) {
      this.dayHistory.shift();
    }
    this.lastSettledDayReport = settledReport;

    const sign = settledReport.netProfit >= 0 ? '+' : '';
    this.addLog(
      `📊 [${settledReport.day}일차 일일 결산] 수입 +${formatGold(
        settledReport.income.totalIncome
      )}G | 운영지출 -${formatGold(
        settledReport.expense.totalOperatingExpense
      )}G (급료 ${settledReport.expense.wages}G·유지비 ${
        settledReport.expense.upkeep
      }G·매입 ${settledReport.expense.lootPurchase}G) | 순이익 ${sign}${formatGold(
        settledReport.netProfit
      )}G`,
      settledReport.netProfit >= 0 ? 'loot' : 'event'
    );

    this.checkOptionalQuests();
    this.checkInnRankProgression();

    // 다음 날 시작
    this.dayNumber += 1;
    this.dayTimeSec = 0;
    this.currentDayLedger = this.createEmptyDailyLedger(this.dayNumber);

    this.onDaySettled?.(settledReport);
    this.onUiUpdate();
    return settledReport;
  }

  // ==========================================================================
  // 여관 등급(Inn Rank) 목표 평가 및 선택 퀘스트/업적 체크
  // ==========================================================================

  public getCurrentInnRankDef(): InnLevelDef {
    return getCurrentInnLevel(this.innRank, true);
  }

  public getNextInnRankDef(): InnLevelDef | null {
    return getNextInnLevel(this.innRank, true);
  }

  public getTotalNonStaffUpgradeLevels(): number {
    let sum = 0;
    for (const u of UPGRADES) {
      if (u.category !== 'staff') {
        sum += this.upgrades[u.id] ?? 0;
      }
    }
    return sum;
  }

  public getTotalStaffLevels(): number {
    let sum =
      (this.upgrades['staff_maid'] ?? 0) +
      (this.upgrades['staff_bartender'] ?? 0) +
      (this.upgrades['staff_chef'] ?? 0) +
      (this.upgrades['staff_bard'] ?? 0) +
      (this.potionTools['pot_fac_circle'] ?? 0) +
      (this.blacksmithTools['smith_master'] ?? 0);
    return sum;
  }

  public evaluateGoalCondition(cond: InnRankGoalCondition): RankGoalStatusItem {
    let current = 0;
    switch (cond.kind) {
      case 'reputation':
        current = this.reputation;
        break;
      case 'dungeon_clear':
        current = cond.dungeonId
          ? this.dungeonClears[cond.dungeonId] ?? 0
          : Object.values(this.dungeonClears).reduce((a, b) => a + b, 0);
        break;
      case 'hero_count':
        current = this.getUnlockedHeroCount();
        break;
      case 'upgrade_total_levels':
        current = this.getTotalNonStaffUpgradeLevels();
        break;
      case 'staff_total_levels':
        current = this.getTotalStaffLevels();
        break;
      case 'daily_net_profit':
        current = Math.max(
          this.maxDailyNetProfitReached,
          this.currentDayLedger?.netProfit ?? 0
        );
        break;
      case 'potions_crafted':
        current = this.totalPotionsCrafted;
        break;
      case 'equips_crafted':
        current = this.totalEquipCrafted;
        break;
      case 'enhance_success':
        current = this.totalEnhanceSuccess;
        break;
    }
    const completed = current >= cond.target;
    const pct = Math.max(
      0,
      Math.min(100, (Math.max(0, current) / Math.max(1, cond.target)) * 100)
    );
    return {
      condition: cond,
      current,
      target: cond.target,
      completed,
      pct,
    };
  }

  public getNextRankGoalsProgress(): {
    nextRank: InnLevelDef | null;
    items: RankGoalStatusItem[];
    overallPct: number;
    completedCount: number;
  } {
    const nextRank = this.getNextInnRankDef();
    if (!nextRank) {
      return {
        nextRank: null,
        items: [],
        overallPct: 100,
        completedCount: 0,
      };
    }
    const items = nextRank.goals.map((g) => this.evaluateGoalCondition(g));
    const completedCount = items.filter((i) => i.completed).length;
    const overallPct =
      items.length > 0
        ? items.reduce((acc, it) => acc + it.pct, 0) / items.length
        : 100;
    return {
      nextRank,
      items,
      overallPct,
      completedCount,
    };
  }

  public checkInnRankProgression(): boolean {
    let promoted = false;
    while (true) {
      const { nextRank, items } = this.getNextRankGoalsProgress();
      if (!nextRank || items.length === 0) break;
      if (items.every((it) => it.completed)) {
        this.innRank = nextRank.level;
        promoted = true;

        if (!this.rankMilestones[nextRank.level]) {
          this.rankMilestones[nextRank.level] = {
            timeSec: Math.floor(this.elapsedTime),
            day: this.dayNumber,
            title: nextRank.title,
          };
        }

        if (nextRank.rewardGold > 0) {
          this.recordIncome('lootMargin', nextRank.rewardGold);
        }

        this.sound.playLevelUp();
        this.addLog(
          `🎊 [여관 등급 승급!] 모든 목표를 달성하여 [${nextRank.title}](으)로 승급했습니다! (${nextRank.rewardText})`,
          'unlock'
        );
        this.spawnFloatingText(
          CANVAS_WIDTH / 2 - 48,
          50,
          `★ 승급: ${nextRank.title}!`,
          '#ebd186'
        );
        this.onLevelUp(nextRank.title, nextRank.rewardText);
      } else {
        break;
      }
    }
    return promoted;
  }

  public checkOptionalQuests(): void {
    for (const q of OPTIONAL_QUESTS) {
      if (this.completedQuests[q.id]) continue;
      let done = false;
      switch (q.id) {
        case 'q_first_meal':
          done = this.totalServed + this.totalHeroShopTransactions >= 3;
          break;
        case 'q_first_slime':
          done = (this.dungeonClears['dungeon_slime'] ?? 0) >= 1;
          break;
        case 'q_first_potion':
          done =
            this.totalPotionsCrafted >= 1 ||
            (this.currentDayLedger?.income.potionSales ?? 0) > 0;
          break;
        case 'q_first_craft_equip':
          done = this.totalEquipCrafted >= 1;
          break;
        case 'q_first_enhance':
          done = this.totalEnhanceSuccess >= 1;
          break;
        case 'q_first_profit_day':
          done = this.dayHistory.some((d) => d.netProfit > 0);
          break;
        case 'q_heroes_12':
          done = this.getUnlockedHeroCount() >= 12;
          break;
        case 'q_legendary_craft':
          done =
            (this.craftedByRarity['legendary']?.count ?? 0) >= 1 ||
            (this.craftedByPotionId['potion_dragon_elixir'] ?? 0) >= 1;
          break;
        case 'q_dragon_slayer':
          done = (this.dungeonClears['dungeon_dragon_lair'] ?? 0) >= 1;
          break;
      }

      if (done) {
        this.completedQuests[q.id] = true;
        this.recordIncome('lootMargin', q.rewardGold);
        this.addReputation(q.rewardRep);
        this.addLog(
          `🏅 [업적 달성: ${q.icon} ${q.title}] 보상 +${q.rewardGold}G, 평판 +${q.rewardRep}!`,
          'unlock'
        );
        this.spawnFloatingText(
          CANVAS_WIDTH / 2 - 42,
          68,
          `🏅 ${q.title} (+${q.rewardGold}G)`,
          '#7eb38a'
        );
      }
    }
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
    return Math.max(
      2,
      Math.round(rec.sellPriceToHero * mult * this.getGlobalGoldMultiplier())
    );
  }

  public getEffectiveMealPrice(mealUpgradeId: string): number {
    const base = this.getMealEffectiveBuff(mealUpgradeId).price;
    const mult = this.shopConfig?.mealPriceMultiplier ?? 1.0;
    return Math.max(
      2,
      Math.round(base * mult * this.getGlobalGoldMultiplier())
    );
  }

  public getEffectiveEquipSellPrice(equipDefId: string): number {
    const def = EQUIPMENT_DEF_MAP[equipDefId];
    if (!def) return 20;
    const mult = this.shopConfig?.blacksmithPriceMultiplier ?? 1.0;
    return Math.max(
      5,
      Math.round(def.buyPriceGold * mult * this.getGlobalGoldMultiplier())
    );
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
    const cdMult = getPersonalitySpeechCooldownMultiplier(roster.personalities);
    hero.speechCooldown = (force ? 1.8 : 5.0 + this.random() * 3.0) * cdMult;
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
        state.gold = Math.max(state.gold, 28 + this.getUnlockedHeroCount() * 6);
        const entryPx = tileToPixel(2, 11);
        state.tileX = 2;
        state.tileY = 11;
        state.x = entryPx.x;
        state.y = entryPx.y;
        this.sendHeroToZone(state, 'board', '여관 합류! 의뢰 게시판으로 이동 중');
        this.triggerHeroSpeech(state, 'pre_dungeon', true);

        newlyJoined.push(def.id);
        if (
          this.currentDayLedger &&
          !this.currentDayLedger.newHeroesJoined.includes(def.name)
        ) {
          this.currentDayLedger.newHeroesJoined.push(def.name);
        }

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
    if (newlyJoined.length > 0) {
      this.checkOptionalQuests();
      this.checkInnRankProgression();
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
   * 저장 데이터를 불러오고 v1~v3 → v4 마이그레이션 감지 및 날짜 단위 오프라인 요약 정산 결과를 반환합니다.
   */
  public loadFromStorage(): OfflineReport | null {
    try {
      const raw = this.storage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        this.addLog(
          '던전 입구 옆 여관의 문을 열었습니다! 골드는 영웅과 손님의 식사·숙박·쇼핑 행동에서만 획득하며, 하루(4분)마다 일일 결산이 진행됩니다.',
          'normal'
        );
        this.spawnGuest();
        return null;
      }

      const data = JSON.parse(raw) as Partial<SaveData>;
      const isLegacy =
        !data.version || data.version < CURRENT_SAVE_VERSION || !data.heroes;

      if (typeof data.gold === 'number' && Number.isFinite(data.gold)) {
        this.gold = Math.max(0, Math.floor(data.gold));
      }
      if (
        typeof data.totalGoldEarned === 'number' &&
        Number.isFinite(data.totalGoldEarned)
      ) {
        this.totalGoldEarned = Math.max(this.gold, Math.floor(data.totalGoldEarned));
      }
      if (
        typeof data.reputation === 'number' &&
        Number.isFinite(data.reputation)
      ) {
        this.reputation = Math.max(0, Math.floor(data.reputation));
      }
      if (typeof data.innRank === 'number' && data.innRank >= 1) {
        this.innRank = Math.min(INN_LEVELS.length, Math.floor(data.innRank));
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

      // v4 하루 장부 & 등급 데이터 복원
      if (typeof data.dayNumber === 'number' && data.dayNumber >= 1) {
        this.dayNumber = Math.floor(data.dayNumber);
      }
      if (typeof data.dayTimeSec === 'number' && data.dayTimeSec >= 0) {
        this.dayTimeSec = Math.min(DAY_DURATION_SEC - 1, data.dayTimeSec);
      }
      if (typeof data.unpaidWages === 'number' && data.unpaidWages >= 0) {
        this.unpaidWages = Math.floor(data.unpaidWages);
      }
      if (
        typeof data.maxDailyNetProfitReached === 'number' &&
        Number.isFinite(data.maxDailyNetProfitReached)
      ) {
        this.maxDailyNetProfitReached = data.maxDailyNetProfitReached;
      }
      if (Array.isArray(data.dayHistory)) {
        this.dayHistory = data.dayHistory.slice(-30);
      }
      if (data.currentDayLedger && typeof data.currentDayLedger === 'object') {
        this.currentDayLedger = {
          ...this.createEmptyDailyLedger(this.dayNumber),
          ...data.currentDayLedger,
        };
      } else {
        this.currentDayLedger = this.createEmptyDailyLedger(this.dayNumber);
      }
      if (data.completedQuests && typeof data.completedQuests === 'object') {
        this.completedQuests = { ...data.completedQuests };
      }

      if (isLegacy) {
        // v1~v3 구버전 세이브 감지: GPS 필드 무시, 하루 장부는 빈 값으로 초기화, 모달에서 이어받기/새로 시작 선택 안내
        this.migratedFromLegacy = true;
        this.legacyVersionDetected = data.version ?? 1;
        this.gold = Math.max(45, Math.min(25000, Math.floor(this.gold)));
        this.dayNumber = 1;
        this.dayTimeSec = 0;
        this.dayHistory = [];
        this.unpaidWages = 0;
        this.currentDayLedger = this.createEmptyDailyLedger(1);
        this.checkHeroUnlocks();
        this.checkInnRankProgression();
        this.saveToStorage();
        this.addLog(
          `🔄 v${this.legacyVersionDetected} 세이브를 감지하여 v4 하루 경제 & 등급 목표 시스템으로 변환했습니다. (초당 자동 골드가 제거되었으므로 새로 시작을 권장합니다)`,
          'unlock'
        );
        return null;
      }

      this.checkHeroUnlocks();
      this.checkInnRankProgression();

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

      if (elapsedSec >= 30) {
        const cappedSec = Math.min(MAX_OFFLINE_SECONDS, elapsedSec);
        const report = this.settleOfflineProgress(elapsedSec, cappedSec);
        this.saveToStorage();
        return report;
      }

      this.addLog(
        `여관 ${this.dayNumber}일차 장부를 불러왔습니다. 영웅들이 여관 각 구역을 오가며 다음 원정을 준비합니다!`,
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

  /**
   * 오프라인 정산: 초당 골드(GPS)×시간이 아니라,
   * 하루 루프(손님 서빙 + 영웅 던전 원정 + 상점 소비 + 급료·유지비 차감)를 날짜 단위로 요약 시뮬레이션합니다.
   */
  private settleOfflineProgress(
    elapsedSec: number,
    cappedSec: number
  ): OfflineReport {
    const beforePotions = this.totalPotionsCrafted;
    const beforeEquips = this.totalEquipCrafted;
    const beforePeddler = this.totalPeddlerSales;
    const beforeShopTx = this.totalHeroShopTransactions;
    const beforeHealed = this.totalHeroesHealed;
    const startDay = this.dayNumber;
    const prevGold = this.gold;

    let expeditionsCompleted = 0;
    let totalIncome = 0;
    let totalExpense = 0;

    // 너무 긴 오프라인 시간도 빠르게 요약 시뮬레이션하도록 최대 20일분(4,800초) 루프로 압축 시뮬레이션
    const effectiveSimSec = Math.min(cappedSec, DAY_DURATION_SEC * 20);
    const step = Math.max(4, Math.min(12, Math.floor(effectiveSimSec / 240) || 4));
    let remaining = effectiveSimSec;

    while (remaining > 0) {
      const dt = Math.min(step, remaining);
      remaining -= dt;

      const dayBefore = this.dayNumber;
      const expBefore = this.expeditions.length;

      // 오프라인 중 방문 손님 자동 서빙 요약
      if (this.guests.length < this.getMaxGuests()) {
        this.spawnGuest();
      }
      const waiting = this.guests.find((g) => g.state === 'waiting');
      if (waiting) {
        this.serveGuest(waiting, false);
      }

      this.updateCraftQueues(dt);
      this.updateExpeditions(dt);
      this.updateHeroesRestAndLootAge(dt);
      this.updateHeroAgents(dt);

      if (this.expeditions.length < expBefore) {
        expeditionsCompleted += expBefore - this.expeditions.length;
      }
      if (this.autoDispatch && this.expeditions.length === 0) {
        this.tryAutoDispatch();
      }

      // 하루 경과 진행
      this.dayTimeSec += dt;
      if (this.dayTimeSec >= DAY_DURATION_SEC) {
        const rep = this.settleEndOfDay();
        totalIncome += rep.income.totalIncome;
        totalExpense += rep.expense.totalOperatingExpense;
      } else if (this.dayNumber > dayBefore && this.lastSettledDayReport) {
        totalIncome += this.lastSettledDayReport.income.totalIncome;
        totalExpense += this.lastSettledDayReport.expense.totalOperatingExpense;
      }
    }

    const simulatedDays = Math.max(1, this.dayNumber - startDay);
    const earnedGold = Math.floor(this.gold - prevGold);
    const injuredCount = this.getUnlockedHeroes().filter(
      (h) => h.status === 'injured'
    ).length;
    const heroShopTransactions = Math.max(
      0,
      this.totalHeroShopTransactions - beforeShopTx
    );
    const heroesHealedCount = Math.max(0, this.totalHeroesHealed - beforeHealed);

    this.addLog(
      `🌙 오프라인 ${simulatedDays}일분 정산: 순수익 ${
        earnedGold >= 0 ? '+' : ''
      }${formatGold(
        earnedGold
      )}G, 원정 ${expeditionsCompleted}회, 상점 거래 ${heroShopTransactions}건!`,
      'event'
    );

    return {
      elapsedSeconds: elapsedSec,
      cappedSeconds: cappedSec,
      wasCapped: elapsedSec > MAX_OFFLINE_SECONDS,
      simulatedDays,
      totalIncome,
      totalExpense,
      earnedGold,
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
        innRank: this.innRank,
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
        dayNumber: this.dayNumber,
        dayTimeSec: this.dayTimeSec,
        currentDayLedger: this.currentDayLedger,
        dayHistory: this.dayHistory,
        unpaidWages: this.unpaidWages,
        completedQuests: this.completedQuests,
        maxDailyNetProfitReached: this.maxDailyNetProfitReached,
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
    this.migratedFromLegacy = false;
    this.legacyVersionDetected = null;

    this.addLog(
      '여관을 처음부터 다시 단장했습니다! 시작 영웅 4명과 첫 손님이 여관에 모였습니다.',
      'normal'
    );
    this.spawnGuest();
    this.saveToStorage();
    this.onUiUpdate();
  }

  // ==========================================================================
  // 기본 여관 골드 · 평판 · 업그레이드 (초당 자동 골드 완전 제거!)
  // ==========================================================================

  public getGlobalGoldMultiplier(): number {
    let mult = 1.0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.globalMultiplierBonus) {
        mult += lv * u.globalMultiplierBonus;
      }
    }
    mult += (this.innRank - 1) * 0.04;

    if (mult > 1.85) {
      mult = 1.85 + Math.sqrt(mult - 1.85) * 0.25;
    }

    if (this.activeEvent) {
      mult *= Math.min(1.4, this.activeEvent.def.goldMult);
    }
    return mult;
  }

  /**
   * v4 경제 개편: 수동 초당 자동 골드(GPS)는 완전히 제거되어 항상 0을 반환합니다.
   */
  public getGoldPerSecond(): number {
    return 0;
  }

  public getClickServeBonus(): number {
    let baseClick = 5;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0) {
        baseClick += lv * Math.min(8, u.clickPerLevel);
      }
    }
    return Math.max(5, Math.floor(baseClick * this.getGlobalGoldMultiplier()));
  }

  public getGuestServeGold(
    guestDef: GuestTypeDef,
    isManualClick: boolean
  ): number {
    // 인플레이션 폭주를 막기 위해 손님 기본 지불액에 업그레이드 보너스를 완만하게 합산
    let menuBonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0) {
        menuBonus += lv * Math.min(3, Math.ceil(u.clickPerLevel * 0.2));
      }
    }
    const cappedBonus = Math.min(guestDef.baseGold * 1.1, menuBonus);
    let total = (guestDef.baseGold + cappedBonus) * this.getGlobalGoldMultiplier();
    if (isManualClick) {
      total *= 1.15;
    }
    return Math.max(2, Math.floor(total));
  }

  public getServeReputationGain(guestDef: GuestTypeDef): number {
    // 평판 인플레이션 방지: 손님 서빙당 기본 1~3 평판 획득 (주 평판은 던전 공략과 시설/목표 달성에서 획득)
    return Math.max(1, Math.min(4, guestDef.baseRep));
  }

  public getMaxGuests(): number {
    let bonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.maxGuestsBonusPerLevel) {
        bonus += Math.ceil((lv * u.maxGuestsBonusPerLevel) / 2);
      }
    }
    return Math.min(10, 4 + bonus);
  }

  public getAutoServeInterval(): number {
    let speed = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.autoServeSpeedBonus) {
        speed += lv * u.autoServeSpeedBonus;
      }
    }
    speed *= this.getStaffEfficiencyMultiplier();
    if (speed <= 0) {
      return 4.8; // 직원이 없어도 여관 주인이 기본 속도로 서빙하여 교착 방지
    }
    return Math.max(0.75, 3.2 / (1 + speed * 0.65));
  }

  public getExtraLootChance(): number {
    let bonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.lootChanceBonus) {
        bonus += lv * u.lootChanceBonus;
      }
    }
    if (this.innRank >= 7) {
      bonus += 0.06;
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

    // 체불 급료가 있고 골드가 여유 있으면 즉시 자동 상환하여 직원 효율 정상화
    if (this.unpaidWages > 0 && this.gold >= this.unpaidWages + 25) {
      const paid = this.unpaidWages;
      this.gold -= paid;
      this.unpaidWages = 0;
      if (this.currentDayLedger) {
        this.currentDayLedger.wageArrears = 0;
      }
      this.addLog(
        `✅ 체불 급료 ${formatGold(paid)}G를 상환하여 직원 근무 효율이 100%로 회복되었습니다!`,
        'unlock'
      );
    }
  }

  public addReputation(amount: number): void {
    if (amount <= 0) return;
    this.reputation += amount;

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
    this.checkInnRankProgression();
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
    this.recordExpense('facilityInvest', cost);
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
      `[${def.name}] Lv.${currentLv + 1} 업그레이드 완료! (-${formatGold(cost)}G)`,
      'normal'
    );

    this.checkInnRankProgression();
    this.saveToStorage();
    this.onUiUpdate();
    return true;
  }

  // ==========================================================================
  // 영웅 타일 그리드 경로탐색 · 성격 반영 이동 · 욕구 기반 자율 AI · 플레이어 지시
  // ==========================================================================

  private pickSpotInZone(
    zone: InnZoneId,
    hero: HeroState
  ): { col: number; row: number; facing: 'left' | 'right' } {
    const spots = ZONE_SPOTS[zone] ?? ZONE_SPOTS.hall;
    const occupied = new Set<string>();
    for (const other of this.getUnlockedHeroes()) {
      if (other.id === hero.id || other.status === 'exploring') continue;
      occupied.add(
        `${other.targetTileX ?? other.tileX},${other.targetTileY ?? other.tileY}`
      );
    }
    // 고독(lone_wolf) 성격은 구석 자리를 선호하여 뒤쪽 인덱스부터 탐색
    const roster = HERO_ROSTER_MAP[hero.id];
    const orderedSpots = roster?.personalities.includes('lone_wolf')
      ? [...spots].reverse()
      : spots;

    for (const s of orderedSpots) {
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
    const baseWalkSpeed = 72; // 기본 타일 이동 속도 (픽셀/초)
    const unlocked = this.getUnlockedHeroes();

    for (const hero of unlocked) {
      this.ensureHeroAgentFields(hero);
      const roster = HERO_ROSTER_MAP[hero.id];
      const walkSpeed =
        baseWalkSpeed *
        (roster ? getPersonalityWalkSpeedMultiplier(roster.personalities) : 1.0);

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

      hero.hunger = Math.min(100, (hero.hunger ?? 20) + dt * 0.48);

      // 신중(cautious) 성격은 이동 중 가끔 주변을 살피며 잠깐 멈칫함
      if ((hero.hesitateTimer ?? 0) > 0) {
        hero.hesitateTimer = Math.max(0, (hero.hesitateTimer ?? 0) - dt);
        continue;
      }

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

          if (
            roster?.personalities.includes('cautious') &&
            hero.path.length === 2 &&
            this.random() < 0.22
          ) {
            hero.hesitateTimer = 0.25;
          }

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

      // 2. 도착 후 작업/상호작용 타이머
      if (hero.activityTimer && hero.activityTimer > 0) {
        hero.activityTimer -= dt;
        if (hero.activityTimer <= 0) {
          hero.activityTimer = 0;
          this.completeHeroStationAction(hero);
        }
      }
    }

    // 3. 프레임 분산 자율 AI 의사결정
    this.agentDecisionTimer += dt;
    if (this.agentDecisionTimer >= 0.35 && unlocked.length > 0) {
      this.agentDecisionTimer = 0;
      const batchSize = Math.min(3, unlocked.length);
      for (let i = 0; i < batchSize; i++) {
        const h = unlocked[this.agentDecisionCursor % unlocked.length];
        this.agentDecisionCursor =
          (this.agentDecisionCursor + 1) % unlocked.length;
        this.evaluateHeroAutonomousNeed(h);
      }
    }

    // 4. 의뢰 게시판 자동 파티 결성 및 출정
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
        hero.activityTimer = 1.2;
        hero.intentText = '💎 거래 가판대에서 전리품 흥정·매각 중';
        break;
      case 'potion':
        hero.activity = 'shopping_potion';
        hero.activityTimer = 1.3;
        hero.intentText = '⚗️ 포션 가게에서 비약 고르는 중';
        break;
      case 'blacksmith':
        hero.activity =
          hero.playerOrder?.kind === 'enhance_equip'
            ? 'enhancing'
            : 'shopping_equip';
        hero.activityTimer = 1.4;
        hero.intentText = '⚒️ 대장간에서 장비 정비 중';
        break;
      case 'dining':
        hero.activity = 'eating';
        hero.activityTimer = 1.5;
        hero.intentText = '🍲 1층 식당에서 따뜻한 식사 중';
        break;
      case 'bar':
        hero.activity = 'drinking';
        hero.activityTimer = 1.4;
        hero.intentText = '🍺 바 카운터에서 맥아 에일 시음 중';
        break;
      case 'room':
        hero.activity = 'sleeping';
        hero.activityTimer = Math.max(
          1.6,
          Math.min(4.0, hero.restTimerSec || 2.0)
        );
        hero.intentText = '🛏️ 2층 객실 침대에서 수면·회복 중';
        this.triggerHeroSpeech(hero, 'resting');
        break;
      case 'board':
        hero.activity = 'rallying';
        hero.activityTimer = 0.9;
        hero.intentText = '📋 의뢰 게시판에서 파티원 모집 중';
        this.triggerHeroSpeech(hero, 'party_banter');
        break;
      case 'gate':
        hero.activity = 'rallying';
        hero.activityTimer = 0.5;
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
    let spentByInn = 0;
    let marginEarned = 0;
    const reserve = this.autoBuyLoot ? this.shopConfig.lootReserveGold : 0;

    for (const stack of [...hero.lootBag]) {
      if (stack.count <= 0) continue;
      if (this.shopConfig.lootBuyEnabled[stack.materialId] === false) {
        continue;
      }
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

      const mat = MATERIAL_MAP[stack.materialId];
      const unitPrice = this.getEffectiveMaterialBuyPrice(stack.materialId);
      const availGold = Math.max(0, this.gold - reserve);
      const canBuy = Math.min(stack.count, Math.floor(availGold / unitPrice));
      if (canBuy > 0) {
        const total = canBuy * unitPrice;
        this.gold -= total;
        this.recordExpense('lootPurchase', total);
        hero.gold += total;
        this.materials[stack.materialId] =
          (this.materials[stack.materialId] ?? 0) + canBuy;
        stack.count -= canBuy;
        soldCount += canBuy;
        spentByInn += total;

        // 여관 거래소 감정 수수료 및 저가 매입 마진 수입 기록
        const baseVal = (mat?.buyPrice ?? unitPrice) * canBuy;
        const discountGain = Math.max(0, baseVal - total);
        const fee = Math.max(1, Math.round(baseVal * 0.15)) + discountGain;
        marginEarned += fee;
      }
    }

    hero.lootBag = hero.lootBag.filter((s) => s.count > 0);

    if (soldCount > 0) {
      if (marginEarned > 0) {
        this.recordIncome('lootMargin', marginEarned);
      }
      this.totalHeroShopTransactions += 1;
      if (this.currentDayLedger) {
        this.currentDayLedger.heroTransactions += 1;
      }
      this.sound.playCoin();
      this.spawnCoins(hero.x!, hero.y! - 10, 4);
      this.setHeroInteractionEffect(
        hero,
        '💎',
        `매입 ${spentByInn}G`,
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
        this.recordIncome('potionSales', price);
        this.potionStock[pId] -= 1;
        this.totalHeroShopTransactions += 1;
        if (this.currentDayLedger) {
          this.currentDayLedger.heroTransactions += 1;
        }

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
        this.checkOptionalQuests();
        return;
      }
    }
  }

  private executeHeroBlacksmithVisit(
    hero: HeroState,
    order?: HeroPlayerOrder | null
  ): void {
    if (order?.kind === 'buy_equip' && order.stockUid !== undefined) {
      if (this.equipItemToHero(hero.id, order.stockUid)) {
        this.setHeroInteractionEffect(hero, '⚒️', '장착 완료!', '#e6c274');
        this.triggerHeroSpeech(hero, 'equip_bought', true);
      }
      return;
    }

    if (this.shopConfig.blacksmithSaleEnabled) {
      const bought = this.heroTryBuyBetterEquipment(hero);
      if (bought) {
        this.totalHeroShopTransactions += 1;
        if (this.currentDayLedger) {
          this.currentDayLedger.heroTransactions += 1;
        }
        this.spawnCoins(hero.x!, hero.y! - 10, 4);
        this.setHeroInteractionEffect(hero, '⚒️', '신규 장착!', '#e6c274');
        this.triggerHeroSpeech(hero, 'equip_bought');
      }
    }

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
        this.recordIncome('foodAndDrink', price);
        hero.hunger = Math.max(0, (hero.hunger ?? 50) - 75);
        hero.fatigue = Math.max(0, (hero.fatigue ?? 20) - 20);
        this.totalHeroShopTransactions += 1;
        if (this.currentDayLedger) {
          this.currentDayLedger.heroTransactions += 1;
        }

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
        this.checkOptionalQuests();
        return;
      }
    }

    // 파산·교착 방지: 영웅 골드가 바닥나도 여관 기본 약초 수프는 계속 제공되며 소액의 기본 식대를 지불
    const minSoupPay = Math.min(hero.gold, 4);
    if (minSoupPay > 0) {
      hero.gold -= minSoupPay;
      this.recordIncome('foodAndDrink', minSoupPay);
    }
    hero.hunger = Math.max(0, (hero.hunger ?? 50) - 55);
    this.setHeroInteractionEffect(hero, '🥣', '기본 수프', '#7eb38a');
    this.triggerHeroSpeech(hero, 'eating');
  }

  private executeHeroRoomRestVisit(hero: HeroState): void {
    const bd = getHeroStatBreakdown(hero);
    hero.currentHp = bd.totalStats.hp;
    hero.status = 'idle';
    hero.restTimerSec = 0;
    hero.fatigue = 0;
    this.totalHeroesHealed += 1;

    const targetFee = Math.round(
      9 * this.getRoomRecoveryBonus() * this.getGlobalGoldMultiplier()
    );
    const roomFee = Math.min(hero.gold, targetFee);
    if (roomFee > 0) {
      hero.gold -= roomFee;
      this.recordIncome('roomAndRest', roomFee);
      this.totalHeroShopTransactions += 1;
      if (this.currentDayLedger) {
        this.currentDayLedger.heroTransactions += 1;
      }
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

    this.setHeroInteractionEffect(
      hero,
      '🛏️',
      roomFee > 0 ? `+${roomFee}G` : '완전 회복!',
      '#7eb38a'
    );
    this.triggerHeroSpeech(hero, 'healed');
  }

  private evaluateHeroAutonomousNeed(hero: HeroState): void {
    if (!hero.unlocked || hero.status === 'exploring') return;
    if (hero.playerOrder) return;
    if (hero.path && hero.path.length > 0) return;
    if ((hero.activityTimer ?? 0) > 0) return;

    const bd = getHeroStatBreakdown(hero);

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

    const hasSellableLoot = hero.lootBag.some(
      (s) => s.count > 0 && this.shopConfig.lootBuyEnabled[s.materialId] !== false
    );
    if (hasSellableLoot && hero.targetZone !== 'trade') {
      this.sendHeroToZone(hero, 'trade', '전리품을 팔러 거래 가판대로 이동 중');
      return;
    }

    if (
      this.shopConfig.blacksmithSaleEnabled &&
      this.hasAffordableBetterEquipment(hero) &&
      hero.targetZone !== 'blacksmith'
    ) {
      this.sendHeroToZone(hero, 'blacksmith', '새 장비를 구매하러 대장간으로 이동 중');
      return;
    }

    const hasPotionBuff = hero.buffs.some((b) => b.source === 'potion');
    if (
      !hasPotionBuff &&
      this.hasAffordableBuffPotion(hero) &&
      hero.targetZone !== 'potion'
    ) {
      this.sendHeroToZone(hero, 'potion', '탐험용 비약을 사러 포션 가게로 이동 중');
      return;
    }

    const hasFoodBuff = hero.buffs.some((b) => b.source === 'food');
    if (
      this.shopConfig.mealSaleEnabled &&
      ((hero.hunger ?? 0) >= 44 || (!hasFoodBuff && hero.gold >= 8)) &&
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
  // 던전 해금 · 파티 파견 · 갈래 방(Branching Rooms) · 직업 기술 자동 전투 · 이벤트 선택지
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
    return this.innRank >= 5 ? 4 : 3;
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
    if (!Array.isArray(exp.roomGraph) || exp.roomGraph.length === 0) {
      exp.roomGraph = createDungeonRoomGraph(dungeon, () => this.random());
    }
    if (!exp.currentRoomId) {
      exp.currentRoomId = 'f1_b0';
    }
    if (!exp.currentRoomType) {
      exp.currentRoomType = 'combat';
    }
    if (!Array.isArray(exp.visitedRoomIds)) {
      exp.visitedRoomIds = [exp.currentRoomId];
    }
    if (!Array.isArray(exp.monsters)) {
      exp.monsters = createFloorMonsters(
        dungeon,
        exp.currentFloor,
        exp.totalFloors,
        exp.currentRoomType
      );
    }
    if (!exp.partyCombatState) {
      exp.partyCombatState = {};
      for (const hId of exp.heroIds) {
        const h = this.heroes[hId];
        const roster = HERO_ROSTER_MAP[hId];
        const maxHp = h ? getHeroStatBreakdown(h).totalStats.hp : 100;
        const stanceOffset = roster?.personalities.includes('brave') ||
          roster?.personalities.includes('hotblooded')
          ? 8
          : roster?.personalities.includes('cautious')
          ? -6
          : 0;
        exp.partyCombatState[hId] = {
          currentHp: h ? Math.max(20, h.currentHp) : maxHp,
          maxHp,
          hitFlashTimer: 0,
          lungeTimer: 0,
          stanceOffset,
          skillIcon: null,
          skillTimer: 0,
          combatSpeech: null,
          combatSpeechTimer: 0,
        };
      }
    }
    if (!Array.isArray(exp.skillEffects)) exp.skillEffects = [];
    if (typeof exp.combatRoundTimer !== 'number') exp.combatRoundTimer = 0.45;
    if (typeof exp.floorTransitionTimer !== 'number') exp.floorTransitionTimer = 0;
    if (!Array.isArray(exp.combatFloats)) exp.combatFloats = [];
    if (!Array.isArray(exp.dropVisuals)) exp.dropVisuals = [];
    if (!Array.isArray(exp.floorLogs)) exp.floorLogs = [];
    if (!exp.accumulatedLoot) exp.accumulatedLoot = {};
    if (typeof exp.bonusGoldEarned !== 'number') exp.bonusGoldEarned = 0;
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

    // 전열(탱커) -> 중열(딜러/지원) -> 후열(힐러) 진형 정렬
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
    const roomGraph = createDungeonRoomGraph(dungeon, () => this.random());

    const partyCombatState: ActiveExpedition['partyCombatState'] = {};
    for (const h of partyHeroes) {
      const bd = getHeroStatBreakdown(h);
      const roster = HERO_ROSTER_MAP[h.id];
      const stanceOffset =
        roster.personalities.includes('brave') ||
        roster.personalities.includes('hotblooded')
          ? 8
          : roster.personalities.includes('cautious')
          ? -6
          : 0;
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
        stanceOffset,
        skillIcon: null,
        skillTimer: 0,
        combatSpeech: null,
        combatSpeechTimer: 0,
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
      roomGraph,
      currentRoomId: 'f1_b0',
      currentRoomType: 'combat',
      visitedRoomIds: ['f1_b0'],
      roomResolved: false,
      activeEventPrompt: null,
      monsters: createFloorMonsters(dungeon, 1, totalFloors, 'combat'),
      partyCombatState,
      skillEffects: [],
      combatRoundTimer: 0.5,
      floorTransitionTimer: 0,
      combatFloats: [],
      dropVisuals: [],
      floorLogs: [],
      accumulatedLoot: {},
      bonusGoldEarned: 0,
      willSucceed,
      failAtFloor: willSucceed ? totalFloors + 1 : totalFloors,
    };

    this.appendExpeditionFloorLog(
      newExp,
      `1층 진입: [${preview.heroNames.join('·')}] 진형이 ${dungeon.name} 탐험을 시작합니다!`,
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

  /**
   * 갈래 방(2갈래 분기) 선택 로직: 파티의 직업(도적 등)과 성격(탐욕/신중/용감)에 따라 선호하는 방을 선택합니다.
   */
  private chooseBranchRoomForFloor(
    exp: ActiveExpedition,
    targetFloor: number
  ): DungeonRoomNode {
    const floorNodes = exp.roomGraph?.[targetFloor - 1] ?? [];
    if (floorNodes.length <= 1) {
      return (
        floorNodes[0] ?? {
          id: `f${targetFloor}_b0`,
          floor: targetFloor,
          branchIndex: 0,
          type: targetFloor === exp.totalFloors ? 'boss' : 'combat',
          label: `${targetFloor}F 전투방`,
          icon: '⚔️',
          nextIds: [],
        }
      );
    }

    const partyRosters = exp.heroIds
      .map((id) => HERO_ROSTER_MAP[id])
      .filter(Boolean);
    const hasRogueOrGreedy = partyRosters.some(
      (r) =>
        r.classId === 'rogue' ||
        r.classId === 'traveler' ||
        r.personalities.includes('greedy')
    );
    const hasCautious = partyRosters.some((r) =>
      r.personalities.includes('cautious')
    );
    const hasBraveOrHot = partyRosters.some(
      (r) =>
        r.personalities.includes('brave') ||
        r.personalities.includes('hotblooded')
    );

    for (const node of floorNodes) {
      if (node.type === 'treasure' && hasRogueOrGreedy) return node;
      if ((node.type === 'rest' || node.type === 'event') && hasCautious) {
        return node;
      }
      if (node.type === 'elite' && hasBraveOrHot) return node;
    }

    return floorNodes[Math.floor(this.random() * floorNodes.length)];
  }

  /**
   * 이벤트 방에서 플레이어(또는 타이머 만료 시 파티 리더)가 선택지를 골랐을 때 효과를 적용합니다.
   */
  public chooseDungeonEventOption(
    expeditionId: string,
    optionId?: string
  ): boolean {
    const exp = this.expeditions.find((e) => e.id === expeditionId);
    if (!exp || !exp.activeEventPrompt || exp.activeEventPrompt.resolvedOptionId) {
      return false;
    }
    const prompt = exp.activeEventPrompt;
    const chosen =
      prompt.options.find((o) => o.id === optionId) ?? prompt.options[0];
    if (!chosen) return false;

    prompt.resolvedOptionId = chosen.id;
    const dungeon = DUNGEON_MAP[exp.dungeonId] ?? DUNGEONS[0];

    if (chosen.kind === 'heal') {
      for (const cState of Object.values(exp.partyCombatState ?? {})) {
        const heal = Math.round(cState.maxHp * 0.25);
        cState.currentHp = Math.min(cState.maxHp, cState.currentHp + heal);
      }
      exp.combatFloats?.push({
        x: 155,
        y: 92,
        text: '💚파티 치유 +25%!',
        color: '#7eb38a',
        life: 1.1,
      });
    } else if (chosen.kind === 'gold') {
      exp.bonusGoldEarned = (exp.bonusGoldEarned ?? 0) + 24;
      exp.combatFloats?.push({
        x: 165,
        y: 92,
        text: '💰+24G 보물 발견!',
        color: '#ebd186',
        life: 1.1,
      });
    } else if (chosen.kind === 'loot') {
      if (dungeon.drops.length > 0) {
        const dropMatId = dungeon.drops[0].materialId;
        const mat = MATERIAL_MAP[dropMatId];
        exp.accumulatedLoot = exp.accumulatedLoot ?? {};
        exp.accumulatedLoot[dropMatId] =
          (exp.accumulatedLoot[dropMatId] ?? 0) + 1;
        if (mat) {
          exp.dropVisuals?.push({
            x: 300,
            y: 112,
            icon: mat.icon,
            name: mat.name,
            count: 1,
            life: 1.5,
          });
        }
      }
    } else if (chosen.kind === 'haste') {
      exp.remainingSec = Math.max(2, exp.remainingSec - 4);
      exp.combatFloats?.push({
        x: 165,
        y: 92,
        text: '⚡지름길 발견 (-4초)!',
        color: '#78b2bf',
        life: 1.1,
      });
    } else if (chosen.kind === 'buff_atk') {
      exp.combatFloats?.push({
        x: 165,
        y: 92,
        text: '⚔️전투 사기 상승!',
        color: '#ebd186',
        life: 1.1,
      });
    }

    this.appendExpeditionFloorLog(
      exp,
      `❓ 이벤트 선택 [${chosen.label}] → ${chosen.effectText}`,
      'drop'
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
    const floorLocalRatio = Math.min(
      1,
      Math.max(0, floorLocalElapsed / floorSpan)
    );

    // 이펙트 및 타이머 감쇠
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
    if (exp.skillEffects && exp.skillEffects.length > 0) {
      exp.skillEffects = exp.skillEffects.filter((se) => {
        se.life -= dt;
        return se.life > 0;
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
      if ((cState.skillTimer ?? 0) > 0) {
        cState.skillTimer = Math.max(0, (cState.skillTimer ?? 0) - dt);
      }
      if ((cState.combatSpeechTimer ?? 0) > 0) {
        cState.combatSpeechTimer = Math.max(
          0,
          (cState.combatSpeechTimer ?? 0) - dt
        );
      }
    }

    // 이벤트 선택지 자동 타임아웃 처리 (플레이어가 안 눌러도 시뮬/방치가 멈추지 않음)
    if (exp.activeEventPrompt && !exp.activeEventPrompt.resolvedOptionId) {
      exp.activeEventPrompt.autoResolveTimer -= dt;
      if (exp.activeEventPrompt.autoResolveTimer <= 0) {
        this.chooseDungeonEventOption(exp.id);
      }
    }

    // 층 전환 및 갈래 방 진입 감지
    if (targetFloor > (exp.currentFloor ?? 1)) {
      if (exp.activeEventPrompt && !exp.activeEventPrompt.resolvedOptionId) {
        this.chooseDungeonEventOption(exp.id);
      }
      exp.activeEventPrompt = null;
      exp.currentFloor = targetFloor;
      exp.floorPhase = 'marching';
      exp.marchProgress = 0;
      exp.roomResolved = false;

      const chosenRoom = this.chooseBranchRoomForFloor(exp, targetFloor);
      exp.currentRoomId = chosenRoom.id;
      exp.currentRoomType = chosenRoom.type;
      exp.visitedRoomIds = exp.visitedRoomIds ?? [];
      if (!exp.visitedRoomIds.includes(chosenRoom.id)) {
        exp.visitedRoomIds.push(chosenRoom.id);
      }

      const rMeta = ROOM_TYPE_META[chosenRoom.type] ?? ROOM_TYPE_META.combat;
      if (
        chosenRoom.type === 'combat' ||
        chosenRoom.type === 'elite' ||
        chosenRoom.type === 'boss'
      ) {
        exp.monsters = createFloorMonsters(
          dungeon,
          targetFloor,
          totalFloors,
          chosenRoom.type
        );
      } else {
        exp.monsters = [];
      }

      const isBoss = chosenRoom.type === 'boss';
      this.appendExpeditionFloorLog(
        exp,
        isBoss
          ? `👑 [${targetFloor}층 보스방 진입!] ${exp.monsters[0]?.name} (${exp.monsters[0]?.behaviorLabel}) 출현!`
          : `🔀 ${targetFloor}층 갈래길: [${rMeta.icon} ${chosenRoom.label}] 경로로 진입합니다.`,
        isBoss ? 'boss' : 'march'
      );
    }

    // 층 내 단계 진행
    const roomType = exp.currentRoomType ?? 'combat';
    if (floorLocalRatio < 0.22) {
      exp.floorPhase = 'marching';
      exp.marchProgress = floorLocalRatio / 0.22;
    } else if (floorLocalRatio < 0.84) {
      if (exp.floorPhase === 'marching') {
        exp.floorPhase = 'fighting';
        this.onEnterDungeonRoomAction(exp, dungeon, roomType);
      }

      if (
        roomType === 'combat' ||
        roomType === 'elite' ||
        roomType === 'boss'
      ) {
        exp.combatRoundTimer = (exp.combatRoundTimer ?? 0.5) - dt;
        if (exp.combatRoundTimer <= 0) {
          exp.combatRoundTimer = 0.62;
          this.executeExpeditionCombatTick(exp, dungeon, floorLocalRatio);
        }
      }
    } else {
      if (exp.floorPhase === 'fighting') {
        const isFailFloor =
          !exp.willSucceed &&
          exp.currentFloor === (exp.failAtFloor ?? totalFloors);
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
          if (dungeon.drops.length > 0) {
            const dropDef =
              dungeon.drops[(exp.currentFloor ?? 1) % dungeon.drops.length];
            const mat = MATERIAL_MAP[dropDef.materialId];
            if (mat && (exp.willSucceed || this.random() < 0.55)) {
              exp.dropVisuals?.push({
                x: 315,
                y: 122,
                icon: mat.icon,
                name: mat.name,
                count: 1,
                life: 1.6,
              });
              this.appendExpeditionFloorLog(
                exp,
                `🎁 ${exp.currentFloor}층 돌파 보상! ${mat.icon}${mat.name} 획득!`,
                'drop'
              );
            }
          }
        }
      }
    }
  }

  /**
   * 방(전투/보물/함정/휴식/이벤트/정예/보스)에 도착했을 때 직업 기술과 성격 대사를 발동합니다.
   */
  private onEnterDungeonRoomAction(
    exp: ActiveExpedition,
    dungeon: (typeof DUNGEONS)[number],
    roomType: NonNullable<ActiveExpedition['currentRoomType']>
  ): void {
    // 대표 영웅 성격 말풍선 표시
    const speakerId =
      exp.heroIds.find((id) => {
        const r = HERO_ROSTER_MAP[id];
        if (roomType === 'treasure') {
          return r?.classId === 'rogue' || r?.personalities.includes('greedy');
        }
        if (roomType === 'trap') {
          return r?.classId === 'rogue' || r?.personalities.includes('cautious');
        }
        return false;
      }) ?? exp.heroIds[0];

    if (speakerId && exp.partyCombatState?.[speakerId]) {
      const roster = HERO_ROSTER_MAP[speakerId];
      exp.partyCombatState[speakerId].combatSpeech =
        generateCombatPersonalitySpeech(
          roster.personalities,
          roomType,
          () => this.random()
        );
      exp.partyCombatState[speakerId].combatSpeechTimer = 2.4;
    }

    if (roomType === 'treasure') {
      const openerName = HERO_ROSTER_MAP[speakerId]?.name ?? '도적';
      exp.bonusGoldEarned = (exp.bonusGoldEarned ?? 0) + 18 + dungeon.tier * 6;
      exp.skillEffects?.push({
        id: this.nextSkillEffectId++,
        kind: 'trap_disarm',
        label: '🗝️자물쇠 해제!',
        color: '#ebd186',
        startX: 175,
        startY: 132,
        targetX: 310,
        targetY: 132,
        life: 0.9,
        maxLife: 0.9,
      });
      this.appendExpeditionFloorLog(
        exp,
        `🎁 [${openerName}]이(가) 고대 보물상자를 열어 금화와 전리품을 확보했습니다!`,
        'drop'
      );
    } else if (roomType === 'trap') {
      const rogueId = exp.heroIds.find(
        (id) =>
          HERO_ROSTER_MAP[id]?.classId === 'rogue' ||
          HERO_ROSTER_MAP[id]?.personalities.includes('cautious')
      );
      if (rogueId) {
        const rName = HERO_ROSTER_MAP[rogueId].name;
        exp.skillEffects?.push({
          id: this.nextSkillEffectId++,
          kind: 'trap_disarm',
          label: '⚙️함정 해제!',
          color: '#7eb38a',
          startX: 175,
          startY: 132,
          targetX: 285,
          targetY: 136,
          life: 0.9,
          maxLife: 0.9,
        });
        this.appendExpeditionFloorLog(
          exp,
          `⚙️ [${rName}]이(가) 날렵한 손놀림으로 바닥 톱니 함정을 안전하게 해제했습니다!`,
          'combat'
        );
      } else {
        const tankId = exp.heroIds[0];
        const tName = HERO_ROSTER_MAP[tankId]?.name ?? '선봉';
        exp.skillEffects?.push({
          id: this.nextSkillEffectId++,
          kind: 'shield_taunt',
          label: '🛡️방패 방어!',
          color: '#78b2bf',
          startX: 178,
          startY: 140,
          targetX: 190,
          targetY: 140,
          life: 0.9,
          maxLife: 0.9,
        });
        this.appendExpeditionFloorLog(
          exp,
          `🛡️ [${tName}]이(가) 방패를 들어 함정 충격을 막아냈습니다!`,
          'combat'
        );
      }
    } else if (roomType === 'rest') {
      for (const cState of Object.values(exp.partyCombatState ?? {})) {
        const heal = Math.round(cState.maxHp * 0.25);
        cState.currentHp = Math.min(cState.maxHp, cState.currentHp + heal);
      }
      exp.skillEffects?.push({
        id: this.nextSkillEffectId++,
        kind: 'heal_light',
        label: '🏕️모닥불 회복',
        color: '#7eb38a',
        startX: 150,
        startY: 138,
        targetX: 150,
        targetY: 138,
        life: 1.0,
        maxLife: 1.0,
      });
      this.appendExpeditionFloorLog(
        exp,
        `🏕️ 안식의 모닥불에서 파티원들이 체력을 회복하고 전열을 가다듬었습니다.`,
        'march'
      );
    } else if (roomType === 'event') {
      const evDef =
        DUNGEON_ROOM_EVENTS[
          Math.floor(this.random() * DUNGEON_ROOM_EVENTS.length)
        ];
      exp.activeEventPrompt = {
        eventId: evDef.id,
        title: evDef.title,
        description: evDef.description,
        options: evDef.options,
        autoResolveTimer: 4.5,
      };
      this.appendExpeditionFloorLog(
        exp,
        `❓ 미지의 이벤트 발견: [${evDef.title}] (선택지를 고르거나 잠시 후 리더가 결정합니다)`,
        'march'
      );
    } else {
      const mNames = (exp.monsters ?? [])
        .map((m) => `${m.name}(${m.behaviorLabel})`)
        .join(', ');
      this.appendExpeditionFloorLog(
        exp,
        `⚔️ ${exp.currentFloor}층 교전 시작! — ${mNames}`,
        'combat'
      );
    }
  }

  private executeExpeditionCombatTick(
    exp: ActiveExpedition,
    _dungeon: (typeof DUNGEONS)[number],
    floorLocalRatio: number
  ): void {
    const aliveMonsters = (exp.monsters ?? []).filter((m) => m.currentHp > 0);
    if (aliveMonsters.length === 0) return;

    const attackerIdx = Math.floor(this.random() * exp.heroIds.length);
    const attackerId = exp.heroIds[attackerIdx];
    const attacker = this.heroes[attackerId];
    const targetMonster = aliveMonsters[0];

    if (attacker && exp.partyCombatState?.[attackerId]) {
      const roster = HERO_ROSTER_MAP[attackerId];
      const cls = HERO_CLASSES[roster.classId];
      const skillDef = CLASS_COMBAT_SKILLS[roster.classId];
      const bd = getHeroStatBreakdown(attacker);
      const cState = exp.partyCombatState[attackerId];

      cState.lungeTimer = 0.28;
      cState.skillIcon = skillDef.icon;
      cState.skillTimer = 0.85;

      // 가끔 전투 성격 말풍선 출력
      if (this.random() < 0.28 && (cState.combatSpeechTimer ?? 0) <= 0) {
        cState.combatSpeech = generateCombatPersonalitySpeech(
          roster.personalities,
          exp.currentRoomType ?? 'combat',
          () => this.random()
        );
        cState.combatSpeechTimer = 1.8;
      }

      const heroX = 178 - attackerIdx * 40 + (cState.stanceOffset ?? 0);
      const heroY = 132 + (attackerIdx % 2) * 9;
      const monsterX = 294;
      const monsterY = 132;

      // 직업 기술 시각 이펙트 생성
      exp.skillEffects?.push({
        id: this.nextSkillEffectId++,
        kind: skillDef.visualKind,
        label: skillDef.shortLabel,
        color: skillDef.color,
        startX: heroX,
        startY: heroY,
        targetX: skillDef.isHeal ? 178 : monsterX,
        targetY: skillDef.isHeal ? 136 : monsterY,
        life: 0.55,
        maxLife: 0.55,
      });

      const isRogueOrHot =
        cls.id === 'rogue' ||
        cls.id === 'berserker' ||
        roster.personalities.includes('hotblooded');
      const isCrit = this.random() < (isRogueOrHot ? 0.38 : 0.2);
      const rawDmg = Math.max(
        12,
        Math.round(
          (bd.totalStats.atk + bd.totalStats.int * 0.85) *
            (isCrit ? 1.5 : 1.0)
        )
      );

      const isFailFloor =
        !exp.willSucceed &&
        exp.currentFloor === (exp.failAtFloor ?? exp.totalFloors);
      const maxPull = isFailFloor
        ? Math.floor(targetMonster.maxHp * 0.28)
        : Math.floor(targetMonster.maxHp * 0.48);
      const dmg = Math.min(maxPull, rawDmg);

      // 마법사/광전사 범위 기술(isAoe)은 모든 생존 몬스터를 타격!
      const targets = skillDef.isAoe ? aliveMonsters : [targetMonster];
      for (const m of targets) {
        const applied = m === targetMonster ? dmg : Math.round(dmg * 0.65);
        m.currentHp = Math.max(
          isFailFloor ? Math.floor(m.maxHp * 0.2) : 1,
          m.currentHp - applied
        );
        m.hitFlashTimer = 0.22;
      }

      exp.combatFloats?.push({
        x: 288 + this.random() * 32,
        y: 88,
        text: isCrit
          ? `${skillDef.icon}치명타 -${dmg}!`
          : `${skillDef.icon}-${dmg}`,
        color: isCrit ? '#ebd186' : skillDef.color,
        life: 0.8,
      });

      // 힐러(사제) 또는 성기사는 전열 아군 치유 발동
      if (skillDef.isHeal) {
        const frontId = exp.heroIds[0];
        const frontState = exp.partyCombatState?.[frontId];
        if (frontState) {
          const healAmt = Math.max(12, Math.round(bd.totalStats.int * 0.7));
          frontState.currentHp = Math.min(
            frontState.maxHp,
            frontState.currentHp + healAmt
          );
          exp.combatFloats?.push({
            x: 162,
            y: 88,
            text: `💚+${healAmt}`,
            color: '#7eb38a',
            life: 0.8,
          });
        }
      }
    }

    // 몬스터 행동 패턴별 반격 연출 (돌진 / 원거리 / 맹독 / 무리 / 강타·브레스)
    const frontId = exp.heroIds[0];
    const backId = exp.heroIds[exp.heroIds.length - 1];
    const targetHeroId =
      targetMonster.behavior === 'ranged' && this.random() < 0.45
        ? backId
        : frontId;
    const targetHeroState = exp.partyCombatState?.[targetHeroId];

    if (targetHeroState && targetMonster) {
      targetMonster.lungeTimer = 0.24;
      if (targetMonster.behavior === 'ranged') {
        exp.skillEffects?.push({
          id: this.nextSkillEffectId++,
          kind: 'monster_projectile',
          label: '🏹원거리 사격',
          color: '#e09f67',
          startX: 290,
          startY: 126,
          targetX: 160,
          targetY: 132,
          life: 0.45,
          maxLife: 0.45,
        });
      } else if (targetMonster.behavior === 'poison') {
        exp.skillEffects?.push({
          id: this.nextSkillEffectId++,
          kind: 'poison_cloud',
          label: '🧪맹독 안개',
          color: '#6da67a',
          startX: 280,
          startY: 130,
          targetX: 178,
          targetY: 134,
          life: 0.5,
          maxLife: 0.5,
        });
      } else if (targetMonster.behavior === 'heavy' && targetMonster.isBoss) {
        exp.skillEffects?.push({
          id: this.nextSkillEffectId++,
          kind: 'fire_breath',
          label: '🔥브레스',
          color: '#c7635b',
          startX: 285,
          startY: 124,
          targetX: 175,
          targetY: 134,
          life: 0.55,
          maxLife: 0.55,
        });
      }

      const isFailFloor =
        !exp.willSucceed &&
        exp.currentFloor === (exp.failAtFloor ?? exp.totalFloors);
      const mDmg = Math.max(
        4,
        Math.round(
          targetMonster.atk *
            (isFailFloor && floorLocalRatio > 0.55 ? 1.5 : 0.52)
        )
      );
      targetHeroState.currentHp = Math.max(
        isFailFloor
          ? Math.floor(targetHeroState.maxHp * 0.18)
          : Math.floor(targetHeroState.maxHp * 0.45),
        targetHeroState.currentHp - mDmg
      );
      targetHeroState.hitFlashTimer = 0.2;

      exp.combatFloats?.push({
        x: 168,
        y: 96,
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
      h.tileX = 28;
      h.tileY = 14;
      h.x = gatePx.x;
      h.y = gatePx.y;
      h.facing = 'left';
      h.path = [];
      h.hunger = Math.min(100, (h.hunger ?? 30) + 26);
      h.fatigue = Math.min(100, (h.fatigue ?? 15) + 30);

      for (const b of h.buffs) {
        if (b.injuryImmune) immuneHeroIds.add(h.id);
        b.remainingRuns -= 1;
      }
      h.buffs = h.buffs.filter((b) => b.remainingRuns > 0);
    }

    const lootDropped: Record<string, number> = {
      ...(exp.accumulatedLoot ?? {}),
    };
    const injuredHeroNames: string[] = [];

    if (isSuccess) {
      this.dungeonClears[dungeon.id] = (this.dungeonClears[dungeon.id] ?? 0) + 1;
      if (this.currentDayLedger) {
        this.currentDayLedger.dungeonWins += 1;
      }
      const xpGain = Math.max(
        5,
        Math.round(dungeon.rewardXp * preview.xpMult)
      );
      const bonusG = Math.round((exp.bonusGoldEarned ?? 0) / partyHeroes.length);
      const goldPerHero =
        Math.max(4, Math.round(dungeon.rewardHeroGold * preview.goldMult)) +
        bonusG;

      // 탐욕(greedy) 성격 영웅이 있으면 전리품을 먼저 챙김
      const greedyHero = partyHeroes.find((h) =>
        HERO_ROSTER_MAP[h.id]?.personalities.includes('greedy')
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
            greedyHero && this.random() < 0.65
              ? greedyHero
              : partyHeroes[Math.floor(this.random() * partyHeroes.length)];
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
      this.checkOptionalQuests();
      this.checkInnRankProgression();
    } else {
      if (this.currentDayLedger) {
        this.currentDayLedger.dungeonFails += 1;
      }
      const xpGain = Math.max(3, Math.round(dungeon.rewardXp * 0.35));
      const goldPerHero = Math.max(
        2,
        Math.round(dungeon.rewardHeroGold * 0.25)
      );

      if (dungeon.drops.length > 0 && this.random() < 0.45) {
        const firstMat = dungeon.drops[0].materialId;
        lootDropped[firstMat] = (lootDropped[firstMat] ?? 0) + 1;
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
          const hName = HERO_ROSTER_MAP[h.id].name;
          injuredHeroNames.push(hName);
          if (
            this.currentDayLedger &&
            !this.currentDayLedger.injuredHeroes.includes(hName)
          ) {
            this.currentDayLedger.injuredHeroes.push(hName);
          }
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
    this.recordExpense('lootPurchase', totalCost);
    hero.gold += totalCost;
    this.materials[materialId] = (this.materials[materialId] ?? 0) + buyCount;
    stack.count -= buyCount;

    const baseVal = mat.buyPrice * buyCount;
    const fee = Math.max(1, Math.round(baseVal * 0.15)) + Math.max(0, baseVal - totalCost);
    this.recordIncome('lootMargin', fee);

    hero.lootBag = hero.lootBag.filter((s) => s.count > 0);
    this.setHeroInteractionEffect(hero, '💎', `매입 ${totalCost}G`, '#ebd186');
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
    let totalMargin = 0;

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
          this.recordExpense('lootPurchase', cost);
          h.gold += cost;
          this.materials[mat.id] = (this.materials[mat.id] ?? 0) + canBuy;
          stack.count -= canBuy;
          boughtCount += canBuy;
          spentGold += cost;

          const baseVal = mat.buyPrice * canBuy;
          totalMargin +=
            Math.max(1, Math.round(baseVal * 0.15)) +
            Math.max(0, baseVal - cost);
          this.setHeroInteractionEffect(h, '💎', `매입 ${cost}G`, '#ebd186');
        }
      }
      h.lootBag = h.lootBag.filter((s) => s.count > 0);
    }

    if (boughtCount > 0) {
      if (totalMargin > 0) {
        this.recordIncome('lootMargin', totalMargin);
      }
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
    const price = Math.round(opt.basePrice * (1 + (lv - 1) * 0.06));

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
    const treatCost = Math.max(4, Math.floor(price * 0.6));
    if (this.gold < treatCost) return false;

    this.gold -= treatCost;
    this.recordExpense('craftCost', treatCost);
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

    const roomCost = 8;
    if (this.gold < roomCost) return false;
    this.gold -= roomCost;
    this.recordExpense('craftCost', roomCost);

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
      this.recordIncome('potionSales', effPrice);
      this.totalHeroShopTransactions += 1;
      if (this.currentDayLedger) {
        this.currentDayLedger.heroTransactions += 1;
      }
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

    this.checkOptionalQuests();
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
              Math.round(
                8 * this.getRoomRecoveryBonus() * this.getGlobalGoldMultiplier()
              )
            );
            if (roomFee > 0) {
              h.gold -= roomFee;
              this.recordIncome('roomAndRest', roomFee);
              this.totalHeroShopTransactions += 1;
              if (this.currentDayLedger) {
                this.currentDayLedger.heroTransactions += 1;
              }
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

      if (h.lootBag.length > 0) {
        const remainingStacks = [];
        for (const stack of h.lootBag) {
          stack.ageSeconds += dt;
          if (stack.ageSeconds >= PEDDLER_AUTO_SELL_AGE_SEC) {
            const mat = MATERIAL_MAP[stack.materialId];
            if (mat && stack.count > 0) {
              const heroGain = stack.count * mat.peddlerPrice;
              const innCommission = Math.max(1, Math.floor(heroGain * 0.35));
              h.gold += heroGain;
              this.recordIncome('lootMargin', innCommission);
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
    if (this.shopConfig.mealSaleEnabled && !hasFoodBuff && hero.gold >= 6) {
      const meals = this.getUnlockedMeals();
      for (let i = meals.length - 1; i >= 0; i--) {
        const { option, buff } = this.getMealEffectiveBuff(meals[i].upgradeId);
        const effPrice = this.getEffectiveMealPrice(meals[i].upgradeId);
        if (hero.gold >= effPrice) {
          hero.gold -= effPrice;
          this.recordIncome('foodAndDrink', effPrice);
          hero.hunger = 0;
          this.totalHeroShopTransactions += 1;
          if (this.currentDayLedger) {
            this.currentDayLedger.heroTransactions += 1;
          }
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
        this.recordIncome('blacksmithSales', effPrice);

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
    this.recordExpense('facilityInvest', gold);
    this.consumeMaterials(materials);

    if (def.shop === 'potion') {
      this.potionTools[def.id] = lv + 1;
    } else {
      this.blacksmithTools[def.id] = lv + 1;
    }

    this.sound.playUpgrade();
    this.addReputation(2);
    this.addLog(
      `${def.icon} [${def.name}] Lv.${lv + 1} 건설/강화 완료! (-${formatGold(gold)}G)`,
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
    const effMult = this.getStaffEfficiencyMultiplier();
    for (const t of list) {
      const lv = this.getShopToolLevel(shop, t.id);
      if (lv > 0) {
        const mult = t.kind === 'staff' ? effMult : 1.0;
        successAdd += lv * t.successBonusPerLevel * mult;
        speedMult += lv * t.speedBonusPerLevel * mult;
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
    this.recordExpense('craftCost', r.goldCost);
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
    this.recordExpense('craftCost', def.craftGoldCost);
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
      this.checkOptionalQuests();
      this.checkInnRankProgression();
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
        this.checkOptionalQuests();
        this.checkInnRankProgression();
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
      this.checkOptionalQuests();
      this.checkInnRankProgression();
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
        this.checkOptionalQuests();
        this.checkInnRankProgression();
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

    // 대장간에서 단조한 장비를 영웅에게 지급·장착할 때 영웅이 보유 골드 내에서 대장간에 장비 대금을 지불
    const sellPrice = this.getEffectiveEquipSellPrice(def.id);
    const paidByHero = Math.min(
      hero.gold,
      Math.max(Math.round(def.craftGoldCost * 1.15), Math.round(sellPrice * 0.75))
    );
    if (paidByHero > 0) {
      hero.gold -= paidByHero;
      this.recordIncome('blacksmithSales', paidByHero);
      this.totalHeroShopTransactions += 1;
      if (this.currentDayLedger) {
        this.currentDayLedger.heroTransactions += 1;
      }
    }

    this.setHeroInteractionEffect(
      hero,
      def.icon,
      paidByHero > 0 ? `+${paidByHero}G` : '장착!',
      '#e6c274'
    );
    this.triggerHeroSpeech(hero, 'equip_bought');

    this.addLog(
      `🛡️ [${roster.name}]에게 〈${def.name}${
        inst.enhanceLevel > 0 ? ` +${inst.enhanceLevel}` : ''
      }〉을(를) 장착했습니다!${paidByHero > 0 ? ` (+${formatGold(paidByHero)}G 대장간 수입)` : ''}`,
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
      this.recordIncome('blacksmithSales', gold);
      this.consumeMaterials(materials);
    } else {
      if (this.gold < gold || !this.hasMaterials(materials)) {
        return null;
      }
      this.gold -= gold;
      this.recordExpense('craftCost', gold);
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
      this.checkOptionalQuests();
      this.checkInnRankProgression();
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
  // 메인 프레임 업데이트 루프 (초당 자동 골드 없음! 하루 주기 240초 & 행동 수입만)
  // ==========================================================================

  public update(dt: number): void {
    const clampedDt = Math.min(2.0, Math.max(0, dt));
    this.elapsedTime += clampedDt;

    // 1. 하루 시각 진행 (240초 = 1일)
    this.dayTimeSec += clampedDt;
    if (this.dayTimeSec >= DAY_DURATION_SEC) {
      this.settleEndOfDay();
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
        this.autoEventTimer = 54 + this.random() * 20;
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

    // 4. 직원(또는 여관 주인) 자동 서빙 타이머 — 서빙 행위당 수입만 발생
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

    // 10. 2초마다 보조 체크 (자동 매입/소비/자동 파견/등급 승급 백업)
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
      this.checkOptionalQuests();
      this.checkInnRankProgression();
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
    let delay = 6.5 / (1 + rateBonus * 0.32);
    if (this.activeEvent) {
      delay /= this.activeEvent.def.spawnMult;
    }
    return Math.max(2.4, delay + (this.random() * 0.8 - 0.4));
  }

  private updateMaidMovement(dt: number, targetGuest?: GuestEntity): void {
    if ((this.upgrades['staff_maid'] ?? 0) <= 0) return;

    const destX = targetGuest ? targetGuest.x - 10 : 112;
    const destY = targetGuest ? targetGuest.y + 2 : 150;

    const dx = destX - this.maidPos.x;
    const dy = destY - this.maidPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 2) {
      const speed = 58 * this.getStaffEfficiencyMultiplier();
      this.maidPos.x += (dx / dist) * speed * dt;
      this.maidPos.y += (dy / dist) * speed * dt;
      this.maidPos.facing = dx >= 0 ? 'right' : 'left';
    }
  }

  private updateGuests(dt: number): void {
    const walkSpeed = 76;
    const step = walkSpeed * dt;
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
        if (dist <= step + 2) {
          g.x = g.targetX;
          g.y = g.targetY;
          const seat = SEAT_SLOTS.find((s) => s.id === g.seatId);
          g.facing = seat ? seat.facing : 'right';
          g.state = 'waiting';
          g.stateTimer = 0;
        } else {
          g.x += (dx / dist) * step;
          g.y += (dy / dist) * step;
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
        if (dist > step + 3) {
          g.x += (dx / dist) * step;
          g.y += (dy / dist) * step;
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

    // 주문 종류에 따라 일일 장부 항목별 수입 기록
    const incomeCat: IncomeCategory =
      guest.orderType === 'sleep'
        ? 'roomAndRest'
        : guest.orderType === 'repair'
        ? 'blacksmithSales'
        : guest.orderType === 'potion'
        ? 'potionSales'
        : 'guestServing';

    this.recordIncome(incomeCat, earnedGold);
    this.addReputation(earnedRep);
    this.totalServed += 1;
    if (this.currentDayLedger) {
      this.currentDayLedger.servedCount += 1;
    }

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
      0.7,
      def.lootChance + this.getExtraLootChance()
    );
    if (this.random() < lootChance) {
      const hotSpringLv = this.upgrades['fac_hotspring'] ?? 0;
      const lootGold = Math.max(
        4,
        Math.floor(
          earnedGold *
            (0.5 + (def.lootGoldMultiplier - 1) * 0.25 + hotSpringLv * 0.08)
        )
      );
      this.recordIncome('guestServing', lootGold);
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

    this.checkOptionalQuests();
    this.onUiUpdate();
  }

  /**
   * 여관 캔버스 클릭/탭:
   * 1) 맵 위의 영웅을 탭하면 해당 영웅을 선택하여 상태/지시 서랍을 엶
   * 2) 대기 중인 방문 손님을 탭하면 즉시 서빙 (서빙 행위당 수입)
   * 3) 특정 구역을 탭하면 해당 관리 서랍을 엶
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
      return;
    }

    const anyWaiting = this.guests.find((g) => g.state === 'waiting');
    if (anyWaiting) {
      this.serveGuest(anyWaiting, true);
      return;
    }

    // 대기 손님이 없을 때는 허공 클릭 골드 대신 손님 입장을 재촉하고 선택된 영웅 서랍을 닫음
    this.selectedHeroId = null;
    this.innkeeperWaveTimer = 0.35;
    this.spawnTimer = Math.max(0.1, this.spawnTimer - 0.8);
    this.spawnFloatingText(
      Math.max(8, Math.min(MAP_WIDTH - 64, canvasX - 18)),
      Math.max(14, canvasY - 6),
      `🔔 손님 맞이 준비!`,
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

    // 대기 손님이 없을 때는 손님을 즉시 불러와 서빙 행위로 골드를 벌 수 있게 함
    this.innkeeperWaveTimer = 0.4;
    if (this.guests.length < this.getMaxGuests()) {
      this.spawnGuest();
      const justSpawned = this.guests[this.guests.length - 1];
      if (justSpawned && justSpawned.state === 'entering') {
        justSpawned.x = justSpawned.targetX;
        justSpawned.y = justSpawned.targetY;
        justSpawned.state = 'waiting';
        this.serveGuest(justSpawned, true);
        return;
      }
    }
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
    this.eventCooldownSec = 35;
    this.sound.playEvent();

    let extraMsg = '';
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
    const { clockText } = this.getDayPhaseLabel();

    this.logs.unshift({
      id: this.nextLogId++,
      timeText: `${this.dayNumber}일 ${clockText}`,
      text,
      type,
    });
    if (this.logs.length > 24) {
      this.logs.length = 24;
    }
  }

  public getNextGoalDescription(): string {
    const { nextRank, items } = this.getNextRankGoalsProgress();
    if (nextRank && items.length > 0) {
      const parts = items.map(
        (it) =>
          `${it.completed ? '✅' : '▫️'}${it.condition.label} (${formatGold(
            it.current
          )}/${formatGold(it.target)})`
      );
      return `🎯 [${nextRank.title}] 승급 목표: ${parts.join(' · ')}`;
    }
    return '🏆 최고 등급 [Lv.8 전설의 왕국 최고 여관] 달성! 고대 용왕을 격파한 대륙 최고의 쉼터입니다.';
  }

  public getRenderState(): RenderContextState {
    const unlocked = this.getUnlockedHeroes();
    const heroEntities: HeroCanvasEntity[] = unlocked.map((h, idx) => {
      this.ensureHeroAgentFields(h, idx);
      const roster = HERO_ROSTER_MAP[h.id];
      const cls = HERO_CLASSES[roster.classId];
      const primaryPers = PERSONALITIES[roster.personalities[0]];
      const bd = getHeroStatBreakdown(h);
      const hpPct = Math.max(
        0,
        Math.min(1, h.currentHp / Math.max(1, bd.totalStats.hp))
      );

      return {
        heroId: h.id,
        name: roster.name,
        classIcon: cls.icon,
        role: cls.role,
        personalityIcon: primaryPers?.icon ?? '✨',
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
      dayNumber: this.dayNumber,
      dayPhase: this.getDayPhase(),
      dayProgressRatio: this.getDayProgressRatio(),
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
      unpaidWages: this.unpaidWages,
    };
  }
}
