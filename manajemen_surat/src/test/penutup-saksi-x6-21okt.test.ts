// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * 21 Okt 2026 (x6) - "Bahwa sudah cukup;" lolos ke putusan Word (foto pengguna). Sebab pasti: variabel ABT 9259-9265
 * ("KETERANGAN SAKSI N ... TANPA BARIS KOSONG (OTOMATIS: sama dengan tanya jawab keterangan saksi ABT)") memanggil
 * fungsi SQL isian_rtf_ket_saksi yang membaca SEMUA jawaban abt_keterangan_saksi; penyaring penutup hanya ada di JS
 * (bot + ekstensi). Penyaring yang sama kini juga ada di SQL (paket abt-paket/x6-penutup-saksi-21okt) dan di setiap
 * jalur tulis ekstensi (Susun saksi, editor tanya jawab Blangko Derry, Rapikan / Input ke ABT).
 */
const require_ = createRequire(import.meta.url);
const bot = require_(path.resolve(process.cwd(), "../aleta_bot/services/penutupSaksi.js")) as {
  adalahKalimatPenutupSaksi: (t: string, tanya?: string) => boolean;
  POLA_PENUTUP_LENTUR: RegExp;
};

type Baris = { no: string; tanya: string; jawab: string };

function ekstensiSaring() {
  const isi = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
  const awal = isi.indexOf("const POLA_PENUTUP = [");
  const akhir = isi.indexOf("// ─── Keterangan saksi: disunting");
  const a2 = isi.indexOf("function saringBarisPenutup(");
  const b2 = isi.indexOf("/** Menulis satu daftar tanya-jawab ke ABT");
  expect(akhir).toBeGreaterThan(awal);
  expect(a2).toBeGreaterThan(0);
  expect(b2).toBeGreaterThan(a2);
  const konteks: Record<string, unknown> = {};
  vm.createContext(konteks);
  vm.runInContext(isi.slice(awal, akhir) + "\n" + isi.slice(a2, b2), konteks);
  return konteks as unknown as {
    bersihkanKeteranganSaksi: (t: string, tanya?: string) => string;
    saringBarisPenutup: (b: Baris[]) => { baris: Baris[]; dibuang: number };
  };
}

