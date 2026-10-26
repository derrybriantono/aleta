// @vitest-environment node
/**
 * Riwayat tunda/putus otomatis terstruktur (U19, rantai F3, 25 Okt 2026).
 *
 *   A. migrasi 0105 = DDL_OTOMATIS_JEJAK, terdaftar di cadangan, jurnal tanpa lubang;
 *   B. perhitungan murni: pembentuk baris dan ringkasan ketepatan per aturan;
 *   C. tunda otomatis SUNGGUHAN atas pg-mem: tiap sidang satu baris (aturan, hasil, kering,
 *      ditolak penjaga), blob harian tetap utuh, kegagalan jejak tidak mengganggu;
 *   D. putus otomatis SUNGGUHAN: aturan 7/8, e-Doc, ditolak penjaga;
 *   E. isi ulang dari blob lama (idempoten), saklar ALETA_OTOMATIS_JEJAK=0;
 *   F. rute laporan: hanya Admin/Super Admin, angka sesuai.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { SidangRiwayat } from "@/lib/bawaan-tunda";
import { petaLiburBerlaku } from "@/lib/hari-libur";
import { labelAturan, labelHasil, ringkasKetepatan, type BarisJejak } from "@/lib/otomatis-jejak";
import { createAletaDatabase, IN_MEMORY_TABLE_PERSISTENCE_ORDER, type AletaDatabase } from "@/server/db/client";
import { DDL_OTOMATIS_JEJAK } from "@/server/db/schema";
import {
  aturUlangJejak,
  barisDariPutus,
  barisDariTunda,
  catatTundaHari,
  hitungJejak,
  isiUlangJejakOtomatis,
} from "@/server/modules/otomatis-jejak/jejak";
import { kurangiHari } from "@/server/modules/otomatis-jejak/laporan";
import { detakPutusOtomatis, simpanSetelanPutus, bacaCatatanHariPutus, type SumberPutusOtomatis } from "@/server/modules/putus-otomatis/layanan";
import { bacaCatatanHari, jalankanTundaOtomatis, simpanSetelan, type BahanSidang, type SumberTundaOtomatis } from "@/server/modules/tunda-otomatis/layanan";

const HARI = "2026-10-22";
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-super";

vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));

const d = () => db as AletaDatabase;
const SUPER = { id: "u-super", name: "Derry Briantono" };

// ─── A. migrasi ─────────────────────────────────────────────────────────────

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

describe("A. migrasi 0105", () => {
  it("jurnal tanpa lubang; berkas = DDL_OTOMATIS_JEJAK; jalan di pg-mem; terdaftar di cadangan; tanpa FK/CHECK", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    const ini = j.entries.filter((e) => e.tag === "0105_aleta_otomatis_jejak");
    expect(ini).toHaveLength(1);
    expect(ini[0].when).toBeGreaterThan(j.entries[ini[0].idx - 1].when);
    const teks = readFileSync(path.join(process.cwd(), "drizzle/0105_aleta_otomatis_jejak.sql"), "utf8");
    expect(pernyataan(teks)).toEqual([...DDL_OTOMATIS_JEJAK.tabel, ...DDL_OTOMATIS_JEJAK.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(teks);
    expect(kosong.public.many("SELECT * FROM aleta_otomatis_jejak")).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_otomatis_jejak");
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(teks.replace(/--.*$/gm, ""))).toBe(false);
    // tanpa nama pihak/NIK di kolom
    expect(teks.replace(/--.*$/gm, "")).not.toMatch(/\b(nik|nama_pihak|alamat)\b/i);
  });
});

// ─── B. murni ───────────────────────────────────────────────────────────────

const baris = (u: Partial<BarisJejak>): BarisJejak => ({
  id: "x", fitur: "tunda", tanggal: HARI, jadwalId: "1", perkaraId: "p1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat",
  keputusan: "tunda", aturan: "court-calendar", nomorAturan: 3, tanggalTunda: "2026-11-05", hasil: "tertulis", kering: false, ditolakPenjaga: false,
  dibatalkanPetugas: false, pesan: "", edoc: "", pemicu: "jadwal", jam: "16:30", ...u,
});

describe("B. ringkasan ketepatan per aturan", () => {
  it("menghitung dicoba, lolos, ditolak saat dibaca ulang, gagal, dibatalkan, kering/nyata, usulan, dan persen lolos", () => {
    const r = ringkasKetepatan(
      [
        baris({ jadwalId: "1", hasil: "tertulis" }),
        baris({ jadwalId: "2", hasil: "diantrekan" }),
        baris({ jadwalId: "3", hasil: "ditolak", ditolakPenjaga: true }),
        baris({ jadwalId: "4", hasil: "kering-lolos", kering: true }),
        baris({ jadwalId: "5", hasil: "gagal" }),
        baris({ jadwalId: "6", hasil: "dibatalkan", dibatalkanPetugas: true }),
        baris({ jadwalId: "7", keputusan: "gugur", aturan: "gugur", nomorAturan: 7, hasil: "dilewati" }),
        baris({ jadwalId: "8", keputusan: "lewati", aturan: "perkiraan-verstek", nomorAturan: 0, hasil: "" }),
        baris({ jadwalId: "9", keputusan: "lewati", aturan: "dibatalkan-petugas", nomorAturan: 0, hasil: "", dibatalkanPetugas: true }),
        baris({ jadwalId: "10", fitur: "putus", keputusan: "putus", aturan: "gugur", nomorAturan: 7, hasil: "kering-ditolak", kering: true, ditolakPenjaga: true }),
      ],
      "2026-10-01",
      HARI
    );
    const cc = r.aturan.find((a) => a.fitur === "tunda" && a.aturan === "court-calendar")!;
    expect(cc).toMatchObject({ dicoba: 6, lolos: 3, ditolakPenjaga: 1, gagal: 1, dibatalkan: 1, kering: 1, nyata: 5, usulan: 0 });
    expect(cc.persenLolos).toBe(75); // 3 lolos dari 4 yang diputuskan penjaga
    expect(r.aturan.find((a) => a.fitur === "tunda" && a.aturan === "gugur")).toMatchObject({ dicoba: 0, usulan: 1, persenLolos: null });
    expect(r.aturan.find((a) => a.fitur === "putus")).toMatchObject({ dicoba: 1, lolos: 0, ditolakPenjaga: 1, kering: 1, persenLolos: 0 });
    expect(r.dilewati.map((s) => [s.fitur, s.sebab, s.jumlah])).toEqual([
      ["tunda", "dibatalkan-petugas", 1],
      ["tunda", "perkiraan-verstek", 1],
    ]);
    expect(r.jumlahBaris).toBe(10);
  });

  it("label layar memakai bahasa petugas, bukan kode", () => {
    expect(labelAturan("tunda", "court-calendar", 3)).toBe("Tunda otomatis: Mengikuti Court Calendar (aturan 3)");
    expect(labelAturan("putus", "tidak-dapat-diterima", 8)).toBe("Putus otomatis: Tidak dapat diterima (aturan 8)");
    expect(labelHasil("ditolak")).toBe("Ditolak saat dibaca ulang");
    expect(labelHasil("")).toBe("Belum ditulis");
  });

  it("kurangiHari memakai kalender, melewati batas bulan dan tahun", () => {
    expect(kurangiHari("2026-03-01", 1)).toBe("2026-02-28");
    expect(kurangiHari("2026-01-05", 10)).toBe("2025-12-26");
    expect(kurangiHari("2026-10-25", 90)).toBe("2026-07-27");
  });
});

// ─── C. tunda otomatis sungguhan ────────────────────────────────────────────

const sidangRiwayat = (id: number, tanggal: string, dihadiriOleh: number | null): SidangRiwayat => ({
  jadwalId: id, tanggal, agenda: "Sidang", ditunda: true, alasan: "Panggil", dihadiriOleh, ikrar: false,
});

const barisJadwal = (sidangId: string, ubah: Record<string, unknown> = {}) => ({
  sidangId,
  perkaraId: `p${sidangId}`,
  nomorPerkara: `${sidangId}/Pdt.G/2026/PA.Dgl`,
  jenisPerkara: "Cerai Gugat",
  alurPerkaraId: 15,
  tanggalSidang: HARI,
  agenda: "Pemeriksaan Pokok Perkara",
  ditunda: false,
  alasanDitunda: "0",
  sudahPutus: false,
  sidangIkrarTalak: false,
  majelisNama: "Derry Briantono",
  paniteraNama: "Munifa",
  ...ubah,
});

const bahanSidang = (id: number, riwayat: SidangRiwayat[]): BahanSidang => ({
  ok: true,
  keadaan: { jadwalId: id, tanggalSidang: HARI, agenda: "Pemeriksaan Pokok Perkara", ditunda: "T", alasanDitunda: "0", sidangKeliling: "T", ruangan: "Ruang 1", alurPerkaraId: 15 },
  riwayat: { sidang: riwayat, mediasi: null },
  antrian: null,
  atasNama: { ok: true, username: "munifa,SH.", namaLengkap: "Munifa" },
  kalender: [],
  kontak: null,
  kunci: { aktif: false },
  kelilingBerikut: null,
});

function sumberTunda(tulis: (isi: Record<string, unknown>) => ReturnType<SumberTundaOtomatis["tulis"]>): SumberTundaOtomatis {
  return {
    async jadwal() {
      return { ok: true, galat: "", sidang: [barisJadwal("1"), barisJadwal("2"), barisJadwal("3", { ditunda: true })] };
    },
    async bahan(id) {
      if (id === "1") return bahanSidang(1, [{ ...sidangRiwayat(1, HARI, null), ditunda: false }]);
      return bahanSidang(2, [sidangRiwayat(20, "2026-10-08", 4), { ...sidangRiwayat(2, HARI, null), ditunda: false }]);
    },
    tulis,
    async antrean() {
      return [];
    },
    async batalAntrean() {
      return { ok: true };
    },
    async libur() {
      return petaLiburBerlaku();
    },
  } as SumberTundaOtomatis;
}

const semuaJejak = (fitur: string) =>
  d().queryAll<Record<string, unknown>>("SELECT * FROM aleta_otomatis_jejak WHERE fitur = ? ORDER BY jadwal_id", [fitur]);

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});
afterAll(async () => {
  await db?.close();
  db = null;
});
beforeEach(async () => {
  aturUlangJejak();
  delete process.env.ALETA_OTOMATIS_JEJAK;
  aktor = "usr-super";
  await d().run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ?", ["*sistem*"]);
  await d().run("DELETE FROM aleta_otomatis_jejak");
});

describe("C. tunda otomatis: satu baris per sidang, blob harian tetap utuh", () => {
  it("MODE KERING: tunda lolos kering, gugur hanya usulan, sudah-ditunda dilewati; blob sama dengan tabel", async () => {
    await simpanSetelan(d(), SUPER, { nyala: true, kering: true }, "");
    const c = await jalankanTundaOtomatis(d(), { pemicu: "jadwal", tanggal: HARI, sumber: sumberTunda(async () => ({ ok: true, data: { ok: true, kering: true, atasNama: { namaLengkap: "Munifa" } } })) });
    const baris = await semuaJejak("tunda");
    expect(baris.map((b) => [b.jadwal_id, b.keputusan, b.hasil])).toEqual([
      ["1", "tunda", "kering-lolos"],
      ["2", "gugur", "dilewati"],
      ["3", "lewati", ""],
    ]);
    expect(baris[0]).toMatchObject({ kering: 1, ditolak_penjaga: 0, nomor_aturan: 2, tanggal_tunda: "2026-11-05", pemicu: "jadwal", jam: "16:30", nomor_perkara: "1/Pdt.G/2026/PA.Dgl", tanggal: HARI });
    expect(baris[1]).toMatchObject({ aturan: "gugur", nomor_aturan: 7 });
    expect(baris[2]).toMatchObject({ aturan: "sudah-ditunda", nomor_aturan: 0, dibatalkan_petugas: 0 });
    // blob harian (sumber logika) tetap ada dan sama isinya
    const blob = await bacaCatatanHari(d(), HARI);
    expect(blob.butir.map((b) => b.jadwalId)).toEqual(["1", "2", "3"]);
    expect(c.jalan?.mode).toBe("kering");
    // tidak ada nama pihak di tabel
    expect(JSON.stringify(baris)).not.toMatch(/Munifa|Derry/);
  });

  it("MENYALA dan bot menolak saat membaca ulang: ditolak_penjaga=1, hasil 'ditolak', kering=0", async () => {
    await simpanSetelan(d(), SUPER, { nyala: true, kering: false }, "");
    await jalankanTundaOtomatis(d(), { pemicu: "tangan", oleh: "Derry", tanggal: HARI, sumber: sumberTunda(async () => ({ ok: false, galat: "Pihak tercatat hadir hari ini - tidak ditunda." })) });
    const [satu] = await semuaJejak("tunda");
    expect(satu).toMatchObject({ jadwal_id: "1", keputusan: "tunda", hasil: "ditolak", ditolak_penjaga: 1, kering: 0, pemicu: "tangan" });
    expect(String(satu.pesan)).toContain("tercatat hadir");
  });

  it("diantrekan lalu berubah: baris mengikuti status akhir; sidang yang dibatalkan petugas tercatat", async () => {
    await simpanSetelan(d(), SUPER, { nyala: true, kering: false }, "");
    const antrean: Array<{ kunci: string; status: string; hasil: string; jadwal: string }> = [];
    const sumber = { ...sumberTunda(async () => ({ ok: true, data: { ok: true, diantrekan: true, kalimat: "Diantrekan.", dikerjakanPada: "2026-10-23 07:52:00", atasNama: { namaLengkap: "Munifa" } } })), antrean: async () => antrean } as SumberTundaOtomatis;
    await jalankanTundaOtomatis(d(), { pemicu: "jadwal", tanggal: HARI, sumber });
    expect((await semuaJejak("tunda"))[0]).toMatchObject({ hasil: "diantrekan" });
    antrean.push({ kunci: "sidang-tunda:otomatis:1", status: "selesai", hasil: "{}", jadwal: "2026-10-22 16:40:00" });
    const { bacaDaftarHari, tandaiBatal } = await import("@/server/modules/tunda-otomatis/layanan");
    await bacaDaftarHari(d(), { tanggal: HARI, sumber });
    expect((await semuaJejak("tunda"))[0]).toMatchObject({ hasil: "tertulis", ditolak_penjaga: 0 });
    await tandaiBatal(d(), { tanggal: HARI, jadwalId: "2", oleh: "u1", nama: "Munifa", batal: true, sumber });
    expect(Number((await d().queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM aleta_otomatis_jejak WHERE fitur = ?", ["tunda"]))?.n)).toBe(3);
  });

  it("menyimpan blob berulang-ulang tidak menulis ulang baris yang tidak berubah", async () => {
    await simpanSetelan(d(), SUPER, { nyala: true, kering: true }, "");
    const c = await jalankanTundaOtomatis(d(), { pemicu: "jadwal", tanggal: HARI, sumber: sumberTunda(async () => ({ ok: true, data: { ok: true, kering: true } })) });
    expect(await catatTundaHari(d(), c)).toBe(0);
    c.butir[0].tulis = { ...c.butir[0].tulis!, status: "gagal", pesan: "berubah" };
    expect(await catatTundaHari(d(), c)).toBe(1);
    expect((await semuaJejak("tunda"))[0]).toMatchObject({ hasil: "gagal" });
  });

  it("jejak gagal (tabel hilang) TIDAK mengganggu tunda otomatis: blob tetap tersimpan, tanpa galat", async () => {
    const kosong = await createAletaDatabase({ useInMemory: true, seed: true });
    try {
      await kosong.run("DROP TABLE aleta_otomatis_jejak");
      await simpanSetelan(kosong, SUPER, { nyala: true, kering: true }, "");
      const peringatan = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const c = await jalankanTundaOtomatis(kosong, { pemicu: "jadwal", tanggal: HARI, sumber: sumberTunda(async () => ({ ok: true, data: { ok: true, kering: true } })) });
      expect(c.butir).toHaveLength(3);
      expect(c.jalan?.galat).toBe("");
      expect((await bacaCatatanHari(kosong, HARI)).butir).toHaveLength(3);
      expect(peringatan).toHaveBeenCalledTimes(1);
      peringatan.mockRestore();
    } finally {
      await kosong.close();
    }
  });

  it("ALETA_OTOMATIS_JEJAK=0 mematikan jejak; blob tetap", async () => {
    process.env.ALETA_OTOMATIS_JEJAK = "0";
    await simpanSetelan(d(), SUPER, { nyala: true, kering: true }, "");
    await jalankanTundaOtomatis(d(), { pemicu: "jadwal", tanggal: HARI, sumber: sumberTunda(async () => ({ ok: true, data: { ok: true, kering: true } })) });
    expect(await hitungJejak(d())).toBe(0);
    expect((await bacaCatatanHari(d(), HARI)).butir).toHaveLength(3);
  });
});

// ─── D. putus otomatis sungguhan ────────────────────────────────────────────

describe("D. putus otomatis: aturan 7/8, e-Doc, ditolak penjaga", () => {
  const ini = (id: number): SidangRiwayat => ({ ...sidangRiwayat(id, HARI, null), ditunda: false, alasan: "" });
  const sumberPutus = (tulisPutus: SumberPutusOtomatis["tulisPutus"]): SumberPutusOtomatis => ({
    async jadwal() {
      return { ok: true, galat: "", sidang: [barisJadwal("1"), barisJadwal("2"), barisJadwal("3", { ditunda: true })] };
    },
    async bahan(id) {
      const riwayat = id === "1" ? [sidangRiwayat(10, "2026-10-08", 4), ini(1)] : [sidangRiwayat(19, "2026-10-01", 1), sidangRiwayat(20, "2026-10-08", 4), ini(2)];
      return { ok: true, keadaan: { tanggalSidang: HARI, ditunda: "T", alasanDitunda: "0", sidangKeliling: "T", alurPerkaraId: 15, jenisPerkara: "Cerai Gugat" }, riwayat: { sidang: riwayat, mediasi: null }, atasNama: { ok: true, namaLengkap: "Munifa" }, kalender: [], kunci: { aktif: false } };
    },
    async libur() {
      return petaLiburBerlaku();
    },
    async kehadiranRinci() {
      return [];
    },
    async statusPutusan() {
      return [{ id: 93, nama: "Gugur", dipakai: 41 }, { id: 64, nama: "Tidak Dapat Diterima", dipakai: 48 }];
    },
    tulisPutus,
    async edoc(_db, _b, _status, _s, kering) {
      return { status: kering ? "kering-blangko" : "dijadwalkan", pesan: "blangko", pada: "x" };
    },
  } as SumberPutusOtomatis);

  it("tertulis: aturan 7 (gugur) dan 8 (tidak dapat diterima), e-Doc dijadwalkan, dilewati tercatat", async () => {
    await simpanSetelanPutus(d(), SUPER, { nyala: true, kering: false }, "192.168.10.21");
    await detakPutusOtomatis(d(), { kini: new Date("2026-10-22T08:31:00Z"), sumber: sumberPutus(async () => ({ ok: true, data: { ok: true, atasNama: { namaLengkap: "Munifa" } } })) });
    const baris = await semuaJejak("putus");
    expect(baris.map((b) => [b.jadwal_id, b.keputusan, b.aturan, b.nomor_aturan, b.hasil, b.edoc])).toEqual([
      ["1", "putus", "gugur", 7, "tertulis", "dijadwalkan"],
      ["2", "putus", "tidak-dapat-diterima", 8, "tertulis", "dijadwalkan"],
    ]);
    expect(baris[0]).toMatchObject({ kering: 0, ditolak_penjaga: 0, jam: "16:30", pemicu: "jadwal" });
    expect((await bacaCatatanHariPutus(d(), HARI)).butir).toHaveLength(2);
  });

  it("bot menolak salah satu: baris itu ditolak_penjaga=1 dan menurunkan persen lolos aturannya", async () => {
    await simpanSetelanPutus(d(), SUPER, { nyala: true, kering: false }, "");
    let n = 0;
    await detakPutusOtomatis(d(), {
      kini: new Date("2026-10-22T08:31:00Z"),
      sumber: sumberPutus(async () => (++n === 1 ? { ok: false, galat: "pihak_tercatat_hadir" } : { ok: true, data: { ok: true } })),
    });
    const baris = await semuaJejak("putus");
    expect(baris.map((b) => [b.jadwal_id, b.hasil, b.ditolak_penjaga])).toEqual([["1", "ditolak", 1], ["2", "tertulis", 0]]);
    expect(baris[0].edoc).toBe(""); // tidak ada e-Doc untuk yang ditolak
  });

  it("mode kering: kering=1 dan e-Doc hanya memeriksa blangko", async () => {
    await simpanSetelanPutus(d(), SUPER, { nyala: true, kering: true }, "");
    await detakPutusOtomatis(d(), { kini: new Date("2026-10-22T08:31:00Z"), sumber: sumberPutus(async () => ({ ok: true, data: { ok: true } })) });
    const baris = await semuaJejak("putus");
    expect(baris.every((b) => b.kering === 1 && b.hasil === "kering-lolos" && b.edoc === "kering-blangko")).toBe(true);
  });
});

// ─── E. isi ulang ───────────────────────────────────────────────────────────

describe("E. isi ulang dari blob lama", () => {
  it("menyusun ulang tabel dari blob harian tunda dan putus; ulangan tidak menulis apa pun lagi", async () => {
    await simpanSetelan(d(), SUPER, { nyala: true, kering: true }, "");
    await jalankanTundaOtomatis(d(), { pemicu: "jadwal", tanggal: HARI, sumber: sumberTunda(async () => ({ ok: true, data: { ok: true, kering: true } })) });
    await simpanSetelanPutus(d(), SUPER, { nyala: true, kering: true }, "");
    const sumber = {
      async jadwal() {
        return { ok: true, galat: "", sidang: [barisJadwal("1")] };
      },
      async bahan() {
        return { ok: true, keadaan: { tanggalSidang: HARI, ditunda: "T", alasanDitunda: "0", sidangKeliling: "T", alurPerkaraId: 15, jenisPerkara: "Cerai Gugat" }, riwayat: { sidang: [sidangRiwayat(10, "2026-10-08", 4), { ...sidangRiwayat(1, HARI, null), ditunda: false, alasan: "" }], mediasi: null }, atasNama: { ok: true, namaLengkap: "Munifa" }, kalender: [], kunci: { aktif: false } };
      },
      async libur() {
        return petaLiburBerlaku();
      },
      async kehadiranRinci() {
        return [];
      },
      async statusPutusan() {
        return [{ id: 93, nama: "Gugur", dipakai: 41 }];
      },
      async tulisPutus() {
        return { ok: true, data: { ok: true } };
      },
      async edoc() {
        return { status: "kering-blangko" as const, pesan: "b", pada: "x" };
      },
    } as unknown as SumberPutusOtomatis;
    await detakPutusOtomatis(d(), { kini: new Date("2026-10-22T08:31:00Z"), sumber });
    const sebelum = await d().queryAll<Record<string, unknown>>("SELECT id, hasil, aturan FROM aleta_otomatis_jejak ORDER BY id");
    expect(sebelum.length).toBe(4);

    await d().run("DELETE FROM aleta_otomatis_jejak");
    aturUlangJejak();
    expect(await hitungJejak(d())).toBe(0);
    const r = await isiUlangJejakOtomatis(d());
    expect(r).toEqual({ hariTunda: 1, hariPutus: 1, baris: 4 });
    expect(await d().queryAll("SELECT id, hasil, aturan FROM aleta_otomatis_jejak ORDER BY id")).toEqual(sebelum);
    expect((await isiUlangJejakOtomatis(d())).baris).toBe(0);
  });

  it("pembentuk baris tahan butir tidak utuh (tidak melempar)", () => {
    expect(() =>
      barisDariTunda(HARI, null, { jadwalId: "9", perkaraId: "", nomorPerkara: "", jenisPerkara: "", tanggalSidang: HARI, agenda: "", majelis: "", panitera: "", keliling: false, keputusan: { jenis: "lewati", sebab: "sudah-ditunda", penjelasan: "x" } })
    ).not.toThrow();
    expect(() =>
      barisDariPutus(HARI, null, { jadwalId: "9", perkaraId: "", nomorPerkara: "", jenisPerkara: "", agenda: "", majelis: "", panitera: "", urutanSidang: 0, alurPerkaraId: null, keputusan: { jenis: "lewati", sebab: "eksekusi", penjelasan: "x" } })
    ).not.toThrow();
  });
});

// ─── F. rute laporan ────────────────────────────────────────────────────────

type Hasil = { status: number; isi: { ok: boolean; data: Record<string, any>; error?: { message: string } } };

async function panggil(cara: "GET" | "POST", opsi: { query?: string; badan?: unknown } = {}): Promise<Hasil> {
  const modul = await import("@/app/api/aleta-ecourt/otomatis-jejak/route");
  const req = new NextRequest("http://localhost/api/aleta-ecourt/otomatis-jejak" + (opsi.query ? "?" + opsi.query : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json" } : undefined,
    body: opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined,
  });
  const jawaban = await modul[cara](req);
  return { status: jawaban.status, isi: (await jawaban.json()) as Hasil["isi"] };
}

describe("F. rute laporan ketepatan", () => {
  it("tanpa sesi 401; hakim 403; Admin dan Super Admin 200", async () => {
    aktor = null;
    expect((await panggil("GET")).status).toBe(401);
    aktor = "usr-hakim";
    expect((await panggil("GET")).status).toBe(403);
    expect((await panggil("POST", { badan: { aksi: "isi-ulang" } })).status).toBe(403);
    for (const siapa of ["usr-admin", "usr-super"]) {
      aktor = siapa;
      const r = await panggil("GET");
      expect(r.status).toBe(200);
      expect(r.isi.data.tersedia).toBe(true);
    }
  });

  it("laporan: jejak kosong + riwayat harian lama terisi otomatis sekali; angka per aturan; saringan jenis dan rentang", async () => {
    await simpanSetelan(d(), SUPER, { nyala: true, kering: false }, "");
    await jalankanTundaOtomatis(d(), { pemicu: "jadwal", tanggal: new Date().toISOString().slice(0, 10), sumber: { ...sumberTunda(async () => ({ ok: false, galat: "ditolak penjaga" })), jadwal: async () => ({ ok: true, galat: "", sidang: [barisJadwal("1", { tanggalSidang: new Date().toISOString().slice(0, 10) })] }) } as SumberTundaOtomatis });
    await d().run("DELETE FROM aleta_otomatis_jejak");
    aturUlangJejak();
    const r = await panggil("GET", { query: "hari=30" });
    expect(r.status).toBe(200);
    expect(r.isi.data.diisiDariRiwayat).toMatchObject({ hariTunda: 1 });
    const tunda = (r.isi.data.aturan as Array<{ fitur: string; dicoba: number; ditolakPenjaga: number; persenLolos: number | null }>).filter((a) => a.fitur === "tunda");
    expect(tunda.reduce((s, a) => s + a.dicoba, 0)).toBe(1);
    expect(tunda.reduce((s, a) => s + a.ditolakPenjaga, 0)).toBe(1);
    expect(tunda[0].persenLolos).toBe(0);
    expect(r.isi.data.rincian[0]).toMatchObject({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", hasil: "ditolak" });
    const putusSaja = await panggil("GET", { query: "hari=30&fitur=putus" });
    expect(putusSaja.isi.data.aturan).toEqual([]);
    const sempit = await panggil("GET", { query: "hari=1" });
    expect(sempit.isi.data.hari).toBe(1);
    // POST isi-ulang
    const ulang = await panggil("POST", { badan: { aksi: "isi-ulang" } });
    expect(ulang.status).toBe(200);
    expect(ulang.isi.data).toMatchObject({ hariTunda: 1 });
    expect((await panggil("POST", { badan: { aksi: "hapus" } })).status).toBe(400);
  });

  it("migrasi belum dijalankan: jawaban jujur, bukan galat 500", async () => {
    const kosong = await createAletaDatabase({ useInMemory: true, seed: true });
    const asli = db;
    try {
      await kosong.run("DROP TABLE aleta_otomatis_jejak");
      db = kosong;
      const r = await panggil("GET");
      expect(r.status).toBe(200);
      expect(r.isi.data.tersedia).toBe(false);
      expect(String(r.isi.data.pesan)).toContain("0105");
    } finally {
      db = asli;
      await kosong.close();
    }
  });
});
