import { Color } from 'three';

// Shared GLSL: cheap, seam-free 3D value noise + fbm. Everything on the
// pumpkin is shaded procedurally in object space, so there are no UV seams,
// no pole pinching and no texture resolution limit.
export const NOISE_GLSL = /* glsl */ `
float pk_hash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float pk_vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(pk_hash(i + vec3(0.0, 0.0, 0.0)), pk_hash(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(pk_hash(i + vec3(0.0, 1.0, 0.0)), pk_hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(pk_hash(i + vec3(0.0, 0.0, 1.0)), pk_hash(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(pk_hash(i + vec3(0.0, 1.0, 1.0)), pk_hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
float pk_fbm(vec3 p, int octaves) {
  float a = 0.5, s = 0.0, n = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    s += a * pk_vnoise(p);
    n += a;
    p = p * 2.03 + vec3(13.7, 7.1, 3.3);
    a *= 0.5;
  }
  return s / n;
}
`;

/**
 * Generic injector. `surface` is a GLSL snippet that may read `vPkPos`
 * (object-space position) and must write:
 *   vec3 pk_albedo, float pk_rough (delta), float pk_height (bump field), vec3 pk_emissive
 * `heightFn` is a GLSL expression of `q` (vec3) returning a float height, used
 * for finite-difference bump mapping.
 */
export function applyProceduralSurface(material, { uniforms = {}, surface, heightFn, bumpStrength = 0.6, cacheKey }) {
  material.userData.uniforms = {
    uFlicker: { value: 1 },
    uTime: { value: 0 },
    uBumpStrength: { value: bumpStrength },
    ...uniforms,
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, material.userData.uniforms);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPkPos;\nvarying mat3 vPkNM;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPkPos = position;\nvPkNM = normalMatrix;');

    const uniformDecls = Object.keys(material.userData.uniforms)
      .map((name) => {
        const v = material.userData.uniforms[name].value;
        const type = typeof v === 'number' ? 'float' : v.isColor ? 'vec3' : v.isVector2 ? 'vec2' : 'vec3';
        return `uniform ${type} ${name};`;
      })
      .join('\n');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vPkPos;\nvarying mat3 vPkNM;\n${uniformDecls}\n${NOISE_GLSL}\nfloat pk_heightAt(vec3 q) { return ${heightFn}; }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 pk_albedo = vec3(1.0); float pk_rough = 0.0; vec3 pk_emissive = vec3(0.0);
        { ${surface} }
        diffuseColor.rgb *= pk_albedo;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + pk_rough, 0.03, 1.0);`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        {
          float e = 0.0035;
          float h0 = pk_heightAt(vPkPos);
          vec3 grad = vec3(
            pk_heightAt(vPkPos + vec3(e, 0.0, 0.0)) - h0,
            pk_heightAt(vPkPos + vec3(0.0, e, 0.0)) - h0,
            pk_heightAt(vPkPos + vec3(0.0, 0.0, e)) - h0) / e;
          vec3 gV = vPkNM * grad;
          vec3 sg = gV - normal * dot(gV, normal);
          normal = normalize(normal - sg * uBumpStrength);
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += pk_emissive;`
      );

    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

// ---------------------------------------------------------------------------
// Pumpkin skin: waxy orange rind with rib creases, vertical streaking,
// mottled patches, tiny lenticels (specks) and a green blush near the stem.
export function makeSkinSurface(material, shape) {
  return applyProceduralSurface(material, {
    cacheKey: 'pk-skin',
    bumpStrength: 0.14,
    uniforms: {
      uRibs: { value: shape.ribs },
      uRibJitter: { value: shape.ribJitter },
      uColorA: { value: new Color('#c9561a') }, // deep burnt orange
      uColorB: { value: new Color('#f08a2a') }, // bright rind
      uColorC: { value: new Color('#f7b25a') }, // pale sun-bleached patches
      uColorD: { value: new Color('#7f8a2e') }, // green blush at the stem
      uTopY: { value: shape.heightScale - shape.topDimple },
    },
    heightFn: 'pk_fbm(q * 4.0, 3) * 0.6 + pk_fbm(vec3(q.x * 12.0, q.y * 2.0, q.z * 12.0), 3) * 0.3',
    surface: /* glsl */ `
      vec3 p = vPkPos;
      float th = atan(p.x, p.z);
      float thj = th + uRibJitter * sin(3.0 * th + 1.3);
      float lobe = abs(cos(uRibs * 0.5 * thj));
      float crease = 1.0 - smoothstep(0.0, 0.32, lobe);
      float streak = pk_fbm(vec3(p.x * 7.0, p.y * 1.2, p.z * 7.0), 3);
      float mottle = pk_fbm(p * 1.7 + 5.0, 3);
      float pale = smoothstep(0.58, 0.82, pk_fbm(p * 1.3 + 11.0, 3));
      float speck = smoothstep(0.78, 0.86, pk_vnoise(p * 60.0 + 3.0));
      float top = smoothstep(0.22, 0.62, p.y / max(uTopY, 0.01));
      float topBlotch = top * smoothstep(0.35, 0.75, pk_fbm(p * 3.0 + 21.0, 3));

      vec3 col = mix(uColorA, uColorB, smoothstep(0.12, 0.88, mottle));
      col = mix(col, uColorC, pale * 0.4);
      col *= 1.0 + (streak - 0.5) * 0.16;
      col = mix(col, uColorD, topBlotch * 0.65);
      col *= 1.0 - crease * 0.35;
      col *= 1.0 - speck * 0.18;
      pk_albedo = col;
      pk_rough = (mottle - 0.5) * 0.2 + crease * 0.22 + speck * 0.15 + pale * 0.06;
    `,
  });
}

