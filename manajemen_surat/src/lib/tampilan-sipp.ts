import { GOLONGAN_PERAN, type GolonganPeran } from "@/lib/matriks-peran";

/**
 * ============================================================================
 * TAMPILAN ALETA DI HALAMAN SIPP - PER PERAN DAN PER PENGGUNA (28 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: tiap peran dan tiap pengguna punya pengaturan apa saja
 * dari ALETA yang tampil di halaman SIPP; Admin/Super Admin mengaturnya (layar
 * matriks), pengguna mengatur pilihannya sendiri di dalam yang diizinkan, dan
 * pilihannya tersimpan di akun (bukan hanya di peramban).
 *
 * SATU SUMBER: katalog di berkas ini dipakai layar Admin, halaman pengguna,
 * dan EKSTENSI - server mengirim penyaring (pilih) elemen yang disembunyikan
 * lewat GET /api/aleta-ecourt/ekstensi/tampilan-sipp; ekstensi tidak menyimpan
 * salinan katalog. Inventaris lengkap + usulan: D:/aleta-dev/kerja/
 * tampilan-sipp-peran-28okt.md.
 *
 * TAMPILAN BUKAN HAK: menyembunyikan hanya tidak menggambar (CSS
 * display:none), fitur latar tetap berjalan seperti mode tersembunyi 1.205.52.
 * Menampilkan tidak pernah memberi hak baru - tombol aksi tetap tunduk pada
 * matriks peran yang ada (tombol yang tidak berhak memang tidak digambar).
 *
 * ============================================================================
 * ATURAN YANG BERLAKU (fungsi murni, diuji tampilan-sipp-peran-28okt.test.ts)
 * ============================================================================
 *
 *   1. sistem   : semua elemen "boleh", bawaan NYALA - fitur lama tidak
 *                 berkurang sampai admin mengaturnya;
 *   2. peran    : aturan admin untuk golongan pengguna. Pengguna bergolongan
 *                 banyak: yang paling longgar menang (boleh > selalu > tidak),
 *                 sejalan "peran tambahan hanya menambah";
 *   3. pengguna : aturan admin untuk akun itu sendiri menimpa aturan peran;
 *   4. pilihan  : pilihan pengguna sendiri, HANYA untuk elemen "boleh".
 *                 "selalu" dan "tidak" terkunci ("diatur admin").
 */

export const HALAMAN_SIPP = {
  semua: "Semua halaman SIPP",
  daftar: "Daftar perkara",
  perkara: "Halaman perkara (detil)",
  sidang: "Jadwal & data persidangan",
  form: "Form isian SIPP",
  penetapan: "Penetapan (PMH/PPP/PJS/PHS)",
  putusan: "Putusan",
  mediasi: "Mediasi",
  kasir: "Kasir & jurnal keuangan",
  pihak: "Data pihak",
  beranda: "Beranda SIPP",
} as const;
export type HalamanSipp = keyof typeof HALAMAN_SIPP;

export type JenisElemen = "tampilan" | "aksi";

export type ElemenTampilanSipp = {
  kunci: string;
  halaman: HalamanSipp;
  nama: string;
  /** Satu kalimat untuk pegawai: apa yang tampil dan gunanya. */
  jelas: string;
  /** Contoh tulisan yang tampil di SIPP - untuk pratinjau di halaman pengaturan. */
  contoh: string;
  /** tampilan = hanya keterangan; aksi = ada tombol (haknya tetap dari matriks peran). */
  jenis: JenisElemen;
  /** Peran yang lazim membutuhkannya (usulan bawaan per peran). Super Admin/Admin selalu lazim. */
  lazim: readonly GolonganPeran[];
  /** Penyaring CSS di halaman SIPP. */
  pilih: readonly string[];
  /** Penyaring di dalam akar bayangan (widget) - {tuan, pilih}. */
  bayang?: { tuan: string; pilih: readonly string[] };
  /** CSS tambahan saat disembunyikan (mengembalikan tampilan SIPP yang digantikan sisipan). */
  gayaSembunyi?: string;
};

const SEMUA: readonly GolonganPeran[] = GOLONGAN_PERAN;
const MAJELIS: readonly GolonganPeran[] = ["pimpinan", "hakim", "pp"];
const KEPANITERAAN: readonly GolonganPeran[] = ["panitera", "panmud", "pp", "jurusita", "analis-perkara"];
const PERKARA: readonly GolonganPeran[] = ["pimpinan", "hakim", "panitera", "panmud", "pp", "jurusita", "analis-perkara", "ptsp"];

