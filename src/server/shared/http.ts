import { NextResponse } from "next/server";

import { ApiError, isApiError } from "@/server/shared/errors";

function isDatabaseUnavailableError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("econnrefused") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("database") && message.includes("does not exist") ||
    message.includes("password authentication failed") ||
    message.includes("getaddrinfo")
  );
}

function isStorageUnavailableError(error: unknown) {
  if (!error) return false;

  if (typeof error === "object") {
    const candidate = error as { code?: string; message?: string };
    if (candidate.code === "ENOSPC") return true;
    if (candidate.message?.toLowerCase().includes("no space left on device")) return true;
  }

  return false;
}

function isPostgresUniqueViolation(error: unknown) {
  if (!error) return false;
  if (typeof error === "object") {
    const candidate = error as { code?: string; message?: string };
    if (candidate.code === "23505") return true;
    if (candidate.message?.includes("duplicate key value violates unique constraint")) return true;
  }
  if (typeof error === "string" && error.includes("duplicate key value violates unique constraint")) return true;
  return false;
}



export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      ok: true,
      data,
    },
    init
  );
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, details?: unknown) {
  throw new ApiError(400, message, details);
}

export function unauthorized(message = "Akses ditolak. User aktif tidak ditemukan.") {
  throw new ApiError(401, message);
}

export function forbidden(message = "Aksi ini tidak diizinkan untuk user aktif.") {
  throw new ApiError(403, message);
}

export function notFound(message = "Data yang diminta tidak ditemukan.") {
  throw new ApiError(404, message);
}

export function handleRouteError(error: unknown) {
  if (isApiError(error)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status }
    );
  }

  if (isPostgresUniqueViolation(error)) {
    const pgError = error as { detail?: string; constraint?: string; message?: string };
    const constraint = pgError.constraint ?? pgError.message ?? "";
    let message = "Data duplikat terdeteksi. Silakan periksa kembali input Anda.";

    if (constraint.includes("users_pkey")) {
      message = "Gagal membuat akun: terjadi konflik ID internal. Silakan coba lagi. (Sistem membutuhkan Anda untuk restart 'npm run dev' di terminal agar perubahan perbaikan bug UUID termuat)";
    } else if (constraint.includes("users_username_unique") || constraint.includes("username")) {
      message = "Username sudah digunakan. Pilih username lain.";
    } else if (constraint.includes("users_email_unique") || constraint.includes("email")) {
      message = "Email sudah digunakan oleh akun lain.";
    } else if (constraint.includes("accounts")) {
      message = "Akun credential sudah ada untuk user ini.";
    }

    console.error("[ALETA API UNIQUE VIOLATION]", pgError.detail ?? pgError.message ?? error);

    return NextResponse.json(
      {
        ok: false,
        error: { message },
      },
      { status: 409 }
    );
  }

  if (isDatabaseUnavailableError(error)) {
    console.error("[ALETA API DATABASE ERROR]", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          message:
            "PostgreSQL ALETA belum tersedia atau koneksinya belum benar. Jalankan database dan periksa DATABASE_URL.",
        },
      },
      { status: 503 }
    );
  }

  if (isStorageUnavailableError(error)) {
    console.error("[ALETA API STORAGE ERROR]", error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          message:
            "Penyimpanan lokal ALETA sedang penuh. Hapus file/cache yang tidak diperlukan lalu coba lagi.",
        },
      },
      { status: 507 }
    );
  }

  const message = error instanceof Error ? error.message : "Terjadi kegagalan internal pada backend ALETA.";
  console.error("[ALETA API ERROR]", error);

  return NextResponse.json(
    {
      ok: false,
      error: {
        message,
      },
    },
    { status: 500 }
  );
}
