import { SoundManager } from './audio';
import {
  GUEST_TYPES,
  RANDOM_EVENTS,
  SEAT_SLOTS,
  UPGRADES,
  getCurrentInnLevel,
  getNextInnLevel,
  getUpgradeCost,
} from './data';
import { formatGold } from './format';
import { CANVAS_WIDTH, RenderContextState } from './renderer';
import {
  ActiveEvent,
  CoinParticle,
  FloatingText,
  GuestEntity,
  GuestTypeDef,
  LogEntry,
  OrderType,
  RandomEventDef,
  SaveData,
  SeatSlot,
} from './types';

export const SAVE_STORAGE_KEY = 'pixel_dungeon_inn_save_v1';
export const MAX_OFFLINE_SECONDS = 8 * 3600; // 8시간 상한

export interface OfflineReport {
  elapsedSeconds: number;
  cappedSeconds: number;
  wasCapped: boolean;
  earnedGold: number;
  gpsUsed: number;
}

export class DungeonInnGame {
  public gold = 8;
  public totalGoldEarned = 8;
  public reputation = 0;
  public totalServed = 0;
  public totalLootFound = 0;
  public upgrades: Record<string, number> = {};
  public discoveredGuests: Record<string, number> = {
    traveler: 1,
    warrior: 1,
  };
  public tutorialSeen = false;

  public guests: GuestEntity[] = [];
  public floatingTexts: FloatingText[] = [];
  public particles: CoinParticle[] = [];
  public logs: LogEntry[] = [];
  public activeEvent: ActiveEvent | null = null;
  public eventCooldownSec = 0;

  public sound: SoundManager;

  private elapsedTime = 0;
  private nextGuestUid = 1;
  private nextLogId = 1;
  private spawnTimer = 0.6;
  private autoServeTimer = 0;
  private autoEventTimer = 38;
  private saveTimer = 0;
  private lastMemorySaveAt = 0;
  private innkeeperWaveTimer = 0;
  private maidPos: { x: number; y: number; facing: 'left' | 'right' } = {
    x: 155,
    y: 92,
    facing: 'left',
  };

  private onUiUpdate: () => void;
  private onLevelUp: (newLevelTitle: string, rewardText: string) => void;

  constructor(
    onUiUpdate: () => void,
    onLevelUp: (newLevelTitle: string, rewardText: string) => void
  ) {
    this.sound = new SoundManager(false);
    this.onUiUpdate = onUiUpdate;
    this.onLevelUp = onLevelUp;

    for (const u of UPGRADES) {
      this.upgrades[u.id] = 0;
    }
  }

