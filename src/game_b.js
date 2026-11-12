
// ---------- 3D scene ----------
let renderer, scene, camera, sun, hemi;
let player = null;          // {group, legL, legR, armR, head, canister, mats, ...}
let booth = null;           // {convTex, zoneRing, bounce}
let robots = [];
let glints = [];            // treasure sprites
let scanPts = null, scanCount = 0;
let parts = null;           // particle pool
const PARTS_N = 140;
const pool = [];
let lowQ = false;

function mat(color, rough, extra) {
  return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: rough == null ? 0.6 : rough, metalness: 0.05 }, extra || {}));
}
function mesh(geo, material, x, y, z, parent, shadow) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x || 0, y || 0, z || 0);
  if (shadow !== false) m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

function initRenderer() {
  const canvas = $('gl');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !lowQ, powerPreference: 'high-performance' });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = !lowQ;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  camera = new THREE.PerspectiveCamera(48, 1, 0.5, 1600);
}
function buildLights() {
  const th = TH();
  scene = new THREE.Scene();
  scene.background = linC(th.sky);
  scene.fog = new THREE.Fog(linC(th.fog), 130, 460);
  hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], 0.8);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(th.sunC, 1.05);
  sun.position.set(-30, 46, 26);
  sun.castShadow = !lowQ;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 5; sc.far = 140;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
}

function buildSky() {
  // stars
  const n = 1800, pos = new Float32Array(n * 3), rng = mulberry32(99);
  for (let i = 0; i < n; i++) {
    const u = rng() * TAU, v = Math.acos(2 * rng() - 1), r = 900;
    pos[i * 3] = r * Math.sin(v) * Math.cos(u);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(v)) * 0.8 + 20;
    pos[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, fog: false })));

  // distant sun with glow
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff4d6, fog: false }));
  sunMesh.position.set(-300, 62, -560);
  scene.add(sunMesh);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex('rgba(255,236,190,1)', 'rgba(255,170,90,.35)', false), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  glow.scale.set(260, 260, 1); glow.position.copy(sunMesh.position);
  scene.add(glow);

  buildBigPlanet();
}
function bandTex(cols, spot, seed) {
  const c = makeCanvas(512, 256), ctx = c.getContext('2d'), r = mulberry32(seed);
  let y = 0;
  while (y < 256) {
    const h = 6 + r() * 22;
    ctx.fillStyle = cols[(r() * cols.length) | 0]; ctx.fillRect(0, y, 512, h + 1);
    y += h;
  }
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.04 + r() * 0.08) + ')';
    ctx.beginPath(); ctx.ellipse(r() * 512, r() * 256, 20 + r() * 60, 2 + r() * 4, 0, 0, TAU); ctx.fill();
  }
  if (spot) {
    ctx.fillStyle = spot[0]; ctx.beginPath(); ctx.ellipse(spot[1] * 512, spot[2] * 256, spot[3], spot[3] * 0.55, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  return t;
}
function buildBigPlanet() {
  const kind = TH().big;
  let tex, rad = 95, pos = [250, 72, -560], haloC = ['rgba(140,200,255,.9)', 'rgba(90,150,255,.25)'], ring = null, tilt = 0;
  if (kind === 'earth') {
    const c = makeCanvas(256, 128), ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, '#2c6fb8'); gr.addColorStop(0.5, '#3f95d6'); gr.addColorStop(1, '#2a5f9e');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 128);
    const r2 = mulberry32(5);
    for (let i = 0; i < 36; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + r2() * 0.35) + ')';
      ctx.beginPath(); ctx.ellipse(r2() * 256, r2() * 128, 10 + r2() * 30, 3 + r2() * 8, 0, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(90,160,90,.7)';
      ctx.beginPath(); ctx.ellipse(r2() * 256, 25 + r2() * 80, 8 + r2() * 20, 5 + r2() * 10, 0, 0, TAU); ctx.fill();
    }
    tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
  } else if (kind === 'jupiter') {
    tex = bandTex(['#e9d3b0', '#c98f5a', '#f3e6cf', '#b5754a', '#dcb88a', '#a8683f'], ['#c8553a', 0.62, 0.64, 46], 12);
    rad = 230; pos = [180, 140, -620]; haloC = ['rgba(255,210,160,.8)', 'rgba(220,140,80,.22)']; tilt = 0.08;
  } else if (kind === 'saturn') {
    tex = bandTex(['#f1e3b8', '#e2cd92', '#d6bd7e', '#f6ecc9', '#c9ad6a'], null, 33);
    rad = 120; pos = [210, 110, -580]; haloC = ['rgba(255,236,180,.8)', 'rgba(220,190,120,.2)']; ring = true; tilt = 0.42;
  } else {
    tex = bandTex(['#3a6ed8', '#2f5fc4', '#4a86e8', '#2a52b0', '#5b95f0'], ['#1c3a8a', 0.4, 0.55, 30], 71);
    rad = 170; pos = [220, 120, -600]; haloC = ['rgba(150,190,255,.9)', 'rgba(70,110,255,.28)'];
  }
  const planet = new THREE.Mesh(new THREE.SphereGeometry(rad, 40, 28), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  planet.position.set(pos[0], pos[1], pos[2]); planet.rotation.z = tilt; planet.rotation.y = -0.6;
  scene.add(planet);
  if (ring) {
    const c = makeCanvas(512, 8), ctx = c.getContext('2d'), r = mulberry32(9);
    for (let x = 0; x < 512; x++) {
      const k = x / 512, a = (k < 0.08 || (k > 0.55 && k < 0.6)) ? 0.05 : 0.35 + r() * 0.5;
      ctx.fillStyle = 'rgba(' + (220 + r() * 30 | 0) + ',' + (200 + r() * 30 | 0) + ',' + (150 + r() * 40 | 0) + ',' + a + ')'; ctx.fillRect(x, 0, 1, 8);
    }
    const rt = new THREE.CanvasTexture(c); rt.encoding = THREE.sRGBEncoding;
    const g = new THREE.RingGeometry(rad * 1.3, rad * 2.3, 96, 1);
    const pa = g.attributes.position, uv = g.attributes.uv, v3 = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) { v3.fromBufferAttribute(pa, i); uv.setXY(i, (v3.length() - rad * 1.3) / (rad * 1.0), 0.5); }
    const rm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    rm.position.copy(planet.position); rm.rotation.set(-1.18, 0.15, 0.38);
    scene.add(rm);
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(haloC[0], haloC[1], false), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  halo.scale.set(rad * 3.5, rad * 3.5, 1); halo.position.copy(planet.position);
  scene.add(halo);
  if (kind === 'jupiter') {
    // two little moons
    [[-200, 160, -520, 9, '#e8d9a8'], [-90, 210, -560, 6, '#c9b8a8']].forEach(m => {
      const mm = new THREE.Mesh(new THREE.SphereGeometry(m[3], 16, 12), new THREE.MeshBasicMaterial({ color: m[4], fog: false }));
      mm.position.set(m[0], m[1], m[2]); scene.add(mm);
    });
  }
}

