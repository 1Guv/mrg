import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps a path on this site, with its query', () => {
    expect(safeReturnUrl('/list-plate?plate=YO1&price=146800.00')).toBe('/list-plate?plate=YO1&price=146800.00');
  });

  it('rejects other sites and anything that is not a path', () => {
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('/\\evil.example')).toBeNull();
    expect(safeReturnUrl('javascript:alert(1)')).toBeNull();
    expect(safeReturnUrl('')).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
  });

  it('never loops back to login or register', () => {
    expect(safeReturnUrl('/login?returnUrl=/x')).toBeNull();
    expect(safeReturnUrl('/register')).toBeNull();
  });
});
