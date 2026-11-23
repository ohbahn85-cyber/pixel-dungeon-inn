import {
  DungeonZone,
  FacilityId,
  FacilityPassive,
  HeroClassId,
  MaterialItem,
  RankTier,
  StaffMember,
  StaffRoleId,
  WeaponTypeId,
} from './types';

export const TIER_COLORS: Record<RankTier, string> = {
  C: '#8b9bb4',
  B: '#38bdf8',
  A: '#c084fc',
  S: '#fbbf24',
};

export const TIER_LABELS: Record<RankTier, string> = {
  C: 'C급 (일반)',
  B: 'B급 (고급)',
  A: 'A급 (희귀)',
  S: 'S급 (전설)',
};

export const WEAPON_TYPE_META: Record<
  WeaponTypeId,
  { name: string; icon: string; baseAtk: number }
> = {
  sword: { name: '장검', icon: '🗡️', baseAtk: 14 },
  axe: { name: '전투도끼', icon: '🪓', baseAtk: 18 },
  bow: { name: '사냥활', icon: '🏹', baseAtk: 15 },
  staff: { name: '마력지팡이', icon: '🪄', baseAtk: 16 },
  dagger: { name: '암살단검', icon: '🔪', baseAtk: 13 },
};

export const ALL_WEAPON_TYPES: WeaponTypeId[] = [
  'sword',
  'axe',
  'bow',
  'staff',
  'dagger',
];

export const MATERIALS: MaterialItem[] = [
  // 식재료 (여관 요리 슬롯용)
  {
    id: 'food_c',
    name: '야생 버섯과 고기',
    category: 'food',
    tier: 'C',
    icon: '🍄',
    buyPrice: 35,
    sellPrice: 15,
    desc: '초원 던전에서 흔히 구하는 기본 식재료',
  },
  {
    id: 'food_b',
    name: '서리 멧돼지 등심',
    category: 'food',
    tier: 'B',
    icon: '🥩',
    buyPrice: 95,
    sellPrice: 42,
    desc: '육즙이 풍부해 고급 요리가 나올 확률을 높여주는 식재료',
  },
  {
    id: 'food_a',
    name: '황금 송로버섯',
    category: 'food',
    tier: 'A',
    icon: '🧀',
    buyPrice: 240,
    sellPrice: 110,
    desc: '깊은 향기로 A~S급 특선 요리 확률을 대폭 높이는 희귀 식재료',
  },
  {
    id: 'food_s',
    name: '고대 용의 차돌박이',
    category: 'food',
    tier: 'S',
    icon: '🍖',
    buyPrice: 600,
    sellPrice: 280,
    desc: '전설의 연회 요리를 탄생시키는 최상급 환상 식재료',
  },

  // 광석 (대장간 제작/강화/인챈트 슬롯용)
  {
    id: 'ore_c',
    name: '구리 철광석',
    category: 'ore',
    tier: 'C',
    icon: '🪨',
    buyPrice: 40,
    sellPrice: 18,
    desc: '대장간에서 기본 무기를 벼려내는 일반 광석',
  },
  {
    id: 'ore_b',
    name: '푸른 강철석',
    category: 'ore',
    tier: 'B',
    icon: '🔷',
    buyPrice: 110,
    sellPrice: 50,
    desc: '단단한 내구도로 고급 무기와 강화 성공률을 높이는 광석',
  },
  {
    id: 'ore_a',
    name: '미스릴 은광석',
    category: 'ore',
    tier: 'A',
    icon: '💎',
    buyPrice: 260,
    sellPrice: 120,
    desc: '마력을 머금어 희귀 무기와 고수치 인챈트를 이끄는 광석',
  },
  {
    id: 'ore_s',
    name: '오리할콘 성석',
    category: 'ore',
    tier: 'S',
    icon: '🌟',
    buyPrice: 650,
    sellPrice: 300,
    desc: '전설 등급 신기를 제작할 때 쓰이는 최고급 금속',
  },

  // 약초 (포션가게 연금 슬롯용)
  {
    id: 'herb_c',
    name: '푸른 이슬초',
    category: 'herb',
    tier: 'C',
    icon: '🌿',
    buyPrice: 35,
    sellPrice: 15,
    desc: '기초 회복 물약을 달이는 흔한 약초',
  },
  {
    id: 'herb_b',
    name: '달빛 연꽃잎',
    category: 'herb',
    tier: 'B',
    icon: '🌺',
    buyPrice: 95,
    sellPrice: 42,
    desc: '농축된 마력으로 고급 비약 확률을 높이는 약초',
  },
  {
    id: 'herb_a',
    name: '심연의 만드라고라',
    category: 'herb',
    tier: 'A',
    icon: '🔮',
    buyPrice: 240,
    sellPrice: 110,
    desc: '강력한 전투 영약을 연성하는 희귀 연금 재료',
  },
  {
    id: 'herb_s',
    name: '불사조의 불꽃초',
    category: 'herb',
    tier: 'S',
    icon: '🔥',
    buyPrice: 600,
    sellPrice: 280,
    desc: '전설의 엘릭서를 완성하는 궁극의 영초',
  },
];

