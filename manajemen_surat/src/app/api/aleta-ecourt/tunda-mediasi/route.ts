import { type NextRequest } from "next/server";

import { bolehAksi } from "@/lib/matriks-peran";
import { bolehTundaMediasi, usulanKehadiranSipp } from "@/lib/tunda-mediasi";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { bacaKehadiran } from "@/server/modules/aleta-ecourt/kehadiran-mediasi";
import { pastikanAksi, pastikanTab } from "@/server/modules/akses/hak-peran";
import { tolakBilaHariLibur } from "@/server/modules/hari-libur/sumber";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tunda mediasi dari Jadwal Mediasi (26 Okt 2026).
 *
 *   GET  ?mediasiId&tanggal   keadaan pertemuan itu + bahan formulir: boleh atau
 *                             tidak (dengan sebab), akun SIPP yang tersedia,
 *                             tenggang, usulan kehadiran dari catatan ALETA.
 *                             Hanya membaca.
 *   POST                      rencana (kering bawaan) atau tulis ke SIPP -
 *                             persis tunda mediasi SIPP (tundaMediasiService).
 *
 * ============================================================================
 * INI MENULIS KE SIPP
 * ============================================================================
 *
 * perkara_jadwal_mediasi (pertemuan lama ditandai ditunda, pertemuan berikutnya
 * lahir) beserta dua baris sys_audittrail. Tiga penjaga di lapisan ini:
 *
 *   1. KERING SEBAGAI BAWAAN - `kering: false` harus disebut tegas, dan hanya
 *      terjadi saat petugas menekan Simpan; tidak ada yang otomatis.
 *   2. HAK DI RUTE, bukan hanya tombol: aksi `mediasi.tunda` (golongan) PLUS
 *      kepemilikan perkara - hakim, panitera pengganti, dan mediator hanya atas
 *      perkara yang namanya tercatat (bolehTundaMediasi). Admin/Super Admin dan
 *      pimpinan/panitera/panmud mengawasi.
 *   3. Tanggal berikutnya: hari libur (SKB + tambahan Pengaturan) ditolak di
 *      sini; Sabtu/Minggu dan urutan tanggal ditolak bot seperti SIPP.
 *
 * Akun SIPP yang tercatat DITURUNKAN dari perkaranya (panitera pengganti, atau
 * mediator/ketua majelis bila dipilih) dan tidak pernah diketik. Alasan dan
 * keterangan penundaan tidak punya kolom di SIPP - hanya dicatat di riwayat
 * ALETA. Tidak satu kata ALETA ke SIPP (penjaga bot).
 */
