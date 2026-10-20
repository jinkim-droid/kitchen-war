// 주방 대전쟁 — 🏠 내 주방 (SLG식 본진): 시설을 짓고·기다리고·수확하고·업그레이드한다.
// 그림 없이 체크무늬 프레임 카드 + 이모지로 만든 1단계 버전. main.js 뒤에 불러온다(S·fmt·COIN 등을 쓴다).
// 전투는 뒤에서 계속 돌아가고, 시설 효과는 main.js의 공격력·조수·오프라인 계산에 곱해진다.

const STATIONS = [
  { id: 'oven', name: '오븐', icon: '🔥', unlock: 1, cost: 200, time: 15, desc: '시간마다 골드를 구워요',
    effect: (lv) => `골드 ${fmt(ovenRate(lv) * 60)}/분 · 최대 2시간치` },
  { id: 'board', name: '조리대', icon: '🔪', unlock: 1, cost: 500, time: 20, desc: '셰프 공격력이 영원히 올라요',
    effect: (lv) => `공격력 +${lv * 10}%` },
  { id: 'school', name: '요리 학교', icon: '📚', unlock: 2, cost: 3000, time: 30, desc: '조수들이 배워서 강해져요',
    effect: (lv) => `조수 공격력·체력 +${lv * 15}%` },
  { id: 'fridge', name: '냉장고', icon: '🧊', unlock: 3, cost: 8000, time: 30, desc: '자리 비운 동안 보상이 더 오래 쌓여요',
    effect: (lv) => `오프라인 보상 +${lv}시간` },
  { id: 'counter', name: '주문 카운터', icon: '🛎️', unlock: 4, cost: 25000, time: 45, desc: '손님 팁으로 다이아가 조금씩 쌓여요',
    effect: (lv) => `💎 ${lv}개/시간 · 최대 하루치` },
];
const KITCHEN_MAX = 6;
const kitchenLv = () => Math.min(KITCHEN_MAX, 1 + Math.floor((S.bestStage || S.stage) / 10)); // 최고 스테이지 10마다 +1
const stLvCap = () => kitchenLv() * 3;                       // 시설 레벨 한도 = 주방 레벨 × 3
const stLv = (id) => (S.base.st[id] || 0);
// 비용은 지금 스테이지 수입에 맞춰 커진다 (STAGE 1 기준값 × 그 스테이지 적 골드 배율) — 늘 '조금 모아야 하는' 값이 되게
const stCost = (st, lv = stLv(st.id)) => Math.ceil(st.cost * (enemyGold(S.stage) / enemyGold(1)) * Math.pow(2.2, lv));
const stTime = (st, lv = stLv(st.id)) => Math.round(st.time * Math.pow(1.6, lv)); // 초
const skipGems = (sec) => Math.max(1, Math.ceil(sec / 60));  // 남은 1분마다 💎 1

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
    banner(`🔨 ${st.icon} ${st.name} Lv ${stLv(st.id)} 완공!<small>${st.effect(stLv(st.id))}</small>`, 2);
    Sound.play('claim'); buzz(30);
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
const fmtSec = (s) => { s = Math.ceil(s); return s >= 3600 ? `${Math.floor(s / 3600)}시간 ${Math.floor((s % 3600) / 60)}분` : s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`; };

function renderBase() {
  $('baseGrid').innerHTML = STATIONS.map((st) => {
    const s = stState(st), lv = stLv(st.id);
    const tier = lv >= 10 ? 'gold' : lv >= 5 ? 'silver' : lv >= 1 ? 'bronze' : '';
    let body;
    if (s === 'locked') body = `<div class="st-lock">${icon('icon_lock', '🔒')}<small>주방 Lv ${st.unlock}에 열려요<br>(STAGE ${(st.unlock - 1) * 10} 도달)</small></div>`;
    else body = `
      <div class="st-eff">${lv ? st.effect(lv) : st.desc}</div>
      <div class="st-bar"><i></i><span></span></div>
      <button class="st-act"></button>`;
    return `<div class="st ${s} ${tier}" data-st="${st.id}">
      <div class="st-ico">${st.icon}</div>
      <div class="st-name">${st.name}${lv ? ` <span class="st-lv">Lv ${lv}</span>` : ''}</div>
      <div class="st-stars">${'★'.repeat(Math.min(3, Math.floor(lv / 3)))}</div>
      ${body}
      ${st.id === 'oven' || st.id === 'counter' ? '<button class="st-collect"></button>' : ''}
    </div>`;
  }).join('');
  baseDirty = false;
}

function updateBase() {
  if (baseDirty) renderBase();
  const kl = kitchenLv();
  $('kLv').textContent = `Lv ${kl}`;
  $('kNext').textContent = kl < KITCHEN_MAX ? `다음 주방 레벨: 최고 STAGE ${kl * 10} 도달 · 시설 레벨 한도 ${stLvCap()}` : `최고 주방 레벨! · 시설 레벨 한도 ${stLvCap()}`;
  const b = S.base.build, now = Date.now();
  $('baseQueue').innerHTML = b
    ? `🔨 건설 중: ${STATIONS.find((x) => x.id === b.id).name} · ${fmtSec((b.until - now) / 1000)} 남음`
    : '🔨 건설 슬롯 비어 있음 — 시설을 지어 보세요!';
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
        btn.innerHTML = `즉시 완료<span class="cost">${GEM} ${skipGems(left)}</span>`;
        btn.className = 'st-act gem';
        btn.disabled = S.gems < skipGems(left);
      } else {
        bar.style.display = 'none';
        if (s === 'max') { btn.innerHTML = `최대 레벨<span class="cost">주방 Lv 업 필요</span>`; btn.disabled = true; btn.className = 'st-act'; }
        else {
          const c = stCost(st);
          btn.innerHTML = `${s === 'empty' ? '짓기' : '업그레이드'}<span class="cost">${COIN} ${fmt(c)} · ⏱ ${fmtSec(stTime(st))}</span>`;
          btn.className = 'st-act';
          btn.disabled = !!b || S.gold < c;
        }
      }
    }
    const col = card.querySelector('.st-collect');
    if (col) {
      const v = st.id === 'oven' ? S.base.gold : Math.floor(S.base.gems);
      const show = stLv(st.id) && v >= (st.id === 'oven' ? 1 : 1);
      col.style.display = show ? 'block' : 'none';
      if (show) col.innerHTML = st.id === 'oven' ? `${COIN} ${fmt(v)}` : `${GEM} ${v}`;
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
    banner(`🔨 ${st.name} ${s === 'empty' ? '짓기' : '업그레이드'} 시작!<small>${fmtSec(stTime(st))} 뒤에 완공돼요</small>`, 1.4);
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
