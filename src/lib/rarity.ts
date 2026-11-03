// "Chase card" ranking: most wanted cards (SIRs, gold/hyper rares, illustration rares, alt arts) first.
// Rarity isn't in search results, so we ask the API for the chase rarities separately
// (one small request per tier) and fall back to "secret" card numbers for alt arts.
import { get, listSets, type CardBrief, type Lang } from "./tcgdex";

const TIERS: { tier: number; label: string; rarities: string[] }[] = [
  { tier: 6, label: "SIR", rarities: ["Special illustration rare", "Mega Hyper Rare"] },
  { tier: 5, label: "Hyper", rarities: ["Hyper rare", "Secret Rare", "Black White Rare"] },
  { tier: 4, label: "IR", rarities: ["Illustration rare", "Shiny Ultra Rare", "Character Super Rare", "Mega Attack Rare"] },
  {
    tier: 3,
    label: "Ultra",
    rarities: [
      "Ultra Rare", "Full Art Trainer", "Holo Rare VMAX", "Holo Rare VSTAR", "Shiny rare VMAX",
      "Shiny rare V", "Amazing Rare", "Character Rare", "ACE SPEC Rare", "Rare Holo LV.X", "LEGEND",
    ],
  },
];

export type Chase = { tier: number; label: string };

/** Gallery / shiny vault numbering (TG01, GG35, SV107, RC32…) marks special cards. */
const SPECIAL_PREFIX = /^(TG|GG|SV|RC|SWSH|SM|XY)\d/i;

const officialCounts = new Map<Lang, Promise<Map<string, number>>>();
function setOfficialCounts(lang: Lang) {
  if (!officialCounts.has(lang))
    officialCounts.set(
      lang,
      listSets(lang)
        .then((sets) => new Map(sets.map((s) => [s.id, s.cardCount.official])))
        .catch(() => new Map()),
    );
  return officialCounts.get(lang)!;
}

/** Card numbered above its set's official count = secret rare (where alt arts live). */
function secretNumber(card: CardBrief, counts: Map<string, number>) {
  if (SPECIAL_PREFIX.test(card.localId)) return true;
  const setId = card.id.slice(0, card.id.length - card.localId.length - 1);
  const official = counts.get(setId);
  const n = Number(card.localId);
  return !!official && Number.isFinite(n) && n > official;
}

/**
 * Rank cards for a query.
 * @param filter API filter for the same cards, e.g. `name=pikachu` or `set.id=eq:sv03.5`
 */
export async function chaseRanks(cards: CardBrief[], filter: string, lang: Lang = "en", signal?: AbortSignal) {
  // Rarity names are English-only in the database, so other languages use card numbers alone.
  const tiers = lang === "en" ? TIERS : [];
  const [counts, ...tierCards] = await Promise.all([
    setOfficialCounts(lang),
    ...tiers.map((t) =>
      get<CardBrief[]>(`/cards?${filter}&rarity=${encodeURIComponent("eq:" + t.rarities.join("|"))}`, signal).catch(
        () => [] as CardBrief[],
      ),
    ),
  ]);
  const ranks = new Map<string, Chase>();
  tiers.forEach((t, i) => tierCards[i].forEach((c) => !ranks.has(c.id) && ranks.set(c.id, { tier: t.tier, label: t.label })));
  for (const c of cards) {
    const r = ranks.get(c.id);
    if (secretNumber(c, counts) && (!r || r.tier < 4)) ranks.set(c.id, { tier: Math.max(4, r?.tier ?? 0), label: r?.label === "Ultra" || !r ? "Alt/Secret" : r.label });
  }
  return ranks;
}

/** Chase cards first (best tier first), newest first within a tier. */
export function sortByChase(cards: CardBrief[], ranks: Map<string, Chase>) {
  return cards
    .map((c, i) => ({ c, i, t: ranks.get(c.id)?.tier ?? 0 }))
    .sort((a, b) => b.t - a.t || b.i - a.i)
    .map((x) => x.c);
}
