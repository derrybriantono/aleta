// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * 5 OKT 2026 - BUTIR 31 DAN 32: PENANDA HALAMAN DAFTAR SIPP
 * ============================================================================
 *
 * 31. "izin atasan" hanya untuk perceraian (Cerai Gugat 347, Cerai Talak 346)
 *     dan Izin Poligami (341) - halaman daftar PERMOHONAN SIPP penuh "izin
 *     atasan" pada itsbat nikah, dispensasi kawin, perwalian.
 * 32. "menunggu majelis" hanya dokumen persidangan perkara GUGATAN dan
 *     GUGATAN SEDERHANA, bukan berkas pendaftaran - diukur di server 5 Okt:
 *     18 dari 26 dokumen "belum" adalah berkas pendaftaran tarikan 29 Agu.
 *     Satu definisi untuk bot (ringkasan massal, konteks perkara, dasbor
 *     panitera, kesiapan sidang, tombol verifikasi) dan panel SIPP.
 *
 * Pembukti gigitan: ALETA_UJI_BOT_LAMA=<folder aleta_bot/services lama>.
 */
const akar = path.resolve(process.cwd(), "..");
const folderBot = process.env.ALETA_UJI_BOT_LAMA || path.join(akar, "aleta_bot/services");
const require_ = createRequire(path.join(akar, "aleta_bot/package.json"));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tahapan = require_(path.join(folderBot, "sippTahapanService.js")) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = require_(path.join(folderBot, "ecourtStoreService.js")) as any;

const KONTEN = readFileSync(path.join(akar, "ekstensi-sipp/konten.js"), "utf8").replace(/\r\n/g, "\n");

function ambilFungsi(s: string, nama: string): string {
  const i = s.indexOf(`function ${nama}(`);
  expect(i, `fungsi ${nama} tidak ada`).toBeGreaterThan(-1);
  const buka = s.indexOf("{", s.indexOf(")", i));
  let dalam = 0;
  for (let j = buka; j < s.length; j++) {
    if (s[j] === "{") dalam++;
    else if (s[j] === "}" && --dalam === 0) return s.slice(i, j + 1);
  }
  throw new Error(`badan ${nama} tidak tertutup`);
}

describe("butir 31: izin atasan hanya perceraian dan poligami", () => {
  it("kode jenis SIPP dan cadangan nama", () => {
    expect(typeof tahapan.jenisPerluIzinAtasan).toBe("function");
    expect(tahapan.jenisPerluIzinAtasan(347, "Cerai Gugat")).toBe(true);
    expect(tahapan.jenisPerluIzinAtasan(346, "Cerai Talak")).toBe(true);
    expect(tahapan.jenisPerluIzinAtasan(341, "Izin Poligami")).toBe(true);
    expect(tahapan.jenisPerluIzinAtasan(0, "Cerai Gugat")).toBe(true);
    for (const [id, nama] of [
      [330, "Pengesahan Perkawinan/Istbat Nikah"],
      [0, "Dispensasi Kawin"],
      [0, "Perwalian"],
      [0, "P3HP/Penetapan Ahli Waris"],
      [0, "Asal Usul Anak"],
      [0, "Kewarisan"],
    ] as const) {
      expect(tahapan.jenisPerluIzinAtasan(id, nama), nama).toBe(false);
    }
  });

  it("penandaPerkara dan ringkasan massal memakai syarat jenis yang sama", () => {
    const sumberTahapan = readFileSync(path.join(folderBot, "sippTahapanService.js"), "utf8");
    expect(sumberTahapan).toMatch(/perluIzinAtasan: jenisButuhIzin && instansi\.some/);
    const sumberKonteks = readFileSync(path.join(folderBot, "sippKonteksService.js"), "utf8");
    expect(sumberKonteks).toMatch(/sippTahapanService\.jenisPerluIzinAtasan\(baris\.jenisId, baris\.jenisNama\)/);
  });
});

