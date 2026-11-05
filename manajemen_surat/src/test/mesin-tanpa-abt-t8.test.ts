// @vitest-environment node
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