function buildGround() {
  const th = TH(), pid = PL().id;
  const terr = new THREE.Mesh(new THREE.CircleGeometry(900, 56), pid === 'jup' ? new THREE.MeshBasicMaterial({ map: bandTex(['#d9b48a', '#c98f5a', '#e9d3b0', '#b5754a'], null, 4), color: '#ffffff' }) : mat(th.ground, 1));
  terr.rotation.x = -Math.PI / 2; terr.position.y = th.groundY; terr.receiveShadow = true;
  scene.add(terr);
  const rng = mulberry32(31 + S.planet * 7);
  if (pid === 'jup') {
    // a cloud sea far below the floating platform, with puffy clouds and support legs
    const cm = new THREE.MeshLambertMaterial({ color: '#f3e2c8', transparent: true, opacity: 0.85 });
    for (let i = 0; i < 46; i++) {
      const a = rng() * TAU, d = HALF * 1.2 + rng() * 380, r = 8 + rng() * 22;
      const cl = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), cm);
      cl.scale.y = 0.35; cl.position.set(Math.cos(a) * d, th.groundY + 2 + rng() * 8, Math.sin(a) * d);
      scene.add(cl);
    }
    const legM = mat('#6a5a72', 0.7);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => {
      mesh(new THREE.CylinderGeometry(3, 5, 26, 10), legM, c[0] * (HALF - 12), -13, c[1] * (HALF - 12), scene, false);
      mesh(new THREE.SphereGeometry(4.5, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffd9a0', emissive: '#ff9a40', emissiveIntensity: 1 }), c[0] * (HALF - 12), -27, c[1] * (HALF - 12), scene, false);
    });
  }
  const hillN = pid === 'jup' ? 0 : 18;
  // low, distant dunes only: nothing tall near the platform so the view stays open
  for (let i = 0; i < hillN; i++) {
    const a = rng() * TAU, d = 420 + rng() * 380, r = 40 + rng() * 70, h = 5 + rng() * 12;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(th.hill[0] + rng() * 0.03, th.hill[1], th.hill[2] + rng() * 0.08), roughness: 1, flatShading: true }));
    hill.position.set(Math.cos(a) * d, -1.6 + h / 2, Math.sin(a) * d);
    hill.rotation.y = rng() * 3;
    scene.add(hill);
  }
  for (let i = 0; i < hillN * 2.2; i++) {
    const a = rng() * TAU, d = HALF * 1.5 + rng() * 150, r = 1.5 + rng() * 3.5;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: th.rock, roughness: pid === 'mars' ? 1 : 0.5, flatShading: true }));
    rock.position.set(Math.cos(a) * d, -1.2 + r * 0.3, Math.sin(a) * d);
    rock.scale.y = 0.6; rock.rotation.set(rng(), rng() * 3, rng());
    scene.add(rock);
  }
  // platform
  const plat = new THREE.Mesh(new THREE.BoxGeometry(G, 1.5, G), mat(th.plat, 0.8));
  plat.position.y = -0.75; plat.receiveShadow = true;
  scene.add(plat);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(G, G), new THREE.MeshStandardMaterial({ map: paintFloor(), roughness: 0.55, metalness: 0.08 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; floor.receiveShadow = true;
  scene.add(floor);
  dustMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: grainTex() });
  dustMesh = new THREE.Mesh(new THREE.BufferGeometry(), dustMat);
  dustMesh.receiveShadow = true; dustMesh.frustumCulled = false;
  scene.add(dustMesh);
  // glowing rim
  const rimMat = new THREE.MeshStandardMaterial({ color: th.rim[0], emissive: th.rim[1], emissiveIntensity: 0.9, roughness: 0.4 });
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(G + 1, 0.3, 0.5), rimMat, 0, 0.15, s * (HALF + 0.25), scene, false);
    mesh(new THREE.BoxGeometry(0.5, 0.3, G + 1), rimMat, s * (HALF + 0.25), 0.15, 0, scene, false);
  }
}