type Keadaan = {
  ok?: boolean;
  boleh?: boolean;
  mediator?: string;
  majelis?: string[];
  panitera?: string[];
  perkara?: { perkaraId?: number; nomorPerkara?: string };
  pertemuan?: { tanggal?: string };
  [kunci: string]: unknown;
};

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanTab(db, actorUserId, "mediasi", "Jadwal Mediasi");

    const mediasiId = String(request.nextUrl.searchParams.get("mediasiId") || "").trim();
    const tanggal = String(request.nextUrl.searchParams.get("tanggal") || "").trim().slice(0, 10);
    if (!/^\d{1,20}$/.test(mediasiId)) {
      return ok({ available: true, ok: false, alasan: "Pertemuan mediasi tidak dikenali." });
    }
    const hasil = await panggilBotJadwalSidang<Keadaan>(`/tunda-mediasi?${new URLSearchParams({ mediasiId, tanggal }).toString()}`);
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    const data = hasil.data;
    if (data.ok === false) return ok({ available: true, ...data, alasan: String(data.pesan ?? data.alasan ?? "") });

    const golonganBoleh = bolehAksi(aktor, "mediasi.tunda");
    const milikBoleh = bolehTundaMediasi(aktor, {
      mediator: String(data.mediator ?? ""),
      majelis: data.majelis ?? [],
      panitera: data.panitera ?? [],
    });
    const bolehAnda = golonganBoleh && milikBoleh;
    const sebabAnda = bolehAnda
      ? ""
      : golonganBoleh
        ? "Menunda mediasi hanya untuk mediator, majelis, atau panitera pengganti perkara ini (nama akun Anda tidak cocok dengan yang tercatat di SIPP), Admin, dan pimpinan kepaniteraan."
        : "Peran Anda tidak diberi hak menunda mediasi (matriks peran).";

    // Usulan kehadiran dari catatan kehadiran ALETA (bukan SIPP); gagal baca = tanpa usulan.
    let usulanKehadiran = "";
    try {
      const tglPertemuan = String(data.pertemuan?.tanggal ?? tanggal);
      const kehadiran = await bacaKehadiran(db, mediasiId, tglPertemuan);
      usulanKehadiran = kehadiran.adaCatatan ? usulanKehadiranSipp(kehadiran.baris) : "";
    } catch {
      usulanKehadiran = "";
    }

    return ok({ available: true, ...data, bolehAnda, sebabAnda, usulanKehadiran });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_TUNDA_MEDIASI_READ_FAILED",
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
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanTab(db, actorUserId, "mediasi", "Jadwal Mediasi");
    await pastikanAksi(db, actorUserId, "mediasi.tunda"); // HAK-PERAN 26 Okt: matriks peran

    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const mediasiId = String(badan.mediasiId ?? "").trim();
    const tanggal = String(badan.tanggal ?? "").trim().slice(0, 10);
    if (!/^\d{1,20}$/.test(mediasiId)) throw new ApiError(400, "Pertemuan mediasi tidak dikenali.");

    // Kepemilikan perkara dibaca ULANG dari SIPP - bukan dari kiriman layar.
    const keadaan = await panggilBotJadwalSidang<Keadaan>(`/tunda-mediasi?${new URLSearchParams({ mediasiId, tanggal }).toString()}`);
    if (!keadaan.ok) throw new ApiError(503, keadaan.error || "ALETA Bot belum dapat dihubungi.");
    if (keadaan.data.ok === false) throw new ApiError(400, String(keadaan.data.pesan ?? keadaan.data.alasan ?? "Pertemuan mediasi tidak ditemukan."));
    if (
      !bolehTundaMediasi(aktor, {
        mediator: String(keadaan.data.mediator ?? ""),
        majelis: keadaan.data.majelis ?? [],
        panitera: keadaan.data.panitera ?? [],
      })
    ) {
      throw new ApiError(
        403,
        "Menunda mediasi hanya untuk mediator, majelis, atau panitera pengganti perkara ini (nama akun Anda tidak cocok dengan yang tercatat di SIPP), Admin, dan pimpinan kepaniteraan."
      );
    }

    // Hari libur (SKB + tambahan Pengaturan) ditolak sebelum diteruskan.
    await tolakBilaHariLibur(db, badan.tanggalBaru, "Tanggal mediasi berikutnya");

    // Penekan sebenarnya - HANYA untuk riwayat ALETA; yang tercatat di SIPP akun perkaranya.
    const akunPenekan = await akunSippPengguna(db, aktor.id).catch(() => null);

    const hasil = await panggilBotJadwalSidang<Record<string, unknown>>("/tunda-mediasi", {
      method: "POST",
      body: {
        mediasiId,
        tanggal,
        tanggalBaru: String(badan.tanggalBaru ?? "").slice(0, 10),
        tempat: String(badan.tempat ?? "").slice(0, 600),
        jam: String(badan.jam ?? "").slice(0, 8),
        sampaiJam: String(badan.sampaiJam ?? "").slice(0, 8),
        kehadiran: String(badan.kehadiran ?? "").slice(0, 2),
        alasan: String(badan.alasan ?? "").slice(0, 300),
        keterangan: String(badan.keterangan ?? "").slice(0, 600),
        atasNama: badan.atasNama === "mediator" || badan.atasNama === "hakim" ? badan.atasNama : "panitera",
        operator: actorUserId || "portal",
        operatorAkunSipp: akunPenekan && akunPenekan.milik.length ? akunPenekan.milik.join(", ") : "",
        // Alamat PERAMBAN petugas untuk sys_audittrail (butir 45, 17 Okt) - bukan alamat peti portal.
        ip: alamatIpPeramban(request),
        // Kering kecuali disebut tegas sebaliknya.
        kering: badan.kering !== false,
        // Keputusan 104: pilihan jam kerja diteruskan apa adanya ke bot.
        tanyaJamKerja: badan.tanyaJamKerja === true,
        jamKerja: badan.jamKerja === "antrekan" || badan.jamKerja === "sekarang" ? badan.jamKerja : undefined,
      },
      timeoutMs: 20_000,
    });

    if (!hasil.ok) {
      return ok({ available: Boolean(hasil.status), ok: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    const data = hasil.data;
    // `kode` = kode penolakan bot (untuk layar), `alasan` = kalimat untuk petugas.
    return ok({
      available: true,
      ...data,
      kode: data.kode ?? (data.ok === false ? data.alasan : undefined),
      alasan: data.ok === false ? String(data.pesan ?? data.alasan ?? "") : data.alasan,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_TUNDA_MEDIASI_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
