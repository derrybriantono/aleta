// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * TAHAP 8 ALETA ABT - MODE TANPA ABT DI MESIN ISIAN (5 Nov 2026). Data rekaan.
 *
 *   1. hanya bila jalurAleta.tanpaAbt === true: katalog isian dari pustaka ALETA saja, tanpa membaca abt_variabel dan abt_config;
 *   2. tabel ABT yang dibaca rumus (isian tangan, keterangan saksi/terdakwa) dianggap KOSONG dan ditulis ulang menjadi tabel turunan;
 *      nilai yang diketik petugas datang dari ALETA (cadangan), bukan dari tabel itu;
 *   3. tabel ABT lain tidak ditebak: isian itu kosong dengan sebab yang jelas;
 *   4. tanpa opsi itu (panel Blangko Derry, BAS massal, jalur ALETA bawaan) kueri sampai ke basis data PERSIS seperti sebelumnya.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(__dirname, "../../..");
const mesinAbt = require_(path.join(AKAR, "aleta_bot/services/abtMesinVariabel.js"));

const PUSTAKA = {
  "0046": { nama: "PIHAK I", data_type: "data_sql", sql_query: 'select "Siti Rekaan" as data from dual', kode: "AA00046" },
  "1111": { nama: "KETIKAN ABT", data_type: "data_sql", sql_query: "select d.data as data from aps_badilag.abt_data_teks d where d.perkara_id = #perkara_id# and d.no_var = 1111 limit 1", kode: "AA01111" },
  "2222": { nama: "TABEL ABT LAIN", data_type: "data_sql", sql_query: "select nama as data from aps_badilag.abt_menu limit 1", kode: "AA02222" },
  "3333": { nama: "ISIAN TANGAN", data_type: "data_teks", kode: "AA03333" },
};

function basis() {
  const dijalankan: string[] = [];
  const kueri = async (sql: string) => {
    dijalankan.push(sql);
    if (/Siti Rekaan/.test(sql)) return [{ data: "Siti Rekaan" }];
    if (/FROM \w+\.abt_variabel/.test(sql)) return [{ no_var: "0046", nama: "dari katalog ABT", data_type: "data_sql", sql_query: 'select "katalog" as data from dual' }];
    if (/abt_config/.test(sql)) return [{ value: "F4" }];
    return [];
  };
  return { kueri, dijalankan };
}

const alias = { AA00046: "0046", AA01111: "1111", AA02222: "2222", AA03333: "3333" };

