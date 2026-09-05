import { randomUUID } from "node:crypto";

import {
  aturanBatasSumber,
  nilaiKesegaran,
  periksaSumber,
  type Sumber,
} from "@/lib/jalur-aplikasi";
import {
  hitungKeberhasilan,
  saringSuntingan,
  type Keberhasilan,
  type TemuanSuntingan,
} from "@/lib/keberhasilan-pustaka";
import {
  bolehPanggil,
  hitungBiaya,
  hitungPagu,
  type KeadaanPagu,
  type Pekerjaan,
} from "@/lib/pagu-ai";
import type { AletaDatabase } from "@/server/db/client";

/**
 * MUTU, BIAYA, DAN PERLUASAN (K1-K7).
 *
 * ============================================================================
 * PAGU HABIS MENGEMBALIKAN ALETA KE PUSTAKA SAJA
 * ============================================================================
 *
 * Bukan menghentikannya. Draf tetap dirakit, pemeriksaan tetap berjalan, jejak
 * tetap tercatat - hanya penyusunan alinea baru yang berhenti. Pagu yang
 * menghentikan segalanya akan dinaikkan sampai tidak pernah habis, dan pagu
 * yang tidak pernah habis sama saja dengan tidak ada pagu.
 *
 * ============================================================================
 * KEBERHASILAN DIUKUR DARI BERKURANGNYA PEMAKAIAN AI
 * ============================================================================
 *
 * Angka yang naik adalah persentase draf yang selesai TANPA memanggil model.
 * Pustaka yang tumbuh berarti pekerjaan yang berkurang - bukan alat yang
 * menganggur.
 */

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/** "2026-09" dari sebuah tanggal; dipakai menjumlah pemakaian bulan berjalan. */
export function bulanDari(waktu: Date = new Date()): string {
  return `${waktu.getUTCFullYear()}-${String(waktu.getUTCMonth() + 1).padStart(2, "0")}`;
}

// =============================================================================
// K1 & K2 - PAGU DAN BIAYA TERBACA
// =============================================================================

export async function paguBulan(db: AletaDatabase, bulan = bulanDari()): Promise<number> {
  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT pagu_rupiah FROM aleta_ai_pagu WHERE bulan = ?`,
    [bulan]
  );
  return Number(baris?.pagu_rupiah ?? 0) || 0;
}

export async function terpakaiBulan(db: AletaDatabase, bulan = bulanDari()): Promise<number> {
  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT SUM(biaya_rupiah) AS jumlah FROM aleta_ai_pemakaian WHERE bulan = ?`,
    [bulan]
  );
  return Number(baris?.jumlah ?? 0) || 0;
}

/**
 * Keadaan pagu bulan berjalan.
 *
 * Dibaca setiap kali, seperti saklar. Pagu yang disinggahkan akan membuat
 * panggilan tetap berjalan beberapa menit sesudah pagunya benar-benar habis -
 * dan beberapa menit pada penyusunan pertimbangan bukan jumlah yang kecil.
 */
export async function keadaanPagu(db: AletaDatabase, bulan = bulanDari()): Promise<KeadaanPagu> {
  return hitungPagu({ pagu: await paguBulan(db, bulan), terpakai: await terpakaiBulan(db, bulan) });
}

export async function setelPagu(
  db: AletaDatabase,
  masukan: { bulan?: string; paguRupiah: number; oleh: string; atasPerintah: string; catatan?: string }
): Promise<{ ok: boolean; sebab?: string }> {
  const bulan = bersih(masukan.bulan) || bulanDari();
  const pagu = Number(masukan.paguRupiah);
  if (!Number.isFinite(pagu) || pagu < 0) return { ok: false, sebab: "Pagu harus angka rupiah tidak negatif." };
  if (!bersih(masukan.oleh)) return { ok: false, sebab: "Sebutkan siapa yang menyetel." };
  if (!bersih(masukan.atasPerintah)) {
    return { ok: false, sebab: "Sebutkan atas perintah siapa pagu ini disetel." };
  }

  const sekarang = new Date().toISOString();
  const sudahAda = await db.queryOne<Record<string, unknown>>(
    `SELECT id FROM aleta_ai_pagu WHERE bulan = ?`,
    [bulan]
  );

  if (sudahAda) {
    await db.run(
      `UPDATE aleta_ai_pagu SET pagu_rupiah = ?, diputuskan_oleh = ?, atas_perintah = ?, catatan = ?, diubah_at = ?
        WHERE id = ?`,
      [pagu, bersih(masukan.oleh), bersih(masukan.atasPerintah), bersih(masukan.catatan), sekarang, bersih(sudahAda.id)]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_ai_pagu (id, bulan, pagu_rupiah, diputuskan_oleh, atas_perintah, catatan, dibuat_at, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        bulan,
        pagu,
        bersih(masukan.oleh),
        bersih(masukan.atasPerintah),
        bersih(masukan.catatan),
        sekarang,
        sekarang,
      ]
    );
  }
  return { ok: true };
}

