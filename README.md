# Magic 8 Pumpkin

An interactive 3D Magic 8 Ball pumpkin carving. Ask a yes-or-no question, drag the pumpkin to spin it, and the carved window on the back reveals your fortune.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
npm run preview  # serve the production build
```

## How it works

- **Three.js r186 + Vite 8**, vanilla JavaScript.
- **Real carving.** The pumpkin is a hollow double shell; the "8" face and the triangular answer window are cut with constructive solid geometry (`three-bvh-csg`), so the candle inside really shines through the holes and the cut walls show pumpkin flesh.
- **Procedural surfaces.** Skin, flesh, stem and the wooden table are shaded in GLSL from object-space noise (no texture files, no seams).
- **Lighting.** Flickering shadow-casting candle inside the pumpkin, moonlight, a warm key light, image-based lighting from a procedural night sky, HDR bloom, filmic tone mapping, vignette and grain.
- **Spin physics.** A fling decelerates under dry friction and is solved to stop with the answer window facing you. A slow drag just rotates the pumpkin for a closer look.

Source layout: `src/scene/` (pumpkin geometry/CSG, materials, candle, environment, oracle window, renderer), `src/interaction/spin.js`, `src/ui/ui.js`, `src/answers.js`.
