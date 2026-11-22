import './style.css';
import {
  GUEST_TYPES,
  INN_LEVELS,
  OPTIONAL_QUESTS,
  UPGRADES,
  getUpgradeCost,
} from './data';
import { formatDuration, formatGold, formatSignedGold } from './format';
import { DungeonInnGame, OfflineReport } from './game';
import {
  BASE_ENHANCE_RATES,
  BLACKSMITH_TOOLS,
  DUNGEONS,
  DUNGEON_MAP,
  EQUIPMENT_DEFS,
  EQUIPMENT_DEF_MAP,
  EQUIP_SLOT_LABELS,
  HERO_CLASSES,
  HERO_ROSTER,
  HERO_ROSTER_MAP,
  MATERIALS,
  MATERIAL_MAP,
  ORIGINS,
  PERSONALITIES,
  POTION_RECIPES,
  POTION_TOOLS,
  RARITY_INFO,
  getHeroRequiredXp,
  getInnUpgradeMaterialRequirements,
} from './loopData';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DungeonExpeditionRenderer,
  InnRenderer,
} from './renderer';
import { getGuestPortraitDataUrl, getHeroPortraitDataUrl } from './sprites';
import {
  canClassEquip,
  evaluatePartyForDungeon,
  getEquipmentEffectiveStats,
  getHeroStatBreakdown,
  getWearableClassesText,
  selectBestPartyForDungeon,
} from './synergy';
import {
  DailyFinancialReport,
  EquipSlot,
  HeroClassId,
  HeroState,
  UpgradeCategory,
  UpgradeDef,
} from './types';

type ActiveTab =
  | 'goals'
  | 'stats'
  | 'heroes'
  | 'trade'
  | 'dungeon'
  | 'potion'
  | 'blacksmith'
  | UpgradeCategory
  | 'codex';

const TAB_SUMMARIES: Record<ActiveTab, string> = {
  goals:
    '🏆 여관 등급(Lv.1~Lv.8) 승급 공개 목표와 선택 퀘스트/업적 현황입니다. 최종 목표인 [고대 용왕의 화산 둥지]를 격파하고 왕국 최고의 여관에 등극하세요!',
  stats:
    '📊 오늘 실시간 장부(항목별 수입·급료·유지비·전리품 매입)와 최근 일별 수입·지출·순이익 비교 차트입니다.',
  heroes:
    '🦸 고유 이름을 지닌 9직업 30명의 영웅 명부입니다. 맵이나 명단에서 영웅을 탭하면 우측 서랍에서 상태를 확인하고 행동을 직접 지시할 수 있습니다.',
  trade:
    '💎 상점 판매가(요리·포션·장비)와 전리품 매입 시세/품목을 설정하세요. 영웅들이 스스로 걸어가 소비할 때만 여관이 골드를 법니다.',
  dungeon:
    '🗺️ 7개 갈래 방 던전의 요구 스탯과 출발 전 파티 시너지(역할 삼각 진형, 성격 궁합/충돌, 출신 세트)를 확인하고 원정대를 파견합니다.',
  potion:
    '⚗️ 연금 도구와 약초 정원·작업실을 건설하고 8종의 포션을 조제합니다. 판매 등록된 포션은 영웅들이 걸어와 구매합니다.',
  blacksmith:
    '⚒️ 드워프 화로와 모루로 직업별 장비를 단조하고 +1~+15 강화를 시도합니다. (⚠️ +강화 실패 시 장비 완전 파괴 → 기본 장비 복귀)',
  menu: '🍲 따뜻한 수프와 스튜, 에일, 만찬을 보유 골드로 개발하여 서빙 수익과 영웅 식사 버프를 높입니다.',
  room: '🛏️ 2층 침대와 객실을 확충하여 숙박 수입과 영웅 부상/피로 수면 회복 속도를 높입니다.',
  staff:
    '🧑‍🍳 메이드·바텐더·요리사·음유시인을 고용하면 자동 서빙과 품질을 높여 주며, 매일 일일 결산 시 급료(일당)가 지급됩니다.',
  facility:
    '🏛️ 게시판·간이 대장간·오르골·비밀금고·온천탕을 설치하여 여관에 특별 보너스를 부여합니다. (일일 유지비 발생)',
  codex:
    '🛡️ 여관을 방문하는 손님 도감입니다. 손님 서빙은 초당 자동이 아니라 서빙 행위당 수입으로 정산됩니다.',
};

class InnAppController {
  private game: DungeonInnGame;
  private renderer: InnRenderer;
  private dungeonRenderer: DungeonExpeditionRenderer;
  private canvas: HTMLCanvasElement;
  private dungeonCanvas: HTMLCanvasElement;
  private activeTab: ActiveTab = 'goals';
  private isDrawerOpen = false;
  private isDungeonOverlayHiddenByUser = false;
  private lastFrameTime = performance.now();
  private uiRefreshAccumulator = 0;
  private lastLogTopId = -1;
  private lastFloorLogTopId = -1;
  private lastRenderedEventPromptId: string | null = null;
  private mapZoomExpanded = false;

  // 던전 탭 파티 편성 상태
  private selectedDungeonId = 'dungeon_slime';
  private selectedPartyHeroIds: string[] = [];
  private heroFilterClass: HeroClassId | 'all' = 'all';

  // 영웅 지시 패널 드롭다운 선택 상태
  private orderPotionId = 'potion_heal_minor';
  private orderDungeonId = 'dungeon_slime';

  // +강화 확인 모달 대기 타겟
  private pendingEnhanceTarget: {
    heroId?: string;
    slot?: EquipSlot;
    stockUid?: number;
  } | null = null;

  // DOM 참조
  private elLevelBadge = document.getElementById('inn-level-badge')!;
  private elDayClock = document.getElementById('stat-day-clock')!;
  private elRepText = document.getElementById('inn-rep-text')!;
  private elHeroBadge = document.getElementById('inn-hero-badge')!;
  private elGold = document.getElementById('stat-gold')!;
  private elTodayProfit = document.getElementById('stat-today-profit')!;
  private elDailyFixed = document.getElementById('stat-daily-fixed')!;
  private elGoalFill = document.getElementById('goal-progress-fill')!;
  private elNextGoal = document.getElementById('next-goal-text')!;
  private elHudGoalChips = document.getElementById('hud-goal-chips')!;

  private elEventBanner = document.getElementById('active-event-banner')!;
  private elEventTitle = document.getElementById('event-banner-title')!;
  private elEventTimer = document.getElementById('event-banner-timer')!;
  private elEventDesc = document.getElementById('event-banner-desc')!;

  private elHeroInspector = document.getElementById('hero-inspector-panel')!;
  private elDungeonPanel = document.getElementById('dungeon-expedition-panel')!;
  private elBtnShowDungeon = document.getElementById(
    'btn-show-dungeon-overlay'
  )!;
  private elDungeonPartyTabs = document.getElementById('dungeon-party-tabs')!;
  private elDungeonEventBox = document.getElementById(
    'dungeon-event-choice-box'
  )!;
  private elDungeonFloorLogs = document.getElementById(
    'dungeon-floor-log-list'
  )!;

  private elServeBtnLabel = document.getElementById('serve-btn-label')!;
  private elEventBtn = document.getElementById(
    'btn-random-event'
  ) as HTMLButtonElement;
  private elEventBtnLabel = document.getElementById('event-btn-label')!;

  private elLiveStrip = document.getElementById('live-status-strip')!;
  private elServedSummary = document.getElementById('stat-served-summary')!;
  private elLogList = document.getElementById('inn-log-list')!;

  private elManagementDrawer = document.getElementById('management-drawer')!;
  private elCategorySummary = document.getElementById('category-summary-bar')!;
  private elUpgradeList = document.getElementById('upgrade-list')!;

  private elSoundBtn = document.getElementById(
    'btn-sound'
  ) as HTMLButtonElement;
  private elDailyReportModal = document.getElementById('daily-report-modal')!;
  private elOfflineModal = document.getElementById('offline-modal')!;
  private elEnhanceModal = document.getElementById('enhance-modal')!;
  private elMigrationModal = document.getElementById('migration-modal')!;
  private elHelpModal = document.getElementById('help-modal')!;
  private elResetModal = document.getElementById('reset-modal')!;

  constructor() {
    const canvasEl = document.getElementById(
      'inn-canvas'
    ) as HTMLCanvasElement | null;
    const dCanvasEl = document.getElementById(
      'dungeon-canvas'
    ) as HTMLCanvasElement | null;
    if (!canvasEl || !dCanvasEl) {
      throw new Error('캔버스 요소를 찾을 수 없습니다.');
    }
    this.canvas = canvasEl;
    this.dungeonCanvas = dCanvasEl;
    this.renderer = new InnRenderer(this.canvas);
    this.dungeonRenderer = new DungeonExpeditionRenderer(this.dungeonCanvas);

    this.game = new DungeonInnGame(
      () => this.refreshHeaderAndLogs(),
      () => this.refreshAllUi(true),
      undefined,
      (zoneTab) => this.openDrawerOnTab(zoneTab),
      (settledReport) => this.showDailyReportModal(settledReport, true)
    );

    const offlineReport = this.game.loadFromStorage();
    this.autoSelectInitialParty();
    this.bindEvents();
    this.updateSoundButtonText();
    this.refreshAllUi(true);

    if (this.game.migratedFromLegacy) {
      this.elMigrationModal.classList.remove('hidden');
    } else if (offlineReport) {
      this.showOfflineModal(offlineReport);
    } else if (!this.game.tutorialSeen) {
      this.game.tutorialSeen = true;
      this.game.saveToStorage();
    }

    requestAnimationFrame((now) => this.loop(now));
  }

