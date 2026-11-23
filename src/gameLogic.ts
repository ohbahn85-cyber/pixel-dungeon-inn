import {
  DUNGEON_ZONES,
  HERO_TIER_GROWTH_MULT,
  MATERIALS,
} from './data';
import {
  getEffectiveHeroLevelCap,
  getHeroCombatStats,
  slotRandom,
} from './slotEngine';
import {
  ActiveDungeonRun,
  GameSaveData,
  RankTier,
} from './types';

export const CALENDAR_WEEK_SEC = 7.0;
export const GUEST_INCOME_INTERVAL_SEC = 7.0;
export const COMBAT_SWING_SEC = 1.35;
export const COMBAT_SLOT_SEC = 2.4;

/** 웨이브당 경험치. 구역이 올라도 완만하게만 늘어 상위 구역이 너무 빨리 열리지 않게 함. */
export function waveExpForZone(recLevel: number): number {
  if (recLevel <= 2) return 6;
  if (recLevel <= 8) return 11;
  if (recLevel <= 16) return 15;
  return 20;
}

export function monsterMaxHpFor(recLevel: number, isBoss: boolean): number {
  return Math.round((recLevel * 100 + 160) * (isBoss ? 2.1 : 1.0));
}

export function facilityUpgradeGold(level: number): number {
  return level * 360;
}
export const SCRAP_EXCHANGE_COSTS: Record<RankTier, number> = {
  C: 8,
  B: 20,
  A: 45,
  S: 95,
};

export function advanceCalendarWeek(save: GameSaveData): void {
  save.week++;
  if (save.week > 4) {
    save.week = 1;
    save.month++;
    if (save.month > 12) {
      save.month = 1;
      save.year++;
    }
  }
}

export function calculateGuestIncome(save: GameSaveData): number {
  const innLv = save.facilities.inn.level;
  const tradeLv = save.facilities.trade.level;
  const passiveGoldPct = Object.values(save.facilities)
    .flatMap((f) => f.passives)
    .filter((p) => p.bonusType === 'gold_income')
    .reduce((acc, p) => acc + p.value, 0);

  return Math.round(
    (8 + innLv * 6 + tradeLv * 4 + save.heroes.length * 3) *
      (1 + passiveGoldPct / 100)
  );
}

export function calculateFinalScrap(
  save: GameSaveData,
  baseScrapRefund: number
): number {
  const scrapBonusPct = save.facilities.trade.passives
    .filter((p) => p.bonusType === 'scrap_bonus')
    .reduce((acc, p) => acc + p.value, 0);
  return Math.round(baseScrapRefund * (1 + scrapBonusPct / 100));
}

export function grantPartyExp(
  save: GameSaveData,
  partyIds: string[],
  expGain: number
): { heroId: string; newLevel: number }[] {
  const leveledUp: { heroId: string; newLevel: number }[] = [];
  for (const hid of partyIds) {
    const hero = save.heroes.find((h) => h.id === hid);
    if (!hero) continue;
    const cap = getEffectiveHeroLevelCap(save, hero);
    if (hero.level >= cap) continue;

    hero.exp += expGain;
    while (hero.level < cap && hero.exp >= hero.level * 50) {
      const needed = hero.level * 50;
      hero.exp -= needed;
      hero.level++;
      const gMult = HERO_TIER_GROWTH_MULT[hero.tier];
      hero.baseHp += Math.round(16 * gMult);
      hero.baseAtk += Math.round(3.5 * gMult);
      hero.baseDef += Math.round(1.5 * gMult);
      const st = getHeroCombatStats(save, hero);
      hero.currentHp = st.maxHp;
      leveledUp.push({ heroId: hero.id, newLevel: hero.level });
    }
  }
  return leveledUp;
}

export function consumeOneTimeMeals(
  save: GameSaveData,
  partyIds: string[]
): void {
  for (const hid of partyIds) {
    const hero = save.heroes.find((h) => h.id === hid);
    if (hero) {
      hero.activeMeal = null;
      const st = getHeroCombatStats(save, hero);
      hero.currentHp = st.maxHp;
    }
  }
}

export function createDungeonRun(
  save: GameSaveData,
  zoneId: string
): ActiveDungeonRun {
  const zone =
    DUNGEON_ZONES.find((z) => z.id === zoneId) || DUNGEON_ZONES[0];
  const party = save.heroes.slice(0, 4);
  for (const h of party) {
    const st = getHeroCombatStats(save, h);
    h.currentHp = st.maxHp;
  }

  const baseHp = monsterMaxHpFor(zone.recLevel, false);
  return {
    zoneId: zone.id,
    partyIds: party.map((h) => h.id),
    wave: 1,
    maxWaves: 3,
    waveTimer: 0,
    slotSpinTimer: 0,
    currentSlotSymbols: ['crit', 'heal', 'seven'],
    lastSlotEffect: 'READY',
    monsterHp: baseHp,
    monsterMaxHp: baseHp,
    monsterName: zone.monsterNames[0],
    isBoss: false,
    accumulatedGold: 0,
    accumulatedDrops: [],
    status: 'fighting',
    rewardMultiplier: 1,
    rewardSpun: false,
    combatLogs: [`${zone.name}`],
  };
}

