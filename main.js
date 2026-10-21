// 주방 대전쟁 — 방치형 키우기 프로토타입 (도형만, 에셋 없음)
// 코어 루프: 셰프 곰이 조리도구를 자동으로 던짐 → 썩은 채소 처치 → 골드 → 도구 구매·합성·업그레이드 → 다음 스테이지

// FH = 업그레이드 카드 위로 보이는 전장(카메라·조준 기준), CH = 캔버스 높이. 카드 뒤에도 바닥이 비치도록 캔버스는 화면 끝까지 그린다
const W = 720, H = 1280, FW = 720, FH = 1090, CH = 1280;
// 셰프 이동 범위 — 채소가 조리대(위)에서 내려오므로 주방 바닥 아래쪽을 돌아다닌다
const COUNTER_Y = 300;
// 주방(월드)은 화면보다 넓고, 카메라가 셰프를 따라간다
// 월드 아래쪽 CH - FH(190)는 카드 뒤에 깔리는 바닥 — 셰프는 거기로 가지 않는다
const WW = 1100, WH = 1500 + (CH - FH);
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
  { id: 'pirate', name: t('skin.pirate'), apron: 0xf7f7f2, stripes: 0xd93a3a, neck: 'scarf', neckColor: 0x2a2a2a, hat: 'pirate', eyepatch: true, cost: 300, eff: { atk: 0.1 },
    look: { hat: 0x3a3a44, scarf: 0x2a2a2a, eyepatch: true, skull: true } },
  { id: 'patissier', name: t('skin.patissier'), apron: 0xff9ec4, neck: 'bow', neckColor: 0x4aa3df, hat: 'beret', hatColor: 0xd94a6a, cost: 2500, eff: { gold: 0.2 },
    look: { hat: 0xff8fb8, coat: 0xffd6e6, scarf: 0x4aa3df } },
  { id: 'santa', name: t('skin.santa'), coat: 0xd93a3a, beard: true, neck: 'none', hat: 'santa', cost: 15000, eff: { atk: 0.35 },
    look: { hat: 0xd93a3a, coat: 0xd93a3a, scarf: 0xffffff, pom: true } },
  { id: 'ninja', name: t('skin.ninja'), gem: 300, cost: 0, eff: { spd: 0.1 },
    look: { hat: 0x2a2f45, coat: 0x3a4060, scarf: 0xd93a3a } },
  { id: 'hanbok', name: t('skin.hanbok'), gem: 400, cost: 0, eff: { gold: 0.4 }, look: {} },
  { id: 'wizard', name: t('skin.wizard'), gem: 800, cost: 0, eff: { atk: 0.6 }, look: {} },
  { id: 'sushi', name: t('skin.sushi'), cost: 600000, eff: { gold: 0.7 }, look: {} },
  { id: 'pizza', name: t('skin.pizza'), cost: 6000000, eff: { atk: 0.8 }, look: {} },
  { id: 'barista', name: t('skin.barista'), cost: 60000000, eff: { spd: 0.15 }, look: {} },
  { id: 'space', name: t('skin.space'), req: 8, cost: 0, eff: { atk: 1.0 }, look: {} }, // 보스 러시 최고 8마리
  { id: 'king', name: t('skin.king'), apron: 0x2a2a2a, apronTrim: 0xffd34d, cape: 0xb02a3a, neck: 'scarf', neckColor: 0xffd34d, hat: 'crown', cost: 120000, eff: { gold: 0.6 },
    look: { hat: 0xffd34d, coat: 0x34343c, scarf: 0xffd34d, gems: true } },
];
// 예전 저장본(곰 종류 스킨) id를 의상 스킨으로 옮긴다
const OLD_SKIN_IDS = { panda: 'pirate', polar: 'patissier', honey: 'santa' };
const skinById = (id) => SKINS.find((k) => k.id === id) || SKINS[0];
const SKIN_EFF = { atk: 'skin.eff_atk', spd: 'skin.eff_spd', gold: 'skin.eff_gold' }; // 문구 키 (strings.csv)
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
const mateDmg = (m, lv = mateLv(m)) => m.dmg * Math.pow(BAL.mateG, lv - 1) * atkMul() * baseMateMul(); // 🏠 요리 학교
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
const fireInterval = () => BAL.fireBase / (spdMul() * (1 + skinEff('spd')) * permMul('spd'));
const costAtk = () => Math.ceil(BAL.atkCost * Math.pow(BAL.atkCostG, S.atkLv));
const costSpd = () => Math.ceil(BAL.spdCost * Math.pow(BAL.spdCostG, S.spdLv));
const goldMul = () => 1 + BAL.goldStep * S.goldLv;                          // 골드 획득량 (업그레이드 카드 값)
const goldAll = () => goldMul() * (1 + skinEff('gold')) * permMul('gold');   // 스킨·영구 강화까지
const costGold = () => Math.ceil(BAL.goldCost * Math.pow(BAL.goldCostG, S.goldLv));
const costBuy = () => Math.ceil(BAL.buyCost * Math.pow(BAL.buyCostG, S.buys));
const enemyHp = (st) => Math.ceil(BAL.hpBase * Math.pow(BAL.hpG, st - 1) * (BAL.earlyEase[st - 1] || 1));
const enemyAtk = (st) => BAL.atkBase + st * BAL.atkPerStage; // 채소 한 대 공격력 (보스는 3배)
const mateMaxHp = (m, lv = mateLv(m)) => 50 * (1 + 0.35 * (lv - 1)) * baseMateMul();
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
    skin: 'brown', skins: ['brown'], mates: {}, introSeen: false, lastSeen: Date.now(),
    stars: 0, prestiges: 0, perm: { atk: 0, spd: 0, gold: 0 }, chal: {}, sound: true, daily: null, goldLv: 0,
    gems: 0, wallFirst: {}, shop: { slots: 0, autoMerge: false, offline12: false }, boostUntil: 0, rush: null, rushBest: 0, horde: null, hordeBest: 0,
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
const KO_TEXT_ART = new Set(['ui_tag_best', 'ui_tag_new', 'ui_stamp_done', 'ui_equipped', 'ui_logo']);
const hasTextArt = (k) => AVAIL.has(k) && (LANG === 'ko' || !KO_TEXT_ART.has(k) && !k.startsWith('ui_chapter_'));
// 전장(PixiJS)에 그리는 그림만 텍스처로 올린다 — UI·아이콘은 HTML <img>가 필요할 때 받는다
const PIXI_ART = /^(bg_|prop_|enemy_|boss_|mate_|proj_|fx_|hero_|tool_|icon_coin$|ui_hero_hp_|ui_hp_heart$|ui_enemy_hp_|ui_boss_crown$|ui_aim$)/;
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
// 셰프·동료 발밑 체력 막대 (가운데 기준, 위쪽 y). 손그림 ui_hero_hp_*(300×42, 3x 판)를 좌우 3분할로 늘린다 (사내 기준 ux:nine-slice)
// 자르기 값은 텍스처 px(1x 7 × 3 = 21). 35% 아래는 빨강 채움 ui_hero_hp_fill_low(330×48, 자르기 24) — 그림이 없으면 코드 빨강
// 왼쪽 끝에 작은 하트(ui_hp_heart)
const HP_TEX_W = 300, HP_TEX_H = 42, HP_SLICE = 21, HP_LOW_W = 330, HP_LOW_H = 48, HP_LOW_SLICE = 24;
function makeHpBar(w, y) {
  const c = new PIXI.Container();
  const h = w * HP_TEX_H / HP_TEX_W;
  const low = new PIXI.Graphics();
  c.y = y;
  if (ART.ui_hero_hp_bg && ART.ui_hero_hp_fill) {
    const opt = { leftWidth: HP_SLICE, rightWidth: HP_SLICE, topHeight: 0, bottomHeight: 0 };
    const bg = new PIXI.NineSliceSprite({ texture: ART.ui_hero_hp_bg, ...opt });
    const fill = new PIXI.NineSliceSprite({ texture: ART.ui_hero_hp_fill, ...opt });
    for (const sp of [bg, fill]) { sp.scale.set(w / HP_TEX_W); sp.x = -w / 2; }
    const lowSp = ART.ui_hero_hp_fill_low
      ? new PIXI.NineSliceSprite({ texture: ART.ui_hero_hp_fill_low, leftWidth: HP_LOW_SLICE, rightWidth: HP_LOW_SLICE, topHeight: 0, bottomHeight: 0 }) : null;
    if (lowSp) { lowSp.scale.set(h / HP_LOW_H); lowSp.x = -w / 2; }
    c.addChild(bg, fill, lowSp || low);
    if (ART.ui_hp_heart) { const hs = artSprite('ui_hp_heart', h * 1.7, 0.5); hs.position.set(-w / 2, h / 2); c.addChild(hs); }
    c.set = (r) => {
      r = Math.max(0, Math.min(1, r));
      fill.visible = r > 0.35;
      fill.width = HP_TEX_W * r;
      if (lowSp) {
        lowSp.visible = r > 0 && r <= 0.35;
        lowSp.width = Math.max(HP_LOW_SLICE * 2, (w * r) / lowSp.scale.x);
        return;
      }
      low.clear();
      if (r > 0 && r <= 0.35) low.roundRect(-w / 2 + h * 0.15, h * 0.2, (w - h * 0.3) * r, h * 0.6, h * 0.3).fill(0xff5a5a);
    };
  } else {
    c.addChild(low);
    c.set = (r) => {
      r = Math.max(0, Math.min(1, r));
      low.clear().roundRect(-w / 2, 0, w, h, h / 2).fill({ color: 0x000000, alpha: 0.4 });
      low.roundRect(-w / 2, 0, w * r, h, h / 2).fill(r > 0.35 ? 0x7ee07e : 0xff5a5a);
    };
  }
  c.set(1);
  return c;
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
// 10스테이지마다 나오는 강한 보스의 화면 이름: 챕터마다 '대왕 양파'(King Onion)… (2026-10-21 사용자 결정, 한국어 보스 이름은 모두 받침 없음 → 조사 '가')
const wallBossName = (st) => t('king.' + chapterOf(st).id);
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

  const hp = makeHpBar(100, 78);
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
  const hp = makeHpBar(100, 78);
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
  // 스킨 (총고식 4열 격자): 칸에는 그림만, 잠긴 건 어둡게 + 자물쇠, 장착 중은 노랑 칸 + 체크. 누르면 구매·장착 창
  $('skinList').innerHTML = SKINS.map((k) => {
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    return `
    <button class="skin" data-skin="${k.id}" aria-label="${k.name}">
      ${skinThumb[k.id] ? `<img class="thumb" src="${skinThumb[k.id]}" alt="">` : `<div class="mini hat-${k.hat} ${k.eyepatch ? 'eyepatch' : ''} ${k.beard ? 'beard' : ''}" style="--fur:${hex(BEAR.fur)};--face:${hex(BEAR.face)};--muz:${hex(BEAR.muzzle)};--hat:${hex(k.hatColor || 0xffffff)};--outfit:${hex(k.coat || k.apron)};--neck:${hex(k.neckColor || k.coat || 0)}">
        <i class="body"></i><i class="ear l"></i><i class="ear r"></i><i class="head"></i><i class="eye l"></i><i class="eye r"></i><i class="muz"></i><i class="beard"></i><i class="nose"></i><i class="hat"></i><i class="pom"></i>
      </div>`}
      <img class="lock" src="${IMG}icon_lock.webp" alt="">
    </button>`;
  }).join('');
  $('mateList').onclick = (e) => {
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
function skinCanGet(k) { return k.req ? (S.rushBest || 0) >= k.req : k.gem ? S.gems >= k.gem : S.gold >= k.cost; }
function openSkin(k) {
  const own = S.skins.includes(k.id), on = S.skin === k.id, can = skinCanGet(k);
  const price = k.req ? t('skin.req_rush', { n: k.req, best: S.rushBest || 0 }) : k.gem ? `${GEM} ${k.gem}` : `${COIN} ${fmt(k.cost)}`;
  const btn = on ? t('skin.equipped') : own ? t('skin.equip') : k.req ? (can ? t('skin.claim') : t('skin.locked')) : can ? t('skin.buy') : t('skin.poor');
  showModal(`<div class="title small">${k.name}</div>
    <img class="skin-big" src="${skinThumb[k.id] || IMG + 'hero_chef.webp'}" alt="">
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
    }, null, { xClose: true });
  $('modalBtn').disabled = on || (!own && !can);
}

function updateMenus() {
  let mateReady = false, skinReady = false;
  document.querySelectorAll('#mateList .row').forEach((row) => {
    const m = MATES.find((x) => x.id === row.dataset.mate), lv = mateLv(m), c = mateCost(m);
    row.querySelector('.stat').textContent = lv
      ? t('mates.stat_owned', { lv, dmg: fmt(mateDmg(m)), iv: m.iv, hp: fmt(mateMaxHp(m)), next: fmt(mateDmg(m, lv + 1)) })
      : t('mates.stat_new', { dmg: fmt(mateDmg(m, 1)), iv: m.iv, hp: fmt(mateMaxHp(m, 1)) });
    const b = row.querySelector('.act');
    b.innerHTML = `${lv ? t('mates.upgrade') : t('mates.hire')}<span class="cost">${COIN} ${fmt(c)}</span>`;
    b.disabled = S.gold < c;
    row.classList.toggle('locked', !lv);
    if (S.gold >= c) mateReady = true; // 고용·강화 둘 다 살 수 있으면 동료 메뉴에 빨간 점 (2026-10-21)
  });
  document.querySelectorAll('#skinList .skin').forEach((card) => {
    const k = skinById(card.dataset.skin), own = S.skins.includes(k.id);
    card.classList.toggle('on', S.skin === k.id);
    card.classList.toggle('locked', !own);
    if (!own && !k.gem && skinCanGet(k)) skinReady = true;
  });
  const pct = (t) => `+${Math.round(skinEff(t) * 100)}%`;
  $('sumAtk').textContent = pct('atk'); $('sumSpd').textContent = pct('spd'); $('sumGold').textContent = pct('gold');
  $('skinCount').textContent = t('skins.count', { n: S.skins.length, total: SKINS.length });
  return { mateReady, skinReady, missionReady: updateMissions(), prestigeReady: updatePrestige() };
}

function updateUI() {
  const bossOn = wave.bossSpawned && enemies.some((e) => e.boss);
  const wall = isWallStage(S.stage);
  if (chal) {
    $('stageLabel').textContent = chal.horde ? t('horde.label') : t('chal.label', { n: chal.ci + 1 });
    $('chapterLabel').textContent = CHAPTERS[chal.ci].name;
    $('bossTimer').classList.add('on', 'rush');
    if (chal.horde) $('bossTimer').innerHTML = t('horde.pill', { sec: Math.ceil(chal.t), n: chal.kills, coin: COIN, gold: fmt(chal.gold) });
    else $('bossTimer').textContent = t('chal.pill', { sec: Math.ceil(chal.t), n: chal.kills, total: CHAL_N });
  } else if (rush) {
    $('stageLabel').textContent = t('rush.label');
    $('chapterLabel').textContent = '🔥 ' + t('place.arena');
    $('bossTimer').classList.add('on', 'rush');
    $('bossTimer').innerHTML = t('rush.pill', { sec: Math.ceil(rush.t), n: rush.kills, gem: GEM, gems: rush.gems });
  } else {
    $('bossTimer').classList.remove('rush');
    $('stageLabel').textContent = `${wall ? '🔥 ' : ''}Stage ${S.stage}-${wave.idx + 1}`;
    const ch = chapterOf(S.stage);
    $('chapterLabel').innerHTML = `${AVAIL.has('icon_chapter_' + ch.id) ? icon('icon_chapter_' + ch.id, ch.icon) : ch.icon} ${ch.name}`;
    $('bossTimer').classList.toggle('on', bossOn);
    if (bossOn) $('bossTimer').textContent = (wall ? t('hud.king_timer', { boss: wallBossName(S.stage), sec: Math.ceil(bossT) }) : t('hud.boss_timer', { sec: Math.ceil(bossT) }));
  }
  // 일반 보스전의 남은 시간은 보스 체력 바 안에 (빨간 알약은 보스 러시·도전 때만 보인다 — 2026-10-21 위쪽 표시 정리)
  $('bossTime').textContent = !rush && !chal && bossOn ? `⏱ ${Math.ceil(bossT)}` : '';
  // 스테이지 명판: 보스가 나왔거나 강한 보스 스테이지·보스 러시면 보스 명판(ui_stage_plate_boss)
  $('stageLabel').classList.toggle('boss', !!(rush || wall || bossOn) && !chal);
  $('gemLabel').innerHTML = GEM + ' ' + fmt(S.gems) + (AVAIL.has('ui_btn_plus') ? '<i class="plus"></i>' : ''); // + = 상점 열기
  const boostLeft = (S.boostUntil - Date.now()) / 1000;
  $('boostPill').classList.toggle('on', boostLeft > 0);
  if (boostLeft > 0) $('boostPill').textContent = t('hud.boost', { time: `${Math.floor(boostLeft / 60)}:${String(Math.floor(boostLeft % 60)).padStart(2, '0')}` });
  const mr = $('gemLabel').getBoundingClientRect(), fr0 = $('field').getBoundingClientRect();
  gemTarget = { x: (mr.left - fr0.left + 26 * scale) / scale, y: (mr.top - fr0.top + mr.height / 2) / scale };
  $('goldLabel').innerHTML = COIN + ' ' + fmt(S.gold);
  const gr = $('goldLabel').getBoundingClientRect(), fr = $('field').getBoundingClientRect();
  goldTarget = { x: (gr.left - fr.left + 26 * scale) / scale, y: (gr.top - fr.top + gr.height / 2) / scale };
  // 스테이지 전체 진행도: 끝난 웨이브 + 현재 웨이브 진행 (마지막 웨이브는 보스 체력을 깎은 만큼)
  const boss = enemies.find((e) => e.boss);
  const cur = isFinalWave() ? (boss ? 1 - Math.max(0, boss.hp) / boss.max : 0) : Math.min(1, wave.kills / waveSize(wave.idx));
  const pct = Math.min(1, (wave.idx + cur) / wave.total);
  // 보스 러시 중에는 맨 위 바가 남은 시간을 보여주고 웨이브 트랙은 숨긴다
  const timed = rush || chal;
  const topV = rush ? Math.min(1, rush.t / RUSH_TIME) : chal ? chal.t / CHAL_TIME : pct;
  $('topFill').style.width = topV * 100 + '%';
  $('topPct').textContent = timed ? t('hud.seconds', { n: Math.ceil(timed.t) }) : Math.floor(pct * 100) + '%';
  $('track').style.visibility = timed ? 'hidden' : '';
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
  const buy = $('btnBuy');
  // 업그레이드 카드: 바탕 게이지 = 모은 골드 ÷ 가격 (가득 차면 살 수 있음). 저장하지 않고 매번 계산한다 (ux:ui-state)
  const card = (el, lv, val, cost, max) => {
    el.querySelector('.lv').textContent = `Lv.${lv}`;
    el.querySelector('.val').textContent = val;
    el.querySelector('.cost').innerHTML = max ? 'MAX' : COIN + ' ' + fmt(cost);
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
  // 절전모드: 가려진 전장은 그리지 않는다(전투 계산은 그대로), 가운데 셰프는 지금 스킨으로
  if (world) world.visible = !S.settings.saver;
  if (S.settings.saver && $('saverChef').dataset.skin !== S.skin) { $('saverChef').dataset.skin = S.skin; $('saverChef').src = skinThumb[S.skin] || `${IMG}hero_chef.webp`; }
  const full = !S.grid.includes(0);
  buy.querySelector('.cost').innerHTML = full ? t('tools.full') : COIN + ' ' + fmt(costBuy());
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
    if (plan.gold > 0) { popText(P.x, P.y - 130, '+' + fmt(plan.gold), 'gold big'); coinBurst(FW / 2, FH * 0.5, 30); }
    renderGrid(); updateUI(); save();
    banner(`STAGE ${S.stage}`);
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
      <div class="off-arrow">▶</div>
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
  gemBurst(FW / 2, FH * 0.55, 5);
  popText(P.x, P.y - 140, '+' + fmt(g), 'gold big'); Sound.play('claim');
  coinBurst(FW / 2, FH * 0.55, 18);
  updateUI(); save();
};
$('btnBonus').onclick = () => {
  if (!S.daily || S.daily.bonus || !S.daily.ids.every((id) => S.daily.claimed[id])) return;
  S.daily.bonus = true; S.stars += 1; S.gems += 20;
  gemBurst(FW / 2, FH * 0.55, 12);
  banner(`${t('mission.star_banner')}<small>${t('common.star_use')}</small>`, 2);
  Sound.play('prestige'); renderGrid(); updateUI(); save();
};
function updateMissions() {
  ensureDaily();
  let ready = false;
  document.querySelectorAll('#missionList .mission').forEach((row) => {
    const id = row.dataset.mid, m = MISSIONS.find((x) => x.id === id);
    const p = Math.min(m.n, Math.floor(S.daily.prog[id] || 0)), done = p >= m.n, got = !!S.daily.claimed[id];
    row.querySelector('.stat').textContent = id === 'time' ? t('mission.minutes', { n: Math.floor(p / 60), total: m.n / 60 }) : `${p} / ${m.n}`;
    row.querySelector('.bar2 i').style.width = (p / m.n) * 100 + '%';
    const b = row.querySelector('.act');
    b.innerHTML = got ? t('mission.claimed') : done ? `${t('mission.claim')}<span class="cost">${COIN} ${fmt(missionGold())} · ${GEM} 5</span>` : t('mission.progress');
    b.disabled = got || !done;
    b.classList.toggle('claimed', got);
    row.classList.toggle('done', got);
    if (done && !got) ready = true;
  });
  const all = S.daily.ids.every((id) => S.daily.claimed[id]);
  const bb = $('btnBonus');
  bb.innerHTML = S.daily.bonus ? t('mission.claimed') : `${t('mission.claim')}<span class="cost">${STAR} 1 · ${GEM} 20</span>`;
  bb.disabled = S.daily.bonus || !all;
  bb.classList.toggle('claimed', S.daily.bonus);
  if (all && !S.daily.bonus) ready = true;
  // 자정까지 남은 시간
  const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const left = Math.max(0, (mid - now) / 1000);
  $('missionHint').textContent = t('mission.hint', { h: Math.floor(left / 3600), m: Math.floor((left % 3600) / 60) });
  return ready;
}

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
  $('starBonus').textContent = S.stage < PRESTIGE_MIN ? t('prestige.need', { min: PRESTIGE_MIN, now: S.stage }) : S.prestiges ? t('prestige.count', { n: S.prestiges }) : '';
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
    }, t('common.cancel'), { peek: `${IMG}illust_prestige.webp` });
};

// ---------- ⚙️ 설정 ----------
const GAME_VERSION = 'v0.1';
function applySettings() {
  const st = S.settings;
  Sound.setSfx(st.sfx); Sound.setMusic(st.music);
  if (app) app.ticker.maxFPS = st.saver ? 30 : 0; // 절전: 30fps
  $('saverScreen').classList.toggle('on', !!st.saver); // 절전: 전장을 가리는 화면 (그림은 updateUI에서)
  fit();                                          // 절전: 백버퍼 해상도 낮춤
  document.querySelectorAll('#settings .switch').forEach((b) => b.classList.toggle('on', !!st[b.dataset.key]));
}
function openSettings() { applySettings(); $('settings').classList.remove('hidden'); paused = true; }
function closeSettings() { $('settings').classList.add('hidden'); paused = false; }
$('btnSettings').onclick = openSettings;
// 스테이지 아래 절전모드 알약: 설정의 절전 모드와 같은 값
$('gemLabel').onclick = (e) => { if (e.target.closest('.plus')) openSheet('shop'); };
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
  showModal(`<div class="title small">${t('rush.end_title')}</div>
    <p>${reason}<br>${t('rush.end_kills', { n: r.kills })}</p>
    ${best ? (hasTextArt('ui_tag_best') ? `<img class="tag-best" src="${IMG}ui_tag_best.webp" alt="${t('end.best')}">` : `<p>${t('end.best')}</p>`) : ''}
    <div class="reward">${GEM} ${r.gems}</div>
    <p class="sub">${t('end.tries_left', { n: RUSH_TRIES - rushToday().used, total: RUSH_TRIES })}</p>`, t('common.ok'), () => {
      Sound.play('clear');
      banner(`STAGE ${S.stage}`);
    });
}
$('btnRush').onclick = startRush;

// ---------- ⚔️ 스테이지 도전 (총고식): 챕터마다 한 번, 1분 안에 그 챕터 적을 모두 처치하면 💎 ----------
const CHAL_TIME = 60, CHAL_N = 40, CHAL_GEMS = 30, CHAL_GAP = 0.35;
let chal = null;
const chalOpen = (ci) => (S.bestStage || S.stage) > (ci + 1) * 10; // 그 챕터 강한 보스(10·20…)를 넘었으면 열린다
const chalArt = (ch, boss) => { const k = boss ? 'boss_' + ch.boss : 'enemy_' + ch.enemies[0]; return AVAIL.has(k) ? `${IMG}${k}.webp` : `${IMG}${boss ? 'boss_onion' : 'enemy_tomato'}.webp`; };
function buildChal() {
  $('chalList').innerHTML = CHAPTERS.map((ch, ci) => `
    <div class="row chal" data-ci="${ci}">
      <span class="big"><img src="${chalArt(ch)}" alt=""></span>
      <div class="info"><b>${t('chal.row', { n: ci + 1, name: ch.name })}</b><span class="desc">${t('chal.row_desc', { n: CHAL_N })}</span></div>
      <button class="act gem"></button>
    </div>`).join('');
  $('chalList').onclick = (e) => {
    const row = e.target.closest('.act') && e.target.closest('.chal');
    if (row) openChal(+row.dataset.ci);
  };
}
function openChal(ci) {
  if (S.chal[ci] || !chalOpen(ci) || rush || chal) return;
  const ch = CHAPTERS[ci];
  showModal(`<div class="chal-title">CHAPTER ${ci + 1}</div>
    <div class="chal-band">${t('chal.band', { place: ch.name, n: CHAL_N })}</div>
    <div class="chal-reward"><small>${t('chal.reward')}</small><span>${GEM}</span><b>${CHAL_GEMS}</b></div>`,
    t('chal.confirm'), () => startChal(ci), null, { peek: chalArt(ch, true), xClose: true, variant: 'chal' });
}
function startChal(ci) {
  if (rush || chal) return;
  closeSheet();
  clearField();
  heroHp = heroMax;
  chal = { ci, st: (ci + 1) * 10, t: CHAL_TIME, spawned: 0, kills: 0, spawnT: 0.4 };
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
  const first = ok && !S.chal[c.ci];
  if (first) { S.chal[c.ci] = true; S.gems += CHAL_GEMS; }
  save();
  showModal(`<div class="title small">${ok ? t('chal.win') : t('chal.lose')}</div>
    <p>${ok ? t('chal.win_desc', { c: c.ci + 1, n: CHAL_N }) : `${reason}<br>${t('chal.lose_desc', { n: c.kills, total: CHAL_N })}`}</p>
    ${first ? `<div class="reward">${GEM} ${CHAL_GEMS}</div>` : `<p class="sub">${t('chal.retry')}</p>`}`, t('common.ok'), () => {
      Sound.play('clear');
      banner(`STAGE ${S.stage}`);
    }, null, { peek: chalArt(CHAPTERS[c.ci], true) });
}

// ---------- ⚔️ 대군 모드 (2026-10-21): 60초 동안 약한 적이 끝없이 몰려온다 — 잡은 만큼 골드. 스테이지 도전(chal) 위에 얹는다 ----------
const HORDE_TIME = 60, HORDE_TRIES = 3, HORDE_MAX = 36, HORDE_BURST = 4, HORDE_GAP = 0.5;
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
    ${best ? (hasTextArt('ui_tag_best') ? `<img class="tag-best" src="${IMG}ui_tag_best.webp" alt="${t('end.best')}">` : `<p>${t('end.best')}</p>`) : ''}
    <div class="reward">${COIN} ${fmt(c.gold)}</div>
    <p class="sub">${t('end.tries_left', { n: HORDE_TRIES - hordeToday().used, total: HORDE_TRIES })}</p>`, t('common.ok'), () => {
      Sound.play('clear');
      banner(`STAGE ${S.stage}`);
    });
}
$('btnHorde').onclick = startHorde;

function updateShopRush() {
  let shopReady = false;
  document.querySelectorAll('#shopList [data-shop]').forEach((row) => {
    const it = SHOP.find((x) => x.id === row.dataset.shop), own = it.owned();
    row.querySelector('.lbl').textContent = it.label ? it.label() : '';
    const b = row.querySelector('.act');
    b.innerHTML = own ? t('shop.owned') : `${t('shop.buy')}<span class="cost">${GEM} ${it.price}</span>`;
    b.disabled = own || S.gems < it.price;
    b.classList.toggle('claimed', own);
    if (!own && it.id !== 'boost' && S.gems >= it.price) shopReady = true;
  });
  $('shopHint').innerHTML = t('shop.hint', { n: `<b>${GEM} ${fmt(S.gems)}</b>` });
  const r = rushToday(), left = RUSH_TRIES - r.used;
  $('rushTries').textContent = t('chal.tries', { n: left, total: RUSH_TRIES });
  $('rushBest').textContent = t('rush.best', { n: S.rushBest });
  $('btnRush').disabled = left <= 0 || !!rush;
  $('btnRush').textContent = rush ? t('chal.running') : left > 0 ? t('chal.start') : t('chal.tomorrow');
  let chalReady = false;
  document.querySelectorAll('#chalList .chal').forEach((row) => {
    const ci = +row.dataset.ci, done = !!S.chal[ci], open = chalOpen(ci), b = row.querySelector('.act');
    b.innerHTML = done ? t('chal.done') : open ? `${t('chal.go')}<span class="cost">${GEM} ${CHAL_GEMS}</span>` : `${icon('icon_lock', '🔒')}<span class="cost">${t('chal.locked', { n: (ci + 1) * 10 })}</span>`;
    b.disabled = done || !open || !!rush || !!chal;
    b.classList.toggle('claimed', done);
    row.classList.toggle('locked', !open);
    if (open && !done) chalReady = true;
  });
  const hLeft = HORDE_TRIES - hordeToday().used, hImg = chalArt(chapterOf(S.stage));
  if ($('hordeImg').dataset.src !== hImg) { $('hordeImg').dataset.src = hImg; $('hordeImg').src = hImg; } // 지금 챕터 적 그림
  $('hordeTries').textContent = t('chal.tries', { n: hLeft, total: HORDE_TRIES });
  $('hordeBest').textContent = t('horde.best', { n: S.hordeBest || 0 });
  $('btnHorde').disabled = hLeft <= 0 || !!rush || !!chal;
  $('btnHorde').textContent = chal && chal.horde ? t('chal.running') : hLeft > 0 ? t('chal.start') : t('chal.tomorrow');
  return { shopReady, rushReady: left > 0 || chalReady || hLeft > 0 };
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
  const ch = rush ? CHAPTERS[rush.kills % CHAPTERS.length] : chal ? CHAPTERS[chal.ci] : chapterOf(S.stage); // 러시는 잡을 때마다 다음 챕터 보스
  const est = chal ? chal.st : S.stage; // 도전은 그 챕터 강한 보스 스테이지 세기
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
  const bar = new PIXI.Container(); // 머리 위 체력 막대 (drawBar)
  // 발밑 그림자 — 셰프·동료와 같은 색·진하기. 몸(g)이 튀거나 찌그러져도 바닥에 남게 컨테이너에 둔다
  const shadow = new PIXI.Graphics().ellipse(0, r * 1.0, r * 1.15, r * 0.28).fill({ color: 0x000000, alpha: 0.18 });
  c.addChild(shadow, g, bar);
  // 지금 보이는 화면 바로 바깥(위·왼쪽·오른쪽)에서 들어온다
  let x, y;
  const side = boss ? 0 : Math.floor(Math.random() * 4); // 위쪽이 두 배로 자주
  if (side <= 1) { x = cam.x + 60 + Math.random() * (FW - 120); y = cam.y - 50; }
  else if (side === 2) { x = cam.x - 50; y = cam.y + 150 + Math.random() * (FH * 0.6); }
  else { x = cam.x + FW + 50; y = cam.y + 150 + Math.random() * (FH * 0.6); }
  c.position.set(x, y);
  field.addChild(c);
  const hp = enemyHp(est) * (boss ? BAL.bossHp : 1) * (wall ? WALL_HP : 1);
  const e = { c, g, bar, x, y, r, hp, max: hp, boss, speed: boss ? 34 : 50 + Math.random() * 22 + S.stage * 0.5,
    gold: enemyGold(est) * (boss ? BAL.bossGold : 1) * (wall ? BAL.wallGold : 1) * goldAll(), wall, hit: 0, dead: false, wob: Math.random() * 6, atkT: 0.3, lunge: 0, lx: 0, ly: 0, barY };
  drawBar(e);
  enemies.push(e);
}
// 적 머리 위 체력 막대: 일반 적은 맞았을 때만 손그림 ui_enemy_hp_*(240×36, 자르기 18), 보스는 빨강 + 왼쪽 왕관
const EHP_TEX_W = 240, EHP_TEX_H = 36, EHP_SLICE = 18;
function drawBar(e) {
  const b = e.bar, w = e.r * 2.2, r = Math.max(0, e.hp / e.max);
  b.visible = e.hp < e.max || e.boss;
  if (!b.visible) return;
  if (!b.built) {
    b.built = true;
    const art = !e.boss && ART.ui_enemy_hp_bg && ART.ui_enemy_hp_fill;
    if (art) {
      const opt = { leftWidth: EHP_SLICE, rightWidth: EHP_SLICE, topHeight: 0, bottomHeight: 0 };
      const h = w * EHP_TEX_H / EHP_TEX_W, sc = h / EHP_TEX_H;
      b.bg = new PIXI.NineSliceSprite({ texture: ART.ui_enemy_hp_bg, ...opt });
      b.fill = new PIXI.NineSliceSprite({ texture: ART.ui_enemy_hp_fill, ...opt });
      for (const sp of [b.bg, b.fill]) { sp.scale.set(sc); sp.position.set(-w / 2, e.barY); b.addChild(sp); }
      b.bg.width = EHP_TEX_W;
    } else {
      b.g = new PIXI.Graphics(); b.addChild(b.g);
      if (e.boss && ART.ui_boss_crown) { const cr = artSprite('ui_boss_crown', 30, 0.5); cr.position.set(-w / 2 - 10, e.barY + 4); b.addChild(cr); }
    }
  }
  if (b.fill) { b.fill.visible = r > 0; b.fill.width = Math.max(EHP_SLICE * 2, EHP_TEX_W * r); return; }
  b.g.clear().roundRect(-w / 2, e.barY, w, 8, 4).fill({ color: 0x000000, alpha: 0.5 });
  b.g.roundRect(-w / 2, e.barY, w * r, 8, 4).fill(e.boss ? 0xff4d6d : 0x7ee07e);
}
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
  while (enemies.length) removeEnemy(enemies[0]);
  while (bullets.length) bullets.pop().g.destroy();
  if (aimG) { aimG.visible = false; aimG.target = null; } // 잡던 적이 없어졌으니 조준 표시도 끈다
}
function resetWave() {
  wave = { idx: 0, total: waveCount(S.stage), spawned: 0, kills: 0, bossSpawned: false, spawnT: 0.8, breakT: 0 };
}
const isFinalWave = () => wave.idx === wave.total - 1;
function startWave() {
  if (isFinalWave()) {
    const wall = isWallStage(S.stage);
    if (wall) banner(t('battle.king', { boss: wallBossName(S.stage), hp: WALL_HP, sec: WALL_TIME }), 2);
    else banner(t('battle.boss', { sec: BOSS_TIME }), 1.6);
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
  const key = rush ? 'arena' : chal ? CHAPTERS[chal.ci].id : CHAPTERS[ci].id;
  if (key !== bgKey) {
    if (bgNode) bgNode.destroy({ children: true });
    bgNode = makeBackground(rush ? ARENA : chal ? CHAPTERS[chal.ci] : CHAPTERS[ci]);
    bgNode.zIndex = -2;
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
  const lap = Math.floor((S.stage - 1) / (10 * CHAPTERS.length));
  el.innerHTML = hasTextArt('ui_chapter_' + ch.id)
    ? `<img src="${IMG}ui_chapter_${ch.id}.webp" alt="${ch.name}">`
    : `<div class="sign"><small>${t('chapter.sign', { n: ci + 1 })}${lap ? t('chapter.lap', { n: lap + 1 }) : ''}</small><b>${ch.icon} ${ch.name}</b><span>${t('chapter.sign_sub')}</span></div>`;
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
  banner(`${t('battle.retreat')}<small>${retreatHint()}</small>`, 2.6);
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
  for (const e of [...enemies]) { popText(e.x, e.y, '💨', ''); removeEnemy(e); }
  S.stage++;
  S.bestStage = Math.max(S.bestStage || 0, S.stage); // 🏠 주방 레벨 기준 (환생해도 유지)
  resetWave();
  syncChapter();
  banner(isWallStage(S.stage) ? `${t('battle.stage', { n: S.stage })}<small>${t('battle.king_next', { boss: wallBossName(S.stage) })}</small>` : t('battle.stage', { n: S.stage }), isWallStage(S.stage) ? 2 : 1.4);
  Sound.play('clear');
  mission('stage');
  save();
}
// 공격 범위: 화면 가장자리·위쪽 표시(명판) 뒤의 적은 아직 노리지 않는다 — 들어오는 게 보인 뒤에 맞게 (2026-10-21 사용자 요청)
// 좌우 = 옆 메뉴 알약 폭, 위 = 스테이지 명판·절전모드 아래, 아래 = 카드 위. 셰프 가까이(AIM_NEAR) 온 적은 화면 안이면 언제나 노린다
const AIM_ZONE = { side: 110, top: 300, bottom: 40 }, AIM_NEAR = 220;
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
    const bar = makeHpBar(44, 33);
    bar.visible = false;
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
  if (ms.hp <= 0) { ms.hp = 0; ms.stun = 5; popText(ms.x, ms.y - 80, t('mates.stunned'), 'hurt'); Sound.play('stun'); }
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
function updateAim(t, dt) {
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
  // 보스 제한시간은 같이 나온 졸개를 다 잡은 뒤부터, 보스가 공격 범위에 들어온 뒤부터 줄어든다 (걸어 들어오는 동안 시간이 가지 않게)
  if (!rush && !chal && wave.bossSpawned && enemies.some((e) => e.boss && canAim(e)) && wave.spawned >= waveSize(wave.idx) && !enemies.some((e) => !e.boss)) {
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
      const dmg = enemyAtk(chal ? chal.st : S.stage) * (e.boss ? 3 : 1) * (chal && chal.horde ? HORDE_ATK : 1);
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

  // 총 발사 — 이번 프레임에 노리는 적 하나 (조준 표시도 이 적에)
  const iv = fireInterval();
  const aim = nearestEnemy();
  updateAim(aim, dt);
  S.grid.forEach((L, i) => {
    if (!L) return;
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
      e.hp -= b.dmg;
      e.hit = 0.12;
      const crit = e.boss || b.dmg >= e.max * 0.5;
      // 데미지 숫자는 흰색·초록을 반반 무작위로 (총고식, 2026-10-21) — 얻은 골드는 노랑
      if (S.settings.dmgNum) popText(e.x + (Math.random() - 0.5) * 40, e.y - e.r - 6, fmt(b.dmg), (crit ? (e.boss ? 'crit boss' : 'crit') : '') + (Math.random() < 0.5 ? ' green' : ''));
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
          popText(e.x, e.y - 60, t('battle.king_first'), 'crit'); gemBurst(e.x - cam.x, e.y - cam.y, 8);
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
  updateBubble(dt);
  updateCoins(dt);
  updateFx(dt);
  heroHp = Math.min(heroMax, heroHp + BAL.heroRegen * dt);
  $('vignette').classList.toggle('low', heroHp / heroMax < 0.35);
  $('vignette').classList.toggle('flash', P.hitT > 0);
  hero.hp.set(heroHp / heroMax);
  updateBossBar();

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
  await app.init({ width: FW, height: CH, background: '#e9dcc4', resolution: backbufferRes(), autoDensity: true, antialias: true });
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
  $('verLabel').textContent = t('settings.version', { ver: GAME_VERSION });
  renderGrid(); updateUI();

  // 처음이면 한 줄 설정, 아니면 자리 비운 동안의 보상
  if (!S.introSeen) {
    showModal(`${hasTextArt('ui_logo') ? `<img class="logo" src="${IMG}ui_logo.webp" alt="${t('game.title')}">` : `<div class="logo-text">${t('game.title')}</div>`}
      <img class="titleart" src="${IMG}ui_title_art.webp" alt="">
      <p>${t('intro.line1')}</p>
      <p class="sub">${t('intro.line2')}</p>`, t('intro.start'), () => { S.introSeen = true; save(); banner(`STAGE ${S.stage}`); }, null, { x: false });
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
