// @vitest-environment node
/**
 * 19 Okt 2026 - jumlah saksi untuk varian blangko putusan "(N Saksi)": saksi yang TERCATAT diperiksa
 * (perkara_keterangan_saksi, sumber yang sama dengan "Saksi N saksi" di Status Perkara), cadangan saksi yang diajukan.
 * Bot: saksiBanyakPerkara menambah `diperiksa` lewat satu SELECT massal; portal: masukanRekomendasiDariBaris memilihnya.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { masukanRekomendasiDariBaris, rekomendasiBlangko } from "@/lib/rekomendasi-blangko";

const akarBot = path.resolve(process.cwd(), "..", "aleta_bot");
const require_ = createRequire(path.join(akarBot, "package.json"));

type Catatan = { sql: string; params: unknown[] };

/** Memuat sippJadwalSidangService dengan basis data dan pembaca skema palsu (disuntikkan lewat require.cache sebelum dimuat). */
function muatLayanan(opsi: { tabelAda?: boolean; gagalDiperiksa?: boolean } = {}) {
  const Module = require_("module") as unknown as new (id: string) => { filename: string; loaded: boolean; exports: unknown };
  const jalurDb = require_.resolve(path.join(akarBot, "db_config"));
  const jalurSkema = require_.resolve(path.join(akarBot, "services/sippSkemaService"));
  const jalurLayanan = require_.resolve(path.join(akarBot, "services/sippJadwalSidangService"));
  const semua: Catatan[] = [];
  const pasang = (jalur: string, isi: unknown) => {
    const m = new Module(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (require_.cache as Record<string, unknown>)[jalur] = m;
  };
  pasang(jalurDb, {
    query: (sql: string, params: unknown[], balik: (g: unknown, h: unknown) => void) => {
      semua.push({ sql, params });
      if (/FROM perkara_pihak5/.test(sql)) {
        return balik(null, [
          { perkaraId: 11, pihak1: 3, pihak2: 1, nama1: "A|B|C", nama2: "D" },
          { perkaraId: 12, pihak1: 2, pihak2: 0, nama1: "E|F", nama2: null },
        ]);
      }
      if (/FROM perkara_keterangan_saksi/.test(sql)) {
        if (opsi.gagalDiperiksa) return balik(new Error("tabel rusak"), null);
        // perkara 11: dua saksi diperiksa dari empat yang diajukan; perkara 13 hanya ada keterangan (tak diajukan)
        return balik(null, [
          { perkaraId: 11, jumlah: 2 },
          { perkaraId: 13, jumlah: 5 },
        ]);
      }
      return balik(null, []);
    },
  });
  pasang(jalurSkema, { tabelAda: async () => opsi.tabelAda !== false, kolomAda: async () => true, pilihKolom: async () => ({}) });
  delete (require_.cache as Record<string, unknown>)[jalurLayanan];
  const layanan = require_(jalurLayanan) as { saksiBanyakPerkara: (id: number[]) => Promise<Record<string, Record<string, unknown>>> };
  return { layanan, semua };
}

describe("bot: saksi yang tercatat diperiksa, satu SELECT massal", () => {
  it("menambah `diperiksa` per perkara tanpa mengubah angka saksi yang diajukan; hanya SELECT", async () => {
    const { layanan, semua } = muatLayanan();
    const h = await layanan.saksiBanyakPerkara([11, 12, 13]);
    expect(h["11"]).toMatchObject({ diajukanPihak1: 3, diajukanPihak2: 1, diperiksa: 2 });
    expect(h["12"]).toMatchObject({ diajukanPihak1: 2, diajukanPihak2: 0 });
    expect(h["12"].diperiksa).toBeUndefined();
    expect(h["13"]).toMatchObject({ diajukanPihak1: 0, diajukanPihak2: 0, diperiksa: 5 });
    const diperiksa = semua.filter((c) => /FROM perkara_keterangan_saksi/.test(c.sql));
    expect(diperiksa).toHaveLength(1);
    expect(diperiksa[0].params).toEqual([11, 12, 13]);
    for (const c of semua) expect(c.sql.trim()).toMatch(/^SELECT/i);
  });

  it("gagal-terbuka: tabel tidak terdaftar atau kueri gagal -> hanya saksi yang diajukan", async () => {
    for (const opsi of [{ tabelAda: false }, { gagalDiperiksa: true }]) {
      const { layanan } = muatLayanan(opsi);
      const h = await layanan.saksiBanyakPerkara([11, 12]);
      expect(h["11"]).toMatchObject({ diajukanPihak1: 3, diajukanPihak2: 1 });
      expect(h["11"].diperiksa).toBeUndefined();
    }
  });
});

describe("portal: jumlah saksi untuk rekomendasi", () => {
  const dasar = { nomorPerkara: "581/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", urutanSidang: 2, agenda: "Pemeriksaan pokok perkara", alasanDitunda: "putus DIKABULKAN (verstek)", sudahPutus: true, statusPutusan: "Dikabulkan", verstekPutusan: true };
  const jumlah = (b: Record<string, unknown>) => rekomendasiBlangko(masukanRekomendasiDariBaris({ ...dasar, ...b })).jumlahSaksi;

  it("saksi tercatat diperiksa didahulukan; cadangannya saksi yang diajukan; tak ada data = tidak diisi", () => {
    expect(jumlah({ saksiDiperiksa: 2, saksiPihak1: 4, saksiPihak2: 1 })).toBe(2);
    expect(jumlah({ saksiDiperiksa: null, saksiPihak1: 4, saksiPihak2: 1 })).toBe(5);
    expect(jumlah({ saksiDiperiksa: 0, saksiPihak1: 3, saksiPihak2: 0 })).toBe(3);
    expect(jumlah({ saksiPihak1: 3 })).toBe(3);
    expect(jumlah({ saksiDiperiksa: null })).toBeUndefined();
    expect(jumlah({})).toBeUndefined();
  });
});
