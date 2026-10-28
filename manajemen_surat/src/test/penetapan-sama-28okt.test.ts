// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { afterEach, describe, expect, it } from "vitest";

import { BAWAAN_PETA_PENETAPAN } from "@/lib/peta-penetapan";
import {
  type Ketergantungan,
  type LangkahTulis,
  type MasukanKerja,
  kerjakanPenetapan,
  pilihanModeOtomatis,
} from "@/server/modules/aleta-ecourt/kerjakan-penetapan";

/**
 * PENETAPAN SAMA (28 Okt 2026, permintaan hakim/Super Admin): kartu Penetapan di panel ALETA (rantaiPenetapan ->
 * idUntukTulis, e-Doc per baris) dan panel "Penetapan Otomatis" di halaman SIPP (penetapan-sipp.js ->
 * aletaPenetapanKerja.kerjakan -> rute kerjakan -> nilaiTulisDariUsulan) harus menulis HAL YANG SAMA ke SIPP untuk
 * pilihan yang sama, dan e-Doc-nya mengikuti aturan yang sama (yang sudah ada tidak ditimpa tanpa persetujuan; cap
 * hanya PMH).
 */

const AKAR = path.resolve(__dirname, "../../..");
const KONTEN = readFileSync(path.join(AKAR, "ekstensi-sipp/konten.js"), "utf8");
const KERJA = readFileSync(path.join(AKAR, "ekstensi-sipp/penetapan-kerja.js"), "utf8");
const SIPP = readFileSync(path.join(AKAR, "ekstensi-sipp/penetapan-sipp.js"), "utf8");

/** Sumber satu fungsi tingkat atas konten.js (kurung kurawal dihitung; isi fungsi-fungsi ini tanpa string berkurawal). */
function sumberFungsi(teks: string, nama: string): string {
  const awal = teks.indexOf(`\nfunction ${nama}(`);
  if (awal < 0) throw new Error(`fungsi ${nama} tidak ada`);
  const buka = teks.indexOf("{", teks.indexOf(")", awal));
  let dalam = 0;
  for (let i = buka; i < teks.length; i += 1) {
    if (teks[i] === "{") dalam += 1;
    else if (teks[i] === "}") {
      dalam -= 1;
      if (dalam === 0) return teks.slice(awal + 1, i + 1);
    }
  }
  throw new Error(`fungsi ${nama} tidak tertutup`);
}

/** idUntukTulis ekstensi yang SESUNGGUHNYA (bukan salinan) - dijalankan di vm. */
function idUntukTulisEkstensi(): (jenis: string, usulan: unknown, pilihanManual: Record<string, unknown>) => Record<string, unknown> | null {
  const konteks: Record<string, unknown> = {};
  vm.createContext(konteks);
  const nama = ["tanggalSidangTerpilih", "susunanTerpilih", "pilihanDari", "idUntukTulis"];
  vm.runInContext(`${nama.map((n) => sumberFungsi(KONTEN, n)).join("\n")}\nglobalThis.__f = idUntukTulis;`, konteks);
  return konteks.__f as never;
}

