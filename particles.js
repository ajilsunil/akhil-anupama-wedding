// A & A particles (DESIGN.md "Particles API"): gold dust, star glints, jasmine petals. Viewport CSS px.
const { sin, cos, sqrt, min, max, exp, hypot, atan2, random, round, abs, ceil, PI } = Math;
const TAU = PI * 2, GOLD = '214,188,138', BRIGHT = '243,227,188', MOTE = 1, GLINT = 2, PETAL = 3, MAX = 900;
const rnd = (a, b) => a + random() * (b - a);
const sat = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function box(w, h = w) { const c = document.createElement('canvas'); c.width = ceil(w); c.height = ceil(h); return [c, c.getContext('2d')]; }
function radial(g, x, y, r, stops) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, rgb, a] of stops) gr.addColorStop(o, `rgba(${rgb},${a})`);
  return gr;
}

function sprites(k) { // pre-rendered once per device pixel ratio k
  const fillDisc = (g, c, r, stops) => { g.fillStyle = radial(g, c, c, r, stops); g.fillRect(0, 0, 2 * c, 2 * c); };
  // glow mote: bright core melting into a gold halo
  const [glow, gg] = box(40 * k);
  fillDisc(gg, 20 * k, 20 * k, [[0, BRIGHT, 1], [.1, BRIGHT, .95], [.22, GOLD, .6], [.45, GOLD, .2], [.72, GOLD, .05], [1, GOLD, 0]]);
  const dot = rgb => { const [c, g] = box(8 * k); fillDisc(g, 4 * k, 4 * k, [[0, rgb, 1], [.45, rgb, .95], [1, rgb, 0]]); return c; };

  // glint: four hair-thin rays, small glow, bright core
  const [glint, lg] = box(36 * k), c = 18 * k;
  const star = (L, Lh) => {
    const q = (x, y) => lg.bezierCurveTo(c, c, c, c, x, y);
    lg.beginPath(); lg.moveTo(c, c - L); q(c + Lh, c); q(c, c + L); q(c - Lh, c); q(c, c - L);
    lg.fillStyle = radial(lg, c, c, L, [[0, BRIGHT, 1], [.4, BRIGHT, .85], [.75, GOLD, .45], [1, GOLD, 0]]);
    lg.fill();
  };
  fillDisc(lg, c, c * .5, [[0, BRIGHT, .5], [.3, GOLD, .2], [1, GOLD, 0]]);
  star(c, c * .78);
  star(c * .34, c * .3);
  fillDisc(lg, c, 2.6 * k, [[0, BRIGHT, 1], [.5, BRIGHT, 1], [1, BRIGHT, 0]]);

  // jasmine petal: ivory teardrop, slight curl, soft warm halo, light shadow, warm base, gold vein
  const L = 16 * k, hw = L * .19, m = 2 * k, [petal, pg] = box(L + 2 * m, 2.3 * hw + 2 * m);
  pg.translate(m, petal.height / 2 + hw * .12);
  pg.save(); pg.translate(L * .55, -hw * .2); pg.scale(1, 2 * hw / L);
  pg.fillStyle = radial(pg, 0, 0, L * .6, [[0, BRIGHT, .25], [.6, BRIGHT, .12], [1, BRIGHT, 0]]);
  pg.fillRect(-L, -L, 2 * L, 2 * L); pg.restore();
  const shape = () => {
    pg.beginPath(); pg.moveTo(0, 0);
    pg.bezierCurveTo(L * .22, -hw * .3, L * .44, -hw * 1.2, L * .72, -hw * 1.14);
    pg.bezierCurveTo(L * .94, -hw * 1.08, L * 1.02, -hw * .55, L, -hw * .12);
    pg.bezierCurveTo(L * .98, hw * .36, L * .9, hw * .76, L * .7, hw * .74);
    pg.bezierCurveTo(L * .46, hw * .72, L * .24, hw * .2, 0, 0);
  };
  const shade = (x1, y0, y1, stops) => {
    const gr = pg.createLinearGradient(0, y0, x1, y1);
    for (const [o, a] of stops) gr.addColorStop(o, `rgba(${GOLD},${a})`);
    pg.fillStyle = gr; pg.fillRect(0, -2 * hw, L, 4 * hw);
  };
  pg.save();
  pg.shadowColor = 'rgba(11,29,23,.35)'; pg.shadowBlur = 1.6 * k; pg.shadowOffsetY = .5 * k;
  shape(); pg.fillStyle = '#F1EBDD'; pg.fill();
  pg.restore();
  pg.save(); shape(); pg.clip();
  shade(0, -hw * 1.1, hw * .7, [[0, .12], [.35, 0], [1, .45]]);
  shade(L, 0, 0, [[0, .45], [.42, 0]]);
  pg.restore();
  pg.beginPath(); pg.moveTo(L * .1, 0); pg.quadraticCurveTo(L * .45, -hw * .12, L * .82, -hw * .34);
  pg.strokeStyle = `rgba(${GOLD},.8)`; pg.lineWidth = .45 * k; pg.stroke();

  return { glow, dot: dot(GOLD), dotB: dot(BRIGHT), glint, petal, pw: petal.width / L, ph: petal.height / L };
}

