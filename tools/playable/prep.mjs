// 플레이어블 광고용 그림 준비: node tools/playable/prep.mjs
// 게임 그림을 광고 화면 크기에 맞게 줄이고(논리 폭 720 기준 × EXPORT), 캐릭터·도구엔 진갈색 외곽선을 굽고,
// 한글 문구는 온글잎 밑미로 그림에 구워 둔다(라이선스상 글꼴 파일을 줄일 수 없으므로 글꼴은 넣지 않는다).
// 소리도 여기서 줄인다: 배경음악 32초 모노 48kbps, 효과음 모노 56kbps (ffmpeg 필요)
// 결과: tools/playable/gen/img/*.webp + gen/img.json(이름 → 크기) + gen/sfx/*.mp3. 게임 서버(8123)를 먼저 켠다.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('/Users/jinkim/.npm/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'gen', 'img');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const EXPORT = 1.6;          // 논리 1px → 그림 1.6px (폰 3배 화면에서 논리 720 폭 기준으로 충분)
const OUTLINE = 2.5;         // 외곽선 두께(논리 px) — 게임의 화면 기준 2px와 비슷한 굵기
const Q = 0.82;              // WebP 품질
// [이름, 원본, 화면 높이(논리 px), 외곽선, {w: 폭 기준}]
const IMGS = [
  ['chef', 'hero_chef', 150, true],
  ['tool1', 'tool_01_spoon', 92, true], ['tool2', 'tool_02_fork', 92, true],
  ['tool3', 'tool_03_chopsticks', 92, true], ['tool4', 'tool_04_knife', 92, true],
  ['e_tomato', 'enemy_tomato', 78, true], ['e_carrot', 'enemy_carrot', 78, true], ['e_broccoli', 'enemy_broccoli', 78, true],
  ['boss', 'king_fridge', 330, true],
  ['fx_merge', 'fx_merge', 170, false], ['fx_hit', 'fx_hit', 80, false], ['fx_poof', 'fx_poof', 110, false],
  ['hand', 'ui_tut_hand', 120, false], ['atk', 'icon_atk', 64, false], ['coin', 'icon_coin', 40, false],
  ['logo', 'ui_title_logo', 0, false, { w: 600 }],
  ['floor', 'bg_floor_tile', 240, false],
  ['wall', 'bg_wall', 0, false, { w: 720 }],
];
// 한글 문구: [이름, 글자, 크기(논리 px), 채움색]
const TEXTS = [
  ['t_merge', '끌어서 합성!', 56, '#ffffff'],
  ['t_tap', '눌러서 강화!', 56, '#ffffff'],
  ['t_boss', '대왕 케이크 등장!', 60, '#ffffff'],
  ['t_cta', '지금 플레이', 58, '#ffffff'],
  ['t_atk', '공격력', 30, '#ffffff'],
  ['t_clear', '클리어!', 96, '#ffd34d'],
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8123/lib/PIXI-LICENSE.txt'); // 같은 출처에서 그림을 읽어야 캔버스로 내보낼 수 있다
const res = await page.evaluate(async ({ IMGS, TEXTS, EXPORT, OUTLINE, Q }) => {
  const load = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });
  const out = {};
  const toWebp = (cv) => cv.toDataURL('image/webp', Q);
  // 모양을 따서 8~16방향으로 밀어 그린 뒤 그 위에 원본 → 외곽선
  function outline(src, w, h, t, color) {
    const pad = Math.ceil(t) + 1;
    const cv = document.createElement('canvas'); cv.width = w + pad * 2; cv.height = h + pad * 2;
    const g = cv.getContext('2d');
    const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
    const sg = sil.getContext('2d'); sg.drawImage(src, 0, 0, w, h);
    sg.globalCompositeOperation = 'source-in'; sg.fillStyle = color; sg.fillRect(0, 0, w, h);
    const dirs = 16;
    for (let i = 0; i < dirs; i++) { const a = (i / dirs) * Math.PI * 2; g.drawImage(sil, pad + Math.cos(a) * t, pad + Math.sin(a) * t); }
    g.drawImage(src, pad, pad, w, h);
    return cv;
  }
  for (const [name, file, showH, line, opt] of IMGS) {
    const im = await load('/assets/img/' + file + '.webp');
    let w, h;
    if (opt && opt.w) { w = Math.round(opt.w * EXPORT); h = Math.round(im.height * w / im.width); }
    else { h = Math.round(showH * EXPORT); w = Math.round(im.width * h / im.height); }
    // 크게 줄일 땐 반씩 줄여 계단 현상을 막는다
    let src = im, sw = im.width, sh = im.height;
    while (sw / 2 > w) { const c = document.createElement('canvas'); c.width = Math.round(sw / 2); c.height = Math.round(sh / 2); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); src = c; sw = c.width; sh = c.height; }
    let cv;
    if (line) cv = outline(src, w, h, OUTLINE * EXPORT, '#2a1a10');
    else { cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h); }
    out[name] = { data: toWebp(cv), w: cv.width / EXPORT, h: cv.height / EXPORT, pad: line ? (Math.ceil(OUTLINE * EXPORT) + 1) / EXPORT : 0 };
  }
  const ff = new FontFace('Meetme', 'url(/assets/fonts/Ongeulip-Meetme.ttf)');
  await ff.load(); document.fonts.add(ff);
  for (const [name, text, size, fill] of TEXTS) {
    const px = size * EXPORT, stroke = px * 0.16, sh = px * 0.08;
    const m = document.createElement('canvas').getContext('2d'); m.font = `${px}px Meetme`;
    const tw = Math.ceil(m.measureText(text).width);
    const cv = document.createElement('canvas'); cv.width = tw + stroke * 2 + 8; cv.height = Math.ceil(px * 1.3 + stroke * 2 + sh);
    const g = cv.getContext('2d');
    g.font = `${px}px Meetme`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const x = cv.width / 2, y = (cv.height - sh) / 2 + px * 0.04;
    g.lineWidth = stroke * 2; g.strokeStyle = '#2a1a10'; g.strokeText(text, x, y + sh);
    g.strokeStyle = '#4b3021'; g.strokeText(text, x, y);
    g.fillStyle = fill; g.fillText(text, x, y);
    out[name] = { data: toWebp(cv), w: cv.width / EXPORT, h: cv.height / EXPORT, pad: 0 };
  }
  return out;
}, { IMGS, TEXTS, EXPORT, OUTLINE, Q });
await browser.close();

