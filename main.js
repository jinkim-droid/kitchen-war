// 주방 대전쟁 — 방치형 키우기 프로토타입 (도형만, 에셋 없음)
// 코어 루프: 셰프 곰이 조리도구를 자동으로 던짐 → 썩은 채소 처치 → 골드 → 도구 구매·합성·업그레이드 → 다음 스테이지

// 화면 높이 H: 폭 720 기준으로 기기 비율에 맞춰 세로를 늘린다 (9:16 = 1280 ~ 최대 1700). 요즘 폰(9:19.5 등)에서 위아래 검은 띠 없이 — 늘어난 만큼 전장이 더 보인다 (2026-10-21 실기 검수)
// 9:16보다 넓은 화면(태블릿)은 1280 그대로 좌우에 여백. 켤 때 한 번 정한다 (폰은 세로 고정)
// FH = 업그레이드 카드 위로 보이는 전장(카메라·조준 기준), CH = 캔버스 높이. 카드 뒤에도 바닥이 비치도록 캔버스는 화면 끝까지 그린다
// 폰 위쪽 카메라 구멍·아래쪽 제스처 막대를 피하는 여백 (2026-10-21 실기: 위쪽 진행 바가 카메라 구멍에 가림) — 위쪽 표시는 SAFE_TOP만큼 내리고, 아래 카드·옆 메뉴는 SAFE_BOTTOM만큼 올린다
const SAFE_TOP = 44, SAFE_BOTTOM = 24;
const PANEL_H = 206 + SAFE_BOTTOM; // 카드 칸 206 + 아래 여백 (2026-10-23 사용자: UI 키움, 190 → 206)
const W = 720, H = Math.round(Math.min(1700, Math.max(1280, 720 * innerHeight / Math.max(1, innerWidth)))), FW = 720, FH = H - PANEL_H, CH = H;
document.documentElement.style.setProperty('--shell-h', H + 'px'); // style.css 셸·전장·카드 위치
document.documentElement.style.setProperty('--safe-top', SAFE_TOP + 'px');
document.documentElement.style.setProperty('--safe-bottom', SAFE_BOTTOM + 'px');
// 셰프 이동 범위 — 채소가 조리대(위)에서 내려오므로 주방 바닥 아래쪽을 돌아다닌다
const COUNTER_Y = 300;
// 주방(월드)은 화면보다 넓고, 카메라가 셰프를 따라간다
// 월드 아래쪽 CH - FH(190)는 카드 뒤에 깔리는 바닥 — 셰프는 거기로 가지 않는다. 카메라가 위아래로 움직이는 폭(WH - CH = 410)은 화면 높이와 상관없이 같게
const WW = 1100, WH = CH + 410;
const ROAM = { x0: 80, x1: WW - 80, y0: 560, y1: WH - (CH - FH) - 110 };
const cam = { x: 0, y: 0 };
const HERO_SPEED = 120;
const BOSS_TIME = BAL.bossTime; // 밸런스 숫자는 balance.js에 모여 있다 (tools/sim.js로 페이싱 확인)
// 스테이지 = 웨이브 3~5개, 마지막 웨이브에 보스
const waveCount = (st) => Math.min(BAL.waveMax, BAL.waveMin + Math.floor((st - 1) / 10));
const waveSize = (i) => BAL.waveSize0 + i * BAL.waveSizeStep;   // i번째 웨이브의 일반 채소 수 (0부터)
const SPAWN_GAP = BAL.spawnGap, WAVE_BREAK = BAL.waveBreak;
const SLOTS = 12;                                  // 기본 도구함 칸 (다이아 상점에서 +4씩 최대 2번)
const MAX_SLOTS = 20;
const gridSize = () => SLOTS + 4 * (S.shop.slots || 0);
const SAVE_KEY = 'kitchen-war-save-v1';

const offlineCap = () => ((S.shop.offline12 ? 12 : 8) + baseOfflineHours()) * 3600; // 오프라인 보상 한도 (상점 12시간, 🏠 냉장고 +N시간)
const OFFLINE_RATE = 0.5;      // 접속 중 수입의 절반

// ---------- 스킨 — 보유만 해도 효과(공격력·공격속도·골드 중 하나), 장착은 겉모습 (총고식) ----------
// 곰은 그대로, 옷·모자·소품만 바뀐다
const BEAR = { fur: 0x8b5a3c, face: 0x9a6644, inner: 0xd9a27a, muzzle: 0xe8c49a };
const SKINS = [
  { id: 'brown', name: t('skin.brown'), apron: 0xf7f7f2, neck: 'scarf', neckColor: 0xd93a3a, hat: 'chef', cost: 0, eff: {}, look: {} },
  { id: 'pirate', name: t('skin.pirate'), apron: 0xf7f7f2, stripes: 0xd93a3a, neck: 'scarf', neckColor: 0x2a2a2a, hat: 'pirate', eyepatch: true, cost: 300, eff: { atk: 0.07 },
    look: { hat: 0x3a3a44, scarf: 0x2a2a2a, eyepatch: true, skull: true } },
  { id: 'patissier', name: t('skin.patissier'), apron: 0xff9ec4, neck: 'bow', neckColor: 0x4aa3df, hat: 'beret', hatColor: 0xd94a6a, cost: 2500, eff: { gold: 0.15 },
    look: { hat: 0xff8fb8, coat: 0xffd6e6, scarf: 0x4aa3df } },
  { id: 'santa', name: t('skin.santa'), coat: 0xd93a3a, beard: true, neck: 'none', hat: 'santa', cost: 15000, eff: { atk: 0.25 },
    look: { hat: 0xd93a3a, coat: 0xd93a3a, scarf: 0xffffff, pom: true } },
  { id: 'ninja', name: t('skin.ninja'), gem: 300, cost: 0, eff: { spd: 0.07 },
    look: { hat: 0x2a2f45, coat: 0x3a4060, scarf: 0xd93a3a } },
  { id: 'hanbok', name: t('skin.hanbok'), gem: 400, cost: 0, eff: { gold: 0.3 }, look: {} },
  { id: 'wizard', name: t('skin.wizard'), gem: 800, cost: 0, eff: { atk: 0.4 }, look: {} },
  { id: 'sushi', name: t('skin.sushi'), cost: 600000, eff: { gold: 0.5 }, look: {} },
  { id: 'pizza', name: t('skin.pizza'), cost: 6000000, eff: { atk: 0.55 }, look: {} },
  { id: 'barista', name: t('skin.barista'), cost: 60000000, eff: { spd: 0.1 }, look: {} },
  { id: 'space', name: t('skin.space'), req: 8, cost: 0, eff: { atk: 0.7 }, look: {} }, // 보스 러시 최고 8마리
  { id: 'king', name: t('skin.king'), apron: 0x2a2a2a, apronTrim: 0xffd34d, cape: 0xb02a3a, neck: 'scarf', neckColor: 0xffd34d, hat: 'crown', cost: 120000, eff: { gold: 0.4 },
    look: { hat: 0xffd34d, coat: 0x34343c, scarf: 0xffd34d, gems: true } },
];
// 예전 저장본(곰 종류 스킨) id를 의상 스킨으로 옮긴다
const OLD_SKIN_IDS = { panda: 'pirate', polar: 'patissier', honey: 'santa' };
const skinById = (id) => SKINS.find((k) => k.id === id) || SKINS[0];
const SKIN_EFF = { atk: 'skin.eff_atk', spd: 'skin.eff_spd', gold: 'skin.eff_gold' }; // 문구 키 (strings.csv)
// 스킨 보유 효과는 2026-10-22 사용자 결정으로 전부 약 70%로 낮춤 (D1: 첫날에 끝까지 가지 않게, 시뮬 50 도달 4:07 → 약 4:44)
const skinEff = (t) => SKINS.reduce((a, k) => a + (S.skins.includes(k.id) ? k.eff[t] || 0 : 0), 0);
const skinEffText = (k) => { const e = Object.keys(k.eff)[0]; return e ? t(SKIN_EFF[e], { n: Math.round(k.eff[e] * 100) }) : t('skin.eff_none'); };

// ---------- 동료 — 셰프를 따라다니며 각자 던진다 ----------
const mateStat = (id) => { const [dmg, iv, cost] = BAL.mates[id]; return { dmg, iv, cost }; };
const MATES = [
  { id: 'chick', name: t('mate.chick'), icon: '🐥', desc: t('mate.chick.desc'), proj: 'egg', ...mateStat('chick') },
  { id: 'bunny', name: t('mate.bunny'), icon: '🐰', desc: t('mate.bunny.desc'), proj: 'macaron', ...mateStat('bunny') },
  { id: 'penguin', name: t('mate.penguin'), icon: '🐧', desc: t('mate.penguin.desc'), proj: 'bean', ...mateStat('penguin') },
  { id: 'squirrel', name: t('mate.squirrel'), icon: '🐿️', desc: t('mate.squirrel.desc'), proj: 'croissant', ...mateStat('squirrel') },
  { id: 'fox', name: t('mate.fox'), icon: '🦊', desc: t('mate.fox.desc'), proj: 'ketchup', ...mateStat('fox') },
  { id: 'panda', name: t('mate.panda'), icon: '🐼', desc: t('mate.panda.desc'), proj: 'dumpling', ...mateStat('panda') },
  { id: 'frog', name: t('mate.frog'), icon: '🐸', desc: t('mate.frog.desc'), proj: 'bubble', ...mateStat('frog') },
];
const MATE_SPOTS = [{ x: -115, y: 25 }, { x: 115, y: 25 }, { x: 0, y: 110 }, { x: -205, y: 85 }, { x: 205, y: 85 }, { x: -115, y: 160 }, { x: 115, y: 160 }];
const mateLv = (m) => S.mates[m.id] || 0;
// 역할 값 = 기본(BAL.mateRole) + 다이아 강화 단계 × BAL.roleUp (단계별로 한 번만 계산해 둠)
const roleLv = (id) => (S.roleUp && S.roleUp[id]) || 0;
const roleMax = () => BAL.roleUp.cost.length;
const roleCache = {};
function roleStat(id, lv = roleLv(id)) {
  const base = (BAL.mateRole || {})[id];
  if (!base) return undefined;
  const key = id + lv;
  if (!roleCache[key]) { const r = { ...base }, add = BAL.roleUp[id] || {}; for (const k in add) r[k] = base[k] + add[k] * lv; roleCache[key] = r; }
  return roleCache[key];
}
const mateRole = (m) => roleStat(m.id);
const mateDmg = (m, lv = mateLv(m)) => m.dmg * Math.pow(BAL.mateG, lv - 1) * atkMul() * baseMateMul() * (mateRole(m)?.dmg ?? 1); // 🏠 요리 학교 · 역할 동료는 약하게
const mateCost = (m) => Math.ceil(m.cost * Math.pow(BAL.mateCostG, mateLv(m)));
// 일일 미션 — 매일 3개, 자정에 바뀐다. 5~10분 플레이로 끝낼 수 있는 양
const MISSIONS = [
  { id: 'kill', text: t('mission.kill'), n: 150 },
  { id: 'boss', text: t('mission.boss'), n: 3 },
  { id: 'merge', text: t('mission.merge'), n: 8 },
  { id: 'upgrade', text: t('mission.upgrade'), n: 10 },
  { id: 'stage', text: t('mission.stage'), n: 5 },
  { id: 'mate', text: t('mission.mate'), n: 3 },
  { id: 'time', text: t('mission.time'), n: 600 },
  { id: 'rush', text: t('mission.rush'), n: 1 },
];
const BOSS_LINES = [t('boss.line1'), t('boss.line2'), t('boss.line3'), t('boss.line4')];

// ---------- 밸런스 ----------
const gunDmg = (L) => BAL.toolBase * Math.pow(BAL.toolMerge, L - 1);
// 벽: 10스테이지마다 강한 보스
const WALL_EVERY = BAL.wallEvery, WALL_HP = BAL.wallHp, WALL_TIME = BAL.wallTime;
const isWallStage = (st) => st % WALL_EVERY === 0;
// 환생: STAGE BAL.prestigeMin부터 셰프 별을 받고, 별로 영구 강화(공격력·공격속도·골드)를 산다 (balance.js perm)
const PRESTIGE_MIN = BAL.prestigeMin;
const starsFor = (st) => st < PRESTIGE_MIN ? 0 : Math.floor(Math.pow(st - BAL.starFrom, BAL.starPow) / BAL.starDiv);
const PERM = [
  { k: 'atk', name: t('perm.atk'), icon: 'icon_atk' },
  { k: 'spd', name: t('perm.spd'), icon: 'icon_spd' },
  { k: 'gold', name: t('perm.gold'), icon: 'icon_gold_up' },
];
const permLv = (k) => (S.perm && S.perm[k]) || 0;
const permMul = (k) => 1 + BAL.perm[k].step * permLv(k);
const permCost = (k) => 1 + Math.floor(permLv(k) / BAL.permCostEvery);
const permMax = (k) => !!BAL.perm[k].max && permLv(k) >= BAL.perm[k].max;
const atkMul = () => (1 + BAL.atkStep * S.atkLv) * (1 + skinEff('atk')) * permMul('atk') * baseAtkMul(); // baseAtkMul: 🏠 조리대 (base.js)
const spdMul = () => Math.min(BAL.spdMax, 1 + BAL.spdStep * S.spdLv);                   // 업그레이드 카드 값 (상한 BAL.spdMax)
let mateBuffT = 0; // 펭귄 지원: 남은 공격 속도 버프 시간
const buffSpd = () => (mateBuffT > 0 ? roleStat('penguin').spd : 1);
const fireInterval = () => BAL.fireBase / (spdMul() * (1 + skinEff('spd')) * permMul('spd') * buffSpd());
const costAtk = () => Math.ceil(BAL.atkCost * Math.pow(BAL.atkCostG, S.atkLv));
const costSpd = () => Math.ceil(BAL.spdCost * Math.pow(BAL.spdCostG, S.spdLv));
const goldMul = () => 1 + BAL.goldStep * S.goldLv;                          // 골드 획득량 (업그레이드 카드 값)
const goldAll = () => goldMul() * (1 + skinEff('gold')) * permMul('gold');   // 스킨·영구 강화까지
const costGold = () => Math.ceil(BAL.goldCost * Math.pow(BAL.goldCostG, S.goldLv));
const costBuy = () => Math.ceil(BAL.buyCost * Math.pow(BAL.buyCostG, S.buys));
const enemyHp = (st) => Math.ceil(BAL.hpBase * Math.pow(BAL.hpG, st - 1) * (BAL.earlyEase[st - 1] || 1));
const enemyAtk = (st) => BAL.atkBase + st * BAL.atkPerStage; // 채소 한 대 공격력 (보스는 3배)
const mateMaxHp = (m, lv = mateLv(m)) => 50 * (1 + 0.35 * (lv - 1)) * baseMateMul() * (mateRole(m)?.hp ?? 1); // 방어 동료는 체력 몇 배
const enemyGold = (st) => Math.ceil(BAL.goldBase * Math.pow(BAL.goldG, st - 1));
const PALETTE = ['#9aa5b1', '#6cc070', '#4aa3df', '#a66cff', '#ff8c42', '#ff4d6d', '#ffd34d', '#3ee6c4'];
const gunColor = (L) => PALETTE[(L - 1) % PALETTE.length];
// 레벨별 조리도구 — 8단계 이후는 '전설' 단계로 이어진다
const TOOLS = [['🥄', t('tool.1')], ['🍴', t('tool.2')], ['🥢', t('tool.3')], ['🔪', t('tool.4')], ['🧂', t('tool.5')], ['🍳', t('tool.6')], ['🍲', t('tool.7')], ['🫖', t('tool.8')]];
const toolIcon = (L) => TOOLS[Math.min(L, TOOLS.length) - 1][0];
const toolName = (L) => L <= TOOLS.length ? TOOLS[L - 1][1] : t('tool.legend', { name: TOOLS[TOOLS.length - 1][1], n: L - TOOLS.length });
const VEGGIES = ['tomato', 'carrot', 'broccoli'];

// ---------- 상태 ----------
function freshState() {
  return { gold: BAL.startGold, stage: 1, atkLv: 0, spdLv: 0, buys: 0, grid: [1, ...Array(SLOTS - 1).fill(0)],
    skin: 'brown', skins: ['brown'], mates: {}, roleUp: {}, introSeen: false, lastSeen: Date.now(),
    stars: 0, prestiges: 0, perm: { atk: 0, spd: 0, gold: 0 }, chal: {}, sound: true, daily: null, goldLv: 0,
    gems: 0, wallFirst: {}, stageRw: {}, attend: { n: 0, last: '' }, shop: { slots: 0, autoMerge: false, offline12: false }, boostUntil: 0, rush: null, rushBest: 0, horde: null, hordeBest: 0,
    settings: { sfx: true, music: true, vibrate: true, dmgNum: true, shake: true, saver: false } };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    // 예전 저장본에 없는 필드는 기본값으로 채운다
    if (s && Array.isArray(s.grid) && s.grid.length >= SLOTS && s.grid.length <= MAX_SLOTS) {
      const st = Object.assign(freshState(), s);
      st.settings = Object.assign(freshState().settings, s.settings || {});
      st.perm = Object.assign(freshState().perm, s.perm || {}); // 예전 저장본: 별은 그대로 쓸 수 있는 재화가 된다
      if (s.sound === false && !s.settings) { st.settings.sfx = false; st.settings.music = false; } // 예전 소리 버튼 설정 이어받기
      st.skins = [...new Set(st.skins.map((id) => OLD_SKIN_IDS[id] || id))];
      st.skin = OLD_SKIN_IDS[st.skin] || st.skin;
      return st;
    }
  } catch (e) { /* 저장소 없음 */ }
  return null;
}
function save() {
  if (window.__noSave) return; // 치트 '처음 시작 미리보기'·'되돌리기' 중 다시 켜기 직전엔 저장 안 함
  if (window.__resetting) return; // 초기화 중에는 저장하지 않는다
  S.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ }
}
const S = load() || freshState();
const awaySec = Math.max(0, (Date.now() - S.lastSeen) / 1000);
let paused = false;

let wave = { idx: 0, total: 3, spawned: 0, kills: 0, bossSpawned: false, spawnT: 0.5, breakT: 0 };
let heroHp = BAL.heroHp, heroMax = BAL.heroHp;
// 셰프 위치·이동 상태
const P = { blinkT: 2, hitT: 0, x: WW / 2, y: 900, vx: 0, vy: 0, face: 1, walkT: 0, squash: 0, wp: null, wpT: 0 };
let bossT = 0;
const enemies = [], bullets = [], fxList = [];
const gunTimers = Array(MAX_SLOTS).fill(0);

// ---------- 화면 맞춤 ----------
const shell = document.getElementById('shell');
let scale = 1, app;
function backbufferRes() { return Math.min(S.settings.saver ? 1.25 : 2, Math.max(1, (window.devicePixelRatio || 1) * scale)); } // 최대 2배 (발열, 2026-10-21: 폰 화면 실제 픽셀과 거의 같음)
function fit() {
  scale = Math.min(innerWidth / W, innerHeight / H);
  shell.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
  // 셸을 CSS로 확대하므로 백버퍼는 기기 픽셀 비율 × 셸 배율로 키운다 (ux:runtime-resize#c3)
  if (app) {
    const r = backbufferRes();
    if (Math.abs(app.renderer.resolution - r) > 0.01) app.renderer.resize(FW, CH, r);
  }
}
addEventListener('resize', fit);
fit();

// ---------- 그리기 ----------
// ---------- 손그림 에셋 (assets/img/*.webp) — 없으면 코드 그림으로 대신한다 ----------
const IMG = 'assets/img/';
const TOOL_ART = ['spoon', 'fork', 'chopsticks', 'knife', 'salt', 'pan', 'pot', 'kettle'];
const toolKey = (L) => { const i = Math.min(L, 8); return `tool_0${i}_${TOOL_ART[i - 1]}`; };
const toolImg = (L) => `${IMG}${toolKey(L)}.webp`;
const COIN = `<img class="ic" src="${IMG}icon_coin.webp" alt="">`;
const GEM = `<img class="ic" src="${IMG}icon_gem.webp" alt="💎">`;
const STAR = `<img class="ic" src="${IMG}icon_star.webp" alt="⭐">`;
const TIMER = `<img class="ic" src="${IMG}icon_timer.webp" alt="">`; // 초시계 그림 (8차, 2026-10-22)
// 숫자 뒤 조사 '로/으로' (숫자 끝 읽는 소리: 0·3·6 → 으로, 나머지 → 로)
const roKo = (n) => ([0, 3, 6].includes(n % 10) ? '으로' : '로');
const icon = (key, alt = '') => `<img class="ic" src="${IMG}${key}.webp" alt="${alt}">`;
const SKIN_ART = { brown: 'hero_chef', pirate: 'hero_pirate', patissier: 'hero_patissier', santa: 'hero_santa', king: 'hero_king',
  ninja: 'hero_ninja', hanbok: 'hero_hanbok', wizard: 'hero_wizard', sushi: 'hero_sushi', pizza: 'hero_pizza', barista: 'hero_barista', space: 'hero_space' };
const ART_KEYS = ['bg_floor_tile', 'bg_wall', 'prop_shelf', 'prop_window', 'prop_utensil_rack', 'prop_rug', 'prop_flour', 'prop_onion_peel', 'prop_board',
  'enemy_tomato', 'enemy_carrot', 'enemy_broccoli', 'boss_onion', 'mate_chick', 'mate_bunny', 'mate_penguin',
  'proj_egg', 'proj_macaron', 'proj_bean', 'fx_hit', 'fx_poof', 'fx_stun', 'icon_coin',
  'hero_chef', 'hero_pirate', 'hero_patissier', 'hero_santa', 'hero_king', ...TOOL_ART.map((_, i) => toolKey(i + 1))];
const ART = {};
const AVAIL = new Set(); // manifest에 있는 그림 이름 (HTML에서만 쓰는 UI·아이콘은 여기서 있는지만 확인)
// 한국어 글자가 그려진 그림(꼬리표·도장·로고 등)은 한국어 화면에서만 쓰고, 다른 언어에서는 글자로 대신한다
// 영어 화면은 같은 이름 + '_en' 그림(7차, 2026-10-21)을 쓰고, 없으면 글자로 대신한다
const KO_TEXT_ART = new Set(['ui_logo']); // 꼬리표·도장·배지는 CSS 글자로 바꿈 (2026-10-22)
const isTextArt = (k) => KO_TEXT_ART.has(k) || k.startsWith('ui_chapter_');
const textArt = (k) => (LANG !== 'ko' && isTextArt(k) ? k + '_' + LANG : k); // 언어에 맞는 그림 이름
const hasTextArt = (k) => AVAIL.has(textArt(k));
// 전장(PixiJS)에 그리는 그림만 텍스처로 올린다 — UI·아이콘은 HTML <img>가 필요할 때 받는다
const PIXI_ART = /^(bg_|prop_|enemy_|boss_|king_|anim_|mate_|proj_|fx_|hero_|tool_|icon_coin$|icon_boss$|ui_aim$)/;
// assets/img/manifest.json (tools/convert_assets.py 가 만든다)에 있는 그림만 불러온다 — 없는 그림은 임시 그림으로
async function loadArt() {
  let keys = ART_KEYS;
  try { keys = await (await fetch(IMG + 'manifest.json', { cache: 'no-store' })).json(); } catch (e) { /* 목록이 없으면 기본 목록 */ }
  keys.forEach((k) => AVAIL.add(k));
  document.body.classList.toggle('has-check', AVAIL.has('icon_check')); // 체크 그림(13차)이 오면 ✓ 글자 대신 그림
  await Promise.all(keys.filter((k) => PIXI_ART.test(k)).map(async (k) => {
    try { ART[k] = await PIXI.Assets.load(IMG + k + '.webp'); } catch (e) { console.warn('이미지 없음 — 코드 그림 사용:', k); }
  }));
}
// 캐릭터·무기 그림에 진갈색 외곽선을 한 번만 입힌다 (2026-10-22 사용자: 화면 기준 2px). 켤 때 한 번 구워 두므로 플레이 중 부담은 없다
// 두께는 그림 픽셀로 바꿔 넣는다: 화면 2px × (그림 높이 ÷ 화면 속 키). 그림 크기는 그대로(바깥 여백 안에 그린다)
const OUTLINE = { px: 2, color: 0x2a1a10 };
const OUTLINE_H = [['hero_', 168], ['mate_', 96], ['enemy_', 87], ['boss_', 202], ['king_', 350], ['tool_', 60], ['proj_', 34]];
function outlineArt() {
  const c = OUTLINE.color, r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const sil = new PIXI.ColorMatrixFilter();
  sil.matrix = [0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 0, 1, 0]; // 모양만 따서 외곽선 색으로
  for (const k of Object.keys(ART)) {
    const tex = ART[k];
    let frameH = tex.height, showH;
    if (k.startsWith('anim_king_')) { // 공격 시트: 프레임 하나(정사각형)가 화면에서 약 530px (KING_H × 0.91 ÷ 캐릭터 비율 0.6)
      const n = +((k.match(/_(\d+)f$/) || [])[1] || 1), cols = Math.round(Math.sqrt(n * tex.width / tex.height));
      frameH = tex.width / Math.max(1, cols); showH = KING_H * 0.91 / 0.6;
    } else { const hit = OUTLINE_H.find(([p]) => k.startsWith(p)); if (!hit) continue; showH = hit[1]; }
    const t = Math.max(1, OUTLINE.px * frameH / showH);
    const box = new PIXI.Container(), ring = new PIXI.Container();
    const dirs = t > 4 ? 16 : 8;
    for (let i = 0; i < dirs; i++) { const a = (i / dirs) * Math.PI * 2, sp = new PIXI.Sprite(tex); sp.position.set(Math.cos(a) * t, Math.sin(a) * t); ring.addChild(sp); }
    ring.filters = [sil];
    box.addChild(ring, new PIXI.Sprite(tex));
    ART[k] = app.renderer.generateTexture({ target: box, frame: new PIXI.Rectangle(0, 0, tex.width, tex.height), resolution: 1 });
    box.destroy({ children: true });
  }
}
// 그림 한 장: 지정 높이로 맞추고 기준점(기본: 발밑 가운데)을 둔다
function artSprite(key, h, ay = 1) {
  const sp = new PIXI.Sprite(ART[key]);
  sp.anchor.set(0.5, ay);
  sp.scale.set(h / sp.texture.height);
  return sp;
}
// 셰프·동료 머리 위 체력 막대 (가운데 기준, 위쪽 y). 2026-10-21부터 손그림(ui_hero_hp_*) 대신 코드 게이지(drawGauge) — 두껍게 해도 끝이 안 뭉개지게
function makeHpBar(w, y, h = 22) {
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  c.y = y;
  c.addChild(g);
  c.set = (r) => drawGauge(g, -w / 2, 0, w, h, Math.max(0, Math.min(1, r)), r > 0.35 ? 0x7fd14f : 0xe8483a, 3);
  c.set(1);
  return c;
}
// 체력 게이지 공통 (2026-10-21 사용자: 더 두껍게, 보스 바와 같은 모양) — 진갈색 테두리 + 어두운 바탕 + 채움 + 위쪽 밝은 띠
function drawGauge(g, x, y, w, h, r, color, line) {
  const iw = w - line * 2, ih = h - line * 2, fw = iw * r;
  g.clear().roundRect(x, y, w, h, h / 2).fill(0x4b3021);
  g.roundRect(x + line, y + line, iw, ih, ih / 2).fill(0x6e4a34);
  if (fw > 0) {
    g.roundRect(x + line, y + line, Math.max(fw, ih), ih, ih / 2).fill(color);
    const hi = Math.max(2, Math.round(ih * 0.25));
    g.roundRect(x + line + ih * 0.3, y + line + ih * 0.15, Math.max(fw - ih * 0.6, 0), hi, hi / 2).fill({ color: 0xffffff, alpha: 0.35 });
  }
}

