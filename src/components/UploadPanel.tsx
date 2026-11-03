"use client";
import { useRef, useState } from "react";
import { imageToCard, prepareArt, saveImage, splitAcrossPage } from "@/lib/image";
import type { PageArt } from "@/lib/types";
import BACKGROUNDS from "@/lib/backgrounds.json";

export type UploadHandlers = {
  rows: number;
  cols: number;
  /** Place one card-sized custom image (selected pocket, or first free one). */
  onPlaceImage: (imageId: string) => void;
  /** Put background art behind a page of the current spread (0 = left, 1 = right). */
  onSetArt: (side: 0 | 1, art: PageArt) => void;
  /** Where a block of cut-up cards goes: the selected pocket, or top-left of the left page. */
  blockStart: { page: number; index: number };
  /** Place a block of card pieces (blockRows × blockCols) starting at blockStart. */
  onPlaceBlock: (blockRows: number, blockCols: number, imageIds: string[]) => void;
};

/** Block sizes as [columns, rows] (wide × tall). */
const BLOCKS: [number, number][] = [
  [2, 1], [1, 2], [2, 2], [3, 1], [1, 3], [3, 2], [2, 3], [3, 3], [4, 2], [2, 4], [4, 3], [3, 4], [4, 4],
];

function BlockIcon({ w, h, active }: { w: number; h: number; active: boolean }) {
  return (
    <span className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${w}, 6px)` }}>
      {Array.from({ length: w * h }, (_, i) => (
        <span key={i} className={`h-[8px] w-[6px] rounded-[1px] ${active ? "bg-black" : "bg-white/50"}`} />
      ))}
    </span>
  );
}

export function UploadPanel({ rows, cols, onPlaceImage, onSetArt, blockStart, onPlaceBlock }: UploadHandlers) {
  const single = useRef<HTMLInputElement>(null);
  const blockInput = useRef<HTMLInputElement>(null);
  const fits = BLOCKS.filter(([w, h]) => w <= cols && h <= rows);
  const [block, setBlock] = useState<[number, number]>([2, 2]);
  const [bw, bh] = fits.some(([w, h]) => w === block[0] && h === block[1]) ? block : (fits[0] ?? [1, 1]);
  const split = useRef<HTMLInputElement>(null);
  const [side, setSide] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
        <h3 className="font-semibold">Single card image</h3>
        <p className="text-white/60">
          Cropped to card size (63×88) and placed in the selected pocket, or the first empty one.
        </p>
        <input
          ref={single}
          type="file"
          accept="image/*"
          multiple
          hidden
          data-testid="upload-single"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            run(async () => {
              for (const f of files) onPlaceImage(await saveImage(await imageToCard(f)));
            });
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => single.current?.click()}
          className="w-full rounded-md bg-amber-400 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
        >
          Upload image(s)
        </button>
      </section>

      <section className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
        <h3 className="font-semibold">Cut an image into cards</h3>
        <p className="text-white/60">
          Pick a size. Your image is cropped and cut into that many card pieces that line up into one picture. Each
          piece is its own card you can move or remove.
        </p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Block size">
          {fits.map(([w, h]) => {
            const active = w === bw && h === bh;
            return (
              <button
                key={`${w}x${h}`}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${w} wide by ${h} tall`}
                onClick={() => setBlock([w, h])}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                  active ? "border-amber-400 bg-amber-400 font-semibold text-black" : "border-white/10 text-white/70"
                }`}
              >
                <BlockIcon w={w} h={h} active={active} />
                {w}×{h}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-white/50">
          Goes on page {blockStart.page + 1} starting at pocket {blockStart.index + 1}. Click a pocket first to choose
          where. Cards already there are replaced.
        </p>
        <input
          ref={blockInput}
          type="file"
          accept="image/*"
          hidden
          data-testid="upload-block"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f)
              run(async () => {
                const pieces = await splitAcrossPage(f, bh, bw);
                onPlaceBlock(bh, bw, await Promise.all(pieces.map(saveImage)));
              });
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => blockInput.current?.click()}
          className="w-full rounded-md bg-amber-400 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
        >
          {busy ? "Processing…" : `Upload & cut into ${bw * bh} cards`}
        </button>
      </section>

      <section className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3">
        <h3 className="font-semibold">Background art for a page</h3>
        <p className="text-white/60">
          One big image spread behind all {rows * cols} pockets ({cols}×{rows}). Your cards stay on top and the
          empty pockets show the art, so you can build showcase layouts. Use &ldquo;Adjust art&rdquo; under the
          page to zoom and line it up.
        </p>
        <div className="flex gap-2">
          {(["Left page", "Right page"] as const).map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setSide(i as 0 | 1)}
              className={`flex-1 rounded-md border py-1.5 ${
                side === i ? "border-amber-400 text-amber-300" : "border-white/10 text-white/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          ref={split}
          type="file"
          accept="image/*"
          hidden
          data-testid="upload-split"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f)
              run(async () => {
                const { dataUrl, w, h } = await prepareArt(f);
                onSetArt(side, { imageId: await saveImage(dataUrl), w, h, zoom: 1, x: 0, y: 0 });
              });
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => split.current?.click()}
          className="w-full rounded-md bg-amber-400 py-2 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
        >
          {busy ? "Processing…" : "Upload artwork"}
        </button>
        <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-white/50">Or pick a free background</h4>
        <div className="grid grid-cols-4 gap-1.5" data-testid="bg-library">
          {BACKGROUNDS.map((bg) => (
            <button
              key={bg.id}
              type="button"
              title={bg.name}
              aria-label={`Use ${bg.name} background`}
              onClick={() =>
                onSetArt(side, { src: `/backgrounds/${bg.id}.jpg`, w: bg.w, h: bg.h, zoom: 1, x: 0, y: 0 })
              }
              className="group relative overflow-hidden rounded-md ring-amber-400 hover:ring-2"
            >
              <img src={`/backgrounds/${bg.id}-thumb.jpg`} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[9px] text-white">{bg.name}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/40">Original backgrounds made for DreamBinder, free for everyone to use.</p>
      </section>

      {error && <p className="text-red-400">{error}</p>}
      <p className="text-xs text-white/40">
        Uploads are free and stay in your browser. Only upload images you made or have the right to use.
      </p>
    </div>
  );
}
