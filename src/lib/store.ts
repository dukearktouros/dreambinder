"use client";
// Binder state, saved to localStorage (custom images live in IndexedDB, see image.ts).
import { useCallback, useEffect, useState } from "react";
import { Binder, CardSlot, PageArt, Slot } from "./types";
import { collectGarbage, newId } from "./image";

const KEY = "dreambinder:v1";
type State = { binders: Binder[]; activeId: string };

const emptyPage = (size: number): Slot[] => Array(size).fill(null);

export function makeBinder(name = "My Binder", rows = 3, cols = 3): Binder {
  return {
    id: newId(),
    name,
    rows,
    cols,
    cover: "#1e3a8a",
    pages: [emptyPage(rows * cols), emptyPage(rows * cols)],
    updatedAt: Date.now(),
  };
}

/** Rebuild pages from a flat list of slots; always keeps an even page count (whole spreads). */
function paginate(flat: Slot[], size: number, minPages = 2): Slot[][] {
  let end = flat.length;
  while (end > 0 && flat[end - 1] === null) end--;
  let count = Math.max(minPages, Math.ceil(end / size));
  if (count % 2) count++;
  return Array.from({ length: count }, (_, p) =>
    Array.from({ length: size }, (_, i) => flat[p * size + i] ?? null),
  );
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.binders?.length) return s;
    }
  } catch {}
  const b = makeBinder();
  return { binders: [b], activeId: b.id };
}