// ---------- 챕터: 10스테이지마다 장소·적·보스가 바뀐다 ----------
// 그림이 아직 없는 챕터는 주방 그림에 장소 색(tint)을 입혀 임시로 보여준다
// props: [이름, 자리, x, y, 높이] — 그림 비율이 제각각이라 폭이 아니라 '높이'로 맞춘다 (셰프 키 168 기준)
//   'wall' = 벽에 건 것(가운데 기준), 'floor' = 바닥에 선 것(y = 발밑). 벽 아래선(가구) y≈450, 바닥 아래쪽 y≈1150
const CHAPTERS = [
  { id: 'kitchen', name: t('ch.kitchen'), icon: '🍳', enemies: ['tomato', 'carrot', 'broccoli'], boss: 'onion', tint: 0xffffff },
  { id: 'fridge', name: t('ch.fridge'), icon: '🧊', enemies: ['cheese', 'milk', 'jelly'], boss: 'cake', tint: 0xd8ecff,
    props: [['milk', 'floor', 190, 460, 110], ['eggs', 'floor', 890, 450, 70], ['ice', 'floor', 180, 1180, 105], ['pudding', 'floor', 920, 1130, 75]] },
  { id: 'pantry', name: t('ch.pantry'), icon: '📦', enemies: ['potato', 'garlic', 'mushroom'], boss: 'potato', tint: 0xf2dcc0,
    props: [['garlic', 'wall', 540, 150, 120], ['flour_sack', 'floor', 200, 450, 120], ['crate', 'floor', 880, 450, 110], ['onion_basket', 'floor', 190, 1170, 85]] },
  { id: 'hall', name: t('ch.hall'), icon: '🍽️', enemies: ['steak', 'noodle', 'shrimp'], boss: 'turkey', tint: 0xf8d2d2,
    props: [['menu', 'floor', 190, 460, 160], ['cart', 'floor', 890, 460, 150], ['table', 'floor', 200, 1200, 140], ['candle', 'floor', 930, 1170, 100]] },
  { id: 'bakery', name: t('ch.bakery'), icon: '🥐', enemies: ['bread', 'donut', 'croissant'], boss: 'baguette', tint: 0xfff2c8,
    props: [['bread_shelf', 'wall', 540, 160, 130], ['dough_table', 'floor', 200, 450, 120], ['oven', 'floor', 880, 460, 180], ['cake_stand', 'floor', 200, 1200, 110]] },
];
const ARENA = { id: 'arena', name: t('place.arena'), icon: '🔥', tint: 0xb06060 };
const chapterIdx = (st) => Math.floor((st - 1) / 10) % CHAPTERS.length;
const chapterOf = (st) => CHAPTERS[chapterIdx(st)];
// 바퀴: 챕터 5개(50스테이지)를 한 번 돌면 1바퀴. 2바퀴(51~)부터 '한밤의 주방' — 배경이 밤 색, 다른 챕터 적이 섞이고 가끔 강한 적 (2026-10-21)
const lapOf = (st) => Math.floor((st - 1) / (10 * CHAPTERS.length));
// 강한 적 빛 색: 그림의 알파(모양)만 남기고 밝은 빨강(#ff3a26)으로 칠하는 색 행렬 (한 번 만들어 같이 쓴다)
let STRONG_RED_F = null;
const strongRed = () => {
  // 색 = 그림의 불투명도 × 빨강 (구운 그림의 투명한 곳이 빨갛게 네모로 번지지 않게), 진하기 1.8배 (2026-10-21)
  if (!STRONG_RED_F) { STRONG_RED_F = new PIXI.ColorMatrixFilter(); STRONG_RED_F.matrix = [0, 0, 0, 1, 0, 0, 0, 0, 0.23, 0, 0, 0, 0, 0.15, 0, 0, 0, 0, 1.8, 0]; }
  return STRONG_RED_F;
};
const NIGHT_TINT = 0x7a82b4, LAP_MIX = 0.35, STRONG_CHANCE = 0.08, STRONG = { r: 1.3, hp: 4, gold: 4 }; // 강한 적은 빨간 빛으로 구분 (spawnEnemy glow)
// 10스테이지마다 나오는 강한 보스의 화면 이름: 챕터마다 '대왕 양파'(King Onion)… (2026-10-21 사용자 결정, 한국어 보스 이름은 모두 받침 없음 → 조사 '가')
const wallBossName = (st) => t('king.' + chapterOf(st).id);
// 적 그림: 그 챕터 그림이 있으면 그것, 없으면 주방 적을 장소 색으로 칠해 대신
// 대왕 보스(10스테이지마다)는 전용 그림 king_<챕터>가 있으면 그것 (IMAGE_TODO, 2026-10-21), 없으면 일반 보스 그림
function enemyArt(ch, boss, i, wall = false) {
  if (boss && wall && ART['king_' + ch.id]) return { key: 'king_' + ch.id, tint: 0xffffff, kind: 'onion' };
  const own = boss ? 'boss_' + ch.boss : 'enemy_' + ch.enemies[i];
  if (ART[own]) return { key: own, tint: 0xffffff, kind: boss ? 'onion' : CHAPTERS[0].enemies[i] };
  return { key: boss ? 'boss_onion' : 'enemy_' + CHAPTERS[0].enemies[i], tint: ch.tint, kind: boss ? 'onion' : CHAPTERS[0].enemies[i] };
}

// 배경: 반복 바닥 타일 + 벽 한 장 + 소품
const WALL_H = Math.round(WW * 626 / 2048);
function makeBackground(ch = CHAPTERS[0]) {
  if (!ART.bg_floor_tile || !ART.bg_wall) return makeBackgroundVector();
  const c = new PIXI.Container();
  const kitchen = ch.id === 'kitchen';
  const fk = kitchen ? 'bg_floor_tile' : `bg_${ch.id}_floor_tile`, wk = kitchen ? 'bg_wall' : `bg_${ch.id}_wall`;
  const own = !!(ART[fk] && ART[wk]);
  const floor = new PIXI.TilingSprite({ texture: own ? ART[fk] : ART.bg_floor_tile, width: WW, height: WH - WALL_H + 20 });
  floor.tileScale.set(112 / 512); // 타일 그림 2×2칸 = 112 디자인 px (한 칸 56 ≈ 셰프 키의 1/3)
  floor.y = WALL_H - 20;
  const wall = new PIXI.Sprite(own ? ART[wk] : ART.bg_wall);
  wall.width = WW; wall.height = WALL_H;
  if (!own) { floor.tint = ch.tint; wall.tint = ch.tint; } // 그림이 오기 전 임시 색
  c.addChild(floor, wall);
  // 눕혀 놓은 것·벽에 건 것의 그림자: 같은 그림을 검게 칠해 아래로 살짝 비킨다
  // (발밑 타원 그림자 0.18보다 조금 진하게 — 그림 밑으로 삐져나오는 폭이 좁아서 같은 값이면 체크무늬 바닥에서 안 보인다)
  const dropShadow = (sp, dy) => {
    const sh = new PIXI.Sprite(sp.texture); sh.anchor.copyFrom(sp.anchor); sh.scale.copyFrom(sp.scale);
    sh.position.set(sp.x, sp.y + dy); sh.tint = 0x000000; sh.alpha = 0.24; c.addChild(sh);
  };
  const SHADOW_FLAT = 9, SHADOW_WALL = 10;
  const put = (key, x, y, w, dy, ay = 0.5) => {
    if (!ART[key]) return;
    const sp = new PIXI.Sprite(ART[key]); sp.anchor.set(0.5, ay);
    sp.scale.set(w / sp.texture.width); sp.position.set(x, y);
    dropShadow(sp, dy); c.addChild(sp);
  };
  if (!kitchen) {
    // 챕터 소품: 높이로 크기를 맞추고, 바닥에 선 것은 발밑을 y에 둔다 (그림이 있는 것만)
    for (const [name, place, x, y, h] of ch.props || []) {
      const key = `prop_${ch.id}_${name}`;
      if (!ART[key]) continue;
      const sp = new PIXI.Sprite(ART[key]);
      sp.anchor.set(0.5, place === 'wall' ? 0.5 : 1);
      sp.scale.set(h / sp.texture.height); sp.position.set(x, y);
      // 바닥에 선 소품은 발밑에 타원 그림자, 벽에 건 것은 그림 모양 그림자 (셰프·적과 같은 색·진하기)
      if (place === 'floor') c.addChild(new PIXI.Graphics().ellipse(x, y - 4, sp.width * 0.46, Math.max(8, sp.width * 0.09)).fill({ color: 0x000000, alpha: 0.18 }));
      else dropShadow(sp, SHADOW_WALL);
      c.addChild(sp);
    }
    return c;
  }
  // 벽 장식
  put('prop_utensil_rack', 470, 120, 190, SHADOW_WALL);
  put('prop_shelf', 190, 150, 270, SHADOW_WALL);
  put('prop_window', 830, 125, 220, SHADOW_WALL);
  // 바닥 소품 — 카메라 이동이 눈에 띄게 흩어 둔다 (바닥에 눕혀 놓은 것이라 그림 모양 그림자)
  put('prop_rug', 520, 820, 300, SHADOW_FLAT);
  put('prop_board', 130, 640, 140, SHADOW_FLAT);
  put('prop_flour', 190, 1170, 150, SHADOW_FLAT);
  put('prop_onion_peel', 900, 1050, 90, SHADOW_FLAT);
  return c;
}
function makeBackgroundVector() {
  const g = new PIXI.Graphics();
  // 벽 타일
  g.rect(0, 0, WW, COUNTER_Y).fill(0xf3e6cf);
  for (let x = 0; x <= WW; x += 60) g.rect(x, 0, 2, COUNTER_Y).fill(0xe2cfac);
  for (let y = 0; y <= COUNTER_Y; y += 60) g.rect(0, y, WW, 2).fill(0xe2cfac);
  // 선반과 냄비
  g.rect(40, 150, 260, 14).fill(0x9a6a3c);
  g.roundRect(70, 104, 60, 46, 8).fill(0x8c96a0); g.rect(62, 100, 76, 8).fill(0x6c7680);
  g.circle(190, 128, 22).fill(0xc9483a); g.rect(184, 100, 12, 10).fill(0x6c7680);
  g.roundRect(240, 96, 36, 54, 6).fill(0xe8d070);
  // 걸린 조리도구
  g.rect(440, 54, 180, 8).fill(0x6c7680);
  [[470, 0x8c96a0], [530, 0x9a6a3c], [590, 0x8c96a0]].forEach(([x, c]) => {
    g.rect(x - 3, 60, 6, 70).fill(c); g.circle(x, 140, 16).fill(c);
  });
  // 오른쪽 벽: 창문과 두 번째 선반
  g.roundRect(720, 50, 200, 160, 10).fill(0x9a6a3c);
  g.roundRect(732, 62, 176, 136, 6).fill(0xaee0f5);
  g.rect(818, 62, 4, 136).fill(0x9a6a3c); g.rect(732, 128, 176, 4).fill(0x9a6a3c);
  g.rect(960, 150, 120, 12).fill(0x9a6a3c);
  g.roundRect(980, 112, 34, 38, 6).fill(0x6cc070); g.roundRect(1030, 104, 30, 46, 6).fill(0xe8d070);
  // 조리대
  g.rect(0, COUNTER_Y - 30, WW, 26).fill(0xc08a56);
  g.rect(0, COUNTER_Y - 4, WW, 40).fill(0x8a5a30);
  // 바닥 체크 타일
  const T = 80;
  for (let y = COUNTER_Y + 36, r = 0; y < WH; y += T, r++)
    for (let x = 0, c = 0; x < WW; x += T, c++) g.rect(x, y, T, T).fill((r + c) % 2 ? 0xe9dcc4 : 0xd8c6a6);
  // 바닥 소품: 발판, 엎질러진 밀가루, 떨어진 양파 껍질 — 카메라 이동이 눈에 띄게
  g.roundRect(380, 760, 260, 120, 24).fill(0xb85a4a); g.roundRect(396, 776, 228, 88, 18).fill(0xc96a58);
  g.circle(180, 1150, 46).fill({ color: 0xffffff, alpha: 0.75 }); g.circle(220, 1176, 30).fill({ color: 0xffffff, alpha: 0.7 });
  g.circle(150, 1186, 22).fill({ color: 0xffffff, alpha: 0.65 });
  g.ellipse(880, 1040, 40, 22).fill(0xd8b8e0); g.ellipse(930, 1300, 70, 40).fill({ color: 0x6a8ab0, alpha: 0.35 });
  g.roundRect(60, 600, 120, 70, 14).fill(0x9a6a3c);
  return g;
}

// ---------- 귀여운 캐릭터 공통: 진한 외곽선 + 반짝이는 눈 + 볼터치 ----------
const OUT = 0x3a2418;
const ol = (w = 4.5) => ({ width: w, color: OUT, join: 'round', cap: 'round' });
const BLUSH = { color: 0xff8fa3, alpha: 0.55 };
// 반짝이는 눈 하나 (큰 검은 눈 + 하이라이트 두 개)
function shinyEye(g, x, y, rx, ry) {
  g.ellipse(x, y, rx, ry).fill(0x2a1a10);
  g.circle(x + rx * 0.3, y - ry * 0.4, rx * 0.42).fill(0xffffff);
  g.circle(x - rx * 0.3, y + ry * 0.35, rx * 0.2).fill(0xffffff);
}

// 스킨 의상에 맞춰 셰프 곰을 다시 그린다 (곰 자체는 그대로)
// h = { g: 몸·얼굴, eyes: 눈(깜빡임용), footL, footR }
function drawHero(h, k) {
  if (h.sprite) { h.sprite.texture = skinTex[k.id] || skinTex.brown; h.sprite.scale.set(HERO_H / h.sprite.texture.height); return; }
  const g = h.g;
  g.clear();
  if (k.cape) g.poly([-30, 4, 30, 4, 48, 64, -48, 64]).fill(k.cape).stroke(ol());
  // 팔(뒤) + 몸통
  g.circle(-31, 32, 11).fill(BEAR.fur).stroke(ol());
  g.ellipse(0, 36, 34, 28).fill(BEAR.fur).stroke(ol());
  if (k.coat) {
    g.ellipse(0, 38, 31, 24).fill(k.coat);
    g.rect(-5, 14, 10, 46).fill(0xffffff);
    g.rect(-31, 40, 62, 8).fill(0x2a2a2a);
    g.roundRect(-8, 38, 16, 12, 3).fill(0xffd34d).stroke(ol(2.5));
  }
  if (k.apron) {
    g.roundRect(-21, 20, 42, 40, 12).fill(k.apron).stroke(ol(3));
    if (k.stripes) [28, 40, 52].forEach((y) => g.rect(-19, y, 38, 5).fill(k.stripes));
    if (k.apronTrim) g.roundRect(-21, 20, 42, 40, 12).stroke({ width: 4, color: k.apronTrim });
    g.roundRect(-10, 36, 20, 12, 4).fill({ color: 0x000000, alpha: 0.08 });
  }
  // 귀
  g.circle(-33, -50, 16).fill(BEAR.fur).stroke(ol()); g.circle(-33, -50, 8).fill(BEAR.inner);
  g.circle(33, -50, 16).fill(BEAR.fur).stroke(ol()); g.circle(33, -50, 8).fill(BEAR.inner);
  // 얼굴 (머리가 큰 2등신)
  g.circle(0, -16, 44).fill(BEAR.face).stroke(ol());
  g.ellipse(-14, -40, 14, 7).fill({ color: 0xffffff, alpha: 0.18 }); // 머리 윤기
  g.ellipse(-28, 4, 9, 6).fill(BLUSH); g.ellipse(28, 4, 9, 6).fill(BLUSH);
  g.ellipse(0, 4, 19, 14).fill(BEAR.muzzle);
  if (k.beard) {
    g.circle(-18, 16, 13).fill(0xffffff).stroke(ol(3)); g.circle(18, 16, 13).fill(0xffffff).stroke(ol(3));
    g.circle(0, 22, 16).fill(0xffffff).stroke(ol(3));
    g.ellipse(-9, 6, 10, 5).fill(0xffffff); g.ellipse(9, 6, 10, 5).fill(0xffffff);
  } else {
    // ω 입
    g.moveTo(-8, 7).quadraticCurveTo(-4, 13, 0, 7).quadraticCurveTo(4, 13, 8, 7).stroke(ol(2.5));
  }
  g.ellipse(0, -2, 7, 5).fill(0x2a1a10); g.circle(-2, -4, 1.8).fill(0xffffff);
  // 모자
  if (k.hat === 'chef') {
    g.circle(-22, -90, 20).fill(0xffffff).stroke(ol()); g.circle(22, -90, 20).fill(0xffffff).stroke(ol());
    g.circle(0, -100, 25).fill(0xffffff).stroke(ol());
    g.roundRect(-34, -76, 68, 22, 7).fill(0xf7f7f2).stroke(ol());
  } else if (k.hat === 'pirate') {
    g.poly([-54, -56, 54, -56, 38, -94, 0, -84, -38, -94]).fill(0x2a2a2a).stroke(ol());
    g.rect(-46, -66, 92, 6).fill(0xd4a017);
    g.circle(0, -76, 7).fill(0xffffff); g.rect(-3, -71, 6, 5).fill(0xffffff);
  } else if (k.hat === 'beret') {
    g.ellipse(6, -62, 48, 18).fill(k.hatColor).stroke(ol());
    g.circle(8, -82, 7).fill(k.hatColor).stroke(ol(3));
  } else if (k.hat === 'santa') {
    g.poly([-36, -62, 36, -62, -6, -114]).fill(0xd93a3a).stroke(ol());
    g.circle(-8, -114, 10).fill(0xffffff).stroke(ol(3));
    g.roundRect(-42, -70, 84, 18, 9).fill(0xffffff).stroke(ol());
  } else if (k.hat === 'crown') {
    g.poly([-32, -54, -36, -98, -16, -76, 0, -106, 16, -76, 36, -98, 32, -54]).fill(0xffd34d).stroke(ol());
    g.rect(-30, -62, 60, 8).fill(0xe0a800);
    g.circle(0, -78, 6).fill(0xff4d6d); g.circle(-20, -66, 4).fill(0x4aa3df); g.circle(20, -66, 4).fill(0x6cc070);
  }
  // 목 장식
  if (k.neck === 'scarf') g.poly([-20, 24, 20, 24, 0, 38]).fill(k.neckColor).stroke(ol(3));
  else if (k.neck === 'bow') {
    g.poly([0, 28, -18, 19, -18, 37]).fill(k.neckColor).stroke(ol(3)); g.poly([0, 28, 18, 19, 18, 37]).fill(k.neckColor).stroke(ol(3));
    g.circle(0, 28, 6).fill(k.neckColor).stroke(ol(2.5));
  }
  // 오른팔(앞) — 뒤집개를 쥔 손
  g.circle(31, 32, 11).fill(BEAR.fur).stroke(ol());

  // 눈 (깜빡일 때 세로로 접는다) — h.eyes 는 y=-16 기준
  const e = h.eyes;
  e.clear();
  shinyEye(e, -17, 0, 7, 9);
  if (k.eyepatch) {
    e.moveTo(8, -8).lineTo(-40, -22).stroke({ width: 3, color: 0x111111 });
    e.moveTo(26, -6).lineTo(42, 2).stroke({ width: 3, color: 0x111111 });
    e.ellipse(17, 0, 11, 10).fill(0x111111);
  } else shinyEye(e, 17, 0, 7, 9);

  // 발 (걸을 때 번갈아 움직인다)
  [h.footL, h.footR].forEach((f) => {
    f.clear();
    f.ellipse(0, 0, 13, 9).fill(0x7a4a30).stroke(ol());
    f.ellipse(0, 1, 6, 4).fill(BEAR.inner);
  });
}

// ---------- 손그림 셰프 곰 (assets/bear-chef.png) — 스킨마다 모자·옷·스카프를 다시 칠한 텍스처 ----------
const BEAR_IMG = 'assets/img/hero_chef.webp';
const skinTex = {}, skinThumb = {};
// 원본 이미지(755×800) 좌표 기준 부위 판정
function bearPart(x, y, r, g, b, W0, H0) {
  const sx = x * 755 / W0, sy = y * 800 / H0;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 510;
  const pale = L > 0.72 && mx - mn < 45;            // 흰색·크림색 (모자·조리복)
  // 모자: 머리와 모자 경계(대각선 (370,215)→(640,355)) 위쪽의 흰 부분 — 눈 흰자는 선 아래라 제외
  if (pale && sx > 360 && sy < 215 + (sx - 370) * (140 / 270)) return 'hat';
  if (pale && sy > 432) return 'coat';
  // 스카프: 진한 빨강만 (갈색 털은 초록 성분이 커서 제외), 목 둘레 영역 안에서만
  if (r > 185 && g < 90 && b < 90 && r - g > 115 && sx > 250 && sx < 500 && sy > 470 && sy < 650) return 'scarf';
  return null;
}
function recolorBear(im, look) {
  const d = im.data, W0 = im.width, H0 = im.height;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    const i = (y * W0 + x) * 4;
    if (d[i + 3] < 10) continue;
    const part = bearPart(x, y, d[i], d[i + 1], d[i + 2], W0, H0);
    const to = part && look[part];
    if (to == null) continue;
    // 원래 밝기(음영·결)를 유지한 채 색만 바꾼다
    const L = (Math.max(d[i], d[i + 1], d[i + 2]) + Math.min(d[i], d[i + 1], d[i + 2])) / 510;
    const k = Math.min(1.08, L / (part === 'scarf' ? 0.55 : 0.93));
    d[i] = ((to >> 16) & 255) * k; d[i + 1] = ((to >> 8) & 255) * k; d[i + 2] = (to & 255) * k;
  }
}
function drawBearProps(cx, look) {
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  const line = '#3a2418';
  if (look.eyepatch) {
    cx.strokeStyle = '#111'; cx.lineWidth = 9;
    cx.beginPath(); cx.moveTo(452, 330); cx.lineTo(262, 236); cx.stroke();
    cx.beginPath(); cx.moveTo(528, 352); cx.lineTo(612, 336); cx.stroke();
    cx.fillStyle = '#16161a'; cx.strokeStyle = line; cx.lineWidth = 6;
    cx.beginPath(); cx.ellipse(488, 362, 50, 46, 0.2, 0, Math.PI * 2); cx.fill(); cx.stroke();
  }
  if (look.skull) {
    cx.fillStyle = '#fff'; cx.strokeStyle = line; cx.lineWidth = 5;
    cx.beginPath(); cx.arc(560, 170, 32, 0, Math.PI * 2); cx.fill(); cx.stroke();
    cx.fillRect(546, 196, 28, 18); cx.strokeRect(546, 196, 28, 18);
    cx.fillStyle = '#16161a';
    cx.beginPath(); cx.arc(548, 168, 8, 0, Math.PI * 2); cx.arc(572, 168, 8, 0, Math.PI * 2); cx.fill();
  }
  if (look.pom) {
    cx.fillStyle = '#fff'; cx.strokeStyle = line; cx.lineWidth = 7;
    cx.beginPath(); cx.arc(612, 52, 46, 0, Math.PI * 2); cx.fill(); cx.stroke();
  }
  if (look.gems) {
    cx.strokeStyle = line; cx.lineWidth = 5;
    [[470, 250, '#ff4d6d'], [545, 282, '#4aa3df'], [615, 315, '#6cc070']].forEach(([x, y, c]) => {
      cx.fillStyle = c; cx.beginPath(); cx.arc(x, y, 17, 0, Math.PI * 2); cx.fill(); cx.stroke();
    });
  }
}
async function buildSkinTextures() {
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = BEAR_IMG; });
  const W0 = img.width, H0 = img.height;
  const base = document.createElement('canvas'); base.width = W0; base.height = H0;
  const bx = base.getContext('2d'); bx.drawImage(img, 0, 0);
  const src = bx.getImageData(0, 0, W0, H0);
  const thumbOf = (source) => {
    const t = document.createElement('canvas'); t.width = 150; t.height = Math.round(150 * source.height / source.width);
    t.getContext('2d').drawImage(source, 0, 0, t.width, t.height);
    return t.toDataURL();
  };
  for (const k of SKINS) {
    const art = ART[SKIN_ART[k.id]];
    if (art) { skinTex[k.id] = art; skinThumb[k.id] = thumbOf(art.source.resource); continue; }
    const cv = document.createElement('canvas'); cv.width = W0; cv.height = H0;
    const cx = cv.getContext('2d');
    const im = new ImageData(new Uint8ClampedArray(src.data), W0, H0);
    recolorBear(im, k.look);
    cx.putImageData(im, 0, 0);
    cx.save(); cx.scale(W0 / 755, H0 / 800); drawBearProps(cx, k.look); cx.restore();
    skinTex[k.id] = PIXI.Texture.from(cv);
    const t = document.createElement('canvas'); t.width = 150; t.height = Math.round(150 * H0 / W0);
    t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height);
    skinThumb[k.id] = t.toDataURL();
  }
}

function makeHero() {
  if (skinTex.brown) return makeSpriteHero();
  const c = new PIXI.Container();
  const shadow = new PIXI.Graphics().ellipse(0, 68, 52, 11).fill({ color: 0x000000, alpha: 0.18 });
  const footL = new PIXI.Graphics(), footR = new PIXI.Graphics();
  footL.position.set(-16, 62); footR.position.set(16, 62);
  const body = new PIXI.Container();
  const g = new PIXI.Graphics();
  const eyes = new PIXI.Graphics();
  eyes.position.set(0, -16);
  body.addChild(g, eyes);
  c.addChild(shadow, footL, footR, body);

  // 손에 든 뒤집개 (조준 방향으로 회전)
  const tool = new PIXI.Graphics();
  tool.roundRect(-4, -34, 8, 34, 4).fill(0x8a5a30).stroke(ol(3));
  tool.roundRect(-12, -60, 24, 28, 6).fill(0xd0d6dc).stroke(ol(3.5));
  tool.rect(-6, -55, 3, 16).fill(0x9aa2aa); tool.rect(3, -55, 3, 16).fill(0x9aa2aa);
  tool.position.set(34, 30);
  c.addChild(tool);

  const hp = makeHpBar(100, -118); // 코드 그림 셰프도 머리 위
  c.addChild(hp);
  const h = { c, body, g, eyes, footL, footR, gun: tool, hp };
  drawHero(h, skinById(S.skin));
  return h;
}

// 손그림 이미지 셰프: 한 장짜리라 눈 깜빡임·발 대신 몸 전체가 통통 튄다
const HERO_H = 168; // 화면 속 셰프 키(논리 px)
function makeSpriteHero() {
  const c = new PIXI.Container();
  const shadow = new PIXI.Graphics().ellipse(0, 68, 52, 11).fill({ color: 0x000000, alpha: 0.18 });
  const body = new PIXI.Container();
  const sprite = new PIXI.Sprite(skinTex[S.skin] || skinTex.brown);
  sprite.anchor.set(0.5, 1);
  sprite.scale.set(HERO_H / sprite.texture.height);
  sprite.position.set(0, 72);
  body.addChild(sprite);
  const dummy = () => { const g = new PIXI.Graphics(); g.visible = false; return g; };
  const footL = dummy(), footR = dummy(), eyes = dummy(), tool = dummy();
  c.addChild(shadow, body, footL, footR, tool);
  const hp = makeHpBar(100, 72 - HERO_H - 26); // 체력 막대는 적처럼 머리 위 (2026-10-21 통일, 두께 22)
  c.addChild(hp);
  return { c, body, g: sprite, sprite, eyes, footL, footR, gun: tool, hp };
}

// 동료 그림 — 작은 동물 조수들 (발밑 y≈28)
function drawMate(g, id) {
  if (id === 'chick') {
    g.ellipse(-7, 26, 6, 3).fill(0xff8c42).stroke(ol(2.5)); g.ellipse(7, 26, 6, 3).fill(0xff8c42).stroke(ol(2.5));
    g.ellipse(0, 8, 20, 18).fill(0xffd34d).stroke(ol(3.5));
    g.ellipse(-14, 8, 7, 9).fill(0xf0c030).stroke(ol(2.5));
    g.circle(0, -12, 17).fill(0xffe066).stroke(ol(3.5));
    g.poly([10, -11, 22, -7, 10, -3]).fill(0xff8c42).stroke(ol(2.5));
    shinyEye(g, -4, -14, 3.5, 4.5); shinyEye(g, 7, -14, 3.5, 4.5);
    g.ellipse(-9, -6, 4, 2.5).fill(BLUSH);
    g.circle(-6, -34, 7).fill(0xffffff).stroke(ol(2.5)); g.circle(6, -34, 7).fill(0xffffff).stroke(ol(2.5));
    g.roundRect(-9, -31, 18, 6, 2).fill(0xffffff).stroke(ol(2.5));
  } else if (id === 'bunny') {
    g.ellipse(-8, -44, 6, 18).fill(0xf8f8f8).stroke(ol(3)); g.ellipse(-8, -44, 2.5, 12).fill(0xffb6c8);
    g.ellipse(8, -44, 6, 18).fill(0xf8f8f8).stroke(ol(3)); g.ellipse(8, -44, 2.5, 12).fill(0xffb6c8);
    g.ellipse(-8, 26, 7, 4).fill(0xf8f8f8).stroke(ol(2.5)); g.ellipse(8, 26, 7, 4).fill(0xf8f8f8).stroke(ol(2.5));
    g.ellipse(0, 10, 18, 16).fill(0xf8f8f8).stroke(ol(3.5));
    g.roundRect(-11, 2, 22, 18, 6).fill(0xff9ec4).stroke(ol(2.5));
    g.circle(0, -14, 17).fill(0xffffff).stroke(ol(3.5));
    shinyEye(g, -6, -16, 3.5, 4.5); shinyEye(g, 6, -16, 3.5, 4.5);
    g.ellipse(-11, -8, 4, 2.5).fill(BLUSH); g.ellipse(11, -8, 4, 2.5).fill(BLUSH);
    g.ellipse(0, -9, 2.5, 2).fill(0xff7a9a);
  } else {
    g.ellipse(-7, 27, 6, 3).fill(0xff9a2a).stroke(ol(2.5)); g.ellipse(7, 27, 6, 3).fill(0xff9a2a).stroke(ol(2.5));
    g.ellipse(-19, 4, 6, 12).fill(0x2a2a3a).stroke(ol(2.5)); g.ellipse(19, 4, 6, 12).fill(0x2a2a3a).stroke(ol(2.5));
    g.ellipse(0, 0, 20, 27).fill(0x2a2a3a).stroke(ol(3.5));
    g.ellipse(0, 6, 13, 18).fill(0xffffff);
    g.ellipse(0, -13, 14, 9).fill(0xffffff);
    shinyEye(g, -6, -14, 3.2, 4); shinyEye(g, 6, -14, 3.2, 4);
    g.ellipse(-10, -7, 3.5, 2).fill(BLUSH); g.ellipse(10, -7, 3.5, 2).fill(BLUSH);
    g.poly([-4, -9, 4, -9, 0, -3]).fill(0xff9a2a).stroke(ol(2));
    g.poly([-9, 4, 0, 8, -9, 12]).fill(0xd93a3a).stroke(ol(2)); g.poly([9, 4, 0, 8, 9, 12]).fill(0xd93a3a).stroke(ol(2));
  }
}

