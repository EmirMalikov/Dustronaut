(function(){
  class V3{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
    set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
    copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this}
    clone(){return new V3(this.x,this.y,this.z)}
    add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
    sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
    multiplyScalar(k){this.x*=k;this.y*=k;this.z*=k;return this}
    setScalar(k){this.x=this.y=this.z=k;return this}
    length(){return Math.hypot(this.x,this.y,this.z)}
    normalize(){const l=this.length()||1;return this.multiplyScalar(1/l)}
    fromBufferAttribute(){return this}
    unproject(cam){ // fake: ray through a point below and ahead of the camera
      const nx=this.x, ny=this.y; this.x=cam.position.x+nx*22; this.y=cam.position.y-6; this.z=cam.position.z-26+ny*-14; return this}
    project(cam){ const dx=this.x-cam.position.x, dz=this.z-cam.position.z; this.x=dx/30; this.y=-(dz+20)/30; this.z=0.5; return this}
  }
  class Col{constructor(h){this.r=0.5;this.g=0.4;this.b=0.3} set(){return this} setHSL(){return this} convertSRGBToLinear(){return this}}
  class O3{constructor(){this.position=new V3();this.rotation={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}};this.scale=new V3(1,1,1);this.quaternion={setFromUnitVectors(){}};this.children=[];this.matrixWorld={};this.material={color:new Col(),emissive:new Col(),opacity:1,map:null};this.geometry={attributes:{},setAttribute(n,a){this.attributes[n]=a},setDrawRange(){}};this.visible=true;this.renderOrder=0;this.matrix={}}
    updateMatrix(){}
    add(c){this.children.push(c)} remove(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1)}
    traverse(f){f(this)} lookAt(){} updateMatrixWorld(){} }
  class Mat{constructor(o={}){Object.assign(this,o);this.color=new Col();this.emissive=new Col();if(o.opacity!==undefined)this.opacity=o.opacity} dispose(){}}
  class Tex{constructor(){this.repeat={set(){}};this.offset={x:0,y:0};this.needsUpdate=false} dispose(){}}
  class BA{constructor(a,s){this.array=a;this.itemSize=s;this.needsUpdate=false} setUsage(){return this}}
  class Geo{constructor(){this.attributes={position:{count:0},uv:{setXY(){}}}} setAttribute(n,a){this.attributes[n]=a} setIndex(a){this.index=a} setDrawRange(){} dispose(){}}
  class Mesh extends O3{constructor(g,m){super();this.geometry=g||new Geo();this.material=m||new Mat()}}
  class Light extends O3{constructor(){super();this.shadow={mapSize:{set(){}},camera:{updateProjectionMatrix(){}},bias:0};this.target=new O3()}}
  const T={
    Vector3:V3, Color:Col, Object3D:O3, Group:O3, Scene:class extends O3{constructor(){super();this.background=null;this.fog=null}},
    Fog:class{}, PerspectiveCamera:class extends O3{constructor(f,a){super();this.fov=f;this.aspect=a} updateProjectionMatrix(){}},
    WebGLRenderer:class{constructor(){this.shadowMap={};this.domElement=document.getElementById('gl')} setPixelRatio(){} setSize(){} render(){window.__renders=(window.__renders||0)+1}},
    HemisphereLight:Light, DirectionalLight:Light,
    Mesh:Mesh, InstancedMesh:class extends Mesh{constructor(g,m,n){super(g,m);this.count=n} setMatrixAt(){}}, Points:Mesh, Sprite:Mesh, Line:Mesh,
    BufferGeometry:Geo, BufferAttribute:BA,
    CanvasTexture:Tex, Texture:Tex,
    sRGBEncoding:1,DynamicDrawUsage:1,AdditiveBlending:1,PCFSoftShadowMap:1,RepeatWrapping:1,AdditiveBlending:1,DoubleSide:2
  };
  ['MeshStandardMaterial','MeshBasicMaterial','MeshLambertMaterial','PointsMaterial','SpriteMaterial'].forEach(n=>T[n]=Mat);
  ['BoxGeometry','SphereGeometry','CylinderGeometry','ConeGeometry','TorusGeometry','CircleGeometry','RingGeometry','PlaneGeometry','DodecahedronGeometry','OctahedronGeometry','EllipseGeometry'].forEach(n=>T[n]=Geo);
  window.THREE=T;
})();