export type MasukanPemakaian = {
  pekerjaan: Pekerjaan;
  tingkat: "hemat" | "kuat";
  penyedia: string;
  model: string;
  tokenMasuk: number;
  tokenKeluar: number;
  tarifMasukPerJuta: number;
  tarifKeluarPerJuta: number;
  berhasil: boolean;
  perkaraId?: string;
  oleh?: string;
};

/**
 * Mencatat satu panggilan beserta biayanya.
 *
 * Panggilan yang GAGAL tetap dicatat. Penyedia tetap menagih permintaan yang
 * jawabannya tidak terpakai, dan pagu yang hanya menghitung yang berhasil akan
 * selalu lebih kecil daripada tagihannya - selisih yang baru terlihat saat
 * tagihannya datang.
 */
export async function catatPemakaian(db: AletaDatabase, masukan: MasukanPemakaian): Promise<number> {
  const biaya = hitungBiaya({
    tokenMasuk: masukan.tokenMasuk,
    tokenKeluar: masukan.tokenKeluar,
    tarifMasukPerJuta: masukan.tarifMasukPerJuta,
    tarifKeluarPerJuta: masukan.tarifKeluarPerJuta,
  });
  const sekarang = new Date();

  await db.run(
    `INSERT INTO aleta_ai_pemakaian
       (id, pekerjaan, tingkat, penyedia, model, token_masuk, token_keluar,
        tarif_masuk_per_juta, tarif_keluar_per_juta, biaya_rupiah, berhasil,
        perkara_id, oleh, bulan, dibuat_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      masukan.pekerjaan,
      masukan.tingkat,
      bersih(masukan.penyedia),
      bersih(masukan.model),
      Math.max(0, Number(masukan.tokenMasuk) || 0),
      Math.max(0, Number(masukan.tokenKeluar) || 0),
      Number(masukan.tarifMasukPerJuta) || 0,
      Number(masukan.tarifKeluarPerJuta) || 0,
      biaya,
      masukan.berhasil ? 1 : 0,
      bersih(masukan.perkaraId),
      bersih(masukan.oleh),
      bulanDari(sekarang),
      sekarang.toISOString(),
    ]
  );
  return biaya;
}

export type RincianBiaya = {
  bulan: string;
  total: number;
  pagu: number;
  keadaan: KeadaanPagu;
  perPekerjaan: Array<{ pekerjaan: string; jumlah: number; biaya: number }>;
  perModel: Array<{ model: string; tingkat: string; jumlah: number; biaya: number }>;
  /** Biaya panggilan yang gagal - terbayar tanpa hasil. */
  biayaGagal: number;
  /**
   * Panggilan yang tarif modelnya belum disetel.
   *
   * Disebut terpisah supaya Rp 0 tidak terbaca sebagai hemat. Pagu yang
   * dihitung dari panggilan tanpa tarif akan selalu aman, dan selamanya.
   */
  tanpaTarif: number;
  /** Angka biaya di sini PERKIRAAN dari panjang naskah, bukan hitungan penyedia. */
  perkiraan: boolean;
};

/**
 * Biaya bulan berjalan, dipecah menurut pekerjaan dan model.
 *
 * Dipecah karena "Rp 340.000 bulan ini" tidak dapat ditindaklanjuti. Yang
 * dapat ditindaklanjuti adalah "Rp 290.000 di antaranya untuk penyusunan
 * pertimbangan" - itu menunjuk langsung ke pekerjaan yang pustakanya belum
 * cukup terisi.
 */
export async function rincianBiaya(db: AletaDatabase, bulan = bulanDari()): Promise<RincianBiaya> {
  const perPekerjaan = await db.queryAll<Record<string, unknown>>(
    `SELECT pekerjaan, COUNT(*) AS jumlah, SUM(biaya_rupiah) AS biaya
       FROM aleta_ai_pemakaian WHERE bulan = ? GROUP BY pekerjaan ORDER BY SUM(biaya_rupiah) DESC`,
    [bulan]
  );
  const perModel = await db.queryAll<Record<string, unknown>>(
    `SELECT model, tingkat, COUNT(*) AS jumlah, SUM(biaya_rupiah) AS biaya
       FROM aleta_ai_pemakaian WHERE bulan = ? GROUP BY model, tingkat ORDER BY SUM(biaya_rupiah) DESC`,
    [bulan]
  );
  const gagal = await db.queryOne<Record<string, unknown>>(
    `SELECT SUM(biaya_rupiah) AS jumlah FROM aleta_ai_pemakaian WHERE bulan = ? AND berhasil = 0`,
    [bulan]
  );

  const tanpaTarif = await db.queryOne<Record<string, unknown>>(
    `SELECT COUNT(*) AS jumlah FROM aleta_ai_pemakaian
      WHERE bulan = ? AND tarif_masuk_per_juta = 0 AND tarif_keluar_per_juta = 0`,
    [bulan]
  );

  const keadaan = await keadaanPagu(db, bulan);
  return {
    tanpaTarif: Number(tanpaTarif?.jumlah ?? 0) || 0,
    perkiraan: true,
    bulan,
    total: keadaan.terpakai,
    pagu: keadaan.pagu,
    keadaan,
    perPekerjaan: perPekerjaan.map((item) => ({
      pekerjaan: bersih(item.pekerjaan),
      jumlah: Number(item.jumlah ?? 0),
      biaya: Number(item.biaya ?? 0),
    })),
    perModel: perModel.map((item) => ({
      model: bersih(item.model),
      tingkat: bersih(item.tingkat),
      jumlah: Number(item.jumlah ?? 0),
      biaya: Number(item.biaya ?? 0),
    })),
    biayaGagal: Number(gagal?.jumlah ?? 0) || 0,
  };
}

/** K1 + K3 dijawab bersama: boleh atau tidak, dan dengan tingkat model apa. */
export async function izinPanggil(
  db: AletaDatabase,
  pekerjaan: Pekerjaan
): Promise<{ boleh: boolean; tingkat: "hemat" | "kuat"; sebab: string }> {
  return bolehPanggil(pekerjaan, await keadaanPagu(db));
}


/**
 * Tarif satu model. Tidak ada tarif bawaan.
 *
 * Tarif tertanam akan tetap dipakai berbulan-bulan sesudah penyedia
 * mengubahnya, menghasilkan laporan biaya yang rapi dan salah. Model yang
 * tarifnya belum disetel menghasilkan biaya nol - dan rincianBiaya
 * menyebutkannya terpisah supaya nol itu tidak terbaca sebagai hemat.
 */
export async function tarifModel(
  db: AletaDatabase,
  model: string
): Promise<{ masuk: number; keluar: number; adaTarif: boolean }> {
  const baris = await db.queryOne<Record<string, unknown>>(
    `SELECT tarif_masuk_per_juta, tarif_keluar_per_juta FROM aleta_ai_tarif WHERE model = ?`,
    [bersih(model)]
  );
  return {
    masuk: Number(baris?.tarif_masuk_per_juta ?? 0) || 0,
    keluar: Number(baris?.tarif_keluar_per_juta ?? 0) || 0,
    adaTarif: Boolean(baris),
  };
}

export async function setelTarif(
  db: AletaDatabase,
  masukan: { model: string; masukPerJuta: number; keluarPerJuta: number; oleh: string }
): Promise<{ ok: boolean; sebab?: string }> {
  const model = bersih(masukan.model);
  if (!model) return { ok: false, sebab: "Sebutkan nama modelnya." };
  if (!bersih(masukan.oleh)) return { ok: false, sebab: "Sebutkan siapa yang menyetel tarif." };

  const masuk = Number(masukan.masukPerJuta);
  const keluar = Number(masukan.keluarPerJuta);
  if (!Number.isFinite(masuk) || masuk < 0 || !Number.isFinite(keluar) || keluar < 0) {
    return { ok: false, sebab: "Tarif harus angka rupiah tidak negatif." };
  }

  const sekarang = new Date().toISOString();
  const sudahAda = await db.queryOne<Record<string, unknown>>(
    `SELECT id FROM aleta_ai_tarif WHERE model = ?`,
    [model]
  );
  if (sudahAda) {
    await db.run(
      `UPDATE aleta_ai_tarif SET tarif_masuk_per_juta = ?, tarif_keluar_per_juta = ?, disetel_oleh = ?, diubah_at = ?
        WHERE id = ?`,
      [masuk, keluar, bersih(masukan.oleh), sekarang, bersih(sudahAda.id)]
    );
  } else {
    await db.run(
      `INSERT INTO aleta_ai_tarif (id, model, tarif_masuk_per_juta, tarif_keluar_per_juta, disetel_oleh, dibuat_at, diubah_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), model, masuk, keluar, bersih(masukan.oleh), sekarang, sekarang]
    );
  }
  return { ok: true };
}

