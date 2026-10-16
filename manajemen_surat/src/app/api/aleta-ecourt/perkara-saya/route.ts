import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { getGatewayJadwalSidang } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

import {
  peranDerryValid,
  potongRentang,
  susunPerkaraSaya,
  tentukanRentang,
  type BarisSidangSaya,
} from "./susun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bot menyerahkan paling banyak 500 baris per permintaan (sippJadwalSidangService). */
const BATAS_BARIS_BOT = 500;
/** Berapa potongan minggu dibaca bersamaan - bot dan basis data SIPP tidak dikeroyok. */
const SERENTAK = 4;

/**
 * ============================================================================
 * PERKARA SAYA - BAHAN DAFTAR PERKARA "BLANGKO ABT BY DERRY BRIANTONO" (TAHAP D)
 * ============================================================================
 *
 *   GET ?mode=hari
 *   GET ?mode=rentang&dari=YYYY-MM-DD&sampai=YYYY-MM-DD   (paling lama 62 hari)
 *   GET ?mode=semua                                        (90 hari lalu - 45 hari ke depan)
 *   GET ... &sebagai=<nama>&peranSebagai=hakim|pp|js       (khusus admin: "Lihat sebagai akun")
 *
 * Perkara yang bersidang pada rentang itu dan MILIK akun yang masuk: hakim =
 * perkara yang majelisnya memuat namanya, panitera pengganti = paniteraNama,
 * juru sita = jurusitaNama. Super Admin dan Admin melihat semua perkara.
 *
 * ============================================================================
 * HANYA MEMBACA
 * ============================================================================
 *
 * Jadwal diminta LANGSUNG ke bot, bukan lewat rute /sidang: rute itu menulis
 * rekaman antrian sebagai efek samping, dan daftar yang dibuka berkali-kali
 * tidak boleh ikut menulis. Kewenangannya "panel" - sama dengan BAS massal
 * dan Jadwal Sidang. Tidak ada tabel baru.
 *
 * Rentang lebar dipecah per minggu (bot memotong di 500 baris per
 * permintaan, satker bersidang ±250 baris seminggu). Satu potongan yang gagal
 * membuat seluruh jawaban 502 - daftar separuh terbaca "perkara saya hanya
 * sekian", kabar yang salah. Potongan yang penuh (500 baris) ditandai
 * `terpotong`, dan layar wajib mengatakannya.
 *
 * Nama petugas dicocokkan dengan aturan layar Jadwal Sidang (namaAdaDi) tetapi
 * gagal-TERTUTUP: bila tak satu pun cocok, daftarnya kosong dan
 * `adaYangCocok` salah - bukan diganti seluruh satker.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");

    const cari = request.nextUrl.searchParams;
    const hariIni = waktuPengadilan().tanggal;
    const rentang = tentukanRentang(
      {
        mode: (cari.get("mode") || "").trim(),
        dari: (cari.get("dari") || "").trim(),
        sampai: (cari.get("sampai") || "").trim(),
      },
      hariIni
    );
    if (!rentang.ok) return Response.json({ ok: false, alasan: rentang.alasan }, { status: 400 });

    const lihatSemua = isPrivilegedAdmin(actor);
    // "Lihat sebagai" hanya berlaku bagi admin; bagi yang lain parameternya diabaikan.
    const sebagaiNama = lihatSemua ? (cari.get("sebagai") || "").trim() : "";
    const sebagaiPeran = lihatSemua ? peranDerryValid(cari.get("peranSebagai")) : null;

    const potongan = potongRentang(rentang.dari, rentang.sampai);
    const baris: BarisSidangSaya[] = [];
    let terpotong = false;
    for (let i = 0; i < potongan.length; i += SERENTAK) {
      const kelompok = potongan.slice(i, i + SERENTAK);
      const jawaban = await Promise.all(
        kelompok.map((p) => getGatewayJadwalSidang({ dari: p.dari, sampai: p.sampai, cari: "", batas: BATAS_BARIS_BOT }))
      );
      for (const j of jawaban) {
        if (!j.ok) {
          return Response.json(
            { ok: false, alasan: j.error || "Jadwal sidang belum dapat dibaca dari ALETA Bot." },
            { status: 502 }
          );
        }
        const sidang = (Array.isArray(j.data?.sidang) ? j.data.sidang : []) as unknown as BarisSidangSaya[];
        if (sidang.length >= BATAS_BARIS_BOT) terpotong = true;
        baris.push(...sidang);
      }
    }

    const hasil = susunPerkaraSaya(baris, {
      hariIni,
      nama: String(actor?.name || ""),
      lihatSemua,
      sebagaiNama,
      sebagaiPeran,
    });

    return ok({
      hariIni,
      mode: rentang.mode,
      dari: rentang.dari,
      sampai: rentang.sampai,
      lihatSemua,
      nama: String(actor?.name || ""),
      sebagaiNama,
      sebagaiPeran,
      terpotong,
      jumlahSemua: hasil.jumlahSemua,
      adaYangCocok: hasil.adaYangCocok,
      akun: hasil.akun,
      perkara: hasil.perkara,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PERKARA_SAYA_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "perkara-saya",
    });
  }
}