let ACC = '#ff8f5a';
// ----- props -----
function propCrate(x, z, s, rotY) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY || 0;
  mesh(new THREE.BoxGeometry(s, s * 0.8, s), mat('#dfe3ef', 0.5), 0, s * 0.4, 0, g);
  mesh(new THREE.BoxGeometry(s * 1.02, s * 0.12, s * 1.02), mat(ACC, 0.5), 0, s * 0.62, 0, g);
  mesh(new THREE.BoxGeometry(s * 1.02, s * 0.12, s * 1.02), mat(ACC, 0.5), 0, s * 0.18, 0, g);
  scene.add(g); colliders.push({ x: x, z: z, r: s * 0.78 });
}
function propLamp(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  mesh(new THREE.CylinderGeometry(0.16, 0.22, 3.6, 10), mat('#c9cfe0', 0.5), 0, 1.8, 0, g);
  mesh(new THREE.SphereGeometry(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff3c9', emissive: '#ffd98a', emissiveIntensity: 1.2 }), 0, 3.8, 0, g, false);
  scene.add(g); colliders.push({ x: x, z: z, r: 0.5 });
}
function propSolar(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  for (let i = -1; i <= 1; i++) {
    const post = mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.6, 8), mat('#c9cfe0', 0.5), i * 2.6, 0.8, 0, g);
    post.castShadow = true;
    const panel = mesh(new THREE.BoxGeometry(2.3, 0.1, 3.0), new THREE.MeshStandardMaterial({ color: '#2a4f9e', roughness: 0.3, metalness: 0.4 }), i * 2.6, 2.0, 0, g);
    panel.rotation.x = -0.5;
    mesh(new THREE.BoxGeometry(2.4, 0.14, 0.12), mat('#e9edf7', 0.5), i * 2.6, 2.05, 1.35, g, false).rotation.x = -0.5;
  }
  scene.add(g); colliders.push({ x: x, z: z, r: 4.2 });
}
function propDome(x, z, r) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  mesh(new THREE.SphereGeometry(r, 28, 14, 0, TAU, 0, Math.PI / 2), mat('#eef0f7', 0.4), 0, 0, 0, g);
  mesh(new THREE.TorusGeometry(r * 0.98, 0.35, 8, 36), mat(ACC, 0.5), 0, 0.25, 0, g, false).rotation.x = Math.PI / 2;
  const win = new THREE.MeshStandardMaterial({ color: '#bfeaff', emissive: '#6fd3ff', emissiveIntensity: 0.7, roughness: 0.2 });
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU, w = mesh(new THREE.BoxGeometry(1.6, 1.1, 0.3), win, Math.cos(a) * r * 0.93, r * 0.38, Math.sin(a) * r * 0.93, g, false);
    w.rotation.y = -a + Math.PI / 2; w.rotation.x = -0.35;
  }
  scene.add(g); colliders.push({ x: x, z: z, r: r + 0.4 });
}
function propTank(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const body = mesh(new THREE.CylinderGeometry(1.9, 1.9, 5.4, 22), mat('#f0f2f8', 0.4), 0, 2.6, 0, g);
  body.rotation.z = Math.PI / 2;
  for (const dx of [-1.7, 1.7]) {
    const ring = mesh(new THREE.TorusGeometry(1.92, 0.16, 8, 26), mat('#1a1630', 0.5), dx, 2.6, 0, g, false);
    ring.rotation.y = Math.PI / 2;
  }
  mesh(new THREE.BoxGeometry(5.2, 0.3, 2.4), mat('#3a3560', 0.7), 0, 0.15, 0, g);
  scene.add(g); colliders.push({ x: x - 1.8, z: z, r: 2.1 }, { x: x + 1.8, z: z, r: 2.1 });
}
function propDish(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  mesh(new THREE.CylinderGeometry(0.3, 0.5, 3, 10), mat('#c9cfe0', 0.5), 0, 1.5, 0, g);
  const dish = mesh(new THREE.SphereGeometry(2.4, 24, 12, 0, TAU, 0, 1.0), new THREE.MeshStandardMaterial({ color: '#f2f4fa', roughness: 0.35, side: THREE.DoubleSide }), 0, 3.6, 0, g);
  dish.rotation.x = -2.2;
  scene.add(g); colliders.push({ x: x, z: z, r: 0.9 });
}

