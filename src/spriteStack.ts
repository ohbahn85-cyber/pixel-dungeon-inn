export type CharacterArchetypeId =
  | 'knight'      // 왕국 기사 (청색 갑옷 + 금빛 투구/깃털 + 장검 & 방패)
  | 'warrior'     // 광전사 (붉은 뿔투구/갈기 + 전투도끼)
  | 'archer'      // 명사수 (초록 레인저 후드/깃털 + 사냥활)
  | 'mage'        // 원소 마도사 (보라색 고깔 마법모자 + 보석 마력지팡이)
  | 'rogue'       // 그림자 도적 (네이비 두건/안대 + 쌍단검)
  | 'chef'        // 여관 요리사 (하얀 셰프 모자 + 주방 앞치마 + 프라이팬/국자)
  | 'blacksmith'  // 대장장이 장인 (드워프 수염 + 가죽 앞치마 + 대장간 망치)
  | 'alchemist';  // 포션 연금술사 (연금술 고글 + 초록 로브 + 마력 플라스크)

export type AnimActionId =
  | 'idle'   // 숨쉬기 & 자연스러운 고개 까딱임
  | 'walk'   // 팔다리 교차 걷기 & 통통 튀는 바운스
  | 'work'   // 망치질 / 요리 웍질 / 포션 흔들기
  | 'attack' // 무기 크게 휘두르기 & 몸통 회전 스윙
  | 'cheer'; // 슬롯 잭팟 만세 점프!

export interface ArchetypeMeta {
  id: CharacterArchetypeId;
  name: string;
  roleLabel: string;
  badgeIcon: string;
  desc: string;
  primaryColor: string;
  secondaryColor: string;
  hairColor: string;
  skinLight: string;
  skinDark: string;
  toolName: string;
}