function e(
  kunci: string,
  halaman: HalamanSipp,
  nama: string,
  jelas: string,
  contoh: string,
  jenis: JenisElemen,
  lazim: readonly GolonganPeran[],
  pilih: readonly string[],
  tambahan: Partial<Pick<ElemenTampilanSipp, "bayang" | "gayaSembunyi">> = {}
): ElemenTampilanSipp {
  return Object.freeze({ kunci, halaman, nama, jelas, contoh, jenis, lazim, pilih, ...tambahan });
}

/** Urutan = urutan di layar (per halaman). Kunci TETAP: tersimpan di akun dan aturan admin. */
export const KATALOG_TAMPILAN_SIPP: readonly ElemenTampilanSipp[] = Object.freeze([
  // ── semua halaman ──────────────────────────────────────────────────────────
  e("semua.panel", "semua", "Panel ALETA", "Panel samping berisi keterangan perkara atau daftar, beserta tombol kerja ALETA.", "Panel ALETA - DAFTAR PERKARA, 25 di halaman ini", "aksi", SEMUA, ["#aleta-panel-sipp"]),
  e("semua.lencana", "semua", "Logo ALETA melayang", "Logo bulat yang muncul saat panel dilipat; diklik untuk membuka panel lagi.", "(logo bulat ALETA di tepi layar)", "aksi", SEMUA, [".aleta-lencana"]),
  e("semua.widget", "semua", "Widget ALETA", "Gelembung widget di sudut layar: checklist tugas, kehadiran, draf H-7, catatan cepat.", "Checklist milestone - 3 tugas hari ini", "aksi", SEMUA, ["aleta-cm-widget", "aleta-cm-kabar"]),
  e("semua.sumber-daya", "semua", "Bilah RAM, CPU, dan Disk server", "Bilah kecil pemakaian server di widget ALETA.", "RAM 62%  CPU 18%  Disk 71%  Rincian", "tampilan", ["ti"], [], {
    bayang: { tuan: "aleta-cm-widget", pilih: [".aleta-cmw-sd"] },
  }),
  e("semua.menu-abt", "semua", "Menu atas \"ABT By Derry\"", "Menu di bilah atas SIPP untuk membuka Blangko ABT di tab baru.", "Perdata | ABT By Derry | ALETA", "aksi", ["pimpinan", "hakim", "panitera", "panmud", "pp"], ['li[data-aleta-menu="abt"]']),
  e("semua.menu-aleta", "semua", "Menu atas \"ALETA\"", "Menu di bilah atas SIPP untuk membuka portal ALETA di tab baru.", "Perdata | ABT By Derry | ALETA", "aksi", SEMUA, ['li[data-aleta-menu="aleta"]']),
  e("semua.menu-ecourt", "semua", "Menu atas \"E-Court MA\"", "Menu di bilah atas SIPP untuk masuk e-Court dengan akun yang tersimpan.", "ALETA | E-Court MA", "aksi", ["hakim", "panitera", "panmud", "pp", "ptsp"], ['li[data-aleta-menu="ecourt"]']),
  e("semua.ai", "semua", "Gelembung ALETA Ai", "Gelembung tanya-jawab ALETA Ai di pojok kiri bawah.", "Ai - Tanya tentang perkara ini?", "aksi", ["pimpinan", "hakim", "pp", "panitera", "analis-perkara"], ["#aleta-ai-gelembung"]),
  e("semua.pita-pembaruan", "semua", "Pita pembaruan ekstensi", "Pita pemberitahuan bila versi ekstensi baru tersedia.", "Versi baru ekstensi tersedia - perbarui", "tampilan", SEMUA, [".aleta-pita-pembaruan"]),
  e("semua.spanduk-putusan", "semua", "Spanduk putusan terjadwal", "Spanduk di atas halaman bila ada putusan terjadwal yang menunggu peramban ini.", "Putusan terjadwal menunggu dikerjakan di peramban ini", "tampilan", MAJELIS, ["#aleta-ptj-spanduk"]),
  e("semua.lanjut-edoc", "semua", "Kartu lanjutkan e-Doc tertunda", "Kartu kecil di kanan bawah untuk melanjutkan unggah e-Doc yang tertunda.", "2 e-Doc tertunda - Lanjutkan", "aksi", ["pp", "panitera", "panmud"], ['.aleta-abt-kabar[data-b2-lanjut="1"]']),

  // ── daftar perkara ─────────────────────────────────────────────────────────
  e("daftar.tanda-baris", "daftar", "Lencana per baris perkara", "Lencana di sel nomor perkara: ghaib, izin atasan, verzet, prodeo, kuasa, selisih dan tenggat e-Court.", "( e-Court )  izin atasan  prodeo", "tampilan", SEMUA, [".aleta-tanda-baris"]),
  e("daftar.penanda", "daftar", "Penanda di bawah nomor perkara", "Penanda kecil (sita, verstek, ikrar, akta cerai, belum ditunda) yang diklik untuk dasar hukumnya.", "potensi verstek  akta cerai belum terbit", "tampilan", PERKARA, ['[data-aleta-l2="baris"]']),
  e("daftar.lama-proses", "daftar", "Lencana umur di kolom Lama Proses", "Umur perkara di luar mediasi menggantikan tulisan Lama Proses SIPP; bila disembunyikan tulisan SIPP kembali.", "1 hari", "tampilan", PERKARA, ['[data-aleta-l2="lama"]'], {
    gayaSembunyi: "td[data-aleta-l2-lama]{font-size:inherit!important;line-height:inherit!important}td[data-aleta-l2-lama]>:not(.aleta-sisip){display:revert!important}",
  }),
  e("daftar.lima-bulan", "daftar", "Kotak \"lewat 5 bulan\" (SEMA 2/2014)", "Kotak di atas tabel: perkara belum putus yang sudah lewat 5 bulan.", "ALETA: tidak ada perkara belum putus yang lewat 5 bulan (SEMA 2/2014)", "tampilan", ["pimpinan", "hakim"], ['[data-aleta-l2="lima"]']),
  e("daftar.tautan-abt-aleta", "daftar", "Tombol ABT dan ALETA per baris", "Tautan kecil di tiap baris untuk membuka perkara itu di ABT atau ALETA.", "ABT  ALETA", "aksi", ["pimpinan", "hakim", "panitera", "panmud", "pp"], [".aleta-l1-tautan"]),
  e("daftar.putusan-massal", "daftar", "Tombol \"Jadwalkan Putusan Massal\"", "Tombol untuk menjadwalkan unggah putusan banyak perkara sekaligus.", "Jadwalkan Putusan Massal", "aksi", MAJELIS, ["#aleta-ptj-massal"]),
  e("daftar.bas-massal", "daftar", "Kotak BAS massal", "Kotak untuk menyusun dan menyimpan BAS banyak perkara sekaligus.", "BAS massal - Muat, Pratinjau, Simpan ke SIPP", "aksi", ["pp", "panitera", "hakim"], [".aleta-basmassal"]),

  // ── halaman perkara ────────────────────────────────────────────────────────
  e("perkara.penanda", "perkara", "Baris \"Penanda ALETA\"", "Baris penanda di bawah tombol-tombol SIPP di halaman perkara.", "Penanda ALETA: sita  potensi verstek", "tampilan", PERKARA, ['[data-aleta-l2="detil"]']),
  e("perkara.tanda-judul", "perkara", "Lencana di judul perkara", "Lencana di samping judul: pihak ghaib, izin atasan, panjar, akta cerai, verzet, prodeo.", "IZIN ATASAN  PRODEO", "tampilan", SEMUA, [":is(h1, h2, .page-title, .panel-title) [data-aleta-tanda]"]),
  e("perkara.tautan-abt-aleta", "perkara", "Tombol \"Buka di ABT\" dan \"Buka di ALETA\"", "Dua tombol di deret tombol SIPP untuk membuka perkara ini di ABT atau ALETA.", "Buka di ABT  Buka di ALETA", "aksi", ["pimpinan", "hakim", "panitera", "panmud", "pp"], [".aleta-l1-submenu"]),
  e("perkara.tarik-data", "perkara", "Tombol \"Tarik data\" dan \"Muat ulang\"", "Tombol untuk menarik ulang data perkara ini dari SIPP.", "Tarik data  Muat ulang", "aksi", ["pimpinan", "hakim", "panitera", "panmud", "pp", "ptsp"], ["#aleta-tarik-satu", "#aleta-muat-ulang-perkara"]),
  e("perkara.jadwal-putusan", "perkara", "Tombol \"Jadwalkan Putusan\"", "Tombol untuk menjadwalkan unggah putusan perkara ini pada jam tertentu.", "Jadwalkan Putusan", "aksi", MAJELIS, ["#aleta-ptj-tombol:not(#aleta-ptj-massal *)"]),
  e("perkara.ringkasan", "perkara", "Kartu \"Perkara ini di SIPP, ABT, dan ALETA\"", "Kartu ringkasan keadaan perkara di tiga aplikasi beserta selisihnya.", "Perkara ini di SIPP, ABT, dan ALETA - 2 berbeda", "tampilan", PERKARA, [".aleta-m2"]),
  e("perkara.kabar-berubah", "perkara", "Pita \"data SIPP berubah\"", "Pita yang mengajak memuat ulang bila data perkara di SIPP berubah.", "Data SIPP berubah - muat ulang", "tampilan", SEMUA, ["#aleta-kabar"]),
  e("perkara.pita-luring", "perkara", "Pita \"ALETA tidak terjangkau\"", "Pita bila server ALETA tidak terjangkau dan keterangan berasal dari simpanan.", "ALETA tidak terjangkau - keterangan ini dari simpanan", "tampilan", SEMUA, [".aleta-pita-luring:not(#aleta-kabar)"]),
  e("perkara.beban-penetapan", "perkara", "Ringkasan \"Beban penetapan\"", "Ringkasan beban majelis, hakim, panitera pengganti, dan juru sita saat menetapkan.", "Beban penetapan - Rincian", "tampilan", ["pimpinan", "panitera", "hakim"], [".aleta-bebanstat"]),

  // ── persidangan ────────────────────────────────────────────────────────────
  e("sidang.jadwal-bas", "sidang", "Tombol \"Jadwalkan BAS\"", "Tombol untuk menjadwalkan unggah BAS sidang pada jam tertentu.", "Jadwalkan BAS", "aksi", ["pp", "hakim", "panitera"], ["#aleta-stj-tombol-bas"]),
  e("sidang.jadwal-tunda", "sidang", "Tombol \"Jadwalkan Tunda\"", "Tombol untuk menjadwalkan penundaan sidang pada jam tertentu.", "Jadwalkan Tunda", "aksi", ["pp", "hakim", "panitera"], ["#aleta-stj-tombol-tunda"]),
  e("sidang.dokumen-ecourt", "sidang", "Dokumen e-Court di baris sidang", "Kotak dokumen e-Court (PDF/Word) yang cocok dengan baris sidang.", "Dokumen e-Court: Jawaban - PDF  Word", "aksi", ["hakim", "pp", "panitera"], [".aleta-sisip:has(> .aleta-sisip-judul)"]),

  // ── form isian ─────────────────────────────────────────────────────────────
  e("form.usulan", "form", "Pita usulan isian ALETA", "Pita di atas form SIPP berisi usulan isian dengan tombol Terapkan.", "ALETA - 4 usulan isian - Terapkan", "aksi", KEPANITERAAN.concat(["hakim", "ptsp"]), [".aleta-l1-pita:not(.aleta-l1-edoc-cek)"]),
  e("form.periksa", "form", "Pita pemeriksaan isian", "Pita yang memeriksa urutan tanggal, hari libur, dan batas 5 bulan pada form.", "ALETA memeriksa - 1 perlu dilihat", "tampilan", KEPANITERAAN.concat(["hakim", "ptsp"]), [".aleta-m1-pita"]),
  e("form.edoc-cek", "form", "Peringatan e-Doc akan diganti", "Peringatan sebelum e-Doc yang sudah ada di SIPP diganti.", "e-Doc ini sudah ada di SIPP - akan MENGGANTINYA", "tampilan", ["pp", "panitera", "panmud", "hakim"], [".aleta-l1-edoc-cek"]),
  e("form.saran-sela", "form", "Saran putusan sela", "Saran di samping kolom putusan sela dengan tombol Pakai saran.", "Saran: ... - Pakai saran", "aksi", ["hakim", "pp"], ['[data-m1="saran-sela"]']),

  // ── penetapan ──────────────────────────────────────────────────────────────
  e("penetapan.otomatis", "penetapan", "Tombol dan panel \"Penetapan Otomatis\"", "Tombol yang membuka panel penetapan PMH/PPP/PJS/PHS otomatis.", "Penetapan Otomatis", "aksi", ["pimpinan", "panitera", "panmud", "hakim"], ["#aleta-pensipp-tombol", "#aleta-pensipp-panel"]),
  e("penetapan.bantu-form", "penetapan", "Kotak bantu form penetapan", "Kotak di form penetapan untuk sidang keliling dan agenda sidang.", "Sidang keliling  Agenda sidang  Terapkan", "aksi", ["pimpinan", "panitera", "panmud", "hakim"], [".aleta-pb"]),

  // ── putusan ────────────────────────────────────────────────────────────────
  e("putusan.otomatis", "putusan", "Tombol dan panel \"Putusan Otomatis\"", "Tombol yang membuka panel unggah putusan, anonimisasi, dan e-Doc sekaligus.", "Putusan Otomatis", "aksi", MAJELIS, ["#aleta-pusipp-tombol", "#aleta-pusipp-panel"]),

  // ── mediasi ────────────────────────────────────────────────────────────────
  e("mediasi.unggah", "mediasi", "Tombol \"Unggah hasil mediasi\"", "Tombol di tab Mediasi untuk mengarsipkan dokumen hasil mediasi.", "Unggah hasil mediasi", "aksi", ["mediator", "hakim", "pp", "panitera"], ["td[data-am-pasang] > .aleta-sisip"]),

  // ── kasir ──────────────────────────────────────────────────────────────────
  e("kasir.tombol", "kasir", "Tombol \"Kasir ALETA\"", "Tombol di bawah judul perkara untuk membuka jurnal keuangan perkara.", "Kasir ALETA", "aksi", ["kasir", "panitera", "panmud"], ["#aleta-kj-wadah", "#aleta-kj-tombol"]),
  e("kasir.panduan", "kasir", "Kartu Panduan kasir", "Kartu langkah demi langkah di halaman kasir.", "Panduan kasir - langkah 1 dari 5", "tampilan", ["kasir"], [".aleta-pk"]),

  // ── data pihak ─────────────────────────────────────────────────────────────
  e("pihak.ejaan", "pihak", "Usulan ejaan nama", "Usulan ejaan baku di bawah kolom nama dengan tombol salin.", "Ejaan baku: ... - Salin ejaan baku", "aksi", ["ptsp", "panmud", "pp"], ["#aleta-ejaan-usulan"]),
  e("pihak.chip", "pihak", "Chip pihak dan petunjuk tab", "Chip nama pihak untuk berpindah antar pihak di form.", "Tab: Penggugat  Tergugat", "aksi", ["ptsp", "panmud"], [".aleta-pl-isian"]),

  // ── beranda ────────────────────────────────────────────────────────────────
  e("beranda.muat-ulang", "beranda", "Kartu \"Hasil tadi\"", "Kartu ringkas hasil muat ulang data sesudah pekerjaan ALETA.", "Hasil tadi (09.12) - Segarkan sekarang", "tampilan", SEMUA, [".aleta-mu"]),
]);

