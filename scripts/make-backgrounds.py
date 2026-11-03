"""Generate DreamBinder's built-in background library (original art, free to use).

Run:  python3 scripts/make-backgrounds.py
Writes public/backgrounds/<id>.jpg (1200x1600) and <id>-thumb.jpg, plus src/lib/backgrounds.json.
"""
import json
import os

import numpy as np
from PIL import Image, ImageFilter

W, H = 1200, 1600
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "public", "backgrounds")


def fbm(rng, octaves=6, base=3, persistence=0.55):
    """Fractal noise in 0..1, made by stacking smoothly upscaled random grids."""
    total = np.zeros((H, W), np.float32)
    amp, norm = 1.0, 0.0
    for o in range(octaves):
        n = base * 2**o
        grid = rng.random((max(2, int(n * H / W)) + 1, n + 1)).astype(np.float32)
        layer = np.asarray(Image.fromarray(grid, "F").resize((W, H), Image.BICUBIC))
        total += amp * layer
        norm += amp
        amp *= persistence
    total /= norm
    return (total - total.min()) / (np.ptp(total) + 1e-6)


def warp(field, dx, dy, strength):
    """Swirl a field by offsetting where each pixel samples from (domain warping)."""
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    sx = np.clip(xs + (dx - 0.5) * strength * W, 0, W - 1.001)
    sy = np.clip(ys + (dy - 0.5) * strength * H, 0, H - 1.001)
    x0, y0 = sx.astype(np.int32), sy.astype(np.int32)
    fx, fy = sx - x0, sy - y0  # bilinear blend, so there are no stair-step contours
    top = field[y0, x0] * (1 - fx) + field[y0, x0 + 1] * fx
    bot = field[y0 + 1, x0] * (1 - fx) + field[y0 + 1, x0 + 1] * fx
    return top * (1 - fy) + bot * fy


def ramp(v, stops):
    """Map 0..1 values to colours. stops = [(pos, '#rrggbb'), ...]."""
    pos = np.array([p for p, _ in stops], np.float32)
    cols = np.array([[int(c[i : i + 2], 16) for i in (1, 3, 5)] for _, c in stops], np.float32)
    out = np.empty(v.shape + (3,), np.float32)
    for ch in range(3):
        out[..., ch] = np.interp(v, pos, cols[:, ch])
    return out


def stars(rng, img, count, size=1.0):
    ys = rng.integers(0, H, count)
    xs = rng.integers(0, W, count)
    bright = rng.random(count) ** 3
    layer = np.zeros((H, W), np.float32)
    layer[ys, xs] = bright * 255
    glow = np.asarray(Image.fromarray(layer.astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(size)), np.float32)
    return np.clip(img + (layer + glow * 3)[..., None], 0, 255)


def ridged(n):
    return 1 - np.abs(n * 2 - 1)


