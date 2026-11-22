export type UpgradeCategory = 'menu' | 'room' | 'staff' | 'facility';

export interface UpgradeDef {
  id: string;
  category: UpgradeCategory;
  name: string;
  icon: string;
  description: string;
  flavor: string;
  baseCost: number;
  costScale: number;
  unlockRep: number;
  gpsPerLevel: number; // v4에서는 수동 수입 제거, 하위 호환 참조용(0)
  clickPerLevel: number;
  dailyWagePerLevel?: number;
  dailyUpkeepPerLevel?: number;
  repPerServeBonus?: number;
  maxGuestsBonusPerLevel?: number;
  autoServeSpeedBonus?: number;
  spawnRateBonus?: number;
  globalMultiplierBonus?: number;
  lootChanceBonus?: number;
  offlineBonusPerLevel?: number;
}

export type GuestId =
  | 'traveler'
  | 'warrior'
  | 'rogue'
  | 'mage'
  | 'paladin'
  | 'dwarf'
  | 'elf'
  | 'dragon_lord';

export type OrderType = 'stew' | 'ale' | 'potion' | 'sleep' | 'repair';

export interface GuestTypeDef {
  id: GuestId;
  name: string;
  title: string;
  unlockRep: number;
  baseGold: number;
  baseRep: number;
  lootName: string;
  lootChance: number;
  lootGoldMultiplier: number;
  preferredOrders: OrderType[];
  quotes: string[];
  sleepQuotes: string[];
  badgeColor: string;
  description: string;
}

export type GuestState = 'entering' | 'waiting' | 'enjoying' | 'leaving';

export interface SeatSlot {
  id: string;
  x: number;
  y: number;
  tableX?: number;
  tableY?: number;
  facing: 'left' | 'right';
  type: 'table' | 'counter' | 'room' | 'smithy';
}

export interface GuestEntity {
  uid: number;
  typeId: GuestId;
  state: GuestState;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  facing: 'left' | 'right';
  seatId: string;
  seatType: 'table' | 'counter' | 'room' | 'smithy';
  orderType: OrderType;
  stateTimer: number;
  maxWaitTime: number;
  animTime: number;
  quoteText: string | null;
  quoteTimer: number;
  isSleeping: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface CoinParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface RandomEventDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  durationSec: number;
  goldMult: number;
  spawnMult: number;
  lootChanceAdd: number;
  instantGoldFactor?: number;
  instantRep?: number;
  weather?: 'rain' | 'celebration' | 'normal';
}

export interface ActiveEvent {
  def: RandomEventDef;
  remainingSec: number;
}

export type RankGoalKind =
  | 'reputation'
  | 'dungeon_clear'
  | 'hero_count'
  | 'upgrade_total_levels'
  | 'staff_total_levels'
  | 'daily_net_profit'
  | 'potions_crafted'
  | 'equips_crafted'
  | 'enhance_success';

export interface InnRankGoalCondition {
  id: string;
  kind: RankGoalKind;
  label: string;
  target: number;
  dungeonId?: string;
}

export interface InnLevelDef {
  level: number;
  title: string;
  requiredRep: number;
  rewardText: string;
  rewardGold: number;
  goals: InnRankGoalCondition[];
}

export interface OptionalQuestDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  rewardGold: number;
  rewardRep: number;
}

export type DayPhase = 'morning' | 'day' | 'evening' | 'night';

export type IncomeCategory =
  | 'foodAndDrink'
  | 'guestServing'
  | 'roomAndRest'
  | 'potionSales'
  | 'blacksmithSales'
  | 'lootMargin';

export type ExpenseCategory =
  | 'wages'
  | 'upkeep'
  | 'craftCost'
  | 'lootPurchase'
  | 'facilityInvest';

export interface DailyIncomeBreakdown {
  foodAndDrink: number;
  guestServing: number;
  roomAndRest: number;
  potionSales: number;
  blacksmithSales: number;
  lootMargin: number;
  totalIncome: number;
}

export interface DailyExpenseBreakdown {
  wages: number;
  upkeep: number;
  craftCost: number;
  lootPurchase: number;
  facilityInvest: number;
  totalOperatingExpense: number;
  totalWithInvest: number;
}

