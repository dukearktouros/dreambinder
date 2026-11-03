// AI "extended art": sends a card's artwork to Stability AI's outpaint endpoint, which paints
// new scenery around it in the same style. The API key comes from the STABILITY_API_KEY
// environment variable, or from the key the user saved in the app (x-stability-key header).
const OUTPAINT = "https://api.stability.ai/v2beta/stable-image/edit/outpaint";
const FIELDS = ["image", "left", "right", "up", "down", "prompt", "creativity", "seed"];

export async function POST(req: Request) {
  const key = process.env.STABILITY_API_KEY || req.headers.get("x-stability-key");
  if (!key) return Response.json({ error: "No AI key yet. Paste your Stability AI key first." }, { status: 401 });

  const input = await req.formData();
  const form = new FormData();
  for (const f of FIELDS) {
    const v = input.get(f);
    if (v !== null && v !== "") form.append(f, v);
  }
  form.append("output_format", "jpeg");

  const res = await fetch(OUTPAINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "image/*" },
    body: form,
  });
  if (!res.ok) {
    let message = `AI service error (${res.status})`;
    try {
      const body = await res.json();
      message = [body.name, ...(body.errors ?? [])].filter(Boolean).join(": ") || message;
    } catch {}
    if (res.status === 401 || res.status === 403) message = "Your Stability AI key was not accepted. Check it and try again.";
    if (res.status === 402) message = "Your Stability AI account is out of credits.";
    return Response.json({ error: message }, { status: res.status });
  }
  return new Response(res.body, { headers: { "Content-Type": res.headers.get("content-type") ?? "image/jpeg" } });
}
