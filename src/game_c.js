
// ---------- audio ----------
let AC = null, master = null, vacGain = null, vacFilter = null;
function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = S.sound ? 0.9 : 0; master.connect(AC.destination);
    const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    vacFilter = AC.createBiquadFilter(); vacFilter.type = 'lowpass'; vacFilter.frequency.value = 500;
    vacGain = AC.createGain(); vacGain.gain.value = 0;
    src.connect(vacFilter); vacFilter.connect(vacGain); vacGain.connect(master); src.start();
    startMusic();
  } catch (e) { AC = null; }
}
function tone(freq, dur, type, vol, delay, slideTo) {
  if (!AC || !S.sound) return;
  const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const sfx = {
  pick() { tone(520 + Math.random() * 180, 0.06, 'triangle', 0.03); },
  deposit() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.07)); },
  buy() { tone(440, 0.14, 'square', 0.035); tone(660, 0.2, 'square', 0.035, 0.1); tone(880, 0.28, 'triangle', 0.06, 0.2); },
  treasure() { [784, 988, 1319, 1568].forEach((f, i) => tone(f, 0.3, 'sine', 0.07, i * 0.09)); },
  task() { tone(660, 0.15, 'triangle', 0.07); tone(990, 0.3, 'triangle', 0.07, 0.12); },
  full() { tone(300, 0.2, 'sine', 0.05, 0, 220); },
  warp() { tone(180, 1.2, 'sawtooth', 0.025, 0, 900); tone(360, 1.0, 'sine', 0.04, 0.2, 1400); }
};
function startMusic() {
  // every planet has its own calm chord loop
  const SETS = [
    [[220, 277, 330, 415], [175, 220, 262, 330], [196, 247, 294, 370], [165, 208, 247, 311]],
    [[196, 247, 294, 349], [175, 220, 262, 330], [147, 185, 220, 277], [165, 196, 247, 294]],
    [[262, 330, 392, 494], [220, 277, 330, 415], [175, 220, 262, 349], [196, 247, 294, 392]],
    [[147, 175, 220, 262], [131, 165, 196, 247], [117, 147, 175, 220], [139, 165, 208, 247]]
  ];
  let i = 0;
  const play = () => {
    if (!AC || !S.music || !S.sound || document.hidden) return;
    const chords = SETS[S.planet] || SETS[0];
    const c = chords[i++ % chords.length], t = AC.currentTime;
    c.forEach((f, k) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.value = f * (k === 0 ? 0.5 : 1);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.016, t + 2); g.gain.linearRampToValueAtTime(0.0001, t + 6.5);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 7);
    });
  };
  play(); setInterval(play, 6000);
}
let lastVac = null;
function setVac(on, rate) {
  if (!AC || !vacGain) return;
  const key = (on ? 1 : 0) + ':' + Math.round(rate) + ':' + S.sound;
  if (key === lastVac) return;
  lastVac = key;
  const t = AC.currentTime;
  vacGain.gain.setTargetAtTime(on && S.sound ? 0.045 : 0, t, 0.08);
  vacFilter.frequency.setTargetAtTime(380 + rate * 50, t, 0.1);
}
function applySoundSetting() { if (master) master.gain.setTargetAtTime(S.sound ? 0.9 : 0, AC.currentTime, 0.05); }

// ---------- runtime state ----------
let ST = statsFor(LV0(), false);
let traveling = false, nearDust = null, nearT = 0;
const P = { x: START.x, z: START.z, rot: START.rot };
const ptr = { down: false, x: 0, y: 0, id: null };
const keys = { up: false, down: false, left: false, right: false, run: false };
const STAM = { max: 100, drain: 30, regenIdle: 20, regenWalk: 12, delay: 0.7, back: 35, mult: 1.6 };
let runBtn = false, stam = STAM.max, stamDelay = 0, exhausted = false, sprinting = false, puffT = 0;
let playing = false, modalOpen = false, moving = false, vacOn = false, collecting = false, fullWarned = false;
let clock = 0, depositCool = 0, pickCool = 0, goalT = 0, autosaveT = 0, scanT = 0, partsT = 0;
let blockRem = new Uint16Array(NB * NB);
let prevSeen = 0, resetArm = false, selVariant = 0;
const pops = [];
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _g = { x: 0, z: 0 };
const camPos = { x: P.x, z: P.z };

const load = () => S.bag.n + S.bag.r + S.bag.s;
const pctVal = () => {
  const rem = total - cleaned;
  if (rem <= Math.ceil(total * 0.0005)) return 1;
  return Math.min(0.999, cleaned / total);
};
const nextP = () => S.planet + 1 < NP ? S.planet + 1 : -1;
const planetPct = k => k === S.planet ? pctVal() : (S.P[k].pct || 0);
// can the suit for planet k be bought: previous planet owned and cleaned to 80%
const suitOpen = k => k > 0 && k < NP && !!S.suits[k - 1] && planetPct(k - 1) >= 0.8;

// ---------- helpers: projection, floaters, toasts ----------
function groundPoint(sx, sy, out) {
  const rect = $('gl').getBoundingClientRect();
  const nx = ((sx - rect.left) / rect.width) * 2 - 1, ny = -((sy - rect.top) / rect.height) * 2 + 1;
  _v.set(nx, ny, 0.5).unproject(camera);
  _d.copy(_v).sub(camera.position).normalize();
  if (_d.y > -0.01) return false;
  const t = -camera.position.y / _d.y;
  out.x = camera.position.x + _d.x * t; out.z = camera.position.z + _d.z * t;
  return true;
}
function project(x, y, z) {
  _v.set(x, y, z).project(camera);
  const w = $('app').clientWidth, h = $('app').clientHeight;
  return { x: (_v.x * 0.5 + 0.5) * w, y: (-_v.y * 0.5 + 0.5) * h, ok: _v.z < 1, nx: _v.x, ny: _v.y, w: w, h: h };
}
function floatText(x, y, z, txt, cls) {
  const box = $('floaters');
  if (box.children.length > 8) return;
  const p = project(x, y, z);
  if (!p.ok) return;
  const d = document.createElement('div');
  d.className = 'fl ' + (cls || ''); d.textContent = txt;
  d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
  box.appendChild(d);
  setTimeout(() => d.remove(), 1200);
}
function toast(msg, kind) {
  const box = $('toasts');
  while (box.children.length >= 3) box.removeChild(box.firstChild);
  const t = document.createElement('div');
  t.className = 'toast ' + (kind || ''); t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

// ---------- core actions ----------
const _cnt = { n: 0, r: 0, s: 0 };
function vacuumAt(x, z, rad, capLeft) {
  _cnt.n = _cnt.r = _cnt.s = 0;
  const r2 = rad * rad;
  const x0 = Math.max(0, Math.floor(x - rad + HALF)), x1 = Math.min(G - 1, Math.floor(x + rad + HALF));
  const z0 = Math.max(0, Math.floor(z - rad + HALF)), z1 = Math.min(G - 1, Math.floor(z + rad + HALF));
  let left = capLeft;
  for (let cz = z0; cz <= z1 && left > 0; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      const i = cz * G + cx, t = cur[i];
      if (!t) continue;
      const dx = cx + 0.5 - HALF - x, dz = cz + 0.5 - HALF - z;
      if (dx * dx + dz * dz > r2) continue;
      cur[i] = 0; cleaned++; eraseQ.push(i);
      if (t === 1) _cnt.n++; else if (t === 2) _cnt.r++; else _cnt.s++;
      if (--left <= 0) break;
    }
  }
  return _cnt;
}
const valueOf = c => (c.n * CFG.price.n + c.r * CFG.price.r + c.s * CFG.price.s) * ST.priceMult * PL().price;

function deposit() {
  const ld = load();
  if (!ld) return;
  const val = Math.round(valueOf(S.bag));
  if (ld >= ST.cap) S.stats.fullBags++;
  S.coins += val; S.stats.deposits++;
  S.bag.n = S.bag.r = S.bag.s = 0;
  sfx.deposit(); depositCool = 0.6; fullWarned = false;
  floatText(P.x, 2.8, P.z, '+' + fmt(val));
  booth.bounce = 1;
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * TAU, sp = 2 + Math.random() * 3;
    spawnPart(1, 0.5 + Math.random() * 3, 2.2, BOOTH_Z, Math.cos(a) * sp * 0.5, 4 + Math.random() * 3, Math.sin(a) * sp * 0.5 - 1, [1, 0.84, 0.3], 0.9);
  }
}

