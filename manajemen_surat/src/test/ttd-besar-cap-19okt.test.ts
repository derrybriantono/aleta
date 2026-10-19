// @vitest-environment node

import { createRequire } from "node:module";
import path from "node:path";

import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { BAWAAN_PETA_PENETAPAN } from "@/lib/peta-penetapan";

/**
 * 19 OKT 2026 - TANDA TANGAN BESAR + CAP DI ATASNYA (ukuran cap tetap).
 * Mesin: aleta_bot/services/penetapanEdocService.js (RTF -> PDF). Yang dijaga:
 * ttd ~1,6x dan bawahnya menimpa +-1/3 atas baris nama, cap di atas ttd dengan
 * diameter TETAP walau gambar sumber berbeda, cap semi-transparan, tanpa cap
 * bila jenisnya tidak berhak (PHS). Urutan lapis di PDF dijaga lewat urutan &
 * z-order bentuk di RTF (soffice tidak ada di mesin uji).
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
}
type BarisTtd = { id: number; namaPejabat: string };
type Edoc = {
  bubuhkanPenetapan: (p: Record<string, unknown>) => Promise<any>;
  redamkanAlfaPng: (b: Buffer, o: number) => Buffer;
  UKURAN_TTD_CAP: Record<string, number>;
};
function modulEdoc(): Edoc {
  pasang("db_config.js", { query: () => undefined });
  pasang("bot_db_config.js", { query: () => undefined });
  const jalur = jalurBot("services/penetapanEdocService.js");
  delete (require_.cache as Record<string, unknown>)[jalur];
  const m = require_(jalur) as Edoc;
  delete (require_.cache as Record<string, unknown>)[jalur];
  return m;
}
const bakuNama = (n: string) => String(n || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const TWIP_MM = 1440 / 25.4;
const BIDANG_KANAN = 12240 - 2268 - 1239;

let TTD_KETUA: Buffer;
let TTD_HAKIM: Buffer;
let CAP_TEGAK: Buffer; // 500x600 RGBA
let CAP_LEBAR: Buffer; // 1200x400 RGBA
beforeAll(async () => {
  const png = (w: number, h: number, a: number) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 110, g: 60, b: 180, alpha: a } } }).png().toBuffer();
  TTD_KETUA = await png(400, 200, 0.9);
  TTD_HAKIM = await png(240, 160, 0.7);
  CAP_TEGAK = await png(500, 600, 0.5);
  CAP_LEBAR = await png(1200, 400, 0.5);
});
afterEach(() => lepasSemua());
afterAll(() => lepasSemua());

function rtfPmh() {
  return (
    String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}\paperw12240\margl2268\margr1239` +
    "\n" +
    String.raw`\pard\plain\qc{\b PENETAPAN}\par` +
    "\n" +
    String.raw`\pard\plain\qj\li4535\ri0\sl360\slmult1 {\fs24 Ditetapkan di Donggala}{\fs24 \par }{\fs24 Pada tanggal 15 September 2026}{\fs24 \par }{\fs24 Ketua,\par \par \par \b Ketua Contoh, S.H.I., M.H.\b0 }{\fs24 \par }}`
  );
}
function rtfPhs() {
  return (
    String.raw`{\rtf1\ansi\deff0{\fonttbl{\f0 Times New Roman;}}\paperw12240\margl2268\margr1239` +
    String.raw`\pard\plain\qc{\b PENETAPAN}\par` +
    String.raw`\pard\plain\qj\fi-431\li4535 Ditetapkan di Donggala\par Pada tanggal 1 Oktober 2026\par Ketua Majelis,\par \par \par {\b Hakim Anggota Satu, S.H.}\par }`
  );
}

const DAFTAR: BarisTtd[] = [
  { id: 1, namaPejabat: "Ketua Contoh, S.H.I., M.H." },
  { id: 3, namaPejabat: "Hakim Anggota Satu, S.H." },
];
const GAMBAR: Record<number, () => Buffer> = { 1: () => TTD_KETUA, 3: () => TTD_HAKIM };

async function bubuh(rtf: string, jenis: string, cap: Buffer | null, atur: Record<string, unknown> = {}) {
  const m = modulEdoc();
  return m.bubuhkanPenetapan({
    rtf,
    jenis,
    atur,
    cap: cap ? { isi: cap, jenis: "png", id: "cap-1", nama: "Cap PA Donggala" } : null,
    daftarTtd: DAFTAR,
    ambilGambar: async (id: number) => ({ jenis: "png", isi: GAMBAR[id]() }),
    bakuNama,
  });
}

/** Bentuk-bentuk (\shp) di RTF: nama, z, kiri/atas/lebar/tinggi, depan/belakang. */
function bentukDi(rtf: string) {
  const hasil: Array<{ nama: string; z: number; kiri: number; atas: number; lebar: number; tinggi: number; depan: boolean; di: number }> = [];
  const re = /\{\\shp\{\\\*\\shpinst\\shpleft(-?\d+)\\shptop(-?\d+)\\shpright(-?\d+)\\shpbottom(-?\d+)[^{]*?\\shpfblwtxt(\d)\\shpz(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rtf))) {
    const nama = (/\{\\sn wzName\}\{\\sv ([^}]*)\}/.exec(rtf.slice(m.index, m.index + 1200)) || [])[1] || "";
    hasil.push({
      nama,
      kiri: Number(m[1]),
      atas: Number(m[2]),
      lebar: Number(m[3]) - Number(m[1]),
      tinggi: Number(m[4]) - Number(m[2]),
      depan: m[5] === "0",
      z: Number(m[6]),
      di: m.index,
    });
  }
  return hasil;
}

