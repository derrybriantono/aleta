// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { DataSkpJabatan, FaktaAkunSkp, KejadianSkp } from "@/lib/skp-jabatan-tipe";
import { susunPeriodeSkpJabatan } from "@/lib/eviden-skp-unduh";
import { createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { ApiError } from "@/server/shared/errors";

vi.mock("@/server/modules/aleta-ecourt/eviden-skp-data", () => ({
  ambilDataSkpJabatan: vi.fn(),
  ambilDataEvidenSkpPeriode: vi.fn(),
}));

const { ambilDataSkpJabatan } = await import("@/server/modules/aleta-ecourt/eviden-skp-data");
const { bacaAktorSkp, bacaKeadaanPegawai, daftarKeadaanPegawai } = await import("@/server/modules/skp/pegawai");
const { akunTertautPegawai, bacaPemetaan, simpanPemetaan } = await import("@/server/modules/skp/pemetaan");
const { bacaTarget, simpanTarget } = await import("@/server/modules/skp/target");
const { ajukanIsian, bacaIsian, simpanIsian, tinjauIsian } = await import("@/server/modules/skp/isian");
const { siapkanSkp } = await import("@/server/modules/skp/lembar");
const { simpanPenetapan, bacaPenetapan } = await import("@/server/modules/skp/penetapan");
const { hakPegawai } = await import("@/server/modules/skp/pegawai");
const ambilBot = vi.mocked(ambilDataSkpJabatan);

/**
 * ============================================================================
 * LAYANAN SKP JABATAN ATAS PG-MEM BERBENIH
 * ============================================================================
 *
 * Pemetaan akun-pegawai bertanggal, tautan tersirat, target, isian manual
 * (draf -> diajukan -> disetujui), penyiapan Lembar SKP (hak SEBELUM bot,
 * pemotongan kejadian menurut tanggal berlaku akun bersama), dan penetapan
 * terkunci. Yang ditiru hanya bot (ambilDataSkpJabatan).
 */

let db: AletaDatabase;

beforeAll(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function profil(userId: string, idProfil: string, atasanProfil: string | null) {
  const u = await db.queryOne<{ name: string; nip: string | null }>("SELECT name, nip FROM users WHERE id = ?", [userId]);
  await db.run(
    `INSERT INTO employee_profiles (id, user_id, nip, full_name, rank_grade, is_active, supervisor_employee_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, '2026-01-01', '2026-01-01')`,
    [idProfil, userId, `nip-${userId}`, u!.name, "Penata / III.c", atasanProfil]
  );
}

beforeEach(async () => {
  await db.run("UPDATE employee_profiles SET supervisor_employee_id = NULL");
  for (const t of ["aleta_skp_akun_pegawai", "aleta_skp_target", "aleta_skp_isian", "aleta_skp_penetapan", "employee_profiles", "external_app_credentials"]) {
    await db.run(`DELETE FROM ${t}`);
  }
  await db.run("DELETE FROM audit_logs");
  ambilBot.mockReset();
  // Bagan: Ketua <- Panitera <- (PP, Panmud Gugatan, Rina, Budi); Ketua <- Hakim.
  await profil("usr-ketua", "pf-ketua", null);
  await profil("usr-panitera", "pf-panitera", "pf-ketua");
  await profil("usr-ppg", "pf-ppg", "pf-panitera");
  await profil("usr-gugatan", "pf-gugatan", "pf-panitera");
  await profil("usr-hakim", "pf-hakim", "pf-ketua");
  await profil("usr-rina", "pf-rina", "pf-gugatan");
  await profil("usr-budi", "pf-budi", "pf-gugatan");
});

const aktorDari = async (userId: string) => (await bacaAktorSkp(db, userId)).aktor;

describe("pegawai dan jabatan", () => {
  it("PP: jabatan dari posisi ALETA, atasan langsung dari profil, pangkat dari profil", async () => {
    const k = await bacaKeadaanPegawai(db, "usr-ppg");
    expect(k).toMatchObject({
      userId: "usr-ppg",
      jabatanUtama: "pp",
      jabatanTambahan: [],
      atasanLangsungUserId: "usr-panitera",
      pangkatGolongan: "Penata / III.c",
    });
    expect(k!.atasanNama).toBeTruthy();
    expect(k!.jenisTersedia).toContain("pp");
  });

  it("Ketua vs Wakil mengikuti peran ALETA walau pemetaan menulis yang lain", async () => {
    await simpanPemetaan(db, await aktorDari("usr-super"), {
      usernameSipp: "wakil",
      userId: "usr-wakil",
      jabatanUtama: "ketua",
      berlakuDari: "2026-01-01",
    });
    const wakil = await bacaKeadaanPegawai(db, "usr-wakil");
    expect(wakil!.jabatanUtama).toBe("wakil-ketua");
    const ketua = await bacaKeadaanPegawai(db, "usr-ketua");
    expect(ketua!.jabatanUtama).toBe("ketua");
    expect(ketua!.jenisTersedia).toEqual(expect.arrayContaining(["hakim", "pimpinan"]));
    expect(ketua!.jenisTersedia).not.toContain("ketua");
  });

  it("rangkap: pemetaan Panitera + tambahan PP dikenali; jabatan yang sama tidak ganda", async () => {
    await simpanPemetaan(db, await aktorDari("usr-super"), {
      usernameSipp: "panitera",
      userId: "usr-panitera",
      jabatanUtama: "panitera",
      jabatanTambahan: ["pp", "panitera"],
      berlakuDari: "2026-01-01",
    });
    const k = await bacaKeadaanPegawai(db, "usr-panitera", { mulai: "2026-07-01", selesai: "2026-09-30" });
    expect(k).toMatchObject({ jabatanUtama: "panitera", jabatanTambahan: ["pp"] });
    expect(k!.jenisTersedia).toEqual(expect.arrayContaining(["panitera", "pp"]));
  });

  it("daftar semua pegawai memuat atasan langsung tiap orang", async () => {
    const semua = await daftarKeadaanPegawai(db);
    const rina = semua.find((p) => p.userId === "usr-rina");
    expect(rina?.atasanLangsungUserId).toBe("usr-gugatan");
    expect(semua.find((p) => p.userId === "usr-ketua")?.atasanLangsungUserId).toBeNull();
  });
});

describe("pemetaan akun SIPP ke pegawai", () => {
  it("hanya Panitera, Ketua, Super Admin, Admin yang boleh memetakan", async () => {
    const dasar = { usernameSipp: "kasir1", userId: "usr-rina", jabatanUtama: "kasir", berlakuDari: "2026-01-01" };
    for (const id of ["usr-hakim", "usr-wakil", "usr-rina"]) {
      await expect(simpanPemetaan(db, await aktorDari(id), dasar)).rejects.toMatchObject({ status: 403 });
    }
    for (const id of ["usr-panitera", "usr-ketua", "usr-super", "usr-admin"]) {
      const hasil = await simpanPemetaan(db, await aktorDari(id), { ...dasar, usernameSipp: `kasir-${id}` });
      expect(hasil).toMatchObject({ userId: "usr-rina", jabatanUtama: "kasir", berlakuSampai: null, dikonfirmasiOlehId: id });
    }
  });

  it("satu akun tidak boleh ditautkan ke dua pegawai pada tanggal yang bertumpang", async () => {
    const pn = await aktorDari("usr-panitera");
    await simpanPemetaan(db, pn, { usernameSipp: "Kasir1", userId: "usr-rina", jabatanUtama: "kasir", berlakuDari: "2026-01-01", berlakuSampai: "2026-08-31" });
    await expect(
      simpanPemetaan(db, pn, { usernameSipp: "kasir1", userId: "usr-budi", jabatanUtama: "kasir", berlakuDari: "2026-08-15" })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("sudah ditautkan ke") });
    // Berurutan tanpa tumpang tindih: boleh (huruf besar-kecil tidak membedakan akun).
    const budi = await simpanPemetaan(db, pn, { usernameSipp: "kasir1", userId: "usr-budi", jabatanUtama: "kasir", berlakuDari: "2026-09-01" });
    expect(budi.berlakuSampai).toBeNull();
    expect((await bacaPemetaan(db, { usernameSipp: "KASIR1" })).length).toBe(2);
  });

  it("mengubah tautan sendiri tidak dianggap bertabrakan; tautan kembar milik orang yang sama ditolak", async () => {
    const pn = await aktorDari("usr-panitera");
    const a = await simpanPemetaan(db, pn, { usernameSipp: "meja3", userId: "usr-rina", jabatanUtama: "petugas-meja", berlakuDari: "2026-01-01" });
    const diubah = await simpanPemetaan(db, pn, { id: a.id, usernameSipp: "meja3", userId: "usr-rina", jabatanUtama: "petugas-meja", berlakuDari: "2026-01-01", berlakuSampai: "2026-06-30" });
    expect(diubah).toMatchObject({ id: a.id, berlakuSampai: "2026-06-30" });
    await expect(
      simpanPemetaan(db, pn, { usernameSipp: "meja3", userId: "usr-rina", jabatanUtama: "petugas-meja", berlakuDari: "2026-03-01" })
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("bertumpang") });
  });

  it("masukan salah ditolak 400/404 dengan kalimat yang jelas", async () => {
    const pn = await aktorDari("usr-panitera");
    const dasar = { usernameSipp: "x", userId: "usr-rina", jabatanUtama: "kasir", berlakuDari: "2026-01-01" };
    const kasus: Array<[Record<string, unknown>, number, RegExp]> = [
      [{ usernameSipp: "  " }, 400, /akun SIPP/],
      [{ userId: "tidak-ada" }, 404, /Pegawai/],
      [{ jabatanUtama: "tukang" }, 400, /Jabatan utama/],
      [{ jabatanTambahan: ["tukang"] }, 400, /tambahan/],
      [{ berlakuDari: "2026-02-30" }, 400, /mulai berlaku/],
      [{ berlakuSampai: "31-12-2026" }, 400, /berakhir/],
      [{ berlakuSampai: "2025-12-31" }, 400, /sebelum/],
    ];
    for (const [ubah, status, pesan] of kasus) {
      await expect(simpanPemetaan(db, pn, { ...dasar, ...ubah } as never)).rejects.toMatchObject({ status, message: expect.stringMatching(pesan) });
    }
  });

  it("menyimpan tercatat di jejak audit", async () => {
    await simpanPemetaan(db, await aktorDari("usr-panitera"), { usernameSipp: "kasir1", userId: "usr-rina", jabatanUtama: "kasir", berlakuDari: "2026-01-01" });
    const baris = await db.queryAll<{ actor_user_id: string; payload_json: string }>("SELECT actor_user_id, payload_json FROM audit_logs WHERE action = 'SKP_PEMETAAN_SIMPAN'");
    expect(baris.length).toBe(1);
    expect(baris[0].actor_user_id).toBe("usr-panitera");
    expect(JSON.parse(baris[0].payload_json)).toMatchObject({ usernameSipp: "kasir1", userId: "usr-rina", baru: true });
  });
});

