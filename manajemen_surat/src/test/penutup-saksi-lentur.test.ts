// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * F1.3 (16 Okt 2026) - pembersih kalimat penutup keterangan saksi, bentuk lentur.
 *
 * Dua salinan aturan (ekstensi abt.js dan bot penutupSaksi.js) dijaga SATU tabel
 * contoh: yang harus terhapus dan yang harus tinggal. Salinan ekstensi dijalankan
 * di vm dari potongan sumbernya; salinan bot di-require langsung.
 */
const require_ = createRequire(import.meta.url);
const bot = require_(path.resolve(process.cwd(), "../aleta_bot/services/penutupSaksi.js")) as {
  adalahKalimatPenutupSaksi: (t: string) => boolean;
};
const deteksi = require_(path.resolve(process.cwd(), "../aleta_bot/services/deteksiSaksiService.js")) as {
  POLA_PENUTUP_JAWAB: { test: (t: string) => boolean };
};

function ekstensi() {
  const isi = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
  const awal = isi.indexOf("const POLA_PENUTUP = [");
  const akhir = isi.indexOf("// ─── Keterangan saksi: disunting");
  expect(awal).toBeGreaterThan(0);
  expect(akhir).toBeGreaterThan(awal);
  const konteks: {
    bersihkanKeteranganSaksi?: (t: string) => string;
    adalahKalimatPenutupSaksi?: (t: string) => boolean;
  } = {};
  vm.createContext(konteks);
  // function deklarasi menjadi properti global konteks.
  vm.runInContext(isi.slice(awal, akhir), konteks);
  return konteks as {
    bersihkanKeteranganSaksi: (t: string) => string;
    adalahKalimatPenutupSaksi: (t: string) => boolean;
  };
}

/** Harus dikenali sebagai penutup (dengan dan tanpa "Bahwa", tanda butir, huruf besar/kecil). */
const PENUTUP = [
  "Bahwa saya tidak sanggup lagi",
  "Bahwa saya tidak sanggup lagi;",
  "Bahwa saksi tidak sanggup lagi",
  "Bahwa saksi sudah tidak sanggup lagi",
  "Bahwa saksi sudah tidak sanggup lagi;",
  "Bahwa sudah tidak sanggup lagi",
  "Bahwa tidak sanggup lagi",
  "Bahwa cukup sekian",
  "Bahwa cukup sekian;",
  "Bahwa sudah cukup",
  "Bahwa sudah cukup;",
  "Bahwa cukup",
  "Bahwa saksi sudah cukup",
  "Bahwa saya sudah cukup",
  "Bahwa tidak ada lagi yang ingin disampaikan",
  "Bahwa tidak ada lagi yang ingin saya sampaikan",
  "Bahwa tidak ada lagi yang akan saksi sampaikan",
  "Bahwa tidak ada lagi yang dapat disampaikan",
  "Bahwa tidak ada lagi keterangan",
  "Bahwa tidak ada keterangan lain",
  "Bahwa tidak ada keterangan tambahan",
  "Bahwa saksi tidak ada lagi keterangan",
  "Bahwa sudah tidak ada lagi yang ingin saya sampaikan",
  "Bahwa sekian",
  "Bahwa sekian keterangan saya",
  "Bahwa hanya itu yang saya ketahui",
  "Bahwa itu saja yang saksi sampaikan",
  "Bahwa demikian keterangan saya",
  "Bahwa saya tidak sanggup lagi dan sudah cukup",
  "Bahwa saya sudah tidak sanggup lagi, cukup sekian",
  "Bahwa cukup sekian dan terima kasih",
  "Bahwa tidak ada, sudah cukup",
  "Bahwa tidak, sudah cukup",
  "Bahwa ya, sudah cukup",
  "Bahwa saya tidak sanggup lagi menjawab",
  "Bahwa saksi sudah tidak sanggup lagi memberikan keterangan",
  "Bahwa saksi tidak lagi sanggup",
  "- BAHWA SAYA TIDAK SANGGUP LAGI;",
  "-   bahwa   saksi   sudah   cukup  ;",
  "Sudah cukup",
  "Sudah cukup;",
  "sudah  cukup .",
  "Saya tidak sanggup lagi",
  "Saya sudah tidak sanggup lagi;",
  "Tidak ada, sudah cukup",
  "Tidak, sudah cukup;",
  "Cukup sekian;",
  "Bahwa, sudah cukup",
  "Bahwa belum sanggup lagi",
];

