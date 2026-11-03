# DreamBinder

A free Pokémon card binder planner. Search every card, drag them into binder pages, and upload your own art at no cost. That includes splitting one big artwork across a whole page.

## Run it on your computer

1. Install **Node.js**: go to <https://nodejs.org/> and download the **LTS** version. Run the installer with the default options.
2. Start DreamBinder:
   - **Windows:** double-click **`Start (Windows).bat`**.
   - **Mac:** double-click **`Start (Mac).command`**. If macOS blocks it, right-click it → **Open** → **Open**.

A window opens (leave it open, that's DreamBinder running) and your browser opens **http://localhost:3000**.
The first start takes a minute or two. Your binders are saved in your browser.

**Updates are automatic:** every time you double-click Start, it downloads whatever changed on GitHub and rebuilds. If you're offline, it just starts the version you have.

For developers: `npm install`, then `npm run dev`.

## What works (Phase 1)

- Search cards by Pokémon or trainer name, or browse any set (data from the free [TCGdex API](https://tcgdex.dev))
- Drag and drop into pockets, swap pockets, drag to the bin to remove
- Click a pocket, then click cards to fill pockets in order (works well on phones)
- 4, 9, 12 and 16-pocket layouts, add or remove pages, binder cover colours
- **Free custom uploads:** a single card-sized image, or **background art** behind a whole page: cards sit on top and empty pockets show the art (zoom and move it with "Adjust art")
- Remove the background art from single pockets (hover an empty pocket → **×**, or click it → **Remove art here**)
- **Cut an image into cards:** pick a block size (2×1, 2×2, 2×3, 3×3 …) and the image is cut into that many card pieces, placed from the selected pocket
- Flip any card upside down (click it, then **Flip upside down**)
- **Chase cards first:** search and set results put SIRs, gold/hyper rares, illustration rares and alt arts at the top, with rarity badges
- **Name suggestions** while typing in search (Pokémon and trainers)
- "Make binder from set" creates a complete set binder in one click
- Several binders, autosaved in the browser (localStorage, with images in IndexedDB)
- Export a two-page spread as a PNG to share on Discord or social media
- **Market prices** on every card (TCGplayer market price in USD, Cardmarket in EUR when TCGplayer has none), plus binder value and "cost to complete"
- **Missing cards:** mark cards you still need (hover a card and click **?**, or click it and use the buttons above the binder)
- **Export PDF:** a printable want list (missing cards only) or full checklist with tick boxes, set, number and price, for card shows
- **Japanese and Chinese cards:** pick the card language above the search. Type English names ("Pikachu") and DreamBinder finds that Pokémon's cards in the other language by Pokédex number, or type the name in Japanese/Chinese
- Cards the main database has no picture for (e.g. some Brilliant Stars cards) use a backup picture from pokemontcg.io, or a name placeholder
- **Expand art to page:** click a card → **✨ Expand art to page**, choose the part of the artwork (no name, text or border), and it fills the page behind the card, with the card in the middle pocket
- **✨ AI extend:** in "Expand art to page", the AI paints new scenery around the card's artwork (same style, no text or border) so it fills the whole page, with your card in the middle. Uses Stability AI: paste your key in the dialog (from platform.stability.ai; a few cents per extend) or put `STABILITY_API_KEY=...` in a `.env.local` file
- **Share:** share codes to paste in Discord, binder files (with your uploaded images), and opening both
- **Community gallery** (the **Community** link): binders posted as `[Binder]` issues on this GitHub repo, upvoted with 👍, opened with one click. The repo owner removes posts by closing the issue
- **Free background library:** 14 original backgrounds (fire, water, psychic, nebula, holo…) anyone can use, in the Upload tab
- Online-only sets (Pokémon TCG Pocket) are hidden, so only cards that exist as physical cards show up

## Code map

| Path | What |
|---|---|
| `src/lib/tcgdex.ts` | Card API client |
| `src/lib/image.ts` | Crop and split uploads, image storage |
| `src/lib/store.ts` | Binder state and saving |
| `src/lib/export.ts` | PNG export |
| `src/lib/pdf.ts` | PDF want list / checklist |
| `src/lib/prices.ts` | Card prices, set names and numbers (cached for a day) |
| `src/components/Editor.tsx` | Main screen: binder spread, drag and drop |
| `src/components/Library.tsx` | Search, sets and upload tabs |

## Roadmap

1. ~~Binder builder~~ ✅
2. Accounts (Supabase + Discord login), cloud saves, public share links
3. Social: publish binders, upvotes, trending, premade layouts per set, Pokémon and trainer
4. Discord app: bot `/binder` command plus an embedded Activity
5. Artist commissions (Stripe Connect) and a print shop, **for original art only** (no Pokémon IP)
