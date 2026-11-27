from PIL import Image

PAL = {
    ".": (0, 0, 0, 0),
    "K": (26, 18, 28, 255),     # 외곽선
    "b": (245, 242, 232, 255),  # 뼈 밝음
    "B": (196, 190, 175, 255),  # 뼈 음영
    "d": (122, 114, 106, 255),  # 뼈 어두움
    "E": (20, 14, 24, 255),     # 눈 구멍
    "n": (134, 255, 164, 255),  # 네크로 형광 초록
    "N": (34, 211, 126, 255),   # 네크로 초록
    "v": (158, 102, 224, 255),  # 보라
    "V": (102, 54, 168, 255),   # 어두운 보라
    "r": (244, 63, 94, 255),    # 붉은 눈/망토
    "R": (159, 18, 57, 255),    # 어두운 붉은색
    "g": (254, 240, 138, 255),  # 황금 밝음
    "G": (234, 179, 8, 255),    # 황금
    "i": (226, 232, 240, 255),  # 강철 밝음
    "I": (148, 163, 184, 255),  # 강철
    "s": (71, 85, 105, 255),    # 강철 어두움
    "w": (168, 104, 54, 255),   # 나무
    "W": (110, 62, 28, 255),    # 어두운 나무
    "c": (56, 189, 248, 255),   # 성기사 파랑
    "C": (29, 78, 216, 255),    # 어두운 파랑
    "p": (253, 224, 190, 255),  # 피부
}

# 16x16 소환수 4종 (수평 64x16 PNG):
# 0: 해골 병사 (근접 C~B)
# 1: 해골 궁수 (원거리 B~A)
# 2: 뼈 기사 (탱커 A)
# 3: 저주 리치 (마법 S)
SKELETON_SOLDIER = [
    ".....KKKKKK.....",
    "....KbbbbbbK....",
    "...KbbbbbbbBK...",
    "...KbEEbbEEBK...",
    "...KbbbbbbbBK...",
    "....KKbKKbKK....",
    "....KBBbbBBK..K.",
    "...KbKKbbKKbKKiK",
    "...Kb.KbbK.bKiIK",
    "....K.KBBK..KiK.",
    "......KbbK..KwK.",
    ".....KbbKbbK.K..",
    ".....KbK.KbK....",
    ".....KBK.KBK....",
    "....KBBK.KBBK...",
    "....KKK...KKK...",
]

SKELETON_ARCHER = [
    "....KKKKKKKK....",
    "...KVVvvvvVVK...",
    "...KbbbbbbbBK...",
    "...KbEEbbEEBK...",
    "...KbbbbbbbBK...",
    "....KKbKKbKK.KK.",
    "...KVVbbbbVVKwK.",
    "..KVvKKbbKKbKwK.",
    "..KVV.KbbK.bKwK.",
    "...KK.KBBK..KwK.",
    "......KbbK..KwK.",
    ".....KbbKbbKKK..",
    ".....KbK.KbK....",
    ".....KBK.KBK....",
    "....KBBK.KBBK...",
    "....KKK...KKK...",
]

BONE_KNIGHT = [
    "....K.KKKK.K....",
    "...KgKiiiiKgK...",
    "...KiiIIIIsiK...",
    "...KiEniiEniK...",
    "...KiiIIIIsiK...",
    "....KKsKKsKK....",
    "..KKssIGGIssKKK.",
    ".KiiKssGGssKiiIK",
    ".KiIKsIIIIsKiIIK",
    ".KssK.KssK..KiiK",
    "..KK..KssK...KK.",
    ".....KssKssK....",
    ".....KsK.KsK....",
    ".....KsK.KsK....",
    "....KssK.KssK...",
    "....KKK...KKK...",
]

CURSED_LICH = [
    "....K..KK..K....",
    "...KgKggggKgK...",
    "...KVVVVVVVVK...",
    "..KVVKKUUUKVVK..",
    "..KVVKUnUnKVVK..",
    "...KVKKUUKKVK.K.",
    "..KKvVVGGVVvKKnK",
    ".KvvVVGnnGVVvKnK",
    ".KvVVvVGGVvVVKK.",
    "..KuuKVGGVKuuKgK",
    "...KKKvVVvKK.KgK",
    "....KvVVVVvK.KgK",
    "....KuuVVuuK.KgK",
    ".....KnnnnK...K.",
    "......KnnK......",
    ".......KK.......",
]

# 16x16 적군 3종 (수평 48x16 PNG):
# 0: 성전사 보병 (근접)
# 1: 화염 사제 (원거리 화염구)
# 2: 심판관 보스 (거대 황금 성기사)
ENEMY_SOLDIER = [
    ".....KKKKKK.....",
    "....KiiiiiiK....",
    "...KiiIIIIsiK...",
    "...KiEEiiEEiK...",
    "...KippppppiK...",
    "....KKsKKsKK....",
    "...KCCcGGcCCK...",
    "..KccKccccKccK..",
    "..KcCKcGGcKCcK..",
    "...KK.KCCK.KK...",
    "......KssK......",
    ".....KssKssK....",
    ".....KsK.KsK....",
    ".....KWK.KWK....",
    "....KWWK.KWWK...",
    "....KKK...KKK...",
]

ENEMY_PRIEST = [
    ".....KKKKKK.....",
    "....KrrRRrrK....",
    "...KrrRRRRrrK...",
    "...KrpEEppEErK..",
    "...KrppppppprK..",
    "....KKrKKrKK....",
    "...KrrRggRrrK...",
    "..KrrKRggRKrrK..",
    "..KrRKRggRKRrK..",
    "...KK.KRRK.KK...",
    "......KrrK......",
    ".....KrrRrrK....",
    ".....KRRRRRK....",
    ".....KWK.KWK....",
    "....KWWK.KWWK...",
    "....KKK...KKK...",
]

ENEMY_BOSS = [
    "...K..KKKK..K...",
    "..KgKgGGGGgKgK..",
    "..KggGGGGGGggK..",
    "..KgErrGGrrEgK..",
    "..KgGppppppGgK..",
    "...KKgKKKKgKK...",
    ".KKrrGGGGGGrrKK.",
    "KrrKGGgRRgGGKrrK",
    "KrRKGGgRRgGGKRrK",
    ".KKK.KGGGGK.KKK.",
    ".....KGGGGK.....",
    "....KggKKggK....",
    "....KgK..KgK....",
    "....KGK..KGK....",
    "...KGGK..KGGK...",
    "...KKK....KKK...",
]


def save_strip(grids, out_path):
    w, h = 16, 16
    img = Image.new("RGBA", (w * len(grids), h), (0, 0, 0, 0))
    px = img.load()
    for idx, g in enumerate(grids):
        assert len(g) == 16
        for y, row in enumerate(g):
            # fix any 17-char typo safely by trimming/padding
            r = (row + "." * 16)[:16]
            for x, ch in enumerate(r):
                if ch in PAL:
                    px[idx * w + x, y] = PAL[ch]
    img.save(out_path)
    print(f"Saved {out_path} ({img.size})")


if __name__ == "__main__":
    save_strip(
        [SKELETON_SOLDIER, SKELETON_ARCHER, BONE_KNIGHT, CURSED_LICH],
        "game/assets/summons.png",
    )
    save_strip(
        [ENEMY_SOLDIER, ENEMY_PRIEST, ENEMY_BOSS],
        "game/assets/enemies.png",
    )
