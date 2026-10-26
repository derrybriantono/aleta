/**
 * ============================================================================
 * ATURAN DETEKSI PENJAGA INTEGRITAS (E6, 25 Okt 2026) - fungsi murni
 * ============================================================================
 *
 * Hanya MENDETEKSI. Hasilnya berupa jenis, nama aturan, dan nomor baris -
 * tidak pernah potongan isi berkas (isi berkas mencurigakan tidak boleh masuk
 * basis data, repo, atau pesan WhatsApp).
 *
 * Aturan sengaja konservatif supaya peringatan tidak menjadi kebisingan:
 *   - pola webshell hanya yang berbentuk perintah berbahaya DENGAN masukan
 *     pengguna ($_GET/$_POST/...) atau pembungkus penyamar (base64/gzinflate);
 *   - kata judol baru dihitung bila >= 2 kata berbeda ada di satu berkas
 *     (halaman resmi yang memuat imbauan "waspada judi online" tidak disalahkan),
 *     kecuali frasa khas "slot gacor".
 */

export const EKSTENSI_SKRIP = [".php", ".phtml", ".php3", ".php4", ".php5", ".php7", ".php8", ".phps", ".pht", ".phar"] as const;
export const EKSTENSI_TEKS = [".php", ".phtml", ".php3", ".php4", ".php5", ".php7", ".php8", ".pht", ".html", ".htm", ".js", ".txt", ".inc", ".json", ".xml", ".css", ".tpl", ".twig", ".htaccess"] as const;
export const FOLDER_UNGGAHAN_BAWAAN = ["uploads", "upload", "files", "file", "images", "img", "media", "cache", "tmp", "temp", "foto", "gambar", "dokumen", "wp-content/uploads"] as const;

export type JenisTemuan = "php-baru" | "php-berubah" | "php-di-unggahan" | "php-di-gambar" | "webshell" | "kata-judol" | "konfigurasi";

export const LABEL_JENIS: Record<JenisTemuan, string> = {
  "php-baru": "Berkas PHP baru",
  "php-berubah": "Berkas PHP berubah",
  "php-di-unggahan": "PHP di folder unggahan",
  "php-di-gambar": "Kode PHP di dalam berkas non-PHP",
  webshell: "Pola webshell",
  "kata-judol": "Kata judi online",
  konfigurasi: "Konfigurasi server mencurigakan",
};

/** Tingkat keparahan: dipakai untuk urutan tampilan saja; semuanya memicu peringatan. */
export const BERAT: Record<JenisTemuan, number> = {
  webshell: 5,
  "php-di-gambar": 5,
  "php-di-unggahan": 4,
  konfigurasi: 4,
  "kata-judol": 3,
  "php-baru": 2,
  "php-berubah": 2,
};

export function ekstensiBerkas(jalur: string): string {
  const nama = jalur.split("/").pop() ?? "";
  if (nama.toLowerCase() === ".htaccess") return ".htaccess";
  const i = nama.lastIndexOf(".");
  return i <= 0 ? "" : nama.slice(i).toLowerCase();
}

export function adalahSkrip(jalur: string): boolean {
  return (EKSTENSI_SKRIP as readonly string[]).includes(ekstensiBerkas(jalur));
}

export function adalahTeks(jalur: string): boolean {
  return (EKSTENSI_TEKS as readonly string[]).includes(ekstensiBerkas(jalur));
}

/** Jalur relatif (pemisah "/") berada di dalam salah satu folder unggahan (segmen berurutan, tanpa membedakan huruf). */
export function dalamFolderUnggahan(jalur: string, unggahan: readonly string[]): boolean {
  const segmen = jalur.toLowerCase().split("/").slice(0, -1);
  if (segmen.length === 0) return false;
  const gabung = `/${segmen.join("/")}/`;
  return unggahan.some((u) => {
    const bersih = u.toLowerCase().replace(/^\/+|\/+$/g, "");
    return bersih !== "" && gabung.includes(`/${bersih}/`);
  });
}

export type Deteksi = { jenis: JenisTemuan; aturan: string; baris: number };

type AturanPola = { id: string; jenis: JenisTemuan; pola: RegExp };

const MASUKAN = "\\$_(?:GET|POST|REQUEST|COOKIE|SERVER|FILES)";

