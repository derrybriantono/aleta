import { SKP_JABATAN_2026, type DefIndikatorSkp } from "@/lib/skp-jabatan-katalog";
import { JABATAN_SKP, LABEL_JABATAN_SKP, type JabatanSkp } from "@/lib/skp-jabatan-tipe";

/**
 * ============================================================================
 * EVIDEN SKP SEMUA PERAN - PETA KEGIATAN NYATA -> BUTIR SKP
 * ============================================================================
 *
 * Diminta pengguna 20 Oktober 2026: eviden SKP seperti hakim untuk
 * Panitera, Panitera Pengganti, Panitera Muda, Juru Sita/JSP, Mediator,
 * PTSP/petugas meja, Kasir/Bendahara penerima, Sekretaris, Kasubag,
 * Operator/Pranata Komputer, dan Analis Perkara - dari kegiatan yang BENAR-
 * BENAR tercatat di SIPP, e-Court, dan aplikasi pengadilan, bukan diketik.
 *
 * Berkas ini hanya PETA (tanpa basis data, tanpa angka): kegiatan apa yang
 * dibaca untuk tiap jabatan, dari sistem mana, dan butir SKP (indikator di
 * skp-jabatan-katalog.ts) mana yang didukungnya. Angka, target, dan aturan
 * hitung tetap satu tempat (katalog + skp-jabatan-hitung.ts) - peta ini
 * tidak boleh mengarang angka, dan tidak menyimpan target.
 *
 * Penjaga (eviden-skp-peran-20okt.test.ts):
 *   - setiap butir yang disebut peta ada di katalog;
 *   - setiap indikator katalog yang dihitung otomatis (bukan isian) tercakup
 *     oleh minimal satu kegiatan;
 *   - sumber kegiatan sejalan dengan katalog: "SIPP" bila dibaca bot,
 *     "e-Court"/"Sistem" bila dibaca portal.
 */

export type SumberKegiatanEviden = "SIPP" | "e-Court" | "Sistem";

export type KegiatanEviden = {
  /** Kegiatan nyata dalam bahasa pengguna. */
  kegiatan: string;
  sumber: SumberKegiatanEviden;
  /** Kunci indikator katalog (Kuantitas/Kualitas/Waktu) yang didukung kegiatan ini. */
  butir: readonly string[];
};

const k = (kegiatan: string, sumber: SumberKegiatanEviden, ...butir: string[]): KegiatanEviden => ({
  kegiatan,
  sumber,
  butir,
});

const tiga = (awal: string): string[] => [`${awal}-kuantitas`, `${awal}-kualitas`, `${awal}-waktu`];

function kegiatanPanmud(awal: "gugatan" | "permohonan", sebutan: string): KegiatanEviden[] {
  return [
    k(`Putusan perkara ${sebutan} yang diselesaikan administrasinya (salinan terunggah di SIPP)`, "SIPP", `${awal}-putusan-kuantitas`, `${awal}-putusan-kualitas`),
    k("Pemberitahuan putusan kepada para pihak (paling lama 7 hari sejak putusan)", "SIPP", `${awal}-putusan-waktu`),
    k("Anonimisasi putusan sebelum dipublikasikan", "SIPP", `${awal}-publikasi-kuantitas`, `${awal}-publikasi-kualitas`),
    k("Penerbitan akta cerai setelah putusan berkekuatan hukum tetap", "SIPP", ...tiga(`${awal}-akta`)),
  ];
}

/**
 * Kegiatan nyata tiap jabatan. Jabatan yang seluruhnya isian (Koordinator
 * Delegasi, Petugas Informasi) kosong: tidak ada catatan sistem yang dapat
 * dibaca untuknya, dan eviden-nya berasal dari isian bukti pegawai.
 */
