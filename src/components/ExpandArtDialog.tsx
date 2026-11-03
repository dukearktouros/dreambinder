"use client";
// "Expand art": crop the artwork out of a card (no name, text or border) and spread it
// behind the whole page, with the card itself in the middle pocket.
import { useRef, useState, type PointerEvent } from "react";
import type { PageArt } from "@/lib/types";

type Crop = { x: number; y: number; w: number; h: number };

/** Typical artwork areas on a Pokémon card, as fractions of the card. */
const PRESETS: { label: string; crop: Crop }[] = [
  { label: "Art window (regular card)", crop: { x: 0.085, y: 0.105, w: 0.83, h: 0.385 } },
  { label: "Full art (above the text)", crop: { x: 0.045, y: 0.1, w: 0.91, h: 0.41 } },
  { label: "Full art (inside border)", crop: { x: 0.045, y: 0.035, w: 0.91, h: 0.93 } },
];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function ExpandArtDialog({
  src,
  name,
  onApply,
  onClose,
}: {
  src: string;
  name: string;
  onApply: (art: PageArt, centerCard: boolean) => void;
  onClose: () => void;
}) {
  const [crop, setCrop] = useState<Crop>(PRESETS[0].crop);
  const [natural, setNatural] = useState<{ w: number; h: number }>();
  const [soft, setSoft] = useState(1.5);
  const [center, setCenter] = useState(true);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "move" | "resize"; px: number; py: number; start: Crop } | null>(null);

  const begin = (mode: "move" | "resize") => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, px: e.clientX, py: e.clientY, start: crop };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    const rect = box.current?.getBoundingClientRect();
    if (!d || !rect) return;
    const dx = (e.clientX - d.px) / rect.width;
    const dy = (e.clientY - d.py) / rect.height;
    const s = d.start;
    if (d.mode === "move") setCrop({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
    else setCrop({ ...s, w: clamp(s.w + dx, 0.08, 1 - s.x), h: clamp(s.h + dy, 0.06, 1 - s.y) });
  };
  const end = () => (drag.current = null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Expand card art"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-5 text-sm shadow-2xl sm:flex-row"
      >
        <div
          ref={box}
          className="relative mx-auto w-full max-w-[300px] shrink-0 select-none touch-none"
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {failed ? (
            <div className="flex aspect-[63/88] items-center justify-center rounded-lg bg-zinc-800 p-4 text-center text-white/60">
              This card has no picture to expand.
            </div>
          ) : (
            <img
              src={src}
              alt={name}
              draggable={false}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setFailed(true)}
              className="w-full rounded-lg"
            />
          )}
          {natural && (
            <>
              {/* darken everything outside the crop */}
              <div
                className="pointer-events-none absolute rounded-sm"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                }}
              />
              <div
                data-testid="crop-box"
                onPointerDown={begin("move")}
                className="absolute cursor-move border-2 border-amber-400"
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              >
                <div
                  aria-label="Resize"
                  onPointerDown={begin("resize")}
                  className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize rounded-full border-2 border-black bg-amber-400"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          <h2 className="text-lg font-bold">Expand art to page</h2>
          <p className="text-white/60">
            The part inside the yellow box becomes the background of the whole page, so the name, text and border
            are left out. Drag the box to move it, and the round handle to resize it.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setCrop(p.crop)}
                className="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/10"
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="text-white/60">Soften</span>
            <input
              type="range"
              min={0}
              max={4}
              step={0.25}
              value={soft}
              aria-label="Soften"
              onChange={(e) => setSoft(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
          </label>
          <p className="-mt-2 text-xs text-white/40">
            The art is enlarged a lot, so a little softening hides pixels and makes the card in front stand out.
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={center} onChange={(e) => setCenter(e.target.checked)} />
            Put this card in the middle pocket
          </label>
          <div className="mt-auto flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 hover:bg-white/10">
              Cancel
            </button>
            <button
              type="button"
              disabled={!natural}
              onClick={() =>
                natural &&
                onApply(
                  {
                    src,
                    crop,
                    w: Math.round(natural.w * crop.w),
                    h: Math.round(natural.h * crop.h),
                    zoom: 1,
                    x: 0,
                    y: 0,
                    blur: soft || undefined,
                  },
                  center,
                )
              }
              className="rounded-md bg-amber-400 px-3 py-1.5 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
            >
              Expand art
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