const USULAN = {
  tanggalPenetapan: "2026-10-28",
  perkara: { perkaraId: 10300, nomorPerkara: "694/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347 },
  pmh: {
    bentuk: "majelis",
    anggota: [{ hakimId: 26 }, { hakimId: 28 }, { hakimId: 31 }],
    hitungan: [{ hakimId: 26 }, { hakimId: 28 }, { hakimId: 31 }, { hakimId: 32 }],
    susunanTerpakai: [{ kunci: "32-26-31", anggota: [{ hakimId: 32 }, { hakimId: 26 }, { hakimId: 31 }] }],
  },
  ppp: { usulan: { paniteraId: 30 }, calon: [{ id: 30, paniteraId: 30 }, { id: 21, paniteraId: 21 }] },
  pjs: { usulan: { jurusitaId: 30 }, calon: [{ id: 30, jurusitaId: 30 }, { id: 28, jurusitaId: 28 }] },
  phs: { usulan: "2026-11-04" },
};

function siapServer(usulan: unknown = USULAN) {
  const rantai: LangkahTulis[][] = [];
  const usulanDiminta: number[][] = [];
  const dep: Ketergantungan = {
    bacaKeadaan: async () => ({
      ok: true,
      data: { perkaraId: 10300, nomorPerkara: "694/Pdt.G/2026/PA.Dgl", langkah: { pmh: { ada: false }, ppp: { ada: false }, pjs: { ada: false }, phs: { ada: false } } },
    }),
    ambilKunci: async () => ({ ok: true, data: { token: "T" } }),
    lepasKunci: async () => ({ ok: true }),
    bacaUsulan: async (_n, pilihanMajelis) => {
      usulanDiminta.push(pilihanMajelis);
      return { ok: true, data: usulan as Record<string, unknown> };
    },
    // Bawaan pemetaan jabatan hanya mengisi yang kosong - persis pastikanPejabatLangkah.
    pastikanPejabat: async (_t, langkah) => {
      for (const l of langkah) if (!l.pejabatUsername && l.jenis !== "phs") l.pejabatUsername = l.jenis === "pmh" ? "ketua" : "panitera";
      return null;
    },
    periksaLibur: async () => null,
    tulisRantai: async (p) => {
      rantai.push(p.langkah);
      return { ok: true, data: { ok: true, utuh: true, hasil: p.langkah.map((l) => ({ jenis: l.jenis, ok: true, tanggalPenetapan: p.tanggalPenetapan })) } };
    },
    tulisKering: async () => ({ ok: true, data: { ok: true } }),
  };
  return { dep, rantai, usulanDiminta };
}

const dasar: MasukanKerja = { nomorPerkara: "694/Pdt.G/2026/PA.Dgl", mode: "otomatis", kering: false, olehUsername: "admin", operator: "SUPER ADMIN" };

/** Yang dikirim kartu Penetapan ke bot untuk satu jenis (rantaiPenetapan: { jenis, ...idUntukTulis, pejabatUsername }). */
function kirimanPanel(jenis: string, pilihanManual: Record<string, unknown>, pejabat: Record<string, string>, bawaan: Record<string, string>) {
  const nilai = idUntukTulisEkstensi()(jenis, USULAN, pilihanManual);
  return rata({ jenis, ...nilai, pejabatUsername: pejabat[jenis] || bawaan[jenis] || "" });
}

/** pejabatUsername kosong == tidak disebut (bot membaca String(x || "")). */
function rata(l: Record<string, unknown>) {
  const { pejabatUsername, ...sisa } = l;
  return pejabatUsername ? { ...sisa, pejabatUsername } : sisa;
}

describe("A. tulisan ke SIPP: kartu Penetapan == Penetapan Otomatis halaman SIPP", () => {
  const BAWAAN = { pmh: "ketua", ppp: "panitera", pjs: "panitera", phs: "" };

  it("mode otomatis + sidang keliling (hari, ruang, jam) + pejabat pilihan: langkah yang dikirim ke bot IDENTIK", async () => {
    // Keadaan papan sesudah petugas mencentang "Sidang keliling" di mode otomatis dan mengeklik pejabat PMH lain.
    const pilihanManual = { sidkel: true, phs: "2026-11-06", ruangan: 7, jam: "10:30" };
    const pejabat = { pmh: "wakil" };
    const panel = ["pmh", "ppp", "pjs", "phs"].map((j) => kirimanPanel(j, pilihanManual, pejabat, BAWAAN));

    const s = siapServer();
    const h = await kerjakanPenetapan(s.dep, { ...dasar, pilihan: { ...pilihanManual, pejabat } });
    expect(h.ok).toBe(true);
    expect(s.rantai).toHaveLength(1);
    expect(s.rantai[0].map(rata)).toEqual(panel);
    expect(s.rantai[0].find((l) => l.jenis === "phs")).toMatchObject({ tanggalSidang: "2026-11-06", ruanganId: 7, jamSidang: "10:30" });
    expect(s.rantai[0][0].pejabatUsername).toBe("wakil");
  });

  it("mode otomatis tanpa sidang keliling: sisa pilihan tangan TIDAK berlaku di kedua jalur (orang & hari = usulan)", async () => {
    // Berpindah ke otomatis mengosongkan pilihanManual di papan; server pun mengabaikan sisa yang terkirim.
    const s = siapServer();
    await kerjakanPenetapan(s.dep, { ...dasar, pilihan: { majelis: "32-26-31", ppp: 21, phs: "2026-12-01" } });
    const panel = ["pmh", "ppp", "pjs", "phs"].map((j) => kirimanPanel(j, {}, {}, BAWAAN));
    expect(s.rantai[0].map(rata)).toEqual(panel);
    expect(pilihanModeOtomatis({ ppp: 21, pmhKursi: [32], phs: "2026-12-01" })).toEqual({});
    expect(pilihanModeOtomatis({ sidkel: true, ppp: 21, pmhKursi: [32], phs: "2026-12-01" })).toEqual({ sidkel: true, phs: "2026-12-01" });
  });

  it("mode manual (per majelis, PP, JS, hari, ruang, jam, pejabat): identik", async () => {
    const pilihanManual = { majelis: "32-26-31", ppp: 21, pjs: 28, phs: "2026-11-05", ruangan: 2, jam: "13:00" };
    const pejabat = { ppp: "plh-panitera" };
    const panel = ["pmh", "ppp", "pjs", "phs"].map((j) => kirimanPanel(j, pilihanManual, pejabat, BAWAAN));
    const s = siapServer();
    await kerjakanPenetapan(s.dep, { ...dasar, mode: "manual", pilihan: { ...pilihanManual, pejabat } });
    expect(s.rantai[0].map(rata)).toEqual(panel);
    expect(s.rantai[0][0].hakimId).toEqual([32, 26, 31]);
  });

  it("'Ubah majelis' di mode otomatis: usulan server dihitung ulang untuk majelis itu (sama dengan muatUlangUsulan papan)", async () => {
    const s = siapServer();
    await kerjakanPenetapan(s.dep, { ...dasar, pilihan: { majelisDipilih: [32, 26, 31] } });
    expect(s.usulanDiminta).toEqual([[32, 26, 31]]);
    const t = siapServer();
    await kerjakanPenetapan(t.dep, dasar);
    expect(t.usulanDiminta).toEqual([[]]);
  });

  it("panel halaman SIPP mengirim pilihan di KEDUA mode (tidak lagi {} di mode otomatis), termasuk sidkel/majelisDipilih/timpa/sita", () => {
    const fungsi = SIPP.slice(SIPP.indexOf("function pilihanUntukKerja()"), SIPP.indexOf("function kodeDariLaporan"));
    expect(fungsi).not.toMatch(/caraSekarang\(\) !== "manual"\) return \{\}/);
    // Dijalankan sungguhan atas data papan mode otomatis.
    const konteks: Record<string, unknown> = {
      ctx: { data: { caraPapan: "otomatis", pilihanManual: { sidkel: true, phs: "2026-11-06", ruangan: 7 }, majelisDipilih: [32, 26, 31], pejabatDipilih: { pmh: "wakil" } } },
    };
    vm.createContext(konteks);
    vm.runInContext(`${fungsi}\nglobalThis.__h = pilihanUntukKerja();`, konteks);
    expect(konteks.__h).toEqual({ phs: "2026-11-06", ruangan: 7, sidkel: true, majelisDipilih: [32, 26, 31], pejabat: { pmh: "wakil" } });
    expect(SIPP).toMatch(/timpaEdoc: Boolean\(ctx\.timpaEdoc\)/);
    expect(SIPP).toMatch(/sita: ctx\.bersita === true \? ctx\.sita \|\| "" : ""/);
  });
});

