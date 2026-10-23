// 주방 대전쟁 — 밸런스 숫자 한곳 모음. 게임(main.js)과 시뮬레이터(tools/sim.js)가 같은 값을 쓴다.
// 숫자를 바꾼 뒤에는 `node tools/sim.js`로 페이싱(스테이지 도달 시간)을 확인한다.
// 목표 페이싱(계속 플레이): STAGE 10 강한 보스에서 첫 막힘 ~10분 · STAGE 25(환생) ~1시간 · 1회차 한계 30~40 · STAGE 50 8~12시간
// 2026-10-21 시뮬레이터 결과(영구 강화 방식): 첫 막힘 STAGE 10(5분) · 25 도달 54분 · 1회차 한계 30 · 50 도달 7시간 51분
// 2026-10-22 C안 뒤: 20 도달 14분 · 21 도달 28분 · 31 도달 3시간 11분 · 50 도달 8시간 17분 · 24시간 최고 60 (META=off)
// 2026-10-22 시뮬에 스킨·주방·다이아·동료 역할 반영(기본): 21 도달 25분 · 31 도달 1시간 54분 · 50 도달 4시간 7분 · 60 도달 6시간 · 24시간 최고 80 — 목표(50에 8~12시간)보다 약 2배 빠름
const BAL = {
  startGold: 20,                       // 처음 골드
  // 도구: Lv1 공격력, 합성 한 번마다 배율
  toolBase: 4, toolMerge: 2.6,
  buyCost: 8, buyCostG: 1.22,          // 도구 구매 비용 = buyCost × buyCostG^(산 횟수)
  // 업그레이드 카드
  atkStep: 0.25, atkCost: 15, atkCostG: 1.28,
  spdStep: 0.04, spdMax: 3, // 2026-10-22 사용자: 공속 최대 34 → 50레벨 (0.06 → 0.04)
  spdCost: 25, spdCostG: 1.25, // 1.35 → 1.25: 50레벨로 늘린 만큼 비용 보정 (시뮬로 원래 진행 속도와 비슷하게)
  fireBase: 0.9,
  goldStep: 0.15, goldCost: 20, goldCostG: 1.3,
  // 적
  hpBase: 10, hpG: 1.26,               // 일반 적 체력 = hpBase × hpG^(스테이지-1)
  earlyEase: [0.5, 0.7, 0.85],         // STAGE 1~3 적 체력 배율 — 처음 숟가락 하나로도 넘어가게
  goldBase: 1, goldG: 1.12,            // 처치 골드 = goldBase × goldG^(스테이지-1)
  atkBase: 5, atkPerStage: 0.35,       // 채소 한 대 공격력 = atkBase + atkPerStage × 스테이지 (1초마다, 보스는 3배)
  heroHp: 100, heroRegen: 4,           // 셰프 체력·초당 회복
  bossHp: 15, bossGold: 10, bossTime: 30,
  wallEvery: 10, wallHp: 7, wallGold: 2, wallTime: 45, // 대왕 체력 10 → 7배 (2026-10-22 사용자 C안: 20→21 멈춤 32분 → 14분)
  // 웨이브
  waveMin: 3, waveMax: 5, waveSize0: 5, waveSizeStep: 2, spawnGap: 0.75, waveBreak: 1.6,
  // 동료: [공격력, 공격 간격(초), 고용 비용], 강화마다 공격력 × mateG, 비용 × mateCostG
  mateG: 1.28, mateCostG: 1.5,
  mates: {
    chick: [6, 1.2, 60], bunny: [40, 1.0, 1500], penguin: [90, 0.5, 20000],
    squirrel: [450, 1.0, 300000], fox: [2200, 0.8, 4000000], panda: [13000, 1.1, 60000000], frog: [75000, 0.6, 1000000000],
  },
  // 동료 역할 (2026-10-22 사용자): 판다 방어·개구리 회복·펭귄 지원 — 공격은 약하게(dmg 배수)
  //  tank: 체력 hp배, taunt px 안의 적은 판다를 먼저 노린다 / heal: every초마다 셰프·동료 최대 체력의 pct 회복 / buff: every초마다 dur초 동안 셰프·동료 공격 속도 spd배
  mateRole: {
    panda: { role: 'tank', dmg: 0.35, hp: 4, taunt: 420 },
    frog: { role: 'heal', dmg: 0.35, every: 4, pct: 0.12 },
    penguin: { role: 'buff', dmg: 0.35, every: 8, dur: 4, spd: 1.3 },
  },
  // 동료 역할 강화 (다이아, 2026-10-22 사용자 B·A안): 고용한 뒤에만, 5단계, 환생해도 유지. 단계마다 mateRole 값에 더함
  roleUp: { cost: [50, 100, 200, 400, 800],
    panda: { hp: 1, taunt: 40 }, frog: { pct: 0.03 }, penguin: { spd: 0.04, dur: 0.4 } },
  // 환생: STAGE prestigeMin부터, 별 = floor((최고 스테이지 - starFrom)^starPow / starDiv)
  prestigeMin: 25, starFrom: 15, starPow: 1.3, starDiv: 3, // starFrom 20 → 15 (C안: STAGE 30 환생 별 6 → 11, 31 도달 5:39 → 3:11, 50 도달 8:17)
  // 셰프 별로 사는 영구 강화 (총고식): 레벨당 +step, 비용 = 1 + floor(레벨 ÷ permCostEvery) 별. 공격속도는 max 레벨까지
  perm: { atk: { step: 0.2 }, spd: { step: 0.03, max: 20 }, gold: { step: 0.2 } }, permCostEvery: 25,
};
if (typeof module !== 'undefined') module.exports = BAL;
