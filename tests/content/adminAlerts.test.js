import { describe, it, expect } from 'vitest';
import { hasRecentAlerts } from '@/admin/lib/alerts.js';

const now = Date.parse('2026-10-16T12:00:00Z');
const ev = (event, hours) => ({ event, createdAt: new Date(now - hours * 3600e3).toISOString() });

describe('hasRecentAlerts', () => {
  it('detecta recovery_* y login_rejected dentro de 24 h', () => {
    expect(hasRecentAlerts([ev('recovery_failed', 2)], now)).toBe(true);
    expect(hasRecentAlerts([ev('login_rejected', 23)], now)).toBe(true);
  });
  it('ignora eventos viejos o de otro tipo', () => {
    expect(hasRecentAlerts([ev('recovery_failed', 25)], now)).toBe(false);
    expect(hasRecentAlerts([ev('login_success', 1), ev('logout', 1)], now)).toBe(false);
    expect(hasRecentAlerts([], now)).toBe(false);
  });
});
