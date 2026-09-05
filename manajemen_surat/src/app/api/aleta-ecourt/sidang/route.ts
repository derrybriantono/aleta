import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  getGatewayArsipRincian,
  getGatewayJadwalSidang,
  getGatewayKalenderSidang,
  getGatewayKesiapanBanyak,
  getGatewayKesiapanSatu,
  getGatewayRincianSidang,
  getGatewaySippKonteks,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Jadwal perkara yang bersidang.
 *
 * ============================================================================
 * SATU RUTE, DUA KEDALAMAN
 * ============================================================================
 *
 *   tanpa ?nomor  - daftar sidang pada rentang tanggal, satu baris per sidang
 *   dengan ?nomor - seluruh keterangan satu sidang
 *
 * ============================================================================
 * TIGA SUMBER DISATUKAN DI SINI, BUKAN DI PERAMBAN
 * ============================================================================
 *
 * Rincian satu sidang memerlukan tiga hal yang tersimpan di tempat berbeda:
 *
 *   SIPP   - majelis, panitera, jurusita, saksi, relaas, dokumen perkara
 *   e-Court- berkas para pihak beserta keadaan verifikasi majelis
 *   SIPP   - identitas pihak, kuasa hukum, jenis dan kumulasi perkara
 *
 * Ketiganya diminta bersamaan dari server, bukan tiga permintaan berurutan
 * dari peramban. Petugas yang membuka satu sidang menunggu satu kali, bukan
 * tiga kali - dan halaman tidak menampilkan bagian yang muncul satu per satu.
 *
 * Tiap bagian gagal sendiri-sendiri: e-Court yang sedang tidak terbaca tidak
 * boleh menghilangkan majelis dan agenda yang sudah ada di SIPP.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);

    // Kemampuan yang sama dengan panel di halaman SIPP: layar ini menampilkan
    // keterangan perkara yang sama, hanya disusun menurut jadwal sidang.
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");

    // Kalender diminta lebih dulu: ia hanya berisi hitungan per hari, dan
    // tidak memerlukan satu pun permintaan lain.
    const bulan = String(request.nextUrl.searchParams.get("kalender") || "").trim();
    if (bulan) {
      const kalender = await getGatewayKalenderSidang(bulan);
      if (!kalender.ok) {
        return ok({
          available: false,
          message: kalender.error || "ALETA Bot belum dapat dihubungi.",
          hari: [],
        });
      }
      return ok({
        available: true,
        bulan: kalender.data?.bulan ?? bulan,
        hari: kalender.data?.hari ?? [],
      });
    }

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();

    if (nomor) {
      const sidangId = String(request.nextUrl.searchParams.get("sidangId") || "").trim();

      const [rincian, arsip, konteks, kesiapan] = await Promise.all([
        getGatewayRincianSidang(nomor, sidangId),
        getGatewayArsipRincian(nomor),
        getGatewaySippKonteks(nomor, actor.name),
        getGatewayKesiapanSatu({
          nomor,
          sidangId,
          tanggalSidang: String(request.nextUrl.searchParams.get("tanggalSidang") || ""),
          agenda: String(request.nextUrl.searchParams.get("agenda") || ""),
        }),
      ]);

      return ok({
        available: true,
        nomorPerkara: nomor,
        sipp: rincian.ok ? (rincian.data ?? null) : null,
        pesanSipp: rincian.ok ? "" : rincian.error || "Keterangan SIPP belum dapat dibaca.",
        ecourt: arsip.ok ? (arsip.data?.dokumen ?? []) : [],
        pesanEcourt: arsip.ok ? "" : arsip.error || "Arsip e-Court belum dapat dibaca.",
        // nomorPihak memuat pihak DAN kuasa hukumnya; identitas memuat jenis
        // perkara, kumulasi, dan ada tidaknya kuasa pada tiap sisi.
        pihak: konteks.ok ? (konteks.data?.nomorPihak ?? []) : [],
        identitas: konteks.ok ? (konteks.data?.identitas ?? null) : null,
        hakim: konteks.ok ? (konteks.data?.hakim ?? null) : null,
        kesiapan: kesiapan.ok ? (kesiapan.data?.kesiapan ?? null) : null,
      });
    }

    const hasil = await getGatewayJadwalSidang({
      dari: String(request.nextUrl.searchParams.get("dari") || ""),
      sampai: String(request.nextUrl.searchParams.get("sampai") || ""),
      cari: String(request.nextUrl.searchParams.get("cari") || ""),
      batas: Number(request.nextUrl.searchParams.get("batas")) || 200,
    });

    if (!hasil.ok) {
      return ok({
        available: false,
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
        sidang: [],
      });
    }

    const sidang = hasil.data?.sidang ?? [];

    // Skor dihitung hanya bila diminta. Menilai kesiapan menembakkan beberapa
    // kueri per sidang, dan pemuatan jadwal biasa tidak boleh menanggung
    // ongkosnya - petugas yang hanya ingin melihat jam sidang tidak perlu
    // menunggu penilaian puluhan perkara.
    let kesiapan: Record<string, unknown> = {};
    let kesiapanDinilai = 0;

    if (request.nextUrl.searchParams.get("kesiapan") === "1" && sidang.length > 0) {
      const hasilKesiapan = await getGatewayKesiapanBanyak(
        sidang.map((baris) => ({
          nomorPerkara: baris.nomorPerkara,
          sidangId: baris.sidangId,
          // Dikirim supaya bot dapat membaca keadaan panggilan SELURUH sidang
          // dengan satu kelompok kueri. Tanpa ini penilaiannya tetap benar,
          // hanya menembakkan tiga kueri per sidang alih-alih tiga untuk
          // lima puluh sidang sekaligus.
          perkaraId: baris.perkaraId,
          tanggalSidang: baris.tanggalSidang,
          agenda: baris.agenda,
        })),
        50
      );
      if (hasilKesiapan.ok) {
        kesiapan = hasilKesiapan.data?.kesiapan ?? {};
        kesiapanDinilai = hasilKesiapan.data?.dinilai ?? 0;
      }
    }

    return ok({
      available: true,
      dari: hasil.data?.dari ?? "",
      sampai: hasil.data?.sampai ?? "",
      diperiksaPada: hasil.data?.diperiksaPada ?? "",
      sidang,
      kesiapan,
      kesiapanDinilai,
      // Diteruskan apa adanya, termasuk saat tidak terbaca. Layar jadwal yang
      // menampilkan kolom antrian kosong tanpa sebab akan disangka rusak;
      // yang menyebutkan "sambungan antrian tidak terbaca" dapat ditindaklanjuti.
      antrian: hasil.data?.antrian ?? {
        terbaca: false,
        alasan: "bot tidak mengirimkan keterangan antrian",
        tanggal: [],
        peta: {},
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_JADWAL_SIDANG_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
