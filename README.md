# Frostline

An interactive marketplace for snowboard deals in Australia. Each board appears once. You can spin it in 3D to see the top sheet, base and sidewall, then compare which Australian shops sell it and for how much.

Snowboards only for now. Bindings, boots and gear come later.

## How it works

```
scraper/            Node + TypeScript scraper (run with tsx)
  stores.ts         the shops we track
  shopify.ts        pages through each shop's public /products.json feed
  classify.ts       keeps real boards, drops boots/bindings/outerwear/accessories
  normalize.ts      brand, model, year, gender, sizes, price, RRP, specs from tags
  match.ts          groups the same board across shops into one entry
  index.ts          writes public/data/boards.json
src/                React + Vite front end
  lib/boardArt.ts   finds the board(s) in each product photo, crops top/base, traces the outline
  three/            react-three-fiber board mesh, built from that outline, plus the pedestal stage
  components/       header/search, hero, filters, cards, detail page, stores
```

The 3D board is made from the stores' own product photos, with no 3D models needed. The browser reads each photo and separates the board(s) from the plain backdrop. It handles three photo layouts: top and base side by side in one image, separate top and base images, and side-profile shots (which it skips). It crops each board and records its outline row by row. The mesh follows that outline, gets rocker at the tips and sidewalls, and has the top and base graphics mapped onto it. A board with no usable photo falls back to a generated design.

## Running it

```bash
npm install
npm run scrape          # fetch fresh prices from every store (~1 min)
npm run scrape:cached   # rebuild boards.json from the last download in .cache/
npm run dev
```

A GitHub Action (`.github/workflows/scrape.yml`) re-scrapes daily and commits the new `boards.json`.

## Australian snowboard shops

**Scraped now.** These are all Shopify stores with a public `/products.json` feed. Only in-stock listings are kept:

| Store | Site | Base |
| --- | --- | --- |
| Auski | auski.com.au | Melbourne |
| Rhythm Snowsports | rhythmsnowsports.com.au | Sydney + resorts |
| Twelve Board Store | twelveboardstore.com.au | Melbourne |
| Larry Adler | larryadler.com.au | Sydney |
| Balmoral Boards | balmoralboards.com.au | Sydney |
| Paul Reader | paulreader.com.au | Sydney |
| Snow Monkey | snowmonkey.com.au | Melbourne |
| Melbourne Snowboard Centre | melbournesnowboard.com.au | Preston, Melbourne |
| Bumps | bumps.com.au | Elsternwick, Melbourne (only ~1 board online right now) |

**Not yet scraped.** These aren't on Shopify or block the feed, so each needs its own HTML adapter:

- X-Dream (xdream.com.au): online-focused snow shop
- STM (stm.com.au): Bondi Junction
- Boardstore (boardstore.com.au)
- Wild Earth (wildearth.com.au) and Anaconda (anaconda.com.au): outdoor chains with a small snowboard range
- Boardcave (boardcave.com.au): Shopify, but returns 403 to the feed
- Boardworld (boardworld.com.au): Shopify, but its snow range is left out of the public feed (only skate gear shows up); would need its search-filter API
- Surf Dive 'n Ski: mostly surf, with some snow gear in season

## Pricing APIs

There's no snowboard-specific pricing API, and no Australian one either. The options are:

- **Shopify `/products.json` (what we use).** Free, public, structured, and includes `compare_at_price`, so we get real "was" prices. It's unofficial, so a store can turn it off.
- **General price-comparison APIs** such as PriceAPI and the Zyla Labs marketplace listings. These are paid and focused on Amazon, eBay and Google Shopping. They have little coverage of Australian specialist snow shops.
- **Google Shopping via SerpApi and similar.** Paid. Useful for catching shops we don't scrape, but the data is noisier.
- **Affiliate product feeds** (Commission Factory is the main network in Australia). This is the "official" route: retailers publish full product feeds to affiliates. No dedicated snow shop showed up with a feed, but it's worth applying once the site has traffic. It would also earn commission on click-outs.

## Design

The visual direction follows Phenomenon Studio's *Frozeverse* NFT marketplace: dark icy navy, frosted-glass panels, cyan glows, warm gold for deals, and items shown floating above a glowing pedestal.
