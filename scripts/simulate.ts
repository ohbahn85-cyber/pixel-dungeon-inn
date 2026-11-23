import * as fs from 'node:fs';
import * as path from 'node:path';
import { DUNGEON_ZONES, MATERIALS } from '../src/data';
import {
  advanceCalendarWeek,
  calculateGuestIncome,
  CALENDAR_WEEK_SEC,
  claimDungeonDefeatGold,
  claimDungeonReward,
  createDungeonRun,
  facilityUpgradeGold,
  GUEST_INCOME_INTERVAL_SEC,
  spinDungeonRewardMultiplier,
  stepDungeonCombat,
} from '../src/gameLogic';
import {
  getHeroCombatStats,
  rollAlchemyPotion,
  rollCookingDish,
  rollFacilityUpgrade,
  rollHeroRecruitCandidate,
  rollStaffHireCandidate,
  rollWeaponEnchant,
  rollWeaponEnhance,
  rollWeaponForge,
  setSlotRngSeed,
} from '../src/slotEngine';
import { createInitialSaveData } from '../src/storage';
import { FacilityId, GameSaveData, RankTier } from '../src/types';

const SEED = 20261123;
const MAX_SEC = 18000; // 5시간 (4구역 3–4시간 목표 측정용)
const GOLD_COST_HERO: Record<RankTier, number> = { C: 120, B: 260, A: 520, S: 980 };
const HIRE_COST: Record<RankTier, number> = { C: 100, B: 240, A: 500, S: 950 };

function hasMats(save: GameSaveData, id: string, n = 1): boolean {
  return (save.materials[id] || 0) >= n;
}
function takeMat(save: GameSaveData, id: string, n = 1): void {
  save.materials[id] = (save.materials[id] || 0) - n;
}
function cCount(save: GameSaveData, prefix: 'food' | 'ore' | 'herb'): number {
  return save.materials[`${prefix}_c`] || 0;
}

function farmZone(
  save: GameSaveData,
  zoneId: string,
  t: number
): { t: number; win: boolean; duration: number } {
  const start = t;
  t += 18; // 출정 준비·던전 입장 연출
  const run = createDungeonRun(save, zoneId);
  let guard = 0;
  while (run.status === 'fighting' && guard < 800) {
    t += 0.55;
    stepDungeonCombat(save, run, 0.55);
    guard++;
  }
  if (run.status === 'reward_slot') {
    spinDungeonRewardMultiplier(run);
    claimDungeonReward(save, run);
    return { t, win: true, duration: t - start };
  }
  claimDungeonDefeatGold(save, run);
  return { t, win: false, duration: t - start };
}

function bestFoodTier(save: GameSaveData): RankTier | null {
  for (const t of ['S', 'A', 'B', 'C'] as RankTier[]) {
    if ((save.materials[`food_${t.toLowerCase()}`] || 0) >= 1) return t;
  }
  return null;
}

function partyReadyFor(save: GameSaveData, zoneId: string, recLevel: number, recEnhance: number): boolean {
  const heroes = save.heroes.slice(0, 4);
  if (heroes.length === 0) return false;
  const maxLv = Math.max(...heroes.map((h) => h.level));
  const bestEnhance = Math.max(0, ...save.weapons.map((w) => w.enhanceCount));
  const clears = save.clearedDungeons;
  if (zoneId === 'dungeon_2') {
    if ((clears.dungeon_1 || 0) < 10) return false;
    if (maxLv < 5 || bestEnhance < 2) return false;
  }
  if (zoneId === 'dungeon_3') {
    if ((clears.dungeon_2 || 0) < 8 || maxLv < 12) return false;
    if (save.facilities.inn.level < 2 || bestEnhance < 4) return false;
  }
  if (zoneId === 'dungeon_4') {
    if ((clears.dungeon_3 || 0) < 10) return false;
    if (save.facilities.inn.level < 4) return false;
    if (maxLv < 20 || bestEnhance < 7) return false;
  }
  return maxLv >= recLevel * 0.65 && bestEnhance >= Math.max(0, recEnhance - 1);
}

function tryCook(save: GameSaveData): boolean {
  if (save.gold < 30 || !hasMats(save, 'food_c', 2)) return false;
  save.gold -= 30;
  takeMat(save, 'food_c');
  takeMat(save, 'food_c');
  const res = rollCookingDish(save, 'C', 'C');
  save.dishes.push(res.dish);
  if (res.isJackpot) save.totalJackpots++;
  save.totalSlotSpins++;
  // 출정 버프 자동 장착
  const h = save.heroes[0];
  if (h && !h.activeMeal) h.activeMeal = res.dish;
  return true;
}

