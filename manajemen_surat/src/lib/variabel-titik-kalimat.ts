/**
 * ============================================================================
 * VARIABEL YANG BILA KOSONG MENCETAK TITIK-TITIK DI TENGAH KALIMAT (audit A3-V04, keputusan pengguna 4 Nov 2026)
 * ============================================================================
 *
 * Enam variabel otomatis ABT yang nilai kosongnya BUKAN string kosong, melainkan kalimat berlubang
 * ("Kesimpulan Pemohon:\n...", "sejumlah Rp........,00", "pada tanggal ... di ..."). Bila isian sumbernya belum diisi, naskah tercetak
 * dengan titik-titik di dalam kalimat dan mudah lolos dari mata. Panel Blangko Derry memberi PERINGATAN LUNAK (satu baris di daftar
 * "Periksa sebelum cetak") - cetak tidak ditahan.
 *
 * Nama tampil dibuat di sini, bukan dari nama katalog ABT (yang teknis: "JAWAB-MENJAWAB BAS: KESIMPULAN ... (OTOMATIS dari isian ...)").
 */
export const VARIABEL_TITIK_KALIMAT: Readonly<Record<string, string>> = {
  "12034": "Kesimpulan kedua pihak",
  "11161": "Biaya perkara perlawanan (verzet)",
  "3615": "Kalimat penolakan Pegawai Pencatat Nikah",
  "3628": "Kalimat penolakan pejabat perkawinan campuran",
  "9325": "Waktu dan tempat perkawinan",
  "9327": "Akta nikah (nomor, tanggal, KUA)",
};

/** Nilai polos yang masih titik-titik / kosong: tiga titik atau lebih berurutan (juga "…"), atau tidak ada isinya. */
export function nilaiMasihTitik(teks: unknown): boolean {
  const t = String(teks ?? "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  return /\.{3,}|…/.test(t);
}

/** Kode variabel pada daftar yang dirujuk blangko ini (urutan daftar tetap). */
export function kodeTitikDalamBlangko(penanda: readonly string[]): string[] {
  const ada = new Set(penanda.map((x) => String(x).trim()));
  return Object.keys(VARIABEL_TITIK_KALIMAT).filter((k) => ada.has(k));
}