describe("butir 32: menunggu majelis - satu definisi", () => {
  const d = (o: Record<string, unknown>) => ({ statusVerifikasi: "belum", diunggahPada: "2026-09-16T00:00:00Z", ...o });

  it("bot: dokumen persidangan gugatan/gugatan sederhana saja; bukan berkas pendaftaran, bukan permohonan", () => {
    expect(typeof store.dokumenMenungguMajelis).toBe("function");
    expect(store.dokumenMenungguMajelis(d({ nomorPerkara: "480/Pdt.G/2026/PA.Dgl", judulDokumen: "Kesimpulan Termohon" }))).toBe(true);
    expect(store.dokumenMenungguMajelis(d({ nomorPerkara: "5/Pdt.G.S/2026/PA.Dgl", judulDokumen: "Jawaban Tergugat" }))).toBe(true);
    // Berkas pendaftaran tarikan lama (tanpa tanggal unggah).
    for (const judul of ["SURAT GUGATAN (Docx/Rtf)", "Dokumen Gugatan", "Surat Kuasa", "Dokumen Bukti"]) {
      expect(store.dokumenMenungguMajelis(d({ nomorPerkara: "451/Pdt.G/2026/PA.Dgl", judulDokumen: judul, diunggahPada: null })), judul).toBe(false);
    }
    // Permohonan: tidak ada verifikasi majelis.
    expect(store.dokumenMenungguMajelis(d({ nomorPerkara: "185/Pdt.P/2026/PA.Dgl", judulDokumen: "Kesimpulan Pemohon" }))).toBe(false);
    expect(store.dokumenMenungguMajelis(d({ nomorPerkara: "480/Pdt.G/2026/PA.Dgl", judulDokumen: "Kesimpulan", statusVerifikasi: "valid" }))).toBe(false);
  });

  it("bot: potongan SQL ringkasan memuat ketiga syarat; dasbor panitera dan konteks memakainya", () => {
    const sql = store.sqlMenungguMajelis("d");
    expect(sql).toContain("d.status_verifikasi = 'belum'");
    expect(sql).toContain("/Pdt.G/");
    expect(sql).toContain("/Pdt.G.S/");
    expect(sql).toMatch(/diunggah_pada IS NULL AND LOWER\(TRIM\(d\.judul_dokumen\)\) REGEXP/);
    expect(readFileSync(path.join(folderBot, "paniteraDashboardService.js"), "utf8")).toContain("ecourtStoreService.sqlMenungguMajelis()");
    expect(readFileSync(path.join(folderBot, "sippKonteksService.js"), "utf8")).toContain("ecourtStoreService.sqlMenungguMajelis()");
  });

  it("panel SIPP: aturan yang sama dengan bot (ktnDokumenMenungguMajelis)", () => {
    const pola = KONTEN.match(/const KTN_POLA_BERKAS_PENDAFTARAN =\s*(\/.+\/i);/);
    expect(pola, "KTN_POLA_BERKAS_PENDAFTARAN hilang").not.toBeNull();
    const fungsi = new Function(
      `const KTN_POLA_BERKAS_PENDAFTARAN = ${(pola as RegExpMatchArray)[1]};\n${ambilFungsi(KONTEN, "ktnDokumenMenungguMajelis")}\nreturn ktnDokumenMenungguMajelis;`
    )() as (d: Record<string, unknown>, n: string) => boolean;
    expect(fungsi(d({ judulDokumen: "Kesimpulan Termohon" }), "480/Pdt.G/2026/PA.Dgl")).toBe(true);
    expect(fungsi(d({ judulDokumen: "Kesimpulan Pemohon" }), "185/Pdt.P/2026/PA.Dgl")).toBe(false);
    expect(fungsi(d({ judulDokumen: "Surat Kuasa", diunggahPada: null }), "451/Pdt.G/2026/PA.Dgl")).toBe(false);
  });
});
