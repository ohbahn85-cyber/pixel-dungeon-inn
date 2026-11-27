from PIL import Image

PAL = {
    ".": (0, 0, 0, 0),
    "K": (20, 14, 24, 255),      # 짙은 다크 아웃라인
    # 피부 (3톤)
    "s": (255, 228, 206, 255),
    "S": (232, 192, 164, 255),
    "p": (184, 138, 112, 255),
    # 하트 팬티 & 거적대기 (Stage 1)
    "W": (248, 250, 252, 255),
    "w": (203, 213, 225, 255),
    "H": (244, 63, 94, 255),     # 빨간 하트 / 루비
    "R": (159, 18, 57, 255),     # 짙은 붉은색
    "r": (168, 120, 78, 255),    # 거적대기 밝음
    "d": (120, 80, 48, 255),     # 거적대기/나무 기본
    "D": (78, 48, 28, 255),      # 거적대기/나무 어두움
    # 다크 아머 & 망토 (Stage 2~4)
    "v": (147, 94, 224, 255),    # 보라 하이라이트
    "V": (98, 52, 168, 255),     # 보라 기본
    "u": (56, 28, 102, 255),     # 보라 어두움
    "U": (28, 14, 54, 255),      # 후드 심연
    # 네크로 형광 에메랄드 (눈빛 / 마력 / 독)
    "n": (167, 243, 208, 255),   # 밝은 네크로 민트
    "N": (16, 185, 129, 255),    # 네크로 에메랄드
    "m": (6, 95, 70, 255),       # 깊은 에메랄드
    # 뼈 & 해골 (3톤)
    "b": (248, 245, 236, 255),
    "B": (206, 198, 182, 255),
    "x": (138, 130, 118, 255),
    # 강철 & 무기 칼날 (3톤)
    "i": (241, 245, 249, 255),
    "I": (148, 163, 184, 255),
    "j": (71, 85, 105, 255),
    # 황금 장식
    "g": (254, 240, 138, 255),
    "G": (234, 179, 8, 255),
    "o": (161, 98, 7, 255),
    # 성기사 블루 / 화염 오렌지
    "c": (96, 165, 250, 255),
    "C": (37, 99, 235, 255),
    "f": (251, 146, 60, 255),
}


def fix_grid(grid, w, h):
    out = []
    for y in range(h):
        row = grid[y] if y < len(grid) else ""
        row = (row + "." * w)[:w]
        out.append(row)
    return out


# ==============================================================================
# 1. 주인공 네크로맨서 (늘씬하고 카리스마 있는 3.5~4등신 다크 판타지 도트, 24x32)
#    근접 무기(뼈 몽둥이 -> 해골 소드 -> 저주 할버드 -> 사신의 대낫)는 Lua에서 실시간 스윙!
# ==============================================================================

# Stage 1: 거적대기 조끼 + 하트 팬티 + 붕대 감은 손발 (날렵한 모험가 체형)
NECRO_S1 = [
    "........................",
    ".........KKKKKK.........",
    "........KUUUUUUK........",
    ".......KUUUUUUUU........",
    ".......KUUssssUUK.......",
    ".......KUsWssWsUK.......",
    ".......KUsEssEsUK.......",
    "........KSssssSK........",
    ".........KKSSKK.........",
    ".......KKrrSSrrKK.......",
    "......KrrddSSddrrK......",
    ".....KrrdDDDDDDdrrK.....",
    ".....KSKdDDDDDDdKSK.....",
    ".....KSKddDDDDddKSK.....",
    ".....KpKddddddddKpK.....",
    "......KKdDDDDDDdKK......",
    ".......KWWWWWWWWK.......",
    ".......KWHWWWHWWK.......",
    ".......KWWWWWWWHK.......",
    ".......KwwKKKKwwK.......",
    ".......KWWK..KWWK.......",
    "........KSK..KSK........",
    "........KSK..KSK........",
    "........KpK..KpK........",
    "........KSK..KSK........",
    "........KbK..KbK........",
    ".......KbbK..KbbK.......",
    ".......KKKK..KKKK.......",
    "........................",
    "........................",
    "........................",
    "........................",
]

