import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { namaAdaDi } from "@/lib/perkara-sendiri";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { getGatewayJadwalSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { petaPemetaanBerlaku } from "@/server/modules/aleta-ecourt/pemetaan-blangko";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

import {
  folderDibutuhkan,
  ringkasLembar,
  susunBarisBasMassal,
  type BarisSidangBas,
  type BlangkoKatalog,
  type KatalogFolder,
  type RingkasLembar,
} from "./susun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pagu baris jadwal satu tanggal - sama dengan putusan massal (alatSidangPadaTanggal). */
const BATAS_SIDANG = 300;

/**
 * ============================================================================
 * BAS MASSAL - BAHAN PANEL "BAS MASSAL" EKSTENSI (PERBAIKAN 30 SEP SORE, U4)
 * ============================================================================
 *
 *   GET ?tanggal=YYYY-MM-DD&saringan=saya|semua
 *
 * Perkara yang bersidang pada tanggal itu, satu baris per perkara, beserta
 * status BAS-nya (terunggah di SIPP atau belum, saksi yang diajukan, lembar
 * BAS di ALETA, kehadiran) dan pilihan blangko BAS dari katalog APS Badilag
 * (susun.ts). Panel ekstensi memakainya untuk pratinjau (bas/periksa) dan
 * unduh (bas/naskah) - dua rute GET yang sudah dipakai Alat Bantu Tulis BAS.
 *
 * ============================================================================
 * HANYA MEMBACA
 * ============================================================================
 *
 * Jadwal diminta LANGSUNG ke bot, bukan lewat rute /sidang: rute itu menulis
 * rekaman antrian sebagai efek samping, dan panel massal yang dibuka berkali-
 * kali tidak boleh ikut menulis. Katalog blangko dibaca bot dari folder APS
 * Badilag (tidak ada yang diubah), lembar dari tabel ALETA aleta_bas_lembar.
 * Tidak ada tabel SIPP baru: jadwal, adaBas, dan saksi datang dari jawaban
 * jadwal bot yang sudah ada.
 *
 * ============================================================================
 * KEWENANGANNYA "panel" - SAMA DENGAN RELAAS MASSAL DAN RUTE BAS LAIN
 * ============================================================================
 *
 * Panitera pengganti lolos karena "panel" menyala bawaannya bagi peran
 * pemegang perkara; admin dan super admin lolos lewat isPrivilegedAdmin.
 * Saringan bawaan: admin "semua", selain itu "saya" (panitera pengganti yang
 * namanya cocok dengan akun ALETA - namaAdaDi, aturan yang sama dengan
 * penyaring perkara sendiri di portal).
 *
 * Tanggal yang tidak berbentuk YYYY-MM-DD dijawab 400, bukan diganti hari ini.
 * Bot yang tidak menjawab dijawab 502 beserta sebabnya, bukan daftar kosong -
 * daftar kosong terbaca "hari ini tidak ada sidang".
 *
 * Sejak perbaikan 2 Okt sore (butir 8) usulan blangko mengikuti Pemetaan
 * blangko > BAS bila ada kunci yang cocok (blangko.usulan.dariPemetaan).
 *
 * Sejak perbaikan 1 Okt (K4) tiap baris membawa `pengguna` = { id, nama }
 * panitera penggantinya, dan jawabannya `kelompokPerUser` - tetap hanya
 * membaca, tanpa kueri tambahan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");

    const tanggalMinta = (request.nextUrl.searchParams.get("tanggal") || "").trim();
    if (tanggalMinta && !/^\d{4}-\d{2}-\d{2}$/.test(tanggalMinta)) {
      return Response.json(
        { ok: false, alasan: `Tanggal "${tanggalMinta}" tidak berbentuk YYYY-MM-DD.` },
        { status: 400 }
      );
    }
    const tanggal = tanggalMinta || waktuPengadilan().tanggal;

    const lihatSemua = isPrivilegedAdmin(actor);
    const saringanMinta = (request.nextUrl.searchParams.get("saringan") || "").trim();
    const saringan: "saya" | "semua" =
      saringanMinta === "saya" || saringanMinta === "semua" ? saringanMinta : lihatSemua ? "semua" : "saya";
    const namaAkun = String(actor?.name || "");

    const jadwal = await getGatewayJadwalSidang({ dari: tanggal, sampai: tanggal, cari: "", batas: BATAS_SIDANG });
    if (!jadwal.ok) {
      return Response.json(
        { ok: false, alasan: jadwal.error || "Jadwal sidang belum dapat dibaca dari ALETA Bot." },
        { status: 502 }
      );
    }
    const sidang = (Array.isArray(jadwal.data?.sidang) ? jadwal.data.sidang : []) as BarisSidangBas[];

    // Katalog dan lembar hanya untuk baris yang AKAN ditampilkan.
    const terlihat =
      saringan === "saya" ? sidang.filter((s) => namaAdaDi(namaAkun, String(s?.paniteraNama ?? ""))) : sidang;

    const folder = folderDibutuhkan(terlihat);
    const katalog: Record<string, KatalogFolder> = {};
    await Promise.all(
      folder.map(async (f) => {
        try {
          const j = await callAletaBotSippBridge<{ ada?: boolean; sebab?: string; blangko?: BlangkoKatalog[] }>(
            "blangko.katalog",
            { folder: f }
          );
          const data = j.data;
          katalog[f] =
            j.ok && data && data.ada !== false && Array.isArray(data.blangko)
              ? { terbaca: true, sebab: "", blangko: data.blangko }
              : { terbaca: false, sebab: String(data?.sebab || j.error || "katalog tidak terbaca"), blangko: [] };
        } catch (galat) {
          katalog[f] = { terbaca: false, sebab: galat instanceof Error ? galat.message : String(galat), blangko: [] };
        }
      })
    );

    const lembar: Record<string, RingkasLembar | null> = {};
    let lembarTerbaca = true;
    const idPerkara = [...new Set(terlihat.map((s) => String(s?.perkaraId ?? "").trim()).filter(Boolean))];
    await Promise.all(
      idPerkara.map(async (id) => {
        try {
          const baris = await db!.queryAll<{ keadaan?: unknown }>(
            `SELECT keadaan FROM aleta_bas_lembar WHERE perkara_id = ?`,
            [id]
          );
          lembar[id] = ringkasLembar(baris);
        } catch {
          lembar[id] = null;
          lembarTerbaca = false;
        }
      })
    );

    // Perbaikan 2 Okt sore (butir 8): Pemetaan blangko BAS dibaca tiap
    // permintaan (tanpa singgahan) - perubahan admin berlaku seketika.
    const petaBas = await petaPemetaanBerlaku(db, "bas");
    const hasil = susunBarisBasMassal(sidang, { namaAkun, saringan, katalog, lembar, petaBas });

    return ok({
      tanggal,
      saringan,
      lihatSemua,
      // KONTRAK K4 (perbaikan 1 Okt): admin yang melihat semua PP boleh
      // dikelompokkan per PP (tiap baris membawa `pengguna`). Ekstensi
      // menggambarnya per user hanya di UI Baru dan hanya untuk golongan admin
      // dari peran AKTIF - petunjuk ini tidak memaksa tampilan apa pun.
      kelompokPerUser: lihatSemua && saringan === "semua",
      nama: namaAkun,
      jumlahSemua: hasil.jumlahSemua,
      jumlahSaya: hasil.jumlahSaya,
      lembarTerbaca,
      katalog: Object.fromEntries(Object.entries(katalog).map(([f, k]) => [f, { terbaca: k.terbaca, sebab: k.sebab }])),
      sidang: hasil.baris,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_MASSAL_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-massal",
    });
  }
}
