import { ApiError } from "@/server/shared/errors";

export class EStatusServiceError extends ApiError {
  constructor(status: number, message: string, details?: unknown) {
    super(status, message, details);
    this.name = "EStatusServiceError";
  }
}

export function estatusBadRequest(message: string, details?: unknown): never {
  throw new EStatusServiceError(400, message, details);
}

export function estatusForbidden(message = "Anda tidak memiliki izin E-Status untuk aksi ini."): never {
  throw new EStatusServiceError(403, message);
}

export function estatusNotFound(message = "Data E-Status tidak ditemukan."): never {
  throw new EStatusServiceError(404, message);
}

export function estatusConflict(message: string, details?: unknown): never {
  throw new EStatusServiceError(409, message, details);
}