describe("akun SIPP yang dipegang pegawai pada periode", () => {
  it("pemetaan bertanggal: hanya yang bertumpang dengan periode", async () => {
    const pn = await aktorDari("usr-panitera");
    await simpanPemetaan(db, pn, { usernameSipp: "kasir1", userId: "usr-rina", jabatanUtama: "kasir", berlakuDari: "2026-01-01", berlakuSampai: "2026-08-31" });
    const tw3 = await akunTertautPegawai(db, "usr-rina", "2026-07-01", "2026-09-30");
    expect(tw3.akun.map((a) => a.username)).toEqual(["kasir1"]);
    expect(tw3.akun[0].jendela).toEqual([{ dari: "2026-01-01", sampai: "2026-08-31" }]);
    const tw4 = await akunTertautPegawai(db, "usr-rina", "2026-10-01", "2026-12-31");
    expect(tw4.akun).toEqual([]);
    expect(tw4.catatanOperator[0]).toMatch(/isi indikator secara manual/);
  });

  it("tanpa pemetaan: tautan akun di profil dipakai bila tidak dipakai orang lain", async () => {
    await db.run(
      `INSERT INTO external_app_credentials (id, user_id, app_id, external_username, created_at, updated_at)
       VALUES ('c1', 'usr-ppg', 'sipp', 'pp.satu', '2026-01-01', '2026-01-01')`
    );
    const t = await akunTertautPegawai(db, "usr-ppg", "2026-07-01", "2026-09-30");
    expect(t.akun).toEqual([{ username: "pp.satu", userIdSipp: "", jendela: [{ dari: "1900-01-01", sampai: null }], tersirat: true }]);
  });

  it("akun profil yang sama di dua pegawai TIDAK dipakai sampai dipetakan (kerja orang lain tidak terhitung dua kali)", async () => {
    for (const [id, u] of [["c1", "usr-rina"], ["c2", "usr-budi"]]) {
      await db.run(
        `INSERT INTO external_app_credentials (id, user_id, app_id, external_username, created_at, updated_at)
         VALUES (?, ?, 'sipp', 'Kasir1', '2026-01-01', '2026-01-01')`,
        [id, u]
      );
    }
    const t = await akunTertautPegawai(db, "usr-rina", "2026-07-01", "2026-09-30");
    expect(t.akun).toEqual([]);
    expect(t.catatanOperator[0]).toContain('"Kasir1"');
    expect(t.catatanOperator[0]).toMatch(/Pemetaan/);
  });

  it("tanpa akun sama sekali: catatan untuk petugas, bukan galat", async () => {
    const t = await akunTertautPegawai(db, "usr-hakim", "2026-07-01", "2026-09-30");
    expect(t.akun).toEqual([]);
    expect(t.catatanOperator[0]).toMatch(/belum ditautkan/);
  });
});

