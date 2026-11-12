const { chromium } = require('playwright');
const fs = require('fs');
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>' + fs.readFileSync('dustronaut.html', 'utf8') + '</body></html>';
const stub = fs.readFileSync('three_stub.js', 'utf8');
const URL = 'https://game.test/index.html';
(async () => {
  const browser = await chromium.launch();
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errs.push('CONSOLE ' + m.text()); });
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(URL)) return route.fulfill({ contentType: 'text/html', body: html });
    if (u.includes('three.min.js')) return route.fulfill({ contentType: 'application/javascript', body: stub });
    return route.abort();
  });
  await page.goto(URL + '#debug');
  await page.waitForTimeout(500);
  await page.click('#btnPlay');
  await page.waitForTimeout(300);
  const res = await page.evaluate(() => {
    const d = window.__d, D = d.dust(), out = {};
    const { RES, VX, hv, pos, nor, col, cur, cellT, G } = D;
    out.RES = RES; out.VX = VX; out.verts = pos.length / 3;
    // all values finite, normals unit length and facing up
    let bad = 0, minLen = 9, maxLen = 0, minNy = 9;
    for (let v = 0; v < VX * VX; v++) {
      const l = Math.hypot(nor[v*3], nor[v*3+1], nor[v*3+2]);
      minLen = Math.min(minLen, l); maxLen = Math.max(maxLen, l); minNy = Math.min(minNy, nor[v*3+1]);
      if (!isFinite(pos[v*3+1]) || !isFinite(col[v*3])) bad++;
    }
    out.bad = bad; out.nlen = [minLen.toFixed(3), maxLen.toFixed(3)]; out.minNy = minNy.toFixed(3);
    // heights: dusty area is above floor, cleared strip (z<-55) is at DEPTH
    const at = (wx, wz) => { const ix = Math.round((wx + 70) * RES), iz = Math.round((wz + 70) * RES); return pos[(iz * VX + ix) * 3 + 1]; };
    out.dusty = at(0, -20).toFixed(3); out.strip = at(0, -60).toFixed(3);
    // clear a patch by vacuum, check heights drop
    const before = at(0, -30);
    d.vacuumAt(0, -30, 2.0, 1000);
    for (let i = 0; i < 5; i++) d.gameStep(0.05);
    d.flush();
    const after = at(0, -30), nb = at(0, -26);
    out.patch = { before: before.toFixed(3), after: after.toFixed(3), far: nb.toFixed(3) };
    // normals near the edge of the hole tilt
    const ix = Math.round((2.0 + 0) * RES) + 70 * RES, iz = Math.round((-30 + 70) * RES);
    const e = (iz * VX + ix) * 3; out.edgeN = [nor[e].toFixed(2), nor[e+1].toFixed(2), nor[e+2].toFixed(2)];
    // 100% -> everything at DEPTH
    d.setPct(1); d.flush();
    // setPct pushes to eraseQ; flush happens in frame, force again
    d.flush();
    let hi = 0; for (let v = 0; v < VX * VX; v++) if (hv[v] > -0.2799) hi++;
    out.leftAbove = hi;
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await page.waitForTimeout(300);
  console.log('ERRORS:', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})();