/**
 * Perkiraan jumlah token dari panjang naskah.
 *
 * Penyedia yang dipakai ALETA tidak mengembalikan hitungan tokennya lewat
 * pembungkus yang ada, jadi biaya dihitung dari perkiraan - kira-kira empat
 * huruf satu token untuk teks Indonesia.
 *
 * Perkiraan disebut perkiraan, bukan disajikan sebagai angka pasti: laporan
 * biaya menandainya, dan yang membandingkannya dengan tagihan penyedia akan
 * menemukan selisih. Selisih yang diketahui jauh lebih baik daripada angka
 * yang tampak pasti dan diam-diam meleset.
 */
export function perkiraanToken(teks: string): number {
  return Math.ceil(String(teks ?? "").length / 4);
}

/**
 * Mencatat satu panggilan dengan tarif yang berlaku saat itu.
 *
 * Menggabungkan pencarian tarif dan pencatatan supaya pemanggil tidak dapat
 * lupa salah satunya - dan yang paling mudah dilupakan justru pencatatannya,
 * sebab panggilannya sudah berhasil dan tidak ada yang menuntut.
 */
export async function catatDenganTarif(
  db: AletaDatabase,
  masukan: {
    pekerjaan: Pekerjaan;
    tingkat: "hemat" | "kuat";
    penyedia: string;
    model: string;
    teksMasuk: string;
    teksKeluar: string;
    berhasil: boolean;
    perkaraId?: string;
    oleh?: string;
  }
): Promise<{ biaya: number; adaTarif: boolean }> {
  const tarif = await tarifModel(db, masukan.model);
  const biaya = await catatPemakaian(db, {
    pekerjaan: masukan.pekerjaan,
    tingkat: masukan.tingkat,
    penyedia: masukan.penyedia,
    model: masukan.model,
    tokenMasuk: perkiraanToken(masukan.teksMasuk),
    tokenKeluar: perkiraanToken(masukan.teksKeluar),
    tarifMasukPerJuta: tarif.masuk,
    tarifKeluarPerJuta: tarif.keluar,
    berhasil: masukan.berhasil,
    perkaraId: masukan.perkaraId,
    oleh: masukan.oleh,
  });
  return { biaya, adaTarif: tarif.adaTarif };
}

