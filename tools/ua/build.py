#!/usr/bin/env python3
"""녹화 프레임 → 30초 9:16 트레일러 (python3 build.py ko|en)
컷: 오프닝 3.0 · 대군 3.0 · 전투 5.0 · 성장 6.5 · 보스 7.0 · 장소(화면 분할) 2.5 · 엔드카드 3.0 = 30.0초
게임 픽셀은 그대로 두고 배속·확대·흐림·손·자막만 합성 단계에서 얹는다."""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = '/Users/jinkim/Documents/gamejam'
LANG = sys.argv[1] if len(sys.argv) > 1 else 'ko'
FPS = 30
OUT = os.path.join(HERE, 'render', LANG)
os.makedirs(OUT, exist_ok=True)

# 효과음 크기·간격 (sound.js SAMPLE 그대로)
SAMPLE = {'throw': (0.18, 90), 'hit': (0.25, 80), 'coin': (0.35, 90), 'merge': (0.5, 200), 'warn': (0.55, 800), 'clear': (0.5, 500),
          'boss': (0.55, 500), 'wall': (0.6, 800), 'bossHit': (0.25, 90), 'kill': (0.25, 60), 'coinTick': (0.12, 55), 'buy': (0.35, 60),
          'claim': (0.45, 150), 'prestige': (0.55, 800), 'retreat': (0.45, 500), 'hurt': (0.35, 150), 'stun': (0.35, 300)}

def log(scene):
    return json.load(open(os.path.join(HERE, 'out', f'{scene}_{LANG}', 'log.json')))

def marks(scene, name):
    return [m for m in log(scene)['marks'] if m['name'] == name]

# 세그먼트: scene, 시작 프레임, 프레임 수, 최종 길이(초), 자막
SEGS = [
    # 후킹 애니메이션(사용자 제작, 3초·투명 끝): 냉장고 → 채소 군단 → 셰프 곰 팬 스윙. 79프레임부터 팬 스윙 모양으로 투명해져 뒤 게임 화면이 드러남
    dict(key='intro', kind='alpha', src=os.path.join(HERE, 'art', 'hook_alpha.webm'), dur=3.0, sub=None),
    dict(key='hook', scene='horde', start=146, count=94, dur=3.0, sub=None),     # 대군 모드(창고)
    # 일반 스테이지(홀 34-4, 손 안 댐): 앞 4초는 보통 속도, 뒤 2.5초는 빨리감기로 보스 처치 → Stage 35까지 (방치형 — 알아서 진행)
    dict(key='stage', scene='stage', start=125, count=975, dur=6.5, sub=None, ramp=dict(t1=120, s1=1.0), until_clear=50, start_by_lang={'ko': 125, 'en': 205}, count_by_lang={'ko': 975}),  # KR은 사운드가 맞춰진 판(count 975) 그대로  # 끝 = 보스 처치(clear) 뒤 50프레임 — 언어마다 녹화가 달라 로그에서 계산
    dict(key='grow', scene='grow', start=6, count=188, dur=5.0, sub=None),       # 연쇄 합성 + 카드 연타
    dict(key='boss', scene='boss', start=0, count=266, dur=7.0, sub=None),       # 대왕 케이크
    dict(key='places', kind='places', scene='chapters', dur=2.5, sub=None),      # 장소 5곳 대각선 분할
]
END_DUR = 3.0
# 컷 사이 전환(겹치는 xfade): 앞뒤 장면이 함께 움직이며 넘어간다. 경계 시각은 그대로(전환 길이의 절반씩 앞뒤 장면을 늘림)
TRANS = [('alpha', 11 / 30),  # 후킹 영상의 투명 끝(79~89프레임) 밑으로 대군 화면
          ('slideleft', 10 / 30), ('slideright', 10 / 30), ('slideup', 12 / 30), ('slideleft', 10 / 30)]  # 오프닝→대군, 대군→일반, 일반→성장, 성장→보스, 보스→장소. 장소→엔드카드는 하드컷
PROLOGUE = f'{GAME}/assets/video/prologue.mp4'
SOUND_FILE = os.path.join(HERE, 'art', 'trailer_sound.m4a')  # 사용자 제작 최종 사운드(30초) — 있으면 이걸로 덮음 (KR·EN 같은 소리)
HAND_W, TIP = 200, (100, 18)  # 손 그림 폭·손끝 위치(그림 안)

def loc(seg, f):
    """원본 프레임 → 세그먼트 안 프레임 (뺀 구간이면 None)"""
    c = seg.get('cut')
    if c:
        if c[0] <= f < c[1]:
            return None
        if f >= c[1]:
            f -= c[1] - c[0]
    return f - seg['start']

