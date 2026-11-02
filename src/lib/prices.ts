"use client";
// Set name, number and market price for each card, fetched on demand and cached for a day.
import { useEffect, useState } from "react";
import { getCard, type CardDetail } from "./tcgdex";

export type Currency = "USD" | "EUR";
export type CardInfo = {
  setName: string;
  number: string;
  rarity?: string;
  price?: number;
  currency?: Currency;
  fetchedAt: number;
};

const KEY = "dreambinder:cardinfo:v1";
const TTL = 24 * 60 * 60 * 1000;
const CONCURRENCY = 6;

let infos: Record<string, CardInfo> = {};
try {
  if (typeof localStorage !== "undefined") infos = JSON.parse(localStorage.getItem(KEY) ?? "{}");
} catch {}

const listeners = new Set<() => void>();
const pending = new Map<string, Promise<void>>();
const queue: (() => void)[] = [];
let running = 0;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(infos));
  } catch {}
}

/** TCGplayer market price (USD) first, Cardmarket trend (EUR) as a fallback. */
export function bestPrice(p: CardDetail["pricing"]): { price: number; currency: Currency } | undefined {
  const tcg = p?.tcgplayer;
  if (tcg) {
    const keys = ["normal", "holofoil", "reverse-holofoil", ...Object.keys(tcg)];
    for (const k of keys) {
      const v = tcg[k];
      if (v && typeof v === "object") {
        const price = v.marketPrice ?? v.midPrice ?? v.lowPrice;
        if (price) return { price, currency: "USD" };
      }
    }
  }
  const cm = p?.cardmarket;
  const eur = cm?.trend ?? cm?.avg ?? cm?.avg30 ?? cm?.["trend-holo"];
  if (eur) return { price: eur, currency: "EUR" };
  return undefined;
}

function runNext() {
  while (running < CONCURRENCY && queue.length) {
    running++;
    queue.shift()!();
  }
}

function fetchInfo(id: string): Promise<void> {
  const fresh = infos[id] && Date.now() - infos[id].fetchedAt < TTL;
  if (fresh) return Promise.resolve();
  if (pending.has(id)) return pending.get(id)!;
  const p = new Promise<void>((resolve) => {
    queue.push(async () => {
      try {
        const card = await getCard(id);
        const price = bestPrice(card.pricing);
        infos = {
          ...infos,
          [id]: {
            setName: card.set?.name ?? "",
            number: card.localId,
            rarity: card.rarity,
            price: price?.price,
            currency: price?.currency,
            fetchedAt: Date.now(),
          },
        };
        persist();
        listeners.forEach((l) => l());
      } catch {
        // leave it out; we'll try again next time
      } finally {
        pending.delete(id);
        running--;
        resolve();
        runNext();
      }
    });
    runNext();
  });
  pending.set(id, p);
  return p;
}

/** Load info for many cards (used before exporting a PDF). */
export async function loadInfos(ids: string[]) {
  await Promise.all([...new Set(ids)].map(fetchInfo));
  return infos;
}

/** Live map of card info for the given card IDs; fetches what's missing. */
export function useCardInfo(ids: string[]) {
  const [snapshot, setSnapshot] = useState(infos);
  const key = [...new Set(ids)].sort().join(",");
  useEffect(() => {
    const update = () => setSnapshot(infos);
    listeners.add(update);
    update();
    key.split(",").filter(Boolean).forEach(fetchInfo);
    return () => {
      listeners.delete(update);
    };
  }, [key]);
  return snapshot;
}

export function formatPrice(value: number, currency: Currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

/** Sum prices per currency, e.g. "$120.50" or "$120.50 + €8.00". */
export function formatTotal(items: (CardInfo | undefined)[]) {
  const sums: Partial<Record<Currency, number>> = {};
  for (const i of items) if (i?.price && i.currency) sums[i.currency] = (sums[i.currency] ?? 0) + i.price;
  const parts = (Object.keys(sums) as Currency[]).map((c) => formatPrice(sums[c]!, c));
  return parts.length ? parts.join(" + ") : formatPrice(0);
}
