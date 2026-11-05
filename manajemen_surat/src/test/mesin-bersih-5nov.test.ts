// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { peringatanTanggal } from "@/app/api/aleta-ecourt/blangko-derry/susun";

/**
 * MESIN BERSIH 5 NOV 2026 (keputusan pemilik aplikasi). Data rekaan; tidak ada data pihak nyata.
 *   A. "{}" dari rumus dibuang di SEMUA pemanggil mesin (bukan hanya jalur ALETA).
 *   B. Tanggal tidak wajar (tanggal nol, tahun mustahil, bulan/hari melewati batas, tanggal lahir di masa depan) dicetak apa adanya
 *      (tanggal nol: kosong) tetapi diberi PERINGATAN: daftar per isian dari mesin, butir di "Periksa sebelum cetak" panel Blangko Derry,
 *      dan keyakinan "periksa" di jalur ALETA. Teks peringatan tidak masuk naskah dan tidak memuat nilai tanggalnya.
 */

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(__dirname, "../../..");
const mesinAbt = require_(path.join(AKAR, "aleta_bot/services/abtMesinVariabel.js"));
const baca = (f: string) => readFileSync(path.join(AKAR, f), "utf8");

const SEKARANG = new Date(2026, 10, 5); // 5 Nov 2026
const nilai = (v: unknown, o: Record<string, unknown> = {}) => mesinAbt.nilaiTanggalTakWajar(v, { ...o, sekarang: SEKARANG }) as { tanggal: boolean; sebab: string[] };

describe("tanggal bernol sebagian dan tanggal yang tidak ada di kalender", () => {
  it("bulan atau hari nol dan tanggal mustahil tidak wajar; tanggal kabisat yang sah wajar", () => {
    expect(nilai("1990-00-15").sebab).toEqual(["bulan kosong"]);
    expect(nilai("1990-05-00").sebab).toEqual(["hari kosong"]);
    expect(nilai("1990-00-00").sebab).toEqual(["bulan kosong", "hari kosong"]);
    expect(nilai("2023-02-31").sebab).toEqual(["tanggal tidak ada di kalender"]);
    expect(nilai("2023-02-29").sebab).toEqual(["tanggal tidak ada di kalender"]);
    expect(nilai("2024-02-29").sebab).toEqual([]);
    expect(nilai("31 April 2020").sebab).toEqual(["tanggal tidak ada di kalender"]);
  });
});

