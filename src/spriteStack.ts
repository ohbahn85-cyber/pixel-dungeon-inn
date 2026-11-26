export type CharacterArchetypeId =
  | 'knight'      // 왕국 기사 (청색 판금갑옷 + 둥근 어깨견갑 + 깃털 투구 + 장검 & 문장방패)
  | 'warrior'     // 광전사 (붉은 모피 갑옷 + 풍성한 수염 & 뿔투구 + 양날 전투도끼)
  | 'archer'      // 명사수 (숲의 레인저 후드망토 + 가죽 튜닉 + 곡선 사냥활)
  | 'mage'        // 원소 마도사 (부드럽게 휘어진 고깔 마법모자 + 금테 로브 + 보석 지팡이)
  | 'rogue'       // 그림자 도적 (깊은 암살자 후드 & 스카프 + 경갑 + 암살 단검)
  | 'chef'        // 수석 요리사 (폭신하고 둥근 셰프 모자 + 하얀 앞치마 & 스카프 + 스테이크 팬)
  | 'blacksmith'  // 대장장이 명장 (Graveyard Keeper풍 덥수룩한 수염 + 가죽 앞치마 + 단조 망치)
  | 'alchemist';  // 왕실 연금술사 (둥근 황동 고글 + 연금술 로브 & 가방 + 마력 플라스크)

export type AnimActionId =
  | 'idle'   // 자연스러운 호흡, 눈 깜빡임, 미세한 고개 움직임
  | 'walk'   // 탄력 있는 보행, 어깨/팔다리 스윙, 망토/앞치마 흔들림
  | 'work'   // 묵직하게 팔을 들어 망치질 / 프라이팬 웍질 / 포션 흔들기
  | 'attack' // 몸통 전체 회전과 함께 무기 크게 휘두르기 (Slash 궤적 포함!)
  | 'cheer'; // 슬롯 잭팟 당첨 시 두 팔 번쩍 만세 점프!

export interface ArchetypeMeta {
  id: CharacterArchetypeId;
  name: string;
  roleLabel: string;
  badgeIcon: string;
  desc: string;
  tunicColor: string;
  tunicDark: string;
  cloakColor: string;
  hairColor: string;
  skinLight: string;
  skinShadow: string;
  accentGold: string;
  toolName: string;
  hasBeard?: boolean;
  hasApron?: boolean;
  apronColor?: string;
}

export const ARCHETYPES: ArchetypeMeta[] = [
  {
    id: 'knight',
    name: '왕국 기사 (아서)',
    roleLabel: '영웅 · 방어/장검',
    badgeIcon: '🛡️',
    desc: '둥근 강철 견갑(Pauldron)과 황금 문장 흉갑, 붉은 깃털 투구, 곡선형 문장 방패와 장검을 갖춘 기사',
    tunicColor: '#3b82f6',
    tunicDark: '#1d4ed8',
    cloakColor: '#dc2626',
    hairColor: '#d97706',
    skinLight: '#fde0bd',
    skinShadow: '#dfa878',
    accentGold: '#fbbf24',
    toolName: '강철 장검 & 왕국 문장 방패',
  },
  {
    id: 'warrior',
    name: '광전사 (가렌)',
    roleLabel: '영웅 · 돌파/도끼',
    badgeIcon: '🪓',
    desc: '그레이브야드 키퍼풍의 덥수룩한 붉은 수염과 모피 어깨장식, 묵직한 양날 전투도끼를 휘두르는 전사',
    tunicColor: '#b91c1c',
    tunicDark: '#7f1d1d',
    cloakColor: '#57534e',
    hairColor: '#ea580c',
    skinLight: '#f8cba2',
    skinShadow: '#d69766',
    accentGold: '#f59e0b',
    toolName: '룬 양날 전투도끼',
    hasBeard: true,
  },
  {
    id: 'archer',
    name: '명사수 (실비아)',
    roleLabel: '영웅 · 원거리/활',
    badgeIcon: '🏹',
    desc: '부드러운 곡선형 숲의 망토와 깃털 달린 레인저 모자, 탄력 있는 원목 사냥활을 지닌 궁수',
    tunicColor: '#16a34a',
    tunicDark: '#14532d',
    cloakColor: '#15803d',
    hairColor: '#facc15',
    skinLight: '#fee5c8',
    skinShadow: '#e2b287',
    accentGold: '#fde047',
    toolName: '엘프 곡선 사냥활',
  },
  {
    id: 'mage',
    name: '원소 마도사 (세라핀)',
    roleLabel: '영웅 · 마법/지팡이',
    badgeIcon: '🪄',
    desc: '끝이 부드럽게 휜 마법사 고깔모자와 풍성한 황금 자수 로브, 공중에 빛나는 보석 지팡이를 든 마도사',
    tunicColor: '#7c3aed',
    tunicDark: '#4c1d95',
    cloakColor: '#5b21b6',
    hairColor: '#f5d0fe',
    skinLight: '#ffead2',
    skinShadow: '#e4b996',
    accentGold: '#fbbf24',
    toolName: '아르카나 보석 지팡이',
  },
  {
    id: 'rogue',
    name: '그림자 도적 (베인)',
    roleLabel: '영웅 · 치명/단검',
    badgeIcon: '🔪',
    desc: '입가를 가린 붉은 머플러와 깊은 다크 후드, 가벼운 가죽 조끼와 예리한 초승달 단검을 쥔 도적',
    tunicColor: '#334155',
    tunicDark: '#0f172a',
    cloakColor: '#1e293b',
    hairColor: '#38bdf8',
    skinLight: '#fbd5ac',
    skinShadow: '#d99e6b',
    accentGold: '#ef4444',
    toolName: '초승달 암살단검',
  },
  {
    id: 'chef',
    name: '수석 요리사 (블랑슈)',
    roleLabel: '여관 직원 · 요리슬롯',
    badgeIcon: '👨‍🍳',
    desc: '구름처럼 폭신하고 둥근 셰프 모자(Toque)와 붉은 스카프, 깔끔한 하얀 앞치마와 스테이크 팬을 든 요리사',
    tunicColor: '#f8fafc',
    tunicDark: '#cbd5e1',
    cloakColor: '#ef4444',
    hairColor: '#b45309',
    skinLight: '#fee2c2',
    skinShadow: '#e2ae7e',
    accentGold: '#ef4444',
    toolName: '특선 스테이크 프라이팬',
    hasApron: true,
    apronColor: '#ffffff',
  },
  {
    id: 'blacksmith',
    name: '대장장이 명장 (발칸)',
    roleLabel: '대장간 직원 · 무기슬롯',
    badgeIcon: '🔨',
    desc: 'Graveyard Keeper 특유의 풍성한 드워프 수염과 두꺼운 가죽 앞치마, 묵직한 강철 단조 망치를 든 장인',
    tunicColor: '#78350f',
    tunicDark: '#451a03',
    cloakColor: '#57534e',
    hairColor: '#d97706',
    skinLight: '#f5c296',
    skinShadow: '#d28e5a',
    accentGold: '#fbbf24',
    toolName: '드워프 강철 단조 망치',
    hasBeard: true,
    hasApron: true,
    apronColor: '#92400e',
  },
  {
    id: 'alchemist',
    name: '왕실 연금술사 (파라켈)',
    roleLabel: '포션가게 직원 · 연금슬롯',
    badgeIcon: '🧪',
    desc: '이마에 걸친 둥근 황동 렌즈 고글과 에메랄드 연금 로브, 영롱하게 빛나는 둥근 마력 플라스크를 든 연금술사',
    tunicColor: '#0d9488',
    tunicDark: '#115e59',
    cloakColor: '#0f766e',
    hairColor: '#fde047',
    skinLight: '#ffead2',
    skinShadow: '#e2b388',
    accentGold: '#fbbf24',
    toolName: '발광 에테르 플라스크',
    hasApron: true,
    apronColor: '#fef3c7',
  },
];

