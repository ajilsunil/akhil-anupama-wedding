// A & A touch sparkle (DESIGN.md H1): a glint burst and one faint hairline gold ring where a finger lands, and a
// light trail of motes while it drags (a scroll drag included). Passive listeners only: never blocks a tap or
// a scroll. Rings are pooled fixed elements animated with the Web Animations API. Returns destroy().
// Controls with their own press light (buttons, next-page circles, the monogram) get the glints but no ring.
const STEP = 24, GAP = 28, PER_SEC = 30, RINGS = 6, SIZE = 36, RING_MS = 380, OWN_LIGHT = '.btn, .next, [data-open]';
const EASE = 'cubic-bezier(.22,.61,.36,1)';

export function initTouch(fx, { reducedMotion = false, zIndex = 29 } = {}) {
  if (reducedMotion || typeof document === 'undefined' || !document.body) return () => {};
  const opt = { capture: true, passive: true };
  const down = new Map(); // 'p'+pointerId / 't'+touch identifier -> last trail point
  const free = [], rings = [], spawns = [];
  let touchEvents = false, lastSpawn = -1e9, dead = false;
  const call = (name, ...a) => { try { fx?.[name]?.(...a); } catch { /* the sparkle is optional */ } };

  function ring(x, y) {
    if (!document.body.animate) return; // no Web Animations: sparkle only
    let el = free.pop();
    if (!el) {
      if (rings.length < RINGS) {
        el = document.createElement('div');
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = `position:fixed;left:0;top:0;width:${SIZE}px;height:${SIZE}px;margin:${-SIZE / 2}px 0 0 ${-SIZE / 2}px;` +
          `box-sizing:border-box;border:1px solid #D6BC8A;border-radius:50%;pointer-events:none;opacity:0;z-index:${zIndex}`;
        document.body.appendChild(el);
        rings.push(el);
      } else { el = rings.reduce((a, b) => (a.t0 < b.t0 ? a : b)); el.anims?.forEach(a => a.cancel()); } // all busy: reuse the oldest
    }
    const at = `translate(${x}px,${y}px) `;
    el.t0 = performance.now();
    const grow = el.animate([{ transform: at + 'scale(.2)' }, { transform: at + 'scale(1)' }], { duration: RING_MS, easing: EASE });
    const fade = el.animate([{ opacity: .45 }, { opacity: .3, offset: .4 }, { opacity: 0 }], { duration: RING_MS });
    el.anims = [grow, fade];
    grow.onfinish = () => { el.anims = null; if (!dead && !free.includes(el)) free.push(el); };
  }

  function step(s, x, y) { // a trail point every ~24px travelled, at most 30 a second
    if (Math.hypot(x - s.x, y - s.y) < STEP) return;
    const now = performance.now();
    while (spawns.length && now - spawns[0] >= 1000) spawns.shift();
    if (now - lastSpawn < GAP || spawns.length >= PER_SEC) return; // the distance keeps counting
    lastSpawn = now; spawns.push(now); s.x = x; s.y = y;
    call('trail', x, y);
  }

  const onDown = e => {
    if (e.button > 0) return; // primary button, finger or pen tip only
    call('sparkle', e.clientX, e.clientY, 10, { life: .8 });
    if (!e.target?.closest?.(OWN_LIGHT)) ring(e.clientX, e.clientY);
    down.set('p' + e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onMove = e => {
    const s = down.get('p' + e.pointerId);
    if (!s || (e.pointerType === 'touch' && touchEvents)) return; // fingers follow touchmove (it outlives pointercancel)
    if (e.pointerType === 'mouse' && !e.buttons) { down.delete('p' + e.pointerId); return; } // no hover trails
    step(s, e.clientX, e.clientY);
  };
  const onUp = e => down.delete('p' + e.pointerId);
  const onTouch = e => {
    touchEvents = true;
    for (const t of e.changedTouches) {
      const id = 't' + t.identifier, s = down.get(id);
      if (e.type === 'touchstart' || !s) down.set(id, { x: t.clientX, y: t.clientY });
      else step(s, t.clientX, t.clientY);
    }
  };
  const onTouchEnd = e => { for (const t of e.changedTouches) down.delete('t' + t.identifier); };
  const onReset = e => { if (e.target === window) down.clear(); }; // the window lost focus (not an element blur)

  const on = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp],
    ['touchstart', onTouch], ['touchmove', onTouch], ['touchend', onTouchEnd], ['touchcancel', onTouchEnd], ['blur', onReset]];
  for (const [type, fn] of on) addEventListener(type, fn, opt);

  return function destroy() {
    if (dead) return;
    dead = true;
    for (const [type, fn] of on) removeEventListener(type, fn, opt);
    for (const el of rings) { el.anims?.forEach(a => a.cancel()); el.remove(); }
    rings.length = free.length = spawns.length = 0;
    down.clear();
  };
}
