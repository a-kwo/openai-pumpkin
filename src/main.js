import { Group, PerspectiveCamera, Scene, Vector3 } from 'three';
import { createRenderer } from './scene/renderer.js';
import { createEnvironment } from './scene/environment.js';
import { buildPumpkin, CARVE } from './scene/pumpkin.js';
import { createCandle } from './scene/candle.js';
import { createOracle } from './scene/oracle.js';
import { createSpinController } from './interaction/spin.js';
import { createUI } from './ui/ui.js';
import { pickAnswer } from './answers.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function init() {
  const canvas = document.getElementById('scene');
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 200);
  const camBase = new Vector3(0, 1.35, 5.4);
  const lookAt = new Vector3(0, 0.9, 0);
  camera.position.copy(camBase);
  camera.lookAt(lookAt);

  const view = createRenderer(canvas, scene, camera);
  const env = createEnvironment(scene, view.renderer);

  let pendingAnswer = null;
  const ui = createUI({ onSpin: () => { ui.hideHint(); spin.impulse(9); } });
  ui.setLoading('Growing the gourd…');
  await nextFrame();

  const pumpkin = buildPumpkin((msg) => ui.setLoading(msg));
  const pivot = pumpkin; // body-frame tilt lives on this group
  const spinGroup = new Group();
  spinGroup.add(pivot);
  pivot.position.y = -pumpkin.userData.minY - 0.01;
  scene.add(spinGroup);

  const candle = createCandle();
  candle.group.position.y = pumpkin.userData.minY * 0.86 + 0.02;
  pivot.add(candle.group);

  const oracle = createOracle(CARVE.windowSize, CARVE.windowY);
  pivot.add(oracle.group);

  const spin = createSpinController(canvas, {
    onGrab() { ui.hideHint(); if (pendingAnswer) { oracle.hide(); ui.hideAnswer(); pendingAnswer = null; } },
    onSpinStart() { ui.setSpinning(true); oracle.hide(); ui.hideAnswer(); pendingAnswer = pickAnswer(); },
    onSettle() {
      ui.setSpinning(false);
      if (pendingAnswer) { const a = pendingAnswer; oracle.reveal(a.text); setTimeout(() => ui.showAnswer(a), 700); }
    },
  });

  // Pointer parallax when not dragging
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    if (spin.state.dragging) return;
    parallax.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    parallax.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  window.__pk = { spin, camera, scene, pumpkin, candle, oracle, view };
  await nextFrame();
  view.composer.render();
  ui.ready();

  let t = 0, intro = 0, last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    t += dt;
    intro = Math.min(1, intro + dt / 2.2);
    const ei = 1 - Math.pow(1 - intro, 3);

    const s = spin.update(dt);
    spinGroup.rotation.y = s.angle + (1 - ei) * -0.9;
    pivot.rotation.x = s.tilt;

    const flicker = candle.update(dt, camera);
    for (const m of pumpkin.userData.materials) m.userData.uniforms.uFlicker.value = flicker;
    oracle.update(dt);
    env.update(dt);

    parallax.x += (parallax.tx - parallax.x) * Math.min(1, dt * 3);
    parallax.y += (parallax.ty - parallax.y) * Math.min(1, dt * 3);
    camera.position.set(camBase.x + parallax.x * 0.25, camBase.y - parallax.y * 0.12 + (1 - ei) * 0.25, camBase.z + (1 - ei) * 1.4);
    camera.lookAt(lookAt);

    view.render(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

init().catch((err) => {
  console.error(err);
  document.getElementById('loader-text').textContent = 'Something went wrong carving the pumpkin. See console.';
});