describe("target", () => {
  const butir = { jabatan: "pp", tahun: 2026, kunciRhk: "", kunciIndikator: "", targetNilai: 90, targetTeks: "90%" };

  async function kunciPp() {
    const { SKP_JABATAN_2026 } = await import("@/lib/skp-jabatan-katalog");
    const rhk = SKP_JABATAN_2026.pp[0];
    return { kunciRhk: rhk.kunci, kunciIndikator: rhk.indikator[1].kunci, satuan: rhk.indikator[1].satuan };
  }

  it("Panitera/Ketua/Super Admin/Admin mengubah; Wakil dan lainnya tidak", async () => {
    const kunci = await kunciPp();
    for (const id of ["usr-wakil", "usr-hakim", "usr-ppg"]) {
      await expect(simpanTarget(db, await aktorDari(id), [{ ...butir, ...kunci }])).rejects.toMatchObject({ status: 403 });
    }
    for (const id of ["usr-panitera", "usr-ketua", "usr-super", "usr-admin"]) {
      const hasil = await simpanTarget(db, await aktorDari(id), [{ ...butir, ...kunci }]);
      expect(hasil[0]).toMatchObject({ jabatan: "pp", tahun: 2026, targetNilai: 90, status: "usulan", diubahOlehId: id });
    }
    // Upsert: tetap satu baris.
    expect((await bacaTarget(db, { tahun: 2026, jabatan: "pp" })).length).toBe(1);
  });

  it("disahkan tersimpan; kunci RHK/indikator liar ditolak; target negatif ditolak", async () => {
    const kunci = await kunciPp();
    const pn = await aktorDari("usr-panitera");
    const [sah] = await simpanTarget(db, pn, [{ ...butir, ...kunci, status: "disahkan" }]);
    expect(sah.status).toBe("disahkan");
    expect(sah.satuan).toBe(kunci.satuan);
    await expect(simpanTarget(db, pn, [{ ...butir, kunciRhk: "ngarang", kunciIndikator: "x" }])).rejects.toMatchObject({ status: 400 });
    await expect(simpanTarget(db, pn, [{ ...butir, ...kunci, targetNilai: -1 }])).rejects.toMatchObject({ status: 400 });
    await expect(simpanTarget(db, pn, [{ ...butir, ...kunci, jabatan: "tukang" }])).rejects.toMatchObject({ status: 400 });
    await expect(simpanTarget(db, pn, [])).rejects.toMatchObject({ status: 400 });
  });

  it("target tersimpan dipakai hitungan Lembar (bunyi 'disahkan')", async () => {
    const kunci = await kunciPp();
    await simpanTarget(db, await aktorDari("usr-panitera"), [{ ...butir, ...kunci, status: "disahkan" }]);
    const siap = await siapkanSkp(db, await aktorDari("usr-ppg"), perm("pp", "usr-ppg", { periode: "tw3" }));
    const indikator = siap.hasil.lembar.rhk.flatMap((r) => r.indikator).find((i) => i.kunci === kunci.kunciIndikator);
    expect(indikator).toMatchObject({ target: 90, statusTarget: "disahkan" });
  });
});