def seg_source(seg):
    """뺀 구간이 있으면 남는 프레임만 이어 번호를 새로 매긴 폴더를 만든다"""
    d = os.path.join(HERE, 'out', f"{seg['scene']}_{LANG}")
    c = seg.get('cut')
    if not c:
        return os.path.join(d, 'f%05d.jpg'), seg['start']
    t = os.path.join(OUT, f"frames_{seg['key']}")
    if os.path.isdir(t):
        for x in os.listdir(t): os.remove(os.path.join(t, x))
    os.makedirs(t, exist_ok=True)
    keep = [f for f in range(seg['start'], seg['start'] + seg['count'] + (c[1] - c[0])) if not (c[0] <= f < c[1])]
    for i, f in enumerate(keep[:seg['count']]):
        os.symlink(os.path.join(d, f'f{f:05d}.jpg'), os.path.join(t, f'f{i:05d}.jpg'))
    return os.path.join(t, 'f%05d.jpg'), 0

def hand_events(seg):
    """손 오버레이: (보일 구간 a~b 로컬 프레임, x식, y식) — 좌표는 CSS px × 1.5"""
    ev = []
    L = log(seg['scene'])['marks']
    def P(v): return v * 1.5
    for i, m in enumerate(L):
        if m['name'] == 'tap':
            f = loc(seg, m['frame'])
            if f is None: continue
            x, y = P(m['x']) - TIP[0], P(m['y']) - TIP[1]
            # 누르는 3프레임 동안 살짝 눌림
            ev.append((f - 8, f + 9, f'{x:.0f}', f'{y:.0f}+if(between(n,{f},{f + 3}),10,0)'))
        if m['name'] == 'drag':
            f0 = loc(seg, m['frame'])
            if f0 is None: continue
            f0 += 5
            x1, y1, x2, y2 = P(m['x']) - TIP[0], P(m['y']) - TIP[1], P(m['x2']) - TIP[0], P(m['y2']) - TIP[1]
            e = f'(1-pow(1-clip((n-{f0})/18,0,1),2))'
            ev.append((f0 - 10, f0 + 18 + 6, f'{x1:.0f}+({x2 - x1:.0f})*{e}', f'{y1:.0f}+({y2 - y1:.0f})*{e}'))
        if m['name'] == 'rapid':  # 연타: 손 하나가 머물며 누를 때마다 살짝 눌림
            pr = [loc(seg, q['frame']) for q in L[:i] if q['name'] == 'press' and m['frame'] - m['n'] * m['gap'] - 2 <= q['frame'] <= m['frame']]
            pr = [f for f in pr if f is not None]
            if pr:
                flip = P(m['y']) > 1400
                x = P(m['x']) - TIP[0]
                y = P(m['y']) - (HAND_W - TIP[1] if flip else TIP[1])
                press = '+'.join(f'between(n,{f},{f + 1})' for f in pr)
                ev.append((pr[0] - 8, pr[-1] + 8, f'{x:.0f}', f'{y:.0f}+if({press},{-12 if flip else 12},0)', flip))
        if m['name'] == 'joy':
            f0 = loc(seg, m['frame'])
            end = loc(seg, next(n['frame'] for n in L[i:] if n['name'] == 'joy_end'))
            if f0 is None or end is None: continue
            x1, y1, x2, y2 = P(m['x']) - TIP[0], P(m['y']) - TIP[1], P(m['x2']) - TIP[0], P(m['y2']) - TIP[1]
            e = f'clip((n-{f0})/8,0,1)'
            ev.append((f0 - 8, end + 3, f'{x1:.0f}+({x2 - x1:.0f})*{e}', f'{y1:.0f}+({y2 - y1:.0f})*{e}'))
    ev = [e if len(e) == 5 else (*e, False) for e in ev]
    return [e for e in ev if e[1] >= 0 and e[0] < seg['count']]

# 타격감: 게임에서 실제로 일어난 사건(소리 로그·마크)의 시각에만 줌 펀치·흔들림·플래시를 건다
# kind: (줌 +, 흔들림 px, 플래시 알파, 같은 종류 최소 간격 출력프레임)
HIT = {'buy': (0.018, 0, 0, 3), 'kill': (0.035, 10, 0, 5), 'bossHit': (0.015, 6, 0, 4), 'wall': (0.06, 24, 0.35, 0), 'slam': (0.09, 26, 0.45, 0),
       'clear': (0.12, 30, 0.6, 0), 'merge': (0.06, 0, 0.25, 0)}

def tmap(seg, f, speed):
    """세그먼트 안 원본 프레임 → 출력 프레임 (빨리감기 구간이 있으면 두 속도)"""
    r = seg.get('_ramp')
    if not r:
        return f / speed
    return f / r['s1'] if f <= r['t1'] else r['t1'] / r['s1'] + (f - r['t1']) / r['s2']

