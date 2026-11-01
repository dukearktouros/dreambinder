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

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(BASE + path, { signal });
  if (!res.ok) throw new Error(`Card API error (${res.status})`);
  return res.json() as Promise<T>;
}

const withImage = (cards: CardBrief[]) => cards.filter((c) => !!c.image);

/** Search by card name — covers Pokémon and trainers ("Pikachu", "Misty", "Charizard ex"). */
export async function searchCards(name: string, signal?: AbortSignal) {
  const cards = await get<CardBrief[]>(`/cards?name=${encodeURIComponent(name)}`, signal);
  return withImage(cards).slice(0, 200);
}

export async function listSets(signal?: AbortSignal) {
  const sets = await get<SetBrief[]>("/sets", signal);
  return sets.reverse(); // newest first
}

export async function getSet(id: string, signal?: AbortSignal) {
  const set = await get<SetDetail>(`/sets/${encodeURIComponent(id)}`, signal);
  return { ...set, cards: withImage(set.cards ?? []) };
}