describe("isian manual: draf -> diajukan -> disetujui", () => {
  async function kunciKasir() {
    const { SKP_JABATAN_2026 } = await import("@/lib/skp-jabatan-katalog");
    const rhk = SKP_JABATAN_2026.kasir.find((r) => r.indikator.some((i) => i.aturan.jenis === "isian"))!;
    return { kunciRhk: rhk.kunci, kunciIndikator: rhk.indikator.find((i) => i.aturan.jenis === "isian")!.kunci };
  }
  const BUKTI = [{ judul: "Laporan keuangan Agustus", rujukan: "scan-1", tanggal: "2026-09-02" }];

  beforeEach(async () => {
    await simpanPemetaan(db, await aktorDari("usr-super"), { usernameSipp: "kasir1", userId: "usr-rina", jabatanUtama: "kasir", berlakuDari: "2026-01-01" });
  });

  it("hanya pemilik yang mengisi; kunci liar ditolak; periode yang belum dimulai ditolak", async () => {
    const kunci = await kunciKasir();
    const dasar = { periode: "b08", tahun: 2026, nilai: 95, ...kunci };
    await expect(simpanIsian(db, await aktorDari("usr-gugatan"), { ...dasar, userId: "usr-rina" })).rejects.toMatchObject({ status: 403 });
    await expect(simpanIsian(db, await aktorDari("usr-panitera"), { ...dasar, userId: "usr-rina" })).rejects.toMatchObject({ status: 403 });
    await expect(simpanIsian(db, await aktorDari("usr-rina"), { ...dasar, kunciRhk: "ngarang" })).rejects.toMatchObject({ status: 400 });
    await expect(simpanIsian(db, await aktorDari("usr-rina"), { ...dasar, periode: "b99" })).rejects.toMatchObject({ status: 400 });
    await expect(simpanIsian(db, await aktorDari("usr-rina"), { ...dasar, tahun: 2999 })).rejects.toMatchObject({ status: 400 });
    await expect(simpanIsian(db, await aktorDari("usr-rina"), { ...dasar, nilai: "abc" })).rejects.toMatchObject({ status: 400 });
    await expect(simpanIsian(db, await aktorDari("usr-rina"), { ...dasar, bukti: [{ judul: " " }] })).rejects.toMatchObject({ status: 400 });
    const draf = await simpanIsian(db, await aktorDari("usr-rina"), { ...dasar, bukti: BUKTI });
    expect(draf).toMatchObject({ userId: "usr-rina", status: "draf", nilai: 95, nilaiTeks: "95", diisiOlehId: "usr-rina" });
    // Simpan lagi = memperbarui baris yang sama.
    const lagi = await simpanIsian(db, await aktorDari("usr-rina"), { ...dasar, nilai: 97, bukti: BUKTI });
    expect(lagi.id).toBe(draf.id);
    expect((await bacaIsian(db, { userId: "usr-rina", tahun: 2026 })).length).toBe(1);
  });

  it("diajukan hanya bila bernilai dan berbukti; sesudah diajukan terkunci bagi pemilik", async () => {
    const kunci = await kunciKasir();
    const rina = await aktorDari("usr-rina");
    const tanpaBukti = await simpanIsian(db, rina, { periode: "b08", tahun: 2026, nilai: 90, ...kunci });
    await expect(ajukanIsian(db, rina, tanpaBukti.id)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("bukti") });
    const tanpaNilai = await simpanIsian(db, rina, { periode: "b07", tahun: 2026, nilai: null, ...kunci, bukti: BUKTI });
    await expect(ajukanIsian(db, rina, tanpaNilai.id)).rejects.toMatchObject({ status: 400, message: expect.stringContaining("nilai") });
    await expect(ajukanIsian(db, await aktorDari("usr-gugatan"), tanpaBukti.id)).rejects.toMatchObject({ status: 403 });

    const lengkap = await simpanIsian(db, rina, { periode: "b08", tahun: 2026, nilai: 90, ...kunci, bukti: BUKTI });
    const diajukan = await ajukanIsian(db, rina, lengkap.id);
    expect(diajukan.status).toBe("diajukan");
    expect(diajukan.diajukanPada).toBeTruthy();
    await expect(simpanIsian(db, rina, { periode: "b08", tahun: 2026, nilai: 10, ...kunci, bukti: BUKTI })).rejects.toMatchObject({ status: 409 });
    await expect(ajukanIsian(db, rina, lengkap.id)).rejects.toMatchObject({ status: 409 });
  });

  it("atasan langsung/Ketua/Panitera/Admin meninjau; pemilik, Wakil, rekan tidak; kembalikan wajib bercatatan", async () => {
    const kunci = await kunciKasir();
    const rina = await aktorDari("usr-rina");
    const siap = await simpanIsian(db, rina, { periode: "b08", tahun: 2026, nilai: 90, ...kunci, bukti: BUKTI });
    await ajukanIsian(db, rina, siap.id);

    for (const id of ["usr-rina", "usr-wakil", "usr-hakim", "usr-ppg"]) {
      await expect(tinjauIsian(db, await aktorDari(id), siap.id, "setujui", "")).rejects.toMatchObject({ status: 403 });
    }
    await expect(tinjauIsian(db, await aktorDari("usr-gugatan"), siap.id, "kembalikan", "  ")).rejects.toMatchObject({ status: 400 });
    const kembali = await tinjauIsian(db, await aktorDari("usr-gugatan"), siap.id, "kembalikan", "Lampirkan pindaian yang terbaca");
    expect(kembali).toMatchObject({ status: "draf", ditinjauOlehId: "usr-gugatan", catatanTinjauan: "Lampirkan pindaian yang terbaca" });

    // Diperbaiki, diajukan lagi, lalu disetujui Panitera.
    await simpanIsian(db, rina, { periode: "b08", tahun: 2026, nilai: 92, ...kunci, bukti: BUKTI });
    await ajukanIsian(db, rina, siap.id);
    const setuju = await tinjauIsian(db, await aktorDari("usr-panitera"), siap.id, "setujui", "");
    expect(setuju).toMatchObject({ status: "disetujui", ditinjauOlehId: "usr-panitera", nilai: 92 });
    await expect(tinjauIsian(db, await aktorDari("usr-panitera"), siap.id, "setujui", "")).rejects.toMatchObject({ status: 409 });

    const aksi = (await db.queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action LIKE 'SKP_ISIAN_%' ORDER BY created_at ASC")).map((a) => a.action);
    expect(aksi).toEqual(expect.arrayContaining(["SKP_ISIAN_SIMPAN", "SKP_ISIAN_AJUKAN", "SKP_ISIAN_KEMBALIKAN", "SKP_ISIAN_SETUJUI"]));
  });

  it("isian yang diajukan masuk hitungan Lembar (gabungan); draf tidak", async () => {
    const kunci = await kunciKasir();
    const rina = await aktorDari("usr-rina");
    const i = await simpanIsian(db, rina, { periode: "b08", tahun: 2026, nilai: 91, ...kunci, bukti: BUKTI });
    ambilBot.mockResolvedValue({ ok: true, data: dataKasir([]) });
    const cari = (s: Awaited<ReturnType<typeof siapkanSkp>>) =>
      s.hasil.lembar.rhk.flatMap((r) => r.indikator).find((x) => x.kunci === kunci.kunciIndikator)!;
    const sebelum = await siapkanSkp(db, rina, perm("kasir", "usr-rina", { periode: "b08" }));
    expect(cari(sebelum).realisasi).toBeNull();
    await ajukanIsian(db, rina, i.id);
    const sesudah = await siapkanSkp(db, rina, perm("kasir", "usr-rina", { periode: "b08" }));
    expect(cari(sesudah)).toMatchObject({ realisasi: 91, sumber: "isian" });
  });
});

