/**
 * ============================================================================
 * PENCOCOK DATA SIPP - ABT - e-COURT (N3, 1 Nov 2026) - MESIN ATURAN MURNI
 * ============================================================================
 *
 * Satu perkara punya jejak di tiga sistem yang masing-masing diketik/ditarik orang atau mesin yang berbeda.
 * Mesin ini membandingkan FAKTA yang dibacakan bot (aleta_bot/services/pencocokFaktaService.js) dan
 * menyebut yang BERBEDA - tanpa AI, tanpa menebak mana yang benar.
 *
 *   HANYA MENANDAI. Tidak ada satu pun aturan di sini yang menulis ke SIPP, ABT, atau e-Court; perbaikan tetap
 *   lewat tombol yang sudah ada (mis. "Betulkan kehadiran" di panel Blangko Derry), yang disebut di `saran`.
 *
 * Yang SENGAJA tidak diperbuat ulang di sini (sudah ada, dipakai/diperluas):
 *   - putusan SIPP vs ISI dokumen putusan  -> lib/cocok-putusan.ts (hasilnya diikutkan lewat `cocokPutusan`)
 *   - Court Calendar vs agenda sidang      -> lib/court-calendar-sinkron.ts (dipakai apa adanya)
 *   - arti sandi kehadiran                 -> lib/sandi-kehadiran.ts (dipakai apa adanya)
 *
 * Prinsip: HEMAT PERINGATAN PALSU. Sumber yang tidak terbaca (`terbaca.x === false`) = aturan terkait DIAM, bukan
 * menuduh beda. Tiap temuan membawa `sidik` (sidik isi) supaya penyimpanan hanya menulis yang berubah.
 */

import { keadaanCourtCalendar, type BarisCourtCalendar } from "@/lib/court-calendar-sinkron";
import { tergugatHadirSandi } from "@/lib/sandi-kehadiran";

// ============================================================================
// BENTUK
// ============================================================================

export type Tingkat = "tinggi" | "sedang" | "rendah";
export type Kelompok = "putusan" | "kehadiran" | "pihak" | "majelis" | "sidang" | "dokumen" | "biaya" | "tahapan";

export type JenisInfo = {
  kode: string;
  kelompok: Kelompok;
  judul: string;
  tingkat: Tingkat;
  /** Sistem yang dibandingkan, untuk label di layar. */
  sumber: string;
  /** Apa yang dikerjakan manusia - TIDAK ada tombol tulis di Pencocok. */
  saran: string;
};

export const KELOMPOK_JUDUL: Record<Kelompok, string> = {
  putusan: "Putusan",
  kehadiran: "Kehadiran sidang",
  pihak: "Pihak dan kuasa",
  majelis: "Majelis dan panitera pengganti",
  sidang: "Jadwal dan agenda sidang",
  dokumen: "Dokumen e-Court",
  biaya: "Biaya perkara",
  tahapan: "Tahapan perkara",
};

const I = (kode: string, kelompok: Kelompok, tingkat: Tingkat, sumber: string, judul: string, saran: string): JenisInfo => ({ kode, kelompok, tingkat, sumber, judul, saran });

