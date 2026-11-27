"""Pack the portraits, walk cycles and melee poses into the starter atlas."""

from argparse import ArgumentParser
from itertools import groupby
from pathlib import Path

from PIL import Image

WIDTH, HEIGHT = 120, 144
FOOT_Y = 134
ART_HEIGHT = 128
# Lua reads character directions in this order: down, left, right, up.
PORTRAIT_CELLS = ((0, 0), (0, 1), (1, 1), (1, 0))
POSES = 5  # Idle, left contact, passing, right contact, passing.
ATTACK_POSES, ATTACK_WIDTH = 4, 176


def load_sheet(path):
    with Image.open(path) as source:
        return source.convert("RGBA")


def extract_sprite(sheet, col, row, columns):
    w, h = sheet.size
    tile = sheet.crop((w * col // columns, h * row // 2,
                       w * (col + 1) // columns, h * (row + 1) // 2))
    opaque = tile.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    bounds = opaque.getbbox()
    if not bounds:
        raise ValueError(f"Empty sprite at column {col + 1}, row {row + 1}")
    return tile.crop(bounds)


def place_sprite(atlas, sprite, col, row, scale, cell_width=WIDTH, hood_fraction=0.5):
    w, h = (round(sprite.width * scale), round(sprite.height * scale))
    # Center on the hood, so a swinging foot or hand cannot shift the whole frame.
    hood = sprite.getchannel("A").crop((0, 0, sprite.width, round(sprite.height * hood_fraction)))
    left, _, right, _ = hood.point(lambda value: 255 if value >= 128 else 0).getbbox()
    x = (cell_width - round((left + right) * scale)) // 2
    y = FOOT_Y - h
    if x < 0 or x + w > cell_width or y < 0:
        raise ValueError(f"Sprite at atlas column {col + 1}, row {row + 1} does not fit")
    scaled = sprite.resize((w, h), Image.Resampling.BOX)
    atlas.paste(scaled, (col * cell_width + x, row * HEIGHT + y))


def attack_row(sheet, row):
    width, height = sheet.size
    strip = sheet.crop((0, row * height // 2, width, (row + 1) * height // 2))
    alpha = strip.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    columns = alpha.resize((width, 1), Image.Resampling.BOX)
    poses = []
    # The extended club can cross the nominal cell edge. Use the gaps between sprites.
    for occupied, pixels in groupby(range(width), key=lambda x: columns.getpixel((x, 0)) > 0):
        span = list(pixels)
        if occupied and len(span) > 10:
            left, right = span[0], span[-1] + 1
            tile = strip.crop((left, 0, right, strip.height))
            bounds = alpha.crop((left, 0, right, strip.height)).getbbox()
            poses.append(tile.crop(bounds))
    if len(poses) != ATTACK_POSES:
        raise ValueError(f"Expected {ATTACK_POSES} attack poses in row {row + 1}, found {len(poses)}")
    return poses


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("portraits", type=Path, help="eye-level four-view transparent sheet")
    parser.add_argument("front_back", type=Path, help="five poses each, front above back")
    parser.add_argument("left_right", type=Path, help="five poses each, left above right")
    parser.add_argument("attack_front_back", type=Path, help="four attack poses each, front above back")
    parser.add_argument("attack_left_right", type=Path, help="four attack poses each, left above right")
    args = parser.parse_args()
    atlas = Image.new("RGBA", (WIDTH * POSES, HEIGHT * (len(PORTRAIT_CELLS) + 1)))

    portraits = load_sheet(args.portraits)
    for col, (x, y) in enumerate(PORTRAIT_CELLS):
        sprite = extract_sprite(portraits, x, y, 2)
        place_sprite(atlas, sprite, col, 0, ART_HEIGHT / sprite.height)

    front_back = load_sheet(args.front_back)
    left_right = load_sheet(args.left_right)
    walk_rows = ((front_back, 0), (left_right, 0), (left_right, 1), (front_back, 1))
    for row, (sheet, sheet_row) in enumerate(walk_rows, start=1):
        poses = [extract_sprite(sheet, col, sheet_row, POSES) for col in range(POSES)]
        # Keep a single scale for the entire cycle to preserve the character's size.
        scale = ART_HEIGHT / poses[0].height
        for col, sprite in enumerate(poses):
            place_sprite(atlas, sprite, col, row, scale)

    attack_front_back = load_sheet(args.attack_front_back)
    attack_left_right = load_sheet(args.attack_left_right)
    attack_rows = ((attack_front_back, 0), (attack_left_right, 0), (attack_left_right, 1), (attack_front_back, 1))
    attacks = Image.new("RGBA", (ATTACK_WIDTH * ATTACK_POSES, HEIGHT * len(attack_rows)))
    for row, (sheet, sheet_row) in enumerate(attack_rows):
        poses = attack_row(sheet, sheet_row)
        scale = ART_HEIGHT / poses[-1].height
        for col, sprite in enumerate(poses):
            place_sprite(attacks, sprite, col, row, scale, ATTACK_WIDTH, hood_fraction=0.26)

    assets = Path(__file__).resolve().parents[1] / "game/assets"
    atlas.save(assets / "starter_character.png")
    attacks.save(assets / "starter_attack.png")


if __name__ == "__main__":
    main()
