// 자막·엔드카드 PNG를 게임 글꼴(밑미)로 그린다: node overlays.mjs ko|en
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('/Users/jinkim/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const lang = process.argv[2] || 'ko';
const GAME = '/Users/jinkim/Documents/gamejam';
const TXT = {
  ko: { hook: '썩은 채소 군단 습격!', combat: '던지고! 쓰러뜨리고!', grow: '합성할수록 강해진다!', boss: '거대 대왕 보스 등장!', chapters: '주방부터 빵집까지!', cta: '지금 플레이', logo: 'logo_ko', places: ['주방', '냉장고 안', '식료품 창고', '레스토랑 홀', '빵집'] },
  en: { hook: 'ROTTEN VEGGIE ATTACK!', combat: 'THROW! SMASH!', grow: 'MERGE & POWER UP!', boss: 'GIANT KING BOSS!', chapters: 'KITCHEN TO BAKERY!', cta: 'PLAY NOW', logo: 'logo_en', places: ['Kitchen', 'Inside the Fridge', 'Pantry', 'Dining Hall', 'Bakery'] },
}[lang];
const out = path.join(HERE, 'ov', lang);
fs.mkdirSync(out, { recursive: true });
const css = `
@font-face { font-family: KR; src: url('file://${GAME}/assets/fonts/Ongeulip-Meetme.ttf'); }
html,body { margin:0; width:1080px; height:1920px; background:transparent; overflow:hidden; }
.sub { position:absolute; left:40px; right:40px; top:120px; text-align:center; font-family:KR; font-size:104px; line-height:1.08; color:#fff;
  -webkit-text-stroke:22px #3a2418; paint-order:stroke fill; text-shadow:0 10px 0 #2a1a10; letter-spacing:0.02em; }
.sub.left { text-align:left; left:56px; right:auto; top:96px; font-size:96px; }
.sub em { font-style:normal; color:#ffd34d; }
`;
const subs = { hook: TXT.hook, combat: TXT.combat, grow: TXT.grow, boss: TXT.boss, chapters: TXT.chapters };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
// about:blank에선 file:// 글꼴·그림이 막혀서 파일로 써서 연다
const tmp = path.join(out, '_page.html');
page.setContent = async (html) => { fs.writeFileSync(tmp, '<!doctype html><meta charset="utf-8">' + html); await page.goto('file://' + tmp); };
for (const [k, v] of Object.entries(subs)) {
  await page.setContent(`<style>${css}</style><div class="sub">${v}</div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, `sub_${k}.png`), omitBackground: true });
}
// 장소 이름표(게임 공식 이름): 진갈색 알약 + 흰 글자
for (const [i, name] of TXT.places.entries()) {
  await page.setContent(`<style>${css}
  .tag { position:absolute; left:0; top:0; display:inline-block; padding:14px 34px 18px; border-radius:40px; background:#3a2418e6; border:5px solid #fff3d6;
    font-family:KR; font-size:52px; color:#fff; -webkit-text-stroke:10px #3a2418; paint-order:stroke fill; white-space:nowrap; }</style><div class="tag">${name}</div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.tag').screenshot({ path: path.join(out, `tag_${i}.png`), omitBackground: true });
}
// 빨리감기 표시 ▶▶ (글자 없이 삼각형 둘)
await page.setContent(`<style>${css}
.ff { position:absolute; left:0; top:0; display:flex; gap:6px; align-items:center; padding:22px 30px; border-radius:60px; background:#3a2418e6; border:6px solid #fff3d6; }
.ff i { width:0; height:0; border-top:34px solid transparent; border-bottom:34px solid transparent; border-left:52px solid #ffd34d; filter:drop-shadow(0 4px 0 #2a1a10); }</style><div class="ff"><i></i><i></i></div>`);
await page.locator('.ff').screenshot({ path: path.join(out, 'ff.png'), omitBackground: true });
// 빨리감기 배지 바탕(가운데 아래): 크림 동그라미 + 진갈색 테두리 + 아래 ▶▶ 꼬리표 — 안의 모래시계(게임 2배속 아이콘)는 build.py가 돌려서 얹음
await page.setContent(`<style>${css}
.b { position:absolute; left:20px; top:10px; width:300px; height:360px; }
.c { position:absolute; left:20px; top:0; width:260px; height:260px; border-radius:50%; background:radial-gradient(circle at 50% 40%, #fffaf0, #ffe7b8);
  border:10px solid #3a2418; box-shadow:0 10px 0 #2a1a10, inset 0 -10px 0 #f3c97a; box-sizing:border-box; }
.t { position:absolute; left:50%; top:232px; transform:translateX(-50%); display:flex; gap:4px; padding:12px 26px 14px; border-radius:40px; background:#3a2418; border:5px solid #fff3d6; }
.t i { width:0; height:0; border-top:22px solid transparent; border-bottom:22px solid transparent; border-left:34px solid #ffd34d; }</style>
<div class="b"><div class="c"></div><div class="t"><i></i><i></i></div></div>`);
await page.screenshot({ path: path.join(out, 'ff_badge.png'), clip: { x: 0, y: 0, width: 340, height: 360 }, omitBackground: true });
// 엔드카드: 타이틀 그림 + 로고 + CTA (스토어 배지 없음 — 사용자 결정)
await page.setContent(`<style>${css}
.bg { position:absolute; inset:0; background:url('file://${HERE}/art/bg_title.png') center 35%/cover; }
.dim { position:absolute; inset:0; background:linear-gradient(#0000 0%, #0000 55%, #2a1a10cc 100%); }
.logo { position:absolute; left:50%; top:150px; width:980px; transform:translateX(-50%); filter:drop-shadow(0 12px 0 #2a1a1088); }
.cta { position:absolute; left:50%; top:1500px; transform:translateX(-50%); padding:34px 110px 42px; border-radius:80px; background:#7cc86a;
  border:8px solid #4b3021; box-shadow:inset 0 -14px 0 #4f9a45, inset 0 10px 0 #a6e08f, 0 12px 0 #2a1a10; font-family:KR; font-size:96px; color:#fff; white-space:nowrap;
  -webkit-text-stroke:18px #4b3021; paint-order:stroke fill; }
</style><div class="bg"></div><div class="dim"></div><img class="logo" src="file://${HERE}/art/${TXT.logo}.png"><div class="cta">${TXT.cta}</div>`);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(out, 'endcard.png') });
// 엔드카드 움직임용 레이어: 배경만 · 로고만 · CTA만(투명, 위치 기록)
const layers = {};
for (const sel of ['.logo', '.cta']) {
  const box = await page.locator(sel).boundingBox();
  const pad = 30;
  const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.min(1080, box.width + pad * 2), height: box.height + pad * 2 };
  await page.evaluate(() => { document.querySelector('.bg').style.visibility = 'hidden'; document.querySelector('.dim').style.visibility = 'hidden'; });
  await page.evaluate((sel) => { for (const el of document.querySelectorAll('.logo,.cta')) el.style.visibility = el.matches(sel) ? 'visible' : 'hidden'; }, sel);
  const name = sel.slice(1);
  await page.screenshot({ path: path.join(out, `end_${name}.png`), clip, omitBackground: true });
  layers[name] = clip;
}
await page.evaluate(() => { for (const el of document.querySelectorAll('.bg,.dim')) el.style.visibility = 'visible'; for (const el of document.querySelectorAll('.logo,.cta')) el.style.visibility = 'hidden'; });
await page.screenshot({ path: path.join(out, 'end_bg.png') });
fs.writeFileSync(path.join(out, 'end_layers.json'), JSON.stringify(layers));
await browser.close();
console.log('ok', out);
