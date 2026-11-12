const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = '/home/claude/dn/src/out/itchio';
const [planet, out, x0, z0] = [+process.argv[2], process.argv[3], +process.argv[4], +process.argv[5]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 360 }, locale: 'en-US' })).newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/*', r => { const u = new URL(r.request().url()); const f = path.join(dir, u.pathname === '/' ? 'index.html' : u.pathname); if (fs.existsSync(f)) return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'application/javascript' : 'text/html' }); return r.abort(); });
  await p.addInitScript(() => {
    const real = window.requestAnimationFrame.bind(window); window.__hold = true;
    window.requestAnimationFrame = f => window.__hold ? 1 : real(f);
    localStorage.setItem('dustronaut-save-v1', JSON.stringify({ ver: 2, task: 4, coins: 18250, quality: 'high', sound: 0, music: 0,
      lv: { radius: 4, speed: 2, cap: 6, comp: 2, tele: 1, robot: 3, rspeed: 2, magnet: 1, scanner: 0 }, suits: [1, 1, 1, 1], suitVar: [0, 0, 1, 1],
      stats: { collected: 4000, deposits: 40, purchases: 20, treasures: 3 }, ach: { c1k: 1 } }));
  });
  await p.goto('https://g.test/index.html#debug'); await new Promise(r => setTimeout(r, 4000));
  await p.evaluate(async ([k, x, z]) => {
    document.getElementById('btnPlay').click();
    const d = window.__d;
    if (k) { d.travel(k); await new Promise(r => setTimeout(r, 3300)); }
    d.P.x = x; d.P.z = z; d.P.rot = Math.PI;
    for (let i = 0; i < 40; i++) d.step(1 / 15);   // let robots spread out
    d.cam(0, true);
  }, [planet, x0, z0]);
  // path: up, turn right, down, turn right, up (serpentine)
  const plan = []; const seg = (dir, n) => { for (let i = 0; i < n; i++) plan.push(dir); };
  seg('up', 30); seg('right', 6); seg('down', 30); seg('right', 6); seg('up', 18);
  for (let i = 0; i < plan.length; i++) {
    const img = await p.evaluate(dir => {
      const d = window.__d, k = d.keys; k.up = k.down = k.left = k.right = false; k[dir] = true;
      d.step(1 / 15); if (d.S().bag.n > 150) d.S().bag.n = 0;
      return d.snap();
    }, plan[i]);
    fs.writeFileSync('/home/claude/dn/frames/' + out + '_' + String(i).padStart(3, '0') + '.png', Buffer.from(img.split(',')[1], 'base64'));
  }
  await b.close(); console.log('frames', plan.length);
})();