export const KEGIATAN_EVIDEN_JABATAN: Readonly<Record<JabatanSkp, readonly KegiatanEviden[]>> = {
  ketua: [
    k("Penetapan majelis hakim (PMH)", "SIPP", ...tiga("pmh")),
    k("Penetapan hari sidang pertama (PHS)", "SIPP", ...tiga("phs")),
  ],
  "wakil-ketua": [
    k("Penetapan majelis hakim (PMH)", "SIPP", ...tiga("pmh")),
    k("Penetapan hari sidang pertama (PHS)", "SIPP", ...tiga("phs")),
  ],
  panitera: [
    k("Penunjukan panitera pengganti dan jurusita pada perkara (penetapan)", "SIPP", ...tiga("pn-penunjukan")),
    k("Kegiatan pengendalian administrasi perkara di aplikasi pengadilan (BAS, blangko, tanda tangan elektronik, disposisi)", "Sistem", "pn-administrasi-kuantitas"),
  ],
  "panmud-hukum": [k("Pengarsipan berkas perkara yang berkekuatan hukum tetap", "SIPP", "ph-arsip-kuantitas", "ph-arsip-kualitas")],
  "panmud-gugatan": kegiatanPanmud("gugatan", "gugatan"),
  "panmud-permohonan": kegiatanPanmud("permohonan", "permohonan"),
  pp: [
    k("Persidangan yang didampingi, berita acara sidang (BAS) terisi, dan hasil sidang diinput ke SIPP", "SIPP", ...tiga("pp-sidang")),
  ],
  jurusita: [
    k("Relaas panggilan dan pemberitahuan yang dilaksanakan (dokumen relaas, panggilan sampai sebelum sidang)", "SIPP", ...tiga("js-relaas")),
    k("Penginputan relaas ke SIPP", "SIPP", ...tiga("js-input")),
  ],
  "jurusita-pengganti": [
    k("Relaas panggilan dan pemberitahuan yang dilaksanakan (dokumen relaas, panggilan sampai sebelum sidang)", "SIPP", ...tiga("js-relaas")),
    k("Penginputan relaas ke SIPP", "SIPP", ...tiga("js-input")),
  ],
  "petugas-meja": [
    k("Minutasi berkas perkara", "SIPP", "mj-minutasi-kuantitas"),
    k("Penerbitan akta cerai setelah putusan berkekuatan hukum tetap", "SIPP", "mj-akta-kuantitas", "mj-akta-waktu"),
    k("Verifikasi dokumen layanan elektronik (e-Court)", "e-Court", "mj-ecourt-kuantitas", "mj-ecourt-kualitas"),
  ],
  kasir: [
    k("Panjar biaya perkara yang diterima (saat pendaftaran)", "SIPP", ...tiga("ks-penerimaan")),
    k("Biaya perkara yang dibebankan dan sisa panjar yang dikembalikan", "SIPP", "ks-biaya-kuantitas", "ks-biaya-kualitas"),
    k("Perkara yang didaftarkan", "SIPP", "ks-pendaftaran-kuantitas"),
  ],
  operator: [
    k("Kegiatan input, ubah, hapus, dan unggah pada SIPP (jejak audit akun)", "SIPP", "op-layanan-kuantitas"),
    k("Kegiatan di e-Court dan aplikasi pendukung (verifikasi, tanda tangan elektronik, unggah salinan)", "Sistem", "op-sistem-kuantitas"),
    k("Berkas e-Court yang berhasil ditandatangani atau diunggah", "e-Court", "op-sistem-kualitas"),
  ],
  "koordinator-delegasi": [],
  informasi: [],
  mediator: [k("Perkara yang ditunjuk untuk dimediasi, laporan hasil mediasi, dan ketepatan pelaporan (PERMA 1/2016 Pasal 24)", "SIPP", ...tiga("md-mediasi"))],
  sekretaris: [
    k("Surat masuk dan surat keluar yang dikelola", "Sistem", "sk-persuratan-kuantitas"),
    k("Disposisi yang diterima, ditindaklanjuti, dan waktu menanggapinya", "Sistem", "sk-persuratan-kualitas", "sk-persuratan-waktu"),
  ],
  kasubag: [
    k("Surat masuk dan surat keluar subbagian yang dikelola", "Sistem", "kb-persuratan-kuantitas"),
    k("Disposisi yang diterima, ditindaklanjuti, dan waktu menanggapinya", "Sistem", "kb-persuratan-kualitas", "kb-persuratan-waktu"),
    k("Permohonan cuti pegawai yang diproses dan lama pemrosesannya", "Sistem", "kb-kepegawaian-kuantitas", "kb-kepegawaian-waktu"),
  ],
  "analis-perkara": [k("Pemantauan indikator dan penilaian kinerja perkara yang dijalankan", "Sistem", "an-analisis-kuantitas")],
};

/** Jabatan yang eviden SKP-nya dapat diunduh lewat jalur ini: semuanya selain pimpinan (SKP Pimpinan punya jalurnya). */
export const JABATAN_EVIDEN_PERAN: readonly JabatanSkp[] = JABATAN_SKP.filter((j) => j !== "ketua" && j !== "wakil-ketua");

/** Sebutan peran untuk pengguna ("Panitera Pengganti", "Mediator", ...). */
export function sebutanJabatanEviden(j: JabatanSkp): string {
  return LABEL_JABATAN_SKP[j];
}

export function kegiatanUntukJabatan(j: JabatanSkp): readonly KegiatanEviden[] {
  return KEGIATAN_EVIDEN_JABATAN[j] ?? [];
}

function semuaIndikator(j: JabatanSkp): DefIndikatorSkp[] {
  return SKP_JABATAN_2026[j].flatMap((r) => r.indikator);
}

/** Butir (indikator) yang didukung sebuah kegiatan nyata di jabatan itu. */
export function butirDariKegiatan(j: JabatanSkp, kegiatan: KegiatanEviden): DefIndikatorSkp[] {
  const ada = new Map(semuaIndikator(j).map((i) => [i.kunci, i]));
  return kegiatan.butir.flatMap((kunci) => {
    const i = ada.get(kunci);
    return i ? [i] : [];
  });
}

/** Kegiatan yang mendukung sebuah butir (kebalikan peta); kosong = butir itu isian manual. */
export function kegiatanUntukButir(j: JabatanSkp, kunciIndikator: string): KegiatanEviden[] {
  return kegiatanUntukJabatan(j).filter((x) => x.butir.includes(kunciIndikator));
}

/**
 * Indikator yang dihitung otomatis (bukan isian) tetapi tidak didukung kegiatan
 * mana pun di peta - harus kosong; dijaga uji supaya peta tidak tertinggal
 * dari katalog.
 */
export function butirOtomatisTanpaKegiatan(j: JabatanSkp): string[] {
  return semuaIndikator(j)
    .filter((i) => i.aturan.jenis !== "isian")
    .filter((i) => kegiatanUntukButir(j, i.kunci).length === 0)
    .map((i) => i.kunci);
}

/** Butir yang tetap isian manual (dengan bukti) bagi jabatan itu. */
export function butirIsianManual(j: JabatanSkp): string[] {
  return semuaIndikator(j)
    .filter((i) => i.aturan.jenis === "isian")
    .map((i) => i.kunci);
}

/**
 * Pegawai yang ditawarkan di daftar unduh eviden: hanya yang aktif. Pejabat
 * mutasi/pensiun (nonaktif) tidak ditawarkan di daftar mana pun.
 */
export function pegawaiDitawarkan<T extends { aktif: boolean }>(daftar: readonly T[]): T[] {
  return daftar.filter((p) => p.aktif);
}
