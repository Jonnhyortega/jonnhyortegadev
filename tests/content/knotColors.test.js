import { describe, it, expect } from 'vitest';
import { buildKnotVertexColors } from '@/components/three/knotColors.js';

const makePos = (n) => ({
  count: n,
  getX: (i) => i * 0.37,
  getY: (i) => i * 0.11,
  getZ: (i) => i * 0.53,
});

describe('buildKnotVertexColors', () => {
  it('devuelve 3 floats por vértice dentro de [0,1]', () => {
    const out = buildKnotVertexColors({ violet: '#7c3aed', magenta: '#c026d3', gold: '#facc15' }, makePos(50));
    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(150);
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('con tres colores iguales todos los vértices tienen ese color', () => {
    const out = buildKnotVertexColors({ violet: '#ff0000', magenta: '#ff0000', gold: '#ff0000' }, makePos(5));
    expect(out[0]).toBeCloseTo(out[3], 5);
    expect(out[1]).toBeCloseTo(0, 5);
  });
});
