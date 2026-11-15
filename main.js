// A & A choreography (DESIGN.md A-G). One particles instance drives both canvases: dust (z 1), effects (z 30).
import { wedding } from './src/data/wedding.js';
import { getCountdown, getGoogleCalendarUrl, getMapsUrl } from './src/lib/wedding.mjs';

window.__aa = true;
const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const motion = root.classList.contains('motion');
const EASE = 'cubic-bezier(.22,.61,.36,1)', TRAVEL = 'cubic-bezier(.7,0,.2,1)';
const later = (ms, fn) => setTimeout(fn, ms);
const clamp = (v, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const span = (text, cls) => { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = text; return s; };
const onScreen = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
// a CSS cubic-bezier read one way or the other: solve(x1, x2, y1, y2) is progress at time, solve(y1, y2, x1, x2) time at progress
const solve = (a1, a2, b1, b2) => {
  const f = (p, q, t) => 3 * p * (1 - t) ** 2 * t + 3 * q * (1 - t) * t * t + t ** 3;
  return v => { let lo = 0, hi = 1, t = .5; for (let k = 0; k < 26; k++) { t = (lo + hi) / 2; if (f(a1, a2, t) < v) lo = t; else hi = t; } return f(b1, b2, t); };
};

let fx = null;
const fxCall = (name, ...args) => { try { fx?.[name]?.(...args); } catch { /* particles are optional */ } };
let music = null; // K. background music (music.js), optional; open() starts it inside the tap
let musicWait = false; // L1. opened by a scroll wheel (not a gesture): the music waits for the guest's next tap

function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  import('./music.js').then(m => {
    m.initMusic({ reducedMotion: !motion });
    music = m;
    if (opened && !musicWait) m.start(); // tapped before it arrived
  }).catch(() => null);
  // no @property (registerProperty ships with it): the light wipes cannot travel
  if (typeof window.CSS?.registerProperty !== 'function') root.classList.add('no-prop');
  $('[data-directions]').href = getMapsUrl();
  $('[data-gcal]').href = getGoogleCalendarUrl();
  $('[data-gcal-reception]').href = getGoogleCalendarUrl('reception');
  if (wedding.reception.mapsUrl) $('[data-reception-directions]').href = wedding.reception.mapsUrl;

  const fxReady = import('./particles.js').then(m => {
    fx = m.createParticles($('[data-fx]'), { reducedMotion: !motion, dustCanvas: $('[data-dust]') });
    if (motion) fxCall('startAmbient');
  }).catch(() => null);
  // H1 sparkle on touch, once the engine is in (rings alone if it failed); none with reduced motion
  if (motion) fxReady.then(() => import('./touch.js')).then(t => t.initTouch(fx)).catch(() => null);

  if (motion) {
    $$('[data-split]').forEach(split);
    // generated text in an aria-hidden span: never read, copied or found twice
    $$('[data-light]').forEach(el => { const l = span('', 'light'); l.dataset.light = el.dataset.light; l.setAttribute('aria-hidden', 'true'); el.append(l); });
    document.addEventListener('animationend', e => { if (e.animationName === 'wipe') e.target.classList.add('is-wiped'); });
    document.addEventListener('touchmove', blockMove, { passive: false });
    intro();
  } else {
    markDrawn();
  }
  cover.addEventListener('click', open);
  setupCover();
  setupTilt();
  setupPhotos();
  setupCount();
  setupFrame();
  setupButtons();
  setupNext();
  setupFocus();
  if (window.__aaTap) open(); // tapped before this module arrived
}

/* ---------- text splitting: letters / words, with one readable copy for assistive tech ---------- */
function split(el) {
  const mode = el.dataset.split, chars = [];
  const vis = document.createElement('span');
  vis.setAttribute('aria-hidden', 'true');
  let words = 0, text = '';
  const walk = (node, into) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        text += n.data;
        for (const part of n.data.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { into.append(' '); continue; }
          if (mode === 'words') { into.append(Object.assign(span(part, 'wd'), { style: `--i:${words++}` })); continue; }
          const w = span('', 'w');
          for (const ch of part) { const c = span(ch, 'ch'); chars.push(c); w.append(c); }
          into.append(w);
        }
      } else if (n.nodeName === 'BR') { text += ' '; into.append(document.createElement('br')); }
      else { const c = n.cloneNode(false); into.append(c); walk(n, c); }
    }
  };
  walk(el, vis);
  const mid = (chars.length - 1) / 2;
  chars.forEach((c, i) => c.style.setProperty('--i', mode === 'center' ? Math.round(Math.abs(i - mid)) : i));
  // the cover date keeps step with the intro clock (index.html) if this module is late
  if (el.closest('[data-cover]')) {
    const lag = Math.max(0, window.__aaClock?.() ?? -1);
    if (lag > 50) chars.forEach((c, i) => { c.style.animationDelay = `${Math.round(1900 + i * 40 - lag)}ms`; });
  }
  el.replaceChildren(span(text.replace(/\s+/g, ' ').trim(), 'sr-only'), vis);
  el.classList.add('is-split');
}

/* ---------- A + B. ambient light and the intro ---------- */
const cover = $('[data-cover]'), fly = $('[data-mono]'), tilt = $('[data-tilt]'), svg = $('.mono'), tip = $('.mono-tip');
// J. the cover photograph: its own layer under the dust, it leaves with the first screen (styles.css .cover-shot)
const shot = $('[data-cover-shot]');
const hideCover = () => { cover.hidden = true; if (shot) shot.hidden = true; };
const glow = $('.mono-glow', fly), rays = $('.rays', fly), ring = $('.ring', svg), slot = $('[data-slot]'), foil = $('#aa-foil'), glintGrad = $('#aa-glint');
let opened = false, landed = false, flying = false, monoOn = true, breath = null, flightAnims = [];
const blockMove = e => { if (!landed) e.preventDefault(); }; // iOS ignores overflow: hidden

function markDrawn() {
  if (svg.classList.contains('is-drawn')) return;
  svg.classList.add('is-drawn');
  if (!motion) return;
  const glint = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  glint.setAttribute('class', 'mono-glint');
  for (const el of [ring, $('.letters', svg)]) glint.append(el.cloneNode(true));
  glint.querySelectorAll('[class]').forEach(n => n.removeAttribute('class'));
  svg.append(glint);
}

