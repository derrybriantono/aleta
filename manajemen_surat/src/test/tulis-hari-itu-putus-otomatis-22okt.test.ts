// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SidangRiwayat } from "@/lib/bawaan-tunda";
import { bolehAksi } from "@/lib/matriks-peran";
import { bersihkanSetelanPutus, pilihStatusPutusan, putuskanPutusOtomatis } from "@/lib/putus-otomatis";
import type { MasukanTundaOtomatis } from "@/lib/tunda-otomatis";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import {
  bacaCatatanHariPutus,
  blangkoUntuk,
  detakPutusOtomatis,
  pemberitahuanPutusOtomatis,
  simpanSetelanPutus,
  tandaiBatalPutus,
  type SumberPutusOtomatis,
} from "@/server/modules/putus-otomatis/layanan";
import { petaLiburBerlaku } from "@/lib/hari-libur";

/**
 * 22 Okt 2026 - (1) tunda & keterangan putus ditulis HARI ITU (tidak pernah
 * diantrekan ke hari berikutnya), jenis tulisan lain tetap aturan lama;
 * (2) saklar putus otomatis gugur / tidak dapat diterima.
 */

const require_ = createRequire(import.meta.url);
const AKAR_BOT = path.resolve(process.env.ALETA_UJI_AKAR_BOT || path.resolve(process.cwd(), "../aleta_bot"));
const HARI = "2026-10-22";

// ============================================================================
// 1. TULIS HARI ITU
// ============================================================================

