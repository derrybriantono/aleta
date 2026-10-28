import { type NextRequest } from "next/server";

import { paduDraf, susunPasal, type DrafHasilMediasi } from "@/lib/hasil-mediasi";
import { bawaanHasilSipp, bolehIsiHasilMediasiSipp, SEBAB_TOLAK_HASIL_SIPP, htmlKesepakatanSipp, hasilBerkesepakatan } from "@/lib/hasil-mediasi-sipp";
import { bolehAksi } from "@/lib/matriks-peran";
import { usulanKehadiranSipp } from "@/lib/tunda-mediasi";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { bacaDrafTerbaruPerkara } from "@/server/modules/aleta-ecourt/hasil-mediasi";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { bacaKehadiran } from "@/server/modules/aleta-ecourt/kehadiran-mediasi";
import { pastikanAksi, pastikanTab } from "@/server/modules/akses/hak-peran";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hasil mediasi ke SIPP dari Jadwal Mediasi (28 Okt 2026).
 *
 *   GET  ?mediasiId     isian hasil mediasi di SIPP + boleh/tidak + akun SIPP +
 *                       bawaan (SIPP, lalu laporan .rtf mediator). Hanya membaca.
 *   POST                rencana (kering bawaan) atau tulis ke SIPP - persis
 *                       Edit Hasil Mediasi SIPP (hasilMediasiTulisService).
 *
 * ============================================================================
 * INI MENULIS KE SIPP
 * ============================================================================
 *
 * perkara_mediasi + sys_audittrail (EDIT, atas akun PP perkara) + riwayat
 * perkara_proses/perkara seperti SIPP. Penjaga di lapisan ini:
 *   1. KERING SEBAGAI BAWAAN - `kering: false` harus disebut tegas (tombol Simpan).
 *   2. HAK DI RUTE: aksi `mediasi.hasil-sipp` (golongan) PLUS kepemilikan
 *      perkara dibaca ULANG dari SIPP (bolehIsiHasilMediasiSipp).
 * Akun SIPP yang tercatat diturunkan dari perkaranya (bawaan PP), tidak
 * pernah diketik. Penekan sebenarnya hanya di riwayat ALETA. Tidak satu kata
 * ALETA ke SIPP (penjaga bot).
 */
type Keadaan = {
  ok?: boolean;
  mediator?: string;
  majelis?: string[];
  panitera?: string[];
  perkara?: { perkaraId?: number; nomorPerkara?: string };
  tanggalHasil?: string;
  perluKehadiran?: boolean;
  sipp?: { hasil?: string; laporan?: string; kesepakatan?: string; isiKesepakatan?: string };
  [kunci: string]: unknown;
};