describe("mode tanpa ABT", () => {
  it("tidak membaca katalog ABT maupun konfigurasi ABT; isian dari pustaka ALETA terisi", async () => {
    const { kueri, dijalankan } = basis();
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: PUSTAKA, alias, tanpaAbt: true } });
    const h = await mesin.isiRtf("{\\rtf1 A #0046# B}", { perkaraId: "7" });
    expect(h.rtf).toContain("Siti Rekaan");
    expect(h.kosong).toEqual([]);
    expect(dijalankan.some((q) => /abt_variabel|abt_config/.test(q))).toBe(false);
  });

  it("rujukan ke tabel isian tangan ABT ditulis ulang menjadi tabel kosong; hasilnya kosong, bukan galat", async () => {
    const { kueri, dijalankan } = basis();
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: PUSTAKA, alias, tanpaAbt: true } });
    const h = await mesin.isiRtf("{\\rtf1 A #1111# B}", { perkaraId: "7" });
    const q = dijalankan.find((x) => /d\.no_var = 1111/.test(x))!;
    expect(q).toBeTruthy();
    expect(q).not.toMatch(/aps_badilag\.abt_data_teks/);
    expect(q).toContain("(SELECT NULL AS no_var, NULL AS perkara_id, NULL AS data, NULL AS modifier, NULL AS modified FROM DUAL WHERE 1 = 0) d");
    expect(h.kosong.map((k: { noVar: string }) => k.noVar)).toEqual(["1111"]);
  });

  it("isian ALETA (cadangan) mengisi yang kosong tanpa ABT", async () => {
    const { kueri } = basis();
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: PUSTAKA, alias, tanpaAbt: true } });
    const h = await mesin.isiRtf("{\\rtf1 A #1111# B #3333# C}", { perkaraId: "7", cadangan: { "1111": "diketik di ALETA", "3333": "ketikan ALETA" } });
    expect(h.rtf).toContain("diketik di ALETA");
    expect(h.rtf).toContain("ketikan ALETA");
    expect(h.kosong).toEqual([]);
  });

  it("tabel ABT lain tidak ditebak: isian kosong dengan sebab yang jelas, naskah tetap tersusun", async () => {
    const { kueri, dijalankan } = basis();
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: PUSTAKA, alias, tanpaAbt: true } });
    const h = await mesin.isiRtf("{\\rtf1 A #2222# B #0046#}", { perkaraId: "7" });
    expect(h.kosong).toHaveLength(1);
    expect(h.kosong[0].noVar).toBe("2222");
    expect(String(h.kosong[0].sebab)).toContain("tidak tersedia tanpa ABT");
    expect(dijalankan.some((q) => /abt_menu/.test(q))).toBe(false);
    expect(h.rtf).toContain("Siti Rekaan");
  });

  it("tanpa opsi tanpaAbt kueri sampai ke basis data apa adanya (katalog dibaca, tabel tidak ditulis ulang)", async () => {
    const { kueri, dijalankan } = basis();
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: PUSTAKA, alias } });
    await mesin.isiRtf("{\\rtf1 A #1111# B}", { perkaraId: "7" });
    expect(dijalankan.some((q) => /FROM aps_badilag\.abt_variabel/.test(q))).toBe(true);
    expect(dijalankan.some((q) => /aps_badilag\.abt_data_teks d/.test(q))).toBe(true);
    const bawaan = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag" });
    await bawaan.isiRtf("{\\rtf1 A #0046# B}", { perkaraId: "7" });
    expect(dijalankan.filter((q) => /NULL AS no_var/.test(q))).toEqual([]);
  });

  it("opsi bersifat tegas: hanya nilai true yang menyalakannya", async () => {
    for (const nilai of ["true", 1, "ya", undefined]) {
      const { kueri, dijalankan } = basis();
      const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: PUSTAKA, alias, tanpaAbt: nilai } });
      await mesin.isiRtf("{\\rtf1 #0046#}", { perkaraId: "7" });
      expect(dijalankan.some((q) => /FROM aps_badilag\.abt_variabel/.test(q)), String(nilai)).toBe(true);
    }
  });
});

describe("tanpaTabelAbt (penulis ulang)", () => {
  const { tanpaTabelAbt } = mesinAbt as { tanpaTabelAbt: (sql: string, skema: string) => string };

  it("memberi alias nama tabel bila tidak ada; mempertahankan alias bila ada; bertanda kutip miring juga", () => {
    expect(tanpaTabelAbt("SELECT data FROM abt_data_tanggal WHERE no_var = 1", "aps_badilag")).toContain(") abt_data_tanggal WHERE");
    expect(tanpaTabelAbt("SELECT t.data FROM `aps_badilag_vs`.`abt_data_teks` AS t", "aps_badilag_vs")).toContain("WHERE 1 = 0) AS t");
  });
  it("tidak menyentuh skema lain, nama kolom mirip, atau kueri tanpa tabel ABT", () => {
    const aman = ["SELECT x FROM lain.abt_data_teks", "SELECT jenis_abt_x FROM sys_config", "SELECT 1 FROM perkara"];
    for (const q of aman) expect(tanpaTabelAbt(q, "aps_badilag")).toBe(q);
  });
  it("tabel ABT yang tidak dikenal melempar galat bertanda tanpaAbt", () => {
    expect(() => tanpaTabelAbt("SELECT * FROM aps_badilag.abt_menu", "aps_badilag")).toThrow(/tidak tersedia tanpa ABT/);
  });
});