const meta = {};
let total = 0;
for (const [name, v] of Object.entries(res)) {
  const buf = Buffer.from(v.data.split(',')[1], 'base64');
  fs.writeFileSync(path.join(OUT, name + '.webp'), buf);
  meta[name] = { w: +v.w.toFixed(1), h: +v.h.toFixed(1), pad: +v.pad.toFixed(2) };
  total += buf.length;
  console.log(name.padEnd(12), String(buf.length).padStart(7), 'B', `${meta[name].w}×${meta[name].h}`);
}
fs.writeFileSync(path.join(HERE, 'gen', 'img.json'), JSON.stringify(meta, null, 1));
console.log('그림 합계', (total / 1024).toFixed(0), 'KB');

// ---------- 소리 ----------
const SFX_OUT = path.join(HERE, 'gen', 'sfx');
const SRC = path.join(HERE, '..', '..', 'assets', 'sfx');
fs.rmSync(SFX_OUT, { recursive: true, force: true });
fs.mkdirSync(SFX_OUT, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args]);
ff(['-i', path.join(SRC, 'bgm_battle.mp3'), '-t', '32', '-af', 'afade=t=out:st=31:d=1', '-ac', '1', '-ar', '32000', '-b:a', '48k', path.join(SFX_OUT, 'bgm.mp3')]);
for (const k of ['merge', 'hit', 'kill', 'warn', 'boss', 'clear', 'buy', 'coin', 'throw'])
  ff(['-i', path.join(SRC, k + '.mp3'), '-ac', '1', '-ar', '32000', '-b:a', '56k', path.join(SFX_OUT, k + '.mp3')]);
const sTotal = fs.readdirSync(SFX_OUT).reduce((a, f) => a + fs.statSync(path.join(SFX_OUT, f)).size, 0);
console.log('소리 합계', (sTotal / 1024).toFixed(0), 'KB');