function collectTreasure(i) {
  const t = TREASURES[i];
  PR().found[i] = 1; S.coins += t.coins; S.stats.treasures++;
  if (t.turbo) S.turbo = Math.max(S.turbo, t.turbo);
  sfx.treasure();
  toast('Найдено: ' + t.name + '! +' + t.coins + ' монет' + (t.turbo ? ' и турбо на ' + t.turbo + ' с' : ''), 'gold');
  floatText(t.x, 1.6, t.z, '+' + t.coins);
  for (let k = 0; k < 28; k++) {
    const a = Math.random() * TAU, sp = 1.5 + Math.random() * 3;
    spawnPart(1, t.x, 0.6, t.z, Math.cos(a) * sp, 3 + Math.random() * 3, Math.sin(a) * sp, [1, 0.9, 0.4], 1);
  }
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshStandardMaterial({ color: '#ffd56b', emissive: '#ff9c1a', emissiveIntensity: 0.8, roughness: 0.3 }));
  fixMat(m.material); m.position.set(t.x, 0.8, t.z); scene.add(m);
  pops.push({ m: m, t: 0 });
}

function canBuy(u) {
  if (S.lv[u.id] >= maxOf(u)) return 'max';
  if (u.req && S.lv[u.req.id] < u.req.lvl) return 'req';
  return 'ok';
}
function buy(id) {
  const u = UPG.find(x => x.id === id);
  if (!u || canBuy(u) !== 'ok') return;
  const c = costOf(u, S.lv[id]);
  if (S.coins < c) { toast('Не хватает монет'); return; }
  S.coins -= c; S.lv[id]++; S.stats.purchases++;
  sfx.buy();
  if (id === 'robot') syncRobots();
  Plat.adDue = true;
  toast(u.name + ': уровень ' + S.lv[id], 'good');
  renderTree(); save();
}
function buySuit(k) {
  if (S.suits[k] || !suitOpen(k)) return;
  const c = PLANETS[k].suit, pl = PLANETS[k], from = PLANETS[k - 1];
  if (S.coins < c) { toast('Не хватает монет на скафандр'); return; }
  Plat.adDue = true;
  S.coins -= c; S.suits[k] = 1; S.suitVar[k] = selVariant; S.stats.purchases++;
  sfx.buy(); sfx.treasure();
  save(); closeSheets(); renderTree();
  const here = S.planet === k - 1, left = Math.max(0, 100 - Math.floor(planetPct(k - 1) * 100));
  openInfo('Скафандр готов!', '<div class="suit-pic" style="margin-bottom:10px">' + suitSVG(SUITS[k][selVariant]) + '</div>' +
    '<p class="note">Теперь можно лететь ' + pl.to + '. Новые улучшения откроются там. ' +
    (left > 0 ? 'Можно и остаться: станции ' + from.of + ' осталось ' + left + '% до 100%, за это будет приз.' : '') + '</p>' +
    '<div class="acts" style="display:flex;gap:8px"><button class="btn teal" style="flex:1" data-fly="' + k + '">Улететь</button>' +
    '<button class="btn ghost" style="flex:1" data-close>' + (here && left > 0 ? 'Остаться и дочистить' : 'Позже') + '</button></div>');
}

// ---------- goals ----------
const TASKS = [
  { txt: 'Зажми и води по станции: собери 20 единиц пыли', prog: () => S.stats.collected / 20, done: () => S.stats.collected >= 20, reward: 25 },
  { txt: 'Встань в светящийся круг у пункта сбора и сдай пыль', prog: () => S.stats.deposits >= 1 ? 1 : 0, done: () => S.stats.deposits >= 1, reward: 30 },
  { txt: 'Открой «Улучшения» и купи любое', prog: () => S.stats.purchases >= 1 ? 1 : 0, done: () => S.stats.purchases >= 1, reward: 40 },
  { txt: 'Найди сокровище: блеск виден слева от старта', prog: () => S.stats.treasures >= 1 ? 1 : 0, done: () => S.stats.treasures >= 1, reward: 60 }
];
function currentGoal() {
  const p = pctVal(), r = PR(), k = PL().price, nx = nextP();
  if (S.task < TASKS.length) { const t = TASKS[S.task]; return { label: 'Задание ' + (S.task + 1) + ' из ' + TASKS.length, text: t.txt, prog: t.prog(), reward: t.reward }; }
  if (!r.mile.m25) return { label: 'Цель', text: 'Очисти станцию на 25%', prog: p / 0.25, reward: 150 * k };
  if (!r.mile.m50) return { label: 'Цель', text: 'Очисти станцию на 50%', prog: p / 0.5, reward: 300 * k };
  if (nx > 0 && !S.suits[nx]) {
    const np = PLANETS[nx];
    if (p < 0.8) return { label: 'Цель', text: 'Дойди до 80%: откроется скафандр для полёта ' + np.to, prog: p / 0.8 };
    return { label: 'Цель', text: 'Накопи на скафандр для полёта ' + np.to + ': ' + fmt(np.suit) + ' монет', prog: S.coins / np.suit };
  }
  if (!r.ach) return { label: 'Цель', text: 'Очисти станцию на 100% и получи приз', prog: p };
  if (nx > 0) {
    const np = PLANETS[nx];
    return { label: 'Готово', text: 'Станция чиста. Следующая остановка: ' + np.name, prog: 1 };
  }
  const all = S.P.every(q => q.ach);
  return { label: 'Готово', text: all ? 'Вся Солнечная система сияет!' : 'Нептун чист. Загляни на карту: где-то ещё осталась пыль', prog: 1 };
}
function checkProgress() {
  while (S.task < TASKS.length && TASKS[S.task].done()) {
    const t = TASKS[S.task];
    S.coins += t.reward; S.task++; sfx.task();
    toast('Задание выполнено! +' + t.reward + ' монет', 'good');
  }
  const p = pctVal(), r = PR(), k = PL().price;
  r.pct = p;
  if (!r.mile.m25 && p >= 0.25) { r.mile.m25 = 1; S.coins += 150 * k; sfx.task(); toast('Очищено 25%! +' + fmt(150 * k) + ' монет', 'good'); }
  if (!r.mile.m50 && p >= 0.5) { r.mile.m50 = 1; S.coins += 300 * k; sfx.task(); toast('Очищено 50%! +' + fmt(300 * k) + ' монет', 'good'); }
  if (!r.b80 && p >= 0.8) { r.b80 = 1; show80(); save(); }
  if (!r.ach && p >= 1) {
    r.ach = 1; applyAllLooks(); syncRobots(); sfx.treasure(); save();
    const pz = PRIZES[S.planet];
    const all = S.P.every(q => q.ach);
    openInfo(pz.title, '<p class="note">' + PL().name + ': станция сияет. Достижение получено.</p><p><b>Приз:</b> ' + pz.prize + '</p>' +
      (all ? '<p class="note">Все четыре станции чисты. Ты прошёл Dustronaut!</p>' : '') + '<button class="btn teal wide" data-close>Отлично</button>');
  }
  checkAch();
}
function checkAch() {
  for (const a of ACH) {
    if (S.ach[a.id]) continue;
    if (a.val() >= a.need) {
      S.ach[a.id] = 1;
      if (a.reward) S.coins += a.reward;
      sfx.task();
      toast('Достижение: ' + a.name + (a.reward ? '! +' + fmt(a.reward) + ' монет' : '!'), 'gold');
      el.trophyDot.hidden = false;
    }
  }
}
function show80() {
  const b = $('banner'), nx = nextP();
  if (nx < 0) {
    b.innerHTML = '<div class="card"><h3>Станция чиста на 80%</h3><p>Это последняя станция. Дочисти её до 100%, чтобы получить корону Нептуна.</p><div class="acts"><button class="btn teal" data-act="b80x">Убирать дальше</button></div></div>';
    b.hidden = false; return;
  }
  const np = PLANETS[nx], has = !!S.suits[nx];
  b.innerHTML = '<div class="card"><h3>Станция чиста на 80%</h3><p>' + (has ? 'Скафандр уже есть, можно лететь ' + np.to + '.' : 'Можно лететь дальше. Для полёта ' + np.to + ' нужен новый скафандр.') + '</p><div class="acts"><button class="btn teal" data-act="b80go">' + (has ? 'Лететь' : 'К скафандру') + '</button><button class="btn ghost" data-act="b80x">Убирать дальше</button></div></div>';
  b.hidden = false;
}