// ─── Lembar: hak, bot, akun bersama, penetapan ──────────────────────────────

const kej = (tanggal: string, nilai: number): KejadianSkp => ({
  perkaraId: null,
  nomorPerkara: null,
  tanggal,
  tanggalAcuan: null,
  nilai,
  keterangan: "Panjar",
});

function dataKasir(kejadian: KejadianSkp[], username = "kasir1"): DataSkpJabatan {
  const akun: FaktaAkunSkp = {
    username,
    userIdSipp: "22",
    nama: "Kasir Uji",
    grup: [702],
    jabatanDugaan: "kasir",
    aktif: true,
    fakta: [{ kunci: "ks-penerimaan-kuantitas", terbaca: true, kejadian, galat: null }],
  };
  return {
    ok: true,
    periode: susunPeriodeSkpJabatan("tw3", 2026),
    jabatan: "kasir",
    akun: [akun],
    catatan: [],
    galat: [],
    dihitungPada: "2026-10-05T02:00:00.000Z",
  };
}

function perm(
  jenis: Parameters<typeof siapkanSkp>[2]["jenis"],
  pegawaiUserId: string,
  ubah: Partial<Parameters<typeof siapkanSkp>[2]> = {}
): Parameters<typeof siapkanSkp>[2] {
  return {
    jenis,
    pegawaiUserId,
    idSipp: null,
    tahun: 2026,
    periode: "tw3",
    sertakanTambahan: true,
    langsung: false,
    ketat: true,
    denganDataHakim: false,
    ...ubah,
  };
}