export function triggerDungeonCombatSlot(
  save: GameSaveData,
  run: ActiveDungeonRun
): 'crit' | 'heal' | 'gold' | 'jackpot' {
  const outcomes: {
    syms: [string, string, string];
    label: string;
    type: 'crit' | 'heal' | 'gold' | 'jackpot';
  }[] = [
    { syms: ['crit', 'crit', 'spark'], label: '강타', type: 'crit' },
    { syms: ['flask', 'heal', 'flask'], label: '치유', type: 'heal' },
    { syms: ['coin', 'coin', 'chest'], label: '보물', type: 'gold' },
    { syms: ['seven', 'seven', 'seven'], label: '777', type: 'jackpot' },
  ];
  const r = slotRandom();
  const pick =
    r < 0.16
      ? outcomes[3]
      : r < 0.45
      ? outcomes[0]
      : r < 0.72
      ? outcomes[1]
      : outcomes[2];

  run.currentSlotSymbols = pick.syms;
  run.lastSlotEffect = pick.label;

  if (pick.type === 'crit') {
    const bonusDmg = Math.round(run.monsterMaxHp * 0.22);
    run.monsterHp = Math.max(1, run.monsterHp - bonusDmg);
  } else if (pick.type === 'heal') {
    for (const hid of run.partyIds) {
      const h = save.heroes.find((hero) => hero.id === hid);
      if (!h) continue;
      const st = getHeroCombatStats(save, h);
      h.currentHp = Math.min(st.maxHp, h.currentHp + Math.round(st.maxHp * 0.2));
    }
  } else if (pick.type === 'gold') {
    run.accumulatedGold += 65;
  } else if (pick.type === 'jackpot') {
    const nuke = Math.round(run.monsterMaxHp * 0.45);
    run.monsterHp = Math.max(1, run.monsterHp - nuke);
  }

  return pick.type;
}

export interface CombatTickOutcome {
  slotTriggered: boolean;
  slotType?: 'crit' | 'heal' | 'gold' | 'jackpot';
  waveCleared: boolean;
  statusChanged?: 'reward_slot' | 'defeat';
  leveledUpHeroes: { heroId: string; newLevel: number }[];
  potionsUsed: number;
  damageToMonster?: number;
  heroHits?: { heroId: string; heroIndex: number; damage: number }[];
  heals?: { heroId: string; heroIndex: number; amount: number }[];
}