export function useBinders() {
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    const s = load();
    setState(s);
    const used = new Set<string>();
    s.binders.forEach((b) => {
      b.pages.flat().forEach((sl) => sl?.kind === "custom" && used.add(sl.imageId));
      b.art?.forEach((a) => a?.imageId && used.add(a.imageId));
    });
    collectGarbage(used).catch(() => {});
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      console.warn("Could not save binder (storage full?)");
    }
  }, [state]);

  const binder = state?.binders.find((b) => b.id === state.activeId) ?? state?.binders[0] ?? null;

  const update = useCallback((fn: (b: Binder) => Binder) => {
    setState((s) =>
      s && {
        ...s,
        binders: s.binders.map((b) => (b.id === s.activeId ? { ...fn(b), updatedAt: Date.now() } : b)),
      },
    );
  }, []);

  const withPages = (b: Binder, upTo: number) => {
    const pages = b.pages.map((p) => [...p]);
    while (pages.length <= upTo) pages.push(emptyPage(b.rows * b.cols), emptyPage(b.rows * b.cols));
    return pages;
  };

  const actions = {
    setSlot: (page: number, index: number, slot: Slot) =>
      update((b) => {
        const pages = withPages(b, page);
        pages[page][index] = slot;
        return { ...b, pages };
      }),

    /** Swap two pockets (moving onto an empty pocket = move). */
    moveSlot: (fromPage: number, fromIndex: number, toPage: number, toIndex: number) =>
      update((b) => {
        const pages = withPages(b, Math.max(fromPage, toPage));
        const tmp = pages[toPage][toIndex];
        pages[toPage][toIndex] = pages[fromPage][fromIndex];
        pages[fromPage][fromIndex] = tmp;
        return { ...b, pages };
      }),

    /** Put a list of slots on one page, filling it in order. */
    fillPage: (page: number, slots: Slot[]) =>
      update((b) => {
        const pages = withPages(b, page);
        pages[page] = Array.from({ length: b.rows * b.cols }, (_, i) => slots[i] ?? null);
        return { ...b, pages };
      }),

    /**
     * Place a block of slots (blockRows × blockCols, reading order) starting at a pocket.
     * The block is moved left/up if it would run off the page.
     */
    placeBlock: (page: number, start: number, blockRows: number, blockCols: number, slots: Slot[]) =>
      update((b) => {
        const pages = withPages(b, page);
        const c0 = Math.max(0, Math.min(start % b.cols, b.cols - blockCols));
        const r0 = Math.max(0, Math.min(Math.floor(start / b.cols), b.rows - blockRows));
        for (let r = 0; r < blockRows; r++)
          for (let c = 0; c < blockCols; c++) pages[page][(r0 + r) * b.cols + c0 + c] = slots[r * blockCols + c] ?? null;
        return { ...b, pages };
      }),

    setGrid: (rows: number, cols: number) =>
      update((b) => ({ ...b, rows, cols, pages: paginate(b.pages.flat(), rows * cols) })),

    addSpread: () =>
      update((b) => ({ ...b, pages: [...b.pages, emptyPage(b.rows * b.cols), emptyPage(b.rows * b.cols)] })),

    removeSpread: (firstPage: number) =>
      update((b) => {
        if (b.pages.length <= 2) return b;
        const keep = (_: unknown, i: number) => i !== firstPage && i !== firstPage + 1;
        return { ...b, pages: b.pages.filter(keep), art: b.art?.filter(keep) };
      }),

    /** Set, change or remove (null) a page's background art. */
    setArt: (page: number, art: PageArt | null) =>
      update((b) => {
        const list = [...(b.art ?? [])];
        while (list.length <= page) list.push(null);
        list[page] = art;
        return { ...b, art: list };
      }),

    adjustArt: (page: number, change: Partial<Pick<PageArt, "zoom" | "x" | "y" | "blur">>) =>
      update((b) => {
        const cur = b.art?.[page];
        if (!cur) return b;
        const list = [...b.art!];
        list[page] = { ...cur, ...change };
        return { ...b, art: list };
      }),

    /** Remove the art from one pocket, or bring it back. */
    toggleArtPocket: (page: number, index: number) =>
      update((b) => {
        const cur = b.art?.[page];
        if (!cur) return b;
        const hidden = new Set(cur.hidden ?? []);
        if (hidden.has(index)) hidden.delete(index);
        else hidden.add(index);
        const list = [...b.art!];
        list[page] = { ...cur, hidden: [...hidden] };
        return { ...b, art: list };
      }),

    toggleFlip: (page: number, index: number) =>
      update((b) => {
        const pages = withPages(b, page);
        const s = pages[page][index];
        if (s) pages[page][index] = { ...s, flipped: !s.flipped };
        return { ...b, pages };
      }),

    /** Flip a card between owned and missing. */
    toggleMissing: (page: number, index: number) =>
      update((b) => {
        const pages = withPages(b, page);
        const s = pages[page][index];
        if (s?.kind === "card") pages[page][index] = { ...s, missing: !s.missing };
        return { ...b, pages };
      }),

    /** Mark every card on the given pages (or the whole binder) as missing or owned. */
    setMissing: (missing: boolean, onlyPages?: number[]) =>
      update((b) => ({
        ...b,
        pages: b.pages.map((p, i) =>
          onlyPages && !onlyPages.includes(i) ? p : p.map((s) => (s?.kind === "card" ? { ...s, missing } : s)),
        ),
      })),

    rename: (name: string) => update((b) => ({ ...b, name })),
    setCover: (cover: string) => update((b) => ({ ...b, cover })),

    newBinder: (name?: string, cards?: CardSlot[]) =>
      setState((s) => {
        if (!s) return s;
        const b = makeBinder(name, binder?.rows ?? 3, binder?.cols ?? 3);
        if (cards) b.pages = paginate(cards, b.rows * b.cols);
        return { binders: [...s.binders, b], activeId: b.id };
      }),

    selectBinder: (id: string) => setState((s) => s && { ...s, activeId: id }),

    deleteBinder: (id: string) =>
      setState((s) => {
        if (!s) return s;
        const rest = s.binders.filter((b) => b.id !== id);
        if (!rest.length) rest.push(makeBinder());
        return { binders: rest, activeId: rest[0].id };
      }),
  };

  return { ready: !!state, binders: state?.binders ?? [], binder, actions };
}

export type BinderActions = ReturnType<typeof useBinders>["actions"];
