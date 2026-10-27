import {
  DoubleSide, BoxGeometry, BufferGeometry, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh,
  MeshPhysicalMaterial, Shape, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import fontJson from '../assets/helvetiker_bold.typeface.json';
import { createNoise3D } from '../noise.js';
import { SHAPE, displacePoint } from './pumpkinShape.js';
import { makeSkinSurface, makeFleshSurface, makeStemSurface } from './shaders.js';

export const CARVE = { discRadius: 0.36, discY: 0.02, ringInner: 0.43, ringOuter: 0.51, bridges: 2, bridgeWidth: 0.07, windowSize: 0.62, windowY: 0.0 };

function buildShell(scale, noise, inward) {
  const sphere = new SphereGeometry(1, 176, 120);
  sphere.deleteAttribute('uv');
  const geo = mergeVertices(sphere);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = displacePoint(pos.getX(i), pos.getY(i), pos.getZ(i), scale, noise);
    pos.setXYZ(i, x, y, z);
  }
  if (inward) {
    const idx = geo.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
  geo.deleteAttribute('normal');
  geo.computeVertexNormals();
  return geo;
}

function buildStem() {
  const rows = 26, cols = 40, H = 0.44;
  const positions = [], indices = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const base = 0.2 - 0.075 * Math.min(1, t / 0.32) + 0.025 * Math.max(0, (t - 0.78) / 0.22);
    const cx = 0.2 * t * t, cz = 0.07 * t * t;
    for (let c = 0; c <= cols; c++) {
      const a = (c / cols) * Math.PI * 2;
      const ridge = Math.pow(0.5 + 0.5 * Math.cos(6 * a + t * 0.8), 1.4);
      const rad = base * (1 + 0.14 * (ridge - 0.5));
      positions.push(cx + Math.cos(a) * rad, t * H, cz + Math.sin(a) * rad);
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c, b = a + cols + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const top = positions.length / 3;
  positions.push(0.2 + 0.0, H - 0.02, 0.07);
  for (let c = 0; c < cols; c++) { const a = rows * (cols + 1) + c; indices.push(a, top, a + 1); }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  const merged = mergeVertices(geo);
  merged.computeVertexNormals();
  return merged;
}

function roundedTriangle(size, radius) {
  const h = size * Math.sqrt(3) / 2;
  const pts = [new Vector3(0, h * 2 / 3), new Vector3(size / 2, -h / 3), new Vector3(-size / 2, -h / 3)];
  const shape = new Shape();
  for (let i = 0; i < 3; i++) {
    const p = pts[i], prev = pts[(i + 2) % 3], next = pts[(i + 1) % 3];
    const a = p.clone().sub(prev).normalize(), b = next.clone().sub(p).normalize();
    const s = p.clone().sub(a.clone().multiplyScalar(radius)), e = p.clone().add(b.clone().multiplyScalar(radius));
    if (i === 0) shape.moveTo(s.x, s.y); else shape.lineTo(s.x, s.y);
    shape.quadraticCurveTo(p.x, p.y, e.x, e.y);
  }
  shape.closePath();
  return shape;
}

export function buildPumpkin(onProgress = () => {}) {
  const noise = createNoise3D(2024);

  const skinMat = makeSkinSurface(new MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.32, sheen: 0.15, sheenColor: 0xffb070,
  }), SHAPE);
  const fleshMat = makeFleshSurface(new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0 }));
  const stemMat = makeStemSurface(new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 }));

  skinMat.shadowSide = DoubleSide;
  fleshMat.shadowSide = DoubleSide;
  onProgress('Growing the gourd…');
  const outer = buildShell(1, noise, false);
  const inner = buildShell(SHAPE.wallScale, noise, true);
  const hollow = mergeGeometries([outer, inner], true);
  const hollowBrush = new Brush(hollow, [skinMat, fleshMat]);
  hollowBrush.updateMatrixWorld();

  const evaluator = new Evaluator();
  evaluator.attributes = ['position', 'normal'];

  onProgress('Carving the eight…');
  const disc = new CylinderGeometry(CARVE.discRadius, CARVE.discRadius, 1.35, 96);
  disc.rotateX(Math.PI / 2);
  disc.translate(0, CARVE.discY, 0.95);
  const discBrush = new Brush(disc, fleshMat);
  discBrush.updateMatrixWorld();

  const font = new FontLoader().parse(fontJson);
  const eight = new TextGeometry('8', { font, size: 1, depth: 1.5, curveSegments: 14, bevelEnabled: false });
  eight.computeBoundingBox();
  const bb = eight.boundingBox;
  const targetH = CARVE.discRadius * 2 * 0.78;
  const s = targetH / (bb.max.y - bb.min.y);
  eight.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
  eight.scale(s, s, 1);
  eight.translate(0, CARVE.discY, 0.2);
  const eightBrush = new Brush(eight, fleshMat);
  eightBrush.updateMatrixWorld();
  let frontCutter = evaluator.evaluate(discBrush, eightBrush, SUBTRACTION);
  // Two thin tabs keep the 8 attached to the rim.
  const tabLen = CARVE.discRadius - targetH / 2 + 0.03;
  const tabs = mergeGeometries([
    new BoxGeometry(0.06, tabLen, 1.6).translate(0, CARVE.discY + targetH / 2 + tabLen / 2 - 0.03, 0.95),
    new BoxGeometry(0.06, tabLen, 1.6).translate(0, CARVE.discY - targetH / 2 - tabLen / 2 + 0.03, 0.95),
  ], false);
  tabs.deleteAttribute('uv');
  const tabBrush = new Brush(tabs, fleshMat);
  tabBrush.updateMatrixWorld();
  frontCutter = evaluator.evaluate(frontCutter, tabBrush, SUBTRACTION);
  frontCutter.updateMatrixWorld();

  // Ring around the face, attached only at the left and right (theta = 0 and pi).
  const ringParts = [];
  const gap = CARVE.bridgeWidth / CARVE.ringOuter;
  for (let i = 0; i < CARVE.bridges; i++) {
    const a0 = (i / CARVE.bridges) * Math.PI * 2 + gap / 2;
    const a1 = ((i + 1) / CARVE.bridges) * Math.PI * 2 - gap / 2;
    const shape = new Shape();
    shape.absarc(0, 0, CARVE.ringOuter, a0, a1, false);
    shape.absarc(0, 0, CARVE.ringInner, a1, a0, true);
    shape.closePath();
    const seg = new ExtrudeGeometry(shape, { depth: 1.35, bevelEnabled: false, curveSegments: 32 });
    seg.deleteAttribute('uv');
    ringParts.push(seg);
  }
  const ring = mergeGeometries(ringParts, false);
  ring.translate(0, CARVE.discY, 0.25);
  const ringBrush = new Brush(ring, fleshMat);
  ringBrush.updateMatrixWorld();

  const tri = new ExtrudeGeometry(roundedTriangle(CARVE.windowSize, 0.07), { depth: 1.35, bevelEnabled: false, curveSegments: 10 });
  tri.translate(0, CARVE.windowY, -1.6);
  const triBrush = new Brush(tri, fleshMat);
  triBrush.updateMatrixWorld();

  let result = evaluator.evaluate(hollowBrush, frontCutter, SUBTRACTION);
  result = evaluator.evaluate(result, ringBrush, SUBTRACTION);
  onProgress('Cutting the window…');
  result = evaluator.evaluate(result, triBrush, SUBTRACTION);

  const body = new Mesh(result.geometry, result.material);
  body.castShadow = true;
  body.receiveShadow = true;

  const stem = new Mesh(buildStem(), stemMat);
  stem.position.set(-0.03, SHAPE.heightScale - SHAPE.topDimple - 0.05, 0.0);
  stem.rotation.z = 0.12;
  stem.castShadow = true;

  const group = new Group();
  group.add(body, stem);

  outer.computeBoundingBox();
  group.userData.minY = outer.boundingBox.min.y;
  group.userData.materials = [skinMat, fleshMat, stemMat];
  return group;
}
