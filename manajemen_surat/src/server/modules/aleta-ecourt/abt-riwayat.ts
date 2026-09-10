import { randomUUID } from "node:crypto";

import { type AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * JEJAK PERUBAHAN ABT - YANG BERTAHAN DAN DAPAT DIBACA ORANG LAIN
 * ============================================================================
 *
 * Riwayat perubahan ABT selama ini hanya ada di chrome.storage peramban yang
 * dipakai. Tercatat sendiri sebagai batasnya: "riwayatnya hanya ada di
 * peramban ini, dan hilang bila datanya dibersihkan".
 *
 * Tiga akibat yang nyata: hilang saat data peramban dibersihkan, tidak ada
 * pada peramban lain milik orang yang sama, dan tidak terlihat oleh siapa pun
 * selain yang menyuntingnya - sehingga tidak dapat dipakai mengawasi apa pun.
 *
 * ============================================================================
 * DUA SALINAN, DAN MASING-MASING PUNYA TUGASNYA
 * ============================================================================
 *
 *   peramban   LENGKAP, ada seketika, dan menggerakkan tombol Urungkan
 *   peladen    BERTAHAN, dapat dibaca orang lain, dan menjadi jejak pengawasan
 *
 * Menjadikan peladen satu-satunya sumber akan mematikan Urungkan setiap kali
 * jaringan terputus - padahal justru saat sesuatu baru saja salah diterapkanlah
 * tombol itu paling dibutuhkan. Karena itu pencatatan ke sini bersifat
 * TAMBAHAN: gagal menuliskannya tidak boleh menggagalkan penyuntingannya.
 */

/**
 * Batas panjang isi yang disimpan.
 *
 * Posita satu perkara dapat mencapai puluhan ribu huruf, dan menyimpan dua
 * salinannya - sebelum dan sesudah - pada tiap penyuntingan akan menggelembung
 * tanpa guna yang sebanding. Jejak di sini dipakai untuk MELIHAT apa yang
 * berubah, bukan untuk mengembalikannya; yang mengembalikan salinan peramban,
 * dan salinan itu utuh.
 *
 * Yang dipotong DITANDAI. Jejak yang dipotong diam-diam lebih buruk daripada
 * jejak yang mengaku dipotong: yang membacanya akan menyangka itulah seluruh
 * perubahannya, lalu menyimpulkan hal yang keliru tentang orang.
 */
export const BATAS_ISI = 4000;

export type MasukanRiwayat = {
  perkaraId: string;
  nomorPerkara?: string;
  kode?: string;
  nama?: string;
  sebelum?: string;
  sesudah?: string;
  cara?: string;
  pada?: string;
};

export type BarisRiwayat = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  kode: string;
  nama: string;
  sebelum: string;
  sesudah: string;
  dipotong: boolean;
  cara: string;
  oleh: string;
  pada: string;
};

function teks(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/** Memotong bila perlu, dan mengabarkan bahwa ia dipotong. */
function potong(nilai: unknown): { isi: string; dipotong: boolean } {
  const penuh = String(nilai ?? "");
  if (penuh.length <= BATAS_ISI) return { isi: penuh, dipotong: false };
  return { isi: penuh.slice(0, BATAS_ISI), dipotong: true };
}

/**
 * Mencatat satu perubahan.
 *
 * Waktunya diambil dari yang dikirim ekstensi bila ada - itulah saat
 * perubahannya benar-benar terjadi. Memakai waktu peladen akan menggeser
 * seluruh jejak yang tertahan karena jaringan, dan jejak yang waktunya
 * digeser tidak dapat disandingkan dengan apa pun.
 */
export async function catatRiwayat(
  db: AletaDatabase,
  actorUserId: string,
  masukan: MasukanRiwayat
): Promise<BarisRiwayat | null> {
  const perkaraId = teks(masukan.perkaraId);
  if (!perkaraId) return null;

  const sebelum = potong(masukan.sebelum);
  const sesudah = potong(masukan.sesudah);
  const pada = teks(masukan.pada) || new Date().toISOString();
  const id = randomUUID();

  await db.run(
    `INSERT INTO aleta_abt_riwayat
       (id, perkara_id, nomor_perkara, kode, nama, sebelum, sesudah, dipotong, cara, oleh, pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      perkaraId,
      teks(masukan.nomorPerkara),
      teks(masukan.kode),
      teks(masukan.nama),
      sebelum.isi,
      sesudah.isi,
      sebelum.dipotong || sesudah.dipotong ? 1 : 0,
      teks(masukan.cara),
      teks(actorUserId),
      pada,
    ]
  );

  return {
    id,
    perkaraId,
    nomorPerkara: teks(masukan.nomorPerkara),
    kode: teks(masukan.kode),
    nama: teks(masukan.nama),
    sebelum: sebelum.isi,
    sesudah: sesudah.isi,
    dipotong: sebelum.dipotong || sesudah.dipotong,
    cara: teks(masukan.cara),
    oleh: teks(actorUserId),
    pada,
  };
}

/** Berapa baris terbanyak yang dipulangkan sekali baca. */
export const BATAS_BARIS = 200;

/**
 * Jejak satu perkara, terbaru dahulu.
 *
 * Nama penyuntingnya digabungkan di sini, bukan lewat JOIN berkorelasi:
 * basis data dalam memori yang dipakai saat Postgres tidak tersedia tidak
 * menanganinya, dan halaman yang hanya jalan di salah satunya berarti ia mati
 * justru pada keadaan darurat yang membuat cadangan itu ada.
 */
export async function bacaRiwayat(
  db: AletaDatabase,
  perkaraId: string,
  batas = BATAS_BARIS
): Promise<BarisRiwayat[]> {
  const id = teks(perkaraId);
  if (!id) return [];

  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT id, perkara_id, nomor_perkara, kode, nama, sebelum, sesudah, dipotong, cara, oleh, pada
       FROM aleta_abt_riwayat
      WHERE perkara_id = ?
      ORDER BY pada DESC
      LIMIT ${Math.max(1, Math.min(Number(batas) || BATAS_BARIS, BATAS_BARIS))}`,
    [id]
  );

  return baris.map((x) => ({
    id: teks(x.id),
    perkaraId: teks(x.perkara_id),
    nomorPerkara: teks(x.nomor_perkara),
    kode: teks(x.kode),
    nama: teks(x.nama),
    sebelum: String(x.sebelum ?? ""),
    sesudah: String(x.sesudah ?? ""),
    dipotong: Number(x.dipotong) === 1,
    cara: teks(x.cara),
    oleh: teks(x.oleh),
    pada: teks(x.pada),
  }));
}
