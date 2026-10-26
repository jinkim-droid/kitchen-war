// 스토어 스크린샷(Google Play 1080×1920) 후보 캡처: node tools/aso/shots.mjs <shot> <ko|en>
// 360×640 @3x 뷰포트에서 실제 플레이로 진행하며 후보 스틸 여러 장 → out/<shot>_<lang>/c00.png …
// 진행 방식은 tools/ua/cap.mjs 와 같음(가상 시계, 시드 세이브). HUD는 그대로, 치트 버튼만 숨김
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('/Users/jinkim/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , shotName, lang = 'ko'] = process.argv;

const FPS = 30, DT = 1000 / FPS, VW = 360, VH = 640, DPR = 3;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function base(o = {}) {
  return Object.assign({
    gold: 5000, stage: 14, bestStage: 14, atkLv: 20, spdLv: 15, goldLv: 10, buys: 30,
    grid: [6, 6, 5, 5, 4, 4, 3, 2, 1, 0, 0, 0],
    skin: 'brown', skins: ['brown'], mates: { chick: 8, bunny: 5 }, roleUp: {}, introSeen: true, tut: 4,
    stars: 0, prestiges: 0, perm: { atk: 0, spd: 0, gold: 0 }, chal: {}, sound: true, daily: null,
    gems: 120, wallFirst: {}, stageRw: {}, attend: { n: 1, last: today() }, shop: { slots: 0, autoMerge: false, offline12: false },
    boostUntil: 0, rush: null, rushBest: 0, horde: null, hordeBest: 0,
    settings: { sfx: true, music: true, vibrate: true, dmgNum: true, shake: true, saver: false },
  }, o);
}

const SHOTS = {
  // ① 강한 보스전: 냉장고 대왕(20). 마지막 웨이브로 이동 → 등장 → 조이스틱으로 접근, 싸우는 동안 후보
  boss: {
    save: () => base({ stage: 20, bestStage: 20, atkLv: 22, spdLv: 16, grid: [6, 6, 6, 5, 5, 4, 4, 3, 2, 1, 0, 0], mates: { chick: 10, bunny: 7, penguin: 2 } }),
    async play(a) {
      await a.eval(() => { const st = document.createElement('style'); st.textContent = '.bubble,#topBar,#btnSettings,#track,#goldLabel,#gemLabel,#stageLabel,#btnSaver,#boostPill,#bossTimer,#bossBar,#btnMission,#banner,#chapterSign{visibility:hidden!important}'; document.head.appendChild(st); });
      await a.run(1.2);
      await a.eval(() => { clearField(); wave.idx = wave.total - 1; wave.spawned = waveSize(wave.idx); wave.kills = 0; wave.bossSpawned = false; wave.breakT = 0.05; });
      for (let i = 0; i < 60; i++) { await a.run(0.1); if (await a.eval(() => wave.bossSpawned)) break; }
      // 위쪽 HUD·게이지는 숨기고(사용자: 아래에 카피가 들어감) 보스를 셰프 위쪽에 — 캐릭터 무리가 화면 가운데보다 살짝 위. 조이스틱 없이(링 안 보이게) 자동 전투
      await a.eval(() => { const b = enemies.find((e) => e.boss); b.x = P.x + 10; b.y = P.y - 120; b.entered = true; });
      for (let i = 0; i < 16; i++) {
        await a.run(0.3);
        if (!(await a.eval(() => enemies.some((e) => e.boss && !e.dead)))) break;
        await a.eval(() => {
          // 셰프·동료·적을 같이 옮겨 무리 위치가 매 컷 같게
          const dx = WW / 2 - P.x, dy = (WH - CH + FH * 0.6 + 30) - P.y; // 카메라가 맵 아래 끝에 멈춰 셰프가 화면에서 30만큼 아래로 — 무리 중심이 가운데보다 살짝 위
          P.x += dx; P.y += dy;
          for (const id in mateSprites) { mateSprites[id].x += dx; mateSprites[id].y += dy; }
          for (const e of enemies) { e.x += dx; e.y += dy; }
          const b = enemies.find((e) => e.boss); b.x = P.x + 10; b.y = P.y - 120;
        }); await a.run(1 / 30);
        await a.still();
      }
    },
  },
  // ② 기본 전투: 주방(7) 일반 웨이브 + 적 추가(실제 웨이브 수준), 셰프 자동 전투
  combat: {
    save: () => base({ stage: 7, bestStage: 7, atkLv: 2, spdLv: 8, goldLv: 4, gold: 4000, grid: [3, 3, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0], mates: { chick: 2, bunny: 1 } }),
    async play(a) {
      await a.run(1.5);
      await a.eval(() => { clearField(); wave.idx = Math.max(0, wave.total - 2); wave.spawned = 0; wave.kills = 0; wave.breakT = 0.05; });
      await a.run(1.5);
      await a.eval(() => { for (let i = 0; i < 11; i++) spawnEnemy(false); for (const [k, e] of enemies.entries()) { const t = (k / enemies.length) * Math.PI * 2 + 0.3, d = 170 + (k % 3) * 55; e.x = P.x + Math.cos(t) * d; e.y = P.y + Math.sin(t) * d * 1.2; } });
      await a.run(0.4);
      for (let i = 0; i < 12; i++) { await a.run(0.2); await a.still(); }
    },
  },
  // ③ 도구 합성: 도구함 버튼 누르기 → 같은 레벨 끌어 합치기(끄는 중·합친 직후 후보)
  merge: {
    save: () => base({ stage: 12, bestStage: 12, atkLv: 12, spdLv: 10, gold: 12000, grid: [7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1], mates: { chick: 5, bunny: 3 } }),
    async play(a) {
      await a.run(2.0);
      await a.tap('.sbtn[data-tab="tools"]');
      await a.run(0.6);
      for (const [i, j] of [[2, 1], [4, 3], [6, 5]]) {
        const p = await a.center(`#grid .slot[data-i="${i}"]`), q = await a.center(`#grid .slot[data-i="${j}"]`);
        await a.page.mouse.move(p.x, p.y); await a.page.mouse.down(); await a.run(0.1);
        for (let k = 1; k <= 10; k++) { await a.page.mouse.move(p.x + (q.x - p.x) * k / 10, p.y + (q.y - p.y) * k / 10); await a.run(1 / 30); if (k === 6 || k === 10) await a.still(); }
        await a.page.mouse.up();
        for (let k = 0; k < 3; k++) { await a.run(0.1); await a.still(); }
        await a.run(0.4);
      }
    },
  },
  // ④ 동료: 동료 7종 다 데리고 빵집(44) — 홀은 바닥 무늬가 진해서 캐릭터가 묻힘(사용자) 전투 + 적 추가
  mates: {
    save: () => base({ stage: 44, bestStage: 44, atkLv: 6, spdLv: 20, gold: 90000, grid: [6, 6, 5, 5, 4, 4, 3, 2, 0, 0, 0, 0], mates: { chick: 20, bunny: 18, penguin: 15, squirrel: 12, fox: 10, panda: 8, frog: 6 }, prestiges: 1, settings: { sfx: true, music: true, vibrate: true, dmgNum: false, shake: true, saver: false } }),
    async play(a) {
      await a.run(2.0);
      await a.eval(() => { clearField(); wave.idx = Math.max(0, wave.total - 2); wave.spawned = 0; wave.kills = 0; wave.breakT = 0.05; });
      await a.run(1.5);
      await a.eval(() => { for (let i = 0; i < 5; i++) spawnEnemy(false); for (const [k, e] of enemies.entries()) { const t = (k / enemies.length) * Math.PI * 2 + 0.3, d = 230 + (k % 3) * 50; e.x = P.x + Math.cos(t) * d; e.y = P.y + Math.sin(t) * d * 1.2; } });
      await a.run(0.4);
      for (let i = 0; i < 10; i++) { await a.run(0.25); await a.still(); }
    },
  },
  // ⑤ 스킨: 여러 벌 모은 상태에서 스킨 버튼 누르기 → 스킨 목록
  skins: {
    save: () => base({ stage: 28, bestStage: 28, atkLv: 18, spdLv: 16, skin: 'wizard', skins: ['brown', 'pirate', 'patissier', 'santa', 'ninja', 'hanbok', 'wizard', 'sushi', 'pizza'], mates: { chick: 8, bunny: 6, penguin: 3 }, gems: 860 }),
    async play(a) {
      await a.run(2.0);
      await a.tap('.sbtn[data-tab="skins"]');
      for (let i = 0; i < 4; i++) { await a.run(0.3); await a.still(); }
    },
  },
  // ⑥ 방치 보상: 빵집(46)에서 8시간 비웠다 돌아온 화면
  offline: {
    save: () => base({ stage: 46, bestStage: 46, atkLv: 24, spdLv: 20, goldLv: 18, gold: 30000, grid: [8, 8, 7, 7, 6, 6, 5, 4, 0, 0, 0, 0], mates: { chick: 12, bunny: 9, penguin: 6, squirrel: 3 }, prestiges: 1 }),
    async play(a) {
      await a.run(2.0);
      await a.eval(() => offerOffline(8 * 3600));
      for (let i = 0; i < 4; i++) { await a.run(0.4); await a.still(); }
    },
  },
};

const shot = SHOTS[shotName];
if (!shot) { console.error('no shot', shotName, Object.keys(SHOTS)); process.exit(1); }
const outDir = path.join(HERE, 'out', `${shotName}_${lang}`);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await ctx.addInitScript({ path: path.join(HERE, '..', 'ua', 'vclock.js') });
await ctx.addInitScript(({ save, lang }) => {
  if (sessionStorage.getItem('__seeded')) return;
  sessionStorage.setItem('__seeded', '1');
  localStorage.setItem('kitchen-war-lang', lang);
  localStorage.setItem('kitchen-war-save-v1', JSON.stringify(Object.assign({}, save, { lastSeen: Date.now() })));
}, { save: shot.save(), lang });
const cdp = await ctx.newCDPSession(page);
const metrics = () => cdp.send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DPR, mobile: true });
await page.goto('http://127.0.0.1:8123/', { waitUntil: 'load' });
await metrics();
const step = () => page.evaluate((ms) => window.__vc.advance(ms), DT);
for (let i = 0; i < 400; i++) {
  await step();
  if (await page.evaluate(() => typeof app !== 'undefined' && app && app.renderer && !document.getElementById('bootCover'))) break;
  await new Promise((r) => setTimeout(r, 30));
}
await page.evaluate(() => { const st = document.createElement('style'); st.textContent = '#btnCheat{visibility:hidden!important}'; document.head.appendChild(st); });

let n = 0;
const a = {
  page,
  eval: (fn, arg) => page.evaluate(fn, arg),
  async run(sec) { const k = Math.round(sec * FPS); for (let i = 0; i < k; i++) await step(); },
  async center(sel) { return page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); },
  async tap(sel) { const p = await this.center(sel); if (!p) throw new Error('없는 대상 ' + sel); await page.mouse.move(p.x, p.y); await page.mouse.down(); await this.run(0.1); await page.mouse.up(); await this.run(0.2); },
  async still() {
    if (Math.abs((await page.evaluate(() => devicePixelRatio)) - DPR) > 0.01) await metrics();
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(data, 'base64');
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w !== VW * DPR || h !== VH * DPR) throw new Error(`해상도 어긋남 ${w}×${h}`);
    fs.writeFileSync(path.join(outDir, `c${String(n++).padStart(2, '0')}.png`), buf);
  },
};
await shot.play(a);
console.log(`${shotName}_${lang}: ${n} stills → ${outDir}`);
await browser.close();
