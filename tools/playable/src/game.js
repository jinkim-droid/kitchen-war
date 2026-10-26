// 주방 대전쟁 — 플레이어블 광고 (한 파일 HTML). 게임 본체(main.js)와 따로, 광고 장면만 Canvas 2D로 그린다.
// 흐름: 채소 대군 → 도구 끌어서 합성(3번) → 공격력 카드 → 경고 → 대왕 케이크 처치 → 엔드카드(누르면 스토어)
// 숫자 느낌은 게임과 같게: 도구 Lv1 공격력 4, 합성마다 ×2.6, 높은 도구 3개가 공격, 공격력 카드 +0.25배
(() => {
  'use strict';
  const A = window.__ASSETS;
  const CFG = {
    storeAndroid: '',   // 네트워크·캠페인마다 채운다
    storeIOS: '',
    bossBy: 26,         // 이 시간까지 보스가 안 나왔으면 바로 경고로
    maxT: 42,           // 무슨 일이 있어도 이 시간엔 엔드카드
  };
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const PALETTE = ['#9aa5b1', '#6cc070', '#4aa3df', '#a66cff'];
  const PALETTE_D = ['#6f7a86', '#4a944f', '#2f7bb0', '#7a48cc'];
  const INK = '#2a1a10', WOOD_D = '#4b3021', WOOD = '#6e4a34', CREAM = '#fff3dc', GOLD = '#ffd34d';
  const NUM = 'KWNum, -apple-system, "Helvetica Neue", Arial, sans-serif';

  // ---------- 화면: 논리 폭 720 기준, 세로는 화면 비율대로 늘어난다 ----------
  const cv = document.getElementById('c'), ctx = cv.getContext('2d');
  let dpr = 1, S = 1, W = 720, H = 1280, cx = 360;
  const LY = {};
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth || 360, vh = window.innerHeight || 640;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
    S = Math.min(vw / 720, vh / 1100);
    W = vw / S; H = vh / S; cx = W / 2;
    const panelH = 340;
    LY.py = H - panelH;
    LY.fieldTop = 230; // 벽 그림(높이 220) 아래부터 바닥
    LY.slots = [0, 1, 2, 3].map((i) => ({ x: cx - 304 + i * 156, y: LY.py + 42, w: 140, h: 140 }));
    LY.card = { x: cx - 304, y: LY.py + 206, w: 608, h: 108 };
    LY.chefX = cx; LY.chefY = LY.fieldTop + (LY.py - LY.fieldTop) * 0.66;
    LY.gold = { x: W - 24, y: 34 };
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- 그림 ----------
  const IMG = {};
  function loadImages() {
    return Promise.all(Object.entries(A.img).map(([k, v]) => new Promise((ok) => {
      const im = new Image();
      im.onload = () => { IMG[k] = { im, w: v.w, h: v.h }; ok(); };
      im.onerror = () => ok();
      im.src = v.d;
    })));
  }
  function whiteOf(k) { // 맞을 때 하얗게 번쩍 — 한 번 만들어 둔다
    const o = IMG[k]; if (!o) return null;
    if (o.white) return o.white;
    const c = document.createElement('canvas'); c.width = o.im.width; c.height = o.im.height;
    const g = c.getContext('2d'); g.drawImage(o.im, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    return (o.white = c);
  }
  // 그림 한 장: (x, y)에 기준점(ax, ay), 배율 s, 회전, 투명도, 좌우 뒤집기, 세로 배율
  function img(k, x, y, s = 1, ax = 0.5, ay = 0.5, rot = 0, alpha = 1, flip = 1, sy = 1, white = 0) {
    const o = IMG[k]; if (!o || alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale(s * flip, s * sy);
    ctx.globalAlpha *= Math.min(1, alpha);
    ctx.drawImage(o.im, -o.w * ax, -o.h * ay, o.w, o.h);
    if (white > 0) { ctx.globalAlpha *= white; ctx.drawImage(whiteOf(k), -o.w * ax, -o.h * ay, o.w, o.h); }
    ctx.restore();
  }

  // ---------- 소리 (첫 터치에 켠다) ----------
  const AU = { ctx: null, buf: {}, ready: false, bgm: null, master: null, last: {} };
  function unlockAudio() {
    if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { AU.ctx = new AC(); } catch (e) { return; }
    AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.9; AU.master.connect(AU.ctx.destination);
    Promise.all(Object.entries(A.sfx).map(([k, uri]) => new Promise((ok) => {
      const b = atob(uri.split(',')[1]), a = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
      try { AU.ctx.decodeAudioData(a.buffer, (buf) => { AU.buf[k] = buf; ok(); }, () => ok()); } catch (e) { ok(); }
    }))).then(() => { AU.ready = true; startBgm(); });
  }
  function sfx(k, vol = 1, gap = 0.05) {
    if (!AU.ready || !AU.buf[k]) return;
    const now = AU.ctx.currentTime;
    if (AU.last[k] && now - AU.last[k] < gap) return; // 같은 소리가 겹겹이 쌓이지 않게
    AU.last[k] = now;
    const s = AU.ctx.createBufferSource(); s.buffer = AU.buf[k];
    const g = AU.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(AU.master); s.start();
  }
  function startBgm() {
    if (AU.bgm || !AU.buf.bgm) return;
    const s = AU.ctx.createBufferSource(); s.buffer = AU.buf.bgm; s.loop = true;
    const g = AU.ctx.createGain(); g.gain.value = 0.4;
    s.connect(g); g.connect(AU.master); s.start();
    AU.bgm = { s, g };
  }
  document.addEventListener('visibilitychange', () => {
    if (!AU.ctx) return;
    if (document.hidden) AU.ctx.suspend(); else AU.ctx.resume();
  });

  // ---------- 스토어 / 광고 네트워크 ----------
  function openStore() {
    const url = isIOS ? CFG.storeIOS : CFG.storeAndroid;
    if (!url && !window.mraid && !window.ExitApi && !window.FbPlayableAd) { // 검수용(주소 없음): 다시 시작
      try { location.reload(); } catch (e) {}
      return;
    }
    try { if (window.mraid && typeof mraid.open === 'function') { mraid.open(url); return; } } catch (e) {}
    try { if (window.ExitApi && typeof ExitApi.exit === 'function') { ExitApi.exit(); return; } } catch (e) {}
    try { if (window.FbPlayableAd && typeof FbPlayableAd.onCTAClick === 'function') { FbPlayableAd.onCTAClick(); return; } } catch (e) {}
    if (url) window.open(url, '_blank');
  }

  // ---------- 게임 상태 ----------
  const G = { t: 0, phase: 'merge', phaseT: 0, gold: 40, goldShow: 40, atkLv: 1, merges: 0, taps: 0, lastInput: -9,
    shake: 0, endT: -1, clearT: -1, spawnT: 0, fireT: 0.4, fireIdx: 0, cardPop: 0, cardShake: 0 };
  const slots = [1, 1, 1, 1];          // 칸마다 도구 레벨 (0 = 빈칸)
  const slotPop = [0, 0, 0, 0];
  const refill = [];                    // [칸, 남은 시간] — 합성으로 빈 칸엔 숟가락을 새로 산다(게임의 '도구 구매')
  const enemies = [], shots = [], fxs = [], nums = [], coins = [];
  let boss = null, drag = null;
  const chef = { face: 1, squash: 0, t: 0, hurt: 0 };
  const ENEMY_KINDS = ['e_tomato', 'e_carrot', 'e_broccoli'];
  const ENEMY_HP = 26;
  const dmgOf = (L) => 4 * Math.pow(2.6, L - 1);
  const atkMul = () => 1 + 0.25 * (G.atkLv - 1);
  const cardCost = () => Math.round(15 * Math.pow(1.28, G.atkLv - 1));
  const attackers = () => slots.filter((l) => l > 0).sort((a, b) => b - a).slice(0, 3);
  const dps = () => attackers().reduce((a, l) => a + dmgOf(l), 0) * atkMul() / 0.75;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeOutBack = (u) => { u = clamp(u, 0, 1) - 1; return 1 + u * u * (2.7 * u + 1.7); };
  const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : String(Math.round(n)));

  function setPhase(p) { G.phase = p; G.phaseT = 0; }

  // ---------- 적 ----------
  function spawnEnemy(near) {
    const ft = LY.fieldTop;
    let x, y;
    const r = Math.random();
    if (near) { const a = rnd(0, Math.PI * 2), d = rnd(170, 300); x = LY.chefX + Math.cos(a) * d; y = clamp(LY.chefY + Math.sin(a) * d * 0.8, ft + 60, LY.py - 20); }
    else if (r < 0.5) { x = cx + rnd(-0.5, 0.5) * (W - 80); y = ft - 10; }
    else { x = r < 0.75 ? -50 : W + 50; y = rnd(ft + 40, LY.py - 40); }
    enemies.push({ k: ENEMY_KINDS[(Math.random() * 3) | 0], x, y, hp: ENEMY_HP, max: ENEMY_HP, flash: 0, wob: rnd(0, 6),
      sp: rnd(70, 105), stopR: rnd(95, 165), kbx: 0, kby: 0, atkT: rnd(0, 1), lunge: 0, born: G.t });
  }
  function hit(e, dmg, isBoss) {
    e.hp -= dmg; e.flash = 0.09;
    const dx = e.x - LY.chefX, dy = e.y - LY.chefY, d = Math.hypot(dx, dy) || 1;
    if (!isBoss) { e.kbx += (dx / d) * 120; e.kby += (dy / d) * 120; }
    const top = isBoss ? e.y - 300 : e.y - 90;
    nums.push({ x: e.x + rnd(-26, 26), y: top, v: fmt(dmg), t: 0, big: dmg >= 60 });
    fxs.push({ k: 'fx_hit', x: e.x + rnd(-14, 14), y: (isBoss ? e.y - 150 : e.y - 40) + rnd(-10, 10), t: 0, dur: 0.22, s: isBoss ? 1.2 : 0.8, rot: rnd(0, 6) });
    sfx(isBoss ? 'hit' : 'hit', 0.35, 0.06);
  }
  function killEnemy(e) {
    fxs.push({ k: 'fx_poof', x: e.x, y: e.y - 30, t: 0, dur: 0.4, s: 0.6, rot: 0 });
    for (let i = 0; i < 2; i++) coins.push(makeCoin(e.x, e.y - 40));
    G.gold += 7;
    sfx('kill', 0.5, 0.05);
  }
  function makeCoin(x, y) { const a = rnd(-Math.PI, 0); return { x, y, vx: Math.cos(a) * rnd(150, 300), vy: Math.sin(a) * rnd(200, 380), t: 0 }; }

  // ---------- 보스 (대왕 케이크) ----------
  function spawnBoss() {
    const hp = clamp(Math.round(dps() * 6.5), 450, 2400); // 지금 화력으로 6~7초 — 광고 길이를 지키려고
    boss = { x: LY.chefX, y: LY.fieldTop - 60, hp, max: hp, flash: 0, entered: false, slamT: 2.2, wind: 0, squash: 0, dead: false, t: 0 };
    sfx('boss', 0.8, 0);
  }

  // ---------- 던지기 ----------
  function nearestTarget() {
    let best = null, bd = 1e9;
    const consider = (e) => { const d = Math.hypot(e.x - LY.chefX, e.y - LY.chefY); if (d < bd) { bd = d; best = e; } };
    if (boss && !boss.dead && boss.y > LY.fieldTop + 40) return boss; // 대왕이 나오면 대왕만
    for (const e of enemies) if (!e.flee && e.x > -10 && e.x < W + 10 && e.y > LY.fieldTop - 30) consider(e);
    return best;
  }
  function throwTool(L, tgt) {
    const sx = LY.chefX + 34 * chef.face, sy = LY.chefY - 86;
    shots.push({ L, x: sx, y: sy, tgt, tx: tgt.x, ty: tgt.y - (tgt === boss ? 150 : 40), rot: 0, dmg: dmgOf(L) * atkMul() });
    chef.face = tgt.x < LY.chefX ? -1 : 1;
    chef.squash = 0.1;
    sfx('throw', 0.25, 0.08);
  }

  // ---------- 입력 ----------
  function pt(ev) { return { x: ev.clientX / S, y: ev.clientY / S }; }
  const inRect = (p, r, m = 0) => p.x >= r.x - m && p.x <= r.x + r.w + m && p.y >= r.y - m && p.y <= r.y + r.h + m;
  function slotAt(p, m = 10) { for (let i = 0; i < 4; i++) if (inRect(p, LY.slots[i], m)) return i; return -1; }
  function down(ev) {
    ev.preventDefault();
    unlockAudio();
    const p = pt(ev);
    G.lastInput = G.t;
    if (G.phase === 'end') { if (G.t - G.endT > 0.5) openStore(); return; }
    const i = slotAt(p);
    if (i >= 0 && slots[i] > 0) { drag = { from: i, x: p.x, y: p.y, ox: p.x - (LY.slots[i].x + 70), oy: p.y - (LY.slots[i].y + 70) }; return; }
    if (inRect(p, LY.card)) buyAtk();
  }
  function move(ev) {
    if (!drag) return;
    ev.preventDefault();
    const p = pt(ev); drag.x = p.x; drag.y = p.y; G.lastInput = G.t;
  }
  function up(ev) {
    if (!drag) return;
    const p = pt(ev), j = slotAt(p, 26), i = drag.from;
    drag = null; G.lastInput = G.t;
    if (j < 0 || j === i) return;
    if (slots[j] === slots[i] && slots[i] < 4) {   // 같은 레벨 → 합성
      slots[j] = slots[i] + 1; slots[i] = 0;
      slotPop[j] = 1; G.merges++;
      refill.push([i, 0.45]);
      const s = LY.slots[j];
      fxs.push({ k: 'fx_merge', x: s.x + 70, y: s.y + 70, t: 0, dur: 0.5, s: 1.1, rot: 0, ui: true });
      nums.push({ x: s.x + 70, y: s.y - 6, v: 'Lv ' + slots[j], t: 0, big: true, ui: true, color: GOLD });
      sfx('merge', 0.8, 0);
    } else {                                         // 다른 레벨·빈칸 → 자리 바꾸기
      const t = slots[j]; slots[j] = slots[i]; slots[i] = t; slotPop[j] = 0.5;
    }
  }
  function buyAtk() {
    if (G.gold < cardCost()) { G.cardShake = 0.3; return; }
    G.gold -= cardCost(); G.atkLv++; G.taps++; G.cardPop = 1;
    const c = LY.card;
    nums.push({ x: c.x + c.w / 2, y: c.y - 10, v: 'x' + atkMul().toFixed(2), t: 0, big: true, ui: true, color: '#94fa10' });
    sfx('buy', 0.7, 0);
  }
  cv.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', () => { drag = null; });

  // 합성 안내: 같은 레벨 둘 중 가장 높은 레벨(앞쪽 칸 → 뒤쪽 칸)
  function mergeHint() {
    for (let L = 3; L >= 1; L--) {
      const idx = []; slots.forEach((l, i) => { if (l === L) idx.push(i); });
      if (idx.length >= 2) return [idx[idx.length - 2], idx[idx.length - 1]];
    }
    return null;
  }

  // ---------- 진행 ----------
  function update(dt) {
    G.t += dt; G.phaseT += dt;
    chef.t += dt;
    G.goldShow += (G.gold - G.goldShow) * Math.min(1, dt * 10);
    // 단계
    if (G.phase === 'merge') {
      if (G.merges >= 3 || (G.t > 16 && G.merges >= 1)) setPhase('card');
      else if (G.t > CFG.bossBy) setPhase('warn');
    } else if (G.phase === 'card') {
      if (G.gold < cardCost() && G.taps === 0) G.gold = cardCost() + 2; // 안내하는데 못 사면 안 되니 첫 번째는 살 수 있게
      if ((G.taps > 0 && G.phaseT > 0 && G.t - G.lastInput > 2.2) || G.taps >= 5 || G.t > CFG.bossBy) setPhase('warn');
    } else if (G.phase === 'warn') {
      if (G.phaseT === dt) { sfx('warn', 0.9, 0); G.shake = 6; for (const e of enemies) e.flee = true; } // 대왕이 오면 채소들이 길을 비킨다
      if (G.phaseT > 2.1) { setPhase('boss'); spawnBoss(); }
    } else if (G.phase === 'boss') {
      if (boss && boss.dead && boss.t > 0.9) { setPhase('clear'); sfx('clear', 0.9, 0); }
    } else if (G.phase === 'clear') {
      if (G.phaseT > 1.9) startEnd();
    }
    if (G.phase !== 'end' && G.t > CFG.maxT) startEnd();

    // 빈칸 채우기
    for (let i = refill.length - 1; i >= 0; i--) {
      refill[i][1] -= dt;
      if (refill[i][1] <= 0) { const k = refill[i][0]; if (!slots[k]) { slots[k] = 1; slotPop[k] = 1; sfx('coin', 0.4, 0); } refill.splice(i, 1); }
    }
    for (let i = 0; i < 4; i++) slotPop[i] = Math.max(0, slotPop[i] - dt * 3);
    G.cardPop = Math.max(0, G.cardPop - dt * 3); G.cardShake = Math.max(0, G.cardShake - dt);
    G.shake = Math.max(0, G.shake - dt * 30);

    // 적 나오기 (경고부터는 멈춤)
    if (G.phase === 'merge' || G.phase === 'card') {
      G.spawnT -= dt;
      if (G.spawnT <= 0 && enemies.length < 18) { spawnEnemy(false); G.spawnT = rnd(0.35, 0.6); }
    }
    // 적 움직임
    for (const e of enemies) {
      e.flash = Math.max(0, e.flash - dt); e.wob += dt * 9;
      const dx = e.x - LY.chefX, dy = e.y - LY.chefY, d = Math.hypot(dx, dy) || 1;
      if (e.flee) { e.x += (dx / d) * 330 * dt; e.y += (dy / d) * 330 * dt; e.wob += dt * 6; continue; }
      const goal = e.stopR;
      if (d > goal) { const sp = Math.min(e.sp, (d - goal) * 3); e.x -= (dx / d) * sp * dt; e.y -= (dy / d) * sp * dt; }
      else { e.atkT -= dt; if (e.atkT <= 0) { e.atkT = rnd(0.9, 1.4); e.lunge = 0.25; chef.hurt = 0.15; } }
      e.lunge = Math.max(0, e.lunge - dt);
      e.x += e.kbx * dt; e.y += e.kby * dt; e.kbx *= Math.pow(0.002, dt); e.kby *= Math.pow(0.002, dt);
    }
    for (let i = enemies.length - 1; i >= 0; i--) { const e = enemies[i]; if (e.flee && (e.x < -80 || e.x > W + 80 || e.y < LY.fieldTop - 120 || e.y > LY.py + 60)) enemies.splice(i, 1); }
    // 서로 밀어내기
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j], dx = b.x - a.x, dy = (b.y - a.y) * 1.4, d = Math.hypot(dx, dy);
      if (d > 0 && d < 70) { const p = (70 - d) * 0.5 * Math.min(1, dt * 8); a.x -= (dx / d) * p; a.y -= (dy / d) * p; b.x += (dx / d) * p; b.y += (dy / d) * p; }
    }
    chef.hurt = Math.max(0, chef.hurt - dt);
    chef.squash = Math.max(0, chef.squash - dt * 0.6);

    // 보스
    if (boss) {
      boss.t += dt; boss.flash = Math.max(0, boss.flash - dt);
      if (!boss.dead) {
        const gy = LY.chefY - 190;
        if (boss.y < gy) boss.y = Math.min(gy, boss.y + 120 * dt); else boss.entered = true;
        if (boss.entered) {
          boss.slamT -= dt;
          if (boss.slamT <= 0.35 && boss.slamT > 0) boss.wind = 1 - boss.slamT / 0.35;
          if (boss.slamT <= 0) { boss.slamT = 2.3; boss.wind = 0; boss.squash = 0.18; G.shake = 9; chef.hurt = 0.25; sfx('boss', 0.45, 0); }
        }
        boss.squash = Math.max(0, boss.squash - dt * 0.7);
      }
    }

    // 던지기 (높은 도구 3개가 번갈아)
    if (G.phase !== 'end' && G.phase !== 'clear' && G.phase !== 'warn' || (G.phase === 'warn' && enemies.length)) {
      G.fireT -= dt;
      if (G.fireT <= 0) {
        const at = attackers(), tgt = nearestTarget();
        if (tgt && at.length) { throwTool(at[G.fireIdx % at.length], tgt); G.fireIdx++; G.fireT += 0.75 / at.length; }
        else G.fireT = 0.1;
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const alive = s.tgt && (s.tgt === boss ? !boss.dead : enemies.includes(s.tgt) && !s.tgt.flee);
      if (alive) { s.tx = s.tgt.x; s.ty = s.tgt.y - (s.tgt === boss ? 150 : 40); }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), sp = 1250 * dt;
      s.rot += dt * 16;
      if (d <= sp + 6) {
        shots.splice(i, 1);
        if (!alive) continue;
        if (s.tgt === boss) { hit(boss, s.dmg, true); if (boss.hp <= 0) killBoss(); }
        else { hit(s.tgt, s.dmg, false); if (s.tgt.hp <= 0) { killEnemy(s.tgt); enemies.splice(enemies.indexOf(s.tgt), 1); } }
      } else { s.x += (dx / d) * sp; s.y += (dy / d) * sp; }
    }
    // 연출
    for (let i = fxs.length - 1; i >= 0; i--) { fxs[i].t += dt; if (fxs[i].t > fxs[i].dur) fxs.splice(i, 1); }
    for (let i = nums.length - 1; i >= 0; i--) { nums[i].t += dt; if (nums[i].t > 0.8) nums.splice(i, 1); }
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]; c.t += dt;
      if (c.t < 0.3) { c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 1400 * dt; }
      else { const k = Math.min(1, dt * 9 + (c.t - 0.3) * dt * 30); c.x += (LY.gold.x - 150 - c.x) * k; c.y += (LY.gold.y - c.y) * k;
        if (Math.hypot(LY.gold.x - 150 - c.x, LY.gold.y - c.y) < 18) { coins.splice(i, 1); sfx('coin', 0.18, 0.07); } }
    }
  }
  function killBoss() {
    boss.dead = true; boss.t = 0; boss.hp = 0;
    G.shake = 16;
    for (let i = 0; i < 3; i++) fxs.push({ k: 'fx_poof', x: boss.x + rnd(-90, 90), y: boss.y - rnd(60, 220), t: -i * 0.12, dur: 0.6, s: 1.3, rot: 0 });
    for (let i = 0; i < 14; i++) coins.push(makeCoin(boss.x + rnd(-60, 60), boss.y - 140));
    G.gold += 300;
    sfx('kill', 0.9, 0);
    // 남은 적도 같이 날아간다
    for (const e of enemies) { fxs.push({ k: 'fx_poof', x: e.x, y: e.y - 30, t: -rnd(0, 0.3), dur: 0.4, s: 0.6, rot: 0 }); }
    enemies.length = 0;
  }
  function startEnd() { setPhase('end'); G.endT = G.t; drag = null; sfx('clear', 0.5, 0); if (AU.bgm) AU.bgm.g.gain.value = 0.22; }

  // ---------- 그리기 ----------
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function text(str, x, y, size, fill = '#fff', align = 'center', stroke = INK, lw = 0.2) {
    ctx.font = `900 ${size}px ${NUM}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (stroke) { ctx.lineWidth = size * lw; ctx.strokeStyle = stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = fill; ctx.fillText(str, x, y);
  }
  function bar(x, y, w, h, r, color) {
    rrect(x, y, w, h, h / 2); ctx.fillStyle = WOOD_D; ctx.fill();
    rrect(x + 3, y + 3, w - 6, h - 6, (h - 6) / 2); ctx.fillStyle = WOOD; ctx.fill();
    if (r > 0) { rrect(x + 3, y + 3, Math.max(h - 6, (w - 6) * r), h - 6, (h - 6) / 2); ctx.fillStyle = color; ctx.fill(); }
  }
  let floorPat = null;
  function drawField() {
    const fl = IMG.floor;
    if (fl && !floorPat) floorPat = ctx.createPattern(fl.im, 'repeat');
    if (floorPat) {
      const k = fl.w / fl.im.width;
      ctx.save(); ctx.translate(cx - 360, 0); ctx.scale(k, k);
      ctx.fillStyle = floorPat; ctx.fillRect(-(cx - 360) / k - 1, 0, W / k + 2, H / k);
      ctx.restore();
    } else { ctx.fillStyle = '#f3d6b5'; ctx.fillRect(0, 0, W, H); }
    const wl = IMG.wall;
    if (wl) for (let x = cx - 360 - Math.ceil((cx - 360) / wl.w) * wl.w; x < W; x += wl.w) ctx.drawImage(wl.im, x, 0, wl.w, wl.h);
    // 벽 아래 그림자
    const gr = ctx.createLinearGradient(0, wl ? wl.h : 200, 0, (wl ? wl.h : 200) + 26);
    gr.addColorStop(0, 'rgba(60,30,10,0.25)'); gr.addColorStop(1, 'rgba(60,30,10,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, wl ? wl.h : 200, W, 26);
  }
  function shadow(x, y, rx) { ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.28, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(60,30,10,0.22)'; ctx.fill(); }
  function drawActors() {
    const list = enemies.map((e) => ({ y: e.y, f: () => drawEnemy(e) }));
    list.push({ y: LY.chefY, f: drawChef });
    if (boss && !(boss.dead && boss.t > 0.5)) list.push({ y: boss.y, f: drawBoss });
    list.sort((a, b) => a.y - b.y).forEach((o) => o.f());
  }
  function drawEnemy(e) {
    const face = e.x < LY.chefX ? 1 : -1;
    const bob = Math.abs(Math.sin(e.wob)) * 5, ln = e.lunge > 0 ? Math.sin((e.lunge / 0.25) * Math.PI) * 14 : 0;
    const dx = LY.chefX - e.x, dy = LY.chefY - e.y, d = Math.hypot(dx, dy) || 1;
    const x = e.x + (dx / d) * ln, y = e.y + (dy / d) * ln;
    const appear = Math.min(1, (G.t - e.born) * 4);
    shadow(x, y, 30);
    img(e.k, x, y - bob, appear, 0.5, 1, Math.sin(e.wob) * 0.07, 1, face, 1, e.flash > 0 ? 0.8 : 0);
    if (e.hp < e.max) bar(x - 34, y - 98, 68, 14, e.hp / e.max, '#e8483a');
  }
  function drawChef() {
    const x = LY.chefX, y = LY.chefY;
    shadow(x, y, 50);
    const bob = Math.sin(chef.t * 6) * 0.02, sq = chef.squash + bob, hurt = chef.hurt > 0 ? Math.sin(chef.hurt * 60) * 4 : 0;
    img('chef', x + hurt, y + 4, 1, 0.5, 1, 0, 1, chef.face * (1 + sq), 1 - sq);
  }
  function drawBoss() {
    const b = boss;
    let s = 1, sy = 1, a = 1;
    if (b.wind > 0) { sy = 1 + b.wind * 0.12; s = 1 - b.wind * 0.05; }
    if (b.squash > 0) { sy = 1 - b.squash; s = 1 + b.squash * 0.6; }
    if (b.dead) { const u = b.t / 0.5; a = 1 - u; s *= 1 + u * 0.3; }
    shadow(b.x, b.y, 130);
    const walk = !b.entered && !b.dead ? Math.sin(G.t * 10) * 0.04 : 0;
    img('boss', b.x, b.y + 6, s, 0.5, 1, walk, a, 1, sy / s, b.flash > 0 ? 0.7 : 0);
    if (!b.dead) {
      bar(b.x - 150, b.y + 22, 300, 26, b.hp / b.max, '#e8483a');
      text(fmt(Math.max(0, b.hp)), b.x, b.y + 35, 20, '#fff', 'center', INK, 0.25);
    }
  }
  function drawShots() { for (const s of shots) img('tool' + s.L, s.x, s.y, 0.48, 0.5, 0.5, s.rot); }
  function drawFx(ui) {
    for (const f of fxs) {
      if (!!f.ui !== ui || f.t < 0) continue;
      const u = f.t / f.dur;
      img(f.k, f.x, f.y, f.s * (0.7 + u * 0.5), 0.5, 0.5, f.rot, 1 - u * u);
    }
  }
  function drawNums(ui) {
    for (const n of nums) {
      if (!!n.ui !== ui) continue;
      const u = n.t / 0.8, pop = n.t < 0.12 ? 0.6 + (n.t / 0.12) * 0.6 : 1.2 - Math.min(0.2, (n.t - 0.12));
      ctx.save(); ctx.globalAlpha = u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1;
      ctx.translate(n.x, n.y - u * 50); ctx.scale(pop, pop);
      text(n.v, 0, 0, n.big ? 46 : 34, n.color || (n.big ? '#94fa10' : '#fff'));
      ctx.restore();
    }
  }
  function drawCoins() { for (const c of coins) img('coin', c.x, c.y, 0.8); }
  function drawHud() {
    const g = LY.gold, w = 200, h = 58;
    rrect(g.x - w, g.y - h / 2, w, h, h / 2); ctx.fillStyle = 'rgba(42,26,16,0.75)'; ctx.fill();
    img('coin', g.x - w + 8, g.y, 1.15, 0, 0.5);
    text(fmt(G.goldShow), g.x - 22, g.y + 2, 34, '#fff', 'right');
  }
  function drawToolCard(L, x, y, w, h, s = 1, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-w / 2, -h / 2);
    rrect(0, 6, w, h, 18); ctx.fillStyle = INK; ctx.fill();
    rrect(0, 0, w, h, 18); ctx.fillStyle = PALETTE_D[L - 1]; ctx.fill();
    rrect(4, 4, w - 8, h - 12, 15); ctx.fillStyle = PALETTE[L - 1]; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; rrect(0, 0, w, h, 18); ctx.stroke();
    img('tool' + L, w / 2 + 6, h / 2 - 8, 0.95, 0.5, 0.5, -0.2);
    text('Lv ' + L, 14, h - 24, 26, '#fff', 'left');
    ctx.restore();
  }
  function drawPanel() {
    const py = LY.py;
    const endK = G.phase === 'end' ? clamp((G.t - G.endT) / 0.4, 0, 1) : 0; // 엔드카드에선 아래로 치운다
    if (endK >= 1) return;
    ctx.save(); ctx.translate(0, endK * endK * (H - py + 60));
    ctx.save();
    rrect(cx - 340, py, 680, H - py + 40, 30); ctx.fillStyle = CREAM; ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = WOOD_D; ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const s = LY.slots[i];
      rrect(s.x, s.y, s.w, s.h, 18); ctx.fillStyle = '#d9c7a8'; ctx.fill();
      rrect(s.x + 4, s.y + 4, s.w - 8, s.h - 8, 15); ctx.fillStyle = '#e8dac0'; ctx.fill();
      if (slots[i] && !(drag && drag.from === i)) drawToolCard(slots[i], s.x, s.y, s.w, s.h, 1 + Math.sin(slotPop[i] * Math.PI) * 0.15);
    }
    // 공격력 카드
    const c = LY.card, can = G.gold >= cardCost();
    const sh = G.cardShake > 0 ? Math.sin(G.cardShake * 60) * 6 : 0, sc = 1 + Math.sin(G.cardPop * Math.PI) * 0.06;
    ctx.save(); ctx.translate(c.x + c.w / 2 + sh, c.y + c.h / 2); ctx.scale(sc, sc); ctx.translate(-c.w / 2, -c.h / 2);
    rrect(0, 7, c.w, c.h, 22); ctx.fillStyle = INK; ctx.fill();
    rrect(0, 0, c.w, c.h, 22); ctx.fillStyle = can ? '#4f9a44' : '#b9b3ab'; ctx.fill();
    rrect(4, 4, c.w - 8, c.h - 12, 19); ctx.fillStyle = can ? '#7cc86a' : '#dcd8d3'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = INK; rrect(0, 0, c.w, c.h, 22); ctx.stroke();
    img('atk', 58, c.h / 2 - 2, 1.05);
    img('t_atk', 160, c.h / 2 - 22, 0.85);
    text('Lv.' + G.atkLv, 160, c.h / 2 + 22, 24, '#fff');
    text('x' + atkMul().toFixed(2), 330, c.h / 2, 46, '#fff');
    rrect(440, c.h / 2 - 26, 150, 52, 26); ctx.fillStyle = 'rgba(42,26,16,0.55)'; ctx.fill();
    img('coin', 462, c.h / 2, 0.95);
    text(fmt(cardCost()), 570, c.h / 2 + 2, 30, can ? '#fff' : '#ff8a8a', 'right');
    ctx.restore();
    ctx.restore();
    if (drag) drawToolCard(slots[drag.from], drag.x - drag.ox - 70, drag.y - drag.oy - 70, 140, 140, 1.1, 0.95);
  }
  // 안내 손 (게임 튜토리얼과 같은 손, 손끝이 그림 위 가운데)
  function drawHints() {
    const idle = G.t - G.lastInput;
    if (drag || idle < 1.2) return;
    if (G.phase === 'merge') {
      const h = mergeHint(); if (!h) return;
      const a = LY.slots[h[0]], b = LY.slots[h[1]];
      const u = (idle % 1.6) / 1.6, m = clamp((u - 0.15) / 0.6, 0, 1), e = m * m * (3 - 2 * m);
      const x = a.x + 70 + (b.x - a.x) * e, y = a.y + 70;
      if (u > 0.15 && u < 0.85) drawToolCard(slots[h[0]], x - 70, y - 70, 140, 140, 0.9, 0.55);
      const press = u > 0.15 && u < 0.8 ? 0.85 : 1;
      img('hand', x, y + 8, press, 0.5, 0);
      const by = LY.py - 64 + Math.sin(G.t * 5) * 5;
      img('t_merge', cx, by, 1);
    } else if (G.phase === 'card') {
      const c = LY.card, u = (G.t * 1.1) % 1, p = Math.sin(u * Math.PI);
      img('hand', c.x + 418, c.y + c.h / 2 + 4 - p * 16, 1 - p * 0.08, 0.5, 0);
      img('t_tap', cx, LY.py - 64 + Math.sin(G.t * 5) * 5, 1);
    }
  }
  let stripe = null;
  function drawWarn() {
    if (G.phase !== 'warn') return;
    const t = G.phaseT, a = 0.5 + 0.5 * Math.sin(t * 14);
    ctx.save();
    ctx.lineWidth = 36; ctx.strokeStyle = `rgba(232,72,58,${0.35 + a * 0.4})`; ctx.strokeRect(0, 0, W, H);
    const y = LY.fieldTop + (LY.py - LY.fieldTop) * 0.3, bh = 110, k = clamp(t / 0.25, 0, 1);
    if (!stripe) {
      const c = document.createElement('canvas'); c.width = c.height = 80; const g = c.getContext('2d');
      g.fillStyle = '#ffd34d'; g.fillRect(0, 0, 80, 80); g.fillStyle = '#1a1210';
      for (let i = -80; i < 160; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 20, 0); g.lineTo(i - 60, 80); g.lineTo(i - 80, 80); g.closePath(); g.fill(); }
      stripe = ctx.createPattern(c, 'repeat');
    }
    ctx.globalAlpha = k;
    ctx.fillStyle = stripe; ctx.save(); ctx.translate((t * 160) % 80, 0); ctx.fillRect(-80, y - bh / 2, W + 160, 18); ctx.fillRect(-80, y + bh / 2 - 18, W + 160, 18); ctx.restore();
    ctx.fillStyle = 'rgba(26,18,16,0.85)'; ctx.fillRect(0, y - bh / 2 + 18, W, bh - 36);
    text('WARNING', cx, y + 2, 64, '#ff5a4a', 'center', '#1a1210', 0.12);
    const s = easeOutBack(clamp((t - 0.2) / 0.4, 0, 1));
    img('t_boss', cx, y + bh / 2 + 70, s);
    ctx.restore();
  }
  function drawClear() {
    if (G.phase !== 'clear') return;
    const s = easeOutBack(clamp(G.phaseT / 0.45, 0, 1));
    img('t_clear', cx, LY.chefY - 260, s * 1.1);
  }
  function drawEnd() {
    if (G.phase !== 'end') return;
    const t = G.t - G.endT, k = clamp(t / 0.35, 0, 1);
    ctx.save();
    ctx.fillStyle = `rgba(42,26,16,${0.68 * k})`; ctx.fillRect(0, 0, W, H);
    // 빛줄기
    const ry = H * 0.56;
    ctx.translate(cx, ry); ctx.rotate(t * 0.35);
    ctx.fillStyle = `rgba(255,211,77,${0.16 * k})`;
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-70, -1100); ctx.lineTo(70, -1100); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    const ls = easeOutBack(clamp((t - 0.1) / 0.5, 0, 1)) * Math.min(1, (W - 40) / 600);
    img('logo', cx, H * 0.2 + Math.sin(t * 2.4) * 6, ls);
    const cs = easeOutBack(clamp((t - 0.25) / 0.5, 0, 1)) * 1.7;
    img('chef', cx, H * 0.64 - Math.abs(Math.sin(t * 4)) * 18, cs, 0.5, 1);
    // 지금 플레이
    const bs = easeOutBack(clamp((t - 0.45) / 0.45, 0, 1)) * (1 + Math.sin(t * 6) * 0.04);
    const by = H * 0.79;
    ctx.save(); ctx.translate(cx, by); ctx.scale(bs, bs);
    rrect(-220, -58 + 9, 440, 116, 58); ctx.fillStyle = INK; ctx.fill();
    rrect(-220, -58, 440, 116, 58); ctx.fillStyle = '#4f9a44'; ctx.fill();
    rrect(-214, -52, 428, 98, 50); ctx.fillStyle = '#7cc86a'; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = INK; rrect(-220, -58, 440, 116, 58); ctx.stroke();
    img('t_cta', 0, -2, 1.05);
    ctx.restore();
    if (t > 1) { const p = Math.sin(((t * 1.1) % 1) * Math.PI); img('hand', cx + 150, by + 20 - p * 16, 1 - p * 0.08, 0.5, 0); }
  }
  function render() {
    ctx.setTransform(S * dpr, 0, 0, S * dpr, 0, 0);
    ctx.save();
    if (G.shake > 0) ctx.translate(rnd(-1, 1) * G.shake, rnd(-1, 1) * G.shake);
    drawField();
    drawActors();
    drawShots();
    drawFx(false);
    drawNums(false);
    ctx.restore();
    drawCoins();
    drawHud();
    drawPanel();
    drawFx(true);
    drawNums(true);
    drawHints();
    drawWarn();
    drawClear();
    drawEnd();
  }

  // ---------- 시작 ----------
  let last = 0;
  function frame(ts) {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts;
    if (dt > 0) update(dt);
    render();
    requestAnimationFrame(frame);
  }
  async function boot() {
    await loadImages();
    try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('900 30px KWNum'), new Promise((r) => setTimeout(r, 800))]); } catch (e) {}
    for (let i = 0; i < 7; i++) spawnEnemy(true);
    requestAnimationFrame(frame);
  }
  function whenViewable(fn) {
    const m = window.mraid;
    if (!m) return fn();
    const go = () => {
      try { if (m.isViewable && !m.isViewable()) { const on = (v) => { if (v) { try { m.removeEventListener('viewableChange', on); } catch (e) {} fn(); } }; m.addEventListener('viewableChange', on); return; } } catch (e) {}
      fn();
    };
    try { if (m.getState() === 'loading') m.addEventListener('ready', go); else go(); } catch (e) { fn(); }
  }
  /*DEBUG*/
  whenViewable(boot);
})();
