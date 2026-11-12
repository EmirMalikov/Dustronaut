/*@@CFG*/

// ---------- helpers ----------
const G = CFG.grid, HALF = CFG.half;
const BLOCK = 10, NB = Math.ceil(G / BLOCK);
const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmt = n => Math.round(n).toLocaleString(Plat.lang === 'ru' ? 'ru-RU' : 'en-US');
const fmt1 = n => String(Math.round(n * 100) / 100).replace('.', ',');
const TAU = Math.PI * 2;
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ---------- game data ----------
const BOOTH_Z = -61;
const ZONE = { x: 0, z: -52, r: 4.2 };
const START = { x: 0, z: -43, rot: Math.PI };
const NP = PLANETS.length;
const MARS_TREASURES = [
  { x: -7,  z: -37,  name: 'Старый болт с Земли', coins: 120, turbo: 0 },
  { x: -33, z: 18,  name: 'Кристалл Марса',      coins: 80,  turbo: 90 },
  { x: 38,  z: -6,  name: 'Золотая шестерёнка',  coins: 350, turbo: 0 },
  { x: 14,  z: -48, name: 'Осколок метеорита',   coins: 250, turbo: 120 }
];
const TREASURE_NAMES = [null,
  ['Янтарная капля', 'Кусочек бури', 'Старый зонд', 'Красный кристалл'],
  ['Ледяная жемчужина', 'Обломок кольца', 'Компас Кассини', 'Звёздная соль'],
  ['Синий алмаз', 'Капсула гейзера', 'Перо кометы', 'Сердце Тритона']
];
let TREASURES = MARS_TREASURES;
const MARS_SUIT = { base: '#f4f1ee', band: '#ff8f5a', accent: '#c2542b' };
// SUITS[k]: designs of the suit that is needed for planet k
const SUITS = [
  [MARS_SUIT],
  [{ name: 'Янтарные полосы', base: '#f7efe3', band: '#e8943a', accent: '#7a3f1e' },
   { name: 'Шторм',           base: '#f1e9f6', band: '#d65a5a', accent: '#f2c9a0' },
   { name: 'Ночной вихрь',    base: '#e6edf8', band: '#3a7bd5', accent: '#e8d9b0' }],
  [{ name: 'Песочное кольцо', base: '#fbf3dc', band: '#d9b44a', accent: '#5a4a2a' },
   { name: 'Ледяной',         base: '#eef6fb', band: '#6fc3e8', accent: '#2a5a7a' },
   { name: 'Закат',           base: '#f8ece6', band: '#e26d5a', accent: '#ffd56b' }],
  [{ name: 'Глубина',         base: '#e3ecfb', band: '#2f5fd0', accent: '#9fd0ff' },
   { name: 'Аметист',         base: '#f0e8fb', band: '#8a5ad0', accent: '#ffd56b' },
   { name: 'Полярный',        base: '#f4f8fb', band: '#3ac0c8', accent: '#1a2a5a' }]
];
const SUIT_NOTES = [null,
  'На Юпитере давление и холод. Этот скафандр держит их и хорошо смотрится на фоне полосатой планеты.',
  'У колец Сатурна летают ледяные осколки. Скафандр с усиленным шлемом и подогревом.',
  'На Тритоне минус 235 градусов и ледяные гейзеры. Самый тёплый скафандр в магазине.'
];
// what you get for cleaning a planet to 100%
const PRIZES = [
  { title: 'Чистюля Марса', prize: 'золотая насадка пылесоса. Она уже на астронавте.' },
  { title: 'Укротитель бури', prize: 'янтарный компрессор: вся пыль дороже на 15%.' },
  { title: 'Властелин колец', prize: 'золотой робот: ещё один помощник сверх лимита.' },
  { title: 'Хозяин Нептуна', prize: 'корона Нептуна на шлеме. Солнечная система гордится тобой.' }
];
// look of each planet
const THEMES = [
  { sky: '#06040f', fog: '#1a0f26', hemi: [0xd6dcff, 0x7a4a45], sunC: 0xfff0dc, ground: '#80422f', groundY: -1.6, hill: [0.03, 0.42, 0.3], rock: '#6b3a2c',
    horizon: ['rgba(255,165,115,.95)', 'rgba(210,90,70,.3)'], floor: '#d2d8e6', plat: '#4c5070', dust: ['#c68a68', '#a9704f', '#8cc4f2', '#ffcc4a'],
    rim: ['#1fb4a3', '#38dccb'], acc: '#ff8f5a', lane: 'rgba(255,143,90,.8)', mote: ['rgba(255,230,205,1)', 'rgba(255,170,120,.3)'], big: 'earth' },
  { sky: '#120713', fog: '#3a1c18', hemi: [0xffe6c8, 0x8a5a3a], sunC: 0xffe6c4, ground: '#c98f5a', groundY: -26, hill: [0.07, 0.45, 0.62], rock: '#e8c8a0',
    horizon: ['rgba(255,190,120,.95)', 'rgba(220,120,70,.35)'], floor: '#c4c8de', plat: '#5a4a5e', dust: ['#d99a5c', '#b8743e', '#ff5f6a', '#ffe27a'],
    rim: ['#d98a2a', '#ffb347'], acc: '#e8943a', lane: 'rgba(232,148,58,.85)', mote: ['rgba(255,225,190,1)', 'rgba(255,170,90,.3)'], big: 'jupiter' },
  { sky: '#05060f', fog: '#14172a', hemi: [0xe6eeff, 0x50607a], sunC: 0xfff6e0, ground: '#2c3150', groundY: -1.6, hill: [0.6, 0.2, 0.35], rock: '#cfe2f2',
    horizon: ['rgba(240,220,160,.9)', 'rgba(160,150,120,.25)'], floor: '#c6d0ea', plat: '#40465e', dust: ['#d6b77a', '#b39352', '#6fe0ff', '#fff07a'],
    rim: ['#c9a83a', '#ffd56b'], acc: '#e6b94a', lane: 'rgba(230,185,74,.85)', mote: ['rgba(235,245,255,1)', 'rgba(160,210,255,.3)'], big: 'saturn' },
  { sky: '#020618', fog: '#0c1a3a', hemi: [0xcfe0ff, 0x7a6a8a], sunC: 0xe6f0ff, ground: '#b9a4b4', groundY: -1.6, hill: [0.88, 0.18, 0.62], rock: '#e8dce6',
    horizon: ['rgba(120,170,255,.9)', 'rgba(60,90,200,.3)'], floor: '#d4dcec', plat: '#3a4470', dust: ['#8fa6cf', '#6c86b8', '#d39bff', '#ffe9a8'],
    rim: ['#5a7bff', '#8aa8ff'], acc: '#9a7bff', lane: 'rgba(154,123,255,.85)', mote: ['rgba(220,235,255,1)', 'rgba(140,170,255,.3)'], big: 'neptune' }
];
const BRANCHES = [
  { id: 'vac',  name: 'Пылесос' },
  { id: 'bag',  name: 'Рюкзак' },
  { id: 'bot',  name: 'Роботы' },
  { id: 'tech', name: 'Техника' },
  { id: 'suit', name: 'Скафандры' }
];
const ICONS = {
  brush: '<rect x="3" y="14" width="18" height="5" rx="2"/><path d="M6 14V8m6 6V5m6 9V8"/>',
  boot: '<path d="M7 4h6v8l6 3v4H5V4z"/>',
  pack: '<rect x="6" y="4" width="12" height="16" rx="3"/><path d="M9 10h6M9 14h6"/>',
  press: '<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/><path d="M12 8v8M9 12h6"/>',
  portal: '<ellipse cx="12" cy="12" rx="7" ry="9"/><ellipse cx="12" cy="12" rx="3" ry="5"/>',
  robot: '<rect x="5" y="8" width="14" height="10" rx="4"/><circle cx="9.5" cy="13" r="1.3"/><circle cx="14.5" cy="13" r="1.3"/><path d="M12 8V5"/><circle cx="12" cy="3.8" r="1.2"/>',
  bolt: '<path d="M13 3 6 13h5l-1 8 8-11h-5z"/>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l3 5 3-5M12 9v11"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/>',
  suit: '<circle cx="12" cy="8" r="5"/><path d="M5 21c0-5 3-8 7-8s7 3 7 8z"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  planet: '<circle cx="12" cy="12" r="6"/><ellipse cx="12" cy="12" rx="10.5" ry="3.5" transform="rotate(-20 12 12)"/>'
};
const icon = n => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>';

