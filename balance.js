// 주방 대전쟁 — 밸런스 숫자 한곳 모음. 게임(main.js)과 시뮬레이터(tools/sim.js)가 같은 값을 쓴다.
// 숫자를 바꾼 뒤에는 `node tools/sim.js`로 페이싱(스테이지 도달 시간)을 확인한다.
// 목표 페이싱(계속 플레이): STAGE 10 강한 보스에서 첫 막힘 ~10분 · STAGE 25(환생) ~1시간 · 1회차 한계 30~40 · STAGE 50 8~12시간
// 2026-10-20 시뮬레이터 결과: 첫 막힘 STAGE 10(7분) · 25 도달 1시간 5분 · 1회차 한계 30 · 50 도달 9시간 23분
const BAL = {
  startGold: 20,                       // 처음 골드
  // 도구: Lv1 공격력, 합성 한 번마다 배율
  toolBase: 4, toolMerge: 2.6,
  buyCost: 8, buyCostG: 1.22,          // 도구 구매 비용 = buyCost × buyCostG^(산 횟수)
  // 업그레이드 카드
  atkStep: 0.25, atkCost: 15, atkCostG: 1.28,
  spdStep: 0.06, spdMax: 3, spdCost: 25, spdCostG: 1.35, fireBase: 0.9,
  goldStep: 0.15, goldCost: 20, goldCostG: 1.3,
  // 적
  hpBase: 10, hpG: 1.26,               // 일반 적 체력 = hpBase × hpG^(스테이지-1)
  earlyEase: [0.5, 0.7, 0.85],         // STAGE 1~3 적 체력 배율 — 처음 숟가락 하나로도 넘어가게
  goldBase: 1, goldG: 1.12,            // 처치 골드 = goldBase × goldG^(스테이지-1)
  atkBase: 5, atkPerStage: 0.35,       // 채소 한 대 공격력 = atkBase + atkPerStage × 스테이지 (1초마다, 보스는 3배)
  heroHp: 100, heroRegen: 4,           // 셰프 체력·초당 회복
  bossHp: 15, bossGold: 10, bossTime: 30,
  wallEvery: 10, wallHp: 10, wallGold: 2, wallTime: 45,
  // 웨이브
  waveMin: 3, waveMax: 5, waveSize0: 5, waveSizeStep: 2, spawnGap: 0.75, waveBreak: 1.6,
  // 동료: [공격력, 공격 간격(초), 고용 비용], 강화마다 공격력 × mateG, 비용 × mateCostG
  mateG: 1.28, mateCostG: 1.5,
  mates: {
    chick: [6, 1.2, 60], bunny: [40, 1.0, 1500], penguin: [90, 0.5, 20000],
    squirrel: [450, 1.0, 300000], fox: [2200, 0.8, 4000000], panda: [13000, 1.1, 60000000], frog: [75000, 0.6, 1000000000],
  },
  // 환생: STAGE prestigeMin부터, 별 = floor((최고 스테이지 - starFrom)^starPow / starDiv), 별 1개 = 공격력·골드 +starStep
  prestigeMin: 25, starFrom: 20, starPow: 1.3, starDiv: 3, starStep: 0.08,
};
if (typeof module !== 'undefined') module.exports = BAL;