export interface DailyFinancialReport {
  day: number;
  income: DailyIncomeBreakdown;
  expense: DailyExpenseBreakdown;
  netProfit: number; // 영업 순이익 (totalIncome - totalOperatingExpense)
  netCashFlow: number; // 시설 투자 포함 현금 증감
  endGold: number;
  innRank: number;
  innRankTitle: string;
  servedCount: number;
  heroTransactions: number;
  dungeonWins: number;
  dungeonFails: number;
  newHeroesJoined: string[];
  injuredHeroes: string[];
  wageArrears: number;
}

export interface LogEntry {
  id: number;
  timeText: string;
  text: string;
  type: 'normal' | 'loot' | 'event' | 'unlock';
}

// ============================================================================
// 순환 경제 · 고유 영웅 · 던전 · 포션 가게 · 대장간 (+강화) · 살아있는 여관 에이전트 타입
// ============================================================================

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface StatBlock {
  atk: number;
  def: number;
  agi: number;
  int: number;
  hp: number;
  luk: number;
}

export type HeroClassId =
  | 'warrior'
  | 'paladin'
  | 'rogue'
  | 'archer'
  | 'mage'
  | 'cleric'
  | 'berserker'
  | 'dwarf_mercenary'
  | 'traveler';

export type HeroRole = 'tank' | 'dps' | 'healer' | 'support';

export type EquipSlot = 'weapon' | 'armor' | 'offhand' | 'accessory';

export type WeaponSubType = 'sword' | 'axe' | 'bow' | 'dagger' | 'staff' | 'mace';
export type ArmorSubType = 'heavy' | 'light' | 'robe';
export type OffhandSubType = 'shield' | 'quiver' | 'tome';
export type AccessorySubType = 'ring';
export type EquipSubType =
  | WeaponSubType
  | ArmorSubType
  | OffhandSubType
  | AccessorySubType;

export interface HeroClassDef {
  id: HeroClassId;
  name: string;
  icon: string;
  role: HeroRole;
  roleName: string;
  baseSpriteId: GuestId;
  description: string;
  baseStats: StatBlock;
  growthPerLevel: StatBlock;
  allowedWeapons: WeaponSubType[];
  allowedArmors: ArmorSubType[];
  allowedOffhands: OffhandSubType[];
  baseEquipIds: Record<EquipSlot, string>;
}

export type PersonalityId =
  | 'brave'
  | 'cautious'
  | 'greedy'
  | 'loyal'
  | 'hotblooded'
  | 'cheerful'
  | 'lone_wolf'
  | 'arrogant'
  | 'merciful'
  | 'playful';

export interface PersonalityDef {
  id: PersonalityId;
  name: string;
  icon: string;
  description: string;
  sampleQuote: string;
}

export interface PersonalityPairRule {
  id: string;
  a: PersonalityId;
  b: PersonalityId;
  title: string;
  isPositive: boolean;
  successRateBonus: number;
  statMultBonus?: Partial<Record<keyof StatBlock, number>>;
  extraGoldMult?: number;
  extraXpMult?: number;
  injuryRiskDelta?: number;
  description: string;
}

export type OriginId =
  | 'northern_tribe'
  | 'elven_forest'
  | 'noble_house'
  | 'slums'
  | 'temple_orphan'
  | 'dwarf_mountain'
  | 'magic_tower'
  | 'wandering_caravan';

export type DungeonTag =
  | 'cave'
  | 'camp'
  | 'forest'
  | 'magic'
  | 'mine'
  | 'sanctum'
  | 'volcano';

export interface OriginDef {
  id: OriginId;
  name: string;
  icon: string;
  description: string;
  preferredDungeonTags: DungeonTag[];
  dungeonSuccessBonus: number;
  statBonusPct: Partial<Record<keyof StatBlock, number>>;
  goldBonusPct: number;
  lootChanceBonus: number;
  durationReductionPct: number;
  enhanceBonusPct: number;
  setSynergyTitle: string;
  setSynergySuccessBonus: number;
}

export interface HeroUnlockCondition {
  isStarter?: boolean;
  minRep?: number;
  dungeonClear?: {
    dungeonId: string;
    count: number;
  };
  description: string;
}

export interface HeroRosterDef {
  id: string;
  name: string;
  title: string;
  classId: HeroClassId;
  personalities: PersonalityId[];
  originId: OriginId;
  backstory: string;
  joinQuote: string;
  expeditionQuote: string;
  unlock: HeroUnlockCondition;
  paletteOverrides: Record<string, string>;
}

export type HeroStatus = 'idle' | 'exploring' | 'resting' | 'injured' | 'fatigued';

