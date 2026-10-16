import { beforeEach } from 'vitest';
import { resetTestDbPool } from './db.js';

// Cada test parte con el contador de bases de test en cero.
beforeEach(() => resetTestDbPool());
