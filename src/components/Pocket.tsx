"use client";
import { useEffect, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
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
  const custom = useCustomImage(slot.kind === "custom" ? slot.imageId : undefined);
  const src = slot.kind === "card" ? cardImage(slot.image, quality) : custom;
  if (!src) return <div className="h-full w-full animate-pulse rounded-[5%] bg-white/10" />;
  return (
    <img
      src={src}
      alt={slot.kind === "card" ? slot.name : "Custom art"}
      draggable={false}
      loading="lazy"
      className="h-full w-full rounded-[4.5%] object-cover shadow-md"
    />
  );
}

type Props = {
  page: number;
  index: number;
  slot: Slot;
  selected: boolean;
  onSelect: () => void;
  onClear: () => void;
};

export function Pocket({ page, index, slot, selected, onSelect, onClear }: Props) {
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
      className={`group relative aspect-[63/88] cursor-pointer rounded-md border transition
        ${drop.isOver ? "border-amber-300 bg-amber-300/20" : "border-white/10 bg-black/25"}
        ${selected ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent" : ""}`}
    >
      {slot ? (
        <div
          ref={drag.setNodeRef}
          {...drag.listeners}
          {...drag.attributes}
          className={`h-full w-full touch-none ${drag.isDragging ? "opacity-30" : ""}`}
        >
          <SlotImage slot={slot} />
          <button
            type="button"
            aria-label="Remove card"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow group-hover:flex"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-xl text-white/15">+</div>
      )}
    </div>
  );
}