export type InnZoneId =
  | 'dining'
  | 'bar'
  | 'room'
  | 'potion'
  | 'blacksmith'
  | 'trade'
  | 'board'
  | 'gate'
  | 'hall';

export type HeroActivityState =
  | 'idle'
  | 'walking'
  | 'eating'
  | 'drinking'
  | 'shopping_potion'
  | 'shopping_equip'
  | 'enhancing'
  | 'selling_loot'
  | 'sleeping'
  | 'rallying'
  | 'exploring';

export type PlayerOrderKind =
  | 'eat_meal'
  | 'drink_ale'
  | 'rest_room'
  | 'buy_potion'
  | 'buy_equip'
  | 'enhance_equip'
  | 'sell_loot'
  | 'rally_board'
  | 'depart_dungeon';

export interface HeroPlayerOrder {
  kind: PlayerOrderKind;
  targetId?: string;
  slot?: EquipSlot;
  stockUid?: number;
  label: string;
}

export interface HeroInteractionEffect {
  icon: string;
  text: string;
  color: string;
  timer: number;
}

export interface HeroBuff {
  id: string;
  name: string;
  icon: string;
  source: 'food' | 'potion' | 'rest';
  statBonusPct: Partial<Record<keyof StatBlock, number>>;
  flatStatBonus?: Partial<StatBlock>;
  successRateBonus: number;
  xpMultBonus: number;
  injuryImmune?: boolean;
  remainingRuns: number;
}

export interface HeroLootStack {
  materialId: string;
  count: number;
  ageSeconds: number;
}

export interface EquipmentDef {
  id: string;
  name: string;
  icon: string;
  slot: EquipSlot;
  subType: EquipSubType;
  rarity: RarityTier;
  isBase: boolean;
  description: string;
  stats: Partial<StatBlock>;
  buyPriceGold: number;
  craftGoldCost: number;
  craftMaterials: Record<string, number>;
  reqToolId?: string;
  reqToolLevel?: number;
  reqFacilityId?: string;
  reqFacilityLevel?: number;
  craftTimeSec: number;
  baseSuccessRate: number;
  fallbackEquipId?: string;
}

export interface EquipmentInstance {
  uid: number;
  defId: string;
  enhanceLevel: number;
}

export interface HeroState {
  id: string;
  unlocked: boolean;
  level: number;
  xp: number;
  currentHp: number;
  gold: number;
  status: HeroStatus;
  restTimerSec: number;
  expeditionId: string | null;
  equipment: Record<EquipSlot, EquipmentInstance>;
  buffs: HeroBuff[];
  lootBag: HeroLootStack[];
  totalRuns: number;
  totalWins: number;
  lastMealTimer: number;
  // v3 & v4 살아있는 여관 에이전트 확장 필드
  hunger?: number; // 0(배부름) ~ 100(매우 배고픔)
  fatigue?: number; // 0(상쾌함) ~ 100(극심한 피로)
  morale?: number; // 0 ~ 100
  tileX?: number;
  tileY?: number;
  x?: number;
  y?: number;
  facing?: 'left' | 'right';
  path?: { col: number; row: number }[];
  targetTileX?: number;
  targetTileY?: number;
  targetZone?: InnZoneId;
  activity?: HeroActivityState;
  activityTimer?: number;
  hesitateTimer?: number; // 신중 성격 등 잠시 멈칫하는 타이머
  intentText?: string;
  partyId?: string | null;
  rallyDungeonId?: string | null;
  playerOrder?: HeroPlayerOrder | null;
  speechText?: string | null;
  speechTimer?: number;
  speechCooldown?: number;
  interactionEffect?: HeroInteractionEffect | null;
}

export interface ShopMarketConfig {
  mealSaleEnabled: boolean;
  mealPriceMultiplier: number; // 0.8 | 1.0 | 1.25 | 1.5
  potionSaleEnabled: Record<string, boolean>;
  potionPriceMultiplier: number; // 0.8 | 1.0 | 1.25 | 1.5
  lootBuyEnabled: Record<string, boolean>;
  lootBuyRatePct: number; // 75 | 90 | 100 | 115
  lootReserveGold: number; // 최소 남겨둘 여관 비상금
  blacksmithSaleEnabled: boolean;
  blacksmithPriceMultiplier: number; // 0.8 | 1.0 | 1.25
  blacksmithAutoEnhanceEnabled: boolean;
}

export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  rarity: RarityTier;
  buyPrice: number;
  peddlerPrice: number;
  sourceDungeonId: string;
  description: string;
}

