import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { hitungDaftarIsi, rapikanSampulAwal, type BarisDasar } from "@/lib/berkas-perkara";
import { tabelDaftarIsiRtf, ubahKopBundel } from "@/lib/daftar-isi-rtf";
import { grupGambarPngRtf, PENANDA_LOGO, sisipLogoRtf } from "@/lib/logo-rtf";
import { logoMonokrom } from "@/server/modules/berkas-perkara/logo-kop";

/**
 * Perbaikan cetakan nyata 27 Okt 2026: logo satker monokrom di kop, daftar isi Bundel A saja (B hanya upaya hukum) sebagai tabel RTF rapi, ciri bersih,
 * dan jalur PENINGKATAN paket ABT dari keadaan terpasang. Data rekaan.
 */

const AKAR = path.resolve(__dirname, "../../..");
const D = (bundel: "A" | "B", grup: string, kunci: string, nama: string, tanggal: string, halaman: number, ket?: string): BarisDasar => ({ bundel, grup, kunci, nama, tanggal, halaman, sumber: "pasti", ket });
const BARIS: BarisDasar[] = [
  D("A", "I. PENDAFTARAN", "a1", "Surat Gugatan", "2026-03-10", 4),
  D("A", "I. PENDAFTARAN", "a2", "Surat Kuasa Khusus {dari} Penggugat", "2026-03-10", 2),
  D("A", "II. PERSIDANGAN", "a3", "Berita Acara Sidang Pertama", "2026-03-27", 3, "dihadiri Penggugat saja"),
  D("A", "V. PASCA PUTUSAN", "a4", "Akta Cerai", "2026-05-29", 1),
  D("B", "UPAYA HUKUM - BANDING", "b1", "Akta Permohonan Banding", "2026-06-02", 1),
  D("B", "UPAYA HUKUM - BANDING", "b2", "Memori Banding", "2026-06-12", 5),
];

describe("daftar isi sebagai tabel RTF (portal)", () => {
  const hit = hitungDaftarIsi(BARIS, { a1: { tampil: false } }, {});
  it("Bundel A saja: judul bagian berlatar, nomor berlanjut, tanpa baris pemisah bundel, tanpa dokumen Bundel B", () => {
    const t = tabelDaftarIsiRtf(hit.baris, "A", 10506);
    expect(t).toContain("I. PENDAFTARAN");
    expect(t).toContain("V. PASCA PUTUSAN");
    expect(t).not.toContain("BUNDEL");
    expect(t).not.toContain("Banding");
    expect(t).not.toContain("Surat Gugatan"); // disembunyikan
    expect(t).toContain("\\clcbpat3"); // latar judul bagian
    expect(t).toContain("\\trhdr"); // kepala berulang di tiap halaman
    // sel pertama tiap baris dokumen = nomor (baris judul bagian hanya satu sel)
    const nomor = t
      .split("\\row")
      .map((r) => r.match(/\\qc\\f0\\fs17\\sb40\\sa40 (\d+)\\cell/))
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => Number(m[1]));
    expect(nomor).toEqual([1, 2, 3]);
  });
  it("karakter kontrol RTF dan non-ASCII di nama dokumen diloloskan", () => {
    const t = tabelDaftarIsiRtf(hit.baris, "A", 10506);
    expect(t).toContain("\\{dari\\}");
    const u = tabelDaftarIsiRtf(hitungDaftarIsi([D("A", "I. X", "z", "Surat Pernyataan Ibu é", "2026-01-01", 1)], {}, {}).baris, "A", 10506);
    expect(u).toContain("\\u233?");
  });
  it("Bundel B hanya berisi upaya hukum; bundel kosong = Belum ada dokumen; kolom menjumlah ke lebar isi", () => {
    const b = tabelDaftarIsiRtf(hit.baris, "B", 10000);
    expect(b).toContain("UPAYA HUKUM - BANDING");
    expect(b).toContain("Memori Banding");
    expect(b).not.toContain("Akta Cerai");
    expect(tabelDaftarIsiRtf(hitungDaftarIsi([], {}, {}).baris, "A", 10000)).toContain("Belum ada dokumen");
    const batas = [...tabelDaftarIsiRtf(hit.baris, "A", 10000).split("\\row")[0].matchAll(/\\cellx(\d+)/g)].map((m) => Number(m[1]));
    expect(batas).toHaveLength(4);
    expect(batas.at(-1)).toBe(10000);
  });
  it("ubahKopBundel: A = kop bawaan; B mengganti kotak dan subjudul", () => {
    const rtf = "{\\b BUNDEL A} Daftar isi berkas perkara tingkat pertama";
    expect(ubahKopBundel(rtf, "A")).toBe(rtf);
    expect(ubahKopBundel(rtf, "B")).toBe("{\\b BUNDEL B} Daftar isi berkas upaya hukum");
  });
});