// 던지는 것 그림 — 도구(레벨 색) 또는 동료 투사체
function drawProj(g, kind, L) {
  if (kind === 'egg') {
    g.ellipse(0, 0, 8, 10).fill(0xfff6d0); g.ellipse(-2, -3, 2.5, 3).fill(0xffffff);
  } else if (kind === 'macaron') {
    g.ellipse(0, -4, 11, 5).fill(0xff9ec4); g.rect(-10, -2, 20, 4).fill(0xfff0d0); g.ellipse(0, 3, 11, 5).fill(0xff9ec4);
  } else if (kind === 'bean') {
    g.ellipse(0, 0, 6, 9).fill(0x6b3e1f); g.moveTo(0, -7).quadraticCurveTo(2, 0, 0, 7).stroke({ width: 1.5, color: 0x3a2210 });
  } else {
    const sz = 8 + Math.min(L, 10) * 1.2;
    g.roundRect(-2.5, 0, 5, sz * 1.4, 2.5).fill(0x6a4a2a);
    g.roundRect(-sz * 0.5, -sz, sz, sz, sz * 0.3).fill(parseInt(gunColor(L).slice(1), 16));
    g.circle(0, -sz * 0.5, sz * 0.18).fill(0xffffff);
  }
}

// 화난 눈 — 썩은 채소 공통 (반짝이는 눈동자 + 굵은 눈썹 + 송곳니 입)
function angryEyes(g, r, y) {
  const ex = r * 0.32, er = r * 0.22, w = Math.max(2.5, r * 0.09);
  g.circle(-ex, y, er).fill(0xffffff).stroke(ol(w * 0.8)); g.circle(ex, y, er).fill(0xffffff).stroke(ol(w * 0.8));
  shinyEye(g, -ex + er * 0.25, y + er * 0.2, er * 0.55, er * 0.62);
  shinyEye(g, ex - er * 0.25, y + er * 0.2, er * 0.55, er * 0.62);
  g.moveTo(-ex - er * 1.1, y - er * 1.5).lineTo(-ex + er * 0.9, y - er * 0.7).stroke(ol(w * 1.3));
  g.moveTo(ex + er * 1.1, y - er * 1.5).lineTo(ex - er * 0.9, y - er * 0.7).stroke(ol(w * 1.3));
  const my = y + r * 0.45;
  g.moveTo(-r * 0.2, my).quadraticCurveTo(0, my - r * 0.12, r * 0.2, my).stroke(ol(w));
  g.poly([r * 0.04, my - r * 0.05, r * 0.14, my - r * 0.03, r * 0.09, my + r * 0.1]).fill(0xffffff);
}
function rotSpots(g, r, pts) {
  pts.forEach(([x, y, s]) => g.circle(x * r, y * r, s * r).fill({ color: 0x5a5a20, alpha: 0.5 }));
}
// 통통 뛰는 작은 발
function vegFeet(g, r, color) {
  g.ellipse(-r * 0.38, r * 1.0, r * 0.22, r * 0.14).fill(color).stroke(ol(Math.max(2.5, r * 0.08)));
  g.ellipse(r * 0.38, r * 1.0, r * 0.22, r * 0.14).fill(color).stroke(ol(Math.max(2.5, r * 0.08)));
}
function drawVeg(g, r, kind) {
  const w = Math.max(3.5, r * 0.13);
  if (kind === 'tomato') {
    vegFeet(g, r, 0x9a2a22);
    g.circle(0, 0, r).fill(0xd9483a).stroke(ol(w));
    g.ellipse(-r * 0.45, -r * 0.45, r * 0.25, r * 0.15).fill({ color: 0xffffff, alpha: 0.35 });
    rotSpots(g, r, [[0.5, 0.35, 0.16], [-0.55, 0.45, 0.11]]);
    g.poly([0, -r * 0.75, -r * 0.45, -r * 1.05, -r * 0.15, -r * 0.85, 0, -r * 1.15, r * 0.15, -r * 0.85, r * 0.45, -r * 1.05]).fill(0x4f8a3c).stroke(ol(w * 0.7));
    angryEyes(g, r, -r * 0.12);
  } else if (kind === 'carrot') {
    vegFeet(g, r, 0xb05a18);
    g.poly([-r * 0.3, -r * 0.75, -r * 0.55, -r * 1.45, -r * 0.05, -r * 0.85]).fill(0x5a9a3a).stroke(ol(w * 0.7));
    g.poly([-r * 0.12, -r * 0.8, 0, -r * 1.65, r * 0.12, -r * 0.8]).fill(0x5a9a3a).stroke(ol(w * 0.7));
    g.poly([r * 0.3, -r * 0.75, r * 0.55, -r * 1.45, r * 0.05, -r * 0.85]).fill(0x5a9a3a).stroke(ol(w * 0.7));
    g.poly([-r * 0.72, -r * 0.75, r * 0.72, -r * 0.75, 0, r * 1.2]).fill(0xf08a2a).stroke(ol(w));
    g.moveTo(-r * 0.38, r * 0.15).lineTo(-r * 0.12, r * 0.15).stroke(ol(w * 0.5));
    g.moveTo(r * 0.12, r * 0.42).lineTo(r * 0.3, r * 0.42).stroke(ol(w * 0.5));
    rotSpots(g, r, [[0.25, 0.0, 0.1]]);
    angryEyes(g, r, -r * 0.3);
  } else if (kind === 'broccoli') {
    vegFeet(g, r, 0x8aa86a);
    g.roundRect(-r * 0.32, 0, r * 0.64, r * 0.9, r * 0.22).fill(0xc6dc96).stroke(ol(w));
    g.circle(-r * 0.55, -r * 0.2, r * 0.48).fill(0x4f8a3c).stroke(ol(w));
    g.circle(r * 0.55, -r * 0.2, r * 0.48).fill(0x4f8a3c).stroke(ol(w));
    g.circle(0, -r * 0.55, r * 0.56).fill(0x5a9a44).stroke(ol(w));
    g.circle(0, -r * 0.05, r * 0.5).fill(0x4f8a3c);
    rotSpots(g, r, [[-0.6, -0.35, 0.14], [0.35, -0.8, 0.1]]);
    angryEyes(g, r, -r * 0.15);
  } else { // 보스: 썩은 왕양파
    vegFeet(g, r, 0x6a3a7a);
    g.poly([-r * 0.14, -r * 0.88, 0, -r * 1.55, r * 0.14, -r * 0.88]).fill(0x5a9a3a).stroke(ol(w * 0.7));
    g.ellipse(0, 0, r * 0.95, r).fill(0x9a5aaa).stroke(ol(w));
    g.moveTo(0, -r * 0.95).quadraticCurveTo(-r * 0.7, 0, 0, r * 0.98).stroke({ width: r * 0.05, color: 0xc08ad0 });
    g.moveTo(0, -r * 0.95).quadraticCurveTo(r * 0.7, 0, 0, r * 0.98).stroke({ width: r * 0.05, color: 0xc08ad0 });
    g.ellipse(-r * 0.45, -r * 0.45, r * 0.22, r * 0.14).fill({ color: 0xffffff, alpha: 0.3 });
    rotSpots(g, r, [[0.55, 0.4, 0.13], [-0.6, 0.25, 0.09]]);
    angryEyes(g, r, -r * 0.05);
    g.poly([-r * 0.45, -r * 0.82, -r * 0.32, -r * 1.3, -r * 0.1, -r * 1.02, 0, -r * 1.38, r * 0.1, -r * 1.02, r * 0.32, -r * 1.3, r * 0.45, -r * 0.82])
      .fill(0xffd34d).stroke(ol(w * 0.8));
    g.circle(0, -r * 1.0, r * 0.07).fill(0xff4d6d);
  }
}

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const fxEl = $('fx'), gridEl = $('grid');
const fmt = (n) => {
  if (n < 1000) return String(Math.floor(n));
  const u = ['K', 'M', 'B', 'T', 'aa', 'ab'];
  let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + u[i];
};

// 떠오르는 숫자: 안쪽 span이 뿅 커졌다 줄어들고(CSS), 바깥은 위로 떠오르며 옆으로 살짝 흩어진다
function popText(x, y, text, cls) {
  if (fxList.length > 70) { const old = fxList.shift(); old.el.remove(); }
  const el = document.createElement('div');
  el.className = 'dmg ' + (cls || '');
  const span = document.createElement('span');
  if (/</.test(text)) span.innerHTML = text; else span.textContent = text; // 다이아 그림 등 코드가 만든 HTML만 들어온다
  el.appendChild(span);
  el.style.transform = `translate(${x - cam.x}px, ${y - cam.y}px) translate(-50%, -50%)`; // left/top 대신 transform (다시 배치 계산 없이 이동 — 발열)
  fxEl.appendChild(el);
  const big = /crit|big/.test(cls || '');
  fxList.push({ el, x, y, life: big ? 1.0 : 0.85, vy: big ? -95 : -80, vx: (Math.random() - 0.5) * 50 });
}

// ---------- 손그림 효과: 뿅 커졌다 사라진다 (월드 좌표) ----------
const fxSprites = [];
let fxLayer = null;
function spawnFx(key, x, y, size, life) {
  if (!ART[key] || !fxLayer || fxSprites.length > 60) return; // 타격 불꽃이 매번 나와서 40 → 60
  const sp = artSprite(key, size, 0.5);
  sp.position.set(x, y);
  sp.rotation = (Math.random() - 0.5) * 0.6;
  fxLayer.addChild(sp);
  fxSprites.push({ sp, life, max: life, base: sp.scale.x });
}
function updateFx(dt) {
  for (let k = fxSprites.length - 1; k >= 0; k--) {
    const f = fxSprites[k];
    f.life -= dt;
    const p = 1 - f.life / f.max;
    f.sp.scale.set(f.base * (0.5 + 0.7 * Math.min(1, p * 3)));
    f.sp.alpha = Math.min(1, (f.life / f.max) * 2.2);
    if (f.life <= 0) { f.sp.destroy(); fxSprites.splice(k, 1); }
  }
}

// ---------- 코인 터지기: 튀어 오른 뒤 골드 표시로 빨려 들어간다 (화면 좌표) ----------
const coins = [];
let coinTex = null, gemTex = null, coinLayer = null, goldTarget = { x: 640, y: 70 }, gemTarget = { x: 640, y: 120 };
function makeCoinTexture() {
  const g = new PIXI.Graphics();
  g.circle(12, 12, 10).fill(0xffd34d).stroke({ width: 3, color: 0x3a2418 });
  g.circle(12, 12, 6).fill(0xf0b830);
  g.rect(10.5, 8, 3, 8).fill(0xffe9a0);
  g.circle(8.5, 8.5, 2.2).fill(0xffffff);
  return app.renderer.generateTexture({ target: g, resolution: 3 });
}
// sx, sy 는 필드 화면 좌표
function makeGemTexture() {
  const g = new PIXI.Graphics();
  g.poly([12, 2, 22, 10, 12, 24, 2, 10]).fill(0x5ad0ff).stroke({ width: 3, color: 0x3a2418, join: 'round' });
  g.poly([12, 2, 22, 10, 12, 10]).fill(0xa8ecff);
  g.poly([5, 9, 9, 5, 11, 8]).fill(0xffffff);
  return app.renderer.generateTexture({ target: g, resolution: 3 });
}
function gemBurst(sx, sy, n) { coinBurst(sx, sy, n, 'gem'); }
// ---------- 보상 받기 연출 (2026-10-23 사용자): 누른 자리(보상 카드·버튼)에서 코인·다이아가 퍼졌다가 위 골드/다이아 칸으로 날아감 ----------
// 메뉴·팝업 위로 보이게 화면 맨 위(body, fixed)에 그린다. 도착할 때마다 칸이 '통' 튀고 짤랑
let lastTap = null;
// 다이아 숫자 올라가는 연출 (2026-10-23 사용자): 320 → 340을 바로 바꾸지 않고 321, 322… 일의 자리부터 올라감. 코인은 단위가 커서 그대로
let gemShown = 0, gemCount = null;
function countGems() {
  if (gemCount) return;
  gemCount = setInterval(() => {
    const d = S.gems - gemShown;
    if (d === 0) { clearInterval(gemCount); gemCount = null; return; }
    gemShown += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) / 25)); // 차이가 크면 한 번에 여러 개(약 0.9초 안에 끝)
    if ((d > 0 && gemShown > S.gems) || (d < 0 && gemShown < S.gems)) gemShown = S.gems;
    setHTML($('gemLabel'), GEM + ' ' + fmt(gemShown));
  }, 35);
}
addEventListener('pointerdown', (e) => { lastTap = { x: e.clientX, y: e.clientY }; }, true);
function rewardFly(kind, n = 10) {
  const tgt = $(kind === 'gem' ? 'gemLabel' : 'goldLabel');
  if (!tgt) return;
  const tr = tgt.getBoundingClientRect(), sh = $('shell').getBoundingClientRect(), k = sh.width / 720;
  const from = lastTap || { x: sh.left + sh.width / 2, y: sh.top + sh.height / 2 };
  const tx = tr.left + 24 * k, ty = tr.top + tr.height / 2, size = 60 * k;
  n = Math.min(14, Math.max(4, n));
  // 날아가는 동안 그 칸만 딤(메뉴 판·팝업) 위로 올림 → 다 도착하면 0.4초 뒤 원래대로 (2026-10-23 사용자)
  tgt.classList.add('lift'); tgt._fly = (tgt._fly || 0) + n;
  if (kind === 'gem' && !gemCount) gemCount = -1; // 첫 다이아가 닿을 때까지 숫자를 예전 값으로 붙잡아 둠
  for (let i = 0; i < n; i++) {
    const el = document.createElement('img');
    el.src = `${IMG}${kind === 'gem' ? 'icon_gem' : 'icon_coin'}.webp`;
    el.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;z-index:9999;pointer-events:none;filter:drop-shadow(0 2px 0 #0006);`;
    document.body.appendChild(el);
    const a = Math.random() * Math.PI * 2, r = (40 + Math.random() * 50) * k;
    const bx = from.x + Math.cos(a) * r, by = from.y + Math.sin(a) * r;
    const mx = (bx + tx) / 2 + (Math.random() - 0.5) * 120 * k, my = Math.min(by, ty) - 60 * k;
    const delay = i * 45, dur = 620 + Math.random() * 160, h = size / 2;
    const anim = el.animate([
      { transform: `translate(${from.x - h}px, ${from.y - h}px) scale(.5)`, opacity: 0.6, easing: 'cubic-bezier(.2,.8,.3,1)' },
      { transform: `translate(${bx - h}px, ${by - h}px) scale(1.1)`, opacity: 1, offset: 0.3, easing: 'ease-in' },
      { transform: `translate(${mx - h}px, ${my - h}px) scale(.95)`, offset: 0.65, easing: 'ease-in' },
      { transform: `translate(${tx - h}px, ${ty - h}px) scale(.6)`, opacity: 1 },
    ], { duration: dur, delay, fill: 'both' }); // 터지듯 빠르게 퍼졌다가(0.3) 위 칸으로 빨려 들어감
    anim.onfinish = () => {
      el.remove();
      tgt.classList.remove('pulse'); void tgt.offsetWidth; tgt.classList.add('pulse');
      Sound.play('coinTick');
      if (kind === 'gem' && gemCount === -1) { gemCount = null; countGems(); }
      if (--tgt._fly <= 0) setTimeout(() => { if (!tgt._fly) tgt.classList.remove('lift'); }, 400);
    };
  }
}
// 화면에 동시에 떠 있는 코인 상한 (연출용 — 많아도 스프라이트라 가볍다)
const COIN_MAX = 240;
function coinBurst(sx, sy, n, kind = 'gold') {
  if (!coinTex) return;
  for (let i = 0; i < n && coins.length < COIN_MAX; i++) {
    const sp = new PIXI.Sprite(kind === 'gem' ? gemTex : coinTex);
    sp.anchor.set(0.5);
    const bs = 24 / sp.texture.height; // 그림 크기와 상관없이 24px 기준
    sp.position.set(sx, sy);
    coinLayer.addChild(sp);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 260 + Math.random() * 260;
    coins.push({ bs, kind, sp, x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, burst: 0.35 + Math.random() * 0.25, fly: 0, sx: 0, sy: 0 });
  }
}
function updateCoins(dt) {
  for (let k = coins.length - 1; k >= 0; k--) {
    const c = coins[k];
    c.t += dt;
    if (c.t < c.burst) {
      // 튀어 오르기: 중력 + 공기 저항
      c.vy += 1500 * dt; c.vx *= 1 - 2 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      c.sp.scale.set(c.bs * (1.5 + 0.2 * Math.sin(c.t * 30)));
      c.sx = c.x; c.sy = c.y;
    } else {
      // 골드 표시로 가속하며 빨려 들어가기
      c.fly = Math.min(1, c.fly + dt * 2.6);
      const e = c.fly * c.fly;
      const tg = c.kind === 'gem' ? gemTarget : goldTarget;
      c.x = c.sx + (tg.x - c.sx) * e;
      c.y = c.sy + (tg.y - c.sy) * e - Math.sin(c.fly * Math.PI) * 60;
      c.sp.scale.set(c.bs * (1.5 - 0.7 * c.fly));
      if (c.fly >= 1) {
        c.sp.destroy(); coins.splice(k, 1);
        Sound.play('coinTick');
        const gl = $(c.kind === 'gem' ? 'gemLabel' : 'goldLabel'); gl.classList.remove('pulse'); void gl.offsetWidth; gl.classList.add('pulse');
        continue;
      }
    }
    c.sp.position.set(c.x, c.y);
    c.sp.rotation += dt * 6;
  }
}

let bannerT = 0;
function banner(html, t = 1.4, cls = '') {
  $('banner').innerHTML = html;
  $('banner').className = cls; // 'plain' = 알약 바탕 없이 글자만 (웨이브 안내)
  $('banner').classList.add('show');
  bannerT = t;
}

// 장착 도구 (2026-10-22 사용자): 도구함에서 레벨 높은 3개만 공격에 쓴다(자동). 아래 칸에는 그대로 두고 '장착' 표시만
const EQUIP_N = 3;
function equippedIdx() {
  return S.grid.map((L, i) => [L, i]).filter(([L]) => L).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, EQUIP_N).map(([, i]) => i);
}
function renderEquip() {
  const eq = equippedIdx();
  $('equip').innerHTML = Array.from({ length: EQUIP_N }, (_, k) => {
    const i = eq[k], L = i === undefined ? 0 : S.grid[i];
    if (!L) return `<div class="eq-card empty"></div>`;
    return `<div class="eq-card" style="--c:${gunColor(L)}"><b class="eq-name">Lv ${L}<br>${toolName(L)}</b><img class="eq-img" src="${toolImg(L)}" alt="">
      <span class="eq-row"><img class="ic" src="${IMG}icon_atk.webp" alt=""><i>${fmt(gunDmg(L) * atkMul())}</i></span>
      <span class="eq-row"><img class="ic" src="${IMG}icon_timer.webp" alt=""><i>${fireInterval().toFixed(2)}${t('mates.iv', { iv: '' }).trim()}</i></span></div>`;
  }).join('');
  // 이름이 칸보다 길면(영어 'Lv 5 Salt Shaker' 등) 글자를 줄여 맞춤 — 최소 16px (2026-10-23 사용자: 영어판 글자 잘림)
  document.querySelectorAll('#equip .eq-name').forEach((el) => {
    if (!el.clientWidth) return;
    for (let fs = 28; fs >= 16 && el.scrollWidth > el.clientWidth + 1; fs -= 2) el.style.setProperty('font-size', fs - 2 + 'px', 'important');
  });
}
function renderGrid(popIdx = -1) {
  renderEquip();
  const eq = new Set(equippedIdx());
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateRows = `repeat(${S.grid.length / 4}, 1fr)`;
  S.grid.forEach((L, i) => {
    const s = document.createElement('div');
    s.className = 'slot';
    s.dataset.i = i;
    if (L) {
      const g = document.createElement('div');
      g.className = 'gun' + (i === popIdx ? ' pop' : '') + (eq.has(i) ? ' eq' : '');
      if (i === popIdx) { const fx = document.createElement('img'); fx.className = 'mergefx'; fx.src = IMG + 'fx_merge.webp'; s.appendChild(fx); }
      g.style.background = gunColor(L);
      // 칸에는 그림 + 'Lv N'만 (2026-10-22 사용자 시안). 이름·공격력은 위 장착 카드에서
      g.innerHTML = `<span class="ico"><img src="${toolImg(L)}" alt="${toolIcon(L)}"></span><span class="glv">Lv ${L}</span>${eq.has(i) ? `<i class="eq-tag">${t('tools.equipped')}</i>` : ''}`;
      s.appendChild(g);
    }
    gridEl.appendChild(s);
  });
}

function dps() {
  const tools = equippedIdx().reduce((a, i) => a + gunDmg(S.grid[i]), 0) * atkMul() / fireInterval(); // 장착 3개만
  return MATES.reduce((a, m) => a + (mateLv(m) ? mateDmg(m) / m.iv : 0), tools);
}

// ---------- 동료·스킨 목록 (한 번 만들고 값만 갱신) ----------
function buildMenus() {
  $('mateList').innerHTML = MATES.map((m) => `
    <div class="row" data-mate="${m.id}">
      <span class="big"><img src="${IMG}mate_${m.id}.webp" alt="${m.icon}"></span>
      <div class="info"><b>${m.name}<small class="lvtag"></small></b><span class="desc">${m.desc}</span><span class="stat"></span></div>
      <button class="act"></button>
    </div>${BAL.mateRole?.[m.id] ? `<div class="role-up hidden" data-role="${m.id}"><div class="ru-ttl"></div><div class="ru-eff"></div><button class="ru-btn"></button></div>` : ''}`).join('');
  // 스킨 (총고식 4열 격자): 칸에는 그림만, 잠긴 건 어둡게 + 자물쇠, 장착 중은 노랑 칸 + 체크. 누르면 구매·장착 창
  $('skinList').innerHTML = SKINS.map((k) => {
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    return `
    <button class="skin" data-skin="${k.id}" aria-label="${k.name}">
      ${AVAIL.has(SKIN_ART[k.id]) ? `<img class="thumb" data-art="${SKIN_ART[k.id]}" src="${IMG}${SKIN_ART[k.id]}.webp" alt="">` : skinThumb[k.id] ? `<img class="thumb" src="${skinThumb[k.id]}" alt="">` : `<div class="mini hat-${k.hat} ${k.eyepatch ? 'eyepatch' : ''} ${k.beard ? 'beard' : ''}" style="--fur:${hex(BEAR.fur)};--face:${hex(BEAR.face)};--muz:${hex(BEAR.muzzle)};--hat:${hex(k.hatColor || 0xffffff)};--outfit:${hex(k.coat || k.apron)};--neck:${hex(k.neckColor || k.coat || 0)}">
        <i class="body"></i><i class="ear l"></i><i class="ear r"></i><i class="head"></i><i class="eye l"></i><i class="eye r"></i><i class="muz"></i><i class="beard"></i><i class="nose"></i><i class="hat"></i><i class="pom"></i>
      </div>`}
      <img class="lock" src="${IMG}icon_lock.webp" alt="">
      <span class="skin-tag"></span><i class="dot"></i>
    </button>`;
  }).join('');
  document.querySelectorAll('#skinList .thumb[data-art]').forEach(alignThumb);
  $('mateList').onclick = (e) => {
    // 역할 강화 (다이아)
    const ru = e.target.closest('.ru-btn') && e.target.closest('.role-up');
    if (ru) {
      const id = ru.dataset.role, lv = roleLv(id), c = BAL.roleUp.cost[lv];
      if (lv >= roleMax() || S.gems < c || !mateLv(MATES.find((x) => x.id === id))) return;
      S.gems -= c; S.roleUp = S.roleUp || {}; S.roleUp[id] = lv + 1;
      const m = MATES.find((x) => x.id === id);
      Sound.play('buy'); banner(t('roleup.done', { name: m.name, role: t('role.' + roleStat(id).role), n: lv + 1 }), 1.4);
      ru.classList.remove('pop'); void ru.offsetWidth; ru.classList.add('pop');
      syncMates(); updateUI(); save();
      return;
    }
    const row = e.target.closest('.act') && e.target.closest('.row');
    if (!row) return;
    const m = MATES.find((x) => x.id === row.dataset.mate), c = mateCost(m);
    if (S.gold < c) return;
    S.gold -= c; S.mates[m.id] = mateLv(m) + 1;
    Sound.play('buy'); mission('mate');
    if (S.mates[m.id] === 1) banner(t('mates.joined', { icon: m.icon, name: m.name }), 1.2);
    syncMates(); updateUI();
  };
  $('skinList').onclick = (e) => {
    const card = e.target.closest('.skin');
    if (card) openSkin(skinById(card.dataset.skin));
  };
}
// 스킨 하나 창: 그림·이름·효과 + 구매(골드·다이아·러시 기록) / 장착 / 장착 중
const rankSkin = (k) => (S.skin === k.id ? 0 : S.skins.includes(k.id) ? 1 : 2);
// 스킨 칸 곰 위치 맞추기: 그림마다 발 맨 아래 높이가 조금씩 달라서, 맨 아래를 재서 칸의 같은 높이에 둔다(가로는 고정)
const footCache = {};
function alignThumb(img) {
  const k = img.dataset.art;
  const apply = (f) => { img.style.transform = `translate(${-f.cx * 100}%, ${f.gap * 100}%)`; };
  if (footCache[k]) return apply(footCache[k]);
  const run = () => {
    const W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H).data;
    let bottom = 0; for (let y = H - 1; y >= 0 && !bottom; y--) for (let X = 0; X < W; X += 2) if (d[(y * W + X) * 4 + 3] > 60) { bottom = y; break; }
    let sx = 0, n = 0; for (let y = Math.floor(bottom - H * 0.15); y <= bottom; y += 2) for (let X = 0; X < W; X += 2) if (d[(y * W + X) * 4 + 3] > 60) { sx += X; n++; }
    // 가로는 모든 스킨 그림이 같은 캔버스·같은 자리에 곰이 있어 고정값(기본 셰프 발 가운데 0.55)으로 — 발 무게중심으로 맞추면 망토·주머니 같은 옷 때문에 오히려 치우쳤다
    footCache[k] = { cx: 0.55, gap: (H - 1 - bottom) / H };
    apply(footCache[k]);
  };
  if (img.complete && img.naturalWidth) run(); else img.addEventListener('load', run, { once: true });
}
function skinCanGet(k) { return k.req ? (S.rushBest || 0) >= k.req : k.gem ? S.gems >= k.gem : S.gold >= k.cost; }
function openSkin(k) {
  const own = S.skins.includes(k.id), on = S.skin === k.id, can = skinCanGet(k);
  const price = k.req ? t('skin.req_rush', { n: k.req, best: S.rushBest || 0 }) : k.gem ? `${GEM} ${k.gem}` : `${COIN} ${fmt(k.cost)}`;
  const btn = on ? t('skin.equipped') : own ? t('skin.equip') : k.req ? (can ? t('skin.claim') : t('skin.locked')) : can ? t('skin.buy') : t('skin.poor');
  const art = AVAIL.has(SKIN_ART[k.id]) ? IMG + SKIN_ART[k.id] + '.webp' : skinThumb[k.id] || IMG + 'hero_chef.webp';
  const card = AVAIL.has('ui_skin_card'); // 14차 스킨 전용 카드 그림(2026-10-22): 위 창에 캐릭터, 가운데 이름판, 아래 효과·가격
  showModal(card ? `<div class="skcard">
      <div class="sk-win"><img class="sk-hero" src="${art}" alt="">${own ? `<span class="sk-tag">${on ? t('skin.equipped') : t('skin.owned_tag')}</span>` : ''}</div><!-- 창 배경은 CSS 빛살 (카드 배경 그림은 안 씀) · 왼쪽 위 '보유 중/장착 중' 꼬리표 (2026-10-23 사용자 시안) -->
      <div class="sk-name">${k.name}</div>
      <div class="sk-info"><div class="sk-eff">${skinEffText(k)}</div>${own ? `<p class="sk-note">${t('skin.card_note')}</p>` : `<div class="skin-price">${price}</div>`}</div>
    </div>` : `<div class="title small">${k.name}</div>
    <img class="skin-big" src="${art}" alt=""><!-- 원본 그림(작은 썸네일 150px 대신) -->
    <div class="skin-eff">${skinEffText(k)}</div>
    ${own ? `<p class="sub">${t('skin.owned_note')}</p>` : `<div class="skin-price">${price}</div>`}`,
    btn, () => {
      if (on || (!own && !can)) return;
      if (!own) {
        if (k.gem) S.gems -= k.gem; else if (!k.req) S.gold -= k.cost;
        S.skins.push(k.id);
        Sound.play('claim');
      }
      S.skin = k.id;
      drawHero(hero, k);
      renderGrid(); updateUI(); save();
    }, null, { xClose: true, variant: card ? 'skincard' : '' });
  $('modalBtn').disabled = on || (!own && !can);
}

