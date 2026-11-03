"use client";
import { useEffect, useRef, useState } from "react";
import type { Binder } from "@/lib/types";
import { binderToCode, binderToFile, codeToBinder, fileToBinder, galleryPostUrl } from "@/lib/share";

export function ShareDialog({
  binder,
  onImport,
  onClose,
}: {
  binder: Binder;
  onImport: (b: Binder) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState("");
  const [paste, setPaste] = useState("");
  const [error, setError] = useState<string>();
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    binderToCode(binder).then(({ code, skipped }) => {
      setCode(code);
      setSkipped(skipped);
    });
  }, [binder]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const run = async (fn: () => Promise<void>) => {
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  const section = "space-y-2 rounded-lg border border-white/10 bg-black/20 p-3";
  const btn = "rounded-md bg-amber-400 px-3 py-1.5 font-semibold text-black hover:bg-amber-300 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Share binder"
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-lg space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-5 text-sm shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Share &amp; open binders</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <section className={section}>
          <h3 className="font-semibold">Share code</h3>
          <p className="text-white/60">Paste it in Discord or anywhere. Friends open it with &ldquo;Open a shared binder&rdquo; below.</p>
          <textarea readOnly value={code} rows={3} data-testid="share-code" className="w-full rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs" />
          {skipped > 0 && (
            <p className="text-xs text-amber-300">
              {skipped} uploaded image{skipped === 1 ? "" : "s"} can&apos;t fit in a code. Use &ldquo;Download binder file&rdquo; to share everything.
            </p>
          )}
          <button type="button" onClick={copy} disabled={!code} className={btn}>
            {copied ? "Copied!" : "Copy code"}
          </button>
        </section>

        <section className={section}>
          <h3 className="font-semibold">Post to the community gallery</h3>
          <p className="text-white/60">
            Opens a post on GitHub with your binder filled in (free GitHub account needed). Others upvote with 👍.
            Drag your Export PNG into the post to add a picture.
          </p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Say something about your binder (optional)"
            className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5"
          />
          <button
            type="button"
            disabled={!code}
            onClick={() => {
              copy();
              window.open(galleryPostUrl(binder.name || "My binder", code, note), "_blank", "noopener");
            }}
            className={btn}
          >
            Post to gallery
          </button>
        </section>

        <section className={section}>
          <h3 className="font-semibold">Binder file</h3>
          <p className="text-white/60">One file with everything, including your uploaded images. Good for backups too.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => run(() => binderToFile(binder))} className={btn}>
              Download binder file
            </button>
            <button type="button" onClick={() => file.current?.click()} className="rounded-md border border-white/15 px-3 py-1.5 hover:bg-white/10">
              Open a binder file
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              data-testid="open-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) run(async () => onImport(await fileToBinder(f)));
              }}
            />
          </div>
        </section>

        <section className={section}>
          <h3 className="font-semibold">Open a shared binder</h3>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={2}
            placeholder="Paste a share code (DB1.…) or a whole message containing one"
            data-testid="paste-code"
            className="w-full rounded-md border border-white/10 bg-black/40 p-2 font-mono text-xs"
          />
          <button type="button" disabled={!paste.trim()} onClick={() => run(async () => onImport(await codeToBinder(paste)))} className={btn}>
            Open as a new binder
          </button>
        </section>
        {error && <p className="text-red-400">{error}</p>}
      </div>
    </div>
  );
}