describe("simbol kendali RTF dari rumus (Tahap 8)", () => {
  const PUSTAKA_SIMBOL = { "0206": { nama: "E-COURT", data_type: "data_sql", sql_query: "select concat(char(92), '~secara elektronik') as data from dual", kode: "AA00206" } };
  const kueriSimbol = async (sql: string) => {
    if (/char\(92\)/.test(sql) && !/abt_variabel/.test(sql)) return [{ data: "\\~secara elektronik" }];
    if (/FROM \w+\.abt_variabel/.test(sql)) return [{ no_var: "0206", nama: "E-COURT", data_type: "data_sql", sql_query: "select concat(char(92), '~secara elektronik') as data from dual" }];
    return [];
  };
  const DOK = "{\\rtf1 yang dilangsungkan #0206# di ruang}";

  it("jalur ALETA mempertahankan simbol spasi tak terpecah persis seperti ABT", async () => {
    const mesin = mesinAbt.buatMesin({ kueri: kueriSimbol, skemaAbt: "aps_badilag", jalurAleta: { pustaka: PUSTAKA_SIMBOL, alias: { AA00206: "0206" } } });
    const h = await mesin.isiRtf(DOK, { perkaraId: "7" });
    expect(h.rtf).toContain("yang dilangsungkan \\~secara elektronik di ruang");
    expect(h.rtf).not.toContain("\\\\~");
  });

  it("tanpa jalurAleta perilaku bawaan tidak berubah: simbol dilolos seperti sebelumnya (panel Blangko Derry dan BAS massal)", async () => {
    const mesin = mesinAbt.buatMesin({ kueri: kueriSimbol, skemaAbt: "aps_badilag" });
    const h = await mesin.isiRtf(DOK, { perkaraId: "7" });
    expect(h.rtf).toContain("\\\\~secara elektronik");
  });

  it("kata kendali biasa tetap dipertahankan di kedua jalur", async () => {
    const kueri = async (sql: string) => (/char\(92\)/.test(sql) && !/abt_variabel/.test(sql) ? [{ data: "a\\par b" }] : /FROM \w+\.abt_variabel/.test(sql) ? [{ no_var: "0206", nama: "X", data_type: "data_sql", sql_query: "select concat(char(92), 'par') as data from dual" }] : []);
    for (const jalur of [undefined, { pustaka: {}, alias: {} }]) {
      const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", ...(jalur ? { jalurAleta: jalur } : {}) });
      const h = await mesin.isiRtf("{\\rtf1 #0206#}", { perkaraId: "7" });
      expect(h.rtf).toContain("a\\par b");
    }
  });
});

describe("nilai biner di jalur ALETA (Tahap 8)", () => {
  const sumber = readFileSync(path.join(AKAR, "aleta_bot/services/sippReadOnlyBridgeService.js"), "latin1");

  it("hanya mesin jalur ALETA yang memakai pembaca nilai biner latin1; panel Blangko Derry dan BAS massal tetap memakai kueriMesinSipp", () => {
    expect(sumber).toContain("function kueriMesinSippJalurAleta(");
    expect(sumber).toContain("buatMesin({ kueri: kueriMesinSippJalurAleta, jalurAleta:");
    expect(sumber).toContain("mesinAbt = buatMesin({ kueri: kueriMesinSipp });");
    expect((sumber.match(/kueriMesinSippJalurAleta/g) ?? []).length).toBe(2);
    expect(sumber).toMatch(/charsetNr === 63/);
  });

  it("pembaca biner: nilai bukan biner tidak berubah, nilai biner dibaca sebagai latin1", () => {
    const potong = sumber.slice(sumber.indexOf("function kueriMesinSippJalurAleta("));
    const typeCast = /typeCast: (\(field\) => [^\n]+),\n/.exec(potong)![1];
    const tc = new Function(`return ${typeCast}`)() as (f: unknown) => string;
    const biner = { packet: { charsetNr: 63 }, type: "VAR_STRING", buffer: () => Buffer.from([0x65, 0x20, 0xb7, 0x20, 0x76]), string: () => "e � v" };
    const biasa = { packet: { charsetNr: 33 }, type: "VAR_STRING", buffer: () => Buffer.from("x"), string: () => "café" };
    expect(tc(biner)).toBe("e · v");
    expect(tc(biasa)).toBe("café");
  });
});