export const KATALOG_JENIS: readonly JenisInfo[] = [
  I("putus-tanggal-abt", "putusan", "tinggi", "SIPP - ABT", "Tanggal putus SIPP berbeda dengan register ABT", "Periksa tanggal putusan di perkara SIPP, lalu samakan register di ABT."),
  I("putus-ecourt-tanggal", "putusan", "tinggi", "SIPP - e-Court", "Tanggal putus SIPP berbeda dengan tab putusan e-Court", "Periksa tanggal putusan di SIPP dan di e-Court; yang keliru dibetulkan di sistemnya."),
  I("putus-dokumen", "putusan", "sedang", "SIPP - dokumen putusan", "Amar atau tanggal putusan SIPP berbeda dengan dokumen putusan", "Buka panel cetak Blangko Derry perkara ini; rincian bedanya ada di peringatan putusan."),
  I("putus-status-abt", "putusan", "rendah", "SIPP - ABT", "Status putusan SIPP berbeda dengan register ABT", "Tinjau status putusan; sebagian register lama memakai kode status yang berbeda."),
  I("putus-belum-abt", "putusan", "rendah", "SIPP - ABT", "Sudah putus di SIPP, register putusan ABT belum ada", "Validasi register putusan di ABT."),
  I("putus-tanpa-sidang", "putusan", "rendah", "SIPP", "Tanggal putus tidak jatuh pada tanggal sidang mana pun", "Periksa tanggal putusan atau tanggal sidang pembacaan putusan."),
  I("sidang-setelah-putus", "putusan", "rendah", "SIPP", "Ada sidang sesudah tanggal putus (bukan ikrar)", "Periksa tanggal putusan atau jadwal sidang yang tercatat sesudahnya."),
  I("minutasi-abt", "putusan", "rendah", "SIPP - ABT", "Tanggal minutasi SIPP berbeda dengan register ABT", "Samakan tanggal minutasi."),
  I("akta-abt", "putusan", "rendah", "SIPP - ABT", "Tanggal akta cerai SIPP berbeda dengan register ABT", "Samakan tanggal akta cerai."),
  I("daftar-abt", "putusan", "sedang", "SIPP - ABT", "Nomor, tanggal daftar, atau jenis perkara berbeda dengan register ABT", "Periksa data pendaftaran di SIPP dan register ABT."),
  I("hadir-verstek", "kehadiran", "tinggi", "SIPP", "Putusan verstek tetapi SIPP mencatat Tergugat hadir", "Pakai tombol Betulkan kehadiran di panel cetak Blangko Derry (atas klik panitera pengganti)."),
  I("hadir-kosong", "kehadiran", "sedang", "SIPP", "Sidang yang sudah lewat belum diisi kehadirannya", "Isi kehadiran sidang di SIPP, atau pakai Betulkan kehadiran bila BAS sudah ada."),
  I("pihak-abt", "pihak", "rendah", "SIPP - ABT", "Nama pihak di SIPP tidak ada pada data pihak di register ABT", "Periksa ejaan nama pihak di SIPP dan di ABT."),
  I("kuasa-ecourt", "pihak", "sedang", "e-Court - SIPP", "Kuasa hukum di e-Court belum tercatat di SIPP", "Catat kuasa hukum (surat kuasa) di perkara SIPP."),
  I("pihak-nik", "pihak", "tinggi", "SIPP - KTP", "NIK pihak di SIPP berbeda dengan NIK pada KTP yang diunggah", "Periksa KTP pihak; ubah NIK di SIPP bila KTP yang benar."),
  I("pihak-nik-kosong", "pihak", "sedang", "SIPP - KTP", "KTP terbaca tetapi NIK pihak di SIPP kosong", "Isi NIK pihak di SIPP dari KTP."),
  I("majelis-penetapan", "majelis", "sedang", "SIPP", "Majelis hakim aktif berbeda dengan teks penetapan majelis", "Periksa penetapan majelis hakim dan riwayat penggantian di SIPP."),
  I("pp-penetapan", "majelis", "sedang", "SIPP", "Panitera pengganti aktif berbeda dengan teks penetapan", "Periksa penetapan panitera pengganti di SIPP."),
  I("majelis-kosong", "majelis", "sedang", "SIPP", "Sudah ada sidang tetapi majelis hakim aktif kosong", "Periksa penetapan majelis hakim di SIPP."),
  I("calendar-sinkron", "sidang", "sedang", "SIPP - Court Calendar", "Sidang tidak sinkron dengan Court Calendar e-Court", "Buat atau samakan Court Calendar lewat menu Court Calendar di panel."),
  I("tahapan-belum-putus", "tahapan", "tinggi", "SIPP", "Tahapan terakhir menyebut putusan padahal belum ada putusan", "Periksa tahapan terakhir dan data putusan perkara di SIPP."),
  I("tahapan-sudah-putus", "tahapan", "tinggi", "SIPP", "Sudah putus tetapi tahapan terakhir masih sebelum putusan", "Periksa tahapan terakhir perkara di SIPP."),
  I("tahapan-akta", "tahapan", "rendah", "SIPP", "Akta cerai sudah terbit tetapi tahapan terakhir masih Putusan", "Periksa tahapan terakhir perkara di SIPP."),
  I("tahapan-mandek", "tahapan", "rendah", "SIPP", "Belum putus dan tidak ada sidang ke depan", "Tetapkan sidang berikutnya atau periksa apakah perkara sudah selesai."),
  I("ecourt-dokumen-putusan", "dokumen", "sedang", "e-Court - SIPP", "Dokumen putusan sudah di e-Court tetapi belum masuk e-Doc SIPP", "Unggah dokumen putusan ke e-Doc SIPP."),
  I("ecourt-belum-putusan", "dokumen", "sedang", "SIPP - e-Court", "Sudah putus di SIPP tetapi e-Court belum memuat putusan", "Unggah putusan ke e-Court."),
  I("biaya-abt", "biaya", "sedang", "SIPP - ABT", "Jumlah biaya perkara SIPP berbeda dengan ABT", "Periksa jurnal biaya perkara di SIPP dan di ABT."),
];

export const PETA_JENIS: ReadonlyMap<string, JenisInfo> = new Map(KATALOG_JENIS.map((j) => [j.kode, j]));

export type SisiTemuan = { sumber: string; nilai: string };

export type Temuan = {
  jenis: string;
  tingkat: Tingkat;
  ringkas: string;
  sisi: SisiTemuan[];
  sidik: string;
};

// ----------------------------------------------------------------------------
// Fakta (bentuk keluaran bot)
// ----------------------------------------------------------------------------

export type FaktaSidang = {
  id: number;
  urutan: number | null;
  tanggal: string;
  agenda: string;
  dihadiriOleh: number | null;
  ditunda: boolean;
  ikrar: boolean;
  adaBas: boolean;
};

export type FaktaPencocok = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  jenisPerkaraId: number | null;
  alurPerkaraId: number | null;
  tanggalPendaftaran: string;
  tahapan: { id: number | null; teks: string; proses: string };
  putusan: {
    tanggal: string;
    statusId: number | null;
    amarVerstek: boolean;
    adaAmar: boolean;
    adaBerkas: boolean;
    tanggalMinutasi: string;
    tanggalBht: string;
    dicabut: boolean;
    gugur: boolean;
  } | null;
  aktaCerai: { tanggal: string } | null;
  sidang: FaktaSidang[];
  courtCalendar: Array<{ tanggal: string; agenda: string }>;
  lewatEcourt: boolean;
  hadirLengkapPertama: string;
  mediasi: { hasil?: string; keputusan?: string; laporan?: string } | null;
  sidangLaporanMediasi: string;
  pihak: { p: Array<{ pihakId: number; nama: string }>; t: Array<{ pihakId: number; nama: string }> };
  majelis: {
    aktif: string[];
    ppAktif: string[];
    /** Tanggal penetapan baris aktif terbaru ('' = tidak diketahui). */
    tanggalAktif?: string;
    tanggalPpAktif?: string;
    penetapan: { majelis: string; pp: string; tanggalMajelis?: string; tanggalPp?: string } | null;
  };
  biaya: { masuk: number; keluar: number; baris: number };
  abt: {
    terbaca: { masuk: boolean; putus: boolean; minutasi: boolean; akta: boolean; biaya: boolean };
    masuk: { nomorPerkara: string; tanggalPendaftaran: string; jenisPerkaraId: number | null; paraPihak: string } | null;
    putus: { tanggal: string; statusId: number | null } | null;
    minutasi: { tanggal: string } | null;
    aktaCerai: { tanggal: string } | null;
    biaya: { masuk: number; keluar: number; baris: number } | null;
  };
  ecourt: {
    putusan: {
      adaTab: boolean;
      adaBaris: boolean;
      alasan: string;
      tanggalTeks: string;
      dokumenAda: boolean;
      tte: boolean;
      diperiksaPada: string;
    } | null;
  };
  kuasa?: { sipp: Array<{ pihakId: number; nama: string }>; ecourt: Array<{ pihakId: number; nama: string }> };
  ktp: Array<{ pihakId: number; nik: string; nikSah: boolean; nama: string; nikSipp: string }>;
};

