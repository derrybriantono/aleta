/**
 * ============================================================================
 * PENYUSUN COURT CALENDAR - SATU ATURAN UNTUK PANEL SIPP DAN JADWAL SIDANG
 * ============================================================================
 *
 * Butir 29 (5 Okt 2026, commit 7298ec9) menaruh aturan "Court Calendar
 * otomatis" di ekstensi (ekstensi-sipp/konten.js, ccSusun dan kawan-kawannya):
 * jalur awal / verstek / litigasi / damai / itsbat / dispensasi / permohonan /
 * gugatan sederhana, jarak hari yang DIUKUR di sipp_donggala, libur 2026, jam
 * sore untuk jawab-menjawab dan kesimpulan. Seluruh sebab angkanya tertulis di
 * sana (blok "POLANYA DIUKUR, BUKAN DIKARANG") dan tidak diulang di sini.
 *
 * Permintaan 6 Okt 2026 (butir 3): Court Calendar dapat disusun dari Jadwal
 * Sidang portal juga, "berdasarkan rekomendasi aleta yang sudah dibuat". Yang
 * dipakai karena itu ATURAN YANG SAMA - bukan aturan kedua yang disusun ulang.
 *
 * ============================================================================
 * MENGAPA BERKAS INI SALINAN, DAN MENGAPA SALINAN INI TIDAK DAPAT MELENCENG
 * ============================================================================
 *
 * konten.js skrip isi Chrome biasa (bukan modul): ia tidak dapat mengimpor
 * berkas portal, dan memecahnya ke berkas bersama berarti mengubah daftar
 * content_scripts di manifest.json - yang hanya boleh berubah saat rilis
 * ekstensi. Karena itu fungsi murninya disalin ke sini SATU-SATU (nama cc*
 * sengaja dipertahankan supaya pasangannya mudah dicari), dan uji
 * src/test/court-calendar-sidang.test.ts MENJALANKAN konten.js yang asli lalu
 * mengadu keduanya atas matriks perkara (seluruh jalur, libur, baris yang sudah
 * ada, sidang yang belum tercatat, tahap terjauh) - termasuk seluruh tetapannya.
 * Satu angka berubah di salah satu sisi tanpa sisi lainnya = uji merah.
 *
 * Bila kelak manifest dibuka untuk berkas bersama, konten.js cukup memuat
 * terjemahan JS berkas ini dan pasangan di konten.js dihapus.
 */

import { HARI_TUNDA_MEDIASI, JAM_PAGI, JAM_SORE, jamSidangBerikut } from "@/lib/bawaan-tunda";

// ─── Tetapan - persis konten.js ──────────────────────────────────────────────

/** Hari libur nasional & cuti bersama. 2026 cocok dengan hari kerja tanpa satu pun sidang di sipp_donggala. */
export const CC_LIBUR: Readonly<Record<string, string>> = {
  "2026-01-01": "Tahun Baru Masehi",
  "2026-01-16": "Isra Mikraj",
  "2026-02-16": "cuti bersama Tahun Baru Imlek",
  "2026-02-17": "Tahun Baru Imlek",
  "2026-03-18": "cuti bersama Nyepi",
  "2026-03-19": "Hari Suci Nyepi",
  "2026-03-20": "cuti bersama Idul Fitri",
  "2026-03-21": "Idul Fitri",
  "2026-03-22": "Idul Fitri",
  "2026-03-23": "cuti bersama Idul Fitri",
  "2026-03-24": "cuti bersama Idul Fitri",
  "2026-04-03": "Wafat Isa Almasih",
  "2026-05-01": "Hari Buruh",
  "2026-05-14": "Kenaikan Isa Almasih",
  "2026-05-15": "cuti bersama Kenaikan Isa Almasih",
  "2026-05-27": "Idul Adha",
  "2026-05-28": "cuti bersama Idul Adha",
  "2026-05-31": "Waisak",
  "2026-06-01": "Hari Lahir Pancasila",
  "2026-06-16": "Tahun Baru Islam",
  "2026-08-17": "Hari Kemerdekaan",
  "2026-08-25": "Maulid Nabi",
  "2026-12-24": "cuti bersama Natal",
  "2026-12-25": "Natal",
  // 2027: hanya yang tanggalnya pasti - lihat konten.js.
  "2027-01-01": "Tahun Baru Masehi",
  "2027-03-26": "Wafat Isa Almasih",
  "2027-05-01": "Hari Buruh",
  "2027-05-06": "Kenaikan Isa Almasih",
  "2027-06-01": "Hari Lahir Pancasila",
  "2027-08-17": "Hari Kemerdekaan",
  "2027-12-25": "Natal",
};
export const CC_LIBUR_TAHUN_LENGKAP: readonly string[] = ["2026"];

