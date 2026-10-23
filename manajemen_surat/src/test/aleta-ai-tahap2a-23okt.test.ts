// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { newDb } from "pg-mem";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { KATALOG_ALAT, PETA_ALAT, parameterOperasi } from "@/lib/aleta-ai/alat-data";
import { kemampuanDiminta } from "@/lib/aleta-ai/kemampuan";
import type { PermintaanAi } from "@/lib/aleta-ai/penyusun";
import { dataAsliTersisa, PemulihAliran, Penyamar } from "@/lib/aleta-ai/samaran";
import { aksesDataAi, bolehDrafPenetapanAi, bolehKemampuanAi, DAFTAR_KEMAMPUAN_AI, type KemampuanAi } from "@/lib/matriks-peran";
import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ALETA_AI_SAMARAN } from "@/server/db/schema";
import { golonganPelakuAi, type PelakuAi } from "@/server/modules/aleta-ai/akses";
import { alatUntukPelaku, jalankanAlat, suntikSumberDataAi, type SumberDataAi } from "@/server/modules/aleta-ai/alat";
import { suntikKlienAi, type HasilAi, type KlienAi, type OpsiAlir, type PanggilanAlat } from "@/server/modules/aleta-ai/klien";
import { bacaTimpaanKemampuan, simpanTimpaanKemampuan } from "@/server/modules/aleta-ai/kemampuan";
import { simpanKurs, tanggalLokal } from "@/server/modules/aleta-ai/kurs";
import { kirimPesan, ulangiBatasLaju, type EventAi } from "@/server/modules/aleta-ai/mesin";
import { ambilPercakapan, buatPercakapan } from "@/server/modules/aleta-ai/percakapan";
import { unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { terapkanMutasi } from "@/server/modules/aleta-ai/saldo";
import { susunZip } from "@/server/shared/zip";

/**
 * ============================================================================
 * ALETA Ai TAHAP 2a (23 Okt 2026): alat data baca-saja, penyamaran dua arah,
 * matriks kemampuan per peran - semuanya dengan data REKAAN (nama/NIK fiktif)
 * ============================================================================
 *
 *   1. migrasi 0084 (kode samaran): jurnal, berkas = schema.ts, pg-mem, cadangan
 *   2. matriks kemampuan & akses data: tiap peran x tiap kemampuan (10.3/10.4)
 *   3. penyamar: dua arah, pola NIK/telepon/email/rekening, aliran terpotong
 *   4. katalog SQL bot (aletaAiAlatService.js) dijalankan di pg-mem atas SIPP
 *      rekaan; angka dibandingkan hitungan SQL manual (uji rekap 10.4)
 *   5. pelaksana alat: hak, lingkup "milik", fitur mati, perkara bukan milik
 *   6. mesin: putaran alat + UJI KEBOCORAN "tidak ada data asli di permintaan",
 *      jawaban dipulihkan, kode tetap antargiliran, kemampuan ditolak di server
 *   7. rute GET /api/aleta-ai/rekap dan /api/aleta-ai/kemampuan
 */

const ctx = vi.hoisted(() => ({ db: null as unknown, pelaku: null as unknown }));
vi.mock("@/server/db/client", async (asli) => ({
  ...(await asli<typeof import("@/server/db/client")>()),
  getDatabase: async () => ctx.db,
}));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "uji" }));
vi.mock("@/server/modules/aleta-ai/akses", async (asli) => ({
  ...(await asli<typeof import("@/server/modules/aleta-ai/akses")>()),
  pelakuAi: async () => ctx.pelaku,
}));

const AKAR = path.resolve(process.cwd(), "..");
const muatBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
type BotAlat = { jalankan: (alat: string, p: Record<string, unknown>, d: { query: (sql: string, isian?: unknown[]) => Promise<unknown[]> }) => Promise<unknown>; KATALOG: string[] };
const bot = muatBot("./services/aletaAiAlatService.js") as BotAlat;
const { relaasRetur } = muatBot("./services/returRelaas.js") as { relaasRetur: (a: unknown, b: unknown, c?: unknown, d?: unknown) => boolean };