function propBalloon(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.6, 10), mat('#c9cfe0', 0.5), 0, 0.3, 0, g);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.4, 6), mat('#9aa3c0', 0.4), 0, 2.6, 0, g, false);
  const b = mesh(new THREE.SphereGeometry(1.3, 18, 14), new THREE.MeshStandardMaterial({ color: '#fff0d8', emissive: ACC, emissiveIntensity: 0.25, roughness: 0.4 }), 0, 5.6, 0, g);
  b.scale.y = 1.2;
  scene.add(g); colliders.push({ x: x, z: z, r: 0.7 }); bobbers.push(b);
}
function propIce(x, z, s) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const m = new THREE.MeshStandardMaterial({ color: '#d8f3ff', emissive: '#5fc8ff', emissiveIntensity: 0.25, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9, flatShading: true });
  const r = mulberry32((x * 31 + z * 17) | 0);
  for (let i = 0; i < 5; i++) {
    const h = s * (1.2 + r() * 1.6), c = mesh(new THREE.ConeGeometry(s * (0.25 + r() * 0.2), h, 5), m, (r() - 0.5) * s, h / 2, (r() - 0.5) * s, g);
    c.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
  }
  scene.add(g); colliders.push({ x: x, z: z, r: s * 0.9 });
}
function propGeyser(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  mesh(new THREE.CylinderGeometry(1.1, 1.6, 0.6, 12), mat('#7a86b8', 0.6), 0, 0.3, 0, g);
  mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.62, 12), new THREE.MeshStandardMaterial({ color: '#0c1430', emissive: '#4a6aff', emissiveIntensity: 0.6 }), 0, 0.32, 0, g, false);
  scene.add(g); colliders.push({ x: x, z: z, r: 1.5 }); geysers.push({ x: x, z: z, t: Math.random() * 6 });
}
// a seeded layout for the new planets: props are kept away from the booth, the start and each other
function layoutProps(seed, kinds) {
  const r = mulberry32(seed), spots = [];
  const free = (x, z, rad) => {
    if (Math.abs(x) > HALF - 6 - rad || Math.abs(z) > HALF - 6 - rad) return false;
    if (z < -34 && Math.abs(x) < 22) return false;
    for (const p of spots) if (Math.hypot(p[0] - x, p[1] - z) < p[2] + rad + 5) return false;
    return true;
  };
  for (const k of kinds) {
    for (let n = 0; n < k[1]; n++) {
      for (let tries = 0; tries < 80; tries++) {
        const x = (r() * 2 - 1) * HALF, z = (r() * 2 - 1) * HALF;
        if (!free(x, z, k[2])) continue;
        spots.push([x, z, k[2]]); k[0](x, z, r); break;
      }
    }
  }
  return spots;
}
function buildProps() {
  const pid = PL().id;
  if (pid === 'mars') {
    propDome(-32, -58, 9);
    propDome(42, -50, 6);
    propTank(-48, -36);
    propTank(52, 20);
    propSolar(-40, -6); propSolar(-40, 6);
    propSolar(24, -20); propSolar(24, -10);
    propDish(-55, 40);
    propDish(56, -28);
    propCrate(22, -37, 2.4, 0.2); propCrate(25, -39.4, 2, 0.5); propCrate(20.2, -39.6, 1.8, 0.1);
    propCrate(-28, 26, 2.6, 0.4); propCrate(-30.5, 28.5, 2, 0.1);
    propCrate(8, -8, 2.4, 0.3); propCrate(10.6, -6.2, 1.8, 0.7);
    propCrate(-12, 6, 2.2, 0.9);
    propCrate(46, 44, 2.4, 0.2);
    [[-20, -44], [20, -28], [-30, -26], [32, 6], [-6, -30], [48, -4], [-52, 12], [4, 10]].forEach(p => propLamp(p[0], p[1]));
    return;
  }
  const crates = (x, z, r) => { propCrate(x, z, 2.2 + r() * 0.5, r() * 3); if (r() < 0.6) propCrate(x + 2.6, z + 1.2, 1.8, r() * 3); };
  const common = [[(x, z, r) => propDome(x, z, 6 + r() * 3), 2, 9], [(x, z) => propTank(x, z), 2, 4], [(x, z) => propDish(x, z), 2, 2], [crates, 5, 4], [(x, z) => propLamp(x, z), 8, 1]];
  if (pid === 'jup') layoutProps(PL().seed, [common[0], [(x, z) => propBalloon(x, z), 7, 1.5], common[1], [(x, z) => propSolar(x, z), 3, 4.5], common[2], common[3], common[4]]);
  else if (pid === 'sat') layoutProps(PL().seed, [common[0], [(x, z, r) => propIce(x, z, 1.6 + r() * 1.2), 9, 2.5], common[1], common[2], common[3], common[4]]);
  else layoutProps(PL().seed, [common[0], [(x, z) => propGeyser(x, z), 6, 2], [(x, z, r) => propIce(x, z, 1.4 + r() * 1.0), 5, 2], common[1], [(x, z) => propSolar(x, z), 2, 4.5], common[3], common[4]]);
}
// treasures for the new planets go on free floor spots
function planetTreasures() {
  if (S.planet === 0) return MARS_TREASURES;
  const r = mulberry32(PL().seed + 5), out = [], k = PL().price;
  const names = TREASURE_NAMES[S.planet], coins = [150, 100, 400, 300], turbo = [0, 90, 0, 120];
  for (let i = 0; i < 4; i++) {
    for (let tries = 0; tries < 200; tries++) {
      const x = (r() * 2 - 1) * (HALF - 8), z = (r() * 2 - 1) * (HALF - 8);
      if (z < -34 && Math.abs(x) < 22) continue;
      if (colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 3)) continue;
      if (out.some(t => Math.hypot(t.x - x, t.z - z) < 25)) continue;
      out.push({ x: x, z: z, name: names[i], coins: coins[i] * k, turbo: turbo[i] }); break;
    }
  }
  return out;
}

