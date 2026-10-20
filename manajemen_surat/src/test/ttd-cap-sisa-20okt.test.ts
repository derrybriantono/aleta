// @vitest-environment node

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BAWAAN_PETA_PENETAPAN } from "@/lib/peta-penetapan";
import {
  UKURAN_TTD_CAP_BAWAAN,
  bersihkanUkuranTtdCap,
  geometriPratinjau,
  tinggiTtdMaksMm,
  ukuranUntukBot,
  type UkuranTtdCap,
} from "@/lib/ukuran-ttd-cap";
import { PratinjauUkuranTtdCap } from "@/components/portal/aleta-ecourt-ukuran-ttd-cap";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";

/**
 * 20 OKT 2026 - SISA TTD + CAP: ekstensi ("Tambah tanda tangan ke PDF"), salinan putusan, dan kartu
 * "Ukuran tanda tangan & cap". Yang dijaga:
 *   A. SATU set ukuran bawaan di portal, bot (UKURAN_TTD_CAP) dan ekstensi.
 *   B. Ekstensi: TTD mengambang menimpa nama; cap 36 mm HANYA bila berhak; tanpa cap bila tidak.
 *   C. Salinan putusan: TTD Panitera mengambang + cap Panitera (36 mm) di sisi kiri.
 *   D. Pengaturan ukuran (kartu): simpan, kembalikan bawaan, pemberitahuan ukuran lama; dipakai ketiga jalur.
 *   E. Pratinjau kartu sama dengan geometri bot.
 */
const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");
const jalurBot = (r: string) => require_.resolve(path.join(akarBot, r));
type Modul = { filename: string; loaded: boolean; exports: unknown };
const ModulKelas = require_("module") as unknown as new (id: string) => Modul;
const dipasang: string[] = [];
function pasang(relatif: string, isi: unknown) {
  const jalur = jalurBot(relatif);
  const m = new ModulKelas(jalur);
  m.filename = jalur;
  m.loaded = true;
  m.exports = isi;
  (require_.cache as Record<string, unknown>)[jalur] = m;
  dipasang.push(jalur);
}
function lepasSemua() {
  for (const j of dipasang.splice(0)) delete (require_.cache as Record<string, unknown>)[j];
  for (const r of ["services/penetapanEdocService.js", "services/salinanPutusanService.js"]) delete (require_.cache as Record<string, unknown>)[jalurBot(r)];
}
type Edoc = {
  UKURAN_TTD_CAP: Record<string, number>;
  ATUR_BAWAAN: Record<string, number>;
  bubuhkanTtdCap: (rtf: string, p: Record<string, unknown>) => { ok: boolean; rtf: string; geometri: { ttd: Record<string, number> | null; cap: Record<string, number> | null } };
};
type Salinan = {
  susunSalinan: (r: string, o: { ttd: { jenis: string; isi: Buffer } | null; cap?: { jenis: string; isi: Buffer } | null; atur?: Record<string, number> | null }) => { rtf: string; laporan: Record<string, any> };
  barisKosongTambahan: (tinggi: number, turun: number, ada: number) => number;
};
function muatBot() {
  lepasSemua();
  pasang("db_config.js", { query: () => undefined });
  pasang("bot_db_config.js", { query: () => undefined });
  const edoc = require_(jalurBot("services/penetapanEdocService.js")) as Edoc;
  const salinan = require_(jalurBot("services/salinanPutusanService.js")) as Salinan;
  return { edoc, salinan };
}

const TWIP_MM = 1440 / 25.4;
let TTD: Buffer; // 400x200 -> 64 x 32 mm
let CAP_TEGAK: Buffer; // 500x600
beforeAll(async () => {
  const png = (w: number, h: number, a: number) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 110, g: 60, b: 180, alpha: a } } }).png().toBuffer();
  TTD = await png(400, 200, 0.9);
  CAP_TEGAK = await png(500, 600, 0.5);
});
afterEach(() => lepasSemua());
afterAll(() => lepasSemua());

type Bentuk = { nama: string; z: number; kiri: number; atas: number; lebar: number; tinggi: number; di: number };
function bentukDi(rtf: string): Bentuk[] {
  const hasil: Bentuk[] = [];
  const re = /\{\\shp\{\\\*\\shpinst\\shpleft(-?\d+)\\shptop(-?\d+)\\shpright(-?\d+)\\shpbottom(-?\d+)[^{]*?\\shpz(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rtf))) {
    const nama = (/\{\\sn wzName\}\{\\sv ([^}]*)\}/.exec(rtf.slice(m.index, m.index + 1200)) || [])[1] || "";
    hasil.push({ nama, kiri: Number(m[1]), atas: Number(m[2]), lebar: Number(m[3]) - Number(m[1]), tinggi: Number(m[4]) - Number(m[2]), z: Number(m[5]), di: m.index });
  }
  return hasil;
}
const dekat = (a: number, b: number, d = 3) => Math.abs(a - b) <= d;

