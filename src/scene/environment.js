import {
  AdditiveBlending, BackSide, BufferGeometry, CircleGeometry, Color, DirectionalLight, Float32BufferAttribute, FogExp2,
  HemisphereLight, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Object3D, PMREMGenerator, Points, PointsMaterial, Scene,
  ShaderMaterial, SphereGeometry, SpotLight,
} from 'three';
import { makeWoodSurface } from './shaders.js';

const skyMat = () => new ShaderMaterial({
  side: BackSide, depthWrite: false, fog: false,
  uniforms: { uHorizon: { value: new Color('#171428') }, uZenith: { value: new Color('#030308') }, uMoonDir: { value: [-0.45, 0.42, -0.79] } },
  vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform vec3 uHorizon, uZenith, uMoonDir; varying vec3 vDir;
    void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(uHorizon, uZenith, pow(h, 0.55));
      float m = max(dot(normalize(vDir), normalize(uMoonDir)), 0.0); c += vec3(0.55,0.62,0.9) * pow(m, 60.0) * 0.5;
      gl_FragColor = vec4(c, 1.0); }`,
});

export function createEnvironment(scene, renderer) {
  scene.background = new Color('#07060c');
  scene.fog = new FogExp2(0x07060c, 0.07);

  // Visible sky dome, stars and moon
  const sky = new Mesh(new SphereGeometry(80, 32, 16), skyMat());
  scene.add(sky);

  const moon = new Mesh(new SphereGeometry(1.8, 32, 32), new MeshBasicMaterial({ color: new Color(2.2, 2.4, 3.0), fog: false }));
  moon.position.set(-22, 20, -40);
  scene.add(moon);

  const starPos = [];
  for (let i = 0; i < 1400; i++) {
    const u = Math.random(), v = Math.random();
    const th = 2 * Math.PI * u, ph = Math.acos(1 - v) * 0.9;
    const r = 70;
    starPos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) + 2, r * Math.sin(ph) * Math.sin(th));
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3));
  const stars = new Points(starGeo, new PointsMaterial({ color: 0xaab4ff, size: 0.22, sizeAttenuation: true, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false, fog: false }));
  scene.add(stars);

  // Image-based lighting from a small procedural night scene
  const envScene = new Scene();
  envScene.add(new Mesh(new SphereGeometry(50, 16, 8), skyMat()));
  const envMoon = new Mesh(new SphereGeometry(3.5, 16, 16), new MeshBasicMaterial({ color: new Color(6, 6.5, 8) }));
  envMoon.position.set(-22, 20, -40);
  envScene.add(envMoon);
  const envFloor = new Mesh(new CircleGeometry(40, 32), new MeshBasicMaterial({ color: new Color('#1a1008') }));
  envFloor.rotation.x = -Math.PI / 2; envFloor.position.y = -1;
  envScene.add(envFloor);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();

  // Lights
  const moonLight = new DirectionalLight(0x9db3ff, 1.1);
  moonLight.position.set(-7, 9, -6);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(2048, 2048);
  moonLight.shadow.camera.left = -4; moonLight.shadow.camera.right = 4;
  moonLight.shadow.camera.top = 4; moonLight.shadow.camera.bottom = -4;
  moonLight.shadow.camera.near = 1; moonLight.shadow.camera.far = 30;
  moonLight.shadow.bias = -0.0005; moonLight.shadow.normalBias = 0.02;
  scene.add(moonLight);

  const key = new SpotLight(0xffd0a0, 55, 0, 0.6, 0.85, 2);
  key.position.set(3.4, 5.4, 4.6);
  key.target = new Object3D();
  key.target.position.set(0, 0.6, 0);
  scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 1; key.shadow.camera.far = 20;
  scene.add(key);

  scene.add(new HemisphereLight(0x303a66, 0x140a06, 0.35));

  // Ground
  const groundMat = makeWoodSurface(new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5 }));
  const ground = new Mesh(new CircleGeometry(45, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Drifting dust motes
  const moteCount = 160, motes = new Float32Array(moteCount * 3), seeds = [];
  for (let i = 0; i < moteCount; i++) {
    motes[i * 3] = (Math.random() - 0.5) * 7; motes[i * 3 + 1] = Math.random() * 3; motes[i * 3 + 2] = (Math.random() - 0.5) * 7;
    seeds.push(Math.random() * 100);
  }
  const moteGeo = new BufferGeometry();
  moteGeo.setAttribute('position', new Float32BufferAttribute(motes, 3));
  const motePts = new Points(moteGeo, new PointsMaterial({ color: 0xffc080, size: 0.025, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false }));
  scene.add(motePts);

  let t = 0;
  return {
    groundMat, key, moonLight,
    update(dt) {
      t += dt;
      const p = moteGeo.attributes.position.array;
      for (let i = 0; i < moteCount; i++) {
        p[i * 3] += Math.sin(t * 0.3 + seeds[i]) * 0.0015;
        p[i * 3 + 1] += 0.0012 + Math.sin(t * 0.5 + seeds[i] * 2) * 0.0008;
        p[i * 3 + 2] += Math.cos(t * 0.27 + seeds[i]) * 0.0015;
        if (p[i * 3 + 1] > 3.2) p[i * 3 + 1] = 0;
      }
      moteGeo.attributes.position.needsUpdate = true;
    },
  };
}