describe("19 Okt: tanda tangan besar menimpa sepertiga atas nama", () => {
  it("lebar 64 mm (~1,6x dari 40), tinggi <= 35 mm, bawahnya 1,5-4 mm di bawah puncak paragraf nama, di dalam kolom", async () => {
    const h = await bubuh(rtfPmh(), "pmh", CAP_TEGAK);
    expect(h.ok).toBe(true);
    const [ttd] = bentukDi(h.rtf);
    expect(ttd.nama).toBe("Tanda tangan");
    expect(Math.round(ttd.lebar / TWIP_MM)).toBe(64);
    expect(64 / 40).toBeCloseTo(1.6, 5);
    expect(ttd.tinggi / TWIP_MM).toBeLessThanOrEqual(35.01);
    expect(Math.abs(ttd.lebar / ttd.tinggi - 2)).toBeLessThan(0.02);
    const bawah = (ttd.atas + ttd.tinggi) / TWIP_MM;
    expect(bawah).toBeGreaterThan(1.5);
    expect(bawah).toBeLessThan(4);
    expect(ttd.kiri).toBe(4535);
    expect(ttd.kiri + ttd.lebar).toBeLessThanOrEqual(BIDANG_KANAN);
  });

  it("bawaan Peta penetapan portal sama dengan bawaan bot (satu set konstanta)", () => {
    const u = modulEdoc().UKURAN_TTD_CAP;
    expect(BAWAAN_PETA_PENETAPAN.pmh).toMatchObject({
      lebarTtdMm: u.lebarTtdMm,
      tinggiTtdMaksMm: u.tinggiTtdMaksMm,
      ttdTurunMm: u.ttdTurunMm,
      lebarCapMm: u.diameterCapMm,
      capGeserKiriMm: u.capGeserKiriMm,
      capGeserAtasMm: u.capGeserAtasMm,
    });
  });

  it("ttd yang terlalu ke kanan dijepit supaya ttd dan cap tidak melewati tepi kolom", async () => {
    const h = await bubuh(rtfPmh(), "pmh", CAP_TEGAK, { ttdGeserKananMm: 60 });
    const [ttd, cap] = bentukDi(h.rtf);
    expect(ttd.kiri + ttd.lebar).toBeLessThanOrEqual(BIDANG_KANAN);
    expect(cap.kiri + cap.lebar).toBeLessThanOrEqual(BIDANG_KANAN);
  });
});

