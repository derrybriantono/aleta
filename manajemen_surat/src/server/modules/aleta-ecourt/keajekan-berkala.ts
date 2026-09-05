import { randomUUID } from "node:crypto";

import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import {
  bandingkanRiwayat,
  catatRiwayat,
  ringkasBerkas,
  riwayatPerkara,
  type Perubahan,
} from "@/server/modules/aleta-ecourt/berkas-riwayat";
import type { AletaDatabase } from "@/server/db/client";

/**
 * PEMERIKSAAN KEAJEKAN BERKALA (K6).
 *
 * ============================================================================
 * PEMBANDINGNYA SUDAH ADA; YANG KURANG PEMICUNYA
 * ============================================================================
 *
 * berkas-riwayat.ts sudah dapat merakit berkas, menyidiknya, dan menyebutkan
 * apa yang berubah sejak terakhir dirakit. Yang belum ada: sesuatu yang
 * menjalankannya tanpa diminta.
 *
 * Pemeriksaan yang hanya berjalan saat dibuka petugas memeriksa perkara yang
 * sedang dikerjakan - yaitu perkara yang paling tidak mungkin diam-diam
 * berubah. Perkara yang berubah tanpa diketahui justru perkara yang tidak
 * dibuka siapa pun selama sebulan.
 *
 * ============================================================================
 * MENEMUKAN PERUBAHAN BUKAN MENEMUKAN KESALAHAN
 * ============================================================================
 *
 * SIPP memang berubah sepanjang waktu - sidang bertambah, putusan diunggah,
 * panitera diganti. Sebagian besar temuan pemeriksaan ini WAJAR, dan
 * menampilkannya sebagai peringatan akan membuat daftarnya panjang lalu
 * berhenti dibaca.
 *
 * Karena itu hasilnya disebut "berubah", bukan "menyimpang", dan yang
 * ditonjolkan hanya perubahan pada bagian yang seharusnya TIDAK berubah lagi:
 * putusan yang sudah ada lalu hilang, saksi yang berkurang, tahapan yang
 * mundur. Itu yang menandakan sesuatu yang salah, bukan sekadar berjalan.
 *
 * ============================================================================
 * SATU PERKARA GAGAL TIDAK MENGHENTIKAN SISANYA
 * ============================================================================
 *
 * Pemeriksaan berkala menyentuh ratusan perkara. Berhenti pada perkara
 * pertama yang jembatannya gagal berarti pemeriksaan tidak pernah selesai
 * pada hari SIPP sedang sibuk - dan hari SIPP sibuk adalah hari perkara
 * paling banyak berubah.
 */

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

export type TemuanKeajekan = {
  perkaraId: string;
  nomorPerkara: string;
  perubahan: Perubahan[];
  /** Perubahan pada bagian yang seharusnya tidak mundur. */
  mencurigakan: Perubahan[];
  galat: string;
};

export type HasilKeajekan = {
  jalanId: string;
  jumlahPerkara: number;
  jumlahBerubah: number;
  jumlahGalat: number;
  temuan: TemuanKeajekan[];
};

/**
 * Bagian yang seharusnya tidak berkurang.
 *
 * Sidang, saksi, dan putusan hanya bertambah dalam perjalanan perkara.
 * Berkurangnya menandakan salah satu dari dua hal - datanya dihapus di SIPP,
 * atau penarikan ALETA membaca perkara yang keliru - dan keduanya perlu
 * dilihat orang.
 */
const TIDAK_BOLEH_MUNDUR = new Set([
  "Sidang tercatat",
  "Saksi tercatat",
  "Saksi diperiksa",
  "Putusan",
  "Pertimbangan hukum",
]);

function mencurigakan(perubahan: Perubahan[]): Perubahan[] {
  return perubahan.filter((satu) => {
    if (!TIDAK_BOLEH_MUNDUR.has(satu.hal)) return false;
    const dari = Number(satu.dari);
    const menjadi = Number(satu.menjadi);
    if (Number.isFinite(dari) && Number.isFinite(menjadi)) return menjadi < dari;
    // Bukan angka - "ada" menjadi "belum ada" juga mundur.
    return satu.dari !== "belum ada" && satu.menjadi === "belum ada";
  });
}

/**
 * Menjalankan pemeriksaan atas sekumpulan perkara.
 *
 * Perkara diberikan pemanggil, tidak dipilih di sini. Yang menentukan perkara
 * mana yang perlu diperiksa adalah keadaannya di SIPP - dan itu pengetahuan
 * yang berada di jembatan, bukan di sini.
 */
