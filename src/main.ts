import { sfx } from './audio';
import {
  ALL_WEAPON_TYPES,
  DUNGEON_ZONES,
  HERO_CLASS_META,
  HERO_TIER_GROWTH_MULT,
  MATERIAL_MAP,
  MATERIALS,
  STAFF_ROLE_META,
  TIER_COLORS,
  WEAPON_TYPE_META,
} from './data';
import { IsoRenderer } from './isoRenderer';
import {
  calculateSlotProbabilities,
  getEffectiveHeroLevelCap,
  getEnchantPreviewInfo,
  getEnhanceSuccessRate,
  getFacilityLuckBonus,
  getHeroCombatStats,
  rollAlchemyPotion,
  rollCookingDish,
  rollFacilityUpgrade,
  rollHeroRecruitCandidate,
  rollStaffHireCandidate,
  rollWeaponEnchant,
  rollWeaponEnhance,
  rollWeaponForge,
} from './slotEngine';
import {
  createInitialSaveData,
  exportSaveToJsonFile,
  importSaveFromJsonFile,
  loadGameData,
  saveGameData,
} from './storage';
import {
  ActiveDungeonRun,
  DishItem,
  FacilityId,
  FacilityPassive,
  FloatingPop,
  GameSaveData,
  HeroUnit,
  MapActor,
  PotionItem,
  RankTier,
  StaffMember,
  StaffRoleId,
  WeaponEnchant,
  WeaponItem,
  WeaponTypeId,
} from './types';
import './style.css';

type ModalTab =
  | 'inn_cook'
  | 'inn_hero'
  | 'bs_forge'
  | 'bs_enhance'
  | 'bs_enchant'
  | 'potion_brew'
  | 'trade_market'
  | 'staff_hire'
  | 'facility_up'
  | 'dungeon_prep'
  | 'save_manage';

interface PendingDecision {
  kind:
    | 'cook'
    | 'hero'
    | 'forge'
    | 'enchant'
    | 'potion'
    | 'staff'
    | 'facility';
  reels: [string, string, string];
  isJackpot: boolean;
  scrapRefund: number;
  dish?: DishItem;
  hero?: HeroUnit;
  weapon?: WeaponItem;
  targetWeaponId?: string;
  enchants?: WeaponEnchant[];
  potion?: PotionItem;
  staffCandidate?: StaffMember;
  facilityId?: FacilityId;
  facilityPassive?: FacilityPassive;
  greatLevelUp?: boolean;
}

class KairoSlotInnApp {
  private save!: GameSaveData;
  private renderer!: IsoRenderer;
  private actors: MapActor[] = [];
  private pops: FloatingPop[] = [];
  private activeDungeon: ActiveDungeonRun | null = null;
  private activeModal: ModalTab | null = null;

  // 슬롯 베팅 선택 상태
  private betTier1: RankTier = 'C';
  private betTier2: RankTier = 'C';
  private selectedWeaponType: WeaponTypeId = 'sword';
  private selectedWeaponId: string | null = null;
  private selectedStaffRole: StaffRoleId = 'forger';
  private selectedFacilityId: FacilityId = 'inn';
  private selectedDungeonId = 'dungeon_1';

  // 슬롯 회전 연출 및 채택/버리기 결정 대기 상태
  private isSpinning = false;
  private spinReels: [string, string, string] = ['7️⃣', '7️⃣', '7️⃣'];
  private pendingDecision: PendingDecision | null = null;
  private enhanceResultBanner: string | null = null;

  private lastFrameTime = performance.now();
  private calendarAccum = 0;
  private guestIncomeAccum = 0;

  public async init(): Promise<void> {
    this.save = await loadGameData();
    if (!this.selectedWeaponId && this.save.weapons.length > 0) {
      this.selectedWeaponId = this.save.weapons[0].id;
    }

    const canvas = document.getElementById('iso-canvas') as HTMLCanvasElement;
    this.renderer = new IsoRenderer(canvas);
    window.addEventListener('resize', () => this.renderer.resize());

    canvas.addEventListener('click', (e) => {
      const clicked = this.renderer.getClickedRoom(e.clientX, e.clientY);
      if (!clicked) return;
      sfx.playClick();
      if (clicked === 'inn') this.openModal('inn_cook');
      else if (clicked === 'blacksmith') this.openModal('bs_forge');
      else if (clicked === 'potion') this.openModal('potion_brew');
      else if (clicked === 'trade') this.openModal('trade_market');
      else if (clicked === 'dungeon_gate') this.openModal('dungeon_prep');
    });

    this.syncMapActors();
    this.bindUIEvents();
    this.updateTopHud();

    requestAnimationFrame((now) => this.loop(now));
  }

  /**
   * 5명 전담 직원 + 영입한 영웅들을 쿼터뷰 타일맵 위에 자연스럽게 배치 및 행동 제어
   */
  private syncMapActors(): void {
    const existingMap = new Map(this.actors.map((a) => [a.id, a]));
    const nextActors: MapActor[] = [];

    // 1. 5명 전담 직원 배치 (각자 담당 시설 안에서 분주하게 움직이며 말풍선 출력)
    const staffCoords: Record<
      StaffRoleId,
      { gx: number; gy: number; tool: string; badge: string }
    > = {
      chef: { gx: 2.3, gy: 2.3, tool: '🍳', badge: '👨‍🍳요리사' },
      forger: { gx: 9.4, gy: 2.4, tool: '🔨', badge: '🔨제작' },
      enhancer: { gx: 11.1, gy: 3.5, tool: '⚒️', badge: '⚒️강화' },
      enchanter: { gx: 12.1, gy: 2.4, tool: '✨', badge: '✨인챈트' },
      alchemist: { gx: 3.3, gy: 10.2, tool: '🧪', badge: '🧪연금' },
    };

    (Object.keys(staffCoords) as StaffRoleId[]).forEach((role) => {
      const st = this.save.staff[role];
      const meta = staffCoords[role];
      const prev = existingMap.get(st.id);
      nextActors.push(
        prev || {
          id: st.id,
          name: st.name,
          kind: 'staff',
          gridX: meta.gx,
          gridY: meta.gy,
          targetX: meta.gx,
          targetY: meta.gy,
          state: 'work',
          stateTimer: 3,
          facing: 'se',
          speechText: null,
          speechTimer: 0,
          speechTone: 'normal',
          hairColor: st.hatColor,
          bodyColor: st.avatarColor,
          accentColor: '#fef08a',
          weaponIcon: meta.tool,
          roleBadge: `[${st.tier}]`,
          bouncePhase: Math.random() * 6,
        }
      );
    });

    // 2. 영입한 영웅들 배치 (여관, 대장간, 포션가게, 거래처 사이를 자연스럽게 순회)
    for (const hero of this.save.heroes) {
      const prev = existingMap.get(hero.id);
      const wp = this.save.weapons.find((w) => w.id === hero.weaponId);
      const classMeta = HERO_CLASS_META[hero.classId];
      if (prev) {
        prev.weaponIcon = wp ? wp.icon : classMeta.icon;
        prev.roleBadge = `Lv.${hero.level}`;
        nextActors.push(prev);
      } else {
        const startX = 3 + Math.random() * 7;
        const startY = 3 + Math.random() * 7;
        nextActors.push({
          id: hero.id,
          name: hero.name,
          kind: 'hero',
          gridX: startX,
          gridY: startY,
          targetX: startX,
          targetY: startY,
          state: 'idle',
          stateTimer: 1 + Math.random() * 2,
          facing: 'se',
          speechText: '여관이 아늑하군!',
          speechTimer: 3.5,
          speechTone: 'happy',
          hairColor: hero.hairColor,
          bodyColor: hero.armorColor,
          accentColor: TIER_COLORS[hero.tier],
          weaponIcon: wp ? wp.icon : classMeta.icon,
          roleBadge: `Lv.${hero.level}`,
          bouncePhase: Math.random() * 6,
        });
      }
    }

    this.actors = nextActors;
  }

  private loop(now: number): void {
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    this.updateCalendarAndIncome(dt);
    this.updateActorsBehavior(dt);
    this.updateDungeonCombat(dt);

    // 떠오르는 텍스트 업데이트
    this.pops = this.pops.filter((p) => {
      p.age += dt;
      return p.age < p.maxAge;
    });

    this.renderer.render(
      this.save,
      this.actors,
      this.pops,
      this.activeDungeon,
      now / 1000
    );

    requestAnimationFrame((n) => this.loop(n));
  }

  private updateCalendarAndIncome(dt: number): void {
    // 카이로소프트 스타일 달력(5Y 4M 3W) 진행
    this.calendarAccum += dt;
    if (this.calendarAccum >= 7) {
      this.calendarAccum = 0;
      this.save.week++;
      if (this.save.week > 4) {
        this.save.week = 1;
        this.save.month++;
        if (this.save.month > 12) {
          this.save.month = 1;
          this.save.year++;
        }
      }
      this.updateTopHud();
      saveGameData(this.save);
    }

    // 영웅들과 손님들이 여관·상점을 이용하며 창출하는 실시간 골드 수입
    this.guestIncomeAccum += dt;
    if (this.guestIncomeAccum >= 5.5) {
      this.guestIncomeAccum = 0;
      const innLv = this.save.facilities.inn.level;
      const tradeLv = this.save.facilities.trade.level;
      const passiveGoldPct = Object.values(this.save.facilities)
        .flatMap((f) => f.passives)
        .filter((p) => p.bonusType === 'gold_income')
        .reduce((acc, p) => acc + p.value, 0);

      const baseEarn = Math.round(
        (12 + innLv * 8 + tradeLv * 6 + this.save.heroes.length * 5) *
          (1 + passiveGoldPct / 100)
      );
      this.save.gold += baseEarn;
      this.spawnPop(3.8, 3.6, `+${baseEarn}G 숙박·상점`, '#fde047');
      this.updateTopHud();
    }
  }

  /**
   * 캐릭터들이 상황에 맞게 자연스럽고 부드럽게 이동하고 행동하며 카이로소프트풍 말풍선을 띄웁니다.
   */
  private updateActorsBehavior(dt: number): void {
    const waypoints = [
      { gx: 3.5, gy: 3.5, room: 'inn', lines: ['맛있는 냄새!', '푹 쉬었다~', '요리 슬롯 돌리자!'] },
      { gx: 10.5, gy: 3.8, room: 'blacksmith', lines: ['새 무기가 필요해!', '강화 대박 나길!', '모루 소리 좋네!'] },
      { gx: 3.5, gy: 10.5, room: 'potion', lines: ['포션 챙겨가자!', '보글보글 신기해', '회복약 필수!'] },
      { gx: 10.5, gy: 10.5, room: 'trade', lines: ['재료 사러 왔어!', '마일리지 교환!', '오늘 시세 좋군!'] },
      { gx: 7.0, gy: 7.0, room: 'corridor', lines: ['던전 가고 싶다!', '컨디션 최고!', 'Ugh... 배고파'] },
    ];

    for (const actor of this.actors) {
      if (actor.speechTimer > 0) {
        actor.speechTimer -= dt;
        if (actor.speechTimer <= 0) {
          actor.speechText = null;
        }
      }

      if (actor.kind === 'staff') {
        // 직원은 자기 작업대 주변에서 부드럽게 작업 모션 + 가끔 장인 대사
        actor.stateTimer -= dt;
        if (actor.stateTimer <= 0) {
          actor.stateTimer = 4 + Math.random() * 5;
          if (Math.random() < 0.35 && !actor.speechText) {
            const staffLines = [
              '슬롯 손맛 최고!',
              '대박 예감!',
              '열심히 벼리는 중!',
              '좋은 재료를 써봐!',
            ];
            actor.speechText =
              staffLines[Math.floor(Math.random() * staffLines.length)];
            actor.speechTone = 'normal';
            actor.speechTimer = 2.8;
          }
        }
        continue;
      }

      // 영웅들의 부드러운 이동 및 시설 방문
      if (actor.state === 'walk') {
        const dx = actor.targetX - actor.gridX;
        const dy = actor.targetY - actor.gridY;
        const dist = Math.hypot(dx, dy);
        const speed = 1.85; // 자연스럽고 부드러운 이동 속도

        if (dist <= speed * dt) {
          actor.gridX = actor.targetX;
          actor.gridY = actor.targetY;
          actor.state = 'idle';
          actor.stateTimer = 2.2 + Math.random() * 3.0;
        } else {
          actor.gridX += (dx / dist) * speed * dt;
          actor.gridY += (dy / dist) * speed * dt;
          actor.facing = dx >= 0 ? (dy >= 0 ? 'se' : 'ne') : dy >= 0 ? 'sw' : 'nw';
        }
      } else {
        actor.stateTimer -= dt;
        if (actor.stateTimer <= 0) {
          const wp = waypoints[Math.floor(Math.random() * waypoints.length)];
          actor.targetX = wp.gx + (Math.random() - 0.5) * 2.2;
          actor.targetY = wp.gy + (Math.random() - 0.5) * 2.2;
          actor.state = 'walk';

          if (Math.random() < 0.45 && !actor.speechText) {
            const line = wp.lines[Math.floor(Math.random() * wp.lines.length)];
            actor.speechText = line;
            actor.speechTone = line.includes('Ugh') ? 'ugh' : 'normal';
            actor.speechTimer = 3.0;
          }
        }
      }
    }
  }

