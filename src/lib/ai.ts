// AI extended art: paint new scenery around a card's artwork so it fills the whole page,
// lined up so the card itself sits in the middle pocket.
import { CARD_H, CARD_W } from "./image";
import { pageSize, pocketRect } from "./art";
import { saveImage } from "./image";
import type { PageArt } from "./types";

const KEY_STORE = "dreambinder:stabilityKey";
export const getAiKey = () => {
  try {
    return localStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
};
export const setAiKey = (k: string) => {
  try {
    localStorage.setItem(KEY_STORE, k.trim());
  } catch {}
};

/** Limits of the outpaint service: each side ≤ 2000 px added, ≤ ~9.4 MP output, input sides ≥ 64 px. */
const MAX_EXTEND = 2000;
const MAX_PIXELS = 9_000_000;

/** Same-origin URL for a picture, so we can read its pixels on a canvas. */
function readableUrl(src: string) {
  return /^https?:\/\//.test(src) && !src.startsWith(location.origin) ? `/api/proxy-image?url=${encodeURIComponent(src)}` : src;
}

async function loadImage(src: string) {
  const img = new Image();
  img.src = readableUrl(src);
  await img.decode();
  return img;
}

type Crop = { x: number; y: number; w: number; h: number };

/**
 * Work out the outpaint request: the crop goes where it sits on the card in the middle pocket,
 * and the AI fills the rest of the page around it.
 */
export function outpaintPlan(cropPx: { w: number; h: number }, crop: Crop, rows: number, cols: number) {
  const { W, H } = pageSize(rows, cols);
  const middle = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
  const r = pocketRect(middle, cols);
  // the crop's rectangle on the page, in mm
  const x0 = r.x + crop.x * CARD_W;
  const y0 = r.y + crop.y * CARD_H;
  const wMm = crop.w * CARD_W;
  const hMm = crop.h * CARD_H;
  // px per mm: at least enough for a ~1600 px wide page, so the painted scenery isn't low-res
  let s = Math.max(cropPx.w / wMm, 1600 / W);
  const ext = (mm: number) => mm * s;
  // shrink if any side or the total would be too big
  const biggest = Math.max(ext(x0), ext(W - x0 - wMm), ext(y0), ext(H - y0 - hMm));
  const total = W * s * H * s;
  s *= Math.min(1, MAX_EXTEND / biggest, Math.sqrt(MAX_PIXELS / total));
  const round = (mm: number) => Math.max(0, Math.round(mm * s));
  return {
    input: { w: Math.max(64, Math.round(wMm * s)), h: Math.max(64, Math.round(hMm * s)) },
    left: round(x0),
    right: round(W - x0 - wMm),
    up: round(y0),
    down: round(H - y0 - hMm),
  };
}

export async function extendArtWithAi(
  src: string,
  crop: Crop,
  rows: number,
  cols: number,
  opts: { prompt?: string; creativity?: number; signal?: AbortSignal } = {},
): Promise<PageArt> {
  const img = await loadImage(src);
  const cropPx = { w: img.naturalWidth * crop.w, h: img.naturalHeight * crop.h };
  const plan = outpaintPlan(cropPx, crop, rows, cols);

  const canvas = document.createElement("canvas");
  canvas.width = plan.input.w;
  canvas.height = plan.input.h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, img.naturalWidth * crop.x, img.naturalHeight * crop.y, cropPx.w, cropPx.h, 0, 0, canvas.width, canvas.height);
  const input = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Couldn't read the card picture"))), "image/png"));

  const form = new FormData();
  form.append("image", input, "art.png");
  form.append("left", String(plan.left));
  form.append("right", String(plan.right));
  form.append("up", String(plan.up));
  form.append("down", String(plan.down));
  form.append(
    "prompt",
    [opts.prompt, "seamless continuation of the same illustration, same art style and lighting, detailed scenery, no text, no border, no frame"]
      .filter(Boolean)
      .join(", "),
  );
  form.append("creativity", String(opts.creativity ?? 0.5));

  const key = getAiKey();
  const res = await fetch("/api/extend", {
    method: "POST",
    body: form,
    headers: key ? { "x-stability-key": key } : {},
    signal: opts.signal,
  });
  if (!res.ok) {
    let msg = `AI request failed (${res.status})`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const bmp = await createImageBitmap(blob);
  const dataUrl = await new Promise<string>((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result));
    fr.readAsDataURL(blob);
  });
  return { imageId: await saveImage(dataUrl), w: bmp.width, h: bmp.height, zoom: 1, x: 0, y: 0 };
}