/** Sumber yang berhasil dibaca (bot); kunci yang hilang dianggap terbaca. */
export type Terbaca = Partial<Record<"putusan" | "sidang" | "courtCalendar" | "pihak" | "majelis" | "biaya" | "abt" | "ecourt" | "ktp" | "aktaCerai" | "kuasa", boolean>>;

export type MasukanPencocok = {
  fakta: FaktaPencocok;
  acuan: string;
  terbaca?: Terbaca;
  /** Hasil pencocokan putusan vs dokumen yang sudah tersimpan di portal (lib/cocok-putusan). */
  cocokPutusan?: { keadaan: string; ringkas: string } | null;
};

// ============================================================================
// ALAT KECIL
// ============================================================================

const teks = (x: unknown) => String(x ?? "").trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const iso = (x: unknown) => {
  const t = teks(x).slice(0, 10);
  return ISO.test(t) ? t : "";
};

const BULAN: Record<string, string> = {
  januari: "01", februari: "02", pebruari: "02", maret: "03", april: "04", mei: "05", juni: "06", juli: "07",
  agustus: "08", september: "09", oktober: "10", nopember: "11", november: "11", desember: "12",
};

/** "Senin, 25 Mei 2026" (tab putusan e-Court) -> "2026-05-25"; tidak terbaca = "". */
export function tanggalDariTeksEcourt(nilai: string): string {
  const m = teks(nilai).toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!m) return "";
  const bulan = BULAN[m[2]];
  if (!bulan) return "";
  return `${m[3]}-${bulan}-${m[1].padStart(2, "0")}`;
}

export function tanggalPendek(nilai: string): string {
  const t = iso(nilai);
  if (!t) return "-";
  const [y, b, h] = t.split("-");
  const nama = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][Number(b)] ?? b;
  return `${Number(h)} ${nama} ${y}`;
}

/** Selisih hari kalender a - b (iso). */
export function selisihHari(a: string, b: string): number {
  const x = Date.parse(`${iso(a)}T00:00:00Z`);
  const y = Date.parse(`${iso(b)}T00:00:00Z`);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
  return Math.round((x - y) / 86_400_000);
}

