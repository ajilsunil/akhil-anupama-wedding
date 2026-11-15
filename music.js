// A & A background music (DESIGN.md K). One <audio> element, made at load with preload="none" and the best source
// the browser can play (AAC in an .m4a first, then .mp3), looping. Nothing sounds before the guest's tap on the cover:
// main.js calls start() synchronously inside that tap's handler, so iOS Safari counts play() as the guest's own
// gesture. It plays from silence and fades up to LEVEL; where the element's volume is read-only (iOS) it simply plays.
// The small gold toggle ([data-sound], index.html) fades in once the invitation has opened (styles.css): a tap fades
// the music out and pauses it, or plays it again with the same fade, and the choice is remembered ('aa-music').
// A hidden tab or a locked phone pauses it, and it comes back only if it was playing.
// Everything is optional: no audio support, a missing file or a refused play() leave the page exactly as it was
// (no toggle, or the toggle showing muted, waiting for a tap of its own).
//
//   initMusic({ reducedMotion })   once, at load: the element, the toggle, early buffering, the page-life listeners
//   start()                         inside the cover's tap/click/keydown handler; idempotent
const KEY = 'aa-music', LEVEL = .32, FADE_IN = 2500, FADE_BACK = 1500, FADE_OUT = 400;
const SOURCES = [['audio/kalyanam.m4a', 'audio/mp4; codecs="mp4a.40.2"'], ['audio/kalyanam.mp3', 'audio/mpeg']];

let audio = null, btn = null, queue = [];
let want = false;          // the music should be heard (the guest's intent: drives the toggle)
let live = false;          // play() has resolved and nothing has paused it since
let started = false, broken = false, warmed = false, resumeOnShow = false;
let canVol = true, fadeT = 0, fadeDone = null;

const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const store = v => { try { localStorage.setItem(KEY, v); } catch { /* private mode: the choice lasts this visit */ } };

export function initMusic({ reducedMotion = false } = {}) {
  if (audio || broken) return;
  btn = document.querySelector('[data-sound]');
  let a;
  try { a = document.createElement('audio'); } catch { a = null; }
  queue = a?.canPlayType ? SOURCES.filter(([, type]) => { try { return a.canPlayType(type) !== ''; } catch { return false; } }).map(([src]) => src) : [];
  if (!queue.length) { broken = true; return; } // no player at all: the toggle stays hidden
  audio = a;
  a.preload = 'none';
  a.loop = true;
  a.src = queue.shift();
  // iOS Safari keeps the element's volume at 1 whatever it is set to: there the music plays at its own level
  try { a.volume = .5; canVol = Math.abs(a.volume - .5) < .01; a.volume = 1; } catch { canVol = false; }

  a.addEventListener('error', failed);
  // paused from outside (a headset unplugged, the phone's media controls): the toggle follows, nothing is saved
  a.addEventListener('pause', () => { if (want && live && !document.hidden) { want = false; live = false; reflect(); } });
  try { navigator.mediaSession && (navigator.mediaSession.metadata = new MediaMetadata({ title: 'Athulraj & Aiswarya' })); } catch { /* optional */ }

  if (btn) {
    btn.hidden = false;
    btn.classList.toggle('is-still', !!reducedMotion);
    btn.addEventListener('click', toggle);
    reflect();
    tuck();
  }

  // start buffering early: the first press on the cover, or once the cover photograph is in and the page is idle
  // (not on a data-saver connection, where only the press does it; not at all for a guest who muted it last time)
  const cover = stored() === 'off' ? null : document.querySelector('[data-cover]');
  cover?.addEventListener('pointerdown', warm, { once: true, passive: true });
  cover?.addEventListener('keydown', warm, { once: true, passive: true });
  let saveData = false;
  try { saveData = !!navigator.connection?.saveData; } catch { /* unknown */ }
  if (cover && !saveData) {
    const idle = () => (window.requestIdleCallback ? requestIdleCallback(warm, { timeout: 2500 }) : setTimeout(warm, 1200));
    const img = document.querySelector('[data-cover-shot] img');
    const afterLoad = () => (document.readyState === 'complete' ? idle() : addEventListener('load', idle, { once: true }));
    if (!img || img.complete) afterLoad();
    else { img.addEventListener('load', afterLoad, { once: true }); img.addEventListener('error', afterLoad, { once: true }); }
  }

  // a hidden tab or a locked phone pauses it; it comes back (with a short fade) only if it was meant to be playing
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hush();
    else if (resumeOnShow) play(FADE_BACK);
  });
  addEventListener('pagehide', hush);
  addEventListener('pageshow', e => { if (e.persisted && !document.hidden && resumeOnShow) play(FADE_BACK); });
}

