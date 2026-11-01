// Render a binder spread to a PNG — handy for sharing on Discord or social media.
import type { Binder, Slot } from "./types";
import { CARD_H, CARD_W, POCKET_GAP, loadImage } from "./image";
import { cardImage } from "./tcgdex";

const PX = 4; // pixels per mm

async function slotImage(slot: Slot): Promise<HTMLImageElement | null> {
  if (!slot) return null;
  try {
    const url = slot.kind === "card" ? cardImage(slot.image, "high") : await loadImage(slot.imageId);
    if (!url) return null;
    const img = new Image();
    img.crossOrigin = "anonymous"; // keeps the canvas exportable
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null; // image failed or host blocked cross-origin reads; draw a placeholder instead
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function exportSpread(binder: Binder, firstPage: number) {
  const { rows, cols } = binder;
  const pad = 10 * PX;
  const pageW = (cols * CARD_W + (cols - 1) * POCKET_GAP) * PX + pad * 2;
  const pageH = (rows * CARD_H + (rows - 1) * POCKET_GAP) * PX + pad * 2;
  const spine = 14 * PX;
  const border = 12 * PX;
  const canvas = document.createElement("canvas");
  canvas.width = pageW * 2 + spine + border * 2;
  canvas.height = pageH + border * 2;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = binder.cover;
  roundRect(ctx, 0, 0, canvas.width, canvas.height, 8 * PX);
  ctx.fill();

  const pages = [binder.pages[firstPage], binder.pages[firstPage + 1]];
  for (let p = 0; p < 2; p++) {
    const ox = border + p * (pageW + spine);
    const oy = border;
    ctx.fillStyle = "#17171c";
    roundRect(ctx, ox, oy, pageW, pageH, 3 * PX);
    ctx.fill();
    const page = pages[p] ?? [];
    // Load everything first, then draw in order (drawing while awaiting would mix up clip regions).
    const images = await Promise.all(page.map(slotImage));
    page.forEach((slot, i) => {
      const x = ox + pad + (i % cols) * (CARD_W + POCKET_GAP) * PX;
      const y = oy + pad + Math.floor(i / cols) * (CARD_H + POCKET_GAP) * PX;
      const w = CARD_W * PX;
      const h = CARD_H * PX;
      ctx.save();
      roundRect(ctx, x, y, w, h, 3 * PX);
      ctx.clip();
      const img = images[i];
      if (img) ctx.drawImage(img, x, y, w, h);
      else {
        ctx.fillStyle = slot ? "#3f3f46" : "#232329";
        ctx.fillRect(x, y, w, h);
        if (slot?.kind === "card") {
          ctx.fillStyle = "#e4e4e7";
          ctx.font = `${5 * PX}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(slot.name, x + w / 2, y + h / 2, w - 4 * PX);
        }
      }
      ctx.restore();
    });
  }

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Export failed");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${binder.name.replace(/[^\w-]+/g, "_")}-pages-${firstPage + 1}-${firstPage + 2}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
