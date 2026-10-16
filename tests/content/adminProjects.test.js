import { describe, it, expect } from 'vitest';
import { isAllowedImageUrl, moveItem, toInput, emptyProject } from '@/admin/lib/projects.js';

describe('isAllowedImageUrl', () => {
  it('acepta https en los hosts permitidos', () => {
    expect(isAllowedImageUrl('https://res.cloudinary.com/x/a.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://upload.wikimedia.org/a.svg')).toBe(true);
  });
  it('rechaza http, otros hosts, credenciales, espacios y basura', () => {
    expect(isAllowedImageUrl('http://res.cloudinary.com/a.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://evil.com/a.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://res.cloudinary.com.evil.com/a.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://u:p@res.cloudinary.com/a.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://res.cloudinary.com/a b.jpg')).toBe(false);
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
  });
});

describe('moveItem', () => {
  it('mueve hacia arriba y abajo sin mutar', () => {
    const a = [1, 2, 3];
    expect(moveItem(a, 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem(a, 1, 1)).toEqual([1, 3, 2]);
    expect(a).toEqual([1, 2, 3]);
  });
  it('en los bordes devuelve la misma lista', () => {
    expect(moveItem([1, 2], 0, -1)).toEqual([1, 2]);
    expect(moveItem([1, 2], 1, 1)).toEqual([1, 2]);
  });
});

describe('toInput', () => {
  it('deja solo los campos de entrada y normaliza links vacíos a null', () => {
    const input = toInput({ ...emptyProject(), id: 'x', position: 3, version: 2, title: 'T', liveUrl: '  ' });
    expect(Object.keys(input).sort()).toEqual(
      ['descriptionEn', 'descriptionEs', 'githubUrl', 'imageUrl', 'liveUrl', 'published', 'tech', 'title'],
    );
    expect(input.liveUrl).toBeNull();
  });
});