export type GolonganCc = "cerai-gugat" | "cerai-talak" | "gugatan" | "itsbat" | "dispensasi" | "permohonan" | "sederhana";

/** Pendaftaran -> sidang pertama (median terukur) bila PHS belum ada. */
export const CC_HARI_DAFTAR: Readonly<Record<GolonganCc, number>> = {
  "cerai-gugat": 13,
  "cerai-talak": 13,
  gugatan: 13,
  itsbat: 21,
  dispensasi: 10,
  permohonan: 12,
  sederhana: 13,
};

/** Jarak (hari kalender) dari sidang sebelumnya - median terukur, kecuali laporanMediasi (aturan tunda 21). */
export const CC_HARI = {
  pokok: 14,
  laporanMediasi: HARI_TUNDA_MEDIASI,
  jawaban: 3,
  replik: 4,
  duplik: 3,
  pembuktianPertama: 5,
  pembuktianKedua: 7,
  kesimpulan: 2,
  putusan: 6,
  verstek: 14,
  damai: 7,
  ikrar: 35,
  langkahPermohonan: 7,
  langkahSederhana: 7,
} as const;

export const CC_JAM_PAGI: string = JAM_PAGI;
export const CC_JAM_SORE: string = JAM_SORE;
/** Sama dengan TAHAP_SORE di @/lib/bawaan-tunda (dijaga uji lewat jamSidangBerikut). */
export const CC_TAHAP_SORE: readonly string[] = ["jawaban", "replik", "duplik", "kesimpulan"];

export type TahapCc =
  | "lain"
  | "pertama"
  | "mediasi"
  | "laporan-mediasi"
  | "pokok"
  | "jawaban"
  | "replik"
  | "duplik"
  | "pembuktian-pertama"
  | "pembuktian-kedua"
  | "kesimpulan"
  | "putusan"
  | "ikrar";

/** Urutan tahap acara gugatan - yang lebih jauh tidak direncanakan ulang. */
export const CC_URUT: Readonly<Record<TahapCc, number>> = {
  lain: 0,
  pertama: 0,
  mediasi: 1,
  "laporan-mediasi": 2,
  pokok: 2,
  jawaban: 3,
  replik: 4,
  duplik: 5,
  "pembuktian-pertama": 6,
  "pembuktian-kedua": 7,
  kesimpulan: 8,
  putusan: 9,
  ikrar: 10,
};

const CC_NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const CC_NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type JalurCc =
  | "awal"
  | "verstek"
  | "damai"
  | "litigasi"
  | "itsbat-awal"
  | "itsbat"
  | "dispensasi"
  | "permohonan"
  | "sederhana";