function tryPotion(save: GameSaveData): boolean {
  if (save.gold < 30 || !hasMats(save, 'herb_c', 2)) return false;
  if (save.potions.length >= 6) return false;
  save.gold -= 30;
  takeMat(save, 'herb_c');
  takeMat(save, 'herb_c');
  const res = rollAlchemyPotion(save, 'C', 'C');
  save.potions.push(res.potion);
  if (res.isJackpot) save.totalJackpots++;
  save.totalSlotSpins++;
  for (const h of save.heroes) {
    if (!h.equippedPotionId) {
      h.equippedPotionId = res.potion.id;
      break;
    }
  }
  return true;
}

function tryForge(save: GameSaveData): boolean {
  if (save.gold < 50 || !hasMats(save, 'ore_c', 2)) return false;
  if (save.weapons.length >= 8) return false;
  save.gold -= 50;
  takeMat(save, 'ore_c');
  takeMat(save, 'ore_c');
  const types = ['sword', 'axe', 'bow', 'staff', 'dagger'] as const;
  const type = types[save.weapons.length % types.length];
  const res = rollWeaponForge(save, type, 'C', 'C');
  save.weapons.push(res.weapon);
  if (res.isJackpot) save.totalJackpots++;
  save.totalSlotSpins++;
  const need = save.heroes.find((h) => !h.weaponId);
  if (need) {
    need.weaponId = res.weapon.id;
    res.weapon.equippedHeroId = need.id;
  }
  return true;
}

function tryEnhance(save: GameSaveData): boolean {
  const wp = save.weapons.find((w) => !w.enhanceLocked && w.enhanceCount < 10);
  if (!wp || save.gold < 40 || !hasMats(save, 'ore_c')) return false;
  save.gold -= 40;
  takeMat(save, 'ore_c');
  const res = rollWeaponEnhance(save, wp, 'C');
  wp.enhanceCount = res.newEnhanceCount;
  wp.enhanceLocked = res.locked;
  save.totalSlotSpins++;
  return true;
}

function tryEnchant(save: GameSaveData): boolean {
  const wp = save.weapons.find((w) => w.enchants.length === 0 && w.enhanceCount >= 1);
  if (!wp || save.gold < 60 || !hasMats(save, 'ore_c')) return false;
  save.gold -= 60;
  takeMat(save, 'ore_c');
  const res = rollWeaponEnchant(save, wp, 'C');
  wp.enchants = res.enchants;
  if (res.isJackpot) save.totalJackpots++;
  save.totalSlotSpins++;
  return true;
}

function tryRecruit(save: GameSaveData): boolean {
  if (save.heroes.length >= 8) return false;
  const tier = bestFoodTier(save);
  if (!tier) return false;
  const cost = GOLD_COST_HERO[tier];
  if (save.gold < cost) return false;
  save.gold -= cost;
  takeMat(save, `food_${tier.toLowerCase()}`);
  const res = rollHeroRecruitCandidate(save, tier);
  save.heroes.push(res.hero);
  if (res.isJackpot) save.totalJackpots++;
  save.totalSlotSpins++;
  return true;
}

function tryUpgradeInn(save: GameSaveData): boolean {
  const facId: FacilityId = 'inn';
  const fac = save.facilities[facId];
  const cost = facilityUpgradeGold(fac.level);
  if (fac.level >= 8) return false;
  if (save.gold < cost || !hasMats(save, 'ore_c')) return false;
  save.gold -= cost;
  takeMat(save, 'ore_c');
  const res = rollFacilityUpgrade(save, facId, 'C');
  fac.level += res.greatLevelUp ? 2 : 1;
  fac.passives.push(res.passive);
  if (res.greatLevelUp) save.totalJackpots++;
  save.totalSlotSpins++;
  return true;
}