const pernyataan = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((b) => b.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

// "Hari ini" uji: Jumat 23 Okt 2026, 11.00 WITA.
const SEKARANG = new Date("2026-10-23T03:00:00Z");

const pelaku = (id: string, nama: string, peranId: string, extra: Partial<PelakuAi> = {}): PelakuAi => ({ id, nama, peranId, superAdmin: peranId === "super-admin", ...extra });
const HAKIM_SATU = pelaku("usr-h1", "Hakim Satu", "hakim");
const HAKIM_DUA = pelaku("usr-h2", "Hakim Dua", "hakim");
const KETUA = pelaku("usr-kpa", "Ketua Rekaan", "ketua");
const PANITERA = pelaku("usr-pan", "Panitera Kepala", "panitera");
const PP_ALFA = pelaku("usr-pp", "Panitera Alfa", "panitera-pengganti");
const JS_BETA = pelaku("usr-js", "Jurusita Beta", "jurusita");
const KASIR = pelaku("usr-ksr", "Kasir Rekaan", "analis-keuangan");
const PTSP = pelaku("usr-ptsp", "Petugas Rekaan", "operator");
const SEKRETARIS = pelaku("usr-sek", "Sekretaris Rekaan", "sekretaris");
const SUPER = pelaku("usr-super", "Super Rekaan", "super-admin");

// ─── Data SIPP rekaan ────────────────────────────────────────────────────────

const PIHAK_ASLI = {
  sitiNama: "Siti Rekaan binti Ahmad Fiktif",
  sitiNik: "7203014509900001",
  sitiAlamat: "Jalan Mawar Rekaan Nomor 7 RT 001",
  sitiTelepon: "081234567890",
  sitiEmail: "siti.rekaan@contoh.test",
  budiNama: "Budi Rekaan bin Umar Fiktif",
  budiNik: "7203011203880002",
  budiAlamat: "Dusun Melati Rekaan RT 003",
};

const DDL_SIPP = `
CREATE TABLE perkara (perkara_id INTEGER PRIMARY KEY, nomor_perkara TEXT, jenis_perkara_id INTEGER, jenis_perkara_nama TEXT, alur_perkara_id INTEGER,
  tanggal_pendaftaran DATE, tahapan_terakhir_text TEXT, proses_terakhir_text TEXT, para_pihak TEXT);
CREATE TABLE perkara_putusan (perkara_id INTEGER, tanggal_putusan DATE, tanggal_bht DATE, tanggal_minutasi DATE, status_putusan_nama TEXT, amar_putusan TEXT);
CREATE TABLE perkara_hakim_pn (perkara_id INTEGER, hakim_nama TEXT, jabatan_hakim_id INTEGER, aktif TEXT);
CREATE TABLE perkara_panitera_pn (perkara_id INTEGER, panitera_nama TEXT, aktif TEXT);
CREATE TABLE perkara_jurusita (perkara_id INTEGER, jurusita_nama TEXT, aktif TEXT);
CREATE TABLE perkara_pelaksanaan_relaas (id INTEGER, perkara_id INTEGER, pihak_id INTEGER, tanggal_relaas DATE, ket_temu TEXT, status_pos INTEGER, ket_hasil_relaas TEXT, no_resi_pos TEXT);
CREATE TABLE perkara_jadwal_sidang (id INTEGER, perkara_id INTEGER, urutan INTEGER, tanggal_sidang DATE, jam_sidang TEXT, agenda TEXT, ditunda TEXT, alasan_ditunda TEXT);
CREATE TABLE perkara_pihak1 (id INTEGER, perkara_id INTEGER, pihak_id INTEGER, nama TEXT, alamat TEXT, urutan INTEGER);
CREATE TABLE perkara_pihak2 (id INTEGER, perkara_id INTEGER, pihak_id INTEGER, nama TEXT, alamat TEXT, urutan INTEGER);
CREATE TABLE pihak (id INTEGER, nama TEXT, nomor_indentitas TEXT, alamat TEXT, telepon TEXT, email TEXT, tempat_lahir TEXT, tanggal_lahir DATE, jenis_kelamin TEXT, agama_nama TEXT, pekerjaan TEXT);
`;

const PERKARA = [
  [1, "101/Pdt.G/2026/PA.Dgl", 347, "Cerai Gugat", 15, "2026-03-02"],
  [2, "102/Pdt.G/2026/PA.Dgl", 346, "Cerai Talak", 15, "2026-07-10"],
  [3, "103/Pdt.P/2026/PA.Dgl", 362, "Dispensasi Kawin", 16, "2026-08-01"],
  [4, "104/Pdt.G/2026/PA.Dgl", 347, "Cerai Gugat", 15, "2026-09-15"],
  [5, "90/Pdt.G/2025/PA.Dgl", 347, "Cerai Gugat", 15, "2025-12-01"],
] as const;
const PUTUSAN = [
  [3, "2026-09-01", null],
  [4, "2026-10-20", null],
  [5, "2026-02-01", "2026-02-20"],
] as const;
const HAKIM = [
  [1, "Drs. Hakim Satu, M.H.", 1, "Y"],
  [1, "Hakim Dua, S.H.I.", 2, "Y"],
  [1, "Hakim Lama, S.Ag.", 1, "T"],
  [2, "Hakim Dua, S.H.I.", 1, "Y"],
  [3, "Drs. Hakim Satu, M.H.", 1, "Y"],
  [4, "Hakim Dua, S.H.I.", 1, "Y"],
  [5, "Drs. Hakim Satu, M.H.", 1, "Y"],
] as const;
const PP = [
  [1, "Panitera Alfa, S.H."],
  [2, "Panitera Gamma"],
  [3, "Panitera Alfa, S.H."],
  [4, "Panitera Gamma"],
] as const;
const JS = [
  [1, "Jurusita Beta"],
  [2, "Jurusita Beta"],
  [3, "Jurusita Delta"],
  [4, "Jurusita Delta"],
] as const;
// id, perkara, pihak, tanggal, ket_temu, status_pos, hasil, resi
const RELAAS = [
  [1, 1, 12, "2026-08-05", "S", 2, "surat dikembalikan oleh pos", ""],
  [2, 1, 12, "2026-09-10", "L", null, "bertemu langsung dengan yang bersangkutan", ""],
  [3, 2, null, "2026-08-20", "S", null, "failed to delivery, alamat tidak ditemukan", ""],
  [4, 2, null, "2026-10-01", "S", 1, "diterima", ""],
  [5, 3, null, "2026-08-03", "S", null, "pihak telah pindah alamat", "RR123"],
  [6, 3, null, "2026-06-01", "S", 2, "dikembalikan", ""],
  [7, 4, null, "2026-09-20", "T", null, "tidak ditemukan di tempat", ""],
] as const;
const SIDANG = [
  [1, 1, 1, "2026-10-19", "Pemanggilan Tergugat Budi Rekaan"],
  [2, 2, 1, "2026-10-21", "Mediasi"],
  [3, 1, 2, "2026-10-26", "Pembuktian"],
  [4, 2, 2, "2026-10-14", "Jawaban"],
] as const;

const lit = (v: unknown) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const sisip = (tabel: string, kolom: string, baris: ReadonlyArray<ReadonlyArray<unknown>>) =>
  baris.map((b) => `INSERT INTO ${tabel} (${kolom}) VALUES (${b.map(lit).join(", ")});`).join("\n");

function sippRekaan() {
  const mem = newDb();
  mem.public.none(DDL_SIPP);
  mem.public.none(
    [
      sisip("perkara", "perkara_id, nomor_perkara, jenis_perkara_id, jenis_perkara_nama, alur_perkara_id, tanggal_pendaftaran", PERKARA),
      sisip("perkara_putusan", "perkara_id, tanggal_putusan, tanggal_bht", PUTUSAN),
      sisip("perkara_hakim_pn", "perkara_id, hakim_nama, jabatan_hakim_id, aktif", HAKIM),
      sisip("perkara_panitera_pn", "perkara_id, panitera_nama, aktif", PP.map((x) => [...x, "Y"])),
      sisip("perkara_jurusita", "perkara_id, jurusita_nama, aktif", JS.map((x) => [...x, "Y"])),
      sisip("perkara_pelaksanaan_relaas", "id, perkara_id, pihak_id, tanggal_relaas, ket_temu, status_pos, ket_hasil_relaas, no_resi_pos", RELAAS),
      sisip("perkara_jadwal_sidang", "id, perkara_id, urutan, tanggal_sidang, agenda", SIDANG),
      sisip("perkara_pihak1", "id, perkara_id, pihak_id, nama, alamat, urutan", [[1, 1, 11, PIHAK_ASLI.sitiNama, PIHAK_ASLI.sitiAlamat, 1]]),
      sisip("perkara_pihak2", "id, perkara_id, pihak_id, nama, alamat, urutan", [[1, 1, 12, PIHAK_ASLI.budiNama, PIHAK_ASLI.budiAlamat, 1]]),
      sisip("pihak", "id, nama, nomor_indentitas, alamat, telepon, email, tempat_lahir, tanggal_lahir, jenis_kelamin, agama_nama, pekerjaan", [
        [11, PIHAK_ASLI.sitiNama, PIHAK_ASLI.sitiNik, PIHAK_ASLI.sitiAlamat, PIHAK_ASLI.sitiTelepon, PIHAK_ASLI.sitiEmail, "Donggala", "1990-09-05", "P", "Islam", "Mengurus Rumah Tangga"],
        [12, PIHAK_ASLI.budiNama, PIHAK_ASLI.budiNik, PIHAK_ASLI.budiAlamat, "", "", "Palu", "1988-03-12", "L", "Islam", "Petani"],
      ]),
      `UPDATE perkara SET tahapan_terakhir_text = 'Persidangan', proses_terakhir_text = 'Sidang Pertama', para_pihak = '${PIHAK_ASLI.sitiNama} melawan ${PIHAK_ASLI.budiNama}' WHERE perkara_id = 1;`,
    ].join("\n")
  );
  const { Client } = mem.adapters.createPg();
  const klien = new Client();
  const kueri: string[] = [];
  const query = async (sql: string, isian: unknown[] = []) => {
    kueri.push(sql);
    let n = 0;
    const teksPg = sql.replace(/\?/g, () => `$${++n}`);
    const r = await klien.query(teksPg, isian);
    return r.rows as unknown[];
  };
  return { mem, query, kueri };
}

// ─── 1. Migrasi 0084 ─────────────────────────────────────────────────────────

describe("migrasi 0084 - kode samaran per percakapan", () => {
  const SQL = path.join(process.cwd(), "drizzle", "0084_aleta_ai_samaran.sql");

  it("jurnal: 0084 sekali, sesudah 0083, tanpa lubang, when naik", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: Array<{ idx: number; tag: string; when: number }> };
    expect(j.entries.map((e) => e.idx)).toEqual(j.entries.map((_, i) => i));
    const ini = j.entries.filter((e) => e.tag.startsWith("0084_"));
    expect(ini).toEqual([expect.objectContaining({ tag: "0084_aleta_ai_samaran" })]);
    const sebelum = j.entries.find((e) => e.idx === ini[0]!.idx - 1)!;
    expect(sebelum.tag.startsWith("0083_") || sebelum.tag.startsWith("0082_")).toBe(true);
    expect(ini[0]!.when).toBeGreaterThan(sebelum.when);
  });

  it("pernyataan berkas = DDL_ALETA_AI_SAMARAN, jalan di pg-mem, ikut cadangan, tanpa kunci asing/CHECK", () => {
    const teks = readFileSync(SQL, "utf8");
    expect(pernyataan(teks)).toEqual([...DDL_ALETA_AI_SAMARAN.tabel, ...DDL_ALETA_AI_SAMARAN.indeks].map((s) => pernyataan(s)[0]));
    const kosong = newDb();
    kosong.public.none(teks);
    expect(kosong.public.many(`SELECT * FROM aleta_ai_samaran`)).toEqual([]);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_ai_samaran");
    expect(/REFERENCES|FOREIGN KEY|CHECK\s*\(/i.test(teks.replace(/--.*$/gm, ""))).toBe(false);
  });
});

