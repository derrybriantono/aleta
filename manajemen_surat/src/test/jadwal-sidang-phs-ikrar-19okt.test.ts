// @vitest-environment node

import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Ruas `tanggalPenetapanSidangIkrar` pada baris Jadwal Sidang (19 Okt 2026):
 * tanggal penetapan hari sidang ikrar perkara cerai talak, bahan aturan saran
 * blangko [91] (putusan gugur karena tidak ikrar 6 bulan). Dijaga:
 *   - terisi dari tiruan DB, hanya untuk cerai talak (jenis 346);
 *   - SATU kueri SELECT untuk seluruh halaman (bukan per baris);
 *   - gagal-terbuka: ruas kosong dan ...Terbaca false, jadwal tetap tampil;
 *   - normalisasi tanggal sama dengan lapis peta Ikrar talak.
 */
const require_ = createRequire(import.meta.url);
const akarBot = path.resolve(process.cwd(), "../aleta_bot");

type Catatan = { sql: string; params: unknown[] };

function muatJadwal(jawab: (sql: string) => unknown[], tabel: string[] = ["perkara_ikrar_talak", "perkara_penetapan"]) {
  const Module = require_("module") as unknown as new (id: string) => {
    filename: string;
    loaded: boolean;
    exports: unknown;
  };
  const jalurDb = require_.resolve(path.join(akarBot, "db_config"));
  const jalurSkema = require_.resolve(path.join(akarBot, "services/sippSkemaService"));
  const jalurLayanan = require_.resolve(path.join(akarBot, "services/sippJadwalSidangService"));
  const kueri: Catatan[] = [];
  const pasang = (jalur: string, isi: unknown) => {
    const m = new Module(jalur);
    m.filename = jalur;
    m.loaded = true;
    m.exports = isi;
    (require_.cache as Record<string, unknown>)[jalur] = m;
  };
  pasang(jalurDb, {
    query: (sql: string, params: unknown[], balik: (g: unknown, h: unknown) => void) => {
      kueri.push({ sql: String(sql), params });
      try {
        balik(null, jawab(String(sql)));
      } catch (galat) {
        balik(galat, null);
      }
    },
  });
  pasang(jalurSkema, {
    tabelAda: async (t: string) => tabel.includes(t),
    kolomAda: async () => false,
    kolomTabel: async () => new Set<string>(),
    pilihKolom: async () => "",
    kolomTerpilih: async () => ({ tanggalPhs: "penetapan_hari_sidang", sidangPertama: "sidang_pertama", ikrarTanggal: "tgl_ikrar_talak" }),
  });
  delete (require_.cache as Record<string, unknown>)[jalurLayanan];
  const layanan = require_(jalurLayanan) as {
    daftarSidang: (i: Record<string, unknown>) => Promise<{ sidang: Array<Record<string, unknown>> }>;
    phsIkrarBanyakPerkara: (id: number[]) => Promise<Record<string, string> | null>;
  };
  return { layanan, kueri };
}

const baris = [
  { sidangId: 1, perkaraId: 10, jenisPerkaraId: 346, tanggalSidang: "2026-10-19", ikrarTalak: "Y" },
  { sidangId: 2, perkaraId: 11, jenisPerkaraId: 346, tanggalSidang: "2026-10-19", ikrarTalak: "T" },
  { sidangId: 3, perkaraId: 12, jenisPerkaraId: 347, tanggalSidang: "2026-10-19", ikrarTalak: "T" }, // cerai gugat
  { sidangId: 4, perkaraId: 13, jenisPerkaraId: 346, tanggalSidang: "2026-10-19", ikrarTalak: "T" }, // PHS "0000-00-00"
];

const jawab = (sql: string) => {
  if (sql.includes("j.ikrar_talak         AS ikrarTalak")) return baris;
  if (sql.includes("FROM perkara_ikrar_talak phs")) {
    return [
      { perkaraId: 10, tanggalPhs: new Date(2026, 3, 19) }, // Date dari driver mysql
      { perkaraId: 11, tanggalPhs: "2026-05-02" },
      { perkaraId: 13, tanggalPhs: "0000-00-00" },
    ];
  }
  return [];
};

