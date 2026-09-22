import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";

/**
 * ============================================================================
 * KETERANGAN PERKARA - CATATAN BEBAS, TAMBAH SAJA
 * ============================================================================
 *
 * Tiap suntingan menjadi BARIS BARU bernomor urut, bukan menimpa yang lama.
 * Yang berlaku baris berurutan tertinggi; sisanya riwayat.
 *
 * Sebabnya bukan kerapian. Catatan semacam ini dibaca orang untuk mengambil
 * keputusan - menunda sidang, menunggu berkas, menghubungi pihak - dan ketika
 * keputusan itu kelak dipertanyakan, yang ditanyakan justru "waktu itu
 * tulisannya apa". Menimpa baris lama menghapus jawabannya.
 *
 * Karena itu modul ini tidak punya fungsi ubah maupun hapus, dan itu disengaja.
 */

/** Satu revisi keterangan - sebagaimana tersimpan. */
export type KeteranganRevisi = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  /** Perubahan keberapa. Mulai dari 1. */
  urutan: number;
  isi: string;
  ditulisOleh: string;
  namaPenulis: string;
  jabatan: string;
  ditulisAt: string;
};

/** Keadaan keterangan satu perkara: yang berlaku, dan berapa kali diubah. */
export type KeteranganPerkara = {
  perkaraId: string;
  /** Revisi terakhir - yang berlaku. null bila belum pernah diisi. */
  terkini: KeteranganRevisi | null;
  /** Berapa revisi seluruhnya. 0 bila belum pernah diisi. */
  jumlahRevisi: number;
};

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

function dariBaris(row: Record<string, unknown>): KeteranganRevisi {
  return {
    id: teks(row.id),
    perkaraId: teks(row.perkara_id),
    nomorPerkara: teks(row.nomor_perkara),
    urutan: Number(row.urutan) || 0,
    // Isi TIDAK di-trim ke dalam: orang menulis daftar berbaris, dan
    // meratakannya di sini membuang bentuk yang sengaja dibuatnya.
    isi: String(row.isi ?? ""),
    ditulisOleh: teks(row.ditulis_oleh),
    namaPenulis: teks(row.nama_penulis),
    jabatan: teks(row.jabatan),
    ditulisAt: teks(row.ditulis_at),
  };
}

/**
 * Keadaan keterangan untuk sekumpulan perkara - untuk daftar sidang.
 *
 * Yang dipulangkan hanya revisi TERAKHIR beserta jumlahnya, bukan seluruh
 * riwayatnya. Daftar dua puluh tujuh perkara yang masing-masing membawa
 * sepuluh revisi berarti dua ratus tujuh puluh catatan yang tidak satu pun
 * dibaca sampai ada yang menekan tombolnya.
 */
export async function bacaKeteranganPerkara(
  db: AletaDatabase,
  perkaraIds: string[]
): Promise<Record<string, KeteranganPerkara>> {
  const daftar = [...new Set(perkaraIds.map(teks).filter(Boolean))];
  if (daftar.length === 0) return {};

  // Batas yang sama dengan konseptor sementara, dan sebabnya sama: daftar
  // tanda tanya yang tumbuh sebesar apa pun akan menabrak batas parameter
  // basis data pada hari seseorang membuka rentang setahun.
  const potong = daftar.slice(0, 500);
  const tanya = potong.map(() => "?").join(", ");

  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT id, perkara_id, nomor_perkara, urutan, isi,
            ditulis_oleh, nama_penulis, jabatan, ditulis_at
       FROM aleta_keterangan_perkara
      WHERE perkara_id IN (${tanya})
      ORDER BY perkara_id ASC, urutan ASC`,
    potong
  );

  const peta: Record<string, KeteranganPerkara> = {};
  for (const row of baris) {
    const satu = dariBaris(row);
    if (!satu.perkaraId) continue;
    const ada = peta[satu.perkaraId];
    if (!ada) {
      peta[satu.perkaraId] = { perkaraId: satu.perkaraId, terkini: satu, jumlahRevisi: 1 };
      continue;
    }
    ada.jumlahRevisi += 1;
    // Diurutkan menaik, jadi yang terakhir dibaca yang tertinggi. Dibandingkan
    // juga urutannya - urutan basis data tidak dijamin bila indeksnya kelak
    // berubah, dan yang bergantung pada urutan baris bergantung pada kebetulan.
    if (satu.urutan >= (ada.terkini?.urutan ?? 0)) ada.terkini = satu;
  }
  return peta;
}

/**
 * Seluruh riwayat satu perkara, urut dari yang terbaru.
 *
 * Dipanggil hanya ketika tombolnya ditekan - lihat sebabnya di
 * bacaKeteranganPerkara.
 */
export async function riwayatKeteranganPerkara(
  db: AletaDatabase,
  perkaraId: string
): Promise<KeteranganRevisi[]> {
  const id = teks(perkaraId);
  if (!id) return [];
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT id, perkara_id, nomor_perkara, urutan, isi,
            ditulis_oleh, nama_penulis, jabatan, ditulis_at
       FROM aleta_keterangan_perkara
      WHERE perkara_id = ?
      ORDER BY urutan DESC`,
    [id]
  );
  return baris.map(dariBaris);
}

