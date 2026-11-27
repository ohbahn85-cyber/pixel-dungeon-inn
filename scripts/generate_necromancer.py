from PIL import Image

PALETTE = {
    ".": (0, 0, 0, 0),
    "K": (28, 19, 26, 255),      # 짙은 다크 플럼/브라운 외곽선
    # 피부 (약간 창백한 네크로맨서 톤)
    "s": (255, 232, 214, 255),   # 밝은 피부
    "S": (236, 200, 174, 255),   # 기본 피부
    "p": (196, 152, 126, 255),   # 피부 음영
    "c": (238, 122, 134, 255),   # 귀여운 볼터치
    # 눈 & 네크로 형광 초록 마력
    "E": (24, 18, 28, 255),      # 일반 검은 눈동자
    "W": (255, 255, 255, 255),   # 하얀 흰자/하트팬티 바탕
    "w": (222, 226, 235, 255),   # 팬티 음영
    "H": (239, 68, 88, 255),     # 하트 팬티 빨간 하트!
    "n": (134, 255, 164, 255),   # 네크로 형광 초록 밝음
    "N": (34, 211, 126, 255),    # 네크로 형광 초록 기본
    "m": (16, 128, 86, 255),     # 네크로 초록 어두움
    # Stage 1: 거적대기 & 머리카락 & 나뭇가지
    "k": (58, 52, 74, 255),      # 어두운 삐쭉 머리 기본
    "q": (92, 84, 115, 255),     # 머리 하이라이트
    "r": (176, 134, 92, 255),    # 거적대기(마대자루) 밝음
    "R": (138, 98, 62, 255),     # 거적대기 기본
    "d": (94, 62, 38, 255),      # 거적대기 그림자/나뭇가지
    # Stage 2~4: 다크 보라 로브 & 망토
    "v": (147, 94, 214, 255),    # 보라 로브 하이라이트
    "V": (104, 56, 168, 255),    # 보라 로브 기본
    "u": (64, 32, 112, 255),     # 보라 로브 그림자
    "U": (36, 18, 66, 255),      # 후드 속 어둠
    # 황금 장식 & 뼈/해골
    "g": (254, 240, 138, 255),   # 황금 하이라이트
    "G": (234, 179, 8, 255),     # 황금 기본
    "o": (161, 98, 7, 255),      # 황금 어두움
    "b": (245, 242, 230, 255),   # 해골/뼈 밝음
    "B": (196, 190, 174, 255),   # 해골/뼈 음영
    # 각성 붉은 보석/왕관 포인트
    "x": (244, 63, 94, 255),     # 루비/혈석
    "X": (159, 18, 57, 255),     # 어두운 루비
}

# =========================================================================
# STAGE 1 (Lv.1 거지 견습 네크로맨서): 하트 팬티 + 구멍난 거적대기 + 나뭇가지!
# 28 x 32 pixels
# =========================================================================
STAGE1_FRONT = [
    "............................",
    "............................",
    "............................",
    "............................",
    ".........KK..KK.............",
    "........KqqKKqkK............",
    ".......KqqkkkkkkKK..........",
    "......KqkkkkkkkkkkK.........",
    "......KkkkKKKKkkkkK.........",
    "......KkKssssssKkkK.........",
    ".....KKSsSSSSSSsSKK.........",
    ".....KSSWESSssWESSK.........",
    ".....KSSESSSppSESSK.........",
    "......KScSSSSSScSK..........",
    ".......KKppSSppKK.....K.....",
    "......KKrRRRRRRrKK...KdK....",
    ".....KrrRRRRRRRRrrK.KdK.....",
    "....KrrRrrRRRRrrRrrKdK......",
    "....KrRKrRRRRRRrKRrKdK......",
    "....KSK.KrRRRRrK.KSKdK......",
    "....KK..KddRRddK..KdK.......",
    "........KWWWWWWK..KdK.......",
    ".......KWHWWWHWWK.KdK.......",
    ".......KWWWWWWWHK.KdK.......",
    ".......KwWWwWWwwK.KdK.......",
    "........KSSKKSSK..KdK.......",
    "........KSSKKSSK..KdK.......",
    "........KppKKppK..KdK.......",
    ".......KSSpKKpSSK..K........",
    ".......KKKK..KKKK...........",
    "............................",
    "............................",
]

