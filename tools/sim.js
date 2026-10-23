// 주방 대전쟁 밸런스 시뮬레이터 — balance.js 숫자로 "가상 플레이어"를 돌려 스테이지 도달 시간을 잰다.
//
// 사용법:  node tools/sim.js            (기본: 계속 플레이 24시간)
//          node tools/sim.js 12         (12시간까지)
//          node tools/sim.js 24 '{"hpG":1.25}'   (balance.js 값을 잠깐 바꿔서 시험)
//          PLAYER=casual node tools/sim.js 1     (보통 플레이어: 30초에 한 번만 골드를 쓴다 — 도구 구매·합성 포함)
//
// 가상 플레이어
// - 골드가 생기면 "골드당 DPS가 가장 많이 오르는 것"을 산다(도구 구매·공격력·공격 속도·골드 획득량·동료). 같은 도구는 바로 합성.
// - 웨이브: 적 n마리를 (등장 시간)과 (n × 체력 ÷ DPS) 중 긴 쪽 + 걸어오는 시간에 잡는다.
// - 보스를 제한시간 안에 못 잡으면 후퇴(스테이지 -1) → 다시 도전하며 골드를 모은다. 적 한 마리를 못 버틸 만큼 약하면 셰프가 쓰러진다.
// - 최고 기록이 STALL_MIN분 동안 안 오르고 환생할 수 있으면 환생한다.
// 2026-10-21 반영(main.js와 같은 값): 보스 경고 WARN_T초(스테이지마다) · 공격 범위(적이 화면 안쪽에 들어온 뒤에야 맞음 → 근사: 일반 적 AIM_DELAY초·보스 BOSS_AIM_DELAY초 진입 지연)
//   · 보스 제한시간은 보스가 공격 범위에 들어온 뒤부터 줄어듦(그래서 진입 지연은 제한시간에 안 들어감) · 2바퀴(STAGE 51~) 일반 적 8%는 체력·골드 4배(평균 1.24배로 근사)
// 2026-10-22 반영(META, 기본 켜짐 — META=off 로 끄면 예전 결과): 스킨 보유 효과(골드 스킨은 골드로 삼) · 주방 시설(조리대·요리 학교·오븐, 건설 시간 실제로 기다림)
//   · 동료 역할(펭귄 버프·개구리 회복·판다 막기) + 다이아 역할 강화 · 다이아 수입(미션·7일 출석·보스 러시·스테이지 보상 6·10번째·스테이지 도전·주문 카운터)과 쓰기(도구함 칸·다이아 스킨·역할 강화)
// 넣지 않은 것: 냉장고(오프라인)·오프라인 보상·2배속·건설 시간 단축(다이아)·자동 합성 (계속 플레이 기준)
// 추측 값: 보스 러시 하루 3번 × 5마리 처치(RUSH_KILLS) · 스테이지 도전은 그 챕터 대왕을 처음 잡을 때 같이 깸 · 판다가 있으면 셰프에게 닿는 적 25% 감소
const BAL = Object.assign({}, require('../balance.js'), JSON.parse(process.argv[3] || '{}'));

const HOURS = Number(process.argv[2] || 24);
const EFF = 0.75;          // 실제 DPS 효율 (화면 밖 적·투사체 비행·과잉 타격 손실)
const WALK = 3;            // 웨이브마다 적이 걸어 들어오는 시간(초)
const STALL_MIN = 20;      // 이만큼 기록이 안 오르면 환생 (분)
const SLOTS = 12;
const WARN_T = 1.8;        // main.js WARN_T: 마지막 웨이브 시작 시 경고 연출 시간
const AIM_DELAY = 2.0;     // 근사: 적이 걸어서 공격 범위(AIM_ZONE)에 들어올 때까지 못 맞는 시간 (추측: 속도 50~70px/s로 ~120px)
const BOSS_AIM_DELAY = 4.0; // 근사: 보스는 느려서(34px/s) 더 늦게 들어옴
const STRONG_CHANCE = 0.08, STRONG = { hp: 4, gold: 4 }; // main.js 값
const lapOf = (st) => Math.floor((st - 1) / 50);          // CHAPTERS 5개 × 10스테이지
const strongHpMul = (st) => (lapOf(st) >= 1 ? 1 + STRONG_CHANCE * (STRONG.hp - 1) : 1);
const strongGoldMul = (st) => (lapOf(st) >= 1 ? 1 + STRONG_CHANCE * (STRONG.gold - 1) : 1);
const CASUAL = process.env.PLAYER === 'casual';