function intro() {
  const draws = svg.getAnimations({ subtree: true });
  // styles not applied yet: marking it drawn now would cancel the draw-on
  if (!draws.length && document.readyState !== 'complete') return addEventListener('load', intro, { once: true });
  // first sheen once the strokes settle (~1740ms), then every 7s while on screen
  Promise.all(draws.map(a => a.finished)).then(markDrawn, markDrawn).then(() => {
    if (!opened) sweep(1300);
    setInterval(() => { if (!document.hidden && !flying && monoOn) sweep(1300); }, 7000);
  });
}

// foil sheen: a bright band in the stroke gradient, travelling along (.87, .49)
let sweepT0 = -1, sweepDur = 1300, rx = 0, ry = 0, trx = 0, tryy = 0, raf = 0, lastP = NaN, lastTf = '';
const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
function sweep(ms) { sweepT0 = performance.now(); sweepDur = ms; kick(); }
function tick(now) {
  raf = 0;
  rx += (trx - rx) * .08; ry += (tryy - ry) * .08;
  const moving = Math.abs(trx - rx) + Math.abs(tryy - ry) > .01;
  const tf = Math.abs(rx) + Math.abs(ry) > .005 ? `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)` : '';
  if (tf !== lastTf) tilt.style.transform = lastTf = tf;
  let p = -44;
  if (sweepT0 >= 0) {
    const t = clamp((now - sweepT0) / sweepDur, 0, 1);
    p = -44 + 420 * (t < .5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2);
    if (t >= 1) { sweepT0 = -1; p = -44; }
  }
  p = Math.round((p + ry * 5 - rx * 3) * 2) / 2; // half-unit steps: tremor does not repaint
  if (p !== lastP) {
    lastP = p;
    const gt = `translate(${(p * .87).toFixed(1)} ${(p * .49).toFixed(1)})`;
    foil.setAttribute('gradientTransform', gt);
    glintGrad.setAttribute('gradientTransform', gt);
  }
  if (moving || sweepT0 >= 0) kick();
}

// tilt to the pointer or the phone's attitude. A listener never prompts; iOS just sends no events.
function setupTilt() {
  if (!motion) return;
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', e => {
      if (!monoOn) return;
      const r = fly.getBoundingClientRect();
      tryy = clamp((e.clientX - r.left - r.width / 2) / (innerWidth / 2)) * 5;
      trx = -clamp((e.clientY - r.top - r.height / 2) / (innerHeight / 2)) * 5;
      kick();
    }, { passive: true });
    root.addEventListener('mouseleave', () => { trx = tryy = 0; kick(); });
  } else if ('DeviceOrientationEvent' in window) {
    let b0 = null, g0 = 0, b = 0, g = 0, lastG = 0;
    addEventListener('deviceorientation', e => {
      if (e.beta == null || e.gamma == null) return;
      const jump = b0 !== null && Math.abs(e.gamma - lastG) > 60; // gamma wraps near vertical
      lastG = e.gamma;
      if (jump) return;
      if (b0 === null) { b0 = b = e.beta; g0 = g = e.gamma; }
      b = b * .85 + e.beta * .15; g = g * .85 + e.gamma * .15; // low-pass: hand tremor
      b0 += (b - b0) * .002; g0 += (g - g0) * .002; // rest pose drifts
      const nx = -clamp((b - b0) / 25) * 5, ny = clamp((g - g0) / 25) * 5;
      if (!monoOn || Math.abs(nx - trx) + Math.abs(ny - tryy) < .25) return;
      trx = nx; tryy = ny; kick();
    }, { passive: true });
  }
}

/* ---------- C. the tap ---------- */
function open(how) {
  if (opened) return;
  opened = true;
  // first: iOS plays only inside the guest's own gesture (a tap, a key, the end of a swipe). A scroll wheel is not
  // one, so then the music waits for their next tap, the toggle showing it ready to play meanwhile
  const gesture = navigator.userActivation ? navigator.userActivation.isActive : how !== 'wheel';
  if (gesture) { try { music?.start(); } catch { /* optional */ } } else musicLater();
  stopIdle(true);
  if (how !== 'wheel') removeEventListener('wheel', wheel);
  scrollTo(0, 0);
  // before is-open adds the tap's CSS animations: the drawing, and caption parts not yet started
  const drawing = motion ? [...svg.getAnimations({ subtree: true }), ...tip.getAnimations()] : [];
  const waiting = motion ? [$('[data-caption]'), $('[data-tap]')].flatMap(el => el.getAnimations({ subtree: true }))
    .filter(a => (a.currentTime ?? 0) < (a.effect?.getTiming().delay || 0)) : [];
  // the glow's breathing, kept in phase across the landing without looking animations up again there
  if (motion) breath = glow.getAnimations({ subtree: true }).find(a => a instanceof CSSAnimation) || null;
  root.classList.add('is-open');
  cover.inert = true;
  if (!motion) return openReduced();

  if (gesture) try { navigator.vibrate?.(15); } catch { /* not supported */ } // a wheel is no gesture: Chrome would log the blocked call
  for (const a of drawing) if (a.playState !== 'finished') a.playbackRate = 6;
  for (const a of waiting) a.pause();
  const r = fly.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const f = Math.min(1.8, Math.max(1, Math.min(innerWidth, innerHeight) / 700));
  const flash = $('.flash');
  flash.style.setProperty('--cx', cx + 'px');
  flash.style.setProperty('--cy', cy + 'px');

  // the monogram itself lights up under the finger
  tilt.animate([{ scale: 1, easing: EASE }, { scale: .94, offset: .28, easing: EASE }, { scale: 1 }], { duration: 430 });
  sweep(650);
  svg.classList.add('is-lit');
  later(250, () => svg.classList.remove('is-lit'));
  const sw = parseFloat(getComputedStyle(svg).getPropertyValue('--sw')) || 1.15, dark = 'drop-shadow(0 0 0 rgba(243,227,188,0))';
  try {
    svg.animate([{ '--sw': sw, filter: dark }, { '--sw': sw * 1.5, filter: 'drop-shadow(0 0 7px rgba(243,227,188,.75))', offset: .3 }, { '--sw': sw, filter: dark }],
      { duration: 650, easing: EASE });
  } catch { svg.animate([{ filter: dark }, { filter: 'drop-shadow(0 0 7px rgba(243,227,188,.75))', offset: .3 }, { filter: dark }], { duration: 650, easing: EASE }); }

  const reach = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) * 1.08 / 600;
  const start = r.width * .92 / 1200;
  $$('[data-shock]').forEach((el, i) => el.animate(
    [{ transform: `scale(${start})`, opacity: 0 }, { transform: `scale(${start * 1.08})`, opacity: i ? .45 : .8, offset: .06 }, { transform: `scale(${reach})`, opacity: 0 }],
    { duration: 1100, delay: 120 + i * 180, easing: 'cubic-bezier(.15,.7,.35,1)' }));
  $('[data-bloom]').animate(
    [{ opacity: 0, transform: `scale(${.55 * f})` }, { opacity: .45, transform: `scale(${f})`, offset: .3 }, { opacity: 0, transform: `scale(${1.3 * f})` }],
    { duration: 900, delay: 120, easing: EASE, fill: 'backwards' });
  later(150, () => fxCall('burst', cx, cy, { count: 90 }));
  for (const el of [$('[data-caption]'), $('[data-tap]')]) {
    el.animate([{ opacity: 0, transform: 'translateY(8px)' }], { duration: 300, delay: 200, easing: EASE, fill: 'forwards' });
  }
  later(350, flight);
  later(800, revealInvitation);
}

