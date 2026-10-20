// 주방 대전쟁 — 방치형 키우기 프로토타입 (도형만, 에셋 없음)
// 코어 루프: 셰프 곰이 조리도구를 자동으로 던짐 → 썩은 채소 처치 → 골드 → 도구 구매·합성·업그레이드 → 다음 스테이지

const W = 720, H = 1280, FW = 720, FH = 1090;
// 셰프 이동 범위 — 채소가 조리대(위)에서 내려오므로 주방 바닥 아래쪽을 돌아다닌다
const COUNTER_Y = 300;
// 주방(월드)은 화면보다 넓고, 카메라가 셰프를 따라간다
const WW = 1100, WH = 1500;
const ROAM = { x0: 80, x1: WW - 80, y0: 560, y1: WH - 110 };
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

// ---------- 스킨 — 보유만 해도 공격력 보너스(수집 효과), 장착은 겉모습 ----------
// 곰은 그대로, 옷·모자·소품만 바뀐다
const BEAR = { fur: 0x8b5a3c, face: 0x9a6644, inner: 0xd9a27a, muzzle: 0xe8c49a };
const SKINS = [
  { id: 'brown', name: '기본 셰프', apron: 0xf7f7f2, neck: 'scarf', neckColor: 0xd93a3a, hat: 'chef', cost: 0, bonus: 0, look: {} },
  { id: 'pirate', name: '해적 셰프', apron: 0xf7f7f2, stripes: 0xd93a3a, neck: 'scarf', neckColor: 0x2a2a2a, hat: 'pirate', eyepatch: true, cost: 300, bonus: 0.1,
    look: { hat: 0x3a3a44, scarf: 0x2a2a2a, eyepatch: true, skull: true } },
  { id: 'patissier', name: '파티시에', apron: 0xff9ec4, neck: 'bow', neckColor: 0x4aa3df, hat: 'beret', hatColor: 0xd94a6a, cost: 2500, bonus: 0.2,
    look: { hat: 0xff8fb8, coat: 0xffd6e6, scarf: 0x4aa3df } },
  { id: 'santa', name: '산타 셰프', coat: 0xd93a3a, beard: true, neck: 'none', hat: 'santa', cost: 15000, bonus: 0.35,
    look: { hat: 0xd93a3a, coat: 0xd93a3a, scarf: 0xffffff, pom: true } },
  { id: 'ninja', name: '닌자 셰프', gem: 300, cost: 0, bonus: 0.3,
    look: { hat: 0x2a2f45, coat: 0x3a4060, scarf: 0xd93a3a } },
  { id: 'hanbok', name: '한복 셰프', gem: 400, cost: 0, bonus: 0.4, look: {} },
  { id: 'wizard', name: '마법사 셰프', gem: 800, cost: 0, bonus: 0.6, look: {} },
  { id: 'sushi', name: '스시 장인', cost: 600000, bonus: 0.7, look: {} },
  { id: 'pizza', name: '피자 장인', cost: 6000000, bonus: 0.8, look: {} },
  { id: 'barista', name: '바리스타', cost: 60000000, bonus: 0.9, look: {} },
  { id: 'space', name: '우주 셰프', req: 8, cost: 0, bonus: 1.0, look: {} }, // 보스 러시 최고 8마리
  { id: 'king', name: '황금 셰프 킹', apron: 0x2a2a2a, apronTrim: 0xffd34d, cape: 0xb02a3a, neck: 'scarf', neckColor: 0xffd34d, hat: 'crown', cost: 120000, bonus: 0.6,
    look: { hat: 0xffd34d, coat: 0x34343c, scarf: 0xffd34d, gems: true } },
];
// 예전 저장본(곰 종류 스킨) id를 의상 스킨으로 옮긴다
const OLD_SKIN_IDS = { panda: 'pirate', polar: 'patissier', honey: 'santa' };
const skinById = (id) => SKINS.find((k) => k.id === id) || SKINS[0];
const skinBonus = () => SKINS.reduce((a, k) => a + (S.skins.includes(k.id) ? k.bonus : 0), 0);

// ---------- 동료 — 셰프를 따라다니며 각자 던진다 ----------
const mateStat = (id) => { const [dmg, iv, cost] = BAL.mates[id]; return { dmg, iv, cost }; };
const MATES = [
  { id: 'chick', name: '병아리 조수', icon: '🐥', desc: '달걀을 던져요', proj: 'egg', ...mateStat('chick') },
  { id: 'bunny', name: '토끼 파티시에', icon: '🐰', desc: '마카롱을 던져요', proj: 'macaron', ...mateStat('bunny') },
  { id: 'penguin', name: '펭귄 바리스타', icon: '🐧', desc: '원두를 연사해요', proj: 'bean', ...mateStat('penguin') },
  { id: 'squirrel', name: '다람쥐 제빵사', icon: '🐿️', desc: '갓 구운 크루아상을 던져요', proj: 'croissant', ...mateStat('squirrel') },
  { id: 'fox', name: '여우 소스 셰프', icon: '🦊', desc: '케첩 방울을 톡톡 쏴요', proj: 'ketchup', ...mateStat('fox') },
  { id: 'panda', name: '판다 만두 장인', icon: '🐼', desc: '뜨거운 만두를 던져요', proj: 'dumpling', ...mateStat('panda') },
  { id: 'frog', name: '개구리 설거지 담당', icon: '🐸', desc: '비눗방울로 깨끗하게', proj: 'bubble', ...mateStat('frog') },
];
const MATE_SPOTS = [{ x: -115, y: 25 }, { x: 115, y: 25 }, { x: 0, y: 110 }, { x: -205, y: 85 }, { x: 205, y: 85 }, { x: -115, y: 160 }, { x: 115, y: 160 }];
const mateLv = (m) => S.mates[m.id] || 0;
const mateDmg = (m, lv = mateLv(m)) => m.dmg * Math.pow(BAL.mateG, lv - 1) * atkMul() * baseMateMul(); // 🏠 요리 학교
const mateCost = (m) => Math.ceil(m.cost * Math.pow(BAL.mateCostG, mateLv(m)));
// 일일 미션 — 매일 3개, 자정에 바뀐다. 5~10분 플레이로 끝낼 수 있는 양
const MISSIONS = [
  { id: 'kill', text: '썩은 채소 150마리 처치', n: 150 },
  { id: 'boss', text: '보스 3마리 처치', n: 3 },
  { id: 'merge', text: '도구 합성 8번', n: 8 },
  { id: 'upgrade', text: '공격력·공격 속도 업그레이드 10번', n: 10 },
  { id: 'stage', text: '스테이지 5번 클리어', n: 5 },
  { id: 'mate', text: '동료 고용·강화 3번', n: 3 },
  { id: 'time', text: '10분 동안 주방 지키기', n: 600 },
  { id: 'rush', text: '보스 러시 도전 1번', n: 1 },
];
const BOSS_LINES = ['눈물 좀 흘리게 해주지!', '나를 썰 수 있을까?', '이 주방은 이제 우리 거다!', '썩은 게 아니라 숙성된 거다!'];