export const MATERIAL_MAP: Record<string, MaterialItem> = Object.fromEntries(
  MATERIALS.map((m) => [m.id, m])
);

export const STAFF_ROLE_META: Record<
  StaffRoleId,
  { title: string; facility: FacilityId; icon: string; desc: string }
> = {
  chef: {
    title: '여관 수석 요리사',
    facility: 'inn',
    icon: '👨‍🍳',
    desc: '식재료 조합 슬롯을 돌려 1회성 출정 버프 요리를 만듭니다.',
  },
  forger: {
    title: '대장간 제작 장인',
    facility: 'blacksmith',
    icon: '🔨',
    desc: '광석을 베팅해 무기 제작 슬롯을 돌립니다. 특화 무기일수록 대박 확률 상승!',
  },
  enhancer: {
    title: '대장간 강화 기술자',
    facility: 'blacksmith',
    icon: '⚒️',
    desc: '무기 연속 강화 슬롯을 담당합니다. 실패(STOP)가 뜰 때까지 +수치를 쌓습니다!',
  },
  enchanter: {
    title: '대장간 마법부여사',
    facility: 'blacksmith',
    icon: '✨',
    desc: '강화된 무기의 +수치에 비례해 더 많은 옵션과 높은 수치의 인챈트 슬롯을 돌립니다.',
  },
  alchemist: {
    title: '포션가게 연금술사',
    facility: 'potion',
    icon: '🧪',
    desc: '약초 조합 슬롯을 돌려 던전 위기 회복·공격 버프 포션을 연성합니다.',
  },
};

export const INITIAL_STAFF: Record<StaffRoleId, StaffMember> = {
  chef: {
    id: 'staff_chef_c',
    name: '견습생 뽀글이',
    role: 'chef',
    tier: 'C',
    level: 1,
    bonusProb: 4,
    specialties: [],
    specialtyLabel: '기본 수프 & 구이 요리',
    hireCost: 0,
    avatarColor: '#f97316',
    hatColor: '#ffffff',
  },
  forger: {
    id: 'staff_forger_c',
    name: '수습공 뭉치',
    role: 'forger',
    tier: 'C',
    level: 1,
    bonusProb: 4,
    specialties: ['sword'],
    specialtyLabel: '장검(🗡️) 특화',
    hireCost: 0,
    avatarColor: '#ef4444',
    hatColor: '#78716c',
  },
  enhancer: {
    id: 'staff_enhancer_c',
    name: '담금질꾼 강철이',
    role: 'enhancer',
    tier: 'C',
    level: 1,
    bonusProb: 5,
    specialties: ['sword', 'axe'],
    specialtyLabel: '장검(🗡️)·전투도끼(🪓) 특화',
    hireCost: 0,
    avatarColor: '#d97706',
    hatColor: '#57534e',
  },
  enchanter: {
    id: 'staff_enchanter_c',
    name: '룬 서기 별빛',
    role: 'enchanter',
    tier: 'C',
    level: 1,
    bonusProb: 4,
    specialties: ['staff'],
    specialtyLabel: '마력지팡이(🪄) 특화',
    hireCost: 0,
    avatarColor: '#8b5cf6',
    hatColor: '#4c1d95',
  },
  alchemist: {
    id: 'staff_alchemist_c',
    name: '약초꾼 풀잎이',
    role: 'alchemist',
    tier: 'C',
    level: 1,
    bonusProb: 4,
    specialties: [],
    specialtyLabel: '기초 회복약 & 강장제',
    hireCost: 0,
    avatarColor: '#10b981',
    hatColor: '#065f46',
  },
};