# =========================================================================
# STAGE 2 (중급 네크로맨서): 보라 후드 로브 + 형광 초록 눈빛 + 해골 지팡이
# 28 x 32 pixels
# =========================================================================
STAGE2_FRONT = [
    "............................",
    "............................",
    "............................",
    "...........KKKK.............",
    ".........KKvvVVKK...........",
    "........KvvVVVVuuK..........",
    ".......KvVVVVVVVuuK.........",
    "......KvVVKKKKKKVuuK........",
    ".....KvVKKUUUUUUKKuuK.......",
    ".....KVVKUUUUUUUUKVVK.......",
    ".....KVVKUUnUUnUUKVVK.......",
    ".....KVVKUUNUUNUUKVVK...KK..",
    "......KVKKUUUUUUKKVK...KbbK.",
    "......KuuKKUUUUUKuuK..KbKbK.",
    ".......KKvvKKKKvvKK...KbbbK.",
    "......KKvVVGggGVVvKK...KBBK.",
    ".....KvvVVVGggGVVVvvK..KdK..",
    "....KvvVVvVVVVVVvVVvvK.KdK..",
    "....KvVVKvVVVVVVvKVVvK.KdK..",
    "....KuuKKvVVVVVVvKKSSK.KdK..",
    ".....KK.KuuGGGGuuK.KK..KdK..",
    ".......KvvVVVVVVuuK....KdK..",
    ".......KvVVVVVVVVuuK...KdK..",
    "......KvVVvVVVVVvVuuK..KdK..",
    "......KvvVVVVVVVVVuuK..KdK..",
    "......KuuVVvVVVvVVuuK..KdK..",
    "......KKuuuuuuuuuuKK...KdK..",
    "........KddK..KddK.....KdK..",
    ".......KdddK..KdddK.....K...",
    ".......KKKK....KKKK.........",
    "............................",
    "............................",
]

# =========================================================================
# STAGE 3 (대네크로맨서): 뿔/금테 후드 + 뼈 견갑 + 영혼 불꽃 + 보석 해골 지팡이
# 28 x 32 pixels
# =========================================================================
STAGE3_FRONT = [
    "............................",
    "..........K....K............",
    ".........KgK..KgK...........",
    ".........KGGKKGGK.....KK....",
    "........KvvGGGGvvK...KnnK...",
    ".......KvvVVVVVVuuK..KnNK...",
    "......KvVVKKKKKKVuuK..KK....",
    ".....KvVKKUUUUUUKKuuK.......",
    ".....KVVKUUUUUUUUKVVK..KKK..",
    ".....KVVKUUnUUnUUKVVK.KbbbK.",
    ".....KVVKUUNUUNUUKVVK.KbNbK.",
    "......KVKKUUUUUUKKVK..KbbbK.",
    "....KKKuuKKUUUUUKuuKKK.KGGK.",
    "...KbbKKvvGGGGGGvvKKbbK.KdK.",
    "..KbbbKvvVVGnnGVVvvKbbbKKdK.",
    "..KBBKKvVVVGNNgVVVvKKBBKKdK.",
    "...KKvvVKvVVGGVVvKVvvKK.KdK.",
    "...KvvVVKvVVVVVVvKVVvvK.KdK.",
    "...KvVVK.KuuGGuuK.KVVvK.KdK.",
    "...KuuK.KvVVggVVvK.KSSK.KdK.",
    "....KK..KvvVVVVuuK..KK..KdK.",
    ".......KvVVGggGVVuuK....KdK.",
    "......KvVVVGggGVVVuuK...KdK.",
    "......KvvVVGggGVVVuuK...KdK.",
    ".....KvvVVVGggGVVVVuuK..KdK.",
    ".....KuuGGGGGGGGGGGGuK..KdK.",
    ".....KKuuuuuuuuuuuuuKK..KdK.",
    "........KuuK..KuuK......KdK.",
    ".......KuuuK..KuuuK......K..",
    ".......KKKK....KKKK.........",
    "............................",
    "............................",
]

