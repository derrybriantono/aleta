import { randomUUID } from "node:crypto";

import {
  adukan,
  bacaKeadaan,
  pilihTemplatAmar,
  type ButirAmar,
  type HasilAduan,
  type Petitum,
  type TemplatAmar,
} from "@/lib/amar-petitum";
import { hitungBiaya, kalimatBiaya, type HasilBiaya, type KomponenBiaya } from "@/lib/biaya-perkara";
import { susunDudukPerkara, type MasukanDudukPerkara } from "@/lib/duduk-perkara";
import { pilihButir, type Fakta } from "@/lib/pemilih-butir";
import {
  kepalaPutusan,
  naskahDariKerangka,
  susunKerangka,
  type Kerangka,
  type KunciBagian,
} from "@/lib/susunan-putusan";
import type { AletaDatabase } from "@/server/db/client";
import {
  bekukanDasar,
  halanganKutipan,
  rujukanButirDipakai,
  simpanDasar,
  type DasarBeku,
} from "@/server/modules/aleta-ecourt/penjagaan-putusan";
import { cariButir, type Butir } from "@/server/modules/aleta-ecourt/pustaka-pertimbangan";
import { butirTelaah, ringkasTelaah } from "@/server/modules/aleta-ecourt/telaah-draf";

/**
 * PERAKIT PUTUSAN (F1-F6) - merangkai, tidak mengarang.
 *
 * ============================================================================
 * TIDAK ADA SATU PUN PANGGILAN MODEL DI SELURUH JALUR INI
 * ============================================================================
 *
 * Tiap kalimat yang keluar dari perakit ini punya asal yang dapat ditunjuk:
 * berkas perkara dari SIPP, riwayat sidang dari jadwal, kehadiran dan
 * keterangan saksi dari lembar BAS, alinea pertimbangan dari butir pustaka
 * yang sudah disahkan, amar dari templat SIPP, dan biaya dari perhitungan.
 *
 * Bukan karena AI dilarang, melainkan karena bagian ini tidak membutuhkannya.
 * Yang dikerjakan di sini adalah merangkai bahan yang sudah pernah dibaca
 * manusia - dan merangkai adalah pekerjaan yang mesin kerjakan lebih ajeg
 * daripada manusia, tanpa satu pun risiko pasal karangan.
 *
 * ============================================================================
 * HASILNYA DRAF, DAN "SIAP" BUKAN "BENAR"
 * ============================================================================
 *
 * siapDitandatangani hanya menyatakan: seluruh bagian wajib terisi, tiap
 * petitum terjawab, dan biayanya terhitung. Ia TIDAK menyatakan pertimbangan
 * hukumnya tepat - tidak ada mesin yang dapat menyatakan itu.
 *
 * Perbedaan ini harus terus terlihat di layar. Draf yang bertanda "siap" lalu
 * ditandatangani tanpa dibaca adalah cara paling mudah bagi sistem ini
 * menghasilkan putusan yang keliru, dan satu-satunya penjaganya adalah kata
 * yang dipilih untuk menamai keadaannya.
 */

export type MasukanRakit = {
  perkaraId: string;
  nomorPerkara: string;
  pengadilan: string;
  jenisNaskah?: string;
  jenisPerkara: string;
  /** Fakta perkara yang menjadi lawan adu syarat butir (F3). */
  fakta: Fakta;
  dudukPerkara: MasukanDudukPerkara;
  petitum: Petitum[];
  amar: ButirAmar[];
  /**
   * Templat amar dari SIPP (F4).
   *
   * Dipakai HANYA bila `amar` kosong. Templat tidak pernah menimpa amar yang
   * sudah disusun petugas - yang diketik manusia selalu menang atas yang
   * dipilih mesin.
   */
  templatAmar?: TemplatAmar[];
  biaya: { komponen: KomponenBiaya[]; panjar: number; dibebankanKepada: string };
  /** Nilai yang mengisi naskah beserta sistem asalnya, untuk disimpan (F6). */
  nilai?: Array<{ nama: string; nilai: string; asal: string }>;
};