// ─── 2. Matriks kemampuan ────────────────────────────────────────────────────

describe("matriks kemampuan per peran (rencana 10.3) - tiap peran x tiap kemampuan", () => {
  const PERAN: Record<string, PelakuAi> = {
    ketua: KETUA,
    wakil: pelaku("w", "Wakil", "wakil-ketua"),
    hakim: HAKIM_SATU,
    panitera: PANITERA,
    panmud: pelaku("pm", "Panmud", "panitera-muda"),
    pp: PP_ALFA,
    js: JS_BETA,
    sekretaris: SEKRETARIS,
    kasir: KASIR,
    ptsp: PTSP,
  };
  // Tabel 10.3 apa adanya: Ketua, Wakil, Hakim, Panitera, Panmud, PP, JS, Sekretaris, Kasir, PTSP.
  const HARAP: Record<KemampuanAi, string> = {
    "tanya-data": "1111111110",
    "draf-putusan": "1110000000",
    "draf-penetapan": "1111100000",
    "draf-bas": "1111110000",
    relaas: "1111111000",
    "surat-dinas": "1101100100",
    "laporan-kinerja": "1111100100",
    "rekap-kasir": "1101100110",
  };

  it("bawaan sama dengan tabel rencana; Admin & Super Admin selalu boleh", () => {
    const urut = Object.keys(PERAN);
    for (const k of DAFTAR_KEMAMPUAN_AI) {
      const nyata = urut.map((r) => (bolehKemampuanAi(golonganPelakuAi(PERAN[r]!), k) ? "1" : "0")).join("");
      expect(nyata, k).toBe(HARAP[k]);
      expect(bolehKemampuanAi(golonganPelakuAi(SUPER), k)).toBe(true);
      expect(bolehKemampuanAi({ roleId: "admin" }, k)).toBe(true);
    }
  });

  it("penetapan per jenis: hakim hanya PHS, panitera PPP/PJS, ketua semua", () => {
    expect(bolehDrafPenetapanAi(golonganPelakuAi(HAKIM_SATU), "PHS")).toBe(true);
    expect(bolehDrafPenetapanAi(golonganPelakuAi(HAKIM_SATU), "PMH")).toBe(false);
    expect(bolehDrafPenetapanAi(golonganPelakuAi(PANITERA), "PPP")).toBe(true);
    expect(bolehDrafPenetapanAi(golonganPelakuAi(PANITERA), "PHS")).toBe(false);
    expect(bolehDrafPenetapanAi(golonganPelakuAi(KETUA), "PMH")).toBe(true);
    expect(bolehDrafPenetapanAi(golonganPelakuAi(PP_ALFA), "PPP")).toBe(false);
  });

  it("akses data: hakim milik+rekap umum, PP milik, JS relaas milik, kasir/PTSP/sekretaris tanpa data perkara", () => {
    const a = (p: PelakuAi) => ["perkara", "relaas", "rekap"].map((b) => aksesDataAi(golonganPelakuAi(p), b as "perkara") ?? "-").join(",");
    expect(a(KETUA)).toBe("semua,semua,semua");
    expect(a(HAKIM_SATU)).toBe("milik,milik,semua");
    expect(a(PANITERA)).toBe("semua,semua,semua");
    expect(a(PP_ALFA)).toBe("milik,milik,milik");
    expect(a(JS_BETA)).toBe("-,milik,-");
    expect(a(KASIR)).toBe("-,-,-");
    expect(a(PTSP)).toBe("-,-,-");
    expect(a(SEKRETARIS)).toBe("-,-,-");
    // Keputusan pengguna 23 Okt: Analis Perkara membaca semua perkara (aturan tetap).
    expect(a(pelaku("an", "Analis Rekaan", "analis-perkara"))).toBe("semua,semua,semua");
  });

  it("pengenal permintaan: hanya permintaan MEMBUAT yang dinilai; jenis penetapan terbaca", () => {
    expect(kemampuanDiminta("apa itu penetapan PMH?", "cepat-bantuan")).toEqual([]);
    expect(kemampuanDiminta("buatkan draf penetapan PMH perkara 101", "teliti-ringkas")).toEqual([{ kemampuan: "draf-penetapan", jenisPenetapan: "PMH" }]);
    expect(kemampuanDiminta("susun BAS sidang kedua", "teliti-ringkas")).toEqual([{ kemampuan: "draf-bas" }]);
    expect(kemampuanDiminta("Putusan Lengkap", "mendalam-putusan")).toEqual([{ kemampuan: "draf-putusan" }]);
    expect(kemampuanDiminta("buatkan ringkasan putusan perkara 101/Pdt.G/2026/PA.Dgl", "teliti-ringkas")).toEqual([]);
    expect(kemampuanDiminta("tolong buat daftar perkara yang belum putusan", "cepat-bantuan")).toEqual([]);
    expect(kemampuanDiminta("Buatkan draf putusan verstek", "teliti-ringkas")).toEqual([{ kemampuan: "draf-putusan" }]);
    expect(kemampuanDiminta("tolong susunkan konsep surat dinas ke Badilag", "teliti-ringkas")).toEqual([{ kemampuan: "surat-dinas" }]);
    expect(kemampuanDiminta("buat ringkasan sidang hari ini", "teliti-ringkas")).toEqual([{ kemampuan: "draf-bas" }]);
  });
});