// inside the guest's tap on the cover (main.js open()): play now, from silence, unless they muted it on an earlier visit
export function start() {
  if (!audio || broken || started) return;
  started = true;
  if (stored() === 'off') return reflect();
  play(FADE_IN);
}

function warm() {
  if (!audio || broken || warmed) return;
  warmed = true;
  audio.preload = 'auto';
  // a load deferred by preload="none" does not resume everywhere when the attribute changes: ask for it, but
  // never once play() has been called (load() would cut it off)
  if (!want && !live && audio.readyState === 0 && audio.networkState !== 2) { try { audio.load(); } catch { /* fine */ } }
}

function play(ms) {
  if (!audio || broken) return;
  want = true;
  resumeOnShow = false;
  warmed = true;
  audio.preload = 'auto';
  reflect();
  stopFade();
  if (canVol && !live) audio.volume = 0; // from silence; a fade-out still under way turns round where it is
  let p;
  try { p = audio.play(); } catch (err) { return refused(err); }
  const up = () => { if (want) { live = true; fade(LEVEL, ms); } };
  if (p && typeof p.then === 'function') p.then(up, refused);
  else up();
}

function refused(err) {
  // AbortError: a pause() or a new source came first. NotSupportedError: the file is missing or unplayable,
  // which the element's error event handles (the next source, or no music)
  if (err?.name === 'AbortError' || err?.name === 'NotSupportedError') return;
  // NotAllowedError (the tap reached main.js before this module, outside the gesture): the toggle shows muted,
  // and a tap on it plays (nothing is saved)
  want = false;
  live = false;
  reflect();
}

function failed() {
  stopFade();
  live = false;
  if (queue.length) { // the .m4a is missing: try the .mp3, and play it if the music was meant to be on
    audio.src = queue.shift();
    if (warmed) audio.preload = 'auto';
    if (want) play(FADE_IN);
    return;
  }
  broken = true;
  want = false;
  if (btn) btn.hidden = true; // no music to offer: no toggle
}

function toggle() {
  if (broken) return;
  if (want) {
    store('off');
    want = false;
    resumeOnShow = false;
    reflect();
    if (canVol && live) fade(0, FADE_OUT, pauseNow);
    else pauseNow();
  } else {
    store('on');
    play(FADE_IN);
  }
}

function hush() {
  if (!audio) return;
  if (want) resumeOnShow = true;
  if (live || want) pauseNow();
}

function pauseNow() {
  stopFade();
  live = false;
  try { audio.pause(); } catch { /* fine */ }
}

// the volume, eased (slow to rise from silence, quick to fall away); one fade at a time
function fade(to, ms, done) {
  stopFade();
  if (!canVol) return done?.();
  const from = audio.volume, t0 = performance.now();
  fadeDone = done || null;
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / ms);
    const k = to > from ? t * t : 1 - (1 - t) * (1 - t);
    try { audio.volume = Math.min(1, Math.max(0, from + (to - from) * k)); } catch { /* fine */ }
    if (t < 1) return;
    const fn = fadeDone;
    stopFade();
    fn?.();
  };
  fadeT = setInterval(step, 40);
  step();
}
function stopFade() {
  clearInterval(fadeT);
  fadeT = 0;
  fadeDone = null;
}

function reflect() {
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(want));
  btn.classList.toggle('is-on', want);
}

// On a phone the reception's gold frame runs 28px inside the screen's edges, so wherever a corner toggle sits it
// would cross that frame (or its corner) while the reception is on screen. The toggle steps aside instead: it fades
// out while the frame passes under it and comes back once it has gone (styles.css .is-tucked); a keyboard focus
// still shows it. One rect read per frame while scrolling, none at rest.
function tuck() {
  const avoid = [...document.querySelectorAll('[data-panel]')];
  if (!avoid.length) return;
  let queued = false;
  const check = () => {
    queued = false;
    if (btn.hidden) return;
    const b = btn.getBoundingClientRect();
    if (!b.width) return;
    const over = avoid.some(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.bottom > b.top - 6 && r.top < b.bottom + 6 && r.right > b.left - 6 && r.left < b.right + 6;
    });
    if (over !== btn.classList.contains('is-tucked')) btn.classList.toggle('is-tucked', over);
  };
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask, { passive: true });
  check();
}