// ---------- 밸런스 ----------
const gunDmg = (L) => BAL.toolBase * Math.pow(BAL.toolMerge, L - 1);
// 벽: 10스테이지마다 강한 보스
const WALL_EVERY = BAL.wallEvery, WALL_HP = BAL.wallHp, WALL_TIME = BAL.wallTime;
const isWallStage = (st) => st % WALL_EVERY === 0;
// 환생: STAGE BAL.prestigeMin부터, 셰프 별 1개당 공격력·골드 +BAL.starStep (balance.js)
const PRESTIGE_MIN = BAL.prestigeMin;
const starsFor = (st) => st < PRESTIGE_MIN ? 0 : Math.floor(Math.pow(st - BAL.starFrom, BAL.starPow) / BAL.starDiv);
const starMul = () => 1 + BAL.starStep * S.stars;
const atkMul = () => (1 + BAL.atkStep * S.atkLv) * (1 + skinBonus()) * starMul() * baseAtkMul(); // baseAtkMul: 🏠 조리대 (base.js)
const spdMul = () => Math.min(BAL.spdMax, 1 + BAL.spdStep * S.spdLv);
const fireInterval = () => BAL.fireBase / spdMul();
const costAtk = () => Math.ceil(BAL.atkCost * Math.pow(BAL.atkCostG, S.atkLv));
const costSpd = () => Math.ceil(BAL.spdCost * Math.pow(BAL.spdCostG, S.spdLv));
const goldMul = () => 1 + BAL.goldStep * S.goldLv;                          // 골드 획득량
const costGold = () => Math.ceil(BAL.goldCost * Math.pow(BAL.goldCostG, S.goldLv));
const costBuy = () => Math.ceil(BAL.buyCost * Math.pow(BAL.buyCostG, S.buys));
const enemyHp = (st) => Math.ceil(BAL.hpBase * Math.pow(BAL.hpG, st - 1) * (BAL.earlyEase[st - 1] || 1));
const enemyAtk = (st) => BAL.atkBase + st * BAL.atkPerStage; // 채소 한 대 공격력 (보스는 3배)
const mateMaxHp = (m, lv = mateLv(m)) => 50 * (1 + 0.35 * (lv - 1)) * baseMateMul();
const enemyGold = (st) => Math.ceil(BAL.goldBase * Math.pow(BAL.goldG, st - 1));
const PALETTE = ['#9aa5b1', '#6cc070', '#4aa3df', '#a66cff', '#ff8c42', '#ff4d6d', '#ffd34d', '#3ee6c4'];
const gunColor = (L) => PALETTE[(L - 1) % PALETTE.length];
// 레벨별 조리도구 — 8단계 이후는 '전설' 단계로 이어진다
const TOOLS = [['🥄', '숟가락'], ['🍴', '포크'], ['🥢', '젓가락'], ['🔪', '식칼'], ['🧂', '소금통'], ['🍳', '프라이팬'], ['🍲', '냄비'], ['🫖', '주전자']];
const toolIcon = (L) => TOOLS[Math.min(L, TOOLS.length) - 1][0];
const toolName = (L) => L <= TOOLS.length ? TOOLS[L - 1][1] : `전설 ${TOOLS[TOOLS.length - 1][1]} +${L - TOOLS.length}`;
const VEGGIES = ['tomato', 'carrot', 'broccoli'];

