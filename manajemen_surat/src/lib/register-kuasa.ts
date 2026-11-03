/**
 * ============================================================================
 * REGISTER KUASA HUKUM PER PERKARA - ATURAN MURNI (3 Nov 2026)
 * ============================================================================
 *
 * Borang SIPP "Tambah/Ubah Data Kuasa Hukum" hanya punya Nomor/Tanggal SURAT kuasa. Nomor dan tanggal
 * REGISTER kuasa khusus di kepaniteraan disimpan ALETA (tabel aleta_register_kuasa, migrasi 0132) dan
 * dipakai blangko ABT lewat usulan isian #8539# (nomor) dan #0132# (tanggal).
 *
 * ATURAN (keputusan Derry 3 Nov):
 *   1. Satu NAMA kuasa (orang yang sama; dicocokkan tanpa gelar, tanda baca, spasi, besar-kecil huruf)
 *      dalam satu perkara = satu nomor dan satu tanggal register.
 *   2. Pihak lain yang memberi kuasa kepada kuasa yang sama IKUT nilai itu otomatis.
 *   3. Register BARU hanya bila kuasa itu ditambahkan pada TANGGAL LAIN: tanggal surat kuasa berbeda dari
 *      semua register yang ada untuk kuasa itu di perkara itu.
 *
 * Berkas ini disalin (logika yang sama) ke ekstensi-sipp/kuasa-register.js; uji register-kuasa-3nov
 * menjalankan keduanya dan membandingkan hasilnya.
 */

export type RegisterKuasa = {
  nomorRegister: string;
  tanggalRegister: string; // ISO yyyy-mm-dd atau ""
  tanggalSuratKuasa: string; // ISO yyyy-mm-dd atau ""
};

const GELAR =
  /\b(?:s\.?\s?h\.?\s?i|s\.?\s?h|m\.?\s?h\.?\s?i|m\.?\s?h|m\.?\s?kn|s\.?\s?ag|s\.?\s?e|m\.?\s?e|s\.?\s?pd|s\.?\s?sos|m\.?\s?si|s\.?\s?kom|c\.?\s?l\.?\s?a|c\.?\s?p\.?\s?l|adv|advokat|dr|drs|ir|hj|h|prof)\b\.?/g;

/** Kunci nama kuasa: huruf kecil, tanpa gelar, tanpa tanda baca dan spasi. */
export function kunciNamaKuasa(nama: string): string {
  return String(nama ?? "")
    .toLowerCase()
    .replace(GELAR, " ")
    .replace(/[^a-z]/g, "");
}

/** dd/mm/yyyy atau yyyy-mm-dd -> yyyy-mm-dd; selain itu "" (tanggal tidak mungkin ditolak). */
export function tanggalIso(nilai: string): string {
  const t = String(nilai ?? "").trim();
  let y: number, m: number, d: number;
  let cocok = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  if (cocok) {
    d = Number(cocok[1]);
    m = Number(cocok[2]);
    y = Number(cocok[3]);
  } else {
    cocok = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(t);
    if (!cocok) return "";
    y = Number(cocok[1]);
    m = Number(cocok[2]);
    d = Number(cocok[3]);
  }
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return "";
  const hariDalamBulan = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > hariDalamBulan) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** yyyy-mm-dd -> dd/mm/yyyy (bentuk isian SIPP); "" bila bukan tanggal. */
export function tanggalTampil(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export type PilihanRegister =
  /** Ada register yang berlaku untuk kuasa ini - dipakai (diisikan otomatis). */
  | { jenis: "pakai"; register: RegisterKuasa; sebab: "sama-tanggal" | "belum-ada-tanggal" }
  /** Kuasa sudah punya register, tetapi untuk tanggal surat kuasa lain: ini register BARU (isian kosong). */
  | { jenis: "baru"; lain: RegisterKuasa[] }
  /** Kuasa ini belum punya register di perkara ini. */
  | { jenis: "kosong" };

/**
 * Pilih register untuk satu kuasa dari daftar register kuasa itu di perkara itu.
 *  - tanggal surat kuasa BELUM diisi (pihak lain, kuasa sama): pakai register yang sudah ada (yang terbaru dicatat);
 *  - tanggal surat kuasa sama dengan salah satu register: register itu;
 *  - tanggal surat kuasa lain dari semua register: register BARU.
 * `daftar` urut paling lama -> paling baru.
 */
export function pilihRegister(daftar: RegisterKuasa[], tanggalSuratKuasa: string): PilihanRegister {
  const ada = (Array.isArray(daftar) ? daftar : []).filter((r) => r && (r.nomorRegister || r.tanggalRegister));
  if (!ada.length) return { jenis: "kosong" };
  const tgl = tanggalIso(tanggalSuratKuasa);
  if (!tgl) return { jenis: "pakai", register: ada[ada.length - 1], sebab: "belum-ada-tanggal" };
  const sama = ada.filter((r) => r.tanggalSuratKuasa === tgl);
  if (sama.length) return { jenis: "pakai", register: sama[sama.length - 1], sebab: "sama-tanggal" };
  // Register lama yang tanggal surat kuasanya tidak tercatat (belum diisi saat disimpan) tidak menjadi pembeda.
  const tanpaTanggal = ada.filter((r) => !r.tanggalSuratKuasa);
  if (tanpaTanggal.length === ada.length) return { jenis: "pakai", register: ada[ada.length - 1], sebab: "belum-ada-tanggal" };
  return { jenis: "baru", lain: ada };
}

/** Nomor perkara baku untuk kunci: tanpa spasi, tanpa titik penutup. */
export function nomorPerkaraBaku(nomor: string): string {
  return String(nomor ?? "").replace(/\s+/g, "").replace(/\.+$/, "");
}