// ---------- UI: HUD ----------
const el = {
  coins: $('coins'), pct: $('pct'), fill: $('barfill'), bagTxt: $('bagTxt'), bagFill: $('bagFill'), bagNote: $('bagNote'),
  bag: $('bag'), stam: $('stam'), stamFill: $('stamFill'), stamTxt: $('stamTxt'), dot: $('upDot'), tele: $('btnTele'), chips: $('chips'), task: $('task'), arrow: $('arrow'), pname: $('pname'), pst: $('pstation'), trophyDot: $('trophyDot')
};
const cache = {};
function setText(node, key, v) { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } }
function updateHUD() {
  const p = pctVal(), ld = load();
  setText(el.coins, 'coins', fmt(S.coins));
  setText(el.pct, 'pct', Math.floor(p * 100) + '%');
  setText(el.pname, 'pname', PL().name);
  setText(el.pst, 'pst', ' · станция «' + PL().station + '»');
  const w = (p * 100).toFixed(1) + '%';
  if (cache.fw !== w) { cache.fw = w; el.fill.style.width = w; }
  setText(el.bagTxt, 'bag', ld + ' / ' + ST.cap);
  const bw = Math.min(100, ld / ST.cap * 100).toFixed(0) + '%';
  if (cache.bw !== bw) { cache.bw = bw; el.bagFill.style.width = bw; }
  const full = ld >= ST.cap;
  if (cache.full !== full) { cache.full = full; el.bag.classList.toggle('full', full); }
  setText(el.bagNote, 'note', full ? 'Рюкзак полон: неси пыль к пункту сбора' : (ld >= ST.cap * 0.8 ? 'Почти полон' : ''));
  const sw = Math.round(stam / STAM.max * 100) + '%';
  if (cache.sw !== sw) { cache.sw = sw; el.stamFill.style.width = sw; }
  const sc = exhausted ? 'out' : (stam < 30 ? 'low' : '');
  if (cache.sc !== sc) { cache.sc = sc; el.stam.className = 'stam ' + sc; }
  setText(el.stamTxt, 'stamTxt', exhausted ? 'Отдышка' : '');
  // affordable upgrade dot
  let aff = false;
  for (const u of UPG) {
    if (canBuy(u) === 'ok' && S.coins >= costOf(u, S.lv[u.id])) { aff = true; break; }
  }
  const nx = nextP();
  if (!aff && nx > 0 && !S.suits[nx] && suitOpen(nx) && S.coins >= PLANETS[nx].suit) aff = true;
  if (cache.dot !== aff) { cache.dot = aff; el.dot.hidden = !aff; }
  const showTele = ST.tele && ld > 0;
  if (cache.tele !== showTele) { cache.tele = showTele; el.tele.hidden = !showTele; }
  const chip = S.turbo > 0 ? '<span class="chip">Турбо ' + Math.ceil(S.turbo) + ' с</span>' : '';
  if (cache.chip !== chip) { cache.chip = chip; el.chips.innerHTML = chip; }
  // arrow to the collection point, or near the end of a station to the closest dust left
  const toZone = !modalOpen && playing && ld > 0 && (ld >= ST.cap * 0.85 || S.task === 1) && Math.hypot(P.x - ZONE.x, P.z - ZONE.z) > ZONE.r + 1;
  const toDust = !toZone && !modalOpen && playing && nearDust && ld < ST.cap && Math.hypot(P.x - nearDust.x, P.z - nearDust.z) > ST.r + 2.5;
  const need = toZone || toDust;
  const mode = toZone ? '' : 'dust';
  if (cache.arrowMode !== mode) { cache.arrowMode = mode; el.arrow.className = mode; }
  if (need) {
    const q = toZone ? project(ZONE.x, 1.2, ZONE.z) : project(nearDust.x, 0.6, nearDust.z);
    let x, y, rot = 0;
    if (q.ok && Math.abs(q.nx) < 0.85 && Math.abs(q.ny) < 0.75) { x = q.x; y = q.y - 46; }
    else {
      let dx = q.nx, dy = -q.ny;
      if (!q.ok) { dx = -dx; dy = -dy; }
      const k = Math.max(Math.abs(dx) / ((q.w / 2 - 36) / (q.w / 2)), Math.abs(dy) / ((q.h / 2 - 120) / (q.h / 2)), 0.001);
      const sx = (dx / k) * (q.w / 2), sy = (dy / k) * (q.h / 2);
      x = q.w / 2 + sx; y = q.h / 2 + sy; rot = Math.atan2(dy, dx) - Math.PI / 2;
    }
    el.arrow.style.display = 'block';
    el.arrow.style.left = x + 'px'; el.arrow.style.top = y + 'px';
    el.arrow.style.transform = 'rotate(' + rot + 'rad)';
  } else if (cache.arrowOn !== false) { el.arrow.style.display = 'none'; }
  cache.arrowOn = need;
}
function renderGoal() {
  const g = currentGoal();
  const pr = clamp(g.prog, 0, 1);
  const html = '<small>' + g.label + '</small><p>' + g.text + (g.reward ? ' <span class="rew">+' + g.reward + '</span>' : '') + '</p><div class="bar"><i style="width:' + (pr * 100).toFixed(0) + '%"></i></div>';
  if (cache.goal !== html) { cache.goal = html; el.task.innerHTML = html; el.task.hidden = false; }
}

// ---------- UI: sheets ----------
function openSheet(id) {
  closeSheets(true);
  $(id).hidden = false; modalOpen = true; ptr.down = false;
}
function closeSheets(keep) {
  document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; });
  if (!keep) { modalOpen = false; Plat.maybeMid(); }
  resetArm = false;
}
function openInfo(title, html) {
  $('infoTitle').textContent = title; $('infoBody').innerHTML = html;
  openSheet('shInfo');
}

