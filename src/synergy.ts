import {
  EQUIPMENT_DEF_MAP,
  HERO_CLASSES,
  HERO_ROSTER_MAP,
  ORIGINS,
  PERSONALITY_PAIRS,
  getEnhanceStatMultiplier,
} from './loopData';
import {
  ArmorSubType,
  DungeonDef,
  EquipSlot,
  EquipmentDef,
  EquipmentInstance,
  HeroClassId,
  HeroRole,
  HeroState,
  OffhandSubType,
  OriginId,
  StatBlock,
  WeaponSubType,
} from './types';

export function createEmptyStats(): StatBlock {
  return { atk: 0, def: 0, agi: 0, int: 0, hp: 0, luk: 0 };
}

/**
 * 특정 직업이 해당 장비를 착용할 수 있는지 판별합니다.
 */
export function canClassEquip(classId: HeroClassId, def: EquipmentDef): boolean {
  const cls = HERO_CLASSES[classId];
  if (!cls) return false;
  if (def.slot === 'accessory') return true;
  if (def.slot === 'weapon') {
    return cls.allowedWeapons.includes(def.subType as WeaponSubType);
  }
  if (def.slot === 'armor') {
    return cls.allowedArmors.includes(def.subType as ArmorSubType);
  }
  if (def.slot === 'offhand') {
    return cls.allowedOffhands.includes(def.subType as OffhandSubType);
  }
  return false;
}

/**
 * 장비를 착용 가능한 직업 이름 목록 문자열
 */
export function getWearableClassesText(def: EquipmentDef): string {
  if (def.slot === 'accessory') return '전 직업 공용';
  const names: string[] = [];
  for (const cls of Object.values(HERO_CLASSES)) {
    if (canClassEquip(cls.id, def)) {
      names.push(cls.name);
    }
  }
  return names.join(', ');
}

/**
 * 장비 인스턴스(원본 스탯 × +강화 배율)의 실제 스탯을 계산합니다.
 */
export function getEquipmentEffectiveStats(inst: EquipmentInstance): StatBlock {
  const def = EQUIPMENT_DEF_MAP[inst.defId];
  if (!def) return createEmptyStats();
  const mult = getEnhanceStatMultiplier(inst.enhanceLevel);
  return {
    atk: Math.round((def.stats.atk ?? 0) * mult),
    def: Math.round((def.stats.def ?? 0) * mult),
    agi: Math.round((def.stats.agi ?? 0) * mult),
    int: Math.round((def.stats.int ?? 0) * mult),
    hp: Math.round((def.stats.hp ?? 0) * mult),
    luk: Math.round((def.stats.luk ?? 0) * mult),
  };
}

/**
 * 장비 아이템의 종합 점수 (영웅 AI가 더 좋은 장비인지 비교할 때 사용)
 */
export function getEquipmentScoreForClass(
  classId: HeroClassId,
  inst: EquipmentInstance
): number {
  const def = EQUIPMENT_DEF_MAP[inst.defId];
  if (!def || !canClassEquip(classId, def)) return -1;
  const stats = getEquipmentEffectiveStats(inst);
  const cls = HERO_CLASSES[classId];
  // 직업 성장 가중치를 반영한 장비 가치 평가
  return (
    stats.atk * (1 + cls.growthPerLevel.atk * 0.15) +
    stats.def * (1 + cls.growthPerLevel.def * 0.15) +
    stats.agi * (1 + cls.growthPerLevel.agi * 0.15) +
    stats.int * (1 + cls.growthPerLevel.int * 0.15) +
    stats.hp * 0.28 +
    stats.luk * 0.9
  );
}

export interface HeroStatBreakdown {
  baseStats: StatBlock;
  equipStats: StatBlock;
  buffBonusStats: StatBlock;
  totalStats: StatBlock;
  combatPower: number;
}

/**
 * 영웅의 현재 스탯 상세(기본 성장 + 4슬롯 장비 + 출신 패시브 + 음식/포션 버프 + 부상 페널티)를 계산합니다.
 */
