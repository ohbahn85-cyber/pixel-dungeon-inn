import type { ArtAtlas } from './artAtlas';
import { overrideReelSprite, type ReelId } from './reelSprites';

/** Kenney 아이템 타일로 슬롯 심볼을 덮어쓴다. 추상 심볼(7, 잠금, 배율, 룬)은 그대로 둔다. */
export function installKenneyReels(art: ArtAtlas): void {
  const put = (id: ReelId, sheet: Parameters<ArtAtlas['slice']>[0], c: number, r: number) => {
    overrideReelSprite(id, art.slice(sheet, c, r));
  };

  put('sword', 'tiny', 7, 8);
  put('axe', 'tiny', 9, 9);
  put('bow', 'tiny', 10, 10);
  put('dagger', 'tiny', 8, 8);
  put('staffW', 'tiny', 8, 10);
  put('hammer', 'tiny', 9, 10);
  put('potion', 'tiny', 7, 9);
  put('flask', 'tiny', 8, 9);
  put('chest', 'tiny', 5, 6);
  put('hero', 'tiny', 0, 8);
  put('mushroom', 'caves', 0, 3);
  put('herb', 'caves', 2, 3);
  put('lotus', 'rpg', 0, 6);
  put('mandrake', 'rpg', 2, 6);
  put('phoenix', 'tiny', 8, 9);
  put('cheese', 'rpg', 16, 5);
  put('meat', 'rpg', 16, 4);
  put('steak', 'rpg', 16, 6);
  put('copper', 'caves', 8, 10);
  put('steel', 'caves', 9, 10);
  put('mythril', 'caves', 8, 11);
  put('orichalcum', 'caves', 9, 12);
  put('gem', 'caves', 8, 12);
  put('coin', 'caves', 10, 12);
  put('cherry', 'rpg', 1, 6);
}

export { };
