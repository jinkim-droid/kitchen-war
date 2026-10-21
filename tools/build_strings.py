"""localization/strings.csv(key·en·ko·note) → strings.js 로 바꾼다 (사내 기준 localization:csv-system-language).

사용법 (CSV를 고친 뒤):
    python3 tools/build_strings.py

- CSV는 실행 중이 아니라 여기서 미리 검사·변환한다. 게임은 strings.js 의 키 표만 읽는다.
- 검사: 키 중복·빈 키 없음, 영어(en)는 모든 키에 있어야 함(최종 대체 언어), 다른 언어도 같은 키를 모두 가져야 함,
  {이름} 자리표시는 줄마다 영어와 똑같아야 함. 하나라도 어기면 strings.js 를 만들지 않고 멈춘다.
- '#'으로 시작하는 키는 화면별 구분선이라 건너뛴다. 엑셀에서 열 수 있게 CSV는 UTF-8(BOM 있어도 됨)로 둔다.
"""
import csv
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'localization', 'strings.csv')
OUT = os.path.join(ROOT, 'strings.js')
LOCALES = ['en', 'ko']  # en 이 기본이자 최종 대체 언어
PH = re.compile(r'\{([a-zA-Z][a-zA-Z0-9_]*)\}')


def main():
    rows = list(csv.DictReader(open(SRC, encoding='utf-8-sig', newline='')))
    missing_cols = [c for c in ['key'] + LOCALES if c not in (rows[0].keys() if rows else [])]
    if missing_cols:
        sys.exit(f'CSV 열이 없음: {missing_cols}')
    cat = {loc: {} for loc in LOCALES}
    errors = []
    for i, r in enumerate(rows, start=2):
        key = (r.get('key') or '').strip()
        if not key or key.startswith('#'):
            continue
        if key in cat['en']:
            errors.append(f'{i}행 키 중복: {key}')
            continue
        en = r.get('en') or ''
        if not en.strip():
            errors.append(f'{i}행 영어 비어 있음: {key}')
        want = sorted(PH.findall(en))
        for loc in LOCALES:
            v = r.get(loc) or ''
            if loc != 'en' and not v.strip():
                errors.append(f'{i}행 {loc} 비어 있음: {key}')
            if sorted(PH.findall(v)) != want:
                errors.append(f'{i}행 자리표시가 영어와 다름 ({loc}): {key}  en={want} {loc}={sorted(PH.findall(v))}')
            cat[loc][key] = v
    if errors:
        print('\n'.join(errors))
        sys.exit(f'검사 실패 {len(errors)}건 — strings.js 를 만들지 않았어요')
    body = ',\n'.join(f'  {json.dumps(loc)}: {json.dumps(cat[loc], ensure_ascii=False, indent=None)}' for loc in LOCALES)
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// 자동 생성 — 직접 고치지 말 것. localization/strings.csv 를 고치고 `python3 tools/build_strings.py` 를 돌린다\n')
        f.write(f'const STRINGS = {{\n{body}\n}};\n')
    print(f'strings.js: {len(cat["en"])}키 × {len(LOCALES)}언어 ({", ".join(LOCALES)})')


if __name__ == '__main__':
    main()