# Stage 2: 다크 네크로 후드 & 전투 코트 + 형광 초록 안광 + 강철 부츠
NECRO_S2 = [
    "........................",
    ".........KKKKKK.........",
    "........KvvVVvvK........",
    ".......KvVVVVVVvK.......",
    "......KvVKKKKKKVvK......",
    "......KVKUUUUUUKVK......",
    "......KVKUnUUnUKVK......",
    ".......KKUUUUUUKK.......",
    "........KKGGGGKK........",
    "......KKvvVGGGGvvKK.....",
    ".....KvvVVVGGVVVvvK.....",
    "....KvvVVuVVVVuVVvvK....",
    "....KvVVKuVVVVuKVVvK....",
    "....KuuK.KuuuuK.KuuK....",
    "....KSK..KGGGGK..KSK....",
    ".....K..KvVVVVvK..K.....",
    "........KvVVVVvK........",
    ".......KvVVuuvVVvK......",
    ".......KvVuKKuVVvK......",
    "......KvVuK..KuVVvK.....",
    "......KuuK....KuuuK.....",
    "......KKKK....KKKKK.....",
    ".......KjjK..KjjK.......",
    ".......KjjK..KjjK.......",
    ".......KIIK..KIIK.......",
    ".......KjjK..KjjK.......",
    "......KjjjK..KjjjK......",
    "......KKKK....KKKK......",
    "........................",
    "........................",
    "........................",
    "........................",
]

# Stage 3: 데스나이트 사령관 (해골 어깨 갑옷 + 뿔 후드 + 흉갑 + 롱코트)
NECRO_S3 = [
    ".......K........K.......",
    "......KbK.KKKK.KbK......",
    "......KBBKvvVVKBBK......",
    ".......KKvVVVVvKK.......",
    "......KvVKKKKKKVvK......",
    "......KVKUUUUUUKVK......",
    "......KVKUnUUnUKVK......",
    ".......KKUUUUUUKK.......",
    "....KKKKKGGGGGGKKKKK....",
    "...KbbbKvvGnnGvvKbbbK...",
    "..KbbBBKvVGNNgVvKBBbbK..",
    "..KxxKKvVVuGGuVVvKKxxK..",
    "...KK.KvVKuVVuKVvK.KK...",
    "......KuuKIIIIKuuK......",
    "......KbbKGGGGKbbK......",
    ".......KKvVggVVvKK......",
    ".......KvVVggVVVvK......",
    "......KvVVVggVVVVvK.....",
    "......KvVuKKKKuVVvK.....",
    ".....KvVuK....KuVVvK....",
    ".....KGGK......KGGGK....",
    ".....KKKK......KKKKK....",
    ".......KIIK..KIIK.......",
    ".......KjjK..KjjK.......",
    ".......KibK..KbiK.......",
    ".......KjjK..KjjK.......",
    "......KIIIK..KIIIK......",
    "......KKKK....KKKK......",
    "........................",
    "........................",
    "........................",
    "........................",
]

