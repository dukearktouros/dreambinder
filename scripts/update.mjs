// Auto-updater: run by the Start files before launching.
// Compares every file with the latest version on GitHub and downloads only what changed.
// If anything goes wrong (offline, GitHub down), it does nothing and the current version starts.
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "dukearktouros/dreambinder";
const BRANCH = "main";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Folders fully managed by the updater: local files that no longer exist on GitHub get deleted. */
const MANAGED_DIRS = ["src", "scripts", "public"];
/** Marker telling launch.mjs to reinstall and rebuild. */
export const MARKER = join(ROOT, ".needs-rebuild");

const isWindowsText = (path) => path.endsWith(".bat");
const toLF = (buf) => Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"));
const toCRLF = (buf) => Buffer.from(buf.toString("utf8").replace(/\r?\n/g, "\r\n"));

/** Git's hash of a file, so we can compare without downloading. */
function gitHash(buf) {
  return createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
}

function localHash(path) {
  const full = join(ROOT, path);
  if (!existsSync(full)) return null;
  const buf = readFileSync(full);
  return gitHash(isWindowsText(path) ? toLF(buf) : buf);
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(ROOT, full).split(sep).join("/"));
  }
  return out;
}

async function get(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "DreamBinder-updater" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${url}`);
  return res;
}

async function main() {
  if (existsSync(join(ROOT, ".git"))) {
    console.log("Developer copy (git folder found): skipping auto-update.");
    return;
  }
  console.log("Checking for updates...");
  const commit = await (await get(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`)).json();
  const tree = await (await get(`https://api.github.com/repos/${REPO}/git/trees/${commit.sha}?recursive=1`)).json();
  const files = tree.tree.filter((f) => f.type === "blob");

  const changed = files.filter((f) => localHash(f.path) !== f.sha);
  const remote = new Set(files.map((f) => f.path));
  const removed = MANAGED_DIRS.flatMap((d) => walk(join(ROOT, d))).filter((p) => !remote.has(p));

  if (!changed.length && !removed.length) {
    console.log("DreamBinder is up to date.");
    return;
  }

  // Download everything first, so a failed download never leaves a half-updated copy.
  const downloads = await Promise.all(
    changed.map(async (f) => {
      const url = `https://raw.githubusercontent.com/${REPO}/${commit.sha}/${f.path.split("/").map(encodeURIComponent).join("/")}`;
      const buf = Buffer.from(await (await get(url)).arrayBuffer());
      return { path: f.path, buf: isWindowsText(f.path) ? toCRLF(buf) : buf };
    }),
  );
  for (const { path, buf } of downloads) {
    const full = join(ROOT, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, buf);
    if (path.endsWith(".command")) {
      try {
        chmodSync(full, 0o755); // keep the Mac Start file double-clickable
      } catch {}
    }
  }
  for (const path of removed) rmSync(join(ROOT, path), { force: true });

  writeFileSync(MARKER, commit.sha);
  console.log(`Updated ${changed.length + removed.length} file(s) to the latest version.`);
}

main().catch((e) => {
  console.log(`Couldn't check for updates (${e.message}). Starting the version you have.`);
});