export const CC_PENJELASAN: Readonly<Record<JalurCc, string>> = {
  awal:
    "Belum ada sidang tercatat: sidang pertama, lalu pemeriksaan pokok perkara 14 hari kemudian - pola Court Calendar terbanyak yang disusun di awal (median 2 baris; jarak median 14 hari).",
  verstek:
    "Pihak kedua belum pernah hadir: satu sidang lagi 14 hari sesudahnya untuk pembacaan gugatan, pembuktian, dan putusan verstek (perkara verstek median 2 sidang).",
  damai: "Mediasi berhasil: tinggal musyawarah dan pembacaan putusan/penetapan sepekan kemudian.",
  litigasi:
    "Kedua pihak pernah hadir: laporan mediasi 21 hari (aturan tunda mediasi), lalu jawab-menjawab e-Litigasi 3-4 hari sekali pukul 15.00, pembuktian, kesimpulan, dan putusan (jarak median terukur).",
  "itsbat-awal": "Itsbat (permohonan): median 1 sidang - pemeriksaan, pembuktian, dan penetapan dibacakan pada hari yang sama.",
  itsbat: "Itsbat (permohonan) yang sudah bersidang: pembuktian dan penetapan sepekan kemudian.",
  dispensasi: "Dispensasi kawin: pemeriksaan dan pembuktian pada sidang pertama, penetapan sepekan kemudian (median 7 hari).",
  permohonan: "Permohonan: sidang pertama, pembuktian, lalu penetapan - sepekan sekali (median 7 hari).",
  sederhana:
    "Gugatan sederhana: PERMA 2/2015 jo. 4/2019, selesai paling lama 25 hari kerja - sidang pertama dan perdamaian, jawaban, pembuktian, putusan sepekan sekali. Tidak ada data satker untuk diukur.",
};

// ─── Tanggal ─────────────────────────────────────────────────────────────────

export function ccIsoSah(iso: unknown): iso is string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""));
}

export function ccTambahHari(iso: string, hari: number): string {
  if (!ccIsoSah(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + hari)).toISOString().slice(0, 10);
}

export function ccHariKe(iso: string): number {
  if (!ccIsoSah(iso)) return -1;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Sebab tanggal ini bukan hari sidang ("" = hari kerja). */
export function ccBukanHariKerja(iso: string): string {
  const h = ccHariKe(iso);
  if (h === 0 || h === 6) return h === 0 ? "hari Minggu" : "hari Sabtu";
  return CC_LIBUR[iso] ? `libur: ${CC_LIBUR[iso]}` : "";
}

/** Maju ke hari kerja pertama pada atau sesudah iso. */
export function ccMajuHariKerja(iso: string): string {
  let t = iso;
  for (let i = 0; i < 30 && t && ccBukanHariKerja(t); i += 1) t = ccTambahHari(t, 1);
  return t;
}

/** "Selasa, 13 Okt 2026". */
export function ccTeksTanggal(iso: string): string {
  if (!ccIsoSah(iso)) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  return `${CC_NAMA_HARI[ccHariKe(iso)]}, ${String(d).padStart(2, "0")} ${CC_NAMA_BULAN[m - 1]} ${y}`;
}

export function ccJamSah(jam: unknown): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(jam || ""));
}

// ─── Golongan, sebutan, tahap, rantai ────────────────────────────────────────

