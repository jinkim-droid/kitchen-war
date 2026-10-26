// 🛠 치트 (개발·테스트용, 2026-10-21) — 미션 버튼 아래 버튼으로 연다
// 제출 빌드에서는 CHEAT_ON = false 로 끈다 (버튼이 아예 안 생긴다). 개발 도구라 문구는 strings.csv 에 넣지 않고 한국어로 둔다
const CHEAT_ON = false;
// main.js 가 읽는 값: 무적·한 방·속도 배수 (저장하지 않는다 — 새로 고치면 꺼진다)
const cheat = { god: false, oneshot: false, speed: 1, chalLockFrom: null }; // chalLockFrom: 이 챕터(0부터)부터 도전 잠금으로 보이기 (저장 안 바뀜)
const BACKUP_KEY = 'kitchen-war-save-backup'; // 처음 시작 미리보기 동안 원래 저장을 보관

if (CHEAT_ON) {
  const btn = document.createElement('button');
  btn.id = 'btnCheat';
  btn.textContent = '🛠';
  btn.setAttribute('aria-label', '치트');
  document.getElementById('field').appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'cheat';
  panel.className = 'hidden';
  document.getElementById('shell').appendChild(panel);

  const toast = (msg) => banner(`<small>🛠 ${msg}</small>`, 1);
  const jumpStage = (n) => {
    n = Math.max(1, Math.floor(n) || 1);
    if (rush || chal) return toast('도전 중에는 못 옮겨요');
    clearField();
    S.stage = n;
    S.bestStage = Math.max(S.bestStage || 1, n);
    resetWave(); syncChapter(false);
    heroHp = heroMax;
    save(); updateUI();
    banner(t('battle.stage', { n }), 1.2);
  };
  const toBoss = () => {
    if (rush || chal) return toast('도전 중에는 못 해요');
    clearField();
    wave.idx = wave.total - 1; wave.spawned = waveSize(wave.idx); wave.kills = 0; wave.bossSpawned = false; wave.breakT = 0.05;
  };

  const render = () => {
    panel.innerHTML = `<div class="box">
      <div class="title small">🛠 치트</div>
      <div class="ch-row"><b>스테이지</b><input id="chStage" type="number" min="1" value="${S.stage}"><button data-c="go">이동</button><button data-c="boss">보스로</button></div>
      <div class="ch-row"><b>전투</b><button data-c="god" class="${cheat.god ? 'on' : ''}">무적 ${cheat.god ? 'ON' : 'OFF'}</button><button data-c="oneshot" class="${cheat.oneshot ? 'on' : ''}">한 방 ${cheat.oneshot ? 'ON' : 'OFF'}</button></div>
      <div class="ch-row"><b>속도</b>${[1, 3, 10].map((s) => `<button data-c="spd" data-v="${s}" class="${cheat.speed === s ? 'on' : ''}">×${s}</button>`).join('')}</div>
      <div class="ch-row"><b>재화</b><button data-c="gold">골드 ×10</button><button data-c="gem">💎 +500</button><button data-c="star">⭐ +10</button></div>
      <div class="ch-row"><b>동료</b><button data-c="mates">전부 고용</button><button data-c="mateup">전부 +5 Lv</button><button data-c="matereset">초기화</button></div>
      <div class="ch-row"><b>보상</b><button data-c="attendreset">출석 리셋</button><button data-c="srwreset">스테이지 보상 리셋</button></div>
      <div class="ch-row"><b>도전</b><button data-c="chalopen">챕터 도전 전부 열기</button><button data-c="challv">전 챕터 Lv +5</button><button data-c="chalreset">도전 모드 리셋</button></div>
      <div class="ch-row"><b>잠금 보기</b><button data-c="lock" data-v="" class="${cheat.chalLockFrom == null ? 'on' : ''}">안 잠금</button><button data-c="lock" data-v="1" class="${cheat.chalLockFrom === 1 ? 'on' : ''}">2챕터부터 잠금</button><button data-c="lock" data-v="0" class="${cheat.chalLockFrom === 0 ? 'on' : ''}">전부 잠금</button><button data-c="usetries">러시·대군 횟수 다 쓰기</button></div>
      <div class="ch-row"><b>업그레이드</b><button data-c="upatk">공격·골드 +10</button><button data-c="upspd">공속 MAX</button><button data-c="upreset">초기화</button></div>
      <div class="ch-row"><b>도구</b><button data-c="toolbest">최고 도구 +1개</button><button data-c="toolup">전부 +1 등급</button><button data-c="toolreset">숟가락 하나만</button></div>
      <div class="ch-row"><b>스킨</b><button data-c="skinall">전부 획득</button><button data-c="skinreset">기본만</button></div>
      <div class="ch-row"><b>동료 강화</b><button data-c="rolemax">역할 강화 MAX</button><button data-c="rolereset">역할 강화 리셋</button></div>
      <div class="ch-row"><b>주방</b><button data-c="basebuild">건설 즉시 완료</button><button data-c="baseup">시설 전부 +1</button><button data-c="basefill">수확 꽉 채우기</button><button data-c="basereset">주방 초기화</button></div>
      <div class="ch-row"><b>미션·출석</b><button data-c="missionfill">오늘 미션 다 채우기</button><button data-c="attendnext">출석 하루 넘기기</button></div>
      <div class="ch-row"><b>기타</b><button data-c="boost">2배속 30분</button><button data-c="tut">튜토리얼 다시</button></div>
      <div class="ch-row"><b>새 게임</b><button data-c="newgame">새로 시작</button></div>
      <div class="ch-row"><b>초기화</b><button data-c="daily">오늘 횟수</button><button data-c="offline">오프라인 1시간</button></div>
      <div class="ch-row"><b>영상</b><button data-c="video">오프닝 영상 보기</button></div>
      <div class="ch-row"><b>첫 시작</b>${localStorage.getItem(BACKUP_KEY) ? '<button data-c="restore" class="on">원래 저장 되돌리기</button>' : '<button data-c="fresh">처음 시작 미리보기</button>'}</div>
      <button data-c="close" class="ch-close">닫기</button>
    </div>`;
  };
  btn.onclick = () => { render(); panel.classList.remove('hidden'); paused = true; };
  panel.onclick = (e) => {
    const b = e.target.closest('[data-c]');
    if (!b) { if (e.target === panel) { panel.classList.add('hidden'); paused = false; } return; }
    const c = b.dataset.c;
    if (c === 'close') { panel.classList.add('hidden'); paused = false; return; }
    if (c === 'go') { panel.classList.add('hidden'); paused = false; jumpStage(+$('chStage').value); return; }
    if (c === 'boss') { panel.classList.add('hidden'); paused = false; toBoss(); return; }
    if (c === 'god') cheat.god = !cheat.god;
    if (c === 'oneshot') cheat.oneshot = !cheat.oneshot;
    if (c === 'spd') cheat.speed = +b.dataset.v;
    if (c === 'gold') S.gold = Math.max(1000, S.gold * 10);
    if (c === 'gem') S.gems += 500;
    if (c === 'star') S.stars += 10;
    if (c === 'mates') { MATES.forEach((m) => { if (!mateLv(m)) S.mates[m.id] = 1; }); syncMates(); toast('동료 전부 고용'); }
    if (c === 'mateup') { MATES.forEach((m) => { S.mates[m.id] = mateLv(m) + 5; }); syncMates(); toast('동료 전부 +5 Lv'); }
    if (c === 'attendreset') { S.attend = { n: 0, last: '' }; attendSig = ''; attendShown = todayKey(); toast('출석 리셋 — 1일차부터'); } // 2026-10-22 사용자
    // 메뉴·플레이 테스트용 (2026-10-23 사용자: 필요한 치트 다)
    // 잠긴 모습·횟수 다 쓴 모습 확인용 (2026-10-23 사용자) — 잠금은 화면만(새로 고치면 풀림), 횟수는 오늘 것을 0으로
    if (c === 'lock') { cheat.chalLockFrom = b.dataset.v === '' ? null : +b.dataset.v; toast(cheat.chalLockFrom == null ? '도전 잠금 보기 끔' : `CHAPTER ${cheat.chalLockFrom + 1}부터 잠긴 모습`); }
    if (c === 'usetries') { rushToday().used = RUSH_TRIES; hordeToday().used = HORDE_TRIES; toast('보스 러시·대군 모드 오늘 횟수 다 씀 (되돌리기: 초기화 → 오늘 횟수)'); }
    if (c === 'chalopen') { S.bestStage = Math.max(S.bestStage || 1, 51); toast('챕터 도전 5개 전부 열림 (최고 스테이지 51로 — 주방 레벨도 같이 오름)'); }
    if (c === 'challv') { S.chalLv = S.chalLv || {}; CHAPTERS.forEach((_, ci) => { S.chalLv[ci] = chalCleared(ci) + 5; S.chal[ci] = true; }); toast('스테이지 도전 전 챕터 +5 단계'); }
    if (c === 'upatk') { S.atkLv += 10; S.goldLv += 10; toast('공격력·골드 획득량 +10 Lv'); }
    if (c === 'upspd') { S.spdLv = Math.ceil((BAL.spdMax - 1) / BAL.spdStep); toast('공격속도 MAX'); }
    if (c === 'upreset') { S.atkLv = 0; S.spdLv = 0; S.goldLv = 0; toast('업그레이드 카드 0 Lv'); }
    if (c === 'toolbest') { const i = S.grid.indexOf(0); if (i < 0) toast('도구함이 꽉 찼어요'); else { S.grid[i] = Math.max(1, ...S.grid); toast(`도구 Lv ${S.grid[i]} 추가`); } }
    if (c === 'toolup') { S.grid = S.grid.map((L) => (L ? L + 1 : 0)); toast('도구 전부 +1 등급'); }
    if (c === 'toolreset') { S.grid = [1, ...Array(S.grid.length - 1).fill(0)]; toast('도구함: 숟가락 하나만'); }
    if (c === 'skinall') { S.skins = SKINS.map((k) => k.id); toast('스킨 전부 획득'); }
    if (c === 'skinreset') { S.skins = ['brown']; S.skin = 'brown'; drawHero(hero, skinById('brown')); toast('스킨: 기본만'); }
    if (c === 'rolemax') { S.roleUp = { panda: BAL.roleUp.cost.length, frog: BAL.roleUp.cost.length, penguin: BAL.roleUp.cost.length }; syncMates(); toast('동료 역할 강화 MAX'); }
    if (c === 'rolereset') { S.roleUp = {}; syncMates(); toast('동료 역할 강화 리셋'); }
    if (c === 'basebuild') { if (S.base.build) { S.base.build.until = Date.now() - 1; baseTick(); baseDirty = true; toast('건설 즉시 완료'); } else toast('짓는 중인 시설이 없어요'); }
    if (c === 'baseup') { STATIONS.forEach((st) => { S.base.st[st.id] = stLv(st.id) + 1; }); baseDirty = true; toast('시설 전부 +1 Lv'); }
    if (c === 'basefill') { if (stLv('oven')) S.base.gold = ovenCap(); if (stLv('counter')) S.base.gems = counterCap(); baseDirty = true; toast('오븐·카운터 수확 꽉 채움 (빨간 점 확인용)'); }
    if (c === 'basereset') { S.base = freshBase(); baseDirty = true; toast('주방 초기화'); }
    if (c === 'missionfill') { ensureDaily(); S.daily.ids.forEach((id) => { const m = MISSIONS.find((x) => x.id === id); S.daily.prog[id] = m.n; }); toast('오늘 미션 다 채움 — 미션 창에서 받기'); }
    if (c === 'attendnext') { if (S.attend) S.attend.last = ''; attendSig = ''; attendShown = ''; toast('출석: 다음 날 칸을 지금 받을 수 있게'); }
    if (c === 'boost') { S.boostUntil = Math.max(Date.now(), S.boostUntil) + 30 * 60 * 1000; toast('2배속 30분'); }
    if (c === 'tut') { S.tut = 0; tutStart = performance.now(); toast('튜토리얼 처음부터'); }
    if (['upatk', 'upspd', 'upreset', 'toolbest', 'toolup', 'toolreset', 'skinall'].includes(c)) renderGrid();
    // 도전 모드 리셋 (2026-10-23 사용자): 스테이지 도전 단계(Lv 1부터)·보스 러시·대군 모드 오늘 횟수·최고 기록
    if (c === 'chalreset') { S.chal = {}; S.chalLv = {}; S.rush = null; S.horde = null; S.rushBest = 0; S.hordeBest = 0; toast('도전 모드 리셋 — 단계·횟수·최고 기록'); }
    // 새로 시작 (2026-10-23 사용자): 확인 후 저장을 지우고 처음부터 — 혹시 몰라 지우기 전 저장을 따로 남겨 둠(kitchen-war-save-before-new)
    if (c === 'newgame') {
      panel.classList.add('hidden');
      showModal('<div class="title small">새로 시작</div><p>지금 진행을 모두 지우고 처음부터 시작해요.<br><small>(지우기 전 저장은 따로 남겨 둠)</small></p>', '새로 시작', () => {
        save(); try { localStorage.setItem('kitchen-war-save-before-new', localStorage.getItem(SAVE_KEY) || ''); localStorage.removeItem(SAVE_KEY); localStorage.removeItem(BACKUP_KEY); } catch (e) {}
        window.__resetting = true; location.reload();
      }, t('common.cancel'));
      return;
    }
    if (c === 'srwreset') { S.stageRw = {}; stageRwSig = ''; toast('스테이지 보상 리셋 — 다시 받을 수 있음'); }
    if (c === 'matereset') { // 동료 전부 고용 전으로 (화면의 동료 그림도 지운다)
      S.mates = {};
      for (const id in mateSprites) { mateSprites[id].c.destroy({ children: true }); delete mateSprites[id]; }
      syncMates(); toast('동료 초기화');
    }
    if (c === 'daily') { S.daily = null; S.rush = null; S.horde = null; ensureDaily(); toast('미션·보스 러시·대군 모드 횟수 초기화'); }
    // 처음 시작 미리보기: 지금 저장을 따로 보관하고 새 게임으로 다시 켠다 → '원래 저장 되돌리기'로 복구 (2026-10-22)
    if (c === 'fresh') { save(); localStorage.setItem(BACKUP_KEY, localStorage.getItem(SAVE_KEY) || ''); localStorage.removeItem(SAVE_KEY); window.__noSave = true; location.reload(); return; }
    if (c === 'restore') { const b = localStorage.getItem(BACKUP_KEY); window.__noSave = true; if (b) localStorage.setItem(SAVE_KEY, b); localStorage.removeItem(BACKUP_KEY); location.reload(); return; }
    if (c === 'video') { panel.classList.add('hidden'); loadPrologue().then(() => playPrologue()); return; }
    if (c === 'offline') { panel.classList.add('hidden'); paused = false; offerOffline(3600); return; }
    save(); updateUI(); render();
  };
}