// ─── 3. Penyamar ─────────────────────────────────────────────────────────────

describe("penyamaran dua arah", () => {
  it("nama, NIK, alamat, telepon, email, rekening -> kode; pulihkan mengembalikan persis", () => {
    const p = new Penyamar();
    const data = p.samarkanData({ nama: PIHAK_ASLI.sitiNama, nik: PIHAK_ASLI.sitiNik, alamat: PIHAK_ASLI.sitiAlamat, telepon: PIHAK_ASLI.sitiTelepon, email: PIHAK_ASLI.sitiEmail, pekerjaan: "Petani" });
    expect(data).toEqual({ nama: "[NAMA-1]", nik: "[NIK-1]", alamat: "[ALAMAT-1]", telepon: "[TELEPON-1]", email: "[EMAIL-1]", pekerjaan: "Petani" });
    const bebas = p.samarkan(`Siti Rekaan menelepon dari 0812-3456-7891, rek. no 1234 5678 9012, NIK 7203019999990003, surel budi@contoh.test`);
    expect(bebas).toBe("[NAMA-1] menelepon dari [TELEPON-2], rek. no [REKENING-1], NIK [NIK-2], surel [EMAIL-2]");
    expect(dataAsliTersisa(bebas, ["Siti Rekaan", "081234567891", "123456789012", "7203019999990003", "budi@contoh.test"])).toEqual([]);
    expect(p.pulihkan("[NAMA-1] (NIK [NIK-1]) tinggal di [ALAMAT-1]; [KODE-9] tetap")).toBe(`${PIHAK_ASLI.sitiNama} (NIK ${PIHAK_ASLI.sitiNik}) tinggal di ${PIHAK_ASLI.sitiAlamat}; [KODE-9] tetap`);
  });

  it("kode tetap sama sesudah dimuat ulang (antargiliran); kata yang memuat nama tidak ikut terganti", () => {
    const p1 = new Penyamar();
    p1.daftar("NAMA", "Ali Rekaan");
    const p2 = new Penyamar(p1.entri());
    expect(p2.samarkan("ali rekaan datang; Alian Rekaanto tidak")).toBe("[NAMA-1] datang; Alian Rekaanto tidak");
    expect(p2.daftar("NAMA", "Nama Baru")).toBe("[NAMA-2]");
    expect(p2.baru.map((e) => e.kode)).toEqual(["[NAMA-2]"]);
  });

  it("aliran: kode yang terpotong di antara dua potongan tetap dipulihkan", () => {
    const p = new Penyamar([{ kode: "[NAMA-1]", jenis: "NAMA", asli: "Siti Rekaan" }]);
    const a = new PemulihAliran(p);
    const keluar = ["Penggugat [NA", "MA-1", "] hadir. Lalu [", "x] ", "[NAMA-1]."].map((x) => a.dorong(x)).join("") + a.akhir();
    expect(keluar).toBe("Penggugat Siti Rekaan hadir. Lalu [x] Siti Rekaan.");
  });
});

// ─── 4. Katalog SQL bot atas SIPP rekaan ─────────────────────────────────────