function flight() {
  flying = true;
  const a = fly.getBoundingClientRect(), b = slot.getBoundingClientRect(), k = b.width / a.width;
  const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const opts = { duration: 900, easing: TRAVEL, fill: 'forwards' };
  fly.style.willChange = 'transform';
  const move = fly.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], opts);
  // stroke weight in five held steps (each repaints the SVG): the hairline stays near 1px
  const sw0 = parseFloat(getComputedStyle(svg).getPropertyValue('--sw')) || 1.15, sw1 = parseFloat(getComputedStyle(slot).getPropertyValue('--sw')) || 2.5;
  const E = solve(.7, .2, 0, 1), swAt = t => { const e = E(t); return (sw0 + (sw1 * k - sw0) * e) / (1 + (k - 1) * e); };
  flightAnims = [move];
  try { flightAnims.push(svg.animate([0, 1, 2, 3, 4, 5].map(i => ({ '--sw': i ? i === 5 ? sw1 : swAt((i + .5) / 5) : sw0, offset: i / 5, easing: 'steps(1, end)' })), { duration: 900, fill: 'forwards' })); }
  catch { /* registered properties unsupported */ }
  // the glow must not cover the words arriving under it: gone by mid-flight, back after landing
  flightAnims.push(glow.animate([{ scale: 1, opacity: 1 }, { opacity: 0, offset: .5 }, { scale: 1.444, opacity: 0 }], opts),
    rays.animate([{ opacity: getComputedStyle(rays).opacity }, { opacity: 0, offset: .35 }, { opacity: 0 }], opts),
    // a spark rides a quarter of the ring on the way up; a short, rising trail follows it home
    tip.animate([{ transform: 'rotate(0deg)', opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: .9, offset: .7 }, { transform: 'rotate(90deg)', opacity: 0 }], opts));
  const trail = setInterval(() => {
    const m = fly.getBoundingClientRect(), t = (.15 + .7 * Math.random()) * Math.PI, R = m.width * .46;
    fxCall('sparkle', m.left + m.width / 2 + Math.cos(t) * R, m.top + m.height / 2 + Math.sin(t) * R, 5, { life: .5, lift: 160 });
  }, 60);
  later(880, () => clearInterval(trail));
  move.finished.then(land, land);
}

// the peak of the tap on a mid-range phone: every change first, then one measurement; the focus and the observers
// wait until the landing frame has painted
function land() {
  if (landed) return;
  landed = true;
  flying = false;
  markDrawn();
  // re-parenting restarts CSS animations: the new breathing starts in phase (a negative delay, --breath in styles.css)
  const t = breath?.currentTime;
  if (t != null) glow.style.setProperty('--breath', `${-Math.round(t % 10000)}ms`);
  slot.append(fly);
  for (const an of flightAnims) an.cancel();
  flightAnims = [];
  glow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, easing: EASE });
  rays.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1600, easing: EASE });
  fly.style.willChange = '';
  fxCall('sparkle', ...center(slot), 14); // light arrives with it
  // the whole-document restyle (scroll unlock, the faded first screen gone) waits a frame, then the rest another task
  requestAnimationFrame(() => {
    root.classList.add('is-landed', 'snap');
    hideCover();
    document.removeEventListener('touchmove', blockMove);
    later(0, () => {
      $('#names').focus({ preventScroll: true });
      watchMono();
      observeSections();
      setupFlow();
    });
  });
}

// off screen, the monogram neither sweeps, tilts nor breathes
function watchMono() {
  if (!('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => { monoOn = e.isIntersecting; root.classList.toggle('mono-off', !monoOn); }).observe(slot);
}

function openReduced() {
  root.classList.add('is-landed', 'snap');
  $$('[data-section], .actions, [data-next], [data-kasavu]').forEach(s => s.classList.add('is-in', 'is-ready'));
  $('#names').focus({ preventScroll: true });
  setupFlow();
  // the monogram leaves with its screen, then appears in its slot
  later(220, () => {
    slot.append(fly);
    markDrawn();
    slot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear' });
    hideCover();
  });
}

/* ---------- D. invitation reveal ---------- */
const inv = $('[data-section="invitation"]'), acts = $('.actions', inv);
function revealInvitation() {
  inv.classList.add('is-in');
  const lights = $$('.light', inv);
  const sheenNames = () => {
    if (document.hidden || !onScreen(inv)) return;
    lights.forEach((l, i) => {
      l.classList.add('is-sheen');
      l.animate([{ opacity: 1, backgroundPosition: '100% 0' }, { opacity: 1, backgroundPosition: '0% 0' }],
        { duration: 1100, delay: i * 160, easing: 'cubic-bezier(.45,0,.35,1)', fill: 'backwards' });
    });
  };
  // timed from .is-in (styles.css): Aiswarya's wipe ends at 1900
  later(1950, () => { sheenNames(); setInterval(sheenNames, 9000); });
  // L3. the next prompt comes with the page (it fits the first view now), as the details finish rising
  later(1700, () => nextIn(inv));
  // buttons draw after the details, once really on screen
  later(1700, () => whenSeen(acts, .6, actionsIn));
}
// a row of drawn buttons (the invitation's, or the reception's Directions); its page's next button follows
function actionsIn(a = acts) {
  if (a.classList.contains('is-in')) return;
  a.classList.add('is-in');
  later(900, () => a.classList.add('is-ready')); // labels in: a tap is meant
  if (a !== acts) return later(1000, () => $('.btn', a)?.classList.add('sheen-once'));
  later(950, () => $('[data-save]').classList.add('sheen-once'));
}
// L3. a prompt takes taps only once it has visibly arrived (700ms: its label up, its circle half drawn). At 390x844 it
// rises where the cover's pill was, so an impatient second tap on the pill must not carry the guest past the wedding
const nextIn = s => {
  const b = $('[data-next]', s);
  if (!b || b.classList.contains('is-in')) return;
  b.classList.add('is-in');
  b.inAt = performance.now();
};
function whenSeen(el, ratio, fn, rootMargin = '0px') {
  if (!('IntersectionObserver' in window)) return fn();
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting && e.intersectionRatio >= ratio - .01)) { io.disconnect(); fn(); }
  }, { threshold: ratio, rootMargin });
  io.observe(el);
}

