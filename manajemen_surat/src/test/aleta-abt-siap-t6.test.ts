// @vitest-environment node
/**
 * ============================================================================
 * SIAP DIPERIKSA (5 Nov 2026, Tahap 6) - PEKERJAAN PER PERAN DARI JADWAL SIDANG, DATA REKAAN
 * ============================================================================
 *   1. tiap peran hanya melihat pekerjaannya: hakim (putusan, penetapan), PP (BAS), panitera (minutasi, BHT, akta), juru sita (relaas);
 *   2. blangko yang disarankan memakai aturan saran yang sudah ada (tidak ada aturan baru), dan hanya yang ada di pustaka yang dapat diperiksa;
 *   3. peringatan "di luar tahapan" bagi Super Admin; hak folder hanya ikut bila matriks sudah disetujui;
 *   4. jadwal yang tidak terbaca dijawab apa adanya, bukan daftar kosong yang menyesatkan.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { GOLONGAN_ALUR, PERAN_ALUR, butirDariBaris, peranAlurDari, susunDaftarSiap } from "@/lib/aleta-abt-siap";
import { KUNCI_PERSETUJUAN_HAK_FOLDER, bacaKeadaanHakFolder, simpanPersetujuan } from "@/server/modules/aleta-abt-alur/hak-folder";
import { bacaDaftarSiap } from "@/server/modules/aleta-abt-siap/service";

const M = process.cwd();
const SQL_0133 = readFileSync(path.join(M, "drizzle/0133_aleta_abt_pustaka.sql"), "utf8");

const SIDANG_PUTUS = {
  sidangId: "9001",
  perkaraId: "123",
  nomorPerkara: "1/Pdt.G/2026/PA.Uji",
  jenisPerkara: "Cerai Gugat",
  jenisPerkaraId: 347,
  alurPerkaraId: 15,
  agenda: "Pembacaan putusan",
  tanggalSidang: "2026-11-05",
  urutanSidang: 1,
  dihadiriOleh: 2,
  ditunda: false,
  sudahPutus: false,
  panggilan: { tergugatPernahHadir: false, penggugatPernahHadir: true },
  tanggalMinutasi: "",
  tanggalBht: "",
  tanggalPutusan: "",
};
const PERMOHONAN = { ...SIDANG_PUTUS, sidangId: "9002", perkaraId: "124", nomorPerkara: "2/Pdt.P/2026/PA.Uji", jenisPerkara: "Itsbat Nikah", jenisPerkaraId: 360, alurPerkaraId: 16 };
const DIPUTUS = { ...SIDANG_PUTUS, sidangId: "9003", perkaraId: "125", nomorPerkara: "3/Pdt.G/2026/PA.Uji", sudahPutus: true, tanggalPutusan: "2026-10-20" };

describe("peran dan pekerjaannya", () => {
  it("hanya empat peran yang dikenal, masing-masing punya golongan ALETA", () => {
    expect(PERAN_ALUR).toEqual(["hakim", "pp", "panitera", "jurusita"]);
    expect(GOLONGAN_ALUR).toEqual({ hakim: "hakim", pp: "pp", panitera: "panitera", jurusita: "jurusita" });
    expect(peranAlurDari("hakim")).toBe("hakim");
    expect(peranAlurDari("admin")).toBeNull();
    expect(peranAlurDari("")).toBeNull();
  });
  it("hakim: putusan bagi gugatan, penetapan bagi permohonan; PP: BAS; juru sita: relaas; semuanya dengan saran blangko", () => {
    const hakim = butirDariBaris(SIDANG_PUTUS, "hakim");
    expect(hakim.map((b) => b.jenis)).toEqual(["putusan"]);
    expect(hakim[0].saran.length).toBeGreaterThan(0);
    expect(hakim[0].saran.length).toBeLessThanOrEqual(4);
    expect(butirDariBaris(PERMOHONAN, "hakim").map((b) => b.jenis)).toEqual(["penetapan"]);
    const pp = butirDariBaris(SIDANG_PUTUS, "pp");
    expect(pp.map((b) => b.jenis)).toEqual(["bas"]);
    expect(pp[0].saran[0].folder).toContain("BAS");
    expect(butirDariBaris(SIDANG_PUTUS, "jurusita").map((b) => b.jenis)).toEqual(["relaas"]);
  });
  it("saran diurutkan: yang disarankan lebih dulu", () => {
    const s = butirDariBaris(SIDANG_PUTUS, "pp")[0].saran;
    expect(s[0].utama).toBe(true);
  });
  it("panitera: minutasi, BHT, lalu akta cerai menurut keadaan putusan; belum diputus = tidak ada pekerjaan", () => {
    expect(butirDariBaris(SIDANG_PUTUS, "panitera")).toEqual([]);
    expect(butirDariBaris(DIPUTUS, "panitera").map((b) => b.jenis)).toEqual(["minutasi"]);
    expect(butirDariBaris({ ...DIPUTUS, tanggalMinutasi: "2026-10-22" }, "panitera").map((b) => b.jenis)).toEqual(["bht"]);
    expect(butirDariBaris({ ...DIPUTUS, tanggalMinutasi: "2026-10-22", tanggalBht: "2026-11-05" }, "panitera").map((b) => b.jenis)).toEqual(["akta"]);
    // bukan perkara cerai: tidak ada akta cerai
    expect(butirDariBaris({ ...DIPUTUS, jenisPerkara: "Itsbat Nikah", tanggalMinutasi: "x", tanggalBht: "y" }, "panitera")).toEqual([]);
    // panitera tidak punya saran blangko di pustaka
    expect(butirDariBaris(DIPUTUS, "panitera")[0].saran).toEqual([]);
  });
  it("baris tanpa perkara diabaikan; satu butir per perkara, pekerjaan, dan sidang; urut menurut tanggal lalu nomor", () => {
    const hasil = susunDaftarSiap([{}, SIDANG_PUTUS, SIDANG_PUTUS, { ...PERMOHONAN, tanggalSidang: "2026-11-04" }], "hakim");
    expect(hasil.jumlahBaris).toBe(4);
    expect(hasil.butir.map((b) => b.nomorPerkara)).toEqual(["2/Pdt.P/2026/PA.Uji", "1/Pdt.G/2026/PA.Uji"]);
  });
  it("tanpa data pribadi pihak: butir hanya membawa nomor perkara, jenis, tanggal, dan penanda", () => {
    const b = butirDariBaris({ ...SIDANG_PUTUS, pihak: { penggugat: [{ nama: "NAMA PIHAK REKAAN" }] }, namaPenggugat: "NAMA PIHAK REKAAN" }, "hakim");
    expect(JSON.stringify(b)).not.toContain("NAMA PIHAK REKAAN");
  });
});

// ─── layanan + pg-mem ───────────────────────────────────────────────────────────────────────────────────────────
async function siapkan() {
  const mem = newDb();
  mem.public.none(SQL_0133);
  mem.public.none("CREATE TABLE IF NOT EXISTS aleta_ekstensi_setelan (pengguna_id TEXT NOT NULL, kunci TEXT NOT NULL, nilai TEXT NOT NULL, diubah_pada TEXT NOT NULL, PRIMARY KEY (pengguna_id, kunci))");
  const { Client } = mem.adapters.createPg();
  const c = new Client();
  await c.connect();
  const ubah = (q: string) => {
    let n = 0;
    return q.replace(/\?/g, () => `$${++n}`);
  };
  const db = {
    queryAll: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows,
    queryOne: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows[0] ?? null,
    run: async (q: string, p: unknown[] = []) => {
      await c.query(ubah(q), p);
    },
  };
  const sekarang = "2026-11-05T00:00:00.000Z";
  const berkas = async (id: string, folder: string, nama: string) =>
    db.run("INSERT INTO aleta_abt_berkas (id, folder, nama, arsip, dibuat_at, diubah_at) VALUES (?, ?, ?, 0, ?, ?)", [id, folder, nama, sekarang, sekarang]);
  const menu = async (id: string, kolom: Record<string, string>) =>
    db.run(
      `INSERT INTO aleta_abt_menu (id, nama, parent_direktori, user_grup_id, user_top_id, user_validator, user_cek, proses_id_min, proses_id_max, perkara_id_min, perkara_id_max, perkara_id_referensi, dibuat_at, diubah_at)
       VALUES (?, ?, 'derry_briantono', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, id, kolom.grup, kolom.top, kolom.validator ?? null, kolom.cek, kolom.pmin, kolom.pmax, kolom.jmin, kolom.jmax, kolom.ref, sekarang, sekarang]
    );
  return { db: db as never, dbUji: db, berkas, menu, baca: async (q: string, p: unknown[] = []) => (await c.query(ubah(q), p)).rows as Array<Record<string, unknown>> };
}

const jadwalTiruan = (baris: Array<Record<string, unknown>>, ok = true) => async () => (ok ? { ok: true, data: { sidang: baris, keterangan: "" } } : { ok: false, error: "SIPP tidak terjangkau." });

describe("layanan daftar", () => {
  it("jadwal tidak terbaca: dijawab tersedia=false dengan sebabnya, bukan daftar kosong", async () => {
    const { db } = await siapkan();
    const h = await bacaDaftarSiap(db, { peran: "hakim", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([], false) });
    expect(h).toMatchObject({ tersedia: false, keterangan: "SIPP tidak terjangkau.", butir: [] });
  });

  it("blangko yang ada di pustaka diberi nomor pustaka; yang tidak ada ditandai", async () => {
    const { db, berkas } = await siapkan();
    const dasar = await bacaDaftarSiap(db, { peran: "pp", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([SIDANG_PUTUS]) });
    const saran0 = dasar.butir[0].saran[0];
    expect(saran0.diPustaka).toBe(false);
    await berkas("abt-bas-1", saran0.folder.replace(/^derry_briantono\//, ""), saran0.berkas);
    const h = await bacaDaftarSiap(db, { peran: "pp", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([SIDANG_PUTUS]) });
    expect(h.butir[0].saran[0]).toMatchObject({ diPustaka: true, berkasId: "abt-bas-1" });
    expect(h.butir[0].saran[1].diPustaka).toBe(false);
  });

  it("peringatan di luar tahapan: bila folder dibuka ABT pada tahapan lain; tanpa keadaan perkara tidak ada tebakan", async () => {
    const { db, menu, berkas } = await siapkan();
    const ref = await bacaDaftarSiap(db, { peran: "hakim", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([SIDANG_PUTUS]) });
    const s = ref.butir[0].saran[0];
    const folder = s.folder.replace(/^derry_briantono\//, "");
    await berkas("abt-put-1", folder, s.berkas);
    // Folder dibuka ABT pada proses 80-120 dan jenis 346 (cerai talak), sedangkan perkara ini cerai gugat dan berada di proses 200.
    await menu(folder, { grup: "1|10|20", top: "1", cek: "3", pmin: "80", pmax: "120", jmin: "346", jmax: "346", ref: "jenis_perkara_id" });
    const tanpaKeadaan = await bacaDaftarSiap(db, { peran: "hakim", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([{ ...SIDANG_PUTUS }]) });
    // jenis perkara ada di baris jadwal (347) -> jenis tidak sesuai walau tahapan belum diketahui? Tahapan dicek lebih dulu: null.
    expect(tanpaKeadaan.butir[0].saran[0].peringatan).toBe("");
    const dengan = await bacaDaftarSiap(db, { peran: "hakim", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([{ ...SIDANG_PUTUS, prosesTerakhirId: 200 }]) });
    expect(dengan.butir[0].saran[0].peringatan).toContain("tahapan");
    const sesuai = await bacaDaftarSiap(db, { peran: "hakim", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([{ ...SIDANG_PUTUS, prosesTerakhirId: 100, jenisPerkaraId: 346 }]) });
    expect(sesuai.butir[0].saran[0].peringatan).toBe("");
  });

  it("hak folder: belum berlaku sebelum disetujui; sesudah disetujui ikut tampil per golongan peran yang dilihat", async () => {
    const { db, menu, berkas } = await siapkan();
    const ref = await bacaDaftarSiap(db, { peran: "hakim", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([SIDANG_PUTUS]) });
    const s = ref.butir[0].saran[0];
    const folder = s.folder.replace(/^derry_briantono\//, "");
    await berkas("abt-put-1", folder, s.berkas);
    await menu(folder, { grup: "1|10|20", top: "1", cek: "3", pmin: "80", pmax: "297", jmin: "347", jmax: "347", ref: "jenis_perkara_id" });

    const sebelum = await bacaDaftarSiap(db, { peran: "hakim", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([SIDANG_PUTUS]) });
    expect(sebelum.hakFolder).toEqual({ berlaku: false, disetujui: false });
    expect(sebelum.butir[0].saran[0]).toMatchObject({ tingkatHak: "belum-berlaku", hakBoleh: null });

    const { matriks } = await bacaKeadaanHakFolder(db);
    await simpanPersetujuan(db, { id: "u1", name: "Derry" }, { setuju: true, sidik: matriks.sidik });

    const hakim = await bacaDaftarSiap(db, { peran: "hakim", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([SIDANG_PUTUS]) });
    expect(hakim.hakFolder.berlaku).toBe(true);
    expect(hakim.butir[0].saran[0]).toMatchObject({ tingkatHak: "ditunjuk", hakBoleh: null }); // hakim: bila ditunjuk; penunjukan belum diketahui
    // Peran lain yang dilihat: panitera pengganti tidak diberi hak atas folder putusan, bila saran blangko itu muncul untuknya.
    const pp = await bacaDaftarSiap(db, { peran: "pp", tanggal: "2026-11-05" }, { jadwal: jadwalTiruan([SIDANG_PUTUS]) });
    for (const x of pp.butir[0].saran) if (x.folder.replace(/^derry_briantono\//, "") === folder) expect(x.hakBoleh).toBe(false);
  });
});

describe("persetujuan matriks hak", () => {
  it("bawaan belum disetujui; menyetujui menuntut sidik yang sama; isi berubah = persetujuan gugur; dapat dicabut", async () => {
    const { db, menu, berkas } = await siapkan();
    await berkas("b1", "1 Perceraian CG", "[01] Putusan.rtf");
    await menu("1 Perceraian CG", { grup: "1|10|20", top: "1", cek: "3", pmin: "80", pmax: "297", jmin: "347", jmax: "347", ref: "jenis_perkara_id" });
    const awal = await bacaKeadaanHakFolder(db);
    expect(awal.berlaku).toBe(false);
    expect(awal.persetujuan.disetujui).toBe(false);
    expect(KUNCI_PERSETUJUAN_HAK_FOLDER).toBe("aleta_abt_hak_folder_setuju");

    await expect(simpanPersetujuan(db, { id: "u1", name: "Derry" }, { setuju: true, sidik: "salah" })).rejects.toMatchObject({ status: 409 });
    await expect(simpanPersetujuan(db, { id: "u1", name: "Derry" }, { setuju: true, sidik: "" })).rejects.toMatchObject({ status: 409 });

    await simpanPersetujuan(db, { id: "u1", name: "Derry" }, { setuju: true, sidik: awal.matriks.sidik });
    const sesudah = await bacaKeadaanHakFolder(db);
    expect(sesudah.berlaku).toBe(true);
    expect(sesudah.persetujuan).toMatchObject({ disetujui: true, oleh: "Derry" });

    // pustaka berubah: folder baru tanpa menu -> sidik berubah -> persetujuan lama tidak berlaku lagi
    await berkas("b2", "Folder baru", "[01] Baru.rtf");
    const berubah = await bacaKeadaanHakFolder(db);
    expect(berubah.matriks.sidik).not.toBe(awal.matriks.sidik);
    expect(berubah.persetujuan.disetujui).toBe(true);
    expect(berubah.berlaku).toBe(false);

    await simpanPersetujuan(db, { id: "u1", name: "Derry" }, { setuju: false, sidik: "" });
    expect((await bacaKeadaanHakFolder(db)).persetujuan.disetujui).toBe(false);
  });

  it("pustaka kosong tidak dapat disetujui", async () => {
    const { db } = await siapkan();
    const { matriks } = await bacaKeadaanHakFolder(db);
    await expect(simpanPersetujuan(db, { id: "u1", name: "Derry" }, { setuju: true, sidik: matriks.sidik })).rejects.toMatchObject({ status: 422 });
  });
});
