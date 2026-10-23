import { APIError } from "better-auth/api";

import { type AletaDatabase } from "@/server/db/client";
import { buatTiket, ringkasPerangkat, tegakkanBatas } from "@/server/modules/perangkat/batas";
import { catatPeristiwaAman, catatPerangkat, jalurDariPath } from "@/server/modules/perangkat/jejak";
import {
  MASA_KUKI_PERANGKAT_DETIK,
  NAMA_KUKI_PERANGKAT,
  idPerangkatBaru,
  idPerangkatDariHeader,
  ipKlien,
  jalurKukiPerangkat,
  rujukanSesi,
} from "@/server/modules/perangkat/jaringan";
import { cabutSesi, daftarSesiAktif } from "@/server/modules/perangkat/sesi";

/**
 * ============================================================================
 * SATU TITIK UNTUK SEMUA JALUR MASUK: databaseHooks.session.create
 * ============================================================================
 *
 * /sign-in/email (Better Auth sendiri), /sign-in/sipp dan /sign-in/sipp-sesi
 * (plugin masuk-sipp, internalAdapter.createSession) semuanya membuat sesi
 * lewat createWithHooks Better Auth - jadi kait ini dilalui ketiganya, dan
 * jalur baru apa pun yang membuat sesi. Diuji per jalur di
 * jejak-masuk-perangkat.test.ts.
 *
 *   before: kuki perangkat (dipasang bila belum ada), IP klien yang benar ke
 *           sessions.ip_address (ujung X-Forwarded-For), penegakan batas
 *           perangkat. Penolakan = APIError 403 code BATAS_PERANGKAT berisi
 *           tiket sekali pakai + daftar perangkat aktif.
 *   after:  peta sesi->perangkat, catatan perangkat, peristiwa MASUK dan
 *           PERANGKAT_BARU, sesi lama di perangkat yang sama dicabut.
 *
 * Gangguan basis data di sini TIDAK menutup masuk (kecuali penolakan batas
 * yang memang diputuskan): pencatatan yang gagal ditulis ke log server.
 */

type KonteksKait = {
  path?: string;
  body?: unknown;
  headers?: Headers;
  request?: Request;
  setCookie?: (nama: string, nilai: string, opsi?: Record<string, unknown>) => unknown;
} | null;

const perangkatPerKonteks = new WeakMap<object, string>();

function headersDari(ctx: KonteksKait) {
  return ctx?.headers ?? ctx?.request?.headers ?? null;
}

function ingatDari(ctx: KonteksKait): boolean | null {
  const body = ctx?.body as { rememberMe?: unknown } | undefined;
  return typeof body?.rememberMe === "boolean" ? body.rememberMe : null;
}

export const KODE_BATAS_PERANGKAT = "BATAS_PERANGKAT";

