"""Draw the starter necromancer, including an eight-frame walk for each direction."""

from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw


WIDTH, HEIGHT = 56, 64
ORIGIN_X, ORIGIN_Y = 28, 56
DIRECTIONS = ("down", "left", "right", "up")
WALK_FRAMES = 8

INK = "#1c1d22"
SEAM = "#393c43"
GRAY_DARK = "#51545c"
GRAY = "#6a6e75"
GRAY_LIGHT = "#858a90"
GRAY_HIGH = "#9b9fa1"
THREAD = "#b2adaa"
SKIN_DARK = "#8e685e"
SKIN_SHADE = "#af8475"
SKIN = "#cfa48e"
SKIN_LIGHT = "#e2b9a1"
CIRCLE = "#93747a"
LID = "#503b3a"
PUPIL = "#302e32"
HAIR = "#453c3b"
SHORTS = "#b1a6a4"
SHORTS_DARK = "#807b83"
HEART = "#a95160"


def polygon(draw, color, points, outline=None):
    draw.polygon(points, fill=color, outline=outline)


def line(draw, color, points, width=1):
    draw.line(points, fill=color, width=width)


def stitches(draw, points):
    for x, y in points:
        line(draw, THREAD, [(x - 1, y), (x + 1, y + 2)])
        line(draw, GRAY_HIGH, [(x + 1, y), (x - 1, y + 2)])


def heart(draw, x, y):
    for dx, dy in ((0, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, 2)):
        draw.point((x + dx, y + dy), fill=HEART)


def front_face(draw, top):
    offset = 6 if top else 0

    def shape(color, points, outline=None):
        polygon(draw, color, [(x, y + offset) for x, y in points], outline)

    shape(INK, [(15, 25), (17, 19), (22, 13), (27, 11), (34, 14), (39, 20),
                (41, 27), (39, 32), (34, 36), (27, 38), (21, 36), (17, 32)])
    shape(SKIN_DARK, [(18, 25), (20, 18), (28, 14), (35, 17), (38, 24),
                      (37, 31), (34, 34), (31, 35), (25, 35), (21, 32)])
    shape(SKIN, [(20, 24), (22, 18), (28, 15), (35, 18), (37, 26), (35, 29),
                 (32, 33), (30, 35), (26, 35), (23, 32), (21, 29)])
    shape(SKIN_LIGHT, [(24, 20), (33, 19), (34, 23), (30, 24), (29, 28),
                       (28, 30), (26, 29), (27, 25), (24, 24)])
    shape(CIRCLE, [(20, 24), (26, 24), (26, 27), (24, 29), (21, 27)])
    shape(CIRCLE, [(30, 24), (35, 24), (36, 26), (34, 28), (31, 27)])
    shape(SKIN_LIGHT, [(21, 28), (23, 29), (25, 29), (23, 31)])
    shape(SKIN_LIGHT, [(32, 29), (35, 27), (34, 30)])
    shape(HAIR, [(19, 21), (20, 17), (24, 15), (28, 14), (33, 15), (36, 19),
                 (31, 18), (26, 20), (27, 17), (22, 21)])
    for a, b in ((21, 25), (31, 35)):
        line(draw, LID, [(a, 22 + offset), (a + 2, 22 + offset), (b, 23 + offset)])
        line(draw, LID, [(a, 25 + offset), (b, 25 + offset)])
        draw.point((a + 1, 26 + offset), fill=SHORTS)
        draw.point((a + 2, 26 + offset), fill=PUPIL)
    line(draw, SKIN_SHADE, [(29, 27 + offset), (30, 29 + offset), (28, 30 + offset)])
    line(draw, LID, [(26, 32 + offset), (29, 32 + offset), (30, 33 + offset)])


