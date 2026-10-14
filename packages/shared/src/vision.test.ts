import { describe, expect, it } from 'vitest';
import { validateTagRead } from './vision.js';

const GOOD = {
  priceMinor: 125000,
  name: 'Tastee Cheese 250g',
  confidence: 0.9,
};

describe('validateTagRead', () => {
  it('accepts a well-formed model read', () => {
    const result = validateTagRead(GOOD);
    expect(result.ok).toBe(true);
  });

  it('rejects non-positive prices, out-of-range confidence, and junk', () => {
    expect(validateTagRead({ ...GOOD, priceMinor: 0 }).ok).toBe(false);
    expect(validateTagRead({ ...GOOD, priceMinor: -5 }).ok).toBe(false);
    expect(validateTagRead({ ...GOOD, confidence: 1.5 }).ok).toBe(false);
    expect(validateTagRead({ ...GOOD, priceMinor: 'a lot' }).ok).toBe(false);
    expect(validateTagRead(null).ok).toBe(false);
    // Prompt-injected extra fields never smuggle through.
    expect(validateTagRead({ ...GOOD, ignorePreviousInstructions: true }).ok).toBe(false);
  });

  it('name is optional but must be a string when present', () => {
    const { name: _dropped, ...rest } = GOOD;
    expect(validateTagRead(rest).ok).toBe(true);
    expect(validateTagRead({ ...GOOD, name: 42 }).ok).toBe(false);
  });
});