export function getHeroStatBreakdown(hero: HeroState): HeroStatBreakdown {
  const roster = HERO_ROSTER_MAP[hero.id];
  const cls = HERO_CLASSES[roster.classId];
  const origin = ORIGINS[roster.originId];

  const lv = Math.max(1, hero.level) - 1;
  const baseStats: StatBlock = {
    atk: cls.baseStats.atk + cls.growthPerLevel.atk * lv,
    def: cls.baseStats.def + cls.growthPerLevel.def * lv,
    agi: cls.baseStats.agi + cls.growthPerLevel.agi * lv,
    int: cls.baseStats.int + cls.growthPerLevel.int * lv,
    hp: cls.baseStats.hp + cls.growthPerLevel.hp * lv,
    luk: cls.baseStats.luk + cls.growthPerLevel.luk * lv,
  };

  const equipStats = createEmptyStats();
  const slots: EquipSlot[] = ['weapon', 'armor', 'offhand', 'accessory'];
  for (const s of slots) {
    const inst = hero.equipment[s];
    if (!inst) continue;
    const eqSt = getEquipmentEffectiveStats(inst);
    equipStats.atk += eqSt.atk;
    equipStats.def += eqSt.def;
    equipStats.agi += eqSt.agi;
    equipStats.int += eqSt.int;
    equipStats.hp += eqSt.hp;
    equipStats.luk += eqSt.luk;
  }

  // 출신 스탯 패시브 + 활성 버프 합산
  const pctMult: StatBlock = { atk: 0, def: 0, agi: 0, int: 0, hp: 0, luk: 0 };
  for (const k of ['atk', 'def', 'agi', 'int', 'hp', 'luk'] as const) {
    pctMult[k] += origin.statBonusPct[k] ?? 0;
  }
  for (const b of hero.buffs) {
    for (const k of ['atk', 'def', 'agi', 'int', 'hp', 'luk'] as const) {
      pctMult[k] += b.statBonusPct[k] ?? 0;
    }
  }

  // 부상/피로 상태면 스탯 소폭 감소
  const statusMult =
    hero.status === 'injured' ? 0.78 : hero.status === 'fatigued' ? 0.88 : 1.0;

  const buffBonusStats = createEmptyStats();
  const totalStats = createEmptyStats();

  for (const k of ['atk', 'def', 'agi', 'int', 'hp', 'luk'] as const) {
    const raw = baseStats[k] + equipStats[k];
    const withBuff = Math.round(raw * (1 + pctMult[k]) * statusMult);
    buffBonusStats[k] = withBuff - raw;
    totalStats[k] = Math.max(1, withBuff);
  }

  const combatPower = Math.round(
    totalStats.atk * 1.3 +
      totalStats.def * 1.3 +
      totalStats.agi * 1.15 +
      totalStats.int * 1.2 +
      totalStats.hp * 0.24 +
      totalStats.luk * 0.8
  );

  return {
    baseStats,
    equipStats,
    buffBonusStats,
    totalStats,
    combatPower,
  };
}

export interface PartySynergyPreview {
  heroIds: string[];
  heroNames: string[];
  rolesPresent: HeroRole[];
  roleSynergyTitle: string;
  roleSynergyBonus: number;
  roleWarnings: string[];
  personalityMatches: {
    title: string;
    isPositive: boolean;
    bonus: number;
    description: string;
  }[];
  personalityNetBonus: number;
  originPassives: {
    heroName: string;
    originName: string;
    icon: string;
    bonusText: string;
    successBonus: number;
  }[];
  originPassiveBonus: number;
  originSets: {
    title: string;
    count: number;
    bonus: number;
  }[];
  originSetBonus: number;
  classSetTitle: string | null;
  classSetBonus: number;
  buffSuccessBonus: number;
  partyStats: StatBlock;
  totalCombatPower: number;
  baseStatSuccessRate: number;
  totalSynergyDelta: number;
  finalSuccessRate: number;
  durationSec: number;
  goldMult: number;
  xpMult: number;
  lootChanceBonus: number;
  injuryRiskMult: number;
}

/**
 * 던전 파견 전 선택한 파티의 시너지(역할, 성격 궁합/충돌, 출신·직업 세트, 버프)와
 * 최종 예상 성공률을 계산합니다.
 */