// ---------- achievements (about cleaning) ----------
const ACH = [
  { id: 'c1k',   name: 'Пылесос в деле',  txt: 'Собери 1 000 единиц пыли',   need: 1000,  val: () => S.stats.collected, reward: 100 },
  { id: 'c10k',  name: 'Гроза пыли',      txt: 'Собери 10 000 единиц пыли',  need: 10000, val: () => S.stats.collected, reward: 600 },
  { id: 'c50k',  name: 'Космический дворник', txt: 'Собери 50 000 единиц пыли', need: 50000, val: () => S.stats.collected, reward: 4000 },
  { id: 'gold',  name: 'Золотоискатель',  txt: 'Собери 300 золотых пылинок', need: 300,   val: () => S.stats.shiny, reward: 500 },
  { id: 'bags',  name: 'Под завязку',     txt: 'Сдай полный рюкзак 20 раз',  need: 20,    val: () => S.stats.fullBags, reward: 400 },
  { id: 'bots',  name: 'Командная работа', txt: 'Роботы убрали 5 000 единиц пыли', need: 5000, val: () => S.stats.botCells, reward: 800 },
  { id: 'p0',    name: 'Чистюля Марса',   txt: 'Очисти Марс на 100%',        need: 1, val: () => S.P[0].ach, reward: 0 },
  { id: 'p1',    name: 'Укротитель бури', txt: 'Очисти Юпитер на 100%',      need: 1, val: () => S.P[1].ach, reward: 0 },
  { id: 'p2',    name: 'Властелин колец', txt: 'Очисти Сатурн на 100%',      need: 1, val: () => S.P[2].ach, reward: 0 },
  { id: 'p3',    name: 'Хозяин Нептуна',  txt: 'Очисти Нептун на 100%',      need: 1, val: () => S.P[3].ach, reward: 0 },
  { id: 'all',   name: 'Солнечная система сияет', txt: 'Очисти все четыре станции на 100%', need: 4, val: () => S.P.reduce((a, p) => a + (p.ach ? 1 : 0), 0), reward: 25000 }
];

