// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * FUNGSI TINGKAT ATAS TIDAK BOLEH MEMBACA let/const YANG BELUM LAHIR
 * ============================================================================
 *
 * Dilaporkan 22 September 2026 dari chrome://extensions, berulang tiap halaman
 * ABT dibuka:
 *
 *     Uncaught (in promise) ReferenceError:
 *     Cannot access 'sudahDipasangMassalAbt' before initialization
 *     abt.js:4344
 *
 * Urutannya, bukan logikanya:
 *
 *     baris 4228   void pasangMassalAbt();
 *     baris 4341   let sudahDipasangMassalAbt = false;
 *     baris 4344     if (sudahDipasangMassalAbt) return;
 *
 * Deklarasi `function` terangkat ke atas, sehingga pemanggilan di baris 4228
 * sah. Deklarasi `let` TIDAK: ia ada tetapi belum boleh disentuh sampai
 * barisnya sendiri dijalankan - itulah temporal dead zone. Dan baris pertama
 * fungsinya justru membacanya.
 *
 * Fungsinya async, tetapi badannya berjalan serempak sampai await pertama, dan
 * pembacaan itu ada sebelum await mana pun. Jadi ia meledak seketika.
 *
 * ============================================================================
 * MENGAPA INI PANTAS DIJAGA, PADAHAL PANELNYA TETAP MUNCUL
 * ============================================================================
 *
 * Panel massalnya tetap terpasang - ada gelung ulangan yang memanggilnya lagi,
 * dan pada panggilan kedua barisnya sudah lewat. Tidak ada satu pun gejala di
 * layar.
 *
 * Justru itu bahayanya. Error yang menumpuk tanpa gejala membuat lencana merah
 * Chrome selalu menyala, dan error SUNGGUHAN berikutnya tenggelam di antaranya
 * - tidak ada yang membuka daftar yang memang selalu merah.
 *
 * Ada sejak commit 01b5625, dan baru ketahuan berbulan kemudian ketika
 * seseorang kebetulan membuka daftar error itu.
 *
 * ============================================================================
 * YANG DIPERIKSA HANYA PEMANGGILAN TINGKAT ATAS
 * ============================================================================
 *
 * Pemanggilan di DALAM fungsi lain berjalan belakangan - saat itu seluruh
 * deklarasi berkas sudah lewat, dan tidak ada TDZ. Yang berbahaya hanya yang
 * dijalankan saat berkasnya dimuat, yaitu yang tanpa lekukan.
 */

const akar = path.resolve(process.cwd(), "..");

const BERKAS = [
  "konten.js",
  "abt.js",
  "aleta.js",
  "panel-alat.js",
  "latar.js",
  "jembatan.js",
  "popup.js",
  "tema-awal.js",
];

type Jebakan = {
  berkas: string;
  barisPanggil: number;
  fungsi: string;
  nama: string;
  barisDeklarasi: number;
};

function sisirBerkas(berkas: string): Jebakan[] {
  let teks: string;
  try {
    teks = readFileSync(path.join(akar, "ekstensi-sipp", berkas), "utf8").replace(/\r\n/g, "\n");
  } catch {
    return [];
  }
  const baris = teks.split("\n");

  // Deklarasi let/const di tingkat atas - yang tanpa lekukan.
  const deklarasi = new Map<string, number>();
  baris.forEach((b, i) => {
    const m = /^(?:let|const)\s+([A-Za-z_$][\w$]*)/.exec(b);
    if (m && !deklarasi.has(m[1])) deklarasi.set(m[1], i);
  });

  // Fungsi tingkat atas beserta jangkauan barisnya. Penutupnya "}" di kolom
  // nol - bentuk yang dipakai seluruh berkas ini.
  const fungsi = new Map<string, [number, number]>();
  baris.forEach((b, i) => {
    const m = /^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(b);
    if (!m) return;
    let akhir = baris.length;
    for (let j = i + 1; j < baris.length; j += 1) {
      if (baris[j] === "}") {
        akhir = j;
        break;
      }
    }
    fungsi.set(m[1], [i, akhir]);
  });

  const jebakan: Jebakan[] = [];
  baris.forEach((b, i) => {
    const m = /^(?:void\s+)?([A-Za-z_$][\w$]*)\(\s*\)\s*;/.exec(b);
    if (!m) return;
    const jangkauan = fungsi.get(m[1]);
    if (!jangkauan) return;
    const badan = baris.slice(jangkauan[0], jangkauan[1] + 1).join("\n");
    for (const [nama, iDeklarasi] of deklarasi) {
      // Dideklarasikan sebelum dipanggil - aman.
      if (iDeklarasi <= i) continue;
      if (new RegExp(`\\b${nama.replace(/\$/g, "\\$")}\\b`).test(badan)) {
        jebakan.push({
          berkas,
          barisPanggil: i + 1,
          fungsi: m[1],
          nama,
          barisDeklarasi: iDeklarasi + 1,
        });
      }
    }
  });
  return jebakan;
}