const realisasiKasir = (s: Awaited<ReturnType<typeof siapkanSkp>>) =>
  s.hasil.lembar.rhk.flatMap((r) => r.indikator).find((i) => i.kunci === "ks-penerimaan-kuantitas")!.realisasi;

describe("penyiapan Lembar SKP", () => {
  const KEJADIAN = [kej("2026-07-10", 100_000), kej("2026-08-20", 200_000), kej("2026-09-05", 400_000), kej("2026-09-20", 800_000)];

  beforeEach(async () => {
    const pn = await aktorDari("usr-panitera");
    await simpanPemetaan(db, pn, { usernameSipp: "kasir1", userId: "usr-rina", jabatanUtama: "kasir", berlakuDari: "2026-01-01", berlakuSampai: "2026-08-31" });
    await simpanPemetaan(db, pn, { usernameSipp: "kasir1", userId: "usr-budi", jabatanUtama: "kasir", berlakuDari: "2026-09-01" });
    ambilBot.mockResolvedValue({ ok: true, data: dataKasir(KEJADIAN) });
  });

  it("akun bersama: tiap pegawai hanya menghitung kejadian di jendela berlakunya", async () => {
    const rina = await siapkanSkp(db, await aktorDari("usr-rina"), perm("kasir", "usr-rina"));
    const budi = await siapkanSkp(db, await aktorDari("usr-budi"), perm("kasir", "usr-budi"));
    expect(realisasiKasir(rina)).toBe(300_000);
    expect(realisasiKasir(budi)).toBe(1_200_000);
    // Akun diminta ke bot lengkap dengan jabatannya.
    expect(ambilBot).toHaveBeenCalledWith(expect.objectContaining({ tahun: 2026, periode: "tw3", jabatan: "kasir", username: ["kasir1"] }));
  });

  it("hak diperiksa SEBELUM bot dipanggil: rekan 403, atasan langsung/Ketua/Wakil/Admin boleh", async () => {
    await expect(siapkanSkp(db, await aktorDari("usr-hakim"), perm("kasir", "usr-rina"))).rejects.toMatchObject({ status: 403 });
    await expect(siapkanSkp(db, await aktorDari("usr-ppg"), perm("kasir", "usr-rina"))).rejects.toMatchObject({ status: 403 });
    expect(ambilBot).not.toHaveBeenCalled();
    const alasan: Record<string, string> = {
      "usr-gugatan": "atasan-langsung",
      "usr-ketua": "ketua",
      "usr-wakil": "wakil-ketua",
      "usr-panitera": "panitera",
      "usr-admin": "admin",
      "usr-super": "super-admin",
      "usr-rina": "sendiri",
    };
    for (const [id, kata] of Object.entries(alasan)) {
      const s = await siapkanSkp(db, await aktorDari(id), perm("kasir", "usr-rina"));
      expect(s.hak.alasan).toBe(kata);
    }
  });

  it("jenis yang bukan jabatan pegawai ditolak 400; SKP Pimpinan hanya Ketua/Wakil", async () => {
    await expect(siapkanSkp(db, await aktorDari("usr-super"), perm("pp", "usr-rina"))).rejects.toMatchObject({ status: 400 });
    await expect(siapkanSkp(db, await aktorDari("usr-super"), perm("pimpinan", "usr-rina"))).rejects.toMatchObject({ status: 400, message: expect.stringContaining("Ketua") });
    await expect(siapkanSkp(db, await aktorDari("usr-super"), perm("kasir", "tidak-ada"))).rejects.toMatchObject({ status: 404 });
  });

  it("tanpa akun aktif pada periode: bot TIDAK dipanggil, indikator SIPP '—' dan ada catatan", async () => {
    const s = await siapkanSkp(db, await aktorDari("usr-rina"), perm("kasir", "usr-rina", { periode: "tw4" }));
    expect(ambilBot).not.toHaveBeenCalled();
    expect(realisasiKasir(s)).toBeNull();
    expect(s.hasil.lembar.catatan.join(" ")).toMatch(/belum ditautkan/);
    expect(s.catatanOperator.join(" ")).toMatch(/manual/);
  });

  it("bot gagal: ketat -> galat berkode bot; tidak ketat -> lembar tetap tersusun, sippTerjangkau=false", async () => {
    ambilBot.mockResolvedValue({ ok: false, status: 503, alasan: "ALETA Bot belum dapat dihubungi." });
    await expect(siapkanSkp(db, await aktorDari("usr-rina"), perm("kasir", "usr-rina"))).rejects.toMatchObject({
      status: 503,
      message: "ALETA Bot belum dapat dihubungi.",
    });
    const s = await siapkanSkp(db, await aktorDari("usr-rina"), perm("kasir", "usr-rina", { ketat: false }));
    expect(s.sippTerjangkau).toBe(false);
    expect(realisasiKasir(s)).toBeNull();
    expect(s.catatanOperator).toContain("ALETA Bot belum dapat dihubungi.");
  });

  it("rangkap: Panitera + PP meminta fakta tiap jabatan ke bot dan menggabungkannya; ?tambahan=0 mematikan blok PP", async () => {
    await simpanPemetaan(db, await aktorDari("usr-super"), {
      usernameSipp: "panitera",
      userId: "usr-panitera",
      jabatanUtama: "panitera",
      jabatanTambahan: ["pp"],
      berlakuDari: "2026-01-01",
    });
    ambilBot.mockImplementation(async ({ jabatan }) => ({
      ok: true,
      data: {
        ...dataKasir([]),
        jabatan,
        akun: [
          {
            username: "panitera",
            userIdSipp: "81",
            nama: "Panitera Uji",
            grup: [30, 500],
            jabatanDugaan: "panitera",
            aktif: true,
            fakta: [{ kunci: jabatan === "pp" ? "pp-sidang-kuantitas" : "pn-penunjukan-kuantitas", terbaca: true, kejadian: [], galat: null }],
          },
        ],
      },
    }));
    const dengan = await siapkanSkp(db, await aktorDari("usr-panitera"), perm("panitera", "usr-panitera"));
    expect(ambilBot.mock.calls.map((c) => c[0].jabatan)).toEqual(["panitera", "pp"]);
    expect(dengan.hasil.lembar.blokTambahan.length).toBeGreaterThan(0);
    ambilBot.mockClear();
    const tanpa = await siapkanSkp(db, await aktorDari("usr-panitera"), perm("panitera", "usr-panitera", { sertakanTambahan: false }));
    expect(ambilBot.mock.calls.map((c) => c[0].jabatan)).toEqual(["panitera"]);
    expect(tanpa.hasil.lembar.blokTambahan).toEqual([]);
  });

  it("pejabat penilai = atasan langsung; tanpa atasan = Ketua; Ketua sendiri tanpa penilai", async () => {
    const rina = await siapkanSkp(db, await aktorDari("usr-rina"), perm("kasir", "usr-rina"));
    expect(rina.hasil.lembar.pejabatPenilai).toMatchObject({ nama: expect.any(String) });
    expect(rina.penilai.userId).toBe("usr-gugatan");
    await db.run("UPDATE employee_profiles SET supervisor_employee_id = NULL WHERE id = 'pf-rina'");
    const tanpaAtasan = await siapkanSkp(db, await aktorDari("usr-rina"), perm("kasir", "usr-rina"));
    expect(tanpaAtasan.penilai.userId).toBe("usr-ketua");
    const k = await bacaKeadaanPegawai(db, "usr-ketua");
    const { pejabatPenilaiSkp } = await import("@/server/modules/skp/pegawai");
    expect((await pejabatPenilaiSkp(db, k!)).penilai).toBeNull();
  });
});

