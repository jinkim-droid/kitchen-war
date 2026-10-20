"""새로 받은 PNG 에셋을 게임용 WebP로 바꾸고 assets/img/manifest.json 을 다시 만든다.

사용법:
    python3 tools/convert_assets.py "/path/to/받은 폴더/game"

- 투명 PNG는 알파를 유지한 WebP(화질 85)로, 배경(bg_*)은 불투명 WebP로 바꾼다.
- 화면 크기 × 3보다 훨씬 큰 그림(타이틀·로고·간판)은 줄인다 (사내 기준 ux:raster-density).
- 게임은 manifest.json 에 있는 그림만 불러오고, 없는 그림은 임시 그림으로 대신한다.
"""
import glob
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, 'assets', 'img')
MAX_W = {'ui_title_art': 1536, 'ui_logo': 1680}
MAX_W_PREFIX = {'ui_chapter_': 1024}


def max_width(name):
    if name in MAX_W:
        return MAX_W[name]
    for p, w in MAX_W_PREFIX.items():
        if name.startswith(p):
            return w
    return None


def convert(src_dir):
    os.makedirs(DST, exist_ok=True)
    n = tin = tout = 0
    for f in sorted(glob.glob(os.path.join(src_dir, '*.png'))):
        name = os.path.basename(f)[:-4]
        im = Image.open(f)
        opaque = name.startswith('bg_')
        im = im.convert('RGB' if opaque else 'RGBA')
        mw = max_width(name)
        if mw and im.width > mw:
            im = im.resize((mw, round(im.height * mw / im.width)), Image.LANCZOS)
        out = os.path.join(DST, name + '.webp')
        im.save(out, 'WEBP', quality=85, method=6)
        n += 1
        tin += os.path.getsize(f)
        tout += os.path.getsize(out)
    print(f'{n}장 변환: {tin / 1048576:.1f}MB -> {tout / 1048576:.2f}MB')


def write_manifest():
    names = sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(DST, '*.webp')))
    with open(os.path.join(DST, 'manifest.json'), 'w') as fp:
        json.dump(names, fp, ensure_ascii=False, indent=0)
    print(f'manifest.json: {len(names)}장')


if __name__ == '__main__':
    if len(sys.argv) > 1:
        convert(sys.argv[1])
    write_manifest()
