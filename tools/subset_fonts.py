"""숫자·영문 폰트에서 게임에 쓰는 글자만 남겨 줄인다 (사내 기준 ux:fonts-and-text '정해진 문자 집합으로 폰트를 줄일 때').

사용법:
    ~/.venvs/fonttools/bin/python tools/subset_fonts.py
    (처음 한 번: python3 -m venv ~/.venvs/fonttools && ~/.venvs/fonttools/bin/pip install fonttools brotli)

- 글자는 두 폰트로 나눠 그린다 (2026-10-21 사용자 결정):
  · 숫자·영문·숫자 기호(x6.25, 2.68K, Stage 27-1, 22%) → Rounded Mplus 1c Black (SIL OFL — assets/fonts/OFL-Mplus.txt)
  · 한글·나머지 → 온글잎 밑미. 라이선스가 수정을 금지해서 서브셋하지 않고 TTF 원본 그대로 둔다.
- 남기는 글자 집합은 style.css의 Mplus @font-face unicode-range와 같아야 한다 (MPLUS_CHARS).
  숫자 표시는 실행 중에 바뀌므로 화면 문구와 상관없이 집합 전체를 남긴다.
- 영어 화면은 mplus-en.woff2(ASCII 전체 + 라틴 글자)로 문장 전체를 그린다 (style.css "Game Font EN", html[lang=en]).
- 원본 TTF는 tools/fonts-src/ 에 두고(게임 폴더에 넣지 않음), 결과 WOFF2만 assets/fonts/ 에 쓴다.
"""
import os

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'fonts-src')
OUT = os.path.join(ROOT, 'assets', 'fonts')
# style.css unicode-range: U+0025, U+002B-003A, U+0041-005A, U+0061-007A
MPLUS_CHARS = '%' + ''.join(chr(c) for c in range(0x2B, 0x3B)) \
    + ''.join(chr(c) for c in range(0x41, 0x5B)) + ''.join(chr(c) for c in range(0x61, 0x7B))


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
          f'{len(cmap)}자' + (f', 폰트에 없는 글자 {len(missing)}개: {"".join(missing)}' if missing else ''))


# 영어 화면용: 문장 전체를 Mplus로 (style.css "Game Font EN") — ASCII 전체 + 라틴 글자(Pâtissier 등) + 문장부호
MPLUS_EN_CHARS = ''.join(chr(c) for c in range(0x20, 0x7F)) + ''.join(chr(c) for c in range(0xA0, 0x100)) + '…—–·×‘’“”→•'


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    make('MPLUSRounded1c-Black.ttf', 'mplus-num.woff2', MPLUS_CHARS)
    make('MPLUSRounded1c-Black.ttf', 'mplus-en.woff2', MPLUS_EN_CHARS)