# Stage 4: 각성 사령군주 (황금 뿔 왕관 + 루비 코어 갑주 + 망령 날개 코트 + 네크로 오라)
NECRO_S4 = [
    ".....KK..........KK.....",
    "....KbbK.K....K.KbbK....",
    "....KBBKgK.KK.KgKBBK....",
    ".....KGGGGKHHKGGGGK.....",
    "......KvVVGGGGVVvK......",
    ".....KvVKKKKKKKKVvK.....",
    ".....KVKUUnUUnUUKVK.....",
    "......KKUUNUUNUUKK......",
    "..KKKKKKGGGGGGGGKKKKKK..",
    ".KbbbbKvvGGHHGGvvKbbbbK.",
    ".KbbBBKvVGGnnGGVvKBBbbK.",
    ".KxxKKvVVVuGGuVVVvKKxxK.",
    "..KK.KvVVKuVVuKVVvK.KK..",
    ".....KuuKGGGGGGKuuK.....",
    ".....KbbKvvHHvvKbbK.....",
    "......KKvvVggVVvvKK.....",
    ".....KvvVVVggVVVVvvK....",
    "....KvvVVuKggKuVVVvvK...",
    "....KvVVuK.KK.KuVVvvK...",
    "...KvVVuK......KuVVvvK..",
    "...KGGGGK......KGGGGGK..",
    "...KKKKK........KKKKKK..",
    "......KGGGG..GGGGK......",
    "......KjjjK..KjjjK......",
    ".....KmnnnmKKmnnnmK.....",
    "....KmNNNNNNNNNNNNmK....",
    ".....KmmNNNNNNNNmmK.....",
    ".......KKKKKKKKKK.......",
    "........................",
    "........................",
    "........................",
    "........................",
]


# ==============================================================================
# 2. 소환수 12종 상향 트리 (4대 계보 x 3단계 진화 = 12종, 각 20x24)
#    계보 1 (전사계): [1] 해골 졸병(C) -> [2] 해골 검투사(B) -> [3] 칠흑의 사령기사(A)
#    계보 2 (궁수계): [4] 해골 투석병(C) -> [5] 뼈 석궁병(B) -> [6] 망령 저격수(A)
#    계보 3 (마법계): [7] 영혼 불씨(C) -> [8] 해골 주술사(B) -> [9] 대리치 사제(A)
#    계보 4 (초월 변이 S급): [10] 사신의 처형자(S) / [11] 아크리치 군주(S) / [12] 심연의 본드래곤(S)
# ==============================================================================

