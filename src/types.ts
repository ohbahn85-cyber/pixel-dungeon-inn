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
  gpsPerLevel: number;
  clickPerLevel: number;
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

export interface InnLevelDef {
  level: number;
  title: string;
  requiredRep: number;
  rewardText: string;
}

export interface LogEntry {
  id: number;
  timeText: string;
  text: string;
  type: 'normal' | 'loot' | 'event' | 'unlock';
}

// ============================================================================
// 순환 경제 · 고유 영웅 · 던전 · 포션 가게 · 대장간 (+강화) 확장 타입
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
  successRateBonus: number; // e.g. +0.06 or -0.06
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
  dungeonSuccessBonus: number; // 선호 던전 성공률 보너스
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
}

export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  rarity: RarityTier;
  buyPrice: number; // 플레이어가 영웅에게서 매입하는 정가
  peddlerPrice: number; // 행상인 자동 매각 가격 (안전장치)
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

export interface ActiveExpedition {
  id: string;
  dungeonId: string;
  heroIds: string[];
  totalDurationSec: number;
  remainingSec: number;
  expectedSuccessRate: number;
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
  materialCostsPerLevel: Record<string, number>; // 레벨업 시 필요한 재료 기본치
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
  recipeId: string; // potionId or equipmentDefId
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
  totalServed: number;
  totalLootFound: number;
  upgrades: Record<string, number>;
  discoveredGuests: Record<string, number>;
  muted: boolean;
  tutorialSeen: boolean;
  lastSavedAt: number;
  // v2 순환 시스템 확장 필드
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
  nextEquipUid?: number;
  totalPotionsCrafted?: number;
  totalEquipCrafted?: number;
  totalEnhanceSuccess?: number;
  totalEnhanceDestroyed?: number;
  totalPeddlerSales?: number;
}
