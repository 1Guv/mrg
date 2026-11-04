import { feeShare } from './fee-share';

describe('feeShare', () => {
  it('rounds to a whole percent', () => {
    expect(feeShare(30, 990)).toBe('3%');
    expect(feeShare(30, 300)).toBe('10%');
  });

  it('says less than 1% for valuable plates', () => {
    expect(feeShare(30, 146800)).toBe('less than 1%');
  });

  it('hides the comparison when the fee is over 10% or there is no price', () => {
    expect(feeShare(30, 250)).toBeNull();
    expect(feeShare(30, 0)).toBeNull();
    expect(feeShare(30, NaN)).toBeNull();
  });
});
