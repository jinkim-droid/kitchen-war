// 장면 정의: save() = 시드 세이브(정상 플레이로 도달 가능한 상태만), play(api) = 도달·녹화 순서
// 입력은 page.mouse(실제 포인터)로, 입력마다 전후 상태를 재서 반응을 기록한다(헛입력 게이트)
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
// 디클러터: 개발용 치트 버튼은 늘 숨김, top=true면 자막 띠(위쪽 HUD)도 숨김 — visibility만 바꾼다
async function declutter(a, { top = true, keepGold = false } = {}) {
  await a.eval(({ top, keepGold }) => {
    const st = document.createElement('style');
    st.textContent = `#btnCheat{visibility:hidden!important}` + (top ? `#topBar,#btnSettings,#track,#stageLabel,#btnSaver,#boostPill${keepGold ? '' : ',#goldLabel,#gemLabel'}{visibility:hidden!important}` : '');
    document.head.appendChild(st);
  }, { top, keepGold });
}
const snap = (a) => a.eval(() => ({ gold: S.gold, grid: S.grid.join(','), atkLv: S.atkLv, sheet: !document.getElementById('sheet').classList.contains('closed') }));
// 누르기: 손 자리 기록 → 누름 → 반응 확인 (상태가 그대로면 실패로 멈춘다)
async function tap(a, sel, holdSec = 0.25) {
  const p = await a.center(sel);
  if (!p) throw new Error('없는 대상 ' + sel);
  const before = await snap(a);
  await a.mark('tap', { x: p.x, y: p.y, sel });
  await a.page.mouse.move(p.x, p.y);
  await a.page.mouse.down();
  await a.rec(0.1);
  await a.page.mouse.up();
  await a.rec(holdSec);
  const after = await snap(a);
  if (JSON.stringify(before) === JSON.stringify(after)) throw new Error('헛입력 ' + sel);
  await a.mark('tap_ok', { sel, before, after });
}
async function dragSlot(a, i, j, sec = 0.6) {
  const p = await a.center(`#grid .slot[data-i="${i}"]`), q = await a.center(`#grid .slot[data-i="${j}"]`);
  const before = await snap(a);
  await a.mark('drag', { x: p.x, y: p.y, x2: q.x, y2: q.y });
  await a.page.mouse.move(p.x, p.y);
  await a.page.mouse.down();
  await a.rec(0.15);
  const n = Math.round(sec * 30);
  for (let k = 1; k <= n; k++) {
    const e = 1 - Math.pow(1 - k / n, 2);
    await a.page.mouse.move(p.x + (q.x - p.x) * e, p.y + (q.y - p.y) * e);
    await a.rec(1 / 30);
  }
  await a.page.mouse.up();
  await a.mark('drag_end', { x: q.x, y: q.y });
  await a.rec(0.6);
  const after = await snap(a);
  if (before.grid === after.grid) throw new Error('헛 드래그');
  await a.mark('drag_ok', { before: before.grid, after: after.grid });
}

// 대군 모드를 그 스테이지에서 시작. 도구 세기는 적이 3~4대 맞아야 쓰러지게(그 스테이지에 맞는 세이브와 같음)
async function hordeAt(a, st) {
  await a.eval((st) => {
    if (chal) chal = null;
    clearField(); S.horde = null; S.stage = st; resetWave(); syncChapter(false);
    S.atkLv = st < 15 ? 0 : 12; // 초반 스테이지는 공격력 카드 0 (그 스테이지의 실제 세기)
    const hp = enemyHp(st) * HORDE_HP, mul = 1 + BAL.atkStep * S.atkLv;
    const L = Math.max(1, Math.round(1 + Math.log(hp / 3.5 / mul / BAL.toolBase) / Math.log(BAL.toolMerge)));
    S.grid = [L, L, L, Math.max(1, L - 1), Math.max(1, L - 1), Math.max(1, L - 2), 0, 0, 0, 0, 0, 0];
    renderGrid(); heroHp = heroMax; startHorde();
  }, st);
}