export interface DungeonDropEntry {
  materialId: string;
  chance: number;
  minCount: number;
  maxCount: number;
}

export interface DungeonDef {
  id: string;
  name: string;
  icon: string;
  tier: number;
  tag: DungeonTag;
  description: string;
  focusText: string;
  durationSec: number;
  recommendedPower: number;
  requiredStats: StatBlock;
  statWeights: Record<keyof StatBlock, number>;
  unlockRep: number;
  unlockPrevDungeonId?: string;
  unlockPrevClears?: number;
  rewardXp: number;
  rewardHeroGold: number;
  rewardRep: number;
  drops: DungeonDropEntry[];
}

export type MonsterSpriteType =
  | 'slime'
  | 'goblin'
  | 'wolf'
  | 'golem'
  | 'troll'
  | 'knight'
  | 'dragon';

export type MonsterBehaviorType =
  | 'charge'
  | 'ranged'
  | 'poison'
  | 'swarm'
  | 'heavy';

export type DungeonRoomType =
  | 'combat'
  | 'treasure'
  | 'trap'
  | 'rest'
  | 'event'
  | 'elite'
  | 'boss';

export interface DungeonRoomNode {
  id: string;
  floor: number;
  branchIndex: number; // 0 또는 1 (갈래 방)
  type: DungeonRoomType;
  label: string;
  icon: string;
  nextIds: string[];
}

export interface DungeonEventChoiceOption {
  id: string;
  label: string;
  effectText: string;
  kind: 'heal' | 'gold' | 'loot' | 'buff_atk' | 'haste';
}

export interface DungeonEventChoiceDef {
  id: string;
  title: string;
  description: string;
  options: DungeonEventChoiceOption[];
}

export interface ActiveDungeonEventPrompt {
  eventId: string;
  title: string;
  description: string;
  options: DungeonEventChoiceOption[];
  autoResolveTimer: number;
  resolvedOptionId?: string;
}

export type SkillVisualKind =
  | 'shield_taunt'
  | 'holy_barrier'
  | 'heal_light'
  | 'aoe_magic'
  | 'arrow_shot'
  | 'crit_slash'
  | 'trap_disarm'
  | 'cleave_axe'
  | 'iron_wall'
  | 'rally_buff'
  | 'monster_projectile'
  | 'poison_cloud'
  | 'fire_breath';

export interface ExpeditionSkillEffect {
  id: number;
  kind: SkillVisualKind;
  label: string;
  color: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  life: number;
  maxLife: number;
}

export interface ExpeditionMonsterUnit {
  id: string;
  name: string;
  spriteType: MonsterSpriteType;
  behavior: MonsterBehaviorType;
  behaviorLabel: string;
  maxHp: number;
  currentHp: number;
  atk: number;
  isBoss: boolean;
  isElite?: boolean;
  hitFlashTimer: number;
  lungeTimer: number;
}

export interface ExpeditionCombatFloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

export interface ExpeditionDropVisual {
  x: number;
  y: number;
  icon: string;
  name: string;
  count: number;
  life: number;
}

export interface ExpeditionFloorLog {
  id: number;
  floor: number;
  text: string;
  type: 'march' | 'combat' | 'drop' | 'boss' | 'win' | 'retreat';
}

export interface ActiveExpedition {
  id: string;
  dungeonId: string;
  heroIds: string[];
  totalDurationSec: number;
  remainingSec: number;
  expectedSuccessRate: number;
  // v3 & v4 층별 갈래 방 던전 탐험 & 직업 스킬 자동 전투 상태
  totalFloors?: number;
  currentFloor?: number;
  floorPhase?: 'marching' | 'fighting' | 'floor_clear' | 'completed' | 'retreated';
  marchProgress?: number; // 0..1
  roomGraph?: DungeonRoomNode[][];
  currentRoomId?: string;
  currentRoomType?: DungeonRoomType;
  visitedRoomIds?: string[];
  roomResolved?: boolean;
  activeEventPrompt?: ActiveDungeonEventPrompt | null;
  monsters?: ExpeditionMonsterUnit[];
  partyCombatState?: Record<
    string,
    {
      currentHp: number;
      maxHp: number;
      hitFlashTimer: number;
      lungeTimer: number;
      stanceOffset?: number; // 용감 돌진(+), 신중 후퇴(-)
      skillIcon?: string | null;
      skillTimer?: number;
      combatSpeech?: string | null;
      combatSpeechTimer?: number;
    }
  >;
  skillEffects?: ExpeditionSkillEffect[];
  combatRoundTimer?: number;
  floorTransitionTimer?: number;
  combatFloats?: ExpeditionCombatFloatingText[];
  dropVisuals?: ExpeditionDropVisual[];
  floorLogs?: ExpeditionFloorLog[];
  accumulatedLoot?: Record<string, number>;
  bonusGoldEarned?: number;
  willSucceed?: boolean;
  failAtFloor?: number;
}

