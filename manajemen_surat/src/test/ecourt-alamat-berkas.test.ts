// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * "BERKAS TERDETEKSI TETAPI TIDAK PERNAH TERUNDUH"
 * ============================================================================
 *
 * Dokumen PDF di e-Court tidak membawa alamatnya sendiri di halaman perkara -
 * yang ada hanya penanda. Alamatnya ditanyakan lewat /ViewDoc, dan jawaban itu
 * yang digali.
 *
 * Selama penggalinya terkurung di dalam page.evaluate() milik jembatan, ia
 * tidak dapat diuji sama sekali: mengujinya menuntut peramban sungguhan, sesi
 * e-Court yang hidup, dan perkara yang kebetulan punya dokumen. Padahal justru
 * inilah bagian yang paling sering patah - dan ketika ia patah, gejalanya
 * persis keluhan yang dilaporkan: judulnya terbaca, penandanya terbaca,
 * berkasnya tidak pernah turun.
 *
 * Empat sebab yang dibuktikan di sini semuanya menghasilkan gejala yang sama
 * dan sebab yang tercatat sama: "alamat_berkas_tidak_ditemukan". Itu sebabnya
 * keempatnya dapat hidup berdampingan tanpa ketahuan.
 */

const require_ = createRequire(import.meta.url);
const berkasScraper = path.resolve(process.cwd(), "../aleta_bot/tools/ecourt-bridge/scraper.js");
const berkasRun = path.resolve(process.cwd(), "../aleta_bot/tools/ecourt-bridge/run.js");

const scraper = require_(berkasScraper) as {
  BASE_URL: string;
  diDalamEcourt: (alamat: string) => boolean;
  alamatBerkasDariJawabanViewDoc: (
    teks: string
  ) => { ok: true; alamat: string } | { ok: false; alasan: string; cuplikan: string };
};

const gali = scraper.alamatBerkasDariJawabanViewDoc;

/**
 * Pola LAMA, disalin apa adanya sebelum diubah.
 *
 * Disimpan di sini sebagai PEMBANDING, bukan sebagai cadangan: tanpa ia, tidak
 * ada cara menunjukkan bahwa perbaikannya memang mengubah sesuatu, dan uji
 * yang lulus atas kode lama maupun baru tidak membuktikan apa pun.
 */
