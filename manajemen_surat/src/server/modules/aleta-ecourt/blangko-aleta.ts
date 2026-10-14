import { randomUUID } from "node:crypto";

import { buatDocx, type AlineaDocx } from "@/lib/docx";
import { buatPdf } from "@/lib/cetak-pdf";
import { naskahDariBagian, pilihBagian, type BagianBlangko, type SyaratBagian } from "@/lib/pustaka-blangko";
import { penandaDalam } from "@/lib/penyelesai-variabel";
import { uraikanDimensi, type DimensiBlangko } from "@/lib/taksonomi-blangko";
import { isianPerkara } from "@/server/modules/aleta-ecourt/isian-perkara";
import { isiNaskah, lengkapiDariAbt, selesaikanPenanda } from "@/server/modules/aleta-ecourt/penyelesai";
import type { AletaDatabase } from "@/server/db/client";

/**
 * PUSTAKA BLANGKO ALETA (Tahap 5, 6, 7 - Kemandirian Blangko).
 *
 * ============================================================================
 * DITURUNKAN DARI KORPUS, LALU BERDIRI SENDIRI
 * ============================================================================
 *
 * Blangko ALETA lahir dari korpus Tahap 1 - kalimatnya berangkat dari kalimat
 * ABT yang sudah teruji bertahun-tahun, bukan dari halaman kosong. Tetapi
 * sesudah lahir ia berdiri sendiri: jalur asalnya disimpan sebagai SEJARAH,
 * tidak pernah sebagai syarat terbit.
 *
 * Blangko baru - untuk dokumen yang ABT memang tidak punya - berdiri tanpa
 * asal-usul sama sekali, dan itu sah. Mewajibkannya akan mengunci ALETA pada
 * batas ABT, kebalikan dari tujuan seluruh rencana ini.
 */

const teks = (nilai: unknown): string => String(nilai ?? "").trim();
const angka = (nilai: unknown): number => Number(nilai ?? 0) || 0;

// ============================================================================
// Tahap 5 - menyusun dan menerbitkan
// ============================================================================

export type HasilTurun = {
  ok: boolean;
  blangkoId: string;
  kode: string;
  jumlahBagian: number;
  sebab: string;
};

/**
 * Menurunkan blangko ALETA dari satu blangko sumber di korpus.
 *
 * Susunan alineanya disalin apa adanya; syarat pemilihan BELUM diisi - itu
 * pekerjaan manusia yang memahami kapan sebuah alinea berlaku. Blangko hasil
 * penurunan berkeadaan "draf" sampai ada yang mengesahkannya.
 */
export async function turunkanDariKorpus(
  db: AletaDatabase,
  masukan: { jalur: string; kode: string; nama: string; oleh: string }
): Promise<HasilTurun> {
  const jalur = teks(masukan.jalur);
  const kode = teks(masukan.kode);
  const oleh = teks(masukan.oleh);
  const kosong: HasilTurun = { ok: false, blangkoId: "", kode, jumlahBagian: 0, sebab: "" };

  if (!kode) return { ...kosong, sebab: "Kode blangko harus disebut." };
  if (!oleh) return { ...kosong, sebab: "Penurunan harus menyebut siapa yang melakukannya." };

  const sumber = await db.queryOne<Record<string, unknown>>(
    `SELECT * FROM aleta_blangko_sumber WHERE jalur = ?`,
    [jalur]
  );
  if (!sumber) return { ...kosong, sebab: "Blangko sumber itu tidak ada di korpus." };

  const sudahAda = await db.queryOne<Record<string, unknown>>(`SELECT id FROM aleta_blangko WHERE kode = ?`, [kode]);
  if (sudahAda) return { ...kosong, sebab: `Kode "${kode}" sudah dipakai blangko lain.` };

  const urutan = teks(sumber.urutan).split(",").filter(Boolean);
  const sekarang = new Date().toISOString();
  const blangkoId = randomUUID();

  await db.run(
    `INSERT INTO aleta_blangko
       (id, kode, nama, jenis, keterangan, asal_abt, keadaan, versi, disusun_oleh, disahkan_oleh, disahkan_at, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, '', ?, 'draf', 1, ?, '', NULL, ?, ?)`,
    [blangkoId, kode, teks(masukan.nama) || teks(sumber.berkas), teks(sumber.jenis), jalur, oleh, sekarang, sekarang]
  );

  let urut = 0;
  for (const sidik of urutan) {
    const blok = await db.queryOne<Record<string, unknown>>(
      `SELECT teks FROM aleta_blok_kalimat WHERE sidik = ?`,
      [sidik]
    );
    if (!blok) continue;
    urut += 1;
    const isi = teks(blok.teks);
    // Judul dokumen dikenali dari bentuknya - seluruh huruf besar dan pendek.
    const judul = isi.length < 60 && isi === isi.toUpperCase() && /[A-Z]{3}/.test(isi);
    await db.run(
      `INSERT INTO aleta_blangko_bagian
         (id, blangko_id, urutan, blok_sidik, teks, syarat, rata, tebal, bernomor, jorok, selalu, dibuat_at)
       VALUES (?, ?, ?, ?, ?, '{}', ?, ?, 0, 0, 1, ?)`,
      [randomUUID(), blangkoId, urut, sidik, isi, judul ? "tengah" : "justify", judul ? 1 : 0, sekarang]
    );
  }

  return { ok: true, blangkoId, kode, jumlahBagian: urut, sebab: "" };
}