describe("ruas tanggalPenetapanSidangIkrar pada baris jadwal sidang", () => {
  it("terisi dari tiruan DB untuk cerai talak; cerai gugat dan PHS rusak kosong", async () => {
    const { layanan } = muatJadwal(jawab);
    const hasil = await layanan.daftarSidang({ dari: "2026-10-19", sampai: "2026-10-19" });
    const per = Object.fromEntries(hasil.sidang.map((s) => [String(s.perkaraId), s.tanggalPenetapanSidangIkrar]));
    expect(per).toEqual({ "10": "2026-04-19", "11": "2026-05-02", "12": "", "13": "" });
    expect(hasil.sidang.every((s) => s.tanggalPenetapanSidangIkrarTerbaca === true)).toBe(true);
  });

  it("satu kueri SELECT untuk seluruh halaman, hanya perkara cerai talak", async () => {
    const { layanan, kueri } = muatJadwal(jawab);
    await layanan.daftarSidang({ dari: "2026-10-19", sampai: "2026-10-19" });
    const phs = kueri.filter((k) => k.sql.includes("FROM perkara_ikrar_talak phs"));
    expect(phs).toHaveLength(1);
    expect(phs[0].params).toEqual([10, 11, 13]); // perkara 12 (cerai gugat) tidak ditanyakan
    expect(phs[0].sql.trimStart().toUpperCase().startsWith("SELECT")).toBe(true);
    expect(phs[0].sql).toContain("tanggal_penetapan_sidang_ikrar");
    expect(phs[0].sql).toMatch(/IN \(\?, \?, \?\)/);
    // Tidak ada tulisan ke perkara_ikrar_talak dari jalur ini.
    expect(kueri.some((k) => /^\s*(UPDATE|INSERT|DELETE)/i.test(k.sql) && k.sql.includes("perkara_ikrar_talak"))).toBe(false);
  });

  it("tanpa cerai talak di halaman: tidak ada kueri PHS sama sekali", async () => {
    const { layanan, kueri } = muatJadwal((sql) =>
      sql.includes("j.ikrar_talak         AS ikrarTalak") ? [baris[2]] : jawab(sql)
    );
    const hasil = await layanan.daftarSidang({ dari: "2026-10-19", sampai: "2026-10-19" });
    expect(kueri.some((k) => k.sql.includes("FROM perkara_ikrar_talak phs"))).toBe(false);
    expect(hasil.sidang[0]).toMatchObject({ tanggalPenetapanSidangIkrar: "", tanggalPenetapanSidangIkrarTerbaca: true });
  });

  it("kueri gagal atau tabel hilang: jadwal tetap tampil, ruas kosong, Terbaca false", async () => {
    const gagal = muatJadwal((sql) => {
      if (sql.includes("FROM perkara_ikrar_talak phs")) throw new Error("tabel rusak");
      return jawab(sql);
    });
    const a = await gagal.layanan.daftarSidang({ dari: "2026-10-19", sampai: "2026-10-19" });
    expect(a.sidang).toHaveLength(4);
    expect(a.sidang.every((s) => s.tanggalPenetapanSidangIkrar === "" && s.tanggalPenetapanSidangIkrarTerbaca === false)).toBe(true);

    const hilang = muatJadwal(jawab, ["perkara_penetapan"]);
    const b = await hilang.layanan.daftarSidang({ dari: "2026-10-19", sampai: "2026-10-19" });
    expect(b.sidang.every((s) => s.tanggalPenetapanSidangIkrarTerbaca === false)).toBe(true);
    expect(hilang.kueri.some((k) => k.sql.includes("FROM perkara_ikrar_talak phs"))).toBe(false);
  });

  it("normalisasi tanggal sama dengan lapis peta Ikrar talak", () => {
    // petaPerkaraService dimuat segar (modul tiruan di atas hanya milik layanan jadwal).
    const peta = require_(path.join(akarBot, "services/petaPerkaraService.js")) as {
      tanggalIkrarIso: (n: unknown) => string;
    };
    expect(peta.tanggalIkrarIso(new Date(2026, 3, 19))).toBe("2026-04-19");
    expect(peta.tanggalIkrarIso("0000-00-00")).toBe("");
    expect(peta.tanggalIkrarIso(null)).toBe("");
    expect(peta.tanggalIkrarIso(new Date("invalid"))).toBe("");
  });
});