// ----- collection point -----
function buildBooth() {
  const g = new THREE.Group(); g.position.set(0, 0, BOOTH_Z);
  scene.add(g);
  mesh(new THREE.BoxGeometry(26, 0.5, 9), mat('#59608a', 0.7), 0, 0.25, 0, g, false).receiveShadow = true;
  // cabin
  const cab = new THREE.Group(); cab.position.set(-7, 0, 0); g.add(cab);
  mesh(new THREE.BoxGeometry(5.4, 3.2, 3.6), mat('#eef0f7', 0.45), 0, 2.1, 0, cab);
  mesh(new THREE.BoxGeometry(5.9, 0.5, 4.1), mat(ACC, 0.5), 0, 3.9, 0, cab);
  mesh(new THREE.BoxGeometry(3.2, 1.3, 0.2), new THREE.MeshStandardMaterial({ color: '#bfeaff', emissive: '#6fd3ff', emissiveIntensity: 0.55, roughness: 0.2 }), 0, 2.5, 1.85, cab, false);
  mesh(new THREE.BoxGeometry(5.6, 0.18, 0.5), mat(ACC, 0.5), 0, 1.25, 2.0, cab, false);
  // sign
  const sc = makeCanvas(512, 128), sx = sc.getContext('2d');
  const drawSign = () => {
    sx.fillStyle = '#1a1438'; sx.fillRect(0, 0, 512, 128);
    sx.strokeStyle = ACC; sx.lineWidth = 6; sx.strokeRect(6, 6, 500, 116);
    sx.fillStyle = '#ffd56b'; sx.font = '800 56px "Baloo 2", "Nunito", sans-serif'; sx.textAlign = 'center'; sx.textBaseline = 'middle';
    sx.fillText(Plat.lang === 'ru' ? 'ПУНКТ СБОРА' : 'DROP-OFF', 256, 70);
  };
  drawSign();
  const st = new THREE.CanvasTexture(sc); st.encoding = THREE.sRGBEncoding;
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawSign(); st.needsUpdate = true; }); } catch (e) { /* fonts unavailable */ }
  const sign = mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshBasicMaterial({ map: st }), 0, 5.2, 2.3, cab, false);
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), mat('#c9cfe0'), -2.2, 4.5, 2.2, cab, false);
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6), mat('#c9cfe0'), 2.2, 4.5, 2.2, cab, false);
  // conveyor
  const cc = makeCanvas(128, 32), cx = cc.getContext('2d');
  cx.fillStyle = '#2a2748'; cx.fillRect(0, 0, 128, 32);
  cx.strokeStyle = '#ffd56b'; cx.lineWidth = 6;
  for (let i = 0; i < 4; i++) { cx.beginPath(); cx.moveTo(i * 32 + 6, 4); cx.lineTo(i * 32 + 22, 16); cx.lineTo(i * 32 + 6, 28); cx.stroke(); }
  const convTex = new THREE.CanvasTexture(cc); convTex.wrapS = THREE.RepeatWrapping; convTex.repeat.set(4, 1); convTex.encoding = THREE.sRGBEncoding;
  const conv = mesh(new THREE.BoxGeometry(9, 0.5, 1.6), new THREE.MeshStandardMaterial({ map: convTex, roughness: 0.7 }), 3.5, 1.1, 0, g);
  mesh(new THREE.BoxGeometry(9.2, 0.7, 0.18), mat('#c9cfe0'), 3.5, 1.25, 0.9, g, false);
  mesh(new THREE.BoxGeometry(9.2, 0.7, 0.18), mat('#c9cfe0'), 3.5, 1.25, -0.9, g, false);
  for (const lx of [-0.5, 3.5, 7.5]) mesh(new THREE.BoxGeometry(0.3, 0.9, 1.6), mat('#3a3560'), lx, 0.7, 0, g, false);
  // hopper
  mesh(new THREE.CylinderGeometry(1.5, 0.8, 1.4, 14, 1, true), new THREE.MeshStandardMaterial({ color: ACC, roughness: 0.5, side: THREE.DoubleSide }), -0.4, 2.4, 0, g);
  // machine tank
  const tank = mesh(new THREE.CylinderGeometry(1.8, 1.8, 3.6, 22), mat('#f0f2f8', 0.4), 10, 2.3, 0, g);
  for (const ty of [0.9, 3.2]) mesh(new THREE.TorusGeometry(1.82, 0.14, 8, 24), mat(ACC, 0.5), 10, ty + 0.2, 0, g, false).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 18), new THREE.MeshStandardMaterial({ color: '#1a1630', emissive: '#38dccb', emissiveIntensity: 0.6 }), 10, 2.6, 1.82, g, false).rotation.x = Math.PI / 2;
  mesh(new THREE.SphereGeometry(1.8, 22, 10, 0, TAU, 0, Math.PI / 2), mat('#f0f2f8', 0.4), 10, 4.1, 0, g);
  colliders.push({ x: -7, z: BOOTH_Z, r: 3.4 }, { x: 1.5, z: BOOTH_Z, r: 1.3 }, { x: 4, z: BOOTH_Z, r: 1.3 }, { x: 6.5, z: BOOTH_Z, r: 1.3 }, { x: 10, z: BOOTH_Z, r: 2.5 });

  // glowing zone ring
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38dccb, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(ZONE.r - 0.35, ZONE.r, 56), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.set(ZONE.x, 0.07, ZONE.z); ring.renderOrder = 3;
  scene.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(ZONE.r - 0.35, 48), new THREE.MeshBasicMaterial({ color: 0x38dccb, transparent: true, opacity: 0.14, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2; disc.position.set(ZONE.x, 0.06, ZONE.z); disc.renderOrder = 3;
  scene.add(disc);
  booth = { group: g, convTex: convTex, ring: ring, disc: disc, bounce: 0, tank: tank };
}

// ----- astronaut -----
function makeAstronaut(opts) {
  opts = opts || {};
  const g = new THREE.Group();
  const M = {
    suit: mat('#f4f1ee', 0.5),
    band: mat('#ff8f5a', 0.5),
    accent: mat('#c2542b', 0.6),
    visor: new THREE.MeshStandardMaterial({ color: '#141a3a', roughness: 0.15, metalness: 0.5 }),
    eye: new THREE.MeshStandardMaterial({ color: '#c9fff8', emissive: '#7ff6e8', emissiveIntensity: 1.3 }),
    pack: mat('#dfe3ef', 0.5),
    glass: new THREE.MeshStandardMaterial({ color: '#2b3a6b', roughness: 0.2, transparent: true, opacity: 0.55 }),
    dust: new THREE.MeshStandardMaterial({ color: '#d79a76', emissive: '#6b3a22', emissiveIntensity: 0.5 }),
    pole: mat('#9aa3c0', 0.4),
    brush: mat('#ff8f5a', 0.6),
    bristle: mat('#2a2748', 0.9)
  };
  const body = new THREE.Group(); g.add(body);
  const torso = mesh(new THREE.SphereGeometry(0.5, 22, 16), M.suit, 0, 1.0, 0, body);
  torso.scale.set(1, 1.12, 0.86);
  mesh(new THREE.TorusGeometry(0.47, 0.07, 8, 24), M.band, 0, 0.78, 0, body, false).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.34, 0.22, 0.06), new THREE.MeshStandardMaterial({ color: '#16224a', emissive: '#38dccb', emissiveIntensity: 0.7 }), 0, 1.08, 0.41, body, false);
  const head = new THREE.Group(); head.position.set(0, 1.8, 0); body.add(head);
  mesh(new THREE.SphereGeometry(0.46, 24, 18), M.suit, 0, 0, 0, head);
  const visor = mesh(new THREE.SphereGeometry(0.37, 22, 16), M.visor, 0, -0.01, 0.28, head, false);
  visor.scale.set(1, 0.86, 0.7);
  for (const ex of [-0.13, 0.13]) {
    const e = mesh(new THREE.SphereGeometry(0.05, 10, 8), M.eye, ex, 0.02, 0.5, head, false);
    e.scale.set(0.9, 1.3, 0.4);
  }
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 8), M.accent, 0.5, 0.2, 0, head, false).rotation.z = 0.5;
  const glint = mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), -0.14, 0.14, 0.5, head, false);
  glint.scale.set(1.3, 0.7, 0.4);
  mesh(new THREE.TorusGeometry(0.34, 0.06, 8, 22), M.band, 0, -0.38, 0, head, false).rotation.x = Math.PI / 2;
  // backpack with dust canister
  mesh(new THREE.BoxGeometry(0.66, 0.84, 0.34), M.pack, 0, 1.08, -0.52, body);
  mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 14), M.glass, 0, 1.08, -0.74, body, false);
  mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), M.pole, 0.24, 1.7, -0.5, body, false);
  mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd56b', emissive: '#ffb000', emissiveIntensity: 1.2 }), 0.24, 1.97, -0.5, body, false);
  for (const sx of [-0.55, 0.55]) mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: '#38dccb', emissive: '#38dccb', emissiveIntensity: 1 }), sx, 1.42, 0.1, body, false);
  const canister = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.56, 14), M.dust, 0, 0.8, -0.74, body, false);
  canister.scale.y = 0.05;
  // arms
  const armL = new THREE.Group(); armL.position.set(-0.5, 1.2, 0.05); body.add(armL);
  mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.56, 10), M.suit, 0, -0.26, 0, armL).rotation.z = 0.15;
  mesh(new THREE.SphereGeometry(0.13, 10, 8), M.band, -0.04, -0.58, 0, armL, false);
  const armR = new THREE.Group(); armR.position.set(0.5, 1.2, 0.05); body.add(armR);
  const upper = mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.56, 10), M.suit, 0.04, -0.26, 0.2, armR);
  upper.rotation.x = -0.75; upper.rotation.z = -0.1;
  // legs
  const legL = new THREE.Group(); legL.position.set(-0.2, 0.55, 0); g.add(legL);
  const legR = new THREE.Group(); legR.position.set(0.2, 0.55, 0); g.add(legR);
  for (const leg of [legL, legR]) {
    mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.46, 10), M.suit, 0, -0.2, 0, leg);
    mesh(new THREE.BoxGeometry(0.3, 0.2, 0.44), M.band, 0, -0.5, 0.06, leg);
  }
  // sweeper: pole + head
  const hand = new THREE.Vector3(0.42, 0.93, 0.5), tip = new THREE.Vector3(0, 0.14, 1.3);
  const dir = tip.clone().sub(hand), len = dir.length();
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 8), M.pole, 0, 0, 0, g, false);
  pole.position.copy(hand.clone().add(tip).multiplyScalar(0.5));
  pole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const hand3 = mesh(new THREE.SphereGeometry(0.13, 10, 8), M.band, 0.42, 0.93, 0.5, g, false);
  const sweep = new THREE.Group(); sweep.position.set(0, 0.0, 1.3); g.add(sweep);
  const bar = mesh(new THREE.BoxGeometry(2, 0.2, 0.46), M.brush, 0, 0.16, 0, sweep);
  mesh(new THREE.BoxGeometry(2.02, 0.12, 0.5), M.bristle, 0, 0.06, 0, sweep, false);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 8), M.accent, 0, 0.3, -0.18, sweep, false).rotation.z = Math.PI / 2;
  // crown (prize for Neptune), hidden until earned
  const crown = new THREE.Group(); crown.position.set(0, 0.42, 0); head.add(crown);
  const gm = new THREE.MeshStandardMaterial({ color: '#ffd56b', emissive: '#a06a00', emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.6 });
  mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.12, 16, 1, true), gm, 0, 0, 0, crown, false);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; mesh(new THREE.ConeGeometry(0.06, 0.18, 6), gm, Math.cos(a) * 0.24, 0.13, Math.sin(a) * 0.24, crown, false); }
  crown.visible = false;
  // soft contact shadow
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh);
  return { group: g, body: body, head: head, legL: legL, legR: legR, armL: armL, armR: armR, canister: canister, sweep: sweep, bar: bar, mats: M, crown: crown };
}