export function createParticles(canvas, { reducedMotion = false, dustCanvas = null } = {}) {
  const layer = el => { el.setAttribute('aria-hidden', 'true'); el.style.pointerEvents = 'none'; el.style.width = '100%'; return { c: el, g: el.getContext('2d') }; };
  const top = canvas && layer(canvas);
  if (!top?.g) { const n = () => {}; return { startAmbient: n, stopAmbient: n, burst: n, shower: n, sparkle: n, fountain: n, trail: n, resize: n, destroy: n }; }
  const back = dustCanvas && dustCanvas !== canvas ? layer(dustCanvas) : top; // dust layer (behind the text)
  const layers = back === top ? [top] : [top, back];
  const wipe = ({ c, g }) => { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); };
  const clear = () => layers.forEach(wipe);

  let W = 0, H = 0, BH = 0, dpr = 0, S, raf = 0, last = 0, clock = 0, ox = 0, oy = 0, dead = false, ambient = false, amb = 0, skip = false, topDirty = false;
  const live = [], pool = [], dust = [], emitters = [];

  function add(t, x, y, vx, vy, s, life, k, g) {
    if (live.length >= MAX) return {}; // full: drop it
    const p = pool.pop() || {}, pe = t === PETAL;
    p.t = t; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.s = s; p.life = life; p.k = k; p.g = g;
    p.age = 0; p.fin = .05; p.fo = life * .4; p.sw = 0; p.swf = rnd(.9, 1.9); p.ramp = .7; p.fall = false;
    p.ph = rnd(0, TAU); p.f = rnd(4.5, 9); p.ff = pe ? rnd(1, 2.2) : rnd(1.6, 3.4); p.r = pe ? rnd(0, TAU) : rnd(-.2, .2); p.vr = pe ? rnd(-.6, .6) : rnd(-.15, .15);
    live.push(p);
    return p;
  }

  function fillDust() {
    const n = W >= 768 ? 44 : 28;
    dust.length = min(dust.length, n);
    while (dust.length < n) dust.push({ x: rnd(0, W), y: rnd(0, H), vy: -rnd(8, 20), r: rnd(1, 2.6), b: random() < .4, glow: dust.length % 3 === 0,
      ph: rnd(0, TAU), f: rnd(.5, 1.6), sw: rnd(4, 12), swf: rnd(.25, .6), ph2: rnd(0, TAU) });
  }

  function resize() {
    if (dead) return;
    const w = document.documentElement.clientWidth || innerWidth || 1, h = innerHeight || 1, d = min(2, devicePixelRatio || 1);
    // phone toolbars change the height while scrolling: the buffer is sized for the tall viewport and kept,
    // and the dust rescales only with the width (no hop at the first scroll)
    const tall = max(h, min((screen && screen.height) || 0, h + 240)), bh = w === W && d === dpr ? max(BH, tall) : tall;
    if (d !== dpr) { dpr = d; S = sprites(d); }
    if (W && w !== W) for (const q of dust) { q.x *= w / W; q.y *= h / H; }
    W = w; H = h; BH = bh;
    for (const { c, g } of layers) {
      const cw = round(w * d), ch = round(bh * d);
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      c.style.height = bh + 'px'; g.imageSmoothingQuality = 'high';
    }
    const r = top.c.getBoundingClientRect(); ox = r.left; oy = r.top;
    if (ambient) fillDust();
  }

  function kick() { if (!raf && !dead && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  function frame(now) {
    raf = 0;
    // only slow dust alive (under half a pixel a frame): draw every other frame
    if (!live.length && !emitters.length && amb >= 1 && (skip = !skip)) { raf = requestAnimationFrame(frame); return; }
    const dt = min(.05, max(0, (now - last) / 1000)); last = now; clock += dt;
    amb = ambient ? min(1, amb + dt / 1.5) : max(0, amb - dt / .9);
    if (!amb && !ambient) dust.length = 0;
    for (let i = emitters.length - 1; i >= 0; i--) {
      const e = emitters[i], u = min(1, (e.t += dt) / e.d), want = round(e.n * (1 - (1 - u) ** 1.6));
      while (e.done < want) { e.done++; rain(u); }
      if (u >= 1) emitters.splice(i, 1);
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      if ((p.age += dt) >= p.life || (p.fall && p.y > H + 16)) { live[i] = live[live.length - 1]; live.pop(); pool.push(p); continue; }
      const d = exp(-p.k * dt); // drag; gravity settles at g/k px/s
      p.vx *= d; p.vy = p.vy * d + p.g * dt;
      p.x += (p.vx + sin(p.age * p.swf + p.ph) * p.sw * min(1, p.age / p.ramp)) * dt;
      p.y += p.vy * dt; p.r += p.vr * dt;
    }
    for (const q of dust) if ((q.y += q.vy * dt) < -12) { q.y = H + 12; q.x = rnd(0, W); }
    draw();
    if (ambient || amb || live.length || emitters.length) raf = requestAnimationFrame(frame);
  }

  function env(p) { // 0..1: fade in, fade out, fade near the bottom when falling
    const e = sat(min(p.age / p.fin, (p.life - p.age) / p.fo, 1) * (p.fall ? sat((H - p.y) / (H * .2)) : 1));
    return e * e * (3 - 2 * e);
  }

  function put(p, img, alpha, angle, sx, sy, w, h = w) { // img centred on p, rotated, axes scaled
    const g = top.g, co = cos(angle) * dpr, si = sin(angle) * dpr;
    g.globalAlpha = alpha; g.setTransform(co * sx, si * sx, -si * sy, co * sy, p.x * dpr, p.y * dpr); g.drawImage(img, -w / 2, -h / 2, w, h);
  }

  function draw() {
    const k = dpr, g = top.g;
    if (back !== top) wipe(back);
    if (back === top || topDirty || live.length) wipe(top); // the effects layer over the page is only touched when used
    topDirty = live.length > 0;
    if (amb) {
      const b = back.g;
      b.setTransform(k, 0, 0, k, 0, 0); b.globalCompositeOperation = 'lighter';
      for (const q of dust) {
        const a = (.12 + .58 * (.5 + .5 * sin(clock * q.f + q.ph))) * amb * sat(q.y / 60) * sat((H - q.y) / 60);
        const x = q.x + sin(clock * q.swf + q.ph2) * q.sw, d = q.r * 2.4;
        if (q.glow) { b.globalAlpha = a * .5; b.drawImage(S.glow, x - q.r * 5, q.y - q.r * 5, q.r * 10, q.r * 10); }
        b.globalAlpha = a; b.drawImage(q.b ? S.dotB : S.dot, x - d / 2, q.y - d / 2, d, d);
      }
    }
    if (!live.length) return;
    g.globalCompositeOperation = 'source-over';
    for (const p of live) {
      if (p.t !== PETAL) continue;
      // flutter: long axis rocks, width axis turns over, light shifts as it turns
      const e = env(p), fl = cos(p.age * p.ff + p.ph), sc = p.s * (.35 + .65 * e);
      put(p, S.petal, sqrt(e) * (.82 + .12 * abs(fl)), p.r + sin(p.age * p.swf * 1.3 + p.ph) * .7, 1, (fl < 0 ? -.34 : .34) + .66 * fl, sc * S.pw, sc * S.ph);
    }
    g.globalCompositeOperation = 'lighter';
    for (const p of live) {
      // sparks die by shrinking, not fading (faded gold turns grey on green); petals get a faint glow
      const e = env(p), a = sqrt(e), tw = .5 + .5 * sin(p.age * p.f + p.ph);
      if (p.t === PETAL) put(p, S.glow, .12 * a, 0, 1, 1, p.s * (.35 + .65 * e) * 1.2);
      else if (p.t === MOTE) { // fast motes stretch into thin light trails
        const st = min(3.2, 1 + max(0, hypot(p.vx, p.vy) - 170) / 130), n = 1 / sqrt(st);
        put(p, S.glow, a * (.75 + .25 * tw) * n, atan2(p.vy, p.vx), st, n, p.s * (.25 + .75 * e));
      } else put(p, S.glint, a * (.6 + .4 * tw), p.r, 1, 1, p.s * (.2 + .8 * e) * (.72 + .28 * tw));
    }
    g.globalAlpha = 1;
  }

  function rain(u) { // early drops start spread over the upper half so the rain begins at once
    // petals only in the first 70%, fading out with the sparkles instead of falling for 15s
    const x = rnd(-10, W + 10), y = -14 + random() * H * .5 * (1 - u) ** 2, r = random(), pe = r < .22 && u < .7;
    const vt = pe ? rnd(80, 130) : rnd(80, 140);
    const p = add(pe ? PETAL : r < .55 ? GLINT : MOTE, x, y, 0, vt, pe ? rnd(13, 16) : r < .26 ? rnd(24, 32) : r < .55 ? rnd(11, 22) : rnd(8, 16),
      pe ? rnd(3.4, 4.6) : rnd(2.8, 4.8), 1.4, vt * 1.4);
    p.sw = pe ? rnd(18, 36) : rnd(6, 16); p.fall = true; p.ramp = .01; p.fin = pe ? .5 : rnd(.35, .7);
    if (pe) p.fo = 1.4;
  }

  function burst(x, y, { count = 90 } = {}) {
    if (reducedMotion || dead) return;
    // wider screens: a bigger, faster flash (phone 1x). 15% petals, 30% glints (a few large), the rest motes.
    // Lives end within 1s (the names' wipe starts at 1200ms); a lift takes them up after the monogram.
    const f = min(1.8, max(1, min(W, H) / 700)), n = round(count * f);
    const np = round(n * .15), hero = np + max(1, round(n / 18)), ng = np + round(n * .3);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), ca = cos(a), sa = sin(a), r0 = rnd(4, 24) * f, pe = i < np;
      // [type, speed, size, life, drag, gravity (<0: lift)]
      const up = -rnd(140, 220), [t, v, s, life, dk, gy] = pe ? [PETAL, rnd(80, 300), rnd(13, 16), rnd(.8, 1), 2.3, -90]
        : i < hero ? [GLINT, rnd(90, 300), rnd(26, 36), rnd(.75, 1), 3.2, up]
        : i < ng ? [GLINT, 100 + 480 * random() ** .6, rnd(10, 21), rnd(.65, .95), 3.2, up]
        : [MOTE, 120 + 600 * random() ** .55, rnd(8, 18), rnd(.55, .9), rnd(3, 3.6), up];
      const p = add(t, x - ox + ca * r0, y - oy + sa * r0, ca * v * f * 1.35, (sa * v - 90) * f, s, life, dk, gy);
      p.ramp = 1; p.sw = pe ? rnd(14, 30) : rnd(5, 12);
      if (pe) p.fo = .45; else if (i < hero) p.f = rnd(3, 5);
    }
    kick();
  }

  function fountain(x, y, { count = 18, spread = 40 } = {}) { // gold rising from a pressed button
    if (reducedMotion || dead) return;
    for (let i = 0; i < count; i++) {
      const gl = i % 3 !== 2; // two glints to one fast mote (it stretches into a rising streak)
      const p = add(gl ? GLINT : MOTE, x - ox + rnd(-spread, spread), y - oy + rnd(-4, 6), rnd(-50, 50), -rnd(420, 620),
        gl ? rnd(14, 24) : rnd(10, 16), rnd(.95, 1.25), 1.6, 40);
      p.fin = .04; p.fo = p.life * .5; p.sw = rnd(4, 10); p.ramp = .3;
    }
    kick();
  }

  function shower({ duration = 2600 } = {}) {
    if (reducedMotion || dead) return;
    // phone: 180 (about 140 sparkles, 40 petals); wider screens scale up to 2.4x
    emitters.push({ t: 0, d: max(.3, duration / 1000), n: round(180 * min(2.4, max(1, W / 430))), done: 0 });
    kick();
  }

  function sparkle(x, y, count = 12, { life = 1, lift = 14 } = {}) { // reduced motion: a still twinkle in place
    if (dead) return;
    for (let i = 0; i < count; i++) {
      const a = rnd(0, TAU), ca = cos(a), sa = sin(a), r0 = rnd(2, 12), gl = i % 2 === 0, v = reducedMotion ? 0 : rnd(40, 190);
      const p = add(gl ? GLINT : MOTE, x - ox + ca * r0, y - oy + sa * r0, ca * v, sa * v, gl ? rnd(9, 18) : rnd(5, 10), rnd(.7, 1.3) * life, 4, reducedMotion ? 0 : -lift);
      p.fo = p.life * .65; p.fin = .04;
    }
    kick();
  }

  function trail(x, y, count = random() < .5 ? 2 : 1) { // H1 drag trail: tiny motes left at the finger, rising a little
    if (reducedMotion || dead) return;
    for (let i = 0; i < count; i++) { // now and then the second one is a tiny glint
      const a = rnd(0, TAU), v = rnd(6, 30), gl = i && random() < .4;
      const p = add(gl ? GLINT : MOTE, x - ox + rnd(-5, 5), y - oy + rnd(-5, 5), cos(a) * v, sin(a) * v - 12, gl ? rnd(9, 13) : rnd(10, 16), rnd(.5, .7), 3, -rnd(40, 70));
      p.fin = .03; p.fo = p.life * .7; p.sw = rnd(2, 6); p.ramp = .2;
    }
    kick();
  }

  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else kick(); };
  addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);
  resize();

  return {
    startAmbient() { if (reducedMotion || dead) return; ambient = true; fillDust(); kick(); }, // 1.5s fade in
    stopAmbient() { ambient = false; }, // 0.9s fade out
    burst, shower, sparkle, fountain, trail, resize,
    destroy() {
      if (dead) return;
      dead = true; ambient = false; cancelAnimationFrame(raf); raf = 0;
      removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      live.length = pool.length = dust.length = emitters.length = 0;
      clear();
    },
  };
}
