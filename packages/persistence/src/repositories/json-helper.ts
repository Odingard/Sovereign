/**
 * @file PostgreSQL JSONB Field Deserialization Helper
 * @description Safe parsing for node-pg JSON/JSONB driver outputs.
 */

export function parseJsonField<T>(value: unknown, defaultValue?: T): T {
  if (value === null || value === undefined) {
    return defaultValue as T;
  }
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      return defaultValue as T;
    }
    return JSON.parse(value) as T;
  }
  return value as T;
}