/* ---------- E. scroll reveals ---------- */
// a section reveals when its content (not its padding) is 15% above the bottom edge
function observeSections() {
  const targets = [$('[data-panel]'), $('.blessings > .label')];
  if (!('IntersectionObserver' in window)) return targets.forEach(t => reveal(t.closest('[data-section]')));
  let next = 0; // together: 120ms apart
  const io = new IntersectionObserver(entries => {
    for (const e of entries.filter(x => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)) {
      io.unobserve(e.target);
      const now = performance.now(), at = Math.max(now, next);
      next = at + 120;
      later(at - now, () => reveal(e.target.closest('[data-section]')));
    }
  }, { threshold: 0, rootMargin: '0px 0px -15% 0px' });
  targets.forEach(t => io.observe(t));
  // the kasavu sits at the very end of the page, so it draws as soon as it is half on screen
  const kv = $('[data-kasavu]');
  whenSeen(kv, .5, () => kv.classList.add('is-in'));
  // off screen, a page's glow and next button stop breathing and bobbing
  const off = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-off', !e.isIntersecting)));
  $$('[data-section]').forEach(s => off.observe(s));
}
function reveal(s) {
  if (s.classList.contains('is-in')) return;
  s.classList.add('is-in');
  const name = s.dataset.section;
  if (name === 'reception') {
    later(900, () => nextIn(s)); // L3. its prompt comes with the page
    // Directions draws once 60% on screen, but not before the place line has risen (760); a quick flick past counts
    const ra = $('.actions', s), t0 = performance.now();
    whenSeen(ra, .6, () => later(t0 + 760 - performance.now(), () => actionsIn(ra)));
    // the frame has drawn by 1650: the first light soon after, then about every 8s while it is on screen
    later(3400, () => { runLight(); setInterval(runLight, 8000); });
  }
  if (name === 'blessings') later(950, () => s.classList.add('is-ready'));
}

