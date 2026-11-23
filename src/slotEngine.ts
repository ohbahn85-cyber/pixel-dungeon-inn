import {
  ALL_WEAPON_TYPES,
  ENCHANT_OPTIONS,
  FACILITY_PASSIVE_POOL,
  HERO_CLASS_META,
  HERO_NAMES,
  HERO_TIER_BASE_MULT,
  HERO_TIER_MAX_CAP,
  STAFF_NAME_POOL,
  WEAPON_TYPE_META,
} from './data';
import {
  DishItem,
  FacilityId,
  FacilityPassive,
  GameSaveData,
  HeroClassId,
  HeroUnit,
  PotionItem,
  RankTier,
  StaffMember,
  StaffRoleId,
  WeaponEnchant,
  WeaponItem,
  WeaponTypeId,
} from './types';

export interface TierProbabilities {
  C: number;
  B: number;
  A: number;
  S: number;
}

let customRng: (() => number) | null = null;

/**
 * 시뮬레이션 재현성을 위한 시드 고정 PRNG(Mulberry32) 설정.
 * 브라우저 기본 플레이 시에는 null(Math.random 사용).
 */
export function setSlotRngSeed(seed: number | null): void {
  if (seed === null) {
    customRng = null;
    return;
  }
  let a = seed >>> 0;
  customRng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slotRandom(): number {
  return customRng ? customRng() : Math.random();
}

/**
 * 베팅한 재료 등급 조합 + 담당 직원 보너스 + 시설 패시브 보너스를 합산해
 * C / B / A / S 당첨 확률(%)을 계산합니다.
 */
export function calculateSlotProbabilities(
  betTiers: RankTier[],
  staffBonusPct: number,
  facilityBonusPct: number,
  specialtyBonusPct = 0
): TierProbabilities {
  // 재료 등급 점수 (C: 10, B: 32, A: 65, S: 100)
  const tierScoreMap: Record<RankTier, number> = {
    C: 10,
    B: 32,
    A: 65,
    S: 100,
  };

  const avgScore =
    betTiers.length > 0
      ? betTiers.reduce((acc, t) => acc + tierScoreMap[t], 0) / betTiers.length
      : 10;

  // 서로 다른 재료나 고등급 조합 보너스
  const totalShift =
    avgScore * 0.72 + staffBonusPct + facilityBonusPct + specialtyBonusPct;

  let probS = Math.max(2, Math.min(58, Math.round((totalShift - 18) * 0.45)));
  if (avgScore < 15 && staffBonusPct < 10) {
    probS = Math.max(1, Math.min(5, probS));
  }
  let probA = Math.max(6, Math.min(55, Math.round(totalShift * 0.55)));
  let probB = Math.max(18, Math.min(60, Math.round(25 + totalShift * 0.35)));

  const sumSAB = probS + probA + probB;
  let probC = Math.max(5, 100 - sumSAB);

  // 정규화하여 합이 100%가 되도록 보정
  const total = probC + probB + probA + probS;
  probS = Math.round((probS / total) * 100);
  probA = Math.round((probA / total) * 100);
  probB = Math.round((probB / total) * 100);
  probC = Math.max(0, 100 - (probS + probA + probB));

  return { C: probC, B: probB, A: probA, S: probS };
}

const THEME_FACES: Record<string, Record<RankTier, string>> = {
  cook: { C: 'mushroom', B: 'meat', A: 'cheese', S: 'seven' },
  hero: { C: 'hero', B: 'star', A: 'chest', S: 'seven' },
  forge: { C: 'copper', B: 'steel', A: 'sword', S: 'seven' },
  potion: { C: 'herb', B: 'flask', A: 'potion', S: 'seven' },
  staff: { C: 'hero', B: 'bell', A: 'star', S: 'seven' },
  facility: { C: 'copper', B: 'coin', A: 'chest', S: 'seven' },
  default: { C: 'cherry', B: 'bell', A: 'gem', S: 'seven' },
};

export function rollTierFromProbs(
  probs: TierProbabilities,
  theme: keyof typeof THEME_FACES = 'default'
): {
  tier: RankTier;
  isJackpot: boolean;
  reels: [string, string, string];
} {
  const r = slotRandom() * 100;
  let tier: RankTier = 'C';
  if (r < probs.S) {
    tier = 'S';
  } else if (r < probs.S + probs.A) {
    tier = 'A';
  } else if (r < probs.S + probs.A + probs.B) {
    tier = 'B';
  } else {
    tier = 'C';
  }

  const isJackpot = tier === 'S' || (tier === 'A' && slotRandom() < 0.35);
  const symbolMap = THEME_FACES[theme] || THEME_FACES.default;
  const mainSym = symbolMap[tier];
  const pool = Object.values(symbolMap);
  const reels: [string, string, string] = isJackpot
    ? [mainSym, mainSym, mainSym]
    : [
        mainSym,
        mainSym,
        pool.find((s) => s !== mainSym) || 'cherry',
      ];

  return { tier, isJackpot, reels };
}

export function getFacilityLuckBonus(
  save: GameSaveData,
  facilityId: FacilityId
): number {
  const fac = save.facilities[facilityId];
  const passiveLuck = fac.passives
    .filter((p) => p.bonusType === 'slot_luck')
    .reduce((acc, p) => acc + p.value, 0);
  return (fac.level - 1) * 3 + passiveLuck;
}

/**
 * 1. 직원 고용 슬롯 결과 생성
 * 좋은 등급의 직원일수록 특화 무기 개수가 많아지고 확률 보너스가 크게 상승합니다!
 */
export function rollStaffHireCandidate(
  save: GameSaveData,
  role: StaffRoleId,
  betTier: RankTier
): {
  candidate: StaffMember;
  reels: [string, string, string];
  isJackpot: boolean;
  scrapRefund: number;
} {
  const facId =
    role === 'chef'
      ? 'inn'
      : role === 'alchemist'
      ? 'potion'
      : 'blacksmith';
  const probs = calculateSlotProbabilities(
    [betTier],
    save.staff[role].bonusProb,
    getFacilityLuckBonus(save, facId)
  );
  const { tier, isJackpot, reels } = rollTierFromProbs(probs, 'staff');

  const names = STAFF_NAME_POOL[role][tier];
  const name = names[Math.floor(slotRandom() * names.length)];

  const tierBonusBase: Record<RankTier, number> = {
    C: 5,
    B: 14,
    A: 26,
    S: 42,
  };
  const bonusProb =
    tierBonusBase[tier] + Math.floor(slotRandom() * 5) + (isJackpot ? 4 : 0);

  // 대장간 직원은 등급이 높을수록 다룰 줄 아는 특화 무기 개수가 늘어남! (C: 1종, B: 2종, A: 3~4종, S: 5종 전체 마스터!)
  let specialties: WeaponTypeId[] = [];
  let specialtyLabel = '모든 레시피 숙련';

  if (role === 'forger' || role === 'enhancer' || role === 'enchanter') {
    const countMap: Record<RankTier, number> = { C: 1, B: 2, A: 3, S: 5 };
    const count = countMap[tier];
    const shuffled = [...ALL_WEAPON_TYPES].sort(() => slotRandom() - 0.5);
    specialties = shuffled.slice(0, count);
    if (count === 5) {
      specialtyLabel = '전 무기(🗡️🪓🏹🪄🔪) 마스터 (+15% 특화)';
    } else {
      specialtyLabel =
        specialties.map((w) => `${WEAPON_TYPE_META[w].icon}${WEAPON_TYPE_META[w].name}`).join('·') +
        ' 특화 (+12%)';
    }
  } else if (role === 'chef') {
    const chefLabels: Record<RankTier, string> = {
      C: '가정식 스튜 & 구이',
      B: '고급 스테이크 & 화덕요리',
      A: '왕실 코스 요리 & 특선 만찬',
      S: '천상의 드래곤 연회 마스터',
    };
    specialtyLabel = chefLabels[tier];
  } else {
    const alchLabels: Record<RankTier, string> = {
      C: '기초 치유 물약 조제',
      B: '고농축 활력 비약 연성',
      A: '심연의 광폭 영약 연성',
      S: '불사조의 신비 엘릭서 마스터',
    };
    specialtyLabel = alchLabels[tier];
  }

  const colors: Record<RankTier, { av: string; hat: string }> = {
    C: { av: '#64748b', hat: '#94a3b8' },
    B: { av: '#0284c7', hat: '#38bdf8' },
    A: { av: '#9333ea', hat: '#c084fc' },
    S: { av: '#d97706', hat: '#fbbf24' },
  };

  const candidate: StaffMember = {
    id: `staff_${role}_${Date.now()}`,
    name,
    role,
    tier,
    level: 1,
    bonusProb,
    specialties,
    specialtyLabel,
    hireCost: 0,
    avatarColor: colors[tier].av,
    hatColor: colors[tier].hat,
  };

  const scrapMap: Record<RankTier, number> = { C: 6, B: 14, A: 28, S: 55 };
  return {
    candidate,
    reels,
    isJackpot,
    scrapRefund: scrapMap[betTier],
  };
}

/**
 * 2. 영웅 영입 슬롯 결과 생성
 * 고등급 영웅도 Lv.1로 시작하며 여관 레벨에 따라 현재 최대 레벨 상한이 단계적으로 풀립니다.
 */
export function rollHeroRecruitCandidate(
  save: GameSaveData,
  betTier: RankTier
): {
  hero: HeroUnit;
  reels: [string, string, string];
  isJackpot: boolean;
  scrapRefund: number;
} {
  const probs = calculateSlotProbabilities(
    [betTier],
    save.staff.chef.bonusProb,
    getFacilityLuckBonus(save, 'inn')
  );
  const { tier, isJackpot, reels } = rollTierFromProbs(probs, 'hero');

  const classes: HeroClassId[] = ['knight', 'warrior', 'archer', 'mage', 'rogue'];
  const classId = classes[Math.floor(slotRandom() * classes.length)];
  const meta = HERO_CLASS_META[classId];
  const usedNames = new Set(save.heroes.map((h) => h.name));
  const availNames = HERO_NAMES.filter((n) => !usedNames.has(n));
  const baseName =
    availNames.length > 0
      ? availNames[Math.floor(slotRandom() * availNames.length)]
      : HERO_NAMES[Math.floor(slotRandom() * HERO_NAMES.length)];

  const mult = HERO_TIER_BASE_MULT[tier] * (isJackpot ? 1.08 : 1.0);
  const baseHp = Math.round(meta.baseHp * mult);
  const baseAtk = Math.round(meta.baseAtk * mult);
  const baseDef = Math.round(meta.baseDef * mult);

  const hero: HeroUnit = {
    id: `hero_${Date.now()}_${Math.floor(slotRandom() * 999)}`,
    name: baseName,
    classId,
    className: meta.name,
    tier,
    level: 1,
    exp: 0,
    maxLevelCap: HERO_TIER_MAX_CAP[tier],
    baseHp,
    baseAtk,
    baseDef,
    currentHp: baseHp,
    weaponId: null,
    activeMeal: null,
    equippedPotionId: null,
    hairColor: meta.hairColor,
    armorColor: meta.armorColor,
  };

  const scrapMap: Record<RankTier, number> = { C: 8, B: 16, A: 32, S: 60 };
  return {
    hero,
    reels,
    isJackpot,
    scrapRefund: scrapMap[betTier],
  };
}

/**
 * 3. 여관 요리 1회 슬롯 (식재료 2개 조합 -> 1회성 출정 버프 요리 생성)
 */
export function rollCookingDish(
  save: GameSaveData,
  matTier1: RankTier,
  matTier2: RankTier
): {
  dish: DishItem;
  reels: [string, string, string];
  isJackpot: boolean;
  scrapRefund: number;
} {
  const combBonus = matTier1 !== matTier2 ? 6 : 3;
  const probs = calculateSlotProbabilities(
    [matTier1, matTier2],
    save.staff.chef.bonusProb,
    getFacilityLuckBonus(save, 'inn'),
    combBonus
  );
  const { tier, isJackpot, reels } = rollTierFromProbs(probs, 'cook');

  const dishCatalog: Record<
    RankTier,
    { name: string; icon: string; hp: number; atk: number; spd: number; gold: number }[]
  > = {
    C: [
      { name: '따끈한 버섯 고기스튜', icon: '🍲', hp: 50, atk: 7, spd: 5, gold: 45 },
      { name: '숯불 멧돼지 꼬치구이', icon: '🍢', hp: 40, atk: 10, spd: 6, gold: 50 },
    ],
    B: [
      { name: '서리등심 버터 스테이크', icon: '🥩', hp: 110, atk: 18, spd: 10, gold: 120 },
      { name: '황금 치즈 그라탕', icon: '🥘', hp: 130, atk: 15, spd: 12, gold: 125 },
    ],
    A: [
      { name: '송로버섯 왕실 로스트', icon: '🍗', hp: 240, atk: 36, spd: 18, gold: 280 },
      { name: '용암석 해물 모둠전골', icon: '🦞', hp: 270, atk: 32, spd: 20, gold: 300 },
    ],
    S: [
      { name: '카이로 황제 드래곤 만찬', icon: '👑', hp: 520, atk: 75, spd: 30, gold: 680 },
      { name: '천상의 불사조 스테이크', icon: '🍱', hp: 480, atk: 85, spd: 35, gold: 720 },
    ],
  };

  const list = dishCatalog[tier];
  const pick = list[Math.floor(slotRandom() * list.length)];
  const mult = isJackpot ? 1.2 : 1.0;

  const hpBonus = Math.round(pick.hp * mult);
  const atkBonus = Math.round(pick.atk * mult);

  const dish: DishItem = {
    id: `dish_${Date.now()}_${Math.floor(slotRandom() * 999)}`,
    name: isJackpot ? `[특선] ${pick.name}` : pick.name,
    tier,
    icon: pick.icon,
    hpBonus,
    atkBonus,
    spdBonus: pick.spd,
    sellGold: Math.round(pick.gold * mult),
    desc: `1회 출정 시 체력 +${hpBonus}, 공격력 +${atkBonus} 상승`,
  };

  return {
    dish,
    reels,
    isJackpot,
    scrapRefund: tier === 'S' ? 35 : tier === 'A' ? 20 : 10,
  };
}

/**
 * 4. 포션가게 연금 1회 슬롯 (약초 2개 조합 -> 위기 회복 & 공격력 버프 포션 생성)
 */
export function rollAlchemyPotion(
  save: GameSaveData,
  herbTier1: RankTier,
  herbTier2: RankTier
): {
  potion: PotionItem;
  reels: [string, string, string];
  isJackpot: boolean;
  scrapRefund: number;
} {
  const combBonus = herbTier1 !== herbTier2 ? 6 : 3;
  const probs = calculateSlotProbabilities(
    [herbTier1, herbTier2],
    save.staff.alchemist.bonusProb,
    getFacilityLuckBonus(save, 'potion'),
    combBonus
  );
  const { tier, isJackpot, reels } = rollTierFromProbs(probs, 'potion');

  const potCatalog: Record<
    RankTier,
    { name: string; icon: string; heal: number; atk: number; gold: number }[]
  > = {
    C: [
      { name: '푸른 이슬 회복약', icon: '🧪', heal: 35, atk: 10, gold: 45 },
      { name: '초록 활력 강장제', icon: '🍏', heal: 28, atk: 15, gold: 50 },
    ],
    B: [
      { name: '달빛 농축 치유비약', icon: '⚗️', heal: 55, atk: 22, gold: 120 },
      { name: '맹수의 분노 물약', icon: '🍷', heal: 42, atk: 30, gold: 130 },
    ],
    A: [
      { name: '만드라고라 초재생 영약', icon: '🔮', heal: 75, atk: 42, gold: 290 },
      { name: '별빛 광전사의 비약', icon: '⚡', heal: 60, atk: 55, gold: 310 },
    ],
    S: [
      { name: '불사조의 부활 엘릭서', icon: '🔥', heal: 100, atk: 80, gold: 700 },
      { name: '카이로 신비의 만능영약', icon: '🌟', heal: 90, atk: 95, gold: 740 },
    ],
  };

  const list = potCatalog[tier];
  const pick = list[Math.floor(slotRandom() * list.length)];
  const mult = isJackpot ? 1.15 : 1.0;

  const healPct = Math.min(100, Math.round(pick.heal * mult));
  const atkBuffPct = Math.round(pick.atk * mult);

  const potion: PotionItem = {
    id: `pot_${Date.now()}_${Math.floor(slotRandom() * 999)}`,
    name: isJackpot ? `[고순도] ${pick.name}` : pick.name,
    tier,
    icon: pick.icon,
    healPct,
    atkBuffPct,
    sellGold: Math.round(pick.gold * mult),
    desc: `던전 위기 시 체력 ${healPct}% 회복 & 공격력 +${atkBuffPct}%`,
  };

  return {
    potion,
    reels,
    isJackpot,
    scrapRefund: tier === 'S' ? 35 : tier === 'A' ? 20 : 10,
  };
}

/**
 * 5. 대장간 파트 1: 무기 제작 슬롯 (제작 장인 특화 무기일 때 추가 보너스!)
 */
export function rollWeaponForge(
  save: GameSaveData,
  weaponType: WeaponTypeId,
  oreTier1: RankTier,
  oreTier2: RankTier
): {
  weapon: WeaponItem;
  reels: [string, string, string];
  isJackpot: boolean;
  scrapRefund: number;
} {
  const forger = save.staff.forger;
  const isSpec = forger.specialties.includes(weaponType);
  const specBonus = isSpec ? (forger.tier === 'S' ? 15 : 12) : 0;

  const probs = calculateSlotProbabilities(
    [oreTier1, oreTier2],
    forger.bonusProb,
    getFacilityLuckBonus(save, 'blacksmith'),
    specBonus
  );
  const { tier, isJackpot, reels } = rollTierFromProbs(probs, 'forge');
  const meta = WEAPON_TYPE_META[weaponType];

  const tierMult: Record<RankTier, number> = {
    C: 1.0,
    B: 1.55,
    A: 2.35,
    S: 3.6,
  };
  const prefixMap: Record<RankTier, string> = {
    C: '강철',
    B: '청광',
    A: '미스릴',
    S: '오리할콘 신기',
  };

  const facAtkBoost = save.facilities.blacksmith.passives
    .filter((p) => p.bonusType === 'stat_boost')
    .reduce((acc, p) => acc + p.value, 0);

  const baseAtk = Math.round(
    meta.baseAtk *
      tierMult[tier] *
      (isJackpot ? 1.18 : 1.0) *
      (1 + facAtkBoost / 100)
  );

  const weapon: WeaponItem = {
    id: `wp_${Date.now()}_${Math.floor(slotRandom() * 999)}`,
    name: `${prefixMap[tier]} ${meta.name}`,
    type: weaponType,
    tier,
    icon: meta.icon,
    baseAtk,
    enhanceCount: 0,
    enhanceLocked: false,
    enchants: [],
    equippedHeroId: null,
  };

  return {
    weapon,
    reels,
    isJackpot,
    scrapRefund: tier === 'S' ? 40 : tier === 'A' ? 24 : 12,
  };
}

/**
 * 6. 대장간 파트 2: 무기 연속 강화 슬롯
 * 실패(STOP)가 뜨면 무기가 파괴되지 않고 '현재 강화 수치에서 강화 완료(확정)'됩니다!
 */
export function getEnhanceSuccessRate(
  save: GameSaveData,
  weapon: WeaponItem,
  oreTier: RankTier
): number {
  const enhancer = save.staff.enhancer;
  const isSpec = enhancer.specialties.includes(weapon.type);
  const specBonus = isSpec ? 12 : 0;
  const oreBonus: Record<RankTier, number> = { C: 0, B: 10, A: 22, S: 38 };
  const facBonus = getFacilityLuckBonus(save, 'blacksmith');

  // +수치가 올라갈수록 기본 성공률이 점진적으로 감소
  const baseRate = Math.max(15, 92 - weapon.enhanceCount * 11);
  const totalRate = Math.min(
    96,
    Math.max(15, baseRate + enhancer.bonusProb + specBonus + oreBonus[oreTier] + facBonus * 0.6)
  );
  return Math.round(totalRate);
}

export function rollWeaponEnhance(
  save: GameSaveData,
  weapon: WeaponItem,
  oreTier: RankTier
): {
  success: boolean;
  greatSuccess: boolean; // 대성공 시 한 번에 +2 강화!
  newEnhanceCount: number;
  locked: boolean;
  reels: [string, string, string];
} {
  const rate = getEnhanceSuccessRate(save, weapon, oreTier);
  const roll = slotRandom() * 100;

  if (roll <= rate) {
    const greatSuccess = roll <= rate * 0.22;
    const add = greatSuccess ? 2 : 1;
    const newCount = weapon.enhanceCount + add;
    const reels: [string, string, string] = greatSuccess
      ? ['seven', 'seven', 'seven']
      : ['hammer', 'hammer', 'spark'];
    return {
      success: true,
      greatSuccess,
      newEnhanceCount: newCount,
      locked: false,
      reels,
    };
  } else {
    // 실패 시 파괴되지 않고 거기까지 강화 완료(확정)!
    return {
      success: false,
      greatSuccess: false,
      newEnhanceCount: weapon.enhanceCount,
      locked: true,
      reels: ['hammer', 'spark', 'lock'],
    };
  }
}

/**
 * 7. 대장간 파트 3: 무기 인챈트 슬롯
 * 연속 강화 횟수(+수치)에 따라 뜨는 옵션 가지 수(1~4줄)와 수치 범위(최소~최대)가 달라집니다!
 */
export function getEnchantPreviewInfo(
  save: GameSaveData,
  weapon: WeaponItem,
  oreTier: RankTier
): {
  slotCount: number;
  minMult: number;
  maxMult: number;
  ranges: { id: string; name: string; statLabel: string; minVal: number; maxVal: number; color: string }[];
} {
  const enchanter = save.staff.enchanter;
  const isSpec = enchanter.specialties.includes(weapon.type);
  const enh = weapon.enhanceCount;

  // 강화 횟수에 따른 옵션 줄 수: +0~1: 1줄, +2~4: 2줄, +5~7: 3줄, +8이상: 4줄
  const slotCount = enh >= 8 ? 4 : enh >= 5 ? 3 : enh >= 2 ? 2 : 1;

  const oreMult: Record<RankTier, number> = { C: 1.0, B: 1.25, A: 1.6, S: 2.1 };
  const staffFactor = 1 + (enchanter.bonusProb + (isSpec ? 15 : 0)) / 100;

  const minMult = (1 + enh * 0.22) * oreMult[oreTier];
  const maxMult = (1.35 + enh * 0.38) * oreMult[oreTier] * staffFactor;

  const ranges = ENCHANT_OPTIONS.map((opt) => ({
    id: opt.id,
    name: opt.name,
    statLabel: opt.statLabel,
    minVal: Math.max(1, Math.round(opt.baseMin * minMult)),
    maxVal: Math.max(2, Math.round(opt.baseMax * maxMult)),
    color: opt.color,
  }));

  return { slotCount, minMult, maxMult, ranges };
}

export function rollWeaponEnchant(
  save: GameSaveData,
  weapon: WeaponItem,
  oreTier: RankTier
): {
  enchants: WeaponEnchant[];
  reels: [string, string, string];
  isJackpot: boolean;
  scrapRefund: number;
} {
  const info = getEnchantPreviewInfo(save, weapon, oreTier);
  const shuffled = [...ENCHANT_OPTIONS].sort(() => slotRandom() - 0.5);
  const picked = shuffled.slice(0, info.slotCount);
  const isJackpot = slotRandom() < 0.25;

  const enchants: WeaponEnchant[] = picked.map((opt) => {
    const minVal = Math.max(1, Math.round(opt.baseMin * info.minMult));
    const maxVal = Math.max(minVal + 1, Math.round(opt.baseMax * info.maxMult));
    const ratio = isJackpot ? 0.78 + slotRandom() * 0.22 : slotRandom();
    const value = Math.round(minVal + (maxVal - minVal) * ratio);
    return {
      id: opt.id,
      name: opt.name,
      statLabel: opt.statLabel,
      value,
      minVal,
      maxVal,
      color: opt.color,
    };
  });

  const reels: [string, string, string] = isJackpot
    ? ['seven', 'seven', 'seven']
    : ['gem', 'spark', 'gem'];

  return {
    enchants,
    reels,
    isJackpot,
    scrapRefund: oreTier === 'S' ? 35 : oreTier === 'A' ? 20 : 10,
  };
}

/**
 * 8. 시설 업그레이드 슬롯 (레벨업 100% 보장 + 특수 패시브 또는 대성공 +2레벨 추첨)
 */
export function rollFacilityUpgrade(
  save: GameSaveData,
  facilityId: FacilityId,
  betTier: RankTier
): {
  passive: FacilityPassive;
  greatLevelUp: boolean; // true면 한 번에 +2레벨!
  reels: [string, string, string];
  scrapRefund: number;
} {
  const probs = calculateSlotProbabilities(
    [betTier],
    10,
    getFacilityLuckBonus(save, facilityId)
  );
  const { tier, isJackpot, reels } = rollTierFromProbs(probs, 'facility');
  const pool = FACILITY_PASSIVE_POOL[facilityId];
  const matching = pool.find((p) => p.tier === tier) || pool[0];

  return {
    passive: { ...matching, id: `${matching.id}_${Date.now()}` },
    greatLevelUp: isJackpot,
    reels,
    scrapRefund: 20,
  };
}

/**
 * 현재 여관 시설 레벨이 해금해주는 영웅 최대 레벨 상한선
 * (초반에 S급 영웅이 나와도 여관 레벨이 낮으면 레벨 상한이 묶여 밸런스가 유지됨!)
 */
export function getEffectiveHeroLevelCap(save: GameSaveData, hero: HeroUnit): number {
  const innLevel = save.facilities.inn.level;
  const innAllowedCap = Math.min(40, innLevel * 6 + 4); // 여관 Lv.1 -> 최대 Lv.10, Lv.2 -> Lv.16, Lv.3 -> Lv.22 ...
  return Math.min(hero.maxLevelCap, innAllowedCap);
}

/**
 * 영웅의 최종 전투 스탯 계산 (기본 스탯 + 장착 무기(+강화/인챈트) + 1회성 요리 버프 + 시설 패시브)
 */
export function getHeroCombatStats(
  save: GameSaveData,
  hero: HeroUnit
): {
  maxHp: number;
  atk: number;
  def: number;
  critBonus: number;
  vampBonus: number;
  weapon: WeaponItem | null;
} {
  const wp = save.weapons.find((w) => w.id === hero.weaponId) || null;
  let maxHp = hero.baseHp;
  let atk = hero.baseAtk;
  const def = hero.baseDef;
  let critBonus = 5;
  let vampBonus = 0;

  if (wp) {
    // 무기 기본 공격력 + 연속 강화 보너스(강화당 +18%)
    const enhAtk = Math.round(wp.baseAtk * (1 + wp.enhanceCount * 0.18));
    atk += enhAtk;
    for (const enc of wp.enchants) {
      if (enc.id === 'enc_atk') atk += enc.value;
      if (enc.id === 'enc_hp') maxHp += enc.value;
      if (enc.id === 'enc_crit') critBonus += enc.value;
      if (enc.id === 'enc_vamp') vampBonus += enc.value;
      if (enc.id === 'enc_boss') atk += Math.round(enc.value * 0.6);
    }
  }

  // 1회성 출정 요리 버프
  if (hero.activeMeal) {
    maxHp += hero.activeMeal.hpBonus;
    atk += hero.activeMeal.atkBonus;
  }

  // 여관 명예의 전당 등 시설 스탯 보너스
  const facBoost = save.facilities.inn.passives
    .filter((p) => p.bonusType === 'stat_boost')
    .reduce((acc, p) => acc + p.value, 0);

  if (facBoost > 0) {
    maxHp = Math.round(maxHp * (1 + facBoost / 100));
    atk = Math.round(atk * (1 + facBoost / 100));
  }

  return { maxHp, atk, def, critBonus, vampBonus, weapon: wp };
}