describe("x6 - penutup tidak pernah ikut tertulis ke ABT (jalur tulis ekstensi)", () => {
  const ek = ekstensiSaring();
  const BAWAAN_TEMPLAT: Array<[string, string]> = [
    ["Apakah masih ada yang ingin Saudara sampaikan ?", "Sudah cukup;"],
    ["Apakah masih ada yang ingin saudara sampaikan?", "Sudah cukup."],
    ["Apakah masih ada keterangan yang saksi akan sampaikan?", "Cukup sekian;"],
    ["Apakah masih ada hal lain yang Saudara ingin sampaikan?", "Tidak ada, sudah cukup;"],
    ["Apakah masih ada yang ingin Saudara sampaikan?", "Bahwa sudah cukup;"],
  ];

  it.each(BAWAAN_TEMPLAT)("jawaban bawaan templat ABT dibuang dari baris yang akan disimpan - %s / %s", (tanya, jawab) => {
    const hasil = ek.saringBarisPenutup([
      { no: "1", tanya: "Apakah saksi kenal Penggugat?", jawab: "Saya kenal Penggugat;" },
      { no: "2", tanya, jawab },
    ]);
    expect(hasil.dibuang).toBe(1);
    expect(hasil.baris).toEqual([{ no: "1", tanya: "Apakah saksi kenal Penggugat?", jawab: "Saya kenal Penggugat;" }]);
  });

  it("nomor dihitung ulang; baris biasa dan jawaban kosong tidak disentuh", () => {
    const masuk: Baris[] = [
      { no: "1", tanya: "A?", jawab: "Satu;" },
      { no: "2", tanya: "Penutup?", jawab: "Sudah cukup;" },
      { no: "3", tanya: "B?", jawab: "" },
      { no: "4", tanya: "C?", jawab: "Tiga;\ndua baris;" },
    ];
    const hasil = ek.saringBarisPenutup(masuk);
    expect(hasil.dibuang).toBe(1);
    expect(hasil.baris.map((x) => x.no)).toEqual(["1", "2", "3"]);
    expect(hasil.baris[2].jawab).toBe("Tiga;\ndua baris;");
    const tanpa: Baris[] = [
      { no: "1", tanya: "A?", jawab: "Satu;" },
      { no: "2", tanya: "B?", jawab: "Dua;" },
    ];
    expect(ek.saringBarisPenutup(tanpa)).toEqual({ baris: tanpa, dibuang: 0 });
  });

  it("'tidak sanggup lagi' atas pertanyaan mendamaikan tinggal; atas pertanyaan penutup dibuang", () => {
    const damai = ek.saringBarisPenutup([{ no: "1", tanya: "Apakah saksi masih sanggup untuk mendamaikan Penggugat dan Tergugat?", jawab: "Saya tidak sanggup lagi;" }]);
    expect(damai.dibuang).toBe(0);
    const tutup = ek.saringBarisPenutup([{ no: "1", tanya: "Apakah masih ada yang ingin saudara sampaikan?", jawab: "Saya tidak sanggup lagi;" }]);
    expect(tutup.dibuang).toBe(1);
  });

  it("baris 'cukup;' yang hanya pecahan baris di tengah kalimat TIDAK dibuang (ukur data nyata: 1 jawaban terpotong sebelum x6)", () => {
    const asli =
      "Yang menjadi penyebab perselisihan dan pertengkaran antara Penggugat dan Tergugat\nadalah karena masalah nafkah yang diberikan Tergugat kepada Penggugat tidak\ncukup;";
    expect(ek.bersihkanKeteranganSaksi(asli, "Apa penyebab perselisihan?")).toBe(asli);
    const satu: Baris[] = [{ no: "1", tanya: "Apa penyebab?", jawab: asli }];
    expect(ek.saringBarisPenutup(satu)).toEqual({ baris: satu, dibuang: 0 });
    // penutup yang sungguh-sungguh sesudah kalimat selesai tetap dibuang
    expect(ek.bersihkanKeteranganSaksi("Tergugat pergi sejak 2024;\nSudah cukup;")).toBe("Tergugat pergi sejak 2024;");
    // tanpa tanda ujung dan bukan baris terakhir yang berdiri sendiri: dibiarkan (ragu = tinggal)
    expect(ek.bersihkanKeteranganSaksi("Tergugat pergi sejak 2024\nsudah cukup lama")).toBe("Tergugat pergi sejak 2024\nsudah cukup lama");
  });

  it("semua jalur tulis memakai penyaring yang sama; Rapikan mencakup SEMUA variabel keterangan saksi", () => {
    const abt = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt.js"), "utf8");
    const klien = readFileSync(path.resolve(process.cwd(), "../ekstensi-sipp/abt-klien.js"), "utf8");
    const kirim = abt.slice(abt.indexOf("async function kirimTanyaJawab("), abt.indexOf("async function kirimTanyaJawab(") + 600);
    expect(kirim).toContain("saringBarisPenutup(");
    const simpan = klien.slice(klien.indexOf("async simpanTanyaJawab("), klien.indexOf("async simpanTanyaJawab(") + 2500);
    expect(simpan).toContain("saringBarisPenutup(");
    expect(abt.split("for (const kode of kodeKeteranganSaksi()) {").length - 1).toBe(2);
    expect(abt).not.toMatch(/for \(const kode of \[VAR_SAKSI_1, VAR_SAKSI_2\]\) \{\s+const item = peta\.get\(kode\)/);
    const blok = abt.slice(abt.indexOf("const VAR_KETERANGAN_SAKSI"), abt.indexOf("function kodeKeteranganSaksi"));
    for (const kode of ["2021", "2022", "2023", "2024", "2031", "2032", "8920", "8932", "8942"]) expect(blok).toContain(`"${kode}"`);
  });
});

describe("x6 - paket ABT: penyaring SQL = terjemahan mekanis pola bot", () => {
  const dir = path.resolve(process.cwd(), "../abt-paket/x6-penutup-saksi-21okt");
  const fungsi = readFileSync(path.join(dir, "paket-satker/abt-x6-penutup-saksi-21okt-FUNGSI.sql"), "utf8");
  const pola = require_(path.join(dir, "sumber/pola_posix.js")) as { POLA: Record<string, string>; keposix: (s: string) => string };
  const bangun = require_(path.join(dir, "sumber/bangun_paket.js")) as { fungsiSql: () => string };

  it("FUNGSI.sql di repo sama persis dengan hasil bangun dari sumber (tidak basi)", () => {
    expect(fungsi).toBe(bangun.fungsiSql());
  });

  it("pola lentur di SQL = POLA_PENUTUP_LENTUR bot diterjemahkan (tanpa backslash-s, (?:, batas kata, lookahead)", () => {
    expect(pola.POLA.lentur).toBe(pola.keposix(bot.POLA_PENUTUP_LENTUR.source));
    expect(fungsi).toContain(`s REGEXP '${pola.POLA.lentur}'`);
    expect(pola.POLA.lentur).not.toMatch(/[\\]|\(\?/);
    for (const k of ["tidakAda", "ketahui", "lagiLain", "kesanggupan", "kerja", "pasti", "tanyaKesanggupanPerkara", "tanyaPenutupA", "tanyaPenutupB"]) {
      expect(fungsi).toContain(`'${pola.POLA[k]}'`);
    }
  });

  it("SQL hanya ASCII, tanpa REGEXP_REPLACE / lookahead (MariaDB 5.5), dan tanpa kata merek", () => {
    expect(fungsi).not.toMatch(/[^\x09\x0a\x20-\x7e]/);
    expect(fungsi.toLowerCase()).not.toContain("regexp_replace");
    expect(fungsi).not.toMatch(/[\\]s|\(\?[:=!]/);
    expect(fungsi.toLowerCase()).not.toContain("aleta");
  });

  it("tiga fungsi dibuat; isian_rtf_ket_saksi (dipanggil variabel 9259-9265) tidak berubah nama/tanda tangan", () => {
    for (const nama of ["isian_rtf_penutup", "isian_rtf_saring_penutup", "isian_rtf_ket_saksi"]) {
      expect(fungsi).toContain(`CREATE FUNCTION ${nama}(`);
    }
    expect(fungsi).toContain("CREATE FUNCTION isian_rtf_ket_saksi(pid INT, sk VARCHAR(40)) RETURNS LONGTEXT CHARSET utf8mb4");
    expect(fungsi).toContain("SELECT jawaban, pertanyaan FROM aps_badilag.abt_keterangan_saksi");
    expect(fungsi).toContain("SET t = isian_rtf_saring_penutup(t, tq)");
  });
});
