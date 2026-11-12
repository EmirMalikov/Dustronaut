const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'cfg.js', 'utf8');
const { CFG, UPG, costOf, statsFor } = new Function(src + '\nreturn {CFG,UPG,costOf,statsFor};')();
const N = 19000;
const HUMAN = +(process.argv[3] || 0.8);
const avgPrice = (1 - CFG.mix.rare - CFG.mix.shiny) * CFG.price.n + CFG.mix.rare * CFG.price.r + CFG.mix.shiny * CFG.price.s;
const fresh = p => 0.88 * Math.pow(Math.max(0, 1 - p), 0.75) + 0.10;
function rates(lv, p) {
  const s = statsFor(lv, false);
  const f = fresh(p);
  const c = 2 * s.r * s.v * f * HUMAN;
  const dTrip = 8 + 47 * p;
  const tripT = s.tele ? 3 : 2 * dTrip / s.v + 2;
  const cyc = s.cap / c + tripT;
  const player = s.cap / cyc;
  const bots = s.robots * 2 * 1.0 * s.robotV * f * 0.55;
  return { cells: player + bots, coins: (player + bots) * avgPrice * s.priceMult, player, bots, s };
}
const lv = { radius: 0, speed: 0, cap: 0, comp: 0, tele: 0, robot: 0, rspeed: 0, magnet: 0, scanner: 0, suit: 0 };
let t = 0, p = 0, coins = 0, log = [], marks = {}, bonus = 0;
const lumps = [[0.0, 25], [0.01, 30], [0.02, 40], [0.03, 60], [0.05, 120], [0.12, 350], [0.3, 250], [0.5, 80], [0.25, 120], [0.5, 250]];
let lumpDone = new Set();
function canBuy(u) {
  if (lv[u.id] >= u.max) return false;
  if (u.req && lv[u.req.id] < u.req.lvl) return false;
  if (u.needP && p < u.needP) return false;
  return true;
}
let lastBuyT = 0;
while (t < 3 * 3600 && p < 1) {
  for (let i = 0; i < lumps.length; i++) if (!lumpDone.has(i) && p >= lumps[i][0]) { lumpDone.add(i); coins += lumps[i][1]; }
  const r0 = rates(lv, p);
  // choose purchase
  const cands = UPG.filter(canBuy).filter(u=>p<0.75).map(u => {
    const l2 = Object.assign({}, lv); l2[u.id]++;
    const r1 = rates(l2, p);
    const c = costOf(u, lv[u.id]);
    let gain = (r1.coins - r0.coins);
    if (u.id === 'magnet') gain = u.id === 'magnet' && p < 0.1 ? 0.15 : 0;
    if (u.id === 'scanner') gain = p > 0.5 ? r0.coins * 0.05 : 0;
    if (u.id === 'suit') gain = 1e9;
    return { u, c, score: gain / c };
  }).sort((a, b) => b.score - a.score);
  let bought = null;
  for (let k = 0; k < Math.min(3, cands.length); k++) { if (coins >= cands[k].c) { bought = cands[k]; break; } }
  if (bought && bought.score > 0) {
    coins -= bought.c; lv[bought.u.id]++;
    log.push({ t: Math.round(t), p: +(p * 100).toFixed(1), name: bought.u.id + lv[bought.u.id], c: bought.c, gap: Math.round(t - lastBuyT) });
    lastBuyT = t;
    if (bought.u.id === 'suit') marks.suit = [Math.round(t / 60), +(p * 100).toFixed(1)];
    continue;
  }
  const r = rates(lv, p);
  coins += r.coins; p = Math.min(1, p + r.cells / N); t += 1;
  for (const th of [0.1, 0.25, 0.5, 0.8, 0.9, 0.95, 1]) if (p >= th && !(th in marks)) { marks[th] = Math.round(t / 60 * 10) / 10; if (th===0.8) marks.coinsAt80=Math.round(coins); }
}
console.log('avgPrice', avgPrice.toFixed(2), 'time(min) at p:', JSON.stringify(marks));
console.log('purchases', log.length, 'final coins', Math.round(coins));
const short = log.map(x => `${Math.floor(x.t / 60)}:${String(x.t % 60).padStart(2, '0')} ${x.name} (${x.c}) p${x.p}`);
console.log(short.join('\n'));
