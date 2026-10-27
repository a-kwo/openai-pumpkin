import { BufferGeometry, CanvasTexture, CircleGeometry, Float32BufferAttribute, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace } from 'three';

// The answer window: a glossy ink-dark disc behind the carved triangle and a
// floating die face whose letters rise to the surface.
export function createOracle(windowSize, windowY) {
  const group = new Group();

  const ink = new Mesh(new CircleGeometry(0.5, 48), new MeshPhysicalMaterial({ color: 0x070c22, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }));
  ink.position.set(0, windowY, -0.66);
  ink.rotation.y = Math.PI;
  ink.castShadow = true;
  group.add(ink);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;

  const s = windowSize * 0.78, h = s * Math.sqrt(3) / 2;
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute([0, h * 2 / 3, 0, -s / 2, -h / 3, 0, s / 2, -h / 3, 0], 3));
  geo.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geo.setAttribute('uv', new Float32BufferAttribute([0.5, 1 - 60 / 1024, 60 / 1024, 1 - 880 / 1024, 1 - 60 / 1024, 1 - 880 / 1024], 2));
  geo.setIndex([0, 1, 2]);
  const dieMat = new MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.5, transparent: true, opacity: 0 });
  const die = new Mesh(geo, dieMat);
  die.position.set(0, windowY, -0.66);
  die.rotation.y = Math.PI;
  group.add(die);

  function draw(text) {
    ctx.clearRect(0, 0, 1024, 1024);
    const g = ctx.createLinearGradient(0, 60, 0, 880);
    g.addColorStop(0, '#20367a'); g.addColorStop(1, '#0c1744');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(512, 60); ctx.lineTo(964, 880); ctx.lineTo(60, 880); ctx.closePath(); ctx.fill();
    const words = text.toUpperCase().split(' ');
    let size = 96, lines;
    for (; size >= 44; size -= 6) {
      ctx.font = `700 ${size}px Inter, Arial, sans-serif`;
      lines = []; let line = '';
      const ys = [460, 580, 700, 820];
      let li = 0, ok = true;
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        const avail = 904 * (ys[li] - 60) / 820 - 70;
        if (ctx.measureText(test).width <= avail) line = test;
        else { if (!line) { ok = false; break; } lines.push(line); line = w; li++; if (li >= ys.length) { ok = false; break; } if (ctx.measureText(w).width > 904 * (ys[li] - 60) / 820 - 70) { ok = false; break; } }
      }
      if (ok) { lines.push(line); break; }
    }
    ctx.fillStyle = '#f4f7ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(160,190,255,0.9)'; ctx.shadowBlur = 24;
    const ys = [460, 580, 700, 820];
    const start = Math.max(0, ys.length - lines.length) ;
    const offset = lines.length === 1 ? 640 : lines.length === 2 ? 580 : lines.length === 3 ? 520 : 460;
    lines.forEach((l, i) => ctx.fillText(l, 512, offset + i * (size + 18) - (lines.length - 1) * (size + 18) / 2 + (lines.length - 1) * (size + 18) / 2 * 0 ));
    tex.needsUpdate = true;
  }

  let target = 0, phase = 0;
  return {
    group,
    reveal(text) { draw(text); target = 1; },
    hide() { target = 0; },
    update(dt) {
      phase += (target - phase) * Math.min(1, dt * (target ? 2.2 : 5));
      const e = phase * phase * (3 - 2 * phase);
      dieMat.opacity = e;
      die.position.z = -0.66 - 0.05 * e;
      die.rotation.z = Math.sin((1 - e) * 2.5) * 0.25;
    },
  };
}
