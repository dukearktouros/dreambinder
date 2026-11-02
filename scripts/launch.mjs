// Run by the Start files after update.mjs: installs and builds when the code changed,
// stops an older DreamBinder that's still running, opens the browser and starts the app.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import net from "node:net";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3000;
const URL = `http://localhost:${PORT}`;
const { version } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

function npm(...args) {
  const r = spawnSync("npm", args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.log(`\n"npm ${args.join(" ")}" failed. Scroll up to see the error.`);
    process.exit(1);
  }
}

/** Fingerprint of a set of files/folders, so we know when to reinstall or rebuild. */
function fingerprint(paths) {
  const hash = createHash("sha1");
  const add = (full) => {
    if (!existsSync(full)) return;
    if (statSync(full).isDirectory()) return readdirSync(full).sort().forEach((n) => add(join(full, n)));
    hash.update(relative(ROOT, full)).update(readFileSync(full));
  };
  paths.forEach((p) => add(join(ROOT, p)));
  return hash.digest("hex");
}

const readStamp = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");

const portInUse = () =>
  new Promise((resolve) => {
    const s = net.connect(PORT, "127.0.0.1");
    s.on("connect", () => (s.destroy(), resolve(true)));
    s.on("error", () => resolve(false));
  });

/** If an older DreamBinder is still running on our port, stop it so the new one can start. */
async function stopOldCopy() {
  if (!(await portInUse())) return;
  let isDreamBinder = false;
  try {
    isDreamBinder = (await (await fetch(URL, { signal: AbortSignal.timeout(3000) })).text()).includes("DreamBinder");
  } catch {}
  if (!isDreamBinder) {
    console.log(`\nAnother program is already using ${URL}. Close it and double-click Start again.`);
    process.exit(1);
  }
  console.log("An older DreamBinder is still running. Stopping it...");
  if (process.platform === "win32") {
    const out = spawnSync("netstat", ["-ano"], { encoding: "utf8" }).stdout ?? "";
    const pids = new Set(
      out
        .split("\n")
        .filter((l) => l.includes(`:${PORT} `) && l.includes("LISTENING"))
        .map((l) => l.trim().split(/\s+/).pop()),
    );
    pids.forEach((pid) => spawnSync("taskkill", ["/F", "/T", "/PID", pid]));
  } else {
    let pids = (spawnSync("lsof", ["-ti", `tcp:${PORT}`, "-sTCP:LISTEN"], { encoding: "utf8" }).stdout ?? "")
      .split("\n")
      .filter(Boolean);
    if (!pids.length) {
      // lsof unavailable: fall back to finding the Next.js server process by name
      const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8" }).stdout ?? "";
      pids = ps
        .split("\n")
        .filter((l) => /next-server|next start/.test(l))
        .map((l) => l.trim().split(/\s+/)[0]);
    }
    pids.forEach((pid) => {
      try {
        if (Number(pid) !== process.pid) process.kill(Number(pid));
      } catch {}
    });
  }
  for (let i = 0; i < 20 && (await portInUse()); i++) await new Promise((r) => setTimeout(r, 250));
  if (await portInUse()) {
    console.log("Couldn't stop the older DreamBinder. Close its black window and double-click Start again.");
    process.exit(1);
  }
}

console.log(`DreamBinder v${version}`);

const depsStamp = join(ROOT, "node_modules", ".dreambinder-deps");
const deps = fingerprint(["package.json", "package-lock.json"]);
if (readStamp(depsStamp) !== deps) {
  console.log("Installing (the first time takes a minute or two)...");
  npm("install", "--no-audit", "--no-fund");
  writeFileSync(depsStamp, deps);
}

const buildStamp = join(ROOT, ".next", ".dreambinder-build");
const build = fingerprint([
  "src", "public", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs",
]);
if (readStamp(buildStamp) !== build || !existsSync(join(ROOT, ".next", "BUILD_ID"))) {
  console.log("Building the latest version...");
  npm("run", "build");
  writeFileSync(buildStamp, build);
}

await stopOldCopy();

setTimeout(() => {
  const opener =
    process.platform === "win32" ? `start "" "${URL}"` : process.platform === "darwin" ? `open "${URL}"` : `xdg-open "${URL}"`;
  spawn(opener, { shell: true, stdio: "ignore", detached: true }).unref();
}, 3000);

console.log(`\nDreamBinder v${version} is running at ${URL} - leave this window open. Close it to stop.\n`);
npm("start");