// ---------- state ----------
const SAVE_KEY = 'dustronaut-save-v1';
const LV0 = () => ({ radius: 0, speed: 0, cap: 0, comp: 0, tele: 0, robot: 0, rspeed: 0, magnet: 0, scanner: 0 });
const freshPlanet = () => ({ mask: null, found: [0, 0, 0, 0], mile: { m25: 0, m50: 0 }, b80: 0, ach: 0, pct: 0, pos: { x: START.x, z: START.z, rot: START.rot } });
function freshState() {
  return {
    ver: 2, coins: 0, lv: LV0(), task: 0, planet: 0,
    P: PLANETS.map(freshPlanet), suits: PLANETS.map((p, i) => i === 0 ? 1 : 0), suitVar: PLANETS.map(() => 0), ach: {},
    stats: { collected: 0, deposits: 0, purchases: 0, treasures: 0, shiny: 0, fullBags: 0, botCells: 0 },
    lastSeen: 0, quality: '', sound: 1, music: 1, turbo: 0,
    bag: { n: 0, r: 0, s: 0 }
  };
}
let S = freshState();
const PR = () => S.P[S.planet];          // current planet record
const PL = () => PLANETS[S.planet];
const TH = () => THEMES[S.planet];
const bonusNow = () => ({ amber: !!S.P[1].ach, ringBot: !!S.P[2].ach });
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const o = JSON.parse(raw), f = freshState();
    S = Object.assign(f, o);
    S.lv = Object.assign(LV0(), o.lv || {});
    S.stats = Object.assign(freshState().stats, o.stats || {});
    S.bag = Object.assign({ n: 0, r: 0, s: 0 }, o.bag || {});
    S.ach = Object.assign({}, o.ach || {});
    if (!Array.isArray(o.P)) {
      // save from version 1 (Mars only): move Mars progress into planet 0
      const m = S.P[0];
      m.mask = o.mask || null; m.found = Array.isArray(o.found) ? o.found : [0, 0, 0, 0];
      m.mile = Object.assign({ m25: 0, m50: 0 }, o.mile || {}); m.b80 = o.banner80 || 0; m.ach = o.ach100 || 0;
      m.pos = Object.assign({ x: START.x, z: START.z, rot: START.rot }, o.pos || {});
      if (o.lv && o.lv.suit) { S.suits[1] = 1; S.suitVar[1] = (o.suit && o.suit.variant) || 0; }
      ['mask', 'found', 'mile', 'banner80', 'ach100', 'pos', 'suit', 'gold'].forEach(k => { delete S[k]; });
      delete S.lv.suit;
      S.ver = 2;
    }
    S.P = PLANETS.map((p, i) => {
      const r = Object.assign(freshPlanet(), (o.P && o.P[i]) || S.P[i] || {});
      r.mile = Object.assign({ m25: 0, m50: 0 }, r.mile || {});
      r.pos = Object.assign({ x: START.x, z: START.z, rot: START.rot }, r.pos || {});
      if (!Array.isArray(r.found) || r.found.length !== 4) r.found = [0, 0, 0, 0];
      return r;
    });
    for (const k of ['suits', 'suitVar']) { const a = Array.isArray(S[k]) ? S[k] : []; S[k] = PLANETS.map((p, i) => a[i] || 0); }
    S.suits[0] = 1;
    S.planet = clamp(S.planet | 0, 0, NP - 1);
    if (!S.suits[S.planet]) S.planet = 0;
    return true;
  } catch (e) { return false; }
}
// how many levels an upgrade has right now: more levels open on every new planet
const tierNow = () => S.suits.reduce((a, v) => a + (v ? 1 : 0), 0) - 1;
const maxOf = u => u.max + (u.extra || 0) * tierNow();