// ===========================================================================
// A. SATU SET UKURAN
// ===========================================================================
const EKSTENSI = path.resolve(process.cwd(), "../ekstensi-sipp");
const bacaEks = (berkas: string) => readFileSync(path.join(EKSTENSI, berkas), "utf8").replace(/\r\n/g, "\n");
const SUMBER = ["panel-alat.js", "abt-klien.js", "blangko-derry.js", "blangko-derry-saksi.js", "blangko-derry-isian.js"].map(bacaEks).join("\n;\n");
const BERANDA = "http://192.168.10.10/aps_badilag/index.php/abt/main/beranda";
type Murni = {
  sisipkanTtdRtf: (rtf: string, daftar: Array<Record<string, unknown>>, ukuran?: Record<string, number> | null) => { rtf: string; dipasang: string[]; tidakDitemukan: string[]; geometri: Array<Record<string, any>> };
  ukuranTtdBerlaku: (m: unknown) => Record<string, number>;
  berhakCap: (t: unknown) => boolean;
  UKURAN_TTD_CAP_BAWAAN: Record<string, number>;
};
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await new Promise((r) => setTimeout(r, 20)); // skrip ekstensi punya kerja tak serempak yang harus selesai sebelum jendela ditutup
  while (terbuka.length) terbuka.pop()!.window.close();
});
function murni(): Murni {
  const dom = new JSDOM(`<!doctype html><html><head><title>ABT</title></head><body><div id="header"></div><div id="wrapper"><div id="navbar"></div><div id="content"></div></div></body></html>`, {
    url: BERANDA,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = {};
  w.chrome = {
    runtime: { id: "aleta-uji", getManifest: () => ({ version: "1.205.15" }), getURL: (x: string) => `chrome-extension://aleta-uji/${x}`, sendMessage: (_p: unknown, cb?: (h: unknown) => void) => cb?.({ ok: true }), lastError: undefined },
    storage: {
      local: { get: async () => simpanan, set: async () => undefined, remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  w.fetch = async () => new Response("{}", { status: 404 });
  w.Response = Response;
  w.TextDecoder = TextDecoder;
  w.TextEncoder = TextEncoder;
  w.console.warn = () => {};
  w.Element.prototype.scrollIntoView = function () {};
  w.HTMLElement.prototype.focus = function () {};
  w.eval(SUMBER);
  return w.aletaBlangkoDerryIsian.murni as Murni;
}

describe("A. satu set ukuran bawaan", () => {
  it("portal = bot (UKURAN_TTD_CAP) = ekstensi = bawaan Peta penetapan", () => {
    const { edoc } = muatBot();
    const eks = murni().UKURAN_TTD_CAP_BAWAAN;
    const bot = edoc.UKURAN_TTD_CAP;
    expect(bot).toMatchObject({ lebarTtdMm: 64, tinggiTtdMaksMm: 35, ttdTurunMm: 3, diameterCapMm: 36, capGeserKiriMm: 13, capGeserAtasMm: 4, opasitasCap: 0.88 });
    expect(UKURAN_TTD_CAP_BAWAAN).toMatchObject({ lebarTtdMm: bot.lebarTtdMm, ttdTurunMm: bot.ttdTurunMm, diameterCapMm: bot.diameterCapMm, capGeserKiriMm: bot.capGeserKiriMm, capGeserAtasMm: bot.capGeserAtasMm, opasitasCap: bot.opasitasCap });
    expect(tinggiTtdMaksMm(UKURAN_TTD_CAP_BAWAAN.lebarTtdMm)).toBe(bot.tinggiTtdMaksMm);
    expect(eks).toMatchObject({ lebarTtdMm: bot.lebarTtdMm, tinggiTtdMaksMm: bot.tinggiTtdMaksMm, ttdTurunMm: bot.ttdTurunMm, lebarCapMm: bot.diameterCapMm, capGeserKiriMm: bot.capGeserKiriMm, capGeserAtasMm: bot.capGeserAtasMm, opasitasCap: bot.opasitasCap });
    expect(BAWAAN_PETA_PENETAPAN.pmh).toMatchObject({ lebarTtdMm: bot.lebarTtdMm, tinggiTtdMaksMm: bot.tinggiTtdMaksMm, ttdTurunMm: bot.ttdTurunMm, lebarCapMm: bot.diameterCapMm, capGeserKiriMm: bot.capGeserKiriMm, capGeserAtasMm: bot.capGeserAtasMm });
    // bentuk yang dikirim ke bot memuat opasitas dan tinggi turunan
    expect(ukuranUntukBot(UKURAN_TTD_CAP_BAWAAN)).toMatchObject({ lebarTtdMm: 64, tinggiTtdMaksMm: 35, lebarCapMm: 36, opasitasCap: 0.88 });
    expect(edoc.ATUR_BAWAAN.opasitasCap).toBe(0.88);
  });
});

// ===========================================================================
// B. EKSTENSI
// ===========================================================================
const RTF_PUTUSAN_2KOSONG = String.raw`{\rtf1\ansi\paperw11907\margl1700\margr1200 \pard\qj Demikian diputuskan oleh Hakim Satu, S.H. sebagai Ketua Majelis\par \pard\qc Ketua Majelis,\par \par \par \b Hakim Satu, S.H.\b0\par \pard\qj Untuk Salinan\par }`;
const RTF_PUTUSAN_BANYAK = String.raw`{\rtf1\ansi\paperw11907\margl1700\margr1200 \pard\qc Ketua Majelis,\par \par \par \par \par \par \par \par \par \par \b Hakim Satu, S.H.\b0\par }`;

describe("B. ekstensi: Tambah tanda tangan ke PDF", () => {
  it("TTD berupa bentuk MENGAMBANG 64 mm yang bawahnya 1,5-5 mm di bawah puncak paragraf nama (menimpa nama); gambar sebaris lama tidak dipakai", () => {
    const x = murni();
    const h = x.sisipkanTtdRtf(RTF_PUTUSAN_BANYAK, [{ nama: "Hakim Satu, S.H.", png: TTD }]);
    expect(h.dipasang).toEqual(["Hakim Satu, S.H."]);
    const b = bentukDi(h.rtf);
    expect(b).toHaveLength(1);
    expect(b[0].nama).toBe("Tanda tangan");
    expect(dekat(b[0].lebar, 64 * TWIP_MM)).toBe(true);
    expect(dekat(b[0].tinggi, 32 * TWIP_MM)).toBe(true); // 400x200 -> 2:1, di bawah batas 35 mm
    const bawah = b[0].atas + b[0].tinggi;
    expect(bawah).toBeGreaterThan(1.5 * TWIP_MM);
    expect(bawah).toBeLessThan(5 * TWIP_MM);
    // tanpa gambar sebaris di depan nama, dan nama tetap sesudah bentuk
    expect(h.rtf).not.toMatch(/\}\\par Hakim Satu, S\.H\.\\b0/);
    expect(h.rtf.indexOf("Hakim Satu, S.H.\\b0")).toBeGreaterThan(b[0].di);
    // rata tengah (\qc): bentuk dipusatkan di bidang tulis
    const bidang = 11907 - 1700 - 1200;
    expect(dekat(b[0].kiri + b[0].lebar / 2, bidang / 2, 4)).toBe(true);
    // satu baris tidak ditambah: ruang kosong blangko sudah cukup
    expect(h.geometri[0].barisTambah).toBe(0);
  });

  it("cap 36 mm HANYA bila diberikan (penanda tangan berhak): menindih sisi kiri TTD, z di atas TTD; diameter tetap untuk gambar tegak", () => {
    const x = murni();
    const dengan = x.sisipkanTtdRtf(RTF_PUTUSAN_BANYAK, [{ nama: "Hakim Satu, S.H.", png: TTD, cap: { png: CAP_TEGAK } }]);
    const b = bentukDi(dengan.rtf);
    expect(b.map((s) => s.nama)).toEqual(["Tanda tangan", "Cap"]);
    const [ttd, cap] = b;
    expect(cap.z).toBeGreaterThan(ttd.z);
    expect(dekat(Math.max(cap.lebar, cap.tinggi), 36 * TWIP_MM)).toBe(true);
    expect(cap.kiri).toBeLessThan(ttd.kiri + ttd.lebar / 3); // sisi kiri TTD
    expect(cap.kiri + cap.lebar).toBeGreaterThan(ttd.kiri);
    expect(cap.atas + cap.tinggi).toBeLessThan(ttd.atas + ttd.tinggi + 5 * TWIP_MM); // bawah cap tidak jauh melewati bawah TTD
    // tanpa cap di kiriman: satu bentuk saja
    const tanpa = x.sisipkanTtdRtf(RTF_PUTUSAN_BANYAK, [{ nama: "Hakim Satu, S.H.", png: TTD }]);
    expect(bentukDi(tanpa.rtf).map((s) => s.nama)).toEqual(["Tanda tangan"]);
  });

  it("hak cap: hanya Panitera dan Ketua; hakim, PP, juru sita TIDAK (tidak ada hak baru)", () => {
    const x = murni();
    expect(["panitera", "ketua_pa"].map((peran) => x.berhakCap({ peran }))).toEqual([true, true]);
    expect(["hakim", "pp", "js", "", undefined].map((peran) => x.berhakCap({ peran }))).toEqual([false, false, false, false, false]);
    expect(x.berhakCap(null)).toBe(false);
  });

  it("ruang di atas nama ditambah (paragraf kosong) bila baris kosong blangko kurang, supaya label jabatan tidak tertutup", () => {
    const x = murni();
    const h = x.sisipkanTtdRtf(RTF_PUTUSAN_2KOSONG, [{ nama: "Hakim Satu, S.H.", png: TTD }]);
    expect(h.geometri[0].barisTambah).toBeGreaterThan(0);
    const sebelum = h.rtf.slice(h.rtf.indexOf("Ketua Majelis,\\par"), bentukDi(h.rtf)[0].di);
    expect((sebelum.match(/\\par /g) || []).length).toBe(3 + h.geometri[0].barisTambah);
  });

  it("ukuran mengikuti pengaturan portal (kartu): lebar 50 mm; di luar batas dijepit; tanpa kiriman = bawaan", () => {
    const x = murni();
    const h = x.sisipkanTtdRtf(RTF_PUTUSAN_BANYAK, [{ nama: "Hakim Satu, S.H.", png: TTD }], { lebarTtdMm: 50, tinggiTtdMaksMm: 27.3 });
    expect(dekat(bentukDi(h.rtf)[0].lebar, 50 * TWIP_MM)).toBe(true);
    expect(x.ukuranTtdBerlaku({ lebarTtdMm: 5000, opasitasCap: -1 })).toMatchObject({ lebarTtdMm: 90, opasitasCap: 0.3 });
    expect(x.ukuranTtdBerlaku(null)).toEqual(x.UKURAN_TTD_CAP_BAWAAN);
  });

  it("nama tidak ditemukan atau gambar bukan PNG dilaporkan, tidak ditebak", () => {
    const x = murni();
    const h = x.sisipkanTtdRtf(RTF_PUTUSAN_BANYAK, [{ nama: "Orang Lain", png: TTD }, { nama: "Hakim Satu, S.H.", png: new Uint8Array([1, 2, 3]) }]);
    expect(h.dipasang).toEqual([]);
    expect(h.tidakDitemukan).toEqual(["Orang Lain", "Hakim Satu, S.H."]);
    expect(h.rtf).toBe(RTF_PUTUSAN_BANYAK);
  });
});

// ===========================================================================
// C. SALINAN PUTUSAN
// ===========================================================================
const P = "\\pard \\plain \\qj \\sl360 \\slmult1 \\tqc \\tx1400 \\tqc \\tx4200 \\tqc \\tx7000 \\itap0 \\fs20 ";
const par = (isi: string) => `${P}{\\fs24 \\f4 ${isi}}{\\fs24 \\f4 \\par }`;
const kosongPar = `${P}{\\fs24 \\f4 \\par }`;
const FB = "\\pard \\plain \\qc \\sa80 \\phpg \\pvpara \\posx7899 \\posy35 \\intbl \\itap1 \\fs20 ";
const BINGKAI_UNTUK =
  "\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 " +
  `${FB}{\\fs24 \\f4 \\cf16 Untuk Salinan}{\\fs24 \\f4 \\cf16 \\par }` +
  `${FB}{\\fs24 \\f4 \\cf16 Pengadilan Agama Donggala }{\\fs24 \\f4 \\cf16 \\par }` +
  `${FB}{\\fs24 \\f4 \\cf16 Panitera,}{\\fs28 \\f5 \\cf16 \\par }` +
  `${FB}{\\fs32 \\f5 \\cf16 \\par }` +
  `${FB}{\\b1 \\fs24 \\f4 \\cf16 Nama Panitera Tiruan, S.H.}{\\b1 \\fs24 \\f5 \\cf16 \\cell }` +
  "\\pard \\plain \\qr \\intbl \\itap1 \\fs20 {\\trowd \\trql \\trgaph0 \\trrh2037 \\trleft-108 \\tpvpara \\tphpg \\tposx7899 \\tposy35 \\cellx3472 \\row }";
function rtfSalinan(): string {
  const badan = [par("PUTUSAN"), par("Menimbang bahwa perkara ini."), par("\\tab  \\tab Ketua Majelis,"), kosongPar, kosongPar, par("\\tab  \\tab {\\b1 Ketua Tiruan, S.H.I.}"), par("1. PNBP :"), BINGKAI_UNTUK, par("J u m l a h : Rp 199.000,00")].join("");
  return `{\\rtf1\\ansi{\\colortbl;\\red0\\green0\\blue0;${"\\red0\\green0\\blue255;".repeat(14)}\\red255\\green255\\blue255;}\\paperw12240\\margl2268\\margr1239\\pgwsxn11907\\margrsxn1239 ${badan}}`;
}

describe("C. salinan putusan: TTD Panitera mengambang + cap Panitera", () => {
  it("TTD mengambang menimpa nama Panitera + cap 36 mm di sisi kiri TTD (z di atas); nama tetap terbaca di akhir naskah", () => {
    const { salinan } = muatBot();
    const h = salinan.susunSalinan(rtfSalinan(), { ttd: { jenis: "png", isi: TTD }, cap: { jenis: "png", isi: CAP_TEGAK } });
    expect(h.laporan).toMatchObject({ namaPanitera: "Nama Panitera Tiruan, S.H.", gambarTtdPanitera: true, ttdMengambang: true, capPanitera: true });
    const b = bentukDi(h.rtf);
    expect(b.map((s) => s.nama)).toEqual(["Tanda tangan", "Cap"]);
    expect(dekat(b[0].lebar, 64 * TWIP_MM)).toBe(true);
    expect(dekat(Math.max(b[1].lebar, b[1].tinggi), 36 * TWIP_MM)).toBe(true);
    expect(b[1].z).toBeGreaterThan(b[0].z);
    expect(b[1].kiri).toBeLessThan(b[0].kiri + b[0].lebar / 3);
    // bawah TTD menimpa bagian atas nama
    expect(b[0].atas + b[0].tinggi).toBeGreaterThan(1.5 * TWIP_MM);
    expect(b[0].atas + b[0].tinggi).toBeLessThan(5 * TWIP_MM);
    // bentuk tertambat di paragraf nama (tepat sebelum nama), bukan gambar sebaris di paragraf kosong
    const teks = h.rtf;
    expect(teks.indexOf("Nama Panitera Tiruan")).toBeGreaterThan(b[1].di);
    expect(teks.slice(teks.indexOf("Panitera,}", teks.indexOf("Untuk Salinan")))).not.toMatch(/\\picwgoal2880\\pichgoal1440/);
    // ruang di atas nama ditambah: TTD 32 mm > satu baris kosong blangko
    expect(salinan.barisKosongTambahan(32, 3, 1)).toBeGreaterThan(0);
    expect(salinan.barisKosongTambahan(32, 3, 8)).toBe(0);
    expect(h.rtf).toContain("\\par {\\shp");
  });

  it("tanpa cap di kiriman: hanya TTD; tanpa TTD: tidak ada bentuk dan tidak ada cap (cap tidak berdiri sendiri)", () => {
    const { salinan } = muatBot();
    const tanpaCap = salinan.susunSalinan(rtfSalinan(), { ttd: { jenis: "png", isi: TTD } });
    expect(bentukDi(tanpaCap.rtf).map((s) => s.nama)).toEqual(["Tanda tangan"]);
    expect(tanpaCap.laporan.capPanitera).toBe(false);
    const tanpaTtd = salinan.susunSalinan(rtfSalinan(), { ttd: null, cap: { jenis: "png", isi: CAP_TEGAK } });
    expect(bentukDi(tanpaTtd.rtf)).toHaveLength(0);
    expect(tanpaTtd.laporan).toMatchObject({ gambarTtdPanitera: false, capPanitera: false, alasanTanpaGambar: "ttd_tidak_ada" });
  });

  it("ukuran dari portal dipakai: lebar TTD 50 mm, diameter cap 30 mm, ; tanpa kiriman = bawaan 64/36", () => {
    const { salinan } = muatBot();
    const h = salinan.susunSalinan(rtfSalinan(), { ttd: { jenis: "png", isi: TTD }, cap: { jenis: "png", isi: CAP_TEGAK }, atur: { lebarTtdMm: 50, tinggiTtdMaksMm: 27.3, lebarCapMm: 30 } });
    const b = bentukDi(h.rtf);
    expect(dekat(b[0].lebar, 50 * TWIP_MM)).toBe(true);
    expect(dekat(Math.max(b[1].lebar, b[1].tinggi), 30 * TWIP_MM)).toBe(true);
    const bawaan = salinan.susunSalinan(rtfSalinan(), { ttd: { jenis: "png", isi: TTD }, cap: { jenis: "png", isi: CAP_TEGAK } });
    expect(dekat(bentukDi(bawaan.rtf)[0].lebar, 64 * TWIP_MM)).toBe(true);
  });

  it("e-Doc penetapan dan salinan memberi ukuran yang SAMA untuk masukan yang sama (satu mesin bubuhkanTtdCap)", () => {
    const { edoc, salinan } = muatBot();
    const s = salinan.susunSalinan(rtfSalinan(), { ttd: { jenis: "png", isi: TTD }, cap: { jenis: "png", isi: CAP_TEGAK } });
    const rtfPmh = String.raw`{\rtf1\ansi\paperw12240\margl2268\margr1239 \pard\plain\qj\li4535 Ketua,\par \par \par \b Ketua Contoh, S.H.\b0\par }`;
    const mulai = rtfPmh.indexOf("Ketua Contoh");
    const e = edoc.bubuhkanTtdCap(rtfPmh, { mulaiNama: mulai, ttd: { jenis: "png", isi: TTD }, cap: { jenis: "png", isi: CAP_TEGAK }, atur: {} });
    const b = bentukDi(s.rtf);
    expect(e.geometri.ttd!.lebar).toBe(b[0].lebar);
    expect(e.geometri.ttd!.tinggi).toBe(b[0].tinggi);
    expect(e.geometri.cap!.lebar).toBe(b[1].lebar);
    expect(e.geometri.cap!.tinggi).toBe(b[1].tinggi);
    expect(e.geometri.ttd!.atas + e.geometri.ttd!.tinggi).toBe(b[0].atas + b[0].tinggi);
  });
});

// ===========================================================================
// D. PENGATURAN UKURAN: rute, penyimpanan, tiga jalur
// ===========================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

type Kiriman = { url: string; badan: any };
let kiriman: Kiriman[] = [];
function tiruBot(jawab: (badan: any, url: string) => unknown) {
  kiriman = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const badan = init?.body ? JSON.parse(String(init.body)) : null;
    kiriman.push({ url: String(url), badan });
    return new Response(JSON.stringify(jawab(badan, String(url))), { status: 200, headers: { "content-type": "application/json" } });
  });
}
async function rute(modul: string, cara: "GET" | "POST" | "PUT", badan?: unknown, awal = "aleta-ecourt") {
  const r = (await import(`@/app/api/${awal}/${modul}/route`)) as Record<string, (q: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/x", {
    method: cara,
    headers: badan !== undefined ? { "content-type": "application/json", "x-forwarded-for": "10.0.0.9" } : { "x-forwarded-for": "10.0.0.9" },
    body: badan !== undefined ? JSON.stringify(badan) : undefined,
  });
  const j = await r[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}
const RTF_B64 = Buffer.from("{\\rtf1 x}").toString("base64");
async function unggahPmh() {
  tiruBot(() => ({ ok: true, hasil: [] }));
  await rute("penetapan-edoc/unggah", "POST", {
    nomorPerkara: "12/Pdt.G/2026/PA.Dgl",
    perkaraId: "901",
    abt: [{ jenis: "pmh", isiBase64: RTF_B64, berkas: "@ 1 - PMH.rtf" }],
    otomatis: true,
    konfirmasi: true,
    kering: false,
    olehUsername: "ptsp1",
  });
  return kiriman[0].badan.atur.pmh as Record<string, number>;
}

describe("D. kartu ukuran: simpan, kembalikan bawaan, pemberitahuan ukuran lama, dipakai ketiga jalur", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-super";
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  it("GET semua pegawai (ukuran berlaku = bawaan); mengubah hanya Admin/Super Admin; di luar batas ditolak; tercatat di audit", async () => {
    aktor = "usr-hakim";
    const baca = await rute("ukuran-ttd-cap", "GET");
    expect(baca.status).toBe(200);
    expect(baca.isi.data).toMatchObject({ bolehMengubah: false, tersimpan: false, lama: [], pemberitahuanLama: "" });
    expect(baca.isi.data.ukuran).toEqual({ ...UKURAN_TTD_CAP_BAWAAN });
    expect(baca.isi.data.ukuranBot).toMatchObject({ lebarTtdMm: 64, tinggiTtdMaksMm: 35, lebarCapMm: 36, opasitasCap: 0.88 });
    expect((await rute("ukuran-ttd-cap", "PUT", { lebarTtdMm: 70 })).status).toBe(403);

    aktor = "usr-admin";
    expect((await rute("ukuran-ttd-cap", "PUT", { lebarTtdMm: 500 })).status).toBe(400);
    expect((await rute("ukuran-ttd-cap", "PUT", { opasitasCap: 0.1 })).status).toBe(400);
    const ubah = await rute("ukuran-ttd-cap", "PUT", { lebarTtdMm: 70, diameterCapMm: 30, ttdTurunMm: 4, capGeserKiriMm: 10, capGeserAtasMm: 2, opasitasCap: 0.7 });
    expect(ubah.status).toBe(200);
    expect(ubah.isi.data).toMatchObject({ bolehMengubah: true, tersimpan: true });
    expect(ubah.isi.data.ukuran).toEqual({ lebarTtdMm: 70, ttdTurunMm: 4, diameterCapMm: 30, capGeserKiriMm: 10, capGeserAtasMm: 2, opasitasCap: 0.7 });
    expect(ubah.isi.data.ukuranBot).toMatchObject({ lebarTtdMm: 70, tinggiTtdMaksMm: 38.3, lebarCapMm: 30, opasitasCap: 0.7 });
    const audit = await db!.prepare("SELECT action FROM audit_logs WHERE action = 'UPDATE_UKURAN_TTD_CAP'").all<{ action: string }>();
    expect(audit.length).toBe(1);
    // pegawai lain membaca nilai yang sama
    aktor = "usr-hakim";
    expect((await rute("ukuran-ttd-cap", "GET")).isi.data.ukuranBot.lebarTtdMm).toBe(70);
  });

  it("ketiga jalur memakai satu pengaturan: e-Doc penetapan (atur ke bot), salinan putusan (atur + cap Panitera ke bot), ekstensi (GET ukuranBot)", async () => {
    aktor = "usr-super";
    await rute("penetapan-edoc/cap", "POST", { tindakan: "tambah", nama: "Cap Panitera", peruntukan: "panitera", isiBase64: CAP_TEGAK.toString("base64") });
    await rute("penetapan-edoc/cap", "POST", { tindakan: "tambah", nama: "Cap Ketua", peruntukan: "ketua", isiBase64: CAP_TEGAK.toString("base64") });
    aktor = "usr-admin";
    await rute("ukuran-ttd-cap", "PUT", { lebarTtdMm: 70, diameterCapMm: 30, opasitasCap: 0.7 });

    // 1. e-Doc penetapan
    const atur = await unggahPmh();
    expect(atur).toMatchObject({ lebarTtdMm: 70, tinggiTtdMaksMm: 38.3, lebarCapMm: 30, opasitasCap: 0.7, pakaiCap: true });

    // 2. salinan putusan lewat portal -> bot
    tiruBot(() => ({ ok: true, pdfBase64: "JVBERg==", byte: 4, versiMesin: "uji", salinan: {} }));
    const pdf = await rute("abt/pdf", "POST", { rtfBase64: RTF_B64, salinan: true }, "aleta-bot");
    expect(pdf.status).toBe(200);
    const kirim = kiriman.find((k) => k.url.includes("/abt/pdf"))!.badan;
    expect(kirim.salinan).toBe(true);
    expect(kirim.atur).toMatchObject({ lebarTtdMm: 70, lebarCapMm: 30, opasitasCap: 0.7 });
    expect(kirim.cap).toMatchObject({ jenis: "png" });
    expect(Buffer.from(kirim.cap.isiBase64, "base64").equals(CAP_TEGAK)).toBe(true);

    // 3. ekstensi: ukuranBot dari GET dipakai sisipkanTtdRtf
    aktor = "usr-hakim";
    const baca = await rute("ukuran-ttd-cap", "GET");
    const h = murni().sisipkanTtdRtf(RTF_PUTUSAN_BANYAK, [{ nama: "Hakim Satu, S.H.", png: TTD }], baca.isi.data.ukuranBot);
    expect(dekat(bentukDi(h.rtf)[0].lebar, 70 * TWIP_MM)).toBe(true);
  });

  it("salinan tanpa cap Panitera/Umum terunggah: tidak ada cap dikirim; tanpa tersimpan: ukuran bawaan; PUT kembali tidak menyentuh jalur tanpa cap", async () => {
    aktor = "usr-admin";
    tiruBot(() => ({ ok: true, pdfBase64: "JVBERg==", byte: 4, versiMesin: "uji" }));
    await rute("abt/pdf", "POST", { rtfBase64: RTF_B64, salinan: true }, "aleta-bot");
    const kirim = kiriman.find((k) => k.url.includes("/abt/pdf"))!.badan;
    expect(kirim.cap).toBeUndefined();
    expect(kirim.atur).toMatchObject({ lebarTtdMm: 64, tinggiTtdMaksMm: 35, lebarCapMm: 36, opasitasCap: 0.88 });
    // bukan salinan: tidak membawa ukuran maupun cap
    await rute("abt/pdf", "POST", { rtfBase64: RTF_B64 }, "aleta-bot");
    const biasa = kiriman.filter((k) => k.url.includes("/abt/pdf")).pop()!.badan;
    expect(biasa).toEqual({ rtfBase64: RTF_B64 });
  });

  it("ukuran lama di Peta penetapan (40/22) lebih kecil dari bawaan: pemberitahuan 'ukuran lama tersimpan - kembalikan bawaan?'; kembalikan bawaan membuangnya (pengaturan lain tetap)", async () => {
    aktor = "usr-admin";
    await rute("penetapan-edoc/peta-penetapan", "PUT", { butir: [{ jenis: "pmh", lebarTtdMm: 40, lebarCapMm: 22, tinggiTtdMaksMm: 22, otomatisUnggah: false }] });
    const baca = await rute("ukuran-ttd-cap", "GET");
    expect(baca.isi.data.tersimpan).toBe(false);
    expect(baca.isi.data.lama).toEqual([{ jenis: "pmh", sebutan: expect.any(String), lebarTtdMm: 40, lebarCapMm: 22 }]);
    expect(baca.isi.data.pemberitahuanLama).toMatch(/Ukuran lama tersimpan.*tanda tangan 40 mm, cap 22 mm.*bawaan baru.*64 mm.*36 mm.*Kembalikan bawaan\?/);

    // sebelum dikembalikan, e-Doc masih memakai nilai lama (tidak diam-diam diganti)
    aktor = "usr-super";
    expect((await unggahPmhOtomatisNyala()).lebarTtdMm).toBe(40);

    aktor = "usr-admin";
    const balik = await rute("ukuran-ttd-cap", "PUT", { kembalikanBawaan: true });
    expect(balik.status).toBe(200);
    expect(balik.isi.data).toMatchObject({ tersimpan: false, lama: [], pemberitahuanLama: "" });
    expect(balik.isi.data.ukuran).toEqual({ ...UKURAN_TTD_CAP_BAWAAN });
    const peta = await rute("penetapan-edoc/peta-penetapan", "GET");
    const pmh = peta.isi.data.butir.find((b: any) => b.jenis === "pmh");
    expect(pmh).toMatchObject({ lebarTtdMm: 64, tinggiTtdMaksMm: 35, lebarCapMm: 36, otomatisUnggah: true, aktif: true });
    aktor = "usr-super";
    expect((await unggahPmhOtomatisNyala()).lebarTtdMm).toBe(64);
  });

  it("kembalikan bawaan juga menghapus ukuran khusus yang disimpan kartu", async () => {
    aktor = "usr-admin";
    await rute("ukuran-ttd-cap", "PUT", { lebarTtdMm: 80 });
    expect((await rute("ukuran-ttd-cap", "GET")).isi.data.ukuran.lebarTtdMm).toBe(80);
    const balik = await rute("ukuran-ttd-cap", "PUT", { kembalikanBawaan: true });
    expect(balik.isi.data).toMatchObject({ tersimpan: false });
    expect(balik.isi.data.ukuran.lebarTtdMm).toBe(64);
    // ukuran yang sama dengan bawaan tidak ditandai "diubah dari bawaan"
    const sama = await rute("ukuran-ttd-cap", "PUT", { lebarTtdMm: 64 });
    expect(sama.isi.data.tersimpan).toBe(false);
  });
});

/** PMH otomatis diunggah hanya bila otomatisUnggah menyala; nyalakan lalu kirim. */
async function unggahPmhOtomatisNyala() {
  const aktorSemula = aktor;
  aktor = "usr-admin";
  await rute("penetapan-edoc/peta-penetapan", "PUT", { butir: [{ jenis: "pmh", otomatisUnggah: true }] });
  aktor = aktorSemula;
  return unggahPmh();
}

// ===========================================================================
// E. PRATINJAU dan PENEMPATAN KARTU
// ===========================================================================
describe("E. pratinjau kartu = geometri bot; kartu terpasang di halaman Tanda tangan pejabat", () => {
  it("geometri pratinjau (mm) sama dengan geometri bot (twip) untuk ukuran bawaan dan ukuran lain", () => {
    const { edoc } = muatBot();
    const rtf = String.raw`{\rtf1\ansi\paperw12240\margl2268\margr1239 \pard\plain\qj\li4535 Ketua,\par \par \par \b Ketua Contoh, S.H.\b0\par }`;
    const mulai = rtf.indexOf("Ketua Contoh");
    for (const u of [UKURAN_TTD_CAP_BAWAAN, bersihkanUkuranTtdCap({ lebarTtdMm: 50, diameterCapMm: 30, ttdTurunMm: 5, capGeserKiriMm: 8, capGeserAtasMm: -2 })] as UkuranTtdCap[]) {
      const bot = ukuranUntukBot(u);
      const e = edoc.bubuhkanTtdCap(rtf, { mulaiNama: mulai, ttd: { jenis: "png", isi: TTD }, cap: { jenis: "png", isi: CAP_TEGAK }, atur: bot });
      const g = geometriPratinjau(u, 2);
      expect(dekat(g.ttd.lebar * TWIP_MM, e.geometri.ttd!.lebar, 2)).toBe(true);
      expect(dekat(g.ttd.tinggi * TWIP_MM, e.geometri.ttd!.tinggi, 2)).toBe(true);
      expect(dekat(g.ttd.atas * TWIP_MM, e.geometri.ttd!.atas, 2)).toBe(true);
      // pusat cap relatif terhadap kiri TTD (tepi kiri kolom tidak menjepit pada nilai ini)
      const pusatXBot = e.geometri.cap!.kiri + e.geometri.cap!.lebar / 2 - e.geometri.ttd!.kiri;
      const pusatYBot = e.geometri.cap!.atas + e.geometri.cap!.tinggi / 2;
      expect(dekat(g.cap.pusatX * TWIP_MM, pusatXBot, 3)).toBe(true);
      expect(dekat(g.cap.pusatY * TWIP_MM, pusatYBot, 3)).toBe(true);
    }
  });

  it("pratinjau digambar: baris nama, kotak TTD, lingkaran cap berjari-jari setengah diameter; kartu ada di halaman dan hanya untuk admin", () => {
    const html = renderToStaticMarkup(createElement(PratinjauUkuranTtdCap, { ukuran: { ...UKURAN_TTD_CAP_BAWAAN } }));
    expect(html).toContain('data-pratinjau-ukuran-ttd-cap="1"');
    expect(html).toContain('r="18"');
    expect(html).toContain("Nama Penanda Tangan");
    const halaman = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-tanda-tangan.tsx"), "utf8");
    expect(halaman).toContain("<AletaEcourtUkuranTtdCap />");
    const kartu = readFileSync(path.resolve(process.cwd(), "src/components/portal/aleta-ecourt-ukuran-ttd-cap.tsx"), "utf8");
    expect(kartu).toContain("Kembalikan bawaan");
    expect(kartu).toContain("!data.bolehMengubah");
    expect(kartu).toContain("pemberitahuanLama");
  });
});
