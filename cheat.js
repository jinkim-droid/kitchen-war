// 🛠 치트 (개발·테스트용, 2026-10-21) — 미션 버튼 아래 버튼으로 연다
// 제출 빌드에서는 CHEAT_ON = false 로 끈다 (버튼이 아예 안 생긴다). 개발 도구라 문구는 strings.csv 에 넣지 않고 한국어로 둔다
const CHEAT_ON = true;
// main.js 가 읽는 값: 무적·한 방·속도 배수 (저장하지 않는다 — 새로 고치면 꺼진다)
const cheat = { god: false, oneshot: false, speed: 1 };
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
