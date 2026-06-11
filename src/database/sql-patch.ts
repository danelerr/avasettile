export type PatchColumn = { column: string; json?: boolean };

/**
 * Builds the SET fragment of a partial UPDATE from a camelCase patch object.
 * Only whitelisted keys are accepted — an unknown key is a programming error.
 * Parameters are appended to `values` starting after the existing entries.
 */
export function buildPatchSet(
  patch: Record<string, unknown>,
  columns: Record<string, PatchColumn>,
  values: unknown[],
): string {
  const sets: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const mapping = columns[key];
    if (!mapping) {
      throw new Error(`Unsupported patch field "${key}".`);
    }
    values.push(mapping.json ? JSON.stringify(value) : value);
    sets.push(
      `${mapping.column} = $${values.length}${mapping.json ? '::jsonb' : ''}`,
    );
  }
  sets.push('updated_at = now()');
  return sets.join(', ');
}