const enemyHpBase = (st) => BAL.hpBase * Math.pow(BAL.hpG, st - 1) * (BAL.earlyEase[st - 1] || 1);
const enemyHp = (st) => enemyHpBase(st) * strongHpMul(st);
const enemyGoldBase = (st) => Math.ceil(BAL.goldBase * Math.pow(BAL.goldG, st - 1));
const enemyGold = (st) => enemyGoldBase(st) * strongGoldMul(st);
const waveCount = (st) => Math.min(BAL.waveMax, BAL.waveMin + Math.floor((st - 1) / 10));
const starsFor = (st) => (st < BAL.prestigeMin ? 0 : Math.floor(Math.pow(st - BAL.starFrom, BAL.starPow) / BAL.starDiv));
const gunDmg = (L) => BAL.toolBase * Math.pow(BAL.toolMerge, L - 1);
const MATE_IDS = Object.keys(BAL.mates);

// ---------- 메타(환생해도 남는 것): 스킨·주방·다이아 (main.js SKINS · base.js STATIONS 값과 맞출 것) ----------
const META = process.env.META !== 'off';
const SKINS = [ // [id, 골드 가격, 다이아 가격, 효과]
  ['pirate', 300, 0, { atk: 0.07 }], ['patissier', 2500, 0, { gold: 0.15 }], ['santa', 15000, 0, { atk: 0.25 }], ['king', 120000, 0, { gold: 0.4 }],
  ['sushi', 600000, 0, { gold: 0.5 }], ['pizza', 6000000, 0, { atk: 0.55 }], ['barista', 60000000, 0, { spd: 0.1 }],
  ['ninja', 0, 300, { spd: 0.07 }], ['hanbok', 0, 400, { gold: 0.3 }], ['wizard', 0, 800, { atk: 0.4 }],
];
const STATIONS = [ // 조리대(공격력 +10%/Lv)·요리 학교(동료 +15%/Lv)·오븐(수입 +6%/Lv, 계속 플레이면 늘 걷는다고 봄)·주문 카운터(다이아 Lv개/시간)
  { id: 'board', cost: 500, time: 20, unlock: 1 }, { id: 'oven', cost: 200, time: 15, unlock: 1 },
  { id: 'school', cost: 3000, time: 30, unlock: 2 }, { id: 'counter', cost: 25000, time: 45, unlock: 4 },
];
const ST_TIME_MUL = 12;
const RUSH_KILLS = 5, RUSH_TRIES = 3;
const MISSION_GEMS = 3 * 5 + 20, CHAL_GEMS = 30;
const ATTEND_GEMS = [30, 50, 0, 0, 80, 100, 400]; // 7일 출석 (7일차 한복 스킨 = 다이아 400 값으로 셈)
const STAGE_RW_GEMS = { 6: 20, 0: 50 }; // 스테이지 보상: 챕터마다 6번째 다이아 20 · 10번째(대왕) 50 (3번째 골드는 생략)
const meta = { st: {}, build: null, skins: new Set(), gems: 0, gemsEarned: 0, roleUp: {}, slots: 0, wallFirst: {}, chal: {}, best: 1, day: -1, log: [] };
const skinEff = (k) => (META ? SKINS.reduce((a, [id, , , e]) => a + (meta.skins.has(id) ? e[k] || 0 : 0), 0) : 0);
const stLv = (id) => (META ? meta.st[id] || 0 : 0);
const kitchenLv = () => Math.min(6, 1 + Math.floor(meta.best / 10));
const stCost = (st, stage) => Math.ceil(st.cost * (enemyGold(stage) / enemyGold(1)) * Math.pow(2.2, stLv(st.id)));
const stTime = (st) => Math.round(st.time * ST_TIME_MUL * Math.pow(1.6, stLv(st.id)));
const roleStat = (id) => { const b = (BAL.mateRole || {})[id]; if (!b) return null; const r = { ...b }, add = (BAL.roleUp || {})[id] || {}, lv = META ? meta.roleUp[id] || 0 : 0; for (const k in add) r[k] = b[k] + add[k] * lv; return r; };
const slotsNow = () => SLOTS + 4 * (META ? meta.slots : 0);