export type HasilRakit = {
  kerangka: Kerangka;
  naskah: string;
  aduan: HasilAduan;
  biaya: HasilBiaya;
  /** Butir yang dipakai, dengan bunyi dan versinya saat ini (F6). */
  butirDipakai: Array<{
    kunciBagian: KunciBagian;
    butirId: string;
    urutan: number;
    teks: string;
    versi: number;
    alasan: string[];
  }>;
  /** Butir yang tidak dipakai karena faktanya belum diketahui - ini yang dilengkapi. */
  butirTertunda: Array<{ butirId: string; sebab: string }>;
  faktaKurang: string[];
  /** Dasar hukum yang dibekukan pada saat perakitan (J1, J4). */
  dasar: DasarBeku[];
  halangan: string[];
  siapDitandatangani: boolean;
};

function bersih(nilai: unknown): string {
  return String(nilai ?? "").trim();
}

/**
 * Merakit draf putusan.
 *
 * Butir pustaka yang diambil HANYA yang sudah disahkan - itu bawaan
 * cariButir dan sengaja tidak dibuka di sini. Perakit yang boleh memakai
 * butir usulan akan memakainya pada hari pustaka masih setengah terisi,
 * yaitu hari ini.
 */
export async function rakitPutusan(db: AletaDatabase, masukan: MasukanRakit): Promise<HasilRakit> {
  const halangan: string[] = [];

  // ── F3 - butir pustaka yang syaratnya terpenuhi ────────────────────────
  const tersedia = await cariButir(db, { jenisPerkara: masukan.jenisPerkara, batas: 300 });
  const pilihan = pilihButir(tersedia, masukan.fakta);

  // ── J1 - tiap rujukan butir yang dipakai WAJIB terbukti di pustaka ─────
  //
  // Diperiksa di sini, bukan sesudah naskah tersusun. Pemeriksaan yang berjalan
  // sesudah naskah jadi menghasilkan peringatan di atas naskah yang sudah rapi,
  // dan peringatan semacam itu dilewati.
  const pembekuan = await bekukanDasar(
    db,
    await rujukanButirDipakai(db, pilihan.terpilih.map((item) => item.butir.id))
  );
  halangan.push(...halanganKutipan(pembekuan));

  // ── F2 - duduk perkara dari yang tercatat ──────────────────────────────
  const duduk = susunDudukPerkara(masukan.dudukPerkara);
  halangan.push(...duduk.kekurangan);

  // ── F4 - amar diadu dengan petitum ─────────────────────────────────────
  const aduan = adukan(masukan.petitum, masukan.amar);
  halangan.push(...aduan.halangan);

  // ── F5 - biaya dihitung ────────────────────────────────────────────────
  const biaya = hitungBiaya(masukan.biaya?.komponen ?? [], masukan.biaya?.panjar ?? 0);
  halangan.push(...biaya.halangan);

  // ── F1 - dirangkai menurut susunan baku ────────────────────────────────
  const pertimbangan = pilihan.terpilih.map((item) => item.butir.teks.trim()).filter(Boolean);

  // ── F4 - amar dari templat SIPP bila belum disusun petugas ─────────────
  //
  // Sempat tidak tersambung sama sekali: pemilih templat ada, terjuji, dan
  // tidak pernah dipanggil - sehingga "amar dari templat SIPP" hanya berlaku
  // bila pemanggilnya sudah menyusun amarnya sendiri, yang meniadakan gunanya.
  let barisAmar = [...(masukan.amar ?? [])].sort((a, b) => a.nomor - b.nomor);
  if (!barisAmar.length && (masukan.templatAmar ?? []).length) {
    const keadaanAmar = bacaKeadaan(
      (masukan.petitum ?? []).map((item) => item.teks).join(" ")
    );
    const pilihanTemplat = pilihTemplatAmar(masukan.templatAmar ?? [], {
      jenisPerkara: masukan.jenisPerkara,
      keadaan: keadaanAmar === "takDikenali" ? "dikabulkan" : keadaanAmar,
    });
    if (pilihanTemplat.templat) {
      barisAmar = pecahTemplatAmar(pilihanTemplat.templat.isi);
      if (pilihanTemplat.sebab) halangan.push(pilihanTemplat.sebab);
    } else if (pilihanTemplat.sebab) {
      halangan.push(pilihanTemplat.sebab);
    }
  }
  const kalimatBiayaAmar = kalimatBiaya(biaya, masukan.biaya?.dibebankanKepada ?? "");

  const kerangka = susunKerangka({
    kepala: kepalaPutusan({
      jenisNaskah: masukan.jenisNaskah,
      nomorPerkara: masukan.nomorPerkara,
      pengadilan: masukan.pengadilan,
    }),
    identitas: susunIdentitas(masukan),
    dudukPerkara: {
      isi: duduk.teks,
      halangan: duduk.kekurangan[0] ?? "",
    },
    pertimbangan: {
      isi: pertimbangan.join("\n\n"),
      butirDipakai: pilihan.terpilih.map((item) => item.butir.id),
      halangan: pertimbangan.length
        ? ""
        : "Tidak ada satu pun butir pustaka yang syaratnya terpenuhi untuk perkara ini.",
    },
    amar: {
      isi: susunAmar(barisAmar, kalimatBiayaAmar),
      halangan: barisAmar.length ? "" : "Amar belum tersusun dari templat.",
    },
    penutup: susunPenutup(masukan),
  });

  const naskah = naskahDariKerangka(kerangka);
  const siap = kerangka.siapDitandatangani && halangan.length === 0;

  return {
    kerangka,
    naskah,
    aduan,
    biaya,
    butirDipakai: pilihan.terpilih.map((item, urutan) => ({
      kunciBagian: "pertimbangan" as KunciBagian,
      butirId: item.butir.id,
      urutan,
      teks: item.butir.teks,
      versi: Number((item.butir as Butir).versi ?? 0),
      alasan: item.alasan,
    })),
    butirTertunda: pilihan.dilewati
      .filter((item) => item.karenaBelumDiketahui)
      .map((item) => ({ butirId: item.butir.id, sebab: item.sebab })),
    faktaKurang: pilihan.faktaKurang,
    dasar: pembekuan.dasar,
    halangan,
    siapDitandatangani: siap,
  };
}