  public triggerActorSpeech(
    roleOrHeroId: string,
    text: string,
    tone: MapActor['speechTone'] = 'happy'
  ): void {
    const actor =
      this.actors.find((a) => a.id === roleOrHeroId) ||
      this.actors[Math.floor(Math.random() * this.actors.length)];
    if (actor) {
      actor.speechText = text;
      actor.speechTone = tone;
      actor.speechTimer = 3.5;
    }
  }

  public spawnPop(gx: number, gy: number, text: string, color: string): void {
    this.pops.push({
      id: `pop_${Date.now()}_${Math.random()}`,
      gridX: gx,
      gridY: gy,
      text,
      color,
      age: 0,
      maxAge: 1.6,
    });
  }

  /**
   * 던전 안에서의 미니 전투 슬롯 & 자동 전투 업데이트
   */
  private updateDungeonCombat(dt: number): void {
    const run = this.activeDungeon;
    if (!run || run.status !== 'fighting') return;

    run.waveTimer += dt;
    run.slotSpinTimer += dt;

    // 2.2초마다 던전 상단 미니 전투 슬롯이 자동으로 돌아가며 특수 효과 발동!
    if (run.slotSpinTimer >= 2.2) {
      run.slotSpinTimer = 0;
      this.triggerDungeonCombatSlot(run);
      this.renderDungeonBanner();
    }

    // 1.1초마다 파티 기본 공방 교전
    if (run.waveTimer >= 1.1) {
      run.waveTimer = 0;
      const zone =
        DUNGEON_ZONES.find((z) => z.id === run.zoneId) || DUNGEON_ZONES[0];

      let partyAtk = 0;
      let partyAlive = 0;
      for (const hid of run.partyIds) {
        const hero = this.save.heroes.find((h) => h.id === hid);
        if (!hero || hero.currentHp <= 0) continue;
        partyAlive++;
        const st = getHeroCombatStats(this.save, hero);
        partyAtk += st.atk;

        // 포션 자동 사용 체크 (체력 45% 이하일 때 장착한 포션 발동!)
        if (hero.currentHp < st.maxHp * 0.45 && hero.equippedPotionId) {
          const potIdx = this.save.potions.findIndex(
            (p) => p.id === hero.equippedPotionId
          );
          if (potIdx >= 0) {
            const pot = this.save.potions[potIdx];
            const healAmt = Math.round(st.maxHp * (pot.healPct / 100));
            hero.currentHp = Math.min(st.maxHp, hero.currentHp + healAmt);
            partyAtk = Math.round(partyAtk * (1 + pot.atkBuffPct / 100));
            run.combatLogs.unshift(
              `🧪 ${hero.name}님이 [${pot.name}] 사용! (체력 +${healAmt}, 공격력 +${pot.atkBuffPct}%)`
            );
            this.save.potions.splice(potIdx, 1);
            hero.equippedPotionId = null;
          }
        }
      }

      if (partyAlive === 0) {
        run.status = 'defeat';
        sfx.playFailStop();
        this.consumeOneTimeMeals(run.partyIds);
        this.renderDungeonBanner();
        return;
      }

      // 몬스터 타격
      const dmgToMonster = Math.max(8, Math.round(partyAtk * (0.9 + Math.random() * 0.25)));
      run.monsterHp = Math.max(0, run.monsterHp - dmgToMonster);

      // 몬스터 반격
      if (run.monsterHp > 0) {
        const monsterAtk = (zone.recLevel * 9 + 14) * (run.isBoss ? 1.35 : 1.0);
        for (const hid of run.partyIds) {
          const hero = this.save.heroes.find((h) => h.id === hid);
          if (!hero || hero.currentHp <= 0) continue;
          const st = getHeroCombatStats(this.save, hero);
          const hit = Math.max(
            3,
            Math.round((monsterAtk - st.def * 0.6) / Math.max(1, partyAlive))
          );
          hero.currentHp = Math.max(0, hero.currentHp - hit);
        }
      } else {
        // 현재 웨이브 몬스터 처치!
        const goldDrop = Math.round(
          (zone.baseGoldReward / run.maxWaves) * (run.isBoss ? 1.8 : 1.0)
        );
        run.accumulatedGold += goldDrop;

        // 던전 등급에 맞는 식재료/광석/약초 드랍!
        const dropMats = MATERIALS.filter(
          (m) => m.tier === zone.dropTier || (m.tier === 'C' && Math.random() < 0.4)
        );
        const pickedMat =
          dropMats[Math.floor(Math.random() * dropMats.length)] || MATERIALS[0];
        const existingDrop = run.accumulatedDrops.find(
          (d) => d.materialId === pickedMat.id
        );
        if (existingDrop) existingDrop.count += 1;
        else run.accumulatedDrops.push({ materialId: pickedMat.id, count: 1 });

        run.combatLogs.unshift(
          `⚔️ ${run.monsterName} 격파! (+${goldDrop}G, ${pickedMat.icon}${pickedMat.name} 획득)`
        );

        // 영웅 경험치 및 레벨업 처리 (여관 등급 상한선 적용!)
        this.grantPartyExp(run.partyIds, zone.recLevel * 25);

        if (run.wave >= run.maxWaves) {
          // 보스까지 클리어 완료 -> 클리어 보상 룰렛 슬롯 단계로 진입!
          run.status = 'reward_slot';
          sfx.playSuccess();
          this.consumeOneTimeMeals(run.partyIds);
        } else {
          run.wave++;
          run.isBoss = run.wave === run.maxWaves;
          run.monsterName = run.isBoss
            ? `👑 ${zone.bossName}`
            : zone.monsterNames[run.wave % zone.monsterNames.length];
          const baseHp = (zone.recLevel * 75 + 90) * (run.isBoss ? 1.9 : 1.0);
          run.monsterMaxHp = Math.round(baseHp);
          run.monsterHp = run.monsterMaxHp;
        }
      }

      this.renderDungeonBanner();
    }
  }

