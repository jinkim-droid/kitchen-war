// 주방 대전쟁 — 첫 플레이 안내: 손가락이 "도구함 열기 → 도구 구매 → 같은 도구 끌어서 합성 → 공격력 카드"를 차례로 가리킨다.
// 핵심 성장(도구 구매·합성)이 메뉴 안에 있어 처음엔 찾기 어렵기 때문 (시뮬레이터: 안 사고 안 합치면 STAGE 1에서 막힘).
// main.js·base.js 뒤에 불러온다. 진행은 S.tut(0~4)에 저장, 이미 진행한 저장본(STAGE 4 이상)은 건너뛴다.

const TUT_DONE = 4;
if (S.tut === undefined) S.tut = S.stage > 3 ? TUT_DONE : 0;
let tutStart = performance.now();

const TUT = [
  { // 0: 도구함 열기
    target: () => (sheetOpen() ? null : document.querySelector('.sbtn[data-tab="tools"]')),
    text: () => `${t('tut.open_tools')}<small>${t('tut.open_tools_sub')}</small>`,
    done: () => sheetOpen() && document.querySelector('#pane-tools.on'),
  },
  { // 1: 도구 구매
    target: () => (sheetOpen() && document.querySelector('#pane-tools.on') ? $('btnBuy') : document.querySelector('.sbtn[data-tab="tools"]')),
    text: () => (S.gold >= costBuy() ? t('tut.buy') : t('tut.wait_gold')) + `<small>${t('tut.buy_sub')}</small>`,
    done: () => hasPair() || S.grid.some((L) => L >= 2),
  },
  { // 2: 끌어서 합성
    target: () => (sheetOpen() && document.querySelector('#pane-tools.on') ? 'drag' : document.querySelector('.sbtn[data-tab="tools"]')),
    text: () => `${t('tut.merge')}<small>${t('tut.merge_sub')}</small>`,
    done: () => S.grid.some((L) => L >= 2),
  },
  { // 3: 공격력 카드
    target: () => (sheetOpen() ? $('btnClose') : $('btnAtk')),
    text: () => (sheetOpen() ? t('tut.close_tools') : t('tut.upgrade')) + `<small>${t('tut.upgrade_sub')}</small>`,
    done: () => S.atkLv >= 1,
  },
];

function sheetOpen() { return !$('sheet').classList.contains('closed'); }
function hasPair() { const lv = S.grid.filter((L) => L); return lv.some((L, i) => lv.indexOf(L) !== i); }
// 셸 좌표(디자인 px)로 바꾼 요소 가운데
function centerOf(el) {
  const r = el.getBoundingClientRect(), sr = shell.getBoundingClientRect();
  return { x: (r.left - sr.left + r.width / 2) / scale, y: (r.top - sr.top + r.height / 2) / scale, w: r.width / scale, h: r.height / scale };
}

function tutTick() {
  const el = $('tut');
  if (S.tut >= TUT_DONE || !$('modal').classList.contains('hidden') || baseOpen || performance.now() - tutStart < 2500) { el.className = 'hidden'; return; }
  const step = TUT[S.tut];
  if (step.done()) {
    S.tut++;
    Sound.play('claim');
    if (S.tut >= TUT_DONE) { banner(`${t('tut.done')}<small>${t('tut.done_sub')}</small>`, 1.8); el.className = 'hidden'; save(); return; }
    save();
    return tutTick();
  }
  const tg = step.target();
  const text = typeof step.text === 'function' ? step.text() : step.text;
  $('tutText').innerHTML = text;
  if (tg === 'drag') {
    // 같은 레벨 도구 두 칸 사이를 손가락이 오간다
    const slots = [...document.querySelectorAll('#grid .slot')];
    let a = -1, b = -1;
    for (let i = 0; i < S.grid.length && b < 0; i++) for (let j = i + 1; j < S.grid.length; j++) if (S.grid[i] && S.grid[i] === S.grid[j]) { a = i; b = j; break; }
    if (a < 0) { el.className = 'hidden'; return; }
    const p = centerOf(slots[a]), q = centerOf(slots[b]);
    el.className = 'drag';
    el.style.setProperty('--x1', p.x + 'px'); el.style.setProperty('--y1', p.y + 'px');
    el.style.setProperty('--x2', q.x + 'px'); el.style.setProperty('--y2', q.y + 'px');
    $('tutBubble').style.left = Math.max(170, Math.min(550, (p.x + q.x) / 2)) + 'px';
    $('tutBubble').style.top = Math.min(p.y, q.y) - 150 + 'px';
    return;
  }
  if (!tg) { el.className = 'hidden'; return; }
  const c = centerOf(tg);
  el.className = 'point';
  $('tutHand').style.left = c.x + 'px';
  $('tutHand').style.top = c.y + c.h * 0.15 + 'px';
  // 누를 곳을 감싸는 빛 링 (대상 크기에 맞춤)
  const ring = Math.max(120, Math.min(280, Math.max(c.w, c.h) * 1.3));
  Object.assign($('tutRing').style, { left: c.x + 'px', top: c.y + 'px', width: ring + 'px', height: ring + 'px' });
  // 말풍선은 대상 위쪽(화면 아래쪽 대상) 또는 아래쪽에
  const above = c.y > 640;
  $('tutBubble').style.left = Math.max(170, Math.min(550, c.x)) + 'px';
  $('tutBubble').style.top = (above ? c.y - c.h / 2 - 150 : c.y + c.h / 2 + 70) + 'px';
}
setInterval(tutTick, 200);