describe("tunda & keterangan putus tidak pernah pindah hari", () => {
  const { buatLayanan } = require_(path.join(AKAR_BOT, "services/antreanTulisSippService.js"));
  const layananPada = (jam: string, kueri: Array<[string, unknown[]]>, baris: Record<string, unknown>[] = []) =>
    buatLayanan({
      db: {
        query: async (sql: string, p: unknown[] = []) => {
          kueri.push([sql, p]);
          if (sql.includes("SELECT id, jenis, muatan")) return baris;
          if (sql.includes("SELECT percobaan")) return [{ percobaan: 1 }];
          return sql.trim().startsWith("UPDATE") ? { affectedRows: 1 } : { affectedRows: 1, insertId: 9 };
        },
      },
      sekarang: () => jam,
      aktif: () => true,
      libur: () => null,
    });

  it("sesudah jam kerja: tunda/putus langsung ditulis (tanpa pertanyaan, tanpa antrean ke besok)", async () => {
    for (const jenis of ["sidang-tunda", "sidang-putus"]) {
      const kueri: Array<[string, unknown[]]> = [];
      const l = layananPada("2026-10-22 17:10:00", kueri);
      expect(await l.gerbangManual({ badan: { kering: false, tanyaJamKerja: true }, jenis, kunci: `${jenis}:1`, muatan: {} })).toBeNull();
      expect(await l.gerbangManual({ badan: { kering: false, jamKerja: "antrekan" }, jenis, kunci: `${jenis}:1`, muatan: {} })).toBeNull();
      expect(kueri.some(([s]) => s.includes("INSERT INTO aleta_bot_antrean_tulis_sipp"))).toBe(false);
    }
  });

  it("pagi sebelum jam kerja: ditanya dengan bawaan TULIS SEKARANG; antrean hanya hari itu", async () => {
    const kueri: Array<[string, unknown[]]> = [];
    const l = layananPada("2026-10-22 06:40:00", kueri);
    const g = await l.gerbangManual({ badan: { kering: false, tanyaJamKerja: true }, jenis: "sidang-putus", kunci: "sidang-putus:1", muatan: {} });
    expect(g.body).toMatchObject({ perluPilihan: true, bawaan: "sekarang" });
    expect(g.body.pilihan[0]).toMatchObject({ nilai: "sekarang", bawaan: true });
    const a = await l.gerbangManual({ badan: { kering: false, jamKerja: "antrekan" }, jenis: "sidang-putus", kunci: "sidang-putus:1", muatan: {} });
    expect(a.body.diantrekan).toBe(true);
    expect(String(a.body.dikerjakanPada).slice(0, 10)).toBe(HARI);
  });

  it("jenis lain (Kasir, penetapan) tetap aturan lama: ditanya dengan bawaan Antrekan ke jam kerja berikutnya", async () => {
    const kueri: Array<[string, unknown[]]> = [];
    const l = layananPada("2026-10-22 17:10:00", kueri);
    const g = await l.gerbangManual({ badan: { kering: false, tanyaJamKerja: true }, jenis: "kasir-manual", kunci: "kasir-manual:1", muatan: {} });
    expect(g.body.pilihan[0]).toMatchObject({ nilai: "antrekan", bawaan: true });
    expect(String(g.body.dikerjakanPada).slice(0, 10)).toBe("2026-10-23");
  });

  it("baris tunda/putus yang gilirannya jatuh di hari lain digagalkan 'lewat_hari', tidak ditulis besok", async () => {
    const kueri: Array<[string, unknown[]]> = [];
    let dipanggil = 0;
    const l = layananPada("2026-10-23 08:00:00", kueri, [{ id: 5, jenis: "sidang-tunda", muatan: "{}", dibuat: "2026-10-22" }]);
    l.daftarkanPelaksana("sidang-tunda", async () => {
      dipanggil += 1;
      return { ok: true };
    });
    const r = await l.kerjakanSatu();
    expect(r).toMatchObject({ dikerjakan: true, ok: false, status: "gagal" });
    expect(dipanggil).toBe(0);
    const gagal = kueri.find(([s]) => s.includes("SET status = 'gagal'"))!;
    expect(String(gagal[1][1])).toContain("lewat_hari");
    // Kasir dari kemarin tetap dikerjakan seperti dulu.
    const k2: Array<[string, unknown[]]> = [];
    let kasir = 0;
    const l2 = layananPada("2026-10-23 08:00:00", k2, [{ id: 6, jenis: "kasir-otomatis", muatan: "{}", dibuat: "2026-10-22" }]);
    l2.daftarkanPelaksana("kasir-otomatis", async () => ((kasir += 1), { ok: true }));
    expect((await l2.kerjakanSatu()).ok).toBe(true);
    expect(kasir).toBe(1);
  });

  it("tunda otomatis menulis saat jam pemicu (jamKerja sekarang); layar tunda/putus berbawaan Tulis sekarang", () => {
    const tunda = readFileSync(path.resolve(process.cwd(), "src/server/modules/tunda-otomatis/layanan.ts"), "utf8");
    expect(tunda).toContain('jamKerja: "sekarang"');
    expect(tunda).not.toContain('jamKerja: "antrekan"');
    const hasil = readFileSync(path.resolve(process.cwd(), "src/components/portal/hasil-sidang.tsx"), "utf8");
    expect(hasil.match(/<TanyaJamKerja [^>]*bawaan="sekarang"/g)?.length).toBe(2);
    const massal = readFileSync(path.resolve(process.cwd(), "src/components/portal/jadwal-keliling-hakim.tsx"), "utf8");
    expect(massal).toMatch(/<TanyaJamKerja [^>]*bawaan="sekarang"/);
  });
});

// ============================================================================
// 2. ATURAN PUTUS OTOMATIS
// ============================================================================

const sidang = (id: number, tanggal: string, dihadiriOleh: number | null): SidangRiwayat => ({ jadwalId: id, tanggal, agenda: "Sidang", ditunda: true, alasan: "x", dihadiriOleh, ikrar: false });
const ini = (id = 100): SidangRiwayat => ({ ...sidang(id, HARI, null), ditunda: false, alasan: "" });
const masukan = (u: Partial<MasukanTundaOtomatis> = {}): MasukanTundaOtomatis => ({
  hariIni: HARI,
  jadwalId: 100,
  perkaraId: 9,
  nomorPerkara: "600/Pdt.G/2026/PA.Dgl",
  jenisPerkara: "Cerai Gugat",
  alurPerkaraId: 15,
  tanggalSidang: HARI,
  agenda: "Sidang",
  ditunda: false,
  alasanDitunda: "0",
  riwayat: [sidang(90, "2026-10-08", 4), ini()],
  kalender: [],
  ppJelas: true,
  ...u,
});
const BAWAAN = bersihkanSetelanPutus({});

