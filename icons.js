/* Ability-style icons for the keypad buttons (painted-look inline SVG, 64 x 64).
   decorateKeys() swaps each button's key letter for an icon with the key shown in the corner. */
'use strict';

const ICONS = (() => {
  // Shared pieces. Every icon gets its own id prefix so gradients don't clash.
  const bg = (p, c1, c2) =>
    `<radialGradient id="${p}bg" cx=".5" cy=".38" r=".8"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
  const lin = (id, c1, c2, x2 = 0, y2 = 1) =>
    `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
  const rad = (id, stops) =>
    `<radialGradient id="${id}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
  const glow = p => `<filter id="${p}gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>`;
  const svg = (p, defs, body) =>
    `<svg viewBox="0 0 64 64" aria-hidden="true"><defs>${defs}</defs><rect width="64" height="64" fill="url(#${p}bg)"/>${body}</svg>`;

  // A gold arrow along a path, with a dark outline, and an arrowhead polygon
  const goldArrow = (p, d, head) => `
    <path d="${d}" fill="none" stroke="#1a1004" stroke-width="11" stroke-linecap="round"/>
    <polygon points="${head}" fill="#1a1004" stroke="#1a1004" stroke-width="4" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="url(#${p}au)" stroke-width="6.5" stroke-linecap="round"/>
    <polygon points="${head}" fill="url(#${p}au)"/>`;
  const auGrad = p => lin(p + 'au', '#fff1b0', '#c8861e', 0.3, 1);

  const boot = (p, flip) => `
    <g ${flip ? 'transform="translate(64 0) scale(-1 1)"' : ''}>
      <g stroke="#e8f6ff" stroke-width="2.5" stroke-linecap="round" opacity=".75">
        <line x1="5" y1="30" x2="17" y2="30"/><line x1="3" y1="39" x2="17" y2="39"/><line x1="7" y1="48" x2="18" y2="48"/>
      </g>
      <path d="M24 10 h15 v26 l13 6 q5 2.5 5 8 v4 H22 z" fill="url(#${p}bt)" stroke="#2a1606" stroke-width="2"/>
      <rect x="22" y="50" width="35" height="6" rx="2" fill="#2a1606"/>
      <path d="M24 16 h15" stroke="#c9a24a" stroke-width="3"/><path d="M24 22 h15" stroke="#8a5a2a" stroke-width="2"/>
      <path d="M27 12 v20" stroke="#fff" stroke-opacity=".25" stroke-width="3"/>
    </g>`;

  const sack = (p, y = 0) => `
    <g transform="translate(0 ${y})">
      <path d="M20 30 q-7 11 -4 21 q3 8 16 8 q13 0 16 -8 q3 -10 -4 -21 z" fill="url(#${p}sk)" stroke="#2a1606" stroke-width="2"/>
      <path d="M22 24 l4 6 h12 l4 -6 q-10 -5 -20 0 z" fill="#a8763e" stroke="#2a1606" stroke-width="2"/>
      <rect x="24" y="28" width="16" height="4" rx="2" fill="#c9a24a" stroke="#4a3010" stroke-width="1"/>
      <path d="M22 40 q2 10 8 14" stroke="#fff" stroke-opacity=".2" stroke-width="3" fill="none"/>
    </g>`;
  const sackGrad = p => lin(p + 'sk', '#b88048', '#5a3414');

  const I = {};

  I.turnLeft = p => svg(p, bg(p, '#4f7598', '#0c1826') + auGrad(p),
    goldArrow(p, 'M43 45 A15 15 0 1 0 17 30', '9,28 25,28 17,40'));
  I.turnRight = p => svg(p, bg(p, '#4f7598', '#0c1826') + auGrad(p),
    `<g transform="translate(64 0) scale(-1 1)">${goldArrow(p, 'M43 45 A15 15 0 1 0 17 30', '9,28 25,28 17,40')}</g>`);
  I.about = p => svg(p, bg(p, '#6a5a98', '#140c26') + auGrad(p),
    goldArrow(p, 'M20 52 V28 A12 12 0 0 1 44 28 V38', '36,38 52,38 44,50'));
  I.forward = p => svg(p, bg(p, '#3f8a62', '#0a2016') + lin(p + 'bt', '#a8703a', '#4a2a10'), boot(p, false));
  I.back = p => svg(p, bg(p, '#9a6a3a', '#26140a') + lin(p + 'bt', '#a8703a', '#4a2a10'), boot(p, true));

  I.get = p => svg(p, bg(p, '#4a7a3a', '#0e1e0a') + sackGrad(p) + lin(p + 'ar', '#b8ff9a', '#2a9a2a'), sack(p, 4) + `
    <path d="M32 3 v17" stroke="#0a2a0a" stroke-width="10" stroke-linecap="round"/>
    <polygon points="22,16 42,16 32,28" fill="#0a2a0a" stroke="#0a2a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M32 4 v15" stroke="url(#${p}ar)" stroke-width="6" stroke-linecap="round"/>
    <polygon points="23,17 41,17 32,27" fill="url(#${p}ar)"/>`);
  I.drop = p => svg(p, bg(p, '#8a3a2a', '#240a06') + sackGrad(p) + lin(p + 'ar', '#ffb09a', '#c02a1a'), sack(p, -14) + `
    <path d="M32 46 v8" stroke="#2a0a06" stroke-width="10" stroke-linecap="round"/>
    <polygon points="22,52 42,52 32,63" fill="#2a0a06" stroke="#2a0a06" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 46 v7" stroke="url(#${p}ar)" stroke-width="6" stroke-linecap="round"/>
    <polygon points="23,53 41,53 32,62" fill="url(#${p}ar)"/>`);

  I.use = p => svg(p, bg(p, '#7a3a8a', '#1a0a20') + rad(p + 'lq', [[0, '#ff8a9a'], [.6, '#d0203a'], [1, '#6a0a1a']]) + glow(p), `
    <circle cx="32" cy="42" r="17" fill="#ff4a6a" opacity=".45" filter="url(#${p}gl)"/>
    <rect x="27" y="10" width="10" height="16" fill="#cfe6f0" fill-opacity=".55" stroke="#2a2a3a" stroke-width="2"/>
    <rect x="25" y="6" width="14" height="7" rx="2" fill="#9a6a3a" stroke="#3a2010" stroke-width="2"/>
    <circle cx="32" cy="42" r="15" fill="url(#${p}lq)" stroke="#2a0a14" stroke-width="2.5"/>
    <path d="M19 38 q13 -6 26 0" stroke="#ffc0c8" stroke-width="1.5" fill="none" opacity=".7"/>
    <ellipse cx="25" cy="36" rx="3.5" ry="6" fill="#fff" opacity=".6"/>`);

  I.remove = p => svg(p, bg(p, '#5a6a7a', '#10161c') + lin(p + 'st', '#e8eef4', '#5a6470', .6, 1), `
    <path d="M14 14 l10 -4 q8 6 16 0 l10 4 l-2 14 q-2 22 -16 30 q-14 -8 -16 -30 z" fill="url(#${p}st)" stroke="#1a2026" stroke-width="2.5"/>
    <path d="M32 14 v42" stroke="#3a444e" stroke-width="2"/>
    <path d="M18 26 q14 6 28 0" stroke="#3a444e" stroke-width="2" fill="none"/>
    <circle cx="47" cy="47" r="12" fill="#2a0806" stroke="#1a0404" stroke-width="2"/>
    <circle cx="47" cy="47" r="9" fill="none" stroke="#ff3a2a" stroke-width="3.5"/>
    <line x1="41" y1="53" x2="53" y2="41" stroke="#ff3a2a" stroke-width="3.5"/>`);

  I.inventory = p => svg(p, bg(p, '#7a5a3a', '#1e1208') + lin(p + 'wd', '#b07a40', '#5a3414') + lin(p + 'au', '#fff1b0', '#b8781a'), `
    <path d="M9 30 q0 -16 23 -16 q23 0 23 16 z" fill="url(#${p}wd)" stroke="#2a1606" stroke-width="2.5"/>
    <rect x="9" y="30" width="46" height="24" rx="2" fill="url(#${p}wd)" stroke="#2a1606" stroke-width="2.5"/>
    <g fill="url(#${p}au)" stroke="#3a2406" stroke-width="1.5">
      <rect x="15" y="15" width="6" height="39"/><rect x="43" y="15" width="6" height="39"/>
      <rect x="27" y="26" width="10" height="13" rx="2"/>
    </g>
    <circle cx="32" cy="31" r="2" fill="#2a1606"/><rect x="31" y="31" width="2" height="5" fill="#2a1606"/>
    <path d="M12 33 h40" stroke="#2a1606" stroke-width="2"/>`);

  I.search = p => svg(p, bg(p, '#3a7a7a', '#081a1a') + rad(p + 'ln', [[0, '#e8ffff', .9], [.7, '#8adada', .5], [1, '#2a6a6a', .6]]) + lin(p + 'au', '#fff1b0', '#b8781a'), `
    <line x1="38" y1="38" x2="56" y2="56" stroke="#1a0e04" stroke-width="12" stroke-linecap="round"/>
    <line x1="38" y1="38" x2="55" y2="55" stroke="#6a3a14" stroke-width="7" stroke-linecap="round"/>
    <circle cx="27" cy="27" r="17" fill="url(#${p}ln)" stroke="#1a0e04" stroke-width="3"/>
    <circle cx="27" cy="27" r="15" fill="none" stroke="url(#${p}au)" stroke-width="4"/>
    <path d="M17 22 a11 11 0 0 1 9 -7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`);

  I.rest = p => svg(p, bg(p, '#2a3a6a', '#05080f') + rad(p + 'fl', [[0, '#fff6c0'], [.45, '#ffb030'], [1, '#d0301a', 0]]) + glow(p), `
    <circle cx="10" cy="12" r="1.3" fill="#fff"/><circle cx="52" cy="8" r="1" fill="#fff"/><circle cx="44" cy="18" r="1" fill="#fff" opacity=".7"/>
    <ellipse cx="32" cy="36" rx="20" ry="20" fill="#ff9a2a" opacity=".35" filter="url(#${p}gl)"/>
    <path d="M32 12 q14 14 10 28 q-2 8 -10 8 q-8 0 -10 -8 q-3 -10 4 -16 q0 8 4 8 q-4 -10 2 -20 z" fill="url(#${p}fl)"/>
    <path d="M32 26 q7 8 4 16 q-4 4 -8 0 q-2 -8 4 -16 z" fill="#fff6c0"/>
    <g stroke="#2a1606" stroke-width="2"><rect x="10" y="46" width="44" height="7" rx="3.5" fill="#7a4a22" transform="rotate(12 32 50)"/>
    <rect x="10" y="46" width="44" height="7" rx="3.5" fill="#8a5a2a" transform="rotate(-12 32 50)"/></g>`);

  I.ascend = p => svg(p, bg(p, '#6a7a8a', '#141a20') + lin(p + 'ar', '#b8ff9a', '#2a9a2a'), `
    <g stroke="#2a1606" stroke-width="2" fill="#9a6a34">
      <rect x="10" y="6" width="6" height="56" rx="2"/><rect x="30" y="6" width="6" height="56" rx="2"/>
      <rect x="14" y="14" width="18" height="4"/><rect x="14" y="26" width="18" height="4"/><rect x="14" y="38" width="18" height="4"/><rect x="14" y="50" width="18" height="4"/>
    </g>
    <path d="M50 54 v-30" stroke="#0a2a0a" stroke-width="10" stroke-linecap="round"/>
    <polygon points="40,26 60,26 50,12" fill="#0a2a0a" stroke="#0a2a0a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M50 53 v-28" stroke="url(#${p}ar)" stroke-width="6" stroke-linecap="round"/>
    <polygon points="41,25 59,25 50,13" fill="url(#${p}ar)"/>`);

  I.descend = p => svg(p, bg(p, '#4a3a5a', '#08040c') + lin(p + 'ar', '#ffe09a', '#c8661a') + lin(p + 'sn', '#aaa49a', '#4a4640'), `
    <g stroke="#1a1614" stroke-width="2" fill="url(#${p}sn)">
      <rect x="4" y="14" width="18" height="46"/><rect x="18" y="24" width="16" height="36"/><rect x="30" y="34" width="16" height="26"/><rect x="42" y="44" width="18" height="16"/>
    </g>
    <path d="M42 6 l10 10" stroke="#2a1404" stroke-width="10" stroke-linecap="round"/>
    <polygon points="44,22 58,8 58,24" fill="#2a1404" stroke="#2a1404" stroke-width="4" stroke-linejoin="round"/>
    <path d="M42 6 l10 10" stroke="url(#${p}ar)" stroke-width="6" stroke-linecap="round"/>
    <polygon points="45,21 57,9 57,22" fill="url(#${p}ar)"/>`);

  I.attack = p => svg(p, bg(p, '#8a2a1e', '#1e0604') + lin(p + 'bl', '#ffffff', '#8a94a0', 1, 0) + lin(p + 'au', '#fff1b0', '#b8781a'), [0, 1].map(f => `
    <g ${f ? 'transform="translate(64 0) scale(-1 1)"' : ''}>
      <path d="M8 8 l6 -2 l32 32 l-4 4 z" fill="url(#${p}bl)" stroke="#1a1a20" stroke-width="2" stroke-linejoin="round"/>
      <path d="M36 46 l10 -10" stroke="url(#${p}au)" stroke-width="5" stroke-linecap="round"/>
      <path d="M45 45 l9 9" stroke="#4a2a10" stroke-width="6" stroke-linecap="round"/>
      <circle cx="56" cy="56" r="3.5" fill="url(#${p}au)" stroke="#3a2406" stroke-width="1.5"/>
    </g>`).join(''));

  I.look = p => svg(p, bg(p, '#3a6a8a', '#060e16') + rad(p + 'ir', [[0, '#1a0a04'], [.35, '#1a0a04'], [.4, '#ffd060'], [1, '#b8601a']]) + glow(p), `
    <path d="M4 32 q28 -26 56 0 q-28 26 -56 0 z" fill="#ffe8a0" opacity=".5" filter="url(#${p}gl)"/>
    <path d="M6 32 q26 -22 52 0 q-26 22 -52 0 z" fill="#f4ecdc" stroke="#1a1004" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="12" fill="url(#${p}ir)" stroke="#1a1004" stroke-width="2"/>
    <circle cx="27" cy="27" r="3" fill="#fff"/>`);

  I.missile = p => svg(p, bg(p, '#7a2aa0', '#12041e') + rad(p + 'or', [[0, '#ffffff'], [.4, '#ff9aff'], [1, '#b02ae0', 0]]) + glow(p), [[16, 46, 8], [34, 30, 10], [48, 14, 7]].map(([x, y, r]) => `
    <path d="M${x - 14} ${y + 14} L${x} ${y}" stroke="#e070ff" stroke-width="${r * .9}" stroke-linecap="round" opacity=".45" filter="url(#${p}gl)"/>
    <circle cx="${x}" cy="${y}" r="${r * 1.4}" fill="url(#${p}or)"/>
    <circle cx="${x}" cy="${y}" r="${r * .45}" fill="#fff"/>`).join(''));

  I.bolt = p => svg(p, bg(p, '#2a4aa0', '#040a1e') + lin(p + 'lb', '#ffffff', '#7ac8ff') + glow(p), `
    <polygon points="36,3 14,36 29,36 22,61 50,24 34,24 44,3" fill="#6ab8ff" filter="url(#${p}gl)"/>
    <polygon points="36,3 14,36 29,36 22,61 50,24 34,24 44,3" fill="url(#${p}lb)" stroke="#e8f8ff" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M10 14 l6 4 l-3 5 M52 44 l6 3 l-4 6" stroke="#bfe6ff" stroke-width="1.5" fill="none" opacity=".8"/>`);

  I.fire = p => svg(p, bg(p, '#9a3a0a', '#1e0802') + rad(p + 'fb', [[0, '#ffffff'], [.25, '#fff2a0'], [.6, '#ff9a1a'], [1, '#c8200a']]) + glow(p), `
    <path d="M40 24 Q58 4 62 2 Q52 20 50 30 Q60 22 64 20 Q54 36 44 42 z" fill="#ff7a1a" opacity=".85"/>
    <path d="M40 26 Q52 12 56 10 Q48 24 46 32 z" fill="#ffd04a"/>
    <circle cx="28" cy="36" r="22" fill="#ff6a0a" opacity=".6" filter="url(#${p}gl)"/>
    <circle cx="28" cy="36" r="17" fill="url(#${p}fb)"/>`);

  I.chill = p => svg(p, bg(p, '#2a7ab0', '#041426') + lin(p + 'ic', '#ffffff', '#8ae0ff') + glow(p), (() => {
    let arms = '';
    for (let a = 0; a < 6; a++) {
      arms += `<g transform="rotate(${a * 60} 32 32)"><path d="M32 32 V6 M32 14 l-6 -6 M32 14 l6 -6 M32 22 l-7 -5 M32 22 l7 -5" stroke="url(#${p}ic)" stroke-width="3.5" stroke-linecap="round" fill="none"/></g>`;
    }
    return `<g filter="url(#${p}gl)" opacity=".8" stroke="#aef" stroke-width="5">${arms.replace(/url\(#[^)]+ic\)/g, '#9ae8ff')}</g>${arms}
      <circle cx="32" cy="32" r="5" fill="#fff"/>`;
  })());

  I.heal = p => svg(p, bg(p, '#3a8a3a', '#061606') + rad(p + 'ho', [[0, '#ffffff'], [.5, '#fff8a0'], [1, '#ffd23a', 0]]) + lin(p + 'cr', '#ffffff', '#ffe060') + glow(p), `
    <g stroke="#fff8c0" stroke-width="2" opacity=".55">${Array.from({ length: 12 }, (_, i) => `<line x1="32" y1="32" x2="${32 + 30 * Math.cos(i * Math.PI / 6)}" y2="${32 + 30 * Math.sin(i * Math.PI / 6)}"/>`).join('')}</g>
    <circle cx="32" cy="32" r="22" fill="url(#${p}ho)"/>
    <path d="M26 12 h12 v14 h14 v12 h-14 v14 h-12 v-14 h-14 v-12 h14 z" fill="#b8ff6a" filter="url(#${p}gl)"/>
    <path d="M26 12 h12 v14 h14 v12 h-14 v14 h-12 v-14 h-14 v-12 h14 z" fill="url(#${p}cr)" stroke="#6a8a1a" stroke-width="1.5"/>`);

  I.locate = p => svg(p, bg(p, '#2a3a6a', '#060814') + rad(p + 'fc', [[0, '#fff6dc'], [1, '#d8c08a']]) + lin(p + 'au', '#fff1b0', '#b8781a'), `
    <circle cx="32" cy="32" r="26" fill="url(#${p}au)" stroke="#2a1a04" stroke-width="2.5"/>
    <circle cx="32" cy="32" r="21" fill="url(#${p}fc)" stroke="#6a4a14" stroke-width="1.5"/>
    <g stroke="#8a6a3a" stroke-width="1.5">${[0, 90, 180, 270].map(a => `<line x1="32" y1="13" x2="32" y2="17" transform="rotate(${a} 32 32)"/>`).join('')}</g>
    <polygon points="32,12 37,32 27,32" fill="#d02a1a" stroke="#4a0a04" stroke-width="1"/>
    <polygon points="32,52 37,32 27,32" fill="#f4f4f4" stroke="#4a4a4a" stroke-width="1"/>
    <circle cx="32" cy="32" r="3" fill="#c9a24a" stroke="#3a2406"/>
    <text x="32" y="11" font-family="Georgia,serif" font-size="8" font-weight="700" fill="#3a1a04" text-anchor="middle">N</text>`);

  I.flee = p => svg(p, bg(p, '#5a6a6a', '#0e1414') + rad(p + 'sm', [[0, '#f0f0ec'], [.7, '#b0b4b0'], [1, '#6a706c', 0]]), `
    <circle cx="42" cy="38" r="16" fill="url(#${p}sm)"/><circle cx="52" cy="26" r="11" fill="url(#${p}sm)"/>
    <circle cx="50" cy="50" r="12" fill="url(#${p}sm)"/><circle cx="34" cy="50" r="10" fill="url(#${p}sm)"/>
    <path d="M40 34 H14" stroke="#1a1a1a" stroke-width="10" stroke-linecap="round"/>
    <polygon points="16,24 16,44 4,34" fill="#1a1a1a" stroke="#1a1a1a" stroke-width="4" stroke-linejoin="round"/>
    <path d="M40 34 H14" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
    <polygon points="16,25 16,43 5,34" fill="#ffffff"/>
    <path d="M26 22 h-10 M30 46 h-12" stroke="#fff" stroke-width="2" opacity=".6" stroke-linecap="round"/>`);

  I.quit = p => svg(p, bg(p, '#6a1a1a', '#120202') + rad(p + 'bn', [[0, '#fffaf0'], [1, '#bdb29a']]), `
    <path d="M32 8 q20 0 20 20 q0 10 -7 14 v8 h-26 v-8 q-7 -4 -7 -14 q0 -20 20 -20 z" fill="url(#${p}bn)" stroke="#2a1a0a" stroke-width="2.5"/>
    <ellipse cx="24" cy="30" rx="6" ry="7" fill="#1a0a04"/><ellipse cx="40" cy="30" rx="6" ry="7" fill="#1a0a04"/>
    <circle cx="24" cy="30" r="2" fill="#ff3a1a"/><circle cx="40" cy="30" r="2" fill="#ff3a1a"/>
    <polygon points="32,36 29,42 35,42" fill="#1a0a04"/>
    <g stroke="#2a1a0a" stroke-width="2"><line x1="26" y1="44" x2="26" y2="50"/><line x1="32" y1="44" x2="32" y2="50"/><line x1="38" y1="44" x2="38" y2="50"/></g>
    <path d="M22 54 h20" stroke="#bdb29a" stroke-width="4" stroke-linecap="round"/>`);

  // Picking from a list
  const numeral = n => p => svg(p, bg(p, '#8a6a3a', '#1e1206') + lin(p + 'au', '#fff1b0', '#b8781a'), `
    <circle cx="32" cy="32" r="24" fill="#2a1a08" stroke="url(#${p}au)" stroke-width="4"/>
    <text x="32" y="44" font-family="Georgia,serif" font-size="34" font-weight="700" fill="url(#${p}au)" stroke="#1a0e02" stroke-width="1" text-anchor="middle">${n}</text>`);
  I.one = numeral(1); I.two = numeral(2); I.three = numeral(3);
  I.up = p => svg(p, bg(p, '#4f7598', '#0c1826') + auGrad(p), goldArrow(p, 'M32 54 V24', '18,28 46,28 32,10'));
  I.down = p => svg(p, bg(p, '#4f7598', '#0c1826') + auGrad(p), goldArrow(p, 'M32 10 V40', '18,36 46,36 32,54'));
  I.cancel = p => svg(p, bg(p, '#8a2a1e', '#1e0604'), `
    <g stroke-linecap="round"><path d="M16 16 L48 48 M48 16 L16 48" stroke="#1a0402" stroke-width="14"/>
    <path d="M16 16 L48 48 M48 16 L16 48" stroke="#ff5a3a" stroke-width="8"/></g>`);
  return I;
})();

