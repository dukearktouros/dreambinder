// Fetches card pictures for the browser so they can be cropped/edited on a canvas
// (the image hosts don't always allow that directly). Only known card image hosts are allowed.
const ALLOWED = ["assets.tcgdex.net", "images.pokemontcg.io"];

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url");
  let target: URL;
  try {
    target = new URL(url ?? "");
  } catch {
    return new Response("Bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED.includes(target.hostname)) return new Response("Host not allowed", { status: 403 });
  const res = await fetch(target, { headers: { "User-Agent": "DreamBinder" } });
  if (!res.ok) return new Response("Image not found", { status: res.status });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
