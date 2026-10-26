// 가상 시계: 게임 시간을 바깥에서 __vc.advance(ms)로만 흘린다 (store:ua-pipeline 6.5)
(() => {
  if (window.__vc) return;
  let vt = 0;
  const D0 = Date.now();
  const RD = Date;
  performance.now = () => vt;
  class VDate extends RD {
    constructor(...a) { if (a.length) super(...a); else super(D0 + vt); }
    static now() { return D0 + vt; }
  }
  window.Date = VDate;
  let nid = 1;
  const timers = new Map();
  window.setTimeout = (fn, ms = 0, ...a) => { const id = nid++; timers.set(id, { fn, at: vt + Math.max(0, +ms || 0), iv: 0, a }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { const id = nid++; const iv = Math.max(1, +ms || 0); timers.set(id, { fn, at: vt + iv, iv, a }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  let raf = [];
  window.requestAnimationFrame = (cb) => { const id = nid++; raf.push([id, cb]); return id; };
  window.cancelAnimationFrame = (id) => { raf = raf.filter((r) => r[0] !== id); };
  const animBase = new WeakMap();
  function seekAnims() {
    for (const an of document.getAnimations()) {
      let b = animBase.get(an);
      if (!b) { b = { vt, cur: an.currentTime || 0 }; animBase.set(an, b); try { an.pause(); } catch (e) {} }
      try { an.currentTime = b.cur + (vt - b.vt); } catch (e) {}
    }
  }
  function runTimers(until) {
    for (let guard = 0; guard < 10000; guard++) {
      let best = null, bid = 0;
      for (const [id, t] of timers) if (t.at <= until && (!best || t.at < best.at)) { best = t; bid = id; }
      if (!best) break;
      vt = Math.max(vt, best.at);
      if (best.iv) best.at += best.iv; else timers.delete(bid);
      try { typeof best.fn === 'function' ? best.fn(...best.a) : eval(best.fn); } catch (e) { console.error('timer', e); }
    }
  }
  window.__vc = {
    get t() { return vt; },
    // 한 프레임: 시간 진행 → 타이머 → rAF → CSS 애니메이션 맞춤
    advance(ms) {
      const target = vt + ms;
      runTimers(target);
      vt = target;
      const q = raf; raf = [];
      for (const [, cb] of q) { try { cb(vt); } catch (e) { console.error('raf', e); } }
      seekAnims();
      return vt;
    },
  };
})();
