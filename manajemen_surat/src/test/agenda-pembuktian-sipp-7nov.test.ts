/**
 * Agenda pembuktian dari jadwal SIPP (Fitur 46): layanan bot menghitung berapa tanggal sidang berjalan beragenda pembuktian dengan kueri palsu,
 * hanya membaca, tidak menebak, dan tidak menjatuhkan data pihak bila jadwal gagal terbaca; rute meneruskan angka bersih. Data rekaan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { bersihAgendaPembuktian } from "@/lib/bukti-tertulis";

const AKAR = path.resolve(__dirname, "../../..");
const layanan = createRequire(import.meta.url)(path.join(AKAR, "aleta_bot/services/buktiSippService.js")) as {
  buktiSipp: (kueri: (sql: string, p: unknown[]) => Promise<unknown>, id: unknown, opsi?: { hariIni?: string }) => Promise<Record<string, unknown>>;
  hitungAgendaPembuktian: (baris: unknown, hariIni?: string) => number | null;
  SQL_JADWAL: string;
};

const HARI = "2026-11-07";
const j = (tgl: string, agenda: string) => ({ tgl, agenda });

describe("hitungAgendaPembuktian", () => {
  it("menghitung tanggal sidang berjalan yang agendanya menyebut bukti atau saksi, termasuk salah ketik", () => {
    const baris = [
      j("2026-01-05", "Sidang Pertama"),
      j("2026-01-19", "Pembuktian"),
      j("2026-02-02", "Pembuktian Lanjutan"),
      j("2026-02-16", "Pengajuan alat bukti"),
      j("2026-03-02", "Mengajukan saksi-saksi"),
      j("2026-03-16", "pwembuktian"),
      j("2026-03-30", "Kesimpulan"),
    ];
    expect(layanan.hitungAgendaPembuktian(baris, HARI)).toBe(5);
  });

  it("dua baris pada tanggal yang sama dihitung satu sidang", () => {
    expect(layanan.hitungAgendaPembuktian([j("2026-01-19", "Pembuktian"), j("2026-01-19", "Pembuktian penggugat")], HARI)).toBe(1);
  });

  it("sidang yang belum berjalan (sesudah hari ini) dan tanggal tidak sah tidak dihitung; hari ini ikut", () => {
    const baris = [j("2026-11-07", "Pembuktian"), j("2026-11-08", "Pembuktian lanjutan"), j("0000-00-00", "Pembuktian"), j("", "Pembuktian"), j("kemarin", "Pembuktian")];
    expect(layanan.hitungAgendaPembuktian(baris, HARI)).toBe(1);
  });

  it("agenda bersyarat tidak dihitung", () => {
    expect(layanan.hitungAgendaPembuktian([j("2026-01-19", "Pemeriksaan identitas/pembuktian jika termohon tidak hadir")], HARI)).toBeNull();
    expect(layanan.hitungAgendaPembuktian([j("2026-01-19", "Pembuktian apabila tergugat tidak datang")], HARI)).toBeNull();
  });

  it("tidak terbaca = null, bukan nol: jadwal kosong, tanpa agenda pembuktian, bukan larik", () => {
    expect(layanan.hitungAgendaPembuktian([], HARI)).toBeNull();
    expect(layanan.hitungAgendaPembuktian([j("2026-01-19", "Sidang pertama"), j("2026-02-02", ""), j("2026-02-16", "Musyawarah majelis")], HARI)).toBeNull();
    expect(layanan.hitungAgendaPembuktian(null, HARI)).toBeNull();
    expect(layanan.hitungAgendaPembuktian(undefined, HARI)).toBeNull();
    expect(layanan.hitungAgendaPembuktian([null, { tgl: 5 }], HARI)).toBeNull();
  });

  it("tanpa hari yang diberikan, hari ini dari jam mesin dipakai", () => {
    expect(layanan.hitungAgendaPembuktian([j("2001-01-01", "Pembuktian"), j("2999-01-01", "Pembuktian")])).toBe(1);
  });
});

describe("buktiSipp", () => {
  const PIHAK = [{ sisi: "P", urutan: 1, nama: "Fulan", nik: "1234567890123456" }];
  const kueriPalsu = (jadwal: unknown, catat: string[] = []) => async (sql: string) => {
    catat.push(sql);
    if (/perkara_jadwal_sidang/.test(sql)) {
      if (jadwal instanceof Error) throw jadwal;
      return jadwal;
    }
    if (/perkara_pihak1/.test(sql)) return PIHAK;
    return [];
  };

  it("menyertakan agendaPembuktianKe dan hanya memakai SELECT", async () => {
    const sql: string[] = [];
    const h = await layanan.buktiSipp(kueriPalsu([j("2026-01-19", "Pembuktian"), j("2026-02-02", "Pembuktian lanjutan")], sql), "77", { hariIni: HARI });
    expect(h.ada).toBe(true);
    expect(h.agendaPembuktianKe).toBe(2);
    expect(sql.length).toBe(3);
    for (const s of sql) expect(s.trim()).toMatch(/^SELECT\b/);
    expect(layanan.SQL_JADWAL).toMatch(/WHERE perkara_id = \?/);
  });

  it("jadwal tanpa pembuktian atau kosong: null", async () => {
    expect((await layanan.buktiSipp(kueriPalsu([j("2026-01-19", "Sidang pertama")]), "77", { hariIni: HARI })).agendaPembuktianKe).toBeNull();
    expect((await layanan.buktiSipp(kueriPalsu([]), "77", { hariIni: HARI })).agendaPembuktianKe).toBeNull();
  });

  it("kueri jadwal gagal: pihak tetap terbaca dan agenda null", async () => {
    const h = await layanan.buktiSipp(kueriPalsu(new Error("tabel tidak ada")), "77", { hariIni: HARI });
    expect(h.ada).toBe(true);
    expect(h.agendaPembuktianKe).toBeNull();
    expect((h.P as unknown[]).length).toBe(1);
  });

  it("kueri jadwal yang melempar seketika (bukan janji) juga tidak menjatuhkan hasil", async () => {
    const kueri = (sql: string) => {
      if (/perkara_jadwal_sidang/.test(sql)) throw new Error("langsung gagal");
      return Promise.resolve(/perkara_pihak1/.test(sql) ? PIHAK : []);
    };
    const h = await layanan.buktiSipp(kueri, "77", { hariIni: HARI });
    expect(h.ada).toBe(true);
    expect(h.agendaPembuktianKe).toBeNull();
  });

  it("perkara_id bukan angka: tidak ada kueri dan agenda null", async () => {
    const sql: string[] = [];
    const h = await layanan.buktiSipp(kueriPalsu([], sql), "7; DROP", { hariIni: HARI });
    expect(h.ada).toBe(false);
    expect(h.agendaPembuktianKe).toBeNull();
    expect(sql).toEqual([]);
  });
});

describe("rute dan bersihAgendaPembuktian", () => {
  it("hanya bilangan bulat 1 sampai 50 yang diteruskan", () => {
    for (const x of [1, 2, 7, 50]) expect(bersihAgendaPembuktian(x)).toBe(x);
    for (const x of [0, -1, 51, 1.5, NaN, Infinity, "2", null, undefined, {}, []]) expect(bersihAgendaPembuktian(x)).toBeNull();
  });
  it("rute meneruskan angka bersih di semua jalur dan NIK utuh tetap tidak keluar", () => {
    const rute = readFileSync(path.join(AKAR, "manajemen_surat/src/app/api/aleta-ecourt/blangko-derry/bukti-sipp/route.ts"), "utf8");
    expect(rute).toContain("bersihAgendaPembuktian(data?.agendaPembuktianKe)");
    expect(rute).toMatch(/ada: false, P: \[\], T: \[\], nikah: null, agendaPembuktianKe: null/);
    expect(rute).toContain("samarkanNik");
    expect(rute).not.toMatch(/nik:\s*p\.nik/);
  });
});