// Which icon each keypad key gets
const KEY_ICON = {
  '4': 'turnLeft', '8': 'forward', '6': 'turnRight', '5': 'about', '2': 'back',
  '*': 'get', '/': 'drop', 'U': 'use', 'R': 'remove', 'I': 'inventory', 'S': 'search', '.': 'rest',
  'A': 'ascend', 'D': 'descend', '0': 'look',
  'M': 'missile', 'E': 'bolt', 'F': 'fire', 'C': 'chill', 'H': 'heal', 'L': 'locate', "'": 'flee', '+': 'quit'
};
const PICK_ICON = { '1': 'one', '2': 'two', '3': 'three', 'UP': 'up', 'DOWN': 'down', '.': 'cancel' };
const KEY_LABEL = { UP: '↑', DOWN: '↓' };

let iconSeq = 0;
function setIcon(btn, name) {
  const ic = btn.querySelector('.ic');
  if (!ic || ic.dataset.icon === name) return;
  ic.dataset.icon = name;
  ic.querySelector('.art').innerHTML = ICONS[name]('i' + (iconSeq++) + '_');
}
function decorateKeys(root) {
  root.querySelectorAll('button.k[data-key]').forEach(btn => {
    const key = btn.dataset.key;
    const name = btn.closest('.pickrow') ? PICK_ICON[key] : KEY_ICON[key];
    if (!name) return;
    const b = btn.querySelector('b');
    const ic = document.createElement('span');
    ic.className = 'ic';
    ic.innerHTML = '<span class="art"></span><span class="hk' + (".'*/+".includes(key) ? ' punct' : '') + '">' + (KEY_LABEL[key] || key) + '</span>';
    if (b) b.replaceWith(ic); else btn.prepend(ic);
    setIcon(btn, name);
    const label = btn.querySelector('small');
    if (label) btn.title = label.textContent + ' (' + (KEY_LABEL[key] || key) + ')';
  });
}