// ---------------------------------------------------------------------------
// B. e-Doc dari satu pintu (penetapan-kerja.js) - dijalankan di vm
// ---------------------------------------------------------------------------

function muatKerja(opsi: { sudah?: string[] } = {}) {
  const edocDiminta: Array<Record<string, unknown>> = [];
  const balas = (isi: unknown) => ({ status: 200, ok: true, json: async () => isi });
  const konteks: Record<string, unknown> = {
    console,
    alatAmbil: async (url: string, init: { body?: string }) => {
      const badan = init && init.body ? JSON.parse(init.body) : {};
      if (url.endsWith("/penunjukan/kunci")) return balas(badan.aksi === "lepas" ? { ok: true, data: { ok: true } } : { ok: true, data: { ok: true, token: "T1" } });
      if (url.endsWith("/penunjukan/kerjakan")) {
        return balas({ ok: true, kunci: { diambil: true }, pesan: "", laporan: ["pmh", "ppp", "pjs", "phs"].map((j) => ({ jenis: j, status: "tercatat", sebab: "", bunyi: "" })) });
      }
      return balas({});
    },
    namaPenggunaSipp: () => "admin",
    kalimatAlasan: (k: string) => k,
    b7BacaSudahTerunggah: async (_n: string, jenis: string[]) => (opsi.sudah || []).filter((j) => jenis.includes(j)).map((j) => ({ jenis: j, sudah: true })),
    e6UnggahEdocPenetapan: async (p: Record<string, unknown>) => {
      edocDiminta.push(p);
      return { ok: true, hasil: { d: { berkas: (p.jenis as string[]).map((j) => ({ jenis: j, ok: true })) } } };
    },
  };
  konteks.globalThis = konteks;
  vm.createContext(konteks);
  vm.runInContext(KERJA, konteks);
  return { api: konteks.aletaPenetapanKerja as { kerjakan: (p: Record<string, unknown>) => Promise<any> }, edocDiminta };
}

const semua = { pmh: true, ppp: true, pjs: true, phs: true };

