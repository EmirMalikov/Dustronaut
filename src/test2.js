const { chromium } = require('playwright');
const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('dustronaut.html', 'utf8') + '</body></html>';
const stub = fs.readFileSync('three_stub.js', 'utf8');
const URL = 'https://game.test/index.html';
(async () => {
  const browser = await chromium.launch(); const errs = [];
  async function open(opts) {
    const ctx = await browser.newContext(opts); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    await page.route('**/*', r => { const u = r.request().url();
      if (u.startsWith(URL)) return r.fulfill({ contentType: 'text/html', body: html });
      if (u.includes('three.min.js')) return r.fulfill({ contentType: 'application/javascript', body: stub });
      return r.abort(); });
    await page.goto(URL + '#debug'); await page.waitForTimeout(400); await page.click('#btnPlay'); await page.waitForTimeout(200);
    return { ctx, page };
  }
  // desktop: keyboard
  let { ctx, page } = await open({ viewport: { width: 1280, height: 720 } });
  console.log('run button hidden on desktop:', await page.locator('#btnRun').isHidden());
  const walk = async (shift, ms) => {
    await page.evaluate(() => { window.__d.P.x = 0; window.__d.P.z = -20; });
    await page.keyboard.down('ArrowUp'); if (shift) await page.keyboard.down('Shift');
    const z0 = await page.evaluate(() => window.__d.P.z);
    await page.waitForTimeout(ms);
    const z1 = await page.evaluate(() => window.__d.P.z); const st = await page.evaluate(() => window.__d.stam());
    if (shift) await page.keyboard.up('Shift'); await page.keyboard.up('ArrowUp');
    return { dist: +(z0 - z1).toFixed(1), st };
  };
  const w = await walk(false, 1000); console.log('walk 1s', JSON.stringify(w));
  await page.waitForTimeout(300);
  const s1 = await walk(true, 1000); console.log('sprint 1s', JSON.stringify(s1));
  const hud = await page.evaluate(() => ({ w: document.getElementById('stamFill').style.width, cls: document.getElementById('stam').className }));
  console.log('hud after sprint', JSON.stringify(hud));
  // run to exhaustion
  await page.evaluate(() => { window.__d.P.z = -10; });
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('Shift');
  await page.waitForTimeout(3600);
  const ex = await page.evaluate(() => ({ s: window.__d.stam(), txt: document.getElementById('stamTxt').textContent, cls: document.getElementById('stam').className }));
  console.log('after 3.6s more sprint (exhausted?)', JSON.stringify(ex));
  // still holding shift while exhausted: speed must be normal walk
  await page.evaluate(() => { window.__d.P.x = 0; window.__d.P.z = 0; });
  const z0 = await page.evaluate(() => window.__d.P.z); await page.waitForTimeout(500);
  const z1 = await page.evaluate(() => window.__d.P.z); console.log('exhausted speed m/s', ((z0 - z1) / 0.5).toFixed(1), '(walk is 2.6)');
  await page.screenshot({ path: 'shot_stam_out.png' });
  await page.keyboard.up('Shift'); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(3500);
  console.log('recovered?', JSON.stringify(await page.evaluate(() => window.__d.stam())));
  await page.screenshot({ path: 'shot_stam_ok.png' });
  await page.close(); await ctx.close();
  // touch
  ({ ctx, page } = await open({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true }));
  console.log('run button visible on touch:', await page.locator('#btnRun').isVisible());
  await page.evaluate(() => { const d = window.__d; d.ptr.down = true; d.ptr.x = 195; d.ptr.y = 300; });
  await page.dispatchEvent('#btnRun', 'pointerdown', { pointerType: 'touch', pointerId: 7 });
  await page.waitForTimeout(800);
  console.log('touch sprint', JSON.stringify(await page.evaluate(() => window.__d.stam())));
  await page.dispatchEvent('#btnRun', 'pointerup', { pointerType: 'touch', pointerId: 7 });
  await page.evaluate(() => { window.__d.ptr.down = false; });
  await page.screenshot({ path: 'shot_touch_run.png' });
  await page.close(); await ctx.close();
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})().catch(e => { console.error('TEST FAIL', e); process.exit(1); });
