/* Spell and item effects, drawn on a transparent canvas over the 3D view.
   The game queues effects during a turn (fx('fireball'), fx('death', {mon}) ...) and plays
   them in order after the view is redrawn. A monster killed by the effect is kept on screen
   (the "ghost") until its death effect fades it out. */
'use strict';

const FXP = (() => {
  const W = 640, H = 480, TAU = Math.PI * 2;
  const HAND = { x: 410, y: 530 };                 // where your spells come from (bottom right)
  let cv, c, raf = 0, queue = [], cur = null, T = null, ghost = null, shakeEls = [];

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = t => t < 0 ? 0 : t > 1 ? 1 : t;
  const easeIn = t => t * t, easeOut = t => 1 - (1 - t) * (1 - t);
  const rnd = n => Array.from({ length: n }, Math.random);

  function orb(x, y, r, inner, mid, outer, a = 1) {
    if (r <= 0 || a <= 0) return;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(.35, mid); g.addColorStop(1, outer);
    c.globalAlpha = a; c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.globalAlpha = 1;
  }
  function flash(col, a) { if (a <= 0) return; c.globalAlpha = a; c.fillStyle = col; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
  function vignette(col, a) {
    if (a <= 0) return;
    const g = c.createRadialGradient(W / 2, H / 2, H * .25, W / 2, H / 2, W * .65);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col);
    c.globalAlpha = a; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
  }
  function shake(px) {
    const t = px > .5 ? 'translate(' + ((Math.random() * 2 - 1) * px).toFixed(1) + 'px,' + ((Math.random() * 2 - 1) * px).toFixed(1) + 'px)' : '';
    for (const el of shakeEls) el.style.transform = t;
  }
  function sparkles(e, t, colA, colB, glowCol) {
    c.globalCompositeOperation = 'lighter';
    const a = Math.sin(clamp01(t) * Math.PI);
    const g = c.createRadialGradient(W / 2, H + 40, 20, W / 2, H + 40, H * .9);
    g.addColorStop(0, glowCol); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = .45 * a; c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1;
    for (let i = 0; i < 34; i++) {
      const x = e.r[i] * W + Math.sin(t * 6 + i) * 10;
      const y = H + 20 - (t * (380 + e.r[i + 34] * 260)) + e.r[i + 68] * 120;
      const s = 3 + e.r[i + 34] * 6, al = a * (0.5 + e.r[i] * .5);
      c.globalAlpha = al; c.fillStyle = i % 2 ? colA : colB;
      c.fillRect(x - s, y - s / 4, s * 2, s / 2); c.fillRect(x - s / 4, y - s, s / 2, s * 2);   // a little plus sign
      orb(x, y, s * 2.2, 'rgba(255,255,255,.7)', i % 2 ? colA : colB, 'rgba(0,0,0,0)', al * .6);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  function drawFist(x, y, s, a) {
    c.save();
    c.translate(x, y); c.scale(s, s); c.globalAlpha = a;
    c.shadowColor = '#8fd0ff'; c.shadowBlur = 40;
    const g = c.createLinearGradient(0, -60, 0, 70);
    g.addColorStop(0, 'rgba(240,250,255,.95)'); g.addColorStop(1, 'rgba(90,160,240,.75)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(-40, 40); c.lineTo(40, 40); c.lineTo(34, 95); c.lineTo(-34, 95); c.closePath(); c.fill();   // wrist
    c.beginPath();
    c.moveTo(-58, -8); c.quadraticCurveTo(-60, -40, -30, -44); c.lineTo(30, -44); c.quadraticCurveTo(60, -40, 58, -8);
    c.lineTo(52, 30); c.quadraticCurveTo(46, 50, 20, 50); c.lineTo(-20, 50); c.quadraticCurveTo(-46, 50, -52, 30); c.closePath(); c.fill();
    for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(-39 + 26 * k, -44, 15, Math.PI, 0); c.fill(); }          // knuckles
    c.beginPath(); c.ellipse(-60, 14, 15, 26, .45, 0, TAU); c.fill();                                           // thumb
    c.shadowBlur = 0; c.strokeStyle = 'rgba(40,90,170,.45)'; c.lineWidth = 3;
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(-52 + 26 * k, -46); c.lineTo(-52 + 26 * k, -8); c.stroke(); }
    c.restore();
  }
  function jagged(x0, y0, x1, y1, n, amp) {
    const pts = [[x0, y0]];
    for (let i = 1; i < n; i++) {
      const t = i / n, off = (Math.random() * 2 - 1) * amp * Math.sin(t * Math.PI);
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      pts.push([x0 + dx * t - dy / len * off, y0 + dy * t + dx / len * off]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  function strokePath(pts, col, w, blur) {
    c.shadowColor = col; c.shadowBlur = blur; c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.shadowBlur = 0;
  }

  const EFFECTS = {
    fireball: { dur: 900, draw(t, e) {
      c.globalCompositeOperation = 'lighter';
      const fly = .5;
      if (t < fly) {
        const u = easeIn(t / fly);
        for (let k = 8; k >= 0; k--) {
          const uu = Math.max(0, u - k * .035);
          const px = lerp(HAND.x, T.x, uu), py = lerp(HAND.y, T.y, uu) - Math.sin(uu * Math.PI) * 60;
          const r = lerp(70, 18 + 26 * T.s, uu) * (1 - k * .08);
          orb(px, py, r, 'rgba(255,255,220,1)', 'rgba(255,150,30,.9)', 'rgba(200,40,0,0)', k ? .3 : 1);
        }
      } else {
        const u = (t - fly) / (1 - fly), r = T.r * (1 + 2.6 * easeOut(u));
        c.globalCompositeOperation = 'source-over';
        orb(T.x, T.y, r * 1.15, 'rgba(255,200,80,' + (.85 * (1 - u)) + ')', 'rgba(230,90,10,' + (.7 * (1 - u)) + ')', 'rgba(120,20,0,0)');
        orb(T.x, T.y, r * .7, 'rgba(255,255,235,' + (1 - u) + ')', 'rgba(255,210,90,' + (1 - u) + ')', 'rgba(255,120,20,0)');
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 26; i++) {
          const ang = e.r[i] * TAU, d = r * (.3 + 1.1 * u * (.5 + e.r[i + 26]));
          orb(T.x + Math.cos(ang) * d, T.y + Math.sin(ang) * d * .8, 10 * (1 - u) + 3, '#fff6c0', 'rgba(255,140,20,.9)', 'rgba(255,60,0,0)', 1 - u);
        }
        flash('#ff7a20', .3 * (1 - u)); shake(10 * (1 - u));
      }
      c.globalCompositeOperation = 'source-over';
    } },
    fist: { dur: 850, draw(t, e) {
      const fly = .42, endS = .45 + .5 * T.s;
      if (t < fly) {
        const u = easeIn(t / fly);
        const x = lerp(W / 2 + 90, T.x, u), y = lerp(H + 120, T.y + 10, u);
        c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(160,210,255,.5)'; c.lineWidth = 3;
        for (let i = 0; i < 8; i++) {                 // speed lines behind the fist
          const a = e.r[i] * TAU, d0 = 80 * lerp(2.4, endS, u), d1 = d0 + 90 * (1 - u);
          c.beginPath(); c.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); c.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1); c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
        drawFist(x, y, lerp(2.4, endS, u), .9);
      } else {
        const u = (t - fly) / (1 - fly);
        drawFist(T.x, T.y + 10, endS * (1 + .12 * Math.sin(u * Math.PI)), .9 * (1 - u));
        c.globalCompositeOperation = 'lighter';
        for (const k of [0, .18]) {
          const v = clamp01(u - k);
          c.strokeStyle = 'rgba(180,225,255,' + (1 - v) + ')'; c.lineWidth = 12 * (1 - v) + 1;
          c.beginPath(); c.ellipse(T.x, T.y, T.r * (.5 + 2.2 * v), T.r * (.35 + 1.4 * v), 0, 0, TAU); c.stroke();
        }
        c.strokeStyle = 'rgba(255,255,255,' + (1 - u) + ')'; c.lineWidth = 4;
        for (let i = 0; i < 10; i++) {
          const a = i / 10 * TAU + e.r[i], d0 = T.r * .4, d1 = T.r * (.7 + 1.3 * easeOut(u));
          c.beginPath(); c.moveTo(T.x + Math.cos(a) * d0, T.y + Math.sin(a) * d0); c.lineTo(T.x + Math.cos(a) * d1, T.y + Math.sin(a) * d1); c.stroke();
        }
        c.globalCompositeOperation = 'source-over';
        flash('#bfe0ff', .22 * (1 - u)); shake(16 * (1 - u));
      }
    } },
    missile: { dur: 1000, init(e) { e.n = Math.max(1, Math.min(5, e.count || 3)); }, draw(t, e) {
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < e.n; i++) {
        const st = i * .1, u = clamp01((t - st) / .5);
        const sx = HAND.x - 60 + i * 30, sy = HAND.y;
        const cx = W / 2 + (e.r[i] - .5) * 620, cy = 60 + e.r[i + 5] * 220;
        const tx = T.x + (e.r[i + 10] - .5) * T.r, ty = T.y + (e.r[i + 15] - .5) * T.r * .8;
        const at = s => { const m = 1 - s; return [m * m * sx + 2 * m * s * cx + s * s * tx, m * m * sy + 2 * m * s * cy + s * s * ty]; };
        if (u > 0 && u < 1) {
          for (let k = 10; k >= 0; k--) {
            const [x, y] = at(Math.max(0, u - k * .025));
            orb(x, y, (14 - k) * 1.4, '#ffffff', 'rgba(230,110,255,.9)', 'rgba(120,0,200,0)', k ? .35 : 1);
          }
        } else if (u >= 1) {
          const v = clamp01((t - st - .5) / .3);
          orb(tx, ty, T.r * (.25 + .7 * v), '#ffffff', 'rgba(230,110,255,.9)', 'rgba(120,0,200,0)', 1 - v);
        }
      }
      c.globalCompositeOperation = 'source-over';
    } },
    bolt: { dur: 650, draw(t, e) {
      const now = performance.now();
      if (t < .7) {
        if (!e.pts || now - e.last > 55) {
          e.last = now;
          e.pts = jagged(HAND.x - 20, H + 10, T.x, T.y, 14, 45);
          e.br = [2, 3].map(() => { const k = 3 + (Math.random() * 7 | 0), p = e.pts[k]; return jagged(p[0], p[1], p[0] + (Math.random() - .5) * 220, p[1] - 40 - Math.random() * 90, 6, 18); });
          e.on = Math.random() > .25;
        }
        if (e.on) {
          c.globalCompositeOperation = 'lighter';
          strokePath(e.pts, 'rgba(120,190,255,.8)', 12, 30);
          e.br.forEach(b => strokePath(b, 'rgba(120,190,255,.6)', 5, 16));
          strokePath(e.pts, '#ffffff', 3, 8);
          orb(T.x, T.y, T.r * 1.1, '#ffffff', 'rgba(140,200,255,.7)', 'rgba(60,120,255,0)', .9);
          c.globalCompositeOperation = 'source-over';
          flash('#bfe0ff', .22); shake(6);
        } else shake(0);
      } else {
        const u = (t - .7) / .3;
        c.globalCompositeOperation = 'lighter';
        orb(T.x, T.y, T.r * (1 + u), '#e8f6ff', 'rgba(140,200,255,.5)', 'rgba(60,120,255,0)', 1 - u);
        c.globalCompositeOperation = 'source-over'; shake(0);
      }
    } },
    chill: { dur: 1000, draw(t, e) {
      const a = t < .3 ? t / .3 : 1 - (t - .3) / .7;
      vignette('rgba(170,225,255,.85)', .8 * a);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        const u = clamp01((t - i * .02) / .55);
        if (u <= 0 || u >= 1) continue;
        const ang = e.r[i] * TAU, d = (1 - easeIn(u)) * 460;
        const x = T.x + Math.cos(ang) * d, y = T.y + Math.sin(ang) * d * .8;
        c.save(); c.translate(x, y); c.rotate(ang + Math.PI);
        c.fillStyle = 'rgba(210,245,255,.9)'; c.shadowColor = '#9ae8ff'; c.shadowBlur = 12;
        c.beginPath(); c.moveTo(18, 0); c.lineTo(-10, -5); c.lineTo(-10, 5); c.closePath(); c.fill();
        c.restore();
      }
      if (t > .5) {
        const v = clamp01((t - .5) / .5), R = T.r * (.4 + 1.1 * easeOut(v));
        orb(T.x, T.y, T.r * 1.3, 'rgba(200,240,255,.6)', 'rgba(120,200,255,.35)', 'rgba(60,140,255,0)', 1 - v * .7);
        c.strokeStyle = 'rgba(230,250,255,' + (1 - v) + ')'; c.lineWidth = 4; c.lineCap = 'round';
        for (let k = 0; k < 6; k++) {
          const ang = k / 6 * TAU;
          const ex = T.x + Math.cos(ang) * R, ey = T.y + Math.sin(ang) * R;
          c.beginPath(); c.moveTo(T.x, T.y); c.lineTo(ex, ey); c.stroke();
          for (const s of [-1, 1]) {
            const mx = T.x + Math.cos(ang) * R * .6, my = T.y + Math.sin(ang) * R * .6;
            c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + Math.cos(ang + s * .7) * R * .3, my + Math.sin(ang + s * .7) * R * .3); c.stroke();
          }
        }
      }
      c.globalCompositeOperation = 'source-over';
    } },
    heal: { dur: 1100, draw(t, e) { sparkles(e, t, 'rgba(140,255,120,1)', 'rgba(255,230,120,1)', 'rgba(120,255,120,.8)'); } },
    mana: { dur: 1100, draw(t, e) { sparkles(e, t, 'rgba(120,190,255,1)', 'rgba(200,160,255,1)', 'rgba(110,160,255,.8)'); } },
    shield: { dur: 1000, draw(t) {
      const a = Math.sin(t * Math.PI), s = lerp(1.25, 1, easeOut(t)), R = 34 * s;
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(120,200,255,' + (.3 * a) + ')'; c.lineWidth = 1.5;
      for (let row = -1; row < H / (R * 1.5) + 1; row++) for (let col = -1; col < W / (R * 1.73) + 1; col++) {
        const cx = col * R * 1.732 + (row % 2 ? R * .866 : 0), cy = row * R * 1.5;
        c.beginPath();
        for (let k = 0; k < 6; k++) { const an = Math.PI / 6 + k * Math.PI / 3; c[k ? 'lineTo' : 'moveTo'](cx + Math.cos(an) * R, cy + Math.sin(an) * R); }
        c.closePath(); c.stroke();
      }
      vignette('rgba(100,170,255,.9)', .45 * a);
      c.globalCompositeOperation = 'source-over';
    } },
    rage: { dur: 800, draw(t) { vignette('rgba(220,20,10,.95)', Math.abs(Math.sin(t * Math.PI * 2)) * .8); } },
    speed: { dur: 800, draw(t, e) {
      const a = Math.sin(t * Math.PI);
      c.globalCompositeOperation = 'lighter';
      c.strokeStyle = 'rgba(230,240,255,' + (.7 * a) + ')'; c.lineWidth = 2;
      for (let i = 0; i < 48; i++) {
        const ang = e.r[i] * TAU, d0 = 60 + ((e.r[i + 48] + t * 2) % 1) * 380, d1 = d0 + 40 + 80 * t;
        c.beginPath(); c.moveTo(W / 2 + Math.cos(ang) * d0, H / 2 + Math.sin(ang) * d0); c.lineTo(W / 2 + Math.cos(ang) * d1, H / 2 + Math.sin(ang) * d1); c.stroke();
      }
      c.globalCompositeOperation = 'source-over';
    } },
    levelup: { dur: 1500, draw(t, e) {
      const a = t < .15 ? t / .15 : 1 - clamp01((t - .6) / .4);
      c.globalCompositeOperation = 'lighter';
      c.save(); c.translate(W / 2, H / 2); c.rotate(t * .6);
      for (let i = 0; i < 16; i++) {
        c.rotate(TAU / 16);
        const g = c.createLinearGradient(0, 0, 420, 0);
        g.addColorStop(0, 'rgba(255,220,120,' + (.5 * a) + ')'); g.addColorStop(1, 'rgba(255,200,80,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(420, -22); c.lineTo(420, 22); c.closePath(); c.fill();
      }
      c.restore();
      const v = clamp01(t / .7);
      c.strokeStyle = 'rgba(255,230,140,' + (1 - v) + ')'; c.lineWidth = 6;
      c.beginPath(); c.arc(W / 2, H / 2, 40 + 300 * easeOut(v), 0, TAU); c.stroke();
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = a; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '700 54px Georgia, serif'; c.lineWidth = 6; c.strokeStyle = 'rgba(60,30,0,.9)'; c.fillStyle = '#ffe08a';
      c.strokeText('LEVEL UP', W / 2, H / 2 - 20); c.fillText('LEVEL UP', W / 2, H / 2 - 20);
      if (e.level) { c.font = '700 28px Georgia, serif'; c.strokeText('Level ' + e.level, W / 2, H / 2 + 30); c.fillText('Level ' + e.level, W / 2, H / 2 + 30); }
      c.globalAlpha = 1;
    } },
    fizzle: { dur: 800, draw(t, e) {
      for (let i = 0; i < 7; i++) {
        const u = clamp01((t - i * .05) / .8);
        const x = HAND.x - 40 + (e.r[i] - .5) * 80 + u * (e.r[i + 7] - .5) * 60, y = HAND.y - 40 - u * 160;
        orb(x, y, 26 + 50 * u, 'rgba(200,200,200,.85)', 'rgba(140,140,140,.6)', 'rgba(90,90,90,0)', (1 - u));
      }
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const u = clamp01((t - e.r[i + 14] * .3) / .3);
        if (u <= 0 || u >= 1) continue;
        orb(HAND.x - 40 + (e.r[i + 20] - .5) * 120, HAND.y - 60 - u * 80 * e.r[i + 25], 6, '#fff6c0', 'rgba(255,160,40,.9)', 'rgba(255,60,0,0)', 1 - u);
      }
      c.globalCompositeOperation = 'source-over';
    } },
    death: { dur: 900, draw(t, e) {
      if (!ghost) return;
      ghost.alpha = 1 - easeIn(t);
      ghost.rise = 30 * t; ghost.shrink = .12 * t;
      const b = ghost.box;
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 30; i++) {
        const x = b.x + e.r[i] * b.w, y = b.y + b.h * (.2 + .8 * e.r[i + 30]) - t * (60 + 140 * e.r[i + 60]);
        orb(x, y, 4 + 6 * e.r[i + 30], '#ffffff', 'rgba(255,200,160,.7)', 'rgba(200,60,40,0)', (1 - t) * (.4 + .6 * e.r[i]));
      }
      c.globalCompositeOperation = 'source-over';
    } }
  };

  function drawGhost() {
    if (!ghost || ghost.alpha <= 0) return;
    const b = ghost.box, s = 1 - (ghost.shrink || 0), w = b.w * s, h = b.h * s;
    c.globalAlpha = ghost.alpha;
    c.drawImage(b.cv, b.x + (b.w - w) / 2, b.y + (b.h - h) - (ghost.rise || 0), w, h);
    c.globalAlpha = 1;
  }
  function targetOf(box) {
    return box ? { x: box.x + box.w / 2, y: box.y + box.h * .45, s: Math.min(1.2, box.h / 300), r: Math.max(40, Math.min(box.w, box.h) * .38) }
               : { x: W / 2, y: H / 2 - 4, s: .3, r: 34 };   // no monster: into the distance
  }

  function stop() {
    cancelAnimationFrame(raf); raf = 0;
    queue = []; cur = null; ghost = null;
    if (c) c.clearRect(0, 0, W, H);
    shake(0);
  }
  function next(now) {
    cur = queue.shift() || null;
    if (!cur) { stop(); return; }
    const def = EFFECTS[cur.kind];
    if (!def) { next(now); return; }
    cur.def = def; cur.t0 = now; cur.r = rnd(120);
    if (def.init) def.init(cur);
  }
  function frame(now) {
    if (!cur) { next(now); if (!cur) return; }
    let t = (now - cur.t0) / cur.def.dur;
    if (t >= 1) { next(now); if (!cur) return; t = 0; }
    c.clearRect(0, 0, W, H);
    drawGhost();
    cur.def.draw(Math.min(1, t), cur);
    raf = requestAnimationFrame(frame);
  }

  return {
    init(canvas, shakeTargets) { cv = canvas; c = cv.getContext('2d'); shakeEls = shakeTargets; },
    // list: [{kind, ...options}], played one after another
    play(list, monBox) {
      stop();
      if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      queue = list.slice();
      const d = queue.find(q => q.kind === 'death' && q.box);
      ghost = d ? { box: d.box, alpha: 1 } : null;
      T = targetOf(monBox || (d && d.box));
      raf = requestAnimationFrame(frame);
    },
    stop,
    busy() { return !!cur; }
  };
})();