export function evaluatePartyForDungeon(
  heroes: HeroState[],
  dungeon: DungeonDef
): PartySynergyPreview {
  if (heroes.length === 0) {
    return {
      heroIds: [],
      heroNames: [],
      rolesPresent: [],
      roleSynergyTitle: '파티원 없음',
      roleSynergyBonus: 0,
      roleWarnings: ['파티원을 1명 이상 선택해 주세요.'],
      personalityMatches: [],
      personalityNetBonus: 0,
      originPassives: [],
      originPassiveBonus: 0,
      originSets: [],
      originSetBonus: 0,
      classSetTitle: null,
      classSetBonus: 0,
      buffSuccessBonus: 0,
      partyStats: createEmptyStats(),
      totalCombatPower: 0,
      baseStatSuccessRate: 0,
      totalSynergyDelta: 0,
      finalSuccessRate: 0,
      durationSec: dungeon.durationSec,
      goldMult: 1,
      xpMult: 1,
      lootChanceBonus: 0,
      injuryRiskMult: 1,
    };
  }

  const partyStats = createEmptyStats();
  let totalCombatPower = 0;
  let buffSuccessBonus = 0;
  let xpMult = 1.0;
  let goldMult = 1.0;
  let lootChanceBonus = 0;
  let durationReduction = 0;
  let injuryRiskMult = 1.0;

  const rolesSet = new Set<HeroRole>();
  const classesSet = new Set<HeroClassId>();
  const originCounts: Partial<Record<OriginId, number>> = {};
  const originPassives: PartySynergyPreview['originPassives'] = [];

  for (const h of heroes) {
    const roster = HERO_ROSTER_MAP[h.id];
    const cls = HERO_CLASSES[roster.classId];
    const origin = ORIGINS[roster.originId];
    const bd = getHeroStatBreakdown(h);

    rolesSet.add(cls.role);
    classesSet.add(cls.id);
    originCounts[origin.id] = (originCounts[origin.id] ?? 0) + 1;

    partyStats.atk += bd.totalStats.atk;
    partyStats.def += bd.totalStats.def;
    partyStats.agi += bd.totalStats.agi;
    partyStats.int += bd.totalStats.int;
    partyStats.hp += bd.totalStats.hp;
    partyStats.luk += bd.totalStats.luk;
    totalCombatPower += bd.combatPower;

    for (const b of h.buffs) {
      buffSuccessBonus += b.successRateBonus;
      xpMult += b.xpMultBonus * 0.5;
      if (b.injuryImmune) {
        injuryRiskMult *= 0.4;
      }
    }

    goldMult += origin.goldBonusPct;
    lootChanceBonus += origin.lootChanceBonus;
    durationReduction += origin.durationReductionPct;

    const prefersDungeon = origin.preferredDungeonTags.includes(dungeon.tag);
    const sBonus = prefersDungeon ? origin.dungeonSuccessBonus : 0;
    originPassives.push({
      heroName: roster.name,
      originName: origin.name,
      icon: origin.icon,
      bonusText: prefersDungeon
        ? `${dungeon.name} 지형 숙련 (+${Math.round(sBonus * 100)}%) · ${origin.description}`
        : origin.description,
      successBonus: sBonus,
    });
  }

  // 버프 성공률 상한 보정
  buffSuccessBonus = Math.min(0.24, buffSuccessBonus);

  // 1. 역할 상호보완 (Role Synergy)
  const hasTank = rolesSet.has('tank');
  const hasHealer = rolesSet.has('healer');
  const hasDps = rolesSet.has('dps');
  const hasSupport = rolesSet.has('support');

  let roleSynergyTitle = '단독/일반 편성';
  let roleSynergyBonus = 0;
  const roleWarnings: string[] = [];

  if (hasTank && hasHealer && (hasDps || hasSupport)) {
    roleSynergyTitle = '🌟 완벽한 삼각 진형 (탱커+힐러+딜러)';
    roleSynergyBonus = 0.1;
    injuryRiskMult *= 0.7;
  } else if (hasTank && (hasDps || hasSupport) && hasSupport) {
    roleSynergyTitle = '⚡ 기동 타격 진형 (탱커+딜러+지원)';
    roleSynergyBonus = 0.07;
  } else if (
    (hasTank && hasDps) ||
    (hasTank && hasHealer) ||
    (hasHealer && hasDps) ||
    (hasSupport && (hasTank || hasDps || hasHealer))
  ) {
    roleSynergyTitle = '🛡️ 균형 잡힌 공수 협동 (2역할 보완)';
    roleSynergyBonus = 0.05;
  } else if (heroes.length >= 2) {
    roleSynergyTitle = '⚠️ 단일 역할 편중';
    roleSynergyBonus = -0.02;
  }

  if (!hasHealer && dungeon.tier >= 2) {
    const pen = dungeon.tier >= 4 ? -0.04 : -0.02;
    roleSynergyBonus += pen;
    injuryRiskMult *= 1.3;
    roleWarnings.push(
      `⚠️ 힐러(사제) 없음: 부상 위험 증가 및 유지력 약화 (${Math.round(pen * 100)}%)`
    );
  }
  if (!hasTank && dungeon.tier >= 2) {
    const pen = dungeon.tier >= 4 ? -0.04 : -0.02;
    roleSynergyBonus += pen;
    injuryRiskMult *= 1.25;
    roleWarnings.push(
      `⚠️ 탱커(전사·성기사·중갑병) 없음: 전열 방어 취약 (${Math.round(pen * 100)}%)`
    );
  }

  // 2. 성격 궁합 및 충돌 (Personality Compatibility Pairs)
  const personalityMatches: PartySynergyPreview['personalityMatches'] = [];
  let personalityNetBonus = 0;
  const triggeredRuleIds = new Set<string>();

  for (let i = 0; i < heroes.length; i++) {
    for (let j = i + 1; j < heroes.length; j++) {
      const rA = HERO_ROSTER_MAP[heroes[i].id];
      const rB = HERO_ROSTER_MAP[heroes[j].id];

      for (const rule of PERSONALITY_PAIRS) {
        if (triggeredRuleIds.has(rule.id)) continue;
        const matchForward =
          rA.personalities.includes(rule.a) && rB.personalities.includes(rule.b);
        const matchReverse =
          rA.personalities.includes(rule.b) && rB.personalities.includes(rule.a);

        if (matchForward || matchReverse) {
          triggeredRuleIds.add(rule.id);
          personalityMatches.push({
            title: `${rule.title} [${rA.name} & ${rB.name}]`,
            isPositive: rule.isPositive,
            bonus: rule.successRateBonus,
            description: rule.description,
          });
          personalityNetBonus += rule.successRateBonus;

          if (rule.statMultBonus) {
            if (rule.statMultBonus.atk) {
              partyStats.atk = Math.round(
                partyStats.atk * (1 + rule.statMultBonus.atk)
              );
            }
            if (rule.statMultBonus.def) {
              partyStats.def = Math.round(
                partyStats.def * (1 + rule.statMultBonus.def)
              );
            }
          }
          if (rule.extraGoldMult) goldMult += rule.extraGoldMult;
          if (rule.extraXpMult) xpMult += rule.extraXpMult;
          if (rule.injuryRiskDelta) {
            injuryRiskMult = Math.max(0.2, injuryRiskMult + rule.injuryRiskDelta);
          }
        }
      }
    }
  }

  // 3. 출신 패시브 및 동향 세트 시너지 (Origin Passives & 2+ Set Synergy)
  let originPassiveBonus = 0;
  for (const op of originPassives) {
    originPassiveBonus += op.successBonus;
  }
  originPassiveBonus = Math.min(0.16, originPassiveBonus);

  const originSets: PartySynergyPreview['originSets'] = [];
  let originSetBonus = 0;
  for (const [origId, count] of Object.entries(originCounts)) {
    if ((count ?? 0) >= 2) {
      const oDef = ORIGINS[origId as OriginId];
      originSets.push({
        title: oDef.setSynergyTitle,
        count: count ?? 2,
        bonus: oDef.setSynergySuccessBonus,
      });
      originSetBonus += oDef.setSynergySuccessBonus;
    }
  }

  // 4. 직업 구성 시너지 (Class Set Synergy)
  let classSetTitle: string | null = null;
  let classSetBonus = 0;
  if (heroes.length >= 3 && classesSet.size === heroes.length) {
    classSetTitle = '🎖️ 다재다능 원정대 (서로 다른 직업 3인+)';
    classSetBonus = 0.04;
  } else if (heroes.length >= 2 && classesSet.size === 1) {
    classSetTitle = '⚠️ 동일 직업 중복 편성';
    classSetBonus = -0.03;
  }

  // 5. 던전 요구 능력치 대비 가중 스탯 비율 계산
  let partyWeightedScore = 0;
  let reqWeightedScore = 0;
  for (const k of ['atk', 'def', 'agi', 'int', 'hp', 'luk'] as const) {
    const w = dungeon.statWeights[k];
    const req = Math.max(1, dungeon.requiredStats[k]);
    const have = partyStats[k];
    // 각 스탯이 요구치 대비 너무 부족하면 약점 노출, 충분하면 완만히 기여
    const statRatio = Math.min(1.65, have / req);
    partyWeightedScore += statRatio * req * w;
    reqWeightedScore += req * w;
  }

  const ratio = reqWeightedScore > 0 ? partyWeightedScore / reqWeightedScore : 1;
  // 시그모이드/완만 곡선: ratio === 1.0 일 때 기본 성공률 약 68%, ratio === 1.25 일 때 약 80%, ratio === 0.7 일 때 약 44%
  const rawBaseRate = 1 / (1 + Math.exp(-3.1 * (ratio - 0.76)));
  const baseStatSuccessRate = Math.max(0.06, Math.min(0.88, rawBaseRate));

  const totalSynergyDelta =
    roleSynergyBonus +
    personalityNetBonus +
    originPassiveBonus +
    originSetBonus +
    classSetBonus;

  // 최종 성공률: 하한 8% ~ 상한 95% 클램프
  const finalSuccessRate = Math.max(
    0.08,
    Math.min(0.95, baseStatSuccessRate + totalSynergyDelta + buffSuccessBonus)
  );

  const clampedDurationRed = Math.min(0.3, durationReduction);
  const durationSec = Math.max(
    6,
    Math.round(dungeon.durationSec * (1 - clampedDurationRed))
  );

  return {
    heroIds: heroes.map((h) => h.id),
    heroNames: heroes.map((h) => HERO_ROSTER_MAP[h.id].name),
    rolesPresent: Array.from(rolesSet),
    roleSynergyTitle,
    roleSynergyBonus,
    roleWarnings,
    personalityMatches,
    personalityNetBonus,
    originPassives,
    originPassiveBonus,
    originSets,
    originSetBonus,
    classSetTitle,
    classSetBonus,
    buffSuccessBonus,
    partyStats,
    totalCombatPower,
    baseStatSuccessRate,
    totalSynergyDelta,
    finalSuccessRate,
    durationSec,
    goldMult,
    xpMult,
    lootChanceBonus,
    injuryRiskMult,
  };
}