describe("B1. penilai tanggal murni", () => {
  it("tanggal nol: bentuk ISO, berjam, bergaris miring, dan hasil format '00 0000'", () => {
    for (const v of ["0000-00-00", "0000/00/00", "0000-00-00 00:00:00", "00 0000", "00  0000"]) {
      expect(nilai(v, { tanggal: true })).toEqual({ tanggal: true, sebab: ["tercatat kosong"] });
    }
  });

  it("tahun di bawah 1900 dan di atas tahun berjalan + 5", () => {
    expect(nilai("1899-12-31", { tanggal: true }).sebab).toEqual(["tahun di bawah 1900"]);
    expect(nilai("0100-05-05", { tanggal: true }).sebab).toEqual(["tahun di bawah 1900"]);
    expect(nilai("1900-01-01", { tanggal: true }).sebab).toEqual([]);
    expect(nilai("2031-01-01", { tanggal: true }).sebab).toEqual([]); // 2026 + 5: masih wajar
    expect(nilai("2032-01-01", { tanggal: true }).sebab).toEqual(["tahun terlalu jauh di depan"]);
    expect(nilai("05 Oktober 1800").sebab).toEqual(["tahun di bawah 1900"]);
  });

  it("bulan di atas 12 dan hari di atas 31", () => {
    expect(nilai("2026-13-01", { tanggal: true }).sebab).toEqual(["bulan lebih dari 12"]);
    expect(nilai("2026-02-32", { tanggal: true }).sebab).toEqual(["hari lebih dari 31"]);
    expect(nilai("2026-12-31", { tanggal: true }).sebab).toEqual([]);
    expect(nilai("2026-02-30", { tanggal: true }).sebab).toEqual([]); // bukan batas yang diminta
  });

  it("tanggal lahir di masa depan, hanya untuk isian tanggal lahir", () => {
    expect(nilai("2026-11-06", { tanggal: true, lahir: true }).sebab).toEqual(["tanggal lahir di masa depan"]);
    expect(nilai("2026-11-05", { tanggal: true, lahir: true }).sebab).toEqual([]);
    expect(nilai("1990-03-04", { tanggal: true, lahir: true }).sebab).toEqual([]);
    expect(nilai("2027-01-01", { tanggal: true }).sebab).toEqual([]); // tanggal sidang di depan itu wajar
  });

  it("sembarang angka dan teks BUKAN tanggal", () => {
    for (const v of ["12345678", "2026", "5 2020", "15 2020", "1-2-3", "Rp1.000.000,00", "Jl. Merdeka No. 12", "", null, undefined, "0000", "000"]) {
      expect(nilai(v)).toEqual({ tanggal: false, sebab: [] });
    }
    // bentuk Y-m-d longgar hanya untuk isian bertipe tanggal; nilai biasa harus berbentuk tanggal ISO utuh
    expect(nilai("1-2-3", { tanggal: true }).tanggal).toBe(true);
    expect(nilai("12-2-3").tanggal).toBe(false);
  });

  it("sebab tidak memuat nilai tanggalnya (data pihak)", () => {
    for (const [v, bagian] of [["1850-07-08", ["1850", "07", "08"]], ["2090-07-08", ["2090", "07", "08"]], ["2026-13-08", ["2026", "13", "08"]]] as const) {
      const sebab = nilai(v, { tanggal: true }).sebab.join(" ");
      expect(sebab).not.toBe("");
      for (const b of bagian) expect(sebab).not.toContain(b);
    }
  });
});

describe("keyakinanIsian dengan tanggal tidak wajar", () => {
  it("terisi menjadi periksa; yang sudah kosong tetap kosong", () => {
    expect(mesinAbt.keyakinanIsian({ asal: "abt", status: "terisi", sumber: "sipp", nilai: "", takWajar: true })).toBe("periksa");
    expect(mesinAbt.keyakinanIsian({ asal: "abt", status: "terisi", sumber: "sipp", nilai: "", takWajar: false })).toBe("pasti");
    expect(mesinAbt.keyakinanIsian({ asal: "kosong", status: "kosong", sumber: "sipp", nilai: "", takWajar: true })).toBe("kosong");
    expect(mesinAbt.keyakinanIsian({ asal: "abt", status: "kosong", sumber: "sipp", nilai: "", takWajar: true })).toBe("kosong");
  });
});

type Def = Record<string, string | null>;
const TAHUN_DEPAN = new Date().getFullYear() + 1;
const KATALOG: Def[] = [
  { no_var: "0347", nama: "Tgl. Lahir #0047#", data_type: "data_sql", sql_query: 'select "TGL_NOL" as data from perkara' },
  { no_var: "0348", nama: "Tgl. Lahir Anak", data_type: "data_sql", sql_query: 'select "TGL_LAHIR_DEPAN" as data from perkara' },
  { no_var: "0349", nama: "Tanggal Putusan", data_type: "data_sql", sql_query: 'select "TGL_WAJAR" as data from perkara' },
  { no_var: "0350", nama: "Tgl. Format Nol", data_type: "data_sql", sql_query: 'select "TGL_FORMAT_NOL" as data from perkara' },
  { no_var: "0351", nama: "Nomor Akta", data_type: "data_sql", sql_query: 'select "NOMOR_BUKAN_TANGGAL" as data from perkara' },
  { no_var: "0352", nama: "Tgl. Ikrar Ketikan", data_type: "data_tanggal" },
  { no_var: "0353", nama: "Tgl. Lahir Wajar", data_type: "data_sql", sql_query: 'select "TGL_LAHIR_WAJAR" as data from perkara' },
  { no_var: "0354", nama: "Tgl. Tahun Mustahil", data_type: "data_sql", sql_query: 'select "TGL_TAHUN_MUSTAHIL" as data from perkara' },
];

