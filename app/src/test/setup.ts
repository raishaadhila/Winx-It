import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement canvas — canvas-confetti calls into it
// during the animation frame. Mock it to a no-op so tests don't crash.
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});