export function ccGolongan(jenis: unknown, nomor: unknown): GolonganCc {
  const j = String(jenis || "").toLowerCase();
  const n = String(nomor || "");
  if (/\/Pdt\.G\.S\//i.test(n)) return "sederhana";
  if (/\/Pdt\.P\//i.test(n)) {
    if (/istbat|itsbat|isbat|pengesahan perkawinan/.test(j)) return "itsbat";
    if (/dispensasi/.test(j)) return "dispensasi";
    return "permohonan";
  }
  if (/cerai talak/.test(j)) return "cerai-talak";
  if (/cerai gugat/.test(j)) return "cerai-gugat";
  return "gugatan";
}

export type SebutanCc = { satu: string; dua: string };

export function ccSebutan(golongan: GolonganCc, jenis: unknown): SebutanCc {
  if (golongan === "itsbat" || golongan === "dispensasi" || golongan === "permohonan") return { satu: "Pemohon", dua: "" };
  if (golongan === "cerai-talak" || /izin poligami/i.test(String(jenis || ""))) return { satu: "Pemohon", dua: "Termohon" };
  return { satu: "Penggugat", dua: "Tergugat" };
}

/** Tahap acara menurut kalimat agenda - kata kunci, sebab agenda SIPP ditulis bebas. */
export function ccTahap(agenda: unknown): TahapCc {
  const t = String(agenda || "").toLowerCase();
  if (/ikrar/.test(t)) return "ikrar";
  if (/musyawarah|putus|penetapan/.test(t)) return "putusan";
  if (/kesimpulan/.test(t)) return "kesimpulan";
  if (/duplik/.test(t)) return "duplik";
  if (/replik/.test(t)) return "replik";
  if (/jawab/.test(t)) return "jawaban";
  if (/pembuktian|bukti|saksi/.test(t)) return /tergugat|termohon|pihak kedua/.test(t) ? "pembuktian-kedua" : "pembuktian-pertama";
  if (/laporan (hasil )?mediasi|hasil mediasi/.test(t)) return "laporan-mediasi";
  if (/mediasi|damai/.test(t)) return "mediasi";
  if (/pembacaan (surat )?(gugatan|permohonan)|pokok perkara/.test(t)) return "pokok";
  if (/identitas|pertama|panggil|penasihatan|penasehatan/.test(t)) return "pertama";
  return "lain";
}

type LangkahCc = { tahap: TahapCc; agenda: string; hari: number; ket?: string; elitigasi?: boolean };

export function ccRantai(jalur: JalurCc, golongan: GolonganCc, s: SebutanCc): LangkahCc[] {
  const satu = s.satu;
  const dua = s.dua || "Tergugat";
  const pertama: LangkahCc = { tahap: "pertama", agenda: "Sidang Pertama, Pemeriksaan Identitas, Penasihatan", hari: 0 };
  const ikrar: LangkahCc[] = golongan === "cerai-talak" ? [{ tahap: "ikrar", agenda: "Sidang Ikrar Talak", hari: CC_HARI.ikrar }] : [];
  if (jalur === "awal") return [pertama, { tahap: "pokok", agenda: "Pemeriksaan Pokok Perkara", hari: CC_HARI.pokok }];
  if (jalur === "verstek") {
    return [
      pertama,
      { tahap: "putusan", agenda: `Pembacaan Gugatan, Pembuktian ${satu}, Musyawarah Majelis dan Pembacaan Putusan`, hari: CC_HARI.verstek },
      ...ikrar,
    ];
  }
  if (jalur === "damai") {
    return [pertama, { tahap: "putusan", agenda: "Musyawarah Majelis dan Pembacaan Putusan", hari: CC_HARI.damai, ket: "mediasi berhasil" }];
  }
  if (jalur === "litigasi") {
    return [
      pertama,
      { tahap: "laporan-mediasi", agenda: "Mendengar Laporan Hasil Mediasi", hari: CC_HARI.laporanMediasi },
      { tahap: "jawaban", agenda: `Jawaban ${dua}`, hari: CC_HARI.jawaban, elitigasi: true },
      { tahap: "replik", agenda: `Replik ${satu}`, hari: CC_HARI.replik, elitigasi: true },
      { tahap: "duplik", agenda: `Duplik ${dua}`, hari: CC_HARI.duplik, elitigasi: true },
      { tahap: "pembuktian-pertama", agenda: `Pembuktian ${satu}`, hari: CC_HARI.pembuktianPertama },
      { tahap: "pembuktian-kedua", agenda: `Pembuktian ${dua}`, hari: CC_HARI.pembuktianKedua },
      { tahap: "kesimpulan", agenda: `Kesimpulan ${satu} dan ${dua}`, hari: CC_HARI.kesimpulan, elitigasi: true },
      { tahap: "putusan", agenda: "Musyawarah Majelis dan Pembacaan Putusan", hari: CC_HARI.putusan, elitigasi: true },
      ...ikrar,
    ];
  }
  if (jalur === "itsbat-awal") {
    return [{ tahap: "putusan", agenda: "Sidang Pertama, Pemeriksaan Identitas, Pembacaan Permohonan, Pembuktian dan Pembacaan Penetapan", hari: 0 }];
  }
  if (jalur === "itsbat") {
    return [
      { tahap: "pertama", agenda: "Sidang Pertama, Pemeriksaan Identitas dan Pembacaan Permohonan", hari: 0 },
      { tahap: "putusan", agenda: `Pembuktian ${satu}, Kesimpulan dan Pembacaan Penetapan`, hari: CC_HARI.langkahPermohonan },
    ];
  }
  if (jalur === "dispensasi") {
    return [
      { tahap: "pembuktian-pertama", agenda: "Sidang Pertama, Pemeriksaan Identitas, Penasihatan, Pemeriksaan Pokok Perkara dan Pembuktian", hari: 0 },
      { tahap: "putusan", agenda: "Musyawarah Majelis dan Pembacaan Penetapan", hari: CC_HARI.langkahPermohonan },
    ];
  }
  if (jalur === "permohonan") {
    return [
      { tahap: "pertama", agenda: "Sidang Pertama, Pemeriksaan Identitas dan Pembacaan Permohonan", hari: 0 },
      { tahap: "pembuktian-pertama", agenda: `Pembuktian ${satu}`, hari: CC_HARI.langkahPermohonan },
      { tahap: "putusan", agenda: "Musyawarah Majelis dan Pembacaan Penetapan", hari: CC_HARI.langkahPermohonan },
    ];
  }
  return [
    { tahap: "pertama", agenda: "Sidang Pertama dan Upaya Perdamaian", hari: 0 },
    { tahap: "jawaban", agenda: `Jawaban ${dua}`, hari: CC_HARI.langkahSederhana },
    { tahap: "pembuktian-pertama", agenda: "Pembuktian", hari: CC_HARI.langkahSederhana },
    { tahap: "putusan", agenda: "Pembacaan Putusan", hari: CC_HARI.langkahSederhana },
  ];
}

// ─── Penyusun ────────────────────────────────────────────────────────────────

export type BarisKalenderAda = { tanggal: string; jam: string; agenda: string; keterangan: string };

export type MasukanCc = {
  nomorPerkara?: string;
  jenisPerkara?: string;
  tanggalDaftar?: string;
  sidangPertama?: string;
  hariIni?: string;
  jadwal?: Array<{ tanggal?: string; tanggalSidang?: string; jam?: string; jamSidang?: string; agenda?: string; dihadiriOleh?: unknown }>;
  /** null = Court Calendar SIPP belum terbaca. */
  kalender?: Array<Partial<BarisKalenderAda>> | null;
  mediasi?: { baris?: Array<{ berhasil?: unknown }> } | null;
  ecourt?: boolean;
  sudahPutus?: boolean;
  sudahIkrar?: boolean;
};

export type AsalBarisCc = "rencana" | "terjadwal" | "riwayat";

export type BarisSusunanCc = {
  agenda: string;
  tanggal: string;
  jam: string;
  keterangan: string;
  tahap: TahapCc;
  asal: AsalBarisCc;
  pilih: boolean;
  catatan: string;
};

export type HasilSusunCc = {
  golongan: GolonganCc;
  jalur: JalurCc;
  sebutan: SebutanCc;
  baris: BarisSusunanCc[];
  sudahAda: BarisKalenderAda[];
  catatan: string[];
  penjelasan: string;
};

const urutTanggal = (a: { tanggal: string }, b: { tanggal: string }) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : 0);