// ---------- world data ----------
const orig = new Uint8Array(G * G);   // 0 none, 1 normal, 2 rare, 3 shiny
const cur = new Uint8Array(G * G);
const colliders = [];                  // {x, z, r}
let total = 1, cleaned = 0;

function genDust() {
  const pl = PL(), rng = mulberry32(pl.seed);
  orig.fill(1);
  const blob = (t, count, rmin, rmax) => {
    for (let k = 0; k < count; k++) {
      const cx = rng() * G, cz = rng() * G, r = rmin + rng() * (rmax - rmin);
      const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(G - 1, Math.ceil(cx + r));
      const z0 = Math.max(0, Math.floor(cz - r)), z1 = Math.min(G - 1, Math.ceil(cz + r));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (d <= r * (0.85 + 0.3 * rng()) && rng() < 0.93) orig[z * G + x] = t;
      }
    }
  };
  blob(2, pl.rare, 3.2, 6.2);
  blob(3, pl.shiny, 1.8, 3.4);
}
function finalizeWorld() {
  // clear cells under props and the apron around the collection point
  for (let z = 0; z < G; z++) for (let x = 0; x < G; x++) {
    const wx = x + 0.5 - HALF, wz = z + 0.5 - HALF;
    let clear = false;
    if (wz < -55 && Math.abs(wx) < 17) clear = true;
    else if (Math.hypot(wx - ZONE.x, wz - ZONE.z) < 7.5) clear = true;
    else for (const c of colliders) { if (Math.hypot(wx - c.x, wz - c.z) < c.r + 0.7) { clear = true; break; } }
    if (clear) orig[z * G + x] = 0;
  }
  let t = 0;
  for (let i = 0; i < orig.length; i++) if (orig[i]) t++;
  total = Math.max(1, t);
  for (let i = 0; i < orig.length; i++) cellT[i] = (orig[i] === 3 ? 0.30 : orig[i] === 2 ? 0.23 : 0.15) + h01(i) * 0.06;
  cur.set(orig);
  if (PR().mask) {
    try {
      const bin = atob(PR().mask);
      for (let i = 0; i < cur.length; i++) {
        const byte = bin.charCodeAt(i >> 3) || 0;
        if (!((byte >> (i & 7)) & 1)) cur[i] = 0;
      }
    } catch (e) { cur.set(orig); }
  }
  let rem = 0;
  for (let i = 0; i < cur.length; i++) if (cur[i]) rem++;
  cleaned = total - rem;
}
function packMask() {
  const bytes = new Uint8Array(Math.ceil(cur.length / 8));
  for (let i = 0; i < cur.length; i++) if (cur[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = '';
  for (let i = 0; i < bytes.length; i += 2048) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 2048));
  return btoa(s);
}
function save() {
  try { S.lastSeen = Date.now(); PR().pos = { x: P.x, z: P.z, rot: P.rot }; PR().mask = packMask(); PR().pct = pctVal(); const raw = JSON.stringify(S); localStorage.setItem(SAVE_KEY, raw); Plat.syncCloud(raw); } catch (e) { /* storage unavailable */ }
}

