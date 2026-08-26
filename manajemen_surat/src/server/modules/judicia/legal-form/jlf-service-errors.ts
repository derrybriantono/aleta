import { ApiError } from "@/server/shared/errors";

export class JlfServiceError extends ApiError {
  constructor(status: number, message: string, details?: unknown) {
    super(status, message, details);
    this.name = "JlfServiceError";
  }
}

export function jlfBadRequest(message: string, details?: unknown): never {
  throw new JlfServiceError(400, message, details);
}

export function jlfForbidden(message = "Anda tidak memiliki izin Judicia Legal Form untuk aksi ini."): never {
  throw new JlfServiceError(403, message);
}

export function jlfNotFound(message = "Data Judicia Legal Form tidak ditemukan."): never {
  throw new JlfServiceError(404, message);
}

export function jlfConflict(message: string, details?: unknown): never {
  throw new JlfServiceError(409, message, details);
}