export interface CharacterAnimPose {
  action: AnimActionId;
  leftLegSwing: number;
  rightLegSwing: number;
  leftFootLift: number;
  rightFootLift: number;
  leftArmSwing: number;
  rightArmSwing: number;
  rightArmRaise: number;
  bodyBobZ: number;
  squashStretch: number; // +면 위로 길어짐(Stretch), -면 아래로 통통해짐(Squash)
  headYaw: number;
  headTilt: number;
  torsoTwist: number;
  toolSwingAngle: number;
  blinkAmount: number;   // 0(눈뜸) ~ 1(눈감음)
  slashAlpha: number;    // 공격/망치질 시 궤적 이펙트 투명도
}

/**
 * Graveyard Keeper 2 스타일의 탄력 있고 묵직한(Weighty & Expressive) 관절 애니메이션 계산
 */
export function computeAnimPose(
  action: AnimActionId,
  t: number,
  phaseOffset = 0
): CharacterAnimPose {
  const time = t + phaseOffset;
  // 자연스러운 눈 깜빡임 (3.8초 주기)
  const blinkCycle = (time + phaseOffset * 0.7) % 3.8;
  const blinkAmount =
    blinkCycle > 3.62 ? Math.sin(((blinkCycle - 3.62) / 0.18) * Math.PI) : 0;

  if (action === 'walk') {
    const cycle = time * 8.5;
    const sin = Math.sin(cycle);
    const cos = Math.cos(cycle);
    const bounce = Math.abs(sin);
    return {
      action,
      leftLegSwing: sin * 4.5,
      rightLegSwing: -sin * 4.5,
      leftFootLift: Math.max(0, sin) * 3.2,
      rightFootLift: Math.max(0, -sin) * 3.2,
      leftArmSwing: -sin * 4.0,
      rightArmSwing: sin * 4.0,
      rightArmRaise: bounce * 1.5,
      bodyBobZ: bounce * 3.2,
      squashStretch: (bounce - 0.5) * 0.08,
      headYaw: Math.sin(cycle * 0.5) * 0.1,
      headTilt: cos * 0.06,
      torsoTwist: sin * 0.18,
      toolSwingAngle: sin * 0.3,
      blinkAmount,
      slashAlpha: 0,
    };
  }

  if (action === 'work') {
    // 그레이브야드 키퍼 특유의 묵직한 망치질 / 요리 모션:
    // 천천히 높이 들어올렸다가(Anticipation) 빠르게 쾅! 내려치는 비대칭 커브
    const cycle = (time * 2.2) % 1; // 0..1
    let raise = 0;
    let swing = 0;
    let squash = 0;
    let slash = 0;

    if (cycle < 0.55) {
      // 들어올리기
      const p = cycle / 0.55;
      const ease = Math.sin(p * Math.PI * 0.5);
      raise = ease * 9.5;
      swing = -ease * 1.1;
      squash = ease * 0.07;
    } else if (cycle < 0.72) {
      // 강하게 내려치기!
      const p = (cycle - 0.55) / 0.17;
      raise = (1 - p) * 9.5 - p * 3.0;
      swing = -1.1 + p * 2.4;
      squash = -p * 0.1;
      slash = Math.sin(p * Math.PI);
    } else {
      // 타격 후 반동 회복
      const p = (cycle - 0.72) / 0.28;
      raise = (1 - p) * -3.0;
      swing = (1 - p) * 1.3;
      squash = (1 - p) * -0.1;
    }

    return {
      action,
      leftLegSwing: 0,
      rightLegSwing: 1.5,
      leftFootLift: 0,
      rightFootLift: 0,
      leftArmSwing: 1.5,
      rightArmSwing: swing * 3.5,
      rightArmRaise: raise,
      bodyBobZ: Math.max(0, raise * 0.25),
      squashStretch: squash,
      headYaw: -swing * 0.08,
      headTilt: swing * 0.1,
      torsoTwist: -swing * 0.24,
      toolSwingAngle: swing,
      blinkAmount: cycle >= 0.55 && cycle < 0.78 ? 1 : blinkAmount,
      slashAlpha: slash,
    };
  }

  if (action === 'attack') {
    const cycle = (time * 1.8) % 1;
    let swing = 0;
    let raise = 0;
    let slash = 0;
    let twist = 0;

    if (cycle < 0.45) {
      const p = cycle / 0.45;
      swing = -p * 1.3;
      raise = p * 8.0;
      twist = -p * 0.4;
    } else if (cycle < 0.68) {
      const p = (cycle - 0.45) / 0.23;
      swing = -1.3 + p * 2.8;
      raise = (1 - p) * 8.0 - p * 2.0;
      twist = -0.4 + p * 0.9;
      slash = Math.sin(p * Math.PI);
    } else {
      const p = (cycle - 0.68) / 0.32;
      swing = (1 - p) * 1.5;
      raise = (1 - p) * -2.0;
      twist = (1 - p) * 0.5;
    }

    return {
      action,
      leftLegSwing: -2.0,
      rightLegSwing: 2.8,
      leftFootLift: 0,
      rightFootLift: 0,
      leftArmSwing: -swing * 2.5,
      rightArmSwing: swing * 4.5,
      rightArmRaise: raise,
      bodyBobZ: Math.max(0, slash * 3.0),
      squashStretch: slash * 0.08,
      headYaw: twist * 0.3,
      headTilt: 0,
      torsoTwist: twist,
      toolSwingAngle: swing,
      blinkAmount,
      slashAlpha: slash,
    };
  }

  if (action === 'cheer') {
    const cycle = time * 9.0;
    const jump = Math.max(0, Math.sin(cycle));
    return {
      action,
      leftLegSwing: Math.sin(cycle) * 2.0,
      rightLegSwing: -Math.sin(cycle) * 2.0,
      leftFootLift: jump * 4.0,
      rightFootLift: jump * 4.0,
      leftArmSwing: 1.5,
      rightArmSwing: 1.5,
      rightArmRaise: 7.5 + jump * 3.0,
      bodyBobZ: jump * 8.0,
      squashStretch: (jump - 0.3) * 0.1,
      headYaw: Math.sin(cycle * 0.5) * 0.2,
      headTilt: Math.sin(cycle) * 0.08,
      torsoTwist: Math.sin(cycle * 0.5) * 0.2,
      toolSwingAngle: -0.6,
      blinkAmount: 0,
      slashAlpha: 0,
    };
  }

  // 기본 idle
  const breath = Math.sin(time * 3.0);
  return {
    action,
    leftLegSwing: 0,
    rightLegSwing: 0,
    leftFootLift: 0,
    rightFootLift: 0,
    leftArmSwing: 0,
    rightArmSwing: 0,
    rightArmRaise: breath * 0.8,
    bodyBobZ: Math.max(0, breath) * 0.8,
    squashStretch: breath * 0.025,
    headYaw: Math.sin(time * 1.4) * 0.16,
    headTilt: Math.cos(time * 1.4) * 0.03,
    torsoTwist: Math.sin(time * 1.4) * 0.06,
    toolSwingAngle: breath * 0.08,
    blinkAmount,
    slashAlpha: 0,
  };
}

