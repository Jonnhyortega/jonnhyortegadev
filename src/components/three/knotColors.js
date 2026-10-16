import * as THREE from 'three';

// Degradé violeta -> magenta -> dorado por vértice. Función pura para poder testearla.
// `positions` es un BufferAttribute (count, getX/getY/getZ); devuelve 3 floats por vértice.
export function buildKnotVertexColors({ violet, magenta, gold }, positions) {
  const cViolet = new THREE.Color(violet);
  const cMagenta = new THREE.Color(magenta);
  const cGold = new THREE.Color(gold);
  const out = new Float32Array(positions.count * 3);
  const tmp = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const t = 0.5 + 0.5 * Math.sin(positions.getX(i) * 1.4 + positions.getY(i) * 1.8 + positions.getZ(i) * 0.8);
    if (t < 0.55) tmp.copy(cViolet).lerp(cMagenta, t / 0.55);
    else tmp.copy(cMagenta).lerp(cGold, (t - 0.55) / 0.45);
    out.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  return out;
}
