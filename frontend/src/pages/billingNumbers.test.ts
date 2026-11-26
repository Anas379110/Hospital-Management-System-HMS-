import { expect, it } from 'vitest';
import { decimalInteger } from './billingNumbers';
it.each(['', ' ', ' 1', '1 ', '1e3', '0x10', '1.0', '-1', '+1', '1,000', 'Infinity', 'NaN'])('rejects nondecimal/ambiguous input %s', value => { expect(decimalInteger(value)).toBe(false); });
it.each(['0', '1', '100', '2147483647'])('accepts decimal integer %s', value => { expect(decimalInteger(value)).toBe(true); });