# =========================================================================
# STAGE 4 (각성: 불멸의 사령군주 리치킹): 뿔 왕관 + 공중 부유 + 영혼 오라 + 사신의 대지팡이!
# 28 x 32 pixels
# =========================================================================
STAGE4_FRONT = [
    ".......KK........KK.........",
    "......KbbK..KK..KbbK........",
    "......KbBK.KggK.KBbK..KnK...",
    ".......KGGKGxxGKGGK..KnNNK..",
    ".......KvvGGGGGGvvK...KnmK..",
    "......KvvVVVVVVVVuuK..KKKK..",
    ".....KvVVKKKKKKKKVuuKKbNNbK.",
    "....KvVKKUUUUUUUUKKuuKbKKbK.",
    "....KVVKUUUnUUUnUUKVVKKbbK..",
    "....KVVKUUUNUUUNUUKVVKKGGK..",
    ".....KVKKUUUUUUUUKKVK..KgK..",
    "...KKKuuKKUUUUUUKuuKKK.KgK..",
    "..KbbKKvvGGGGGGGGvvKKbbKgK..",
    ".KbbbKvvVVGxNNxGVVvvKbbbKgK.",
    ".KBBKKvvVVGGnnGGVVvvKKBBKgK.",
    "..KKKvvVKvVVGGVVvKVvvKK.KgK.",
    "..KvvVVVKvVVVVVVvKVVvvK.KgK.",
    "..KvVVVK.KuuGGuuK.KVVvK.KgK.",
    "..KuuKK.KvVVggVVvK.KbbK.KgK.",
    "...KK..KvVVGxxGVVuuKKK..KgK.",
    "......KvVVVGxxGVVVuuK...KgK.",
    ".....KvvVVVGggGVVVVuuK..KgK.",
    ".....KvvVVVGggGVVVVuuK..KgK.",
    "....KuuVVVVGggGVVVVVuuK.KgK.",
    "....KuuGGGGGGGGGGGGGGuK.KgK.",
    ".....KKuuuuuuuuuuuuuKK..KgK.",
    "......KKmmNNNNNNmmKK.....K..",
    ".......KmnnNNNNnnmK.........",
    "........KKmmmmmmKK..........",
    "..........KKKKKK............",
    "............................",
    "............................",
]


def verify_and_fix(grid, name):
    assert len(grid) == 32, f"{name} height {len(grid)} != 32"
    fixed = []
    for i, row in enumerate(grid):
        assert len(row) == 28, f"{name} row {i} len {len(row)} != 28"
        fixed.append(row)
    return fixed


def build_sheet(out_path, preview_path):
    stages = [
        verify_and_fix(STAGE1_FRONT, "STAGE1"),
        verify_and_fix(STAGE2_FRONT, "STAGE2"),
        verify_and_fix(STAGE3_FRONT, "STAGE3"),
        verify_and_fix(STAGE4_FRONT, "STAGE4"),
    ]

    w, h = 28, 32
    sheet = Image.new("RGBA", (w * len(stages), h), (0, 0, 0, 0))
    px = sheet.load()
    for idx, grid in enumerate(stages):
        ox = idx * w
        for y, row in enumerate(grid):
            for x, ch in enumerate(row):
                if ch in PALETTE:
                    px[ox + x, y] = PALETTE[ch]
    sheet.save(out_path)
    print(f"Saved {out_path} ({sheet.size})")

    # 시각적 검수용 8배 확대 프리뷰 PNG 생성
    scale = 8
    prev = Image.new("RGBA", (w * len(stages) * scale + 50, h * scale + 40), (24, 20, 36, 255))
    p_px = prev.load()
    for idx, grid in enumerate(stages):
        ox = 10 + idx * (w * scale + 10)
        oy = 20
        for y, row in enumerate(grid):
            for x, ch in enumerate(row):
                if ch in PALETTE and PALETTE[ch][3] > 0:
                    col = PALETTE[ch]
                    for dy in range(scale):
                        for dx in range(scale):
                            p_px[ox + x * scale + dx, oy + y * scale + dy] = col
    prev.save(preview_path)
    print(f"Saved preview {preview_path}")


if __name__ == "__main__":
    build_sheet("game/assets/necromancer_stages.png", "/tmp/necromancer_preview.png")
