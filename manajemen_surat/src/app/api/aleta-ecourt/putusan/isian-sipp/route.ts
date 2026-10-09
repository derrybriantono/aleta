import { type NextRequest } from "next/server";

import { susunIsianPutusanSipp, type PihakPerkara } from "@/lib/isian-putusan-sipp";
import { saringMedanPilihan, usulkanMedanPutusan, type TipeUsulanMedan } from "@/lib/usulan-medan-putusan";
import { pecahNaskahPutusan } from "@/lib/susunan-putusan";
import { readJsonBody } from "@/server/shared/request";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { untukPortal } from "@/server/modules/aleta-ecourt/tipe-keluaran";
import { getGatewaySippKonteks } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daftar tipe keluaran yang dibaca usulkanMedanPutusan (opsi.tipe). */
const DAFTAR_TIPE_PUTUSAN = ["putusan.sumber-hukum.sebutan", "putusan.bawaan-medan"] as const;

/**
 * Daftar efektif (kontrak K3) untuk borang putusan, APA ADANYA dari
 * untukPortal - termasuk bila tabelnya tak terbaca dan untukPortal sendiri
 * sudah jatuh ke cermin kode.
 *
 * Galat yang lolos dari untukPortal (basis data tidak dapat dipakai sama
 * sekali) TIDAK menggagalkan usulan: tipe dikosongkan, usulkanMedanPutusan
 * memakai konstantanya, dan sebabnya dipulangkan sebagai kabar. Galatnya
 * dicatat, tidak ditelan.
 */
async function bacaTipePutusan(
  db: Awaited<ReturnType<typeof getDatabase>>
): Promise<{ tipe: TipeUsulanMedan | null; kabar: string[] }> {
  try {
    const hasil = await untukPortal(db, DAFTAR_TIPE_PUTUSAN);
    const tipe: TipeUsulanMedan = {};
    for (const kunci of DAFTAR_TIPE_PUTUSAN) {
      if (Array.isArray(hasil.daftar[kunci])) tipe[kunci] = hasil.daftar[kunci];
    }
    return { tipe, kabar: hasil.kabar };
  } catch (galat) {
    console.error("[ISIAN SIPP] Tipe keluaran tidak terbaca; memakai bawaan kode.", galat);
    const pesan = galat instanceof Error ? galat.message : String(galat);
    return { tipe: null, kabar: [`Tipe keluaran tidak terbaca - memakai bawaan: ${pesan}`] };
  }
}

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
    // Usulan isian borang Putusan Akhir = bahan "Isikan yang dicentang" dan
    // putusan otomatis/massal yang lalu disimpan ke SIPP. Keputusan 9 Okt 2026:
    // hanya Super Admin, Admin, dan Hakim (termasuk Ketua/Wakil) - 403 bagi
    // peran lain, supaya tombol yang tersembunyi di layar tidak dapat
    // dijalankan dari luar panel.
    await pastikanBolehUnggahPutusan(db, actorUserId);

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
 *   POST { nomorPerkara, jenisPerkara?,
 *          medan: [{ kunci, label, pilihan: [{nilai, label}], banyak?, terpilih? }] }
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
 * ============================================================================
 * DUA MASUKAN YANG TERPISAH: DASAR DAN AMAR
 * ============================================================================
 *
 * Fakta medan pilihan - faktor, nusyuz, qobla, alasan - dicari di
 * PERTIMBANGAN dan DUDUK PERKARA: di situlah faktanya diuraikan. Amar berisi
 * hukumannya, bukan sebabnya, dan mencari fakta di sana hanya menambah salah
 * tangkap.
 *
 * Tetapi Status Putusan dan Verstek justru dinyatakan AMAR, dan dari
 * pertimbangan keduanya salah berpola: "permohonan pencabutan ... dapat
 * dikabulkan" terbaca Dikabulkan. Karena itu amar draf dikirim sebagai
 * masukan TERPISAH (opsi.amar) - tidak digabung ke dasar - dan hanya dibaca
 * untuk kedua medan itu. Diukur atas 1.633 putusan 2025-2026: status dari
 * pertimbangan 1.382 sama dengan isian petugas, dari amar 1.598.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    // Usulan isian borang Putusan Akhir = bahan "Isikan yang dicentang" dan
    // putusan otomatis/massal yang lalu disimpan ke SIPP. Keputusan 9 Okt 2026:
    // hanya Super Admin, Admin, dan Hakim (termasuk Ketua/Wakil) - 403 bagi
    // peran lain, supaya tombol yang tersembunyi di layar tidak dapat
    // dijalankan dari luar panel.
    await pastikanBolehUnggahPutusan(db, actorUserId);

    const badan = await readJsonBody<{
      nomorPerkara?: string;
      medan?: unknown;
      jenisPerkara?: string;
    }>(request);
    const nomorPerkara = String(badan?.nomorPerkara ?? "").trim();
    const medan = saringMedanPilihan(badan?.medan);

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
    // Amar draf - TERPISAH dari dasar, lihat catatan di atas POST.
    const amar = bagian.amar ?? "";

    // Jenis perkaranya menentukan bawaan sebagian medan - Keadaan Isteri
    // "Suci" pada cerai gugat, "Tidak diketahui" pada cerai talak. Dikirim
    // ekstensi dari jawaban GET yang sudah dibacanya, bukan ditanyakan lagi
    // ke SIPP: ia jawaban yang sama, dan menanyakannya dua kali menambah satu
    // penantian pada tiap pembacaan.
    const jenisPerkara = String(badan?.jenisPerkara ?? "").trim();

    // Sebutan sumber hukum dan bawaan medan milik satker (tipe keluaran).
    // Tak terbaca = konstanta kode, dengan kabarnya - tidak pernah 500.
    const { tipe, kabar } = await bacaTipePutusan(db);

    return ok({
      ada: true,
      versi: baris.versi,
      keadaan: baris.keadaan,
      // Nusyuz dan keadaan isteri adalah TEMUAN majelis: dibaca dari
      // pertimbangan saja. Duduk perkara memuat posita, jawaban, dan saksi
      // yang menceritakan kehamilan lampau dan klaim para pihak (pemeriksa
      // 26 September 2026). Medan lain tetap membaca `dasar`.
      usulan: usulkanMedanPutusan(dasar, medan, { jenisPerkara, amar, tipe, pertimbangan: bagian.pertimbangan ?? "" }),
      // Hanya muncul bila ada yang perlu dikatakan, supaya jawaban pada
      // keadaan biasa sama persis dengan sebelum daftar ini disambung.
      ...(kabar.length ? { kabarTipeKeluaran: kabar } : {}),
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
