from PIL import Image

PALETTE = {
    ".": (0, 0, 0, 0),
    "K": (36, 23, 21, 255),
    "s": (255, 227, 198, 255),
    "S": (243, 190, 144, 255),
    "p": (206, 140, 94, 255),
    "c": (236, 116, 116, 255),
    "E": (26, 17, 14, 255),
    "W": (255, 255, 255, 255),
    "h": (251, 161, 77, 255),
    "H": (229, 101, 26, 255),
    "r": (180, 62, 15, 255),
    "R": (124, 40, 10, 255),
    "b": (107, 101, 96, 255),
    "B": (68, 62, 58, 255),
    "g": (254, 240, 138, 255),
    "G": (245, 158, 11, 255),
    "d": (180, 83, 9, 255),
    "t": (168, 85, 42, 255),
    "T": (124, 57, 25, 255),
    "u": (82, 35, 14, 255),
    "a": (217, 123, 41, 255),
    "A": (180, 90, 20, 255),
    "q": (125, 58, 10, 255),
    "L": (54, 32, 22, 255),
    "n": (75, 90, 110, 255),
    "N": (47, 58, 74, 255),
    "f": (99, 55, 27, 255),
    "F": (61, 31, 14, 255),
    "m": (156, 90, 39, 255),
    "i": (238, 244, 250, 255),
    "I": (159, 176, 196, 255),
    "j": (90, 107, 128, 255),
}

FRONT = [
    "........................",
    "........................",
    "........KKKKKKKK........",
    "......KKhhHHHHrrKK......",
    ".....KhhHHHHHHHHrrK.....",
    "....KKbbbbGggGbbbbKK....",
    "....KBBBBBGggGBBBBBK....",
    "....KrrHHHHHHHHHHrrK....",
    "...KKSssssssssssssSKK...",
    "...KSssrrrrssrrrrssSK...",
    "...KKSsWESSssSSWESSKK...",
    "....KSSESSppppSSESSK....",
    "....KScSSSpSSpSSScSK....",
    "....KKhhHhhhhhhHhhKK....",
    "....KhHHhHHHHHHhHHhK....",
    "....KrrHHHHHHHHHHrrK....",
    "...KKtKrrHHHHHHrrKtKK...",
    "..KttTKRRrrHHrrRRKTttK..",
    "..KtTTKaaaRRRRaaaKTTtK..",
    "..KTTuKAaaAAAAaaAKuTTK..",
    "..KSSKLLLLGggGLLLLKSSK..",
    "..KppKAAaaAAAAaaAAKppK..",
    "...KK.KqqAAAAAAqqK.KK...",
    "......KKnnnnnnnnKK......",
    "......KnnKK..KKnnK......",
    "......KffK....KffK......",
    ".....KFFfK....KfFFK.....",
    ".....KKKK......KKKK.....",
]

BACK = [
    "........................",
    "........................",
    "........KKKKKKKK........",
    "......KKhhHHHHrrKK......",
    ".....KhhHHHHHHHHrrK.....",
    "....KKbbbbbbbbbbbbKK....",
    "....KBBBBBGGGGbbBBBK....",
    "....KrrHHHGGGGHHHrrK....",
    "...KKrHHHHHHHHHHHHrKK...",
    "...KrrHHHHHHHHHHHHrrK...",
    "...KKrHHHHHHHHHHHHrKK...",
    "....KrHHHHHrrHHHHHrK....",
    "....KrrHHHrrrrHHHrrK....",
    "....KKrrHHHHHHHHrrKK....",
    ".....KKrrHHHHHHrrKK.....",
    "......KKrrrrrrrrKK......",
    "...KKtTTtKKKKKKtTTtKK...",
    "..KttTAAtTTTTTTtAAttTK..",
    "..KtTTtAAtTTTTtAAtTTtK..",
    "..KTTuTTAAtTTtAATTuTTK..",
    "..KSSKLLLLLLLLLLLLKSSK..",
    "..KppKuuTTTTTTTTuuKppK..",
    "...KK.KuuTTTTTTuuK.KK...",
    "......KKnnnnnnnnKK......",
    "......KnnKK..KKnnK......",
    "......KffK....KffK......",
    ".....KFFfK....KfFFK.....",
    ".....KKKK......KKKK.....",
]

LEFT = [
    "........................",
    "........................",
    "........KKKKKKKK........",
    "......KKhhHHHHrrKK......",
    ".....KhhHHHHHHHHrrK.....",
    "....KKGggbbbbbbbbbKK....",
    "....KGGggBBBBBBBBBBK....",
    "....KHHrrHHHHHHHHrrK....",
    "....KSssssHHrrrrHHrK....",
    "....KssrrrHHHHrrHHrK....",
    "....KSWESSSHHHrrHHrK....",
    "...KSSESSSSHHHpSrrKK....",
    "..KSScSSSSSSHHpSKrK.....",
    "...KhhHhhHHHHHHrrK......",
    "..KhhHHHHhHHHHHrrK......",
    "..KrrHHHHHHHHHrrK.......",
    "...KrrHHHHHHHrrKK.......",
    "....KRRrrHHHrtTTtK......",
    "....KaaRRRRtTTttTK......",
    "....KAAaaaaTttTTuK......",
    "....KLLLLLLtSSSuLK......",
    "....KAAaaAAKppKuAK......",
    ".....KqqAAqKKKKqqK......",
    "......KKnnnnnnnKK.......",
    ".......KnnKKnnK.........",
    "......KffK..KffK........",
    ".....KFFfK..KFFfK.......",
    ".....KKKK...KKKK........",
]

