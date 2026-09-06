import { randomUUID } from "node:crypto";

import {
  golongkan,
  rekapKelas,
  variabelBersarang,
  type DefinisiVariabel,
  type KelasVariabel,
} from "@/lib/kelas-variabel";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import type { AletaDatabase } from "@/server/db/client";

/**
 * KAMUS VARIABEL ALETA (Tahap 0 - Kemandirian Blangko).
 *
 * ============================================================================
 * SALINAN, BUKAN SAMBUNGAN
 * ============================================================================
 *
 * Kamus ini menyalin aps_badilag.abt_variabel ke dalam basis data ALETA sekali,
 * dan boleh disalin ulang kapan saja. Yang TIDAK boleh terjadi adalah ada jalur
 * berjalan yang menunggu ABT: sesudah penyalinan, mencabut folder ABT dan
 * mematikan sambungan aps_badilag tidak boleh menggagalkan satu pun penerbitan
 * dokumen. Karena itu seluruh pembacaan di bawah menyentuh tabel ALETA sendiri;
 * hanya salinKamus() yang menyentuh ABT, dan ia dijalankan atas perintah, bukan
 * saat naskah dibuat.
 *
 * ============================================================================
 * DEFINISI DISALIN APA ADANYA
 * ============================================================================
 *
 * sql_query tidak dirapikan, tidak dipendekkan, tidak ditafsirkan. Sebabnya
 * ditemukan mahal: 87 pemetaan yang selama ini ditulis tangan ternyata memuat
 * tujuh kekeliruan, dan ketujuhnya lahir dari menebak arti sebuah variabel dari
 * namanya. #0046# yang muncul 12.935 kali - tersering di seluruh pustaka -
 * ternyata SEBUTAN ("Penggugat"/"Pemohon"), bukan nama pihak.
 *
 * Selama definisinya disalin apa adanya, kekeliruan semacam itu tidak dapat
 * lahir lagi: yang menyatakan artinya adalah ABT, bukan pembacanya.
 *
 * ============================================================================
 * PENYALIAN YANG GAGAL TIDAK MENINGGALKAN KAMUS SETENGAH JADI
 * ============================================================================
 *
 * Kamus setengah tersalin lebih berbahaya daripada kamus kosong: yang kosong
 * berhenti dengan jelas, yang setengah jadi menjawab sebagian pertanyaan dengan
 * benar dan sebagian lagi dengan diam. Karena itu penyalinan menulis seluruh
 * barisnya atau tidak sama sekali, dan kegagalannya tercatat sebagai baris
 * salin berkeadaan "gagal" beserta sebabnya.
 */

/** Satu definisi variabel sebagaimana tersimpan di kamus ALETA. */
export type ButirKamus = {
  noVar: string;
  nama: string;
  jenis: string;
  sqlQuery: string;
  dataTabel: string;
  dataKolom: string;
  defaultData: string;
  kelas: KelasVariabel;
  sebabKelas: string;
  bersarang: string[];
  jumlahPakai: number;
  asalSkema: string;
  diubahAt: string;
};

export type HasilSalin = {
  ok: boolean;
  salinId: string;
  jumlahBaris: number;
  rekap: Record<KelasVariabel, number>;
  asalSkema: string;
  sebab: string;
};

/** Baris mentah sebagaimana dikirim jembatan bot. */
type BarisAbt = {
  noVar?: unknown;
  nama?: unknown;
  jenis?: unknown;
  sqlQuery?: unknown;
  dataTabel?: unknown;
  dataKolom?: unknown;
  defaultData?: unknown;
};

type JawabanAbt = {
  ada?: boolean;
  sebab?: string;
  skema?: string;
  variabel?: BarisAbt[];
};

const teks = (nilai: unknown): string => String(nilai ?? "").trim();

/**
 * Salin seluruh definisi ABT ke kamus ALETA.
 *
 * `pemakaian` adalah berapa kali tiap kode muncul di pustaka blangko, bila
 * sudah dihitung. Ia keterangan, bukan syarat - kamus tetap tersalin lengkap
 * tanpanya, dan variabel dengan jumlah nol berarti terdefinisi tetapi belum
 * terpakai, yang bukan kesalahan.
 */