def head(direction, top):
    image = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)

    if direction in ("down", "up"):
        polygon(draw, GRAY_DARK, [(8, 28), (9, 22), (12, 15), (16, 11), (21, 8),
                (27, 6), (33, 7), (39, 10), (44, 15), (47, 22), (48, 29),
                (46, 34), (40, 37), (33, 39), (28, 41), (23, 39),
                (16, 37), (10, 33)], INK)
        polygon(draw, GRAY, [(10, 27), (12, 19), (17, 13), (24, 9), (29, 8),
                (35, 10), (41, 15), (45, 21), (45, 27), (39, 30), (17, 30)])
        polygon(draw, GRAY_LIGHT, [(12, 22), (17, 14), (25, 10), (29, 9),
                (34, 11), (39, 15), (34, 14), (25, 13), (19, 16)])
        line(draw, GRAY_HIGH, [(17, 14), (23, 11), (28, 10), (31, 11)])
        polygon(draw, SEAM, [(10, 28), (14, 30), (17, 34), (27, 39), (35, 37),
                (44, 32), (46, 29), (45, 34), (34, 39), (28, 40), (19, 37), (11, 33)])
        if direction == "down":
            front_face(draw, top)
            if top:
                polygon(draw, GRAY, [(11, 27), (15, 21), (21, 18), (28, 16),
                        (34, 17), (40, 21), (45, 27), (41, 31), (37, 29),
                        (33, 26), (28, 24), (23, 26), (18, 30), (14, 31)])
                line(draw, GRAY_LIGHT, [(14, 27), (22, 22), (28, 20), (35, 22), (42, 27)])
                line(draw, SEAM, [(14, 31), (19, 28), (24, 25), (28, 23),
                        (33, 25), (38, 29), (42, 31)], 2)
            else:
                line(draw, GRAY_LIGHT, [(13, 30), (16, 22), (21, 15), (27, 12),
                        (33, 14), (39, 20), (43, 29)])
            polygon(draw, GRAY_DARK, [(36, 15), (42, 16), (43, 21), (38, 22)], SEAM)
            stitches(draw, [(37, 15), (41, 19)])
        else:
            polygon(draw, GRAY_DARK, [(14, 30), (21, 24), (25, 17), (24, 25),
                    (20, 32), (28, 37), (37, 35), (42, 31), (38, 36), (28, 40), (20, 36)])
            line(draw, SEAM, [(28, 9), (30, 15), (31, 23), (30, 32), (28, 39)])
            stitches(draw, [(29, 14), (30, 19), (30, 24), (29, 30), (28, 35)])
    else:
        polygon(draw, GRAY_DARK, [(8, 28), (9, 21), (13, 14), (19, 9), (26, 7),
                (34, 8), (41, 12), (45, 17), (48, 24), (47, 31), (43, 35),
                (38, 36), (33, 40), (26, 39), (17, 36), (11, 32)], INK)
        polygon(draw, GRAY, [(10, 27), (13, 18), (18, 13), (25, 9), (33, 10),
                (40, 14), (45, 21), (43, 27), (37, 29), (27, 34), (18, 33)])
        polygon(draw, GRAY_LIGHT, [(14, 19), (17, 15), (25, 10), (31, 11),
                (37, 13), (29, 13), (22, 15), (18, 19)])
        line(draw, GRAY_HIGH, [(18, 15), (25, 11), (29, 11)])
        polygon(draw, SEAM, [(10, 27), (14, 31), (21, 32), (28, 30), (25, 34),
                (30, 38), (27, 38), (18, 36), (12, 32)])
        if top:
            polygon(draw, INK, [(35, 28), (39, 24), (43, 23), (47, 27), (46, 32),
                    (44, 36), (39, 39), (35, 37), (33, 34)])
            polygon(draw, SKIN_SHADE, [(39, 28), (43, 26), (45, 28), (45, 30), (47, 32),
                    (45, 34), (44, 36), (40, 38), (37, 35)])
            polygon(draw, SKIN, [(40, 28), (43, 27), (44, 31), (46, 32), (43, 33),
                    (42, 35), (39, 36), (38, 34)])
            line(draw, CIRCLE, [(39, 31), (42, 31), (43, 32)])
            line(draw, LID, [(40, 29), (43, 29)])
            draw.point((42, 30), fill=PUPIL)
            line(draw, LID, [(42, 34), (44, 34)])
            polygon(draw, GRAY, [(29, 30), (34, 24), (38, 21), (42, 20), (47, 25),
                    (45, 28), (42, 26), (38, 29), (35, 35), (34, 38), (29, 37)])
            line(draw, SEAM, [(34, 37), (37, 30), (41, 26), (44, 26), (47, 28)])
        else:
            polygon(draw, INK, [(34, 26), (36, 20), (40, 17), (44, 20), (46, 25),
                    (46, 27), (49, 29), (47, 31), (46, 34), (42, 37), (37, 37), (34, 33)])
            polygon(draw, SKIN_SHADE, [(37, 24), (40, 19), (43, 21), (45, 25), (45, 28),
                    (48, 29), (45, 31), (45, 33), (42, 36), (38, 35), (36, 31)])
            polygon(draw, SKIN, [(39, 23), (41, 20), (44, 23), (44, 27), (47, 29),
                    (44, 31), (43, 34), (40, 35), (38, 32), (39, 29)])
            polygon(draw, CIRCLE, [(39, 25), (44, 25), (44, 27), (42, 29), (40, 28)])
            line(draw, HAIR, [(37, 24), (38, 21), (41, 20), (43, 21)], 2)
            line(draw, LID, [(40, 24), (43, 24)])
            line(draw, LID, [(40, 26), (44, 26)])
            draw.point((42, 27), fill=SHORTS)
            draw.point((43, 27), fill=PUPIL)
            line(draw, SKIN_LIGHT, [(40, 30), (42, 30), (42, 29)])
            line(draw, LID, [(43, 32), (45, 32)])
            line(draw, GRAY_LIGHT, [(33, 34), (33, 28), (36, 21), (41, 16), (44, 19)])
        line(draw, SEAM, [(17, 13), (14, 18), (13, 23), (13, 27)])
        stitches(draw, [(17, 13), (14, 18), (13, 23)])
        if direction == "right":
            polygon(draw, GRAY_DARK, [(27, 18), (33, 17), (35, 23), (29, 24)], SEAM)
            stitches(draw, [(28, 18), (33, 21)])
        else:
            image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return image


