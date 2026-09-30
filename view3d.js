/* Modern first-person view for HP-28S 3D Adventure.
   A grid raycaster: textured stone walls and doors, flagstone floors, pits and ceiling holes,
   items lying on the floor, and the monster you are fighting, lit by your torch.
   Uses the game's globals (G, FS, sget, MLST) and only reads game state. */
'use strict';

const V3 = (() => {
  const VW = 640, VH = 480, CY = VH / 2;
  const HALF = 0.83;                 // tan of half the horizontal field of view
  const FOC = (VW / 2) / HALF;       // focal length in pixels
  const EYE = 0.5;                   // eye height (walls are 1 high)
  const T0 = 0.5;                    // camera stands this far behind the current square's back edge
  const MAXD = 7.5;                  // nothing is drawn beyond this distance
  const TS = 128;                    // texture size
  const DIRV = [[0, 1], [0, -1], [1, 0], [-1, 0]];     // N S E W  (map y grows northwards)
  const RIGHTV = [[1, 0], [-1, 0], [0, -1], [0, 1]];

  /* ---------- small helpers ---------- */
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rng(seed) {
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
  const pack = (r, g, b) => (0xFF000000 | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r)) >>> 0;
  // Tileable value noise over a TS x TS texture
  function noise(r, cells) {
    const g = new Float32Array(cells * cells).map(() => r());
    const s = TS / cells;
    return (x, y) => {
      const fx = x / s, fy = y / s, x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const ux = tx * tx * (3 - 2 * tx), uy = ty * ty * (3 - 2 * ty);
      const at = (i, j) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
      return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    };
  }

  /* ---------- textures, one set per dungeon level ---------- */
  const PALETTES = [
    { wall: [132, 128, 120], mortar: [52, 50, 47], floor: [108, 100, 90], ceil: [72, 68, 64], moss: [70, 96, 48] },
    { wall: [156, 122, 86], mortar: [64, 50, 36], floor: [116, 95, 72], ceil: [78, 64, 50], moss: null },
    { wall: [126, 80, 72], mortar: [46, 30, 28], floor: [92, 70, 64], ceil: [58, 42, 42], moss: [96, 60, 110] }
  ];
  const texCache = [];
  function textures(level) {
    const i = Math.max(0, Math.min(PALETTES.length - 1, level - 1));
    if (texCache[i]) return texCache[i];
    const P = PALETTES[i], r = rng(1234 + i * 77);
    const fine = noise(r, 32), mid = noise(r, 8), coarse = noise(r, 4);

    // Stone blocks: 4 courses of 2 blocks, alternate courses offset by half a block
    const wall = new Uint32Array(TS * TS);
    const tones = Array.from({ length: 16 }, () => 0.78 + r() * 0.4);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const row = y >> 5, bx = (x + (row & 1) * 32) & (TS - 1), col = bx >> 6;
      const yy = y & 31, xx = bx & 63;
      const n = fine(x, y) * 0.55 + mid(x, y) * 0.45;
      let c;
      if (yy < 3 || xx < 3) {
        const k = 0.75 + 0.5 * n;
        c = P.mortar.map(v => v * k);
      } else {
        let k = tones[row * 2 + col] * (0.72 + 0.5 * n);
        if (yy < 6) k *= 1.14; else if (yy > 28) k *= 0.78;
        if (xx < 6) k *= 1.08; else if (xx > 59) k *= 0.84;
        c = P.wall.map(v => v * k);
        if (fine(x * 3, y * 3) > 0.93) c = c.map(v => v * 0.7);              // pits in the stone
        if (P.moss && y > 70) {
          const m = coarse(x, y) * mid(x + 40, y);
          if (m > 0.42) { const a = Math.min(1, (m - 0.42) * 5) * (y - 70) / 58; c = c.map((v, j) => v * (1 - a) + P.moss[j] * a * (0.7 + n * 0.5)); }
        }
      }
      wall[y * TS + x] = pack(c[0], c[1], c[2]);
    }

    // Wooden door with iron bands, set into the stone
    const door = wall.slice();
    const plank = [112, 72, 40];
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const dx = (x - 64) / 42;
      if (Math.abs(dx) > 1) continue;
      const top = 16 + 22 * (1 - Math.sqrt(1 - dx * dx));
      if (y < top - 5) continue;
      let c;
      if (y < top || Math.abs(dx) > 0.9) {                                  // stone frame
        c = P.mortar.map(v => v * 1.5 * (0.8 + fine(x, y) * 0.4));
      } else {
        const px = (x - 26) % 15;
        const grain = 0.8 + 0.25 * Math.sin(y * 0.35 + fine(x * 2, 0) * 6) + fine(x, y * 4) * 0.2;
        c = plank.map(v => v * grain);
        if (px === 0 || px === 14) c = c.map(v => v * 0.45);                // plank gaps
        const band = (y > 44 && y < 52) || (y > 100 && y < 108);
        if (band) {
          c = [58, 58, 62].map(v => v * (0.85 + fine(x, y) * 0.3));
          if ((x % 12) === 6 && (y === 48 || y === 104)) c = [150, 150, 158];
        }
        const hx = x - 92, hy = y - 76, hd = Math.sqrt(hx * hx + hy * hy);
        if (hd > 4 && hd < 7) c = [170, 150, 90];                            // ring handle
      }
      door[y * TS + x] = pack(c[0], c[1], c[2]);
    }

    // Flagstones: 2 x 2 per square
    const floor = new Uint32Array(TS * TS);
    const ftones = Array.from({ length: 4 }, () => 0.8 + r() * 0.35);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const xx = x & 63, yy = y & 63;
      const n = fine(x, y) * 0.5 + mid(x, y) * 0.5;
      let c;
      if (xx < 3 || yy < 3) c = P.mortar.map(v => v * (0.7 + n * 0.4));
      else {
        let k = ftones[(y >> 6) * 2 + (x >> 6)] * (0.72 + 0.5 * n);
        if (xx < 6 || yy < 6) k *= 1.1; else if (xx > 60 || yy > 60) k *= 0.85;
        if (fine(x * 4, y * 4) > 0.9) k *= 0.75;
        c = P.floor.map(v => v * k);
      }
      floor[y * TS + x] = pack(c[0], c[1], c[2]);
    }

    // Ceiling: one rough slab per square
    const ceil = new Uint32Array(TS * TS);
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const n = fine(x, y) * 0.4 + coarse(x, y) * 0.6;
      let c;
      if (x < 5 || y < 5) c = P.mortar.map(v => v * 0.8);
      else c = P.ceil.map(v => v * (0.7 + 0.55 * n));
      ceil[y * TS + x] = pack(c[0], c[1], c[2]);
    }
    return (texCache[i] = { wall, door, floor, ceil });
  }

  /* ---------- vector sprites (drawn once with the 2D canvas API) ---------- */
  function rgbOf(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function tint(c, f) { const [r, g, b] = rgbOf(c); return 'rgb(' + clamp(r * f) + ',' + clamp(g * f) + ',' + clamp(b * f) + ')'; }
  function ball(x, cx, cy, rx, ry, col) {
    const g = x.createRadialGradient(cx - rx * .3, cy - ry * .35, 1, cx, cy, Math.max(rx, ry) * 1.05);
    g.addColorStop(0, tint(col, 1.35)); g.addColorStop(.55, col); g.addColorStop(1, tint(col, .45));
    x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill();
  }
  function limb(x, x1, y1, x2, y2, w, col) {
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2);
    x.strokeStyle = tint(col, .4); x.lineWidth = w + 4; x.stroke();
    x.strokeStyle = col; x.lineWidth = w; x.stroke();
    x.beginPath(); x.moveTo(x1 - w * .18, y1); x.lineTo(x2 - w * .18, y2);
    x.strokeStyle = tint(col, 1.3); x.lineWidth = w * .25; x.stroke();
  }
  function eyes(x, cx, cy, dx, r, col) {
    x.save(); x.shadowColor = col; x.shadowBlur = r * 4; x.fillStyle = col;
    for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * dx, cy, r * 1.2, r, 0, 0, Math.PI * 2); x.fill(); }
    x.shadowBlur = 0; x.fillStyle = 'rgba(255,255,255,.85)';
    for (const s of [-1, 1]) { x.beginPath(); x.arc(cx + s * dx, cy, r * .4, 0, Math.PI * 2); x.fill(); }
    x.restore();
  }
  function poly(x, pts, fill, stroke) {
    x.beginPath(); x.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.closePath(); x.fillStyle = fill; x.fill();
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = 2; x.stroke(); }
  }
  function spr(w, h, fn) { const c = mk(w, h); fn(c.getContext('2d'), w, h); return c; }

  // A generic creature on two legs; o sets colours, build and extras
  function humanoid(o) {
    return spr(256, 320, x => {
      const W = o.w || 1, cx = 128, hip = o.hip || 200, sh = o.sh || 110, hy = o.hy || 64, hr = o.hr || 34;
      const skin = o.skin, sleeve = o.sleeve || skin;
      const hx = (o.handX || 66) * W, hyy = o.handY || 206;
      const P = { cx, hy, hr, W, sh, hip, hx, hyy };
      if (o.pre) o.pre(x, P);
      if (!o.noLegs) {
        limb(x, cx - 20 * W, hip, cx - 24 * W, 296, 28 * W, o.pants);
        limb(x, cx + 20 * W, hip, cx + 24 * W, 296, 28 * W, o.pants);
        ball(x, cx - 28 * W, 304, 20 * W, 10, o.boots || '#2e241c');
        ball(x, cx + 28 * W, 304, 20 * W, 10, o.boots || '#2e241c');
      }
      const g = x.createLinearGradient(cx - 60 * W, 0, cx + 60 * W, 0);
      g.addColorStop(0, tint(o.cloth, .5)); g.addColorStop(.42, tint(o.cloth, 1.2)); g.addColorStop(1, tint(o.cloth, .45));
      x.fillStyle = g; x.beginPath();
      x.moveTo(cx - 48 * W, sh); x.lineTo(cx + 48 * W, sh);
      x.quadraticCurveTo(cx + 62 * W, sh + 40, cx + 42 * W, hip + 12);
      x.lineTo(cx - 42 * W, hip + 12);
      x.quadraticCurveTo(cx - 62 * W, sh + 40, cx - 48 * W, sh); x.fill();
      if (o.belly) ball(x, cx, hip - 34, 50 * W, 44, o.belly);
      if (o.belt) { x.fillStyle = o.belt; x.fillRect(cx - 44 * W, hip - 4, 88 * W, 12); x.fillStyle = '#c9a24a'; x.fillRect(cx - 8, hip - 4, 16, 12); }
      if (o.mid) o.mid(x, P);
      limb(x, cx - 46 * W, sh + 14, cx - hx, hyy, 22 * W, sleeve);
      limb(x, cx + 46 * W, sh + 14, cx + hx, hyy, 22 * W, sleeve);
      ball(x, cx - hx, hyy + 6, 13 * W, 13 * W, skin);
      ball(x, cx + hx, hyy + 6, 13 * W, 13 * W, skin);
      limb(x, cx, sh - 4, cx, hy + hr * .6, hr * .75, skin);
      if (o.ears) for (const s of [-1, 1]) poly(x, [cx + s * hr * .8, hy - 8, cx + s * hr * 1.7, hy - 26, cx + s * hr * .85, hy + 10], tint(skin, .85));
      ball(x, cx, hy, hr * (o.hw || 1), hr * 1.1, skin);
      if (o.eye) eyes(x, cx, hy + 2, hr * .38, hr * .13, o.eye);
      if (o.post) o.post(x, P);
    });
  }
  const club = (x, P, len = 120) => {
    const X = P.cx + P.hx, Y = P.hyy + 6;
    limb(x, X, Y + 10, X + 22, Y - len, 16, '#6b4a2a');
    ball(x, X + 24, Y - len - 6, 22, 30, '#5b3d22');
  };
  const teeth = (x, cx, y, w, n) => {
    x.fillStyle = '#1a0d0a'; x.fillRect(cx - w / 2, y, w, 8);
    x.fillStyle = '#f2ead0';
    for (let i = 0; i < n; i++) { const tx = cx - w / 2 + (i + .5) * w / n; poly(x, [tx - 3, y, tx + 3, y, tx, y + 7], '#f2ead0'); }
  };
  function blob(col, opts = {}) {
    return spr(256, 200, (x) => {
      x.save();
      if (opts.alpha) x.globalAlpha = opts.alpha;
      const g = x.createRadialGradient(110, 70, 10, 128, 130, 130);
      g.addColorStop(0, tint(col, 1.5)); g.addColorStop(.5, col); g.addColorStop(1, tint(col, .35));
      x.fillStyle = g; x.beginPath();
      x.moveTo(12, 196);
      x.bezierCurveTo(0, 120, 60, 30, 128, 26);
      x.bezierCurveTo(200, 30, 256, 120, 244, 196);
      x.closePath(); x.fill();
      x.restore();
      if (opts.drips) for (const [dx, h] of [[60, 18], [150, 26], [200, 14]]) ball(x, dx, 190 + h / 3, 10, h / 2, col);
      if (opts.bubbles) { const r = rng(9); for (let i = 0; i < 12; i++) { x.strokeStyle = 'rgba(255,255,220,.45)'; x.lineWidth = 2; x.beginPath(); x.arc(40 + r() * 176, 70 + r() * 110, 4 + r() * 10, 0, 7); x.stroke(); } }
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(96, 64, 26, 12, -.5, 0, 7); x.fill();
      if (opts.eye) eyes(x, 128, 100, 30, 9, opts.eye);
      if (opts.mouth) { x.fillStyle = 'rgba(20,10,10,.7)'; x.beginPath(); x.ellipse(128, 140, 34, 12, 0, 0, Math.PI); x.fill(); }
    });
  }

  const MON = {
    Imp: { size: .5, c: () => humanoid({
      skin: '#b23a2a', cloth: '#4a1a14', pants: '#4a1a14', w: .8, hr: 40, hy: 66, eye: '#ffd23a', ears: true,
      pre: (x, P) => { x.strokeStyle = '#8a2a1e'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(P.cx + 20, P.hip); x.bezierCurveTo(P.cx + 120, P.hip + 60, P.cx + 110, 120, P.cx + 96, 150); x.stroke(); poly(x, [P.cx + 84, 150, P.cx + 108, 150, P.cx + 96, 128], '#8a2a1e'); },
      post: (x, P) => { for (const s of [-1, 1]) poly(x, [P.cx + s * 14, P.hy - 36, P.cx + s * 30, P.hy - 30, P.cx + s * 34, P.hy - 70], '#2a1a14'); teeth(x, P.cx, P.hy + 18, 34, 5); } }) },
    Orc: { size: .8, c: () => humanoid({
      skin: '#5f7f3a', cloth: '#6b4a2a', pants: '#3b2f22', w: 1.1, eye: '#ff5a2a', ears: true, belt: '#2a1e14',
      post: (x, P) => {
        x.fillStyle = '#2d3a1a'; x.fillRect(P.cx - 28, P.hy - 16, 56, 6);
        teeth(x, P.cx, P.hy + 20, 30, 4);
        for (const s of [-1, 1]) poly(x, [P.cx + s * 14, P.hy + 26, P.cx + s * 20, P.hy + 26, P.cx + s * 18, P.hy + 8], '#f2ead0');
        const X = P.cx + P.hx, Y = P.hyy + 6;
        limb(x, X, Y + 20, X + 8, Y - 120, 10, '#5b3d22');
        poly(x, [X + 6, Y - 118, X + 50, Y - 140, X + 56, Y - 96, X + 8, Y - 96], '#9aa0a8', '#50545a');
      } }) },
    Gnome: { size: .5, c: () => humanoid({
      skin: '#e8b890', cloth: '#3a5fa8', pants: '#6b4a2a', w: .85, hr: 32, hy: 92, sh: 132, eye: '#3a2a1a', belt: '#3a2614',
      post: (x, P) => {
        poly(x, [P.cx - 44, P.hy - 18, P.cx + 44, P.hy - 18, P.cx + 10, P.hy - 110], '#b8322a', '#6a1a14');
        x.fillStyle = '#f0ece4'; x.beginPath(); x.moveTo(P.cx - 30, P.hy + 6); x.quadraticCurveTo(P.cx, P.hy + 110, P.cx + 30, P.hy + 6); x.quadraticCurveTo(P.cx, P.hy + 22, P.cx - 30, P.hy + 6); x.fill();
        ball(x, P.cx, P.hy + 8, 9, 8, '#e09a7a');
      } }) },
    Rat: { size: .3, c: () => spr(320, 200, x => {
      x.strokeStyle = '#c89a8a'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(240, 160); x.bezierCurveTo(300, 170, 310, 110, 280, 80); x.stroke();
      ball(x, 176, 136, 86, 56, '#6a5a50');
      ball(x, 88, 124, 50, 40, '#72625a');
      poly(x, [40, 120, 64, 100, 64, 144], '#72625a');
      ball(x, 38, 124, 8, 7, '#e0a0a0');
      ball(x, 104, 84, 18, 22, '#8a7068'); ball(x, 104, 86, 11, 14, '#d09a90');
      eyes(x, 70, 112, 0, 6, '#ff3a2a');
      x.strokeStyle = 'rgba(230,220,210,.7)'; x.lineWidth = 1.5;
      for (const d of [-8, 0, 8]) { x.beginPath(); x.moveTo(44, 126); x.lineTo(8, 126 + d * 1.6); x.stroke(); }
      for (const fx of [110, 150, 210, 240]) ball(x, fx, 186, 14, 8, '#c89a8a');
    }) },
    Ghoul: { size: .75, c: () => humanoid({
      skin: '#9aa88a', cloth: '#4a4a44', pants: '#3a3a36', w: .95, hy: 92, sh: 124, hr: 32, handY: 150, handX: 74, eye: '#b4ff5a',
      post: (x, P) => {
        x.fillStyle = '#140c0c'; x.beginPath(); x.ellipse(P.cx, P.hy + 20, 12, 9, 0, 0, 7); x.fill();
        x.strokeStyle = '#f0f0e0'; x.lineWidth = 3;
        for (const s of [-1, 1]) for (const d of [-8, 0, 8]) { const X = P.cx + s * P.hx; x.beginPath(); x.moveTo(X + d, P.hyy + 14); x.lineTo(X + d * 1.4, P.hyy + 30); x.stroke(); }
        x.fillStyle = '#3a3a36'; for (let i = 0; i < 6; i++) poly(x, [P.cx - 42 + i * 14, P.hip + 10, P.cx - 28 + i * 14, P.hip + 10, P.cx - 35 + i * 14, P.hip + 30], '#3a3a36');
      } }) },
    Slime: { size: .42, c: () => blob('#4ab84a', { alpha: .85, eye: '#f4ff9a', mouth: true, drips: true }) },
    Pixie: { size: .38, float: .28, c: () => spr(256, 320, x => {
      x.save(); x.globalAlpha = .55;
      for (const [s, a, ry] of [[-1, -.5, 70], [1, .5, 70], [-1, .5, 44], [1, -.5, 44]]) {
        const g = x.createRadialGradient(128 + s * 60, 130, 5, 128 + s * 60, 130, 80);
        g.addColorStop(0, '#e6fbff'); g.addColorStop(1, '#6fd6ff');
        x.fillStyle = g; x.beginPath(); x.ellipse(128 + s * 62, ry === 70 ? 110 : 170, 64, 30, a, 0, 7); x.fill();
      }
      x.restore();
      const glow = x.createRadialGradient(128, 160, 10, 128, 160, 130); glow.addColorStop(0, 'rgba(255,230,255,.5)'); glow.addColorStop(1, 'rgba(255,230,255,0)');
      x.fillStyle = glow; x.fillRect(0, 0, 256, 320);
      poly(x, [98, 250, 158, 250, 142, 150, 114, 150], '#ff7ab8', '#a0306a');
      limb(x, 118, 250, 114, 300, 10, '#ffd9c8'); limb(x, 138, 250, 142, 300, 10, '#ffd9c8');
      limb(x, 116, 160, 84, 200, 9, '#ffd9c8'); limb(x, 140, 160, 172, 120, 9, '#ffd9c8');
      ball(x, 128, 118, 30, 32, '#ffd9c8');
      x.fillStyle = '#ffcf3a'; x.beginPath(); x.ellipse(128, 96, 36, 22, 0, Math.PI, 0); x.fill();
      eyes(x, 128, 120, 11, 4, '#5a2a8a');
      x.fillStyle = '#fff6a0'; const r = rng(3); for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(20 + r() * 216, 20 + r() * 280, 1.5 + r() * 2.5, 0, 7); x.fill(); }
    }) },
    Ogre: { size: .95, c: () => humanoid({
      skin: '#a88a5a', cloth: '#5a4630', pants: '#a88a5a', w: 1.35, hr: 30, hy: 72, sh: 108, eye: '#ffcc33', belly: '#b89a68',
      mid: (x, P) => poly(x, [P.cx - 50 * P.W, P.hip, P.cx + 50 * P.W, P.hip, P.cx + 40 * P.W, P.hip + 46, P.cx - 40 * P.W, P.hip + 46], '#5a4630'),
      post: (x, P) => { teeth(x, P.cx, P.hy + 16, 30, 4); x.fillStyle = '#4a3a22'; x.fillRect(P.cx - 26, P.hy - 14, 52, 6); club(x, P, 140); } }) },
    Shade: { size: .85, c: () => spr(256, 320, x => {
      const g = x.createLinearGradient(0, 30, 0, 320); g.addColorStop(0, 'rgba(46,32,70,.95)'); g.addColorStop(.7, 'rgba(34,24,54,.8)'); g.addColorStop(1, 'rgba(34,24,54,0)');
      x.fillStyle = g; x.beginPath(); x.moveTo(128, 16);
      x.bezierCurveTo(210, 20, 220, 160, 236, 300);
      for (let i = 0; i < 6; i++) x.quadraticCurveTo(220 - i * 38, 270 + (i % 2) * 50, 200 - i * 38, 300);
      x.bezierCurveTo(30, 160, 46, 20, 128, 16); x.fill();
      limb(x, 70, 120, 30, 190, 20, '#2e2046'); limb(x, 186, 120, 226, 190, 20, '#2e2046');
      x.fillStyle = '#07040c'; x.beginPath(); x.ellipse(128, 84, 38, 46, 0, 0, 7); x.fill();
      eyes(x, 128, 80, 14, 6, '#c77dff');
    }) },
    Snake: { size: .55, c: () => spr(256, 300, x => {
      for (const [cy, rx] of [[272, 104], [246, 86], [224, 66]]) {
        ball(x, 128, cy, rx, 24, '#4a7a2a');
        x.strokeStyle = 'rgba(230,200,80,.5)'; x.lineWidth = 3; x.beginPath(); x.ellipse(128, cy, rx * .8, 14, 0, 0, Math.PI); x.stroke();
      }
      x.lineCap = 'round'; x.strokeStyle = '#3a6a22'; x.lineWidth = 36; x.beginPath(); x.moveTo(128, 214); x.bezierCurveTo(190, 170, 70, 120, 128, 80); x.stroke();
      x.strokeStyle = '#d8c070'; x.lineWidth = 14; x.beginPath(); x.moveTo(128, 210); x.bezierCurveTo(186, 168, 74, 122, 128, 84); x.stroke();
      ball(x, 128, 64, 36, 26, '#4a7a2a');
      eyes(x, 128, 56, 18, 5, '#ffe23a');
      x.strokeStyle = '#d02a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(128, 88); x.lineTo(128, 110); x.lineTo(120, 118); x.moveTo(128, 110); x.lineTo(136, 118); x.stroke();
    }) },
    Ooze: { size: .45, c: () => blob('#a8702a', { eye: '#ff9a3a', drips: true, bubbles: true }) },
    Mold: { size: .35, c: () => spr(256, 180, x => {
      const r = rng(21);
      for (let i = 0; i < 26; i++) {
        const cx = 30 + r() * 196, cy = 60 + r() * 110 + (Math.abs(cx - 128) / 128) * 30;
        ball(x, cx, cy, 18 + r() * 22, 16 + r() * 18, i % 3 ? '#9ab83a' : '#c8c84a');
      }
      x.fillStyle = 'rgba(80,60,20,.6)';
      for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(30 + r() * 196, 60 + r() * 110, 2 + r() * 4, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(240,255,200,.5)';
      for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(20 + r() * 216, 30 + r() * 60, 1.5, 0, 7); x.fill(); }
    }) },
    Troll: { size: .98, c: (i) => humanoid({
      skin: i === 13 ? '#5a6f8a' : '#6f8a6a', cloth: '#4a3a2a', pants: i === 13 ? '#5a6f8a' : '#6f8a6a', w: 1.2, hr: 32, hy: 80, sh: 118,
      handY: 262, handX: 82, eye: '#ffea5a',
      mid: (x, P) => poly(x, [P.cx - 46 * P.W, P.hip, P.cx + 46 * P.W, P.hip, P.cx + 36 * P.W, P.hip + 40, P.cx - 36 * P.W, P.hip + 40], '#4a3a2a'),
      post: (x, P) => {
        ball(x, P.cx, P.hy + 14, 14, 16, i === 13 ? '#4a5f7a' : '#5f7a5a');
        for (let k = -3; k <= 3; k++) poly(x, [P.cx + k * 9 - 6, P.hy - 30, P.cx + k * 9 + 6, P.hy - 30, P.cx + k * 12, P.hy - 58], '#2a3a24');
        for (const s of [-1, 1]) poly(x, [P.cx + s * 12, P.hy + 34, P.cx + s * 18, P.hy + 34, P.cx + s * 16, P.hy + 16], '#f2ead0');
      } }) },
    Giant: { size: 1.08, c: () => humanoid({
      skin: '#d8a880', cloth: '#7a5a3a', pants: '#4a3a2a', w: 1.2, hr: 32, hy: 66, eye: '#6a3a1a', belt: '#3a2614',
      post: (x, P) => {
        x.fillStyle = '#6a4424'; x.beginPath(); x.moveTo(P.cx - 32, P.hy + 2); x.quadraticCurveTo(P.cx, P.hy + 100, P.cx + 32, P.hy + 2); x.quadraticCurveTo(P.cx, P.hy + 30, P.cx - 32, P.hy + 2); x.fill();
        x.fillStyle = '#6a4424'; x.beginPath(); x.ellipse(P.cx, P.hy - 28, 36, 14, 0, Math.PI, 0); x.fill();
        club(x, P, 150);
      } }) },
    Guard: { size: .82, c: () => humanoid({
      skin: '#e0b090', cloth: '#9aa4b0', pants: '#3a3a50', sleeve: '#7a8490', w: 1, eye: '#2a1a10', belt: '#3a2614',
      pre: (x, P) => { const X = P.cx + P.hx; limb(x, X, 300, X, 20, 7, '#6b4a2a'); poly(x, [X - 10, 26, X + 10, 26, X, -4], '#c8ced6', '#6a7078'); },
      post: (x, P) => {
        x.fillStyle = '#aab4c0'; x.beginPath(); x.ellipse(P.cx, P.hy - 6, P.hr + 4, P.hr + 2, 0, Math.PI, 0); x.fill();
        x.fillRect(P.cx - 3, P.hy - 6, 6, 22);
        x.fillStyle = '#c8322a'; x.beginPath(); x.ellipse(P.cx, P.hy - P.hr - 14, 8, 20, 0, 0, 7); x.fill();
        const SX = P.cx - P.hx, SY = P.hyy - 36;
        ball(x, SX, SY, 44, 48, '#a02a24');
        x.strokeStyle = '#d8b04a'; x.lineWidth = 5; x.beginPath(); x.ellipse(SX, SY, 42, 46, 0, 0, 7); x.stroke();
        x.fillStyle = '#d8b04a'; x.fillRect(SX - 4, SY - 30, 8, 60); x.fillRect(SX - 24, SY - 6, 48, 8);
      } }) },
    Magi: { size: .85, c: () => humanoid({
      skin: '#e8c0a0', cloth: '#4a2a8a', pants: '#4a2a8a', w: 1, noLegs: true, eye: '#ffffff',
      pre: (x, P) => {
        const g = x.createLinearGradient(40, 0, 216, 0); g.addColorStop(0, '#2a164e'); g.addColorStop(.45, '#5a36a0'); g.addColorStop(1, '#241240');
        poly(x, [P.cx - 50, P.sh, P.cx + 50, P.sh, P.cx + 82, 312, P.cx - 82, 312], g);
        x.fillStyle = '#e8c850'; const r = rng(5);
        for (let i = 0; i < 16; i++) { x.beginPath(); x.arc(P.cx - 60 + r() * 120, 150 + r() * 150, 2.5, 0, 7); x.fill(); }
        const X = P.cx + P.hx;
        limb(x, X, 310, X + 6, 40, 8, '#5b3d22');
        x.save(); x.shadowColor = '#7fe0ff'; x.shadowBlur = 30; ball(x, X + 6, 30, 16, 16, '#7fe0ff'); x.restore();
      },
      post: (x, P) => {
        x.fillStyle = '#f4f0ea'; x.beginPath(); x.moveTo(P.cx - 30, P.hy + 6); x.quadraticCurveTo(P.cx, P.hy + 140, P.cx + 30, P.hy + 6); x.quadraticCurveTo(P.cx, P.hy + 26, P.cx - 30, P.hy + 6); x.fill();
        x.fillStyle = '#3a1e70'; x.beginPath(); x.ellipse(P.cx, P.hy - 22, 62, 12, 0, 0, 7); x.fill();
        poly(x, [P.cx - 36, P.hy - 24, P.cx + 36, P.hy - 24, P.cx + 30, P.hy - 120], '#4a2a8a', '#2a164e');
        x.fillStyle = '#e8c850'; x.beginPath(); x.arc(P.cx + 4, P.hy - 60, 5, 0, 7); x.fill();
      } }) }
  };
  const monCache = {};
  function monSprite(i) {
    if (monCache[i]) return monCache[i];
    const name = MLST[i].name;
    const def = MON[name] || MON.Orc;
    return (monCache[i] = { size: def.size, float: def.float || 0, cv: def.c(i) });
  }

  // Item icons (by item type 1..8) as they lie on the floor
  function icon(fn) { const c = spr(64, 64, fn); const d = c.getContext('2d').getImageData(0, 0, 64, 64); return new Uint32Array(d.data.buffer); }
  let ITEMS = null, ROPE = null;
  function makeIcons() {
    ITEMS = [
      icon(x => { limb(x, 14, 56, 48, 14, 6, '#6b4a2a'); x.save(); x.shadowColor = '#9af'; x.shadowBlur = 10; ball(x, 50, 12, 6, 6, '#cfe0ff'); x.restore(); }),
      icon(x => { x.strokeStyle = '#e0b83a'; x.lineWidth = 7; x.beginPath(); x.ellipse(32, 46, 17, 11, 0, 0, 7); x.stroke(); ball(x, 32, 34, 7, 6, '#e0304a'); }),
      icon(x => { ball(x, 32, 46, 16, 15, '#c02a3a'); x.fillStyle = 'rgba(210,230,240,.5)'; x.fillRect(27, 14, 10, 20); x.fillStyle = '#8a5a2a'; x.fillRect(26, 8, 12, 8); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.ellipse(26, 40, 4, 6, 0, 0, 7); x.fill(); }),
      icon(x => { x.fillStyle = '#e8dcb0'; x.fillRect(12, 26, 40, 30); ball(x, 12, 41, 6, 16, '#d8c898'); ball(x, 52, 41, 6, 16, '#d8c898'); x.strokeStyle = '#8a6a3a'; x.lineWidth = 1.5; for (const y of [34, 40, 46]) { x.beginPath(); x.moveTo(20, y); x.lineTo(44, y); x.stroke(); } x.fillStyle = '#b02a2a'; x.beginPath(); x.arc(32, 52, 4, 0, 7); x.fill(); }),
      icon(x => { limb(x, 12, 58, 50, 10, 5, '#c8ced6'); limb(x, 12, 58, 20, 48, 6, '#6b4a2a'); limb(x, 8, 46, 26, 60, 4, '#c9a24a'); }),
      icon(x => { poly(x, [14, 22, 26, 16, 38, 16, 50, 22, 46, 58, 18, 58], '#8a94a0', '#4a5058'); x.strokeStyle = '#4a5058'; x.lineWidth = 2; x.beginPath(); x.moveTo(32, 20); x.lineTo(32, 56); x.stroke(); }),
      icon(x => { ball(x, 32, 44, 24, 14, '#c88a3a'); x.strokeStyle = '#8a5a22'; x.lineWidth = 2; for (const dx of [-10, 0, 10]) { x.beginPath(); x.moveTo(32 + dx - 4, 36); x.lineTo(32 + dx + 4, 42); x.stroke(); } }),
      icon(x => { x.save(); x.shadowColor = '#7ff'; x.shadowBlur = 12; poly(x, [32, 58, 12, 34, 20, 24, 44, 24, 52, 34], '#5fe0e0', '#1a8a8a'); x.restore(); poly(x, [20, 24, 32, 34, 44, 24], '#b0ffff'); })
    ];
    const rope = spr(8, 128, x => {
      x.fillStyle = '#8a6a3a'; x.fillRect(1, 0, 6, 128);
      x.fillStyle = '#5a4020'; for (let y = 0; y < 128; y += 6) { x.save(); x.translate(4, y); x.rotate(.6); x.fillRect(-4, -1, 8, 2); x.restore(); }
    });
    ROPE = new Uint32Array(rope.getContext('2d').getImageData(0, 0, 8, 128).data.buffer);
  }

  /* ---------- the renderer ---------- */
  let canvas, vctx, off, octx, prev, pctx, img, buf, animId = 0;
  const zbuf = new Float32Array(VW), wTop = new Int16Array(VW), wBot = new Int16Array(VW);
  const GR = 12, GN = GR * 2 + 1, grid = new Int32Array(GN * GN);
  let gx0 = 0, gy0 = 0;
  function cell(mx, my) {
    const i = mx - gx0, j = my - gy0;
    return (i < 0 || j < 0 || i >= GN || j >= GN) ? -1 : grid[j * GN + i];
  }
  function buildGrid() {
    gx0 = G.XLOC - GR; gy0 = G.YLOC - GR;
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      const v = G.LVLS[G.DPTH - 1].get((gx0 + i) + ',' + (gy0 + j));
      grid[j * GN + i] = v === undefined ? -1 : Number(v & 0xFFFFn) | (Number((v >> 24n) & 15n) << 16);
    }
    if (grid[GR * GN + GR] < 0) grid[GR * GN + GR] = 0xF;    // off the map: the original drew all walls
  }
  function light(z) {
    if (FS(4)) return Math.min(1, 1.3 * Math.exp(-0.33 * (z - 0.3))) * Math.min(1, Math.max(0, (MAXD - z) / 2));
    // Light out: like the HP-28, you still see your own square (up to its far wall), nothing beyond
    return z <= 1.52 ? 0.85 : Math.max(0, 0.85 - (z - 1.52) * 4);
  }
  function sh(c, b) {
    const r = (c & 255) * b * 1.06, g = ((c >>> 8) & 255) * b * .94, bl = ((c >>> 16) & 255) * b * .8;
    return 0xFF000000 | ((bl > 255 ? 255 : bl) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
  }

  function init(cv) {
    canvas = cv; vctx = cv.getContext('2d');
    off = mk(VW, VH); octx = off.getContext('2d');
    prev = mk(VW, VH); pctx = prev.getContext('2d');
    img = octx.createImageData(VW, VH); buf = new Uint32Array(img.data.buffer);
    makeIcons();
  }

  function scene() {
    const T = textures(G.DPTH);
    buildGrid();
    const d = DIRV[G.FDIR - 1], rt = RIGHTV[G.FDIR - 1];
    const dX = d[0], dY = d[1], pX = rt[0] * HALF, pY = rt[1] * HALF;
    const camX = G.XLOC + .5 - dX, camY = G.YLOC + .5 - dY;
    const fwdAxis = dX !== 0 ? 0 : 1;
    buf.fill(0xFF000000);

    // Walls, column by column
    for (let x = 0; x < VW; x++) {
      const k = 2 * (x + .5) / VW - 1;
      const rx = dX + pX * k, ry = dY + pY * k;
      const sx = camX + rx * T0, sy = camY + ry * T0;
      let mx = G.XLOC, my = G.YLOC;
      const tdx = rx !== 0 ? Math.abs(1 / rx) : 1e30, tdy = ry !== 0 ? Math.abs(1 / ry) : 1e30;
      let tmx = rx !== 0 ? T0 + (rx > 0 ? (mx + 1 - sx) : (sx - mx)) * tdx : 1e30;
      let tmy = ry !== 0 ? T0 + (ry > 0 ? (my + 1 - sy) : (sy - my)) * tdy : 1e30;
      let t = MAXD, kind = 0, axis = 0;
      for (let s = 0; s < 64; s++) {
        const v = cell(mx, my);
        let bit, ax, tt;
        if (tmx < tmy) { tt = tmx; ax = 0; bit = rx > 0 ? 2 : 1; } else { tt = tmy; ax = 1; bit = ry > 0 ? 8 : 4; }
        if (tt > MAXD) break;
        if (v & bit) { t = tt; kind = 1; axis = ax; break; }
        const nx = ax === 0 ? mx + (rx > 0 ? 1 : -1) : mx, ny = ax === 1 ? my + (ry > 0 ? 1 : -1) : my;
        if (cell(nx, ny) < 0) { t = tt; kind = 1; axis = ax; break; }     // nothing there: solid rock
        if (v & (bit << 8)) { t = tt; kind = 2; axis = ax; break; }
        mx = nx; my = ny;
        if (ax === 0) tmx += tdx; else tmy += tdy;
      }
      zbuf[x] = t;
      if (!kind) { wTop[x] = wBot[x] = CY; continue; }
      const hx = camX + rx * t, hy = camY + ry * t;
      let u = axis === 0 ? hy - Math.floor(hy) : hx - Math.floor(hx);
      if ((axis === 0 && rx < 0) || (axis === 1 && ry > 0)) u = 1 - u;
      const lh = FOC / t, top = CY - lh * (1 - EYE), bot = CY + lh * EYE;
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(VH, Math.ceil(bot));
      wTop[x] = y0; wBot[x] = y1;
      const tex = kind === 2 ? T.door : T.wall;
      const tx = Math.min(TS - 1, (u * TS) | 0);
      const b = light(t) * (axis !== fwdAxis ? .72 : 1);
      const vs = TS / (bot - top);
      let tv = (y0 - top) * vs;
      for (let y = y0; y < y1; y++, tv += vs) buf[y * VW + x] = sh(tex[((tv | 0) & (TS - 1)) * TS + tx], b);
    }

    // Floor and ceiling, row by row (the eye is half way up, so each floor row mirrors a ceiling row)
    for (let y = Math.ceil(CY); y < VH; y++) {
      const z = EYE * FOC / (y + .5 - CY);
      if (z > MAXD) continue;
      const b = light(z), yc = VH - 1 - y;
      const stx = 2 * pX * z / VW, sty = 2 * pY * z / VW;
      let wx = camX + (dX - pX) * z + stx * .5, wy = camY + (dY - pY) * z + sty * .5;
      for (let x = 0; x < VW; x++, wx += stx, wy += sty) {
        const fv = y >= wBot[x], cv = yc < wTop[x];
        if (!fv && !cv) continue;
        const mx = Math.floor(wx), my = Math.floor(wy), fx = wx - mx, fy = wy - my;
        const info = cell(mx, my);
        const ti = ((fy * TS) | 0) * TS + ((fx * TS) | 0);
        const ex = fx - .5, ey = fy - .5, d2 = ex * ex + ey * ey;
        if (fv) {
          let c;
          if (info >= 0 && (info & 0x20) && d2 < .12) {
            if (d2 < .09) { const k = d2 / .09; c = sh(pack(30 * k, 26 * k, 24 * k), 1); }
            else c = sh(T.wall[ti], b * 1.1);
          } else c = sh(T.floor[ti], b);
          buf[y * VW + x] = c;
        }
        if (cv) {
          let c;
          if (info >= 0 && (info & 0x10) && d2 < .12) {
            if (d2 < .09) { const k = 1 - d2 / .09; c = sh(pack(40 + 50 * k, 48 + 56 * k, 70 + 70 * k), Math.max(b, .55)); }
            else c = sh(T.wall[ti], b);
          } else c = sh(T.ceil[ti], b * .9);
          buf[yc * VW + x] = c;
        }
      }
    }

    // Items on the floor and ropes hanging from holes in the ceiling
    const sprites = [];
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      const info = grid[j * GN + i];
      if (info < 0) continue;
      const wx = gx0 + i + .5, wy = gy0 + j + .5;
      const z = (wx - camX) * dX + (wy - camY) * dY;
      if (z < .55 || z > MAXD) continue;
      const type = (info >> 16) & 15;
      if (type && !(FS(9) && i === GR && j === GR)) sprites.push({ wx, wy, z, h0: 0, h1: .2, w: .2, tex: ITEMS[type - 1], tw: 64, th: 64 });
      if (info & 0x10) sprites.push({ wx, wy, z: z + .01, h0: .1, h1: 1, w: .035, tex: ROPE, tw: 8, th: 128 });
    }
    sprites.sort((a, b) => b.z - a.z);
    for (const s of sprites) {
      const xc = (s.wx - camX) * rt[0] + (s.wy - camY) * rt[1];
      const scx = VW / 2 + FOC * xc / s.z, sw = FOC * s.w / s.z;
      const top = CY + FOC * (EYE - s.h1) / s.z, bot = CY + FOC * (EYE - s.h0) / s.z;
      const x0 = Math.max(0, Math.ceil(scx - sw / 2)), x1 = Math.min(VW, Math.ceil(scx + sw / 2));
      const y0 = Math.max(0, Math.ceil(top)), y1 = Math.min(VH, Math.ceil(bot));
      const b = light(s.z);
      for (let x = x0; x < x1; x++) {
        if (s.z >= zbuf[x]) continue;
        const tx = Math.min(s.tw - 1, (((x + .5 - (scx - sw / 2)) / sw) * s.tw) | 0);
        for (let y = y0; y < y1; y++) {
          const c = s.tex[Math.min(s.th - 1, (((y + .5 - top) / (bot - top)) * s.th) | 0) * s.tw + tx];
          if ((c >>> 24) < 128) continue;
          buf[y * VW + x] = sh(c, b);
        }
      }
    }
    octx.putImageData(img, 0, 0);

    // The monster you are fighting stands in front of you
    if (FS(9) && G.MNSTR) {
      const m = monSprite(G.MNSTR.idx), z = 1.0;
      const hgt = FOC * m.size / z, wid = hgt * m.cv.width / m.cv.height;
      const floorY = CY + FOC * EYE / z, footY = CY + FOC * (EYE - m.float) / z;
      octx.fillStyle = 'rgba(0,0,0,.45)';
      octx.beginPath(); octx.ellipse(VW / 2, floorY, wid * .42, wid * .08, 0, 0, Math.PI * 2); octx.fill();
      const b = light(z);
      if (b < .98 && 'filter' in octx) octx.filter = 'brightness(' + b.toFixed(2) + ')';
      octx.drawImage(m.cv, VW / 2 - wid / 2, footY - hgt, wid, hgt);
      octx.filter = 'none';
    }
    const vg = octx.createRadialGradient(VW / 2, VH / 2, VH * .35, VW / 2, VH / 2, VW * .7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    octx.fillStyle = vg; octx.fillRect(0, 0, VW, VH);
  }

  // Show the new frame, sliding / zooming from the old one for moves and turns
  function present(anim) {
    cancelAnimationFrame(animId);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!anim || reduce) { vctx.drawImage(off, 0, 0); pctx.drawImage(off, 0, 0); return; }
    const t0 = performance.now(), D = (anim === 'left' || anim === 'right') ? 200 : 180;
    const step = now => {
      const t = Math.min(1, (now - t0) / D), e = t * (2 - t);
      vctx.globalAlpha = 1; vctx.fillStyle = '#000'; vctx.fillRect(0, 0, VW, VH);
      if (anim === 'fwd') {
        vctx.drawImage(off, 0, 0);
        const s = 1 + .4 * e; vctx.globalAlpha = 1 - e;
        vctx.drawImage(prev, VW / 2 - VW * s / 2, VH / 2 - VH * s / 2, VW * s, VH * s);
      } else if (anim === 'back') {
        vctx.drawImage(off, 0, 0);
        const s = 1 - .3 * e; vctx.globalAlpha = 1 - e;
        vctx.drawImage(prev, VW / 2 - VW * s / 2, VH / 2 - VH * s / 2, VW * s, VH * s);
      } else if (anim === 'left') {
        vctx.drawImage(prev, e * VW, 0); vctx.drawImage(off, e * VW - VW, 0);
      } else if (anim === 'right') {
        vctx.drawImage(prev, -e * VW, 0); vctx.drawImage(off, VW - e * VW, 0);
      } else {
        vctx.drawImage(prev, 0, 0); vctx.globalAlpha = e; vctx.drawImage(off, 0, 0);
      }
      vctx.globalAlpha = 1;
      if (t < 1) animId = requestAnimationFrame(step);
      else { vctx.drawImage(off, 0, 0); pctx.drawImage(off, 0, 0); }
    };
    animId = requestAnimationFrame(step);
  }

  function draw(anim) { scene(); present(anim); }
  return { init, draw, monSprite };
})();
