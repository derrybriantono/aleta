/**
 * ============================================================================
 * TIAP TABEL YANG DITANYAKAN HARUS TERDAFTAR - JIKA TIDAK, IA DIJAWAB "TIDAK ADA"
 * ============================================================================
 *
 * sippSkemaService.tabelAda() hanya mengenali tabel yang tercantum pada const
 * TABEL. Yang di luar daftar itu SELALU dijawab "tidak ada" - tanpa galat,
 * tanpa peringatan, tanpa satu baris log.
 *
 * Akibatnya selalu berbentuk sama: fiturnya berjalan, jawabannya 200, dan
 * bagian yang bergantung pada tabel itu diam-diam kosong. Yang membaca layar
 * menyangka datanya memang belum ada.
 *
 * Sudah terjadi TIGA KALI di berkas yang sama:
 *
 *   ruangan_sidang    penetapan hari sidang menolak "ruangan_tidak_ketemu"
 *                     padahal tabelnya berisi tiga belas ruang aktif
 *   perkara_rekonvensi  penanda rekonvensi tidak pernah menyala
 *   ref_kua           kolom KUA kosong pada SELURUH ruangan sidang keliling,
 *                     padahal KUA SIGI BIROMARU memang ada di sana
 *
 * Ketiganya baru ketahuan dari layar, bukan dari uji. Penjaga ini menutupnya:
 * tiap nama tabel yang ditulis tegas ke dalam tabelAda("...") di mana pun pada
 * kode bot harus ada di daftar TABEL.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(__dirname, "../../..");
const LAYANAN = path.join(AKAR, "aleta_bot/services");

const skema = readFileSync(path.join(LAYANAN, "sippSkemaService.js"), "utf8");

/** Daftar TABEL apa adanya, komentar dibuang lebih dulu. */
function daftarTerdaftar(): Set<string> {
  const mulai = skema.indexOf("const TABEL = [");
  const akhir = skema.indexOf("];", mulai);
  expect(mulai).toBeGreaterThan(0);
  const badan = skema
    .slice(mulai, akhir)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((b) => !b.trim().startsWith("//"))
    .join("\n");
  return new Set([...badan.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]));
}

/** Nama tabel yang ditulis tegas ke dalam tabelAda("...") di seluruh layanan. */
function yangDitanyakan(): Map<string, string[]> {
  const hasil = new Map<string, string[]>();
  for (const berkas of readdirSync(LAYANAN)) {
    if (!berkas.endsWith(".js")) continue;
    const isi = readFileSync(path.join(LAYANAN, berkas), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((b) => !b.trim().startsWith("//"))
      .join("\n");
    for (const cocok of isi.matchAll(/tabelAda\(\s*"([a-z0-9_]+)"\s*\)/g)) {
      const nama = cocok[1];
      if (!hasil.has(nama)) hasil.set(nama, []);
      hasil.get(nama)!.push(berkas);
    }
  }
  return hasil;
}

describe("tabel SIPP yang ditanyakan harus terdaftar", () => {
  it("tidak satu pun tabelAda() menanyakan tabel di luar daftar", () => {
    const terdaftar = daftarTerdaftar();
    const ditanyakan = yangDitanyakan();

    const hilang = [...ditanyakan.entries()]
      .filter(([nama]) => !terdaftar.has(nama))
      .map(([nama, berkas]) => `${nama} (ditanyakan ${berkas.join(", ")})`);

    // Pesannya menyebut NAMA dan BERKASNYA - yang menemukan kegagalan ini
    // kelak tidak perlu menebak di mana harus mendaftarkannya.
    expect(hilang, `Tabel ini ditanyakan tetapi tidak ada di const TABEL sippSkemaService, sehingga tabelAda() akan menjawab "tidak ada" tanpa galat:\n  ${hilang.join("\n  ")}`).toEqual([]);
  });

  it("ketiga tabel yang pernah tertinggal memang sudah terdaftar", () => {
    const terdaftar = daftarTerdaftar();
    for (const nama of ["ruangan_sidang", "perkara_rekonvensi", "ref_kua"]) {
      expect(terdaftar.has(nama), `${nama} tidak terdaftar`).toBe(true);
    }
  });

  it("penjaganya sungguh membaca sesuatu - bukan nol tabel", () => {
    // Penjaga yang memeriksa daftar kosong selalu hijau dan tidak menjaga
    // apa pun.
    expect(daftarTerdaftar().size).toBeGreaterThan(40);
    expect(yangDitanyakan().size).toBeGreaterThan(10);
  });
});