/** Menyusun Court Calendar - fungsi murni (pasangan ccSusun di konten.js). */
export function ccSusun(m: MasukanCc | null | undefined): HasilSusunCc {
  const o: MasukanCc = m && typeof m === "object" ? m : {};
  const hariIni = ccIsoSah(o.hariIni) ? o.hariIni : new Date().toISOString().slice(0, 10);
  const golongan = ccGolongan(o.jenisPerkara, o.nomorPerkara);
  const sebutan = ccSebutan(golongan, o.jenisPerkara);
  const catatan: string[] = [];

  const sidang = (Array.isArray(o.jadwal) ? o.jadwal : [])
    .map((x) => ({
      tanggal: String((x && (x.tanggal || x.tanggalSidang)) || "").slice(0, 10),
      jam: String((x && (x.jam || x.jamSidang)) || "").slice(0, 5),
      agenda: String((x && x.agenda) || "").trim(),
      dihadiri: x && x.dihadiriOleh !== null && x.dihadiriOleh !== undefined && x.dihadiriOleh !== "" ? Number(x.dihadiriOleh) : null,
    }))
    .filter((x) => ccIsoSah(x.tanggal))
    .sort(urutTanggal);
  const kalenderTerbaca = Array.isArray(o.kalender);
  const sudahAda: BarisKalenderAda[] = (kalenderTerbaca ? (o.kalender as Array<Partial<BarisKalenderAda>>) : [])
    .map((x) => ({
      tanggal: String((x && x.tanggal) || "").slice(0, 10),
      jam: String((x && x.jam) || "").slice(0, 5),
      agenda: String((x && x.agenda) || "").trim(),
      keterangan: String((x && x.keterangan) || "").trim(),
    }))
    .filter((x) => ccIsoSah(x.tanggal))
    .sort(urutTanggal);
  if (!kalenderTerbaca) catatan.push("Court Calendar SIPP belum terbaca - baris yang sudah ada tidak dapat dipastikan.");
  const tanggalAda = new Set(sudahAda.map((x) => x.tanggal));

  const sidangBiasa = sidang.filter((x) => ccTahap(x.agenda) !== "ikrar");
  const kehadiranTercatat = sidangBiasa.some((x) => x.dihadiri !== null && [1, 2, 3, 4].includes(x.dihadiri));
  const pihakKeduaPernah = sidangBiasa.some((x) => x.dihadiri === 1 || x.dihadiri === 3);
  const med =
    o.mediasi && Array.isArray(o.mediasi.baris) && o.mediasi.baris.length ? o.mediasi.baris[o.mediasi.baris.length - 1] : null;
  const mediasiBerhasil = Boolean(med && med.berhasil === true);

  let jalur: JalurCc;
  if (golongan === "itsbat") jalur = sidangBiasa.length ? "itsbat" : "itsbat-awal";
  else if (golongan === "dispensasi" || golongan === "permohonan" || golongan === "sederhana") jalur = golongan;
  else if (mediasiBerhasil) jalur = "damai";
  else if (!sidangBiasa.length || !kehadiranTercatat) jalur = "awal";
  else if (pihakKeduaPernah) jalur = "litigasi";
  else jalur = "verstek";

  let terjauh = -1;
  for (const x of [...sidang, ...sudahAda]) terjauh = Math.max(terjauh, CC_URUT[ccTahap(x.agenda)] ?? 0);
  if (o.sudahPutus === true) terjauh = Math.max(terjauh, CC_URUT.putusan);
  if (o.sudahIkrar === true) terjauh = Math.max(terjauh, CC_URUT.ikrar);

  let jangkar = "";
  for (const x of [...sidang, ...sudahAda]) if (x.tanggal > jangkar) jangkar = x.tanggal;

  const rantai = ccRantai(jalur, golongan, sebutan);
  const sisa = rantai.filter((x) => (CC_URUT[x.tahap] ?? 0) > terjauh && !(jangkar && x.hari === 0));
  if (terjauh >= CC_URUT.putusan && !sisa.length) {
    catatan.push("Sidang atau rencana perkara ini sudah sampai putusan - tidak ada sidang lagi untuk direncanakan.");
  }

  const baris: BarisSusunanCc[] = [];
  let sebelumnya = jangkar;
  for (let i = 0; i < sisa.length; i += 1) {
    const langkah = sisa[i];
    let tanggal: string;
    let catatanBaris = "";
    if (!sebelumnya) {
      if (ccIsoSah(o.sidangPertama)) tanggal = o.sidangPertama;
      else if (ccIsoSah(o.tanggalDaftar)) {
        tanggal = ccMajuHariKerja(ccTambahHari(o.tanggalDaftar, CC_HARI_DAFTAR[golongan] || 13));
        catatanBaris = `perkiraan: PHS belum ada, ${CC_HARI_DAFTAR[golongan] || 13} hari sesudah pendaftaran (median)`;
      } else {
        tanggal = ccMajuHariKerja(ccTambahHari(hariIni, 7));
        catatanBaris = "perkiraan: tanggal pendaftaran dan PHS tidak terbaca";
      }
    } else {
      tanggal = ccTambahHari(sebelumnya, langkah.hari || 7);
      if (i === 0 && tanggal < hariIni) {
        const batas = ccTambahHari(hariIni, 3);
        while (tanggal < batas) tanggal = ccTambahHari(tanggal, 7);
        catatanBaris = "digeser ke depan: jarak bakunya sudah lewat";
      }
      tanggal = ccMajuHariKerja(tanggal);
    }
    const ecourtLitigasi = o.ecourt === true && jalur === "litigasi" && langkah.elitigasi === true;
    const ada = tanggalAda.has(tanggal);
    if (tanggal < hariIni) catatanBaris = catatanBaris ? `${catatanBaris}; tanggal sudah lewat` : "tanggal sudah lewat";
    baris.push({
      agenda: langkah.agenda,
      tanggal,
      jam: CC_TAHAP_SORE.includes(langkah.tahap) ? CC_JAM_SORE : CC_JAM_PAGI,
      keterangan: langkah.ket || (ecourtLitigasi ? "Elitigasi" : ""),
      tahap: langkah.tahap,
      asal: "rencana",
      pilih: !ada,
      catatan: ada ? "tanggal ini sudah ada di Court Calendar SIPP" : catatanBaris,
    });
    sebelumnya = tanggal;
  }

  for (const x of sidang) {
    if (tanggalAda.has(x.tanggal)) continue;
    const mendatang = x.tanggal >= hariIni;
    baris.push({
      agenda: x.agenda || "Sidang",
      tanggal: x.tanggal,
      jam: ccJamSah(x.jam) ? x.jam : CC_JAM_PAGI,
      keterangan: "",
      tahap: ccTahap(x.agenda),
      asal: mendatang ? "terjadwal" : "riwayat",
      pilih: mendatang,
      catatan: mendatang ? "sidang sudah terjadwal, belum ada di Court Calendar" : "sidang lampau - dicentang bila ingin dicatat menyusul",
    });
  }
  baris.sort(urutTanggal);

  if (!sisa.length && !baris.length) catatan.push("Court Calendar SIPP sudah memuat seluruh rencana untuk keadaan perkara ini.");
  const tahunTerpakai = new Set(baris.map((x) => x.tanggal.slice(0, 4)));
  for (const th of tahunTerpakai) {
    if (!CC_LIBUR_TAHUN_LENGKAP.includes(th)) {
      catatan.push(`Libur keagamaan ${th} (Hijriah, Imlek, Nyepi, Waisak) belum dimuat - periksa tanggal ${th} terhadap SKB libur nasional.`);
    }
  }
  return { golongan, jalur, sebutan, baris, sudahAda, catatan, penjelasan: CC_PENJELASAN[jalur] || "" };
}