// perm: 셰프 별로 산 영구 강화 레벨 { atk, spd, gold } (환생해도 남는다)
function newRun(perm) {
  return { stage: 1, gold: BAL.startGold, atkLv: 0, spdLv: 0, goldLv: 0, buys: 0, tools: [1], mates: {}, perm, runBest: 1, lastProgress: 0 };
}
const permMul = (r, k) => 1 + BAL.perm[k].step * (r.perm[k] || 0);
const permCost = (lv) => 1 + Math.floor(lv / BAL.permCostEvery);
// 별을 쓴다: 공격력 → 골드 → 공격속도 중 가장 싼 것부터 번갈아
function spendStars(perm, stars) {
  for (;;) {
    const opts = ['atk', 'gold', 'spd'].filter((k) => !(BAL.perm[k].max && perm[k] >= BAL.perm[k].max))
      .map((k) => ({ k, c: permCost(perm[k]) })).sort((a, b) => a.c - b.c);
    if (!opts.length || opts[0].c > stars) return stars;
    stars -= opts[0].c; perm[opts[0].k]++;
  }
}
const atkMul = (r) => (1 + BAL.atkStep * r.atkLv) * permMul(r, 'atk') * (1 + skinEff('atk')) * (1 + 0.1 * stLv('board'));
const spdMul = (r) => Math.min(BAL.spdMax, 1 + BAL.spdStep * r.spdLv) * permMul(r, 'spd') * (1 + skinEff('spd'));
const goldMul = (r) => (1 + BAL.goldStep * r.goldLv) * permMul(r, 'gold') * (1 + skinEff('gold')) * (1 + 0.06 * stLv('oven'));
const buffAvg = (r) => { const p = roleStat('penguin'); return p && r.mates.penguin ? 1 + (p.spd - 1) * Math.min(1, p.dur / p.every) : 1; }; // 펭귄 지원 평균 효과
const toolDps = (r) => buffAvg(r) * [...r.tools].sort((a, b) => b - a).slice(0, 3).reduce((a, L) => a + gunDmg(L), 0) /* 장착 3개만 (2026-10-22) */ * atkMul(r) / (BAL.fireBase / spdMul(r));
const mateDps = (r, id, lv = r.mates[id] || 0) => {
  if (!lv) return 0;
  const [d, iv] = BAL.mates[id];
  const role = (BAL.mateRole || {})[id];
  return d * Math.pow(BAL.mateG, lv - 1) * atkMul(r) / iv * (role ? role.dmg : 1) * buffAvg(r) * (1 + 0.15 * stLv('school')); // 역할 동료는 약하게, 펭귄 버프는 평균으로, 요리 학교
};
const dps = (r) => toolDps(r) + MATE_IDS.reduce((a, id) => a + mateDps(r, id), 0);

function mergeAll(r) {
  r.tools.sort((a, b) => a - b);
  for (let i = 0; i < r.tools.length - 1; i++) {
    if (r.tools[i] === r.tools[i + 1]) { r.tools.splice(i, 2, r.tools[i] + 1); r.tools.sort((a, b) => a - b); i = -1; }
  }
}