describe("katalog alat bot (SELECT berparameter) di pg-mem - angka = hitungan manual", () => {
  const sipp = sippRekaan();

  it("katalog tertutup: nama di luar katalog ditolak, tidak ada SQL bebas; semua kueri SELECT", async () => {
    await expect(bot.jalankan("DROP TABLE perkara", {}, { query: sipp.query })).rejects.toThrow(/alat_tidak_dikenal/);
    await expect(bot.jalankan("rekap.relaas", { dari: "2026-07-23'; --", sampai: "2026-10-23" }, { query: sipp.query })).rejects.toThrow(/parameter_tanggal_salah/);
    expect(new Set(KATALOG_ALAT.map((a) => a.operasi))).toEqual(new Set(bot.KATALOG));
    for (const a of KATALOG_ALAT) await bot.jalankan(a.operasi, parameterOperasi(a, a.name === "data_perkara" ? { nomor: "101/Pdt.G/2026/PA.Dgl" } : {}, SEKARANG), { query: sipp.query });
    expect(sipp.kueri.length).toBeGreaterThan(10);
    for (const q of sipp.kueri) expect(q.trim()).toMatch(/^SELECT\b/i);
  });

  it("relaas retur 3 bulan: sama dengan SQL manual dan aturan returRelaas", async () => {
    const r = (await bot.jalankan("rekap.relaas", { dari: "2026-07-23", sampai: "2026-10-23" }, { query: sipp.query })) as { baris: Array<{ retur: boolean; nomor: string; js: string[] }> };
    const manual = sipp.mem.public.many(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN status_pos = 2 OR ket_hasil_relaas LIKE '%failed%' OR (ket_temu = 'S' AND ket_hasil_relaas LIKE '%pindah%') THEN 1 ELSE 0 END) AS retur
         FROM perkara_pelaksanaan_relaas WHERE tanggal_relaas >= '2026-07-23' AND tanggal_relaas <= '2026-10-23'`
    )[0] as { n: number; retur: number };
    expect(r.baris).toHaveLength(Number(manual.n));
    expect(r.baris.filter((b) => b.retur)).toHaveLength(Number(manual.retur));
    const aturan = RELAAS.filter((x) => x[3] >= "2026-07-23" && x[3] <= "2026-10-23").filter((x) => relaasRetur(x[5], x[6], x[4], x[7]));
    expect(r.baris.filter((b) => b.retur)).toHaveLength(aturan.length);
    expect(aturan.map((x) => x[0])).toEqual([1, 3, 5]);
    expect(r.baris.find((b) => b.nomor === "101/Pdt.G/2026/PA.Dgl")?.js).toEqual(["Jurusita Beta"]);
  });

  it("sisa, lewat 5 bulan, BHT tertunda, beban majelis, jadwal minggu ini", async () => {
    const jalan = (op: string, p: Record<string, unknown>) => bot.jalankan(op, p, { query: sipp.query }) as Promise<{ baris: Array<Record<string, unknown>> }>;
    expect((await jalan("rekap.sisa", { per: "2026-10-23" })).baris.map((b) => b.nomor)).toEqual(["101/Pdt.G/2026/PA.Dgl", "102/Pdt.G/2026/PA.Dgl"]);
    expect((await jalan("rekap.sisa", { per: "2026-09-30" })).baris.map((b) => b.nomor)).toEqual(["101/Pdt.G/2026/PA.Dgl", "102/Pdt.G/2026/PA.Dgl", "104/Pdt.G/2026/PA.Dgl"]);
    expect((await jalan("rekap.bht", { dari: "2025-10-23", per: "2026-10-23" })).baris.map((b) => b.nomor)).toEqual(["103/Pdt.P/2026/PA.Dgl", "104/Pdt.G/2026/PA.Dgl"]);
    const tunjuk = await jalan("rekap.penunjukan", { dari: "2026-01-01", sampai: "2026-10-23" });
    expect(tunjuk.baris.map((b) => [b.nomor, b.ketua])).toEqual([
      ["101/Pdt.G/2026/PA.Dgl", "Drs. Hakim Satu, M.H."],
      ["102/Pdt.G/2026/PA.Dgl", "Hakim Dua, S.H.I."],
      ["103/Pdt.P/2026/PA.Dgl", "Drs. Hakim Satu, M.H."],
      ["104/Pdt.G/2026/PA.Dgl", "Hakim Dua, S.H.I."],
    ]);
    // Hakim yang tidak aktif lagi tidak ikut majelis.
    expect(tunjuk.baris[0]?.majelis).toEqual(["Drs. Hakim Satu, M.H.", "Hakim Dua, S.H.I."]);
    expect((await jalan("rekap.sidang", { dari: "2026-10-19", sampai: "2026-10-25" })).baris.map((b) => b.tanggal)).toEqual(["2026-10-19", "2026-10-21"]);
  });

  it("paket satu perkara: pihak, relaas (untuk siapa), jadwal; nomor tak persis -> kandidat", async () => {
    const p = (await bot.jalankan("perkara.paket", { nomor: "101/Pdt.G/2026/PA.Dgl" }, { query: sipp.query })) as Record<string, any>;
    expect(p.ditemukan).toBe(true);
    expect(p.pihak.map((x: { pihakKe: number; nama: string; nik: string }) => [x.pihakKe, x.nama, x.nik])).toEqual([
      [1, PIHAK_ASLI.sitiNama, PIHAK_ASLI.sitiNik],
      [2, PIHAK_ASLI.budiNama, PIHAK_ASLI.budiNik],
    ]);
    expect(p.relaas[0]).toMatchObject({ tanggal: "2026-08-05", untuk: PIHAK_ASLI.budiNama, retur: true });
    expect(p.petugas).toMatchObject({ ketua: "Drs. Hakim Satu, M.H.", pp: ["Panitera Alfa, S.H."] });
    const k = (await bot.jalankan("perkara.paket", { nomor: "/Pdt.G/2026" }, { query: sipp.query })) as { ditemukan: boolean; kandidat: string[] };
    expect(k.ditemukan).toBe(false);
    expect(k.kandidat).toHaveLength(3);
  });
});

// ─── 5. Pelaksana alat (hak, lingkup, fitur mati) ────────────────────────────

const sipp = sippRekaan();
const sumberRekaan: SumberDataAi = {
  async jalankan(operasi, parameter) {
    try {
      return { ok: true, data: await bot.jalankan(operasi, parameter, { query: sipp.query }) };
    } catch (e) {
      return { ok: false, galat: e instanceof Error ? e.message : "" };
    }
  },
};

describe("pelaksana alat: hak peran, lingkup milik, fitur mati", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
  }, 180000);
  afterAll(async () => {
    suntikSumberDataAi(undefined);
    await db?.close();
  });
  const k = (p: PelakuAi, penyamar: Penyamar | null = null) => ({ db, pelaku: p, timpaan: null, sekarang: SEKARANG, penyamar });
  const angka = async (p: PelakuAi) => {
    const h = await jalankanAlat(k(p), "rekap_relaas_retur", {});
    return h.status === "ok" ? h.rekap!.angka : h.status;
  };

  it("FITUR MATI tanpa env/akun baca-saja: tidak ada alat ditawarkan, panggilan menjawab 'mati'", async () => {
    suntikSumberDataAi(undefined);
    const lama = process.env.ALETA_AI_ALAT_DATA;
    delete process.env.ALETA_AI_ALAT_DATA;
    expect(alatUntukPelaku(KETUA, null)).toEqual([]);
    expect((await jalankanAlat(k(KETUA), "rekap_sisa_perkara", {})).status).toBe("mati");
    process.env.ALETA_AI_ALAT_DATA = lama ?? "";
    // Bot tanpa akun SIPP baca-saja: juga "mati", bukan galat mentah.
    suntikSumberDataAi({ jalankan: async () => ({ ok: false, galat: "Bridge SIPP JLF menolak operasi: akun_baca_ai_belum_ada" }) });
    const h = await jalankanAlat(k(KETUA), "rekap_sisa_perkara", {});
    expect(h).toMatchObject({ status: "mati" });
    expect(JSON.stringify(h.isi)).not.toMatch(/akun_baca|Bridge/);
  });

  it("rekap retur menurut lingkup: ketua/hakim semua satker, PP & JS hanya perkaranya, PTSP/kasir/sekretaris ditolak", async () => {
    suntikSumberDataAi(sumberRekaan);
    expect(await angka(KETUA)).toEqual({ relaas: 6, perkara_berelaas: 4, relaas_retur: 3, perkara_retur: 3 });
    expect(await angka(HAKIM_DUA)).toEqual({ relaas: 6, perkara_berelaas: 4, relaas_retur: 3, perkara_retur: 3 });
    expect(await angka(PP_ALFA)).toEqual({ relaas: 3, perkara_berelaas: 2, relaas_retur: 2, perkara_retur: 2 });
    expect(await angka(JS_BETA)).toEqual({ relaas: 4, perkara_berelaas: 2, relaas_retur: 2, perkara_retur: 2 });
    for (const p of [PTSP, KASIR, SEKRETARIS]) expect(await angka(p)).toBe("tolak");
    expect(alatUntukPelaku(PTSP, null)).toEqual([]);
    expect(alatUntukPelaku(JS_BETA, null).map((a) => a.name)).toEqual(["rekap_relaas_retur", "data_perkara"]);
    const jejak = await db.queryAll<{ hasil: string; pengguna_id: string }>(`SELECT hasil, pengguna_id FROM aleta_ai_jejak WHERE aksi = 'alat' AND pengguna_id = ?`, [PTSP.id]);
    expect(jejak.map((j) => j.hasil)).toEqual(["tolak"]);
  });

  it("rekap lain + cara hitung disebut", async () => {
    suntikSumberDataAi(sumberRekaan);
    const sisa = await jalankanAlat(k(KETUA), "rekap_sisa_perkara", {});
    expect(sisa.rekap?.angka).toEqual({ sisa: 2 });
    expect(sisa.rekap?.cara_hitung).toMatch(/sampai 2026-10-23.*2 perkara/);
    expect((await jalankanAlat(k(KETUA), "rekap_perkara_lewat_5_bulan", {})).rekap?.nomor_perkara).toEqual(["101/Pdt.G/2026/PA.Dgl"]);
    expect((await jalankanAlat(k(KETUA), "rekap_bht_tertunda", {})).rekap?.nomor_perkara).toEqual(["103/Pdt.P/2026/PA.Dgl"]);
    const beban = await jalankanAlat(k(KETUA), "rekap_beban_majelis", {});
    expect(beban.rekap?.rincian.per_ketua_majelis).toEqual([
      { kunci: "Drs. Hakim Satu, M.H.", jumlah: 2 },
      { kunci: "Hakim Dua, S.H.I.", jumlah: 2 },
    ]);
    expect((await jalankanAlat(k(KETUA), "rekap_jadwal_sidang", {})).rekap?.angka).toEqual({ sidang: 2, perkara: 2 });
    expect((await jalankanAlat(k(KETUA), "rekap_relaas_retur", { dari: "kemarin" })).status).toBe("galat");
  });

  it("data perkara: hakim bukan majelisnya ditolak; JS hanya bagian relaas; untuk model identitas tersamar", async () => {
    suntikSumberDataAi(sumberRekaan);
    const lain = pelaku("usr-h3", "Hakim Tiga", "hakim");
    expect((await jalankanAlat(k(lain), "data_perkara", { nomor: "101/Pdt.G/2026/PA.Dgl" })).status).toBe("tolak");
    const js = await jalankanAlat(k(JS_BETA), "data_perkara", { nomor: "101/Pdt.G/2026/PA.Dgl", bagian: ["pihak", "relaas"] });
    expect(js.status).toBe("ok");
    expect(js.isi.pihak).toBeUndefined();
    expect(js.isi.catatan_hak).toMatch(/pihak/);
    const penyamar = new Penyamar();
    const h = await jalankanAlat(k(HAKIM_SATU, penyamar), "data_perkara", { nomor: "101/Pdt.G/2026/PA.Dgl", bagian: ["ringkas", "pihak", "jadwal", "relaas"] });
    expect(h.status).toBe("ok");
    const teks = JSON.stringify(h.isi);
    expect(dataAsliTersisa(teks, Object.values(PIHAK_ASLI).concat(["Siti Rekaan", "Budi Rekaan"]))).toEqual([]);
    expect(teks).toContain("Drs. Hakim Satu, M.H."); // pejabat tidak disamarkan
    const d = (h.isi as { data_perkara: { pihak: Array<{ sebutan: string; nama: string }>; jadwal_sidang: Array<{ agenda: string }>; relaas: Array<{ untuk: string }> } }).data_perkara;
    expect(d.pihak.map((x) => [x.sebutan, x.nama])).toEqual([
      ["Penggugat", "[NAMA-1]"],
      ["Tergugat", "[NAMA-2]"],
    ]);
    expect(d.jadwal_sidang[0]?.agenda).toBe("Pemanggilan Tergugat [NAMA-2]");
    expect(d.relaas[0]?.untuk).toBe("[NAMA-2]");
    // Untuk pengguna (rute daftar): data asli.
    const asli = await jalankanAlat(k(HAKIM_SATU), "data_perkara", { nomor: "101/Pdt.G/2026/PA.Dgl", bagian: ["pihak"] });
    expect(JSON.stringify(asli.isi)).toContain(PIHAK_ASLI.sitiNama);
  });
});

// ─── 6. Mesin: putaran alat & uji kebocoran ──────────────────────────────────

type Jawaban = { teks?: string[]; alat?: PanggilanAlat[] };

class KlienAlatTiruan implements KlienAi {
  panggilan: PermintaanAi[] = [];
  constructor(private antrean: Jawaban[]) {}
  async alirkan(p: PermintaanAi, opsi: OpsiAlir = {}): Promise<HasilAi> {
    this.panggilan.push(JSON.parse(JSON.stringify(p)) as PermintaanAi);
    if (p.system[0]?.text.startsWith("Anda pengklasifikasi")) {
      return { teks: '{"kelompok":"teliti-ringkas","yakin":0.9}', berhenti: "selesai", model: p.model, penggunaan: { masuk: 100, keluar: 10, cacheTulis: 0, cacheBaca: 0 }, iterasi: [], kategoriTolak: "", dialihkan: false };
    }
    const j = this.antrean.shift() ?? { teks: ["Selesai."] };
    let teks = "";
    for (const t of j.teks ?? []) {
      await Promise.resolve();
      teks += t;
      opsi.onTeks?.(t);
    }
    const konten = [...(teks ? [{ type: "text", text: teks }] : []), ...(j.alat ?? []).map((a) => ({ type: "tool_use", id: a.id, name: a.name, input: a.input }))];
    return {
      teks,
      berhenti: j.alat?.length ? "alat" : "selesai",
      model: p.model,
      penggunaan: { masuk: 1000, keluar: 200, cacheTulis: 0, cacheBaca: 0 },
      iterasi: [],
      kategoriTolak: "",
      dialihkan: false,
      konten,
      alat: j.alat ?? [],
    };
  }
}

const kumpulkan = async (g: AsyncGenerator<EventAi, void, void>) => {
  const e: EventAi[] = [];
  for await (const x of g) e.push(x);
  return e;
};
const teksDari = (e: EventAi[]) => e.filter((x) => x.jenis === "teks").map((x) => (x as { delta: string }).delta).join("");

describe("mesin: alat data, penyamaran dua arah, matriks kemampuan (pg-mem)", () => {
  let db: AletaDatabase;
  beforeAll(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: false });
    ctx.db = db;
    await simpanKurs(db, { tanggal: tanggalLokal(), kurs: 16000, sumber: "uji" });
    await simpanKurs(db, { tanggal: tanggalLokal(SEKARANG), kurs: 16000, sumber: "uji" });
    await unggahProyek(db, SUPER.id, { bita: susunZip([{ nama: "Rekaan_Core_Prompt.md", isi: Buffer.from("# Core Prompt Rekaan\nAnda asisten hukum rekaan untuk uji.") }]), namaBerkas: "rekaan.zip" });
    for (const p of [HAKIM_SATU, PP_ALFA, PANITERA, PTSP]) await terapkanMutasi(db, { penggunaId: p.id, jenis: "isi", jumlahRp: 500_000, catatan: "uji" });
  }, 180000);
  afterAll(async () => {
    suntikKlienAi(undefined);
    suntikSumberDataAi(undefined);
    await db?.close();
  });
  afterEach(() => ulangiBatasLaju());

  it("UJI KEBOCORAN: tidak ada data asli di permintaan (pesan, riwayat, hasil alat); jawaban dipulihkan; kode tetap di giliran berikut", async () => {
    suntikSumberDataAi(sumberRekaan);
    const klien = new KlienAlatTiruan([
      { teks: ["Saya periksa datanya."], alat: [{ id: "tu-1", name: "data_perkara", input: { nomor: "101/Pdt.G/2026/PA.Dgl", bagian: ["ringkas", "pihak", "relaas"] } }] },
      // [NIK-1] = NIK saksi dari pesan pengguna (disamarkan lebih dulu); NIK penggugat = [NIK-2].
      { teks: ["Penggugat [NA", "MA-1] (NIK [NIK-2]) menggugat [NAMA-2]; relaas untuk [NAMA-2] retur 5 Agustus. Saksi NIK [NIK-1]."] },
      { teks: ["Benar, [NAMA-1] dapat dihubungi di [TELEPON-1]."] },
    ]);
    suntikKlienAi(klien);
    const { id } = await buatPercakapan(db, HAKIM_SATU.id);
    const pesan1 = `Ringkas perkara 101/Pdt.G/2026/PA.Dgl. Saksi saya Rahmat Rekaan NIK 7203015555550009 hp 085299990000.`;
    const e1 = await kumpulkan(kirimPesan(db, HAKIM_SATU, id, { teks: pesan1 }, { sekarang: SEKARANG }));
    expect(e1.map((x) => x.jenis)).toEqual(expect.arrayContaining(["perkiraan", "alat", "teks", "selesai"]));
    expect(e1.find((x) => x.jenis === "alat")).toMatchObject({ nama: "data_perkara", label: "data perkara" });
    const jawaban1 = teksDari(e1);
    expect(jawaban1).toContain(`Penggugat ${PIHAK_ASLI.sitiNama} (NIK ${PIHAK_ASLI.sitiNik}) menggugat ${PIHAK_ASLI.budiNama}`);
    expect(jawaban1).toContain("Saksi NIK 7203015555550009.");
    expect(jawaban1).not.toMatch(/\[(NAMA|NIK)-\d\]/);

    const e2 = await kumpulkan(kirimPesan(db, HAKIM_SATU, id, { teks: `Bisa hubungi Siti Rekaan? Nomor Rahmat 085299990000 masih aktif?` }, { sekarang: new Date(SEKARANG.getTime() + 60_000) }));
    expect(teksDari(e2)).toBe(`Benar, ${PIHAK_ASLI.sitiNama} dapat dihubungi di 085299990000.`);

    // Semua yang dikirim ke layanan AI (pengklasifikasi, jawaban, putaran alat) - tanpa satu pun data asli.
    const terkirim = JSON.stringify(klien.panggilan);
    const asli = [...Object.values(PIHAK_ASLI), "Siti Rekaan", "Budi Rekaan", "7203015555550009", "085299990000"];
    expect(dataAsliTersisa(terkirim, asli)).toEqual([]);
    expect(terkirim).toContain("[NAMA-1]");
    expect(terkirim).toContain("101/Pdt.G/2026/PA.Dgl");
    // Putaran alat: tool_use dikirim balik apa adanya, tool_result tersamar.
    const kedua = klien.panggilan.filter((p) => !p.system[0]?.text.startsWith("Anda pengklasifikasi"))[1]!;
    expect(kedua.tools?.map((t) => t.name)).toContain("data_perkara");
    expect(kedua.messages.at(-2)).toMatchObject({ role: "assistant", content: expect.arrayContaining([expect.objectContaining({ type: "tool_use", id: "tu-1" })]) });
    expect(kedua.messages.at(-1)).toMatchObject({ role: "user", content: [expect.objectContaining({ type: "tool_result", tool_use_id: "tu-1" })] });
    expect(kedua.system[0]?.text).toMatch(/ALAT DATA BACA-SAJA/);

    // Pengguna melihat data asli; tersimpan terenkripsi; kode tersimpan terenkripsi juga.
    const tampil = await ambilPercakapan(db, HAKIM_SATU.id, id);
    expect(tampil.pesan[0]?.isi).toBe(pesan1);
    expect(tampil.pesan[1]?.isi).toContain(PIHAK_ASLI.sitiNama);
    const kode = await db.queryAll<{ kode: string; asli: string }>(`SELECT kode, asli FROM aleta_ai_samaran WHERE percakapan_id = ?`, [id]);
    expect(kode.length).toBeGreaterThanOrEqual(5);
    for (const b of kode) expect(b.asli).toMatch(/^enc:v1:/);
  });

  it("peran tanpa akses data: alat tidak ditawarkan; teks tetap disamarkan", async () => {
    suntikSumberDataAi(sumberRekaan);
    const klien = new KlienAlatTiruan([{ teks: ["Baik, [NAMA-1]."] }]);
    suntikKlienAi(klien);
    const { id } = await buatPercakapan(db, PTSP.id);
    await kumpulkan(kirimPesan(db, PTSP, id, { teks: "Tolong sapa pemohon dengan email warga.rekaan@contoh.test" }, { sekarang: SEKARANG }));
    const jawab = klien.panggilan.filter((p) => !p.system[0]?.text.startsWith("Anda pengklasifikasi"));
    expect(jawab[0]?.tools).toBeUndefined();
    expect(JSON.stringify(klien.panggilan)).not.toContain("warga.rekaan@contoh.test");
  });

  it("matriks kemampuan di server: PP minta draf penetapan PMH ditolak tanpa panggilan API; panitera boleh PPP; timpaan Super Admin berlaku", async () => {
    suntikSumberDataAi(sumberRekaan);
    const klien = new KlienAlatTiruan([]);
    suntikKlienAi(klien);
    const { id } = await buatPercakapan(db, PP_ALFA.id);
    const e = await kumpulkan(kirimPesan(db, PP_ALFA, id, { teks: "Buatkan draf penetapan PMH perkara 101/Pdt.G/2026/PA.Dgl" }, { sekarang: SEKARANG }));
    expect(e).toHaveLength(1);
    expect((e[0] as { pesan: string }).pesan).toMatch(/hanya untuk Admin, Ketua \/ Wakil Ketua, Hakim, Panitera, Panitera Muda/);
    expect(klien.panggilan.filter((p) => !p.system[0]?.text.startsWith("Anda pengklasifikasi"))).toHaveLength(0);
    const jejak = await db.queryAll<{ ringkas: string }>(`SELECT ringkas FROM aleta_ai_jejak WHERE aksi = 'tolak-kemampuan' AND pengguna_id = ?`, [PP_ALFA.id]);
    expect(jejak[0]?.ringkas).toBe("kemampuan=draf-penetapan; jenis=PMH");

    const idP = (await buatPercakapan(db, PANITERA.id)).id;
    const ep = await kumpulkan(kirimPesan(db, PANITERA, idP, { teks: "Susun penetapan PPP perkara 101/Pdt.G/2026/PA.Dgl" }, { sekarang: SEKARANG }));
    expect(ep.at(-1)?.jenis).toBe("selesai");

    // Super Admin mencabut draf BAS dari PP: berlaku di mesin seketika.
    await simpanTimpaanKemampuan(db, SUPER.id, { "draf-bas": ["pimpinan", "hakim", "panitera", "panmud"] });
    expect((await bacaTimpaanKemampuan(db))["draf-bas"]).toEqual(["pimpinan", "hakim", "panitera", "panmud"]);
    const idB = (await buatPercakapan(db, PP_ALFA.id)).id;
    const eb = await kumpulkan(kirimPesan(db, PP_ALFA, idB, { teks: "Susun BAS sidang pertama perkara 101" }, { sekarang: SEKARANG }));
    expect(eb[0]).toMatchObject({ jenis: "gagal" });
    await simpanTimpaanKemampuan(db, SUPER.id, { "draf-bas": null });
    expect((await bacaTimpaanKemampuan(db))["draf-bas"]).toBeUndefined();
  });

  // ─── 7. Rute ─────────────────────────────────────────────────────────────

  it("rute GET /api/aleta-ai/rekap: hakim 200 (angka sama dengan alat), PTSP 403, fitur mati 503, alat asing 400", async () => {
    const { GET } = await import("@/app/api/aleta-ai/rekap/route");
    const minta = (q: string) => GET(new NextRequest(`http://lokal/api/aleta-ai/rekap?${q}`));
    suntikSumberDataAi(sumberRekaan);
    ctx.pelaku = HAKIM_SATU;
    const r = await minta("alat=rekap_relaas_retur&dari=2026-07-23&sampai=2026-10-23");
    expect(r.status).toBe(200);
    const isi = (await r.json()) as { data: { angka: Record<string, number>; nomor_perkara: string[] } };
    expect(isi.data.angka).toEqual({ relaas: 6, perkara_berelaas: 4, relaas_retur: 3, perkara_retur: 3 });
    expect([...isi.data.nomor_perkara].sort()).toEqual(["101/Pdt.G/2026/PA.Dgl", "102/Pdt.G/2026/PA.Dgl", "103/Pdt.P/2026/PA.Dgl"]);
    ctx.pelaku = PTSP;
    expect((await minta("alat=rekap_relaas_retur")).status).toBe(403);
    ctx.pelaku = HAKIM_SATU;
    expect((await minta("alat=hapus_semua")).status).toBe(400);
    suntikSumberDataAi(null);
    expect((await minta("alat=rekap_sisa_perkara")).status).toBe(503);
  });

  it("rute /api/aleta-ai/kemampuan: tiap pengguna melihat haknya; hanya Super Admin mengubah matriks", async () => {
    const { GET, PUT } = await import("@/app/api/aleta-ai/kemampuan/route");
    suntikSumberDataAi(sumberRekaan);
    ctx.pelaku = PP_ALFA;
    const r = (await (await GET(new NextRequest("http://lokal/api/aleta-ai/kemampuan"))).json()) as { data: { kemampuan: Array<{ kemampuan: string; boleh: boolean }>; data: Record<string, string | null>; matriks?: unknown } };
    expect(r.data.kemampuan.find((x) => x.kemampuan === "draf-putusan")?.boleh).toBe(false);
    expect(r.data.kemampuan.find((x) => x.kemampuan === "draf-bas")?.boleh).toBe(true);
    expect(r.data.data).toEqual({ perkara: "milik", relaas: "milik", rekap: "milik" });
    expect(r.data.matriks).toBeUndefined();
    const tolak = await PUT(new NextRequest("http://lokal/api/aleta-ai/kemampuan", { method: "PUT", body: JSON.stringify({ matriks: { "draf-putusan": ["pp"] } }) }));
    expect(tolak.status).toBe(403);
    ctx.pelaku = SUPER;
    const salah = await PUT(new NextRequest("http://lokal/api/aleta-ai/kemampuan", { method: "PUT", body: JSON.stringify({ matriks: { "hapus-data": ["pp"] } }) }));
    expect(salah.status).toBe(400);
    const sa = (await (await GET(new NextRequest("http://lokal/api/aleta-ai/kemampuan"))).json()) as { data: { matriks: Array<{ kemampuan: string; bawaan: boolean }> } };
    expect(sa.data.matriks.map((m) => m.kemampuan)).toEqual(DAFTAR_KEMAMPUAN_AI);
  });
});

describe("katalog: definisi alat aman untuk API", () => {
  it("tiap alat punya skema objek tanpa properti tambahan; tidak ada parameter SQL/teks bebas selain nomor perkara", () => {
    for (const a of KATALOG_ALAT) {
      expect(a.input_schema).toMatchObject({ type: "object", additionalProperties: false });
      const props = Object.keys((a.input_schema as { properties: Record<string, unknown> }).properties);
      expect(props.every((p) => ["dari", "sampai", "per", "minimal_hari", "nomor", "bagian"].includes(p)), a.name).toBe(true);
    }
    expect(PETA_ALAT.size).toBe(KATALOG_ALAT.length);
  });
});
