"""
Pre-computes background-removal masks for every board photo on the site.

Store photos put boards on white or grey backdrops, sometimes with soft
shadows, and many boards are white themselves. Colour-matching the backdrop in
the browser gets those wrong, so a segmentation model (BiRefNet via rembg) does the
work here once per photo instead.

For each photo we save a greyscale mask cropped to the board(s), plus the crop
box as fractions of the photo, in public/cutouts/. The site draws the photo
through the mask. Lifestyle photos (a rider on a mountain) are marked as
skipped so the site never shows them as cut-outs, and photos where the board
runs off the frame ("c") or lies sideways ("w") are flagged so the site
prefers an upright, full-board shot for cards.

Usage: python scraper/cutouts.py [--limit N]
Only photos not already in the manifest are processed; masks for photos no
longer on the site are deleted.
"""

import hashlib
import io
import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.spatial import ConvexHull

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'public' / 'data' / 'boards.json'
OUT = ROOT / 'public' / 'cutouts'
MANIFEST = OUT / 'index.json'

MODEL = 'birefnet-general'  # the lighter models lose white boards on white backdrops
SOURCE_WIDTH = 1200  # photo width the mask is computed from
MASK_MAX = 1000  # longest side of the saved mask
EDGE = 2  # px band at the outline that keeps the model's soft alpha
OFF_FRAME = 0.12  # share of a photo's side the board can cover before it counts as cut off
TRIM = 1  # version of the drop-shadow trim; masks made before it get re-trimmed
SHADOW_BAND = 0.025  # widest drop shadow trimmed, as a share of the photo's width
SHADOW_RUN = 0.25  # a shadow must run along this share of the board's length


def key(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:16]


def sized(url: str) -> str:
    if url.startswith('//'):
        url = 'https:' + url
    if 'cdn.shopify.com' in url or '/cdn/shop/' in url:
        url += ('&' if '?' in url else '?') + f'width={SOURCE_WIDTH}'
    return url


def fetch(url: str) -> Image.Image | None:
    try:
        req = urllib.request.Request(sized(url), headers={'User-Agent': 'Mozilla/5.0 frostline'})
        with urllib.request.urlopen(req, timeout=30) as r:
            return Image.open(io.BytesIO(r.read())).convert('RGBA')
    except Exception as e:  # noqa: BLE001
        print(f'  ! {url}: {e}', file=sys.stderr)
        return None


def is_product_shot(im: Image.Image) -> bool:
    """Studio photos have a plain (or transparent) border; scenes don't."""
    a = np.asarray(im)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).astype(int)
    clear = border[:, 3] < 16
    rgb = border[:, :3]
    # Light backdrops, or one flat studio grey (some brands shoot on charcoal).
    # Near-black borders are night scenes and coloured ones are text panels.
    light = (rgb.max(1) - rgb.min(1) <= 24) & (rgb.mean(1) >= 150)
    grey = (rgb.max(1) - rgb.min(1) <= 12) & (rgb.mean(1) >= 35)
    flat = grey & (np.abs(rgb - np.median(rgb, axis=0)).max(1) <= 12)
    return (clear | light).mean() >= 0.6 or (clear | flat).mean() >= 0.9


