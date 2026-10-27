import {
  AdditiveBlending, CylinderGeometry, DoubleSide, Group, Mesh, MeshPhysicalMaterial, PlaneGeometry, PointLight,
  ShaderMaterial, Vector3,
} from 'three';

const flameVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const flameFrag = /* glsl */ `
uniform float uTime; uniform float uFlicker; uniform float uIntensity;
varying vec2 vUv;
float h1(float n) { return fract(sin(n) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), f); }
void main() {
  vec2 p = vec2(vUv.x - 0.5, vUv.y);
  float height = 0.72 + 0.22 * uFlicker;
  float yy = clamp(p.y / height, 0.0, 1.0);
  p.x += (n1(uTime * 4.0 + p.y * 5.0) - 0.5) * 0.16 * yy * yy;
  float w = 0.5 * pow(yy, 0.45) * pow(1.0 - yy, 0.85);
  float d = abs(p.x) / max(w, 1e-3);
  float core = 1.0 - smoothstep(0.0, 1.0, d);
  float glow = exp(-d * d * 1.6) * 0.18 * (1.0 - yy);
  vec3 col = mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.82, 0.42), core);
  col = mix(col, vec3(1.0, 0.97, 0.88), pow(core, 3.0) * smoothstep(0.08, 0.5, yy));
  col = mix(vec3(0.25, 0.45, 1.0) * 0.9, col, smoothstep(0.0, 0.2, p.y));
  float a = (core + glow) * (1.0 - smoothstep(0.86, 1.0, yy)) * smoothstep(0.0, 0.03, p.y);
  gl_FragColor = vec4(col * a * uIntensity, a);
}
`;

export function createCandle() {
  const group = new Group();
  const wax = new Mesh(
    new CylinderGeometry(0.08, 0.09, 0.46, 40),
    new MeshPhysicalMaterial({ color: 0xfff1d8, roughness: 0.5, sheen: 0.6, sheenColor: 0xffd7a8, emissive: 0xff9a40, emissiveIntensity: 0.08 })
  );
  wax.position.y = 0.23;
  wax.castShadow = false;
  const wick = new Mesh(new CylinderGeometry(0.006, 0.008, 0.05, 8), new MeshPhysicalMaterial({ color: 0x1a0d05, roughness: 1 }));
  wick.position.y = 0.47;

  const flameMat = new ShaderMaterial({
    vertexShader: flameVert, fragmentShader: flameFrag, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uFlicker: { value: 1 }, uIntensity: { value: 3.2 } },
  });
  const flame = new Mesh(new PlaneGeometry(0.2, 0.42), flameMat);
  flame.position.y = 0.46 + 0.2;

  const light = new PointLight(0xffa24a, 5, 0, 2);
  light.position.set(0, 0.6, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.near = 0.05;
  light.shadow.camera.far = 30;
  light.shadow.bias = -0.002;
  light.shadow.normalBias = 0.03;

  group.add(wax, wick, flame, light);

  let t = 0;
  const tmp = new Vector3();
  return {
    group, light, flame,
    update(dt, camera) {
      t += dt;
      const f = 1 + 0.16 * (Math.sin(t * 7.3) * 0.5 + Math.sin(t * 13.1 + 1.0) * 0.3 + Math.sin(t * 29.7) * 0.2) + 0.06 * Math.sin(t * 3.1);
      light.intensity = 5 * f;
      light.position.x = Math.sin(t * 5.1) * 0.012;
      light.position.z = Math.cos(t * 4.3) * 0.012;
      flameMat.uniforms.uTime.value = t;
      flameMat.uniforms.uFlicker.value = f;
      flame.scale.y = 0.9 + 0.1 * f;
      tmp.copy(camera.position);
      group.worldToLocal(tmp);
      flame.rotation.y = Math.atan2(tmp.x, tmp.z);
      return f;
    },
  };
}
