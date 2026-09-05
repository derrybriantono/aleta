import { randomUUID } from "node:crypto";

import type { AletaDatabase } from "@/server/db/client";
import { bukaJangkar } from "@/server/modules/aleta-ecourt/pustaka-hukum";

/**
 * PENJAGAAN PUTUSAN (J1, J3, J4).
 *
 * ============================================================================
 * J1 - KUTIPAN WAJIB TERBUKTI
 * ============================================================================
 *
 * Pasal karangan adalah kegagalan terparah sistem semacam ini. Ia tidak
 * terlihat: pasal yang tidak ada tertulis persis seperti pasal yang ada,
 * bernomor wajar, dan dikutip dengan kalimat yang meyakinkan. Yang membacanya
 * tidak punya alasan curiga, dan yang memeriksanya harus membuka undang-undang
 * satu per satu.
 *
 * Satu-satunya cara mencegahnya adalah MENOLAK menyelesaikan draf yang
 * memuatnya. Bukan memperingatkan - peringatan pada draf yang lain-lainnya
 * sudah rapi akan dilewati. Menolak.
 *
 * ============================================================================
 * DASARNYA DIBEKUKAN, SEPERTI BUNYI BUTIRNYA
 * ============================================================================
 *
 * Yang disimpan bukan hanya "jangkar ini terbukti", melainkan versi peraturan
 * yang berlaku saat draf disusun. Peraturan dapat dicabut atau diubah; draf
 * yang hanya menunjuk jangkar akan berubah dasar hukumnya sesudah
 * ditandatangani, dengan cara yang sama diam-diamnya seperti butir yang
 * disunting.
 *
 * ============================================================================
 * J3 - HAKIM DI UJUNG
 * ============================================================================
 *
 * Tidak ada jalur yang menerbitkan putusan tanpa tangan hakim. Yang dijaga di
 * sini bukan hanya bahwa tanda tangan diminta, melainkan bahwa TIDAK ADA
 * jalur lain: simpanDraf selalu membuat keadaan 'draf', dan hanya
 * tandatanganiDraf yang dapat mengubahnya - dengan syarat siap dan nama hakim.
 */

export type Rujukan = {
  butirId: string;
  jangkar: string;
  tertulis: string;
};

export type DasarBeku = {
  butirId: string;
  jangkar: string;
  tertulis: string;
  /** Pengenal peraturan di pustaka - penunjuk yang tetap, bukan judulnya. */
  peraturan: string;
  /**
   * Versi peraturan saat draf disusun.
   *
   * jlf_regulations tidak punya nomor versi; yang menentukan versi sebuah
   * peraturan adalah tanggal berlakunya. Bila peraturannya sudah dicabut,
   * tanggal pencabutan ikut dicatat - draf yang mengutip peraturan yang sudah
   * dicabut adalah kekeliruan yang tidak terlihat dari bunyi pasalnya, karena
   * bunyinya memang masih ada dan masih benar.
   */
  versiPeraturan: string;
  terbukti: boolean;
  /** Peraturannya sudah dicabut pada saat draf disusun. */
  sudahDicabut: boolean;
};

