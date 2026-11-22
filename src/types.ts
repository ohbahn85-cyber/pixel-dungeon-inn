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
}