FRONT_HAMMER = [
    ".KKKKK.",
    "KiiiiIK",
    "KIIIjjK",
    ".KKmKK.",
    "...mK..",
    "..KmK..",
    "..KmK..",
    "..KmK..",
    "..KmK..",
    "..KK...",
]

LEFT_HAMMER = [
    "KKKKK..",
    "KiiiiK.",
    "KIIIjK.",
    ".KKmKK.",
    "..KmK..",
    "..KmK..",
    "..KmK..",
    "..KmK..",
    "..KmK..",
    "..KK...",
]


def overlay(base, ov, dx, dy):
    g = [list(r) for r in base]
    for r, row in enumerate(ov):
        for c, ch in enumerate(row):
            if ch != "." and 0 <= dy + r < len(g) and 0 <= dx + c < len(g[0]):
                g[dy + r][dx + c] = ch
    return g


def save_4way_sheet(path):
    f = overlay(FRONT, FRONT_HAMMER, 17, 12)
    b = overlay(BACK, FRONT_HAMMER, 0, 12)
    l = overlay(LEFT, LEFT_HAMMER, 2, 12)
    r = [row[::-1] for row in l]

    img = Image.new("RGBA", (24 * 4, 28), (0, 0, 0, 0))
    px = img.load()
    for idx, grid in enumerate([f, b, l, r]):
        ox = idx * 24
        for y, row in enumerate(grid):
            for x, ch in enumerate(row):
                if ch in PALETTE:
                    px[ox + x, y] = PALETTE[ch]
    img.save(path)
    print(f"Generated {path} ({img.size})")


def save_anvil_sprite_stack(path):
    """
    12-slice 16x16 horizontal Sprite-Stacking PNG strip (192x16)
    Z=0..5: 둥근 나무 그루터기 받침대 (Wooden Stump)
    Z=6..11: 대장간 강철 모루 (Steel Anvil)
    """
    slices = 12
    w, h = 16, 16
    img = Image.new("RGBA", (w * slices, h), (0, 0, 0, 0))
    px = img.load()

    for z in range(slices):
        ox = z * w
        for y in range(h):
            for x in range(w):
                dx = x - 7.5
                dy = y - 7.5
                dist = (dx * dx + dy * dy) ** 0.5
                col = None

                if z <= 5:
                    # 둥근 원목 그루터기 (Z=0..5)
                    r_outer = 6.2 - (0.2 if z > 0 else 0.0)
                    if dist <= r_outer:
                        if dist >= r_outer - 1.1:
                            col = PALETTE["K"]
                        elif dist >= r_outer - 2.2:
                            col = PALETTE["f"]
                        elif z == 5:
                            col = PALETTE["a"] if int(dist) % 2 == 0 else PALETTE["A"]
                        else:
                            col = PALETTE["T"]
                elif z <= 7:
                    # 모루 하단 받침
                    if abs(dx) <= 4.5 and abs(dy) <= 3.0:
                        is_edge = abs(dx) >= 3.5 or abs(dy) >= 2.0
                        col = PALETTE["K"] if is_edge else PALETTE["j"]
                elif z == 8:
                    # 모루 허리 기둥
                    if abs(dx) <= 3.2 and abs(dy) <= 2.2:
                        is_edge = abs(dx) >= 2.2 or abs(dy) >= 1.2
                        col = PALETTE["K"] if is_edge else PALETTE["j"]
                else:
                    # 모루 상단 넓은 타격면 + 왼쪽 뿔(Horn) (Z=9..11)
                    in_body = -3.0 <= dx <= 5.5 and abs(dy) <= 3.0
                    in_horn = -6.8 <= dx < -3.0 and abs(dy) <= max(0.8, 3.0 * (1 - (-3.0 - dx) / 4.2))
                    if in_body or in_horn:
                        is_edge = (
                            abs(dy) >= 2.1
                            or dx >= 4.5
                            or dx <= -5.8
                        )
                        if is_edge and z < 11:
                            col = PALETTE["K"]
                        elif z == 11:
                            col = PALETTE["i"] if not is_edge else PALETTE["I"]
                        else:
                            col = PALETTE["I"]

                if col:
                    px[ox + x, y] = col

    img.save(path)
    print(f"Generated {path} ({img.size})")


if __name__ == "__main__":
    save_4way_sheet("game/assets/blacksmith_4way.png")
    save_anvil_sprite_stack("game/assets/anvil_stack.png")
