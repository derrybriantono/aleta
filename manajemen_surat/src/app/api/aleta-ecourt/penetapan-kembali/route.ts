import { type NextRequest } from "next/server";

import { masalahAlasan, JENIS_KEMBALI } from "@/lib/penetapan-kembali";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { calonPenetapKembali, panggilBotPenetapanKembali } from "@/server/modules/aleta-ecourt/penetapan-kembali";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { isApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PENETAPAN KEMBALI PMH / PPP / PJS / PHS - POP-UP JADWAL SIDANG (6 Okt 2026)
 * ============================================================================
 *
 *   GET  ?cek=1                     boleh tidaknya tombol digambar (tanpa bot)
 *   GET  ?perkaraId=1,2&cari=&tanggal=
 *                                   penetapan yang berlaku, daftar pilihan
 *                                   hakim/PP/JS/ruangan, calon penetap, dan
 *                                   akun SIPP yang akan tercatat. Hanya membaca.
 *   POST                            SATU perkara, SATU jenis - lewat bot,
 *                                   bentuk borang "penetapan kembali" SIPP.
 *                                   KERING kecuali `kering: false` tegas.
 *
 * Hak: kemampuan "penunjukan" - sama dengan rute tulis penetapan awal
 * (/api/aleta-bot/penunjukan/tulis). Super Admin dan Admin selalu.
 *
 * Akun SIPP yang tercatat di SIPP: kredensial SIPP MILIK pengguna yang masuk
 * (akunSippPengguna - pola Court Calendar Jadwal Sidang), tidak pernah
 * diketik bebas dan tidak pernah akun orang lain (butir 39). Operator dari
 * sesi; pejabat penetap hanya ke jejak ALETA.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const q = request.nextUrl.searchParams;

    if (q.get("cek") !== null) {
      // Tombolnya diam bagi yang tidak berwenang - bukan galat merah.
      try {
        await pastikanKapabilitas(db, actorUserId, "penunjukan");
        return ok({ boleh: true });
      } catch (galat) {
        if (isApiError(galat) && (galat.status === 401 || galat.status === 403)) return ok({ boleh: false });
        throw galat;
      }
    }

    const aktor = await pastikanKapabilitas(db, actorUserId, "penunjukan");
    const perkaraId = [
      ...new Set(
        String(q.get("perkaraId") || "")
          .split(",")
          .map((x) => x.trim())
          .filter((x) => /^\d{1,12}$/.test(x))
      ),
    ].slice(0, 60);
    const cari = String(q.get("cari") || "").slice(0, 60);
    const tanggal = String(q.get("tanggal") || "");

    const [keadaan, calon, akun] = await Promise.all([
      panggilBotPenetapanKembali<Record<string, unknown>>("/keadaan", { perkaraId, cari }),
      q.get("penetap") === "0" ? Promise.resolve(null) : calonPenetapKembali(db, tanggal),
      akunSippPengguna(db, aktor.id),
    ]);
    if (!keadaan.ok) return ok({ available: false, ok: false, alasan: keadaan.error, akun, calon });
    return ok({ available: true, ...keadaan.data, akun, calon });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PENETAPAN_KEMBALI_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "penunjukan");
    const operator = String(aktor.name || aktor.email || aktor.id || "").trim();
    const badan = (await request.json()) as Record<string, unknown>;

    const jenis = String(badan.jenis || "").toLowerCase();
    if (!(JENIS_KEMBALI as readonly string[]).includes(jenis)) {
      return ok({ ok: false, alasan: "jenis_tidak_didukung" });
    }
    const perkaraId = Number(badan.perkaraId);
    if (!Number.isFinite(perkaraId) || perkaraId <= 0) return ok({ ok: false, alasan: "perkara_tidak_sah" });
    const alasan = String(badan.alasan || "").replace(/\s+/g, " ").trim();
    const salah = masalahAlasan(alasan);
    if (salah) return ok({ ok: false, alasan: salah });

    const akun = await akunSippPengguna(db, aktor.id, badan.akunSipp);
    if (!akun.ok) return ok({ ok: false, alasan: akun.alasan, pesan: akun.pesan, milik: akun.milik });

    // Menulis HARUS diminta tegas.
    const kering = badan.kering !== false;
    const hasil = await panggilBotPenetapanKembali<Record<string, unknown>>(
      "/tulis",
      {
        jenis,
        perkaraId,
        tanggalPenetapan: String(badan.tanggalPenetapan || ""),
        alasan,
        hakimId: Array.isArray(badan.hakimId)
          ? (badan.hakimId as unknown[]).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
          : undefined,
        petugasId: badan.petugasId === undefined ? undefined : Number(badan.petugasId),
        tanggalSidang: badan.tanggalSidang === undefined ? undefined : String(badan.tanggalSidang),
        jamSidang: badan.jamSidang === undefined ? undefined : String(badan.jamSidang),
        ruanganId: badan.ruanganId === undefined ? undefined : Number(badan.ruanganId),
        olehUsername: akun.username,
        pejabatUsername: String(badan.pejabatUsername || "").trim().slice(0, 150),
        operator,
        ip: alamatIpPeramban(request),
        kering,
      },
      // Penulisan sungguhan didahului jeda manusia di bot (sampai 2,2 detik).
      kering ? 15_000 : 30_000
    );
    if (!hasil.ok) return ok({ ok: false, alasan: hasil.error });
    return ok(hasil.data);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_PENETAPAN_KEMBALI_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