def limb(draw, start, end, shade, light, width):
    line(draw, INK, [start, end], width + 2)
    line(draw, shade, [start, end], width)
    x, y = start
    ex, ey = end
    line(draw, light, [(x, y), (ex, ey)], max(1, width - 2))


def foot(draw, start, end, direction, shade, light):
    x, y = end
    limb(draw, start, (x, y - 2), shade, light, 3)
    if direction in ("left", "right"):
        sign = 1 if direction == "right" else -1
        heel, toes = x - sign * 2, x + sign * 5
        polygon(draw, shade, [(heel, y - 3), (x + sign * 2, y - 3), (toes, y - 1),
                (toes, y + 1), (heel, y + 1), (heel, y)], INK)
        line(draw, light, [(x, y - 1), (toes, y)])
    else:
        toe = (x + 1, y + 2) if direction == "down" else (x + 1, y)
        polygon(draw, shade, [(x - 2, y - 4), (x + 2, y - 4), (x + 3, y - 1),
                toe, (x - 3, y + 1), (x - 3, y - 1)], INK)
        line(draw, light, [(x - 1, y - 2), (x + 1, y)])


def shorts(draw, x, y, side):
    width = 12 if side else 9
    polygon(draw, SHORTS_DARK, [(x, y), (x + width, y), (x + width - 1, y + 7),
            (x + 1, y + 7), (x, y + 5)], INK)
    polygon(draw, SHORTS, [(x + 1, y + 2), (x + width - 1, y + 1),
            (x + width - 2, y + 5), (x + 1, y + 6)])
    heart(draw, x + 2, y + 3)
    if side:
        heart(draw, x + 7, y + 2)


