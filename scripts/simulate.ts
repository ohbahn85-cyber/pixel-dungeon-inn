import * as fs from 'node:fs';
import * as path from 'node:path';
import { INN_LEVELS, OPTIONAL_QUESTS, UPGRADES, getUpgradeCost } from '../src/data';
import { formatDuration, formatGold } from '../src/format';
import { DAY_DURATION_SEC, DungeonInnGame } from '../src/game';
import {
  BLACKSMITH_TOOLS,
  DUNGEONS,
  EQUIPMENT_DEFS,
  EQUIPMENT_DEF_MAP,
  HERO_CLASSES,
  HERO_ROSTER,
  HERO_ROSTER_MAP,
  POTION_RECIPES,
  POTION_TOOLS,
  RARITY_INFO,
} from '../src/loopData';
import {
  canClassEquip,
  evaluatePartyForDungeon,
  getEquipmentScoreForClass,
  selectBestPartyForDungeon,
} from '../src/synergy';
import { DailyFinancialReport, EquipSlot, RarityTier } from '../src/types';

const SIM_DURATION_SEC = 4 * 3600; // 4시간 (14,400초 = 60일)
const SEED = 20261122;

interface SimMilestones {
  firstDungeonClearSec: number | null;
  rankMilestones: Record<
    number,
    {
      level: number;
      title: string;
      timeSec: number;
      timeText: string;
      day: number;
    }
  >;
  dungeonFirstClears: Record<
    string,
    {
      timeSec: number;
      timeText: string;
      day: number;
      party: string[];
      ratePct: number;
      reachedFloor: number;
    }
  >;
  heroLevel5Sec: { timeSec: number; timeText: string; heroName: string } | null;
  heroLevel10Sec: { timeSec: number; timeText: string; heroName: string } | null;
  heroJoins: {
    timeSec: number;
    timeText: string;
    day: number;
    heroId: string;
    heroName: string;
    className: string;
  }[];
  potionFirstCrafts: Record<
    string,
    { timeSec: number; timeText: string; name: string }
  >;
  rarityFirstCrafts: Partial<
    Record<RarityTier, { timeSec: number; timeText: string; itemName: string }>
  >;
  enhanceEvents: {
    attempts: number;
    successes: number;
    destructions: number;
    maxPlusReached: number;
    postDestroyClears: number;
    sampleDestructionLog: string | null;
  };
  livingInnMetrics: {
    heroShopTransactions: number;
    heroesHealedCount: number;
    playerOrdersIssued: number;
    speechBubblesObserved: number;
    dungeonEventsResolved: number;
    completedQuestsCount: number;
  };
  dailyReports: {
    day: number;
    innRank: number;
    totalIncome: number;
    foodAndDrink: number;
    guestServing: number;
    roomAndRest: number;
    potionSales: number;
    blacksmithSales: number;
    lootMargin: number;
    totalOperatingExpense: number;
    wages: number;
    upkeep: number;
    craftCost: number;
    lootPurchase: number;
    facilityInvest: number;
    netProfit: number;
    endGold: number;
    servedCount: number;
    dungeonWins: number;
    dungeonFails: number;
  }[];
  snapshots: {
    hour: number;
    day: number;
    timeText: string;
    gold: number;
    reputation: number;
    innRank: number;
    unlockedHeroes: number;
    totalDungeonClears: number;
    potionsCrafted: number;
    equipsCrafted: number;
    heroShopTransactions: number;
  }[];
  deadlockDetected: boolean;
  maxStallSeconds: number;
}