// ---------- 상태 ----------
function freshState() {
  return { gold: BAL.startGold, stage: 1, atkLv: 0, spdLv: 0, buys: 0, grid: [1, ...Array(SLOTS - 1).fill(0)],
    skin: 'brown', skins: ['brown'], mates: {}, introSeen: false, lastSeen: Date.now(),
    stars: 0, prestiges: 0, sound: true, daily: null, goldLv: 0,
    gems: 0, wallFirst: {}, shop: { slots: 0, autoMerge: false, offline12: false }, boostUntil: 0, rush: null, rushBest: 0,
    settings: { sfx: true, music: true, vibrate: true, dmgNum: true, shake: true, saver: false } };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    // 예전 저장본에 없는 필드는 기본값으로 채운다
    if (s && Array.isArray(s.grid) && s.grid.length >= SLOTS && s.grid.length <= MAX_SLOTS) {
      const st = Object.assign(freshState(), s);
      st.settings = Object.assign(freshState().settings, s.settings || {});
      if (s.sound === false && !s.settings) { st.settings.sfx = false; st.settings.music = false; } // 예전 소리 버튼 설정 이어받기
      st.skins = [...new Set(st.skins.map((id) => OLD_SKIN_IDS[id] || id))];
      st.skin = OLD_SKIN_IDS[st.skin] || st.skin;
      return st;
    }
  } catch (e) { /* 저장소 없음 */ }
  return null;
}
function save() {
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
function backbufferRes() { return Math.min(S.settings.saver ? 1.25 : 3, Math.max(1, (window.devicePixelRatio || 1) * scale)); }
function fit() {
  scale = Math.min(innerWidth / W, innerHeight / H);
  shell.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
  // 셸을 CSS로 확대하므로 백버퍼는 기기 픽셀 비율 × 셸 배율로 키운다 (ux:runtime-resize#c3)
  if (app) {
    const r = backbufferRes();
    if (Math.abs(app.renderer.resolution - r) > 0.01) app.renderer.resize(FW, FH, r);
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
const icon = (key, alt = '') => `<img class="ic" src="${IMG}${key}.webp" alt="${alt}">`;
const SKIN_ART = { brown: 'hero_chef', pirate: 'hero_pirate', patissier: 'hero_patissier', santa: 'hero_santa', king: 'hero_king',
  ninja: 'hero_ninja', hanbok: 'hero_hanbok', wizard: 'hero_wizard', sushi: 'hero_sushi', pizza: 'hero_pizza', barista: 'hero_barista', space: 'hero_space' };
const ART_KEYS = ['bg_floor_tile', 'bg_wall', 'prop_shelf', 'prop_window', 'prop_utensil_rack', 'prop_rug', 'prop_flour', 'prop_onion_peel', 'prop_board',
  'enemy_tomato', 'enemy_carrot', 'enemy_broccoli', 'boss_onion', 'mate_chick', 'mate_bunny', 'mate_penguin',
  'proj_egg', 'proj_macaron', 'proj_bean', 'fx_hit', 'fx_poof', 'fx_stun', 'icon_coin',
  'hero_chef', 'hero_pirate', 'hero_patissier', 'hero_santa', 'hero_king', ...TOOL_ART.map((_, i) => toolKey(i + 1))];
const ART = {};
const AVAIL = new Set(); // manifest에 있는 그림 이름 (HTML에서만 쓰는 UI·아이콘은 여기서 있는지만 확인)
// 전장(PixiJS)에 그리는 그림만 텍스처로 올린다 — UI·아이콘은 HTML <img>가 필요할 때 받는다
const PIXI_ART = /^(bg_|prop_|enemy_|boss_|mate_|proj_|fx_|hero_|tool_|icon_coin$)/;
// assets/img/manifest.json (tools/convert_assets.py 가 만든다)에 있는 그림만 불러온다 — 없는 그림은 임시 그림으로
async function loadArt() {
  let keys = ART_KEYS;
  try { keys = await (await fetch(IMG + 'manifest.json', { cache: 'no-store' })).json(); } catch (e) { /* 목록이 없으면 기본 목록 */ }
  keys.forEach((k) => AVAIL.add(k));
  await Promise.all(keys.filter((k) => PIXI_ART.test(k)).map(async (k) => {
    try { ART[k] = await PIXI.Assets.load(IMG + k + '.webp'); } catch (e) { console.warn('이미지 없음 — 코드 그림 사용:', k); }
  }));
}
// 그림 한 장: 지정 높이로 맞추고 기준점(기본: 발밑 가운데)을 둔다
function artSprite(key, h, ay = 1) {
  const sp = new PIXI.Sprite(ART[key]);
  sp.anchor.set(0.5, ay);
  sp.scale.set(h / sp.texture.height);
  return sp;
}

// ---------- 챕터: 10스테이지마다 장소·적·보스가 바뀐다 ----------
// 그림이 아직 없는 챕터는 주방 그림에 장소 색(tint)을 입혀 임시로 보여준다
const CHAPTERS = [
  { id: 'kitchen', name: '주방', icon: '🍳', enemies: ['tomato', 'carrot', 'broccoli'], boss: 'onion', tint: 0xffffff },
  { id: 'fridge', name: '냉장고 안', icon: '🧊', enemies: ['cheese', 'milk', 'jelly'], boss: 'cake', tint: 0xd8ecff,
    props: ['milk', 'eggs', 'ice', 'pudding'] },
  { id: 'pantry', name: '식료품 창고', icon: '📦', enemies: ['potato', 'garlic', 'mushroom'], boss: 'potato', tint: 0xf2dcc0,
    props: ['flour_sack', 'onion_basket', 'crate', 'garlic'] },
  { id: 'hall', name: '레스토랑 홀', icon: '🍽️', enemies: ['steak', 'noodle', 'shrimp'], boss: 'turkey', tint: 0xf8d2d2,
    props: ['table', 'candle', 'menu', 'cart'] },
  { id: 'bakery', name: '빵집', icon: '🥐', enemies: ['bread', 'donut', 'croissant'], boss: 'baguette', tint: 0xfff2c8,
    props: ['bread_shelf', 'oven', 'cake_stand', 'dough_table'] },
];
const ARENA = { id: 'arena', name: '결투장', icon: '🔥', tint: 0xb06060 };
const chapterIdx = (st) => Math.floor((st - 1) / 10) % CHAPTERS.length;
const chapterOf = (st) => CHAPTERS[chapterIdx(st)];
// 적 그림: 그 챕터 그림이 있으면 그것, 없으면 주방 적을 장소 색으로 칠해 대신
function enemyArt(ch, boss, i) {
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
  floor.tileScale.set(160 / 512); // 타일 2×2칸 = 160 디자인 px
  floor.y = WALL_H - 20;
  const wall = new PIXI.Sprite(own ? ART[wk] : ART.bg_wall);
  wall.width = WW; wall.height = WALL_H;
  if (!own) { floor.tint = ch.tint; wall.tint = ch.tint; } // 그림이 오기 전 임시 색
  c.addChild(floor, wall);
  const put = (key, x, y, w, ay = 0.5) => {
    if (!ART[key]) return;
    const sp = new PIXI.Sprite(ART[key]); sp.anchor.set(0.5, ay);
    sp.scale.set(w / sp.texture.width); sp.position.set(x, y); c.addChild(sp);
  };
  if (!kitchen) {
    // 챕터 소품: 벽에 2개, 바닥에 2개 (그림이 있는 것만)
    const spots = [[190, 150, 260], [830, 140, 220], [520, 820, 260], [160, 1150, 180]];
    (ch.props || []).forEach((name, i) => { const sp = spots[i]; if (sp) put(`prop_${ch.id}_${name}`, sp[0], sp[1], sp[2]); });
    return c;
  }
  // 벽 장식
  put('prop_utensil_rack', 470, 120, 190);
  put('prop_shelf', 190, 150, 270);
  put('prop_window', 830, 125, 220);
  // 바닥 소품 — 카메라 이동이 눈에 띄게 흩어 둔다
  put('prop_rug', 520, 820, 300);
  put('prop_board', 130, 640, 140);
  put('prop_flour', 190, 1170, 150);
  put('prop_onion_peel', 900, 1050, 90);
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

  const hpBg = new PIXI.Graphics().roundRect(-46, 82, 92, 10, 5).fill({ color: 0x000000, alpha: 0.4 });
  const hp = new PIXI.Graphics();
  c.addChild(hpBg, hp);
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
  const hpBg = new PIXI.Graphics().roundRect(-46, 82, 92, 10, 5).fill({ color: 0x000000, alpha: 0.4 });
  const hp = new PIXI.Graphics();
  c.addChild(hpBg, hp);
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
  span.textContent = text;
  el.appendChild(span);
  el.style.left = x - cam.x + 'px';
  el.style.top = y - cam.y + 'px';
  fxEl.appendChild(el);
  const big = /crit|big/.test(cls || '');
  fxList.push({ el, x, y, life: big ? 1.0 : 0.85, vy: big ? -95 : -80, vx: (Math.random() - 0.5) * 50 });
}

// ---------- 손그림 효과: 뿅 커졌다 사라진다 (월드 좌표) ----------
const fxSprites = [];
let fxLayer = null;
function spawnFx(key, x, y, size, life) {
  if (!ART[key] || !fxLayer || fxSprites.length > 40) return;
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
function coinBurst(sx, sy, n, kind = 'gold') {
  if (!coinTex) return;
  for (let i = 0; i < n && coins.length < 140; i++) {
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
function banner(html, t = 1.4) {
  $('banner').innerHTML = html;
  $('banner').classList.add('show');
  bannerT = t;
}

function renderGrid(popIdx = -1) {
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateRows = `repeat(${S.grid.length / 4}, 1fr)`;
  S.grid.forEach((L, i) => {
    const s = document.createElement('div');
    s.className = 'slot';
    s.dataset.i = i;
    if (L) {
      const g = document.createElement('div');
      g.className = 'gun' + (i === popIdx ? ' pop' : '');
      if (i === popIdx) { const fx = document.createElement('img'); fx.className = 'mergefx'; fx.src = IMG + 'fx_merge.webp'; s.appendChild(fx); }
      g.style.background = gunColor(L);
      g.innerHTML = `<span class="ico"><img src="${toolImg(L)}" alt="${toolIcon(L)}"></span><span class="glv">Lv ${L} ${toolName(L)}</span><span class="gdmg">⚔ ${fmt(gunDmg(L) * atkMul())}</span>`;
      s.appendChild(g);
    }
    gridEl.appendChild(s);
  });
}

function dps() {
  const tools = S.grid.reduce((a, L) => a + (L ? gunDmg(L) : 0), 0) * atkMul() / fireInterval();
  return MATES.reduce((a, m) => a + (mateLv(m) ? mateDmg(m) / m.iv : 0), tools);
}

// ---------- 동료·스킨 목록 (한 번 만들고 값만 갱신) ----------
function buildMenus() {
  $('mateList').innerHTML = MATES.map((m) => `
    <div class="row" data-mate="${m.id}">
      <span class="big"><img src="${IMG}mate_${m.id}.webp" alt="${m.icon}"></span>
      <div class="info"><b>${m.name}</b><span class="desc">${m.desc}</span><span class="stat"></span></div>
      <button class="act"></button>
    </div>`).join('');
  $('skinList').innerHTML = SKINS.map((k) => {
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    return `
    <div class="skin" data-skin="${k.id}">
      ${skinThumb[k.id] ? `<img class="thumb" src="${skinThumb[k.id]}" alt="">` : `<div class="mini hat-${k.hat} ${k.eyepatch ? 'eyepatch' : ''} ${k.beard ? 'beard' : ''}" style="--fur:${hex(BEAR.fur)};--face:${hex(BEAR.face)};--muz:${hex(BEAR.muzzle)};--hat:${hex(k.hatColor || 0xffffff)};--outfit:${hex(k.coat || k.apron)};--neck:${hex(k.neckColor || k.coat || 0)}">
        <i class="body"></i><i class="ear l"></i><i class="ear r"></i><i class="head"></i><i class="eye l"></i><i class="eye r"></i><i class="muz"></i><i class="beard"></i><i class="nose"></i><i class="hat"></i><i class="pom"></i>
      </div>`}
      <b>${k.name}</b>
      <span class="desc">${k.bonus ? `보유 효과 공격력 +${Math.round(k.bonus * 100)}%` : '기본 스킨'}</span>
      <button class="act"></button>
    </div>`;
  }).join('');
  $('mateList').onclick = (e) => {
    const row = e.target.closest('.act') && e.target.closest('.row');
    if (!row) return;
    const m = MATES.find((x) => x.id === row.dataset.mate), c = mateCost(m);
    if (S.gold < c) return;
    S.gold -= c; S.mates[m.id] = mateLv(m) + 1;
    Sound.play('buy'); mission('mate');
    if (S.mates[m.id] === 1) banner(`${m.icon} ${m.name} 합류!`, 1.2);
    syncMates(); updateUI();
  };
  $('skinList').onclick = (e) => {
    const card = e.target.closest('.act') && e.target.closest('.skin');
    if (!card) return;
    const k = skinById(card.dataset.skin);
    if (!S.skins.includes(k.id)) {
      if (k.req) { if ((S.rushBest || 0) < k.req) return; }
      else if (k.gem) { if (S.gems < k.gem) return; S.gems -= k.gem; }
      else { if (S.gold < k.cost) return; S.gold -= k.cost; }
      S.skins.push(k.id);
      Sound.play('claim');
    }
    S.skin = k.id;
    drawHero(hero, k);
    renderGrid(); updateUI();
  };
}

function updateMenus() {
  let mateReady = false, skinReady = false;
  document.querySelectorAll('#mateList .row').forEach((row) => {
    const m = MATES.find((x) => x.id === row.dataset.mate), lv = mateLv(m), c = mateCost(m);
    row.querySelector('.stat').textContent = lv
      ? `Lv ${lv} · ⚔ ${fmt(mateDmg(m))} / ${m.iv}초 · ❤ ${fmt(mateMaxHp(m))}  →  다음 ⚔ ${fmt(mateDmg(m, lv + 1))}`
      : `⚔ ${fmt(mateDmg(m, 1))} / ${m.iv}초 · ❤ ${fmt(mateMaxHp(m, 1))}`;
    const b = row.querySelector('.act');
    b.innerHTML = `${lv ? '강화' : '고용'}<span class="cost">${COIN} ${fmt(c)}</span>`;
    b.disabled = S.gold < c;
    row.classList.toggle('locked', !lv);
    if (!lv && S.gold >= c) mateReady = true;
  });
  document.querySelectorAll('#skinList .skin').forEach((card) => {
    const k = skinById(card.dataset.skin), own = S.skins.includes(k.id), on = S.skin === k.id;
    const b = card.querySelector('.act');
    const can = k.req ? (S.rushBest || 0) >= k.req : k.gem ? S.gems >= k.gem : S.gold >= k.cost;
    b.innerHTML = on ? '장착 중' : own ? '장착'
      : k.req ? (can ? '받기<span class="cost">러시 기록 달성!</span>' : `${icon('icon_lock')}<span class="cost">러시 ${k.req}마리 (최고 ${S.rushBest || 0})</span>`)
      : `구매<span class="cost">${k.gem ? GEM + ' ' + k.gem : COIN + ' ' + fmt(k.cost)}</span>`;
    b.disabled = on || (!own && !can);
    card.classList.toggle('on', on);
    card.classList.toggle('locked', !own);
    if (!own && !k.gem && can) skinReady = true;
  });
  $('skinBonus').textContent = `모은 스킨 ${S.skins.length}/${SKINS.length} · 보유 효과 공격력 +${Math.round(skinBonus() * 100)}%`;
  return { mateReady, skinReady, missionReady: updateMissions(), prestigeReady: updatePrestige() };
}

function updateUI() {
  const bossOn = wave.bossSpawned && enemies.some((e) => e.boss);
  const wall = isWallStage(S.stage);
  if (rush) {
    $('stageLabel').textContent = '⚔️ 보스 러시';
    $('chapterLabel').textContent = '🔥 결투장';
    $('bossTimer').classList.add('on');
    $('bossTimer').innerHTML = `⏱ ${Math.ceil(rush.t)} · 처치 ${rush.kills} · ${GEM} ${rush.gems}`;
  } else {
    $('stageLabel').textContent = `${wall ? '🔥 ' : ''}Stage ${S.stage}-${wave.idx + 1}`;
    const ch = chapterOf(S.stage);
    $('chapterLabel').innerHTML = `${AVAIL.has('icon_chapter_' + ch.id) ? icon('icon_chapter_' + ch.id, ch.icon) : ch.icon} ${ch.name}`;
    $('bossTimer').classList.toggle('on', bossOn);
    if (bossOn) $('bossTimer').textContent = `${wall ? '🔥 강한 보스' : '👑 보스'} ⏱ ${Math.ceil(bossT)}`;
  }
  $('gemLabel').innerHTML = GEM + ' ' + fmt(S.gems);
  const boostLeft = (S.boostUntil - Date.now()) / 1000;
  $('boostPill').classList.toggle('on', boostLeft > 0);
  if (boostLeft > 0) $('boostPill').textContent = `⏩ 2배속 ${Math.floor(boostLeft / 60)}:${String(Math.floor(boostLeft % 60)).padStart(2, '0')}`;
  const mr = $('gemLabel').getBoundingClientRect(), fr0 = $('field').getBoundingClientRect();
  gemTarget = { x: (mr.left - fr0.left + 26 * scale) / scale, y: (mr.top - fr0.top + mr.height / 2) / scale };
  $('goldLabel').innerHTML = COIN + ' ' + fmt(S.gold);
  const gr = $('goldLabel').getBoundingClientRect(), fr = $('field').getBoundingClientRect();
  goldTarget = { x: (gr.left - fr.left + 26 * scale) / scale, y: (gr.top - fr.top + gr.height / 2) / scale };
  $('dpsLabel').textContent = 'DPS ' + fmt(dps());
  // 스테이지 전체 진행도: 끝난 웨이브 + 현재 웨이브 진행 (마지막 웨이브는 보스 체력을 깎은 만큼)
  const boss = enemies.find((e) => e.boss);
  const cur = isFinalWave() ? (boss ? 1 - Math.max(0, boss.hp) / boss.max : 0) : Math.min(1, wave.kills / waveSize(wave.idx));
  const pct = Math.min(1, (wave.idx + cur) / wave.total);
  // 보스 러시 중에는 맨 위 바가 남은 시간을 보여주고 웨이브 트랙은 숨긴다
  const topV = rush ? Math.min(1, rush.t / RUSH_TIME) : pct;
  $('topFill').style.width = topV * 100 + '%';
  $('topPct').textContent = rush ? `${Math.ceil(rush.t)}초` : Math.floor(pct * 100) + '%';
  $('track').style.visibility = rush ? 'hidden' : '';
  // 트랙: 22px 여백 안쪽에 웨이브 점을 고르게, 마지막 점은 보스
  const W = $('track').clientWidth - 44, at = (f) => 22 + f * W;
  $('trackFill').style.width = pct * 100 + '%';
  const key = `${S.stage}:${wave.idx}:${wave.total}`;
  if ($('trackNodes').dataset.key !== key) {
    $('trackNodes').dataset.key = key;
    $('trackNodes').innerHTML = Array.from({ length: wave.total }, (_, i) => {
      const last = i === wave.total - 1;
      return `<i class="${i < wave.idx ? 'done' : ''} ${last ? 'boss' + (wall ? ' wall' : '') : ''}" style="left:${at((i + 1) / wave.total)}px">${last ? `<img src="${IMG}icon_boss.webp" alt="">` : ''}</i>`;
    }).join('');
  }
  $('trackHero').style.left = at(pct) + 'px';
  const thumb = skinThumb[S.skin];
  if (thumb && $('trackHeroImg').dataset.skin !== S.skin) { $('trackHeroImg').src = thumb; $('trackHeroImg').dataset.skin = S.skin; }
  const atk = $('btnAtk'), spd = $('btnSpd'), gld = $('btnGold'), buy = $('btnBuy');
  atk.querySelector('.lv').textContent = `Lv.${S.atkLv}`;
  atk.querySelector('.val').textContent = `x${(1 + BAL.atkStep * S.atkLv).toFixed(2)}`;
  atk.querySelector('.cost').innerHTML = COIN + ' ' + fmt(costAtk());
  atk.disabled = S.gold < costAtk();
  const spdMax = spdMul() >= 3;
  spd.querySelector('.lv').textContent = `Lv.${S.spdLv}`;
  spd.querySelector('.val').textContent = `x${spdMul().toFixed(2)}`;
  spd.querySelector('.cost').innerHTML = spdMax ? 'MAX' : COIN + ' ' + fmt(costSpd());
  spd.disabled = spdMax || S.gold < costSpd();
  gld.querySelector('.lv').textContent = `Lv.${S.goldLv}`;
  gld.querySelector('.val').textContent = `x${goldMul().toFixed(2)}`;
  gld.querySelector('.cost').innerHTML = COIN + ' ' + fmt(costGold());
  gld.disabled = S.gold < costGold();
  const full = !S.grid.includes(0);
  buy.querySelector('.cost').innerHTML = full ? '칸이 가득 찼어요 — 합성하세요' : COIN + ' ' + fmt(costBuy());
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

// 모달 — 타이틀·오프라인 보상. 떠 있는 동안 게임을 멈춘다
function showModal(html, btn, onOk, cancelText) {
  paused = true;
  $('modalBody').innerHTML = html;
  $('modalBtn').textContent = btn;
  $('modal').classList.remove('hidden');
  const close = () => { $('modal').classList.add('hidden'); paused = false; };
  $('modalBtn').onclick = () => { close(); Sound.unlock(); onOk && onOk(); };
  $('modalCancel').classList.toggle('hidden', !cancelText);
  $('modalCancel').textContent = cancelText || '';
  $('modalCancel').onclick = close;
}
// 자리 비운 동안의 보상 (처음 켤 때와 앱을 다시 올렸을 때). 보상을 띄웠으면 true
function offerOffline(away) {
  if (away < 60) return false;
  const sec = Math.min(away, offlineCap());
  const earned = Math.floor(offlineGoldPerSec() * sec);
  if (earned <= 0) return false;
  const take = () => { S.gold += earned; popText(P.x, P.y - 130, '+' + fmt(earned), 'gold big'); coinBurst(FW / 2, FH * 0.5, 30); save(); };
  // 다른 창이 떠 있으면 창을 덮지 않고 바로 받는다
  if (!$('modal').classList.contains('hidden')) { take(); return true; }
  showModal(`<div class="title small">다녀오셨어요!</div>
    <p>자리 비운 <b>${fmtTime(sec)}</b> 동안<br>셰프 곰이 주방을 지켰어요</p>
    <div class="reward">${COIN} ${fmt(earned)}</div>
    ${away > offlineCap() ? `<p class="sub">오프라인 보상은 최대 ${offlineCap() / 3600}시간까지 쌓여요</p>` : ''}`,
    '받기', take);
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
    // 취소가 있으면 취소, 없으면(보상·안내) 확인 버튼과 같다
    ($('modalCancel').classList.contains('hidden') ? $('modalBtn') : $('modalCancel')).click();
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
  banner('<small>뒤로 버튼을 한 번 더 누르면 게임이 꺼져요</small>', 1.8);
  clearTimeout(exitT);
  exitT = setTimeout(armBack, 2000);
});
// 터치 없이 쌓은 이력은 브라우저가 뒤로가기에서 건너뛴다 → 첫 터치 때 쌓고, 빠져 있으면 다음 터치에서 다시 쌓는다
addEventListener('pointerdown', armBack);
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTopLayer(); });

function offlineGoldPerSec() {
  const killsPerSec = Math.min(dps() / enemyHp(S.stage), 1 / (SPAWN_GAP + 0.2));
  return killsPerSec * enemyGold(S.stage) * starMul() * goldMul() * OFFLINE_RATE;
}
const fmtTime = (sec) => sec >= 3600 ? `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분` : `${Math.max(1, Math.floor(sec / 60))}분`;

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
  gemBurst(FW / 2, FH * 0.55, 5);
  popText(P.x, P.y - 140, '+' + fmt(g), 'gold big'); Sound.play('claim');
  coinBurst(FW / 2, FH * 0.55, 18);
  updateUI(); save();
};
$('btnBonus').onclick = () => {
  if (!S.daily || S.daily.bonus || !S.daily.ids.every((id) => S.daily.claimed[id])) return;
  S.daily.bonus = true; S.stars += 1; S.gems += 20;
  gemBurst(FW / 2, FH * 0.55, 12);
  banner(`⭐ 셰프 별 +1<small>공격력·골드가 영원히 ${Math.round(BAL.starStep * 100)}% 올랐어요</small>`, 2);
  Sound.play('prestige'); renderGrid(); updateUI(); save();
};
function updateMissions() {
  ensureDaily();
  let ready = false;
  document.querySelectorAll('#missionList .mission').forEach((row) => {
    const id = row.dataset.mid, m = MISSIONS.find((x) => x.id === id);
    const p = Math.min(m.n, Math.floor(S.daily.prog[id] || 0)), done = p >= m.n, got = !!S.daily.claimed[id];
    row.querySelector('.stat').textContent = id === 'time' ? `${Math.floor(p / 60)}분 / ${m.n / 60}분` : `${p} / ${m.n}`;
    row.querySelector('.bar2 i').style.width = (p / m.n) * 100 + '%';
    const b = row.querySelector('.act');
    b.innerHTML = got ? '받음' : done ? `받기<span class="cost">${COIN} ${fmt(missionGold())} · ${GEM} 5</span>` : '진행 중';
    b.disabled = got || !done;
    b.classList.toggle('claimed', got);
    row.classList.toggle('done', got);
    if (done && !got) ready = true;
  });
  const all = S.daily.ids.every((id) => S.daily.claimed[id]);
  const bb = $('btnBonus');
  bb.innerHTML = S.daily.bonus ? '받음' : `받기<span class="cost">${STAR} 1 · ${GEM} 20</span>`;
  bb.disabled = S.daily.bonus || !all;
  bb.classList.toggle('claimed', S.daily.bonus);
  if (all && !S.daily.bonus) ready = true;
  // 자정까지 남은 시간
  const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const left = Math.max(0, (mid - now) / 1000);
  $('missionHint').textContent = `오늘의 미션 · ${Math.floor(left / 3600)}시간 ${Math.floor((left % 3600) / 60)}분 뒤 새 미션`;
  return ready;
}

// ---------- 환생 ----------
function updatePrestige() {
  const gain = starsFor(S.stage);
  $('starNow').innerHTML = `${STAR} ${S.stars}`;
  $('starBonus').textContent = `셰프 별 효과: 공격력·골드 +${Math.round(S.stars * BAL.starStep * 100)}%` + (S.prestiges ? ` · 환생 ${S.prestiges}회` : '');
  const b = $('btnPrestige');
  if (S.stage < PRESTIGE_MIN) {
    $('starGain').textContent = `STAGE ${PRESTIGE_MIN}부터 환생할 수 있어요 (지금 ${S.stage})`;
    b.textContent = '환생하기'; b.disabled = true;
  } else {
    $('starGain').textContent = `지금 환생하면 ⭐ +${gain} → 공격력·골드 +${Math.round((S.stars + gain) * BAL.starStep * 100)}%`;
    b.textContent = `환생하기 (⭐ +${gain})`; b.disabled = gain < 1;
  }
  // 받을 별이 지금 가진 별의 절반 이상이면 알림
  return S.stage >= PRESTIGE_MIN && gain >= Math.max(3, Math.ceil(S.stars * 0.5));
}
$('btnPrestige').onclick = () => {
  const gain = starsFor(S.stage);
  if (gain < 1) return;
  showModal(`<div class="title small">⭐ 환생</div>
    <p>STAGE ${S.stage}에서 환생하면<br><b>셰프 별 ${gain}개</b>를 받아요</p>
    <p class="sub">스테이지·골드·업그레이드·도구는 처음으로 돌아가요.<br>스킨은 그대로, 동료는 Lv 1로 남아요.</p>`,
    '환생하기', () => {
      S.stars += gain; S.prestiges++;
      S.stage = 1; S.gold = BAL.startGold; S.atkLv = 0; S.spdLv = 0; S.goldLv = 0; S.buys = 0;
      S.grid = [1, ...Array(gridSize() - 1).fill(0)];
      for (const id in S.mates) if (S.mates[id]) S.mates[id] = 1;
      clearField(); resetWave();
      syncChapter(false);
      heroHp = heroMax;
      for (const id in mateSprites) { const ms = mateSprites[id]; ms.stun = 0.01; ms.hp = 0; }
      closeSheet(); renderGrid(); updateUI(); save();
      banner(`⭐ 환생! 셰프 별 +${gain}<small>공격력·골드 +${Math.round(S.stars * BAL.starStep * 100)}% 로 다시 시작해요</small>`, 2.6);
      Sound.play('prestige'); shake(14); buzz(60);
    }, '취소');
};

// ---------- ⚙️ 설정 ----------
const GAME_VERSION = 'v0.1';
function applySettings() {
  const st = S.settings;
  Sound.setSfx(st.sfx); Sound.setMusic(st.music);
  if (app) app.ticker.maxFPS = st.saver ? 30 : 0; // 절전: 30fps
  fit();                                          // 절전: 백버퍼 해상도 낮춤
  document.querySelectorAll('#settings .switch').forEach((b) => b.classList.toggle('on', !!st[b.dataset.key]));
}
function openSettings() { applySettings(); $('settings').classList.remove('hidden'); paused = true; }
function closeSettings() { $('settings').classList.add('hidden'); paused = false; }
$('btnSettings').onclick = openSettings;
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
  showModal(`<div class="title small">게임 초기화</div><p>스테이지·골드·도구·동료·스킨·별·다이아가<br><b>모두 사라져요.</b></p>`, '초기화할게요', () => {
    showModal(`<div class="title small">정말요?</div><p>되돌릴 수 없어요.<br>정말 처음부터 시작할까요?</p>`, '처음부터 시작', () => {
      window.__resetting = true;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* 저장소 없음 */ }
      location.reload();
    }, '취소');
  }, '취소');
};
// 브라우저 정책상 첫 터치에서 오디오를 깨운다
addEventListener('pointerdown', () => Sound.unlock(), true);

// ---------- 💎 다이아 상점 ----------
const SHOP = [
  { id: 'slots', icon: '🧰', art: 'icon_slots', name: '도구함 칸 +4', desc: '합성할 공간이 넓어져요 (최대 2번)', price: 100,
    owned: () => S.shop.slots >= 2, label: () => `${S.shop.slots}/2`,
    buy: () => { S.shop.slots++; S.grid.push(0, 0, 0, 0); renderGrid(); } },
  { id: 'auto', icon: '🔄', art: 'icon_auto_merge', name: '자동 합성', desc: '같은 도구가 생기면 알아서 합쳐줘요', price: 150,
    owned: () => S.shop.autoMerge, buy: () => { S.shop.autoMerge = true; } },
  { id: 'boost', icon: '⏩', art: 'icon_boost', name: '2배속 10분', desc: '게임이 두 배로 빨라져요 (겹쳐 사면 시간 연장)', price: 20,
    owned: () => false, buy: () => { S.boostUntil = Math.max(Date.now(), S.boostUntil) + 10 * 60 * 1000; } },
  { id: 'offline', icon: '🌙', art: 'icon_offline', name: '오프라인 보상 12시간', desc: '자리를 비운 동안 보상이 12시간까지 쌓여요 (기본 8시간)', price: 80,
    owned: () => S.shop.offline12, buy: () => { S.shop.offline12 = true; } },
  { id: 'ninja', icon: '🥷', art: 'hero_ninja', name: '닌자 셰프 스킨', desc: '다이아 전용 스킨 · 보유 효과 공격력 +30%', price: 300,
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
  banner(`${it.icon} ${it.name}!`, 1.2);
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
  if (rush || r.used >= RUSH_TRIES) return;
  r.used++;
  mission('rush');
  closeSheet();
  clearField();
  heroHp = heroMax;
  rush = { t: RUSH_TIME, kills: 0, gems: 0, next: 1.2 };
  syncChapter(false);
  banner('⚔️ 보스 러시!<small>60초 동안 보스를 최대한 많이 잡으세요</small>', 1.8);
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
  e.c.scale.set(0.2); e.hit = 0.6; // 뿅 나타나는 연출
  drawBar(e);
  bossSay(BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)]);
}
function rushKill(e) {
  rush.kills++;
  const g = rushGemFor(rush.kills);
  rush.gems += g;
  popText(e.x, e.y - 70, `💎 +${g}`, 'crit');
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
  showModal(`<div class="title small">⚔️ 보스 러시 끝</div>
    <p>${reason}<br>보스 <b>${r.kills}마리</b> 처치${best ? ' · 🏆 최고 기록!' : ''}</p>
    <div class="reward">${GEM} ${r.gems}</div>
    <p class="sub">남은 도전 ${RUSH_TRIES - rushToday().used}번 · 자정에 다시 3번</p>`, '확인', () => {
      Sound.play('clear');
      banner(`STAGE ${S.stage}`);
    });
}
$('btnRush').onclick = startRush;