function updateMenus() {
  let mateReady = false, skinReady = false;
  document.querySelectorAll('#mateList .row').forEach((row) => {
    const m = MATES.find((x) => x.id === row.dataset.mate), lv = mateLv(m), c = mateCost(m);
    // 능력치는 알약 3개(공격력·공격 간격·체력), 다음 레벨에서 오르는 공격력은 공격력 알약 안 초록 글씨 (2026-10-21 사용자)
    const L1 = lv || 1, gain = mateDmg(m, L1 + (lv ? 1 : 0)) - (lv ? mateDmg(m) : 0);
    setHTML(row.querySelector('.stat'), `<i class="pill">${icon('icon_atk', '⚔')} ${fmt(mateDmg(m, L1))}${lv ? `<b class="gain">+${fmt(gain)}</b>` : ''}</i><i class="pill">${icon('icon_timer')} ${t('mates.iv', { iv: m.iv })}</i><i class="pill">${icon('icon_heart')} ${fmt(mateMaxHp(m, L1))}</i>`);
    setText(row.querySelector('.lvtag'), lv ? `Lv ${lv}` : '');
    // 역할 동료는 이름 옆에 색 알약 (2026-10-22 사용자)
    const rl = mateRole(m);
    if (rl && !row.querySelector('.role')) row.querySelector('.big').insertAdjacentHTML('beforeend', `<i class="role ${rl.role}">${t('role.' + rl.role)}</i>`); // 역할 알약은 그림 아래에 (2026-10-23 사용자: 이름 옆에선 줄이 넘어감)
    const b = row.querySelector('.act');
    setHTML(b, `${lv ? t('mates.upgrade_to', { lvl: `Lv ${lv + 1}` + (LANG === 'ko' ? roKo(lv + 1) : '') }) : t('mates.hire')}<span class="cost">${COIN} ${fmt(c)}</span>`); // 'Lv 9로 강화', 오르는 공격력은 공격력 알약 안 초록 글씨 (2026-10-21 사용자 A안)
    b.disabled = S.gold < c;
    row.classList.toggle('locked', !lv);
    // 역할 강화 띠: 고용한 뒤에만 보임 (2026-10-22 사용자)
    const ru = row.nextElementSibling;
    if (ru && ru.classList.contains('role-up')) {
      ru.classList.toggle('hidden', !lv);
      row.classList.toggle('has-ru', !!lv);
      if (lv) {
        const id = m.id, rlv = roleLv(id), max = rlv >= roleMax(), cur = roleStat(id, rlv), nxt = roleStat(id, Math.min(rlv + 1, roleMax()));
        const n1 = (v) => +v.toFixed(2), vals = cur.role === 'tank' ? { a: n1(cur.hp), b: n1(nxt.hp), c: cur.taunt, d: nxt.taunt }
          : cur.role === 'heal' ? { a: Math.round(cur.pct * 100), b: Math.round(nxt.pct * 100) } : { a: n1(cur.spd), b: n1(nxt.spd), c: n1(cur.dur), d: n1(nxt.dur) };
        setHTML(ru.querySelector('.ru-ttl'), `${t('roleup.title', { role: t('role.' + cur.role) })}<span class="pips">${Array.from({ length: roleMax() }, (_, i) => `<i class="${i < rlv ? 'on' : ''}"></i>`).join('')}</span>`);
        setHTML(ru.querySelector('.ru-eff'), t(`roleup.${cur.role}${max ? '_max' : ''}`, vals));
        const rb = ru.querySelector('.ru-btn'), rc = BAL.roleUp.cost[rlv];
        setHTML(rb, max ? 'MAX' : `${t('roleup.btn', { lvl: `Lv ${rlv + 1}` + (LANG === 'ko' ? roKo(rlv + 1) : '') })}<span class="cost">${GEM} ${rc}</span>`);
        rb.disabled = max || S.gems < rc;
      }
    }
    if (S.gold >= c) mateReady = true; // 고용·강화 둘 다 살 수 있으면 동료 메뉴에 빨간 점 (2026-10-21)
  });
  // 순서: 장착 중 → 가진 것 → 잠긴 것 (각각은 SKINS 순서). 바뀔 때만 다시 줄 세운다 (2026-10-21)
  const order = [...SKINS].sort((a, b) => rankSkin(a) - rankSkin(b) || SKINS.indexOf(a) - SKINS.indexOf(b)).map((k) => k.id).join();
  if ($('skinList').dataset.order !== order) {
    $('skinList').dataset.order = order;
    order.split(',').forEach((id) => $('skinList').appendChild($('skinList').querySelector(`[data-skin="${id}"]`)));
  }
  document.querySelectorAll('#skinList .skin').forEach((card) => {
    const k = skinById(card.dataset.skin), own = S.skins.includes(k.id);
    card.classList.toggle('on', S.skin === k.id);
    card.classList.toggle('locked', !own);
    // 잠긴 스킨: 아래에 가격표, 지금 살 수 있으면 밝게 + 초록 가격표 + 빨간 점 (2026-10-21)
    const can = !own && skinCanGet(k);
    card.classList.toggle('can', can);
    setHTML(card.querySelector('.skin-tag'), own ? '' : k.req ? `${icon('icon_rush')} ${k.req}` : k.gem ? `${GEM} ${fmt(k.gem)}` : `${COIN} ${fmt(k.cost)}`);
    if (!own && !k.gem && skinCanGet(k)) skinReady = true;
  });
  const pct = (t) => `+${Math.round(skinEff(t) * 100)}%`;
  setText($('sumAtk'), pct('atk')); setText($('sumSpd'), pct('spd')); setText($('sumGold'), pct('gold'));
  return { mateReady, skinReady, missionReady: updateMissions(), prestigeReady: updatePrestige() };
}

// 화면 글자·그림 쓰기: 값이 바뀔 때만 쓴다 (0.15초마다 다시 쓰면 매번 다시 그려 발열 — 2026-10-21 최적화)
function setHTML(el, h) { if (el._h !== h) { el._h = h; el.innerHTML = h; } }
function setText(el, v) { v = String(v); if (el._t !== v) { el._t = v; el.textContent = v; } }
function updateUI() {
  const bossOn = wave.bossSpawned && enemies.some((e) => e.boss);
  const wall = isWallStage(S.stage);
  if (chal) {
    setText($('stageLabel'), chal.horde ? t('horde.label') : t('chal.label', { n: chal.ci + 1 }) + ` · Lv ${chal.lv}`);
    setText($('chapterLabel'), CHAPTERS[chal.ci].name);
    $('bossTimer').classList.add('on', 'rush');
    if (chal.horde) setHTML($('bossTimer'), t('horde.pill', { sec: TIMER + ' ' + t('hud.seconds', { n: Math.ceil(chal.t) }), n: chal.kills, coin: COIN, gold: fmt(chal.gold) }));
    else setHTML($('bossTimer'), t('chal.pill', { sec: TIMER + ' ' + t('hud.seconds', { n: Math.ceil(chal.t) }), n: chal.kills, total: CHAL_N }));
  } else if (rush) {
    setText($('stageLabel'), t('rush.label'));
    setText($('chapterLabel'), t('place.arena'));
    $('bossTimer').classList.add('on', 'rush');
    setHTML($('bossTimer'), t('rush.pill', { sec: TIMER + ' ' + t('hud.seconds', { n: Math.ceil(rush.t) }), n: rush.kills, gem: GEM, gems: rush.gems }));
  } else {
    $('bossTimer').classList.remove('rush');
    setText($('stageLabel'), `Stage ${S.stage}-${wave.idx + 1}`);
    const ch = chapterOf(S.stage);
    setHTML($('chapterLabel'), `${AVAIL.has('icon_chapter_' + ch.id) ? icon('icon_chapter_' + ch.id) : ''} ${ch.name}`);
    $('bossTimer').classList.toggle('on', bossOn);
    if (bossOn) setText($('bossTimer'), (wall ? t('hud.king_timer', { boss: wallBossName(S.stage), sec: Math.ceil(bossT) }) : t('hud.boss_timer', { sec: Math.ceil(bossT) })));
  }
  // 일반 보스전의 남은 시간은 보스 체력 바 안에 (빨간 알약은 보스 러시·도전 때만 보인다 — 2026-10-21 위쪽 표시 정리)
  setHTML($('bossTime'), !rush && !chal && bossOn ? `${TIMER}<span>${Math.ceil(bossT)}</span>` : ''); // 초시계 그림 + 숫자
  // 스테이지 명판: 보스가 나왔거나 강한 보스 스테이지·보스 러시면 보스 명판(ui_stage_plate_boss)
  $('stageLabel').style.visibility = rush || (chal && chal.horde) ? 'hidden' : ''; // 보스 러시·대군 모드는 위 알약에 이미 나와서 이름 글자 숨김 (2026-10-22 사용자)
  $('stageLabel').classList.toggle('boss', !!(rush || wall || bossOn) && !chal);
  if (!gemCount) gemShown = S.gems; // 다이아 받을 때는 숫자를 하나씩 올려 보여줌(gemCount 동안)
  setHTML($('gemLabel'), GEM + ' ' + fmt(gemShown)); // + 버튼은 결제로 오해할 수 있어 뺐다 (2026-10-21 사용자 결정)
  const boostLeft = (S.boostUntil - Date.now()) / 1000;
  $('boostPill').classList.toggle('on', boostLeft > 0);
  if (boostLeft > 0) setText($('boostPill'), t('hud.boost', { time: `${Math.floor(boostLeft / 60)}:${String(Math.floor(boostLeft % 60)).padStart(2, '0')}` }));
  const mr = $('gemLabel').getBoundingClientRect(), fr0 = $('field').getBoundingClientRect();
  gemTarget = { x: (mr.left - fr0.left + 26 * scale) / scale, y: (mr.top - fr0.top + mr.height / 2) / scale };
  setHTML($('goldLabel'), COIN + ' ' + fmt(S.gold));
  const gr = $('goldLabel').getBoundingClientRect(), fr = $('field').getBoundingClientRect();
  goldTarget = { x: (gr.left - fr.left + 26 * scale) / scale, y: (gr.top - fr.top + gr.height / 2) / scale };
  // 스테이지 전체 진행도: 끝난 웨이브 + 현재 웨이브 진행 (마지막 웨이브는 보스 체력을 깎은 만큼)
  const boss = enemies.find((e) => e.boss);
  const cur = isFinalWave() ? (boss ? 1 - Math.max(0, boss.hp) / boss.max : 0) : Math.min(1, wave.kills / waveSize(wave.idx));
  const pct = Math.min(1, (wave.idx + cur) / wave.total);
  // 보스 러시 중에는 맨 위 바가 남은 시간을 보여주고 웨이브 트랙은 숨긴다
  // 평소엔 챕터 진행(대왕까지 10스테이지 중 몇 번째, 2026-10-22 사용자) — 아래 점 진행(웨이브)과 역할을 나눈다
  const timed = rush || chal, chN = (S.stage - 1) % 10 + 1;
  const topV = rush ? Math.min(1, rush.t / RUSH_TIME) : chal ? chal.t / CHAL_TIME : (chN - 1 + pct) / 10;
  $('topFill').style.width = topV * 100 + '%';
  setText($('topPct'), timed ? t('hud.seconds', { n: Math.ceil(timed.t) }) : t('hud.chapter_prog', { name: chapterOf(S.stage).name, n: chN, total: 10 }));
  $('track').style.visibility = timed ? 'hidden' : '';
  // 트랙 (총고식, 2026-10-21): 첫 점 = 줄 맨 왼쪽(웨이브 1), 마지막 점 = 보스. 셰프는 지금 웨이브 점에서 다음 점으로 나아간다
  const W = $('track').clientWidth - 44, at = (f) => 22 + f * W;
  const trackP = Math.min(1, (wave.idx + (isFinalWave() ? 0 : cur)) / Math.max(1, wave.total - 1));
  $('trackFill').style.width = trackP * 100 + '%';
  const key = `${S.stage}:${wave.idx}:${wave.total}`;
  if ($('trackNodes').dataset.key !== key) {
    $('trackNodes').dataset.key = key;
    $('trackNodes').innerHTML = Array.from({ length: wave.total }, (_, i) => {
      const last = i === wave.total - 1;
      return `<i class="${i <= wave.idx ? 'done' : ''} ${last ? 'boss' + (wall ? ' wall' : '') : ''}" style="left:${at(i / Math.max(1, wave.total - 1))}px">${last ? `<img src="${IMG}icon_boss.webp" alt="">` : ''}</i>`;
    }).join('');
  }
  $('trackHero').style.left = at(trackP) + 'px';
  const thumb = skinThumb[S.skin];
  // 진행 줄 셰프: 테두리 없는 머리 그림(ui_hero_head, 7차)이 있으면 그것, 없으면 스킨 썸네일을 동그라미에
  const headArt = AVAIL.has('ui_hero_head');
  $('trackHero').classList.toggle('head', headArt);
  if (headArt && $('trackHeroImg').dataset.skin !== 'head') { $('trackHeroImg').src = `${IMG}ui_hero_head.webp`; $('trackHeroImg').dataset.skin = 'head'; }
  else if (!headArt && thumb && $('trackHeroImg').dataset.skin !== S.skin) { $('trackHeroImg').src = thumb; $('trackHeroImg').dataset.skin = S.skin; }
  const buy = $('btnBuy');
  // 업그레이드 카드: 바탕 게이지 = 모은 골드 ÷ 가격 (가득 차면 살 수 있음). 저장하지 않고 매번 계산한다 (ux:ui-state)
  const card = (el, lv, val, cost, max) => {
    setText(el.querySelector('.lv'), `Lv.${lv}`);
    setText(el.querySelector('.val'), val);
    setHTML(el.querySelector('.cost'), max ? 'MAX' : COIN + ' ' + fmt(cost));
    const f = max ? 1 : Math.min(1, S.gold / cost);
    // 게이지는 카드 폭 전체로 그리고 오른쪽을 잘라 줄인다 (3분할 그림 ui_up_gauge의 둥근 끝이 겹치지 않게)
    el.querySelector('.gauge i').style.clipPath = `inset(0 ${((1 - f) * 100).toFixed(1)}% 0 0 round 0 12px 12px 0)`;
    el.classList.toggle('poor', !max && S.gold < cost);
    el.classList.toggle('full', !max && S.gold >= cost);
    el.disabled = max || S.gold < cost;
  };
  card($('btnAtk'), S.atkLv, `x${(1 + BAL.atkStep * S.atkLv).toFixed(2)}`, costAtk(), false);
  card($('btnSpd'), S.spdLv, `x${spdMul().toFixed(2)}`, costSpd(), spdMul() >= BAL.spdMax);
  card($('btnGold'), S.goldLv, `x${goldMul().toFixed(2)}`, costGold(), false);
  $('btnSaver').classList.toggle('on', !!S.settings.saver);
  $('btnSaver').style.display = rush || chal ? 'none' : ''; // 보스 러시·대군·스테이지 도전 중에는 절전모드 버튼을 뺀다 (2026-10-22 사용자)
  $('btnChalSpd').style.display = chal && !chal.horde ? '' : 'none'; // 그 자리에 스테이지 도전 배속 버튼
  setText($('btnChalSpd'), `x${S.chalSpd || 1}`);
  // 절전모드: 가려진 전장은 그리지 않는다(전투 계산은 그대로), 가운데 셰프는 지금 스킨으로
  if (world) world.visible = !S.settings.saver;
  if (S.settings.saver && $('saverChef').dataset.skin !== S.skin) { $('saverChef').dataset.skin = S.skin; $('saverChef').src = skinThumb[S.skin] || `${IMG}hero_chef.webp`; }
  const full = !S.grid.includes(0);
  setHTML(buy.querySelector('.cost'), full ? t('tools.full') : COIN + ' ' + fmt(costBuy()));
  buy.disabled = full || S.gold < costBuy();
  // 배지: 도구를 살 수 있거나 합성할 쌍이 있을 때, 새 동료를 고용하거나 새 스킨을 살 수 있을 때
  const lv = S.grid.filter((L) => L);
  const toolReady = !buy.disabled || lv.some((L, i) => lv.indexOf(L) !== i);
  const { mateReady, skinReady, missionReady, prestigeReady } = updateMenus();
  // 알림 점: 메뉴 안 탭과 양옆 기능 버튼에 같이 표시
  const { shopReady, rushReady } = updateShopRush();
  const ready = { tools: toolReady, mates: mateReady, skins: skinReady, missions: missionReady, prestige: prestigeReady, shop: shopReady, rush: rushReady };
  document.querySelectorAll('[data-tab]:not([data-tab="base"])').forEach((el) => el.classList.toggle('ready', !!ready[el.dataset.tab]));
}

function showTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === 'pane-' + name));
}
document.querySelector('.tabs').onclick = (e) => { const t = e.target.closest('.tab'); if (t) showTab(t.dataset.tab); };

// 오프닝 영상 (2026-10-22): 처음 시작할 때 한 번 — 22초, 소리 없음(음소거 자동 재생이 웹뷰에서도 됨). 건너뛰기 가능, 끝나면 done()
// 자막 [시작초, 끝초, 문구 키] — 장면에 맞춰 잡음 (2026-10-22)
const PROLOGUE_SUBS = [[0.3, 2.5, 'video.sub1'], [2.5, 4, 'video.sub2'], [4, 6, 'video.sub3'], [6, 9.5, 'video.sub4'], [9.5, 11.8, 'video.sub5'], [11.8, 13.5, 'video.sub6'], [13.5, 16.5, 'video.sub7']]; // 2번부터 장면 바뀌는 순간에 맞춰 크게 당김 (2026-10-22 사용자) · 마지막 '주방 대전쟁, 시작!'은 뺌
// 첫 실행: 화면을 한 번 눌러야 휴대폰이 소리를 허락한다 → '화면을 눌러 시작' 후 영상
function tapToStart(go) {
  const el = $('tapStart');
  // 첫 화면 로고: 한국어 로고가 오면 'ui_title_logo'(없으면 영어 로고) (2026-10-22 사용자)
  el.querySelector('img').src = `${IMG}${LANG === 'ko' && AVAIL.has('ui_title_logo') ? 'ui_title_logo' : 'ui_title_logo_en'}.webp`;
  el.classList.remove('hidden'); paused = true;
  const msg = el.querySelector('p');
  msg.textContent = t('video.loading'); el.classList.add('loading'); el.onclick = null;
  loadPrologue().then(() => { // 다 받으면 눌러서 시작 (누르는 순간 재생해야 폰이 소리를 허락)
    msg.textContent = t('video.tap'); el.classList.remove('loading');
    el.onclick = () => { el.classList.add('hidden'); el.onclick = null; Sound.unlock(); go(); };
  });
}
// 효과음 [초, 소리] — 장면 바뀌는 순간 (sound.js pr*)
const PROLOGUE_SFX = [[0.3, 'prDay'], [2.5, 'prNight'], [4, 'prSmoke'], [6, 'prKing'], [9.5, 'prMess'], [11.8, 'prShock'], [13.5, 'prPan'], [17.5, 'prCharge'], [19.8, 'prBubbles']];
// 영상·소리는 통째로 받아 둔 뒤(blob) 재생 — 폰 웹뷰는 파일을 끊어 읽기(range)를 못 해서 바로 재생하면 실패했음 (2026-10-22 실기)
let prologueReady = null;
// 실기 진단(치트 켜진 빌드만): 영상 준비·재생 과정을 기록해 실패하면 화면에 보여 준다 (2026-10-22)
const prologueLog = [];
const plog = (m) => { prologueLog.push(`${(performance.now() / 1000).toFixed(1)}s ${m}`); console.log('[prologue]', m); };
function showPrologueLog(why) {
  if (typeof CHEAT_ON === 'undefined' || !CHEAT_ON) return false;
  const v = $('prologue').querySelector('video');
  plog(`실패: ${why} / readyState ${v.readyState} / networkState ${v.networkState} / error ${v.error ? v.error.code + ' ' + (v.error.message || '') : '-'}`);
  showModal(`<div class="title small">영상 진단</div><p style="text-align:left;font-size:20px;word-break:break-all">${prologueLog.map((x) => x.replace(/</g, '&lt;')).join('<br>')}</p>`, t('common.ok'), () => {});
  return true;
}
// PlayForge 앱은 HTMLMediaElement.play를 감싸서, 다른 앱 소리 등으로 '오디오 멈춤' 상태면 play를 AbortError로 막는다
// ("Playforge audio lifecycle discarded playback"). 오프닝 영상은 소리 없는(muted) 영상이라 막을 이유가 없으므로
// 숨긴 iframe의 원래 play로 틀고, 'play' 이벤트에서 다시 멈추는 감시도 이 영상만 건너뛰게 한다. 소리(mp3)는 그대로 규칙을 따름 (2026-10-22)
let rawPlayFrame = null;
function playMutedVideo(v) {
  const lc = window.__playforgeAudioLifecycle;
  const why = lc && lc.reasons ? lc.reasons() : [];
  plog(`PlayForge 오디오 멈춤 이유: ${why.length ? why.join(',') : '없음'}`);
  if (!why.length) return v.play();
  try {
    if (!rawPlayFrame) {
      rawPlayFrame = document.createElement('iframe'); rawPlayFrame.style.display = 'none'; document.body.appendChild(rawPlayFrame);
      window.addEventListener('play', (e) => { if (e.target === v && v.muted) e.stopImmediatePropagation(); }, true);
    }
    const raw = rawPlayFrame.contentWindow.HTMLMediaElement.prototype.play;
    plog(`우회 play (native ${/\[native code\]/.test(Function.prototype.toString.call(raw))})`);
    return raw.call(v);
  } catch (e) { plog(`우회 실패 ${e}`); return v.play(); }
}
// 영상이 끝나면 받아 둔 영상·소리(약 12MB)를 바로 풀어 준다 — 폰 웹뷰 메모리 부족으로 화면이 다시 시작되는 것 방지 (2026-10-22)
function freePrologue() {
  const v = $('prologue').querySelector('video'), au = $('prologueAudio');
  for (const el of [v, au]) { const u = el.src; if (!u) continue; el.removeAttribute('src'); el.load(); if (u.startsWith('blob:')) URL.revokeObjectURL(u); }
  prologueReady = null;
}
function loadPrologue() {
  if (prologueReady) return prologueReady;
  const v = $('prologue').querySelector('video'), au = $('prologueAudio');
  const blobUrl = (url) => fetch(url).then((r) => { plog(`fetch ${url} → ${r.status}`); if (!r.ok) throw new Error(url + ' ' + r.status); return r.blob(); })
    .then((b) => { plog(`blob ${url} ${(b.size / 1e6).toFixed(1)}MB type=${b.type || '?'}`); return URL.createObjectURL(b); });
  plog(`UA ${navigator.userAgent.slice(0, 90)}`);
  plog(`canPlay webm/vp9=${v.canPlayType('video/webm; codecs="vp9"') || 'no'} mp4=${v.canPlayType('video/mp4; codecs="avc1.42E01E"') || 'no'} page=${location.protocol}//${location.host}`);
  const vSrc = v.canPlayType('video/webm; codecs="vp9"') ? 'assets/video/prologue.webm' : 'assets/video/prologue.mp4';
  prologueReady = Promise.all([
    blobUrl(vSrc).catch((e) => { plog(`영상 받기 실패 ${e}`); return blobUrl('assets/video/prologue.mp4'); }).then((u) => { v.src = u; v.load(); plog('video src 설정'); }),
    blobUrl('assets/video/prologue.mp3').then((u) => { au.src = u; au.load(); }).catch(() => {}),
  ]).catch((e) => plog(`준비 실패 ${e}`));
  return prologueReady;
}
function playPrologue(done) {
  const wrap = $('prologue'), v = wrap.querySelector('video');
  paused = true;
  // 사운드: 받은 음원(prologue.mp3, 22초)을 영상과 함께 재생 — 있으면 코드 합성 효과음(PROLOGUE_SFX)은 안 씀 (2026-10-22)
  const au = $('prologueAudio'), useAudio = !!(au && au.src);
  let sfxI = useAudio ? PROLOGUE_SFX.length : 0;
  Sound.duckMusic(true);
  if (useAudio) { au.currentTime = 0; au.volume = 1; au.muted = !(S.settings.sfx || S.settings.music); const ap = au.play(); if (ap && ap.catch) ap.catch((e) => plog(`소리 막힘 ${e && e.name}`)); }
  const finish = () => { v.pause(); if (useAudio) au.pause(); setTimeout(freePrologue, 600); wrap.classList.add('hidden'); paused = false; Sound.duckMusic(false); v.onended = null; $('btnSkipVideo').onclick = null; done && done(); };
  wrap.classList.remove('hidden'); wrap.classList.remove('reveal');
  const sub = $('prologueSub');
  let auRetryAt = 0;
  // 자막·투명 전환은 매 프레임 확인 (timeupdate는 0.25초 간격이라 자막이 늦게 뜸)
  const tick = () => {
    if (wrap.classList.contains('hidden')) return;
    wrap.classList.toggle('reveal', v.currentTime >= 19.8); // 20초부터 거품이 올라가며 투명 → 뒤의 게임이 드러남
    const line = PROLOGUE_SUBS.find(([a, b]) => v.currentTime >= a && v.currentTime < b);
    setText(sub, line ? t(line[2]) : ''); sub.classList.toggle('on', !!line);
    if (useAudio && !au.paused && Math.abs(au.currentTime - v.currentTime) > 0.25) au.currentTime = v.currentTime; // 영상과 소리 맞춤
    // 첫 실행: 누르는 순간엔 다른 앱 음악 때문에 PlayForge가 소리를 막았다가, 게임이 소리를 넘겨받으면 풀린다 → 풀리면 그 자리부터 소리 재생 (2026-10-22 실기)
    if (useAudio && au.paused && !au.ended && !v.paused && !v.ended && performance.now() > auRetryAt) {
      auRetryAt = performance.now() + 500;
      const lc = window.__playforgeAudioLifecycle;
      if (!lc || !lc.reasons || !lc.reasons().length) { au.currentTime = v.currentTime; const rp = au.play(); if (rp && rp.catch) rp.catch(() => {}); plog(`소리 다시 시도 ${v.currentTime.toFixed(1)}s`); }
    }
    while (sfxI < PROLOGUE_SFX.length && v.currentTime >= PROLOGUE_SFX[sfxI][0]) Sound.play(PROLOGUE_SFX[sfxI++][1]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  v.currentTime = 0; v.onended = () => { plog(`ended at ${v.currentTime.toFixed(1)}s / dur ${v.duration}`); const early = v.currentTime < 5; finish(); if (early) showPrologueLog('영상이 바로 끝남'); };
  $('btnSkipVideo').onclick = finish;
  setTimeout(() => { if (!wrap.classList.contains('hidden') && v.currentTime < 0.5) { finish(); showPrologueLog('3초 지나도 재생 안 됨'); } }, 3000); // 멈춰 있으면 원인 표시
  v.muted = true;
  v.onerror = () => { plog('video error 이벤트'); };
  plog('play 호출');
  const p = playMutedVideo(v); if (p && p.then) p.then(() => plog('play 성공'));
  if (p && p.catch) p.catch((e) => { finish(); showPrologueLog(`play 거부 ${e && e.name}: ${e && e.message}`); }); // 그래도 막히면 다음으로 (치트 빌드는 원인 표시)
}
// 모달 — 타이틀·오프라인 보상·확인 창. 떠 있는 동안 게임을 멈춘다
// opt: { variant: 'orange', peek: 그림 주소(패널 위로 머리를 내민다), x: false(X 없음) | 'below'(패널 아래 가운데), xClose: X는 그냥 닫기 }
// X는 취소가 있으면 취소, 없으면 확인과 같다(보상 받기). btn이 없으면 확인 버튼을 숨긴다
function showModal(html, btn, onOk, cancelText, opt = {}) {
  paused = true;
  const box = $('modal').querySelector('.box');
  box.className = 'box' + (opt.variant ? ' ' + opt.variant : '') + (opt.peek ? ' has-peek' : '');
  $('modalBody').innerHTML = (opt.peek ? `<img class="peek" src="${opt.peek}" alt="">` : '') + html;
  $('modalBtn').textContent = btn || '';
  $('modalBtn').classList.toggle('hidden', !btn);
  $('modalBtn').disabled = false;
  $('modal').classList.remove('hidden');
  // 제목이 주황 알약보다 길면 글자를 줄여 맞춤 (2026-10-23 사용자: 영어 팝업 제목 넘침)
  box.querySelectorAll('.title, .chal-title').forEach((el) => { el.style.removeProperty('font-size'); let fs = parseFloat(getComputedStyle(el).fontSize); while (el.scrollWidth > el.clientWidth + 1 && fs > 18) { fs -= 2; el.style.setProperty('font-size', fs + 'px', 'important'); } });
  const close = () => { $('modal').classList.add('hidden'); paused = false; };
  const ok = () => { close(); Sound.unlock(); onOk && onOk(); };
  $('modalBtn').onclick = ok;
  $('modalCancel').classList.toggle('hidden', !cancelText);
  $('modalCancel').textContent = cancelText || '';
  $('modalCancel').onclick = close;
  $('modalX').classList.toggle('hidden', opt.x === false);
  $('modalX').classList.toggle('below', opt.x === 'below');
  $('modalX').onclick = cancelText || opt.xClose ? close : ok;
}
// 자리 비운 동안의 보상 (처음 켤 때와 앱을 다시 올렸을 때). 보상을 띄웠으면 true
// 총고식: 번 골드로 업그레이드 3종을 알아서 사고, 그 전투력으로 스테이지를 올린다(최고 기록까지만). 남은 골드는 지갑으로
const OFFLINE_EFF = 0.75; // 실제 DPS 효율 (tools/sim.js 와 같은 값)
function planOffline(sec) {
  const keep = { atkLv: S.atkLv, spdLv: S.spdLv, goldLv: S.goldLv, stage: S.stage };
  let gold = Math.floor(offlineGoldPerSec() * sec);
  // 1) 업그레이드: 셋 중 가장 싼 것부터 산다 (공격속도는 상한까지)
  for (let guard = 0; guard < 2000; guard++) {
    const opts = [['atkLv', costAtk()], ['goldLv', costGold()]];
    if (spdMul() < BAL.spdMax) opts.push(['spdLv', costSpd()]);
    opts.sort((x, y) => x[1] - y[1]);
    if (opts[0][1] > gold) break;
    gold -= opts[0][1]; S[opts[0][0]]++;
  }
  // 2) 스테이지: 웨이브 적 + 보스를 잡는 시간을 그 시점 DPS로 계산. 보스를 제한시간 안에 못 잡으면 멈춘다
  const cap = Math.max(S.stage, S.bestStage || S.stage);
  let t = sec;
  while (S.stage < cap) {
    const st = S.stage, D = dps() * OFFLINE_EFF, hp = enemyHp(st), wall = isWallStage(st);
    let n = 0; for (let i = 0; i < waveCount(st); i++) n += waveSize(i);
    const bossHp = hp * BAL.bossHp * (wall ? WALL_HP : 1);
    if (bossHp / D > (wall ? WALL_TIME : BOSS_TIME)) break;
    const need = Math.max(n * hp / D, n * SPAWN_GAP) + waveCount(st) * (WAVE_BREAK + 3) + bossHp / D;
    if (need > t) break;
    t -= need; S.stage++;
  }
  const after = { atkLv: S.atkLv, spdLv: S.spdLv, goldLv: S.goldLv, stage: S.stage };
  Object.assign(S, keep); // 미리 보기만 — 받을 때 적용한다
  return { before: keep, after, gold, max: after.stage >= cap && cap > keep.stage };
}
function offerOffline(away) {
  if (away < 60) return false;
  const sec = Math.min(away, offlineCap());
  if (offlineGoldPerSec() * sec <= 0) return false;
  const plan = planOffline(sec);
  const take = () => {
    const moved = plan.after.stage !== S.stage;
    Object.assign(S, plan.after);
    S.gold += plan.gold;
    if (moved) { clearField(); resetWave(); syncChapter(false); }
    if (plan.gold > 0) { popText(P.x, P.y - 130, '+' + fmt(plan.gold), 'gold big'); rewardFly('gold', 14); }
    renderGrid(); updateUI(); save();
    banner(`STAGE ${S.stage}`, 1.4, 'under');
  };
  // 다른 창이 떠 있으면 창을 덮지 않고 바로 받는다
  if (!$('modal').classList.contains('hidden')) { take(); return true; }
  const lvRow = (ic, k) => `<div class="off-lv"><img src="${IMG}${ic}.webp" alt=""><span>Lv.${plan.before[k]}</span></div>`;
  const lvRowA = (ic, k) => `<div class="off-lv${plan.after[k] > plan.before[k] ? ' grew' : ''}"><img src="${IMG}${ic}.webp" alt=""><span>Lv.${plan.after[k]}</span></div>`;
  const art = SKIN_ART[S.skin];
  showModal(`<div class="title small">${t('offline.title')}</div>
    <div class="off-time">${fmtTime(sec)}</div>
    <div class="off-grid">
      <div class="off-col"><b class="off-st">Stage ${plan.before.stage}</b>${lvRow('icon_atk', 'atkLv')}${lvRow('icon_spd', 'spdLv')}${lvRow('icon_gold_up', 'goldLv')}</div>
      <div class="off-arrow">→</div>
      <div class="off-col"><b class="off-st">Stage ${plan.after.stage}${plan.max ? '<i class="off-max">Max!</i>' : ''}</b>${lvRowA('icon_atk', 'atkLv')}${lvRowA('icon_spd', 'spdLv')}${lvRowA('icon_gold_up', 'goldLv')}</div>
    </div>
    ${plan.gold > 0 ? `<div class="off-gold">${t('offline.gold_left', { coin: COIN, n: fmt(plan.gold) })}</div>` : ''}
    <p class="off-note">${t('offline.note')}${away > offlineCap() ? `<br>${t('offline.cap', { h: offlineCap() / 3600 })}` : ''}</p>`,
    null, take, null, { variant: 'orange', x: 'below', peek: AVAIL.has('illust_offline_peek') ? `${IMG}illust_offline_peek.webp` : art && ART[art] ? `${IMG}${art}.webp` : (skinThumb[S.skin] || `${IMG}hero_chef.webp`) });
  return true;
}

// ---------- 안드로이드 뒤로가기 (사내 기준 ux:screen-flow '뒤로가기로 맨 위 창 닫기') ----------
// 이력에 한 칸(가드)을 쌓아 두고, 뒤로가기가 오면 맨 위 창 하나를 닫은 뒤 가드를 다시 쌓는다.
// 열린 창이 없으면 "한 번 더 누르면 종료" 안내 → 2초 안에 또 누르면 가드가 없으니 앱이 닫힌다.
// PC에서는 Esc가 같은 동작을 한다.
let backArmed = false, exitT = 0;
function armBack() { if (!backArmed) { history.pushState({ kw: 1 }, ''); backArmed = true; } }
function closeTopLayer() {
  if (!$('modal').classList.contains('hidden')) {
    // X가 있으면 X(취소 또는 받기), 없으면(타이틀) 확인 버튼과 같다
    ($('modalX').classList.contains('hidden') ? $('modalBtn') : $('modalX')).click();
    return true;
  }
  if (!$('settings').classList.contains('hidden')) { closeSettings(); return true; }
  if (!$('sheet').classList.contains('closed')) { closeSheet(); return true; }
  if (typeof baseOpen !== 'undefined' && baseOpen) { closeBase(); return true; }
  return false;
}
addEventListener('popstate', () => {
  backArmed = false;
  if (closeTopLayer()) { armBack(); return; }
  // 열린 창이 없다: 2초 안에 한 번 더 누르면 종료 (가드를 다시 쌓지 않는다)
  save();
  banner(`<small>${t('system.back_exit')}</small>`, 1.8);
  clearTimeout(exitT);
  exitT = setTimeout(armBack, 2000);
});
// 터치 없이 쌓은 이력은 브라우저가 뒤로가기에서 건너뛴다 → 첫 터치 때 쌓고, 빠져 있으면 다음 터치에서 다시 쌓는다
addEventListener('pointerdown', armBack);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTopLayer(); });