export const STAFF_NAME_POOL: Record<StaffRoleId, Record<RankTier, string[]>> = {
  chef: {
    C: ['견습생 뽀글이', '감자깎이 토토', '국자잡이 호야'],
    B: ['불판장인 고든', '미식요리사 슈슈', '화덕의 루이'],
    A: ['황금손 블랑슈', '왕실주방장 베르디', '특급셰프 미슐랭'],
    S: ['전설의 식신 카이로', '용왕요리사 아스트라'],
  },
  forger: {
    C: ['수습공 뭉치', '모루지기 바위', '풀무꾼 탄이'],
    B: ['강철손 브론', '드워프 토르가', '불꽃망치 그림'],
    A: ['명장 발칸', '미스릴장인 두린', '성검제작자 에이르'],
    S: ['신기장인 헤파이스', '전설의 대장장이 오딘'],
  },
  enhancer: {
    C: ['담금질꾼 강철이', '숫돌잡이 깡이', '불씨지기 화랑'],
    B: ['연마술사 볼트', '강화장인 해머슨', '불꽃연마 맥스'],
    A: ['초고열 연마사 제트', '무결점 크라토스', '극한강화 발렌'],
    S: ['절대강화 신의손 카이', '불패의 장인 레전드'],
  },
  enchanter: {
    C: ['룬 서기 별빛', '마력각인사 루나', '초급비전 엘라'],
    B: ['속성부여사 실피드', '비전세공사 아린', '별자리 각인사 제논'],
    A: ['대마법부여사 메를린', '고대룬 해독가 세라', '심연각인사 베일'],
    S: ['초월마법사 아르카나', '만물각인사 코스모스'],
  },
  alchemist: {
    C: ['약초꾼 풀잎이', '플라스크 방울이', '수습연금 코코'],
    B: ['비약제조사 녹턴', '증류장인 클라라', '마력추출가 베른'],
    A: ['대연금술사 파라켈', '현자의손 에테르', '황금비약 엘레나'],
    S: ['엘릭서 창조자 헤르메스', '불로불사 연금왕 솔라'],
  },
};

export const HERO_CLASS_META: Record<
  HeroClassId,
  {
    name: string;
    icon: string;
    favWeapon: WeaponTypeId;
    baseHp: number;
    baseAtk: number;
    baseDef: number;
    hairColor: string;
    armorColor: string;
  }
> = {
  knight: {
    name: '왕국 기사',
    icon: '🛡️',
    favWeapon: 'sword',
    baseHp: 135,
    baseAtk: 15,
    baseDef: 10,
    hairColor: '#f59e0b',
    armorColor: '#3b82f6',
  },
  warrior: {
    name: '광전사',
    icon: '🪓',
    favWeapon: 'axe',
    baseHp: 120,
    baseAtk: 20,
    baseDef: 7,
    hairColor: '#ef4444',
    armorColor: '#b91c1c',
  },
  archer: {
    name: '명사수',
    icon: '🏹',
    favWeapon: 'bow',
    baseHp: 95,
    baseAtk: 21,
    baseDef: 5,
    hairColor: '#84cc16',
    armorColor: '#15803d',
  },
  mage: {
    name: '원소 마도사',
    icon: '🪄',
    favWeapon: 'staff',
    baseHp: 90,
    baseAtk: 24,
    baseDef: 5,
    hairColor: '#c084fc',
    armorColor: '#6d28d9',
  },
  rogue: {
    name: '그림자 도적',
    icon: '🔪',
    favWeapon: 'dagger',
    baseHp: 100,
    baseAtk: 22,
    baseDef: 6,
    hairColor: '#38bdf8',
    armorColor: '#334155',
  },
};

