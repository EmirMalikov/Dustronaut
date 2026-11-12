const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = '/home/claude/dn/src/out/itchio', OUT = '/home/claude/dn/promo/';
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, locale: process.argv[2] || 'en-US' });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/*', r => { const u = new URL(r.request().url()); const f = path.join(dir, u.pathname === '/' ? 'index.html' : u.pathname); if (fs.existsSync(f)) return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'application/javascript' : 'text/html' }); return r.abort(); });
  await p.addInitScript(() => {
    const real = window.requestAnimationFrame.bind(window); let q = [];
    window.__hold = true;
    window.requestAnimationFrame = f => { if (window.__hold) { q.push(f); return 1; } return real(f); };
    window.__release = () => { const a = q; q = []; a.forEach(f => real(f)); };
    localStorage.setItem('dustronaut-save-v1', JSON.stringify({ ver: 2, task: 4, coins: 48250, quality: 'high', sound: 0, music: 0,
      lv: { radius: 4, speed: 3, cap: 6, comp: 2, tele: 1, robot: 3, rspeed: 2, magnet: 1, scanner: 0 }, suits: [1, 1, 1, 1], suitVar: [0, 0, 1, 1],
      stats: { collected: 4000, deposits: 40, purchases: 20, treasures: 3, shiny: 50, fullBags: 5, botCells: 900 }, ach: { c1k: 1 } }));
  });
  await p.goto('https://g.test/index.html#debug');
  await wait(4000);
  await p.evaluate(() => { document.getElementById('btnPlay').click(); });
  const shoot = async (name, k, opts) => {
    await p.evaluate(async ([k, o]) => {
      const d = window.__d, S = d.S();
      if (S.planet !== k) { d.travel(k); await new Promise(r => setTimeout(r, 3300)); }
      S.coins = o.coins || 48250;
      // walk a few lanes so the dust shows clean trails, robots work nearby
      d.P.x = o.x; d.P.z = o.z; d.P.rot = Math.PI;
      for (let lane = 0; lane < o.lanes; lane++) {
        d.keys.up = lane % 2 === 0; d.keys.down = lane % 2 === 1;
        for (let i = 0; i < o.len; i++) { d.step(1 / 30); if (d.S().bag.n > 200) d.S().bag.n = 0; }
        d.keys.up = d.keys.down = false; d.keys.right = true;
        for (let i = 0; i < 18; i++) d.step(1 / 30);
        d.keys.right = false;
      }
      d.keys.left = true; for (let i = 0; i < 10; i++) d.step(1 / 30); d.keys.left = false;
      d.ptr.down = false;
      for (let i = 0; i < 8; i++) d.step(1 / 30);
      document.getElementById('toasts').innerHTML = '';
      document.getElementById('banner').hidden = true;
      d.cam(0, true);
    }, [k, opts]);
    await p.evaluate(() => { const d = window.__d; d.snap(); });
    await p.screenshot({ path: OUT + name + '_hud.png', timeout: 120000 });
    // cinematic angle without HUD
    const img = await p.evaluate(([a]) => {
      const d = window.__d;
      camera.fov = a.fov; camera.updateProjectionMatrix();
      camera.position.set(d.P.x + a.cx, a.cy, d.P.z + a.cz);
      camera.lookAt(d.P.x + a.lx, a.ly, d.P.z + a.lz);
      camera.updateMatrixWorld();
      return d.snap();
    }, [opts.cin]);
    fs.writeFileSync(OUT + name + '_hero.png', Buffer.from(img.split(',')[1], 'base64'));
    await p.evaluate(() => window.__d.cam(0, true));
    console.log('shot', name);
  };
  const cin = { fov: 50, cx: -9, cy: 6.5, cz: 13, lx: 2, ly: 1.5, lz: -10 };
  await shoot('mars', 0, { x: -10, z: 20, lanes: 3, len: 70, cin });
  await shoot('jupiter', 1, { x: 6, z: 18, lanes: 3, len: 70, cin: { fov: 52, cx: 10, cy: 7, cz: 14, lx: -6, ly: 4, lz: -12 } });
  await shoot('saturn', 2, { x: -4, z: 22, lanes: 3, len: 70, cin: { fov: 52, cx: -11, cy: 6, cz: 12, lx: 6, ly: 5, lz: -12 } });
  await shoot('neptune', 3, { x: 4, z: 20, lanes: 3, len: 70, cin: { fov: 52, cx: -10, cy: 6.5, cz: 13, lx: 6, ly: 5, lz: -12 } });
  await b.close();
})();
