// tests for planets, travel, suits, robots, achievements, v1 save migration and English text
const { chromium } = require('playwright');
const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('dustronaut.html', 'utf8') + '</body></html>';
const stub = fs.readFileSync('three_stub.js', 'utf8');
const URL = 'https://game.test/index.html';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const errs = [];
  async function open(viewport, init, lang) {
    const ctx = await browser.newContext({ viewport, locale: lang || 'ru-RU' });
    const page = await ctx.newPage();
    page.on('pageerror', e => { errs.push('PAGEERR ' + e.message); console.log('PAGEERR', e.message, e.stack.split('\n').slice(0,3).join(' | ')); });
    page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u.startsWith(URL)) return route.fulfill({ contentType: 'text/html', body: html });
      if (u.includes('three.min.js')) return route.fulfill({ contentType: 'application/javascript', body: stub });
      return route.abort();
    });
    if (init) await page.addInitScript(init);
    await page.goto(URL + '#debug'); await page.waitForTimeout(500);
    return { ctx, page };
  }
  // 1) migration of a version 1 save (Mars 85%, Jupiter suit bought, gold nozzle)
  const v1 = { coins: 5000, lv: { radius: 3, speed: 2, cap: 4, comp: 1, tele: 1, robot: 2, rspeed: 1, magnet: 1, scanner: 1, suit: 1 }, mask: null, found: [1, 0, 1, 0], task: 4,
    stats: { collected: 9000, deposits: 80, purchases: 20, treasures: 2 }, suit: { variant: 2 }, gold: 0, mile: { m25: 1, m50: 1 }, ach100: 0, banner80: 1, sound: 1, music: 1, turbo: 0, bag: { n: 3, r: 0, s: 0 }, pos: { x: 10, z: 5, rot: 1 } };
  let { ctx, page } = await open({ width: 1280, height: 720 }, 'localStorage.setItem("dustronaut-save-v1", ' + JSON.stringify(JSON.stringify(v1)) + ')');
  let r = await page.evaluate(() => { const S = window.__d.S(); return { ver: S.ver, suits: S.suits, var1: S.suitVar[1], found: S.P[0].found, b80: S.P[0].b80, pos: S.P[0].pos, lvSuit: 'suit' in S.lv, planet: S.planet, ach: S.ach }; });
  console.log('migrated', JSON.stringify(r));
  await page.click('#btnPlay'); await wait(300);
  // 2) travel to Jupiter
  r = await page.evaluate(async () => { const d = window.__d; d.travel(1); await new Promise(r => setTimeout(r, 2600)); const S = d.S(); return { planet: S.planet, name: document.getElementById('pname').textContent, total: d.total(), cleaned: d.cleaned(), warp: document.getElementById('warp').hidden, pos: [d.P.x, d.P.z] }; });
  console.log('jupiter', JSON.stringify(r));
  await page.screenshot({ path: 'shot4_jup.png' });
  // upgrades now have one more level
  await page.click('#btnUp'); await wait(200);
  r = await page.evaluate(() => ({ pips: document.querySelectorAll('#tree .node')[0].querySelectorAll('.pips i').length, suitNodes: [...document.querySelectorAll('#tree .n-name')].filter(n => n.textContent.startsWith('Скафандр')).length }));
  console.log('tree on jupiter', JSON.stringify(r));
  await page.screenshot({ path: 'shot4_tree.png' });
  await page.keyboard.press('Escape');
  // 3) jupiter 80% -> buy saturn suit -> stay -> 100% -> prize
  r = await page.evaluate(async () => {
    const d = window.__d, S = d.S(); S.coins = 100000;
    d.setPct(0.82); await new Promise(r => setTimeout(r, 500));
    const banner = !document.getElementById('banner').hidden;
    d.onAct('b80go'); await new Promise(r => setTimeout(r, 100));
    const suitOpen = !document.getElementById('shSuit').hidden, title = document.getElementById('suitTitle').textContent;
    document.querySelector('[data-variant="1"]').click();
    document.querySelector('[data-act="buysuit"]').click(); await new Promise(r => setTimeout(r, 100));
    const info = document.getElementById('infoBody').innerText;
    document.querySelector('#shInfo [data-close].btn').click();
    d.setPct(1); await new Promise(r => setTimeout(r, 500));
    return { banner, suitOpen, title, suits: S.suits, var2: S.suitVar[2], info, ach: S.P[1].ach, achs: Object.keys(S.ach), infoTitle: document.getElementById('infoTitle').textContent };
  });
  console.log('jupiter done', JSON.stringify(r));
  await page.screenshot({ path: 'shot4_prize.png' });
  await page.keyboard.press('Escape');
  // 4) map + fly saturn via map
  await page.click('#progCard'); await wait(200);
  await page.screenshot({ path: 'shot4_map.png' });
  r = await page.evaluate(() => ({ cards: document.querySelectorAll('.pcard').length, fly: [...document.querySelectorAll('[data-fly]')].map(b => b.getAttribute('data-fly')) }));
  console.log('map', JSON.stringify(r));
  await page.click('.pcard [data-fly="2"]'); await wait(2700);
  r = await page.evaluate(() => { const d = window.__d, S = d.S(); return { planet: S.planet, robots: d.robots().length, total: d.total() }; });
  console.log('saturn', JSON.stringify(r));
  // 5) robots: they must clear a station completely, leaving no dots
  r = await page.evaluate(async () => {
    const d = window.__d, S = d.S();
    S.lv.robot = 6; S.lv.rspeed = 6;
    d.setPct(0.97);
    const t0 = d.cleaned(), total = d.total();
    let steps = 0;
    while (d.cleaned() < total && steps < 20000) { d.step(0.05); steps++; }
    return { robots: d.robots().length, left: total - d.cleaned(), simSeconds: steps * 0.05, cellsFrom: total - t0 };
  });
  console.log('robots sweep', JSON.stringify(r));
  // 6) achievements sheet
  await page.screenshot({ path: 'shot4_sat100.png' });
  await page.keyboard.press('Escape'); await wait(100);
  await page.click('#btnAch'); await wait(200);
  await page.screenshot({ path: 'shot4_ach.png' });
  r = await page.evaluate(() => ({ items: document.querySelectorAll('.ach').length, done: document.querySelectorAll('.ach.done').length, sub: document.getElementById('achSub').textContent }));
  console.log('ach', JSON.stringify(r));
  await page.keyboard.press('Escape');
  // 7) back to Mars keeps Mars progress
  r = await page.evaluate(async () => { const d = window.__d, S = d.S(); d.travel(0); await new Promise(r => setTimeout(r, 2600)); return { planet: S.planet, found: S.P[0].found, pct: document.getElementById('pct').textContent, sat: S.P[2].pct.toFixed(3) }; });
  console.log('back on mars', JSON.stringify(r));
  const saved = await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); return localStorage.getItem('dustronaut-save-v1'); });
  await page.close(); await ctx.close();
  // 8) reload the v2 save on a phone, English
  ({ ctx, page } = await open({ width: 390, height: 780 }, 'localStorage.setItem("dustronaut-save-v1", ' + JSON.stringify(saved) + ')', 'en-US'));
  await page.click('#btnPlay'); await wait(300);
  await page.screenshot({ path: 'shot4_phone_en.png' });
  const cyr = [];
  const grab = async tag => { const t = await page.evaluate(() => document.body.innerText); const m = t.split('\n').filter(l => /[А-Яа-яЁё]/.test(l)); m.forEach(l => cyr.push(tag + ': ' + l)); };
  await grab('hud');
  await page.click('#progCard'); await wait(200); await grab('map'); await page.screenshot({ path: 'shot4_phone_map.png' }); await page.keyboard.press('Escape');
  await page.click('#btnUp'); await wait(200); await grab('tree'); await page.keyboard.press('Escape');
  await page.click('#btnAch'); await wait(200); await grab('ach'); await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__d.S().coins = 999999; }); await wait(400);
  await page.evaluate(() => window.__d.onAct('map')); await page.click('[data-suit="3"]').catch(() => {}); await wait(200); await grab('suit');
  await page.evaluate(() => document.querySelector('[data-act="buysuit"]') && document.querySelector('[data-act="buysuit"]').click()); await wait(200); await grab('suitbought');
  await page.screenshot({ path: 'shot4_phone_suit.png' });
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__d.travel(3)); await wait(600); await grab('warp'); await wait(2200);
  await page.evaluate(async () => { window.__d.setPct(0.85); await new Promise(r => setTimeout(r, 500)); }); await grab('nep80');
  await page.evaluate(async () => { window.__d.setPct(1); await new Promise(r => setTimeout(r, 500)); }); await grab('nep100');
  console.log('cyrillic left in EN:', cyr.length ? '\n' + cyr.join('\n') : 'none');
  await page.close(); await ctx.close();
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