export const ARCHETYPES: ArchetypeMeta[] = [
  {
    id: 'knight',
    name: '왕국 기사 (아서)',
    roleLabel: '영웅 · 방어/장검',
    badgeIcon: '🛡️',
    desc: '붉은 깃털 장식 철제 투구와 푸른 판금 갑옷, 왼손 방패와 오른손 장검을 든 표준 카이로풍 기사',
    primaryColor: '#3b82f6',
    secondaryColor: '#1d4ed8',
    hairColor: '#f59e0b',
    skinLight: '#fbd3a7',
    skinDark: '#e2a976',
    toolName: '강철 장검 & 문장 방패',
  },
  {
    id: 'warrior',
    name: '광전사 (가렌)',
    roleLabel: '영웅 · 돌파/도끼',
    badgeIcon: '🪓',
    desc: '야성적인 붉은 머리칼과 뿔 장식 어깨갑옷, 양날 전투도끼를 휘두르는 돌격 전사',
    primaryColor: '#dc2626',
    secondaryColor: '#991b1b',
    hairColor: '#ef4444',
    skinLight: '#f6c79c',
    skinDark: '#d99a6c',
    toolName: '양날 전투도끼',
  },
  {
    id: 'archer',
    name: '명사수 (실비아)',
    roleLabel: '영웅 · 원거리/활',
    badgeIcon: '🏹',
    desc: '깃털 달린 숲의 레인저 모자와 망토, 정교한 곡선 사냥활을 든 민첩한 궁수',
    primaryColor: '#16a34a',
    secondaryColor: '#15803d',
    hairColor: '#a3e635',
    skinLight: '#fde0bd',
    skinDark: '#e5b88b',
    toolName: '엘프 사냥활',
  },
  {
    id: 'mage',
    name: '원소 마도사 (세라핀)',
    roleLabel: '영웅 · 마법/지팡이',
    badgeIcon: '🪄',
    desc: '챙 넓은 고깔 마법모자와 황금 테두리 로브, 빛나는 보석 지팡이를 든 마도사',
    primaryColor: '#8b5cf6',
    secondaryColor: '#5b21b6',
    hairColor: '#f0abfc',
    skinLight: '#fee2c5',
    skinDark: '#e6ba94',
    toolName: '에테르 보석 지팡이',
  },
  {
    id: 'rogue',
    name: '그림자 도적 (베인)',
    roleLabel: '영웅 · 치명/단검',
    badgeIcon: '🔪',
    desc: '얼굴을 감싼 복면 후드와 날렵한 경갑, 예리한 암살 단검을 역수로 쥔 도적',
    primaryColor: '#334155',
    secondaryColor: '#0f172a',
    hairColor: '#38bdf8',
    skinLight: '#fbd3a7',
    skinDark: '#df9f6c',
    toolName: '그림자 암살단검',
  },
  {
    id: 'chef',
    name: '수석 요리사 (블랑슈)',
    roleLabel: '여관 직원 · 요리슬롯',
    badgeIcon: '👨‍🍳',
    desc: '높고 폭신한 하얀 셰프 모자(Toque)와 깔끔한 조리복, 붉은 스카프와 무쇠 프라이팬을 든 요리사',
    primaryColor: '#f8fafc',
    secondaryColor: '#e2e8f0',
    hairColor: '#d97706',
    skinLight: '#fde0bd',
    skinDark: '#e2ad7d',
    toolName: '특선 무쇠 프라이팬',
  },
  {
    id: 'blacksmith',
    name: '대장장이 명장 (발칸)',
    roleLabel: '대장간 직원 · 무기슬롯',
    badgeIcon: '🔨',
    desc: '풍성한 붉은 수염과 두꺼운 가죽 앞치마, 무거운 강철 모루 망치를 든 드워프풍 대장장이',
    primaryColor: '#b45309',
    secondaryColor: '#78350f',
    hairColor: '#ea580c',
    skinLight: '#f4c095',
    skinDark: '#d4915e',
    toolName: '드워프 단조 망치',
  },
  {
    id: 'alchemist',
    name: '왕실 연금술사 (파라켈)',
    roleLabel: '포션가게 직원 · 연금슬롯',
    badgeIcon: '🧪',
    desc: '이마에 걸친 황동 연금 고글과 에메랄드 로브, 보라색 마력 물약 플라스크를 든 연금술사',
    primaryColor: '#0d9488',
    secondaryColor: '#115e59',
    hairColor: '#fcd34d',
    skinLight: '#fee2c5',
    skinDark: '#e2b287',
    toolName: '고농축 마력 플라스크',
  },
];

export interface VoxelPoint {
  x: number; // -8 .. +8 (좌우)
  y: number; // -8 .. +8 (앞뒤: +y가 캐릭터 정면!)
  z: number; // 0 .. 23 (바닥에서 머리 꼭대기까지의 층 높이)
  color: string;
}

export interface CharacterAnimPose {
  leftLegSwing: number;   // 왼다리 앞뒤 오프셋
  rightLegSwing: number;  // 오른다리 앞뒤 오프셋
  leftArmSwing: number;   // 왼팔 앞뒤 오프셋
  rightArmSwing: number;  // 오른팔 앞뒤 오프셋
  rightArmRaise: number;  // 오른팔(무기/도구) 위아래 높이 오프셋
  bodyBobZ: number;       // 몸통 전체 점프/바운스 높이
  headYaw: number;        // 머리 좌우 회전 각도(라디안)
  torsoTwist: number;     // 몸통 스윙 회전 각도(라디안)
  toolPitch: number;      // 무기/망치 내려치기 각도
}

/**
 * 시간(t)과 현재 행동(action)에 따라 관절별 애니메이션 포즈를 부드럽게 계산합니다.
 */
