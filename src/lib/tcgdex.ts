// Client for the free TCGdex API (https://tcgdex.dev). Called from the browser.
const API = "https://api.tcgdex.net/v2";

/** Card languages we offer. Asian cards come from TCGdex's Japanese / Chinese databases. */
export const LANGS = [
  { id: "en", label: "English" },
  { id: "ja", label: "Japanese" },
  { id: "zh-tw", label: "Chinese (Traditional)" },
  { id: "zh-cn", label: "Chinese (Simplified)" },
] as const;
export type Lang = (typeof LANGS)[number]["id"];

export type CardBrief = { id: string; localId: string; name: string; image?: string; lang?: Lang };
export type SetBrief = {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount: { total: number; official: number };
};
export type SetDetail = SetBrief & { cards: CardBrief[]; releaseDate?: string };

const PTCG = "https://images.pokemontcg.io/";

/**
 * Image URL for a card. `base` is a TCGdex image base (we add /low.webp or /high.webp)
 * or, for cards TCGdex has no picture for, a pokemontcg.io base (we add .png / _hires.png).
 */
export function cardImage(base: string, quality: "low" | "high" = "low") {
  if (base.startsWith(PTCG)) return `${base}${quality === "high" ? "_hires" : ""}.png`;
  return `${base}/${quality}.webp`;
}

/**
 * Backup picture from pokemontcg.io for English cards TCGdex has no image for
 * (e.g. some Brilliant Stars cards). Their set IDs are written a bit differently.
 */
function fallbackImage(card: CardBrief): string | undefined {
  const setId = card.id.slice(0, card.id.length - card.localId.length - 1);
  if (!setId) return undefined;
  const set = setId
    .replace(/^sv0?(\d+)\.5/, "sv$1pt5")
    .replace(/^sv0(\d)/, "sv$1")
    .replace(/^swsh12\.5/, "swsh12pt5")
    .replace(/\.5/, "5");
  const num = /^\d+$/.test(card.localId) ? String(Number(card.localId)) : card.localId;
  return `${PTCG}${set}/${num}`;
}

/** Give every English card a picture (backup source when TCGdex has none) and tag its language. */
function withImages(cards: CardBrief[], lang: Lang) {
  return cards
    .map((c) => ({ ...c, lang, image: c.image ?? (lang === "en" ? fallbackImage(c) : undefined) }))
    .filter((c) => !!c.image);
}

export async function get<T>(path: string, signal?: AbortSignal, lang: Lang = "en"): Promise<T> {
  const res = await fetch(`${API}/${lang}${path}`, { signal });
  if (!res.ok) throw new Error(`Card API error (${res.status})`);
  return res.json() as Promise<T>;
}

/*
 * Online-only sets (Pokémon TCG Pocket) have no physical cards, so we hide them.
 * We ask the API for the "tcgp" series and also match the known set ID pattern
 * (A1, A1a, B2, P-A…) in case the request fails or new sets appear.
 */
const ONLINE_SET_ID = /^(?:[AB]\d+[a-z]?|P-[A-Z])$/;
const ONLINE_CARD_ID = /^(?:[AB]\d+[a-z]?|P-[A-Z])-/;
const onlineSets = new Map<Lang, Promise<Set<string>>>();

function onlineOnlySetIds(lang: Lang = "en") {
  if (!onlineSets.has(lang))
    onlineSets.set(
      lang,
      get<{ sets: SetBrief[] }>("/series/tcgp", undefined, lang)
        .then((s) => new Set(s.sets.map((x) => x.id)))
        .catch(() => new Set<string>()),
    );
  return onlineSets.get(lang)!;
}

const isOnlineSet = (id: string, known: Set<string>) => ONLINE_SET_ID.test(id) || known.has(id);
const isOnlineCard = (cardId: string, known: Set<string>) =>
  ONLINE_CARD_ID.test(cardId) || [...known].some((id) => cardId.startsWith(id + "-"));

/** False for cards from online-only sets. */
export async function isPhysicalCard(cardId: string, lang: Lang = "en") {
  return !isOnlineCard(cardId, await onlineOnlySetIds(lang));
}

