"""Turns a rocket illustration into game art.

Crops the transparent margin around the rocket and scales it to a fixed
height, so the game downloads small files and every rocket stands on the
bottom edge of its image.

    python tools/prepare_rocket_art.py "art/rockets/My rocket.png" my-rocket

writes public/assets/rockets/my-rocket.png. Needs Pillow (pip install pillow).
The source must be the rocket alone, nose up, on a transparent background.
"""
import sys
from pathlib import Path

from PIL import Image

OUTPUT_HEIGHT = 768
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "rockets"


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    source, rocket_id = Path(sys.argv[1]), sys.argv[2]

    image = Image.open(source).convert("RGBA")
    # Ignore the faint noise some generators leave in "transparent" pixels.
    opaque = image.getchannel("A").point(lambda alpha: 255 if alpha > 8 else 0)
    bounds = opaque.getbbox()
    if not bounds:
        sys.exit(f"{source} is fully transparent")

    rocket = image.crop(bounds)
    scale = OUTPUT_HEIGHT / rocket.height
    rocket = rocket.resize((max(1, round(rocket.width * scale)), OUTPUT_HEIGHT), Image.LANCZOS)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUTPUT_DIR / f"{rocket_id}.png"
    rocket.save(target, optimize=True)
    print(f"{target.name}: {rocket.width}x{rocket.height}, {target.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