export function computeAnimPose(
  action: AnimActionId,
  t: number,
  phaseOffset = 0
): CharacterAnimPose {
  const time = t + phaseOffset;

  if (action === 'walk') {
    const cycle = time * 9.5;
    const sin = Math.sin(cycle);
    const bounce = Math.abs(Math.sin(cycle)) * 1.6;
    return {
      leftLegSwing: sin * 2.4,
      rightLegSwing: -sin * 2.4,
      leftArmSwing: -sin * 2.0,
      rightArmSwing: sin * 2.0,
      rightArmRaise: Math.abs(sin) * 0.8,
      bodyBobZ: bounce,
      headYaw: Math.sin(cycle * 0.5) * 0.12,
      torsoTwist: sin * 0.14,
      toolPitch: sin * 0.25,
    };
  }

  if (action === 'work') {
    // 망치질 / 요리 / 포션 조제: 오른팔을 높이 들었다가 경쾌하게 내려치는 모션
    const cycle = time * 11.0;
    const strike = Math.sin(cycle);
    return {
      leftLegSwing: 0,
      rightLegSwing: 0,
      leftArmSwing: Math.cos(cycle) * 0.8,
      rightArmSwing: strike > 0 ? 2.2 : -1.0,
      rightArmRaise: strike > 0 ? -1.5 : 2.6,
      bodyBobZ: Math.abs(strike) * 0.9,
      headYaw: Math.sin(cycle * 0.5) * 0.08,
      torsoTwist: strike * 0.22,
      toolPitch: strike > 0 ? 0.95 : -0.45,
    };
  }

  if (action === 'attack') {
    // 무기 크게 휘두르기
    const cycle = time * 8.0;
    const swing = Math.sin(cycle);
    return {
      leftLegSwing: -1.2,
      rightLegSwing: 1.5,
      leftArmSwing: -swing * 1.5,
      rightArmSwing: swing * 3.2,
      rightArmRaise: swing < 0 ? 2.8 : -1.2,
      bodyBobZ: Math.max(0, swing) * 1.4,
      headYaw: swing * 0.1,
      torsoTwist: swing * 0.45,
      toolPitch: swing * 1.15,
    };
  }

  if (action === 'cheer') {
    // 슬롯 대박 만세 점프!
    const cycle = time * 10.0;
    const jump = Math.max(0, Math.sin(cycle)) * 3.8;
    return {
      leftLegSwing: Math.sin(cycle) * 1.0,
      rightLegSwing: -Math.sin(cycle) * 1.0,
      leftArmSwing: 1.2,
      rightArmSwing: 1.2,
      rightArmRaise: 3.2,
      bodyBobZ: jump,
      headYaw: Math.sin(cycle * 0.5) * 0.2,
      torsoTwist: Math.sin(cycle) * 0.18,
      toolPitch: -0.5,
    };
  }

  // 기본 idle (부드러운 호흡과 고개 까딱임)
  const breath = Math.sin(time * 3.2);
  return {
    leftLegSwing: 0,
    rightLegSwing: 0,
    leftArmSwing: 0,
    rightArmSwing: 0,
    rightArmRaise: breath * 0.35,
    bodyBobZ: Math.max(0, breath) * 0.5,
    headYaw: Math.sin(time * 1.6) * 0.18,
    torsoTwist: Math.sin(time * 1.6) * 0.05,
    toolPitch: breath * 0.1,
  };
}

/**
 * 카이로소프트풍 2등신 입체 도트 캐릭터의 모든 복셀(Voxel) 슬라이스를 생성합니다.
 * Z = 0..4 (신발과 다리), Z = 5..10 (통통한 몸통과 양팔/무기), Z = 11..18 (큰 머리, 눈/볼터치, 투구/모자)
 */