async function keadaanBot(mediasiId: string) {
  const hasil = await panggilBotJadwalSidang<Keadaan>(`/hasil-mediasi-sipp?${new URLSearchParams({ mediasiId }).toString()}`);
  return hasil;
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanTab(db, actorUserId, "mediasi", "Jadwal Mediasi");

    const mediasiId = String(request.nextUrl.searchParams.get("mediasiId") || "").trim();
    if (!/^\d{1,20}$/.test(mediasiId)) return ok({ available: true, ok: false, alasan: "Data mediasi tidak dikenali." });
    const hasil = await keadaanBot(mediasiId);
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    const data = hasil.data;
    if (data.ok === false) return ok({ available: true, ...data, alasan: String(data.pesan ?? data.alasan ?? "") });

    const golonganBoleh = bolehAksi(aktor, "mediasi.hasil-sipp");
    const milikBoleh = bolehIsiHasilMediasiSipp(aktor, {
      mediator: String(data.mediator ?? ""),
      majelis: data.majelis ?? [],
      panitera: data.panitera ?? [],
    });
    const bolehAnda = golonganBoleh && milikBoleh;

    // Bawaan: isian SIPP, lalu laporan .rtf mediator (draf tersimpan), lalu tanggal pertemuan terakhir.
    const perkaraId = String(data.perkara?.perkaraId ?? "");
    const nomorPerkara = String(data.perkara?.nomorPerkara ?? "");
    const mentah = await bacaDrafTerbaruPerkara(db, perkaraId, nomorPerkara);
    let draf: DrafHasilMediasi | null = null;
    let pasal: ReturnType<typeof susunPasal> = [];
    if (mentah && typeof mentah === "object" && (mentah as { dokumen?: unknown }).dokumen) {
      try {
        draf = mentah as DrafHasilMediasi;
        pasal = susunPasal(paduDraf(draf, mentah), { jenisPerkara: draf.dokumen.jenisPerkara, jenisPerkaraId: null });
      } catch {
        pasal = [];
      }
    }
    const bawaan = bawaanHasilSipp({ sipp: data.sipp, draf, pasal, tanggalHasil: String(data.tanggalHasil ?? "") });

    let usulanKehadiran = "";
    if (data.perluKehadiran && data.tanggalHasil) {
      try {
        const kehadiran = await bacaKehadiran(db, mediasiId, String(data.tanggalHasil));
        usulanKehadiran = kehadiran.adaCatatan ? usulanKehadiranSipp(kehadiran.baris) : "";
      } catch {
        usulanKehadiran = "";
      }
    }

    return ok({
      available: true,
      ...data,
      bolehAnda,
      sebabAnda: bolehAnda ? "" : golonganBoleh ? SEBAB_TOLAK_HASIL_SIPP : "Peran Anda tidak diberi hak mengisi hasil mediasi ke SIPP (matriks peran).",
      bawaan,
      usulanKehadiran,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_HASIL_MEDIASI_READ_FAILED",
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
    await pastikanAksi(db, actorUserId, "mediasi.hasil-sipp");

    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const mediasiId = String(badan.mediasiId ?? "").trim();
    if (!/^\d{1,20}$/.test(mediasiId)) throw new ApiError(400, "Data mediasi tidak dikenali.");

    // Kepemilikan perkara dibaca ULANG dari SIPP - bukan dari kiriman layar.
    const keadaan = await keadaanBot(mediasiId);
    if (!keadaan.ok) throw new ApiError(503, keadaan.error || "ALETA Bot belum dapat dihubungi.");
    if (keadaan.data.ok === false) throw new ApiError(400, String(keadaan.data.pesan ?? keadaan.data.alasan ?? "Data mediasi tidak ditemukan."));
    if (
      !bolehIsiHasilMediasiSipp(aktor, {
        mediator: String(keadaan.data.mediator ?? ""),
        majelis: keadaan.data.majelis ?? [],
        panitera: keadaan.data.panitera ?? [],
      })
    ) {
      throw new ApiError(403, SEBAB_TOLAK_HASIL_SIPP);
    }

    const hasil = String(badan.hasil ?? "").trim().toUpperCase().slice(0, 2);
    // Kotak isian berisi teks polos; SIPP menyimpan HTML ala CKEditor.
    const isiKesepakatan = hasilBerkesepakatan(hasil) ? htmlKesepakatanSipp(String(badan.isiKesepakatan ?? "").slice(0, 60_000)) : "";
    const akunPenekan = await akunSippPengguna(db, aktor.id).catch(() => null);

    const jawab = await panggilBotJadwalSidang<Record<string, unknown>>("/hasil-mediasi-sipp", {
      method: "POST",
      body: {
        mediasiId,
        hasil,
        tanggalLaporan: String(badan.tanggalLaporan ?? "").slice(0, 10),
        tanggalKesepakatan: String(badan.tanggalKesepakatan ?? "").slice(0, 10),
        isiKesepakatan,
        keterangan: String(badan.keterangan ?? "").slice(0, 600),
        kehadiran: String(badan.kehadiran ?? "").slice(0, 2),
        atasNama: badan.atasNama === "mediator" || badan.atasNama === "hakim" ? badan.atasNama : "panitera",
        operator: actorUserId || "portal",
        operatorAkunSipp: akunPenekan && akunPenekan.milik.length ? akunPenekan.milik.join(", ") : "",
        ip: alamatIpPeramban(request),
        kering: badan.kering !== false,
        tanyaJamKerja: badan.tanyaJamKerja === true,
        jamKerja: badan.jamKerja === "antrekan" || badan.jamKerja === "sekarang" ? badan.jamKerja : undefined,
      },
      timeoutMs: 20_000,
    });
    if (!jawab.ok) {
      return ok({ available: Boolean(jawab.status), ok: false, alasan: jawab.error || "ALETA Bot belum dapat dihubungi." });
    }
    const data = jawab.data;
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
      action: "SIPP_HASIL_MEDIASI_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