function fxText(u, s) {
  switch (u.id) {
    case 'radius': return 'Радиус ' + fmt1(s.r) + ' м';
    case 'speed': return 'Скорость ' + fmt1(s.v) + ' м/с';
    case 'cap': return 'Вместимость ' + s.cap;
    case 'comp': return 'Цена пыли ×' + fmt1(s.priceMult);
    case 'robot': return 'Роботов: ' + s.robots;
    case 'rspeed': return 'Скорость роботов ' + fmt1(s.robotV) + ' м/с';
    case 'magnet': return 'Блеск сокровищ с ' + s.hint + ' м';
    default: return '';
  }
}
function effectText(u, maxed) {
  if (u.id === 'tele') return 'Сдавать пыль в любой точке станции';
  if (u.id === 'scanner') return 'Подсвечивает пыль на станции, особенно в конце';
  const a = statsFor(S.lv, false);
  if (maxed) return fxText(u, a);
  const l2 = Object.assign({}, S.lv); l2[u.id] = S.lv[u.id] + 1;
  const b = statsFor(l2, false);
  const A = fxText(u, a), B = fxText(u, b);
  return A + ' → ' + B.replace(/^[^\d×]*/, '');
}
function nodeHTML(u) {
  const lvl = S.lv[u.id], st = canBuy(u), maxed = st === 'max', mx = maxOf(u);
  const cost = costOf(u, lvl);
  let btn;
  if (maxed) btn = '<button class="btn ghost wide" disabled>' + (u.extra && tierNow() < NP - 1 ? 'Больше уровней на новой планете' : 'Максимум') + '</button>';
  else if (st === 'req') { const r = UPG.find(x => x.id === u.req.id); btn = '<button class="btn wide" disabled>Нужно: ' + r.name + ' ур. ' + u.req.lvl + '</button>'; }
  else btn = '<button class="btn wide" data-buy="' + u.id + '"' + (S.coins < cost ? ' disabled' : '') + '>Купить · <span class="coin sm"></span> ' + fmt(cost) + '</button>';
  let pips = '';
  if (mx > 1) { for (let i = 0; i < mx; i++) pips += '<i class="' + (i < lvl ? 'on' : '') + (i >= u.max ? ' x' : '') + '"></i>'; }
  const cls = 'node' + (st === 'req' ? ' locked' : '') + (maxed ? ' max' : '') + (st === 'ok' && S.coins >= cost ? ' ready' : '');
  return '<div class="' + cls + '"><div class="n-top"><div class="n-ico">' + icon(u.icon) + '</div><div><div class="n-name">' + u.name + '</div>' + (pips ? '<div class="pips">' + pips + '</div>' : '') + '</div></div><div class="n-eff">' + effectText(u, maxed) + '</div>' + btn + '</div>';
}
function suitNodeHTML(k) {
  const pl = PLANETS[k], owned = !!S.suits[k], open = suitOpen(k);
  let eff, btn, cls = 'node';
  if (owned) {
    eff = 'Куплен. Дизайн: ' + SUITS[k][S.suitVar[k]].name;
    btn = S.planet === k ? '<button class="btn ghost wide" disabled>Ты здесь</button>' : '<button class="btn teal wide" data-fly="' + k + '">Лететь ' + pl.to + '</button>';
    cls += ' max';
  } else if (open) {
    eff = 'Можно купить и выбрать дизайн';
    btn = '<button class="btn teal wide" data-suit="' + k + '">Выбрать дизайн · ' + fmt(pl.suit) + '</button>';
    if (S.coins >= pl.suit) cls += ' ready';
  } else {
    eff = 'Откроется на 80% станции ' + PLANETS[k - 1].of;
    btn = '<button class="btn wide" disabled>Закрыто</button>';
    cls += ' locked';
  }
  return '<div class="' + cls + '"><div class="n-top"><div class="n-ico">' + icon('suit') + '</div><div><div class="n-name">Скафандр: ' + pl.name + '</div></div></div><div class="n-eff">' + eff + '</div>' + btn + '</div>';
}
function renderTree() {
  const tree = $('tree'), sc = tree.scrollLeft, par = tree.parentNode.scrollTop;
  let h = '';
  for (const b of BRANCHES) {
    h += '<div class="branch"><div class="bh">' + b.name + '</div>';
    if (b.id === 'suit') { for (let k = 1; k < NP; k++) h += suitNodeHTML(k); }
    else for (const u of UPG) if (u.branch === b.id) h += nodeHTML(u);
    h += '</div>';
  }
  tree.innerHTML = h;
  tree.scrollLeft = sc; tree.parentNode.scrollTop = par;
  $('upSub').innerHTML = 'Монет: <b>' + fmt(S.coins) + '</b>';
}