function tryHire(save: GameSaveData): boolean {
  const cost = HIRE_COST.C;
  if (save.gold < cost) return false;
  save.gold -= cost;
  const res = rollStaffHireCandidate(save, 'enhancer', 'C');
  if (res.candidate.bonusProb > save.staff.enhancer.bonusProb) {
    save.staff.enhancer = res.candidate;
  } else {
    save.scrap += res.scrapRefund;
  }
  if (res.isJackpot) save.totalJackpots++;
  save.totalSlotSpins++;
  return true;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}시간 ${m % 60}분 ${r}초`;
  }
  return `${m}분 ${r}초`;
}

function main(): void {
  setSlotRngSeed(SEED);
  const save = createInitialSaveData();
  let t = 0;
  let incomeTimer = 0;
  let weekTimer = 0;
  let guestGold = 0;
  const firstClear: Record<string, number | null> = {
    dungeon_1: null,
    dungeon_2: null,
    dungeon_3: null,
    dungeon_4: null,
  };
  let wins = 0;
  let fails = 0;
  let deadlock = 0;
  let lastProgressGold = save.gold;
  let stall = 0;

  while (t < MAX_SEC) {
    // 손님 수입 / 달력
    const dt = 0.5;
    incomeTimer += dt;
    weekTimer += dt;
    t += dt;
    if (incomeTimer >= GUEST_INCOME_INTERVAL_SEC) {
      incomeTimer = 0;
      const g = calculateGuestIncome(save);
      save.gold += g;
      guestGold += g;
    }
    if (weekTimer >= CALENDAR_WEEK_SEC) {
      weekTimer = 0;
      advanceCalendarWeek(save);
    }

    // 제작 루프 (재료·골드가 있을 때만)
    const slotActions = [
      tryCook(save),
      tryPotion(save),
      tryForge(save),
      tryEnhance(save),
      tryEnchant(save),
      save.gold > 400 && tryRecruit(save),
      save.gold > 900 && tryUpgradeInn(save),
      save.gold > 800 && tryHire(save),
    ].filter(Boolean).length;
    t += slotActions * 8; // 릴 연출·채택 시간

    // 출정: 가능한 가장 높은 구역, 아니면 1구역 파밍
    let zone = 'dungeon_1';
    for (const z of [...DUNGEON_ZONES].reverse()) {
      const recEnhance = z.id === 'dungeon_1' ? 0 : z.id === 'dungeon_2' ? 2 : z.id === 'dungeon_3' ? 4 : 7;
      if (partyReadyFor(save, z.id, z.recLevel, recEnhance)) {
        zone = z.id;
        break;
      }
    }
    // 골드/재료가 바닥이면 무조건 1구역
    if (save.gold < 80 || cCount(save, 'ore') + cCount(save, 'food') + cCount(save, 'herb') < 3) {
      zone = 'dungeon_1';
    }

    const beforeGold = save.gold;
    const result = farmZone(save, zone, t);
    t = result.t;
    if (result.win) {
      wins++;
      if (firstClear[zone] == null) firstClear[zone] = t;
    } else {
      fails++;
    }

    if (save.gold <= lastProgressGold && save.gold < 40) {
      stall += result.duration;
      if (stall > 180) {
        // 1구역은 항상 다시 갈 수 있음 — 강제 파밍
        if (save.gold < 20) save.gold += 20; // 비상 바닥 (교착 방지 최소 영업)
        deadlock++;
        stall = 0;
      }
    } else {
      stall = 0;
      lastProgressGold = Math.max(lastProgressGold, save.gold);
    }

    void beforeGold;
  }

  const report = {
    seed: SEED,
    simulatedDurationSec: Math.round(t),
    simulatedDurationText: fmt(t),
    finalGold: save.gold,
    scrap: save.scrap,
    heroes: save.heroes.length,
    innLevel: save.facilities.inn.level,
    weapons: save.weapons.length,
    maxEnhance: Math.max(0, ...save.weapons.map((w) => w.enhanceCount)),
    lockedWeapons: save.weapons.filter((w) => w.enhanceLocked).length,
    potionsCrafted: save.potions.length,
    slotSpins: save.totalSlotSpins,
    jackpots: save.totalJackpots,
    dungeonClears: save.clearedDungeons,
    firstClears: Object.fromEntries(
      Object.entries(firstClear).map(([k, v]) => [
        k,
        v == null ? null : { sec: Math.round(v), text: fmt(v) },
      ])
    ),
    wins,
    fails,
    guestGold,
    emergencyFloorHits: deadlock,
    materials: { ...save.materials },
  };

  const outPath = path.resolve('scripts/simulate-last.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('==============================================================');
  console.log('📊 [픽셀 던전 여관 v7: 슬롯 타이쿤 · 아이소 맵 5시간 시뮬]');
  console.log('==============================================================');
  console.log(`• 시드: ${SEED} | 시간: ${report.simulatedDurationText}`);
  console.log(
    `• 첫 클리어: 1구역 ${report.firstClears.dungeon_1?.text ?? '실패'} · 2구역 ${report.firstClears.dungeon_2?.text ?? '-'} · 3구역 ${report.firstClears.dungeon_3?.text ?? '-'} · 4구역 ${report.firstClears.dungeon_4?.text ?? '-'}`
  );
  console.log(
    `• 원정 승/패: ${wins}/${fails} | 보유 ${report.finalGold}G · 가루 ${report.scrap} · 영웅 ${report.heroes}명 · 여관 Lv.${report.innLevel}`
  );
  console.log(
    `• 슬롯 ${report.slotSpins}회 (잭팟 ${report.jackpots}) · 최고 강화 +${report.maxEnhance} · 잠금 ${report.lockedWeapons}자루 · 교착 비상금 ${deadlock}회`
  );
  console.log(`• 결과: ${outPath}`);
  console.log('==============================================================');
}

main();