/** Normal untuk membandingkan baris: tanggal|jam|agenda huruf kecil berspasi tunggal. */
export function ccKunciBaris(x: { tanggal?: string; jam?: string; agenda?: string } | null | undefined): string {
  return `${String((x && x.tanggal) || "")}|${String((x && x.jam) || "").slice(0, 5)}|${String((x && x.agenda) || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()}`;
}

/** Pemeriksaan sebelum dikirim - pengesahan SIPP yang sama (validateInput/validateEdit). */
export function ccPeriksaBaris(b: { agenda?: string; tanggal?: string; jam?: string }, tanggalDaftar?: string): string {
  if (!String(b.agenda || "").trim()) return "agenda wajib diisi";
  if (!ccIsoSah(b.tanggal)) return "tanggal wajib diisi";
  if (!ccJamSah(b.jam)) return "jam wajib diisi (JJ:MM)";
  const h = ccHariKe(b.tanggal);
  if (h === 0 || h === 6) return "SIPP menolak Sabtu dan Minggu";
  if (ccIsoSah(tanggalDaftar) && b.tanggal < tanggalDaftar) return "sebelum tanggal pendaftaran - SIPP menolak";
  return "";
}

// ─── Bahan dari keadaan perkara (bot) - pasangan ccMasukan di konten.js ──────