function keBagian(baris: Record<string, unknown>): BagianBlangko {
  let syarat: SyaratBagian = {};
  try {
    syarat = JSON.parse(teks(baris.syarat) || "{}") as SyaratBagian;
  } catch {
    // Syarat yang rusak diperlakukan sebagai TIDAK ADA syarat sama sekali,
    // bukan sebagai syarat yang gagal: bagian yang lenyap dari naskah resmi
    // karena satu tanda kurung yang keliru jauh lebih berbahaya daripada
    // bagian yang muncul ketika tidak seharusnya - yang kedua terlihat.
    syarat = {};
  }
  return {
    id: teks(baris.id),
    urutan: angka(baris.urutan),
    blokSidik: teks(baris.blok_sidik),
    teks: teks(baris.teks),
    syarat,
    rata: (teks(baris.rata) || "justify") as BagianBlangko["rata"],
    tebal: angka(baris.tebal) === 1,
    nomor: angka(baris.bernomor) === 1 ? 1 : undefined,
    jorok: Number(baris.jorok ?? 0) || 0,
    selalu: angka(baris.selalu) === 1,
  };
}

export type HasilTerbit = {
  ok: boolean;
  kode: string;
  alinea: AlineaDocx[];
  jumlahBagian: number;
  jumlahPenanda: number;
  tersisa: string[];
  gagal: Array<{ noVar: string; sebab: string }>;
  dikeluarkan: Array<{ id: string; sebab: string }>;
  perluDiperiksa: boolean;
  sebab: string;
};

/**
 * Menerbitkan naskah sebuah blangko untuk satu perkara.
 *
 * Tiga lapis, berurutan: pilih bagian menurut keadaan, selesaikan penandanya,
 * lalu isi naskahnya. Sejak 14 Okt 2026 (Q2) yang tidak selesai di kamus
 * ALETA ditanyakan ke mesin variabel ABT; yang tetap kosong dicetak "..." -
 * tidak pernah sebagai #NNNN# - dan tetap disebut di `tersisa`.
 */