function refreshSheets() {
  if (!$('shUp').hidden) {
    $('upSub').innerHTML = 'Монет: <b>' + fmt(S.coins) + '</b>';
    $('tree').querySelectorAll('[data-buy]').forEach(b => {
      const u = UPG.find(x => x.id === b.getAttribute('data-buy'));
      const off = S.coins < costOf(u, S.lv[u.id]);
      if (b.disabled !== off) b.disabled = off;
      const nd = b.closest('.node'); if (nd) nd.classList.toggle('ready', !off);
    });
  }
  if (!$('shSuit').hidden && !S.suits[suitK]) {
    const b = $('suitBody').querySelector('[data-act="buysuit"]');
    if (b) { const off = S.coins < PLANETS[suitK].suit; if (b.disabled !== off) b.disabled = off; }
  }
}
function suitSVG(p) {
  return '<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Скафандр">' +
    '<ellipse cx="80" cy="192" rx="46" ry="6" fill="rgba(0,0,0,.35)"/>' +
    '<rect x="38" y="84" width="84" height="60" rx="14" fill="' + p.base + '" opacity=".7"/>' +
    '<rect x="50" y="88" width="60" height="64" rx="28" fill="' + p.base + '"/>' +
    '<rect x="50" y="122" width="60" height="9" fill="' + p.band + '"/>' +
    '<rect x="70" y="100" width="20" height="11" rx="3" fill="#16224a"/><rect x="73" y="103" width="14" height="5" rx="2" fill="#38dccb"/>' +
    '<rect x="56" y="150" width="20" height="34" rx="10" fill="' + p.base + '"/><rect x="84" y="150" width="20" height="34" rx="10" fill="' + p.base + '"/>' +
    '<rect x="52" y="176" width="28" height="13" rx="6" fill="' + p.band + '"/><rect x="80" y="176" width="28" height="13" rx="6" fill="' + p.band + '"/>' +
    '<rect x="26" y="96" width="28" height="15" rx="7.5" fill="' + p.base + '" transform="rotate(28 40 103)"/><circle cx="31" cy="118" r="8" fill="' + p.band + '"/>' +
    '<rect x="106" y="96" width="28" height="15" rx="7.5" fill="' + p.base + '" transform="rotate(-28 120 103)"/><circle cx="129" cy="118" r="8" fill="' + p.band + '"/>' +
    '<circle cx="80" cy="58" r="35" fill="' + p.base + '"/>' +
    '<rect x="54" y="44" width="52" height="32" rx="16" fill="#141a3a"/>' +
    '<ellipse cx="69" cy="60" rx="3.6" ry="5.5" fill="#7ff6e8"/><ellipse cx="91" cy="60" rx="3.6" ry="5.5" fill="#7ff6e8"/>' +
    '<rect x="108" y="40" width="8" height="18" rx="4" fill="' + p.accent + '" transform="rotate(25 112 49)"/>' +
    '</svg>';
}
let suitK = 1;
function renderSuit() {
  const k = suitK, owned = !!S.suits[k], v = owned ? S.suitVar[k] : selVariant, pl = PLANETS[k];
  const pal = SUITS[k][v], cost = pl.suit, ok = suitOpen(k);
  $('suitTitle').textContent = 'Скафандр: ' + pl.name;
  $('suitSub').textContent = 'Станция «' + pl.station + '»';
  let sw = '';
  SUITS[k].forEach((s, i) => { sw += '<button class="sw' + (i === v ? ' on' : '') + '" data-variant="' + i + '"' + (owned ? ' disabled' : '') + '><i style="background:linear-gradient(135deg,' + s.base + ' 50%,' + s.band + ' 50%)"></i>' + s.name + '</button>'; });
  let act;
  if (owned) act = S.planet === k ? '<button class="btn ghost wide" disabled>Ты здесь</button>' : '<button class="btn teal wide" data-fly="' + k + '">Лететь ' + pl.to + '</button>';
  else if (!ok) act = '<button class="btn wide" disabled>Откроется на 80% станции ' + PLANETS[k - 1].of + '</button>';
  else act = '<button class="btn teal wide" data-act="buysuit"' + (S.coins < cost ? ' disabled' : '') + '>Купить · <span class="coin sm"></span> ' + fmt(cost) + '</button>';
  $('suitBody').innerHTML = '<div class="suit-grid"><div class="suit-pic">' + suitSVG(pal) + '</div><div><p class="note">' + SUIT_NOTES[k] + '</p><div class="swatches">' + sw + '</div>' + act + '</div></div>';
}
function openSuit(k) { suitK = k; selVariant = S.suitVar[k] || 0; renderSuit(); openSheet('shSuit'); }
function planetSVG(k) {
  const c = [['#c2542b', '#ff8f5a', '#8a3a1e'], ['#c98f5a', '#f3e6cf', '#b5754a'], ['#e2cd92', '#f6ecc9', '#c9ad6a'], ['#2f5fc4', '#5b95f0', '#1c3a8a']][k];
  let s = '<svg viewBox="0 0 80 80" aria-hidden="true"><defs><clipPath id="pc' + k + '"><circle cx="40" cy="40" r="24"/></clipPath></defs>';
  if (k === 2) s += '<ellipse cx="40" cy="40" rx="38" ry="10" fill="none" stroke="#e8d9a8" stroke-width="4" opacity=".7" transform="rotate(-18 40 40)"/>';
  s += '<circle cx="40" cy="40" r="24" fill="' + c[0] + '"/><g clip-path="url(#pc' + k + ')">';
  for (let i = 0; i < 5; i++) s += '<rect x="10" y="' + (20 + i * 9) + '" width="60" height="' + (3 + (i % 2) * 3) + '" fill="' + (i % 2 ? c[1] : c[2]) + '" opacity=".55"/>';
  s += '<circle cx="32" cy="32" r="24" fill="#fff" opacity=".12"/></g>';
  if (k === 2) s += '<path d="M3.9 51.7 A38 10 -18 0 0 76.1 28.3" fill="none" stroke="#e8d9a8" stroke-width="4" opacity=".9" transform="rotate(0)"/>';
  return s + '</svg>';
}
function renderMap() {
  let h = '<div class="pmap">';
  PLANETS.forEach((pl, k) => {
    const owned = !!S.suits[k], here = S.planet === k, pc = Math.floor(planetPct(k) * 100);
    let act;
    if (here) act = '<button class="btn ghost wide" disabled>Ты здесь</button>';
    else if (owned) act = '<button class="btn teal wide" data-fly="' + k + '">Лететь</button>';
    else if (suitOpen(k)) act = '<button class="btn wide" data-suit="' + k + '">Нужен скафандр · ' + fmt(pl.suit) + '</button>';
    else act = '<button class="btn wide" disabled>Откроется на 80% станции ' + PLANETS[k - 1].of + '</button>';
    h += '<div class="pcard' + (here ? ' here' : '') + (owned ? '' : ' locked') + '"><div class="pic">' + planetSVG(k) + (S.P[k].ach ? '<span class="star" title="100%">★</span>' : '') + '</div>' +
      '<div class="pinfo"><b>' + pl.name + '</b><small>Станция «' + pl.station + '»</small><div class="bar"><i style="width:' + (owned ? pc : 0) + '%"></i></div><small>' + (owned ? 'Очищено ' + pc + '% · цена пыли ×' + pl.price : 'Цена пыли ×' + pl.price) + '</small></div>' + act + '</div>';
  });
  $('mapBody').innerHTML = h + '</div>';
}
function renderAch() {
  let h = '<div class="achs">', n = 0;
  for (const a of ACH) {
    const done = !!S.ach[a.id]; if (done) n++;
    const pr = clamp(a.val() / a.need, 0, 1);
    h += '<div class="ach' + (done ? ' done' : '') + '"><div class="n-ico">' + icon('trophy') + '</div><div class="ainfo"><b>' + a.name + '</b><small>' + a.txt + (a.reward ? ' · <span class="rew">+' + fmt(a.reward) + '</span>' : '') + '</small>' +
      (done ? '' : '<div class="bar"><i style="width:' + (pr * 100).toFixed(0) + '%"></i></div>') + '</div></div>';
  }
  $('achBody').innerHTML = h + '</div>';
  $('achSub').textContent = 'Получено ' + n + ' из ' + ACH.length;
}
function renderSettings() {
  $('setBody').innerHTML =
    '<div class="row"><b>Звук</b><button class="btn ' + (S.sound ? 'teal' : 'ghost') + '" data-act="sound">' + (S.sound ? 'Включён' : 'Выключен') + '</button></div>' +
    '<div class="row"><b>Музыка</b><button class="btn ' + (S.music ? 'teal' : 'ghost') + '" data-act="music">' + (S.music ? 'Включена' : 'Выключена') + '</button></div>' +
    '<div class="row"><b>Графика</b><button class="btn ghost" data-act="quality">' + (lowQ ? 'Лёгкая' : 'Красивая') + '</button></div>' +
    '<p class="note">Если на телефоне игра тормозит, выбери «Лёгкая».</p>' +
    '<div class="row"><b>Начать заново</b>' + (resetArm ? '<button class="btn" data-act="reset2">Точно сбросить</button>' : '<button class="btn ghost" data-act="reset1">Сбросить прогресс</button>') + '</div>';
}
// ---------- flying between planets ----------
function travel(k) {
  if (traveling || k === S.planet || !S.suits[k]) return;
  traveling = true; ptr.down = false;
  closeSheets(); $('banner').hidden = true;
  save();
  const from = PL(), to = PLANETS[k], w = $('warp');
  $('warpTxt').textContent = from.name + ' → ' + to.name;
  $('warpSub').textContent = 'Станция «' + to.station + '»';
  w.hidden = false; w.classList.remove('out');
  sfx.warp();
  setTimeout(() => {
    S.planet = k;
    S.bag.n = S.bag.r = S.bag.s = 0;
    try { rebuildWorld(); } catch (e) { console.error(e); }
    save();
    setTimeout(() => {
      w.classList.add('out');
      setTimeout(() => { w.hidden = true; traveling = false; }, 600);
      toast('Добро пожаловать: ' + to.name + '! Цена пыли здесь ×' + to.price, 'gold');
      if (tierNow() > 0 && !S['tierToast' + tierNow()]) { S['tierToast' + tierNow()] = 1; toast('В «Улучшениях» открылись новые уровни'); }
    }, 900);
  }, 700);
}
function rebuildWorld() {
  genDust();
  buildStationScene();
  finalizeWorld();
  buildDust(lowQ ? 1 : 2);
  const pos = PR().pos;
  P.x = pos.x; P.z = pos.z; P.rot = pos.rot;
  camPos.x = P.x; camPos.z = P.z;
  syncRobots(); applyAllLooks();
  recountBlocks(); nearDust = null;
  if (!lowQ) renderer.shadowMap.needsUpdate = true;
  cache.goal = null; cache.pname = null;
  ST = statsFor(S.lv, S.turbo > 0, bonusNow());
  updateCamera(0, true);
  if (renderer.compile) renderer.compile(scene, camera);
}
function setQuality(q) {
  lowQ = q === 'low'; S.quality = q;
  renderer.shadowMap.enabled = !lowQ; sun.castShadow = !lowQ;
  scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); } });
  buildDust(lowQ ? 1 : 2);
  setSize(); save();
}
function resetGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  const q = S.quality, snd = S.sound, mus = S.music;
  S = freshState(); S.quality = q; S.sound = snd; S.music = mus;
  rebuildWorld();
  $('banner').hidden = true; cache.goal = null; el.trophyDot.hidden = true;
  closeSheets(); renderTree(); save();
  toast('Игра начата заново');
}

function onAct(a) {
  switch (a) {
    case 'sound': S.sound = S.sound ? 0 : 1; applySoundSetting(); $('btnSound').classList.toggle('off', !S.sound); drawSoundIcon(); renderSettings(); save(); break;
    case 'music': S.music = S.music ? 0 : 1; renderSettings(); save(); break;
    case 'quality': setQuality(lowQ ? 'high' : 'low'); renderSettings(); break;
    case 'reset1': resetArm = true; renderSettings(); break;
    case 'reset2': resetGame(); break;
    case 'buysuit': buySuit(suitK); break;
    case 'map': renderMap(); openSheet('shMap'); break;
    case 'ach': renderAch(); el.trophyDot.hidden = true; openSheet('shAch'); break;
    case 'b80go': { $('banner').hidden = true; const nx = nextP(); if (nx < 0) break; if (S.suits[nx]) travel(nx); else openSuit(nx); break; }
    case 'b80x': $('banner').hidden = true; break;
    default: break;
  }
}
function drawSoundIcon() {
  $('btnSound').innerHTML = S.sound
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
}