def arm(draw, shoulder, hand, close):
    hx, hy = hand
    sx, sy = shoulder
    elbow = ((sx + hx) // 2, (sy + hy) // 2)
    limb(draw, elbow, (hx, hy - 1), SKIN_SHADE, SKIN if close else SKIN_SHADE, 3)
    polygon(draw, SKIN_SHADE, [(hx - 2, hy - 2), (hx + 1, hy - 2), (hx + 2, hy + 1),
            (hx + 1, hy + 3), (hx - 1, hy + 2), (hx - 2, hy)], INK)
    line(draw, SKIN, [(hx, hy - 1), (hx, hy + 1)])
    limb(draw, shoulder, elbow, GRAY_DARK, GRAY if close else GRAY_DARK, 6)
    line(draw, SEAM, [(elbow[0] - 2, elbow[1]), (elbow[0] + 2, elbow[1] + 1)], 2)


def frame(direction, top, phase=None):
    image = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(image)
    side = direction in ("left", "right")
    sign = -1 if direction == "left" else 1
    pose = phase is not None
    angle = 2 * pi * (phase or 0) / WALK_FRAMES
    stride = cos(angle) if pose else 0
    left_lift = round(max(0, sin(angle)) * 3) if pose else 0
    right_lift = round(max(0, -sin(angle)) * 3) if pose else 0
    bob = 1 - round(abs(stride) * 2) if pose else 0
    step = round(stride * 5)
    hip = (43 if top else 45) + bob
    body_top = (34 if top else 32) + bob

    if side:
        feet = [(26 - sign * step, ORIGIN_Y - 2 - left_lift),
                (29 + sign * step, ORIGIN_Y - right_lift)]
        hips = [25, 29]
        shoulders = [(26, body_top + 2), (30, body_top + 3)]
        hands = [(25 + sign * round(step * 0.7), hip + 2 - right_lift),
                 (30 - sign * round(step * 0.7), hip + 5 - left_lift)]
    else:
        step *= -1 if direction == "up" else 1
        feet = [(23, ORIGIN_Y - 1 + step - left_lift),
                (32, ORIGIN_Y - 1 - step - right_lift)]
        hips = [23, 32]
        shoulders = [(20, body_top + 2), (35, body_top + 2)]
        hands = [(18, hip + 4 - round(step * 0.5)), (37, hip + 4 + round(step * 0.5))]
        if direction == "up":
            for index, (x, y) in enumerate(feet):
                feet[index] = (x, y - 1)

    back, front = (0, 1) if side or feet[0][1] <= feet[1][1] else (1, 0)
    foot(draw, (hips[back], hip + 4), feet[back], direction, SKIN_DARK, SKIN_SHADE)
    foot(draw, (hips[front], hip + 4), feet[front], direction, SKIN_SHADE, SKIN_LIGHT)
    for index in (back, front):
        if not side or index == front:
            shorts(draw, hips[index] - (5 if side else 4), hip, side)
    arm(draw, shoulders[back], hands[back], False)

    if side:
        polygon(draw, GRAY_DARK, [(21, body_top + 3), (26, body_top), (34, body_top + 1),
                (36, hip + 2), (32, hip + 1), (29, hip + 3), (25, hip + 1), (21, hip + 2)], INK)
        polygon(draw, GRAY, [(25, body_top + 3), (32, body_top + 2), (34, hip),
                (29, hip + 1), (26, hip - 1), (23, hip)], None)
    else:
        polygon(draw, GRAY_DARK, [(18, body_top + 4), (22, body_top + 1),
                (34, body_top + 1), (38, body_top + 4), (37, hip + 2), (33, hip),
                (31, hip + 3), (27, hip + 1), (24, hip + 3), (21, hip + 1), (19, hip + 2)], INK)
        polygon(draw, GRAY, [(21, body_top + 4), (25, body_top + 2), (33, body_top + 2),
                (35, body_top + 5), (34, hip), (31, hip + 1), (28, hip - 1),
                (24, hip + 1), (21, hip)], None)
    if direction == "up":
        line(draw, SEAM, [(25, body_top + 5), (26, hip - 2), (30, hip)])
        stitches(draw, [(28, hip - 3)])
    elif direction == "down":
        line(draw, SEAM, [(25, hip - 2), (30, hip - 2), (32, hip + 1)])
    arm(draw, shoulders[front], hands[front], True)

    hood = head(direction, top)
    image.alpha_composite(hood, (0, bob + (0 if top else -3)))
    if direction != "up":
        draw = ImageDraw.Draw(image)
        cords = {
            "down": [(25, 38), (31, 39)],
            "right": [(39, 36), (35, 39)],
            "left": [(16, 36), (20, 39)],
        }
        for x, y in cords[direction]:
            y += bob + (1 if top else -2)
            line(draw, SEAM, [(x, y), (x, y + 4)], 2)
            line(draw, THREAD, [(x, y), (x, y + 4)])
            draw.point((x, y + 5), fill=GRAY_HIGH)
    return image


def main():
    sheet = Image.new("RGBA", (WIDTH * (WALK_FRAMES + 1), HEIGHT * 5))
    for row, direction in enumerate(DIRECTIONS):
        sheet.paste(frame(direction, False), (row * WIDTH, 0))
        sheet.paste(frame(direction, True), (0, (row + 1) * HEIGHT))
        for phase in range(WALK_FRAMES):
            sheet.paste(frame(direction, True, phase), ((phase + 1) * WIDTH, (row + 1) * HEIGHT))
    output = Path(__file__).resolve().parents[1] / "game/assets/starter_character.png"
    sheet.save(output)


if __name__ == "__main__":
    main()
