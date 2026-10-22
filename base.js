// 주방 대전쟁 — 🏠 내 주방 (SLG식 본진): 시설을 짓고·기다리고·수확하고·업그레이드한다.
// 그림 없이 체크무늬 프레임 카드 + 이모지로 만든 1단계 버전. main.js 뒤에 불러온다(S·fmt·COIN 등을 쓴다).
// 전투는 뒤에서 계속 돌아가고, 시설 효과는 main.js의 공격력·조수·오프라인 계산에 곱해진다.

const STATIONS = [
  { id: 'oven', name: t('st.oven'), icon: '🔥', unlock: 1, cost: 200, time: 15, desc: t('st.oven.desc'),
    effect: (lv) => t('st.oven.eff', { n: fmt(ovenRate(lv) * 60) }) },
  { id: 'board', name: t('st.board'), icon: '🔪', unlock: 1, cost: 500, time: 20, desc: t('st.board.desc'),
    effect: (lv) => t('st.board.eff', { n: lv * 10 }) },
  { id: 'school', name: t('st.school'), icon: '📚', unlock: 2, cost: 3000, time: 30, desc: t('st.school.desc'),
    effect: (lv) => t('st.school.eff', { n: lv * 15 }) },
  { id: 'fridge', name: t('st.fridge'), icon: '🧊', unlock: 3, cost: 8000, time: 30, desc: t('st.fridge.desc'),
    effect: (lv) => t('st.fridge.eff', { n: lv }) },
  { id: 'counter', name: t('st.counter'), icon: '🛎️', unlock: 4, cost: 25000, time: 45, desc: t('st.counter.desc'),
    effect: (lv) => t('st.counter.eff', { n: lv, gem: GEM }) },
];
const KITCHEN_MAX = 6;
const kitchenLv = () => Math.min(KITCHEN_MAX, 1 + Math.floor((S.bestStage || S.stage) / 10)); // 최고 스테이지 10마다 +1
const stLvCap = () => kitchenLv() * 3;                       // 시설 레벨 한도 = 주방 레벨 × 3
const stLv = (id) => (S.base.st[id] || 0);
// 비용은 지금 스테이지 수입에 맞춰 커진다 (STAGE 1 기준값 × 그 스테이지 적 골드 배율) — 늘 '조금 모아야 하는' 값이 되게
const stCost = (st, lv = stLv(st.id)) => Math.ceil(st.cost * (enemyGold(S.stage) / enemyGold(1)) * Math.pow(2.2, lv));
const ST_TIME_MUL = 12; // 2026-10-22 사용자: 건설 시간 12배 (처음 3~9분, Lv 9 → 10은 3~10시간)
const stTime = (st, lv = stLv(st.id)) => Math.round(st.time * ST_TIME_MUL * Math.pow(1.6, lv)); // 초
const skipGems = (sec) => Math.max(1, Math.ceil(sec / 600)); // 남은 10분마다 다이아 1 (시간 늘린 만큼 줄임)

// 효과 (main.js 계산에 곱해진다)
const baseAtkMul = () => 1 + 0.1 * (S.base ? stLv('board') : 0);
const baseMateMul = () => 1 + 0.15 * (S.base ? stLv('school') : 0);
const baseOfflineHours = () => (S.base ? stLv('fridge') : 0);
// 오븐: 접속 중 수입(초당)의 6% × 레벨, 2시간치까지 쌓인다
const ovenRate = (lv = stLv('oven')) => (lv ? (offlineGoldPerSec() / OFFLINE_RATE) * 0.06 * lv : 0);
const ovenCap = () => ovenRate() * 7200;
const counterRate = (lv = stLv('counter')) => lv / 3600; // 💎/초
const counterCap = () => stLv('counter') * 24;

function freshBase() { return { st: {}, build: null, gold: 0, gems: 0, last: Date.now() }; }
if (!S.base) S.base = freshBase();
if (!S.bestStage) S.bestStage = S.stage;

// ---------- 생산·건설 진행 (실제 시간 기준이라 꺼져 있던 동안도 쌓인다) ----------
function baseTick() {
  const now = Date.now();
  const dt = Math.min(12 * 3600, Math.max(0, (now - S.base.last) / 1000));
  S.base.last = now;
  if (stLv('oven')) S.base.gold = Math.min(ovenCap(), S.base.gold + ovenRate() * dt);
  if (stLv('counter')) S.base.gems = Math.min(counterCap(), S.base.gems + counterRate() * dt);
  const b = S.base.build;
  if (b && now >= b.until) {
    S.base.st[b.id] = stLv(b.id) + 1;
    S.base.build = null;
    const st = STATIONS.find((x) => x.id === b.id);
    const nl = stLv(st.id), lookUp = nl === 3 || nl === 6; // 외형 단계가 오르는 레벨
    banner(`${lookUp ? t('base.look_up', { name: st.name }) : t('base.build_done', { icon: st.icon, name: st.name, lv: nl })}<small>${st.effect(nl)}</small>`, lookUp ? 2.6 : 2);
    Sound.play(lookUp ? 'prestige' : 'claim'); buzz(lookUp ? 60 : 30);
    lookFlash = { id: st.id, big: lookUp }; // 다음 그리기 때 그 카드 연출 — 외형 단계 오름은 크게, 나머지 업그레이드는 작게 (2026-10-22 사용자)
    baseDirty = true;
    renderGrid(); save();
  }
}

