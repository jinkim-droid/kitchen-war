// 장면 하나를 결정론적으로 캡처: node cap.mjs <scene> [lang]
// 결과: out/<scene>_<lang>/f00000.jpg … + log.json (프레임 수·소리 로그·마크)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('/Users/jinkim/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , sceneName, lang = 'ko', only] = process.argv;
const SCENES = (await import(path.join(HERE, 'scenes.mjs'))).default;
const scene = SCENES[sceneName];
if (!scene) { console.error('no scene', sceneName, Object.keys(SCENES)); process.exit(1); }

const FPS = 30, DT = 1000 / FPS, VW = 720, VH = 1280, DPR = 1.5;
const outDir = path.join(HERE, 'out', `${sceneName}_${lang}`);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, locale: lang === 'ko' ? 'ko-KR' : 'en-US' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await ctx.addInitScript({ path: path.join(HERE, 'vclock.js') });
// 시드 세이브 + 언어: 브라우저당 한 번
await ctx.addInitScript(({ save, lang }) => {
  if (sessionStorage.getItem('__seeded')) return;
  sessionStorage.setItem('__seeded', '1');
  localStorage.setItem('kitchen-war-lang', lang);
  const s = Object.assign({}, save, { lastSeen: Date.now() });
  localStorage.setItem('kitchen-war-save-v1', JSON.stringify(s));
}, { save: scene.save(), lang });
const cdp = await ctx.newCDPSession(page);
const metrics = () => cdp.send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DPR, mobile: false });

await page.goto('http://127.0.0.1:8123/', { waitUntil: 'load' });
await metrics();
// 부팅: 실제 시간으로 그림을 받는 동안 가상 시간도 조금씩 흘린다
const step = (ms = DT) => page.evaluate((ms) => window.__vc.advance(ms), ms);
for (let i = 0; i < 400; i++) {
  await step();
  const ok = await page.evaluate(() => typeof app !== 'undefined' && app && app.renderer && !document.getElementById('bootCover'));
  if (ok) break;
  await new Promise((r) => setTimeout(r, 30));
}
// 소리 로그
await page.evaluate(() => {
  window.__snd = [];
  const orig = Sound.play;
  Sound.play = (n) => { window.__snd.push({ t: window.__vc.t, n }); return orig(n); };
});

let frame = 0, recStart = null;
const marks = [];
const api = {
  page,
  // 캡처 없이 진행 (도달 단계)
  async run(sec) { const n = Math.round(sec * FPS); for (let i = 0; i < n; i++) await step(); },
  // 캡처하며 진행
  async rec(sec) {
    if (recStart === null) recStart = await page.evaluate(() => window.__vc.t);
    const n = Math.round(sec * FPS);
    for (let i = 0; i < n; i++) {
      await step();
      const dpr = await page.evaluate(() => devicePixelRatio);
      if (Math.abs(dpr - DPR) > 0.01) await metrics();
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      const buf = Buffer.from(data, 'base64');
      const w = buf.readUInt16BE ? jpegSize(buf) : null;
      if (frame === 0 || frame % 60 === 0) {
        if (!w || w[0] !== VW * DPR || w[1] !== VH * DPR) throw new Error(`해상도 어긋남 ${w}`);
      }
      fs.writeFileSync(path.join(outDir, `f${String(frame).padStart(5, '0')}.jpg`), buf);
      frame++;
      if (frame % 30 === 0) process.stdout.write(`.${frame}`);
    }
  },
  eval: (fn, arg) => page.evaluate(fn, arg),
  async mark(name, extra = {}) {
    const st = await page.evaluate(() => ({ gold: S.gold, stage: S.stage, kills: (typeof chal !== 'undefined' && chal) ? chal.kills : null, enemies: enemies.length, grid: S.grid.slice(), atkLv: S.atkLv }));
    marks.push({ name, frame, ...st, ...extra });
  },
  async still(name) { await page.screenshot({ path: path.join(outDir, `still_${name}.png`) }); },
  // 셸 좌표(디자인 px) → 화면 좌표
  async center(sel) {
    return page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
  },
};
function jpegSize(b) { let i = 2; while (i < b.length) { if (b[i] !== 0xff) return null; const m = b[i + 1], len = b.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc3) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + len; } return null; }

const t0 = Date.now();
await scene.play(api);
const snd = await page.evaluate(() => window.__snd);
fs.writeFileSync(path.join(outDir, 'log.json'), JSON.stringify({ scene: sceneName, lang, fps: FPS, frames: frame, recStart, sounds: snd.filter((s) => recStart !== null && s.t >= recStart).map((s) => ({ ...s, t: (s.t - recStart) / 1000 })), marks }, null, 1));
console.log(`\n${sceneName}_${lang}: ${frame} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
await browser.close();