function offlineGoldPerSec() {
  const killsPerSec = Math.min(dps() / enemyHp(S.stage), 1 / (SPAWN_GAP + 0.2));
  return killsPerSec * enemyGold(S.stage) * goldAll() * OFFLINE_RATE;
}
const fmtTime = (sec) => sec >= 3600 ? t('time.hm', { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60) }) : t('time.m', { m: Math.max(1, Math.floor(sec / 60)) });

// ---------- 화면 흔들림·진동 ----------
let shakeAmp = 0;
function shake(a) { if (S.settings.shake) shakeAmp = Math.max(shakeAmp, a); }
function buzz(ms) {
  // 브라우저는 사용자가 한 번이라도 터치한 뒤에만 진동을 허락한다
  if (!S.settings.vibrate || !navigator.vibrate || (navigator.userActivation && !navigator.userActivation.hasBeenActive)) return;
  try { navigator.vibrate(ms); } catch (e) { /* 미지원 */ }
}

// ---------- 일일 미션 ----------
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function ensureDaily() {
  const key = todayKey();
  if (S.daily && S.daily.date === key) return;
  // 날짜로 섞어서 매일 다른 3개를 고른다
  let h = 7; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = MISSIONS.map((m) => m.id), ids = [];
  while (ids.length < 3) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; ids.push(pool.splice(h % pool.length, 1)[0]); }
  S.daily = { date: key, ids, prog: {}, claimed: {}, bonus: false };
  buildMissions();
}
function mission(id, n = 1) {
  if (!S.daily || !S.daily.ids.includes(id)) return;
  S.daily.prog[id] = (S.daily.prog[id] || 0) + n;
}
const missionGold = () => Math.max(100, Math.round(offlineGoldPerSec() / OFFLINE_RATE * 240)); // 접속 중 약 4분치 수입
function buildMissions() {
  if (!S.daily) return;
  $('missionList').innerHTML = S.daily.ids.map((id) => {
    const m = MISSIONS.find((x) => x.id === id);
    return `<div class="row mission" data-mid="${id}">
      <span class="big"><img src="${IMG}icon_clipboard.webp" alt="📋"></span>
      <div class="info"><b>${m.text}</b><span class="stat"></span><div class="bar2"><i></i></div></div>
      <button class="act"></button>
    </div>`;
  }).join('');
}
$('missionList').onclick = (e) => {
  const row = e.target.closest('.act') && e.target.closest('.mission');
  if (!row) return;
  const id = row.dataset.mid, m = MISSIONS.find((x) => x.id === id);
  if (S.daily.claimed[id] || (S.daily.prog[id] || 0) < m.n) return;
  const g = missionGold();
  S.daily.claimed[id] = true; S.gold += g; S.gems += 5;
  rewardFly('gold', 10); rewardFly('gem', 5); Sound.play('claim');
  updateUI(); save();
};
$('btnBonus').onclick = () => {
  if (!S.daily || S.daily.bonus || !S.daily.ids.every((id) => S.daily.claimed[id])) return;
  S.daily.bonus = true; S.stars += 1; S.gems += 20;
  rewardFly('gem', 10);
  banner(`${t('mission.star_banner')}<small>${t('common.star_use')}</small>`, 2);
  Sound.play('prestige'); renderGrid(); updateUI(); save();
};
function updateMissions() {
  ensureDaily();
  let ready = false;
  document.querySelectorAll('#missionList .mission').forEach((row) => {
    const id = row.dataset.mid, m = MISSIONS.find((x) => x.id === id);
    const p = Math.min(m.n, Math.floor(S.daily.prog[id] || 0)), done = p >= m.n, got = !!S.daily.claimed[id];
    setText(row.querySelector('.stat'), id === 'time' ? t('mission.minutes', { n: Math.floor(p / 60), total: m.n / 60 }) : `${p} / ${m.n}`);
    row.querySelector('.bar2 i').style.width = (p / m.n) * 100 + '%';
    const b = row.querySelector('.act');
    setHTML(b, got ? t('mission.claimed') : done ? `${t('mission.claim')}<span class="cost">${COIN} ${fmt(missionGold())} · ${GEM} 5</span>` : t('mission.progress'));
    b.disabled = got || !done;
    b.classList.toggle('claimed', got);
    row.classList.toggle('done', got);
    if (done && !got) ready = true;
  });
  const all = S.daily.ids.every((id) => S.daily.claimed[id]);
  const bb = $('btnBonus');
  setHTML(bb, S.daily.bonus ? t('mission.claimed') : `${t('mission.claim')}<span class="cost">${STAR} 1 · ${GEM} 20</span>`);
  bb.disabled = S.daily.bonus || !all;
  bb.classList.toggle('claimed', S.daily.bonus);
  if (all && !S.daily.bonus) ready = true;
  // 자정까지 남은 시간
  const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const left = Math.max(0, (mid - now) / 1000);
  setText($('missionHint'), t('mission.reset', { h: Math.floor(left / 3600), m: Math.floor((left % 3600) / 60) }));
  if (updateStageRw()) ready = true;
  updateAttend();
  if (attendReady()) ready = true;
  return ready;
}

// ---------- 스테이지 보상 (2026-10-22 사용자: 미션 창 위 시즌패스 모양 트랙) ----------
// 챕터마다 3·6·10번째 스테이지를 처음 깨면 한 번: 3 = 골드 묶음(그 스테이지 적 골드 × 300), 6 = 다이아 20, 10(대왕) = 다이아 50. 환생해도 다시 안 줌
const STAGE_RW = [];
for (let c = 0; c < 5; c++) for (const k of [3, 6, 10]) STAGE_RW.push({ st: c * 10 + k, gold: k === 3, gems: k === 6 ? 20 : k === 10 ? 50 : 0 });
const stageRwGold = (st) => enemyGold(st) * 300;
const stageRwCleared = (st) => (S.bestStage || S.stage) > st;
const stageRwReady = (r) => stageRwCleared(r.st) && !(S.stageRw || {})[r.st];
let stageRwSig = '';
function updateStageRw() {
  const track = document.querySelector('#stageRw .sr-track');
  if (!track.querySelector('.sr-node')) {
    track.insertAdjacentHTML('beforeend', STAGE_RW.map((r) => `<div class="sr-node" data-st="${r.st}"><button class="sr-card">${r.gold ? `<img src="${IMG}icon_coin.webp" alt=""><b>${fmt(stageRwGold(r.st))}</b>` : `<img src="${IMG}icon_gem.webp" alt=""><b>${r.gems}</b>`}</button><i class="sr-num">${r.st}</i></div>`).join(''));
    track.onclick = (e) => { const n = e.target.closest('.sr-node'); if (n) claimStageRw(+n.dataset.st); };
  }
  const sig = STAGE_RW.map((r) => (stageRwReady(r) ? 'r' : (S.stageRw || {})[r.st] ? 'g' : stageRwCleared(r.st) ? 'c' : 'l')).join('');
  if (sig !== stageRwSig) {
    stageRwSig = track.offsetParent ? sig : ''; // 창이 닫혀 있으면 칸 위치를 못 재므로 다음에 다시 그림 (진행 선이 0으로 남던 문제)
    let lastDone = -1;
    track.querySelectorAll('.sr-node').forEach((n, i) => {
      const r = STAGE_RW[i], got = !!(S.stageRw || {})[r.st];
      n.classList.toggle('ready', stageRwReady(r)); n.classList.toggle('got', got); n.classList.toggle('locked', !stageRwCleared(r.st));
      if (stageRwCleared(r.st)) lastDone = i;
    });
    // 진행 선: 깬 마지막 칸까지 + 다음 칸 쪽으로 진행도만큼
    const nodes = track.querySelectorAll('.sr-node'), best = S.bestStage || S.stage;
    const nx = nodes[lastDone + 1], prevSt = lastDone >= 0 ? STAGE_RW[lastDone].st : 0;
    const part = nx ? Math.max(0, Math.min(1, (best - 1 - prevSt) / (STAGE_RW[lastDone + 1].st - prevSt))) : 0;
    const x0 = lastDone >= 0 ? nodes[lastDone].offsetLeft + nodes[lastDone].offsetWidth / 2 : 0;
    const x1 = nx ? nx.offsetLeft + nx.offsetWidth / 2 : x0;
    track.querySelector('.sr-fill').style.width = nx ? `${x0 + (x1 - x0) * part}px` : '100%'; // 마지막 칸까지 깼으면 선 끝까지 (2026-10-22 사용자)
    // 받을 칸(없으면 다음 칸)이 보이게 스크롤
    const focus = [...nodes].find((n) => n.classList.contains('ready')) || nx || nodes[nodes.length - 1];
    const sc = track.parentNode, prev = focus && focus.previousElementSibling; if (focus) sc.scrollLeft = Math.max(0, (prev && prev.classList.contains('sr-node') ? prev : focus).offsetLeft - 16); // 받을 칸 앞 칸을 왼쪽 끝에
  }
  return STAGE_RW.some(stageRwReady);
}
function claimStageRw(st) {
  const r = STAGE_RW.find((x) => x.st === st);
  if (!r || !stageRwReady(r)) return;
  S.stageRw = S.stageRw || {}; S.stageRw[st] = true;
  if (r.gold) { S.gold += stageRwGold(st); rewardFly('gold', 12); }
  else { S.gems += r.gems; rewardFly('gem', 10); }
  banner(t('srw.got', { n: st }), 1.4); Sound.play('claim');
  stageRwSig = ''; updateUI(); save();
}

// ---------- 7일 출석 (2026-10-22 사용자: 단순 출석판, 7일 다 받으면 1일차부터 다시) ----------
const ATTEND = [{ gems: 30 }, { gems: 50 }, { boost: 30 }, { gold: true }, { gems: 80 }, { gems: 100 }, { skin: 'hanbok', alt: 400 }];
const attendReady = () => (S.attend || {}).last !== todayKey();
const attendGold = () => Math.max(200, Math.floor((offlineGoldPerSec() / OFFLINE_RATE) * 600)); // 지금 수입 10분치
const attendIcon = (a) => (a.skin && !S.skins.includes(a.skin) ? `${SKIN_ART[a.skin] && AVAIL.has(SKIN_ART[a.skin]) ? SKIN_ART[a.skin] : 'icon_gem'}` : a.boost ? 'icon_boost' : a.gold ? 'icon_coin' : 'icon_gem');
const attendLabel = (a) => (a.skin ? (S.skins.includes(a.skin) ? `${a.alt}` : t('attend.skin', { name: skinById(a.skin).name })) : a.boost ? t('attend.boost', { n: a.boost }) : a.gold ? t('attend.gold') : `${a.gems}`);
function claimAttend() {
  if (!attendReady()) return;
  const idx = S.attend.n % 7, a = ATTEND[idx];
  S.attend.n++; S.attend.last = todayKey();
  if (a.gems) { S.gems += a.gems; rewardFly('gem', 10); }
  if (a.boost) S.boostUntil = Math.max(Date.now(), S.boostUntil) + a.boost * 60 * 1000;
  if (a.gold) { S.gold += attendGold(); rewardFly('gold', 12); }
  if (a.skin) { if (S.skins.includes(a.skin)) { S.gems += a.alt; rewardFly('gem', 12); } else S.skins.push(a.skin); }
  banner(t('attend.got', { n: idx + 1 }), 1.6); Sound.play('prestige');
  renderGrid(); updateUI(); save();
}
// 보상 줄 가로 넘기기: 폰은 손가락으로 원래 됨. PC 마우스는 끌기·휠로도 넘기게 (2026-10-23 사용자)
document.querySelectorAll('#pane-missions .sr-scroll').forEach((sc) => {
  let down = null, moved = false;
  sc.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = { x: e.clientX, left: sc.scrollLeft }; moved = false; sc.style.scrollSnapType = 'none'; sc.style.scrollBehavior = 'auto'; });
  window.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - down.x; if (Math.abs(dx) > 5) moved = true; sc.scrollLeft = down.left - dx; });
  window.addEventListener('pointerup', () => { if (!down) return; down = null; sc.style.scrollSnapType = ''; sc.style.scrollBehavior = ''; });
  sc.addEventListener('click', (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true); // 끌고 난 뒤엔 칸 누름으로 치지 않음
  sc.addEventListener('wheel', (e) => { // 세로 휠은 줄 끝에 닿기 전까지만 가로로 (끝이면 창이 위아래로 넘어감)
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = sc.scrollWidth - sc.clientWidth, canGo = e.deltaY > 0 ? sc.scrollLeft < max - 1 : sc.scrollLeft > 1;
    if (canGo) { sc.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
});
// 미션 창 안 7칸 줄: 받은 날 ✓ · 오늘(받을 수 있으면 노란 빛, 누르면 받음) · 내일 점선 ('내일 오면' 예고는 사용자 요청으로 뺌)
let attendSig = '';
function updateAttend() {
  if (!S.attend) S.attend = { n: 0, last: '' };
  const ready = attendReady(), idx = S.attend.n % 7, today = ready ? idx : (idx + 6) % 7;
  const sig = `${ready}${S.attend.n}${S.skins.includes('hanbok')}${LANG}`;
  if (sig === attendSig) return;
  const track = document.querySelector('#attendBox .sr-track');
  attendSig = track.offsetParent ? sig : ''; // 창이 닫혀 있으면 위치를 못 재므로 열렸을 때 다시
  const st = (i) => ((ready ? i < idx : i <= today) ? 'got' : ready && i === idx ? 'ready' : i === (ready ? idx + 1 : today + 1) % 7 ? 'next locked' : 'locked');
  track.querySelectorAll('.sr-node').forEach((n) => n.remove());
  track.insertAdjacentHTML('beforeend', ATTEND.map((a, i) => `<div class="sr-node ${st(i)}${i === 6 ? ' big' : ''}" data-i="${i}"><button class="sr-card"><img src="${IMG}${attendIcon(a)}.webp" alt=""><b>${attendLabel(a)}</b></button><i class="sr-num">${t('attend.day', { n: i + 1 })}</i></div>`).join(''));
  // 진행 선: 오늘 받을 수 있으면 오늘 칸까지, 오늘 받았으면 다음 날 칸까지 반쯤 (2026-10-22 사용자)
  const nodes = track.querySelectorAll('.sr-node'), mid = (n) => n.offsetLeft + n.offsetWidth / 2;
  const un = nodes[ready ? idx : today], nx = !ready && today < 6 ? nodes[today + 1] : null;
  track.querySelector('.sr-fill').style.width = !un ? '0' : nx ? `${(mid(un) + mid(nx)) / 2}px` : !ready && today === 6 ? '100%' : `${mid(un)}px`; // 7일차까지 받았으면 끝까지
  // 오늘 칸(이미 받았으면 다음 칸)이 가운데 오게 넘김
  const focus = track.querySelector('.ready') || track.querySelector('.next'), sc = track.parentNode, prev = focus && focus.previousElementSibling;
  if (focus) sc.scrollLeft = Math.max(0, (prev && prev.classList.contains('sr-node') ? prev : focus).offsetLeft - 16); // 오늘 칸 앞 칸을 왼쪽 끝에
}
document.querySelector('#attendBox .sr-track').onclick = (e) => { const d = e.target.closest('.sr-node.ready'); if (d) { claimAttend(); attendSig = ''; updateAttend(); } };
// 하루 첫 접속이면 미션 창을 자동으로 열어 출석 칸을 보여 줌 — 첫 실행은 영상·튜토리얼이 끝난 뒤, 다른 창·도전 모드 중이 아닐 때
let attendShown = '';
setInterval(() => {
  if (!S || !attendReady() || attendShown === todayKey() || paused || !S.introSeen) return;
  if (typeof TUT_DONE !== 'undefined' && (S.tut || 0) < TUT_DONE) return;
  if (!$('modal').classList.contains('hidden') || !$('sheet').classList.contains('closed') || rush || chal || (typeof baseOpen !== 'undefined' && baseOpen)) return;
  attendShown = todayKey(); openSheet('missions'); $('pane-missions').scrollTop = 0;
}, 1500);

// ---------- 환생 (총고식) — 받은 셰프 별로 영구 강화 3종을 직접 산다 ----------
function buildPerm() {
  $('permList').innerHTML = PERM.map((p) => `
    <div class="perm" data-perm="${p.k}">
      <span class="perm-ico"><img src="${IMG}${p.icon}.webp" alt=""><i class="perm-lv"></i></span>
      <div class="info"><span>${p.name}</span><b class="perm-val"></b></div>
      <button class="perm-btn"><span>${t('perm.upgrade')}</span><i class="perm-cost"></i></button>
    </div>`).join('');
  $('permList').onclick = (e) => {
    const row = e.target.closest('.perm-btn') && e.target.closest('.perm');
    if (!row) return;
    const k = row.dataset.perm, c = permCost(k);
    if (permMax(k) || S.stars < c) return;
    S.stars -= c; S.perm[k] = permLv(k) + 1;
    Sound.play('claim'); buzz(15);
    renderGrid(); updateUI(); save();
  };
}
function updatePrestige() {
  const gain = starsFor(S.stage);
  $('starNow').textContent = fmt(S.stars);
  const b = $('btnPrestige');
  $('starGain').textContent = fmt(gain);
  $('starBonus').textContent = S.stage < PRESTIGE_MIN ? t('prestige.need', { min: PRESTIGE_MIN, now: S.stage }) : '';
  $('prCount').textContent = t('prestige.count', { n: S.prestiges || 0 }); // 곰 오른쪽, 0회도 표시 (2026-10-22 사용자)
  b.disabled = S.stage < PRESTIGE_MIN || gain < 1;
  let permReady = false;
  document.querySelectorAll('#permList .perm').forEach((row) => {
    const k = row.dataset.perm, c = permCost(k), max = permMax(k);
    row.querySelector('.perm-lv').textContent = `Lv.${permLv(k)}`;
    row.querySelector('.perm-val').textContent = `+${Math.round(BAL.perm[k].step * permLv(k) * 100)}%`;
    row.querySelector('.perm-cost').innerHTML = max ? 'MAX' : `${STAR} ${c}`;
    row.querySelector('.perm-btn').disabled = max || S.stars < c;
    if (!max && S.stars >= c) permReady = true;
  });
  // 별로 살 수 있는 강화가 있거나, 받을 별이 많으면 알림
  return permReady || (S.stage >= PRESTIGE_MIN && gain >= 3);
}
$('btnPrestige').onclick = () => {
  const gain = starsFor(S.stage);
  if (gain < 1) return;
  showModal(`<div class="title small">${t('prestige.title')}</div>
    <p>${t('prestige.confirm', { stage: S.stage, n: gain })}</p>
    <p class="sub">${t('prestige.confirm_sub')}</p>`,
    t('prestige.btn'), () => {
      S.stars += gain; S.prestiges++;
      S.stage = 1; S.gold = BAL.startGold; S.atkLv = 0; S.spdLv = 0; S.goldLv = 0; S.buys = 0;
      S.grid = [1, ...Array(gridSize() - 1).fill(0)];
      for (const id in S.mates) if (S.mates[id]) S.mates[id] = 1;
      clearField(); resetWave();
      syncChapter(false);
      heroHp = heroMax;
      for (const id in mateSprites) { const ms = mateSprites[id]; ms.stun = 0.01; ms.hp = 0; }
      closeSheet(); renderGrid(); updateUI(); save();
      banner(`${t('prestige.done', { n: gain })}<small>${t('common.star_use')}</small>`, 2.6);
      Sound.play('prestige'); shake(14); buzz(60);
    }, t('common.cancel'), { peek: `${IMG}illust_prestige_angel.webp` });
};

// ---------- ⚙️ 설정 ----------
const GAME_VERSION = 'v0.1';
// 업그레이드 카드 이름이 왼쪽 위 아이콘과 겹치면 글자를 2px씩 줄여 맞춤(가운데 정렬 유지) (2026-10-23 사용자: 카드 글자는 겹치면 안 됨)
function fitUpNames() {
  document.querySelectorAll('#panel .up').forEach((c) => {
    const n = c.querySelector('.name'), ic = c.querySelector('.uico');
    if (!n || !ic || !ic.getBoundingClientRect().width) return;
    n.style.removeProperty('font-size');
    const rg = document.createRange(); rg.selectNodeContents(n);
    let fs = parseFloat(getComputedStyle(n).fontSize);
    while (fs > 18 && rg.getBoundingClientRect().left < ic.getBoundingClientRect().right + 4) { fs -= 1; n.style.setProperty('font-size', fs + 'px', 'important'); }
  });
  // 세 카드 이름 크기는 같게 (가장 작아진 것에 맞춤)
  const names = [...document.querySelectorAll('#panel .up .name')], min = Math.min(...names.map((n) => parseFloat(getComputedStyle(n).fontSize)));
  names.forEach((n) => n.style.setProperty('font-size', min + 'px', 'important'));
}
function applySettings() {
  const st = S.settings;
  Sound.setSfx(st.sfx); Sound.setMusic(st.music);
  if (app) app.ticker.maxFPS = st.saver ? 30 : 60; // 절전 30fps, 평소에도 60fps까지만 (120Hz 폰에서 두 배로 그리지 않게 — 발열)
  $('saverScreen').classList.toggle('on', !!st.saver); // 절전: 전장을 가리는 화면 (그림은 updateUI에서)
  fit();                                          // 절전: 백버퍼 해상도 낮춤
  document.querySelectorAll('#settings .switch').forEach((b) => b.classList.toggle('on', !!st[b.dataset.key]));
}
function openSettings() { applySettings(); $('settings').classList.remove('hidden'); paused = true; }
function closeSettings() { $('settings').classList.add('hidden'); paused = false; }
$('btnSettings').onclick = openSettings;
// 스테이지 아래 절전모드 알약: 설정의 절전 모드와 같은 값
$('btnSaver').onclick = () => { S.settings.saver = !S.settings.saver; Sound.unlock(); applySettings(); save(); updateUI(); banner(`<small>${t(S.settings.saver ? 'hud.saver_on' : 'hud.saver_off')}</small>`, 1); };
$('btnSetClose').onclick = closeSettings;
$('settings').onclick = (e) => { if (e.target.id === 'settings') closeSettings(); };
document.querySelectorAll('#settings .switch').forEach((b) => {
  b.onclick = () => {
    const k = b.dataset.key;
    S.settings[k] = !S.settings[k];
    Sound.unlock(); applySettings(); save();
    if (k === 'sfx' && S.settings.sfx) Sound.play('buy');
    if (k === 'vibrate' && S.settings.vibrate) buzz(30);
  };
});
// 게임 초기화: 두 번 확인한 뒤 저장을 지우고 처음부터
$('btnReset').onclick = () => {
  closeSettings();
  showModal(`<div class="title small">${t('reset.title')}</div><p>${t('reset.body')}</p>`, t('reset.ok'), () => {
    showModal(`<div class="title small">${t('reset2.title')}</div><p>${t('reset2.body')}</p>`, t('reset2.ok'), () => {
      window.__resetting = true;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 저장소 없음 */ }
      location.reload();
    }, t('common.cancel'));
  }, t('common.cancel'));
};
// 브라우저 정책상 첫 터치에서 오디오를 깨운다
addEventListener('pointerdown', () => Sound.unlock(), true);

// ---------- 💎 다이아 상점 ----------
const SHOP = [
  { id: 'slots', icon: '🧰', art: 'icon_slots', name: t('shop.slots'), desc: t('shop.slots_desc'), price: 100,
    owned: () => S.shop.slots >= 2, label: () => `${S.shop.slots}/2`,
    buy: () => { S.shop.slots++; S.grid.push(0, 0, 0, 0); renderGrid(); } },
  { id: 'auto', icon: '🔄', art: 'icon_auto_merge', name: t('shop.automerge'), desc: t('shop.automerge_desc'), price: 150,
    owned: () => S.shop.autoMerge, buy: () => { S.shop.autoMerge = true; } },
  { id: 'boost', icon: '⏩', art: 'icon_boost', name: t('shop.boost'), desc: t('shop.boost_desc'), price: 20,
    owned: () => false, buy: () => { S.boostUntil = Math.max(Date.now(), S.boostUntil) + 10 * 60 * 1000; } },
  { id: 'offline', icon: '🌙', art: 'icon_offline', name: t('shop.offline'), desc: t('shop.offline_desc'), price: 80,
    owned: () => S.shop.offline12, buy: () => { S.shop.offline12 = true; } },
  { id: 'ninja', icon: '🥷', art: 'hero_ninja', name: t('shop.ninja'), desc: t('shop.ninja_desc'), price: 300,
    owned: () => S.skins.includes('ninja'),
    buy: () => { S.skins.push('ninja'); S.skin = 'ninja'; drawHero(hero, skinById('ninja')); } },
];
function buildShop() {
  $('shopList').innerHTML = SHOP.map((it) => `
    <div class="row" data-shop="${it.id}">
      <span class="big">${it.art ? `<img src="${IMG}${it.art}.webp" alt="${it.icon}">` : it.icon}</span>
      <div class="info"><b>${it.name} <small class="lbl"></small></b><span class="desc">${it.desc}</span></div>
      <button class="act gem"></button>
    </div>`).join('');
}
$('shopList').onclick = (e) => {
  const row = e.target.closest('.act') && e.target.closest('[data-shop]');
  if (!row) return;
  const it = SHOP.find((x) => x.id === row.dataset.shop);
  if (it.owned() || S.gems < it.price) return;
  S.gems -= it.price; it.buy();
  Sound.play('claim'); buzz(20);
  banner(`${it.name}!`, 1.2);
  renderGrid(); updateUI(); save();
};

// 자동 합성: 1.2초마다 가장 낮은 레벨의 같은 도구 한 쌍을 합친다
let autoT = 0;
function autoMergeTick(dt) {
  if (!S.shop.autoMerge || (autoT -= dt) > 0) return;
  autoT = 1.2;
  let best = -1, a = -1, b = -1;
  for (let i = 0; i < S.grid.length; i++) {
    if (!S.grid[i]) continue;
    for (let j = i + 1; j < S.grid.length; j++) {
      if (S.grid[j] === S.grid[i] && (best < 0 || S.grid[i] < best)) { best = S.grid[i]; a = i; b = j; }
    }
  }
  if (a < 0) return;
  S.grid[a]++; S.grid[b] = 0;
  mission('merge');
  Sound.play('buy');
  if (!$('sheet').classList.contains('closed')) renderGrid(a);
}

// ---------- ⚔️ 도전: 보스 러시 (하루 3번) ----------
const RUSH_TRIES = 3, RUSH_TIME = 60;
let rush = null;
const rushGemFor = (k) => 3 + 2 * (k - 1);           // k번째 보스: 3, 5, 7, 9 …
function rushToday() {
  const key = todayKey();
  if (!S.rush || S.rush.date !== key) S.rush = { date: key, used: 0 };
  return S.rush;
}
function startRush() {
  const r = rushToday();
  if (rush || chal || r.used >= RUSH_TRIES) return;
  r.used++;
  mission('rush');
  closeSheet();
  clearField();
  heroHp = heroMax;
  rush = { t: RUSH_TIME, kills: 0, gems: 0, next: 1.2 };
  syncChapter(false);
  banner(t('rush.start_banner'), 1.8);
  Sound.play('wall'); shake(10);
  save();
}
function spawnRushBoss() {
  spawnEnemy(true, true);
  const e = enemies[enemies.length - 1];
  // 지금 스테이지 강한 보스 기준, 잡을수록 1.4배씩 강해진다
  e.hp = e.max = Math.ceil(e.max * 0.4 * Math.pow(1.4, rush.kills)); // 첫 보스 ≈ 일반 보스의 1.4배
  e.gold = Math.ceil(e.gold * 0.5);
  // 러시는 시간 싸움이라 보스가 화면 안쪽 위에서 바로 나타난다
  e.x = cam.x + FW / 2 + (Math.random() - 0.5) * 300; e.y = cam.y + 260;
  e.c.position.set(e.x, e.y);
  e.c.scale.set(0.2); e.pop = 0.6; // 뿅 나타나는 연출
  drawBar(e);
  bossSay(BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)]);
}
function rushKill(e) {
  rush.kills++;
  const g = rushGemFor(rush.kills);
  rush.gems += g;
  popText(e.x, e.y - 70, `${GEM} +${g}`, 'crit');
  gemBurst(e.x - cam.x, e.y - cam.y, Math.min(10, 2 + rush.kills));
  rush.next = 0.8;
  rush.t += 3; // 잡을 때마다 3초 보너스
}
function endRush(reason) {
  const r = rush;
  rush = null;
  clearField(); resetWave();
  syncChapter(false);
  heroHp = heroMax;
  for (const id in mateSprites) { const ms = mateSprites[id]; ms.stun = 0.01; ms.hp = 0; }
  S.gems += r.gems;
  const best = r.kills > S.rushBest;
  if (best) S.rushBest = r.kills;
  save();
  showModal(`<div class="title small">${t('rush.end_title')}</div>
    <p>${reason}<br>${t('rush.end_kills', { n: r.kills })}</p>
    ${best ? `<div class="tag-best">${t('end.best')}</div>` : ''}
    <div class="reward">${GEM} ${r.gems}</div>
    <p class="sub">${t('end.tries_left', { n: RUSH_TRIES - rushToday().used, total: RUSH_TRIES })}</p>`, t('common.ok'), () => {
      Sound.play('clear');
      if (r.gems > 0) rewardFly('gem', 10);
      banner(`STAGE ${S.stage}`, 1.4, 'under');
    });
}
$('btnRush').onclick = startRush;

