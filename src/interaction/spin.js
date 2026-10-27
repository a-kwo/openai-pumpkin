// Pointer-driven spin with dry-friction deceleration. A strong fling is a
// "spin": the stop angle is solved so the answer window lands facing the
// camera (angle ≡ π mod 2π). A gentle drag just rotates for inspection.
export function createSpinController(canvas, { onSpinStart, onSettle, onGrab }) {
  const state = { angle: 0, omega: 0, mode: 'idle', target: 0, decel: 3.0, tilt: 0, dragging: false, maxOmega: 0 };
  const SENS = 0.011, FRICTION = 3.0, SPIN_MIN = 2.6, OMEGA_CAP = 13;
  let lastX = 0, samples = [];

  function down(e) {
    canvas.setPointerCapture(e.pointerId);
    state.dragging = true; state.mode = 'drag'; state.omega = 0; state.maxOmega = 0;
    lastX = e.clientX; samples = [{ t: performance.now(), a: state.angle }];
    canvas.classList.add('dragging');
    onGrab?.();
  }
  function move(e) {
    if (!state.dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX;
    state.angle += dx * SENS;
    const now = performance.now();
    samples.push({ t: now, a: state.angle });
    while (samples.length > 2 && now - samples[0].t > 90) samples.shift();
  }
  function up() {
    if (!state.dragging) return;
    state.dragging = false; canvas.classList.remove('dragging');
    const now = performance.now();
    const s0 = samples[0], s1 = samples[samples.length - 1];
    const dt = Math.max(1e-3, (s1.t - s0.t) / 1000);
    let omega = (s1.a - s0.a) / dt;
    if (now - s1.t > 120) omega = 0;
    release(omega);
  }
  function release(omega) {
    omega = Math.max(-OMEGA_CAP, Math.min(OMEGA_CAP, omega));
    state.omega = omega;
    if (Math.abs(omega) >= SPIN_MIN) {
      const s = Math.sign(omega);
      const d0 = omega * omega / (2 * FRICTION);
      const stop = state.angle + s * d0;
      const k = s > 0 ? Math.ceil((stop - Math.PI) / (2 * Math.PI)) : Math.floor((stop - Math.PI) / (2 * Math.PI));
      state.target = Math.PI + 2 * Math.PI * k;
      const d = Math.abs(state.target - state.angle);
      state.decel = omega * omega / (2 * d);
      state.mode = 'spin';
      onSpinStart?.();
    } else {
      state.decel = FRICTION; state.mode = Math.abs(omega) > 0.01 ? 'coast' : 'idle';
    }
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  return {
    state,
    impulse(strength = 9) {
      if (state.dragging) return;
      const dir = Math.random() < 0.5 ? -1 : 1;
      release(dir * (strength + Math.random() * 3));
    },
    update(dt) {
      if (state.mode === 'spin' || state.mode === 'coast') {
        const s = Math.sign(state.omega);
        state.omega -= s * state.decel * dt;
        if (Math.sign(state.omega) !== s || Math.abs(state.omega) < 1e-4) {
          state.omega = 0;
          if (state.mode === 'spin') { state.angle = state.target; onSettle?.(); }
          state.mode = 'idle';
        } else {
          state.angle += state.omega * dt;
        }
      }
      const tiltTarget = Math.min(Math.abs(state.omega) * 0.009, 0.09);
      state.tilt += (tiltTarget - state.tilt) * Math.min(1, dt * 4);
      return state;
    },
  };
}
