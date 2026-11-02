"use client";
import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useBinders, type BinderActions } from "@/lib/store";
import { COVER_COLORS, GRID_PRESETS, type Binder, type DragData, type DropData, type Slot } from "@/lib/types";
import { exportSpread } from "@/lib/export";
import { exportPdf } from "@/lib/pdf";
import { formatPrice, formatTotal, useCardInfo, type CardInfo } from "@/lib/prices";
import { Pocket, SlotImage } from "./Pocket";
import { Library } from "./Library";

type Sel = { page: number; index: number } | null;

function Trash() {
  const { setNodeRef, isOver } = useDroppable({ id: "trash", data: { type: "trash" } satisfies DropData });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border border-dashed px-4 py-2 text-center text-sm transition ${
        isOver ? "border-red-400 bg-red-500/20 text-red-300" : "border-white/15 text-white/40"
      }`}
    >
      Drop here to remove
    </div>
  );
}

function Page({
  binder,
  page,
  sel,
  setSel,
  actions,
  priceOf,
}: {
  binder: Binder;
  page: number;
  sel: Sel;
  setSel: (s: Sel) => void;
  actions: BinderActions;
  priceOf: (slot: Slot) => string | undefined;
}) {
  const slots = binder.pages[page];
  if (!slots) return null;
  return (
    <div className="flex-1 rounded-xl bg-zinc-900/95 p-3 shadow-inner sm:p-4">
      <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${binder.cols}, minmax(0, 1fr))` }}>
        {slots.map((slot, i) => (
          <Pocket
            key={i}
            page={page}
            index={i}
            slot={slot}
            selected={sel?.page === page && sel.index === i}
            onSelect={() => setSel(sel?.page === page && sel.index === i ? null : { page, index: i })}
            price={priceOf(slot)}
            onClear={() => actions.setSlot(page, i, null)}
            onToggleMissing={() => actions.toggleMissing(page, i)}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-white/30">Page {page + 1}</p>
    </div>
  );
}

function PdfDialog({ binder, onClose }: { binder: Binder; onClose: () => void }) {
  const [onlyMissing, setOnlyMissing] = useState(binder.pages.flat().some((s) => s?.kind === "card" && s.missing));
  const [pictures, setPictures] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Export PDF"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-zinc-900 p-5 text-sm shadow-2xl"
      >
        <h2 className="text-lg font-bold">Export PDF</h2>
        <p className="text-white/60">A printable list with tick boxes, set, card number and price. Handy at card shows.</p>
        <fieldset className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="radio" checked={onlyMissing} onChange={() => setOnlyMissing(true)} />
            Want list: only missing cards
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={!onlyMissing} onChange={() => setOnlyMissing(false)} />
            Checklist: every card in the binder
          </label>
        </fieldset>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={pictures} onChange={(e) => setPictures(e.target.checked)} />
          Include card pictures
        </label>
        {error && <p className="text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 hover:bg-white/10">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(undefined);
              try {
                await exportPdf(binder, { onlyMissing, pictures });
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Export failed");
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-md bg-amber-400 px-3 py-1.5 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
          >
            {busy ? "Making PDF…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stats({ binder, infos }: { binder: Binder; infos: Record<string, CardInfo> }) {
  const cards = binder.pages.flat().filter((s) => s?.kind === "card");
  const missing = cards.filter((s) => s.missing);
  const loading = cards.some((s) => !infos[s.cardId]);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm" data-testid="stats">
      <span>
        <b>{cards.length}</b> <span className="text-white/50">cards</span>
      </span>
      <span>
        <b className="text-red-400">{missing.length}</b> <span className="text-white/50">missing</span>
      </span>
      <span>
        <span className="text-white/50">Value </span>
        <b className="text-emerald-300">{formatTotal(cards.map((s) => infos[s.cardId]))}</b>
      </span>
      <span>
        <span className="text-white/50">To complete </span>
        <b className="text-amber-300">{formatTotal(missing.map((s) => infos[s.cardId]))}</b>
      </span>
      {loading && <span className="text-xs text-white/40">loading prices…</span>}
    </div>
  );
}

export function Editor() {
  const { ready, binders, binder, actions } = useBinders();
  const [spread, setSpread] = useState(0); // index of the left page
  const [sel, setSel] = useState<Sel>(null);
  const [dragging, setDragging] = useState<DragData | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showPrices, setShowPrices] = useState(true);
  const [pdfOpen, setPdfOpen] = useState(false);
  const infos = useCardInfo(binder?.pages.flat().flatMap((s) => (s?.kind === "card" ? [s.cardId] : [])) ?? []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  if (!ready || !binder) return <div className="p-10 text-center text-white/50">Loading your binders…</div>;

  const left = Math.min(spread, binder.pages.length - 2);
  const totalSpreads = binder.pages.length / 2;
  const size = binder.rows * binder.cols;

  /** Place into the selected pocket (then advance), or the first empty pocket in view. */
  function place(slot: Exclude<Slot, null>) {
    if (!binder) return;
    let target = sel;
    if (!target) {
      for (const p of [left, left + 1]) {
        const i = binder.pages[p].indexOf(null);
        if (i >= 0) {
          target = { page: p, index: i };
          break;
        }
      }
    }
    if (!target) {
      // spread full: start a new one
      actions.addSpread();
      target = { page: binder.pages.length, index: 0 };
      setSpread(binder.pages.length);
    }
    actions.setSlot(target.page, target.index, slot);
    if (sel) {
      const next = sel.index + 1 < size ? { page: sel.page, index: sel.index + 1 } : null;
      setSel(next);
    }
  }

  function onDragStart(e: DragStartEvent) {
    setDragging((e.active.data.current as DragData) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const a = e.active.data.current as DragData | undefined;
    const o = e.over?.data.current as DropData | undefined;
    if (!a || !o) return;
    if (o.type === "trash") {
      if (a.type === "slot") actions.setSlot(a.page, a.index, null);
    } else if (a.type === "card") {
      actions.setSlot(o.page, o.index, a.slot);
    } else if (a.page !== o.page || a.index !== o.index) {
      actions.moveSlot(a.page, a.index, o.page, o.index);
    }
  }

  const gridValue = `${binder.rows}x${binder.cols}`;
  const priceOf = (slot: Slot) => {
    const info = slot?.kind === "card" && showPrices ? infos[slot.cardId] : undefined;
    return info?.price ? formatPrice(info.price, info.currency) : undefined;
  };
  const selSlot = sel ? binder.pages[sel.page]?.[sel.index] : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="flex min-h-screen flex-col lg:h-screen">
        {/* Top bar */}
        <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/40 px-4 py-3">
          <span className="mr-2 text-lg font-black tracking-tight text-amber-300">DreamBinder</span>
          <select
            value={binder.id}
            onChange={(e) => {
              actions.selectBinder(e.target.value);
              setSpread(0);
              setSel(null);
            }}
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm"
            aria-label="Choose binder"
          >
            {binders.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || "Untitled"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              actions.newBinder(`Binder ${binders.length + 1}`);
              setSpread(0);
              setSel(null);
            }}
            className="rounded-md border border-white/10 px-2 py-1.5 text-sm hover:bg-white/10"
          >
            + New
          </button>
          <input
            value={binder.name}
            onChange={(e) => actions.rename(e.target.value)}
            aria-label="Binder name"
            className="min-w-0 basis-full rounded-md border sm:flex-1 sm:basis-auto border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold hover:border-white/10 focus:border-amber-400 focus:outline-none sm:max-w-xs"
          />
          <select
            value={gridValue}
            onChange={(e) => {
              const [r, c] = e.target.value.split("x").map(Number);
              actions.setGrid(r, c);
              setSel(null);
            }}
            className="rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm"
            aria-label="Pocket layout"
          >
            {GRID_PRESETS.map((g) => (
              <option key={g.label} value={`${g.rows}x${g.cols}`}>
                {g.label}
              </option>
            ))}
          </select>
          <div className="flex gap-1" role="radiogroup" aria-label="Cover colour">
            {COVER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cover ${c}`}
                onClick={() => actions.setCover(c)}
                className={`h-5 w-5 rounded-full border-2 ${binder.cover === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportSpread(binder, left);
              } finally {
                setExporting(false);
              }
            }}
            className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
          >
            {exporting ? "Exporting…" : "Export PNG"}
          </button>
          <button
            type="button"
            onClick={() => setPdfOpen(true)}
            className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-300"
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => confirm(`Delete "${binder.name}"? This can't be undone.`) && actions.deleteBinder(binder.id)}
            className="rounded-md px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
          >
            Delete
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
          {/* Card library */}
          <aside className="h-[60vh] w-full shrink-0 border-t border-white/10 bg-black/30 p-4 lg:h-auto lg:w-96 lg:border-r lg:border-t-0">
            <Library
              rows={binder.rows}
              cols={binder.cols}
              onPick={place}
              onMakeBinder={(name, cards) => {
                actions.newBinder(name, cards);
                setSpread(0);
                setSel(null);
              }}
              onPlaceImage={(imageId) => place({ kind: "custom", imageId })}
              onSplitImage={(side, ids) => actions.fillPage(left + side, ids.map((imageId) => ({ kind: "custom", imageId })))}
            />
          </aside>

          {/* Binder */}
          <main className="flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-4 sm:p-6">
            <Stats binder={binder} infos={infos} />
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-white/60">
                <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
                Show prices
              </label>
              <span className="text-white/20">|</span>
              <button type="button" onClick={() => actions.setMissing(true, [left, left + 1])} className="text-white/60 hover:text-white">
                Mark these pages missing
              </button>
              <button type="button" onClick={() => actions.setMissing(false, [left, left + 1])} className="text-white/60 hover:text-white">
                Mark these pages owned
              </button>
              <button type="button" onClick={() => actions.setMissing(true)} className="text-white/60 hover:text-white">
                Whole binder missing
              </button>
            </div>
            {sel && selSlot ? (
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <span className="text-white/50">
                  Pocket {sel.index + 1}, page {sel.page + 1}:
                </span>
                {selSlot.kind === "card" && (
                  <button
                    type="button"
                    onClick={() => actions.toggleMissing(sel.page, sel.index)}
                    className="rounded-md border border-white/15 px-2 py-1 hover:bg-white/10"
                  >
                    {selSlot.missing ? "Mark as owned" : "Mark as missing"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => actions.setSlot(sel.page, sel.index, null)}
                  className="rounded-md border border-red-500/40 px-2 py-1 text-red-300 hover:bg-red-500/10"
                >
                  Remove
                </button>
                <button type="button" onClick={() => setSel(null)} className="px-2 py-1 text-white/50 hover:text-white">
                  Done
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-white/40">
                {sel
                  ? `Pocket ${sel.index + 1} on page ${sel.page + 1} selected: click a card to put it there.`
                  : "Drag cards into pockets, or click a pocket and then click a card. Hover a card: ? marks it missing, × removes it."}
              </p>
            )}
            <div
              className="flex w-full max-w-6xl flex-col gap-3 rounded-2xl p-3 shadow-2xl sm:flex-row sm:p-5"
              style={{ background: binder.cover }}
            >
              <Page binder={binder} page={left} sel={sel} setSel={setSel} actions={actions} priceOf={priceOf} />
              <div className="hidden w-3 rounded-full bg-black/30 sm:block" />
              <Page binder={binder} page={left + 1} sel={sel} setSel={setSel} actions={actions} priceOf={priceOf} />
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-2 text-sm">
              <button
                type="button"
                disabled={left === 0}
                onClick={() => setSpread(left - 2)}
                className="rounded-md border border-white/10 px-3 py-1.5 hover:bg-white/10 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="px-2 text-white/60">
                Spread {left / 2 + 1} / {totalSpreads}
              </span>
              <button
                type="button"
                disabled={left + 2 >= binder.pages.length}
                onClick={() => setSpread(left + 2)}
                className="rounded-md border border-white/10 px-3 py-1.5 hover:bg-white/10 disabled:opacity-30"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => {
                  actions.addSpread();
                  setSpread(binder.pages.length);
                }}
                className="rounded-md border border-white/10 px-3 py-1.5 hover:bg-white/10"
              >
                + Add pages
              </button>
              {totalSpreads > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remove these two pages and everything on them?")) {
                      actions.removeSpread(left);
                      setSpread(Math.max(0, left - 2));
                      setSel(null);
                    }
                  }}
                  className="rounded-md px-3 py-1.5 text-red-400 hover:bg-red-500/10"
                >
                  Remove pages
                </button>
              )}
            </nav>
            <div className="w-full max-w-xs">
              <Trash />
            </div>
          </main>
        </div>
      </div>

      {pdfOpen && <PdfDialog binder={binder} onClose={() => setPdfOpen(false)} />}
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div className="w-24 rotate-3 drop-shadow-2xl">
            <div className="aspect-[63/88]">
              <SlotImage slot={dragging.slot} />
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