describe("penetapan terkunci", () => {
  beforeEach(async () => {
    await simpanPemetaan(db, await aktorDari("usr-panitera"), { usernameSipp: "kasir1", userId: "usr-rina", jabatanUtama: "kasir", berlakuDari: "2026-01-01" });
    ambilBot.mockResolvedValue({ ok: true, data: dataKasir([kej("2026-07-10", 100_000)]) });
  });

  async function tetapkan(oleh: string, kunci: boolean) {
    const aktor = await aktorDari(oleh);
    const siap = await siapkanSkp(db, aktor, perm("kasir", "usr-rina", { langsung: true }));
    return simpanPenetapan(db, aktor, hakPegawai(siap.pegawai), {
      jenis: "kasir",
      periode: "tw3",
      tahun: 2026,
      hasil: siap.hasil,
      dataHakim: null,
      penilai: { id: siap.penilai.userId, nama: siap.penilai.penilai?.nama ?? "" },
      kunci,
    });
  }

  it("hanya yang berhak meninjau (bukan pegawainya sendiri, bukan Wakil)", async () => {
    for (const id of ["usr-rina", "usr-wakil", "usr-hakim"]) {
      await expect(tetapkan(id, true)).rejects.toMatchObject({ status: 403 });
    }
  });

  it("draf boleh dihitung ulang; terkunci membekukan angka walau SIPP berubah dan bot mati", async () => {
    const draf = await tetapkan("usr-gugatan", false);
    expect(draf.status).toBe("draf");
    ambilBot.mockResolvedValue({ ok: true, data: dataKasir([kej("2026-07-10", 100_000), kej("2026-08-01", 50_000)]) });
    const ulang = await tetapkan("usr-gugatan", false);
    expect(ulang.id).toBe(draf.id);

    const kunci = await tetapkan("usr-panitera", true);
    expect(kunci).toMatchObject({ id: draf.id, status: "terkunci", dikunciOlehId: "usr-panitera" });
    await expect(tetapkan("usr-panitera", false)).rejects.toMatchObject({ status: 409 });
    await expect(tetapkan("usr-panitera", true)).rejects.toMatchObject({ status: 409 });

    // SIPP berubah dan bot mati: lembar terkunci tetap sama, bot tidak diminta.
    ambilBot.mockReset();
    ambilBot.mockResolvedValue({ ok: false, status: 503, alasan: "mati" });
    const dibaca = await siapkanSkp(db, await aktorDari("usr-rina"), perm("kasir", "usr-rina"));
    expect(dibaca.dariPenetapan).toBe(true);
    expect(ambilBot).not.toHaveBeenCalled();
    expect(realisasiKasir(dibaca)).toBe(150_000);
    // ?langsung=1 menghitung dari SIPP sekarang (dan di sini gagal karena bot mati).
    await expect(siapkanSkp(db, await aktorDari("usr-rina"), perm("kasir", "usr-rina", { langsung: true }))).rejects.toBeInstanceOf(ApiError);

    const tersimpan = await bacaPenetapan(db, { userId: "usr-rina", jenis: "kasir", periode: "tw3", tahun: 2026 });
    expect(tersimpan?.penetapan.tangkapan.jenis).toBe("kasir");
    const aksi = (await db.queryAll<{ action: string }>("SELECT action FROM audit_logs WHERE action LIKE 'SKP_PENETAPAN_%'")).map((a) => a.action);
    expect(aksi).toEqual(expect.arrayContaining(["SKP_PENETAPAN_SIMPAN", "SKP_PENETAPAN_KUNCI"]));
  });
});
