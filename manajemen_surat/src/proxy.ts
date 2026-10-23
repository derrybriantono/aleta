import { NextResponse, type NextRequest } from "next/server";

const securityHeaders = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["X-DNS-Prefetch-Control", "off"],
  ["X-Permitted-Cross-Domain-Policies", "none"],
  ["Permissions-Policy", "camera=(), microphone=(), payment=(), usb=()"],
] as const;

const noStoreHeaders = [
  ["Cache-Control", "no-store, private"],
  ["Pragma", "no-cache"],
  ["Expires", "0"],
] as const;

const adminSecurityHeaders = [
  ["Content-Security-Policy", "frame-ancestors 'self'"],
  ["Referrer-Policy", "no-referrer"],
  ["X-Frame-Options", "SAMEORIGIN"],
] as const;

function stripBasePath(pathname: string) {
  if (pathname === "/aleta") return "/";
  return pathname.startsWith("/aleta/") ? pathname.slice("/aleta".length) : pathname;
}

function isSensitiveApiPath(pathname: string) {
  const normalizedPath = stripBasePath(pathname);
  return normalizedPath.startsWith("/api/") && !normalizedPath.startsWith("/api/public/");
}

function isAdminPath(pathname: string) {
  const normalizedPath = stripBasePath(pathname);
  return (
    normalizedPath === "/admin" ||
    normalizedPath.startsWith("/admin/") ||
    normalizedPath.startsWith("/api/admin/")
  );
}

function isSetupPath(pathname: string) {
  const normalizedPath = stripBasePath(pathname);
  return normalizedPath === "/setup" || normalizedPath.startsWith("/setup/");
}

// ============================================================================
// KUKI PERANGKAT (23 Okt 2026) - jejak masuk & batas perangkat
// ============================================================================
//
// Satu peramban = satu perangkat: UUID acak, httpOnly, masa 400 hari (batas
// atas peramban; rancangan awal 2 tahun dipotong peramban). Dipasang
// bila belum ada, dan masanya diperbarui saat halaman dibuka (bukan pada tiap
// panggilan API). Nama & bentuknya sama dengan server/modules/perangkat/
// jaringan.ts; disalin di sini supaya proxy tidak memuat modul node:crypto.
const KUKI_PERANGKAT = "aleta_perangkat";
const POLA_ID_PERANGKAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function pasangKukiPerangkat(request: NextRequest, response: NextResponse) {
  const ada = request.cookies.get(KUKI_PERANGKAT)?.value?.toLowerCase() ?? "";
  const sah = POLA_ID_PERANGKAT.test(ada);
  const halaman = (request.headers.get("accept") ?? "").includes("text/html");
  if (sah && !halaman) return;
  const nilai = sah ? ada : globalThis.crypto.randomUUID();
  response.cookies.set(KUKI_PERANGKAT, nilai, {
    httpOnly: true,
    sameSite: "lax",
    path: (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "") || "/",
    maxAge: 400 * 24 * 60 * 60,
  });
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  try {
    pasangKukiPerangkat(request, response);
  } catch {
    /* kuki perangkat tidak boleh menahan halaman apa pun */
  }
  const adminPath = isAdminPath(request.nextUrl.pathname);
  const setupPath = isSetupPath(request.nextUrl.pathname);

  for (const [name, value] of securityHeaders) {
    response.headers.set(name, value);
  }

  if (adminPath || setupPath) {
    for (const [name, value] of adminSecurityHeaders) {
      response.headers.set(name, value);
    }
  }

  if (adminPath || setupPath || isSensitiveApiPath(request.nextUrl.pathname)) {
    for (const [name, value] of noStoreHeaders) {
      response.headers.set(name, value);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
