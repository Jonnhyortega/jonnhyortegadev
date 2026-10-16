import { describe, it, expect } from 'vitest';
import { contrastRatio } from '@/admin/lib/contrast.js';

describe('contrastRatio', () => {
  it('negro sobre blanco es 21', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });
  it('es simétrico', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });
  it('mismo color es 1', () => {
    expect(contrastRatio('#a855f7', '#a855f7')).toBeCloseTo(1, 5);
  });
  it('valor conocido: #777777 sobre blanco ~4.48', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
  it('acepta mayúsculas', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  });
});