def fast(seg, f):
    r = seg.get('_ramp')
    return bool(r) and f > r['t1']

def impact_events(seg, speed):
    L = log(seg['scene'])
    raw = []
    for snd in L['sounds']:
        f = loc(seg, snd['t'] * FPS - 1)
        if snd['n'] in HIT and f is not None and not fast(seg, f):
            raw.append((tmap(seg, f, speed), snd['n']))
    for m in L['marks']:
        f = loc(seg, m['frame'])
        if m['name'] == 'slam' and f is not None:
            raw.append((tmap(seg, f, speed), 'slam'))
    n_out = round(seg['rdur'] * FPS)
    raw = sorted(r for r in raw if 0 <= r[0] < n_out - 2)
    if seg['key'] == 'boss':  # 내려치기는 한 번만(첫 장)
        sl = [r for r in raw if r[1] == 'slam'][:1]
        raw = [r for r in raw if r[1] != 'slam'] + sl
    last, ev = {}, []
    for o, k in sorted(raw):
        if o - last.get(k, -99) < max(HIT[k][3], 1):
            continue
        last[k] = o
        ev.append((o, k))
    return ev

def chain_max(parts):
    e = parts[0]
    for p in parts[1:]:
        e = f'max({e},{p})'  # ffmpeg 식의 max는 인자 2개뿐
    return e

def zoom_expr(seg, speed, rdur):
    """zoompan z·x·y (on = 세그먼트 출력 프레임) + 플래시 구간"""
    n_out = round(rdur * FPS)
    parts = ['1.05']  # 흔들 여유
    if seg['key'] == 'hook':
        parts.append(f'1.05+0.07*on/{n_out}')  # 훅: 천천히 밀고 들어감
    if seg['key'] == 'offline':  # 보상 창이 떠 있는 동안 창 쪽으로 당겨 크게
        o1 = loc(seg, marks('offline', 'popup')[0]['frame']) / speed
        o2 = loc(seg, marks('offline', 'tap_ok')[0]['frame']) / speed
        parts.append(f'1.05+0.2*clip((on-{o1:.1f})/6,0,1)*clip(({o2:.1f}+4-on)/6,0,1)')
    base = chain_max(parts)
    ev = impact_events(seg, speed)
    if seg['key'] == 'grow':
        ev += [(tmap(seg, loc(seg, m['frame']), speed), 'merge') for m in marks('grow', 'drag_end') if loc(seg, m['frame']) is not None]
    bumps, sx, sy, flash = [], [], [], []
    for o, k in ev:
        zz, sh, fl, _ = HIT[k]
        d = f'(on-{o:.1f})'
        g = f'if(gte(on,{o:.1f}),exp(-{d}/3.5),0)'
        if zz: bumps.append(f'{zz}*{g}')
        if sh:
            sx.append(f'{sh}*{g}*sin({d}*2.4)')
            sy.append(f'{sh * 0.7:.0f}*{g}*cos({d}*2.9)')
        if fl: flash.append((round(o), fl))
    z = base + ('+' + '+'.join(bumps) if bumps else '')
    X = 'iw/2-(iw/zoom/2)' + ('+' + '+'.join(sx) if sx else '')
    Y = 'ih/2-(ih/zoom/2)' + ('+' + '+'.join(sy) if sy else '')
    if seg['key'] == 'grow':  # 도구함을 닫은 뒤(카드 연타)는 흔들 여유 확대(1.05)도 풀어 화면 전체 — 아래 카드가 잘리지 않게
        c = loc(seg, marks('grow', 'closed')[0]['frame'])
        o = tmap(seg, c, speed)
        k = f'clip((on-{o:.1f})/8,0,1)'
        z = f'max(1,({z})-0.05*{k})'
    X = f'clip({X},0,iw-iw/zoom)'; Y = f'clip({Y},0,ih-ih/zoom)'
    return z, X, Y, flash, len(ev)