function updateShopRush() {
  let shopReady = false;
  document.querySelectorAll('#shopList [data-shop]').forEach((row) => {
    const it = SHOP.find((x) => x.id === row.dataset.shop), own = it.owned();
    row.querySelector('.lbl').textContent = it.label ? it.label() : '';
    const b = row.querySelector('.act');
    b.innerHTML = own ? '보유 중' : `구매<span class="cost">${GEM} ${it.price}</span>`;
    b.disabled = own || S.gems < it.price;
    b.classList.toggle('claimed', own);
    if (!own && it.id !== 'boost' && S.gems >= it.price) shopReady = true;
  });
  $('shopGems').innerHTML = `${GEM} ${fmt(S.gems)}`;
  const r = rushToday(), left = RUSH_TRIES - r.used;
  $('rushTries').textContent = `오늘 남은 도전 ${left} / ${RUSH_TRIES}`;
  $('rushBest').textContent = `최고 기록: 보스 ${S.rushBest}마리`;
  $('btnRush').disabled = left <= 0 || !!rush;
  $('btnRush').textContent = rush ? '도전 중…' : left > 0 ? '도전 시작' : '내일 다시 도전';
  return { shopReady, rushReady: left > 0 };
}

function openSheet(tab) { if (tab) showTab(tab); renderGrid(); updateUI(); $('sheet').classList.remove('closed'); }
function closeSheet() { $('sheet').classList.add('closed'); }
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
function spawnEnemy(boss, wall = false) {
  const r = wall ? 58 : boss ? 46 : 22;
  const c = new PIXI.Container();
  const ch = rush ? CHAPTERS[rush.kills % CHAPTERS.length] : chapterOf(S.stage); // 러시는 잡을 때마다 다음 챕터 보스
  const art = enemyArt(ch, boss, Math.floor(Math.random() * 3));
  let g, barY = -r - 22;
  if (ART[art.key]) {
    // 손그림: 발이 원 아래쪽(r)에 오도록, 키는 반지름의 약 2.9배
    g = new PIXI.Container();
    const h = r * (boss ? 2.8 : 2.9), sp = artSprite(art.key, h);
    sp.y = r * 1.05;
    sp.tint = art.tint;
    g.addChild(sp);
    barY = sp.y - h - 14;
  } else { g = new PIXI.Graphics(); drawVeg(g, r, art.kind); g.tint = art.tint; }
  const bar = new PIXI.Graphics();
  c.addChild(g, bar);
  // 지금 보이는 화면 바로 바깥(위·왼쪽·오른쪽)에서 들어온다
  let x, y;
  const side = boss ? 0 : Math.floor(Math.random() * 4); // 위쪽이 두 배로 자주
  if (side <= 1) { x = cam.x + 60 + Math.random() * (FW - 120); y = cam.y - 50; }
  else if (side === 2) { x = cam.x - 50; y = cam.y + 150 + Math.random() * (FH * 0.6); }
  else { x = cam.x + FW + 50; y = cam.y + 150 + Math.random() * (FH * 0.6); }
  c.position.set(x, y);
  field.addChild(c);
  const hp = enemyHp(S.stage) * (boss ? BAL.bossHp : 1) * (wall ? WALL_HP : 1);
  const e = { c, g, bar, x, y, r, hp, max: hp, boss, speed: boss ? 34 : 50 + Math.random() * 22 + S.stage * 0.5,
    gold: enemyGold(S.stage) * (boss ? BAL.bossGold : 1) * (wall ? BAL.wallGold : 1) * starMul() * goldMul(), wall, hit: 0, dead: false, wob: Math.random() * 6, atkT: 0.3, lunge: 0, lx: 0, ly: 0, barY };
  drawBar(e);
  enemies.push(e);
}
function drawBar(e) {
  e.bar.clear();
  if (e.hp >= e.max && !e.boss) return;
  const w = e.r * 2.2;
  e.bar.roundRect(-w / 2, e.barY, w, 8, 4).fill({ color: 0x000000, alpha: 0.5 });
  e.bar.roundRect(-w / 2, e.barY, w * Math.max(0, e.hp / e.max), 8, 4).fill(e.boss ? 0xff4d6d : 0x7ee07e);
}
function removeEnemy(e) {
  e.dead = true;
  e.c.destroy({ children: true });
  enemies.splice(enemies.indexOf(e), 1);
}
function clearField() {
  while (enemies.length) removeEnemy(enemies[0]);
  while (bullets.length) bullets.pop().g.destroy();
}
function resetWave() {
  wave = { idx: 0, total: waveCount(S.stage), spawned: 0, kills: 0, bossSpawned: false, spawnT: 0.8, breakT: 0 };
}
const isFinalWave = () => wave.idx === wave.total - 1;
function startWave() {
  if (isFinalWave()) {
    const wall = isWallStage(S.stage);
    if (wall) banner(`🔥 강한 보스 🔥<small>체력 ${WALL_HP}배! ${WALL_TIME}초 안에 처치하세요</small>`, 2);
    else banner(`FINAL WAVE<small>👑 보스 등장! ${BOSS_TIME}초 안에 처치하세요</small>`, 1.6);
    wave.bossSpawned = true;
    spawnEnemy(true, wall);
    bossT = wall ? WALL_TIME : BOSS_TIME;
    Sound.play(wall ? 'wall' : 'boss'); shake(wall ? 12 : 5);
    bossSay(BOSS_LINES[Math.floor(Math.random() * BOSS_LINES.length)]);
  } else banner(`WAVE ${wave.idx + 1}/${wave.total}`, 1.0);
}
let bubble = null;
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
  // 화면 밖에서 들어올 때도 보이게 화면 안쪽으로 붙인다
  const bx = Math.max(150, Math.min(FW - 150, boss.x - cam.x));
  const by = Math.max(290, boss.y - boss.r - 40 - cam.y); // 상단 HUD 아래로
  bubble.el.style.left = bx + 'px';
  bubble.el.style.top = by + 'px';
  bubble.el.style.opacity = Math.min(1, bubble.life * 2);
}

