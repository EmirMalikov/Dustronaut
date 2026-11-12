import os, zipfile, re, shutil, json, subprocess
cfg = open('cfg.js').read()
a = open('game_a.js').read().replace('/*@@CFG*/', cfg)
js = open('platform.js').read() + a + open('game_b.js').read() + open('game_b2.js').read() + open('game_c.js').read()
open('game.js', 'w').write(js)
head = open('head.html').read()
# 1) preview / test page (CDN three.js, fonts, #debug hook kept, no site lock)
open('dustronaut.html', 'w').write(head + '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script>\n' + js + '\n</script>\n')
# 2) portal builds: offline, system fonts, own SDK, site lock, debug hook removed, minified
lines = head.split('\n')
body = '\n'.join(l for l in lines if not (l.startswith('<title>') or l.startswith('<meta name="claude') or l.startswith('<link')))
body = body.replace("'Baloo 2', 'Nunito', system-ui, sans-serif", "ui-rounded, 'Arial Rounded MT Bold', 'Trebuchet MS', 'Segoe UI', system-ui, sans-serif").replace("'Nunito', system-ui, sans-serif", "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif")
GD = '''<script src="config.js"></script>
<script>window.GD_OPTIONS={gameId:window.GD_GAME_ID||"",onEvent:function(e){switch(e.name){case"SDK_GAME_PAUSE":Plat.extPause=true;break;case"SDK_GAME_START":Plat.extPause=false;break;}}};
(function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(d.getElementById(id))return;js=d.createElement(s);js.id=id;js.src="https://html5.api.gamedistribution.com/main.min.js";fjs.parentNode.insertBefore(js,fjs);}(document,"script",lid="gamedistribution-jssdk"));</script>'''.replace('lid=', '')
def enc(keys): return [[ord(c) ^ (23 + i) for i, c in enumerate(k)] for k in keys]
# name: (platform id for SDK, sdk tag, site-lock keys or None, strict, shown name)
V = {
    'yandex':           ('yandex', '<script src="/sdk.js"></script>', ['yandex', 'playhop'], 1, 'Yandex Games'),
    'crazygames':       ('crazygames', '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>', ['crazygames'], 1, 'CrazyGames'),
    'poki':             ('poki', '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>', None, 0, 'Poki'),
    'gamedistribution': ('gamedistribution', GD, ['gamedistribution'], 1, 'GameDistribution'),
    'itchio':           ('none', '', None, 0, 'itch.io'),
    'newgrounds':       ('none', '', ['ungrounded', 'newgrounds'], 0, 'Newgrounds'),
    'gamejolt':         ('none', '', ['gamejolt'], 0, 'Game Jolt'),
    'dev':              ('none', '', None, 0, 'dev'),   # local testing only, keeps #debug, not zipped
}
ESB = '/opt/npm-tools/node_modules/esbuild/bin/esbuild'
rel = re.sub(r"\n  if \(location\.hash === '#debug'\) window\.__d = .*\n", "\n", js)
assert rel != js, 'debug hook not found'
shutil.rmtree('out', ignore_errors=True); os.makedirs('out')
three = open('three.min.js', 'rb').read() if os.path.exists('three.min.js') else None
for name, (pid, sdk, keys, strict, shown) in V.items():
    d = 'out/' + name; os.makedirs(d)
    code = js if name == 'dev' else rel
    if keys: code = 'const __L=' + json.dumps({'k': enc(keys), 's': strict, 'n': shown}, separators=(',', ':')) + ';\n' + code
    open(d + '/game.js', 'w').write(code)
    if name != 'dev' and os.path.exists(ESB):
        subprocess.run([ESB, d + '/game.js', '--minify', '--target=es2017', '--legal-comments=none', '--allow-overwrite', '--outfile=' + d + '/game.js', '--log-level=error'], check=True)
    page = '<!doctype html>\n<html lang="ru"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n<title>Dustronaut</title>\n' + sdk + '\n</head><body style="margin:0;background:#0d0b22">\n' + body + '\n<script src="three.min.js"></script>\n<script>window.__PLATFORM__="' + pid + '";</script>\n<script src="game.js"></script>\n</body></html>\n'
    open(d + '/index.html', 'w').write(page)
    if three: open(d + '/three.min.js', 'wb').write(three)
    if name == 'gamedistribution': open(d + '/config.js', 'w').write('// Paste your GameDistribution game ID (from the GD dashboard) between the quotes:\nwindow.GD_GAME_ID = "";\n')
    if name == 'dev': continue
    with zipfile.ZipFile('out/dustronaut_%s.zip' % name, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(os.listdir(d)): zf.write(d + '/' + f, f)
print('built', len(js))
