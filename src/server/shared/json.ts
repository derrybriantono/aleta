export function parseJsonArray<T>(value: string | null | undefined) {
  if (!value) return [] as T[];

  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as T[];
  }
}

export function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? []);
}

export function toBooleanInt(value: boolean) {
  return value ? 1 : 0;
}
