// Image helpers: crop uploads to card size, or slice one artwork across a whole binder page.
import { createStore, get, set, del, keys } from "idb-keyval";

/** Standard card size in mm, and the gap between binder pockets. */
export const CARD_W = 63;
export const CARD_H = 88;
export const POCKET_GAP = 4;
const OUT_W = 630;
const OUT_H = 880;

const store = typeof indexedDB !== "undefined" ? createStore("dreambinder", "images") : undefined;
const cache = new Map<string, string>();

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export async function saveImage(dataUrl: string) {
  const id = newId();
  cache.set(id, dataUrl);
  if (store) await set(id, dataUrl, store);
  return id;
}

export async function loadImage(id: string) {
  if (cache.has(id)) return cache.get(id)!;
  if (!store) return undefined;
  const url = await get<string>(id, store);
  if (url) cache.set(id, url);
  return url;
}

/** Delete stored images no binder references anymore. */
export async function collectGarbage(used: Set<string>) {
  if (!store) return;
  for (const k of await keys(store)) if (!used.has(String(k))) await del(k, store);
}

function crop(bmp: ImageBitmap, sx: number, sy: number, sw: number, sh: number) {
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Center-crop an image to the card ratio. */
export async function imageToCard(file: Blob) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(bmp.width / CARD_W, bmp.height / CARD_H);
  const sw = CARD_W * scale;
  const sh = CARD_H * scale;
  return crop(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh);
}

/**
 * Slice one artwork across a full page (rows × cols pockets) so the cards line up into one
 * picture. The gaps between pockets are skipped, like they would be in a real binder.
 * Returns the pieces in reading order.
 */
export async function splitAcrossPage(file: Blob, rows: number, cols: number) {
  const bmp = await createImageBitmap(file);
  const pageW = cols * CARD_W + (cols - 1) * POCKET_GAP;
  const pageH = rows * CARD_H + (rows - 1) * POCKET_GAP;
  const scale = Math.min(bmp.width / pageW, bmp.height / pageH);
  const offX = (bmp.width - pageW * scale) / 2;
  const offY = (bmp.height - pageH * scale) / 2;
  const pieces: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pieces.push(
        crop(
          bmp,
          offX + c * (CARD_W + POCKET_GAP) * scale,
          offY + r * (CARD_H + POCKET_GAP) * scale,
          CARD_W * scale,
          CARD_H * scale,
        ),
      );
    }
  }
  return pieces;
}

/** Downscale a big artwork for use as page background art. */
export async function prepareArt(file: Blob, maxSide = 2400) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.9), w: canvas.width, h: canvas.height };
}
