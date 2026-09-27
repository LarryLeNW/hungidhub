import type { ColumnOptions } from 'typeorm';

/**
 * VND amounts are whole numbers, but revenue-scale totals overflow MySQL INT (2.1 billion).
 * BIGINT is returned by the driver as a string, so convert back to number on read.
 */
export const moneyColumn = (overrides: ColumnOptions = {}): ColumnOptions => ({
  type: 'bigint',
  default: 0,
  transformer: {
    to: (value?: number | null) => value,
    from: (value?: string | number | null) =>
      value === null || value === undefined ? value : Number(value),
  },
  ...overrides,
});