/** Kalimat BIASA yang harus tinggal - termasuk yang memuat kata penutup di tengah. */
const BIASA = [
  "Sekian lama ia pergi meninggalkan rumah",
  "Bahwa sekian lama Tergugat pergi meninggalkan Penggugat",
  "Bahwa sudah cukup lama keduanya berpisah tempat tinggal",
  "Bahwa nafkah yang diberikan Tergugat tidak pernah cukup untuk anak-anaknya",
  "Bahwa Tergugat sudah cukup sering memukul Penggugat",
  "Bahwa cukup banyak barang yang dibawa Tergugat",
  "Saksi sudah tidak sanggup lagi merukunkan keduanya",
  "Bahwa saksi tidak sanggup lagi mendamaikan keduanya",
  "Bahwa saya tidak sanggup mendamaikan karena tidak tahu persoalannya",
  "Bahwa saksi tidak sanggup mendamaikan",
  "Bahwa saya tidak sanggup",
  "Bahwa Tergugat tidak sanggup lagi menafkahi Penggugat",
  "Bahwa Tergugat sudah tidak sanggup lagi hidup bersama Penggugat",
  "Bahwa tidak ada pekerjaan lain",
  "Bahwa tidak ada halangan secara hukum",
  "Bahwa tidak ada",
  "Bahwa tidak ada lagi harapan untuk rukun",
  "Bahwa tidak ada lagi yang menafkahi anak",
  "Bahwa tidak ada keterangan Penggugat tentang itu",
  "Bahwa hanya itu penyebabnya",
  "Bahwa hanya itu yang diketahui Tergugat",
  "Bahwa itu saja penyebab pertengkaran mereka",
  "Bahwa demikian keterangan Tergugat kepada saksi",
  "Bahwa sampai di sini rumah mereka",
  "Bahwa cukup sekian lama mereka berpisah",
  "Bahwa Penggugat dan Tergugat sudah pernah diupayakan untuk dirukunkan oleh keluarga, namun tidak berhasil",
  "Bahwa yang meninggalkan tempat tinggal bersama adalah Tergugat",
  "Bahwa saya tidak tahu",
  "",
];

describe("F1.3 - penutup keterangan saksi, bentuk lentur", () => {
  const ek = ekstensi();

  it.each(PENUTUP)("ekstensi: penutup dikenali - %s", (kalimat) => {
    expect(ek.adalahKalimatPenutupSaksi(kalimat)).toBe(true);
  });

  it.each(PENUTUP)("bot: penutup dikenali - %s", (kalimat) => {
    expect(bot.adalahKalimatPenutupSaksi(kalimat)).toBe(true);
  });

  it.each(BIASA)("ekstensi: kalimat biasa tinggal - %s", (kalimat) => {
    expect(ek.adalahKalimatPenutupSaksi(kalimat)).toBe(false);
  });

  it.each(BIASA)("bot: kalimat biasa tinggal - %s", (kalimat) => {
    expect(bot.adalahKalimatPenutupSaksi(kalimat)).toBe(false);
  });

  it("kedua salinan sepakat atas semua contoh", () => {
    for (const k of [...PENUTUP, ...BIASA]) {
      expect(ek.adalahKalimatPenutupSaksi(k)).toBe(bot.adalahKalimatPenutupSaksi(k));
    }
  });

  it("jawaban butir 'Susun Keterangan Saksi' (bot) memakai aturan yang sama", () => {
    for (const k of PENUTUP.filter((x) => !x.startsWith("- "))) {
      expect(deteksi.POLA_PENUTUP_JAWAB.test(k.replace(/^Bahwa[ ,]+/i, ""))).toBe(true);
    }
    for (const k of BIASA.filter(Boolean)) {
      expect(deteksi.POLA_PENUTUP_JAWAB.test(k)).toBe(false);
    }
  });

  it("bersihkanKeteranganSaksi membuang penutup di ujung dan menyisakan fakta", () => {
    const teks = [
      "- Bahwa Tergugat pergi meninggalkan rumah sejak tahun 2024;",
      "- Bahwa sekian lama ia pergi tanpa kabar;",
      "- Bahwa saksi sudah tidak sanggup lagi;",
      "- Bahwa cukup sekian;",
      "",
      "",
    ].join("\n");
    expect(ek.bersihkanKeteranganSaksi(teks)).toBe(
      "- Bahwa Tergugat pergi meninggalkan rumah sejak tahun 2024;\n- Bahwa sekian lama ia pergi tanpa kabar;"
    );
  });

  it("jawaban yang seluruhnya penutup dibuang utuh, termasuk yang terbelah baris", () => {
    expect(ek.bersihkanKeteranganSaksi("Tidak ada, sudah cukup;")).toBe("");
    expect(ek.bersihkanKeteranganSaksi("Sudah\ncukup;")).toBe("");
    expect(ek.bersihkanKeteranganSaksi("Bahwa tidak ada lagi yang ingin disampaikan.")).toBe("");
  });

  it("contoh di data satker (jawaban pendek nyata) tetap benar", () => {
    const nyata: Array<[string, boolean]> = [
      ["sudah cukup;", true],
      ["saya tidak sanggup lagi;", true],
      ["tidak ada, sudah cukup", true],
      ["sudah  cukup ;", true],
      ["cukup sekian;", true],
      ["saya sudah tidak sanggup lagi;", true],
      ["tidak, sudah cukup;", true],
      ["tidak ada pekerjaan lain;", false],
      ["tidak ada halangan secara hukum;", false],
      ["tidak ada;", false],
      ["saya tidak tahu;", false],
      ["tidak pernah;", false],
    ];
    for (const [jawab, harusTutup] of nyata) {
      expect(bot.adalahKalimatPenutupSaksi(jawab)).toBe(harusTutup);
      expect(ek.adalahKalimatPenutupSaksi(jawab)).toBe(harusTutup);
    }
  });
});