describe("B. e-Doc: aturan timpa dan muat ulang sama dengan tombol e-Doc kartu Penetapan", () => {
  it("e-Doc yang sudah ada DILEWATI tanpa window.confirm (sudah_terunggah), sisanya diunggah sekali, tanpa muat ulang ganda", async () => {
    const { api, edocDiminta } = muatKerja({ sudah: ["PMH"] });
    const h = await api.kerjakan({ nomorPerkara: "694/Pdt.G/2026/PA.Dgl", perkaraId: 10300, mode: "otomatis", unggahEdoc: semua, sita: "ditolak" });
    expect(edocDiminta).toHaveLength(1);
    expect(edocDiminta[0]).toMatchObject({ jenis: ["ppp", "pjs", "phs"], otomatis: false, timpaDisetujui: true, tanpaMuatUlang: true, sita: "ditolak" });
    const e = Object.fromEntries(h.laporan.map((x: any) => [x.jenis, `${x.edoc.status}/${x.edoc.sebab}`]));
    expect(e).toEqual({ pmh: "dilewati/sudah_terunggah", ppp: "terunggah/", pjs: "terunggah/", phs: "terunggah/" });
  });

  it("disetujui ditimpa di konfirmasi halaman (timpaEdoc): semuanya dikirim, tidak ditanya dua kali", async () => {
    const { api, edocDiminta } = muatKerja({ sudah: ["PMH", "PHS"] });
    await api.kerjakan({ nomorPerkara: "694/Pdt.G/2026/PA.Dgl", perkaraId: 10300, mode: "otomatis", unggahEdoc: semua, timpaEdoc: true });
    expect(edocDiminta).toHaveLength(1);
    expect(edocDiminta[0]).toMatchObject({ jenis: ["pmh", "ppp", "pjs", "phs"], timpaDisetujui: true });
  });

  it("semuanya sudah ada dan tidak disetujui ditimpa: tidak ada kiriman e-Doc sama sekali", async () => {
    const { api, edocDiminta } = muatKerja({ sudah: ["PMH", "PPP", "PJS", "PHS"] });
    const h = await api.kerjakan({ nomorPerkara: "694/Pdt.G/2026/PA.Dgl", perkaraId: 10300, mode: "otomatis", unggahEdoc: semua });
    expect(edocDiminta).toHaveLength(0);
    expect(h.laporan.every((x: any) => x.edoc.sebab === "sudah_terunggah")).toBe(true);
  });

  it("panel halaman SIPP tidak lagi menghitung e-Doc yang dilewati sebagai terunggah", () => {
    const bagian = SIPP.slice(SIPP.indexOf("async function kerjakanLewatSatuPintu"), SIPP.indexOf("async function jalankan()"));
    const dilewati = bagian.slice(bagian.indexOf('e.status === "dilewati"'));
    expect(dilewati.slice(0, dilewati.indexOf("} else {\n        if (ctx.edoc[j]"))).not.toContain("edocSukses.push");
    expect(bagian).toContain('"edoc-ada"');
  });
});

// ---------------------------------------------------------------------------
// C. Cap hanya PMH (portal dan bot satu aturan)
// ---------------------------------------------------------------------------

const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
type Modul = { filename: string; loaded: boolean; exports: unknown };
const ModulKelas = require_("module") as unknown as new (id: string) => Modul;
const dipasang: string[] = [];
function pasang(relatif: string, isi: unknown) {
  const jalur = require_.resolve(path.join(akarBot, relatif));
  const m = new ModulKelas(jalur);
  m.filename = jalur;
  m.loaded = true;
  m.exports = isi;
  (require_.cache as Record<string, unknown>)[jalur] = m;
  dipasang.push(jalur);
}
afterEach(() => {
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
});

describe("C. cap hanya untuk PMH - bawaan portal dan bot sama", () => {
  it("BAWAAN_PETA_PENETAPAN: PMH bercap (Ketua), PPP/PJS/PHS tanpa cap", () => {
    expect(BAWAAN_PETA_PENETAPAN.pmh).toMatchObject({ pakaiCap: true, penandatangan: "ketua" });
    for (const j of ["ppp", "pjs", "phs"] as const) expect(BAWAAN_PETA_PENETAPAN[j].pakaiCap).toBe(false);
  });

  it("bot aturBerlaku tanpa kiriman portal: hanya PMH bercap", () => {
    pasang("db_config.js", { query: () => undefined });
    pasang("bot_db_config.js", { query: () => undefined });
    const jalur = require_.resolve(path.join(akarBot, "services/penetapanEdocService.js"));
    delete (require_.cache as Record<string, unknown>)[jalur];
    const m = require_(jalur) as { aturBerlaku: (j: string, k?: unknown) => Record<string, unknown> };
    delete (require_.cache as Record<string, unknown>)[jalur];
    expect(Object.fromEntries(["pmh", "ppp", "pjs", "phs"].map((j) => [j, m.aturBerlaku(j).pakaiCap]))).toEqual({ pmh: true, ppp: false, pjs: false, phs: false });
    // Kiriman portal (Peta penetapan yang disimpan admin) tetap menang.
    expect(m.aturBerlaku("ppp", { pakaiCap: true }).pakaiCap).toBe(true);
  });
});