export const HERO_NAMES = [
  '아서', '레오', '실비아', '카일', '엘레나', '가렌', '루시', '베인',
  '세라핀', '단테', '로빈', '아이리스', '지크', '클로이', '프레이야', '로건',
];

export const HERO_TIER_MAX_CAP: Record<RankTier, number> = {
  C: 10,
  B: 20,
  A: 30,
  S: 40,
};

// 초반 고등급 영웅이 나와도 밸런스가 무너지지 않도록 Lv.1 시작 스탯 배율은 완만하게(C: 1.0 ~ S: 1.32)
export const HERO_TIER_BASE_MULT: Record<RankTier, number> = {
  C: 1.0,
  B: 1.1,
  A: 1.2,
  S: 1.32,
};

// 레벨업 시 등급별 성장폭 차이
export const HERO_TIER_GROWTH_MULT: Record<RankTier, number> = {
  C: 1.0,
  B: 1.2,
  A: 1.45,
  S: 1.75,
};

export const FACILITY_PASSIVE_POOL: Record<FacilityId, FacilityPassive[]> = {
  inn: [
    {
      id: 'inn_p1',
      name: '폭신한 오리털 침구',
      desc: '여관 숙박·식사 골드 수입 +18%',
      tier: 'C',
      bonusType: 'gold_income',
      value: 18,
    },
    {
      id: 'inn_p2',
      name: '황금 화덕 개조',
      desc: '요리 및 영웅 영입 슬롯 대박 확률 +7%',
      tier: 'B',
      bonusType: 'slot_luck',
      value: 7,
    },
    {
      id: 'inn_p3',
      name: '모험가 명예의 전당',
      desc: '모든 영웅 출정 시 공격력·체력 +12%',
      tier: 'A',
      bonusType: 'stat_boost',
      value: 12,
    },
    {
      id: 'inn_p4',
      name: '카이로 왕실 인증 여관',
      desc: '슬롯 대박 확률 +15% & 여관 골드 수입 +35%',
      tier: 'S',
      bonusType: 'slot_luck',
      value: 15,
    },
  ],
  blacksmith: [
    {
      id: 'bs_p1',
      name: '고열 풀무 장치',
      desc: '무기 제작·강화·인챈트 슬롯 행운 +6%',
      tier: 'C',
      bonusType: 'slot_luck',
      value: 6,
    },
    {
      id: 'bs_p2',
      name: '드워프 강철 모루',
      desc: '연속 강화 슬롯 성공 확률 +10%',
      tier: 'B',
      bonusType: 'slot_luck',
      value: 10,
    },
    {
      id: 'bs_p3',
      name: '고대 룬 제단',
      desc: '제작된 모든 무기의 기본 공격력 +15%',
      tier: 'A',
      bonusType: 'stat_boost',
      value: 15,
    },
    {
      id: 'bs_p4',
      name: '용의 숨결 용광로',
      desc: '대장간 모든 슬롯 대박 확률 +18%',
      tier: 'S',
      bonusType: 'slot_luck',
      value: 18,
    },
  ],
  potion: [
    {
      id: 'pot_p1',
      name: '수경 약초 온실',
      desc: '포션 슬롯 고급 연성 확률 +6%',
      tier: 'C',
      bonusType: 'slot_luck',
      value: 6,
    },
    {
      id: 'pot_p2',
      name: '마력 증류 플라스크',
      desc: '포션 판매 수입 및 회복 효과 +15%',
      tier: 'B',
      bonusType: 'gold_income',
      value: 15,
    },
    {
      id: 'pot_p3',
      name: '현자의 연금솥',
      desc: '포션 슬롯 희귀·전설 당첨률 +12%',
      tier: 'A',
      bonusType: 'slot_luck',
      value: 12,
    },
    {
      id: 'pot_p4',
      name: '별빛 에테르 추출기',
      desc: '포션 연성 행운 +18% & 영웅 포션 버프 +25%',
      tier: 'S',
      bonusType: 'slot_luck',
      value: 18,
    },
  ],
  trade: [
    {
      id: 'tr_p1',
      name: '고철 분쇄 재활용기',
      desc: '슬롯 [버리기] 선택 시 마일리지 가루 획득량 +25%',
      tier: 'C',
      bonusType: 'scrap_bonus',
      value: 25,
    },
    {
      id: 'tr_p2',
      name: '상인 길드 직통 마차',
      desc: '여관 단지 전체 상점 골드 수입 +20%',
      tier: 'B',
      bonusType: 'gold_income',
      value: 20,
    },
    {
      id: 'tr_p3',
      name: '연금 마일리지 정제소',
      desc: '슬롯 [버리기] 마일리지 가루 획득량 +50%',
      tier: 'A',
      bonusType: 'scrap_bonus',
      value: 50,
    },
    {
      id: 'tr_p4',
      name: '황금 무역 독점권',
      desc: '전체 골드 수입 +40% & 마일리지 획득 +75%',
      tier: 'S',
      bonusType: 'gold_income',
      value: 40,
    },
  ],
};

