import { fbm3D } from '../noise.js';

// Shared between the CPU geometry builder and the GPU skin shader so the
// rib creases in the shading line up with the geometry.
export const SHAPE = {
  ribs: 10,
  ribJitter: 0.08,
  ribDepth: 0.06,
  heightScale: 0.92,
  topDimple: 0.1,
  bottomFlatten: 0.03,
  wallScale: 0.86, // inner shell scale relative to the outer shell
  noiseAmp: 0.03,
};

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Map a point on the unit sphere to the pumpkin surface. */
export function displacePoint(x, y, z, scale, noise) {
  const th = Math.atan2(x, z);
  const thj = th + SHAPE.ribJitter * Math.sin(3 * th + 1.3);
  const lobe = Math.abs(Math.cos(SHAPE.ribs * 0.5 * thj));
  const lobeShape = Math.pow(lobe, 0.42);
  const lat = 1 - y * y;
  const depth = SHAPE.ribDepth * (0.3 + 0.7 * lat);
  let r = 1 - depth * (1 - lobeShape);
  r *= 1 + SHAPE.noiseAmp * fbm3D(noise, x * 1.6 + 3.1, y * 1.6, z * 1.6, 3);

  let px = x * r;
  let py = y * r;
  let pz = z * r;

  py *= SHAPE.heightScale;
  const t = smoothstep(0.42, 1.0, y);
  py -= SHAPE.topDimple * t * t;
  const b = smoothstep(-0.55, -1.0, y);
  py += SHAPE.bottomFlatten * b * b;

  return [px * scale, py * scale, pz * scale];
}
