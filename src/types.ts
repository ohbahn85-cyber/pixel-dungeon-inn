export type RankTier = 'C' | 'B' | 'A' | 'S';

export type FacilityId = 'inn' | 'blacksmith' | 'potion' | 'trade';

export type StaffRoleId =
  | 'chef'        // 여관 요리사 (요리 슬롯)
  | 'forger'      // 대장간 제작 장인 (무기 제작 슬롯)
  | 'enhancer'    // 대장간 강화 기술자 (무기 연속 강화 슬롯)
  | 'enchanter'   // 대장간 마법부여사 (무기 인챈트 슬롯)
  | 'alchemist';  // 포션가게 연금술사 (포션 조합 슬롯)

export type WeaponTypeId = 'sword' | 'axe' | 'bow' | 'staff' | 'dagger';

export type MaterialCat = 'food' | 'ore' | 'herb';

export interface MaterialItem {
  id: string;
  name: string;
  category: MaterialCat;
  tier: RankTier;
  icon: string;
  buyPrice: number;
  sellPrice: number;
  desc: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRoleId;
  tier: RankTier;
  level: number;
  bonusProb: number; // 고등급 슬롯 당첨 보너스 확률 (%)
  specialties: WeaponTypeId[]; // 대장간 직원 전용 특화 무기 (요리사/연금술사는 빈 배열)
  specialtyLabel: string;
  hireCost: number;
  avatarColor: string;
  hatColor: string;
}

export interface WeaponEnchant {
  id: string;
  name: string;
  statLabel: string;
  value: number;
  minVal: number;
  maxVal: number;
  color: string;
}

export interface WeaponItem {
  id: string;
  name: string;
  type: WeaponTypeId;
  tier: RankTier;
  icon: string;
  baseAtk: number;
  enhanceCount: number; // +0, +1, +2 ...
  enhanceLocked: boolean; // 강화 슬롯에서 실패(STOP)가 뜨면 그 수치에서 확정 완료!
  enchants: WeaponEnchant[];
  equippedHeroId: string | null;
}

export interface DishItem {
  id: string;
  name: string;
  tier: RankTier;
  icon: string;
  hpBonus: number;
  atkBonus: number;
  spdBonus: number;
  sellGold: number;
  desc: string;
}

export interface PotionItem {
  id: string;
  name: string;
  tier: RankTier;
  icon: string;
  healPct: number;     // 던전 위기 시 체력 회복 %
  atkBuffPct: number;  // 전투 중 공격력 증가 %
  sellGold: number;
  desc: string;
}

export type HeroClassId = 'knight' | 'warrior' | 'archer' | 'mage' | 'rogue';

export interface HeroUnit {
  id: string;
  name: string;
  classId: HeroClassId;
  className: string;
  tier: RankTier;
  level: number;
  exp: number;
  maxLevelCap: number; // C: 10, B: 20, A: 30, S: 40 (단, 현재 여관 레벨에 의해 단계적 해금)
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  currentHp: number;
  weaponId: string | null;
  activeMeal: DishItem | null; // 1회성 출정 요리 버프 (던전 1회 종료 시 소멸)
  equippedPotionId: string | null; // 던전 출정용 포션 1개
  hairColor: string;
  armorColor: string;
}

export interface FacilityPassive {
  id: string;
  name: string;
  desc: string;
  tier: RankTier;
  bonusType: 'slot_luck' | 'gold_income' | 'stat_boost' | 'scrap_bonus';
  value: number;
}

export interface FacilityState {
  id: FacilityId;
  name: string;
  level: number;
  passives: FacilityPassive[];
}

export interface DungeonZone {
  id: string;
  name: string;
  floorText: string;
  recLevel: number;
  recEnhance: number;
  monsterNames: string[];
  bossName: string;
  dropTier: RankTier;
  baseGoldReward: number;
  themeColor: string;
}

export interface MapActor {
  id: string;
  name: string;
  kind: 'hero' | 'staff' | 'guest' | 'monster';
  gridX: number;
  gridY: number;
  targetX: number;
  targetY: number;
  state: 'walk' | 'idle' | 'work' | 'eat' | 'cheer';
  stateTimer: number;
  facing: 'sw' | 'se' | 'nw' | 'ne';
  speechText: string | null;
  speechTimer: number;
  speechTone: 'normal' | 'happy' | 'ugh' | 'gold';
  hairColor: string;
  bodyColor: string;
  accentColor: string;
  weaponIcon?: string;
  roleBadge?: string;
  bouncePhase: number;
  archetype?: 'chef' | 'forger' | 'enhancer' | 'enchanter' | 'alchemist' | 'knight' | 'warrior' | 'archer' | 'mage' | 'rogue';
  weaponType?: 'sword' | 'axe' | 'bow' | 'staff' | 'dagger';
}

export interface FloatingPop {
  id: string;
  gridX: number;
  gridY: number;
  text: string;
  color: string;
  age: number;
  maxAge: number;
}

export interface ActiveDungeonRun {
  zoneId: string;
  partyIds: string[];
  wave: number;
  maxWaves: number;
  waveTimer: number;
  slotSpinTimer: number;
  currentSlotSymbols: [string, string, string];
  lastSlotEffect: string;
  monsterHp: number;
  monsterMaxHp: number;
  monsterName: string;
  isBoss: boolean;
  accumulatedGold: number;
  accumulatedDrops: { materialId: string; count: number }[];
  status: 'fighting' | 'reward_slot' | 'victory' | 'defeat';
  rewardMultiplier: number;
  rewardSpun: boolean;
  combatLogs: string[];
}

export interface GameSaveData {
  version: number;
  savedAt: number;
  year: number;
  month: number;
  week: number;
  gold: number;
  scrap: number; // 슬롯 결과를 [버리기] 했을 때 얻는 마일리지 가루 (거래처에서 확정 교환)
  materials: Record<string, number>;
  facilities: Record<FacilityId, FacilityState>;
  staff: Record<StaffRoleId, StaffMember>;
  heroes: HeroUnit[];
  weapons: WeaponItem[];
  dishes: DishItem[];
  potions: PotionItem[];
  clearedDungeons: Record<string, number>;
  totalSlotSpins: number;
  totalJackpots: number;
}
