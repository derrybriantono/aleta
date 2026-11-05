// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bolehJalurAleta } from "@/server/modules/aleta-abt-pustaka/jalur";
import { susunPustakaMesin, type BarisPustakaMesin } from "@/lib/aleta-abt-pustaka";

/**
 * TAHAP 4 ALETA ABT - MESIN ISIAN SENDIRI (5 Nov 2026). Data rekaan; tidak ada data pihak nyata.
 *
 * Dijaga:
 *   1. Perilaku BAWAAN mesin tidak berubah: tanpa opsi jalurAleta keluaran isiRtf tidak memuat kolom baru, "{}" dari rumus tetap
 *      tercetak (perilaku lama), dan panel Blangko Derry/BAS massal tidak memanggil jalur baru.
 *   2. Jalur ALETA: rumus dari pustaka bila barisnya ada, katalog ABT bila belum; nomor #NNNN# dan kode bermakna sama-sama dikenali.
 *   3. Sumber (SIPP, e-Court, gugatan, saksi, manual) dan keyakinan (pasti, periksa, kosong) per isian.
 *   4. Isian kosong tidak lolos cetak final.
 *   5. Penjagaan Super Admin ada di server dan rute pratinjau hanya bercabang bila `jalurAleta === true`.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(__dirname, "../../..");
const mesinAbt = require_(path.join(AKAR, "aleta_bot/services/abtMesinVariabel.js"));

type Def = Record<string, string | null>;
const KATALOG: Def[] = [
  { no_var: "0046", nama: "PIHAK I", data_type: "data_sql", sql_query: 'select "Siti Rekaan" as data FROM perkara WHERE perkara_id = #perkara_id#' },
  { no_var: "0047", nama: "PIHAK II", data_type: "data_sql", sql_query: 'select "Budi Rekaan" as data FROM perkara WHERE perkara_id = #perkara_id#' },
  { no_var: "1111", nama: "SALAM", data_type: "data_sql", sql_query: 'select "salam dari katalog" as data from dual' },
  { no_var: "2222", nama: "ECOURT", data_type: "data_sql", sql_query: "select x as data from ecourt_pihak where perkara_id = #perkara_id#" },
  { no_var: "3333", nama: "POSITA", data_type: "data_sipp", data_tabel: "perkara", data_kolom: "posita" },
  { no_var: "4444", nama: "KETIKAN", data_type: "data_teks" },
  { no_var: "5555", nama: "BERSARANG", data_type: "data_sql", sql_query: 'select concat("kepada #0046#") as data' },
  { no_var: "6666", nama: "KURUNG", data_type: "data_sql", sql_query: "select concat('Menghukum:', char(92,108,105,110,101,32), '- nafkah{}') as data from perkara" },
  { no_var: "7777", nama: "PERIKSA", data_type: "data_sql", sql_query: 'select "nafkah [PERIKSA: isi]" as data from perkara' },
];

function basisPalsu(katalog: Def[] = KATALOG, opsi: { teks?: string | null } = {}) {
  const dijalankan: string[] = [];
  const kueri = async (sql: string) => {
    dijalankan.push(sql);
    if (/FROM \w+\.abt_variabel/.test(sql)) return katalog;
    if (/abt_config/.test(sql)) return [{ value: "A4" }];
    if (/abt_data_teks/.test(sql)) return opsi.teks === null ? [] : [{ data: opsi.teks ?? "ketikan petugas" }];
    if (/FROM perkara_jadwal_sidang/.test(sql)) return [];
    if (/select x as data from ecourt_pihak/.test(sql)) return [{ data: "dari e-Court" }];
    if (/Siti Rekaan/.test(sql)) return [{ data: "Siti Rekaan" }];
    if (/Budi Rekaan/.test(sql)) return [{ data: "Budi Rekaan" }];
    if (/salam dari katalog/.test(sql)) return [{ data: "salam dari katalog" }];
    if (/char\(92,108,105,110,101,32\)/.test(sql)) return [{ data: "Menghukum:\\line - nafkah{}" }];
    if (/PERIKSA/.test(sql)) return [{ data: "nafkah [PERIKSA: isi]" }];
    if (/concat\("kepada/.test(sql)) return [{ data: "kepada Siti Rekaan" }];
    if (/posita/.test(sql)) return [{ data: "posita rekaan" }];
    return [];
  };
  return { kueri, dijalankan };
}

const DOK = "{\\rtf1 A #0046# B #1111# C #2222# D #3333# E #6666# F}";

describe("perilaku bawaan tidak berubah", () => {
  it("tanpa jalurAleta keluaran isiRtf tidak memuat kolom jalur baru dan '{}' rumus tetap tercetak", async () => {
    const { kueri } = basisPalsu();
    const h = await mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag" }).isiRtf("{\\rtf1 #0046# #6666#}", { perkaraId: "7" });
    expect(Object.keys(h).sort()).toEqual(["jumlahKueri", "kosong", "mesinGalat", "rtf", "sumber", "terisi", "terpecahDisatukan"]);
    expect(h.rtf).toContain("Siti Rekaan");
    expect(h.rtf).toContain("nafkah\\{\\}");
  });

  it("opsi cetakFinal, alias, dan pustaka diabaikan tanpa jalurAleta", async () => {
    const { kueri } = basisPalsu();
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag" });
    const h = await mesin.isiRtf("{\\rtf1 #0046# #4444#}", { perkaraId: "7", cetakFinal: true });
    expect(h.rtf).not.toBe("");
    expect(h.ditahan).toBeUndefined();
    expect(h.isian).toBeUndefined();
  });

  it("nilaiPenanda (dipakai Blangko ALETA DOCX/PDF) tidak berubah bentuknya", async () => {
    const { kueri } = basisPalsu();
    const peta = await mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag" }).nilaiPenanda({ perkaraId: "7" }, ["0046"]);
    expect(Object.keys(peta.get("0046")).sort()).toEqual(["nama", "polos", "rtf", "sebab", "status"]);
  });

  it("rute pratinjau hanya bercabang ke jalur ALETA bila jalurAleta === true", () => {
    const rute = readFileSync(path.join(__dirname, "../app/api/aleta-ecourt/blangko-derry/pratinjau/route.ts"), "utf8");
    expect(rute).toContain("badan.jalurAleta === true");
    expect(rute.match(/isiJalurAleta\(/g)?.length).toBe(1);
    // pemanggil lain mesin tidak membawa jalur baru
    for (const f of ["app/api/aleta-ecourt/bas/naskah/route.ts", "app/api/aleta-ecourt/bas/periksa/route.ts", "app/api/aleta-ecourt/blangko-derry/tes-naskah/route.ts"]) {
      expect(readFileSync(path.join(__dirname, "..", f), "utf8")).not.toMatch(/jalurAleta|cetakFinal/);
    }
  });
});

describe("jalur ALETA: pustaka, katalog, dan alias", () => {
  const pustaka = {
    "1111": { kode: "AA01111", nama: "SALAM", data_type: "data_sql", sql_query: 'select "salam dari pustaka" as data from dual' },
    "9999": { kode: "salam_penutup", nama: "PENUTUP", data_type: "data_sql", sql_query: 'select "penutup dari pustaka" as data from dual' },
  };
  const alias = { AA01111: "1111", salam_penutup: "9999", AA00046: "0046" };

  function mesinAleta() {
    const { kueri } = basisPalsu();
    const dasar = kueri;
    const kueri2 = async (sql: string, p?: unknown[]) => {
      if (/salam dari pustaka/.test(sql)) return [{ data: "salam dari pustaka" }];
      if (/penutup dari pustaka/.test(sql)) return [{ data: "penutup dari pustaka" }];
      return dasar(sql);
    };
    return mesinAbt.buatMesin({ kueri: kueri2, skemaAbt: "aps_badilag", jalurAleta: { pustaka, alias } });
  }

  it("memakai rumus pustaka bila barisnya ada dan katalog ABT bila belum", async () => {
    const h = await mesinAleta().isiRtf("{\\rtf1 #1111# | #0046# | #9999#}", { perkaraId: "7" });
    expect(h.rtf).toContain("salam dari pustaka");
    expect(h.rtf).not.toContain("salam dari katalog");
    expect(h.rtf).toContain("Siti Rekaan");
    expect(h.rtf).toContain("penutup dari pustaka");
    const per = Object.fromEntries(h.isian.map((x: { noVar: string; asalRumus: string }) => [x.noVar, x.asalRumus]));
    expect(per).toMatchObject({ "0046": "katalog", "1111": "pustaka", "9999": "pustaka" });
    expect(h.isian.find((x: { noVar: string }) => x.noVar === "1111").kode).toBe("AA01111");
  });

  it("mengenali #kode# bermakna sebagai nomor lama, dan #NNNN# tetap dikenali", async () => {
    const h = await mesinAleta().isiRtf("{\\rtf1 #salam_penutup# | #AA01111# | #AA00046# | #1111# | #tidak_dikenal#}", { perkaraId: "7" });
    expect(h.rtf).toContain("penutup dari pustaka | salam dari pustaka | Siti Rekaan | salam dari pustaka | #tidak_dikenal#");
  });

  it("kode bermakna di dalam rumus ikut dikenali", async () => {
    const { kueri } = basisPalsu();
    const dasar = kueri;
    const kueri2 = async (sql: string) => (/kepada Budi/.test(sql) ? [{ data: "kepada Budi Rekaan" }] : dasar(sql));
    const mesin = mesinAbt.buatMesin({
      kueri: kueri2,
      skemaAbt: "aps_badilag",
      jalurAleta: { pustaka: { "8888": { kode: "sapa", nama: "SAPA", data_type: "data_sql", sql_query: 'select concat("kepada #nama_t#") as data' } }, alias: { nama_t: "0047", sapa: "8888" } },
    });
    const h = await mesin.isiRtf("{\\rtf1 #sapa#}", { perkaraId: "7" });
    expect(h.rtf).toContain("kepada Budi Rekaan");
  });

  it("'{}' dari rumus tidak tercetak di jalur ALETA, tetap tercetak di jalur lama", async () => {
    const { kueri } = basisPalsu();
    const lama = await mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag" }).isiRtf("{\\rtf1 #6666#}", { perkaraId: "7" });
    const baru = await mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: {}, alias: {} } }).isiRtf("{\\rtf1 #6666#}", { perkaraId: "7" });
    expect(lama.rtf).toContain("\\{\\}");
    expect(baru.rtf).not.toContain("\\{\\}");
    expect(baru.rtf).toContain("nafkah");
  });
});

describe("sumber dan keyakinan per isian", () => {
  it("klasifikasi sumber menurut definisi", () => {
    const { sumberDariDefinisi: s } = mesinAbt;
    expect(s({ data_type: "data_sipp", data_tabel: "perkara", data_kolom: "nomor_perkara" })).toBe("sipp");
    expect(s({ data_type: "data_sipp", data_tabel: "perkara", data_kolom: "posita" })).toBe("gugatan");
    expect(s({ data_type: "data_sql", sql_query: "select 1 as data from ecourt_pihak" })).toBe("ecourt");
    expect(s({ data_type: "data_sql", sql_query: "select 1 as data from perkara p join ecourt_pihak e on 1" })).toBe("sipp");
    expect(s({ data_type: "tanya_jawab" })).toBe("saksi");
    expect(s({ data_type: "data_teks" })).toBe("manual");
    expect(s({ data_type: "data_sql", sql_query: "select data from aps_badilag.abt_data_teks where no_var = 1" })).toBe("manual");
    expect(s({ data_type: "data_sql", sql_query: "select data from perkara p, aps_badilag.abt_data_teks t" })).toBe("sipp");
    expect(s({ data_type: "data_sql", sql_query: "select data from perkara_keterangan_saksi" })).toBe("saksi");
    expect(s({ data_type: "data_sql", sql_query: 'select concat("kepada #0046#") as data' })).toBe("");
    expect(mesinAbt.URUTAN_SUMBER).toEqual(["sipp", "ecourt", "gugatan", "saksi", "manual"]);
  });

  it("keyakinan: pasti, periksa, kosong", async () => {
    const { kueri } = basisPalsu(KATALOG, { teks: null });
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: {}, alias: {} } });
    const h = await mesin.isiRtf("{\\rtf1 #0046# #2222# #3333# #4444# #5555# #7777#}", { perkaraId: "7" });
    const per = Object.fromEntries(h.isian.map((x: { noVar: string }) => [x.noVar, x]));
    expect(per["0046"]).toMatchObject({ sumber: "sipp", keyakinan: "pasti" });
    expect(per["2222"]).toMatchObject({ sumber: "ecourt", keyakinan: "pasti" });
    expect(per["3333"]).toMatchObject({ sumber: "gugatan", keyakinan: "periksa" });
    expect(per["4444"]).toMatchObject({ sumber: "manual", keyakinan: "kosong" });
    expect(per["5555"]).toMatchObject({ sumber: "sipp", keyakinan: "pasti" });
    expect(per["7777"]).toMatchObject({ sumber: "sipp", keyakinan: "periksa" });
    expect(h.ringkasanKeyakinan).toEqual({ pasti: 3, periksa: 2, kosong: 1 });
  });

  it("ketikan petugas yang sudah ada = manual dan pasti", async () => {
    const { kueri } = basisPalsu();
    const h = await mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: {}, alias: {} } }).isiRtf("{\\rtf1 #4444#}", { perkaraId: "7" });
    expect(h.isian[0]).toMatchObject({ noVar: "4444", sumber: "manual", keyakinan: "pasti" });
  });
});

describe("isian kosong tidak lolos cetak final", () => {
  it("cetakFinal menahan naskah dan menyebut isian kosong", async () => {
    const { kueri } = basisPalsu(KATALOG, { teks: null });
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: {}, alias: {} } });
    const final = await mesin.isiRtf("{\\rtf1 #0046# #4444#}", { perkaraId: "7", cetakFinal: true });
    expect(final.lolosCetak).toBe(false);
    expect(final.ditahan).toBe(true);
    expect(final.rtf).toBe("");
    expect(final.kosong.map((k: { noVar: string }) => k.noVar)).toEqual(["4444"]);
    const pratinjau = await mesin.isiRtf("{\\rtf1 #0046# #4444#}", { perkaraId: "7" });
    expect(pratinjau.lolosCetak).toBe(false);
    expect(pratinjau.ditahan).toBeUndefined();
    expect(pratinjau.rtf).toContain("Siti Rekaan");
  });

  it("naskah yang lengkap lolos cetak final", async () => {
    const { kueri } = basisPalsu();
    const mesin = mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: {}, alias: {} } });
    const final = await mesin.isiRtf("{\\rtf1 #0046# #4444#}", { perkaraId: "7", cetakFinal: true });
    expect(final.lolosCetak).toBe(true);
    expect(final.ditahan).toBeUndefined();
    expect(final.rtf).toContain("ketikan petugas");
  });
});

describe("pustaka ALETA -> mesin dan penjagaan server", () => {
  const baris = (no: string, kode: string, sql: string): BarisPustakaMesin => ({
    no_var: no, kode, nama: `V${no.padStart(4, "0")}`, tipe: "data_sql", data_tabel: null, data_kolom: null, urutan_data: null, referensi_asal: null, sql_query: sql, default_data: null, multi_sidang: null,
  });

  it("susunPustakaMesin berurut, membuat alias kode, dan sidiknya tidak bergantung urutan baris", () => {
    const sidik = (t: string) => `s${t.length}:${t.slice(0, 12)}`;
    const a = susunPustakaMesin([baris("0047", "AA00047", "x"), baris("46", "AA00046", "y")], sidik);
    const b = susunPustakaMesin([baris("0046", "AA00046", "y"), baris("0047", "AA00047", "x")], sidik);
    expect(Object.keys(a.pustaka)).toEqual(["0046", "0047"]);
    expect(a.alias).toEqual({ AA00046: "0046", AA00047: "0047" });
    expect(a.sidik).toBe(b.sidik);
    expect(a.pustaka["0046"].sql_query).toBe("y");
    expect(susunPustakaMesin([], sidik).pustaka).toEqual({});
  });

  it("hanya Super Admin yang boleh memakai jalur ALETA (peran efektif)", () => {
    expect(bolehJalurAleta({ roleId: "super-admin" } as never)).toBe(true);
    expect(bolehJalurAleta({ roleId: "admin" } as never)).toBe(false);
    expect(bolehJalurAleta({ roleId: "hakim" } as never)).toBe(false);
    expect(bolehJalurAleta(null as never)).toBe(false);
  });

  it("jalur.ts menolak non Super Admin dengan 403 sebelum menyentuh basis data atau bot", () => {
    const teks = readFileSync(path.join(__dirname, "../server/modules/aleta-abt-pustaka/jalur.ts"), "utf8");
    const iTolak = teks.indexOf("throw new ApiError(403");
    const iDb = teks.indexOf("await getDatabase()");
    const iBot = teks.indexOf("callAletaBotSippBridge<HasilBot>(");
    expect(iTolak).toBeGreaterThan(0);
    expect(iTolak).toBeLessThan(iDb);
    expect(iDb).toBeLessThan(iBot);
    expect(teks).toMatch(/tidak ada tulisan ke SIPP\/ABT/);
  });
});