// ---------- textures ----------

function paintFloor() {
  const size = 1024, k = lowQ ? 1 : 2, c = makeCanvas(size * k, size * k), ctx = c.getContext('2d');
  ctx.scale(k, k);
  const px = size / G, rng = mulberry32(4242);
  ctx.fillStyle = TH().floor; ctx.fillRect(0, 0, size, size);
  const n = G / 10, tile = 10 * px;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    ctx.fillStyle = (rng() < 0.5 ? 'rgba(255,255,255,' : 'rgba(110,120,165,') + (0.05 + rng() * 0.1) + ')';
    ctx.fillRect(i * tile, j * tile, tile, tile);
    ctx.strokeStyle = 'rgba(90,100,140,.3)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(i * tile + 4, j * tile + 4, tile - 8, tile - 8);
    ctx.fillStyle = 'rgba(80,90,130,.5)';
    for (const [ox, oy] of [[8, 8], [tile - 8, 8], [8, tile - 8], [tile - 8, tile - 8]]) {
      ctx.beginPath(); ctx.arc(i * tile + ox, j * tile + oy, 1.6, 0, TAU); ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(60,70,110,.55)'; ctx.lineWidth = 2;
  for (let k = 0; k <= n; k++) {
    ctx.beginPath(); ctx.moveTo(k * tile, 0); ctx.lineTo(k * tile, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * tile); ctx.lineTo(size, k * tile); ctx.stroke();
  }
  ctx.setLineDash([px * 2.5, px * 2]); ctx.lineWidth = px * 0.45; ctx.strokeStyle = TH().lane;
  for (const wx of [-36, 36]) { const x = (wx + HALF) * px; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(56,220,203,.7)';
  for (const wz of [-20]) { const y = (wz + HALF) * px; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(56,220,203,.85)'; ctx.lineWidth = px * 0.5;
  ctx.beginPath(); ctx.arc((ZONE.x + HALF) * px, (ZONE.z + HALF) * px, (ZONE.r + 1.2) * px, 0, TAU); ctx.stroke();
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = 'rgba(40,40,70,' + (0.03 + rng() * 0.06) + ')';
    ctx.beginPath(); ctx.ellipse(rng() * size, rng() * size, px * (1 + rng() * 3), px * (0.3 + rng()), rng() * 3, 0, TAU); ctx.fill();
  }
  const hz = (wx0, wz0, wx1, wz1) => {
    const x0 = (wx0 + HALF) * px, y0 = (wz0 + HALF) * px, w = (wx1 - wx0) * px, h = (wz1 - wz0) * px, s = px * 0.9;
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.fillStyle = '#e9b43a'; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#1c1a2e';
    for (let x = x0 - h; x < x0 + w + h; x += s * 2) {
      ctx.beginPath(); ctx.moveTo(x, y0 + h); ctx.lineTo(x + s, y0 + h); ctx.lineTo(x + s + h, y0); ctx.lineTo(x + h, y0); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  hz(-17, -56.2, 17, -55.4);
  const tex = new THREE.CanvasTexture(c);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = 4;
  return tex;
}

// ---------- dust relief: a height-field mesh that drops under the floor where cells are cleaned ----------
const DEPTH = -0.28, FLOOR_Y = 0.01;
let RES = 2, VX = 0, dustPos = null, dustNor = null, dustCol = null, hv = null, mkH = null, mkN = null;
let dustMat = null, dustMesh = null, eraseQ = [];
let palN1 = null, palN2 = null, palR = null, palS = null;
const cellT = new Float32Array(G * G);
const h01 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const linC = hex => { const c = new THREE.Color(hex); c.convertSRGBToLinear(); return c; };

function grainTex() {
  const S2 = 256, c = makeCanvas(S2, S2), ctx = c.getContext('2d'), rng = mulberry32(55);
  ctx.fillStyle = '#efefef'; ctx.fillRect(0, 0, S2, S2);
  for (let i = 0; i < 6000; i++) {
    const v = 110 + (rng() * 145 | 0);
    ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.25 + rng() * 0.4) + ')';
    ctx.fillRect(rng() * S2, rng() * S2, 1 + rng() * 2, 1 + rng() * 2);
  }
  for (let i = 0; i < 70; i++) {
    const x = rng() * S2, y = rng() * S2, r = 4 + rng() * 14, d = rng() < 0.5;
    for (const ox of [-S2, 0, S2]) for (const oy of [-S2, 0, S2]) {
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      g.addColorStop(0, d ? 'rgba(90,70,70,.22)' : 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  return t;
}

function vHeight(ix, iz) {
  const px = ix / RES, pz = iz / RES;
  const xi = Number.isInteger(px), zi = Number.isInteger(pz);
  const x0 = xi ? px - 1 : Math.floor(px), x1 = xi ? px : x0;
  const z0 = zi ? pz - 1 : Math.floor(pz), z1 = zi ? pz : z0;
  let sum = 0, n = 0, full = true;
  for (let cz = z0; cz <= z1; cz++) {
    if (cz < 0 || cz >= G) continue;
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cx >= G) continue;
      const i = cz * G + cx;
      if (cur[i]) sum += cellT[i]; else { sum += DEPTH; full = false; }
      n++;
    }
  }
  if (!n) return DEPTH;
  let h = sum / n;
  if (full) h += (h01(iz * VX + ix) - 0.5) * 0.06;
  return h;
}
function vNormal(ix, iz) {
  const v = iz * VX + ix;
  const xl = ix > 0 ? ix - 1 : ix, xr = ix < VX - 1 ? ix + 1 : ix;
  const zl = iz > 0 ? iz - 1 : iz, zr = iz < VX - 1 ? iz + 1 : iz;
  const sx = (hv[iz * VX + xr] - hv[iz * VX + xl]) / (Math.max(1, xr - xl) / RES);
  const sz = (hv[zr * VX + ix] - hv[zl * VX + ix]) / (Math.max(1, zr - zl) / RES);
  const k = 1 / Math.hypot(sx, 1, sz);
  dustNor[v * 3] = -sx * k; dustNor[v * 3 + 1] = k; dustNor[v * 3 + 2] = -sz * k;
}
function vColor(ix, iz) {
  const v = iz * VX + ix;
  const cx = clamp(Math.floor(ix / RES + 1e-6), 0, G - 1), cz = clamp(Math.floor(iz / RES + 1e-6), 0, G - 1);
  const t = orig[cz * G + cx], n = h01(v * 1.7 + 5);
  let a = palN1, b = palN2, m = 1;
  if (t === 2) { a = b = palR; m = 0.82 + 0.3 * n; } else if (t === 3) { a = b = palS; m = 0.85 + 0.3 * n; }
  const k = t >= 2 ? 0 : n;
  dustCol[v * 3] = (a.r + (b.r - a.r) * k) * m; dustCol[v * 3 + 1] = (a.g + (b.g - a.g) * k) * m; dustCol[v * 3 + 2] = (a.b + (b.b - a.b) * k) * m;
}
function buildDust(res) {
  RES = res; VX = G * RES + 1;
  const nv = VX * VX;
  const dc = TH().dust; palN1 = linC(dc[0]); palN2 = linC(dc[1]); palR = linC(dc[2]); palS = linC(dc[3]);
  dustPos = new Float32Array(nv * 3); dustNor = new Float32Array(nv * 3); dustCol = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  hv = new Float32Array(nv); mkH = new Uint8Array(nv); mkN = new Uint8Array(nv);
  for (let iz = 0; iz < VX; iz++) for (let ix = 0; ix < VX; ix++) {
    const v = iz * VX + ix;
    dustPos[v * 3] = ix / RES - HALF; dustPos[v * 3 + 2] = iz / RES - HALF;
    uv[v * 2] = ix / RES / 5; uv[v * 2 + 1] = iz / RES / 5;
    hv[v] = vHeight(ix, iz); dustPos[v * 3 + 1] = FLOOR_Y + hv[v];
  }
  for (let iz = 0; iz < VX; iz++) for (let ix = 0; ix < VX; ix++) { vNormal(ix, iz); vColor(ix, iz); }
  const idx = new Uint32Array((VX - 1) * (VX - 1) * 6);
  let p = 0;
  for (let iz = 0; iz < VX - 1; iz++) for (let ix = 0; ix < VX - 1; ix++) {
    const a = iz * VX + ix, b = a + 1, c = a + VX, d = c + 1;
    idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d;
  }
  const g = new THREE.BufferGeometry();
  const pa = new THREE.BufferAttribute(dustPos, 3), na = new THREE.BufferAttribute(dustNor, 3);
  if (pa.setUsage) { pa.setUsage(THREE.DynamicDrawUsage); na.setUsage(THREE.DynamicDrawUsage); }
  g.setAttribute('position', pa); g.setAttribute('normal', na);
  g.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  if (dustMesh.geometry && dustMesh.geometry.dispose) dustMesh.geometry.dispose();
  dustMesh.geometry = g;
  eraseQ = [];
}
function flushErase() {
  if (!eraseQ.length || !dustPos) return;
  const listH = [], listN = [];
  for (let k = 0; k < eraseQ.length; k++) {
    const i = eraseQ[k], cx = i % G, cz = (i / G) | 0;
    for (let iz = cz * RES; iz <= cz * RES + RES; iz++) for (let ix = cx * RES; ix <= cx * RES + RES; ix++) {
      const v = iz * VX + ix;
      if (!mkH[v]) { mkH[v] = 1; listH.push(v); }
    }
  }
  eraseQ.length = 0;
  for (const v of listH) {
    const ix = v % VX, iz = (v / VX) | 0;
    hv[v] = vHeight(ix, iz); dustPos[v * 3 + 1] = FLOOR_Y + hv[v];
  }
  for (const v of listH) {
    mkH[v] = 0;
    const ix = v % VX, iz = (v / VX) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const x = ix + dx, z = iz + dz;
      if (x < 0 || z < 0 || x >= VX || z >= VX) continue;
      const u = z * VX + x;
      if (!mkN[u]) { mkN[u] = 1; listN.push(u); }
    }
  }
  for (const u of listN) { mkN[u] = 0; vNormal(u % VX, (u / VX) | 0); }
  const g = dustMesh.geometry;
  g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
}

function glowTex(inner, outer, star) {
  const c = makeCanvas(64, 64), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.35, outer); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  if (star) {
    ctx.fillStyle = inner;
    ctx.fillRect(30, 4, 4, 56); ctx.fillRect(4, 30, 56, 4);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}
