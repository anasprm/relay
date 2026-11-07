import { createHash } from 'node:crypto';

/**
 * Turns an arbitrary relay id (`conv_general_community`, `usr_me`, …) into a
 * stable UUID so it can be used as a foreign key in the Supabase schema.
 *
 * The mapping is deterministic, so the same relay id always resolves to the same
 * database row across requests without persisting a lookup table.
 */
export function stableUuid(seed: string): string {
  const hex = createHash('sha1').update(seed).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

/** Derives a unique, schema-safe username for a relay user. */
export function usernameFor(userId: string, email: string | null): string {
  const base =
    (email?.split('@')[0] || userId)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 24) || 'relay_user';
  const suffix = userId.replace(/[^a-z0-9]/gi, '').slice(-6) || 'local';
  return `${base}_${suffix}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a value is already a persisted Supabase UUID. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
