// @vitest-environment node
/**
 * ============================================================================
 * 22 OKT 2026 MALAM (W62) - TES PUTUSAN: MESIN YANG MEMUAT KETIKAN "SEOLAH TERSIMPAN" + RUTE PORTAL
 * ============================================================================
 *
 * Yang dijaga:
 *   A  mesin variabel ABT (aleta_bot/services/abtMesinVariabel.js) memperlakukan ketikan sebagai baris abt_data_teks / abt_data_tanggal
 *      perkara itu TANPA menulis: ketikan hanya masuk teks kueri BACA sebagai heksa (tanpa kutip/garis miring/tanda tanya), setiap kueri
 *      tetap satu SELECT yang lolos pagarBaca, tidak satu pun INSERT/UPDATE/DELETE;
 *   B  "#7#" di dalam kueri = variabel 0007 (ABT menyimpan no_var berangka-nol) - dulu menjadi kosong;
 *   C  kode RTF yang ditulis rumus katalog (8500: tabel tanda tangan majelis) dicetak apa adanya seperti ABT, sedangkan garis miring
 *      pada ISIAN TANGAN tetap dilolos;
 *   D  rute portal tes-naskah / tes-cari: hanya Super Admin, tidak menulis ke basis data ALETA, ketikan diteruskan ke bot tanpa
 *      data ALETA (timpa/cadangan kosong), kunci/isian tak sah dibuang, jalur berbahaya ditolak.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const require_ = createRequire(import.meta.url);
const AKAR = path.resolve(__dirname, "../../..");
const mesinAbt = require_(path.join(AKAR, "aleta_bot/services/abtMesinVariabel.js"));

const keadaan = vi.hoisted(() => ({
  aktor: null as Record<string, unknown> | null,
  bot: [] as Array<{ operasi: string; params: Record<string, unknown> }>,
  jawabIsi: null as unknown,
  jawabCari: null as unknown,
  tulisDb: 0,
}));

vi.mock("@/server/db/client", () => ({
  getDatabase: async () => ({
    // Setiap jalur tulis basis data ALETA dihitung - harus tetap nol.
    queryOne: async () => null,
    queryAll: async () => [],
    prepare: () => ({ all: async () => [], get: async () => null, run: async () => ((keadaan.tulisDb += 1), { changes: 0 }) }),
    execute: async () => {
      keadaan.tulisDb += 1;
    },
    transaction: async () => {
      keadaan.tulisDb += 1;
    },
  }),
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", async (impor) => {
  const asli = await impor<typeof import("@/server/modules/aleta-ecourt/akses")>();
  return {
    ...asli,
    pastikanKapabilitas: async () => {
      if (!keadaan.aktor) throw Object.assign(new Error("tanpa aktor"), { status: 401 });
      return keadaan.aktor;
    },
  };
});
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({
  callAletaBotSippBridge: async (operasi: string, params: Record<string, unknown>) => {
    keadaan.bot.push({ operasi, params });
    return operasi === "tes.cariPerkara" ? keadaan.jawabCari : keadaan.jawabIsi;
  },
}));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (error: { status?: number; message?: string }) => Response.json({ ok: false, alasan: error?.message }, { status: error?.status ?? 500 }),
}));

afterEach(() => {
  keadaan.aktor = null;
  keadaan.bot = [];
  keadaan.jawabIsi = null;
  keadaan.jawabCari = null;
  keadaan.tulisDb = 0;
});

// ----------------------------------------------------------------------------
// Basis data tiruan: katalog + tabel isian tangan; SELECT hasil penulisan ulang dibaca secukupnya
// ----------------------------------------------------------------------------
type Baris = Record<string, unknown>;
const KATALOG: Baris[] = [
  { no_var: "0007", nama: "Anak", data_type: "data_teks", data_tabel: null, data_kolom: null, urutan_data: null, referensi: null, sql_query: null, default_data: null, multi_sidang: null },
  { no_var: "0033", nama: "Tgl", data_type: "data_tanggal", data_tabel: null, data_kolom: null, urutan_data: null, referensi: null, sql_query: null, default_data: null, multi_sidang: null },
  { no_var: "1007", nama: "Anak dari 7", data_type: "data_sql", data_tabel: null, data_kolom: null, urutan_data: null, referensi: null, sql_query: `select concat(SUBSTRING_INDEX("#7#",'anak',1),'anak') data`, default_data: null, multi_sidang: null },
  { no_var: "8500", nama: "Tanda tangan", data_type: "data_sql", data_tabel: null, data_kolom: null, urutan_data: null, referensi: null, sql_query: "select '~trowd~cellx8400 Ketua~par~cell~row' data", default_data: null, multi_sidang: null },
  { no_var: "9001", nama: "Dihitung", data_type: "data_sql", data_tabel: null, data_kolom: null, urutan_data: null, referensi: null, sql_query: "select 'rumus' data", default_data: null, multi_sidang: null },
  { no_var: "9002", nama: "Pemicu", data_type: "data_sql", data_tabel: null, data_kolom: null, urutan_data: null, referensi: null, sql_query: "select (SELECT data FROM aps_badilag.abt_data_teks WHERE no_var=7 AND perkara_id='#perkara_id#') data", default_data: null, multi_sidang: null },
];
const DB_TEKS: Record<string, string> = { "0007": "satu anak" };
const DB_TANGGAL: Record<string, string> = { "0033": "2026-01-02" };

function buatDbTiruan() {
  const log: string[] = [];
  const kueri = async (sql: string, params: unknown[] = []): Promise<Baris[]> => {
    log.push(sql);
    if (/abt_variabel/.test(sql)) return KATALOG;
    if (/abt_config/.test(sql)) return [{ value: "A4" }];
    // Ketikan "seolah tersimpan": baris UNION ALL hasil penulisan ulang (heksa / tanggal) menimpa isi tabel.
    const bacaKetikan = (tabel: "teks" | "tanggal", kode: string): string | undefined => {
      if (!new RegExp(`abt_data_${tabel}`).test(sql)) return undefined;
      const pola = tabel === "teks" ? /UNION ALL SELECT (\d+), (\d+), (?:CONVERT\(0x([0-9a-f]*) USING latin1\)|'')/g : /UNION ALL SELECT (\d+), (\d+), (?:CAST\('(\d{4}-\d{2}-\d{2})' AS DATE\)|NULL)/g;
      for (const m of sql.matchAll(pola)) if (String(Number(m[1])) === String(Number(kode))) return tabel === "teks" ? Buffer.from(m[3] ?? "", "hex").toString("latin1") : m[3];
      return undefined;
    };
    const noVar = (sql.match(/no_var\s*=\s*'?(\d+)/) || [])[1] ?? String(params[1] ?? "");
    const teks = noVar ? bacaKetikan("teks", noVar) : undefined;
    if (/abt_data_teks/.test(sql) && noVar) {
      const nilai = teks !== undefined ? teks : DB_TEKS[noVar.padStart(4, "0")];
      return nilai === undefined ? [] : [{ data: nilai }];
    }
    const tgl = noVar ? bacaKetikan("tanggal", noVar) : undefined;
    if (/abt_data_tanggal/.test(sql) && noVar) {
      const nilai = tgl !== undefined ? tgl : DB_TANGGAL[noVar.padStart(4, "0")];
      return nilai === undefined ? [] : [{ data: nilai }];
    }
    const kutip = sql.match(/^select '([^']*)' data$/i) || sql.match(/^select concat\(SUBSTRING_INDEX\("([^"]*)"/i);
    if (kutip) {
      const nilai = kutip[1].replace(/~/g, "\\");
      return [{ data: /concat\(SUBSTRING_INDEX/i.test(sql) ? `${nilai.split("anak")[0]}anak` : nilai }];
    }
    if (/perkara_jadwal_sidang/.test(sql)) return [];
    return [];
  };
  return { kueri, log };
}

const RTF_DASAR = (isi: string) => `{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}{\\colortbl;\\red0\\green0\\blue0;}\\pard ${isi}\\par}`;

describe("A. ketikan 'seolah tersimpan' tanpa menulis", () => {
  it("penulisan ulang kueri: tabel turunan, heksa, satu SELECT yang lolos pagar; skema/nama lain tidak disentuh", () => {
    const sql = "select (SELECT data FROM aps_badilag.abt_data_teks WHERE no_var=1314 AND perkara_id='5') x, (select data from abt_data_teks t where t.no_var=1) y, (select 1 from lain_db.abt_data_teks) z, (select 1 from abt_data_teks_lama)";
    const hasil = mesinAbt.terapkanIsianTangan(sql, { perkaraId: "5", teks: { "1314": "a'b?\\\"c é \u{1F600}" }, tanggal: {}, skema: "aps_badilag" }) as string;
    expect(mesinAbt.pagarBaca(hasil)).toBe("");
    // Tabel turunan: baris perkara 5 untuk 1314 dikeluarkan lalu diganti ketikan; sisanya isi tabel asli.
    expect(hasil).toContain("NOT (d.perkara_id = 5 AND d.no_var IN (1314))");
    expect(hasil).toMatch(/UNION ALL SELECT 1314, 5, CONVERT\(0x[0-9a-f]+ USING latin1\), NULL, NULL\) abt_data_teks WHERE no_var=1314/);
    // Alias milik pemanggil dipertahankan; tanpa alias diberi nama tabelnya.
    expect(hasil).toMatch(/\) t where t\.no_var=1/);
    // Skema lain dan nama tabel yang hanya berawalan sama tidak disentuh.
    expect(hasil).toContain("lain_db.abt_data_teks)");
    expect(hasil).toContain("abt_data_teks_lama)");
    // Ketikan tidak pernah muncul sebagai teks: tanpa kutip, garis miring, tanda tanya, atau huruf aslinya.
    expect(hasil).not.toContain("a'b");
    expect(hasil).not.toContain("é");
    expect(hasil).not.toMatch(/0x[0-9a-f]*[^0-9a-f ]/);
    // Karakter di luar latin1 menjadi "?" (0x3f) sebelum masuk heksa, bukan karakter ganda.
    const heksa = (hasil.match(/CONVERT\(0x([0-9a-f]+) USING latin1\)/) || [])[1];
    expect(Buffer.from(heksa, "hex").toString("latin1")).toBe("a'b?\\\"c é ?");
  });

  it("tanggal: hanya bentuk YYYY-MM-DD yang masuk; selain itu baris kosong (bukan teks mentah)", () => {
    const ok = mesinAbt.terapkanIsianTangan("select data from aps_badilag.abt_data_tanggal where no_var=33", { perkaraId: "5", teks: {}, tanggal: { "0033": "2026-10-22" }, skema: "aps_badilag" }) as string;
    expect(ok).toContain("CAST('2026-10-22' AS DATE)");
    const jahat = mesinAbt.terapkanIsianTangan("select data from aps_badilag.abt_data_tanggal where no_var=33", { perkaraId: "5", teks: {}, tanggal: { "0033": "2026-10-22'); DROP TABLE x;--" }, skema: "aps_badilag" }) as string;
    expect(jahat).not.toContain("DROP");
    expect(mesinAbt.pagarBaca(jahat)).toBe("");
  });

  it("mesin: ketikan menang atas isi ABT; tanpa ketikan isi ABT dipakai; tidak ada kueri selain SELECT", async () => {
    const dasar = buatDbTiruan();
    const biasa = mesinAbt.buatMesin({ kueri: dasar.kueri });
    const h0 = await biasa.isiRtf(RTF_DASAR("anak: #0007#"), { perkaraId: "5", sidangKe: 0 });
    expect(h0.rtf).toContain("anak: satu anak");

    const tes = buatDbTiruan();
    const mesin = mesinAbt.buatMesin({ kueri: tes.kueri, isianTangan: { perkaraId: "5", nilai: { "0007": "telah dikaruniai 2 orang anak" } } });
    const h = await mesin.isiRtf(RTF_DASAR("anak: #0007#"), { perkaraId: "5", sidangKe: 0 });
    expect(h.rtf).toContain("anak: telah dikaruniai 2 orang anak");
    expect(h.rtf).not.toContain("satu anak");
    expect(tes.log.length).toBeGreaterThan(0);
    for (const sql of tes.log) {
      expect(sql).not.toMatch(/\b(insert|update|delete|replace\s+into|drop|alter|create|truncate|call)\b/i);
      expect(mesinAbt.pagarBaca(sql)).toBe("");
    }
    // Tidak satu kueri pun memuat teks ketikan aslinya.
    expect(tes.log.some((s) => s.includes("telah dikaruniai"))).toBe(false);
    expect(h0.terisi).toEqual(["0007"]);
  });

  it("ketikan tanggal diformat seperti ABT (tgl_indo2); ketikan kosong = baris kosong (tercetak kosong, bukan nilai lama)", async () => {
    const tes = buatDbTiruan();
    const mesin = mesinAbt.buatMesin({ kueri: tes.kueri, isianTangan: { perkaraId: "5", nilai: { "0033": "2026-10-22", "0007": "" } } });
    const h = await mesin.isiRtf(RTF_DASAR("tgl: #0033# anak: [#0007#]"), { perkaraId: "5", sidangKe: 0 });
    expect(h.rtf).toContain("tgl: 22 Oktober 2026");
    expect(h.rtf).toContain("anak: []");
  });

  it("variabel yang bukan isian tangan (rumus) dititipkan sebagai timpa: ketikan tampil; tanpa katalog = diabaikan", async () => {
    const tes = buatDbTiruan();
    const mesin = mesinAbt.buatMesin({ kueri: tes.kueri, isianTangan: { perkaraId: "5", nilai: { "9001": "nilai ketikan", "7777": "tak ada di katalog", "ab": "bukan nomor" } } });
    const h = await mesin.isiRtf(RTF_DASAR("rumus: #9001#"), { perkaraId: "5", sidangKe: 0 });
    expect(h.rtf).toContain("rumus: nilai ketikan");
  });

  it("rumus lain yang membaca isian tangan lewat kueri langsung ikut berubah (pemicu)", async () => {
    const tes = buatDbTiruan();
    const mesin = mesinAbt.buatMesin({ kueri: tes.kueri, isianTangan: { perkaraId: "5", nilai: { "0007": "dua anak" } } });
    const h = await mesin.isiRtf(RTF_DASAR("pemicu: #9002#"), { perkaraId: "5", sidangKe: 0 });
    // 9002 membaca abt_data_teks 0007 langsung (no_var=7): hasilnya ketikan, bukan "satu anak" dari tabel.
    expect(tes.log.some((s) => /UNION ALL SELECT 7, 5, CONVERT\(0x/.test(s))).toBe(true);
    expect(h.rtf).toContain("pemicu: dua anak");
  });
});

describe("B. penanda pendek di dalam kueri", () => {
  it("'#7#' = variabel 0007 (no_var berangka-nol), bukan kosong", async () => {
    const tes = buatDbTiruan();
    const mesin = mesinAbt.buatMesin({ kueri: tes.kueri });
    const h = await mesin.isiRtf(RTF_DASAR("#1007#"), { perkaraId: "5", sidangKe: 0 });
    expect(h.rtf).toContain("satu anak");
  });
});

describe("C. kode RTF dari rumus katalog vs ketikan", () => {
  it("rumus (8500) dicetak sebagai RTF; garis miring di isian tangan tetap dilolos", async () => {
    const tes = buatDbTiruan();
    const mesin = mesinAbt.buatMesin({ kueri: tes.kueri, isianTangan: { perkaraId: "5", nilai: { "0007": "C:\\users\\anak" } } });
    const h = await mesin.isiRtf(RTF_DASAR("ttd: #8500# anak: #0007#"), { perkaraId: "5", sidangKe: 0 });
    expect(h.rtf).toContain("\\trowd\\cellx8400 Ketua\\par\\cell\\row");
    expect(h.rtf).not.toContain("\\\\trowd");
    expect(h.rtf).toContain("anak: C:\\\\users\\\\anak");
  });
});

// ----------------------------------------------------------------------------
// D. Rute portal
// ----------------------------------------------------------------------------
const SUPER = { id: "u1", roleId: "super-admin", name: "Super" };
const ADMIN = { id: "u2", roleId: "admin", name: "Admin" };
const HAKIM = { id: "u3", roleId: "hakim", name: "Hakim" };
const RTF_B64 = Buffer.from("{\\rtf1 isi}", "latin1").toString("base64");
const kirim = (badan: unknown) => new NextRequest("http://localhost/aleta/api/aleta-ecourt/blangko-derry/tes-naskah", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

describe("D. rute portal tes-naskah dan tes-cari", () => {
  it("tes-naskah: hanya Super Admin (admin, hakim, tanpa akun ditolak) dan bot tidak dipanggil", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/blangko-derry/tes-naskah/route");
    for (const aktor of [ADMIN, HAKIM]) {
      keadaan.aktor = aktor;
      const r = await POST(kirim({ perkaraId: "5", folder: "1 Perceraian CG", berkas: "x", isian: {} }));
      expect(r.status).toBe(403);
    }
    keadaan.aktor = null;
    expect((await POST(kirim({ perkaraId: "5", folder: "a", berkas: "x" }))).status).toBe(401);
    expect(keadaan.bot).toEqual([]);
  });

  it("tes-naskah: ketikan diteruskan ke bot sebagai isianTangan (tes:true), tanpa data ALETA; kunci tak sah dibuang; basis data ALETA tidak ditulis", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/blangko-derry/tes-naskah/route");
    keadaan.aktor = SUPER;
    keadaan.jawabIsi = { ok: true, data: { ok: true, berkas: "x.rtf", rtfBase64: RTF_B64, jumlahTerisi: 2, tersisa: ["8530"], kosong: [{ noVar: "8530", nama: "N", sebab: "s" }], sumber: { abt: 2 }, mesinGalat: "" } };
    const r = await POST(kirim({ perkaraId: "9001", sidangKe: 2, folder: "1 Perceraian CG", berkas: "[01] x", isian: { "0007": "dua anak", "abc": "buang", "12": "buang", "99999999": "buang", "8503": 5 } }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.data.rtfBase64).toBe(RTF_B64);
    expect(j.data.kosong).toHaveLength(1);
    expect(j.data.ketikanDipakai).toBe(1);
    expect(keadaan.bot).toHaveLength(1);
    const { operasi, params } = keadaan.bot[0];
    expect(operasi).toBe("blangko.isi");
    expect(params).toMatchObject({ folder: "derry_briantono/1 Perceraian CG", berkas: "[01] x.rtf", perkaraId: "9001", sidangKe: 2, tes: true, isianTangan: { "0007": "dua anak" } });
    // Tanpa isian/cadangan/lembar ALETA: naskah = data ABT/SIPP perkara acuan + ketikan saja (sama dengan abt/preview).
    expect(params).toMatchObject({ nilai: {}, cadangan: {}, tanyaJawabSaksi: {} });
    expect(keadaan.tulisDb).toBe(0);
  });

  it("tes-naskah: jalur berbahaya dan permintaan tak lengkap ditolak sebelum bot", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/blangko-derry/tes-naskah/route");
    keadaan.aktor = SUPER;
    for (const badan of [
      { perkaraId: "5", folder: "../../etc", berkas: "x" },
      { perkaraId: "5", folder: "a", berkas: "../x" },
      { perkaraId: "5", folder: "a", berkas: "b/c" },
      { perkaraId: "5; DROP", folder: "a", berkas: "x" },
      { perkaraId: "5", folder: "", berkas: "x" },
    ]) {
      expect((await POST(kirim(badan))).status).toBe(400);
    }
    expect(keadaan.bot).toEqual([]);
  });

  it("tes-naskah: bot gagal -> 502 dengan alasan, tidak ada naskah palsu", async () => {
    const { POST } = await import("@/app/api/aleta-ecourt/blangko-derry/tes-naskah/route");
    keadaan.aktor = SUPER;
    keadaan.jawabIsi = { ok: true, data: { ok: false, sebab: "Blangko tidak ditemukan." } };
    const r = await POST(kirim({ perkaraId: "5", folder: "a", berkas: "x" }));
    expect(r.status).toBe(502);
    expect((await r.json()).alasan).toContain("Blangko tidak ditemukan");
  });

  it("tes-cari: Super Admin saja; minimal tiga karakter; meneruskan nomor ke bot (baca saja)", async () => {
    const { GET } = await import("@/app/api/aleta-ecourt/blangko-derry/tes-cari/route");
    const minta = (nomor: string) => new NextRequest(`http://localhost/aleta/api/aleta-ecourt/blangko-derry/tes-cari?nomor=${encodeURIComponent(nomor)}`);
    keadaan.aktor = ADMIN;
    expect((await GET(minta("555/Pdt.G"))).status).toBe(403);
    keadaan.aktor = SUPER;
    expect((await GET(minta("55"))).status).toBe(400);
    expect(keadaan.bot).toEqual([]);
    keadaan.jawabCari = { ok: true, data: { ok: true, perkara: [{ nomorPerkara: "555/Pdt.G/2025/PA.Dgl", perkaraId: "9001" }] } };
    const r = await GET(minta("555/Pdt.G"));
    expect(r.status).toBe(200);
    expect((await r.json()).data.perkara).toHaveLength(1);
    expect(keadaan.bot).toEqual([{ operasi: "tes.cariPerkara", params: { nomorPerkara: "555/Pdt.G", limit: 12 } }]);
    expect(keadaan.tulisDb).toBe(0);
  });
});