/**
 * 매끄러운 2.5D 벡터/툰 스태킹 슬라이스 프리미티브
 * 네모난 도트/픽셀이 아니라 매끈한 타원(Disc), 캡슐(Capsule), 둥근 리본(Rounded Quad)으로 적층됩니다!
 */
export interface SmoothSliceLayer {
  z: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  colorTop: string;
  colorSide: string;
  outline?: boolean;
  rotOffset?: number;
  partTag: 'boot' | 'torso' | 'cloak' | 'arm' | 'head' | 'beard' | 'hat' | 'tool';
}

/**
 * 캐릭터를 구성하는 Z=0(부츠 바닥) ~ Z=28(모자/투구 꼭대기)까지의 매끄러운 유기적 타원 슬라이스들을 생성합니다.
 * 각 층의 반지름(rx, ry)이 사인/코사인 곡선을 따라 둥글게 변화하여 구형(Sphere)과 캡슐(Capsule) 입체를 만듭니다.
 */
export function buildSmoothCharacterLayers(
  meta: ArchetypeMeta,
  pose: CharacterAnimPose
): SmoothSliceLayer[] {
  const layers: SmoothSliceLayer[] = [];
  const zBob = pose.bodyBobZ;
  const stretchZ = 1 + pose.squashStretch;
  const squashXY = 1 - pose.squashStretch * 0.6;

  const pushLayer = (layer: SmoothSliceLayer) => {
    layers.push({
      ...layer,
      z: layer.z * stretchZ + zBob,
      rx: layer.rx * squashXY,
      ry: layer.ry * squashXY,
    });
  };

  // =========================================================
  // 1. 둥근 가죽 부츠 & 다리 (Z: 0 ~ 5)
  // =========================================================
  for (let z = 0; z <= 5; z++) {
    const isFoot = z <= 2;
    const footRadiusX = isFoot ? 2.5 - z * 0.15 : 2.0;
    const footRadiusY = isFoot ? 3.2 - z * 0.2 : 2.1;
    const colorTop = isFoot ? '#5c3a21' : '#334155';
    const colorSide = isFoot ? '#3b2313' : '#1e293b';

    // 왼다리
    pushLayer({
      z: z + pose.leftFootLift * 0.4,
      x: -2.6,
      y: pose.leftLegSwing * 0.55 + (isFoot ? 0.6 : 0),
      rx: footRadiusX,
      ry: footRadiusY,
      colorTop,
      colorSide,
      partTag: 'boot',
    });

    // 오른다리
    pushLayer({
      z: z + pose.rightFootLift * 0.4,
      x: 2.6,
      y: pose.rightLegSwing * 0.55 + (isFoot ? 0.6 : 0),
      rx: footRadiusX,
      ry: footRadiusY,
      colorTop,
      colorSide,
      partTag: 'boot',
    });
  }

  // =========================================================
  // 2. 통통하고 둥근 중세 튜닉/갑옷 몸통 & 망토/앞치마 (Z: 5 ~ 13)
  // Graveyard Keeper 특유의 아랫배가 살짝 통통하고 어깨가 둥근 물방울형 몸통
  // =========================================================
  for (let z = 5; z <= 13; z++) {
    const t = (z - 5) / 8; // 0..1
    // 배 부분은 통통하고 목 쪽으로 갈수록 자연스럽게 좁아지는 타원 곡선
    const profile = Math.sin(t * Math.PI * 0.85 + 0.2);
    const rx = 4.6 + profile * 1.4;
    const ry = 3.8 + profile * 1.1;

    const isBelt = z === 6;
    const cTop = isBelt ? '#3b2313' : meta.tunicColor;
    const cSide = isBelt ? '#23140a' : meta.tunicDark;

    // 등 뒤로 부드럽게 흘러내리는 망토 슬라이스
    pushLayer({
      z,
      x: 0,
      y: -1.3 - (1 - t) * 1.2,
      rx: rx * 0.95,
      ry: ry * 0.7,
      colorTop: meta.cloakColor,
      colorSide: '#1e1b2e',
      rotOffset: pose.torsoTwist,
      partTag: 'cloak',
    });

    // 메인 몸통 슬라이스
    pushLayer({
      z,
      x: 0,
      y: 0,
      rx,
      ry,
      colorTop: cTop,
      colorSide: cSide,
      rotOffset: pose.torsoTwist,
      partTag: 'torso',
    });

    // 앞치마 (요리사, 대장장이, 연금술사)
    if (meta.hasApron && z >= 5 && z <= 11) {
      pushLayer({
        z,
        x: 0,
        y: 1.4,
        rx: rx * 0.76,
        ry: ry * 0.65,
        colorTop: meta.apronColor || '#ffffff',
        colorSide: '#cbd5e1',
        rotOffset: pose.torsoTwist,
        partTag: 'torso',
      });
    }
  }

  // =========================================================
  // 3. 둥근 어깨 견갑(Pauldrons) & 양팔/둥근 손 (Z: 8 ~ 13)
  // =========================================================
  for (let z = 8; z <= 13; z++) {
    const armT = (z - 8) / 5;
    const armR = 2.0 + Math.sin(armT * Math.PI) * 0.5;
    const isHand = z === 8;

    // 왼팔
    pushLayer({
      z,
      x: -6.2,
      y: pose.leftArmSwing * 0.5,
      rx: armR,
      ry: armR * 1.1,
      colorTop: isHand ? meta.skinLight : meta.tunicColor,
      colorSide: isHand ? meta.skinShadow : meta.tunicDark,
      rotOffset: pose.torsoTwist,
      partTag: 'arm',
    });

    // 오른팔 (작업/공격 시 높이 들림)
    pushLayer({
      z: z + pose.rightArmRaise * 0.45,
      x: 6.2,
      y: pose.rightArmSwing * 0.5,
      rx: armR,
      ry: armR * 1.1,
      colorTop: isHand ? meta.skinLight : meta.tunicColor,
      colorSide: isHand ? meta.skinShadow : meta.tunicDark,
      rotOffset: pose.torsoTwist,
      partTag: 'arm',
    });
  }

  // =========================================================
  // 4. 둥글고 입체적인 구형(Ellipsoid) 머리 & 볼살 & 수염 (Z: 14 ~ 22)
  // 네모난 모서리가 전혀 없이 매끄러운 구형 슬라이스로 적층!
  // =========================================================
  for (let z = 14; z <= 22; z++) {
    const ht = (z - 14) / 8; // 0(턱) .. 0.5(볼/눈) .. 1.0(정수리)
    const sphereProfile = Math.sin(ht * Math.PI);
    // 볼 부분(ht=0.35)이 살짝 더 통통한 귀여운 치비 두상
    const cheekBulge = ht < 0.5 ? Math.sin(ht * Math.PI * 2) * 0.65 : 0;
    const rx = 3.2 + sphereProfile * 3.4 + cheekBulge;
    const ry = 3.0 + sphereProfile * 3.1 + cheekBulge * 0.8;

    // 얼굴 피부 슬라이스
    pushLayer({
      z,
      x: 0,
      y: 0,
      rx,
      ry,
      colorTop: meta.skinLight,
      colorSide: meta.skinShadow,
      rotOffset: pose.headYaw,
      partTag: 'head',
    });

    // Graveyard Keeper풍 덥수룩하고 둥근 입체 수염 (대장장이, 광전사)
    if (meta.hasBeard && z >= 13 && z <= 17) {
      const bt = (z - 13) / 4;
      const br = 3.5 + Math.sin(bt * Math.PI) * 2.2;
      pushLayer({
        z,
        x: 0,
        y: 1.8 + (1 - bt) * 0.8,
        rx: br,
        ry: br * 0.78,
        colorTop: meta.hairColor,
        colorSide: '#78350f',
        rotOffset: pose.headYaw,
        partTag: 'beard',
      });
    }

    // 뒷머리 & 옆머리 볼륨 슬라이스
    if (z >= 16) {
      pushLayer({
        z,
        x: 0,
        y: -0.9,
        rx: rx * 1.06,
        ry: ry * 1.04,
        colorTop: meta.hairColor,
        colorSide: '#451a03',
        rotOffset: pose.headYaw,
        partTag: 'head',
      });
    }
  }

  // =========================================================
  // 5. 직업별 둥글고 디테일한 모자 / 투구 / 고글 슬라이스 (Z: 21 ~ 28)
  // =========================================================
  buildSmoothHeadgearLayers(meta, pose, pushLayer);

  return layers;
}