def make(theme, seed):
    rng = np.random.default_rng(seed)
    a, b, c = fbm(rng), fbm(rng, base=2), fbm(rng, base=2)
    swirl = warp(a, b, c, 0.35)
    if theme == "nebula":
        img = ramp(swirl, [(0, "#05030f"), (0.35, "#1b0b3a"), (0.55, "#5b1a8a"), (0.7, "#c2338f"), (0.82, "#36c6e0"), (1, "#f4f0ff")])
        img = stars(rng, img, 2500)
    elif theme == "inferno":
        img = ramp(swirl ** 1.2, [(0, "#0a0000"), (0.35, "#4a0700"), (0.55, "#b81d00"), (0.72, "#ff6a00"), (0.88, "#ffc23d"), (1, "#fff6c9")])
    elif theme == "ocean":
        img = ramp(swirl, [(0, "#010b1f"), (0.4, "#06326b"), (0.6, "#0a6fb3"), (0.78, "#1cb5c9"), (0.92, "#b6f1f2"), (1, "#ffffff")])
    elif theme == "forest":
        img = ramp(swirl, [(0, "#020d04"), (0.4, "#0b3313"), (0.6, "#1d6b26"), (0.8, "#5fbf3a"), (0.93, "#d6f56a"), (1, "#fbffd9")])
    elif theme == "thunder":
        bolts = ridged(warp(fbm(rng, base=4), b, c, 0.2)) ** 12
        base = ramp(a, [(0, "#04040f"), (0.6, "#14163a"), (1, "#2a2f6b")])
        img = base + bolts[..., None] * np.array([255, 230, 90], np.float32)
    elif theme == "psychic":
        img = ramp(swirl, [(0, "#14021f"), (0.4, "#4b0f6b"), (0.62, "#b0329e"), (0.8, "#ff7bd0"), (0.94, "#ffd6f3"), (1, "#ffffff")])
        img = stars(rng, img, 600, 1.5)
    elif theme == "darkness":
        img = ramp(swirl, [(0, "#000000"), (0.4, "#0d0716"), (0.62, "#2e1145"), (0.8, "#62307f"), (0.93, "#a77bd1"), (1, "#e6d3ff")])
    elif theme == "metal":
        r = ridged(warp(fbm(rng, base=3), b, c, 0.15))
        img = ramp(r, [(0, "#1a1d22"), (0.5, "#5d6570"), (0.8, "#b8c0cb"), (1, "#f5f8fc")])
    elif theme == "dragon":
        img = ramp(swirl, [(0, "#020c0c"), (0.4, "#063a3a"), (0.6, "#0f6d5e"), (0.78, "#b98a1d"), (0.92, "#ffd76a"), (1, "#fff7d6")])
    elif theme == "holo":
        ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
        hue = (swirl * 1.6 + (xs + ys) / (W + H) * 1.2) % 1.0
        hsv = np.stack([hue * 255, np.full_like(hue, 150), 140 + swirl * 115], -1).astype(np.uint8)
        img = np.asarray(Image.fromarray(hsv, "HSV").convert("RGB"), np.float32)
        img = stars(rng, img, 1800, 0.8)
    elif theme == "starfield":
        band = np.exp(-(((np.mgrid[0:H, 0:W][1] - np.mgrid[0:H, 0:W][0] * 0.6 - W * 0.1) / (W * 0.35)) ** 2))
        img = ramp(np.clip(swirl * band * 1.4, 0, 1), [(0, "#000005"), (0.4, "#0a0c24"), (0.7, "#3a3f7a"), (1, "#d9dcff")])
        img = stars(rng, img, 6000, 0.7)
    elif theme == "sunset":
        ys = np.mgrid[0:H, 0:W][0] / H
        v = np.clip(ys * 0.75 + (swirl - 0.5) * 0.35, 0, 1)
        img = ramp(v, [(0, "#1a0b3d"), (0.3, "#6b1f7a"), (0.55, "#e0457b"), (0.75, "#ff9a3c"), (1, "#ffe08a")])
    elif theme == "ice":
        r = ridged(warp(fbm(rng, base=5), b, c, 0.1)) ** 3
        img = ramp(np.clip(a * 0.6 + r * 0.6, 0, 1), [(0, "#041427"), (0.45, "#1c5a8f"), (0.7, "#7cc4ef"), (0.9, "#e3f6ff"), (1, "#ffffff")])
    elif theme == "fairy":
        img = ramp(swirl, [(0, "#3d1430"), (0.35, "#a8467f"), (0.6, "#f29ac5"), (0.8, "#ffd3e8"), (1, "#fff8fc")])
        img = stars(rng, img, 900, 1.2)
    else:
        raise ValueError(theme)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))


THEMES = [
    ("nebula", "Nebula", ["psychic", "space"]),
    ("inferno", "Inferno", ["fire"]),
    ("ocean", "Ocean Depths", ["water"]),
    ("forest", "Forest Glow", ["grass"]),
    ("thunder", "Thunderstorm", ["lightning"]),
    ("psychic", "Dreamscape", ["psychic"]),
    ("darkness", "Shadow Realm", ["darkness"]),
    ("metal", "Chrome", ["metal"]),
    ("dragon", "Dragon Gold", ["dragon"]),
    ("holo", "Holo Rainbow", ["any"]),
    ("starfield", "Starfield", ["space"]),
    ("sunset", "Sunset Sky", ["any"]),
    ("ice", "Frozen", ["water"]),
    ("fairy", "Fairy Dust", ["fairy"]),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for i, (tid, name, tags) in enumerate(THEMES):
        img = make(tid, 1000 + i)
        img.save(os.path.join(OUT, f"{tid}.jpg"), quality=86, optimize=True, progressive=True)
        img.resize((240, 320), Image.LANCZOS).save(os.path.join(OUT, f"{tid}-thumb.jpg"), quality=80)
        manifest.append({"id": tid, "name": name, "tags": tags, "w": W, "h": H})
        print("made", tid)
    with open(os.path.join(ROOT, "src", "lib", "backgrounds.json"), "w") as f:
        json.dump(manifest, f, indent=2)