// ---------- 화면 ----------
let baseDirty = true, baseOpen = false;
function stState(st) {
  const lv = stLv(st.id), b = S.base.build;
  if (kitchenLv() < st.unlock) return 'locked';
  if (b && b.id === st.id) return 'building';
  if (!lv) return 'empty';
  if (lv >= stLvCap()) return 'max';
  return 'idle';
}
const fmtSec = (s) => { s = Math.ceil(s); return s >= 3600 ? t('time.hm', { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) }) : s >= 60 ? t('time.ms', { m: Math.floor(s / 60), s: s % 60 }) : t('time.s', { s }); };

let lookFlash = null; // 외형 단계가 막 오른 시설 (카드 반짝 연출, 2026-10-22)
function renderBase() {
  $('baseGrid').innerHTML = STATIONS.map((st) => {
    const s = stState(st), lv = stLv(st.id);
    const tier = lv >= 10 ? 'gold' : lv >= 5 ? 'silver' : lv >= 1 ? 'bronze' : '';
    let body;
    if (s === 'locked') body = `<div class="st-lock">${icon('icon_lock', '🔒')}<small>${t('base.unlock', { lv: st.unlock })}<br>${t('base.unlock_stage', { n: (st.unlock - 1) * 10 })}</small></div>`;
    else body = `
      <div class="st-eff">${lv ? st.effect(lv) : st.desc}</div>
      <div class="st-bar"><i></i><span></span></div>
      <button class="st-act"></button>`;
    // 시설 외형 3단계 (12차, 2026-10-22): Lv 1~2 기본 · 3~5 '_2' · 6+ '_3' — 그림이 없으면 아래 단계
    const look = lv >= 6 ? 3 : lv >= 3 ? 2 : 1;
    const tierKey = [3, 2, 1].filter((n) => n <= look).map((n) => 'icon_st_' + st.id + (n > 1 ? '_' + n : '')).find((k) => AVAIL.has(k));
    const ico = tierKey ? `<img src="${IMG}${tierKey}.webp" alt="${st.icon}">` : st.icon;
    // st-cell: 수확할 게 있을 때 카드 뒤에서 빛(ui_st_ready)이 돈다 — 카드(필터가 걸린 판) 밖에 둬야 카드 뒤에 그려진다
    return `<div class="st-cell"><div class="st ${s} ${tier}" data-st="${st.id}">
      <div class="st-ico">${ico}</div>
      <div class="st-name">${st.name}${lv ? ` <span class="st-lv">Lv ${lv}</span>` : ''}</div>
      <div class="st-stars">${STAR.repeat(Math.min(3, Math.floor(lv / 3)))}</div>
      ${body}
      ${st.id === 'oven' || st.id === 'counter' ? '<button class="st-collect"></button>' : ''}
    </div></div>`;
  }).join('');
  baseDirty = false;
  if (lookFlash) {
    const card = document.querySelector(`#baseGrid .st[data-st="${lookFlash.id}"]`), cls = lookFlash.big ? 'look-up' : 'lv-up';
    if (card) { card.classList.remove(cls); void card.offsetWidth; card.classList.add(cls); setTimeout(() => card.classList.remove(cls), 1800); }
    lookFlash = null;
  }
}