export async function terbitkanNaskah(
  db: AletaDatabase,
  masukan: { kode: string; perkaraId: string; keadaan?: Partial<DimensiBlangko> }
): Promise<HasilTerbit> {
  const kode = teks(masukan.kode);
  const perkaraId = teks(masukan.perkaraId);
  const kosong: HasilTerbit = {
    ok: false,
    kode,
    alinea: [],
    jumlahBagian: 0,
    jumlahPenanda: 0,
    tersisa: [],
    gagal: [],
    dikeluarkan: [],
    perluDiperiksa: false,
    sebab: "",
  };

  const blangko = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_blangko WHERE kode = ?`, [kode]);
  if (!blangko) return { ...kosong, sebab: `Blangko "${kode}" tidak ada di pustaka ALETA.` };

  const barisBagian = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_blangko_bagian WHERE blangko_id = ? ORDER BY urutan`,
    [teks(blangko.id)]
  );
  if (barisBagian.length === 0) return { ...kosong, sebab: "Blangko ini belum punya satu bagian pun." };

  // Keadaan yang disebut pemanggil menang; sisanya diambil dari dimensi asal
  // blangko, supaya blangko turunan tetap berlaku tanpa keadaan disebut ulang.
  const dariAsal = teks(blangko.asal_abt) ? uraikanDimensi(teks(blangko.asal_abt)) : {};
  const keadaan: Partial<DimensiBlangko> = { ...dariAsal, ...(masukan.keadaan ?? {}) };

  const { terpakai, dikeluarkan } = pilihBagian(barisBagian.map(keBagian), keadaan);
  const susunan = naskahDariBagian(terpakai);

  const penanda = [...new Set(susunan.flatMap((a) => penandaDalam(a.teks)))];
  const isian = await isianPerkara(db, perkaraId);
  const hasil = await selesaikanPenanda(db, { perkaraId, penanda, isian });
  // Q2 14 Okt: yang tidak selesai di kamus ALETA ditanyakan ke mesin variabel
  // ABT; yang tetap kosong dicetak "..." (bukan #NNNN#) dan tetap "tersisa".
  const { kosong: isianKosong } = await lengkapiDariAbt(perkaraId, hasil, penanda);

  const alinea: AlineaDocx[] = [];
  const tersisa = new Set<string>(isianKosong.map((k) => k.noVar));
  for (const a of susunan) {
    const isi = isiNaskah(a.teks, hasil);
    for (const t of isi.tersisa) tersisa.add(t);
    alinea.push({
      teks: isi.naskah,
      rata: a.rata,
      tebal: a.tebal,
      nomor: a.nomor,
      jorok: a.jorok,
    });
  }

  const golongan = teks(blangko.jenis) || "lain";
  return {
    ok: true,
    kode,
    alinea,
    jumlahBagian: terpakai.length,
    jumlahPenanda: penanda.length,
    tersisa: [...tersisa].sort(),
    gagal: hasil.gagal,
    dikeluarkan,
    perluDiperiksa: await saklarMenyala(db, golongan),
    sebab: "",
  };
}

export type BerkasTerbit = {
  ok: boolean;
  docx: Buffer | null;
  pdf: Buffer | null;
  jumlahHalaman: number;
  hurufTakTercetak: number;
  tersisa: string[];
  sebab: string;
};

/** Menerbitkan DOCX dan PDF sekaligus dari susunan alinea yang sama. */
export async function terbitkanBerkas(
  db: AletaDatabase,
  masukan: { kode: string; perkaraId: string; keadaan?: Partial<DimensiBlangko>; oleh: string }
): Promise<BerkasTerbit> {
  const naskah = await terbitkanNaskah(db, masukan);
  if (!naskah.ok) {
    return { ok: false, docx: null, pdf: null, jumlahHalaman: 0, hurufTakTercetak: 0, tersisa: [], sebab: naskah.sebab };
  }

  const docx = buatDocx({ alinea: naskah.alinea });
  const pdf = await buatPdf({ alinea: naskah.alinea });

  const blangko = await db.queryOne<Record<string, unknown>>(`SELECT id FROM aleta_blangko WHERE kode = ?`, [
    teks(masukan.kode),
  ]);
  await db.run(
    `INSERT INTO aleta_blangko_terbit
       (id, blangko_id, perkara_id, keadaan, jumlah_bagian, jumlah_penanda, jumlah_tersisa, tersisa,
        huruf_tak_tercetak, bentuk, oleh, pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'docx+pdf', ?, ?)`,
    [
      randomUUID(),
      teks(blangko?.id),
      teks(masukan.perkaraId),
      JSON.stringify(masukan.keadaan ?? {}),
      naskah.jumlahBagian,
      naskah.jumlahPenanda,
      naskah.tersisa.length,
      JSON.stringify(naskah.tersisa),
      pdf.hurufTakTercetak,
      teks(masukan.oleh),
      new Date().toISOString(),
    ]
  );

  return {
    ok: true,
    docx,
    pdf: pdf.berkas,
    jumlahHalaman: pdf.jumlahHalaman,
    hurufTakTercetak: pdf.hurufTakTercetak,
    tersisa: naskah.tersisa,
    sebab: "",
  };
}

