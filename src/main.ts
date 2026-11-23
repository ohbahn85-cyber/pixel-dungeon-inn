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
import { loadArt } from './artAtlas';
import { installKenneyReels } from './assetReels';
import { DungeonRenderer } from './dungeonRenderer';
import { HERO_WAYPOINTS, STAFF_HOME, findPath, nearestWalkable } from './innMap';
import {
  CALENDAR_WEEK_SEC,
  GUEST_INCOME_INTERVAL_SEC,
  calculateGuestIncome,
  claimDungeonDefeatGold,
  claimDungeonReward,
  createDungeonRun,
  facilityUpgradeGold,
  monsterMaxHpFor,
  spinDungeonRewardMultiplier,
  stepDungeonCombat,
} from './gameLogic';
import {
  PixelReelMachine,
  mountReelFrame,
  themeForTab,
  getEnchantRuneSprite,
  normalizeReelId,
  ReelId,
} from './reelSprites';
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
  private spinReels: [string, string, string] = ['seven', 'cherry', 'bell'];
  private pendingDecision: PendingDecision | null = null;
  private enhanceResultBanner: string | null = null;
  private reelMachine: PixelReelMachine | null = null;
  private dungeonView: DungeonRenderer | null = null;
  private watchingDungeon = false;
  private rewardSpinning = false;
  private combatReels: PixelReelMachine | null = null;

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
      else if (clicked === 'dungeon_gate') {
        if (this.activeDungeon) this.openDungeonView();
        else this.openModal('dungeon_prep');
      }
    });

    const dCanvas = document.getElementById('dungeon-canvas') as HTMLCanvasElement | null;
    if (dCanvas) {
      this.dungeonView = new DungeonRenderer(dCanvas);
      window.addEventListener('resize', () => this.dungeonView?.resize());
    }
    document.getElementById('expedition-chip')?.addEventListener('click', () => {
      sfx.playClick();
      this.openDungeonView();
    });
    document.getElementById('dungeon-back-btn')?.addEventListener('click', () => {
      sfx.playClick();
      this.closeDungeonView();
    });

    this.syncMapActors();
    this.bindUIEvents();
    this.updateTopHud();
    this.syncExpeditionChip();

    try {
      const art = await loadArt();
      installKenneyReels(art);
    } catch (err) {
      console.warn('아트 팩을 불러오지 못해 기본 그림을 씁니다', err);
    }

    if (new URLSearchParams(location.search).has('shot')) {
      (window as unknown as { __game: unknown }).__game = this.shotApi();
    }

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
      chef: { gx: STAFF_HOME.chef.gx, gy: STAFF_HOME.chef.gy, tool: '🍳', badge: '👨‍🍳요리사' },
      forger: { gx: STAFF_HOME.forger.gx, gy: STAFF_HOME.forger.gy, tool: '🔨', badge: '🔨제작' },
      enhancer: { gx: STAFF_HOME.enhancer.gx, gy: STAFF_HOME.enhancer.gy, tool: '⚒️', badge: '⚒️강화' },
      enchanter: { gx: STAFF_HOME.enchanter.gx, gy: STAFF_HOME.enchanter.gy, tool: '✨', badge: '✨인챈트' },
      alchemist: { gx: STAFF_HOME.alchemist.gx, gy: STAFF_HOME.alchemist.gy, tool: '🧪', badge: '🧪연금' },
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
          archetype: role,
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
        prev.archetype = hero.classId;
        prev.weaponType = wp?.type ?? classMeta.favWeapon;
        nextActors.push(prev);
      } else {
        const home = nearestWalkable(4 + Math.random() * 4, 5 + Math.random() * 3);
        const startX = home.x;
        const startY = home.y;
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
          speechText: '아늑하다!',
          speechTimer: 3.5,
          speechTone: 'happy',
          hairColor: hero.hairColor,
          bodyColor: hero.armorColor,
          accentColor: TIER_COLORS[hero.tier],
          weaponIcon: wp ? wp.icon : classMeta.icon,
          roleBadge: `Lv.${hero.level}`,
          bouncePhase: Math.random() * 6,
          archetype: hero.classId,
          weaponType: wp?.type ?? classMeta.favWeapon,
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

    if (this.watchingDungeon && this.dungeonView && this.activeDungeon) {
      this.dungeonView.attach(this.save, this.activeDungeon);
      this.dungeonView.render(dt, now / 1000);
    }

    requestAnimationFrame((n) => this.loop(n));
  }

  private updateCalendarAndIncome(dt: number): void {
    this.calendarAccum += dt;
    if (this.calendarAccum >= CALENDAR_WEEK_SEC) {
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

    this.guestIncomeAccum += dt;
    if (this.guestIncomeAccum >= GUEST_INCOME_INTERVAL_SEC) {
      this.guestIncomeAccum = 0;
      const baseEarn = calculateGuestIncome(this.save);
      this.save.gold += baseEarn;
      this.spawnPop(4.2, 5.2, `+${baseEarn}G`, '#fde047');
      this.updateTopHud();
    }
  }

  /**
   * 캐릭터들이 상황에 맞게 자연스럽고 부드럽게 이동하고 행동하며 카이로소프트풍 말풍선을 띄웁니다.
   */
  private updateActorsBehavior(dt: number): void {
    const waypoints = HERO_WAYPOINTS;

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

      // 영웅: 가구를 피해 타일 경로로 구역 사이를 걸어 다님
      if (actor.state === 'walk') {
        const path = actor.path || [];
        const idx = actor.pathIndex ?? 0;
        const step = path[idx];
        if (!step) {
          actor.state = 'idle';
          actor.stateTimer = 2.2 + Math.random() * 3.0;
        } else {
          const dx = step.x - actor.gridX;
          const dy = step.y - actor.gridY;
          const dist = Math.hypot(dx, dy);
          const speed = 1.85;
          if (dist <= speed * dt) {
            actor.gridX = step.x;
            actor.gridY = step.y;
            actor.pathIndex = idx + 1;
            if ((actor.pathIndex ?? 0) >= path.length) {
              actor.state = 'idle';
              actor.stateTimer = 2.2 + Math.random() * 3.0;
              actor.path = [];
            }
          } else {
            actor.gridX += (dx / dist) * speed * dt;
            actor.gridY += (dy / dist) * speed * dt;
            actor.facing = dx >= 0 ? (dy >= 0 ? 'se' : 'ne') : dy >= 0 ? 'sw' : 'nw';
          }
        }
      } else {
        actor.stateTimer -= dt;
        if (actor.stateTimer <= 0) {
          const wp = waypoints[Math.floor(Math.random() * waypoints.length)];
          const dest = nearestWalkable(
            wp.gx + (Math.random() - 0.5) * 1.2,
            wp.gy + (Math.random() - 0.5) * 1.2
          );
          actor.targetX = dest.x;
          actor.targetY = dest.y;
          actor.path = findPath(actor.gridX, actor.gridY, dest.x, dest.y);
          actor.pathIndex = 0;
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
   * 던전 전투는 공유 로직(stepDungeonCombat)으로 진행하고, 화면은 던전 뷰에 맡긴다.
   */
  private updateDungeonCombat(dt: number): void {
    const run = this.activeDungeon;
    if (!run) return;
    if (run.status !== 'fighting') {
      this.syncExpeditionChip();
      return;
    }

    const outcome = stepDungeonCombat(this.save, run, dt);
    if (this.watchingDungeon) {
      this.dungeonView?.attach(this.save, run);
      this.dungeonView?.pushOutcome(outcome);
    }
    if (outcome.slotTriggered) {
      this.dungeonView?.spinCombatReels(run.currentSlotSymbols);
      const faces = run.currentSlotSymbols.map((sym) => normalizeReelId(sym, 'combat'));
      this.combatReels?.spinTo(faces, outcome.slotType === 'jackpot', () => {});
      if (outcome.slotType === 'jackpot') sfx.playSuccess();
    }
    for (const lv of outcome.leveledUpHeroes) {
      this.triggerActorSpeech(lv.heroId, `Lv.${lv.newLevel}`, 'happy');
    }
    if (outcome.statusChanged === 'reward_slot') {
      sfx.playSuccess();
      this.renderDungeonHud();
    } else if (outcome.statusChanged === 'defeat') {
      sfx.playFailStop();
      this.renderDungeonHud();
    }
    this.syncExpeditionChip();
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
    this.reelMachine?.destroy();
    this.reelMachine = null;
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.add('hidden');
  }

  /**
   * 3번 규칙: 먼저 투입할 재료/비용 등급을 베팅하여 릴 확률을 높인 뒤 스핀!
   * 결과가 나오면 [채택(진행)]할지 [버리기(마일리지 가루 획득)]할지 결정!
   */
  private executeSlotSpin(
    finalReels: [string, string, string],
    isJackpot: boolean,
    onComplete: () => void
  ): void {
    if (this.isSpinning) return;
    this.isSpinning = true;
    this.save.totalSlotSpins++;
    sfx.playSlotTick();
    const theme = themeForTab(this.activeModal);
    const host = document.getElementById('slot-reels-host');
    if (host && !this.reelMachine) {
      this.reelMachine = mountReelFrame(host, finalReels, theme);
    }
    document.getElementById('btn-trigger-spin')?.setAttribute('disabled', 'true');
    const start = performance.now();
    const tickSfx = window.setInterval(() => sfx.playSlotTick(), 90);
    this.reelMachine?.spinTo(finalReels as ReelId[], isJackpot, () => {
      window.clearInterval(tickSfx);
      this.isSpinning = false;
      this.spinReels = finalReels;
      if (isJackpot) sfx.playJackpot();
      else sfx.playSlotStop();
      onComplete();
      this.updateTopHud();
      saveGameData(this.save);
      this.renderModalContent();
      void start;
    });
  }

  private mountModalReels(): void {
    this.reelMachine?.destroy();
    this.reelMachine = null;
    const host = document.getElementById('slot-reels-host');
    if (!host) return;
    const theme = themeForTab(this.activeModal);
    const symbols = (this.pendingDecision?.reels || this.spinReels) as string[];
    this.reelMachine = mountReelFrame(host, symbols, theme, {
      jackpot: !!this.pendingDecision?.isJackpot,
    });
  }

  private bindEnchantTooltips(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-rune-id]').forEach((el) => {
      const canvas = el.querySelector('canvas');
      const id = el.getAttribute('data-rune-id') || '';
      if (canvas) {
        const spr = getEnchantRuneSprite(id);
        canvas.width = spr.width * 2;
        canvas.height = spr.height * 2;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(spr, 0, 0, canvas.width, canvas.height);
        }
      }
    });
    let tip = document.getElementById('kairo-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'kairo-tip';
      tip.className = 'hidden';
      document.body.appendChild(tip);
    }
    const show = (el: HTMLElement, ev: PointerEvent) => {
      const text = el.getAttribute('data-tip');
      if (!text || !tip) return;
      tip.textContent = text;
      tip.classList.remove('hidden');
      const r = el.getBoundingClientRect();
      tip.style.left = `${Math.round(r.left + r.width / 2)}px`;
      tip.style.top = `${Math.round(r.top - 8)}px`;
      void ev;
    };
    const hide = () => tip?.classList.add('hidden');
    root.querySelectorAll<HTMLElement>('[data-tip]').forEach((el) => {
      el.addEventListener('pointerenter', (ev) => show(el, ev));
      el.addEventListener('pointerleave', hide);
      let hold: number | null = null;
      el.addEventListener('pointerdown', (ev) => {
        hold = window.setTimeout(() => show(el, ev), 380);
      });
      el.addEventListener('pointerup', () => {
        if (hold) window.clearTimeout(hold);
      });
      el.addEventListener('pointercancel', hide);
    });
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
      titleEl.textContent = '요리';
      bodyEl.innerHTML = this.buildInnCookHTML();
    } else if (tab === 'inn_hero') {
      titleEl.textContent = '영웅';
      bodyEl.innerHTML = this.buildInnHeroHTML();
    } else if (tab === 'bs_forge') {
      titleEl.textContent = '제작';
      bodyEl.innerHTML = this.buildBlacksmithForgeHTML();
    } else if (tab === 'bs_enhance') {
      titleEl.textContent = '강화';
      bodyEl.innerHTML = this.buildBlacksmithEnhanceHTML();
    } else if (tab === 'bs_enchant') {
      titleEl.textContent = '인챈트';
      bodyEl.innerHTML = this.buildBlacksmithEnchantHTML();
    } else if (tab === 'potion_brew') {
      titleEl.textContent = '포션';
      bodyEl.innerHTML = this.buildPotionBrewHTML();
    } else if (tab === 'trade_market') {
      titleEl.textContent = '거래처';
      bodyEl.innerHTML = this.buildTradeMarketHTML();
    } else if (tab === 'staff_hire') {
      titleEl.textContent = '직원';
      bodyEl.innerHTML = this.buildStaffHireHTML();
    } else if (tab === 'facility_up') {
      titleEl.textContent = '시설';
      bodyEl.innerHTML = this.buildFacilityUpHTML();
    } else if (tab === 'dungeon_prep') {
      titleEl.textContent = '던전';
      bodyEl.innerHTML = this.buildDungeonPrepHTML();
    } else if (tab === 'save_manage') {
      titleEl.textContent = '저장';
      bodyEl.innerHTML = this.buildSaveManageHTML();
    }

    this.attachModalInnerHandlers();
    this.mountModalReels();
    const bodyEl2 = document.getElementById('modal-body');
    if (bodyEl2) this.bindEnchantTooltips(bodyEl2);
  }

  private renderSlotMachineWidget(
    probs: { C: number; B: number; A: number; S: number },
    staff: StaffMember,
    costDesc: string,
    canSpin: boolean,
    spinBtnLabel: string
  ): string {
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

        <div class="slot-reels-frame" id="slot-reels-host"></div>

        ${
          this.pendingDecision
            ? this.buildPendingDecisionHTML(this.pendingDecision)
            : `
          <div class="slot-action-bar">
            <div class="slot-cost-label">${costDesc}</div>
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
          <p class="result-desc">ATK +${pd.weapon.baseAtk}</p>
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
          <p class="result-desc">HP ${pd.hero.baseHp} · ATK ${pd.hero.baseAtk} · DEF ${pd.hero.baseDef} · 상한 ${pd.hero.maxLevelCap} / 해금 ${cap}</p>
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
          <p class="result-desc">행운 +${st.bonusProb}% · ${st.specialtyLabel}
          <small>현재 [${cur.tier}] ${cur.name} +${cur.bonusProb}%</small></p>
        </div>
      `;
    } else if (pd.kind === 'facility' && pd.facilityPassive && pd.facilityId) {
      const p = pd.facilityPassive;
      summaryHTML = `
        <div class="result-card tier-border-${p.tier}">
          <div class="result-title">
            <span class="tier-pill tier-${p.tier}">${p.tier}급 특성</span>
            <strong>${pd.greatLevelUp ? '+2Lv ' : '+1Lv '}${p.name}</strong>
          </div>
          <p class="result-desc">${p.desc}</p>
        </div>
      `;
    }

    return `
      <div class="decision-box">
        ${pd.isJackpot ? `<div class="jackpot-banner">777</div>` : ''}
        ${summaryHTML}
        <div class="decision-buttons">
          <button id="btn-decision-keep" class="kairo-btn-keep">채택</button>
          <button id="btn-decision-discard" class="kairo-btn-discard">버리기 +${pd.scrapRefund}</button>
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
        <div class="bet-row-label">재료 1</div>
        <div class="bet-grid">${buildRow(1, this.betTier1)}</div>
        ${
          dualSlot
            ? `
          <div class="bet-row-label" style="margin-top:8px;">재료 2</div>
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
        ? `<div class="empty-hint">요리 없음</div>`
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
              <button class="kairo-btn-mini" data-feed-dish="${d.id}">먹이기</button>
              <button class="kairo-btn-mini gold" data-sell-dish="${d.id}">판매 +${d.sellGold}G</button>
            </div>
          </div>
        `
            )
            .join('');

    return `
      ${this.buildMaterialBetSelectorHTML('food', true)}
      ${this.renderSlotMachineWidget(probs, chef, costDesc, canSpin, '돌리기')}
      <div class="section-divider">요리 ${this.save.dishes.length}</div>
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
          : '요리 없음';
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
      ${this.buildMaterialBetSelectorHTML('food', false)}
      ${this.renderSlotMachineWidget(probs, chef, costDesc, canSpin, '돌리기')}
      <div class="section-divider">영웅 ${this.save.heroes.length}</div>
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
        <button class="subtab-btn active" data-goto-tab="bs_forge">제작</button>
        <button class="subtab-btn" data-goto-tab="bs_enhance">강화</button>
        <button class="subtab-btn" data-goto-tab="bs_enchant">인챈트</button>
      </div>
      <div class="bet-row-label">무기</div>
      <div class="weapon-type-grid">${weaponTypeBtns}</div>
      ${this.buildMaterialBetSelectorHTML('ore', true)}
      ${this.renderSlotMachineWidget(probs, forger, costDesc, canSpin, '돌리기')}
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
        <button class="subtab-btn" data-goto-tab="bs_forge">제작</button>
        <button class="subtab-btn active" data-goto-tab="bs_enhance">강화</button>
        <button class="subtab-btn" data-goto-tab="bs_enchant">인챈트</button>
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
              <span class="prob-chip tier-S">+${targetWp.enhanceCount} · ${rate}%</span>
            </div>
          </div>

          <div class="slot-reels-frame" id="slot-reels-host"></div>

          ${
            this.enhanceResultBanner
              ? `<div class="enhance-banner">${this.enhanceResultBanner}</div>`
              : ''
          }

          <div class="slot-action-bar">
            <div class="slot-cost-label">
              ${
                targetWp.enhanceLocked
                  ? `🔒 +${targetWp.enhanceCount} 확정`
                  : `40G + ${MATERIAL_MAP[oreId].icon} 1`
              }
            </div>
            ${
              targetWp.enhanceLocked
                ? `<button class="kairo-btn-primary" data-goto-tab="bs_enchant">인챈트</button>`
                : `<button id="btn-trigger-enhance" class="kairo-btn-primary ${!canSpin ? 'disabled' : ''}" ${!canSpin ? 'disabled' : ''}>강화 +${targetWp.enhanceCount}</button>`
            }
          </div>
        </div>
      `
          : `<div class="empty-hint">무기 없음</div>`
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

    const maxRange = preview
      ? Math.max(...preview.ranges.map((r) => r.maxVal), 1)
      : 1;
    const runes = preview
      ? preview.ranges
          .map((r) => {
            const w = Math.max(8, Math.round((r.maxVal / maxRange) * 100));
            const tip = `${r.name} ${r.statLabel}${r.minVal}–${r.maxVal}`;
            return `
          <button type="button" class="enchant-rune" data-rune-id="${r.id}" data-tip="${tip}" style="--rune:${r.color}">
            <canvas width="24" height="24"></canvas>
            <span class="rune-bar"><i style="width:${w}%"></i></span>
            <small>${r.minVal}–${r.maxVal}</small>
          </button>`;
          })
          .join('')
      : '';

    const slimCost = targetWp
      ? `60G + ${MATERIAL_MAP[oreId].icon}`
      : costDesc;

    return `
      <div class="subtab-bar">
        <button class="subtab-btn" data-goto-tab="bs_forge">제작</button>
        <button class="subtab-btn" data-goto-tab="bs_enhance">강화</button>
        <button class="subtab-btn active" data-goto-tab="bs_enchant">인챈트</button>
      </div>

      ${this.buildWeaponSelectorDropdown(targetWp)}
      ${this.buildMaterialBetSelectorHTML('ore', false)}

      ${
        targetWp && preview
          ? `
        <div class="enchant-preview-box">
          <div class="enchant-compact-head">
            <span class="ench-plus">+${targetWp.enhanceCount}</span>
            <span class="ench-slots" title="옵션 ${preview.slotCount}줄">${'●'.repeat(preview.slotCount)}${'○'.repeat(4 - preview.slotCount)}</span>
          </div>
          <div class="enchant-rune-row">${runes}</div>
        </div>
        ${this.renderSlotMachineWidget(probs, enchanter, slimCost, canSpin, '돌리기')}
      `
          : `<div class="empty-hint">무기 없음</div>`
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
          <button class="weapon-pick-chip ${active} tier-border-${w.tier}" data-pick-weapon="${w.id}" title="${w.name} ${w.tier} 공격 ${Math.round(w.baseAtk * (1 + w.enhanceCount * 0.18))}">
            <span>${w.icon} +${w.enhanceCount}${w.enhanceLocked ? ' 🔒' : ''}</span>
          </button>
        `;
      })
      .join('');
    return `
      <div class="bet-row-label">무기</div>
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
      <div class="section-divider">무기 ${this.save.weapons.length}</div>
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
        ? `<div class="empty-hint">포션 없음</div>`
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
              <button class="kairo-btn-mini gold" data-sell-potion="${p.id}">판매 +${p.sellGold}G</button>
            </div>
          </div>
        `
            )
            .join('');

    return `
      ${this.buildMaterialBetSelectorHTML('herb', true)}
      ${this.renderSlotMachineWidget(probs, alch, costDesc, canSpin, '돌리기')}
      <div class="section-divider">포션 ${this.save.potions.length}</div>
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
            <button class="kairo-btn-mini" data-buy-mat="${m.id}" ${this.save.gold < m.buyPrice ? 'disabled' : ''}>사기 ${m.buyPrice}G</button>
            <button class="kairo-btn-mini gold" data-sell-mat="${m.id}" ${count <= 0 ? 'disabled' : ''}>팔기 +${m.sellPrice}G</button>
            <button class="kairo-btn-mini purple" data-scrap-mat="${m.id}" ${this.save.scrap < scCost ? 'disabled' : ''}>가루 ${scCost}</button>
          </div>
        </div>
      `;
    }).join('');

    return `
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
            <strong>${t}</strong>
            <small>${hireGoldMap[t]}G</small>
          </div>
        </button>
      `
      )
      .join('');

    const cost = hireGoldMap[this.betTier1];
    const canSpin = this.save.gold >= cost;

    return `
      <div class="staff-role-grid">${roleBtns}</div>
      <div class="bet-row-label">등급</div>
      <div class="bet-grid">${betTierBtns}</div>
      ${this.renderSlotMachineWidget(probs, curStaff, `${cost}G`, canSpin, '돌리기')}
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
    const baseCost = facilityUpgradeGold(fac.level);
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
        ? `<div class="empty-hint">특성 없음</div>`
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
      <div class="staff-role-grid">${facBtns}</div>
      ${this.buildMaterialBetSelectorHTML('ore', false)}
      ${this.renderSlotMachineWidget(probs, this.save.staff.forger, costDesc, canSpin, '돌리기')}
      <div class="section-divider">${fac.name} 특성 ${fac.passives.length}</div>
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
      <div class="bet-row-label">구역</div>
      <div class="dungeon-zone-grid">${zoneCards}</div>

      <div class="section-divider">파티</div>
      <div class="party-chip-grid">${partySummary}</div>

      <div class="slot-action-bar" style="margin-top:14px;">
        <button id="btn-launch-dungeon" class="kairo-btn-primary">출정</button>
      </div>
    `;
  }

  /**
   * 11. 데이터 저장 관리 (IndexedDB + LocalStorage 이중 자동저장 & JSON 내보내기/불러오기)
   */
  private buildSaveManageHTML(): string {
    return `
      <div class="save-actions-box">
        <button id="btn-export-json" class="kairo-btn-keep">내보내기</button>
        <label class="kairo-btn-primary" style="cursor:pointer;">
          불러오기
          <input type="file" id="input-import-json" accept=".json" style="display:none;" />
        </label>
        <button id="btn-reset-save" class="kairo-btn-discard">새로 시작</button>
      </div>
      <div class="credits-box">
        <p>도트 에셋 · 전부 CC0</p>
        <ul>
          <li>Kenney Vleugels · Roguelike Indoor · <a href="https://kenney.nl" target="_blank" rel="noreferrer">kenney.nl</a></li>
          <li>Kenney · Lynn Evers · Roguelike / RPG · <a href="https://kenney.nl" target="_blank" rel="noreferrer">kenney.nl</a></li>
          <li>Kenney · Roguelike Caves · <a href="https://kenney.nl" target="_blank" rel="noreferrer">kenney.nl</a></li>
          <li>Kenney · Tiny Dungeon · <a href="https://kenney.nl" target="_blank" rel="noreferrer">kenney.nl</a></li>
          <li>Kenney · Lynn Evers · Pixel UI · <a href="https://kenney.nl" target="_blank" rel="noreferrer">kenney.nl</a></li>
        </ul>
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

      const res = rollCookingDish(this.save, this.betTier1, this.betTier2);
      this.executeSlotSpin(res.reels, res.isJackpot, () => {
        if (res.isJackpot) this.save.totalJackpots++;
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

      const res = rollHeroRecruitCandidate(this.save, this.betTier1);
      this.executeSlotSpin(res.reels, res.isJackpot, () => {
        if (res.isJackpot) this.save.totalJackpots++;
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

      const res = rollWeaponForge(
          this.save,
          this.selectedWeaponType,
          this.betTier1,
          this.betTier2
        );
      this.executeSlotSpin(res.reels, res.isJackpot, () => {
        if (res.isJackpot) this.save.totalJackpots++;
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

      const res = rollWeaponEnchant(this.save, targetWp, this.betTier1);
      this.executeSlotSpin(res.reels, res.isJackpot, () => {
        if (res.isJackpot) this.save.totalJackpots++;
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

      const res = rollAlchemyPotion(this.save, this.betTier1, this.betTier2);
      this.executeSlotSpin(res.reels, res.isJackpot, () => {
        if (res.isJackpot) this.save.totalJackpots++;
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

      const res = rollStaffHireCandidate(
          this.save,
          this.selectedStaffRole,
          this.betTier1
        );
      this.executeSlotSpin(res.reels, res.isJackpot, () => {
        if (res.isJackpot) this.save.totalJackpots++;
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
      const baseCost = facilityUpgradeGold(fac.level);
      const o1 = `ore_${this.betTier1.toLowerCase()}`;
      if (this.save.gold < baseCost) return;
      this.save.gold -= baseCost;
      this.save.materials[o1]--;

      const res = rollFacilityUpgrade(
          this.save,
          this.selectedFacilityId,
          this.betTier1
        );
      this.executeSlotSpin(res.reels, !!res.greatLevelUp, () => {
        if (res.greatLevelUp) this.save.totalJackpots++;
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

    const res = rollWeaponEnhance(this.save, targetWp, this.betTier1);
    this.executeSlotSpin(res.reels, res.greatSuccess, () => {
      targetWp.enhanceCount = res.newEnhanceCount;
      targetWp.enhanceLocked = res.locked;

      if (res.success) {
        this.enhanceResultBanner = res.greatSuccess
          ? `+2 → +${targetWp.enhanceCount}`
          : `+1 → +${targetWp.enhanceCount}`;
        this.triggerActorSpeech(
          this.save.staff.enhancer.id,
          `+${targetWp.enhanceCount}`,
          'happy'
        );
      } else {
        sfx.playFailStop();
        this.enhanceResultBanner = `🔒 +${targetWp.enhanceCount}`;
        this.triggerActorSpeech(
          this.save.staff.enhancer.id,
          `+${targetWp.enhanceCount}`,
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
      this.spawnPop(6.5, 7.2, `${fac.name} Lv.${fac.level}`, '#fde047');
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
    this.spawnPop(8.6, 8.4, `+${finalScrap} 가루`, '#c084fc');

    this.pendingDecision = null;
    this.updateTopHud();
    saveGameData(this.save);
    this.renderModalContent();
  }

  /**
   * 던전 원정 시작. 여관 맵의 작은 표시와 함께 던전 장면을 연다.
   */
  public startDungeonRun(zoneId: string): void {
    this.activeDungeon = createDungeonRun(this.save, zoneId);
    sfx.playSuccess();
    this.closeModal();
    this.openDungeonView();
    this.syncExpeditionChip();
    this.renderDungeonHud();
  }

  public openDungeonView(): void {
    if (!this.activeDungeon) return;
    this.watchingDungeon = true;
    const stage = document.getElementById('dungeon-stage');
    stage?.classList.remove('hidden');
    this.syncCombatReelBar();
    this.dungeonView?.resize();
    this.dungeonView?.attach(this.save, this.activeDungeon, true);
    this.renderDungeonHud();
    this.syncExpeditionChip();
  }

  public closeDungeonView(): void {
    this.watchingDungeon = false;
    document.getElementById('dungeon-stage')?.classList.add('hidden');
    this.syncCombatReelBar();
    this.syncExpeditionChip();
  }

  private syncCombatReelBar(): void {
    const bar = document.getElementById('dungeon-reel-bar');
    const host = document.getElementById('combat-reels-host');
    if (!bar || !host) return;
    if (!this.watchingDungeon || !this.activeDungeon) {
      bar.classList.add('hidden');
      this.combatReels?.destroy();
      this.combatReels = null;
      return;
    }
    bar.classList.remove('hidden');
    const faces = this.activeDungeon.currentSlotSymbols.map((sym) =>
      normalizeReelId(sym, 'combat')
    ) as ReelId[];
    this.combatReels?.destroy();
    this.combatReels = mountReelFrame(host, faces, 'combat');
  }

  private syncExpeditionChip(): void {
    const chip = document.getElementById('expedition-chip');
    if (!chip) return;
    const run = this.activeDungeon;
    const show = !!run && !this.watchingDungeon;
    chip.classList.toggle('hidden', !show);
    chip.classList.toggle('is-fighting', run?.status === 'fighting');
    const wave = chip.querySelector('.exp-wave');
    if (wave && run) wave.textContent = `${run.wave}/${run.maxWaves}`;
  }

  private renderDungeonHud(): void {
    const hud = document.getElementById('dungeon-hud');
    if (!hud) return;
    const run = this.activeDungeon;
    if (!run || !this.watchingDungeon) {
      hud.innerHTML = '';
      hud.classList.add('hidden');
      return;
    }
    hud.classList.remove('hidden');

    if (run.status === 'fighting') {
      hud.innerHTML = '';
      return;
    }

    if (run.status === 'reward_slot') {
      const gold = Math.round(run.accumulatedGold * run.rewardMultiplier);
      hud.innerHTML = `
        <div class="d-reward-box">
          <div id="reward-reels-host" class="slot-reels-frame reward-reels"></div>
          <div class="d-reward-preview"><strong>${gold}G</strong></div>
          <div class="d-reward-actions">
            ${
              !run.rewardSpun
                ? `<button id="btn-spin-dungeon-reward" class="kairo-btn-primary">×?</button>`
                : `<button id="btn-claim-dungeon-reward" class="kairo-btn-keep">×${run.rewardMultiplier}</button>`
            }
          </div>
        </div>
      `;
      const host = document.getElementById('reward-reels-host');
      const face =
        run.rewardSpun
          ? run.rewardMultiplier >= 3
            ? (['seven', 'seven', 'seven'] as ReelId[])
            : run.rewardMultiplier >= 2
              ? (['x2', 'x2', 'x2'] as ReelId[])
              : (['x15', 'x15', 'x15'] as ReelId[])
          : (['x15', 'x2', 'x3'] as ReelId[]);
      if (host) {
        const machine = mountReelFrame(host, face, 'reward', {
          jackpot: run.rewardSpun && run.rewardMultiplier >= 3,
        });
        (hud as unknown as { _reels?: PixelReelMachine })._reels?.destroy();
        (hud as unknown as { _reels?: PixelReelMachine })._reels = machine;
      }
      document.getElementById('btn-spin-dungeon-reward')?.addEventListener('click', () => {
        if (this.rewardSpinning) return;
        this.rewardSpinning = true;
        const pick = spinDungeonRewardMultiplier(run);
        const faces: ReelId[] =
          pick >= 3 ? ['seven', 'seven', 'seven'] : pick >= 2 ? ['x2', 'x2', 'x2'] : ['x15', 'x15', 'x15'];
        const host2 = document.getElementById('reward-reels-host');
        const machine = host2
          ? mountReelFrame(host2, ['x15', 'x2', 'seven'], 'reward')
          : null;
        machine?.spinTo(faces, pick >= 3, () => {
          this.rewardSpinning = false;
          if (pick >= 3) sfx.playJackpot();
          else sfx.playSuccess();
          this.renderDungeonHud();
        });
      });
      document.getElementById('btn-claim-dungeon-reward')?.addEventListener('click', () => {
        const { finalGold } = claimDungeonReward(this.save, run);
        this.spawnPop(7, 2, `+${finalGold}G`, '#fde047');
        this.activeDungeon = null;
        sfx.playCoin();
        this.updateTopHud();
        saveGameData(this.save);
        this.closeDungeonView();
        this.syncExpeditionChip();
      });
      return;
    }

    if (run.status === 'defeat') {
      const half = Math.round(run.accumulatedGold * 0.5);
      hud.innerHTML = `
        <div class="d-reward-box">
          <div class="d-reward-preview"><strong>${half}G</strong></div>
          <button id="btn-close-defeat" class="kairo-btn-discard">귀환</button>
        </div>
      `;
      document.getElementById('btn-close-defeat')?.addEventListener('click', () => {
        claimDungeonDefeatGold(this.save, run);
        this.activeDungeon = null;
        this.updateTopHud();
        saveGameData(this.save);
        this.closeDungeonView();
        this.syncExpeditionChip();
      });
    }
  }

  private shotApi() {
    return {
      openTab: (tab: ModalTab) => this.openModal(tab),
      startZone: (id: string) => {
        this.startDungeonRun(id);
      },
      forceReward: () => {
        if (!this.activeDungeon) this.startDungeonRun('dungeon_1');
        const run = this.activeDungeon!;
        run.status = 'reward_slot';
        run.accumulatedGold = Math.max(run.accumulatedGold, 200);
        run.rewardSpun = false;
        this.openDungeonView();
        this.renderDungeonHud();
      },
      forceBoss: (id: string) => {
        this.startDungeonRun(id);
        const run = this.activeDungeon!;
        const zone = DUNGEON_ZONES.find((z) => z.id === id) || DUNGEON_ZONES[0];
        run.wave = run.maxWaves;
        run.isBoss = true;
        run.monsterName = zone.bossName;
        run.monsterMaxHp = monsterMaxHpFor(zone.recLevel, true);
        run.monsterHp = run.monsterMaxHp;
        run.status = 'fighting';
        this.dungeonView?.attach(this.save, run, true);
        this.renderDungeonHud();
      },
      spinCurrent: () => {
        const btn = document.getElementById('btn-trigger-spin') as HTMLButtonElement | null;
        btn?.click();
      },
      worldPoint: (gx: number, gy: number, gz = 0) => this.renderer.isoToScreen(gx, gy, gz),
    };
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new KairoSlotInnApp();
  app.init();
});
