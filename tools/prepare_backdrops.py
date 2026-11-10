"""Turns the opaque painted backdrops and the new cloud in art/ into game art.

    python tools/prepare_backdrops.py

- Coastal panorama -> public/assets/world/coast-panorama.webp
  The horizon band only (hills, towers, sea, scrub), with the sky above and
  the foreground below faded to transparent so it blends into the game's own
  sky and ground. Prints where the horizon sits, as a share of the height.
- Landing backdrops -> public/assets/landing/<level>-backdrop.webp
  Sky and horizon only, cut just below the far shore or sea line; the game
  draws its own ground, sea and pad below them.
- Painted cumulus -> public/assets/world/cloud-cumulus-2.webp
  Drops the blue specks a background remover left around the edges.

Needs Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / "art"
OUT = ROOT / "public" / "assets"


def fade_alpha(image, top_fade, bottom_fade):
    """Linear alpha ramps over the top and bottom shares of the height."""
    image = image.convert("RGBA")
    width, height = image.size
    mask = Image.new("L", (1, height))
    for y in range(height):
        t = y / (height - 1)
        a = 1.0
        if top_fade and t < top_fade:
            a = min(a, t / top_fade)
        if bottom_fade and t > 1 - bottom_fade:
            a = min(a, (1 - t) / bottom_fade)
        mask.putpixel((0, y), round(255 * a * a * (3 - 2 * a)))
    image.putalpha(mask.resize((width, height)))
    return image


def save(image, path, width=None):
    if width and image.width > width:
        image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, quality=86, method=6)
    print(f"{path.relative_to(ROOT)}: {image.width}x{image.height}, {path.stat().st_size // 1024} KB")
    return image


def coast_panorama():
    source = Image.open(ART / "world" / "Paisaje costero dorado con puerto espacial.png").convert("RGB")
    width, height = source.size
    # Horizon (sea line) of this painting, measured on the source.
    horizon = round(height * 0.822)
    top = round(height * 0.66)
    band = source.crop((0, top, width, height))
    band = fade_alpha(band, top_fade=0.45, bottom_fade=0.3)
    result = save(band, OUT / "world" / "coast-panorama.webp", width=2048)
    print(f"  horizon at {(horizon - top) / (height - top):.3f} of the height")
    # Average colour of the foreground scrub, for the ground drawn below it.
    strip = source.crop((0, height - 40, width, height)).resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    print(f"  foreground colour #{strip[0]:02x}{strip[1]:02x}{strip[2]:02x}")
    return result


# Source painting, output name, and where to cut it (share of the height).
LANDING_BACKDROPS = [
    # Down to just below the far grass, above the painted pad.
    ("Plataforma costera bajo cielo azul.png", "pad-backdrop.webp", 0.835),
    # Lighthouse cliffs at dusk: a band of rough sea under the horizon.
    ("Faro en los acantilados al anochecer.png", "crosswind-backdrop.webp", 0.74),
    # Night sea: stars, ship lights and a strip of swell under the horizon.
    ("Mar nocturno bajo la Vía Láctea.png", "droneship-backdrop.webp", 0.72),
]


def landing_backdrops():
    for name, output, cut in LANDING_BACKDROPS:
        source = Image.open(ART / "landing" / name).convert("RGB")
        width, height = source.size
        bottom = round(height * cut)
        crop = source.crop((0, 0, width, bottom))
        save(crop.convert("RGBA"), OUT / "landing" / output, width=1600)
        edge = source.crop((0, bottom - 12, width, bottom)).resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        print(f"  bottom edge colour #{edge[0]:02x}{edge[1]:02x}{edge[2]:02x}")


def painted_cloud():
    source = Image.open(ART / "world" / "Nube Cumulo Pintada Aislada.png").convert("RGBA")
    # The cloud body: its solid pixels, with gaps closed and edges kept. Specks
    # left around it by a background remover fall outside and are dropped;
    # nothing inside the body is touched.
    alpha = source.getchannel("A")
    solid = alpha.point(lambda v: 255 if v > 200 else 0)
    # Open (drop small islands), then close (fill holes), then grow a little.
    body = solid.filter(ImageFilter.MinFilter(15)).filter(ImageFilter.MaxFilter(15))
    body = body.filter(ImageFilter.MaxFilter(31)).filter(ImageFilter.MinFilter(31))
    body = body.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2))
    alpha = Image.composite(alpha, Image.new("L", alpha.size, 0), body)
    source.putalpha(alpha)
    bounds = source.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    save(source.crop(bounds), OUT / "world" / "cloud-cumulus-2.webp", width=1024)


if __name__ == "__main__":
    coast_panorama()
    landing_backdrops()
    painted_cloud()
