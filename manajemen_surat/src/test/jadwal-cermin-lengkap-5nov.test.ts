// @vitest-environment node
/**
 * ============================================================================
 * CERMIN JADWAL SIDANG & MEDIASI LENGKAP (5 Nov 2026, migrasi 0134)
 * ============================================================================
 *
 *   A. migrasi 0134 = DDL schema.ts, jurnal idx 116, hanya tambah, aman diulang, kolom benar-benar ada (pg-mem);
 *   B. kolom yang dapat dicari: diturunkan dari baris layar; terisi saat upsert; baris lama diisi dari baris_json;
 *   C. TERHAPUS LEMBUT: baris yang hilang dari SIPP ditandai (tidak di-DELETE), hidup lagi bila kembali; semua
 *      pembaca (jadwal, kabar, keadaan perkara, hitungan, mediasi) menyaringnya;
 *   D. pemindai RIWAYAT mediasi: bertahap per jendela, berjeda, dapat dilanjutkan, berhenti saat galat beruntun,
 *      dapat dipaksa, tidak menyentuh bot bila saklar mati, diulang mingguan;
 *   E. ARSIP ANTRIAN: snapshot dari bot (hanya SELECT), selang, jam sidang, galat tidak menimpa; layar tetap langsung;
 *   F. jawaban DARURAT memakai riwayat mediasi dan arsip antrian (berpenanda basi, terbaca tetap false);
 *   G. bot: rute dan layanan baru hanya membaca; tidak ada tulisan ke SIPP/antrian dan tidak ada kata "Aleta".
 *
 * Data rekaan saja. Tidak ada jaringan dan tidak ada SIPP sungguhan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PENGATURAN_CERMIN_BAWAAN,
  bersihkanKeadaanRiwayatMediasi,
  keadaanMediasiAwal,
  keadaanPemindaiAwal,
  type PengaturanCermin,
} from "@/lib/cermin";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_CERMIN_JADWAL_LENGKAP } from "@/server/db/schema";
import { putaranArsipAntrian, muatArsipAntrian, aturUlangArsipAntrian, type DepsArsipAntrian } from "@/server/modules/cermin/antrian-arsip";
import type { ArsipAntrianSumber, MediasiSumber, SidangSumber } from "@/server/modules/cermin/bot";
import { detakCermin, aturUlangCerminBerkala } from "@/server/modules/cermin/berkala";
import { jadwalSidangDariCerminDarurat, mediasiDariCerminDarurat } from "@/server/modules/cermin/darurat";
import { isiKolomLama } from "@/server/modules/cermin/isi-kolom";
import { muatSidangCermin } from "@/server/modules/cermin/jadwal-cermin";
import { kolomMediasiDariBaris, kolomSidangDariBaris } from "@/server/modules/cermin/jadwal-kolom";
import { KUNCI_JEJAK, tulisJejak } from "@/server/modules/cermin/jejak";
import { gantiMediasiRentang, muatMediasiCermin } from "@/server/modules/cermin/mediasi";
import {
  aturUlangRiwayatMediasi,
  lanjutkanRiwayatMediasi,
  muatKeadaanRiwayatMediasi,
  putaranRiwayatMediasi,
  ulangRiwayatMediasi,
  type DepsRiwayatMediasi,
} from "@/server/modules/cermin/mediasi-riwayat";
import { gantiSidangRentang, hapusPerkaraCermin, hitunganCermin, simpanJendelaSidang } from "@/server/modules/cermin/penyimpan";
import { buangSinggahPengaturanCermin } from "@/server/modules/cermin/pengaturan";

const AKAR = path.resolve(__dirname, "../../..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

let db: AletaDatabase;
// 23.00 WITA Kamis 5 Nov 2026 (di dalam jendela pemindai 18.00-06.30)
const MALAM = new Date("2026-11-05T15:00:00.000Z");
// 10.00 WITA (jam sidang)
const SIANG = new Date("2026-11-05T02:00:00.000Z");
let jam = MALAM;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
  jam = MALAM;
  aturUlangRiwayatMediasi();
  aturUlangArsipAntrian();
  aturUlangCerminBerkala();
  buangSinggahPengaturanCermin();
});
afterEach(async () => {
  await db.close();
});

// ============================================================================
// Data rekaan
// ============================================================================
function sidang(id: number, perkaraId: number, tanggal: string, lebih: Record<string, unknown> = {}): SidangSumber {
  return {
    sidangId: String(id),
    perkaraId: String(perkaraId),
    tanggalSidang: tanggal,
    jamSidang: "09:00:00",
    ruangan: "Ruang 1",
    agenda: "Pembuktian",
    ditunda: 0,
    sippDiperbarui: "2026-11-05 08:00:00",
    baris: {
      sidangId: String(id),
      perkaraId: String(perkaraId),
      nomorPerkara: `${id}/Pdt.G/2026/PA.Rekaan`,
      jenisPerkara: "Cerai Gugat",
      tanggalSidang: tanggal,
      jamSidang: "09:00",
      alurPerkaraId: 15,
      ditunda: true,
      alasanDitunda: "Menunggu saksi",
      dihadiriOleh: 2,
      urutanSidang: 3,
      sidangKeliling: true,
      sidangIkrarTalak: false,
      adaBas: true,
      ...lebih,
    },
  };
}

function mediasi(id: number, perkaraId: number, tanggal: string, lebih: Record<string, unknown> = {}): MediasiSumber {
  return {
    mediasiId: String(id),
    perkaraId: String(perkaraId),
    nomorPerkara: `${id}/Pdt.G/2026/PA.Rekaan`,
    jenisPerkara: "Cerai Gugat",
    tanggal,
    jam: "09:00",
    tempat: "Ruang Mediasi",
    ditunda: false,
    dihadiri: "Y",
    mediator: "Mediator Rekaan",
    statusMediator: "H",
    jenisMediasi: "Hakim",
    nomorSk: "12/2026",
    penetapanMediator: "2026-10-01",
    laporanMediator: "2026-10-20",
    selesai: true,
    hasil: "1",
    hasilTeks: "Berhasil sebagian",
    tenggatPerma: "2026-10-31",
    ...lebih,
  };
}

const baris = <T extends Record<string, unknown>>(sql: string, p: Array<string | number | null> = []) => db.queryAll<T>(sql, p);

// ============================================================================
describe("A. migrasi 0134", () => {
  const sql = baca("manajemen_surat/drizzle/0134_aleta_cermin_jadwal_lengkap.sql");

  it("pernyataan berkas SQL = DDL_ALETA_CERMIN_JADWAL_LENGKAP (kolom lalu indeks); hanya tambah, tanpa tabel baru", () => {
    const dalamBerkas = pernyataan(sql);
    const dalamSkema = [...DDL_ALETA_CERMIN_JADWAL_LENGKAP.kolom, ...DDL_ALETA_CERMIN_JADWAL_LENGKAP.indeks].map((s) => pernyataan(s)[0]);
    expect(dalamBerkas).toEqual(dalamSkema);
    expect(dalamBerkas.join(";")).not.toMatch(/CREATE TABLE|DROP |DELETE |UPDATE |TRUNCATE|RENAME|ALTER COLUMN|DROP COLUMN/i);
    for (const s of dalamBerkas) expect(s).toMatch(/^(ALTER TABLE aleta_cermin_(sidang|mediasi) ADD COLUMN IF NOT EXISTS |CREATE INDEX IF NOT EXISTS )/);
    // Tidak ada tabel baru: daftar cadangan tetap memuat kedua tabelnya.
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_cermin_sidang");
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_cermin_mediasi");
  });

  it("jurnal: idx 116 = 0134, sesudah 0133 (idx 115), tanpa idx/tag ganda, when menaik", () => {
    const j = JSON.parse(baca("manajemen_surat/drizzle/meta/_journal.json")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.find((x) => x.tag === "0134_aleta_cermin_jadwal_lengkap")?.idx).toBe(116);
    expect(j.entries.find((x) => x.tag === "0133_aleta_abt_pustaka")?.idx).toBe(115);
    expect(new Set(j.entries.map((x) => x.idx)).size).toBe(j.entries.length);
    expect(new Set(j.entries.map((x) => x.tag)).size).toBe(j.entries.length);
    const when = j.entries.map((x) => x.when);
    expect([...when].sort((a, b) => a - b)).toEqual(when);
  });

  it("semua kolom benar-benar ada dengan bawaan aman; migrasi dapat dijalankan ulang tanpa merusak baris", async () => {
    await db.run(
      "INSERT INTO aleta_cermin_sidang (sidang_id, perkara_id, cermin_diperbarui) VALUES ('s1', 'p1', 'x')"
    );
    // Dijalankan ulang (IF NOT EXISTS) di atas baris yang sudah ada.
    for (const s of pernyataan(sql)) await db.exec(s);
    const r = (await baris("SELECT * FROM aleta_cermin_sidang WHERE sidang_id = 's1'"))[0];
    expect(r).toMatchObject({ terhapus_at: "", kolom_diisi: 0, alasan_tunda: "", urutan_sidang: 0, antrian_dibaca_at: "" });
    expect(r.dihadiri_oleh).toBeNull();
    expect(r.antrian_nomor).toBeNull();
    for (const k of ["terhapus_at", "kolom_diisi", "nomor_perkara", "jenis_perkara", "alasan_tunda", "dihadiri_oleh", "urutan_sidang", "sidang_keliling", "sidang_ikrar", "ada_bas", "antrian_nomor", "antrian_disidang", "antrian_keadaan", "antrian_jam_ambil", "antrian_jam_hadir", "antrian_dibaca_at"]) {
      expect(Object.keys(r), k).toContain(k);
    }
    await db.run("INSERT INTO aleta_cermin_mediasi (id, perkara_id, cermin_diperbarui) VALUES ('m1', 'p1', 'x')");
    const m = (await baris("SELECT * FROM aleta_cermin_mediasi WHERE id = 'm1'"))[0];
    for (const k of ["terhapus_at", "kolom_diisi", "nomor_perkara", "jenis_perkara", "tempat", "ditunda", "dihadiri", "status_mediator", "jenis_mediasi", "nomor_sk", "penetapan_mediator", "laporan_mediator", "hasil", "hasil_teks"]) {
      expect(Object.keys(m), k).toContain(k);
    }
    expect(m).toMatchObject({ terhapus_at: "", kolom_diisi: 0, hasil: "" });
  });
});

// ============================================================================
describe("B. kolom yang dapat dicari", () => {
  it("diturunkan dari baris layar: alasan tunda, dihadiri_oleh (NULL bila kosong), urutan, keliling, ikrar, BAS", () => {
    expect(kolomSidangDariBaris(sidang(1, 1, "2026-11-05").baris)).toEqual({
      nomor_perkara: "1/Pdt.G/2026/PA.Rekaan",
      jenis_perkara: "Cerai Gugat",
      alasan_tunda: "Menunggu saksi",
      dihadiri_oleh: 2,
      urutan_sidang: 3,
      sidang_keliling: 1,
      sidang_ikrar: 0,
      ada_bas: 1,
    });
    expect(kolomSidangDariBaris({ dihadiriOleh: null }).dihadiri_oleh).toBeNull();
    expect(kolomSidangDariBaris({}).dihadiri_oleh).toBeNull();
    expect(kolomSidangDariBaris(null)).toMatchObject({ alasan_tunda: "", urutan_sidang: 0 });
    expect(kolomMediasiDariBaris(mediasi(1, 1, "2026-11-05"))).toMatchObject({ status_mediator: "H", hasil: "1", hasil_teks: "Berhasil sebagian", laporan_mediator: "2026-10-20", ditunda: 0, dihadiri: "Y" });
  });

  it("upsert sidang mengisi kolom; yang sama tidak ditulis ulang; baris lama (kolom_diisi 0) ditulis ulang sekali", async () => {
    const s = sidang(10, 100, "2026-11-05");
    expect((await simpanJendelaSidang(db, { sidang: [s] }, "t1")).ditulis).toBe(1);
    expect((await baris("SELECT * FROM aleta_cermin_sidang WHERE sidang_id = '10'"))[0]).toMatchObject({
      kolom_diisi: 1,
      terhapus_at: "",
      nomor_perkara: "10/Pdt.G/2026/PA.Rekaan",
      alasan_tunda: "Menunggu saksi",
      dihadiri_oleh: 2,
      urutan_sidang: 3,
      sidang_keliling: 1,
      ada_bas: 1,
    });
    expect((await simpanJendelaSidang(db, { sidang: [s] }, "t2")).ditulis).toBe(0);
    // Baris lama: sidik sama tetapi kolom belum diisi -> ditulis ulang.
    await db.run("UPDATE aleta_cermin_sidang SET kolom_diisi = 0, alasan_tunda = '' WHERE sidang_id = '10'");
    expect((await simpanJendelaSidang(db, { sidang: [s] }, "t3")).ditulis).toBe(1);
    expect((await baris("SELECT alasan_tunda, kolom_diisi FROM aleta_cermin_sidang WHERE sidang_id = '10'"))[0]).toMatchObject({ alasan_tunda: "Menunggu saksi", kolom_diisi: 1 });
  });

  it("upsert mediasi mengisi mediator, hasil, dan kolom lain", async () => {
    await gantiMediasiRentang(db, "2026-11-05", "2026-11-05", [mediasi(1, 100, "2026-11-05")], { hapus: false, sekarang: "t1" });
    expect((await baris("SELECT * FROM aleta_cermin_mediasi"))[0]).toMatchObject({
      kolom_diisi: 1,
      terhapus_at: "",
      mediator: "Mediator Rekaan",
      hasil: "1",
      hasil_teks: "Berhasil sebagian",
      status_mediator: "H",
      jenis_mediasi: "Hakim",
      nomor_sk: "12/2026",
      penetapan_mediator: "2026-10-01",
      laporan_mediator: "2026-10-20",
      tempat: "Ruang Mediasi",
      nomor_perkara: "1/Pdt.G/2026/PA.Rekaan",
    });
  });

  it("pengisi baris lama: dari baris_json, per kelompok, dapat diulang, baris_json rusak tidak membuat berputar", async () => {
    for (let i = 1; i <= 5; i++) {
      await db.run(
        "INSERT INTO aleta_cermin_sidang (sidang_id, perkara_id, tanggal_sidang, baris_json, cermin_diperbarui) VALUES (?, ?, '2026-11-05', ?, 'x')",
        [`s${i}`, `p${i}`, i === 5 ? "{rusak" : JSON.stringify(sidang(i, i, "2026-11-05").baris)]
      );
    }
    await db.run("INSERT INTO aleta_cermin_mediasi (id, perkara_id, tanggal, baris_json, cermin_diperbarui) VALUES ('m1', 'p1', '2026-11-05', ?, 'x')", [JSON.stringify(mediasi(1, 1, "2026-11-05"))]);
    const a = await isiKolomLama(db, 3);
    expect(a).toEqual({ sidang: 3, mediasi: 1, sisa: true });
    const b = await isiKolomLama(db, 3);
    expect(b).toEqual({ sidang: 2, mediasi: 0, sisa: false });
    expect(await isiKolomLama(db, 3)).toEqual({ sidang: 0, mediasi: 0, sisa: false });
    const r = await baris<{ sidang_id: string; alasan_tunda: string; kolom_diisi: number }>("SELECT sidang_id, alasan_tunda, kolom_diisi FROM aleta_cermin_sidang ORDER BY sidang_id");
    expect(r.every((x) => x.kolom_diisi === 1)).toBe(true);
    expect(r.find((x) => x.sidang_id === "s1")?.alasan_tunda).toBe("Menunggu saksi");
    expect(r.find((x) => x.sidang_id === "s5")?.alasan_tunda).toBe(""); // rusak: bawaan
    expect((await baris("SELECT hasil, status_mediator FROM aleta_cermin_mediasi"))[0]).toMatchObject({ hasil: "1", status_mediator: "H" });
  });
});

// ============================================================================
describe("C. terhapus lembut", () => {
  it("sidang yang hilang dari SIPP ditandai (tidak di-DELETE), disaring pembaca, dan hidup lagi bila kembali", async () => {
    await simpanJendelaSidang(db, { sidang: [sidang(1, 1, "2026-11-05"), sidang(2, 2, "2026-11-05"), sidang(3, 3, "2026-11-06")] }, "t1");
    const g = await gantiSidangRentang(db, "2026-11-05", "2026-11-05", [sidang(1, 1, "2026-11-05")], { sekarang: "t2" });
    expect(g.dihapus).toBe(1);
    // Barisnya masih ada, ditandai; sidang di luar rentang tidak tersentuh.
    const semua = await baris<{ sidang_id: string; terhapus_at: string }>("SELECT sidang_id, terhapus_at FROM aleta_cermin_sidang ORDER BY sidang_id");
    expect(semua).toEqual([
      { sidang_id: "1", terhapus_at: "" },
      { sidang_id: "2", terhapus_at: "t2" },
      { sidang_id: "3", terhapus_at: "" },
    ]);
    // Pembaca layar tidak melihatnya.
    expect((await muatSidangCermin(db, "2026-11-05", "2026-11-06")).map((b) => b.sidangId)).toEqual(["1", "3"]);
    expect(await hitunganCermin(db)).toMatchObject({ sidang: 2, sidangTerhapus: 1 });
    // Ditandai sekali: waktu hilang pertama dipertahankan.
    await gantiSidangRentang(db, "2026-11-05", "2026-11-05", [sidang(1, 1, "2026-11-05")], { sekarang: "t3" });
    expect((await baris("SELECT terhapus_at FROM aleta_cermin_sidang WHERE sidang_id = '2'"))[0].terhapus_at).toBe("t2");
    // SIPP memilikinya lagi (sidik sama!) -> hidup lagi.
    const kembali = await gantiSidangRentang(db, "2026-11-05", "2026-11-05", [sidang(1, 1, "2026-11-05"), sidang(2, 2, "2026-11-05")], { sekarang: "t4" });
    expect(kembali.ditulis).toBe(1);
    expect((await baris("SELECT terhapus_at FROM aleta_cermin_sidang WHERE sidang_id = '2'"))[0].terhapus_at).toBe("");
    expect((await muatSidangCermin(db, "2026-11-05", "2026-11-06")).map((b) => b.sidangId).sort()).toEqual(["1", "2", "3"]);
  });

  it("bacaan terpotong tidak menandai apa pun", async () => {
    await simpanJendelaSidang(db, { sidang: [sidang(1, 1, "2026-11-05"), sidang(2, 2, "2026-11-05")] }, "t1");
    const g = await gantiSidangRentang(db, "2026-11-05", "2026-11-05", [sidang(1, 1, "2026-11-05")], { terpotong: true, sekarang: "t2" });
    expect(g.dihapus).toBe(0);
    expect((await baris("SELECT COUNT(*) AS n FROM aleta_cermin_sidang WHERE terhapus_at = ''"))[0].n).toBe(2);
  });

  it("mediasi: hilang -> ditandai, disaring pembaca, hidup lagi; perkara dihapus: sidang & mediasi ditandai, perkara & pihak dihapus", async () => {
    await gantiMediasiRentang(db, "2026-11-05", "2026-11-06", [mediasi(1, 1, "2026-11-05"), mediasi(2, 2, "2026-11-06")], { hapus: true, sekarang: "t1" });
    const g = await gantiMediasiRentang(db, "2026-11-05", "2026-11-06", [mediasi(1, 1, "2026-11-05")], { hapus: true, sekarang: "t2" });
    expect(g.dihapus).toBe(1);
    expect((await baris("SELECT COUNT(*) AS n FROM aleta_cermin_mediasi"))[0].n).toBe(2);
    expect((await muatMediasiCermin(db, "2026-11-05", "2026-11-06", jam)).map((m) => m.mediasiId)).toEqual(["1"]);
    expect(await hitunganCermin(db)).toMatchObject({ mediasi: 1, mediasiTerhapus: 1 });
    const kembali = await gantiMediasiRentang(db, "2026-11-05", "2026-11-06", [mediasi(1, 1, "2026-11-05"), mediasi(2, 2, "2026-11-06")], { hapus: true, sekarang: "t3" });
    expect(kembali.ditulis).toBe(1);
    expect((await muatMediasiCermin(db, "2026-11-05", "2026-11-06", jam)).map((m) => m.mediasiId)).toEqual(["1", "2"]);

    await db.run("INSERT INTO aleta_cermin_perkara (perkara_id, nomor_perkara, cermin_diperbarui) VALUES ('1', '1/Pdt.G/2026/PA.Rekaan', 't1')");
    await simpanJendelaSidang(db, { sidang: [sidang(7, 1, "2026-11-05")] }, "t1");
    await db.run("INSERT INTO aleta_cermin_pihak (id, perkara_id, cermin_diperbarui) VALUES ('x1', '1', 't1')");
    await hapusPerkaraCermin(db, ["1"]);
    expect((await baris("SELECT COUNT(*) AS n FROM aleta_cermin_perkara"))[0].n).toBe(0);
    expect((await baris("SELECT COUNT(*) AS n FROM aleta_cermin_pihak"))[0].n).toBe(0);
    expect((await baris("SELECT terhapus_at FROM aleta_cermin_sidang WHERE sidang_id = '7'"))[0].terhapus_at).not.toBe("");
    expect((await baris("SELECT terhapus_at FROM aleta_cermin_mediasi WHERE id LIKE '1|%'"))[0].terhapus_at).not.toBe("");
    expect(await muatSidangCermin(db, "2026-11-05", "2026-11-05")).toEqual([]);
  });

  it("PENJAGA: setiap SELECT ke aleta_cermin_sidang/mediasi di kode portal menyaring terhapus_at (atau memang menghitung yang terhapus)", () => {
    const berkas = [
      "jadwal-cermin.ts",
      "mediasi.ts",
      "kabar.ts",
      "keadaan-perkara.ts",
      "pencocokan.ts",
      "penyimpan.ts",
      "darurat.ts",
      "antrian-arsip.ts",
      "isi-kolom.ts",
    ];
    const pola = /FROM aleta_cermin_(sidang|mediasi)\b/g;
    let jumlah = 0;
    for (const b of berkas) {
      const kode = baca(`manajemen_surat/src/server/modules/cermin/${b}`);
      for (const m of kode.matchAll(pola)) {
        jumlah++;
        const jendela = kode.slice(m.index ?? 0, (m.index ?? 0) + 230);
        // Menyaring terhapus_at, atau (pengisi baris lama) memang menyisir kolom_diisi = 0 pada semua baris.
        expect(/terhapus_at/.test(jendela) || /kolom_diisi = 0/.test(jendela), `${b}: ${jendela.slice(0, 140)}`).toBe(true);
      }
    }
    expect(jumlah).toBeGreaterThanOrEqual(8);
    // Tidak ada DELETE pada kedua tabel di kode portal.
    for (const b of berkas) {
      expect(baca(`manajemen_surat/src/server/modules/cermin/${b}`), b).not.toMatch(/DELETE FROM aleta_cermin_(sidang|mediasi)/);
    }
  });
});

// ============================================================================
// D. pemindai riwayat mediasi
// ============================================================================
function pengaturan(lebih: Partial<PengaturanCermin> = {}): PengaturanCermin {
  return { ...PENGATURAN_CERMIN_BAWAAN, pemindaiAktif: true, jedaDetik: 15, ...lebih };
}

async function pemindaiSudahSelesai() {
  await tulisJejak(db, KUNCI_JEJAK.pemindai, { ...keadaanPemindaiAwal(), status: "selesai", tahap: "selesai", selesaiPada: "2026-11-01T10:00:00.000Z" });
}

type BotRiwayat = {
  ringkasan: ReturnType<typeof vi.fn>;
  mediasi: ReturnType<typeof vi.fn>;
};

function botRiwayat(opsi: { rentang?: { jumlah: number; awal: string; akhir: string } | null | undefined; baris?: MediasiSumber[]; gagal?: string; terpotong?: (dari: string, sampai: string) => boolean } = {}): BotRiwayat {
  const baris = opsi.baris ?? [];
  const rentang = "rentang" in opsi ? opsi.rentang : { jumlah: baris.length, awal: "2026-09-01", akhir: "2026-11-30" };
  return {
    ringkasan: vi.fn(async () => ({
      ok: true as const,
      data: { perkara: { jumlah: 0, terkecil: 0, terbesar: 0 }, sidang: { jumlah: 0, awal: "", akhir: "" }, mediasi: rentang, hariIni: "2026-11-05" },
    })),
    mediasi: vi.fn(async (dari: string, sampai: string) => {
      if (opsi.gagal) return { ok: false as const, error: opsi.gagal };
      const ada = baris.filter((m) => String(m.tanggal) >= dari && String(m.tanggal) <= sampai);
      return { ok: true as const, data: { dari, sampai, terbaca: true, alasan: "", terpotong: opsi.terpotong?.(dari, sampai) ?? false, mediasi: ada } };
    }),
  };
}

function depsRiwayat(bot: BotRiwayat, p: PengaturanCermin = pengaturan()): DepsRiwayatMediasi {
  return { db: async () => db, bot: bot as unknown as DepsRiwayatMediasi["bot"], pengaturan: async () => p, sekarang: () => jam };
}

const MAJU = (detik: number) => {
  jam = new Date(jam.getTime() + detik * 1000);
};

describe("D. pemindai riwayat mediasi", () => {
  const riwayat = [mediasi(1, 1, "2026-09-03"), mediasi(2, 2, "2026-09-20"), mediasi(3, 3, "2026-10-15"), mediasi(4, 4, "2026-11-20")];

  it("saklar mati: nol panggilan ke bot; belum ada pemindaian awal: juga nol", async () => {
    const bot = botRiwayat({ baris: riwayat });
    expect((await putaranRiwayatMediasi(depsRiwayat(bot, pengaturan({ pemindaiAktif: false })))).alasan).toBe("mati");
    expect((await putaranRiwayatMediasi(depsRiwayat(bot))).alasan).toBe("menunggu-pemindaian");
    expect(bot.ringkasan).not.toHaveBeenCalled();
    expect(bot.mediasi).not.toHaveBeenCalled();
  });

  it("membaca seluruh riwayat bertahap per jendela 31 hari, berjeda 15 detik, lalu selesai dan mencatat rentang lengkapnya", async () => {
    await pemindaiSudahSelesai();
    const bot = botRiwayat({ baris: riwayat });
    const d = depsRiwayat(bot);
    expect(await putaranRiwayatMediasi(d)).toMatchObject({ alasan: "ok", status: "berjalan", diproses: 2 }); // 1-31 Sep memuat 2 baris
    // Jeda: putaran terlalu cepat menunggu dan tidak menyentuh bot.
    const sebelum = bot.mediasi.mock.calls.length;
    expect((await putaranRiwayatMediasi(d)).alasan).toBe("menunggu-jeda");
    expect(bot.mediasi.mock.calls.length).toBe(sebelum);
    let putaran = 1;
    for (; putaran < 20; putaran++) {
      MAJU(16);
      const h = await putaranRiwayatMediasi(d);
      if (h.status === "selesai") break;
    }
    const k = await muatKeadaanRiwayatMediasi(db);
    expect(k).toMatchObject({ status: "selesai", awal: "2026-09-01", akhir: "2026-11-30", selesaiAwal: "2026-09-01", selesaiAkhir: "2026-11-30", diproses: 4 });
    expect(k.selesaiPada).not.toBe("");
    // 3 jendela (1-31 Sep, 1 Okt - 31 Okt, 1 Nov - 30 Nov) -> 3 bacaan jendela, 1 ringkasan.
    expect(bot.mediasi).toHaveBeenCalledTimes(3);
    expect(bot.ringkasan).toHaveBeenCalledTimes(1);
    expect((await baris<{ id: string }>("SELECT id FROM aleta_cermin_mediasi ORDER BY tanggal")).length).toBe(4);
    // Selesai dan belum seminggu: tidak menyentuh bot lagi.
    MAJU(60);
    expect((await putaranRiwayatMediasi(d)).alasan).toBe("selesai");
    expect(bot.mediasi).toHaveBeenCalledTimes(3);
  });

  it("dapat dilanjutkan: kursor tersimpan di jejak, proses dimulai ulang melanjutkan, bukan dari awal", async () => {
    await pemindaiSudahSelesai();
    const bot = botRiwayat({ baris: riwayat });
    expect((await putaranRiwayatMediasi(depsRiwayat(bot))).alasan).toBe("ok");
    expect((await muatKeadaanRiwayatMediasi(db)).kursor).toBe("2026-10-02");
    // "Proses dimulai ulang": ingatan proses hilang, bot baru.
    aturUlangRiwayatMediasi();
    MAJU(16);
    const bot2 = botRiwayat({ baris: riwayat });
    await putaranRiwayatMediasi(depsRiwayat(bot2));
    expect(bot2.ringkasan).not.toHaveBeenCalled();
    expect(bot2.mediasi.mock.calls[0]).toEqual(["2026-10-02", "2026-11-01"]);
  });

  it("jendela terpotong batas baris dikecilkan dan diulang tanpa maju; tidak ada baris yang hilang", async () => {
    await pemindaiSudahSelesai();
    const bot = botRiwayat({ baris: riwayat, terpotong: (dari, sampai) => dari === "2026-09-01" && sampai === "2026-10-01" });
    const d = depsRiwayat(bot);
    await putaranRiwayatMediasi(d);
    let k = await muatKeadaanRiwayatMediasi(db);
    expect(k.kursor).toBe("2026-09-01");
    expect(k.lebarHari).toBe(15);
    MAJU(16);
    await putaranRiwayatMediasi(d);
    k = await muatKeadaanRiwayatMediasi(db);
    expect(k.kursor).toBe("2026-09-16");
  });

  it("galat beruntun: jeda bertambah, lima galat menghentikan; lanjutkan (Super Admin) menjalankannya lagi; paksa melewati jam dan jeda", async () => {
    await pemindaiSudahSelesai();
    const bot = botRiwayat({ baris: riwayat, gagal: "SIPP mati" });
    const d = depsRiwayat(bot);
    for (let i = 0; i < 5; i++) {
      MAJU(700);
      expect((await putaranRiwayatMediasi(d)).alasan).toBe("galat");
    }
    expect((await muatKeadaanRiwayatMediasi(db)).status).toBe("galat");
    MAJU(700);
    const hitung = bot.mediasi.mock.calls.length;
    expect((await putaranRiwayatMediasi(d)).alasan).toBe("galat-berhenti");
    expect(bot.mediasi.mock.calls.length).toBe(hitung);
    expect((await lanjutkanRiwayatMediasi(db)).status).toBe("jeda");
    // Paksa di luar jam kerja (10.00 WITA) dan tanpa menunggu jeda.
    jam = SIANG;
    const sehat = botRiwayat({ baris: riwayat });
    expect((await putaranRiwayatMediasi(depsRiwayat(sehat), { paksa: true })).alasan).toBe("ok");
    expect((await putaranRiwayatMediasi(depsRiwayat(sehat))).alasan).toBe("luar-jendela");
  });

  it("bot lama tanpa rentang mediasi dan tabel tak dikenal dilaporkan sebagai galat, bukan diam-diam selesai", async () => {
    await pemindaiSudahSelesai();
    const lama = botRiwayat({ rentang: undefined });
    expect(await putaranRiwayatMediasi(depsRiwayat(lama))).toMatchObject({ alasan: "galat", pesan: expect.stringContaining("belum mendukung") });
    MAJU(700);
    const takDikenal = botRiwayat({ rentang: null });
    expect(await putaranRiwayatMediasi(depsRiwayat(takDikenal))).toMatchObject({ alasan: "galat", pesan: expect.stringContaining("tidak terbaca") });
    MAJU(700);
    const kosong = botRiwayat({ rentang: { jumlah: 0, awal: "", akhir: "" } });
    expect((await putaranRiwayatMediasi(depsRiwayat(kosong))).status).toBe("selesai");
  });

  it("diulang seminggu sekali: selisih ditulis, yang sudah hilang dari SIPP ditandai terhapus; rentang lengkap lama tetap berlaku selama membaca ulang", async () => {
    await pemindaiSudahSelesai();
    const d1 = depsRiwayat(botRiwayat({ baris: riwayat }));
    for (let i = 0; i < 10; i++) {
      MAJU(16);
      if ((await putaranRiwayatMediasi(d1)).status === "selesai") break;
    }
    const pertama = await muatKeadaanRiwayatMediasi(db);
    expect(pertama.status).toBe("selesai");
    // 8 hari kemudian (malam): mediasi 2 hilang dari SIPP, mediasi 3 hasilnya berubah.
    jam = new Date(MALAM.getTime() + 8 * 86_400_000);
    const baru = [riwayat[0], mediasi(3, 3, "2026-10-15", { hasilTeks: "Tidak berhasil" }), riwayat[3]];
    const sipp2 = botRiwayat({ baris: baru });
    const d2 = depsRiwayat(sipp2);
    const mulai = await putaranRiwayatMediasi(d2);
    expect(mulai.alasan).toBe("ok");
    const tengah = await muatKeadaanRiwayatMediasi(db);
    expect(tengah.status).toBe("berjalan");
    expect(tengah.selesaiPada).toBe(pertama.selesaiPada); // jawaban darurat tidak kehilangan dasarnya
    for (let i = 0; i < 10; i++) {
      MAJU(16);
      if ((await putaranRiwayatMediasi(d2)).status === "selesai") break;
    }
    const hidup = await baris<{ id: string; hasil_teks: string }>("SELECT id, hasil_teks FROM aleta_cermin_mediasi WHERE terhapus_at = '' ORDER BY tanggal");
    expect(hidup.map((x) => x.id.split("|")[0])).toEqual(["1", "3", "4"]);
    expect(hidup[1].hasil_teks).toBe("Tidak berhasil");
    expect((await baris("SELECT COUNT(*) AS n FROM aleta_cermin_mediasi WHERE terhapus_at <> ''"))[0].n).toBe(1);
  });

  it("ulang (Super Admin) memulai dari awal tetapi menyimpan rentang lengkap sebelumnya", async () => {
    await tulisJejak(db, KUNCI_JEJAK.mediasiRiwayat, { ...bersihkanKeadaanRiwayatMediasi(null), status: "selesai", selesaiPada: "2026-11-01T00:00:00.000Z", selesaiAwal: "2026-09-01", selesaiAkhir: "2026-11-30", kursor: "2026-12-01" });
    const k = await ulangRiwayatMediasi(db);
    expect(k).toMatchObject({ status: "belum", kursor: "", selesaiPada: "2026-11-01T00:00:00.000Z", selesaiAwal: "2026-09-01", selesaiAkhir: "2026-11-30" });
  });

  it("detak: saklar mati = bot tidak disentuh sama sekali oleh langkah baru", async () => {
    const bot = { ...botRiwayat({ baris: riwayat }), antrian: vi.fn(), perkara: vi.fn(), sidang: vi.fn(), perkaraId: vi.fn(), perubahan: vi.fn(), idPerkara: vi.fn(), idSidang: vi.fn(), tagKatalog: vi.fn(), tagPerkara: vi.fn() };
    await detakCermin({ db: async () => db, bot: bot as never, pengaturan: async () => pengaturan({ pemindaiAktif: false }), sekarang: () => jam });
    for (const f of Object.values(bot)) expect(f).not.toHaveBeenCalled();
  });
});

// ============================================================================
// E. arsip antrian
// ============================================================================
function arsipSumber(baris: ArsipAntrianSumber["baris"], opsi: { terbaca?: boolean; alasan?: string } = {}): ArsipAntrianSumber {
  return { terbaca: opsi.terbaca ?? true, alasan: opsi.alasan ?? "", dibacaPada: "2026-11-05T02:00:00.000Z", baris };
}

function depsArsip(hasil: () => Promise<{ ok: true; data: ArsipAntrianSumber } | { ok: false; error: string }>, p = pengaturan(), tanpaRute = false): DepsArsipAntrian & { panggil: ReturnType<typeof vi.fn> } {
  const panggil = vi.fn(hasil);
  return { db: async () => db, bot: tanpaRute ? ({} as never) : { antrian: panggil }, pengaturan: async () => p, sekarang: () => jam, panggil };
}

describe("E. arsip antrian pada cermin sidang", () => {
  const sumber = arsipSumber([
    { perkaraId: "100", tanggalSidang: "2026-11-05", nomor: 3, disidang: 1, keadaan: "dipanggil", jamAmbil: "08:10", jamHadirTerakhir: "08:25" },
    { perkaraId: "101", tanggalSidang: "2026-11-05", nomor: null, disidang: null, keadaan: "belum-ambil", jamAmbil: "", jamHadirTerakhir: "" },
  ]);

  beforeEach(async () => {
    jam = SIANG;
    await pemindaiSudahSelesai();
    await simpanJendelaSidang(db, { sidang: [sidang(1, 100, "2026-11-05"), sidang(2, 101, "2026-11-05"), sidang(3, 100, "2026-11-12")] }, "t1");
  });

  it("menyimpan nomor, disidang, keadaan, jam ambil/hadir, dan waktu baca pada sidang tanggal itu saja", async () => {
    const d = depsArsip(async () => ({ ok: true, data: sumber }));
    expect(await putaranArsipAntrian(d)).toMatchObject({ alasan: "ok", baris: 2 });
    const r = await baris("SELECT sidang_id, antrian_nomor, antrian_disidang, antrian_keadaan, antrian_jam_ambil, antrian_jam_hadir, antrian_dibaca_at FROM aleta_cermin_sidang ORDER BY sidang_id");
    expect(r[0]).toMatchObject({ sidang_id: "1", antrian_nomor: 3, antrian_disidang: 1, antrian_keadaan: "dipanggil", antrian_jam_ambil: "08:10", antrian_jam_hadir: "08:25", antrian_dibaca_at: "2026-11-05T02:00:00.000Z" });
    expect(r[1]).toMatchObject({ sidang_id: "2", antrian_nomor: null, antrian_keadaan: "belum-ambil" });
    expect(r[2]).toMatchObject({ sidang_id: "3", antrian_nomor: null, antrian_dibaca_at: "" }); // perkara sama, tanggal lain
    const arsip = await muatArsipAntrian(db, "2026-11-01", "2026-11-30");
    expect(Object.keys(arsip).sort()).toEqual(["100|2026-11-05", "101|2026-11-05"]);
  });

  it("upsert sidang berikutnya tidak menghapus arsip antrian", async () => {
    await putaranArsipAntrian(depsArsip(async () => ({ ok: true, data: sumber })));
    await simpanJendelaSidang(db, { sidang: [sidang(1, 100, "2026-11-05", { agenda: "diubah" })] }, "t9");
    const r = (await baris("SELECT antrian_nomor FROM aleta_cermin_sidang WHERE sidang_id = '1'"))[0];
    expect(r.antrian_nomor).toBe(3);
  });

  it("selang 5 menit; saklar mati, luar jam sidang, bot lama, dan pemindaian belum selesai: tidak memanggil bot", async () => {
    const d = depsArsip(async () => ({ ok: true, data: sumber }));
    await putaranArsipAntrian(d);
    expect((await putaranArsipAntrian(d)).alasan).toBe("menunggu-selang");
    MAJU(301);
    expect((await putaranArsipAntrian(d)).alasan).toBe("ok");
    expect(d.panggil).toHaveBeenCalledTimes(2);

    const mati = depsArsip(async () => ({ ok: true, data: sumber }), pengaturan({ pemindaiAktif: false }));
    expect((await putaranArsipAntrian(mati)).alasan).toBe("mati");
    expect(mati.panggil).not.toHaveBeenCalled();

    jam = MALAM; // 23.00 WITA
    const malam = depsArsip(async () => ({ ok: true, data: sumber }));
    expect((await putaranArsipAntrian(malam)).alasan).toBe("luar-jam");
    expect(malam.panggil).not.toHaveBeenCalled();

    jam = SIANG;
    expect((await putaranArsipAntrian(depsArsip(async () => ({ ok: true, data: sumber }), pengaturan(), true))).alasan).toBe("bot-lama");
    await tulisJejak(db, KUNCI_JEJAK.pemindai, keadaanPemindaiAwal());
    const belum = depsArsip(async () => ({ ok: true, data: sumber }));
    aturUlangArsipAntrian();
    expect((await putaranArsipAntrian(belum)).alasan).toBe("menunggu-pemindaian");
    expect(belum.panggil).not.toHaveBeenCalled();
  });

  it("antrian tidak terbaca atau bot gagal: arsip lama TIDAK ditimpa, selang berlipat dua", async () => {
    await putaranArsipAntrian(depsArsip(async () => ({ ok: true, data: sumber })));
    MAJU(301);
    const gagal = depsArsip(async () => ({ ok: true, data: arsipSumber([], { terbaca: false, alasan: "antrian mati" }) }));
    expect(await putaranArsipAntrian(gagal)).toMatchObject({ alasan: "galat", pesan: "antrian mati" });
    expect((await baris("SELECT antrian_nomor FROM aleta_cermin_sidang WHERE sidang_id = '1'"))[0].antrian_nomor).toBe(3);
    MAJU(301); // galat 1x: selang 10 menit
    expect((await putaranArsipAntrian(gagal)).alasan).toBe("menunggu-selang");
    MAJU(400);
    expect((await putaranArsipAntrian(depsArsip(async () => ({ ok: false, error: "bot mati" })))).alasan).toBe("galat");
  });
});

// ============================================================================
// F. jawaban darurat
// ============================================================================
describe("F. jawaban darurat memakai riwayat mediasi dan arsip antrian", () => {
  const deps = () => ({ db: async () => db, sekarang: () => SIANG });

  it("sidang: arsip antrian ikut sebagai `antrian.arsip` BERPENANDA BASI; antrian langsung tetap terbaca:false", async () => {
    await pemindaiSudahSelesai();
    await tulisJejak(db, KUNCI_JEJAK.pembaruan, { tanda: "", putaranTerakhir: "", panasTerakhir: "2026-11-05T01:12:00.000Z", antrianTanggal: [], terakhir: null, galat: { terakhir: "", pada: "", beruntun: 0 }, tidakTerbaca: [] });
    await simpanJendelaSidang(db, { sidang: [sidang(1, 100, "2026-11-05")] }, "t1");
    jam = SIANG;
    await putaranArsipAntrian(depsArsip(async () => ({ ok: true, data: arsipSumber([{ perkaraId: "100", tanggalSidang: "2026-11-05", nomor: 7, disidang: 2, keadaan: "dipanggil", jamAmbil: "08:00", jamHadirTerakhir: "08:20" }]) })));
    const h = await jadwalSidangDariCerminDarurat({ dari: "2026-11-05", sampai: "2026-11-05" }, deps());
    expect(h).not.toBeNull();
    const a = h!.data.antrian as { terbaca: boolean; peta: Record<string, unknown>; arsip: { basi: boolean; dibacaPada: string; peta: Record<string, { nomor: number }> } };
    expect(a.terbaca).toBe(false);
    expect(a.peta).toEqual({});
    expect(a.arsip.basi).toBe(true);
    expect(a.arsip.dibacaPada).toBe("2026-11-05T02:00:00.000Z");
    expect(a.arsip.peta["100|2026-11-05"]).toMatchObject({ nomor: 7, disidang: 2, jamHadirTerakhir: "08:20" });
  });

  it("sidang tanpa arsip: tanpa ruas arsip, tetap dijawab", async () => {
    await pemindaiSudahSelesai();
    await tulisJejak(db, KUNCI_JEJAK.pembaruan, { tanda: "", putaranTerakhir: "", panasTerakhir: "2026-11-05T01:12:00.000Z", antrianTanggal: [], terakhir: null, galat: { terakhir: "", pada: "", beruntun: 0 }, tidakTerbaca: [] });
    await simpanJendelaSidang(db, { sidang: [sidang(1, 100, "2026-11-05")] }, "t1");
    const h = await jadwalSidangDariCerminDarurat({ dari: "2026-11-05", sampai: "2026-11-05" }, deps());
    expect((h!.data.antrian as Record<string, unknown>).arsip).toBeUndefined();
  });

  async function isiMediasiDanJejak(opsi: { jendela?: [string, string]; riwayat?: [string, string] | null } = {}) {
    await pemindaiSudahSelesai();
    await gantiMediasiRentang(db, "2026-08-01", "2026-12-01", [mediasi(1, 1, "2026-08-10"), mediasi(2, 2, "2026-11-04")], { hapus: false, sekarang: "t1" });
    const [jd, js] = opsi.jendela ?? ["2026-11-02", "2026-11-26"];
    await tulisJejak(db, KUNCI_JEJAK.mediasi, { ...keadaanMediasiAwal(), terakhir: "2026-11-05T01:12:00.000Z", dari: jd, sampai: js });
    if (opsi.riwayat !== null) {
      const [ra, rb] = opsi.riwayat ?? ["2026-08-01", "2026-12-01"];
      await tulisJejak(db, KUNCI_JEJAK.mediasiRiwayat, { ...bersihkanKeadaanRiwayatMediasi(null), status: "selesai", selesaiPada: "2026-11-02T10:00:00.000Z", selesaiAwal: ra, selesaiAkhir: rb });
    }
  }

  it("mediasi: rentang riwayat (di luar jendela layar) dijawab dari riwayat dengan waktu putaran penuh", async () => {
    await isiMediasiDanJejak();
    const h = await mediasiDariCerminDarurat({ dari: "2026-08-01", sampai: "2026-08-31" }, deps());
    expect(h).not.toBeNull();
    expect(h!.data.mediasi.map((m) => m.mediasiId)).toEqual(["1"]);
    expect(h!.data.waktuSinkron).toBe("2026-11-02T10:00:00.000Z");
    expect(h!.data.keterangan).toBe("Data terakhir 02/11 18.00, SIPP sedang tidak terjangkau.");
  });

  it("mediasi: rentang yang hanya tercakup riwayat memakai waktu putaran penuh; jendela saja memakai waktu jendela; di luar keduanya tidak dijawab", async () => {
    await isiMediasiDanJejak();
    const silang = await mediasiDariCerminDarurat({ dari: "2026-10-30", sampai: "2026-11-10" }, deps());
    expect(silang!.data.waktuSinkron).toBe("2026-11-02T10:00:00.000Z");
    // Di dalam jendela layar saja: waktu jendela.
    const dalam = await mediasiDariCerminDarurat({ dari: "2026-11-03", sampai: "2026-11-10" }, deps());
    expect(dalam!.data.waktuSinkron).toBe("2026-11-05T01:12:00.000Z");
    // Di luar riwayat yang tercatat dan di luar jendela.
    expect(await mediasiDariCerminDarurat({ dari: "2026-07-01", sampai: "2026-07-31" }, deps())).toBeNull();
    expect(await mediasiDariCerminDarurat({ dari: "2026-12-10", sampai: "2026-12-20" }, deps())).toBeNull();
  });

  it("mediasi: riwayat belum pernah lengkap -> hanya jendela layar seperti sebelumnya", async () => {
    await isiMediasiDanJejak({ riwayat: null });
    expect(await mediasiDariCerminDarurat({ dari: "2026-08-01", sampai: "2026-08-31" }, deps())).toBeNull();
    expect(await mediasiDariCerminDarurat({ dari: "2026-11-03", sampai: "2026-11-10" }, deps())).not.toBeNull();
  });

  it("mediasi: riwayat dan jendela yang tidak menyambung (ada celah) tidak dijawab untuk rentang yang melintasi celah", async () => {
    await isiMediasiDanJejak({ jendela: ["2026-11-20", "2026-12-10"], riwayat: ["2026-08-01", "2026-10-31"] });
    expect(await mediasiDariCerminDarurat({ dari: "2026-10-01", sampai: "2026-11-25" }, deps())).toBeNull();
    expect(await mediasiDariCerminDarurat({ dari: "2026-10-01", sampai: "2026-10-31" }, deps())).not.toBeNull();
  });

  it("rentang yang menyeberang riwayat dan jendela yang saling menyambung memakai waktu TERTUA dari keduanya", async () => {
    await isiMediasiDanJejak({ jendela: ["2026-11-02", "2026-11-26"], riwayat: ["2026-08-01", "2026-11-03"] });
    const h = await mediasiDariCerminDarurat({ dari: "2026-10-30", sampai: "2026-11-20" }, deps());
    expect(h).not.toBeNull();
    expect(h!.data.waktuSinkron).toBe("2026-11-02T10:00:00.000Z");
  });

  it("baris terhapus lembut tidak ikut dijawab darurat", async () => {
    await isiMediasiDanJejak();
    await gantiMediasiRentang(db, "2026-08-01", "2026-08-31", [], { hapus: true, sekarang: "t5" });
    const h = await mediasiDariCerminDarurat({ dari: "2026-08-01", sampai: "2026-08-31" }, deps());
    expect(h!.data.mediasi).toEqual([]);
  });
});

// ============================================================================
// G. bot
// ============================================================================
describe("G. bot: hanya membaca", () => {
  it("antrianArsip: bentuk datar, jam hadir terakhir = terbesar dari pihak1/pihak2/saksi, tak terbaca dilaporkan", async () => {
    const layanan = muatBot("./services/cerminService.js") as { antrianArsip: (d: unknown) => Promise<ArsipAntrianSumber> };
    const petaPalsu = {
      terbaca: true,
      alasan: "",
      tanggal: ["2026-11-05"],
      peta: {
        "100": { nomor: 3, tanggalSidang: "2026-11-05", waktuAmbil: "08:10", pihak1: "08:10", pihak2: "08:30", saksi: "08:20", keadaan: "dipanggil", disidang: 1 },
        "101": { nomor: null, tanggalSidang: "2026-11-05", waktuAmbil: "", pihak1: "", pihak2: "", saksi: "", keadaan: "belum-ambil", disidang: null },
      },
    };
    const r = await layanan.antrianArsip({ antrianSidangService: { petaAntrian: async () => petaPalsu } });
    expect(r.terbaca).toBe(true);
    expect(r.baris).toEqual([
      { perkaraId: "100", tanggalSidang: "2026-11-05", nomor: 3, disidang: 1, keadaan: "dipanggil", jamAmbil: "08:10", jamHadirTerakhir: "08:30" },
      { perkaraId: "101", tanggalSidang: "2026-11-05", nomor: null, disidang: null, keadaan: "belum-ambil", jamAmbil: "", jamHadirTerakhir: "" },
    ]);
    const gagal = await layanan.antrianArsip({ antrianSidangService: { petaAntrian: async () => ({ terbaca: false, alasan: "antrian mati", peta: {}, tanggal: [] }) } });
    expect(gagal).toMatchObject({ terbaca: false, alasan: "antrian mati", baris: [] });
  });

  it("layanan dan rute baru tidak berisi tulisan SQL, dan tidak satu kata 'Aleta' pada SQL yang menuju SIPP/antrian", () => {
    const layanan = baca("aleta_bot/services/cerminService.js");
    const rute = baca("aleta_bot/routes/cerminRoutes.js");
    const kode = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const s of [kode(layanan), kode(rute)]) {
      expect(s).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|REPLACE\s+INTO|DROP\s|ALTER\s|TRUNCATE|CREATE\s+TABLE)\b/i);
    }
    expect(rute.match(/router\.(post|put|delete|patch)\(/g)).toBeNull();
    // Satu-satunya SQL baru: rentang jadwal mediasi (SELECT) - tanpa kata Aleta.
    const baru = layanan.slice(layanan.indexOf("async function ringkasanMediasi"), layanan.indexOf("const KOLOM_DASAR"));
    expect(baru).toMatch(/SELECT COUNT\(\*\) AS jumlah, MIN\(/);
    expect(kode(baru)).not.toMatch(/aleta/i);
    // Arsip antrian memakai petaAntrian (dua SELECT ke sipp_turunan_antrian), bukan SQL sendiri.
    expect(kode(layanan.slice(layanan.indexOf("async function antrianArsip"), layanan.indexOf("const KOLOM_DASAR")))).not.toMatch(/runQuery|externalDbService|SELECT/);
  });
});
