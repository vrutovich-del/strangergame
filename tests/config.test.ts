import { describe, it, expect } from 'vitest';
import { GAME_NAME, SIM_HZ } from '../src/config';

describe('config', () => {
  it('название игры задано', () => {
    expect(GAME_NAME).toBe('Игра странностей');
    expect(SIM_HZ).toBe(30);
  });
});