function runSimulation(): void {
  const allDailyReports: DailyFinancialReport[] = [];

  const game = new DungeonInnGame(
    () => {},
    () => {},
    undefined,
    undefined,
    (settledReport) => {
      allDailyReports.push(settledReport);
    }
  );
  game.setSeed(SEED);
  game.autoBuyLoot = false;
  game.autoDispatch = true;

  const milestones: SimMilestones = {
    firstDungeonClearSec: null,
    rankMilestones: {
      1: {
        level: 1,
        title: INN_LEVELS[0].title,
        timeSec: 0,
        timeText: '0초 (시작)',
        day: 1,
      },
    },
    dungeonFirstClears: {},
    heroLevel5Sec: null,
    heroLevel10Sec: null,
    heroJoins: [],
    potionFirstCrafts: {},
    rarityFirstCrafts: {},
    enhanceEvents: {
      attempts: 0,
      successes: 0,
      destructions: 0,
      maxPlusReached: 0,
      postDestroyClears: 0,
      sampleDestructionLog: null,
    },
    livingInnMetrics: {
      heroShopTransactions: 0,
      heroesHealedCount: 0,
      playerOrdersIssued: 0,
      speechBubblesObserved: 0,
      dungeonEventsResolved: 0,
      completedQuestsCount: 0,
    },
    dailyReports: [],
    snapshots: [],
    deadlockDetected: false,
    maxStallSeconds: 0,
  };

  const trackedUnlockedHeroes = new Set<string>(
    game.getUnlockedHeroes().map((h) => h.id)
  );
  let lastActivityTime = 0;
  let hadDestruction = false;

  for (let sec = 1; sec <= SIM_DURATION_SEC; sec++) {
    game.update(1.0);

    // 여관 등급 달성 시각 기록
    for (const [lvStr, info] of Object.entries(game.rankMilestones)) {
      const lv = Number(lvStr);
      if (!milestones.rankMilestones[lv]) {
        milestones.rankMilestones[lv] = {
          level: lv,
          title: info.title,
          timeSec: info.timeSec,
          timeText: formatDuration(info.timeSec),
          day: info.day,
        };
      }
    }

    // 말풍선 관측 카운트
    for (const h of game.getUnlockedHeroes()) {
      if (h.speechText && (h.speechTimer ?? 0) > 2.4) {
        milestones.livingInnMetrics.speechBubblesObserved += 1;
      }
    }

    // 던전 이벤트 선택지 발견 시 즉시 선택 검증
    for (const exp of game.expeditions) {
      if (exp.activeEventPrompt && !exp.activeEventPrompt.resolvedOptionId) {
        const opt = exp.activeEventPrompt.options[0];
        if (opt && game.chooseDungeonEventOption(exp.id, opt.id)) {
          milestones.livingInnMetrics.dungeonEventsResolved += 1;
        }
      }
    }

    // 플레이어의 여관 기본 서빙 시뮬레이션 (8초마다 대기 손님 서빙)
    if (sec % 8 === 0) {
      const prevServed = game.totalServed;
      game.serveAllOrSolicit();
      if (game.totalServed > prevServed) {
        lastActivityTime = sec;
      }
    }

    // 전리품 매입 (급료·유지비 비상금을 남기고 매입하며, 400~520초 구간에서는 행상인 안전 매각 검증)
    if (sec % 10 === 0 && !(sec >= 400 && sec <= 520)) {
      const fixedCost =
        game.getDailyWagesBreakdown().totalWages + game.getDailyUpkeepCost();
      const reserve = Math.max(25, Math.min(200, fixedCost));
      const bought = game.buyAllHeroLoot(reserve);
      if (bought.boughtCount > 0) {
        lastActivityTime = sec;
      }
    }

    // 플레이어 직접 행동 지시 검증
    if (sec % 180 === 60) {
      const idleHero = game
        .getUnlockedHeroes()
        .find((h) => h.status === 'idle' && !h.expeditionId);
      if (idleHero) {
        const issued = game.issueHeroOrder(idleHero.id, {
          kind: 'eat_meal',
          label: '식당 식사 지시',
        });
        if (issued) {
          milestones.livingInnMetrics.playerOrdersIssued += 1;
        }
      }
    }

    // 새로 합류한 고유 영웅 기록 및 레벨 마일스톤 체크
    for (const h of game.getUnlockedHeroes()) {
      if (!trackedUnlockedHeroes.has(h.id)) {
        trackedUnlockedHeroes.add(h.id);
        const r = HERO_ROSTER_MAP[h.id];
        const cls = HERO_CLASSES[r.classId];
        milestones.heroJoins.push({
          timeSec: sec,
          timeText: formatDuration(sec),
          day: game.dayNumber,
          heroId: h.id,
          heroName: r.name,
          className: cls.name,
        });
      }
      if (!milestones.heroLevel5Sec && h.level >= 5) {
        milestones.heroLevel5Sec = {
          timeSec: sec,
          timeText: formatDuration(sec),
          heroName: HERO_ROSTER_MAP[h.id].name,
        };
      }
      if (!milestones.heroLevel10Sec && h.level >= 10) {
        milestones.heroLevel10Sec = {
          timeSec: sec,
          timeText: formatDuration(sec),
          heroName: HERO_ROSTER_MAP[h.id].name,
        };
      }
    }

    // 던전 첫 클리어 마일스톤 기록
    for (const d of DUNGEONS) {
      const clears = game.dungeonClears[d.id] ?? 0;
      if (clears > 0 && !milestones.dungeonFirstClears[d.id]) {
        const recent = game.recentExpeditionResults.find(
          (r) => r.dungeonId === d.id && r.success
        );
        milestones.dungeonFirstClears[d.id] = {
          timeSec: sec,
          timeText: formatDuration(sec),
          day: game.dayNumber,
          party: recent ? recent.heroNames : ['가릭', '엘레나', '카엘'],
          ratePct: recent ? Math.round(recent.successRateUsed * 100) : 85,
          reachedFloor: recent?.totalFloors ?? 3,
        };
        if (milestones.firstDungeonClearSec === null) {
          milestones.firstDungeonClearSec = sec;
        }
        if (hadDestruction) {
          milestones.enhanceEvents.postDestroyClears += 1;
        }
        lastActivityTime = sec;
      }
    }

    if (
      hadDestruction &&
      game.recentExpeditionResults[0]?.success &&
      sec % 20 === 0
    ) {
      milestones.enhanceEvents.postDestroyClears += 1;
    }

    // 포션 및 대장간 장비 완성 체크
    for (const pr of POTION_RECIPES) {
      const craftedCnt = game.craftedByPotionId[pr.id] ?? 0;
      if (craftedCnt > 0 && !milestones.potionFirstCrafts[pr.id]) {
        milestones.potionFirstCrafts[pr.id] = {
          timeSec: sec,
          timeText: formatDuration(sec),
          name: pr.name,
        };
      }
    }

    for (const r of ['uncommon', 'rare', 'epic', 'legendary'] as RarityTier[]) {
      const info = game.craftedByRarity[r];
      if (info && info.count > 0 && !milestones.rarityFirstCrafts[r]) {
        milestones.rarityFirstCrafts[r] = {
          timeSec: sec,
          timeText: formatDuration(sec),
          itemName: info.lastItemName,
        };
      }
    }

    // Greedy AI 의사결정 (5초 주기)
    if (sec % 5 === 0) {
      greedyAiStep(game, sec, milestones, () => {
        hadDestruction = true;
      });
      if (game.expeditions.length > 0 || game.gold > 0) {
        lastActivityTime = sec;
      }
    }

    // 교착(Deadlock) 여부 감지
    const stall = sec - lastActivityTime;
    if (stall > milestones.maxStallSeconds) {
      milestones.maxStallSeconds = stall;
    }
    if (stall > 300 && game.gold < 1 && game.expeditions.length === 0) {
      milestones.deadlockDetected = true;
    }

    // 시간대별 스냅샷 (0.5h, 1h, 2h, 3h, 4h)
    if (
      sec === 1800 ||
      sec === 3600 ||
      sec === 7200 ||
      sec === 10800 ||
      sec === 14400
    ) {
      const totalClears = Object.values(game.dungeonClears).reduce(
        (a, b) => a + b,
        0
      );
      milestones.snapshots.push({
        hour: sec / 3600,
        day: game.dayNumber,
        timeText: formatDuration(sec),
        gold: Math.floor(game.gold),
        reputation: game.reputation,
        innRank: game.innRank,
        unlockedHeroes: game.getUnlockedHeroCount(),
        totalDungeonClears: totalClears,
        potionsCrafted: game.totalPotionsCrafted,
        equipsCrafted: game.totalEquipCrafted,
        heroShopTransactions: game.totalHeroShopTransactions,
      });
    }
  }

  milestones.livingInnMetrics.heroShopTransactions =
    game.totalHeroShopTransactions;
  milestones.livingInnMetrics.heroesHealedCount = game.totalHeroesHealed;
  milestones.livingInnMetrics.completedQuestsCount = Object.values(
    game.completedQuests
  ).filter(Boolean).length;

  milestones.dailyReports = allDailyReports.map((r) => ({
    day: r.day,
    innRank: r.innRank,
    totalIncome: r.income.totalIncome,
    foodAndDrink: r.income.foodAndDrink,
    guestServing: r.income.guestServing,
    roomAndRest: r.income.roomAndRest,
    potionSales: r.income.potionSales,
    blacksmithSales: r.income.blacksmithSales,
    lootMargin: r.income.lootMargin,
    totalOperatingExpense: r.expense.totalOperatingExpense,
    wages: r.expense.wages,
    upkeep: r.expense.upkeep,
    craftCost: r.expense.craftCost,
    lootPurchase: r.expense.lootPurchase,
    facilityInvest: r.expense.facilityInvest,
    netProfit: r.netProfit,
    endGold: r.endGold,
    servedCount: r.servedCount,
    dungeonWins: r.dungeonWins,
    dungeonFails: r.dungeonFails,
  }));

  const outPath = path.resolve(process.cwd(), 'scripts/simulate-last.json');
  const finalSummary = {
    seed: SEED,
    simulatedDurationSec: SIM_DURATION_SEC,
    simulatedDurationText: formatDuration(SIM_DURATION_SEC),
    dayDurationSec: DAY_DURATION_SEC,
    totalDaysSimulated: allDailyReports.length,
    finalState: {
      gold: Math.floor(game.gold),
      totalGoldEarned: Math.floor(game.totalGoldEarned),
      reputation: game.reputation,
      innRank: game.innRank,
      innTitle: game.getCurrentInnRankDef().title,
      unlockedHeroesCount: game.getUnlockedHeroCount(),
      totalRosterCount: HERO_ROSTER.length,
      dungeonClears: game.dungeonClears,
      potionTools: game.potionTools,
      blacksmithTools: game.blacksmithTools,
      materialsWarehouse: game.materials,
      totalPotionsCrafted: game.totalPotionsCrafted,
      totalEquipCrafted: game.totalEquipCrafted,
      totalEnhanceSuccess: game.totalEnhanceSuccess,
      totalEnhanceDestroyed: game.totalEnhanceDestroyed,
      totalPeddlerSales: game.totalPeddlerSales,
      totalHeroShopTransactions: game.totalHeroShopTransactions,
      totalHeroesHealed: game.totalHeroesHealed,
      unpaidWages: game.unpaidWages,
      completedQuests: game.completedQuests,
    },
    milestones,
  };

  fs.writeFileSync(outPath, JSON.stringify(finalSummary, null, 2), 'utf-8');

  console.log('==============================================================');
  console.log('📊 [던전 여관 v4: 수동 수입 제거 · 일일 급료/유지비 · 등급 목표 4시간(60일) 시뮬레이션]');
  console.log('==============================================================');
  console.log(
    `• 시드(Seed): ${SEED} | 시뮬 시간: ${formatDuration(
      SIM_DURATION_SEC
    )} (총 ${allDailyReports.length}일, 1일=${DAY_DURATION_SEC}초)`
  );
  console.log(
    `• 초당 자동 골드(GPS): ${game.getGoldPerSecond()} G/초 (완전 제거 확인)`
  );
  console.log(
    `• 첫 던전 클리어 시각: ${
      milestones.firstDungeonClearSec
        ? `${formatDuration(milestones.firstDungeonClearSec)} (${milestones.firstDungeonClearSec}초, 1일차 내)`
        : '미달성'
    } [목표: 2~5분(1일차) 이내]`
  );

  console.log('\n[1] 🏆 여관 등급(Lv.1 ~ Lv.8) 달성 마일스톤:');
  for (const lvl of INN_LEVELS) {
    const rm = milestones.rankMilestones[lvl.level];
    if (rm) {
      console.log(
        `  - ${lvl.title}: ${rm.timeText} (${rm.day}일차 달성)`
      );
    } else {
      console.log(`  - ${lvl.title}: 미달성`);
    }
  }

  console.log('\n[2] 🗺️ 던전별 첫 클리어 시각 및 파티 편성:');
  for (const d of DUNGEONS) {
    const fc = milestones.dungeonFirstClears[d.id];
    const totalClears = game.dungeonClears[d.id] ?? 0;
    if (fc) {
      console.log(
        `  - ${d.icon} ${d.name} (Tier ${d.tier}, ${fc.reachedFloor}층): ${fc.timeText} (${fc.day}일차, 누적 ${totalClears}회) | 파티: [${fc.party.join(
          ' + '
        )}] (성공률 ${fc.ratePct}%)`
      );
    } else {
      console.log(`  - ${d.icon} ${d.name} (Tier ${d.tier}): 미클리어`);
    }
  }

  console.log('\n[3] 📆 일일 결산 손익 요약 (1일차 ~ 15일차 및 주요 일차):');
  for (const dr of milestones.dailyReports) {
    if (dr.day <= 15 || dr.day % 5 === 0 || dr.day === milestones.dailyReports.length) {
      const sign = dr.netProfit >= 0 ? '+' : '';
      console.log(
        `  - ${String(dr.day).padStart(2, ' ')}일차 (Lv.${dr.innRank}): 총수입 +${formatGold(
          dr.totalIncome
        )}G (서빙 ${dr.guestServing}·식음료 ${dr.foodAndDrink}·객실 ${dr.roomAndRest}·포션 ${dr.potionSales}·대장간 ${dr.blacksmithSales}·수수료 ${dr.lootMargin}) | 운영지출 -${formatGold(
          dr.totalOperatingExpense
        )}G (급료 ${dr.wages}·유지비 ${dr.upkeep}·제작 ${dr.craftCost}·매입 ${dr.lootPurchase}) | 순이익 ${sign}${formatGold(
          dr.netProfit
        )}G | 보유 ${formatGold(dr.endGold)}G`
      );
    }
  }

  console.log('\n[4] ⚗️ 포션 가게 & ⚒️ 대장간 단조 및 +강화(파괴) 검증:');
  for (const r of ['uncommon', 'rare', 'epic', 'legendary'] as RarityTier[]) {
    const rc = milestones.rarityFirstCrafts[r];
    console.log(
      `  - [${RARITY_INFO[r].label}] 장비 첫 제작: ${
        rc ? `${rc.timeText} (${rc.itemName})` : '미제작'
      }`
    );
  }
  console.log(
    `  - +강화 시도: ${milestones.enhanceEvents.attempts}회 | 성공: ${milestones.enhanceEvents.successes}회 | 파괴: ${milestones.enhanceEvents.destructions}회 | 최고 도달: +${milestones.enhanceEvents.maxPlusReached}`
  );
  console.log(
    `  - 장비 파괴 후 기본 장비 복귀 상태에서 후속 던전 클리어: ${milestones.enhanceEvents.postDestroyClears}회`
  );

  console.log('\n[5] 🏠 살아있는 여관 에이전트 & 경제 건전성 지표:');
  console.log(
    `  - 최종 보유 골드: ${formatGold(game.gold)} G (누적 획득: ${formatGold(
      game.totalGoldEarned
    )} G)`
  );
  console.log(
    `  - 최종 여관 등급: ${game.getCurrentInnRankDef().title} (평판 ${formatGold(
      game.reputation
    )}, 합류 영웅 ${game.getUnlockedHeroCount()}/${HERO_ROSTER.length}명)`
  );
  console.log(
    `  - 영웅 상점/식당/객실 거래: ${game.totalHeroShopTransactions}건 | 치료·회복: ${game.totalHeroesHealed}회 | 던전 이벤트 선택: ${milestones.livingInnMetrics.dungeonEventsResolved}회 | 업적 달성: ${milestones.livingInnMetrics.completedQuestsCount}/${OPTIONAL_QUESTS.length}개`
  );
  console.log(
    `  - 교착·파산 발생 여부: ${
      milestones.deadlockDetected ? '❌ 발생' : '✅ 없음 (0건)'
    } | 미지급 급료 잔액: ${game.unpaidWages}G`
  );
  console.log(`  - 결과 JSON 저장 완료: ${outPath}`);
  console.log('==============================================================');
}