export const KUNCI_TAMPILAN_SIPP: ReadonlySet<string> = new Set(KATALOG_TAMPILAN_SIPP.map((x) => x.kunci));

export function elemenTampilanSipp(kunci: string): ElemenTampilanSipp | null {
  return KATALOG_TAMPILAN_SIPP.find((x) => x.kunci === kunci) ?? null;
}

// ============================================================================
// ATURAN ADMIN
// ============================================================================

export const MODE_ATURAN = ["boleh", "selalu", "tidak"] as const;
export type ModeAturan = (typeof MODE_ATURAN)[number];

export const LABEL_MODE_ATURAN: Record<ModeAturan, string> = {
  boleh: "Boleh diatur pengguna",
  selalu: "Selalu tampil",
  tidak: "Tidak tersedia",
};

/** bawaan hanya bermakna untuk "boleh": nyala/mati sebelum pengguna memilih. */
export type AturanElemen = { mode: ModeAturan; bawaan: boolean };
export type AturanTampilanSipp = Record<string, AturanElemen>;

export const LINGKUP_ATURAN = ["peran", "pengguna"] as const;
export type LingkupAturan = (typeof LINGKUP_ATURAN)[number];

export type BarisAturanTampilanSipp = {
  lingkup: LingkupAturan;
  /** golongan peran (lingkup peran) atau id pengguna (lingkup pengguna). */
  sasaran: string;
  aturan: AturanTampilanSipp;
  catatan: string;
  diubahOleh: string;
  diubahPada: string;
};