// 골드당 DPS 상승이 가장 큰 것을 산다. 가장 좋은 것을 살 수 없으면 모은다.
function spendCasual(r, now) {
  if (now - (r.lastBuy || 0) < 30) return false;
  r.lastBuy = now;
  return true;
}
function spend(r) {
  if (CASUAL && !spendCasual(r, simT)) return;
  for (let guard = 0; guard < 500; guard++) {
    const D = dps(r), opts = [];
    if (r.tools.length < slotsNow()) opts.push({ k: 'tool', c: BAL.buyCost * Math.pow(BAL.buyCostG, r.buys), g: gunDmg(1) * atkMul(r) / (BAL.fireBase / spdMul(r)) / D });
    opts.push({ k: 'atk', c: BAL.atkCost * Math.pow(BAL.atkCostG, r.atkLv), g: BAL.atkStep / (1 + BAL.atkStep * r.atkLv) });
    if (1 + BAL.spdStep * r.spdLv < BAL.spdMax) opts.push({ k: 'spd', c: BAL.spdCost * Math.pow(BAL.spdCostG, r.spdLv), g: (BAL.spdStep / spdMul(r)) * toolDps(r) / D });
    opts.push({ k: 'gold', c: BAL.goldCost * Math.pow(BAL.goldCostG, r.goldLv), g: 0.5 * BAL.goldStep / (1 + BAL.goldStep * r.goldLv) });
    for (const id of MATE_IDS) {
      const lv = r.mates[id] || 0, c = BAL.mates[id][2] * Math.pow(BAL.mateCostG, lv);
      opts.push({ k: 'mate', id, c, g: (lv ? mateDps(r, id) * (BAL.mateG - 1) : mateDps(r, id, 1)) / D });
    }
    if (META) {
      // 골드 스킨 (보유 효과)
      for (const [id, cost, , e] of SKINS) {
        if (!cost || meta.skins.has(id)) continue;
        const k = Object.keys(e)[0], v = e[k], g = k === 'atk' ? v / (1 + skinEff('atk')) : k === 'gold' ? 0.5 * v / (1 + skinEff('gold')) : v / (1 + skinEff('spd')) * toolDps(r) / D;
        opts.push({ k: 'skin', id, c: cost, g });
      }
      // 주방: 건설 칸이 비었을 때 한 곳 (레벨 한도 = 주방 Lv × 3)
      if (!meta.build) for (const st of STATIONS) {
        if (st.unlock > kitchenLv() || stLv(st.id) >= kitchenLv() * 3) continue;
        const lv = stLv(st.id), mateShare = (D - toolDps(r)) / D;
        const g = st.id === 'board' ? 0.1 / (1 + 0.1 * lv) : st.id === 'school' ? 0.15 / (1 + 0.15 * lv) * mateShare : st.id === 'oven' ? 0.5 * 0.06 / (1 + 0.06 * lv) : 0.02;
        opts.push({ k: 'st', st, c: stCost(st, r.stage), g });
      }
    }
    opts.forEach((o) => { o.v = o.g / o.c; });
    opts.sort((a, b) => b.v - a.v);
    const best = opts[0];
    if (best.c > r.gold) return;
    r.gold -= best.c;
    if (best.k === 'tool') { r.tools.push(1); r.buys++; mergeAll(r); }
    else if (best.k === 'atk') r.atkLv++;
    else if (best.k === 'spd') r.spdLv++;
    else if (best.k === 'gold') r.goldLv++;
    else if (best.k === 'skin') { meta.skins.add(best.id); meta.log.push(`${fmtT(simT)}  스킨 ${best.id} (골드)`); }
    else if (best.k === 'st') meta.build = { id: best.st.id, until: simT + stTime(best.st) };
    else r.mates[best.id] = (r.mates[best.id] || 0) + 1;
  }
}

// 웨이브 하나를 0.1초 단위로 돌린다: 적이 spawnGap마다 나타나 WALK초 걸어와 셰프를 때리고, 셰프 쪽은 DPS로 하나씩 잡는다.
// 셰프는 피해 다니고 동료가 일부를 맞아 주므로 실제로 셰프에게 닿는 비율을 CONTACT로 둔다.
const CONTACT = 0.6;
let surv = { regen: BAL.heroRegen, contact: 1 }; // 개구리 회복·판다 막기 (runStage가 채움)
function runWave(n, hp, D, st, heroHp) {
  const atk = (BAL.atkBase + BAL.atkPerStage * st) * surv.contact;
  let t = 0, killed = 0;
  while (killed < n) {
    t += 0.1;
    const spawned = Math.min(n, Math.max(0, Math.floor((t - AIM_DELAY) / BAL.spawnGap) + 1));  // 공격 범위에 들어온 적만 맞는다
    const arrived = Math.min(n, Math.max(0, Math.floor((t - WALK) / BAL.spawnGap) + 1));
    killed = Math.min(spawned, killed + (D / hp) * 0.1);      // 화면에 나온 적만 잡을 수 있다
    const touching = Math.max(0, arrived - killed);
    heroHp = Math.min(BAL.heroHp, heroHp - (touching * atk * CONTACT - surv.regen) * 0.1);
    if (heroHp <= 0) return { dead: true, time: t, heroHp: 0 };
    if (t > 600) return { dead: true, time: t, heroHp };      // 10분 넘게 못 끝내면 실패로 본다
  }
  return { dead: false, time: t + WALK * 0.3, heroHp };
}