describe("logo satker di kop RTF", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  it("grup gambar PNG: ukuran tampil menurut perbandingan, heksa utuh", () => {
    const g = grupGambarPngRtf(png, 200, 100, 960);
    expect(g.startsWith("{\\pict\\pngblip\\picw200\\pich100\\picwgoal1920\\pichgoal960")).toBe(true);
    expect(g.replace(/\s/g, "").endsWith(`${png.toString("hex")}}`)).toBe(true);
    expect(grupGambarPngRtf(png, 0, 10, 960)).toBe("");
  });
  it("penanda diganti (atau dibuang bila logo kosong); RTF tanpa penanda tak berubah", () => {
    const rtf = `{\\fs2\\cf5 ${PENANDA_LOGO}}\\cell`;
    expect(sisipLogoRtf(rtf, "{GAMBAR}")).toBe("{GAMBAR}\\cell");
    expect(sisipLogoRtf(rtf, "")).toBe("\\cell");
    expect(sisipLogoRtf("{\\b x}", "{GAMBAR}")).toBe("{\\b x}");
  });
  it("logoMonokrom: berwarna jadi skala abu-abu (R=G=B), tinggi tetap; bukan gambar = null", async () => {
    const sharp = (await import("sharp")).default;
    const warna = await sharp({ create: { width: 60, height: 30, channels: 4, background: { r: 200, g: 30, b: 60, alpha: 0.5 } } }).png().toBuffer();
    const hasil = await logoMonokrom(warna);
    expect(hasil).not.toBeNull();
    expect(hasil!.tinggi).toBe(220);
    const { data, info } = await sharp(hasil!.png).raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += info.channels) {
      expect(data[i]).toBe(data[i + 1]);
      expect(data[i + 1]).toBe(data[i + 2]);
    }
    expect(await logoMonokrom(Buffer.from("bukan gambar"))).toBeNull();
  });
});

describe("kotak centang tak terpisah dari labelnya; nilai bermakna kosong tidak dicetak", () => {
  it("rapikanSampulAwal: spasi kotak-label dan antar kata dalam label jadi spasi tak-putus, pemisah antar label tetap", () => {
    const hasil = rapikanSampulAwal("[ ] PERMINTAAN SITA  [X] PEMERIKSAAN SETEMPAT  [ ] P");
    expect(hasil).toBe("{\\f1\\u9744?}\\~PERMINTAAN\\~SITA  {\\f1\\u9746?}\\~PEMERIKSAAN\\~SETEMPAT  {\\f1\\u9744?}\\~P");
    expect(rapikanSampulAwal("Hasil: [ ] BERHASIL SEBAGIAN}")).toContain("BERHASIL\\~SEBAGIAN}");
  });
  it("daftar isi: keterangan 0 dan -- tidak ikut dicetak", () => {
    const rows = hitungDaftarIsi([D("A", "I. X", "k1", "Surat A", "2026-01-01", 1, "0"), D("A", "I. X", "k2", "Surat B", "2026-01-02", 1, "--"), D("A", "I. X", "k3", "Surat C", "2026-01-03", 1, "asli")], {}, {}).baris;
    const t = tabelDaftarIsiRtf(rows, "A", 10000);
    expect(t).toContain("Surat A\\cell");
    expect(t).toContain("Surat B\\cell");
    expect(t).toContain("Surat C - asli");
  });
  it("paket ABT: alasan dan agenda riwayat membuang nilai 0, - dan -- (sel dikosongkan)", () => {
    const sql = readFileSync(path.join(AKAR, "abt-paket/sampul-daftar-isi-26okt/paket-satker/abt-sampul-daftar-isi-26okt-PASANG.sql"), "latin1");
    const alasan = sql.split("\n").find((x) => /SELECT 5703,/.test(x)) ?? "";
    expect(alasan).toContain("REGEXP ''^[-0._ ]*$''");
  });
});