export class GalatTampilanSipp extends Error {}

export function golonganSah(x: unknown): x is GolonganPeran {
  return typeof x === "string" && (GOLONGAN_PERAN as readonly string[]).includes(x);
}

/** Hanya kunci katalog dan mode yang dikenal; sisanya dibuang. */
export function bersihkanAturan(masukan: unknown): AturanTampilanSipp {
  const hasil: AturanTampilanSipp = {};
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) return hasil;
  const peta = masukan as Record<string, unknown>;
  for (const el of KATALOG_TAMPILAN_SIPP) {
    const a = peta[el.kunci];
    if (!a || typeof a !== "object" || Array.isArray(a)) continue;
    const mode = (a as { mode?: unknown }).mode;
    if (typeof mode !== "string" || !(MODE_ATURAN as readonly string[]).includes(mode)) continue;
    hasil[el.kunci] = { mode: mode as ModeAturan, bawaan: (a as { bawaan?: unknown }).bawaan !== false };
  }
  return hasil;
}

/** Pilihan pengguna: {kunci: boolean} hanya untuk kunci katalog. */
export function bersihkanPilihan(masukan: unknown): Record<string, boolean> {
  const hasil: Record<string, boolean> = {};
  if (!masukan || typeof masukan !== "object" || Array.isArray(masukan)) return hasil;
  const peta = masukan as Record<string, unknown>;
  for (const el of KATALOG_TAMPILAN_SIPP) if (typeof peta[el.kunci] === "boolean") hasil[el.kunci] = peta[el.kunci] as boolean;
  return hasil;
}