export function stepDungeonCombat(
  save: GameSaveData,
  run: ActiveDungeonRun,
  dt: number
): CombatTickOutcome {
  const result: CombatTickOutcome = {
    slotTriggered: false,
    waveCleared: false,
    leveledUpHeroes: [],
    potionsUsed: 0,
  };

  if (run.status !== 'fighting') return result;

  run.waveTimer += dt;
  run.slotSpinTimer += dt;

  // 전투 미니슬롯 회전
  if (run.slotSpinTimer >= COMBAT_SLOT_SEC) {
    run.slotSpinTimer -= COMBAT_SLOT_SEC;
    result.slotTriggered = true;
    result.slotType = triggerDungeonCombatSlot(save, run);
  }

  // 파티 기본 공방 교전
  if (run.waveTimer >= COMBAT_SWING_SEC) {
    run.waveTimer -= COMBAT_SWING_SEC;
    const zone =
      DUNGEON_ZONES.find((z) => z.id === run.zoneId) || DUNGEON_ZONES[0];

    let partyAtk = 0;
    let partyAlive = 0;
    for (const hid of run.partyIds) {
      const hero = save.heroes.find((h) => h.id === hid);
      if (!hero || hero.currentHp <= 0) continue;
      partyAlive++;
      const st = getHeroCombatStats(save, hero);
      partyAtk += st.atk;

      // 체력 45% 미만 시 장착 포션 자동 사용
      if (hero.currentHp < st.maxHp * 0.45 && hero.equippedPotionId) {
        const potIdx = save.potions.findIndex(
          (p) => p.id === hero.equippedPotionId
        );
        if (potIdx >= 0) {
          const pot = save.potions[potIdx];
          const healAmt = Math.round(st.maxHp * (pot.healPct / 100));
          hero.currentHp = Math.min(st.maxHp, hero.currentHp + healAmt);
          partyAtk = Math.round(partyAtk * (1 + pot.atkBuffPct / 100));
          run.combatLogs.unshift(`${hero.name} +${healAmt}`);
          save.potions.splice(potIdx, 1);
          hero.equippedPotionId = null;
          result.potionsUsed++;
          result.heals = result.heals || [];
          result.heals.push({
            heroId: hero.id,
            heroIndex: run.partyIds.indexOf(hid),
            amount: healAmt,
          });
        }
      }
    }

    if (partyAlive === 0) {
      run.status = 'defeat';
      consumeOneTimeMeals(save, run.partyIds);
      result.statusChanged = 'defeat';
      return result;
    }

    // 몬스터 타격
    const dmgToMonster = Math.max(
      8,
      Math.round(partyAtk * (0.9 + slotRandom() * 0.25))
    );
    run.monsterHp = Math.max(0, run.monsterHp - dmgToMonster);
    result.damageToMonster = dmgToMonster;

    if (run.monsterHp > 0) {
      // 몬스터 반격
      const monsterAtk =
        (zone.recLevel * 11 + 16) * (run.isBoss ? 1.4 : 1.0);
      result.heroHits = [];
      run.partyIds.forEach((hid, heroIndex) => {
        const hero = save.heroes.find((h) => h.id === hid);
        if (!hero || hero.currentHp <= 0) return;
        const st = getHeroCombatStats(save, hero);
        const hit = Math.max(
          3,
          Math.round((monsterAtk - st.def * 0.6) / Math.max(1, partyAlive))
        );
        hero.currentHp = Math.max(0, hero.currentHp - hit);
        result.heroHits!.push({ heroId: hero.id, heroIndex, damage: hit });
      });

      // 반격 직후 전원 쓰러졌는지 확인
      const stillAlive = run.partyIds.some((hid) => {
        const h = save.heroes.find((hero) => hero.id === hid);
        return h && h.currentHp > 0;
      });
      if (!stillAlive) {
        run.status = 'defeat';
        consumeOneTimeMeals(save, run.partyIds);
        result.statusChanged = 'defeat';
        return result;
      }
    } else {
      // 웨이브 격파
      result.waveCleared = true;
      const goldDrop = Math.round(
        (zone.baseGoldReward / run.maxWaves) * (run.isBoss ? 1.8 : 1.0)
      );
      run.accumulatedGold += goldDrop;

      const dropMats = MATERIALS.filter(
        (m) =>
          m.tier === zone.dropTier || (m.tier === 'C' && slotRandom() < 0.4)
      );
      const pickedMat =
        dropMats[Math.floor(slotRandom() * dropMats.length)] || MATERIALS[0];
      const existingDrop = run.accumulatedDrops.find(
        (d) => d.materialId === pickedMat.id
      );
      if (existingDrop) existingDrop.count += 1;
      else run.accumulatedDrops.push({ materialId: pickedMat.id, count: 1 });

      run.combatLogs.unshift(`+${goldDrop}G`);

      result.leveledUpHeroes = grantPartyExp(
        save,
        run.partyIds,
        waveExpForZone(zone.recLevel)
      );

      if (run.wave >= run.maxWaves) {
        run.status = 'reward_slot';
        consumeOneTimeMeals(save, run.partyIds);
        result.statusChanged = 'reward_slot';
      } else {
        run.wave++;
        run.isBoss = run.wave === run.maxWaves;
        run.monsterName = run.isBoss
          ? zone.bossName
          : zone.monsterNames[run.wave % zone.monsterNames.length];
        run.monsterMaxHp = monsterMaxHpFor(zone.recLevel, run.isBoss);
        run.monsterHp = run.monsterMaxHp;
      }
    }
  }

  return result;
}

export function spinDungeonRewardMultiplier(run: ActiveDungeonRun): number {
  const mults = [1.5, 2, 2, 3];
  const pick = mults[Math.floor(slotRandom() * mults.length)];
  run.rewardMultiplier = pick;
  run.rewardSpun = true;
  return pick;
}

export function claimDungeonReward(
  save: GameSaveData,
  run: ActiveDungeonRun
): { finalGold: number; totalItems: number } {
  const finalGold = Math.round(run.accumulatedGold * run.rewardMultiplier);
  save.gold += finalGold;
  let totalItems = 0;
  for (const d of run.accumulatedDrops) {
    const cnt = Math.round(d.count * run.rewardMultiplier);
    save.materials[d.materialId] = (save.materials[d.materialId] || 0) + cnt;
    totalItems += cnt;
  }
  save.clearedDungeons[run.zoneId] =
    (save.clearedDungeons[run.zoneId] || 0) + 1;
  return { finalGold, totalItems };
}

export function claimDungeonDefeatGold(
  save: GameSaveData,
  run: ActiveDungeonRun
): number {
  const halfGold = Math.round(run.accumulatedGold * 0.5);
  save.gold += halfGold;
  return halfGold;
}
