// Geometry for page background art: one image spread across a whole page,
// cut by the real pocket layout (cards are 63×88 mm with a 4 mm gap between pockets).
import { CARD_H, CARD_W, POCKET_GAP } from "./image";
import type { PageArt } from "./types";

export function pageSize(rows: number, cols: number) {
  return { W: cols * CARD_W + (cols - 1) * POCKET_GAP, H: rows * CARD_H + (rows - 1) * POCKET_GAP };
}

/** Pocket position on the page, in mm. */
export function pocketRect(index: number, cols: number) {
  const c = index % cols;
  const r = Math.floor(index / cols);
  return { x: c * (CARD_W + POCKET_GAP), y: r * (CARD_H + POCKET_GAP), w: CARD_W, h: CARD_H };
}

/**
 * Where the art sits on the page (mm). zoom 1 = just covers the page;
 * x / y from -0.5 to 0.5 slide it to show its left/top or right/bottom part.
 */
export function artPlacement(art: PageArt, W: number, H: number) {
  const scale = Math.max(W / art.w, H / art.h) * art.zoom;
  const IW = art.w * scale;
  const IH = art.h * scale;
  return { left: (W - IW) * (0.5 + art.x), top: (H - IH) * (0.5 + art.y), IW, IH };
}

const FULL = { x: 0, y: 0, w: 1, h: 1 };

/** Where the whole image (not just the crop) sits on the page, in mm. */
function fullImagePlacement(art: PageArt, W: number, H: number) {
  const p = artPlacement(art, W, H);
  const c = art.crop ?? FULL;
  const fullW = p.IW / c.w;
  const fullH = p.IH / c.h;
  return { left: p.left - c.x * fullW, top: p.top - c.y * fullH, fullW, fullH };
}

/** CSS (percentages of the pocket) to show the right part of the art inside one pocket. */
export function artStyleForPocket(art: PageArt, rows: number, cols: number, index: number) {
  const { W, H } = pageSize(rows, cols);
  const f = fullImagePlacement(art, W, H);
  const r = pocketRect(index, cols);
  return {
    width: `${(f.fullW / r.w) * 100}%`,
    height: `${(f.fullH / r.h) * 100}%`,
    left: `${((f.left - r.x) / r.w) * 100}%`,
    top: `${((f.top - r.y) / r.h) * 100}%`,
    // blur is in mm; 1cqw = 1% of the page width (the page is a size container)
    ...(art.blur ? { filter: `blur(${(art.blur / W) * 100}cqw)` } : {}),
  };
}

/**
 * Source rectangle (image px) and destination offset for one pocket, used by the PNG export.
 * `margin` (mm) draws a little extra around the pocket so blurred edges stay filled.
 */
export function artSourceRect(art: PageArt, rows: number, cols: number, index: number, natural: { w: number; h: number }, margin = 0) {
  const { W, H } = pageSize(rows, cols);
  const f = fullImagePlacement(art, W, H);
  const r = pocketRect(index, cols);
  const kx = natural.w / f.fullW; // image px per mm
  const ky = natural.h / f.fullH;
  return {
    sx: (r.x - margin - f.left) * kx,
    sy: (r.y - margin - f.top) * ky,
    sw: (r.w + 2 * margin) * kx,
    sh: (r.h + 2 * margin) * ky,
  };
}