def build_segment(seg):
    rdur = seg['rdur']
    speed = seg['count'] / FPS / rdur
    n_out = round(rdur * FPS)
    rp = seg.get('ramp')
    if rp:  # 앞은 s1 속도, 나머지는 남은 출력 프레임에 맞춰 빨리감기
        d_in_f = round(seg['_d_in'] * FPS)
        t1 = rp['t1'] + d_in_f * rp['s1']
        out1 = t1 / rp['s1']
        seg['_ramp'] = dict(t1=t1, s1=rp['s1'], s2=(seg['count'] - t1) / (n_out - out1), out1=out1)
        print(f"  빨리감기: {seg['_ramp']['s2']:.1f}배 ({out1 / FPS:.2f}초부터)")
    src, st = seg_source(seg)
    inputs = ['-framerate', str(FPS), '-start_number', str(st), '-i', src,
              '-i', os.path.join(HERE, 'art', 'ui_tut_hand.png')]
    fc = [f"[0:v]trim=end_frame={seg['count']},setpts=PTS-STARTPTS,format=rgb24[v0]", f"[1:v]scale={HAND_W}:-1[hand]"]
    cur = 'v0'
    hev = hand_events(seg)
    if hev:
        fc.append(f"[hand]split={len(hev)}" + ''.join(f'[h{i}r]' for i in range(len(hev))))
        for i, e in enumerate(hev):
            fc.append(f"[h{i}r]{'vflip' if e[4] else 'null'}[h{i}]")
        for i, (a, b, xe, ye, _) in enumerate(hev):
            fc.append(f"[{cur}][h{i}]overlay=x='{xe}':y='{ye}':enable='between(n,{a},{b})':eval=frame[vh{i}]")
            cur = f'vh{i}'
    else:
        fc.append('[hand]nullsink')
    # 배속(합성 단계 리타이밍) → 30fps
    if seg.get('_ramp'):
        r = seg['_ramp']
        fc.append(f"[{cur}]setpts='if(lt(N,{r['t1']:.2f}),N/{r['s1']:.5f},{r['out1']:.3f}+(N-{r['t1']:.2f})/{r['s2']:.5f})/({FPS}*TB)'[{cur}r]"); cur = cur + 'r'
        speed = 1.0
    fc.append(f"[{cur}]setpts=PTS/{speed:.5f},fps={FPS},tpad=stop_mode=clone:stop_duration=0.2,trim=end_frame={n_out},setpts=PTS-STARTPTS[vs]")
    z, X, Y, flash, nev = zoom_expr(seg, speed, rdur)
    print(f"  {seg['key']}: 타격 연출 {nev}개")
    fc.append(f"[vs]format=yuv444p,zoompan=z='{z}':x='{X}':y='{Y}':d=1:s=1080x1920:fps={FPS}[vz]")
    fc.append('[vz]null[vb]')
    cur = 'vb'
    for i, (o, al) in enumerate(flash):  # 큰 사건 순간 흰 번쩍임(2~3프레임)
        fc.append(f"color=white:s=1080x1920:r={FPS}:d={rdur},format=rgba,colorchannelmixer=aa={al}[fl{i}]")
        fc.append(f"[{cur}][fl{i}]overlay=enable='between(n,{o},{o + 2})'[vfl{i}]"); cur = f'vfl{i}'
    if seg.get('_ramp'):  # 빨리감기 동안 가운데 아래에 배지 — 게임 2배속 아이콘(모래시계)이 빙글빙글 돎, 톡 튀어나옴
        o = seg['_ramp']['out1'] / FPS
        inputs += ['-loop', '1', '-framerate', str(FPS), '-t', f'{rdur + 0.2:.3f}', '-i', os.path.join(HERE, 'ov', LANG, 'ff_badge.png'),
                   '-loop', '1', '-framerate', str(FPS), '-t', f'{rdur + 0.2:.3f}', '-i', os.path.join(HERE, 'art', 'icon_boost.png')]
        fc.append(f"[3:v]format=rgba,scale=-1:170,rotate=a='2*PI*1.4*t':c=none:ow=hypot(iw\\,ih):oh=ow[hg]")
        fc.append(f"[2:v]format=rgba[bd]")
        fc.append(f"[bd][hg]overlay=x='170-w/2':y='130-h/2'[bdg]")
        pop = f"(1+0.4*max(0,1-(t-{o:.3f})/0.16))"
        fc.append(f"[bdg]scale=w='trunc(iw*{pop}/2)*2':h='trunc(ih*{pop}/2)*2':eval=frame[ff]")
        fc.append(f"[{cur}][ff]overlay=x='540-w/2':y='1430-h/2':eval=frame:enable='gte(t,{o:.3f})'[vff]"); cur = 'vff'
    if seg['key'] == 'chapters':  # 장소가 바뀌는 순간마다 짧은 플래시
        cuts = [round((i * 42 - seg['start']) / speed) for i in range(1, 5)]
        en = '+'.join(f'between(n,{c},{c + 2})' for c in cuts)
        fc.append(f"color=white:s=1080x1920:r={FPS}:d={rdur},format=rgba,colorchannelmixer=aa=0.6[wf]")
        fc.append(f"[{cur}][wf]overlay=enable='{en}'[vf]"); cur = 'vf'
    fc.append(f"[{cur}]format=yuv420p,setsar=1[out]")
    out = os.path.join(OUT, f"seg_{seg['key']}.mp4")
    cmd = ['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[out]', '-frames:v', str(n_out),
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-r', str(FPS), out]
    subprocess.run(cmd, check=True)
    return out, speed

def enc(fc, ins, out, n):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(fc), '-map', '[out]', '-frames:v', str(n),
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-r', str(FPS), out], check=True)

def build_intro(seg):
    """게임 오프닝 영상(720×1280·24fps)을 1080×1920·30fps로"""
    n = round(seg['rdur'] * FPS)
    out = os.path.join(OUT, 'seg_intro.mp4')
    enc([f"[0:v]fps={FPS},scale=1080:1920:flags=lanczos,format=yuv420p,setsar=1[out]"], ['-ss', str(seg['ss']), '-t', f"{seg['rdur'] + 0.2:.3f}", '-i', PROLOGUE], out, n)
    return out, 1.0

PLACE3 = [(0, -630), (1, 10), (2, 650)]   # 3분할: (장소 클립, 세로 이동) — 대각선 칸 가운데에 셰프가 오게
PLACE2 = [(3, -470), (4, 490)]             # 2분할
TAG3 = [200, 530, 1170]                    # 이름표 세로 자리(왼쪽 위, 칸 안)
TAG2 = [200, 1140]
def build_places(seg):
    """장소 5곳: 대각선 3분할(기울어진 칸이 번갈아 좌우에서 밀려 들어오고, 크림색 사선이 양쪽에서 그어지며, 이름표가 톡) → 대각선 전환 → 대각선 2분할
    칸 안은 천천히 밀고 들어가는 줌"""
    n = round(seg['rdur'] * FPS)
    d = 8
    n1 = (n + d) // 2 + 4; n2 = n + d - n1
    seg['n1'], seg['n2'], seg['d'] = n1, n2, d
    src = os.path.join(HERE, 'out', f"{seg['scene']}_{LANG}", 'f%05d.jpg')
    ins, fc = [], []
    for k in range(5):
        ins += ['-framerate', str(FPS), '-start_number', str(k * 42), '-i', src]
    img = lambda f: ['-loop', '1', '-framerate', str(FPS), '-t', f'{n / FPS + 0.3:.3f}', '-i', f]
    for m in ['m3_0', 'm3_1', 'm3_2', 'm2_0', 'm2_1', 's3_1', 's3_2', 's2_1']:
        ins += img(os.path.join(HERE, 'art', f'{m}.png'))   # 입력 5~12
    BG = '0x3a2418'
    ease = lambda t0, dur: f"(1-pow(1-clip((t-{t0})/{dur},0,1),3))"
    def panel(k, shift, mi, nf, tag):
        fc.append(f"[{k}:v]trim=end_frame=42,setpts=(PTS-STARTPTS)*{nf / 42:.4f},fps={FPS},format=yuv444p,"
                  f"zoompan=z='1.0+0.07*on/{nf}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps={FPS},format=rgba[c{tag}]")
        fc.append(f"color=black@0:s=1080x1920:r={FPS},format=rgba[cv{tag}]")
        fc.append(f"[cv{tag}][c{tag}]overlay=y={shift}:shortest=1[pc{tag}]")
        fc.append(f"[{5 + mi}:v]format=gray[mk{tag}]")
        fc.append(f"[pc{tag}][mk{tag}]alphamerge[pm{tag}]")
    # 3분할
    fc.append(f"color={BG}:s=1080x1920:r={FPS}:d={n1 / FPS + 0.2:.3f}[bg1]")
    cur = 'bg1'
    for i, (k, sh) in enumerate(PLACE3):
        panel(k, sh, i, n1, f'a{i}')
        side = 1 if i % 2 == 0 else -1
        fc.append(f"[{cur}][pma{i}]overlay=x='{side}*1180*(1-{ease(0.08 * i, 0.24)})':y=0:eval=frame[o{i}]")
        cur = f'o{i}'
    for j, (li, side) in enumerate([(10, -1), (11, 1)]):  # 사선이 양쪽에서 그어짐
        fc.append(f"[{cur}][{li}:v]overlay=x='{side}*1180*(1-{ease(0.30 + 0.05 * j, 0.16)})':y=0:eval=frame[l{j}]")
        cur = f'l{j}'
    fc.append(f"[{cur}]trim=end_frame={n1},setpts=PTS-STARTPTS,format=yuv420p[ph1]")
    # 2분할
    fc.append(f"color={BG}:s=1080x1920:r={FPS}:d={n2 / FPS + 0.2:.3f}[bg2]")
    cur = 'bg2'
    for j, (k, sh) in enumerate(PLACE2):
        panel(k, sh, 3 + j, n2, f'b{j}')
        fc.append(f"[{cur}][pmb{j}]overlay=x=0:y=0[q{j}]")
        cur = f'q{j}'
    fc.append(f"[{cur}][12:v]overlay=x='1180*(1-{ease(0.12, 0.16)})':y=0:eval=frame[ql]"); cur = 'ql'
    fc.append(f"[{cur}]trim=end_frame={n2},setpts=PTS-STARTPTS,format=yuv420p[ph2]")
    fc.append(f"[ph1][ph2]xfade=transition=diagtr:duration={d / FPS:.4f}:offset={(n1 - d) / FPS:.4f},format=yuv420p,setsar=1[out]")
    out = os.path.join(OUT, 'seg_places.mp4')
    enc(fc, ins, out, n)
    return out, 1.0

def places_sfx(seg, start):
    """장소 클립마다 게임이 낸 소리를 칸이 보이는 시각으로 옮긴다"""
    L = log(seg['scene']); ev = []
    phases = [([k for k, _ in PLACE3], 0.0, seg['n1']), ([k for k, _ in PLACE2], (seg['n1'] - seg['d']) / FPS, seg['n2'])]
    for clips, off, nf in phases:
        for k in clips:
            for snd in L['sounds']:
                if snd['n'] not in SAMPLE: continue
                loc = snd['t'] - k * 42 / FPS - 1 / FPS
                if 0 <= loc < 42 / FPS:
                    ev.append((start + off + loc * nf / 42, snd['n']))
    return ev

ENDCARD_ANIM = os.path.join(HERE, 'art', 'endcard_anim.mp4')  # 사용자 제작 엔드카드 애니메이션(3초, 로고·CTA 없음) — 없으면 타이틀 그림
LOGO_W, LOGO_CY, CTA_CY = 900, 360, 1690  # 로고는 위쪽 창문·벽 자리, CTA는 곰 발아래 바닥(75% 선 아래, 아래 끝에서 4% 이상 띄움)

def build_endcard():
    """엔드카드: 애니메이션 위에 로고·CTA를 첫 프레임부터 끝까지 — 로고는 통 튀며 자리 잡고, CTA는 따라 튄 뒤 숨 쉬듯 커졌다 작아짐"""
    out = os.path.join(OUT, 'seg_end.mp4')
    n = round(END_DUR * FPS)
    L = json.load(open(os.path.join(HERE, 'ov', LANG, 'end_layers.json')))
    lg, ct = L['logo'], L['cta']
    lw, lh = LOGO_W, lg['height'] * LOGO_W / lg['width']
    ov = lambda f: ['-loop', '1', '-framerate', str(FPS), '-t', str(END_DUR + 0.2), '-i', os.path.join(HERE, 'ov', LANG, f)]
    ls = "(1+0.22*exp(-t*7)*cos(t*24))"
    cs = "(1+0.18*exp(-max(0,t-0.05)*7)*cos(max(0,t-0.05)*26)+0.035*sin(2*PI*1.6*t)*min(1,t/0.7))"
    if os.path.exists(ENDCARD_ANIM):
        base = ['-i', ENDCARD_ANIM]
        fc0 = f"[0:v]fps={FPS},scale=1080:1920,setsar=1,format=rgba[bg]"
    else:
        base = ['-loop', '1', '-framerate', str(FPS), '-i', os.path.join(HERE, 'ov', LANG, 'end_bg.png')]
        fc0 = f"[0:v]zoompan=z='1.06-0.05*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps={FPS},format=rgba[bg]"
    fc = [fc0,
          f"[1:v]format=rgba,scale=w='trunc({lw:.0f}*{ls}/2)*2':h='trunc({lh:.0f}*{ls}/2)*2':eval=frame[lg]",
          f"[2:v]format=rgba,scale=w='trunc({ct['width']:.0f}*{cs}/2)*2':h='trunc({ct['height']:.0f}*{cs}/2)*2':eval=frame[ct]",
          f"[bg][lg]overlay=x='540-w/2':y='{LOGO_CY}-h/2':eval=frame[a]",
          f"[a][ct]overlay=x='540-w/2':y='{CTA_CY}-h/2':eval=frame,format=yuv420p,setsar=1[out]"]
    enc(fc, [*base, *ov('end_logo.png'), *ov('end_cta.png')], out, n)
    return out

def sfx_events(seg, t0, speed):
    L = log(seg['scene'])
    ev = []
    for snd in L['sounds']:
        n = snd['n']
        if n not in SAMPLE or not os.path.exists(f'{GAME}/assets/sfx/{n}.mp3'):
            continue
        f = loc(seg, snd['t'] * FPS - 1)
        if f is None or f < 0 or f > seg['count']:
            continue
        if fast(seg, f) and n not in ('warn', 'boss', 'clear', 'kill'):
            continue
        ev.append((t0 + tmap(seg, f, speed) / FPS, n))
    return ev

def subtitle_pass(video, windows):
    """자막은 이어 붙인 뒤 한 번에: 늘 같은 자리(위쪽 가운데 띠), 전환 한가운데서 바뀌고 톡 튀어나오며 등장"""
    ins, fc, cur = ['-i', video], [], '0:v'
    BAND_Y, BAND_H = 80, 220
    for i, (key, t0, t1) in enumerate(windows):
        ins += ['-loop', '1', '-framerate', str(FPS), '-t', f'{t1:.3f}', '-i', os.path.join(HERE, 'ov', LANG, f'sub_{key}.png')]
        pop = f"(1+0.22*max(0,1-(t-{t0:.3f})/0.16))"
        fc.append(f"[{i + 1}:v]format=rgba,crop=1080:{BAND_H}:0:{BAND_Y},scale=w='trunc(1080*{pop}/2)*2':h='trunc({BAND_H}*{pop}/2)*2':eval=frame,"
                  f"fade=in:st={t0:.3f}:d=0.08:alpha=1[s{i}]")
        fc.append(f"[{cur}][s{i}]overlay=x='(W-w)/2':y='{BAND_Y}+({BAND_H}-h)/2':eval=frame:enable='between(t,{t0:.3f},{t1 - 0.001:.3f})'[o{i}]")
        cur = f'o{i}'
    out = video.replace('.mp4', '_sub.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(fc), '-map', f'[{cur}]', '-c:v', 'libx264', '-preset', 'medium',
                    '-crf', '14', '-r', str(FPS), '-pix_fmt', 'yuv420p', out], check=True)
    return out