// ---------- input ----------
function bindInput() {
  const cv = $('gl');
  const setP = e => { ptr.x = e.clientX; ptr.y = e.clientY; };
  cv.addEventListener('pointerdown', e => {
    if (!playing || modalOpen || traveling) return;
    ptr.down = true; ptr.id = e.pointerId; setP(e);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    audioInit(); e.preventDefault();
  });
  cv.addEventListener('pointermove', e => { if (ptr.down && e.pointerId === ptr.id) setP(e); });
  const up = e => { if (e.pointerId === ptr.id) ptr.down = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('lostpointercapture', up);
  const kmap = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', e => {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.run = true;
    if (e.code === 'Escape') { closeSheets(); return; }
    if (!playing || modalOpen || traveling) return;
    if (kmap[e.code]) { keys[kmap[e.code]] = true; audioInit(); e.preventDefault(); }
    else if ((e.code === 'KeyT' || e.code === 'Space') && ST.tele && load() > 0) { deposit(); e.preventDefault(); }
    else if (e.code === 'KeyU') { openUpgrades(); }
    else if (e.code === 'KeyM') { onAct('map'); }
  });
  window.addEventListener('keyup', e => {
    if (kmap[e.code]) keys[kmap[e.code]] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.run = false;
  });
  window.addEventListener('blur', () => { keys.up = keys.down = keys.left = keys.right = keys.run = false; runBtn = false; ptr.down = false; });

  $('btnUp').addEventListener('click', openUpgrades);
  const rb = $('btnRun');
  rb.addEventListener('pointerdown', e => { runBtn = true; audioInit(); e.preventDefault(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => rb.addEventListener(n, () => { runBtn = false; }));
  rb.addEventListener('contextmenu', e => e.preventDefault());
  $('btnTele').addEventListener('click', () => { if (load() > 0) deposit(); });
  $('btnSound').addEventListener('click', () => onAct('sound'));
  $('btnMenu').addEventListener('click', () => { renderSettings(); openSheet('shSet'); });
  $('btnAch').addEventListener('click', () => onAct('ach'));
  $('progCard').addEventListener('click', () => { if (playing && !traveling) onAct('map'); });
  $('btnPlay').addEventListener('click', startPlay);
  document.querySelectorAll('.sheet').forEach(s => {
    s.addEventListener('click', e => {
      if (e.target === s || e.target.closest('[data-close]')) { closeSheets(); return; }
      const b = e.target.closest('[data-buy]'); if (b) { buy(b.getAttribute('data-buy')); return; }
      const v = e.target.closest('[data-variant]'); if (v && !S.suits[suitK]) { selVariant = +v.getAttribute('data-variant'); renderSuit(); return; }
      const f = e.target.closest('[data-fly]'); if (f && !f.disabled) { travel(+f.getAttribute('data-fly')); return; }
      const su = e.target.closest('[data-suit]'); if (su && !su.disabled) { openSuit(+su.getAttribute('data-suit')); return; }
      const a = e.target.closest('[data-act]'); if (a && !a.disabled) onAct(a.getAttribute('data-act'));
    });
  });
  $('banner').addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (a) onAct(a.getAttribute('data-act')); });
  window.addEventListener('resize', () => { if (renderer) setSize(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', () => { save(); Plat.flushCloud(); });
  document.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  btnAd.addEventListener('click', () => {
    Plat.extPause = true;
    Plat.rewarded().then(ok => {
      Plat.extPause = false; Plat.lastAd = Date.now();
      if (ok) { S.turbo = Math.max(S.turbo, 120); sfx.treasure(); toast('Турбо за ролик! 120 с', 'gold'); save(); }
    });
  });
}
function openUpgrades() { renderTree(); openSheet('shUp'); }

function startPlay() {
  audioInit();
  $('welcome').hidden = true;
  playing = true;
  if (prevSeen && Date.now() - prevSeen > 6 * 3600 * 1000 && S.task >= TASKS.length) {
    const b = 60 + S.lv.robot * 20;
    S.coins += b; toast('С возвращением! Бонус: +' + b + ' монет', 'gold');
  } else if (!S.stats.collected) {
    toast('Зажми и води по станции, чтобы убирать пыль');
  }
  const nx = nextP();
  if (nx > 0 && !S.suits[nx] && suitOpen(nx) && S.coins >= PLANETS[nx].suit) toast('Хватает монет на скафандр для полёта ' + PLANETS[nx].to, 'gold');
}

// ---------- simulation ----------
function resolveCollisions() {
  for (const c of colliders) {
    const dx = P.x - c.x, dz = P.z - c.z, min = c.r + 0.55, d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.001;
      P.x = c.x + dx / d * min; P.z = c.z + dz / d * min;
    }
  }
  const lim = HALF - 0.9;
  P.x = clamp(P.x, -lim, lim); P.z = clamp(P.z, -lim, lim);
}
function recountBlocks() {
  blockRem.fill(0);
  for (let z = 0; z < G; z++) {
    const row = z * G, br = ((z / BLOCK) | 0) * NB;
    for (let x = 0; x < G; x++) if (cur[row + x]) blockRem[br + ((x / BLOCK) | 0)]++;
  }
}
// nearest dirty cell to (x, z), searched in growing square rings. Cells close to other robots' targets are skipped
// so the helpers spread out; with nothing else left they still take them.
function nearestDust(x, z, skip) {
  const cx = clamp(Math.floor(x + HALF), 0, G - 1), cz = clamp(Math.floor(z + HALF), 0, G - 1);
  let best = -1, bd = Infinity, stopAt = G;
  for (let ring = 0; ring < G && ring <= stopAt; ring++) {
    const x0 = cx - ring, x1 = cx + ring, z0 = cz - ring, z1 = cz + ring;
    for (let zz = z0; zz <= z1; zz++) {
      if (zz < 0 || zz >= G) continue;
      const edge = zz === z0 || zz === z1, step = edge ? 1 : x1 - x0;
      for (let xx = x0; xx <= x1; xx += step || 1) {
        if (xx < 0 || xx >= G || !cur[zz * G + xx]) continue;
        const wx = xx + 0.5 - HALF, wz = zz + 0.5 - HALF;
        if (skip && skip(wx, wz)) continue;
        const d = (wx - x) * (wx - x) + (wz - z) * (wz - z);
        if (d < bd) { bd = d; best = zz * G + xx; stopAt = Math.ceil(ring * 1.42) + 1; }
      }
    }
  }
  return best < 0 ? null : { x: (best % G) + 0.5 - HALF, z: ((best / G) | 0) + 0.5 - HALF };
}
function pickRobotTarget(r) {
  const others = robots.filter(o => o !== r && o.has);
  const skip = (wx, wz) => { for (const o of others) if (Math.abs(o.tx - wx) < 3.5 && Math.abs(o.tz - wz) < 3.5) return true; return false; };
  const t = nearestDust(r.x, r.z, others.length ? skip : null) || (others.length ? nearestDust(r.x, r.z, null) : null);
  r.has = !!t; r.stuck = 0;
  if (t) { r.tx = t.x; r.tz = t.z; }
}
const ROBOT_R = 1.2;
function updateRobots(dt) {
  for (let i = 0; i < robots.length; i++) {
    const r = robots[i];
    // retarget as soon as the target cell is clean (by anyone) instead of wandering to a random spot
    if (r.has ? !cur[clamp(Math.floor(r.tz + HALF), 0, G - 1) * G + clamp(Math.floor(r.tx + HALF), 0, G - 1)] : (r.retarget -= dt) <= 0) { pickRobotTarget(r); r.retarget = 1; }
    if (r.has) {
      const dx = r.tx - r.x, dz = r.tz - r.z, d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const st = Math.min(d, ST.robotV * dt);
        r.x += dx / d * st; r.z += dz / d * st;
        r.m.group.rotation.y += angDiff(r.m.group.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
      }
      const c = vacuumAt(r.x, r.z, ROBOT_R, 100000);
      const got = c.n + c.r + c.s;
      if (got) { const g = valueOf(c); S.coins += g; r.acc += g; S.stats.botCells += got; S.stats.shiny += c.s; r.stuck = 0; }
      else if ((r.stuck += dt) > 3) pickRobotTarget(r);
    } else {
      // nothing left: hover next to the astronaut
      const a = i / Math.max(1, robots.length) * TAU + clock * 0.3, hx = P.x + Math.cos(a) * 3, hz = P.z + Math.sin(a) * 3;
      const dx = hx - r.x, dz = hz - r.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { const st = Math.min(d, ST.robotV * dt); r.x += dx / d * st; r.z += dz / d * st; }
    }
    r.floatT -= dt;
    if (r.floatT <= 0) {
      r.floatT = 2.6;
      if (r.acc >= 1) { floatText(r.x, 2.2, r.z, '+' + fmt(r.acc), 'small'); r.acc = 0; }
    }
  }
}

function gameStep(dt) {
  if (S.turbo > 0) S.turbo = Math.max(0, S.turbo - dt);
  depositCool = Math.max(0, depositCool - dt);
  pickCool = Math.max(0, pickCool - dt);
  let mx = 0, mz = 0, hold = false;
  if (!modalOpen && !traveling) {
    if (ptr.down) {
      hold = true;
      if (groundPoint(ptr.x, ptr.y, _g)) {
        _g.x = clamp(_g.x, -HALF, HALF); _g.z = clamp(_g.z, -HALF, HALF);
        const dx = _g.x - P.x, dz = _g.z - P.z, d = Math.hypot(dx, dz);
        if (d > 0.45) { mx = dx / d; mz = dz / d; }
      }
    }
    const kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), kz = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (kx || kz) { const l = Math.hypot(kx, kz); mx = kx / l; mz = kz / l; hold = true; }
  }
  moving = !!(mx || mz);
  const wantRun = (keys.run || runBtn) && !modalOpen;
  sprinting = moving && wantRun && !exhausted && stam > 0;
  if (sprinting) {
    stam -= STAM.drain * dt; stamDelay = STAM.delay;
    if (stam <= 0) { stam = 0; exhausted = true; sprinting = false; toast('Выдохся: пока иди шагом'); }
  } else {
    stamDelay = Math.max(0, stamDelay - dt);
    if (stamDelay <= 0) stam = Math.min(STAM.max, stam + (moving ? STAM.regenWalk : STAM.regenIdle) * dt);
    if (exhausted && stam >= STAM.back) exhausted = false;
  }
  if (sprinting) {
    puffT -= dt;
    if (puffT <= 0) { puffT = 0.07; spawnPart(1, P.x - Math.sin(P.rot) * 0.5 + (Math.random() - 0.5) * 0.5, 0.15, P.z - Math.cos(P.rot) * 0.5 + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, 1.4, (Math.random() - 0.5) * 0.8, [0.85, 0.65, 0.55], 0.35); }
  }
  if (moving) {
    const spd = ST.v * (sprinting ? STAM.mult : 1);
    P.x += mx * spd * dt; P.z += mz * spd * dt;
    P.rot += angDiff(P.rot, Math.atan2(mx, mz)) * Math.min(1, dt * 14);
    resolveCollisions();
  }
  vacOn = hold; collecting = false;
  const ld = load();
  if (hold) {
    const hx = P.x + Math.sin(P.rot) * 1.3, hz = P.z + Math.cos(P.rot) * 1.3;
    if (ld < ST.cap) {
      const c = vacuumAt(hx, hz, ST.r, ST.cap - ld), got = c.n + c.r + c.s;
      if (got) {
        collecting = true;
        S.bag.n += c.n; S.bag.r += c.r; S.bag.s += c.s; S.stats.collected += got; S.stats.shiny += c.s;
        if (pickCool <= 0) { sfx.pick(); pickCool = 0.09; }
        const k = Math.min(3, got);
        for (let i = 0; i < k; i++) {
          const a = Math.random() * TAU, rr = Math.random() * ST.r;
          const col = c.s > 0 && i === 0 ? [1, 0.84, 0.3] : (c.r > 0 && i === 0 ? [0.5, 0.8, 1] : [0.85, 0.6, 0.45]);
          spawnPart(0, hx + Math.cos(a) * rr, 0.15, hz + Math.sin(a) * rr, 0, 0, 0, col, 0.45);
        }
      }
    }
    for (let i = 0; i < TREASURES.length; i++) {
      if (PR().found[i]) continue;
      const t = TREASURES[i];
      if (Math.hypot(hx - t.x, hz - t.z) < ST.r + 0.8 || Math.hypot(P.x - t.x, P.z - t.z) < 1.2) collectTreasure(i);
    }
  }
  const ld2 = load();
  if (ld2 >= ST.cap && !fullWarned) { fullWarned = true; sfx.full(); }
  if (ld2 < ST.cap * 0.9) fullWarned = false;
  if (!modalOpen && depositCool <= 0 && ld2 > 0 && Math.hypot(P.x - ZONE.x, P.z - ZONE.z) < ZONE.r) deposit();
  setVac(collecting, ST.r * 4);
  syncRobots();
  scanT -= dt;
  if (scanT <= 0) { scanT = 0.6; if (ST.scanner) recountBlocks(); updateScanner(); }
  nearT -= dt;
  if (nearT <= 0) { nearT = 0.5; const rem = total - cleaned; nearDust = (rem > 0 && rem <= Math.max(60, total * 0.03)) ? nearestDust(P.x, P.z, null) : null; }
  updateRobots(dt);
  goalT -= dt;
  if (goalT <= 0) { goalT = 0.3; checkProgress(); renderGoal(); refreshSheets(); }
  autosaveT += dt;
  if (autosaveT > 8) { autosaveT = 0; save(); }
}