/** Bentuk status perkara bot (sippStatusPerkaraService) yang dibaca penyusun. */
export type StatusPerkaraCc = {
  tahapan?: { tahap?: Array<{ kunci?: string; tanggal?: string | null } | null>; sidangPertama?: string | null } | null;
  identitasPihak?: { jenisPerkara?: string; jenisPerkaraLengkap?: string } | null;
  jadwal?: Array<{ tanggalSidang?: string; tanggal?: string; jamSidang?: string; jam?: string; agenda?: string; dihadiriOleh?: unknown }> | null;
  mediasi?: { baris?: Array<{ berhasil?: unknown }> } | null;
  lewatEcourt?: boolean;
  putusan?: { sudahPutus?: boolean } | null;
  ikrarTalak?: { ada?: boolean } | null;
  courtCalendar?: { terbaca?: boolean; baris?: Array<Partial<BarisKalenderAda>> } | null;
};

export function ccMasukan(
  status: StatusPerkaraCc | null | undefined,
  konteks: { nomorPerkara?: string; identitas?: { jenisPerkara?: string; jenisPerkaraLengkap?: string } | null } | null,
  kalender: Array<Partial<BarisKalenderAda>> | null,
  hariIni: string
): MasukanCc {
  const s: StatusPerkaraCc = status || {};
  const tahap = s.tahapan && Array.isArray(s.tahapan.tahap) ? s.tahapan.tahap : [];
  const daftar = tahap.find((x) => x && x.kunci === "pendaftaran")?.tanggal || "";
  const identitas: { jenisPerkara?: string; jenisPerkaraLengkap?: string } =
    (konteks && konteks.identitas) || s.identitasPihak || {};
  return {
    nomorPerkara: (konteks && konteks.nomorPerkara) || "",
    jenisPerkara: String(identitas.jenisPerkara || identitas.jenisPerkaraLengkap || ""),
    tanggalDaftar: String(daftar).slice(0, 10),
    sidangPertama: String((s.tahapan && s.tahapan.sidangPertama) || "").slice(0, 10),
    jadwal: (Array.isArray(s.jadwal) ? s.jadwal : []).map((j) => ({
      tanggal: j.tanggalSidang || j.tanggal,
      jam: j.jamSidang || j.jam,
      agenda: j.agenda,
      dihadiriOleh: j.dihadiriOleh,
    })),
    kalender,
    mediasi: s.mediasi || null,
    ecourt: s.lewatEcourt === true,
    sudahPutus: Boolean(s.putusan && s.putusan.sudahPutus),
    sudahIkrar: Boolean(s.ikrarTalak && s.ikrarTalak.ada),
    hariIni,
  };
}

/** Baris manual baru - sama dengan tombol "+ Tambah baris" panel: sepekan sesudah baris terakhir, hari kerja, 09:00. */
export function ccBarisTambahan(tanggalTerakhir: string, hariIni: string): BarisSusunanCc {
  const dasar = ccIsoSah(tanggalTerakhir) ? tanggalTerakhir : hariIni;
  return {
    agenda: "",
    tanggal: ccIsoSah(dasar) ? ccMajuHariKerja(ccTambahHari(dasar, 7)) : "",
    jam: CC_JAM_PAGI,
    keterangan: "",
    tahap: "lain",
    asal: "rencana",
    pilih: true,
    catatan: "baris tambahan",
  };
}

/** Jam sore ditentukan aturan yang sama dengan borang tunda - dipakai uji penjaga. */
export function ccJamMenurutBawaanTunda(agenda: string): string {
  return jamSidangBerikut(agenda);
}