describe("19 Okt: cap di atas tanda tangan, diameter tetap", () => {
  it("cap ditulis sesudah ttd dengan z lebih tinggi, menindih sisi kiri ttd, bawah cap tidak melewati bawah ttd", async () => {
    const h = await bubuh(rtfPmh(), "pmh", CAP_TEGAK);
    const [ttd, cap, ...lebih] = bentukDi(h.rtf);
    expect(lebih).toEqual([]);
    expect(cap.nama).toBe("Cap");
    expect(cap.di).toBeGreaterThan(ttd.di);
    expect(cap.z).toBeGreaterThan(ttd.z);
    expect(ttd.depan && cap.depan).toBe(true);
    const pusatCap = cap.kiri + cap.lebar / 2;
    expect(pusatCap).toBeLessThan(ttd.kiri + ttd.lebar / 2); // sisi kiri
    expect(cap.kiri).toBeGreaterThanOrEqual(ttd.kiri);
    expect(cap.atas + cap.tinggi).toBeLessThanOrEqual(ttd.atas + ttd.tinggi);
  });

  it("dua gambar sumber berbeda ukuran/rasio: sisi terpanjang cap SAMA 36 mm dan pusatnya sama", async () => {
    const a = bentukDi((await bubuh(rtfPmh(), "pmh", CAP_TEGAK)).rtf)[1];
    const b = bentukDi((await bubuh(rtfPmh(), "pmh", CAP_LEBAR)).rtf)[1];
    const sisi = (x: { lebar: number; tinggi: number }) => Math.max(x.lebar, x.tinggi);
    expect(Math.abs(sisi(a) - 36 * TWIP_MM)).toBeLessThanOrEqual(1);
    expect(sisi(a)).toBe(sisi(b));
    expect(a.tinggi).toBeGreaterThan(a.lebar);
    expect(Math.abs(a.lebar / a.tinggi - 500 / 600)).toBeLessThan(0.01);
    expect(Math.abs(b.lebar / b.tinggi - 3)).toBeLessThan(0.02);
    expect(Math.abs(a.kiri + a.lebar / 2 - (b.kiri + b.lebar / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(a.atas + a.tinggi / 2 - (b.atas + b.tinggi / 2))).toBeLessThanOrEqual(1);
  });

  it("cap semi-transparan ~88%: alfa cap dikalikan 0,88, warna tetap; tanda tangan tidak diubah", async () => {
    const h = await bubuh(rtfPmh(), "pmh", CAP_TEGAK);
    const gambar = [...h.rtf.matchAll(/\\pict\\pngblip[^ ]* ([0-9a-f]+)\}/g)].map((x: RegExpMatchArray) => Buffer.from(x[1], "hex"));
    expect(gambar.length).toBe(2);
    const [ttdPng, capPng] = gambar;
    const piksel = async (b: Buffer) => sharp(b).ensureAlpha().raw().toBuffer();
    expect((await piksel(CAP_TEGAK))[3]).toBe(128);
    const raw = await piksel(capPng);
    expect(raw[3]).toBe(Math.round(128 * 0.88));
    expect([raw[0], raw[1], raw[2]]).toEqual([110, 60, 180]);
    expect((await piksel(ttdPng))[3]).toBe((await piksel(TTD_KETUA))[3]);
  });

  it("JPG dan PNG tanpa alfa dikembalikan apa adanya", async () => {
    const m = modulEdoc();
    const bg = { r: 1, g: 2, b: 3 };
    const jpg = await sharp({ create: { width: 10, height: 10, channels: 3, background: bg } }).jpeg().toBuffer();
    const rgb = await sharp({ create: { width: 10, height: 10, channels: 3, background: bg } }).png().toBuffer();
    expect(m.redamkanAlfaPng(jpg, 0.88).equals(jpg)).toBe(true);
    expect(m.redamkanAlfaPng(rgb, 0.88).equals(rgb)).toBe(true);
  });
});

describe("19 Okt: tanpa cap bila tidak berhak / tidak ada", () => {
  it("PHS: cap tidak dibubuhkan walau dikirim; hanya tanda tangan besar", async () => {
    const h = await bubuh(rtfPhs(), "phs", CAP_TEGAK);
    const bentuk = bentukDi(h.rtf);
    expect(bentuk.map((b) => b.nama)).toEqual(["Tanda tangan"]);
    // gambar 240x160: tinggi dibatasi 35 mm, lebar ikut menyusut (52 mm)
    expect(Math.round(bentuk[0].tinggi / TWIP_MM)).toBe(35);
    expect(bentuk[0].lebar / TWIP_MM).toBeLessThanOrEqual(64);
  });

  it("PMH tanpa cap tersimpan: hanya tanda tangan besar", async () => {
    const h = await bubuh(rtfPmh(), "pmh", null);
    expect(bentukDi(h.rtf).map((b) => b.nama)).toEqual(["Tanda tangan"]);
  });
});