describe("tidak ada fungsi tingkat atas yang membaca let/const yang belum lahir", () => {
  it("seluruh berkas ekstensi bersih dari jebakan TDZ", () => {
    const semua = BERKAS.flatMap(sisirBerkas);
    const bunyi = semua
      .map(
        (j) =>
          `${j.berkas}:${j.barisPanggil} ${j.fungsi}() membaca '${j.nama}' ` +
          `yang baru dideklarasikan di baris ${j.barisDeklarasi}`
      )
      .join("\n");
    expect(semua, bunyi).toHaveLength(0);
  });

  it("penyisirnya sungguh bekerja - dibuktikan pada contoh buatan", () => {
    // Penjaga yang tidak pernah dapat merah tidak menjaga apa pun. Ini
    // membuktikan penyisirnya menemukan pola yang dicarinya - kalau suatu hari
    // regexnya patah, uji inilah yang berbunyi, bukan yang di atas yang diam-
    // diam selalu hijau.
    const contoh = [
      "function jalan() {",
      "  if (bendera) return;",
      "}",
      "",
      "void jalan();",
      "",
      "let bendera = false;",
    ].join("\n");

    const baris = contoh.split("\n");
    const deklarasi = new Map<string, number>();
    baris.forEach((b, i) => {
      const m = /^(?:let|const)\s+([A-Za-z_$][\w$]*)/.exec(b);
      if (m && !deklarasi.has(m[1])) deklarasi.set(m[1], i);
    });
    expect(deklarasi.get("bendera")).toBe(6);

    const iPanggil = baris.findIndex((b) => /^(?:void\s+)?jalan\(\s*\)\s*;/.test(b));
    expect(iPanggil).toBe(4);
    expect(deklarasi.get("bendera")!).toBeGreaterThan(iPanggil);
  });

  it("sudahDipasangMassalAbt dideklarasikan sebelum dipanggil", () => {
    // Yang sungguh dilaporkan. Dijaga tersendiri supaya sebabnya tetap
    // terbaca walau penyisir di atas kelak diganti.
    const abt = readFileSync(path.join(akar, "ekstensi-sipp/abt.js"), "utf8").replace(/\r\n/g, "\n");
    const baris = abt.split("\n");
    const iDeklarasi = baris.findIndex((b) => b.startsWith("let sudahDipasangMassalAbt"));
    expect(iDeklarasi, "deklarasinya tidak ketemu").toBeGreaterThan(-1);

    const iTingkatAtas = baris
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => /^(?:void\s+)?pasangMassalAbt\(\s*\)\s*;/.test(b))
      .map(({ i }) => i);
    expect(iTingkatAtas.length, "pemanggilan tingkat atas tidak ketemu").toBeGreaterThan(0);
    for (const i of iTingkatAtas) {
      expect(i, `pemanggilan baris ${i + 1} mendahului deklarasinya`).toBeGreaterThan(iDeklarasi);
    }
  });
});
