"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CardBrief, SetBrief, SetDetail, cardImage, getSet, listSets, searchCards } from "@/lib/tcgdex";
import { chaseRanks, sortByChase, type Chase } from "@/lib/rarity";
import { loadNames, suggest } from "@/lib/names";
import type { CardSlot, DragData } from "@/lib/types";
import { UploadPanel, type UploadHandlers } from "./UploadPanel";

const toSlot = (c: CardBrief): CardSlot => ({ kind: "card", cardId: c.id, name: c.name, image: c.image! });

const BADGE: Record<number, string> = {
  6: "bg-fuchsia-500 text-white",
  5: "bg-amber-400 text-black",
  4: "bg-sky-500 text-white",
  3: "bg-zinc-200 text-black",
};

function LibraryCard({ card, chase, onPick }: { card: CardBrief; chase?: Chase; onPick: (c: CardSlot) => void }) {
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
      className={`relative touch-none rounded-md text-left transition hover:scale-105 ${isDragging ? "opacity-30" : ""}`}
    >
      <img
        src={cardImage(card.image!)}
        alt={card.name}
        loading="lazy"
        draggable={false}
        className="aspect-[63/88] w-full rounded-[4.5%] bg-white/5 object-cover"
      />
      {chase && (
        <span
          className={`absolute left-1 top-1 rounded px-1 text-[9px] font-black uppercase shadow ${BADGE[chase.tier] ?? BADGE[3]}`}
        >
          {chase.label}
        </span>
      )}
      <span className="mt-1 block truncate text-[11px] text-white/60">{card.name}</span>
    </button>
  );
}

const PREF = "dreambinder:chaseFirst";

/** Ranks cards by rarity and (optionally) puts the chase cards first. */
function ChaseGrid({ cards, filter, onPick }: { cards: CardBrief[]; filter: string; onPick: (c: CardSlot) => void }) {
  const [chaseFirst, setChaseFirst] = useState(true);
  const [ranks, setRanks] = useState<Map<string, Chase>>(new Map());
  useEffect(() => {
    try {
      setChaseFirst(localStorage.getItem(PREF) !== "0");
    } catch {}
  }, []);
  useEffect(() => {
    const ctrl = new AbortController();
    setRanks(new Map());
    chaseRanks(cards, filter, ctrl.signal).then((r) => !ctrl.signal.aborted && setRanks(r)).catch(() => {});
    return () => ctrl.abort();
  }, [cards, filter]);
  const shown = useMemo(() => (chaseFirst ? sortByChase(cards, ranks) : cards), [cards, ranks, chaseFirst]);
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-white/60">
        <input
          type="checkbox"
          checked={chaseFirst}
          onChange={(e) => {
            setChaseFirst(e.target.checked);
            try {
              localStorage.setItem(PREF, e.target.checked ? "1" : "0");
            } catch {}
          }}
        />
        Chase cards first (SIR, gold, IR, alt arts)
      </label>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {shown.map((c) => (
          <LibraryCard key={c.id} card={c} chase={ranks.get(c.id)} onPick={onPick} />
        ))}
      </div>
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

/** Search box with Pokémon / trainer name suggestions. */
function NameInput({ onSearch }: { onSearch: (q: string) => void }) {
  const [input, setInput] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const options = useMemo(() => suggest(names, input), [names, input]);

  const pick = (q: string) => {
    setInput(q);
    setOpen(false);
    setActive(-1);
    clearTimeout(timer.current);
    onSearch(q.trim());
  };

  return (
    <div className="relative">
      <input
        value={input}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls="name-suggestions"
        aria-autocomplete="list"
        onFocus={() => {
          loadNames().then(setNames);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setInput(e.target.value);
          setOpen(true);
          setActive(-1);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onSearch(e.target.value.trim()), 450);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, -1));
          } else if (e.key === "Enter") {
            pick(active >= 0 && options[active] ? options[active] : input);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search a Pokémon or trainer… (e.g. Gengar, Misty)"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
      {open && options.length > 0 && (
        <ul
          id="name-suggestions"
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-zinc-900 text-sm shadow-xl"
        >
          {options.map((name, i) => (
            <li key={name} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(name)}
                className={`w-full px-3 py-1.5 text-left hover:bg-white/10 ${i === active ? "bg-white/10" : ""}`}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SearchTab({ onPick }: { onPick: (c: CardSlot) => void }) {
  const [query, setQuery] = useState("");
  const res = useAsync(
    (signal) => (query.length >= 2 ? searchCards(query, signal) : Promise.resolve([])),
    [query],
  );
  return (
    <div className="space-y-3">
      <NameInput onSearch={setQuery} />
      {query.length < 2 ? (
        <p className="py-6 text-center text-sm text-white/40">Type at least 2 letters.</p>
      ) : (
        <>
          <Status loading={res.loading} error={res.error} empty={res.data?.length === 0} />
          {res.data && res.data.length > 0 && (
            <ChaseGrid cards={res.data} filter={`name=${encodeURIComponent(query)}`} onPick={onPick} />
          )}
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
  const sets = useAsync(() => listSets(), []);
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
            <ChaseGrid cards={set.cards} filter={`set.id=${encodeURIComponent("eq:" + set.id)}`} onPick={onPick} />
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
  const [setsOpened, setSetsOpened] = useState(false);
  useEffect(() => {
    if (tab === "Sets") setSetsOpened(true);
  }, [tab]);
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
        {/* Tabs stay mounted so your search and open set are kept when switching */}
        <div hidden={tab !== "Search"}>
          <SearchTab onPick={props.onPick} />
        </div>
        <div hidden={tab !== "Sets"}>{tab === "Sets" || setsOpened ? <SetsTab onPick={props.onPick} onMakeBinder={props.onMakeBinder} /> : null}</div>
        <div hidden={tab !== "Upload"}>
          <UploadPanel {...props} />
        </div>
      </div>
    </div>
  );
}