export const DUNGEON_ZONES: DungeonZone[] = [
  {
    id: 'dungeon_1',
    name: '1구역: 버섯 포자 숲',
    floorText: '권장 Lv.1~5 · 무기 +0 이상',
    recLevel: 1,
    recEnhance: 0,
    monsterNames: ['포자 슬라임', '독버섯 정령', '숲 고블린'],
    bossName: '대왕 버섯골렘',
    dropTier: 'C',
    baseGoldReward: 160,
    themeColor: '#22c55e',
  },
  {
    id: 'dungeon_2',
    name: '2구역: 얼어붙은 수정 동굴',
    floorText: '권장 Lv.6~12 · 무기 +2 이상',
    recLevel: 6,
    recEnhance: 2,
    monsterNames: ['설원 예티', '얼음 박쥐', '서리 늑대'],
    bossName: '빙결의 설인 군주',
    dropTier: 'B',
    baseGoldReward: 360,
    themeColor: '#38bdf8',
  },
  {
    id: 'dungeon_3',
    name: '3구역: 황금 고대 유적',
    floorText: '권장 Lv.14~22 · 무기 +4 이상',
    recLevel: 14,
    recEnhance: 4,
    monsterNames: ['황금 가고일', '고대 미라', '강철 파수꾼'],
    bossName: '태양신 파라오 거상',
    dropTier: 'A',
    baseGoldReward: 780,
    themeColor: '#eab308',
  },
  {
    id: 'dungeon_4',
    name: '4구역: 화염 마왕의 용암 성채',
    floorText: '권장 Lv.25+ · 무기 +7 이상',
    recLevel: 25,
    recEnhance: 7,
    monsterNames: ['화염 임프', '용암 악마', '심연의 기사'],
    bossName: '고대 홍염룡 이그니스',
    dropTier: 'S',
    baseGoldReward: 1650,
    themeColor: '#ef4444',
  },
];

export const ENCHANT_OPTIONS = [
  { id: 'enc_atk', name: '맹공의 룬', statLabel: '공격력 +', baseMin: 4, baseMax: 10, color: '#ef4444' },
  { id: 'enc_crit', name: '예리함의 룬', statLabel: '치명타 피해 +', baseMin: 6, baseMax: 15, color: '#f59e0b' },
  { id: 'enc_hp', name: '생명력의 룬', statLabel: '최대 체력 +', baseMin: 20, baseMax: 50, color: '#10b981' },
  { id: 'enc_vamp', name: '흡혈의 룬', statLabel: '전투 회복력 +', baseMin: 3, baseMax: 9, color: '#ec4899' },
  { id: 'enc_gold', name: '황금의 룬', statLabel: '던전 골드 +', baseMin: 8, baseMax: 20, color: '#eab308' },
  { id: 'enc_boss', name: '거인학살 룬', statLabel: '보스 추가타 +', baseMin: 7, baseMax: 18, color: '#a855f7' },
];