export function buildCharacterVoxelStack(
  meta: ArchetypeMeta,
  pose: CharacterAnimPose
): VoxelPoint[] {
  const voxels: VoxelPoint[] = [];
  const zOff = Math.round(pose.bodyBobZ);

  const addBox = (
    x1: number,
    x2: number,
    y1: number,
    y2: number,
    z1: number,
    z2: number,
    color: string,
    yaw = 0
  ) => {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    for (let z = z1; z <= z2; z++) {
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          const rx = yaw !== 0 ? x * cos - y * sin : x;
          const ry = yaw !== 0 ? x * sin + y * cos : y;
          voxels.push({
            x: rx,
            y: ry,
            z: z + zOff,
            color,
          });
        }
      }
    }
  };

  // =========================================================
  // 1. 발 & 다리 (Z: 0 ~ 3) — 걸을 때 양다리가 앞뒤로 교차!
  // =========================================================
  const lY = Math.round(pose.leftLegSwing);
  const rY = Math.round(pose.rightLegSwing);

  // 왼발 부츠 (Z: 0~1) & 왼다리 (Z: 2~3)
  addBox(-3, -1, -1 + lY, 2 + lY, 0, 1, '#451a03');
  addBox(-3, -1, -1 + lY, 1 + lY, 2, 3, '#334155');

  // 오른발 부츠 (Z: 0~1) & 오른다리 (Z: 2~3)
  addBox(1, 3, -1 + rY, 2 + rY, 0, 1, '#451a03');
  addBox(1, 3, -1 + rY, 1 + rY, 2, 3, '#334155');

  // =========================================================
  // 2. 몸통 & 벨트/앞치마 (Z: 4 ~ 9)
  // =========================================================
  const twist = pose.torsoTwist;
  // 허리 벨트층 (Z: 4)
  addBox(-3, 3, -2, 2, 4, 4, '#271c19', twist);
  // 금색 버클
  addBox(-1, 1, 2, 2, 4, 4, '#fbbf24', twist);

  // 상의 갑옷/의상 (Z: 5 ~ 9)
  addBox(-3, 3, -2, 2, 5, 8, meta.primaryColor, twist);
  addBox(-2, 2, -2, 2, 9, 9, meta.secondaryColor, twist);

  // 직업별 몸통 디테일
  if (meta.id === 'chef') {
    // 요리사 하얀 앞치마 & 빨간 넥 스카프
    addBox(-2, 2, 2, 2, 4, 7, '#ffffff', twist);
    addBox(-1, 1, 2, 2, 8, 9, '#ef4444', twist);
  } else if (meta.id === 'blacksmith') {
    // 대장장이 가죽 앞치마 & 풍성한 드워프 수염
    addBox(-2, 2, 2, 2, 4, 8, '#78350f', twist);
    addBox(-2, 2, 3, 3, 8, 10, meta.hairColor, twist);
  } else if (meta.id === 'knight') {
    // 기사 가슴 황금 문장
    addBox(-1, 1, 2, 2, 6, 8, '#fbbf24', twist);
  } else if (meta.id === 'mage' || meta.id === 'alchemist') {
    // 마도사/연금술사 황금 로브 라인
    addBox(0, 0, 2, 2, 5, 9, '#fbbf24', twist);
  }

  // =========================================================
  // 3. 양팔 & 손 + 직업 전용 입체 무기/도구 (Z: 5 ~ 9)
  // =========================================================
  const laY = Math.round(pose.leftArmSwing);
  const raY = Math.round(pose.rightArmSwing);
  const raZ = Math.round(pose.rightArmRaise);

  // 왼팔 & 왼손
  addBox(-5, -4, -1 + laY, 1 + laY, 6, 8, meta.secondaryColor, twist);
  addBox(-5, -4, 0 + laY, 1 + laY, 5, 5, meta.skinLight, twist);

  // 기사일 경우 왼손에 입체 방패 장착!
  if (meta.id === 'knight') {
    addBox(-6, -6, -1 + laY, 3 + laY, 5, 9, '#1e40af', twist);
    addBox(-6, -6, 0 + laY, 2 + laY, 6, 8, '#fbbf24', twist);
  }

  // 오른팔 & 오른손 (무기/도구 쥔 손)
  addBox(4, 5, -1 + raY, 1 + raY, 6 + raZ, 8 + raZ, meta.secondaryColor, twist);
  addBox(4, 5, 0 + raY, 2 + raY, 5 + raZ, 6 + raZ, meta.skinLight, twist);

  // 오른손에 들린 직업별 3D 복셀 무기 / 도구
  buildRightHandToolVoxels(meta.id, raY, raZ, twist, pose.toolPitch, addBox);

  // =========================================================
  // 4. 카이로소프트풍 큼직하고 귀여운 2등신 머리 (Z: 10 ~ 16)
  // =========================================================
  const hYaw = pose.headYaw;

  // 얼굴 피부 본체 (통통한 7x6x6 비율)
  addBox(-3, 3, -3, 3, 10, 15, meta.skinLight, hYaw);
  // 턱 아래 & 양볼 부드러운 입체 쉐이딩
  addBox(-2, 2, -2, 3, 10, 10, meta.skinDark, hYaw);

  // 귀여운 핑크 볼터치 (Z: 11, 정면 y=3 양옆)
  addBox(-3, -2, 3, 3, 11, 11, '#fb7185', hYaw);
  addBox(2, 3, 3, 3, 11, 11, '#fb7185', hYaw);

  // 또렷하고 생동감 있는 검은 눈동자 + 하이라이트 (Z: 12~13, 정면 y=3)
  addBox(-2, -2, 3, 3, 12, 13, '#1e1b18', hYaw);
  addBox(2, 2, 3, 3, 12, 13, '#1e1b18', hYaw);

  // 뒷머리 & 옆머리 기본 헤어스타일 (Z: 11 ~ 16)
  addBox(-4, 4, -4, 1, 12, 16, meta.hairColor, hYaw);
  addBox(-4, -3, -3, 2, 11, 15, meta.hairColor, hYaw);
  addBox(3, 4, -3, 2, 11, 15, meta.hairColor, hYaw);
  addBox(-3, 3, -3, 3, 16, 16, meta.hairColor, hYaw);

  // =========================================================
  // 5. 직업별 상징적인 모자 / 투구 / 고글 슬라이스 (Z: 15 ~ 22)
  // =========================================================
  buildHeadgearVoxels(meta, hYaw, addBox);

  return voxels;
}

