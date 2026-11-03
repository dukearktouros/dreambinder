import type { Lang } from "./tcgdex";

export type CardSlot = {
  kind: "card";
  /** Card language (missing = English) */
  lang?: Lang;
  cardId: string;
  name: string;
  /** TCGdex image base URL (append /low.webp or /high.webp) */
  image: string;
  /** Card is wanted but not owned yet */
  missing?: boolean;
  /** Shown upside down */
  flipped?: boolean;
};

export type CustomSlot = {
  kind: "custom";
  /** Key of the image stored in IndexedDB */
  imageId: string;
  flipped?: boolean;
};

/** Background artwork behind a whole page. Cards sit on top; empty pockets show the art. */
export type PageArt = {
  /** Uploaded image (IndexedDB key)… */
  imageId?: string;
  /** …or an image URL (card picture, built-in background) */
  src?: string;
  /** Part of the image to use, as fractions of the full image (default: all of it) */
  crop?: { x: number; y: number; w: number; h: number };
  /** Softening, in mm (0 = sharp) */
  blur?: number;
  /** Size in px of the part used (the crop) */
  w: number;
  h: number;
  /** 1 = just covers the page */
  zoom: number;
  /** -0.5 … 0.5 */
  x: number;
  y: number;
  /** Pockets where the art has been removed */
  hidden?: number[];
};

export type Slot = CardSlot | CustomSlot | null;

export type Binder = {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cover: string;
  pages: Slot[][];
  /** Background art per page index (same order as pages) */
  art?: (PageArt | null)[];
  updatedAt: number;
};

export const GRID_PRESETS = [
  { label: "4-pocket (2×2)", rows: 2, cols: 2 },
  { label: "9-pocket (3×3)", rows: 3, cols: 3 },
  { label: "12-pocket (3×4)", rows: 4, cols: 3 },
  { label: "16-pocket (4×4)", rows: 4, cols: 4 },
] as const;

export const COVER_COLORS = [
  "#1e3a8a", "#7f1d1d", "#14532d", "#581c87", "#0f172a", "#9a3412", "#be185d", "#0e7490",
];

/** Drag payloads */
export type DragData =
  | { type: "card"; slot: CardSlot }
  | { type: "slot"; page: number; index: number; slot: Exclude<Slot, null> };

export type DropData = { type: "slot"; page: number; index: number } | { type: "trash" };