export async function jalankanKeajekan(
  db: AletaDatabase,
  masukan: { perkaraId: string[]; oleh: string }
): Promise<HasilKeajekan> {
  const jalanId = randomUUID();
  const mulai = new Date().toISOString();
  const daftar = [...new Set((masukan.perkaraId ?? []).map(bersih).filter(Boolean))];

  await db.run(
    `INSERT INTO aleta_keajekan_jalan
       (id, dijalankan_at, dijalankan_oleh, jumlah_perkara, jumlah_berubah, jumlah_galat, temuan)
     VALUES (?, ?, ?, ?, 0, 0, '[]')`,
    [jalanId, mulai, bersih(masukan.oleh), daftar.length]
  );

  const temuan: TemuanKeajekan[] = [];
  let berubah = 0;
  let galat = 0;

  for (const perkaraId of daftar) {
    // Satu perkara gagal tidak menghentikan sisanya - lihat catatan di atas.
    try {
      const berkas = await rakitBerkasPerkara(perkaraId);
      const ringkasan = ringkasBerkas(berkas);
      const sebelumnya = (await riwayatPerkara(db, perkaraId, 1))[0];

      await catatRiwayat(db, berkas, bersih(masukan.oleh) || "pemeriksaan berkala");

      if (!sebelumnya) continue;

      const perubahan = bandingkanRiwayat(sebelumnya.ringkasan, ringkasan);
      if (!perubahan.length) continue;

      berubah += 1;
      temuan.push({
        perkaraId,
        nomorPerkara: berkas.nomorPerkara,
        perubahan,
        mencurigakan: mencurigakan(perubahan),
        galat: "",
      });
    } catch (error) {
      galat += 1;
      temuan.push({
        perkaraId,
        nomorPerkara: "",
        perubahan: [],
        mencurigakan: [],
        galat: error instanceof Error ? error.message : "Tidak terbaca.",
      });
    }
  }

  // Yang mencurigakan lebih dulu, lalu yang bergalat, lalu sisanya. Daftar
  // yang urutannya sembarang akan dibaca dari atas lalu ditinggalkan.
  temuan.sort(
    (a, b) =>
      b.mencurigakan.length - a.mencurigakan.length ||
      (b.galat ? 1 : 0) - (a.galat ? 1 : 0) ||
      a.nomorPerkara.localeCompare(b.nomorPerkara)
  );

  await db.run(
    `UPDATE aleta_keajekan_jalan
        SET jumlah_berubah = ?, jumlah_galat = ?, temuan = ?, selesai_at = ?
      WHERE id = ?`,
    [berubah, galat, JSON.stringify(temuan.slice(0, 200)), new Date().toISOString(), jalanId]
  );

  return { jalanId, jumlahPerkara: daftar.length, jumlahBerubah: berubah, jumlahGalat: galat, temuan };
}

export type JalanKeajekan = {
  id: string;
  dijalankanAt: string;
  dijalankanOleh: string;
  jumlahPerkara: number;
  jumlahBerubah: number;
  jumlahGalat: number;
  selesaiAt: string;
  temuan: TemuanKeajekan[];
};

export async function riwayatKeajekan(db: AletaDatabase, batas = 20): Promise<JalanKeajekan[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_keajekan_jalan ORDER BY dijalankan_at DESC LIMIT ${Math.min(Math.max(batas, 1), 100)}`
  );
  return baris.map((item) => {
    let temuan: TemuanKeajekan[] = [];
    try {
      const hasil = JSON.parse(bersih(item.temuan) || "[]");
      if (Array.isArray(hasil)) temuan = hasil;
    } catch {
      temuan = [];
    }
    return {
      id: bersih(item.id),
      dijalankanAt: bersih(item.dijalankan_at),
      dijalankanOleh: bersih(item.dijalankan_oleh),
      jumlahPerkara: Number(item.jumlah_perkara ?? 0),
      jumlahBerubah: Number(item.jumlah_berubah ?? 0),
      jumlahGalat: Number(item.jumlah_galat ?? 0),
      selesaiAt: bersih(item.selesai_at),
      temuan,
    };
  });
}

/**
 * Apakah pemeriksaan sudah lewat waktunya.
 *
 * Menjawab dengan sebab, bukan hanya benar-salah. "Sudah 9 hari sejak
 * pemeriksaan terakhir" dapat ditindaklanjuti; "true" tidak.
 */
export async function perluDijalankan(
  db: AletaDatabase,
  jarakHari = 7,
  sekarang = new Date()
): Promise<{ perlu: boolean; sebab: string }> {
  const terakhir = (await riwayatKeajekan(db, 1))[0];
  if (!terakhir) {
    return { perlu: true, sebab: "Pemeriksaan keajekan belum pernah dijalankan." };
  }

  const waktu = new Date(terakhir.dijalankanAt);
  if (Number.isNaN(waktu.getTime())) {
    return { perlu: true, sebab: "Waktu pemeriksaan terakhir tidak terbaca." };
  }

  const hari = (sekarang.getTime() - waktu.getTime()) / 86_400_000;
  return hari >= jarakHari
    ? { perlu: true, sebab: `Sudah ${Math.floor(hari)} hari sejak pemeriksaan terakhir.` }
    : { perlu: false, sebab: `Pemeriksaan terakhir ${Math.floor(hari)} hari lalu.` };
}
