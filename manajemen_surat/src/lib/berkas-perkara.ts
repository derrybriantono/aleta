/**
 * ============================================================================
 * SAMPUL BERKAS DAN DAFTAR ISI BERKAS - ATURAN MURNI (26 Okt 2026)
 * ============================================================================
 *
 * Rancangan: docs/rancangan/sampul-daftar-isi-26okt/RANCANGAN.md (bagian 9-14). Berkas ini murni: tanpa jaringan dan tanpa basis data.
 * Dipakai rute portal (naskah RTF, simpan sunting) dan diuji; layar kerja di ekstensi (ekstensi-sipp/blangko-derry-berkas.js) memegang
 * kembaran kecil bagian hitung halaman dan dijaga sama oleh berkas-perkara-26okt.test.ts.
 *
 * Isi:
 *   - ukuran kertas (A4 bawaan, F4/Folio, Legal) dan nama berkas blangko per ukuran;
 *   - ciri (25; NON e-COURT sudah dihapus, keputusan Derry 26 Okt) dan rangkaiannya untuk isian #5801#;
 *   - halaman: urai ketikan ("3", "5-9"), hitung rentang kumulatif per bundel, total dan komposisi sumber;
 *   - kolom tabel daftar isi (No, Jenis Dokumen, Tanggal, Halaman) untuk isian ABT 5851-5854 (Bundel A) dan 5856-5859 (Bundel B).
 *
 * Sumber halaman: "pasti" (dibaca dari berkas), "perkiraan" (nilai bawaan per jenis dokumen), "manual" (diketik petugas). Cetakan TIDAK
 * menandai perkiraan (keputusan Derry 26 Okt, butir B); penanda hanya di layar kerja.
 */

export type KodeKertas = "a4" | "f4" | "legal";
export type JenisBlangkoBerkas = "sampul" | "daftar-isi" | "ceklist";
/** Bentuk sampul: "awal" = sampul cetak awal (bawaan, keputusan Derry 26 Okt); "lengkap" = sampul lengkap (blangko pilihan kedua). */
export type BentukSampul = "awal" | "lengkap";
export type SumberHalaman = "pasti" | "perkiraan" | "manual";

/** barisRiwayat = sampul lengkap; barisAwal = sampul cetak awal (15 di A4, 18 di F4, 20 di Legal). */
export const KERTAS: Readonly<Record<KodeKertas, { nama: string; akhiran: string; lebarMm: number; tinggiMm: number; barisRiwayat: number; barisAwal: number }>> = {
  a4: { nama: "A4 (210 x 297 mm)", akhiran: "", lebarMm: 210, tinggiMm: 297, barisRiwayat: 12, barisAwal: 15 },
  f4: { nama: "F4 / Folio (215 x 330 mm)", akhiran: " (F4)", lebarMm: 215, tinggiMm: 330, barisRiwayat: 15, barisAwal: 18 },
  legal: { nama: "Legal (216 x 356 mm)", akhiran: " (Legal)", lebarMm: 216, tinggiMm: 356, barisRiwayat: 18, barisAwal: 20 },
};
export const URUTAN_KERTAS: readonly KodeKertas[] = ["a4", "f4", "legal"];
export const KERTAS_BAWAAN: KodeKertas = "a4";

export function kodeKertasSah(x: unknown): x is KodeKertas {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(KERTAS, x);
}

const AKAR_DERRY = "derry_briantono";
export const FOLDER_SAMPUL = `${AKAR_DERRY}/99 PTSP`;
export const FOLDER_DAFTAR_ISI = `${AKAR_DERRY}/98b Berkas Perkara - BAS`;
const DASAR_BERKAS: Readonly<Record<JenisBlangkoBerkas, string>> = { sampul: "Sampul Berkas Perkara", "daftar-isi": "Daftar Isi Berkas", ceklist: "Ceklist Berkas Perkara" };

