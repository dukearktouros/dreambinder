// Printable checklist / want list as a PDF, for taking to card shows.
import { jsPDF } from "jspdf";
import type { Binder, CardSlot } from "./types";
import { loadInfos, formatPrice, formatTotal, type CardInfo } from "./prices";
import { cardImage } from "./tcgdex";

export type PdfOptions = { onlyMissing: boolean; pictures: boolean };

/** The built-in PDF fonts can't draw some symbols used in card names. */
const pdfText = (t: string) =>
  t.replace(/♀/g, " (F)").replace(/♂/g, " (M)").replace(/[★☆]/g, " Star").replace(/δ/g, " Delta").replace(/[^\x20-\xFF]/g, "");

type Row = { slot: CardSlot; page: number; pocket: number; info?: CardInfo };

async function thumbnail(slot: CardSlot): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = cardImage(slot.image, "low");
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 126;
    c.height = 176;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

export async function exportPdf(binder: Binder, opts: PdfOptions) {
  const rows: Row[] = [];
  binder.pages.forEach((p, page) =>
    p.forEach((s, pocket) => {
      if (s?.kind === "card" && (!opts.onlyMissing || s.missing)) rows.push({ slot: s, page, pocket });
    }),
  );
  if (!rows.length) throw new Error(opts.onlyMissing ? "No cards are marked as missing yet." : "This binder has no cards yet.");

  const infos = await loadInfos(rows.map((r) => r.slot.cardId));
  rows.forEach((r) => (r.info = infos[r.slot.cardId]));
  const thumbs = opts.pictures ? await Promise.all(rows.map((r) => thumbnail(r.slot))) : [];

  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const rowH = opts.pictures ? 20 : 8;
  const cols = { box: M, pic: M + 8, name: M + (opts.pictures ? 24 : 8), set: 100, num: 150, where: 168, price: W - M };

  const header = () => {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(110);
    doc.text("CARD", cols.name, y);
    doc.text("SET", cols.set, y);
    doc.text("NO.", cols.num, y);
    doc.text("BINDER", cols.where, y);
    doc.text("PRICE", cols.price, y, { align: "right" });
    doc.setDrawColor(200).line(M, y + 2, W - M, y + 2);
    y += 6;
  };

  // Title block
  let y = M + 4;
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(20);
  doc.text(pdfText(binder.name) || "My Binder", M, y);
  y += 7;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90);
  const total = formatTotal(rows.map((r) => r.info));
  doc.text(
    `${opts.onlyMissing ? "Want list" : "Checklist"} · ${rows.length} card${rows.length === 1 ? "" : "s"} · ` +
      `${opts.onlyMissing ? "Cost to complete" : "Total value"}: ${total} · ${new Date().toLocaleDateString()}`,
    M,
    y,
  );
  y += 4;
  doc.setFontSize(8).text("Prices: TCGplayer market price (USD), or Cardmarket trend (EUR) when unavailable.", M, y);
  y += 8;
  header();

  rows.forEach((r, i) => {
    if (y + rowH > H - M) {
      doc.addPage();
      y = M + 4;
      header();
    }
    const mid = y + rowH / 2;
    doc.setDrawColor(120).setLineWidth(0.3).rect(cols.box, mid - 2.5, 4, 4); // tick box
    const t = thumbs[i];
    if (t) doc.addImage(t, "JPEG", cols.pic, y + 1, 12.6, 17.6);
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(20);
    doc.text(doc.splitTextToSize(pdfText(r.slot.name), cols.set - cols.name - 3)[0], cols.name, mid + 1);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(70);
    doc.text(doc.splitTextToSize(pdfText(r.info?.setName ?? ""), cols.num - cols.set - 3)[0] ?? "", cols.set, mid + 1);
    doc.text(r.info?.number ?? r.slot.cardId, cols.num, mid + 1);
    doc.text(`p${r.page + 1} #${r.pocket + 1}`, cols.where, mid + 1);
    doc.setTextColor(20).text(
      r.info?.price ? formatPrice(r.info.price, r.info.currency) : "-",
      cols.price,
      mid + 1,
      { align: "right" },
    );
    doc.setDrawColor(235).line(M, y + rowH, W - M, y + rowH);
    y += rowH;
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8).setTextColor(150);
    doc.text(`Made with DreamBinder · page ${p} of ${pages}`, W / 2, H - 7, { align: "center" });
  }

  const kind = opts.onlyMissing ? "want-list" : "checklist";
  doc.save(`${(binder.name || "binder").replace(/[^\w-]+/g, "_")}-${kind}.pdf`);
}