function geser(acuan: string, hari: number): string {
  const t = new Date(`${iso(acuan)}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + hari);
  return t.toISOString().slice(0, 10);
}

/** NIK ditampilkan tersamar: 4 angka awal dan 2 akhir. */
export function samarkanNik(nik: string): string {
  const d = teks(nik).replace(/\D/g, "");
  if (d.length < 8) return d ? "••••" : "(kosong)";
  return `${d.slice(0, 4)}${"•".repeat(Math.max(4, d.length - 6))}${d.slice(-2)}`;
}

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

/** Kunci perbandingan nama: tanpa gelar (sesudah koma), tanda baca, huruf besar, diakritik. */
export function kunciNama(nama: string): string {
  return teks(nama)
    .split(",")[0]
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sebagian(kecil: string[], besar: string[]) {
  return kecil.length > 0 && kecil.every((t) => besar.includes(t));
}

/** Dua nama sama bila kunci sama, atau kata-kata salah satunya termuat seluruhnya di yang lain. */
export function namaSama(a: string, b: string): boolean {
  const ka = kunciNama(a);
  const kb = kunciNama(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  const ta = ka.split(" ");
  const tb = kb.split(" ");
  return sebagian(ta, tb) || sebagian(tb, ta);
}

/** Nama-nama dari teks penetapan SIPP: "Hakim Ketua: A, S.H.</br>Hakim Anggota 1: B ..." atau "Panitera Pengganti: C". */
export function namaDariTeksPenetapan(nilai: string): string[] {
  return teks(nilai)
    .split(/<\s*\/?\s*br\s*\/?\s*>|\r?\n|;/gi)
    .map((s) => s.replace(/^[^:]{0,40}:\s*/, "").replace(/<[^>]*>/g, " ").trim())
    .filter(Boolean);
}

/** Himpunan nama `a` yang tidak punya padanan di `b`. */
export function namaTanpaPadanan(a: string[], b: string[]): string[] {
  return a.filter((x) => !b.some((y) => namaSama(x, y)));
}

const NAMA_KEHADIRAN: Record<number, string> = {
  1: "Semua Pihak", 2: "Pihak Pertama saja", 3: "Pihak Kedua saja", 4: "Para Pihak Tidak Hadir", 5: "Intervensi saja",
  7: "Pihak Pertama dan Intervensi", 8: "Pihak Kedua dan Intervensi", 9: "Pihak Pertama dan Kedua (ada Intervensi)",
  10: "Sebagian Pihak Pertama", 11: "Sebagian Pihak Kedua", 13: "Turut Tergugat saja", 14: "Pihak Pertama dan Turut Tergugat", 15: "Pihak Kedua dan Turut Tergugat",
};
const namaKehadiran = (k: number | null) => (k === null ? "belum diisi" : NAMA_KEHADIRAN[k] ?? `kode ${k}`);

/** Sidik isi (FNV-1a 32 bit, heksadesimal) - bukan untuk keamanan, hanya mendeteksi perubahan isi. */
export function sidikTeks(nilai: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < nilai.length; i += 1) {
    h ^= nilai.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function buat(jenis: string, ringkas: string, sisi: SisiTemuan[], tingkat?: Tingkat): Temuan {
  const info = PETA_JENIS.get(jenis);
  const t = tingkat ?? info?.tingkat ?? "sedang";
  return { jenis, tingkat: t, ringkas, sisi, sidik: sidikTeks(`${jenis}|${t}|${ringkas}|${sisi.map((s) => `${s.sumber}=${s.nilai}`).join("|")}`) };
}

// ============================================================================
// ATURAN
// ============================================================================

type Aturan = (m: MasukanPencocok) => Temuan | Temuan[] | null;

const aturanPutusanAbt: Aturan = ({ fakta: f, terbaca }) => {
  const sipp = f.putusan;
  if (!sipp?.tanggal || !f.abt.terbaca.putus || terbaca?.abt === false) return null;
  const hasil: Temuan[] = [];
  const abt = f.abt.putus;
  if (abt?.tanggal && abt.tanggal !== sipp.tanggal) {
    hasil.push(buat("putus-tanggal-abt", `SIPP ${tanggalPendek(sipp.tanggal)}, register ABT ${tanggalPendek(abt.tanggal)}`, [
      { sumber: "SIPP", nilai: tanggalPendek(sipp.tanggal) },
      { sumber: "ABT", nilai: tanggalPendek(abt.tanggal) },
    ]));
  } else if (abt?.tanggal && sipp.statusId !== null && abt.statusId !== null && sipp.statusId !== abt.statusId) {
    hasil.push(buat("putus-status-abt", `Kode status putusan SIPP ${sipp.statusId}, register ABT ${abt.statusId}`, [
      { sumber: "SIPP", nilai: `kode status ${sipp.statusId}` },
      { sumber: "ABT", nilai: `kode status ${abt.statusId}` },
    ]));
  }
  return hasil.length ? hasil : null;
};

const aturanPutusBelumAbt: Aturan = ({ fakta: f, acuan, terbaca }) => {
  const sipp = f.putusan;
  if (!sipp?.tanggal || !f.abt.terbaca.putus || !f.abt.terbaca.masuk || terbaca?.abt === false) return null;
  if (!f.abt.masuk || f.abt.putus) return null; // perkara belum tercatat di register ABT sama sekali = ABT belum dipakai untuknya
  if (selisihHari(acuan, sipp.tanggal) < 14) return null;
  return buat("putus-belum-abt", `Putus ${tanggalPendek(sipp.tanggal)} di SIPP; register putusan ABT belum ada`, [
    { sumber: "SIPP", nilai: `putus ${tanggalPendek(sipp.tanggal)}` },
    { sumber: "ABT", nilai: "register putusan belum ada" },
  ]);
};

const aturanDaftarAbt: Aturan = ({ fakta: f, terbaca }) => {
  const a = f.abt.masuk;
  if (!a || terbaca?.abt === false) return null;
  const beda: string[] = [];
  const sisi: SisiTemuan[] = [];
  if (a.nomorPerkara && f.nomorPerkara && a.nomorPerkara !== f.nomorPerkara) {
    beda.push("nomor perkara");
    sisi.push({ sumber: "SIPP", nilai: f.nomorPerkara }, { sumber: "ABT", nilai: a.nomorPerkara });
  }
  if (a.tanggalPendaftaran && f.tanggalPendaftaran && a.tanggalPendaftaran !== f.tanggalPendaftaran) {
    beda.push("tanggal pendaftaran");
    sisi.push({ sumber: "SIPP", nilai: tanggalPendek(f.tanggalPendaftaran) }, { sumber: "ABT", nilai: tanggalPendek(a.tanggalPendaftaran) });
  }
  if (a.jenisPerkaraId !== null && f.jenisPerkaraId !== null && a.jenisPerkaraId !== f.jenisPerkaraId) {
    beda.push("jenis perkara");
    sisi.push({ sumber: "SIPP", nilai: `${f.jenisPerkara || "jenis"} (kode ${f.jenisPerkaraId})` }, { sumber: "ABT", nilai: `kode jenis ${a.jenisPerkaraId}` });
  }
  return beda.length ? buat("daftar-abt", `Berbeda: ${beda.join(", ")}`, sisi) : null;
};

const aturanMinutasiAbt: Aturan = ({ fakta: f, acuan, terbaca }) => {
  const sipp = f.putusan?.tanggalMinutasi;
  if (!sipp || !f.abt.terbaca.minutasi || terbaca?.abt === false || !f.abt.masuk) return null;
  const abt = f.abt.minutasi?.tanggal;
  if (abt && abt !== sipp) {
    return buat("minutasi-abt", `Minutasi SIPP ${tanggalPendek(sipp)}, register ABT ${tanggalPendek(abt)}`, [
      { sumber: "SIPP", nilai: tanggalPendek(sipp) },
      { sumber: "ABT", nilai: tanggalPendek(abt) },
    ]);
  }
  if (!abt && selisihHari(acuan, sipp) >= 14) {
    return buat("minutasi-abt", `Minutasi SIPP ${tanggalPendek(sipp)}; register minutasi ABT belum ada`, [
      { sumber: "SIPP", nilai: tanggalPendek(sipp) },
      { sumber: "ABT", nilai: "register minutasi belum ada" },
    ]);
  }
  return null;
};

const aturanAktaAbt: Aturan = ({ fakta: f, terbaca }) => {
  const sipp = f.aktaCerai?.tanggal;
  const abt = f.abt.aktaCerai?.tanggal;
  if (!sipp || !abt || !f.abt.terbaca.akta || terbaca?.abt === false || sipp === abt) return null;
  return buat("akta-abt", `Akta cerai SIPP ${tanggalPendek(sipp)}, register ABT ${tanggalPendek(abt)}`, [
    { sumber: "SIPP", nilai: tanggalPendek(sipp) },
    { sumber: "ABT", nilai: tanggalPendek(abt) },
  ]);
};

const aturanBiayaAbt: Aturan = ({ fakta: f, terbaca }) => {
  const abt = f.abt.biaya;
  if (!abt || !f.abt.terbaca.biaya || terbaca?.abt === false || terbaca?.biaya === false) return null;
  const sipp = f.biaya;
  if (sipp.baris === 0) return null;
  const beda: string[] = [];
  if (Math.round(sipp.masuk) !== Math.round(abt.masuk)) beda.push(`pemasukan SIPP ${rupiah(sipp.masuk)} / ABT ${rupiah(abt.masuk)}`);
  if (Math.round(sipp.keluar) !== Math.round(abt.keluar)) beda.push(`pengeluaran SIPP ${rupiah(sipp.keluar)} / ABT ${rupiah(abt.keluar)}`);
  if (!beda.length) return null;
  return buat("biaya-abt", beda.join("; "), [
    { sumber: "SIPP", nilai: `masuk ${rupiah(sipp.masuk)}, keluar ${rupiah(sipp.keluar)}` },
    { sumber: "ABT", nilai: `masuk ${rupiah(abt.masuk)}, keluar ${rupiah(abt.keluar)}` },
  ]);
};

/** Huruf dan angka saja, tanpa spasi dan diakritik - "FaridaRachmawati" dan "Farida Rachmawati" dianggap sama. */
function padat(nilai: string): string {
  return teks(nilai).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Bagian nama sebelum "bin/binti/alias" (nama diri tanpa nama ayah). */
function namaPokok(nama: string): string {
  return teks(nama).split(/\s+(?:bin|binti|alias)\s+/i)[0];
}

const aturanPihakAbt: Aturan = ({ fakta: f, terbaca }) => {
  const abt = f.abt.masuk?.paraPihak;
  if (!abt || terbaca?.abt === false || terbaca?.pihak === false) return null;
  if (abt.length >= 12000) return null; // data pihak terpotong: tidak dapat dinilai, bukan beda
  const teksAbt = padat(abt.replace(/<[^>]*>/g, " "));
  const hilangPokok: string[] = [];
  const hilangAyah: string[] = [];
  for (const { nama } of [...f.pihak.p, ...f.pihak.t].slice(0, 12)) {
    const penuh = padat(nama);
    if (penuh.length < 4 || teksAbt.includes(penuh)) continue;
    const pokok = padat(namaPokok(nama));
    if (pokok.length >= 4 && teksAbt.includes(pokok)) hilangAyah.push(nama);
    else hilangPokok.push(nama);
  }
  const hilang = [...hilangPokok, ...hilangAyah];
  if (!hilang.length) return null;
  // Register ABT adalah potret saat pendaftaran (Tergugat bisa baru dicatat sesudahnya, nama dikoreksi di SIPP):
  // informasi saja (rendah), bukan kekeliruan yang mendesak.
  return buat(
    "pihak-abt",
    `${hilangPokok.length ? "Nama pihak" : "Nama ayah/ejaan pihak"} di SIPP tidak sama dengan register ABT: ${hilang.join("; ")}`,
    [
      { sumber: "SIPP", nilai: hilang.join("; ") },
      { sumber: "ABT", nilai: "tidak ada pada data pihak register" },
    ],
    "rendah"
  );
};

/**
 * Nama kuasa e-Court sama dengan nama kuasa SIPP: nama sama, atau nama diri (sebelum gelar) termuat dalam teks nama SIPP -
 * SIPP kerap menyatukan beberapa kuasa dalam satu isian ("Rahmi, S.H., Helmy, S.H, Andirwan ,S.H").
 */
function kuasaSamaNama(namaEcourt: string, namaSipp: string): boolean {
  if (namaSama(namaEcourt, namaSipp)) return true;
  const diri = padat(kunciNama(namaEcourt));
  return diri.length >= 4 && padat(namaSipp).includes(diri);
}

const aturanKuasa: Aturan = ({ fakta: f, terbaca }) => {
  if (!f.kuasa || terbaca?.kuasa === false || !f.lewatEcourt) return null;
  // Satu advokat dapat punya DUA pihak_id (catatan ganda di SIPP; terukur: 6759 - id e-Court 29736, id kuasa SIPP 8612, orang sama),
  // maka kuasa dianggap tercatat bila id SAMA ATAU namanya sama. Baris e-Court ganda (satu per pihak yang diwakili) dilipat.
  const adaDiSipp = new Set(f.kuasa.sipp.map((k) => k.pihakId));
  const dilihat = new Set<number>();
  const hilang = f.kuasa.ecourt.filter((k) => {
    if (dilihat.has(k.pihakId)) return false;
    dilihat.add(k.pihakId);
    if (adaDiSipp.has(k.pihakId)) return false;
    return !(k.nama && f.kuasa!.sipp.some((x) => kuasaSamaNama(k.nama, x.nama)));
  });
  if (!hilang.length) return null;
  const nama = hilang.map((k) => k.nama || "(nama tidak terbaca)").join("; ");
  return buat("kuasa-ecourt", `Kuasa hukum di e-Court belum ada di SIPP: ${nama}`, [
    { sumber: "e-Court", nilai: nama },
    { sumber: "SIPP", nilai: f.kuasa.sipp.length ? `kuasa tercatat: ${f.kuasa.sipp.map((k) => k.nama).join("; ")}` : "tidak ada kuasa aktif" },
  ]);
};

const aturanNik: Aturan = ({ fakta: f, terbaca }) => {
  if (terbaca?.ktp === false) return null;
  const beda: Temuan[] = [];
  const kosong: string[] = [];
  const berbeda: SisiTemuan[] = [];
  for (const k of f.ktp) {
    const dariKtp = teks(k.nik).replace(/\D/g, "");
    if (dariKtp.length !== 16 || !k.nikSah) continue;
    const sipp = teks(k.nikSipp).replace(/\D/g, "");
    if (!sipp) {
      kosong.push(k.nama || "pihak");
    } else if (sipp !== dariKtp) {
      berbeda.push({ sumber: `SIPP (${k.nama || "pihak"})`, nilai: samarkanNik(sipp) }, { sumber: "KTP", nilai: samarkanNik(dariKtp) });
    }
  }
  if (berbeda.length) beda.push(buat("pihak-nik", `NIK di SIPP berbeda dengan KTP untuk ${berbeda.length / 2} pihak`, berbeda));
  if (kosong.length) beda.push(buat("pihak-nik-kosong", `NIK di SIPP kosong, KTP terbaca: ${kosong.join("; ")}`, [{ sumber: "SIPP", nilai: "NIK kosong" }, { sumber: "KTP", nilai: "NIK terbaca" }]));
  return beda.length ? beda : null;
};

/**
 * Majelis/PP aktif ditetapkan LEBIH BARU daripada penetapan yang tertulis di teks = penggantian yang sah (SIPP menyimpan
 * teks penetapan awal; penggantian hanya menambah baris aktif baru). Diukur di salinan 28 Okt: tanpa pengecualian ini
 * 62 dari 3.531 perkara menyala, hampir seluruhnya penggantian biasa.
 */
function penggantianSah(tanggalAktif: string | undefined, tanggalPenetapan: string | undefined): boolean {
  const a = iso(tanggalAktif);
  const p = iso(tanggalPenetapan);
  return Boolean(a && p && a > p);
}

const aturanMajelis: Aturan = ({ fakta: f, terbaca }) => {
  if (terbaca?.majelis === false) return null;
  const hasil: Temuan[] = [];
  const pen = f.majelis.penetapan;
  if (!pen) {
    if (f.majelis.aktif.length === 0 && f.sidang.length > 0) {
      hasil.push(buat("majelis-kosong", `Ada ${f.sidang.length} sidang tercatat, majelis hakim aktif kosong`, [{ sumber: "SIPP", nilai: "majelis aktif: (kosong)" }]));
    }
    return hasil.length ? hasil : null;
  }
  const namaPen = namaDariTeksPenetapan(pen.majelis);
  if (f.majelis.aktif.length === 0 && f.sidang.length > 0) {
    hasil.push(buat("majelis-kosong", `Ada ${f.sidang.length} sidang tercatat, majelis hakim aktif kosong`, [{ sumber: "SIPP", nilai: "majelis aktif: (kosong)" }]));
  } else if (namaPen.length && f.majelis.aktif.length && !penggantianSah(f.majelis.tanggalAktif, pen.tanggalMajelis)) {
    const hanyaPenetapan = namaTanpaPadanan(namaPen, f.majelis.aktif);
    const hanyaAktif = namaTanpaPadanan(f.majelis.aktif, namaPen);
    if (hanyaPenetapan.length || hanyaAktif.length) {
      hasil.push(buat("majelis-penetapan", `Penetapan menyebut ${namaPen.map(kunciNamaTampil).join(", ")}; majelis aktif ${f.majelis.aktif.map(kunciNamaTampil).join(", ")}`, [
        { sumber: "Teks penetapan", nilai: namaPen.join("; ") },
        { sumber: "Majelis aktif", nilai: f.majelis.aktif.join("; ") },
      ]));
    }
  }
  const ppPen = namaDariTeksPenetapan(pen.pp);
  if (ppPen.length && f.majelis.ppAktif.length && !penggantianSah(f.majelis.tanggalPpAktif, pen.tanggalPp)) {
    if (namaTanpaPadanan(ppPen, f.majelis.ppAktif).length || namaTanpaPadanan(f.majelis.ppAktif, ppPen).length) {
      hasil.push(buat("pp-penetapan", `Penetapan menyebut ${ppPen.map(kunciNamaTampil).join(", ")}; panitera pengganti aktif ${f.majelis.ppAktif.map(kunciNamaTampil).join(", ")}`, [
        { sumber: "Teks penetapan", nilai: ppPen.join("; ") },
        { sumber: "PP aktif", nilai: f.majelis.ppAktif.join("; ") },
      ]));
    }
  }
  return hasil.length ? hasil : null;
};

function kunciNamaTampil(n: string) {
  return teks(n).split(",")[0].trim();
}

const aturanCalendar: Aturan = ({ fakta: f, acuan, terbaca }) => {
  if (terbaca?.courtCalendar === false || terbaca?.sidang === false || !f.lewatEcourt || f.putusan) return null;
  const baris: string[] = [];
  const sisi: SisiTemuan[] = [];
  for (const s of f.sidang) {
    if (!s.tanggal || s.tanggal < acuan || s.ditunda) continue; // yang dinilai: sidang yang akan datang/hari ini
    const b: BarisCourtCalendar = {
      tanggalSidang: s.tanggal,
      agenda: s.agenda,
      lewatEcourt: true,
      urutanSidang: s.urutan ?? 0,
      courtCalendar: f.courtCalendar,
      courtCalendarTerbaca: true,
      hadirLengkapPertama: f.hadirLengkapPertama,
      hadirLengkapTerbaca: true,
      mediasi: f.mediasi,
      mediasiTerbaca: true,
      sidangLaporanMediasi: f.sidangLaporanMediasi,
      sidangLaporanMediasiTerbaca: true,
      sidangIkrarTalak: s.ikrar,
    };
    const k = keadaanCourtCalendar(b);
    if (k && !k.sinkron) {
      baris.push(`Sidang ${tanggalPendek(s.tanggal)}: ${k.sebab}`);
      sisi.push({ sumber: `SIPP ${tanggalPendek(s.tanggal)}`, nilai: s.agenda || "(tanpa agenda)" });
    }
  }
  if (!baris.length) return null;
  const cc = f.courtCalendar.map((r) => `${tanggalPendek(r.tanggal)} ${r.agenda}`).join("; ") || "belum dibuat";
  sisi.push({ sumber: "Court Calendar", nilai: cc });
  return buat("calendar-sinkron", baris[0] + (baris.length > 1 ? ` (+${baris.length - 1} sidang lain)` : ""), sisi);
};

const aturanKehadiran: Aturan = ({ fakta: f, acuan, terbaca }) => {
  if (terbaca?.sidang === false) return null;
  const hasil: Temuan[] = [];
  const putus = f.putusan;
  if (putus?.amarVerstek && putus.tanggal) {
    const hadir = f.sidang.filter((s) => s.tanggal && s.tanggal <= putus.tanggal && tergugatHadirSandi(s.dihadiriOleh));
    if (hadir.length) {
      hasil.push(buat("hadir-verstek", `Amar verstek, tetapi SIPP mencatat Tergugat/Termohon hadir pada ${hadir.map((s) => tanggalPendek(s.tanggal)).join(", ")}`, [
        { sumber: "SIPP kehadiran", nilai: hadir.map((s) => `${tanggalPendek(s.tanggal)}: ${namaKehadiran(s.dihadiriOleh)}`).join("; ") },
        { sumber: "Amar putusan", nilai: "verstek (Tergugat/Termohon tidak hadir)" },
      ]));
    }
  }
  // Sidang yang sudah lewat tetapi kehadirannya belum diisi (60 hari terakhir saja; yang lebih tua = tumpukan lama).
  const lewat = f.sidang.filter(
    (s) =>
      s.tanggal && s.tanggal < acuan && selisihHari(acuan, s.tanggal) <= 60 && !s.ditunda && !s.ikrar &&
      !/musyawarah|pembacaan|pengucapan|ikrar/i.test(s.agenda) && (s.dihadiriOleh === null || s.dihadiriOleh === 0)
  );
  if (lewat.length) {
    hasil.push(buat("hadir-kosong", `Kehadiran belum diisi pada sidang ${lewat.map((s) => tanggalPendek(s.tanggal)).join(", ")}`, [
      { sumber: "SIPP kehadiran", nilai: lewat.map((s) => `${tanggalPendek(s.tanggal)}: belum diisi`).join("; ") },
    ]));
  }
  return hasil.length ? hasil : null;
};

const aturanPutusSidang: Aturan = ({ fakta: f, terbaca }) => {
  const putus = f.putusan;
  if (!putus?.tanggal || terbaca?.sidang === false || terbaca?.putusan === false) return null;
  const hasil: Temuan[] = [];
  const tanggalSidang = f.sidang.filter((s) => s.tanggal).map((s) => s.tanggal);
  if (!putus.dicabut && !putus.gugur && tanggalSidang.length && !tanggalSidang.includes(putus.tanggal)) {
    hasil.push(buat("putus-tanpa-sidang", `Putus ${tanggalPendek(putus.tanggal)}; sidang terakhir ${tanggalPendek(tanggalSidang[tanggalSidang.length - 1])}`, [
      { sumber: "SIPP putusan", nilai: tanggalPendek(putus.tanggal) },
      { sumber: "SIPP sidang", nilai: tanggalSidang.map(tanggalPendek).slice(-4).join(", ") },
    ]));
  }
  const sesudah = f.sidang.filter((s) => s.tanggal > putus.tanggal && !s.ikrar && !/ikrar/i.test(s.agenda));
  if (sesudah.length) {
    hasil.push(buat("sidang-setelah-putus", `Sidang ${sesudah.map((s) => tanggalPendek(s.tanggal)).join(", ")} tercatat sesudah putus ${tanggalPendek(putus.tanggal)}`, [
      { sumber: "SIPP putusan", nilai: tanggalPendek(putus.tanggal) },
      { sumber: "SIPP sidang", nilai: sesudah.map((s) => `${tanggalPendek(s.tanggal)} ${s.agenda}`.trim()).join("; ") },
    ]));
  }
  return hasil.length ? hasil : null;
};

const POLA_TAHAPAN_SETELAH_PUTUS = /^(putusan|minutasi|akta cerai|ikrar|banding|kasasi|peninjauan|eksekusi|bht)/i;
const POLA_TAHAPAN_SEBELUM_PUTUS = /^(pendaftaran|penetapan|persidangan|mediasi)/i;

const aturanTahapan: Aturan = ({ fakta: f, acuan, terbaca }) => {
  const t = teks(f.tahapan.teks);
  if (!t || terbaca?.putusan === false) return null;
  const hasil: Temuan[] = [];
  if (!f.putusan && POLA_TAHAPAN_SETELAH_PUTUS.test(t)) {
    hasil.push(buat("tahapan-belum-putus", `Tahapan terakhir "${t}", tetapi belum ada putusan`, [
      { sumber: "SIPP tahapan", nilai: t },
      { sumber: "SIPP putusan", nilai: "belum ada" },
    ]));
  } else if (f.putusan && !f.putusan.dicabut && POLA_TAHAPAN_SEBELUM_PUTUS.test(t)) {
    hasil.push(buat("tahapan-sudah-putus", `Putus ${tanggalPendek(f.putusan.tanggal)}, tetapi tahapan terakhir masih "${t}"`, [
      { sumber: "SIPP tahapan", nilai: t },
      { sumber: "SIPP putusan", nilai: tanggalPendek(f.putusan.tanggal) },
    ]));
  }
  if (f.putusan && f.aktaCerai?.tanggal && /^putusan$/i.test(t)) {
    hasil.push(buat("tahapan-akta", `Akta cerai terbit ${tanggalPendek(f.aktaCerai.tanggal)}, tahapan terakhir masih "${t}"`, [
      { sumber: "SIPP tahapan", nilai: t },
      { sumber: "SIPP akta cerai", nilai: tanggalPendek(f.aktaCerai.tanggal) },
    ]));
  }
  if (!f.putusan && terbaca?.sidang !== false && f.sidang.length > 0) {
    const tanggal = f.sidang.filter((s) => s.tanggal).map((s) => s.tanggal);
    const akhir = tanggal[tanggal.length - 1];
    if (akhir && akhir < acuan && selisihHari(acuan, akhir) >= 14) {
      hasil.push(buat("tahapan-mandek", `Belum putus; sidang terakhir ${tanggalPendek(akhir)} (${selisihHari(acuan, akhir)} hari lalu), tidak ada sidang ke depan`, [
        { sumber: "SIPP sidang", nilai: `terakhir ${tanggalPendek(akhir)}` },
        { sumber: "SIPP tahapan", nilai: t },
      ]));
    }
  }
  return hasil.length ? hasil : null;
};

const aturanEcourtPutusan: Aturan = ({ fakta: f, acuan, terbaca }) => {
  const sipp = f.putusan;
  const ec = f.ecourt.putusan;
  if (!sipp?.tanggal || !ec || terbaca?.ecourt === false || terbaca?.putusan === false) return null;
  const hasil: Temuan[] = [];
  if (ec.adaBaris) {
    const tgl = tanggalDariTeksEcourt(ec.tanggalTeks);
    if (tgl && tgl !== sipp.tanggal) {
      hasil.push(buat("putus-ecourt-tanggal", `SIPP ${tanggalPendek(sipp.tanggal)}, tab putusan e-Court ${tanggalPendek(tgl)}`, [
        { sumber: "SIPP", nilai: tanggalPendek(sipp.tanggal) },
        { sumber: "e-Court", nilai: tanggalPendek(tgl) },
      ]));
    }
    if (ec.dokumenAda && !sipp.adaBerkas) {
      hasil.push(buat("ecourt-dokumen-putusan", "Dokumen putusan ada di e-Court, e-Doc SIPP belum memuatnya", [
        { sumber: "e-Court", nilai: "dokumen putusan ada" },
        { sumber: "SIPP e-Doc", nilai: "belum ada" },
      ]));
    }
  } else if (ec.adaTab && f.lewatEcourt && !sipp.dicabut && !sipp.gugur) {
    // Hanya bila e-Court dibaca SESUDAH putus (bacaan lama = e-Court memang belum sempat memuat).
    const diperiksa = teks(ec.diperiksaPada).slice(0, 10);
    if (diperiksa && selisihHari(diperiksa, sipp.tanggal) >= 3 && selisihHari(acuan, sipp.tanggal) >= 3) {
      hasil.push(buat("ecourt-belum-putusan", `Putus ${tanggalPendek(sipp.tanggal)} di SIPP; e-Court (dibaca ${tanggalPendek(diperiksa)}) belum memuat putusan`, [
        { sumber: "SIPP", nilai: `putus ${tanggalPendek(sipp.tanggal)}` },
        { sumber: "e-Court", nilai: "baris putusan kosong" },
      ]));
    }
  }
  return hasil.length ? hasil : null;
};

const aturanCocokPutusan: Aturan = ({ cocokPutusan }) => {
  if (!cocokPutusan || cocokPutusan.keadaan !== "beda") return null;
  return buat("putus-dokumen", cocokPutusan.ringkas || "Putusan SIPP berbeda dengan dokumen putusan", [
    { sumber: "SIPP", nilai: "amar/tanggal putusan" },
    { sumber: "Dokumen putusan", nilai: cocokPutusan.ringkas || "berbeda" },
  ]);
};

export const SEMUA_ATURAN_PENCOCOK: readonly Aturan[] = [
  aturanPutusanAbt,
  aturanPutusBelumAbt,
  aturanDaftarAbt,
  aturanMinutasiAbt,
  aturanAktaAbt,
  aturanBiayaAbt,
  aturanPihakAbt,
  aturanKuasa,
  aturanNik,
  aturanMajelis,
  aturanCalendar,
  aturanKehadiran,
  aturanPutusSidang,
  aturanTahapan,
  aturanEcourtPutusan,
  aturanCocokPutusan,
];

/** Seluruh temuan satu perkara, diurutkan tingkat (tinggi dulu) lalu jenis. Aturan yang melempar galat dilewati (tidak menjatuhkan putaran). */
export function cocokkanPerkara(masukan: MasukanPencocok): Temuan[] {
  const hasil: Temuan[] = [];
  for (const aturan of SEMUA_ATURAN_PENCOCOK) {
    try {
      const r = aturan(masukan);
      if (!r) continue;
      if (Array.isArray(r)) hasil.push(...r);
      else hasil.push(r);
    } catch {
      /* satu aturan rusak tidak boleh menggugurkan yang lain */
    }
  }
  const urut = { tinggi: 0, sedang: 1, rendah: 2 } as const;
  return hasil.sort((a, b) => urut[a.tingkat] - urut[b.tingkat] || a.jenis.localeCompare(b.jenis));
}

/** Petugas perkara (teks, dipisah koma) untuk penyaringan "perkara saya": majelis aktif dan panitera pengganti aktif. */
export function petugasDariFakta(f: Pick<FaktaPencocok, "majelis">): { majelis: string; panitera: string } {
  return { majelis: f.majelis.aktif.join(", "), panitera: f.majelis.ppAktif.join(", ") };
}

// ============================================================================
// RINGKASAN
// ============================================================================

export type BarisTemuan = {
  perkaraId: string;
  nomorPerkara: string;
  jenis: string;
  tingkat: Tingkat;
  ringkas: string;
  sisi: SisiTemuan[];
  majelis: string;
  panitera: string;
  diperiksaPada: string;
  pertamaTerlihat: string;
};

export type RingkasanPencocok = {
  jumlah: number;
  perkara: number;
  perTingkat: Record<Tingkat, number>;
  perJenis: Record<string, number>;
  perKelompok: Record<string, number>;
};

export function ringkasTemuan(baris: ReadonlyArray<Pick<BarisTemuan, "perkaraId" | "jenis" | "tingkat">>): RingkasanPencocok {
  const perTingkat: Record<Tingkat, number> = { tinggi: 0, sedang: 0, rendah: 0 };
  const perJenis: Record<string, number> = {};
  const perKelompok: Record<string, number> = {};
  const perkara = new Set<string>();
  for (const b of baris) {
    perTingkat[b.tingkat] += 1;
    perJenis[b.jenis] = (perJenis[b.jenis] ?? 0) + 1;
    const kel = PETA_JENIS.get(b.jenis)?.kelompok ?? "putusan";
    perKelompok[kel] = (perKelompok[kel] ?? 0) + 1;
    perkara.add(b.perkaraId);
  }
  return { jumlah: baris.length, perkara: perkara.size, perTingkat, perJenis, perKelompok };
}

export function judulJenis(kode: string): string {
  return PETA_JENIS.get(kode)?.judul ?? kode;
}

/** Tanggal acuan mundur sekian hari - dipakai pemanggil untuk lingkup (diekspor agar uji tidak menyalin). */
export function mundurHari(acuan: string, hari: number): string {
  return geser(acuan, -hari);
}