type BoxAdder = (
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  z1: number,
  z2: number,
  color: string,
  yaw?: number
) => void;

function buildRightHandToolVoxels(
  id: CharacterArchetypeId,
  raY: number,
  raZ: number,
  twist: number,
  _pitch: number,
  addBox: BoxAdder
): void {
  const bx = 5;
  const by = 2 + raY;
  const bz = 6 + raZ;

  if (id === 'knight') {
    // 은빛 강철 장검 (금색 코등이 + 길게 뻗은 검신)
    addBox(bx, bx, by, by + 1, bz, bz, '#92400e', twist);
    addBox(bx - 1, bx + 1, by + 1, by + 1, bz + 1, bz + 1, '#fbbf24', twist);
    addBox(bx, bx, by + 1, by + 3, bz + 2, bz + 8, '#e2e8f0', twist);
    addBox(bx, bx, by + 2, by + 2, bz + 3, bz + 7, '#ffffff', twist);
  } else if (id === 'warrior') {
    // 거대한 양날 전투도끼
    addBox(bx, bx, by, by + 1, bz - 1, bz + 7, '#78350f', twist);
    addBox(bx, bx, by + 1, by + 4, bz + 4, bz + 7, '#cbd5e1', twist);
    addBox(bx, bx, by + 4, by + 4, bz + 4, bz + 7, '#ef4444', twist);
  } else if (id === 'archer') {
    // 곡선형 사냥활
    addBox(bx, bx, by + 1, by + 2, bz - 2, bz + 6, '#b45309', twist);
    addBox(bx, bx, by, by, bz - 1, bz + 5, '#fef08a', twist);
  } else if (id === 'mage') {
    // 에테르 보석 지팡이
    addBox(bx, bx, by, by + 1, bz - 2, bz + 7, '#78350f', twist);
    addBox(bx - 1, bx + 1, by, by + 2, bz + 8, bz + 10, '#38bdf8', twist);
    addBox(bx, bx, by + 1, by + 1, bz + 9, bz + 11, '#fef08a', twist);
  } else if (id === 'rogue') {
    // 예리한 암살 단검
    addBox(bx, bx, by + 1, by + 5, bz, bz + 1, '#94a3b8', twist);
    addBox(bx, bx, by + 2, by + 5, bz + 1, bz + 1, '#38bdf8', twist);
  } else if (id === 'chef') {
    // 무쇠 프라이팬 & 위에서 익어가는 황금 스테이크
    addBox(bx, bx, by + 1, by + 2, bz, bz, '#475569', twist);
    addBox(bx - 1, bx + 1, by + 3, by + 6, bz, bz + 1, '#1e293b', twist);
    addBox(bx, bx, by + 4, by + 5, bz + 1, bz + 1, '#f97316', twist);
  } else if (id === 'blacksmith') {
    // 묵직한 드워프 단조 망치
    addBox(bx, bx, by, by + 1, bz, bz + 4, '#92400e', twist);
    addBox(bx - 1, bx + 1, by - 1, by + 3, bz + 5, bz + 7, '#64748b', twist);
    addBox(bx - 1, bx + 1, by + 3, by + 3, bz + 5, bz + 7, '#cbd5e1', twist);
  } else if (id === 'alchemist') {
    // 보라색 마력 포션 플라스크
    addBox(bx - 1, bx + 1, by + 1, by + 3, bz, bz + 2, '#c084fc', twist);
    addBox(bx, bx, by + 2, by + 2, bz + 3, bz + 4, '#e0f2fe', twist);
  }
}