const POLA_LAMA = /https?:\/\/[^\s"'<>\\]+\/storage\/[^\s"'<>\\]+/i;

const PENUH = "https://ecourt.mahkamahagung.go.id/storage/dokumen/putusan-510.pdf";

describe("sebab 1 - garis miring yang tersandi di jawaban JSON", () => {
  // json_encode PHP menyandikan garis miring sebagai \/ secara BAWAAN. Ini
  // bentuk yang wajar dari aplikasi Laravel, bukan kekeliruan e-Court.
  const jawaban = '{"status":"ok","url":"https:\\/\\/ecourt.mahkamahagung.go.id\\/storage\\/dokumen\\/putusan-510.pdf"}';

  it("alamatnya sekarang tergali", () => {
    const hasil = gali(jawaban);
    expect(hasil.ok).toBe(true);
    expect(hasil.ok && hasil.alamat).toBe(PENUH);
  });

  it("dan pola lama memang melewatkannya", () => {
    // Inilah tersangka utamanya. Pola lama menolak garis miring terbalik di
    // dalam alamat, sehingga "/storage/" tidak pernah cocok - dan seluruh
    // dokumen PDF yang jawabannya berbentuk JSON gagal, setiap kali,
    // selamanya.
    expect(POLA_LAMA.test(jawaban)).toBe(false);
  });
});

describe("sebab 2 - alamat relatif tanpa nama host", () => {
  const jawaban = '<a class="btn" href="/storage/dokumen/putusan-510.pdf">Unduh</a>';

  it("dilengkapi menjadi alamat penuh e-Court", () => {
    const hasil = gali(jawaban);
    expect(hasil.ok && hasil.alamat).toBe(PENUH);
  });

  it("dan pola lama memang melewatkannya", () => {
    expect(POLA_LAMA.test(jawaban)).toBe(false);
  });
});

describe("sebab 3 - jawaban yang dipotong sebelum digali", () => {
  const jawaban =
    `<html><head>${"x".repeat(4200)}</head><body><a href="${PENUH}">Unduh</a></body></html>`;

  it("alamatnya berada jauh di luar 4.000 huruf pertama", () => {
    expect(jawaban.indexOf(PENUH)).toBeGreaterThan(4000);
    // Yang dulu dilakukan pemanggilnya: memotong dulu, menggali kemudian.
    expect(POLA_LAMA.test(jawaban.slice(0, 4000))).toBe(false);
  });

  it("digali utuh, alamatnya ketemu", () => {
    expect(gali(jawaban).ok).toBe(true);
  });

  it("pemanggilnya tidak lagi memotong pada 4.000", () => {
    const isi = readFileSync(berkasRun, "utf8");
    expect(isi).not.toContain("slice(0, 4000)");
    expect(isi).toContain("scraper.alamatBerkasDariJawabanViewDoc(jawaban.teks)");
  });
});

describe("sebab 4 - pemeriksaan asal yang dapat ditipu", () => {
  const tiruan = "https://ecourt.mahkamahagung.go.id.contoh-lain.com/storage/x.pdf";

  it("penjaga lama meloloskan host tiruan", () => {
    // Ini bukan kegagalan unduhan melainkan lubang keamanan: berkas dari host
    // mana pun yang namanya DIAWALI nama host e-Court akan tersimpan sebagai
    // dokumen resmi perkara.
    expect(tiruan.startsWith(scraper.BASE_URL)).toBe(true);
  });

  it("penjaga baru menolaknya", () => {
    expect(scraper.diDalamEcourt(tiruan)).toBe(false);
    const hasil = gali(tiruan);
    expect(hasil.ok).toBe(false);
    expect(!hasil.ok && hasil.alasan).toBe("alamat_berkas_di_luar_ecourt");
  });

  it("alamat e-Court yang sah tetap diterima", () => {
    expect(scraper.diDalamEcourt(PENUH)).toBe(true);
  });
});

describe("sebab kegagalan dibedakan, tidak disamakan", () => {
  it("halaman login disebut sesi habis", () => {
    // Sesi habis dan alamat tak dikenali menuntut tindakan yang berbeda: yang
    // satu login ulang, yang lain penggalinya diperbaiki. Menyebut keduanya
    // dengan satu kata membuat keduanya salah ditangani - dan selama
    // bertahun-tahun tidak ada yang tahu mana yang sedang terjadi.
    const hasil = gali('<html><body><form action="/Login">Silakan masuk kembali</form></body></html>');
    expect(!hasil.ok && hasil.alasan).toBe("sesi_habis");
  });

  it("jawaban kosong disebut kosong", () => {
    const hasil = gali("");
    expect(!hasil.ok && hasil.alasan).toBe("jawaban_kosong");
  });

  it("jawaban tak dikenali membawa cuplikannya", () => {
    // Tanpa cuplikan, "tidak ditemukan" tidak dapat dibedakan dari "e-Court
    // mengubah bentuk jawabannya" - dan yang kedua menuntut kode diperbaiki,
    // bukan dicoba ulang sampai kiamat.
    const hasil = gali("<html><body>Dokumen sedang diproses, coba beberapa saat lagi.</body></html>");
    expect(!hasil.ok && hasil.alasan).toBe("alamat_berkas_tidak_ditemukan");
    expect(!hasil.ok && hasil.cuplikan).toContain("sedang diproses");
  });
});

describe("bentuk lain yang harus tetap tergali", () => {
  it("alamat telanjang tanpa pembungkus apa pun", () => {
    expect(gali(PENUH).ok).toBe(true);
  });

  it("berkas di luar /storage/ tergali dari ekstensinya", () => {
    // Cadangan bila e-Court memindahkan simpanannya: perpindahan itu tidak
    // boleh seketika menghentikan seluruh penarikan.
    const hasil = gali('{"url":"https:\\/\\/ecourt.mahkamahagung.go.id\\/files\\/2026\\/putusan.pdf"}');
    expect(hasil.ok && hasil.alamat).toBe(
      "https://ecourt.mahkamahagung.go.id/files/2026/putusan.pdf"
    );
  });

  it("tanda baca penutup tidak ikut terbawa", () => {
    const hasil = gali(`Berkasnya ada di ${PENUH}.`);
    expect(hasil.ok && hasil.alamat).toBe(PENUH);
  });

  it("berkas Word ikut dikenali", () => {
    const hasil = gali('<a href="/storage/dok/gugatan.docx">Word</a>');
    expect(hasil.ok && hasil.alamat).toBe(
      "https://ecourt.mahkamahagung.go.id/storage/dok/gugatan.docx"
    );
  });
});