/**
 * Memecah isi templat menjadi butir amar.
 *
 * Satu baris satu butir. Penomoran yang sudah ada di templat DIBUANG dan
 * dinomori ulang perakit - templat kerap dilewati sebagiannya, dan amar yang
 * melompat dari 1 ke 3 dibaca sebagai ada butir yang hilang.
 */
function pecahTemplatAmar(isi: string): ButirAmar[] {
  return String(isi ?? "")
    .split(/\r?\n/)
    .map((baris) => baris.trim().replace(/^\d+[.)]\s*/, ""))
    .filter((baris) => baris && !/^MENGADILI$/i.test(baris))
    .map((teks, urutan) => ({ nomor: urutan + 1, teks }));
}

function susunIdentitas(masukan: MasukanRakit): { isi?: string; halangan?: string } {
  const penggugat = bersih(masukan.dudukPerkara?.penggugat);
  const tergugat = bersih(masukan.dudukPerkara?.tergugat);
  const sebutanP = bersih(masukan.dudukPerkara?.sebutanPenggugat) || "Penggugat";
  const sebutanT = bersih(masukan.dudukPerkara?.sebutanTergugat) || "Tergugat";

  if (!penggugat || !tergugat) {
    return { halangan: `Nama ${!penggugat ? sebutanP : sebutanT} belum tercatat.` };
  }
  return { isi: [`${penggugat}, sebagai ${sebutanP};`, `${tergugat}, sebagai ${sebutanT};`].join("\n") };
}

/**
 * Amar dinomori ulang menurut urutannya di naskah.
 *
 * Nomor templat tidak dipakai apa adanya: templat kerap dilewati sebagiannya,
 * dan amar yang melompat dari 1 ke 3 akan dibaca sebagai ada butir yang
 * hilang - persis kekeliruan yang F4 ada untuk mencegahnya.
 */
