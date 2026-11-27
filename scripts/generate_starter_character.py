"""Pack the eye-level portraits and shallow-angle walk cycle into the starter atlas."""

from argparse import ArgumentParser
from pathlib import Path

from PIL import Image

WIDTH, HEIGHT = 120, 144
FOOT_Y = 134
ART_HEIGHT = 128
# Lua reads character directions in this order: down, left, right, up.
PORTRAIT_CELLS = ((0, 0), (0, 1), (1, 1), (1, 0))
POSES = 5  # Idle, left contact, passing, right contact, passing.


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


def place_sprite(atlas, sprite, col, row, scale):
    w, h = (round(sprite.width * scale), round(sprite.height * scale))
    # Center on the hood, so a swinging foot or hand cannot shift the whole frame.
    hood = sprite.getchannel("A").crop((0, 0, sprite.width, sprite.height // 2))
    left, _, right, _ = hood.point(lambda value: 255 if value >= 128 else 0).getbbox()
    x = (WIDTH - round((left + right) * scale)) // 2
    y = FOOT_Y - h
    if x < 0 or x + w > WIDTH or y < 0:
        raise ValueError(f"Sprite at atlas column {col + 1}, row {row + 1} does not fit")
    scaled = sprite.resize((w, h), Image.Resampling.BOX)
    atlas.paste(scaled, (col * WIDTH + x, row * HEIGHT + y))


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("portraits", type=Path, help="eye-level four-view transparent sheet")
    parser.add_argument("front_back", type=Path, help="five poses each, front above back")
    parser.add_argument("left_right", type=Path, help="five poses each, left above right")
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

    output = Path(__file__).resolve().parents[1] / "game/assets/starter_character.png"
    atlas.save(output)


if __name__ == "__main__":
    main()
