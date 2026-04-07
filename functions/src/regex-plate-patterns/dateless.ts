/**
 * Matches dateless (pre-1963) plates in four formats:
 * P1: 1-3 digits then 1-3 letters  e.g. "123 ABC"
 * P2: 1-3 letters then 1-3 digits  e.g. "ABC 123"
 * P3: 4 digits then 2 letters      e.g. "1979 AB"
 * P4: 4 digits then 1 letter       e.g. "1979 J"
 * An optional single space is allowed between the two parts.
 */
// eslint-disable-next-line max-len
export const datelessPattern = /^([0-9]{1,3}\s?[A-Za-z]{1,3}|[A-Za-z]{1,3}\s?[0-9]{1,3}|[0-9]{4}\s?[A-Za-z]{2}|[0-9]{4}\s?[A-Za-z]{1})$/;
