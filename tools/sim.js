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
// 넣지 않은 것: 스킨·주방 시설·미션·다이아 상점·오프라인 보상·보스 러시 (실제 게임은 이 결과보다 조금 빠르다)
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
const atkMul = (r) => (1 + BAL.atkStep * r.atkLv) * permMul(r, 'atk');
const spdMul = (r) => Math.min(BAL.spdMax, 1 + BAL.spdStep * r.spdLv) * permMul(r, 'spd');
const goldMul = (r) => (1 + BAL.goldStep * r.goldLv) * permMul(r, 'gold');
const buffAvg = (r) => { const p = (BAL.mateRole || {}).penguin; return p && r.mates.penguin ? 1 + (p.spd - 1) * p.dur / p.every : 1; }; // 펭귄 지원 평균 효과
const toolDps = (r) => buffAvg(r) * [...r.tools].sort((a, b) => b - a).slice(0, 3).reduce((a, L) => a + gunDmg(L), 0) /* 장착 3개만 (2026-10-22) */ * atkMul(r) / (BAL.fireBase / spdMul(r));
const mateDps = (r, id, lv = r.mates[id] || 0) => {
  if (!lv) return 0;
  const [d, iv] = BAL.mates[id];
  const role = (BAL.mateRole || {})[id];
  return d * Math.pow(BAL.mateG, lv - 1) * atkMul(r) / iv * (role ? role.dmg : 1) * buffAvg(r); // 역할 동료는 약하게, 펭귄 버프는 평균으로
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
    if (r.tools.length < SLOTS) opts.push({ k: 'tool', c: BAL.buyCost * Math.pow(BAL.buyCostG, r.buys), g: gunDmg(1) * atkMul(r) / (BAL.fireBase / spdMul(r)) / D });
    opts.push({ k: 'atk', c: BAL.atkCost * Math.pow(BAL.atkCostG, r.atkLv), g: BAL.atkStep / (1 + BAL.atkStep * r.atkLv) });
    if (1 + BAL.spdStep * r.spdLv < BAL.spdMax) opts.push({ k: 'spd', c: BAL.spdCost * Math.pow(BAL.spdCostG, r.spdLv), g: (BAL.spdStep / spdMul(r)) * toolDps(r) / D });
    opts.push({ k: 'gold', c: BAL.goldCost * Math.pow(BAL.goldCostG, r.goldLv), g: 0.5 * BAL.goldStep / (1 + BAL.goldStep * r.goldLv) });
    for (const id of MATE_IDS) {
      const lv = r.mates[id] || 0, c = BAL.mates[id][2] * Math.pow(BAL.mateCostG, lv);
      opts.push({ k: 'mate', id, c, g: (lv ? mateDps(r, id) * (BAL.mateG - 1) : mateDps(r, id, 1)) / D });
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
    else r.mates[best.id] = (r.mates[best.id] || 0) + 1;
  }
}

// 웨이브 하나를 0.1초 단위로 돌린다: 적이 spawnGap마다 나타나 WALK초 걸어와 셰프를 때리고, 셰프 쪽은 DPS로 하나씩 잡는다.
// 셰프는 피해 다니고 동료가 일부를 맞아 주므로 실제로 셰프에게 닿는 비율을 CONTACT로 둔다.
const CONTACT = 0.6;
function runWave(n, hp, D, st, heroHp) {
  const atk = BAL.atkBase + BAL.atkPerStage * st;
  let t = 0, killed = 0;
  while (killed < n) {
    t += 0.1;
    const spawned = Math.min(n, Math.max(0, Math.floor((t - AIM_DELAY) / BAL.spawnGap) + 1));  // 공격 범위에 들어온 적만 맞는다
    const arrived = Math.min(n, Math.max(0, Math.floor((t - WALK) / BAL.spawnGap) + 1));
    killed = Math.min(spawned, killed + (D / hp) * 0.1);      // 화면에 나온 적만 잡을 수 있다
    const touching = Math.max(0, arrived - killed);
    heroHp = Math.min(BAL.heroHp, heroHp - (touching * atk * CONTACT - BAL.heroRegen) * 0.1);
    if (heroHp <= 0) return { dead: true, time: t, heroHp: 0 };
    if (t > 600) return { dead: true, time: t, heroHp };      // 10분 넘게 못 끝내면 실패로 본다
  }
  return { dead: false, time: t + WALK * 0.3, heroHp };
}

// 한 스테이지를 돈다 → { ok, time }
function runStage(r) {
  const st = r.stage, hp = enemyHp(st), wall = st % BAL.wallEvery === 0;
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
while (t < HOURS * 3600) {
  simT = t;
  const res = runStage(r);
  t += res.time;
  if (res.ok) {
    r.stage++;
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
events.forEach((e) => console.log(e));