// ---------- ⚔️ 스테이지 도전 (총고식): 챕터마다 한 번, 1분 안에 그 챕터 적을 모두 처치하면 💎 ----------
const CHAL_TIME = 60, CHAL_N = 40, CHAL_GEMS = 30, CHAL_GAP = 0.35;
// 스테이지 도전 단계 (2026-10-23 사용자): 챕터마다 Lv 1, 2, 3… 계속 — 성공하면 다음 단계(적 체력 ×1.5씩). 실패는 몇 번이든 다시. 하루 횟수 제한 없음(단계마다 보상은 처음 한 번뿐이라)
const CHAL_HP_STEP = 1.5, CHAL_GEMS_NEXT = 10;
const chalCleared = (ci) => (S.chalLv && S.chalLv[ci]) || (S.chal[ci] ? 1 : 0); // 깬 단계 수 (예전 저장본: 깼으면 1)
const chalGems = (lv) => (lv === 1 ? CHAL_GEMS : CHAL_GEMS_NEXT);
const chalGold = (ci, lv) => Math.round(enemyGold((ci + 1) * 10) * CHAL_N * 4 * Math.pow(1.25, lv - 2)); // Lv 2 = 적 골드×160, 단계마다 ×1.25 (적 체력 ×1.5가 스테이지 약 1.75개 차이 → 골드도 그만큼, 2026-10-23)
let chal = null;
const chalOpen = (ci) => (typeof cheat !== 'undefined' && cheat.chalLockFrom != null && ci >= cheat.chalLockFrom ? false : (S.bestStage || S.stage) > (ci + 1) * 10); // 치트 '잠금 보기'는 저장을 안 바꾸고 화면만 잠금 // 그 챕터 강한 보스(10·20…)를 넘었으면 열린다
const chalArt = (ch, boss) => { const k = boss ? 'boss_' + ch.boss : 'enemy_' + ch.enemies[0]; return AVAIL.has(k) ? `${IMG}${k}.webp` : `${IMG}${boss ? 'boss_onion' : 'enemy_tomato'}.webp`; };
// 하루 횟수 초기화(자정)까지 남은 시간 'H:MM'
function untilMidnight() {
  const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), s = Math.max(0, Math.floor((mid - now) / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`; // 시:분 (초는 안 보임)
}
const CHAL_BG = { kitchen: '#2a1432', fridge: '#0f2238', pantry: '#2e2010', hall: '#3a1212', bakery: '#3a240e' }; // 배너 왼쪽 글자판 색 (그림 분위기에 맞춤)
function buildChal() {
  $('rushDesc').innerHTML = t('rush.desc', { gem: GEM }); // 다이아 그림이 들어가서 data-i18n 대신 여기서
  $('chalList').innerHTML = CHAPTERS.map((ch, ci) => `
    <div class="row chal bn" data-ci="${ci}" style="--art:url(${IMG}banner_ch_${ch.id}.webp);--bg:${CHAL_BG[ch.id] || '#2a1a10'}"><!-- 그림 배너 카드 (2026-10-23 사용자 시안) -->
      <span class="big"><img src="${chalArt(ch)}" alt=""></span>
      <div class="info"><b><span class="en">CHAPTER ${ci + 1}</span></b><span class="desc">${t('chal.row_desc', { n: CHAL_N })}</span><span class="reward"></span></div>
      <button class="act"></button>
    </div>`).join('');
  $('chalList').onclick = (e) => {
    const row = e.target.closest('.act') && e.target.closest('.chal');
    if (row) openChal(+row.dataset.ci);
  };
}
function openChal(ci) {
  if (!chalOpen(ci) || rush || chal) return;
  const ch = CHAPTERS[ci], lv = chalCleared(ci) + 1;
  showModal(`<div class="chal-title">CHAPTER ${ci + 1} · Lv ${lv}</div>
    <div class="chal-band">${t('chal.band', { place: ch.name, n: CHAL_N })}</div>
    <div class="chal-reward"><small>${t('chal.reward')}</small><div class="cr-items"><div class="cr-it"><span>${GEM}</span><b>${chalGems(lv)}</b></div>${lv > 1 ? `<div class="cr-it"><span>${COIN}</span><b>${fmt(chalGold(ci, lv))}</b></div>` : ''}</div></div>`, // 보상은 가로로 나란히 (2026-10-23 사용자)
    t('chal.confirm'), () => startChal(ci), null, { peek: chalArt(ch, true), xClose: true, variant: 'chal' });
}
$('btnChalSpd').onclick = () => { S.chalSpd = (S.chalSpd || 1) % 3 + 1; setText($('btnChalSpd'), `x${S.chalSpd}`); Sound.play('buy'); save(); }; // x1 → x2 → x3 → x1, 고른 배속은 기억
function startChal(ci) {
  if (rush || chal) return;
  closeSheet();
  clearField();
  heroHp = heroMax;
  chal = { ci, st: (ci + 1) * 10, lv: chalCleared(ci) + 1, t: CHAL_TIME, spawned: 0, kills: 0, spawnT: 0.4 };
  syncChapter(false);
  banner(t('chal.start_banner', { n: CHAL_N }), 1.8);
  Sound.play('wall'); shake(8);
}
function endChal(ok, reason) {
  if (chal.horde) { endHorde(reason); return; }
  const c = chal;
  chal = null;
  clearField(); resetWave();
  syncChapter(false);
  heroHp = heroMax;
  for (const id in mateSprites) { const ms = mateSprites[id]; ms.stun = 0.01; ms.hp = 0; }
  const first = ok; // 성공 = 늘 새 단계 첫 클리어
  const gems = chalGems(c.lv), gold = c.lv > 1 ? chalGold(c.ci, c.lv) : 0;
  if (ok) { S.chal[c.ci] = true; S.chalLv = S.chalLv || {}; S.chalLv[c.ci] = c.lv; S.gems += gems; S.gold += gold; }
  save();
  showModal(`<div class="title small">${ok ? t('chal.win') : t('chal.lose')}</div>
    <p>${ok ? t('chal.win_desc', { c: c.ci + 1, n: CHAL_N }) : `${reason}<br>${t('chal.lose_desc', { n: c.kills, total: CHAL_N })}`}</p>
    ${first ? `<div class="reward">${GEM} ${gems}${gold ? ` · ${COIN} ${fmt(gold)}` : ''}</div><p class="sub">${t('chal.next_lv', { lv: c.lv + 1 })}</p>` : `<p class="sub">${t('chal.retry')}</p>`}`, t('common.ok'), () => {
      Sound.play('clear');
      if (first) { rewardFly('gem', 10); if (gold) rewardFly('gold', 10); }
      banner(`STAGE ${S.stage}`, 1.4, 'under');
    }, null, { peek: chalArt(CHAPTERS[c.ci], true) });
}

// ---------- ⚔️ 대군 모드 (2026-10-21): 60초 동안 약한 적이 끝없이 몰려온다 — 잡은 만큼 골드. 스테이지 도전(chal) 위에 얹는다 ----------
const HORDE_TIME = 60, HORDE_TRIES = 3, HORDE_MAX = 60, HORDE_BURST = 6, HORDE_GAP = 0.4; // 2026-10-21 사용자: 더 많이 (동시 36→60, 한 번에 4→6마리, 0.5→0.4초마다)
const HORDE_HP = 0.35, HORDE_ATK = 0.5; // 적 체력 = 지금 스테이지 일반 적의 35% (대부분 한두 방), 공격력은 절반
function hordeToday() {
  const key = todayKey();
  if (!S.horde || S.horde.date !== key) S.horde = { date: key, used: 0 };
  return S.horde;
}
function startHorde() {
  const h = hordeToday();
  if (rush || chal || h.used >= HORDE_TRIES) return;
  h.used++;
  closeSheet();
  clearField();
  heroHp = heroMax;
  chal = { horde: true, ci: chapterIdx(S.stage), st: S.stage, t: HORDE_TIME, spawned: 0, kills: 0, spawnT: 0.4, gold: 0 };
  syncChapter(false);
  banner(t('horde.start_banner'), 1.8);
  Sound.play('wall'); shake(10);
  save();
}
function updateHorde(dt) {
  if ((chal.spawnT -= dt) > 0) return;
  chal.spawnT = HORDE_GAP;
  for (let k = 0; k < HORDE_BURST && enemies.length < HORDE_MAX; k++) {
    spawnEnemy(false);
    const e = enemies[enemies.length - 1];
    e.hp = e.max = Math.max(1, Math.ceil(e.max * HORDE_HP));
    chal.spawned++;
  }
}
function endHorde(reason) {
  const c = chal;
  chal = null;
  clearField(); resetWave();
  syncChapter(false);
  heroHp = heroMax;
  for (const id in mateSprites) { const ms = mateSprites[id]; ms.stun = 0.01; ms.hp = 0; }
  const best = c.kills > (S.hordeBest || 0);
  if (best) S.hordeBest = c.kills;
  save();
  showModal(`<div class="title small">${t('horde.end_title')}</div>
    <p>${reason}<br>${t('horde.end_kills', { n: c.kills })}</p>
    ${best ? `<div class="tag-best">${t('end.best')}</div>` : ''}
    <div class="reward">${COIN} ${fmt(c.gold)}</div>
    <p class="sub">${t('end.tries_left', { n: HORDE_TRIES - hordeToday().used, total: HORDE_TRIES })}</p>`, t('common.ok'), () => {
      Sound.play('clear');
      if (c.gold > 0) rewardFly('gold', 12);
      banner(`STAGE ${S.stage}`, 1.4, 'under');
    });
}
$('btnHorde').onclick = startHorde;

function updateShopRush() {
  let shopReady = false;
  document.querySelectorAll('#shopList [data-shop]').forEach((row) => {
    const it = SHOP.find((x) => x.id === row.dataset.shop), own = it.owned();
    setText(row.querySelector('.lbl'), it.label ? it.label() : '');
    const b = row.querySelector('.act');
    setHTML(b, own ? t('shop.owned') : `${t('shop.buy')}<span class="cost">${GEM} ${it.price}</span>`);
    b.disabled = own || S.gems < it.price;
    b.classList.toggle('claimed', own);
    if (!own && it.id !== 'boost' && S.gems >= it.price) shopReady = true;
  });
  setHTML($('shopHint'), `<span class="txt">${t('shop.hint')}</span><b class="own">${GEM} ${fmt(S.gems)}</b>`); // 보유 다이아는 오른쪽 알약 (2026-10-21)
  const r = rushToday(), left = RUSH_TRIES - r.used;
  setText($('rushTries'), left > 0 ? t('chal.tries', { n: left, total: RUSH_TRIES }) : t('chal.reset_in', { time: untilMidnight() })); // 다 쓰면 초기화까지 남은 시간 (2026-10-22 사용자)
  setText($('rushBest'), t('rush.best', { n: S.rushBest }));
  $('btnRush').disabled = left <= 0 || !!rush;
  setText($('btnRush'), rush ? t('chal.running') : left > 0 ? t('chal.start') : t('chal.tomorrow'));
  let chalReady = false;
  document.querySelectorAll('#chalList .chal').forEach((row) => {
    const ci = +row.dataset.ci, lv = chalCleared(ci) + 1, open = chalOpen(ci), b = row.querySelector('.act');
    setHTML(b, open ? t('chal.go_lv', { lv }) : t('chal.not_open'));
    // 잠긴 챕터: 카드 가운데 큰 자물쇠 + '스테이지 N 클리어 시 오픈' (2026-10-23 사용자 시안)
    let ov = row.querySelector('.lock-ov');
    if (!open && !ov) { row.insertAdjacentHTML('beforeend', `<div class="lock-ov"><img src="${IMG}icon_lock.webp" alt=""><span>${t('chal.lock_ov', { n: (ci + 1) * 10 })}</span></div>`); }
    else if (open && ov) ov.remove();
    setHTML(row.querySelector('.reward'), `${lv === 1 ? t('chal.first_reward') : t('chal.lv_reward', { lv })} ${GEM} ${chalGems(lv)}`);
    b.disabled = !open || !!rush || !!chal;
    row.classList.toggle('locked', !open);
    if (open && lv === 1) chalReady = true; // 빨간 점은 아직 한 번도 안 깬 챕터만
  });
  const hLeft = HORDE_TRIES - hordeToday().used, hImg = chalArt(chapterOf(S.stage));
  if ($('hordeImg').dataset.src !== hImg) { $('hordeImg').dataset.src = hImg; $('hordeImg').src = hImg; } // 지금 챕터 적 그림
  setText($('hordeTries'), hLeft > 0 ? t('chal.tries', { n: hLeft, total: HORDE_TRIES }) : t('chal.reset_in', { time: untilMidnight() }));
  setText($('hordeBest'), t('horde.best', { n: S.hordeBest || 0 }));
  $('btnHorde').disabled = hLeft <= 0 || !!rush || !!chal;
  setText($('btnHorde'), chal && chal.horde ? t('chal.running') : hLeft > 0 ? t('chal.start') : t('chal.tomorrow'));
  return { shopReady, rushReady: left > 0 || chalReady || hLeft > 0 };
}

function openSheet(tab) { if (tab) showTab(tab); if (tab && tab !== 'base' && typeof baseOpen !== 'undefined') baseOpen = false; renderGrid(); updateUI(); $('sheet').classList.remove('closed'); }
function closeSheet() { $('sheet').classList.add('closed'); if (typeof baseOpen !== 'undefined') baseOpen = false; }
// 양옆 기능 버튼: 누르면 해당 탭이 바로 열린다
document.querySelectorAll('.sbtn').forEach((b) => { b.onclick = () => openSheet(b.dataset.tab); });
$('btnClose').onclick = closeSheet;
document.querySelector('#sheet .dim').onclick = closeSheet;

$('btnAtk').onclick = () => { const c = costAtk(); if (S.gold >= c) { S.gold -= c; S.atkLv++; Sound.play('buy'); mission('upgrade'); renderGrid(); updateUI(); } };
$('btnGold').onclick = () => { const c = costGold(); if (S.gold >= c) { S.gold -= c; S.goldLv++; Sound.play('buy'); mission('upgrade'); updateUI(); } };
$('btnSpd').onclick = () => { const c = costSpd(); if (S.gold >= c && spdMul() < 3) { S.gold -= c; S.spdLv++; Sound.play('buy'); mission('upgrade'); updateUI(); } };
$('btnBuy').onclick = () => {
  const i = S.grid.indexOf(0), c = costBuy();
  if (i < 0 || S.gold < c) return;
  S.gold -= c; S.buys++; S.grid[i] = 1;
  Sound.play('buy');
  renderGrid(i); updateUI();
};

// ---------- 합성 드래그 ----------
let drag = null;
gridEl.addEventListener('pointerdown', (e) => {
  const slot = e.target.closest('.slot');
  if (!slot) return;
  const i = +slot.dataset.i;
  if (!S.grid[i]) return;
  e.preventDefault();
  const gun = slot.querySelector('.gun');
  const r = gun.getBoundingClientRect();
  const ghost = gun.cloneNode(true);
  ghost.id = 'ghost';
  ghost.classList.remove('pop');
  ghost.style.width = r.width / scale + 'px';
  ghost.style.height = r.height / scale + 'px';
  ghost.style.inset = 'auto';
  ghost.style.transform = `translate(-50%, -50%) scale(${scale * 1.08})`;
  ghost.style.left = e.clientX + 'px';
  ghost.style.top = e.clientY + 'px';
  document.body.appendChild(ghost);
  slot.classList.add('from');
  gridEl.querySelectorAll('.slot').forEach((s) => { if (+s.dataset.i !== i && S.grid[+s.dataset.i] === S.grid[i]) s.classList.add('target'); });
  drag = { i, ghost };
});
addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.ghost.style.left = e.clientX + 'px';
  drag.ghost.style.top = e.clientY + 'px';
});
addEventListener('pointerup', (e) => {
  if (!drag) return;
  const { i, ghost } = drag;
  drag = null;
  ghost.remove();
  const slot = document.elementFromPoint(e.clientX, e.clientY)?.closest('.slot');
  const j = slot ? +slot.dataset.i : -1;
  let pop = -1;
  if (j >= 0 && j !== i) {
    if (S.grid[j] === S.grid[i]) { S.grid[j]++; S.grid[i] = 0; pop = j; Sound.play('merge'); buzz(15); mission('merge'); }
    else { [S.grid[i], S.grid[j]] = [S.grid[j], S.grid[i]]; }
  }
  renderGrid(pop); updateUI();
});

// ---------- 게임 로직 ----------
let world, field, hero;
const KING_H = 350; // 대왕 보스 그림 키 (논리 px)
// ---------- 스프라이트 시트 애니메이션 (ANIM_TODO, 2026-10-21) ----------
// 시트 이름 anim_<누구>_<프레임수>f — 정사각형 프레임을 가로로 나란히(정사각형 시트면 √n 칸씩). 영상에서 뽑은 대왕 보스 대기+공격 한 벌
// 대왕 보스 공격 시트 (2026-10-21 두 번째 시도): 평소엔 한 장 그림 + 코드 움직임, 내려칠 때만 시트 6장을 한 번 재생 (대기 시트는 움직임이 거의 없어 안 씀)
// 시트 anim_king_<챕터>_attack_6f: 0 준비 · 1~2 두 팔 들기 · 3 내려치기 · 4 땅 치기(= 실제 공격 순간) · 5 돌아오기
// feet·charH = 프레임 기준 발 높이·캐릭터 키 비율, still* = 한 장 그림(king_*) 기준 — 둘의 캐릭터 키·발 위치를 맞춘다
const KING_ATK = { hit: 4, fps: 10, feet: 0.945 };
// 챕터별 크기 맞춤 — charH: 시트 0번 장 캐릭터 키 / 프레임, stillCharH·stillFeet: 한 장 그림(king_*) 캐릭터 키·발 높이 / 그림 (재서 넣는다)
// hit: 땅 치는(= 실제 공격) 장 번호 — 대부분 4, 시트마다 다르면 여기서
const KING_FIT = {
  kitchen: { charH: 0.60, stillCharH: 0.91, stillFeet: 0.977 },
  fridge: { charH: 0.625, stillCharH: 0.957, stillFeet: 0.984 },
  pantry: { charH: 0.594, stillCharH: 0.93, stillFeet: 0.990, hit: 3 },
  hall: { charH: 0.551, stillCharH: 0.84, stillFeet: 0.994, hit: 3 },
  bakery: { charH: 0.64, stillCharH: 0.98, stillFeet: 0.984 },
};
const kingLead = (hit = KING_ATK.hit) => (hit + 0.5) / KING_ATK.fps; // 공격 애니 시작 ~ 땅 치는 순간 (4번 장이면 0.45초, 충격파가 그 장 가운데쯤)
const animCache = {};
function animFrames(key) {
  if (animCache[key]) return animCache[key];
  const tex = ART[key]; if (!tex) return null;
  const n = +((key.match(/_(\d+)f$/) || [])[1] || 0); if (!n) return null;
  // 정사각형 프레임 격자: 그림 가로세로 비율에 맞는 열 수를 찾는다 (한 줄 6칸·3×2·7×7 모두)
  let cols = n;
  for (let c = 1; c <= n; c++) if (Math.abs(c / Math.ceil(n / c) - tex.width / tex.height) < 0.01) { cols = c; break; }
  const fs = tex.width / cols, frames = [];
  for (let i = 0; i < n; i++) frames.push(new PIXI.Texture({ source: tex.source, frame: new PIXI.Rectangle((i % cols) * fs, Math.floor(i / cols) * fs, fs, fs) }));
  return (animCache[key] = frames);
}
const kingAnimKey = (ch) => Object.keys(ART).find((k) => k.startsWith('anim_king_' + ch.id + '_attack_'));
function playKingAttack(e) {
  const a = e.anim; a.mode = 'attack';
  a.still.visible = false; a.sp.visible = true;
  a.sp.onComplete = () => { a.mode = 'idle'; a.sp.visible = false; a.still.visible = true; };
  a.sp.gotoAndPlay(0);
}
const glowCache = {}; // 강한 적 빨간 빛 구운 그림 (그림 키:크기)
function spawnEnemy(boss, wall = false) {
  // 몸 반지름 (그림 키 ≈ 반지름 × 2.8~2.9). 2026-10-21 키움: 일반 22→30(키 87, 셰프 168의 52%), 보스 46→60(셰프와 같은 키), 대왕 보스 58→76(셰프의 1.27배)
  // 2바퀴부터(일반 스테이지만): 가끔 강한 적, 다른 챕터 적이 섞여 나온다
  const lapOn = !boss && !rush && !chal && lapOf(S.stage) >= 1;
  const strong = lapOn && Math.random() < STRONG_CHANCE;
  // 2026-10-21 보스 한 번 더 키움: 보스 60→72(키 202, 셰프의 1.2배), 대왕 보스 76→92(키 258, 셰프의 1.5배)
  const r = wall ? 92 : boss ? 72 : strong ? Math.round(30 * STRONG.r) : 30;
  const c = new PIXI.Container();
  let ch = rush ? CHAPTERS[rush.kills % CHAPTERS.length] : chal && chal.horde ? CHAPTERS[Math.floor(Math.random() * CHAPTERS.length)] : chal ? CHAPTERS[chal.ci] : chapterOf(S.stage); // 러시는 잡을 때마다 다음 챕터 보스, 대군 모드는 다섯 챕터 적이 마구 섞여 나온다 (2026-10-21)
  if (lapOn && Math.random() < LAP_MIX) { const others = CHAPTERS.filter((x) => x !== ch); ch = others[Math.floor(Math.random() * others.length)]; }
  const est = chal ? chal.st : S.stage; // 도전은 그 챕터 강한 보스 스테이지 세기
  const art = enemyArt(ch, boss, Math.floor(Math.random() * 3), wall);
  let g, barY = -r - 22, glow = null;
  const animKey = wall && !rush ? kingAnimKey(ch) : null, animFr = animKey && animFrames(animKey);
  let anim = null;
  if (ART[art.key]) {
    // 손그림: 발이 원 아래쪽(r)에 오도록, 키는 반지름의 약 2.9배
    g = new PIXI.Container();
    // 그림 키: 대왕 보스만 '그림만' 크게 KING_H(350, 셰프의 2.1배) — 판정(반지름 r)은 그대로라 공격 거리·맞는 범위는 안 바뀐다 (2026-10-21)
    const h = wall ? KING_H : r * (boss ? 2.8 : 2.9), sp = artSprite(art.key, h);
    sp.y = r * 1.05;
    sp.tint = art.tint;
    // 강한 적: 몸 둘레에 빨간 빛 (같은 그림을 빨갛게 칠해 흐리게 번진 것을 뒤에 깐다, 2026-10-21)
    if (strong) {
      // 그림 모양만 따서 순수한 밝은 빨강으로 칠한 뒤(색을 곱하면 초록 적은 어두운 빨강이 된다) 두 겹으로 번지게: 바깥 크게·안쪽 진하게
      // 번짐(blur)은 매 프레임 계산하면 무거워서(발열) 그림·크기마다 한 번만 그림으로 구워 두고 그 그림을 쓴다 (2026-10-21 최적화)
      const gk = art.key + ':' + Math.round(h);
      if (!glowCache[gk]) {
        const tmp = new PIXI.Container();
        for (const [k, blur, a] of [[1.42, 18, 0.9], [1.16, 6, 1]]) {
          const gs = artSprite(art.key, h * k);
          gs.y = sp.y + h * (k - 1) / 2; gs.alpha = a;
          gs.filters = [strongRed(), new PIXI.BlurFilter({ strength: blur, quality: 3 })];
          tmp.addChild(gs);
        }
        const b = tmp.getLocalBounds(), pad = 60;
        const frame = new PIXI.Rectangle(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
        glowCache[gk] = { tex: app.renderer.generateTexture({ target: tmp, frame, resolution: 1 }), x: frame.x, y: frame.y };
        tmp.destroy({ children: true });
      }
      glow = new PIXI.Sprite(glowCache[gk].tex);
      glow.position.set(glowCache[gk].x, glowCache[gk].y);
      g.addChild(glow);
    }
    g.addChild(sp);
    if (animFr) {
      // 대왕 공격 시트: 한 장 그림과 캐릭터 키·발 위치를 맞춰 겹쳐 두고, 공격할 때만 바꿔 보여 준다
      const as = new PIXI.AnimatedSprite(animFr);
      as.anchor.set(0.5, KING_ATK.feet);
      const fit = KING_FIT[ch.id] || KING_FIT.kitchen;
      as.scale.set((h * fit.stillCharH) / (fit.charH * animFr[0].height));
      as.y = sp.y - h * (1 - fit.stillFeet);
      as.loop = false; as.animationSpeed = KING_ATK.fps / 60; as.visible = false;
      g.addChild(as);
      anim = { sp: as, still: sp, mode: 'idle', lead: kingLead(fit.hit) };
    }
    barY = sp.y - h - 14;
  } else { g = new PIXI.Graphics(); drawVeg(g, r, art.kind); g.tint = art.tint; }
  const bar = new PIXI.Container(); // 머리 위 체력 막대 (drawBar)
  // 발밑 그림자 — 셰프·동료와 같은 색·진하기. 몸(g)이 튀거나 찌그러져도 바닥에 남게 컨테이너에 둔다
  const sw = wall ? KING_H / 2.8 : r; // 그림자는 보이는 크기에 맞춘다
  const shadow = new PIXI.Graphics().ellipse(0, r * 1.0, sw * 1.15, sw * 0.28).fill({ color: 0x000000, alpha: 0.18 });
  c.addChild(shadow, g, bar);
  const hpY = boss ? r + sw * 0.28 + 6 : barY - 6; // 체력 막대: 보스만 발밑 그림자 아래, 나머지는 머리 위 (2026-10-21 사용자)
  // 지금 보이는 화면 바로 바깥(위·왼쪽·오른쪽)에서 들어온다
  let x, y;
  const side = boss ? 0 : Math.floor(Math.random() * 4); // 위쪽이 두 배로 자주
  if (side <= 1) { x = cam.x + 60 + Math.random() * (FW - 120); y = cam.y - 50; }
  else if (side === 2) { x = cam.x - 50; y = cam.y + 150 + Math.random() * (FH * 0.6); }
  else { x = cam.x + FW + 50; y = cam.y + 150 + Math.random() * (FH * 0.6); }
  c.position.set(x, y);
  field.addChild(c);
  const hp = enemyHp(est) * (boss ? BAL.bossHp : 1) * (wall ? WALL_HP : 1) * (strong ? STRONG.hp : 1) * (chal && !chal.horde && chal.lv ? Math.pow(CHAL_HP_STEP, chal.lv - 1) : 1); // 도전 단계마다 ×1.5
  const e = { c, g, bar, x, y, r, hp, max: hp, boss, speed: boss ? 34 : 50 + Math.random() * 22 + S.stage * 0.5,
    gold: enemyGold(est) * (boss ? BAL.bossGold : 1) * (wall ? BAL.wallGold : 1) * (strong ? STRONG.gold : 1) * goldAll(), wall, strong, glow, anim, hit: 0, dead: false, wob: Math.random() * 6, atkT: 0.3, lunge: 0, lx: 0, ly: 0, barY, hpY };
  drawBar(e);
  enemies.push(e);
}
// 적 체력 막대: 일반 적은 맞았을 때만 머리 위(두께 14 빨강), 보스는 발밑(두께 24 + 왼쪽 왕관)
function drawBar(e) {
  const b = e.bar, r = Math.max(0, e.hp / e.max);
  b.visible = e.hp < e.max || e.boss;
  if (!b.visible) return;
  if (!b.built) {
    b.built = true;
    b.g = new PIXI.Graphics(); b.addChild(b.g);
    if (e.boss && ART.icon_boss) { const cr = artSprite('icon_boss', 44, 0.5); cr.position.set(-bossBarW(e) / 2 - 2, e.hpY + BOSS_BAR.h / 2 - 2); b.addChild(cr); }
  }
  if (e.boss) return drawGauge(b.g, -bossBarW(e) / 2, e.hpY, bossBarW(e), BOSS_BAR.h, r, 0xe8483a, BOSS_BAR.line);
  const w = Math.max(64, e.r * 2.2);
  drawGauge(b.g, -w / 2, e.hpY, w, 14, r, 0xe8483a, 3); // 일반 적: 두께 14, 빨강 (2026-10-21)
}
// 보스 머리 위 체력 바 (2026-10-21 사용자 결정: 위쪽 큰 바 대신 이것 하나로, 왕관은 납작한 ui_boss_crown 대신 위쪽 진행 바와 같은 icon_boss) — 진갈색 테두리 + 밝은 빨강 채움 + 위쪽 밝은 띠
const BOSS_BAR = { w: 220, wallW: 280, h: 24, line: 4 };
const bossBarW = (e) => (e.wall ? BOSS_BAR.wallW : BOSS_BAR.w);
// 화면 위쪽 보스 체력 바 — 채움을 오른쪽부터 잘라 줄인다(잘린 끝도 둥글게). 채움 칸 = 그림 480×60 중 x 91~478
let bossBarR = -1;
function updateBossBar() {
  const b = enemies.find((e) => e.boss && !e.dead);
  const r = b ? Math.max(0, b.hp / b.max) : -1;
  if (r === bossBarR) return;
  bossBarR = r;
  $('bossBar').classList.toggle('on', !!b);
  $('bossBar').classList.toggle('wall', !!(b && b.wall));
  if (b) $('bossFill').style.clipPath = `inset(0 ${((1 - r) * 100).toFixed(2)}% 0 0 round 0 999px 999px 0)`;
}
function removeEnemy(e) {
  e.dead = true;
  e.c.destroy({ children: true });
  enemies.splice(enemies.indexOf(e), 1);
}
function clearField() {
  $('warn').classList.remove('on');
  while (enemies.length) removeEnemy(enemies[0]);
  while (bullets.length) bullets.pop().g.destroy();
  if (aimG) { aimG.visible = false; aimG.target = null; } // 잡던 적이 없어졌으니 조준 표시도 끈다
  for (const g of mateAims) { g.visible = false; g.target = null; }
  for (const id in mateSprites) mateSprites[id].aimT = null;
}
function resetWave() {
  wave = { idx: 0, total: waveCount(S.stage), spawned: 0, kills: 0, bossSpawned: false, spawnT: 0.8, breakT: 0 };
}
const isFinalWave = () => wave.idx === wave.total - 1;
// 보스 경고 (2026-10-21): 마지막 웨이브가 시작되면 WARN_T 동안 화면이 빨갛게 깜빡이고 WARNING 띠 → 그 뒤 보스 등장
const WARN_T = 1.8;
function startWave() {
  if (isFinalWave()) {
    wave.warnT = WARN_T;
    $('warn').classList.toggle('wall', isWallStage(S.stage));
    $('warn').classList.add('on');
    Sound.play('warn'); buzz(60);
  } else banner(`WAVE ${wave.idx + 1}/${wave.total}`, 1.0, 'plain under'); // 2026-10-22 사용자: 웨이브 안내는 알약 바탕 없이
}
function spawnStageBoss() {
  $('warn').classList.remove('on');
  const wall = isWallStage(S.stage);
  if (wall) banner(t('battle.king', { boss: wallBossName(S.stage), hp: WALL_HP, sec: WALL_TIME }), 2, 'under');
  else banner(t('battle.boss', { sec: BOSS_TIME }), 1.6, 'under');
  wave.bossSpawned = true;
  spawnEnemy(true, wall);
  bossT = (wall ? WALL_TIME : BOSS_TIME) + BOSS_ENTER_T; // 등장부터 줄어든다 — 걸어 들어오는 시간만큼 더 준다 (2026-10-22 사용자)
  Sound.play(wall ? 'wall' : 'boss'); shake(wall ? 12 : 5);
  enemies[enemies.length - 1].talkT = 0; // 첫 대사는 화면 안에 들어오자마자 (bossTalk)
}
let bubble = null;
// 보스는 살아 있는 동안 몇 초마다 다른 대사를 한다 (2026-10-21). 말풍선 아래 끝이 이보다 위로 가지 않게(위쪽 표시·보스 체력 바 아래)
const BUBBLE_MIN_Y = 300 + SAFE_TOP;
function bossTalk(dt) {
  const boss = enemies.find((e) => e.boss && !e.dead);
  if (!boss || bubble) return;
  if (boss.c.y + boss.barY - cam.y < BUBBLE_MIN_Y + 60) return; // 머리가 화면 위쪽 밖·위쪽 표시 뒤에 있으면 아직 말하지 않는다
  boss.talkT = (boss.talkT ?? 2.5) - dt;
  if (boss.talkT > 0) return;
  boss.talkT = 6 + Math.random() * 3;
  const lines = BOSS_LINES.filter((l) => l !== boss.lastLine);
  boss.lastLine = lines[Math.floor(Math.random() * lines.length)];
  bossSay(boss.lastLine);
}
function bossSay(text) {
  if (bubble) bubble.el.remove();
  const el = document.createElement('div');
  el.className = 'bubble';
  el.textContent = text;
  fxEl.appendChild(el);
  bubble = { el, life: 3.5 };
}
function updateBubble(dt) {
  if (!bubble) return;
  const boss = enemies.find((e) => e.boss);
  bubble.life -= dt;
  if (!boss || bubble.life <= 0) { bubble.el.remove(); bubble = null; return; }
  // 보스 머리 위(체력 막대 위)에 붙어 따라다닌다 — 통통 뛰는 것까지 따라가게 실제 그려진 위치(c.position) 기준. 화면 밖으로는 안 나가게만 막는다
  const bx = Math.max(150, Math.min(FW - 150, boss.c.x - cam.x));
  const by = Math.max(BUBBLE_MIN_Y, boss.c.y + boss.barY - 16 - cam.y);
  bubble.el.style.left = bx + 'px';
  bubble.el.style.top = by + 'px';
  bubble.el.style.opacity = Math.min(1, bubble.life * 2);
}

let bgNode = null, bgKey = '', lastChapter = -1;
// 지금 장소(챕터 또는 보스 러시 결투장)에 맞게 배경을 바꾸고, 새 챕터에 들어가면 간판을 띄운다
function syncChapter(announce = true) {
  const ci = chapterIdx(S.stage);
  const night = !rush && !chal && lapOf(S.stage) >= 1;
  const key = (rush ? 'arena' : chal ? CHAPTERS[chal.ci].id : CHAPTERS[ci].id) + (night ? ':night' : '');
  if (key !== bgKey) {
    if (bgNode) bgNode.destroy({ children: true });
    bgNode = makeBackground(rush ? ARENA : chal ? CHAPTERS[chal.ci] : CHAPTERS[ci]);
    bgNode.zIndex = -2;
    if (night) bgNode.tint = NIGHT_TINT; // 🌙 한밤의 주방: 배경만 어둡게 (캐릭터는 그대로 밝아 잘 보인다)
    world.addChild(bgNode);
    bgKey = key;
  }
  if (!rush && !chal && ci !== lastChapter) {
    if (announce && lastChapter >= 0) chapterSign(ci);
    lastChapter = ci;
  }
}
function chapterSign(ci) {
  const ch = CHAPTERS[ci], el = $('chapterSign');
  const lap = lapOf(S.stage);
  // 그림(ui_chapter_*)은 글자가 게임 글꼴이 아니고 바퀴 안내가 안 나와서 안 쓴다 — 늘 코드 안내판. 챕터 번호는 빼고 2바퀴부터 'N바퀴'만 (2026-10-21 사용자)
  el.innerHTML = `<div class="sign">${lap ? `<small>${t('chapter.lap_only', { n: lap + 1 })}</small>` : ''}<b>${ch.name}</b><span>${t('chapter.sign_sub')}</span></div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  Sound.play('claim');
}

// 강한 보스에서 같은 스테이지를 연속으로 못 넘으면 환생을 안내한다 (스테이지마다 이번 실행에 한 번)
const WALL_HINT_FAILS = 2;
let wallFail = { st: 0, n: 0 };
const wallHintShown = new Set();
function wallPrestigeHint(st) {
  if (wallHintShown.has(st) || !$('modal').classList.contains('hidden')) return;
  const gain = starsFor(S.stage), spend = S.stars >= permCost('atk') && !permMax('atk');
  if (gain < 1 && !spend) return;
  wallHintShown.add(st);
  const step = Math.round(BAL.perm.atk.step * 100);
  showModal(`<div class="title small">${t('wallhint.title', { boss: wallBossName(st) })}</div>
    ${gain >= 1 ? `<p class="sub">${t('wallhint.gain', { star: STAR, n: fmt(gain), pct: step })}</p>` : ''}
    ${spend ? `<p class="sub">${t('wallhint.spend', { star: STAR, n: fmt(S.stars) })}</p>` : ''}`,
  t('wallhint.go'), () => openSheet('prestige'), t('wallhint.later'));
}

function retreat() {
  if (rush) { endRush(t('end.down')); return; }
  if (chal) { endChal(false, t('end.down')); return; }
  const failSt = S.stage, wallFailNow = isWallStage(failSt);
  if (wallFailNow) wallFail = wallFail.st === failSt ? { st: failSt, n: wallFail.n + 1 } : { st: failSt, n: 1 };
  clearField();
  S.stage = Math.max(1, S.stage - 1);
  resetWave();
  syncChapter(false);
  heroHp = heroMax;
  for (const id in mateSprites) { const ms = mateSprites[id]; ms.stun = 0.01; ms.hp = 0; }
  banner(`${t('battle.retreat')}<small>${retreatHint()}</small>`, 2.6, 'under');
  Sound.play('retreat');
  if (wallFailNow && wallFail.n >= WALL_HINT_FAILS) setTimeout(() => wallPrestigeHint(failSt), 1200); // 후퇴 배너를 먼저 보여 준 뒤
}
// 막혔을 때 지금 가장 효과적인 다음 행동을 알려준다
function retreatHint() {
  const lv = S.grid.filter((L) => L);
  if (lv.some((L, i) => lv.indexOf(L) !== i)) return t('hint.merge');
  if (S.grid.includes(0) && S.gold >= costBuy()) return t('hint.buy');
  if (S.gold >= costAtk()) return t('hint.atk');
  const m = MATES.find((x) => S.gold >= mateCost(x));
  if (m) return t(mateLv(m) ? 'hint.mate_up' : 'hint.mate_hire', { icon: m.icon, name: m.name });
  if (starsFor(S.stage + 1) >= 3) return t('hint.prestige');
  return t('hint.idle');
}
function stageClear() {
  if (wallFail.st === S.stage) wallFail = { st: 0, n: 0 };
  // 보스가 쓰러지면 남은 채소는 도망간다
  for (const e of [...enemies]) removeEnemy(e);
  S.stage++;
  S.bestStage = Math.max(S.bestStage || 0, S.stage); // 🏠 주방 레벨 기준 (환생해도 유지)
  resetWave();
  syncChapter();
  banner(isWallStage(S.stage) ? `${t('battle.stage', { n: S.stage })}<small>${t('battle.king_next', { boss: wallBossName(S.stage) })}</small>` : t('battle.stage', { n: S.stage }), isWallStage(S.stage) ? 2 : 1.4, 'under');
  Sound.play('clear');
  mission('stage');
  save();
}
// 공격 범위: 화면 가장자리·위쪽 표시(명판) 뒤의 적은 아직 노리지 않는다 — 들어오는 게 보인 뒤에 맞게 (2026-10-21 사용자 요청)
// 좌우 = 옆 메뉴 알약 폭, 위 = 스테이지 명판·절전모드 아래, 아래 = 카드 위. 셰프 가까이(AIM_NEAR) 온 적은 화면 안이면 언제나 노린다
const BOSS_ENTER_SPEED = 130;
const BOSS_ENTER_T = 3; // 화면 위 밖 → 공격 범위까지 걸어오는 시간(약 400px ÷ 130)을 제한시간에 더한다
const AIM_ZONE = { side: 110, top: 300 + SAFE_TOP, bottom: 40 }, AIM_NEAR = 220;
function canAim(e) {
  if (e.x < cam.x || e.x > cam.x + FW || e.y < cam.y + 20 || e.y > cam.y + FH) return false; // 화면 밖
  if (chal && chal.horde) return true; // 대군 모드는 화면 가득 공격 (2026-10-21 사용자 요청)
  const inner = e.x >= cam.x + AIM_ZONE.side && e.x <= cam.x + FW - AIM_ZONE.side && e.y >= cam.y + AIM_ZONE.top && e.y <= cam.y + FH - AIM_ZONE.bottom;
  return inner || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 <= AIM_NEAR * AIM_NEAR;
}
function nearestEnemy() {
  let best = null, bd = Infinity;
  for (const e of enemies) {
    if (!canAim(e)) continue;
    const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
const HIT_T = 0.14; // 맞았을 때 눌림·번쩍·밀림 연출 길이(초)
// ---------- 보스 내려치기 연출: 충격파 고리 + 먼지 + 화면 흔들림 (보이기만) ----------
const BOSS_WIND = 0.35, BOSS_SLAM_T = 0.25;
const shockwaves = [];
function bossSlam(e, tgt) {
  e.slam = BOSS_SLAM_T;
  const x = e.x + e.lx * e.r * 0.8, y = e.y + e.r * 0.9; // 상대 쪽 바닥
  const g = new PIXI.Graphics();
  g.ellipse(0, 0, 60, 22).stroke({ width: 10, color: e.wall ? 0xff5a3a : 0xfff0c8, alpha: 0.95 });
  g.ellipse(0, 0, 60, 22).stroke({ width: 4, color: 0xffffff, alpha: 0.9 });
  g.position.set(x, y); g.scale.set(0.3);
  fxLayer.addChild(g);
  shockwaves.push({ g, t: 0, max: e.wall ? 1.9 : 1.5 });
  spawnFx('fx_poof', x, y - 10, e.r * 1.2, 0.35);
  shake(e.wall ? 8 : 5); buzz(20);
  Sound.play('bossHit');
}
function updateShockwaves(dt) {
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const w = shockwaves[i]; w.t += dt;
    const p = Math.min(1, w.t / 0.38);
    w.g.scale.set(0.3 + (w.max - 0.3) * (1 - (1 - p) * (1 - p)));
    w.g.alpha = 1 - p;
    if (p >= 1) { w.g.destroy(); shockwaves.splice(i, 1); }
  }
}
function launch(kind, L, sx, sy, dmg, target) {
  const key = kind === 'tool' ? toolKey(L) : 'proj_' + kind;
  let g;
  // 크기 (2026-10-21 키움): 도구 54~68 (레벨이 오를수록 조금씩 크게), 동료 투사체 34
  if (ART[key]) g = artSprite(key, kind === 'tool' ? 52 + Math.min(L, 8) * 2 : 34, 0.5);
  else { g = new PIXI.Graphics(); drawProj(g, kind, L); }
  g.position.set(sx, sy);
  field.addChild(g);
  bullets.push({ g, x: sx, y: sy, target, dmg });
}
function fire(L, slot, target) {
  const ox = ((slot % 4) - 1.5) * 14;
  const sx = P.x + 40 * P.face + ox, sy = P.y - 30;
  launch('tool', L, sx, sy, gunDmg(L) * atkMul(), target);
  Sound.play('throw');
  hero.gun.rotation = Math.atan2(target.y - sy, target.x - sx) + Math.PI / 2;
  P.squash = 0.05;
}

// ---------- 동료 ----------
const mateSprites = {};
function syncMates() {
  MATES.filter((m) => mateLv(m)).forEach((m, i) => {
    if (mateSprites[m.id]) { mateSprites[m.id].spot = MATE_SPOTS[i]; return; }
    const c = new PIXI.Container();
    const shadow = new PIXI.Graphics().ellipse(0, 30, 30, 8).fill({ color: 0x000000, alpha: 0.18 });
    const MATE_H = { chick: 90, bunny: 110, penguin: 92, squirrel: 92, fox: 100, panda: 96, frog: 88 };
    let g;
    if (ART['mate_' + m.id]) { g = new PIXI.Container(); const sp = artSprite('mate_' + m.id, MATE_H[m.id]); sp.y = 30; g.addChild(sp); }
    else { g = new PIXI.Graphics(); drawMate(g, m.id); g.scale.set(1.35); }
    const bar = makeHpBar(56, 30 - (ART['mate_' + m.id] ? MATE_H[m.id] : 70) - 20, 14); // 머리 위 (적·셰프와 통일, 두께 14)
    bar.visible = false;
    // 기절했을 때 머리 위에서 도는 별
    let stars;
    if (ART.fx_stun) { stars = artSprite('fx_stun', 34, 0.5); stars.position.set(0, 30 - MATE_H[m.id] - 34); } // 체력 막대 위
    else {
      stars = new PIXI.Graphics();
      [0, 2.1, 4.2].forEach((a) => stars.star(Math.cos(a) * 22, Math.sin(a) * 22, 5, 7, 3).fill(0xffd34d));
      stars.position.set(0, -50); stars.scale.y = 0.45;
    }
    stars.visible = false;
    c.addChild(shadow, g, bar, stars);
    const spot = MATE_SPOTS[i];
    const ms = { m, c, g, bar, stars, spot, x: P.x + spot.x, y: P.y + spot.y, t: Math.random(), walk: Math.random() * 6, face: 1,
      hp: mateMaxHp(m), stun: 0, hitT: 0 };
    c.position.set(ms.x, ms.y);
    world.addChild(c);
    mateSprites[m.id] = ms;
  });
}
function hurtMate(ms, dmg) {
  if (ms.stun > 0 || (typeof cheat !== 'undefined' && cheat.god)) return; // 🛠 무적
  ms.hp -= dmg; ms.hitT = 0.2;
  popText(ms.x, ms.y - 50, '-' + fmt(dmg), 'hurt small');
  if (ms.hp <= 0) { ms.hp = 0; ms.stun = 5; popText(ms.x, ms.y - 80, t('mates.stunned'), 'hurt'); Sound.play('stun'); }
}
function updateMates(dt) {
  // 동료는 각자 다른 적을 노린다 (2026-10-22 사용자): 셰프와 가까운 순서로 줄 세워, 셰프가 노리는 가장 가까운 적 다음부터 한 마리씩 나눠 맡는다(적이 적으면 돌아가며 겹침)
  const targets = enemies.filter(canAim).sort((a, b) => ((a.x - P.x) ** 2 + (a.y - P.y) ** 2) - ((b.x - P.x) ** 2 + (b.y - P.y) ** 2));
  let mi = 0;
  if (mateBuffT > 0) mateBuffT -= dt;
  for (const id in mateSprites) {
    const ms = mateSprites[id];
    const max = mateMaxHp(ms.m);
    // 역할 능력 (기절 중엔 쉼): 개구리 회복 · 펭귄 공격 속도 버프
    const role = mateRole(ms.m);
    if (role && role.every && ms.stun <= 0 && (ms.roleT = (ms.roleT ?? role.every) - dt) <= 0) {
      ms.roleT = role.every;
      if (role.role === 'heal') {
        heroHp = Math.min(heroMax, heroHp + heroMax * role.pct);
        for (const k in mateSprites) { const o = mateSprites[k]; if (o.stun <= 0) o.hp = Math.min(mateMaxHp(o.m), o.hp + mateMaxHp(o.m) * role.pct); }
        popText(P.x, P.y - 150, t('mates.heal'), 'green');
      } else if (role.role === 'buff') {
        mateBuffT = role.dur;
        popText(P.x, P.y - 150, t('mates.buff'), 'gold');
      }
    }
    // 기절: 누워서 별이 돌고, 5초 뒤 체력을 회복하고 일어난다
    if (ms.stun > 0) {
      ms.stun -= dt;
      ms.g.rotation = 1.45 * ms.face; ms.g.y = 12; ms.g.alpha = 0.75;
      ms.stars.visible = true; ms.stars.rotation = Math.sin(ms.stun * 6) * 0.4; // 좌우로 흔들리는 별
      ms.bar.visible = false;
      if (ms.stun <= 0) { ms.hp = max; ms.g.rotation = 0; ms.g.alpha = 1; ms.stars.visible = false; }
      ms.c.zIndex = ms.y;
      continue;
    }
    ms.hp = Math.min(max, ms.hp + max * 0.04 * dt);
    if (ms.hitT > 0) { ms.hitT -= dt; ms.g.tint = 0xff7070; ms.g.x = (Math.random() - 0.5) * 6; } else { ms.g.tint = 0xffffff; ms.g.x = 0; }
    ms.bar.visible = ms.hp < max;
    if (ms.bar.visible) ms.bar.set(ms.hp / max);
    const tx = P.x + ms.spot.x, ty = P.y + ms.spot.y;
    const dx = tx - ms.x, dy = ty - ms.y;
    const a = Math.min(1, dt * 4);
    ms.x += dx * a; ms.y += dy * a;
    const moving = Math.min(1, Math.hypot(dx, dy) / 30);
    if (Math.abs(dx) > 4) ms.face = dx > 0 ? 1 : -1;
    ms.walk += dt * 12;
    ms.c.position.set(ms.x, ms.y);
    ms.g.y = -Math.abs(Math.sin(ms.walk)) * (3 + 6 * moving);
    ms.g.scale.x = ms.face;
    // 각자 공격 — 맡은 적(조준 표시도 이 적에)
    ms.aimT = ms.stun > 0 ? null : targets.length ? targets[(mi + 1) % targets.length] : null;
    ms.t -= dt * buffSpd();
    if (ms.t <= 0) {
      const t = ms.aimT;
      if (t) { launch(ms.m.proj, 0, ms.x, ms.y - 14, mateDmg(ms.m), t); ms.t = ms.m.iv * (0.9 + Math.random() * 0.2); }
    }
    // 아래에 있는 것이 앞에 보이게
    ms.c.zIndex = ms.y;
    mi++;
  }
  hero.c.zIndex = P.y;
}

function hurtHero(dmg) {
  if (typeof cheat !== 'undefined' && cheat.god) return false; // 🛠 무적
  heroHp -= dmg; P.hitT = 0.25;
  Sound.play('hurt'); shake(6); buzz(25);
  popText(P.x + (Math.random() - 0.5) * 30, P.y - 120, '-' + fmt(dmg), 'hurt');
  if (heroHp <= 0) { retreat(); return true; }
  return false;
}
// 채소는 가장 가까운 셰프나 (기절하지 않은) 동료에게 달려든다
function pickTarget(e) {
  // 방어 동료(판다): 가까이 있는 적은 판다부터 노린다
  const tank = mateSprites.panda, tr = roleStat('panda')?.taunt || 0;
  if (tank && tank.stun <= 0 && (tank.x - e.x) ** 2 + (tank.y - e.y) ** 2 < tr * tr) return { x: tank.x, y: tank.y, ms: tank };
  let best = { x: P.x, y: P.y, hero: true }, bd = (P.x - e.x) ** 2 + (P.y - e.y) ** 2;
  for (const id in mateSprites) {
    const ms = mateSprites[id];
    if (ms.stun > 0) continue;
    const d = (ms.x - e.x) ** 2 + (ms.y - e.y) ** 2;
    if (d < bd) { bd = d; best = { x: ms.x, y: ms.y, ms }; }
  }
  return best;
}

// ---------- 조준 표시 (총고식 흰 원 + 십자) — 셰프가 노리는 적 위에 ----------
let aimG = null;
const USE_AIM_ART = false;
function makeAim() {
  // 6차 손그림 ui_aim(80×80)도 있지만 코드 그림이 더 낫다는 사용자 판단(2026-10-21)으로 꺼 둠 — 다시 쓰려면 USE_AIM_ART = true
  // updateAim이 크기를 바꾸므로 그림은 틀 안에 넣는다
  if (USE_AIM_ART && ART.ui_aim) { const c = new PIXI.Container(); c.addChild(artSprite('ui_aim', 80, 0.5)); c.zIndex = 99998; c.visible = false; return c; }
  const g = new PIXI.Graphics();
  const ring = (w, c) => {
    g.circle(0, 0, 26).stroke({ width: w, color: c });
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2, cx = Math.cos(a), cy = Math.sin(a);
      g.moveTo(cx * 16, cy * 16).lineTo(cx * 36, cy * 36).stroke({ width: w, color: c, cap: 'round' });
    }
  };
  ring(9, 0x3a2418); ring(4.5, 0xffffff); // 진갈색 외곽선 위에 흰 선
  g.zIndex = 99998; g.visible = false;
  return g;
}
// 동료 조준 표시 (2026-10-22 사용자: 각자 다른 적을 노리니 표시도 여러 개) — 셰프 것보다 작고 조금 흐리게, 셰프 목표와 겹치면 안 그림
const mateAims = [];
function updateMateAims(chefT, dt) {
  const ts = [...new Set(Object.values(mateSprites).map((ms) => ms.aimT).filter((x) => x && x !== chefT && !x.dead))];
  while (mateAims.length < ts.length) { const g = makeAim(); g.alpha = 0.8; world.addChild(g); mateAims.push(g); }
  mateAims.forEach((g, k) => {
    const t = ts[k];
    g.visible = !!t;
    if (!t) { g.target = null; return; }
    const tx = t.x, ty = t.y - t.r * 0.4;
    if (g.target !== t) { g.target = t; g.position.set(tx, ty); }
    else g.position.set(g.x + (tx - g.x) * Math.min(1, dt * 20), g.y + (ty - g.y) * Math.min(1, dt * 20));
    g.rotation -= dt * 1.2;
    g.scale.set(Math.max(0.8, t.r / 30) * 0.7);
  });
}
function updateAim(t, dt) {
  updateMateAims(t, dt);
  if (!aimG) return;
  aimG.visible = !!t;
  if (!t) return;
  const tx = t.x, ty = t.y - t.r * 0.4;
  // 새 목표로 바뀌면 바로 옮기고, 같은 목표면 부드럽게 따라간다
  if (aimG.target !== t) { aimG.target = t; aimG.position.set(tx, ty); aimG.pop = 0.18; }
  else aimG.position.set(aimG.x + (tx - aimG.x) * Math.min(1, dt * 20), aimG.y + (ty - aimG.y) * Math.min(1, dt * 20));
  aimG.pop = Math.max(0, (aimG.pop || 0) - dt);
  aimG.rotation += dt * 1.2;
  aimG.scale.set(Math.max(0.8, t.r / 30) * (1 + aimG.pop * 2));
}

// ---------- 가상 조이스틱 (총고식): 빈 전장을 누르고 끌면 셰프를 직접 움직인다. 떼면 다시 알아서 돌아다닌다 ----------
// 캔버스가 터치 제스처를 가져가게 touch-action: none (사내 기준 ux:touch-input 'WebView 터치 함정')
// 좌표는 셸 배율을 나눠 디자인 px로 바꾼다 (ux:touch-input '포인터 좌표')
const JOY_R = 60;
const joy = { id: null, active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
function joyPoint(e) { const r = $('field').getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; }
function bindJoystick(canvas) {
  canvas.style.touchAction = 'none';
  const el = $('joy'), knob = el.firstElementChild;
  canvas.addEventListener('pointerdown', (e) => {
    if (joy.id !== null || paused) return;
    const p = joyPoint(e);
    joy.id = e.pointerId; joy.active = true; joy.ox = p.x; joy.oy = p.y; joy.dx = 0; joy.dy = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 캡처를 못 해도 이동은 받는다 */ }
    el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
    knob.style.transform = 'translate(-50%, -50%)';
    el.classList.add('on');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    const p = joyPoint(e);
    let dx = p.x - joy.ox, dy = p.y - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > JOY_R) { dx *= JOY_R / d; dy *= JOY_R / d; }
    joy.dx = dx / JOY_R; joy.dy = dy / JOY_R;
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  const end = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.active = false; joy.dx = 0; joy.dy = 0;
    el.classList.remove('on');
    P.wp = null; // 떼면 새 목적지를 골라 다시 돌아다닌다
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}

// 목적지를 바꿔 가며 돌아다니고, 가까운 채소에게서는 멀어진다. 조이스틱을 잡고 있으면 그 방향으로만 간다
function moveHero(dt) {
  if (joy.active) {
    const tx = joy.dx * HERO_SPEED * 1.6, ty = joy.dy * HERO_SPEED * 1.6, a = Math.min(1, dt * 10);
    P.vx += (tx - P.vx) * a; P.vy += (ty - P.vy) * a;
    P.x = Math.max(ROAM.x0, Math.min(ROAM.x1, P.x + P.vx * dt));
    P.y = Math.max(ROAM.y0, Math.min(ROAM.y1, P.y + P.vy * dt));
    return animateHero(dt);
  }
  P.wpT -= dt;
  if (!P.wp || P.wpT <= 0 || Math.hypot(P.wp.x - P.x, P.wp.y - P.y) < 20) {
    P.wp = { x: ROAM.x0 + Math.random() * (ROAM.x1 - ROAM.x0), y: ROAM.y0 + Math.random() * (ROAM.y1 - ROAM.y0) };
    P.wpT = 1.5 + Math.random() * 2;
  }
  let dx = P.wp.x - P.x, dy = P.wp.y - P.y;
  const dl = Math.hypot(dx, dy) || 1;
  let tx = (dx / dl) * HERO_SPEED, ty = (dy / dl) * HERO_SPEED;
  for (const e of enemies) {
    const ex = P.x - e.x, ey = P.y - e.y, d = Math.hypot(ex, ey) || 1;
    // 일반 채소는 아주 가까울 때만 피한다 — 가끔은 붙잡혀서 맞는 장면이 나오게
    const range = e.boss ? 260 : 110;
    if (d < range) {
      const k = ((range - d) / range) * (e.boss ? 320 : 200);
      tx += (ex / d) * k; ty += (ey / d) * k;
    }
  }
  const tl = Math.hypot(tx, ty);
  const maxV = HERO_SPEED * 1.6;
  if (tl > maxV) { tx = (tx / tl) * maxV; ty = (ty / tl) * maxV; }
  const a = Math.min(1, dt * 6);
  P.vx += (tx - P.vx) * a; P.vy += (ty - P.vy) * a;
  P.x = Math.max(ROAM.x0, Math.min(ROAM.x1, P.x + P.vx * dt));
  P.y = Math.max(ROAM.y0, Math.min(ROAM.y1, P.y + P.vy * dt));
  animateHero(dt);
}
function animateHero(dt) {
  // 걷기 연출: 통통 튀기 + 좌우 흔들기, 진행 방향으로 몸을 돌린다
  const sp = Math.hypot(P.vx, P.vy);
  if (Math.abs(P.vx) > 15) P.face = P.vx > 0 ? 1 : -1;
  P.walkT += dt * (6 + sp * 0.06);
  const moving = Math.min(1, sp / 60);
  P.squash += (0 - P.squash) * Math.min(1, dt * 14);
  hero.c.position.set(P.x, P.y);
  hero.body.y = -Math.abs(Math.sin(P.walkT)) * 10 * moving;
  hero.body.rotation = Math.sin(P.walkT) * 0.08 * moving;
  hero.body.scale.set(P.face * (1 + P.squash), 1 - P.squash);
  // 맞았을 때: 빨갛게 번쩍 + 흔들림
  if (P.hitT > 0) { P.hitT -= dt; hero.g.tint = 0xff6a6a; hero.body.x = (Math.random() - 0.5) * 10; }
  else { hero.g.tint = 0xffffff; hero.body.x = 0; }
  hero.gun.x = 34 * P.face;
  hero.gun.y = 30 + hero.body.y;
  // 발: 걸을 때 번갈아 들썩인다
  const step = Math.sin(P.walkT) * moving;
  hero.footL.y = 62 - Math.max(0, step) * 8; hero.footR.y = 62 - Math.max(0, -step) * 8;
  hero.footL.x = -16 + step * 4; hero.footR.x = 16 + step * 4;
  // 눈 깜빡임: 2~5초마다 한 번
  P.blinkT -= dt;
  if (P.blinkT <= 0) P.blinkT = 2 + Math.random() * 3;
  hero.eyes.scale.y = (P.blinkT < 0.12 || P.hitT > 0) ? 0.15 : 1; // 맞으면 질끈 감는다
  // 카메라: 셰프를 화면 가운데보다 조금 아래에 두고 부드럽게 따라간다 (월드 밖은 안 보이게)
  const camTx = Math.max(0, Math.min(WW - FW, P.x - FW / 2));
  const camTy = Math.max(0, Math.min(WH - CH, P.y - FH * 0.6));
  const ca = Math.min(1, dt * 3.5);
  cam.x += (camTx - cam.x) * ca; cam.y += (camTy - cam.y) * ca;
  world.position.set(-Math.round(cam.x), -Math.round(cam.y));
  if (shakeAmp > 0.2) {
    world.position.x += (Math.random() - 0.5) * 2 * shakeAmp;
    world.position.y += (Math.random() - 0.5) * 2 * shakeAmp;
    shakeAmp *= Math.exp(-dt * 10);
  } else shakeAmp = 0;
  // 깊이감: 아래쪽에 있을수록 조금 크게
  const depth = 0.9 + ((P.y - ROAM.y0) / (ROAM.y1 - ROAM.y0)) * 0.15;
  hero.c.scale.set(depth);
}

function update(dt) {
  if (chal) {
    // 스테이지 도전: 제한시간 안에 정해진 수의 적을 모두 잡는다
    chal.t -= dt;
    if (chal.t <= 0) { endChal(false, t('end.timeout')); return; }
    if (chal.horde) updateHorde(dt);
    else if (chal.spawned < CHAL_N && (chal.spawnT -= dt) <= 0) { spawnEnemy(false); chal.spawned++; chal.spawnT = CHAL_GAP; }
  } else if (rush) {
    // 보스 러시: 제한시간 안에 갈수록 강해지는 보스를 계속 잡는다
    rush.t -= dt;
    if (rush.t <= 0) { endRush(t('end.timeout')); return; }
    if (!enemies.some((e) => e.boss)) { rush.next -= dt; if (rush.next <= 0) spawnRushBoss(); }
  } else
  // 웨이브 진행: 웨이브 채소를 다 잡으면 잠깐 쉬고 다음 웨이브 (마지막은 보스를 잡아야 클리어)
  if (wave.warnT > 0) {
    // 보스 경고 중에는 졸개도 멈추고 기다린다
    wave.warnT -= dt;
    if (wave.warnT <= 0) spawnStageBoss();
  } else if (wave.breakT > 0) {
    wave.breakT -= dt;
    if (wave.breakT <= 0) startWave();
  } else {
    const size = waveSize(wave.idx);
    if (wave.spawned < size) {
      wave.spawnT -= dt;
      if (wave.spawnT <= 0) { spawnEnemy(false); wave.spawned++; wave.spawnT = SPAWN_GAP; }
    } else if (!isFinalWave() && wave.kills >= size) {
      wave.idx++; wave.spawned = 0; wave.kills = 0; wave.spawnT = 0.4;
      wave.breakT = WAVE_BREAK;
    }
  }
  // 보스 제한시간은 보스가 나온 순간부터 줄어든다 (2026-10-22 사용자: 멈춰 있다가 줄어드는 게 헷갈림). 걸어 들어오는 시간(BOSS_ENTER_T)은 처음에 더해 둔다
  if (!rush && !chal && wave.bossSpawned && enemies.some((e) => e.boss)) {
    bossT -= dt;
    if (bossT <= 0) { retreat(); return; }
  }

  // 적 이동·근접 공격 — 가장 가까운 셰프·동료에게 붙어서 계속 때린다
  for (const e of [...enemies]) {
    const tgt = pickTarget(e);
    const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy) || 1;
    const reach = e.r + (tgt.hero ? 40 : 24);
    e.atkT -= dt;
    if (d > reach) {
      // 보스는 공격 범위에 들어오기 전까지 빨리 걸어 들어온다 (2026-10-21: 초당 34로 10초쯤 걸려서 너무 늦게 나타났음)
      const sp = e.boss && !e.entered ? BOSS_ENTER_SPEED : e.speed;
      if (e.boss && !e.entered && canAim(e)) e.entered = true;
      e.x += (dx / d) * sp * dt;
      e.y += (dy / d) * sp * dt;
      e.inReach = false;
    } else if (e.boss && !e.inReach) {
      e.inReach = true; e.atkT = Math.max(e.atkT, e.anim ? e.anim.lead : BOSS_WIND); // 막 도착한 보스도 기 모으기부터 보여 준다
    } else if (e.anim && e.anim.mode !== 'attack' && e.atkT <= e.anim.lead && e.atkT > 0) {
      playKingAttack(e); // 애니메이션: 내려치는 프레임이 실제 공격 순간에 맞게 미리 시작
    } else if (e.atkT <= 0) {
      e.atkT = e.boss ? 1.4 : 1.0;
      e.lunge = 0.18; e.lx = dx / d; e.ly = dy / d;
      if (e.boss) bossSlam(e, tgt); // 보스: 내려치기 연출 (피해량·간격은 그대로)
      const dmg = enemyAtk(chal ? chal.st : S.stage) * (e.boss ? 3 : 1) * (chal && chal.horde ? HORDE_ATK : 1);
      if (tgt.hero) { if (hurtHero(dmg)) return; } else hurtMate(tgt.ms, dmg);
    }
    // 때릴 때 상대 쪽으로 확 덤벼든다
    let ox = 0, oy = 0;
    if (e.lunge > 0) { e.lunge -= dt; const k = e.anim && e.anim.mode === 'attack' ? 0 : Math.sin((1 - e.lunge / 0.18) * Math.PI) * (e.boss ? 30 : 18); ox = e.lx * k; oy = e.ly * k; }
    e.c.position.set(e.x + ox, e.y + oy);
    // 통통 뛰며 흔들리는 걸음
    e.wob += dt * (e.boss ? 5 : 9);
    if (e.glow) e.glow.alpha = 0.85 + 0.15 * Math.sin(e.wob * 0.7); // 강한 적 빛이 숨 쉬듯
    const animOn = e.anim && e.anim.mode === 'attack'; // 공격 시트 재생 중에는 그림이 직접 움직이니 코드 움직임을 쉰다
    e.g.rotation = animOn ? 0 : Math.sin(e.wob) * 0.18;
    e.g.y = animOn ? 0 : -Math.abs(Math.sin(e.wob)) * e.r * 0.25;
    e.g.scale.set(1);
    // 보스 공격 연출 (2026-10-21): 때리기 직전 BOSS_WIND초 동안 뒤로 젖히며 위로 늘어나 기를 모으고 → 내려칠 때 납작하게 눌렸다 돌아온다
    if (e.boss && !e.anim) { // 공격 시트가 있는 대왕은 기 모으기·눌림 대신 시트
      if (e.slam > 0) {
        e.slam -= dt; const k = Math.max(0, e.slam / BOSS_SLAM_T);
        e.g.scale.set(1 + 0.2 * k, 1 - 0.18 * k); e.g.y = 0; e.g.rotation = 0;
      } else if (d <= reach && e.atkT < BOSS_WIND) {
        const w = 1 - Math.max(0, e.atkT) / BOSS_WIND, side = dx >= 0 ? 1 : -1;
        e.g.scale.set(1 - 0.08 * w, 1 + 0.16 * w); e.g.rotation = -side * 0.22 * w; e.g.y = -e.r * 0.18 * w;
      }
    }
    // 맞았을 때 (타격감, 2026-10-21): 옆으로 퍼지고 위아래로 눌렸다 돌아오기 + 붉게 번쩍 + 맞은 방향으로 살짝 밀림(보이기만)
    if (e.kb > 0) { e.kb -= dt; const k = Math.max(0, e.kb / HIT_T) * (e.boss ? 6 : 16); e.c.position.x += e.kbx * k; e.c.position.y += e.kby * k; }
    if (e.pop > 0) { e.pop -= dt; e.c.scale.set(1 + e.pop * 1.2); }
    else if (e.hit > 0) { e.hit -= dt; const h = Math.max(0, e.hit) / HIT_T; e.c.scale.set(1 + h * 0.28, 1 - h * 0.2); e.c.tint = h > 0.45 ? 0xff8a8a : 0xffffff; }
    else { e.c.scale.set(1); e.c.tint = 0xffffff; }
    e.bar.scale.set(1 / e.c.scale.x, 1 / e.c.scale.y); // 맞아서 찌그러지거나 뿅 나타날 때도 체력 막대는 크기·자리 고정 (2026-10-21 사용자)
  }

  // 총 발사 — 이번 프레임에 노리는 적 하나 (조준 표시도 이 적에)
  const iv = fireInterval();
  const aim = nearestEnemy();
  updateAim(aim, dt);
  const eqNow = new Set(equippedIdx()); // 장착 3개만 던진다
  S.grid.forEach((L, i) => {
    if (!L || !eqNow.has(i)) return;
    gunTimers[i] -= dt;
    if (gunTimers[i] > 0) return;
    const t = aim;
    if (!t) { gunTimers[i] = 0; return; }
    fire(L, i, t);
    gunTimers[i] = iv * (0.9 + Math.random() * 0.2);
  });

  // 총알 (유도)
  for (let k = bullets.length - 1; k >= 0; k--) {
    const b = bullets[k];
    if (b.target.dead) b.target = nearestEnemy();
    if (!b.target) { b.g.destroy(); bullets.splice(k, 1); continue; }
    const dx = b.target.x - b.x, dy = b.target.y - b.y, d = Math.hypot(dx, dy);
    const step = 1300 * dt;
    if (d <= step + b.target.r * 0.6) {
      const e = b.target;
      e.hp -= (typeof cheat !== 'undefined' && cheat.oneshot) ? e.hp : b.dmg; // 🛠 한 방
      e.hit = HIT_T; e.kb = HIT_T; e.kbx = dx / (d || 1); e.kby = dy / (d || 1);
      const crit = e.boss || b.dmg >= e.max * 0.5;
      // 데미지 숫자는 흰색·초록을 반반 무작위로 (총고식, 2026-10-21) — 얻은 골드는 노랑
      if (S.settings.dmgNum) popText(e.x + (Math.random() - 0.5) * (e.boss ? 120 : 40), Math.max(cam.y + 250 + SAFE_TOP, e.y + e.barY - 18 - Math.random() * 30), fmt(b.dmg), (crit ? (e.boss ? 'crit boss' : 'crit') : '') + (Math.random() < 0.5 ? ' green' : ''));
      if (e.boss) { Sound.play('bossHit'); shake(e.wall ? 2.5 : 1.5); } else Sound.play('hit');
      // 때릴 때마다 코인이 튄다 (연출만 — 골드는 처치할 때 들어온다). 절전모드에서는 그리지 않는다
      // 머리 위(체력 막대 근처)에서 튄다 — 큰 보스 몸이 가려지지 않게 (2026-10-21)
      if (!S.settings.saver && e.hp > 0) coinBurst(e.x - cam.x, e.y - cam.y + (e.boss ? e.barY + 10 : -e.r * 0.5), e.boss ? 2 : Math.random() < 0.5 ? 2 : 1);
      // 타격 불꽃은 매번 (치명타는 크게 + 화면 살짝 흔들림)
      spawnFx('fx_hit', e.x + (Math.random() - 0.5) * e.r * 0.6, e.y - e.r * 0.6, crit ? (e.boss ? 120 : 90) : 54, crit ? 0.25 : 0.16);
      if (crit && !e.boss) shake(1.2);
      b.g.destroy(); bullets.splice(k, 1);
      if (e.hp <= 0) {
        S.gold += e.gold;
        popText(e.x, e.y + 10, '+' + fmt(e.gold), e.boss ? 'gold big' : 'gold');
        coinBurst(e.x - cam.x, e.y - cam.y, e.wall ? 45 : e.boss ? 30 : 7); // 처치하면 코인이 쏟아진다 (2026-10-21: 3·15·25 → 7·30·45)
        spawnFx('fx_poof', e.x, e.y, e.boss ? 220 : 110, e.boss ? 0.6 : 0.4);
        const wasBoss = e.boss;
        if (wasBoss) { Sound.play('coin'); shake(e.wall ? 16 : 10); buzz(40); mission('boss'); }
        if (wasBoss && e.wall && !rush && !S.wallFirst[S.stage]) {
          S.wallFirst[S.stage] = true; // 대왕 첫 처치 다이아는 스테이지 보상(10번째 칸)으로 옮김 (2026-10-22)
        }
        else { Sound.play('kill'); mission('kill'); }
        removeEnemy(e);
        if (rush && wasBoss) rushKill(e);
        else if (wasBoss) { stageClear(); }
        else if (chal && chal.horde) { chal.kills++; chal.gold += e.gold; }
        else if (chal) { chal.kills++; if (chal.kills >= CHAL_N) { endChal(true); return; } }
        else { wave.kills++; }
      } else drawBar(e);
      continue;
    }
    b.x += (dx / d) * step; b.y += (dy / d) * step;
    b.g.position.set(b.x, b.y);
    b.g.rotation += dt * 18;
  }

  // 셰프
  moveHero(dt);
  updateMates(dt);
  bossTalk(dt);
  updateBubble(dt);
  updateCoins(dt);
  updateFx(dt);
  updateShockwaves(dt);
  heroHp = Math.min(heroMax, heroHp + BAL.heroRegen * dt);
  $('vignette').classList.toggle('low', heroHp / heroMax < 0.35);
  $('vignette').classList.toggle('flash', P.hitT > 0);
  hero.hp.set(heroHp / heroMax);
  updateBossBar();

  // 떠오르는 숫자
  for (let k = fxList.length - 1; k >= 0; k--) {
    const f = fxList[k];
    f.life -= dt; f.y += f.vy * dt; f.x += f.vx * dt; f.vx *= 1 - 3 * dt;
    f.el.style.transform = `translate(${(f.x - cam.x).toFixed(1)}px, ${(f.y - cam.y).toFixed(1)}px) translate(-50%, -50%)`;
    f.el.style.opacity = Math.min(1, f.life * 2.5);
    if (f.life <= 0) { f.el.remove(); fxList.splice(k, 1); }
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
}

// ---------- 부팅 ----------
(async () => {
  app = new PIXI.Application();
  await app.init({ width: FW, height: CH, background: '#e9dcc4', resolution: backbufferRes(), autoDensity: true, antialias: false, powerPreference: 'low-power' }); // 발열: 계단 현상 보정 끔(그림은 거의 그대로), 저전력 GPU
  $('field').prepend(app.canvas);
  world = new PIXI.Container();
  field = new PIXI.Container();
  // 손그림 셰프 이미지가 있으면 스킨별 텍스처를 만든다 (없으면 코드로 그린 곰)
  await loadArt();
  try { await buildSkinTextures(); } catch (e) { console.warn('셰프 이미지 없음 — 코드 그림 사용', e); }
  try { outlineArt(); for (const k of SKINS) if (ART[SKIN_ART[k.id]]) skinTex[k.id] = ART[SKIN_ART[k.id]]; } catch (e) { console.warn('외곽선 굽기 실패 — 원래 그림 사용', e); }
  hero = makeHero();
  field.zIndex = -1;
  world.sortableChildren = true; // 셰프·동료는 y값으로 앞뒤를 정한다
  world.addChild(field, hero.c);
  syncChapter(false);
  app.stage.addChild(world);
  fxLayer = new PIXI.Container(); fxLayer.zIndex = 99999; world.addChild(fxLayer);
  aimG = makeAim(); world.addChild(aimG);
  bindJoystick(app.canvas);
  coinLayer = new PIXI.Container(); // 코인은 카메라와 상관없이 화면 좌표로 날아간다
  app.stage.addChild(coinLayer);
  coinTex = ART.icon_coin || makeCoinTexture();
  gemTex = makeGemTexture();
  // 시작할 때 카메라를 셰프 위치에 바로 맞춘다
  cam.x = Math.max(0, Math.min(WW - FW, P.x - FW / 2));
  cam.y = Math.max(0, Math.min(WH - CH, P.y - FH * 0.6));

  buildMenus();
  syncMates();
  resetWave();
  ensureDaily(); buildMissions(); buildShop(); buildPerm(); buildChal();
  applySettings();
  fitUpNames(); document.fonts && document.fonts.ready.then(fitUpNames);
  $('verLabel').textContent = t('settings.version', { ver: GAME_VERSION });
  renderGrid(); updateUI();

  // 처음이면 한 줄 설정, 아니면 자리 비운 동안의 보상
  if (!S.introSeen) tapToStart(() => playPrologue(() => { S.introSeen = true; save(); banner(`STAGE ${S.stage}`, 1.4, 'under'); })); // 처음이면 '눌러서 시작'(소리 허용) → 오프닝 영상 → 바로 게임 시작 (2026-10-22 사용자: 타이틀 팝업 없이)
  else if (!offerOffline(awaySec)) banner(`STAGE ${S.stage}`, 1.4, 'under');
  function showIntro() {
    showModal(`${hasTextArt('ui_logo') ? `<img class="logo" src="${IMG}${textArt('ui_logo')}.webp" alt="${t('game.title')}">` : `<div class="logo-text">${t('game.title')}</div>`}
      <img class="titleart" src="${IMG}ui_title_art.webp" alt="">
      <p>${t('intro.line1')}</p>
      <p class="sub">${t('intro.line2')}</p>`, t('intro.start'), () => { S.introSeen = true; save(); banner(`STAGE ${S.stage}`, 1.4, 'under'); }, null, { x: false });
  }

  const cover = $('bootCover'); if (cover) cover.remove();
  // 진단(치트 빌드): 같은 실행 중에 화면(웹뷰)이 다시 시작됐으면 알려 줌 — PlayForge는 웹뷰가 죽으면 새로 만들고 sessionStorage는 남는다
  try { const navType = (performance.getEntriesByType('navigation')[0] || {}).type; if (sessionStorage.getItem('kw-booted') && navType !== 'reload' && typeof CHEAT_ON !== 'undefined' && CHEAT_ON) setTimeout(() => banner('화면 다시 시작됨 (웹뷰 재시작)', 3), 1500); sessionStorage.setItem('kw-booted', '1'); } catch (e) {} // 준비 끝 — 첫 실행이면 같은 그림의 '눌러서 시작' 화면이 이미 위에 떠 있음

  let uiT = 0, saveT = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(0.1, tk.deltaMS / 1000);
    if (!paused) {
      const steps = (Date.now() < S.boostUntil ? 2 : 1) * (typeof cheat !== 'undefined' ? cheat.speed : 1) * (chal && !chal.horde ? S.chalSpd || 1 : 1); // ⏩ 2배속 · 🛠 치트 속도 · 스테이지 도전 배속
      for (let i = 0; i < steps && !paused; i++) update(dt);
      mission('time', dt);
      autoMergeTick(dt);
    }
    if ((uiT -= dt) <= 0) { uiT = 0.15; updateUI(); }
    if ((saveT -= dt) <= 0) { saveT = 5; save(); }
  });
  // 앱을 내렸다 올렸을 때: 내릴 때 저장하고 소리를 멈춘다. 1분 넘게 비웠으면 그동안의 오프라인 보상을 준다
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); save(); Sound.pause(); return; }
    Sound.resume();
    if (hiddenAt) offerOffline((Date.now() - hiddenAt) / 1000);
    hiddenAt = 0;
  });
  addEventListener('pagehide', save);

  // 디버그: 콘솔에서 resetSave()
  window.resetSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); };
})();
