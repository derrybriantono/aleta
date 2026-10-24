import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";

import { getAuth } from "@/lib/auth";
import { getDatabase } from "@/server/db/client";
import { KODE_BATAS_PERANGKAT } from "@/server/modules/perangkat/kait-auth";
import { catatPeristiwaAman } from "@/server/modules/perangkat/jejak";
import { denganIpKlien, idPerangkatDariHeader } from "@/server/modules/perangkat/jaringan";
import { tolakJalurLamaBilaSippNonaktif } from "@/server/modules/portal/masuk-sipp-plugin";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";
import {
  assertRateLimit,
  clearRateLimit,
  recordRateLimitFailure,
} from "@/server/shared/rate-limit";

function maskLoginEmail(value: string) {
  const [name = "", domain = ""] = value.trim().toLowerCase().split("@");
  if (!name || !domain) return value ? "[invalid-email]" : "";
  return `${name.slice(0, 2)}***@${domain}`;
}

export async function GET(request: NextRequest) {
  await getDatabase();
  const handler = toNextJsHandler(await getAuth());
  return handler.GET(denganIpKlien(request));
}

/**
 * Jejak masuk (23 Okt 2026): kegagalan jalur email dicatat di sini; masuk yang
 * BERHASIL dan penolakan batas perangkat dicatat kait sesi Better Auth
 * (server/modules/perangkat/kait-auth.ts) yang dilalui semua jalur.
 */
function gagalEmail(
  db: Awaited<ReturnType<typeof getDatabase>>,
  request: NextRequest,
  m: { alasan: string; userId?: string | null; identitas?: string; ingat?: boolean | null }
) {
  return catatPeristiwaAman(db, {
    peristiwa: "MASUK_GAGAL",
    alasan: m.alasan,
    jalur: "email",
    userId: m.userId ?? null,
    identitas: m.identitas,
    perangkatId: idPerangkatDariHeader(request.headers),
    headers: request.headers,
    ingat: m.ingat ?? null,
  });
}

