/**
 * ============================================================================
 * PAGAR BAGI KUERI KAMUS ABT - DIJALANKAN, BUKAN DIBACA
 * ============================================================================
 *
 * Blangko ABT diisi dengan menguraikan sebutan #nnnn#, dan 158 dari 225 sebutan
 * yang dipakai korpus relaas dan berita acara sidang mengambil nilainya dari
 * KUERI YANG TERSIMPAN DI KAMUS - ditulis di luar ALETA, oleh orang lain,
 * bertahun-tahun yang lalu. Menjalankannya apa adanya berarti menyerahkan
 * sambungan basis data pengadilan kepada teks yang tidak pernah ditinjau di
 * sini.
 *
 * Pagarnya karena itu harus dua-duanya benar: menahan yang berbahaya, DAN
 * meloloskan yang sah. Pagar yang terlalu rapat sama merusaknya - ia menutup
 * sebutan tanpa bunyi apa pun, dan relaas tetap tercetak dengan medan kosong.
 *
 * ============================================================================
 * TIGA CACAT YANG DITEMUKAN DENGAN MENJALANKANNYA, BUKAN DENGAN MEMBACANYA
 * ============================================================================
 *
 * Diukur atas perkara 567/Pdt.G/2026/PA.Dgl di peladen, ke-225 sebutan
 * sekaligus, tiga putaran:
 *
 *   pagar pertama      23 dari 225 DITOLAK - titik koma di dalam tanda kutip
 *                      dihitung sebagai pernyataan kedua. Termasuk #7108# dan
 *                      #7109#, yang menyusun identitas pihak pada TIAP relaas;
 *   sesudah ditambal   masih 23 - tambalannya sendiri keliru: polanya hanya
 *                      cocok pada kutip yang isinya melulu pelolos, aksara
 *                      biasa tidak ikut disebut;
 *   sesudah dibetulkan  1 - REPLACE() fungsi teks disangka REPLACE INTO;
 *   sekarang            0.
 *
 * Ketiganya dikunci di berkas ini.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const sumber = readFileSync(
  path.join(AKAR, "aleta_bot/services/abtSebutanService.js"),
  "utf8"
).replace(/\r\n/g, "\n");

/** Tetapan puncak - satu baris atau beberapa, sampai baris yang diakhiri ";". */
function potongTetapan(nama: string): string {
  const baris = sumber.split("\n");
  const mulai = baris.findIndex((b) => new RegExp(`^const ${nama}\\s*=`).test(b));
  expect(mulai, `tetapan ${nama} tidak ditemukan`).toBeGreaterThan(-1);
  let akhir = mulai;
  while (akhir < baris.length && !baris[akhir].trimEnd().endsWith(";")) akhir += 1;
  return baris.slice(mulai, akhir + 1).join("\n");
}