function applySuit(p, pal) {
  setLin(p.mats.suit.color, pal.base);
  setLin(p.mats.band.color, pal.band);
  setLin(p.mats.accent.color, pal.accent);
  setLin(p.mats.pack.color, pal.base);
}
function currentSuit() { const k = S.planet, a = SUITS[k]; return a[clamp(S.suitVar[k] || 0, 0, a.length - 1)]; }
function applyAllLooks() {
  if (!player) return;
  applySuit(player, currentSuit());
  const gold = !!S.P[0].ach;
  setLin(player.mats.brush.color, gold ? '#ffd56b' : '#ff8f5a');
  setLin(player.mats.brush.emissive, gold ? '#6b4a00' : '#000000');
  player.crown.visible = !!S.P[3].ach;
}

// ----- robots -----
function makeRobot(golden) {
  const g = new THREE.Group();
  const white = mat(golden ? '#ffd56b' : '#f4f6fb', 0.4, golden ? { metalness: 0.5 } : null), teal = mat(golden ? '#ff8f5a' : '#38dccb', 0.4), dark = mat('#141a3a', 0.2, { metalness: 0.4 });
  const body = new THREE.Group(); body.position.y = 0.9; g.add(body);
  mesh(new THREE.SphereGeometry(0.5, 20, 14), white, 0, 0, 0, body);
  mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 22), teal, 0, -0.05, 0, body, false).rotation.x = Math.PI / 2;
  const v = mesh(new THREE.SphereGeometry(0.34, 16, 12), dark, 0, 0.1, 0.24, body, false);
  v.scale.set(1, 0.7, 0.6);
  for (const ex of [-0.12, 0.12]) mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: '#c9fff8', emissive: '#7ff6e8', emissiveIntensity: 1.3 }), ex, 0.12, 0.45, body, false);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), white, 0, 0.62, 0, body, false);
  mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd56b', emissive: '#ffb000', emissiveIntensity: 1 }), 0, 0.86, 0, body, false);
  const brush = new THREE.Group(); brush.position.y = 0.25; g.add(brush);
  mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 18), mat('#ff8f5a', 0.6), 0, 0, 0, brush, false);
  mesh(new THREE.BoxGeometry(1.0, 0.06, 0.12), mat('#2a2748', 0.9), 0, 0.06, 0, brush, false);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; g.add(sh);
  return { group: g, body: body, brush: brush };
}
function syncRobots() {
  const want = statsFor(S.lv, false, bonusNow()).robots;
  while (robots.length < want) {
    const m = makeRobot(robots.length >= S.lv.robot);
    const r = { m: m, x: -6 + robots.length * 2.4, z: -44, tx: 0, tz: 0, has: false, retarget: 0, stuck: 0, acc: 0, floatT: 1 + robots.length * 0.7, ph: Math.random() * 6 };
    m.group.position.set(r.x, 0, r.z);
    scene.add(m.group);
    fixColors(m.group);
    robots.push(r);
  }
}