describe("aturan putus otomatis", () => {
  it("bawaan: MATI, mode kering, aturan 8 = tidak dapat diterima, unggah e-Doc aktif bila saklar menyala", () => {
    expect(BAWAAN).toMatchObject({ nyala: false, kering: true, hasilAturan8: "tidak-dapat-diterima", unggahEdoc: true, jam: "16:30" });
  });
  it("tidak hadir sidang 1 & 2 -> gugur; hadir sidang 1 lalu 2x tidak hadir -> tidak dapat diterima (dapat diganti gugur)", () => {
    expect(putuskanPutusOtomatis(masukan(), BAWAAN)).toMatchObject({ jenis: "putus", status: "gugur", nomorAturan: 7, kehadiran: 4 });
    const r8 = masukan({ riwayat: [sidang(80, "2026-10-01", 1), sidang(90, "2026-10-08", 4), ini()] });
    expect(putuskanPutusOtomatis(r8, BAWAAN)).toMatchObject({ jenis: "putus", status: "tidak-dapat-diterima", nomorAturan: 8 });
    expect(putuskanPutusOtomatis(r8, { hasilAturan8: "gugur" })).toMatchObject({ jenis: "putus", status: "gugur", nomorAturan: 8 });
  });
  it("tidak pernah untuk pihak yang tercatat hadir hari itu, ikrar, verzet, eksekusi, Court Calendar tanpa bukti absen", () => {
    expect(putuskanPutusOtomatis(masukan({ hadirRinciPertama: true }), BAWAAN)).toMatchObject({ jenis: "lewati", sebab: "hadir-tercatat" });
    expect(putuskanPutusOtomatis(masukan({ dihadiriOlehSekarang: 2 }), BAWAAN).jenis).toBe("lewati");
    expect(putuskanPutusOtomatis(masukan({ antrian: { hadirPihak1: true, hadirPihak2: false } }), BAWAAN).jenis).toBe("lewati");
    expect(putuskanPutusOtomatis(masukan({ ikrar: true }), BAWAAN).jenis).toBe("lewati");
    expect(putuskanPutusOtomatis(masukan({ verzet: true }), BAWAAN).jenis).toBe("lewati");
    expect(putuskanPutusOtomatis(masukan({ jenisPerkara: "Eksekusi Hak Tanggungan" }), BAWAAN)).toMatchObject({ jenis: "lewati", sebab: "eksekusi" });
    expect(putuskanPutusOtomatis(masukan({ kalender: [{ tanggal: "2026-10-29" }] }), BAWAAN).jenis).toBe("lewati");
    expect(putuskanPutusOtomatis(masukan({ dibatalkan: { oleh: "Derry", pada: "x" } }), BAWAAN)).toMatchObject({ jenis: "lewati", sebab: "dibatalkan-petugas" });
  });
  it("status SIPP: yang paling sering dipakai satker; blangko Derry yang pas atau tidak ada", () => {
    const daftar = [
      { id: 62, nama: "Dikabulkan", dipakai: 900 },
      { id: 65, nama: "Digugurkan", dipakai: 39 },
      { id: 93, nama: "Gugur", dipakai: 41 },
      { id: 64, nama: "Tidak Dapat Diterima", dipakai: 48 },
    ];
    expect(pilihStatusPutusan(daftar, "gugur")).toEqual({ id: 93, nama: "Gugur" });
    expect(pilihStatusPutusan(daftar, "tidak-dapat-diterima")).toEqual({ id: 64, nama: "Tidak Dapat Diterima" });
    const b = { jenisPerkara: "Cerai Gugat", nomorPerkara: "600/Pdt.G/2026/PA.Dgl", urutanSidang: 2, alurPerkaraId: 15 };
    expect(blangkoUntuk(b, "gugur")?.berkas).toMatch(/\[98\] \[Gugur\]/);
    expect(blangkoUntuk({ ...b, jenisPerkara: "Jenis Tak Dikenal" }, "gugur")).toBeNull();
  });
});

// ============================================================================
// 3. LAYANAN PUTUS OTOMATIS
// ============================================================================