/**
 * Usulan aturan untuk satu golongan dari kolom "lazim" katalog: lazim = boleh
 * + nyala, lainnya = boleh + mati (pengguna tetap dapat menyalakannya).
 * Hanya dipakai bila admin menekan "Pakai usulan" - bukan bawaan sistem.
 */
export function usulanAturanPeran(golongan: GolonganPeran): AturanTampilanSipp {
  const hasil: AturanTampilanSipp = {};
  const pengelola = golongan === "super-admin" || golongan === "admin";
  for (const el of KATALOG_TAMPILAN_SIPP) {
    hasil[el.kunci] = { mode: "boleh", bawaan: pengelola || el.lazim.includes(golongan) };
  }
  return hasil;
}

// ============================================================================
// PEMECAH
// ============================================================================

export type SumberTampilanSipp = "sistem" | "peran" | "pengguna" | "pilihan";

export type ElemenBerlaku = {
  kunci: string;
  tampil: boolean;
  mode: ModeAturan;
  /** true = pengguna tidak dapat mengubahnya (selalu/tidak). */
  terkunci: boolean;
  /** Nyala/mati sebelum pilihan pengguna. */
  bawaan: boolean;
  sumber: SumberTampilanSipp;
  /** golongan / id pengguna asal aturan; '' untuk sistem/pilihan. */
  sasaranSumber: string;
};