function basis(katalog: Def[] = KATALOG) {
  const kueri = async (sql: string) => {
    if (/FROM \w+\.abt_variabel/.test(sql)) return katalog;
    if (/abt_config/.test(sql)) return [{ value: "A4" }];
    if (/abt_data_tanggal/.test(sql)) return [{ data: "1850-07-08" }];
    if (/FROM perkara_jadwal_sidang/.test(sql)) return [];
    if (/TGL_NOL/.test(sql)) return [{ data: "0000-00-00" }];
    if (/TGL_LAHIR_DEPAN/.test(sql)) return [{ data: `${TAHUN_DEPAN}-06-15` }];
    if (/TGL_WAJAR/.test(sql)) return [{ data: "2026-03-05" }];
    if (/TGL_FORMAT_NOL/.test(sql)) return [{ data: "00 0000" }];
    if (/NOMOR_BUKAN_TANGGAL/.test(sql)) return [{ data: "12345678" }];
    if (/TGL_LAHIR_WAJAR/.test(sql)) return [{ data: "1991-02-03" }];
    if (/TGL_TAHUN_MUSTAHIL/.test(sql)) return [{ data: "3099-01-01" }];
    return [];
  };
  return { kueri };
}

const DOK = "{\\rtf1 A #0347# B #0348# C #0349# D #0350# E #0351# F #0352# G #0353# H #0354#}";

describe("B2. keluaran mesin: daftar peringatan per isian", () => {
  it("mesin bawaan: isian bertanggal tidak wajar didaftar, yang wajar dan yang bukan tanggal tidak", async () => {
    const h = await mesinAbt.buatMesin({ kueri: basis().kueri, skemaAbt: "aps_badilag" }).isiRtf(DOK, { perkaraId: "7" });
    const per = Object.fromEntries(h.peringatan.map((x: { nomor: string; sebab: string }) => [x.nomor, x.sebab]));
    expect(per).toEqual({
      "0347": "tercatat kosong",
      "0348": "tanggal lahir di masa depan",
      "0350": "tercatat kosong",
      "0352": "tahun di bawah 1900",
      "0354": "tahun terlalu jauh di depan",
    });
    expect(h.peringatan.map((x: { nomor: string }) => x.nomor)).toEqual(["0347", "0348", "0350", "0352", "0354"]);
    const nol = h.peringatan.find((x: { nomor: string }) => x.nomor === "0347");
    expect(nol).toEqual({ nomor: "0347", nama: "Tgl. Lahir #0047#", sebab: "tercatat kosong", manual: false });
    expect(h.peringatan.find((x: { nomor: string }) => x.nomor === "0352").manual).toBe(true);
  });

  it("naskah tidak berubah oleh peringatan: tanggal nol tercetak kosong, teks peringatan tidak masuk RTF", async () => {
    const h = await mesinAbt.buatMesin({ kueri: basis().kueri, skemaAbt: "aps_badilag" }).isiRtf(DOK, { perkaraId: "7" });
    expect(h.rtf).toContain("A  B");
    expect(h.rtf).toContain("05 Maret 2026");
    expect(h.rtf).not.toMatch(/tercatat|tidak wajar|tahun di bawah|aleta/i);
    expect(h.kosong).toEqual([]);
  });

  it("nilaiPenanda (bahan layar isian) membawa peringatan yang sama", async () => {
    const peta = await mesinAbt.buatMesin({ kueri: basis().kueri, skemaAbt: "aps_badilag" }).nilaiPenanda({ perkaraId: "7" }, ["0347", "0349", "0351"]);
    expect(peta.get("0347").peringatan).toEqual(["tercatat kosong"]);
    expect(peta.get("0349").peringatan).toEqual([]);
    expect(peta.get("0351").peringatan).toEqual([]);
  });

  it("isian ketikan petugas (timpa) tidak dinilai: itu bukan data SIPP", async () => {
    const h = await mesinAbt.buatMesin({ kueri: basis().kueri, skemaAbt: "aps_badilag" }).isiRtf("{\\rtf1 #0347#}", { perkaraId: "7", timpa: { "0347": "1850-01-01" } });
    expect(h.peringatan).toEqual([]);
  });

  it("jalur ALETA: isian tanggal tidak wajar berkeyakinan periksa dan memuat sebabnya; yang wajar tetap pasti", async () => {
    const h = await mesinAbt.buatMesin({ kueri: basis().kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: {}, alias: {} } }).isiRtf(DOK, { perkaraId: "7" });
    const per = Object.fromEntries(h.isian.map((x: { noVar: string; keyakinan: string; peringatan: string }) => [x.noVar, [x.keyakinan, x.peringatan]]));
    expect(per["0347"]).toEqual(["periksa", "tercatat kosong"]);
    expect(per["0348"]).toEqual(["periksa", "tanggal lahir di masa depan"]);
    expect(per["0349"]).toEqual(["pasti", ""]);
    expect(per["0351"]).toEqual(["pasti", ""]);
    expect(per["0353"]).toEqual(["pasti", ""]);
    expect(h.peringatan).toHaveLength(5);
    expect(h.ringkasanKeyakinan.periksa).toBe(5);
  });
});