describe("layanan putus otomatis (basis data dalam memori)", () => {
  let db: AletaDatabase;
  let tulis: Record<string, unknown>[];
  let edoc: Array<{ kering: boolean; status: string }>;
  const SUPER = { id: "u-super", name: "Derry Briantono" };
  const baris = (sidangId: string, u: Record<string, unknown> = {}) => ({
    sidangId,
    perkaraId: `${sidangId}`,
    nomorPerkara: `${sidangId}/Pdt.G/2026/PA.Dgl`,
    jenisPerkara: "Cerai Gugat",
    alurPerkaraId: 15,
    tanggalSidang: HARI,
    agenda: "Sidang",
    ditunda: false,
    alasanDitunda: "0",
    sudahPutus: false,
    sidangIkrarTalak: false,
    majelisNama: "Derry Briantono",
    paniteraNama: "Munifa",
    ...u,
  });
  const sumber = (tanggal = HARI): SumberPutusOtomatis => ({
    async jadwal() {
      return { ok: true, galat: "", sidang: [baris("1", { tanggalSidang: tanggal }), baris("2", { tanggalSidang: tanggal }), baris("3", { tanggalSidang: tanggal, ditunda: true })] };
    },
    async bahan(id) {
      const riwayat = id === "1" ? [sidang(10, "2026-10-08", 4), { ...ini(1), tanggal }] : [sidang(19, "2026-10-01", 1), sidang(20, "2026-10-08", 4), { ...ini(2), tanggal }];
      return { ok: true, keadaan: { tanggalSidang: tanggal, ditunda: "T", alasanDitunda: "0", sidangKeliling: "T", alurPerkaraId: 15, jenisPerkara: "Cerai Gugat" }, riwayat: { sidang: riwayat, mediasi: null }, atasNama: { ok: true, namaLengkap: "Munifa" }, kalender: [], kunci: { aktif: false } };
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
    async tulisPutus(isi) {
      tulis.push(isi);
      return { ok: true, data: { ok: true, atasNama: { namaLengkap: "Munifa" } } };
    },
    async edoc(_db, _b, status, _s, kering) {
      edoc.push({ kering, status });
      return { status: kering ? "kering-blangko" : "dijadwalkan", pesan: "blangko", pada: "x" };
    },
  });
  const cocok = (nama: string, teks: string) => teks.includes(nama);

  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true });
  });
  beforeEach(async () => {
    tulis = [];
    edoc = [];
    await db.run("DELETE FROM aleta_ekstensi_setelan WHERE pengguna_id = ?", ["*sistem*"]);
  });

  it("saklar MATI: tidak ada daftar pagi, tidak ada tulisan", async () => {
    expect(await detakPutusOtomatis(db, { kini: new Date("2026-10-22T08:31:00Z"), sumber: sumber() })).toBeNull();
    expect(tulis).toEqual([]);
  });

  it("pagi 07.05: calon disusun + pemberitahuan mendesak majelis/PP; 'jangan putus otomatis' menahan satu perkara", async () => {
    await simpanSetelanPutus(db, SUPER, { nyala: true, kering: false }, "192.168.10.21");
    await detakPutusOtomatis(db, { kini: new Date("2026-10-21T23:05:00Z"), sumber: sumber() });
    const c = await bacaCatatanHariPutus(db, HARI);
    expect(c.pagi?.butir.map((b) => [b.jadwalId, b.keputusan.jenis === "putus" && b.keputusan.status])).toEqual([
      ["1", "gugur"],
      ["2", "tidak-dapat-diterima"],
    ]);
    const p = await pemberitahuanPutusOtomatis(db, { nama: "Munifa", lihatSemua: false, cocokNama: cocok, kini: new Date("2026-10-22T00:00:00Z") });
    expect(p[0]).toMatchObject({ penting: true });
    expect(p[0].judul).toContain("Akan diputus otomatis pukul 16.30 bila tidak hadir");
    expect((await pemberitahuanPutusOtomatis(db, { nama: "Orang Lain", lihatSemua: false, cocokNama: cocok, kini: new Date("2026-10-22T00:00:00Z") })).length).toBe(0);
    await tandaiBatalPutus(db, { tanggal: HARI, jadwalId: "2", oleh: "u1", nama: "Munifa", batal: true });
    await detakPutusOtomatis(db, { kini: new Date("2026-10-22T08:31:00Z"), sumber: sumber() });
    expect(tulis.map((t) => t.jadwalId)).toEqual(["1"]);
  });

  it("MENYALA: keterangan putus lewat penulis putus yang ada (atas PP, otomatis, hari itu), lalu e-Doc dijadwalkan; tidak dobel", async () => {
    await simpanSetelanPutus(db, SUPER, { nyala: true, kering: false }, "192.168.10.21");
    await detakPutusOtomatis(db, { kini: new Date("2026-10-22T08:31:00Z"), sumber: sumber() });
    expect(tulis[0]).toMatchObject({ jadwalId: "1", statusPutusanId: 93, tanggalPutus: HARI, verstek: "T", dihadiriOleh: 4, kering: false, otomatis: true, tanggalSidangHarap: HARI, jamKerja: "sekarang", ip: "192.168.10.21" });
    expect(tulis[1]).toMatchObject({ jadwalId: "2", statusPutusanId: 64 });
    for (const t of tulis) {
      expect(t).not.toHaveProperty("tulisPutusan");
      expect(JSON.stringify(t).toLowerCase()).not.toContain("aleta");
    }
    expect(edoc).toEqual([
      { kering: false, status: "gugur" },
      { kering: false, status: "tidak-dapat-diterima" },
    ]);
    await detakPutusOtomatis(db, { kini: new Date("2026-10-22T08:36:00Z"), sumber: sumber() });
    expect(tulis).toHaveLength(2);
    const c = await bacaCatatanHariPutus(db, HARI);
    expect(c.jalan).toMatchObject({ mode: "tulis", jam: "16:30", hasilAturan8: "tidak-dapat-diterima", unggahEdoc: true });
  });

  it("MODE KERING: dikirim kering, e-Doc hanya memeriksa blangko; hari keliling aktif jalan 14.00 sekali", async () => {
    await simpanSetelanPutus(db, SUPER, { nyala: true, kering: true }, "");
    const TGL = "2026-10-29";
    await db.run("INSERT INTO aleta_sidang_keliling_hari (tanggal, aktif, diubah_oleh, diubah_nama, diubah_pada) VALUES (?, ?, ?, ?, ?)", [TGL, 1, "u1", "Derry", "x"]);
    expect(await detakPutusOtomatis(db, { kini: new Date("2026-10-29T06:01:00Z"), sumber: sumber(TGL) })).not.toBeNull();
    expect(tulis.every((t) => t.kering === true)).toBe(true);
    expect(edoc.every((e) => e.kering)).toBe(true);
    const n = tulis.length;
    await detakPutusOtomatis(db, { kini: new Date("2026-10-29T08:31:00Z"), sumber: sumber(TGL) });
    expect(tulis.length).toBe(n);
    expect((await bacaCatatanHariPutus(db, TGL)).jalan?.jam).toBe("14:00");
  });
});

