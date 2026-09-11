import { type NextRequest } from "next/server";

import { susunIsianPutusanSipp, type PihakPerkara } from "@/lib/isian-putusan-sipp";
import { usulkanMedanPutusan, type MedanPilihan } from "@/lib/usulan-medan-putusan";
import { pecahNaskahPutusan } from "@/lib/susunan-putusan";
import { readJsonBody } from "@/server/shared/request";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewaySippKonteks } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Usulan isian borang Putusan Akhir SIPP.
 *
 *   GET ?nomorPerkara=10/Pdt.G/2026/PA.Dgl
 *
 * ============================================================================
 * DIPANGGIL EKSTENSI DARI HALAMAN SIPP
 * ============================================================================
 *
 * Ekstensi berjalan di halaman Putusan Akhir milik SIPP dan hanya tahu nomor
 * perkaranya. Rute ini yang mencarikan draf putusan ALETA terbaru untuk nomor
 * itu, memecahnya menjadi bagian yang dituntut borang, dan menyamarkan nama
 * pada amar anonimnya.
 *
 * Seluruh keputusan dibuat di sini, bukan di ekstensi: yang di sini diuji tiap
 * pemeriksaan berkala, sedangkan skrip yang berjalan di peramban petugas tidak
 * dapat dijalankan satu uji pun.
 *
 * ============================================================================
 * NOMOR STATUS PUTUSAN TIDAK PERNAH DIKIRIM DARI SINI
 * ============================================================================
 *
 * Daftar status putusan pada borang SIPP sudah disaring SIPP sendiri menurut
 * jenis dan alur perkaranya - dari 132 baris, hanya sebagian yang sah untuk
 * satu perkara. Ekstensi mencocokkan pada pilihan yang benar-benar ada di
 * halaman. Mengirimkan nomornya dari sini berarti menebak apa yang sudah
 * diketahui halamannya sendiri.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const nomorPerkara = String(getSearchParam(request, "nomorPerkara") ?? "").trim();
    if (!nomorPerkara) return ok({ ada: false, sebab: "Nomor perkara belum disebut." });

    // Draf TERBARU untuk nomor ini. Versi tertinggi, bukan yang terakhir
    // disimpan menurut waktu: dua draf dapat tersimpan pada detik yang sama,
    // dan versinya yang menentukan mana yang menggantikan mana.
    const baris = await db.queryOne<{
      id: string;
      naskah: string;
      keadaan: string;
      versi: number;
      nomor_perkara: string;
    }>(
      `SELECT id, naskah, keadaan, versi, nomor_perkara
         FROM aleta_putusan_draf
        WHERE nomor_perkara = ?
          AND keadaan <> 'dibatalkan'
        ORDER BY versi DESC
        LIMIT 1`,
      [nomorPerkara]
    );

    if (!baris) {
      return ok({
        ada: false,
        sebab: "Belum ada draf putusan ALETA untuk perkara ini. Rakit dulu drafnya di menu Putusan.",
      });
    }

    // Pihak dibaca dari SIPP lewat gerbang bot - portal tidak pernah menyentuh
    // SIPP sendiri. Gagal membacanya TIDAK menggagalkan seluruh permintaan:
    // pertimbangan dan amar tetap berguna, hanya amar anonimnya yang tidak
    // dapat disusun, dan itu dikatakan apa adanya.
    let pihak: PihakPerkara[] = [];
    let jenisPerkara = "";
    let sebabPihak = "";
    const konteks = await getGatewaySippKonteks(nomorPerkara);
    if (konteks.ok) {
      pihak = (konteks.data?.nomorPihak ?? []).map((satu) => ({
        nama: satu.nama,
        pihakKe: satu.pihakKe,
        jenis: satu.jenis,
      }));
      jenisPerkara = konteks.data?.identitas?.jenisPerkara ?? "";
    } else {
      sebabPihak = konteks.error || "SIPP tidak terbaca.";
    }

    const isian = susunIsianPutusanSipp({
      naskah: baris.naskah,
      pihak,
      jenisPerkara,
      keadaanDraf: baris.keadaan,
    });

    if (sebabPihak) {
      isian.catatan.unshift(
        `Nama pihak tidak terbaca dari SIPP (${sebabPihak}), jadi amar anonim TIDAK disamarkan. Samarkan sendiri sebelum menyimpan.`
      );
    }

    return ok({
      ada: true,
      drafId: baris.id,
      versi: baris.versi,
      keadaan: baris.keadaan,
      nomorPerkara: baris.nomor_perkara,
      jenisPerkara,
      ...isian,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_ISIAN_SIPP_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-isian-sipp",
    });
  }
}

/**
 * Usulan untuk MEDAN PILIHAN pada borang yang sama.
 *
 *   POST { nomorPerkara, medan: [{ kunci, label, pilihan: [{nilai, label}] }] }
 *
 * ============================================================================
 * DAFTAR PILIHANNYA DIKIRIM HALAMAN, BUKAN DISIMPAN DI SINI
 * ============================================================================
 *
 * Borang Putusan Akhir menuntut pilihan yang berbeda-beda menurut jenis
 * perkara dan status putusannya - faktor perceraian pada perkara cerai yang
 * dikabulkan, alasan dispensasi pada dispensasi kawin, keadaan istri pada
 * keadaan tertentu lagi. SIPP sendiri yang menyaring dan menyembunyikannya.
 *
 * Karena itu ekstensi mengirimkan daftar yang BENAR-BENAR ADA di borang yang
 * sedang terbuka, dan yang dikerjakan di sini hanya memilih satu di antaranya
 * berdasarkan bunyi putusan. Tidak ada satu pun nomor pilihan SIPP yang
 * dihafal portal: SIPP boleh menambah, menghapus, atau menomori ulang
 * daftarnya tanpa satu baris pun di sini berubah.
 *
 * Yang dicari di dalam naskah hanya PERTIMBANGAN dan DUDUK PERKARA - di
 * situlah faktanya diuraikan. Amar berisi hukumannya, bukan sebabnya, dan
 * mencarinya di sana hanya menambah salah tangkap.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const badan = await readJsonBody<{ nomorPerkara?: string; medan?: MedanPilihan[] }>(request);
    const nomorPerkara = String(badan?.nomorPerkara ?? "").trim();
    const medan = Array.isArray(badan?.medan) ? badan.medan : [];

    if (!nomorPerkara) return ok({ ada: false, sebab: "Nomor perkara belum disebut." });
    if (medan.length === 0) return ok({ ada: false, sebab: "Tidak ada medan pilihan yang perlu diusulkan." });

    const baris = await db.queryOne<{ naskah: string; keadaan: string; versi: number }>(
      `SELECT naskah, keadaan, versi
         FROM aleta_putusan_draf
        WHERE nomor_perkara = ?
          AND keadaan <> 'dibatalkan'
        ORDER BY versi DESC
        LIMIT 1`,
      [nomorPerkara]
    );

    if (!baris) {
      return ok({
        ada: false,
        sebab: "Belum ada draf putusan ALETA untuk perkara ini, jadi tidak ada bunyi yang dapat dibaca.",
      });
    }

    const bagian = pecahNaskahPutusan(baris.naskah);
    const dasar = [bagian.pertimbangan ?? "", bagian.dudukPerkara ?? ""].filter(Boolean).join("\n\n");

    return ok({
      ada: true,
      versi: baris.versi,
      keadaan: baris.keadaan,
      usulan: usulkanMedanPutusan(dasar, medan),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_USULAN_MEDAN_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-isian-sipp",
    });
  }
}
