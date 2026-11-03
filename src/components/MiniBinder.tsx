"use client";
// Small read-only view of a binder spread (used in the community gallery).
import { pageSize, pocketRect, artStyleForPocket } from "@/lib/art";
import type { Binder } from "@/lib/types";
import { SlotImage } from "./Pocket";

function MiniPage({ binder, page }: { binder: Binder; page: number }) {
  const slots = binder.pages[page] ?? [];
  const art = binder.art?.[page];
  const { W, H } = pageSize(binder.rows, binder.cols);
  return (
    <div className="flex-1 rounded-md bg-zinc-900 p-1.5">
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}`, containerType: "inline-size" }}>
        {slots.map((slot, i) => {
          const r = pocketRect(i, binder.cols);
          const showArt = art?.src && !art.hidden?.includes(i);
          return (
            <div
              key={i}
              className="absolute overflow-hidden rounded-[4.5%] bg-black/30"
              style={{ left: `${(r.x / W) * 100}%`, top: `${(r.y / H) * 100}%`, width: `${(r.w / W) * 100}%`, height: `${(r.h / H) * 100}%` }}
            >
              {showArt && (
                <img src={art.src} alt="" className="absolute max-w-none" style={artStyleForPocket(art, binder.rows, binder.cols, i)} />
              )}
              {slot && <div className="relative h-full w-full"><SlotImage slot={slot} /></div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MiniBinder({ binder }: { binder: Binder }) {
  return (
    <div className="flex gap-1.5 rounded-lg p-1.5" style={{ background: binder.cover }}>
      <MiniPage binder={binder} page={0} />
      <MiniPage binder={binder} page={1} />
    </div>
  );
}
