"""Turns an illustration into game art.

Crops the transparent margin around the subject and scales it, so the game
downloads small files and every image is tight to what it shows.

    python tools/prepare_art.py SOURCE OUTPUT (--height H | --box S) [--threshold A]

--height H  scales the subject to H pixels tall (rockets: 768, tower: 768)
--box S     fits the subject inside an S x S square, centred (patches: 320)
--threshold pixels at or below this alpha count as background (default 8;
            raise it to drop faint haze an image generator left around)

OUTPUT may end in .png or .webp (WebP keeps transparency and is much smaller
for photo-like art such as the planet). Needs Pillow (pip install pillow).
"""
import argparse
from pathlib import Path

from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    size = parser.add_mutually_exclusive_group(required=True)
    size.add_argument("--height", type=int)
    size.add_argument("--box", type=int)
    parser.add_argument("--threshold", type=int, default=8)
    args = parser.parse_args()

    image = Image.open(args.source).convert("RGBA")
    opaque = image.getchannel("A").point(lambda alpha: 255 if alpha > args.threshold else 0)
    bounds = opaque.getbbox()
    if not bounds:
        parser.exit(1, f"{args.source} is fully transparent\n")
    subject = image.crop(bounds)

    if args.height:
        scale = args.height / subject.height
        result = subject.resize((max(1, round(subject.width * scale)), args.height), Image.LANCZOS)
    else:
        scale = args.box / max(subject.width, subject.height)
        fitted = subject.resize(
            (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))), Image.LANCZOS
        )
        result = Image.new("RGBA", (args.box, args.box), (0, 0, 0, 0))
        result.paste(fitted, ((args.box - fitted.width) // 2, (args.box - fitted.height) // 2))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.suffix.lower() == ".webp":
        result.save(args.output, quality=88, method=6)
    else:
        result.save(args.output, optimize=True)
    print(f"{args.output}: {result.width}x{result.height}, {args.output.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
