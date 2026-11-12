
// ---------- extras: colour management, railings, beacons, beam, motes ----------
const linSet = new WeakSet();
function linOnce(c) { if (c && !linSet.has(c)) { c.convertSRGBToLinear(); linSet.add(c); } }
function fixMat(m) {
  if (m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial)) { linOnce(m.color); linOnce(m.emissive); }
}
function fixColors(root) { root.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(fixMat); }); }
const setLin = (c, hex) => { c.set(hex); c.convertSRGBToLinear(); linSet.add(c); };

let motes = null, beacons = [];
const MOTE_N = 70, moteData = [];
const wrapV = (v, lo, span) => lo + (((v - lo) % span) + span) % span;

function buildExtras() {
  // railings around the platform
  const railMat = mat('#e4e8f4', 0.5);
  const n = Math.floor(G / 4) + 1;
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), railMat, n * 4);
  const dm = new THREE.Object3D();
  const L = HALF - 0.45;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = -HALF + 0.45 + i * ((G - 0.9) / (n - 1));
    [[t, -L], [t, L], [-L, t], [L, t]].forEach(p => { dm.position.set(p[0], 0.55, p[1]); dm.updateMatrix(); posts.setMatrixAt(k++, dm.matrix); });
  }
  posts.castShadow = true; posts.frustumCulled = false;
  scene.add(posts);
  for (const s of [-1, 1]) {
    mesh(new THREE.BoxGeometry(G - 0.6, 0.1, 0.12), railMat, 0, 1.0, s * L, scene, false);
    mesh(new THREE.BoxGeometry(0.12, 0.1, G - 0.6), railMat, s * L, 1.0, 0, scene, false);
  }
  // corner beacons
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => {
    const x = c[0] * (HALF - 1.6), z = c[1] * (HALF - 1.6);
    mesh(new THREE.CylinderGeometry(0.15, 0.22, 5, 8), mat('#c9cfe0', 0.5), x, 2.5, z, scene);
    const bm = new THREE.MeshStandardMaterial({ color: '#ff5a5a', emissive: '#ff3030', emissiveIntensity: 1 });
    mesh(new THREE.SphereGeometry(0.4, 14, 10), bm, x, 5.2, z, scene, false);
    beacons.push(bm);
    colliders.push({ x: x, z: z, r: 0.35 });
  });
  // light column over the collection point
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(ZONE.r - 0.4, ZONE.r - 0.4, 7, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x38dccb, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.set(ZONE.x, 3.5, ZONE.z); beam.renderOrder = 3;
  scene.add(beam); booth.beam = beam;
  // lamps on the booth roof
  const lampM = new THREE.MeshStandardMaterial({ color: '#fff3c9', emissive: '#ffd98a', emissiveIntensity: 1.4 });
  [-9.2, -4.8].forEach(x => mesh(new THREE.SphereGeometry(0.28, 12, 8), lampM, x, 4.55, BOOTH_Z + 1.9, scene, false));
  // glow on the horizon
  const hg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(TH().horizon[0], TH().horizon[1], false), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5, fog: false }));
  hg.scale.set(1900, 260, 1); hg.position.set(0, 10, -720);
  scene.add(hg);
  // floating dust motes around the camera
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MOTE_N * 3), 3));
  motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: glowTex(TH().mote[0], TH().mote[1], false), size: 7, sizeAttenuation: false, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  motes.frustumCulled = false;
  scene.add(motes);
  const r = mulberry32(808);
  for (let i = 0; i < MOTE_N; i++) moteData.push({ x: r() * 60 - 30, y: 0.4 + r() * 8, z: r() * 60 - 48, vx: (r() - 0.5) * 0.6, vy: 0.05 + r() * 0.25, vz: (r() - 0.5) * 0.6 });
}