/**
 * Folder dan nama berkas RTF (dipasang paket ABT abt-sampul-daftar-isi-26okt). Sampul = folder PTSP, daftar isi = folder BAS Panitera Sidang.
 * Sampul cetak awal (bawaan): "Sampul Berkas Perkara" untuk perkara BERLAWANAN (gugatan dan cerai talak), "... (Permohonan)" untuk permohonan;
 * sampul lengkap: "Sampul Berkas Perkara (Lengkap)". Akhiran ukuran " (F4)" / " (Legal)" paling belakang.
 */
export function berkasBlangko(
  jenis: JenisBlangkoBerkas,
  kertas: KodeKertas,
  opsi: { bentuk?: BentukSampul; lawan?: boolean; banyak?: boolean } = {}
): { folder: string; berkas: string; jenisFolder: "ptsp" | "bas" } {
  const bentuk: BentukSampul = opsi.bentuk === "lengkap" ? "lengkap" : "awal";
  const lawan = opsi.lawan !== false;
  const tengah =
    jenis !== "sampul" ? "" : bentuk === "lengkap" ? " (Lengkap)" : lawan ? (opsi.banyak ? " (Pihak Banyak)" : "") : opsi.banyak ? " (Permohonan Pihak Banyak)" : " (Permohonan)";
  return {
    folder: jenis === "daftar-isi" ? FOLDER_DAFTAR_ISI : FOLDER_SAMPUL,
    berkas: `${DASAR_BERKAS[jenis]}${tengah}${KERTAS[kertas].akhiran}.rtf`,
    jenisFolder: jenis === "daftar-isi" ? "bas" : "ptsp",
  };
}

/** Berkas varian (ukuran F4/Legal, "(Permohonan)", "(Pihak Banyak)") tidak ditampilkan di daftar blangko: ukuran dipilih di layar kerja, varian dipilih menurut perkara. */
export function berkasVarianUkuran(nama: string): boolean {
  const n = String(nama || "").trim();
  if (/^(Sampul Berkas Perkara( \((Permohonan|Lengkap|Pihak Banyak|Permohonan Pihak Banyak)\))?|Daftar Isi Berkas|Ceklist Berkas Perkara) \((F4|Legal)\)\.rtf$/i.test(n)) return true;
  return /^Sampul Berkas Perkara \((Permohonan|Pihak Banyak|Permohonan Pihak Banyak)\)\.rtf$/i.test(n);
}