function susunAmar(barisAmar: ButirAmar[], kalimatBiayaAmar: string): string {
  const baris = barisAmar.map((item) => bersih(item.teks)).filter(Boolean);
  if (kalimatBiayaAmar && !baris.some((item) => /biaya\s+perkara/i.test(item))) {
    baris.push(kalimatBiayaAmar);
  }
  if (!baris.length) return "";
  return ["MENGADILI", ...baris.map((teks, nomor) => `${nomor + 1}. ${teks}`)].join("\n");
}

function susunPenutup(masukan: MasukanRakit): { isi?: string; halangan?: string } {
  const nilai = new Map((masukan.nilai ?? []).map((item) => [item.nama, bersih(item.nilai)]));
  const ketua = nilai.get("ketuaMajelis") ?? "";
  const panitera = nilai.get("panitera") ?? "";
  const tanggal = nilai.get("tanggalPutusan") ?? "";

  const kurang = [!tanggal && "tanggal putusan", !ketua && "ketua majelis", !panitera && "panitera sidang"]
    .filter(Boolean)
    .join(", ");
  if (kurang) return { halangan: `Penutup belum lengkap: ${kurang}.` };

  return {
    isi: [
      `Demikian diputuskan dalam musyawarah Majelis Hakim pada hari ${tanggal},`,
      `oleh ${ketua} sebagai Ketua Majelis,`,
      `dengan didampingi ${panitera} sebagai Panitera Sidang.`,
    ].join("\n"),
  };
}

// =============================================================================
// F6 - RIWAYAT VERSI
// =============================================================================

export type Draf = {
  id: string;
  perkaraId: string;
  nomorPerkara: string;
  versi: number;
  jenisNaskah: string;
  keadaan: "draf" | "diperiksa" | "ditandatangani" | "dibatalkan";
  naskah: string;
  belumTerisi: string[];
  halangan: string[];
  siap: boolean;
  ditandatanganiOleh: string;
  ditandatanganiAt: string;
  catatan: string;
  dibuatOleh: string;
  dibuatAt: string;
};

function bentukDraf(baris: Record<string, unknown>): Draf {
  return {
    id: bersih(baris.id),
    perkaraId: bersih(baris.perkara_id),
    nomorPerkara: bersih(baris.nomor_perkara),
    versi: Number(baris.versi ?? 1),
    jenisNaskah: bersih(baris.jenis_naskah),
    keadaan: (bersih(baris.keadaan) || "draf") as Draf["keadaan"],
    naskah: bersih(baris.naskah),
    belumTerisi: uraikanJson(baris.belum_terisi),
    halangan: uraikanJson(baris.halangan),
    siap: Number(baris.siap ?? 0) === 1,
    ditandatanganiOleh: bersih(baris.ditandatangani_oleh),
    ditandatanganiAt: bersih(baris.ditandatangani_at),
    catatan: bersih(baris.catatan),
    dibuatOleh: bersih(baris.dibuat_oleh),
    dibuatAt: bersih(baris.dibuat_at),
  };
}

