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

/** CSS (percentages of the pocket) to show the right part of the art inside one pocket. */
export function artStyleForPocket(art: PageArt, rows: number, cols: number, index: number) {
  const { W, H } = pageSize(rows, cols);
  const p = artPlacement(art, W, H);
  const r = pocketRect(index, cols);
  return {
    width: `${(p.IW / r.w) * 100}%`,
    height: `${(p.IH / r.h) * 100}%`,
    left: `${((p.left - r.x) / r.w) * 100}%`,
    top: `${((p.top - r.y) / r.h) * 100}%`,
  };
}

/** Source rectangle in image pixels for one pocket (used by the PNG export). */
export function artSourceRect(art: PageArt, rows: number, cols: number, index: number) {
  const { W, H } = pageSize(rows, cols);
  const p = artPlacement(art, W, H);
  const r = pocketRect(index, cols);
  const k = art.w / p.IW; // image px per mm
  return { sx: (r.x - p.left) * k, sy: (r.y - p.top) * k, sw: r.w * k, sh: r.h * k };
}