/** Fungsi puncak - dibuka di kolom nol, ditutup "}" di kolom nol. */
function potongFungsi(nama: string[]): string {
  const baris = sumber.split("\n");
  const hasil: string[] = [];
  const ketemu = new Set<string>();
  for (let i = 0; i < baris.length; i += 1) {
    const cocok = baris[i].match(/^(?:async )?function ([A-Za-z_$][\w$]*)\(/);
    if (!cocok || !nama.includes(cocok[1])) continue;
    let j = i;
    while (j < baris.length && baris[j] !== "}") j += 1;
    if (j >= baris.length) throw new Error(`penutup fungsi ${cocok[1]} tidak ditemukan`);
    hasil.push(baris.slice(i, j + 1).join("\n"));
    ketemu.add(cocok[1]);
  }
  const hilang = nama.filter((n) => !ketemu.has(n));
  if (hilang.length) throw new Error(`fungsi tidak ditemukan: ${hilang.join(", ")}`);
  return hasil.join("\n\n");
}

function muat() {
  const kode = [
    potongTetapan("KATA_TERLARANG"),
    potongTetapan("BULAN"),
    potongFungsi(["tanpaTeksBerkutip", "alasanTolakKueri", "sebutanDi", "bentukNilai"]),
  ].join("\n\n");
  return new Function(
    `${kode}\nreturn { alasanTolakKueri, tanpaTeksBerkutip, sebutanDi, bentukNilai };`
  )() as {
    alasanTolakKueri: (sql: string) => string;
    tanpaTeksBerkutip: (sql: string) => string;
    sebutanDi: (teks: string) => string[];
    bentukNilai: (nilai: unknown) => string;
  };
}

describe("pagar menahan yang berbahaya", () => {
  const { alasanTolakKueri } = muat();

  it("menolak yang tidak dibuka SELECT", () => {
    expect(alasanTolakKueri("UPDATE perkara SET nomor_perkara='x'")).toBe("bukan dibuka SELECT");
    expect(alasanTolakKueri("  delete from perkara")).toBe("bukan dibuka SELECT");
    expect(alasanTolakKueri("")).toBe("kueri kosong");
  });

  it("menolak pernyataan kedua yang diselipkan", () => {
    expect(alasanTolakKueri("SELECT 1 AS data; DROP TABLE perkara")).toBe(
      "lebih dari satu pernyataan"
    );
  });

  it("menolak yang mengubah, memindahkan, atau membaca berkas peladen", () => {
    for (const jahat of [
      "SELECT 1 FROM perkara INTO OUTFILE '/tmp/x'",
      "SELECT LOAD_FILE('/etc/passwd') AS data",
      "SELECT 1 AS data UNION SELECT 1 FROM perkara WHERE SLEEP(5)",
      "SELECT 1 AS data FROM perkara WHERE BENCHMARK(1000000, MD5('a'))",
    ]) {
      expect(alasanTolakKueri(jahat), jahat).toMatch(/kata terlarang/);
    }
  });

  it("REPLACE INTO ditolak - REPLACE() fungsi teks tidak", () => {
    // #8011# Kota/Kabupaten Satker memotong kata "Kab." dengan REPLACE().
    // Pagar yang menolak kata "replace" begitu saja menutupnya, dan itulah
    // satu-satunya sebutan yang tersandung pada pengukuran ketiga.
    expect(alasanTolakKueri("REPLACE INTO perkara VALUES (1)")).toBe("bukan dibuka SELECT");
    expect(alasanTolakKueri("SELECT 1 AS data FROM perkara; REPLACE INTO x VALUES (1)")).toBe(
      "lebih dari satu pernyataan"
    );
    expect(alasanTolakKueri("SELECT REPLACE(nama, 'Kab. ', '') AS data FROM satker")).toBe("");
  });
});

describe("pagar meloloskan yang sah", () => {
  const { alasanTolakKueri, tanpaTeksBerkutip } = muat();

  it("titik koma di dalam naskah berkutip bukan pernyataan kedua", () => {
    // Bunyi #7006# yang sesungguhnya, dipendekkan.
    const kueri =
      "SELECT CASE WHEN 1=1 THEN " +
      "'<li>Bahwa terhadap putusan tersebut dapat diajukan banding, Pasal 153 ayat (1) RBg; " +
      "<li>Pemberitahuan ini saya laksanakan melalui Surat Tercatat;' " +
      "ELSE '' END AS data;";
    expect(alasanTolakKueri(kueri)).toBe("");
  });

  it("kutip ganda pun, dan aksara biasa di dalamnya ikut terbaca", () => {
    // Inilah yang tertinggal pada tambalan pertama: polanya hanya menerima
    // pelolos, sehingga kutip berisi kalimat biasa tidak pernah cocok.
    const kueri =
      'select (case when min(jabatan_hakim_id)=1 then "…memerintahkan untuk keluar ruang sidang; ' +
      '<br>Setelah musyawarah selesai, skors dicabut…" else "" end) as data from perkara_hakim_pn';
    expect(alasanTolakKueri(kueri)).toBe("");
    expect(tanpaTeksBerkutip(kueri)).not.toContain(";");
  });

  it("kata terlarang di dalam naskah tidak menutup kuerinya", () => {
    // "…dan gugatan itu DIGUGURKAN…" memuat kata yang tidak berbahaya sama
    // sekali, tetapi "delete" atau "drop" dapat muncul di dalam kalimat mana
    // pun - yang di dalam kutip adalah data, bukan perintah.
    expect(alasanTolakKueri("SELECT 'perkara ini drop out dari daftar' AS data")).toBe("");
  });

  it("pelolos di dalam kutip tidak menutup kutipnya lebih awal", () => {
    expect(alasanTolakKueri("SELECT 'tanda petik \\' di tengah; kalimat' AS data")).toBe("");
    expect(alasanTolakKueri("SELECT 'kutip '' ganda; juga' AS data")).toBe("");
  });
});

describe("nilai yang dipulangkan", () => {
  const { bentukNilai, sebutanDi } = muat();

  it("kolom DATE menjadi tanggal Indonesia, bukan kalimat Inggris", () => {
    // Terukur pada #0017#: "Mon Sep 14 2026 00:00:00 GMT+0000 (Coordinated
    // Universal Time)" - di tengah relaas yang dibacakan kepada pihak.
    expect(bentukNilai(new Date(2026, 8, 14))).toBe("14 September 2026");
    expect(bentukNilai(new Date(2026, 0, 1))).toBe("1 Januari 2026");
    expect(bentukNilai(new Date("tidak sah"))).toBe("");
  });

  it("yang kosong tetap kosong, bukan kata null", () => {
    expect(bentukNilai(null)).toBe("");
    expect(bentukNilai(undefined)).toBe("");
    expect(bentukNilai("")).toBe("");
  });

  it("sebutan dikenali tanpa ganda", () => {
    expect(sebutanDi("#0001# lawan #0047#, lalu #0001# lagi")).toEqual(["#0001#", "#0047#"]);
    expect(sebutanDi("tanpa sebutan")).toEqual([]);
  });
});

describe("penjaga sumbernya", () => {
  it("skema ABT disebut tegas dan diperiksa bentuknya", () => {
    expect(sumber).toContain('process.env.ALETA_ABT_SKEMA || "aps_badilag"');
    expect(sumber).toContain('if (!/^[A-Za-z0-9_]+$/.test(nama)) throw new Error("nama skema ABT tidak sah");');
  });

  it("perkara_id diganti bilangan yang sudah diperiksa", () => {
    expect(sumber).toContain('if (!Number.isInteger(id) || id <= 0) throw new Error("perkara_id harus bilangan bulat positif");');
    expect(sumber).toContain('.replace(/#perkara_id#/gi, String(perkaraId))');
  });

  it("yang ditolak dicatat, bukan dikosongkan diam-diam", () => {
    expect(sumber).toContain("ditolak.push({ kode: tanda, nama: def.nama, alasan: hasil.ditolak });");
    expect(sumber).toContain('ditolak.push({ kode: tanda, alasan: "tidak ada di kamus" });');
  });
});