// Interior flesh / cut faces: pale fibrous pumpkin meat that glows faintly
// with the candle (fake subsurface scattering).
export function makeFleshSurface(material) {
  return applyProceduralSurface(material, {
    cacheKey: 'pk-flesh',
    bumpStrength: 0.5,
    uniforms: {
      uColorA: { value: new Color('#e0944c') },
      uColorB: { value: new Color('#f8cf96') },
      uGlow: { value: new Color('#ff5a00') },
    },
    heightFn: 'pk_fbm(vec3(q.x * 6.0, q.y * 40.0, q.z * 6.0), 3) * 0.5 + pk_fbm(q * 14.0, 3) * 0.5',
    surface: /* glsl */ `
      vec3 p = vPkPos;
      float fiber = pk_fbm(vec3(p.x * 5.0, p.y * 34.0, p.z * 5.0), 3);
      float mottle = pk_fbm(p * 5.0 + 2.0, 3);
      float wet = smoothstep(0.5, 0.75, pk_fbm(p * 7.0 + 9.0, 3));
      vec3 col = mix(uColorA, uColorB, smoothstep(0.3, 0.75, mottle));
      col *= 1.0 + (fiber - 0.5) * 0.5;
      pk_albedo = col;
      pk_rough = (mottle - 0.5) * 0.2 - wet * 0.35;
      pk_emissive = uGlow * (0.035 + 0.02 * wet) * uFlicker;
    `,
  });
}

// Stem: woody, ridged, olive-brown fading to dry tan at the cut.
export function makeStemSurface(material) {
  return applyProceduralSurface(material, {
    cacheKey: 'pk-stem',
    bumpStrength: 0.55,
    uniforms: {
      uColorA: { value: new Color('#4a4420') },
      uColorB: { value: new Color('#8a8744') },
      uColorC: { value: new Color('#b89e6c') },
    },
    heightFn: 'pk_fbm(vec3(q.x * 30.0, q.y * 4.0, q.z * 30.0), 3) * 0.7 + pk_vnoise(q * 90.0) * 0.1',
    surface: /* glsl */ `
      vec3 p = vPkPos;
      float stripe = pk_fbm(vec3(p.x * 26.0, p.y * 3.0, p.z * 26.0), 3);
      float mottle = pk_fbm(p * 9.0 + 4.0, 3);
      float topDry = smoothstep(0.26, 0.42, p.y);
      vec3 col = mix(uColorA, uColorB, smoothstep(0.15, 0.85, stripe));
      col = mix(col, uColorC, topDry * 0.6);
      col *= 0.9 + mottle * 0.2;
      pk_albedo = col;
      pk_rough = (mottle - 0.5) * 0.15;
    `,
  });
}

// Weathered dark wooden table / deck boards.
export function makeWoodSurface(material) {
  return applyProceduralSurface(material, {
    cacheKey: 'pk-wood',
    bumpStrength: 0.45,
    uniforms: {
      uColorA: { value: new Color('#120c07') },
      uColorB: { value: new Color('#2e1f12') },
      uColorC: { value: new Color('#45311e') },
      uPlank: { value: 0.72 },
    },
    heightFn: 'pk_fbm(vec3(q.x * 10.0, 0.0, q.z * 1.2), 3) * 0.35',
    surface: /* glsl */ `
      vec3 p = vPkPos;
      float plankId = floor(p.x / uPlank);
      float u = fract(p.x / uPlank);
      float seam = smoothstep(0.0, 0.03, u) * (1.0 - smoothstep(0.97, 1.0, u));
      float shift = pk_hash(vec3(plankId, 1.0, 2.0)) * 50.0;
      float grain = pk_fbm(vec3(p.x * 10.0 + shift, 0.0, p.z * 1.2 + shift), 3);
      float broad = pk_fbm(vec3(p.x * 0.6 + shift, 0.0, p.z * 0.9), 3);
      float tone = pk_hash(vec3(plankId, 7.0, 3.0));
      vec3 col = mix(uColorA, uColorB, smoothstep(0.15, 0.9, grain));
      col = mix(col, uColorC, broad * 0.35 + tone * 0.15);
      col *= 0.6 + 0.4 * seam;
      pk_albedo = col;
      pk_rough = (grain - 0.5) * 0.25 + (1.0 - seam) * 0.3;
    `,
  });
}