function buildHeadgearVoxels(
  meta: ArchetypeMeta,
  hYaw: number,
  addBox: BoxAdder
): void {
  if (meta.id === 'knight') {
    // 철제 기사 투구 + 붉은 깃털 장식
    addBox(-4, 4, -4, 3, 15, 17, '#94a3b8', hYaw);
    addBox(-3, 3, 3, 4, 15, 16, '#fbbf24', hYaw);
    addBox(-1, 1, -2, 2, 18, 20, '#ef4444', hYaw);
  } else if (meta.id === 'warrior') {
    // 양옆 황금 뿔 투구 밴드
    addBox(-4, 4, -3, 3, 15, 16, '#78350f', hYaw);
    addBox(-6, -5, 0, 1, 16, 19, '#fef08a', hYaw);
    addBox(5, 6, 0, 1, 16, 19, '#fef08a', hYaw);
  } else if (meta.id === 'archer') {
    // 초록 레인저 베레모 & 노란 깃털
    addBox(-4, 4, -3, 4, 15, 17, '#15803d', hYaw);
    addBox(3, 4, -1, 1, 17, 20, '#fde047', hYaw);
  } else if (meta.id === 'mage') {
    // 챙이 넓은 고깔 마법모자
    addBox(-5, 5, -5, 5, 15, 15, '#5b21b6', hYaw);
    addBox(-4, 4, -4, 4, 16, 16, '#fbbf24', hYaw);
    addBox(-3, 3, -3, 3, 17, 18, '#6d28d9', hYaw);
    addBox(-2, 2, -2, 2, 19, 20, '#7c3aed', hYaw);
    addBox(-1, 1, -2, 0, 21, 22, '#8b5cf6', hYaw);
  } else if (meta.id === 'rogue') {
    // 다크 네이비 암살자 후드 & 붉은 머리끈
    addBox(-4, 4, -4, 3, 15, 17, '#1e293b', hYaw);
    addBox(-4, 4, 3, 3, 15, 15, '#ef4444', hYaw);
  } else if (meta.id === 'chef') {
    // 높고 폭신한 하얀 셰프 모자 (Toque)
    addBox(-3, 3, -3, 3, 16, 18, '#f8fafc', hYaw);
    addBox(-4, 4, -4, 4, 19, 21, '#ffffff', hYaw);
  } else if (meta.id === 'blacksmith') {
    // 대장장이 이마 보호 철제 밴드
    addBox(-4, 4, -3, 3, 15, 16, '#44403c', hYaw);
    addBox(-1, 1, 3, 4, 15, 16, '#fbbf24', hYaw);
  } else if (meta.id === 'alchemist') {
    // 이마에 걸친 황동 연금술 고글
    addBox(-4, 4, -3, 3, 15, 16, '#78350f', hYaw);
    addBox(-3, -1, 3, 4, 15, 16, '#38bdf8', hYaw);
    addBox(1, 3, 3, 4, 15, 16, '#38bdf8', hYaw);
  }
}

