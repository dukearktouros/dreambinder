// Client for the free TCGdex API (https://tcgdex.dev). Called from the browser.
const BASE = "https://api.tcgdex.net/v2/en";

export type CardBrief = { id: string; localId: string; name: string; image?: string };
export type SetBrief = {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: { total: number; official: number };
};
export type SetDetail = SetBrief & { cards: CardBrief[]; releaseDate?: string };

export const cardImage = (base: string, quality: "low" | "high" = "low") => `${base}/${quality}.webp`;

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, { signal });
  if (!res.ok) throw new Error(`Card API error (${res.status})`);
  return res.json() as Promise<T>;
}

const withImage = (cards: CardBrief[]) => cards.filter((c) => !!c.image);

/*
 * Online-only sets (Pokémon TCG Pocket) have no physical cards, so we hide them.
 * We ask the API for the "tcgp" series and also match the known set ID pattern
 * (A1, A1a, B2, P-A…) in case the request fails or new sets appear.
 */
const ONLINE_SET_ID = /^(?:[AB]\d+[a-z]?|P-[A-Z])$/;
const ONLINE_CARD_ID = /^(?:[AB]\d+[a-z]?|P-[A-Z])-/;
let onlineSets: Promise<Set<string>> | null = null;

function onlineOnlySetIds() {
  onlineSets ??= get<{ sets: SetBrief[] }>("/series/tcgp")
    .then((s) => new Set(s.sets.map((x) => x.id)))
    .catch(() => new Set<string>());
  return onlineSets;
}

const isOnlineSet = (id: string, known: Set<string>) => ONLINE_SET_ID.test(id) || known.has(id);
const isOnlineCard = (cardId: string, known: Set<string>) =>
  ONLINE_CARD_ID.test(cardId) || [...known].some((id) => cardId.startsWith(id + "-"));

/** False for cards from online-only sets. */
export async function isPhysicalCard(cardId: string) {
  return !isOnlineCard(cardId, await onlineOnlySetIds());
}

/** Search by card name — covers Pokémon and trainers ("Pikachu", "Misty", "Charizard ex"). */
export async function searchCards(name: string, signal?: AbortSignal) {
  const [cards, online] = await Promise.all([
    get<CardBrief[]>(`/cards?name=${encodeURIComponent(name)}`, signal),
    onlineOnlySetIds(),
  ]);
  return withImage(cards)
    .filter((c) => !isOnlineCard(c.id, online))
    .slice(0, 200);
}

let allSets: Promise<SetBrief[]> | null = null;
export async function listSets() {
  allSets ??= Promise.all([get<SetBrief[]>("/sets"), onlineOnlySetIds()])
    .then(([sets, online]) => sets.filter((s) => !isOnlineSet(s.id, online)).reverse()) // newest first
    .catch((e) => {
      allSets = null;
      throw e;
    });
  return allSets;
}

type TcgPlayerVariant = { marketPrice?: number; midPrice?: number; lowPrice?: number };
export type CardDetail = CardBrief & {
  rarity?: string;
  set: { id: string; name: string };
  pricing?: {
    tcgplayer?: ({ unit: "USD"; updated?: string } & Record<string, TcgPlayerVariant | string>) | null;
    cardmarket?: { unit: "EUR"; trend?: number; avg?: number; avg30?: number; "trend-holo"?: number } | null;
  };
};

export const getCard = (id: string, signal?: AbortSignal) =>
  get<CardDetail>(`/cards/${encodeURIComponent(id)}`, signal);

export async function getSet(id: string, signal?: AbortSignal) {
  const set = await get<SetDetail>(`/sets/${encodeURIComponent(id)}`, signal);
  return { ...set, cards: withImage(set.cards ?? []) };
}