export async function salinKamus(
  db: AletaDatabase,
  masukan: { oleh: string; pemakaian?: Record<string, number> }
): Promise<HasilSalin> {
  const salinId = randomUUID();
  const sekarang = new Date().toISOString();
  const oleh = teks(masukan.oleh);
  const pemakaian = masukan.pemakaian ?? {};

  const catatGagal = async (sebab: string, skema: string): Promise<HasilSalin> => {
    await db.run(
      `INSERT INTO aleta_kamus_salin
         (id, asal_skema, jumlah_baris, jumlah_kelas_a, jumlah_kelas_b, jumlah_kelas_c, keadaan, sebab, oleh, dijalankan_at)
       VALUES (?, ?, 0, 0, 0, 0, 'gagal', ?, ?, ?)`,
      [salinId, skema, sebab, oleh, sekarang]
    );
    return { ok: false, salinId, jumlahBaris: 0, rekap: { A: 0, B: 0, C: 0 }, asalSkema: skema, sebab };
  };

  const jawaban = await callAletaBotSippBridge<JawabanAbt>("abt.semuaVariabel", {});
  const skema = teks(jawaban.data?.skema);

  if (!jawaban.ok || !jawaban.data?.ada) {
    return catatGagal(teks(jawaban.data?.sebab) || "Basis data APS Badilag tidak terbaca.", skema);
  }

  const mentah = Array.isArray(jawaban.data?.variabel) ? jawaban.data.variabel : [];
  if (mentah.length === 0) {
    return catatGagal("ABT mengembalikan nol baris - penyalinan dibatalkan agar kamus tidak menjadi setengah jadi.", skema);
  }

  const butir = mentah
    .map((baris) => {
      const def: DefinisiVariabel = {
        noVar: teks(baris.noVar),
        nama: teks(baris.nama),
        jenis: teks(baris.jenis),
        sqlQuery: String(baris.sqlQuery ?? ""),
        dataTabel: teks(baris.dataTabel),
        dataKolom: teks(baris.dataKolom),
      };
      const hasil = golongkan(def);
      return {
        def,
        kelas: hasil.kelas,
        sebabKelas: hasil.sebab,
        bersarang: variabelBersarang(def).join(","),
        defaultData: teks(baris.defaultData),
        jumlahPakai: Number(pemakaian[def.noVar] ?? 0) || 0,
      };
    })
    .filter((item) => item.def.noVar);

  if (butir.length === 0) {
    return catatGagal("Tidak satu pun baris ABT memiliki no_var yang sah.", skema);
  }

  // Seluruhnya atau tidak sama sekali - lihat catatan di kepala berkas.
  try {
    await db.run(
      `INSERT INTO aleta_kamus_salin
         (id, asal_skema, jumlah_baris, jumlah_kelas_a, jumlah_kelas_b, jumlah_kelas_c, keadaan, sebab, oleh, dijalankan_at)
       VALUES (?, ?, ?, ?, ?, ?, 'berjalan', '', ?, ?)`,
      [salinId, skema, butir.length, 0, 0, 0, oleh, sekarang]
    );

    for (const item of butir) {
      const nilai = [
        item.def.noVar,
        item.def.nama ?? "",
        item.def.jenis ?? "",
        item.def.sqlQuery ?? "",
        item.def.dataTabel ?? "",
        item.def.dataKolom ?? "",
        item.defaultData,
        item.kelas,
        item.sebabKelas,
        item.bersarang,
        item.jumlahPakai,
        skema,
        salinId,
        sekarang,
      ];
      // Penyalinan ulang MEMPERBARUI baris yang sudah ada, bukan menambah baris
      // kedua: no_var adalah kunci utamanya, dan kamus dengan dua definisi untuk
      // satu kode akan menjawab berbeda-beda tergantung baris mana yang terbaca.
      const sudahAda = await db.queryOne<Record<string, unknown>>(
        `SELECT no_var FROM aleta_kamus_variabel WHERE no_var = ?`,
        [item.def.noVar]
      );
      if (sudahAda) {
        await db.run(
          `UPDATE aleta_kamus_variabel
              SET nama = ?, jenis = ?, sql_query = ?, data_tabel = ?, data_kolom = ?, default_data = ?,
                  kelas = ?, sebab_kelas = ?, bersarang = ?, jumlah_pakai = ?, asal_skema = ?,
                  salin_id = ?, diubah_at = ?
            WHERE no_var = ?`,
          [...nilai.slice(1), item.def.noVar]
        );
      } else {
        await db.run(
          `INSERT INTO aleta_kamus_variabel
             (no_var, nama, jenis, sql_query, data_tabel, data_kolom, default_data,
              kelas, sebab_kelas, bersarang, jumlah_pakai, asal_skema, salin_id, dibuat_at, diubah_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [...nilai, sekarang]
        );
      }
    }
  } catch (error) {
    const sebab = error instanceof Error ? error.message : "Penyalinan terhenti.";
    await db.run(`UPDATE aleta_kamus_salin SET keadaan = 'gagal', sebab = ? WHERE id = ?`, [sebab, salinId]);
    return { ok: false, salinId, jumlahBaris: 0, rekap: { A: 0, B: 0, C: 0 }, asalSkema: skema, sebab };
  }

  const rekap = rekapKelas(butir);
  await db.run(
    `UPDATE aleta_kamus_salin
        SET keadaan = 'selesai', jumlah_baris = ?, jumlah_kelas_a = ?, jumlah_kelas_b = ?, jumlah_kelas_c = ?
      WHERE id = ?`,
    [butir.length, rekap.A, rekap.B, rekap.C, salinId]
  );

  return { ok: true, salinId, jumlahBaris: butir.length, rekap, asalSkema: skema, sebab: "" };
}

function keButir(baris: Record<string, unknown>): ButirKamus {
  const bersarang = teks(baris.bersarang);
  return {
    noVar: teks(baris.no_var),
    nama: teks(baris.nama),
    jenis: teks(baris.jenis),
    sqlQuery: String(baris.sql_query ?? ""),
    dataTabel: teks(baris.data_tabel),
    dataKolom: teks(baris.data_kolom),
    defaultData: teks(baris.default_data),
    kelas: (teks(baris.kelas) || "C") as KelasVariabel,
    sebabKelas: teks(baris.sebab_kelas),
    bersarang: bersarang ? bersarang.split(",").filter(Boolean) : [],
    jumlahPakai: Number(baris.jumlah_pakai ?? 0) || 0,
    asalSkema: teks(baris.asal_skema),
    diubahAt: teks(baris.diubah_at),
  };
}

/** Satu definisi. Membaca kamus ALETA saja - tidak menyentuh ABT. */
export async function bacaVariabel(db: AletaDatabase, noVar: string): Promise<ButirKamus | null> {
  const kode = teks(noVar);
  if (!kode) return null;
  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT * FROM aleta_kamus_variabel WHERE no_var = ?`,
    [kode]
  );
  return baris ? keButir(baris) : null;
}

/**
 * Beberapa definisi sekaligus.
 *
 * Dibaca satu per satu dan bukan dengan IN (...) karena pg-mem tidak menangani
 * daftar parameter sepanjang itu dengan cara yang sama seperti Postgres, dan
 * uji yang lulus di satu tempat lalu gagal di tempat lain lebih mahal daripada
 * beberapa pembacaan tambahan atas tabel berukuran seribu baris.
 */
export async function bacaBanyak(db: AletaDatabase, daftar: string[]): Promise<Map<string, ButirKamus>> {
  const peta = new Map<string, ButirKamus>();
  for (const kode of [...new Set(daftar.map(teks).filter(Boolean))]) {
    const butir = await bacaVariabel(db, kode);
    if (butir) peta.set(kode, butir);
  }
  return peta;
}

export type StatistikKamus = {
  jumlah: number;
  perKelas: Record<KelasVariabel, number>;
  perJenis: Array<{ jenis: string; jumlah: number }>;
  penyalinanTerakhir: {
    id: string;
    asalSkema: string;
    jumlahBaris: number;
    keadaan: string;
    sebab: string;
    oleh: string;
    dijalankanAt: string;
  } | null;
};

/** Keadaan kamus: berapa isinya, terbagi bagaimana, dan disalin kapan. */
export async function statistikKamus(db: AletaDatabase): Promise<StatistikKamus> {
  const perKelasBaris = await db.queryAll<Record<string, unknown>>(
    `SELECT kelas, COUNT(*) AS jumlah FROM aleta_kamus_variabel GROUP BY kelas`
  );
  const perKelas: Record<KelasVariabel, number> = { A: 0, B: 0, C: 0 };
  for (const baris of perKelasBaris) {
    const kelas = (teks(baris.kelas) || "C") as KelasVariabel;
    if (kelas in perKelas) perKelas[kelas] = Number(baris.jumlah ?? 0) || 0;
  }

  const perJenisBaris = await db.queryAll<Record<string, unknown>>(
    `SELECT jenis, COUNT(*) AS jumlah FROM aleta_kamus_variabel GROUP BY jenis ORDER BY COUNT(*) DESC`
  );

  const salin = await db.queryOne<Record<string, unknown>>(
    `SELECT * FROM aleta_kamus_salin ORDER BY dijalankan_at DESC LIMIT 1`
  );

  return {
    jumlah: Object.values(perKelas).reduce((a, b) => a + b, 0),
    perKelas,
    perJenis: perJenisBaris.map((baris) => ({
      jenis: teks(baris.jenis) || "(kosong)",
      jumlah: Number(baris.jumlah ?? 0) || 0,
    })),
    penyalinanTerakhir: salin
      ? {
          id: teks(salin.id),
          asalSkema: teks(salin.asal_skema),
          jumlahBaris: Number(salin.jumlah_baris ?? 0) || 0,
          keadaan: teks(salin.keadaan),
          sebab: teks(salin.sebab),
          oleh: teks(salin.oleh),
          dijalankanAt: teks(salin.dijalankan_at),
        }
      : null,
  };
}

/** Riwayat penyalinan, terbaru dahulu. */
export async function riwayatSalin(db: AletaDatabase, batas = 20) {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_kamus_salin ORDER BY dijalankan_at DESC LIMIT ?`,
    [Math.max(1, Math.min(100, batas))]
  );
  return baris.map((item) => ({
    id: teks(item.id),
    asalSkema: teks(item.asal_skema),
    jumlahBaris: Number(item.jumlah_baris ?? 0) || 0,
    kelasA: Number(item.jumlah_kelas_a ?? 0) || 0,
    kelasB: Number(item.jumlah_kelas_b ?? 0) || 0,
    kelasC: Number(item.jumlah_kelas_c ?? 0) || 0,
    keadaan: teks(item.keadaan),
    sebab: teks(item.sebab),
    oleh: teks(item.oleh),
    dijalankanAt: teks(item.dijalankan_at),
  }));
}

/**
 * Apakah kamus sudah siap dipakai.
 *
 * Dipakai penyelesai Tahap 1 supaya ia berhenti dengan sebab yang jelas
 * ketimbang mengisi naskah dengan kekosongan ketika kamus belum pernah disalin.
 */
export async function kamusSiap(db: AletaDatabase): Promise<{ siap: boolean; jumlah: number; sebab: string }> {
  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT COUNT(*) AS jumlah FROM aleta_kamus_variabel`
  );
  const jumlah = Number(baris?.jumlah ?? 0) || 0;
  if (jumlah === 0) {
    return { siap: false, jumlah, sebab: "Kamus variabel belum pernah disalin dari ABT." };
  }
  return { siap: true, jumlah, sebab: "" };
}
