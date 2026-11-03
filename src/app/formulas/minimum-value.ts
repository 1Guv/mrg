// A plate's options can subtract more than its base and year are worth, so the
// calculated figure can drop to zero or below. Below MINIMUM_PLATE_VALUE.max we
// still show that figure, but value the plate at this range instead.
export const MINIMUM_PLATE_VALUE = { min: 100, max: 250 };

// Typical range around a calculated value
export const VALUE_RANGE = { min: 0.25, max: 1.25 };

/** One option that lowered the value, for the minimum-value notice. */
export interface ValuationReason {
  label: string;
  amount: number;
}

export interface PricedValuation {
  /** What the options add up to, before any minimum is applied. */
  calculatedPrice: number;
  price: number;
  minPrice: number;
  maxPrice: number;
  belowMinimum: boolean;
}

export function priceValuation(calculatedPrice: number): PricedValuation {
  if (calculatedPrice < MINIMUM_PLATE_VALUE.max) {
    return {
      calculatedPrice,
      price: MINIMUM_PLATE_VALUE.max,
      minPrice: MINIMUM_PLATE_VALUE.min,
      maxPrice: MINIMUM_PLATE_VALUE.max,
      belowMinimum: true,
    };
  }
  return {
    calculatedPrice,
    price: calculatedPrice,
    minPrice: calculatedPrice * VALUE_RANGE.min,
    maxPrice: calculatedPrice * VALUE_RANGE.max,
    belowMinimum: false,
  };
}