function updateBase() {
  if (baseDirty) renderBase();
  const kl = kitchenLv();
  $('kLv').textContent = `Lv ${kl}`;
  $('kNext').textContent = kl < KITCHEN_MAX ? t('base.next', { n: kl * 10, cap: stLvCap() }) : t('base.max', { cap: stLvCap() });
  const b = S.base.build, now = Date.now();
  $('baseQueue').innerHTML = b
    ? t('base.building', { name: STATIONS.find((x) => x.id === b.id).name, time: fmtSec((b.until - now) / 1000) })
    : t('base.idle');
  $('baseQueue').classList.toggle('busy', !!b);
  document.querySelectorAll('#baseGrid .st').forEach((card) => {
    const st = STATIONS.find((x) => x.id === card.dataset.st), s = stState(st);
    const btn = card.querySelector('.st-act'), bar = card.querySelector('.st-bar');
    if (btn) {
      if (s === 'building') {
        const left = (b.until - now) / 1000, total = stTime(st, stLv(st.id));
        bar.style.display = 'block';
        bar.querySelector('i').style.width = Math.min(100, (1 - left / total) * 100) + '%';
        bar.querySelector('span').textContent = fmtSec(left);
        btn.innerHTML = `${t('base.instant')}<span class="cost">${GEM} ${skipGems(left)}</span>`;
        btn.className = 'st-act gem';
        btn.disabled = S.gems < skipGems(left);
      } else {
        bar.style.display = 'none';
        if (s === 'max') { btn.innerHTML = `${t('base.maxlv')}<span class="cost">${t('base.need_lv')}</span>`; btn.disabled = true; btn.className = 'st-act'; }
        else {
          const c = stCost(st);
          btn.innerHTML = `${s === 'empty' ? t('base.build') : t('base.upgrade')}<span class="cost">${COIN} ${fmt(c)}<br>${TIMER} ${fmtSec(stTime(st))}</span>`;
          btn.className = 'st-act';
          btn.disabled = !!b || S.gold < c;
        }
      }
    }
    const col = card.querySelector('.st-collect');
    if (col) {
      const v = st.id === 'oven' ? S.base.gold : Math.floor(S.base.gems);
      const show = stLv(st.id) && v >= (st.id === 'oven' ? 1 : 1);
      col.style.display = show ? 'flex' : 'none';
      if (show) col.innerHTML = st.id === 'oven' ? `${COIN}<span>${fmt(v)}</span>` : `${GEM}<span>${v}</span>`;
      card.parentNode.classList.toggle('ready', !!show);
    }
  });
  // 알림 점: 수확할 게 있거나, 건설 슬롯이 비었고 지을 수 있는 게 있을 때
  const canBuild = !b && STATIONS.some((st) => { const s = stState(st); return (s === 'empty' || s === 'idle') && S.gold >= stCost(st); });
  const ready = canBuild || S.base.gold >= ovenCap() * 0.5 && stLv('oven') > 0 || S.base.gems >= 1;
  document.querySelectorAll('[data-tab="base"]').forEach((el) => el.classList.toggle('ready', !!ready));
}

$('baseGrid').addEventListener('click', (e) => {
  const card = e.target.closest('.st'); if (!card) return;
  const st = STATIONS.find((x) => x.id === card.dataset.st);
  if (e.target.closest('.st-collect')) {
    const r = card.getBoundingClientRect(), fr = $('field').getBoundingClientRect();
    const sx = (r.left - fr.left + r.width / 2) / scale, sy = (r.top - fr.top + r.height / 3) / scale;
    if (st.id === 'oven' && S.base.gold >= 1) {
      const g = Math.floor(S.base.gold); S.gold += g; S.base.gold = 0;
      coinBurst(sx, sy, 14); Sound.play('claim'); popText(cam.x + sx, cam.y + sy, '+' + fmt(g), 'gold big');
    } else if (st.id === 'counter' && S.base.gems >= 1) {
      const g = Math.floor(S.base.gems); S.gems += g; S.base.gems -= g;
      gemBurst(sx, sy, Math.min(10, g + 2)); Sound.play('claim');
    }
    updateUI(); save(); return;
  }
  if (!e.target.closest('.st-act')) return;
  const s = stState(st), b = S.base.build;
  if (s === 'building') {
    const left = (b.until - Date.now()) / 1000, g = skipGems(left);
    if (S.gems < g) return;
    S.gems -= g; b.until = Date.now(); baseTick();
  } else if ((s === 'empty' || s === 'idle') && !b) {
    const c = stCost(st); if (S.gold < c) return;
    S.gold -= c;
    S.base.build = { id: st.id, until: Date.now() + stTime(st) * 1000 };
    Sound.play('buy'); buzz(15);
    banner(t('base.build_start', { name: st.name, action: s === 'empty' ? t('base.build') : t('base.upgrade'), time: fmtSec(stTime(st)) }), 1.4);
    baseDirty = true;
  }
  updateBase(); updateUI(); save();
});

function openBase() {
  baseOpen = true; baseDirty = true;
  const art = SKIN_ART[S.skin];
  $('baseBear').src = art && ART[art] ? `${IMG}${art}.webp` : (skinThumb[S.skin] || `${IMG}hero_chef.webp`);
  $('base').classList.remove('hidden');
  baseTick(); updateBase();
}
function closeBase() { baseOpen = false; $('base').classList.add('hidden'); }
$('btnBaseBack').onclick = closeBase;
document.querySelectorAll('.sbtn[data-tab="base"]').forEach((b) => { b.onclick = openBase; });

// 1초마다 생산·건설을 진행하고, 화면이 열려 있으면 갱신한다 (알림 점은 늘 갱신)
setInterval(() => { if (!S.base) return; baseTick(); updateBase(); }, 500);
