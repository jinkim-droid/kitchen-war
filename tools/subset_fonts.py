"""게임에 쓰는 글자만 남겨 폰트를 줄인다 (사내 기준 ux:fonts-and-text '정해진 문자 집합으로 폰트를 줄일 때').

사용법 (게임 글자를 바꾼 뒤 다시 실행):
    python3 tools/subset_fonts.py

- 주아 한 가지로 모든 글자를 그린다: ASCII 전체(U+0020~007E — 숫자 표시는 실행 중에 바뀌므로 전부)
  + index.html·main.js·sound.js·style.css에 실제로 나오는 한글·기호만 남긴다.
- 원본 TTF는 tools/fonts-src/ 에 두고(게임 폴더에 넣지 않음), 결과 WOFF2만 assets/fonts/ 에 쓴다.
- 서브셋에 없는 글자는 style.css의 폴백 체인(시스템 글꼴)으로 그려진다. 새 문구를 넣었으면 꼭 다시 돌린다.

필요: pip install fonttools brotli
"""
import os
import re

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'fonts-src')
OUT = os.path.join(ROOT, 'assets', 'fonts')
SOURCES = ['index.html', 'main.js', 'base.js', 'tutorial.js', 'sound.js', 'style.css']
ASCII = ''.join(chr(c) for c in range(0x20, 0x7F))


def game_chars():
    text = ''.join(open(os.path.join(ROOT, f), encoding='utf-8').read() for f in SOURCES)
    # 이모지·제어 문자는 주아에 없으니 빼고, 한글·기호·문장부호를 모은다
    chars = {ch for ch in text if ord(ch) >= 0x80 and not (0x1F000 <= ord(ch) <= 0x1FFFF) and not (0xFE00 <= ord(ch) <= 0xFE0F)}
    return ''.join(sorted(chars))


def make(src_name, out_name, text):
    src = os.path.join(SRC, src_name)
    out = os.path.join(OUT, out_name)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    font = subset.load_font(src, opts)
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    subset.save_font(font, out, opts)
    # 확인: 결과 cmap에 있어야 할 글자가 모두 있는지
    cmap = TTFont(out).getBestCmap()
    missing = [ch for ch in text if ord(ch) not in cmap]
    print(f'{out_name}: {os.path.getsize(src) / 1024:.0f}KB -> {os.path.getsize(out) / 1024:.1f}KB, '
          f'{len(cmap)}자' + (f', 폰트에 없는 글자 {len(missing)}개: {"".join(missing)[:40]}' if missing else ''))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    chars = game_chars()
    print(f'게임 글자(ASCII 밖) {len(chars)}자')
    make('Jua-Regular.ttf', 'jua-game.woff2', ASCII + chars)