export interface ExpeditionResultSummary {
  id: number;
  timestampText: string;
  dungeonId: string;
  dungeonName: string;
  heroIds: string[];
  heroNames: string[];
  success: boolean;
  successRateUsed: number;
  xpGained: number;
  heroGoldGained: number;
  lootDropped: Record<string, number>;
  injuredHeroNames: string[];
  synergySummaryText: string;
  reachedFloor?: number;
  totalFloors?: number;
  floorLogs?: ExpeditionFloorLog[];
}

export interface ShopToolDef {
  id: string;
  shop: 'potion' | 'blacksmith';
  kind: 'tool' | 'facility' | 'staff';
  name: string;
  icon: string;
  description: string;
  baseGoldCost: number;
  costScale: number;
  dailyWagePerLevel?: number;
  dailyUpkeepPerLevel?: number;
  materialCostsPerLevel: Record<string, number>;
  materialStartLevel: number;
  maxLevel: number;
  successBonusPerLevel: number;
  speedBonusPerLevel: number;
  slotBonusAtLevels?: number[];
}

export interface PotionRecipeDef {
  id: string;
  name: string;
  icon: string;
  rarity: RarityTier;
  description: string;
  effectText: string;
  materials: Record<string, number>;
  goldCost: number;
  reqToolId: string;
  reqToolLevel: number;
  reqFacilityId?: string;
  reqFacilityLevel?: number;
  craftTimeSec: number;
  baseSuccessRate: number;
  fallbackPotionId: string | null;
  sellPriceToHero: number;
  healsInjury: boolean;
  healsFatigue: boolean;
  hpRestorePct: number;
  buff?: Omit<HeroBuff, 'remainingRuns'> & { runs: number };
}

export interface CraftQueueItem {
  uid: number;
  shop: 'potion' | 'blacksmith';
  recipeId: string;
  totalSec: number;
  remainingSec: number;
  successRate: number;
}

export interface EnhanceAttemptResult {
  success: boolean;
  destroyed: boolean;
  itemName: string;
  prevLevel: number;
  newLevel: number;
  chanceUsed: number;
  heroName?: string;
}

export interface SaveData {
  version: number;
  gold: number;
  totalGoldEarned: number;
  reputation: number;
  innRank?: number;
  totalServed: number;
  totalLootFound: number;
  upgrades: Record<string, number>;
  discoveredGuests: Record<string, number>;
  muted: boolean;
  tutorialSeen: boolean;
  lastSavedAt: number;
  // v2, v3, v4 순환 시스템 · 하루 경제 · 여관 등급 확장 필드
  heroes?: Record<string, HeroState>;
  materials?: Record<string, number>;
  potionTools?: Record<string, number>;
  potionStock?: Record<string, number>;
  blacksmithTools?: Record<string, number>;
  equipmentStock?: EquipmentInstance[];
  craftQueues?: {
    potion: CraftQueueItem[];
    blacksmith: CraftQueueItem[];
  };
  expeditions?: ActiveExpedition[];
  dungeonClears?: Record<string, number>;
  dungeonAttempts?: Record<string, number>;
  recentExpeditionResults?: ExpeditionResultSummary[];
  autoBuyLoot?: boolean;
  autoDispatch?: boolean;
  shopConfig?: ShopMarketConfig;
  nextEquipUid?: number;
  totalPotionsCrafted?: number;
  totalEquipCrafted?: number;
  totalEnhanceSuccess?: number;
  totalEnhanceDestroyed?: number;
  totalPeddlerSales?: number;
  // v4 하루 경제 & 등급 목표 확장 필드
  dayNumber?: number;
  dayTimeSec?: number;
  currentDayLedger?: DailyFinancialReport;
  dayHistory?: DailyFinancialReport[];
  unpaidWages?: number;
  completedQuests?: Record<string, boolean>;
  maxDailyNetProfitReached?: number;
}