// I2.3 the one live line on the reception screen: days to whichever event is next, hours inside the last day.
// No minutes or seconds are shown, so a tick a minute is plenty.
const countLine = $('[data-count]');
function nextEventLine(now = new Date()) {
  const c = getCountdown(now);
  if (c.status === 'countdown') return phrase('The muhurtham', c.days, c.hours);
  if (c.status === 'today') return 'The muhurtham is today';
  const left = Date.parse(wedding.reception.start) - now;
  if (left > 0) return phrase('The reception', Math.floor(left / 864e5), Math.floor(left / 36e5));
  if (now < Date.parse(wedding.reception.end)) return 'The reception is today';
  return 'Thank you for your blessings';
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const phrase = (what, days, hours) =>
  days >= 1 ? `${what} is in ${plural(days, 'day')}` : hours >= 1 ? `${what} is in ${plural(hours, 'hour')}` : `${what} is today`;
function setupCount() {
  const paint = () => { const t = nextEventLine(); if (countLine.textContent !== t) countLine.textContent = t; };
  paint();
  countLine.hidden = false;
  // on the minute, so the line turns over with the clock rather than a minute after the page opened
  const loop = () => { paint(); later(60000 - (Date.now() % 60000) + 20, loop); };
  later(60000 - (Date.now() % 60000) + 20, loop);
}

// the arched hairline round the closing portrait, measured in CSS pixels like the reception frame, so one
// pathLength draw runs the whole way round at a true 1px whatever height the arch takes
function setupArch() {
  const arch = $('[data-arch]'), path = arch && $('.edge', arch), box = arch?.parentElement;
  if (!path) return;
  const layout = () => {
    const w = box.clientWidth, h = box.clientHeight;
    if (!w || !h) return;
    const rx = w / 2 - .5, ry = Math.max(2, h * .276), bx = Math.min(5, w * .05), by = Math.min(3, h * .025);
    arch.setAttribute('viewBox', `0 0 ${w} ${h}`);
    path.setAttribute('d', `M${w / 2} .5A${rx} ${ry - .5} 0 0 1 ${w - .5} ${ry}V${h - .5 - by}A${bx} ${by} 0 0 1 ${w - .5 - bx} ${h - .5}` +
      `H${.5 + bx}A${bx} ${by} 0 0 1 .5 ${h - .5 - by}V${ry}A${rx} ${ry - .5} 0 0 1 ${w / 2} .5`);
  };
  layout();
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(box);
  else addEventListener('resize', layout);
}

/* ---------- I1. the photographs: the real files, and a little scroll parallax ---------- */
// photos/photos.json (another tool writes it) may name other files, or better alt text, than index.html does.
// It is optional in every way: a missing or malformed file leaves the markup's own srcset standing.
function setupPhotos() {
  setupArch();
  for (const img of $$('.ph img, .bk img')) {
    img.addEventListener('error', () => { img.hidden = true; }, { once: true });
    if (img.complete && !img.naturalWidth) img.hidden = true;
  }
  if (typeof fetch === 'function') fetch('photos/photos.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null)).then(applyPhotos).catch(() => null);
  if (motion) setupParallax();
}
const PHOTO_KEYS = {
  reception: ['reception', 'receptionBg', 'reception-bg', '3'],
  portrait: ['closing', 'portrait', 'closingPortrait', 'closing-portrait', '2'],
  backdrop: ['closingBackdrop', 'closing-backdrop', 'backdrop', 'blessingsBackdrop', '1'],
};
function applyPhotos(data) {
  if (!data || typeof data !== 'object') return;
  const bag = [data.images, data.photos, data].find(v => v && typeof v === 'object');
  for (const holder of $$('[data-ph]')) {
    const img = $('img', holder);
    const entry = PHOTO_KEYS[holder.dataset.ph]?.map(k => bag[k]).find(v => v && typeof v === 'object');
    if (!img || !entry) continue;
    // sizes may be [{src, w}], {900: 'file'}, or a ready-made srcset string
    let set = typeof entry.srcset === 'string' ? entry.srcset : '';
    const list = [entry.sizes, entry.sources, entry.srcset].find(Array.isArray) || null;
    if (!set && list) set = list.filter(v => v && (v.src || v.url || v.file) && (v.w || v.width))
      .map(v => `${path(v.src || v.url || v.file)} ${v.w || v.width}w`).join(', ');
    if (!set && entry.sizes && typeof entry.sizes === 'object') {
      set = Object.entries(entry.sizes).map(([w, v]) => `${path(typeof v === 'string' ? v : v?.src)} ${parseInt(w, 10)}w`).join(', ');
    }
    if (set && /\dw/.test(set)) {
      img.hidden = false;
      img.srcset = set;
      const first = set.split(',')[0].trim().split(/\s+/)[0];
      if (first) img.src = first;
    }
    if (typeof entry.sizes === 'string') img.sizes = entry.sizes;
    if (typeof entry.alt === 'string' && entry.alt && img.alt) img.alt = entry.alt;
    // blur up from the 20px placeholder instead of showing a gap
    if (typeof entry.lqip === 'string' && /^data:/.test(entry.lqip) && !img.complete) {
      img.style.backgroundImage = `url("${entry.lqip}")`;
      img.style.backgroundSize = 'cover';
      img.style.backgroundPosition = getComputedStyle(img).objectPosition;
      const clear = () => { img.style.backgroundImage = ''; };
      img.addEventListener('load', clear, { once: true });
      img.addEventListener('error', clear, { once: true });
    }
  }
}
const path = v => (typeof v === 'string' && v ? (/^(https?:|\/|photos\/)/.test(v) ? v : 'photos/' + v.replace(/^\.\//, '')) : ' ');

// a few pixels of parallax, read once a frame while a photograph is on screen (the Ken Burns drift owns
// scale and translate, so this only ever touches transform)
function setupParallax() {
  const shots = $$('.ph img, .bk img');
  if (!shots.length) return;
  let queued = false;
  const paint = () => {
    queued = false;
    for (const img of shots) {
      const box = img.closest('.ph, .bk');
      if (box.closest('[data-section]')?.classList.contains('is-off')) continue;
      const r = box.getBoundingClientRect();
      if (r.bottom < -40 || r.top > innerHeight + 40) continue;
      const mid = (r.top + r.height / 2 - innerHeight / 2) / innerHeight; // -1 .. 1
      // 2.4% of the box, so it never travels past the 5% the drift's scale keeps in hand
      img.style.transform = `translate3d(0, ${(clamp(mid) * r.height * -.024).toFixed(1)}px, 0)`;
    }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(paint); } }, { passive: true });
  paint();
}

// E2. reception frame: two paths from either side of the clasp round both sides to the bottom (drawn from 250ms)
const panel = $('[data-panel]'), runs = $$('.frame .run', panel);
// H4.5 a short bright segment travels once round the frame, out of the clasp and back to it
function runLight() {
  if (!motion || document.hidden || !onScreen(panel)) return;
  runs.forEach((r, i) => {
    const L = [.09, .055, .03][i], M = .09 / 2;
    r.animate([{ strokeDashoffset: L / 2 + M }, { strokeDashoffset: L / 2 - 1 - M }], { duration: 2200, easing: 'cubic-bezier(.45,.05,.55,.95)' });
  });
}
function setupFrame() {
  const [left, right] = $$('.frame .edge', panel), glints = $$('.glint', panel);
  // time fraction at which the travel easing has drawn a given fraction of the line
  const whenDrawn = solve(0, 1, .7, .2);
  // the frame SVG fills the padding box (inside the panel's 1px transparent border), like the clasp's left: 50%.
  // The clasp (132px, its viewBox scaled 1.1) has its dots' outer edges 51.6px either side of its centre: the
  // line stops 5px beyond each
  const layout = () => {
    const w = panel.clientWidth, h = panel.clientHeight, m = w / 2, g = Math.min(56.6, m - 8), len = m - g + h + m;
    left.setAttribute('d', `M${m - g} .5H.5V${h - .5}H${m}`);
    right.setAttribute('d', `M${m + g} .5H${w - .5}V${h - .5}H${m}`);
    runs.forEach(r => r.setAttribute('d', `M${m + g} .5H${w - .5}V${h - .5}H.5V.5H${m - g}`));
    const top = 250 + whenDrawn((m - g) / len) * 1400, bottom = 250 + whenDrawn((m - g + h) / len) * 1400;
    // each glint is struck by the line: starts just before it, peaks just after
    glints.forEach((g, i) => g.style.setProperty('--gd', Math.round((i < 2 ? top : bottom) - 30) + 'ms'));
  };
  layout();
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(panel);
  else addEventListener('resize', layout);
}

/* ---------- F. interactions ---------- */
function say(el, msg) {
  el.textContent = '';
  later(60, () => { el.textContent = msg; });
}
function center(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }

function setupButtons() {
  // press ripple of soft gold light from the touch point
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest?.('.btn');
    if (!b || !motion) return;
    const r = b.getBoundingClientRect(), s = span('', 'btn-ripple');
    s.style.left = e.clientX - r.left + 'px';
    s.style.top = e.clientY - r.top + 'px';
    b.append(s);
    s.animate([{ transform: 'scale(0)', opacity: 1 }, { transform: 'scale(1)', opacity: 0 }], { duration: 400, easing: EASE })
      .finished.then(() => s.remove(), () => s.remove());
  });

  // Save the date links the real .ics (tools/build-assets.mjs); iOS offers Add to Calendar only without download
  const save = $('[data-save]'), saveStatus = $('[data-save-status]'), gcalSlot = $('[data-gcal-slot]');
  if (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) save.removeAttribute('download');
  let saveT, statusT;
  save.addEventListener('click', () => {
    save.classList.remove('is-done');
    void save.offsetWidth;
    save.classList.add('is-done');
    clearTimeout(saveT);
    saveT = later(2800, () => save.classList.remove('is-done'));
    fxCall('sparkle', ...center(save), 12);
    // the status takes the Google Calendar link's place for 4s, then hands it back (nothing below moves)
    gcalSlot.classList.add('is-saved');
    say(saveStatus, 'Saved: the wedding and the reception are both in your calendar file.');
    clearTimeout(statusT);
    statusT = later(4000, () => {
      gcalSlot.classList.remove('is-saved');
      statusT = later(260, () => { saveStatus.textContent = ''; });
    });
  });

  const shower = $('[data-shower]'), blessStatus = $('[data-bless-status]');
  let locked = false, sentT, glowT;
  shower.addEventListener('click', () => {
    if (locked) return;
    locked = true;
    later(1500, () => { locked = false; });
    // glints wash out on the gold fill: spread them so some clear its edges onto the green
    const [sx, sy] = center(shower), sw = shower.offsetWidth * .3;
    for (const dx of [-sw, 0, sw]) fxCall('sparkle', sx + dx, sy, 8);
    if (motion) {
      // gold rises from the button to where the blessings then fall from
      fxCall('fountain', sx, shower.getBoundingClientRect().top, { count: 18, spread: shower.offsetWidth * .38 });
      later(260, () => fxCall('shower', { duration: 2600 }));
    }
    shower.classList.add('is-glow');
    clearTimeout(glowT);
    glowT = later(motion ? 200 : 420, () => shower.classList.remove('is-glow'));
    shower.classList.add('is-sent');
    clearTimeout(sentT);
    sentT = later(motion ? 4800 : 3000, () => shower.classList.remove('is-sent')); // the rain has mostly cleared
    say(blessStatus, 'Thank you for your blessings.');
  });

  const share = $('[data-share]'), link = $('[data-share-link]');
  share.addEventListener('click', async () => {
    const url = location.origin + location.pathname; // no tracking query strings
    if (navigator.share) {
      try { await navigator.share({ title: document.title, text: wedding.shareText, url }); return; }
      catch (err) { if (err?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      link.hidden = true;
      say(blessStatus, 'Invitation link copied.');
    } catch {
      blessStatus.textContent = '';
      link.hidden = false;
      link.value = url;
      link.focus();
      link.setSelectionRange(0, url.length);
    }
  });
  // K. the music toggle sparkles like a next-page button
  $('[data-sound]')?.addEventListener('click', e => fxCall('sparkle', ...center(e.currentTarget), e.detail && motion ? 5 : 12, { life: .6 }));

  if (motion) $$('.btn').forEach(b => b.addEventListener('animationend', e => {
    if (e.animationName === 'btnSheen') b.classList.remove('sheen-once');
  }));
}

/* ---------- H2. next page: sparkle, glide so the next page's top meets the screen's top, then focus its heading ---------- */
// every page's button sits at the same height, so when a glide ends the next page's button is under the finger: an
// impatient second tap must not skip a page
let gliding = false;
function setupNext() {
  $$('[data-next]').forEach(b => b.addEventListener('click', e => {
    if (performance.now() - (b.inAt || -1e9) < 350) return; // see L3 above: long enough to absorb a double tap, short enough never to swallow a seen one
    glide(b, b.closest('[data-section]')?.nextElementSibling, e);
  }));
  // I2.2 the quiet "Reception on 1 November" line travels the same way (and stays a real anchor without JS)
  const jump = $('[data-jump]');
  jump?.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    glide(jump, $('[data-section="reception"]'), e);
  });
}
function glide(from, to, e) {
  if (!to || gliding) return;
  cancelPeek();
  // the page glides away under the light: keep it short. A finger already has the touch sparkle (H1), so a
  // pointer press adds only a few glints; a keyboard press gets the full sparkle
  fxCall('sparkle', ...center(from), e.detail && motion ? 5 : 12, { life: .6 });
  const head = $$('[data-head]', to).find(h => h.getClientRects().length);
  const y = Math.round(scrollY + to.getBoundingClientRect().top);
  let done = false;
  const focus = () => {
    if (done) return;
    done = true;
    removeEventListener('scrollend', focus);
    head?.focus({ preventScroll: true });
    if (!peeking) root.classList.remove('no-snap'); // a glide that began mid-peek (holdPeek) arrives with snapping still lifted
    later(350, () => { gliding = false; });
  };
  if (motion && Math.abs(y - scrollY) > 1) {
    gliding = true;
    addEventListener('scrollend', focus);
    // and where there is no scrollend (older Safari, in-app webviews): focus as soon as the page has arrived, or
    // has stopped (a finger took over the glide), or after 2s at the latest
    const t0 = performance.now();
    let last = scrollY, still = 0, moved = false;
    const watch = now => {
      if (done) return;
      if (scrollY !== last) { last = scrollY; moved = true; still = 0; } else still++;
      if (Math.abs(to.getBoundingClientRect().top) <= 1 || (still >= 3 && (moved || now - t0 > 300)) || now - t0 > 2000) return focus();
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  } else later(0, focus);
  scrollTo({ top: y, behavior: motion ? 'smooth' : 'instant' });
}

/* ---------- L1. the cover: a tap anywhere, the pill, a swipe up, a scroll down or the down arrow opens it ---------- */
let idleT = 0, idleBeat = 0;
function setupCover() {
  let y0 = null, x0 = 0;
  cover.addEventListener('touchstart', e => {
    y0 = e.touches.length === 1 ? e.touches[0].clientY : null;
    if (y0 !== null) x0 = e.touches[0].clientX;
  }, { passive: true });
  // the cover never scrolls (iOS ignores overflow: hidden): a swipe is read, not followed
  cover.addEventListener('touchmove', e => { if (!opened && e.cancelable) e.preventDefault(); }, { passive: false });
  // touchend is the guest's own gesture (the move was not a scroll), so the music may start inside it
  cover.addEventListener('touchend', e => {
    const t = e.changedTouches[0];
    if (y0 === null || !t || opened) return;
    const dy = y0 - t.clientY, dx = Math.abs(t.clientX - x0);
    y0 = null;
    if (dy > 40 && dy > dx) open('swipe');
  });
  addEventListener('wheel', wheel, { passive: false });
  addEventListener('keydown', e => {
    if (opened || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (!['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar'].includes(e.key)) return;
    if (/^(?: |Spacebar)$/.test(e.key) && e.target.closest?.('button, a, input')) return; // a focused pill's own Space
    e.preventDefault();
    open('key');
  });
  if (!motion) return;
  // untouched for 4s (counted from the pill's arrival, 3.1s into the intro): the pill and the monogram pulse
  for (const n of ['pointerdown', 'keydown', 'wheel']) addEventListener(n, idleReset, { passive: true, capture: true });
  idleT = later(3100 + 4000, idleOn);
}
function idleOn() {
  if (opened) return;
  cover.classList.add('is-idle'); // styles.css: a brighter ring round the pill and the monogram, every 3s
  sweep(1100); // and the foil crosses the strokes in the same beat
  idleBeat = setInterval(() => { if (!opened && !document.hidden && monoOn) sweep(1100); }, 3000);
}
function idleReset() {
  if (opened) return;
  stopIdle();
  idleT = later(4000, idleOn);
}
function stopIdle(done) {
  clearTimeout(idleT);
  clearInterval(idleBeat);
  cover.classList.remove('is-idle');
  if (done) for (const n of ['pointerdown', 'keydown', 'wheel']) removeEventListener(n, idleReset, { capture: true });
}
// a scroll down opens it. A trackpad's flick goes on sending wheel events for a second or more: once the invitation
// has opened they are swallowed until they pause, or they would carry the guest straight past the wedding
let wheelSum = 0, wheelHold = false, wheelQuiet = 0;
function wheel(e) {
  if (!opened) {
    if (e.deltaY <= 0) return;
    wheelSum += e.deltaMode ? e.deltaY * 40 : e.deltaY;
    if (wheelSum < 24) return;
    wheelHold = true;
    open('wheel');
  }
  if (!wheelHold) return removeEventListener('wheel', wheel);
  if (e.cancelable) e.preventDefault();
  clearTimeout(wheelQuiet);
  const release = () => {
    if (!root.classList.contains('is-landed')) { wheelQuiet = later(150, release); return; }
    wheelHold = false;
    removeEventListener('wheel', wheel);
  };
  wheelQuiet = later(300, release);
}
// the music after a wheel opening: the guest's next tap or key starts it (the toggle's own tap plays it anyway)
function musicLater() {
  musicWait = true;
  const kinds = ['click', 'keydown', 'touchend'];
  const stop = () => { musicWait = false; kinds.forEach(k => document.removeEventListener(k, go, true)); };
  const go = e => {
    if (e.target?.closest?.('[data-sound]')) return stop();
    if (navigator.userActivation && !navigator.userActivation.isActive) return; // a scroll's touchend: not yet
    stop();
    try { music?.start(); } catch { /* optional */ }
  };
  kinds.forEach(k => document.addEventListener(k, go, true));
}

/* ---------- L4/L5. the guided flow: page dots, and a gentle peek at the next page when a guest lingers ---------- */
const sections = $$('[data-section]'), dotsNav = $('[data-dots]'), dotBtns = dotsNav ? $$('[data-dot]', dotsNav) : [];
let flowOn = false, cur = 0, peeking = null, idleFlowT = 0, quietUntil = 0;
const peeks = new WeakMap();
function setupFlow() {
  if (flowOn) return;
  flowOn = true;
  if (dotsNav) {
    dotsNav.hidden = false;
    dotBtns.forEach((b, i) => b.addEventListener('click', e => glide(b, sections[i], e)));
  }
  // the current page: the last one whose top has passed the middle of the screen
  let queued = false;
  const track = () => {
    queued = false;
    const mid = innerHeight / 2;
    let i = 0;
    sections.forEach((s, k) => { if (s.getBoundingClientRect().top <= mid) i = k; });
    if (i === cur && dotBtns[i]?.hasAttribute('aria-current')) return;
    cur = i;
    dotBtns.forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
  };
  addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(track); }
    if (motion && !peeking && performance.now() > quietUntil) idleArm();
  }, { passive: true });
  addEventListener('resize', () => { if (!queued) { queued = true; requestAnimationFrame(track); } }, { passive: true });
  track();
  setupPaging();
  if (!motion) return; // reduced motion: no peeking
  for (const n of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
    addEventListener(n, e => { holdPeek(e); idleArm(); }, { passive: true, capture: true });
  }
  idleArm();
}
/* L2. one swipe, one page, on a touch screen. Chrome lets a hard flick run straight past a page that has
   scroll-snap-stop: always (Chromium issue 40716300; measured here, a 70-90% flick in 30-80ms carried the wedding to
   the closing, so the reception was never seen), and a fling cannot be stopped from script without the screen
   flickering between two pages. So while every page fits the screen, the invitation turns its own pages: html.paged
   (touch-action: pinch-zoom) leaves only pinch zoom to the browser, the page follows the finger, and on release it
   glides to the next or the previous page (a flick, or a drag past a fifth of the screen) or back to its own; never
   further. Zoomed in, held sideways, or with a page taller than the screen, the browser scrolls (and snaps) itself. */