// ============================================================================
// Tahap 6 - saklar periksa dan uji kemandirian
// ============================================================================

/** Apakah golongan ini menuntut pemeriksaan. Bawaannya MATI. */
export async function saklarMenyala(db: AletaDatabase, golongan: string): Promise<boolean> {
  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT menyala FROM aleta_saklar_periksa WHERE golongan = ?`,
    [teks(golongan)]
  );
  return angka(baris?.menyala) === 1;
}

/**
 * Golongan yang punya saklar periksa - SAMA dengan daftar di layar Blangko
 * Mandiri (blangko-mandiri.tsx, dijaga blangko-mandiri-penjaga.test.ts).
 *
 * Sebelumnya geserSaklar menerima teks apa saja: "golongan-ngawur" tercatat
 * sebagai saklar menyala beserta riwayatnya, padahal tidak ada blangko yang
 * pernah membacanya - pergeseran yang tampak berhasil tetapi tidak mengubah
 * apa pun.
 */
export const GOLONGAN_SAKLAR = ["relaas", "bas", "putusan", "kepaniteraan", "jinayat"] as const;

/** Menggeser saklar. Tiap pergeseran dicatat - tanpa jejak sama saja tidak ada. */
export async function geserSaklar(
  db: AletaDatabase,
  masukan: { golongan: string; menyala: boolean; alasan: string; oleh: string }
): Promise<{ ok: boolean; sebab: string }> {
  const golongan = teks(masukan.golongan);
  const oleh = teks(masukan.oleh);
  if (!golongan) return { ok: false, sebab: "Golongan dokumen harus disebut." };
  if (!(GOLONGAN_SAKLAR as readonly string[]).includes(golongan)) {
    return {
      ok: false,
      sebab: `Golongan '${golongan}' tidak punya saklar periksa. Pilih salah satu: ${GOLONGAN_SAKLAR.join(", ")}.`,
    };
  }
  if (!oleh) return { ok: false, sebab: "Pergeseran saklar harus menyebut siapa yang melakukannya." };

  const sekarang = new Date().toISOString();
  const lama = await db.queryOne<Record<string, unknown>>(
    `SELECT id, menyala FROM aleta_saklar_periksa WHERE golongan = ?`,
    [golongan]
  );
  const dari = angka(lama?.menyala);
  const ke = masukan.menyala ? 1 : 0;

  if (lama) {
    await db.run(
      `UPDATE aleta_saklar_periksa SET menyala = ?, alasan = ?, digeser_oleh = ?, digeser_at = ? WHERE id = ?`,
      [ke, teks(masukan.alasan), oleh, sekarang, teks(lama.id)]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_saklar_periksa (id, golongan, menyala, alasan, digeser_oleh, digeser_at, dibuat_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), golongan, ke, teks(masukan.alasan), oleh, sekarang, sekarang]
    );
  }

  await db.run(
    `INSERT INTO aleta_saklar_riwayat (id, golongan, dari, ke, alasan, oleh, pada) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [randomUUID(), golongan, dari, ke, teks(masukan.alasan), oleh, sekarang]
  );
  return { ok: true, sebab: "" };
}

export type HasilUjiMandiri = {
  mandiri: boolean;
  jumlahDiperiksa: number;
  temuan: Array<{ kode: string; sebab: string }>;
};

/**
 * Uji kemandirian: menerbitkan tiap blangko ALETA TANPA menyentuh ABT.
 *
 * Bukan diumumkan, melainkan dibuktikan. Yang diperiksa: apakah naskahnya
 * tersusun dari pustaka ALETA sendiri - korpus, kamus, dan isian - tanpa satu
 * pun panggilan ke folder blangko ABT.
 *
 * Dijalankan berkala, bukan sekali lalu dilupakan: ketergantungan selalu
 * menyelinap kembali diam-diam.
 */