function uraikanJson(nilai: unknown): string[] {
  try {
    const hasil = JSON.parse(bersih(nilai) || "[]");
    return Array.isArray(hasil) ? hasil.map(bersih).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Menyimpan draf sebagai VERSI BARU, selalu.
 *
 * Tidak ada jalur yang menimpa versi sebelumnya. Draf lama adalah satu-satunya
 * bukti bahwa naskah sempat berbunyi lain sebelum disunting - dan pertanyaan
 * "apa yang berubah sejak pemeriksaan minggu lalu" hanya dapat dijawab bila
 * yang lama masih ada.
 */
export async function simpanDraf(
  db: AletaDatabase,
  aktor: string,
  masukan: {
    perkaraId: string;
    nomorPerkara: string;
    jenisNaskah?: string;
    hasil: HasilRakit;
    nilai?: Array<{ nama: string; nilai: string; asal: string }>;
    catatan?: string;
  }
): Promise<{ ok: boolean; drafId: string; versi: number; sebab?: string }> {
  const perkaraId = bersih(masukan.perkaraId);
  if (!perkaraId) return { ok: false, drafId: "", versi: 0, sebab: "perkara_id kosong." };

  const terakhir = await db.queryOne<{ versi: number }>(
    `SELECT versi FROM aleta_putusan_draf WHERE perkara_id = ? ORDER BY versi DESC LIMIT 1`,
    [perkaraId]
  );
  const versi = Number(terakhir?.versi ?? 0) + 1;
  const drafId = randomUUID();
  const sekarang = new Date().toISOString();
  const hasil = masukan.hasil;

  await db.run(
    `INSERT INTO aleta_putusan_draf
       (id, perkara_id, nomor_perkara, versi, jenis_naskah, keadaan, naskah,
        belum_terisi, halangan, siap, catatan, dibuat_oleh, dibuat_at, diubah_at)
     VALUES (?, ?, ?, ?, ?, 'draf', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      drafId,
      perkaraId,
      bersih(masukan.nomorPerkara),
      versi,
      bersih(masukan.jenisNaskah) || "PUTUSAN",
      hasil.naskah,
      JSON.stringify(hasil.kerangka.belumTerisi),
      JSON.stringify(hasil.halangan),
      hasil.siapDitandatangani ? 1 : 0,
      bersih(masukan.catatan),
      bersih(aktor),
      sekarang,
      sekarang,
    ]
  );

  // Bunyi butir DISALIN, tidak cukup ditunjuk - lihat catatan migrasi 0027.
  for (const item of hasil.butirDipakai) {
    await db.run(
      `INSERT INTO aleta_putusan_draf_butir
         (id, draf_id, kunci_bagian, butir_id, urutan, teks_saat_itu, versi_butir, alasan)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        drafId,
        item.kunciBagian,
        item.butirId,
        item.urutan,
        item.teks,
        item.versi,
        JSON.stringify(item.alasan),
      ]
    );
  }

  // Dasar hukum dibekukan bersama draf: peraturan dapat dicabut atau diubah,
  // dan draf yang hanya menunjuk jangkar akan berubah dasarnya sesudah
  // ditandatangani.
  await simpanDasar(db, drafId, hasil.dasar ?? []);

  for (const item of masukan.nilai ?? []) {
    const nama = bersih(item.nama);
    if (!nama) continue;
    await db.run(
      `INSERT INTO aleta_putusan_draf_nilai (id, draf_id, nama, nilai, asal) VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), drafId, nama, bersih(item.nilai), bersih(item.asal)]
    );
  }

  return { ok: true, drafId, versi };
}

export async function bacaDraf(db: AletaDatabase, drafId: string): Promise<Draf | null> {
  const baris = await db.queryOne<Record<string, unknown>>(`SELECT * FROM aleta_putusan_draf WHERE id = ?`, [
    bersih(drafId),
  ]);
  return baris ? bentukDraf(baris) : null;
}

export async function riwayatDraf(db: AletaDatabase, perkaraId: string): Promise<Draf[]> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_putusan_draf WHERE perkara_id = ? ORDER BY versi DESC`,
    [bersih(perkaraId)]
  );
  return baris.map(bentukDraf);
}

/** Butir beserta bunyinya saat draf ini disusun - bukan bunyinya hari ini. */
export async function butirDraf(
  db: AletaDatabase,
  drafId: string
): Promise<Array<{ butirId: string; urutan: number; teks: string; versi: number; alasan: string[] }>> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_putusan_draf_butir WHERE draf_id = ? ORDER BY urutan ASC`,
    [bersih(drafId)]
  );
  return baris.map((item) => ({
    butirId: bersih(item.butir_id),
    urutan: Number(item.urutan ?? 0),
    teks: bersih(item.teks_saat_itu),
    versi: Number(item.versi_butir ?? 0),
    alasan: uraikanJson(item.alasan),
  }));
}

export async function nilaiDraf(
  db: AletaDatabase,
  drafId: string
): Promise<Array<{ nama: string; nilai: string; asal: string }>> {
  const baris = await db.queryAll<Record<string, unknown>>(
    `SELECT * FROM aleta_putusan_draf_nilai WHERE draf_id = ? ORDER BY nama ASC`,
    [bersih(drafId)]
  );
  return baris.map((item) => ({
    nama: bersih(item.nama),
    nilai: bersih(item.nilai),
    asal: bersih(item.asal),
  }));
}

/**
 * Menandatangani draf.
 *
 * Menuntut TIGA hal, dan tidak ada parameter untuk melewati satu pun -
 * pelewat yang disediakan akan dipakai pada hari yang paling sibuk:
 *
 *   - siap = 1: seluruh bagian wajib terisi dan tidak ada halangan;
 *   - seluruh butir sudah ditelaah (H3) - selama masih ada yang 'belum',
 *     tombol terima dan tolak pada tiap alinea hanya akan menjadi hiasan; dan
 *   - nama penanda tangan. Tanpanya jejaknya hanya menyebut akun yang menekan,
 *     dan akun bukan hakim.
 */
export async function tandatanganiDraf(
  db: AletaDatabase,
  masukan: { drafId: string; olehNama: string }
): Promise<{ ok: boolean; sebab?: string }> {
  const drafId = bersih(masukan.drafId);
  const nama = bersih(masukan.olehNama);
  if (!nama) return { ok: false, sebab: "Nama hakim yang menandatangani wajib disebut." };

  const draf = await bacaDraf(db, drafId);
  if (!draf) return { ok: false, sebab: "Draf tidak ditemukan." };
  if (draf.keadaan === "ditandatangani") return { ok: false, sebab: "Draf ini sudah ditandatangani." };
  if (draf.keadaan === "dibatalkan") return { ok: false, sebab: "Draf ini sudah dibatalkan." };
  if (!draf.siap) {
    const sisa = [...draf.belumTerisi, ...draf.halangan].slice(0, 3).join("; ");
    return { ok: false, sebab: `Draf belum siap: ${sisa || "masih ada bagian yang belum terisi"}.` };
  }

  const telaah = ringkasTelaah(await butirTelaah(db, drafId));
  if (!telaah.selesai) {
    return {
      ok: false,
      sebab: telaah.jumlah
        ? `Masih ada ${telaah.belum} alinea pertimbangan yang belum ditelaah.`
        : "Draf ini tidak memuat satu pun alinea pertimbangan untuk ditelaah.",
    };
  }

  const sekarang = new Date().toISOString();
  await db.run(
    `UPDATE aleta_putusan_draf
        SET keadaan = 'ditandatangani', ditandatangani_oleh = ?, ditandatangani_at = ?, diubah_at = ?
      WHERE id = ?`,
    [nama, sekarang, sekarang, drafId]
  );
  return { ok: true };
}

/**
 * Membandingkan bunyi butir di draf dengan bunyinya di pustaka hari ini.
 *
 * Inilah gunanya salinan itu disimpan. Butir yang sudah diganti sesudah draf
 * dibuat akan terlihat di sini, sehingga yang memeriksa tahu naskahnya
 * memakai bunyi lama - bukan menemukannya di ruang sidang.
 */
export async function selisihDenganPustaka(
  db: AletaDatabase,
  drafId: string
): Promise<Array<{ butirId: string; teksDraf: string; teksPustaka: string; keadaanPustaka: string }>> {
  const dipakai = await butirDraf(db, drafId);
  const selisih: Array<{ butirId: string; teksDraf: string; teksPustaka: string; keadaanPustaka: string }> = [];

  for (const item of dipakai) {
    if (!item.butirId) continue;
    const baris = await db.queryOne<Record<string, unknown>>(
      `SELECT teks, keadaan FROM aleta_pertimbangan_butir WHERE id = ?`,
      [item.butirId]
    );
    const teksPustaka = bersih(baris?.teks);
    const keadaan = bersih(baris?.keadaan) || "tidak ditemukan";
    if (!baris || teksPustaka !== item.teks || keadaan !== "disahkan") {
      selisih.push({ butirId: item.butirId, teksDraf: item.teks, teksPustaka, keadaanPustaka: keadaan });
    }
  }
  return selisih;
}
