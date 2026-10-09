/**
 * Titik masuk Better Auth untuk "masuk ALETA dengan akun SIPP":
 *
 *   POST /api/auth/sign-in/sipp  { identifier, password, rememberMe }
 *
 * Keputusannya diambil putuskanMasukSipp (masuk-sipp.ts). Di sini hanya
 * kabelnya: bot, tautan Manajemen Akun, pemeriksa password ALETA milik Better
 * Auth sendiri, jejak aleta_masuk_jejak, dan pembuatan sesi dengan cara yang
 * SAMA dengan /sign-in/email (createSession + setSessionCookie).
 *
 * Jawaban "bukan-sipp" berstatus 200 tanpa sesi: layar masuk lalu menempuh
 * jalur lama. Password tidak pernah ada di jawaban, di log, maupun di jejak.
 */

import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, formCsrfMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

import { type AletaDatabase } from "@/server/db/client";
import {
  periksaSippNonaktifJalurLama,
  putuskanMasukSipp,
  type BarisJejakMasuk,
  type JawabanVerifikasiSipp,
} from "@/server/modules/portal/masuk-sipp";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

// Modul berat (bot, Manajemen Akun, pengguna) dimuat SAAT DIPANGGIL, bukan di
// tingkat atas: lib/auth.ts memuat berkas ini, dan sebagian modul itu - lewat
// server/shared/auth - memuat lib/auth.ts kembali. Muat-saat-perlu memutus
// lingkarannya dan tidak memperlambat permintaan lain yang memuat Better Auth.
async function modulMasuk() {
  const [klien, jembatan, akun, milestone, pengguna] = await Promise.all([
    import("@/server/db/client"),
    import("@/server/modules/aleta-sipp/aleta-sipp-datasource"),
    import("@/server/modules/aleta-ecourt/court-calendar-akun"),
    import("@/server/modules/aleta-ecourt/checklist-milestone"),
    import("@/server/modules/users/service"),
  ]);
  return {
    getDatabase: klien.getDatabase,
    callAletaBotSippBridge: jembatan.callAletaBotSippBridge,
    akunSippMilik: akun.akunSippMilik,
    bacaKredensialSipp: milestone.bacaKredensialSipp,
    lookupUserForLoginInDb: pengguna.lookupUserForLoginInDb,
  };
}

/** Bot yang lambat tidak boleh membuat layar masuk menggantung lama. */
const BATAS_TUNGGU_BOT_MS = 8_000;

/** "budi.santoso" -> "bu***" - identitas lengkap sudah terwakili id akunnya. */
export function samarkanIdentitas(identitas: string) {
  const teks = String(identitas ?? "").trim();
  if (!teks) return "";
  return `${teks.slice(0, 2)}***`;
}

export async function catatJejakMasuk(db: AletaDatabase, baris: BarisJejakMasuk) {
  const id = await nextPrefixedId(db, "aleta_masuk_jejak", "msk");
  const waktu = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO aleta_masuk_jejak
         (id, aleta_user_id, identitas, username_sipp, sipp_user_id, lewat, hasil, alasan, alamat_ip, agen_peramban, dibuat_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      baris.aletaUserId,
      samarkanIdentitas(baris.identitas),
      baris.usernameSipp.slice(0, 60),
      baris.sippUserId,
      baris.lewat,
      baris.hasil,
      baris.alasan.slice(0, 80),
      baris.alamatIp,
      baris.agenPeramban,
      waktu
    );

  // Layar audit ALETA yang sudah ada membaca audit_logs - masuk lewat SIPP
  // ikut tampil di sana, dengan kata yang sama dengan masuk lama.
  if (baris.hasil === "berhasil" || baris.aletaUserId) {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: baris.aletaUserId,
      action: baris.hasil === "berhasil" ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
      entityType: "auth",
      entityId: baris.aletaUserId ?? "unknown-user",
      payload: {
        // Percobaan yang ditolak tidak masuk lewat jalur apa pun - jangan
        // dicatat seolah "sipp" (9 Okt 2026).
        lewat: baris.lewat || "-",
        akunSipp: baris.usernameSipp,
        alasan: baris.alasan,
        ipAddress: baris.alamatIp,
        userAgent: baris.agenPeramban,
      },
    });
  }
}

/** Bagian konteks Better Auth yang dipakai memeriksa password ALETA. */
export type KonteksSandiAleta = {
  internalAdapter: {
    findAccounts: (userId: string) => Promise<Array<{ providerId: string; password?: string | null }>>;
  };
  password: { verify: (masukan: { hash: string; password: string }) => Promise<boolean> };
};

async function cocokkanSandiAleta(konteks: KonteksSandiAleta, userId: string, sandi: string) {
  const akun = await konteks.internalAdapter.findAccounts(userId);
  const kredensial = akun.find((a) => a.providerId === "credential");
  if (!kredensial?.password) return false;
  return konteks.password.verify({ hash: kredensial.password, password: sandi });
}