// 한 스테이지를 돈다 → { ok, time }
function runStage(r) {
  const st = r.stage, hp = enemyHp(st), wall = st % BAL.wallEvery === 0;
  const frog = META && r.mates.frog ? roleStat('frog') : null;
  surv = { regen: BAL.heroRegen + (frog ? BAL.heroHp * frog.pct / frog.every : 0), contact: META && r.mates.panda ? 0.75 : 1 };
  let time = WARN_T, heroHp = BAL.heroHp;   // 보스 경고 연출 시간은 스테이지마다 더해진다
  for (let i = 0; i < waveCount(st); i++) {
    const n = BAL.waveSize0 + i * BAL.waveSizeStep;
    const w = runWave(n, hp, dps(r) * EFF, st, heroHp);
    // 웨이브 중에 번 골드는 바로 쓴다 (잡은 만큼)
    r.gold += Math.floor(w.dead ? 0 : n) * enemyGold(st) * goldMul(r);
    time += w.time;
    if (w.dead) return { ok: false, time };
    heroHp = Math.min(BAL.heroHp, w.heroHp + BAL.heroRegen * BAL.waveBreak);
    time += i < waveCount(st) - 1 ? BAL.waveBreak : 0;
    spend(r);
  }
  const bossHp = hp * BAL.bossHp * (wall ? BAL.wallHp : 1), limit = wall ? BAL.wallTime : BAL.bossTime;
  const fight = bossHp / (dps(r) * EFF);                    // 제한시간은 보스가 범위에 들어온 뒤부터 줄어든다
  const kill = fight + BOSS_AIM_DELAY;
  if (fight > limit) return { ok: false, time: time + limit + BOSS_AIM_DELAY };
  r.gold += enemyGold(st) * BAL.bossGold * (wall ? BAL.wallGold : 1) * goldMul(r);
  spend(r);
  return { ok: true, time: time + kill };
}

