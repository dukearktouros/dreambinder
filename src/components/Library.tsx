"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CardBrief, SetBrief, SetDetail, cardImage, getSet, listSets, searchCards } from "@/lib/tcgdex";
import type { CardSlot, DragData } from "@/lib/types";
import { UploadPanel, type UploadHandlers } from "./UploadPanel";

const toSlot = (c: CardBrief): CardSlot => ({ kind: "card", cardId: c.id, name: c.name, image: c.image! });

function LibraryCard({ card, onPick }: { card: CardBrief; onPick: (c: CardSlot) => void }) {
  const slot = toSlot(card);
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `lib:${card.id}`,
    data: { type: "card", slot } satisfies DragData,
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      title={`${card.name} · ${card.id}`}
      onClick={() => onPick(slot)}
      className={`touch-none rounded-md text-left transition hover:scale-105 ${isDragging ? "opacity-30" : ""}`}
    >
      <img
        src={cardImage(card.image!)}
        alt={card.name}
        loading="lazy"
        draggable={false}
        className="aspect-[63/88] w-full rounded-[4.5%] bg-white/5 object-cover"
      />
      <span className="mt-1 block truncate text-[11px] text-white/60">{card.name}</span>
    </button>
  );
}

function CardGrid({ cards, onPick }: { cards: CardBrief[]; onPick: (c: CardSlot) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
      {cards.map((c) => (
        <LibraryCard key={c.id} card={c} onPick={onPick} />
      ))}
    </div>
  );
}

function useAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: false });
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ loading: true });
    fn(ctrl.signal)
      .then((data) => setState({ data, loading: false }))
      .catch((e) => !ctrl.signal.aborted && setState({ error: String(e.message ?? e), loading: false }));
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Status({ loading, error, empty }: { loading: boolean; error?: string; empty?: boolean }) {
  if (loading) return <p className="py-6 text-center text-sm text-white/50">Loading…</p>;
  if (error) return <p className="py-6 text-center text-sm text-red-400">Couldn&apos;t load cards: {error}</p>;
  if (empty) return <p className="py-6 text-center text-sm text-white/50">No cards found.</p>;
  return null;
}

function SearchTab({ onPick }: { onPick: (c: CardSlot) => void }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const res = useAsync(
    (signal) => (query.length >= 2 ? searchCards(query, signal) : Promise.resolve([])),
    [query],
  );
  return (
    <div className="space-y-3">
      <input
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setQuery(e.target.value.trim()), 350);
        }}
        placeholder="Search a Pokémon or trainer… (e.g. Gengar, Misty)"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
      {query.length < 2 ? (
        <p className="py-6 text-center text-sm text-white/40">Type at least 2 letters.</p>
      ) : (
        <>
          <Status loading={res.loading} error={res.error} empty={res.data?.length === 0} />
          {res.data && <CardGrid cards={res.data} onPick={onPick} />}
        </>
      )}
    </div>
  );
}

function SetsTab({
  onPick,
  onMakeBinder,
}: {
  onPick: (c: CardSlot) => void;
  onMakeBinder: (name: string, cards: CardSlot[]) => void;
}) {
  const [filter, setFilter] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const sets = useAsync((s) => listSets(s), []);
  const detail = useAsync<SetDetail | null>((s) => (openId ? getSet(openId, s) : Promise.resolve(null)), [openId]);
  const shown = useMemo(
    () => (sets.data ?? []).filter((s: SetBrief) => s.name.toLowerCase().includes(filter.toLowerCase())),
    [sets.data, filter],
  );

  if (openId) {
    const set = detail.data;
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setOpenId(null)} className="text-sm text-amber-300 hover:underline">
          ← All sets
        </button>
        <Status loading={detail.loading} error={detail.error} empty={set?.cards.length === 0} />
        {set && (
          <>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{set.name}</h3>
              <button
                type="button"
                onClick={() => onMakeBinder(set.name, set.cards.map(toSlot))}
                className="shrink-0 rounded-md bg-amber-400 px-2 py-1 text-xs font-semibold text-black hover:bg-amber-300"
              >
                Make binder from set
              </button>
            </div>
            <CardGrid cards={set.cards} onPick={onPick} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter sets…"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
      <Status loading={sets.loading} error={sets.error} />
      <ul className="divide-y divide-white/5">
        {shown.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setOpenId(s.id)}
              className="flex w-full items-center gap-3 px-1 py-2 text-left hover:bg-white/5"
            >
              {s.logo ? (
                <img src={`${s.logo}.webp`} alt="" className="h-6 w-14 object-contain" loading="lazy" />
              ) : (
                <span className="h-6 w-14" />
              )}
              <span className="flex-1 truncate text-sm">{s.name}</span>
              <span className="text-xs text-white/40">{s.cardCount.total}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TABS = ["Search", "Sets", "Upload"] as const;

export function Library(
  props: {
    onPick: (c: CardSlot) => void;
    onMakeBinder: (name: string, cards: CardSlot[]) => void;
  } & UploadHandlers,
) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Search");
  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 rounded-lg bg-black/30 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
              tab === t ? "bg-amber-400 text-black" : "text-white/70 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "Search" && <SearchTab onPick={props.onPick} />}
        {tab === "Sets" && <SetsTab onPick={props.onPick} onMakeBinder={props.onMakeBinder} />}
        {tab === "Upload" && <UploadPanel {...props} />}
      </div>
    </div>
  );
}