function buildSmoothHeadgearLayers(
  meta: ArchetypeMeta,
  pose: CharacterAnimPose,
  pushLayer: (l: SmoothSliceLayer) => void
): void {
  const hYaw = pose.headYaw;

  if (meta.id === 'knight') {
    // 둥근 돔형 강철 투구 + 풍성하게 휘날리는 붉은 깃털(Plume)
    for (let z = 20; z <= 24; z++) {
      const t = (z - 20) / 4;
      const r = 6.2 * Math.cos(t * Math.PI * 0.42);
      pushLayer({
        z,
        x: 0,
        y: 0,
        rx: r,
        ry: r * 0.95,
        colorTop: '#cbd5e1',
        colorSide: '#64748b',
        rotOffset: hYaw,
        partTag: 'hat',
      });
    }
    // 투구 위 붉은 깃털 곡선
    for (let z = 24; z <= 28; z++) {
      const pt = (z - 24) / 4;
      pushLayer({
        z,
        x: 0,
        y: -pt * 2.5,
        rx: 1.8 - pt * 0.3,
        ry: 2.8 + pt * 0.8,
        colorTop: '#ef4444',
        colorSide: '#991b1b',
        rotOffset: hYaw,
        partTag: 'hat',
      });
    }
  } else if (meta.id === 'mage') {
    // 둥글고 넓은 마법모자 챙(Brim) + 끝이 뒤로 부드럽게 휘어진 고깔(Cone)
    pushLayer({
      z: 20.5,
      x: 0,
      y: 0,
      rx: 9.2,
      ry: 8.6,
      colorTop: '#6d28d9',
      colorSide: '#4c1d95',
      rotOffset: hYaw,
      partTag: 'hat',
    });
    pushLayer({
      z: 21.3,
      x: 0,
      y: 0,
      rx: 6.2,
      ry: 5.8,
      colorTop: '#fbbf24',
      colorSide: '#b45309',
      rotOffset: hYaw,
      partTag: 'hat',
    });
    for (let z = 22; z <= 28; z++) {
      const ct = (z - 22) / 6;
      const r = Math.max(1.1, 5.4 * (1 - ct * 0.82));
      pushLayer({
        z,
        x: 0,
        y: -ct * ct * 3.8, // 뒤로 멋지게 휘어지는 마법모자 곡선!
        rx: r,
        ry: r * 0.95,
        colorTop: '#7c3aed',
        colorSide: '#4c1d95',
        rotOffset: hYaw,
        partTag: 'hat',
      });
    }
  } else if (meta.id === 'chef') {
    // 구름처럼 폭신하게 부풀어 오른 하얀 셰프 모자 (Toque)
    for (let z = 21; z <= 27; z++) {
      const ct = (z - 21) / 6;
      const puff = ct < 0.4 ? 5.2 : 5.2 + Math.sin(((ct - 0.4) / 0.6) * Math.PI) * 1.6;
      pushLayer({
        z,
        x: 0,
        y: 0,
        rx: puff,
        ry: puff * 0.94,
        colorTop: '#ffffff',
        colorSide: '#cbd5e1',
        rotOffset: hYaw,
        partTag: 'hat',
      });
    }
  } else if (meta.id === 'archer') {
    // 둥근 숲의 로빈후드 베레모 & 노란 깃털
    for (let z = 20; z <= 24; z++) {
      const ct = (z - 20) / 4;
      const r = 6.2 * (1 - ct * 0.45);
      pushLayer({
        z,
        x: 0,
        y: 0.4,
        rx: r,
        ry: r * 0.96,
        colorTop: '#16a34a',
        colorSide: '#14532d',
        rotOffset: hYaw,
        partTag: 'hat',
      });
    }
    for (let z = 22; z <= 27; z++) {
      const ft = (z - 22) / 5;
      pushLayer({
        z,
        x: 4.5 + ft * 1.2,
        y: -1.0 - ft * 1.5,
        rx: 1.2,
        ry: 2.0,
        colorTop: '#fde047',
        colorSide: '#ca8a04',
        rotOffset: hYaw,
        partTag: 'hat',
      });
    }
  } else if (meta.id === 'warrior') {
    // 가죽 투구 밴드 + 양옆으로 둥글게 솟은 바이킹 황금 뿔
    pushLayer({
      z: 20.5,
      x: 0,
      y: 0,
      rx: 6.3,
      ry: 6.0,
      colorTop: '#78350f',
      colorSide: '#451a03',
      rotOffset: hYaw,
      partTag: 'hat',
    });
    for (let z = 21; z <= 26; z++) {
      const ht = (z - 21) / 5;
      const hornX = 5.8 + Math.sin(ht * Math.PI * 0.8) * 2.4;
      const hornR = Math.max(0.9, 1.9 * (1 - ht * 0.65));
      pushLayer({
        z,
        x: -hornX,
        y: 0.5,
        rx: hornR,
        ry: hornR,
        colorTop: '#fef08a',
        colorSide: '#ca8a04',
        rotOffset: hYaw,
        partTag: 'hat',
      });
      pushLayer({
        z,
        x: hornX,
        y: 0.5,
        rx: hornR,
        ry: hornR,
        colorTop: '#fef08a',
        colorSide: '#ca8a04',
        rotOffset: hYaw,
        partTag: 'hat',
      });
    }
  } else if (meta.id === 'rogue') {
    // 둥근 다크 후드 & 입가를 감싼 붉은 스카프
    pushLayer({
      z: 14.8,
      x: 0,
      y: 1.1,
      rx: 5.5,
      ry: 4.8,
      colorTop: '#dc2626',
      colorSide: '#991b1b',
      rotOffset: hYaw,
      partTag: 'hat',
    });
    for (let z = 20; z <= 24; z++) {
      const ct = (z - 20) / 4;
      const r = 6.3 * (1 - ct * 0.5);
      pushLayer({
        z,
        x: 0,
        y: -ct * 1.2,
        rx: r,
        ry: r,
        colorTop: '#334155',
        colorSide: '#0f172a',
        rotOffset: hYaw,
        partTag: 'hat',
      });
    }
  } else if (meta.id === 'alchemist' || meta.id === 'blacksmith') {
    // 이마 위 가죽 스트랩
    pushLayer({
      z: 20.5,
      x: 0,
      y: 0,
      rx: 6.2,
      ry: 5.9,
      colorTop: '#78350f',
      colorSide: '#451a03',
      rotOffset: hYaw,
      partTag: 'hat',
    });
  }
}