let bgNode = null, bgKey = '', lastChapter = -1;
// 지금 장소(챕터 또는 보스 러시 결투장)에 맞게 배경을 바꾸고, 새 챕터에 들어가면 간판을 띄운다
function syncChapter(announce = true) {
  const ci = chapterIdx(S.stage);
  const key = rush ? 'arena' : CHAPTERS[ci].id;
  if (key !== bgKey) {
    if (bgNode) bgNode.destroy({ children: true });
    bgNode = makeBackground(rush ? ARENA : CHAPTERS[ci]);
    bgNode.zIndex = -2;
    world.addChild(bgNode);
    bgKey = key;
  }
  if (!rush && ci !== lastChapter) {
    if (announce && lastChapter >= 0) chapterSign(ci);
    lastChapter = ci;
  }
}
function chapterSign(ci) {
  const ch = CHAPTERS[ci], el = $('chapterSign');
  const lap = Math.floor((S.stage - 1) / (10 * CHAPTERS.length));
  el.innerHTML = AVAIL.has('ui_chapter_' + ch.id)
    ? `<img src="${IMG}ui_chapter_${ch.id}.webp" alt="${ch.name}">`
    : `<div class="sign"><small>CHAPTER ${ci + 1}${lap ? ` · ${lap + 1}바퀴` : ''}</small><b>${ch.icon} ${ch.name}</b><span>새로운 썩은 음식들이 나타났다!</span></div>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  Sound.play('claim');
}

function retreat() {
  if (rush) { endRush('셰프가 쓰러졌어요'); return; }
  clearField();
  S.stage = Math.max(1, S.stage - 1);
  resetWave();
  syncChapter(false);
  heroHp = heroMax;
  for (const id in mateSprites) { const ms = mateSprites[id]; ms.stun = 0.01; ms.hp = 0; }
  banner(`후퇴!<small>${retreatHint()}</small>`, 2.6);
  Sound.play('retreat');
}
// 막혔을 때 지금 가장 효과적인 다음 행동을 알려준다
function retreatHint() {
  const lv = S.grid.filter((L) => L);
  if (lv.some((L, i) => lv.indexOf(L) !== i)) return '🧰 같은 도구를 합성하면 공격력이 2.6배!';
  if (S.grid.includes(0) && S.gold >= costBuy()) return '🧰 빈 칸에 도구를 더 사보세요';
  if (S.gold >= costAtk()) return '⚔ 공격력을 올려보세요';
  const m = MATES.find((x) => S.gold >= mateCost(x));
  if (m) return `${m.icon} ${m.name} ${mateLv(m) ? '강화' : '고용'}로 화력을 보태세요`;
  if (starsFor(S.stage + 1) >= 3) return '⭐ 환생하면 영원히 강해져요';
  return '조금 방치해서 골드를 모은 뒤 다시 도전해요';
}
function stageClear() {
  // 보스가 쓰러지면 남은 채소는 도망간다
  for (const e of [...enemies]) { popText(e.x, e.y, '💨', ''); removeEnemy(e); }
  S.stage++;
  S.bestStage = Math.max(S.bestStage || 0, S.stage); // 🏠 주방 레벨 기준 (환생해도 유지)
  resetWave();
  syncChapter();
  banner(isWallStage(S.stage) ? `STAGE ${S.stage}<small>🔥 이번 스테이지는 강한 보스가 나와요</small>` : `STAGE ${S.stage}`, isWallStage(S.stage) ? 2 : 1.4);
  Sound.play('clear');
  mission('stage');
  save();
}
function nearestEnemy() {
  let best = null, bd = Infinity;
  for (const e of enemies) {
    // 화면 안에 들어온 적만 노린다 — 안 보이는 곳에서 죽지 않게
    if (e.x < cam.x || e.x > cam.x + FW || e.y < cam.y + 20 || e.y > cam.y + FH) continue;
    const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function launch(kind, L, sx, sy, dmg, target) {
  const key = kind === 'tool' ? toolKey(L) : 'proj_' + kind;
  let g;
  if (ART[key]) g = artSprite(key, kind === 'tool' ? 34 + Math.min(L, 8) * 1.5 : 26, 0.5);
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
    const bar = new PIXI.Graphics();
    // 기절했을 때 머리 위에서 도는 별
    let stars;
    if (ART.fx_stun) { stars = artSprite('fx_stun', 34, 0.5); stars.position.set(0, -MATE_H[m.id] + 18); }
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
  if (ms.stun > 0) return;
  ms.hp -= dmg; ms.hitT = 0.2;
  popText(ms.x, ms.y - 50, '-' + fmt(dmg), 'hurt small');
  if (ms.hp <= 0) { ms.hp = 0; ms.stun = 5; popText(ms.x, ms.y - 80, '기절!', 'hurt'); Sound.play('stun'); }
}
function updateMates(dt) {
  for (const id in mateSprites) {
    const ms = mateSprites[id];
    const max = mateMaxHp(ms.m);
    // 기절: 누워서 별이 돌고, 5초 뒤 체력을 회복하고 일어난다
    if (ms.stun > 0) {
      ms.stun -= dt;
      ms.g.rotation = 1.45 * ms.face; ms.g.y = 12; ms.g.alpha = 0.75;
      ms.stars.visible = true; ms.stars.rotation = Math.sin(ms.stun * 6) * 0.4; // 좌우로 흔들리는 별
      ms.bar.clear();
      if (ms.stun <= 0) { ms.hp = max; ms.g.rotation = 0; ms.g.alpha = 1; ms.stars.visible = false; }
      ms.c.zIndex = ms.y;
      continue;
    }
    ms.hp = Math.min(max, ms.hp + max * 0.04 * dt);
    if (ms.hitT > 0) { ms.hitT -= dt; ms.g.tint = 0xff7070; ms.g.x = (Math.random() - 0.5) * 6; } else { ms.g.tint = 0xffffff; ms.g.x = 0; }
    ms.bar.clear();
    if (ms.hp < max) {
      ms.bar.roundRect(-22, 36, 44, 6, 3).fill({ color: 0x000000, alpha: 0.45 });
      ms.bar.roundRect(-22, 36, 44 * ms.hp / max, 6, 3).fill(ms.hp / max > 0.35 ? 0x7ee07e : 0xff5a5a);
    }
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
    // 각자 공격
    ms.t -= dt;
    if (ms.t <= 0) {
      const t = nearestEnemy();
      if (t) { launch(ms.m.proj, 0, ms.x, ms.y - 14, mateDmg(ms.m), t); ms.t = ms.m.iv * (0.9 + Math.random() * 0.2); }
    }
    // 아래에 있는 것이 앞에 보이게
    ms.c.zIndex = ms.y;
  }
  hero.c.zIndex = P.y;
}

function hurtHero(dmg) {
  heroHp -= dmg; P.hitT = 0.25;
  Sound.play('hurt'); shake(6); buzz(25);
  popText(P.x + (Math.random() - 0.5) * 30, P.y - 120, '-' + fmt(dmg), 'hurt');
  if (heroHp <= 0) { retreat(); return true; }
  return false;
}
// 채소는 가장 가까운 셰프나 (기절하지 않은) 동료에게 달려든다
function pickTarget(e) {
  let best = { x: P.x, y: P.y, hero: true }, bd = (P.x - e.x) ** 2 + (P.y - e.y) ** 2;
  for (const id in mateSprites) {
    const ms = mateSprites[id];
    if (ms.stun > 0) continue;
    const d = (ms.x - e.x) ** 2 + (ms.y - e.y) ** 2;
    if (d < bd) { bd = d; best = { x: ms.x, y: ms.y, ms }; }
  }
  return best;
}

// 목적지를 바꿔 가며 돌아다니고, 가까운 채소에게서는 멀어진다
function moveHero(dt) {
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
  const camTy = Math.max(0, Math.min(WH - FH, P.y - FH * 0.6));
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
  if (rush) {
    // 보스 러시: 제한시간 안에 갈수록 강해지는 보스를 계속 잡는다
    rush.t -= dt;
    if (rush.t <= 0) { endRush('시간 종료'); return; }
    if (!enemies.some((e) => e.boss)) { rush.next -= dt; if (rush.next <= 0) spawnRushBoss(); }
  } else
  // 웨이브 진행: 웨이브 채소를 다 잡으면 잠깐 쉬고 다음 웨이브 (마지막은 보스를 잡아야 클리어)
  if (wave.breakT > 0) {
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
  // 보스 제한시간은 같이 나온 졸개를 다 잡은 뒤부터 줄어든다 (졸개 잡는 동안 시간이 다 가지 않게)
  if (!rush && wave.bossSpawned && enemies.some((e) => e.boss) && wave.spawned >= waveSize(wave.idx) && !enemies.some((e) => !e.boss)) {
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
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
    } else if (e.atkT <= 0) {
      e.atkT = e.boss ? 1.4 : 1.0;
      e.lunge = 0.18; e.lx = dx / d; e.ly = dy / d;
      const dmg = enemyAtk(S.stage) * (e.boss ? 3 : 1);
      if (tgt.hero) { if (hurtHero(dmg)) return; } else hurtMate(tgt.ms, dmg);
    }
    // 때릴 때 상대 쪽으로 확 덤벼든다
    let ox = 0, oy = 0;
    if (e.lunge > 0) { e.lunge -= dt; const k = Math.sin((1 - e.lunge / 0.18) * Math.PI) * 18; ox = e.lx * k; oy = e.ly * k; }
    e.c.position.set(e.x + ox, e.y + oy);
    // 통통 뛰며 흔들리는 걸음
    e.wob += dt * (e.boss ? 5 : 9);
    e.g.rotation = Math.sin(e.wob) * 0.18;
    e.g.y = -Math.abs(Math.sin(e.wob)) * e.r * 0.25;
    if (e.hit > 0) { e.hit -= dt; e.c.scale.set(1 + e.hit * 1.2); e.c.alpha = 0.75; } else { e.c.scale.set(1); e.c.alpha = 1; }
  }

  // 총 발사
  const iv = fireInterval();
  S.grid.forEach((L, i) => {
    if (!L) return;
    gunTimers[i] -= dt;
    if (gunTimers[i] > 0) return;
    const t = nearestEnemy();
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
      e.hp -= b.dmg;
      e.hit = 0.12;
      const crit = e.boss || b.dmg >= e.max * 0.5;
      if (S.settings.dmgNum) popText(e.x + (Math.random() - 0.5) * 40, e.y - e.r - 6, fmt(b.dmg), crit ? (e.boss ? 'crit boss' : 'crit') : '');
      if (e.boss) { Sound.play('bossHit'); shake(e.wall ? 2.5 : 1.5); } else Sound.play('hit');
      if (crit) spawnFx('fx_hit', e.x + (Math.random() - 0.5) * e.r, e.y - e.r * 0.6, e.boss ? 90 : 60, 0.25);
      b.g.destroy(); bullets.splice(k, 1);
      if (e.hp <= 0) {
        S.gold += e.gold;
        popText(e.x, e.y + 10, '+' + fmt(e.gold), e.boss ? 'gold big' : 'gold');
        coinBurst(e.x - cam.x, e.y - cam.y, e.wall ? 25 : e.boss ? 15 : 3);
        spawnFx('fx_poof', e.x, e.y, e.boss ? 220 : 110, e.boss ? 0.6 : 0.4);
        const wasBoss = e.boss;
        if (wasBoss) { Sound.play('coin'); shake(e.wall ? 16 : 10); buzz(40); mission('boss'); }
        if (wasBoss && e.wall && !rush && !S.wallFirst[S.stage]) {
          S.wallFirst[S.stage] = true; S.gems += 10;
          popText(e.x, e.y - 60, '💎 +10 첫 처치!', 'crit'); gemBurst(e.x - cam.x, e.y - cam.y, 8);
        }
        else { Sound.play('kill'); mission('kill'); }
        removeEnemy(e);
        if (rush && wasBoss) rushKill(e);
        else if (wasBoss) { stageClear(); } else { wave.kills++; }
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
  updateBubble(dt);
  updateCoins(dt);
  updateFx(dt);
  heroHp = Math.min(heroMax, heroHp + BAL.heroRegen * dt);
  $('vignette').classList.toggle('low', heroHp / heroMax < 0.35);
  $('vignette').classList.toggle('flash', P.hitT > 0);
  hero.hp.clear().roundRect(-50, 80, 100 * Math.max(0, heroHp / heroMax), 10, 5).fill(heroHp / heroMax > 0.35 ? 0x7ee07e : 0xff5a5a);

  // 떠오르는 숫자
  for (let k = fxList.length - 1; k >= 0; k--) {
    const f = fxList[k];
    f.life -= dt; f.y += f.vy * dt; f.x += f.vx * dt; f.vx *= 1 - 3 * dt;
    f.el.style.left = f.x - cam.x + 'px';
    f.el.style.top = f.y - cam.y + 'px';
    f.el.style.opacity = Math.min(1, f.life * 2.5);
    if (f.life <= 0) { f.el.remove(); fxList.splice(k, 1); }
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
}

// ---------- 부팅 ----------
(async () => {
  app = new PIXI.Application();
  await app.init({ width: FW, height: FH, background: '#e9dcc4', resolution: backbufferRes(), autoDensity: true, antialias: true });
  $('field').prepend(app.canvas);
  world = new PIXI.Container();
  field = new PIXI.Container();
  // 손그림 셰프 이미지가 있으면 스킨별 텍스처를 만든다 (없으면 코드로 그린 곰)
  await loadArt();
  try { await buildSkinTextures(); } catch (e) { console.warn('셰프 이미지 없음 — 코드 그림 사용', e); }
  hero = makeHero();
  field.zIndex = -1;
  world.sortableChildren = true; // 셰프·동료는 y값으로 앞뒤를 정한다
  world.addChild(field, hero.c);
  syncChapter(false);
  app.stage.addChild(world);
  fxLayer = new PIXI.Container(); fxLayer.zIndex = 99999; world.addChild(fxLayer);
  coinLayer = new PIXI.Container(); // 코인은 카메라와 상관없이 화면 좌표로 날아간다
  app.stage.addChild(coinLayer);
  coinTex = ART.icon_coin || makeCoinTexture();
  gemTex = makeGemTexture();
  // 시작할 때 카메라를 셰프 위치에 바로 맞춘다
  cam.x = Math.max(0, Math.min(WW - FW, P.x - FW / 2));
  cam.y = Math.max(0, Math.min(WH - FH, P.y - FH * 0.6));

  buildMenus();
  syncMates();
  resetWave();
  ensureDaily(); buildMissions(); buildShop();
  applySettings();
  $('verLabel').textContent = `주방 대전쟁 ${GAME_VERSION} · 게임잼 프로토타입`;
  renderGrid(); updateUI();

  // 처음이면 한 줄 설정, 아니면 자리 비운 동안의 보상
  if (!S.introSeen) {
    showModal(`<img class="logo" src="${IMG}ui_logo.webp" alt="주방 대전쟁">
      <img class="titleart" src="${IMG}ui_title_art.webp" alt="">
      <p>냉장고 속 채소들이 썩어서<br><b>반란</b>을 일으켰다!</p>
      <p class="sub">셰프 곰이 주방을 지킨다.</p>`, '주방 지키러 가기', () => { S.introSeen = true; save(); banner(`STAGE ${S.stage}`); });
  } else if (!offerOffline(awaySec)) banner(`STAGE ${S.stage}`);

  let uiT = 0, saveT = 0;
  app.ticker.add((tk) => {
    const dt = Math.min(0.1, tk.deltaMS / 1000);
    if (!paused) {
      const steps = Date.now() < S.boostUntil ? 2 : 1; // ⏩ 2배속
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
