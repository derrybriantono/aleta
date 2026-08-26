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

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
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