def hull_mask(c):
    ys, xs = np.nonzero(c)
    pts = np.c_[xs, ys][:: max(1, len(xs) // 4000)]
    h = ConvexHull(pts)
    img = Image.new('1', c.shape[::-1], 0)
    ImageDraw.Draw(img).polygon([tuple(map(int, pts[v])) for v in h.vertices], fill=1)
    return np.asarray(img)

def mend(solid):
    """Rebuild boards that came out in fragments: pieces sharing one board's
    column of the photo are replaced by their outline (convex hull)."""
    lab, n = ndimage.label(solid)
    if n < 2:
        return solid, False
    h = solid.shape[0]
    objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    big = [i for i in range(n) if sizes[i] >= solid.sum() * 0.01]
    # Group pieces whose column ranges overlap.
    bands = []
    for i in sorted(big, key=lambda i: objs[i][1].start):
        x0, x1 = objs[i][1].start, objs[i][1].stop
        for b in bands:
            ov = min(x1, b['x1']) - max(x0, b['x0'])
            if ov > 0.5 * min(x1 - x0, b['x1'] - b['x0']):
                b['ids'].append(i); b['x0'] = min(b['x0'], x0); b['x1'] = max(b['x1'], x1); break
        else:
            bands.append({'ids': [i], 'x0': x0, 'x1': x1})
    out = solid.copy(); changed = False
    for b in bands:
        if len(b['ids']) < 3:
            continue
        c = np.isin(lab, [i + 1 for i in b['ids']])
        ys = np.nonzero(c.any(1))[0]
        if ys[-1] - ys[0] < h * 0.6:
            continue
        hull = hull_mask(c)
        if c.sum() / hull.sum() < 0.8:
            out |= hull; changed = True
    return out, changed


def trim_shadow(rgb: np.ndarray, solid: np.ndarray) -> np.ndarray:
    """Peel soft drop shadows off a board's left and right edges.

    Studio shots often cast a grey shadow beside the board, and the model
    counts it as board, leaving a pale strip down one side. Per row, a shadow
    is the outer few px of the mask: a smooth, neutral mid-grey, darker than
    the backdrop and still lightening past the mask edge, outside a sharp step
    (the board's real edge). Only long runs of such rows are cut, at one width,
    so dark sidewalls, edge stripes and the like are left alone.
    """
    h, w = solid.shape
    lum = rgb.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    chroma = rgb.max(2).astype(int) - rgb.min(2).astype(int)
    border = np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])
    border_chroma = np.concatenate([chroma[0], chroma[-1], chroma[:, 0], chroma[:, -1]])
    backdrop = float(np.median(border))
    # Only plain light studio backdrops: on anything else shadows can't be told apart.
    if backdrop < 200 or np.median(border_chroma) > 10:
        return solid
    band = max(4, round(w * SHADOW_BAND))
    look = max(4, band // 2)
    cuts = {1: np.zeros(h, int), -1: np.zeros(h, int)}
    for y in range(h):
        xs = np.flatnonzero(solid[y])
        if len(xs) < band * 4:
            continue
        x0, x1 = xs[0], xs[-1] + 1
        for side in (1, -1):
            if side == 1:
                inner, ch = lum[y, x1 - band:x1][::-1], chroma[y, x1 - band:x1][::-1]
                outside = lum[y, x1:x1 + look]
            else:
                inner, ch = lum[y, x0:x0 + band], chroma[y, x0:x0 + band]
                outside = lum[y, max(0, x0 - look):x0][::-1]
            if len(outside) < look:
                continue
            steps = np.abs(np.diff(inner))
            k = int(np.argmax(steps))  # the board's edge: between inner[k] and inner[k + 1]
            if k == 0 or steps[k] < 30:
                continue
            shadow = inner[:k]  # inner[k] may be an anti-aliased pixel
            smooth = k == 1 or np.abs(np.diff(shadow)).max() <= steps[k] / 3
            grey = ch[:k].max() <= 14 and backdrop * 0.6 <= shadow.min() and shadow.max() <= backdrop - 12
            fading = outside[-1] > shadow[0] + 4 and np.all(np.diff(outside) > -3)
            if smooth and grey and fading:
                cuts[side][y] = k + 1
    ys = np.flatnonzero(solid.any(1))
    length = ys[-1] - ys[0] + 1
    out = solid.copy()
    trimmed_rows = np.zeros(h, bool)
    for side in (1, -1):
        # Bridge short gaps; keep runs that cover a good share of the board.
        lab, n = ndimage.label(ndimage.binary_closing(cuts[side] > 0, structure=np.ones(4, bool)))
        for i in range(1, n + 1):
            rows = np.flatnonzero(lab == i)
            widths = cuts[side][rows][cuts[side][rows] > 0]
            if len(rows) < max(20, length * SHADOW_RUN) or widths.std() > 2.5:
                continue
            c = int(np.median(widths))  # one width, so the new edge stays smooth

            def shadowy(y: int) -> bool:
                """Looser test to follow a confirmed shadow round the tips."""
                xs = np.flatnonzero(solid[y])
                if len(xs) < c * 4:
                    return False
                e = xs[-1] + 1 if side == 1 else xs[0]
                outer = slice(e - c, e) if side == 1 else slice(e, e + c)
                edge = (e - c - 1, e - c + 1) if side == 1 else (e + c, e + c - 2)
                # Leave out the board-side pixel, which may be anti-aliased.
                l = lum[y, outer][1:] if side == 1 else lum[y, outer][:-1]
                return (
                    chroma[y, outer].max() <= 14
                    and backdrop * 0.6 <= l.min()
                    and l.max() <= backdrop - 6
                    and abs(lum[y, edge[0]] - lum[y, edge[1]]) >= 20
                )

            lo, hi = rows[0], rows[-1]
            while lo > 0 and shadowy(lo - 1):
                lo -= 1
            while hi < h - 1 and shadowy(hi + 1):
                hi += 1
            rows = np.arange(lo, hi + 1)
            trimmed_rows[rows] = True
            for y in rows:
                xs = np.flatnonzero(solid[y])
                if len(xs):
                    if side == 1:
                        out[y, xs[-1] + 1 - c:xs[-1] + 1] = False
                    else:
                        out[y, xs[0]:xs[0] + c] = False
    if not trimmed_rows.any():
        return solid
    # Rows the trim skipped can leave 1–2 row slivers sticking out.
    opened = ndimage.binary_opening(out, structure=np.ones((7, 1), bool))
    near_edge = solid & ~ndimage.binary_erosion(solid, iterations=band)
    near_edge &= ndimage.binary_dilation(trimmed_rows, iterations=4)[:, None]
    return out & ~(near_edge & ~opened)


def has_alpha(im: Image.Image) -> bool:
    """Photos already cut out by the store: their transparency is the shape."""
    return int(np.asarray(im)[:, :, 3].min()) < 250


def make_mask(session, im: Image.Image) -> np.ndarray:
    from rembg import remove

    rgb = im.convert('RGB')
    a = np.asarray(remove(rgb, session=session, only_mask=True)).astype(np.float32)
    # Respect transparency the photo already has.
    a = np.minimum(a, np.asarray(im)[:, :, 3])
    solid = a > 100
    # Pale boards can come out see-through or in pieces; anything enclosed by
    # the outline is board.
    solid, _ = mend(solid)
    filled = ndimage.binary_fill_holes(solid)
    if not has_alpha(im):
        filled = trim_shadow(np.asarray(rgb), filled)
    # Drop specks well away from the board(s).
    lab, n = ndimage.label(filled)
    if n > 1:
        sizes = ndimage.sum(filled, lab, range(1, n + 1))
        filled = np.isin(lab, 1 + np.flatnonzero(sizes >= sizes.max() * 0.02))
    # Solid inside, the model's anti-aliasing along the outline.
    inner = ndimage.binary_erosion(filled, iterations=EDGE)
    return np.where(inner, 255, np.where(filled, a, 0)).astype(np.uint8)


def process(session, url: str, im: Image.Image | None) -> dict:
    if im is None:
        return {'skip': 'fetch'}
    if not is_product_shot(im):
        return {'skip': 'scene'}
    return save_mask(url, make_mask(session, im))


def retrim(url: str, entry: dict, im: Image.Image | None) -> dict:
    """Applies the shadow trim to a mask made before it, without the model."""
    if im is None:
        return entry
    if has_alpha(im):
        return {**entry, 't': TRIM}
    w, h = im.size
    x0, y0, x1, y1 = (round(v * s) for v, s in zip(entry['b'], (w, h, w, h)))
    saved = Image.open(OUT / f"{entry['k']}.png").getchannel('A').resize((x1 - x0, y1 - y0), Image.LANCZOS)
    mask = np.zeros((h, w), np.uint8)
    mask[y0:y1, x0:x1] = np.asarray(saved)
    solid = mask > 128
    trimmed = trim_shadow(np.asarray(im.convert('RGB')), solid)
    if (solid & ~trimmed).sum() == 0:
        return {**entry, 't': TRIM}
    mask[solid & ~trimmed] = 0
    out = save_mask(url, mask)
    return {**out, 'm': entry.get('m')}


def save_mask(url: str, mask: np.ndarray) -> dict:
    ys, xs = np.nonzero(mask > 8)
    h, w = mask.shape
    if len(xs) < w * h * 0.03:
        return {'skip': 'empty'}
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    # Board running off the photo's edge (a close-up). Tips that just touch
    # the top or bottom of a tightly cropped frame don't count.
    solid = mask > 128
    ends = max(solid[0].mean(), solid[-1].mean())
    sides = max(solid[:, 0].mean(), solid[:, -1].mean())
    crop = Image.fromarray(mask[y0:y1, x0:x1], 'L')
    crop.thumbnail((MASK_MAX, MASK_MAX), Image.LANCZOS)
    # The browser masks by alpha, so the shape goes in the alpha channel.
    crop = Image.merge('LA', (Image.new('L', crop.size, 0), crop))
    k = key(url)
    crop.save(OUT / f'{k}.png', optimize=True)
    out = {'k': k, 'b': [round(x0 / w, 5), round(y0 / h, 5), round(x1 / w, 5), round(y1 / h, 5)]}
    # A crop touching both a side and an end of the photo is an angled close-up.
    touch_side = x0 <= w * 0.01 or x1 >= w * 0.99
    touch_end = y0 <= h * 0.01 or y1 >= h * 0.99
    if ends > 0.3 or sides > OFF_FRAME or (touch_side and touch_end):
        out['c'] = 1
    # Lying sideways or shot at an angle: fine in a gallery, odd on a card.
    if x1 - x0 > y1 - y0:
        out['w'] = 1
    out['t'] = TRIM
    return out


def save(manifest: dict) -> None:
    MANIFEST.write_text(json.dumps(dict(sorted(manifest.items())), separators=(',', ':')))


def main() -> None:
    limit = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
    OUT.mkdir(parents=True, exist_ok=True)
    boards = json.loads(DATA.read_text())['boards']
    # Every board's main photo first, then second photos, and so on.
    depth = max(len(b['images']) for b in boards)
    urls = list(dict.fromkeys(b['images'][i] for i in range(depth) for b in boards if i < len(b['images'])))
    manifest: dict = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}

    def stale(u: str) -> bool:
        e = manifest.get(u)
        return e is None or e.get('skip') == 'fetch' or e.get('m') != MODEL

    todo = [u for u in urls if stale(u)]
    if limit:
        todo = todo[:limit]
    # Masks from before the shadow trim only need the trim, not the model.
    untrimmed = [u for u in urls if u not in todo and 'k' in manifest.get(u, {}) and manifest[u].get('t') != TRIM]
    print(f'{len(urls)} photos, {len(todo)} to process, {len(untrimmed)} to re-trim')

    if untrimmed:
        with ThreadPoolExecutor(8) as pool:
            for url, im in zip(untrimmed, pool.map(fetch, untrimmed)):
                manifest[url] = retrim(url, manifest[url], im)
        save(manifest)

    if todo:
        from rembg import new_session

        session = new_session(MODEL)
        with ThreadPoolExecutor(4) as pool:
            # Download a few photos ahead of the model, not all at once.
            ahead = [pool.submit(fetch, u) for u in todo[:4]]
            for i, url in enumerate(todo):
                im = ahead[i].result()
                ahead[i] = None
                if i + 4 < len(todo):
                    ahead.append(pool.submit(fetch, todo[i + 4]))
                manifest[url] = {**process(session, url, im), 'm': MODEL}
                if i % 25 == 24:
                    save(manifest)
                    print(f'  {i + 1}/{len(todo)}', flush=True)

    # Forget photos that are no longer on the site.
    live = set(urls)
    for url in [u for u in manifest if u not in live]:
        del manifest[url]
    used = {v['k'] for v in manifest.values() if 'k' in v}
    for f in OUT.glob('*.png'):
        if f.stem not in used:
            f.unlink()

    save(manifest)
    done = sum(1 for v in manifest.values() if 'k' in v)
    print(f'{done} masks, {len(manifest) - done} skipped')


if __name__ == '__main__':
    main()
