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
import { APIError, createAuthEndpoint, formCsrfMiddleware, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import * as z from "zod";

import { type AletaDatabase } from "@/server/db/client";
import {
  periksaSippNonaktifJalurLama,
  putuskanMasukSipp,
  type BarisJejakMasuk,
  type JawabanVerifikasiSipp,
} from "@/server/modules/portal/masuk-sipp";
import {
  akunAletaUntukIdentitas,
  identitasDariJawaban,
  nilaiCookieSesiSipp,
  putuskanMasukDariSesiSipp,
  putuskanTautkanSesiSipp,
  type BahanPilih,
  type JawabanSesiSipp,
} from "@/server/modules/portal/masuk-sipp-nama";
import { catatPeristiwaAman } from "@/server/modules/perangkat/jejak";
import { idPerangkatDariHeader } from "@/server/modules/perangkat/jaringan";
import { appendAuditLog } from "@/server/shared/audit";
import { nextPrefixedId } from "@/server/shared/ids";

// Modul berat (bot, Manajemen Akun, pengguna) dimuat SAAT DIPANGGIL, bukan di
// tingkat atas: lib/auth.ts memuat berkas ini, dan sebagian modul itu - lewat
// server/shared/auth - memuat lib/auth.ts kembali. Muat-saat-perlu memutus
// lingkarannya dan tidak memperlambat permintaan lain yang memuat Better Auth.
async function modulMasuk() {
  const [klien, jembatan, akun, milestone, pengguna, aplikasiLuar] = await Promise.all([
    import("@/server/db/client"),
    import("@/server/modules/aleta-sipp/aleta-sipp-datasource"),
    import("@/server/modules/aleta-ecourt/court-calendar-akun"),
    import("@/server/modules/aleta-ecourt/checklist-milestone"),
    import("@/server/modules/users/service"),
    import("@/server/modules/external-apps/service"),
  ]);
  return {
    getDatabase: klien.getDatabase,
    callAletaBotSippBridge: jembatan.callAletaBotSippBridge,
    akunSippMilik: akun.akunSippMilik,
    bacaKredensialSipp: milestone.bacaKredensialSipp,
    lookupUserForLoginInDb: pengguna.lookupUserForLoginInDb,
    tulisTautanSippOtomatis: aplikasiLuar.tulisTautanSippOtomatis,
  };
}

/* === MASUK-SESI-SIPP 11 Okt === */
type ModulMasuk = Awaited<ReturnType<typeof modulMasuk>>;

/** Tautan SIPP + seluruh akun ALETA yang belum dihapus - bahan pemilih akun. */
async function bacaBahanPilih(db: AletaDatabase, m: ModulMasuk): Promise<BahanPilih> {
  const [kredensial, baris] = await Promise.all([
    m.bacaKredensialSipp(db),
    db.queryAll<{ id: string; name: string | null; nip: string | null; role_id: string | null; is_active: number | boolean | null }>(
      `SELECT id, name, nip, role_id, is_active FROM users WHERE deleted_at IS NULL`,
      []
    ),
  ]);
  return {
    kredensial,
    akun: baris.map((b) => ({
      id: String(b.id),
      name: String(b.name ?? ""),
      nip: b.nip == null ? null : String(b.nip),
      roleId: String(b.role_id ?? ""),
      isActive: b.is_active === true || Number(b.is_active) === 1,
    })),
  };
}

/** Pemeriksa sesi SIPP lewat bot: cookie ci_session + User-Agent permintaan ini. */
function pemeriksaSesi(m: ModulMasuk, headers: Headers) {
  return async (): Promise<JawabanSesiSipp> => {
    const cookie = nilaiCookieSesiSipp(headers.get("cookie") ?? "");
    if (cookie.length === 0) return { ok: true, data: { terbukti: false, sebab: "tanpa_cookie_sipp" } };
    return (await m.callAletaBotSippBridge(
      "user.sesiSipp",
      { cookie, userAgent: headers.get("user-agent") ?? "" },
      { timeoutMs: BATAS_TUNGGU_BOT_MS }
    )) as JawabanSesiSipp;
  };
}

/** Jejak sesi -> baris aleta_masuk_jejak (lewat "sipp" hanya bila berhasil). */
function jejakSesi(db: AletaDatabase, headers: Headers, jalurMasuk?: "sipp-sesi") {
  return (baris: {
    aletaUserId: string | null;
    usernameSipp: string;
    sippUserId: string;
    hasil: "berhasil" | "ditolak" | "dibatasi";
    alasan: string;
  }) =>
    (jalurMasuk ? catatGagalSipp(db, headers, jalurMasuk, { ...baris, identitas: baris.usernameSipp }) : Promise.resolve()).then(() => catatJejakMasuk(db, {
      ...baris,
      identitas: baris.usernameSipp,
      lewat: baris.hasil === "berhasil" ? "sipp" : "",
      alamatIp: (headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown").slice(0, 80),
      agenPeramban: (headers.get("user-agent") ?? "").slice(0, 240),
    })).catch((galat) => {
      console.warn("[ALETA MASUK SIPP] jejak sesi tidak tertulis:", galat instanceof Error ? galat.message : "tidak diketahui");
    });
}

/** "sandi_tidak_cocok" dkk. -> kalimat riwayat masuk (23 Okt 2026). */
export function alasanGagalSipp(hasil: string, alasan: string) {
  const a = String(alasan ?? "").toLowerCase();
  if (hasil === "dibatasi" || a.includes("batas_percobaan")) return "batas percobaan";
  if (/diblokir|kedaluwarsa|nonaktif/.test(a)) return a.startsWith("akun_aleta") ? "akun nonaktif" : "SIPP nonaktif";
  if (/tidak_cocok|sandi|password/.test(a)) return "sandi salah";
  if (/tak_dikenal|tidak_ada|tidak_ditemukan|tanpa_akun|bukan/.test(a)) return "akun tak dikenal";
  return a.replace(/_/g, " ").slice(0, 80) || "ditolak";
}

/** Percobaan SIPP yang TIDAK berhasil -> MASUK_GAGAL di aleta_jejak_masuk. Berhasil dicatat kait sesi. */
async function catatGagalSipp(
  db: AletaDatabase,
  headers: Headers,
  jalur: "sipp" | "sipp-sesi",
  baris: { aletaUserId: string | null; identitas: string; hasil: string; alasan: string }
) {
  if (baris.hasil === "berhasil") return;
  await catatPeristiwaAman(db, {
    peristiwa: "MASUK_GAGAL",
    alasan: alasanGagalSipp(baris.hasil, baris.alasan),
    jalur,
    userId: baris.aletaUserId,
    identitas: baris.identitas,
    perangkatId: idPerangkatDariHeader(headers),
    headers,
    rincian: { kode: baris.alasan.slice(0, 80) },
  });
}

/** Untuk jalur password SIPP di layar masuk: akun ALETA dari username SIPP terbukti. */
function akunAletaDariSippUntuk(db: AletaDatabase, m: ModulMasuk) {
  return async (usernameSipp: string, sippUserId: string) => {
    const jawab = (await m.callAletaBotSippBridge(
      "user.identitasSipp",
      sippUserId ? { sippUserId } : { username: usernameSipp },
      { timeoutMs: BATAS_TUNGGU_BOT_MS }
    )) as JawabanSesiSipp & { data?: { ditemukan?: boolean } };
    if (!jawab.ok || !jawab.data?.ditemukan) {
      return { ok: false as const, sebab: "identitas_sipp_tak_terbaca", pesan: "Nama akun SIPP Anda belum dapat dibaca. Coba lagi sebentar lagi." };
    }
    return akunAletaUntukIdentitas(
      {
        bacaBahan: () => bacaBahanPilih(db, m),
        tulisTautan: (p) => m.tulisTautanSippOtomatis(db, p),
      },
      identitasDariJawaban(jawab.data)
    );
  };
}
/* === AKHIR MASUK-SESI-SIPP === */

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
          const m = await modulMasuk();
          const { getDatabase, callAletaBotSippBridge, akunSippMilik, bacaKredensialSipp, lookupUserForLoginInDb } = m;
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
              catatJejak: async (baris) => {
                await catatGagalSipp(db, headers, "sipp", baris);
                await catatJejakMasuk(db, baris);
              },
              // 11 Okt 2026: username SIPP tanpa tautan -> tautan/NIP/nama.
              akunAletaDariSipp: akunAletaDariSippUntuk(db, m),
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

      /* === MASUK-SESI-SIPP 11 Okt === */
      // POST /api/auth/sign-in/sipp-sesi - panel ekstensi di halaman SIPP yang
      // menerima 401 dari portal memanggil ini (satu asal, cookie ci_session
      // SIPP ikut). Bot membuktikan sesinya; akun ALETA dipilih lewat tautan,
      // NIP, atau nama tunggal (masuk-sipp-nama.ts). Tanpa password.
      masukDariSesiSipp: createAuthEndpoint(
        "/sign-in/sipp-sesi",
        { method: "POST", use: [formCsrfMiddleware], body: z.object({ rememberMe: z.boolean().optional() }).optional() },
        async (ctx) => {
          const m = await modulMasuk();
          const db = await m.getDatabase();
          const headers = ctx.request?.headers ?? ctx.headers ?? new Headers();
          const keputusan = await putuskanMasukDariSesiSipp({
            periksaSesi: pemeriksaSesi(m, headers),
            bacaBahan: () => bacaBahanPilih(db, m),
            tulisTautan: (p) => m.tulisTautanSippOtomatis(db, p),
            catatJejak: jejakSesi(db, headers, "sipp-sesi"),
          });

          if (keputusan.jenis === "tolak") {
            throw new APIError("FORBIDDEN", { message: keputusan.pesan, code: keputusan.kode });
          }
          if (keputusan.jenis !== "masuk") {
            return ctx.json({
              ok: true,
              jenis: keputusan.jenis,
              sebab: "sebab" in keputusan ? keputusan.sebab : "",
              pesan: "pesan" in keputusan ? keputusan.pesan : "",
            });
          }

          const pengguna = await ctx.context.internalAdapter.findUserById(keputusan.userId);
          if (!pengguna) throw new APIError("UNAUTHORIZED", { message: "Akun ALETA tidak ditemukan.", code: "AKUN_TIDAK_ADA" });
          const tidakDiingat = ctx.body?.rememberMe === false;
          const sesi = await ctx.context.internalAdapter.createSession(pengguna.id, tidakDiingat);
          if (!sesi) throw new APIError("UNAUTHORIZED", { message: "Sesi masuk gagal dibuat.", code: "SESI_GAGAL" });
          await setSessionCookie(ctx, { session: sesi, user: pengguna }, tidakDiingat);
          return ctx.json({
            ok: true,
            jenis: "masuk" as const,
            nama: String((pengguna as { name?: string }).name ?? ""),
            usernameSipp: keputusan.usernameSipp,
            tautanBaru: keputusan.tautanBaru,
          });
        }
      ),

      // POST /api/auth/sipp-sesi/tautkan - pegawai yang SEDANG masuk ALETA dan
      // SEDANG masuk SIPP di peramban yang sama menautkan akun SIPP itu ke
      // akun ALETA-nya dengan satu tekanan (pilihan manual bila nama ganda).
      tautkanSesiSipp: createAuthEndpoint(
        "/sipp-sesi/tautkan",
        { method: "POST", use: [formCsrfMiddleware, sessionMiddleware] },
        async (ctx) => {
          const m = await modulMasuk();
          const db = await m.getDatabase();
          const headers = ctx.request?.headers ?? ctx.headers ?? new Headers();
          const aktor = ctx.context.session.user;
          const hasil = await putuskanTautkanSesiSipp(
            {
              periksaSesi: pemeriksaSesi(m, headers),
              bacaBahan: () => bacaBahanPilih(db, m),
              catatJejak: jejakSesi(db, headers),
              tulisTautanManual: (p) => m.tulisTautanSippOtomatis(db, { ...p, sumber: "sesi-sipp" }),
            },
            { id: aktor.id }
          );
          return ctx.json({ ok: hasil.jenis !== "tolak", ...hasil });
        }
      ),
      /* === AKHIR MASUK-SESI-SIPP === */
    },
  } satisfies BetterAuthPlugin;
}
