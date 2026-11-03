"use client";
import { useEffect, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import { useDndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import { cardImage } from "@/lib/tcgdex";
import { loadImage } from "@/lib/image";
import type { DragData, Slot } from "@/lib/types";

export function useCustomImage(id: string | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    if (id) loadImage(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

export function SlotImage({ slot, quality = "low" }: { slot: Exclude<Slot, null>; quality?: "low" | "high" }) {
  const missing = slot.kind === "card" && slot.missing;
  const flip = slot.flipped ? "rotate-180" : "";
  const custom = useCustomImage(slot.kind === "custom" ? slot.imageId : undefined);
  const src = slot.kind === "card" ? cardImage(slot.image, quality) : custom;
  const [broken, setBroken] = useState<string>();
  if (slot.kind === "card" && broken === src)
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[4.5%] bg-zinc-700 p-1 text-center text-[10px] text-white/70">
        {slot.name}
      </div>
    );
  if (!src) return <div className="h-full w-full animate-pulse rounded-[5%] bg-white/10" />;
  return (
    <img
      src={src}
      alt={slot.kind === "card" ? slot.name : "Custom art"}
      draggable={false}
      loading="lazy"
      onError={() => setBroken(src)}
      className={`h-full w-full rounded-[4.5%] object-cover shadow-md ${missing ? "opacity-55 grayscale" : ""} ${flip}`}
    />
  );
}

type Props = {
  page: number;
  index: number;
  slot: Slot;
  selected: boolean;
  /** Formatted market price to show on the card, if any */
  price?: string;
  /** Position on the page */
  style?: CSSProperties;
  /** This pocket's piece of the page background art */
  art?: { url: string; style: CSSProperties };
  /** Page has art but it was removed from this pocket */
  artRemoved?: boolean;
  /** Remove / restore the art in this pocket */
  onToggleArt?: () => void;
  onSelect: () => void;
  onClear: () => void;
  onToggleMissing: () => void;
};

const stop = (fn: () => void) => ({
  onPointerDown: (e: PointerEvent) => e.stopPropagation(),
  onClick: (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  },
});

export function Pocket({
  page,
  index,
  slot,
  selected,
  price,
  style,
  art,
  artRemoved,
  onToggleArt,
  onSelect,
  onClear,
  onToggleMissing,
}: Props) {
  const dragging = !!useDndContext().active;
  const drop = useDroppable({ id: `drop:${page}:${index}`, data: { type: "slot", page, index } });
  const drag = useDraggable({
    id: `drag:${page}:${index}`,
    disabled: !slot,
    data: slot ? ({ type: "slot", page, index, slot } satisfies DragData) : undefined,
  });

  return (
    <div
      ref={drop.setNodeRef}
      onClick={onSelect}
      data-testid={`pocket-${page}-${index}`}
      style={style}
      className={`group absolute cursor-pointer rounded-md transition
        ${art ? "" : artRemoved ? "border border-dashed" : "border"}
        ${drop.isOver ? "border-amber-300 bg-amber-300/20" : "border-white/10 bg-black/25"}
        ${selected ? "z-10 ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent" : ""}`}
    >
      {art && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[4.5%]">
          <img src={art.url} alt="" draggable={false} className="absolute max-w-none" style={art.style} />
        </div>
      )}
      {drop.isOver && art && <div className="pointer-events-none absolute inset-0 z-10 rounded-[4.5%] bg-amber-300/30" />}
      {/* While dragging, outline art pockets so it's clear cards can go on top */}
      {dragging && art && !drop.isOver && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-[4.5%] border-2 border-dashed border-amber-300/80" />
      )}
      {!slot && art && !dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[4.5%] bg-black/0 opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">+ Add card</span>
        </div>
      )}
      {!slot && onToggleArt && (
        <button
          type="button"
          aria-label={art ? "Remove art from this pocket" : "Put the art back in this pocket"}
          title={art ? "Remove art from this pocket" : "Put the art back in this pocket"}
          {...stop(onToggleArt)}
          className={`absolute -right-2 -top-2 z-20 hidden h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow group-hover:flex ${
            art ? "bg-red-600" : "bg-zinc-600"
          }`}
        >
          {art ? "×" : "↺"}
        </button>
      )}
      {slot ? (
        <div
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          className={`relative h-full w-full touch-none ${drag.isDragging ? "opacity-30" : ""}`}
        >
          <SlotImage slot={slot} />
          {slot.kind === "card" && slot.missing && (
            <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-white shadow">
              MISSING
            </span>
          )}
          {price && (
            <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[10px] font-semibold text-emerald-300">
              {price}
            </span>
          )}
          {slot.kind === "card" && (
            <button
              type="button"
              aria-label={slot.missing ? "Mark as owned" : "Mark as missing"}
              title={slot.missing ? "Mark as owned" : "Mark as missing"}
              {...stop(onToggleMissing)}
              className="absolute -left-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white shadow hover:bg-zinc-600 group-hover:flex"
            >
              {slot.missing ? "✓" : "?"}
            </button>
          )}
          <button
            type="button"
            aria-label="Remove card"
            title="Remove card"
            {...stop(onClear)}
            className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow group-hover:flex"
          >
            ×
          </button>
        </div>
      ) : (
        !art && (
          <div className="flex h-full items-center justify-center text-xl text-white/15">
            {artRemoved ? <span className="text-[10px]">art removed</span> : "+"}
          </div>
        )
      )}
    </div>
  );
}