function updateScanner() {
  if (!scanPts) return;
  if (!ST.scanner) { scanPts.visible = false; return; }
  scanPts.visible = true;
  const th = pctVal() < 0.8 ? BLOCK * BLOCK * 0.2 : 1;
  const pos = scanPts.geometry.attributes.position.array;
  let n = 0;
  for (let b = 0; b < NB * NB; b++) {
    if (blockRem[b] >= th) {
      pos[n * 3] = (b % NB) * BLOCK + BLOCK / 2 - HALF; pos[n * 3 + 1] = 0.7; pos[n * 3 + 2] = ((b / NB) | 0) * BLOCK + BLOCK / 2 - HALF; n++;
    }
  }
  scanPts.geometry.setDrawRange(0, n);
  scanPts.geometry.attributes.position.needsUpdate = true;
}

function animate(dt) {
  if (!booth || !player) return;
  clock += dt;
  const ld = load(), s = clamp(ld / Math.max(1, ST.cap), 0.04, 1);
  // astronaut
  const walk = moving ? 1 : 0;
  player.phase = (player.phase || 0) + dt * (moving ? (sprinting ? 14 : (exhausted ? 7 : 9)) : 0);
  player.group.position.set(P.x, 0, P.z); player.group.rotation.y = P.rot;
  player.legL.rotation.x = Math.sin(player.phase) * 0.6 * walk;
  player.legR.rotation.x = -Math.sin(player.phase) * 0.6 * walk;
  player.armL.rotation.x = -Math.sin(player.phase) * 0.5 * walk;
  player.body.position.y = Math.abs(Math.sin(player.phase)) * 0.07 * walk;
  player.body.rotation.x += ((sprinting ? 0.2 : (exhausted ? 0.12 : 0)) - player.body.rotation.x) * Math.min(1, dt * 10);
  player.head.rotation.z = Math.sin(clock * 1.6) * 0.03;
  player.sweep.scale.x += (ST.r - player.sweep.scale.x) * Math.min(1, dt * 10);
  player.sweep.position.y = collecting ? 0.02 + Math.sin(clock * 40) * 0.015 : 0;
  player.canister.scale.y = s; player.canister.position.y = 0.8 + 0.28 * s;
  const isFull = ld >= ST.cap;
  if (player.full !== isFull) { player.full = isFull; setLin(player.mats.dust.emissive, isFull ? '#a02a1a' : '#6b3a22'); }
  // robots
  for (const r of robots) {
    r.m.group.position.set(r.x, 0, r.z);
    r.m.body.position.y = 0.9 + 0.12 * Math.sin(clock * 3 + r.ph);
    r.m.brush.rotation.y += dt * 9;
  }
  // booth
  booth.bounce = Math.max(0, booth.bounce - dt * 1.4);
  booth.convTex.offset.x -= dt * (0.15 + booth.bounce * 1.6);
  booth.tank.scale.setScalar(1 + booth.bounce * 0.05);
  const pulse = 0.5 + 0.5 * Math.sin(clock * 2.4);
  booth.ring.material.opacity = 0.55 + 0.4 * pulse;
  booth.disc.material.opacity = 0.08 + 0.1 * pulse;
  // treasure hints
  glints.forEach((g, i) => {
    if (PR().found[i]) { g.material.opacity = 0; return; }
    const t = TREASURES[i], d = Math.hypot(P.x - t.x, P.z - t.z);
    const hint = (S.task === 3 && i === 0 && S.planet === 0) ? 18 : ST.hint;
    if (d < hint) {
      const k = 1 - d / hint;
      g.material.opacity = clamp(0.25 + k, 0, 1) * (0.55 + 0.45 * Math.sin(clock * 4 + i));
      g.scale.setScalar(1.4 + 0.5 * Math.sin(clock * 3 + i));
    } else g.material.opacity = 0;
  });
  if (scanPts && scanPts.visible) scanPts.material.opacity = 0.65 + 0.35 * Math.sin(clock * 4);
  bobbers.forEach((b, i) => { b.position.y = 5.6 + 0.3 * Math.sin(clock * 1.3 + i); });
  geysers.forEach(gz => {
    gz.t += dt;
    const ph = gz.t % 7;
    if (ph < 1.6 && Math.random() < dt * 40) spawnPart(1, gz.x + (Math.random() - 0.5) * 0.8, 0.7, gz.z + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.2, 7 + Math.random() * 4, (Math.random() - 0.5) * 1.2, [0.8, 0.9, 1], 1.6);
  });
  beacons.forEach((m, i) => { m.emissiveIntensity = 0.25 + 1.1 * Math.max(0, Math.sin(clock * 2.2 + i * 1.6)); });
  if (booth.beam) booth.beam.material.opacity = 0.07 + 0.06 * pulse;
  if (motes) {
    const ma = motes.geometry.attributes.position.array;
    for (let i = 0; i < MOTE_N; i++) {
      const d = moteData[i];
      ma[i * 3] = camPos.x + wrapV(d.x + d.vx * clock, -30, 60);
      ma[i * 3 + 1] = wrapV(d.y + d.vy * clock, 0.3, 9);
      ma[i * 3 + 2] = camPos.z + wrapV(d.z + d.vz * clock, -48, 60);
    }
    motes.geometry.attributes.position.needsUpdate = true;
  }
  // pops
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    p.m.position.y = 0.8 + p.t * 2.4; p.m.rotation.y += dt * 6; p.m.scale.setScalar(Math.max(0.01, 1 - p.t / 1.2));
    if (p.t > 1.2) { scene.remove(p.m); pops.splice(i, 1); }
  }
  // particles
  const pa = parts.geometry.attributes.position.array, ca = parts.geometry.attributes.color.array;
  const bx = P.x - Math.sin(P.rot) * 0.6, bz = P.z - Math.cos(P.rot) * 0.6;
  for (let i = 0; i < PARTS_N; i++) {
    const p = pool[i];
    if (p.life > 0) {
      p.life -= dt;
      if (p.mode === 0) {
        const k = 1 - p.life / p.max, e = k * k;
        pa[i * 3] = p.x + (bx - p.x) * e; pa[i * 3 + 1] = p.y + (1.2 - p.y) * e; pa[i * 3 + 2] = p.z + (bz - p.z) * e;
      } else {
        p.vy -= 9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        pa[i * 3] = p.x; pa[i * 3 + 1] = Math.max(0.05, p.y); pa[i * 3 + 2] = p.z;
      }
      ca[i * 3] = p.r; ca[i * 3 + 1] = p.g; ca[i * 3 + 2] = p.b;
    } else { pa[i * 3 + 1] = -50; }
  }
  parts.geometry.attributes.position.needsUpdate = true;
  parts.geometry.attributes.color.needsUpdate = true;
}