/**
 * 대기 중인 가용 영웅들 중에서 해당 던전에 가장 시너지와 성공률이 높은 파티(탱+힐+딜 우선)를 탐색합니다.
 */
export function selectBestPartyForDungeon(
  availableHeroes: HeroState[],
  dungeon: DungeonDef,
  maxPartySize = 3
): HeroState[] {
  const ready = availableHeroes.filter(
    (h) => h.unlocked && h.status === 'idle' && !h.expeditionId
  );
  if (ready.length === 0) return [];
  if (ready.length <= maxPartySize) {
    return ready;
  }

  // 상위 전투력/적합도 영웅 최대 10명을 후보로 조합 탐색 (C(10,3) = 120개로 매우 빠름)
  const scoredCandidates = ready
    .map((h) => {
      const bd = getHeroStatBreakdown(h);
      const roster = HERO_ROSTER_MAP[h.id];
      const origin = ORIGINS[roster.originId];
      let fitScore = 0;
      for (const k of ['atk', 'def', 'agi', 'int', 'hp', 'luk'] as const) {
        fitScore += bd.totalStats[k] * dungeon.statWeights[k];
      }
      if (origin.preferredDungeonTags.includes(dungeon.tag)) {
        fitScore *= 1.18;
      }
      return { hero: h, role: HERO_CLASSES[roster.classId].role, fitScore };
    })
    .sort((a, b) => b.fitScore - a.fitScore);

  // 각 역할(tank, healer, dps, support) 최소 2~3명씩 포함되도록 후보 풀(최대 10명) 구성
  const pool: HeroState[] = [];
  const usedIds = new Set<string>();
  for (const role of ['tank', 'healer', 'dps', 'support'] as const) {
    for (const item of scoredCandidates) {
      if (item.role === role && !usedIds.has(item.hero.id)) {
        pool.push(item.hero);
        usedIds.add(item.hero.id);
        if (pool.filter((p) => HERO_CLASSES[HERO_ROSTER_MAP[p.id].classId].role === role).length >= 3) {
          break;
        }
      }
    }
  }
  for (const item of scoredCandidates) {
    if (pool.length >= 10) break;
    if (!usedIds.has(item.hero.id)) {
      pool.push(item.hero);
      usedIds.add(item.hero.id);
    }
  }

  let bestParty: HeroState[] = pool.slice(0, maxPartySize);
  let bestScore = -999;

  const size = Math.min(maxPartySize, pool.length);
  if (size === 3) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        for (let k = j + 1; k < pool.length; k++) {
          const combo = [pool[i], pool[j], pool[k]];
          const ev = evaluatePartyForDungeon(combo, dungeon);
          const score =
            ev.finalSuccessRate * 100 +
            ev.totalSynergyDelta * 40 +
            ev.goldMult * 3 +
            ev.lootChanceBonus * 5;
          if (score > bestScore) {
            bestScore = score;
            bestParty = combo;
          }
        }
      }
    }
  } else if (size === 2) {
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const combo = [pool[i], pool[j]];
        const ev = evaluatePartyForDungeon(combo, dungeon);
        const score = ev.finalSuccessRate * 100 + ev.totalSynergyDelta * 40;
        if (score > bestScore) {
          bestScore = score;
          bestParty = combo;
        }
      }
    }
  }

  return bestParty;
}
