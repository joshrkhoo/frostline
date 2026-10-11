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
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'public' / 'data' / 'boards.json'
OUT = ROOT / 'public' / 'cutouts'
MANIFEST = OUT / 'index.json'

MODEL = 'birefnet-general'  # the lighter models lose white boards on white backdrops
SOURCE_WIDTH = 1200  # photo width the mask is computed from
MASK_MAX = 1000  # longest side of the saved mask
EDGE = 2  # px band at the outline that keeps the model's soft alpha
OFF_FRAME = 0.12  # share of a photo's side the board can cover before it counts as cut off


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


def make_mask(session, im: Image.Image) -> np.ndarray:
    from rembg import remove

    rgb = im.convert('RGB')
    a = np.asarray(remove(rgb, session=session, only_mask=True)).astype(np.float32)
    # Respect transparency the photo already has.
    a = np.minimum(a, np.asarray(im)[:, :, 3])
    solid = a > 100
    # Pale boards can come out see-through; anything enclosed by the outline is board.
    filled = ndimage.binary_fill_holes(solid)
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
    mask = make_mask(session, im)
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
    if ends > 0.3 or sides > OFF_FRAME:
        out['c'] = 1
    # Lying sideways or shot at an angle: fine in a gallery, odd on a card.
    if x1 - x0 > y1 - y0:
        out['w'] = 1
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
    print(f'{len(urls)} photos, {len(todo)} to process')

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
