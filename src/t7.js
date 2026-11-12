const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
const stub = fs.readFileSync('three_stub.js', 'utf8');
(async () => {
  const b = await chromium.launch();
  async function run(build, gameUrl, parentUrl) {
    const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/*', r => {
      const u = new URL(r.request().url());
      if (parentUrl && r.request().url() === parentUrl) return r.fulfill({ contentType: 'text/html', body: '<iframe id=f src="' + gameUrl + '" style="width:900px;height:600px"></iframe>' });
      if (u.pathname.endsWith('three.min.js')) return r.fulfill({ contentType: 'application/javascript', body: stub });
      const f = path.join('out', build, path.basename(u.pathname) || 'index.html');
      if (fs.existsSync(f) && !fs.statSync(f).isDirectory()) return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'application/javascript' : 'text/html' });
      if (u.pathname.endsWith('/')) return r.fulfill({ body: fs.readFileSync(path.join('out', build, 'index.html')), contentType: 'text/html' });
      return r.abort();
    });
    await p.goto(parentUrl || gameUrl); await p.waitForTimeout(700);
    const fr = parentUrl ? p.frames()[1] : p.mainFrame();
    const res = await fr.evaluate(() => ({ blocked: /unauthorized|чужом/.test(document.body.innerText), play: !!document.getElementById('btnPlay') && getComputedStyle(document.getElementById('welcome')).display !== 'none' && !/unauthorized|чужом/.test(document.body.innerText) }));
    await ctx.close();
    return JSON.stringify(res) + (errs.length ? ' ERR ' + errs.join('|') : '');
  }
  const T = [
    ['crazygames', 'https://dustronaut.game-files.crazygames.com/dustronaut/1/index.html'],
    ['crazygames', 'https://www.crazygames.com.br/'],
    ['crazygames', 'https://evil-games.com/dustronaut/'],
    ['crazygames', 'http://localhost:8080/'],
    ['crazygames', 'https://evil-cdn.net/game/', 'https://evil-games.com/play'],
    ['yandex', 'https://app-412345.games.s3.yandex.net/412345/abc/index.html'],
    ['yandex', 'https://stolen.ru/game/'],
    ['gamedistribution', 'https://html5.gamedistribution.com/abc123/', 'https://some-partner-site.com/game'],
    ['gamedistribution', 'https://stolen.io/'],
    ['newgrounds', 'https://uploads.ungrounded.net/alternate/1234/index.html'],
    ['gamejolt', 'https://unknown-cdn.example.net/x/', 'https://gamejolt.com/games/dustronaut/1'],
    ['gamejolt', 'https://unknown-cdn.example.net/x/'],
    ['itchio', 'https://html-classic.itch.zone/html/1/index.html'],
    ['poki', 'https://anything.example.com/'],
  ];
  for (const t of T) console.log(t[0].padEnd(17), (t[2] ? t[1] + ' in ' + t[2] : t[1]).padEnd(80), await run(...t));
  // admin console commands still work on the minified itch build
  const ctx = await b.newContext(); const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await p.route('**/*', r => { const u = new URL(r.request().url()); if (u.pathname.endsWith('three.min.js')) return r.fulfill({ contentType: 'application/javascript', body: stub }); const f = path.join('out/itchio', path.basename(u.pathname) || 'index.html'); if (fs.existsSync(f)) return r.fulfill({ body: fs.readFileSync(f), contentType: f.endsWith('.js') ? 'application/javascript' : 'text/html' }); r.abort(); });
  await p.goto('https://html-classic.itch.zone/'); await p.waitForTimeout(500); await p.click('#btnPlay');
  await p.evaluate("S.coins=10000000; S.suits=[1,1,1,1]; UPG.forEach(u=>S.lv[u.id]=maxOf(u)); syncRobots(); travel(3)"); await p.waitForTimeout(3000);
  console.log('admin', await p.evaluate("(p=>{const g=Math.floor(total*p);for(let i=0;i<cur.length&&cleaned<g;i++)if(cur[i]){cur[i]=0;cleaned++;eraseQ.push(i)}})(0.5); JSON.stringify({planet:S.planet,coins:Math.round(S.coins),robots:robots.length,debug:typeof window.__d})"));
  await b.close();
})();
