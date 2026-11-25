#!/usr/bin/env python3
"""Derive the transparent sign-in logo assets (G1, D-046) from the brand icon.

The brand artwork (two-person mark + 'momentum' wordmark) only exists as an
opaque raster whose background IS the tile color. This script color-keys that
plate away with a soft distance matte (no re-drawing of the brand) and emits:

  public/icons/icon-transparent-512.png        (light mode)
  public/icons/icon-transparent-dark-512.png   (dark mode: near-black wordmark
                                                and outlines recolored light)

Pillow is a transitive dep of the toolchain; if missing, `pip3 install pillow`.
"""
import sys
from PIL import Image

SRC = "public/icons/icon-512x512.png"
OUT_LIGHT = "public/icons/icon-transparent-512.png"
OUT_DARK = "public/icons/icon-transparent-dark-512.png"
PLATE_SAMPLER = (4, 4)          # a pixel guaranteed to be plate
PLATE_D0 = 12                   # distance below this = fully transparent
PLATE_D1 = 34                   # distance above this = fully opaque
DARK_LUM_MAX = 80               # luminance below this = "near-black" ink
DARK_SAT_MAX = 60               # low saturation required to treat as ink
INK_REPLACEMENT = (235, 240, 247, 255)  # light ink for the dark variant


def dist(c1, c2):
    return max(abs(a - b) for a, b in zip(c1[:3], c2[:3]))


def lum_sat(px):
    r, g, b = px[:3]
    mx, mn = max(r, g, b), min(r, g, b)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    sat = 0 if mx == mn else int(255 * (mx - mn) / mx)
    return lum, sat


def main():
    im = Image.open(SRC).convert("RGBA")
    plate = im.getpixel(PLATE_SAMPLER)[:3]
    print(f"source {SRC} plate color {plate}")
    px = im.load()
    w, h = im.size
    alpha_delta = Image.new("L", im.size, 255)
    ad = alpha_delta.load()
    kept = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = dist((r, g, b), plate)
            if d <= PLATE_D0:
                ad[x, y] = 0
            elif d >= PLATE_D1:
                ad[x, y] = 255
                kept += 1
            else:
                # smooth matte across the anti-aliased edge band
                t = (d - PLATE_D0) / (PLATE_D1 - PLATE_D0)
                v = int(255 * t * t * (3 - 2 * t))
                ad[x, y] = v
                kept += v / 255
    im.putalpha(alpha_delta)
    im.save(OUT_LIGHT, optimize=True)
    print(f"{OUT_LIGHT}: kept ~{int(kept)} opaque px of {w*h}")

    # Dark variant: same matte, near-black ink becomes light.
    dark = im.copy()
    dp = dark.load()
    recolored = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = dp[x, y]
            if a == 0:
                continue
            lum, sat = lum_sat((r, g, b))
            if lum <= DARK_LUM_MAX and sat <= DARK_SAT_MAX:
                dp[x, y] = INK_REPLACEMENT
                recolored += 1
    dark.save(OUT_DARK, optimize=True)
    print(f"{OUT_DARK}: recolored {recolored} near-black px to light ink")


if __name__ == "__main__":
    sys.exit(main())