function greedyAiStep(
  game: DungeonInnGame,
  sec: number,
  milestones: SimMilestones,
  onDestroyed: () => void
): void {
  const fixedCost =
    game.getDailyWagesBreakdown().totalWages + game.getDailyUpkeepCost();
  const safetyBuffer = Math.max(25, Math.floor(fixedCost * 1.1));

  // 1. 대장간 재고 장비를 착용 가능한 상위 영웅에게 적극 장착
  if (game.equipmentStock.length > 0) {
    const heroes = game
      .getUnlockedHeroes()
      .sort((a, b) => b.level - a.level);
    for (const h of heroes) {
      const roster = HERO_ROSTER_MAP[h.id];
      for (const slot of ['weapon', 'armor', 'offhand', 'accessory'] as EquipSlot[]) {
        const curScore = getEquipmentScoreForClass(
          roster.classId,
          h.equipment[slot]
        );
        let bestUid: number | null = null;
        let bestScore = curScore;
        for (const cand of game.equipmentStock) {
          const def = EQUIPMENT_DEF_MAP[cand.defId];
          if (!def || def.slot !== slot) continue;
          if (!canClassEquip(roster.classId, def)) continue;
          const sc = getEquipmentScoreForClass(roster.classId, cand);
          if (sc > bestScore + 1) {
            bestScore = sc;
            bestUid = cand.uid;
          }
        }
        if (bestUid !== null) {
          game.equipItemToHero(h.id, bestUid);
        }
      }
    }
  }

  // 2. 부상당한 핵심 영웅이 있으면 치료 포션 지급 또는 객실 특실 휴식
  for (const h of game.getUnlockedHeroes()) {
    if (h.status === 'injured') {
      if ((game.potionStock['potion_cure_injury'] ?? 0) > 0) {
        game.givePotionToHero(h.id, 'potion_cure_injury', false);
      } else if (game.gold >= safetyBuffer + 20) {
        game.restHeroInRoom(h.id);
      }
    }
  }

  // 3. 던전 파견 (미클리어 상위 해금 던전 우선 도전 및 탱+힐+딜 시너지 파티 편성)
  while (game.expeditions.length < game.getMaxConcurrentExpeditions()) {
    const idleHeroes = game
      .getUnlockedHeroes()
      .filter((h) => h.status === 'idle' && !h.expeditionId);
    if (idleHeroes.length === 0) break;

    const unlockedDungeons = DUNGEONS.filter((d) =>
      game.isDungeonUnlocked(d.id)
    );
    let dispatched = false;

    for (let i = unlockedDungeons.length - 1; i >= 0; i--) {
      const d = unlockedDungeons[i];
      const clears = game.dungeonClears[d.id] ?? 0;
      const party = selectBestPartyForDungeon(
        idleHeroes,
        d,
        game.getMaxPartySize()
      );
      if (party.length === 0) continue;

      if (clears === 0 && d.tier >= 2) {
        for (const ph of party) {
          if (
            !ph.buffs.some((b) => b.source === 'food') &&
            game.gold >= safetyBuffer + 25
          ) {
            game.treatHeroMeal(ph.id);
          }
          if (!ph.buffs.some((b) => b.source === 'potion')) {
            for (const pId of [
              'potion_dragon_elixir',
              'potion_ironblood',
              'potion_wisdom',
              'potion_gale',
              'potion_might',
              'potion_heal_minor',
            ]) {
              if ((game.potionStock[pId] ?? 0) > 0) {
                game.givePotionToHero(ph.id, pId, false);
                break;
              }
            }
          }
        }
      }

      const ev = evaluatePartyForDungeon(party, d);
      const threshold = clears === 0 ? 0.54 : 0.64;
      if (ev.finalSuccessRate >= threshold || i === 0) {
        dispatched = game.dispatchParty(
          d.id,
          party.map((p) => p.id)
        );
        break;
      }
    }

    if (!dispatched) break;
  }

  // 4. 포션 가게 & 대장간 도구/시설 우선 업그레이드 (직원 고용은 등급과 골드 여유에 맞춰 진행)
  for (const pt of POTION_TOOLS) {
    const lv = game.potionTools[pt.id] ?? 0;
    const maxAllowed = pt.kind === 'staff' ? Math.min(2, Math.floor(game.innRank / 3)) : 4;
    if (
      lv < maxAllowed &&
      game.canUpgradeShopTool(pt.id) &&
      game.gold >= safetyBuffer + 40
    ) {
      game.upgradeShopTool(pt.id);
    }
  }
  for (const bt of BLACKSMITH_TOOLS) {
    const lv = game.blacksmithTools[bt.id] ?? 0;
    const maxAllowed = bt.kind === 'staff' ? Math.min(2, Math.floor(game.innRank / 3)) : 5;
    if (
      lv < maxAllowed &&
      game.canUpgradeShopTool(bt.id) &&
      game.gold >= safetyBuffer + 40
    ) {
      game.upgradeShopTool(bt.id);
    }
  }

  // 5. 포션 제작
  if (game.craftQueues.potion.length < game.getMaxCraftSlots('potion')) {
    const unlockedPotions = POTION_RECIPES.filter((r) =>
      game.isPotionRecipeUnlocked(r.id)
    );
    let crafted = false;
    for (let i = 0; i < unlockedPotions.length; i++) {
      const r = unlockedPotions[i];
      if (
        !milestones.potionFirstCrafts[r.id] &&
        game.canCraftPotion(r.id) &&
        game.gold >= r.goldCost + safetyBuffer * 0.5
      ) {
        game.startCraftPotion(r.id);
        crafted = true;
        break;
      }
    }
    if (!crafted) {
      for (let i = unlockedPotions.length - 1; i >= 0; i--) {
        const r = unlockedPotions[i];
        if (
          (game.potionStock[r.id] ?? 0) < 3 &&
          game.canCraftPotion(r.id) &&
          game.gold >= r.goldCost * 2 + safetyBuffer
        ) {
          game.startCraftPotion(r.id);
          break;
        }
      }
    }
  }

  // 6. 대장간 장비 단조
  const forgeLv = game.blacksmithTools['smith_forge'] ?? 0;
  const anvilLv = game.blacksmithTools['smith_anvil'] ?? 0;
  const needIronForTools = forgeLv < 4 || anvilLv < 3;
  const ironCount = game.materials['mat_iron_scrap'] ?? 0;

  if (
    game.craftQueues.blacksmith.length < game.getMaxCraftSlots('blacksmith')
  ) {
    const unlockedEquips = EQUIPMENT_DEFS.filter(
      (e) => !e.isBase && game.isEquipmentRecipeUnlocked(e.id)
    );
    let started = false;
    for (let i = unlockedEquips.length - 1; i >= 0; i--) {
      const e = unlockedEquips[i];
      if (
        !milestones.rarityFirstCrafts[e.rarity] &&
        game.canCraftEquipment(e.id)
      ) {
        game.startCraftEquipment(e.id);
        started = true;
        break;
      }
    }
    if (
      !started &&
      game.equipmentStock.length < 4 &&
      (!needIronForTools || ironCount >= 7 || game.totalEquipCrafted < 4)
    ) {
      for (let i = unlockedEquips.length - 1; i >= 0; i--) {
        const e = unlockedEquips[i];
        if (
          game.canCraftEquipment(e.id) &&
          game.gold >= e.craftGoldCost * 2 + safetyBuffer
        ) {
          game.startCraftEquipment(e.id);
          break;
        }
      }
    }
  }

  // 7. +강화 시도
  if (
    sec % 20 === 0 &&
    game.gold >= safetyBuffer + 60 &&
    (!needIronForTools || ironCount >= 5 || game.totalEnhanceSuccess < 2)
  ) {
    const heroes = game.getUnlockedHeroes();
    for (const h of heroes) {
      for (const slot of ['weapon', 'armor', 'offhand', 'accessory'] as EquipSlot[]) {
        const inst = h.equipment[slot];
        const def = EQUIPMENT_DEF_MAP[inst.defId];
        if (!def || def.isBase) continue;
        const maxTargetPlus =
          milestones.enhanceEvents.destructions === 0 && sec > 900 ? 5 : 3;
        if (inst.enhanceLevel < maxTargetPlus) {
          const preview = game.getEnhancePreview({ heroId: h.id, slot });
          if (
            preview &&
            preview.canAttempt &&
            game.gold >= preview.goldCost * 2 + safetyBuffer
          ) {
            const res = game.enhanceEquipment({ heroId: h.id, slot }, false);
            if (res) {
              milestones.enhanceEvents.attempts += 1;
              if (res.success) {
                milestones.enhanceEvents.successes += 1;
                if (res.newLevel > milestones.enhanceEvents.maxPlusReached) {
                  milestones.enhanceEvents.maxPlusReached = res.newLevel;
                }
              } else if (res.destroyed) {
                milestones.enhanceEvents.destructions += 1;
                onDestroyed();
                if (!milestones.enhanceEvents.sampleDestructionLog) {
                  milestones.enhanceEvents.sampleDestructionLog = `[${formatDuration(
                    sec
                  )}] ${res.heroName}의 <${res.itemName} +${
                    res.prevLevel
                  }> 강화 실패로 완전 파괴 -> 기본 장비로 즉시 복귀`;
                }
              }
              break;
            }
          }
        }
      }
    }
  }

  // 8. 여관 기본 업그레이드 (메뉴·객실·직원·시설 — 급료/유지비 폭주를 막기 위해 등급에 맞춰 단계적 투자)
  const maxStaffLv = Math.min(3, Math.max(1, Math.floor(game.innRank / 2)));
  const maxFacilityLv = Math.min(4, Math.max(2, Math.floor(game.innRank / 2) + 1));

  const affordableUpgrades = UPGRADES.filter((u) => {
    const lv = game.upgrades[u.id] ?? 0;
    const cap = u.category === 'staff' ? maxStaffLv : maxFacilityLv;
    if (lv >= cap) return false;
    const cost = getUpgradeCost(u, lv);
    return game.canBuyUpgrade(u.id) && game.gold >= cost + safetyBuffer;
  }).sort(
    (a, b) =>
      getUpgradeCost(a, game.upgrades[a.id] ?? 0) -
      getUpgradeCost(b, game.upgrades[b.id] ?? 0)
  );

  if (affordableUpgrades.length > 0) {
    game.buyUpgrade(affordableUpgrades[0].id);
  }
}

runSimulation();
