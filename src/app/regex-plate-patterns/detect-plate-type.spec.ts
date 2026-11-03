import { NumberPlateType } from '../models/reg.model';
import { detectPlateType } from './detect-plate-type';

describe('detectPlateType', () => {
  it('detects each plate type, ignoring case and spaces', () => {
    expect(detectPlateType('fa57 car')).toEqual({ type: NumberPlateType.Current, registration: 'FA57CAR' });
    expect(detectPlateType('F457 CAR')).toEqual({ type: NumberPlateType.Prefix, registration: 'F457CAR' });
    expect(detectPlateType('FAS 73R')).toEqual({ type: NumberPlateType.Suffix, registration: 'FAS73R' });
    expect(detectPlateType('FAS7')).toEqual({ type: NumberPlateType.Dateless, registration: 'FAS7' });
  });

  it('keeps a single space in dateless plates', () => {
    expect(detectPlateType('  dl   1 ')).toEqual({ type: NumberPlateType.Dateless, registration: 'DL 1' });
  });

  it('returns null for anything that is not a UK reg', () => {
    expect(detectPlateType('')).toBeNull();
    expect(detectPlateType('HELLO WORLD')).toBeNull();
    expect(detectPlateType('1234567')).toBeNull();
  });
});
