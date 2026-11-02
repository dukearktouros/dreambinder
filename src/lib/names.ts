// Name suggestions for the search box (Pokémon and trainers), built from the full card list.
// Downloaded once and kept in the browser for a week.
import { createStore, get as idbGet, set as idbSet } from "idb-keyval";
import { get, isPhysicalCard, type CardBrief } from "./tcgdex";

const TTL = 7 * 24 * 60 * 60 * 1000;
const store = typeof indexedDB !== "undefined" ? createStore("dreambinder-cache", "names") : undefined;
let names: Promise<string[]> | null = null;

async function download() {
  const cards = await get<CardBrief[]>("/cards");
  const physical = await Promise.all(cards.map(async (c) => ((await isPhysicalCard(c.id)) ? c.name : null)));
  return [...new Set(physical.filter((n): n is string => !!n))].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

export function loadNames() {
  names ??= (async () => {
    try {
      const cached = store ? await idbGet<{ at: number; names: string[] }>("v1", store) : undefined;
      if (cached && Date.now() - cached.at < TTL) return cached.names;
    } catch {}
    const list = await download();
    if (store) idbSet("v1", { at: Date.now(), names: list }, store).catch(() => {});
    return list;
  })().catch(() => {
    names = null; // try again next time
    return [];
  });
  return names;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Best matches: names starting with the text, then a word starting with it, then containing it. */
export function suggest(all: string[], text: string, limit = 8) {
  const q = norm(text.trim());
  if (q.length < 2) return [];
  const starts: string[] = [];
  const word: string[] = [];
  const contains: string[] = [];
  for (const name of all) {
    const n = norm(name);
    if (n.startsWith(q)) starts.push(name);
    else if (n.includes(" " + q) || n.includes("-" + q)) word.push(name);
    else if (n.includes(q)) contains.push(name);
    if (starts.length >= limit) break;
  }
  return [...starts, ...word, ...contains].slice(0, limit);
}