// 연타: 같은 버튼을 gap 프레임마다 n번 — 누를 때마다 레벨이 오르는지 확인(헛입력이면 멈춤)
async function rapid(a, sel, n, gap = 4, key = 'atkLv', fx = 0.5, fy = 0.5) {
  // 누르는 자리: 버튼 안 비율(fx, fy) — 카드는 오른쪽 위(Lv 자리)를 눌러 손이 배수 숫자를 가리지 않게
  const p = await a.eval(({ sel, fx, fy }) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + r.height * fy }; }, { sel, fx, fy });
  const frames = [];
  for (let i = 0; i < n; i++) {
    const before = await a.eval((k) => S[k], key);
    frames.push(await a.eval(() => 0) ?? 0);
    await a.page.mouse.move(p.x, p.y);
    await a.page.mouse.down();
    frames[frames.length - 1] = (await a.eval(() => 0)) ?? 0;
    await a.mark('press');
    await a.rec(1 / 30);
    await a.page.mouse.up();
    await a.rec((gap - 1) / 30);
    if ((await a.eval((k) => S[k], key)) <= before) throw new Error('헛입력 연타 ' + sel + ' ' + i);
  }
  await a.mark('rapid', { x: p.x, y: p.y, sel, n, gap });
}

export default {
  test: { save: () => base(), async play(a) { await a.run(1); await a.still('boot'); await a.rec(1); } },

  // 훅: 대군 모드 — 식료품 창고(24), 적이 몰려든 뒤부터
  horde: {
    save: () => base({ stage: 24, bestStage: 24, atkLv: 12, spdLv: 14, grid: [4, 4, 4, 3, 3, 2, 2, 1, 0, 0, 0, 0], mates: { chick: 5, bunny: 3 } }),
    async play(a) {
      await declutter(a);
      await a.run(1.5);
      await a.eval(() => startHorde());
      await a.run(1.5);
      await a.mark('rec');
      for (let i = 0; i < 16; i++) { await a.rec(0.5); await a.mark('hp', { hp: await a.eval(() => Math.round(heroHp)), n: await a.eval(() => enemies.length) }); }
      await a.mark('end');
    },
  },

  // 핵심 전투: 레스토랑 홀(34) 대군 모드 — 적이 몰려든 뒤 조이스틱으로 무리 쪽으로 잠깐
  combat: {
    save: () => base({ stage: 34, bestStage: 34, atkLv: 12, spdLv: 25, goldLv: 12, gold: 90000, mates: { chick: 14, bunny: 10, penguin: 6, squirrel: 2 }, prestiges: 1 }),
    async play(a) {
      await declutter(a);
      await a.run(1.0);
      await hordeAt(a, 34);
      await a.run(4.0);
      await a.mark('rec', { n: await a.eval(() => enemies.length) });
      await a.rec(1.0);
      const hx = 360, hy = 1000, tx = 330, ty = 900;
      await a.mark('joy', { x: hx, y: hy, x2: tx, y2: ty });
      await a.page.mouse.move(hx, hy); await a.page.mouse.down();
      for (let k = 1; k <= 8; k++) { await a.page.mouse.move(hx + (tx - hx) * k / 8, hy + (ty - hy) * k / 8); await a.rec(1 / 30); }
      await a.rec(1.2);
      await a.page.mouse.up();
      await a.mark('joy_end');
      for (let i = 0; i < 12; i++) { await a.rec(0.5); await a.mark('n', { hp: await a.eval(() => Math.round(heroHp)), n: await a.eval(() => enemies.length), horde: await a.eval(() => !!(chal && chal.horde)) }); }
      await a.mark('end');
    },
  },

  // 일반 스테이지: 레스토랑 홀(34) 보스 앞 웨이브부터 손 안 대고 40초 — 셰프가 알아서 싸우고 보스 잡고 다음 스테이지로 (편집에서 뒤쪽을 빨리감기)
  // 위쪽 진행 바·Stage 표시는 보이게(일반 진행이라는 증거), 가운데 안내판(WAVE·STAGE)은 숨김
  stage: {
    save: () => base({ stage: 34, bestStage: 34, atkLv: 12, spdLv: 25, goldLv: 12, gold: 90000, grid: [7, 7, 7, 6, 6, 5, 4, 3, 2, 0, 0, 0], mates: { chick: 14, bunny: 10, penguin: 6, squirrel: 2 }, prestiges: 1 }),
    async play(a) {
      await declutter(a, { top: false });
      await a.eval(() => { const st = document.createElement('style'); st.textContent = '#banner,#chapterSign{visibility:hidden!important}'; document.head.appendChild(st); });
      await a.run(1.0);
      await a.eval(() => { clearField(); wave.idx = Math.max(0, wave.total - 2); wave.spawned = 0; wave.kills = 0; wave.breakT = 0.05; });
      await a.run(3.0);
      await a.mark('rec', { n: await a.eval(() => enemies.length) });
      // 다음 스테이지로 넘어간 뒤 2초까지 (최대 60초)
      let after = -1;
      for (let i = 0; i < 120; i++) {
        await a.rec(0.5);
        await a.mark('t', { w: await a.eval(() => wave.idx), boss: await a.eval(() => enemies.some((e) => e.boss)), n: await a.eval(() => enemies.length), hp: await a.eval(() => Math.round(heroHp)) });
        if (after < 0 && (await a.eval(() => S.stage)) > 34) after = i;
        if (after >= 0 && i - after >= 4) break;
      }
      await a.mark('end');
    },
  },

  // 방치 보상: 8시간 비웠다 돌아온 화면(오프라인 보상 창) → 받기(X) → 코인 터짐
  offline: {
    save: () => base({ stage: 18, bestStage: 18, atkLv: 16, spdLv: 14, goldLv: 10, gold: 3000, grid: [6, 6, 5, 5, 4, 4, 3, 2, 1, 0, 0, 0], mates: { chick: 9, bunny: 6 } }),
    async play(a) {
      await declutter(a);
      await a.run(1.5);
      await a.rec(0.3);
      await a.eval(() => offerOffline(8 * 3600));
      await a.mark('popup');
      await a.rec(1.4);
      const g0 = await a.eval(() => S.gold);
      // 받은 뒤 뜨는 'STAGE N' 안내판은 표시용이라 숨김 (보스 처치 뒤와 같게)
      await a.eval(() => { const st = document.createElement('style'); st.textContent = '#banner{visibility:hidden!important}'; document.head.appendChild(st); });
      await tap(a, '#modalX', 0.2);
      await a.rec(1.4);
      if ((await a.eval(() => S.gold)) <= g0) throw new Error('보상 안 들어옴');
      await a.mark('end', { gain: (await a.eval(() => S.gold)) - g0 });
    },
  },

  // 성장: 도구함 열기 → 구매 → 끌어서 합성 → 닫기 → 공격력 카드
  grow: {
    save: () => base({ stage: 8, bestStage: 8, atkLv: 8, spdLv: 6, goldLv: 4, buys: 12, gold: 9000, grid: [4, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0], mates: { chick: 3 } }),
    async play(a) {
      await declutter(a);
      await a.run(2.5);
      await a.rec(0.3);
      await tap(a, '.sbtn[data-tab="tools"]', 0.35);
      await dragSlot(a, 2, 1, 0.4);   // Lv3 + Lv3 → Lv4
      await dragSlot(a, 1, 0, 0.4);   // 바로 Lv4 + Lv4 → Lv5 (연쇄)
      // 도구함 닫기는 녹화하지 않음(사용자: 굳이 안 넣어도 됨) — 닫힌 화면에서 바로 이어 찍음
      await a.eval(() => closeSheet());
      await a.run(0.3);
      await a.mark('closed');
      await a.rec(0.2);
      await rapid(a, '#btnAtk', 12, 4, 'atkLv', 0.78, 0.28);   // 공격력 카드 연타
      await a.rec(0.15);
      await rapid(a, '#btnSpd', 6, 4, 'spdLv', 0.78, 0.28);    // 공격속도 카드 연타
      await a.rec(0.6);
      await a.mark('end');
    },
  },

  // 보스: 냉장고 대왕(20) — 마지막 웨이브로 바로(레벨 이동), 경고 → 등장 → 내려치기 → 처치
  boss: {
    save: () => base({ stage: 20, bestStage: 20, atkLv: 22, spdLv: 16, grid: [6, 6, 6, 5, 5, 4, 4, 3, 2, 1, 0, 0], mates: { chick: 10, bunny: 7, penguin: 2 } }),
    async play(a) {
      await declutter(a);
      await a.run(1.2);
      await a.eval(() => { clearField(); wave.idx = wave.total - 1; wave.spawned = waveSize(wave.idx); wave.kills = 0; wave.bossSpawned = false; wave.breakT = 0.05; });
      await a.mark('rec');
      // 대왕이 화면에 들어올 때까지
      // 대왕 등장(경고 1.8초 뒤) + 이름판 1초 — 그 뒤 바로 셰프를 대왕 쪽으로
      for (let i = 0; i < 60; i++) { await a.rec(0.1); if (await a.eval(() => wave.bossSpawned)) break; }
      await a.rec(1.0);
      // 조이스틱(빈 전장 누르고 위로 끌기)으로 셰프를 대왕 쪽으로 — 셰프는 혼자 두면 적에게서 멀어진다
      const hx = 360, hy = 1000;
      await a.mark('joy', { x: hx, y: hy, x2: hx, y2: hy - 110 });
      await a.page.mouse.move(hx, hy); await a.page.mouse.down();
      for (let k = 1; k <= 8; k++) { await a.page.mouse.move(hx, hy - 110 * k / 8); await a.rec(1 / 30); }
      let slams = 0, held = 0;
      for (let i = 0; i < 200; i++) {
        await a.rec(1 / 30); held++;
        const st = await a.eval(() => { const b = enemies.find((e) => e.boss && !e.dead); return { slam: b ? b.slam || 0 : 0, alive: !!b }; });
        if (st.slam > 0.22) { slams++; await a.mark('slam'); }
        if (!st.alive || slams >= 2 || held > 260) break;
      }
      await a.page.mouse.up();
      await a.mark('joy_end');
      // 처치 뒤 다음 스테이지 안내판(STAGE 21·장소 이름)은 표시용이라 숨김 — 보상(+450)은 그대로
      await a.eval(() => { const st = document.createElement('style'); st.textContent = '#banner,#chapterSign{visibility:hidden!important}'; document.head.appendChild(st); });
      // 대왕이 쓰러질 때까지(최대 12초)
      for (let i = 0; i < 120; i++) {
        await a.rec(0.1);
        if (!(await a.eval(() => enemies.some((e) => e.boss && !e.dead)))) { await a.mark('bossdead'); break; }
      }
      await a.rec(1.2);
      await a.mark('end');
    },
  },

  // 볼거리: 장소 5곳 — 장소마다 대군 모드(적이 몰려드는 실제 모드)를 1.4초씩
  chapters: {
    save: () => base({ stage: 48, bestStage: 48, atkLv: 12, spdLv: 25, mates: { chick: 3, bunny: 2 }, prestiges: 1 }),
    async play(a) {
      await declutter(a);
      await a.run(0.5);
      for (const n of [8, 18, 28, 38, 48]) {
        await hordeAt(a, n);
        await a.run(4.0);
        await a.mark('chapter', { n, en: await a.eval(() => enemies.length), hp: await a.eval(() => Math.round(heroHp)) });
        await a.rec(1.4);
      }
      await a.mark('end');
    },
  },
};