const LONGGAR: Record<ModeAturan, number> = { boleh: 3, selalu: 2, tidak: 1 };

/** Gabungan aturan beberapa golongan untuk satu elemen: paling longgar menang; bawaan nyala bila salah satu nyala. */
function gabungPeran(daftar: { aturan: AturanElemen; sasaran: string }[]): { aturan: AturanElemen; sasaran: string } | null {
  if (!daftar.length) return null;
  let pilih = daftar[0];
  for (const x of daftar.slice(1)) if (LONGGAR[x.aturan.mode] > LONGGAR[pilih.aturan.mode]) pilih = x;
  const bawaan = daftar.some((x) => x.aturan.mode === pilih.aturan.mode && x.aturan.bawaan);
  return { aturan: { mode: pilih.aturan.mode, bawaan }, sasaran: pilih.sasaran };
}

export function pecahkanTampilanSipp(masukan: {
  aturan: readonly BarisAturanTampilanSipp[];
  penggunaId: string;
  golongan: readonly GolonganPeran[];
  pilihan?: Record<string, boolean> | null;
}): ElemenBerlaku[] {
  const pilihan = bersihkanPilihan(masukan.pilihan ?? {});
  const milikOrang = masukan.penggunaId
    ? masukan.aturan.find((b) => b.lingkup === "pengguna" && b.sasaran === String(masukan.penggunaId)) ?? null
    : null;
  const milikPeran = masukan.golongan
    .map((g) => masukan.aturan.find((b) => b.lingkup === "peran" && b.sasaran === g) ?? null)
    .filter((b): b is BarisAturanTampilanSipp => b !== null);

  return KATALOG_TAMPILAN_SIPP.map((el) => {
    let aturan: AturanElemen = { mode: "boleh", bawaan: true };
    let sumber: SumberTampilanSipp = "sistem";
    let sasaranSumber = "";
    const orang = milikOrang ? bersihkanAturan(milikOrang.aturan)[el.kunci] : undefined;
    if (orang) {
      aturan = orang;
      sumber = "pengguna";
      sasaranSumber = milikOrang!.sasaran;
    } else {
      const g = gabungPeran(
        milikPeran
          .map((b) => ({ aturan: bersihkanAturan(b.aturan)[el.kunci], sasaran: b.sasaran }))
          .filter((x): x is { aturan: AturanElemen; sasaran: string } => Boolean(x.aturan))
      );
      if (g) {
        aturan = g.aturan;
        sumber = "peran";
        sasaranSumber = g.sasaran;
      }
    }
    const terkunci = aturan.mode !== "boleh";
    const bawaan = aturan.mode === "selalu" ? true : aturan.mode === "tidak" ? false : aturan.bawaan;
    let tampil = bawaan;
    if (!terkunci && typeof pilihan[el.kunci] === "boolean") {
      tampil = pilihan[el.kunci];
      if (tampil !== bawaan) {
        sumber = "pilihan";
        sasaranSumber = "";
      }
    }
    return { kunci: el.kunci, tampil, mode: aturan.mode, terkunci, bawaan, sumber, sasaranSumber };
  });
}