describe("paket ABT: ciri bersih, spasi, dan jalur peningkatan", () => {
  const paket = (n: string) => readFileSync(path.join(AKAR, "abt-paket/sampul-daftar-isi-26okt/paket-satker", n), "latin1");
  const pasangSql = paket("abt-sampul-daftar-isi-26okt-PASANG.sql");
  it("variabel ciri memakai pemisah titik tengah, tanpa penanda plus dan lebih-besar", () => {
    const ciri = pasangSql.split("\n").filter((x) => /no_var, nama, data_type, sql_query, locked\) SELECT (5801|5861),/.test(x));
    expect(ciri).toHaveLength(2);
    for (const x of ciri) {
      expect(x).toContain("CHAR(183)");
      expect(x).not.toContain("CONCAT_WS(', '");
    }
    expect(pasangSql).not.toMatch(/''\+ |''> |\[\+|\[>/);
  });
  it("keluaran variabel tanpa dua spasi berturut-turut di pekerjaan/alamat dan pemisah (renderer ABT mengubahnya jadi tab)", () => {
    expect(pasangSql).not.toContain("''  -  Alamat: ''");
    expect(pasangSql).not.toContain("SEPARATOR ''  -  ''");
  });
  it("daftar isi memakai marker tabel portal dan logo; sampul dan ceklist membawa penanda logo", () => {
    const rtf = (f: string) => readFileSync(path.join(AKAR, "abt-paket/sampul-daftar-isi-26okt/paket-satker/rtf/derry_briantono", f), "latin1");
    expect(rtf("98b Berkas Perkara - BAS/Daftar Isi Berkas.rtf")).toContain("#5850#");
    expect(rtf("98b Berkas Perkara - BAS/Daftar Isi Berkas.rtf")).not.toContain("BUNDEL B");
    for (const f of ["Sampul Berkas Perkara.rtf", "Sampul Berkas Perkara (Lengkap).rtf", "Ceklist Berkas Perkara.rtf", "Sampul Berkas Perkara (Permohonan Pihak Banyak) (Legal).rtf"]) {
      expect(rtf(`99 PTSP/${f}`)).toContain(PENANDA_LOGO);
    }
    expect(rtf("98b Berkas Perkara - BAS/Daftar Isi Berkas (F4).rtf")).toContain(PENANDA_LOGO);
  });
  it("PRASYARAT mengenali tiga keadaan: pasang pertama, pasang ulang, PENINGKATAN dari paket sebelumnya", () => {
    const sh = paket("pasang-satker.sh");
    expect(sh).toMatch(/^HARAP='0\|0\|31\|0\|1\|0\|0\|0'$/m);
    expect(sh).toMatch(/^ULANG='0\|177\|31\|1\|1\|1\|0\|0'$/m);
    expect(sh).toMatch(/^TINGKAT='0\|107\|31\|1\|1\|1\|0\|70'$/m);
    expect(sh).toContain("PULIH-PENINGKATAN.sql");
    expect(paket("abt-sampul-daftar-isi-26okt-PULIH-PENINGKATAN.sql").match(/^UPDATE abt_variabel/gm)).toHaveLength(70);
    expect(pasangSql.match(/^UPDATE abt_variabel/gm)).toHaveLength(70);
    const lama = paket("daftar-lama.tsv").split("\n").filter((x) => x && !x.startsWith("#"));
    expect(lama).toHaveLength(21);
    expect(lama.every((x) => /\t[0-9a-f]{32}$/.test(x))).toBe(true);
  });
  it("paket tanpa kata aplikasi dan hanya untuk folder derry_briantono", () => {
    for (const n of ["abt-sampul-daftar-isi-26okt-PASANG.sql", "abt-sampul-daftar-isi-26okt-PULIH-PENINGKATAN.sql", "daftar-lama.tsv", "daftar-rtf.tsv"]) {
      expect(paket(n).toLowerCase()).not.toContain("aleta");
    }
    expect(paket("daftar-rtf.tsv").split("\n").filter((x) => x && !x.startsWith("#")).every((x) => x.startsWith("derry_briantono/"))).toBe(true);
  });
});