/** Jenis layar kerja untuk sebuah berkas blangko Derry (nama dasar saja); "" bila bukan Sampul/Daftar Isi. */
export function jenisLayarBerkas(folder: string, nama: string): JenisBlangkoBerkas | "" {
  const f = String(folder || "").replace(/^\/+|\/+$/g, "").replace(/^derry_briantono\//, "");
  const n = String(nama || "").trim();
  if (f === "99 PTSP" && /^Sampul Berkas Perkara( \(Lengkap\))?\.rtf$/i.test(n)) return "sampul";
  if (f === "98b Berkas Perkara - BAS" && /^Daftar Isi Berkas\.rtf$/i.test(n)) return "daftar-isi";
  if (f === "99 PTSP" && /^Ceklist Berkas Perkara\.rtf$/i.test(n)) return "ceklist";
  return "";
}

/** Bentuk sampul menurut nama berkas yang dibuka ("(Lengkap)" = lengkap; selain itu cetak awal). */
export function bentukDariBerkas(nama: string): BentukSampul {
  return /\(Lengkap\)/i.test(String(nama || "")) ? "lengkap" : "awal";
}

// ---------------------------------------------------------------------------
// Ciri
// ---------------------------------------------------------------------------
export type KelompokCiri = "a" | "b" | "c";
export const LAMBANG_CIRI: Readonly<Record<KelompokCiri, string>> = { a: "■", b: "●", c: "▲" };

export type DefinisiCiri = { kunci: string; nama: string; kelompok: KelompokCiri; sisi?: string; penting?: boolean; kodeAbt: number };
/** 25 ciri (NON e-COURT dihapus). kodeAbt = nomor variabel ABT paket (5804 sengaja kosong). */
export const DAFTAR_CIRI: readonly DefinisiCiri[] = [
  { kunci: "prodeo", nama: "PRODEO", kelompok: "a", kodeAbt: 5802 },
  { kunci: "ecourt", nama: "e-COURT", kelompok: "a", kodeAbt: 5803 },
  { kunci: "kuasa", nama: "KUASA HUKUM", kelompok: "a", sisi: "P", kodeAbt: 5805 },
  { kunci: "insidentil", nama: "KUASA INSIDENTIL", kelompok: "a", kodeAbt: 5806 },
  { kunci: "ghaib", nama: "GHAIB", kelompok: "b", sisi: "T", penting: true, kodeAbt: 5807 },
  { kunci: "mafqud", nama: "MAFQUD", kelompok: "b", penting: true, kodeAbt: 5808 },
  { kunci: "pns", nama: "PNS/ASN", kelompok: "b", sisi: "T", kodeAbt: 5809 },
  { kunci: "pppk", nama: "PPPK", kelompok: "b", kodeAbt: 5810 },
  { kunci: "tni", nama: "TNI", kelompok: "b", kodeAbt: 5811 },
  { kunci: "polri", nama: "POLRI", kelompok: "b", kodeAbt: 5812 },
  { kunci: "bumn", nama: "BUMN/BUMD", kelompok: "b", kodeAbt: 5813 },
  { kunci: "disabilitas", nama: "DISABILITAS", kelompok: "b", sisi: "P", kodeAbt: 5814 },
  { kunci: "penerjemah", nama: "PENERJEMAH", kelompok: "b", kodeAbt: 5815 },
  { kunci: "wna", nama: "WNA", kelompok: "b", kodeAbt: 5816 },
  { kunci: "verstek", nama: "VERSTEK", kelompok: "c", penting: true, kodeAbt: 5817 },
  { kunci: "kumulasi", nama: "KUMULASI", kelompok: "c", sisi: "2", kodeAbt: 5818 },
  { kunci: "rekonvensi", nama: "REKONVENSI", kelompok: "c", kodeAbt: 5819 },
  { kunci: "mediasi", nama: "MEDIASI", kelompok: "c", kodeAbt: 5820 },
  { kunci: "sita", nama: "SITA", kelompok: "c", kodeAbt: 5821 },
  { kunci: "keliling", nama: "SIDANG KELILING", kelompok: "c", kodeAbt: 5822 },
  { kunci: "tunggal", nama: "HAKIM TUNGGAL", kelompok: "c", kodeAbt: 5823 },
  { kunci: "sederhana", nama: "GUGATAN SEDERHANA", kelompok: "c", kodeAbt: 5824 },
  { kunci: "verzet", nama: "VERZET", kelompok: "c", kodeAbt: 5825 },
  { kunci: "dispensasi", nama: "DISPENSASI KAWIN", kelompok: "c", kodeAbt: 5826 },
  { kunci: "ikrar", nama: "IKRAR TALAK", kelompok: "c", kodeAbt: 5827 },
];
export const KUNCI_CIRI: readonly string[] = DAFTAR_CIRI.map((c) => c.kunci);

/** Pemisah antar ciri (tanpa kurung atau tanda + dan >; permintaan 27 Okt). */
export const SEPARATOR_CIRI = "  ·  ";

/** Satu ciri untuk dicetak, mis. "■ KUASA HUKUM P". */
export function teksCiri(c: DefinisiCiri): string {
  return `${LAMBANG_CIRI[c.kelompok]} ${c.nama}${c.sisi ? ` ${c.sisi}` : ""}`;
}

/** Isian #5801#: ciri yang berlaku, dipisah dua spasi; tak satu pun = kalimat netral. */
export function rangkaiCiri(aktif: Iterable<string>): string {
  const set = new Set(aktif);
  const teks = DAFTAR_CIRI.filter((c) => set.has(c.kunci)).map(teksCiri);
  return teks.length ? teks.join(SEPARATOR_CIRI) : "- tidak ada ciri khusus -";
}

/** Keadaan ciri: otomatis (dari data perkara) ditimpa tangan bila ada. */
export function cirKeadaanEfektif(otomatis: Record<string, boolean>, tangan: Record<string, boolean>): Record<string, boolean> {
  const hasil: Record<string, boolean> = {};
  for (const k of KUNCI_CIRI) hasil[k] = Object.prototype.hasOwnProperty.call(tangan, k) ? Boolean(tangan[k]) : Boolean(otomatis[k]);
  return hasil;
}

// ---------------------------------------------------------------------------
// Sampul cetak awal (keputusan Derry 26 Okt, versi 4)
// ---------------------------------------------------------------------------
/** Ciri yang TIDAK menjadi lencana di sampul cetak awal: verstek (sifat putusan), rekonvensi dan sita (kotak centang susulan), mediasi (pita mediasi), kumulasi (sudah di judul). */
export const CIRI_BUKAN_LENCANA_AWAL: readonly string[] = ["verstek", "rekonvensi", "sita", "mediasi", "kumulasi"];
/** Ciri berbingkai ganda di sampul cetak awal (mengubah cara pemeriksaan); tercetak di runut sendiri (variabel 5807 dan 5808). */
export const CIRI_BINGKAI_GANDA_AWAL: readonly string[] = ["ghaib", "mafqud"];

/**
 * Isian sampul cetak awal dari ciri yang berlaku: 5861 = lencana biasa, 5807 = ghaib, 5808 = mafqud (bingkai ganda). `sisiDari` = sisi/jumlah dari data
 * perkara (mis. kuasa "P+T", kumulasi "2"); tanpa itu dipakai sisi bawaan daftar ciri.
 */
export function ciriSampulAwal(aktif: Record<string, boolean>, sisiDari: Record<string, string> = {}): { "5861": string; "5807": string; "5808": string } {
  const teks = (c: DefinisiCiri) => teksCiri({ ...c, sisi: sisiDari[c.kunci] || c.sisi });
  const biasa = DAFTAR_CIRI.filter((c) => aktif[c.kunci] && !CIRI_BUKAN_LENCANA_AWAL.includes(c.kunci) && !CIRI_BINGKAI_GANDA_AWAL.includes(c.kunci)).map(teks);
  const satu = (k: string) => {
    const c = DAFTAR_CIRI.find((x) => x.kunci === k);
    return c && aktif[k] ? teks(c) : "";
  };
  return { "5861": biasa.length ? biasa.join(SEPARATOR_CIRI) : "- tidak ada ciri khusus -", "5807": satu("ghaib"), "5808": satu("mafqud") };
}

/** Ciri susulan sampul cetak awal (kotak centang): kunci, nama tercetak. Daftar menurut jenis perkara; yang terdeteksi dari data dicentang otomatis, sisanya dicentang tangan. */
export type DefinisiSusulan = { kunci: string; nama: string };
export const KUNCI_SUSULAN: readonly string[] = ["mediasi", "eksepsi", "rekonvensi", "sita", "setempat", "sela", "ubah", "panjar", "cabut", "perbaikan", "anak", "umum"];
const NAMA_SUSULAN: Readonly<Record<string, string>> = {
  mediasi: "MEDIASI",
  eksepsi: "EKSEPSI",
  rekonvensi: "REKONVENSI",
  sita: "PERMINTAAN SITA",
  setempat: "PEMERIKSAAN SETEMPAT",
  sela: "PUTUSAN SELA",
  ubah: "PERUBAHAN GUGATAN",
  panjar: "TAMBAHAN PANJAR",
  cabut: "PENCABUTAN",
  perbaikan: "PERBAIKAN PERMOHONAN",
  anak: "ANAK & CALON DIDENGAR",
  umum: "PENGUMUMAN 14 HARI",
};
const SUSULAN_LAWAN = ["mediasi", "eksepsi", "rekonvensi", "sita", "setempat", "sela", "ubah", "panjar", "cabut"];
const SUSULAN_MOHON = ["perbaikan", "setempat", "panjar", "cabut"];

/** `jenis` = kunci jenis sampul ("dk" menambah ANAK & CALON DIDENGAR, "in" menambah PENGUMUMAN 14 HARI). Perkara berlawanan: sembilan ciri; permohonan: empat (+ khas). */
export function daftarSusulan(jenis: string, lawan: boolean): DefinisiSusulan[] {
  const kunci = lawan ? SUSULAN_LAWAN : [...SUSULAN_MOHON, ...(jenis === "dk" ? ["anak"] : jenis === "in" ? ["umum"] : [])];
  return kunci.map((k) => ({ kunci: k, nama: NAMA_SUSULAN[k] }));
}

/** Isian #5862#: "[X] NAMA (oto)" terdeteksi dari data, "[X] NAMA" dicentang tangan, "[ ] NAMA" kosong; dipisah tiga spasi. */
export function rangkaiSusulan(daftar: DefinisiSusulan[], centang: Record<string, boolean>, oto: Record<string, boolean>): string {
  return daftar
    .map((d) => {
      const on = Boolean(centang[d.kunci]);
      return `${on ? "[X]" : "[ ]"} ${d.nama}${on && oto[d.kunci] ? " (oto)" : ""}`;
    })
    .join("   ");
}

/** Keadaan efektif ciri susulan: tangan menimpa otomatis; yang tidak terbaca (tidak ada di `oto`) tidak dicentang. */
export function susulanEfektif(daftar: DefinisiSusulan[], oto: Record<string, boolean>, tangan: Record<string, boolean>): Record<string, boolean> {
  const hasil: Record<string, boolean> = {};
  for (const d of daftar) hasil[d.kunci] = Object.prototype.hasOwnProperty.call(tangan, d.kunci) ? Boolean(tangan[d.kunci]) : Boolean(oto[d.kunci]);
  return hasil;
}

const KOTAK_KOSONG = "{\\f1\\u9744?}";
const KOTAK_ISI = "{\\f1\\u9746?}";
/**
 * Merapikan naskah sampul cetak awal sesudah ABT mengisinya: kotak centang ASCII "[ ]" / "[X]" dari variabel menjadi karakter kotak (renderer ABT merusak
 * karakter di atas 255), dan tanda "..." untuk variabel kosong dibuang (kolom itu ditulis tangan). Murni.
 */
export function rapikanSampulAwal(rtf: string): string {
  return rtf
    .replace(/\[ \]/g, KOTAK_KOSONG)
    .replace(/\[X\]/g, KOTAK_ISI)
    .replace(/\{\\highlight\d+ \.\.\.\}/g, "")
    .replace(/(?<![.\w])\.\.\.(?![.\w])/g, "");
}

// ---------------------------------------------------------------------------
// Halaman
// ---------------------------------------------------------------------------
export type UraiHalaman = { tipe: "oto" } | { tipe: "jumlah"; n: number } | { tipe: "rentang"; a: number; b: number } | { tipe: "salah" };

/** "" = otomatis; "3" = tiga halaman; "5-9" (juga tanda pisah en) = mulai halaman 5 sampai 9; selain itu salah. */
export function uraiHalaman(teks: unknown): UraiHalaman {
  const t = String(teks ?? "").trim();
  if (!t) return { tipe: "oto" };
  let m = t.match(/^(\d{1,3})$/);
  if (m && Number(m[1]) >= 1) return { tipe: "jumlah", n: Number(m[1]) };
  m = t.match(/^(\d{1,3})\s*[-–]\s*(\d{1,3})$/);
  if (m && Number(m[1]) >= 1 && Number(m[2]) >= Number(m[1])) return { tipe: "rentang", a: Number(m[1]), b: Number(m[2]) };
  return { tipe: "salah" };
}

/**
 * Nilai bawaan jumlah halaman per jenis dokumen: median arsip 2026 (diukur baca-saja 26 Okt 2026 atas 40 perkara minutasi; RANCANGAN.md 9.1).
 * Tabel aleta_berkas_bawaan (dipelajari ulang tiap bulan) menimpa nilai ini.
 */
export const BAWAAN_HALAMAN: Readonly<Record<string, number>> = {
  gugatan: 3,
  permohonan: 4,
  penetapan: 1,
  phs: 2,
  relaas: 4,
  resi: 4,
  bas: 3,
  putusan: 13,
  pemberitahuan: 4,
  "akta-cerai": 1,
  ikrar: 3,
  jawaban: 3,
  replik: 1,
  duplik: 2,
  kesimpulan: 2,
  bukti: 2,
  kuasa: 2,
  skum: 1,
  slip: 1,
  sktm: 1,
  mediator: 1,
  "laporan-mediasi": 2,
  minutasi: 1,
  bht: 1,
  lain: 1,
};

export function halamanBawaan(jenis: string, tabel?: Record<string, number> | null): number {
  const n = tabel && Number.isFinite(tabel[jenis]) ? Number(tabel[jenis]) : BAWAAN_HALAMAN[jenis];
  return Number.isFinite(n) && n >= 1 ? Math.round(n) : 1;
}

export type BarisDasar = {
  bundel: "A" | "B";
  grup: string;
  kunci: string;
  nama: string;
  ket?: string;
  tanggal: string;
  halaman: number;
  sumber: "pasti" | "perkiraan";
  dasar?: string;
};
export type SunganBaris = {
  tampil: boolean;
  urutan: number;
  halamanTeks: string;
  judulManual: string;
  tanggalManual: string;
  tambahan: boolean;
};
export type BarisHitung = BarisDasar & {
  tersembunyi: boolean;
  tambahan: boolean;
  halamanTeks: string;
  salah: boolean;
  jumlah: number;
  sumberAkhir: SumberHalaman;
  awal: number | null;
  akhir: number | null;
  peringatan: string;
};
export type TotalBundel = { dokumen: number; halaman: number; pasti: number; perkiraan: number; manual: number; akhir: number };

/**
 * Susunan akhir sebuah bundel: urutan tersimpan dipakai; baris baru (belum pernah disunting) disisipkan di depan tetangga bawaan berikutnya
 * yang sudah punya tempat, bukan dilempar ke ujung; baris tambahan petugas di ujung menurut urutannya.
 */
export function susunUrutan(kunciDasar: string[], urutanTersimpan: Record<string, number>, kunciTambahan: string[]): string[] {
  const dikenal = [...kunciDasar, ...kunciTambahan].filter((k) => (urutanTersimpan[k] ?? 0) > 0).sort((a, b) => (urutanTersimpan[a] ?? 0) - (urutanTersimpan[b] ?? 0));
  if (!dikenal.length) return [...kunciDasar, ...kunciTambahan];
  const hasil = [...dikenal];
  for (const k of kunciDasar) {
    if (hasil.includes(k)) continue;
    const idx = kunciDasar.indexOf(k);
    let sisip = hasil.length;
    for (let q = idx + 1; q < kunciDasar.length; q += 1) {
      const pos = hasil.indexOf(kunciDasar[q]);
      if (pos >= 0) {
        sisip = pos;
        break;
      }
    }
    hasil.splice(sisip, 0, k);
  }
  for (const k of kunciTambahan) if (!hasil.includes(k)) hasil.push(k);
  return hasil;
}

/**
 * Menghitung halaman berjalan per bundel. `baris` = baris dasar menurut urutan akhir (sudah termasuk baris tambahan sebagai BarisDasar
 * dengan halaman 1); `sunting` = peta kunci -> sunting petugas. Bundel A mulai 1; Bundel B mulai 1 atau lanjut dari akhir A.
 *
 *   - halaman manual "n" menimpa jumlah; "a-b" juga menetapkan AWAL (baris sesudahnya melanjutkan dari b);
 *   - awal yang melompat atau tumpang tindih diberi peringatan, tidak ditolak;
 *   - baris tersembunyi tidak dihitung; ketikan tidak sah diabaikan (dipakai otomatis) dan ditandai `salah`.
 */
export function hitungDaftarIsi(
  baris: BarisDasar[],
  sunting: Record<string, Partial<SunganBaris>>,
  opsi: { bundelB?: "1" | "lanjut" } = {}
): { baris: BarisHitung[]; total: Record<"A" | "B", TotalBundel> } {
  const total: Record<"A" | "B", TotalBundel> = {
    A: { dokumen: 0, halaman: 0, pasti: 0, perkiraan: 0, manual: 0, akhir: 0 },
    B: { dokumen: 0, halaman: 0, pasti: 0, perkiraan: 0, manual: 0, akhir: 0 },
  };
  const hasil: BarisHitung[] = [];
  for (const bundel of ["A", "B"] as const) {
    let kursor = bundel === "B" && opsi.bundelB === "lanjut" ? total.A.akhir + 1 : 1;
    for (const dasar of baris.filter((b) => b.bundel === bundel)) {
      const s = sunting[dasar.kunci] || {};
      const tambahan = Boolean(s.tambahan);
      const u = uraiHalaman(s.halamanTeks);
      let jumlah = dasar.halaman;
      let sumber: SumberHalaman = tambahan ? "manual" : dasar.sumber;
      let awalPin: number | null = null;
      if (u.tipe === "jumlah") {
        jumlah = u.n;
        sumber = "manual";
      } else if (u.tipe === "rentang") {
        jumlah = u.b - u.a + 1;
        sumber = "manual";
        awalPin = u.a;
      }
      const b: BarisHitung = {
        ...dasar,
        nama: tambahan && s.judulManual ? String(s.judulManual) : dasar.nama,
        tanggal: tambahan && s.tanggalManual != null ? String(s.tanggalManual) : dasar.tanggal,
        tersembunyi: s.tampil === false,
        tambahan,
        halamanTeks: String(s.halamanTeks ?? ""),
        salah: u.tipe === "salah",
        jumlah,
        sumberAkhir: sumber,
        awal: null,
        akhir: null,
        peringatan: "",
      };
      if (!b.tersembunyi) {
        const awal = awalPin ?? kursor;
        if (awalPin != null && awalPin < kursor) b.peringatan = "tumpang tindih dengan baris sebelumnya";
        if (awalPin != null && awalPin > kursor) b.peringatan = `ada halaman terlewat (${kursor}-${awalPin - 1})`;
        b.awal = awal;
        b.akhir = awal + jumlah - 1;
        kursor = b.akhir + 1;
        const t = total[bundel];
        t.dokumen += 1;
        t.halaman += jumlah;
        t.akhir = b.akhir;
        if (sumber === "pasti") t.pasti += jumlah;
        else if (sumber === "perkiraan") t.perkiraan += jumlah;
        else t.manual += jumlah;
      }
      hasil.push(b);
    }
  }
  return { baris: hasil, total };
}

export function teksRentang(b: { awal: number | null; akhir: number | null }): string {
  if (b.awal == null || b.akhir == null) return "";
  return b.awal === b.akhir ? String(b.awal) : `${b.awal}-${b.akhir}`;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
/** "2026-03-12" -> "12 Maret 2026"; selain tanggal ISO dikembalikan apa adanya (tanggal ketikan petugas). */
export function tanggalIndonesia(t: string): string {
  const m = String(t || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(t || "");
  return `${Number(m[3])} ${BULAN[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Empat kolom tabel RTF per bundel dari baris hasil hitung: tiap kolom satu teks bergaris banyak ("\n" = baris baru; mesin isian bot
 * mengubahnya menjadi \par). Baris judul bagian (grup) muncul sekali per perubahan grup dengan nomor dan tanggal kosong; hanya baris
 * yang tampil. Satu dokumen satu baris (nama dipotong 52 karakter). Selalu sama panjang di keempat kolom.
 */
export function kolomDaftarIsi(baris: BarisHitung[], bundel: "A" | "B"): { no: string; dokumen: string; tanggal: string; halaman: string } {
  const no: string[] = [];
  const dokumen: string[] = [];
  const tanggal: string[] = [];
  const halaman: string[] = [];
  let grup = "";
  let nomor = 0;
  for (const b of baris.filter((x) => x.bundel === bundel && !x.tersembunyi)) {
    if (b.grup !== grup) {
      grup = b.grup;
      no.push("");
      dokumen.push(grup);
      tanggal.push("");
      halaman.push("");
    }
    nomor += 1;
    no.push(String(nomor));
    const nama = `${b.nama}${b.ket ? ` - ${b.ket}` : ""}`.replace(/\s+/g, " ").trim();
    dokumen.push(nama.length > 52 ? `${nama.slice(0, 51)}.` : nama);
    tanggal.push(tanggalIndonesia(b.tanggal));
    halaman.push(teksRentang(b));
  }
  if (!no.length) {
    no.push("");
    dokumen.push("Belum ada dokumen");
    tanggal.push("");
    halaman.push("");
  }
  return { no: no.join("\n"), dokumen: dokumen.join("\n"), tanggal: tanggal.join("\n"), halaman: halaman.join("\n") };
}

/** Nilai timpa ABT untuk daftar isi: 5851-5854 (Bundel A) dan 5856-5859 (Bundel B). */
export function nilaiTimpaDaftarIsi(baris: BarisHitung[]): Record<string, string> {
  const a = kolomDaftarIsi(baris, "A");
  const b = kolomDaftarIsi(baris, "B");
  return { "5851": a.no, "5852": a.dokumen, "5853": a.tanggal, "5854": a.halaman, "5856": b.no, "5857": b.dokumen, "5858": b.tanggal, "5859": b.halaman };
}

// ---------------------------------------------------------------------------
// Nilai timpa yang boleh dikirim klien ke mesin isian bot
// ---------------------------------------------------------------------------
const BATAS_NILAI = 6000;
export function kodeTimpaBoleh(kode: string): boolean {
  if (!/^\d{4}$/.test(kode)) return false;
  const n = Number(kode);
  // blok paket sampul/daftar isi (5700-5779 riwayat sidang, 5800-5899 ciri/jenis/daftar isi/sampul cetak awal) + isian tangan sampul 5845/5846 sudah termasuk.
  return (n >= 5700 && n <= 5779) || (n >= 5800 && n <= 5899);
}

/** Menyaring nilai timpa kiriman klien: hanya kode blok paket, teks, tanpa nama aplikasi, panjang dibatasi. */
export function saringNilaiTimpa(mentah: unknown): Record<string, string> {
  const hasil: Record<string, string> = {};
  if (!mentah || typeof mentah !== "object" || Array.isArray(mentah)) return hasil;
  for (const [kode, nilai] of Object.entries(mentah as Record<string, unknown>)) {
    if (!kodeTimpaBoleh(kode) || typeof nilai !== "string" || /aleta/i.test(nilai)) continue;
    hasil[kode] = nilai.slice(0, BATAS_NILAI);
    if (Object.keys(hasil).length >= 200) break;
  }
  return hasil;
}