const POLA_WEBSHELL: AturanPola[] = [
  { id: "eval-pembungkus", jenis: "webshell", pola: /\beval\s*\(\s*(?:@\s*)?(?:base64_decode|gzinflate|gzuncompress|gzdecode|str_rot13|rawurldecode|convert_uudecode)\s*\(/i },
  { id: "eval-masukan", jenis: "webshell", pola: new RegExp(`\\beval\\s*\\(\\s*(?:@\\s*)?${MASUKAN}`, "i") },
  { id: "assert-variabel", jenis: "webshell", pola: /\bassert\s*\(\s*(?:@\s*)?(?:\$_(?:GET|POST|REQUEST|COOKIE)|\$\w+\s*\))/i },
  { id: "gzinflate-base64", jenis: "webshell", pola: /gzinflate\s*\(\s*base64_decode\s*\(/i },
  { id: "preg-replace-e", jenis: "webshell", pola: /preg_replace\s*\(\s*['"]\s*\/[^'"\n]*\/[a-z]*e[a-z]*\s*['"]/i },
  { id: "perintah-masukan", jenis: "webshell", pola: new RegExp(`\\b(?:system|shell_exec|passthru|exec|popen|proc_open|pcntl_exec)\\s*\\(\\s*(?:@\\s*)?${MASUKAN}`, "i") },
  { id: "tulis-berkas-masukan", jenis: "webshell", pola: new RegExp(`\\bfile_put_contents\\s*\\(\\s*${MASUKAN}`, "i") },
  { id: "shell-dikenal", jenis: "webshell", pola: /\b(?:c99shell|r57shell|b374k|FilesMan|WSO\s*Shell|China\s*Chopper)\b/i },
  { id: "fungsi-variabel", jenis: "webshell", pola: /\$\w+\s*=\s*['"](?:assert|eval|system|exec|shell_exec|passthru)['"]\s*;\s*\$\w+\s*\(/i },
];

const POLA_KONFIGURASI: AturanPola[] = [
  { id: "htaccess-jalankan-php", jenis: "konfigurasi", pola: /\b(?:AddType|AddHandler|SetHandler)\b[^\n]*\b(?:x-httpd-php|php\d?-script|application\/x-httpd-php)/i },
  { id: "htaccess-auto-prepend", jenis: "konfigurasi", pola: /\bauto_(?:prepend|append)_file\b/i },
];

/** Kata dan frasa judi online. Dicocokkan sebagai kata utuh, tanpa membedakan huruf. */
export const KATA_JUDOL: readonly string[] = [
  "slot gacor",
  "slot online",
  "situs slot",
  "agen slot",
  "daftar slot",
  "slot88",
  "slot demo",
  "rtp slot",
  "gacor",
  "togel",
  "toto macau",
  "maxwin",
  "judi online",
  "judi bola",
  "judi slot",
  "bandar togel",
  "bandar judi",
  "sbobet",
  "deposit pulsa",
  "bonus new member",
];
const KATA_KHAS = new Set(["slot gacor", "toto macau", "bandar togel", "judi slot"]);

const POLA_JUDOL = KATA_JUDOL.map((k) => ({ kata: k, pola: new RegExp(`(?<![a-z0-9])${k.replace(/ /g, "[\\s_\\-]+")}(?![a-z0-9])`, "i") }));

function nomorBaris(teks: string, indeks: number): number {
  let n = 1;
  for (let i = 0; i < indeks && i < teks.length; i += 1) if (teks.charCodeAt(i) === 10) n += 1;
  return n;
}

export type OpsiDeteksi = { skrip: boolean; htaccess: boolean };

/** Memeriksa isi teks satu berkas. Mengembalikan paling banyak satu deteksi per aturan. */
export function periksaIsi(teks: string, opsi: OpsiDeteksi & { judol?: boolean }): Deteksi[] {
  const hasil: Deteksi[] = [];
  if (opsi.skrip) {
    for (const a of POLA_WEBSHELL) {
      const m = a.pola.exec(teks);
      if (m) hasil.push({ jenis: a.jenis, aturan: a.id, baris: nomorBaris(teks, m.index) });
    }
  }
  if (opsi.htaccess) {
    for (const a of POLA_KONFIGURASI) {
      const m = a.pola.exec(teks);
      if (m) hasil.push({ jenis: a.jenis, aturan: a.id, baris: nomorBaris(teks, m.index) });
    }
  }
  if (opsi.judol !== false) {
    const kena = POLA_JUDOL.map((p) => ({ kata: p.kata, m: p.pola.exec(teks) })).filter((x) => x.m);
    if (kena.length >= 2 || kena.some((k) => KATA_KHAS.has(k.kata))) {
      const awal = Math.min(...kena.map((k) => (k.m as RegExpExecArray).index));
      hasil.push({ jenis: "kata-judol", aturan: "judol", baris: nomorBaris(teks, awal) });
    }
  }
  return hasil;
}

/** Kode PHP tersembunyi di berkas yang bukan skrip (mis. gambar berisi <?php). */
export function mengandungKodePhp(teksKepala: string): boolean {
  return /<\?php\b|<\?=/i.test(teksKepala);
}