export function kaitSesiPerangkat(ambilDb: () => Promise<AletaDatabase>) {
  return {
    session: {
      create: {
        before: async (data: Record<string, unknown> & { userId: string }, ctx: KonteksKait) => {
          if (!ctx) return;
          const headers = headersDari(ctx);
          let perangkatId = idPerangkatDariHeader(headers);
          if (!perangkatId) {
            perangkatId = idPerangkatBaru();
            ctx.setCookie?.(NAMA_KUKI_PERANGKAT, perangkatId, {
              httpOnly: true,
              sameSite: "lax",
              path: jalurKukiPerangkat(),
              maxAge: MASA_KUKI_PERANGKAT_DETIK,
            });
          }
          perangkatPerKonteks.set(ctx, perangkatId);
          const ip = ipKlien(headers);
          const jalur = jalurDariPath(ctx.path);

          let db: AletaDatabase | null = null;
          let hasil: Awaited<ReturnType<typeof tegakkanBatas>> | null = null;
          try {
            db = await ambilDb();
            hasil = await tegakkanBatas(db, { userId: String(data.userId), perangkatId });
          } catch (galat) {
            console.warn("[BATAS PERANGKAT] tidak dapat diperiksa; masuk diteruskan:", galat instanceof Error ? galat.message : "tidak diketahui");
          }
          if (db && hasil && !hasil.lolos) {
            const perangkat = await ringkasPerangkat(db, String(data.userId), hasil.perangkat);
            await catatPeristiwaAman(db, {
              peristiwa: "MASUK_DITOLAK_BATAS_PERANGKAT",
              alasan: `batas ${hasil.kebijakan.maks} perangkat sudah penuh`,
              jalur,
              userId: String(data.userId),
              perangkatId,
              headers,
              ingat: ingatDari(ctx),
              rincian: { maks: hasil.kebijakan.maks, sumber: hasil.kebijakan.sumber, aktif: perangkat.length },
            });
            const tiket = await buatTiket(db, { userId: String(data.userId), perangkatId, jalur });
            throw new APIError("FORBIDDEN", {
              message:
                `Akun ini sudah masuk di ${perangkat.length} perangkat (batas ${hasil.kebijakan.maks}). ` +
                "Keluarkan salah satu perangkat untuk melanjutkan, atau hubungi admin.",
              code: KODE_BATAS_PERANGKAT,
              tiket,
              maks: hasil.kebijakan.maks,
              perangkat,
            });
          }
          return ip ? { data: { ipAddress: ip } } : undefined;
        },

        after: async (sesi: { id: string; userId: string; ipAddress?: string | null } | null, ctx: KonteksKait) => {
          if (!ctx || !sesi?.id) return;
          const headers = headersDari(ctx);
          const perangkatId = perangkatPerKonteks.get(ctx) || idPerangkatDariHeader(headers);
          if (!perangkatId) return;
          const jalur = jalurDariPath(ctx.path);
          const ingat = ingatDari(ctx);
          const ip = ipKlien(headers) || String(sesi.ipAddress ?? "");
          try {
            const db = await ambilDb();
            const kini = new Date().toISOString();
            // Sesi lama akun ini di perangkat yang SAMA: kukinya sudah diganti
            // sesi baru, jadi baris lamanya hanya sisa yang ikut terhitung.
            const lama = (await daftarSesiAktif(db, sesi.userId))
              .filter((s) => s.perangkatId === perangkatId && s.sessionId !== sesi.id)
              .map((s) => s.sessionId);
            if (lama.length) {
              await cabutSesi(db, { userId: sesi.userId, sessionIds: lama, alasan: "login-ulang-perangkat-sama", pelaku: { id: "", nama: "Sistem" } });
            }
            await db
              .prepare(
                `INSERT INTO aleta_sesi_perangkat (session_id, sesi_ref, perangkat_id, user_id, jalur, ip_awal, ip_terakhir, ingat, dibuat_pada, terakhir_aktif)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(session_id) DO NOTHING`
              )
              .run(sesi.id, rujukanSesi(sesi.id), perangkatId, sesi.userId, jalur, ip, ip, ingat === null ? "" : ingat ? "ya" : "tidak", kini, kini);
            const baru = await catatPerangkat(db, { perangkatId, userId: sesi.userId, headers, ip });
            await catatPeristiwaAman(db, { peristiwa: "MASUK", jalur, userId: sesi.userId, sessionId: sesi.id, perangkatId, headers, ingat });
            if (baru) {
              await catatPeristiwaAman(db, {
                peristiwa: "PERANGKAT_BARU",
                alasan: "perangkat pertama kali dipakai akun ini",
                jalur,
                userId: sesi.userId,
                sessionId: sesi.id,
                perangkatId,
                headers,
              });
            }
            const { jadwalkanArp } = await import("@/server/modules/perangkat/mac");
            jadwalkanArp(db, { perangkatId, userId: sesi.userId, ip });
          } catch (galat) {
            console.warn("[JEJAK MASUK] sesudah masuk tidak tertulis:", galat instanceof Error ? galat.message : "tidak diketahui");
          }
        },
      },
    },
  };
}