/**
 * Pilihan pengguna yang akan disimpan: kunci terkunci dibuang (dan disebut),
 * pilihan yang sama dengan bawaannya tidak disimpan supaya perubahan bawaan
 * admin kelak tetap sampai kepadanya.
 */
export function saringPilihanBaru(
  berlaku: readonly ElemenBerlaku[],
  pilihanBaru: unknown
): { pilihan: Record<string, boolean>; ditolak: string[] } {
  const masuk = bersihkanPilihan(pilihanBaru);
  const peta = new Map(berlaku.map((b) => [b.kunci, b]));
  const pilihan: Record<string, boolean> = {};
  const ditolak: string[] = [];
  for (const [kunci, nilai] of Object.entries(masuk)) {
    const b = peta.get(kunci);
    if (!b) continue;
    if (b.terkunci) {
      ditolak.push(kunci);
      continue;
    }
    if (nilai !== b.bawaan) pilihan[kunci] = nilai;
  }
  return { pilihan, ditolak };
}

/** Yang dikirim ke ekstensi: hanya elemen tersembunyi beserta penyaringnya. */
export type SembunyiEkstensi = { kunci: string; pilih: string[]; bayang?: { tuan: string; pilih: string[] }; gaya?: string };

export function sembunyiUntukEkstensi(berlaku: readonly ElemenBerlaku[]): SembunyiEkstensi[] {
  const hasil: SembunyiEkstensi[] = [];
  for (const b of berlaku) {
    if (b.tampil) continue;
    const el = elemenTampilanSipp(b.kunci);
    if (!el) continue;
    const x: SembunyiEkstensi = { kunci: el.kunci, pilih: [...el.pilih] };
    if (el.bayang) x.bayang = { tuan: el.bayang.tuan, pilih: [...el.bayang.pilih] };
    if (el.gayaSembunyi) x.gaya = el.gayaSembunyi;
    hasil.push(x);
  }
  return hasil;
}

/** Penyaring yang aman ditanam ke lembar gaya: tanpa kurung kurawal, titik koma, '<', '@', atau url(. */
export function penyaringAman(sel: string): boolean {
  return typeof sel === "string" && sel.length > 0 && sel.length <= 200 && !/[{};<@\\]|url\(/i.test(sel);
}

/** Sidik pendek atas yang disembunyikan - ekstensi membandingkannya dengan singgahannya. */
export function versiSembunyi(sembunyi: readonly SembunyiEkstensi[]): string {
  const teks = sembunyi.map((s) => s.kunci).sort().join(",");
  let h = 2166136261;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ts1-${(h >>> 0).toString(16).padStart(8, "0")}`;
}