def main():
    # 경계 시각(전환 한가운데)
    bounds, t = [], 0.0
    for seg in SEGS:
        t += seg['dur']; bounds.append(t)
    segs, ev, windows = [], [], []
    for i, seg in enumerate(SEGS):
        if seg.get('start_by_lang'):  # 처치가 몰린 구간이 언어별 녹화마다 달라서
            seg['start'] = seg['start_by_lang'][LANG]
        if LANG in seg.get('count_by_lang', {}):
            seg['count'] = seg['count_by_lang'][LANG]
        elif seg.get('until_clear'):  # 그 언어 녹화의 보스 처치 시각에 맞춰 길이를 정함
            cl = min(round(x['t'] * FPS) for x in log(seg['scene'])['sounds'] if x['n'] == 'clear')
            seg['count'] = cl + seg['until_clear'] - seg['start']
        d_in = TRANS[i - 1][1] if i > 0 else 0
        d_out = TRANS[i][1] if i < len(TRANS) else 0
        # 알파 전환은 앞 영상(투명 끝)이 길이를 그대로 갖고, 뒤 장면이 겹치는 만큼 전부 앞당겨 시작
        e_in = d_in if i > 0 and TRANS[i - 1][0] == 'alpha' else d_in / 2
        e_out = 0 if i < len(TRANS) and TRANS[i][0] == 'alpha' else d_out / 2
        seg['rdur'] = seg['dur'] + e_in + e_out
        seg['_d_in'] = e_in
        start = (bounds[i - 1] if i else 0) - e_in  # 최종 영상에서 이 장면이 보이기 시작하는 시각
        kind = seg.get('kind', 'frames')
        path, speed = {'intro': build_intro, 'places': build_places, 'alpha': lambda sg: (sg['src'], 1.0)}.get(kind, build_segment)(seg)
        print(f"{seg['key']}: {seg['dur']}s (+전환 {d_in / 2 + d_out / 2:.2f}) ×{speed:.2f}")
        segs.append((path, seg['rdur']))
        if kind == 'frames':
            ev += sfx_events(seg, start, speed)
        if kind == 'places':
            ev += places_sfx(seg, start)
        if seg['sub']:
            windows.append((seg['sub'], bounds[i - 1] if i else 0, bounds[i]))
    end = build_endcard()
    # xfade로 이어 붙이고 마지막 엔드카드는 하드컷
    ins, fc, cur, acc = [], [], '0:v', segs[0][1]
    for p, _ in segs:
        ins += (['-c:v', 'libvpx-vp9'] if p.endswith('.webm') else []) + ['-i', p]  # 투명 webm은 libvpx로 읽어야 알파가 살아 있음
    ins += ['-i', end]
    for i in range(1, len(segs)):
        typ, d = TRANS[i - 1]
        if typ == 'alpha':  # 앞 영상을 위에 얹고, 투명해지는 순간부터 뒤 장면이 밑에서 시작
            off = acc - d
            fc.append(f"color=black:s=1080x1920:r={FPS}:d={off:.4f},format=yuv420p,setsar=1[blk{i}]")
            fc.append(f"[{i}:v]settb=1/15360[sg{i}]")
            fc.append(f"[blk{i}]settb=1/15360[bk{i}]")
            fc.append(f"[bk{i}][sg{i}]concat=n=2:v=1:a=0[base{i}]")
            fc.append(f"[{cur}]format=rgba,fps={FPS},settb=1/15360[top{i}]")
            fc.append(f"[base{i}][top{i}]overlay=eof_action=pass:format=auto,format=yuv420p,setsar=1,fps={FPS},settb=1/15360[x{i}]")
        else:
            fc.append(f"[{cur}][{i}:v]xfade=transition={typ}:duration={d:.4f}:offset={acc - d:.4f}[x{i}]")
        cur = f'x{i}'; acc += segs[i][1] - d
    fc.append(f"[{cur}][{len(segs)}:v]concat=n=2:v=1:a=0[vout]")
    video = os.path.join(OUT, 'video.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-c:v', 'libx264', '-preset', 'medium',
                    '-crf', '14', '-r', str(FPS), '-pix_fmt', 'yuv420p', video], check=True)
    print(f'게임 구간 끝 {acc:.3f}s (목표 {bounds[-1]})')
    if windows:
        video = subtitle_pass(video, windows)
    # 효과음 정리: 같은 소리 최소 간격(SAMPLE gap), 100ms 안 7개까지
    ev.sort()
    last, kept = {}, []
    for tt, n in ev:
        if tt - last.get(n, -9) < SAMPLE[n][1] / 1000:
            continue
        if sum(1 for k in kept if tt - k[0] < 0.1) >= 7:
            continue
        last[n] = tt
        kept.append((tt, n))
    if not os.path.exists(ENDCARD_ANIM):
        kept.append((bounds[-1], 'prestige'))  # 엔드카드로 넘어가는 순간 마무리음 (게임 효과음) — 애니메이션이 있으면 그 소리를 씀
    json.dump(kept, open(os.path.join(OUT, 'sfx_cues.json'), 'w'), indent=0)
    # 오디오: BGM 한 곡 30초 + 효과음
    names = sorted(set(n for _, n in kept))
    intro = SEGS[0]; t_in = intro['dur']  # 오프닝 소리 → BGM 경계
    ain = ['-i', f'{GAME}/assets/sfx/bgm_battle.mp3'] + sum([['-i', f'{GAME}/assets/sfx/{n}.mp3'] for n in names], []) + ['-i', intro['src']]
    pi = len(names) + 1
    bms = int((t_in - 0.15) * 1000)
    fc = [f"[0:a]atrim=0:{30 - t_in + 0.15:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.42,afade=t=in:d=0.3,afade=t=out:st={(bounds[-1] - t_in + 0.15 - 0.3) if os.path.exists(ENDCARD_ANIM) else (30 - t_in + 0.15 - 0.6):.3f}:d=0.6,adelay={bms}|{bms}[bgm]",  # 엔드카드 애니메이션이 있으면 그 소리로 넘겨줌
          f"[{pi}:a]atrim=0:{t_in:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=1.0,afade=t=out:st={t_in - 0.15:.3f}:d=0.25[pro]"]
    labels = ['[bgm]', '[pro]']
    if os.path.exists(ENDCARD_ANIM):  # 엔드카드 애니메이션 소리
        ain += ['-i', ENDCARD_ANIM]
        ems = int(bounds[-1] * 1000)
        fc.append(f"[{len(names) + 2}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=0.8,adelay={ems}|{ems}[endA]")
        labels.append('[endA]')
    for i, n in enumerate(names):
        ts = [tt for tt, k in kept if k == n]
        fc.append(f"[{i + 1}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={SAMPLE[n][0] * 1.8:.3f},asplit={len(ts)}" + ''.join(f'[{n}{j}]' for j in range(len(ts))))
        for j, tt in enumerate(ts):
            ms = int(tt * 1000)
            fc.append(f"[{n}{j}]adelay={ms}|{ms}[{n}d{j}]")
            labels.append(f'[{n}d{j}]')
    fc.append(''.join(labels) + f"amix=inputs={len(labels)}:normalize=0:dropout_transition=0,atrim=0:30,alimiter=limit=0.89,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
    audio = os.path.join(OUT, 'audio.wav')
    if os.path.exists(SOUND_FILE):  # 사용자가 만든 30초 사운드(BGM·효과음 전부)가 있으면 그것만 씀 — 게임 소리 자동 배치는 쓰지 않음
        audio = SOUND_FILE
        print('사운드:', SOUND_FILE)
    else:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *ain, '-filter_complex', ';'.join(fc), '-map', '[aout]', '-ar', '48000', '-ac', '2', audio], check=True)
    final = os.path.join(OUT, f'KitchenWar_Trailer_9x16_{"KR" if LANG == "ko" else "EN"}.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
                    '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', str(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
                    '-t', '30', '-movflags', '+faststart', final], check=True)
    print('done', final, len(kept), 'sfx')

main()
