import { INITIAL_STAFF, MATERIALS } from './data';
import { GameSaveData } from './types';

const LS_KEY = 'kairo_slot_dungeon_inn_v5';
const IDB_NAME = 'KairoSlotDungeonInnDB';
const IDB_STORE = 'saves';
const IDB_KEY = 'primary_save';

export function createInitialSaveData(): GameSaveData {
  const initialMaterials: Record<string, number> = {};
  for (const m of MATERIALS) {
    initialMaterials[m.id] = m.tier === 'C' ? 8 : m.tier === 'B' ? 2 : 0;
  }

  return {
    version: 5,
    savedAt: Date.now(),
    year: 1,
    month: 1,
    week: 1,
    gold: 850,
    scrap: 15,
    materials: initialMaterials,
    facilities: {
      inn: {
        id: 'inn',
        name: '모험가 여관 & 주방',
        level: 1,
        passives: [],
      },
      blacksmith: {
        id: 'blacksmith',
        name: '황금모루 대장간',
        level: 1,
        passives: [],
      },
      potion: {
        id: 'potion',
        name: '신비 포션 공방',
        level: 1,
        passives: [],
      },
      trade: {
        id: 'trade',
        name: '왕국 교역소',
        level: 1,
        passives: [],
      },
    },
    staff: {
      chef: { ...INITIAL_STAFF.chef },
      forger: { ...INITIAL_STAFF.forger },
      enhancer: { ...INITIAL_STAFF.enhancer },
      enchanter: { ...INITIAL_STAFF.enchanter },
      alchemist: { ...INITIAL_STAFF.alchemist },
    },
    heroes: [
      {
        id: 'hero_init_1',
        name: '아서',
        classId: 'knight',
        className: '왕국 기사',
        tier: 'C',
        level: 1,
        exp: 0,
        maxLevelCap: 10,
        baseHp: 135,
        baseAtk: 16,
        baseDef: 10,
        currentHp: 135,
        weaponId: 'wp_init_1',
        activeMeal: null,
        equippedPotionId: null,
        hairColor: '#f59e0b',
        armorColor: '#3b82f6',
      },
      {
        id: 'hero_init_2',
        name: '실비아',
        classId: 'archer',
        className: '명사수',
        tier: 'B',
        level: 1,
        exp: 0,
        maxLevelCap: 20,
        baseHp: 105,
        baseAtk: 23,
        baseDef: 6,
        currentHp: 105,
        weaponId: null,
        activeMeal: null,
        equippedPotionId: null,
        hairColor: '#84cc16',
        armorColor: '#15803d',
      },
    ],
    weapons: [
      {
        id: 'wp_init_1',
        name: '견습 기사의 장검',
        type: 'sword',
        tier: 'C',
        icon: '🗡️',
        baseAtk: 14,
        enhanceCount: 1,
        enhanceLocked: false,
        enchants: [],
        equippedHeroId: 'hero_init_1',
      },
    ],
    dishes: [
      {
        id: 'dish_init_1',
        name: '따끈한 버섯 고기스튜',
        tier: 'C',
        icon: '🍲',
        hpBonus: 45,
        atkBonus: 6,
        spdBonus: 5,
        sellGold: 45,
        desc: '1회 출정 동안 체력 +45, 공격력 +6 상승',
      },
    ],
    potions: [
      {
        id: 'pot_init_1',
        name: '이슬 회복 물약',
        tier: 'C',
        icon: '🧪',
        healPct: 35,
        atkBuffPct: 10,
        sellGold: 45,
        desc: '던전 위기 시 체력 35% 회복 & 공격력 10% 증가',
      },
    ],
    clearedDungeons: {
      dungeon_1: 0,
      dungeon_2: 0,
      dungeon_3: 0,
      dungeon_4: 0,
    },
    totalSlotSpins: 0,
    totalJackpots: 0,
  };
}

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveGameData(data: GameSaveData): Promise<void> {
  data.savedAt = Date.now();
  const raw = JSON.stringify(data);

  // 1. LocalStorage 즉시 저장
  try {
    localStorage.setItem(LS_KEY, raw);
  } catch (e) {
    console.warn('LocalStorage 저장 실패:', e);
  }

  // 2. IndexedDB 이중 비동기 저장
  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(data, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('IndexedDB 저장 실패:', e);
  }
}

export async function loadGameData(): Promise<GameSaveData> {
  let lsData: GameSaveData | null = null;
  let idbData: GameSaveData | null = null;

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 5) {
        lsData = parsed;
      }
    }
  } catch (e) {
    console.warn('LocalStorage 로드 오류:', e);
  }

  try {
    const db = await openIndexedDB();
    idbData = await new Promise<GameSaveData | null>((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        const res = req.result;
        if (res && res.version === 5) {
          resolve(res);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
    db.close();
  } catch (e) {
    console.warn('IndexedDB 로드 오류:', e);
  }

  // 두 저장소 중 더 최신(savedAt이 큰) 데이터를 선택
  if (lsData && idbData) {
    return (lsData.savedAt || 0) >= (idbData.savedAt || 0) ? lsData : idbData;
  }
  if (idbData) return idbData;
  if (lsData) return lsData;

  const fresh = createInitialSaveData();
  await saveGameData(fresh);
  return fresh;
}

export function exportSaveToJsonFile(data: GameSaveData): void {
  const pretty = JSON.stringify(data, null, 2);
  const blob = new Blob([pretty], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pixel-dungeon-inn-save-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importSaveFromJsonFile(file: File): Promise<GameSaveData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed.gold !== 'number' || !parsed.facilities) {
          throw new Error('유효하지 않은 세이브 파일입니다.');
        }
        parsed.version = 5;
        await saveGameData(parsed);
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
