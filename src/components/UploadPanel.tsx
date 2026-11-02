"use client";
import { useRef, useState } from "react";
import { imageToCard, prepareArt, saveImage } from "@/lib/image";
import type { PageArt } from "@/lib/types";

export type UploadHandlers = {
  rows: number;
  cols: number;
  /** Place one card-sized custom image (selected pocket, or first free one). */
  onPlaceImage: (imageId: string) => void;
  /** Put background art behind a page of the current spread (0 = left, 1 = right). */
  onSetArt: (side: 0 | 1, art: PageArt) => void;
};

export function UploadPanel({ rows, cols, onPlaceImage, onSetArt }: UploadHandlers) {
  const single = useRef<HTMLInputElement>(null);
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
      </section>

      {error && <p className="text-red-400">{error}</p>}
      <p className="text-xs text-white/40">
        Uploads are free and stay in your browser. Only upload images you made or have the right to use.
      </p>
    </div>
  );
}
