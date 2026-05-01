/**
 * Generate a unique, prefixed ID using crypto.randomUUID().
 *
 * Format: `<prefix>-<full UUID without dashes>`
 * Example: `usr-a3f2c19e4b0d47e8a1c3f7d9e2b5a8c6`
 *
 * Menggunakan randomUUID() menghilangkan race condition yang terjadi
 * saat dua request berjalan bersamaan dan keduanya membaca ID yang sama
 * sebelum salah satu sempat INSERT (duplicate key violation).
 */
export async function nextPrefixedId(
  _db: unknown,
  _tableName: string,
  prefix: string
): Promise<string> {
  const uuid = crypto.randomUUID();
  return `${prefix}-${uuid}`;
}
