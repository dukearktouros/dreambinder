// Run by the Start files after update.mjs: installs, builds if needed, opens the browser, starts the app.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARKER = join(ROOT, ".needs-rebuild");
const URL = "http://localhost:3000";
const updated = existsSync(MARKER);

function npm(...args) {
  const r = spawnSync("npm", args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.log(`\n"npm ${args.join(" ")}" failed. Scroll up to see the error.`);
    process.exit(1);
  }
}

if (updated || !existsSync(join(ROOT, "node_modules"))) {
  console.log("Installing (the first time takes a minute or two)...");
  npm("install", "--no-audit", "--no-fund");
}
if (updated || !existsSync(join(ROOT, ".next", "BUILD_ID"))) {
  console.log("Building DreamBinder...");
  npm("run", "build");
}
rmSync(MARKER, { force: true });

setTimeout(() => {
  const opener = process.platform === "win32" ? `start "" "${URL}"` : process.platform === "darwin" ? `open "${URL}"` : `xdg-open "${URL}"`;
  spawn(opener, { shell: true, stdio: "ignore", detached: true }).unref();
}, 3000);

console.log(`\nDreamBinder is running at ${URL} - leave this window open. Close it to stop.\n`);
npm("start");