// =============================================================================
// K4 - UKURAN KEBERHASILAN PUSTAKA
// =============================================================================

/**
 * Persentase draf yang selesai tanpa memanggil model.
 *
 * Draf dihitung "dengan model" bila salah satu butirnya berasal dari butir
 * pustaka yang dibuat model - dikenali dari dibuat_oleh berawalan "model:".
 * Menghitungnya dari tabel pemakaian akan keliru: satu panggilan percakapan
 * yang tidak masuk draf mana pun akan menandai draf itu seolah memakai model.
 */
export async function keberhasilanPustaka(
  db: AletaDatabase,
  sejak: string,
  sampai: string
): Promise<Keberhasilan> {
  const draf = await db.queryAll<Record<string, unknown>>(
    `SELECT id FROM aleta_putusan_draf WHERE dibuat_at >= ? AND dibuat_at <= ?`,
    [bersih(sejak), bersih(sampai)]
  );

  let tanpaModel = 0;
  let denganModel = 0;
  let tanpaButir = 0;

  for (const satu of draf) {
    const drafId = bersih(satu.id);
    const butir = await db.queryAll<Record<string, unknown>>(
      `SELECT butir_id FROM aleta_putusan_draf_butir WHERE draf_id = ?`,
      [drafId]
    );
    if (!butir.length) {
      tanpaButir += 1;
      continue;
    }

    let pakaiModel = false;
    for (const item of butir) {
      const asal = await db.queryOne<Record<string, unknown>>(
        `SELECT dibuat_oleh FROM aleta_pertimbangan_butir WHERE id = ?`,
        [bersih(item.butir_id)]
      );
      if (bersih(asal?.dibuat_oleh).startsWith("model:")) {
        pakaiModel = true;
        break;
      }
    }
    if (pakaiModel) denganModel += 1;
    else tanpaModel += 1;
  }

  return hitungKeberhasilan({ jumlahDraf: draf.length, tanpaModel, denganModel, tanpaButir });
}

// =============================================================================
// K5 - BELAJAR DARI SUNTINGAN
// =============================================================================

/**
 * Butir yang sering ditolak hakim.
 *
 * Hasilnya SARAN untuk dibaca, bukan tindakan. Butir yang sering ditolak
 * mungkin keliru, mungkin dipakai pada jenis perkara yang salah, mungkin
 * hakimnya yang keliru - ketiganya menuntut orang yang membaca, dan sistem
 * yang memperbaiki dirinya sendiri berdasarkan hitungan akan memperbaiki
 * yang ketiga.
 */