// ============================================================================
// 4. PENJAGA BOT, HAK, RUTE
// ============================================================================

describe("penjaga dan hak", () => {
  it("bot: putus otomatis membaca ulang, menolak pihak tercatat hadir, verzet/eksekusi, dan Putusan Akhir", () => {
    const hasil = readFileSync(path.join(AKAR_BOT, "services/sidangHasilService.js"), "utf8");
    const i = hasil.indexOf("if (minta.otomatis === true) {\n    if (minta.tulisPutusan === true)");
    expect(i).toBeGreaterThan(0);
    const blok = hasil.slice(i, i + 1200);
    for (const k of ["putus_otomatis_tanpa_putusan_akhir", "penjagaTundaOtomatis(keadaan, minta)", "putus_otomatis_dilewati_jenis", "pihak_tercatat_hadir"]) expect(blok).toContain(k);
    const rute = readFileSync(path.join(AKAR_BOT, "routes/internalGatewayRoutes.js"), "utf8");
    expect(rute).toContain('manualJamKerja("sidang-putus", (b) => (b.otomatis === true ? `otomatis:${String(b.jadwalId || "")}`');
  });
  it("saklar putus otomatis hanya Super Admin; pilih hakim per perkara hanya Admin & Super Admin", () => {
    const rute = readFileSync(path.resolve(process.cwd(), "src/app/api/aleta-ecourt/putus-otomatis/route.ts"), "utf8");
    expect(rute.indexOf("if (!bolehMenyuntingAkses(aktor)) throw new ApiError(403")).toBeLessThan(rute.indexOf("await simpanSetelanPutus("));
    const orang = (roleId: string) => ({ roleId, additionalRoleIds: [], positionId: "" }) as never;
    for (const r of ["admin", "super-admin"]) expect(bolehAksi(orang(r), "sidang.pilih-hakim"), r).toBe(true);
    for (const r of ["hakim", "ketua", "panitera-pengganti"]) expect(bolehAksi(orang(r), "sidang.pilih-hakim"), r).toBe(false);
  });
});