  private autoSelectInitialParty(): void {
    const dungeon = DUNGEON_MAP[this.selectedDungeonId] ?? DUNGEONS[0];
    const best = selectBestPartyForDungeon(
      this.game.getUnlockedHeroes(),
      dungeon,
      this.game.getMaxPartySize()
    );
    this.selectedPartyHeroIds = best.map((h) => h.id);
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      const prevHero = this.game.selectedHeroId;
      this.game.handleCanvasTap(cx, cy);
      if (this.game.selectedHeroId !== prevHero) {
        this.renderHeroInspectorPanel(true);
      }
    });

    document
      .getElementById('btn-toggle-map-zoom')
      ?.addEventListener('click', (e) => {
        this.mapZoomExpanded = !this.mapZoomExpanded;
        const viewport = document.getElementById('inn-canvas-viewport');
        viewport?.classList.toggle('zoom-scroll-mode', this.mapZoomExpanded);
        const btn = e.currentTarget as HTMLButtonElement;
        btn.textContent = this.mapZoomExpanded
          ? '↔️ 확대 팬 모드 (탭해 맞춤)'
          : '🔍 전체 맞춤 보기';
      });

    document
      .getElementById('btn-return-to-inn')
      ?.addEventListener('click', () => {
        this.isDungeonOverlayHiddenByUser = true;
        this.updateDungeonOverlayVisibility();
      });

    this.elBtnShowDungeon.addEventListener('click', () => {
      this.isDungeonOverlayHiddenByUser = false;
      this.updateDungeonOverlayVisibility();
    });

    document.getElementById('btn-serve-now')?.addEventListener('click', () => {
      this.game.serveAllOrSolicit();
    });

    this.elEventBtn.addEventListener('click', () => {
      this.game.triggerRandomEvent(true);
    });

    document
      .getElementById('btn-open-daily-report')
      ?.addEventListener('click', () => {
        const rep =
          this.game.lastSettledDayReport ?? this.game.currentDayLedger;
        this.showDailyReportModal(
          rep,
          Boolean(this.game.lastSettledDayReport)
        );
      });

    document
      .getElementById('btn-close-daily-report')
      ?.addEventListener('click', () => {
        this.elDailyReportModal.classList.add('hidden');
        this.game.sound.playCoin();
      });

    document
      .getElementById('btn-close-drawer')
      ?.addEventListener('click', () => {
        this.closeDrawer();
      });

    const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as ActiveTab | undefined;
        if (!tab) return;
        if (this.isDrawerOpen && this.activeTab === tab) {
          this.closeDrawer();
        } else {
          this.openDrawerOnTab(tab);
        }
      });
    });

    this.elSoundBtn.addEventListener('click', () => {
      this.game.sound.toggleMute();
      this.updateSoundButtonText();
      this.game.saveToStorage();
    });

    document.getElementById('btn-help')?.addEventListener('click', () => {
      this.elHelpModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-help')?.addEventListener('click', () => {
      this.elHelpModal.classList.add('hidden');
    });

    document
      .getElementById('btn-close-offline')
      ?.addEventListener('click', () => {
        this.elOfflineModal.classList.add('hidden');
        this.game.sound.playCoin();
      });

    document
      .getElementById('btn-cancel-enhance')
      ?.addEventListener('click', () => {
        this.pendingEnhanceTarget = null;
        this.elEnhanceModal.classList.add('hidden');
      });
    document
      .getElementById('btn-confirm-enhance')
      ?.addEventListener('click', () => {
        if (this.pendingEnhanceTarget) {
          this.game.enhanceEquipment(this.pendingEnhanceTarget, false);
          this.pendingEnhanceTarget = null;
          this.elEnhanceModal.classList.add('hidden');
          this.renderHeroInspectorPanel(true);
          if (this.isDrawerOpen) {
            this.buildTabCards();
          }
        }
      });

    document
      .getElementById('btn-migrate-continue')
      ?.addEventListener('click', () => {
        this.game.migratedFromLegacy = false;
        this.elMigrationModal.classList.add('hidden');
        this.refreshAllUi(true);
      });
    document
      .getElementById('btn-migrate-fresh')
      ?.addEventListener('click', () => {
        this.elMigrationModal.classList.add('hidden');
        this.game.resetGame();
        this.autoSelectInitialParty();
        this.refreshAllUi(true);
      });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.elResetModal.classList.remove('hidden');
    });
    document
      .getElementById('btn-cancel-reset')
      ?.addEventListener('click', () => {
        this.elResetModal.classList.add('hidden');
      });
    document
      .getElementById('btn-confirm-reset')
      ?.addEventListener('click', () => {
        this.elResetModal.classList.add('hidden');
        this.game.resetGame();
        this.autoSelectInitialParty();
        this.refreshAllUi(true);
      });

    [
      this.elDailyReportModal,
      this.elOfflineModal,
      this.elEnhanceModal,
      this.elMigrationModal,
      this.elHelpModal,
      this.elResetModal,
    ].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.game.saveToStorage(true);
      }
    });
    window.addEventListener('pagehide', () => {
      this.game.saveToStorage(true);
    });
    window.addEventListener('beforeunload', () => {
      this.game.saveToStorage(true);
    });
  }

  public openDrawerOnTab(tab: ActiveTab): void {
    this.activeTab = tab;
    this.isDrawerOpen = true;
    this.elManagementDrawer.classList.remove('hidden');

    const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
    tabButtons.forEach((b) => {
      const isActive = b.dataset.tab === tab;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    this.elCategorySummary.textContent = TAB_SUMMARIES[tab];
    this.buildTabCards();
  }

  public closeDrawer(): void {
    this.isDrawerOpen = false;
    this.elManagementDrawer.classList.add('hidden');
    const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
    tabButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
  }

  private updateDungeonOverlayVisibility(): void {
    const hasExpeditions = this.game.expeditions.length > 0;
    if (!hasExpeditions) {
      this.elDungeonPanel.classList.add('hidden');
      this.elBtnShowDungeon.classList.add('hidden');
      this.isDungeonOverlayHiddenByUser = false;
      return;
    }

    if (this.isDungeonOverlayHiddenByUser) {
      this.elDungeonPanel.classList.add('hidden');
      this.elBtnShowDungeon.classList.remove('hidden');
      const exp = this.game.expeditions[0];
      const d = DUNGEON_MAP[exp.dungeonId];
      this.elBtnShowDungeon.textContent = `⚔️ 원정 화면 열기 (${
        d?.name ?? '던전'
      } ${exp.currentFloor ?? 1}/${exp.totalFloors ?? 3}F)`;
    } else {
      this.elDungeonPanel.classList.remove('hidden');
      this.elBtnShowDungeon.classList.add('hidden');
    }
  }

  private updateSoundButtonText(): void {
    const muted = this.game.sound.isMuted();
    this.elSoundBtn.textContent = muted ? '🔇' : '🔊';
  }

  private showDailyReportModal(
    report: DailyFinancialReport,
    isEndOfDay: boolean
  ): void {
    const elTitle = document.getElementById('daily-report-modal-title');
    const elSub = document.getElementById('daily-report-subtitle');
    const elBody = document.getElementById('daily-report-body');

    if (elTitle) {
      elTitle.textContent = isEndOfDay
        ? `🌙 ${report.day}일차 여관 일일 결산서 (${report.innRankTitle})`
        : `📊 ${report.day}일차 오늘 실시간 장부 (${report.innRankTitle})`;
    }
    if (elSub) {
      elSub.textContent = isEndOfDay
        ? `${report.day}일차 영업이 마감되어 직원 일당과 시설 유지비를 정산했습니다. 확인 후 ${this.game.dayNumber}일차를 맞이하세요!`
        : `현재 진행 중인 ${report.day}일차의 실시간 수입·지출 집계입니다. (하루가 끝나면 급료·유지비가 차감됩니다)`;
    }
    if (elBody) {
      const inc = report.income;
      const exp = report.expense;
      const expectedWages = this.game.getDailyWagesBreakdown().totalWages;
      const expectedUpkeep = this.game.getDailyUpkeepCost();

      elBody.innerHTML = `
        <div class="report-row">
          <span>🍲 식사·음료 판매 수입</span>
          <strong style="color:#7eb38a">+${formatGold(inc.foodAndDrink)} G</strong>
        </div>
        <div class="report-row">
          <span>🍻 방문 손님 서빙·팁 수입 (${report.servedCount}회)</span>
          <strong style="color:#7eb38a">+${formatGold(inc.guestServing)} G</strong>
        </div>
        <div class="report-row">
          <span>🛏️ 2층 객실 숙박·휴식 수입</span>
          <strong style="color:#7eb38a">+${formatGold(inc.roomAndRest)} G</strong>
        </div>
        <div class="report-row">
          <span>⚗️ 포션 가게 판매 수입</span>
          <strong style="color:#7eb38a">+${formatGold(inc.potionSales)} G</strong>
        </div>
        <div class="report-row">
          <span>⚒️ 대장간 장비 판매·강화·수리 수입</span>
          <strong style="color:#7eb38a">+${formatGold(inc.blacksmithSales)} G</strong>
        </div>
        <div class="report-row">
          <span>💎 전리품 감정 수수료·퀘스트 보상</span>
          <strong style="color:#7eb38a">+${formatGold(inc.lootMargin)} G</strong>
        </div>
        <div class="report-row highlight-row">
          <span>📈 일일 총 영업 수입</span>
          <strong style="color:#7eb38a">+${formatGold(inc.totalIncome)} G</strong>
        </div>

        <div class="report-row" style="margin-top:4px">
          <span>🧑‍🍳 직원 일당 / 급료 지출</span>
          <strong style="color:#e3958d">-${formatGold(
            isEndOfDay ? exp.wages : expectedWages
          )} G${!isEndOfDay ? ' (결산 예정)' : ''}</strong>
        </div>
        <div class="report-row">
          <span>🕯️ 연료·식자재·시설 유지비</span>
          <strong style="color:#e3958d">-${formatGold(
            isEndOfDay ? exp.upkeep : expectedUpkeep
          )} G${!isEndOfDay ? ' (결산 예정)' : ''}</strong>
        </div>
        <div class="report-row">
          <span>🧪 포션 조제·장비 단조·강화 원가</span>
          <strong style="color:#e3958d">-${formatGold(exp.craftCost)} G</strong>
        </div>
        <div class="report-row">
          <span>🎒 영웅 던전 전리품 매입 지출</span>
          <strong style="color:#e3958d">-${formatGold(exp.lootPurchase)} G</strong>
        </div>
        <div class="report-row">
          <span>🏛️ 시설·메뉴·도구 확장 투자 (자본 지출)</span>
          <strong style="color:#d4bfa8">-${formatGold(exp.facilityInvest)} G</strong>
        </div>

        <div class="report-row highlight-row">
          <span>💰 ${report.day}일차 영업 순이익 (수입 - 운영지출)</span>
          <strong class="gold-highlight" style="color:${
            report.netProfit >= 0 ? '#ebd186' : '#e3958d'
          }">${formatSignedGold(report.netProfit)} G</strong>
        </div>

        <div class="report-row">
          <span>🗺️ 던전 원정 결과 / 상점 거래</span>
          <strong>성공 ${report.dungeonWins}회 · 후퇴 ${
        report.dungeonFails
      }회 / 상점 거래 ${report.heroTransactions}건</strong>
        </div>
        ${
          report.newHeroesJoined.length > 0
            ? `<div class="report-row"><span>🦸 오늘 합류한 동료</span><strong style="color:#7eb38a">${report.newHeroesJoined.join(
                ', '
              )}</strong></div>`
            : ''
        }
        ${
          report.injuredHeroes.length > 0
            ? `<div class="report-row"><span>🩸 치료받은 부상 영웅</span><strong style="color:#e3958d">${report.injuredHeroes.join(
                ', '
              )}</strong></div>`
            : ''
        }
        ${
          report.wageArrears > 0
            ? `<p class="enhance-warning-box">⚠️ 체불 급료 ${formatGold(
                report.wageArrears
              )}G가 남아 있어 직원 효율이 70%로 낮아졌습니다. 골드를 벌면 자동 상환됩니다.</p>`
            : ''
        }
      `;
    }

    const closeBtn = document.getElementById('btn-close-daily-report');
    if (closeBtn) {
      closeBtn.textContent = isEndOfDay
        ? '🌅 확인하고 다음 날 영업 시작하기'
        : '✅ 장부 확인하고 영업 계속하기';
    }

    this.elDailyReportModal.classList.remove('hidden');
  }

  private showOfflineModal(report: OfflineReport): void {
    const elTime = document.getElementById('offline-time-text');
    const elGps = document.getElementById('offline-gps-text');
    const elExp = document.getElementById('offline-exp-text');
    const elCraft = document.getElementById('offline-craft-text');
    const elExtra = document.getElementById('offline-extra-text');
    const elGold = document.getElementById('offline-gold-text');

    if (elTime) {
      const durStr = report.wasCapped
        ? `${formatDuration(report.cappedSeconds)} (최대 8시간)`
        : formatDuration(report.elapsedSeconds);
      elTime.textContent = `${durStr} (${report.simulatedDays}일분 요약 정산)`;
    }
    if (elGps) {
      elGps.textContent = `수입 +${formatGold(
        report.totalIncome
      )}G / 지출 -${formatGold(report.totalExpense)}G`;
    }
    if (elExp) {
      elExp.textContent = `${report.expeditionsCompleted}회 완료`;
    }
    if (elCraft) {
      elCraft.textContent = `포션 ${report.potionsCrafted}병 / 장비 ${report.equipsCrafted}개`;
    }
    if (elExtra) {
      elExtra.textContent = `상점 거래 ${report.heroShopTransactions}건 / 치료 ${report.heroesHealedCount}회 / 안전매각 ${report.peddlerSales}개`;
    }
    if (elGold) {
      elGold.textContent = `${formatSignedGold(report.earnedGold)} G`;
    }

    this.elOfflineModal.classList.remove('hidden');
  }

  private openEnhanceConfirmModal(target: {
    heroId?: string;
    slot?: EquipSlot;
    stockUid?: number;
  }): void {
    const preview = this.game.getEnhancePreview(target);
    if (!preview) return;

    this.pendingEnhanceTarget = target;
    const elName = document.getElementById('enhance-target-name');
    const elLv = document.getElementById('enhance-level-change');
    const elChance = document.getElementById('enhance-chance-text');
    const elCost = document.getElementById('enhance-cost-text');
    const btnConfirm = document.getElementById(
      'btn-confirm-enhance'
    ) as HTMLButtonElement | null;

    if (elName) {
      elName.textContent = preview.heroName
        ? `[${preview.heroName} 착용] ${preview.itemName}`
        : `[대장간 재고] ${preview.itemName}`;
    }
    if (elLv) {
      elLv.textContent = `+${preview.currentLevel} → +${preview.nextLevel}`;
    }
    if (elChance) {
      const pct = (preview.successRate * 100).toFixed(
        preview.successRate < 0.05 ? 2 : 1
      );
      elChance.textContent = `성공 ${pct}% (파괴 위험 ${(
        100 -
        preview.successRate * 100
      ).toFixed(1)}%)`;
    }
    if (elCost) {
      const matText = Object.entries(preview.materialCosts)
        .map(([mId, cnt]) => `${MATERIAL_MAP[mId]?.name ?? mId} x${cnt}`)
        .join(', ');
      elCost.textContent = `${formatGold(preview.goldCost)} G${
        matText ? ` · ${matText}` : ''
      }`;
    }
    if (btnConfirm) {
      btnConfirm.disabled = !preview.canAttempt;
    }

    this.elEnhanceModal.classList.remove('hidden');
  }

  private loop(now: number): void {
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    const prevExpCount = this.game.expeditions.length;
    const prevPotQueueCount = this.game.craftQueues.potion.length;
    const prevSmithQueueCount = this.game.craftQueues.blacksmith.length;

    this.game.update(dt);

    if (this.game.expeditions.length > prevExpCount) {
      this.isDungeonOverlayHiddenByUser = false;
    }
    this.updateDungeonOverlayVisibility();

    const renderState = this.game.getRenderState();
    this.renderer.render(renderState);
    if (!this.elDungeonPanel.classList.contains('hidden')) {
      this.dungeonRenderer.render(renderState);
    }

    const queueChanged =
      this.game.expeditions.length !== prevExpCount ||
      this.game.craftQueues.potion.length !== prevPotQueueCount ||
      this.game.craftQueues.blacksmith.length !== prevSmithQueueCount;

    this.uiRefreshAccumulator += dt;
    if (queueChanged) {
      this.uiRefreshAccumulator = 0;
      this.refreshAllUi(true);
    } else if (this.uiRefreshAccumulator >= 0.35) {
      this.uiRefreshAccumulator = 0;
      this.refreshHeaderAndLogs();
      this.updateLiveProgressBars();
      this.updateHeroInspectorVitalsLive();
      this.renderDungeonExpeditionPartyTabsAndLogs();
    }

    requestAnimationFrame((nextNow) => this.loop(nextNow));
  }

  private refreshAllUi(forceRebuildCards: boolean): void {
    this.refreshHeaderAndLogs();
    this.renderHeroInspectorPanel(forceRebuildCards);
    this.updateDungeonOverlayVisibility();
    this.renderDungeonExpeditionPartyTabsAndLogs();
    if (this.isDrawerOpen && forceRebuildCards) {
      this.buildTabCards();
    } else if (this.isDrawerOpen) {
      this.updateLiveProgressBars();
    }
  }

  // ==========================================================================
  // 영웅을 탭했을 때만 열리는 상태 확인 & 특정 행동 직접 지시 서랍 (닫기 버튼 포함)
  // ==========================================================================

  private renderHeroInspectorPanel(forceRebuild = false): void {
    const heroId = this.game.selectedHeroId;
    if (!heroId || !this.game.heroes[heroId]?.unlocked) {
      this.elHeroInspector.classList.add('hidden');
      this.elHeroInspector.dataset.renderedHeroId = '';
      return;
    }
    this.elHeroInspector.classList.remove('hidden');
    if (
      !forceRebuild &&
      this.elHeroInspector.dataset.renderedHeroId === heroId
    ) {
      this.updateHeroInspectorVitalsLive();
      return;
    }
    this.elHeroInspector.dataset.renderedHeroId = heroId;

    const hero = this.game.heroes[heroId];
    const roster = HERO_ROSTER_MAP[hero.id];
    const cls = HERO_CLASSES[roster.classId];
    const origin = ORIGINS[roster.originId];
    const bd = getHeroStatBreakdown(hero);
    const reqXp = getHeroRequiredXp(hero.level);
    const hunger = Math.round(hero.hunger ?? 20);
    const fatigue = Math.round(hero.fatigue ?? 10);

    let partyText = '단독 자율 행동 중';
    if (hero.expeditionId) {
      const exp = this.game.expeditions.find((e) => e.id === hero.expeditionId);
      if (exp) {
        const dName = DUNGEON_MAP[exp.dungeonId]?.name ?? '던전';
        const mates = exp.heroIds
          .map((id) => HERO_ROSTER_MAP[id]?.name ?? id)
          .join(' · ');
        partyText = `[${dName} 원정대] ${mates}`;
      }
    } else if (hero.partyId) {
      const mates = this.game
        .getUnlockedHeroes()
        .filter((h) => h.partyId === hero.partyId)
        .map((h) => HERO_ROSTER_MAP[h.id].name)
        .join(' · ');
      partyText = mates ? `파티 결성: ${mates}` : '단독 자율 행동 중';
    }

    const equipSlotsHtml = (
      ['weapon', 'armor', 'offhand', 'accessory'] as EquipSlot[]
    )
      .map((slot) => {
        const inst = hero.equipment[slot];
        const def = EQUIPMENT_DEF_MAP[inst.defId];
        const rInfo = RARITY_INFO[def.rarity];
        const canEnh = !def.isBase && inst.enhanceLevel < 15;
        return `
          <div class="insp-equip-chip" style="border-color:${rInfo.color}">
            <span class="insp-eq-slot">${EQUIP_SLOT_LABELS[slot]}</span>
            <strong style="color:${rInfo.color}">${def.icon} ${def.name}${
          inst.enhanceLevel > 0 ? ` +${inst.enhanceLevel}` : ''
        }</strong>
            ${
              canEnh
                ? `<button type="button" class="insp-mini-enh-btn" data-enh-slot="${slot}">🔥+강화</button>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    const potionOptionsHtml = POTION_RECIPES.map((p) => {
      const stock = this.game.potionStock[p.id] ?? 0;
      const price = this.game.getEffectivePotionSellPrice(p.id);
      const sel = p.id === this.orderPotionId ? 'selected' : '';
      return `<option value="${p.id}" ${sel}>${p.icon} ${p.name} (재고 ${stock} / ${price}G)</option>`;
    }).join('');

    const dungeonOptionsHtml = DUNGEONS.filter((d) =>
      this.game.isDungeonUnlocked(d.id)
    )
      .map((d) => {
        const sel = d.id === this.orderDungeonId ? 'selected' : '';
        return `<option value="${d.id}" ${sel}>${d.icon} T${d.tier}. ${d.name}</option>`;
      })
      .join('');

    this.elHeroInspector.innerHTML = `
      <div class="inspector-top-row">
        <div class="inspector-hero-id">
          <img src="${getHeroPortraitDataUrl(hero.id)}" alt="${
      roster.name
    }" class="pixel-portrait" />
          <div>
            <div class="upgrade-title-row">
              <strong class="upgrade-name">🎯 ${roster.name} <small class="hero-title-sub">(${
      roster.title
    })</small></strong>
              <span class="role-badge role-${cls.role}">${cls.icon} ${
      cls.name
    } · ${cls.roleName}</span>
            </div>
            <div class="trait-row">
              <span class="upgrade-level-badge" id="insp-lv-xp">Lv.${
                hero.level
              } (XP ${hero.xp}/${reqXp})</span>
              ${roster.personalities
                .map(
                  (p) =>
                    `<span class="trait-chip">${PERSONALITIES[p].icon} ${PERSONALITIES[p].name}</span>`
                )
                .join('')}
              <span class="trait-chip origin-chip">${origin.icon} ${
      origin.name
    }</span>
            </div>
          </div>
        </div>
        <button type="button" id="btn-close-hero-inspector" class="inspector-close-btn" aria-label="영웅 패널 닫기">
          ✕ 닫기
        </button>
      </div>

      <div class="inspector-other-heroes">
        ${this.game
          .getUnlockedHeroes()
          .slice(0, 10)
          .map((h) => {
            const r = HERO_ROSTER_MAP[h.id];
            return `<button type="button" class="hero-quick-switch-btn${
              h.id === hero.id ? ' active' : ''
            }" data-switch-hero="${h.id}">${r.name}</button>`;
          })
          .join('')}
      </div>

      <div class="inspector-vitals-grid">
        <div class="vital-pill">❤️ 체력 <strong id="insp-hp">${
          hero.currentHp
        }/${bd.totalStats.hp}</strong></div>
        <div class="vital-pill">🍖 허기 <strong id="insp-hunger">${hunger}%</strong></div>
        <div class="vital-pill">💦 피로 <strong id="insp-fatigue">${fatigue}%</strong></div>
        <div class="vital-pill">💰 보유 골드 <strong id="insp-gold">${formatGold(
          hero.gold
        )} G</strong></div>
        <div class="vital-pill intent-pill">🧭 현재 의도: <strong id="insp-intent">${
          hero.intentText ?? '여관 대기 중'
        }</strong> (${partyText})</div>
      </div>

      <div class="stat-pill-row">
        <span>⚔️전투력 <b id="insp-cp">${bd.combatPower}</b></span>
        <span>ATK <b>${bd.totalStats.atk}</b></span>
        <span>DEF <b>${bd.totalStats.def}</b></span>
        <span>AGI <b>${bd.totalStats.agi}</b></span>
        <span>INT <b>${bd.totalStats.int}</b></span>
        <span>LUK <b>${bd.totalStats.luk}</b></span>
      </div>

      <div class="inspector-equip-row">
        ${equipSlotsHtml}
      </div>

      <div class="inspector-orders-box">
        <div class="orders-box-header">
          <span>📣 <b>플레이어 행동 지시</b></span>
          <button type="button" id="btn-cancel-hero-order" class="cancel-order-btn" ${
            hero.playerOrder ? '' : 'disabled'
          }>
            ✖ 지시 취소 ${hero.playerOrder ? `(${hero.playerOrder.label})` : ''}
          </button>
        </div>
        <div class="orders-btn-grid">
          <button type="button" class="order-action-btn" data-order-kind="eat_meal">🍲 식당 식사</button>
          <button type="button" class="order-action-btn" data-order-kind="drink_ale">🍺 바 에일</button>
          <button type="button" class="order-action-btn" data-order-kind="rest_room">🛏️ 2층 객실 휴식</button>
          <button type="button" class="order-action-btn" data-order-kind="sell_loot">💎 전리품 매각</button>
          <button type="button" class="order-action-btn" data-order-kind="buy_equip">⚒️ 대장간 장비</button>
          <button type="button" class="order-action-btn" data-order-kind="rally_board">📋 게시판 집결</button>
        </div>
        <div class="orders-custom-row">
          <div class="custom-order-group">
            <select id="select-order-potion" class="order-select">${potionOptionsHtml}</select>
            <button type="button" id="btn-order-buy-potion" class="order-action-btn">⚗️ 포션 구매</button>
          </div>
          <div class="custom-order-group">
            <select id="select-order-dungeon" class="order-select">${dungeonOptionsHtml}</select>
            <button type="button" id="btn-order-depart-dungeon" class="order-action-btn primary-order-btn">🚀 던전 출발</button>
          </div>
        </div>
      </div>
    `;

    document
      .getElementById('btn-close-hero-inspector')
      ?.addEventListener('click', () => {
        this.game.selectedHeroId = null;
        this.renderHeroInspectorPanel(true);
      });

    this.elHeroInspector
      .querySelectorAll<HTMLButtonElement>('[data-switch-hero]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          this.game.selectedHeroId = btn.dataset.switchHero ?? null;
          this.renderHeroInspectorPanel(true);
        });
      });

    this.elHeroInspector
      .querySelectorAll<HTMLButtonElement>('[data-enh-slot]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const slot = btn.dataset.enhSlot as EquipSlot;
          this.openEnhanceConfirmModal({ heroId: hero.id, slot });
        });
      });

    this.elHeroInspector
      .querySelectorAll<HTMLButtonElement>('[data-order-kind]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const kind = btn.dataset.orderKind as
            | 'eat_meal'
            | 'drink_ale'
            | 'rest_room'
            | 'sell_loot'
            | 'buy_equip'
            | 'rally_board';
          const labels: Record<typeof kind, string> = {
            eat_meal: '식당 식사',
            drink_ale: '바 음료',
            rest_room: '객실 휴식',
            sell_loot: '전리품 매각',
            buy_equip: '대장간 장비 정비',
            rally_board: '게시판 파티 모집',
          };
          this.game.issueHeroOrder(hero.id, {
            kind,
            label: labels[kind],
          });
          this.renderHeroInspectorPanel(true);
        });
      });

    const selPot = document.getElementById(
      'select-order-potion'
    ) as HTMLSelectElement | null;
    selPot?.addEventListener('change', () => {
      this.orderPotionId = selPot.value;
    });

    document
      .getElementById('btn-order-buy-potion')
      ?.addEventListener('click', () => {
        const chosenId = selPot ? selPot.value : this.orderPotionId;
        const pName =
          POTION_RECIPES.find((p) => p.id === chosenId)?.name ?? '포션';
        this.game.issueHeroOrder(hero.id, {
          kind: 'buy_potion',
          targetId: chosenId,
          label: `${pName} 구매`,
        });
        this.renderHeroInspectorPanel(true);
      });

    const selDun = document.getElementById(
      'select-order-dungeon'
    ) as HTMLSelectElement | null;
    selDun?.addEventListener('change', () => {
      this.orderDungeonId = selDun.value;
    });

    document
      .getElementById('btn-order-depart-dungeon')
      ?.addEventListener('click', () => {
        const chosenDun = selDun ? selDun.value : this.orderDungeonId;
        const dName = DUNGEON_MAP[chosenDun]?.name ?? '던전';
        this.game.issueHeroOrder(hero.id, {
          kind: 'depart_dungeon',
          targetId: chosenDun,
          label: `${dName} 출정`,
        });
        this.renderHeroInspectorPanel(true);
      });

    document
      .getElementById('btn-cancel-hero-order')
      ?.addEventListener('click', () => {
        this.game.cancelHeroOrder(hero.id);
        this.renderHeroInspectorPanel(true);
      });
  }

  private updateHeroInspectorVitalsLive(): void {
    const heroId = this.game.selectedHeroId;
    if (!heroId || !this.game.heroes[heroId]?.unlocked) return;
    const hero = this.game.heroes[heroId];
    const bd = getHeroStatBreakdown(hero);

    const elHp = document.getElementById('insp-hp');
    const elHunger = document.getElementById('insp-hunger');
    const elFatigue = document.getElementById('insp-fatigue');
    const elGold = document.getElementById('insp-gold');
    const elIntent = document.getElementById('insp-intent');
    const btnCancel = document.getElementById(
      'btn-cancel-hero-order'
    ) as HTMLButtonElement | null;

    if (elHp) elHp.textContent = `${hero.currentHp}/${bd.totalStats.hp}`;
    if (elHunger) elHunger.textContent = `${Math.round(hero.hunger ?? 20)}%`;
    if (elFatigue) elFatigue.textContent = `${Math.round(hero.fatigue ?? 10)}%`;
    if (elGold) elGold.textContent = `${formatGold(hero.gold)} G`;
    if (elIntent) elIntent.textContent = hero.intentText ?? '여관 대기 중';
    if (btnCancel) {
      btnCancel.disabled = !hero.playerOrder;
      btnCancel.textContent = hero.playerOrder
        ? `✖ 지시 취소 (${hero.playerOrder.label})`
        : '✖ 지시 취소';
    }
  }

  // ==========================================================================
  // 던전 실시간 갈래 방 탐험 뷰 파티 탭 · 이벤트 선택지 · 전투 로그 렌더링
  // ==========================================================================

  private renderDungeonExpeditionPartyTabsAndLogs(): void {
    const exps = this.game.expeditions;
    this.elDungeonPartyTabs.innerHTML = '';

    for (const exp of exps) {
      const d = DUNGEON_MAP[exp.dungeonId];
      const isFocused =
        (this.game.focusedExpeditionId ?? exps[0]?.id) === exp.id;
      const pct = Math.min(
        100,
        Math.max(
          0,
          ((exp.totalDurationSec - exp.remainingSec) /
            Math.max(1, exp.totalDurationSec)) *
            100
        )
      );

      const tabBtn = document.createElement('button');
      tabBtn.type = 'button';
      tabBtn.className = `dungeon-party-tab-btn${isFocused ? ' active' : ''}`;
      tabBtn.innerHTML = `
        <span>${d?.icon ?? '🗺️'} ${d?.name ?? exp.dungeonId} [${
        exp.currentFloor ?? 1
      }/${exp.totalFloors ?? 3}F]</span>
        <span class="mini-party-bar"><span style="width:${pct.toFixed(
          0
        )}%"></span></span>
      `;
      tabBtn.addEventListener('click', () => {
        this.game.focusedExpeditionId = exp.id;
        this.renderDungeonExpeditionPartyTabsAndLogs();
      });
      this.elDungeonPartyTabs.appendChild(tabBtn);
    }

    const activeExp =
      exps.find((e) => e.id === this.game.focusedExpeditionId) ??
      exps[0] ??
      null;

    // 던전 이벤트 선택지 배너 렌더링
    const prompt = activeExp?.activeEventPrompt;
    if (activeExp && prompt && !prompt.resolvedOptionId) {
      const promptKey = `${activeExp.id}_${prompt.eventId}`;
      this.elDungeonEventBox.classList.remove('hidden');
      if (this.lastRenderedEventPromptId !== promptKey) {
        this.lastRenderedEventPromptId = promptKey;
        this.elDungeonEventBox.innerHTML = `
          <div class="event-choice-title">${prompt.title} <small>(${Math.ceil(
          prompt.autoResolveTimer
        )}초 후 자동 선택)</small></div>
          <p class="event-choice-desc">${prompt.description}</p>
          <div class="event-choice-btns">
            ${prompt.options
              .map(
                (opt) =>
                  `<button type="button" class="event-choice-btn" data-ev-opt="${opt.id}">${opt.label} <small>(${opt.effectText})</small></button>`
              )
              .join('')}
          </div>
        `;
        this.elDungeonEventBox
          .querySelectorAll<HTMLButtonElement>('[data-ev-opt]')
          .forEach((btn) => {
            btn.addEventListener('click', () => {
              this.game.chooseDungeonEventOption(
                activeExp.id,
                btn.dataset.evOpt
              );
              this.lastRenderedEventPromptId = null;
              this.elDungeonEventBox.classList.add('hidden');
            });
          });
      }
    } else {
      this.lastRenderedEventPromptId = null;
      this.elDungeonEventBox.classList.add('hidden');
    }

    const logs =
      activeExp?.floorLogs ??
      this.game.recentExpeditionResults[0]?.floorLogs ??
      [];
    const topId = logs[0]?.id ?? -1;
    if (topId === this.lastFloorLogTopId) return;
    this.lastFloorLogTopId = topId;

    this.elDungeonFloorLogs.innerHTML = '';
    for (const item of logs.slice(0, 3)) {
      const li = document.createElement('li');
      li.className = `floor-log-item floor-log-${item.type}`;
      li.textContent = `[${item.floor}층] ${item.text}`;
      this.elDungeonFloorLogs.appendChild(li);
    }
  }

  private refreshHeaderAndLogs(): void {
    const rankDef = this.game.getCurrentInnRankDef();
    const { icon, label, clockText } = this.game.getDayPhaseLabel();

    this.elLevelBadge.textContent = rankDef.title;
    this.elDayClock.textContent = `${this.game.dayNumber}일차 · ${icon} ${label} ${clockText}`;
    this.elRepText.textContent = `평판 ${formatGold(this.game.reputation)}`;
    this.elHeroBadge.textContent = `영웅 ${this.game.getUnlockedHeroCount()}/${
      HERO_ROSTER.length
    }명`;
    this.elGold.textContent = `${formatGold(this.game.gold)} G`;

    const todayNet = this.game.currentDayLedger?.netProfit ?? 0;
    this.elTodayProfit.textContent = `${formatSignedGold(todayNet)} G`;
    this.elTodayProfit.style.color =
      todayNet >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

    const fixedWages = this.game.getDailyWagesBreakdown().totalWages;
    const fixedUpkeep = this.game.getDailyUpkeepCost();
    const arrearsNote =
      this.game.unpaidWages > 0 ? ` (체불 ${this.game.unpaidWages}G)` : '';
    this.elDailyFixed.textContent = `-${formatGold(
      fixedWages + fixedUpkeep
    )} G/일${arrearsNote}`;

    // 항상 보이는 현재 여관 등급 목표 체크리스트 & 진행 바
    const { nextRank, items, overallPct } =
      this.game.getNextRankGoalsProgress();
    this.elGoalFill.style.width = `${Math.max(4, overallPct).toFixed(1)}%`;

    if (nextRank && items.length > 0) {
      this.elNextGoal.textContent = `🎯 다음 등급 [${nextRank.title}] 승급 목표 (${Math.round(
        overallPct
      )}%)`;
      this.elHudGoalChips.innerHTML = items
        .map(
          (it) =>
            `<span class="hud-goal-chip${it.completed ? ' done' : ''}">${
              it.completed ? '✅' : '▫️'
            } ${it.condition.label}: <b>${formatGold(it.current)}/${formatGold(
              it.target
            )}</b></span>`
        )
        .join('');
    } else {
      this.elNextGoal.textContent =
        '🏆 최고 등급 [Lv.8 전설의 왕국 최고 여관] 달성 완료!';
      this.elHudGoalChips.innerHTML = `<span class="hud-goal-chip done">🐉 고대 용왕의 화산 둥지 정복 완료</span>`;
    }

    if (this.game.activeEvent) {
      this.elEventBanner.classList.remove('hidden');
      this.elEventTitle.textContent = this.game.activeEvent.def.title;
      this.elEventTimer.textContent = `${Math.ceil(
        this.game.activeEvent.remainingSec
      )}초`;
      this.elEventDesc.textContent = this.game.activeEvent.def.description;
    } else {
      this.elEventBanner.classList.add('hidden');
    }

    const waitingCount = this.game.guests.filter(
      (g) => g.state === 'waiting'
    ).length;
    if (waitingCount > 0) {
      this.elServeBtnLabel.textContent = `🍻 손님 서빙 (${waitingCount})`;
    } else {
      this.elServeBtnLabel.textContent = `🔔 손님 맞이`;
    }

    if (this.game.activeEvent) {
      this.elEventBtn.disabled = true;
      this.elEventBtnLabel.textContent = `🎉 이벤트 중`;
    } else if (this.game.eventCooldownSec > 0) {
      this.elEventBtn.disabled = true;
      this.elEventBtnLabel.textContent = `🎲 쿨타임 ${Math.ceil(
        this.game.eventCooldownSec
      )}s`;
    } else {
      this.elEventBtn.disabled = false;
      this.elEventBtnLabel.textContent = `🎲 소문내기`;
    }

    this.renderLiveStatusStrip();

    this.elServedSummary.textContent = `${this.game.dayNumber}일차 · 서빙 ${formatGold(
      this.game.totalServed
    )}회 · 거래 ${this.game.totalHeroShopTransactions}건`;
    this.renderLogsIfChanged();
  }

  private renderLiveStatusStrip(): void {
    const parts: string[] = [];
    for (const exp of this.game.expeditions) {
      const d = DUNGEON_MAP[exp.dungeonId];
      parts.push(
        `🗺️ ${d?.name ?? exp.dungeonId} [${exp.currentFloor ?? 1}/${
          exp.totalFloors ?? 3
        }F]`
      );
    }
    const pending = this.game.getPendingLootSummary();
    if (pending.totalCount > 0) {
      parts.push(`💎 대기 전리품 ${pending.totalCount}개`);
    }
    if (this.game.craftQueues.potion.length > 0) {
      parts.push(`⚗️ 포션 조제 중`);
    }
    if (this.game.craftQueues.blacksmith.length > 0) {
      parts.push(`⚒️ 장비 단조 중`);
    }
    this.elLiveStrip.textContent =
      parts.length > 0 ? parts.join(' · ') : '🏠 여관 영업 중';
  }

  private updateLiveProgressBars(): void {
    document.querySelectorAll<HTMLElement>('[data-exp-id]').forEach((el) => {
      const expId = el.dataset.expId;
      const exp = this.game.expeditions.find((e) => e.id === expId);
      if (exp) {
        const pct = Math.min(
          100,
          Math.max(
            0,
            ((exp.totalDurationSec - exp.remainingSec) /
              Math.max(1, exp.totalDurationSec)) *
              100
          )
        );
        const fill = el.querySelector<HTMLElement>('.mini-progress-fill');
        const txt = el.querySelector<HTMLElement>('.mini-progress-text');
        if (fill) fill.style.width = `${pct.toFixed(1)}%`;
        if (txt)
          txt.textContent = `${exp.currentFloor ?? 1}/${
            exp.totalFloors ?? 3
          }층 · ${Math.ceil(exp.remainingSec)}초 남음`;
      }
    });

    if (
      this.activeTab === 'menu' ||
      this.activeTab === 'room' ||
      this.activeTab === 'staff' ||
      this.activeTab === 'facility'
    ) {
      this.updateLiveUpgradeCardStates();
    }
  }

  private renderLogsIfChanged(): void {
    const topId = this.game.logs[0]?.id ?? -1;
    if (topId === this.lastLogTopId) return;
    this.lastLogTopId = topId;

    this.elLogList.innerHTML = '';
    for (const entry of this.game.logs.slice(0, 3)) {
      const li = document.createElement('li');
      li.className = `log-item log-${entry.type}`;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'log-time';
      timeSpan.textContent = `[${entry.timeText}]`;

      const textSpan = document.createElement('span');
      textSpan.textContent = entry.text;

      li.appendChild(timeSpan);
      li.appendChild(textSpan);
      this.elLogList.appendChild(li);
    }
  }

  // ==========================================================================
  // 서랍 탭별 콘텐츠 빌더
  // ==========================================================================

  private buildTabCards(): void {
    this.elUpgradeList.innerHTML = '';

    switch (this.activeTab) {
      case 'goals':
        this.buildGoalsAndQuestsTab();
        break;
      case 'stats':
        this.buildStatsAndLedgerTab();
        break;
      case 'heroes':
        this.buildHeroesTab();
        break;
      case 'trade':
        this.buildTradeTab();
        break;
      case 'dungeon':
        this.buildDungeonTab();
        break;
      case 'potion':
        this.buildPotionTab();
        break;
      case 'blacksmith':
        this.buildBlacksmithTab();
        break;
      case 'codex':
        this.buildCodexCards();
        break;
      default:
        this.buildInnUpgradesTab(this.activeTab);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // 0-A. 🏆 여관 등급 목표 & 선택 퀘스트 탭
  // --------------------------------------------------------------------------
  private buildGoalsAndQuestsTab(): void {
    const rankPanel = document.createElement('div');
    rankPanel.className = 'section-panel';
    rankPanel.innerHTML = `
      <div class="panel-subtitle">🏆 여관 등급 성장 축 (Lv.1 ~ Lv.8) &amp; 등급별 공개 달성 목표</div>
      <p class="upgrade-desc">각 등급의 목표 조건을 모두 달성하면 즉시 다음 등급으로 승급하고 축하 보상을 받습니다. 최종 목표는 여관에서 키운 파티로 <b>[고대 용왕의 화산 둥지]</b>를 격파하고 <b>[Lv.8 전설의 왕국 최고 여관]</b>에 오르는 것입니다!</p>
    `;

    for (const lvl of INN_LEVELS) {
      const isReached = this.game.innRank >= lvl.level;
      const isNext = this.game.innRank + 1 === lvl.level;
      const milestone = this.game.rankMilestones[lvl.level];

      const card = document.createElement('div');
      card.className = `upgrade-card${
        !isReached && !isNext ? ' locked' : ''
      }`;
      if (isNext) {
        card.style.borderColor = 'var(--accent-gold)';
      }

      const goalsHtml =
        lvl.goals.length === 0
          ? `<span class="hud-goal-chip done">✅ 시작 등급</span>`
          : lvl.goals
              .map((g) => {
                const st = this.game.evaluateGoalCondition(g);
                return `<span class="hud-goal-chip${
                  st.completed ? ' done' : ''
                }">${st.completed ? '✅' : '▫️'} ${g.label} (${formatGold(
                  st.current
                )}/${formatGold(st.target)})</span>`;
              })
              .join(' ');

      card.innerHTML = `
        <div class="upgrade-info">
          <div class="upgrade-icon">${
            isReached ? '🏆' : isNext ? '🎯' : '🔒'
          }</div>
          <div class="upgrade-text-wrap">
            <div class="upgrade-title-row">
              <span class="upgrade-name">${lvl.title}</span>
              <span class="upgrade-level-badge">${
                isReached
                  ? milestone
                    ? `달성 완료 (${milestone.day}일차)`
                    : '달성 완료'
                  : isNext
                  ? '현재 도전 목표'
                  : '상위 등급'
              }</span>
            </div>
            <p class="upgrade-effects">승급 혜택: ${lvl.rewardText}</p>
            <div class="trait-row" style="margin-top:5px">${goalsHtml}</div>
          </div>
        </div>
      `;
      rankPanel.appendChild(card);
    }
    this.elUpgradeList.appendChild(rankPanel);

    // 선택 퀘스트 / 업적 목록
    const questPanel = document.createElement('div');
    questPanel.className = 'section-panel';
    const doneCnt = Object.values(this.game.completedQuests).filter(
      Boolean
    ).length;
    questPanel.innerHTML = `
      <div class="panel-subtitle">🏅 선택 퀘스트 &amp; 여관 업적 (${doneCnt}/${OPTIONAL_QUESTS.length} 달성)</div>
    `;

    for (const q of OPTIONAL_QUESTS) {
      const done = Boolean(this.game.completedQuests[q.id]);
      const card = document.createElement('div');
      card.className = `upgrade-card compact-card${done ? '' : ' locked'}`;
      card.innerHTML = `
        <div class="upgrade-info">
          <div class="upgrade-icon">${q.icon}</div>
          <div class="upgrade-text-wrap">
            <div class="upgrade-title-row">
              <span class="upgrade-name">${q.title}</span>
              <span class="upgrade-level-badge">${
                done ? '✅ 달성 완료' : `보상 +${q.rewardGold}G · 평판 +${q.rewardRep}`
              }</span>
            </div>
            <p class="upgrade-desc">${q.description}</p>
          </div>
        </div>
      `;
      questPanel.appendChild(card);
    }
    this.elUpgradeList.appendChild(questPanel);
  }

  // --------------------------------------------------------------------------
  // 0-B. 📊 통계·장부 탭 (일별 수입·지출·순이익 바 차트 + 급료/유지비 명세)
  // --------------------------------------------------------------------------
  private buildStatsAndLedgerTab(): void {
    const wagesInfo = this.game.getDailyWagesBreakdown();
    const upkeepCost = this.game.getDailyUpkeepCost();
    const cur = this.game.currentDayLedger;

    // 1. 최근 일별 수입·지출·순이익 차트
    const chartPanel = document.createElement('div');
    chartPanel.className = 'section-panel';

    const chartDays: DailyFinancialReport[] = [
      ...this.game.dayHistory.slice(-9),
      cur,
    ];
    let maxBarVal = 100;
    for (const d of chartDays) {
      maxBarVal = Math.max(
        maxBarVal,
        d.income.totalIncome,
        d.expense.totalOperatingExpense
      );
    }

    const barsHtml = chartDays
      .map((d) => {
        const isToday = d.day === this.game.dayNumber && d === cur;
        const incH = Math.max(
          4,
          Math.round((d.income.totalIncome / maxBarVal) * 82)
        );
        const expH = Math.max(
          4,
          Math.round((d.expense.totalOperatingExpense / maxBarVal) * 82)
        );
        return `
          <div class="chart-day-col">
            <span class="chart-net-label ${d.netProfit < 0 ? 'neg' : ''}">${formatSignedGold(
          d.netProfit
        )}G</span>
            <div class="chart-pair-bars" title="${d.day}일차: 수입 +${d.income.totalIncome}G / 운영지출 -${d.expense.totalOperatingExpense}G">
              <div class="chart-bar-inc" style="height:${incH}px"></div>
              <div class="chart-bar-exp" style="height:${expH}px"></div>
            </div>
            <span class="chart-day-label">${d.day}일${
          isToday ? '(오늘)' : ''
        }</span>
          </div>
        `;
      })
      .join('');

    chartPanel.innerHTML = `
      <div class="panel-subtitle">📊 일별 수입 · 운영지출 · 순이익 추이 차트 (하루 = 실시간 4분)</div>
      <div class="stats-chart-container">
        <div class="chart-legend">
          <span><i class="legend-dot" style="background:#7eb38a"></i>일일 총수입 (식음료·서빙·객실·포션·대장간)</span>
          <span><i class="legend-dot" style="background:#c7635b"></i>운영 지출 (급료·유지비·조제단조·전리품매입)</span>
          <span><i class="legend-dot" style="background:#ebd186"></i>상단 숫자: 일일 영업 순이익</span>
        </div>
        <div class="chart-bars-grid">
          ${barsHtml}
        </div>
      </div>
    `;
    this.elUpgradeList.appendChild(chartPanel);

    // 2. 고용 직원 급료 및 일일 유지비 명세
    const wagePanel = document.createElement('div');
    wagePanel.className = 'section-panel';
    const staffRows =
      wagesInfo.items.length > 0
        ? wagesInfo.items
            .map(
              (st) =>
                `<div class="report-row"><span>${st.icon} ${st.name} (Lv.${st.level})</span><strong style="color:#e3958d">-${st.wage} G/일</strong></div>`
            )
            .join('')
        : `<p class="empty-hint">현재 고용된 유급 직원이 없습니다 (여관 주인이 직접 기본 서빙 중 · 일일 급료 0G).</p>`;

    wagePanel.innerHTML = `
      <div class="panel-subtitle">🧑‍🍳 일일 고정비 명세 (급료 합계 -${wagesInfo.totalWages}G/일 · 시설 유지비 -${upkeepCost}G/일)</div>
      <div class="offline-report-box">
        ${staffRows}
        <div class="report-row highlight-row">
          <span>🕯️ 여관 기본 연료·식자재·시설 유지비</span>
          <strong style="color:#e3958d">-${upkeepCost} G/일</strong>
        </div>
      </div>
    `;
    this.elUpgradeList.appendChild(wagePanel);

    // 3. 일별 상세 장부 기록 리스트
    const historyPanel = document.createElement('div');
    historyPanel.className = 'section-panel';
    historyPanel.innerHTML = `<div class="panel-subtitle">📜 일별 결산 장부 기록 (최근 ${chartDays.length}일)</div>`;

    for (const d of [...chartDays].reverse()) {
      const isToday = d.day === this.game.dayNumber && d === cur;
      const row = document.createElement('div');
      row.className = `history-row ${d.netProfit >= 0 ? 'win' : 'lose'}`;
      row.innerHTML = `
        <div>
          <strong>[${d.day}일차${isToday ? ' · 진행 중' : ''}] ${
        d.innRankTitle
      } — 순이익 ${formatSignedGold(d.netProfit)} G</strong>
          <span>(보유 골드 ${formatGold(d.endGold)}G)</span>
        </div>
        <div class="history-sub">
          수입 +${formatGold(d.income.totalIncome)}G (서빙 ${
        d.income.guestServing
      } · 식음료 ${d.income.foodAndDrink} · 객실 ${
        d.income.roomAndRest
      } · 포션 ${d.income.potionSales} · 대장간 ${
        d.income.blacksmithSales
      } · 수수료 ${d.income.lootMargin}) |
          운영지출 -${formatGold(
            d.expense.totalOperatingExpense
          )}G (급료 ${d.expense.wages} · 유지비 ${
        d.expense.upkeep
      } · 제작 ${d.expense.craftCost} · 매입 ${
        d.expense.lootPurchase
      }) | 시설투자 -${formatGold(d.expense.facilityInvest)}G
        </div>
      `;
      historyPanel.appendChild(row);
    }
    this.elUpgradeList.appendChild(historyPanel);
  }

  // --------------------------------------------------------------------------
  // 1. 🦸 영웅 명단 탭
  // --------------------------------------------------------------------------
  private buildHeroesTab(): void {
    const unlockedCount = this.game.getUnlockedHeroCount();

    const filterBar = document.createElement('div');
    filterBar.className = 'sub-filter-bar';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `chip-btn${
      this.heroFilterClass === 'all' ? ' active' : ''
    }`;
    allBtn.textContent = `전체 (${unlockedCount}/${HERO_ROSTER.length})`;
    allBtn.addEventListener('click', () => {
      this.heroFilterClass = 'all';
      this.buildTabCards();
    });
    filterBar.appendChild(allBtn);

    for (const cls of Object.values(HERO_CLASSES)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-btn${
        this.heroFilterClass === cls.id ? ' active' : ''
      }`;
      btn.textContent = `${cls.icon} ${cls.name}`;
      btn.addEventListener('click', () => {
        this.heroFilterClass = cls.id;
        this.buildTabCards();
      });
      filterBar.appendChild(btn);
    }
    this.elUpgradeList.appendChild(filterBar);

    const sortedRoster = [...HERO_ROSTER]
      .filter(
        (r) =>
          this.heroFilterClass === 'all' || r.classId === this.heroFilterClass
      )
      .sort((a, b) => {
        const ua = this.game.heroes[a.id]?.unlocked ? 1 : 0;
        const ub = this.game.heroes[b.id]?.unlocked ? 1 : 0;
        if (ua !== ub) return ub - ua;
        return (
          (this.game.heroes[b.id]?.level ?? 1) -
          (this.game.heroes[a.id]?.level ?? 1)
        );
      });

    for (const roster of sortedRoster) {
      const state = this.game.heroes[roster.id];
      const cls = HERO_CLASSES[roster.classId];
      const origin = ORIGINS[roster.originId];

      const card = document.createElement('div');
      card.className = `hero-card${state.unlocked ? '' : ' locked'}${
        this.game.selectedHeroId === state.id ? ' selected-hero-card' : ''
      }`;

      if (!state.unlocked) {
        card.innerHTML = `
          <div class="hero-card-header">
            <div class="upgrade-icon">❔</div>
            <div class="upgrade-text-wrap">
              <div class="upgrade-title-row">
                <span class="upgrade-name">${roster.name} — ${roster.title}</span>
                <span class="upgrade-level-badge">${cls.icon} ${cls.name} (${cls.roleName})</span>
              </div>
              <p class="upgrade-desc">소문만 들림: "${roster.backstory}"</p>
              <p class="upgrade-effects">성격: ${roster.personalities
                .map((p) => `${PERSONALITIES[p].icon}${PERSONALITIES[p].name}`)
                .join(' · ')} | 출신: ${origin.icon}${origin.name} (${origin.description})</p>
              <p class="upgrade-unlock-req">🔒 합류 조건: ${roster.unlock.description}</p>
            </div>
          </div>
        `;
        this.elUpgradeList.appendChild(card);
        continue;
      }

      const bd = getHeroStatBreakdown(state);
      const reqXp = getHeroRequiredXp(state.level);
      const statusLabels: Record<
        HeroState['status'],
        { text: string; cls: string }
      > = {
        idle: { text: '🏠 여관 활동 중', cls: 'status-idle' },
        exploring: { text: '🗺️ 던전 원정 중', cls: 'status-exploring' },
        resting: { text: '🛏️ 휴식 중', cls: 'status-resting' },
        injured: {
          text: `🩸 부상 (${Math.ceil(state.restTimerSec)}초)`,
          cls: 'status-injured',
        },
        fatigued: {
          text: `💦 피로 (${Math.ceil(state.restTimerSec)}초)`,
          cls: 'status-fatigued',
        },
      };
      const stInfo = statusLabels[state.status];

      const header = document.createElement('div');
      header.className = 'hero-card-header';

      const iconBox = document.createElement('div');
      iconBox.className = 'upgrade-icon';
      const img = document.createElement('img');
      img.src = getHeroPortraitDataUrl(roster.id);
      img.alt = roster.name;
      img.className = 'pixel-portrait';
      iconBox.appendChild(img);

      const textWrap = document.createElement('div');
      textWrap.className = 'upgrade-text-wrap';
      textWrap.innerHTML = `
        <div class="upgrade-title-row">
          <span class="upgrade-name">${roster.name} <small class="hero-title-sub">(${
        roster.title
      })</small></span>
          <span class="upgrade-level-badge">Lv.${state.level} (XP ${
        state.xp
      }/${reqXp})</span>
          <span class="role-badge role-${cls.role}">${cls.icon} ${cls.name} · ${
        cls.roleName
      }</span>
          <span class="status-pill ${stInfo.cls}">${stInfo.text}</span>
        </div>
        <p class="upgrade-desc">🧭 현재 의도: <b>${
          state.intentText ?? '여관 홀 대기 중'
        }</b></p>
        <div class="trait-row">
          ${roster.personalities
            .map(
              (p) =>
                `<span class="trait-chip" title="${PERSONALITIES[p].description}">${PERSONALITIES[p].icon} ${PERSONALITIES[p].name}</span>`
            )
            .join('')}
          <span class="trait-chip origin-chip" title="${origin.description}">${
        origin.icon
      } ${origin.name}</span>
          <span class="trait-chip gold-chip">💰 ${formatGold(state.gold)} G</span>
          <span class="trait-chip">🍖 허기 ${Math.round(state.hunger ?? 20)}%</span>
          <span class="trait-chip">💦 피로 ${Math.round(
            state.fatigue ?? 10
          )}%</span>
        </div>
        <div class="stat-pill-row">
          <span>⚔️전투력 <b>${bd.combatPower}</b></span>
          <span>ATK <b>${bd.totalStats.atk}</b> <small>(+${
        bd.equipStats.atk
      })</small></span>
          <span>DEF <b>${bd.totalStats.def}</b> <small>(+${
        bd.equipStats.def
      })</small></span>
          <span>AGI <b>${bd.totalStats.agi}</b> <small>(+${
        bd.equipStats.agi
      })</small></span>
          <span>INT <b>${bd.totalStats.int}</b> <small>(+${
        bd.equipStats.int
      })</small></span>
          <span>HP <b>${state.currentHp}/${bd.totalStats.hp}</b></span>
          <span>LUK <b>${bd.totalStats.luk}</b></span>
        </div>
      `;

      if (state.buffs.length > 0) {
        const buffRow = document.createElement('div');
        buffRow.className = 'buff-row';
        buffRow.innerHTML =
          `활성 버프: ` +
          state.buffs
            .map(
              (b) =>
                `<span class="buff-tag">${b.icon} ${b.name} (${b.remainingRuns}회)</span>`
            )
            .join(' ');
        textWrap.appendChild(buffRow);
      }

      header.appendChild(iconBox);
      header.appendChild(textWrap);
      card.appendChild(header);

      const equipGrid = document.createElement('div');
      equipGrid.className = 'hero-equip-grid';

      for (const slot of ['weapon', 'armor', 'offhand', 'accessory'] as EquipSlot[]) {
        const inst = state.equipment[slot];
        const def = EQUIPMENT_DEF_MAP[inst.defId];
        const rarity = RARITY_INFO[def.rarity];
        const eqStats = getEquipmentEffectiveStats(inst);
        const statStr = Object.entries(eqStats)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k.toUpperCase()}+${v}`)
          .join(' ');

        const slotBox = document.createElement('div');
        slotBox.className = 'equip-slot-box';
        slotBox.style.borderColor = rarity.color;

        const topLine = document.createElement('div');
        topLine.className = 'equip-slot-top';
        topLine.innerHTML = `
          <span class="slot-type-label">${EQUIP_SLOT_LABELS[slot]}</span>
          <span class="rarity-tag" style="background:${rarity.badgeBg};color:${rarity.color}">${rarity.label}</span>
        `;

        const nameLine = document.createElement('div');
        nameLine.className = 'equip-item-name';
        nameLine.style.color = rarity.color;
        nameLine.textContent = `${def.icon} ${def.name}${
          inst.enhanceLevel > 0 ? ` +${inst.enhanceLevel}` : ''
        }`;

        const statLine = document.createElement('div');
        statLine.className = 'equip-item-stats';
        statLine.textContent = statStr || '기본 장비';

        slotBox.appendChild(topLine);
        slotBox.appendChild(nameLine);
        slotBox.appendChild(statLine);

        const btnRow = document.createElement('div');
        btnRow.className = 'equip-slot-actions';

        if (!def.isBase && inst.enhanceLevel < 15) {
          const enhPreview = this.game.getEnhancePreview({
            heroId: state.id,
            slot,
          });
          if (enhPreview) {
            const enhBtn = document.createElement('button');
            enhBtn.type = 'button';
            enhBtn.className = 'mini-action-btn enhance-btn';
            const pct = (enhPreview.successRate * 100).toFixed(0);
            enhBtn.textContent = `🔥 +${enhPreview.nextLevel} 강화 (${pct}%)`;
            enhBtn.addEventListener('click', () => {
              this.openEnhanceConfirmModal({ heroId: state.id, slot });
            });
            btnRow.appendChild(enhBtn);
          }
        }

        const compatibleStock = this.game.equipmentStock.filter((s) => {
          const sDef = EQUIPMENT_DEF_MAP[s.defId];
          return sDef && sDef.slot === slot && canClassEquip(cls.id, sDef);
        });
        if (compatibleStock.length > 0) {
          const bestStock = compatibleStock[0];
          const sDef = EQUIPMENT_DEF_MAP[bestStock.defId];
          const eqBtn = document.createElement('button');
          eqBtn.type = 'button';
          eqBtn.className = 'mini-action-btn equip-swap-btn';
          eqBtn.textContent = `🔄 ${sDef.name}${
            bestStock.enhanceLevel > 0 ? `+${bestStock.enhanceLevel}` : ''
          } 장착`;
          eqBtn.addEventListener('click', () => {
            this.game.equipItemToHero(state.id, bestStock.uid);
            this.renderHeroInspectorPanel(true);
            this.buildTabCards();
          });
          btnRow.appendChild(eqBtn);
        }

        slotBox.appendChild(btnRow);
        equipGrid.appendChild(slotBox);
      }

      card.appendChild(equipGrid);

      const actionBar = document.createElement('div');
      actionBar.className = 'hero-care-bar';

      const inspectBtn = document.createElement('button');
      inspectBtn.type = 'button';
      inspectBtn.className = `care-btn${
        this.game.selectedHeroId === state.id ? ' active-toggle' : ''
      }`;
      inspectBtn.textContent = '🎯 상태·행동 지시 서랍 열기';
      inspectBtn.addEventListener('click', () => {
        this.game.selectedHeroId = state.id;
        this.renderHeroInspectorPanel(true);
        this.buildTabCards();
      });
      actionBar.appendChild(inspectBtn);

      const mealBtn = document.createElement('button');
      mealBtn.type = 'button';
      mealBtn.className = 'care-btn';
      const unlockedMeals = this.game.getUnlockedMeals();
      const topMeal = unlockedMeals[unlockedMeals.length - 1];
      const mealInfo = this.game.getMealEffectiveBuff(topMeal.upgradeId);
      const treatCost = Math.max(4, Math.floor(mealInfo.price * 0.6));
      mealBtn.disabled = this.game.gold < treatCost;
      mealBtn.textContent = `${topMeal.icon} 요리 대접 (${treatCost}G)`;
      mealBtn.addEventListener('click', () => {
        if (this.game.treatHeroMeal(state.id, topMeal.upgradeId)) {
          this.renderHeroInspectorPanel(true);
          this.buildTabCards();
        }
      });
      actionBar.appendChild(mealBtn);

      if (state.status === 'injured' || state.status === 'fatigued') {
        const restBtn = document.createElement('button');
        restBtn.type = 'button';
        restBtn.className = 'care-btn heal-btn';
        restBtn.disabled = this.game.gold < 8;
        restBtn.textContent = `🛏️ 특실 즉시 회복 (8G)`;
        restBtn.addEventListener('click', () => {
          if (this.game.restHeroInRoom(state.id)) {
            this.renderHeroInspectorPanel(true);
            this.buildTabCards();
          }
        });
        actionBar.appendChild(restBtn);
      }

      const availPotion = POTION_RECIPES.slice()
        .reverse()
        .find((p) => (this.game.potionStock[p.id] ?? 0) > 0);
      if (availPotion) {
        const potBtn = document.createElement('button');
        potBtn.type = 'button';
        potBtn.className = 'care-btn potion-btn';
        potBtn.textContent = `${availPotion.icon} ${
          availPotion.name
        } 지급 (${this.game.potionStock[availPotion.id]})`;
        potBtn.addEventListener('click', () => {
          if (this.game.givePotionToHero(state.id, availPotion.id, false)) {
            this.renderHeroInspectorPanel(true);
            this.buildTabCards();
          }
        });
        actionBar.appendChild(potBtn);
      }

      card.appendChild(actionBar);
      this.elUpgradeList.appendChild(card);
    }
  }

  // --------------------------------------------------------------------------
  // 2. 💎 상점 판매 설정 & 전리품 거래소 탭
  // --------------------------------------------------------------------------
  private buildTradeTab(): void {
    const cfg = this.game.shopConfig;

    const stageConfigPanel = document.createElement('div');
    stageConfigPanel.className = 'section-panel';
    stageConfigPanel.innerHTML = `
      <div class="panel-subtitle">🎪 여관 상점 판매 &amp; 전리품 매입 시세 설정 (영웅 자율 반응)</div>
      <p class="upgrade-desc">초당 자동 골드가 없으므로 영웅들이 여관 식당·포션 가게·대장간에서 지갑을 열게 하는 것이 핵심 수입원입니다.</p>

      <div class="market-config-grid">
        <div class="market-config-box">
          <div class="mc-header">
            <strong>🍲 식당·바 요리 판매</strong>
            <button type="button" id="btn-toggle-meal-sale" class="mc-toggle-btn ${
              cfg.mealSaleEnabled ? 'on' : 'off'
            }">${cfg.mealSaleEnabled ? '판매 중 (ON)' : '판매 중단 (OFF)'}</button>
          </div>
          <div class="mc-rate-row">
            ${[
              { m: 0.8, label: '80% 할인' },
              { m: 1.0, label: '100% 정가' },
              { m: 1.25, label: '125% 할증' },
              { m: 1.5, label: '150% 고급' },
            ]
              .map(
                (opt) =>
                  `<button type="button" class="mc-chip ${
                    cfg.mealPriceMultiplier === opt.m ? 'active' : ''
                  }" data-meal-mult="${opt.m}">${opt.label}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="market-config-box">
          <div class="mc-header">
            <strong>⚗️ 포션 가게 판매 시세</strong>
            <span class="mc-sub-note">재고 ${Object.values(
              this.game.potionStock
            ).reduce((a, b) => a + b, 0)}병</span>
          </div>
          <div class="mc-rate-row">
            ${[
              { m: 0.8, label: '80% 할인' },
              { m: 1.0, label: '100% 정가' },
              { m: 1.25, label: '125% 할증' },
              { m: 1.5, label: '150% 고급' },
            ]
              .map(
                (opt) =>
                  `<button type="button" class="mc-chip ${
                    cfg.potionPriceMultiplier === opt.m ? 'active' : ''
                  }" data-pot-mult="${opt.m}">${opt.label}</button>`
              )
              .join('')}
          </div>
        </div>

        <div class="market-config-box">
          <div class="mc-header">
            <strong>⚒️ 대장간 장비 판매 &amp; 강화 의뢰</strong>
            <button type="button" id="btn-toggle-smith-sale" class="mc-toggle-btn ${
              cfg.blacksmithSaleEnabled ? 'on' : 'off'
            }">${
      cfg.blacksmithSaleEnabled ? '판매 허용 (ON)' : '판매 중단 (OFF)'
    }</button>
          </div>
          <div class="mc-rate-row">
            ${[
              { m: 0.8, label: '80% 할인' },
              { m: 1.0, label: '100% 정가' },
              { m: 1.25, label: '125% 할증' },
            ]
              .map(
                (opt) =>
                  `<button type="button" class="mc-chip ${
                    cfg.blacksmithPriceMultiplier === opt.m ? 'active' : ''
                  }" data-smith-mult="${opt.m}">${opt.label}</button>`
              )
              .join('')}
            <button type="button" id="btn-toggle-auto-enh" class="mc-chip ${
              cfg.blacksmithAutoEnhanceEnabled ? 'active' : ''
            }">🔥 영웅 자율 +강화 의뢰: ${
      cfg.blacksmithAutoEnhanceEnabled ? 'ON' : 'OFF'
    }</button>
          </div>
        </div>

        <div class="market-config-box">
          <div class="mc-header">
            <strong>💎 전리품 일괄 매입 시세</strong>
            <button type="button" id="btn-toggle-autobuy" class="mc-toggle-btn ${
              this.game.autoBuyLoot ? 'on' : 'off'
            }">가판대 자동매입: ${this.game.autoBuyLoot ? 'ON' : 'OFF'}</button>
          </div>
          <div class="mc-rate-row">
            ${[
              { r: 75, label: '75% 저가' },
              { r: 90, label: '90% 알뜰' },
              { r: 100, label: '100% 정가' },
              { r: 115, label: '115% 우대' },
            ]
              .map(
                (opt) =>
                  `<button type="button" class="mc-chip ${
                    cfg.lootBuyRatePct === opt.r ? 'active' : ''
                  }" data-loot-rate="${opt.r}">${opt.label}</button>`
              )
              .join('')}
          </div>
        </div>
      </div>
    `;

    this.elUpgradeList.appendChild(stageConfigPanel);

    document
      .getElementById('btn-toggle-meal-sale')
      ?.addEventListener('click', () => {
        cfg.mealSaleEnabled = !cfg.mealSaleEnabled;
        this.buildTabCards();
      });
    document
      .getElementById('btn-toggle-smith-sale')
      ?.addEventListener('click', () => {
        cfg.blacksmithSaleEnabled = !cfg.blacksmithSaleEnabled;
        this.buildTabCards();
      });
    document
      .getElementById('btn-toggle-auto-enh')
      ?.addEventListener('click', () => {
        cfg.blacksmithAutoEnhanceEnabled = !cfg.blacksmithAutoEnhanceEnabled;
        this.buildTabCards();
      });
    document
      .getElementById('btn-toggle-autobuy')
      ?.addEventListener('click', () => {
        this.game.autoBuyLoot = !this.game.autoBuyLoot;
        this.buildTabCards();
      });

    stageConfigPanel
      .querySelectorAll<HTMLButtonElement>('[data-meal-mult]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          cfg.mealPriceMultiplier = Number(btn.dataset.mealMult);
          this.buildTabCards();
        });
      });
    stageConfigPanel
      .querySelectorAll<HTMLButtonElement>('[data-pot-mult]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          cfg.potionPriceMultiplier = Number(btn.dataset.potMult);
          this.buildTabCards();
        });
      });
    stageConfigPanel
      .querySelectorAll<HTMLButtonElement>('[data-smith-mult]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          cfg.blacksmithPriceMultiplier = Number(btn.dataset.smithMult);
          this.buildTabCards();
        });
      });
    stageConfigPanel
      .querySelectorAll<HTMLButtonElement>('[data-loot-rate]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          cfg.lootBuyRatePct = Number(btn.dataset.lootRate);
          this.buildTabCards();
        });
      });

    const summary = this.game.getPendingLootSummary();
    const tradeTopPanel = document.createElement('div');
    tradeTopPanel.className = 'section-panel';

    const headerRow = document.createElement('div');
    headerRow.className = 'trade-header-row';
    headerRow.innerHTML = `
      <div>
        <div class="panel-subtitle">💰 거래 가판대 — 영웅 전리품 대기 목록 (${
          summary.totalCount
        }개 / 매입 총액 ${formatGold(summary.totalCost)} G)</div>
        <p class="upgrade-desc">전리품을 매입하면 지출로 기록되고 영웅의 보유 골드가 늘어나 여관 내 식사·포션·장비 소비로 되돌아옵니다.</p>
      </div>
    `;

    const actionWrap = document.createElement('div');
    actionWrap.className = 'party-header-btns';

    const buyAllBtn = document.createElement('button');
    buyAllBtn.type = 'button';
    buyAllBtn.className = 'buy-btn';
    buyAllBtn.disabled = summary.totalCount === 0 || this.game.gold < 4;
    buyAllBtn.innerHTML = `
      <span class="buy-btn-label">켜진 품목 일괄 매입</span>
      <span class="buy-btn-cost">${formatGold(summary.totalCost)} G</span>
    `;
    buyAllBtn.addEventListener('click', () => {
      this.game.buyAllHeroLoot(0);
      this.buildTabCards();
    });
    actionWrap.appendChild(buyAllBtn);
    headerRow.appendChild(actionWrap);
    tradeTopPanel.appendChild(headerRow);

    if (summary.items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-hint';
      empty.textContent =
        '현재 영웅 가방에 매입 대기 중인 전리품이 없습니다. 던전 원정대가 귀환하면 거래 가판대로 걸어옵니다.';
      tradeTopPanel.appendChild(empty);
    } else {
      for (const item of summary.items) {
        const rarity =
          RARITY_INFO[item.rarity as keyof typeof RARITY_INFO] ??
          RARITY_INFO.common;
        const row = document.createElement('div');
        row.className = 'upgrade-card compact-card';
        row.innerHTML = `
          <div class="upgrade-info">
            <div class="upgrade-icon">${item.icon}</div>
            <div class="upgrade-text-wrap">
              <div class="upgrade-title-row">
                <span class="upgrade-name" style="color:${rarity.color}">${
          item.materialName
        } x${item.count}</span>
                <span class="upgrade-level-badge">보유: ${item.heroName}</span>
                <span class="upgrade-level-badge">매입 단가 ${
                  item.unitPrice
                }G</span>
              </div>
            </div>
          </div>
        `;
        const bBtn = document.createElement('button');
        bBtn.type = 'button';
        bBtn.className = 'buy-btn';
        bBtn.disabled = this.game.gold < item.unitPrice;
        bBtn.innerHTML = `
          <span class="buy-btn-label">즉시 매입</span>
          <span class="buy-btn-cost">${formatGold(item.totalPrice)} G</span>
        `;
        bBtn.addEventListener('click', () => {
          this.game.buyHeroLoot(item.heroId, item.materialId);
          this.buildTabCards();
        });
        row.appendChild(bBtn);
        tradeTopPanel.appendChild(row);
      }
    }
    this.elUpgradeList.appendChild(tradeTopPanel);

    const warehousePanel = document.createElement('div');
    warehousePanel.className = 'section-panel';
    warehousePanel.innerHTML = `
      <div class="panel-subtitle">📦 종류별 전리품 매입 허용 설정 &amp; 여관 재료 창고</div>
    `;

    const matGrid = document.createElement('div');
    matGrid.className = 'warehouse-grid';
    for (const m of MATERIALS) {
      const cnt = this.game.materials[m.id] ?? 0;
      const rInfo = RARITY_INFO[m.rarity];
      const dName = DUNGEON_MAP[m.sourceDungeonId]?.name ?? m.sourceDungeonId;
      const isBuyOn = cfg.lootBuyEnabled[m.id] !== false;
      const effBuyPrice = this.game.getEffectiveMaterialBuyPrice(m.id);

      const box = document.createElement('div');
      box.className = 'warehouse-item';
      box.style.borderColor = cnt > 0 ? rInfo.color : '#4e382b';
      box.innerHTML = `
        <div class="wh-top">
          <span>${m.icon} <b style="color:${rInfo.color}">${m.name}</b></span>
          <strong class="wh-count">${formatGold(cnt)}개</strong>
        </div>
        <div class="wh-sub">[${rInfo.label}] 매입가 ${effBuyPrice}G (정가 ${
        m.buyPrice
      }G) · ${dName}</div>
        <div class="wh-action-row">
          <button type="button" class="mc-toggle-btn ${
            isBuyOn ? 'on' : 'off'
          }" data-toggle-mat-buy="${m.id}">
            ${isBuyOn ? '✅ 매입 ON' : '⛔ 매입 OFF'}
          </button>
        </div>
      `;
      matGrid.appendChild(box);
    }
    warehousePanel.appendChild(matGrid);
    this.elUpgradeList.appendChild(warehousePanel);

    warehousePanel
      .querySelectorAll<HTMLButtonElement>('[data-toggle-mat-buy]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const mId = btn.dataset.toggleMatBuy!;
          cfg.lootBuyEnabled[mId] = !(cfg.lootBuyEnabled[mId] !== false);
          this.buildTabCards();
        });
      });
  }

  // --------------------------------------------------------------------------
  // 3. 🗺️ 던전 & 파티 시너지 미리보기 탭
  // --------------------------------------------------------------------------
  private buildDungeonTab(): void {
    const maxPartySize = this.game.getMaxPartySize();
    const dungeon = DUNGEON_MAP[this.selectedDungeonId] ?? DUNGEONS[0];

    this.selectedPartyHeroIds = this.selectedPartyHeroIds.filter((id) => {
      const h = this.game.heroes[id];
      return h && h.unlocked && h.status === 'idle' && !h.expeditionId;
    });

    if (this.game.expeditions.length > 0) {
      const activeBox = document.createElement('div');
      activeBox.className = 'section-panel';
      activeBox.innerHTML = `<div class="panel-subtitle">🧭 현재 탐험 중인 원정대 (${this.game.expeditions.length}/${this.game.getMaxConcurrentExpeditions()}팀)</div>`;

      for (const exp of this.game.expeditions) {
        const d = DUNGEON_MAP[exp.dungeonId];
        const names = exp.heroIds
          .map((id) => HERO_ROSTER_MAP[id]?.name ?? id)
          .join(' · ');
        const pct = Math.min(
          100,
          Math.max(
            0,
            ((exp.totalDurationSec - exp.remainingSec) /
              Math.max(1, exp.totalDurationSec)) *
              100
          )
        );
        const row = document.createElement('div');
        row.className = 'expedition-progress-card';
        row.dataset.expId = exp.id;
        row.innerHTML = `
          <div class="exp-row-top">
            <strong>${d?.icon ?? '🗺️'} ${d?.name ?? exp.dungeonId}</strong>
            <span>파티: ${names} (성공률 ${Math.round(
          exp.expectedSuccessRate * 100
        )}%)</span>
            <strong class="mini-progress-text">${exp.currentFloor ?? 1}/${
          exp.totalFloors ?? 3
        }층 · ${Math.ceil(exp.remainingSec)}초 남음</strong>
          </div>
          <div class="mini-progress-track">
            <div class="mini-progress-fill" style="width:${pct.toFixed(
              1
            )}%"></div>
          </div>
        `;
        activeBox.appendChild(row);
      }
      this.elUpgradeList.appendChild(activeBox);
    }

    const builderPanel = document.createElement('div');
    builderPanel.className = 'section-panel synergy-builder-panel';

    const dungeonSelector = document.createElement('div');
    dungeonSelector.className = 'sub-filter-bar';
    for (const d of DUNGEONS) {
      const unlocked = this.game.isDungeonUnlocked(d.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip-btn${
        this.selectedDungeonId === d.id ? ' active' : ''
      }${unlocked ? '' : ' chip-locked'}`;
      const clears = this.game.dungeonClears[d.id] ?? 0;
      btn.textContent = `${unlocked ? d.icon : '🔒'} T${d.tier}. ${
        d.name
      } (${clears}회)`;
      btn.addEventListener('click', () => {
        this.selectedDungeonId = d.id;
        this.buildTabCards();
      });
      dungeonSelector.appendChild(btn);
    }
    builderPanel.appendChild(dungeonSelector);

    const dUnlocked = this.game.isDungeonUnlocked(dungeon.id);
    const dInfo = document.createElement('div');
    dInfo.className = 'dungeon-detail-box';
    const dropText = dungeon.drops
      .map(
        (dr) =>
          `${MATERIAL_MAP[dr.materialId]?.icon ?? ''}${
            MATERIAL_MAP[dr.materialId]?.name ?? dr.materialId
          } (${Math.round(dr.chance * 100)}%)`
      )
      .join(', ');

    let unlockReqText = '';
    if (!dUnlocked) {
      const prevD = dungeon.unlockPrevDungeonId
        ? DUNGEON_MAP[dungeon.unlockPrevDungeonId]?.name
        : '';
      unlockReqText = `<p class="upgrade-unlock-req">🔒 해금 조건: 여관 평판 ${dungeon.unlockRep} 이상 & ${prevD} ${dungeon.unlockPrevClears}회 클리어</p>`;
    }

    dInfo.innerHTML = `
      <div class="upgrade-title-row">
        <span class="upgrade-name">${dungeon.icon} [Tier ${dungeon.tier}] ${dungeon.name}</span>
        <span class="upgrade-level-badge">⏱️ 기본 ${dungeon.durationSec}초</span>
        <span class="upgrade-level-badge">권장 전투력 ${dungeon.recommendedPower}</span>
      </div>
      <p class="upgrade-desc">${dungeon.description}</p>
      <p class="upgrade-effects">🎯 요구 프로필: ${dungeon.focusText}</p>
      <p class="dungeon-req-stats">권장 스탯 합계: ATK ${dungeon.requiredStats.atk} · DEF ${dungeon.requiredStats.def} · AGI ${dungeon.requiredStats.agi} · INT ${dungeon.requiredStats.int} · HP ${dungeon.requiredStats.hp} · LUK ${dungeon.requiredStats.luk}</p>
      <p class="dungeon-drops-line">🎁 보상: XP +${dungeon.rewardXp} · 영웅 골드 +${dungeon.rewardHeroGold}G · 평판 +${dungeon.rewardRep} | 전리품: ${dropText}</p>
      ${unlockReqText}
    `;
    builderPanel.appendChild(dInfo);

    const partyHeader = document.createElement('div');
    partyHeader.className = 'party-picker-header';
    partyHeader.innerHTML = `
      <strong>👥 출정 파티 편성 (${this.selectedPartyHeroIds.length} / 최대 ${maxPartySize}명)</strong>
    `;

    const autoButtonsWrap = document.createElement('div');
    autoButtonsWrap.className = 'party-header-btns';

    const autoPickBtn = document.createElement('button');
    autoPickBtn.type = 'button';
    autoPickBtn.className = 'care-btn';
    autoPickBtn.textContent = '⚡ 최적 시너지 파티 자동 편성';
    autoPickBtn.addEventListener('click', () => {
      const best = selectBestPartyForDungeon(
        this.game.getUnlockedHeroes(),
        dungeon,
        maxPartySize
      );
      this.selectedPartyHeroIds = best.map((h) => h.id);
      this.buildTabCards();
    });
    autoButtonsWrap.appendChild(autoPickBtn);

    const autoDispatchBtn = document.createElement('button');
    autoDispatchBtn.type = 'button';
    autoDispatchBtn.className = `care-btn${
      this.game.autoDispatch ? ' active-toggle' : ''
    }`;
    autoDispatchBtn.textContent = `🤖 영웅 자율 파티·출발: ${
      this.game.autoDispatch ? 'ON' : 'OFF'
    }`;
    autoDispatchBtn.addEventListener('click', () => {
      this.game.autoDispatch = !this.game.autoDispatch;
      this.buildTabCards();
    });
    autoButtonsWrap.appendChild(autoDispatchBtn);

    partyHeader.appendChild(autoButtonsWrap);
    builderPanel.appendChild(partyHeader);

    const heroPickerGrid = document.createElement('div');
    heroPickerGrid.className = 'hero-picker-grid';
    for (const h of this.game.getUnlockedHeroes()) {
      const r = HERO_ROSTER_MAP[h.id];
      const cls = HERO_CLASSES[r.classId];
      const orig = ORIGINS[r.originId];
      const bd = getHeroStatBreakdown(h);
      const isSelected = this.selectedPartyHeroIds.includes(h.id);
      const isAvail = h.status === 'idle' && !h.expeditionId;

      const pBtn = document.createElement('button');
      pBtn.type = 'button';
      pBtn.className = `hero-pick-chip${isSelected ? ' selected' : ''}${
        isAvail ? '' : ' unavailable'
      }`;
      pBtn.disabled = !isAvail;
      pBtn.innerHTML = `
        <span class="pick-name">${cls.icon} ${r.name} <small>Lv.${h.level}</small></span>
        <span class="pick-sub">${cls.roleName} · 전투력 ${bd.combatPower}</span>
        <span class="pick-traits">${r.personalities
          .map((p) => PERSONALITIES[p].name)
          .join('/')} · ${orig.icon}${orig.name}</span>
      `;
      pBtn.addEventListener('click', () => {
        if (isSelected) {
          this.selectedPartyHeroIds = this.selectedPartyHeroIds.filter(
            (id) => id !== h.id
          );
        } else if (this.selectedPartyHeroIds.length < maxPartySize) {
          this.selectedPartyHeroIds.push(h.id);
        }
        this.buildTabCards();
      });
      heroPickerGrid.appendChild(pBtn);
    }
    builderPanel.appendChild(heroPickerGrid);

    const selectedHeroes = this.selectedPartyHeroIds
      .map((id) => this.game.heroes[id])
      .filter((h): h is HeroState => Boolean(h));
    const preview = evaluatePartyForDungeon(selectedHeroes, dungeon);

    const synBox = document.createElement('div');
    synBox.className = 'synergy-preview-box';

    const personalityLines =
      preview.personalityMatches.length > 0
        ? preview.personalityMatches
            .map(
              (pm) =>
                `<div class="syn-line ${
                  pm.isPositive ? 'syn-good' : 'syn-bad'
                }">
                  ${pm.isPositive ? '💚' : '💔'} <b>${pm.title}</b> (${
                  pm.bonus >= 0 ? '+' : ''
                }${Math.round(pm.bonus * 100)}%) — ${pm.description}
                </div>`
            )
            .join('')
        : `<div class="syn-line syn-neutral">• 발동된 성격 궁합/충돌 없음 (0%)</div>`;

    const originLines = preview.originPassives
      .map(
        (op) =>
          `<div class="syn-line ${
            op.successBonus > 0 ? 'syn-good' : 'syn-neutral'
          }">
            ${op.icon} <b>[${op.heroName} · ${op.originName}]</b> ${op.bonusText}
          </div>`
      )
      .join('');

    const setLines: string[] = [];
    for (const os of preview.originSets) {
      setLines.push(
        `<div class="syn-line syn-good">🌟 <b>${os.title}</b>: 동향 ${
          os.count
        }인 시너지 (+${Math.round(os.bonus * 100)}%)</div>`
      );
    }
    if (preview.classSetTitle) {
      setLines.push(
        `<div class="syn-line ${
          preview.classSetBonus >= 0 ? 'syn-good' : 'syn-bad'
        }">${preview.classSetTitle} (${
          preview.classSetBonus >= 0 ? '+' : ''
        }${Math.round(preview.classSetBonus * 100)}%)</div>`
      );
    }

    const warningHtml = preview.roleWarnings
      .map((w) => `<div class="syn-line syn-bad">${w}</div>`)
      .join('');

    synBox.innerHTML = `
      <div class="synergy-preview-header">
        <span>🔍 출발 전 파티 시너지 &amp; 성공률 미리보기</span>
        <strong class="final-rate-badge">최종 예상 성공률: ${Math.round(
          preview.finalSuccessRate * 100
        )}% (탐험 ${preview.durationSec}초)</strong>
      </div>
      <div class="synergy-breakdown-grid">
        <div class="syn-group">
          <div class="syn-group-title">1. 역할 상호보완</div>
          <div class="syn-line ${
            preview.roleSynergyBonus >= 0 ? 'syn-good' : 'syn-bad'
          }">
            <b>${preview.roleSynergyTitle}</b> (${
      preview.roleSynergyBonus >= 0 ? '+' : ''
    }${Math.round(preview.roleSynergyBonus * 100)}%)
          </div>
          ${warningHtml}
        </div>
        <div class="syn-group">
          <div class="syn-group-title">2. 성격 궁합 &amp; 충돌</div>
          ${personalityLines}
        </div>
        <div class="syn-group">
          <div class="syn-group-title">3. 출신 배경 패시브 &amp; 세트 시너지</div>
          ${
            originLines ||
            '<div class="syn-line syn-neutral">• 파티원을 선택하세요</div>'
          }
          ${setLines.join('')}
        </div>
      </div>
      <div class="synergy-formula-footer">
        📊 파티 합산 스탯 (ATK ${preview.partyStats.atk} · DEF ${
      preview.partyStats.def
    } · AGI ${preview.partyStats.agi} · INT ${preview.partyStats.int} · HP ${
      preview.partyStats.hp
    } · LUK ${preview.partyStats.luk}) →
        <b>기본 성공률 ${Math.round(
          preview.baseStatSuccessRate * 100
        )}%</b> +
        <b>시너지 ${
          preview.totalSynergyDelta >= 0 ? '+' : ''
        }${Math.round(preview.totalSynergyDelta * 100)}%</b> +
        <b>버프 +${Math.round(preview.buffSuccessBonus * 100)}%</b> =
        <strong class="gold-highlight">${Math.round(
          preview.finalSuccessRate * 100
        )}%</strong>
      </div>
    `;
    builderPanel.appendChild(synBox);

    const dispatchBtn = document.createElement('button');
    dispatchBtn.type = 'button';
    dispatchBtn.className = 'primary-action-btn dispatch-submit-btn';
    const canSend =
      dUnlocked &&
      selectedHeroes.length > 0 &&
      this.game.expeditions.length < this.game.getMaxConcurrentExpeditions();
    dispatchBtn.disabled = !canSend;
    dispatchBtn.innerHTML = `
      <span class="btn-main-label">🚀 [${dungeon.name}] 원정대 즉시 파견하기 (${
      preview.heroNames.join(' · ') || '파티원 미선택'
    })</span>
      <span class="btn-sub-label">예상 성공률 ${Math.round(
        preview.finalSuccessRate * 100
      )}% · 소요 시간 ${preview.durationSec}초</span>
    `;
    dispatchBtn.addEventListener('click', () => {
      if (this.game.dispatchParty(dungeon.id, this.selectedPartyHeroIds)) {
        this.autoSelectInitialParty();
        this.closeDrawer();
        this.refreshAllUi(true);
      }
    });
    builderPanel.appendChild(dispatchBtn);

    this.elUpgradeList.appendChild(builderPanel);
  }

  // --------------------------------------------------------------------------
  // 4. ⚗️ 포션 가게 탭
  // --------------------------------------------------------------------------
  private buildPotionTab(): void {
    const statusPanel = document.createElement('div');
    statusPanel.className = 'section-panel';
    const maxSlots = this.game.getMaxCraftSlots('potion');
    statusPanel.innerHTML = `
      <div class="panel-subtitle">⚗️ 연금 제작대 큐 (${this.game.craftQueues.potion.length}/${maxSlots}슬롯) &amp; 포션 가게 판매 진열대</div>
      <p class="upgrade-desc">포션별 <b>[판매 등록 ON/OFF]</b>를 켜 두면 영웅들이 포션 가게 코너로 걸어와 구매합니다.</p>
    `;

    if (this.game.craftQueues.potion.length > 0) {
      for (const q of this.game.craftQueues.potion) {
        const rec = POTION_RECIPES.find((r) => r.id === q.recipeId);
        const row = document.createElement('div');
        row.className = 'expedition-progress-card';
        const pct = Math.min(
          100,
          Math.max(0, ((q.totalSec - q.remainingSec) / q.totalSec) * 100)
        );
        row.innerHTML = `
          <div class="exp-row-top">
            <strong>${rec?.icon ?? '🧪'} ${
          rec?.name ?? q.recipeId
        } 조제 중...</strong>
            <span>성공 확률 ${Math.round(q.successRate * 100)}%</span>
            <strong>${Math.ceil(q.remainingSec)}초 남음</strong>
          </div>
          <div class="mini-progress-track">
            <div class="mini-progress-fill" style="width:${pct.toFixed(
              1
            )}%"></div>
          </div>
        `;
        statusPanel.appendChild(row);
      }
    }

    const stockGrid = document.createElement('div');
    stockGrid.className = 'warehouse-grid';
    for (const pr of POTION_RECIPES) {
      const cnt = this.game.potionStock[pr.id] ?? 0;
      const rInfo = RARITY_INFO[pr.rarity];
      const effPrice = this.game.getEffectivePotionSellPrice(pr.id);
      const isSaleOn = this.game.shopConfig.potionSaleEnabled[pr.id] !== false;

      const box = document.createElement('div');
      box.className = 'warehouse-item';
      box.innerHTML = `
        <div class="wh-top">
          <span>${pr.icon} <b style="color:${rInfo.color}">${pr.name}</b></span>
          <strong class="wh-count">${cnt}병</strong>
        </div>
        <div class="wh-sub">판매가 ${effPrice}G (정가 ${pr.sellPriceToHero}G) · ${
        pr.effectText
      }</div>
        <div class="wh-action-row">
          <button type="button" class="mc-toggle-btn ${
            isSaleOn ? 'on' : 'off'
          }" data-toggle-pot-sale="${pr.id}">
            ${isSaleOn ? '✅ 판매 등록 ON' : '⛔ 판매 보류 OFF'}
          </button>
        </div>
      `;
      stockGrid.appendChild(box);
    }
    statusPanel.appendChild(stockGrid);
    this.elUpgradeList.appendChild(statusPanel);

    statusPanel
      .querySelectorAll<HTMLButtonElement>('[data-toggle-pot-sale]')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          const pId = btn.dataset.togglePotSale!;
          this.game.shopConfig.potionSaleEnabled[pId] = !(
            this.game.shopConfig.potionSaleEnabled[pId] !== false
          );
          this.buildTabCards();
        });
      });

    const recipeHeader = document.createElement('div');
    recipeHeader.className = 'panel-subtitle';
    recipeHeader.textContent = '📜 포션 조제 레시피';
    this.elUpgradeList.appendChild(recipeHeader);

    for (const rec of POTION_RECIPES) {
      const unlocked = this.game.isPotionRecipeUnlocked(rec.id);
      const preview = this.game.getPotionCraftPreview(rec.id);
      const canCraft = this.game.canCraftPotion(rec.id);
      const rInfo = RARITY_INFO[rec.rarity];

      const matStr = Object.entries(rec.materials)
        .map(([mId, cnt]) => {
          const have = this.game.materials[mId] ?? 0;
          return `${MATERIAL_MAP[mId]?.name ?? mId} ${have}/${cnt}`;
        })
        .join(' · ');

      const toolName =
        POTION_TOOLS.find((t) => t.id === rec.reqToolId)?.name ?? rec.reqToolId;
      const facName = rec.reqFacilityId
        ? POTION_TOOLS.find((t) => t.id === rec.reqFacilityId)?.name
        : null;
      const fallbackName = rec.fallbackPotionId
        ? POTION_RECIPES.find((p) => p.id === rec.fallbackPotionId)?.name
        : '재료 증발';

      const card = document.createElement('div');
      card.className = `upgrade-card${unlocked ? '' : ' locked'}`;
      card.innerHTML = `
        <div class="upgrade-info">
          <div class="upgrade-icon">${rec.icon}</div>
          <div class="upgrade-text-wrap">
            <div class="upgrade-title-row">
              <span class="upgrade-name" style="color:${rInfo.color}">${
        rec.name
      }</span>
              <span class="upgrade-level-badge">성공률 ${Math.round(
                preview.successRate * 100
              )}% · ${preview.durationSec}초</span>
              <span class="upgrade-level-badge">판매가 ${this.game.getEffectivePotionSellPrice(
                rec.id
              )}G</span>
            </div>
            <p class="upgrade-desc">${rec.description}</p>
            <p class="upgrade-effects">효과: ${rec.effectText}</p>
            <p class="upgrade-desc">필요 재료: <b>${matStr}</b> | 실패 시: ${fallbackName}</p>
            ${
              !unlocked
                ? `<p class="upgrade-unlock-req">🔒 요구 시설: ${toolName} Lv.${
                    rec.reqToolLevel
                  }${
                    facName ? ` & ${facName} Lv.${rec.reqFacilityLevel}` : ''
                  }</p>`
                : ''
            }
          </div>
        </div>
      `;

      const cBtn = document.createElement('button');
      cBtn.type = 'button';
      cBtn.className = 'buy-btn';
      cBtn.disabled = !canCraft;
      cBtn.innerHTML = `
        <span class="buy-btn-label">${unlocked ? '조제 시작' : '미해금'}</span>
        <span class="buy-btn-cost">${rec.goldCost} G</span>
      `;
      cBtn.addEventListener('click', () => {
        if (this.game.startCraftPotion(rec.id)) {
          this.buildTabCards();
        }
      });
      card.appendChild(cBtn);
      this.elUpgradeList.appendChild(card);
    }

    const toolHeader = document.createElement('div');
    toolHeader.className = 'panel-subtitle';
    toolHeader.textContent = '🔧 연금 도구 · 약초 정원 · 작업실 건설 및 강화';
    this.elUpgradeList.appendChild(toolHeader);

    for (const tool of POTION_TOOLS) {
      this.elUpgradeList.appendChild(this.createShopToolCard(tool));
    }
  }

  // --------------------------------------------------------------------------
  // 5. ⚒️ 대장간 탭
  // --------------------------------------------------------------------------
  private buildBlacksmithTab(): void {
    const maxSlots = this.game.getMaxCraftSlots('blacksmith');
    const topPanel = document.createElement('div');
    topPanel.className = 'section-panel';
    topPanel.innerHTML = `
      <div class="panel-subtitle">⚒️ 대장간 단조 큐 (${this.game.craftQueues.blacksmith.length}/${maxSlots}슬롯) &amp; 완성 장비 진열대 (${this.game.equipmentStock.length}개)</div>
      <p class="upgrade-desc">완성된 장비는 영웅들이 대장간 모루로 걸어와 구매·장착하거나 직접 장착 및 <b>+강화</b>를 시도할 수 있습니다.</p>
    `;

    if (this.game.craftQueues.blacksmith.length > 0) {
      for (const q of this.game.craftQueues.blacksmith) {
        const def = EQUIPMENT_DEF_MAP[q.recipeId];
        const row = document.createElement('div');
        row.className = 'expedition-progress-card';
        const pct = Math.min(
          100,
          Math.max(0, ((q.totalSec - q.remainingSec) / q.totalSec) * 100)
        );
        row.innerHTML = `
          <div class="exp-row-top">
            <strong>${def?.icon ?? '⚒️'} ${
          def?.name ?? q.recipeId
        } 단조 중...</strong>
            <span>성공 확률 ${Math.round(q.successRate * 100)}%</span>
            <strong>${Math.ceil(q.remainingSec)}초 남음</strong>
          </div>
          <div class="mini-progress-track">
            <div class="mini-progress-fill" style="width:${pct.toFixed(
              1
            )}%"></div>
          </div>
        `;
        topPanel.appendChild(row);
      }
    }

    if (this.game.equipmentStock.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-hint';
      empty.textContent =
        '진열대에 보관 중인 여분 장비가 없습니다. 아래 레시피에서 장비를 단조하거나 [🦸 영웅] 탭에서 착용 장비를 +강화하세요!';
      topPanel.appendChild(empty);
    } else {
      for (const inst of this.game.equipmentStock) {
        const def = EQUIPMENT_DEF_MAP[inst.defId];
        if (!def) continue;
        const rInfo = RARITY_INFO[def.rarity];
        const st = getEquipmentEffectiveStats(inst);
        const stText = Object.entries(st)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k.toUpperCase()}+${v}`)
          .join(' ');

        const row = document.createElement('div');
        row.className = 'upgrade-card compact-card';
        row.innerHTML = `
          <div class="upgrade-info">
            <div class="upgrade-icon">${def.icon}</div>
            <div class="upgrade-text-wrap">
              <div class="upgrade-title-row">
                <span class="upgrade-name" style="color:${rInfo.color}">[${
          rInfo.label
        }] ${def.name}${
          inst.enhanceLevel > 0 ? ` +${inst.enhanceLevel}` : ''
        }</span>
                <span class="upgrade-level-badge">${
                  EQUIP_SLOT_LABELS[def.slot]
                }</span>
                <span class="upgrade-level-badge">${stText}</span>
              </div>
              <p class="upgrade-desc">착용 가능: ${getWearableClassesText(
                def
              )} | 판매가 ${this.game.getEffectiveEquipSellPrice(def.id)}G</p>
            </div>
          </div>
        `;

        const btnCol = document.createElement('div');
        btnCol.className = 'party-header-btns';

        const enhPreview = this.game.getEnhancePreview({ stockUid: inst.uid });
        if (enhPreview) {
          const enhBtn = document.createElement('button');
          enhBtn.type = 'button';
          enhBtn.className = 'care-btn enhance-btn';
          enhBtn.textContent = `🔥 +${enhPreview.nextLevel} 강화 (${(
            enhPreview.successRate * 100
          ).toFixed(0)}%)`;
          enhBtn.addEventListener('click', () => {
            this.openEnhanceConfirmModal({ stockUid: inst.uid });
          });
          btnCol.appendChild(enhBtn);
        }

        row.appendChild(btnCol);
        topPanel.appendChild(row);
      }
    }

    const rateBox = document.createElement('div');
    rateBox.className = 'enhance-rate-table-box';
    const grindLv = this.game.blacksmithTools['smith_grindstone'] ?? 0;
    const rateChips = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 14]
      .map((plus) => {
        const base = BASE_ENHANCE_RATES[plus] * 100;
        const pctStr = base < 5 ? base.toFixed(2) : base.toFixed(0);
        return `<span class="rate-pill">+${plus}→+${
          plus + 1
        }: <b>${pctStr}%</b></span>`;
      })
      .join(' ');
    rateBox.innerHTML = `
      <div class="enhance-table-title">🔥 +강화 기본 성공 확률표 (실패 시 완전 파괴 · 기본 장비 즉시 복귀 | 누적 성공 ${this.game.totalEnhanceSuccess}회 / 파괴 ${this.game.totalEnhanceDestroyed}회 | 룬 숫돌 Lv.${grindLv})</div>
      <div class="rate-pill-wrap">${rateChips}</div>
    `;
    topPanel.appendChild(rateBox);

    this.elUpgradeList.appendChild(topPanel);

    const toolHeader = document.createElement('div');
    toolHeader.className = 'panel-subtitle';
    toolHeader.textContent =
      '🔥 대장간 화로 · 모루 · 숫돌 · 담금질 통 · 장인 업그레이드';
    this.elUpgradeList.appendChild(toolHeader);

    for (const tool of BLACKSMITH_TOOLS) {
      this.elUpgradeList.appendChild(this.createShopToolCard(tool));
    }

    const recHeader = document.createElement('div');
    recHeader.className = 'panel-subtitle';
    recHeader.textContent = '🗡️ 장비 단조 레시피 (고급 / 희귀 / 영웅 / 전설)';
    this.elUpgradeList.appendChild(recHeader);

    const craftableEquips = EQUIPMENT_DEFS.filter((e) => !e.isBase);
    for (const def of craftableEquips) {
      const unlocked = this.game.isEquipmentRecipeUnlocked(def.id);
      const preview = this.game.getEquipmentCraftPreview(def.id);
      const canCraft = this.game.canCraftEquipment(def.id);
      const rInfo = RARITY_INFO[def.rarity];

      const matStr = Object.entries(def.craftMaterials)
        .map(([mId, cnt]) => {
          const have = this.game.materials[mId] ?? 0;
          return `${MATERIAL_MAP[mId]?.name ?? mId} ${have}/${cnt}`;
        })
        .join(' · ');

      const stStr = Object.entries(def.stats)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => `${k.toUpperCase()}+${v}`)
        .join(' · ');

      const reqParts: string[] = [];
      if (def.reqFacilityId) {
        const fName =
          BLACKSMITH_TOOLS.find((t) => t.id === def.reqFacilityId)?.name ??
          def.reqFacilityId;
        reqParts.push(`${fName} Lv.${def.reqFacilityLevel}`);
      }
      if (def.reqToolId) {
        const tName =
          BLACKSMITH_TOOLS.find((t) => t.id === def.reqToolId)?.name ??
          def.reqToolId;
        reqParts.push(`${tName} Lv.${def.reqToolLevel}`);
      }

      const card = document.createElement('div');
      card.className = `upgrade-card${unlocked ? '' : ' locked'}`;
      card.innerHTML = `
        <div class="upgrade-info">
          <div class="upgrade-icon">${def.icon}</div>
          <div class="upgrade-text-wrap">
            <div class="upgrade-title-row">
              <span class="upgrade-name" style="color:${rInfo.color}">[${
        rInfo.label
      }] ${def.name}</span>
              <span class="upgrade-level-badge">${
                EQUIP_SLOT_LABELS[def.slot]
              }</span>
              <span class="upgrade-level-badge">성공률 ${Math.round(
                preview.successRate * 100
              )}% · ${preview.durationSec}초</span>
              <span class="upgrade-level-badge">판매가 ${this.game.getEffectiveEquipSellPrice(
                def.id
              )}G</span>
            </div>
            <p class="upgrade-desc">${def.description}</p>
            <p class="upgrade-effects">기본 스탯: ${stStr} | 착용 직업: ${getWearableClassesText(
        def
      )}</p>
            <p class="upgrade-desc">필요 재료: <b>${matStr}</b></p>
            ${
              !unlocked
                ? `<p class="upgrade-unlock-req">🔒 요구 시설: ${reqParts.join(
                    ' & '
                  )}</p>`
                : ''
            }
          </div>
        </div>
      `;

      const cBtn = document.createElement('button');
      cBtn.type = 'button';
      cBtn.className = 'buy-btn';
      cBtn.disabled = !canCraft;
      cBtn.innerHTML = `
        <span class="buy-btn-label">${unlocked ? '단조 시작' : '미해금'}</span>
        <span class="buy-btn-cost">${def.craftGoldCost} G</span>
      `;
      cBtn.addEventListener('click', () => {
        if (this.game.startCraftEquipment(def.id)) {
          this.buildTabCards();
        }
      });
      card.appendChild(cBtn);
      this.elUpgradeList.appendChild(card);
    }
  }

  private createShopToolCard(
    tool: (typeof POTION_TOOLS)[number]
  ): HTMLElement {
    const lv = this.game.getShopToolLevel(tool.shop, tool.id);
    const isMax = lv >= tool.maxLevel;
    const { gold, materials } = this.game.getShopToolUpgradeCost(tool);
    const canBuy = this.game.canUpgradeShopTool(tool.id);

    const matStr = Object.entries(materials)
      .map(([mId, cnt]) => {
        const have = this.game.materials[mId] ?? 0;
        return `${MATERIAL_MAP[mId]?.name ?? mId} ${have}/${cnt}`;
      })
      .join(' · ');

    const wageText = tool.dailyWagePerLevel
      ? ` (고용 급료: 레벨당 -${tool.dailyWagePerLevel}G/일)`
      : '';

    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `
      <div class="upgrade-info">
        <div class="upgrade-icon">${tool.icon}</div>
        <div class="upgrade-text-wrap">
          <div class="upgrade-title-row">
            <span class="upgrade-name">${tool.name}</span>
            <span class="upgrade-level-badge">Lv.${lv} / ${tool.maxLevel}</span>
          </div>
          <p class="upgrade-desc">${tool.description}${wageText}</p>
          ${
            !isMax && matStr
              ? `<p class="upgrade-effects">상위 레벨 재료: ${matStr}</p>`
              : ''
          }
        </div>
      </div>
    `;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'buy-btn';
    btn.disabled = !canBuy;
    btn.innerHTML = `
      <span class="buy-btn-label">${
        isMax ? '최대 레벨' : lv === 0 ? '보유 골드 건설' : '강화'
      }</span>
      <span class="buy-btn-cost">${isMax ? 'MAX' : `${formatGold(gold)} G`}</span>
    `;
    btn.addEventListener('click', () => {
      if (this.game.upgradeShopTool(tool.id)) {
        this.buildTabCards();
      }
    });
    card.appendChild(btn);
    return card;
  }

  // --------------------------------------------------------------------------
  // 6. 여관 업그레이드 탭 (메뉴 · 객실 · 직원 · 시설)
  // --------------------------------------------------------------------------
  private buildInnUpgradesTab(category: UpgradeCategory): void {
    const items = UPGRADES.filter((u) => u.category === category);
    for (const def of items) {
      const card = this.createUpgradeCardElement(def);
      this.elUpgradeList.appendChild(card);
    }
    this.updateLiveUpgradeCardStates();
  }

  private createUpgradeCardElement(def: UpgradeDef): HTMLElement {
    const lv = this.game.upgrades[def.id] ?? 0;
    const isUnlocked = this.game.reputation >= def.unlockRep;
    const cost = getUpgradeCost(def, lv);
    const matReqs = getInnUpgradeMaterialRequirements(def.id, lv);
    const matText = Object.entries(matReqs)
      .map(
        ([mId, cnt]) =>
          `${MATERIAL_MAP[mId]?.name ?? mId} ${
            this.game.materials[mId] ?? 0
          }/${cnt}`
      )
      .join(' · ');

    const card = document.createElement('div');
    card.className = `upgrade-card${isUnlocked ? '' : ' locked'}`;
    card.dataset.upgradeId = def.id;

    const info = document.createElement('div');
    info.className = 'upgrade-info';

    const iconBox = document.createElement('div');
    iconBox.className = 'upgrade-icon';
    iconBox.textContent = def.icon;

    const textWrap = document.createElement('div');
    textWrap.className = 'upgrade-text-wrap';

    const titleRow = document.createElement('div');
    titleRow.className = 'upgrade-title-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'upgrade-name';
    nameEl.textContent = def.name;

    const lvBadge = document.createElement('span');
    lvBadge.className = 'upgrade-level-badge';
    lvBadge.dataset.role = 'level-badge';
    lvBadge.textContent = `Lv.${lv}`;

    titleRow.appendChild(nameEl);
    titleRow.appendChild(lvBadge);

    const descEl = document.createElement('p');
    descEl.className = 'upgrade-desc';
    descEl.textContent = def.description;

    const effectsEl = document.createElement('p');
    effectsEl.className = 'upgrade-effects';
    effectsEl.textContent = this.formatUpgradeEffectText(def);

    textWrap.appendChild(titleRow);
    textWrap.appendChild(descEl);
    textWrap.appendChild(effectsEl);

    if (matText) {
      const matEl = document.createElement('p');
      matEl.className = 'upgrade-desc';
      matEl.dataset.role = 'mat-req';
      matEl.textContent = `📦 상위 레벨 재료: ${matText}`;
      textWrap.appendChild(matEl);
    }

    if (!isUnlocked) {
      const reqEl = document.createElement('p');
      reqEl.className = 'upgrade-unlock-req';
      reqEl.textContent = `🔒 해금 조건: 여관 평판 ${formatGold(
        def.unlockRep
      )} 이상`;
      textWrap.appendChild(reqEl);
    }

    info.appendChild(iconBox);
    info.appendChild(textWrap);

    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.className = 'buy-btn';
    buyBtn.dataset.role = 'buy-btn';

    const btnLabel = document.createElement('span');
    btnLabel.className = 'buy-btn-label';
    btnLabel.dataset.role = 'buy-label';
    btnLabel.textContent = isUnlocked ? (lv === 0 ? '구매' : '강화') : '미해금';

    const btnCost = document.createElement('span');
    btnCost.className = 'buy-btn-cost';
    btnCost.dataset.role = 'buy-cost';
    btnCost.textContent = `${formatGold(cost)} G`;

    buyBtn.appendChild(btnLabel);
    buyBtn.appendChild(btnCost);

    buyBtn.addEventListener('click', () => {
      if (this.game.buyUpgrade(def.id)) {
        this.buildTabCards();
      }
    });

    card.appendChild(info);
    card.appendChild(buyBtn);
    return card;
  }

  private formatUpgradeEffectText(def: UpgradeDef): string {
    const parts: string[] = [];
    if (def.clickPerLevel > 0) {
      parts.push(`서빙·단가 보너스 +${formatGold(def.clickPerLevel)}G`);
    }
    if (def.category === 'menu') {
      parts.push(`영웅 식사 버프 강화`);
    }
    if (def.category === 'room') {
      parts.push(`영웅 부상·피로 회복 가속`);
    }
    if (def.maxGuestsBonusPerLevel) {
      parts.push(`수용 손님 증가`);
    }
    if (def.autoServeSpeedBonus) {
      parts.push(`자동 서빙 속도 +${Math.round(def.autoServeSpeedBonus * 100)}%`);
    }
    if (def.spawnRateBonus) {
      parts.push(`방문 빈도 상승`);
    }
    if (def.globalMultiplierBonus) {
      parts.push(`전체 거래 수익 +${Math.round(def.globalMultiplierBonus * 100)}%`);
    }
    if (def.lootChanceBonus) {
      parts.push(`전리품 팁 확률 상승`);
    }
    if (def.dailyWagePerLevel) {
      parts.push(`일일 급료 -${def.dailyWagePerLevel}G/Lv`);
    }
    if (def.dailyUpkeepPerLevel) {
      parts.push(`일일 유지비 -${def.dailyUpkeepPerLevel}G/Lv`);
    }
    return `효과: ${parts.join(' · ')}`;
  }

  private updateLiveUpgradeCardStates(): void {
    const cards =
      this.elUpgradeList.querySelectorAll<HTMLElement>('.upgrade-card');
    cards.forEach((card) => {
      const id = card.dataset.upgradeId;
      if (!id) return;
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return;

      const lv = this.game.upgrades[id] ?? 0;
      const isUnlocked = this.game.reputation >= def.unlockRep;
      const cost = getUpgradeCost(def, lv);
      const canBuy = this.game.canBuyUpgrade(id);

      const lvBadge = card.querySelector<HTMLElement>(
        '[data-role="level-badge"]'
      );
      if (lvBadge) lvBadge.textContent = `Lv.${lv}`;

      const buyBtn = card.querySelector<HTMLButtonElement>(
        '[data-role="buy-btn"]'
      );
      const buyLabel = card.querySelector<HTMLElement>(
        '[data-role="buy-label"]'
      );
      const buyCost = card.querySelector<HTMLElement>('[data-role="buy-cost"]');

      if (buyBtn) buyBtn.disabled = !canBuy;
      if (buyLabel) {
        buyLabel.textContent = isUnlocked
          ? lv === 0
            ? '구매'
            : '강화'
          : '미해금';
      }
      if (buyCost) {
        buyCost.textContent = `${formatGold(cost)} G`;
      }
    });
  }

  private buildCodexCards(): void {
    for (const g of GUEST_TYPES) {
      const unlocked = this.game.reputation >= g.unlockRep;
      const visitCount = this.game.discoveredGuests[g.id] ?? 0;

      const card = document.createElement('div');
      card.className = `upgrade-card${unlocked ? '' : ' locked'}`;

      const info = document.createElement('div');
      info.className = 'upgrade-info';

      const iconBox = document.createElement('div');
      iconBox.className = 'upgrade-icon';

      if (unlocked) {
        const img = document.createElement('img');
        img.src = getGuestPortraitDataUrl(g.id);
        img.alt = `${g.name} 도트 스프라이트`;
        img.className = 'pixel-portrait';
        iconBox.appendChild(img);
      } else {
        iconBox.textContent = '❔';
      }

      const textWrap = document.createElement('div');
      textWrap.className = 'upgrade-text-wrap';

      const titleRow = document.createElement('div');
      titleRow.className = 'upgrade-title-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'upgrade-name';
      nameEl.textContent = unlocked
        ? `${g.name} (${g.title})`
        : `??? (${g.title})`;

      const badge = document.createElement('span');
      badge.className = 'upgrade-level-badge';
      badge.textContent = unlocked
        ? `방문 ${formatGold(visitCount)}회`
        : '미해금';

      titleRow.appendChild(nameEl);
      titleRow.appendChild(badge);

      const descEl = document.createElement('p');
      descEl.className = 'upgrade-desc';
      descEl.textContent = unlocked
        ? g.description
        : '여관의 평판이 높아지면 소문을 듣고 찾아오는 새로운 모험가입니다.';

      textWrap.appendChild(titleRow);
      textWrap.appendChild(descEl);

      if (unlocked) {
        const effectsEl = document.createElement('p');
        effectsEl.className = 'upgrade-effects';
        effectsEl.textContent = `서빙 행위당 수입: 기본 ${formatGold(
          g.baseGold
        )}G · 평판 +${g.baseRep} · 전리품 팁 〈${g.lootName}〉 (${Math.round(
          g.lootChance * 100
        )}%)`;
        textWrap.appendChild(effectsEl);
      } else {
        const reqEl = document.createElement('p');
        reqEl.className = 'upgrade-unlock-req';
        reqEl.textContent = `🔒 해금 조건: 여관 평판 ${formatGold(
          g.unlockRep
        )} 달성`;
        textWrap.appendChild(reqEl);
      }

      info.appendChild(iconBox);
      info.appendChild(textWrap);
      card.appendChild(info);
      this.elUpgradeList.appendChild(card);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new InnAppController();
});