export type HasilPembekuan = {
  dasar: DasarBeku[];
  /** Rujukan yang jangkarnya TIDAK ditemukan - inilah yang menahan draf. */
  takTerbukti: DasarBeku[];
  /** Pasalnya ada, tetapi peraturannya sudah dicabut. */
  dicabut: DasarBeku[];
  /** Rujukan yang bahkan tidak punya jangkar - peraturannya tak dikenali. */
  tanpaJangkar: Rujukan[];
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Mengumpulkan rujukan seluruh butir yang dipakai satu draf.
 *
 * Dibaca dari aleta_pertimbangan_rujukan, yang diisi saat butir diserap - jadi
 * rujukannya memang dibaca dari bunyi alineanya sendiri, bukan ditebak di sini.
 */
export async function rujukanButirDipakai(db: AletaDatabase, butirId: string[]): Promise<Rujukan[]> {
  const daftar = [...new Set((butirId ?? []).map(bersih).filter(Boolean))];
  if (!daftar.length) return [];

  const rujukan: Rujukan[] = [];
  for (const id of daftar) {
    const baris = await db.queryAll<Record<string, unknown>>(
      `SELECT butir_id, jangkar, tertulis FROM aleta_pertimbangan_rujukan WHERE butir_id = ?`,
      [id]
    );
    for (const item of baris) {
      rujukan.push({
        butirId: bersih(item.butir_id),
        jangkar: bersih(item.jangkar),
        tertulis: bersih(item.tertulis),
      });
    }
  }
  return rujukan;
}

/**
 * Memeriksa tiap rujukan terhadap pustaka hukum, lalu membekukannya.
 *
 * Rujukan tanpa jangkar TIDAK dihitung terbukti dan tidak pula dihitung
 * gagal - peraturannya memang belum dikenali pemecah rujukan, dan itu keadaan
 * yang berbeda dari pasal yang tidak ada. Keduanya sama-sama menahan draf,
 * tetapi tindakannya berbeda: yang satu menuntut peraturannya dimuat, yang
 * lain menuntut kutipannya diperbaiki.
 */
export async function bekukanDasar(db: AletaDatabase, rujukan: Rujukan[]): Promise<HasilPembekuan> {
  const dasar: DasarBeku[] = [];
  const tanpaJangkar: Rujukan[] = [];
  const sudah = new Set<string>();

  for (const satu of rujukan ?? []) {
    if (!satu.jangkar) {
      tanpaJangkar.push(satu);
      continue;
    }
    const kunci = `${satu.butirId}::${satu.jangkar}`;
    if (sudah.has(kunci)) continue;
    sudah.add(kunci);

    const bagian = await bukaJangkar(db, satu.jangkar);
    if (!bagian) {
      dasar.push({
        butirId: satu.butirId,
        jangkar: satu.jangkar,
        tertulis: satu.tertulis,
        peraturan: "",
        versiPeraturan: "",
        terbukti: false,
        sudahDicabut: false,
      });
      continue;
    }

    const peraturan = await db.queryOne<Record<string, unknown>>(
      `SELECT effective_date, revoked_at, status FROM jlf_regulations WHERE id = ?`,
      [bagian.peraturanId]
    );
    const berlaku = bersih(peraturan?.effective_date);
    const dicabut = bersih(peraturan?.revoked_at);

    dasar.push({
      butirId: satu.butirId,
      jangkar: satu.jangkar,
      tertulis: satu.tertulis,
      peraturan: bagian.peraturanId,
      versiPeraturan: dicabut ? `berlaku ${berlaku || "?"}, dicabut ${dicabut}` : berlaku,
      terbukti: true,
      sudahDicabut: Boolean(dicabut),
    });
  }

  return {
    dasar,
    takTerbukti: dasar.filter((item) => !item.terbukti),
    dicabut: dasar.filter((item) => item.sudahDicabut),
    tanpaJangkar,
  };
}

/** Menyimpan dasar hukum yang sudah dibekukan pada satu draf. */
export async function simpanDasar(db: AletaDatabase, drafId: string, dasar: DasarBeku[]): Promise<number> {
  const id = bersih(drafId);
  if (!id) return 0;
  const sekarang = new Date().toISOString();

  let tersimpan = 0;
  for (const item of dasar ?? []) {
    await db.run(
      `INSERT INTO aleta_putusan_draf_dasar
         (id, draf_id, butir_id, jangkar, tertulis, peraturan, versi_peraturan, terbukti, diperiksa_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        id,
        item.butirId,
        item.jangkar,
        item.tertulis,
        item.peraturan,
        item.versiPeraturan,
        item.terbukti ? 1 : 0,
        sekarang,
      ]
    );
    tersimpan += 1;
  }
  return tersimpan;
}

export async function dasarDraf(db: AletaDatabase, drafId: string): Promise<DasarBeku[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_putusan_draf_dasar WHERE draf_id = ? ORDER BY jangkar ASC`,
    [bersih(drafId)]
  );
  return baris.map((item) => ({
    butirId: bersih(item.butir_id),
    jangkar: bersih(item.jangkar),
    tertulis: bersih(item.tertulis),
    peraturan: bersih(item.peraturan),
    versiPeraturan: bersih(item.versi_peraturan),
    terbukti: Number(item.terbukti ?? 0) === 1,
    sudahDicabut: /dicabut/.test(bersih(item.versi_peraturan)),
  }));
}

/**
 * Halangan J1 dalam bahasa yang terbaca petugas.
 *
 * Disebut satu per satu, tidak diringkas menjadi "ada 3 rujukan bermasalah".
 * Petugas yang tahu pasal mana yang tidak ditemukan dapat memperbaikinya
 * dalam semenit; petugas yang hanya tahu jumlahnya harus mencarinya sendiri,
 * dan pada hari yang sibuk ia akan memilih menandatangani.
 */
export function halanganKutipan(hasil: HasilPembekuan): string[] {
  const halangan: string[] = [];
  for (const item of hasil.takTerbukti) {
    halangan.push(
      `Rujukan "${item.tertulis || item.jangkar}" tidak ditemukan di pustaka hukum (${item.jangkar}). ` +
        `Muat peraturannya, atau perbaiki kutipannya pada butir ${item.butirId}.`
    );
  }
  for (const item of hasil.dicabut) {
    halangan.push(
      `Rujukan "${item.tertulis || item.jangkar}" menunjuk peraturan yang SUDAH DICABUT ` +
        `(${item.versiPeraturan}). Bunyi pasalnya memang masih ada, dan justru itu yang ` +
        `membuat kekeliruan ini tidak terlihat dari naskahnya.`
    );
  }
  for (const item of hasil.tanpaJangkar) {
    halangan.push(
      `Rujukan "${item.tertulis}" pada butir ${item.butirId} belum tersambung ke pustaka: ` +
        `peraturannya belum dikenali, sehingga bunyinya tidak dapat diperiksa.`
    );
  }
  return halangan;
}

// =============================================================================
// J4 - JEJAK MENYELURUH
// =============================================================================

export type Jejak = {
  draf: {
    id: string;
    perkaraId: string;
    nomorPerkara: string;
    versi: number;
    keadaan: string;
    siap: boolean;
    dibuatOleh: string;
    dibuatAt: string;
    ditandatanganiOleh: string;
    ditandatanganiAt: string;
  } | null;
  /** Butir mana - beserta bunyinya saat itu dan sebab ia terpilih. */
  butir: Array<{ butirId: string; urutan: number; teks: string; versi: number; alasan: string[] }>;
  /** Fakta dari mana - tiap nilai beserta sistem asalnya. */
  nilai: Array<{ nama: string; nilai: string; asal: string }>;
  /** Aturan versi berapa - jangkar beserta versi peraturannya saat itu. */
  dasar: DasarBeku[];
  /** Pertanyaan yang belum terjawab jejak ini. */
  lubang: string[];
};

/**
 * Merangkai jejak satu draf.
 *
 * Jejak yang lengkap harus dapat menjawab tiga pertanyaan tanpa membuka apa
 * pun selain dirinya: alinea ini dari butir mana, nilainya dari sistem mana,
 * dan pasalnya versi berapa. Yang tidak dapat dijawab disebut di `lubang` -
 * jejak yang diam tentang kekurangannya akan dibaca sebagai jejak yang utuh.
 */
export async function susunJejak(db: AletaDatabase, drafId: string): Promise<Jejak> {
  const id = bersih(drafId);
  const baris = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_putusan_draf WHERE id = ?`, [id]);

  const draf = baris
    ? {
        id: bersih(baris.id),
        perkaraId: bersih(baris.perkara_id),
        nomorPerkara: bersih(baris.nomor_perkara),
        versi: Number(baris.versi ?? 0),
        keadaan: bersih(baris.keadaan),
        siap: Number(baris.siap ?? 0) === 1,
        dibuatOleh: bersih(baris.dibuat_oleh),
        dibuatAt: bersih(baris.dibuat_at),
        ditandatanganiOleh: bersih(baris.ditandatangani_oleh),
        ditandatanganiAt: bersih(baris.ditandatangani_at),
      }
    : null;

  if (!draf) return { draf: null, butir: [], nilai: [], dasar: [], lubang: ["Draf tidak ditemukan."] };

  const butirBaris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_putusan_draf_butir WHERE draf_id = ? ORDER BY urutan ASC`,
    [id]
  );
  const butir = butirBaris.map((item) => ({
    butirId: bersih(item.butir_id),
    urutan: Number(item.urutan ?? 0),
    teks: bersih(item.teks_saat_itu),
    versi: Number(item.versi_butir ?? 0),
    alasan: uraikanJson(item.alasan),
  }));

  const nilaiBaris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_putusan_draf_nilai WHERE draf_id = ? ORDER BY nama ASC`,
    [id]
  );
  const nilai = nilaiBaris.map((item) => ({
    nama: bersih(item.nama),
    nilai: bersih(item.nilai),
    asal: bersih(item.asal),
  }));

  const dasar = await dasarDraf(db, id);

  const lubang: string[] = [];
  if (!butir.length) lubang.push("Draf ini tidak memakai satu pun butir pustaka.");
  for (const item of butir) {
    if (!item.versi) lubang.push(`Butir ${item.butirId} tersimpan tanpa nomor versi.`);
  }
  for (const item of nilai) {
    if (!item.asal) lubang.push(`Nilai "${item.nama}" tersimpan tanpa menyebut sistem asalnya.`);
  }
  if (butir.length && !dasar.length) {
    lubang.push("Dasar hukum draf ini belum dibekukan, sehingga versi peraturannya tidak dapat ditelusuri.");
  }
  for (const item of dasar) {
    if (!item.versiPeraturan) lubang.push(`Jangkar ${item.jangkar} tersimpan tanpa versi peraturan.`);
  }

  return { draf, butir, nilai, dasar, lubang };
}

function uraikanJson(nilai: unknown): string[] {
  try {
    const hasil = JSON.parse(bersih(nilai) || "[]");
    return Array.isArray(hasil) ? hasil.map(bersih).filter(Boolean) : [];
  } catch {
    return [];
  }
}