// ----- treasure glints, scanner, particles -----
function buildFx() {
  const gt = glowTex('rgba(255,244,190,1)', 'rgba(255,210,90,.5)', true);
  TREASURES.forEach((t, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.scale.set(1.8, 1.8, 1); s.position.set(t.x, 0.5, t.z);
    scene.add(s); glints.push(s);
  });
  // scanner sparkles
  const maxN = NB * NB;
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxN * 3), 3));
  sg.setDrawRange(0, 0);
  scanPts = new THREE.Points(sg, new THREE.PointsMaterial({ map: glowTex('rgba(255,236,150,1)', 'rgba(255,200,80,.45)', true), size: 22, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scanPts.frustumCulled = false;
  scene.add(scanPts);
  // particle pool
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTS_N * 3), 3));
  pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PARTS_N * 3), 3));
  parts = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex('rgba(255,255,255,1)', 'rgba(255,255,255,.55)', false), size: 11, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }));
  parts.frustumCulled = false;
  scene.add(parts);
  for (let i = 0; i < PARTS_N; i++) pool.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, mode: 0, r: 1, g: 1, b: 1 });
}
let poolIdx = 0;
function spawnPart(mode, x, y, z, vx, vy, vz, col, life) {
  const p = pool[poolIdx]; poolIdx = (poolIdx + 1) % PARTS_N;
  p.mode = mode; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.max = life;
  p.r = col[0]; p.g = col[1]; p.b = col[2];
}

let bobbers = [], geysers = [];
function disposeScene() {
  if (!scene) return;
  scene.traverse(o => {
    if (o.geometry && o.geometry.dispose) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && m.map.dispose) m.map.dispose(); if (m.dispose) m.dispose(); });
  });
  if (renderer && renderer.renderLists && renderer.renderLists.dispose) renderer.renderLists.dispose();
}
function buildStationScene() {
  disposeScene();
  colliders.length = 0; glints = []; beacons = []; moteData.length = 0; pool.length = 0; poolIdx = 0;
  robots.length = 0; pops.length = 0; bobbers = []; geysers = []; booth = null;
  ACC = TH().acc;
  buildLights();
  buildSky();
  buildGround();
  buildProps();
  buildBooth();
  TREASURES = planetTreasures();
  player = makeAstronaut();
  scene.add(player.group);
  buildFx();
  buildExtras();
  fixColors(scene);
}

function setSize() {
  const w = Math.max(1, $('app').clientWidth), h = Math.max(1, $('app').clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowQ ? 1.25 : 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