// ---------- 실행 ----------
const fmtT = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
let simT = 0;
let t = 0, stars = 0, prestiges = 0, firstBlock = null, best = 1, earlyFails = 0;
const perm = { atk: 0, spd: 0, gold: 0 };
let r = newRun(perm);
const reach = {}, events = [];
// 다이아: 들어오는 것 → 정해진 순서로 쓴다 (도구함 칸 2번 → 한복 → 닌자 → 마법사 → 역할 강화 싼 것부터)
function gemIn(n, why) { meta.gems += n; meta.gemsEarned += n; }
function spendGems() {
  const buys = [];
  if (meta.slots < 2) buys.push({ c: 100, f: () => { meta.slots++; }, name: '도구함 칸' });
  for (const id of ['hanbok', 'ninja', 'wizard']) if (!meta.skins.has(id)) { const sk = SKINS.find((x) => x[0] === id); buys.push({ c: sk[2], f: () => meta.skins.add(id), name: `스킨 ${id}` }); }
  const ru = ['penguin', 'frog', 'panda'].filter((id) => (meta.roleUp[id] || 0) < BAL.roleUp.cost.length)
    .map((id) => ({ c: BAL.roleUp.cost[meta.roleUp[id] || 0], f: () => { meta.roleUp[id] = (meta.roleUp[id] || 0) + 1; }, name: `역할 강화 ${id}` })).sort((a, b) => a.c - b.c);
  if (ru.length) buys.push(ru[0]);
  const b = buys[0];
  if (b && meta.gems >= b.c) { meta.gems -= b.c; b.f(); meta.log.push(`${fmtT(simT)}  💎 ${b.name} (${b.c})`); spendGems(); }
}
function metaTick(dt) {
  if (!META) return;
  // 건설 끝
  if (meta.build && t >= meta.build.until) { meta.st[meta.build.id] = (meta.st[meta.build.id] || 0) + 1; meta.build = null; }
  // 하루마다: 미션 + 보스 러시 3번
  const day = Math.floor(t / 86400);
  if (day !== meta.day) { meta.day = day; let rush = 0; for (let k = 1; k <= RUSH_KILLS; k++) rush += 3 + 2 * (k - 1); gemIn(MISSION_GEMS + RUSH_TRIES * rush + ATTEND_GEMS[day % 7]); }
  if (stLv('counter')) gemIn(stLv('counter') / 3600 * dt);
  spendGems();
}
while (t < HOURS * 3600) {
  simT = t;
  const res = runStage(r);
  t += res.time;
  metaTick(res.time);
  if (res.ok) {
    if (META && r.stage <= 50 && STAGE_RW_GEMS[r.stage % 10] && !meta.wallFirst[r.stage]) { meta.wallFirst[r.stage] = true; gemIn(STAGE_RW_GEMS[r.stage % 10]); }
    if (META && r.stage % BAL.wallEvery === 0) { const c = r.stage / BAL.wallEvery; if (c <= 5 && !meta.chal[c]) { meta.chal[c] = true; gemIn(CHAL_GEMS); } }
    r.stage++;
    meta.best = Math.max(meta.best, r.stage);
    if (r.stage > r.runBest) { r.runBest = r.stage; r.lastProgress = t; }
    if (r.stage > best) { best = r.stage; if (!reach[best]) reach[best] = t; }
  } else {
    if (!firstBlock) firstBlock = { stage: r.stage, t };
    if (r.stage < 10) earlyFails++;
    r.stage = Math.max(1, r.stage - 1);
  }
  // 오래 막히면 환생
  if (t - r.lastProgress > STALL_MIN * 60 && r.runBest >= BAL.prestigeMin) {
    const g = starsFor(r.runBest);
    stars = spendStars(perm, stars + g); prestiges++;
    events.push(`${fmtT(t)}  환생 #${prestiges}: STAGE ${r.runBest}에서 ⭐ +${g} (영구 강화 공격력 Lv ${perm.atk}·골드 Lv ${perm.gold}·속도 Lv ${perm.spd}, 남은 별 ${stars})`);
    r = newRun(perm); r.lastProgress = t;
  }
}

console.log(`\n=== 주방 대전쟁 페이싱 (계속 플레이 ${HOURS}시간, balance.js 기준) ===`);
console.log(`첫 막힘: ${firstBlock ? `STAGE ${firstBlock.stage} (${fmtT(firstBlock.t)})` : '없음'} · STAGE 10 전에 막힌 횟수 ${earlyFails}`);
for (const s of [5, 10, 11, 15, 20, 21, 25, 30, 31, 35, 40, 41, 45, 50, 51, 60, 70, 80, 100]) {
  if (reach[s] !== undefined) console.log(`STAGE ${String(s).padStart(3)} 도달: ${fmtT(reach[s])}`);
}
console.log(`최고 STAGE ${best} · 환생 ${prestiges}번`);
if (META) {
  console.log(`메타: 주방 ${STATIONS.map((st) => `${st.id} Lv${stLv(st.id)}`).join(' · ')} · 스킨 ${meta.skins.size}개 · 다이아 번 것 ${Math.round(meta.gemsEarned)} / 남은 것 ${Math.floor(meta.gems)} · 도구함 칸 +${meta.slots * 4} · 역할 강화 ${JSON.stringify(meta.roleUp)}`);
  if (process.env.LOG) meta.log.forEach((e) => console.log(e));
} else console.log('(META=off: 스킨·주방·다이아 없이 계산)');
events.forEach((e) => console.log(e));
