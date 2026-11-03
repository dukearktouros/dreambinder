// Sharing binders without a server:
//  - share codes ("DB1.…"): a compressed text version of the layout, easy to paste in Discord
//    or post to the community gallery. Uploaded images can't fit in a code, so they're left out.
//  - binder files (.dreambinder.json): everything, including uploaded images.
import type { Binder, PageArt, Slot } from "./types";
import { loadImage, newId, saveImage } from "./image";

type SharedSlot = [cardId: string, name: string, image: string, lang?: string, flags?: number] | 0;
type SharedBinder = {
  n: string;
  r: number;
  c: number;
  cv: string;
  p: SharedSlot[][];
  a?: (Omit<PageArt, "imageId"> | 0)[];
};

const PREFIX = "DB1.";

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

const toB64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0));
};

/** Share code for a binder, plus how many uploaded images had to be left out. */
export async function binderToCode(b: Binder) {
  let skipped = 0;
  const data: SharedBinder = {
    n: b.name,
    r: b.rows,
    c: b.cols,
    cv: b.cover,
    p: b.pages.map((page) =>
      page.map((s): SharedSlot => {
        if (!s) return 0;
        if (s.kind === "custom") {
          skipped++;
          return 0;
        }
        const flags = (s.missing ? 1 : 0) | (s.flipped ? 2 : 0);
        return flags || s.lang ? [s.cardId, s.name, s.image, s.lang ?? "", flags] : [s.cardId, s.name, s.image];
      }),
    ),
  };
  if (b.art?.some(Boolean)) {
    data.a = b.art.map((a) => {
      if (!a) return 0;
      if (!a.src) {
        skipped++;
        return 0;
      }
      const { imageId: _drop, ...rest } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
      return rest;
    });
  }
  // trim empty pages at the end (keep at least one spread)
  while (data.p.length > 2 && data.p[data.p.length - 1].every((s) => !s)) data.p.pop();
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream("deflate-raw"));
  return { code: PREFIX + toB64(bytes), skipped };
}

/** Find and decode a share code inside any text (a Discord message, a gallery post…). */
export async function codeToBinder(text: string): Promise<Binder> {
  const m = text.match(/DB1\.[A-Za-z0-9_-]+/);
  if (!m) throw new Error("No DreamBinder share code found.");
  let data: SharedBinder;
  try {
    const json = await pipe(fromB64(m[0].slice(PREFIX.length)), new DecompressionStream("deflate-raw"));
    data = JSON.parse(new TextDecoder().decode(json));
  } catch {
    throw new Error("That share code is damaged or incomplete.");
  }
  const size = data.r * data.c;
  const pages: Slot[][] = data.p.map((page) =>
    Array.from({ length: size }, (_, i) => {
      const s = page[i];
      if (!s) return null;
      const [cardId, name, image, lang, flags = 0] = s;
      return {
        kind: "card",
        cardId,
        name,
        image,
        ...(lang ? { lang: lang as never } : {}),
        ...(flags & 1 ? { missing: true } : {}),
        ...(flags & 2 ? { flipped: true } : {}),
      };
    }),
  );
  if (pages.length % 2) pages.push(Array(size).fill(null));
  return {
    id: newId(),
    name: data.n,
    rows: data.r,
    cols: data.c,
    cover: data.cv,
    pages,
    art: data.a?.map((a) => (a ? (a as PageArt) : null)),
    updatedAt: Date.now(),
  };
}

/** Full binder file including uploaded images. */
export async function binderToFile(b: Binder) {
  const ids = new Set<string>();
  b.pages.flat().forEach((s) => s?.kind === "custom" && ids.add(s.imageId));
  b.art?.forEach((a) => a?.imageId && ids.add(a.imageId));
  const images: Record<string, string> = {};
  for (const id of ids) {
    const url = await loadImage(id);
    if (url) images[id] = url;
  }
  const blob = new Blob([JSON.stringify({ format: "dreambinder", version: 1, binder: b, images })], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(b.name || "binder").replace(/[^\w-]+/g, "_")}.dreambinder.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function fileToBinder(file: File): Promise<Binder> {
  let data: { format?: string; binder?: Binder; images?: Record<string, string> };
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That isn't a DreamBinder file.");
  }
  if (data.format !== "dreambinder" || !data.binder) throw new Error("That isn't a DreamBinder file.");
  // store the images under new IDs and point the binder at them
  const map = new Map<string, string>();
  for (const [oldId, url] of Object.entries(data.images ?? {})) {
    if (typeof url === "string" && url.startsWith("data:image/")) map.set(oldId, await saveImage(url));
  }
  const b = data.binder;
  return {
    ...b,
    id: newId(),
    updatedAt: Date.now(),
    pages: b.pages.map((p) =>
      p.map((s) => (s?.kind === "custom" ? (map.has(s.imageId) ? { ...s, imageId: map.get(s.imageId)! } : null) : s)),
    ),
    art: b.art?.map((a) => (a?.imageId ? (map.has(a.imageId) ? { ...a, imageId: map.get(a.imageId)! } : null) : a)),
  };
}

/* ----------------------------- community gallery ----------------------------- */
// The gallery lives in the GitHub repo's issues: each post is an issue titled "[Binder] …" with a
// share code in it. 👍 reactions on the issue are the upvotes. Free, and moderated by the repo owner.

export const GALLERY_REPO = "dukearktouros/dreambinder";
export const GALLERY_PREFIX = "[Binder]";

export type GalleryPost = {
  id: number;
  title: string;
  author: string;
  votes: number;
  url: string;
  createdAt: string;
  binder: Binder;
};

type Issue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  created_at: string;
  user: { login: string } | null;
  reactions?: { "+1"?: number };
  pull_request?: unknown;
};

export async function loadGallery(signal?: AbortSignal): Promise<GalleryPost[]> {
  const res = await fetch(`https://api.github.com/repos/${GALLERY_REPO}/issues?state=open&per_page=100`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (res.status === 403) throw new Error("GitHub is busy (too many requests). Try again in a few minutes.");
  if (!res.ok) throw new Error(`Couldn't load the gallery (${res.status})`);
  const issues = (await res.json()) as Issue[];
  const posts = await Promise.all(
    issues
      .filter((i) => !i.pull_request && i.title.startsWith(GALLERY_PREFIX) && i.body?.includes(PREFIX))
      .map(async (i) => {
        try {
          return {
            id: i.number,
            title: i.title.slice(GALLERY_PREFIX.length).trim() || "Untitled binder",
            author: i.user?.login ?? "someone",
            votes: i.reactions?.["+1"] ?? 0,
            url: i.html_url,
            createdAt: i.created_at,
            binder: await codeToBinder(i.body!),
          };
        } catch {
          return null;
        }
      }),
  );
  return posts.filter((p): p is GalleryPost => !!p);
}

/** Link that opens a new gallery post on GitHub with the title and share code filled in. */
export function galleryPostUrl(name: string, code: string, note: string) {
  const body = [
    note || "My binder layout, made with DreamBinder.",
    "",
    "<!-- Drag your Export PNG picture here to add a preview -->",
    "",
    "```",
    code,
    "```",
  ].join("\n");
  const params = new URLSearchParams({ title: `${GALLERY_PREFIX} ${name}`, body });
  return `https://github.com/${GALLERY_REPO}/issues/new?${params}`;
}