  private triggerDungeonCombatSlot(run: ActiveDungeonRun): void {
    const outcomes: {
      syms: [string, string, string];
      label: string;
      type: 'crit' | 'heal' | 'gold' | 'jackpot';
    }[] = [
      { syms: ['⚔️', '⚔️', '🔥'], label: '⚔️ 연쇄 강타 발동! (즉시 추가 피해)', type: 'crit' },
      { syms: ['🧪', '💚', '🧪'], label: '💚 치유의 바람! (파티 체력 20% 회복)', type: 'heal' },
      { syms: ['💰', '💰', '💎'], label: '💰 숨겨진 보물상자 발견! (보상 골드 추가)', type: 'gold' },
      { syms: ['7️⃣', '7️⃣', '7️⃣'], label: '⚡ 777 궁극기 잭팟! (적 체력 45% 즉시 삭감!)', type: 'jackpot' },
    ];
    const r = Math.random();
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
        const h = this.save.heroes.find((hero) => hero.id === hid);
        if (!h) continue;
        const st = getHeroCombatStats(this.save, h);
        h.currentHp = Math.min(st.maxHp, h.currentHp + Math.round(st.maxHp * 0.2));
      }
    } else if (pick.type === 'gold') {
      run.accumulatedGold += 65;
    } else if (pick.type === 'jackpot') {
      const nuke = Math.round(run.monsterMaxHp * 0.45);
      run.monsterHp = Math.max(1, run.monsterHp - nuke);
      sfx.playSuccess();
    }
  }

  private grantPartyExp(partyIds: string[], expGain: number): void {
    for (const hid of partyIds) {
      const hero = this.save.heroes.find((h) => h.id === hid);
      if (!hero) continue;
      const cap = getEffectiveHeroLevelCap(this.save, hero);
      if (hero.level >= cap) continue;

      hero.exp += expGain;
      const needed = hero.level * 50;
      if (hero.exp >= needed && hero.level < cap) {
        hero.exp -= needed;
        hero.level++;
        const gMult = HERO_TIER_GROWTH_MULT[hero.tier];
        hero.baseHp += Math.round(16 * gMult);
        hero.baseAtk += Math.round(3.5 * gMult);
        hero.baseDef += Math.round(1.5 * gMult);
        const st = getHeroCombatStats(this.save, hero);
        hero.currentHp = st.maxHp;
        this.triggerActorSpeech(hero.id, `Lv.${hero.level} 레벨업!`, 'happy');
      }
    }
    this.syncMapActors();
  }

  /**
   * 1회성 요리는 던전 원정 1회가 끝나면 깔끔하게 소모됩니다!
   */
  private consumeOneTimeMeals(partyIds: string[]): void {
    for (const hid of partyIds) {
      const hero = this.save.heroes.find((h) => h.id === hid);
      if (hero) {
        hero.activeMeal = null;
        const st = getHeroCombatStats(this.save, hero);
        hero.currentHp = st.maxHp;
      }
    }
  }

  private bindUIEvents(): void {
    document.querySelectorAll('[data-open-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-open-tab') as ModalTab;
        sfx.playClick();
        this.openModal(tab);
      });
    });

    const closeBtn = document.getElementById('modal-close-btn');
    closeBtn?.addEventListener('click', () => {
      sfx.playClick();
      this.closeModal();
    });

    const backdrop = document.getElementById('modal-backdrop');
    backdrop?.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.closeModal();
      }
    });
  }

  public updateTopHud(): void {
    const calEl = document.getElementById('hud-calendar');
    if (calEl) {
      calEl.textContent = `${this.save.year}Y  ${this.save.month}M  ${this.save.week}W`;
    }
    const goldEl = document.getElementById('hud-gold');
    if (goldEl) {
      goldEl.textContent = `${this.save.gold.toLocaleString()}G`;
    }
    const scrapEl = document.getElementById('hud-scrap');
    if (scrapEl) {
      scrapEl.textContent = `${this.save.scrap.toLocaleString()}`;
    }
    const heroCountEl = document.getElementById('hud-heroes');
    if (heroCountEl) {
      heroCountEl.textContent = `${this.save.heroes.length}명`;
    }
  }

  public openModal(tab: ModalTab): void {
    this.activeModal = tab;
    this.pendingDecision = null;
    this.enhanceResultBanner = null;
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.remove('hidden');
    this.renderModalContent();
  }

  public closeModal(): void {
    this.activeModal = null;
    this.pendingDecision = null;
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
  }

  /**
   * 3번 규칙: 먼저 투입할 재료/비용 등급을 베팅하여 릴 확률을 높인 뒤 스핀!
   * 결과가 나오면 [채택(진행)]할지 [버리기(마일리지 가루 획득)]할지 결정!
   */
  private executeSlotSpin(onComplete: () => void): void {
    if (this.isSpinning) return;
    this.isSpinning = true;
    this.save.totalSlotSpins++;
    sfx.playSlotTick();

    const pool = ['🍒', '🔔', '💎', '7️⃣', '⭐', '🔥'];
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
      this.spinReels = [
        pool[Math.floor(Math.random() * pool.length)],
        pool[Math.floor(Math.random() * pool.length)],
        pool[Math.floor(Math.random() * pool.length)],
      ];
      sfx.playSlotTick();
      const reelBoxes = document.querySelectorAll('.slot-reel-cell');
      reelBoxes.forEach((el, idx) => {
        el.textContent = this.spinReels[idx];
        el.classList.add('spinning');
      });

      if (ticks >= 9) {
        clearInterval(timer);
        this.isSpinning = false;
        onComplete();
        this.updateTopHud();
        saveGameData(this.save);
        this.renderModalContent();
      }
    }, 65);
  }

  private renderModalContent(): void {
    const tab = this.activeModal;
    if (!tab) return;

    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    if (!titleEl || !bodyEl) return;

    // 상단 서브탭 네비게이션 업데이트
    document.querySelectorAll('.modal-nav-pill').forEach((el) => {
      const t = el.getAttribute('data-modal-tab');
      el.classList.toggle('active', t === tab);
    });

    if (tab === 'inn_cook') {
      titleEl.textContent = '🍲 여관 주방: 1회성 출정 버프 요리 슬롯';
      bodyEl.innerHTML = this.buildInnCookHTML();
    } else if (tab === 'inn_hero') {
      titleEl.textContent = '🦸 여관 객실: 영웅 영입 슬롯 & 영웅 관리';
      bodyEl.innerHTML = this.buildInnHeroHTML();
    } else if (tab === 'bs_forge') {
      titleEl.textContent = '🔨 대장간 [1/3]: 무기 제작 슬롯 (제작 장인 담당)';
      bodyEl.innerHTML = this.buildBlacksmithForgeHTML();
    } else if (tab === 'bs_enhance') {
      titleEl.textContent = '⚒️ 대장간 [2/3]: 연속 강화 슬롯 (실패 시 그 수치로 확정 완료!)';
      bodyEl.innerHTML = this.buildBlacksmithEnhanceHTML();
    } else if (tab === 'bs_enchant') {
      titleEl.textContent = '✨ 대장간 [3/3]: 마법 인챈트 슬롯 (+강화 비례 옵션 수 & 범위 증가)';
      bodyEl.innerHTML = this.buildBlacksmithEnchantHTML();
    } else if (tab === 'potion_brew') {
      titleEl.textContent = '🧪 포션가게: 약초 조합 연금 슬롯 (연금술사 담당)';
      bodyEl.innerHTML = this.buildPotionBrewHTML();
    } else if (tab === 'trade_market') {
      titleEl.textContent = '💎 왕국 거래처: 정가 재료 상점 & 마일리지 교환소';
      bodyEl.innerHTML = this.buildTradeMarketHTML();
    } else if (tab === 'staff_hire') {
      titleEl.textContent = '👨‍🍳 직원 고용 슬롯: 5대 전담 장인 스카우트';
      bodyEl.innerHTML = this.buildStaffHireHTML();
    } else if (tab === 'facility_up') {
      titleEl.textContent = '🏰 시설 업그레이드 슬롯: 확정 레벨업 + 특수 패시브 추첨';
      bodyEl.innerHTML = this.buildFacilityUpHTML();
    } else if (tab === 'dungeon_prep') {
      titleEl.textContent = '⚔️ 던전 원정 출발 & 전투/보상 슬롯';
      bodyEl.innerHTML = this.buildDungeonPrepHTML();
    } else if (tab === 'save_manage') {
      titleEl.textContent = '💾 데이터 저장 관리 (IndexedDB + LocalStorage 이중 금고)';
      bodyEl.innerHTML = this.buildSaveManageHTML();
    }

    this.attachModalInnerHandlers();
  }

  private renderSlotMachineWidget(
    probs: { C: number; B: number; A: number; S: number },
    staff: StaffMember,
    costDesc: string,
    canSpin: boolean,
    spinBtnLabel: string
  ): string {
    const reels = this.pendingDecision
      ? this.pendingDecision.reels
      : this.spinReels;

    return `
      <div class="kairo-slot-machine ${this.pendingDecision?.isJackpot ? 'jackpot-glow' : ''}">
        <div class="slot-header-row">
          <div class="staff-badge-card">
            <span class="tier-pill tier-${staff.tier}">${staff.tier}급 담당</span>
            <strong>${staff.name}</strong>
            <span class="staff-bonus-tag">행운 +${staff.bonusProb}% · ${staff.specialtyLabel}</span>
          </div>
          <div class="prob-bar-group">
            <span class="prob-chip tier-C">C급 ${probs.C}%</span>
            <span class="prob-chip tier-B">B급 ${probs.B}%</span>
            <span class="prob-chip tier-A">A급 ${probs.A}%</span>
            <span class="prob-chip tier-S">S급 ${probs.S}%</span>
          </div>
        </div>

        <div class="slot-reels-frame">
          <div class="slot-reel-cell">${reels[0]}</div>
          <div class="slot-reel-cell">${reels[1]}</div>
          <div class="slot-reel-cell">${reels[2]}</div>
        </div>

        ${
          this.pendingDecision
            ? this.buildPendingDecisionHTML(this.pendingDecision)
            : `
          <div class="slot-action-bar">
            <div class="slot-cost-label">베팅 소모: <strong>${costDesc}</strong></div>
            <button id="btn-trigger-spin" class="kairo-btn-primary ${!canSpin ? 'disabled' : ''}" ${!canSpin ? 'disabled' : ''}>
              🎰 ${spinBtnLabel}
            </button>
          </div>
        `
        }
      </div>
    `;
  }

  private buildPendingDecisionHTML(pd: PendingDecision): string {
    let summaryHTML = '';
    if (pd.kind === 'cook' && pd.dish) {
      summaryHTML = `
        <div class="result-card tier-border-${pd.dish.tier}">
          <div class="result-title">
            <span class="tier-pill tier-${pd.dish.tier}">${pd.dish.tier}급</span>
            <strong>${pd.dish.icon} ${pd.dish.name}</strong>
          </div>
          <p class="result-desc">${pd.dish.desc} (판매가 ${pd.dish.sellGold}G)</p>
        </div>
      `;
    } else if (pd.kind === 'potion' && pd.potion) {
      summaryHTML = `
        <div class="result-card tier-border-${pd.potion.tier}">
          <div class="result-title">
            <span class="tier-pill tier-${pd.potion.tier}">${pd.potion.tier}급</span>
            <strong>${pd.potion.icon} ${pd.potion.name}</strong>
          </div>
          <p class="result-desc">${pd.potion.desc} (판매가 ${pd.potion.sellGold}G)</p>
        </div>
      `;
    } else if (pd.kind === 'forge' && pd.weapon) {
      summaryHTML = `
        <div class="result-card tier-border-${pd.weapon.tier}">
          <div class="result-title">
            <span class="tier-pill tier-${pd.weapon.tier}">${pd.weapon.tier}급</span>
            <strong>${pd.weapon.icon} ${pd.weapon.name}</strong>
          </div>
          <p class="result-desc">기본 공격력 <strong>+${pd.weapon.baseAtk}</strong> (채택 후 연속 강화 & 인챈트 가능!)</p>
        </div>
      `;
    } else if (pd.kind === 'enchant' && pd.enchants) {
      const list = pd.enchants
        .map(
          (e) =>
            `<span class="enchant-tag" style="border-color:${e.color}">✨ ${e.name}: <strong>${e.statLabel}${e.value}</strong> <small>(범위 ${e.minVal}~${e.maxVal})</small></span>`
        )
        .join('');
      summaryHTML = `
        <div class="result-card tier-border-A">
          <div class="result-title"><strong>✨ 새로운 마법 인챈트 결과 (${pd.enchants.length}줄)</strong></div>
          <div class="enchant-tag-list">${list}</div>
        </div>
      `;
    } else if (pd.kind === 'hero' && pd.hero) {
      const cap = getEffectiveHeroLevelCap(this.save, pd.hero);
      summaryHTML = `
        <div class="result-card tier-border-${pd.hero.tier}">
          <div class="result-title">
            <span class="tier-pill tier-${pd.hero.tier}">${pd.hero.tier}급</span>
            <strong>${HERO_CLASS_META[pd.hero.classId].icon} ${pd.hero.name} (${pd.hero.className} · Lv.1)</strong>
          </div>
          <p class="result-desc">체력 ${pd.hero.baseHp} · 공격력 ${pd.hero.baseAtk} · 방어 ${pd.hero.baseDef} | 잠재 상한 Lv.${pd.hero.maxLevelCap} (현재 여관 해금 Lv.${cap})</p>
        </div>
      `;
    } else if (pd.kind === 'staff' && pd.staffCandidate) {
      const st = pd.staffCandidate;
      const cur = this.save.staff[st.role];
      summaryHTML = `
        <div class="result-card tier-border-${st.tier}">
          <div class="result-title">
            <span class="tier-pill tier-${st.tier}">${st.tier}급</span>
            <strong>${st.name} (${STAFF_ROLE_META[st.role].title})</strong>
          </div>
          <p class="result-desc">슬롯 행운 보너스 <strong>+${st.bonusProb}%</strong> · ${st.specialtyLabel}<br/>
          <small>(현재 담당: [${cur.tier}급] ${cur.name} +${cur.bonusProb}% · ${cur.specialtyLabel})</small></p>
        </div>
      `;
    } else if (pd.kind === 'facility' && pd.facilityPassive && pd.facilityId) {
      const p = pd.facilityPassive;
      summaryHTML = `
        <div class="result-card tier-border-${p.tier}">
          <div class="result-title">
            <span class="tier-pill tier-${p.tier}">${p.tier}급 특성</span>
            <strong>${pd.greatLevelUp ? '🎉 대성공 (+2레벨 상승!) & ' : '⬆️ +1레벨 상승 & '}${p.name}</strong>
          </div>
          <p class="result-desc">${p.desc}</p>
        </div>
      `;
    }

    return `
      <div class="decision-box">
        ${pd.isJackpot ? `<div class="jackpot-banner">🎊 JACKPOT 777 대박 당첨! 🎊</div>` : ''}
        ${summaryHTML}
        <div class="decision-buttons">
          <button id="btn-decision-keep" class="kairo-btn-keep">
            ✅ 채택 (진행하기)
          </button>
          <button id="btn-decision-discard" class="kairo-btn-discard">
            🗑️ 버리기 (마일리지 가루 +${pd.scrapRefund} 획득)
          </button>
        </div>
      </div>
    `;
  }

  private buildMaterialBetSelectorHTML(
    category: 'food' | 'ore' | 'herb',
    dualSlot = true
  ): string {
    const tiers: RankTier[] = ['C', 'B', 'A', 'S'];
    const buildRow = (slotNum: 1 | 2, currentTier: RankTier) => {
      return tiers
        .map((t) => {
          const matId = `${category}_${t.toLowerCase()}`;
          const mat = MATERIAL_MAP[matId];
          const count = this.save.materials[matId] || 0;
          const active = currentTier === t ? 'selected' : '';
          return `
            <button class="mat-bet-btn ${active} tier-border-${t}" data-bet-slot="${slotNum}" data-bet-tier="${t}">
              <span class="mat-icon">${mat.icon}</span>
              <div class="mat-meta">
                <strong>[${t}급] ${mat.name}</strong>
                <small>보유: ${count}개</small>
              </div>
            </button>
          `;
        })
        .join('');
    };

    return `
      <div class="bet-selector-panel">
        <div class="bet-row-label">🎲 1번 투입 재료 선택 (등급이 높을수록 A·S급 확률 대폭 상승!)</div>
        <div class="bet-grid">${buildRow(1, this.betTier1)}</div>
        ${
          dualSlot
            ? `
          <div class="bet-row-label" style="margin-top:8px;">🎲 2번 조합 재료 선택 (서로 다른 등급 조합 시 추가 시너지!)</div>
          <div class="bet-grid">${buildRow(2, this.betTier2)}</div>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * 1. 여관 주방: 1회성 출정 버프 요리 슬롯
   */
  private buildInnCookHTML(): string {
    const chef = this.save.staff.chef;
    const probs = calculateSlotProbabilities(
      [this.betTier1, this.betTier2],
      chef.bonusProb,
      getFacilityLuckBonus(this.save, 'inn'),
      this.betTier1 !== this.betTier2 ? 6 : 3
    );

    const mat1Id = `food_${this.betTier1.toLowerCase()}`;
    const mat2Id = `food_${this.betTier2.toLowerCase()}`;
    const needSame = mat1Id === mat2Id ? 2 : 1;
    const canSpin =
      this.save.gold >= 30 &&
      (this.save.materials[mat1Id] || 0) >= needSame &&
      (this.save.materials[mat2Id] || 0) >= 1;

    const costDesc = `30G + ${MATERIAL_MAP[mat1Id].icon}${MATERIAL_MAP[mat1Id].name} 1개 + ${MATERIAL_MAP[mat2Id].icon}${MATERIAL_MAP[mat2Id].name} 1개`;

    const dishListHTML =
      this.save.dishes.length === 0
        ? `<div class="empty-hint">보유한 요리가 없습니다. 위 슬롯을 돌려 1회성 출정 버프 요리를 만드세요!</div>`
        : this.save.dishes
            .map(
              (d) => `
          <div class="inv-item-card tier-border-${d.tier}">
            <div>
              <span class="tier-pill tier-${d.tier}">${d.tier}급</span>
              <strong>${d.icon} ${d.name}</strong>
              <div class="sub-text">${d.desc}</div>
            </div>
            <div class="inv-actions">
              <button class="kairo-btn-mini" data-feed-dish="${d.id}">🍽️ 영웅에게 먹이기(1회 출정버프)</button>
              <button class="kairo-btn-mini gold" data-sell-dish="${d.id}">💰 판매 (+${d.sellGold}G)</button>
            </div>
          </div>
        `
            )
            .join('');

    return `
      ${this.buildMaterialBetSelectorHTML('food', true)}
      ${this.renderSlotMachineWidget(probs, chef, costDesc, canSpin, '요리 슬롯 돌리기')}
      <div class="section-divider">🍽️ 완성된 1회성 요리 보관함 (${this.save.dishes.length}개)</div>
      <div class="inv-list">${dishListHTML}</div>
    `;
  }

  /**
   * 2. 여관 객실: 영웅 영입 슬롯 & 영웅 성장/장비 관리
   */
  private buildInnHeroHTML(): string {
    const chef = this.save.staff.chef;
    const probs = calculateSlotProbabilities(
      [this.betTier1],
      chef.bonusProb,
      getFacilityLuckBonus(this.save, 'inn')
    );
    const goldCostMap: Record<RankTier, number> = {
      C: 120,
      B: 260,
      A: 520,
      S: 980,
    };
    const matId = `food_${this.betTier1.toLowerCase()}`;
    const goldCost = goldCostMap[this.betTier1];
    const canSpin =
      this.save.gold >= goldCost && (this.save.materials[matId] || 0) >= 1;
    const costDesc = `${goldCost}G + 환영 만찬용 ${MATERIAL_MAP[matId].icon}${MATERIAL_MAP[matId].name} 1개`;

    const heroesHTML = this.save.heroes
      .map((h) => {
        const st = getHeroCombatStats(this.save, h);
        const cap = getEffectiveHeroLevelCap(this.save, h);
        const wpText = st.weapon
          ? `${st.weapon.icon} ${st.weapon.name} (+${st.weapon.enhanceCount}강)`
          : '무기 미장착';
        const mealText = h.activeMeal
          ? `🍽️ ${h.activeMeal.name} (+체력${h.activeMeal.hpBonus}/+공격${h.activeMeal.atkBonus})`
          : '출정 요리 없음';
        const pot = this.save.potions.find((p) => p.id === h.equippedPotionId);
        const potText = pot ? `${pot.icon} ${pot.name}` : '포션 없음';

        return `
          <div class="hero-roster-card tier-border-${h.tier}">
            <div class="hero-main-info">
              <div>
                <span class="tier-pill tier-${h.tier}">${h.tier}급</span>
                <strong>${HERO_CLASS_META[h.classId].icon} ${h.name}</strong>
                <span class="hero-lv-badge">Lv.${h.level} / 해금상한 Lv.${cap} <small>(최대 잠재 Lv.${h.maxLevelCap})</small></span>
              </div>
              <div class="hero-stats-line">
                ❤️ 체력 <strong>${st.maxHp}</strong> · ⚔️ 공격력 <strong>${st.atk}</strong> · 🛡️ 방어 <strong>${st.def}</strong>
              </div>
              <div class="hero-equip-line">
                <span>무기: <strong>${wpText}</strong></span> |
                <span>1회성 요리: <strong>${mealText}</strong></span> |
                <span>비상 포션: <strong>${potText}</strong></span>
              </div>
            </div>
            <div class="hero-actions-col">
              <button class="kairo-btn-mini" data-train-hero="${h.id}">
                📈 훈련 레벨업 (${h.level * 75}G)
              </button>
              ${
                this.save.heroes.length > 1
                  ? `<button class="kairo-btn-mini danger" data-dismiss-hero="${h.id}">하산</button>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="info-callout">
        💡 <strong>카이로소프트식 영웅 등급 상한 & 밸런스 장치:</strong> 고등급(A·S급) 영웅도 처음엔 <strong>Lv.1</strong>로 합류하며,
        잠재 최대 레벨(C급 Lv.10 ~ S급 Lv.40)은 <strong>현재 여관 시설 레벨(Lv.${this.save.facilities.inn.level})</strong>에 따라 단계적으로 해금됩니다!
      </div>
      ${this.buildMaterialBetSelectorHTML('food', false)}
      ${this.renderSlotMachineWidget(probs, chef, costDesc, canSpin, '영웅 영입 슬롯 돌리기')}
      <div class="section-divider">🦸 여관 소속 영웅 명단 (${this.save.heroes.length}명)</div>
      <div class="inv-list">${heroesHTML}</div>
    `;
  }

  /**
   * 3. 대장간 [1/3]: 무기 제작 슬롯 (제작 장인의 특화 무기 보너스!)
   */
  private buildBlacksmithForgeHTML(): string {
    const forger = this.save.staff.forger;
    const isSpec = forger.specialties.includes(this.selectedWeaponType);
    const specBonus = isSpec ? (forger.tier === 'S' ? 15 : 12) : 0;

    const probs = calculateSlotProbabilities(
      [this.betTier1, this.betTier2],
      forger.bonusProb,
      getFacilityLuckBonus(this.save, 'blacksmith'),
      specBonus
    );

    const weaponTypeBtns = ALL_WEAPON_TYPES.map((wt) => {
      const m = WEAPON_TYPE_META[wt];
      const spec = forger.specialties.includes(wt);
      return `
        <button class="weapon-type-btn ${this.selectedWeaponType === wt ? 'selected' : ''}" data-select-wtype="${wt}">
          <span>${m.icon} ${m.name}</span>
          ${spec ? `<span class="spec-star">★장인특화 +${forger.tier === 'S' ? 15 : 12}%</span>` : ''}
        </button>
      `;
    }).join('');

    const ore1Id = `ore_${this.betTier1.toLowerCase()}`;
    const ore2Id = `ore_${this.betTier2.toLowerCase()}`;
    const needSame = ore1Id === ore2Id ? 2 : 1;
    const canSpin =
      this.save.gold >= 50 &&
      (this.save.materials[ore1Id] || 0) >= needSame &&
      (this.save.materials[ore2Id] || 0) >= 1;

    const costDesc = `50G + ${MATERIAL_MAP[ore1Id].icon}${MATERIAL_MAP[ore1Id].name} 1개 + ${MATERIAL_MAP[ore2Id].icon}${MATERIAL_MAP[ore2Id].name} 1개`;

    return `
      <div class="subtab-bar">
        <button class="subtab-btn active" data-goto-tab="bs_forge">1️⃣ 무기 제작 슬롯 (${this.save.staff.forger.name})</button>
        <button class="subtab-btn" data-goto-tab="bs_enhance">2️⃣ 연속 강화 슬롯 (${this.save.staff.enhancer.name})</button>
        <button class="subtab-btn" data-goto-tab="bs_enchant">3️⃣ 마법 인챈트 슬롯 (${this.save.staff.enchanter.name})</button>
      </div>
      <div class="bet-row-label">🗡️ 제작할 무기 종류 선택 (담당 장인의 ★특화 무기일수록 고등급 확률 추가 상승!)</div>
      <div class="weapon-type-grid">${weaponTypeBtns}</div>
      ${this.buildMaterialBetSelectorHTML('ore', true)}
      ${this.renderSlotMachineWidget(probs, forger, costDesc, canSpin, '무기 제작 슬롯 돌리기')}
      ${this.buildWeaponInventoryHTML()}
    `;
  }

  /**
   * 4. 대장간 [2/3]: 무기 연속 강화 슬롯
   * 실패(STOP)가 뜨면 무기가 파괴되지 않고 '거기까지 강화 완료(확정)' 됩니다!
   */
  private buildBlacksmithEnhanceHTML(): string {
    const enhancer = this.save.staff.enhancer;
    const targetWp =
      this.save.weapons.find((w) => w.id === this.selectedWeaponId) ||
      this.save.weapons[0] ||
      null;
    if (targetWp) this.selectedWeaponId = targetWp.id;

    const oreId = `ore_${this.betTier1.toLowerCase()}`;
    const rate = targetWp
      ? getEnhanceSuccessRate(this.save, targetWp, this.betTier1)
      : 0;
    const canSpin =
      !!targetWp &&
      !targetWp.enhanceLocked &&
      this.save.gold >= 40 &&
      (this.save.materials[oreId] || 0) >= 1;

    return `
      <div class="subtab-bar">
        <button class="subtab-btn" data-goto-tab="bs_forge">1️⃣ 무기 제작 슬롯 (${this.save.staff.forger.name})</button>
        <button class="subtab-btn active" data-goto-tab="bs_enhance">2️⃣ 연속 강화 슬롯 (${this.save.staff.enhancer.name})</button>
        <button class="subtab-btn" data-goto-tab="bs_enchant">3️⃣ 마법 인챈트 슬롯 (${this.save.staff.enchanter.name})</button>
      </div>

      <div class="info-callout">
        ⚒️ <strong>연속 강화 규칙:</strong> 강화 슬롯이 성공할 때마다 <strong>+1강 (대성공 시 +2강!)</strong>이 계속 쌓입니다!
        만약 <strong>실패(🔒STOP)</strong>가 뜨면 무기가 파괴되지 않고 <strong>현재 +수치에서 강화가 최종 확정 완료</strong>됩니다.
        (+강화 횟수가 높을수록 다음 단계인 <strong>인챈트 슬롯</strong>의 옵션 줄 수와 최소~최대 수치가 폭발적으로 증가합니다!)
      </div>

      ${this.buildWeaponSelectorDropdown(targetWp)}
      ${this.buildMaterialBetSelectorHTML('ore', false)}

      ${
        targetWp
          ? `
        <div class="kairo-slot-machine">
          <div class="slot-header-row">
            <div class="staff-badge-card">
              <span class="tier-pill tier-${enhancer.tier}">${enhancer.tier}급 강화장인</span>
              <strong>${enhancer.name}</strong>
              <span class="staff-bonus-tag">강화성공 +${enhancer.bonusProb}% · ${enhancer.specialtyLabel}</span>
            </div>
            <div class="prob-bar-group">
              <span class="prob-chip tier-S">현재 +${targetWp.enhanceCount}강 → 성공 확률 ${rate}%</span>
            </div>
          </div>

          <div class="slot-reels-frame">
            <div class="slot-reel-cell">${this.spinReels[0]}</div>
            <div class="slot-reel-cell">${this.spinReels[1]}</div>
            <div class="slot-reel-cell">${this.spinReels[2]}</div>
          </div>

          ${
            this.enhanceResultBanner
              ? `<div class="enhance-banner">${this.enhanceResultBanner}</div>`
              : ''
          }

          <div class="slot-action-bar">
            <div class="slot-cost-label">
              ${
                targetWp.enhanceLocked
                  ? `🔒 <strong>+${targetWp.enhanceCount}강에서 강화 완료(확정)된 무기입니다! 이제 [3️⃣ 마법 인챈트 슬롯]으로 가세요!</strong>`
                  : `소모: 40G + ${MATERIAL_MAP[oreId].icon}${MATERIAL_MAP[oreId].name} 1개`
              }
            </div>
            <button id="btn-trigger-enhance" class="kairo-btn-primary ${!canSpin ? 'disabled' : ''}" ${!canSpin ? 'disabled' : ''}>
              ⚒️ 연속 강화 슬롯 스핀! (+${targetWp.enhanceCount}강 도전)
            </button>
          </div>
        </div>
      `
          : `<div class="empty-hint">강화할 무기가 없습니다. 먼저 무기를 제작하세요!</div>`
      }
      ${this.buildWeaponInventoryHTML()}
    `;
  }

  /**
   * 5. 대장간 [3/3]: 무기 인챈트 슬롯
   * 연속 강화 횟수(+수치)에 따라 뜨는 가지 수(1~4줄)와 수치 범위(최소~최대)를 투명하게 알려주고 슬롯 스핀!
   */
  private buildBlacksmithEnchantHTML(): string {
    const enchanter = this.save.staff.enchanter;
    const targetWp =
      this.save.weapons.find((w) => w.id === this.selectedWeaponId) ||
      this.save.weapons[0] ||
      null;
    if (targetWp) this.selectedWeaponId = targetWp.id;

    const oreId = `ore_${this.betTier1.toLowerCase()}`;
    const preview = targetWp
      ? getEnchantPreviewInfo(this.save, targetWp, this.betTier1)
      : null;

    const probs = calculateSlotProbabilities(
      [this.betTier1],
      enchanter.bonusProb,
      getFacilityLuckBonus(this.save, 'blacksmith'),
      targetWp && enchanter.specialties.includes(targetWp.type) ? 15 : 0
    );

    const canSpin =
      !!targetWp &&
      this.save.gold >= 60 &&
      (this.save.materials[oreId] || 0) >= 1;
    const costDesc = `60G + ${MATERIAL_MAP[oreId].icon}${MATERIAL_MAP[oreId].name} 1개`;

    const rangeBadges = preview
      ? preview.ranges
          .map(
            (r) => `
          <div class="range-preview-chip" style="border-left: 3px solid ${r.color}">
            <strong>${r.name}</strong>
            <span>${r.statLabel} <b>${r.minVal} ~ ${r.maxVal}</b></span>
          </div>
        `
          )
          .join('')
      : '';

    return `
      <div class="subtab-bar">
        <button class="subtab-btn" data-goto-tab="bs_forge">1️⃣ 무기 제작 슬롯 (${this.save.staff.forger.name})</button>
        <button class="subtab-btn" data-goto-tab="bs_enhance">2️⃣ 연속 강화 슬롯 (${this.save.staff.enhancer.name})</button>
        <button class="subtab-btn active" data-goto-tab="bs_enchant">3️⃣ 마법 인챈트 슬롯 (${this.save.staff.enchanter.name})</button>
      </div>

      ${this.buildWeaponSelectorDropdown(targetWp)}
      ${this.buildMaterialBetSelectorHTML('ore', false)}

      ${
        targetWp && preview
          ? `
        <div class="enchant-preview-box">
          <div class="enchant-preview-header">
            ✨ <strong>[${targetWp.icon} ${targetWp.name} +${targetWp.enhanceCount}강]</strong> 인챈트 예상 스펙:
            <span class="highlight-badge">동시 부여 옵션 수: <strong>${preview.slotCount}가지</strong></span>
            <small>(+2강 이상 2줄, +5강 이상 3줄, +8강 이상 4줄!)</small>
          </div>
          <div class="range-preview-grid">${rangeBadges}</div>
        </div>
        ${this.renderSlotMachineWidget(probs, enchanter, costDesc, canSpin, '마법 인챈트 슬롯 돌리기')}
      `
          : `<div class="empty-hint">인챈트할 무기가 없습니다.</div>`
      }
      ${this.buildWeaponInventoryHTML()}
    `;
  }

  private buildWeaponSelectorDropdown(targetWp: WeaponItem | null): string {
    if (this.save.weapons.length === 0) return '';
    const btns = this.save.weapons
      .map((w) => {
        const active = targetWp?.id === w.id ? 'selected' : '';
        return `
          <button class="weapon-pick-chip ${active} tier-border-${w.tier}" data-pick-weapon="${w.id}">
            <span>${w.icon} [${w.tier}] ${w.name} <strong>+${w.enhanceCount}강</strong> ${w.enhanceLocked ? '🔒확정' : ''}</span>
            <small>공격력 ${Math.round(w.baseAtk * (1 + w.enhanceCount * 0.18))} · 인챈트 ${w.enchants.length}줄</small>
          </button>
        `;
      })
      .join('');
    return `
      <div class="bet-row-label">🎯 대상 무기 선택</div>
      <div class="weapon-pick-list">${btns}</div>
    `;
  }

  private buildWeaponInventoryHTML(): string {
    if (this.save.weapons.length === 0) return '';
    const rows = this.save.weapons
      .map((w) => {
        const enhAtk = Math.round(w.baseAtk * (1 + w.enhanceCount * 0.18));
        const encText =
          w.enchants.length > 0
            ? w.enchants.map((e) => `${e.statLabel}${e.value}`).join(', ')
            : '인챈트 없음';
        const heroOptions = this.save.heroes
          .map(
            (h) =>
              `<option value="${h.id}" ${w.equippedHeroId === h.id ? 'selected' : ''}>${h.name} (${h.className})</option>`
          )
          .join('');

        return `
          <div class="inv-item-card tier-border-${w.tier}">
            <div>
              <span class="tier-pill tier-${w.tier}">${w.tier}급</span>
              <strong>${w.icon} ${w.name} +${w.enhanceCount}강</strong>
              ${w.enhanceLocked ? `<span class="locked-tag">🔒강화완료</span>` : ''}
              <div class="sub-text">최종 공격력 <strong>+${enhAtk}</strong> (기본 ${w.baseAtk}) | ✨ ${encText}</div>
            </div>
            <div class="inv-actions">
              <select class="kairo-select" data-equip-weapon="${w.id}">
                <option value="">-- 장착 영웅 선택 --</option>
                ${heroOptions}
              </select>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="section-divider">🗡️ 보유 무기 보관함 (${this.save.weapons.length}개)</div>
      <div class="inv-list">${rows}</div>
    `;
  }

  /**
   * 6. 포션가게: 약초 조합 1회 슬롯
   */
  private buildPotionBrewHTML(): string {
    const alch = this.save.staff.alchemist;
    const probs = calculateSlotProbabilities(
      [this.betTier1, this.betTier2],
      alch.bonusProb,
      getFacilityLuckBonus(this.save, 'potion'),
      this.betTier1 !== this.betTier2 ? 6 : 3
    );

    const h1Id = `herb_${this.betTier1.toLowerCase()}`;
    const h2Id = `herb_${this.betTier2.toLowerCase()}`;
    const needSame = h1Id === h2Id ? 2 : 1;
    const canSpin =
      this.save.gold >= 30 &&
      (this.save.materials[h1Id] || 0) >= needSame &&
      (this.save.materials[h2Id] || 0) >= 1;

    const costDesc = `30G + ${MATERIAL_MAP[h1Id].icon}${MATERIAL_MAP[h1Id].name} 1개 + ${MATERIAL_MAP[h2Id].icon}${MATERIAL_MAP[h2Id].name} 1개`;

    const potListHTML =
      this.save.potions.length === 0
        ? `<div class="empty-hint">보유한 포션이 없습니다. 약초를 조합해 포션 슬롯을 돌리세요!</div>`
        : this.save.potions
            .map(
              (p) => `
          <div class="inv-item-card tier-border-${p.tier}">
            <div>
              <span class="tier-pill tier-${p.tier}">${p.tier}급</span>
              <strong>${p.icon} ${p.name}</strong>
              <div class="sub-text">${p.desc}</div>
            </div>
            <div class="inv-actions">
              <button class="kairo-btn-mini" data-equip-potion="${p.id}">🎒 영웅 가방에 넣기</button>
              <button class="kairo-btn-mini gold" data-sell-potion="${p.id}">💰 판매 (+${p.sellGold}G)</button>
            </div>
          </div>
        `
            )
            .join('');

    return `
      ${this.buildMaterialBetSelectorHTML('herb', true)}
      ${this.renderSlotMachineWidget(probs, alch, costDesc, canSpin, '포션 연금 슬롯 돌리기')}
      <div class="section-divider">🧪 연성된 포션 진열대 (${this.save.potions.length}개)</div>
      <div class="inv-list">${potListHTML}</div>
    `;
  }

  /**
   * 7. 왕국 거래처: 시세 슬롯 없이 깔끔한 정가 재료 상점 & 마일리지(가루) 확정 교환소
   */
  private buildTradeMarketHTML(): string {
    const scrapCosts: Record<RankTier, number> = { C: 8, B: 20, A: 45, S: 95 };
    const rows = MATERIALS.map((m) => {
      const count = this.save.materials[m.id] || 0;
      const scCost = scrapCosts[m.tier];
      return `
        <div class="trade-item-card tier-border-${m.tier}">
          <div class="trade-item-left">
            <span class="tier-pill tier-${m.tier}">${m.tier}급</span>
            <strong>${m.icon} ${m.name}</strong>
            <span class="stock-count">보유: <b>${count}개</b></span>
            <div class="sub-text">${m.desc}</div>
          </div>
          <div class="trade-item-actions">
            <button class="kairo-btn-mini" data-buy-mat="${m.id}" ${this.save.gold < m.buyPrice ? 'disabled' : ''}>
              🛒 구매 (${m.buyPrice}G)
            </button>
            <button class="kairo-btn-mini gold" data-sell-mat="${m.id}" ${count <= 0 ? 'disabled' : ''}>
              💰 판매 (+${m.sellPrice}G)
            </button>
            <button class="kairo-btn-mini purple" data-scrap-mat="${m.id}" ${this.save.scrap < scCost ? 'disabled' : ''}>
              ♻️ 마일리지 교환 (${scCost}가루)
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="info-callout">
        💎 <strong>왕국 거래처 (정가 상점 & 마일리지 교환소):</strong>
        던전에서 얻은 남는 재료를 팔거나 부족한 재료를 정가로 구매하세요!
        특히 슬롯에서 <strong>[🗑️ 버리기]</strong>를 선택해 모은 <strong>♻️ 마일리지 가루(보유: ${this.save.scrap}개)</strong>로 A~S급 희귀 재료를 100% 확정 교환할 수 있습니다.
      </div>
      <div class="trade-grid">${rows}</div>
    `;
  }

  /**
   * 8. 직원 고용 슬롯: 요리사 / 대장간 3인(제작·강화·인챈트) / 연금술사 스카우트
   */
  private buildStaffHireHTML(): string {
    const roleBtns = (Object.keys(STAFF_ROLE_META) as StaffRoleId[])
      .map((r) => {
        const meta = STAFF_ROLE_META[r];
        const cur = this.save.staff[r];
        return `
          <button class="staff-role-tab ${this.selectedStaffRole === r ? 'selected' : ''}" data-select-srole="${r}">
            <div><strong>${meta.icon} ${meta.title}</strong></div>
            <small>현재: [${cur.tier}급] ${cur.name} (+${cur.bonusProb}%)</small>
          </button>
        `;
      })
      .join('');

    const curStaff = this.save.staff[this.selectedStaffRole];
    const facId = STAFF_ROLE_META[this.selectedStaffRole].facility;
    const probs = calculateSlotProbabilities(
      [this.betTier1],
      curStaff.bonusProb,
      getFacilityLuckBonus(this.save, facId)
    );

    const hireGoldMap: Record<RankTier, number> = {
      C: 100,
      B: 240,
      A: 500,
      S: 950,
    };
    const tiers: RankTier[] = ['C', 'B', 'A', 'S'];
    const betTierBtns = tiers
      .map(
        (t) => `
        <button class="mat-bet-btn ${this.betTier1 === t ? 'selected' : ''} tier-border-${t}" data-bet-slot="1" data-bet-tier="${t}">
          <div class="mat-meta">
            <strong>[${t}급 스카우트 공고]</strong>
            <small>베팅 비용: ${hireGoldMap[t]}G</small>
          </div>
        </button>
      `
      )
      .join('');

    const cost = hireGoldMap[this.betTier1];
    const canSpin = this.save.gold >= cost;

    return `
      <div class="info-callout">
        👨‍🍳 <strong>직원 고용 슬롯 특징:</strong> 대장간은 <strong>제작·강화·인챈트 3명의 담당 직원</strong>이 각각 따로 배치됩니다!
        고등급 직원일수록 슬롯 대박 확률 보너스가 높고, <strong>다룰 수 있는 특화 무기 개수(C급 1종 → S급 5종 전체 마스터!)</strong>가 늘어납니다.
      </div>
      <div class="staff-role-grid">${roleBtns}</div>
      <div class="bet-row-label">💰 스카우트 공고 등급 베팅</div>
      <div class="bet-grid">${betTierBtns}</div>
      ${this.renderSlotMachineWidget(probs, curStaff, `${cost}G`, canSpin, '직원 스카우트 슬롯 돌리기')}
    `;
  }

  /**
   * 9. 시설 업그레이드 슬롯: 기본 +1레벨 보장 + 특수 시설 특성 추첨
   */
  private buildFacilityUpHTML(): string {
    const facIds: FacilityId[] = ['inn', 'blacksmith', 'potion', 'trade'];
    const facBtns = facIds
      .map((fid) => {
        const f = this.save.facilities[fid];
        return `
          <button class="staff-role-tab ${this.selectedFacilityId === fid ? 'selected' : ''}" data-select-fac="${fid}">
            <div><strong>${f.name} (Lv.${f.level})</strong></div>
            <small>보유 특성: ${f.passives.length}개</small>
          </button>
        `;
      })
      .join('');

    const fac = this.save.facilities[this.selectedFacilityId];
    const baseCost = fac.level * 220;
    const oreId = `ore_${this.betTier1.toLowerCase()}`;
    const probs = calculateSlotProbabilities(
      [this.betTier1],
      10,
      getFacilityLuckBonus(this.save, this.selectedFacilityId)
    );
    const canSpin =
      this.save.gold >= baseCost && (this.save.materials[oreId] || 0) >= 1;
    const costDesc = `${baseCost}G + 증축 자재 ${MATERIAL_MAP[oreId].icon}${MATERIAL_MAP[oreId].name} 1개`;

    const passivesHTML =
      fac.passives.length === 0
        ? `<div class="empty-hint">아직 획득한 특수 시설 특성이 없습니다. 업그레이드 슬롯을 돌려 특성을 획득하세요!</div>`
        : fac.passives
            .map(
              (p) => `
          <div class="inv-item-card tier-border-${p.tier}">
            <div>
              <span class="tier-pill tier-${p.tier}">${p.tier}급 특성</span>
              <strong>${p.name}</strong>
              <div class="sub-text">${p.desc}</div>
            </div>
          </div>
        `
            )
            .join('');

    return `
      <div class="info-callout">
        🏰 <strong>시설 업그레이드 슬롯:</strong> 업그레이드 슬롯을 돌리면 <strong>기본 +1레벨 상승(잭팟 시 +2레벨!)</strong>과 함께
        시설 전용 패시브 특성이 뽑힙니다. 마음에 들면 <strong>[채택]</strong>하여 레벨업과 특성을 확정하고, 마음에 안 들면 <strong>[버리기]</strong>로 마일리지를 챙겨 다시 좋은 특성을 노릴 수 있습니다!
      </div>
      <div class="staff-role-grid">${facBtns}</div>
      ${this.buildMaterialBetSelectorHTML('ore', false)}
      ${this.renderSlotMachineWidget(probs, this.save.staff.forger, costDesc, canSpin, `${fac.name} 업그레이드 슬롯 돌리기`)}
      <div class="section-divider">✨ [${fac.name}] 적용 중인 시설 특성 (${fac.passives.length}개)</div>
      <div class="inv-list">${passivesHTML}</div>
    `;
  }

  /**
   * 10. 던전 원정 출발 & 던전 내 전투 슬롯 & 클리어 후 보상 룰렛 슬롯
   */
  private buildDungeonPrepHTML(): string {
    const zoneCards = DUNGEON_ZONES.map((z) => {
      const clears = this.save.clearedDungeons[z.id] || 0;
      return `
        <button class="dungeon-zone-card ${this.selectedDungeonId === z.id ? 'selected' : ''} tier-border-${z.dropTier}" data-select-dungeon="${z.id}">
          <div>
            <span class="tier-pill tier-${z.dropTier}">${z.dropTier}급 재료 드랍</span>
            <strong>${z.name}</strong>
          </div>
          <div class="sub-text">${z.floorText} | 보스: ${z.bossName}</div>
          <small>클리어 횟수: ${clears}회 · 기본 보상 ${z.baseGoldReward}G</small>
        </button>
      `;
    }).join('');

    const partySummary = this.save.heroes
      .slice(0, 4)
      .map((h) => {
        const st = getHeroCombatStats(this.save, h);
        return `
          <div class="party-member-chip tier-border-${h.tier}">
            <strong>${HERO_CLASS_META[h.classId].icon} ${h.name} (Lv.${h.level})</strong>
            <span>❤️${st.maxHp} ⚔️${st.atk}</span>
            <small>${h.activeMeal ? `🍽️${h.activeMeal.name}` : '식사 없음'} | ${h.equippedPotionId ? '🧪포션장착' : '포션없음'}</small>
          </div>
        `;
      })
      .join('');

    return `
      <div class="bet-row-label">🗺️ 탐험할 던전 구역 선택 (상위 던전일수록 B·A·S급 고등급 재료가 드랍됩니다!)</div>
      <div class="dungeon-zone-grid">${zoneCards}</div>

      <div class="section-divider">🛡️ 출정 파티 (최대 4인 자동 편성)</div>
      <div class="party-chip-grid">${partySummary}</div>

      <div class="slot-action-bar" style="margin-top:14px;">
        <div>💡 출발 전 여관에서 <strong>1회성 요리</strong>를 먹이고, 포션가게에서 <strong>포션</strong>을 챙겨주면 돌파력이 급상승합니다!</div>
        <button id="btn-launch-dungeon" class="kairo-btn-primary">
          ⚔️ 지금 던전 원정 출발!
        </button>
      </div>
    `;
  }

  /**
   * 11. 데이터 저장 관리 (IndexedDB + LocalStorage 이중 자동저장 & JSON 내보내기/불러오기)
   */
  private buildSaveManageHTML(): string {
    return `
      <div class="info-callout">
        💾 <strong>이중 금고 자동 저장 작동 중:</strong> 모든 슬롯 결과와 여관 경영 데이터는 브라우저 내장 데이터베이스인
        <strong>IndexedDB</strong>와 <strong>LocalStorage</strong> 두 곳에 실시간으로 동시 저장됩니다.
        다른 기기로 옮기거나 영구 백업하고 싶을 때 아래 JSON 세이브 파일 다운로드/불러오기를 이용하세요!
      </div>
      <div class="save-actions-box">
        <button id="btn-export-json" class="kairo-btn-keep">
          📥 세이브 파일(.json) 내 컴퓨터로 다운로드
        </button>
        <label class="kairo-btn-primary" style="cursor:pointer;">
          📤 세이브 파일(.json) 불러오기
          <input type="file" id="input-import-json" accept=".json" style="display:none;" />
        </label>
        <button id="btn-reset-save" class="kairo-btn-discard">
          ⚠️ 처음부터 새로 시작 (초기화)
        </button>
      </div>
    `;
  }

  private attachModalInnerHandlers(): void {
    // 모달 상단 서브탭 이동
    document.querySelectorAll('[data-goto-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-goto-tab') as ModalTab;
        sfx.playClick();
        this.openModal(t);
      });
    });

    // 베팅 재료 등급 선택
    document.querySelectorAll('[data-bet-tier]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.isSpinning || this.pendingDecision) return;
        const slot = Number(btn.getAttribute('data-bet-slot'));
        const tier = btn.getAttribute('data-bet-tier') as RankTier;
        sfx.playClick();
        if (slot === 1) this.betTier1 = tier;
        else this.betTier2 = tier;
        this.renderModalContent();
      });
    });

    // 무기 종류 선택
    document.querySelectorAll('[data-select-wtype]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.isSpinning || this.pendingDecision) return;
        this.selectedWeaponType = btn.getAttribute('data-select-wtype') as WeaponTypeId;
        sfx.playClick();
        this.renderModalContent();
      });
    });

    // 강화/인챈트 대상 무기 선택
    document.querySelectorAll('[data-pick-weapon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.isSpinning || this.pendingDecision) return;
        this.selectedWeaponId = btn.getAttribute('data-pick-weapon');
        this.enhanceResultBanner = null;
        sfx.playClick();
        this.renderModalContent();
      });
    });

    // 직원 직군 선택
    document.querySelectorAll('[data-select-srole]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.isSpinning || this.pendingDecision) return;
        this.selectedStaffRole = btn.getAttribute('data-select-srole') as StaffRoleId;
        sfx.playClick();
        this.renderModalContent();
      });
    });

    // 시설 선택
    document.querySelectorAll('[data-select-fac]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.isSpinning || this.pendingDecision) return;
        this.selectedFacilityId = btn.getAttribute('data-select-fac') as FacilityId;
        sfx.playClick();
        this.renderModalContent();
      });
    });

    // 던전 구역 선택
    document.querySelectorAll('[data-select-dungeon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedDungeonId = btn.getAttribute('data-select-dungeon') || 'dungeon_1';
        sfx.playClick();
        this.renderModalContent();
      });
    });

    // 메인 슬롯 스핀 실행 버튼 (베팅 재료 선소모 후 결과 생성 -> 채택/버리기 대기)
    const spinBtn = document.getElementById('btn-trigger-spin');
    spinBtn?.addEventListener('click', () => {
      this.handleTriggerMainSlot();
    });

    // 연속 강화 슬롯 스핀 버튼
    const enhBtn = document.getElementById('btn-trigger-enhance');
    enhBtn?.addEventListener('click', () => {
      this.handleTriggerEnhanceSlot();
    });

    // 슬롯 결과 [채택(진행)] 버튼
    const keepBtn = document.getElementById('btn-decision-keep');
    keepBtn?.addEventListener('click', () => {
      this.handleDecisionKeep();
    });

    // 슬롯 결과 [버리기(마일리지 가루 획득)] 버튼
    const discardBtn = document.getElementById('btn-decision-discard');
    discardBtn?.addEventListener('click', () => {
      this.handleDecisionDiscard();
    });

    // 요리 영웅에게 먹이기 / 판매
    document.querySelectorAll('[data-feed-dish]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-feed-dish');
        const idx = this.save.dishes.findIndex((d) => d.id === id);
        if (idx < 0) return;
        const dish = this.save.dishes[idx];
        const targetHero =
          this.save.heroes.find((h) => !h.activeMeal) || this.save.heroes[0];
        if (!targetHero) return;
        targetHero.activeMeal = dish;
        const st = getHeroCombatStats(this.save, targetHero);
        targetHero.currentHp = st.maxHp;
        this.save.dishes.splice(idx, 1);
        sfx.playSuccess();
        this.triggerActorSpeech(targetHero.id, `${dish.name} 최고!`, 'happy');
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    document.querySelectorAll('[data-sell-dish]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-sell-dish');
        const idx = this.save.dishes.findIndex((d) => d.id === id);
        if (idx < 0) return;
        const dish = this.save.dishes[idx];
        this.save.gold += dish.sellGold;
        this.save.dishes.splice(idx, 1);
        sfx.playCoin();
        this.updateTopHud();
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    // 포션 영웅에게 장착 / 판매
    document.querySelectorAll('[data-equip-potion]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-equip-potion');
        const targetHero =
          this.save.heroes.find((h) => !h.equippedPotionId) || this.save.heroes[0];
        if (!targetHero || !id) return;
        targetHero.equippedPotionId = id;
        sfx.playSuccess();
        this.triggerActorSpeech(targetHero.id, '비상 포션 준비 완료!', 'happy');
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    document.querySelectorAll('[data-sell-potion]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-sell-potion');
        const idx = this.save.potions.findIndex((p) => p.id === id);
        if (idx < 0) return;
        const pot = this.save.potions[idx];
        this.save.gold += pot.sellGold;
        this.save.potions.splice(idx, 1);
        sfx.playCoin();
        this.updateTopHud();
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    // 무기 영웅 장착 드롭다운
    document.querySelectorAll('[data-equip-weapon]').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const wpId = sel.getAttribute('data-equip-weapon');
        const heroId = (e.target as HTMLSelectElement).value || null;
        const wp = this.save.weapons.find((w) => w.id === wpId);
        if (!wp) return;

        // 기존에 이 무기를 끼고 있던 영웅 해제
        for (const h of this.save.heroes) {
          if (h.weaponId === wp.id) h.weaponId = null;
        }
        wp.equippedHeroId = heroId;
        if (heroId) {
          const hero = this.save.heroes.find((h) => h.id === heroId);
          if (hero) {
            // 그 영웅이 끼고 있던 다른 무기 해제
            for (const otherWp of this.save.weapons) {
              if (otherWp.id !== wp.id && otherWp.equippedHeroId === hero.id) {
                otherWp.equippedHeroId = null;
              }
            }
            hero.weaponId = wp.id;
            this.triggerActorSpeech(hero.id, `${wp.name} 장착!`, 'happy');
          }
        }
        sfx.playClick();
        this.syncMapActors();
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    // 영웅 골드 훈련 레벨업
    document.querySelectorAll('[data-train-hero]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hid = btn.getAttribute('data-train-hero');
        const hero = this.save.heroes.find((h) => h.id === hid);
        if (!hero) return;
        const cap = getEffectiveHeroLevelCap(this.save, hero);
        if (hero.level >= cap) {
          alert(`현재 여관 시설 레벨(Lv.${this.save.facilities.inn.level})의 레벨 상한(Lv.${cap})에 도달했습니다! 여관을 업그레이드하면 상한선이 늘어납니다.`);
          return;
        }
        const cost = hero.level * 75;
        if (this.save.gold < cost) return;
        this.save.gold -= cost;
        this.grantPartyExp([hero.id], hero.level * 50);
        sfx.playSuccess();
        this.updateTopHud();
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    document.querySelectorAll('[data-dismiss-hero]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.save.heroes.length <= 1) return;
        const hid = btn.getAttribute('data-dismiss-hero');
        this.save.heroes = this.save.heroes.filter((h) => h.id !== hid);
        this.syncMapActors();
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    // 거래처 구매 / 판매 / 마일리지 교환
    document.querySelectorAll('[data-buy-mat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mid = btn.getAttribute('data-buy-mat')!;
        const mat = MATERIAL_MAP[mid];
        if (!mat || this.save.gold < mat.buyPrice) return;
        this.save.gold -= mat.buyPrice;
        this.save.materials[mid] = (this.save.materials[mid] || 0) + 1;
        sfx.playCoin();
        this.updateTopHud();
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    document.querySelectorAll('[data-sell-mat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mid = btn.getAttribute('data-sell-mat')!;
        const mat = MATERIAL_MAP[mid];
        if (!mat || (this.save.materials[mid] || 0) <= 0) return;
        this.save.materials[mid]--;
        this.save.gold += mat.sellPrice;
        sfx.playCoin();
        this.updateTopHud();
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    document.querySelectorAll('[data-scrap-mat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mid = btn.getAttribute('data-scrap-mat')!;
        const mat = MATERIAL_MAP[mid];
        const scrapCosts: Record<RankTier, number> = { C: 8, B: 20, A: 45, S: 95 };
        const cost = scrapCosts[mat.tier];
        if (this.save.scrap < cost) return;
        this.save.scrap -= cost;
        this.save.materials[mid] = (this.save.materials[mid] || 0) + 1;
        sfx.playSuccess();
        this.updateTopHud();
        saveGameData(this.save);
        this.renderModalContent();
      });
    });

    // 던전 출발 버튼
    const launchBtn = document.getElementById('btn-launch-dungeon');
    launchBtn?.addEventListener('click', () => {
      this.startDungeonRun(this.selectedDungeonId);
      this.closeModal();
    });

    // 세이브 파일 내보내기 / 불러오기 / 초기화
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      exportSaveToJsonFile(this.save);
    });

    const importInput = document.getElementById('input-import-json') as HTMLInputElement | null;
    importInput?.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        this.save = await importSaveFromJsonFile(file);
        this.syncMapActors();
        this.updateTopHud();
        this.renderModalContent();
        alert('세이브 파일을 성공적으로 불러왔습니다!');
      } catch (e) {
        alert('세이브 파일 불러오기에 실패했습니다.');
      }
    });

    document.getElementById('btn-reset-save')?.addEventListener('click', async () => {
      if (!confirm('정말로 모든 데이터를 초기화하고 처음부터 새로 시작할까요?')) return;
      this.save = createInitialSaveData();
      await saveGameData(this.save);
      this.syncMapActors();
      this.updateTopHud();
      this.renderModalContent();
    });
  }

  private handleTriggerMainSlot(): void {
    const tab = this.activeModal;
    if (!tab) return;

    if (tab === 'inn_cook') {
      const m1 = `food_${this.betTier1.toLowerCase()}`;
      const m2 = `food_${this.betTier2.toLowerCase()}`;
      if (this.save.gold < 30) return;
      this.save.gold -= 30;
      this.save.materials[m1]--;
      this.save.materials[m2]--;

      this.executeSlotSpin(() => {
        const res = rollCookingDish(this.save, this.betTier1, this.betTier2);
        if (res.isJackpot) {
          this.save.totalJackpots++;
          sfx.playJackpot();
        } else sfx.playSlotStop();
        this.pendingDecision = {
          kind: 'cook',
          reels: res.reels,
          isJackpot: res.isJackpot,
          scrapRefund: res.scrapRefund,
          dish: res.dish,
        };
      });
    } else if (tab === 'inn_hero') {
      const goldCostMap: Record<RankTier, number> = { C: 120, B: 260, A: 520, S: 980 };
      const cost = goldCostMap[this.betTier1];
      const m1 = `food_${this.betTier1.toLowerCase()}`;
      if (this.save.gold < cost) return;
      this.save.gold -= cost;
      this.save.materials[m1]--;

      this.executeSlotSpin(() => {
        const res = rollHeroRecruitCandidate(this.save, this.betTier1);
        if (res.isJackpot) {
          this.save.totalJackpots++;
          sfx.playJackpot();
        } else sfx.playSlotStop();
        this.pendingDecision = {
          kind: 'hero',
          reels: res.reels,
          isJackpot: res.isJackpot,
          scrapRefund: res.scrapRefund,
          hero: res.hero,
        };
      });
    } else if (tab === 'bs_forge') {
      const o1 = `ore_${this.betTier1.toLowerCase()}`;
      const o2 = `ore_${this.betTier2.toLowerCase()}`;
      if (this.save.gold < 50) return;
      this.save.gold -= 50;
      this.save.materials[o1]--;
      this.save.materials[o2]--;

      this.executeSlotSpin(() => {
        const res = rollWeaponForge(
          this.save,
          this.selectedWeaponType,
          this.betTier1,
          this.betTier2
        );
        if (res.isJackpot) {
          this.save.totalJackpots++;
          sfx.playJackpot();
        } else sfx.playSlotStop();
        this.pendingDecision = {
          kind: 'forge',
          reels: res.reels,
          isJackpot: res.isJackpot,
          scrapRefund: res.scrapRefund,
          weapon: res.weapon,
        };
      });
    } else if (tab === 'bs_enchant') {
      const targetWp = this.save.weapons.find((w) => w.id === this.selectedWeaponId);
      if (!targetWp || this.save.gold < 60) return;
      const o1 = `ore_${this.betTier1.toLowerCase()}`;
      this.save.gold -= 60;
      this.save.materials[o1]--;

      this.executeSlotSpin(() => {
        const res = rollWeaponEnchant(this.save, targetWp, this.betTier1);
        if (res.isJackpot) {
          this.save.totalJackpots++;
          sfx.playJackpot();
        } else sfx.playSlotStop();
        this.pendingDecision = {
          kind: 'enchant',
          reels: res.reels,
          isJackpot: res.isJackpot,
          scrapRefund: res.scrapRefund,
          targetWeaponId: targetWp.id,
          enchants: res.enchants,
        };
      });
    } else if (tab === 'potion_brew') {
      const h1 = `herb_${this.betTier1.toLowerCase()}`;
      const h2 = `herb_${this.betTier2.toLowerCase()}`;
      if (this.save.gold < 30) return;
      this.save.gold -= 30;
      this.save.materials[h1]--;
      this.save.materials[h2]--;

      this.executeSlotSpin(() => {
        const res = rollAlchemyPotion(this.save, this.betTier1, this.betTier2);
        if (res.isJackpot) {
          this.save.totalJackpots++;
          sfx.playJackpot();
        } else sfx.playSlotStop();
        this.pendingDecision = {
          kind: 'potion',
          reels: res.reels,
          isJackpot: res.isJackpot,
          scrapRefund: res.scrapRefund,
          potion: res.potion,
        };
      });
    } else if (tab === 'staff_hire') {
      const hireGoldMap: Record<RankTier, number> = { C: 100, B: 240, A: 500, S: 950 };
      const cost = hireGoldMap[this.betTier1];
      if (this.save.gold < cost) return;
      this.save.gold -= cost;

      this.executeSlotSpin(() => {
        const res = rollStaffHireCandidate(
          this.save,
          this.selectedStaffRole,
          this.betTier1
        );
        if (res.isJackpot) {
          this.save.totalJackpots++;
          sfx.playJackpot();
        } else sfx.playSlotStop();
        this.pendingDecision = {
          kind: 'staff',
          reels: res.reels,
          isJackpot: res.isJackpot,
          scrapRefund: res.scrapRefund,
          staffCandidate: res.candidate,
        };
      });
    } else if (tab === 'facility_up') {
      const fac = this.save.facilities[this.selectedFacilityId];
      const baseCost = fac.level * 220;
      const o1 = `ore_${this.betTier1.toLowerCase()}`;
      if (this.save.gold < baseCost) return;
      this.save.gold -= baseCost;
      this.save.materials[o1]--;

      this.executeSlotSpin(() => {
        const res = rollFacilityUpgrade(
          this.save,
          this.selectedFacilityId,
          this.betTier1
        );
        if (res.greatLevelUp) {
          this.save.totalJackpots++;
          sfx.playJackpot();
        } else sfx.playSlotStop();
        this.pendingDecision = {
          kind: 'facility',
          reels: res.reels,
          isJackpot: res.greatLevelUp,
          scrapRefund: res.scrapRefund,
          facilityId: this.selectedFacilityId,
          facilityPassive: res.passive,
          greatLevelUp: res.greatLevelUp,
        };
      });
    }
  }

  private handleTriggerEnhanceSlot(): void {
    const targetWp = this.save.weapons.find((w) => w.id === this.selectedWeaponId);
    if (!targetWp || targetWp.enhanceLocked) return;
    const o1 = `ore_${this.betTier1.toLowerCase()}`;
    if (this.save.gold < 40 || (this.save.materials[o1] || 0) < 1) return;

    this.save.gold -= 40;
    this.save.materials[o1]--;

    this.executeSlotSpin(() => {
      const res = rollWeaponEnhance(this.save, targetWp, this.betTier1);
      this.spinReels = res.reels;
      targetWp.enhanceCount = res.newEnhanceCount;
      targetWp.enhanceLocked = res.locked;

      if (res.success) {
        if (res.greatSuccess) {
          sfx.playJackpot();
          this.enhanceResultBanner = `🎊 대성공 (+2강 상승!) → 현재 +${targetWp.enhanceCount}강! 계속 도전할 수 있습니다!`;
        } else {
          sfx.playSuccess();
          this.enhanceResultBanner = `✨ 강화 성공 (+1강 상승!) → 현재 +${targetWp.enhanceCount}강!`;
        }
        this.triggerActorSpeech(
          this.save.staff.enhancer.id,
          `+${targetWp.enhanceCount}강 성공!`,
          'happy'
        );
      } else {
        sfx.playFailStop();
        this.enhanceResultBanner = `🔒 아쉽게 실패! 하지만 무기는 파괴되지 않고 [ +${targetWp.enhanceCount}강 ]으로 최종 강화 확정 완료되었습니다!`;
        this.triggerActorSpeech(
          this.save.staff.enhancer.id,
          `+${targetWp.enhanceCount}강에서 확정!`,
          'normal'
        );
      }
    });
  }

  /**
   * 슬롯 결과 [채택(진행)] 처리
   */
  private handleDecisionKeep(): void {
    const pd = this.pendingDecision;
    if (!pd) return;
    sfx.playSuccess();

    if (pd.kind === 'cook' && pd.dish) {
      this.save.dishes.unshift(pd.dish);
      this.triggerActorSpeech(this.save.staff.chef.id, `${pd.dish.name} 완성!`, 'happy');
    } else if (pd.kind === 'potion' && pd.potion) {
      this.save.potions.unshift(pd.potion);
      this.triggerActorSpeech(this.save.staff.alchemist.id, `${pd.potion.name} 연성!`, 'happy');
    } else if (pd.kind === 'forge' && pd.weapon) {
      this.save.weapons.unshift(pd.weapon);
      this.selectedWeaponId = pd.weapon.id;
      this.triggerActorSpeech(this.save.staff.forger.id, `${pd.weapon.name} 제작!`, 'happy');
    } else if (pd.kind === 'enchant' && pd.enchants && pd.targetWeaponId) {
      const wp = this.save.weapons.find((w) => w.id === pd.targetWeaponId);
      if (wp) {
        wp.enchants = pd.enchants;
        this.triggerActorSpeech(this.save.staff.enchanter.id, '마법 인챈트 부여!', 'happy');
      }
    } else if (pd.kind === 'hero' && pd.hero) {
      this.save.heroes.push(pd.hero);
      this.syncMapActors();
      this.triggerActorSpeech(pd.hero.id, '여관에 합류했다!', 'happy');
    } else if (pd.kind === 'staff' && pd.staffCandidate) {
      this.save.staff[pd.staffCandidate.role] = pd.staffCandidate;
      this.syncMapActors();
      this.triggerActorSpeech(pd.staffCandidate.id, '최고의 솜씨를 보여주지!', 'happy');
    } else if (pd.kind === 'facility' && pd.facilityId && pd.facilityPassive) {
      const fac = this.save.facilities[pd.facilityId];
      fac.level += pd.greatLevelUp ? 2 : 1;
      fac.passives.push(pd.facilityPassive);
      this.spawnPop(7, 7, `${fac.name} Lv.${fac.level} 달성!`, '#fde047');
    }

    this.pendingDecision = null;
    this.updateTopHud();
    saveGameData(this.save);
    this.renderModalContent();
  }

  /**
   * 슬롯 결과 [버리기] 처리 -> 거래처 패시브 보너스를 반영해 마일리지 가루 지급!
   */
  private handleDecisionDiscard(): void {
    const pd = this.pendingDecision;
    if (!pd) return;
    sfx.playClick();

    const scrapBonusPct = this.save.facilities.trade.passives
      .filter((p) => p.bonusType === 'scrap_bonus')
      .reduce((acc, p) => acc + p.value, 0);
    const finalScrap = Math.round(pd.scrapRefund * (1 + scrapBonusPct / 100));

    this.save.scrap += finalScrap;
    this.spawnPop(10.5, 10.5, `+${finalScrap} 마일리지 가루`, '#c084fc');

    this.pendingDecision = null;
    this.updateTopHud();
    saveGameData(this.save);
    this.renderModalContent();
  }

  /**
   * 던전 원정 시작 & 상단 실시간 전투 슬롯 오버레이
   */
  public startDungeonRun(zoneId: string): void {
    const zone =
      DUNGEON_ZONES.find((z) => z.id === zoneId) || DUNGEON_ZONES[0];
    const party = this.save.heroes.slice(0, 4);
    for (const h of party) {
      const st = getHeroCombatStats(this.save, h);
      h.currentHp = st.maxHp;
    }

    const baseHp = zone.recLevel * 75 + 90;
    this.activeDungeon = {
      zoneId: zone.id,
      partyIds: party.map((h) => h.id),
      wave: 1,
      maxWaves: 3,
      waveTimer: 0,
      slotSpinTimer: 0,
      currentSlotSymbols: ['⚔️', '🛡️', '🧪'],
      lastSlotEffect: '던전 입장! 전투 슬롯이 자동으로 회전합니다!',
      monsterHp: baseHp,
      monsterMaxHp: baseHp,
      monsterName: zone.monsterNames[0],
      isBoss: false,
      accumulatedGold: 0,
      accumulatedDrops: [],
      status: 'fighting',
      rewardMultiplier: 1,
      rewardSpun: false,
      combatLogs: [`🚩 [${zone.name}] 원정대가 출발했습니다!`],
    };

    sfx.playSuccess();
    this.renderDungeonBanner();
  }

  private renderDungeonBanner(): void {
    const banner = document.getElementById('dungeon-live-panel');
    if (!banner) return;

    const run = this.activeDungeon;
    if (!run) {
      banner.classList.add('hidden');
      return;
    }
    banner.classList.remove('hidden');

    const zone =
      DUNGEON_ZONES.find((z) => z.id === run.zoneId) || DUNGEON_ZONES[0];
    const hpPct = Math.max(
      0,
      Math.min(100, Math.round((run.monsterHp / run.monsterMaxHp) * 100))
    );

    const partyBars = run.partyIds
      .map((hid) => {
        const h = this.save.heroes.find((hero) => hero.id === hid);
        if (!h) return '';
        const st = getHeroCombatStats(this.save, h);
        const pct = Math.max(0, Math.min(100, Math.round((h.currentHp / st.maxHp) * 100)));
        return `
          <div class="d-hero-mini">
            <span>${HERO_CLASS_META[h.classId].icon}${h.name}</span>
            <div class="mini-hp-bar"><div class="mini-hp-fill" style="width:${pct}%"></div></div>
          </div>
        `;
      })
      .join('');

    if (run.status === 'fighting') {
      banner.innerHTML = `
        <div class="d-live-header">
          <div>
            <span class="d-wave-pill">${zone.name} (Wave ${run.wave}/${run.maxWaves})</span>
            <strong>${run.monsterName}</strong>
          </div>
          <div class="d-mini-slot">
            <span class="d-slot-label">🎰 던전 전투 슬롯:</span>
            <span class="d-slot-reel">${run.currentSlotSymbols[0]}</span>
            <span class="d-slot-reel">${run.currentSlotSymbols[1]}</span>
            <span class="d-slot-reel">${run.currentSlotSymbols[2]}</span>
            <small class="d-slot-effect">${run.lastSlotEffect}</small>
          </div>
        </div>
        <div class="d-monster-bar-wrap">
          <div class="d-monster-bar" style="width:${hpPct}%"></div>
          <span class="d-monster-hp-text">${run.monsterHp} / ${run.monsterMaxHp} HP</span>
        </div>
        <div class="d-party-row">${partyBars}</div>
        <div class="d-log-line">${run.combatLogs[0] || ''}</div>
      `;
    } else if (run.status === 'reward_slot') {
      const dropsText = run.accumulatedDrops
        .map((d) => {
          const m = MATERIAL_MAP[d.materialId];
          return `${m.icon}${m.name} x${d.count * run.rewardMultiplier}`;
        })
        .join(', ');

      banner.innerHTML = `
        <div class="d-reward-box">
          <h4>🎉 [${zone.name}] 토벌 성공! 클리어 보상 배율 슬롯!</h4>
          <p>기본 전리품 100% 보장! 슬롯을 돌려 <strong>전리품 배율(x1.5 ~ x3 대박!)</strong>과 보너스 재료를 뽑으세요!</p>
          <div class="d-reward-preview">
            획득 예정: <strong>💰 ${Math.round(run.accumulatedGold * run.rewardMultiplier)}G</strong> |
            재료: <strong>${dropsText || '기본 재료'}</strong>
          </div>
          <div class="d-reward-actions">
            ${
              !run.rewardSpun
                ? `<button id="btn-spin-dungeon-reward" class="kairo-btn-primary">🎰 클리어 보상 슬롯 돌리기!</button>`
                : `<button id="btn-claim-dungeon-reward" class="kairo-btn-keep">✅ 보상 수령하고 여관으로 귀환 (${run.rewardMultiplier}배 당첨!)</button>`
            }
          </div>
        </div>
      `;

      document.getElementById('btn-spin-dungeon-reward')?.addEventListener('click', () => {
        const mults = [1.5, 2, 2, 3];
        const pick = mults[Math.floor(Math.random() * mults.length)];
        run.rewardMultiplier = pick;
        run.rewardSpun = true;
        if (pick >= 3) sfx.playJackpot();
        else sfx.playSuccess();
        this.renderDungeonBanner();
      });

      document.getElementById('btn-claim-dungeon-reward')?.addEventListener('click', () => {
        const finalGold = Math.round(run.accumulatedGold * run.rewardMultiplier);
        this.save.gold += finalGold;
        for (const d of run.accumulatedDrops) {
          const cnt = Math.round(d.count * run.rewardMultiplier);
          this.save.materials[d.materialId] =
            (this.save.materials[d.materialId] || 0) + cnt;
        }
        this.save.clearedDungeons[run.zoneId] =
          (this.save.clearedDungeons[run.zoneId] || 0) + 1;
        this.spawnPop(7, 2, `+${finalGold}G 원정 대성공!`, '#fde047');
        this.activeDungeon = null;
        sfx.playCoin();
        this.updateTopHud();
        saveGameData(this.save);
        this.renderDungeonBanner();
      });
    } else if (run.status === 'defeat') {
      banner.innerHTML = `
        <div class="d-reward-box">
          <h4>💦 원정대가 지쳐 여관으로 후퇴했습니다...</h4>
          <p>도중에 획득한 골드의 절반(${Math.round(run.accumulatedGold * 0.5)}G)을 챙겨 귀환합니다. 여관에서 요리를 먹이고 무기를 강화해 다시 도전하세요!</p>
          <button id="btn-close-defeat" class="kairo-btn-discard">🏠 여관으로 귀환</button>
        </div>
      `;
      document.getElementById('btn-close-defeat')?.addEventListener('click', () => {
        this.save.gold += Math.round(run.accumulatedGold * 0.5);
        this.activeDungeon = null;
        this.updateTopHud();
        saveGameData(this.save);
        this.renderDungeonBanner();
      });
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new KairoSlotInnApp();
  app.init();
});
