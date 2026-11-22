import './style.css';
import {
  GUEST_TYPES,
  UPGRADES,
  getCurrentInnLevel,
  getNextInnLevel,
  getUpgradeCost,
} from './data';
import { formatDuration, formatGold, formatRate } from './format';
import { DungeonInnGame, OfflineReport } from './game';
import { CANVAS_HEIGHT, CANVAS_WIDTH, InnRenderer } from './renderer';
import { getGuestPortraitDataUrl } from './sprites';
import { UpgradeCategory, UpgradeDef } from './types';

type ActiveTab = UpgradeCategory | 'codex';

const TAB_SUMMARIES: Record<ActiveTab, string> = {
  menu: '🍲 따뜻한 수프와 스튜, 에일, 포션을 개발하여 서빙 수익과 초당 골드를 높입니다.',
  room: '🛏️ 침대와 객실을 확충하여 숙박 초당 수입과 여관 최대 동시 손님 수를 늘립니다.',
  staff: '🧑‍🍳 메이드·바텐더·요리사·음유시인을 고용하면 여관에 등장하여 자동 서빙과 수익을 돕습니다.',
  facility: '⚒️ 게시판·대장간·오르골·비밀금고·온천탕을 설치하여 여관에 특별 보너스를 부여합니다.',
  codex: '🛡️ 여관을 방문하는 모험가 손님 도감입니다. 평판을 높여 전설의 VIP 손님을 맞이하세요!',
};

class InnAppController {
  private game: DungeonInnGame;
  private renderer: InnRenderer;
  private canvas: HTMLCanvasElement;
  private activeTab: ActiveTab = 'menu';
  private lastFrameTime = performance.now();
  private uiRefreshAccumulator = 0;
  private lastRenderedRepTier = -1;
  private lastLogTopId = -1;

  // DOM 참조
  private elLevelBadge = document.getElementById('inn-level-badge')!;
  private elRepText = document.getElementById('inn-rep-text')!;
  private elGold = document.getElementById('stat-gold')!;
  private elGps = document.getElementById('stat-gps')!;
  private elClick = document.getElementById('stat-click')!;
  private elGuests = document.getElementById('stat-guests')!;
  private elGoalFill = document.getElementById('goal-progress-fill')!;
  private elNextGoal = document.getElementById('next-goal-text')!;

  private elEventBanner = document.getElementById('active-event-banner')!;
  private elEventTitle = document.getElementById('event-banner-title')!;
  private elEventTimer = document.getElementById('event-banner-timer')!;
  private elEventDesc = document.getElementById('event-banner-desc')!;

  private elServeBtnLabel = document.getElementById('serve-btn-label')!;
  private elServeBtnSub = document.getElementById('serve-btn-sub')!;
  private elEventBtn = document.getElementById('btn-random-event') as HTMLButtonElement;
  private elEventBtnLabel = document.getElementById('event-btn-label')!;
  private elEventBtnSub = document.getElementById('event-btn-sub')!;

  private elServedSummary = document.getElementById('stat-served-summary')!;
  private elLogList = document.getElementById('inn-log-list')!;
  private elCategorySummary = document.getElementById('category-summary-bar')!;
  private elUpgradeList = document.getElementById('upgrade-list')!;

  private elSoundBtn = document.getElementById('btn-sound') as HTMLButtonElement;
  private elOfflineModal = document.getElementById('offline-modal')!;
  private elHelpModal = document.getElementById('help-modal')!;
  private elResetModal = document.getElementById('reset-modal')!;

  constructor() {
    const canvasEl = document.getElementById('inn-canvas') as HTMLCanvasElement | null;
    if (!canvasEl) {
      throw new Error('#inn-canvas 요소를 찾을 수 없습니다.');
    }
    this.canvas = canvasEl;
    this.renderer = new InnRenderer(this.canvas);

    this.game = new DungeonInnGame(
      () => this.refreshAllUi(false),
      () => this.refreshAllUi(true)
    );

    const offlineReport = this.game.loadFromStorage();
    this.bindEvents();
    this.updateSoundButtonText();
    this.refreshAllUi(true);

    if (offlineReport) {
      this.showOfflineModal(offlineReport);
    } else if (!this.game.tutorialSeen) {
      this.game.tutorialSeen = true;
      this.game.saveToStorage();
    }

    requestAnimationFrame((now) => this.loop(now));
  }