/** Sesi pemanggil sebelum /sign-out - untuk mencatat KELUAR. Tidak pernah melempar. */
async function sesiSebelumKeluar(request: NextRequest) {
  try {
    const s = await (await getAuth()).api.getSession({ headers: request.headers });
    return s?.session?.id ? { sessionId: String(s.session.id), userId: String(s.user.id) } : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pathname = new URL(request.url).pathname;
    let rateLimitEmail = "";
    let loginUser: { id: string; is_active: number } | null = null;
    let ingatEmail: boolean | null = null;
    const keluar = pathname.endsWith("/sign-out") ? await sesiSebelumKeluar(request) : null;

    if (pathname.endsWith("/sign-in/email")) {
      const body = await request.clone().json().catch(() => null) as { email?: string; password?: string; rememberMe?: unknown } | null;
      const email = body?.email?.trim();
      rateLimitEmail = email ?? "";
      ingatEmail = typeof body?.rememberMe === "boolean" ? body.rememberMe : null;

      try {
        assertRateLimit("login", request, email);
      } catch (galat) {
        await gagalEmail(db, request, { alasan: "batas percobaan", identitas: email, ingat: ingatEmail });
        throw galat;
      }

      if (email) {
        loginUser = await db.prepare(
          `SELECT id, is_active
           FROM users
           WHERE deleted_at IS NULL
             AND LOWER(email) = LOWER(?)
           LIMIT 1`
        ).get<{ id: string; is_active: number }>(email);

        if (loginUser && !Boolean(loginUser.is_active)) {
          await appendAuditLog(db, {
            id: await nextPrefixedId(db, "audit_logs", "adt"),
            actorUserId: loginUser.id,
            action: "LOGIN_BLOCKED_INACTIVE",
            entityType: "auth",
            entityId: loginUser.id,
            payload: {
              email: maskLoginEmail(email),
              ...getRequestAuditMetadata(request),
            },
          });
          await gagalEmail(db, request, { alasan: "akun nonaktif", userId: loginUser.id, ingat: ingatEmail });
          throw new ApiError(403, "Akun ini telah diblokir dan tidak dapat digunakan untuk login.");
        }

        // Akun bertautan SIPP yang akun SIPP-nya diblokir/kedaluwarsa ikut
        // tertutup di jalur lama - sama dengan /sign-in/sipp (9 Okt 2026).
        // Super Admin dan bot yang mati tetap lolos; password yang salah
        // dibiarkan ditolak Better Auth seperti biasa.
        if (loginUser && typeof body?.password === "string" && body.password) {
          const tolak = await tolakJalurLamaBilaSippNonaktif(
            db,
            await (await getAuth()).$context,
            { userId: loginUser.id, email, sandi: body.password },
            request.headers
          );
          if (tolak) {
            await gagalEmail(db, request, { alasan: `SIPP nonaktif (${tolak.kode})`, userId: loginUser.id, ingat: ingatEmail });
            // Berbentuk jawaban Better Auth ({ message, code }) supaya
            // authClient.signIn.email menampilkan kalimatnya, ditambah bentuk
            // { ok, error } yang dibaca rute ALETA lain.
            return NextResponse.json(
              { ok: false, message: tolak.pesan, code: tolak.kode, error: { message: tolak.pesan } },
              { status: tolak.status }
            );
          }
        }
      }
    }

    const handler = toNextJsHandler(await getAuth());
    // IP klien yang benar untuk pembatas laju Better Auth (lihat lib/auth.ts).
    const response = await handler.POST(denganIpKlien(request));

    if (pathname.endsWith("/sign-in/email")) {
      if (response.ok) {
        clearRateLimit("login", request, rateLimitEmail);
        await appendAuditLog(db, {
          id: await nextPrefixedId(db, "audit_logs", "adt"),
          actorUserId: loginUser?.id ?? null,
          action: "LOGIN_SUCCESS",
          entityType: "auth",
          entityId: loginUser?.id ?? "unknown-email",
          payload: {
            email: maskLoginEmail(rateLimitEmail),
            ...getRequestAuditMetadata(request),
          },
        });
      } else if (response.status >= 400) {
        const isi = (await response.clone().json().catch(() => null)) as { code?: string } | null;
        // Penolakan batas perangkat: password BENAR, sudah dicatat kait sesi -
        // bukan percobaan gagal dan tidak menambah hitungan pembatas laju.
        if (isi?.code === KODE_BATAS_PERANGKAT) return response;
        await gagalEmail(db, request, {
          alasan: response.status === 429 ? "batas percobaan" : loginUser ? "sandi salah" : "akun tak dikenal",
          userId: loginUser?.id ?? null,
          identitas: rateLimitEmail,
          ingat: ingatEmail,
        });
        recordRateLimitFailure("login", request, rateLimitEmail);
        await appendAuditLog(db, {
          id: await nextPrefixedId(db, "audit_logs", "adt"),
          actorUserId: loginUser?.id ?? null,
          action: "LOGIN_FAILED",
          entityType: "auth",
          entityId: loginUser?.id ?? "unknown-email",
          payload: {
            email: maskLoginEmail(rateLimitEmail),
            status: response.status,
            ...getRequestAuditMetadata(request),
          },
        });
      }
    }

    if (keluar && response.ok) {
      await catatPeristiwaAman(db, {
        peristiwa: "KELUAR",
        userId: keluar.userId,
        sessionId: keluar.sessionId,
        perangkatId: idPerangkatDariHeader(request.headers),
        headers: request.headers,
      });
      await db.run("DELETE FROM aleta_sesi_perangkat WHERE session_id = ?", [keluar.sessionId]).catch(() => undefined);
      await appendAuditLog(db, {
        id: await nextPrefixedId(db, "audit_logs", "adt"),
        actorUserId: keluar.userId,
        action: "LOGOUT",
        entityType: "auth",
        entityId: keluar.userId,
        payload: getRequestAuditMetadata(request),
      }).catch(() => undefined);
    }

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
