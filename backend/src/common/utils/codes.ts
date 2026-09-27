import { randomBytes } from 'node:crypto';
import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';

/** Temporary unique value for a `code` column until the row id is known (fits VARCHAR(20)). */
export function placeholderCode() {
  return `tmp-${randomBytes(8).toString('hex')}`;
}

/**
 * Public, human-readable codes derived from the auto-increment id so they are unique without
 * a sequence table: AH10001, GD-100001, YC-1001, TK-1001.
 */
export async function assignCode<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  id: number,
  prefix: string,
  base: number,
) {
  const code = `${prefix}${base + id}`;
  await manager.update(entity, { id } as never, { code } as never);
  return code;
}
