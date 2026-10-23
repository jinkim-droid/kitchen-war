// 주방 대전쟁 — 효과음·BGM을 음원 파일 없이 Web Audio로 합성한다.
// 브라우저 정책상 첫 터치 이후에만 소리가 난다 (Sound.unlock).
const Sound = (() => {
  let ctx = null, master = null, sfxBus = null, musicBus = null;
  let sfxOn = true, musicOn = true;
  const last = {};

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      // 전체 볼륨 0.55 → 0.85 (2026-10-22 사용자: 폰에서 작게 들림). 소리가 겹쳐 깨지지 않게 끝에 리미터(압축기)를 둔다
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.15;
      limiter.connect(ctx.destination);
      master = ctx.createGain(); master.gain.value = 0.85; master.connect(limiter);
      sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.9 : 0; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.35 : 0; musicBus.connect(master);
      startMusic();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // 효과음·배경음악을 따로 켜고 끈다 (설정 창)
  function setSfx(v) {
    sfxOn = v;
    if (sfxBus) sfxBus.gain.setTargetAtTime(v ? 0.9 : 0, ctx.currentTime, 0.05);
  }
  function setMusic(v) {
    musicOn = v;
    if (musicBus) musicBus.gain.setTargetAtTime(v ? 0.35 : 0, ctx.currentTime, 0.1);
  }

  // 같은 소리가 너무 촘촘히 겹치지 않게
  function throttled(name, ms) {
    const now = performance.now();
    if (last[name] && now - last[name] < ms) return true;
    last[name] = now;
    return false;
  }

  function tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, delay = 0, bus = sfxBus } = {}) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, { vol = 0.15, freq = 2000, type = 'highpass', delay = 0 } = {}) {
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t);
  }

  const SFX = {
    throw: () => { if (!throttled('throw', 70)) noise(0.06, { vol: 0.05, freq: 3000 }); },
    hit: () => { if (!throttled('hit', 45)) tone(520, 0.06, { type: 'square', vol: 0.05, slide: -220 }); },
    kill: () => {
      if (throttled('kill', 60)) return;
      tone(660, 0.07, { type: 'triangle', vol: 0.12 });
      tone(990, 0.09, { type: 'triangle', vol: 0.1, delay: 0.05 });
    },
    coinTick: () => { if (!throttled('coinTick', 55)) tone(1500 + Math.random() * 300, 0.05, { type: 'triangle', vol: 0.05 }); },
    coin: () => { if (!throttled('coin', 90)) { tone(1320, 0.06, { vol: 0.1 }); tone(1760, 0.12, { vol: 0.1, delay: 0.06 }); } },
    buy: () => tone(700, 0.06, { type: 'triangle', vol: 0.12 }),
    merge: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.13, delay: i * 0.06 })),
    hurt: () => { if (!throttled('hurt', 150)) { tone(200, 0.16, { type: 'sawtooth', vol: 0.09, slide: -110 }); noise(0.08, { vol: 0.08, freq: 600, type: 'lowpass' }); } },
    stun: () => tone(900, 0.35, { type: 'sine', vol: 0.1, slide: -600 }),
    // 보스 경고: 사이렌처럼 높낮이 두 음을 세 번 (WARN_T 1.8초 안에)
    warn: () => { for (let i = 0; i < 3; i++) { tone(880, 0.22, { type: 'square', vol: 0.07, delay: i * 0.55 }); tone(660, 0.22, { type: 'square', vol: 0.07, delay: i * 0.55 + 0.25 }); } },
    boss: () => { tone(110, 0.5, { type: 'sawtooth', vol: 0.12 }); tone(82, 0.6, { type: 'sawtooth', vol: 0.12, delay: 0.25 }); },
    wall: () => { [98, 98, 73].forEach((f, i) => tone(f, 0.35, { type: 'sawtooth', vol: 0.15, delay: i * 0.22 })); noise(0.4, { vol: 0.12, freq: 300, type: 'lowpass', delay: 0.44 }); },
    bossHit: () => { if (!throttled('bossHit', 90)) noise(0.05, { vol: 0.07, freq: 900, type: 'lowpass' }); },
    clear: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.14, { type: 'square', vol: 0.08, delay: i * 0.09 })); [523, 659, 784, 1047].forEach((f) => tone(f, 0.5, { type: 'triangle', vol: 0.07, delay: 0.3 })); },
    retreat: () => [440, 330, 220].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.12, delay: i * 0.13 })),
    claim: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.15, { type: 'triangle', vol: 0.12, delay: i * 0.07 })),
    // ---------- 오프닝 영상 효과음 (2026-10-22) — 장면에 맞춰 main.js PROLOGUE_SFX가 부른다 ----------
    prDay: () => [72, 76, 79, 84, 79, 76, 79, 84].forEach((n, i) => tone(midiF(n), 0.22, { type: 'triangle', vol: 0.1, delay: i * 0.22 })),
    prNight: () => { [67, 63, 60, 55].forEach((n, i) => tone(midiF(n), 0.45, { type: 'sine', vol: 0.11, delay: i * 0.32 })); tone(midiF(43), 1.6, { type: 'sine', vol: 0.08 }); },
    prSmoke: () => { noise(1.6, { vol: 0.12, freq: 500, type: 'lowpass' }); tone(220, 1.4, { type: 'sine', vol: 0.06, slide: 180 }); tone(330, 1.2, { type: 'sine', vol: 0.04, slide: -120, delay: 0.3 }); },
    prKing: () => { [62, 62, 55].forEach((n, i) => tone(midiF(n - 24), 0.5, { type: 'sawtooth', vol: 0.16, delay: i * 0.3 })); noise(0.6, { vol: 0.18, freq: 250, type: 'lowpass', delay: 0.6 }); tone(midiF(74), 0.8, { type: 'square', vol: 0.05, slide: -300, delay: 1.0 }); },
    prMess: () => { for (let i = 0; i < 6; i++) noise(0.09, { vol: 0.12, freq: 1500 + Math.random() * 3000, delay: i * 0.13 + Math.random() * 0.05 }); tone(523, 0.12, { type: 'triangle', vol: 0.08, delay: 0.9 }); tone(392, 0.25, { type: 'triangle', vol: 0.08, delay: 1.05 }); },
    prShock: () => { tone(500, 0.35, { type: 'square', vol: 0.09, slide: 900 }); tone(1400, 0.12, { type: 'triangle', vol: 0.1, delay: 0.38 }); tone(1400, 0.12, { type: 'triangle', vol: 0.1, delay: 0.55 }); },
    prPan: () => { [1760, 2349, 3136].forEach((f, i) => tone(f, 0.9, { type: 'triangle', vol: 0.08 - i * 0.02 })); noise(0.05, { vol: 0.2, freq: 4000 }); [60, 64, 67, 72].forEach((n, i) => tone(midiF(n), 0.18, { type: 'square', vol: 0.07, delay: 0.5 + i * 0.12 })); tone(midiF(72), 0.6, { type: 'square', vol: 0.07, delay: 1.0 }); },
    prCharge: () => { noise(0.8, { vol: 0.1, freq: 900, type: 'bandpass' }); tone(200, 0.8, { type: 'sawtooth', vol: 0.06, slide: 500 }); },
    prBubbles: () => { for (let i = 0; i < 14; i++) tone(600 + Math.random() * 900, 0.08, { type: 'sine', vol: 0.09, slide: 500, delay: i * 0.08 + Math.random() * 0.04 }); },
    prestige: () => { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: i * 0.08 })); },
  };

  const midiF = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // 오프닝 영상 동안 배경음악을 잠깐 끈다
  function duckMusic(on) { if (musicBus) musicBus.gain.setTargetAtTime(on || !musicOn ? 0 : 0.35, ctx.currentTime, 0.15); }
  function play(name) {
    if (!ctx || !sfxOn || ctx.state !== 'running') return;
    const f = SFX[name];
    if (f) f();
  }

  // ---------- BGM: 밝은 주방 느낌의 짧은 루프 (C장조 오음계) ----------
  const BPM = 116, STEP = 60 / BPM / 2; // 8분음표
  const MEL = [72, 0, 76, 79, 76, 0, 74, 72, 69, 0, 72, 74, 76, 0, 0, 0,
               72, 0, 76, 79, 81, 0, 79, 76, 74, 0, 76, 74, 72, 0, 0, 0];
  const BASS = [48, 0, 55, 0, 45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0,
                48, 0, 55, 0, 45, 0, 52, 0, 41, 0, 43, 0, 48, 0, 0, 0];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  let step = 0, nextT = 0;
  function startMusic() {
    nextT = ctx.currentTime + 0.1;
    setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      if (!musicOn) { nextT = ctx.currentTime + 0.1; return; } // 꺼져 있으면 예약하지 않는다
      while (nextT < ctx.currentTime + 0.2) {
        const i = step % MEL.length, d = nextT - ctx.currentTime;
        if (MEL[i]) tone(midi(MEL[i]), STEP * 0.9, { type: 'triangle', vol: 0.06, delay: d, bus: musicBus });
        if (BASS[i]) tone(midi(BASS[i]), STEP * 1.6, { type: 'sine', vol: 0.09, delay: d, bus: musicBus });
        if (i % 4 === 2) {
          // 가벼운 하이햇
          const t = nextT, len = Math.ceil(ctx.sampleRate * 0.03);
          const buf = ctx.createBuffer(1, len, ctx.sampleRate), dd = buf.getChannelData(0);
          for (let k = 0; k < len; k++) dd[k] = (Math.random() * 2 - 1) * (1 - k / len);
          const s = ctx.createBufferSource(); s.buffer = buf;
          const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
          const g = ctx.createGain(); g.gain.value = 0.04;
          s.connect(f); f.connect(g); g.connect(musicBus); s.start(t);
        }
        nextT += STEP; step++;
      }
    }, 60);
  }

  // 앱을 내리면 소리를 멈추고, 돌아오면 다시 켠다
  function pause() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return { unlock, play, setSfx, setMusic, pause, resume, duckMusic, get state() { return ctx ? ctx.state : 'locked'; } };
})();
