/**
 * ============================================================================
 * PENGATURAN LAYAR ANTRIAN TANPA LOGIN
 * ============================================================================
 *
 * Satu baris di aleta_antrian_publik, dibaca layar publiknya dan ditulis panel
 * admin. Sebab dan akibat tiap ruas ada di src/lib/antrian-publik.ts.
 *
 * ============================================================================
 * GAGAL-TERTUTUP, DAN ITU KEBALIKAN DARI BAWAANNYA
 * ============================================================================
 *
 * Bawaannya seluruh ruas menyala - itu permintaan pengguna, dan itu berlaku
 * ketika pengaturannya TERBACA.
 *
 * Ketika pengaturannya TIDAK terbaca - tabelnya belum ada, migrasinya belum
 * jalan, basis datanya sedang bermasalah - yang dipulangkan bukan bawaan itu,
 * melainkan bentuk paling sempit: empat ruas tak berisiko saja. Sebabnya:
 * ruas peka yang tampil karena kegagalan pembacaan adalah ruas yang tidak
 * pernah diputuskan siapa pun, dan ia akan tampil persis pada saat tidak ada
 * yang sedang memperhatikan.
 */

import {
  BAWAAN_ANTRIAN_PUBLIK,
  normalkanTampilAntrianPublik,
  RUAS_ANTRIAN_PUBLIK,
  type PengaturanAntrianPublik,
  type TampilAntrianPublik,
} from "@/lib/antrian-publik";
import type { AletaDatabase } from "@/server/db/client";

type BarisPengaturan = {
  aktif: boolean;
  tampil_json: string;
  judul: string;
  catatan: string;
  diperbarui_pada: string;
};

/** Bentuk paling sempit - dipakai HANYA ketika pengaturannya tidak terbaca. */
function tampilPalingSempit(): TampilAntrianPublik {
  const hasil: TampilAntrianPublik = {};
  for (const ruas of RUAS_ANTRIAN_PUBLIK) hasil[ruas.kunci] = !ruas.peka;
  return hasil;
}

export function pengaturanTertutup(): PengaturanAntrianPublik {
  return { ...BAWAAN_ANTRIAN_PUBLIK, tampil: tampilPalingSempit() };
}

export async function bacaPengaturanAntrianPublik(
  db: AletaDatabase
): Promise<PengaturanAntrianPublik> {
  let baris: BarisPengaturan | undefined;
  try {
    baris = await db
      .prepare(
        `SELECT aktif, tampil_json, judul, catatan, diperbarui_pada
           FROM aleta_antrian_publik
          WHERE id = 1`
      )
      .get<BarisPengaturan>();
  } catch {
    // Tabelnya belum ada - migrasi belum berjalan. Lihat catatan di kepala.
    return pengaturanTertutup();
  }

  if (!baris) return pengaturanTertutup();

  let tampilMentah: unknown = {};
  try {
    tampilMentah = JSON.parse(String(baris.tampil_json || "{}"));
  } catch {
    // JSON rusak diperlakukan sebagai "belum disetel", bukan sebagai izin.
    tampilMentah = {};
  }

  return {
    aktif: Boolean(baris.aktif),
    tampil: normalkanTampilAntrianPublik(tampilMentah),
    judul: String(baris.judul || ""),
    catatan: String(baris.catatan || ""),
    diperbaruiPada: String(baris.diperbarui_pada || ""),
  };
}

export async function simpanPengaturanAntrianPublik(
  db: AletaDatabase,
  aktorUserId: string | null,
  masukan: { aktif: boolean; tampil: unknown; judul: string; catatan: string }
): Promise<PengaturanAntrianPublik> {
  const tampil = normalkanTampilAntrianPublik(masukan.tampil);
  const sekarang = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO aleta_antrian_publik (id, aktif, tampil_json, judul, catatan, diperbarui_oleh, diperbarui_pada)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         aktif = EXCLUDED.aktif,
         tampil_json = EXCLUDED.tampil_json,
         judul = EXCLUDED.judul,
         catatan = EXCLUDED.catatan,
         diperbarui_oleh = EXCLUDED.diperbarui_oleh,
         diperbarui_pada = EXCLUDED.diperbarui_pada`
    )
    .run(
      Boolean(masukan.aktif),
      JSON.stringify(tampil),
      String(masukan.judul || "").slice(0, 200),
      String(masukan.catatan || "").slice(0, 500),
      aktorUserId,
      sekarang
    );

  return {
    aktif: Boolean(masukan.aktif),
    tampil,
    judul: String(masukan.judul || "").slice(0, 200),
    catatan: String(masukan.catatan || "").slice(0, 500),
    diperbaruiPada: sekarang,
  };
}
