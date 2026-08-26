import { jlfBadRequest } from "@/server/modules/judicia/legal-form/jlf-service-errors";

export function asRecord(value: unknown, label = "Payload") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    jlfBadRequest(`${label} tidak valid.`);
  }

  return value as Record<string, unknown>;
}

export function readStringValue(
  payload: Record<string, unknown>,
  key: string,
  options: { required?: boolean; maxLength?: number; label?: string } = {}
) {
  const label = options.label ?? key;
  const raw = payload[key];
  const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();

  if (options.required && !value) {
    jlfBadRequest(`${label} wajib diisi.`);
  }

  if (options.maxLength && value.length > options.maxLength) {
    jlfBadRequest(`${label} maksimal ${options.maxLength} karakter.`);
  }

  return value;
}

export function readOptionalStringValue(
  payload: Record<string, unknown>,
  key: string,
  options: { maxLength?: number; label?: string } = {}
) {
  const value = readStringValue(payload, key, options);
  return value || undefined;
}

export function readBooleanValue(payload: Record<string, unknown>, key: string, fallback = false) {
  const raw = payload[key];
  if (raw === undefined || raw === null || raw === "") return fallback;
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw === 1;
  if (typeof raw === "string") return raw === "true" || raw === "1";
  return fallback;
}

export function readNumberValue(
  payload: Record<string, unknown>,
  key: string,
  options: { fallback?: number; min?: number; max?: number; label?: string } = {}
) {
  const raw = payload[key];
  const numeric = typeof raw === "number" ? raw : Number(raw);
  const value = Number.isFinite(numeric) ? numeric : options.fallback;

  if (value === undefined) {
    jlfBadRequest(`${options.label ?? key} harus berupa angka.`);
  }

  if (options.min !== undefined && value < options.min) {
    jlfBadRequest(`${options.label ?? key} minimal ${options.min}.`);
  }

  if (options.max !== undefined && value > options.max) {
    jlfBadRequest(`${options.label ?? key} maksimal ${options.max}.`);
  }

  return value;
}

export function readJsonSettingValue(payload: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(payload, "value")) {
    jlfBadRequest("Nilai pengaturan wajib diisi.");
  }

  const value = payload.value;
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    jlfBadRequest("Nilai pengaturan tidak valid.");
  }

  return value as unknown;
}

export function normalizeSafeSearchQuery(value: string, label: string, minLength = 2) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < minLength) {
    jlfBadRequest(`${label} minimal ${minLength} karakter.`);
  }
  if (normalized.length > 120) {
    jlfBadRequest(`${label} maksimal 120 karakter.`);
  }
  return normalized;
}

export function readLimit(value: string | null | undefined, fallback = 20, max = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(numeric)));
}

export function normalizeJlfSettingKey(key: string) {
  const normalized = key.trim();
  if (!/^jlf\.[a-z0-9_.-]+$/.test(normalized)) {
    jlfBadRequest("Key pengaturan JLF tidak valid.");
  }
  return normalized;
}

export function normalizeId(value: string, label = "ID") {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || !/^[a-zA-Z0-9_.:-]+$/.test(normalized)) {
    jlfBadRequest(`${label} tidak valid.`);
  }
  return normalized;
}