function setupPaging() {
  if (!matchMedia('(pointer: coarse)').matches || !window.CSS?.supports?.('touch-action', 'pinch-zoom')) return;
  const vv = window.visualViewport;
  const fit = () => root.classList.toggle('paged', (!vv || vv.scale < 1.01) && sections.every(s => s.getBoundingClientRect().height <= innerHeight + 1));
  fit();
  addEventListener('resize', fit, { passive: true });
  vv?.addEventListener('resize', fit, { passive: true });
  const tops = () => sections.map(s => Math.round(s.getBoundingClientRect().top + scrollY));
  let drag = null, settling = 0;
  addEventListener('touchstart', e => {
    drag = null;
    if (!root.classList.contains('paged') || e.touches.length !== 1) return;
    const T = tops(), t = e.touches[0];
    const i = T.reduce((k, y, n) => (Math.abs(y - scrollY) < Math.abs(T[k] - scrollY) ? n : k), 0);
    drag = { x0: t.clientX, y0: t.clientY, s0: scrollY, i, T, moved: false, pts: [[e.timeStamp, t.clientY]] };
  }, { passive: true });
  addEventListener('touchmove', e => {
    if (!drag) return;
    if (e.touches.length !== 1) { drag = null; return; } // a second finger: a pinch
    const t = e.touches[0], dy = drag.y0 - t.clientY;
    if (!drag.moved) {
      if (Math.abs(dy) < 8 || Math.abs(dy) < Math.abs(t.clientX - drag.x0)) return; // a tap, or sideways
      drag.moved = true;
      cancelAnimationFrame(settling);
      root.classList.add('no-snap'); // snapping would pull every step of the finger back to a page top
    }
    drag.pts.push([e.timeStamp, t.clientY]);
    if (drag.pts.length > 8) drag.pts.shift();
    scrollTo(0, Math.max(0, Math.min(drag.T[drag.T.length - 1], drag.s0 + dy)));
  }, { passive: true });
  const release = () => {
    const d = drag;
    drag = null;
    if (!d?.moved) return;
    // the finger's speed over its last 100ms (px/ms, up is positive), and how far the page has come
    const b = d.pts[d.pts.length - 1], a = d.pts.find(q => b[0] - q[0] <= 100) || d.pts[0];
    const v = b[0] > a[0] ? (a[1] - b[1]) / (b[0] - a[0]) : 0, off = scrollY - d.T[d.i], far = innerHeight * .2;
    const dir = v > .3 || (v > -.3 && off > far) ? 1 : v < -.3 || (v < .3 && off < -far) ? -1 : 0;
    const y = d.T[Math.max(0, Math.min(d.T.length - 1, d.i + dir))];
    scrollTo({ top: y, behavior: motion ? 'smooth' : 'instant' });
    // snapping comes back once the page has arrived (or stopped, or a moment has passed)
    const t0 = performance.now();
    let last = NaN, still = 0;
    const check = now => {
      if (drag?.moved) return;
      still = scrollY === last ? still + 1 : 0;
      last = scrollY;
      if (Math.abs(scrollY - y) < 1 || (still > 3 && now - t0 > 250) || now - t0 > 1500) return root.classList.remove('no-snap');
      settling = requestAnimationFrame(check);
    };
    settling = requestAnimationFrame(check);
  };
  addEventListener('touchend', release, { passive: true });
  addEventListener('touchcancel', release, { passive: true });
}