describe("B3. sampai ke layar", () => {
  it("rute meneruskan daftar tanpa permintaan baru", () => {
    const pratinjau = baca("manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/pratinjau/route.ts");
    expect(pratinjau).toContain("peringatan: peringatanTanggal(data.peringatan)");
    expect(pratinjau.match(/callAletaBotSippBridge</g)?.length).toBe(1);
    const susunan = baca("manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/route.ts");
    expect(susunan).toContain("peringatan: nilai.peringatan");
    // rute isian blangko tetap satu pintu nilai (abt.nilaiPenanda); tidak ada pemanggilan bot baru untuk peringatan
    expect(susunan.match(/"abt\.nilaiPenanda"/g)?.length).toBe(1);
  });

  it("peringatanTanggal hanya meneruskan bentuk yang aman dan dibatasi", () => {
    expect(peringatanTanggal(undefined)).toEqual([]);
    expect(peringatanTanggal("x")).toEqual([]);
    expect(peringatanTanggal([{ nomor: "0347", nama: "Tgl.  Lahir #0047#", sebab: " tercatat   kosong ", manual: false }, { nomor: "bukan", sebab: "x" }, { nomor: "0348", sebab: "" }, null, 5])).toEqual([
      { nomor: "0347", nama: "Tgl. Lahir #0047#", sebab: "tercatat kosong", manual: false },
    ]);
    expect(peringatanTanggal(Array.from({ length: 100 }, (_, i) => ({ nomor: String(1000 + i), sebab: "s" })))).toHaveLength(40);
  });

  const g: Record<string, unknown> = {};
  new Function("globalThis", "window", baca("ekstensi-sipp/blangko-derry-periksa.js"))(g, g);
  const m = g.AletaPeriksaCetak as { kumpulkan: (b: unknown) => Array<{ jenis: string; teks: string; perbaiki: { aksi: string; kode?: string } | null }>; html: (d: unknown) => string };

  it("panel: satu butir per isian di 'Periksa sebelum cetak', senada, tidak menahan cetak", () => {
    const t = m.kumpulkan({
      tanggalTakWajar: [
        { nomor: "0347", nama: "Tgl. Lahir #0047#", sebab: "tercatat kosong", manual: false },
        { nomor: "0352", nama: "Tgl. Ikrar Ketikan", sebab: "tahun di bawah 1900", manual: true },
      ],
      sebutanP: "Pemohon",
      sebutanT: "Termohon",
      kodeAda: new Set(["0352"]),
    });
    expect(t.map((x) => x.jenis)).toEqual(["tanggal-takwajar", "tanggal-takwajar"]);
    expect(t[0].teks).toBe("Tanggal Lahir Termohon tidak wajar di SIPP (tercatat kosong). Periksa data di SIPP.");
    expect(t[0].perbaiki).toBeNull();
    expect(t[1].teks).toBe("Tanggal Ikrar Ketikan tidak wajar (tahun di bawah 1900). Periksa isiannya.");
    expect(t[1].perbaiki).toEqual({ aksi: "isian", kode: "0352" });
    const semua = t.map((x) => x.teks).join(" ");
    expect(semua).not.toMatch(/#|aleta/i);
    expect(m.html(t)).toContain('data-periksa="tanggal-takwajar"');
  });

  it("panel: tanpa peringatan tidak ada butir; banyak peringatan diringkas", () => {
    expect(m.kumpulkan({ tanggalTakWajar: [] })).toEqual([]);
    expect(m.kumpulkan({})).toEqual([]);
    const banyak = Array.from({ length: 7 }, (_, i) => ({ nomor: String(300 + i), nama: `Tgl. X${i}`, sebab: "tercatat kosong", manual: false }));
    const t = m.kumpulkan({ tanggalTakWajar: banyak });
    expect(t).toHaveLength(5);
    expect(t[4].jenis).toBe("tanggal-takwajar-lain");
    expect(t[4].teks).toContain("3 isian tanggal lain");
  });

  it("panel: daftar ikut jawaban isian blangko dan pratinjau yang sudah ada (tidak ada permintaan baru)", () => {
    const isian = baca("ekstensi-sipp/blangko-derry-isian.js");
    expect(isian).toContain('catatTanggalTakWajar("susunan", d.peringatan)');
    expect(isian).toContain('catatTanggalTakWajar("pratinjau", d.peringatan, true)');
    expect(isian).toContain("tanggalTakWajar: tanggalTakWajarSekarang()");
    const blok = isian.slice(isian.indexOf("function catatTanggalTakWajar"), isian.indexOf("const tanggalTakWajarSekarang"));
    expect(blok).not.toMatch(/ambilPortal|fetch\(/);
  });
});

describe("A. '{}' dibuang di semua pemanggil", () => {
  it("jalur bawaan, jalur ALETA, dan nilaiPenanda sama-sama membuang '{}' dari rumus", async () => {
    const kat: Def[] = [{ no_var: "6666", nama: "KURUNG", data_type: "data_sql", sql_query: "select concat('Menghukum:', char(92,108,105,110,101,32), '- nafkah{}') as data from perkara" }];
    const kueri = async (sql: string) => {
      if (/FROM \w+\.abt_variabel/.test(sql)) return kat;
      if (/abt_config/.test(sql)) return [{ value: "A4" }];
      if (/char\(92,108,105,110,101,32\)/.test(sql)) return [{ data: "Menghukum:\\line - nafkah{}" }];
      return [];
    };
    const lama = await mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag" }).isiRtf("{\\rtf1 #6666#}", { perkaraId: "7" });
    const baru = await mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag", jalurAleta: { pustaka: {}, alias: {} } }).isiRtf("{\\rtf1 #6666#}", { perkaraId: "7" });
    for (const h of [lama, baru]) {
      expect(h.rtf).not.toContain("\\{\\}");
      expect(h.rtf).toContain("nafkah");
    }
    const peta = await mesinAbt.buatMesin({ kueri, skemaAbt: "aps_badilag" }).nilaiPenanda({ perkaraId: "7" }, ["6666"]);
    expect(peta.get("6666").polos).not.toContain("{}");
    expect(peta.get("6666").polos).toContain("nafkah");
  });
});
