"""Pack the approved four-view reference sheets into the game's starter atlas."""

from argparse import ArgumentParser
from pathlib import Path

from PIL import Image

WIDTH, HEIGHT = 120, 144
FOOT_Y = 134
ART_HEIGHT = 128
# Match the Lua direction order: down, left, right, up.
CELLS = ((0, 0), (0, 1), (1, 1), (1, 0))


def import_row(atlas, path, row):
    with Image.open(path) as source:
        sheet = source.convert("RGBA")
    width, height = sheet.size
    for col, (x, y) in enumerate(CELLS):
        sprite = sheet.crop((width * x // 2, height * y // 2,
                             width * (x + 1) // 2, height * (y + 1) // 2))
        bounds = sprite.getchannel("A").point(lambda value: 255 if value >= 128 else 0).getbbox()
        if not bounds:
            raise ValueError(f"{path}: empty sprite at column {x + 1}, row {y + 1}")
        sprite = sprite.crop(bounds)
        art_width = round(ART_HEIGHT * sprite.width / sprite.height)
        if art_width > WIDTH:
            raise ValueError(f"{path}: sprite at column {x + 1}, row {y + 1} is too wide")
        sprite = sprite.resize((art_width, ART_HEIGHT), Image.Resampling.BOX)
        atlas.paste(sprite, (col * WIDTH + (WIDTH - art_width) // 2,
                             row * HEIGHT + FOOT_Y - ART_HEIGHT))


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("portraits", type=Path, help="eye-level four-view transparent sheet")
    parser.add_argument("top_down", type=Path, help="top-down four-view transparent sheet")
    args = parser.parse_args()
    atlas = Image.new("RGBA", (WIDTH * len(CELLS), HEIGHT * 2))
    import_row(atlas, args.portraits, 0)
    import_row(atlas, args.top_down, 1)
    output = Path(__file__).resolve().parents[1] / "game/assets/starter_character.png"
    atlas.save(output)


if __name__ == "__main__":
    main()