/**
 * Dipanggil route.ts SEBELUM /sign-in/email diteruskan ke Better Auth: akun
 * bertautan SIPP yang akun SIPP-nya diblokir/kedaluwarsa ikut tertutup di
 * jalur lama (kecuali Super Admin; bot mati = lolos). Pulang null bila boleh
 * diteruskan, atau pesan 403.
 */
export async function tolakJalurLamaBilaSippNonaktif(
  db: AletaDatabase,
  konteks: KonteksSandiAleta,
  masukan: { userId: string; email: string; sandi: string },
  headers: Headers
) {
  const { callAletaBotSippBridge, akunSippMilik, bacaKredensialSipp, lookupUserForLoginInDb } = await modulMasuk();
  const u = await lookupUserForLoginInDb(db, { identifier: masukan.email });
  if (!u || u.id !== masukan.userId) return null;
  return periksaSippNonaktifJalurLama(
    {
      akunSippMilik: async (userId) => akunSippMilik(await bacaKredensialSipp(db), userId),
      verifikasiSipp: async (usernameSipp, sandi) =>
        (await callAletaBotSippBridge("user.verifikasiSandi", { username: usernameSipp, sandi }, {
          timeoutMs: BATAS_TUNGGU_BOT_MS,
        })) as JawabanVerifikasiSipp,
      verifikasiSandiAleta: (userId, sandi) => cocokkanSandiAleta(konteks, userId, sandi),
      catatJejak: (baris) => catatJejakMasuk(db, baris),
    },
    { pengguna: { id: u.id, roleId: u.roleId, name: u.name }, identitas: masukan.email, sandi: masukan.sandi },
    { headers }
  );
}

const badanMasuk = z.object({
  identifier: z.string().max(200),
  password: z.string().max(400),
  rememberMe: z.boolean().optional(),
});

export function masukSippPlugin() {
  return {
    id: "aleta-masuk-sipp",
    endpoints: {
      masukDenganSipp: createAuthEndpoint(
        "/sign-in/sipp",
        { method: "POST", use: [formCsrfMiddleware], body: badanMasuk },
        async (ctx) => {
          const { getDatabase, callAletaBotSippBridge, akunSippMilik, bacaKredensialSipp, lookupUserForLoginInDb } =
            await modulMasuk();
          const db = await getDatabase();
          const headers = ctx.request?.headers ?? ctx.headers ?? new Headers();

          const keputusan = await putuskanMasukSipp(
            {
              cariPengguna: async (identitas) => {
                const u = await lookupUserForLoginInDb(db, { identifier: identitas });
                return u ? { id: u.id, roleId: u.roleId, name: u.name } : null;
              },
              akunSippMilik: async (userId) => akunSippMilik(await bacaKredensialSipp(db), userId),
              verifikasiSipp: async (usernameSipp, sandi) =>
                (await callAletaBotSippBridge("user.verifikasiSandi", { username: usernameSipp, sandi }, {
                  timeoutMs: BATAS_TUNGGU_BOT_MS,
                })) as JawabanVerifikasiSipp,
              verifikasiSandiAleta: (userId, sandi) => cocokkanSandiAleta(ctx.context, userId, sandi),
              catatJejak: (baris) => catatJejakMasuk(db, baris),
            },
            { identitas: ctx.body.identifier, sandi: ctx.body.password },
            { headers }
          );

          if (keputusan.jenis === "bukan-sipp") {
            return ctx.json({ ok: true, jenis: "bukan-sipp" as const, sebab: keputusan.sebab });
          }

          if (keputusan.jenis === "tolak") {
            const kode =
              keputusan.status === 429
                ? "TOO_MANY_REQUESTS"
                : keputusan.status === 403
                  ? "FORBIDDEN"
                  : keputusan.status === 400
                    ? "BAD_REQUEST"
                    : "UNAUTHORIZED";
            throw new APIError(kode, { message: keputusan.pesan, code: keputusan.kode });
          }

          const pengguna = await ctx.context.internalAdapter.findUserById(keputusan.userId);
          if (!pengguna) {
            throw new APIError("UNAUTHORIZED", { message: "Akun ALETA tidak ditemukan.", code: "AKUN_TIDAK_ADA" });
          }
          const tidakDiingat = ctx.body.rememberMe === false;
          const sesi = await ctx.context.internalAdapter.createSession(pengguna.id, tidakDiingat);
          if (!sesi) {
            throw new APIError("UNAUTHORIZED", { message: "Sesi masuk gagal dibuat.", code: "SESI_GAGAL" });
          }
          await setSessionCookie(ctx, { session: sesi, user: pengguna }, tidakDiingat);

          return ctx.json({
            ok: true,
            jenis: "masuk" as const,
            lewat: keputusan.lewat,
            // Username SIPP hanya disebut bila password SIPP-lah yang cocok -
            // itulah satu-satunya keadaan isi otomatis ekstensi boleh berjalan.
            usernameSipp: keputusan.lewat === "sipp" ? keputusan.usernameSipp : "",
            catatan: keputusan.catatan,
          });
        }
      ),
    },
  } satisfies BetterAuthPlugin;
}