function idleArm(ms = 4000) { clearTimeout(idleFlowT); idleFlowT = later(ms, peekMaybe); }
function peekMaybe() {
  if (peeking || window.__aaNoPeek) return; // __aaNoPeek: tools/capture.mjs, for stills that must hold still
  if (document.hidden || gliding) return idleArm();
  const s = sections[cur], next = s?.nextElementSibling;
  // the wedding and the reception only, once their prompt is in, at rest on their top, and at most twice each
  if (!next?.matches('[data-section]')) return;
  if (!$('[data-next]', s)?.classList.contains('is-in')) return idleArm();
  if (Math.abs(s.getBoundingClientRect().top) > 2) return; // between pages: the next scroll re-arms it
  const n = peeks.get(s) || 0;
  if (n >= 2) return;
  peeks.set(s, n + 1);
  peek(next);
}
// the page glides up about 70px, so the top of the next page shows (its frame, clasp and first line, or its arch,
// drawing in: .is-peek), holds, and settles back. Snapping is lifted while it runs; a touch, wheel or key ends it.
const inOut = solve(.45, .55, 0, 1);
function peek(next) {
  const y0 = scrollY, D = 70, UP = 650, HOLD = 700, DOWN = 700, t0 = performance.now();
  next.classList.add('is-peek');
  root.classList.add('no-snap');
  peeking = { y0, raf: 0, at: y0 };
  const step = now => {
    if (!peeking) return;
    if (Math.abs(scrollY - peeking.at) > 1) return endPeek(false); // something else moved the page: give way
    const t = now - t0;
    const k = t < UP ? inOut(t / UP) : t < UP + HOLD ? 1 : t < UP + HOLD + DOWN ? 1 - inOut((t - UP - HOLD) / DOWN) : 0;
    peeking.at = y0 + Math.round(D * k * 2) / 2;
    scrollTo(0, peeking.at);
    if (t >= UP + HOLD + DOWN) return endPeek(true);
    peeking.raf = requestAnimationFrame(step);
  };
  peeking.raf = requestAnimationFrame(step);
}
function endPeek(done) {
  if (!peeking) return;
  cancelAnimationFrame(peeking.raf);
  const { y0 } = peeking;
  peeking = null;
  if (done) {
    scrollTo(0, y0);
    quietUntil = performance.now() + 120; // its own last scroll event must not re-arm the 4s
    idleArm(5000); // the second (and last) peek about 7s after the first began
  }
  root.classList.remove('no-snap');
}
function cancelPeek() { endPeek(false); }
// A press during a peek must land on what the guest saw. Settling back at once slid the prompt out from under the
// finger, so a tap on "Next" did nothing (measured on the live site: taps 5.6-6.2s after opening were lost). Now the
// page holds still until the press is over: a tap on the prompt runs its own glide, a tap on the strip of the next page
// the peek showed goes on to that page, a swipe is left to L2 paging, and anything else settles back to the page top.
function holdPeek(e) {
  if (!peeking) return;
  if (e.type === 'wheel' || e.type === 'keydown') return cancelPeek();
  cancelAnimationFrame(peeking.raf);
  const { y0 } = peeking, s = sections[cur], next = s?.nextElementSibling;
  peeking = null;
  const toNext = !!(e.target?.closest?.('[data-next]') || (next?.matches?.('[data-section]') && next.contains(e.target)));
  const p0 = e.touches?.[0] || e;
  let moved = false, over = false;
  const onMove = m => {
    const p = m.touches?.[0] || m;
    if (Math.abs((p.clientY ?? 0) - (p0.clientY ?? 0)) >= 8) moved = true;
  };
  const finish = () => {
    if (over) return;
    over = true;
    for (const n of ['pointerup', 'pointercancel', 'touchend', 'touchcancel']) removeEventListener(n, up, true);
    removeEventListener('touchmove', onMove, true);
    removeEventListener('pointermove', onMove, true);
    if (moved || gliding) return; // a swipe (L2 paging) or the prompt's own click has taken over
    if (toNext && next) return glide($('[data-next]', s) || e.target, next, e);
    scrollTo({ top: y0, behavior: motion ? 'smooth' : 'instant' });
    later(650, () => { if (!gliding && !peeking && Math.abs(scrollY - y0) < 2) root.classList.remove('no-snap'); });
  };
  const up = () => later(80, finish); // let the click, and the glide it starts, run first
  for (const n of ['pointerup', 'pointercancel', 'touchend', 'touchcancel']) addEventListener(n, up, { capture: true, passive: true });
  addEventListener('touchmove', onMove, { capture: true, passive: true });
  addEventListener('pointermove', onMove, { capture: true, passive: true });
  later(2500, finish); // a press that never ends (a long hold): settle anyway
}

// a keyboard guest never lands on a control that is still waiting for its reveal
function setupFocus() {
  if (!motion) return;
  document.addEventListener('focusin', e => {
    if (!landed) return;
    const s = e.target.closest?.('[data-section]');
    if (s && s !== inv) reveal(s);
    if (inv.classList.contains('is-in') && (acts.contains(e.target) || e.target.matches?.('[data-gcal]'))) actionsIn();
    if (e.target.matches?.('[data-reception-directions]')) actionsIn(e.target.closest('.actions'));
  });
}

try { init(); } catch (err) {
  console.warn('invitation choreography disabled:', err);
  root.classList.remove('js', 'motion', 'reduce-motion', 'is-open', 'is-landed');
}
