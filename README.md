# DreamBinder

A free Pokémon card binder planner. Search every card, drag them into binder pages, and upload your own art at no cost. That includes splitting one big artwork across a whole page.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## What works (Phase 1)

- Search cards by Pokémon or trainer name, or browse any set (data from the free [TCGdex API](https://tcgdex.dev))
- Drag and drop into pockets, swap pockets, drag to the bin to remove
- Click a pocket, then click cards to fill pockets in order (works well on phones)
- 4, 9, 12 and 16-pocket layouts, add or remove pages, binder cover colours
- **Free custom uploads:** a single card-sized image, or one artwork sliced across a whole page
- "Make binder from set" creates a complete set binder in one click
- Several binders, autosaved in the browser (localStorage, with images in IndexedDB)
- Export a two-page spread as a PNG to share on Discord or social media

## Code map

| Path | What |
|---|---|
| `src/lib/tcgdex.ts` | Card API client |
| `src/lib/image.ts` | Crop and split uploads, image storage |
| `src/lib/store.ts` | Binder state and saving |
| `src/lib/export.ts` | PNG export |
| `src/components/Editor.tsx` | Main screen: binder spread, drag and drop |
| `src/components/Library.tsx` | Search, sets and upload tabs |

## Roadmap

1. ~~Binder builder~~ ✅
2. Accounts (Supabase + Discord login), cloud saves, public share links
3. Social: publish binders, upvotes, trending, premade layouts per set, Pokémon and trainer
4. Discord app: bot `/binder` command plus an embedded Activity
5. Artist commissions (Stripe Connect) and a print shop, **for original art only** (no Pokémon IP)
