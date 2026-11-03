import { MINIMUM_PLATE_VALUE, priceValuation } from './minimum-value';

describe('priceValuation', () => {
  it('keeps a value at or above the minimum, with the usual range', () => {
    expect(priceValuation(1000)).toEqual({
      calculatedPrice: 1000, price: 1000, minPrice: 250, maxPrice: 1250, belowMinimum: false,
    });
    expect(priceValuation(MINIMUM_PLATE_VALUE.max).belowMinimum).toBeFalse();
  });

  it('values a negative calculation at the minimum range, keeping the calculated figure', () => {
    // MY75DBX: £250 base + £580 year − £200 age letters − £5,000 for 3 words
    expect(priceValuation(-4370)).toEqual({
      calculatedPrice: -4370, price: 250, minPrice: 100, maxPrice: 250, belowMinimum: true,
    });
  });

  it('applies the minimum to small positive values too, so min never exceeds max', () => {
    const v = priceValuation(120);
    expect(v.belowMinimum).toBeTrue();
    expect(v.minPrice).toBeLessThanOrEqual(v.maxPrice);
  });

  it('treats zero as below the minimum', () => {
    expect(priceValuation(0).price).toBe(MINIMUM_PLATE_VALUE.max);
  });
});
