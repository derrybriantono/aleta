export async function readJsonResponseSafe<T>(response: Response): Promise<{
  payload: T | null;
  rawText: string;
}> {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      payload: null,
      rawText,
    };
  }

  try {
    return {
      payload: JSON.parse(trimmed) as T,
      rawText,
    };
  } catch {
    return {
      payload: null,
      rawText,
    };
  }
}

export function summarizePlainTextError(rawText: string, fallbackMessage: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return fallbackMessage;
  }

  if (/^internal server error$/i.test(trimmed)) {
    return fallbackMessage;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}
