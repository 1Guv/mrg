//export const datelessPattern = /^([0-9]{1,3}[A-Za-z]{1,3}|[A-Za-z]{1,3}[0-9]{1,3})$/;
// export const datelessPattern = /^([0-9]{1,3}\s?[A-Za-z]{1,3}|[A-Za-z]{1,3}\s?[0-9]{1,3})$/;
// export const datelessPattern = /^([0-9]{1,3}\s?[A-Za-z]{1,3}|[A-Za-z]{1,3}\s?[0-9]{1,3}|[0-9]{4}\s?[A-Za-z]{2})$/;

/**
 * Regular expression pattern for "dateless" (pre-1963) license plates in certain formats.
 * This pattern validates plates that follow numerical/alphabetical combinations, allowing
 * for an optional single space between the two parts.
 *
 * It supports four main formats:
 * 1. P1: 1-3 numbers followed by 1-3 letters (e.g., "1 A", "123 ABC")
 * 2. P2: 1-3 letters followed by 1-3 numbers (e.g., "A 1", "ABC 123")
 * 3. P3: 4 numbers followed by 2 letters (e.g., "1979 AB")
 * 4. P4: 4 numbers followed by 1 letter (e.g., "1979 J") <-- This is the new rule.
 *
 * The `\s?` allows for zero or one space.
 */
export const datelessPattern = /^([0-9]{1,3}\s?[A-Za-z]{1,3}|[A-Za-z]{1,3}\s?[0-9]{1,3}|[0-9]{4}\s?[A-Za-z]{2}|[0-9]{4}\s?[A-Za-z]{1})$/;
