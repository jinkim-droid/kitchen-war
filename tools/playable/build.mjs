// 플레이어블 광고 한 파일로 묶기: node tools/playable/build.mjs
// 입력: src/template.html + src/game.js + gen/img(prep.mjs 결과) + gen/sfx(ffmpeg 결과, README 참고) + 숫자 글꼴(mplus-num.woff2, OFL)
// 결과: builds/playable/KitchenWar_Playable_KR.html — 외부 요청 없이 혼자 돈다
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(ROOT, 'builds', 'playable');
const DEBUG = process.argv.includes('--debug'); // 시험용: 상태를 window.__pa로 꺼내 볼 수 있게 (배포 파일엔 안 들어감)
const OUT = path.join(OUT_DIR, DEBUG ? 'debug_KR.html' : 'KitchenWar_Playable_KR.html');
const LIMIT = 2 * 1024 * 1024; // 완료 기준: 2MB 이하

const b64 = (file) => fs.readFileSync(file).toString('base64');
const meta = JSON.parse(fs.readFileSync(path.join(HERE, 'gen', 'img.json'), 'utf8'));
const img = {};
for (const [k, v] of Object.entries(meta)) img[k] = { d: 'data:image/webp;base64,' + b64(path.join(HERE, 'gen', 'img', k + '.webp')), w: v.w, h: v.h };
const sfx = {};
for (const f of fs.readdirSync(path.join(HERE, 'gen', 'sfx')).filter((f) => f.endsWith('.mp3'))) sfx[f.replace('.mp3', '')] = 'data:audio/mpeg;base64,' + b64(path.join(HERE, 'gen', 'sfx', f));
const font = 'data:font/woff2;base64,' + b64(path.join(ROOT, 'assets', 'fonts', 'mplus-num.woff2'));

let html = fs.readFileSync(path.join(HERE, 'src', 'template.html'), 'utf8');
const game = fs.readFileSync(path.join(HERE, 'src', 'game.js'), 'utf8')
  .replace('/*DEBUG*/', DEBUG ? 'window.__pa = { G, slots, enemies, shots, get boss() { return boss; }, dps, attackers };' : '');
html = html.replace('/*FONT*/', () => font).replace('/*ASSETS*/', () => JSON.stringify({ img, sfx })).replace('/*GAME*/', () => game);

// 점검: 외부 주소를 부르는 곳이 없어야 한다 (스토어 주소 칸은 비어 있음)
const bad = html.replace(/data:[a-z/+0-9-]+;base64,[A-Za-z0-9+/=]+/g, '').match(/(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"')]*/gi) || [];
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);
const size = Buffer.byteLength(html);
const part = (o) => Object.values(o).reduce((a, v) => a + (typeof v === 'string' ? v : v.d).length, 0);
console.log('결과:', path.relative(ROOT, OUT));
console.log('크기:', (size / 1024 / 1024).toFixed(2), 'MB', size <= LIMIT ? '(2MB 이하 OK)' : '(2MB 넘음!)');
console.log('  그림', (part(img) / 1024).toFixed(0), 'KB · 소리', (part(sfx) / 1024).toFixed(0), 'KB · 글꼴', (font.length / 1024).toFixed(0), 'KB · 코드', (game.length / 1024).toFixed(0), 'KB (base64 포함)');
console.log('외부 주소:', bad.length ? bad : '없음');
if (size > LIMIT || bad.length) process.exit(1);
