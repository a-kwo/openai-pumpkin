import { ACESFilmicToneMapping, HalfFloatType, PCFShadowMap, SRGBColorSpace, Vector2, WebGLRenderTarget, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 q = vUv - 0.5;
      float vig = 1.0 - smoothstep(0.2, 1.0, dot(q, q) * 2.4); c.rgb *= mix(0.5, 1.0, vig);
      float g = fract(sin(dot(gl_FragCoord.xy + mod(uTime, 10.0) * 60.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
      c.rgb += g * 0.016; gl_FragColor = c; }`,
};

export function createRenderer(canvas, scene, camera) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  const lowEnd = /Mobi|Android/i.test(navigator.userAgent);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowEnd ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: lowEnd ? 0 : 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.6, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  return {
    renderer, composer, bloom,
    render(t) { grade.uniforms.uTime.value = t; composer.render(); },
  };
}