# [1] 해골 졸병 (C)
U1_PAWN = [
    "....................",
    ".......KKKKKK.......",
    "......KbbbbbbK......",
    ".....KbbbbbbbBK.....",
    ".....KbEEbbEEBK.....",
    "......KbbbbbbK......",
    ".......KKbbKK.......",
    "......KBBbbBBK..K...",
    ".....KbKKbbKKbKKiK..",
    ".....Kb.KbbK.bKiIK..",
    "......K.KBBK.KKiK...",
    "........KbbK..KdK...",
    ".......KBBBBK..K....",
    ".......KbKKbK.......",
    ".......KbK.KbK......",
    ".......KBK.KBK......",
    ".......KbK.KbK......",
    "......KBBK.KBBK.....",
    "......KKK...KKK.....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [2] 해골 검투사 (B) - 철제 투구 & 방패 & 장검
U2_WARRIOR = [
    "....................",
    ".......KKKKKK.......",
    "......KiiiiiiK......",
    ".....KiiIIIIjjK.....",
    ".....KiEEbbEEjK.....",
    "......KbbbbbbK...K..",
    ".......KKbbKK...KiK.",
    "....KKKiiiiiiKKKiIK.",
    "...KccKiiGGiiKbiIK..",
    "...KcCKiiiiiiKbiK...",
    "...KccK.KjjK..KdK...",
    "....KK..KbbK..KK....",
    ".......KjjjjK.......",
    ".......KjKKjK.......",
    ".......KbK.KbK......",
    ".......KIK.KIK......",
    ".......KjK.KjK......",
    "......KIIK.KIIK.....",
    "......KKK...KKK.....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [3] 칠흑의 사령기사 (A) - 뿔 투구 & 보라 망토 & 대검
U3_DEATHKNIGHT = [
    "....K..........K....",
    "...KbK.KKKKKK.KbK...",
    "...KBBKiiiiiiKBBK...",
    "....KKiiIIIIjjKK.K..",
    ".....KiEnbbEnjK.KiK.",
    "......KbbbbbbK..KiIK",
    "....KKKGGGGGGKKKiIK.",
    "...KvvKiiGGiiKvvKiK.",
    "..KvVVKiiiiiiKVvKdK.",
    "..KvVVK.KGGK.KVVKK..",
    "..KuuK.KiiiiK.KuuK..",
    "...KK..KvvvvK..KK...",
    ".......KjjjjK.......",
    "......KjjKKjjK......",
    "......KIK..KIK......",
    "......KjK..KjK......",
    "......KIK..KIK......",
    ".....KGGK..KGGK.....",
    ".....KKK....KKK.....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [4] 해골 궁수 (C)
U4_ARCHER = [
    "....................",
    ".......KKKKKK.......",
    "......KddddddK......",
    ".....KbbbbbbbBK.....",
    ".....KbEEbbEEBK.....",
    "......KbbbbbbK..KK..",
    ".......KKbbKK..KdWK.",
    "......KddbbddK.Kw.WK",
    ".....KdKKbbKKbKw..WK",
    ".....Kd.KbbK.bKw..WK",
    "......K.KBBK..Kw.WK.",
    "........KddK...KdK..",
    ".......KddddK...K...",
    ".......KbKKbK.......",
    ".......KbK.KbK......",
    ".......KBK.KBK......",
    ".......KbK.KbK......",
    "......KddK.KddK.....",
    "......KKK...KKK.....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [5] 뼈 석궁병 (B) - 후드 & 대형 석궁
U5_CROSSBOW = [
    "....................",
    ".......KKKKKK.......",
    "......KvvVVvvK......",
    ".....KvVbbbbVvK.....",
    ".....KvEEbbEEvK.....",
    "......KbbbbbbK..KK..",
    ".......KKbbKK..KiiK.",
    ".....KKvvGGvvKKddddK",
    "....KvvKvvvvKvvKiiK.",
    "....KuuKvvvvKuuKKK..",
    ".....KK.KuuK.KK.....",
    "........KvvK........",
    ".......KuuuuK.......",
    ".......KbKKbK.......",
    ".......KbK.KbK......",
    ".......KIK.KIK......",
    ".......KjK.KjK......",
    "......KjjK.KjjK.....",
    "......KKK...KKK.....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [6] 망령 저격수 (A) - 형광 안광 & 영혼 장궁
U6_SNIPER = [
    ".......KKKKKK.......",
    "......KmmNNmmK......",
    ".....KmNUUUUUmK.....",
    ".....KmUnUUnUmK.KK..",
    "......KUUUUUUK.KnnK.",
    ".......KKGGKK.Kn..nK",
    ".....KKmmGGmmKn...nK",
    "....KmmKmmmmKmKn..nK",
    "....KmmKmmmmKmmKnnK.",
    ".....KK.KmmK.KK.KK..",
    ".......KmmmmK.......",
    "......KmmNNmmK......",
    "......KmNNNNmK......",
    ".......KnnnnK.......",
    "........KnnK........",
    "........KmmK........",
    ".........KK.........",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [7] 영혼 불씨 위습 (C)
U7_WISP = [
    "....................",
    ".........KK.........",
    "........KnnK........",
    ".......KnnnnK.......",
    "......KnnNNnnK......",
    ".....KnnNNNNnnK.....",
    ".....KnNEooENnK.....",
    "....KnNEEooEENnK....",
    "....KnNNNNNNNNnK....",
    ".....KnNNNNNNnK.....",
    ".....KmmNNNNmmK.....",
    "......KmmmmmmK......",
    ".......Km..mK.......",
    ".......K....K.......",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [8] 해골 주술사 (B)
U8_MAGE = [
    "........KKKK........",
    ".......KvvvvK.......",
    "......KvvVVvvK......",
    ".....KbbbbbbbBK..K..",
    ".....KbEnbbEnBK.KnK.",
    "......KbbbbbbK..KnK.",
    ".......KKGGKK...KdK.",
    ".....KKvvGGvvKK.KdK.",
    "....KvvKvvvvKvvKKdK.",
    "....KuuKvvvvKuuK.dK.",
    ".....KKKvVVvKKK..dK.",
    "......KvVVVVvK...dK.",
    "......KvvvvvvK...dK.",
    ".....KuuuuuuuuK..KK.",
    "......KKbKKbKK......",
    ".......KbK.KbK......",
    "......KuuK.KuuK.....",
    "......KKK...KKK.....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [9] 대리치 사제 (A)
U9_LICH = [
    ".....K...KK...K.....",
    "....KgK.KggK.KgK....",
    "....KGGKGGGGKGGK.KK.",
    ".....KvvGGGGvvK.KnnK",
    "....KvVKKKKKKVvKKnnK",
    "....KVKUnUUnUKVK.KdK",
    ".....KKUUUUUUKK..KdK",
    "...KKvvGGGGGGvvKKKdK",
    "..KvvVVVGnnGVVVvvKdK",
    "..KuuKvvGGGGvvKuuKdK",
    "...KK.KvVVVVvK.KKKdK",
    ".....KvvVGGVVvvK.KdK",
    ".....KvVVGGVVVvK.KdK",
    "....KuuGGGGGGGGuK.K.",
    ".....KKuuuuuuuuKK...",
    ".......KnnnnnnK.....",
    "........KmmmmK......",
    ".........KKKK.......",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [10] S급 변이 1: 사신의 처형자 (Reaper Executioner) - 붉은 안광 + 거대 처형 낫 + 칠흑 날개
U10_REAPER = [
    ".............KKKKKK.",
    ".....KKKK...KiiiiiiK",
    "....KUUUUUKKiiIIIIKK",
    "...KUUUUUUUKiIKKK...",
    "...KUUHUUHUKKKgK....",
    "...KUUUUUUUK.KgK....",
    ".KKKGGGGGGGGKKgK....",
    "KbbKUUUUUUUUUKgK....",
    "KBBKUUHggggHUUKgK...",
    ".KK.KUUUUUUUUKgK....",
    "....KUUUUUUUUUKgK...",
    "...KUUUUUUUUUUKgK...",
    "...KUUHUUUUHUUKgK...",
    "..KUUHUUUUUUHUUKgK..",
    "..KUUUUUUUUUUUUKgK..",
    "..KRRRRRRRRRRRRKgK..",
    "...KKUUUUUUUUUK.KK..",
    ".....KnnNNNNnnK.....",
    "......KmmmmmmK......",
    "........KKKK........",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [11] S급 변이 2: 아크리치 군주 (Arch-Lich Overlord) - 황금 후광 + 쌍둥이 영혼 보주
U11_ARCHLICH = [
    "......KKKKKKKK......",
    "....KKggGGGGggKK....",
    "...KggKKKKKKKKggK...",
    "...KgK..KKKK..KgK...",
    "...KK..KggggK..KK...",
    "..KK..KvvGGvvK..KK..",
    ".KnnK.KVKUUKVK.KnnK.",
    ".KnnK.KVKnnKVK.KnnK.",
    "..KK.KKvvGGvvKK.KK..",
    "....KvvGGGGGGvvK....",
    "...KvvVVGHHGVVvvK...",
    "...KuuKvvGGvvKuuK...",
    "......KvVGGVVvK.....",
    ".....KvvVGGVVvvK....",
    "....KvvVVGGVVVvvK...",
    "....KGGGGGGGGGGGK...",
    ".....KKnnnnnnnnKK...",
    ".......KmmmmmmK.....",
    "........KKKKKK......",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

# [12] S급 변이 3: 심연의 본드래곤 (Bone Dragon) - 해골 용 머리 + 뼈 날개 + 브레스 코어
U12_BONEDRAGON = [
    ".KK..............KK.",
    "KbbK...KKKKKK...KbbK",
    "KbBKK.KbbbbbbK.KKBbK",
    "KbxxKKbbnnnnbbKKxxbK",
    "KbxxxKbbnEENbbKxxxbK",
    "KbxxKbbbbbbbbbbKxxbK",
    ".KKK.KKbKKKKbKK.KKK.",
    ".....KbbGGGGbbK.....",
    "...KKbbGGnnGGbbKK...",
    "..KbbbbGGNNggbbbbK..",
    "..KBBKKbbGGbbKKBBK..",
    "...KK..KbbbbK..KK...",
    "......KbbKKbbK......",
    ".....KbbK..KbbK.....",
    ".....KBBK..KBBK.....",
    "....KbbbK..KbbbK....",
    "....KKKK....KKKK....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]


# ==============================================================================
# 3. 적군 3종 (20x24): [1] 성전사 보병 / [2] 이단심문 화염사제 / [3] 대성당 심판관 보스
# ==============================================================================
E1_TEMPLAR = [
    "....................",
    ".......KKKKKK.......",
    "......KiiiiiiK......",
    ".....KiiIIIIjjK.....",
    ".....KiEEppEEjK.....",
    "......KppppppK......",
    ".......KKjjKK.......",
    "....KKKccGGccKKK....",
    "...KccKccGGccKccK...",
    "...KCCKccGGccKCCK...",
    "...KssK.KCCK.KssK...",
    "....KK..KjjK..KK....",
    ".......KCCCCK.......",
    ".......KjKKjK.......",
    ".......KIK.KIK......",
    ".......KjK.KjK......",
    "......KddK.KddK.....",
    "......KKK...KKK.....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

E2_INQUISITOR = [
    "........KKKK........",
    ".......KHHHHK.......",
    "......KHHHRRHK......",
    ".....KHpEEppEEHK....",
    "......KppppppK..KK..",
    ".......KKGGKK..KffK.",
    ".....KKHHGGHHKKKffK.",
    "....KHHKHHHHKHHKKdK.",
    "....KRRKHHHHKRRK.dK.",
    ".....KKKHHHHKKK..dK.",
    "......KHHHHHHK...dK.",
    "......KHHGGHHK...dK.",
    ".....KRRRRRRRRK..KK.",
    "......KKdKKdKK......",
    ".......KdK.KdK......",
    "......KDDK.KDDK.....",
    "......KKK...KKK.....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]

E3_BOSS = [
    "...K....KKKK....K...",
    "..KgK..KggggK..KgK..",
    "..KGGKKggGGggKKGGK..",
    "...KGGGgEEEEgGGGK...",
    "....KGGppppppGGK....",
    "..KKKKGGGGGGGGKKKK..",
    ".KgggKGGgHHgGGKgggK.",
    "KggGGKGGHHHHGGKGGggK",
    "KGGGGKGGGHHGGGKGGGGK",
    ".KKooKGGGGGGGGKooKK.",
    "...KK.KGGGGGGK.KK...",
    ".....KggGGGGggK.....",
    ".....KGGKKKKGGK.....",
    ".....KgK....KgK.....",
    ".....KGK....KGK.....",
    "....KGGK....KGGK....",
    "....KKKK....KKKK....",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
    "....................",
]


def save_sheet(grids, w, h, out_path):
    img = Image.new("RGBA", (w * len(grids), h), (0, 0, 0, 0))
    px = img.load()
    for idx, g in enumerate(grids):
        fg = fix_grid(g, w, h)
        for y, row in enumerate(fg):
            for x, ch in enumerate(row):
                if ch in PAL:
                    px[idx * w + x, y] = PAL[ch]
    img.save(out_path)
    print(f"Saved {out_path} ({img.size})")


if __name__ == "__main__":
    save_sheet(
        [NECRO_S1, NECRO_S2, NECRO_S3, NECRO_S4],
        24,
        32,
        "game/assets/necromancer_stages.png",
    )
    save_sheet(
        [
            U1_PAWN, U2_WARRIOR, U3_DEATHKNIGHT,
            U4_ARCHER, U5_CROSSBOW, U6_SNIPER,
            U7_WISP, U8_MAGE, U9_LICH,
            U10_REAPER, U11_ARCHLICH, U12_BONEDRAGON,
        ],
        20,
        24,
        "game/assets/summons.png",
    )
    save_sheet(
        [E1_TEMPLAR, E2_INQUISITOR, E3_BOSS],
        20,
        24,
        "game/assets/enemies.png",
    )