  private bindEvents(): void {
    // 캔버스 포인터(터치/마우스 클릭) 이벤트
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scaleX = CANVAS_WIDTH / rect.width;
      const scaleY = CANVAS_HEIGHT / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;
      this.game.handleCanvasTap(cx, cy);
    });

    // 직접 서빙 / 호객하기 버튼
    document.getElementById('btn-serve-now')?.addEventListener('click', () => {
      this.game.serveAllOrSolicit();
    });

    // 랜덤 이벤트 소문내기 버튼
    this.elEventBtn.addEventListener('click', () => {
      this.game.triggerRandomEvent(true);
    });

    // 카테고리 탭 전환
    const tabButtons = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab as ActiveTab | undefined;
        if (!tab) return;
        this.activeTab = tab;
        tabButtons.forEach((b) => {
          const isActive = b.dataset.tab === tab;
          b.classList.toggle('active', isActive);
          b.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        this.elCategorySummary.textContent = TAB_SUMMARIES[tab];
        this.buildTabCards();
      });
    });

    // 효과음 토글
    this.elSoundBtn.addEventListener('click', () => {
      this.game.sound.toggleMute();
      this.updateSoundButtonText();
      this.game.saveToStorage();
    });

    // 도움말 모달 열기/닫기
    document.getElementById('btn-help')?.addEventListener('click', () => {
      this.elHelpModal.classList.remove('hidden');
    });
    document.getElementById('btn-close-help')?.addEventListener('click', () => {
      this.elHelpModal.classList.add('hidden');
    });

    // 오프라인 정산 모달 닫기
    document.getElementById('btn-close-offline')?.addEventListener('click', () => {
      this.elOfflineModal.classList.add('hidden');
      this.game.sound.playCoin();
    });

    // 리셋 확인 모달 열기/취소/확인
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      this.elResetModal.classList.remove('hidden');
    });
    document.getElementById('btn-cancel-reset')?.addEventListener('click', () => {
      this.elResetModal.classList.add('hidden');
    });
    document.getElementById('btn-confirm-reset')?.addEventListener('click', () => {
      this.elResetModal.classList.add('hidden');
      this.game.resetGame();
      this.refreshAllUi(true);
    });

    // 모달 배경 클릭 시 닫기
    [this.elOfflineModal, this.elHelpModal, this.elResetModal].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

    // 탭 숨김 및 페이지 종료 시 자동 저장
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

  private updateSoundButtonText(): void {
    const muted = this.game.sound.isMuted();
    this.elSoundBtn.textContent = muted ? '🔇 음소거' : '🔊 효과음';
  }

  private showOfflineModal(report: OfflineReport): void {
    const elTime = document.getElementById('offline-time-text');
    const elGps = document.getElementById('offline-gps-text');
    const elGold = document.getElementById('offline-gold-text');
    const elNote = document.getElementById('offline-cap-note');

    if (elTime) {
      elTime.textContent = report.wasCapped
        ? `${formatDuration(report.cappedSeconds)} (최대 8시간 적용)`
        : formatDuration(report.elapsedSeconds);
    }
    if (elGps) {
      elGps.textContent = `${formatRate(report.gpsUsed)} G/초`;
    }
    if (elGold) {
      elGold.textContent = `+${formatGold(report.earnedGold)} G`;
    }
    if (elNote) {
      const vaultLv = this.game.upgrades['fac_vault'] ?? 0;
      const effPct = Math.round((0.85 + vaultLv * 0.1) * 100);
      elNote.textContent = `* 오프라인 정산 효율 ${effPct}% 적용 (최대 8시간 상한)`;
    }

    this.elOfflineModal.classList.remove('hidden');
  }

  private loop(now: number): void {
    const dt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    this.game.update(dt);
    this.renderer.render(this.game.getRenderState());

    this.uiRefreshAccumulator += dt;
    if (this.uiRefreshAccumulator >= 0.18) {
      this.uiRefreshAccumulator = 0;
      this.refreshAllUi(false);
    }

    requestAnimationFrame((nextNow) => this.loop(nextNow));
  }

  private refreshAllUi(forceRebuildCards: boolean): void {
    const innLv = getCurrentInnLevel(this.game.reputation);
    const nextLv = getNextInnLevel(this.game.reputation);

    this.elLevelBadge.textContent = innLv.title;
    this.elRepText.textContent = `평판 ${formatGold(this.game.reputation)}`;
    this.elGold.textContent = `${formatGold(this.game.gold)} G`;
    this.elGps.textContent = `+${formatRate(this.game.getGoldPerSecond())} /초`;
    this.elClick.textContent = `+${formatGold(this.game.getClickServeBonus())} G`;
    this.elGuests.textContent = `${this.game.guests.length} / ${this.game.getMaxGuests()}명`;

    // 평판 진행률 바
    if (nextLv) {
      const prevReq = innLv.requiredRep;
      const span = Math.max(1, nextLv.requiredRep - prevReq);
      const pct = Math.min(
        100,
        Math.max(4, ((this.game.reputation - prevReq) / span) * 100)
      );
      this.elGoalFill.style.width = `${pct.toFixed(1)}%`;
    } else {
      this.elGoalFill.style.width = '100%';
    }
    this.elNextGoal.textContent = this.game.getNextGoalDescription();

    // 활성 이벤트 배너
    if (this.game.activeEvent) {
      this.elEventBanner.classList.remove('hidden');
      this.elEventTitle.textContent = this.game.activeEvent.def.title;
      this.elEventTimer.textContent = `${Math.ceil(this.game.activeEvent.remainingSec)}초`;
      this.elEventDesc.textContent = this.game.activeEvent.def.description;
    } else {
      this.elEventBanner.classList.add('hidden');
    }

    // 빠른 서빙 버튼 상태
    const waitingCount = this.game.guests.filter((g) => g.state === 'waiting').length;
    if (waitingCount > 0) {
      this.elServeBtnLabel.textContent = `🍻 대기 손님 직접 서빙 (${waitingCount}명)`;
      this.elServeBtnSub.textContent = `즉시 서빙 골드 + 친절 보너스 25%`;
    } else {
      const tip = Math.max(3, Math.floor(this.game.getClickServeBonus() * 0.45));
      this.elServeBtnLabel.textContent = `🔔 여관 정돈 & 모험가 호객하기`;
      this.elServeBtnSub.textContent = `즉시 +${formatGold(tip)} G & 손님 입장 가속`;
    }

    // 랜덤 이벤트 버튼 상태
    if (this.game.activeEvent) {
      this.elEventBtn.disabled = true;
      this.elEventBtnLabel.textContent = `🎉 특별 이벤트 진행 중`;
      this.elEventBtnSub.textContent = `${Math.ceil(this.game.activeEvent.remainingSec)}초 남음`;
    } else if (this.game.eventCooldownSec > 0) {
      this.elEventBtn.disabled = true;
      this.elEventBtnLabel.textContent = `🎲 소문 준비 중 (${Math.ceil(this.game.eventCooldownSec)}초)`;
      this.elEventBtnSub.textContent = `잠시 후 다시 발동 가능`;
    } else {
      this.elEventBtn.disabled = false;
      this.elEventBtnLabel.textContent = `🎲 여관 소문내기 (이벤트)`;
      this.elEventBtnSub.textContent = `즉시 랜덤 호재 발생!`;
    }

    // 누적 서빙 및 로그 업데이트
    this.elServedSummary.textContent = `누적 서빙 ${formatGold(this.game.totalServed)}회 · 전리품 ${formatGold(this.game.totalLootFound)}개`;
    this.renderLogsIfChanged();

    // 평판 구간 변경 시 카드 해금 상태 재렌더링
    const repTier = this.computeUnlockSignature();
    if (forceRebuildCards || repTier !== this.lastRenderedRepTier) {
      this.lastRenderedRepTier = repTier;
      this.buildTabCards();
    } else {
      this.updateLiveCardStates();
    }
  }

  private computeUnlockSignature(): number {
    let sig = 0;
    UPGRADES.forEach((u, idx) => {
      if (this.game.reputation >= u.unlockRep) {
        sig |= 1 << idx;
      }
    });
    return sig;
  }

  private renderLogsIfChanged(): void {
    const topId = this.game.logs[0]?.id ?? -1;
    if (topId === this.lastLogTopId) return;
    this.lastLogTopId = topId;

    this.elLogList.innerHTML = '';
    for (const entry of this.game.logs.slice(0, 6)) {
      const li = document.createElement('li');
      li.className = `log-item log-${entry.type}`;

      const timeSpan = document.createElement('span');
      timeSpan.className = 'log-time';
      timeSpan.textContent = entry.timeText;

      const textSpan = document.createElement('span');
      textSpan.textContent = entry.text;

      li.appendChild(timeSpan);
      li.appendChild(textSpan);
      this.elLogList.appendChild(li);
    }
  }

  /**
   * 현재 선택된 탭의 업그레이드 카드 또는 손님 도감 카드를 생성합니다.
   */
  private buildTabCards(): void {
    this.elUpgradeList.innerHTML = '';

    if (this.activeTab === 'codex') {
      this.buildCodexCards();
      return;
    }

    const items = UPGRADES.filter((u) => u.category === this.activeTab);
    for (const def of items) {
      const card = this.createUpgradeCardElement(def);
      this.elUpgradeList.appendChild(card);
    }
    this.updateLiveCardStates();
  }

  private createUpgradeCardElement(def: UpgradeDef): HTMLElement {
    const lv = this.game.upgrades[def.id] ?? 0;
    const isUnlocked = this.game.reputation >= def.unlockRep;
    const cost = getUpgradeCost(def, lv);

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

    if (!isUnlocked) {
      const reqEl = document.createElement('p');
      reqEl.className = 'upgrade-unlock-req';
      reqEl.textContent = `🔒 해금 조건: 여관 평판 ${formatGold(def.unlockRep)} 이상`;
      textWrap.appendChild(reqEl);
    }

    info.appendChild(iconBox);
    info.appendChild(textWrap);

    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.className = 'buy-btn';
    buyBtn.dataset.role = 'buy-btn';
    buyBtn.setAttribute('aria-label', `${def.name} 업그레이드 구매`);

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
    if (def.gpsPerLevel > 0) {
      parts.push(`초당 +${formatRate(def.gpsPerLevel)}G`);
    }
    if (def.clickPerLevel > 0) {
      parts.push(`서빙 +${formatGold(def.clickPerLevel)}G`);
    }
    if (def.maxGuestsBonusPerLevel) {
      parts.push(`수용 손님 증가`);
    }
    if (def.autoServeSpeedBonus) {
      parts.push(`자동 서빙 가속`);
    }
    if (def.spawnRateBonus) {
      parts.push(`방문 빈도 상승`);
    }
    if (def.globalMultiplierBonus) {
      parts.push(`전체 수익 +${Math.round(def.globalMultiplierBonus * 100)}%`);
    }
    if (def.lootChanceBonus) {
      parts.push(`전리품 확률 상승`);
    }
    if (def.offlineBonusPerLevel) {
      parts.push(`방치 효율 +${Math.round(def.offlineBonusPerLevel * 100)}%`);
    }
    return `효과: ${parts.join(' · ')}`;
  }

  /**
   * DOM 재생성 없이 버튼 활성/비활성 및 비용 텍스트만 즉시 갱신합니다.
   */
  private updateLiveCardStates(): void {
    if (this.activeTab === 'codex') return;

    const cards = this.elUpgradeList.querySelectorAll<HTMLElement>('.upgrade-card');
    cards.forEach((card) => {
      const id = card.dataset.upgradeId;
      if (!id) return;
      const def = UPGRADES.find((u) => u.id === id);
      if (!def) return;

      const lv = this.game.upgrades[id] ?? 0;
      const isUnlocked = this.game.reputation >= def.unlockRep;
      const cost = getUpgradeCost(def, lv);
      const canAfford = isUnlocked && this.game.gold >= cost;

      const lvBadge = card.querySelector<HTMLElement>('[data-role="level-badge"]');
      if (lvBadge) lvBadge.textContent = `Lv.${lv}`;

      const buyBtn = card.querySelector<HTMLButtonElement>('[data-role="buy-btn"]');
      const buyLabel = card.querySelector<HTMLElement>('[data-role="buy-label"]');
      const buyCost = card.querySelector<HTMLElement>('[data-role="buy-cost"]');

      if (buyBtn) buyBtn.disabled = !canAfford;
      if (buyLabel) {
        buyLabel.textContent = isUnlocked ? (lv === 0 ? '구매' : '강화') : '미해금';
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
      nameEl.textContent = unlocked ? `${g.name} (${g.title})` : `??? (${g.title})`;

      const badge = document.createElement('span');
      badge.className = 'upgrade-level-badge';
      badge.textContent = unlocked ? `방문 ${formatGold(visitCount)}회` : '미해금';

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
        effectsEl.textContent = `기본 서빙: ${formatGold(g.baseGold)}G · 평판 +${g.baseRep} · 전리품 〈${g.lootName}〉 (${Math.round(g.lootChance * 100)}%)`;
        textWrap.appendChild(effectsEl);
      } else {
        const reqEl = document.createElement('p');
        reqEl.className = 'upgrade-unlock-req';
        reqEl.textContent = `🔒 해금 조건: 여관 평판 ${formatGold(g.unlockRep)} 달성`;
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