export async function ujiKemandirian(
  db: AletaDatabase,
  masukan: { perkaraId: string; oleh: string }
): Promise<HasilUjiMandiri> {
  const daftar = await db.queryAll<Record<string, unknown>>(`SELECT kode, jenis FROM aleta_blangko ORDER BY kode`);
  const temuan: Array<{ kode: string; sebab: string }> = [];

  for (const b of daftar) {
    const kode = teks(b.kode);
    try {
      const hasil = await terbitkanNaskah(db, { kode, perkaraId: teks(masukan.perkaraId) });
      if (!hasil.ok) temuan.push({ kode, sebab: hasil.sebab });
      else if (hasil.alinea.length === 0) temuan.push({ kode, sebab: "tidak menghasilkan satu alinea pun" });
    } catch (error) {
      temuan.push({ kode, sebab: error instanceof Error ? error.message : "gagal terbit" });
    }
  }

  const mandiri = daftar.length > 0 && temuan.length === 0;
  await db.run(
    `INSERT INTO aleta_uji_mandiri
       (id, dijalankan_at, dijalankan_oleh, mandiri, jumlah_diperiksa, jumlah_bergantung, temuan, sebab)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      new Date().toISOString(),
      teks(masukan.oleh),
      mandiri ? 1 : 0,
      daftar.length,
      temuan.length,
      JSON.stringify(temuan.slice(0, 50)),
      daftar.length === 0 ? "Belum ada satu blangko pun di pustaka ALETA." : "",
    ]
  );

  return { mandiri, jumlahDiperiksa: daftar.length, temuan };
}

// ============================================================================
// Tahap 7 - membereskan Kelas C
// ============================================================================

export type TemuanKelasC = {
  noVar: string;
  nama: string;
  sebab: string;
  jumlahPakai: number;
  /** Blangko sumber yang memuatnya - daftar pekerjaan yang harus dibereskan. */
  blangko: string[];
};

/**
 * Daftar variabel Kelas C beserta blangko yang memuatnya.
 *
 * Ini pekerjaan hukum, bukan pekerjaan teknik: yang memutuskan sebuah alinea
 * masih perlu atau tidak haruslah hakim atau panitera. Yang dapat dikerjakan
 * mesin hanyalah MENUNJUKKAN di mana saja variabel mati itu tersembunyi.
 */
export async function daftarKelasC(db: AletaDatabase, batas = 100): Promise<TemuanKelasC[]> {
  const mati = await db.queryAll<Record<string, unknown>>(
    `SELECT no_var, nama, sebab_kelas, jumlah_pakai FROM aleta_kamus_variabel
      WHERE kelas = 'C' AND jumlah_pakai > 0
      ORDER BY jumlah_pakai DESC LIMIT ?`,
    [Math.max(1, Math.min(500, batas))]
  );

  const hasil: TemuanKelasC[] = [];
  for (const m of mati) {
    const noVar = teks(m.no_var);
    const sumber = await db.queryAll<Record<string, unknown>>(
      `SELECT jalur FROM aleta_blangko_sumber WHERE penanda LIKE ? ORDER BY jalur LIMIT 10`,
      [`%${noVar}%`]
    );
    hasil.push({
      noVar,
      nama: teks(m.nama),
      sebab: teks(m.sebab_kelas),
      jumlahPakai: angka(m.jumlah_pakai),
      blangko: sumber.map((s) => teks(s.jalur)),
    });
  }
  return hasil;
}

/** Ringkasan pembersihan: berapa yang mati, berapa blangko terdampak. */
export async function ringkasKelasC(db: AletaDatabase) {
  const jumlah = await db.queryOne<Record<string, unknown>>(
    `SELECT COUNT(*) AS jumlah FROM aleta_kamus_variabel WHERE kelas = 'C'`
  );
  const terpakai = await db.queryOne<Record<string, unknown>>(
    `SELECT COUNT(*) AS jumlah FROM aleta_kamus_variabel WHERE kelas = 'C' AND jumlah_pakai > 0`
  );
  return {
    jumlahMati: angka(jumlah?.jumlah),
    // Yang mati TETAPI tidak dipakai blangko mana pun tidak perlu dibereskan -
    // ia hanya baris kamus yang tidak menyentuh naskah siapa pun.
    matiDanTerpakai: angka(terpakai?.jumlah),
  };
}