export async function temuanSuntingan(db: AletaDatabase): Promise<TemuanSuntingan[]> {
  const dipakai = await db.queryAll<Record<string, unknown>>(
    `SELECT butir_id,
            COUNT(*) AS dipakai,
            SUM(CASE WHEN keadaan = 'ditolak' THEN 1 ELSE 0 END) AS ditolak
       FROM aleta_putusan_draf_butir
      WHERE butir_id <> ''
      GROUP BY butir_id`
  );

  const penolakan = [];
  for (const satu of dipakai) {
    const butirId = bersih(satu.butir_id);
    const butir = await db.queryOne<Record<string, unknown>>(
      `SELECT teks FROM aleta_pertimbangan_butir WHERE id = ?`,
      [butirId]
    );
    const alasan = await db.queryAll<Record<string, unknown>>(
      `SELECT alasan_tolak FROM aleta_putusan_draf_butir
        WHERE butir_id = ? AND keadaan = 'ditolak' AND alasan_tolak <> ''`,
      [butirId]
    );
    penolakan.push({
      butirId,
      teks: bersih(butir?.teks),
      jumlahDipakai: Number(satu.dipakai ?? 0),
      jumlahDitolak: Number(satu.ditolak ?? 0),
      alasan: alasan.map((item) => bersih(item.alasan_tolak)),
    });
  }

  return saringSuntingan(penolakan);
}

// =============================================================================
// K7 - JALUR APLIKASI BARU
// =============================================================================

export async function daftarkanSumber(
  db: AletaDatabase,
  sumber: Sumber
): Promise<{ ok: boolean; halangan: string[]; peringatan: string[] }> {
  const periksa = periksaSumber(sumber);
  if (!periksa.ok) return periksa;

  const sekarang = new Date().toISOString();
  const sudahAda = await db.queryOne<Record<string, unknown>>(
    `SELECT id FROM aleta_sumber_aplikasi WHERE kode = ?`,
    [bersih(sumber.kode)]
  );
  if (sudahAda) {
    return { ok: false, halangan: [`Sumber "${sumber.kode}" sudah terdaftar.`], peringatan: [] };
  }

  await db.run(
    `INSERT INTO aleta_sumber_aplikasi
       (id, kode, nama, asal, hanya_baca, umur_wajar_jam, ruas, aktif,
        didaftarkan_oleh, atas_perintah, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, 0, ?, ?, ?, ?)`,
    [
      randomUUID(),
      bersih(sumber.kode),
      bersih(sumber.nama),
      bersih(sumber.asal),
      Number(sumber.umurWajarJam) || 0,
      JSON.stringify(sumber.ruas ?? []),
      bersih(sumber.didaftarkanOleh),
      bersih(sumber.atasPerintah),
      sekarang,
      sekarang,
    ]
  );
  return { ok: true, halangan: [], peringatan: periksa.peringatan };
}

export async function sumberTerdaftar(db: AletaDatabase, hanyaAktif = false): Promise<Sumber[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    hanyaAktif
      ? `SELECT * FROM aleta_sumber_aplikasi WHERE aktif = 1 ORDER BY kode ASC`
      : `SELECT * FROM aleta_sumber_aplikasi ORDER BY kode ASC`
  );
  return baris.map((item) => {
    let ruas: Sumber["ruas"] = [];
    try {
      const hasil = JSON.parse(bersih(item.ruas) || "[]");
      if (Array.isArray(hasil)) ruas = hasil;
    } catch {
      ruas = [];
    }
    return {
      kode: bersih(item.kode),
      nama: bersih(item.nama),
      asal: bersih(item.asal),
      hanyaBaca: Number(item.hanya_baca ?? 1) === 1,
      umurWajarJam: Number(item.umur_wajar_jam ?? 0),
      ruas,
      didaftarkanOleh: bersih(item.didaftarkan_oleh),
      atasPerintah: bersih(item.atas_perintah),
    };
  });
}

/**
 * Aturan batas dari seluruh sumber yang AKTIF.
 *
 * Hanya yang aktif: sumber yang terdaftar tetapi belum dinyalakan tidak boleh
 * ruasnya ikut melonggarkan penyaring J5. Pendaftaran adalah pernyataan
 * niat; penyalaan adalah keputusan.
 */
export async function batasDariSumber(db: AletaDatabase) {
  const sumber = await sumberTerdaftar(db, true);
  return sumber.flatMap((satu) => aturanBatasSumber(satu));
}

export { nilaiKesegaran };