  /**
   * localStorage에서 저장 데이터를 불러오고 오프라인 정산 결과를 반환합니다.
   */
  public loadFromStorage(): OfflineReport | null {
    try {
      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        this.addLog(
          '던전 입구 옆 작은 여관의 문을 열었습니다! 손님을 눌러 서빙해 보세요.',
          'normal'
        );
        // 초반 손님 2명 즉시 입장
        this.spawnGuest();
        return null;
      }

      const data = JSON.parse(raw) as Partial<SaveData>;
      if (typeof data.gold === 'number' && Number.isFinite(data.gold)) {
        this.gold = Math.max(0, data.gold);
      }
      if (typeof data.totalGoldEarned === 'number' && Number.isFinite(data.totalGoldEarned)) {
        this.totalGoldEarned = Math.max(this.gold, data.totalGoldEarned);
      }
      if (typeof data.reputation === 'number' && Number.isFinite(data.reputation)) {
        this.reputation = Math.max(0, Math.floor(data.reputation));
      }
      if (typeof data.totalServed === 'number') {
        this.totalServed = Math.max(0, Math.floor(data.totalServed));
      }
      if (typeof data.totalLootFound === 'number') {
        this.totalLootFound = Math.max(0, Math.floor(data.totalLootFound));
      }
      if (data.upgrades && typeof data.upgrades === 'object') {
        for (const u of UPGRADES) {
          const lv = data.upgrades[u.id];
          this.upgrades[u.id] =
            typeof lv === 'number' && lv >= 0 ? Math.floor(lv) : 0;
        }
      }
      if (data.discoveredGuests && typeof data.discoveredGuests === 'object') {
        this.discoveredGuests = { ...this.discoveredGuests, ...data.discoveredGuests };
      }
      if (typeof data.muted === 'boolean') {
        this.sound.setMuted(data.muted);
      }
      if (typeof data.tutorialSeen === 'boolean') {
        this.tutorialSeen = data.tutorialSeen;
      }

      // 해금된 손님 도감 동기화
      for (const g of GUEST_TYPES) {
        if (this.reputation >= g.unlockRep && !this.discoveredGuests[g.id]) {
          this.discoveredGuests[g.id] = 1;
        }
      }

      this.spawnGuest();

      // 오프라인 시간 계산
      const now = Date.now();
      const lastSaved =
        typeof data.lastSavedAt === 'number' && data.lastSavedAt > 0
          ? data.lastSavedAt
          : now;
      const elapsedSec = Math.floor((now - lastSaved) / 1000);
      const gps = this.getGoldPerSecond();

      if (elapsedSec >= 10 && gps > 0) {
        const cappedSec = Math.min(MAX_OFFLINE_SECONDS, elapsedSec);
        const vaultLv = this.upgrades['fac_vault'] ?? 0;
        const offlineEfficiency = 0.85 + vaultLv * 0.1;
        const earned = Math.max(1, Math.floor(cappedSec * gps * offlineEfficiency));

        this.addGold(earned);
        this.saveToStorage();
        this.addLog(
          `오프라인 동안 여관을 운영하여 +${formatGold(earned)} 골드를 정산받았습니다!`,
          'event'
        );

        return {
          elapsedSeconds: elapsedSec,
          cappedSeconds: cappedSec,
          wasCapped: elapsedSec > MAX_OFFLINE_SECONDS,
          earnedGold: earned,
          gpsUsed: gps,
        };
      }

      this.addLog('여관 장부를 불러왔습니다. 오늘도 모험가들이 찾아옵니다!', 'normal');
      return null;
    } catch {
      this.addLog('새 여관 장부를 시작합니다!', 'normal');
      this.spawnGuest();
      return null;
    }
  }

  public saveToStorage(isUnloadEvent = false): void {
    try {
      const now = Date.now();
      if (isUnloadEvent && this.lastMemorySaveAt > 0) {
        const existingRaw = localStorage.getItem(SAVE_STORAGE_KEY);
        if (existingRaw) {
          const existing = JSON.parse(existingRaw) as Partial<SaveData>;
          if (
            typeof existing.lastSavedAt === 'number' &&
            existing.lastSavedAt < this.lastMemorySaveAt - 5000
          ) {
            // 개발자 도구 또는 테스트에서 오프라인 시간 시뮬레이션을 위해 타임스탬프를 과거로 수정한 경우 유지
            return;
          }
        }
      }
      this.lastMemorySaveAt = now;
      const payload: SaveData = {
        version: 1,
        gold: this.gold,
        totalGoldEarned: this.totalGoldEarned,
        reputation: this.reputation,
        totalServed: this.totalServed,
        totalLootFound: this.totalLootFound,
        upgrades: this.upgrades,
        discoveredGuests: this.discoveredGuests,
        muted: this.sound.isMuted(),
        tutorialSeen: this.tutorialSeen,
        lastSavedAt: now,
      };
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage 용량/권한 예외 무시
    }
  }

  public resetGame(): void {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // ignore
    }
    this.gold = 8;
    this.totalGoldEarned = 8;
    this.reputation = 0;
    this.totalServed = 0;
    this.totalLootFound = 0;
    for (const u of UPGRADES) {
      this.upgrades[u.id] = 0;
    }
    this.discoveredGuests = {
      traveler: 1,
      warrior: 1,
    };
    this.guests = [];
    this.floatingTexts = [];
    this.particles = [];
    this.logs = [];
    this.activeEvent = null;
    this.eventCooldownSec = 0;
    this.spawnTimer = 0.4;

    this.addLog(
      '여관을 처음부터 다시 단장했습니다! 첫 손님이 들어오고 있습니다.',
      'normal'
    );
    this.spawnGuest();
    this.saveToStorage();
    this.onUiUpdate();
  }

  /**
   * 전체 골드 배율 (시설, 직원, 여관 등급, 활성 이벤트 반영)
   */
  public getGlobalGoldMultiplier(): number {
    let mult = 1.0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.globalMultiplierBonus) {
        mult += lv * u.globalMultiplierBonus;
      }
    }
    const innLv = getCurrentInnLevel(this.reputation).level;
    mult += (innLv - 1) * 0.08;

    if (this.activeEvent) {
      mult *= this.activeEvent.def.goldMult;
    }
    return mult;
  }

  /**
   * 초당 자동 수입 (GPS)
   */
  public getGoldPerSecond(): number {
    let baseGps = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0) {
        baseGps += lv * u.gpsPerLevel;
      }
    }
    return baseGps * this.getGlobalGoldMultiplier();
  }

  /**
   * 클릭/서빙 1회당 기본 보너스 골드
   */
  public getClickServeBonus(): number {
    let baseClick = 5;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0) {
        baseClick += lv * u.clickPerLevel;
      }
    }
    return Math.max(5, Math.floor(baseClick * this.getGlobalGoldMultiplier()));
  }

  /**
   * 손님 1명 서빙 시 획득할 예상 골드 계산
   */
  public getGuestServeGold(guestDef: GuestTypeDef, isManualClick: boolean): number {
    let raw = guestDef.baseGold;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0) {
        raw += lv * u.clickPerLevel;
      }
    }
    let total = raw * this.getGlobalGoldMultiplier();
    if (isManualClick) {
      total *= 1.25; // 직접 서빙 시 주인장 친절 보너스 +25%
    }
    return Math.max(1, Math.floor(total));
  }

  /**
   * 서빙 시 획득 평판 계산
   */
  public getServeReputationGain(guestDef: GuestTypeDef): number {
    let rep = guestDef.baseRep;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.repPerServeBonus) {
        rep += lv * u.repPerServeBonus;
      }
    }
    return Math.max(1, Math.round(rep));
  }

  /**
   * 동시 최대 손님 수 (기본 4명 ~ 최대 12명)
   */
  public getMaxGuests(): number {
    let bonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.maxGuestsBonusPerLevel) {
        bonus += Math.ceil((lv * u.maxGuestsBonusPerLevel) / 2);
      }
    }
    return Math.min(12, 4 + bonus);
  }

  /**
   * 직원 고용 여부 및 자동 서빙 주기(초)
   */
  public getTotalStaffLevels(): number {
    return (
      (this.upgrades['staff_maid'] ?? 0) +
      (this.upgrades['staff_bartender'] ?? 0) +
      (this.upgrades['staff_chef'] ?? 0) +
      (this.upgrades['staff_bard'] ?? 0)
    );
  }

  public getAutoServeInterval(): number {
    let speed = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.autoServeSpeedBonus) {
        speed += lv * u.autoServeSpeedBonus;
      }
    }
    if (speed <= 0) {
      return 7.5; // 직원이 없어도 7.5초 후 여관 주인이 기본 응대
    }
    return Math.max(0.55, 3.2 / (1 + speed * 0.65));
  }

  /**
   * 전리품 추가 확률 보너스
   */
  public getExtraLootChance(): number {
    let bonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.lootChanceBonus) {
        bonus += lv * u.lootChanceBonus;
      }
    }
    if (getCurrentInnLevel(this.reputation).level >= 8) {
      bonus += 0.08;
    }
    if (this.activeEvent) {
      bonus += this.activeEvent.def.lootChanceAdd;
    }
    return bonus;
  }

  public addGold(amount: number): void {
    if (amount <= 0) return;
    this.gold += amount;
    this.totalGoldEarned += amount;
  }

  public addReputation(amount: number): void {
    if (amount <= 0) return;
    const prevLevel = getCurrentInnLevel(this.reputation).level;
    this.reputation += amount;
    const newLevelDef = getCurrentInnLevel(this.reputation);

    // 새로 해금된 손님 확인
    for (const g of GUEST_TYPES) {
      if (this.reputation >= g.unlockRep && !this.discoveredGuests[g.id]) {
        this.discoveredGuests[g.id] = 1;
        this.addLog(
          `새로운 손님 [${g.name}]이(가) 여관 소문을 듣고 찾아오기 시작합니다!`,
          'unlock'
        );
      }
    }

    if (newLevelDef.level > prevLevel) {
      this.sound.playLevelUp();
      this.addLog(
        `🎊 여관 등급 상승! [${newLevelDef.title}] 달성! (${newLevelDef.rewardText})`,
        'unlock'
      );
      this.spawnFloatingText(
        CANVAS_WIDTH / 2 - 35,
        50,
        `★ ${newLevelDef.title}!`,
        '#ffd166'
      );
      this.onLevelUp(newLevelDef.title, newLevelDef.rewardText);
    }
  }

  /**
   * 업그레이드 구매
   */
  public buyUpgrade(upgradeId: string): boolean {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return false;
    if (this.reputation < def.unlockRep) return false;

    const currentLv = this.upgrades[upgradeId] ?? 0;
    const cost = getUpgradeCost(def, currentLv);
    if (this.gold < cost) return false;

    this.gold -= cost;
    this.upgrades[upgradeId] = currentLv + 1;
    this.sound.playUpgrade();

    // 업그레이드 구매 시 소량 명성 보너스 (+1~2)
    this.addReputation(currentLv === 0 ? 2 : 1);

    this.spawnFloatingText(
      140,
      64,
      `${def.name} Lv.${currentLv + 1}!`,
      '#63e6be'
    );
    this.addLog(
      `[${def.name}] Lv.${currentLv + 1} 업그레이드 완료!`,
      'normal'
    );

    this.saveToStorage();
    this.onUiUpdate();
    return true;
  }

  /**
   * 메인 프레임 업데이트 루프 (dt: 초 단위)
   */
  public update(dt: number): void {
    const clampedDt = Math.min(0.1, Math.max(0, dt));
    this.elapsedTime += clampedDt;

    // 1. 초당 자동 골드 수입 (GPS)
    const gps = this.getGoldPerSecond();
    if (gps > 0) {
      this.addGold(gps * clampedDt);
    }

    // 2. 활성 랜덤 이벤트 타이머
    if (this.activeEvent) {
      this.activeEvent.remainingSec -= clampedDt;
      if (this.activeEvent.remainingSec <= 0) {
        this.addLog(
          `[${this.activeEvent.def.title}] 이벤트가 마무리되었습니다.`,
          'normal'
        );
        this.activeEvent = null;
        this.onUiUpdate();
      }
    } else {
      this.autoEventTimer -= clampedDt;
      if (this.autoEventTimer <= 0) {
        this.autoEventTimer = 48 + Math.random() * 20;
        this.triggerRandomEvent();
      }
    }

    if (this.eventCooldownSec > 0) {
      this.eventCooldownSec = Math.max(0, this.eventCooldownSec - clampedDt);
    }

    if (this.innkeeperWaveTimer > 0) {
      this.innkeeperWaveTimer = Math.max(0, this.innkeeperWaveTimer - clampedDt);
    }

    // 3. 손님 입장 스폰 타이머
    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0) {
      if (this.guests.length < this.getMaxGuests()) {
        this.spawnGuest();
      }
      this.spawnTimer = this.getNextSpawnDelay();
    }

    // 4. 직원 자동 서빙 타이머
    const waitingGuests = this.guests.filter((g) => g.state === 'waiting');
    if (waitingGuests.length > 0) {
      this.autoServeTimer += clampedDt;
      const interval = this.getAutoServeInterval();
      if (this.autoServeTimer >= interval) {
        this.autoServeTimer = 0;
        // 가장 오래 기다린 손님 자동 서빙
        this.serveGuest(waitingGuests[0], false);
      }
    } else {
      this.autoServeTimer = 0;
    }

    // 5. 메이드 이동 애니메이션
    this.updateMaidMovement(clampedDt, waitingGuests[0]);

    // 6. 손님 상태 머신 업데이트
    this.updateGuests(clampedDt);

    // 7. 파티클 & 플로팅 텍스트 업데이트
    this.updateParticlesAndTexts(clampedDt);

    // 8. 5초마다 자동 저장
    this.saveTimer += clampedDt;
    if (this.saveTimer >= 5.0) {
      this.saveTimer = 0;
      this.saveToStorage();
    }
  }

  private getNextSpawnDelay(): number {
    let rateBonus = 0;
    for (const u of UPGRADES) {
      const lv = this.upgrades[u.id] ?? 0;
      if (lv > 0 && u.spawnRateBonus) {
        rateBonus += lv * u.spawnRateBonus;
      }
    }
    let delay = 3.2 / (1 + rateBonus * 0.45);
    if (this.activeEvent) {
      delay /= this.activeEvent.def.spawnMult;
    }
    return Math.max(0.75, delay + (Math.random() * 0.6 - 0.3));
  }

  private updateMaidMovement(dt: number, targetGuest?: GuestEntity): void {
    if ((this.upgrades['staff_maid'] ?? 0) <= 0) return;

    const destX = targetGuest ? targetGuest.x - 10 : 155;
    const destY = targetGuest ? targetGuest.y + 2 : 92;

    const dx = destX - this.maidPos.x;
    const dy = destY - this.maidPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 2) {
      const speed = 52;
      this.maidPos.x += (dx / dist) * speed * dt;
      this.maidPos.y += (dy / dist) * speed * dt;
      this.maidPos.facing = dx >= 0 ? 'right' : 'left';
    }
  }

  private updateGuests(dt: number): void {
    const walkSpeed = 72;
    const remaining: GuestEntity[] = [];

    for (const g of this.guests) {
      g.animTime += dt;
      if (g.quoteTimer > 0) {
        g.quoteTimer = Math.max(0, g.quoteTimer - dt);
      }

      if (g.state === 'entering') {
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 2) {
          g.x = g.targetX;
          g.y = g.targetY;
          const seat = SEAT_SLOTS.find((s) => s.id === g.seatId);
          g.facing = seat ? seat.facing : 'right';
          g.state = 'waiting';
          g.stateTimer = 0;
        } else {
          g.x += (dx / dist) * walkSpeed * dt;
          g.y += (dy / dist) * walkSpeed * dt;
          g.facing = dx >= 0 ? 'right' : 'left';
        }
        remaining.push(g);
      } else if (g.state === 'waiting') {
        g.stateTimer += dt;
        remaining.push(g);
      } else if (g.state === 'enjoying') {
        g.stateTimer += dt;
        if (g.stateTimer >= g.maxWaitTime) {
          g.state = 'leaving';
          g.targetX = 8;
          g.targetY = 122;
          g.facing = 'left';
        }
        remaining.push(g);
      } else if (g.state === 'leaving') {
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 3) {
          g.x += (dx / dist) * walkSpeed * dt;
          g.y += (dy / dist) * walkSpeed * dt;
          g.facing = 'left';
          remaining.push(g);
        }
        // 문에 도착하면 퇴장 완료
      }
    }

    this.guests = remaining;
  }

  private updateParticlesAndTexts(dt: number): void {
    this.floatingTexts = this.floatingTexts.filter((ft) => {
      ft.y += ft.vy * dt;
      ft.life -= dt;
      return ft.life > 0;
    });

    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 110 * dt; // 중력
      p.life -= dt;
      return p.life > 0;
    });
  }

  /**
   * 새로운 모험가 손님 입장
   */
  public spawnGuest(): void {
    const occupiedSeatIds = new Set(this.guests.map((g) => g.seatId));
    const availableSeats = SEAT_SLOTS.filter((s) => {
      if (occupiedSeatIds.has(s.id)) return false;
      if (s.type === 'smithy' && (this.upgrades['fac_smithy'] ?? 0) <= 0) {
        return false;
      }
      if (
        s.type === 'room' &&
        (this.upgrades['room_straw'] ?? 0) + (this.upgrades['room_oak'] ?? 0) <= 0
      ) {
        return false;
      }
      return true;
    });

    if (availableSeats.length === 0) return;

    // 해금된 손님 목록에서 가중치 랜덤 선택 (게시판 레벨이 높을수록 상위 손님 등장 확률 상승)
    const unlockedGuests = GUEST_TYPES.filter(
      (g) => this.reputation >= g.unlockRep
    );
    const boardLv = this.upgrades['fac_board'] ?? 0;
    const weights = unlockedGuests.map((_, idx) => {
      return 1 + idx * (0.35 + boardLv * 0.12);
    });
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let r = Math.random() * totalWeight;
    let chosenDef = unlockedGuests[0];
    for (let i = 0; i < unlockedGuests.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        chosenDef = unlockedGuests[i];
        break;
      }
    }

    const isFirstGuest = this.guests.length === 0;
    const seat: SeatSlot = isFirstGuest
      ? availableSeats[0]
      : availableSeats[Math.floor(Math.random() * availableSeats.length)];

    // 주문 종류 결정
    let orderType: OrderType = 'stew';
    if (seat.type === 'smithy') {
      orderType = 'repair';
    } else if (seat.type === 'room') {
      orderType = 'sleep';
    } else {
      const availOrders = chosenDef.preferredOrders.filter((ord) => {
        if (ord === 'ale' && (this.upgrades['menu_ale'] ?? 0) <= 0) return false;
        if (ord === 'potion' && (this.upgrades['menu_potion'] ?? 0) <= 0) return false;
        if (ord === 'repair' && (this.upgrades['fac_smithy'] ?? 0) <= 0) return false;
        return true;
      });
      orderType =
        availOrders.length > 0
          ? availOrders[Math.floor(Math.random() * availOrders.length)]
          : 'stew';
    }

    const guest: GuestEntity = {
      uid: this.nextGuestUid++,
      typeId: chosenDef.id,
      state: 'entering',
      x: isFirstGuest ? 34 : 12,
      y: isFirstGuest ? 110 : 120 + (Math.random() * 8 - 4),
      targetX: seat.x,
      targetY: seat.y,
      facing: 'right',
      seatId: seat.id,
      seatType: seat.type,
      orderType,
      stateTimer: 0,
      maxWaitTime: 3.8 + Math.random() * 1.8,
      animTime: Math.random() * 10,
      quoteText: null,
      quoteTimer: 0,
      isSleeping: orderType === 'sleep',
    };

    this.guests.push(guest);
    this.discoveredGuests[chosenDef.id] =
      (this.discoveredGuests[chosenDef.id] ?? 0) + 1;
  }

  /**
   * 손님 서빙 처리 (직접 클릭 또는 직원 자동 서빙)
   */
  public serveGuest(guest: GuestEntity, isManualClick: boolean): void {
    if (guest.state !== 'waiting') return;

    const def =
      GUEST_TYPES.find((g) => g.id === guest.typeId) ?? GUEST_TYPES[0];
    const earnedGold = this.getGuestServeGold(def, isManualClick);
    const earnedRep = this.getServeReputationGain(def);

    this.addGold(earnedGold);
    this.addReputation(earnedRep);
    this.totalServed += 1;

    guest.state = 'enjoying';
    guest.stateTimer = 0;
    guest.isSleeping =
      guest.orderType === 'sleep' ||
      (guest.orderType === 'stew' && Math.random() < 0.35);

    const quotePool = guest.isSleeping ? def.sleepQuotes : def.quotes;
    const chosenQuote =
      quotePool[Math.floor(Math.random() * quotePool.length)];
    guest.quoteText = chosenQuote;
    guest.quoteTimer = 3.0;

    // 코인 파티클 & 골드 플로팅 텍스트
    this.spawnCoins(guest.x, guest.y - 12, isManualClick ? 7 : 4);
    this.spawnFloatingText(
      guest.x - 12,
      guest.y - 22,
      `+${formatGold(earnedGold)}G`,
      '#ffd166'
    );

    // 전리품(던전 루팅 팁) 판정
    const lootChance = Math.min(
      0.75,
      def.lootChance + this.getExtraLootChance()
    );
    if (Math.random() < lootChance) {
      const hotSpringLv = this.upgrades['fac_hotspring'] ?? 0;
      const lootGold = Math.max(
        5,
        Math.floor(earnedGold * (def.lootGoldMultiplier + hotSpringLv * 0.25))
      );
      this.addGold(lootGold);
      this.totalLootFound += 1;
      this.sound.playLoot();

      this.spawnFloatingText(
        guest.x - 18,
        guest.y - 33,
        `★${def.lootName} +${formatGold(lootGold)}G`,
        '#ff922b'
      );
      this.addLog(
        `🎁 [${def.name}] 손님이 던전 전리품 〈${def.lootName}〉을(를) 팁으로 남겼습니다! (+${formatGold(lootGold)}G)`,
        'loot'
      );
    } else {
      if (isManualClick) {
        this.sound.playCoin();
      }
      if (Math.random() < 0.45 || this.logs.length < 3) {
        this.addLog(`${def.name}: "${chosenQuote}" (+${formatGold(earnedGold)}G)`, 'normal');
      }
    }

    if (isManualClick) {
      this.innkeeperWaveTimer = 0.4;
    }

    this.onUiUpdate();
  }

  /**
   * 캔버스 클릭/탭 좌표 처리 (내부 픽셀 좌표 320x192 기준)
   */
  public handleCanvasTap(canvasX: number, canvasY: number): void {
    // 1. 클릭 위치 근처의 대기 중(waiting) 손님 우선 탐색 (터치 반경 넉넉하게 28px)
    let closestWaiting: GuestEntity | null = null;
    let minWaitDist = 30;

    for (const g of this.guests) {
      if (g.state === 'waiting') {
        const dist = Math.hypot(g.x - canvasX, g.y - 10 - canvasY);
        if (dist < minWaitDist) {
          minWaitDist = dist;
          closestWaiting = g;
        }
      }
    }

    if (closestWaiting) {
      this.serveGuest(closestWaiting, true);
      return;
    }

    // 2. 만약 아무 곳이나 탭했는데 대기 중인 손님이 다른 자리에 있으면 그 손님을 즉시 서빙!
    const anyWaiting = this.guests.find((g) => g.state === 'waiting');
    if (anyWaiting) {
      this.serveGuest(anyWaiting, true);
      return;
    }

    // 3. 대기 중인 손님이 없을 때 탭하면: 여관 정돈/호객 보너스 골드 획득 + 손님 입장 가속!
    const tipGold = Math.max(2, Math.floor(this.getClickServeBonus() * 0.35));
    this.addGold(tipGold);
    this.sound.playCoin();
    this.innkeeperWaveTimer = 0.35;
    this.spawnTimer = Math.max(0.1, this.spawnTimer - 0.45);

    this.spawnCoins(canvasX, canvasY, 4);
    this.spawnFloatingText(
      Math.max(8, Math.min(CANVAS_WIDTH - 48, canvasX - 12)),
      Math.max(14, canvasY - 6),
      `+${formatGold(tipGold)}G`,
      '#fde047'
    );
    this.onUiUpdate();
  }

  /**
   * [직접 서빙 / 호객하기] 버튼 클릭 시
   */
  public serveAllOrSolicit(): void {
    const waiting = this.guests.filter((g) => g.state === 'waiting');
    if (waiting.length > 0) {
      for (const g of waiting) {
        this.serveGuest(g, true);
      }
      return;
    }

    // 대기 손님이 없으면 호객 보너스 + 손님 즉시 입장
    const tipGold = Math.max(3, Math.floor(this.getClickServeBonus() * 0.45));
    this.addGold(tipGold);
    this.sound.playCoin();
    this.innkeeperWaveTimer = 0.4;
    if (this.guests.length < this.getMaxGuests()) {
      this.spawnGuest();
    }
    this.spawnCoins(180, 56, 5);
    this.spawnFloatingText(164, 42, `+${formatGold(tipGold)}G 호객!`, '#fde047');
    this.onUiUpdate();
  }

  /**
   * 랜덤 이벤트 발동
   */
  public triggerRandomEvent(manual = false): boolean {
    if (manual && (this.activeEvent || this.eventCooldownSec > 0)) {
      return false;
    }

    const def: RandomEventDef =
      RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    this.activeEvent = {
      def,
      remainingSec: def.durationSec,
    };
    this.eventCooldownSec = 30;
    this.sound.playEvent();

    let extraMsg = '';
    if (def.instantGoldFactor) {
      const bonusGold = Math.max(
        15,
        Math.floor(
          (this.getClickServeBonus() + this.getGoldPerSecond() * 2) *
            def.instantGoldFactor
        )
      );
      this.addGold(bonusGold);
      this.spawnCoins(CANVAS_WIDTH / 2, 70, 10);
      this.spawnFloatingText(
        CANVAS_WIDTH / 2 - 28,
        62,
        `+${formatGold(bonusGold)}G 보너스!`,
        '#ffd166'
      );
      extraMsg += ` (+${formatGold(bonusGold)} 골드)`;
    }
    if (def.instantRep) {
      this.addReputation(def.instantRep);
      extraMsg += ` (평판 +${def.instantRep})`;
    }

    // 손님 한두 명 즉시 추가 입장
    if (this.guests.length < this.getMaxGuests()) {
      this.spawnGuest();
    }

    this.addLog(`${def.title} — ${def.description}${extraMsg}`, 'event');
    this.onUiUpdate();
    return true;
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string
  ): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -18,
      text,
      color,
      life: 1.15,
      maxLife: 1.15,
    });
  }

  public spawnCoins(x: number, y: number, count: number): void {
    const colors = ['#ffd166', '#fcbf49', '#f77f00', '#fef08a'];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const speed = 28 + Math.random() * 36;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 15,
        color: colors[i % colors.length],
        size: i % 2 === 0 ? 3 : 2,
        life: 0.55 + Math.random() * 0.25,
        maxLife: 0.8,
      });
    }
  }

  public addLog(text: string, type: LogEntry['type']): void {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');

    this.logs.unshift({
      id: this.nextLogId++,
      timeText: `${hh}:${mm}:${ss}`,
      text,
      type,
    });
    if (this.logs.length > 20) {
      this.logs.length = 20;
    }
  }

  /**
   * 다음 해금 목표 안내 문자열
   */
  public getNextGoalDescription(): string {
    const nextLv = getNextInnLevel(this.reputation);
    if (nextLv) {
      const remain = Math.max(0, nextLv.requiredRep - this.reputation);
      return `다음 목표: 평판 ${formatGold(nextLv.requiredRep)} 달성 시 [${nextLv.title}] 승급 (${nextLv.rewardText}) — 남은 평판 ${formatGold(remain)}`;
    }
    return '최고 등급 [Lv.10 전설의 던전 여관] 달성! 모든 모험가와 용왕의 안식처입니다.';
  }

  public getRenderState(): RenderContextState {
    return {
      time: this.elapsedTime,
      guests: this.guests,
      floatingTexts: this.floatingTexts,
      particles: this.particles,
      upgrades: this.upgrades,
      activeEvent: this.activeEvent,
      maidPos: this.maidPos,
      innkeeperWaveTimer: this.innkeeperWaveTimer,
    };
  }
}
