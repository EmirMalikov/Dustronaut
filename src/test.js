const { chromium } = require('playwright');
const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('dustronaut.html', 'utf8') + '</body></html>';
const stub = fs.readFileSync('three_stub.js', 'utf8');
const URL = 'https://game.test/index.html';
(async () => {
  const browser = await chromium.launch();
  const errs = [];
  async function open(viewport, init) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
    await page.route('**/*', route => {
      const u = route.request().url();
      if (u === URL || u === URL + '#debug') return route.fulfill({ contentType: 'text/html', body: html });
      if (u.includes('three.min.js')) return route.fulfill({ contentType: 'application/javascript', body: stub });
      return route.abort();
    });
    if (init) await page.addInitScript(init);
    return { ctx, page };
  }
  let { ctx, page } = await open({ width: 1280, height: 720 });
  await page.goto(URL + '#debug');
  await page.waitForTimeout(500);
  console.log('welcome visible:', await page.locator('#welcome').isVisible());
  await page.screenshot({ path: 'shot_welcome.png' });
  await page.click('#btnPlay');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const d = window.__d, out = {};
    out.total = d.total(); out.pos = [d.P.x, d.P.z];
    // collect dust near start with the player's sweeper
    for (let i = 0; i < 20; i++) { d.P.x = 0; d.P.z = -43 + i * 0.1; d.vacuumAt(0, -42 + i * 0.3, 0.65, 100); }
    return out;
  });
  console.log('init', JSON.stringify(r));
  // drive the real game loop: hold pointer to move and collect
  const res = await page.evaluate(async () => {
    const d = window.__d, S = d.S();
    d.ptr.down = true; d.ptr.x = 640; d.ptr.y = 400;
    await new Promise(r => setTimeout(r, 1500));
    d.ptr.down = false;
    return { collected: S.stats.collected, bag: S.bag, pos: [d.P.x.toFixed(1), d.P.z.toFixed(1)] };
  });
  console.log('after hold', JSON.stringify(res));
  // go to the zone and deposit
  const dep = await page.evaluate(async () => {
    const d = window.__d, S = d.S();
    S.bag.n = 30; d.P.x = 0; d.P.z = -52;
    await new Promise(r => setTimeout(r, 400));
    return { coins: S.coins, deposits: S.stats.deposits, bag: S.bag.n, task: S.task };
  });
  console.log('deposit', JSON.stringify(dep));
  // economy: buy things
  const eco = await page.evaluate(() => {
    const d = window.__d, S = d.S(); S.coins = 100000;
    const before = JSON.stringify(S.lv);
    ['cap','radius','speed','comp','robot','rspeed','tele','scanner','magnet','cap','cap'].forEach(id => d.buy(id));
    return { before, after: JSON.stringify(S.lv), coins: S.coins, purchases: S.stats.purchases };
  });
  console.log('buy', JSON.stringify(eco));
  await page.waitForTimeout(800);
  await page.click('#btnUp');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot_upgrades.png' });
  console.log('tree nodes:', await page.locator('.node').count(), 'buy buttons:', await page.locator('[data-buy]').count());
  await page.keyboard.press('Escape');
  // progress to 80% and 100%
  const pr = await page.evaluate(async () => {
    const d = window.__d, S = d.S(); const out = {};
    d.setPct(0.6); await new Promise(r => setTimeout(r, 500)); out.m25 = S.mile.m25; out.m50 = S.mile.m50;
    d.setPct(0.81); await new Promise(r => setTimeout(r, 600));
    out.b80 = S.banner80; out.bannerVisible = !document.getElementById('banner').hidden;
    return out;
  });
  console.log('progress', JSON.stringify(pr));
  await page.screenshot({ path: 'shot_80.png' });
  await page.click('[data-act="b80go"]');
  await page.waitForTimeout(200);
  console.log('suit sheet open:', await page.locator('#shSuit').isVisible());
  await page.screenshot({ path: 'shot_suit.png' });
  const buyS = await page.evaluate(async () => {
    const d = window.__d, S = d.S(); S.coins = 5000;
    return { ok: !!document.querySelector('[data-act="buysuit"]') };
  });
  console.log('suit buy button', JSON.stringify(buyS));
  await page.click('[data-variant="2"]');
  await page.click('[data-act="buysuit"]');
  await page.waitForTimeout(300);
  console.log('suit state:', JSON.stringify(await page.evaluate(() => ({ lv: window.__d.S().lv.suit, v: window.__d.S().suit.variant, coins: window.__d.S().coins }))));
  await page.screenshot({ path: 'shot_suit_done.png' });
  await page.keyboard.press('Escape');
  const full = await page.evaluate(async () => {
    const d = window.__d, S = d.S(); d.setPct(1); await new Promise(r => setTimeout(r, 700));
    return { ach: S.ach100, gold: S.gold, pct: document.getElementById('pct').textContent };
  });
  console.log('100%', JSON.stringify(full));
  // save and reload
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const saved = await page.evaluate(() => { const s = localStorage.getItem('dustronaut-save-v1'); return s ? s.length : 0; });
  console.log('save bytes', saved);
  const ls = await page.evaluate(() => localStorage.getItem('dustronaut-save-v1'));
  await page.close(); await ctx.close();

  // reload with the save, phone viewport
  ({ ctx, page } = await open({ width: 390, height: 780 }, 'localStorage.setItem("dustronaut-save-v1", ' + JSON.stringify(ls) + ')'));
  await page.goto(URL + '#debug');
  await page.waitForTimeout(500);
  console.log('continue label:', await page.textContent('#btnPlay'));
  await page.screenshot({ path: 'shot_phone_welcome.png' });
  await page.click('#btnPlay');
  await page.waitForTimeout(600);
  const rl = await page.evaluate(() => { const d = window.__d, S = d.S(); return { lv: JSON.stringify(S.lv), cleaned: d.cleaned(), total: d.total(), pct: document.getElementById('pct').textContent, coins: document.getElementById('coins').textContent }; });
  console.log('reloaded', JSON.stringify(rl));
  await page.screenshot({ path: 'shot_phone_hud.png' });
  await page.click('#btnUp'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'shot_phone_upgrades.png' });
  await page.keyboard.press('Escape');
  await page.click('#btnMenu'); await page.waitForTimeout(200);
  await page.screenshot({ path: 'shot_phone_settings.png' });
  await page.close(); await ctx.close();
  console.log('renders happened:', 'ok');
  console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