export interface StackRenderOptions {
  scale: number;         // 복셀 1칸당 픽셀 크기 (예: 3 ~ 6)
  rotationRad: number;   // 캐릭터 360도 회전 각도 (라디안)
  tiltRatio?: number;    // 아이소메트릭 상하 기울기 비율 (기본 0.55)
  layerStepPx?: number;  // 층(Z) 1칸당 위로 쌓아 올리는 픽셀 간격
  showOutline?: boolean; // 카이로소프트풍 짙은 다크브라운 외곽선 자동 적용 여부
  showShadow?: boolean;  // 발밑 그림자 표시 여부
}

/**
 * Sprite-Stacking 핵심 렌더러!
 * Z=0(발끝)부터 Z=22(모자 끝)까지 복셀 슬라이스를 회전시켜 한 층씩 위로 쌓아 올리고,
 * 전체 실루엣 바깥쪽에 카이로소프트 특유의 다크브라운(#271c19) 도트 외곽선을 입힙니다.
 */
export function renderSpriteStackCharacter(
  ctx: CanvasRenderingContext2D,
  meta: ArchetypeMeta,
  pose: CharacterAnimPose,
  centerX: number,
  groundY: number,
  opts: StackRenderOptions
): { sliceCount: number; voxelCount: number } {
  const scale = Math.max(1, Math.round(opts.scale));
  const tilt = opts.tiltRatio ?? 0.55;
  const layerStep = opts.layerStepPx ?? Math.max(1, Math.round(scale * 0.78));
  const cos = Math.cos(opts.rotationRad);
  const sin = Math.sin(opts.rotationRad);

  const voxels = buildCharacterVoxelStack(meta, pose);

  // 1. 발밑 부드러운 타원 그림자
  if (opts.showShadow !== false) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      groundY + scale * 1.2,
      scale * 5.8,
      scale * 3.1,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(15, 12, 24, 0.42)';
    ctx.fill();
    ctx.restore();
  }

  // 2. 회전 변환 후 화면 깊이(Z층 우선, 같은 층에서는 뒤쪽 Y부터 앞쪽 Y 순서)로 정렬
  const projected = voxels.map((v) => {
    const rx = v.x * cos - v.y * sin;
    const ry = v.x * sin + v.y * cos;
    // Sprite-stacking: 각 슬라이스(v.z)를 layerStep만큼 위로 차곡차곡 쌓아 올림!
    const screenX = Math.round(centerX + rx * scale);
    const screenY = Math.round(groundY + ry * scale * tilt - v.z * layerStep);
    return {
      z: v.z,
      ry,
      rx,
      screenX,
      screenY,
      color: v.color,
    };
  });

  projected.sort((a, b) => {
    if (a.z !== b.z) return a.z - b.z;
    return a.ry - b.ry;
  });

  // 3. 카이로소프트풍 짙은 에스프레소 다크브라운(#271c19) 외곽선 패스
  // 모든 슬라이스의 바깥 테두리를 1도트 두께로 감싸 입체 도트 스프라이트가 배경에서 쨍하게 살아납니다!
  if (opts.showOutline !== false) {
    const outlineThickness = Math.max(1, Math.round(scale * 0.38));
    ctx.fillStyle = '#231714';
    for (const p of projected) {
      ctx.fillRect(
        p.screenX - outlineThickness,
        p.screenY - outlineThickness,
        scale + outlineThickness * 2,
        scale + outlineThickness * 2
      );
    }
  }

  // 4. 층별(Slice-by-Slice) 컬러 복셀 본체 및 상단 하이라이트 렌더링
  let maxZ = 0;
  for (const p of projected) {
    if (p.z > maxZ) maxZ = p.z;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.screenX, p.screenY, scale, scale);

    // 층이 쌓일 때 입체감이 살아나도록 복셀 윗면에 은은한 하이라이트 추가
    if (scale >= 3) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(p.screenX, p.screenY, scale, Math.max(1, Math.floor(scale * 0.35)));
    }
  }

  return {
    sliceCount: maxZ + 1,
    voxelCount: projected.length,
  };
}