function camParams() {
  const a = camera.aspect;
  if (a >= 1) return { H: 11, B: 17, F: 12, fov: 58 };
  const fov = clamp(2 * Math.atan(Math.tan(24 * Math.PI / 180) / a) * 180 / Math.PI, 58, 78);
  return { H: 14, B: 14, F: 6, fov: fov };
}
function updateCamera(dt, snap) {
  const cp = camParams();
  if (Math.abs(camera.fov - cp.fov) > 0.01) { camera.fov = cp.fov; camera.updateProjectionMatrix(); }
  const k = snap ? 1 : 1 - Math.exp(-dt * 6);
  camPos.x += (P.x - camPos.x) * k; camPos.z += (P.z - camPos.z) * k;
  camera.position.set(camPos.x, cp.H, camPos.z + cp.B);
  camera.lookAt(camPos.x, 0, camPos.z - cp.F);
  camera.updateMatrixWorld();
  sun.position.set(P.x - 30, 46, P.z + 26);
  sun.target.position.set(P.x, 0, P.z); sun.target.updateMatrixWorld();
}

let lastTs = 0, heldPrev = false, wantPrev = null;
const btnAd = $('btnAd');
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;
  ST = statsFor(S.lv, S.turbo > 0, bonusNow());
  const hold = Plat.extPause || document.hidden;
  if (hold !== heldPrev) { heldPrev = hold; try { if (AC) { if (hold) AC.suspend(); else AC.resume(); } } catch (e) { /* ignore */ } if (hold) Plat.flushCloud(); }
  const want = playing && !modalOpen && !hold && !traveling;
  if (want !== wantPrev) { wantPrev = want; Plat.gameplay(want); }
  const adShow = Plat.rewardedOK && playing && S.turbo <= 0 && !modalOpen && !traveling;
  if (btnAd.hidden === adShow) btnAd.hidden = !adShow;
  if (playing && !hold && !traveling) gameStep(dt);
  animate(dt);
  updateCamera(dt, false);
  if (eraseQ.length) flushErase();
  updateHUD();
  renderer.render(scene, camera);
}

function init() {
  Plat.installI18n();
  $('btnSound').classList.toggle('off', !S.sound);
  if (typeof THREE === 'undefined') {
    const e = $('loadErr'); e.hidden = false;
    e.textContent = 'Не удалось загрузить 3D-движок. Проверь интернет и обнови страницу.';
    $('btnPlay').hidden = true;
    return;
  }
  loadSave();
  $('btnSound').classList.toggle('off', !S.sound);
  if (('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) $('btnRun').hidden = false;
  prevSeen = S.lastSeen || 0;
  if (!S.quality) S.quality = (/Mobi|Android|iPhone|iPad/.test(navigator.userAgent) && (navigator.hardwareConcurrency || 4) <= 4) ? 'low' : 'high';
  lowQ = S.quality === 'low';
  try { initRenderer(); } catch (err) {
    const e = $('loadErr'); e.hidden = false;
    e.textContent = 'Браузер не смог запустить 3D (WebGL). Попробуй другой браузер или обнови страницу.';
    $('btnPlay').hidden = true;
    return;
  }
  rebuildWorld();
  setSize(); drawSoundIcon(); bindInput();
  updateCamera(0, true);
  renderGoal(); updateHUD();
  if (S.task > 0 || S.stats.collected > 0) $('btnPlay').textContent = 'Продолжить';
  if (Object.keys(S.ach).length === 0) checkAch();
  requestAnimationFrame(frame);
  Plat.installI18n(); Plat.ready();
  if (location.hash === '#debug') window.__d = { S: () => S, P: P, buy: buy, deposit: deposit, vacuumAt: vacuumAt, total: () => total, cleaned: () => cleaned, ptr: ptr, startPlay: startPlay, gameStep: gameStep, dust: () => ({ RES: RES, VX: VX, hv: hv, pos: dustPos, nor: dustNor, col: dustCol, cur: cur, cellT: cellT, G: G }), flush: flushErase, stam: () => ({ v: stam, ex: exhausted, sp: sprinting }), keys: keys, openUpgrades: openUpgrades, onAct: onAct, renderSuit: renderSuit, checkProgress: checkProgress, travel: travel, robots: () => robots, nearestDust: nearestDust, PL: PL, snap: () => { renderer.render(scene, camera); return $('gl').toDataURL('image/png'); }, step: (dt) => { gameStep(dt); animate(dt); updateCamera(dt, false); if (eraseQ.length) flushErase(); updateHUD(); }, cam: updateCamera, el: el, setLook: () => applyAllLooks(), setPct: pct => { const goal = Math.floor(total * pct); for (let i = 0; i < cur.length && cleaned < goal; i++) if (cur[i]) { cur[i] = 0; cleaned++; eraseQ.push(i); } } };
}
Plat.boot().then(init);
