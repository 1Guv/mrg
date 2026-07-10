import { normalisePlate } from './normalise-plate';

describe('normalisePlate', () => {
  it('strips spaces and uppercases', () => {
    expect(normalisePlate('ab12 xyz')).toBe('AB12XYZ');
  });

  it('handles already-normalised input', () => {
    expect(normalisePlate('AB12XYZ')).toBe('AB12XYZ');
  });

  it('handles mixed case with spaces', () => {
    expect(normalisePlate('Ab12 Xyz')).toBe('AB12XYZ');
  });

  it('handles empty string', () => {
    expect(normalisePlate('')).toBe('');
  });
});