export interface StackRenderOptions {
  scale: number;         // 스케일 배율 (3 ~ 7)
  rotationRad: number;   // 360도 카메라 회전 각도
  tiltRatio?: number;    // 직교 카메라 상하 기울기 비율 (기본 0.56)
  layerStepPx?: number;  // 층(Z) 간격
  showOutline?: boolean; // 다크브라운 카툰 외곽선 표시 여부
  showShadow?: boolean;  // 발밑 그림자 표시 여부
}

/**
 * Graveyard Keeper 2 스타일 매끄러운 2.5D 스태킹 렌더러!
 * 네모난 도트(fillRect)를 전혀 사용하지 않고, 매끄러운 타원/캡슐 슬라이스와
 * 실시간 2톤 셀 쉐이딩 그라데이션, 생동감 있는 눈동자/표정, 곡선형 무기/도구를 렌더링합니다.
 */
export function renderSpriteStackCharacter(
  ctx: CanvasRenderingContext2D,
  meta: ArchetypeMeta,
  pose: CharacterAnimPose,
  centerX: number,
  groundY: number,
  opts: StackRenderOptions
): { sliceCount: number; voxelCount: number } {
  const s = opts.scale * 0.65;
  const tilt = opts.tiltRatio ?? 0.56;
  const layerStep = opts.layerStepPx
    ? opts.layerStepPx * 0.52
    : s * 1.85;

  const layers = buildSmoothCharacterLayers(meta, pose);

  // 1. 발밑 부드러운 그라데이션 타원 그림자
  if (opts.showShadow !== false) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      groundY + s * 1.5,
      s * 9.5,
      s * 5.2,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = 'rgba(15, 10, 24, 0.45)';
    ctx.fill();
    ctx.restore();
  }

  // 각 레이어의 3D 회전 후 화면 좌표 계산
  const projected = layers.map((l) => {
    const totalAngle = opts.rotationRad + (l.rotOffset || 0);
    const cos = Math.cos(totalAngle);
    const sin = Math.sin(totalAngle);
    const rx = l.x * cos - l.y * sin;
    const ry = l.x * sin + l.y * cos;

    const screenX = centerX + rx * s;
    const screenY = groundY + ry * s * tilt - l.z * layerStep;
    return {
      ...l,
      ryDepth: ry,
      screenX,
      screenY,
      radiusX: l.rx * s,
      radiusY: Math.max(2, l.ry * s * (0.62 + tilt * 0.35)),
      totalAngle,
    };
  });

  // Z층 순서대로(같은 층이면 뒤쪽부터 앞쪽 순서로) 정렬
  projected.sort((a, b) => {
    if (Math.abs(a.z - b.z) > 0.15) return a.z - b.z;
    return a.ryDepth - b.ryDepth;
  });

  // 2. 카이로/그레이브야드 키퍼풍 부드러운 에스프레소 다크브라운(#231512) 외곽선 실루엣 패스
  if (opts.showOutline !== false) {
    const pad = Math.max(2.2, s * 0.68);
    ctx.fillStyle = '#231512';
    for (const p of projected) {
      ctx.beginPath();
      ctx.ellipse(
        p.screenX,
        p.screenY,
        p.radiusX + pad,
        p.radiusY + pad,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // 3. 매끄러운 타원 슬라이스 적층 + 실시간 상하단 2톤 셀 쉐이딩 렌더링
  const faceAnchor = projected.find(
    (p) => p.partTag === 'head' && Math.abs(p.z - (17.5 + pose.bodyBobZ)) < 1.2
  );

  for (const p of projected) {
    ctx.save();
    // 아랫면 입체 두께(Side Rim)
    ctx.beginPath();
    ctx.ellipse(
      p.screenX,
      p.screenY + s * 0.45,
      p.radiusX,
      p.radiusY,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = p.colorSide;
    ctx.fill();

    // 윗면 메인 컬러(Top Soft Gradient)
    const grad = ctx.createLinearGradient(
      p.screenX - p.radiusX * 0.4,
      p.screenY - p.radiusY,
      p.screenX + p.radiusX * 0.4,
      p.screenY + p.radiusY
    );
    grad.addColorStop(0, p.colorTop);
    grad.addColorStop(0.75, p.colorTop);
    grad.addColorStop(1, p.colorSide);

    ctx.beginPath();
    ctx.ellipse(
      p.screenX,
      p.screenY,
      p.radiusX,
      p.radiusY,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // 4. 얼굴 표정(안광 있는 둥근 눈동자, 눈썹, 발그레한 볼터치, 황동 고글) 렌더링
  if (faceAnchor) {
    drawExpressiveFace(ctx, meta, pose, faceAnchor.screenX, faceAnchor.screenY, faceAnchor.totalAngle, s, tilt);
  }

  // 5. 곡선형 2.5D 입체 무기 & 도구 (방패, 장검, 전투도끼, 활, 지팡이, 프라이팬, 망치, 플라스크)
  drawSmoothWeaponsAndTools(ctx, meta, pose, centerX, groundY, opts.rotationRad, s, tilt, layerStep);

  return {
    sliceCount: 29,
    voxelCount: projected.length,
  };
}

/**
 * 캐릭터가 카메라 정면/측면을 바라볼 때 자연스럽게 돌아가는 생동감 있는 눈동자, 안광, 볼터치, 눈썹을 그립니다.
 */
function drawExpressiveFace(
  ctx: CanvasRenderingContext2D,
  meta: ArchetypeMeta,
  pose: CharacterAnimPose,
  headX: number,
  headY: number,
  totalAngle: number,
  s: number,
  tilt: number
): void {
  const cos = Math.cos(totalAngle);
  const sin = Math.sin(totalAngle);

  // 정면 벡터(0, 1)의 회전 후 Y값이 양수일 때만 얼굴 앞면이 카메라를 향함
  if (cos < -0.25) return;

  const projectFacePt = (fx: number, fy: number, fzOffset: number) => {
    const rx = fx * cos - fy * sin;
    const ry = fx * sin + fy * cos;
    return {
      x: headX + rx * s,
      y: headY + ry * s * tilt - fzOffset * s,
      visible: ry > -1.2,
    };
  };

  // 양쪽 볼터치
  const leftCheek = projectFacePt(-2.8, 4.9, -0.6);
  const rightCheek = projectFacePt(2.8, 4.9, -0.6);

  ctx.save();
  for (const ch of [leftCheek, rightCheek]) {
    if (!ch.visible) continue;
    ctx.beginPath();
    ctx.ellipse(ch.x, ch.y, s * 1.15, s * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.38)';
    ctx.fill();
  }

  // 양쪽 눈동자
  const leftEye = projectFacePt(-1.95, 5.1, 0.4);
  const rightEye = projectFacePt(1.95, 5.1, 0.4);

  for (const eye of [leftEye, rightEye]) {
    if (!eye.visible) continue;

    if (pose.action === 'cheer') {
      // 잭팟 환호할 때 활짝 웃는 눈 (^ ^)
      ctx.beginPath();
      ctx.arc(eye.x, eye.y + s * 0.3, s * 0.95, Math.PI * 1.1, Math.PI * 1.9);
      ctx.lineWidth = Math.max(2, s * 0.55);
      ctx.strokeStyle = '#231512';
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (pose.blinkAmount > 0.55) {
      // 눈 깜빡이거나 힘주어 망치질할 때 감은 눈 (- -)
      ctx.beginPath();
      ctx.moveTo(eye.x - s * 0.85, eye.y);
      ctx.lineTo(eye.x + s * 0.85, eye.y);
      ctx.lineWidth = Math.max(2, s * 0.52);
      ctx.strokeStyle = '#231512';
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      // 그레이브야드 키퍼풍의 또렷하고 둥근 눈 + 반짝이는 하얀 안광(Highlight)!
      ctx.beginPath();
      ctx.ellipse(eye.x, eye.y, s * 0.82, s * 1.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1e1410';
      ctx.fill();

      // 눈동자 상단 하얀 안광
      ctx.beginPath();
      ctx.arc(eye.x - s * 0.22, eye.y - s * 0.32, s * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  // 연금술사 이마 위 둥근 황동 고글 렌즈
  if (meta.id === 'alchemist') {
    const gLeft = projectFacePt(-2.1, 5.2, 2.7);
    const gRight = projectFacePt(2.1, 5.2, 2.7);
    for (const g of [gLeft, gRight]) {
      if (!g.visible) continue;
      ctx.beginPath();
      ctx.arc(g.x, g.y, s * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
      ctx.lineWidth = Math.max(2, s * 0.5);
      ctx.strokeStyle = '#b45309';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(g.x - s * 0.35, g.y - s * 0.35, s * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#e0f2fe';
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * 네모난 도트 계단이 전혀 없는 매끈한 2.5D 카툰 곡선으로 각 직업의 무기와 도구를 렌더링합니다.
 */
function drawSmoothWeaponsAndTools(
  ctx: CanvasRenderingContext2D,
  meta: ArchetypeMeta,
  pose: CharacterAnimPose,
  centerX: number,
  groundY: number,
  rotationRad: number,
  s: number,
  tilt: number,
  layerStep: number
): void {
  const totalAngle = rotationRad + pose.torsoTwist;
  const cos = Math.cos(totalAngle);
  const sin = Math.sin(totalAngle);

  const project3D = (lx: number, ly: number, lz: number) => {
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    return {
      x: centerX + rx * s,
      y: groundY + ry * s * tilt - (lz + pose.bodyBobZ) * layerStep,
      ry,
    };
  };

  // 1. 기사 왼손 문장 방패
  if (meta.id === 'knight') {
    const sh = project3D(-6.8, pose.leftArmSwing * 0.5 + 1.5, 9.5);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(sh.x - s * 2.5, sh.y - s * 3.4, s * 5.0, s * 6.8, [s * 1.2, s * 1.2, s * 2.8, s * 2.8]);
    ctx.fillStyle = '#1d4ed8';
    ctx.fill();
    ctx.lineWidth = Math.max(2, s * 0.65);
    ctx.strokeStyle = '#231512';
    ctx.stroke();

    // 방패 금빛 테두리와 중앙 십자 문장
    ctx.beginPath();
    ctx.roundRect(sh.x - s * 1.8, sh.y - s * 2.6, s * 3.6, s * 5.2, [s * 0.8, s * 0.8, s * 2.0, s * 2.0]);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = Math.max(1.5, s * 0.45);
    ctx.stroke();
    ctx.restore();
  }

  // 2. 오른손 무기/도구 기준점
  const hand = project3D(
    6.4,
    pose.rightArmSwing * 0.5 + 1.8,
    9.5 + pose.rightArmRaise * 0.45
  );

  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(pose.toolSwingAngle);

  // 공격/망치질 순간 부드러운 반달 슬래시(Slash) 잔상 이펙트!
  if (pose.slashAlpha > 0.08) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, s * 10.5, -Math.PI * 0.65, Math.PI * 0.35);
    ctx.lineWidth = s * 2.2;
    ctx.strokeStyle = `rgba(254, 240, 138, ${pose.slashAlpha * 0.65})`;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  const outlineW = Math.max(2.2, s * 0.65);
  ctx.strokeStyle = '#231512';
  ctx.lineWidth = outlineW;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (meta.id === 'knight') {
    // 매끈한 강철 장검
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.5);
    ctx.lineTo(-s * 1.3, -s * 11.5);
    ctx.lineTo(0, -s * 14.2);
    ctx.lineTo(s * 1.3, -s * 11.5);
    ctx.closePath();
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();
    ctx.stroke();

    // 황금 코등이(Crossguard)
    ctx.beginPath();
    ctx.roundRect(-s * 2.6, -s * 2.2, s * 5.2, s * 1.4, s * 0.6);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.stroke();
  } else if (meta.id === 'warrior') {
    // 묵직한 곡선형 양날 전투도끼
    ctx.beginPath();
    ctx.roundRect(-s * 0.7, -s * 13.0, s * 1.4, s * 15.0, s * 0.6);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -s * 9.5, s * 4.2, -Math.PI * 0.38, Math.PI * 0.38);
    ctx.arc(0, -s * 9.5, s * 4.2, Math.PI * 0.62, Math.PI * 1.38);
    ctx.closePath();
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();
    ctx.stroke();
  } else if (meta.id === 'archer') {
    // 유려한 곡선 사냥활
    ctx.beginPath();
    ctx.arc(-s * 1.5, 0, s * 6.5, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.lineWidth = Math.max(2.5, s * 0.95);
    ctx.strokeStyle = '#92400e';
    ctx.stroke();

    // 활시위
    ctx.beginPath();
    ctx.moveTo(0, -s * 6.2);
    ctx.lineTo(0, s * 6.2);
    ctx.lineWidth = Math.max(1.2, s * 0.3);
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();
  } else if (meta.id === 'mage') {
    // 원목 마법 지팡이 & 발광하는 에테르 보석 구체
    ctx.beginPath();
    ctx.roundRect(-s * 0.65, -s * 12.5, s * 1.3, s * 15.0, s * 0.6);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -s * 13.5, s * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-s * 0.6, -s * 14.1, s * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (meta.id === 'rogue') {
    // 날렵한 초승달 단검
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 2.2, -s * 4.5, 0, -s * 8.5);
    ctx.quadraticCurveTo(-s * 0.8, -s * 4.5, 0, 0);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.stroke();
  } else if (meta.id === 'chef') {
    // 둥근 무쇠 프라이팬 & 위에서 지글거리는 스테이크
    ctx.beginPath();
    ctx.roundRect(-s * 0.6, -s * 4.0, s * 1.2, s * 4.5, s * 0.5);
    ctx.fillStyle = '#475569';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, -s * 6.8, s * 3.6, s * 2.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.stroke();

    // 팬 안의 황금빛 스테이크
    ctx.beginPath();
    ctx.ellipse(0, -s * 6.9, s * 2.2, s * 1.5, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ea580c';
    ctx.fill();
  } else if (meta.id === 'blacksmith') {
    // 그레이브야드 키퍼풍 묵직한 드워프 단조 망치
    ctx.beginPath();
    ctx.roundRect(-s * 0.7, -s * 9.0, s * 1.4, s * 10.5, s * 0.6);
    ctx.fillStyle = '#92400e';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-s * 3.4, -s * 11.8, s * 6.8, s * 3.8, s * 1.1);
    ctx.fillStyle = '#64748b';
    ctx.fill();
    ctx.stroke();
  } else if (meta.id === 'alchemist') {
    // 둥근 유리 플라스크와 출렁이는 보라색 마력 포션
    ctx.beginPath();
    ctx.arc(0, -s * 3.2, s * 2.8, 0, Math.PI * 2);
    ctx.fillStyle = '#c084fc';
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-s * 0.8, -s * 4.0, s * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  ctx.restore();
}