/**
 * Menambahkan satu revisi.
 *
 * TIDAK pernah menimpa. Nomor urutnya dihitung dari yang tertinggi yang sudah
 * ada, bukan dari jumlah barisnya: menghitung dari jumlah membuat nomor
 * berulang bila suatu hari ada baris yang terhapus dengan tangan, dan nomor
 * yang berulang membuat riwayatnya tidak dapat dibaca.
 */
export async function tambahKeteranganPerkara(
  db: AletaDatabase,
  masukan: {
    perkaraId: string;
    nomorPerkara?: string;
    isi: string;
    ditulisOleh?: string;
    namaPenulis?: string;
    jabatan?: string;
  }
): Promise<{ ok: boolean; alasan?: string; revisi?: KeteranganRevisi }> {
  const perkaraId = teks(masukan.perkaraId);
  if (!perkaraId) return { ok: false, alasan: "perkara_id belum disebut." };

  // Isi kosong TIDAK disimpan sebagai revisi kosong - ia bukan catatan.
  // Yang hendak menghapus catatannya menulis revisi baru yang menyatakan itu;
  // baris kosong di tengah riwayat hanya membingungkan yang membacanya.
  const isi = String(masukan.isi ?? "").trim();
  if (!isi) return { ok: false, alasan: "Keterangannya masih kosong." };

  // Batas yang longgar tetapi ada. Tanpa batas, satu tempelan naskah putusan
  // masuk ke kolom catatan dan seluruh daftar sidang ikut memuatnya.
  if (isi.length > 5000) {
    return { ok: false, alasan: "Keterangan melampaui 5.000 huruf." };
  }

  const tertinggi = await db.queryAll<Record<string, unknown>>(
    `SELECT MAX(urutan) AS puncak FROM aleta_keterangan_perkara WHERE perkara_id = ?`,
    [perkaraId]
  );
  const urutan = (Number(tertinggi?.[0]?.puncak) || 0) + 1;

  const revisi: KeteranganRevisi = {
    id: randomUUID(),
    perkaraId,
    nomorPerkara: teks(masukan.nomorPerkara),
    urutan,
    isi,
    ditulisOleh: teks(masukan.ditulisOleh),
    namaPenulis: teks(masukan.namaPenulis),
    jabatan: teks(masukan.jabatan),
    ditulisAt: new Date().toISOString(),
  };

  await db.run(
    `INSERT INTO aleta_keterangan_perkara
       (id, perkara_id, nomor_perkara, urutan, isi, ditulis_oleh, nama_penulis, jabatan, ditulis_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      revisi.id,
      revisi.perkaraId,
      revisi.nomorPerkara,
      revisi.urutan,
      revisi.isi,
      revisi.ditulisOleh,
      revisi.namaPenulis,
      revisi.jabatan,
      revisi.ditulisAt,
    ]
  );

  return { ok: true, revisi };
}
