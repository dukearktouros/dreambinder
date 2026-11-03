"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GALLERY_REPO, loadGallery, type GalleryPost } from "@/lib/share";
import { addBinderToStorage } from "@/lib/store";
import { newId } from "@/lib/image";
import { MiniBinder } from "./MiniBinder";

const cardCount = (p: GalleryPost) => {
  const n = p.binder.pages.flat().filter(Boolean).length;
  return `${n} card${n === 1 ? "" : "s"}`;
};

export function Gallery() {
  const [posts, setPosts] = useState<GalleryPost[]>();
  const [error, setError] = useState<string>();
  const [sort, setSort] = useState<"top" | "new">("top");
  const [q, setQ] = useState("");
  const [opened, setOpened] = useState<number>();

  useEffect(() => {
    const ctrl = new AbortController();
    loadGallery(ctrl.signal).then(setPosts, (e) => !ctrl.signal.aborted && setError(e.message));
    return () => ctrl.abort();
  }, []);

  const shown = useMemo(() => {
    const list = (posts ?? []).filter((p) =>
      `${p.title} ${p.author} ${p.binder.pages.flat().map((s) => (s?.kind === "card" ? s.name : "")).join(" ")}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    );
    return list.sort((a, b) => (sort === "top" ? b.votes - a.votes : 0) || b.createdAt.localeCompare(a.createdAt));
  }, [posts, sort, q]);

  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-black/40 px-4 py-3">
        <Link href="/" className="text-lg font-black tracking-tight text-amber-300">
          DreamBinder
        </Link>
        <span className="font-semibold">Community binders</span>
        <Link href="/" className="ml-auto rounded-md border border-white/10 px-3 py-1.5 text-sm hover:bg-white/10">
          ← Back to my binders
        </Link>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-black/30 p-1">
            {(["top", "new"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                className={`rounded-md px-3 py-1 text-sm ${sort === s ? "bg-amber-400 font-semibold text-black" : "text-white/70"}`}
              >
                {s === "top" ? "Most upvoted" : "Newest"}
              </button>
            ))}
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, card or maker…"
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm outline-none focus:border-amber-400"
          />
        </div>
        <p className="text-xs text-white/40">
          Share yours with <b>Share</b> → <b>Post to gallery</b> in the editor. Upvote a binder with 👍 on its GitHub post.
        </p>
        {error && <p className="text-red-400">{error}</p>}
        {!posts && !error && <p className="text-white/50">Loading binders…</p>}
        {posts && shown.length === 0 && (
          <p className="text-white/50">
            No binders here yet. Be the first to post one!{" "}
            <a className="text-amber-300 underline" href={`https://github.com/${GALLERY_REPO}/issues`} target="_blank" rel="noreferrer">
              See all posts on GitHub
            </a>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="gallery">
          {shown.map((p) => (
            <article key={p.id} className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
              <MiniBinder binder={p.binder} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{p.title}</h3>
                  <p className="text-xs text-white/50">
                    by {p.author} · {cardCount(p)} · {p.binder.rows * p.binder.cols}-pocket
                  </p>
                </div>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Upvote on GitHub"
                  className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-sm hover:bg-white/10"
                >
                  👍 {p.votes}
                </a>
              </div>
              <button
                type="button"
                onClick={() => {
                  addBinderToStorage({ ...p.binder, id: newId(), name: `${p.title} (copy)`, updatedAt: Date.now() });
                  setOpened(p.id);
                }}
                className="w-full rounded-md bg-amber-400 py-1.5 text-sm font-semibold text-black hover:bg-amber-300"
              >
                {opened === p.id ? "Added to your binders ✓" : "Make a copy for me"}
              </button>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