type TcgPlayerVariant = { marketPrice?: number; midPrice?: number; lowPrice?: number };
export type CardDetail = CardBrief & {
  rarity?: string;
  dexId?: number[];
  set: { id: string; name: string };
  pricing?: {
    tcgplayer?: ({ unit: "USD"; updated?: string } & Record<string, TcgPlayerVariant | string>) | null;
    cardmarket?: { unit: "EUR"; trend?: number; avg?: number; avg30?: number; "trend-holo"?: number } | null;
  };
};

export const getCard = (id: string, signal?: AbortSignal, lang: Lang = "en") =>
  get<CardDetail>(`/cards/${encodeURIComponent(id)}`, signal, lang);

/** Pokédex numbers for an English name, so "Pikachu" also finds Japanese / Chinese Pikachu cards. */
const dexCache = new Map<string, Promise<number[]>>();
function dexIdsFor(name: string) {
  const key = name.toLowerCase();
  if (!dexCache.has(key))
    dexCache.set(
      key,
      (async () => {
        const en = await get<CardBrief[]>(`/cards?name=${encodeURIComponent(name)}`);
        // look at a few distinct names, best matches first ("Pikachu" before "Detective Pikachu")
        const names = [...new Set(en.map((c) => c.name))]
          .sort((a, b) => Number(!a.toLowerCase().startsWith(key)) - Number(!b.toLowerCase().startsWith(key)) || a.length - b.length)
          .slice(0, 4);
        const ids = await Promise.all(
          names.map((n) => getCard(en.find((c) => c.name === n)!.id).then((d) => d.dexId ?? [], () => [])),
        );
        return [...new Set(ids.flat())];
      })().catch(() => []),
    );
  return dexCache.get(key)!;
}

/** Search by card name — covers Pokémon and trainers ("Pikachu", "Misty", "Charizard ex"). */
export async function searchCards(name: string, lang: Lang = "en", signal?: AbortSignal) {
  const online = await onlineOnlySetIds(lang);
  let cards: CardBrief[];
  if (lang === "en") {
    cards = await get<CardBrief[]>(`/cards?name=${encodeURIComponent(name)}`, signal);
  } else {
    // Type in English or in the card's language. English names are matched by Pokédex number.
    const latin = /^[\p{Script=Latin}\d\s'.&:-]+$/u.test(name);
    const [direct, byDex] = await Promise.all([
      get<CardBrief[]>(`/cards?name=${encodeURIComponent(name)}`, signal, lang).catch(() => []),
      latin
        ? dexIdsFor(name).then((ids) =>
            Promise.all(
              ids.map((id) =>
                get<{ cards: CardBrief[] }>(`/dex-ids/${id}`, signal, lang).then((r) => r.cards ?? [], () => []),
              ),
            ).then((lists) => lists.flat()),
          )
        : Promise.resolve([] as CardBrief[]),
    ]);
    const seen = new Set<string>();
    cards = [...direct, ...byDex].filter((c) => !seen.has(c.id) && seen.add(c.id));
  }
  return withImages(cards, lang)
    .filter((c) => !isOnlineCard(c.id, online))
    .slice(0, 300);
}

const allSets = new Map<Lang, Promise<SetBrief[]>>();
export async function listSets(lang: Lang = "en") {
  if (!allSets.has(lang))
    allSets.set(
      lang,
      Promise.all([get<SetBrief[]>("/sets", undefined, lang), onlineOnlySetIds(lang)])
        .then(([sets, online]) => sets.filter((s) => !isOnlineSet(s.id, online)).reverse()) // newest first
        .catch((e) => {
          allSets.delete(lang);
          throw e;
        }),
    );
  return allSets.get(lang)!;
}

export async function getSet(id: string, lang: Lang = "en", signal?: AbortSignal) {
  const set = await get<SetDetail>(`/sets/${encodeURIComponent(id)}`, signal, lang);
  return { ...set, cards: withImages(set.cards ?? [], lang) };
}
